---
title: "JWT Authentication — Complete Implementation Guide"
subtitle: "devTinder · Node.js + Express + MongoDB"
author: "devTinder Project Reference"
date: "2026"
---

# JWT Authentication — Complete Implementation Guide

> **Stack:** Node.js · Express · MongoDB (Mongoose) · `jsonwebtoken` · `bcrypt` · `cookie-parser`

---

## Table of Contents

1. [How JWT Auth Works](#how-jwt-auth-works)
2. [Project File Structure](#project-file-structure)
3. [Step 1 — Add JWT_SECRET to .env](#step-1--add-jwt_secret-to-env)
4. [Step 2 — Add Methods to the User Model](#step-2--add-methods-to-the-user-model)
5. [Step 3 — Create the Auth Middleware](#step-3--create-the-auth-middleware)
6. [Step 4 — Update the Login Route](#step-4--update-the-login-route)
7. [Step 5 — Protect Routes with the Middleware](#step-5--protect-routes-with-the-middleware)
8. [Step 6 — Add a Logout Route](#step-6--add-a-logout-route)
9. [Step 7 — Signup Should Also Auto-Login](#step-7--signup-should-also-auto-login)
10. [Quick Test Flow](#quick-test-flow)
11. [Security Checklist](#security-checklist)
12. [How JWT Tokens Work Internally](#how-jwt-tokens-work-internally)

---

## How JWT Auth Works

The auth flow has two phases: **issuing** a token and **verifying** it on each protected request.

```
Client                    Express Server              MongoDB
  |                             |                        |
  |-- POST /login ------------->|                        |
  |   { emailId, password }     |-- findOne(email) ----->|
  |                             |<-- User document ------|
  |                             |                        |
  |                             | bcrypt.compare(pwd, hash)
  |                             | jwt.sign({ _id }) → token
  |                             |                        |
  |<-- Set-Cookie: token=... ---|                        |
  |    (httpOnly, 7 days)       |                        |
  |                             |                        |
  |-- GET /profile ------------>|                        |
  |   (cookie auto-sent)        | jwt.verify(token)      |
  |                             | → decoded._id          |
  |                             |-- findById(_id) ------>|
  |                             |<-- User document ------|
  |<-- 200 OK { user } ---------|                        |
```

### Key Concepts

| Concept | Explanation |
|---|---|
| **JWT (JSON Web Token)** | A signed, base64-encoded string: `header.payload.signature` |
| **Signing** | Server creates the token using a secret key — only the server can produce valid tokens |
| **Verifying** | Server checks the signature on every request — any tampering is instantly detected |
| **httpOnly Cookie** | The token is stored in a cookie inaccessible to JavaScript (XSS-safe) |
| **Stateless** | The server doesn't store sessions — the token itself carries the user identity |

---

## Project File Structure

```
src/
├── app.js                   ← login/signup issue cookies; routes use middleware
├── config/
│   └── database.js
├── middlewares/
│   └── auth.js              ← NEW — JWT verification middleware
├── models/
│   └── user.js              ← getJWT() + getUserSafeData() methods added
└── utils/
    └── validation.js
.env                         ← JWT_SECRET stored here
```

---

## Step 1 — Add `JWT_SECRET` to `.env`

```env
PORT=3000
MONGODB_URI=your_connection_string
JWT_SECRET=devtinder_super_secret_key_change_in_production
```

> **⚠️ Security:** Never commit `.env` to Git. Add it to `.gitignore`.  
> In production, use a randomly generated 256-bit secret (e.g. `openssl rand -base64 32`).

---

## Step 2 — Add Methods to the User Model

**File:** `src/models/user.js`

Add at the top:

```js
const jwt = require("jsonwebtoken");
```

Add before `mongoose.model(...)`:

```js
// Generate a signed JWT for this user
userSchema.methods.getJWT = function () {
  return jwt.sign({ _id: this._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// Return sanitized user data (strips password from response)
userSchema.methods.getUserSafeData = function () {
  const {
    _id, firstName, lastName, emailId,
    photoUrl, about, skills, gender, age
  } = this;
  return { _id, firstName, lastName, emailId, photoUrl, about, skills, gender, age };
};
```

### Why methods on the model?

- **Reusability** — call `user.getJWT()` from any route handler
- **Encapsulation** — auth logic lives with the entity it belongs to
- **Clean routes** — `app.js` stays readable

### How `jwt.sign()` Works

```
jwt.sign(payload, secret, options)
         │         │       └── { expiresIn: "7d" }
         │         └── process.env.JWT_SECRET
         └── { _id: "64abc..." }  ← only store the user ID, not sensitive data
```

The resulting token looks like:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9    ← header (algorithm)
.eyJfaWQiOiI2NGFiYy4uLiJ9              ← payload (your data, base64)
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c  ← signature
```

---

## Step 3 — Create the Auth Middleware

**New file:** `src/middlewares/auth.js`

```js
const jwt = require("jsonwebtoken");
const { User } = require("../models/user");

const userAuth = async (req, res, next) => {
  try {
    // 1. Read the token from the cookie
    const { token } = req.cookies;

    if (!token) {
      return res.status(401).json({ message: "Please login first" });
    }

    // 2. Verify the token signature and decode the payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //   decoded = { _id: "64abc...", iat: ..., exp: ... }

    // 3. Find the user in the database
    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(401).json({ message: "User not found, please login again" });
    }

    // 4. Attach the user to the request object for downstream use
    req.user = user;
    next();                     // ← pass control to the actual route handler

  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired, please login again" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token, please login again" });
    }
    res.status(500).json({ message: "Authentication error: " + err.message });
  }
};

module.exports = { userAuth };
```

### Middleware Flow

```
Request
   │
   ▼
cookieParser()         ← reads cookie header into req.cookies
   │
   ▼
userAuth middleware
   ├─ No token?        → 401 "Please login first"
   ├─ Bad signature?   → 401 "Invalid token"
   ├─ Expired?         → 401 "Session expired"
   ├─ User deleted?    → 401 "User not found"
   └─ All good?        → req.user = user → next()
                                              │
                                              ▼
                                     Route Handler
                                     (has req.user)
```

---

## Step 4 — Update the Login Route

**File:** `src/app.js`

```js
app.post("/login", async (req, res) => {
  try {
    const { emailId, password } = req.body;

    // Find user
    const user = await User.findOne({ emailId });
    if (!user) return res.status(404).send("Invalid credentials");

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).send("Invalid credentials");

    // ✅ Issue JWT and store in cookie
    const token = user.getJWT();
    res.cookie("token", token, {
      httpOnly: true,                     // JS cannot read this cookie (XSS safe)
      maxAge: 7 * 24 * 60 * 60 * 1000,   // 7 days in milliseconds
      // secure: true,                    // ← uncomment in production (HTTPS only)
      // sameSite: "strict",              // ← uncomment in production (CSRF safe)
    });

    res.json({ message: "Login successful", user: user.getUserSafeData() });
  } catch (err) {
    res.status(400).send("Error logging in: " + err.message);
  }
});
```

### Cookie Options Explained

| Option | Value | Purpose |
|---|---|---|
| `httpOnly` | `true` | JavaScript cannot access this cookie — prevents XSS attacks stealing the token |
| `maxAge` | `7 * 24 * 60 * 60 * 1000` | Cookie lives for 7 days (in milliseconds) |
| `secure` | `true` (production) | Cookie only sent over HTTPS connections |
| `sameSite` | `"strict"` (production) | Cookie not sent on cross-site requests — prevents CSRF |

---

## Step 5 — Protect Routes with the Middleware

**File:** `src/app.js`

Import the middleware at the top:

```js
const { userAuth } = require("./middlewares/auth");
```

Then add it as the **second argument** to any route you want to protect:

```js
// Profile — only logged-in users
app.get("/profile", userAuth, (req, res) => {
  res.json({ user: req.user.getUserSafeData() });
  //              ↑ set by userAuth middleware
});

// Feed — only logged-in users can browse
app.get("/feed", userAuth, async (req, res) => {
  const users = await User.find({});
  res.send(users);
});

// Delete — protected
app.delete("/user/:userId?", userAuth, async (req, res) => { ... });

// Update — protected
app.patch("/user/:userId?", userAuth, async (req, res) => { ... });
```

The pattern is always:
```
app.METHOD("/path", userAuth, actualHandlerFunction)
                      ↑
              inject here to protect
```

---

## Step 6 — Add a Logout Route

```js
app.post("/logout", userAuth, (req, res) => {
  // Clear the token cookie by setting it to empty with an expired date
  res.cookie("token", "", { expires: new Date(0) });
  res.json({ message: "Logged out successfully" });
});
```

> **Note:** Because JWTs are stateless, we can't truly "invalidate" a token server-side without a blocklist.  
> Clearing the cookie is sufficient for most apps — the token becomes inaccessible to the browser.  
> For high-security apps, maintain a server-side token blocklist (e.g. in Redis).

---

## Step 7 — Signup Should Also Auto-Login

After creating the user, issue a token so they're logged in immediately — no need for a separate login step:

```js
app.post("/signup", async (req, res) => {
  validateSignUpData(req);

  const passwordHash = await bcrypt.hash(req.body.password, 10);
  const user = new User({ ...req.body, password: passwordHash });
  await user.save();

  // ✅ Auto-login: issue JWT right after account creation
  const token = user.getJWT();
  res.cookie("token", token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    message: "User added successfully",
    user: user.getUserSafeData(),
  });
});
```

---

## Quick Test Flow

### With Postman or curl:

```bash
# 1. Sign up (auto-login — cookie is set in response)
POST http://localhost:3000/signup
Body: {
  "firstName": "Sachin",
  "lastName": "Prasad",
  "emailId": "sachin@example.com",
  "password": "Test@1234"
}

# 2. Login (sets token cookie)
POST http://localhost:3000/login
Body: { "emailId": "sachin@example.com", "password": "Test@1234" }

# 3. Access protected profile (cookie sent automatically by browser/Postman)
GET http://localhost:3000/profile

# 4. Logout (clears the cookie)
POST http://localhost:3000/logout
```

> **In Postman:** Enable "Automatically follow redirects" and "Save cookies" under Settings.

---

## Security Checklist

| Item | Status | Notes |
|---|---|---|
| Passwords hashed with bcrypt | ✅ Done | salt rounds = 10 |
| JWT signed with server secret | ✅ Done | stored in `.env` |
| Token stored in `httpOnly` cookie | ✅ Done | JS cannot steal it |
| Token expiry set | ✅ Done | 7 days |
| `password` never sent in responses | ✅ Done | `getUserSafeData()` strips it |
| `secure: true` on cookie | ⚠️ Production only | requires HTTPS |
| `sameSite: "strict"` on cookie | ⚠️ Production only | CSRF protection |
| Strong `JWT_SECRET` | ⚠️ Change before deploy | use `openssl rand -base64 32` |
| Rate limiting on `/login` | 🔲 Not yet | add `express-rate-limit` |
| Token refresh strategy | 🔲 Not yet | issue refresh tokens for long sessions |

---

## How JWT Tokens Work Internally

A JWT has 3 parts separated by dots: `xxxxx.yyyyy.zzzzz`

```
HEADER          PAYLOAD           SIGNATURE
─────────       ───────────────   ───────────────────────────────────
{               {                 HMACSHA256(
  "alg":"HS256",  "_id": "64ab..",   base64(header) + "." +
  "typ":"JWT"     "iat": 1700000000, base64(payload),
}               }  "exp": 1700604800  secret
                }                 )
```

- **Header** — algorithm used (HS256 = HMAC-SHA256)
- **Payload** — your data (user ID + timestamps). **Not encrypted — just base64 encoded. Don't put secrets here!**
- **Signature** — the HMAC of header+payload using your secret. Only the server can produce this.

### Why is it safe?

An attacker can **read** the payload (it's base64, not encrypted), but cannot **forge** a valid signature without knowing your `JWT_SECRET`. That's why keeping the secret secure is critical.

---

*Reference document generated for the devTinder project.*

require("dotenv").config();
const express = require("express");
const { connectDB } = require("./config/database");
const { User } = require("./models/user");
const {
  validateSignUpData,
  validateEditProfileData,
} = require("./utils/validation");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 1. SIGNUP: Create a user
app.post("/signup", async (req, res) => {
  try {
    // API level validation
    validateSignUpData(req);

    const user = new User(req.body);
    await user.save();
    res.status(201).json({ message: "User added successfully", user });
  } catch (err) {
    res.status(400).send("Error saving the user: " + err.message);
  }
});

// 2. GET USER: By Email (using query parameter: /user?emailId=...)
app.get("/user", async (req, res) => {
  const userEmail = req.query.emailId || req.body.emailId;

  try {
    const user = await User.findOne({ emailId: userEmail });
    if (!user) {
      return res.status(404).send("User not found");
    }
    res.send(user);
  } catch (err) {
    res.status(400).send("Something went wrong: " + err.message);
  }
});

// 3. GET FEED / ALL USERS
app.get("/feed", async (req, res) => {
  try {
    const users = await User.find({});
    res.send(users);
  } catch (err) {
    res.status(400).send("Something went wrong: " + err.message);
  }
});

// 4. DELETE USER: By ID (/user/:userId or fallback to req.body.userId)
app.delete("/user/:userId?", async (req, res) => {
  const userId = req.params.userId || req.body.userId;

  try {
    if (!userId) {
      return res.status(400).send("User ID is required to delete user");
    }
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).send("User not found");
    }
    res.send({ message: "User deleted successfully", user: deletedUser });
  } catch (err) {
    res.status(400).send("Something went wrong: " + err.message);
  }
});

// 5. UPDATE USER: With API validation and schema validation
app.patch("/user/:userId?", async (req, res) => {
  const userId = req.params.userId || req.body.userId;

  try {
    if (!userId) {
      return res.status(400).send("User ID is required to update user");
    }

    // API level validation for allowed editable fields
    const isAllowed = validateEditProfileData(req);
    if (!isAllowed) {
      throw new Error("Update not allowed for one or more fields");
    }

    const updatedUser = await User.findByIdAndUpdate(userId, req.body, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).send("User not found");
    }

    res.send({ message: "User updated successfully", user: updatedUser });
  } catch (err) {
    res.status(400).send("Error updating the user: " + err.message);
  }
});

connectDB()
  .then(() => {
    console.log("DB connection established...");
    app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
  })
  .catch((err) => console.error("Error connection to DB...", err));

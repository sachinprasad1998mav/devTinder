const jwt = require("jsonwebtoken");
const { User } = require("../models/user");

const userAuth = async (req, res, next) => {
  try {
    const { token } = req.cookies;

    if (!token) {
      return res.status(401).json({ message: "Please login first" });
    }

    // Verify token and extract payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch the user and attach to request object
    const user = await User.findById(decoded._id);
    if (!user) {
      return res
        .status(401)
        .json({ message: "User not found, please login again" });
    }

    req.user = user; // available in all downstream route handlers
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Session expired, please login again" });
    }
    if (err.name === "JsonWebTokenError") {
      return res
        .status(401)
        .json({ message: "Invalid token, please login again" });
    }
    res.status(500).json({ message: "Authentication error: " + err.message });
  }
};

module.exports = { userAuth };

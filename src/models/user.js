const mongoose = require("mongoose");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minLength: [2, "First name must be at least 2 characters"],
      maxLength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      trim: true,
      maxLength: [50, "Last name cannot exceed 50 characters"],
    },
    emailId: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Invalid email address: " + value);
        }
      },
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    age: {
      type: Number,
      min: [18, "You must be at least 18 years old"],
      max: [100, "Please enter a valid age"],
    },
    gender: {
      type: String,
      lowercase: true,
      trim: true,
      validate(value) {
        if (!["male", "female", "others"].includes(value)) {
          throw new Error("Gender data is not valid (must be male, female, or others)");
        }
      },
    },
    photoUrl: {
      type: String,
      default: "https://geographyandyou.com/images/user-profile.png",
      validate(value) {
        if (!validator.isURL(value)) {
          throw new Error("Invalid photo URL: " + value);
        }
      },
    },
    about: {
      type: String,
      default: "This is a default about of the user!",
      maxLength: [250, "About section cannot exceed 250 characters"],
    },
    skills: {
      type: [String],
      validate: {
        validator: function (val) {
          return val.length <= 10;
        },
        message: "You can add up to 10 skills only",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Instance method: generate a signed JWT for this user
userSchema.methods.getJWT = function () {
  return jwt.sign({ _id: this._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// Instance method: return a sanitized user object (no password)
userSchema.methods.getUserSafeData = function () {
  const { _id, firstName, lastName, emailId, photoUrl, about, skills, gender, age } =
    this;
  return { _id, firstName, lastName, emailId, photoUrl, about, skills, gender, age };
};

const User = mongoose.model("User", userSchema);

module.exports = { User };

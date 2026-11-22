const validator = require("validator");

const validateSignUpData = (req) => {
  const { firstName, lastName, emailId, password } = req.body;

  if (!firstName || !lastName) {
    throw new Error("First name and last name are required");
  } else if (!validator.isLength(firstName, { min: 2, max: 50 })) {
    throw new Error("First name should be between 2 and 50 characters");
  } else if (!validator.isEmail(emailId || "")) {
    throw new Error("Email ID is not valid");
  } else if (!validator.isStrongPassword(password || "")) {
    throw new Error(
      "Please enter a strong password (minimum 8 characters with at least 1 lowercase, 1 uppercase, 1 number, and 1 symbol)"
    );
  }
};

const validateEditProfileData = (req) => {
  const ALLOWED_UPDATES = [
    "firstName",
    "lastName",
    "photoUrl",
    "gender",
    "age",
    "about",
    "skills",
  ];

  const isEditAllowed = Object.keys(req.body).every((field) =>
    ALLOWED_UPDATES.includes(field)
  );

  return isEditAllowed;
};

module.exports = {
  validateSignUpData,
  validateEditProfileData,
};

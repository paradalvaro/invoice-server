const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["SuperAdmin", "Admin", "User"],
    default: "User",
  },
  photoUrl: {
    type: String,
  },
});

module.exports = mongoose.model("User", UserSchema);

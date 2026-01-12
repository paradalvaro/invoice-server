const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({
  timezone: {
    type: String,
    default: "Europe/Madrid",
    required: true,
  },
  // Placeholder for future global settings
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Settings", SettingsSchema);

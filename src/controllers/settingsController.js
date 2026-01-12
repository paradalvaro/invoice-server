const Settings = require("../models/Settings");

/**
 * Get global settings
 * @returns {Object} Settings object
 */
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      // Create default settings if not exists
      settings = new Settings();
      await settings.save();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Update global settings
 * @param {Object} req.body - Settings data
 */
const updateSettings = async (req, res) => {
  try {
    const { timezone } = req.body;
    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings({ timezone });
    } else {
      settings.timezone = timezone || settings.timezone;
      settings.updatedAt = Date.now();
    }

    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
};

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
    } else {
      // Ensure missing default fields are present for existing documents
      const defaults = new Settings();
      let changed = false;

      // Check series
      if (!settings.series) {
        settings.series = defaults.series;
        changed = true;
      } else {
        ["invoices", "albaranes", "budgets", "bills"].forEach((key) => {
          if (!settings.series[key]) {
            settings.series[key] = defaults.series[key];
            changed = true;
          }
        });
      }

      // Check company, registry, and bank
      ["company", "registry", "bank"].forEach((field) => {
        if (!settings[field]) {
          settings[field] = defaults[field];
          changed = true;
        } else {
          // Check nested fields
          Object.keys(defaults[field].toObject()).forEach((key) => {
            if (settings[field][key] === undefined) {
              settings[field][key] = defaults[field][key];
              changed = true;
            }
          });
        }
      });

      if (changed) {
        await settings.save();
      }
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
    const { timezone, series, logo, company, registry, bank } = req.body;
    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings({
        timezone,
        series,
        logo,
        company,
        registry,
        bank,
      });
    } else {
      settings.timezone = timezone || settings.timezone;
      if (series) settings.series = series;
      if (logo !== undefined) settings.logo = logo;
      if (company) settings.company = { ...settings.company, ...company };
      if (registry) settings.registry = { ...settings.registry, ...registry };
      if (bank) settings.bank = { ...settings.bank, ...bank };
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

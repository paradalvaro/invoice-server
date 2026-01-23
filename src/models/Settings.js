const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({
  timezone: {
    type: String,
    default: "Europe/Madrid",
    required: true,
  },
  series: {
    invoices: { type: [String], default: ["A2025", "A2026", "R2025", "R2026"] },
    albaranes: { type: [String], default: ["AL2025", "AL2026"] },
    budgets: { type: [String], default: ["P2025", "P2026"] },
    bills: { type: [String], default: ["G2025", "G2026"] },
  },
  logo: {
    type: String,
    default: "", // Base64 string or null
  },
  company: {
    name: { type: String, default: "VerSal-IT" },
    address: { type: String, default: "Avenida Barcelona" },
    postalCode: { type: String, default: "14010" },
    city: { type: String, default: "Córdoba" },
    province: { type: String, default: "Córdoba" },
    country: { type: String, default: "España" },
    email: { type: String, default: "info@versal-it.es" },
    url: { type: String, default: "https://versal-it.com/" },
    nif: { type: String, default: "B00000000" },
  },
  registry: {
    tomo: { type: String, default: "00000" },
    libro: { type: String, default: "0" },
    folio: { type: String, default: "000" },
    seccion: { type: String, default: "0" },
    hoja: { type: String, default: "X 000000" },
    inscripcion: { type: String, default: "0" },
  },
  bank: {
    name: { type: String, default: "BBVA" },
    iban: { type: String, default: "ES0000000000000000000000" },
    swift: { type: String, default: "XXXXXXXX" },
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Settings", SettingsSchema);

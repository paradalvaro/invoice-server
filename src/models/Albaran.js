const mongoose = require("mongoose");

const getStatus = (ctx) => {
  if (ctx instanceof mongoose.Query) {
    const update = ctx.getUpdate();
    return update.status || (update.$set && update.$set.status);
  }
  return ctx.status;
};

const AlbaranSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  budgetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Budget",
    required: false,
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Invoice",
    required: false,
  },
  serie: {
    type: String,
    enum: ["AL2025", "AL2026"],
    required: function () {
      return getStatus(this) !== "Draft";
    },
  },
  AlbaranNumber: {
    type: Number,
    required: function () {
      return getStatus(this) !== "Draft";
    },
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: function () {
      return getStatus(this) !== "Draft";
    },
  },
  services: {
    type: [
      {
        concept: { type: String, required: true },
        number: { type: Number },
        quantity: { type: Number, required: true, default: 1 },
      },
    ],
    validate: {
      validator: function (v) {
        if (getStatus(this) === "Draft") return true;
        return Array.isArray(v) && v.length > 0;
      },
      message: "Debes agregar al menos un servicio.",
    },
  },
  status: {
    type: String,
    enum: ["Draft", "Done"],
    default: "Draft",
  },
  orderNumber: {
    type: String,
  },
  ourDocumentNumber: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

module.exports = mongoose.model("Albaran", AlbaranSchema);

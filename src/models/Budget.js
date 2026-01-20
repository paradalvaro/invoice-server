const mongoose = require("mongoose");

const getStatus = (ctx) => {
  if (ctx instanceof mongoose.Query) {
    const update = ctx.getUpdate();
    return update.status || (update.$set && update.$set.status);
  }
  return ctx.status;
};

const BudgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  serie: {
    type: String,
    enum: ["P2025", "P2026"],
    required: function () {
      return getStatus(this) !== "Draft";
    },
  },
  budgetNumber: {
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
        number: {
          type: String,
          required: true,
          validate: {
            validator: function (v) {
              return /^[a-zA-Z0-9\s-]+$/.test(v);
            },
            message: (props) =>
              `${props.value} is not a valid alphanumeric number!`,
          },
        },
        quantity: { type: Number, required: true, default: 1 },
        taxBase: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        iva: { type: Number, required: true, default: 21 },
        albaranId: { type: mongoose.Schema.Types.ObjectId, ref: "Albaran" },
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
  totalAmount: {
    type: Number,
    required: function () {
      return getStatus(this) !== "Draft";
    },
  },
  paymentTerms: {
    type: String,
    enum: [
      "1 day",
      "7 days",
      "15 days",
      "30 days",
      "45 days",
      "60 days",
      "Manual",
    ],
    default: "1 day",
  },
  paymentTermsManual: {
    type: String,
    required: function () {
      return getStatus(this) !== "Draft" && this.paymentTerms === "Manual";
    },
  },
  status: {
    type: String,
    enum: ["Draft", "Done"],
    default: "Draft",
  },
  dueDate: {
    type: Date,
    required: function () {
      return getStatus(this) !== "Draft";
    },
  },
  date: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

BudgetSchema.pre("validate", async function () {
  if (this.services && this.services.length > 0) {
    this.totalAmount = this.services.reduce((acc, service) => {
      const base = parseFloat(service.taxBase);
      const quantity = parseFloat(service.quantity);
      const discount = parseFloat(service.discount) || 0;
      const ivaPercent = parseFloat(service.iva) || 0;

      const subtotal = base * quantity;
      const discountAmount = subtotal * (discount / 100);
      const taxableAmount = subtotal - discountAmount;
      const ivaAmount = taxableAmount * (ivaPercent / 100);

      return acc + taxableAmount + ivaAmount;
    }, 0);
  }
});

module.exports = mongoose.model("Budget", BudgetSchema);

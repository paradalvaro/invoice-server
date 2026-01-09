const mongoose = require("mongoose");

const BudgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  budgetNumber: {
    type: Number,
    required: true,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: false,
  },
  services: {
    type: [
      {
        concept: { type: String, required: true },
        quantity: { type: Number, required: true, default: 1 },
        taxBase: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        iva: { type: Number, required: true, default: 21 },
      },
    ],
    required: true,
    validate: {
      validator: function (v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: "Debes agregar al menos un servicio a la factura.",
    },
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["Draft", "Done"],
    default: "Draft",
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

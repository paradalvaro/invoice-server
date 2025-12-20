const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  serie: {
    type: String,
    enum: ["A2025", "A2026"],
    default: "A2025",
  },
  invoiceNumber: {
    type: Number,
    required: true,
  },
  clientName: {
    type: String,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["Draft", "Pending", "Paid"],
    default: "Pending",
  },
  dueDate: {
    type: Date,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Invoice", InvoiceSchema);

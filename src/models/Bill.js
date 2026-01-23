const mongoose = require("mongoose");

const BillSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  serie: {
    type: String,
    required: function () {
      return this.status !== "Draft";
    },
  },
  billNumber: {
    type: Number,
    required: function () {
      return this.status !== "Draft";
    },
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
    required: false,
  },
  supplierName: {
    type: String,
    required: function () {
      return this.status !== "Draft";
    },
  },
  supplierNIF: {
    type: String,
    required: function () {
      return this.status !== "Draft";
    },
    validate: {
      validator: function (v) {
        if (!v) return true;
        // Individual NIF (DNI): 8 digits + 1 control character
        const individualDniRegex = /^[0-9]{8}[A-Z]$/;
        // Individual NIF (Non-resident): L/M + 7 digits + 1 control character
        const individualNonResidentRegex = /^[LM][0-9]{7}[A-Z]$/;
        // Business NIF: Letter (A-W) + 7 digits + 1 control character (can be letter or digit)
        const businessNifRegex = /^[ABCDEFGHJNPQRSUVW][0-9]{7}[A-Z0-9]$/;

        return (
          individualDniRegex.test(v) ||
          individualNonResidentRegex.test(v) ||
          businessNifRegex.test(v)
        );
      },
      message: (props) => `${props.value} is not a valid NIF!`,
    },
  },
  services: {
    type: [
      {
        concept: { type: String, required: true },
        number: {
          type: String,
          validate: {
            validator: function (v) {
              if (!v) return true; // Optional in Invoice
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
  balanceDue: {
    type: Number,
    required: function () {
      return this.status !== "Draft";
    },
  },
  orderNumber: {
    type: String,
    required: false,
  },
  paymentMethod: {
    type: String,
    enum: ["Transferencia", "Efectivo", "Tarjeta", "Domiciliación bancaria"],
    default: "Transferencia",
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
    required: function () {
      return this.status !== "Draft";
    },
  },
});

BillSchema.pre("validate", async function () {
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

  // Initialize balanceDue if not present
  if (this.balanceDue === undefined) {
    if (this.status === "Paid") {
      this.balanceDue = 0;
    } else {
      this.balanceDue = this.totalAmount || 0;
    }
  }
});

module.exports = mongoose.model("Bill", BillSchema);

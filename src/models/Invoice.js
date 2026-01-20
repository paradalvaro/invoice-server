const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  serie: {
    type: String,
    enum: ["A2025", "A2026", "R2025", "R2026"],
    required: function () {
      return this.status !== "Draft";
    },
  },
  type: {
    type: String,
    enum: ["F1", "F2", "R1", "R4"],
    required: true,
    default: "F1",
  },
  invoiceNumber: {
    type: Number,
    required: function () {
      return this.status !== "Draft";
    },
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: false,
  },
  clientName: {
    type: String,
    required: function () {
      return this.type !== "F2" && this.status !== "Draft";
    },
  },
  clientNIF: {
    type: String,
    required: function () {
      return this.type !== "F2" && this.status !== "Draft";
    },
    validate: {
      validator: function (v) {
        if (this.type === "F2" && !v) return true;
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
        albaranId: { type: mongoose.Schema.Types.ObjectId, ref: "Albaran" },
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
  externalDocumentNumber: {
    type: String,
    required: false,
    validate: {
      validator: function (v) {
        if (!v) return true; // Optional in Invoice
        return /^[a-zA-Z0-9\s-]+$/.test(v);
      },
      message: (props) => `${props.value} is not a valid alphanumeric number!`,
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
  hash: {
    type: String,
    required: function () {
      return this.status !== "Draft";
    },
  },
  rectifyInvoice: {
    type: String,
    required: function () {
      return /^(R1|R4)$/.test(this.type);
    },
  },
  rectifyReason: {
    type: String,
    required: function () {
      return /^(R1|R4)$/.test(this.type);
    },
  },
  history: [
    {
      type: {
        type: String,
        enum: ["CREATED", "STATUS_CHANGE", "EMAIL_SENT", "ALBARAN_LINKED"],
      },
      date: { type: Date, default: Date.now },
      description: String,
      details: mongoose.Schema.Types.Mixed,
    },
  ],
});

InvoiceSchema.pre("validate", async function () {
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

module.exports = mongoose.model("Invoice", InvoiceSchema);

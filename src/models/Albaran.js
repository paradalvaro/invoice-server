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
        number: {
          type: String,
          validate: {
            validator: function (v) {
              if (!v) return true; // Optional in Albaran
              return /^[a-zA-Z0-9\s-]+$/.test(v);
            },
            message: (props) =>
              `${props.value} is not a valid alphanumeric number!`,
          },
        },
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

const mongoose = require("mongoose");

const ClientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientNumber: {
      type: Number,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nif: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator: function (v) {
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
    address: {
      type: String,
      trim: true,
    },
    postalCode: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    province: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    paymentMethod: {
      type: String,
      enum: ["Transferencia", "Efectivo", "Tarjeta", "Domiciliación bancaria"],
      default: "Transferencia",
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
        return this.paymentTerms === "Manual";
      },
    },
    contactPerson: {
      type: [
        {
          name: { type: String, required: true },
          lastName: { type: String, required: true },
          phoneNumber: { type: String, required: true },
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

// Index to ensure NIF is unique globally since clients are now shared among all users.
ClientSchema.index({ nif: 1 }, { unique: true });

module.exports = mongoose.model("Client", ClientSchema);

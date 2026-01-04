const mongoose = require("mongoose");

const ClientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure NIF is unique per user (if clients are user-specific)
// Or just unique globally if appropriate. Assuming per-user based on Invoice model containing userId.
ClientSchema.index({ userId: 1, nif: 1 }, { unique: true });

module.exports = mongoose.model("Client", ClientSchema);

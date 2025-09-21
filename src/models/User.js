import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String },
    role: { type: String, enum: ["client", "photographer"], default: "client" },
    provider: { type: String, enum: ["local", "google", "facebook", "apple"], default: "local" },
    providerId: { type: String },

    businessName: { type: String },

    // ✅ New fields for verification & reset
    emailVerified: { type: Boolean, default: false },
    verificationCode: { type: String },     // store last sent code
    resetPasswordCode: { type: String },    // store last reset code
    resetPasswordExpires: { type: Date }    // expire window for reset
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);

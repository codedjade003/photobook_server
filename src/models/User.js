import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String }, // only for email/password signup
    role: { type: String, enum: ["client", "photographer"], default: "client" },
    provider: { type: String, enum: ["local", "google", "facebook", "apple"], default: "local" },
    providerId: { type: String }, // social provider ID
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);

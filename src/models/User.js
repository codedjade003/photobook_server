// src/models/User.js
import mongoose from "mongoose";

const RateCardItemSchema = new mongoose.Schema({
  service: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 1 }, // optional
}, { _id: false });

const PortfolioItemSchema = new mongoose.Schema({
  type: { type: String, enum: ["image", "video"], required: true },
  url: { type: String, required: true },
  key: { type: String }, // S3 key for deletion
  title: { type: String },
  description: { type: String },
  uploadedAt: { type: Date, default: Date.now }
});

const ReviewSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const CreativeDetailsSchema = new mongoose.Schema({
  aboutMe: { type: String },
  rateCard: { type: [RateCardItemSchema], default: [] },
  portfolio: { type: [PortfolioItemSchema], default: [] },
  tags: { type: [String], default: [] },
  categories: { type: [String], default: [] },
  reviews: { type: [ReviewSchema], default: [] },
  galleryCount: { type: Number, default: 0 }
}, { _id: false });

const ClientDetailsSchema = new mongoose.Schema({
  joinedAt: { type: Date, default: Date.now },
  bookingsCount: { type: Number, default: 0 }
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    displayName: { type: String }, // friendly name
    email: { type: String, unique: true, sparse: true },
    password: { type: String },
    avatarUrl: { type: String },
    avatarKey: { type: String }, // S3 key
    role: { type: String, enum: ["client", "photographer"], default: "client" },
    provider: { type: String, enum: ["local", "google", "facebook", "apple"], default: "local" },
    providerId: { type: String },

    businessName: { type: String },

    // verification / reset
    emailVerified: { type: Boolean, default: false },
    verificationCode: { type: String },
    resetPasswordCode: { type: String },
    resetPasswordExpires: { type: Date },

    // profile details
    creativeDetails: { type: CreativeDetailsSchema, default: () => ({}) },
    clientDetails: { type: ClientDetailsSchema, default: () => ({}) },

    // public metadata
    location: { type: String },
    phone: { type: String },
    socialLinks: {
      instagram: { type: String },
      website: { type: String },
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);

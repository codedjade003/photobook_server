import User from "../models/User.js";
import s3 from "../utils/s3.js";
import mongoose from "mongoose";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { generateFileName } from "../config/multer.js";

const S3_BUCKET = process.env.S3_BUCKET_NAME;
const MAX_PORTFOLIO_ITEMS = parseInt(process.env.MAX_PORTFOLIO_ITEMS || "50");

// Helper to build response
function profileResponse(userDoc, viewerId) {
  const isOwner = viewerId && userDoc._id.equals(viewerId);
  const base = {
    id: userDoc._id,
    role: userDoc.role,
    isOwner,
    basic: {
      displayName: userDoc.displayName || userDoc.name,
      businessName: userDoc.businessName || "",
      avatarUrl: userDoc.avatarUrl,
      location: userDoc.location || "",
      phone: userDoc.phone || "",
    },
  };

  if (userDoc.role === "photographer") {
    base.creativeDetails = {
      aboutMe: userDoc.creativeDetails.aboutMe || "",
      rateCard: userDoc.creativeDetails.rateCard || [],
      portfolio: userDoc.creativeDetails.portfolio || [],
      tags: userDoc.creativeDetails.tags || [],
      categories: userDoc.creativeDetails.categories || [],
      reviews: userDoc.creativeDetails.reviews || [],
    };
  } else {
    base.clientDetails = {
      joinedAt: userDoc.clientDetails.joinedAt || userDoc.createdAt,
      bookingsCount: userDoc.clientDetails.bookingsCount || 0,
    };
  }

  return base;
}

// GET /profiles/:id
export const getProfile = async (req, res) => {
  try {
    const profileId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(profileId))
      return res.status(400).json({ message: "Invalid profile id" });

    const user = await User.findById(profileId).select("-password");
    if (!user) return res.status(404).json({ message: "Profile not found" });

    const viewerId = req.user?.id;
    const payload = profileResponse(user, viewerId);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /profiles/creative
export const updateCreativeProfile = async (req, res) => {
  try {
    const updates = {};
    const allowed = [
      "displayName",
      "aboutMe",
      "rateCard",
      "categories",
      "tags",
      "businessName",
      "location",
      "phone",
      "socialLinks",
    ];

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    if (Array.isArray(req.body.rateCard)) {
      updates["creativeDetails.rateCard"] = req.body.rateCard.map((item) => ({
        service: String(item.service || ""),
        qty: String(item.qty || ""),
        pricing: String(item.pricing || ""),
      }));
    }

    const setObj = {
      ...updates,
      "creativeDetails.aboutMe": req.body.aboutMe,
      "creativeDetails.categories": req.body.categories,
      "creativeDetails.tags": req.body.tags,
    };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: setObj },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Profile updated", user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /profiles/client
export const updateClientProfile = async (req, res) => {
  try {
    const allowed = ["displayName", "businessName", "location", "phone", "socialLinks"];
    const updates = {};

    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Profile updated", user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /profiles/creative/portfolio
export const uploadPortfolioItem = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "File is required" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.creativeDetails.portfolio.length >= MAX_PORTFOLIO_ITEMS) {
      return res.status(400).json({ message: "Portfolio item limit reached" });
    }

    const key = generateFileName(file.originalname);
    const uploadParams = {
      Bucket: S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await s3.send(new PutObjectCommand(uploadParams));
    const fileUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    const type = file.mimetype.startsWith("video/") ? "video" : "image";

    const entry = {
      type,
      url: fileUrl,
      key,
      title: req.body.title || "",
      description: req.body.description || "",
      uploadedAt: new Date(),
    };

    user.creativeDetails.portfolio.unshift(entry);
    user.creativeDetails.galleryCount = user.creativeDetails.portfolio.length;
    await user.save();

    res.status(201).json({ message: "Portfolio uploaded successfully", item: entry });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE /profiles/creative/portfolio/:itemId
export const deletePortfolioItem = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const idx = user.creativeDetails.portfolio.findIndex(
      (p) => p._id.toString() === req.params.itemId
    );
    if (idx === -1) return res.status(404).json({ message: "Portfolio item not found" });

    const [removed] = user.creativeDetails.portfolio.splice(idx, 1);
    user.creativeDetails.galleryCount = user.creativeDetails.portfolio.length;
    await user.save();

    if (removed.key) {
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: removed.key }));
    }

    res.json({ message: "Portfolio item deleted", item: removed });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /profiles/avatar
export const uploadAvatar = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "Avatar file is required" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Remove old avatar if exists
    if (user.avatarKey) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: user.avatarKey }));
      } catch (e) {
        console.warn("Failed to remove old avatar:", e.message);
      }
    }

    const key = generateFileName(file.originalname);
    const uploadParams = {
      Bucket: S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await s3.send(new PutObjectCommand(uploadParams));
    const avatarUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    user.avatarUrl = avatarUrl;
    user.avatarKey = key;
    await user.save();

    res.status(201).json({ message: "Avatar uploaded", avatarUrl });
  } catch (err) {
    console.error("Avatar upload error:", err);
    res.status(500).json({ message: err.message });
  }
};

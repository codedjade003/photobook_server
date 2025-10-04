// src/controllers/profileController.js
import User from "../models/User.js";
import s3 from "../utils/s3.js";
import mongoose from "mongoose";

const S3_BUCKET = process.env.S3_BUCKET_NAME;
const MAX_PORTFOLIO_ITEMS = parseInt(process.env.MAX_PORTFOLIO_ITEMS || "50");

// Helper to shape response
function profileResponse(userDoc, viewerId) {
  const isOwner = viewerId && userDoc._id.equals(viewerId);
  const base = {
    id: userDoc._id,
    role: userDoc.role,
    isOwner,
    basic: {
      displayName: userDoc.displayName || userDoc.name,
      avatarUrl: userDoc.avatarUrl,
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
    if (!mongoose.Types.ObjectId.isValid(profileId)) return res.status(400).json({ message: "Invalid profile id" });

    const user = await User.findById(profileId).select("-password");
    if (!user) return res.status(404).json({ message: "Profile not found" });

    const viewerId = req.user?.id;
    const payload = profileResponse(user, viewerId);

    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /profiles/creative  (only owner, role photographer)
export const updateCreativeProfile = async (req, res) => {
  try {
    // req.body may contain displayName, avatarUrl (we prefer avatar upload), aboutMe, rateCard, categories, tags
    const updates = {};
    const allowed = ["displayName", "aboutMe", "rateCard", "categories", "tags", "businessName", "location", "phone", "socialLinks"];
    allowed.forEach(k => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    // Apply displayName and businessName to top-level fields
    const topLevel = {};
    if (updates.displayName) topLevel.displayName = updates.displayName;
    if (updates.businessName) topLevel.businessName = updates.businessName;

    // creativeDetails fields
    const creativeUpdates = {};
    if (updates.aboutMe) creativeUpdates["creativeDetails.aboutMe"] = updates.aboutMe;
    if (updates.rateCard) creativeUpdates["creativeDetails.rateCard"] = updates.rateCard;
    if (updates.categories) creativeUpdates["creativeDetails.categories"] = updates.categories;
    if (updates.tags) creativeUpdates["creativeDetails.tags"] = updates.tags;

    const setObj = { ...topLevel, ...creativeUpdates };

    const user = await User.findByIdAndUpdate(req.user.id, { $set: setObj }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Profile updated", user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /profiles/client  (owner)
export const updateClientProfile = async (req, res) => {
  try {
    const allowed = ["displayName", "businessName", "location", "phone", "socialLinks"];
    const updates = {};
    allowed.forEach(k => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Profile updated", user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /profiles/creative/portfolio  (multipart form-data, file)
export const uploadPortfolioItem = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File is required" });

    // check role and ownership handled by route middleware (auth(['photographer']))
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // limit number of portfolio items
    const currentCount = user.creativeDetails.portfolio.length;
    const maxItems = parseInt(process.env.MAX_PORTFOLIO_ITEMS || "50");
    if (currentCount >= maxItems) {
      // remove upload from S3 as well (cleanup)
      if (req.file && req.file.key) {
        await s3.deleteObject({ Bucket: S3_BUCKET, Key: req.file.key }).promise();
      }
      return res.status(400).json({ message: `Portfolio item limit reached (${maxItems})` });
    }

    // detect type by mimetype
    const mimetype = req.file.mimetype;
    const type = mimetype.startsWith("image/") ? "image" : "video";

    const entry = {
      type,
      url: req.file.location || `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${req.file.key}`,
      key: req.file.key,
      title: req.body.title || "",
      description: req.body.description || "",
      uploadedAt: new Date()
    };

    user.creativeDetails.portfolio.unshift(entry);
    user.creativeDetails.galleryCount = user.creativeDetails.portfolio.length;
    await user.save();

    res.status(201).json({ message: "Portfolio uploaded", item: entry });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /profiles/creative/portfolio/:itemId
export const deletePortfolioItem = async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const idx = user.creativeDetails.portfolio.findIndex(p => p._id.toString() === itemId);
    if (idx === -1) return res.status(404).json({ message: "Portfolio item not found" });

    const [removed] = user.creativeDetails.portfolio.splice(idx, 1);
    user.creativeDetails.galleryCount = user.creativeDetails.portfolio.length;
    await user.save();

    // remove from S3 if key exists
    if (removed.key) {
      await s3.deleteObject({ Bucket: S3_BUCKET, Key: removed.key }).promise();
    }

    res.json({ message: "Portfolio item deleted", item: removed });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /profiles/avatar  (multipart form-data)
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Avatar file is required" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // remove old avatar from S3 if it exists
    if (user.avatarKey) {
      try {
        await s3.deleteObject({ Bucket: S3_BUCKET, Key: user.avatarKey }).promise();
      } catch (e) {
        // log and continue
        console.warn("Failed removing old avatar from S3", e.message);
      }
    }

    user.avatarUrl = req.file.location || `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${req.file.key}`;
    user.avatarKey = req.file.key;
    await user.save();

    res.status(201).json({ message: "Avatar uploaded", avatarUrl: user.avatarUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

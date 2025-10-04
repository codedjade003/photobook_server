import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import passport from "./config/passport.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";

connectDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

app.get("/", (req, res) => res.send("Photobook API running ✅"));
app.use("/api/auth", authRoutes);

app.use("/api", profileRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));

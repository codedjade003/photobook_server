import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendEmail } from "../utils/mailer.js";
import crypto from "crypto";


const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
};

// 📍 Signup
export const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    // generate 6 digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      provider: "local",
      emailVerified: false,
      verificationCode
    });

    // send code to email
    await sendEmail(email, "Verify your email", `Your verification code is: ${verificationCode}`);

    res.json({ message: "Signup successful. Please verify your email." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📍 Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    res.json({ token: generateToken(user), user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📍 Verify Email + Auto Login
export const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.emailVerified) return res.status(400).json({ message: "Email already verified" });

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: "Invalid code" });
    }

    user.emailVerified = true;
    user.verificationCode = undefined;
    await user.save();

    // 🔑 auto login
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ message: "Email verified successfully", token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📍 Request Password Reset
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email, provider: "local" });
    if (!user) return res.status(404).json({ message: "User not found" });

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save();

    await sendEmail(email, "Password Reset", `Your reset code is: ${resetCode}`);

    res.json({ message: "Reset code sent to your email" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📍 Reset Password + Auto Login
export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const user = await User.findOne({ email, provider: "local" });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.resetPasswordCode || user.resetPasswordCode !== code) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }
    if (user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ message: "Code expired" });
    }

    // update password
    user.password = await bcrypt.hash(newPassword, 10);

    // clear reset data
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // 🔑 auto login
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ message: "Password reset successful", token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// 📍 Social Logins
export const socialLogin = (req, res) => {
  if (!req.user) return res.status(400).json({ message: "Authentication failed" });
  res.json({ token: generateToken(req.user), user: req.user });
};

// 📍 Apple (stub)
export const appleLogin = (req, res) => {
  return res.status(501).json({ message: "Apple login not implemented yet" });
};

// 📍 Get current user
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📍 Update user role
export const updateRole = async (req, res) => {
  try {
    const { role } = req.body;

    // role validation (optional, but safer)
    if (!["client", "photographer"].includes(role)) {
      return res.status(400).json({ message: "Invalid role provided" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id, 
      { role },
      { new: true } // return updated doc
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Role updated successfully", user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📍Update user profile (PUT, blacklist only for this route)
export const updateProfile = async (req, res) => {
  try {
    const updates = { ...req.body };

    // Fields that shouldn't be changed from here
    const blacklisted = ["_id", "password", "provider", "providerId"];
    blacklisted.forEach((field) => delete updates[field]);

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Profile updated successfully", user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📍 Resend Verification Code
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email, provider: "local" });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.emailVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    // generate a new 6-digit code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = verificationCode;
    await user.save();

    // send code to email
    await sendEmail(user.email, "Verify your email", `Your new verification code is: ${verificationCode}`);

    res.json({ message: "Verification code resent successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

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

    user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      provider: "local",
    });

    res.json({ token: generateToken(user), user });
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

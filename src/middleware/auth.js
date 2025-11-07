// src/middleware/auth.js
import jwt from "jsonwebtoken";

const auth = (roles = [], { optional = false } = {}) => {
  return (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];

    if (!token) {
      if (optional) return next(); // 👈 allow requests without token
      return res.status(401).json({ message: "No token, unauthorized" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      next();
    } catch (err) {
      if (optional) return next(); // 👈 invalid token? still allow public access
      return res.status(401).json({ message: "Token invalid" });
    }
  };
};

export default auth;

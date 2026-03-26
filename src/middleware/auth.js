import jwt from "jsonwebtoken";
import { findUserById } from "../repositories/user.repo.js";
import { isTruthyEnv } from "../utils/env.js";

const auth = (roles = [], { optional = false } = {}) => {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
      if (optional) return next();
      return res.status(401).json({ message: "No token" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await findUserById(decoded.id);
      if (!user) {
        return res.status(401).json({ message: "Invalid token" });
      }
      if (isTruthyEnv(process.env.EMAIL_FEATURE_ENABLED) && !user.email_verified) {
        return res.status(403).json({ message: "Email not verified" });
      }

      req.user = {
        id: user.id,
        role: user.role,
        tokenRole: decoded.role
      };

      if (roles.length && !roles.includes(user.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      return next();
    } catch (err) {
      if (optional) return next();
      return res.status(401).json({ message: "Invalid token" });
    }
  };
};

export default auth;

import jwt from "jsonwebtoken";

const auth = (roles = [], { optional = false } = {}) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
      if (optional) return next();
      return res.status(401).json({ message: "No token" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      if (roles.length && !roles.includes(decoded.role)) {
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

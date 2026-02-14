import { Router } from "express";
import authRoutes from "./auth.routes.js";
import profilesRoutes from "./profiles.routes.js";
import portfolioRoutes from "./portfolio.routes.js";
import sessionsRoutes from "./sessions.routes.js";
import rateCardRoutes from "./rate-card.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/profiles", profilesRoutes);
router.use("/portfolio", portfolioRoutes);
router.use("/sessions", sessionsRoutes);
router.use("/rate-card", rateCardRoutes);

export default router;

import { Router } from "express";
import { nukeDatabaseController } from "../controllers/dev.controller.js";

const router = Router();

// Intentionally undocumented in Swagger.
router.delete("/nuke", nukeDatabaseController);

export default router;

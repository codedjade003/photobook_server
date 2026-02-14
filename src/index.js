import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import { NODE_ENV } from "./config/env.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running in ${NODE_ENV} on port ${PORT}`);
});

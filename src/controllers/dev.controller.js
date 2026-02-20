import { wipeDatabaseData } from "../repositories/dev.repo.js";
import { assertDevOverridePassword } from "../utils/devAccess.js";
import { handleRequest } from "../utils/http.js";

export const nukeDatabaseController = (req, res) => {
  return handleRequest(res, async () => {
    await assertDevOverridePassword(req);
    const result = await wipeDatabaseData();
    res.json({
      message: "Database wiped",
      truncatedTables: result.truncatedTables,
      tables: result.tables
    });
  });
};

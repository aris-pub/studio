import { test } from "../fixtures.js";

// @auth @auth-interface
import { AuthHelpers } from "../utils/auth-helpers.js";
import { FileHelpers } from "../utils/file-helpers.js";

test.describe("Home View File Interactions @auth @desktop-only", () => {
  let authHelpers, fileHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    fileHelpers = new FileHelpers(page);

    await authHelpers.ensureLoggedIn();
    await fileHelpers.waitForFilesLoaded();
  });
});

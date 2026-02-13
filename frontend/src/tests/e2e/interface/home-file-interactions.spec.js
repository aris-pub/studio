import { test } from "@playwright/test";

// @auth @auth-interface
import { AuthHelpers } from "../utils/auth-helpers.js";
import { FileHelpers } from "../utils/file-helpers.js";
import { TEST_CREDENTIALS } from "../setup/test-data.js";

test.describe("Home View File Interactions @auth @desktop-only", () => {
  let authHelpers, fileHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    fileHelpers = new FileHelpers(page);

    await authHelpers.ensureLoggedIn();
    await fileHelpers.waitForFilesLoaded();
  });
});

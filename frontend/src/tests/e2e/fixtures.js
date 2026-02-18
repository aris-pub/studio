/**
 * E2E Test Fixtures
 *
 * Re-exports Playwright test utilities for consistent imports.
 */

import { test as base, expect, devices } from "@playwright/test";

export const test = base;
export { expect, devices };

import dotenv from "dotenv";
import path from "path";

// Load environment variables from frontend .env and root .env
dotenv.config({ path: path.resolve("../.env") });
dotenv.config({ path: path.resolve(".env") });

// Test user credentials for e2e tests
export const TEST_USERS = {
  VALID_USER: {
    email: process.env.TEST_USER_EMAIL || "testuser@aris.pub",
    password: process.env.TEST_USER_PASSWORD || "testpassword123",
    name: "Test User",
  },

  INVALID_USER: {
    email: "invalid@example.com",
    password: "wrongpassword",
  },
};

export const TEST_CREDENTIALS = {
  valid: TEST_USERS.VALID_USER,
  invalid: TEST_USERS.INVALID_USER,
};

// Log test credentials being used (but mask password)
console.log("[TestData] Test credentials configuration:", {
  email: TEST_CREDENTIALS.valid.email,
  password: "***",
  passwordLength: TEST_CREDENTIALS.valid.password.length,
  fromEnv: {
    email: !!process.env.TEST_USER_EMAIL,
    password: !!process.env.TEST_USER_PASSWORD,
  },
});

// File fixtures for testing
export const TEST_FILES = {
  SAMPLE_RSM: {
    title: "Sample Document",
    source: `# Sample Document

This is a sample RSM document for testing.

## Introduction

Welcome to *Aris*, the web-native scientific publishing platform.`,
  },

  MINIMAL_RSM: {
    title: "Minimal Test File",
    source: `# Test File

Simple content for testing.`,
  },
};

// Generate unique test data helpers
export const generateTestFile = (suffix = "") => ({
  title: `Test File ${Date.now()}${suffix}`,
  source: `# Test File ${Date.now()}${suffix}

This is a test file created at ${new Date().toISOString()}.`,
});

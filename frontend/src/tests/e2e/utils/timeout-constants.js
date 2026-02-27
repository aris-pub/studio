/**
 * Centralized timeout constants for E2E tests
 *
 * These constants provide consistent timeout values across all test files
 * and replace the scattered timeout values throughout the codebase.
 */

export const TIMEOUTS = {
  // Core timeout categories
  QUICK_ACTION: 1500, // Button clicks, form inputs, simple interactions
  CONTENT_LOAD: 5000, // Component mounting, content rendering, API responses
  HEAVY_OPERATION: 10000, // File operations, complex navigation, heavy computations

  // Specific operation timeouts
  NAVIGATION: 3000, // Page navigation and URL changes
  ELEMENT_RENDER: 1500, // Element visibility and DOM updates
  API_RESPONSE: 3000, // Backend API calls and data loading
  ANIMATION: 500, // CSS animations and transitions

  // Environment-specific multipliers
  MOBILE_MULTIPLIER: 1.5, // Apply to base timeouts for mobile browsers
  CI_MULTIPLIER: 3.0, // Apply to base timeouts for CI environments (PostgreSQL + container + browser latency)

  // Legacy timeouts (to be phased out)
  LEGACY_SHORT: 3000,
  LEGACY_MEDIUM: 5000,
  LEGACY_LONG: 10000,
};

/**
 * Get timeout values optimized for the current browser/device and environment
 * @param {boolean} isMobile - Whether running on mobile browser
 * @param {boolean} isCI - Whether running in CI environment (auto-detected if not specified)
 * @returns {Object} Timeout configuration object
 */
export function getTimeouts(isMobile = false, isCI = process.env.CI) {
  let multiplier = 1;

  // Apply mobile multiplier
  if (isMobile) {
    multiplier *= TIMEOUTS.MOBILE_MULTIPLIER;
  }

  // Apply CI multiplier for PostgreSQL + container environment
  if (isCI) {
    multiplier *= TIMEOUTS.CI_MULTIPLIER;
  }

  return {
    quickAction: Math.round(TIMEOUTS.QUICK_ACTION * multiplier),
    contentLoad: Math.round(TIMEOUTS.CONTENT_LOAD * multiplier),
    heavyOperation: Math.round(TIMEOUTS.HEAVY_OPERATION * multiplier),
    navigation: Math.round(TIMEOUTS.NAVIGATION * multiplier),
    elementRender: Math.round(TIMEOUTS.ELEMENT_RENDER * multiplier),
    apiResponse: Math.round(TIMEOUTS.API_RESPONSE * multiplier),
    animation: TIMEOUTS.ANIMATION, // Don't scale animations
  };
}

/**
 * Get timeout for specific operations
 * @param {string} operation - Operation type
 * @param {boolean} isMobile - Whether running on mobile browser
 * @param {boolean} isCI - Whether running in CI environment (auto-detected if not specified)
 * @returns {number} Timeout in milliseconds
 */
export function getTimeoutFor(operation, isMobile = false, isCI = process.env.CI) {
  const timeouts = getTimeouts(isMobile, isCI);

  const operationMap = {
    click: timeouts.quickAction,
    input: timeouts.quickAction,
    visibility: timeouts.elementRender,
    navigation: timeouts.navigation,
    api: timeouts.apiResponse,
    content: timeouts.contentLoad,
    heavy: timeouts.heavyOperation,
    animation: timeouts.animation,
  };

  return operationMap[operation] || timeouts.contentLoad;
}

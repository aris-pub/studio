/**
 * Frontend logging utility for RSM Studio.
 *
 * Provides structured logging with environment-aware configuration.
 * Designed to match backend logging patterns and support debugging.
 */

/**
 * Log levels in order of severity
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * Get current log level based on environment
 */
function getCurrentLogLevel() {
  // Check for explicit log level override
  const explicitLogLevel = import.meta.env.VITE_LOG_LEVEL;
  if (explicitLogLevel && LOG_LEVELS[explicitLogLevel] !== undefined) {
    return LOG_LEVELS[explicitLogLevel];
  }

  const env = import.meta.env.VITE_ENV || import.meta.env.MODE;
  const nodeEnv = typeof process !== "undefined" ? process.env.NODE_ENV : "";

  // Check for test environment (including Playwright E2E tests)
  const isTest =
    env === "test" ||
    nodeEnv === "test" ||
    (typeof window !== "undefined" && window.__vitest__) ||
    (typeof global !== "undefined" && global.__vitest__) ||
    (typeof window !== "undefined" && window.playwright) ||
    (typeof navigator !== "undefined" &&
      navigator.userAgent &&
      navigator.userAgent.includes("Playwright"));

  const isDev = env === "development" || env === "DEV";

  // Use WARN level in test environment to reduce noise, DEBUG in development, INFO in production
  if (isTest) {
    return LOG_LEVELS.WARN;
  }
  return isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
}

/**
 * Format timestamp for consistent logging
 */
function formatTimestamp() {
  const now = new Date();
  return now.toISOString().replace("T", " ").substring(0, 19);
}

/**
 * Format log message with structured information
 */
function formatLogMessage(level, module, message, data = null) {
  const timestamp = formatTimestamp();
  const levelName = Object.keys(LOG_LEVELS)[level].padEnd(5);

  let formatted = `${timestamp} | ${levelName} | ${module} | ${message}`;

  if (data !== null && data !== undefined) {
    if (typeof data === "object") {
      formatted += ` | ${JSON.stringify(data)}`;
    } else {
      formatted += ` | ${data}`;
    }
  }

  return formatted;
}

/**
 * Logger class that provides structured logging methods
 */
class Logger {
  constructor(module) {
    this.module = module;
    this.currentLogLevel = getCurrentLogLevel();
  }

  /**
   * Override log level for testing purposes
   */
  setLogLevel(level) {
    this.currentLogLevel = level;
  }

  /**
   * Log a message if the level meets the current threshold
   */
  _log(level, message, data = null, consoleMethod = "log") {
    if (level < this.currentLogLevel) {
      return;
    }

    const formatted = formatLogMessage(level, this.module, message, data);
    console[consoleMethod](formatted);
  }

  /**
   * Debug level logging - verbose information for development
   */
  debug(message, data = null) {
    this._log(LOG_LEVELS.DEBUG, message, data, "debug");
  }

  /**
   * Info level logging - general application flow
   */
  info(message, data = null) {
    this._log(LOG_LEVELS.INFO, message, data, "info");
  }

  /**
   * Warning level logging - potentially problematic situations
   */
  warn(message, data = null) {
    this._log(LOG_LEVELS.WARN, message, data, "warn");
  }

  /**
   * Error level logging - error conditions that should be investigated
   */
  error(message, data = null) {
    this._log(LOG_LEVELS.ERROR, message, data, "error");
  }

  /**
   * Special method for API errors with structured data
   */
  apiError(endpoint, error, requestData = null) {
    const errorData = {
      endpoint,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      requestData,
    };

    this.error("API request failed", errorData);
  }

  /**
   * Special method for user actions tracking
   */
  userAction(action, details = null) {
    this.info(`User action: ${action}`, details);
  }

  /**
   * Special method for performance tracking
   */
  performance(operation, duration, details = null) {
    this.debug(`Performance: ${operation} took ${duration}ms`, details);
  }
}

/**
 * Create a logger instance for a specific module
 *
 * @param {string} module - Module name, typically the component/file name
 * @returns {Logger} Configured logger instance
 */
export function getLogger(module) {
  return new Logger(module);
}

/**
 * Global logger for general app-wide logging
 */
export const appLogger = getLogger("app");

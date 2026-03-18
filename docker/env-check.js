#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * 
 * This script validates that ALL required environment variables are set
 * before allowing any service to start. There are NO fallbacks - if any
 * required variable is missing, the process exits with an error.
 * 
 * Usage: node docker/env-check.js
 */

const fs = require('fs');
const path = require('path');

// Required environment variables - NO fallbacks allowed
const REQUIRED_ENV_VARS = [
  'BACKEND_PORT',
  'FRONTEND_PORT', 
  'SITE_PORT',
  'STORYBOOK_PORT',
  'DB_PORT',
  'DB_NAME',
  'TEST_DB_NAME',
  'VITE_API_BASE_URL',
  'NUXT_BACKEND_URL'
];

function detectEnvironment() {
  const env = process.env.ENV || process.env.NODE_ENV || 'development';
  return ['CI', 'STAGING', 'PROD'].includes(env.toUpperCase());
}

function loadEnvFile() {
  const envPath = path.resolve(__dirname, '../.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ FATAL: .env file not found at project root');
    console.error('   Expected location:', envPath);
    console.error('   Copy .env.example to .env and configure all required variables');
    process.exit(1);
  }

  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Parse .env file manually to avoid dependencies
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const k = key.trim();
          // Don't overwrite variables already set in the environment
          // (e.g. entrypoint.sh exports SITE_PORT=3000 for container use)
          if (!(k in process.env)) {
            process.env[k] = valueParts.join('=').trim();
          }
        }
      }
    });
  } catch (error) {
    console.error('❌ FATAL: Failed to read .env file');
    console.error('   Error:', error.message);
    process.exit(1);
  }
}

function loadEnvironment() {
  const isProductionLike = detectEnvironment();
  const envName = process.env.ENV || process.env.NODE_ENV || 'development';
  const envPath = path.resolve(__dirname, '../.env');
  const envFileExists = fs.existsSync(envPath);

  // Always load .env if it exists (Docker-based CI uses .env like local dev)
  // Only use system-env-only mode if .env doesn't exist AND we're in production-like env
  if (envFileExists) {
    console.log(`🔄 ${envName.toUpperCase()} environment detected - loading .env file`);
    loadEnvFile();
  } else if (isProductionLike) {
    console.log(`🔄 ${envName.toUpperCase()} environment detected - using system environment variables (.env not found)`);
    // Use existing process.env, no .env file loading
  } else {
    // Development without .env file - will fail validation
    console.log('🔄 Development environment detected - .env file not found');
  }
}

function validateEnvironment() {
  console.log('🔍 Validating environment variables...');
  
  const missing = [];
  const present = [];
  
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar];
    if (!value || value.trim() === '') {
      missing.push(envVar);
    } else {
      present.push({ name: envVar, value: value.trim() });
    }
  }
  
  if (missing.length > 0) {
    const isProductionLike = detectEnvironment();
    const envName = process.env.ENV || process.env.NODE_ENV || 'development';
    
    console.error('❌ FATAL: Missing required environment variables:');
    missing.forEach(envVar => {
      console.error(`   ${envVar}`);
    });
    console.error('');
    
    if (isProductionLike) {
      console.error(`   Set these environment variables in your ${envName.toUpperCase()} deployment configuration`);
      console.error('   (GitHub Actions, Docker, Kubernetes, etc.)');
    } else {
      console.error('   Set these variables in your .env file at the project root');
      console.error('   Use .env.example as a template');
    }
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set:');
  present.forEach(({ name, value }) => {
    // Don't show sensitive values, just confirm they're set
    const displayValue = name.includes('PASSWORD') || name.includes('SECRET') 
      ? '*'.repeat(value.length) 
      : value;
    console.log(`   ${name}=${displayValue}`);
  });
  console.log('');
}

function main() {
  if (process.env.NETLIFY === 'true') {
    console.log('🔄 Netlify build detected — skipping env validation (backend vars not needed for static site)');
    return;
  }

  try {
    loadEnvironment();
    validateEnvironment();
    console.log('🚀 Environment validation passed - proceeding with startup');
  } catch (error) {
    console.error('❌ FATAL: Environment validation failed');
    console.error('   Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { detectEnvironment, loadEnvFile, loadEnvironment, validateEnvironment };
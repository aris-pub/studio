# RSM Studio Landing Page

Landing page for RSM Studio scientific publishing platform, built with Nuxt 3 and Vue 3.

## Features

- **RSM Interactive Demo**: Live editable demo with real-time rendering from backend API
- **Dark Mode Support**: System preference detection with manual toggle
- **Responsive Design**: Mobile-first design with hamburger navigation
- **Security Headers**: Production-ready HTTPS and content security configuration
- **Early Access Signup**: Backend-integrated signup form with validation

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (port configured via SITE_PORT environment variable)
npm run dev

# Run tests
npm test                # Unit tests
npm run test:e2e        # E2E tests

# Lint and build
npm run lint
npm run build
```

## Architecture

### Pages
- `pages/index.vue` - Main landing page with RSM demo
- `error.vue` - Custom 404 error page with dark mode support
- `pages/contact.vue` - Contact information page
- `pages/terms.vue` - Terms of service page  
- `pages/privacy.vue` - Privacy policy page
- `pages/legal.vue` - Legal/Impressum page

### Components
- `SignupForm.vue` - Early access signup with authoring tools selection
- `DarkModeToggle.vue` - Theme switcher with accessibility features
- `MobileMenu.vue` - Responsive navigation overlay

### Composables
- `useDarkMode.js` - Dark mode state management with persistence

## Testing

### Test Structure
The E2E test suite is optimized for MVP launch with minimal but comprehensive coverage:

```bash
# Run specific test categories
npx playwright test --grep "@core"     # Core functionality tests (19 tests)

# Test files:
tests/e2e/
├── security.spec.js      # HTTPS redirect, security headers, 404 page (5 tests)
├── signup-form.spec.js   # Form validation and submission (10 tests)  
└── rsm-section.spec.js   # RSM demo interaction (4 tests)
```

### Test Categories
- **`@core`**: Critical MVP functionality that must work for launch
- Tests use `data-testid` attributes for stable element selection
- API responses are mocked for reliable, fast test execution

## Configuration

### Environment Variables
Required environment variables (defined in parent `.env`):
- `SITE_PORT` - Development server port
- `VITE_API_BASE_URL` - Backend API endpoint for RSM rendering

### Security Configuration
Production security headers configured in `nuxt.config.ts`:
- `Strict-Transport-Security`: HTTPS enforcement
- `X-Frame-Options`: Clickjacking protection  
- `X-Content-Type-Options`: MIME type security

## Development

### RSM Demo Integration
The landing page includes a live RSM demo that:
- Connects to the backend rendering API
- Provides real-time editing with 150ms debounce
- Includes fallback to static examples if API fails
- Features academic and interactive content examples

### Dark Mode
Persistent dark mode implementation:
- Detects system preference on first visit
- Stores user preference in localStorage
- Applies theme consistently across all pages
- SSR-safe with hydration guards

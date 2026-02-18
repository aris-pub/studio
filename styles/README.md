# Styles

This directory contains **Studio-specific** CSS files shared across Studio applications (frontend, Storybook, site).

**Note**: For organization-wide brand assets (logos, guidelines), see the `brand/` submodule - that is the single source of truth for global branding.

## Structure

```
styles/
├── css/
│   ├── typography.css     # Font styles, heading styles, text utilities
│   ├── layout.css         # Base HTML/body layout and box-sizing reset
│   └── components.css     # Shared component styles (scrollbars, icons, buttons)
└── README.md
```

## Backend Serving

The FastAPI backend mounts this directory at `/styles/`:
- **Endpoint**: `http://localhost:8000/styles/css/typography.css`
- **Implementation**: StaticFiles middleware in `backend/main.py`
- **Cache headers**: `Cache-Control: no-store` for immediate updates
- **Path resolution**: Handles multiple run contexts (from backend/ or project root)

## Application Usage

All Studio applications load CSS from the backend endpoint (no local duplication):

### Frontend (`frontend/src/App.vue`)
```javascript
const styles = ["typography.css", "components.css", "layout.css"];
styles.forEach((filename) => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `${api.defaults.baseURL}/styles/css/${filename}`;
  document.head.appendChild(link);
});
```

### Storybook (`frontend/.storybook/preview.js`)
```javascript
const API_BASE_URL = "http://localhost:8002";
const styles = ["typography.css", "layout.css", "components.css"];
styles.forEach((filename) => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `${API_BASE_URL}/styles/css/${filename}`;
  document.head.appendChild(link);
});
```

### Site (`site/nuxt.config.ts`)
```typescript
link: [
  { rel: 'stylesheet', href: `${process.env.NUXT_BACKEND_URL}/styles/css/typography.css` },
  { rel: 'stylesheet', href: `${process.env.NUXT_BACKEND_URL}/styles/css/layout.css` },
  { rel: 'stylesheet', href: `${process.env.NUXT_BACKEND_URL}/styles/css/components.css` },
]
```

## Design Principles

- **Single source of truth**: This directory is the canonical source for Studio-specific CSS
- **No duplication**: Applications load from backend, not bundled copies
- **Runtime loading**: CSS loaded dynamically allows updates without rebuilding apps
- **No caching**: `no-store` headers ensure design changes propagate immediately
- **Studio-scoped**: These assets are NOT global - use `brand/` submodule for organization-wide assets

## Adding New CSS Files

1. Add CSS file to `styles/css/`
2. Update all three applications to load the new file:
   - `frontend/src/App.vue` - Add to `styles` array
   - `frontend/.storybook/preview.js` - Add to `styles` array
   - `site/nuxt.config.ts` - Add to `link` array in head config
3. Test that backend serves at `/styles/css/<filename>`
4. Verify all apps load correctly with backend running
5. Update this README
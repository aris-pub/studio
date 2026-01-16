# Design Assets

This directory contains shared design assets used across all Aris applications.

## Structure

```
design-assets/
├── css/
│   ├── typography.css     # Font styles and text formatting
│   ├── colors.css         # Color variables and theme definitions  
│   └── variables.css      # Common CSS custom properties
├── logos/
│   ├── logo-32px.svg      # 32px logo for UI elements
│   ├── logo-32px-gray.svg # Grayscale version of 32px logo
│   └── logotype.svg       # Full logotype for headers/branding
└── README.md
```

## Usage

### Backend Serving
The backend serves these assets via symlink at `/static/design/`:
- CSS files: `http://localhost:8000/static/design/css/typography.css`
- Logos: `http://localhost:8000/static/design/logos/logo-32px.svg`

### Frontend Usage
Load CSS files dynamically at runtime:
```javascript
const baseUrl = api.getUri();
const cssUrl = `${baseUrl}/static/design/css/typography.css`;
```

### Site Usage  
Reference assets from backend endpoint:
```html
<link rel="stylesheet" href="/api/static/design/css/typography.css">
```

## Development Notes

- **Source of truth**: This directory contains the canonical versions of all shared assets
- **Not packaged**: These files are not included in application builds
- **Backend symlink**: Backend uses symlink to serve these files without duplication
- **Runtime loading**: Applications load assets dynamically when backend is available
- **Cross-platform**: Symlinks work on most systems; fallback copying available if needed

## Adding New Assets

1. Add files to appropriate subdirectory (`css/` or `logos/`)
2. Test that backend serves files correctly at `/static/design/...`
3. Update applications to reference new assets
4. Update this README with new asset documentation
# Debug Folder

This folder contains tools and scripts for debugging issues in the RSM Studio frontend application.

## Contents

### `debug-bug-template.js`
Puppeteer template script for replicating user interaction bugs.

**When to use:** When a bug report requires user interaction to reproduce (clicking, typing, navigating, etc.)

**How to use:**
1. Copy the template: `cp debug-bug-template.js debug-my-bug.js`
2. Modify the "CUSTOMIZE THIS SECTION" with specific reproduction steps
3. Ensure the dev server is running: `npm run dev`
4. Run the script: `node debug-my-bug.js`
5. Review console output and generated `debug-step-*.png` screenshots

**Features:**
- Always runs in headless mode (per CLAUDE.md requirements)
- Takes screenshots at each step for visual debugging
- Logs page console output and errors
- Uses data-testid selectors for reliable element interaction
- Includes helper functions for common actions (login, navigation)

## Important Notes

- All files in this folder are git-ignored EXCEPT this README and script templates
- Scripts generate screenshot files (`debug-*.png`) which are also git-ignored
- Always run scripts from the frontend directory: `node debug/script-name.js`
- The dev server must be running on `http://localhost:5173` for scripts to work

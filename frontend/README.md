# RSM Studio Frontend

Vue 3 frontend for the RSM Studio scientific publishing platform. Researchers write, read, and review RSM manuscripts as responsive, interactive web documents with real-time collaboration.

## Stack

- **Vue 3** + Composition API
- **Vite** — dev server and bundler
- **CodeMirror 6** — source editor
- **Y.js** + `y-codemirror.next` — real-time collaboration
- **Vue Router**, **Pinia**, **@vueuse/core**
- **Axios** — API requests

## Quick Start

```bash
npm install
npm run dev        # dev server
npm run storybook  # component library
npm test           # unit tests
npm run test:e2e   # E2E tests (requires services running)
npm run lint
```

## Config

Copy `.env.example` to `.env`. Required variables are documented there.

## Deployment

Hosted on Netlify, configured to rebuild on every push to `main`.

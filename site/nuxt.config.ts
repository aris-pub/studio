// nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      title: 'RSM Studio – Author scholarly work designed for pixels, not paper',
      meta: [
        { name: 'description', content: 'RSM Studio: Describe your ideas and structure. Get stunning web documents without the formatting fight. Coming 2025 Q4.' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { charset: 'utf-8' },
        // Open Graph tags for social sharing
        { property: 'og:title', content: 'RSM Studio – Author scholarly work designed for pixels, not paper' },
        { property: 'og:description', content: 'RSM Studio: Describe your ideas and structure. Get stunning web documents without the formatting fight. Coming 2025 Q4.' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://studio.aris.pub' },
        { property: 'og:site_name', content: 'RSM Studio' },
        // Twitter Card tags
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: 'RSM Studio – Author scholarly work designed for pixels, not paper' },
        { name: 'twitter:description', content: 'RSM Studio: Describe your ideas and structure. Get stunning web documents without the formatting fight. Coming 2025 Q4.' },
        // Additional SEO meta tags
        { name: 'robots', content: 'index, follow' },
        { name: 'author', content: 'The Aris Program' },
        { name: 'keywords', content: 'RSM Studio, scholarly authoring, academic writing, web-native publishing, interactive documents, research markup, scientific writing' },
      ],
      link: [
        // Preconnect to Google Fonts for performance
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Source+Sans+3:wght@400;600;700&display=swap', rel: 'stylesheet' },
        // Styles from backend
        { rel: 'stylesheet', href: `${process.env.NUXT_BACKEND_URL}/styles/css/variables.css` },
        { rel: 'stylesheet', href: `${process.env.NUXT_BACKEND_URL}/styles/css/typography.css` },
        { rel: 'stylesheet', href: `${process.env.NUXT_BACKEND_URL}/styles/css/layout.css` },
        { rel: 'stylesheet', href: `${process.env.NUXT_BACKEND_URL}/styles/css/components.css` },
        // Canonical URL
        { rel: 'canonical', href: 'https://aris.pub' },
        // Favicon
        { rel: 'icon', type: 'image/svg+xml', href: '/studio-brand/favicon.svg' },
      ]
    },
  },

  css: [
    './assets/css/rsm-design-system.css',
    './assets/css/rsm.css',
    './assets/main.css',
    './assets/components.css'
  ],
  router: {
    options: {
      scrollBehaviorType: 'smooth'
    }
  },

  // Enable image optimization
  image: {
    formats: ['webp', 'avif'],
    quality: 85,
  },

  // Performance optimizations
  experimental: {
    payloadExtraction: false, // Improve initial load time
    
    // Fix for "Failed to fetch dynamically imported module" errors
    // This resolves browser back navigation failures in development and E2E tests
    // When a dynamically imported chunk fails to load (common during dev server restarts
    // or browser back navigation), Nuxt will automatically reload the page instead of 
    // showing a broken state. This fixes timeouts in Firefox E2E tests where pages
    // never load due to failed chunk imports.
    // See: https://github.com/nuxt/nuxt/issues/26565
    emitRouteChunkError: 'reload',
  },

  modules: ['@nuxt/image'],

  // Development server configuration
  devServer: {
    port: parseInt(process.env.SITE_PORT || '3000'),
    host: '0.0.0.0'
  },

  // Compression configuration
  nitro: {
    compressPublicAssets: false, // Disable compression for now
    routeRules: {
      '/**': {
        headers: {
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    }
  },

  // Runtime config for frontend URL
  runtimeConfig: {
    public: {
      frontendUrl: process.env.FRONTEND_URL,
      backendUrl: process.env.NUXT_BACKEND_URL
    }
  },

  // Disable DevTools in test environment
  devtools: { enabled: process.env.NODE_ENV !== 'test' },
})

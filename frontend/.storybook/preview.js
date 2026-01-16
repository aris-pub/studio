import "../src/assets/main.css";
import { setup } from "@storybook/vue3";
import Icon from "../src/components/base/Icon.vue";

// Register real Icon component globally
setup((app) => {
  // eslint-disable-next-line vue/multi-word-component-names
  app.component("Icon", Icon);
});

// Load RSM CSS (contains all design system variables)
const API_BASE_URL = "http://localhost:8002"; // Use host-accessible backend URL
const rsmLink = document.createElement("link");
rsmLink.rel = "stylesheet";
rsmLink.href = `${API_BASE_URL}/static/rsm.css`;
document.head.appendChild(rsmLink);

// Load styles CSS from backend (accessible from browser)
const styles = ["variables.css", "typography.css", "layout.css", "components.css"];
styles.forEach((filename) => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `${API_BASE_URL}/styles/css/${filename}`;
  document.head.appendChild(link);
});

/** @type { import('@storybook/vue3').Preview } */
const preview = {
  parameters: {
    actions: {
      argTypesRegex: "^on[A-Z].*",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Accessibility addon configuration
    a11y: {
      config: {
        rules: [
          {
            id: "color-contrast",
            enabled: true,
          },
          {
            id: "focus-visible",
            enabled: true,
          },
        ],
      },
    },
    // Viewport addon configuration
    viewport: {
      viewports: {
        mobile: {
          name: "Mobile",
          styles: {
            width: "375px",
            height: "667px",
          },
        },
        tablet: {
          name: "Tablet",
          styles: {
            width: "768px",
            height: "1024px",
          },
        },
        desktop: {
          name: "Desktop",
          styles: {
            width: "1024px",
            height: "768px",
          },
        },
        wide: {
          name: "Wide Desktop",
          styles: {
            width: "1440px",
            height: "900px",
          },
        },
      },
      defaultViewport: "desktop",
    },
  },
};

export default preview;

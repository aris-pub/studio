/**
 * Utility to dynamically load CSS files from the backend styles
 */

const loadedStylesheets = new Set();

export function loadCSS(api, filename) {
  const url = `${api.defaults.baseURL}/styles/css/${filename}`;

  console.log(`[cssLoader] Loading CSS from: ${url}`);

  // Avoid loading the same CSS file multiple times
  if (loadedStylesheets.has(url)) {
    console.log(`[cssLoader] ${filename} already loaded, skipping`);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;

    link.onload = () => {
      console.log(`[cssLoader] ✓ ${filename} loaded successfully`);
      loadedStylesheets.add(url);
      resolve();
    };

    link.onerror = () => {
      console.error(`[cssLoader] ✗ Failed to load ${filename} from ${url}`);
      reject(new Error(`Failed to load CSS: ${url}`));
    };

    console.log(`[cssLoader] Appending <link> to document.head for ${filename}`);
    document.head.appendChild(link);
    console.log(`[cssLoader] Link element appended, waiting for onload event`);
  });
}

export function loadDesignAssets(api) {
  const cssFiles = ["typography.css", "components.css", "layout.css", "variables.css"];

  return Promise.all(cssFiles.map((filename) => loadCSS(api, filename)));
}

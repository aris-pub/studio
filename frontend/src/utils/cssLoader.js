/**
 * Utility to dynamically load CSS files from the backend styles
 */

const loadedStylesheets = new Set();

export function loadCSS(api, filename) {
  const url = `${api.defaults.baseURL}/styles/css/${filename}`;

  // Avoid loading the same CSS file multiple times
  if (loadedStylesheets.has(url)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;

    link.onload = () => {
      loadedStylesheets.add(url);
      resolve();
    };

    link.onerror = () => {
      reject(new Error(`Failed to load CSS: ${url}`));
    };

    document.head.appendChild(link);
  });
}

export function loadDesignAssets(api) {
  const cssFiles = ["typography.css", "components.css", "layout.css", "variables.css"];

  return Promise.all(cssFiles.map((filename) => loadCSS(api, filename)));
}

import { nextTick } from "vue";

/**
 * Composable for managing head content injection and script execution
 * Used for processing structured RSM content with tooltip support
 */
export function useHeadInjection(api = null) {
  // Track loaded resources to prevent duplicates
  const loadedResources = new Set();

  /**
   * Inject head content into document head and wait for scripts to load
   */
  const injectHeadContent = (headContent) => {
    return new Promise((resolve) => {
      if (!headContent || !headContent.trim()) {
        resolve();
        return;
      }

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = headContent;

      // Get API base URL for resolving relative paths
      const apiBaseUrl = api?.defaults?.baseURL;

      // Process stylesheets
      const links = tempDiv.querySelectorAll('link[rel="stylesheet"]');
      links.forEach((link) => {
        let href = link.getAttribute("href");
        if (href && !loadedResources.has(href)) {
          // Convert relative paths to use API base URL
          if (href.startsWith("/static/") && apiBaseUrl) {
            href = apiBaseUrl + href;
          }

          const newLink = document.createElement("link");
          newLink.rel = "stylesheet";
          newLink.href = href;
          document.head.appendChild(newLink);
          loadedResources.add(href);
        }
      });

      // Process external scripts and wait for them to load
      const scripts = tempDiv.querySelectorAll("script[src]");
      const scriptPromises = [];

      scripts.forEach((script) => {
        let src = script.getAttribute("src");
        if (src && !loadedResources.has(src)) {
          // Convert relative paths to use API base URL
          if (src.startsWith("/static/") && apiBaseUrl) {
            src = apiBaseUrl + src;
          }

          const scriptPromise = new Promise((scriptResolve, scriptReject) => {
            const newScript = document.createElement("script");
            newScript.src = src;

            // Copy other attributes
            Array.from(script.attributes).forEach((attr) => {
              if (attr.name !== "src") {
                newScript.setAttribute(attr.name, attr.value);
              }
            });

            // Wait for script to load
            newScript.onload = scriptResolve;
            newScript.onerror = scriptReject;

            document.head.appendChild(newScript);
          });

          scriptPromises.push(scriptPromise);
          loadedResources.add(src);
        }
      });

      // Resolve when all scripts have loaded
      Promise.all(scriptPromises)
        .then(() => {
          console.log("All head scripts loaded successfully");
          resolve();
        })
        .catch((error) => {
          console.error("Error loading head scripts:", error);
          resolve(); // Resolve anyway to not block init script
        });

      // If no scripts to load, resolve immediately
      if (scriptPromises.length === 0) {
        resolve();
      }
    });
  };

  /**
   * Execute initialization script after content is rendered
   */
  const executeInitScript = (initScript) => {
    try {
      console.log("Executing RSM init script");
      // Create a script element and execute it
      const scriptElement = document.createElement("script");
      scriptElement.textContent = initScript;
      document.body.appendChild(scriptElement);
      document.body.removeChild(scriptElement);
    } catch (error) {
      console.error("Error executing init script:", error);
    }
  };

  /**
   * Execute embedded scripts within HTML content
   */
  const executeEmbeddedScripts = (manuscriptRef) => {
    const manuscriptEl = manuscriptRef?.value?.$el;
    if (!manuscriptEl) return;

    // Find all script tags within the manuscript content
    const scripts = manuscriptEl.querySelectorAll("script");
    scripts.forEach((script) => {
      if (script.textContent && script.textContent.trim()) {
        try {
          console.log("Executing embedded script:", script.textContent.substring(0, 50) + "...");
          // Create a new script element and copy the content
          const newScript = document.createElement("script");
          newScript.textContent = script.textContent;

          // Copy attributes
          Array.from(script.attributes).forEach((attr) => {
            newScript.setAttribute(attr.name, attr.value);
          });

          // Replace the old script with the new one to trigger execution
          script.parentNode.insertBefore(newScript, script);
          script.parentNode.removeChild(script);
        } catch (error) {
          console.error("Error executing embedded script:", error);
        }
      }
    });
  };

  /**
   * Process structured content with head injection and script execution
   */
  const processStructuredContent = async (structured, manuscriptRef = null) => {
    if (!structured) return;

    // Inject head content into document head and wait for scripts to load
    if (structured.head) {
      await injectHeadContent(structured.head);
    }

    // Execute initialization script after content is rendered and scripts are loaded
    if (structured.init_script) {
      // Wait a tick for the content to be rendered in the DOM
      await nextTick();
      executeInitScript(structured.init_script);

      // Execute any embedded scripts within the HTML content
      // Wait another tick to ensure init script has run first
      await nextTick();
      if (manuscriptRef) {
        executeEmbeddedScripts(manuscriptRef);
      }
    }
  };

  return {
    injectHeadContent,
    executeInitScript,
    executeEmbeddedScripts,
    processStructuredContent,
  };
}

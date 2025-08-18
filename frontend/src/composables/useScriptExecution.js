/**
 * Composable for executing scripts in dynamically inserted HTML content
 *
 * This is needed because v-html doesn't execute <script> tags for security reasons.
 * For trusted content like our own Plotly figures, we need to manually execute scripts.
 */
import { nextTick } from "vue";

export function useScriptExecution() {
  /**
   * Execute all script tags within a given element
   * @param {Element} element - The DOM element to search for scripts
   */
  const executeScripts = async (element) => {
    if (!element) return;

    await nextTick();

    // Find all script tags in the element
    const scripts = element.querySelectorAll("script");

    for (const script of scripts) {
      try {
        if (script.src) {
          // External script - create new script element
          const newScript = document.createElement("script");
          newScript.src = script.src;
          if (script.async !== undefined) newScript.async = script.async;
          if (script.defer !== undefined) newScript.defer = script.defer;
          document.head.appendChild(newScript);
        } else {
          // Inline script - execute directly
          const scriptContent = script.textContent || script.innerText;
          if (scriptContent.trim()) {
            // Create a new Function to execute in global scope
            new Function(scriptContent)();
          }
        }
      } catch (error) {
        console.warn("Failed to execute script:", error);
      }
    }
  };

  /**
   * Execute scripts after HTML content is updated via v-html
   * @param {Element} element - The element that received the HTML content
   */
  const executeAfterHtmlUpdate = async (element) => {
    await executeScripts(element);
  };

  return {
    executeScripts,
    executeAfterHtmlUpdate,
  };
}

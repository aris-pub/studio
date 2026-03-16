/**
 * Download utility functions for browser file downloads
 */

/**
 * Replaces characters that are unsafe in filenames with hyphens,
 * collapses runs of hyphens, and trims leading/trailing hyphens.
 */
export function sanitizeFilename(name) {
  return name
    .replace(/[/\\:*?"<>|#%]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Triggers a browser download for a Blob object
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename for the download
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

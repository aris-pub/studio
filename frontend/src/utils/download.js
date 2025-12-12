/**
 * Download utility functions for browser file downloads
 */

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

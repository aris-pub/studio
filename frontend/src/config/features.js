/**
 * Frontend feature flags.
 *
 * `annotationsEnabled` gates the collaboration UI deferred for the closed beta:
 * the selection Mark/Note/Comment toolbar, annotation keyboard shortcuts,
 * marginalia cards/overlay, manuscript highlights, minimap annotation/reaction
 * ticks, the "Marginalia" search scope, and home-card annotation/reaction data.
 *
 * It is OFF unless `VITE_FEATURE_ANNOTATIONS` is explicitly the string "true",
 * so any deployment that does not set the variable hides the feature. Dev and CI
 * set it to "true" so the feature stays visible and its tests keep exercising it.
 * To re-enable annotations in a deployment, set VITE_FEATURE_ANNOTATIONS=true.
 *
 * Reversibility: this flag only hides UI/data flow; no annotation code is
 * removed. Flipping it back on restores the full experience. See bead std-cid4.
 */
export const annotationsEnabled = import.meta.env.VITE_FEATURE_ANNOTATIONS === "true";

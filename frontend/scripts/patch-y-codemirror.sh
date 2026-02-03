#!/bin/sh
# Patch y-codemirror.next to fix "update in progress" error
# Bug: remote changes call dispatch() immediately instead of using setTimeout
# Fix: Patch src/y-sync.js to use setTimeout(dispatch, 0) for remote updates

set -e

PATCH_FILE="node_modules/y-codemirror.next/src/y-sync.js"

if [ ! -f "$PATCH_FILE" ]; then
  echo "Error: y-codemirror.next source not found at $PATCH_FILE"
  exit 1
fi

# Check if already patched
if grep -q "setTimeout(dispatch, 0)" "$PATCH_FILE"; then
  echo "y-codemirror.next already patched"
  exit 0
fi

echo "Patching y-codemirror.next source..."

# Wrap view.dispatch in setTimeout to prevent "update in progress" errors
# The Y.Text observer calls view.dispatch() synchronously, which can happen
# during CodeMirror's update cycle. Defer with setTimeout to avoid the conflict.
sed -i.bak "s/view\.dispatch({ changes, annotations/setTimeout(() => view.dispatch({ changes, annotations/g" "$PATCH_FILE"
sed -i.bak "s/annotations: \[ySyncAnnotation\.of(this\.conf)\] })/annotations: [ySyncAnnotation.of(this.conf)] }), 0)/g" "$PATCH_FILE"

# Force Vite to rebuild by removing deps cache
rm -rf node_modules/.vite 2>/dev/null || true

echo "✓ y-codemirror.next source patched successfully"

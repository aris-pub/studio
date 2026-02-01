#!/bin/sh
# Patch y-codemirror.next to fix "update in progress" error
# Bug: Remote changes call dispatch() immediately instead of using setTimeout
# Fix: Change line 251 to use setTimeout for both local AND remote changes

FILE="node_modules/y-codemirror.next/src/y-sync.js"

if [ ! -f "$FILE" ]; then
  echo "Warning: $FILE not found, skipping patch"
  exit 0
fi

# Check if already patched
if grep -q "} else { setTimeout(dispatch, 0) }" "$FILE"; then
  echo "y-codemirror.next already patched"
  exit 0
fi

# Apply the fix
sed -i.bak '251s/} else { dispatch() }/} else { setTimeout(dispatch, 0) }/' "$FILE"

if grep -q "} else { setTimeout(dispatch, 0) }" "$FILE"; then
  echo "✓ y-codemirror.next patched successfully"
  rm -f "$FILE.bak"
else
  echo "✗ Failed to patch y-codemirror.next"
  mv "$FILE.bak" "$FILE" 2>/dev/null
  exit 1
fi

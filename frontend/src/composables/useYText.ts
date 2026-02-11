/**
 * @file useYText composable stub
 * @description Provides access to Y.Text instance for collaborative editing
 */

import type * as Y from 'yjs'

interface YTextReturn {
  ytext: Y.Text
  ydoc: Y.Doc
}

export function useYText(_fileId: number): YTextReturn {
  // This is a stub - actual implementation will be in EditorCodeMirror
  throw new Error('useYText must be mocked in tests or implemented properly')
}


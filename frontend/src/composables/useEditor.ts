/**
 * @file useEditor composable stub
 * @description Provides access to CodeMirror editor instance
 */

interface EditorReturn {
  editor: {
    isReadOnly: () => boolean
    setReadOnly: (readOnly: boolean) => void
  }
}

export function useEditor(): EditorReturn {
  // This is a stub - actual implementation will be in EditorCodeMirror
  throw new Error('useEditor must be mocked in tests or implemented properly')
}

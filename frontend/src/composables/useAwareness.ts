/**
 * @file useAwareness composable stub
 * @description Provides access to Y.js awareness for presence/collaboration
 */

interface AwarenessReturn {
  awareness: any
  currentUser: { id: number; name: string }
}

export function useAwareness(): AwarenessReturn {
  // This is a stub - actual implementation will be in EditorCodeMirror
  throw new Error('useAwareness must be mocked in tests or implemented properly')
}

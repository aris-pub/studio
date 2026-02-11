/**
 * @file useVersionRestore composable
 * @description Enhanced Pattern B implementation for version restore
 *
 * Features:
 * 1. Concurrent editor detection (confirm dialog)
 * 2. Origin tagging for audit trail
 * 3. Read-only lock during restore
 * 4. Permission: Owner-only (enforced by backend)
 */

import { ref } from 'vue'
import { useYText } from './useYText'
import { useAwareness } from './useAwareness'
import { useEditor } from './useEditor'
import { useCurrentUser } from './useCurrentUser'

interface RestoreOrigin {
  type: 'restore-version'
  versionId: number
  userId: number
  timestamp: number
}

/**
 * Composable for restoring file versions via Y.js
 * @param fileId - The file ID to restore versions for
 */
export function useVersionRestore(fileId: number) {
  const isRestoring = ref(false)
  const { ytext, ydoc } = useYText(fileId)
  const { awareness, currentUser } = useAwareness()
  const { editor } = useEditor()
  const { user } = useCurrentUser()

  /**
   * Get list of active users (excluding current user)
   */
  function getActiveUsers(excludeUserId: number): Array<{ id: number; name: string }> {
    const states = awareness.getStates()
    const activeUsers: Array<{ id: number; name: string }> = []

    states.forEach((state, _clientId) => {
      if (state.user && state.user.id !== excludeUserId) {
        // Consider user active if they have cursor or are editing
        if (state.cursor || state.editing) {
          activeUsers.push(state.user)
        }
      }
    })

    return activeUsers
  }

  /**
   * Restore a version by replacing editor content via Y.js
   * @param versionId - The version ID to restore
   * @returns Promise<boolean> - True if restore succeeded, false if cancelled
   */
  async function restoreVersion(versionId: number): Promise<boolean> {
    let originalReadOnly = false
    let editorWasLocked = false

    try {
      isRestoring.value = true

      // 1. Fetch version content
      const response = await fetch(
        `/api/files/${fileId}/versions/${versionId}/preview`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch version: ${response.statusText}`)
      }

      const versionContent = await response.text()

      // 2. Check for concurrent editors
      const activeUsers = getActiveUsers(currentUser.id)
      if (activeUsers.length > 0) {
        const userNames = activeUsers.map(u => u.name).join(', ')
        const confirmed = confirm(
          `${activeUsers.length} other user(s) are currently editing (${userNames}). ` +
          `Restoring will merge their changes with the restored version. Continue?`
        )

        if (!confirmed) {
          return false
        }
      }

      // 3. Lock editor
      originalReadOnly = editor.isReadOnly()
      editor.setReadOnly(true)
      editorWasLocked = true

      // 4. Broadcast restore intent
      awareness.setLocalStateField('restoring', versionId)

      try {
        // 5. Perform restore (atomic transaction)
        const origin: RestoreOrigin = {
          type: 'restore-version',
          versionId: versionId,
          userId: user.value?.id || currentUser.id,
          timestamp: Date.now()
        }

        ydoc.transact(() => {
          // Delete all current content
          ytext.delete(0, ytext.length)

          // Insert version content
          ytext.insert(0, versionContent)
        }, { origin })

        // 6. Wait for backend persistence (500ms debounce + buffer)
        await new Promise(resolve => setTimeout(resolve, 1000))

        return true
      } finally {
        // 7. Clear restore state
        awareness.setLocalStateField('restoring', null)
      }
    } catch (error) {
      console.error('Failed to restore version:', error)
      throw error
    } finally {
      // 8. Unlock editor (if it was locked)
      if (editorWasLocked) {
        editor.setReadOnly(originalReadOnly)
      }

      isRestoring.value = false
    }
  }

  return {
    restoreVersion,
    isRestoring
  }
}

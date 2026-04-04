/**
 * @file useVersionRestore composable
 * @description Enhanced Pattern B implementation for version restore
 *
 * Uses lazy inject pattern: inject() runs at setup time (Vue requirement),
 * but .value is only accessed inside restoreVersion() so the composable
 * can be called safely during component setup even before the editor is ready.
 */

import { ref, inject } from 'vue'
import type { ShallowRef, Ref } from 'vue'
import { EditorState } from '@codemirror/state'
import type { Compartment } from '@codemirror/state'
import type * as Y from 'yjs'

interface RestoreOrigin {
  type: 'restore-version'
  versionId: number
  userId: number
  timestamp: number
}

export function useVersionRestore(fileId: number) {
  const isRestoring = ref(false)

  // Lazy inject: grab refs at setup, access .value only inside restoreVersion()
  const ydocRef = inject<ShallowRef<Y.Doc | null>>('ydoc', null as any)
  const awarenessRef = inject<ShallowRef<any>>('awareness', null as any)
  const cmViewRef = inject<ShallowRef<any>>('cmView', null as any)
  const readOnlyCompartmentRef = inject<ShallowRef<Compartment | null>>('readOnlyCompartment', null as any)
  const userRef = inject<Ref<{ id: number; name: string; email: string } | null>>('user', null as any)

  function getActiveUsers(awareness: any, excludeUserId: number): Array<{ id: number; name: string }> {
    const states = awareness.getStates()
    const activeUsers: Array<{ id: number; name: string }> = []

    states.forEach((state: any, _clientId: number) => {
      if (state.user && state.user.id !== excludeUserId) {
        if (state.cursor || state.editing) {
          activeUsers.push(state.user)
        }
      }
    })

    return activeUsers
  }

  async function restoreVersion(versionId: number): Promise<boolean> {
    const ydoc = ydocRef?.value
    if (!ydoc) {
      throw new Error('Editor not available — Y.Doc not initialized')
    }
    const ytext = ydoc.getText('text')

    const awareness = awarenessRef?.value
    const view = cmViewRef?.value
    const compartment = readOnlyCompartmentRef?.value
    const user = userRef?.value
    const currentUserId = user?.id ?? 0

    let originalReadOnly = false
    let editorWasLocked = false

    try {
      isRestoring.value = true

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

      // Check for concurrent editors
      if (awareness) {
        const activeUsers = getActiveUsers(awareness, currentUserId)
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
      }

      // Lock editor (if view and compartment are available)
      if (view && compartment) {
        originalReadOnly = view.state.facet(EditorState.readOnly)
        const { EditorView: EV } = await import('@codemirror/view')
        view.dispatch({
          effects: compartment.reconfigure(
            [EditorState.readOnly.of(true), EV.editable.of(false)]
          )
        })
        editorWasLocked = true
      }

      // Broadcast restore intent
      if (awareness) {
        awareness.setLocalStateField('restoring', versionId)
      }

      try {
        const origin: RestoreOrigin = {
          type: 'restore-version',
          versionId: versionId,
          userId: currentUserId,
          timestamp: Date.now()
        }

        ydoc.transact(() => {
          ytext.delete(0, ytext.length)
          ytext.insert(0, versionContent)
        }, { origin })

        await new Promise(resolve => setTimeout(resolve, 1000))

        return true
      } finally {
        if (awareness) {
          awareness.setLocalStateField('restoring', null)
        }
      }
    } catch (error) {
      console.error('Failed to restore version:', error)
      throw error
    } finally {
      if (editorWasLocked && view && compartment) {
        const exts = originalReadOnly
          ? [EditorState.readOnly.of(true)]
          : []
        view.dispatch({ effects: compartment.reconfigure(exts) })
      }

      isRestoring.value = false
    }
  }

  return {
    restoreVersion,
    isRestoring
  }
}

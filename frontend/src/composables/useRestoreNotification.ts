/**
 * @file useRestoreNotification composable
 *
 * Watches Y.js awareness states for other users' 'restoring' field.
 * When another user transitions from restoring=null to restoring=<versionId>,
 * shows an info toast so the current user knows the document was restored.
 */

import { watch, unref, onUnmounted, type ShallowRef, type Ref } from 'vue'
import { toast } from '@/utils/toast'

export function useRestoreNotification(
  awarenessRef: ShallowRef<any>,
  currentUserId: number | Ref<number | undefined>,
) {
  // Track the last-known restoring value per clientId to detect transitions
  const previousRestoring = new Map<number, any>()
  let currentAwareness: any = null

  function onAwarenessChange(changes: { added: number[]; updated: number[]; removed: number[] }) {
    const awareness = currentAwareness
    if (!awareness) return

    const userId = unref(currentUserId)
    const states = awareness.getStates()
    const changedIds = [...changes.added, ...changes.updated]

    for (const clientId of changedIds) {
      const state = states.get(clientId)
      if (!state) continue

      // Skip self
      if (state.user?.id === userId) {
        previousRestoring.set(clientId, state.restoring ?? null)
        continue
      }

      const prev = previousRestoring.get(clientId) ?? null
      const curr = state.restoring ?? null

      // Only fire on null → versionId transition (restore started)
      if (prev === null && curr !== null) {
        const userName = state.user?.name || 'Someone'
        toast.info(`${userName} restored a previous version`, {
          description: 'Your editor has been updated.',
          duration: 5000,
        })
      }

      previousRestoring.set(clientId, curr)
    }

    // Clean up removed clients
    for (const clientId of changes.removed) {
      previousRestoring.delete(clientId)
    }
  }

  function attach(awareness: any) {
    if (!awareness) return
    currentAwareness = awareness

    // Seed previous state so existing restoring=null doesn't trigger on first real change
    const states = awareness.getStates()
    states.forEach((state: any, clientId: number) => {
      previousRestoring.set(clientId, state.restoring ?? null)
    })

    awareness.on('change', onAwarenessChange)
  }

  function detach() {
    if (currentAwareness) {
      currentAwareness.off('change', onAwarenessChange)
      currentAwareness = null
    }
    previousRestoring.clear()
  }

  // Watch for awareness becoming available (it's null until WebSocket connects)
  const stopWatch = watch(
    () => awarenessRef.value,
    (newAwareness, oldAwareness) => {
      if (oldAwareness) detach()
      if (newAwareness) attach(newAwareness)
    },
    { immediate: true },
  )

  function stop() {
    stopWatch()
    detach()
  }

  // Auto-cleanup if used inside a component
  try {
    onUnmounted(stop)
  } catch {
    // Called outside component lifecycle — caller must call stop() manually
  }

  return { stop }
}

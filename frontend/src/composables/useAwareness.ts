import { inject } from 'vue'
import type { ShallowRef } from 'vue'

interface AwarenessReturn {
  awareness: any
  currentUser: { id: number; name: string }
}

export function useAwareness(): AwarenessReturn {
  const awarenessRef = inject<ShallowRef>('awareness')
  const userRef = inject<any>('user')

  if (!awarenessRef?.value) {
    throw new Error('useAwareness: awareness not provided — must be called inside Canvas.vue hierarchy')
  }

  const user = userRef?.value
  if (!user) {
    throw new Error('useAwareness: user not provided — must be called inside App.vue hierarchy')
  }

  return {
    awareness: awarenessRef.value,
    currentUser: { id: user.id, name: user.name },
  }
}

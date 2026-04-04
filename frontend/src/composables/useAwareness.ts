import { inject, type ShallowRef, type Ref } from 'vue'

interface AwarenessReturn {
  awareness: any
  currentUser: { id: number; name: string }
}

export function useAwareness(): AwarenessReturn {
  const awarenessRef = inject<ShallowRef<any>>('awareness', null)
  const userRef = inject<Ref<any>>('user', null)

  // Return a proxy that defers to the current ref value at access time.
  // At setup time, awareness may be null (EditorCodeMirror hasn't mounted yet).
  // By the time restoreVersion() runs, it will be populated.
  const awareness = new Proxy({} as any, {
    get(_target, prop) {
      const instance = awarenessRef?.value
      if (!instance) throw new Error('Awareness not initialized — editor must be mounted first')
      const val = instance[prop]
      return typeof val === 'function' ? val.bind(instance) : val
    },
  })

  const currentUser = new Proxy({} as { id: number; name: string }, {
    get(_target, prop) {
      const u = userRef?.value
      if (prop === 'id') return u?.id ?? 0
      if (prop === 'name') return u?.name ?? u?.email ?? 'Unknown'
      return undefined
    },
  })

  return { awareness, currentUser }
}

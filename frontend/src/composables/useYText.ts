import { inject, type ShallowRef } from 'vue'
import type * as Y from 'yjs'

interface YTextReturn {
  ytext: Y.Text
  ydoc: Y.Doc
}

export function useYText(_fileId: number): YTextReturn {
  const ydocRef = inject<ShallowRef<Y.Doc | null>>('ydoc', null)

  // Return proxies that defer to the current ref value at access time.
  // At setup time, ydoc may be null (EditorCodeMirror hasn't mounted yet).
  // By the time restoreVersion() runs, it will be populated.
  const ydoc = new Proxy({} as Y.Doc, {
    get(_target, prop) {
      const instance = ydocRef?.value
      if (!instance) throw new Error('Y.Doc not initialized — editor must be mounted first')
      const val = (instance as any)[prop]
      return typeof val === 'function' ? val.bind(instance) : val
    },
  })

  const ytext = new Proxy({} as Y.Text, {
    get(_target, prop) {
      const instance = ydocRef?.value?.getText('text')
      if (!instance) throw new Error('Y.Text not initialized — editor must be mounted first')
      const val = (instance as any)[prop]
      return typeof val === 'function' ? val.bind(instance) : val
    },
  })

  return { ytext, ydoc }
}

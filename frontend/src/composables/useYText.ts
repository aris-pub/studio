import { inject } from 'vue'
import type { ShallowRef } from 'vue'
import type * as Y from 'yjs'

interface YTextReturn {
  ytext: Y.Text
  ydoc: Y.Doc
}

export function useYText(_fileId: number): YTextReturn {
  const ydocRef = inject<ShallowRef<Y.Doc | null>>('ydoc')

  if (!ydocRef?.value) {
    throw new Error('useYText: ydoc not provided — must be called inside View.vue hierarchy')
  }

  const ydoc = ydocRef.value
  const ytext = ydoc.getText('text')

  return { ytext, ydoc }
}

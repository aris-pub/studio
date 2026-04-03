import { inject } from 'vue'
import type { ShallowRef } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { Compartment } from '@codemirror/state'

interface EditorReturn {
  editor: {
    isReadOnly: () => boolean
    setReadOnly: (readOnly: boolean) => void
  }
}

export function useEditor(): EditorReturn {
  const cmViewRef = inject<ShallowRef>('cmView')
  const compartmentRef = inject<ShallowRef<Compartment | null>>('readOnlyCompartment')

  if (!cmViewRef?.value) {
    throw new Error('useEditor: cmView not provided — must be called inside Canvas.vue hierarchy')
  }

  if (!compartmentRef?.value) {
    throw new Error('useEditor: readOnlyCompartment not provided — editor not initialized')
  }

  const view = cmViewRef.value
  const compartment = compartmentRef.value

  return {
    editor: {
      isReadOnly: () => view.state.facet(EditorState.readOnly),
      setReadOnly: (ro: boolean) => {
        const exts = ro
          ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
          : []
        view.dispatch({ effects: compartment.reconfigure(exts) })
      },
    },
  }
}

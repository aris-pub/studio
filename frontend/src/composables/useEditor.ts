import { inject, type ShallowRef } from 'vue'
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
  const cmView = inject<ShallowRef<EditorView | null>>('cmView', null)
  const readOnlyCompartment = inject<ShallowRef<Compartment | null>>('readOnlyCompartment', null)

  const editor = {
    isReadOnly(): boolean {
      return cmView?.value?.state?.readOnly ?? false
    },
    setReadOnly(readOnly: boolean): void {
      const view = cmView?.value
      const compartment = readOnlyCompartment?.value
      if (!view || !compartment) return

      const exts = readOnly
        ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
        : []
      view.dispatch({ effects: compartment.reconfigure(exts) })
    },
  }

  return { editor }
}

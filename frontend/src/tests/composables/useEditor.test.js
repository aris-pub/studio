import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowRef } from 'vue'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    inject: vi.fn(),
  }
})

vi.mock('@codemirror/state', () => ({
  EditorState: {
    readOnly: { of: (v) => ({ readOnly: v }) },
  },
  Compartment: class {
    reconfigure(exts) { return { reconfigure: exts } }
  },
}))

vi.mock('@codemirror/view', () => ({
  EditorView: {
    editable: { of: (v) => ({ editable: v }) },
  },
}))

import { inject } from 'vue'
const { useEditor } = await import('@/composables/useEditor')

describe('useEditor', () => {
  const mockDispatch = vi.fn()
  const mockCompartment = { reconfigure: vi.fn((exts) => ({ type: 'reconfigure', exts })) }

  const mockView = {
    state: {
      facet: vi.fn(() => false),
    },
    dispatch: mockDispatch,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns editor with isReadOnly and setReadOnly', () => {
    inject.mockImplementation((key) => {
      if (key === 'cmView') return shallowRef(mockView)
      if (key === 'readOnlyCompartment') return shallowRef(mockCompartment)
      return undefined
    })

    const { editor } = useEditor()

    expect(typeof editor.isReadOnly).toBe('function')
    expect(typeof editor.setReadOnly).toBe('function')
  })

  it('isReadOnly reads from EditorState.readOnly facet', () => {
    mockView.state.facet.mockReturnValue(true)

    inject.mockImplementation((key) => {
      if (key === 'cmView') return shallowRef(mockView)
      if (key === 'readOnlyCompartment') return shallowRef(mockCompartment)
      return undefined
    })

    const { editor } = useEditor()
    expect(editor.isReadOnly()).toBe(true)
  })

  it('setReadOnly dispatches compartment reconfigure', () => {
    inject.mockImplementation((key) => {
      if (key === 'cmView') return shallowRef(mockView)
      if (key === 'readOnlyCompartment') return shallowRef(mockCompartment)
      return undefined
    })

    const { editor } = useEditor()
    editor.setReadOnly(true)

    expect(mockCompartment.reconfigure).toHaveBeenCalled()
    expect(mockDispatch).toHaveBeenCalledWith({
      effects: expect.anything(),
    })
  })

  it('setReadOnly(false) dispatches empty extensions', () => {
    inject.mockImplementation((key) => {
      if (key === 'cmView') return shallowRef(mockView)
      if (key === 'readOnlyCompartment') return shallowRef(mockCompartment)
      return undefined
    })

    const { editor } = useEditor()
    editor.setReadOnly(false)

    expect(mockCompartment.reconfigure).toHaveBeenCalledWith([])
  })

  it('throws when cmView is not provided', () => {
    inject.mockImplementation((key) => {
      if (key === 'cmView') return shallowRef(null)
      if (key === 'readOnlyCompartment') return shallowRef(mockCompartment)
      return undefined
    })

    expect(() => useEditor()).toThrow('cmView not provided')
  })

  it('throws when readOnlyCompartment is not provided', () => {
    inject.mockImplementation((key) => {
      if (key === 'cmView') return shallowRef(mockView)
      if (key === 'readOnlyCompartment') return shallowRef(null)
      return undefined
    })

    expect(() => useEditor()).toThrow('readOnlyCompartment not provided')
  })
})

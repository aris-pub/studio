import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowRef } from 'vue'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    inject: vi.fn(),
  }
})

import { inject } from 'vue'
const { useYText } = await import('@/composables/useYText')

describe('useYText', () => {
  const mockYText = { length: 50, toString: () => 'hello' }
  const mockYDoc = {
    getText: vi.fn(() => mockYText),
    transact: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ytext and ydoc from injected ydoc ref', () => {
    inject.mockImplementation((key) => {
      if (key === 'ydoc') return shallowRef(mockYDoc)
      return undefined
    })

    const result = useYText(123)

    expect(result.ydoc).toBe(mockYDoc)
    expect(result.ytext).toBe(mockYText)
    expect(mockYDoc.getText).toHaveBeenCalledWith('text')
  })

  it('throws when ydoc ref is not provided', () => {
    inject.mockImplementation(() => shallowRef(null))

    expect(() => useYText(123)).toThrow('ydoc not provided')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowRef, ref } from 'vue'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    inject: vi.fn(),
  }
})

import { inject } from 'vue'
const { useAwareness } = await import('@/composables/useAwareness')

describe('useAwareness', () => {
  const mockAwareness = {
    getStates: vi.fn(() => new Map()),
    setLocalStateField: vi.fn(),
  }

  const mockUser = { id: 42, name: 'Test User', email: 'test@example.com' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns awareness instance and currentUser from injected refs', () => {
    inject.mockImplementation((key) => {
      if (key === 'awareness') return shallowRef(mockAwareness)
      if (key === 'user') return ref(mockUser)
      return undefined
    })

    const result = useAwareness()

    expect(result.awareness).toBe(mockAwareness)
    expect(result.currentUser).toEqual({ id: 42, name: 'Test User' })
  })

  it('throws when awareness ref is not provided', () => {
    inject.mockImplementation((key) => {
      if (key === 'awareness') return shallowRef(null)
      if (key === 'user') return ref(mockUser)
      return undefined
    })

    expect(() => useAwareness()).toThrow('awareness not provided')
  })

  it('throws when user ref is not provided', () => {
    inject.mockImplementation((key) => {
      if (key === 'awareness') return shallowRef(mockAwareness)
      if (key === 'user') return ref(null)
      return undefined
    })

    expect(() => useAwareness()).toThrow('user not provided')
  })
})

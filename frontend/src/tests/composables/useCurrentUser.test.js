import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    inject: vi.fn(),
  }
})

import { inject } from 'vue'
const { useCurrentUser } = await import('@/composables/useCurrentUser')

describe('useCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the injected user ref', () => {
    const userRef = ref({ id: 1, name: 'Alice', email: 'alice@test.com' })
    inject.mockReturnValue(userRef)

    const { user } = useCurrentUser()

    expect(user).toBe(userRef)
    expect(user.value).toEqual({ id: 1, name: 'Alice', email: 'alice@test.com' })
  })

  it('throws when user is not provided', () => {
    inject.mockReturnValue(undefined)

    expect(() => useCurrentUser()).toThrow('user not provided')
  })

  it('allows null user value (not logged in)', () => {
    const userRef = ref(null)
    inject.mockReturnValue(userRef)

    const { user } = useCurrentUser()
    expect(user.value).toBeNull()
  })
})

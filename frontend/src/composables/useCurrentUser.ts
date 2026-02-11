/**
 * @file useCurrentUser composable stub
 * @description Provides access to current user information
 */

import type { Ref } from 'vue'

interface User {
  id: number
  name: string
  email: string
}

interface CurrentUserReturn {
  user: Ref<User | null>
}

export function useCurrentUser(): CurrentUserReturn {
  // This is a stub - actual implementation will use inject('user')
  throw new Error('useCurrentUser must be mocked in tests or implemented properly')
}

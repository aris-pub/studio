import { inject } from 'vue'
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
  const user = inject<Ref<User | null>>('user')

  if (!user) {
    throw new Error('useCurrentUser: user not provided — must be called inside App.vue hierarchy')
  }

  return { user }
}

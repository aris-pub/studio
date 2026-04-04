import { inject, type Ref } from 'vue'

interface User {
  id: number
  name: string
  email: string
}

interface CurrentUserReturn {
  user: Ref<User | null>
}

export function useCurrentUser(): CurrentUserReturn {
  const user = inject<Ref<User | null>>('user', null)
  return { user: user! }
}

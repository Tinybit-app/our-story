interface UserState {
  hasMembership: boolean
  needsProfile: boolean
  deletedAt: string | null
}

export const useUserState = () => {
  const state = useState<UserState | null>('userState', () => null)

  // Fetch fresh state from the server and update the cache
  async function refresh(): Promise<UserState> {
    state.value = await $fetch<UserState>('/api/auth/membership')
    return state.value
  }

  // Return cached state, fetching only if not yet loaded
  async function ensure(): Promise<UserState> {
    return state.value ?? (await refresh())
  }

  // Clear cache (call on logout or when state is known to have changed)
  function clear() {
    state.value = null
  }

  return { state, refresh, ensure, clear }
}

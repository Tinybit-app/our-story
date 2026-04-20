const STORAGE_KEY = "value_prop_seen"

export function useValuePropSeen() {
  function hasSeen(): boolean {
    if (typeof localStorage === "undefined") return false
    return localStorage.getItem(STORAGE_KEY) === "1"
  }

  function markAsSeen(): void {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(STORAGE_KEY, "1")
  }

  return { hasSeen, markAsSeen }
}

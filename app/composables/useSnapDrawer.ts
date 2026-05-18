import { ref, computed, type Ref } from 'vue'

export type SnapPoint = 'peek' | 'default' | 'full'

export interface SnapDrawerOptions {
  /** Viewport height in CSS pixels at hook setup. Used to compute snap heights. */
  viewportHeight: number
  /** Snap points to enable. Default ['peek', 'default', 'full']. */
  snaps?: SnapPoint[]
  /** Snap heights in px or vh. Default: peek=120px, default=50vh, full=88vh. */
  peekPx?: number
  defaultVh?: number
  fullVh?: number
  /** Snap on release if drag velocity exceeds this (px/ms). Default 0.5. */
  velocityThreshold?: number
}

export function useSnapDrawer(options: SnapDrawerOptions) {
  const {
    viewportHeight,
    snaps = ['peek', 'default', 'full'],
    peekPx = 120,
    defaultVh = 50,
    fullVh = 88,
    velocityThreshold = 0.5,
  } = options

  const heights: Record<SnapPoint, number> = {
    peek: peekPx,
    default: Math.round((defaultVh / 100) * viewportHeight),
    full: Math.round((fullVh / 100) * viewportHeight),
  }

  const snap: Ref<SnapPoint> = ref(
    snaps.includes('default') ? 'default' : (snaps[0] as SnapPoint),
  )

  const heightPx: Ref<number> = ref(heights[snap.value])

  const isDragging = ref(false)
  let dragStartY = 0
  let dragStartHeight = 0
  let lastMoveY = 0
  let lastMoveTime = 0
  let velocityPxPerMs = 0

  function snapTo(target: SnapPoint) {
    if (!snaps.includes(target)) return
    snap.value = target
    heightPx.value = heights[target]
  }

  function onDragStart(clientY: number) {
    isDragging.value = true
    dragStartY = clientY
    dragStartHeight = heightPx.value
    lastMoveY = clientY
    lastMoveTime = performance.now()
    velocityPxPerMs = 0
  }

  function onDragMove(clientY: number) {
    if (!isDragging.value) return
    const delta = dragStartY - clientY
    const newHeight = clamp(
      dragStartHeight + delta,
      heights[snaps[0]!],
      heights[snaps[snaps.length - 1]!],
    )
    const now = performance.now()
    const dt = now - lastMoveTime
    if (dt >= 4) velocityPxPerMs = (lastMoveY - clientY) / dt
    lastMoveY = clientY
    lastMoveTime = now
    heightPx.value = newHeight
  }

  function onDragEnd() {
    if (!isDragging.value) return
    isDragging.value = false
    if (Math.abs(velocityPxPerMs) > velocityThreshold) {
      const currentIdx = snaps.indexOf(snap.value)
      const dir = velocityPxPerMs > 0 ? 1 : -1
      const jumpDistance =
        Math.abs(velocityPxPerMs) > velocityThreshold * 2 ? 2 : 1
      const targetIdx = clamp(
        currentIdx + dir * jumpDistance,
        0,
        snaps.length - 1,
      )
      snapTo(snaps[targetIdx]!)
      return
    }
    let nearest: SnapPoint = snaps[0]!
    let minDistance = Infinity
    for (const s of snaps) {
      const d = Math.abs(heightPx.value - heights[s])
      if (d < minDistance) {
        minDistance = d
        nearest = s
      }
    }
    snapTo(nearest)
  }

  const translateY = computed(() => -(heightPx.value - heights[snaps[0]!]))

  return {
    snap,
    heightPx,
    translateY,
    isDragging,
    snapTo,
    onDragStart,
    onDragMove,
    onDragEnd,
    heights,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

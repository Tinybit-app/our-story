import { describe, it, expect } from 'vitest'
import { useSnapDrawer } from '~/composables/useSnapDrawer'

const VIEWPORT = 800

describe('useSnapDrawer', () => {
  it('starts at default snap with the right heightPx', () => {
    const d = useSnapDrawer({ viewportHeight: VIEWPORT })
    expect(d.snap.value).toBe('default')
    expect(d.heightPx.value).toBe(400)
  })

  it('snapTo moves between snaps', () => {
    const d = useSnapDrawer({ viewportHeight: VIEWPORT })
    d.snapTo('full')
    expect(d.snap.value).toBe('full')
    expect(d.heightPx.value).toBe(704)

    d.snapTo('peek')
    expect(d.snap.value).toBe('peek')
    expect(d.heightPx.value).toBe(120)
  })

  it('drag without velocity snaps to nearest', () => {
    const d = useSnapDrawer({ viewportHeight: VIEWPORT })
    d.onDragStart(500)
    d.onDragMove(450)
    d.onDragEnd()
    expect(d.snap.value).toBe('default')

    d.onDragStart(500)
    d.onDragMove(300)
    d.onDragEnd()
    expect(d.snap.value).toBe('full')
  })

  it('clamps at snap bounds during drag', () => {
    const d = useSnapDrawer({ viewportHeight: VIEWPORT })
    d.onDragStart(500)
    d.onDragMove(900)
    expect(d.heightPx.value).toBe(120)
  })

  it('respects 2-snap fallback (no peek)', () => {
    const d = useSnapDrawer({
      viewportHeight: VIEWPORT,
      snaps: ['default', 'full'],
    })
    expect(d.snap.value).toBe('default')
    d.onDragStart(500)
    d.onDragMove(900)
    expect(d.heightPx.value).toBe(400)
  })

  it('flick up at high velocity jumps a snap', async () => {
    const d = useSnapDrawer({
      viewportHeight: VIEWPORT,
      velocityThreshold: 0.5,
    })
    // Trigger a velocity > threshold by waiting ~10ms between moves.
    d.onDragStart(500)
    d.onDragMove(490)
    await new Promise((r) => setTimeout(r, 10))
    d.onDragMove(480) // 10px in ~10ms ≈ 1.0 px/ms upward
    d.onDragEnd()
    expect(d.snap.value).toBe('full')
  })
})

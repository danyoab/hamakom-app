import { useEffect, useState } from 'react'

// Some Android WebViews report window.innerHeight larger than the true
// visible area (window.visualViewport.height) while still edge-to-edge —
// env(safe-area-inset-bottom) alone doesn't cover the full gap. CSS
// position:fixed anchors to the (wrong, larger) layout viewport, so a
// fixed element's "bottom" offset can land below the real fold. This
// hook measures that live gap so callers can add it back in.
export function useViewportBottomGap() {
  const [gap, setGap] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const measure = () => {
      const trueGap = window.innerHeight - (vv.height + vv.offsetTop)
      setGap(trueGap > 0 ? Math.round(trueGap) : 0)
    }

    measure()
    vv.addEventListener('resize', measure)
    vv.addEventListener('scroll', measure)
    return () => {
      vv.removeEventListener('resize', measure)
      vv.removeEventListener('scroll', measure)
    }
  }, [])

  return gap
}

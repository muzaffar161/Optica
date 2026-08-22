import { useEffect, useRef, useState, type ReactNode } from 'react'

const THRESHOLD = 68

function atTop() {
  return (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop) <= 1
}

export default function PullToRefresh({
  children,
  disabled,
}: {
  children: ReactNode
  disabled?: boolean
}) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)
  const pullRef = useRef(0)

  useEffect(() => {
    pullRef.current = pull
  }, [pull])

  useEffect(() => {
    if (disabled) return

    function onStart(e: TouchEvent) {
      if (refreshing || e.touches.length !== 1 || !atTop()) return
      startY.current = e.touches[0].clientY
      pulling.current = true
    }

    function onMove(e: TouchEvent) {
      if (!pulling.current || refreshing) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0 || !atTop()) {
        pulling.current = false
        setPull(0)
        return
      }
      const next = Math.min(112, dy * 0.42)
      setPull(next)
      if (next > 10) e.preventDefault()
    }

    function onEnd() {
      if (!pulling.current) return
      pulling.current = false
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true)
        setPull(56)
        window.location.reload()
        return
      }
      setPull(0)
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [disabled, refreshing])

  const armed = pull >= THRESHOLD || refreshing

  return (
    <>
      <div
        className="flex items-end justify-center overflow-hidden text-muted"
        style={{ height: pull }}
        aria-hidden
      >
        {(pull > 8 || refreshing) && (
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span
              className={`inline-block h-4 w-4 rounded-full border-2 border-line border-t-ink ${
                refreshing || armed ? 'animate-spin' : ''
              }`}
            />
            {refreshing ? 'Обновляем…' : armed ? 'Отпустите' : 'Потяните вниз'}
          </div>
        )}
      </div>
      {children}
    </>
  )
}

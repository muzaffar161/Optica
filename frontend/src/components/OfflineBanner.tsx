import { useEffect, useState } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    function on() {
      setOffline(false)
    }
    function off() {
      setOffline(true)
    }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null
  return (
    <div className="bg-ink px-4 py-2 text-center text-sm text-white">
      Нет сети. Заказы не сохранятся, пока не появится интернет.
    </div>
  )
}

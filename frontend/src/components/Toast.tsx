import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// 오른쪽 위에 잠깐 떴다가 4초 뒤 사라지는 알림. 새 내용을 보이려면 key를 바꿔 다시 그린다.
export function Toast({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setShown(false), 4000)
    return () => clearTimeout(timer)
  }, [])
  return shown ? (
    <p
      role="status"
      className="fixed top-4 right-4 z-50 rounded-xl border bg-card px-4 py-3 text-sm shadow-lg"
    >
      {children}
    </p>
  ) : null
}

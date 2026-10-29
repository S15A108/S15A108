import { useId } from 'react'
import { cn } from '@/lib/utils'

// 비비 얼굴(캐릭터 도안 기반): 노란 둥근 헬멧, 크림색 얼굴판, 큰 갈색 눈, 더듬이, 귀 원판, 볼 터치.
// 캐릭터 색이라 테마 토큰을 쓰지 않는다.
export function BibiFace({
  className,
  label,
}: {
  className?: string
  /** 그림만으로 비비를 알려야 하면 넣는다. 없으면 장식으로 숨긴다. */
  label?: string
}) {
  const id = useId()
  const helmet = `${id}-helmet`
  const eye = `${id}-eye`
  return (
    <svg
      viewBox="0 0 128 128"
      className={cn('size-10', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <radialGradient id={helmet} cx="0.38" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffd77a" />
          <stop offset="0.6" stopColor="#f6bd4a" />
          <stop offset="1" stopColor="#e09a2c" />
        </radialGradient>
        <radialGradient id={eye} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#2b140b" />
          <stop offset="0.72" stopColor="#3f1d0f" />
          <stop offset="0.9" stopColor="#b8541c" />
          <stop offset="1" stopColor="#f08a32" />
        </radialGradient>
      </defs>
      {/* 더듬이 */}
      <g stroke="#1f1b17" strokeWidth="4" strokeLinecap="round">
        <path d="M45 28 L35 10" />
        <path d="M83 28 L93 10" />
      </g>
      <circle cx="34" cy="8" r="6.5" fill="#1f1b17" />
      <circle cx="94" cy="8" r="6.5" fill="#1f1b17" />
      {/* 헬멧 */}
      <ellipse cx="64" cy="68" rx="52" ry="50" fill={`url(#${helmet})`} />
      <path
        d="M30 38 Q64 18 98 38"
        fill="none"
        stroke="#d99128"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <ellipse
        cx="46"
        cy="36"
        rx="15"
        ry="7"
        fill="#fff"
        fillOpacity="0.35"
        transform="rotate(-18 46 36)"
      />
      {/* 귀 원판 */}
      {[14, 114].map((x) => (
        <g key={x}>
          <circle cx={x} cy="72" r="13" fill="#e9a73a" />
          <circle
            cx={x}
            cy="72"
            r="8.5"
            fill="#f4bb4c"
            stroke="#d48f22"
            strokeWidth="1.5"
          />
        </g>
      ))}
      {/* 얼굴판: 위 가운데가 헬멧 쪽으로 파인 모양 */}
      <path
        d="M24 74 C24 56 34 48 46 48 L56 48 L64 57 L72 48 L82 48 C94 48 104 56 104 74 C104 96 88 108 64 108 C40 108 24 96 24 74 Z"
        fill="#fbeedd"
      />
      {/* 눈 */}
      {[46, 82].map((x) => (
        <g key={x}>
          <circle cx={x} cy="78" r="13.5" fill={`url(#${eye})`} />
          <circle cx={x - 4.5} cy="72.5" r="4.4" fill="#fff" />
          <circle cx={x + 4.5} cy="84" r="1.9" fill="#fff" />
          <circle cx={x + 2} cy="81" r="1.4" fill="#f5a04a" />
        </g>
      ))}
      {/* 볼 터치와 입 */}
      <ellipse cx="31" cy="93" rx="6.5" ry="3.6" fill="#f59a86" opacity="0.6" />
      <ellipse cx="97" cy="93" rx="6.5" ry="3.6" fill="#f59a86" opacity="0.6" />
      <path
        d="M59 94 Q64 98.5 69 94"
        fill="none"
        stroke="#2a1a12"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

import type { BuildingDesign } from '@/stores/workspaceStore'
import { cn } from '@/lib/utils'

const buildingDesigns: { value: BuildingDesign; label: string }[] = [
  { value: 'glass', label: '유리 오피스' },
  { value: 'brick', label: '붉은 벽돌' },
  { value: 'modern', label: '모던 화이트' },
  { value: 'tower', label: '다크 타워' },
  { value: 'wood', label: '목조 스튜디오' },
]

export function DesignIcon({
  design,
  className,
}: {
  design: BuildingDesign
  className?: string
}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className={className}>
      {design === 'glass' && (
        <>
          <rect
            x="12"
            y="8"
            width="24"
            height="34"
            rx="2"
            fill="#d6e8f1"
            stroke="#6f9db4"
            strokeWidth="2"
          />
          <path
            d="M12 18h24M12 28h24M24 8v34"
            stroke="#6f9db4"
            strokeWidth="1.5"
          />
        </>
      )}
      {design === 'brick' && (
        <>
          <rect
            x="10"
            y="14"
            width="28"
            height="28"
            rx="2"
            fill="#c96a4f"
            stroke="#8a3f2c"
            strokeWidth="2"
          />
          <g fill="#f3e3d3">
            <rect x="15" y="19" width="6" height="6" />
            <rect x="27" y="19" width="6" height="6" />
            <rect x="15" y="30" width="6" height="6" />
            <rect x="27" y="30" width="6" height="6" />
          </g>
        </>
      )}
      {design === 'modern' && (
        <>
          <rect
            x="12"
            y="10"
            width="24"
            height="32"
            rx="2"
            fill="#ffffff"
            stroke="#a3a3a3"
            strokeWidth="2"
          />
          <g fill="#d9e4ea">
            <rect x="16" y="15" width="6" height="5" />
            <rect x="26" y="15" width="6" height="5" />
            <rect x="16" y="24" width="6" height="5" />
            <rect x="26" y="24" width="6" height="5" />
          </g>
          <rect x="21" y="33" width="6" height="9" fill="#f3c530" />
        </>
      )}
      {design === 'tower' && (
        <>
          <rect
            x="16"
            y="4"
            width="16"
            height="38"
            rx="2"
            fill="#3f3f46"
            stroke="#18181b"
            strokeWidth="2"
          />
          <g fill="#f3c530">
            <rect x="20" y="10" width="3" height="3" />
            <rect x="25" y="16" width="3" height="3" />
            <rect x="20" y="24" width="3" height="3" />
            <rect x="25" y="31" width="3" height="3" />
          </g>
        </>
      )}
      {design === 'wood' && (
        <>
          <path
            d="M8 22 24 10l16 12"
            fill="none"
            stroke="#7a5532"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <rect
            x="12"
            y="22"
            width="24"
            height="20"
            rx="1"
            fill="#cfa577"
            stroke="#7a5532"
            strokeWidth="2"
          />
          <rect x="21" y="30" width="6" height="12" fill="#7a5532" />
        </>
      )}
    </svg>
  )
}

// 프로젝트 만들기와 설정 › 프로젝트 정보가 같이 쓰는 건물 디자인 카드 + 미리 보기.
export function BuildingDesignPicker({
  value,
  onChange,
}: {
  value: BuildingDesign
  onChange: (value: BuildingDesign) => void
}) {
  const label = buildingDesigns.find((item) => item.value === value)?.label
  return (
    <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
      <figure
        role="img"
        aria-label={`선택한 건물 미리 보기: ${label}`}
        className="grid place-items-center rounded-2xl bg-muted p-4"
      >
        <DesignIcon design={value} className="size-32" />
      </figure>
      <fieldset className="grid content-start gap-2">
        <legend className="mb-2 text-sm font-medium">건물 디자인</legend>
        <div className="grid grid-cols-3 gap-2">
          {buildingDesigns.map((item) => (
            <label
              key={item.value}
              className={cn(
                'grid cursor-pointer justify-items-center gap-1.5 rounded-xl border p-3 text-xs',
                value === item.value &&
                  'border-primary bg-primary/10 font-semibold',
              )}
            >
              <input
                type="radio"
                name="building-design"
                className="sr-only"
                checked={value === item.value}
                onChange={() => onChange(item.value)}
              />
              <DesignIcon design={item.value} className="size-10" />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

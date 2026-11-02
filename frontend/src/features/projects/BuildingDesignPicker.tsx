import { Check } from 'lucide-react'
import brickArt from '@/assets/buildings/brick.svg'
import glassArt from '@/assets/buildings/glass.svg'
import modernArt from '@/assets/buildings/modern.svg'
import towerArt from '@/assets/buildings/tower.svg'
import woodArt from '@/assets/buildings/wood.svg'
import type { BuildingDesign } from '@/stores/workspaceStore'
import { cn } from '@/lib/utils'

// 이름·색·설명·그림은 캔버스 SCR-04-v2-create-project 보드 그대로다.
const buildingDesigns: {
  value: BuildingDesign
  label: string
  color: string
  description: string
  art: string
}[] = [
  {
    value: 'glass',
    label: '유리 오피스',
    color: '#6f9db4',
    description: '유리 외벽 · 평지붕 · 옥상 설비',
    art: glassArt,
  },
  {
    value: 'brick',
    label: '붉은 벽돌',
    color: '#c4704f',
    description: '벽돌 외벽 · 흰 창틀 · 굴뚝',
    art: brickArt,
  },
  {
    value: 'modern',
    label: '모던 화이트',
    color: '#ebe7dc',
    description: '흰 외벽 · 가로 띠창 · 옥상 정원',
    art: modernArt,
  },
  {
    value: 'tower',
    label: '다크 타워',
    color: '#45454e',
    description: '짙은 외벽 · 높고 좁은 몸체 · 안테나',
    art: towerArt,
  },
  {
    value: 'wood',
    label: '목조 스튜디오',
    color: '#b98a52',
    description: '나무 외벽 · 박공지붕 · 큰 창',
    art: woodArt,
  },
]

const designOf = (value: BuildingDesign) =>
  buildingDesigns.find((item) => item.value === value) ?? buildingDesigns[2]

// 건물 그림(나의 도시 카드·프로젝트 만들기). 바닥에 붙여 세운다.
export function BuildingArt({
  design,
  className,
}: {
  design: BuildingDesign
  className?: string
}) {
  return (
    <img
      src={designOf(design).art}
      alt=""
      className={cn('block w-auto max-w-full', className)}
    />
  )
}

function DesignDot({ design, size }: { design: BuildingDesign; size: number }) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: designOf(design).color,
        // 모던 화이트는 흰 바탕에서 보이게 테두리를 둔다.
        boxShadow: design === 'modern' ? 'inset 0 0 0 1px #c9c3b3' : undefined,
      }}
    />
  )
}

function DesignIcon({
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
// detailed: 프로젝트 만들기 수정안(SCR-04-v2-create-project)의 큰 미리 보기와 그림·설명 카드.
// 설정 › 프로젝트 정보 보드는 아직 작은 그림 카드라 기본값은 그대로 둔다.
export function BuildingDesignPicker({
  value,
  onChange,
  detailed,
}: {
  value: BuildingDesign
  onChange: (value: BuildingDesign) => void
  detailed?: boolean
}) {
  const label = designOf(value).label
  if (detailed)
    return (
      <div className="grid gap-6 sm:grid-cols-[240px_minmax(0,1fr)]">
        <figure
          aria-label={`선택한 건물 미리 보기: ${label}`}
          className="m-0 grid content-center justify-items-center gap-2.5 rounded-2xl bg-[#f4f2ec] px-4 py-5"
        >
          <BuildingArt design={value} className="h-[196px]" />
          <figcaption className="grid justify-items-center gap-0.5 text-center">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold">
              <DesignDot design={value} size={9} />
              {label}
            </span>
            <span className="text-xs leading-[17px] text-[#6b6658]">
              {designOf(value).description}
            </span>
          </figcaption>
        </figure>
        <fieldset className="grid content-start gap-2.5">
          <legend className="mb-2.5 text-sm font-medium">건물 디자인</legend>
          <div className="grid grid-cols-3 gap-2.5">
            {buildingDesigns.map((item) => {
              const checked = value === item.value
              return (
                <label
                  key={item.value}
                  className={cn(
                    'relative grid cursor-pointer gap-1.5 rounded-[14px] border border-border bg-white px-2 pt-2 pb-2.5 has-focus-visible:ring-2 has-focus-visible:ring-ring',
                    checked &&
                      'border-2 border-[#c99e1e] bg-[#fffaeb] px-[7px] pt-[7px] pb-[9px]',
                  )}
                >
                  <input
                    type="radio"
                    name="building-design"
                    className="sr-only"
                    checked={checked}
                    onChange={() => onChange(item.value)}
                  />
                  <span
                    className={cn(
                      'flex h-[70px] items-end justify-center overflow-hidden rounded-[10px] bg-[#f6f3ea]',
                      checked && 'bg-[#fdf3cf]',
                    )}
                  >
                    <BuildingArt design={item.value} className="h-[62px]" />
                  </span>
                  <span
                    className={cn(
                      'flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold',
                      checked && 'font-bold',
                    )}
                  >
                    <DesignDot design={item.value} size={8} />
                    {item.label}
                  </span>
                  <span className="text-[11.5px] leading-[15px] break-keep text-[#6b6658]">
                    {item.description}
                  </span>
                  {checked && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"
                    >
                      <Check className="size-3" strokeWidth={3.5} />
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </fieldset>
      </div>
    )
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

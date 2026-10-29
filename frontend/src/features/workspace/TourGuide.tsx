import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type TourMode = 'welcome' | 'map' | number | null

const steps = [
  {
    target: 'office',
    title: '3D 사무실',
    body: '바닥을 누르거나 WASD·방향키로 걸어요. 왼쪽 아래에서 1인칭·3인칭을 바꾸고, 이름표 가까이에서 Enter를 누르면 그 자리의 메뉴가 열려요.',
  },
  {
    target: 'card',
    title: '프로젝트 카드',
    body: '프로젝트 이름과 내 역할, 처리할 숫자, 팀 줄이 있어요. ← 버튼으로 나의 도시로 돌아가요.',
  },
  {
    target: 'hotbar',
    title: '단축 바',
    body: '메뉴 6개를 숫자 키 1~6으로도 열어요. 빨간 숫자는 처리할 일이에요. 팀 관리와 에이전트는 설정에 있어요.',
  },
  {
    target: 'todo',
    title: '지금 할 일',
    body: '처음에는 역할별 시작 가이드가 이 자리에 떠요. 가이드를 마치면 지금 할 일 목록으로 바뀌어요.',
  },
  {
    target: 'top',
    title: '알림 · 설정',
    body: '벨은 숫자 배지와 아래로 열리는 알림 목록이에요. 톱니는 팀 관리와 에이전트 설정이에요.',
  },
  {
    target: 'bibi',
    title: '비비',
    body: '비비는 프로젝트 챗봇이에요. 공용 문서와 승인 설계에서 근거를 찾아 출처와 함께 답해요.',
  },
] as const

const rectOf = (target: string) =>
  document.querySelector(`[data-tour="${target}"]`)?.getBoundingClientRect()

// 설명 상자는 영역 바깥쪽(아래, 자리가 없으면 위)에 두어 영역을 가리지 않는다.
function besideStyle(rect: DOMRect | undefined, width: number): CSSProperties {
  if (!rect)
    return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  const left = Math.min(
    Math.max(16, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - width - 16,
  )
  if (rect.height > window.innerHeight * 0.7)
    return { top: '50%', left, transform: 'translateY(-50%)', width }
  return rect.bottom + 200 < window.innerHeight
    ? { top: rect.bottom + 12, left, width }
    : { bottom: window.innerHeight - rect.top + 12, left, width }
}

// 공용 가이드: 환영 → 둘러보기 1~6 → ? 키 화면 안내. 팀장·팀원 모두 같다.
// API 없음: 봤는지를 계정 기준으로 서버에 저장하는 필드가 없어 이 브라우저에만 남긴다(백엔드 메모 1).
export function TourGuide({
  accountId,
  mode,
  onChange,
}: {
  accountId?: string
  mode: TourMode
  onChange: (mode: TourMode) => void
}) {
  const [, setSize] = useState(0)
  useEffect(() => {
    const resize = () => setSize((value) => value + 1)
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        !!target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (event.key === '?' && !typing) {
        event.preventDefault()
        onChange(mode === 'map' ? null : 'map')
      }
      if (event.key === 'Escape' && mode !== null) onChange(null)
    }
    window.addEventListener('resize', resize)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', key)
    }
  }, [mode, onChange])
  const finish = () => {
    try {
      if (accountId) localStorage.setItem(`beez.tour.${accountId}`, 'seen')
    } catch {
      /* 저장소가 없어도 가이드는 그대로 닫는다. */
    }
    onChange(null)
  }
  if (mode === null) return null
  if (mode === 'welcome')
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-welcome-title"
          className="grid w-full max-w-md gap-4 rounded-2xl bg-card p-6 shadow-2xl"
        >
          <h2 id="tour-welcome-title" className="text-xl font-bold">
            우리 팀 사무실에 오신 걸 환영해요
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            팀원과 에이전트가 같은 승인 설계를 보고 일하는 3D 사무실이에요.
            1분이면 화면을 둘러볼 수 있어요.
          </p>
          <div className="rounded-xl bg-muted/50 p-4 text-sm">
            <p className="font-semibold">
              프로젝트는 문서 초안 4종을 올리면서 시작해요
            </p>
            <p className="mt-1 text-muted-foreground">
              기획안 · ERD · 요구사항 명세서 · API 명세서
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={finish}>
              건너뛰고 바로 시작하기
            </Button>
            <Button autoFocus onClick={() => onChange(0)}>
              1분 둘러보기
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            언제든 ? 키로 화면 안내를 다시 볼 수 있어요.
          </p>
        </section>
      </div>
    )
  if (mode === 'map')
    return (
      <div className="fixed inset-0 z-50 bg-black/55">
        {steps.map((step, index) => {
          const rect = rectOf(step.target)
          if (!rect) return null
          return (
            <div key={step.target}>
              <div
                aria-hidden="true"
                className="absolute rounded-2xl ring-2 ring-primary"
                style={{
                  top: rect.top - 4,
                  left: rect.left - 4,
                  width: rect.width + 8,
                  height: rect.height + 8,
                }}
              />
              <p
                className="absolute rounded-xl bg-card px-3 py-2 text-xs shadow-lg"
                style={besideStyle(rect, 220)}
              >
                <strong className="mr-1 inline-grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                  {index + 1}
                </strong>
                <strong>{step.title}</strong> · {step.body.split('.')[0]}
              </p>
            </div>
          )
        })}
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-map-title"
          className="absolute top-1/2 left-1/2 grid w-72 -translate-x-1/2 -translate-y-1/2 gap-3 rounded-2xl bg-card p-4 shadow-2xl"
        >
          <h2 id="tour-map-title" className="font-bold">
            화면 안내
          </h2>
          <p className="text-xs text-muted-foreground">
            번호는 둘러보기 단계와 같아요. ?나 Esc로 닫아요.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
              닫기
            </Button>
            <Button size="sm" autoFocus onClick={() => onChange('welcome')}>
              처음부터 둘러보기
            </Button>
          </div>
        </section>
      </div>
    )
  const step = steps[mode]
  const rect = rectOf(step.target)
  const last = mode === steps.length - 1
  return (
    <div className="fixed inset-0 z-50">
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-2xl ring-2 ring-primary"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(20, 18, 12, 0.55)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-black/55" />
      )}
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        className="absolute grid gap-3 rounded-2xl bg-card p-4 shadow-2xl"
        style={besideStyle(rect, 320)}
      >
        <p className="text-xs font-semibold text-muted-foreground">
          둘러보기 {mode + 1}/{steps.length}
        </p>
        <h2 id="tour-step-title" className="font-bold">
          {step.title}
        </h2>
        <p className="text-sm leading-6">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="flex gap-1" aria-hidden="true">
            {steps.map((item, index) => (
              <span
                key={item.target}
                className={cn(
                  'size-1.5 rounded-full bg-muted-foreground/30',
                  index === mode && 'bg-foreground',
                )}
              />
            ))}
          </span>
          <span className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={finish}>
              건너뛰기
            </Button>
            {mode > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChange(mode - 1)}
              >
                이전
              </Button>
            )}
            <Button
              size="sm"
              autoFocus
              onClick={() => (last ? finish() : onChange(mode + 1))}
            >
              {last ? '시작하기' : '다음'}
            </Button>
          </span>
        </div>
      </section>
    </div>
  )
}

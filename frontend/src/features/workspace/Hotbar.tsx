import { useEffect } from 'react'
import {
  CheckCheck,
  ChartNoAxesCombined,
  FileText,
  GitBranch,
  Lock,
  Network,
  Users,
} from 'lucide-react'
import { BibiFace } from '@/components/BibiFace'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { WorkspacePane } from '@/stores/workspaceStore'

const hotbarSlots = [
  { pane: 'documents', label: '공용 문서함', icon: FileText },
  { pane: 'changes', label: '변경 제안', icon: GitBranch },
  { pane: 'meetings', label: '회의실', icon: Users },
  { pane: 'tasks', label: '작업 현황', icon: CheckCheck },
  { pane: 'relations', label: '설계 관계', icon: Network },
  { pane: 'dashboard', label: '대시보드', icon: ChartNoAxesCombined },
] satisfies { pane: WorkspacePane; label: string; icon: typeof FileText }[]

export function Hotbar({
  locked,
  badges,
  highlight,
  lockedReason = '문서 4종을 올리면 열려요',
}: {
  /** 프로젝트가 시작되기 전에 잠그는 칸 */
  locked: WorkspacePane[]
  /** 잠긴 칸을 눌렀을 때 알려 줄 이유 */
  lockedReason?: string
  badges: Partial<Record<WorkspacePane, number>>
  /** '여기부터 시작' 표시를 붙일 칸 */
  highlight?: WorkspacePane
}) {
  const pane = useWorkspaceStore((state) => state.pane)
  const openPane = useWorkspaceStore((state) => state.openPane)
  // 숫자 키 1~6으로 칸을 연다. 입력 중이거나 창이 열려 있으면 무시한다.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        pane ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        target?.closest('input, textarea, select, [contenteditable="true"]')
      )
        return
      const slot = hotbarSlots[Number(event.key) - 1]
      if (slot && !locked.includes(slot.pane)) openPane(slot.pane)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pane, locked, openPane])
  const slot = (item: (typeof hotbarSlots)[number], index: number) => {
    const isLocked = locked.includes(item.pane)
    const badge = badges[item.pane]
    return (
      <button
        key={item.pane}
        type="button"
        aria-label={item.label}
        aria-disabled={isLocked || undefined}
        title={isLocked ? lockedReason : undefined}
        onClick={() => !isLocked && openPane(item.pane)}
        className={cn(
          'relative grid size-19 content-center justify-items-center gap-1.5 rounded-2xl border bg-muted/40 text-xs font-semibold whitespace-nowrap transition hover:bg-muted',
          pane === item.pane && 'border-foreground bg-muted',
          isLocked && 'cursor-not-allowed opacity-45 hover:bg-muted/40',
          highlight === item.pane && 'ring-2 ring-primary',
        )}
      >
        <span className="absolute top-1 left-2 text-[10px] font-semibold text-muted-foreground">
          {index + 1}
        </span>
        {highlight === item.pane && (
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
            여기부터 시작
          </span>
        )}
        {badge ? (
          <span
            aria-label={`새 항목 ${badge}개`}
            className="absolute -top-1.5 -right-1.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white"
          >
            {badge}
          </span>
        ) : null}
        {isLocked ? (
          <Lock className="size-6" />
        ) : (
          <item.icon className="size-6" />
        )}
        {item.label}
      </button>
    )
  }
  return (
    <nav
      aria-label="프로젝트 메뉴 단축 바"
      data-tour="hotbar"
      className="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-3xl border bg-card/95 p-2 shadow-lg backdrop-blur"
    >
      {hotbarSlots.slice(0, 3).map(slot)}
      <button
        type="button"
        aria-label="비비와 대화"
        data-tour="bibi"
        aria-pressed={pane === 'chat'}
        onClick={() => openPane(pane === 'chat' ? null : 'chat')}
        className="relative mx-2 grid w-26 justify-items-center gap-1 text-xs font-bold"
      >
        <span className="-mt-11 grid size-23 place-items-center rounded-full bg-white shadow-[0_0_0_3px_var(--primary),0_10px_18px_-6px_rgb(0_0_0/0.3)]">
          <BibiFace className="size-21" />
        </span>
        비비
      </button>
      {hotbarSlots.slice(3).map((item, index) => slot(item, index + 3))}
    </nav>
  )
}

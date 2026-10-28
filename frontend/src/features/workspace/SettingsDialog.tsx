import { Link } from 'react-router'
import { useIsMutating } from '@tanstack/react-query'
import { AgentsPanel } from '@/features/agents/AgentsPanel'
import { TeamPanel } from '@/features/members/TeamPanel'
import type { TeamView } from '@/features/members/TeamPanel'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspaceStore'

type Section = TeamView | 'agent'

// 오른쪽 위 톱니로 여는 설정 창. 팀 관리·에이전트·프로젝트 정보를 한곳에 모았다.
export function SettingsDialog({
  projectId,
  isLeader,
  agentConnected,
}: {
  projectId: string
  isLeader: boolean
  agentConnected: boolean
}) {
  const pane = useWorkspaceStore((state) => state.pane)
  const focusId = useWorkspaceStore((state) => state.focusId)
  const openPane = useWorkspaceStore((state) => state.openPane)
  const pending = useIsMutating()
  const section: Section =
    focusId === 'project' && isLeader
      ? 'project'
      : focusId === 'agent' || focusId === 'remove'
        ? focusId
        : 'team'
  const go = (next: Section) => openPane('settings', next)
  const item = (value: Section, label: string, extra?: string) => (
    <button
      type="button"
      aria-current={section === value ? 'page' : undefined}
      onClick={() => go(value)}
      className={cn(
        'flex h-9 items-center justify-between rounded-lg px-3 text-left text-sm font-medium hover:bg-muted',
        section === value && 'bg-muted font-semibold',
        value === 'remove' && 'text-destructive',
      )}
    >
      {label}
      {extra && (
        <span className="text-[11px] font-semibold text-muted-foreground">
          {extra}
        </span>
      )}
    </button>
  )
  return (
    <Dialog
      open={pane === 'settings'}
      onOpenChange={(open) => {
        if (!open && !pending) openPane(null)
      }}
    >
      <DialogContent className="grid h-[min(680px,90dvh)] grid-cols-[220px_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[min(1040px,94vw)]">
        <nav
          aria-label="설정 메뉴"
          className="flex flex-col gap-5 border-r bg-muted/30 px-3 py-6"
        >
          <DialogTitle className="px-3 text-xl font-bold">설정</DialogTitle>
          <div className="grid gap-0.5">
            <p className="mb-1 flex justify-between px-3 text-[11px] font-bold text-muted-foreground">
              프로젝트 설정
              {isLeader && <span className="font-semibold">팀장만</span>}
            </p>
            {isLeader && item('project', '프로젝트 정보')}
            {item('team', '팀')}
          </div>
          <div className="grid gap-0.5">
            <p className="mb-1 px-3 text-[11px] font-bold text-muted-foreground">
              내 설정
            </p>
            {item(
              'agent',
              '에이전트',
              agentConnected ? '연결됨' : '연결 미확인',
            )}
            {item('remove', isLeader ? '프로젝트 제거' : '프로젝트 나가기')}
          </div>
          <div className="grid gap-0.5">
            <p className="mb-1 px-3 text-[11px] font-bold text-muted-foreground">
              계정
            </p>
            <Link
              to="/account"
              className="flex h-9 items-center justify-between rounded-lg px-3 text-sm font-medium hover:bg-muted"
            >
              회원 설정
              <span className="text-[11px] text-muted-foreground">↗</span>
            </Link>
          </div>
        </nav>
        <div className="min-w-0 overflow-y-auto px-8 py-7">
          {section === 'agent' ? (
            <AgentsPanel projectId={projectId} />
          ) : (
            <TeamPanel
              key={section}
              projectId={projectId}
              isLeader={isLeader}
              view={section}
              onViewChange={go}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useIsMutating, useQuery } from '@tanstack/react-query'
import { Footprints } from 'lucide-react'
import { agentsApi, membersApi, projectsApi, tasksApi } from '@/api/services'
import type { SceneAgent, SceneTask } from '@/three/types'
import { RequireAccount } from '@/features/auth/RequireAccount'
import { useSession } from '@/features/auth/useSession'
import { DocumentsPanel } from '@/features/documents/DocumentsPanel'
import { PlanningPanel } from '@/features/planning/PlanningPanel'
import { ChangesPanel } from '@/features/changes/ChangesPanel'
import { TasksPanel } from '@/features/tasks/TasksPanel'
import { MeetingsPanel } from '@/features/meetings/MeetingsPanel'
import { ActivityPanel } from '@/features/dashboard/ActivityPanel'
import { InboxPanel } from '@/features/inbox/InboxPanel'
import { BibiPanel } from '@/features/bee/BibiPanel'
import { ContextPanel } from '@/features/contexts/ContextPanel'
import { WorkspaceHud } from '@/features/workspace/WorkspaceHud'
import { SettingsDialog } from '@/features/workspace/SettingsDialog'
import { AsyncState } from '@/components/AsyncState'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { WorkspacePane } from '@/stores/workspaceStore'

const OfficeScene = lazy(() => import('@/three/OfficeScene'))
const paneTitles: Record<Exclude<WorkspacePane, 'settings'>, string> = {
  documents: '공용 문서함',
  planning: '기획 분석',
  changes: '변경 제안',
  meetings: '회의실',
  tasks: '작업 현황',
  relations: '작업·설계 관계',
  dashboard: '대시보드',
  inbox: '알림함',
  chat: '비비',
  context: '작업 맥락',
}

function Workspace({ projectId }: { projectId: string }) {
  const sceneHost = useRef<HTMLElement>(null)
  const focusScene = () =>
    sceneHost.current?.querySelector('canvas')?.focus({ preventScroll: true })
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const pane = useWorkspaceStore((state) => state.pane)
  const tinted =
    pane === 'tasks' || pane === 'relations' || pane === 'dashboard'
  const openPane = useWorkspaceStore((state) => state.openPane)
  const viewMode = useWorkspaceStore((state) => state.viewMode)
  const setViewMode = useWorkspaceStore((state) => state.setViewMode)
  const outdoor = useWorkspaceStore((state) => state.outdoor)
  const setOutdoor = useWorkspaceStore((state) => state.setOutdoor)
  const pendingMutations = useIsMutating()
  // 회원 탈퇴 화면의 '팀장 위임'처럼 ?settings=team으로 들어오면 설정 창을 연다.
  const settingsParam = params.get('settings')
  useEffect(() => {
    if (!settingsParam) return
    openPane('settings', settingsParam)
    setParams({}, { replace: true })
  }, [settingsParam, openPane, setParams])
  const query = useQuery({
    queryKey: ['projects', projectId, 'scene'],
    queryFn: async () => {
      const [project, members, agents, tasks, onboarding] = await Promise.all([
        projectsApi.get(projectId),
        membersApi.list(projectId),
        agentsApi.list(projectId),
        tasksApi.list(projectId, { limit: 100 }),
        projectsApi.onboarding(projectId),
      ])
      return { project, members, agents, tasks, onboarding }
    },
  })
  const sceneAgents = useMemo<SceneAgent[]>(
    () => [
      { id: 'bibi', name: '비비', kind: 'lead', color: '#f5b800' },
      ...(query.data?.members.items ?? []).map((member) => ({
        id: `member:${member.id}`,
        name: member.name,
        kind:
          member.account_id === session.data?.id
            ? ('human' as const)
            : ('agent' as const),
        color: member.color ?? '#8ca9a0',
        status: 'idle',
      })),
    ],
    [query.data?.members, session.data?.id],
  )
  const sceneTasks = useMemo<SceneTask[]>(
    () =>
      (query.data?.tasks.items ?? []).map((task) => ({
        id: task.id,
        title: task.current_plan_revision.plan.title,
        state: task.status,
        assignee_id: `member:${task.assignee_member_id}`,
        description: task.current_plan_revision.plan.goal,
        waiting_reason: task.waiting_reason,
      })),
    [query.data?.tasks],
  )
  return (
    <AsyncState query={query}>
      {(data) => {
        const isLeader = data.project.my_role === 'LEADER'
        const currentUser = data.members.items.find(
          (member) => member.account_id === session.data?.id,
        )
        const panelProps = { projectId, isLeader }
        return (
          <main
            ref={sceneHost}
            data-tour="office"
            className="relative h-dvh min-h-[620px] overflow-hidden bg-muted/30"
            aria-label="프로젝트 워크스페이스"
          >
            <Suspense
              fallback={
                <p role="status" className="grid h-full place-items-center">
                  3D 사무실을 준비하는 중…
                </p>
              }
            >
              <OfficeScene
                key={projectId}
                project={data.project}
                agents={sceneAgents}
                tasks={sceneTasks}
                currentUserId={
                  currentUser ? `member:${currentUser.id}` : undefined
                }
                viewMode={viewMode}
                outdoor={outdoor}
                interactive={pane === null}
                phase={data.project.current_baseline ? 4 : 3}
                onOutdoorChange={setOutdoor}
                onAgentSelect={(id) =>
                  id === 'bibi' || id.includes('reception')
                    ? openPane('chat', id)
                    : openPane('settings', 'team')
                }
                onTaskSelect={(id) => openPane('tasks', id)}
                className="absolute inset-0 h-full w-full"
              />
            </Suspense>
            <WorkspaceHud
              project={data.project}
              members={data.members.items}
              me={currentUser}
              onboarding={data.onboarding}
              tasks={data.tasks.items}
              myTasks={data.tasks.items.filter(
                (task) => task.assignee_member_id === currentUser?.id,
              )}
            />
            <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
              <div className="rounded-xl border bg-card/95 p-1 shadow-sm">
                <Button
                  size="sm"
                  variant={viewMode === 'first' ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setViewMode('first')
                    focusScene()
                  }}
                >
                  1인칭
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'third' ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setViewMode('third')
                    focusScene()
                  }}
                >
                  3인칭
                </Button>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setOutdoor(!outdoor)
                  focusScene()
                }}
              >
                <Footprints />
                {outdoor ? '사무실로' : '산책'}
              </Button>
            </div>
            {/* 조작 안내는 처음(기준 v1 전)에만 보여 준다. */}
            {!pane && !data.project.current_baseline && (
              <p className="pointer-events-none absolute bottom-17 left-4 z-10 rounded-lg bg-card/90 px-3 py-2 text-[11px] text-muted-foreground">
                WASD 이동 · Shift 달리기 · 드래그로 둘러보기 · 숫자 키로 메뉴
                열기
              </p>
            )}
            <SettingsDialog
              projectId={projectId}
              isLeader={isLeader}
              agentConnected={data.onboarding.my_agent_connected}
            />
            <Dialog
              open={pane !== null && pane !== 'settings'}
              onOpenChange={(open) => {
                if (!open && !pendingMutations) openPane(null)
              }}
            >
              <DialogContent
                className={cn(
                  'max-h-[87dvh] overflow-y-auto bg-background p-5 sm:p-8',
                  // 작업 현황·설계 관계·대시보드: 창 바탕은 연회색, 머리는 흰 띠, 칸은 흰 카드(PNL-05·09 수정안 10-29)
                  tinted && 'bg-[#f7f8fa]',
                  pane === 'chat'
                    ? 'sm:max-w-[min(1080px,94vw)]'
                    : pane === 'documents'
                      ? // 공용 문서함 모달안: 1100px × 90vh 고정, 본문만 안에서 스크롤
                        'h-[90dvh] max-h-[90dvh] content-start sm:max-w-[min(1100px,94vw)]'
                      : 'sm:max-w-[min(1180px,94vw)]',
                )}
                onEscapeKeyDown={(event) => {
                  if (pendingMutations) event.preventDefault()
                }}
                onInteractOutside={(event) => {
                  if (pendingMutations) event.preventDefault()
                }}
              >
                <DialogHeader
                  className={
                    tinted
                      ? '-mx-5 -mt-5 border-b bg-card px-5 py-4 sm:-mx-8 sm:-mt-8 sm:px-8 sm:py-5'
                      : undefined
                  }
                >
                  <DialogTitle>
                    {pane && pane !== 'settings' ? paneTitles[pane] : ''}
                  </DialogTitle>
                  {/* 공용 문서함은 머리 부제목 없이 제목만(PNL-02-v2 10-29 부제목 제거). */}
                  <DialogDescription
                    className={pane === 'documents' ? 'sr-only' : undefined}
                  >
                    {data.project.name}
                  </DialogDescription>
                </DialogHeader>
                <div key={`${projectId}:${pane}`} className="mt-4 min-w-0">
                  {pane === 'documents' && <DocumentsPanel {...panelProps} />}
                  {pane === 'planning' && <PlanningPanel {...panelProps} />}
                  {pane === 'changes' && <ChangesPanel {...panelProps} />}
                  {pane === 'tasks' && <TasksPanel {...panelProps} />}
                  {pane === 'meetings' && <MeetingsPanel {...panelProps} />}
                  {pane === 'relations' && (
                    <ActivityPanel projectId={projectId} view="relations" />
                  )}
                  {pane === 'dashboard' && (
                    <ActivityPanel projectId={projectId} view="dashboard" />
                  )}
                  {pane === 'inbox' && <InboxPanel projectId={projectId} />}
                  {pane === 'chat' && <BibiPanel projectId={projectId} />}
                  {pane === 'context' && <ContextPanel projectId={projectId} />}
                </div>
              </DialogContent>
            </Dialog>
          </main>
        )
      }}
    </AsyncState>
  )
}

export default function WorkspacePage() {
  const { projectId = '' } = useParams()
  return (
    <RequireAccount>
      <Workspace key={projectId} projectId={projectId} />
    </RequireAccount>
  )
}

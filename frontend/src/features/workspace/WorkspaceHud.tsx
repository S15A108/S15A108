import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronLeft, CircleHelp, Lock, Settings } from 'lucide-react'
import { dashboardApi, documentsApi, inboxApi } from '@/api/services'
import type { Member } from '@/api/contracts/common'
import type { GetResponse as Project } from '@/features/projects/schemas'
import type { OnboardingResponse } from '@/features/projects/schemas'
import { useProjectStart } from '@/features/projects/useProjectStart'
import { InboxPopover } from '@/features/inbox/InboxPopover'
import { Toast } from '@/components/Toast'
import { Hotbar } from './Hotbar'
import { TourGuide } from './TourGuide'
import type { TourMode } from './TourGuide'
import { Button } from '@/components/ui/button'
import { statusLabel } from '@/lib/display'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { WorkspacePane } from '@/stores/workspaceStore'

// 가이드 숨김·'기준 설계 읽기' 체크는 브라우저에만 둔다.
// API 없음: 가이드 상태(봤음·숨김·완료)를 계정·프로젝트별로 서버에 저장하는 필드.
const guideKey = (projectId: string, name: string) =>
  `beez.guide.${projectId}.${name}`
const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
const writeFlag = (key: string) => {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만 기억한다.
  }
}
const readStage = (key: string) => {
  try {
    const value = localStorage.getItem(key)
    return value === null ? null : Number(value)
  } catch {
    return null
  }
}

const REQUIRED = ['PLAN', 'ERD', 'REQUIREMENTS', 'API_SPEC']
// 준비 중(0) → 4종 올림(1) → 4종 승인(2) → 프로젝트 시작(3). 단계가 오르면 위에 한 번 알린다.
const notices: Record<
  number,
  { title: string; text: string; member?: string }
> = {
  1: {
    title: '문서 4종이 모두 올라왔어요',
    text: '비비 검토 → 팀장 승인을 거쳐 4종이 승인되면 프로젝트를 시작할 수 있어요.',
  },
  2: {
    title: '문서 4종이 모두 승인됐어요',
    text: "색인이 끝나면 가이드의 '프로젝트 시작'을 눌러 기준 v1을 만들고 프로젝트를 시작해요.",
    member: '팀장이 프로젝트를 시작하면 알려 드려요.',
  },
  3: {
    title: '기준 v1이 생겼어요 · 프로젝트가 시작됐어요',
    text: '이제 변경 제안, 회의실, 작업 현황, 설계 관계를 쓸 수 있어요. 문서 수정도 이제 변경 제안으로 해요.',
  },
}
const leaderBubbles = [
  "문서 초안 4종을 올려 주세요. 하나씩 올려 주면 바로 검토할게요. 4종이 승인되면 '프로젝트 시작'을 눌러 주세요.",
  '4종 모두 받았어요! 지금 검토하고 있어요. 고칠 곳은 문서함에 표시해 둘게요.',
  "문서 4종이 모두 승인됐어요! 가이드에서 '프로젝트 시작'을 눌러 주세요.",
  '프로젝트가 시작됐어요! 이제 고칠 곳이 보이면 변경 제안으로 올릴게요. 팀원을 초대해 보세요.',
]

type Step = {
  title: string
  detail: string
  done: boolean
  locked?: boolean
  optional?: boolean
  action?: {
    label: string
    pane?: WorkspacePane
    focus?: string
    run?: () => void
    disabled?: boolean
  }
  note?: string
  children?: ReactNode
}

export function WorkspaceHud({
  project,
  members,
  me,
  onboarding,
  myTasks,
}: {
  project: Project
  members: Member[]
  me?: Member
  onboarding: OnboardingResponse
  myTasks: { status: string; validation_status: string }[]
}) {
  const navigate = useNavigate()
  const openPane = useWorkspaceStore((state) => state.openPane)
  const pane = useWorkspaceStore((state) => state.pane)
  const setOutdoor = useWorkspaceStore((state) => state.setOutdoor)
  const isLeader = project.my_role === 'LEADER'
  const started = onboarding.baseline_published
  const counts = useQuery({
    queryKey: ['projects', project.id, 'hud'],
    queryFn: async () => {
      const [documents, changes, tasks] = await Promise.all([
        dashboardApi.documents(project.id),
        dashboardApi.changes(project.id),
        dashboardApi.tasks(project.id),
      ])
      return { documents, changes, tasks }
    },
  })
  // 팀장 시작 가이드: 문서별 승인 요청(DOC-A19)과 프로젝트 시작(PLN-A10)
  const submitted = useQuery({
    queryKey: ['projects', project.id, 'document-submissions', 'SUBMITTED'],
    queryFn: () =>
      documentsApi.reviewSubmissions(project.id, { status: 'SUBMITTED' }),
    enabled: isLeader && !started,
  })
  const start = useProjectStart(project.id, isLeader && !started)
  const pendingApprovals = submitted.data?.length ?? 0
  const approvedKinds =
    counts.data?.documents.by_kind.filter(
      (item) => REQUIRED.includes(item.kind) && item.approved_count > 0,
    ).length ?? 0
  const unread = useQuery({
    queryKey: ['notifications', project.id, 'unread'],
    queryFn: () =>
      inboxApi.list({ project_id: project.id, unread: true, limit: 20 }),
  })
  const [, rerender] = useState(0)
  // 워크스페이스에 처음 들어오면 환영 창을 한 번 띄운다. 다시 보기는 ? 키와 도움말 버튼.
  const [tour, setTour] = useState<TourMode>(() => {
    try {
      return me && !localStorage.getItem(`beez.tour.${me.account_id}`)
        ? 'welcome'
        : null
    } catch {
      return null
    }
  })
  const hiddenKey = guideKey(project.id, isLeader ? 'leader' : 'member')
  const readKey = guideKey(project.id, 'baseline-read')
  const uploaded = onboarding.required_documents.filter(
    (item) => item.uploaded,
  ).length
  const allUploaded = uploaded === onboarding.required_documents.length
  const allApproved = approvedKinds >= 4
  // 단계를 처음 본 브라우저에서는 알리지 않고, 이전에 본 단계보다 올라갔을 때만 알린다.
  const stage = started
    ? 3
    : !allUploaded
      ? 0
      : counts.isSuccess
        ? allApproved
          ? 2
          : 1
        : null
  const stageKey = `beez.stage.${project.id}`
  const [seenStage] = useState(() => readStage(stageKey))
  useEffect(() => {
    if (stage === null) return
    try {
      localStorage.setItem(stageKey, String(stage))
    } catch {
      /* 저장소가 없으면 알림을 한 번 더 띄울 수 있을 뿐이다. */
    }
  }, [stage, stageKey])
  const notice =
    stage !== null && seenStage !== null && stage > seenStage
      ? notices[stage]
      : undefined
  const leaderSteps: Step[] = [
    {
      title: '문서 초안 4종 올리기',
      detail: allUploaded
        ? `${uploaded} / 4 올림`
        : '초안이어도 괜찮아요. 올리면 비비가 바로 검토해요.',
      done: allUploaded,
      children: (
        <ul className="mt-2 grid gap-1">
          {onboarding.required_documents.map((item) => (
            <li
              key={item.kind}
              className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs"
            >
              <span className="flex items-center gap-1.5">
                {item.uploaded && <Check className="size-3.5 text-green-700" />}
                {statusLabel(item.kind)}
              </span>
              {!item.uploaded && (
                <button
                  type="button"
                  className="font-semibold underline"
                  aria-label={`${statusLabel(item.kind)} 올리기`}
                  onClick={() => openPane('documents', `upload:${item.kind}`)}
                >
                  올리기
                </button>
              )}
            </li>
          ))}
          <li className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            {uploaded} / 4 올림
            <Button
              size="xs"
              variant="outline"
              onClick={() => openPane('documents')}
            >
              공용 문서함 열기
            </Button>
          </li>
          <li className="text-[11px] text-muted-foreground">
            변경 제안 · 회의실 · 작업 현황 · 설계 관계는 프로젝트를 시작하면
            열려요
          </li>
        </ul>
      ),
    },
    {
      title: '비비 검토 반영하기',
      detail: !allUploaded
        ? '4종이 다 올라가면 열려요.'
        : allApproved || started
          ? '4종 모두 검토를 반영했어요.'
          : '비비가 4종을 검토해요. 고칠 곳은 공용 문서함에 표시해 둬요.',
      done: allApproved || started,
      locked: !allUploaded,
      action: { label: '검토 결과 보기', pane: 'documents' },
    },
    {
      title: '4종 승인하고 프로젝트 시작',
      detail: started
        ? '프로젝트를 시작했어요.'
        : allApproved
          ? `문서 4종 승인 4 / 4 · ${start.indexed ? '색인 완료' : '문서 색인 중이에요'}`
          : `팀장 승인 ${approvedKinds} / 4${pendingApprovals ? ` · 승인 요청 ${pendingApprovals}건` : ''} · 팀장이 4종을 승인하고 색인이 끝나면 '프로젝트 시작'이 켜져요. 누르면 기준 v1이 생기고 프로젝트가 시작돼요.`,
      done: started,
      locked: !allUploaded,
      action: pendingApprovals
        ? { label: '승인 요청 보기', pane: 'documents' }
        : allApproved
          ? {
              label: '프로젝트 시작',
              run: () => void start.start().catch(() => undefined),
              disabled: !start.ready || start.busy,
            }
          : { label: '문서함 보기', pane: 'documents' },
      note: start.error
        ? start.error
        : allApproved
          ? '시작하면 변경 제안과 작업 계획을 받을 수 있어요'
          : undefined,
    },
    {
      title: '팀원 초대하기',
      detail: started
        ? '선택 · 팀원을 부르면 같이 작업 계획을 올릴 수 있어요.'
        : '선택 · 언제든 할 수 있어요.',
      done: onboarding.member_count > 1,
      optional: true,
      action: {
        label: started ? '팀원 초대하기' : '초대하기',
        pane: 'settings',
        focus: 'team',
      },
    },
  ]
  const memberSteps: Step[] = [
    {
      title: '팀 참여',
      detail: `${project.name}에 참여했어요.`,
      done: true,
    },
    {
      title: '내 담당 영역 확인',
      detail: me?.domain
        ? `${me.domain} (팀장이 정해요)`
        : '담당 영역은 팀장이 정해요. 아직 정해지지 않았어요.',
      done: Boolean(me?.domain),
    },
    {
      title: '내 에이전트 연결하기',
      detail:
        '설정 › 에이전트에서 토큰을 발급하고 Claude Code에 BEEZ MCP를 추가해요.',
      done: onboarding.my_agent_connected,
      action: { label: '설정에서 연결하기', pane: 'settings', focus: 'agent' },
    },
    {
      title: '기준 문서 v1 읽기',
      detail: started
        ? '팀장이 승인한 문서 4종을 확인해요.'
        : '팀장이 프로젝트를 시작하면 열려요.',
      // API 없음: 읽었는지 기록하는 API가 없어 직접 체크한다.
      done: readFlag(readKey),
      locked: !started,
      action: { label: '공용 문서함에서 보기', pane: 'documents' },
    },
    {
      title: '첫 작업 계획 등록하기',
      detail: started
        ? '기준 설계에 맞춰 내 작업 계획을 올려요.'
        : '프로젝트를 시작한 뒤에 할 수 있어요.',
      done: myTasks.length > 0,
      locked: !started,
      action: { label: '작업 계획 등록', pane: 'tasks' },
    },
  ]
  const steps = isLeader ? leaderSteps : memberSteps
  const guideOpen =
    !readFlag(hiddenKey) &&
    (isLeader
      ? !started || onboarding.member_count <= 1
      : steps.some((step) => !step.done))
  const current = steps.findIndex((step) => !step.done && !step.locked)
  const agentStepNow =
    !isLeader && guideOpen && steps[current]?.title === '내 에이전트 연결하기'
  const bubble = !guideOpen
    ? undefined
    : isLeader
      ? leaderBubbles[stage ?? 1]
      : agentStepNow
        ? `어서 오세요, ${me?.name ?? ''}님. 내 에이전트부터 연결해요.`
        : undefined
  // 비비 대화 창이 열린 동안은 단축 바만 남기고 다른 위젯은 숨긴다(PNL-12 B안).
  const chatOpen = pane === 'chat'
  const unconnected = members.filter((member) => !member.agent_connected).length
  const approved =
    counts.data?.documents.by_kind.reduce(
      (sum, item) => sum + item.approved_count,
      0,
    ) ?? 0
  const reviewCount = counts.data?.changes.review_required_count ?? 0
  const inProgress =
    counts.data?.tasks.by_status.find((item) => item.status === 'IN_PROGRESS')
      ?.count ?? 0
  // 내 작업 중 계획 검증을 통과해 바로 시작할 수 있는 것만 센다.
  const ready = myTasks.filter(
    (task) => task.status === 'READY' && task.validation_status === 'PASS',
  ).length
  const unreadCount = unread.data?.items.length ?? 0
  const todos = [
    reviewCount > 0 && {
      mark: '!',
      title: `변경 제안 ${reviewCount}건 검토하기`,
      detail: '승인을 기다리는 제안이 있어요',
      pane: 'changes' as const,
    },
    unreadCount > 0 && {
      mark: String(unreadCount),
      title: `읽지 않은 알림 ${unreadCount}건`,
      detail: unread.data?.items[0]?.title ?? '',
      pane: 'inbox' as const,
    },
    ready > 0 && {
      mark: '✓',
      title: `시작할 수 있는 작업 ${ready}건`,
      detail: '계획 검증을 통과했어요',
      pane: 'tasks' as const,
    },
  ].filter(Boolean) as {
    mark: string
    title: string
    detail: string
    pane: WorkspacePane
  }[]
  const chips = [
    ...(isLeader ? [['검토할 변경', reviewCount, 'changes'] as const] : []),
    ['진행 중 작업', inProgress, 'tasks'] as const,
    ['승인 문서', approved, 'documents'] as const,
  ]
  return (
    <>
      <section
        aria-label="프로젝트"
        data-tour="card"
        hidden={chatOpen}
        className="pointer-events-auto absolute top-4 left-4 z-10 grid w-80 gap-3 rounded-2xl border bg-card/95 p-3.5 shadow-lg backdrop-blur"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="나의 도시로"
            onClick={() => {
              openPane(null)
              setOutdoor(false)
              navigate('/')
            }}
          >
            <ChevronLeft />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">{project.name}</h2>
            <p className="text-xs text-muted-foreground">
              {isLeader
                ? '인간 팀장'
                : ['팀원', me?.domain].filter(Boolean).join(' · ')}{' '}
              ·{' '}
              {project.current_baseline
                ? `기준 v${project.current_baseline.version_no}`
                : started
                  ? '시작됨'
                  : !allUploaded
                    ? '준비 중'
                    : allApproved
                      ? '시작 전'
                      : '시작 전 · 비비 검토 중'}
            </p>
          </div>
        </div>
        {project.current_baseline && (
          <div
            className={cn(
              'grid gap-1.5',
              chips.length === 3 ? 'grid-cols-3' : 'grid-cols-2',
            )}
          >
            {chips.map(([label, value, pane]) => (
              <button
                key={label}
                type="button"
                onClick={() => openPane(pane)}
                className="grid rounded-xl border bg-muted/40 px-2.5 py-2 text-left hover:bg-muted"
              >
                <span className="text-[11px] text-muted-foreground">
                  {label}
                </span>
                <strong className="text-xl">{value}</strong>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="팀 보기"
            onClick={() => openPane('settings', 'team')}
            className="flex items-center gap-2"
          >
            <span className="flex -space-x-1.5">
              {members.slice(0, 5).map((member) => (
                <span
                  key={member.id}
                  aria-hidden="true"
                  className="grid size-7 place-items-center rounded-full border-2 border-card text-[11px] font-bold"
                  style={{
                    backgroundColor: `${member.color ?? '#e5b743'}30`,
                    color: member.color ?? '#a98419',
                  }}
                >
                  {member.name.slice(0, 1)}
                </span>
              ))}
              <span
                aria-hidden="true"
                className="grid size-7 place-items-center rounded-full border-2 border-card bg-primary text-[11px] font-bold text-primary-foreground"
              >
                비
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {members.length <= 1
                ? '아직 혼자예요'
                : !isLeader
                  ? onboarding.my_agent_connected
                    ? '내 에이전트 연결됨'
                    : '내 에이전트 연결 전'
                  : unconnected
                    ? `에이전트 ${unconnected}개 미확인`
                    : '에이전트 모두 연결됨'}
            </span>
          </button>
          {isLeader && members.length <= 1 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openPane('settings', 'team')}
            >
              + 팀원 초대
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openPane('settings', 'team')}
            >
              {isLeader ? '팀 관리' : '팀 보기'}
            </Button>
          )}
        </div>
      </section>
      <Hotbar
        locked={started ? [] : ['changes', 'meetings', 'tasks', 'relations']}
        lockedReason="프로젝트를 시작하면 열려요"
        badges={{ changes: reviewCount }}
        highlight={isLeader && !allUploaded ? 'documents' : undefined}
        bubble={bubble}
      />
      <div
        data-tour="top"
        hidden={chatOpen}
        className="pointer-events-auto absolute top-4 right-4 z-10 flex gap-2"
      >
        <Button
          size="icon"
          variant="secondary"
          aria-label="화면 안내 (?)"
          onClick={() => setTour('map')}
        >
          <CircleHelp />
        </Button>
        <InboxPopover projectId={project.id} />
        <span className="relative">
          <Button
            size="icon"
            variant="secondary"
            aria-label="설정"
            className={cn(
              agentStepNow && 'animate-pulse ring-2 ring-primary ring-offset-2',
            )}
            onClick={() => openPane('settings', isLeader ? 'team' : 'agent')}
          >
            <Settings />
          </Button>
          {agentStepNow && (
            <span className="absolute top-full right-0 mt-2 rounded-lg bg-primary px-2 py-1 text-[11px] font-bold whitespace-nowrap text-primary-foreground">
              에이전트 연결은 여기
            </span>
          )}
        </span>
      </div>
      <section
        aria-labelledby="todo-title"
        data-tour="todo"
        hidden={chatOpen}
        className="pointer-events-auto absolute top-17 right-4 z-10 w-75 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur"
      >
        {guideOpen ? (
          <>
            <h2
              id="todo-title"
              className="flex items-center justify-between px-1 text-sm font-bold"
            >
              {isLeader ? '프로젝트 시작 가이드' : '팀원 시작 가이드'}
              <span className="text-xs font-semibold text-muted-foreground">
                {steps.filter((step) => step.done).length} / {steps.length}{' '}
                {isLeader ? '단계' : '완료'}
              </span>
            </h2>
            <ol className="mt-2 grid gap-1.5">
              {steps.map((step, index) => {
                const locked = Boolean(step.locked) && !step.done
                return (
                  <li
                    key={step.title}
                    className={cn(
                      'rounded-xl border p-2.5',
                      index === current && 'border-primary bg-primary/5',
                      locked && 'opacity-55',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          'grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                          step.done
                            ? 'bg-green-600 text-white'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {step.done ? (
                          <Check className="size-3" />
                        ) : locked ? (
                          <Lock className="size-3" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <div className="grid flex-1 gap-0.5">
                        <strong className="text-sm">
                          {step.title}
                          {index === 0 && isLeader && (
                            <span className="ml-1.5 rounded bg-destructive/10 px-1 text-[10px] text-destructive">
                              필수
                            </span>
                          )}
                          {step.done && (
                            <span className="ml-1.5 text-[11px] font-semibold text-green-700">
                              완료
                            </span>
                          )}
                        </strong>
                        <span className="text-xs text-muted-foreground">
                          {step.detail}
                        </span>
                        {!step.done && !locked && step.children}
                        {!step.done && !locked && (
                          <span className="mt-1 flex flex-wrap items-center gap-2">
                            {step.action && (
                              <Button
                                size="xs"
                                variant={
                                  index === current ? 'default' : 'outline'
                                }
                                disabled={step.action.disabled}
                                onClick={() =>
                                  step.action!.run
                                    ? step.action!.run()
                                    : openPane(
                                        step.action!.pane!,
                                        step.action!.focus,
                                      )
                                }
                              >
                                {step.action.label}
                              </Button>
                            )}
                            {!isLeader &&
                              step.title === '기준 문서 v1 읽기' && (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => {
                                    writeFlag(readKey)
                                    rerender((value) => value + 1)
                                  }}
                                >
                                  읽었어요
                                </Button>
                              )}
                            {step.note && (
                              <span className="text-[11px] text-muted-foreground">
                                {step.note}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
            <button
              type="button"
              className="mt-2 w-full text-center text-xs text-muted-foreground underline"
              onClick={() => {
                writeFlag(hiddenKey)
                rerender((value) => value + 1)
              }}
            >
              가이드 숨기기
            </button>
          </>
        ) : (
          <>
            <h2
              id="todo-title"
              className="flex items-center justify-between px-1 text-sm font-bold"
            >
              지금 할 일
              <span className="text-xs text-muted-foreground">
                {todos.length}
              </span>
            </h2>
            <ul className="mt-2 grid gap-1">
              {todos.map((todo) => (
                <li key={todo.title}>
                  <button
                    type="button"
                    onClick={() => openPane(todo.pane)}
                    className="flex w-full items-start gap-2.5 rounded-xl p-2 text-left hover:bg-muted"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold">
                      {todo.mark}
                    </span>
                    <span className="grid">
                      <strong className="text-sm">{todo.title}</strong>
                      <span className="truncate text-xs text-muted-foreground">
                        {todo.detail}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {!todos.length && (
                <li className="p-2 text-xs text-muted-foreground">
                  지금 처리할 일이 없어요.
                </li>
              )}
            </ul>
          </>
        )}
      </section>
      <TourGuide accountId={me?.account_id} mode={tour} onChange={setTour} />
      {notice && (
        <Toast key={stage}>
          <strong className="block">{notice.title}</strong>
          {(!isLeader && notice.member) || notice.text}
        </Toast>
      )}
    </>
  )
}

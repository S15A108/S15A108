import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronLeft, Lock, Settings } from 'lucide-react'
import { dashboardApi, inboxApi } from '@/api/services'
import type { Member } from '@/api/contracts/common'
import type { GetResponse as Project } from '@/features/projects/schemas'
import type { OnboardingResponse } from '@/features/projects/schemas'
import { InboxPopover } from '@/features/inbox/InboxPopover'
import { Hotbar } from './Hotbar'
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

type Step = {
  title: string
  detail: string
  done: boolean
  locked?: boolean
  optional?: boolean
  action?: { label: string; pane: WorkspacePane; focus?: string }
  children?: ReactNode
}

export function WorkspaceHud({
  project,
  members,
  me,
  onboarding,
  myTaskCount,
}: {
  project: Project
  members: Member[]
  me?: Member
  onboarding: OnboardingResponse
  myTaskCount: number
}) {
  const navigate = useNavigate()
  const openPane = useWorkspaceStore((state) => state.openPane)
  const setOutdoor = useWorkspaceStore((state) => state.setOutdoor)
  const isLeader = project.my_role === 'LEADER'
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
  const unread = useQuery({
    queryKey: ['notifications', project.id, 'unread'],
    queryFn: () =>
      inboxApi.list({ project_id: project.id, unread: true, limit: 20 }),
  })
  const [, rerender] = useState(0)
  const hiddenKey = guideKey(project.id, isLeader ? 'leader' : 'member')
  const readKey = guideKey(project.id, 'baseline-read')
  const uploaded = onboarding.required_documents.filter(
    (item) => item.uploaded,
  ).length
  const allUploaded = uploaded === onboarding.required_documents.length
  const leaderSteps: Step[] = [
    {
      title: '문서 초안 4종 올리기',
      detail: '4종이 모두 올라가면 프로젝트가 시작돼요. 초안이어도 괜찮아요.',
      done: allUploaded,
      children: !allUploaded && (
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
                  onClick={() => openPane('documents')}
                >
                  올리기
                </button>
              )}
            </li>
          ))}
          <li className="text-right text-[11px] text-muted-foreground">
            {uploaded} / 4 올림 · 변경 제안 · 작업 현황 · 설계 관계는 4종을
            올리면 열려요
          </li>
        </ul>
      ),
    },
    {
      title: '비비 검토 반영하기',
      detail: allUploaded
        ? '비비의 수정 제안을 공용 문서함에서 확인해요.'
        : '4종이 다 올라가면 열려요.',
      // API 없음: 문서별 비비 검토 상태가 onboarding에 없어 기준 v1이 생길 때 같이 끝난다.
      done: onboarding.baseline_published,
      locked: !allUploaded,
      action: { label: '검토 결과 보기', pane: 'documents' },
    },
    {
      title: '승인해서 기준 v1 만들기',
      detail: '팀장이 4종을 승인하면 기준 v1이 되고 팀 작업이 시작돼요.',
      done: onboarding.baseline_published,
      // 문서함 승인 흐름(PNL-02-m)이 들어오기 전까지는 기존 기획 분석 창에서 발행한다.
      locked: !allUploaded,
      action: { label: '승인하러 가기', pane: 'planning' },
    },
    {
      title: '팀원 초대하기',
      detail: '선택 · 언제든 할 수 있어요.',
      done: onboarding.member_count > 1,
      optional: true,
      action: { label: '초대하기', pane: 'settings', focus: 'team' },
    },
  ]
  const memberSteps: Step[] = [
    { title: '초대 수락', detail: '프로젝트에 참여했어요.', done: true },
    {
      title: '담당 영역 확인',
      detail: me?.domain
        ? `담당 영역: ${me.domain}`
        : '담당 영역은 팀장이 정해요. 아직 정해지지 않았어요.',
      done: Boolean(me?.domain),
    },
    {
      title: '내 에이전트 연결',
      detail: '설정 › 에이전트에서 토큰을 받고 Claude Code에 BEEZ를 추가해요.',
      done: onboarding.my_agent_connected,
      action: { label: '연결하기', pane: 'settings', focus: 'agent' },
    },
    {
      title: '기준 설계 읽기',
      detail: onboarding.baseline_published
        ? '공용 문서함의 현재 문서를 읽고 체크해 주세요.'
        : '팀장이 기준 v1을 만들면 열려요.',
      // API 없음: 읽었는지 기록하는 API가 없어 직접 체크한다.
      done: readFlag(readKey),
      locked: !onboarding.baseline_published,
      action: { label: '문서 보기', pane: 'documents' },
    },
    {
      title: '첫 작업 계획 등록',
      detail: onboarding.baseline_published
        ? '작업 현황에서 첫 계획을 올려요.'
        : '기준 v1이 생긴 뒤에 할 수 있어요.',
      done: myTaskCount > 0,
      locked: !onboarding.baseline_published,
      action: { label: '작업 현황', pane: 'tasks' },
    },
  ]
  const steps = isLeader ? leaderSteps : memberSteps
  const required = steps.filter((step) => !step.optional)
  const guideOpen =
    !readFlag(hiddenKey) &&
    (isLeader
      ? !onboarding.baseline_published || onboarding.member_count <= 1
      : steps.some((step) => !step.done))
  const current = steps.findIndex((step) => !step.done && !step.locked)
  const connected = members.filter((member) => member.agent_connected).length
  const approved =
    counts.data?.documents.by_kind.reduce(
      (sum, item) => sum + item.approved_count,
      0,
    ) ?? 0
  const reviewCount = counts.data?.changes.review_required_count ?? 0
  const inProgress =
    counts.data?.tasks.by_status.find((item) => item.status === 'IN_PROGRESS')
      ?.count ?? 0
  const ready =
    counts.data?.tasks.by_status.find((item) => item.status === 'READY')
      ?.count ?? 0
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
  return (
    <>
      <section
        aria-label="프로젝트"
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
              {isLeader ? '인간 팀장' : '팀원'} ·{' '}
              {project.current_baseline
                ? `기준 v${project.current_baseline.version_no}`
                : allUploaded
                  ? '시작됨 · 비비 검토 중'
                  : '준비 중'}
            </p>
          </div>
        </div>
        {project.current_baseline && (
          <div className="grid grid-cols-3 gap-1.5">
            {[
              ['검토할 변경', reviewCount, 'changes'],
              ['진행 중 작업', inProgress, 'tasks'],
              ['승인 문서', approved, 'documents'],
            ].map(([label, value, pane]) => (
              <button
                key={label}
                type="button"
                onClick={() => openPane(pane as WorkspacePane)}
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
                : `에이전트 연결 ${connected} / ${members.length}`}
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
              팀 관리
            </Button>
          )}
        </div>
      </section>
      <Hotbar
        locked={allUploaded ? [] : ['changes', 'tasks', 'relations']}
        badges={{ changes: reviewCount }}
        highlight={isLeader && !allUploaded ? 'documents' : undefined}
      />
      <div className="pointer-events-auto absolute top-4 right-4 z-10 flex gap-2">
        <InboxPopover projectId={project.id} />
        <Button
          size="icon"
          variant="secondary"
          aria-label="설정"
          onClick={() => openPane('settings', isLeader ? 'team' : 'agent')}
        >
          <Settings />
        </Button>
      </div>
      <section
        aria-labelledby="todo-title"
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
                {required.filter((step) => step.done).length} /{' '}
                {required.length} 단계
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
                        </strong>
                        <span className="text-xs text-muted-foreground">
                          {step.detail}
                        </span>
                        {!step.done && !locked && step.children}
                        {!step.done && !locked && (
                          <span className="mt-1 flex gap-2">
                            {step.action && (
                              <Button
                                size="xs"
                                variant={
                                  index === current ? 'default' : 'outline'
                                }
                                onClick={() =>
                                  openPane(
                                    step.action!.pane,
                                    step.action!.focus,
                                  )
                                }
                              >
                                {step.action.label}
                              </Button>
                            )}
                            {!isLeader && step.title === '기준 설계 읽기' && (
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
    </>
  )
}

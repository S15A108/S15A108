import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { dashboardApi } from '@/api/services/dashboard'
import type { Activity, AgentWork, Member } from '@/api/contracts/common'
import { Button } from '@/components/ui/button'
import { statusLabel } from '@/lib/display'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { FEATURE_LABELS } from './labels'
import type {
  ActivitiesResponse,
  AgentWorkResponse,
  UsageResponse,
} from './schemas'

// 대시보드 · 한눈에 보기. 숫자는 위에서 고른 기간의 사용량·비용과 같은 값이다.
export function DashboardOverview({
  projectId,
  usage,
  activities,
  work,
  members,
  actorName,
}: {
  projectId: string
  usage: UseQueryResult<UsageResponse>
  activities: UseQueryResult<ActivitiesResponse>
  work: UseQueryResult<AgentWorkResponse>
  members: Member[]
  actorName: (accountId?: string) => string
}) {
  const openPane = useWorkspaceStore((state) => state.openPane)
  // API 없음: 대시보드 숫자를 한 번에 주는 요약 응답(백엔드 메모 8). 지금은 작업·변경 제안 집계를 따로 부른다.
  const counts = useQuery({
    queryKey: ['projects', projectId, 'dashboard-counts'],
    queryFn: async () => {
      const [changes, tasks] = await Promise.all([
        dashboardApi.changes(projectId),
        dashboardApi.tasks(projectId),
      ])
      return { changes, tasks }
    },
  })
  const inProgress =
    counts.data?.tasks.by_status.find((entry) => entry.status === 'IN_PROGRESS')
      ?.count ?? 0
  const review = counts.data?.changes.review_required_count ?? 0
  const calls = usage.data?.call_count ?? 0
  const connected = members.filter((member) => member.agent_connected).length
  const recent: Activity[] = activities.data?.items.slice(0, 4) ?? []
  const agents: AgentWork[] = work.data?.items.slice(0, 2) ?? []
  const features = [...(usage.data?.by_feature ?? [])].sort(
    (a, b) => b.call_count - a.call_count,
  )
  const most = features[0]?.call_count || 1
  const empty = !inProgress && !review && !calls && !recent.length
  const cost =
    usage.data?.estimated_cost_amount === undefined
      ? '비용 미보고'
      : `${usage.data.estimated_cost_amount} ${usage.data.currency ?? ''}`.trim()
  const metrics = [
    {
      label: '진행 중 작업',
      value: String(inProgress),
      onClick: () => openPane('tasks'),
    },
    {
      label: '검토할 변경 제안',
      value: String(review),
      onClick: () => openPane('changes'),
    },
    {
      label: '선택 기간 AI 호출',
      value: `${calls.toLocaleString('ko-KR')}회 · ${cost}`,
      href: '#dashboard-usage',
    },
    {
      label: '에이전트 연결',
      value: `${connected} / ${members.length}`,
      href: '#dashboard-agents',
    },
  ]
  return (
    <section
      id="dashboard-overview"
      aria-labelledby="dashboard-overview-title"
      className="grid gap-4"
    >
      <h3 id="dashboard-overview-title" className="text-base font-semibold">
        한눈에 보기
      </h3>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const body = (
            <>
              <span className="block text-xs text-muted-foreground">
                {metric.label}
              </span>
              <span className="mt-2 block text-lg font-semibold">
                {metric.value}
              </span>
            </>
          )
          const className = cn(
            'rounded-xl border bg-muted/30 p-4 text-left hover:bg-muted/60',
            empty && 'opacity-60',
          )
          return metric.href ? (
            <a key={metric.label} href={metric.href} className={className}>
              {body}
            </a>
          ) : (
            <button
              key={metric.label}
              type="button"
              className={className}
              onClick={metric.onClick}
            >
              {body}
            </button>
          )
        })}
      </div>
      {empty ? (
        <div className="grid gap-3 rounded-xl border border-dashed p-5 text-sm">
          <p className="font-medium">
            아직 기록이 없어요. 이렇게 시작해 보세요.
          </p>
          <ol className="grid gap-2">
            {(
              [
                ['공용 문서함에 문서 올리기', () => openPane('documents')],
                ['내 에이전트 연결', () => openPane('settings', 'agent')],
                ['첫 작업 계획 등록', () => openPane('tasks')],
              ] as const
            ).map(([label, open], index) => (
              <li key={label} className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full bg-muted text-xs font-semibold">
                  {index + 1}
                </span>
                <Button size="sm" variant="outline" onClick={open}>
                  {label}
                </Button>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="grid content-start gap-2 rounded-xl border p-4">
            <h4 className="text-sm font-semibold">기능별 AI 사용</h4>
            {/* API 없음: 날짜별(한국시간) 호출 막대 그래프는 사용량 API에 by_day가 생기면 그린다(백엔드 메모 7). */}
            {features.length ? (
              features.map((row) => (
                <div key={row.key} className="grid gap-1 text-xs">
                  <span className="flex justify-between">
                    {FEATURE_LABELS[row.key] ?? row.key}
                    <span className="text-muted-foreground">
                      {row.call_count}회
                    </span>
                  </span>
                  <span className="h-2 rounded-full bg-muted">
                    <span
                      className="block h-2 rounded-full bg-primary"
                      style={{ width: `${(row.call_count / most) * 100}%` }}
                    />
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                이 기간에 기록된 AI 호출이 없어요.
              </p>
            )}
          </div>
          <div className="grid content-start gap-4">
            <div className="grid gap-1.5 rounded-xl border p-4">
              <h4 className="text-sm font-semibold">최근 활동</h4>
              {recent.length ? (
                recent.map((item) => (
                  <p key={item.id} className="text-xs">
                    {`${actorName(item.actor_account_id)} · ${statusLabel(item.type) || item.type}`}
                  </p>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  최근 활동이 없어요.
                </p>
              )}
              <a href="#dashboard-timeline" className="text-xs underline">
                활동 타임라인에서 더 보기
              </a>
            </div>
            <div className="grid gap-1.5 rounded-xl border p-4">
              <h4 className="text-sm font-semibold">에이전트</h4>
              {agents.length ? (
                agents.map((agent) => (
                  <p key={agent.member_id} className="text-xs">
                    {`${members.find((member) => member.id === agent.member_id)?.name ?? '팀원'}의 에이전트 · ${
                      agent.current_task_id
                        ? `작업 #${agent.current_task_id} ${statusLabel(agent.task_status)}`
                        : '맡은 작업 없음'
                    }`}
                  </p>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  연결된 에이전트가 없어요.
                </p>
              )}
              <a href="#dashboard-agents" className="text-xs underline">
                에이전트 현황에서 더 보기
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

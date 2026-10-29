import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { dashboardApi } from '@/api/services/dashboard'
import { tasksApi } from '@/api/services'
import { AsyncState } from '@/components/AsyncState'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { RelationGraph } from './RelationGraph'

// 작업·설계 관계 · 단축 바 5번 단독 창. 왼쪽에서 작업을 고르면 그 작업 기준으로 설계 항목·검증·변경 제안 관계를 그린다.
// 관계 API(MON-A03)는 기준 작업이나 설계 항목이 있어야 조회돼서 작업 목록에서 골라 그린다(백엔드 메모 4).
export function RelationsView({ projectId }: { projectId: string }) {
  const openPane = useWorkspaceStore((state) => state.openPane)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const tasks = useQuery({
    queryKey: ['projects', projectId, 'relation-tasks'],
    queryFn: () => tasksApi.list(projectId, { limit: 100 }),
  })
  const all = tasks.data?.items ?? []
  const shown = all.filter((task) =>
    `${task.key} ${task.current_plan_revision.plan.title}`.includes(
      search.trim(),
    ),
  )
  const selected = picked ?? shown[0]?.id
  const relations = useQuery({
    queryKey: ['projects', projectId, 'relations', selected],
    queryFn: () => dashboardApi.relations(projectId, { task_id: selected! }),
    enabled: !!selected,
  })
  const label = (type: string, id: string) =>
    relations.data?.nodes.find((node) => node.type === type && node.id === id)
      ?.label ?? id
  return (
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="grid content-start gap-2">
        <label className="relative">
          <span className="sr-only">작업 찾기</span>
          <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="작업 번호·제목"
            disabled={!all.length}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <AsyncState query={tasks}>
          {() =>
            shown.length ? (
              <ul className="grid gap-1.5">
                {shown.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      aria-current={task.id === selected}
                      onClick={() => setPicked(task.id)}
                      className={cn(
                        'grid w-full gap-0.5 rounded-xl border bg-card px-3 py-2.5 text-left text-sm shadow-xs hover:bg-muted/40',
                        task.id === selected && 'border-2 border-foreground',
                      )}
                    >
                      <span className="text-xs text-muted-foreground">
                        {task.key}
                      </span>
                      <strong className="font-semibold">
                        {task.current_plan_revision.plan.title}
                      </strong>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {all.length ? '찾는 작업이 없어요.' : '아직 작업이 없어요.'}
              </p>
            )
          }
        </AsyncState>
      </div>
      <div className="min-w-0">
        {!all.length && !tasks.isPending ? (
          <EmptyState>
            <strong className="text-base text-foreground">
              아직 그릴 관계가 없어요
            </strong>
            작업 계획을 올리면 그 작업이 쓰는 설계 항목, 계획 검증, 관련 변경
            제안을 이어서 그려요. 기준 v1이 생기기 전에는 작업 계획을 올릴 수
            없어요.
            <Button size="sm" onClick={() => openPane('tasks')}>
              작업 계획 등록
            </Button>
          </EmptyState>
        ) : (
          selected && (
            <AsyncState query={relations}>
              {(data) => (
                <div className="grid gap-4">
                  <RelationGraph data={data} />
                  <section
                    aria-labelledby="relation-list"
                    className="grid gap-2"
                  >
                    <h3 id="relation-list" className="text-sm font-semibold">
                      관계 목록
                    </h3>
                    {data.edges.length ? (
                      <ul className="grid gap-1.5 text-sm">
                        {data.edges.map((edge, index) => (
                          <li
                            key={index}
                            className={cn(
                              'rounded-lg border px-3 py-2',
                              !edge.confirmed && 'border-dashed',
                            )}
                          >
                            {label(edge.from_type, edge.from_id)} →{' '}
                            {label(edge.to_type, edge.to_id)} ·{' '}
                            <span className="text-muted-foreground">
                              {edge.confirmed
                                ? '확인된 관계'
                                : '검토할 후보 · 확정 아님 · 계획에 근거 설계로 넣으면 확정'}
                            </span>
                            {/* API 없음: 비비가 이 후보를 본 이유는 관계 응답(MON-A03)에 아직 없다. */}
                            {!edge.confirmed && (
                              <Button
                                size="xs"
                                variant="outline"
                                className="ml-2"
                                onClick={() => openPane('tasks')}
                              >
                                작업 계획 등록
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        이 작업에 이어진 관계가 아직 없어요.
                      </p>
                    )}
                  </section>
                </div>
              )}
            </AsyncState>
          )
        )}
      </div>
    </div>
  )
}

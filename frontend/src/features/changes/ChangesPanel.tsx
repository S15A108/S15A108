import { useState } from 'react'
import type { ReactNode } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus, Search } from 'lucide-react'
import {
  changesApi,
  documentsApi,
  meetingsApi,
  membersApi,
  planningApi,
  tasksApi,
} from '@/api/services'
import type { ChangeProposal, Comparison } from '@/api/contracts/common'
import { ActionForm } from '@/components/ActionForm'
import { AsyncState } from '@/components/AsyncState'
import { EmptyState } from '@/components/EmptyState'
import { FormDialog } from '@/components/FormDialog'
import { StatusPill } from '@/components/StatusPill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useSession } from '@/features/auth/useSession'
import { useProjectAction } from '@/features/workspace/useProjectAction'
import { formatDate } from '@/lib/formatDate'
import { describeContent } from '@/lib/display'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { ProposalForm } from './ProposalForm'
import { operationLabel, toChangeItems, toRows } from './proposalItems'
import type { ProposalFormValues } from './proposalItems'

interface Props {
  projectId: string
  isLeader: boolean
}
type ChangeStatus = ChangeProposal['status']
type Tab = 'overview' | 'diff' | 'impact' | 'comments'
type Mode =
  | { kind: 'detail' }
  | { kind: 'approve' }
  | { kind: 'reject' }
  | { kind: 'history' }
  | { kind: 'form'; source?: ChangeProposal; update?: boolean }

const statusTabs = [
  ['', '전체'],
  ['PROPOSED', '새 제안'],
  ['IN_REVIEW', '검토 중'],
  ['PUBLISHED', '발행됨'],
  ['REJECTED', '반려'],
] as const
const tabs = [
  ['overview', '개요'],
  ['diff', '바뀌는 내용'],
  ['impact', '영향'],
  ['comments', '의견'],
] as const
const statusOrder: Record<ChangeStatus, number> = {
  IN_REVIEW: 0,
  PROPOSED: 1,
  APPROVED: 2,
  PUBLISHED: 3,
  REJECTED: 4,
}

// 변경 제안은 설계 항목(요구사항, API 계약, 데이터 계약, 정책, 제약)만 다룬다. 문서 새 버전은 공용 문서함에서 승인·반려한다.
// API 없음: 문서만 바꾸는 제안을 거르는 필터, 제목·항목 검색과 정렬 파라미터(백엔드 메모 1·2). 지금은 받은 목록을 화면에서 거른다.
export function ChangesPanel({ projectId, isLeader }: Props) {
  const session = useSession()
  const focusId = useWorkspaceStore((state) => state.focusId)
  const openPane = useWorkspaceStore((state) => state.openPane)
  const [selected, setSelected] = useState<{
    id: string
    focus: string | null
  } | null>(null)
  const [filter, setFilter] = useState<ChangeStatus | ''>('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'recent' | 'status'>('recent')
  const [tab, setTab] = useState<Tab>('overview')
  const [mode, setMode] = useState<Mode>({ kind: 'detail' })
  const [discussing, setDiscussing] = useState(false)
  const action = useProjectAction(projectId)
  const changes = useInfiniteQuery({
    queryKey: ['projects', projectId, 'changes', filter],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      changesApi.list(projectId, {
        status: filter || undefined,
        cursor: pageParam,
        limit: 30,
      }),
    getNextPageParam: (page) => (page.has_more ? page.next_cursor : undefined),
  })
  const entries = changes.data?.pages.flatMap((page) => page.items) ?? []
  const selectedId =
    selected?.focus === focusId ? selected.id : (focusId ?? entries[0]?.id)
  const detail = useQuery({
    queryKey: ['projects', projectId, 'change', selectedId],
    queryFn: () => changesApi.get(projectId, selectedId!),
    enabled: !!selectedId,
  })
  const impact = useQuery({
    queryKey: ['projects', projectId, 'impact', selectedId],
    queryFn: () => changesApi.impact(projectId, selectedId!),
    enabled: !!selectedId,
    refetchInterval: (query) =>
      ['PENDING', 'RUNNING'].includes(query.state.data?.analysis_status ?? '')
        ? 1500
        : false,
  })
  const comments = useInfiniteQuery({
    queryKey: ['projects', projectId, 'change-comments', selectedId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      changesApi.comments(projectId, selectedId!, {
        cursor: pageParam,
        limit: 30,
      }),
    enabled: !!selectedId,
    getNextPageParam: (page) => (page.has_more ? page.next_cursor : undefined),
  })
  const approval = useQuery({
    queryKey: ['projects', projectId, 'change-approval', selectedId],
    queryFn: () => changesApi.approval(projectId, selectedId!),
    enabled: detail.data?.proposal.status === 'PUBLISHED',
  })
  const baseline = useQuery({
    queryKey: ['projects', projectId, 'baseline'],
    queryFn: () => documentsApi.baseline(projectId),
  })
  const baselines = useQuery({
    queryKey: ['projects', projectId, 'baselines'],
    queryFn: () => documentsApi.baselines(projectId, { limit: 20 }),
    enabled: mode.kind === 'history',
  })
  const items = useQuery({
    queryKey: ['projects', projectId, 'approved-items'],
    queryFn: () =>
      planningApi.items(projectId, { status: 'APPROVED', limit: 100 }),
  })
  const tasks = useQuery({
    queryKey: ['projects', projectId, 'change-tasks'],
    queryFn: () => tasksApi.list(projectId, { limit: 100 }),
  })
  const members = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => membersApi.list(projectId, { limit: 100 }),
  })
  const approved = items.data?.items ?? []
  const taskList = tasks.data?.items ?? []
  const people = members.data?.items ?? []
  const proposal = detail.data?.proposal
  const editable =
    !!proposal && ['PROPOSED', 'IN_REVIEW'].includes(proposal.status)
  const mine = proposal?.proposer_account_id === session.data?.id
  const leaderName =
    members.data?.items.find((member) => member.role === 'LEADER')?.name ??
    '팀장'
  const nameOfAccount = (id?: string) =>
    people.find((member) => member.account_id === id)?.name ?? '팀원'
  const nameOfMember = (id?: string) =>
    people.find((member) => member.id === id)?.name ?? '담당자 확인 필요'
  const itemKey = (id?: string) =>
    approved.find((item) => item.design_item_id === id)?.key ?? '설계 항목'
  const taskKey = (id?: string) =>
    taskList.find((task) => task.id === id)?.key ?? '작업'
  const impactCount = impact.data
    ? impact.data.explicit.length + impact.data.candidates.length
    : 0
  const commentList = comments.data?.pages.flatMap((page) => page.items) ?? []
  const visible = entries
    .filter((entry) => {
      const query = search.trim()
      if (!query) return true
      return (
        entry.title.includes(query) ||
        entry.items.some((item) => itemKey(item.design_item_id).includes(query))
      )
    })
    .toSorted((a, b) =>
      sort === 'status'
        ? statusOrder[a.status] - statusOrder[b.status]
        : b.created_at.localeCompare(a.created_at),
    )
  const select = (id: string) => {
    setSelected({ id, focus: focusId })
    setTab('overview')
    setMode({ kind: 'detail' })
  }
  const perform = (operation: () => Promise<unknown>, message: string) =>
    action.run(operation, message).catch(() => undefined)
  const submitForm = async (
    values: ProposalFormValues,
    source?: ChangeProposal,
    update?: boolean,
  ) => {
    const input = {
      base_baseline_id: baseline.data!.id,
      title: values.title,
      reason: values.reason,
      ...(values.task_id ? { task_id: values.task_id } : {}),
      items: toChangeItems(values.items, approved),
      documents: [],
    }
    await action.run(
      async () => {
        if (update && source) {
          await changesApi.update(projectId, source.id, {
            ...input,
            expected_updated_at: source.updated_at,
          })
          select(source.id)
        } else {
          const created = await changesApi.create(projectId, input)
          select(created.id)
        }
      },
      update
        ? '고친 내용을 올렸어요. 다시 검토 대기예요.'
        : '변경 제안을 올렸어요.',
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          설계 항목을 바꾸자고 제안하고, 팀장이 승인하면 새 기준을 발행해요.
          문서는 공용 문서함에서 새 버전을 올려요.
        </p>
        <Button
          disabled={!baseline.data}
          onClick={() => setMode({ kind: 'form' })}
        >
          <Plus />새 변경 제안
        </Button>
      </div>
      {baseline.error && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          아직 기준 설계가 없어요. 첫 기준을 발행한 뒤 변경을 제안할 수 있어요.
        </p>
      )}
      {action.message && (
        <p role="status" className="rounded-lg bg-primary/5 p-3 text-sm">
          {action.message}
        </p>
      )}
      {action.error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
        >
          {action.error}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="grid content-start gap-2.5">
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">제안 검색</span>
              <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="제목·항목 번호"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <NativeSelect
              aria-label="정렬"
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as 'recent' | 'status')
              }
            >
              <NativeSelectOption value="recent">최신순</NativeSelectOption>
              <NativeSelectOption value="status">상태순</NativeSelectOption>
            </NativeSelect>
          </div>
          <div role="tablist" aria-label="제안 상태" className="flex gap-1">
            {statusTabs.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs',
                  filter === value
                    ? 'bg-foreground text-background'
                    : 'bg-muted',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <AsyncState query={changes}>
            {() =>
              visible.length ? (
                <ul className="grid gap-2">
                  {visible.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        aria-current={selectedId === entry.id}
                        onClick={() => select(entry.id)}
                        className={cn(
                          'grid w-full gap-1 rounded-xl border px-3.5 py-3 text-left hover:bg-muted/40',
                          selectedId === entry.id &&
                            'border-2 border-foreground',
                        )}
                      >
                        <strong className="text-sm font-semibold">
                          {entry.title}
                        </strong>
                        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <StatusPill value={entry.status} />
                          항목 {entry.items.length}개 ·{' '}
                          {nameOfAccount(entry.proposer_account_id)}
                          {entry.proposer_account_id === session.data?.id &&
                            '(나)'}
                          {entry.requires_refresh && (
                            <span className="text-amber-700">기준 바뀜</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState>
                  {entries.length
                    ? '찾는 제안이 없어요.'
                    : '아직 변경 제안이 없어요.'}
                </EmptyState>
              )
            }
          </AsyncState>
          {changes.hasNextPage && (
            <Button
              variant="outline"
              disabled={changes.isFetchingNextPage}
              onClick={() => void changes.fetchNextPage()}
            >
              제안 더 보기
            </Button>
          )}
        </div>
        <div className="min-w-0">
          {mode.kind === 'form' ? (
            <ProposalForm
              heading={
                mode.update
                  ? '제안 고치기'
                  : mode.source
                    ? '고쳐서 새로 올리기'
                    : '새 변경 제안'
              }
              status={mode.source && <StatusPill value={mode.source.status} />}
              description={
                mode.update
                  ? mode.source?.requires_refresh
                    ? '다른 제안이 먼저 발행돼 기준이 바뀌었어요. 겹치는 항목을 최신 기준으로 맞춰 주세요.'
                    : '검토 중인 내 제안이에요. 지금 내용이 채워져 있어요. 고친 뒤 올리면 다시 검토 대기가 돼요.'
                  : mode.source
                    ? '반려된 제안 내용을 채웠어요. 올리면 새 제안이 되고 이전 검토 기록은 반려된 제안에 남아요.'
                    : undefined
              }
              footnote={
                mode.update
                  ? '올리면 다시 검토 대기가 되고 영향 분석을 다시 해요. 이전 제출과 의견은 이력으로 남아요.'
                  : undefined
              }
              submitLabel={
                mode.update
                  ? '고친 내용 올리기'
                  : mode.source
                    ? '새 제안으로 올리기'
                    : '제안 올리기'
              }
              items={approved}
              tasks={taskList}
              baselineVersion={baseline.data?.version_no}
              original={mode.source && toRows(mode.source.items)}
              comments={
                mode.source &&
                commentList.map((comment) => ({
                  id: comment.id,
                  author: nameOfAccount(comment.author_account_id),
                  body: comment.body,
                }))
              }
              onShowComments={() => {
                setMode({ kind: 'detail' })
                setTab('comments')
              }}
              defaultValues={
                mode.source && {
                  title: mode.source.title,
                  reason: mode.source.reason,
                  task_id: mode.source.task_id ?? '',
                  items: toRows(mode.source.items),
                }
              }
              onCancel={() => setMode({ kind: 'detail' })}
              onSubmit={(values) =>
                submitForm(values, mode.source, mode.update)
              }
            />
          ) : !selectedId ? (
            <EmptyState>
              <strong className="text-base text-foreground">
                변경 제안이 없어요
              </strong>
              바꾸고 싶은 설계 항목이 있으면 새 변경 제안을 올려 주세요. 문서는
              공용 문서함에서 새 버전을 올려요.
            </EmptyState>
          ) : (
            <AsyncState query={detail}>
              {(data) => {
                const current = data.proposal
                const nextVersion = (baseline.data?.version_no ?? 0) + 1
                if (mode.kind === 'history')
                  return (
                    <div className="grid content-start gap-4">
                      <Back onClick={() => setMode({ kind: 'detail' })}>
                        {current.title}
                      </Back>
                      <h3 className="text-lg font-bold">승인 이력</h3>
                      <AsyncState query={approval}>
                        {(result) => (
                          <p className="text-sm">
                            {nameOfAccount(result.approved_by)} 승인 ·{' '}
                            {formatDate(result.approved_at)}
                          </p>
                        )}
                      </AsyncState>
                      {/* API 없음: 이 제안이 지나온 길(올림 → 검토 시작 → 검토 요청 → 의견 → 승인)은 활동을 제안 ID로 거르는 기능이 필요(백엔드 메모 10). */}
                      <h4 className="text-sm font-semibold">기준 이력</h4>
                      <AsyncState query={baselines}>
                        {(result) => (
                          <ul className="grid gap-2">
                            {result.items.map((item) => (
                              <li
                                key={item.id}
                                className="rounded-xl border px-3.5 py-2.5 text-sm"
                              >
                                <strong>기준 v{item.version_no}</strong>
                                {item.id === baseline.data?.id &&
                                  ' · 지금 기준'}
                                {item.id === current.published_baseline_id &&
                                  ' · 이 제안'}
                                <span className="block text-xs text-muted-foreground">
                                  {formatDate(item.created_at)}
                                  {/* API 없음: 기준마다 그때의 문서와 항목은 기준 상세(DOC-A10)를 하나씩 불러야 해서 목록에는 날짜만 둔다. */}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </AsyncState>
                    </div>
                  )
                if (mode.kind === 'approve')
                  return (
                    <div className="grid content-start gap-4">
                      <Back onClick={() => setMode({ kind: 'detail' })}>
                        {current.title}
                      </Back>
                      <h3 className="text-lg font-bold">
                        기준 v{nextVersion} 발행을 승인할까요?
                      </h3>
                      <ul className="grid gap-1.5 text-sm">
                        {current.items.map((item, index) => (
                          <li
                            key={index}
                            className="rounded-lg border px-3 py-2"
                          >
                            {operationLabel[item.operation]} ·{' '}
                            {item.operation === 'CREATE'
                              ? '새 항목'
                              : `${itemKey(item.design_item_id)} 승인 v${approved.find((entry) => entry.design_item_id === item.design_item_id)?.version_no ?? '?'}`}
                            {item.operation === 'UPDATE' && ' → 새 버전'}
                          </li>
                        ))}
                      </ul>
                      <p className="rounded-lg bg-muted/50 p-3 text-sm leading-6">
                        승인하면 이 항목을 쓰는 검증은 &apos;다시 검증
                        필요&apos;, 진행 중 작업은 &apos;대기 · 재검증&apos;으로
                        바뀌어요. 문서는 공용 문서함 승인 때 바뀌어요.
                        {/* API 없음: 승인 전에 바뀔 검증·작업 목록을 미리 받는 응답(백엔드 메모 4). 지금은 영향 탭의 확인된 관계로 대신한다. */}
                        {impact.data?.explicit.length
                          ? ` 확인된 관련 작업: ${impact.data.explicit.map((entry) => taskKey(entry.task_id)).join(', ')}`
                          : ''}
                      </p>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setMode({ kind: 'detail' })}
                        >
                          취소
                        </Button>
                        <Button
                          disabled={action.busy}
                          onClick={() =>
                            void perform(
                              () =>
                                changesApi.approve(projectId, current.id, {
                                  expected_base_baseline_id:
                                    current.base_baseline_id,
                                  expected_updated_at: current.updated_at,
                                }),
                              `기준 v${nextVersion} 발행을 마쳤어요.`,
                            ).then(() => setMode({ kind: 'detail' }))
                          }
                        >
                          승인하고 기준 v{nextVersion} 발행
                        </Button>
                      </div>
                    </div>
                  )
                if (mode.kind === 'reject')
                  return (
                    <div className="grid content-start gap-4">
                      <Back onClick={() => setMode({ kind: 'detail' })}>
                        {current.title}
                      </Back>
                      <h3 className="text-lg font-bold">제안을 반려할까요?</h3>
                      <p className="text-sm leading-6 text-muted-foreground">
                        반려한 제안은 고칠 수 없어요. 다시 올리면 새 제안이
                        돼요. 제안자와 검토 요청을 보낸 팀원에게 알려요.
                      </p>
                      <ActionForm
                        fields={[
                          {
                            name: 'reason',
                            label: '반려 사유',
                            type: 'textarea',
                            required: true,
                            max: 2000,
                          },
                        ]}
                        submitLabel="반려하기"
                        destructive
                        onSubmit={async (values) => {
                          await action.run(
                            () =>
                              changesApi.reject(projectId, current.id, {
                                reason: values.reason,
                                expected_updated_at: current.updated_at,
                              }),
                            '제안을 반려했어요.',
                          )
                          setMode({ kind: 'detail' })
                        }}
                      />
                    </div>
                  )
                return (
                  <div className="grid content-start gap-4">
                    <div>
                      <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold">
                        {current.title}
                        <StatusPill value={current.status} />
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {nameOfAccount(current.proposer_account_id)} 제안 ·{' '}
                        {formatDate(current.created_at)}
                        {/* API 없음: 회의·작업 중 어디서 올렸는지 출처, 에이전트 제안이면 에이전트 이름(백엔드 메모 3·7) */}
                      </p>
                    </div>
                    {mine && editable && !isLeader && (
                      <div className="grid gap-1 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
                        <strong>
                          {current.status === 'IN_REVIEW'
                            ? `${leaderName}님이 검토하고 있어요`
                            : `${leaderName}님의 검토를 기다리고 있어요`}
                        </strong>
                        <span className="text-muted-foreground">
                          승인과 반려는 팀장이 해요. 결과가 나오면 알림으로 알려
                          드려요. 검토 중에도 내용을 고칠 수 있어요.
                        </span>
                      </div>
                    )}
                    {current.status === 'REJECTED' && (
                      <div className="grid gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                        <p className="text-sm font-semibold">반려 사유</p>
                        <p className="text-base leading-7">
                          {current.rejection_reason}
                        </p>
                        {mine && (
                          <Button
                            variant="outline"
                            className="justify-self-start"
                            onClick={() =>
                              setMode({ kind: 'form', source: current })
                            }
                          >
                            고쳐서 새로 올리기
                          </Button>
                        )}
                        {/* API 없음: 다시 올린 제안이 이전 제안을 가리키는 필드(백엔드 메모 5) */}
                      </div>
                    )}
                    {current.requires_refresh && editable && (
                      <div className="grid gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                        이 제안을 만든 뒤 다른 제안이 먼저 발행돼 기준이
                        바뀌었어요. 겹치는 항목을 최신 기준으로 맞춰 주세요.
                        {mine && (
                          <Button
                            variant="outline"
                            className="justify-self-start"
                            onClick={() =>
                              setMode({
                                kind: 'form',
                                source: current,
                                update: true,
                              })
                            }
                          >
                            최신 기준으로 고치기
                          </Button>
                        )}
                      </div>
                    )}
                    {current.status === 'PUBLISHED' && (
                      <AsyncState query={approval}>
                        {(result) => (
                          <div className="grid gap-2 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
                            <p className="font-semibold">
                              새 기준을 발행했어요 ·{' '}
                              {nameOfAccount(result.approved_by)} 승인 ·{' '}
                              {formatDate(result.approved_at)}
                            </p>
                            <p className="text-muted-foreground">
                              이 승인으로 상태가 바뀐 검증과 작업은 작업
                              현황에서 확인하세요.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openPane('documents')}
                              >
                                기준 보기
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setMode({ kind: 'history' })}
                              >
                                승인 이력
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openPane('tasks')}
                              >
                                작업 현황
                              </Button>
                            </div>
                          </div>
                        )}
                      </AsyncState>
                    )}
                    <div
                      role="tablist"
                      aria-label="제안 보기"
                      className="flex gap-1 border-b"
                    >
                      {tabs.map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="tab"
                          aria-selected={tab === value}
                          onClick={() => setTab(value)}
                          className={cn(
                            '-mb-px border-b-2 px-3 py-2 text-sm',
                            tab === value
                              ? 'border-foreground font-semibold'
                              : 'border-transparent text-muted-foreground',
                          )}
                        >
                          {label}
                          {value === 'impact' && ` ${impactCount}`}
                          {value === 'comments' && ` ${commentList.length}`}
                        </button>
                      ))}
                    </div>
                    <div role="tabpanel" className="min-h-40">
                      {tab === 'overview' && (
                        <div className="grid gap-3 text-sm">
                          <p className="leading-6">{current.reason}</p>
                          <h4 className="flex flex-wrap items-center gap-2 font-semibold">
                            바뀌는 내용 {current.items.length}
                            <span className="text-xs font-normal text-muted-foreground">
                              {(['UPDATE', 'CREATE', 'RETIRE'] as const)
                                .map(
                                  (operation) =>
                                    [
                                      operation,
                                      current.items.filter(
                                        (item) => item.operation === operation,
                                      ).length,
                                    ] as const,
                                )
                                .filter(([, count]) => count)
                                .map(
                                  ([operation, count]) =>
                                    `${operationLabel[operation]} ${count}`,
                                )
                                .join(' · ')}
                            </span>
                            <button
                              type="button"
                              className="ml-auto text-xs font-normal underline"
                              onClick={() => setTab('diff')}
                            >
                              자세히
                            </button>
                          </h4>
                          <ul className="grid gap-1.5">
                            {current.items.map((item, index) => (
                              <li
                                key={index}
                                className="rounded-lg border px-3 py-2"
                              >
                                <strong className="font-semibold">
                                  {operationLabel[item.operation]}
                                </strong>{' '}
                                {item.operation === 'CREATE'
                                  ? '새 항목'
                                  : itemKey(item.design_item_id)}
                                {item.proposed_content && (
                                  <span className="text-muted-foreground">
                                    {' · '}
                                    {describeContent(item.proposed_content)}
                                  </span>
                                )}
                              </li>
                            ))}
                            {current.documents.length > 0 && (
                              <li className="rounded-lg border border-dashed px-3 py-2 text-muted-foreground">
                                문서 변경 {current.documents.length}건은 공용
                                문서함 승인 흐름에서 다뤄요.
                              </li>
                            )}
                          </ul>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              className="grid gap-1 rounded-xl border p-3 text-left hover:bg-muted/40"
                              onClick={() => setTab('impact')}
                            >
                              <strong>영향</strong>
                              <span className="text-xs text-muted-foreground">
                                확인된 관계 {impact.data?.explicit.length ?? 0}{' '}
                                · AI 후보 {impact.data?.candidates.length ?? 0}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="grid gap-1 rounded-xl border p-3 text-left hover:bg-muted/40"
                              onClick={() => setTab('comments')}
                            >
                              <strong>의견</strong>
                              <span className="text-xs text-muted-foreground">
                                의견 {commentList.length}
                                {commentList[0] &&
                                  ` · ${nameOfAccount(commentList[0].author_account_id)}: ${commentList[0].body}`}
                              </span>
                            </button>
                          </div>
                          {current.task_id && (
                            <p className="text-xs text-muted-foreground">
                              관련 작업 {taskKey(current.task_id)}
                            </p>
                          )}
                        </div>
                      )}
                      {tab === 'diff' && (
                        <div className="grid gap-2">
                          <p className="text-xs text-muted-foreground">
                            {current.requires_refresh
                              ? '제안을 만든 기준과 지금 기준이 달라요.'
                              : '제안을 만든 기준과 지금 기준이 같아요.'}
                          </p>
                          {data.comparisons.length ? (
                            data.comparisons.map((comparison, index) => (
                              <Diff
                                key={`${comparison.target_id}-${index}`}
                                comparison={comparison}
                                label={
                                  comparison.target_type === 'DESIGN_ITEM'
                                    ? itemKey(comparison.target_id)
                                    : '문서'
                                }
                              />
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              비교할 내용이 없어요.
                            </p>
                          )}
                        </div>
                      )}
                      {tab === 'impact' && (
                        <AsyncState query={impact}>
                          {(result) => {
                            const running = ['PENDING', 'RUNNING'].includes(
                              result.analysis_status,
                            )
                            return (
                              <div className="grid gap-3 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-muted-foreground">
                                    {running
                                      ? '다시 분석하는 중이에요. 이전 결과는 흐리게 보여요.'
                                      : result.analysis_status === 'FAILED'
                                        ? '분석하지 못했어요.'
                                        : '확인된 관계와 AI 후보를 나눠 보여요.'}
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={action.busy || running}
                                    onClick={() =>
                                      void perform(
                                        () =>
                                          changesApi.retryImpact(
                                            projectId,
                                            current.id,
                                          ),
                                        '다시 분석을 요청했어요.',
                                      )
                                    }
                                  >
                                    다시 분석
                                  </Button>
                                </div>
                                <div
                                  className={cn(
                                    'grid gap-2',
                                    running && 'opacity-50',
                                  )}
                                >
                                  <h4 className="font-semibold">확인된 관계</h4>
                                  {result.explicit.length ? (
                                    result.explicit.map((entry, index) => (
                                      <p
                                        key={index}
                                        className="rounded-lg border px-3 py-2"
                                      >
                                        {taskKey(entry.task_id)} ·{' '}
                                        {nameOfMember(entry.member_id)} ·{' '}
                                        {itemKey(entry.design_item_id)}
                                        {entry.validation_id &&
                                          ' · 관련 검증 있음'}
                                      </p>
                                    ))
                                  ) : (
                                    <p className="text-muted-foreground">
                                      확인된 관계가 없어요.
                                    </p>
                                  )}
                                  <h4 className="font-semibold">
                                    AI 후보 · 확정이나 승인이 아니에요
                                  </h4>
                                  {result.candidates.map((candidate, index) => (
                                    <p
                                      key={index}
                                      className="rounded-lg border border-dashed px-3 py-2 leading-6"
                                    >
                                      {candidate.reason}
                                      {candidate.member_id &&
                                        ` · ${nameOfMember(candidate.member_id)}`}
                                    </p>
                                  ))}
                                  <p className="text-xs text-muted-foreground">
                                    후보가 없어도 영향이 없다는 뜻은 아니에요.
                                    {result.generation?.origin === 'TEMPLATE' &&
                                      ' 지금 결과는 모델 분석이 아닌 예시 설명이에요.'}
                                  </p>
                                </div>
                              </div>
                            )
                          }}
                        </AsyncState>
                      )}
                      {tab === 'comments' && (
                        <div className="grid gap-3 text-sm">
                          {commentList.map((comment) => (
                            <article
                              key={comment.id}
                              className="rounded-lg bg-muted/40 p-3"
                            >
                              <p className="mb-1 text-xs text-muted-foreground">
                                {nameOfAccount(comment.author_account_id)} ·{' '}
                                {comment.kind === 'REVIEW_REQUEST'
                                  ? '검토 요청'
                                  : '의견'}
                              </p>
                              <p className="leading-6 whitespace-pre-wrap">
                                {comment.body}
                              </p>
                            </article>
                          ))}
                          {comments.hasNextPage && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void comments.fetchNextPage()}
                            >
                              의견 더 보기
                            </Button>
                          )}
                          <ActionForm
                            key={commentList.length}
                            fields={[
                              {
                                name: 'kind',
                                label: '남길 종류',
                                type: 'select',
                                value: 'COMMENT',
                                options: [
                                  { value: 'COMMENT', label: '의견' },
                                  {
                                    value: 'REVIEW_REQUEST',
                                    label: '검토 요청',
                                  },
                                ],
                              },
                              {
                                name: 'member_id',
                                label: '검토를 요청할 팀원',
                                type: 'select',
                                options: [
                                  { value: '', label: '고르지 않음' },
                                  ...people.map((member) => ({
                                    value: member.id,
                                    label: member.name,
                                  })),
                                ],
                              },
                              {
                                name: 'body',
                                label: '내용',
                                type: 'textarea',
                                required: true,
                                max: 2000,
                              },
                            ]}
                            submitLabel="남기기"
                            onSubmit={async (values) => {
                              const review = values.kind === 'REVIEW_REQUEST'
                              await action.run(
                                () =>
                                  changesApi.comment(projectId, current.id, {
                                    body: values.body,
                                    kind: review ? 'REVIEW_REQUEST' : 'COMMENT',
                                    ...(review && values.member_id
                                      ? {
                                          mentioned_member_ids: [
                                            values.member_id,
                                          ],
                                        }
                                      : {}),
                                  }),
                                review
                                  ? '검토를 요청했어요.'
                                  : '의견을 남겼어요.',
                              )
                            }}
                          />
                          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            의견은 승인과 달라요. 승인은 팀장이 해요.
                            {/* 열린 질문 Q5: 사람이 회의를 만들지 않는 결정과 부딪혀 '회의로 논의'는 그대로 둔다. */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDiscussing(true)}
                            >
                              회의로 논의
                            </Button>
                          </p>
                        </div>
                      )}
                    </div>
                    {mine && editable && !isLeader && (
                      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                        <span className="mr-auto text-xs text-muted-foreground">
                          고쳐서 올리면 다시 검토 대기가 돼요. 받은 의견은
                          그대로 남아요.
                        </span>
                        {/* API 없음: 제안자가 스스로 거두는 상태와 API(CHG-A15, 백엔드 메모 6) */}
                        <Button
                          variant="outline"
                          disabled
                          title="서버 기능이 준비되면 열려요"
                        >
                          제안 거두기
                        </Button>
                        <Button
                          onClick={() =>
                            setMode({
                              kind: 'form',
                              source: current,
                              update: true,
                            })
                          }
                        >
                          제안 고치기
                        </Button>
                      </div>
                    )}
                    {isLeader && editable && (
                      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                        {current.requires_refresh && (
                          <span className="mr-auto text-xs text-muted-foreground">
                            제안자가 최신 기준으로 맞춘 뒤 승인할 수 있어요.
                          </span>
                        )}
                        {/* 확인 필요(백엔드 메모 9): 검토 시작을 따로 누를지, 팀장이 열면 자동으로 할지 */}
                        {current.status === 'PROPOSED' && (
                          <Button
                            variant="ghost"
                            disabled={action.busy}
                            onClick={() =>
                              void perform(
                                () =>
                                  changesApi.review(projectId, current.id, {
                                    expected_updated_at: current.updated_at,
                                  }),
                                '검토를 시작했어요.',
                              )
                            }
                          >
                            검토 시작
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          disabled={action.busy}
                          onClick={() => setMode({ kind: 'reject' })}
                        >
                          반려
                        </Button>
                        <Button
                          disabled={action.busy || current.requires_refresh}
                          onClick={() => setMode({ kind: 'approve' })}
                        >
                          승인하고 기준 v{nextVersion} 발행
                        </Button>
                      </div>
                    )}
                    {discussing && (
                      <FormDialog
                        title="변경 제안을 함께 논의하기"
                        description="관련 팀원을 골라 회의를 만들어요. 전체 팀원을 자동으로 부르지 않아요."
                        fields={[
                          {
                            name: 'title',
                            label: '회의 제목',
                            value: current.title,
                            required: true,
                          },
                          {
                            name: 'member_id',
                            label: '함께 논의할 팀원',
                            type: 'select',
                            required: true,
                            options: people.map((member) => ({
                              value: member.id,
                              label: member.name,
                            })),
                          },
                        ]}
                        submitLabel="회의 만들기"
                        onClose={() => setDiscussing(false)}
                        onSubmit={async (values) => {
                          await action.run(async () => {
                            const meeting = await meetingsApi.create(
                              projectId,
                              {
                                title: values.title,
                                change_proposal_id: current.id,
                                participant_member_ids: [values.member_id],
                              },
                            )
                            setDiscussing(false)
                            openPane('meetings', meeting.id)
                          }, '관련 팀원과 논의할 회의를 만들었어요.')
                        }}
                      />
                    )}
                  </div>
                )
              }}
            </AsyncState>
          )}
        </div>
      </div>
    </section>
  )
}

function Back({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="justify-self-start"
      onClick={onClick}
    >
      <ArrowLeft />
      {children}
    </Button>
  )
}

// 바뀌는 내용 · 항목마다 한 줄로 접어 두고, 펼치면 기준 문장과 제안 문장을 −/+로 보여 준다.
function Diff({
  comparison,
  label,
}: {
  comparison: Comparison
  label: string
}) {
  const before = describeContent(
    comparison.current_content ?? comparison.base_content,
  )
  const after = describeContent(comparison.proposed_content)
  return (
    <details className="rounded-xl border px-3.5 py-2.5 text-sm">
      <summary className="cursor-pointer font-medium">{label}</summary>
      {comparison.format === 'FILE' ? (
        <p className="mt-2 text-muted-foreground">
          파일 버전 변경이에요. 공용 문서함에서 두 원본을 내려받아 확인하세요.
        </p>
      ) : (
        <div className="mt-2 grid gap-1 font-mono text-xs leading-6 whitespace-pre-wrap">
          <p className="rounded bg-destructive/5 px-2 text-destructive">
            − {before}
          </p>
          <p className="rounded bg-primary/10 px-2">+ {after}</p>
        </div>
      )}
    </details>
  )
}

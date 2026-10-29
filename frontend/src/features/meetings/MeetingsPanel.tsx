import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { meetingsApi, membersApi } from '@/api/services'
import type { MeetingEntry } from '@/api/contracts/common'
import { ActionForm } from '@/components/ActionForm'
import { AsyncState } from '@/components/AsyncState'
import { EmptyState } from '@/components/EmptyState'
import { SourceLinks } from '@/components/SourceLinks'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/useSession'
import { useProjectAction } from '@/features/workspace/useProjectAction'
import { formatDate } from '@/lib/formatDate'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspaceStore'

interface Props {
  projectId: string
  isLeader: boolean
}
const participationLabel = {
  INVITED: '참여 요청',
  ACCEPTED: '',
  DECLINED: '불참',
}

// 회의는 사람이 만들지 않는다. 작업이 부딪히면 비비가 팀장과 관련 작업자를 불러 연다.
// API 없음: 회의를 연 이유(작업 충돌)·관련 작업·비비의 첫 메시지·끝남 상태가 응답에 없어 칩과 첫 말풍선은 아직 그리지 않는다.
export function MeetingsPanel({ projectId, isLeader }: Props) {
  const session = useSession()
  const action = useProjectAction(projectId)
  const focus = useWorkspaceStore((state) => state.focusId)
  const openPane = useWorkspaceStore((state) => state.openPane)
  const [selection, setSelection] = useState<{
    id: string
    focus: string | null
  } | null>(null)
  const [ending, setEnding] = useState(false)
  const list = useInfiniteQuery({
    queryKey: ['projects', projectId, 'meetings'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      meetingsApi.list(projectId, { cursor: pageParam }),
    getNextPageParam: (page) => (page.has_more ? page.next_cursor : undefined),
  })
  const meetings = list.data?.pages.flatMap((page) => page.items) ?? []
  const selectedId =
    selection?.focus === focus ? selection.id : (focus ?? meetings[0]?.id)
  const detail = useQuery({
    queryKey: ['projects', projectId, 'meeting', selectedId],
    queryFn: () => meetingsApi.get(projectId, selectedId!),
    enabled: !!selectedId,
  })
  const entries = useInfiniteQuery({
    queryKey: ['projects', projectId, 'meeting-entries', selectedId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      meetingsApi.entries(projectId, selectedId!, { cursor: pageParam }),
    getNextPageParam: (page) => (page.has_more ? page.next_cursor : undefined),
    enabled: !!selectedId,
  })
  const members = useQuery({
    queryKey: ['projects', projectId, 'meeting-members'],
    queryFn: () => membersApi.list(projectId, { limit: 100 }),
  })
  const people = members.data?.items ?? []
  const me = people.find((member) => member.account_id === session.data?.id)
  // 목록은 최신순으로 온다. 대화는 오래된 것부터 보여 준다.
  const notes = entries.data?.pages.flatMap((page) => page.items) ?? []
  const latest = notes[0]
  const log = useRef<HTMLDivElement>(null)
  // 새 메시지가 오면 대화 맨 아래로 내린다. 이전 기록을 더 불러올 때는 그대로 둔다.
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [latest?.id])
  const review = latest?.kind === 'BEE_ANALYSIS' ? latest : undefined
  const participant = detail.data?.participants.find(
    (item) => item.member_id === me?.id,
  )
  const perform = (operation: () => Promise<unknown>, message: string) => {
    void action.run(operation, message).catch(() => undefined)
  }
  const requestReview = (throughId: string) =>
    meetingsApi.analyze(projectId, selectedId!, { through_entry_id: throughId })
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        작업이 부딪히면 비비가 관련된 사람을 불러 회의를 열어요. 기록은 원문
        그대로 남아요.
      </p>
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
      <AsyncState query={list}>
        {() =>
          meetings.length ? (
            <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
              <div>
                <h3 className="mb-2.5 flex justify-between text-sm font-bold">
                  팀의 회의
                  <span className="font-medium">{meetings.length}</span>
                </h3>
                <ul className="grid gap-2">
                  {meetings.map((meeting) => (
                    <li key={meeting.id}>
                      <button
                        type="button"
                        aria-current={meeting.id === selectedId}
                        className={cn(
                          'grid w-full gap-1 rounded-xl border px-3.5 py-3 text-left hover:bg-muted/40',
                          meeting.id === selectedId &&
                            'border-2 border-foreground',
                        )}
                        onClick={() => {
                          setSelection({ id: meeting.id, focus })
                          setEnding(false)
                        }}
                      >
                        <strong className="text-sm font-semibold">
                          {meeting.title}
                        </strong>
                        <span className="text-xs text-muted-foreground">
                          참여 {meeting.participants.length}명 ·{' '}
                          {formatDate(meeting.created_at)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {list.hasNextPage && (
                  <Button
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => void list.fetchNextPage()}
                  >
                    회의 더 보기
                  </Button>
                )}
              </div>
              {selectedId && (
                <AsyncState query={detail}>
                  {(meeting) =>
                    ending && review ? (
                      <div className="grid content-start gap-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="justify-self-start"
                          onClick={() => setEnding(false)}
                        >
                          <ArrowLeft />
                          {meeting.title}
                        </Button>
                        <div>
                          <h3 className="text-lg font-bold">
                            회의를 끝낼까요?
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            비비 정리대로 공용 문서를 바꾸고 회의를 닫아요. 대화
                            기록은 그대로 남아요.
                          </p>
                        </div>
                        <article className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
                          <h4 className="mb-2 font-semibold">비비 정리</h4>
                          <p className="leading-6 whitespace-pre-wrap">
                            {review.text}
                          </p>
                          {/* API 없음: 바뀔 문서와 줄, 근거 발언은 회의 종료 API가 생기면 여기에 그린다. */}
                        </article>
                        <ul className="list-inside list-disc text-sm text-muted-foreground">
                          <li>관련 작업 담당자에게 바뀐 기준을 알려요.</li>
                          <li>끝난 회의에는 더 쓸 수 없어요.</li>
                        </ul>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                          <p className="text-xs text-muted-foreground">
                            팀장만 끝낼 수 있어요. 끝내면 따로 승인 없이 바로
                            반영돼요.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setEnding(false)}
                            >
                              취소
                            </Button>
                            {/* API 없음: 회의 종료와 문서 새 버전 만들기, 관련 작업 담당자 알림 */}
                            <Button
                              disabled
                              title="서버 기능이 준비되면 열려요"
                            >
                              회의 끝내고 문서 바꾸기
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid min-w-0 content-start gap-3">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-bold">
                              {meeting.title}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(meeting.created_at)}
                              {meeting.change_proposal_id && (
                                <>
                                  {' · '}
                                  <button
                                    type="button"
                                    className="underline underline-offset-2"
                                    onClick={() =>
                                      openPane(
                                        'changes',
                                        meeting.change_proposal_id,
                                      )
                                    }
                                  >
                                    관련 변경 제안 보기
                                  </button>
                                </>
                              )}
                            </p>
                          </div>
                          <span className="grid justify-items-end gap-1">
                            <Button
                              disabled={
                                !isLeader ||
                                latest?.kind !== 'TEXT' ||
                                action.busy
                              }
                              onClick={() =>
                                perform(
                                  () => requestReview(latest!.id),
                                  '비비가 회의 내용을 정리했어요.',
                                )
                              }
                            >
                              <Sparkles />
                              비비에게 검토 요청
                            </Button>
                            {!isLeader && (
                              <span className="text-xs text-muted-foreground">
                                팀장만 요청할 수 있어요
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-sm">
                          <span className="text-muted-foreground">참여자</span>
                          {/* API 없음: 사람마다 관련 작업(TASK-001 등)을 붙인다. */}
                          {meeting.participants.map((item) => {
                            const member = people.find(
                              (person) => person.id === item.member_id,
                            )
                            return (
                              <span
                                key={item.member_id}
                                className="inline-flex items-center gap-1.5"
                              >
                                <Avatar name={member?.name} />
                                <strong className="font-semibold">
                                  {member?.name ?? '팀원'}
                                </strong>
                                <span className="text-muted-foreground">
                                  {[
                                    member?.role === 'LEADER' && '팀장',
                                    participationLabel[item.status],
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              </span>
                            )
                          })}
                        </p>
                        <AsyncState query={entries}>
                          {() => (
                            <div
                              ref={log}
                              role="log"
                              aria-label="회의 대화"
                              className="grid max-h-[50vh] min-h-48 content-start gap-3.5 overflow-auto rounded-2xl bg-muted/30 p-4"
                            >
                              {entries.hasNextPage && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="justify-self-center"
                                  onClick={() => void entries.fetchNextPage()}
                                >
                                  이전 기록 더 보기
                                </Button>
                              )}
                              {notes.length ? (
                                notes
                                  .toReversed()
                                  .map((entry) => (
                                    <Bubble
                                      key={entry.id}
                                      entry={entry}
                                      mine={
                                        entry.author_account_id ===
                                        session.data?.id
                                      }
                                      author={
                                        people.find(
                                          (member) =>
                                            member.account_id ===
                                            entry.author_account_id,
                                        )?.name
                                      }
                                    />
                                  ))
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  아직 대화가 없어요.
                                </p>
                              )}
                            </div>
                          )}
                        </AsyncState>
                        {/* API 없음: 정리 수정 요청 전용 필드. 지금은 고칠 점을 메시지로 남기고 그 시점까지 다시 정리한다. */}
                        {isLeader && review ? (
                          <div className="grid gap-3">
                            <ActionForm
                              key={`fix:${review.id}`}
                              fields={[
                                {
                                  name: 'text',
                                  label: '비비에게 고칠 점',
                                  required: true,
                                  max: 10000,
                                  placeholder:
                                    '정리에서 고칠 점을 비비에게 말해 주세요',
                                },
                              ]}
                              submitLabel="수정 요청"
                              onSubmit={async (values) => {
                                await action.run(async () => {
                                  const entry = await meetingsApi.addEntry(
                                    projectId,
                                    meeting.id,
                                    { text: values.text },
                                  )
                                  await requestReview(entry.id)
                                }, '비비가 다시 정리했어요.')
                              }}
                            />
                            <Button
                              variant="outline"
                              className="justify-self-start"
                              onClick={() => setEnding(true)}
                            >
                              회의 끝내기
                            </Button>
                          </div>
                        ) : participant?.status === 'ACCEPTED' ? (
                          <ActionForm
                            key={`${meeting.id}:${notes.length}`}
                            fields={[
                              {
                                name: 'text',
                                label: '메시지',
                                required: true,
                                max: 10000,
                                placeholder: '메시지 보내기',
                              },
                            ]}
                            submitLabel="보내기"
                            onSubmit={async (values) => {
                              await action.run(
                                () =>
                                  meetingsApi.addEntry(projectId, meeting.id, {
                                    text: values.text,
                                  }),
                                '메시지를 보냈어요.',
                              )
                            }}
                          />
                        ) : participant?.status === 'INVITED' ? (
                          // API 없음: 비비가 부르면 바로 참여하는지 정해지면 이 단계를 뺀다.
                          <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            회의에 참여하면 메시지를 보낼 수 있어요.
                            <Button
                              size="sm"
                              disabled={action.busy}
                              onClick={() =>
                                perform(
                                  () =>
                                    meetingsApi.respond(projectId, meeting.id, {
                                      status: 'ACCEPTED',
                                    }),
                                  '회의에 참여했어요.',
                                )
                              }
                            >
                              참여하기
                            </Button>
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            비비가 부른 사람만 메시지를 보낼 수 있어요.
                          </p>
                        )}
                      </div>
                    )
                  }
                </AsyncState>
              )}
            </div>
          ) : (
            <EmptyState>
              <strong className="text-base text-foreground">
                회의가 없어요
              </strong>
              작업이 서로 부딪히면 비비가 팀장과 관련 작업자를 불러 회의를
              열어요.
            </EmptyState>
          )
        }
      </AsyncState>
    </section>
  )
}

function Avatar({ name }: { name?: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold"
    >
      {name?.[0] ?? '?'}
    </span>
  )
}

function Bubble({
  entry,
  mine,
  author,
}: {
  entry: MeetingEntry
  mine: boolean
  author?: string
}) {
  const time = formatDate(entry.created_at)
  if (entry.kind !== 'TEXT')
    return (
      <div className="flex items-start gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary">
          <Sparkles className="size-3.5 text-primary-foreground" />
        </span>
        <div className="max-w-[80%] min-w-0">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">비비</strong> · {time}
          </p>
          <article className="mt-1 rounded-2xl rounded-tl-sm border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm">
            {entry.kind === 'MINUTES' && (
              <strong className="block text-[13px]">회의록</strong>
            )}
            {entry.generation && (
              <p className="mt-1 text-xs text-muted-foreground">
                {entry.generation.origin === 'TEMPLATE'
                  ? '예시 템플릿 · 실제 AI 호출 없음'
                  : `AI 생성 · ${entry.generation.model ?? '모델 정보 미제공'}`}
              </p>
            )}
            <p className="mt-1 leading-6 whitespace-pre-wrap">{entry.text}</p>
            {entry.generation && (
              <SourceLinks sources={entry.generation.sources} />
            )}
          </article>
        </div>
      </div>
    )
  if (mine)
    return (
      <div className="grid max-w-[80%] justify-items-end justify-self-end">
        <p className="text-xs text-muted-foreground">
          {time} · <strong className="text-foreground">나</strong>
        </p>
        <p className="mt-1 rounded-2xl rounded-tr-sm bg-foreground px-3 py-2.5 text-sm leading-6 whitespace-pre-wrap text-background">
          {entry.text}
        </p>
      </div>
    )
  return (
    <div className="flex items-start gap-2.5">
      <Avatar name={author} />
      <div className="max-w-[80%] min-w-0">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">{author ?? '팀원'}</strong> ·{' '}
          {time}
        </p>
        <p className="mt-1 rounded-2xl rounded-tl-sm border bg-background px-3 py-2.5 text-sm leading-6 whitespace-pre-wrap">
          {entry.text}
        </p>
      </div>
    </div>
  )
}

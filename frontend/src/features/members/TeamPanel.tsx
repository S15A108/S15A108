import { useState } from 'react'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { Copy, Ellipsis, MailPlus, Pencil, TriangleAlert } from 'lucide-react'
import type { Member } from '@/api/contracts/common'
import { membersApi, projectsApi, tasksApi } from '@/api/services'
import { ActionForm } from '@/components/ActionForm'
import { AsyncState } from '@/components/AsyncState'
import { EmptyState } from '@/components/EmptyState'
import { FormDialog } from '@/components/FormDialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Toast } from '@/components/Toast'
import { useSession } from '@/features/auth/useSession'
import { BuildingDesignPicker } from '@/features/projects/BuildingDesignPicker'
import { projectPlacements } from '@/features/projects/placements'
import { useProjectAction } from '@/features/workspace/useProjectAction'
import { lines } from '@/lib/display'
import { formatDate } from '@/lib/formatDate'
import { placementKey, useWorkspaceStore } from '@/stores/workspaceStore'
import type { BuildingDesign } from '@/stores/workspaceStore'

type DialogAction =
  'invite' | { action: 'edit' | 'remove' | 'transfer'; member: Member }

export type TeamView = 'team' | 'project' | 'remove'

export function TeamPanel({
  projectId,
  isLeader,
  view = 'team',
  onViewChange,
}: {
  projectId: string
  isLeader: boolean
  view?: TeamView
  onViewChange?: (view: TeamView) => void
}) {
  const session = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const action = useProjectAction(projectId)
  const placements = useWorkspaceStore((state) => state.placements)
  const placeProject = useWorkspaceStore((state) => state.placeProject)
  const accountId = session.data?.id ?? ''
  const [design, setDesign] = useState<BuildingDesign>(
    placements[placementKey(accountId, projectId)]?.design ?? 'modern',
  )
  const [dialog, setDialog] = useState<DialogAction | null>(null)
  const [fresh, setFresh] = useState<{ id: string; url: string }[]>([])
  const [copyMessage, setCopyMessage] = useState('')
  const [viewTime] = useState(() => Date.now())
  const project = useQuery({
    queryKey: ['projects', projectId, 'team-project'],
    queryFn: () => projectsApi.get(projectId),
  })
  const members = useInfiniteQuery({
    // 다른 창은 같은 팀원 목록을 useQuery로 ['projects', id, 'members']에 담는다. 모양이 달라 키를 나눈다.
    queryKey: ['projects', projectId, 'team-members'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      membersApi.list(projectId, { limit: 100, cursor: pageParam }),
    getNextPageParam: (page) => (page.has_more ? page.next_cursor : undefined),
  })
  const invitations = useInfiniteQuery({
    queryKey: ['projects', projectId, 'invitations'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      membersApi.invitations(projectId, { cursor: pageParam }),
    getNextPageParam: (page) => (page.has_more ? page.next_cursor : undefined),
    enabled: isLeader && view === 'team',
  })
  const people = members.data?.pages.flatMap((page) => page.items) ?? []
  const removing =
    typeof dialog === 'object' && dialog?.action === 'remove'
      ? dialog.member
      : undefined
  const tasks = useQuery({
    queryKey: ['projects', projectId, 'team-tasks'],
    queryFn: () => tasksApi.list(projectId, { limit: 100 }),
    enabled: !!removing,
  })
  const handover =
    tasks.data?.items.filter(
      (task) =>
        task.assignee_member_id === removing?.id &&
        !['COMPLETED', 'CANCELLED'].includes(task.status),
    ) ?? []
  const otherMembers = people.filter(
    (member) => member.account_id !== session.data?.id,
  )
  const leaveProject = async () => {
    await queryClient.invalidateQueries({ queryKey: ['projects'] })
    navigate('/')
  }
  const perform = (operation: () => Promise<unknown>, message: string) => {
    void action.run(operation, message).catch(() => undefined)
  }
  const title =
    view === 'project'
      ? '프로젝트 정보'
      : view === 'remove'
        ? isLeader
          ? '프로젝트 제거'
          : '프로젝트 나가기'
        : '팀'
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          {view === 'team' && (
            <p className="mt-1 text-sm text-muted-foreground">
              {isLeader
                ? '권한은 인간 팀장과 팀원 두 가지예요. 역할 수정, 팀장 위임, 추방은 팀원 줄의 ⋯에서 해요.'
                : '팀 구성은 보기만 할 수 있어요. 바꾸려면 인간 팀장에게 요청해 주세요.'}
            </p>
          )}
        </div>
        {view === 'team' && isLeader && (
          <Button onClick={() => setDialog('invite')}>
            <MailPlus />
            팀원 초대
          </Button>
        )}
      </header>
      {/* 결과는 화면 안 글 대신 오른쪽 위 토스트로 잠깐 보여 준다. */}
      {action.message && <Toast>{action.message}</Toast>}
      {copyMessage && <Toast key={copyMessage}>{copyMessage}</Toast>}
      {action.error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
        >
          {action.error}
        </p>
      )}
      {view === 'team' && (
        <AsyncState query={members}>
          {(data) => (
            <>
              <ul className="divide-y border-y">
                {data.pages
                  .flatMap((page) => page.items)
                  .map((member) => {
                    const mine = member.account_id === session.data?.id
                    return (
                      <li
                        key={member.id}
                        className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-4 px-1 py-3.5"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold"
                            style={{
                              backgroundColor: `${member.color ?? '#e5b743'}25`,
                              color: member.color ?? '#a98419',
                            }}
                          >
                            {member.name.slice(0, 1)}
                          </span>
                          <span className="grid">
                            <strong className="text-sm font-semibold">
                              {member.name}
                              {mine ? ' · 나' : ''}
                            </strong>
                            <span className="text-xs text-muted-foreground">
                              {member.role === 'LEADER' ? '인간 팀장' : '팀원'}
                              {member.role_label
                                ? ` · ${member.role_label}`
                                : ''}
                            </span>
                          </span>
                        </span>
                        <span
                          className={
                            member.domain
                              ? 'text-sm'
                              : 'text-sm text-muted-foreground'
                          }
                        >
                          {member.domain ?? '담당 영역 미등록'}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span
                            aria-hidden="true"
                            className={`size-1.5 rounded-full ${member.agent_connected ? 'bg-green-600' : 'bg-primary'}`}
                          />
                          {member.agent_connected
                            ? '에이전트 연결됨'
                            : '에이전트 연결 미확인'}
                        </span>
                        <span className="flex justify-end">
                          {isLeader && !mine && member.role !== 'LEADER' ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  aria-label={`${member.name} 더보기`}
                                  disabled={action.busy}
                                >
                                  <Ellipsis />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() =>
                                    setDialog({ action: 'edit', member })
                                  }
                                >
                                  역할 수정
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    setDialog({ action: 'transfer', member })
                                  }
                                >
                                  팀장으로 위임
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() =>
                                    setDialog({ action: 'remove', member })
                                  }
                                >
                                  추방
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            (isLeader || mine) && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={action.busy}
                                onClick={() =>
                                  setDialog({ action: 'edit', member })
                                }
                              >
                                <Pencil />
                                역할·담당 영역
                              </Button>
                            )
                          )}
                        </span>
                      </li>
                    )
                  })}
              </ul>
              {members.hasNextPage && (
                <Button
                  variant="outline"
                  disabled={members.isFetchingNextPage}
                  onClick={() => void members.fetchNextPage()}
                >
                  팀원 더 보기
                </Button>
              )}
            </>
          )}
        </AsyncState>
      )}
      {view === 'team' && isLeader && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">초대 대기</h3>
          <AsyncState query={invitations}>
            {(data) => (
              <>
                {data.pages.flatMap((page) => page.items).length ? (
                  <ul className="divide-y">
                    {data.pages
                      .flatMap((page) => page.items)
                      .map((invitation) => (
                        <li
                          key={invitation.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                        >
                          <span>
                            <b className="font-medium">
                              {invitation.invited_email ?? '초대 링크'}
                            </b>
                            <small className="mt-1 block text-muted-foreground">
                              {fresh.some((item) => item.id === invitation.id)
                                ? '팀원 · 방금 초대 · '
                                : ''}
                              {invitation.accepted_at
                                ? '수락됨'
                                : invitation.revoked_at
                                  ? '취소됨'
                                  : Date.parse(invitation.expires_at) < viewTime
                                    ? '만료됨'
                                    : `만료 ${formatDate(invitation.expires_at)}`}
                            </small>
                          </span>
                          {/* API 없음: 초대 메일 발송이 없어 방금 만든 초대는 링크를 직접 전달한다. 메일이 생기면 토스트를 '초대 메일을 보냈어요'로 바꾼다. */}
                          {fresh.some((item) => item.id === invitation.id) && (
                            <span className="flex w-full gap-2">
                              <Input
                                aria-label="팀원 초대 링크"
                                readOnly
                                value={
                                  fresh.find(
                                    (item) => item.id === invitation.id,
                                  )!.url
                                }
                                className="min-w-48 flex-1"
                                onFocus={(event) =>
                                  event.currentTarget.select()
                                }
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void navigator.clipboard
                                    .writeText(
                                      fresh.find(
                                        (item) => item.id === invitation.id,
                                      )!.url,
                                    )
                                    .then(() =>
                                      setCopyMessage('초대 링크를 복사했어요.'),
                                    )
                                    .catch(() =>
                                      setCopyMessage(
                                        '링크를 선택해 직접 복사해 주세요.',
                                      ),
                                    )
                                }
                              >
                                <Copy />
                                복사
                              </Button>
                            </span>
                          )}
                          {!invitation.revoked_at &&
                            !invitation.accepted_at && (
                              // API 없음: 초대 메일 다시 보내기
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                title="메일 발송이 준비되면 열려요"
                              >
                                메일 다시 보내기
                              </Button>
                            )}
                          {!invitation.revoked_at &&
                            !invitation.accepted_at && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={action.busy}
                                onClick={() =>
                                  perform(
                                    () =>
                                      membersApi.revokeInvitation(
                                        projectId,
                                        invitation.id,
                                      ),
                                    '초대를 취소했어요.',
                                  )
                                }
                              >
                                초대 취소
                              </Button>
                            )}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <EmptyState>보낸 초대가 없어요.</EmptyState>
                )}
                {invitations.hasNextPage && (
                  <Button
                    variant="outline"
                    onClick={() => void invitations.fetchNextPage()}
                  >
                    초대 더 보기
                  </Button>
                )}
              </>
            )}
          </AsyncState>
        </div>
      )}
      {view === 'project' && (
        <AsyncState query={project}>
          {(data) => (
            <div className="space-y-6">
              {/* API 없음: 건물 디자인은 이 브라우저에만 저장된다. Project에 design 필드가 생기면 수정 요청에 넣는다. */}
              <BuildingDesignPicker value={design} onChange={setDesign} />
              <ActionForm
                fields={[
                  {
                    name: 'name',
                    label: '프로젝트 이름',
                    required: true,
                    max: 40,
                    counter: true,
                    value: data.name,
                  },
                  {
                    name: 'description',
                    label: '프로젝트 소개',
                    type: 'textarea',
                    max: 300,
                    counter: true,
                    value: data.description,
                  },
                ]}
                submitLabel="저장"
                onSubmit={async (values) => {
                  await action.run(
                    () =>
                      projectsApi.update(projectId, {
                        name: values.name,
                        description: values.description,
                      }),
                    '프로젝트 정보를 저장했어요.',
                  )
                  placeProject(accountId, projectId, {
                    lot:
                      projectPlacements([projectId], accountId, placements)[0]
                        .lot ?? 0,
                    design,
                  })
                  await queryClient.invalidateQueries({
                    queryKey: ['projects'],
                  })
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 p-4">
                <span className="text-sm">
                  <strong className="block">프로젝트 삭제</strong>
                  <span className="text-muted-foreground">
                    팀원이 있으면 팀장을 먼저 위임해야 해요.
                  </span>
                </span>
                <Button
                  variant="destructive"
                  onClick={() => onViewChange?.('remove')}
                >
                  프로젝트 삭제
                </Button>
              </div>
            </div>
          )}
        </AsyncState>
      )}
      {view === 'remove' && (
        <AsyncState query={project}>
          {(data) =>
            isLeader && otherMembers.length > 0 ? (
              // 서버(PRJ-A05)는 아직 팀원이 있어도 지운다. 막는 응답(409)이 생기기 전까지 화면에서 먼저 막는다.
              <div className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
                <p className="flex items-center gap-2 font-semibold text-destructive">
                  <TriangleAlert className="size-4" />
                  팀원이 있어서 바로 제거할 수 없어요
                </p>
                <p className="text-sm text-muted-foreground">
                  프로젝트는 남은 팀원에게 남아요. 아래 순서로 정리해 주세요.
                </p>
                <ol className="grid gap-3 text-sm">
                  <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
                    <span>1. 팀원 중 한 명에게 팀장 위임</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewChange?.('team')}
                    >
                      팀에서 위임하기
                    </Button>
                  </li>
                  <li className="rounded-lg border bg-card p-3 text-muted-foreground">
                    2. 위임한 뒤 프로젝트 나가기
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  {isLeader
                    ? '혼자 쓰는 프로젝트예요. 제거하면 문서와 작업에 다시 들어올 수 없어요.'
                    : '나가면 문서·작업을 볼 수 없고 이 프로젝트 토큰도 바로 막혀요. 다시 들어오려면 새 초대가 필요해요.'}
                </p>
                <ActionForm
                  fields={[
                    {
                      name: 'confirm_name',
                      label: '프로젝트 이름 입력',
                      required: true,
                      placeholder: data.name,
                      check: (value) =>
                        value === data.name
                          ? undefined
                          : '프로젝트 이름이 맞지 않아요.',
                    },
                  ]}
                  destructive
                  submitLabel={isLeader ? '프로젝트 제거' : '프로젝트 나가기'}
                  onSubmit={async (values) => {
                    await action.run(
                      () =>
                        isLeader
                          ? projectsApi.remove(projectId, {
                              confirm_name: values.confirm_name,
                            })
                          : membersApi.leave(projectId, {}),
                      isLeader
                        ? '프로젝트를 제거했어요.'
                        : '프로젝트에서 나갔어요.',
                    )
                    await leaveProject()
                  }}
                />
              </div>
            )
          }
        </AsyncState>
      )}
      {dialog === 'invite' && (
        <FormDialog
          title="팀원 초대"
          description="초대한 이메일로 로그인한 사용자가 참여할 수 있어요. 7일 뒤 만료돼요."
          fields={[
            {
              name: 'email',
              label: '팀원 이메일 · 여러 명이면 한 줄에 하나씩',
              type: 'textarea',
              required: true,
              check: (value) =>
                lines(value).every(
                  (email) => z.email().safeParse(email).success,
                )
                  ? undefined
                  : '이메일 형식을 확인해 주세요.',
            },
          ]}
          submitLabel="초대 링크 만들기"
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            const emails = lines(values.email)
            // API 없음: 초대 메일 발송. 여러 명은 초대를 한 명씩 만든다.
            await action.run(
              async () => {
                const created = []
                for (const email of emails) {
                  const result = await membersApi.createInvitation(projectId, {
                    email,
                  })
                  created.push({
                    id: result.invitation.id,
                    url: result.invite_url,
                  })
                }
                setFresh(created)
              },
              emails.length > 1
                ? `초대 링크 ${emails.length}개를 만들었어요.`
                : '초대 링크를 만들었어요.',
            )
            setDialog(null)
          }}
        />
      )}
      {typeof dialog === 'object' && dialog?.action === 'transfer' && (
        <FormDialog
          title="팀장으로 위임"
          description={`${dialog.member.name}님이 인간 팀장이 되고, 나는 팀원이 돼요. 승인·발행과 프로젝트 설정 권한이 넘어가요.`}
          fields={[
            {
              name: 'confirm',
              label: "확인을 위해 '위임'을 입력",
              required: true,
              check: (value) =>
                value === '위임' ? undefined : "'위임'을 입력해 주세요.",
            },
          ]}
          submitLabel="팀장 넘기기"
          destructive
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            await action.run(
              () =>
                membersApi.transfer(projectId, {
                  target_member_id: dialog.member.id,
                }),
              '인간 팀장을 위임했어요.',
            )
            await queryClient.invalidateQueries({ queryKey: ['projects'] })
            setDialog(null)
          }}
        />
      )}
      {typeof dialog === 'object' && dialog?.action === 'edit' && (
        <FormDialog
          title={`${dialog.member.name} 역할 수정`}
          fields={[
            {
              name: 'role_label',
              label: '표시 역할',
              value: dialog.member.role_label,
              max: 40,
            },
            { name: 'domain', label: '담당 영역', value: dialog.member.domain },
            {
              name: 'color',
              label: '표시 색',
              type: 'color',
              value: dialog.member.color ?? '#e5b743',
            },
          ]}
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            await action.run(
              () => membersApi.update(projectId, dialog.member.id, values),
              '역할과 담당 영역을 저장했어요.',
            )
            setDialog(null)
          }}
        />
      )}
      {typeof dialog === 'object' && dialog?.action === 'remove' && (
        <FormDialog
          title={`${dialog.member.name} 추방`}
          description="프로젝트 접근과 토큰이 바로 해제돼요. 진행 중인 작업을 넘겨받을 동료를 골라 주세요."
          fields={[
            {
              name: 'reassign_to_member_id',
              label: '작업을 넘겨받을 동료',
              type: 'select',
              options: people
                .filter((member) => member.id !== dialog.member.id)
                .map((member) => ({ value: member.id, label: member.name })),
            },
          ]}
          submitLabel="추방"
          destructive
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            await action.run(
              () =>
                membersApi.remove(projectId, dialog.member.id, {
                  reassign_to_member_id:
                    values.reassign_to_member_id || undefined,
                }),
              '팀원을 추방했어요.',
            )
            setDialog(null)
          }}
        >
          {/* 넘길 작업을 목록으로 보여 주고 넘겨받을 동료를 고른다(L9). */}
          <section aria-label="넘길 작업" className="grid gap-1.5 text-sm">
            <p className="font-semibold">넘길 작업</p>
            {handover.length ? (
              <ul className="grid gap-1">
                {handover.map((task) => (
                  <li key={task.id} className="rounded-lg border px-3 py-2">
                    {task.key} · {task.current_plan_revision.plan.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">넘길 작업이 없어요.</p>
            )}
          </section>
        </FormDialog>
      )}
    </section>
  )
}

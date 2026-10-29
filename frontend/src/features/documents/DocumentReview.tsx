import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { documentsApi } from '@/api/services/documents'
import { membersApi } from '@/api/services/members'
import type { DocumentBeeReview } from '@/api/contracts/common'
import { ActionForm } from '@/components/ActionForm'
import { AsyncState } from '@/components/AsyncState'
import { Toast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/useSession'
import { useProjectAction } from '@/features/workspace/useProjectAction'
import { statusLabel } from '@/lib/display'
import { formatDate } from '@/lib/formatDate'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { reviewStage } from './reviewStage'

const STEPS = ['파일 등록', '비비 검토', '수정 제안 반영', '팀장 승인'] as const

// 공용 문서함 · 문서별 검토 흐름(PNL-02-m): 비비 검토 → 수정 제안 반영 → 최종본 확인 → 팀장 승인·반려.
export function DocumentReview({
  projectId,
  documentId,
  title,
  kind,
  isLeader,
  locked = false,
  onClose,
}: {
  projectId: string
  documentId: string
  title: string
  kind: string
  isLeader: boolean
  /** 기준 v1이 생겨 이 흐름으로는 고칠 수 없음(change_proposal_required) */
  locked?: boolean
  onClose: () => void
}) {
  const session = useSession()
  const openPane = useWorkspaceStore((state) => state.openPane)
  const action = useProjectAction(projectId)
  const [editing, setEditing] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const copy = useQuery({
    queryKey: ['projects', projectId, 'working-copy', documentId],
    queryFn: () => documentsApi.workingCopy(projectId, documentId),
  })
  const members = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => membersApi.list(projectId),
  })
  const pending = copy.data?.submissions.find(
    (item) => item.status === 'SUBMITTED',
  )
  const detail = useQuery({
    queryKey: ['projects', projectId, 'review-submission', pending?.id],
    queryFn: () =>
      documentsApi.reviewSubmission(projectId, documentId, pending!.id),
    enabled: !!pending && isLeader,
  })
  const nameOf = (accountId?: string) =>
    members.data?.items.find((member) => member.account_id === accountId)
      ?.name ?? '팀원'
  const run = (operation: () => Promise<unknown>, message: string) =>
    void action.run(operation, message).catch(() => undefined)
  return (
    <section
      aria-label={`${title} 검토`}
      className="grid min-w-0 content-start gap-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft />
          목록
        </Button>
        <span className="text-xs text-muted-foreground">
          {statusLabel(kind)}
        </span>
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      {action.message && <Toast>{action.message}</Toast>}
      {locked && (
        <div className="grid gap-2 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
          <p>
            기준 설계 생성 이후 문서 수정은 변경 제안을 통해 요청해 주세요. 이
            화면에서는 보기만 할 수 있어요.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="justify-self-start"
            onClick={() => openPane('changes')}
          >
            변경 제안으로 요청
          </Button>
        </div>
      )}
      {action.error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
        >
          {action.error}
        </p>
      )}
      <AsyncState query={copy}>
        {(data) => {
          const stage = reviewStage(data)
          const owner = !locked && data.owner_account_id === session.data?.id
          const rejected = data.submissions.find(
            (item) => item.status === 'REJECTED',
          )
          return (
            <>
              <ol
                aria-label="검토 단계"
                className="flex flex-wrap gap-1.5 text-xs"
              >
                {STEPS.map((step, index) => (
                  <li
                    key={step}
                    aria-current={index === stage.step ? 'step' : undefined}
                    className={cn(
                      'rounded-full border px-2.5 py-1',
                      index < stage.step && 'bg-muted text-muted-foreground',
                      index === stage.step && 'border-foreground font-semibold',
                    )}
                  >
                    {index < stage.step ? '✓ ' : ''}
                    {step}
                  </li>
                ))}
              </ol>
              <p className="text-sm">
                <strong>{stage.label}</strong>
                <span className="text-muted-foreground">
                  {' · '}올린 사람 {nameOf(data.owner_account_id)} · 리비전{' '}
                  {data.revision}
                </span>
              </p>
              {data.status === 'REJECTED' && rejected && (
                <div className="grid gap-1 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
                  <strong>팀장 반려</strong>
                  <p className="leading-6">{rejected.rejection_reason}</p>
                  <span className="text-xs text-muted-foreground">
                    {nameOf(rejected.decided_by)} ·{' '}
                    {formatDate(rejected.decided_at)}
                  </span>
                </div>
              )}
              {stage.step === 1 && (
                <div className="grid gap-3">
                  <pre className="max-h-72 overflow-auto rounded-xl bg-muted/40 p-4 text-sm leading-6 whitespace-pre-wrap">
                    {data.content}
                  </pre>
                  {owner ? (
                    <Button
                      className="justify-self-start"
                      disabled={action.busy}
                      onClick={() =>
                        run(
                          () =>
                            documentsApi.requestBeeReview(
                              projectId,
                              documentId,
                              {
                                expected_revision: data.revision,
                              },
                            ),
                          '비비가 검토를 마쳤어요.',
                        )
                      }
                    >
                      <Sparkles />
                      {action.busy
                        ? '비비가 문서를 검토하고 있어요…'
                        : '비비에게 검토 요청'}
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      올린 사람이 비비 검토를 받으면 이어서 볼 수 있어요.
                    </p>
                  )}
                </div>
              )}
              {stage.step === 2 && stage.review && (
                <Suggestions
                  review={stage.review}
                  owner={owner}
                  busy={action.busy}
                  onDecide={(suggestionId, decision) =>
                    run(
                      () =>
                        documentsApi.decideSuggestion(
                          projectId,
                          documentId,
                          stage.review!.id,
                          suggestionId,
                          { expected_revision: data.revision, decision },
                        ),
                      decision === 'APPLY'
                        ? '제안을 반영했어요.'
                        : '제안을 넘겼어요.',
                    )
                  }
                />
              )}
              {stage.step === 3 &&
                data.status !== 'SUBMITTED' &&
                stage.review && (
                  <div className="grid gap-3">
                    <h4 className="font-semibold">최종본 확인</h4>
                    <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm">
                      비비 제안을 반영한 최종본이에요. 팀장이 보게 될 화면과
                      같아요.
                    </p>
                    {editing ? (
                      <ActionForm
                        fields={[
                          {
                            name: 'content',
                            label: '본문',
                            type: 'textarea',
                            required: true,
                            value: data.content,
                          },
                        ]}
                        submitLabel="고친 내용 저장"
                        onSubmit={async (values) => {
                          await action.run(
                            () =>
                              documentsApi.updateWorkingCopy(
                                projectId,
                                documentId,
                                {
                                  expected_revision: data.revision,
                                  content: values.content,
                                  file_name: data.file_name,
                                },
                              ),
                            '고친 내용을 저장했어요. 비비 검토를 다시 받아 주세요.',
                          )
                          setEditing(false)
                        }}
                      />
                    ) : (
                      <pre className="max-h-72 overflow-auto rounded-xl bg-muted/40 p-4 text-sm leading-6 whitespace-pre-wrap">
                        {data.content}
                      </pre>
                    )}
                    {owner && !editing && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setEditing(true)}
                        >
                          다시 고치기
                        </Button>
                        <Button
                          disabled={action.busy}
                          onClick={() =>
                            run(
                              () =>
                                documentsApi.submitReview(
                                  projectId,
                                  documentId,
                                  {
                                    expected_revision: data.revision,
                                    review_id: stage.review!.id,
                                  },
                                ),
                              '팀장에게 검토를 요청했어요.',
                            )
                          }
                        >
                          팀장에게 검토 요청
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              {data.status === 'SUBMITTED' &&
                (isLeader && !locked ? (
                  <AsyncState query={detail}>
                    {(submission) => (
                      <div className="grid gap-3">
                        <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm">
                          {nameOf(submission.submission.submitted_by)}님이
                          승인을 요청했어요. ·{' '}
                          {formatDate(submission.submission.submitted_at)}
                        </p>
                        <pre className="max-h-72 overflow-auto rounded-xl bg-muted/40 p-4 text-sm leading-6 whitespace-pre-wrap">
                          {submission.content}
                        </pre>
                        <p className="text-xs text-muted-foreground">
                          비비 검토: {submission.review.summary} · 반영{' '}
                          {
                            submission.review.suggestions.filter(
                              (item) => item.decision === 'APPLIED',
                            ).length
                          }
                          개, 넘김{' '}
                          {
                            submission.review.suggestions.filter(
                              (item) => item.decision === 'SKIPPED',
                            ).length
                          }
                          개
                          {submission.review.unavailable_references.length >
                            0 &&
                            ` · 비교하지 못한 문서: ${submission.review.unavailable_references.map(statusLabel).join(', ')}`}
                        </p>
                        {rejecting ? (
                          <ActionForm
                            fields={[
                              {
                                name: 'reason',
                                label: '반려 사유',
                                type: 'textarea',
                                required: true,
                                max: 10000,
                              },
                            ]}
                            submitLabel="반려하기"
                            destructive
                            onSubmit={async (values) => {
                              await action.run(
                                () =>
                                  documentsApi.decideSubmission(
                                    projectId,
                                    documentId,
                                    submission.submission.id,
                                    {
                                      decision: 'REJECT',
                                      rejection_reason: values.reason,
                                    },
                                  ),
                                '반려했어요. 올린 사람이 보완해 다시 요청해요.',
                              )
                              setRejecting(false)
                            }}
                          />
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setRejecting(true)}
                            >
                              반려
                            </Button>
                            <Button
                              disabled={action.busy}
                              onClick={() =>
                                run(
                                  () =>
                                    documentsApi.decideSubmission(
                                      projectId,
                                      documentId,
                                      submission.submission.id,
                                      { decision: 'APPROVE' },
                                    ),
                                  '승인했어요. 현재 문서로 옮겼어요.',
                                )
                              }
                            >
                              승인
                            </Button>
                          </div>
                        )}
                        {/* API 없음: 승인·반려 결과를 올린 사람에게 알리는 공통 알림 연동(dev TODO) */}
                      </div>
                    )}
                  </AsyncState>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    팀장 승인을 기다리고 있어요. 결과는 이 화면에서 확인할 수
                    있어요.
                  </p>
                ))}
              {data.status === 'APPROVED' && (
                <p className="text-sm">
                  팀장이 승인했어요. 목록의 현재 문서에서 볼 수 있어요.
                </p>
              )}
            </>
          )
        }}
      </AsyncState>
    </section>
  )
}

function Suggestions({
  review,
  owner,
  busy,
  onDecide,
}: {
  review: DocumentBeeReview
  owner: boolean
  busy: boolean
  onDecide: (suggestionId: string, decision: 'APPLY' | 'SKIP') => void
}) {
  return (
    <div className="grid gap-3">
      <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
        <strong>
          비비가 수정 제안 {review.suggestions.length}개를 남겼어요
        </strong>
        <p className="mt-1 leading-6">{review.summary}</p>
        {review.unavailable_references.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            승인본이 없어 비교하지 못한 문서:{' '}
            {review.unavailable_references.map(statusLabel).join(', ')}
          </p>
        )}
      </div>
      <ol className="grid gap-2">
        {review.suggestions.map((suggestion, index) => (
          <li
            key={suggestion.id}
            className="grid gap-2 rounded-xl border p-3 text-sm"
          >
            <p className="flex flex-wrap items-center justify-between gap-2">
              <strong>
                제안 {index + 1} · {suggestion.explanation}
              </strong>
              {suggestion.decision !== 'PENDING' && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {suggestion.decision === 'APPLIED' ? '반영함' : '넘김'}
                </span>
              )}
            </p>
            <div className="grid gap-1 font-mono text-xs leading-6 whitespace-pre-wrap">
              <p className="rounded bg-destructive/5 px-2 text-destructive">
                − {suggestion.original_text}
              </p>
              <p className="rounded bg-primary/10 px-2">
                + {suggestion.replacement_text}
              </p>
            </div>
            {owner && suggestion.decision === 'PENDING' && (
              <span className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onDecide(suggestion.id, 'SKIP')}
                >
                  넘기기
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => onDecide(suggestion.id, 'APPLY')}
                >
                  반영하기
                </Button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!owner && (
        <p className="text-xs text-muted-foreground">
          제안은 올린 사람이 반영하거나 넘겨요.
        </p>
      )}
    </div>
  )
}

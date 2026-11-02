import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Plus } from 'lucide-react'
import type { TaskDetail } from '@/api/contracts/common'
import { getApiErrorMessage } from '@/api/error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { normalizeDocument } from './normalizeDocument'
import { proposalFormSchema } from './proposalItems'
import type { ProposalFormValues } from './proposalItems'

interface Props {
  heading: string
  submitLabel: string
  tasks: TaskDetail[]
  /** 고칠 수 있는 현재 문서. 목록 응답에는 본문이 없어 원문은 fetchDocumentContent로 따로 받는다. */
  documents?: { id: string; label: string }[]
  /** 고른 문서의 기준 원문(DOC-A03 문서 원문 조회) */
  fetchDocumentContent?: (documentId: string) => Promise<string>
  /** 다시 내는 제안에서 폼 밖에 그대로 함께 올라가는 문서 이름 */
  keptDocuments?: string[]
  /** 에이전트·회의가 만든 제안의 설계 항목 변경. 보기만 하고 다시 낼 때 받은 그대로 보낸다. */
  fixedItems?: { label: string; detail?: string }[]
  defaultValues?: ProposalFormValues
  // 제안 고치기 · 고쳐서 새로 올리기에서 쓴다.
  status?: ReactNode
  description?: string
  footnote?: string
  comments?: { id: string; author: string; body: string }[]
  onShowComments?: () => void
  onSubmit: (values: ProposalFormValues) => Promise<unknown>
  onCancel: () => void
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  ) : null
}

// 문서 수정 제안 · 창 안에서. 공용 문서함 '고치기'로 그 문서를 고른 채 열리고, 필수는 제목, 이유, 고친 글이다.
// 제안 고치기는 같은 폼에 지금 내용을 채우고 받은 의견을 옆에 둔다. 설계 항목 변경은 보기만 한다.
export function ProposalForm({
  heading,
  submitLabel,
  tasks,
  documents = [],
  fetchDocumentContent,
  keptDocuments = [],
  fixedItems = [],
  defaultValues,
  status,
  description,
  footnote = '올리면 관련 팀원에게 알림이 가고 AI 영향 분석이 시작돼요. 제출만으로 기준이 바뀌지는 않아요.',
  comments,
  onShowComments,
  onSubmit,
  onCancel,
}: Props) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: defaultValues ?? {
      title: '',
      reason: '',
      task_id: '',
      document_id: '',
      after_content: '',
    },
  })
  // 문서함 '고치기'로 오면 고칠 문서 칸이 열린 채, 설계 항목만 있던 제안은 '+ 문서 고치기'로 연다.
  const [documentOpen, setDocumentOpen] = useState(
    !!defaultValues?.document_id || !fixedItems.length,
  )
  const documentId = useWatch({ control, name: 'document_id' })
  const content = useQuery({
    queryKey: ['documents', documentId, 'approved-content'],
    queryFn: () => fetchDocumentContent!(documentId!),
    enabled: !!documentId && !!fetchDocumentContent,
  })
  // 고른 문서의 기준 원문을 받으면 '고친 글'이 비어 있을 때만 채운다. 다시 내는 제안처럼 글이 이미 있으면 두고,
  // 문서를 바꾸면 비운 뒤(아래 onChange) 새 원문으로 채운다.
  useEffect(() => {
    if (documentId && content.data !== undefined && !getValues('after_content'))
      setValue('after_content', content.data)
  }, [documentId, content.data, getValues, setValue])
  return (
    <form
      noValidate
      onSubmit={handleSubmit((form) => {
        // 서버는 본문을 정규화(BOM 제거, CRLF→LF)해 기준과 같은 문서를 거절한다(PR #46).
        // 같은 규칙으로 비교해 바뀌지 않은 문서는 빼고, 남는 변경이 없으면 막는다.
        const base =
          form.document_id && form.document_id === documentId
            ? content.data
            : undefined
        const unchanged =
          base !== undefined &&
          normalizeDocument(form.after_content ?? '') ===
            normalizeDocument(base)
        if (unchanged && !keptDocuments.length && !fixedItems.length) {
          setError('after_content', {
            message: '기준 문서와 달라진 내용이 없어요.',
          })
          return
        }
        return onSubmit(
          unchanged ? { ...form, document_id: '', after_content: '' } : form,
        ).catch(() => undefined)
      })}
      className="grid gap-4"
    >
      <div>
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold">
          {heading}
          {status}
        </h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="grid content-start gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="proposal-title">제목 *</Label>
            <Input
              id="proposal-title"
              aria-invalid={!!errors.title}
              {...register('title')}
            />
            <FieldError message={errors.title?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="proposal-reason">바꾸려는 이유 *</Label>
            <Textarea
              id="proposal-reason"
              rows={3}
              aria-invalid={!!errors.reason}
              {...register('reason')}
            />
            <FieldError message={errors.reason?.message} />
          </div>
          {comments && (
            <section
              aria-label="받은 의견"
              className="grid gap-1.5 rounded-xl bg-muted/40 p-3 text-sm"
            >
              <p className="flex justify-between font-semibold">
                받은 의견 {comments.length}
                {onShowComments && (
                  <button
                    type="button"
                    className="text-xs font-normal underline"
                    onClick={onShowComments}
                  >
                    의견 탭에서 보기
                  </button>
                )}
              </p>
              {comments.length ? (
                comments.slice(0, 3).map((comment) => (
                  <p key={comment.id} className="text-xs leading-5">
                    <strong>{comment.author}</strong> · {comment.body}
                  </p>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  아직 받은 의견이 없어요.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                고쳐도 받은 의견은 그대로 남아요.
              </p>
            </section>
          )}
          <details className="rounded-xl border p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              관련 작업 연결 (선택)
            </summary>
            <NativeSelect
              aria-label="관련 작업"
              className="mt-3"
              {...register('task_id')}
            >
              <NativeSelectOption value="">연결하지 않음</NativeSelectOption>
              {tasks.map((task) => (
                <NativeSelectOption key={task.id} value={task.id}>
                  {task.key} · {task.current_plan_revision.plan.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {/* API 없음: 검증·회의 출처 연결은 변경 제안 출처 필드가 정해지면 둔다(백엔드 메모 3). */}
          </details>
        </div>
        <div className="grid content-start gap-4">
          {documents.length > 0 && !documentOpen && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => setDocumentOpen(true)}
            >
              <Plus />
              문서 고치기
            </Button>
          )}
          {documents.length > 0 && documentOpen && (
            <div className="grid gap-2 rounded-xl border p-3">
              <Label htmlFor="proposal-document">고칠 문서</Label>
              <NativeSelect
                id="proposal-document"
                aria-invalid={!!errors.document_id}
                {...register('document_id', {
                  onChange: () => setValue('after_content', ''),
                })}
              >
                <NativeSelectOption value="">
                  {keptDocuments.length || fixedItems.length
                    ? '고치지 않음'
                    : '문서 고르기'}
                </NativeSelectOption>
                {documents.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {item.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError message={errors.document_id?.message} />
              {documentId && (
                <>
                  {content.isLoading && (
                    <p role="status" className="text-xs text-muted-foreground">
                      기준 원문을 불러오는 중…
                    </p>
                  )}
                  {content.error && (
                    <div
                      role="alert"
                      className="flex flex-wrap items-center gap-2 text-xs text-destructive"
                    >
                      기준 원문을 불러오지 못했어요.{' '}
                      {getApiErrorMessage(content.error)}
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => void content.refetch()}
                      >
                        다시 불러오기
                      </Button>
                    </div>
                  )}
                  <Textarea
                    aria-label="고친 글"
                    rows={10}
                    aria-invalid={!!errors.after_content}
                    {...register('after_content')}
                  />
                  <FieldError message={errors.after_content?.message} />
                  {/* API 없음: '파일 올리기'(DOC-A12 변경용 원문 → proposed_document_version_id)는 화면만 정해져 있어 고친 글 쓰기만 둔다. */}
                  <p className="text-xs text-muted-foreground">
                    올리면 지금 기준 원문과 비교해 보여 줘요.
                  </p>
                </>
              )}
            </div>
          )}
          {keptDocuments.length > 0 && (
            <p className="rounded-xl bg-muted/40 p-3 text-sm">
              함께 올라가는 문서 변경 {keptDocuments.length}개:{' '}
              {keptDocuments.join(', ')}
              <span className="block text-xs text-muted-foreground">
                고치지 않아도 처음 올린 글 그대로 다시 올라가요.
              </span>
            </p>
          )}
          {fixedItems.length > 0 && (
            <section
              aria-label="함께 올라가는 설계 항목 변경"
              className="grid gap-1.5 rounded-xl bg-muted/40 p-3 text-sm"
            >
              <p className="font-semibold">
                함께 올라가는 설계 항목 변경 {fixedItems.length}개
              </p>
              <ul className="grid gap-1">
                {fixedItems.map((item, index) => (
                  <li key={index} className="text-xs leading-5">
                    <strong>{item.label}</strong>
                    {item.detail && ` · ${item.detail}`}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                에이전트나 회의에서 만든 항목이라 여기서는 고치지 않고 처음 올린
                그대로 다시 올라가요.
              </p>
            </section>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <p className="mr-auto text-xs text-muted-foreground">{footnote}</p>
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '처리 중…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

import type { ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Plus, X } from 'lucide-react'
import type { DesignItemVersion, TaskDetail } from '@/api/contracts/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { describeContent } from '@/lib/display'
import { cn } from '@/lib/utils'
import {
  emptyRow,
  kindLabel,
  operationLabel,
  proposalFormSchema,
} from './proposalItems'
import type { ProposalFormValues, ProposalRow } from './proposalItems'

interface Props {
  heading: string
  submitLabel: string
  items: DesignItemVersion[]
  tasks: TaskDetail[]
  /** 고칠 수 있는 현재 문서(기준 원문 포함) */
  documents?: { id: string; label: string; content: string }[]
  defaultValues?: ProposalFormValues
  // 제안 고치기 · 고쳐서 새로 올리기에서 쓴다.
  status?: ReactNode
  description?: string
  footnote?: string
  original?: ProposalRow[]
  comments?: { id: string; author: string; body: string }[]
  baselineVersion?: number
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

// 새 변경 제안 · 창 안에서. 필수는 제목, 이유, 그리고 바꿀 설계 항목이나 고칠 문서 중 하나(PNL-04 수정안 문서 원문 포함).
// 제안 고치기는 같은 폼에 지금 내용을 채우고, 받은 의견을 옆에 두고, 고친 항목에 처음 올린 문장을 보여 준다.
export function ProposalForm({
  heading,
  submitLabel,
  items,
  tasks,
  documents = [],
  defaultValues,
  status,
  description,
  footnote = '올리면 관련 팀원에게 알림이 가고 AI 영향 분석이 시작돼요. 제출만으로 기준이 바뀌지는 않아요.',
  original,
  comments,
  baselineVersion,
  onShowComments,
  onSubmit,
  onCancel,
}: Props) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: defaultValues ?? {
      title: '',
      reason: '',
      task_id: '',
      items: [emptyRow],
      document_id: '',
      after_content: '',
    },
  })
  const rows = useFieldArray({ control, name: 'items' })
  const values = useWatch({ control, name: 'items' })
  const documentId = useWatch({ control, name: 'document_id' })
  return (
    <form
      noValidate
      onSubmit={handleSubmit((form) => onSubmit(form).catch(() => undefined))}
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
          {documents.length > 0 && (
            <div className="grid gap-2 rounded-xl border p-3">
              <Label htmlFor="proposal-document">
                고칠 문서{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  선택
                </span>
              </Label>
              <NativeSelect
                id="proposal-document"
                {...register('document_id', {
                  onChange: (event) =>
                    setValue(
                      'after_content',
                      documents.find((item) => item.id === event.target.value)
                        ?.content ?? '',
                    ),
                })}
              >
                <NativeSelectOption value="">고치지 않음</NativeSelectOption>
                {documents.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {item.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {documentId && (
                <>
                  <Textarea
                    aria-label="고친 글"
                    rows={6}
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
        <fieldset className="grid content-start gap-3">
          <legend className="mb-2 text-sm font-medium">바꿀 설계 항목</legend>
          {rows.fields.map((field, index) => {
            const row = values?.[index] ?? field
            const rowErrors = errors.items?.[index]
            const base = items.find(
              (item) => item.design_item_id === row.design_item_id,
            )
            const before = original?.[index]
            const changed =
              !!before &&
              (before.operation !== row.operation ||
                before.design_item_id !== row.design_item_id ||
                before.sentence !== row.sentence)
            return (
              <div
                key={field.id}
                className={cn(
                  'grid gap-2 rounded-xl border p-3',
                  changed && 'border-2 border-primary',
                )}
                aria-label={`설계 항목 ${index + 1}`}
                role="group"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <NativeSelect
                    aria-label={`항목 ${index + 1} 변경 종류`}
                    {...register(`items.${index}.operation`)}
                  >
                    {Object.entries(operationLabel).map(([value, label]) => (
                      <NativeSelectOption key={value} value={value}>
                        {label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {row.operation === 'CREATE' ? (
                    <NativeSelect
                      aria-label={`항목 ${index + 1} 종류`}
                      {...register(`items.${index}.kind`)}
                    >
                      {Object.entries(kindLabel).map(([value, label]) => (
                        <NativeSelectOption key={value} value={value}>
                          {label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  ) : (
                    <NativeSelect
                      aria-label={`항목 ${index + 1} 설계 항목`}
                      aria-invalid={!!rowErrors?.design_item_id}
                      {...register(`items.${index}.design_item_id`)}
                    >
                      <NativeSelectOption value="">
                        항목 고르기
                      </NativeSelectOption>
                      {items.map((item) => (
                        <NativeSelectOption
                          key={item.design_item_id}
                          value={item.design_item_id}
                        >
                          {item.key} · 승인 v{item.version_no}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                  {changed && (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold">
                      고친 항목
                    </span>
                  )}
                  {(rows.fields.length > 1 || !!documentId) && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="ml-auto"
                      aria-label={`항목 ${index + 1} 빼기`}
                      onClick={() => rows.remove(index)}
                    >
                      <X />
                    </Button>
                  )}
                </div>
                <FieldError message={rowErrors?.design_item_id?.message} />
                {row.operation !== 'RETIRE' && (
                  <>
                    <Input
                      aria-label={`항목 ${index + 1} 바뀔 문장`}
                      placeholder="바뀔 문장을 한 줄로 써 주세요"
                      aria-invalid={!!rowErrors?.sentence}
                      {...register(`items.${index}.sentence`)}
                    />
                    <FieldError message={rowErrors?.sentence?.message} />
                  </>
                )}
                {base && row.operation !== 'CREATE' && (
                  <p className="text-xs text-muted-foreground">
                    {baselineVersion
                      ? `지금 기준 v${baselineVersion}`
                      : '지금 승인본'}
                    : {describeContent(base.content)}
                  </p>
                )}
                {changed && before.sentence && (
                  <p className="text-xs text-muted-foreground">
                    처음 올린 문장: {before.sentence}
                  </p>
                )}
              </div>
            )
          })}
          <FieldError
            message={errors.items?.root?.message ?? errors.items?.message}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => rows.append(emptyRow)}
          >
            <Plus />
            항목 추가
          </Button>
        </fieldset>
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

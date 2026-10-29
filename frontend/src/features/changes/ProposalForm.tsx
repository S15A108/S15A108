import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Plus, X } from 'lucide-react'
import type { DesignItemVersion, TaskDetail } from '@/api/contracts/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import {
  describeContent,
  emptyRow,
  kindLabel,
  operationLabel,
  proposalFormSchema,
} from './proposalItems'
import type { ProposalFormValues } from './proposalItems'

interface Props {
  heading: string
  submitLabel: string
  items: DesignItemVersion[]
  tasks: TaskDetail[]
  defaultValues?: ProposalFormValues
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

// 새 변경 제안 · 창 안에서. 필수는 제목, 이유, 바꿀 설계 항목 하나 이상. 문서는 공용 문서함에서 새 버전을 올린다.
export function ProposalForm({
  heading,
  submitLabel,
  items,
  tasks,
  defaultValues,
  onSubmit,
  onCancel,
}: Props) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: defaultValues ?? {
      title: '',
      reason: '',
      task_id: '',
      items: [emptyRow],
    },
  })
  const rows = useFieldArray({ control, name: 'items' })
  const values = useWatch({ control, name: 'items' })
  return (
    <form
      noValidate
      onSubmit={handleSubmit((form) => onSubmit(form).catch(() => undefined))}
      className="grid gap-4"
    >
      <h3 className="text-lg font-bold">{heading}</h3>
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
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">바꿀 설계 항목 *</legend>
        {rows.fields.map((field, index) => {
          const row = values?.[index] ?? field
          const rowErrors = errors.items?.[index]
          const base = items.find(
            (item) => item.design_item_id === row.design_item_id,
          )
          return (
            <div
              key={field.id}
              className="grid gap-2 rounded-xl border p-3"
              aria-label={`설계 항목 ${index + 1}`}
              role="group"
            >
              <div className="flex flex-wrap gap-2">
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
                {rows.fields.length > 1 && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`항목 ${index + 1} 빼기`}
                    onClick={() => rows.remove(index)}
                  >
                    <X />
                  </Button>
                )}
              </div>
              <FieldError message={rowErrors?.design_item_id?.message} />
              {base && row.operation !== 'CREATE' && (
                <p className="text-xs text-muted-foreground">
                  지금: {describeContent(base.content)}
                </p>
              )}
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
      <p className="text-xs text-muted-foreground">
        문서를 고치려면 공용 문서함에서 새 버전을 올려 주세요. 제출만으로 기준이
        바뀌지는 않아요.
      </p>
      <div className="flex justify-end gap-2">
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

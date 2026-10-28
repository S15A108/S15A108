import { useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getApiErrorMessage } from '@/api/error'
import { objectParticle } from '@/lib/display'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

export interface FormField {
  name: string
  label: string
  type?: 'email' | 'password' | 'textarea' | 'select' | 'text'
  required?: boolean
  min?: number
  max?: number
  value?: string
  placeholder?: string
  matches?: string
  options?: { value: string; label: string }[]
  /** 추가 규칙. 틀리면 보여 줄 문구를 돌려준다. */
  check?: (value: string) => string | undefined
  /** 입력 칸 오른쪽 위에 글자 수를 보여 준다. max가 있어야 한다. */
  counter?: boolean
}
interface Props {
  fields: FormField[]
  onSubmit: (values: Record<string, string>) => Promise<unknown>
  submitLabel: string
  onBusyChange?: (busy: boolean) => void
  /** 입력 칸과 제출 버튼 사이에 넣을 내용 */
  footer?: ReactNode
  /** 제출 버튼을 폼 너비로 늘린다 */
  block?: boolean
  /** 되돌릴 수 없는 동작이면 빨간 버튼 */
  destructive?: boolean
  /** 제출 버튼을 끈다 (확인 체크 전 등) */
  disabled?: boolean
}

export function ActionForm({
  fields,
  onSubmit,
  submitLabel,
  onBusyChange,
  footer,
  block,
  destructive,
  disabled,
}: Props) {
  const formId = useId()
  const [error, setError] = useState('')
  const [shown, setShown] = useState<Record<string, boolean>>({})
  const schema = useMemo(
    () =>
      z.record(z.string(), z.string()).superRefine((values, context) => {
        for (const field of fields) {
          const value = values[field.name] ?? ''
          if (field.required && !value.trim())
            context.addIssue({
              code: 'custom',
              path: [field.name],
              message: `${field.label}${objectParticle(field.label)} 입력해 주세요.`,
            })
          else if (field.min && value.length < field.min)
            context.addIssue({
              code: 'custom',
              path: [field.name],
              message: `${field.min}자 이상 입력해 주세요.`,
            })
          else if (field.max && value.length > field.max)
            context.addIssue({
              code: 'custom',
              path: [field.name],
              message: `${field.max}자 이하로 입력해 주세요.`,
            })
          else if (
            field.type === 'email' &&
            value &&
            !z.email().safeParse(value).success
          )
            context.addIssue({
              code: 'custom',
              path: [field.name],
              message: '이메일 형식을 확인해 주세요.',
            })
          else if (field.matches && value !== values[field.matches])
            context.addIssue({
              code: 'custom',
              path: [field.name],
              message: '입력한 비밀번호가 서로 달라요.',
            })
          else if (value && field.check?.(value))
            context.addIssue({
              code: 'custom',
              path: [field.name],
              message: field.check(value)!,
            })
        }
      }),
    [fields],
  )
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      fields.map((field) => [
        field.name,
        field.value ?? field.options?.[0]?.value ?? '',
      ]),
    ),
  })
  const watched = useWatch({ control })
  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        setError('')
        onBusyChange?.(true)
        try {
          await onSubmit(values)
        } catch (cause) {
          setError(getApiErrorMessage(cause))
        } finally {
          onBusyChange?.(false)
        }
      })}
    >
      {fields.map((field) => (
        <div key={field.name} className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`${formId}-${field.name}`}>
              {field.label}
              {field.required && (
                <span aria-hidden="true" className="text-destructive">
                  {' '}
                  *
                </span>
              )}
            </Label>
            {field.counter && field.max && (
              <span className="text-xs text-muted-foreground">
                {(watched[field.name] ?? '').length} / {field.max}
              </span>
            )}
          </div>
          {field.type === 'textarea' ? (
            <Textarea
              id={`${formId}-${field.name}`}
              rows={4}
              placeholder={field.placeholder}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors[field.name])}
              {...register(field.name)}
            />
          ) : field.type === 'select' ? (
            <NativeSelect
              id={`${formId}-${field.name}`}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors[field.name])}
              {...register(field.name)}
            >
              {field.options?.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : field.type === 'password' ? (
            <div className="relative">
              <Input
                id={`${formId}-${field.name}`}
                type={shown[field.name] ? 'text' : 'password'}
                autoComplete={
                  field.check || field.matches
                    ? 'new-password'
                    : 'current-password'
                }
                className="pr-10"
                placeholder={field.placeholder}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors[field.name])}
                {...register(field.name)}
              />
              <button
                type="button"
                aria-label={
                  shown[field.name] ? '비밀번호 숨기기' : '비밀번호 보기'
                }
                className="absolute top-0 right-0 grid h-full w-9 place-items-center text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setShown((state) => ({
                    ...state,
                    [field.name]: !state[field.name],
                  }))
                }
              >
                {shown[field.name] ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          ) : (
            <Input
              id={`${formId}-${field.name}`}
              type={field.type ?? 'text'}
              autoComplete={field.type === 'email' ? 'email' : 'off'}
              placeholder={field.placeholder}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors[field.name])}
              {...register(field.name)}
            />
          )}
          {errors[field.name] && (
            <p role="alert" className="text-xs text-destructive">
              {String(errors[field.name]?.message ?? '')}
            </p>
          )}
        </div>
      ))}
      {footer}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant={destructive ? 'destructive' : 'default'}
        disabled={isSubmitting || disabled}
        className={block ? 'w-full' : 'justify-self-end'}
      >
        {isSubmitting ? '처리 중…' : submitLabel}
      </Button>
    </form>
  )
}

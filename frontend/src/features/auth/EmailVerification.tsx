import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { clock, confirmCode, sendCode, verificationMessage } from './emailCode'

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, '이메일을 입력해 주세요.')
    .pipe(z.email('이메일 형식을 확인해 주세요.')),
  code: z.string().regex(/^\d{6}$/, '6자리 숫자를 입력해 주세요.'),
})

/** 회원가입 이메일 인증 (SCR-01 수정안). 인증한 이메일을 onVerified로 알린다. */
export function EmailVerification({
  needed,
  onVerified,
}: {
  /** 인증 없이 가입하기를 눌렀을 때 */
  needed: boolean
  onVerified: (email: string | null) => void
}) {
  const {
    register,
    trigger,
    getValues,
    resetField,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', code: '' },
  })
  const [sent, setSent] = useState<ReturnType<typeof sendCode> | null>(null)
  const [verified, setVerified] = useState(false)
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!sent || verified) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [sent, verified])
  const left = sent ? Date.parse(sent.expires_at) - now : 0
  const expired = Boolean(sent) && !verified && left <= 0
  const resendIn = sent ? Date.parse(sent.resend_available_at) - now : 0

  const send = async () => {
    if (!(await trigger('email'))) return
    setSent(sendCode(getValues('email').trim()))
    setNow(Date.now())
    setMessage('')
    resetField('code')
  }
  const confirm = async () => {
    if (!sent || !(await trigger('code'))) return
    try {
      const result = confirmCode(sent.verification_id, getValues('code'))
      setVerified(true)
      setMessage('')
      onVerified(result.email)
    } catch (cause) {
      setMessage(verificationMessage(cause))
    }
  }
  const restart = () => {
    setSent(null)
    setVerified(false)
    setMessage('')
    resetField('code')
    onVerified(null)
  }
  const codeError =
    errors.code?.message ??
    (expired ? '인증 시간이 지났어요. 다시 받기' : message)

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="register-email">
            이메일
            <span aria-hidden="true" className="text-destructive">
              {' '}
              *
            </span>
          </Label>
          {verified && <Badge variant="secondary">인증됨</Badge>}
        </div>
        <div className="flex gap-2">
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            readOnly={verified}
            aria-invalid={Boolean(errors.email)}
            {...register('email', { onChange: () => sent && restart() })}
          />
          {verified ? (
            <Button type="button" variant="outline" onClick={restart}>
              이메일 바꾸기
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(sent) && !expired && resendIn > 0}
              onClick={send}
            >
              {sent ? '다시 받기' : '인증 코드 받기'}
            </Button>
          )}
        </div>
        {errors.email && (
          <p role="alert" className="text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
        {needed && !verified && !errors.email && (
          <p role="alert" className="text-xs text-destructive">
            이메일 인증을 먼저 해 주세요.
          </p>
        )}
      </div>
      {sent && !verified && (
        <div className="grid gap-2 rounded-xl border bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="register-code">인증 코드</Label>
            <span
              className={cn(
                'text-xs tabular-nums',
                expired ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              남은 시간 {clock(left)}
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              id="register-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6자리 숫자"
              disabled={expired}
              aria-invalid={Boolean(codeError)}
              className={cn(expired && 'border-destructive')}
              {...register('code')}
            />
            <Button type="button" disabled={expired} onClick={confirm}>
              확인
            </Button>
          </div>
          {codeError ? (
            <p role="alert" className="text-xs text-destructive">
              {codeError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {sent.mock_code
                ? `예시 환경이라 메일을 보내지 않아요. 예시 코드: ${sent.mock_code}`
                : '메일로 받은 6자리 코드를 5분 안에 입력해 주세요.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

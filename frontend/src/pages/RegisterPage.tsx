import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { authApi } from '@/api/services'
import { ActionForm, type FormField } from '@/components/ActionForm'
import { EmailVerification } from '@/features/auth/EmailVerification'
import { emailVerificationEnabled } from '@/features/auth/emailCode'
import { passwordRule } from '@/features/auth/passwordRule'

const passwordFields: FormField[] = [
  {
    name: 'password',
    label: '비밀번호',
    type: 'password',
    required: true,
    min: 8,
    max: 128,
    check: passwordRule,
    placeholder: '영문·숫자·특수문자 포함 8자 이상',
  },
  {
    name: 'confirm',
    label: '비밀번호 확인',
    type: 'password',
    required: true,
    matches: 'password',
  },
]

export default function RegisterPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null)
  const [needVerify, setNeedVerify] = useState(false)
  const invite = params.get('invite')
  const login = invite
    ? `/login?invite=${encodeURIComponent(invite)}`
    : '/login'
  return (
    <main className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-xl content-center px-6 py-12">
      <section
        aria-labelledby="register-title"
        className="rounded-3xl border bg-card p-7 shadow-sm sm:p-10"
      >
        <h2 id="register-title" className="text-2xl font-bold">
          회원가입
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          가입하면 나의 도시에 첫 프로젝트를 만들 수 있어요.
        </p>
        <div className="mt-7 grid gap-5">
          {/* 인증 계약(ACC-A11·A12)이 없는 live 모드는 인증 없이 가입한다. emailCode.ts 참고 */}
          {emailVerificationEnabled && (
            <EmailVerification
              needed={needVerify}
              onVerified={setVerifiedEmail}
            />
          )}
          <ActionForm
            block
            fields={[
              { name: 'name', label: '이름', required: true, max: 40 },
              ...(emailVerificationEnabled
                ? []
                : [
                    {
                      name: 'email',
                      label: '이메일',
                      type: 'email',
                      required: true,
                    } as const,
                  ]),
              ...passwordFields,
            ]}
            submitLabel="가입하기"
            onSubmit={async (values) => {
              const email = emailVerificationEnabled
                ? verifiedEmail
                : values.email
              if (!email) {
                setNeedVerify(true)
                return
              }
              await authApi.register({
                name: values.name,
                email,
                password: values.password,
              })
              navigate(login, { state: { registered: email } })
            }}
          />
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          이미 계정이 있나요?{' '}
          <Link to={login} className="font-semibold text-foreground">
            로그인
          </Link>
        </p>
      </section>
    </main>
  )
}

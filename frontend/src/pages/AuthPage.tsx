import { useState } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { FileCheck, MessageCircle, Network } from 'lucide-react'
import { authApi } from '@/api/services'
import { getApiErrorMessage } from '@/api/error'
import { ActionForm } from '@/components/ActionForm'
import { apiMode } from '@/lib/apiMode'

const savedEmailKey = 'beez.login.email'
const readSavedEmail = () => {
  try {
    return localStorage.getItem(savedEmailKey) ?? ''
  } catch {
    return ''
  }
}

export default function AuthPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const state = location.state as { from?: string; registered?: string } | null
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [notice, setNotice] = useState(
    state?.registered ? '가입했어요. 등록한 계정으로 로그인해 주세요.' : '',
  )
  const [failure, setFailure] = useState('')
  // 실패하면 폼을 다시 그려 이메일은 남기고 비밀번호만 비운다.
  const [attempt, setAttempt] = useState(0)
  const [email, setEmail] = useState(state?.registered ?? readSavedEmail())
  const [remember, setRemember] = useState(Boolean(readSavedEmail()))
  const invite = params.get('invite')
  const mockDemo = apiMode === 'mock' && !email && attempt === 0
  return (
    <main className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-14 px-6 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:px-10">
      <section className="space-y-6">
        <h2 className="text-4xl leading-tight font-bold">
          우리 팀 프로젝트가
          <br />
          하나의 도시가 돼요
        </h2>
        <p className="max-w-md text-base leading-7 text-muted-foreground">
          프로젝트마다 건물이 하나씩 생겨요. 사람과 AI 팀장 비비가 승인된 설계를
          기준으로 함께 일해요.
        </p>
        <ul className="flex flex-wrap gap-2">
          {(
            [
              [FileCheck, '공용 문서와 승인 기준'],
              [MessageCircle, '근거를 기억하는 비비'],
              [Network, '작업과 동료를 잇는 맥락'],
            ] as const
          ).map(([Icon, label]) => (
            <li
              key={label}
              className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm"
            >
              <Icon className="size-4" />
              {label}
            </li>
          ))}
        </ul>
      </section>
      <section
        aria-labelledby="auth-title"
        className="rounded-3xl border bg-card p-7 shadow-sm sm:p-10"
      >
        <h2 id="auth-title" className="text-2xl font-bold">
          {mode === 'forgot' ? '비밀번호 찾기' : '로그인'}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === 'forgot'
            ? '가입한 이름과 이메일을 적으면 메일로 임시 비밀번호를 보내요.'
            : '나의 프로젝트로 돌아가요.'}
        </p>
        {(notice || failure) && (
          <p
            role={failure ? 'alert' : 'status'}
            className={
              failure
                ? 'mt-6 rounded-lg bg-destructive/5 p-3 text-sm text-destructive'
                : 'mt-6 rounded-lg bg-primary/10 p-3 text-sm'
            }
          >
            {failure || notice}
          </p>
        )}
        <div className="mt-7">
          {mode === 'login' ? (
            <ActionForm
              key={attempt}
              block
              fields={[
                {
                  name: 'email',
                  label: '이메일',
                  type: 'email',
                  required: true,
                  value: mockDemo ? 'demo@beez.local' : email,
                },
                {
                  name: 'password',
                  label: '비밀번호',
                  type: 'password',
                  required: true,
                  max: 128,
                  value: mockDemo ? 'beez-demo-2026' : '',
                },
              ]}
              footer={
                <div className="flex flex-wrap items-center gap-5 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                    />
                    아이디 저장
                  </label>
                  {/* API 없음: 로그인 유지(세션 기간) 계약이 정해지면 로그인 요청에 넣는다. */}
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" className="size-4 accent-primary" />
                    로그인 유지
                  </label>
                </div>
              }
              submitLabel="로그인"
              onSubmit={async (values) => {
                setFailure('')
                try {
                  const account = await authApi.login({
                    email: values.email,
                    password: values.password,
                  })
                  try {
                    if (remember)
                      localStorage.setItem(savedEmailKey, values.email)
                    else localStorage.removeItem(savedEmailKey)
                  } catch {
                    // 저장소를 못 쓰는 브라우저에서는 아이디 저장만 건너뛴다.
                  }
                  queryClient.setQueryData(['account'], account)
                  await queryClient.invalidateQueries({
                    queryKey: ['projects'],
                  })
                  navigate(
                    invite
                      ? `/invite?token=${encodeURIComponent(invite)}`
                      : state?.from?.startsWith('/projects/')
                        ? state.from
                        : '/',
                  )
                } catch (cause) {
                  setNotice('')
                  setFailure(getApiErrorMessage(cause))
                  setEmail(values.email)
                  setAttempt((value) => value + 1)
                }
              }}
            />
          ) : (
            <ActionForm
              block
              fields={[
                // API 없음: 비밀번호 찾기는 지금 email만 받는다. 이름 대조는 백엔드 계약 추가 뒤에 보낸다.
                { name: 'name', label: '이름', required: true, max: 40 },
                {
                  name: 'email',
                  label: '이메일',
                  type: 'email',
                  required: true,
                  value: email,
                },
              ]}
              // API 없음: 임시 비밀번호 발급 계약 전까지는 기존 재설정 메일 요청을 보낸다.
              submitLabel="임시 비밀번호 받기"
              onSubmit={async (values) => {
                const result = await authApi.forgotPassword({
                  email: values.email,
                })
                setNotice(result.message)
              }}
            />
          )}
        </div>
        <nav
          aria-label="계정 도움"
          className="mt-6 flex items-center justify-center gap-3 text-sm"
        >
          {mode === 'login' ? (
            <>
              <Link
                to={
                  invite
                    ? `/register?invite=${encodeURIComponent(invite)}`
                    : '/register'
                }
                className="font-semibold"
              >
                회원가입
              </Link>
              <span aria-hidden="true" className="h-3 w-px bg-border" />
              <button
                type="button"
                className="text-muted-foreground"
                onClick={() => {
                  setMode('forgot')
                  setNotice('')
                  setFailure('')
                }}
              >
                비밀번호 찾기
              </button>
            </>
          ) : (
            <button
              type="button"
              className="text-muted-foreground"
              onClick={() => {
                setMode('login')
                setNotice('')
              }}
            >
              ← 로그인
            </button>
          )}
        </nav>
      </section>
    </main>
  )
}

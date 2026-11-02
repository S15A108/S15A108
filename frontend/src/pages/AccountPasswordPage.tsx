import { Link, useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { authApi } from '@/api/services'
import { RequireAccount } from '@/features/auth/RequireAccount'
import { passwordRule } from '@/features/auth/passwordRule'
import { ActionForm } from '@/components/ActionForm'
import { Button } from '@/components/ui/button'

function AccountPassword() {
  const navigate = useNavigate()
  return (
    <main className="mx-auto max-w-xl space-y-6 px-6 py-10">
      <Button variant="ghost" asChild>
        <Link to="/account">
          <ArrowLeft />
          회원 설정
        </Link>
      </Button>
      <section className="rounded-3xl border bg-card p-8">
        <h2 className="text-2xl font-bold">비밀번호 변경</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          임시 비밀번호로 로그인했다면 여기서 새 비밀번호로 바꿔 주세요.
        </p>
        <div className="mt-7">
          <ActionForm
            block
            fields={[
              {
                name: 'current_password',
                label: '현재 비밀번호',
                type: 'password',
                required: true,
              },
              {
                name: 'new_password',
                label: '새 비밀번호',
                type: 'password',
                required: true,
                min: 8,
                max: 128,
                check: passwordRule,
                placeholder: '영문·숫자·특수문자 포함 8자 이상',
              },
              {
                name: 'confirm',
                label: '새 비밀번호 확인',
                type: 'password',
                required: true,
                matches: 'new_password',
              },
            ]}
            submitLabel="비밀번호 바꾸기"
            onSubmit={async (values) => {
              await authApi.changePassword({
                current_password: values.current_password,
                new_password: values.new_password,
              })
              navigate('/account', {
                state: {
                  toast:
                    '비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 쓰세요.',
                },
              })
            }}
          />
        </div>
      </section>
    </main>
  )
}

export default function AccountPasswordPage() {
  return (
    <RequireAccount>
      <AccountPassword />
    </RequireAccount>
  )
}

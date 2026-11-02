import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import { authApi, membersApi, projectsApi } from '@/api/services'
import { RequireAccount } from '@/features/auth/RequireAccount'
import { ActionForm } from '@/components/ActionForm'
import { AsyncState } from '@/components/AsyncState'
import { Button } from '@/components/ui/button'

function AccountWithdraw() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [agreed, setAgreed] = useState(false)
  // API 없음: 탈퇴를 막는 프로젝트 목록은 서버가 아직 주지 않는다.
  // 그 전까지는 내가 팀장이고 팀원이 있는 프로젝트를 화면에서 모은다. 최종 판정은 탈퇴 요청 때 서버가 한다.
  const blockers = useQuery({
    queryKey: ['projects', 'withdraw-blockers'],
    queryFn: async () => {
      const projects = await projectsApi.list({ limit: 100 })
      const led = projects.items.filter((item) => item.my_role === 'LEADER')
      // 팀원 수는 서버에 있는 팀원 목록(MEM-A02)으로 센다.
      const members = await Promise.all(
        led.map((item) => membersApi.list(item.id, { limit: 100 })),
      )
      return led
        .map((item, index) => ({
          ...item,
          member_count: members[index].items.length,
        }))
        .filter((item) => item.member_count > 1)
    },
  })
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-10">
      <Button variant="ghost" asChild>
        <Link to="/account">
          <ArrowLeft />
          회원 설정
        </Link>
      </Button>
      <h2 className="text-2xl font-bold">회원 탈퇴</h2>
      <section className="rounded-2xl border bg-card p-6">
        <h3 className="font-semibold">탈퇴하면 기존 프로젝트는 이렇게 돼요</h3>
        {/* 백엔드 결정 대기: 팀원 프로젝트 자동 탈퇴, 개인 프로젝트 삭제 여부에 따라 문구가 바뀐다. */}
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>팀원으로 참여한 프로젝트에서는 자동으로 빠져요.</li>
          <li>혼자 쓰는 프로젝트는 함께 삭제돼요.</li>
          <li>
            팀 프로젝트에 남긴 문서와 작업 기록은 보존 정책에 따라 남아요.
          </li>
        </ul>
      </section>
      <AsyncState query={blockers}>
        {(projects) => (
          <>
            {projects.length > 0 && (
              <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
                <h3 className="flex items-center gap-2 font-semibold text-destructive">
                  <TriangleAlert className="size-4" />이 프로젝트 때문에 지금은
                  탈퇴할 수 없어요
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  팀원이 있는 프로젝트의 팀장이에요. 팀장을 위임하거나
                  프로젝트를 삭제하면 탈퇴할 수 있어요.
                </p>
                <ul className="mt-4 grid gap-2">
                  {projects.map((project) => (
                    <li
                      key={project.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm"
                    >
                      <span>
                        <strong>{project.name}</strong>
                        <span className="ml-2 text-muted-foreground">
                          팀장 · 팀원 {project.member_count - 1}명
                        </span>
                      </span>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/projects/${project.id}?settings=team`}>
                          팀장 위임
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="rounded-2xl border bg-card p-6">
              <ActionForm
                fields={[
                  {
                    name: 'password',
                    label: '비밀번호 확인',
                    type: 'password',
                    required: true,
                  },
                ]}
                footer={
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 accent-primary"
                      checked={agreed}
                      onChange={(event) => setAgreed(event.target.checked)}
                    />
                    탈퇴하면 이 계정으로 다시 로그인할 수 없다는 것을
                    확인했어요.
                  </label>
                }
                submitLabel="회원 탈퇴"
                destructive
                disabled={!agreed || projects.length > 0}
                onSubmit={async (values) => {
                  await authApi.withdraw({ password: values.password })
                  queryClient.clear()
                  // 랜딩 페이지가 정해지면 그쪽으로 보낸다.
                  navigate('/login')
                }}
              />
              {projects.length > 0 && (
                <p className="mt-3 text-right text-xs text-muted-foreground">
                  위 프로젝트를 정리하면 버튼이 켜져요.
                </p>
              )}
            </section>
          </>
        )}
      </AsyncState>
    </main>
  )
}

export default function AccountWithdrawPage() {
  return (
    <RequireAccount>
      <AccountWithdraw />
    </RequireAccount>
  )
}

import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Bot, Hexagon, UserRound } from 'lucide-react'
import { agentsApi, authApi, projectsApi } from '@/api/services'
import { allTokens } from '@/features/agents/allTokens'
import { RequireAccount } from '@/features/auth/RequireAccount'
import { useSession } from '@/features/auth/useSession'
import { ActionForm } from '@/components/ActionForm'
import { AsyncState } from '@/components/AsyncState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/formatDate'
import { cn } from '@/lib/utils'

const avatars = [
  { value: 'human', label: '사람', icon: UserRound },
  { value: 'robot', label: '로봇', icon: Bot },
  { value: 'bee', label: '벌', icon: Hexagon },
] as const

function Account() {
  const session = useSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = (location.state as { toast?: string } | null)?.toast
  const [revoking, setRevoking] = useState<string | null>(null)
  const [avatar, setAvatar] = useState(session.data?.avatar ?? 'human')
  const picked = avatars.find((item) => item.value === avatar) ?? avatars[0]
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['account'] }),
        queryClient.invalidateQueries({ queryKey: ['my-tokens'] }),
      ])
    },
  })
  const tokens = useQuery({
    queryKey: ['my-tokens'],
    queryFn: async () => {
      const [tokens, projects] = await Promise.all([
        allTokens(),
        projectsApi.list(),
      ])
      return { tokens, projects }
    },
  })
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      {toast && (
        <p
          role="status"
          className="fixed top-20 right-6 z-30 rounded-xl border bg-card px-4 py-3 text-sm shadow-lg"
        >
          {toast}
        </p>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">회원 설정</h2>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft />
          이전 페이지로
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>프로필</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-8 md:grid-cols-[200px_1fr]">
          <div className="grid content-start gap-4">
            <div
              aria-label={`미리 보기: ${picked.label}`}
              className="grid aspect-square place-items-center rounded-2xl bg-muted"
            >
              <picked.icon className="size-20 text-primary" />
            </div>
            <fieldset className="grid grid-cols-3 gap-2">
              <legend className="mb-2 text-sm font-medium">아바타</legend>
              {avatars.map((item) => (
                <label
                  key={item.value}
                  className={cn(
                    'grid cursor-pointer justify-items-center gap-1 rounded-xl border p-2 text-xs',
                    avatar === item.value && 'border-primary bg-primary/10',
                  )}
                >
                  <input
                    type="radio"
                    name="avatar"
                    className="sr-only"
                    checked={avatar === item.value}
                    onChange={() => setAvatar(item.value)}
                  />
                  <item.icon className="size-5" />
                  {item.label}
                </label>
              ))}
            </fieldset>
          </div>
          <ActionForm
            key={session.data?.id}
            fields={[
              {
                name: 'name',
                label: '표시 이름',
                required: true,
                max: 40,
                value: session.data?.name,
              },
            ]}
            footer={
              <div className="grid gap-2">
                <Label htmlFor="account-email">이메일 (아이디)</Label>
                <Input
                  id="account-email"
                  value={session.data?.email ?? ''}
                  readOnly
                  disabled
                />
                {session.data && (
                  <p className="text-xs text-muted-foreground">
                    가입일 {formatDate(session.data.created_at)}
                  </p>
                )}
              </div>
            }
            submitLabel="프로필 저장"
            onSubmit={(values) =>
              mutation.mutateAsync(() =>
                authApi.updateMe({ name: values.name, avatar }),
              )
            }
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>비밀번호 변경</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿀 수 있어요.
          </p>
          <Button variant="outline" asChild>
            <Link to="/account/password">비밀번호 변경</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>내 에이전트 토큰</CardTitle>
          <p className="text-sm text-muted-foreground">
            프로젝트마다 따로 발급하는 개인 토큰이에요. 내 컴퓨터의 Claude
            Code가 그 프로젝트에 접속할 때 써요. 새 토큰은 각 프로젝트의 설정 ›
            에이전트에서 발급해요.
          </p>
        </CardHeader>
        <CardContent>
          <AsyncState query={tokens}>
            {(data) => {
              const active = data.tokens.filter((token) => !token.revoked_at)
              return active.length ? (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 font-medium">프로젝트</th>
                      <th className="py-2 font-medium">토큰 이름</th>
                      <th className="py-2 font-medium">발급일</th>
                      <th className="py-2 font-medium">최근 사용</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((token) => (
                      <tr key={token.id} className="border-b last:border-0">
                        <td className="py-3">
                          <Link
                            to={`/projects/${token.project_id}`}
                            className="font-semibold underline"
                          >
                            {data.projects.items.find(
                              (project) => project.id === token.project_id,
                            )?.name ?? '프로젝트'}
                          </Link>
                        </td>
                        <td>{token.label || '개인 토큰'}</td>
                        <td>{formatDate(token.created_at)}</td>
                        <td className="text-muted-foreground">
                          {token.last_used_at
                            ? formatDate(token.last_used_at)
                            : '기록 없음'}
                        </td>
                        <td className="text-right">
                          {revoking === token.id ? (
                            <span className="inline-flex items-center gap-2 text-xs">
                              연결이 바로 끊겨요.
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={mutation.isPending}
                                onClick={() =>
                                  mutation.mutate(
                                    () => agentsApi.revokeToken(token.id),
                                    { onSettled: () => setRevoking(null) },
                                  )
                                }
                              >
                                폐기하기
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRevoking(null)}
                              >
                                취소
                              </Button>
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRevoking(token.id)}
                            >
                              폐기
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  발급한 토큰이 없어요.
                </p>
              )
            }}
          </AsyncState>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>회원 탈퇴</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            팀원이 있는 팀 프로젝트는 팀장을 위임하거나 삭제한 뒤 탈퇴할 수
            있어요.
          </p>
          <Button variant="outline" className="text-destructive" asChild>
            <Link to="/account/withdraw">회원 탈퇴</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
export default function AccountPage() {
  return (
    <RequireAccount>
      <Account />
    </RequireAccount>
  )
}

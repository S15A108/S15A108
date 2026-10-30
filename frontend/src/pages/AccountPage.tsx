import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { agentsApi, authApi, projectsApi } from '@/api/services'
import { allTokens } from '@/features/agents/allTokens'
import { RequireAccount } from '@/features/auth/RequireAccount'
import { useSession } from '@/features/auth/useSession'
import { AsyncState } from '@/components/AsyncState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { characterOf, characters } from '@/lib/characters'
import { formatDate } from '@/lib/formatDate'
import { cn } from '@/lib/utils'

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '표시 이름을 입력해 주세요.')
    .max(40, '40자 이내로 입력해 주세요.'),
})
type ProfileInput = z.infer<typeof profileSchema>

// 표시 이름과 이메일(아이디)을 나란히, 아래에 안내와 저장 버튼(캔버스 SCR-05-v2-account).
function ProfileForm({
  name,
  email,
  onSave,
}: {
  name: string
  email: string
  onSave: (name: string) => Promise<unknown>
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name },
  })
  return (
    <form
      onSubmit={handleSubmit((values) => onSave(values.name))}
      className="grid gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <Label htmlFor="profile-name">표시 이름</Label>
          <Input
            id="profile-name"
            maxLength={40}
            aria-invalid={!!errors.name}
            className="h-10"
            {...register('name')}
          />
          {errors.name && (
            <p role="alert" className="text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor="profile-email">이메일 (아이디)</Label>
          <Input
            id="profile-email"
            value={email}
            readOnly
            className="h-10 bg-muted text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          저장하면 워크스페이스 HUD, 팀 목록, 3D 사무실에 이 캐릭터로 보여요.
        </p>
        <Button type="submit" disabled={isSubmitting}>
          프로필 저장
        </Button>
      </div>
    </form>
  )
}

function Account() {
  const session = useSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = (location.state as { toast?: string } | null)?.toast
  const [revoking, setRevoking] = useState<string | null>(null)
  const [avatar, setAvatar] = useState(session.data?.avatar)
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
  const picked = characterOf(avatar)
  return (
    <main className="mx-auto grid max-w-[1120px] gap-5 px-6 pt-8 pb-10">
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
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft />
          이전 페이지로
        </Button>
      </div>
      <div className="grid items-start gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside aria-label="내 프로필">
          <section className="grid justify-items-center gap-3 rounded-[14px] bg-card p-6 text-center ring-1 ring-foreground/10">
            <span
              className="grid size-42 place-items-end overflow-hidden rounded-full"
              style={{
                backgroundColor: `${picked.color}33`,
                boxShadow: `inset 0 0 0 3px ${picked.color}8c`,
              }}
            >
              <img
                src={picked.face}
                alt={`내 캐릭터: ${picked.label}`}
                className="w-[150px]"
              />
            </span>
            <div className="grid gap-0.5">
              <strong className="text-lg font-bold">
                {session.data?.name}
              </strong>
              <span className="text-[13px] text-muted-foreground">
                {session.data?.email}
              </span>
            </div>
            <span className="inline-flex h-6.5 items-center gap-1.5 rounded-full bg-muted px-2.5 text-[12.5px] font-semibold">
              <span
                aria-hidden="true"
                className="size-2.25 rounded-full"
                style={{ backgroundColor: picked.color }}
              />
              {picked.label} · 표시 색 {picked.colorName}
            </span>
            {session.data && (
              <span className="text-xs text-muted-foreground">
                가입일 {formatDate(session.data.created_at)}
              </span>
            )}
          </section>
        </aside>
        <div className="grid min-w-0 gap-5">
          <section
            aria-labelledby="profile-title"
            className="grid gap-5 rounded-[14px] bg-card p-6 ring-1 ring-foreground/10"
          >
            <div>
              <h3 id="profile-title" className="font-semibold">
                프로필 · 내 캐릭터
              </h3>
              <p className="mt-1 text-[13px] text-muted-foreground">
                3D 사무실에서 내가 쓰는 캐릭터예요. 프로젝트마다 같은 캐릭터로
                보여요.
              </p>
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">캐릭터</legend>
              <div className="grid grid-cols-5 gap-2.5">
                {characters.map((item) => {
                  const checked = picked.key === item.key
                  return (
                    <label
                      key={item.key}
                      className={cn(
                        'relative grid cursor-pointer gap-1.5 rounded-[14px] border bg-card p-2 pb-2.5',
                        checked &&
                          'border-2 border-[#c99e1e] bg-[#fffaeb] p-[7px] pb-[9px]',
                      )}
                    >
                      <input
                        type="radio"
                        name="character"
                        className="sr-only"
                        checked={checked}
                        onChange={() => setAvatar(item.key)}
                      />
                      <span
                        className="grid h-24 place-items-end overflow-hidden rounded-[10px]"
                        style={{ backgroundColor: `${item.color}29` }}
                      >
                        <img src={item.portrait} alt="" className="h-23" />
                      </span>
                      <span
                        className={cn(
                          'flex items-center justify-center gap-1.5 text-[13px] font-semibold',
                          checked && 'font-bold',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.label}
                      </span>
                      {checked && (
                        <span
                          aria-hidden="true"
                          className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"
                        >
                          <Check className="size-3" strokeWidth={3.5} />
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <ProfileForm
              key={session.data?.id}
              name={session.data?.name ?? ''}
              email={session.data?.email ?? ''}
              onSave={(name) =>
                mutation.mutateAsync(() =>
                  authApi.updateMe({ name, avatar: picked.key }),
                )
              }
            />
          </section>
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
                Code가 그 프로젝트에 접속할 때 써요. 새 토큰은 각 프로젝트의
                설정 › 에이전트에서 발급해요.
              </p>
            </CardHeader>
            <CardContent>
              <AsyncState query={tokens}>
                {(data) => {
                  const active = data.tokens.filter(
                    (token) => !token.revoked_at,
                  )
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
        </div>
      </div>
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

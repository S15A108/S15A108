import { useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { LoaderCircle } from 'lucide-react'
import { authApi, membersApi } from '@/api/services'
import { useSession } from '@/features/auth/useSession'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage, getApiErrorStatus } from '@/api/error'
import NotFoundPage from './NotFoundPage'

// Q05 초대 규칙(PR #42, 2026-10-29 확정): 수락 버튼은 없다.
// 로그인한 채로 링크를 열면 저절로 참여(MEM-A05)하고 프로젝트로 간다. 로그아웃이면 로그인·가입을 거쳐 같은 화면으로 돌아온다.
// 미리보기(MEM-A04)는 조회만 한다. 만료는 없다.
export default function InvitationPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? params.get('invite') ?? ''
  const session = useSession()
  const navigate = useNavigate()
  const client = useQueryClient()
  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => membersApi.previewInvitation({ token }),
    enabled: Boolean(token),
    retry: false,
  })
  const accept = useMutation({
    mutationFn: () => membersApi.acceptInvitation({ token }),
    onSuccess: async (data) => {
      await client.invalidateQueries({ queryKey: ['projects'] })
      navigate(`/projects/${data.project.id}`, { replace: true })
    },
  })
  const signedIn = Boolean(session.data)
  const ready = Boolean(invitation.data)
  const started = useRef(false)
  useEffect(() => {
    if (!signedIn || !ready || started.current) return
    started.current = true
    accept.mutate()
  }, [signedIn, ready, accept])
  const status = getApiErrorStatus(invitation.error)
  // 통신 실패와 서버 오류만 다시 불러오기. 나머지는 원인을 알리지 않고 '찾을 수 없음'으로 통일한다.
  const networkFailure =
    invitation.error &&
    ((isAxiosError(invitation.error) && !invitation.error.response) ||
      (status !== undefined && status >= 500))
  if (!token || (invitation.error && !networkFailure)) return <NotFoundPage />
  const encoded = encodeURIComponent(token)
  const relogin = async () => {
    await authApi.logout().catch(() => undefined)
    await client.invalidateQueries()
    navigate(`/login?invite=${encoded}`)
  }
  return (
    <main className="mx-auto mt-16 max-w-lg px-4">
      <section className="rounded-3xl border bg-card p-8">
        {invitation.isPending ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <LoaderCircle className="size-4 animate-spin" />
            초대를 확인하는 중…
          </p>
        ) : networkFailure || !invitation.data ? (
          <div role="alert" className="grid gap-4">
            <p>초대를 불러오지 못했어요. 연결 상태를 확인해 주세요.</p>
            <Button
              variant="outline"
              className="justify-self-start"
              onClick={() => void invitation.refetch()}
            >
              다시 불러오기
            </Button>
          </div>
        ) : (
          <div className="grid gap-6">
            <div>
              <p className="text-sm text-muted-foreground">
                프로젝트에 초대받았어요
              </p>
              {/* API 없음: 미리보기 응답에 초대한 팀장(이름·이메일)과 프로젝트 소개가 생기면 이 위아래에 넣는다(PR #42 inviter·project_description). */}
              <h2 className="mt-2 text-2xl font-bold">
                {invitation.data.project_name}
              </h2>
            </div>
            {signedIn ? (
              accept.error ? (
                <div className="grid gap-3">
                  <p role="alert" className="text-sm text-destructive">
                    {getApiErrorMessage(accept.error)}
                  </p>
                  {/* 초대받은 이메일과 로그인 계정이 다르면 프로젝트를 열지 않고 다시 로그인하게 한다. */}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void relogin()}>
                      다른 계정으로 로그인
                    </Button>
                    <Button variant="ghost" asChild>
                      <Link to="/">나의 도시로</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <LoaderCircle className="size-4 animate-spin" />
                  팀에 들어가는 중이에요. {session.data?.email}로 참여해요.
                </p>
              )
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  초대받은 이메일로 로그인하거나 가입하면 바로 팀원이 돼요.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to={`/login?invite=${encoded}`}>
                      로그인하고 프로젝트 열기
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to={`/register?invite=${encoded}`}>
                      이 이메일로 회원가입하기
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  )
}

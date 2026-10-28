import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { LoaderCircle } from 'lucide-react'
import { membersApi } from '@/api/services'
import { useSession } from '@/features/auth/useSession'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/formatDate'
import { getApiErrorMessage, getApiErrorStatus } from '@/api/error'
import NotFoundPage from './NotFoundPage'

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
      navigate(`/projects/${data.project.id}`)
    },
  })
  const status = getApiErrorStatus(invitation.error)
  // 통신 실패와 서버 오류만 다시 불러오기. 나머지는 원인을 알리지 않고 '찾을 수 없음'으로 통일한다.
  const networkFailure =
    invitation.error &&
    ((isAxiosError(invitation.error) && !invitation.error.response) ||
      (status !== undefined && status >= 500))
  if (!token || (invitation.error && !networkFailure)) return <NotFoundPage />
  const encoded = encodeURIComponent(token)
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
              {/* API 없음: 미리보기 응답에 초대한 팀장(이름·이메일)과 프로젝트 소개가 생기면 이 위아래에 넣는다. */}
              <h2 className="mt-2 text-2xl font-bold">
                {invitation.data.project_name}
              </h2>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
              {/* API 없음: 초대받은 이메일. 로그인 계정과 다르면 미리 알려 주려면 이 값이 필요하다. */}
              {session.data && (
                <>
                  <dt>로그인 계정</dt>
                  <dd>{session.data.email}</dd>
                </>
              )}
              <dt>만료</dt>
              <dd>{formatDate(invitation.data.expires_at)}</dd>
            </dl>
            {session.data ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={accept.isPending}
                  onClick={() => accept.mutate()}
                >
                  초대 수락하고 참여하기
                </Button>
                {/* 거절 API가 없어 미루기만 둔다. */}
                <Button variant="ghost" asChild>
                  <Link to="/">나중에 하기</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={`/login?invite=${encoded}`}>
                    로그인하고 참여하기
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to={`/register?invite=${encoded}`}>
                    회원가입하고 참여하기
                  </Link>
                </Button>
              </div>
            )}
            {accept.error && (
              <p role="alert" className="text-sm text-destructive">
                {getApiErrorMessage(accept.error)}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  )
}

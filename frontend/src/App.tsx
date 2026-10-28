import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Hexagon, Settings } from 'lucide-react'
import { authApi } from '@/api/services'
import { useSession } from '@/features/auth/useSession'
import { Button } from '@/components/ui/button'
import { apiMode } from '@/lib/apiMode'

export default function App() {
  const { pathname } = useLocation()
  const session = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const logout = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.clear()
      navigate('/login')
    },
  })
  // 워크스페이스는 3D 게임 UI라 위쪽 헤더를 두지 않는다.
  if (pathname.startsWith('/projects/'))
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <Outlet />
      </div>
    )
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="relative z-20 flex h-16 items-center justify-between border-b bg-card px-5 sm:px-8">
        <Link
          to="/"
          className="flex items-center gap-2.5"
          aria-label="BEEZ 나의 도시"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary">
            <Hexagon
              className="size-6 text-primary-foreground"
              strokeWidth={2.5}
            />
          </span>
          <h1 className="text-xl font-extrabold tracking-wide">BEEZ</h1>
        </Link>
        {session.data ? (
          <nav aria-label="계정" className="flex items-center gap-1 text-sm">
            <span className="mr-2 text-muted-foreground">
              {session.data.name}
            </span>
            {pathname !== '/account' && (
              <Button variant="ghost" asChild>
                <Link to="/account">
                  <Settings />
                  회원 설정
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              로그아웃
            </Button>
          </nav>
        ) : (
          apiMode === 'mock' && (
            <p className="text-xs text-muted-foreground">
              목데이터로 미리 보기 · 실제 서버 호출 없음
            </p>
          )
        )}
      </header>
      <Outlet />
    </div>
  )
}

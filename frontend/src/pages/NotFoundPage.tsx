import { Link } from 'react-router'

// 없는 주소와 유효하지 않은 초대(만료·취소·이미 수락·삭제·잘못된 링크)가 같이 쓴다.
export default function NotFoundPage() {
  return (
    <main className="grid min-h-[calc(100dvh-4rem)] place-content-center gap-4 px-6 text-center">
      <p className="text-5xl font-bold text-muted-foreground/40">404</p>
      <h2 className="text-2xl font-bold">페이지를 찾을 수 없어요</h2>
      <p className="text-sm text-muted-foreground">
        주소가 바뀌었거나 더 이상 쓸 수 없는 링크예요.
      </p>
      <Link to="/" className="text-sm font-semibold underline">
        처음 화면으로 돌아가기
      </Link>
    </main>
  )
}

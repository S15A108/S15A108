import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import './index.css'
import { router } from './router'
import { isMissingApi } from '@/api/error'
import { reloadOnStaleChunk } from '@/lib/reloadOnStaleChunk'

reloadOnStaleChunk()

// 서버에 아직 없는 API(isMissingApi)는 다시 불러도 같으니 재시도하지 않고 바로 '준비 중'을 보인다. 나머지는 기본 3번.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => !isMissingApi(error) && count < 3,
    },
  },
})

async function bootstrap() {
  // Vite가 이 비교를 빌드 때 상수로 바꿔 live 빌드에는 mock 어댑터·예시 데이터 청크가 생기지 않는다.
  if (import.meta.env.VITE_API_MODE !== 'live') {
    const { setupMockApi } = await import('@/mocks/setup')
    setupMockApi()
  }
  // 이미지·링크를 끌어 옮기지 못하게 한다(-webkit-user-drag가 없는 Firefox까지). draggable="true"로 연 곳만 둔다.
  document.addEventListener('dragstart', (event) => {
    if (!(event.target as Element | null)?.closest?.('[draggable="true"]'))
      event.preventDefault()
  })

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void bootstrap()

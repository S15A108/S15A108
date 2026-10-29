import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import './index.css'
import { router } from './router'
import { apiMode } from '@/lib/apiMode'

const queryClient = new QueryClient()

async function bootstrap() {
  if (apiMode === 'mock') {
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

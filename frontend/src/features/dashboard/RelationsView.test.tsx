/// <reference types="node" />
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { authApi } from '@/api/services'
import { dashboardApi } from '@/api/services/dashboard'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  resetMockApi,
  setupMockApi,
} from '@/mocks/setup'
import { RelationsView } from './RelationsView'

let restore: () => void
beforeEach(async () => {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    configurable: true,
    value: webcrypto.subtle,
  })
  resetMockApi()
  restore = setupMockApi()
  await authApi.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
})
afterEach(() => restore())

it('왼쪽에서 고른 작업 기준으로 확인된 관계와 검토할 후보를 나눠 보여 준다', async () => {
  const user = userEvent.setup()
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RelationsView projectId="101" />
    </QueryClientProvider>,
  )
  await user.click(await screen.findByRole('button', { name: /TASK-002/ }))
  const list = await screen.findByRole('region', { name: '관계 목록' })
  expect(
    await within(list).findByText(/TASK-002 초대 화면 정보 바꾸기 → REQ-001/),
  ).toHaveTextContent('확인된 관계')
  expect(
    within(list).getByText(/프로젝트 목록 빈 화면 안내 → REQ-001/),
  ).toHaveTextContent('검토할 후보 · 확정 아님')
})

// PR #72 리뷰 8: 관계 목록에서 선행 작업을 누르면 지금 작업이 아니라 그 작업을 연다.
it('관계 목록의 작업 보기는 누른 작업을 연다', async () => {
  const user = userEvent.setup()
  vi.spyOn(dashboardApi, 'relations').mockResolvedValue({
    nodes: [
      { id: '501', type: 'TASK', label: 'TASK-001 목록 화면' },
      { id: '502', type: 'TASK', label: 'TASK-002 선행 작업' },
    ],
    edges: [
      {
        from_id: '501',
        from_type: 'TASK',
        to_id: '502',
        to_type: 'TASK',
        relation: 'DEPENDENCY',
        confirmed: true,
      },
    ],
  })
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RelationsView projectId="101" />
    </QueryClientProvider>,
  )
  const list = await screen.findByRole('region', { name: '관계 목록' })
  await user.click(within(list).getByRole('button', { name: '작업 보기 ›' }))
  expect(useWorkspaceStore.getState()).toMatchObject({
    pane: 'tasks',
    focusId: '502',
  })
  vi.restoreAllMocks()
})

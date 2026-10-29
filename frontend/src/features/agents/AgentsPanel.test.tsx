/// <reference types="node" />
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { authApi } from '@/api/services'
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  resetMockApi,
  setupMockApi,
} from '@/mocks/setup'
import { AgentsPanel } from './AgentsPanel'

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

it('토큰을 한 번만 보여 주고, 연결 확인에 보고가 없으면 연결 실패와 할 일을 알려 준다', async () => {
  const user = userEvent.setup()
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AgentsPanel projectId="101" />
    </QueryClientProvider>,
  )
  expect(
    await screen.findByRole('heading', { name: 'Claude Code에 BEEZ 추가' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '토큰 발급' }))
  expect(
    await screen.findByText('이 화면을 닫으면 토큰 값을 다시 볼 수 없어요.'),
  ).toBeInTheDocument()
  expect(screen.getByText(/이 프로젝트에서만 써요/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '연결 확인' }))
  expect(await screen.findByText(/^연결 실패/)).toBeInTheDocument()
  expect(
    screen.getByText(/토큰과 MCP 주소를 확인하고 Claude Code를 다시 시작/),
  ).toBeInTheDocument()
})

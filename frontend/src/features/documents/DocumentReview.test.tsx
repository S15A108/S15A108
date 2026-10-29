/// <reference types="node" />
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
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
import { DocumentReview } from './DocumentReview'

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

function mount(isLeader: boolean) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <DocumentReview
        projectId="102"
        documentId="221"
        title="기획안"
        kind="PLAN"
        isLeader={isLeader}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  )
}

it('비비 검토 → 제안 반영·넘기기 → 최종본 → 팀장 승인까지 같은 화면에서 이어진다', async () => {
  const user = userEvent.setup()
  mount(true)
  await user.click(
    await screen.findByRole('button', { name: '비비에게 검토 요청' }),
  )
  expect(
    await screen.findByText(/비비가 수정 제안 \d개를 남겼어요/),
  ).toBeInTheDocument()
  expect(screen.getByText(/실제 AI 호출 없음/)).toBeInTheDocument()
  await user.click(screen.getAllByRole('button', { name: '반영하기' })[0])
  await screen.findByText('반영함')
  while (screen.queryAllByRole('button', { name: '넘기기' }).length)
    await user.click(screen.getAllByRole('button', { name: '넘기기' })[0])
  expect(
    await screen.findByRole('heading', { name: '최종본 확인' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '팀장에게 검토 요청' }))
  expect(await screen.findByText(/승인을 요청했어요/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '승인' }))
  expect(await screen.findByText(/팀장이 승인했어요/)).toBeInTheDocument()
})

it('팀장은 사유를 써서 반려하고, 올린 사람에게는 반려 사유가 보인다', async () => {
  const user = userEvent.setup()
  mount(true)
  await user.click(
    await screen.findByRole('button', { name: '비비에게 검토 요청' }),
  )
  await screen.findByText(/비비가 수정 제안/)
  while (screen.queryAllByRole('button', { name: '넘기기' }).length)
    await user.click(screen.getAllByRole('button', { name: '넘기기' })[0])
  await user.click(
    await screen.findByRole('button', { name: '팀장에게 검토 요청' }),
  )
  await user.click(await screen.findByRole('button', { name: '반려' }))
  await user.click(screen.getByRole('button', { name: '반려하기' }))
  expect(
    await screen.findByText('반려 사유를 입력해 주세요.'),
  ).toBeInTheDocument()
  await user.type(
    screen.getByLabelText(/반려 사유/),
    '요구사항 번호가 빠졌어요.',
  )
  await user.click(screen.getByRole('button', { name: '반려하기' }))
  expect(await screen.findByText('팀장 반려')).toBeInTheDocument()
  expect(screen.getByText('요구사항 번호가 빠졌어요.')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: '비비에게 검토 요청' }),
  ).toBeInTheDocument()
})

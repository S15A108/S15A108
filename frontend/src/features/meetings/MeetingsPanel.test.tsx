/// <reference types="node" />
import { webcrypto } from 'node:crypto'
import { beforeEach, afterEach, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { authApi } from '@/api/services'
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  resetMockApi,
  setupMockApi,
} from '@/mocks/setup'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { MeetingsPanel } from './MeetingsPanel'

let restore: () => void
let client: QueryClient
beforeEach(async () => {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    configurable: true,
    value: webcrypto.subtle,
  })
  resetMockApi()
  restore = setupMockApi()
  useWorkspaceStore.getState().openPane('meetings')
  await authApi.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  client.clear()
  restore()
})

function renderPanel(isLeader: boolean) {
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MeetingsPanel projectId="101" isLeader={isLeader} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

it('팀장은 메시지를 보내고 비비 정리를 받은 뒤 회의 끝내기 확인을 연다', async () => {
  const user = userEvent.setup()
  renderPanel(true)
  await screen.findByRole('heading', { name: '초대 안내 문구 검토' })
  expect(
    screen.queryByRole('button', { name: '회의 만들기' }),
  ).not.toBeInTheDocument()
  const log = await screen.findByRole('log', { name: '회의 대화' })
  expect(
    await within(log).findByText(/작업이 부딪혀서 회의를 열었어요/),
  ).toBeInTheDocument()
  expect(
    await within(log).findByText('TASK-002에서 만료 전용 안내는 뺄게요.'),
  ).toBeInTheDocument()
  await user.type(
    screen.getByRole('textbox', { name: /메시지/ }),
    '기존 계약을 유지하고 설명을 보완해요.',
  )
  await user.click(screen.getByRole('button', { name: '보내기' }))
  await within(log).findByText('기존 계약을 유지하고 설명을 보완해요.')
  await user.click(screen.getByRole('button', { name: '비비에게 검토 요청' }))
  expect(
    await within(log).findByText(/회의 내용을 정리했어요 · 메시지 4개 기준/),
  ).toBeInTheDocument()
  expect(
    within(log).getAllByText('예시 템플릿 · 실제 AI 호출 없음'),
  ).toHaveLength(2)
  await user.click(screen.getByRole('button', { name: '회의 끝내기' }))
  expect(
    screen.getByRole('heading', { name: '회의를 끝낼까요?' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: '회의 끝내고 문서 바꾸기' }),
  ).toBeDisabled()
})

it('팀원은 대화만 하고 검토 요청은 팀장만 할 수 있다고 안내받는다', async () => {
  renderPanel(false)
  await screen.findByRole('heading', { name: '초대 안내 문구 검토' })
  expect(
    screen.getByRole('button', { name: '비비에게 검토 요청' }),
  ).toBeDisabled()
  expect(screen.getByText('팀장만 요청할 수 있어요')).toBeInTheDocument()
})

it('참여자는 관련자 추가로 아직 없는 팀원을 골라 회의에 부른다', async () => {
  const user = userEvent.setup()
  renderPanel(true)
  await screen.findByRole('heading', { name: '초대 안내 문구 검토' })
  await user.click(screen.getByRole('button', { name: '+ 관련자 추가' }))
  const form = await screen.findByRole('form', { name: '관련자 추가' })
  expect(
    within(form).getByText(/이미 참여 중: 이팀장, 김동료, 최팀원/),
  ).toBeInTheDocument()
  await user.click(within(form).getByRole('button', { name: '추가하기' }))
  expect(
    await within(form).findByText('부를 팀원을 골라 주세요.'),
  ).toBeInTheDocument()
  await user.click(within(form).getByRole('checkbox', { name: /박팀원/ }))
  await user.click(within(form).getByRole('button', { name: '1명 추가하기' }))
  expect(await screen.findByRole('status')).toHaveTextContent(
    '관련자를 추가했어요.',
  )
  expect(await screen.findByText('박팀원')).toBeInTheDocument()
})

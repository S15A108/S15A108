/// <reference types="node" />
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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
import { ChangesPanel } from './ChangesPanel'

let restore: () => void
let client: QueryClient
beforeEach(async () => {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    configurable: true,
    value: webcrypto.subtle,
  })
  resetMockApi()
  restore = setupMockApi()
  useWorkspaceStore.getState().openPane('changes')
  await authApi.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  client.clear()
  restore()
})

function renderPanel() {
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ChangesPanel projectId="101" isLeader />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

it('팀장은 탭으로 제안을 살펴보고 창 안에서 확인한 뒤 기준 v2를 발행한다', async () => {
  const user = userEvent.setup()
  renderPanel()
  await screen.findByRole('heading', { name: /프로젝트 목록 빈 화면 안내/ })
  await user.click(screen.getByRole('tab', { name: '바뀌는 내용' }))
  await user.click(await screen.findByText('REQ-001'))
  expect(screen.getByText(/\+ .*초대를 기다리라는 안내/)).toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: '승인하고 기준 v2 발행' }),
  )
  expect(
    screen.getByRole('heading', { name: '기준 v2 발행을 승인할까요?' }),
  ).toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: '승인하고 기준 v2 발행' }),
  )
  expect(await screen.findByRole('status')).toHaveTextContent(
    '기준 v2 발행을 마쳤어요.',
  )
  expect(await screen.findByText(/새 기준을 발행했어요/)).toBeInTheDocument()
})

it('새 변경 제안은 항목을 고르지 않으면 막고, 다 채우면 목록에 올린다', async () => {
  const user = userEvent.setup()
  renderPanel()
  await screen.findByRole('heading', { name: /프로젝트 목록 빈 화면 안내/ })
  await user.click(screen.getByRole('button', { name: '새 변경 제안' }))
  await user.type(screen.getByLabelText('제목 *'), '로그인 실패 안내')
  await user.type(
    screen.getByLabelText('바꾸려는 이유 *'),
    '실패 이유를 알려 줘야 해요.',
  )
  await user.click(screen.getByRole('button', { name: '제안 올리기' }))
  expect(
    await screen.findByText('바꿀 항목을 골라 주세요.'),
  ).toBeInTheDocument()
  const row = screen.getByRole('group', { name: '설계 항목 1' })
  await user.selectOptions(
    within(row).getByLabelText('항목 1 설계 항목'),
    '301',
  )
  await user.type(
    within(row).getByLabelText('항목 1 바뀔 문장'),
    '실패하면 다시 시도하라고 안내한다.',
  )
  await user.click(screen.getByRole('button', { name: '제안 올리기' }))
  expect(await screen.findByRole('status')).toHaveTextContent(
    '변경 제안을 올렸어요.',
  )
  expect(
    await screen.findByRole('heading', { name: /로그인 실패 안내/ }),
  ).toBeInTheDocument()
})

it('제안자는 검토 중인 내 제안을 같은 폼으로 고쳐 다시 올리고 고친 항목을 확인한다', async () => {
  await authApi.login({ email: 'member@beez.local', password: DEMO_PASSWORD })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ChangesPanel projectId="101" isLeader={false} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  expect(
    await screen.findByText('이팀장님이 검토하고 있어요'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '제안 거두기' })).toBeDisabled()
  expect(
    screen.queryByRole('button', { name: /승인하고 기준/ }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '제안 고치기' }))
  expect(
    screen.getByRole('heading', { name: /제안 고치기/ }),
  ).toBeInTheDocument()
  expect(screen.getByRole('region', { name: '받은 의견' })).toBeInTheDocument()
  const sentence = screen.getByLabelText('항목 1 바뀔 문장')
  await user.clear(sentence)
  await user.type(sentence, '없으면 받은 초대를 먼저 보여 준다.')
  expect(screen.getByText('고친 항목')).toBeInTheDocument()
  expect(
    screen.getByText(/처음 올린 문장: 로그인한 사용자는/),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '고친 내용 올리기' }))
  expect(await screen.findByRole('status')).toHaveTextContent(
    '고친 내용을 올렸어요. 다시 검토 대기예요.',
  )
})

// 공용 문서함 '고치기'(PNL-02 수정안 10-29): 그 문서가 골라진 새 제안 폼으로 들어와 고친 글만으로도 올린다.
it('문서함에서 고치기로 들어오면 그 문서를 고른 새 제안으로 고친 글을 올린다', async () => {
  const user = userEvent.setup()
  useWorkspaceStore.getState().openPane('changes', 'doc:203')
  renderPanel()
  await waitFor(() =>
    expect(
      (screen.getByLabelText('고친 글') as HTMLTextAreaElement).value,
    ).toContain('REQ-001'),
  )
  const text = screen.getByLabelText('고친 글')
  expect(screen.getByLabelText(/고칠 문서/)).toHaveValue('203')
  expect(
    screen.queryByRole('group', { name: '설계 항목 1' }),
  ).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('제목 *'), '빈 목록 안내 추가')
  await user.type(
    screen.getByLabelText('바꾸려는 이유 *'),
    '참여한 프로젝트가 없으면 안내가 필요해요.',
  )
  await user.type(text, '\nREQ-006 참여한 프로젝트가 없으면 만들기를 안내한다.')
  await user.click(screen.getByRole('button', { name: '제안 올리기' }))
  expect(await screen.findByRole('status')).toHaveTextContent(
    '변경 제안을 올렸어요.',
  )
  expect(
    await screen.findByRole('heading', { name: /빈 목록 안내 추가/ }),
  ).toBeInTheDocument()
})

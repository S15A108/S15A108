/// <reference types="node" />
import { webcrypto } from 'node:crypto'
import { beforeEach, afterEach, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { authApi, membersApi } from '@/api/services'
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  resetMockApi,
  setupMockApi,
} from '@/mocks/setup'
import { TeamPanel } from './TeamPanel'

let restore: () => void
let client: QueryClient
beforeEach(async () => {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    configurable: true,
    value: webcrypto.subtle,
  })
  resetMockApi()
  restore = setupMockApi()
  await authApi.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  client.clear()
  restore()
})

it('validates an invitation form and displays the created invitation link', async () => {
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TeamPanel projectId="101" isLeader />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  expect(await screen.findByText('김동료')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '팀원 초대' }))
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText(/팀원 이메일/), 'incorrect')
  await user.click(
    within(dialog).getByRole('button', { name: '초대 링크 만들기' }),
  )
  expect(
    await within(dialog).findByText('이메일 형식을 확인해 주세요.'),
  ).toBeInTheDocument()
  await user.clear(within(dialog).getByLabelText(/팀원 이메일/))
  await user.type(
    within(dialog).getByLabelText(/팀원 이메일/),
    'colleague@beez.local',
  )
  await user.click(
    within(dialog).getByRole('button', { name: '초대 링크 만들기' }),
  )
  const link = await screen.findByLabelText<HTMLInputElement>('팀원 초대 링크')
  expect(link.value).toContain('mock-invite-')
  expect(await screen.findByText('colleague@beez.local')).toBeInTheDocument()
})

function renderTeam() {
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TeamPanel projectId="101" isLeader />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

it('여러 이메일을 한 줄에 하나씩 넣으면 사람마다 초대를 만든다', async () => {
  const user = userEvent.setup()
  renderTeam()
  await screen.findByText('김동료')
  await user.click(screen.getByRole('button', { name: '팀원 초대' }))
  const dialog = screen.getByRole('dialog')
  await user.type(
    within(dialog).getByLabelText(/팀원 이메일/),
    'one@beez.local{enter}two@beez.local',
  )
  await user.click(
    within(dialog).getByRole('button', { name: '초대 링크 만들기' }),
  )
  expect(await screen.findAllByLabelText('팀원 초대 링크')).toHaveLength(2)
  expect(screen.getByText('one@beez.local')).toBeInTheDocument()
  expect(screen.getByText('two@beez.local')).toBeInTheDocument()
})

it('추방할 때 그 팀원이 맡은 작업을 넘길 작업으로 보여 준다', async () => {
  const user = userEvent.setup()
  renderTeam()
  await screen.findByText('김동료')
  await user.click(screen.getByRole('button', { name: '김동료 더보기' }))
  await user.click(await screen.findByRole('menuitem', { name: '추방' }))
  const list = await screen.findByRole('region', { name: '넘길 작업' })
  expect(
    await within(list).findByText(/TASK-002 · 초대 화면 정보 바꾸기/),
  ).toBeInTheDocument()
})

// PR #50 MEM-A06은 최근 들어온 순이라 팀장이 맨 아래로 온다. 화면은 팀장, 나, 나머지 순으로 그린다.
it('팀 목록은 팀장을 맨 위, 다음에 나, 나머지는 서버 순서로 보여 준다', async () => {
  await authApi.login({ email: 'member@beez.local', password: DEMO_PASSWORD })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TeamPanel projectId="101" isLeader={false} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByText('김동료 · 나')
  expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual(
    [
      expect.stringContaining('이팀장'),
      expect.stringContaining('김동료 · 나'),
      expect.stringContaining('박팀원'),
      expect.stringContaining('최팀원'),
    ],
  )
})

// 사용자 결정 10-30: 팀장 위임은 팀원 줄 ⋯ → '팀장으로 위임' → 작은 확인 창
it('팀원 줄 ⋯에서 팀장으로 위임을 누르면 확인 창에서 팀장을 넘긴다', async () => {
  const user = userEvent.setup()
  renderTeam()
  await screen.findByText('김동료')
  await user.click(screen.getByRole('button', { name: '김동료 더보기' }))
  await user.click(
    await screen.findByRole('menuitem', { name: '팀장으로 위임' }),
  )
  const dialog = await screen.findByRole('dialog', {
    name: '김동료님에게 팀장을 넘길까요?',
  })
  await user.click(within(dialog).getByRole('button', { name: '팀장 넘기기' }))
  expect(await screen.findByText('팀장을 넘겼어요')).toBeInTheDocument()
  const members = await membersApi.list('101', { limit: 100 })
  expect(members.items.find((member) => member.name === '김동료')?.role).toBe(
    'LEADER',
  )
})

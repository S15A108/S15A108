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

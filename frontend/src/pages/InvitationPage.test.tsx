/// <reference types="node" />
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { authApi, membersApi } from '@/api/services'
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  resetMockApi,
  setupMockApi,
} from '@/mocks/setup'
import InvitationPage from './InvitationPage'

let restore: () => void
let token: string
beforeEach(async () => {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    configurable: true,
    value: webcrypto.subtle,
  })
  resetMockApi()
  restore = setupMockApi()
  await authApi.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
  const result = await membersApi.createInvitation('101', {
    email: 'new@beez.local',
  })
  token = new URL(result.invite_url).searchParams.get('token')!
})
afterEach(() => restore())

function open() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[`/invite?token=${token}`]}>
        <Routes>
          <Route path="/invite" element={<InvitationPage />} />
          <Route path="/projects/:id" element={<p>프로젝트 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// Q05(2026-10-29 확정): 수락 버튼 없이 로그인 상태면 저절로 참여하고, 로그아웃이면 로그인·가입으로 잇는다.
it('로그인한 채로 초대 링크를 열면 버튼 없이 참여하고 프로젝트로 간다', async () => {
  await authApi.register({
    name: '새 팀원',
    email: 'new@beez.local',
    password: 'beez-2026!',
  })
  open()
  expect(await screen.findByText('프로젝트 화면')).toBeInTheDocument()
})

it('로그아웃 상태로 열면 로그인·가입하고 참여하는 길만 보여 준다', async () => {
  await authApi.logout()
  open()
  expect(
    await screen.findByRole('link', { name: '로그인하고 프로젝트 열기' }),
  ).toHaveAttribute('href', `/login?invite=${token}`)
  expect(
    screen.getByRole('link', { name: '이 이메일로 회원가입하기' }),
  ).toHaveAttribute('href', `/register?invite=${token}`)
  expect(screen.queryByRole('button', { name: /수락/ })).not.toBeInTheDocument()
})

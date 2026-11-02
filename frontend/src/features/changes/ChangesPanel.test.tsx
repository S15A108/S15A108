/// <reference types="node" />
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { authApi, changesApi, documentsApi } from '@/api/services'
import { getApiErrorCode } from '@/api/error'
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

// 사용자 결정(10-30, PR #42 CHG-A04): 올린 제안은 잠기고, 반려된 제안만 같은 번호로 고쳐 다시 올린다.
it('제안자는 검토 중인 제안을 고칠 수 없고, 반려되면 같은 제안을 고쳐 다시 올린다', async () => {
  await authApi.login({ email: 'member@beez.local', password: DEMO_PASSWORD })
  const user = userEvent.setup()
  const view = (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ChangesPanel projectId="101" isLeader={false} />
      </MemoryRouter>
    </QueryClientProvider>
  )
  const { unmount } = render(view)
  expect(
    await screen.findByText('이팀장님이 검토하고 있어요'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '제안 거두기' })).toBeEnabled()
  expect(
    screen.queryByRole('button', { name: '제안 고치기' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /승인하고 기준/ }),
  ).not.toBeInTheDocument()
  unmount()
  await authApi.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
  const { proposal } = await changesApi.get('101', '71')
  await changesApi.reject('101', '71', {
    reason: '받은 초대를 먼저 보여 주는 안으로 고쳐 주세요.',
    expected_revision: proposal.revision,
    expected_snapshot_hash: proposal.snapshot_hash,
  })
  await authApi.login({ email: 'member@beez.local', password: DEMO_PASSWORD })
  client.clear()
  render(view)
  await user.click(
    await screen.findByRole('button', { name: '고쳐서 다시 올리기' }),
  )
  expect(
    screen.getByRole('heading', { name: /고쳐서 다시 올리기/ }),
  ).toBeInTheDocument()
  expect(screen.getByText(/받은 초대를 먼저 보여 주는 안/)).toBeInTheDocument()
  expect(screen.getByRole('region', { name: '받은 의견' })).toBeInTheDocument()
  const sentence = screen.getByLabelText('항목 1 바뀔 문장')
  await user.clear(sentence)
  await user.type(sentence, '없으면 받은 초대를 먼저 보여 준다.')
  expect(screen.getByText('고친 항목')).toBeInTheDocument()
  expect(
    screen.getByText(/처음 올린 문장: 로그인한 사용자는/),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '다시 올리기' }))
  expect(await screen.findByRole('status')).toHaveTextContent(
    '고친 내용을 올렸어요. 다시 검토 대기예요.',
  )
  expect((await changesApi.get('101', '71')).proposal.status).toBe('PROPOSED')
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

// PR #46 0df13f0: 서버가 정규화한 본문이 기준과 같으면 거절하므로 화면에서 미리 막는다.
it('고친 글이 기준 문서와 같으면 올리지 않고 칸 아래에 알린다', async () => {
  const user = userEvent.setup()
  useWorkspaceStore.getState().openPane('changes', 'doc:203')
  renderPanel()
  await waitFor(() =>
    expect(
      (screen.getByLabelText('고친 글') as HTMLTextAreaElement).value,
    ).toContain('REQ-001'),
  )
  await user.type(screen.getByLabelText('제목 *'), '그대로 둔 문서')
  await user.type(screen.getByLabelText('바꾸려는 이유 *'), '확인용')
  await user.click(screen.getByRole('button', { name: '제안 올리기' }))
  expect(
    await screen.findByText('기준 문서와 달라진 내용이 없어요.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('목은 BOM과 CRLF만 다른 문서를 기준과 같다고 보고 400 validation_failed로 거절한다', async () => {
  const baseline = await documentsApi.baseline('101')
  const { document } = await documentsApi.get('101', '203')
  const content = document.approved_version!.content ?? ''
  const same = await changesApi
    .create('101', {
      base_baseline_id: baseline.id,
      title: '줄바꿈만 바꿈',
      reason: '확인용',
      items: [],
      documents: [
        {
          document_id: '203',
          base_document_version_id: document.approved_version!.id,
          after_content: `\uFEFF${content.replace(/\n/g, '\r\n')}`,
        },
      ],
    })
    .catch((cause: unknown) => cause)
  expect(getApiErrorCode(same)).toBe('validation_failed')
})

// PR #46 CHG-A15: 제안자는 올린 제안을 거두고, 거둔 제안은 새 제안(previous_proposal_id)으로 다시 올린다.
it('제안자는 제안을 거두고, 거둔 제안을 새 제안으로 다시 올린다', async () => {
  await authApi.login({ email: 'member@beez.local', password: DEMO_PASSWORD })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ChangesPanel projectId="101" isLeader={false} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await user.click(await screen.findByRole('button', { name: '제안 거두기' }))
  await user.click(screen.getByRole('button', { name: '거두기' }))
  expect(await screen.findByRole('status')).toHaveTextContent(
    '제안을 거뒀어요.',
  )
  expect((await changesApi.get('101', '71')).proposal.status).toBe('WITHDRAWN')
  await user.click(
    await screen.findByRole('button', { name: '새 제안으로 다시 올리기' }),
  )
  await user.click(screen.getByRole('button', { name: '제안 올리기' }))
  const heading = await screen.findAllByRole('heading', {
    name: /프로젝트 목록 빈 화면 안내/,
  })
  expect(heading.length).toBeGreaterThan(0)
  const list = await changesApi.list('101')
  const next = list.items.find((item) => item.id !== '71')!
  expect((await changesApi.get('101', next.id)).proposal).toMatchObject({
    previous_proposal_id: '71',
    revision: 1,
    status: 'PROPOSED',
  })
})

it('조회한 리비전과 해시가 지금과 다르면 409 version_conflict', async () => {
  const { proposal } = await changesApi.get('101', '71')
  const stale = await changesApi
    .reject('101', '71', {
      reason: '다시 봐 주세요.',
      expected_revision: proposal.revision + 1,
      expected_snapshot_hash: proposal.snapshot_hash,
    })
    .catch((cause: unknown) => cause)
  expect(getApiErrorCode(stale)).toBe('version_conflict')
})

// PNL-04 수정안: 새 제안은 설계 항목만 보이고 '+ 문서 고치기'로 고칠 문서 칸을 연다.
it('새 제안 폼은 문서 고치기를 눌러야 고칠 문서 칸이 열린다', async () => {
  const user = userEvent.setup()
  renderPanel()
  await user.click(await screen.findByRole('button', { name: '새 변경 제안' }))
  expect(screen.queryByLabelText(/고칠 문서/)).not.toBeInTheDocument()
  await user.click(await screen.findByRole('button', { name: '문서 고치기' }))
  expect(screen.getByLabelText(/고칠 문서/)).toBeInTheDocument()
})

// PNL-04-v2-edit: 반려된 제안을 고칠 때 뺀 항목은 점선 줄로 남겨 보여 준다.
it('반려된 제안을 고치며 항목을 빼면 이번 제안에서 뺐다고 보여 준다', async () => {
  const { proposal } = await changesApi.get('101', '71')
  await changesApi.reject('101', '71', {
    reason: '문서로 고쳐 주세요.',
    expected_revision: proposal.revision,
    expected_snapshot_hash: proposal.snapshot_hash,
  })
  await authApi.login({ email: 'member@beez.local', password: DEMO_PASSWORD })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ChangesPanel projectId="101" isLeader={false} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await user.click(
    await screen.findByRole('button', { name: '고쳐서 다시 올리기' }),
  )
  await user.click(screen.getByRole('button', { name: '문서 고치기' }))
  await user.selectOptions(await screen.findByLabelText(/고칠 문서/), '203')
  await user.click(screen.getByRole('button', { name: '항목 1 빼기' }))
  expect(screen.getByText('이번 제안에서 뺐어요')).toBeInTheDocument()
})

// '지금 할 일' 미리 보기용 항목별 −/+ 문장(item_texts, 195 미구현). 목은 채운다.
it('목 상세는 항목별 바뀌기 전·뒤 문장을 item_texts로 준다', async () => {
  const detail = await changesApi.get('101', '71')
  expect(detail.item_texts?.[0]).toMatchObject({
    before_text: expect.stringContaining('참여 프로젝트를 조회한다'),
    after_text: expect.stringContaining('초대를 기다리라는 안내'),
  })
})

// PR #72 리뷰 2: 문서 목록 응답에는 본문이 없어 고른 문서의 기준 원문을 따로 받는다. 못 받으면 칸 위에 알린다.
it('고칠 문서의 기준 원문을 받지 못하면 고친 글 칸 위에 오류와 다시 불러오기를 보인다', async () => {
  vi.spyOn(documentsApi, 'get').mockRejectedValue(new Error('network'))
  useWorkspaceStore.getState().openPane('changes', 'doc:203')
  renderPanel()
  expect(
    await screen.findByText(/기준 원문을 불러오지 못했어요/),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeEnabled()
  expect((screen.getByLabelText('고친 글') as HTMLTextAreaElement).value).toBe(
    '',
  )
  vi.restoreAllMocks()
})

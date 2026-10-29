import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { documentsApi } from '@/api/services/documents'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { DocumentVersion } from '@/api/contracts/common'
import { DocumentsPanel } from './DocumentsPanel'

vi.mock('@/api/services/documents', () => ({
  documentsApi: {
    list: vi.fn(),
    get: vi.fn(),
    versions: vi.fn(),
    upload: vi.fn(),
    uploadDraft: vi.fn(),
    baseline: vi.fn(),
    workingCopy: vi.fn(),
  },
}))
const version: DocumentVersion = {
  id: '21',
  document_id: '2',
  version_no: 1,
  status: 'DRAFT',
  file_name: 'requirements.md',
  media_type: 'text/markdown',
  content_hash: 'hash',
  content: '선택한 문서의 본문',
  created_at: '2026-10-23T00:00:00Z',
}
const listedDocument = {
  id: '1',
  project_id: '10',
  kind: 'REQUIREMENTS' as const,
  title: '같은 제목',
}
const focusedDocument = { ...listedDocument, id: '2' }

beforeEach(() => {
  vi.clearAllMocks()
  useWorkspaceStore.setState({ pane: 'documents', focusId: null })
  vi.mocked(documentsApi.list).mockResolvedValue({
    items: [listedDocument],
    has_more: false,
  })
  vi.mocked(documentsApi.get).mockResolvedValue({
    document: focusedDocument,
    version,
  })
  vi.mocked(documentsApi.versions).mockResolvedValue({
    items: [version],
    has_more: false,
  })
  vi.mocked(documentsApi.baseline).mockRejectedValue(new Error('404'))
  vi.mocked(documentsApi.workingCopy).mockRejectedValue(new Error('404'))
})

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <DocumentsPanel projectId="10" isLeader />
    </QueryClientProvider>,
  )
}

it('근거에서 이동한 문서가 첫 목록에 없어도 해당 문서를 연다', async () => {
  useWorkspaceStore.setState({ focusId: '2' })
  mount()
  expect(await screen.findByText('선택한 문서의 본문')).toBeInTheDocument()
  expect(documentsApi.get).toHaveBeenCalledWith('10', '2', {
    version_no: undefined,
  })
})

// 수정안(PNL-02-m): 문서 상세는 보기 전용. '수정 초안 작성' 대신 새 .md를 올려 비비 검토·팀장 승인을 다시 거친다.
it('문서 상세는 보기 전용이고 수정 초안 작성 버튼이 없다', async () => {
  useWorkspaceStore.setState({ focusId: '2' })
  mount()
  expect(
    await screen.findByText(/승인된 버전은 바뀌지 않아요/),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: '수정 초안 작성' }),
  ).not.toBeInTheDocument()
})

it('과거 버전을 보다가 현재 승인본으로 돌아간다', async () => {
  const user = userEvent.setup()
  useWorkspaceStore.setState({ focusId: '2' })
  const approved = {
    ...version,
    id: '22',
    version_no: 2,
    status: 'APPROVED' as const,
  }
  vi.mocked(documentsApi.get).mockImplementation(
    async (_project, _document, options) => ({
      document: { ...focusedDocument, approved_version: approved },
      version: options?.version_no === 2 ? approved : version,
    }),
  )
  vi.mocked(documentsApi.versions).mockResolvedValue({
    items: [approved, version],
    has_more: false,
  })
  mount()
  await user.click(
    await screen.findByRole('button', { name: '기준 v2로 돌아가기' }),
  )
  await waitFor(() =>
    expect(documentsApi.get).toHaveBeenLastCalledWith(
      '10',
      '2',
      expect.objectContaining({ version_no: 2 }),
    ),
  )
  expect(
    screen.queryByRole('button', { name: '기준 v2로 돌아가기' }),
  ).not.toBeInTheDocument()
})

it('등록 중 닫기를 막고 같은 제목의 기존 문서 대신 응답 문서로 이동한다', async () => {
  const user = userEvent.setup()
  let resolveUpload: (
    value: Awaited<ReturnType<typeof documentsApi.upload>>,
  ) => void = () => undefined
  vi.mocked(documentsApi.upload).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveUpload = resolve
      }),
  )
  mount()
  // 수정안(PNL-02 모달안): 등록은 겹친 창이 아니라 같은 창 안의 등록 화면이다.
  await user.click(await screen.findByRole('button', { name: '문서 등록' }))
  await user.type(screen.getByLabelText(/문서 제목/), '같은 제목')
  await user.upload(
    screen.getByLabelText(/원본 파일/),
    new File(['등록할 원문'], 'requirements.md', { type: 'text/markdown' }),
  )
  await user.click(
    screen.getByRole('button', { name: '등록하고 비비 검토 받기' }),
  )
  await waitFor(() => expect(documentsApi.upload).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
  expect(
    screen.getByRole('button', { name: '이전 화면으로 돌아가기' }),
  ).toBeDisabled()
  await act(async () =>
    resolveUpload({ document: focusedDocument, analysis_status: 'PENDING' }),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: '등록하고 비비 검토 받기' }),
    ).not.toBeInTheDocument(),
  )
  expect(useWorkspaceStore.getState().focusId).toBe('2')
})

// 10-29 보드: 시작 전에는 필수 문서 4종 칸에 승인 수를 보여 주고, 4종이 승인되기 전에는 '프로젝트 시작'을 잠근다.
it('시작 전에는 필수 문서 4종 칸과 잠긴 프로젝트 시작을 보여 준다', async () => {
  const user = userEvent.setup()
  const approved = { ...version, status: 'APPROVED' as const }
  vi.mocked(documentsApi.list).mockResolvedValue({
    items: [
      { ...listedDocument, kind: 'REQUIREMENTS', approved_version: approved },
      {
        ...listedDocument,
        id: '3',
        kind: 'ERD',
        title: 'ERD',
        approved_version: approved,
      },
    ],
    has_more: false,
  })
  mount()
  expect(await screen.findByText('팀장 승인 2 / 4')).toBeInTheDocument()
  expect(screen.getByText(/2개가 더 승인되면 켜져요/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '프로젝트 시작' })).toBeDisabled()
  expect(screen.getAllByText('승인 v1')).toHaveLength(2)
  await user.click(screen.getByRole('button', { name: '기획안 올리기' }))
  expect(screen.getByRole('radio', { name: '기획안' })).toBeChecked()
})

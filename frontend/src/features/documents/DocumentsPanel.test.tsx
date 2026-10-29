import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
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
    await screen.findByText(/문서 상세는 보기 전용이에요/),
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
    await screen.findByRole('button', { name: '현재 승인본 보기' }),
  )
  await waitFor(() =>
    expect(documentsApi.get).toHaveBeenLastCalledWith(
      '10',
      '2',
      expect.objectContaining({ version_no: 2 }),
    ),
  )
  expect(
    screen.queryByRole('button', { name: '현재 승인본 보기' }),
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
  await user.click(screen.getByRole('button', { name: '문서 등록' }))
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('문서 제목'), '같은 제목')
  await user.upload(
    within(dialog).getByLabelText('원본 파일'),
    new File(['등록할 원문'], 'requirements.md', { type: 'text/markdown' }),
  )
  await user.click(within(dialog).getByRole('button', { name: '문서 등록' }))
  await waitFor(() => expect(documentsApi.upload).toHaveBeenCalledTimes(1))
  await user.click(within(dialog).getByRole('button', { name: '닫기' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  await act(async () =>
    resolveUpload({ document: focusedDocument, analysis_status: 'PENDING' }),
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(useWorkspaceStore.getState().focusId).toBe('2')
})

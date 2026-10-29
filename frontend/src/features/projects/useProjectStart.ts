import { useQuery } from '@tanstack/react-query'
import { documentsApi, planningApi } from '@/api/services'
import { useProjectAction } from '@/features/workspace/useProjectAction'

const REQUIRED = ['PLAN', 'ERD', 'REQUIREMENTS', 'API_SPEC']

// 프로젝트 시작 = 최초 기준 설계 생성(PLN-A10). 필수 문서 4종의 승인본과 설계 항목 초안으로 기준 v1을 만든다.
// 시작 가이드 3단계와 공용 문서함의 '프로젝트 시작'이 같은 버튼이다(SCR-06·PNL-02 수정안 10-29).
export function useProjectStart(projectId: string, enabled = true) {
  const action = useProjectAction(projectId)
  const documents = useQuery({
    queryKey: ['projects', projectId, 'planning-documents'],
    queryFn: () => documentsApi.list(projectId, { limit: 100 }),
    enabled,
  })
  const drafts = useQuery({
    queryKey: ['projects', projectId, 'start-drafts'],
    queryFn: () =>
      planningApi.items(projectId, { status: 'DRAFT', limit: 100 }),
    enabled,
  })
  const approved =
    documents.data?.items.filter(
      (document) =>
        document.approved_version && REQUIRED.includes(document.kind),
    ) ?? []
  const approvedCount = new Set(approved.map((document) => document.kind)).size
  // API 없음: 문서별 색인 완료(PRJ-A06 required_documents[].index_ready)는 PR #42 요청 중이라
  // 설계 항목 초안이 모두 만들어졌는지로 대신 본다.
  const indexed =
    !!drafts.data?.draft_snapshot_hash &&
    drafts.data.items.length > 0 &&
    !drafts.data.has_more
  return {
    approvedCount,
    indexed,
    ready: approvedCount === 4 && indexed,
    busy: action.busy,
    error: action.error,
    start: () =>
      action.run(
        () =>
          planningApi.publishBaseline({
            project_id: projectId,
            document_version_ids: approved.map(
              (document) => document.approved_version!.id,
            ),
            design_item_version_ids: drafts.data!.items.map((item) => item.id),
            draft_snapshot_hash: drafts.data!.draft_snapshot_hash!,
          }),
        '프로젝트를 시작했어요.',
      ),
  }
}

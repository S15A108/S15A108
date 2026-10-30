import { isAxiosError } from 'axios'
import { z } from 'zod'

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string().optional() }),
})
export function getApiErrorCode(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined
  const parsed = apiErrorSchema.safeParse(error.response?.data)
  return parsed.success ? parsed.data.error.code : undefined
}
export function getApiErrorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}
const messages: Record<string, string> = {
  unauthenticated: '로그인이 필요합니다.',
  invalid_credentials: '이메일 또는 비밀번호를 확인해 주세요.',
  forbidden: '이 작업의 권한이 없습니다.',
  not_found: '이 항목을 찾을 수 없습니다.',
  email_already_exists: '이미 가입된 이메일입니다.',
  validation_failed: '입력 내용을 확인해 주세요.',
  version_conflict: '설계가 변경되었습니다. 최신 내용을 확인해 주세요.',
  revision_conflict: '작업 계획이 변경되었습니다. 다시 확인해 주세요.',
  baseline_conflict:
    '기준 설계가 변경되었습니다. 최신 기준으로 다시 검토해 주세요.',
  proposal_changed: '제안이 변경되었습니다. 최신 내용을 확인해 주세요.',
  draft_changed: '검토 후 초안이 변경되었습니다.',
  validation_not_passed: '현재 계획의 검증을 먼저 완료해 주세요.',
  dependency_not_completed: '선행 작업이 아직 완료되지 않았습니다.',
  task_conflict: '같은 설계를 변경하는 작업을 확인해 주세요.',
  ai_unavailable: '분석을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  ai_timeout: '분석 시간이 초과되었습니다. 다시 시도해 주세요.',
  rate_limited: '요청이 많습니다. 잠시 후 다시 시도해 주세요.',
  file_too_large: '파일 용량이 허용 범위를 초과했습니다.',
  document_kind_exists: '같은 종류의 문서가 이미 있어요.',
  unsupported_media_type: '지원하지 않는 파일 형식입니다.',
  invitation_expired: '초대 링크가 만료되었습니다.',
  reset_token_expired: '비밀번호 재설정 링크가 만료되었습니다.',
  leader_transfer_required: '인간 팀장을 먼저 위임해 주세요.',
  leader_not_removable: '팀장은 회의에서 뺄 수 없어요.',
  meeting_closed: '끝난 회의라 바꿀 수 없어요.',
  invalid_transfer_target: '이 팀원에게는 넘길 수 없어요.',
  active_tasks_exist: '진행 중인 작업의 담당자를 먼저 정리해 주세요.',
  project_membership_remaining: '참여 중인 프로젝트를 먼저 정리해 주세요.',
  analysis_not_completed:
    '문서 4종의 색인이 아직 끝나지 않았어요. 색인이 끝난 뒤 다시 기준을 만들어 주세요.',
  document_not_approved:
    '아직 승인하지 않은 문서가 있어요. 4종을 모두 승인한 뒤 기준을 만들어 주세요.',
  baseline_exists:
    '이미 기준 v1이 있어요. 새로고침해서 지금 기준을 확인해 주세요.',
  required_documents_missing: '필수 문서 4종을 먼저 올려 주세요.',
  change_proposal_required:
    '기준 설계 생성 이후 문서 수정은 변경 제안을 통해 요청해 주세요.',
  submission_locked: '팀장 검토를 요청한 뒤에는 고칠 수 없어요.',
  review_stale: '본문이 바뀌어 비비 검토를 다시 받아야 해요.',
  review_decisions_pending:
    '처리하지 않은 보완 제안이 있어요. 반영하거나 넘겨 주세요.',
  submission_decided: '이미 결정한 검토 요청이에요.',
  already_member: '이미 팀원이에요.',
  invitation_email_mismatch: '초대받은 이메일로 로그인해 주세요.',
  agent_limit_reached:
    '활성 토큰은 프로젝트마다 5개까지예요. 쓰지 않는 토큰을 폐기한 뒤 다시 발급해 주세요.',
}
export function getApiErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError)
    return '서버 응답 형식이 API 계약과 다릅니다.'
  const code = getApiErrorCode(error)
  if (code && messages[code]) return messages[code]
  if (isAxiosError(error) && !error.response)
    return '서버에 연결할 수 없습니다. 연결 상태를 확인해 주세요.'
  return '요청을 완료하지 못했습니다. 다시 시도해 주세요.'
}

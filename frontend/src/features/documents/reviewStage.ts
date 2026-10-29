import type { DocumentWorkingCopy } from '@/api/contracts/common'

// 지금 작성 건이 어느 단계인지. 검토가 최신 본문과 맞을 때만 그 검토를 쓴다.
export function reviewStage(copy: DocumentWorkingCopy) {
  const review =
    copy.latest_review?.resolved_revision === copy.revision
      ? copy.latest_review
      : undefined
  if (copy.status === 'APPROVED') return { step: 4, label: '승인 완료', review }
  if (copy.status === 'SUBMITTED')
    return { step: 3, label: '팀장 승인 대기', review }
  if (!review)
    return {
      step: 1,
      label: copy.status === 'REJECTED' ? '반려됨' : '비비 검토 전',
      review,
    }
  if (review.suggestions.some((item) => item.decision === 'PENDING'))
    return { step: 2, label: '수정 제안 확인', review }
  return { step: 3, label: '팀장 검토 요청 전', review }
}

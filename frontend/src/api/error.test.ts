import { AxiosError, AxiosHeaders } from 'axios'
import { expect, it } from 'vitest'
import { getApiErrorMessage } from './error'

const failure = (code: string) =>
  new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 409,
    statusText: 'Conflict',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code, message: 'server text' } },
  })

it('최초 기준 만들기 거절 코드마다 할 일을 알려 준다', () => {
  expect(getApiErrorMessage(failure('analysis_not_completed'))).toContain(
    '색인이 아직 끝나지 않았어요',
  )
  expect(getApiErrorMessage(failure('document_not_approved'))).toContain(
    '아직 승인하지 않은 문서가 있어요',
  )
  expect(getApiErrorMessage(failure('baseline_exists'))).toContain(
    '이미 기준 v1이 있어요',
  )
})

it('기준 v1 뒤 문서 수정은 변경 제안으로 안내한다', () => {
  expect(getApiErrorMessage(failure('change_proposal_required'))).toBe(
    '기준 설계 생성 이후 문서 수정은 변경 제안을 통해 요청해 주세요.',
  )
})

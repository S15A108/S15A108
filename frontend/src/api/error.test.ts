import { AxiosError, AxiosHeaders } from 'axios'
import { expect, it } from 'vitest'
import { getApiErrorMessage, isMissingApi, MISSING_API_MESSAGE } from './error'

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

const response = (status: number, data?: unknown) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  })

it('서버에 없는 경로·메서드만 준비 중으로 보고, 있는 API의 항목 없음은 오류로 둔다', () => {
  const missingPath = response(404, {
    error: { code: 'not_found', message: MISSING_API_MESSAGE },
  })
  expect(isMissingApi(missingPath)).toBe(true)
  expect(isMissingApi(response(404))).toBe(true)
  expect(isMissingApi(response(405))).toBe(true)
  expect(isMissingApi(response(501))).toBe(true)
  expect(
    isMissingApi(
      response(404, { error: { code: 'not_found', message: '없는 회의' } }),
    ),
  ).toBe(false)
  expect(isMissingApi(response(409))).toBe(false)
  expect(getApiErrorMessage(missingPath)).toBe(
    '이 기능은 서버에서 아직 준비 중이에요.',
  )
})

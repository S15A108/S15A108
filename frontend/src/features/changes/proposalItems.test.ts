import { expect, it } from 'vitest'
import type { DesignItemVersion } from '@/api/contracts/common'
import { proposalFormSchema, toChangeItems, toRows } from './proposalItems'

const approved: DesignItemVersion = {
  id: '311',
  design_item_id: '301',
  key: 'REQ-001',
  kind: 'REQUIREMENT',
  version_no: 1,
  status: 'APPROVED',
  schema_version: 1,
  content: { description: '참여 프로젝트를 조회한다.', priority: 'HIGH' },
}

it('고치기·새 항목·없애기를 변경 제안 항목으로 바꾸고 다시 폼 줄로 되돌린다', () => {
  const items = toChangeItems(
    [
      {
        operation: 'UPDATE',
        design_item_id: '301',
        kind: 'REQUIREMENT',
        sentence: '없으면 빈 화면 안내를 본다.',
      },
      {
        operation: 'CREATE',
        design_item_id: '',
        kind: 'POLICY',
        sentence: '초대는 7일 뒤 만료된다.',
      },
      {
        operation: 'RETIRE',
        design_item_id: '301',
        kind: 'REQUIREMENT',
        sentence: '',
      },
    ],
    [approved],
  )
  expect(items).toEqual([
    {
      operation: 'UPDATE',
      design_item_id: '301',
      base_design_item_version_id: '311',
      schema_version: 1,
      proposed_content: {
        description: '없으면 빈 화면 안내를 본다.',
        priority: 'HIGH',
      },
    },
    {
      operation: 'CREATE',
      kind: 'POLICY',
      schema_version: 1,
      proposed_content: { description: '초대는 7일 뒤 만료된다.' },
    },
    {
      operation: 'RETIRE',
      design_item_id: '301',
      base_design_item_version_id: '311',
    },
  ])
  expect(toRows(items).map((row) => row.sentence)).toEqual([
    '없으면 빈 화면 안내를 본다.',
    '초대는 7일 뒤 만료된다.',
    '',
  ])
})

it('항목을 고르지 않거나 문장이 비면 항목마다 알려 준다', () => {
  const result = proposalFormSchema.safeParse({
    title: '제목',
    reason: '이유',
    task_id: '',
    items: [
      {
        operation: 'UPDATE',
        design_item_id: '',
        kind: 'REQUIREMENT',
        sentence: ' ',
      },
    ],
  })
  expect(result.success).toBe(false)
  expect(result.error?.issues.map((issue) => issue.message)).toEqual([
    '바꿀 항목을 골라 주세요.',
    '바뀔 문장을 입력해 주세요.',
  ])
  expect(
    proposalFormSchema.safeParse({
      title: '제목',
      reason: '이유',
      task_id: '',
      items: [],
    }).error?.issues[0].message,
  ).toBe('바꿀 설계 항목을 하나 이상 넣어 주세요.')
})

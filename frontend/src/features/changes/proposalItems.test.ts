import { expect, it } from 'vitest'
import type { DesignItemVersion } from '@/api/contracts/common'
import {
  proposalFormSchema,
  toChangeItems,
  toDocumentChanges,
  toRows,
} from './proposalItems'

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

// PR #72 리뷰 1: 문서 2개짜리 반려 제안을 그대로 다시 내면 두 문서 변경이 모두 요청에 남아야 한다.
it('다시 내는 제안은 폼에서 고친 첫 문서와 나머지 문서 변경을 모두 보낸다', () => {
  const source = [
    {
      document_id: '201',
      base_document_version_id: '2011',
      proposed_document_version_id: '2019',
      after_content: '# 기획안\n고친 글',
      content_hash: 'sha256:a',
    },
    {
      document_id: '203',
      base_document_version_id: '2031',
      proposed_document_version_id: '2039',
      after_content: '# 요구사항\n고친 글',
      content_hash: 'sha256:b',
    },
  ]
  // 폼 기본값은 첫 문서, 나머지는 그대로 함께 간다.
  const changes = toDocumentChanges(
    { document_id: '201', after_content: source[0].after_content },
    '2012',
    source.slice(1),
  )
  expect(changes).toEqual([
    {
      document_id: '201',
      base_document_version_id: '2012',
      after_content: '# 기획안\n고친 글',
    },
    {
      document_id: '203',
      base_document_version_id: '2031',
      after_content: '# 요구사항\n고친 글',
    },
  ])
  // 첫 문서를 '고치지 않음'으로 바꿔도 나머지 문서는 남고, 폼에서 같은 문서를 고르면 폼의 글이 대신한다.
  expect(
    toDocumentChanges({ document_id: '' }, undefined, source.slice(1)),
  ).toHaveLength(1)
  expect(
    toDocumentChanges(
      { document_id: '203', after_content: '새 글' },
      '2032',
      source.slice(1),
    ),
  ).toEqual([
    {
      document_id: '203',
      base_document_version_id: '2032',
      after_content: '새 글',
    },
  ])
  // 남는 문서가 있으면 설계 항목·고칠 문서가 없어도 막지 않는다.
  expect(
    proposalFormSchema.safeParse({
      title: '제목',
      reason: '이유',
      task_id: '',
      items: [],
      kept_documents: 1,
    }).success,
  ).toBe(true)
})

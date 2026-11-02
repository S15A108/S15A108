import { expect, it } from 'vitest'
import { proposalFormSchema, toDocumentChanges } from './proposalItems'

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

it('고칠 문서도 함께 올라갈 변경도 없으면 문서를 고르라고 알린다', () => {
  expect(
    proposalFormSchema.safeParse({ title: '제목', reason: '이유', task_id: '' })
      .error?.issues[0].message,
  ).toBe('고칠 문서를 골라 주세요.')
  expect(
    proposalFormSchema.safeParse({
      title: '제목',
      reason: '이유',
      task_id: '',
      kept_items: 1,
    }).success,
  ).toBe(true)
})

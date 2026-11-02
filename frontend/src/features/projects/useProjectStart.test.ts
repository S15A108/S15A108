import { afterEach, expect, it, vi } from 'vitest'
import { planningApi } from '@/api/services'
import { readAllDrafts } from './useProjectStart'

afterEach(() => vi.restoreAllMocks())

const draft = (id: string) => ({ id }) as never

// PR #72 전수 리뷰 AMP-05: 초안이 100개를 넘어도 모든 페이지를 같은 draft_snapshot_hash로 읽어 시작에 보낸다.
it('설계 초안을 다음 페이지까지 모두 읽는다', async () => {
  const items = vi
    .spyOn(planningApi, 'items')
    .mockResolvedValueOnce({
      items: [draft('1'), draft('2')],
      has_more: true,
      next_cursor: 'c2',
      draft_snapshot_hash: 'h1',
    })
    .mockResolvedValueOnce({
      items: [draft('3')],
      has_more: false,
      draft_snapshot_hash: 'h1',
    })
  const result = await readAllDrafts('10')
  expect(result.items.map((item) => item.id)).toEqual(['1', '2', '3'])
  expect(result.draft_snapshot_hash).toBe('h1')
  expect(items).toHaveBeenLastCalledWith('10', {
    status: 'DRAFT',
    limit: 100,
    cursor: 'c2',
  })
})

it('읽는 사이 초안 해시가 바뀌면 처음부터 다시 읽는다', async () => {
  vi.spyOn(planningApi, 'items')
    .mockResolvedValueOnce({
      items: [draft('1')],
      has_more: true,
      next_cursor: 'c2',
      draft_snapshot_hash: 'old',
    })
    .mockResolvedValueOnce({
      items: [draft('2')],
      has_more: false,
      draft_snapshot_hash: 'new',
    })
    .mockResolvedValueOnce({
      items: [draft('1'), draft('2')],
      has_more: false,
      draft_snapshot_hash: 'new',
    })
  const result = await readAllDrafts('10')
  expect(result.items.map((item) => item.id)).toEqual(['1', '2'])
  expect(result.draft_snapshot_hash).toBe('new')
})

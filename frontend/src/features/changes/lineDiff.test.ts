import { expect, it } from 'vitest'
import { foldDiff, lineDiff } from './lineDiff'

it('바뀐 줄은 빠진 줄과 더한 줄로, 같은 줄은 그대로 나눈다', () => {
  expect(lineDiff('a\nb\nc', 'a\nB\nc\nd')).toEqual([
    { kind: 'same', text: 'a' },
    { kind: 'removed', text: 'b' },
    { kind: 'added', text: 'B' },
    { kind: 'same', text: 'c' },
    { kind: 'added', text: 'd' },
  ])
})

it('바뀐 줄 앞뒤 한 줄만 남기고 나머지 같은 줄은 개수로 접는다', () => {
  const lines = lineDiff('1\n2\n3\n4\n5\n6', '1\n2\n3\n4\n5\nX')
  expect(foldDiff(lines)).toEqual([
    { kind: 'folded', count: 4 },
    { kind: 'same', text: '5' },
    { kind: 'removed', text: '6' },
    { kind: 'added', text: 'X' },
  ])
})

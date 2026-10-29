// 문서 원문을 줄 단위로 비교한다(PNL-04 수정안 회의 제안 · 바뀌는 내용).
export type DiffLine = { kind: 'same' | 'removed' | 'added'; text: string }
export type FoldedLine = DiffLine | { kind: 'folded'; count: number }

// ponytail: LCS 표가 줄 수의 곱만큼 커진다. 수천 줄 문서가 느려지면 Myers 알고리즘으로 바꾼다.
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const lcs = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  )
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const lines: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ kind: 'same', text: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1])
      lines.push({ kind: 'removed', text: a[i++] })
    else lines.push({ kind: 'added', text: b[j++] })
  }
  while (i < a.length) lines.push({ kind: 'removed', text: a[i++] })
  while (j < b.length) lines.push({ kind: 'added', text: b[j++] })
  return lines
}

// 바뀐 줄 앞뒤 context줄만 남기고, 나머지 같은 줄은 접어 개수로 보여 준다.
export function foldDiff(lines: DiffLine[], context = 1): FoldedLine[] {
  const folded: FoldedLine[] = []
  lines.forEach((line, index) => {
    const near = lines
      .slice(Math.max(0, index - context), index + context + 1)
      .some((item) => item.kind !== 'same')
    const last = folded.at(-1)
    if (near) folded.push(line)
    else if (last?.kind === 'folded') last.count++
    else folded.push({ kind: 'folded', count: 1 })
  })
  return folded
}

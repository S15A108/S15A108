import { z } from 'zod'
import type { ChangeItem, DesignItemVersion } from '@/api/contracts/common'
import { describeContent } from '@/lib/display'

export const kindLabel = {
  REQUIREMENT: '요구사항',
  API_CONTRACT: 'API 계약',
  DATA_CONTRACT: '데이터 계약',
  POLICY: '정책',
  CONSTRAINT: '제약',
} as const
export const operationLabel = {
  UPDATE: '고치기',
  CREATE: '새 항목',
  RETIRE: '없애기',
} as const

const rowSchema = z
  .object({
    operation: z.enum(['UPDATE', 'CREATE', 'RETIRE']),
    design_item_id: z.string(),
    kind: z.enum([
      'REQUIREMENT',
      'API_CONTRACT',
      'DATA_CONTRACT',
      'POLICY',
      'CONSTRAINT',
    ]),
    sentence: z.string().trim().max(2000, '2000자까지 쓸 수 있어요.'),
  })
  .superRefine((row, context) => {
    if (row.operation !== 'CREATE' && !row.design_item_id)
      context.addIssue({
        code: 'custom',
        path: ['design_item_id'],
        message: '바꿀 항목을 골라 주세요.',
      })
    if (row.operation !== 'RETIRE' && !row.sentence)
      context.addIssue({
        code: 'custom',
        path: ['sentence'],
        message: '바뀔 문장을 입력해 주세요.',
      })
  })

export const proposalFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '제목을 입력해 주세요.')
    .max(120, '120자까지 쓸 수 있어요.'),
  reason: z
    .string()
    .trim()
    .min(1, '이유를 입력해 주세요.')
    .max(2000, '2000자까지 쓸 수 있어요.'),
  task_id: z.string(),
  items: rowSchema.array().min(1, '바꿀 설계 항목을 하나 이상 넣어 주세요.'),
})
export type ProposalFormValues = z.infer<typeof proposalFormSchema>
export type ProposalRow = ProposalFormValues['items'][number]

export const emptyRow: ProposalRow = {
  operation: 'UPDATE',
  design_item_id: '',
  kind: 'REQUIREMENT',
  sentence: '',
}

// API 미정(H2): 설계 항목 내용을 문장 하나로 받을지 정해지지 않아 description에 넣고 나머지 구조는 그대로 둔다.
export function toChangeItems(
  rows: ProposalRow[],
  approved: DesignItemVersion[],
): ChangeItem[] {
  return rows.map((row) => {
    if (row.operation === 'CREATE')
      return {
        operation: 'CREATE',
        kind: row.kind,
        schema_version: 1,
        proposed_content: { description: row.sentence },
      }
    const base = approved.find(
      (item) => item.design_item_id === row.design_item_id,
    )
    if (!base) throw new Error('승인된 설계 항목을 찾을 수 없어요.')
    const reference = {
      design_item_id: base.design_item_id,
      base_design_item_version_id: base.id,
    }
    return row.operation === 'RETIRE'
      ? { operation: 'RETIRE', ...reference }
      : {
          operation: 'UPDATE',
          ...reference,
          schema_version: base.schema_version,
          proposed_content: { ...base.content, description: row.sentence },
        }
  })
}

export function toRows(items: ChangeItem[]): ProposalRow[] {
  return items.map((item) => ({
    operation: item.operation,
    design_item_id: item.design_item_id ?? '',
    kind: item.kind ?? 'REQUIREMENT',
    sentence:
      item.operation === 'RETIRE' ? '' : describeContent(item.proposed_content),
  }))
}

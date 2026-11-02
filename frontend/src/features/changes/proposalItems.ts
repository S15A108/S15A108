import { z } from 'zod'
import type {
  ChangeItem,
  DesignItemVersion,
  DocumentChange,
  ResolvedDocumentChange,
} from '@/api/contracts/common'
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

export const proposalFormSchema = z
  .object({
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
    items: rowSchema.array(),
    // 고칠 문서(선택): 고친 글을 after_content로 보낸다(CHG-A01 documents).
    document_id: z.string().optional(),
    after_content: z.string().optional(),
    // 다시 내는 제안에서 폼 밖에 그대로 남는 문서 변경 수(toDocumentChanges의 kept)
    kept_documents: z.number().int().optional(),
  })
  .superRefine((form, context) => {
    if (!form.items.length && !form.document_id && !form.kept_documents)
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: '바꿀 설계 항목을 하나 이상 넣어 주세요.',
      })
    if (form.document_id && !form.after_content?.trim())
      context.addIssue({
        code: 'custom',
        path: ['after_content'],
        message: '고친 글을 입력해 주세요.',
      })
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

// 제안의 문서 변경. 폼은 문서 하나(document_id)를 고치고, 원래 제안의 나머지 문서 변경은 받은 값 그대로 함께 보낸다.
// 폼에서 같은 문서를 고르면 폼의 글이 그 문서를 대신한다.
export function toDocumentChanges(
  form: Pick<ProposalFormValues, 'document_id' | 'after_content'>,
  editedVersionId: string | undefined,
  kept: ResolvedDocumentChange[] = [],
): DocumentChange[] {
  return [
    ...(form.document_id && editedVersionId
      ? [
          {
            document_id: form.document_id,
            base_document_version_id: editedVersionId,
            after_content: form.after_content ?? '',
          },
        ]
      : []),
    ...kept
      .filter((change) => change.document_id !== form.document_id)
      .map((change) => ({
        document_id: change.document_id,
        base_document_version_id: change.base_document_version_id,
        after_content: change.after_content,
      })),
  ]
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

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { agentsApi, membersApi } from '@/api/services'
import type { IssueTokenResponse } from './schemas'
import { allTokens } from './allTokens'
import { getApiErrorMessage, unlessMissing } from '@/api/error'
import { useProjectAction } from '@/features/workspace/useProjectAction'
import { useSession } from '@/features/auth/useSession'
import { AsyncState } from '@/components/AsyncState'
import { ActionForm } from '@/components/ActionForm'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/formatDate'
import { apiMode } from '@/lib/apiMode'
import { cn } from '@/lib/utils'

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
      <span className="grid size-7 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
        {number}
      </span>
      <div className="grid min-w-0 gap-3">
        <h4 className="pt-1 text-sm font-semibold">{title}</h4>
        {children}
      </div>
    </li>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant="outline"
      className="justify-self-start"
      onClick={() =>
        void navigator.clipboard
          .writeText(value)
          .then(() => setCopied(true))
          .catch(() => setCopied(false))
      }
    >
      {copied ? '복사했어요' : label}
    </Button>
  )
}

// 연결 안내(AGT-A04)가 없을 때 쓰는 고정 단계
const fallbackSteps = [
  '터미널에서 Claude Code를 켜요.',
  '아래 MCP 주소와 발급한 토큰으로 BEEZ MCP 서버를 추가해요.',
  'Claude Code를 다시 시작해요.',
]

// 설정 › 내 에이전트 · 연결 상태 → 토큰 발급 → Claude Code에 BEEZ 추가 → CLAUDE.md 붙여넣기를 한 화면에.
export function AgentsPanel({ projectId }: { projectId: string }) {
  const session = useSession()
  const action = useProjectAction(projectId)
  const [fresh, setFresh] = useState<IssueTokenResponse | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  // 발급 오류(예: 활성 토큰 5개 한도)는 토큰 이름 폼이 알려 주고, 폐기 오류는 폐기 확인 상자에 둔다.
  const [revokeError, setRevokeError] = useState('')
  const [checked, setChecked] = useState(false)
  // 토큰(AGT-A01~A03)과 팀원은 따로 불러 연결 안내·현황이 없어도 발급·목록·폐기는 그대로 쓴다.
  const query = useQuery({
    queryKey: ['projects', projectId, 'agent-settings'],
    queryFn: async () => {
      const [tokens, members] = await Promise.all([
        allTokens(projectId),
        membersApi.list(projectId),
      ])
      return { tokens, members }
    },
  })
  // API 없음: AGT-A04·A05(-178 구현 전). 404면 연결 안내는 발급 응답(mcp_url·claude_md_snippet)으로, 연결 현황은 '준비 중'으로 둔다.
  const guide = useQuery({
    queryKey: ['projects', projectId, 'agent-guide'],
    queryFn: () => unlessMissing(agentsApi.connectionGuide(projectId)),
  })
  const agents = useQuery({
    queryKey: ['projects', projectId, 'agent-connections'],
    queryFn: () => unlessMissing(agentsApi.list(projectId)),
  })
  const shownGuide =
    guide.data ??
    (fresh
      ? {
          steps: fallbackSteps,
          mcp_url: fresh.mcp_url,
          claude_md_snippet: fresh.claude_md_snippet,
        }
      : undefined)
  const statusReady = agents.isSuccess && agents.data !== undefined
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold">내 에이전트</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          이 프로젝트 전용 토큰으로 내 Claude Code를 연결해요. 연결과 작업
          상태는 에이전트가 보낸 보고를 기준으로 보여요.
        </p>
      </div>
      <AsyncState query={query}>
        {(data) => {
          const me = data.members.items.find(
            (member) => member.account_id === session.data?.id,
          )
          const mine = agents.data?.items.find(
            (agent) => agent.member_id === me?.id,
          )
          const tokens = data.tokens.filter((token) => !token.revoked_at)
          const state = mine?.connected
            ? mine.status_check_required
              ? 'recheck'
              : 'connected'
            : checked
              ? 'failed'
              : 'none'
          return (
            <>
              <div
                role="status"
                className={cn(
                  'flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm',
                  state === 'connected' && 'border-emerald-300 bg-emerald-50',
                  state === 'failed' &&
                    'border-destructive/50 bg-destructive/5',
                )}
              >
                <div>
                  <p className="font-semibold">
                    {!statusReady
                      ? '연결 상태 확인은 준비 중이에요'
                      : state === 'connected'
                        ? '연결됨'
                        : state === 'recheck'
                          ? '연결 확인 필요'
                          : state === 'failed'
                            ? '연결 실패'
                            : '아직 연결 안 됨'}
                    {mine?.last_report_at &&
                      ` · 마지막 보고 ${formatDate(mine.last_report_at)}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {!statusReady
                      ? '토큰 발급과 연결 안내는 그대로 쓸 수 있어요. 연결 여부는 서버가 준비되면 여기에 보여요.'
                      : state === 'connected'
                        ? '에이전트가 이 프로젝트로 보고하고 있어요.'
                        : state === 'failed'
                          ? '아직 보고가 오지 않았어요. 토큰과 MCP 주소를 확인하고 Claude Code를 다시 시작해 주세요.'
                          : state === 'recheck'
                            ? '보고가 오래됐어요. Claude Code를 켠 뒤 다시 확인해 주세요.'
                            : '아래 단계를 마친 뒤 연결 확인을 눌러 주세요.'}
                  </p>
                </div>
                {statusReady && (
                  <Button
                    variant="outline"
                    disabled={agents.isFetching}
                    onClick={() =>
                      void agents.refetch().then(() => setChecked(true))
                    }
                  >
                    {agents.isFetching ? '확인 중…' : '연결 확인'}
                  </Button>
                )}
              </div>
              <ol className="grid gap-6">
                <Step number={1} title="토큰 발급">
                  {fresh ? (
                    <div
                      className="grid gap-2 rounded-xl border border-primary/40 bg-primary/5 p-4"
                      aria-label="한 번만 표시하는 새 토큰"
                    >
                      <p className="text-sm font-semibold">
                        이 화면을 닫으면 토큰 값을 다시 볼 수 없어요.
                      </p>
                      <code className="block overflow-x-auto rounded-lg bg-background p-3 text-xs select-text">
                        {fresh.token}
                      </code>
                      <p className="text-xs text-muted-foreground">
                        이 프로젝트에서만 써요 ·{' '}
                        {fresh.token_info.label || '내 에이전트 토큰'} · 발급{' '}
                        {formatDate(fresh.token_info.created_at)}
                        {/* API 없음: 토큰이 쓸 수 있는 범위와 만료일(리뷰 M16)이 응답에 없다. */}
                      </p>
                      {apiMode === 'mock' && (
                        <p className="text-xs">
                          예시 토큰은 실제 서버에 쓸 수 없어요.
                        </p>
                      )}
                      <span className="flex gap-2">
                        <CopyButton value={fresh.token} label="토큰 복사" />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setFresh(null)}
                        >
                          값 숨기기
                        </Button>
                      </span>
                    </div>
                  ) : (
                    <ActionForm
                      fields={[
                        {
                          name: 'label',
                          label: '토큰 이름',
                          value: '내 Claude Code',
                          max: 40,
                        },
                      ]}
                      submitLabel="토큰 발급"
                      onSubmit={async (values) => {
                        await action.run(async () => {
                          setFresh(
                            await agentsApi.issueToken(projectId, {
                              label: values.label,
                            }),
                          )
                        }, '토큰을 발급했어요.')
                      }}
                    />
                  )}
                  {tokens.length > 0 && (
                    <ul className="grid gap-2">
                      {tokens.map((token) => (
                        <li
                          key={token.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
                        >
                          <div>
                            <strong className="text-sm">
                              {token.label || '내 에이전트 토큰'}
                            </strong>
                            <p className="mt-1 text-xs text-muted-foreground">
                              발급 {formatDate(token.created_at)} · 최근 호출{' '}
                              {formatDate(token.last_used_at)}
                            </p>
                          </div>
                          {revoking === token.id ? (
                            <div className="grid w-full gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                              <p>
                                폐기하면 이 토큰의 연결이 바로 끊기고 되돌릴 수
                                없어요. 지금까지의 기록은 남아요.
                              </p>
                              {revokeError && (
                                <p role="alert" className="text-destructive">
                                  {revokeError}
                                </p>
                              )}
                              <span className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={action.busy}
                                  onClick={() =>
                                    void action
                                      .run(
                                        () => agentsApi.revokeToken(token.id),
                                        '토큰을 폐기했어요.',
                                      )
                                      .then(() => {
                                        setRevoking(null)
                                        if (fresh?.token_info.id === token.id)
                                          setFresh(null)
                                      })
                                      .catch((error) =>
                                        setRevokeError(
                                          getApiErrorMessage(error),
                                        ),
                                      )
                                  }
                                >
                                  폐기하기
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setRevoking(null)}
                                >
                                  취소
                                </Button>
                              </span>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={action.busy}
                              onClick={() => {
                                setRevokeError('')
                                setRevoking(token.id)
                              }}
                            >
                              폐기
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Step>
                <Step number={2} title="Claude Code에 BEEZ 추가">
                  <ol className="list-inside list-decimal text-sm leading-7">
                    {(shownGuide?.steps ?? fallbackSteps).map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {shownGuide ? (
                    <>
                      <code className="block overflow-x-auto rounded-lg bg-muted p-3 text-xs select-text">
                        {shownGuide.mcp_url}
                      </code>
                      <CopyButton
                        value={shownGuide.mcp_url}
                        label="MCP 주소 복사"
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      토큰을 발급하면 연결 안내가 나와요.
                    </p>
                  )}
                </Step>
                <Step number={3} title="CLAUDE.md 붙여넣기">
                  {shownGuide ? (
                    <>
                      <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-4 text-xs whitespace-pre-wrap select-text">
                        {shownGuide.claude_md_snippet}
                      </pre>
                      <CopyButton
                        value={shownGuide.claude_md_snippet}
                        label="CLAUDE.md 내용 복사"
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      토큰을 발급하면 붙여넣을 내용이 나와요.
                    </p>
                  )}
                </Step>
              </ol>
              <p className="text-xs text-muted-foreground">
                팀원들의 에이전트 연결과 작업은 대시보드 › 에이전트 현황에서
                봐요.
                {apiMode === 'mock' &&
                  ' 예시 화면은 실제 Claude Code 연결을 하지 않아요.'}
              </p>
              {action.message && <p className="text-sm">{action.message}</p>}
            </>
          )
        }}
      </AsyncState>
    </div>
  )
}

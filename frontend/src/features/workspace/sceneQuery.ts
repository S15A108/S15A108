import { queryOptions } from '@tanstack/react-query'
import { unlessMissing } from '@/api/error'
import { documentsApi, membersApi, projectsApi, tasksApi } from '@/api/services'
import { onboardingFrom } from '@/features/projects/onboardingFrom'

// 워크스페이스 첫 화면 데이터. 초기 설정 현황(PRJ-A06)이 서버에 없으면 대체 계산이 내 계정의 에이전트 연결을
// 보므로, 계정 id를 키에 넣고 세션이 준비된 뒤에만 부른다(늦게 온 세션으로 my_agent_connected가 false로 굳지 않게).
export function sceneQuery(projectId: string, accountId?: string) {
  return queryOptions({
    queryKey: ['projects', projectId, 'scene', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const [project, members, tasks, onboarding] = await Promise.all([
        projectsApi.get(projectId),
        membersApi.list(projectId),
        tasksApi.list(projectId, { limit: 100 }),
        unlessMissing(projectsApi.onboarding(projectId)),
      ])
      return {
        project,
        members,
        tasks,
        onboarding:
          onboarding ??
          onboardingFrom(
            project,
            members.items,
            (await documentsApi.list(projectId, { limit: 100 })).items,
            accountId,
          ),
      }
    },
  })
}

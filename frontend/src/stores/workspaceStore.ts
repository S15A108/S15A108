import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 단축 바 1~6(documents, changes, meetings, tasks, relations, dashboard)과 가운데 비비(chat),
// 톱니(settings), 지난 알림(inbox). planning·context는 단축 바에서 뺐지만 문서함·작업에서 아직 연다.
export type WorkspacePane =
  | 'documents'
  | 'planning'
  | 'changes'
  | 'tasks'
  | 'meetings'
  | 'relations'
  | 'dashboard'
  | 'settings'
  | 'inbox'
  | 'chat'
  | 'context'
export type BuildingDesign = 'glass' | 'brick' | 'modern' | 'tower' | 'wood'
type Placement = { lot: number; design: BuildingDesign }
interface WorkspaceState {
  pane: WorkspacePane | null
  focusId: string | null
  viewMode: 'first' | 'third'
  outdoor: boolean
  placements: Record<string, Placement>
  openPane: (pane: WorkspacePane | null, focusId?: string | null) => void
  setViewMode: (viewMode: 'first' | 'third') => void
  setOutdoor: (outdoor: boolean) => void
  placeProject: (
    accountId: string,
    projectId: string,
    placement: Placement,
  ) => void
}
export const placementKey = (accountId: string, projectId: string) =>
  `${accountId}:${projectId}`
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      pane: null,
      focusId: null,
      viewMode: 'third',
      outdoor: false,
      placements: {},
      openPane: (pane, focusId = null) => set({ pane, focusId }),
      setViewMode: (viewMode) => set({ viewMode }),
      setOutdoor: (outdoor) => set({ outdoor }),
      placeProject: (accountId, projectId, placement) =>
        set((state) => ({
          placements: {
            ...state.placements,
            [placementKey(accountId, projectId)]: placement,
          },
        })),
    }),
    {
      name: 'beez.scene.preferences.v1',
      partialize: (state) => ({
        placements: state.placements,
        viewMode: state.viewMode,
      }),
    },
  ),
)

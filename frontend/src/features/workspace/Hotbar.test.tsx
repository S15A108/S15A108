import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { Hotbar } from './Hotbar'

beforeEach(() => useWorkspaceStore.setState({ pane: null, focusId: null }))

it('숫자 키로 단축 바 칸을 열고 잠긴 칸은 열지 않는다', async () => {
  render(<Hotbar locked={['changes']} badges={{}} />)
  await userEvent.keyboard('2')
  expect(useWorkspaceStore.getState().pane).toBeNull()
  await userEvent.keyboard('4')
  expect(useWorkspaceStore.getState().pane).toBe('tasks')
})

it('잠긴 칸을 눌러도 창이 열리지 않고 이유를 알려 준다', async () => {
  render(<Hotbar locked={['relations']} badges={{ changes: 2 }} />)
  const locked = screen.getByRole('button', { name: '설계 관계' })
  expect(locked).toHaveAttribute('title', '문서 4종을 올리면 열려요')
  await userEvent.click(locked)
  expect(useWorkspaceStore.getState().pane).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: '비비와 대화' }))
  expect(useWorkspaceStore.getState().pane).toBe('chat')
})

import beeBlue from '@/assets/characters/bee-blue.png'
import beeGreen from '@/assets/characters/bee-green.png'
import beeOrange from '@/assets/characters/bee-orange.png'
import beePurple from '@/assets/characters/bee-purple.png'
import beeYellow from '@/assets/characters/bee-yellow.png'

// 캐릭터 프리셋 5종(캔버스 SCR-05-v2-account). 키는 계정 avatar 저장값(bee-*) 그대로 쓰고,
// 그림과 3D 모델은 Kenney Mini Characters(CC0, public/models/kenney/characters)로 바꿨다.
export const characters = [
  {
    key: 'bee-yellow',
    label: '노랑 셔츠',
    colorName: '노랑',
    color: '#f3c530',
    model: 'character-female-b',
    portrait: beeYellow,
  },
  {
    key: 'bee-blue',
    label: '파랑 비니',
    colorName: '파랑',
    color: '#4f86c6',
    model: 'character-female-c',
    portrait: beeBlue,
  },
  {
    key: 'bee-green',
    label: '초록 안경',
    colorName: '초록',
    color: '#3f9a5c',
    model: 'character-male-a',
    portrait: beeGreen,
  },
  {
    key: 'bee-purple',
    label: '보라 셔츠',
    colorName: '보라',
    color: '#7d64c8',
    model: 'character-female-a',
    portrait: beePurple,
  },
  {
    key: 'bee-orange',
    label: '주황 수염',
    colorName: '주황',
    color: '#e07b39',
    model: 'character-male-b',
    portrait: beeOrange,
  },
] as const

export type Character = (typeof characters)[number]
export type CharacterKey = Character['key']

export const characterModelUrl = (character: Character) =>
  `/models/kenney/characters/${character.model}.glb`

const hex = (value: string) =>
  [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16))

// 계정의 avatar가 프리셋이면 그대로, 아니면(옛 값 human·robot·bee 등) 표시 색에 가장 가까운 프리셋.
// 팀원 응답에는 avatar가 없어 다른 사람은 표시 색으로 고르고, 색도 없으면 id로 고르게 나눈다.
export function characterOf(
  avatar?: string,
  color?: string,
  seed = '',
): Character {
  const preset = characters.find((item) => item.key === avatar)
  if (preset) return preset
  if (color && /^#[0-9a-f]{6}$/i.test(color)) {
    const [r, g, b] = hex(color)
    return characters.reduce((best, item) => {
      const distance = (target: Character) => {
        const [tr, tg, tb] = hex(target.color)
        return (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2
      }
      return distance(item) < distance(best) ? item : best
    })
  }
  const sum = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0)
  return characters[sum % characters.length]
}

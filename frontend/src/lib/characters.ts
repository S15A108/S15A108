import beeBlueHead from '@/assets/characters/bee-blue-head.svg'
import beeBlue from '@/assets/characters/bee-blue.svg'
import beeGreenHead from '@/assets/characters/bee-green-head.svg'
import beeGreen from '@/assets/characters/bee-green.svg'
import beeOrangeHead from '@/assets/characters/bee-orange-head.svg'
import beeOrange from '@/assets/characters/bee-orange.svg'
import beePurpleHead from '@/assets/characters/bee-purple-head.svg'
import beePurple from '@/assets/characters/bee-purple.svg'
import beeYellowHead from '@/assets/characters/bee-yellow-head.svg'
import beeYellow from '@/assets/characters/bee-yellow.svg'

// 캐릭터 프리셋 5종. 이름과 그림은 캔버스 SCR-05-v2-account 보드 그대로이고, 키는 계정 avatar 저장값(bee-*)이다.
// portrait는 몸 전체(캐릭터 고르기·프로필 카드), face는 머리줄 동그라미에 쓰는 얼굴이다.
export const characters = [
  {
    key: 'bee-yellow',
    label: '꿀벌 후드',
    colorName: '노랑',
    color: '#f3c530',
    portrait: beeYellow,
    face: beeYellowHead,
  },
  {
    key: 'bee-blue',
    label: '안경 셔츠',
    colorName: '파랑',
    color: '#4f86c6',
    portrait: beeBlue,
    face: beeBlueHead,
  },
  {
    key: 'bee-green',
    label: '초록 앞치마',
    colorName: '초록',
    color: '#3f9a5c',
    portrait: beeGreen,
    face: beeGreenHead,
  },
  {
    key: 'bee-purple',
    label: '보라 헤드폰',
    colorName: '보라',
    color: '#7d64c8',
    portrait: beePurple,
    face: beePurpleHead,
  },
  {
    key: 'bee-orange',
    label: '주황 모자',
    colorName: '주황',
    color: '#e07b39',
    portrait: beeOrange,
    face: beeOrangeHead,
  },
] as const

export type Character = (typeof characters)[number]
export type CharacterKey = Character['key']

const hex = (value: string) =>
  [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16))

// 계정의 avatar가 프리셋이면 그대로, 아니면(옛 값 human·robot·bee 등) 표시 색에 가장 가까운 프리셋.
// 색도 없으면 id로 고르게 나눈다.
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

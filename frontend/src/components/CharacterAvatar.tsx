import type { Character } from '@/lib/characters'
import { cn } from '@/lib/utils'

// 팀원 동그라미 아바타: Kenney 캐릭터 그림을 표시 색 바탕에 얹는다. 이름이 옆에 있어 그림은 장식이다.
export function CharacterAvatar({
  character,
  color = character.color,
  className,
}: {
  character: Character
  /** 바탕 색. 없으면 캐릭터 색 */
  color?: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-8 shrink-0 place-items-end overflow-hidden rounded-full',
        className,
      )}
      style={{ backgroundColor: `${color}33` }}
    >
      <img
        src={character.portrait}
        alt=""
        draggable={false}
        className="size-[118%] max-w-none object-cover object-top"
      />
    </span>
  )
}

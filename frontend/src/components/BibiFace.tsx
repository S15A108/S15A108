import bibi from '@/assets/bibi.png'
import { cn } from '@/lib/utils'

// 비비 얼굴: 캔버스 원본 이미지(공용 문서함 모달안, 에셋 eb5e742b…)를 둥근 칸에 머리 중심으로 잘라 보여 준다.
// 작은 크기에서 왼쪽 아래 손과 몸이 빠지도록 머리 쪽을 기준으로 키운다.
export function BibiFace({
  className,
  label,
}: {
  className?: string
  /** 그림만으로 비비를 알려야 하면 넣는다. 없으면 장식으로 숨긴다. */
  label?: string
}) {
  return (
    <span
      className={cn(
        'inline-block size-10 shrink-0 overflow-hidden rounded-full bg-[#ece8df]',
        className,
      )}
      aria-hidden={label ? undefined : true}
    >
      <img
        src={bibi}
        alt={label ?? ''}
        draggable={false}
        className="size-full origin-[50%_35%] scale-125 object-cover"
      />
    </span>
  )
}

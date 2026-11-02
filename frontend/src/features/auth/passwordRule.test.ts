import { describe, expect, it } from 'vitest'
import { passwordRule } from './passwordRule'
import { objectParticle } from '@/lib/display'

describe('비밀번호 규칙', () => {
  it('영문·숫자·특수문자가 모두 있으면 통과한다', () => {
    expect(passwordRule('beez-demo-2026')).toBeUndefined()
  })
  it('하나라도 빠지면 안내 문구를 돌려준다', () => {
    expect(passwordRule('beezdemo2026')).toMatch('특수문자')
    expect(passwordRule('beez-demo')).toMatch('특수문자')
    expect(passwordRule('2026-10-28')).toMatch('특수문자')
  })
})

describe('목적격 조사', () => {
  it('받침이 있으면 을, 없으면 를을 붙인다', () => {
    expect(objectParticle('이메일')).toBe('을')
    expect(objectParticle('비밀번호')).toBe('를')
    expect(objectParticle('프로젝트 이름')).toBe('을')
    expect(objectParticle('ERD')).toBe('를')
  })
})

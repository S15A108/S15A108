// 회원가입·비밀번호 변경 공통 규칙: 영문·숫자·특수문자를 모두 넣고 8~128자.
// 길이는 폼의 min/max가 검사한다. 백엔드는 아직 8~128자만 검사한다.
export const PASSWORD_HINT =
  '영문, 숫자, 특수문자를 모두 넣어 8자 이상(128자 이하)'

// 틀리면 규칙과 빠진 것을 함께 알려 준다(캔버스 SCR-01-v2-register, SCR-05-v2-password).
export function passwordRule(value: string) {
  const missing = [
    !/[A-Za-z]/.test(value) && '영문',
    !/\d/.test(value) && '숫자',
    !/[^A-Za-z0-9]/.test(value) && '특수문자',
  ].filter(Boolean)
  if (missing.length)
    return `${PASSWORD_HINT}으로 입력하세요. ${missing.join(', ')}${missing.at(-1) === '영문' ? '이' : '가'} 없어요.`
}

// 회원가입·비밀번호 변경 공통 규칙: 영문·숫자·특수문자를 모두 넣고 8~128자.
// 길이는 폼의 min/max가 검사한다. 백엔드는 아직 8~128자만 검사한다.
export function passwordRule(value: string) {
  if (
    !/[A-Za-z]/.test(value) ||
    !/\d/.test(value) ||
    !/[^A-Za-z0-9]/.test(value)
  )
    return '영문, 숫자, 특수문자를 모두 넣어 주세요.'
}

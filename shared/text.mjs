/**
 * 글자 다루기 — 관리자와 서버가 같이 씁니다.
 *
 * 같은 규칙을 두 곳에 적어 두면 한쪽만 고쳤을 때 화면과 저장이 갈립니다.
 * 슬러그가 특히 그렇습니다. 관리자가 만든 주소와 서버가 저장하는 주소가 달라지면
 * 링크가 죽습니다.
 */

/**
 * 주소로 쓸 슬러그. 한글 제목을 자동 변환하지 않습니다 — %ED%95%9C… 같은 주소가 됩니다.
 * 영문 소문자·숫자·하이픈만 남기고, 앞뒤 하이픈은 지웁니다.
 */
export const cleanSlug = (v) =>
  String(v || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')

/** 날짜를 2026.09.18 꼴로. 시간대는 실행 환경을 따릅니다 */
export const ymd = (v) => {
  const d = new Date(v)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
}

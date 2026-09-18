/**
 * 뜬 눈 / 감은 눈 — **지금 상태**를 그린다(다음 동작이 아니라).
 *
 * 글 목록의 「공개에서 내리기」와 홈디자인의 「보이기」가 같은 뜻이라 같은 그림을 쓴다.
 * 홈디자인에 「☐ 보이기」 체크칸을 따로 두었더니 같은 일이 두 모양으로 보였다(2026-09-17 사용자 지적).
 */
export const Eye = ({ off }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1.8 12S5.6 5 12 5s10.2 7 10.2 7-3.8 7-10.2 7S1.8 12 1.8 12Z" />
    <circle cx="12" cy="12" r="3.2" />
    {off && <path d="M3 3l18 18" />}
  </svg>
)

/**
 * 보이기 단추 — 눈 하나. 글 목록의 `.vis` 와 같은 약속이다:
 * `aria-pressed="true"` = **숨김**(감은 눈), 이름은 누르면 일어날 일을 말한다.
 */
export const EyeToggle = ({ shown, onToggle, what }) => (
  <button type="button" className="vis" aria-pressed={shown ? 'false' : 'true'}
          aria-label={shown ? `${what} 숨기기` : `${what} 보이기`}
          title={shown ? '지금 보임 — 누르면 숨깁니다' : '지금 숨김 — 누르면 보입니다'}
          onClick={onToggle}>
    <Eye off={!shown} />
  </button>
)

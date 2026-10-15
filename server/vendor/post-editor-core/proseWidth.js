/**
 * 사진·사진 행·도면의 폭 `N%` 를 **본문 열 대비**로 푼 CSS 값.
 *
 * 그냥 `width:N%` 로 쓰면 기준이 부모(`.prose-body`)가 된다. 그 부모는 본문 열보다 넓다 —
 * 편집 화면은 화면 끝까지, 발행 화면은 사이트 본문 폭(`.wrap`)까지. 그런데 이 블록들은
 * 천장(`max-width: var(--measure)`)을 들고 있어서, 본문 열을 넘는 % 는 전부 천장에 걸려
 * **폭을 줄여도 그림이 그대로였다**(2472px 편집면에서 44% 아래로 내려가야 겨우 줄었다).
 * 기준을 본문 열로 옮기면 100% 가 곧 천장이고, 줄이는 만큼 바로 줄어든다.
 *
 * `min(100%, …)` 은 좁은 화면(본문 열보다 부모가 좁을 때)을 위한 것이다.
 * `--measure` 가 없는 곳(`.prose` 밖)에서는 예전처럼 부모 대비 % 가 된다.
 */
export function blockWidth(pct) {
    return `calc(min(100%, var(--measure, 100%)) * ${Number(pct) / 100})`;
}
/**
 * 「가운데폭」이 뜻하는 폭.
 *
 * 상수로 내보내는 이유: 이 값을 고르는 곳(툴바의 폭 고르개)과 저장한 값을 다시 읽는 곳
 * (글을 열어 고치는 화면·발행 화면)이 서로 다른 파일이다. 한쪽만 알고 있으면 저장할 때의
 * 폭과 다시 열었을 때의 폭이 달라진다 — 실제로 `'measure'`(38rem)로 되돌아가 글줄이 좁아졌다.
 */
export const CENTERED_WIDTH = '68rem';
/**
 * `width` 를 `.prose` 에 얹을 인라인 스타일로 바꾼다.
 *
 * - `'measure'`(기본) — 아무 것도 얹지 않는다. `prose.css` 의 38rem 이 그대로 산다
 * - `'full'` — 글줄까지 화면 끝까지. 블로그가 고른 값이다
 * - 그 밖의 문자열 — CSS 길이로 그대로 쓴다(`'72rem'`). 천장을 두고 싶을 때
 */
export function proseWidthStyle(width) {
    if (!width || width === 'measure')
        return undefined;
    const w = width === 'full' ? '100%' : width;
    /**
     * **CSS 길이가 아니면 무시한다.**
     *
     * 이 값은 글의 `properties` 에서 오고, 서버는 그 칸을 해석하지 않는다 — 앱 사용자가 채운
     * 문자열이 그대로 여기까지 온다. 무효값을 넣으면 `min(var(--measure), 34rem)` 같은 선언이
     * 통째로 죽어 인용 상자가 무한폭이 되는 식으로 화면이 무너진다(주입은 아니다 — 이 변수가
     * 닿는 곳은 `max-width` 와 `calc()` 뿐이다). 모르는 값이면 기본 폭으로 떨어뜨린다.
     */
    if (!/^-?[\d.]+(px|rem|em|%|vw|ch)$/.test(w))
        return undefined;
    return { '--measure-override': w, '--wide-override': w };
}
//# sourceMappingURL=proseWidth.js.map
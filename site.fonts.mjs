/**
 * 이 레포가 직접 소유하는 글꼴 목록 — 지금은 비어 있습니다.
 *
 * 편집기(`@storkspear/post-editor-core`)가 기본으로 주는 12벌 말고 다른 글꼴을 쓰려면
 * 여기에 더하세요. 세 곳을 같이 고쳐야 실제로 보입니다:
 *
 *   1. 파일           `public/fonts/` 에 두고
 *   2. CSS 선언       `public/assets/fonts.local.css` 에 `@font-face`
 *   3. 목록           여기(발행본용) + `admin/src/fonts.js`(편집 화면용)
 *
 * ```js
 * export const SITE_FONTS = [
 *   { value: 'MyFont', label: '내 글꼴' },
 * ]
 * ```
 *
 * `value` 는 CSS 의 `font-family` 이름과 글자까지 같아야 합니다.
 *
 * ## 왜 발행 쪽에도 목록이 필요한가
 *
 * `title.js` 가 `FONT_VALUES.includes()` 로 거릅니다. 목록에 없는 글꼴 값은 null 로
 * 지워집니다 — 편집기에서 고른 제목 글꼴이 발행하면서 기본서체로 바뀝니다.
 * 조용히 사라지는 종류라, 발행본을 열어 보기 전까지 모릅니다.
 *
 * 넣기 전에 라이선스를 보세요 — `CREDITS.md`. 검사는 `node tools/check-fonts.mjs`.
 */
export const SITE_FONTS = [
  /**
   * 프리텐다드 — 이 레포가 기본으로 쓰는 글꼴입니다.
   *
   * `public/assets/fonts.css` 가 npm 패키지(`pretendard`)에서 받아 선언하고,
   * `public/assets/site.css` 의 `--display`·`--sans` 가 이것을 가리킵니다.
   * 목록에 없으면 관리자의 「색·글꼴」에서 지금 쓰고 있는 글꼴을 고를 수가 없습니다.
   */
  { value: 'Pretendard Variable', label: '프리텐다드' },
]

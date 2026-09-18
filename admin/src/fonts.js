/**
 * 글꼴 고르기 목록에 **이 레포의 글꼴을 더하는 자리** — 지금은 비어 있습니다.
 *
 * 편집기(`@storkspear/post-editor-core`)가 기본으로 주는 12벌은 전부 npm 패키지에서 오고,
 * 각 패키지가 라이선스 전문을 같이 줍니다. 그 밖의 글꼴을 쓰고 싶으면 여기에 더하세요.
 *
 * ## 넣는 법 — 세 군데를 같이 고쳐야 보입니다
 *
 * 1. 파일을 `public/fonts/` 에 두고
 * 2. `public/assets/fonts.local.css` 에 `@font-face` 를 선언하고
 * 3. 여기에서 목록에 더합니다:
 *
 * ```js
 * import { configureFonts } from '@storkspear/post-editor-core/vocab'
 * import '../../public/assets/fonts.local.css'
 *
 * configureFonts({
 *   extra: [
 *     { value: 'MyFont', label: '내 글꼴' },
 *   ],
 * })
 * ```
 *
 * `value` 는 CSS 의 `font-family` 이름과 **글자까지 같아야** 합니다. 다르면 목록에는 뜨는데
 * 글씨는 안 바뀝니다 — 조용히 실패하는 종류라 찾기 어렵습니다.
 *
 * ⚠ 넣기 전에 라이선스를 보세요. 「웹사이트 임베딩 가능」은 「파일 재배포 가능」이 아닙니다.
 *   자세한 것은 `CREDITS.md`, 검사는 `node tools/check-fonts.mjs` 입니다.
 *
 * ## 왜 빈 파일을 남겨 두나
 *
 * 지우면 `boot.jsx` 의 import 도 같이 지워야 하고, 그러면 **나중에 글꼴을 더할 때 어디를
 * 고쳐야 하는지가 사라집니다.** 파일 하나가 목차 노릇을 합니다.
 */
import { configureFonts } from '@storkspear/post-editor-core'

/* 발행 쪽 목록(`site.fonts.mjs`)과 **같은 값**이어야 한다 — 갈리면 편집 화면에서 고른
   글꼴이 발행하면서 조용히 사라진다 */
configureFonts({ extra: [{ value: 'Pretendard Variable', label: '프리텐다드' }] })

/**
 * 공개 주소를 만드는 곳 — **한 곳에서만** 만든다.
 *
 * 주소는 `site.config.mjs` 의 `origin` 에서 온다. 관리자 주소에서 유추하지 않는다:
 * 관리자와 공개면은 포트로 갈릴 수도(로컬), 도메인으로 갈릴 수도 있다.
 *
 * `main.jsx` 가 아니라 이 파일에 두는 이유 — `work.jsx` 도 써야 하는데
 * `main.jsx` 는 `work.jsx` 를 import 한다. 서로 부르면 평가 순서에 따라
 * 한쪽이 초기화 전(TDZ)에 닿을 수 있다.
 */
import site from '../../site.config.mjs'

const clean = (o) => String(o || '').replace(/\/+$/, '')

/**
 * 관리자 화면은 **서버가 알려 준 주소**를 쓴다.
 *
 * `site.config.mjs` 의 값은 브라우저에서 굳은 것이라 포트를 바꾸면 못 따라온다 —
 * `.env` 의 `WEB_PORT` 를 8088 로 두면 서버는 8088 로 굽는데 관리자 링크만 8080 을
 * 가리켜 404 가 났다(2026-09-18 사용자 지적). 서버는 `SITE_ORIGIN` 을 읽어 제 주소를
 * 알고 있으므로, 설정을 불러올 때 그 값을 받아 여기 넣는다. 못 받으면 굳은 값이 남는다.
 */
let ORIGIN = clean(site.origin)
export const setOrigin = (o) => { if (o) ORIGIN = clean(o) }

/** 글은 `/blog/{번호}/`, 작업은 `/portfolio/{번호}/` */
export const postUrl = (slug, kind) =>
  `${ORIGIN}/${kind === 'work' ? 'portfolio' : 'blog'}/${encodeURIComponent(slug)}/`

/**
 * **관리자 안**의 작업 주소 — 공개면 주소(`postUrl`)와 다르다.
 *
 * `main.jsx` 의 `pathOf` 와 같은 규칙인데 여기 한 번 더 두는 까닭은 순환 import 다:
 * `main.jsx` 가 `work.jsx` 를 부르므로 반대로 부르면 평가 순서에 따라 한쪽이 초기화 전에 닿는다
 * (이 파일 머리말과 같은 이유).
 */
export const workPath = (no) => `/works/${encodeURIComponent(no)}`

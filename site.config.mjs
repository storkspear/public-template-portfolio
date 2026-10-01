/**
 * 이 파일 하나만 고치면 내 사이트가 됩니다.
 *
 * `.env` 가 아니라 여기 있는 이유: 비밀이 아니고, 기계마다 달라지지도 않습니다.
 * 사이트마다 다를 뿐입니다. 그래서 git 에 있고 코드 리뷰를 받습니다.
 * 비밀번호·DB 접속처럼 기계마다 다른 것은 `.env` 로 갑니다(`.env.example` 참고).
 *
 * 읽는 쪽
 *   · `server/bake.mjs`        — 발행된 글의 헤더·푸터·`<title>`
 *   · `admin/vite.config.js`   — `origin` 을 관리자 화면에 넣어 줍니다
 *   · `docker-compose.yml`     — `name` 이 컨테이너 이름과 DB 스키마의 어근
 */
export default {
  /**
   * 기계가 쓰는 이름. 영문 소문자·숫자·하이픈만.
   * DB 스키마 이름과 도커 컨테이너 이름이 여기서 갈라져 나오므로,
   * 한 기계에서 여러 사이트를 돌릴 거면 서로 달라야 합니다.
   */
  name: 'my-site',

  /**
   * 남이 클론해 가는 레포인가. 글꼴 검사(`npm run check:fonts`)의 엄격함을 가릅니다.
   *
   *   true   공개 템플릿. `public/fonts/` 의 woff2 가 클론하는 사람마다 복사되므로
   *          재배포입니다 — 라이선스 전문이 함께 가야 합니다(OFL 2조).
   *   false  이 레포만 쓰는 개인 사이트. 손으로 받은 글꼴은 `fonts.local.css` 의
   *          `@font-face` 선언으로 갈음합니다. **파생해서 제 사이트로 쓸 때는 false 로.**
   */
  redistributed: true,

  /**
   * 발행된 글이 제 주소를 적을 때 씁니다(정규 URL·OG 태그·관리자의 「글 보기」 링크).
   * 로컬에서는 이대로 두시고, 배포할 때 `https://example.com` 으로 바꾸세요.
   *
   * 포트를 바꿨으면 이 주소도 따라가야 합니다. `.env` 의 `WEB_PORT` 를 8088 로 두고
   *   이 값을 8080 으로 남겨 두면, 관리자의 「글 보기」·「작업 보기」가 아무도 안 듣는
   *   8080 을 가리켜 404 가 납니다. 그래서 compose 가
   *   `SITE_ORIGIN` 으로 포트를 맞춰 내려보내고, 여기서는 그 값을 먼저 씁니다.
   *   브라우저(관리자 화면)에는 `process` 가 없으므로 아래 문장이 그대로 기본값이 됩니다 —
   *   관리자 쪽은 서버가 `/api/settings` 로 알려 준 주소를 씁니다(`admin/src/urls.js`).
   */
  origin: (typeof process !== 'undefined' && process.env?.SITE_ORIGIN) || 'http://localhost:8080',

  /** 브라우저 탭과 OG 제목에 붙는 사이트 이름 */
  siteTitle: 'HONG GILDONG',
  /** 헤더 왼쪽에 보이는 이름 */
  brand: '홍길동',
  /** 검색 결과와 SNS 카드에 나오는 한 줄 */
  description: '만들면서 걸린 것을 적어 둡니다.',
  /**
   * 브라우저 탭 아이콘의 기본값. `public/assets/favicons/` 의 파일 이름입니다.
   * 관리자의 「공통 → 설정」에서 고르면 그 값이 이깁니다 — 여기 있는 것은 고르기 전의 모습입니다.
   * 고를 수 있는 이름은 `shared/site-vocab.mjs` 의 `FAVICONS` 입니다.
   */
  favicon: 'sprout',

  /** 푸터의 © 뒤에 붙는 이름 */
  copyright: 'HONG GILDONG',

  /**
   * 푸터의 GitHub 링크. 비우면 링크를 아예 출력하지 않습니다 —
   * 없는 주소로 보내느니 없는 편이 낫습니다.
   *
   * 아래 둘은 견본 값입니다(이름·제목이 「홍길동」인 것과 같은 결) — 받은 사람이 제 것으로
   * 바꿉니다. 비워 두면 큰 푸터가 연락처 없이 저작권 한 줄만 남아, 받자마자 보는 첫 화면이
   * 설계한 모습과 다릅니다.
   */
  github: 'https://github.com/hong-gildong',

  /** 푸터의 큰 연락처 줄. 비우면 출력하지 않습니다 */
  email: 'hello@example.com',

  /**
   * 아무것도 안 고른 사이트의 색·글꼴.
   *
   * 관리자의 「홈디자인 → 공통」에서 고르면 그 값이 이깁니다. 여기 있는 것은 고르기 전의
   * 모습이고, `public/assets/site.css` 의 `:root` 와 같은 값이어야 합니다 —
   * 어긋나면 처음 띄웠을 때 화면이 말없이 다른 색·다른 글꼴로 나옵니다.
   *
   * `display`·`body` 에 쓸 수 있는 이름은 편집기가 주는 12벌 + `site.fonts.mjs` 입니다.
   */
  theme: {
    paper: '#ffffff',
    ink: '#0b0d10',
    accent: '#25436b',
    display: 'Pretendard Variable',
    body: 'Pretendard Variable',
    /* 본문 폭(px). 헤더 띠·메인 콘텐츠 영역·블로그 목록·포트폴리오 목록이 「본문 폭」을
       고르면 전부 이 숫자를 따릅니다. `site.css` 의 `--body-w` 와 같아야 합니다. */
    bodyWidth: 1240,
  },

  /**
   * 메인과 작업 목록의 문구. 블로그 설명과 다릅니다 — 첫 화면은 블로그가 아닙니다.
   * 관리자의 「홈디자인」에서 덮어쓸 수 있습니다.
   */
  home: {
    title: 'HONG GILDONG',
    ogTitle: '홍길동 — 포트폴리오',
    description: '만들면서 걸린 것을 적어 둡니다.',
    /* 표지에 걸 작업의 정보(클라이언트·연도·역할)가 비었을 때 대신 쓰는 한 줄 */
    tagline: '',
  },
  works: {
    title: '작업 — HONG GILDONG',
    description: '홍길동이 만든 것들.',
  },

  /**
   * 헤더. 글 상세 화면에서는 이름 자리가 「← 글 목록」으로 바뀝니다.
   * `current: true` 는 지금 보고 있는 곳을 굵게 표시합니다.
   */
  nav: [
    { href: '/portfolio/', label: '포트폴리오' },
    { href: '/blog/', label: '블로그', current: true },
  ],
}

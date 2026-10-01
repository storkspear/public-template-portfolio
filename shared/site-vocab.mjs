/**
 * 사이트의 모양 어휘 — 관리자·API·굽기 셋이 이 파일 하나를 봅니다.
 * 검증 강도는 문마다 다릅니다: 관리자 API 는 정규화 결과가 들어온 값과 다르면 400,
 * 굽기는 이상한 항목만 버리고 나머지를 굽습니다. 관리자 번들에서도 불리므로 node 전용
 * API 를 쓰지 않습니다.
 */
import { SERVICE_ICONS, ICON_OF } from './site-icons.mjs'
import { MENU_ICONS } from './menu-icons.mjs'

/* 아이콘은 굽기와 관리자가 같이 렌더링합니다 — 어휘를 지나가게 해서 들여오는 곳을 하나로 둡니다 */
export { SERVICE_ICONS, ICON_OF }

/* ── 화면 셋 ──────────────────────────────────────────────────────────
   관리자의 「홈디자인」이 이 탭 그대로입니다: 색·글꼴이 맨 위에 한 번, 그 아래에
   페이지별 템플릿 + 그 페이지의 knob. 가르는 기준은 성격이 아니라 페이지 이름입니다. */
export const PAGES = [
  { key: 'main', label: '메인', path: '/' },
  { key: 'blog', label: '블로그', path: '/blog/' },
  { key: 'portfolio', label: '포트폴리오', path: '/portfolio/' },
]

/**
 * 그 화면의 본문을 누가 만드는가. `code` 는 레포의 `pages/<이름>.html` 을 그대로 내보내고,
 * `template` 은 고른 모양으로 굽기가 만듭니다.
 * 블로그에는 이 값이 없습니다 — 글이 DB 에서 오므로 언제나 템플릿입니다.
 */
export const PAGE_MODES = [
  { value: 'code', label: '직접 디자인', hint: '소스코드 내 pages/*.html 을 수정하여 꾸며보세요.' },
  { value: 'template', label: '템플릿', hint: '사이트에서 제공하는 템플릿을 사용해보세요.' },
]

/**
 * 「직접 디자인」이 어느 파일을 싣는가. `pages` 는 `pages/<화면>.html`, 나머지는
 * `sample-pages/<값>.html` 입니다. 고른 것은 설정에만 남습니다 — 관리자가 운영 서버의
 * 파일을 덮어쓰면 다음 배포에 사라집니다.
 * 값이 그대로 파일 이름이 되므로 이 목록이 곧 읽어도 되는 파일의 화이트리스트입니다.
 */
export const PAGE_SOURCE_MINE = 'pages'
export const PAGE_SAMPLES = {
  main: [
    { value: 'main1', label: '드롭', hint: '흐르는 띠와 굵은 한 문장, 둥둥 뜬 오브젝트',
      icon: [[0,1.5,24,2,1],[0,6,13,3,1],[0,10,10,3,1],[15,5,8,8,0],[0,15,5,2,1]] },
    { value: 'main2', label: '룩북', hint: '흰 쇼룸에 시즌 이름, 룩이 옆으로 넘어갑니다',
      icon: [[0,0,18,4,1],[0,6,5.2,9,0],[6.2,6,5.2,9,0],[12.4,6,5.2,9,0],[18.6,6,5.4,9,0],[0,16.3,5,0.8,1],[6.2,16.3,5,0.8,1],[12.4,16.3,5,0.8,1],[18.6,16.3,5,0.8,1]] },
    { value: 'main3', label: '스티커 보드', hint: '무드보드처럼 색 타일에 스티커와 손글씨',
      icon: [[0,0,15,10,1],[16,0,8,4.5,0],[16,5.5,3.5,4.5,0],[20.5,5.5,3.5,12.5,1],[0,11,3.5,7,0],[4.5,11,7,7,0],[12.5,11,7,3,1],[12.5,15,7,3,0]] },
    { value: 'main4', label: '매거진 커버', hint: '패션지 표지처럼 제호·표지 문구·바코드',
      icon: [[2,0.5,20,4,1],[8,6,8,11,0],[1,7,5,0.9,1],[1,9,4,0.7,0],[1,10.5,5,0.7,0],[18,12,5,0.9,1],[18,14,4,0.7,0],[19,16,4,2,1]] },
    { value: 'main5', label: '펼침면', hint: '책을 펼친 한 쌍 — 왼쪽 소개, 오른쪽 도판',
      icon: [[1,2,8,2.2,1],[1,6,9,0.9,0],[1,7.8,8,0.9,0],[1,9.6,9,0.9,0],[1,16,1.5,0.8,0],[11.9,0,0.2,18,0],[13,0,11,18,1]] },
  ],
  portfolio: [
    { value: 'portfolio1', label: '숍 그리드', hint: '셀렉트숍 신상품 판, 칩으로 거르기',
      icon: [[0,0,5.2,6,1],[6.2,0,5.2,6,0],[12.4,0,5.2,6,1],[18.6,0,5.4,6,0],[0,6.8,4,0.8,0],[6.2,6.8,4,0.8,0],[12.4,6.8,4,0.8,0],[18.6,6.8,4,0.8,0],[0,9.5,5.2,6,0],[6.2,9.5,5.2,6,1],[12.4,9.5,5.2,6,0],[18.6,9.5,5.4,6,1],[0,16.3,4,0.8,0],[6.2,16.3,4,0.8,0],[12.4,16.3,4,0.8,0],[18.6,16.3,4,0.8,0]] },
    { value: 'portfolio2', label: '캠페인', hint: '캠페인 한 편이 색 벽 한 장',
      icon: [[0,0,24,8.5,1],[3,1.5,6,5.5,0],[13,2.5,8,1.5,0],[13,5,6,0.8,0],[0,9.5,24,8.5,0],[15,11,6,5.5,1],[3,12,8,1.5,1],[3,14.5,6,0.8,1]] },
    { value: 'portfolio3', label: '아카이브', hint: '검은 판의 시즌 색인, 누르면 펼쳐집니다',
      icon: [[0,0,24,0.5,1],[0,1.5,3,1.2,1],[4,1.5,10,1.2,0],[22,1.3,2,1.6,0],[0,4.2,24,6.2,0],[1,5,4.5,4.5,1],[6.3,5,4.5,4.5,1],[11.6,5,4.5,4.5,1],[0,11.5,3,1.2,1],[4,11.5,9,1.2,0],[0,14.5,3,1.2,1],[4,14.5,11,1.2,0]] },
    { value: 'portfolio4', label: '화보 기사', hint: '패션지 화보처럼 큰 번호·제목·단·인용구',
      icon: [[0,0,4,5,1],[5,0.5,11,2,1],[5,3.5,8,0.8,0],[0,7,7,0.6,0],[0,8.2,7,0.6,0],[0,9.4,7,0.6,0],[0,10.6,6,0.6,0],[8,7,7,0.6,0],[8,8.2,7,0.6,0],[8,9.4,5,0.6,0],[17,0,7,18,1],[0,13,15,2.2,1],[0,16.5,10,0.6,0]] },
    { value: 'portfolio5', label: '교정지', hint: '같은 크기 종이에 한 점씩, 재단선과 캡션',
      icon: [[0.5,0.5,6.5,6.5,1],[8.75,0.5,6.5,6.5,1],[17,0.5,6.5,6.5,1],[0.5,7.6,4,0.6,0],[8.75,7.6,4,0.6,0],[17,7.6,4,0.6,0],[0.5,10,6.5,6.5,1],[8.75,10,6.5,6.5,1],[17,10,6.5,6.5,1],[0.5,17.1,4,0.6,0],[8.75,17.1,4,0.6,0],[17,17.1,4,0.6,0]] },
  ],
}

/* ── 헤더(모든 화면의 맨 위) ─────────────────────────────────────────
   색·글꼴처럼 한 번 정하면 세 화면에 다 걸리는 것이라 「공통」 탭에 삽니다.
   메인·블로그·포트폴리오가 각자 정하는 것과 섞이면 어디서 고쳐야 할지 알기 어려워집니다. */

/**
 * 메뉴를 어디에 둘까. 도형(`icon`)은 템플릿 카드와 같은 판짜기 그림입니다(아래 MAIN_TEMPLATES 설명).
 * 진하기 2 는 흰 칸 — 헤더 띠·드로어 판처럼 바탕보다 밝은 면을 그릴 때 씁니다.
 */
export const MENU_PLACES = [
  { value: 'header', label: '헤더', hint: '제목 옆에 메뉴가 늘 보입니다',
    icon: [[0,0,24,4,2],[0,4,24,0.35,1],[1,1.3,6,1.4,1],[14.5,1.5,3.5,1,1],[19.5,1.5,3.5,1,1],
           [0,6,11,5.5,0],[13,6,11,5.5,0],[0,13,11,5,0],[13,13,11,5,0]] },
  { value: 'sidebar', label: '사이드 바', hint: '≡ 버튼을 누르면 옆에서 나옵니다',
    icon: [[0,0,24,4,2],[0,4,24,0.35,1],[12,1.3,6,1.4,1],[0,6,24,5.5,0],[0,13,24,5,0],
           [0,0,9,18,1],[1.5,3,5,1,2],[1.5,5.5,5,1,2],[1.5,8,5,1,2]] },
]

/** 제목을 어느 쪽에 세울까. 메뉴는 반대쪽으로 갑니다 */
export const ALIGNS = [
  { value: 'left', label: '왼쪽', hint: '메뉴는 오른쪽', iconH: 7,
    icon: [[0,0.8,8,3.4,1],[14,1.85,3,1.3,0],[18,1.85,3,1.3,0],[22,1.85,2,1.3,0]] },
  { value: 'center', label: '가운데', hint: '메뉴는 오른쪽', iconH: 7,
    icon: [[8,0.8,8,3.4,1],[18,1.85,3,1.3,0],[22,1.85,2,1.3,0]] },
  { value: 'right', label: '오른쪽', hint: '메뉴는 왼쪽', iconH: 7,
    icon: [[16,0.8,8,3.4,1],[0,1.85,3,1.3,0],[4,1.85,3,1.3,0],[8,1.85,2,1.3,0]] },
]

/** 헤더가 쓰는 폭 */
/**
 * 폭 피커 — 세 자리가 같은 말을 씁니다(공통 제목 · 메인 콘텐츠 영역 · 포트폴리오 목록).
 * 저장되는 모양은 자리마다 다르지만(포트폴리오는 px knob) 보이는 말은 하나입니다.
 */
export const WIDTHS = [
  /* 그림은 납작하게. 처음엔 화면 비례(24:10)로 그렸더니 74px 짜리 회색 판이 되어
     피커가 통째로 커 보였습니다. 24:6 · 55px — 띠는 위아래 1.4 씩
     띄워 정확히 가운데입니다(제목 정렬에서 같은 지적을 받았습니다). */
  { value: 'narrow', label: '본문 폭', hint: '글과 같은 폭으로 가운데에 놓입니다', iconH: 8,
    icon: [[0,0,24,6,2],[5,1.4,14,3.2,1]] },
  { value: 'wide', label: '화면 폭', hint: '화면 양 끝까지 꽉 채웁니다', iconH: 8,
    icon: [[0,0,24,6,2],[0,1.4,24,3.2,1]] },
]
/* 헤더만 별도 스위치를 갖습니다. 본문은 좁게 + 상단 띠는 화면 끝까지가 흔한 레이아웃입니다 */
export const HEAD_WIDTHS = WIDTHS

/**
 * 사이드바가 어떻게 나오나 — 넷. 마크업은 하나고 CSS 만 다릅니다. 자바스크립트를 안 씁니다:
 * 숨은 확인칸 하나로 열고 닫습니다(공개면 JS 0).
 * 폭·색만 다른 것은 「오버레이」 하나로 합치고 knob(`width`·`bg`·`color`)으로 뺐습니다 —
 * 구조가 진짜 다른 것만 값으로 남깁니다.
 */
export const SIDEBARS = [
  /* 기본이 「밀기」다 — 덮으면 읽던 자리를 잃는데, 밀면 안 잃습니다(사용자 결정) */
  { value: 'push', label: '기본', hint: '본문을 오른쪽으로 밀며 나옵니다',
    icon: [[0,0,8,18,2],[8,0,0.35,18,1],[10,2,14,7,0],[10,11,14,7,0],[1.5,3,5,1,1],[1.5,5.5,5,1,1],[1.5,8,5,1,1]] },
  { value: 'overlay', label: '오버레이', hint: '본문 위를 덮습니다',
    icon: [[3,1,21,7,0],[3,10,21,7,0],[0,0,8,18,2],[8,0,0.35,18,1],[1.5,3,5,1,1],[1.5,5.5,5,1,1],[1.5,8,5,1,1]] },
  { value: 'rail', label: '고정', hint: '접히지 않고 늘 서 있습니다',
    icon: [[7.5,2,16.5,7,0],[7.5,11,16.5,7,0],[0,0,5.5,18,2],[5.5,0,0.35,18,1],[1,3,3.5,0.9,1],[1,5.5,3.5,0.9,1],[1,8,3.5,0.9,1]] },
  { value: 'center', label: '다운슬라이드', hint: '위에서 내려와 화면을 덮습니다',
    icon: [[0,0,24,18,2],[8,5,8,2,1],[9,8.5,6,2,1],[8.5,12,7,2,1]] },
]

/**
 * 사이드바 넓이(px). 「다운슬라이드」는 화면을 통째로 덮으므로 쓰지 않습니다 —
 * 관리자도 그때는 이 칸을 안 냅니다.
 */
export const DRAWER_W = { min: 200, max: 560, step: 10, d: 300 }

/**
 * 옛 설정의 문자열 여섯을 새 모양으로 — 읽을 때마다 지납니다.
 * 되돌리기가 옛 jsonb 를 새 판으로 다시 넣으므로 한 번 하는 이사로는 안 끝납니다.
 * 넷은 전부 덮는 것이었으므로 `overlay` 로 가고, 넓이만 그때 값을 살려 줍니다.
 */
const OLD_SIDEBAR = {
  line: { kind: 'overlay', width: 300 },
  solid: { kind: 'overlay', width: 300 },
  big: { kind: 'overlay', width: 420 },
  half: { kind: 'overlay', width: 480 },
  center: { kind: 'center' },
  rail: { kind: 'rail', width: 200 },
}

/**
 * 메뉴 한 줄이 어떻게 생겼나 — 헤더용 여섯. 마크업은 하나고 CSS 만 다릅니다.
 * 감싸는 `<nav>` 에 `s-nav-{값}` 이 붙고 `templates/header.css` 가 그 이름으로 가릅니다.
 * 다섯 상태를 벌마다 정합니다 — 기본 · 마우스오버 · 초점 · 누를 때 · 지금 화면.
 */
export const NAV_STYLES = [
  { value: 'plain', label: '글자만', hint: '색 하나로만 말합니다',
    iconH: 7, icon: [[0,1.6,6,1.8,0],[8,1.6,6,1.8,1],[16,1.6,5,1.8,0]] },
  { value: 'underline', label: '밑줄긋기', hint: '왼쪽에서 그어지고 오른쪽으로 빠집니다',
    iconH: 7, icon: [[0,1.2,6,1.8,0],[8,1.2,6,1.8,1],[8,3.8,6,0.7,1],[16,1.2,5,1.8,0]] },
  { value: 'dotted', label: '점선 밑줄', hint: '늘 점선, 올리면 실선이 됩니다',
    iconH: 7, icon: [[0,1.2,6,1.8,0],[0,3.8,1.2,0.6,0],[2,3.8,1.2,0.6,0],[4,3.8,1.2,0.6,0],[8,1.2,6,1.8,1],[8,3.8,6,0.7,1],[16,1.2,5,1.8,0]] },
  { value: 'marker', label: '형광펜', hint: '글자 뒤로 색이 차오릅니다',
    iconH: 7, icon: [[0,1.6,6,1.8,0],[7.4,1,7.2,3.2,0],[8,1.6,6,1.8,1],[16,1.6,5,1.8,0]] },
  { value: 'box', label: '네모', hint: '윤곽선이 늘 보입니다',
    iconH: 7, icon: [[0,0.8,7,3.4,2],[8,0.8,7,3.4,1],[16,0.8,6,3.4,2]] },
  { value: 'index', label: '번호', hint: '앞에 01 · 02 가 붙습니다',
    iconH: 7, icon: [[0,1.6,1.6,1.8,0],[2.4,1.6,4.5,1.8,0],[9,1.6,1.6,1.8,1],[11.4,1.6,4.5,1.8,1],[18,1.6,1.6,1.8,0],[20.4,1.6,3.6,1.8,0]] },
]

/**
 * 같은 일을 하는 사이드바용 다섯. 세로로 서는 목록이라 결이 다릅니다.
 * 판의 모양(`SIDEBARS`)은 글자 크기·글꼴을 정하고, 여기 다섯은 꾸밈만 정합니다 —
 * 안 그러면 갈래 × 아이템 조합마다 값을 다 만들어야 합니다.
 */
export const DRAWER_STYLES = [
  { value: 'line', label: '언더라인', hint: '줄마다 얇은 선',
    icon: [[0,0,24,0.6,0],[0,2,9,2,1],[0,5.5,24,0.6,0],[0,7.5,11,2,1],[0,11,24,0.6,0],[0,13,7,2,1],[0,16.5,24,0.6,0]] },
  { value: 'arrow', label: '화살표', hint: '올리면 오른쪽에서 → 가 옵니다',
    icon: [[0,1,9,2,1],[21,1,3,2,0],[0,7,11,2,1],[21,7,3,2,1],[0,13,7,2,1],[21,13,3,2,0]] },
  { value: 'index', label: '번호', hint: '앞에 01 · 02 가 붙습니다',
    icon: [[0,1,2.4,2,0],[4,1,8,2,1],[0,7,2.4,2,0],[4,7,10,2,1],[0,13,2.4,2,0],[4,13,6,2,1]] },
  { value: 'cell', label: '스퀘어', hint: '올리면 배경이 찹니다',
    icon: [[0,0,24,4.5,0],[1.5,1.6,9,1.4,1],[0,6.5,24,4.5,1],[1.5,8.1,11,1.4,2],[0,13,24,4.5,0],[1.5,14.6,7,1.4,1]] },
  { value: 'icon', label: '아이콘', hint: '줄 앞에 선 아이콘이 섭니다',
    icon: [[0,1,2.6,2.6,2],[4.4,1.3,9,2,1],[0,7,2.6,2.6,2],[4.4,7.3,11,2,1],[0,13,2.6,2.6,2],[4.4,13.3,7,2,1]] },
]

/**
 * 콘텐츠 타이틀의 사이즈 세 칸 — 「글 / 5편」과 「작업 / 9편」이 같은 부품을 씁니다.
 * 마크업과 CSS 가 하나라 달라지는 것은 값뿐입니다(이름·보이기·사이즈·정렬·갯수·상단 여백).
 */
export const HEAD_SIZES = [
  { value: 'sm', label: '작게', hint: '목록이 주인공일 때' },
  { value: 'md', label: '보통', hint: '' },
  { value: 'lg', label: '크게', hint: '머리가 표제처럼 선다' },
]

/** 메뉴에 걸리는 곳 — 이름을 바꾸거나 숨길 수 있습니다 */
export const NAV_LINKS = [
  { key: 'portfolio', label: '포트폴리오', href: '/portfolio/' },
  { key: 'blog', label: '블로그', href: '/blog/' },
]

/**
 * 레이아웃 도형 — 카드에 그릴 작은 판짜기 그림입니다. 이름만으로는 차이를 알 수 없어서입니다.
 * 칸은 `[x, y, w, h, 진하기]` — 24×18 판 위의 자리, 진하기 1이면 먹 0이면 옅은 회색.
 * 어휘가 그림을 데이터로 들고 있어 템플릿을 늘려도 관리자 코드는 안 고칩니다.
 */
/* ── 메인 = 무대 하나 + 목록 둘 ────────────────────────────────────────
   무대(첫 화면) 요소는 자유 위치이고, 목록(작업 목록·맺음말)은 넣을지 말지만 정합니다.
   좌표는 1240px 판 위의 px 입니다. 공개면은 글자 크기까지 화면 폭에 맞춰 통째로 줄이거나
   늘리고, 860px 이하에서는 판을 버리고 y → x 순으로 쌓습니다. */
export const STAGE_W = 1240
export const STAGE_H = { min: 120, max: 2000 }

/**
 * 무대에 서는 글자 상자. 개수는 관리자에서 더하고 뺍니다.
 * 크기는 px 가 아니라 칸입니다 — 칸 하나가 글자 크기·줄 높이·자간·글꼴 갈래·색을 함께
 * 들고 있어 상자마다 다섯 knob 을 열지 않아도 결이 유지됩니다.
 * `u` 는 1240px 판 단위, `rem` 은 판을 버리고 쌓는 좁은 화면(≤860px)용입니다.
 */
export const ITEM_SIZES = [
  { value: 'xl', label: '아주 크게', u: 80, lh: 1.1, ls: '-0.03em', fam: 'display', tone: 'fg',
    rem: 'clamp(2.2rem, 8vw, 3rem)' },
  { value: 'display', label: '크게', u: 60.8, lh: 1.16, ls: '-0.03em', fam: 'display', tone: 'fg',
    rem: 'clamp(1.9rem, 7vw, 2.6rem)' },
  { value: 'body', label: '보통', u: 18.4, lh: 1.7, ls: 'normal', fam: 'sans', tone: 'fg-2',
    min: 14, rem: '1rem' },
  { value: 'small', label: '작게', u: 15.04, lh: 1.7, ls: 'normal', fam: 'sans', tone: 'fg-2',
    min: 13, rem: '0.94rem' },
  { value: 'label', label: '아주 작게', u: 13.12, lh: 1.7, ls: '0.14em', fam: 'mono', tone: 'fg-3',
    min: 11, rem: '0.82rem' },
]

/**
 * 상자가 걸 수 있는 곳. 비면 그냥 글자입니다.
 * `custom` 은 피커의 값일 뿐이고 저장되는 것은 주소 그 자체라, 굽기는 한 값만 보고 `href` 를
 * 만듭니다. `http(s)://` 로 시작하는 것만 받아 `javascript:` 를 문 앞에서 막습니다.
 */
export const ITEM_LINKS = [
  { value: '', label: '연결 없음' },
  { value: 'portfolio', label: '포트폴리오', href: '/portfolio/' },
  { value: 'blog', label: '블로그', href: '/blog/' },
  /* 주소·전화는 그 상자의 글자가 곧 주소입니다 — 같은 값을 두 번 적게 하지 않습니다.
     푸터의 연락처 줄이 이 길로 `mailto:`·`tel:` 이 됩니다(굽기의 `boxHref`) */
  { value: 'mail', label: '이메일 보내기', from: 'text' },
  { value: 'tel', label: '전화 걸기', from: 'text' },
  { value: 'custom', label: '직접 입력' },
]

/** 바깥 주소인가 — 피커가 「직접 입력」을 켤지 정하는 데도 씁니다 */
export const isExternal = (v) => /^https?:\/\/[^\s"'<>]+$/.test(String(v || ''))

const pickLink = (v, problems, where) => {
  const t = String(v ?? '').trim()
  if (!t) return ''
  if (t === 'portfolio' || t === 'blog' || t === 'mail' || t === 'tel') return t
  if (isExternal(t)) return t.slice(0, 300)
  /**
   * 아직 쓰는 중인 주소는 알리지 않고 조용히 비웁니다. 알리면 문제 하나에 400 이라
   * 주소 칸에 한 글자 치는 순간 미리보기와 저장이 둘 다 실패합니다.
   * 굽기가 `isExternal` 로 다시 거르므로 덜 쓴 주소로는 링크가 안 나갑니다.
   * 봐주는 것은 `https://` 의 앞토막뿐입니다 — `javascript:`·`data:` 는 그대로 거절합니다.
   */
  const low = t.toLowerCase()
  if ('https://'.startsWith(low) || 'http://'.startsWith(low) || /^https?:\/\//.test(low)) return ''
  problems.push(`${where}: http:// 또는 https:// 로 시작하는 주소여야 합니다`)
  return ''
}

/**
 * 첫 화면에 세로로 서는 덩이들. 차례는 배열 순서입니다.
 * 콘텐츠 영역(무대)도 여기 들어갑니다 — 목록을 무대보다 앞에 두는 템플릿이 있어서입니다.
 * 다만 끌 수는 없습니다(`fixed`): 다 끄면 무엇을 하는 사이트인지 알 수 없게 됩니다.
 */
export const SECTION_KINDS = [
  { key: 'slides', label: '슬라이드', of: 'slides' },
  { key: 'stage', label: '콘텐츠 영역' },
  { key: 'shots', label: '이미지 콘텐츠 영역', of: 'shots' },
  { key: 'works', label: '포트폴리오 작업 목록' },
  { key: 'posts', label: '블로그 글 목록' },
]

/** 글자 수 상한 — 칸과 무관하게 하나. 첫 화면에 들어갈 만큼만 */
export const ITEM_MAX = 300

/**
 * 사진이 서는 두 자리와 그 상한. 같은 사진의 두 모습이 아니라 각자 사진을 가진 다른 자리입니다.
 * 모양을 `template` 에서 파생하면 안 됩니다 — 배치를 한 군데만 손대도 `template` 이
 * `custom` 으로 튑니다. 목록(`sections`)이 곧 모양이고, 다 끄면 흰 종이가 됩니다.
 */
export const SHOT_MAX = { shots: 12, slides: 10 }

/**
 * 콘텐츠 영역(글자 판)의 폭. 여기만 고르게 하는 까닭은 이 자리가 좌표계이기 때문입니다.
 * 글자 상자의 x·y 와 글자 크기가 전부 1240 기준 배수라, 판이 넓어지면 글자도 비율대로
 * 커지고 「높이 720」이 720px 이 아니게 됩니다. 둘 다 맞는 답이라 고르게 둡니다.
 */

/**
 * 이미지 콘텐츠 영역의 knob 넷 — 포트폴리오의 `KNOBS` 와 같은 규약입니다.
 * 사진을 세로로 잇는 자리는 간격이 전부입니다: 붙이면 한 장처럼, 띄우면 낱장으로 읽힙니다.
 * `d` 는 기본값이고 전부 0 에서 시작합니다(끝에서 끝까지 이어 붙인 모습).
 */
export const SHOT_KNOBS = [
  { key: 'top', label: '상단 간격', min: 0, max: 200, unit: 'px', d: 0, hint: '위 내용과의 사이' },
  { key: 'side', label: '좌우 간격', min: 0, max: 200, unit: 'px', d: 0, hint: '0 이면 폭을 꽉 채웁니다' },
  { key: 'gap', label: '이미지간 상하 간격', min: 0, max: 120, unit: 'px', d: 0, hint: '0 이면 한 장처럼 이어집니다' },
  { key: 'radius', label: '이미지 테두리', min: 0, max: 48, unit: 'px', d: 0, hint: '0 이면 각지게' },
]


/**
 * 템플릿의 시작 배치. 다른 템플릿을 누르면 이 배치로 되돌아갑니다.
 * 상자의 `id` 는 템플릿끼리 같은 이름을 씁니다 — 그래야 템플릿을 바꿀 때 같은 id 끼리
 * 짝지어 고친 글자를 지킵니다. 좌표는 1440px 화면에서 잰 값입니다.
 */
/**
 * `auto` — 글자를 감쌉니다(피그마의 hug). 폭 knob 을 끄는 순간 꺼져 고정 폭이 됩니다.
 * 문단도 감쌉니다: `w` 가 최대 폭으로 남아 짧은 글은 글자에 붙고 긴 글은 거기서 줄바꿈됩니다.
 */
const box = (id, x, y, w, show, size, extra = {}) =>
  ({ id, text: '', x, y, w, show, size, auto: true, font: '', color: '', link: '', ...extra })
/* 차례를 그대로 적습니다 — 「그리드 먼저」만 목록이 무대보다 앞입니다 */
const secs = (...keys) => keys.map((k) => (typeof k === 'string'
  ? { key: k, show: true } : { key: k[0], show: k[1] }))
/**
 * 템플릿이 들고 오는 견본 사진. 받은 사람이 제 사진으로 갈아 끼우는 자리입니다.
 * 미리보기에서만 채우면 요소 목록(빈칸)과 화면(사진 셋)이 어긋나므로 진짜 값으로 넣습니다
 * — 기본 글자를 템플릿이 들고 오는 것과 같은 규약입니다.
 */
export const SAMPLE_SHOTS = [
  { src: '/assets/sample/1.svg', thumb: '', w: 1600, h: 900 },
  { src: '/assets/sample/2.svg', thumb: '', w: 1200, h: 1500 },
  { src: '/assets/sample/3.svg', thumb: '', w: 1600, h: 1067 },
]
const sample = (n) => SAMPLE_SHOTS.slice(0, n).map((x) => ({ ...x }))

/**
 * 시작 배치. `height` 는 콘텐츠 영역(글자 판), `slideH` 는 배너의 높입니다 —
 * 켜져 있는 자리마다 제 높이를 갖습니다(하나를 둘이 나눠 쓰면 한쪽을 만질 때 다른 쪽이 따라 움직입니다).
 */
const start = ({ height = 280, slideH = 480, sections, items,
                 shots = [], slides = [], shotKnobs = {} }) =>
  ({ height, slideH, sections, items, shots, slides,
     shotKnobs: Object.fromEntries(SHOT_KNOBS.map((k) => [k.key, shotKnobs[k.key] ?? k.d])) })

export const MAIN_TEMPLATES = [
  { value: 'cover', label: '히어로 이미지', hint: '대표 작업 한 장이 첫 화면을 덮습니다',
    icon: [[0,0,24,9,1],[0,11,7,7,0],[8.5,11,7,7,0],[17,11,7,7,0]],
    start: start({ height: 720, sections: secs('stage', 'works', 'posts', ['shots', false], ['slides', false]), items: [
      box('title', 40, 120, 1094, true, 'display'),
      box('text', 40, 230, 626, true, 'body'),
    ] }) },
  { value: 'works', label: '그리드 먼저', hint: '작업 격자부터 — 인사는 그 아래. 보여 줄 것이 많을 때',
    icon: [[0,0,7,8,0],[8.5,0,7,8,0],[17,0,7,8,0],[0,10,7,8,0],[8.5,10,7,8,0],[17,10,7,8,0]],
    start: start({ sections: secs('works', 'stage', 'posts', ['shots', false], ['slides', false]), items: [
      box('title', 40, 91, 1094, true, 'display'),
      box('text', 40, 182, 626, true, 'body'),
    ] }) },
  { value: 'say', label: '헤드라인', hint: '큰 문장 한 줄이 먼저, 작업은 그 아래',
    icon: [[0,1,18,3,1],[0,6,11,1.5,0],[0,11,7,7,0],[8.5,11,7,7,0],[17,11,7,7,0]],
    start: start({ sections: secs('stage', 'works', 'posts', ['shots', false], ['slides', false]), items: [
      box('title', 40, 91, 1094, true, 'display'),
      box('text', 40, 182, 626, true, 'body'),
    ] }) },
  { value: 'stage', label: '타이포 표지', hint: '그림도 목록도 없이 이름과 한 문장만. 가장 조용한 첫 화면',
    icon: [[3,6,18,3.5,1],[6,12,12,1.5,0]],
    start: start({ height: 680, sections: secs('stage', ['works', false], ['posts', false], ['shots', false], ['slides', false]), items: [
      box('brand', 40, 206, 600, true, 'label'),
      box('title', 40, 253, 1160, true, 'xl'),
      box('text', 40, 366, 680, true, 'body'),
      box('goWorks', 40, 442, 90, true, 'small', { link: 'portfolio' }),
      box('goBlog', 138, 442, 90, true, 'small', { link: 'blog' }),
    ] }) },
  /**
   * 수직 이미지 — 글자 판이 서고 그 아래로 사진이 세로로 이어집니다.
   *
   * 판과 사진 더미를 겹치지 않고 위아래로 나눈 까닭: 판은 1240 좌표에 절대 위치로 놓는
   * 장치고 사진은 제 비율대로 높이가 정해집니다. 겹치면 글자가 어디 얹힐지 알 수 없습니다.
   */
  { value: 'vstack', label: '수직 이미지', hint: '사진을 세로로 쭉 잇습니다. 글자도 같이 놓을 수 있어요',
    icon: [[4,0,16,5,0],[4,6.5,16,5,0],[4,13,16,5,0]],
    start: start({ sections: secs('shots', ['stage', false], ['works', false], ['posts', false], ['slides', false]), shots: sample(3), items: [
      box('title', 40, 91, 1094, true, 'display'),
      box('text', 40, 182, 626, true, 'body'),
    ] }) },
  /**
   * 슬라이드 — 배너가 화면을 꽉 채우고 옆으로 넘어갑니다. 글자 판은 꺼진 채로 시작합니다.
   *
   * 자바스크립트를 한 바이트도 안 씁니다 — `scroll-snap` 이 바탕이고, 점과 화살표는
   * `::scroll-marker`·`::scroll-button()` 을 아는 브라우저에만 덤으로 붙습니다.
   */
  { value: 'slides', label: '슬라이드', hint: '배너가 화면을 꽉 채우고 옆으로 넘어갑니다',
    icon: [[0,4,3,10,0],[4.5,3,15,12,1],[21,4,3,10,0],[9,16.5,1.5,1.5,0],[12,16.5,1.5,1.5,1],[15,16.5,1.5,1.5,0]],
    start: start({ sections: secs('slides', ['works', false], ['stage', false], ['posts', false], ['shots', false]), slides: sample(3), items: [
      box('title', 40, 91, 1094, true, 'display'),
      box('text', 40, 182, 626, true, 'body'),
    ] }) },
  /**
   * 커스텀 — 고르는 것이 아니라 닿는 곳입니다.
   *
   * 배치를 한 군데라도 손대면 여기로 옵니다. 다른 템플릿을 누르면 그 템플릿의 시작 배치로
   * 초기화됩니다.
   */
  { value: 'custom', label: '커스텀', hint: '배치를 고치면 자동으로 여기로 옵니다',
    icon: [[0,1,9,3,1],[12,0,10,2,0],[2,7,14,2,0],[16,11,8,3,1],[0,13,10,2,0]],
    start: start({ sections: secs('stage', 'works', 'posts', ['shots', false], ['slides', false]), items: [
      box('title', 40, 91, 1094, true, 'display'),
      box('text', 40, 182, 626, true, 'body'),
    ] }) },
]

/**
 * 템플릿이 쓰는 상자 이름 전부 — [T] 로 더한 상자(`b1`…)와 가르는 데 씁니다.
 * 템플릿을 바꿀 때 이 이름들은 새 템플릿의 것으로 갈아 끼우고, 직접 더한 상자는 남깁니다.
 */
export const TEMPLATE_ITEM_IDS = [...new Set(MAIN_TEMPLATES.flatMap((t) => t.start.items.map((i) => i.id)))]

/**
 * 블로그 — 목록과 상세가 한 벌로 움직입니다. 목록만 바꾸면 둘의 결이 갈립니다.
 *
 * 열두 벌. 템플릿마다 글꼴 짝(`font`)을 들고 있고 누르면 글꼴 칸이 그 짝으로 바뀝니다.
 * `rows`·thumb·cards·titles·magazine·lines 는 예전 값 그대로라, 그 값으로 저장한 설정이
 * 말없이 다른 모양으로 바뀌지 않습니다.
 * hover 는 전부 형태가 바뀝니다 — accent 가 ink 로 대체되는 테마에서도 구별되어야 합니다.
 */
export const BLOG_TEMPLATES = [
  { value: 'rows', label: '기본', hint: '번호·제목·날짜 한 줄씩. 처음부터 쓰던 목록',
    font: { display: '', body: '' },
    icon: [[0,1,2.5,2,1],[4,1,20,2,0],[0,6,2.5,2,1],[4,6,20,2,0],[0,11,2.5,2,1],[4,11,20,2,0],[0,16,2.5,2,1],[4,16,20,2,0]] },
  { value: 'ledger', label: '장부', hint: '번호·제목·날짜가 선 위에 나란히. 글이 많아도 한눈에',
    font: { display: 'Noto Sans KR', body: 'Noto Sans KR' },
    icon: [[0,0,24,0.9,1],[0,2.6,2.5,1.5,1],[4,2.6,16,1.5,0],[21.5,2.6,2.5,1.5,0],[0,6.6,2.5,1.5,1],[4,6.6,16,1.5,0],[21.5,6.6,2.5,1.5,0],[0,10.6,2.5,1.5,1],[4,10.6,16,1.5,0],[21.5,10.6,2.5,1.5,0],[0,14.6,2.5,1.5,1],[4,14.6,16,1.5,0],[21.5,14.6,2.5,1.5,0]] },
  { value: 'feed', label: '날짜 피드', hint: '날짜가 앞에, 제목은 한 줄. 자주 쓰는 블로그에',
    font: { display: 'Nanum Gothic', body: 'Nanum Gothic' },
    icon: [[0,0.5,3.5,2.8,1],[5,1.2,14,1.5,1],[21,1.4,3,1,0],[0,5,3.5,2.8,1],[5,5.7,12,1.5,1],[21,5.9,3,1,0],[0,9.5,3.5,2.8,1],[5,10.2,15,1.5,1],[21,10.4,3,1,0],[0,14,3.5,2.8,1],[5,14.7,11,1.5,1],[21,14.9,3,1,0]] },
  { value: 'lines', label: '목차', hint: '제목과 날짜를 점선이 잇는 차례',
    font: { display: 'Nanum Myeongjo', body: 'Noto Sans KR' },
    icon: [[0,1.5,9,1.6,1],[10,2.3,10,0.5,0],[21,1.5,3,1.6,0],[0,5.5,12,1.6,1],[13,6.3,7,0.5,0],[21,5.5,3,1.6,0],[0,9.5,7,1.6,1],[8,10.3,12,0.5,0],[21,9.5,3,1.6,0],[0,13.5,10,1.6,1],[11,14.3,9,0.5,0],[21,13.5,3,1.6,0]] },
  { value: 'runin', label: '이어쓰기', hint: '굵은 제목에 첫 문장이 한 문단으로 이어집니다',
    font: { display: 'Nanum Myeongjo', body: 'Nanum Myeongjo' },
    icon: [[0,1,7,1.7,1],[7.6,1,16.4,1.7,0],[0,3.4,20,1.2,0],[0,6.7,9,1.7,1],[9.6,6.7,14.4,1.7,0],[0,9.1,17,1.2,0],[0,12.4,6,1.7,1],[6.6,12.4,17.4,1.7,0],[0,14.8,22,1.2,0]] },
  { value: 'titles', label: '표제', hint: '제목만 크게. 글이 적을 때',
    font: { display: 'Noto Serif KR', body: 'Noto Sans KR' },
    icon: [[0,1,19,3.2,1],[20.5,2,3.5,1,0],[0,7,14,3.2,1],[20.5,8,3.5,1,0],[0,13,17,3.2,1],[20.5,14,3.5,1,0]] },
  { value: 'stack', label: '에세이', hint: '굵은 제목과 첫 문장, 선 없이 넉넉하게',
    font: { display: 'Black Han Sans', body: 'Nanum Gothic' },
    icon: [[0,0,4,0.9,0],[0,1.6,18,3.4,1],[0,5.8,16,1,0],[0,7.4,12,1,0],[0,10.5,4,0.9,0],[0,12.1,14,3.4,1],[0,16.3,13,1,0]] },
  { value: 'thumb', label: '사진 행', hint: '줄 끝에 작은 사진, 날짜는 제목 위에',
    font: { display: 'Gowun Batang', body: 'Noto Sans KR' },
    icon: [[0,0.5,3,0.9,0],[0,2,13,1.8,1],[0,4.6,10,1,0],[17.5,0,6.5,5.5,1],[0,7,3,0.9,0],[0,8.5,13,1.8,1],[0,11.1,10,1,0],[17.5,6.5,6.5,5.5,1],[0,13.5,3,0.9,0],[0,15,13,1.8,1],[17.5,13,6.5,5,1]] },
  { value: 'magazine', label: '매거진', hint: '첫 글을 크게, 나머지는 두 단으로',
    font: { display: 'Gowun Batang', body: 'Gowun Dodum' },
    icon: [[0,0,24,7.5,1],[0,8.6,15,2.2,1],[0,11.4,11,1,0],[0,14,11,1.5,1],[13,14,11,1.5,1],[0,16.5,8,1,0],[13,16.5,8,1,0]] },
  { value: 'cards', label: '참고서 카드', hint: '굵은 윗선의 각진 카드. 사진이 있으면 카드를 채웁니다',
    font: { display: 'Noto Sans KR', body: 'Noto Sans KR' },
    icon: [[0,0,11,1,1],[0,1,11,7.5,2],[1,5.6,7,1.2,1],[13,0,11,1,1],[13,1,11,7.5,2],[14,5.6,7,1.2,1],[0,9.5,11,1,1],[0,10.5,11,7.5,2],[1,15.1,7,1.2,1],[13,9.5,11,1,1],[13,10.5,11,7.5,2],[14,15.1,7,1.2,1]] },
  { value: 'outline', label: '카드', hint: '사진 없이 글만 담는 얇은 테두리 카드',
    font: { display: 'Noto Sans KR', body: 'Nanum Gothic' },
    icon: [[0,0,11.5,8,2],[1,1,3,1,0],[8.5,1,2,1,0],[1,3,8,1.8,1],[1,5.5,7,1,0],[12.5,0,11.5,8,2],[13.5,1,3,1,0],[21,1,2,1,0],[13.5,3,8,1.8,1],[13.5,5.5,7,1,0],[0,10,11.5,8,2],[1,11,3,1,0],[8.5,11,2,1,0],[1,13,8,1.8,1],[1,15.5,7,1,0],[12.5,10,11.5,8,2],[13.5,11,3,1,0],[21,11,2,1,0],[13.5,13,8,1.8,1],[13.5,15.5,7,1,0]] },
  { value: 'issue', label: '호수', hint: '큰 번호가 표지가 됩니다. 사진이 없어도 됩니다',
    font: { display: 'Black Han Sans', body: 'Noto Sans KR' },
    icon: [[0,0,11,0.7,1],[0,1.8,6.5,6.2,1],[0,9.4,9,1.7,1],[0,11.9,7,1,0],[13,0,11,0.7,1],[13,1.8,6.5,6.2,1],[13,9.4,9,1.7,1],[13,11.9,7,1,0]] },
]

/**
 * 「카드」 한 갈래에만 붙는 테마.
 *
 * **왜 갈래 하나에만인가**: 목록 갈래 열둘은 마크업이 하나이고 CSS 만 갈립니다. 그래서
 * 갈래마다 「그 갈래다운 변형」이 다릅니다 — 장부에 톱니를 달 자리가 없고, 에세이에 모눈을
 * 깔면 글이 안 읽힙니다. 카드는 판이 있어서 테마를 갈아 끼울 자리가 있습니다.
 * 다른 갈래로 넓히고 싶어지면 그 갈래의 어휘를 따로 만드세요 — 이 목록을 돌려쓰면
 * 「호수에 영수증 톱니」 같은 조합이 열립니다.
 *
 * **글꼴 짝을 들고 옵니다**(`BLOG_TEMPLATES` 와 같은 규약). 터미널은 고정폭이, 스케치는
 * 손글씨가 아니면 테마가 안 섭니다. 누르면 관리자가 「글꼴」 칸도 그 짝으로 바꿉니다.
 *
 * **첫 값이 `plain`(지금 모습)이어야 합니다.** 기본이 현상 유지라야 쓰던 사람의 목록이
 * 안 바뀝니다. `check-contract` ②도 첫 값은 「바탕 규칙이 맡는다」고 보고 건너뜁니다.
 *
 * `chip` 은 관리자 피커가 그리는 작은 미리보기의 색입니다 — [바탕, 선, 글자].
 * 회색 막대(`icon`)로는 테마가 색과 질감인 이 목록을 구별할 수 없습니다.
 */
export const OUTLINE_SKINS = [
  { value: 'plain', label: '기본', hint: '포인트색 기운 얇은 선',
    font: { display: '', body: '' }, chip: ['#ffffff', '#b9b3f2', '#101114'] },
  { value: 'terminal', label: '터미널', hint: '어두운 판 · 고정폭 · 프롬프트 기호',
    font: { display: 'Nanum Gothic Coding', body: 'Nanum Gothic Coding' },
    chip: ['#0b0f0d', '#2f6f45', '#4ec97a'] },
  { value: 'sketch', label: '스케치', hint: '손글씨 · 두 겹으로 그은 삐뚤한 선',
    font: { display: 'Gaegu', body: 'Gaegu' },
    chip: ['#fffdf6', '#2b2b2b', '#2b2b2b'] },
  { value: 'blueprint', label: '청사진', hint: '모눈 위의 가는 흰 선 · 모서리 십자',
    font: { display: 'Noto Sans KR', body: 'Nanum Gothic Coding' },
    chip: ['#0e2a4a', '#7fb2e5', '#f2f8ff'] },
  { value: 'receipt', label: '영수증', hint: '종이 · 찢은 위아래 · 인쇄 영역 점선',
    font: { display: 'Nanum Gothic Coding', body: 'Nanum Gothic Coding' },
    chip: ['#ffffff', '#8a8175', '#3a352d'] },
  { value: 'postit', label: '심플 포스트잇', hint: '노란 종이 한 장 · 테두리 없이 그림자로만',
    font: { display: 'Noto Sans KR', body: 'Nanum Gothic' },
    chip: ['#ffe97f', '#e0d26a', '#3b3524'] },
]

/**
 * 포트폴리오 — 실제 디자이너 사이트에서 잰 값입니다.
 * 다섯 다 마크업은 같고 수치만 다릅니다. 그래서 고른 뒤에도 knob 이 그대로 반영됩니다.
 */
export const PORTFOLIO_TEMPLATES = [
  { value: 'behance', label: '베한스', hint: '비율을 맞춰 자른 3단, 좁은 간격',
    knobs: { cols: 3, ratio: '4 / 3', radius: 0, gapY: 12, gapX: 12, pad: 24, caption: 'under' },
    icon: [[0,0,7.3,5.5,1],[8.3,0,7.3,5.5,1],[16.6,0,7.3,5.5,1],[0,6.5,7.3,5.5,1],[8.3,6.5,7.3,5.5,1],[16.6,6.5,7.3,5.5,1],[0,13,7.3,5,1],[8.3,13,7.3,5,1],[16.6,13,7.3,5,1]] },
  { value: 'pinterest', label: '핀터레스트', hint: '자르지 않는 벽돌쌓기, 둥근 모서리',
    knobs: { cols: 4, ratio: 'auto', radius: 16, gapY: 16, gapX: 16, pad: 24, caption: 'none' },
    icon: [[0,0,5.4,7,1],[6.2,0,5.4,10,1],[12.4,0,5.4,5,1],[18.6,0,5.4,8.5,1],[0,8,5.4,10,1],[6.2,11,5.4,7,1],[12.4,6,5.4,12,1],[18.6,9.5,5.4,8.5,1]] },
  { value: 'instagram', label: '인스타그램', hint: '정사각 3단, 간격 없이 딱 붙여',
    knobs: { cols: 3, ratio: '1 / 1', radius: 0, gapY: 0, gapX: 0, pad: 0, caption: 'none' },
    icon: [[0,0,8,6,1],[8,0,8,6,1],[16,0,8,6,1],[0,6,8,6,1],[8,6,8,6,1],[16,6,8,6,1],[0,12,8,6,1],[8,12,8,6,1],[16,12,8,6,1]] },
  { value: 'dribbble', label: '드리블', hint: '둥근 카드, 제목은 카드 밖 아래',
    knobs: { cols: 4, ratio: '4 / 3', radius: 8, gapY: 16, gapX: 16, pad: 24, caption: 'out' },
    icon: [[0,0,11,6.5,1],[13,0,11,6.5,1],[0,7.5,7,1.2,0],[13,7.5,7,1.2,0],[0,10.5,11,6.5,1],[13,10.5,11,6.5,1]] },
  /* 다섯째만 자르지 않습니다 — 한 단으로 길게 이으면 그림의 제 비율이 그대로 삽니다.
     메인의 「수직 이미지」와 같은 결이되, 여기는 링크와 제목이 붙는 작업 카드입니다 */
  { value: 'vstack', label: '수직 이미지', hint: '한 단으로 길게, 자르지 않고 그대로',
    knobs: { cols: 1, ratio: 'auto', radius: 0, gapY: 40, gapX: 0, pad: 0, caption: 'under' },
    icon: [[0,0,24,5,1],[0,6.5,24,5,1],[0,13,24,5,1]] },
]


/** 목록에서 그림을 눌렀을 때 */
export const ZOOMS = [
  { value: 'popup', label: '팝업 열림', hint: '목록 위에 작업이 열립니다' },
  { value: 'page', label: '페이지 이동', hint: '작업 페이지로 넘어갑니다' },
]

/**
 * knob — 디자이너가 직접 만지는 수치. 전부 CSS 변수라 값만 갈아 끼우면 되고,
 * 그래서 관리자에서 만지는 즉시 미리보기에 반영됩니다(서버를 안 거칩니다).
 */
export const KNOBS = [
  { key: 'radius', label: '모서리', min: 0, max: 32, unit: 'px', hint: '0 이면 각지게' },
  { key: 'gapY', label: '위아래 간격', min: 0, max: 64, unit: 'px', hint: '0 이면 딱 붙어 한 장처럼' },
  { key: 'gapX', label: '좌우 간격', min: 0, max: 64, unit: 'px' },
  { key: 'pad', label: '목록 좌우 여백', min: 0, max: 120, unit: 'px', hint: '0 이면 화면 끝까지' },
  /* 상세페이지의 knob 둘 — 관리자에서는 「콘텐츠 스타일」이 아니라 「상세페이지」 아래에 섭니다 */
  { key: 'detailTop', label: '상단 여백', min: 0, max: 160, unit: 'px', hint: '공통헤더와 상세 콘텐츠 사이' },
  { key: 'detailGap', label: '콘텐츠 상하 간격', min: 0, max: 64, unit: 'px', hint: '0 이면 한 장처럼 이어집니다' },
  /* 1 단은 「수직 이미지」가 씁니다 — 예전 최소가 2 라 한 단짜리를 만들 수가 없었습니다 */
  { key: 'cols', label: '컬럼 수', min: 1, max: 6, unit: '열' },
  /* 여기 있던 `max`(목록 최대 폭)는 공통으로 갔습니다(`theme.width`·`theme.bodyWidth`).
     폭은 사이트에 하나뿐이라, 목록이 따로 정할 것이 없습니다 */
]

/* ── 색·글꼴 ──────────────────────────────────────────────────────────
   자유롭게 고르는 것은 세 색과 두 글꼴뿐입니다. 나머지(선·흐린 글자·바탕 둘째 색)는
   `color-mix` 로 여기서 유도합니다 — 열두 개를 다 고르게 하면 고르는 사람이 지치고,
   그중 하나만 어긋나도 화면이 탁해집니다. */
export const FONT_ROLES = [
  { key: 'display', label: '표제' },
  { key: 'body', label: '본문' },
]

/**
 * 여기 적는 글꼴 이름은 편집기가 아는 목록에 있어야 합니다(`vocab.js` 의 `FONTS`).
 *   없는 이름을 적으면 「모양」 화면이 저장할 때 `모르는 글꼴입니다` 로 거절합니다 —
 *   화면은 뜨는데 아무것도 저장이 안 되는, 찾기 나쁜 고장이 됩니다.
 *   이 레포가 제 글꼴을 더했다면 `site.fonts.mjs` 에도 같이 넣어야 서버가 압니다.
 */
export const THEME_PRESETS = [
  { value: 'ink', label: '화이트',
    theme: { paper: '#ffffff', ink: '#111111', accent: '#1400ff', display: 'Noto Serif KR', body: 'Noto Sans KR' } },
  { value: 'paper', label: '베이지',
    theme: { paper: '#f5f1e8', ink: '#1b1a17', accent: '#9c3d1f', display: 'Gowun Batang', body: 'Gowun Dodum' } },
  { value: 'night', label: '블랙',
    theme: { paper: '#101010', ink: '#f2f1ee', accent: '#ffd400', display: 'Black Han Sans', body: 'Noto Sans KR' } },
  { value: 'quiet', label: '그레이',
    theme: { paper: '#fbfbfa', ink: '#2b2b2b', accent: '#2b2b2b', display: 'Nanum Myeongjo', body: 'Nanum Gothic' } },
]
/**
 * 사이트의 본문 폭 — 넷(공통헤더 띠·메인 콘텐츠 영역·블로그 목록·포트폴리오 목록)이
 * 「본문 폭」을 고르면 전부 이 숫자를 따릅니다. 공개면에서는 `--body-w` 로 나갑니다.
 * 880 보다 좁으면 3·4단 격자가 무너지고, 1800 보다 넓히는 것은 「화면 폭」이 맡습니다.
 */
export const BODY_W = { min: 880, max: 1800, step: 20, d: 1240 }

/**
 * 헤더 높이(px). 여백만 늘어납니다 — 제목·메뉴 글자 크기는 안 따라갑니다.
 * 하한 48 은 햄버거 단추 34px(`templates/header.css` 의 `.s-burger`, 격자도 `minmax(34px, 1fr)`)
 * 에서 나온 값입니다. 더 낮추면 드로어 모드에서 단추가 띠 밖으로 넘칩니다.
 */
export const HEAD_H = { min: 48, max: 140, step: 2, d: 66 }

/**
 * 헤더 글자 크기 — 배수를 백분율로 셉니다. knob 값은 전부 정수라는 규약(`pickNum` 이
 * 반올림)을 지키려고 1.3 이 아니라 130 을 저장하고, 굽기가 100 으로 나눠 `--hd-size` 를 냅니다.
 * 한 숫자가 셋(사이트 이름·헤더 링크·드로어 링크)을 같이 움직입니다.
 */
export const HEAD_SCALE = { min: 80, max: 140, step: 5, d: 100 }

/**
 * 프리셋 위에 얹지 않습니다. `THEME_PRESETS[0].theme` 을 그대로 쓰면 다른 프리셋을
 * 고르는 순간 폭이 사라집니다 — 프리셋이 정하는 것은 색과 글꼴뿐입니다.
 */
export const DEFAULT_THEME = { ...THEME_PRESETS[0].theme, width: 'narrow', bodyWidth: BODY_W.d }

/* ── 대비 ─────────────────────────────────────────────────────────────
   색을 자유롭게 고르게 하면 읽을 수 없는 조합이 반드시 나옵니다.
   저장할 때 계산해서 거절합니다 — 화면을 보고 「좀 흐리네」로 넘어가는 사람이 많습니다. */
const hex = (c) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1]
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
export const isColor = (c) => !!hex(c)
export const normColor = (c) => {
  const v = hex(c)
  return v ? '#' + v.map((n) => n.toString(16).padStart(2, '0')).join('') : null
}
const lum = (rgb) => {
  const f = rgb.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]
}
/** 두 색의 대비비 (1~21). WCAG 의 그 값입니다 */
export const contrast = (a, b) => {
  const x = hex(a); const y = hex(b)
  if (!x || !y) return 0
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}
/* 본문은 4.5:1(AA), accent 는 큰 글자·링크에 쓰이므로 3:1 */
export const INK_MIN = 4.5

/** 그 바탕 위에서 잘 보이는 그림색 — 검정과 흰색 중 대비가 큰 쪽입니다 */
export const inkOn = (bg) => (contrast('#0b0d10', bg) >= contrast('#ffffff', bg) ? '#0b0d10' : '#ffffff')
export const ACCENT_MIN = 3

/**
 * 흐린 글자(`--fg-3`) — 번호·날짜·첫 문단·편수가 전부 이 색입니다.
 *
 * 섞는 비율을 고정하면 안 됩니다. 48% 는 네 프리셋 중 하나도 4.5:1 을 못 넘겼고 62% 에서도
 * 「그레이」가 4.14:1 이었습니다. 그래서 4.5:1 을 넘는 가장 옅은 색을 찾습니다 — ink 자체가
 * 기준을 넘으므로(관리자가 그것부터 막습니다) 반드시 답이 있습니다.
 *
 * `color-mix()` 로는 대비를 계산할 수 없어, 굽기와 관리자가 이 함수를 같이 불러야 합니다.
 */
/**
 * 공통헤더 글자의 실제 대비 — 헤더 색이 비어 있으면 본문 테마 색을 따릅니다.
 * theme 과 header 를 따로 검사하면 둘 다 통과하면서 합친 결과는 못 읽는 조합이 생깁니다
 * 되돌리기가 테마만 되돌리면 검은 헤더에 전경색 글자가 얹혀 대비가 1.21:1 까지 떨어집니다.
 */
export const headerContrast = (theme, header) =>
  contrast((header && header.color) || theme.ink, (header && header.bg) || theme.paper)

/**
 * 메뉴 글자의 실제 대비 — 색이 비면 헤더 색을, 그것도 비면 본문 테마 색을 따릅니다.
 * 헤더 대비와 같은 이유로 합친 결과를 잽니다. 지금 보이는 자리만 재는 까닭은, 화면에
 * 없는 사이드바 값 때문에 저장이 막히면 왜 막는지 알 길이 없어서입니다.
 */
export const menuOf = (header) => (header?.menu === 'sidebar' ? header?.drawer : header?.nav) || {}
export const buttonContrast = (theme, header) => {
  const b = menuOf(header)
  return contrast(b.color || (header && header.color) || theme.ink, b.bg || (header && header.bg) || theme.paper)
}

export const mutedOn = (ink, paper, min = INK_MIN) => {
  const a = hex(ink); const b = hex(paper)
  if (!a || !b) return normColor(ink) || '#666666'
  const at = (t) => '#' + a.map((v, i) => Math.round(v * t + b[i] * (1 - t)).toString(16).padStart(2, '0')).join('')
  /* 0.35 부터 훑습니다 — 그보다 옅으면 어떤 테마에서도 기준을 못 넘습니다 */
  for (let t = 0.35; t < 1; t += 0.01) {
    if (contrast(at(t), paper) >= min) return at(t)
  }
  return normColor(ink)
}

/**
 * 색·글꼴을 정규화합니다. `strict` 면 무엇이 왜 틀렸는지 함께 돌려줍니다.
 * 글꼴 목록(`fonts`)은 부르는 쪽이 줍니다 — 이 파일이 `site.fonts.mjs` 를 읽으면
 * 브라우저 번들에 글꼴 표가 통째로 딸려 들어갑니다.
 */
/** 객체가 아닌 것을 받으면 말합니다 — 조용히 기본값으로 바꾸면 고른 사람은 저장된 줄 압니다 */
const asObject = (v, problems, where) => {
  if (v === undefined || v === null) return {}
  if (typeof v !== 'object' || Array.isArray(v)) { problems.push(`${where}: 값의 모양이 다릅니다`); return {} }
  return v
}
/** 글자여야 하는 자리 */
const asText = (v, problems, where) => {
  if (v === undefined || v === null) return ''
  if (typeof v !== 'string') { problems.push(`${where}: 글자가 아닙니다`); return '' }
  return v
}

export const normalizeTheme = (v, fonts = []) => {
  const problems = []
  const src = asObject(v, problems, '색·글꼴')
  const out = { ...DEFAULT_THEME }
  for (const k of ['paper', 'ink', 'accent']) {
    if (src[k] === undefined) continue
    const c = normColor(src[k])
    if (c) out[k] = c
    else problems.push(`${k}: 색이 아닙니다 (${String(src[k]).slice(0, 20)})`)
  }
  /**
   * 본문 폭 — 사이트에 하나뿐인 숫자. 없으면 조용히 기본값입니다: 옛 판에는 이 키가 없어서,
   * 「빠졌습니다」로 문제를 세우면 되돌리기가 통째로 400 이 납니다.
   * 범위 밖의 값만 말합니다 — 12400 을 조용히 1800 으로 저장하면 고친 줄 알고 넘어갑니다.
   */
  /* 본문을 화면 끝까지 쓸까 — 사이트에 하나뿐인 스위치입니다. 자리마다 두었더니 같은 말이
     네 군데서 따로 따로 놀았습니다. 헤더만 예외로 제 것을 갖습니다 */
  out.width = pickOne(src.width, WIDTHS, out.width, problems, '본문 폭')
  if (src.bodyWidth !== undefined) {
    out.bodyWidth = pickNum(src.bodyWidth, BODY_W.min, BODY_W.max, out.bodyWidth, problems, '본문 폭')
  }
  const known = new Set(fonts)
  for (const { key } of FONT_ROLES) {
    if (src[key] === undefined) continue
    const f = String(src[key])
    if (!fonts.length || known.has(f)) out[key] = f
    else problems.push(`${key}: 모르는 글꼴입니다 (${f.slice(0, 30)})`)
  }
  const ci = contrast(out.ink, out.paper)
  if (ci < INK_MIN) problems.push(`글자와 바탕의 대비가 ${ci.toFixed(1)}:1 입니다 — ${INK_MIN}:1 이상이어야 읽힙니다`)
  /**
   * accent 가 바탕에 묻히면 거절하지 않고 ink 로 대신합니다. accent 는 프리셋이 정하고
   * 고르는 자리가 없어서, 흰 프리셋에서 배경만 어둡게 바꿔 1.5:1 이 됐을 때 거절하면
   * 반영도 미리보기도 400 이라 나갈 길이 없습니다. ink 는 위에서 4.5:1 을 확인했습니다.
   */
  if (contrast(out.accent, out.paper) < ACCENT_MIN) out.accent = out.ink
  return { value: out, problems }
}

/**
 * 메뉴 한 줄의 생김새 한 벌 — 고른 스타일 + 미세조정 넷.
 * 헤더와 사이드바가 같은 모양을 씁니다(목록만 다릅니다).
 */
const itemStyle = (src, list, where, problems) => {
  const v = asObject(src ?? {}, problems, where)
  /* 색이 아닌 값은 조용히 버립니다. 빈 값이 「상위 색을 따릅니다」는 뜻이라, 여기서 오류로
     세우면 저장된 설정 하나 때문에 되돌리기가 통째로 막힙니다 */
  const c = (raw) => pickColor(raw, [], '')
  return {
    style: pickOne(v.style, list, list[0].value, problems, where),
    radius: pickNum(v.radius, 0, 24, 0, problems, `${where} 모서리`),
    border: pickNum(v.border, 0, 3, 0, problems, `${where} 테두리`),
    color: c(v.color),
    bg: c(v.bg),
  }
}

/** 목록에서 고르는 값 하나 — 없는 값이면 말하고 기본으로 */
const pickOne = (v, list, dflt, problems, where) => {
  if (v === undefined) return dflt
  if (list.some((x) => x.value === v)) return v
  problems.push(`${where}: 고를 수 없는 값입니다 (${String(v).slice(0, 20)})`)
  return dflt
}

/**
 * knob 값 — 전부 숫자입니다. 범위를 자르지 않고 거절합니다: 60을 600으로 잘못 친 사람에게
 * 조용히 64를 저장해 주면, 왜 안 바뀌는지 모른 채 몇 번을 더 칩니다.
 */
const pickKnobs = (src, base, problems, where) => {
  const out = { ...base }
  for (const k of KNOBS) {
    if (src?.[k.key] === undefined) continue
    out[k.key] = pickNum(src[k.key], k.min, k.max, out[k.key], problems, `${where} ${k.label}`)
  }
  return out
}

/**
 * 화면별 글꼴 — 비워 두면 사이트 기본(theme.display·theme.body)을 따릅니다.
 * 목록에 없는 글꼴은 알리고 기본으로 되돌립니다 — 모르는 이름은 CSS 로 그대로 나가
 * 주입 통로가 됩니다.
 */
const pickFont = (v, fonts, problems, where) => {
  if (v === undefined || v === null || v === '') return ''
  const f = String(v)
  if (!fonts.length || fonts.includes(f)) return f
  problems.push(`${where}: 모르는 글꼴입니다 (${f.slice(0, 30)})`)
  return ''
}
const pickPageFont = (src, fonts, problems, where) => {
  const one = asObject(src, problems, `${where} 글꼴`)
  return {
    display: pickFont(one.display, fonts, problems, `${where} 표제`),
    body: pickFont(one.body, fonts, problems, `${where} 본문`),
  }
}
/** 화면에 그대로 찍히는 이름 — `<` `>` 를 받지 않습니다. 이스케이프로 무해하게 나가도
    굽기의 자체검사(unsafeBit)가 실체를 풀어 보고 멈추므로, 문 앞에서 말해 주는 편이 낫습니다 */
const plainText = (v, max, problems, where) => {
  /* 글자 단위로 자릅니다 — UTF-16 단위로 자르면 이모지 반쪽이 남아 JSON 저장이 500 으로 실패합니다 */
  const t = [...asText(v, problems, where)].slice(0, max).join('')
  if (/[<>]/.test(t)) { problems.push(`${where}: < > 는 쓸 수 없습니다`); return '' }
  return t
}

/** 참/거짓 하나 — 안 보내면 기본값, 참·거짓이 아니면 말합니다 */
const pickFlag = (v, dflt, problems, where) => {
  if (v === undefined) return dflt
  if (typeof v === 'boolean') return v
  problems.push(`${where}: 켬/끔이 참·거짓이 아닙니다`)
  return dflt
}

/** 직접 디자인이 싣는 파일 — 내 파일(`pages`) 또는 그 화면의 샘플. 목록 밖이면 말하고 내 파일로 */
const pickSource = (v, page, problems, where) =>
  pickOne(v, [{ value: PAGE_SOURCE_MINE }, ...PAGE_SAMPLES[page]], PAGE_SOURCE_MINE, problems, where)


/**
 * 정수 하나. 범위 밖이면 잘라내지 않고 problems 에 적습니다 — 잘라내면 입력한 값과
 * 저장된 값이 조용히 달라집니다.
 * 숫자로 읽히는 문자열도 받습니다. 저장된 설정의 "12" 를 거절하면 되돌리기가 막힙니다.
 */
const pickNum = (raw, min, max, dflt, problems, where) => {
  if (raw === undefined || raw === null || raw === '') return dflt
  const x = Math.round(Number(raw))
  if (!Number.isFinite(x) || x < min || x > max) {
    problems.push(`${where}: ${min}~${max} 사이여야 합니다 (${String(raw).slice(0, 12)})`)
    return dflt
  }
  return x
}

/** 템플릿의 시작 배치를 데이터 모양으로 폅니다 — 글자는 비워 둡니다(= 사이트 기본 글자) */
export const mainStart = (template) => {
  const t = MAIN_TEMPLATES.find((x) => x.value === template) || MAIN_TEMPLATES[0]
  const s = t.start
  /* 깊은 사본 — 부르는 쪽이 고쳐도 템플릿 정의가 안 상합니다 */
  return {
    stage: { height: s.height, slideH: s.slideH, bg: '', shotKnobs: { ...s.shotKnobs },
             shots: s.shots.map((x) => ({ ...x })), slides: s.slides.map((x) => ({ ...x })) },
    sections: s.sections.map((x) => ({ ...x })),
    items: s.items.map((x) => ({ ...x })),
  }
}

/**
 * 메인의 기본은 직접 디자인 + 공통헤더 없음입니다. 조각(`pages/main.html`)이 제 머리(`.m-id`)를
 * 안에 갖고 있어, 켬으로 두면 받은 사람의 첫 화면에 헤더가 두 개 쌓입니다.
 */
/**
 * 목록의 차례와 보이기. 배열 차례가 곧 화면 순서입니다.
 * 옛 모양(`{ works: true, about: true }`)으로 들어오면 펴 줍니다(맺음말은 버립니다).
 * 되돌리기가 옛 판을 다시 넣으므로 이 변환은 읽을 때마다 지나는 길입니다.
 */
const normSections = (src, base, problems) => {
  const known = SECTION_KINDS.map((s) => s.key)
  const rows = Array.isArray(src) ? src
    : src && typeof src === 'object' ? known.filter((k) => k in src).map((k) => ({ key: k, show: src[k] }))
    : []
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const one = asObject(row, problems, '목록')
    const key = typeof one.key === 'string' && known.includes(one.key) ? one.key : null
    if (!key || seen.has(key)) continue
    seen.add(key)
    /* 끌 수 없는 줄은 없습니다 — 다 끄면 흰 종이가 맞습니다 */
    out.push({ key, show: pickFlag(one.show, true, problems, labelOfSection(key)) })
  }
  /* 빠진 갈래는 시작 배치의 값으로 뒤에 붙입니다 — 갈래가 늘어도 옛 설정이 안 깨집니다 */
  for (const b of base) if (!seen.has(b.key)) out.push({ ...b })
  return out
}
const labelOfSection = (key) => SECTION_KINDS.find((s) => s.key === key)?.label || key

/** 옛 사전(`{brand:…, title:…}`)을 배열로 폅니다 — 시작 배치의 차례를 따릅니다 */
const spreadItems = (src, base) =>
  base.map((b) => ({ ...b, ...(src[b.id] && typeof src[b.id] === 'object' ? src[b.id] : {}) }))

/**
 * 사진 경로 — 올린 것(`/blog/…`)과 템플릿이 들고 온 견본(`/assets/sample/…`)만 받습니다.
 * 바깥 주소를 받으면 방문자 주소가 샙니다(`stage.bg` 와 같은 규약).
 */
const shotPath = (v) => {
  const t = typeof v === 'string' ? v : ''
  return t.startsWith('/blog/') || t.startsWith('/assets/sample/') ? t : ''
}

/**
 * 한 자리의 사진들. 차례가 곧 화면 순서입니다.
 * `w`·`h` 는 비율을 미리 알려 주려고 듭니다 — 굽기가 `width`/`height` 로 적어야 사진이
 * 뜰 때마다 아래 내용이 밀려 내려가지 않습니다.
 * 상한을 넘으면 조용히 자르지 않고 알립니다(무드보드의 `MOOD_MAX` 와 같은 규약).
 */
const normShots = (src, slot, base, problems) => {
  const max = SHOT_MAX[slot]
  if (src === undefined) return base.map((x) => ({ ...x }))
  const rows = Array.isArray(src) ? src : []
  const where = slot === 'slides' ? '슬라이드 사진' : '이미지 콘텐츠 영역 사진'
  if (rows.length > max) problems.push(`${where}: ${max}장까지입니다 (${rows.length}장)`)
  const out = []
  const seen = new Set()
  for (const row of rows) {
    const one = asObject(row, problems, where)
    const src1 = shotPath(one.src)
    if (!src1 || seen.has(src1)) continue
    seen.add(src1)
    const size = (v) => (Number.isInteger(v) && v > 0 && v < 100000 ? v : 0)
    out.push({ src: src1, thumb: shotPath(one.thumb), w: size(one.w), h: size(one.h) })
  }
  return out.slice(0, max)
}

/**
 * 글자 상자들. 차례가 있는 배열이고 개수가 정해져 있지 않습니다.
 * `id` 는 템플릿을 바꿀 때 짝짓는 이름입니다 — 겹치면 뒤엣것을 버립니다.
 */
const normItems = (src, base, fonts, problems, opts = {}) => {
  const rows = Array.isArray(src) ? src
    : src && typeof src === 'object' ? spreadItems(src, base)
    : base
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const one = asObject(row, problems, '요소')
    const id = typeof one.id === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(one.id) ? one.id : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    const b = base.find((x) => x.id === id) || { x: 40, y: 40, w: 400, show: true, size: 'body' }
    const where = `요소 ${id}`
    /**
     * 아이콘 상자 — 푸터에서만 받습니다(`opts.icons`). 글자 상자와 같은 배열에 살아서
     * 한 목록·한 차례·한 편집기·한 되돌리기로 끝나고, 다른 것은 글자 대신 서비스와 주소를
     * 든다는 점뿐입니다. 주소가 비면 굽기가 출력하지 않습니다(빈 `href` 는 재요청이 됩니다).
     */
    if (opts.icons && one.kind === 'icon') {
      const service = pickOne(one.service, SERVICE_ICONS, SERVICE_ICONS[0].value, problems, `${where} 서비스`)
      /* 로고는 정사각(한 변 24~96)이고, 「직접 입력」은 쓴 이름이 그림이라 가로로 깁니다 */
      const wMax = service === 'link' ? FOOT_ICON.textMax : FOOT_ICON.max
      /**
       * 기본값도 범위 안이어야 합니다. `pickNum` 은 값이 없으면 기본값을 검사 없이 돌려주는데,
       *   여기 오는 `b` 는 시작 배치에 없는 id 면 글자 상자용 통짜(폭 400)다 — 크기를 안 보낸
       *   아이콘이 400 으로 저장은 되고, 그 값을 되읽는 순간 「24~96」에 걸려 되돌리기가
       *   영영 400 이 됩니다.
       */
      const bw = Number.isFinite(b.w) && b.w >= FOOT_ICON.min && b.w <= wMax ? b.w : 52
      out.push({
        id,
        kind: 'icon',
        service,
        url: pickLink(one.url, problems, `${where} 주소`),
        /* 「직접 입력」만 글자를 듭니다 — 로고가 없으니 이름으로 무엇인지 말해야 합니다 */
        text: plainText(one.text, 20, problems, `${where} 이름`),
        x: pickNum(one.x, 0, STAGE_W, b.x, problems, `${where} X`),
        y: pickNum(one.y, 0, opts.maxY ?? STAGE_H.max, b.y, problems, `${where} Y`),
        w: pickNum(one.w, FOOT_ICON.min, wMax, bw, problems, `${where} 크기`),
        show: pickFlag(one.show, b.show ?? true, problems, `${where} 보이기`),
      })
      continue
    }
    out.push({
      id,
      text: plainText(one.text, ITEM_MAX, problems, `${where} 글자`),
      x: pickNum(one.x, 0, STAGE_W, b.x, problems, `${where} X`),
      y: pickNum(one.y, 0, opts.maxY ?? STAGE_H.max, b.y, problems, `${where} Y`),
      w: pickNum(one.w, 20, STAGE_W, b.w, problems, `${where} W`),
      show: pickFlag(one.show, b.show, problems, `${where} 보이기`),
      /* 폭을 끌어 정한 적이 없으면 글자를 감쌉니다 — `w` 는 그때 최대 폭이 됩니다 */
      auto: pickFlag(one.auto, b.auto !== false, problems, `${where} 글자 감싸기`),
      size: pickOne(one.size, ITEM_SIZES, b.size || 'body', problems, `${where} 크기`),
      font: pickFont(one.font, fonts, problems, `${where} 글꼴`),
      color: pickColor(one.color, problems, where),
      link: pickLink(one.link, problems, `${where} 연결`),
    })
  }
  return out.length ? out : base.map((x) => ({ ...x }))
}

/** 상자 색 — 비우면 칸이 정한 색을 따릅니다. `#rrggbb` 만 받습니다(글자가 CSS 로 새는 길을 막습니다) */
/**
 * 색 하나. 비어 있으면 기본값을 그대로 돌려줍니다 — 빈 값은 「상위 색을 따릅니다」는 뜻이라
 * 오류가 아닙니다. 색이 아닌 값만 problems 에 적습니다.
 */
const pickColor = (v, problems, where, dflt = '') => {
  if (v === undefined || v === null || v === '') return dflt
  if (typeof v !== 'string' || !isColor(v)) { problems.push(`${where}: 색이 아닙니다`); return dflt }
  return normColor(v)
}

/**
 * 옛 모양을 새 모양으로 폅니다 — 되돌리기가 옛 jsonb 를 다시 넣으므로 읽을 때마다 지납니다.
 *
 * 옛 모양은 사진 배열 하나(`stage.shots`) + `stage.shotStyle`, 새 모양은 자리 둘
 * (`stage.shots`·`stage.slides`)이고 목록이 곧 모양입니다.
 *   stack → 세로 자리에 두고 `shots` 를 켭니다
 *   slide → 배너 자리로 옮기고 `slides` 를 켠 뒤 `stage`(글자 판)를 끕니다. 옛 슬라이드에는
 *           글자 판이 없었으므로 끄지 않으면 없던 판이 생깁니다. 높이도 같이 옮깁니다
 */
/** 목록을 배열로 폅니다 — 옛 설정은 `{works:true, about:true}` 같은 맵이었습니다 */
const sectionRows = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object').map((x) => ({ ...x }))
  : v && typeof v === 'object' ? Object.keys(v).map((k) => ({ key: k, show: v[k] }))
  : null)

const migrateMain = (src) => {
  const st0 = src.stage
  /* 무대의 폭(`full|body` → `wide|narrow`)은 자리가 없어졌습니다 — 폭은 사이트에 하나뿐이라
     공통(`theme.width`)이 정합니다. 옛 값은 읽지 않으므로 조용히 버려집니다 */
  const st = src.stage
  const old = !!st && typeof st === 'object' && 'shotStyle' in st
  const was = old ? st.shotStyle : ''
  let stage = st
  if (old) {
    const shots = Array.isArray(st.shots) ? st.shots : []
    const { shotStyle, ...rest } = st
    /* `'none'` 이었어도 사진을 안 버립니다. 그때 뜻은 「지금은 안 보입니다」였지 「지웁니다」가
       아니었고, 버리면 되돌리기로도 못 돌아옵니다(옛 판을 다시 넣어도 읽을 때마다 또 지워집니다) */
    stage = was === 'slide'
      ? { ...rest, slideH: st.height, slides: shots, shots: [] }
      : { ...rest, shots, slides: [] }
  }

  /**
   * 목록의 차례를 옛 화면과 같게 맞춥니다. 옛 설정에는 `stage` 줄이 없어서, 그냥 두면
   * `normSections` 가 뒤에 붙여 첫 화면이 목록 아래로 내려갑니다 — 그래서 맨 앞에 끼웁니다.
   * 사진 자리도 base 기본값에 맡기지 않고 여기서 명시합니다(맡기면 데이터와 화면이 갈립니다).
   */
  let rows = sectionRows(src.sections)
  if (rows) {
    const at = (k) => rows.findIndex((x) => x.key === k)
    if (at('stage') < 0) rows.unshift({ key: 'stage', show: true })
    if (old) {
      rows = rows.filter((x) => x.key !== 'shots' && x.key !== 'slides')
      if (was === 'slide') {
        /* 옛 슬라이드에는 글자 판이 아예 없었습니다 — 끄지 않으면 없던 판이 생깁니다 */
        rows = rows.map((x) => (x.key === 'stage' ? { ...x, show: false } : x))
        rows.unshift({ key: 'slides', show: true })
        rows.push({ key: 'shots', show: false })
      } else {
        rows.splice(rows.findIndex((x) => x.key === 'stage') + 1, 0,
          { key: 'shots', show: was === 'stack' })
        rows.push({ key: 'slides', show: false })
      }
    }
  }
  return { ...src, stage, sections: rows || src.sections }
}

/** knob 넷 — 범위를 벗어나면 시작 배치의 값으로 떨어집니다(포트폴리오 knob 과 같은 규약) */
const normShotKnobs = (src, base, problems) => {
  const one = src && typeof src === 'object' ? src : {}
  return Object.fromEntries(SHOT_KNOBS.map((k) =>
    [k.key, pickNum(one[k.key], k.min, k.max, base[k.key] ?? k.d, problems, `이미지 콘텐츠 영역 ${k.label}`)]))
}

export const normalizeMain = (v, fonts = []) => {
  const problems = []
  const src = migrateMain(asObject(v, problems, '메인'))
  const mode = pickOne(src.mode, PAGE_MODES, PAGE_MODES[0].value, problems, '메인')
  const chrome = pickFlag(src.chrome, false, problems, '메인 공통헤더')
  /* `migrateMain` 은 제가 모르는 키를 그대로 넘기므로 `source` 도 이사 뒤에 온전히 남습니다 */
  const source = pickSource(src.source, 'main', problems, '메인 사용할 파일')
  const template = pickOne(src.template, MAIN_TEMPLATES, MAIN_TEMPLATES[0].value, problems, '메인')
  const font = pickPageFont(src.font, fonts, problems, '메인')
  /* 저장한 적이 없으면 고른 템플릿의 시작 배치 — 옛 설정(`{template}` 만 있는 것)도 그 모습으로 나갑니다 */
  const base = mainStart(template)
  const stageSrc = asObject(src.stage, problems, '메인 무대')
  const stage = {
    height: pickNum(stageSrc.height, STAGE_H.min, STAGE_H.max, base.stage.height, problems, '콘텐츠 영역 높이'),
    /* 배너는 제 높이를 따로 갖습니다 — 하나를 둘이 나눠 쓰면 한쪽을 만질 때 다른 쪽이 따라 움직입니다 */
    slideH: pickNum(stageSrc.slideH, STAGE_H.min, STAGE_H.max, base.stage.slideH, problems, '슬라이드 높이'),
    /* 배경 그림 — 올린 사진의 경로만 받습니다. 바깥 주소를 받으면 방문자 주소가 샙니다 */
    bg: shotPath(stageSrc.bg),
    shots: normShots(stageSrc.shots, 'shots', base.stage.shots, problems),
    slides: normShots(stageSrc.slides, 'slides', base.stage.slides, problems),
    shotKnobs: normShotKnobs(stageSrc.shotKnobs, base.stage.shotKnobs, problems),
  }
  const sections = normSections(src.sections, base.sections, problems)
  /* 글자 상자는 늘 남깁니다. 콘텐츠 영역을 껐다고 지우면 다시 켤 때 빈 판이 뜹니다 */
  const items = normItems(src.items, base.items, fonts, problems)
  return { value: { mode, chrome, source, template, stage, sections, items, font }, problems: [...problems] }
}

/** 블로그에는 `mode` 가 없습니다 — 글이 DB 에서 오므로 목록을 코드가 꽂아야 합니다 */
export const normalizeBlog = (v, fonts = []) => {
  const problems = []
  const src = asObject(v, problems, '블로그')
  return {
    value: {
      chrome: pickFlag(src.chrome, true, problems, '블로그 공통헤더'),
      template: pickOne(src.template, BLOG_TEMPLATES, BLOG_TEMPLATES[0].value, problems, '블로그'),
      /* 목록 폭 — 포트폴리오·메인과 같은 말을 씁니다(`WIDTHS`).
         기본은 좁게: 지금까지 블로그 목록은 늘 본문 폭이었고, 기본을 바꾸면 쓰던 사람의 화면이 흔들립니다 */
      font: pickPageFont(src.font, fonts, problems, '블로그'),
      head: pickHead(src.head, '글', problems, '블로그 타이틀'),
      /**
       * 글 상세의 「절 바로 가기」 — 본문 오른쪽에 제목 목록을 띄웁니다.
       *
       * `head` 안에 못 넣습니다. `pickHead` 는 **포트폴리오와 함께 쓰는 부품**이라
       * 여기 한 칸을 보태면 작업 목록에도 같은 칸이 생깁니다. `knobs` 도 안 됩니다 —
       * `pickKnobs` 가 포트폴리오 전용 `KNOBS` 에 묶여 있습니다. 그래서 제 칸입니다.
       *
       * 기본은 **끕니다.** 켜 두면 쓰던 사람의 글이 한꺼번에 바뀝니다.
       *
       * 깊이는 설정으로 두지 않습니다 — h2·h3 를 늘 함께 내고 h3 를 한 칸 들입니다.
       * 손잡이를 하나 더 두는 값보다, 고를 것이 없는 편이 낫습니다.
       */
      toc: { show: pickFlag(src.toc?.show, false, problems, '블로그 절 바로 가기') },
      /**
       * 「카드」 갈래의 테마와 손잡이. 다른 갈래를 고르면 읽히지 않고 잠자코 남습니다 —
       * 갈래를 왔다 갔다 해도 고른 값이 안 날아갑니다.
       *
       * **넷 다 기본이 「안 정함」입니다.** 까닭 둘:
       *   ① 쓰던 사람의 목록이 안 바뀝니다(`toc` 와 같은 규칙).
       *   ② 빈 값은 `emitOmit` 이 안 내므로 골든 쉰네 벌이 하나도 안 흔들립니다.
       * 실제 값은 CSS 의 폴백(스킨이 정한 기본)이 맡습니다 — 여기서 채우면 그 폴백이 죽습니다.
       *
       * 색은 `#rrggbb` 만 받습니다(`pickColor`). `color-mix(...)` 같은 CSS 함수 문자열을
       * 허용하면 설정값이 그대로 스타일시트로 새는 길이 열립니다.
       */
      outline: {
        skin: pickOne(src.outline?.skin, OUTLINE_SKINS, OUTLINE_SKINS[0].value, problems, '카드 테마'),
        ink: pickColor(src.outline?.ink, problems, '카드 선 색'),
        bg: pickColor(src.outline?.bg, problems, '카드 배경색'),
        radius: pickNum(src.outline?.radius, 0, 32, '', problems, '카드 모서리'),
      },
    },
    problems,
  }
}

/**
 * 포트폴리오의 기본은 직접 디자인 + 공통헤더 없음입니다. 조각(`pages/portfolio.html`)이 제
 * 헤더를 갖습니다 — 가운데의 「절 바로 가기」는 이 화면에만 있는 링크라 공통헤더에 자리가
 * 없습니다. 켜면 헤더가 둘이 되는데, 굽기는 막지 않고 경고만 합니다(`bakePages` 의 `warn`).
 */
export const normalizePortfolio = (v, fonts = []) => {
  const problems = []
  const src = asObject(v, problems, '포트폴리오')
  const mode = pickOne(src.mode, PAGE_MODES, PAGE_MODES[0].value, problems, '포트폴리오')
  const chrome = pickFlag(src.chrome, false, problems, '포트폴리오 공통헤더')
  const source = pickSource(src.source, 'portfolio', problems, '포트폴리오 사용할 파일')
  const template = pickOne(src.template, PORTFOLIO_TEMPLATES, PORTFOLIO_TEMPLATES[0].value, problems, '포트폴리오')
  /* knob 의 출발점은 고른 템플릿의 값입니다 — 베한스를 고르면 베한스의 간격에서 시작합니다 */
  /* detailTop 48 — 예전 박혀 있던 clamp(2rem, 6vh, 4rem) 의 보통 화면 값에 맞춥니다 */
  const base = { ...PORTFOLIO_TEMPLATES.find((t) => t.value === template).knobs, detailGap: 0, detailTop: 48 }
  const knobs = pickKnobs(src.knobs, base, problems, '포트폴리오')
  const zoom = pickOne(src.zoom, ZOOMS, ZOOMS[0].value, problems, '확대')
  /* 타이틀 이미지 — 글의 배너와 같은 규약(첨부 경로 한 줄) */
  const title = typeof src.title === 'string' && src.title.startsWith('/blog/') ? src.title : null
  /**
   * 목록 머리 — 숨기면 맨 위부터 그림이 찹니다(벽처럼 쓰고 싶을 때).
   * 예전의 `heading: true|false` 를 여기로 접었습니다. 블로그와 같은 부품이 됐으므로
   * 같은 모양이어야 합니다 — 옛 값은 아래에서 읽어 줍니다.
   */
  const head = pickHead(
    src.head ?? (src.heading === false ? { show: false } : undefined), '작업', problems, '포트폴리오 타이틀')
  const font = pickPageFont(src.font, fonts, problems, '포트폴리오')
  return { value: { mode, chrome, source, template, knobs, zoom, title, font, head }, problems: [...problems] }
}

/**
 * 헤더 — 이 값은 모양만 정하고, 어느 화면이 이 헤더를 이는지는 화면마다의 `chrome` 이
 * 정합니다(메인은 기본 꺼짐).
 * 색은 `normColor` 를 지나 `#rrggbb` 로만 저장합니다 — 안 그러면 `red` 나 `var(--x)` 가
 * 그대로 CSS 변수로 나가 헤더가 어그러집니다.
 */
/** 고를 수 있는 아이콘 — 맨 앞의 빈 값이 「없음」입니다(`pickSource` 가 쓰는 것과 같은 수법) */
const ICON_PICKS = [{ value: '' }, ...MENU_ICONS]

export const normalizeHeader = (v, fonts = []) => {
  const problems = []
  const src = asObject(v, problems, '공통헤더')
  /**
   * 색 — 비워 두면 본문 테마를 따릅니다.
   *
   * 기본을 흰색·검정으로 박아 두었더니 「블랙」 프리셋을 고르면 검은 화면 위에 흰 띠가
   * 남았습니다. 흰 사이트에서는 따라가도 흰색이라 기본 모습은 그대로입니다.
   */
  const color = (key, dflt, where, from = src) => pickColor(from[key], problems, where, dflt)
  const num = (raw, min, max, dflt, where) => pickNum(raw, min, max, dflt, problems, where)
  /* 제목 — 비우면 blog.config 의 이름을 씁니다. 그래서 「없음」과 「빈 값」이 같은 뜻입니다 */
  const title = plainText(src.title, 40, problems, '공통헤더 제목')
  const btn = asObject(src.btn, problems, '메뉴버튼 UI스타일')
  const linksSrc = asObject(src.links, problems, '공통헤더 링크')
  const ones = NAV_LINKS.map((l) => ({ l, one: asObject(linksSrc[l.key], problems, `${l.label} 링크`) }))
  /**
   * 차례 — 반드시 온전한 차례로 폅니다. 값이 겹치거나(3·3) 비어 있어도 화면이 안 흔들립니다.
   * 거절하지 않는 까닭은 이 수가 사람이 치는 값이 아니라 관리자의 ↑↓ 가 만든 값이기 때문입니다.
   * 옛 설정에는 이 값이 아예 없어, 되돌리기가 400 으로 막히면 나갈 길이 없습니다.
   */
  const seq = ones
    .map(({ l, one }, i) => ({ key: l.key, at: Number.isFinite(one.order) ? one.order : i, i }))
    .sort((p, q) => p.at - q.at || p.i - q.i)
  const orderOf = Object.fromEntries(seq.map((x, i) => [x.key, i]))
  const links = {}
  for (const { l, one } of ones) {
    links[l.key] = {
      show: pickFlag(one.show, true, problems, `${l.label} 링크`),
      label: (plainText(one.label, 20, problems, `${l.label} 이름`) || l.label),
      /* 아이콘 — 빈 값이 「없음」입니다. 드로어의 「아이콘」 벌일 때만 화면에 나갑니다 */
      icon: pickOne(one.icon, ICON_PICKS, '', problems, `${l.label} 아이콘`),
      /* 차례 — 0 부터. 위에서 온전하게 편 값이라 여기서 다시 검사할 것이 없습니다 */
      order: orderOf[l.key],
    }
  }
  return {
    value: {
      title,
      align: pickOne(src.align, ALIGNS, ALIGNS[0].value, problems, '제목 정렬'),
      width: pickOne(src.width, HEAD_WIDTHS, HEAD_WIDTHS[0].value, problems, '헤더 넓이'),
      height: num(src.height, HEAD_H.min, HEAD_H.max, HEAD_H.d, '헤더 높이'),
      size: num(src.size, HEAD_SCALE.min, HEAD_SCALE.max, HEAD_SCALE.d, '헤더 글자 크기'),
      bg: color('bg', '', '헤더배경'),
      color: color('color', '', '헤더폰트색'),
      /* 글꼴 — 비우면 지금 서체(사이트 본문 글꼴). 화면별 글꼴을 따라가면 공통헤더가 화면마다 달라집니다 */
      font: pickFont(src.font, fonts, problems, '헤더글꼴'),
      menu: pickOne(src.menu, MENU_PLACES, MENU_PLACES[0].value, problems, '메뉴 위치'),
      sidebar: (() => {
        /* 옛 설정은 문자열 하나였습니다 — 넓이·색이 없었으므로 그때 벌이 쓰던 값을 살려 줍니다 */
        const raw = src.sidebar
        const old = typeof raw === 'string' ? (OLD_SIDEBAR[raw] || {}) : null
        const v = old || asObject(raw, problems, '사이드바')
        const n = (x, d) => pickNum(x, DRAWER_W.min, DRAWER_W.max, d, problems, '사이드바 넓이')
        return {
          kind: pickOne(v.kind, SIDEBARS, SIDEBARS[0].value, problems, '사이드바'),
          width: n(v.width, DRAWER_W.d),
          /* 비우면 헤더 색을 따릅니다 — 헤더가 비면 본문 테마 */
          /* 위와 같은 이유로 조용히 버립니다 */
          bg: pickColor(v.bg, [], ''),
          color: pickColor(v.color, [], ''),
        }
      })(),
      /**
       * 메뉴 한 줄의 생김새 — 자리마다 따로입니다.
       * 옛 설정은 둘을 겸한 `btn` 하나여서, 읽을 때마다 양쪽으로 펴 줍니다(`migrateMain` 과
       * 같은 까닭). 옛 값을 양쪽에 같이 넣어야 보던 모습이 안 바뀝니다.
       */
      nav: itemStyle(src.nav ?? btn, NAV_STYLES, '메뉴 스타일', problems),
      drawer: itemStyle(src.drawer ?? btn, DRAWER_STYLES, '사이드바 메뉴 스타일', problems),
      links,
    },
    problems: [
      ...problems,
      /* 둘 다 정했을 때만 잽니다 — 하나라도 비면 테마 색이라 테마 검사가 이미 지켰습니다.
         `color()` 를 다시 부르면 잘못된 색의 문제가 두 번 쌓이므로 목록에 안 넣는 쪽으로 잽니다 */
      ...(() => {
        const quiet = []
        /* 여기서는 problems 에 적지 않습니다. 대비 계산에만 쓰는 값이라, 색이 아니면
           그냥 비운 것으로 봅니다. 값 자체의 검증은 아래 color() 가 합니다 */
        const pick = (key, from) => pickColor(from[key], [], `${key}`)
        const bg = pick('bg', src)
        const fg = pick('color', src)
        const c = bg && fg ? contrast(fg, bg) : 99
        if (c < INK_MIN) quiet.push(`공통헤더 글자와 배경의 대비가 ${c.toFixed(1)}:1 입니다 — ${INK_MIN}:1 이상이어야 읽힙니다`)
        /* 메뉴 — 색이 비면 헤더 색을 따르므로 그 둘을 합쳐 잽니다. 테마까지 가야 하는 경우는 API 가 합쳐 잽니다.
           지금 보이는 자리만 봅니다(헤더면 nav, 사이드바면 drawer) — 화면에 없는 값이
           저장을 막으면 왜 막혔는지 알 길이 없습니다 */
        const shown = pickOne(src.menu, MENU_PLACES, MENU_PLACES[0].value, [], '') === 'sidebar'
          ? (src.drawer ?? btn) : (src.nav ?? btn)
        const m = asObject(shown, [], '메뉴')
        const bbg = pick('bg', m) || bg
        const bfg = pick('color', m) || fg
        const b = (pick('bg', m) || pick('color', m)) && bbg && bfg ? contrast(bfg, bbg) : 99
        if (b < INK_MIN) quiet.push(`메뉴 글자와 배경의 대비가 ${b.toFixed(1)}:1 입니다 — ${INK_MIN}:1 이상이어야 읽힙니다`)
        return quiet
      })(),
    ],
  }
}

/**
 * 한 화면의 목록 머리 — 보이기·이름·크기·정렬·편수.
 *
 * 모양(크기·정렬·편수)은 화면마다 정합니다. 블로그와 포트폴리오가 같은 부품을 쓰는 것은
 * 그대로입니다 — 마크업과 옷이 하나라 한쪽을 고쳐도 다른 쪽이 안 깨집니다. 달라지는 것은 값뿐입니다.
 */
const pickHead = (src, dfltName, problems, where) => {
  const one = asObject(src, problems, where)
  return {
    show: pickFlag(one.show, true, problems, where),
    name: (plainText(one.name, 20, problems, `${where} 이름`) || dfltName),
    size: pickOne(one.size, HEAD_SIZES, HEAD_SIZES[1].value, problems, `${where} 사이즈`),
    align: pickOne(one.align, ALIGNS.slice(0, 2), ALIGNS[0].value, problems, `${where} 정렬`),
    count: pickFlag(one.count, true, problems, '콘텐츠 갯수 표시'),
    /* 타이틀을 숨겼을 때 공통헤더와 콘텐츠 사이. 기본 0 — 「맨 위부터 그림이 찹니다」가 숨긴 뜻이었습니다.
       그런데 딱 붙는 것만 고를 수 있어서 띄울 길이 없었습니다 */
    gap: pickNum(one.gap, 0, 160, 0, problems, `${where} 상단 여백`),
  }
}


/* ── 푸터(푸터) ────────────────────────────────────────────────────────
   푸터는 두 벌입니다. 메인은 연락이 목적지라 크고, 그 밖(포트폴리오·블로그)은
   다 보고 난 자리라 얇습니다. 둘이 한 키(`footer`)에 같이 살아 한 번에 반영·되돌리기 됩니다.

   판은 첫 화면의 콘텐츠 영역과 같은 부품을 씁니다(`.m-board`·`.m-i`, 1240 좌표계) —
   끌기·안내선·글자 고치기가 그대로 따라옵니다. 상자도 같은 모양이고, 푸터에만 아이콘 행이 있습니다. */
export const FOOT_H = { min: 40, max: 800 }
/** 아이콘 상자의 크기 — 로고는 정사각이라 한 변, 「직접 입력」은 이름이 들어가 더 길 수 있습니다 */
export const FOOT_ICON = { min: 24, max: 96, textMax: 600 }

/** 푸터 knob — 수치는 전부 CSS 변수로 나가므로 고치는 즉시 미리보기에 반영됩니다 */
export const FOOT_KNOBS = [
  { key: 'height', label: '푸터 높이', unit: 'px', min: FOOT_H.min, max: FOOT_H.max, step: 4 },
  { key: 'gap', label: '본문과 푸터 사이', unit: 'px', min: 0, max: 160, step: 4 },
  { key: 'lineW', label: '윗선 두께', unit: 'px', min: 0, max: 4, step: 1 },
]

/** 어느 푸터를 고치는가 — 관리자 「공통 → 푸터」의 첫 피커 */
export const FOOT_KINDS = [
  { value: 'main', label: '메인 푸터',
    hint: '보통 연락처, 개인정보 등의 기록 목적으로 사용합니다.', path: '/' },
  { value: 'pages', label: '포트폴리오·블로그 푸터',
    hint: '페이지의 맨 마지막을 표현하는데 목적이 있습니다.', path: '/blog/' },
]

/** 푸터가 고를 수 있는 글자 칸 — 「아주 크게」는 푸터에 들어갈 자리가 없습니다 */
export const FOOT_SIZES = ITEM_SIZES.filter((z) => z.value !== 'xl')

/**
 * 푸터의 시작 배치 — 지금 화면을 판 좌표로 옮긴 것입니다.
 *
 * 글자는 비워 둡니다: 굽기의 표(`FOOT_TEXT`)가 `site.config.mjs` 의 이메일·저작권으로 채웁니다.
 * 그래서 설정을 한 번도 안 건드린 사이트의 푸터가 지금과 같은 말을 합니다.
 */
export const footStart = (kind) => (kind === 'pages'
  ? { height: 52, gap: 0, line: { width: 1, color: '' }, bg: '', color: '',
      items: [
        { id: 'copy', x: 40, y: 16, w: 700, show: true, auto: true, size: 'label' },
        { id: 'github', kind: 'icon', service: 'github', url: '', x: 1168, y: 10, w: 32, show: true },
      ] }
  : { height: 288, gap: 0, line: { width: 1, color: '' }, bg: '', color: '',
      items: [
        { id: 'mail', x: 40, y: 72, w: 1160, show: true, auto: true, size: 'display', link: 'mail' },
        { id: 'copy', x: 40, y: 195, w: 700, show: true, auto: true, size: 'label' },
        { id: 'github', kind: 'icon', service: 'github', url: '', x: 1148, y: 180, w: 52, show: true },
      ] })

/**
 * 푸터 한 벌. 없는 키에는 아무 말도 하지 않고 조용히 시작 배치로 메웁니다.
 * 되돌리기가 옛 판의 jsonb 를 다시 정규화하는데 거기엔 이 키가 없어서, problems 를 하나라도
 * 내면 `/settings/undo` 가 400 으로 죽습니다.
 */
const normalizeFootSet = (v, kind, fonts, problems) => {
  const base = footStart(kind)
  const src = asObject(v, problems, `${kind === 'pages' ? '포트폴리오·블로그' : '메인'} 푸터`)
  const where = kind === 'pages' ? '포트폴리오·블로그 푸터' : '메인 푸터'
  const color = (raw, what) => pickColor(raw, problems, `${where} ${what}`)
  const line = asObject(src.line, problems, `${where} 윗선`)
  return {
    height: pickNum(src.height, FOOT_H.min, FOOT_H.max, base.height, problems, `${where} 높이`),
    gap: pickNum(src.gap, 0, 160, base.gap, problems, `${where} 본문과의 사이`),
    line: {
      width: pickNum(line.width, 0, 4, base.line.width, problems, `${where} 윗선 두께`),
      color: color(line.color, '윗선 색'),
    },
    bg: color(src.bg, '배경색'),
    color: color(src.color, '글자색'),
    /* 상자는 무대와 같은 모양입니다 — 푸터에서만 아이콘 행을 받습니다(`icons`).
       판 밖으로 못 나가게 세로 상한도 푸터 높이 상한으로 좁힙니다 */
    items: normItems(src.items, base.items, fonts, problems, { icons: true, maxY: FOOT_H.max }),
  }
}

export const normalizeFooter = (v, fonts = []) => {
  const problems = []
  const src = asObject(v, problems, '푸터')
  return {
    value: {
      main: normalizeFootSet(src.main, 'main', fonts, problems),
      pages: normalizeFootSet(src.pages, 'pages', fonts, problems),
    },
    problems,
  }
}

/**
 * 푸터 글자와 배경의 대비 — 헤더(`headerContrast`)와 같은 급입니다.
 * 색을 안 정했으면 본문 테마를 따르므로 그쪽 대비가 이미 지켜져 있습니다.
 */
export const footerContrast = (theme, set) =>
  contrast(set?.color || theme.ink, set?.bg || theme.paper)

/**
 * 기본으로 주는 파비콘. 값은 `public/assets/favicons/{value}.svg` 의 파일 이름입니다.
 *
 * 설정에는 **이름만** 남깁니다 — 화면 조각(`PAGE_SAMPLES`)과 같은 규약입니다. 파일을 설정에
 * 담으면 되돌리기가 파일까지 되돌려야 하고, 운영 체크아웃을 굽기가 건드리게 됩니다.
 *
 * `icon` 이 있으면 `tools/sync-favicons.mjs` 가 그 메뉴 아이콘(Lucide)으로 그려 냅니다.
 * 없는 둘은 손으로 그린 것이라 그 도구가 건드리지 않습니다.
 */
export const FAVICONS = [
  { value: 'sprout', label: '새싹' },
  { value: 'stork', label: '황새' },
  { value: 'star', label: '별', icon: 'star' },
  { value: 'heart', label: '하트', icon: 'like' },
  { value: 'bookmark', label: '북마크', icon: 'bookmark' },
  { value: 'flame', label: '불꽃', icon: 'hot' },
  { value: 'coffee', label: '커피', icon: 'daily' },
  { value: 'layers', label: '겹', icon: 'layer' },
  { value: 'type', label: '글자', icon: 'type' },
  { value: 'globe', label: '지구', icon: 'world' },

  /* 직업이 바로 읽히는 것들. 후보 서른아홉을 16px 로 띄워 놓고 골랐습니다 — 파비콘은 그
     크기가 전부인데, 하필 뜻이 가장 분명한 brain-circuit(AI)·handshake(영업)가 거기서
     덩어리가 됩니다. 그래서 또렷한 쪽을 택했습니다(bot·briefcase).
     `lucide` 는 메뉴 아이콘에 없어 lucide 에서 직접 꺼낸다는 뜻입니다 */
  { value: 'palette', label: '디자인', lucide: 'palette' },
  { value: 'terminal', label: '개발', lucide: 'terminal' },
  { value: 'kanban', label: '기획', lucide: 'square-kanban' },
  { value: 'bot', label: 'AI', lucide: 'bot' },
  { value: 'server', label: '서버', lucide: 'server' },
  { value: 'megaphone', label: '마케팅', lucide: 'megaphone' },
  { value: 'briefcase', label: '영업', lucide: 'briefcase' },
  { value: 'chart', label: '분석', lucide: 'chart-line' },
  { value: 'camera', label: '사진', lucide: 'camera' },
  { value: 'library', label: '책', lucide: 'library' },
]
const FAVICON_VALUES = new Set(FAVICONS.map((f) => f.value))

/** 기본으로 주는 파비콘의 주소 모양. 색을 입힐 수 있는 것은 이 꼴뿐입니다 */
export const BUILTIN_FAVICON = /^\/assets\/favicons\/([a-z]+)\.svg$/

/**
 * 파비콘 주소 — 셋만 받습니다.
 *
 *   빈 값                     레포의 `public/favicon.svg` (받은 사람이 그 파일을 갈아 끼우는 길)
 *   /assets/favicons/x.svg    기본으로 주는 것
 *   /blog/0/{32자}.svg|png    올린 것 (`0` 은 어느 글에도 안 속하는 사이트 전용 자리)
 *
 * 바깥 주소를 받으면 방문자가 그 서버에 찍힙니다 — 파비콘은 모든 화면에 붙어서 특히 셉니다.
 * `shotPath` 와 같은 규약이되, 자리와 확장자를 더 좁게 봅니다.
 */
const faviconPath = (v) => {
  const t = typeof v === 'string' ? v : ''
  if (!t) return ''
  const built = t.match(/^\/assets\/favicons\/([a-z]+)\.svg$/)
  if (built) return FAVICON_VALUES.has(built[1]) ? t : ''
  return /^\/blog\/0\/[0-9a-f]{32}\.(?:svg|png|webp)$/.test(t) ? t : ''
}

/**
 * 사이트 전체에 걸리는 것 — 브라우저 탭에 뜨는 이름과 아이콘.
 *
 * 비우면 `site.config.mjs` 의 값으로 떨어집니다. 그래서 「없음」과 「빈 값」이 같은 뜻입니다
 * (공통헤더 제목과 같은 규약).
 */
const normalizeSite = (src) => {
  const problems = []
  const s = asObject(src, problems, '설정')
  return {
    value: {
      title: plainText(s.title, 40, problems, '사이트 명'),
      favicon: faviconPath(s.favicon),
      /* 기본으로 주는 파비콘에만 먹습니다 — 올린 파일은 그 사람이 그린 색이 이미 들어 있습니다.
         비우면 밝은 탭에서 검정, 어두운 탭에서 흰색으로 저절로 뒤집힙니다(파일 안의 media 규칙) */
      faviconColor: pickColor(s.faviconColor, problems, '파비콘 색'),
      /**
       * 그림 뒤에 까는 바탕. 비우면 투명입니다.
       *
       * 투명한 그림은 탭 테마에 기댑니다 — 밝은 탭에서 검정, 어두운 탭에서 흰색으로 뒤집혀야
       * 보입니다. 바탕을 깔면 그 의존이 사라져 어느 탭에서든 같은 모양으로 섭니다.
       * 남의 사이트 파비콘이 대개 바탕을 갖고 있는 까닭입니다.
       */
      faviconBg: pickColor(s.faviconBg, problems, '파비콘 배경'),
    },
    problems,
  }
}

/** 키 하나를 정규화합니다 — API·굽기가 같은 입구를 씁니다 */
export const normalize = (key, value, fonts) => {
  if (key === 'theme') return normalizeTheme(value, fonts)
  if (key === 'site') return normalizeSite(value)
  if (key === 'main') return normalizeMain(value, fonts)
  if (key === 'blog') return normalizeBlog(value, fonts)
  if (key === 'portfolio') return normalizePortfolio(value, fonts)
  if (key === 'header') return normalizeHeader(value, fonts)
  if (key === 'footer') return normalizeFooter(value, fonts)
  return { value: null, problems: [`모르는 설정입니다 (${String(key).slice(0, 20)})`] }
}

/* 관리자의 탭과 맞습니다. `theme`·`header` 둘이 「공통」 탭에 삽니다 — 세 화면에 전부 걸리는 것.
   글꼴과 목록 머리는 화면마다 다르게 쓰려고 각 화면의 키로 옮겼습니다 */
export const KEYS = ['theme', 'header', 'footer', 'site', 'main', 'blog', 'portfolio']

/** 설정이 하나도 없을 때의 모양 — 지금 화면 그대로입니다 */
export const DEFAULTS = {
  theme: DEFAULT_THEME,
  site: normalizeSite({}).value,
  header: normalizeHeader({}).value,
  footer: normalizeFooter({}).value,
  main: normalizeMain({}).value,
  blog: normalizeBlog({}).value,
  portfolio: normalizePortfolio({}).value,
}

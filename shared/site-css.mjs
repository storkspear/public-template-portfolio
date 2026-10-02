/**
 * 사이트 CSS 변수를 만드는 곳. 생성기(server/bake.mjs)와 관리자 미리보기(admin/src/look.jsx)가
 * 이 모듈 하나를 같이 씁니다.
 *
 * 예전에는 두 곳이 같은 변수 이름을 각자 문자열로 만들었습니다. 이름이나 계산이 한쪽만
 * 바뀌면 미리보기와 실제 화면이 갈리는데, 그것을 막아 주는 것이 아무것도 없었습니다.
 * tools/check-contract.mjs 의 ① 이 그 짝을 검사하지만, 애초에 한 곳에서 만들면 갈릴 일이 없습니다.
 *
 * 반환값은 [이름, 값] 쌍의 배열입니다. 값이 빈 문자열이면 「정하지 않음」이고,
 * 어떻게 출력할지는 부르는 쪽이 정합니다.
 *   생성기      빈 값은 출력하지 않습니다. CSS 의 var(--x, 기본) 폴백이 살아야 합니다
 *   미리보기    빈 값을 initial 로 출력합니다. 생략하면 미리보기 문서에 남아 있는
 *               이전 생성 결과의 값이 그대로 적용됩니다
 */
import { mutedOn } from './site-vocab.mjs'

const px = (n, d = 0) => `${Math.round(Number.isFinite(n) ? n : d)}px`
const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)

/**
 * 글꼴 이름을 CSS 에 넣기 전에 형식을 검사합니다.
 *
 * 저장된 값이 x}</style><script> 같은 꼴이면 공개 화면의 style 태그를 닫고 스크립트가
 * 그대로 출력됩니다. 글꼴 이름은 글자·숫자·공백·하이픈이면 충분하니 아니면 기본값으로 떨굽니다.
 */
export const fontStack = (name, kind) => {
  const safe = /^[\p{L}\p{N} _-]{1,60}$/u.test(String(name || '')) ? String(name) : ''
  return kind === 'display'
    ? `${safe ? `'${safe}', ` : ''}'Apple SD Gothic Neo', serif`
    : `${safe ? `'${safe}', ` : ''}'Apple SD Gothic Neo', system-ui, sans-serif`
}

/** 본문 폭. wide 면 제한을 걸지 않습니다 */
export const bodyW = (t) => (t.width === 'wide' ? 'none' : px(t.bodyWidth))

/**
 * 푸터 board 의 폭. 본문 폭을 따르되 wide 일 때만 1240px 에서 멈춥니다.
 *
 * CSS 의 min(var(--body-w), 1240px) 으로 대신할 수 없습니다. wide 일 때 --body-w 가 none 이라
 * min() 이 통째로 무효가 되고 상한이 사라집니다. 숫자로 내야 합니다.
 */
export const footW = (t) => (t.width === 'wide' || !Number.isFinite(t.bodyWidth) ? '1240px' : px(t.bodyWidth))

/**
 * 테마 색과 글꼴. 선택한 세 색(paper·ink·accent)에서 나머지를 color-mix 로 파생합니다.
 * 열두 개를 다 선택하게 하면 그중 하나만 어긋나도 전체 색감이 탁해집니다.
 *
 * --fg-3(흐린 글자)만 혼합 비율이 아니라 대비로 계산합니다. 전경색과 배경색의 거리가
 * 테마마다 달라서 고정 비율로는 어떤 테마든 4.5:1 에 미달합니다.
 */
export const themeVars = (t, font = {}) => [
  ['bg', t.paper],
  ['fg', t.ink],
  ['accent', t.accent],
  ['bg-2', `color-mix(in srgb, ${t.ink} 6%, ${t.paper})`],
  ['fg-2', `color-mix(in srgb, ${t.ink} 72%, ${t.paper})`],
  ['fg-3', mutedOn(t.ink, t.paper)],
  ['line', `color-mix(in srgb, ${t.ink} 14%, ${t.paper})`],
  ['line-2', `color-mix(in srgb, ${t.ink} 24%, ${t.paper})`],
  ['display', fontStack(font.display || t.display, 'display')],
  ['sans', fontStack(font.body || t.body, 'sans')],
  ['body-w', bodyW(t)],
  ['foot-w', footW(t)],
]

/**
 * 헤더 변수. code 모드 화면이 받는 전부입니다.
 * 본문 폭이 여기 포함되는 이유는, code 모드에서도 공통 헤더를 켜면 그 헤더는 생성기가
 * 렌더링한 것이라 사이트 본문 폭을 따라야 하기 때문입니다.
 */
export const headVars = (h, theme) => [
  ['body-w', bodyW(theme)],
  ['hd-h', px(h.height, 66)],
  ['hd-size', String((h.size ?? 100) / 100)],
  ['hd-bg', isHex(h.bg) ? h.bg : ''],
  ['hd-fg', isHex(h.color) ? h.color : ''],
  ['hd-font', fontStack(h.font || theme.body, 'sans')],
]

/**
 * 메뉴 항목의 세부 값. 헤더와 드로어가 변수를 따로 씁니다(--nav-* / --dr-*).
 * 하나로 겸하면 헤더를 수정할 때 드로어까지 같이 바뀝니다.
 *
 * 안쪽 여백은 배경을 지정했을 때만 같이 냅니다. 배경 없이 여백만 주면 글자 위치가
 * 이유 없이 밀립니다.
 */
const itemVars = (it = {}, pre) => [
  [`${pre}-radius`, it.radius ? px(it.radius) : ''],
  [`${pre}-border`, it.border ? px(it.border) : ''],
  [`${pre}-fg`, isHex(it.color) ? it.color : ''],
  [`${pre}-bg`, isHex(it.bg) ? it.bg : ''],
  [`${pre}-py`, isHex(it.bg) ? '4px' : ''],
  [`${pre}-px`, isHex(it.bg) ? '10px' : ''],
]

/** 사이드바 패널 너비·배경·글자색. 배경만 주면 글자가 묻혀서 글자색을 짝으로 냅니다 */
const sideVars = (sb) => (sb ? [
  ['dr-w', px(sb.width)],
  ['dr-panel-bg', isHex(sb.bg) ? sb.bg : ''],
  ['dr-panel-fg', isHex(sb.color) ? sb.color : ''],
] : [['dr-w', ''], ['dr-panel-bg', ''], ['dr-panel-fg', '']])

export const menuVars = (h) => [
  ...itemVars(h.nav, 'nav'),
  ...itemVars(h.drawer, 'dr'),
  ...sideVars(h.menu === 'sidebar' ? h.sidebar : null),
]

/** 포트폴리오 knob. 값만 바꾸면 화면이 바뀌도록 전부 CSS 변수로 냅니다 */
export const knobVars = (k = {}) => [
  ['pf-cols', String(k.cols)],
  ['pf-ratio', k.ratio === 'auto' ? 'auto' : String(k.ratio)],
  ['pf-radius', px(k.radius)],
  ['pf-gap-y', px(k.gapY)],
  ['pf-gap-x', px(k.gapX)],
  ['pf-pad', px(k.pad)],
  ['pf-max', 'var(--body-w, 1240px)'],
  ['wk-gap', px(k.detailGap)],
  ['wk-top', px(k.detailTop, 48)],
  ['wk-radius', px(k.radius)],
]

/**
 * 「카드」 갈래의 손잡이. 고른 테마가 정한 기본을 **덮을 때만** 값을 냅니다.
 *
 * 빈 값을 그대로 넘기는 것이 핵심입니다 — 굽기의 `emitOmit` 이 빈 값을 안 내므로
 * CSS 의 `var(--bo-ink, 스킨기본)` 폴백이 살아납니다. 여기서 기본값을 채우면 스킨마다
 * 다른 기본색이 전부 한 색으로 눌립니다.
 *
 * 이름을 작은따옴표 리터럴로 적습니다. 백틱으로 조립하면 `check-contract` ①이 이 이름을
 * 못 읽어 ③(아무도 안 읽는 변수)의 보호 밖으로 나갑니다.
 */
export const outlineVars = (o = {}) => [
  ['bo-ink', o?.ink || ''],
  ['bo-bg', o?.bg || ''],
  ['bo-radius', Number.isFinite(o?.radius) ? px(o.radius) : ''],
]

/**
 * 문단 바로가기의 표식 색. 모양 넷이 **한 색을 같이** 봅니다.
 *
 * 빈 값을 그대로 넘깁니다 — `emitOmit` 이 안 내므로 CSS 의 `var(--bj-ink, var(--fg))`
 * 폴백이 살아 사이트의 먹(검정)을 따릅니다. 여기서 '#101114' 를 채우면 테마 색을 바꾼
 * 사이트에서도 그 색이 박힙니다(`outlineVars` 가 같은 까닭으로 비워 둡니다).
 *
 * 이름을 작은따옴표 리터럴로 적습니다. 백틱으로 조립하면 `check-contract` ①이 못 읽습니다.
 */
export const tocVars = (t = {}) => [
  ['bj-ink', t?.ink || ''],
]

/** 목록 제목(.lh)의 모양. 블로그와 포트폴리오가 값을 따로 갖습니다 */
export const lhVars = (head) => [
  ['lh-size', { sm: '0.82', md: '1', lg: '1.35' }[head.size] || '1'],
  ['lh-align', head.align === 'center' ? 'center' : 'left'],
  ['lh-gap', px(head.gap, 0)],
]

/** 화면별 글꼴. 지정한 것만 덮습니다 */
export const pageFontVars = (font) => [
  ...(font?.display ? [['display', fontStack(font.display, 'display')]] : []),
  ...(font?.body ? [['sans', fontStack(font.body, 'sans')]] : []),
]

/** 생성기용 출력 — 빈 값은 내지 않습니다 */
export const emitOmit = (pairs) => pairs
  .filter(([, v]) => v !== '' && v !== undefined)
  .map(([k, v]) => `  --${k}: ${v};\n`).join('')

/** 미리보기용 출력 — 빈 값은 initial 로 냅니다 */
export const emitInitial = (pairs) => pairs
  .map(([k, v]) => `--${k}:${v === '' || v === undefined ? 'initial' : v};`).join('')

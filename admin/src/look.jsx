/**
 * 홈디자인 — 화면의 생김새를 고르는 자리.
 *
 * 갈피는 **공통 │ 메인 │ 포트폴리오 │ 블로그** 다.
 *   · 공통 = 세 화면 전부에 걸리는 것. **화면 순서대로** 공통헤더 → 본문콘텐츠(색 프리셋·전체 배경·글자).
 *   · 글꼴과 콘텐츠 타이틀은 각 화면 탭에 있다.
 *   · 나머지 = 그 화면의 템플릿과 제 손잡이.
 * ⚠ 색·글꼴을 탭 **위에** 띄우지 않는다 — 그것이 무엇에 걸리는지 화면이 말해 주지 못하고,
 *   같은 성격의 것이 늘면 둘 곳이 없어진다. 같은 무게의 것은 같은 자리(탭)에 둔다.
 *
 * **「미리보기」 단추가 없다.** 값을 만지면 그 자리에서 보여야 한다:
 *   · 수치(색·간격·모서리·폭·머리 크기) = 전부 CSS 변수라 **미리보기 창의 style 한 덩이만 고쳐** 즉시.
 *   · 마크업이 바뀌는 것(템플릿·메뉴 자리·이름·보이기) = 400ms 뒤 **자동으로** 다시 굽는다.
 * 남는 단추는 「사이트에 반영」과 「이전 판으로」뿐이다 — 내보내는 일과 되돌리는 일.
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { EyeToggle } from './eye.jsx'
import {
  PAGES, PAGE_MODES, PAGE_SAMPLES, PAGE_SOURCE_MINE, MAIN_TEMPLATES, BLOG_TEMPLATES, PORTFOLIO_TEMPLATES, WIDTHS, ZOOMS,
  KNOBS, THEME_PRESETS, FONT_ROLES, contrast, mutedOn, headerContrast, buttonContrast, INK_MIN,
  MENU_PLACES, ALIGNS, HEAD_WIDTHS, SIDEBARS, DRAWER_W, NAV_STYLES, DRAWER_STYLES, NAV_LINKS, HEAD_SIZES, mainStart,
  ITEM_SIZES, ITEM_LINKS, SECTION_KINDS, TEMPLATE_ITEM_IDS, SHOT_KNOBS, SHOT_MAX, SAMPLE_SHOTS, STAGE_H, STAGE_W, BODY_W, HEAD_H, HEAD_SCALE, isExternal,
  FOOT_KINDS, FOOT_KNOBS, FOOT_SIZES, FOOT_H, FOOT_ICON, SERVICE_ICONS, ICON_OF, footStart, footerContrast,
} from '../../shared/site-vocab.mjs'
import { MENU_ICONS, MENU_ICON_GROUPS } from '../../shared/menu-icons.mjs'

/**
 * 메뉴 아이콘 한 벌 — **굽기와 같은 껍데기**를 씌운다(`bake.mjs` 의 `iconSvg`).
 * 한쪽만 고치면 관리자에서 본 것과 사이트에 나간 것이 달라진다.
 */
const MenuIcon = ({ value }) => {
  const i = MENU_ICONS.find((x) => x.value === value)
  if (!i) return null
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: i.body }} />
}
/* 도형은 `tools/sync-menu-icons.mjs` 가 통과 목록으로 걸러 구운 것이라 글자가 못 섞인다 —
   그래서 `dangerouslySetInnerHTML` 이 여기서는 안전하다(남이 넣은 값이 아니다) */
const iconLabel = (v) => MENU_ICONS.find((x) => x.value === v)?.label || '아이콘 없음'
import { attachStage, STACK_MQ } from './stage-editor.js'
/* 사진 올리기는 **무드보드와 같은 부품**이다 — 한 장마다 원본(2000px)·작은 판(720px) 두 벌을
   브라우저에서 굽고, 한 장이 실패해도 나머지를 올린다. 여기서 다시 짤 이유가 없다 */
import { uploadMood, ACCEPT } from './mood.js'
/* 글꼴 고르개는 **에디터와 같은 부품**을 쓴다. `<select>` 는 macOS·윈도가 OS 메뉴로 그려
   CSS 가 안 먹고, 글꼴 이름도 그 글꼴로 못 보여 준다 — 에디터에서는 이름을 그 글꼴로 보는데
   홈디자인에서만 시스템 메뉴가 떠 둘이 따로 놀았다(2026-09-17 사용자 지적) */
import { Picker } from '@storkspear/post-editor-react/PickMenu'
import { fontItems } from '@storkspear/post-editor-react/pickItems'

/**
 * 미리보기는 **두 벌**이다 — 진짜 자료 한 벌, 견본 자료 한 벌(server/dummy.mjs).
 *
 * 패널의 창은 견본 쪽을 본다: 아무것도 안 올린 사이트에서 템플릿을 고르면 빈 목록만
 * 남아 「히어로 이미지」와 「그리드 먼저」가 눈으로 구별되지 않는다. 고르는 일은
 * 모양을 보고 하는 일이라, 고를 때만큼은 내용이 차 있어야 한다.
 */
const PREVIEW = { dummy: '/preview/dummy', real: '/preview/real' }
/** 미리보기 주소에서 화면 경로만 — 어느 벌이든 앞머리를 뗀다 */
const barePath = (p) => String(p || '').replace(/^\/preview\/(real|dummy)(?=\/|$)/, '')

/** 받침을 보고 「을/를」을 고른다 — 이름이 데이터라 문장을 손으로 못 쓴다 */
const eul = (word) => {
  const c = String(word || '').trim().slice(-1).charCodeAt(0)
  const hangul = c >= 0xac00 && c <= 0xd7a3
  return hangul && (c - 0xac00) % 28 ? '을' : '를'
}

const TEMPLATES = { main: MAIN_TEMPLATES, blog: BLOG_TEMPLATES, portfolio: PORTFOLIO_TEMPLATES }
/** 손잡이 중 미끄럼자로 내보낼 것 — `cols` 는 따로 그린다(뜻이 수치가 아니라 선택이라) */
const SLIDERS = KNOBS.filter((k) => !['cols', 'radius', 'detailTop', 'detailGap'].includes(k.key))
/**
 * 모서리는 **세 벌 중에서** 고른다 — 미끄럼자로 0~32 를 굴리게 두지 않는다(2026-09-17 사용자 지시).
 * 값은 템플릿들이 실제로 쓰는 셋이다: 베한스·인스타그램 0, 드리블 8, 핀터레스트 16.
 * 서버는 여전히 0~32 를 받으므로, 예전에 12 처럼 저장한 값도 그대로 산다(세 단추 중 눌린 것이 없을 뿐).
 */
const RADII = [
  { value: 0, label: '직각', hint: '0px' },
  { value: 8, label: '중간', hint: '8px' },
  { value: 16, label: '둥근', hint: '16px' },
]
/** 상세페이지 아래에 서는 손잡이 — 목록이 아니라 **열린 작업**의 모양이라 따로 둔다 */
const DETAIL_SLIDERS = KNOBS.filter((k) => ['detailTop', 'detailGap'].includes(k.key))

/**
 * 갈피. 순서는 사용자가 정했다 — 공통 다음에 **포트폴리오가 블로그보다 먼저** 온다
 * (이 사이트의 주인공은 작업이다). `keys` 는 그 탭에서 「반영」할 때 나가는 설정이다.
 */
const PAGE = Object.fromEntries(PAGES.map((p) => [p.key, p]))
const TABS = [
  { key: 'common', label: '공통', path: '/', keys: ['theme', 'header', 'footer'] },
  { ...PAGE.main, keys: ['main'] },
  { ...PAGE.portfolio, keys: ['portfolio'] },
  { ...PAGE.blog, keys: ['blog'] },
]
/**
 * 공통의 2단계 갈피. 차례는 **고치는 빈도**다 — 메뉴를 제일 자주 만진다.
 * 만지는 키는 셋 다 `theme`·`header` 안이라 1단계의 `keys` 는 그대로다.
 */
const COMMON_SUBS = [
  { key: 'menu', label: '메뉴' },
  { key: 'head', label: '헤더' },
  { key: 'body', label: '콘텐츠' },
  /* 푸터는 화면 맨 아래라 차례도 맨 뒤다 — 위에서 아래로 읽힌다 */
  { key: 'foot', label: '푸터' },
]
/** 미리보기 굽기에 실어 보내는 키 — **전부.** 하나라도 빠지면 저장된 값이 끼어든다 */
const ALL_KEYS = ['theme', 'header', 'main', 'blog', 'portfolio', 'footer']
/** 미리보기 주소 → 그 화면의 설정 키. 화면별 글꼴·목록 머리를 **보고 있는 화면의 값**으로 칠한다 */
const KEY_OF_PATH = { '/': 'main', '/portfolio/': 'portfolio', '/blog/': 'blog' }
/** 미리보기 안의 주소가 **어느 화면 묶음**인가 — 목록과 그 상세는 같은 묶음이다 */
const pageOf = (path) => (path === '/' ? 'main'
  : path.startsWith('/portfolio/') ? 'portfolio' : path.startsWith('/blog/') ? 'blog' : null)

/**
 * 레이아웃 도형. 어휘가 `[x, y, w, h, 진하기]` 로 들고 있는 것을 그린다.
 * 말로 「표지 한 장」이라고 적는 것보다 모양 하나가 빨리 읽힌다(2026-09-16 QA).
 */
/** 「내 파일」 카드의 그림 — 종이 한 장에 코드 줄 */
const MINE_ICON = [[0,0,24,18,2],[2,2.2,5,1.2,1],[4,5,12,1.2,0],[4,7.6,9,1.2,0],[4,10.2,14,1.2,0],[2,13,5,1.2,1]]

const Shape = ({ cells, vh = 20 }) => (
  <svg className="lkShape" viewBox={`-1 -1 26 ${vh}`} style={{ aspectRatio: `26 / ${vh}` }} aria-hidden="true">
    {cells.map(([x, y, w, h, tone], i) => (
      <rect key={i} x={x} y={y} width={w} height={h} rx="0.6" data-tone={tone} />
    ))}
  </svg>
)

/**
 * 키 순서를 **없앤 뒤** 문자열로 만든다.
 *
 * ⚠ 그냥 `JSON.stringify` 를 쓰면 **키 순서까지 값으로 친다.** 같은 배치인데도
 * `mainStart` 가 내는 순서(…bg, shotKnobs, shots, slides)와 정규화가 내는 순서
 * (…bg, shots, slides, shotKnobs)가 달라, 다시 열기만 해도 「손댔다」로 읽혀
 * 무엇을 고르든 곧바로 커스텀이 됐다(2026-09-17 사용자 지적).
 */
const stable = (v) => (Array.isArray(v) ? v.map(stable)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]))
    : v)

/**
 * 메인의 **배치**만 — 글자를 뺀 자리·보이기·무대·목록. 템플릿의 시작 배치와 견줘 「손댔나」를 본다.
 *
 * ⚠ `slideH`(배너 높이)는 **뺀다.** 이 값 하나만 기본값을 **브라우저 창에서 재서** 넣으므로
 * (`fullBannerH`), 어휘에 박힌 고정값과 절대 같아질 수 없다. 넣어 두면 슬라이드를 고르는
 * 순간 늘 「손댔다」로 읽혀 곧바로 커스텀이 됐다(2026-09-17 사용자 지적).
 * 높이는 배치가 아니라 **손잡이**라, 빠져도 「무엇을 골랐나」의 뜻이 상하지 않는다.
 */
const layoutOf = (m) => JSON.stringify(stable({
  stage: { ...m.stage, slideH: 0 }, sections: m.sections,
  /* 차례가 곧 값이다 — 상자를 더하거나 빼거나 옮기면 「손댔다」 */
  items: (m.items || []).map(({ id, x, y, w, show, size, font, color, link }) =>
    ({ id, x, y, w, show, size, font, color, link })),
}))

/** 정렬 여섯 — 무대 기준. 그림은 피그마의 정렬 단추와 같은 결 */
const ALIGN_OPS = [
  { how: 'left', label: '왼쪽 맞춤', d: 'M3 2v12M6 5h8v2H6zM6 9h5v2H6z' },
  { how: 'center', label: '가로 가운데 맞춤', d: 'M8 2v12M3 5h10v2H3zM5 9h6v2H5z' },
  { how: 'right', label: '오른쪽 맞춤', d: 'M13 2v12M2 5h8v2H2zM5 9h5v2H5z' },
  { how: 'top', label: '위 맞춤', d: 'M2 3h12M5 6v8h2V6zM9 6v5h2V6z' },
  { how: 'middle', label: '세로 가운데 맞춤', d: 'M2 8h12M5 3v10h2V3zM9 5v6h2V5z' },
  { how: 'bottom', label: '아래 맞춤', d: 'M2 13h12M5 2v8h2V2zM9 5v5h2V5z' },
]

/**
 * 고른 값을 CSS 변수로. 비운 색은 변수를 안 내는 대신 **`initial`** 로 낸다 — 미리보기 문서에는
 * 마지막 굽기 때의 값(`<style data-head>`)이 남아 있어, 안 내면 「따르기」를 눌러도 옛 색이 그대로였다
 * (반박 리뷰 M3). `initial` 이면 `var()` 의 대체값(헤더 색·본문 색)이 산다.
 * **굽기의 `themeStyle`·`knobStyle`·`headStyle` 과 같은 이름**을 내야 한다 —
 * 이름이 갈리면 미리보기와 진짜 화면이 달라지고, 그 순간 미리보기는 거짓말이 된다.
 */
const liveCss = (conf, pageKey) => {
  const t = conf.theme
  /* 설정은 늘 다섯 키가 정규화돼 오지만, 한 키라도 빠진 응답에 화면 전체가 죽지는 않게 한다 */
  const k = conf.portfolio?.knobs ?? {}
  const h = conf.header ?? {}
  const pg = conf[pageKey] || {}
  const px = (n) => `${Math.round(n)}px`
  const stack = (name, tail) => `${name ? `'${name}', ` : ''}'Apple SD Gothic Neo', ${tail}`
  const display = pg.font?.display || t.display
  const body = pg.font?.body || t.body
  /* 머리줄 변수만 — 직접 디자인 화면이 받는 전부다.
     본문 폭이 여기 끼는 까닭은 굽기의 `headStyle` 과 같다: 직접 디자인이라도 공통헤더를 켜면
     그 머리줄은 굽기가 그린 것이라 사이트의 본문 폭을 따라야 한다 */
  const head = `--body-w:${t.width === 'wide' ? 'none' : px(t.bodyWidth)};--hd-h:${px(h.height ?? 66)};--hd-size:${(h.size ?? 100) / 100};`
    + `${h.bg ? `--hd-bg:${h.bg};` : '--hd-bg:initial;'}${h.color ? `--hd-fg:${h.color};` : '--hd-fg:initial;'}`
    + `--hd-font:${stack(h.font || t.body, 'system-ui, sans-serif')};`
    /* 메뉴 한 줄 — **자리마다 따로**(`--nav-*` / `--dr-*`). 굽기의 `itemVars` 와 같은 이름이다.
       ⚠ 안 정한 값도 `initial` 로 **내야** 한다 — 안 내면 창에 남은 옛 값이 그대로 붙는다 */
    + (h.menu === 'sidebar' && h.sidebar
      ? `--dr-w:${px(h.sidebar.width)};`
        + (h.sidebar.bg ? `--dr-panel-bg:${h.sidebar.bg};` : '--dr-panel-bg:initial;')
        + (h.sidebar.color ? `--dr-panel-fg:${h.sidebar.color};` : '--dr-panel-fg:initial;')
      : '--dr-w:initial;--dr-panel-bg:initial;--dr-panel-fg:initial;')
    + [['nav', h.nav], ['dr', h.drawer]].map(([pre, it]) => (it
      ? `--${pre}-radius:${px(it.radius)};--${pre}-border:${px(it.border)};`
        + (it.color ? `--${pre}-fg:${it.color};` : `--${pre}-fg:initial;`)
        + (it.bg
          ? `--${pre}-bg:${it.bg};--${pre}-py:4px;--${pre}-px:10px;--${pre}-solid-fg:${it.color || h.color || 'var(--fg)'};`
          : `--${pre}-bg:initial;--${pre}-py:initial;--${pre}-px:initial;--${pre}-solid-fg:initial;`)
      : '')).join('')
  /**
   * **직접 디자인 화면에는 테마를 안 바른다** — 굽기(`pageStyle`)와 같은 규칙이다.
   * 여기만 바르면 미리보기는 관리자 색으로, 진짜 화면은 `site.css` 색으로 갈린다.
   */
  if (pg.mode === 'code') return `:root{${pg.chrome ? head : ''}}`
  return `:root{
--bg:${t.paper};--fg:${t.ink};--accent:${t.accent};
--bg-2:color-mix(in srgb, ${t.ink} 6%, ${t.paper});
--fg-2:color-mix(in srgb, ${t.ink} 72%, ${t.paper});
--fg-3:${mutedOn(t.ink, t.paper)};
--line:color-mix(in srgb, ${t.ink} 14%, ${t.paper});
--line-2:color-mix(in srgb, ${t.ink} 24%, ${t.paper});
--display:${stack(display, 'serif')};
--sans:${stack(body, 'system-ui, sans-serif')};
/* 푸터 폭 — 굽기의 footW 와 같은 식이다. min(var(--body-w), 1240px) 로 대신할 수 없다:
   화면 폭일 때 --body-w 가 none 이라 min() 이 통째로 무효가 되고 상한이 사라진다.
   테마 블록에 두는 까닭은 굽기가 themeStyle 에만 내기 때문이다 — head 에 두면
   직접 디자인 화면에서 미리보기만 이 값을 갖는다.
   ⚠ 이 주석은 템플릿 문자열 **안**이다 — 백틱을 쓰면 문자열이 거기서 끝나 빌드가 깨진다 */
--foot-w:${t.width === 'wide' || !Number.isFinite(t.bodyWidth) ? '1240px' : px(t.bodyWidth)};
--pf-cols:${k.cols};--pf-ratio:${k.ratio === 'auto' ? 'auto' : k.ratio};
--pf-radius:${px(k.radius)};--pf-gap-y:${px(k.gapY)};--pf-gap-x:${px(k.gapX)};
--pf-pad:${px(k.pad)};--pf-max:var(--body-w);
--wk-gap:${px(k.detailGap)};--wk-radius:${px(k.radius)};--wk-top:${px(k.detailTop ?? 48)};
${head}
${pg.head ? `--lh-size:${{ sm: '0.82', md: '1', lg: '1.35' }[pg.head.size] || '1'};--lh-align:${pg.head.align === 'center' ? 'center' : 'left'};--lh-gap:${px(pg.head.gap || 0)};` : ''}
}
.prose{--accent:${t.accent}}`
}

/**
 * 글꼴 칸 — 에디터의 `Picker`(버튼 + 메뉴)를 그대로 쓴다. 첫 줄 「기본서체」(빈 값)가
 * 이 화면에서는 **사이트 기본을 따른다**는 뜻이다. 버튼에도 고른 글꼴로 이름을 보인다.
 * 목록은 그릴 때마다 받는다 — 사이트 글꼴이 `configureFonts` 로 나중에 더해질 수 있다.
 */
const FontPick = ({ label, value, onPick }) => (
  <div className="lkField lkFontField">
    <span>{label}</span>
    <Picker title={label} className="lkPicker" width={220} items={fontItems()} value={value}
            style={{ fontFamily: value || undefined }} onPick={onPick} />
  </div>
)

/**
 * 숫자 칸 — **치는 동안은 초안만** 들고 있다가 Enter·칸을 벗어날 때 한 번 반영한다.
 * 칠 때마다 반영했더니 W 에 `300` 을 치면 `3` 이 하한 20 으로 잘려 20→200→2000→1240 이 됐고,
 * X·Y 는 칠 때마다 요소가 튀며 되돌리기 기록이 글자마다 쌓였다(반박 리뷰 M1).
 * ↑↓ 는 바로 반영한다(1, Shift 10) — 한 번에 한 칸이라 초안이 필요 없다. Esc 는 초안 버리기.
 */
const NumField = ({ label, value, onCommit }) => {
  const [draft, setDraft] = useState(null)
  const parsed = () => (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft)) ? Number(draft) : null)
  const commit = () => {
    const n = parsed()
    setDraft(null)
    if (n !== null && n !== value) onCommit(n)
  }
  return (
    <label className="lkNum">
      <span>{label}</span>
      <input type="text" inputMode="numeric" value={draft ?? String(value)}
             onFocus={(e) => e.target.select()}
             onChange={(e) => setDraft(e.target.value)}
             onBlur={commit}
             onKeyDown={(e) => {
               if (e.key === 'Enter') { e.preventDefault(); commit(); return }
               if (e.key === 'Escape') { e.preventDefault(); setDraft(null); return }
               if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
               e.preventDefault()
               const base = parsed() ?? value
               setDraft(null)
               onCommit(base + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1))
             }} />
    </label>
  )
}

/**
 * 둘·셋 중 하나 고르기 — 이 화면에서 제일 많이 쓰는 부품이라 한 번만 짓는다.
 * 어휘가 도형(`icon`)을 들고 있으면 템플릿 카드처럼 **판짜기 그림**을 같이 그린다 —
 * 「헤더」와 「사이드 바」가 말보다 그림으로 빨리 읽혔다(2026-09-17 사용자 요청).
 */
const Pick = ({ list, value, onPick, two }) => (
  <div className={'lkPick' + (two ? ' lkTwo' : '') + (list.length === 3 ? ' lkThree' : '')
                  + (list.some((o) => o.icon) ? ' lkShapes' : '')}>
    {list.map((o) => (
      <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onPick(o.value)}>
        {o.icon && <Shape cells={o.icon} vh={o.iconH} />}
        <b>{o.label}</b>{o.hint && <em>{o.hint}</em>}
      </button>
    ))}
  </div>
)

/**
 * 색 한 칸 — 쓰는 자리 일곱이 **같은 생김새**다(헤더배경·헤더폰트색·버튼색·버튼배경·
 * 콘텐츠배경·콘텐츠폰트·요소색). 예전에는 같은 뜻의 되돌리기가 두 모양이었다 —
 * 밑줄 친 글자(`lkReset`)와 테두리 네모(`lkColorClear`)(2026-09-18 사용자 지적).
 *
 * 되돌리기가 둘인 것은 **뜻이 둘이라서**다. 한 생김새로 적되 갈라 둔다:
 *   ↺  마지막으로 **사이트에 적용한 색**으로 — 적용본과 다를 때만 뜬다
 *   글  **상위 색을 따르게** 비우기 — 값을 정했을 때만 뜬다. 이것이 유일한
 *       「따르던 길로 돌아가는 문」이라 없애면 막다른 길이 된다(반박 리뷰 N2·M5)
 *
 * `shown` 은 **보여 주기만** 하는 색이다 — 비어 있으면 따르는 색을 보여 주고,
 * 만지는 순간 그 색으로 고정된다.
 */
const ColorField = ({ id, label, value, shown, applied, onPick, followLabel }) => (
  <div className="lkColor">
    <label htmlFor={id}>{label}</label>
    {/* ⚠ 되돌리기 둘을 **같은 줄**에 둔다. 「따르기」만 아래로 내렸더니 칸마다 키가 달라졌고,
         이 줄(`.lkRow`)은 바닥 맞춤(`align-items:flex-end`)이라 라벨이 층층이 어긋났다
         (2026-09-18 사용자 지적). 한 줄이면 칸 높이가 늘 같아 저절로 줄이 맞는다 */}
    <span className="lkColorRow">
      <input id={id} type="color" value={shown} onChange={(e) => onPick(e.target.value)} />
      <output>{shown}</output>
      {applied !== undefined && applied !== value && (
        <button type="button" className="lkColorBack" aria-label={`${label} 적용된 색으로`}
                title="마지막으로 사이트에 적용한 색으로 되돌립니다"
                onClick={() => onPick(applied)}>↺</button>
      )}
      {followLabel && value && (
        <button type="button" className="lkReset" onClick={() => onPick('')}>{followLabel}</button>
      )}
    </span>
  </div>
)

/**
 * 사이트 값이 대신 나가는 자리(이메일·저작권)를 **그 글자로 채운다.**
 *
 * 굽기는 상자의 글자가 비면 `site.config.mjs` 의 값을 대신 낸다. 관리자가 그 자리를
 * 빈 칸으로 두고 **힌트로만** 보여 주면, 화면에는 글이 있는데 설정에는 없는 꼴이라
 * 고치고 지우는 일이 말이 안 된다(2026-09-18 사용자 지시). 보이는 것과 나가는 것이 같아야 한다.
 *
 * ⚠ 적용본(`saved`)에도 **같이** 넣는다 — 안 그러면 열자마자 「바뀐 것 있음」으로 보인다.
 */
const withText = (items, defs) => (items || []).map((it) => (
  it.kind === 'icon' || String(it.text || '').trim() || !defs[it.id] ? it : { ...it, text: defs[it.id] }))
const fillText = (st, stage, foot) => ({
  ...st,
  main: st.main ? { ...st.main, items: withText(st.main.items, stage) } : st.main,
  footer: st.footer ? Object.fromEntries(Object.entries(st.footer)
    .map(([k, v]) => [k, { ...v, items: withText(v.items, foot) }])) : st.footer,
})

/**
 * 요소 목록의 이름 칸 — **그 자리에서 글자를 고친다.**
 *
 * 예전에는 목록에서 고른 뒤 아래 판의 글상자로 내려가 고쳤다. 같은 글을 두 자리에서
 * 보여 주면서 고치는 곳은 하나라 어디를 만져야 하는지가 안 보였다(2026-09-18 사용자 지시).
 *
 * 치는 동안은 **초안**만 든다(숫자 칸 `NumField` 와 같은 규약): Enter 나 ✓ 로 반영,
 * Esc 로 버리기, 칸을 벗어나면 반영. 글자마다 반영하면 되돌리기 기록이 글자 수만큼 쌓이고
 * 미리보기가 타자마다 다시 그려진다.
 */
const ItemName = ({ value, placeholder, icon, onFocus, onCommit }) => {
  const [draft, setDraft] = useState(null)
  const dirty = draft !== null && draft !== value
  const commit = () => { const v = draft; setDraft(null); if (v !== null && v !== value) onCommit(v) }
  return (
    <span className="lkItemName lkItemEdit">
      <i aria-hidden="true">{icon}</i>
      <input className="lkItemText" type="text" value={draft ?? value} placeholder={placeholder} aria-label="글자"
             onFocus={onFocus} onChange={(e) => setDraft(e.target.value)}
             onKeyDown={(e) => {
               if (e.key === 'Enter') { e.preventDefault(); commit() }
               if (e.key === 'Escape') { e.preventDefault(); setDraft(null); e.currentTarget.blur() }
             }}
             onBlur={commit} />
      {/* ✓ 는 **고친 뒤에만** 뜬다 — 늘 서 있으면 줄마다 단추가 하나씩 더 있는 꼴이다.
           `onMouseDown` 을 막는 까닭: 안 막으면 칸이 먼저 흐려지며 blur 가 반영해 버려 ✓ 가 사라진다 */}
      {dirty && (
        <button type="button" className="lkItemOk" title="적용(Enter)" aria-label="글자 적용"
                onMouseDown={(e) => e.preventDefault()} onClick={commit}>✓</button>
      )}
    </span>
  )
}

/**
 * 「선택한 요소」 판 — **무대와 푸터가 같이 쓴다.** 피그마의 오른쪽 칸처럼 숫자로 고친다.
 *
 * 두 판이 같은 부품(`.m-board`·`.m-i`)을 쓰므로 고치는 칸도 하나여야 한다 — 갈라 두면
 * 한쪽에만 고친 것이 다른 쪽에 안 오고, 같은 화면에서 두 결이 선다.
 *
 * 아이콘 줄은 글꼴·크기 칸 대신 **서비스·주소**를 든다: 로고는 글자가 아니라 도형이고,
 * 색은 푸터 글자색을 따른다. 「직접 입력」만 이름 칸을 갖는다 — 그 이름이 곧 그림이라서다.
 */
const SelPanel = ({ sel, item, defaults, sizes, applied, icons, href, off, onPatch, onAlign, onNum, onClose }) => {
  const isIcon = item.kind === 'icon'
  const svc = isIcon ? SERVICE_ICONS.find((x) => x.value === item.service) : null
  const named = isIcon && item.service === 'link'
  /* 화면에 안 나가는 요소 — **빈 글자 상자뿐**이다(아이콘은 주소가 없어도 그려진다) */
  const gone = !isIcon && !(String(item.text || '').trim() || defaults[item.id])
  return (
    <div className="lkSel" aria-label="선택한 요소">
      <div className="lkSelHead">
        {/* 이름 칸이 곧 **글자 칸**이다 — 보여 주기만 했더니 목록에서 고른 상자의 말을
             미리보기에서 두 번 누르지 않고는 못 고쳤다(2026-09-18 사용자 지적).
             `text` 는 `shape` 에 없다: 다시 굽지 않고 편집기가 창에 바로 입힌다.
             로고 아이콘은 글자를 안 그린다 — 칸 대신 무엇인지만 적는다 */}
        {/* 글자는 **위 목록 줄에서** 고친다 — 여기서는 무엇을 고르고 있는지만 보인다
             (같은 글을 두 자리에서 고치게 두지 않는다. 2026-09-18 사용자 지시) */}
        {isIcon && !named ? (
          <span className="lkSelIcon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON_OF[item.service] || ''} /></svg>
            {svc?.label || '아이콘'}
          </span>
        ) : (
          <span className="lkSelName">{String(item.text || '').trim() || defaults[item.id] || '빈 글자'}</span>
        )}
        <button type="button" className="lkSelX" onClick={onClose} aria-label="선택 해제">×</button>
      </div>
      {/* 정렬은 **그려진 것의 크기**를 재서 맞춘다 — 화면에 없는 요소에는 잴 것이 없다 */}
      {!off && (
        <div className="lkAlign" role="group" aria-label="판 기준 정렬">
          {ALIGN_OPS.map((a) => (
            <button key={a.how} type="button" title={a.label} aria-label={a.label} onClick={() => onAlign(a.how)}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d={a.d} /></svg>
            </button>
          ))}
        </div>
      )}
      {gone && (
        <p className="lkHint warn">글자가 비어 화면에 안 나옵니다 — 위 칸에 글자를 넣으면 나타납니다</p>
      )}
      <div className="lkNumRow">
        {[['x', 'X'], ['y', 'Y'], ['w', isIcon ? '크기' : 'W']].map(([k, label]) => (
          <NumField key={`${sel.key}-${k}`} label={label} value={sel[k]} onCommit={(n) => onNum(k, n)} />
        ))}
        {/* 높이는 **그려진 것**을 잰 값이다 — 화면에 없으면 잴 것이 없어 칸도 안 낸다 */}
        {!off && (
          <span className="lkNum is-auto" title={isIcon && !named ? '아이콘은 정사각입니다' : '글자 양이 정합니다'}>
            <span>H</span><output>{sel.h}</output>
          </span>
        )}
      </div>
      {isIcon ? (<>
        <div className="lkRow">
          <div className="lkField"><span>서비스</span>
            <Picker title="서비스" className="lkPicker" width={200} value={item.service}
                    items={icons.map((i) => ({ value: i.value, label: i.label }))}
                    onPick={(v) => onPatch({ service: v })} />
          </div>
        </div>
        <div className="lkRow">
          <label className="lkField"><span>주소</span>
            <input type="url" value={item.url || ''} placeholder={svc?.hint ? `https://${svc.hint}` : 'https://…'}
                   onChange={(e) => onPatch({ url: e.target.value })} />
          </label>
        </div>
        {!item.url?.trim() && href && (
          <p className="lkHint">비워 두면 사이트에 적어 둔 곳으로 갑니다 — <b>{href}</b></p>
        )}
        {/* 주소가 아예 없을 때 — 아이콘은 그려지되 링크가 아니다(누르면 귀띔만 뜬다) */}
        {!item.url?.trim() && !href && (
          <p className="lkHint">주소가 없어 눌러도 안 움직입니다 — 화면에서는 「링크 연결 주소 없음」이 뜹니다</p>
        )}
        {/* 쓰다 만 주소 — 저장하면 **조용히 비워진다**(굽기가 안 건다). 그 전에 말해 준다 */}
        {!!item.url?.trim() && !isExternal(item.url) && (
          <p className="lkHint warn">아직 주소가 아닙니다 — <b>https://</b> 로 시작해야 저장됩니다</p>
        )}
      </>) : (<>
        <div className="lkRow">
          <label className="lkField"><span>크기</span>
            <select value={item.size} onChange={(e) => onPatch({ size: e.target.value })}>
              {sizes.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
            </select>
          </label>
          <label className="lkField"><span>URL 연결</span>
            {/* 고르개는 「직접 입력」을 보이지만 **저장되는 것은 주소 그 자체**다 */}
            <select value={isExternal(item.link) || item.link === 'https://' ? 'custom' : item.link}
                    onChange={(e) => onPatch({
                      link: e.target.value === 'custom' ? (isExternal(item.link) ? item.link : 'https://') : e.target.value,
                    })}>
              {ITEM_LINKS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
        </div>
        {(isExternal(item.link) || item.link === 'https://') && (
          <div className="lkRow">
            <label className="lkField"><span>주소</span>
              <input type="url" value={item.link} placeholder="https://example.com"
                     onChange={(e) => onPatch({ link: e.target.value })} />
            </label>
          </div>
        )}
        <div className="lkRow">
          <label className="lkField"><span>글꼴</span>
            <select value={item.font} onChange={(e) => onPatch({ font: e.target.value })}>
              <option value="">기본 서체</option>
              {fontItems().filter((f) => f.value).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <ColorField id="lk-item-color" label="색" value={item.color}
                      shown={item.color || '#111111'} followLabel="기본 서체색 따르기"
                      applied={applied} onPick={(v) => onPatch({ color: v })} />
        </div>
      </>)}
      <p className="lkSelTip">{isIcon
        ? '자리는 끌어서 옮기고, Alt 를 누르고 끌면 안내선에 붙지 않습니다 · 로고는 두 번 눌러도 글자가 안 열립니다'
        : '글자는 위 목록에서, 또는 미리보기에서 두 번 눌러 고칩니다 · 자리는 끌어서 옮기고, Alt 를 누르고 끌면 안내선에 붙지 않습니다'}</p>
    </div>
  )
}

/** 적용 — 체크. 「반영했다」는 뜻이라 완료 표시가 맞다 */
const IconApply = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12.5l5.5 5.5L20 6.5" />
  </svg>
)
/** 사진 더하기 — 사진틀에 더하기 표. [T](글자 더하기) 옆에 같은 무게로 선다 */
const IconPic = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 13.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8.5" />
    <path d="M3 15l4-4 4.5 4.5" />
    <circle cx="14.5" cy="8.5" r="1.4" />
    <path d="M18 16.5v5M15.5 19h5" />
  </svg>
)
/** 되돌리기 — 왼쪽으로 도는 화살표 */
const IconUndo = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9h11a6 6 0 1 1 0 12H8" /><path d="M7 5L3 9l4 4" />
  </svg>
)

export function Look({ onWorks }) {
  const [conf, setConf] = useState(null)
  /**
   * 되돌리기는 **마지막 반영에 들어간 키만** 되돌린다(반박 리뷰 M4).
   *
   * 반영은 **바뀐 키만** 보내고, 그 묶음을 기억해 그만큼만 되돌린다.
   * ⚠ 탭의 키를 전부 보내면 같은 값의 판이 쌓이고, 되돌리기가 키마다 「지금과 다른 마지막
   *   판」을 따로 찾게 된다 — 제목만 바꿨는데 **손대지 않은 색이** 옛 판으로 가거나,
   *   「판이 전부 같습니다」로 중간에 멈춰 반쯤 되돌아간 사이트가 남는다.
   */
  const saved = useRef({})
  /**
   * **마지막으로 사이트에 나간 값** 하나를 꺼낸다. `saved.current` 는 키별 JSON 문자열이고
   * 적용·되돌리기마다 갱신된다 — 서버를 안 거치고 그 색으로 돌아갈 수 있다.
   * 아직 한 번도 안 나간 키면 `undefined` 를 돌려 ↺ 가 아예 안 뜬다.
   */
  const appliedOf = (key, path) => {
    try {
      return path.reduce((o, k) => (o == null ? o : o[k]), JSON.parse(saved.current[key] ?? 'null'))
    } catch { return undefined }
  }
  const [batch, setBatch] = useState({})
  const [tab, setTab] = useState('common')
  /* 공통의 2단계 갈피. **`tab` 과 따로 둔다** — `bad`·`changed`·`undoKeys`·미리보기 창의 `key`
     가 전부 1차원 `tab` 에 묶여 있어, 여기 값을 섞으면 `TABS.find` 가 못 찾고 터진다 */
  const [sub, setSub] = useState('menu')
  /* 아이콘 고르개 — **한 번에 하나만** 연다. 링크 키를 들고 있고 빈 값이면 닫힘 */
  const [iconFor, setIconFor] = useState('')
  /* 「아이콘」 벌인가 — 사이드바를 쓰고 그 벌일 때만 도형이 화면에 나간다 */
  const iconMode = conf?.header?.menu === 'sidebar' && conf?.header?.drawer?.style === 'icon'
  /**
   * 공통 탭의 미리보기 화면. 공통 설정은 **세 화면 전부**에 걸리므로 어느 화면으로 볼지 고른다.
   *
   * 첫 화면은 **블로그**다. 메인은 공통헤더가 기본으로 꺼져 있고 목록 머리(「글 / N편」)도
   * 없어서, 머리줄이나 타이틀을 고쳐도 아무것도 안 바뀌어 보인다 — 설정은 먹는데 보이지
   * 않는 것은 고장과 구별이 안 된다. 블로그는 언제나 굽기가 만들고 머리줄도 기본으로 켜져
   * 있어, 공통 탭에서 만지는 것이 전부 드러나는 유일한 화면이다.
   */
  const [commonPath, setCommonPath] = useState('/blog/')
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  /* 굽기가 보내는 귀띔 — 막지는 않았지만 알아 둘 것(예: 머리줄이 둘). 미리보기를 구울
     때마다 새로 받으므로, 원인을 없애면 다음 굽기에서 저절로 사라진다 */
  const [warn, setWarn] = useState([])
  const [bust, setBust] = useState(0)          /* 미리보기를 다시 받아 오는 신호 */
  const frame = useRef(null)
  /**
   * 미리보기 창을 **넓게 띄우고 줄여서** 담는다.
   *
   * 칸 폭 그대로 띄우면 화면 절반쯤(≈850px)이라 `STACK_MQ`(860px) 아래로 떨어지고,
   * 그러면 공개면이 판을 버리고 폰처럼 쌓아 **끌어서 옮기기가 늘 꺼져 있었다.**
   * 칸이 이미 넓으면(1240 이상) 줄이지 않는다 — 공연히 작게 보일 이유가 없다.
   */
  const shrink = useRef(null)
  useLayoutEffect(() => {
    const box = shrink.current
    if (!box) return
    const fit = () => {
      const { width, height } = box.getBoundingClientRect()
      const k = width > 0 ? Math.min(1, width / STAGE_W) : 1
      box.style.setProperty('--lk-k', String(k))
      box.style.setProperty('--lk-vw', `${Math.round(width / k)}px`)
      box.style.setProperty('--lk-vh', `${Math.round(height / k)}px`)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [!!conf])
  /**
   * 메인 무대 편집기 — 미리보기 창 안에 얹는다(stage-editor.js). 창(문서)이 바뀔 때만 새로 붙이고,
   * 값이 바뀔 때는 `sync` 로 맞춘다. `sel` 은 고른 요소의 판 단위 상자 — 속성 칸이 이것을 그린다.
   */
  const editor = useRef(null)
  const [sel, setSel] = useState(null)
  const [grid, setGrid] = useState(false)
  const [editorOff, setEditorOff] = useState(null)
  /* 방금 더한 상자 — 미리보기가 다시 그려지면 이것을 고른다 */
  const wantSel = useRef(null)
  /* 템플릿을 바꾸려는데 배치를 손댄 뒤라면 한 번 묻는다 — 누른 템플릿 값을 들고 있는다 */
  const [ask, setAsk] = useState(null)
  /* 무대 요소의 기본 글자(blog.config) — 편집기에서 글자를 다 지우면 이것이 보여야 공개면과 같다 */
  const [stageText, setStageText] = useState({})
  /* 푸터도 같다 — 이메일·저작권은 비워 두면 `site.config.mjs` 의 값이 나간다 */
  const [footText, setFootText] = useState({})
  /* 주소를 안 넣어도 갈 곳이 있는 아이콘(지금은 GitHub) — 「주소 없음」을 거짓으로 말하지 않으려고 */
  const [footIcon, setFootIcon] = useState({})
  /* 창 폭이 바뀌어 편집기를 다시 붙일 때 **지금** 렌더의 paint 를 부르려고 */
  const paintRef = useRef(null)
  /* 좌측 글자 칸을 비운 채 떠날 때 되돌릴 값 — 아래 `.lkSelText` 의 onBlur 가 쓴다 */
  const textWas = useRef('')
  const previewPath = tab === 'common' ? commonPath : PAGE[tab].path
  const previewKey = KEY_OF_PATH[previewPath]
  /**
   * 어느 푸터를 고치는가 — **보고 있는 화면이 정한다.** 따로 상태를 두면 「메인 푸터」를 고르는데
   * 미리보기에는 블로그가 떠 있는 어긋남이 난다(고치는 벌과 보는 화면은 늘 같아야 한다).
   * 그래서 위의 고르개는 `commonPath` 를 바꾸고, 그 값에서 벌이 따라 나온다.
   */
  const footKind = previewPath === '/' ? 'main' : 'pages'
  /* 지금 보고 있는 화면이 「직접 디자인」인가 — 블로그에는 이 갈림이 없다 */
  const code = tab !== 'common' && tab !== 'blog' && conf[tab].mode === 'code'
  const stay = useRef(null)
  stay.current = pageOf(previewPath)

  /**
   * 배치를 한 군데라도 손대면 템플릿이 **커스텀**으로 넘어간다.
   *
   * 옮긴 배치를 「표지」라는 이름으로 계속 부르면 무엇을 골랐는지가 거짓이 되고, 다른
   * 템플릿을 누를 때 무엇이 사라지는지도 흐려진다. 고르는 자리 하나에서 상태가 드러난다.
   *
   * 여기서 보는 것은 **자리·보이기·목록·높이**뿐이다(`layoutOf`) — 글자와 글꼴은 배치가
   * 아니라서 고쳐도 템플릿이 안 바뀐다. 끌기 중에는 편집기가 창만 고치고 놓을 때 한 번
   * 알리므로, 이 검사도 놓는 순간 한 번 돈다.
   */
  /* 팝업은 Esc 로도 닫힌다 — 덮개를 눌러 닫는 것과 같은 길이 키보드에도 있어야 한다 */
  useEffect(() => {
    if (!ask) return
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); setAsk(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ask])

  const shape0 = conf && layoutOf(conf.main)
  useEffect(() => {
    if (!conf || conf.main.template === 'custom') return
    if (shape0 !== layoutOf({ ...conf.main, ...mainStart(conf.main.template) })) {
      setConf((c) => ({ ...c, main: { ...c.main, template: 'custom' } }))
    }
  }, [shape0, conf?.main.template])

  useEffect(() => {
    api('/settings')
      .then((d) => {
        const filled = fillText(d.settings, d.stageText || {}, d.footText || {})
        setConf(filled)
        onWorks?.(d.settings.portfolio?.mode === 'template')
        setStageText(d.stageText || {})
        setFootText(d.footText || {})
        setFootIcon(d.footIcon || {})
        saved.current = Object.fromEntries(ALL_KEYS.map((k) => [k, JSON.stringify(filled[k])]))
        /* 열었을 때의 묶음은 **시각**으로 짐작한다 — 한 번의 반영은 몇 초 안에 끝나고,
           사람이 두 번 반영하는 사이는 그보다 길다. 이전 판이 있는 키만 센다 */
        const upd = d.updated || {}
        const hist = d.history || {}
        const guess = {}
        for (const t of TABS) {
          const at = t.keys.filter((k) => upd[k] && (hist[k] || 0) > 1).map((k) => [k, Date.parse(upd[k])])
          if (!at.length) continue
          const last = Math.max(...at.map(([, v]) => v))
          guess[t.key] = at.filter(([, v]) => last - v < 3000).map(([k]) => k)
        }
        setBatch(guess)
      })
      .catch((e) => setErr(e.message))
  }, [])

  /* 알림은 목록 화면과 **같은 토스트**다 — 화면 구석에 잠깐 뜨고, 올려 두면 안 사라진다.
     쓰던 자리(패널 맨 위)에 끼우면 아래가 통째로 밀려 고치던 손잡이를 놓친다 */
  const noteTimer = useRef(null)
  const hold = () => clearTimeout(noteTimer.current)
  const release = () => { hold(); noteTimer.current = setTimeout(() => setNote(''), 3500) }
  const say = (t) => { setNote(t); release() }
  useEffect(() => () => clearTimeout(noteTimer.current), [])
  const fail = (e) => { setErr(e.message || String(e)); setTimeout(() => setErr(''), 8000) }

  /**
   * ① 즉시 반영 — 미리보기 창 안의 `<style id="live">` 를 직접 고친다.
   *
   * 서버를 안 거치므로 미끄럼자를 끄는 동안 끊김이 없다. 같은 출처라서 되는 일인데,
   * 「직접 올리기」를 켜면 그 창을 권한 없는 모래상자로 바꾸므로(아래) 이 길이 막힌다 —
   * 그때는 어차피 손잡이가 안 듣는 화면이라 잃는 것이 없다.
   */
  /**
   * 배너 높이를 **창에 바로 먹인다** — 판(`.m-board`)을 편집기가 그렇게 하는 것과 같다.
   *
   * 다시 굽지 않는 까닭: 미끄럼자를 끌 때마다 사이트 한 벌을 다시 구우면 창이 매번
   * 새로 떠서 깜빡인다. `--sh` 는 CSS 변수라 창의 값만 갈아 끼우면 그 자리에서 바뀐다.
   * 창이 새로 뜨면 구운 옛 값이 잠깐 보이므로 `paint`(onLoad)에서도 한 번 더 먹인다.
   */
  const paintSlides = (st) => {
    const doc = frame.current?.contentDocument
    const banner = doc?.querySelector('.m-slides')
    if (banner) banner.style.setProperty('--sh', String(Math.round(st.slideH)))
    const stack = doc?.querySelector('.m-shots')
    if (stack) for (const k of SHOT_KNOBS) stack.style.setProperty(`--m${k.key}`, String(Math.round(st.shotKnobs[k.key] ?? k.d)))
    const board = doc?.querySelector('.m-board')
    /* 굽기와 **같은 문자열**이다 — 값을 미루어 두면 본문 폭 미끄럼자를 끌 때 판이 저절로 따라온다 */
    if (board) board.style.setProperty('--bw', 'var(--body-w, 1240px)')
  }
  const knobKey = conf && [conf.main.stage.slideH, conf.theme.width, conf.theme.bodyWidth,
    ...SHOT_KNOBS.map((k) => conf.main.stage.shotKnobs[k.key])].join(',')
  useEffect(() => { if (conf) paintSlides(conf.main.stage) }, [knobKey])

  /**
   * 푸터 손잡이 — 전부 CSS 변수라 **다시 굽지 않는다.** 창의 푸터 한 덩이만 고쳐 넣는다.
   * 이름·유도색 셈은 굽기의 `footHtml` 과 **같아야** 한다 — 갈리는 순간 미리보기가 거짓말이 된다.
   *
   * ⚠ 판 높이(`--sh`)만 시트가 아니라 **판의 style 속성**에 있다(굽기가 거기 박는다).
   *   인라인이 시트를 이기므로 `liveCss` 로는 못 덮는다 — 그 속성을 직접 고친다.
   */
  const paintFoot = (doc) => {
    const sec = doc?.querySelector?.('.foot')
    if (!sec || !conf.footer) return
    const set = conf.footer[sec.dataset.foot === 'pages' ? 'pages' : 'main']
    if (!set) return
    const st = sec.style
    const put = (k, v) => (v ? st.setProperty(k, v) : st.removeProperty(k))
    const px = (n, d = 0) => String(Math.round(Number.isFinite(n) ? n : d))
    st.setProperty('--fgap', px(set.gap))
    st.setProperty('--fline', px(set.line?.width, 1))
    put('--fline-c', set.line?.color)
    put('--fbg', set.bg)
    const back = set.bg || conf.theme.paper
    put('--fg', set.color)
    put('--fg-2', set.color && `color-mix(in srgb, ${set.color} 72%, ${back})`)
    put('--fg-3', set.color && mutedOn(set.color, back))
    put('--line', set.color && `color-mix(in srgb, ${set.color} 24%, ${back})`)
    const board = sec.querySelector('.m-board')
    if (board) board.style.setProperty('--sh', px(set.height, 288))
  }

  const paint = () => {
    if (!conf) return
    const doc = frame.current?.contentDocument
    if (!doc?.head) return
    paintSlides(conf.main.stage)
    paintFoot(doc)
    let el = doc.getElementById('live')
    if (!el) { el = doc.createElement('style'); el.id = 'live'; doc.head.append(el) }
    /* 탭이 아니라 **창의 실제 주소**로 고른다 — 블로그 탭에서 미리보기 안의 「포트폴리오」를 누르면
       블로그 글꼴·타이틀 크기로 포트폴리오를 칠하고 있었다(반박 리뷰 n6) */
    const path = barePath(frame.current?.contentWindow?.location.pathname)
    const liveKey = KEY_OF_PATH[path] || (path.startsWith('/portfolio/') ? 'portfolio'
                  : path.startsWith('/blog/') ? 'blog' : previewKey)
    el.textContent = liveCss(conf, liveKey)
    /* 메인 탭이면 편집기를 얹는다. 창이 새로 떴으면(문서가 다르면) 새로 붙이고, 아니면 값만 맞춘다 */
    /* 새 창이 아직 안 떴으면(빈 문서) 붙이지 않는다 — 붙였다가 「판 없음」으로 선택을 지우면
       다시 굽고 창이 뜰 때마다 고른 요소가 풀렸다. 진짜 문서가 뜨면 onLoad 가 다시 부른다 */
    /* 아직 읽는 중인 문서에도 붙이지 않는다 — 판이 아직 없어 「판 없음」으로 기록되면 onLoad 에서
       같은 문서라며 다시 안 붙였다(반박 리뷰) */
    /* 새로 더한 상자가 창에 나타났으면 그때 고른다 — 놓기만 하고 어디 갔는지 모르면 소용이 없다 */
    const want = wantSel.current
    if (want && doc.querySelector(`.m-i[data-i="${want}"]`)) {
      wantSel.current = null
      queueMicrotask(() => { editor.current?.api.select?.(want); frame.current?.contentWindow?.focus() })
    }
    /**
     * 편집기가 붙을 판 — 메인 탭은 **무대**, 공통 탭의 「푸터」 갈피는 **푸터**다. 그 밖에는 안 붙는다.
     * 판이 한 문서에 둘이라(무대·푸터) 선택자를 반드시 좁힌다 — 안 좁히면 무대 편집기가 푸터를 잡는다.
     */
    const edAt = tab === 'main' && conf.main.mode === 'template' ? 'stage'
      : tab === 'common' && sub === 'foot' ? 'foot' : null
    const edSet = edAt === 'foot' ? conf.footer?.[footKind] : null
    /**
     * 푸터 갈피에서는 미리보기를 **맨 아래**로 내린다 — 고치는 자리가 화면 밖이면 아무것도 안 보인다.
     *
     * 다시 구울 때마다 창이 새로 뜨면서 위로 돌아가므로(아이콘 하나 더할 때마다 그랬다 —
     * 2026-09-18 사용자 지적) 그때마다 다시 맞춘다. **문서마다 한 번만** 한다: 사람이 굴려
     * 위쪽을 보고 있는데 손잡이를 만질 때마다 도로 끌어내리면 그것대로 못 쓴다.
     */
    if (edAt === 'foot') {
      if (!doc.__lkFoot) {
        doc.__lkFoot = true
        doc.querySelector('.foot')?.scrollIntoView({ block: 'end' })
      }
    } else if (doc.__lkFoot) doc.__lkFoot = false
    if (edAt && doc.URL !== 'about:blank' && doc.readyState === 'complete') {
      /**
       * 창 폭이 쌓임 경계(860px)를 넘으면 **떼고 다시 붙인다.** 한 번 붙인 문서에는 다시 안 붙이므로,
       * 좁을 때 열면 넓혀도 편집이 안 됐고, 넓을 때 붙인 뒤 좁히면 쌓인 화면 위에서 보이지 않는
       * 좌표가 바뀌었다(반박 리뷰 M5).
       */
      if (!doc.__lkMq) {
        doc.__lkMq = true
        frame.current.contentWindow.matchMedia(STACK_MQ).addEventListener('change', () => {
          if (editor.current?.doc === doc) {
            try { editor.current.api.detach?.() } catch { /* 버려진 문서 */ }
            editor.current = null
          }
          paintRef.current?.()
        })
      }
      /* ⚠ 붙이기가 **실패한 창은 다시 시도한다.** 한 번 「좁다」로 돌아서면 그 창에는 다시 안
         붙었는데, 창은 곧이어 넓어진다(아래 줄이기 셈이 폭을 1240 으로 올린다) — 그 사이에
         맞은 폭을 놓치면 편집기가 영영 꺼진 채였다(2026-09-18 사용자 지적).
         실패한 붙이기는 `sync` 가 없다 — 그것으로 가른다. 붙이기 자체는 querySelector 두 번이라 싸다 */
      /* 붙을 판이 바뀌었으면(무대↔푸터) 문서가 같아도 다시 붙인다 — `at` 이 그것을 가른다 */
      if (editor.current?.doc !== doc || editor.current.at !== edAt || !editor.current.api.sync) {
        try { editor.current?.api.detach?.() } catch { /* 버려진 문서 */ }
        const ed = attachStage(frame.current.contentWindow, edAt === 'foot'
          ? {
            root: '.foot .m-board', items: edSet?.items || [], height: edSet?.height,
            selected: sel?.key, grid, defaults: footText,
            onSelect: setSel,
            onChange: (key, patch) => setFootItem(key, patch),
          }
          : {
            main: conf.main, selected: sel?.key, grid, defaults: stageText,
            onSelect: setSel,
            onChange: (key, patch) => setConf((c) => ({
              ...c, main: { ...c.main, items: (c.main.items || []).map((x) => (x.id === key ? { ...x, ...patch } : x)) },
            })),
          })
        editor.current = { doc, at: edAt, api: ed }
        setEditorOff(ed.off)
        if (ed.off === 'narrow') setSel(null)
      } else editor.current.api.sync?.(edAt === 'foot' ? { items: edSet?.items || [], height: edSet?.height } : conf.main)
    } else if (editor.current) {
      /* 다른 탭 — 옛 창은 이미 버려졌을 수 있다(문서가 사라지면 떼는 것도 할 일이 없다) */
      try { editor.current.api.detach?.() } catch { /* 버려진 문서 */ }
      editor.current = null
    }
    /**
     * 미리보기는 **그 탭의 화면 밖으로 안 나간다.** 메인 탭에서 작업 카드를 누르면 포트폴리오 상세가
     * 떠 탭(메인)과 화면(포트폴리오)이 어긋났다(2026-09-17 사용자 지적). 같은 묶음 안(목록↔상세,
     * 팝업의 `#`)은 그대로 두고, 다른 묶음·바깥 주소·메일 링크만 막는다. 공개 사이트 링크는 그대로다.
     * 창이 새로 뜨면 문서가 바뀌므로 문서마다 한 번 건다. 머무를 묶음은 ref 로 읽는다(탭이 바뀌어도 최신).
     */
    if (!doc.__lkGuard) {
      doc.__lkGuard = true
      doc.addEventListener('click', (e) => {
        const a = e.target?.closest?.('a[href]')
        if (!a) return
        const url = new URL(a.getAttribute('href'), doc.baseURI)
        const at = new URL(doc.location.href)
        if (url.origin === at.origin && url.pathname === at.pathname) return
        const to = url.origin === at.origin ? pageOf(barePath(url.pathname)) : null
        if (to && to === stay.current) return
        e.preventDefault()
      }, true)
    }
    /* 에디터 글꼴(본고딕·본명조…)은 레포 시트에 없다 — 구운 화면은 고른 뒤 다시 구우면 싣지만,
       고르는 **그 순간**에도 보여야 하므로 미리보기 창에는 미리 꽂아 둔다 */
    if (!doc.querySelector('link[data-live-fonts]')) {
      const l = doc.createElement('link')
      l.rel = 'stylesheet'; l.href = '/assets/fonts.css'; l.setAttribute('data-live-fonts', '')
      doc.head.prepend(l)
    }
  }
  /* 값이 바뀌면 다시 칠한다. **창이 새로 뜰 때도** 칠해야 한다(탭을 옮기면 새 문서다) —
     그건 `onLoad` 가 맡는다. 둘 중 하나만 있으면 탭을 옮긴 뒤 손잡이가 안 듣는 것처럼 보인다. */
  /* ⚠ **갈피(`tab`·`sub`)도 듣는다.** 편집기가 붙을 판이 갈피로 갈리므로, 창이 그대로여도
     「푸터」로 옮긴 순간 다시 칠해야 한다 — 안 그러면 푸터 판에 편집기가 안 붙어 끌 수가 없다 */
  useEffect(paint, [conf, bust, previewKey, tab, sub])
  paintRef.current = paint

  /**
   * ② 마크업이 바뀌는 것은 서버가 다시 구워야 보인다. 400ms 쉬었다 한 번만.
   *
   * **여기 넣는 것 = 마크업을 바꾸는 것뿐이다.** 색·모서리·크기처럼 CSS 변수로 가는 것을
   * 넣으면 미끄럼자를 끌 때마다 굽기가 돌아 즉시 반영의 값어치가 사라진다.
   */
  const headMarkup = (hd) => hd && [hd.show, hd.name, hd.count]
  /* 본문 대비만 본다. 헤더·메뉴버튼 대비까지 여기 넣었더니 공통 탭에서 모자란 조합을 둔 채 다른 탭으로 가면
     미리보기가 **이유 없이** 멈췄다(이유 문구는 공통 탭에만 있다 — 반박 리뷰). 둘 다 정한 색이 부딪히면
     서버가 400 과 이유를 돌려주고, 그 문구는 어느 탭에서든 보인다 */
  const themeOk = !!conf && contrast(conf.theme.ink, conf.theme.paper) >= INK_MIN
  const shape = conf && JSON.stringify([
    /* 본문을 누가 만드는가 · 머리줄을 이는가 — **마크업이 통째로 바뀌는 값**이라 맨 앞이다 */
    conf.main.mode, conf.portfolio.mode,
    /* 직접 디자인이 싣는 파일 — 바꾸면 본문이 통째로 다른 파일이 된다 */
    conf.main.source, conf.portfolio.source,
    conf.main.chrome, conf.portfolio.chrome, conf.blog.chrome,
    conf.main.template, conf.blog.template, conf.portfolio.template,
    /* 무대 — 그림 깔기·목록 켜기·요소 보이기는 마크업이 바뀐다. 좌표·높이·글자는 편집기가 창에 바로 입힌다 */
    conf.main.stage.bg, conf.main.sections,
    /* 사진 — 두 자리의 차례가 곧 마크업이다. 높이는 CSS 변수라 창이 바로 먹는다 */
    conf.main.stage.shots.map((x) => x.src).join('|'),
    conf.main.stage.slides.map((x) => x.src).join('|'),
    /* 마크업이 바뀌는 값 전부 — 색·글꼴은 상자의 style 로 구워지므로 여기 없으면 안 그려진다 */
    conf.main.items.map((i) => [i.id, i.show, i.size, i.link, i.font, i.color].join(':')),
    conf.portfolio.zoom,
    headMarkup(conf.blog.head), headMarkup(conf.portfolio.head),
    conf.header.title, conf.header.align, conf.header.width,
    conf.header.menu, conf.header.sidebar.kind, conf.header.links,
    /* 스타일은 **클래스 이름**으로 나간다 = 마크업이 바뀐다. 색·모서리는 CSS 변수라 여기 없다 */
    conf.header.nav.style, conf.header.drawer.style,
    /* 푸터 — 마크업이 바뀌는 값만. 높이·간격·색은 CSS 변수라 창이 바로 먹고, 좌표·글자는 편집기가 입힌다.
       아이콘의 `text`(직접 입력 이름)도 그림 그 자체라 마크업이다.
       ⚠ 주소는 **주소가 됐는가**(`isExternal`)를 본다. `!!url` 로 보면 첫 글자에 한 번 켜진 뒤
       다시는 안 바뀌어, 다 치고 나도 **미리보기를 다시 안 굽는다** — 아이콘을 넣었는데 화면에
       영영 안 나타난다(2026-09-18 사용자 지적). 굽기도 이 기준으로 그린다 */
    FOOT_KINDS.map((k) => (conf.footer?.[k.value]?.items || [])
      .map((i) => [i.id, i.kind, i.service, i.show, i.size, i.link, i.font, i.color, isExternal(i.url),
                   i.kind === 'icon' ? i.text : ''].join(':')).join('|')),
    /* 대비가 모자라면 서버가 400 을 돌려준다 — 그 사이엔 굽지 않고, 고쳐지는 순간 다시 굽는다.
       안 그러면 400 뒤로 미리보기가 옛 모양에 멈춘 채 남았다(리뷰 minor 1) */
    themeOk,
  ])
  /**
   * **열 때도 한 번 굽는다.** 미리보기 폴더에는 누가 마지막에 구운 모습이 남아 있다 —
   * 처음 값을 건너뛰었더니 고르개는 「헤더」인데 미리보기에는 지난번 시험의 사이드 바 햄버거가
   * 떠 있었다(2026-09-16). 조작과 화면이 어긋난 미리보기는 없는 것보다 나쁘다.
   */
  const lastShape = useRef(null)
  useEffect(() => {
    if (!conf || !themeOk) return
    if (lastShape.current === shape) return
    const first = lastShape.current === null
    lastShape.current = shape
    const id = setTimeout(async () => {
      setBusy('draw')
      try {
        /* **한 요청에 키를 전부 싣는다.** 미리보기 굽기는 사이트 한 벌을 통째로 만드는
           일이라, 키마다 따로 보내면 뒤 요청이 앞 요청을 저장된 값으로 덮어 버린다
           (메인·블로그를 골라도 안 바뀌던 원인 — 2026-09-16 QA). */
        const d = await api('/settings', { method: 'POST', body: JSON.stringify({
          key: 'theme', value: conf.theme, preview: true,
          also: Object.fromEntries(ALL_KEYS.map((k) => [k, conf[k]])),
        }) })
        setWarn(d?.warn || [])
        /* 창이 갈리기 직전 — 고치던 글자·끌던 자리를 확정해 둔다(안 그러면 새 창과 함께 사라졌다) */
        editor.current?.api.flush?.()
        setBust((n) => n + 1)
      } catch (e) { fail(e) } finally { setBusy('') }
    }, first ? 0 : 400)
    return () => clearTimeout(id)
  }, [shape])

  if (!conf) return <div className="lk lkWait">{err ? <p className="err">{err}</p> : '불러오는 중…'}</div>

  const set = (key, patch) => setConf((c) => ({ ...c, [key]: { ...c[key], ...patch } }))
  const setKnob = (k, v) => setConf((c) => ({
    ...c, portfolio: { ...c.portfolio, knobs: { ...c.portfolio.knobs, [k]: v } },
  }))
  const setHeader = (patch) => set('header', patch)
  const setLink = (key, patch) => setConf((c) => ({
    ...c, header: { ...c.header, links: { ...c.header.links, [key]: { ...c.header.links[key], ...patch } } },
  }))
  const setItem = (key, patch) => setConf((c) => ({
    ...c, main: { ...c.main, items: (c.main.items || []).map((x) => (x.id === key ? { ...x, ...patch } : x)) },
  }))
  /* ── 푸터 ─────────────────────────────────────────────
     두 벌(메인·포트폴리오/블로그)이 한 키에 같이 산다 — 한 번에 반영·되돌리기 된다 */
  const footSet = conf.footer?.[footKind] || footStart(footKind)
  const setFoot = (patch) => setConf((c) => ({
    ...c, footer: { ...c.footer, [footKind]: { ...c.footer[footKind], ...patch } },
  }))
  const setFootItems = (fn) => setConf((c) => ({
    ...c, footer: { ...c.footer, [footKind]: { ...c.footer[footKind], items: fn(c.footer[footKind].items || []) } },
  }))
  const setFootItem = (id, patch) => setFootItems((items) => items.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  /* 상자 이름 — 제가 쓴 글자가 곧 이름이고, 비면 굽기가 넣을 글자(`footText`)를 보인다.
     아이콘은 글자가 아니라 **무엇으로 가는 길**이라 서비스 이름이 이름이다 */
  const footName = (it) => (it.kind === 'icon'
    ? (String(it.text || '').trim() || SERVICE_ICONS.find((x) => x.value === it.service)?.label || '아이콘')
    : (String(it.text || '').trim() || footText[it.id] || '빈 글자'))
  const newFootId = (items, pre) => { let n = 1; while (items.some((x) => x.id === `${pre}${n}`)) n += 1; return `${pre}${n}` }
  /**
   * 푸터에 하나 더하기 — 놓고 **바로 고르게** 한다(놓기만 하고 어디 갔는지 모르면 소용이 없다).
   * 글자는 왼쪽 판면선(40)에서 아래로 쌓고, 아이콘은 오른쪽 끝에서 왼쪽으로 줄을 선다 —
   * 지금 배치가 그 꼴이라, 더한 것이 엉뚱한 자리에 떨어지지 않는다.
   */
  const addFoot = (icon) => setFootItems((items) => {
    const id = newFootId(items, icon ? 'i' : 'b')
    const h = footSet.height
    const mine = items.filter((x) => (x.kind === 'icon') === !!icon)
    const next = icon
      /* 「직접 입력」은 이름이 곧 그림이라 정사각으로 놓으면 「…」만 남는다 — 이름 자리만큼 넓게 */
      ? { id, kind: 'icon', service: icon, url: '', w: icon === 'link' ? 180 : 52, show: true,
          x: Math.max(40, Math.min(...mine.map((x) => x.x), 1200) - (icon === 'link' ? 190 : 62)),
          y: mine[0]?.y ?? Math.round(h / 3) }
      : { id, text: '새 글자', size: 'body', font: '', color: '', link: '', show: true, auto: true,
          x: 40, y: Math.min(mine.reduce((m, x) => Math.max(m, x.y + 44), 40), Math.max(40, h - 40)), w: 520 }
    wantSel.current = id
    return [...items, next]
  })
  /**
   * 아이콘 고치기 — **서비스를 바꾸면 크기도 그 서비스의 범위로 데려온다.**
   *
   * 로고는 정사각이라 한 변 24~96 이고 「직접 입력」 칩은 이름이 들어가 600 까지다. 넓힌 칩을
   * 로고로 바꾸면 크기가 범위 밖이라 **저장도 미리보기도 400** 이 되는데, 오류는 「크기」를
   * 가리켜 무엇 때문인지 알 수 없다(반박 리뷰 M3). 고르는 순간 같이 맞춰 그 길을 막는다.
   */
  /* 이 아이콘이 실제로 갈 곳 — 굽기의 `iconHref` 와 같은 규칙이다(정한 주소 → 사이트 값 → 없음) */
  const footHref = (it) => String(it.url || '').trim() || footIcon[it.service] || ''
  /**
   * 이 요소가 **화면에 나가는가** — 굽기와 같은 규칙이다(빈 글자·갈 곳 없는 아이콘은 안 그린다).
   *
   * ⚠ 안 나가는 것은 미리보기에 **없으므로 편집기가 못 고른다.** 그런데 주소를 넣으려면
   *   골라야 한다 — 그대로 두면 「주소 없음」인 아이콘은 영영 주소를 못 넣는 막다른 길이 된다
   *   (2026-09-18 사용자 지적). 그래서 아래 목록은 그런 줄을 **데이터만으로** 고르게 한다.
   */
  const footShown = (it) => (it.kind === 'icon'
    ? true : !!(String(it.text || '').trim() || footText[it.id]))
  /**
   * 목록에서 고르기 — **창에 그 요소가 정말 있는지**를 보고 가른다.
   *
   * `footShown` 으로 가르면 안 된다: 관리자가 아는 것과 구운 화면이 어긋날 수 있고(방금 고쳐
   * 아직 안 구운 사이·사이트 값이 빈 자리), 그때 편집기에 넘기면 **아무 일도 안 일어난다**.
   * 없으면 데이터만으로 판을 연다(`off`) — 그래야 주소·글자를 넣어 화면에 불러낼 수 있다.
   */
  const pickFoot = (it, keepFocus = false) => {
    const at = frame.current?.contentDocument
      ?.querySelector(`.foot .m-i[data-i="${CSS.escape(it.id)}"]`)
    if (at && !editorOff) {
      editor.current?.api.select?.(it.id)
      /* ⚠ **글자 칸에서 부를 때는 초점을 옮기지 않는다.** 칸을 눌러 초점이 온 순간 미리보기
         창으로 초점을 넘기면 커서가 사라져 **한 글자도 못 친다**(2026-09-18 사용자 지적).
         창에 초점을 주는 까닭은 끌기·⌘Z 를 바로 쓰게 하려는 것이라, 단추로 고를 때만 준다 */
      if (!keepFocus) frame.current?.contentWindow?.focus()
      return
    }
    setSel({ key: it.id, x: it.x, y: it.y, w: it.w, h: 0, off: true })
  }
  const footPatch = (it, patch) => {
    if (!patch.service || patch.service === it.service) return patch
    const max = patch.service === 'link' ? FOOT_ICON.textMax : FOOT_ICON.max
    const w = Math.min(Math.max(it.w ?? 52, FOOT_ICON.min), max)
    /* 로고 → 이름 칩은 이름이 들어갈 자리가 필요하다. 좁은 정사각 그대로면 「…」만 남는다 */
    return { ...patch, w: patch.service === 'link' && w < 140 ? 180 : w }
  }
  const dropFoot = (id) => {
    if (sel?.key === id) setSel(null)
    setFootItems((items) => items.filter((x) => x.id !== id))
  }
  /**
   * 상자 이름 — **제가 쓴 글자**가 곧 이름이다.
   * 비어 있으면 굽기가 채울 기본 글자를(`stageText`) 알려 주고, 그것도 없으면 「빈 글자」.
   */
  const boxName = (it) => (it.text || '').trim() || stageText[it.id] || '빈 글자'

  /* 새 상자의 id — 겹치지 않게. 사람이 읽을 일이 없어 짧게 */
  const newId = (items) => { let n = 1; while (items.some((x) => x.id === `b${n}`)) n += 1; return `b${n}` }
  /** 빈 자리에 상자를 놓고 **바로 고르게** 한다 — 놓기만 하고 어디 갔는지 모르면 소용이 없다 */
  const addBox = (extra = {}) => setConf((c) => {
    const items = c.main.items || []
    const id = newId(items)
    /* 아래로 쌓되 판을 넘지 않게. 가로는 판면선(40)에서 시작한다 */
    const y = Math.min(items.reduce((m, x) => Math.max(m, x.y + 60), 120), Math.max(120, c.main.stage.height - 80))
    /* ⚠ 빈 글자로 태어나면 굽기가 걸러 내 **화면에 안 나오고**, 안 나오니 고를 수도 없다.
       고정 일곱은 `site.config` 가 기본 글자를 채워 주지만 더한 상자에는 채울 것이 없다 */
    const next = { id, text: '새 글자', x: 40, y, w: 600, show: true,
                   size: 'body', font: '', color: '', link: '', ...extra }
    /* ⚠ 여기서 바로 고를 수 없다 — 미리보기는 잠깐 뒤에 다시 구워지므로 그 요소가 아직 창에 없다.
       이름만 적어 두면 창이 새로 뜬 뒤 `paint` 가 골라 준다 */
    wantSel.current = id
    return { ...c, main: { ...c.main, items: [...items, next] } }
  })
  const dropBox = (id) => setConf((c) => {
    if (sel?.key === id) setSel(null)
    return { ...c, main: { ...c.main, items: (c.main.items || []).filter((x) => x.id !== id) } }
  })

  /**
   * 사진 올리기 — 글의 사진과 **같은 문**(`POST /api/media`)을 `uploadMood` 로 지난다.
   *
   * 글 번호 자리에 `0` 을 넣는다: 글 번호는 1부터 나오므로 `0` 은 **어느 글의 것도 아닌**
   * 사이트 몫의 폴더가 된다(`/blog/0/…`). 굽기는 글 폴더를 지우지 않으므로 안전하다.
   *
   * ⚠ 날파일을 그대로 올리지 않는다 — `uploadMood` 가 긴 변 2000px WebP 로 굽는다.
   * 예전에는 원본을 그대로 올려서 8MB JPEG 이 방문자에게 통째로 갔다.
   */
  const putShots = async (files) => {
    if (!files?.length) return null
    setErr('')
    setBusy('shot')
    try {
      const { images, failed } = await uploadMood(files, 0)
      if (failed.length) setErr(`올리지 못한 사진: ${failed.join(' · ')}`)
      return images
    } catch (e) { fail(e); return null } finally { setBusy('') }
  }

  /* ⚠ 올리는 동안 사람이 높이를 끌 수 있다. `conf` 를 닫아 쓰면 올리기 전 값으로 되돌아가므로
     **고칠 때의 최신 값**(setConf 의 c)에 얹는다 */
  const putStage = (patch) => setConf((c) => ({ ...c, main: { ...c.main, stage: { ...c.main.stage, ...patch(c.main.stage) } } }))

  /**
   * `uploadMood` 가 돌려주는 것을 상자 모양으로 옮긴다.
   *
   * ⚠ 그쪽의 `thumb` 는 **경로가 아니라 id** 다(무드보드는 DB 가 풀어 준다). 여기서는
   * 설정 jsonb 에 그대로 들어가므로 경로로 만들어야 한다 — 원본과 **같은 폴더**의
   * 파일 이름만 갈아 끼운다(`/blog/0/` 을 손으로 적으면 폴더 규약이 두 군데가 된다).
   */
  const asShot = (u) => ({
    src: u.src,
    thumb: u.thumb ? u.src.replace(/[^/]+$/, u.thumb) : '',
    w: u.w, h: u.h,
  })

  const pickBg = async (file) => {
    const up = await putShots(file ? [file] : [])
    if (up?.length) putStage(() => ({ bg: up[0].src }))
  }

  /**
   * 사진은 **두 자리**에 산다 — `shots`(세로로 잇기)와 `slides`(배너). 각자 제 묶음이다.
   * 손잡이는 **켜져 있는 자리만** 낸다: 안 보이는 것을 고치는 칸은 고장과 구별이 안 된다.
   */
  const shownSec = (key) => !!(conf.main.sections || []).find((x) => x.key === key)?.show
  const shotsOf = (slot) => conf.main.stage[slot] || []
  /* ⚠ 고칠 때의 **최신 값**에 얹는다 — 캡처한 `conf` 로 배열을 다시 짜면 올리는 중에
     차례를 바꿀 때 방금 올라온 사진이 사라진다(2026-09-18 반박 리뷰 L3) */
  const putShotsIn = (slot, fn) => putStage((st) => ({ [slot]: fn(st[slot] || []) }))

  /* 상한을 넘게 고르면 **넘는 만큼만 버리고 알린다** — 열 장을 고른 사람이 몇 장이
     왜 안 들어갔는지 모르는 것이 제일 나쁘다 */
  const addShots = async (slot, files) => {
    const room = SHOT_MAX[slot] - shotsOf(slot).length
    if (room <= 0) return
    const take = [...files].slice(0, room)
    if (take.length < files.length) {
      setErr(`사진은 ${SHOT_MAX[slot]}장까지입니다 — ${files.length - take.length}장은 넣지 않았습니다`)
    }
    const up = await putShots(take)
    if (up?.length) putStage((st) => ({ [slot]: [...(st[slot] || []), ...up.map(asShot)].slice(0, SHOT_MAX[slot]) }))
  }
  const dropShot = (slot, i) => putShotsIn(slot, (list) => list.filter((_, j) => j !== i))
  const moveShot = (slot, i, d) => putShotsIn(slot, (list) => {
    const next = [...list]
    const j = i + d
    if (j < 0 || j >= next.length) return list
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })

  const labelOfSec = (key) => SECTION_KINDS.find((x) => x.key === key)?.label || key
  /**
   * 목록 한 줄 켜고 끄기.
   *
   * **켜면 보여야 한다.** 사진 자리를 켰는데 넣은 사진이 없으면 화면이 그대로라
   * 「켠 것이 안 먹었다」로 읽힌다(2026-09-18 사용자 지적). 그래서 빈 자리를 켜는
   * 순간 **견본 사진을 채운다** — 템플릿이 견본을 들고 오는 것과 같은 규약이라,
   * 받은 사람은 제 사진으로 갈아 끼우면 된다. 끌 때는 사진을 그대로 둔다.
   */
  const setSec = (i, patch) => setConf((c) => {
    const key = c.main.sections[i]?.key
    const slot = SECTION_KINDS.find((k) => k.key === key)?.of
    const fill = patch.show && slot && !(c.main.stage[slot] || []).length
      ? { [slot]: SAMPLE_SHOTS.slice(0, Math.min(3, SHOT_MAX[slot])).map((x) => ({ ...x })) }
      : null
    return {
      ...c,
      main: {
        ...c.main,
        stage: fill ? { ...c.main.stage, ...fill } : c.main.stage,
        sections: c.main.sections.map((x, j) => (j === i ? { ...x, ...patch } : x)),
      },
    }
  })
  /* 차례 바꾸기 — 배열에서 한 칸 옮긴다. 이것이 곧 화면 차례다 */
  /**
   * 메뉴 차례 — **값을 맞바꾼다.** 목록(`moveSec`)은 배열을 맞바꾸지만 링크는 객체라
   * 자리가 없다. 그래서 `order` 두 개를 서로 준다(결과는 같다).
   */
  const moveLink = (key, d) => setConf((c) => {
    const seq = [...NAV_LINKS].sort((p, q) => c.header.links[p.key].order - c.header.links[q.key].order)
    const i = seq.findIndex((l) => l.key === key)
    const j = i + d
    if (i < 0 || j < 0 || j >= seq.length) return c
    const a = seq[i].key, b = seq[j].key
    return { ...c, header: { ...c.header, links: { ...c.header.links,
      [a]: { ...c.header.links[a], order: c.header.links[b].order },
      [b]: { ...c.header.links[b], order: c.header.links[a].order } } } }
  })

  const moveSec = (i, d) => setConf((c) => {
    const next = [...c.main.sections]
    const j = i + d
    if (j < 0 || j >= next.length) return c
    ;[next[i], next[j]] = [next[j], next[i]]
    return { ...c, main: { ...c.main, sections: next } }
  })

  /**
   * 배너의 첫 높이는 **이 브라우저의 크기에서 잰다.**
   *
   * 슬라이드를 고르는 사람이 원하는 그림은 「열었을 때 배너가 화면을 꽉 채우는 것」이다.
   * 그러려면 아래 내용이 30px 넘게 비어져 나오지 않아야 한다 — 창 높이에서 그만큼을 뺀다.
   * 어휘에 박아 둘 수 없는 값이라(거기엔 창이 없다) 고르는 순간 여기서 잰다.
   * 그 뒤로는 그냥 px 라, 미끄럼자로 얼마든지 바꿀 수 있다.
   */
  const fullBannerH = () => {
    const h = Math.round((frame.current?.contentWindow?.innerHeight || window.innerHeight) - 30)
    return Math.min(STAGE_H.max, Math.max(STAGE_H.min, h))
  }

  /**
   * 만드는 방법 고르기.
   *
   * 「템플릿」으로 막 넘어왔는데 고른 것이 **커스텀**이면 아무것도 안 고른 것과 같다 —
   * 커스텀은 고르는 자리가 아니라 「손대면 닿는 곳」이라, 갓 넘어온 사람에게는 뜻이 없다.
   * 그럴 때만 첫 템플릿(히어로 이미지)으로 세워 준다(2026-09-17 사용자 지시).
   * 이미 고른 템플릿이 있으면 **건드리지 않는다** — 오가며 배치를 잃으면 안 된다.
   */
  const pickMode = (value) => {
    const fresh = tab === 'main' && value === 'template'
      && conf.main.mode !== 'template' && conf.main.template === 'custom'
    if (!fresh) { set(tab, { mode: value }); return }
    const first = MAIN_TEMPLATES[0].value
    const st = mainStart(first)
    setConf((c) => ({ ...c, main: { ...c.main, mode: value, template: first, ...st,
      items: st.items.map((b) => ({ ...b, text: (c.main.items || []).find((x) => x.id === b.id)?.text ?? '' })) } }))
    setSel(null)
  }

  /** 메인 템플릿 바꾸기 — **배치는 그 템플릿의 시작 배치로, 글자는 그대로** */
  const switchMain = (value) => {
    const st = mainStart(value)
    if (value === 'slides') st.stage.slideH = fullBannerH()
    setConf((c) => ({
      ...c,
      main: {
        ...c.main, template: value, stage: st.stage, sections: st.sections,
        /**
         * **템플릿 상자는 새 템플릿의 것으로 통째로 갈아 끼운다** — 옛 템플릿에만 있던 상자
         * (예: 타이포 표지의 「이름」)가 남으면 고른 템플릿과 화면이 어긋난다. 같은 이름이면
         * 자리만 바꾸고 고친 글자는 지킨다.
         * [T] 로 직접 더한 상자(`b1`…)는 템플릿의 것이 아니므로 그대로 남는다.
         */
        items: [
          ...st.items.map((b) => ({ ...b, text: (c.main.items || []).find((x) => x.id === b.id)?.text ?? '' })),
          ...(c.main.items || []).filter((x) => !TEMPLATE_ITEM_IDS.includes(x.id)),
        ],
      },
    }))
    setAsk(null)
    setSel(null)
  }
  const selItem = sel && (conf?.main.items || []).find((i) => i.id === sel.key)
  /* 푸터 쪽 선택 — 편집기는 한 번에 판 하나에만 붙으므로 둘이 같이 뜰 일은 없다 */
  const footItem = sel && (footSet.items || []).find((i) => i.id === sel.key)
  const ci = contrast(conf.theme.ink, conf.theme.paper)
  /* 공통헤더 색이 비어 있으면 **테마 색을 따른다** — 빈 값끼리 재면 0 이 나와 반영이 막혔다 */
  const hdBg = conf.header.bg || conf.theme.paper
  const hdFg = conf.header.color || conf.theme.ink
  const hc = headerContrast(conf.theme, conf.header)
  const bc = buttonContrast(conf.theme, conf.header)
  const tabKeys = TABS.find((t) => t.key === tab).keys
  /* 별색은 고르는 자리가 없다(프리셋이 정한다) — 별색 대비는 서버가 먹색으로 대신한다.
     **이 탭이 내보내는 키만** 본다: 공통의 대비가 모자라다고 포트폴리오 반영까지 잠그면, 이유 문구는
     공통 탭에만 있어 왜 잠겼는지 알 길이 없었다(반박 리뷰 N2) */
  const bad = (tabKeys.includes('theme') || tabKeys.includes('header')) && (ci < INK_MIN || hc < INK_MIN || bc < INK_MIN)

  const tabDef = TABS.find((t) => t.key === tab)
  const here = { ...tabDef, path: previewPath }
  const setHead = (patch) => set(tab, { head: { ...conf[tab].head, ...patch } })
  /**
   * 상세 손잡이를 만지면 **상세를 연다.** 포트폴리오 미리보기는 목록이라 상단 여백·상하 간격이
   * 보일 곳이 없다 — 설정은 먹는데 안 보이는 것은 고장과 구별이 안 된다(타이틀 사이즈 때와 같은 함정).
   * 팝업이면 첫 작업의 팝업을, 페이지 이동이면 첫 작업 페이지를 연다. 이미 상세면 그대로 둔다.
   */
  const showDetail = () => {
    const win = frame.current?.contentWindow
    const doc = frame.current?.contentDocument
    if (!win || !doc) return
    if (/\/portfolio\/[^/]+\/?$/.test(win.location.pathname) || doc.querySelector('.pf-pop:target')) return
    const href = doc.querySelector('.w-card')?.getAttribute('href')
    if (!href) return
    if (href.startsWith('#')) win.location.hash = href.slice(1)
    else win.location.href = href
  }
  const setFont = (patch) => set(tab, { font: { ...conf[tab].font, ...patch } })

  /** 지금 탭에서 **바뀐 키만** 사이트로 내보낸다 — 같은 값의 판을 쌓지 않는다 */
  const changed = here.keys.filter((k) => JSON.stringify(conf[k]) !== saved.current[k])
  const apply = async () => {
    setErr(''); setBusy('apply')
    const sent = []
    try {
      for (const key of changed) {
        const d = await api('/settings', { method: 'POST', body: JSON.stringify({
          /**
           * `also` 에 **같이 반영하는 값 셋을 다 싣는다.** 서버의 대비 검사는 「테마 + 머리줄 + 푸터」를
           * 합쳐서 보는데, 하나라도 빠지면 그 자리에 **저장된 옛 값**이 들어가 앉는다 —
           * 푸터 색을 한 번이라도 정한 사이트에서 테마를 바꾸면 옛 푸터와 부딪혀 400 이 나고,
           * 첫 키에서 멈추므로 **아무것도 안 나간다**(반박 리뷰 H1). 미리보기는 통과하니
           * 화면에는 멀쩡히 보이면서 반영만 막히는, 까닭을 알 수 없는 막다른 길이 된다.
           */
          key, value: conf[key], also: { theme: conf.theme, header: conf.header, footer: conf.footer },
        }) })
        /* 서버가 **다듬은 값**으로 되받는다 — 별색이 먹으로 바뀌거나 빈 이름이 기본으로 채워지면,
           받지 않은 채로는 반영 단추가 다시 켜지고 누를 때마다 같은 판이 쌓였다(리뷰 n4) */
        if (d.value !== undefined) setConf((c) => ({ ...c, [key]: d.value }))
        saved.current[key] = JSON.stringify(d.value ?? conf[key])
        /* 작업물 목록의 「지금 나갑니다/안 나갑니다」는 **나간 값**을 따른다 —
           고르기만 한 값으로 말하면 거짓이 된다 */
        if (key === 'portfolio') onWorks?.((d.value ?? conf.portfolio)?.mode === 'template')
        sent.push(key)
        if (d?.bakeError) throw new Error('저장은 됐지만 화면을 굽지 못했습니다: ' + d.bakeError)
      }
      setBust((n) => n + 1)
      say(sent.length ? '적용 되었습니다.' : '바뀐 것이 없습니다')
    } catch (e) { fail(e) } finally {
      /* 중간에 실패해도 **이미 나간 키**는 되돌릴 수 있어야 한다 */
      if (sent.length) setBatch((b) => ({ ...b, [tab]: sent }))
      setBusy('')
    }
  }

  /**
   * 되돌리기 — **마지막 반영에 들어간 키만.** 한 키가 「이전 판이 없다」면 그 키만 건너뛴다 —
   * 멈추면 반쯤 되돌아간 사이트가 남는다(리뷰 M4-A). 한 번 되돌리면 단추는 사라진다.
   */
  const undoKeys = batch[tab] || []

  /* 직접 디자인이 지금 싣는 파일 — 안내 상자가 이 경로를 그대로 보여 준다(굽기 `fragmentPath` 와 같은 규칙) */
  const sample = code ? (PAGE_SAMPLES[tab] || []).find((x) => x.value === conf[tab].source) : null
  const srcRel = !code ? '' : sample ? `sample-pages/${sample.value}.html` : `pages/${tab}.html`
  const sampleNo = sample ? PAGE_SAMPLES[tab].indexOf(sample) + 1 : 0
  const copyCmd = sample ? `cp ${srcRel} pages/${tab}.html` : ''
  const undo = async () => {
    setErr(''); setBusy('undo')
    const skipped = []
    try {
      /* 나중에 반영한 것부터 되돌린다 — 테마를 먼저 되돌리면 아직 안 되돌린 검은 헤더와 부딪혀
         못 읽는 조합이 잠깐이라도 공개면에 나간다. 서버도 그 조합을 거절한다(반박 리뷰 N1) */
      for (const key of [...undoKeys].reverse()) {
        try {
          const d = await api('/settings/undo', { method: 'POST', body: JSON.stringify({ key }) })
          setConf((c) => ({ ...c, [key]: d.value }))
          saved.current[key] = JSON.stringify(d.value)
          if (key === 'portfolio') onWorks?.(d.value?.mode === 'template')
        } catch (e) {
          if (/이전 판이 없습니다/.test(e.message || '')) { skipped.push(key); continue }
          throw e
        }
      }
      setBatch((b) => ({ ...b, [tab]: [] }))
      editor.current?.api.resetHistory?.()
      setBust((n) => n + 1)
      say(skipped.length === undoKeys.length ? '되돌릴 이전 판이 없습니다' : '초기화 되었습니다.')
    } catch (e) { fail(e) } finally { setBusy('') }
  }

  return (
    <div className="lk">
      <div className="lkMain">
        <section className="lkPanel">
          <div className="tabs" role="tablist" aria-label="어느 화면">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                      onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>

          {err && <p className="err">{err}</p>}


          {/* ════ 공통 ════ 세 화면 전부에 걸리는 것.
               순서는 **화면의 순서**를 따른다 — 위에 공통헤더, 그 아래 본문콘텐츠.
               색·글꼴을 먼저 두었더니 고치는 순서와 보이는 순서가 뒤집혀 있었다(2026-09-16 QA). */}
          {tab === 'common' && (<>
            {/* 공통 탭의 값은 **굽기가 만드는 화면**에만 걸린다 — 직접 디자인 화면은
                 제 `site.css` 를 쓰므로, 여기서 고른 색·머리줄이 거기엔 안 간다.
                 맨 위에 적어 두지 않으면 「고쳤는데 안 바뀐다」로 읽힌다 */}
            <p className="lkHint band lkLead">
              메인/포트폴리오 페이지를 <b>직접 디자인</b> 하실 경우,
              해당 공통 적용 내용은 <b>블로그</b>에만 적용됩니다.
            </p>
            {/**
             * 공통은 **세 갈래**다 — 메뉴 · 헤더 · 콘텐츠. 한 장에 이어 붙였더니 어디서
             * 무엇을 고치는지 안 보였다(2026-09-18 사용자 지시).
             *
             * ⚠ `tab` 에 섞지 않는다: `bad`·`changed`·`undoKeys`·미리보기 창의 `key` 가
             * 전부 1차원 `tab` 에 묶여 있고 `TABS.find` 가 못 찾으면 그 자리에서 터진다.
             * 세 갈래가 만지는 키는 여전히 `theme`·`header` 둘뿐이라 저 셈들은 그대로 맞는다.
             */}
            <div className="lkSub" role="tablist" aria-label="공통 설정">
              {COMMON_SUBS.map((s) => (
                <button key={s.key} type="button" role="tab" aria-selected={sub === s.key}
                        onClick={() => setSub(s.key)}>{s.label}</button>
              ))}
            </div>
            {/* 갈피 이름이 곧 머리글이다 — 여기에 `h3` 를 또 두면 「메뉴」 안에 「메뉴 스타일」이
                 한 번 더 적힌다. 안쪽 구분은 `h4` 가 맡는다(원래 쓰던 그대로) */}
            {sub === 'head' && (<>
            <label className="lkField">
              <span>제목</span>
              <input type="text" maxLength={40} value={conf.header.title}
                     placeholder="ex) 사이트 이름"
                     onChange={(e) => setHeader({ title: e.target.value })} />
            </label>

            <h4>제목 정렬</h4>
            <Pick list={ALIGNS} value={conf.header.align} onPick={(v) => setHeader({ align: v })} />

            {/* 제목이 아니라 **헤더 띠**의 폭이다 — 나가는 것이 `s-w-narrow|s-w-wide` 다 */}
            <h4>헤더 넓이</h4>
            <Pick list={HEAD_WIDTHS} value={conf.header.width} onPick={(v) => setHeader({ width: v })} two />

            {/* 띠의 높이 — **여백만** 늘어난다(글자 크기는 그대로).
                 범위는 어휘(`HEAD_H`)와 같다: 여기서만 넓히면 서버가 거절해 저장이 400 으로 튕긴다.
                 아래쪽 48 은 햄버거 34px 이 정한 하한이다.
                 ⚠ `shape` 에 안 넣는다 — CSS 변수라 즉시 반영으로 충분하고, 넣으면 끌 때마다 굽는다 */}
            <h4>헤더 높이</h4>
            <label className="lkSlide">
              <span>높이 <b>{conf.header.height}px</b></span>
              <input type="range" min={HEAD_H.min} max={HEAD_H.max} step={HEAD_H.step}
                     value={conf.header.height}
                     onChange={(e) => setHeader({ height: +e.target.value })} />
            </label>

            {/* 글자 크기 — **한 숫자가 셋을 같이** 움직인다(사이트 이름 · 머리줄 링크 · 서랍 링크).
                 백분율 정수로 센다: 이 레포의 손잡이 값은 전부 정수라(`pickNum` 이 반올림) 1.3 을
                 저장하면 1 로 깎여 조용히 안 먹는다. 굽기가 100 으로 나눠 `--hd-size` 를 낸다.
                 ⚠ 높이와 마찬가지로 `shape` 에 안 넣는다 — 끌 때마다 다시 구우면 안 된다 */}
            <h4>헤더 글자 크기</h4>
            <label className="lkSlide">
              <span>크기 <b>{conf.header.size}%</b></span>
              <input type="range" min={HEAD_SCALE.min} max={HEAD_SCALE.max} step={HEAD_SCALE.step}
                     value={conf.header.size}
                     onChange={(e) => setHeader({ size: +e.target.value })} />
            </label>

            <div className="lkRow">
              {/* 비어 있으면 본문 테마 색을 **보여 주기만** 한다 — 만지는 순간 그 색으로 고정된다 */}
              {[['bg', '헤더배경', hdBg], ['color', '헤더폰트색', hdFg]].map(([k, label, shown]) => (
                <ColorField key={k} id={`h-${k}`} label={label} value={conf.header[k]} shown={shown}
                            applied={appliedOf('header', [k])} followLabel="본문 색 따르기"
                            onPick={(v) => setHeader({ [k]: v })} />
              ))}
              <FontPick label="헤더글꼴" value={conf.header.font} onPick={(v) => setHeader({ font: v })} />
            </div>
            {hc < INK_MIN && (
              <p className="lkHint bad">공통헤더 글자 대비 {hc.toFixed(1)}:1 — 이대로는 반영되지 않습니다(기준 {INK_MIN})</p>
            )}
            </>)}

            {/* 머리줄의 **생김새**(제목·폭·색)와 **메뉴**는 고치는 결이 다르다 — 갈피를 가른다 */}
            {sub === 'menu' && (<>
            <h4>메뉴 위치</h4>
            <Pick list={MENU_PLACES} value={conf.header.menu} onPick={(v) => setHeader({ menu: v })} two />
            {conf.header.menu === 'sidebar' && (() => {
              const sb = conf.header.sidebar
              const putSb = (patch) => setHeader({ sidebar: { ...sb, ...patch } })
              return (<>
                <h4>사이드바 갈래</h4>
                <Pick list={SIDEBARS} value={sb.kind} onPick={(v) => putSb({ kind: v })} />
                {/* 「다운슬라이드」는 화면을 통째로 덮으므로 **정할 넓이가 없다** —
                     먹지도 않는 손잡이를 열어 두면 고장과 구별이 안 된다(2026-09-18 사용자 지적) */}
                {sb.kind !== 'center' && (
                  <label className="lkSlide">
                    <span>사이드바 넓이 <b>{sb.width}px</b></span>
                    <input type="range" min={DRAWER_W.min} max={DRAWER_W.max} step={DRAWER_W.step}
                           value={sb.width} onChange={(e) => putSb({ width: +e.target.value })} />
                  </label>
                )}
                <div className="lkRow">
                  {/* 배경만 바꾸면 검은 글씨가 묻힌다 — **글자색을 짝으로** 둔다 */}
                  {[['bg', '사이드바 배경', sb.bg || hdBg], ['color', '사이드바 글자색', sb.color || hdFg]]
                    .map(([k, label, shown]) => (
                    <ColorField key={k} id={`sb-${k}`} label={label} value={sb[k]} shown={shown}
                                applied={appliedOf('header', ['sidebar', k])} followLabel="헤더 색 따르기"
                                onPick={(v) => putSb({ [k]: v })} />
                  ))}
                </div>
              </>)
            })()}

            {/**
              * 메뉴 한 줄의 생김새 — **자리마다 따로**다(2026-09-18 사용자 결정).
              * 지금 고른 자리의 것만 낸다: 머리줄이면 머리줄 값, 사이드바면 사이드바 값.
              * 둘을 한 화면에 같이 내면 어느 쪽을 만지는지 헷갈린다.
              *
              * 모서리는 **윤곽이 있을 때만** 연다 — 테두리도 배경도 없으면 아무리 둥글려도
              * 눈에 안 보이고, 안 보이는 것을 만지게 두면 고장 난 줄 안다(2026-09-16 결정).
              * 값은 지우지 않는다: 다시 윤곽이 생기면 전에 고른 모서리가 살아난다.
              */}
            {(() => {
              const side = conf.header.menu === 'sidebar' ? 'drawer' : 'nav'
              const it = conf.header[side]
              const list = side === 'drawer' ? DRAWER_STYLES : NAV_STYLES
              const put = (patch) => setHeader({ [side]: { ...it, ...patch } })
              const noEdge = it.border < 1 && !it.bg
              return (<>
                <h4>메뉴 아이템 스타일</h4>
                <Pick list={list} value={it.style} onPick={(v) => put({ style: v })} />

                <h4>세부 조정</h4>
                <div className="lkRow">
                  {/* 비어 있으면 따르는 색을 **보여 주기만** 한다 — 만지는 순간 그 색으로 고정된다 */}
                  {[['color', '글자색', it.color || hdFg, '헤더 색 따르기'],
                    ['bg', '배경색', it.bg || hdBg, '배경 없애기']].map(([k, label, shown, back]) => (
                    <ColorField key={k} id={`${side}-${k}`} label={label} value={it[k]} shown={shown}
                                applied={appliedOf('header', [side, k])} followLabel={back}
                                onPick={(v) => put({ [k]: v })} />
                  ))}
                </div>
                {bc < INK_MIN && hc >= INK_MIN && (
                  <p className="lkHint bad">메뉴 글자 대비 {bc.toFixed(1)}:1 — 이대로는 반영되지 않습니다(기준 {INK_MIN})</p>
                )}
                <label className="lkSlide">
                  <span>테두리 <b>{it.border}px</b></span>
                  <input type="range" min="0" max="3" value={it.border}
                         onChange={(e) => put({ border: +e.target.value })} />
                </label>
                <label className={'lkSlide' + (noEdge ? ' is-off' : '')}>
                  <span>모서리 <b>{it.radius}px</b></span>
                  <input type="range" min="0" max="24" value={it.radius} disabled={noEdge}
                         onChange={(e) => put({ radius: +e.target.value })} />
                </label>
              </>)
            })()}

            <h4>메뉴 설정</h4>
            {/* 아이콘은 **사이드바의 「아이콘」 벌**에서만 화면에 나간다(굽기의 `withIcon`).
                 머리줄 벌에는 아이콘이 없다 — `NAV_STYLES` 여섯 중 아무도 도형을 안 쓴다 */}
            {[...NAV_LINKS]
              .sort((p, q) => conf.header.links[p.key].order - conf.header.links[q.key].order)
              .map((l, i, seq) => (
              <Fragment key={l.key}>
              <div className="lkLink">
                <EyeToggle shown={conf.header.links[l.key].show} what={`${l.label} 메뉴`}
                           onToggle={() => setLink(l.key, { show: !conf.header.links[l.key].show })} />
                <input type="text" maxLength={20} value={conf.header.links[l.key].label}
                       disabled={!conf.header.links[l.key].show}
                       aria-label={`${l.label} 링크 이름`}
                       onChange={(e) => setLink(l.key, { label: e.target.value })} />
                {/* 아이콘 단추 — **「아이콘」 벌일 때만** 보인다. 다른 벌에서는 굽기가 도형을
                     안 내므로 골라 봐야 아무 일도 안 일어난다(고르개가 거짓말을 하면 안 된다) */}
                {iconMode && (
                  <button type="button" className="lkIcoBtn"
                          aria-expanded={iconFor === l.key}
                          aria-label={`${l.label} 아이콘`}
                          title={iconLabel(conf.header.links[l.key].icon)}
                          onClick={() => setIconFor(iconFor === l.key ? '' : l.key)}>
                    {conf.header.links[l.key].icon
                      ? <MenuIcon value={conf.header.links[l.key].icon} />
                      : <span className="lkIcoNone">없음</span>}
                  </button>
                )}
                {/* 차례 — 「목록」의 ↑↓ 와 **같은 부품**이다(생김새가 갈리면 사용자가 지적한다).
                     끈 줄도 옮길 수 있다 — 막으면 숨긴 항목을 영영 못 움직인다 */}
                <button type="button" disabled={i === 0} aria-label={`${l.label} 위로`}
                        onClick={() => moveLink(l.key, -1)}>↑</button>
                <button type="button" disabled={i === seq.length - 1}
                        aria-label={`${l.label} 아래로`}
                        onClick={() => moveLink(l.key, 1)}>↓</button>
              </div>
              {/* 어느 페이지로 가는가 — 이름은 바꿀 수 있어도 **주소는 정해져 있다.**
                   안 보이면 「블로그」를 「소식」으로 고친 사람이 어디로 가는지 알 수 없다
                   (2026-09-18 사용자 지적) */}
              <p className="lkLinkTo"><code>{l.href}</code></p>
              {iconMode && iconFor === l.key && (
                <div className="lkIcoPop">
                  {MENU_ICON_GROUPS.map((g) => (
                    <Fragment key={g}>
                      <h5>{g}</h5>
                      <div className="lkIcoGrid">
                        {MENU_ICONS.filter((i) => i.group === g).map((i) => (
                          <button key={i.value} type="button" title={i.label}
                                  aria-label={i.label}
                                  aria-pressed={conf.header.links[l.key].icon === i.value}
                                  onClick={() => { setLink(l.key, { icon: i.value }); setIconFor('') }}>
                            <MenuIcon value={i.value} />
                          </button>
                        ))}
                      </div>
                    </Fragment>
                  ))}
                  <button type="button" className="lkReset"
                          onClick={() => { setLink(l.key, { icon: '' }); setIconFor('') }}>아이콘 비우기</button>
                </div>
              )}
              </Fragment>
            ))}

            </>)}

            {sub === 'body' && (<>
            {/**
             * 본문 폭 — **사이트에 하나뿐인 숫자**다.
             *
             * 넷(공통헤더 띠·메인 콘텐츠 영역·블로그 목록·포트폴리오 목록)이 「본문 폭」을
             * 고르면 전부 이 값을 따른다. 예전에는 자리마다 따로여서 같은 이름이 1240·1200 을
             * 냈고, 그 숫자를 정하는 손잡이는 어디에도 없었다(2026-09-18 사용자 지시).
             *
             * ⚠ `shape` 에 넣지 않는다 — CSS 변수라 즉시 반영(`liveCss`)으로 충분하고,
             * 넣으면 미끄럼자를 한 칸 끌 때마다 사이트를 통째로 다시 굽는다.
             */}
            <h4>본문 폭</h4>
            <Pick list={WIDTHS} two value={conf.theme.width}
                  onPick={(v) => set('theme', { width: v })} />
            {/* 숫자는 「본문 폭」일 때만 뜻이 있다 — 화면 폭에는 정할 수치가 없다.
                 상한이 1800 이라 더 넓은 화면에서는 여백만 늘어난다: 거기까지 쓰려면
                 「화면 폭」이 답이다(2026-09-18 사용자 지적) */}
            {conf.theme.width === 'narrow' && (
              <label className="lkSlide">
                <span>폭 <b>{conf.theme.bodyWidth}px</b></span>
                <input type="range" min={BODY_W.min} max={BODY_W.max} step={BODY_W.step}
                       value={conf.theme.bodyWidth}
                       onChange={(e) => set('theme', { bodyWidth: +e.target.value })} />
              </label>
            )}
            <p className="lkHint">
              메인·포트폴리오·블로그가 모두 이 폭을 따릅니다. 상단 띠만 <b>공통 → 헤더</b>에서 따로 정합니다.
            </p>

            <h4>콘텐츠 색상</h4>
            <div className="lkChips">
              {/* ⚠ 프리셋이 정하는 것은 **색과 글꼴뿐**이다 — 본문 폭은 프리셋의 것이 아니므로
                     누를 때 남기고(`...c.theme` 먼저), 눌렸는지 볼 때도 프리셋이 가진 키만 견준다.
                     통째로 견주면 폭 하나 때문에 **어느 프리셋도 영영 안 눌린 것으로 보인다** */}
              {THEME_PRESETS.map((t) => (
                <button key={t.value} type="button" className="lkChip"
                        aria-pressed={Object.keys(t.theme).every((k) => t.theme[k] === conf.theme[k])}
                        onClick={() => setConf((c) => ({ ...c, theme: { ...c.theme, ...t.theme } }))}>
                  {/* 아이콘은 **이 프리셋이 실제로 바꾸는 두 색**만 보인다 — 콘텐츠 배경색 위에 콘텐츠폰트색.
                       별색 점을 찍었더니 화면 어디에도 안 보이는 색이라 거짓말이 됐다(2026-09-17 사용자 지적) */}
                  <span className="lkSwatch" aria-hidden="true"
                        style={{ background: t.theme.paper, color: t.theme.ink }}>가</span>{t.label}
                </button>
              ))}
            </div>
            <div className="lkRow">
              {/* 별색은 고르지 않는다(2026-09-16 사용자 결정) — 프리셋의 값을 그대로 쓴다.
                   링크 호버·포커스 테두리가 이 색이라 데이터에서는 빼지 않는다 */}
              {[['paper', '콘텐츠 배경색'], ['ink', '콘텐츠폰트색']].map(([k, label]) => (
                /* 따를 상위가 없다 — 이 둘은 늘 실제 색이라 「비우기」가 없다 */
                <ColorField key={k} id={`c-${k}`} label={label} value={conf.theme[k]} shown={conf.theme[k]}
                            applied={appliedOf('theme', [k])}
                            onPick={(v) => set('theme', { [k]: v })} />
              ))}
            </div>
            {ci < INK_MIN && (
              <p className="lkHint bad">콘텐츠 글자 대비 {ci.toFixed(1)}:1 — 이대로는 반영되지 않습니다(기준 {INK_MIN})</p>
            )}
            </>)}

            {/**
              * 푸터 — 화면 맨 아래의 푸터. **두 벌**이다: 메인은 연락이 목적지라 크고,
              * 포트폴리오·블로그는 다 보고 난 자리라 얇다(2026-09-18 사용자 결정).
              *
              * 판은 메인 콘텐츠 영역과 **같은 부품**(`.m-board`)이라 끌기·안내선·⌘Z 가 그대로 따라온다.
              * 손잡이(높이·간격·선·색)는 전부 CSS 변수라 **다시 굽지 않고** 창에 바로 먹는다(`paintFoot`).
              */}
            {sub === 'foot' && (() => {
              const fc = footerContrast(conf.theme, footSet)
              const lineShown = footSet.line.color || conf.theme.ink
              /**
               * **직접 디자인 화면에는 푸터가 없다.** 조각(`pages/*.html`)이 제 푸터를 들고 오므로
               * 굽기가 위에 또 얹지 않는다 — 여기서 아무리 고쳐도 그 화면은 안 바뀐다.
               * 막지는 않는다(템플릿으로 바꾸면 그대로 살아난다). 대신 **보고 있는 화면에서**
               * 왜 안 바뀌는지 그 자리에서 말해 준다.
               */
              const codeAt = footKind === 'main' ? conf.main.mode === 'code'
                : previewPath === '/portfolio/' && conf.portfolio.mode === 'code'
              return (<>
                {/* 어느 푸터를 고치는가 — 고르면 **미리보기도 그 화면으로 간다**(둘은 늘 같이 움직인다) */}
                <h4>공통 푸터</h4>
                <Pick list={FOOT_KINDS} two value={footKind}
                      onPick={(v) => setCommonPath(FOOT_KINDS.find((k) => k.value === v)?.path || '/')} />

                <h4>크기</h4>
                {FOOT_KNOBS.map((k) => {
                  const now = k.key === 'lineW' ? footSet.line.width : footSet[k.key]
                  return (
                    <label key={k.key} className="lkSlide">
                      <span>{k.label} <b>{now}{k.unit}</b></span>
                      <input type="range" min={k.min} max={k.max} step={k.step} value={now}
                             onChange={(e) => {
                               const v = +e.target.value
                               setFoot(k.key === 'lineW' ? { line: { ...footSet.line, width: v } } : { [k.key]: v })
                             }} />
                    </label>
                  )
                })}

                <h4>색</h4>
                <div className="lkRow">
                  {/* 셋 다 비우면 본문 테마를 따른다 — 푸터만 어둡게 뒤집는 것이 흔한 판짜기라 열어 둔다 */}
                  <ColorField id="foot-bg" label="배경색" value={footSet.bg} shown={footSet.bg || conf.theme.paper}
                              applied={appliedOf('footer', [footKind, 'bg'])} followLabel="본문 색 따르기"
                              onPick={(v) => setFoot({ bg: v })} />
                  <ColorField id="foot-fg" label="글자색" value={footSet.color} shown={footSet.color || conf.theme.ink}
                              applied={appliedOf('footer', [footKind, 'color'])} followLabel="본문 색 따르기"
                              onPick={(v) => setFoot({ color: v })} />
                </div>
                <div className="lkRow">
                  <ColorField id="foot-line" label="윗선 색" value={footSet.line.color} shown={lineShown}
                              applied={appliedOf('footer', [footKind, 'line', 'color'])} followLabel="본문 색 따르기"
                              onPick={(v) => setFoot({ line: { ...footSet.line, color: v } })} />
                </div>
                {fc < INK_MIN && (
                  <p className="lkHint bad">푸터 글자 대비 {fc.toFixed(1)}:1 — 이대로는 반영되지 않습니다(기준 {INK_MIN})</p>
                )}

                <h3>요소
                  <span className="lkAdd">
                    {/* 더하기는 **데이터** 일이라 편집기가 꺼져 있어도 된다 — 편집기가 꺼지는 흔한
                         까닭이 「창이 좁다」인데, 그때도 상자는 더할 수 있어야 한다 */}
                    <button type="button" title="글자 상자 더하기" aria-label="글자 상자 더하기"
                            onClick={() => addFoot(null)}>T</button>
                    {/* ⚠ `<select>` 를 안 쓴다 — macOS·윈도가 option 을 **OS 메뉴**로 그려 CSS 가
                         하나도 안 먹는다(글꼴 칸이 진작에 `Picker` 를 쓰는 것과 같은 까닭).
                         여기만 시커먼 시스템 메뉴가 뜨면 같은 화면에서 두 결이 선다 */}
                    <Picker title="아이콘 더하기" className="lkPicker lkAddIcon" width={200} value=""
                            items={SERVICE_ICONS.map((i) => ({ value: i.value, label: i.label }))}
                            onPick={(v) => addFoot(v)}>＋ 아이콘</Picker>
                  </span>
                </h3>
                <ul className="lkItems">
                  {footSet.items.map((it) => (
                    <li key={it.id} className={it.show ? undefined : 'is-off'} aria-current={sel?.key === it.id || undefined}>
                      <EyeToggle shown={it.show} what={footName(it)}
                                 onToggle={() => {
                                   if (sel?.key === it.id) setSel(null)
                                   setFootItem(it.id, { show: !it.show })
                                 }} />
                      {/* 글자 상자와 「직접 입력」 칩은 **이 자리에서** 고친다(로고는 글자가 없다).
                           고르는 것도 여기서 — 화면에 안 나오는 줄도 눌러야 주소·글자를 넣을 수 있다 */}
                      {it.kind !== 'icon' || it.service === 'link' ? (
                        <ItemName icon={it.kind === 'icon' ? '⊕' : 'T'} value={it.text || ''}
                                  placeholder={it.kind === 'icon' ? '무엇인지 (예: 개인 블로그)' : '빈 글자 — 화면에 안 나옵니다'}
                                  onFocus={() => pickFoot(it, true)}
                                  /* 지우면 **지워진 채로 둔다** — 줄은 목록에 남아 다시 칠 수 있고,
                                       화면에 안 나간다는 것은 옆의 「글자 없음」이 말한다 */
                                  onCommit={(v) => setFootItem(it.id, { text: v })} />
                      ) : (
                        <button type="button" className="lkItemName" disabled={!it.show}
                                onClick={() => pickFoot(it)}>
                          <i aria-hidden="true"><svg viewBox="0 0 24 24"><path d={ICON_OF[it.service] || ''} /></svg></i>
                          {footName(it)}
                        </button>
                      )}
                      {/* 굽기가 안 그리는 줄 — 까닭을 그 자리에 적는다(아이콘은 갈 곳, 글자는 글자) */}
                      {it.kind === 'icon' && !footHref(it) && <em className="lkItemWhy">주소 없음</em>}
                      {it.kind !== 'icon' && !footShown(it) && <em className="lkItemWhy">글자 없음</em>}
                      <button type="button" className="lkX" title="빼기" aria-label={`${footName(it)} 빼기`}
                              onClick={() => dropFoot(it.id)}>×</button>
                    </li>
                  ))}
                  {!footSet.items.length && (
                    <li className="lkEmpty">푸터가 비어 있어 화면에 안 나옵니다. 위 <b>T</b> 로 글자를, <b>＋ 아이콘</b>으로 링크를 더하세요.</li>
                  )}
                </ul>
                {/* 판 밖으로 끌려 나간 상자 — 끌기는 푸터 높이를 넘어설 수 있다(높이는 손잡이로 키우는 값이라
                     막지 않는다). 대신 **안 보이는 까닭**을 그 자리에서 말해 준다 */}
                {(() => {
                  /* 상자 높이까지 셈한다 — 굽기의 `hOf` 와 같은 값이다(글자는 칸의 한 줄, 로고는 제 크기,
                     「직접 입력」 칩은 글자가 정한 40). y 만 보면 **밑이 잘린 상자**를 놓친다 */
                  const boxH = (it) => (it.kind === 'icon'
                    ? (it.service === 'link' ? 40 : Math.round(it.w || 52))
                    : Math.round((FOOT_SIZES.find((z) => z.value === it.size)?.u || 18.4) * 1.7))
                  const out = footSet.items.filter((it) => it.show && it.y + boxH(it) > footSet.height)
                  return out.length ? (
                    <p className="lkHint warn">
                      <b>{out.map(footName).join(' · ')}</b> 이(가) 푸터 높이(<b>{footSet.height}px</b>) 밖으로
                      나가 잘립니다 — 높이를 키우거나 위로 옮기세요.
                    </p>
                  ) : null
                })()}
                {codeAt && (
                  <p className="lkHint warn">
                    {footKind === 'main' ? '메인이' : '포트폴리오가'} 「직접 디자인」이라 그 화면은 조각이 제 푸터를 갖습니다 —
                    여기서 고친 것은 {footKind === 'main' ? '템플릿으로 바꾸면' : '블로그에서'} 나갑니다.
                  </p>
                )}
                {!codeAt && editorOff === 'narrow' && (
                  <p className="lkHint warn">창이 좁아 푸터가 폰처럼 쌓인 모습입니다 — 넓게 펴면 끌어서 옮길 수 있습니다</p>
                )}
                {/* 선택한 요소 — 무대와 **같은 판**을 쓴다 */}
                {/* ⚠ `editorOff` 여도 **판은 연다.** 화면에 안 나오는 요소(주소 없는 아이콘·빈 글자)는
                     편집기가 못 잡는데, 고쳐야 나타난다 — 그때는 자리 숫자도 데이터로 고친다(`sel.off`) */}
                {sel && footItem && (
                  <SelPanel sel={sel} item={footItem} defaults={footText} sizes={FOOT_SIZES} icons={SERVICE_ICONS} say={say}
                            href={footHref(footItem)} off={sel.off || !!editorOff}
                            applied={(appliedOf('footer', [footKind, 'items']) || [])
                              .find((x) => x.id === footItem.id)?.color}
                            onPatch={(patch) => setFootItem(footItem.id, footPatch(footItem, patch))}
                            onAlign={(how) => editor.current?.api.align?.(sel.key, how)}
                            onNum={(k, n) => (sel.off || editorOff
                              ? setFootItem(footItem.id, { [k]: n })
                              : editor.current?.api.set?.(sel.key, { [k]: n }, true))}
                            onClose={() => { editor.current?.api.select?.(null); setSel(null) }} />
                )}
              </>)
            })()}
          </>)}

          {/* ════ 화면별 ════ */}
          {/* 선택한 요소 — 피그마의 오른쪽 칸처럼 숫자로. 패널을 내려도 늘 위에 붙어 있다 */}
          {tab === 'main' && sel && selItem && !code && !editorOff && (
            <SelPanel sel={sel} item={selItem} defaults={stageText} sizes={ITEM_SIZES} icons={SERVICE_ICONS} say={say}
                      applied={(appliedOf('main', ['items']) || []).find((x) => x.id === selItem.id)?.color}
                      onPatch={(patch) => setItem(selItem.id, patch)}
                      onAlign={(how) => editor.current?.api.align?.(sel.key, how)}
                      onNum={(k, n) => editor.current?.api.set?.(sel.key, { [k]: n }, true)}
                      onClose={() => editor.current?.api.select?.(null)} />
          )}
          {tab !== 'common' && (<>
          {/* 공통헤더 — **세 탭 모두 맨 위의 같은 자리**다. 화면마다 자리가 달라지면
               같은 스위치를 탭마다 다시 찾아야 한다.
               직접 디자인에서도 살아 있다: 조각은 컨텐츠 영역만 갖고 머리줄은 굽기가 위에 얹는다. */}
          {/* 탭 바로 밑의 머리칸 — 스위치와 그 스위치가 낳은 귀띔이 **한 덩이**다.
               한 덩이여야 아래 묶음과의 사이 여백을 한 곳에서 잡는다(귀띔이 떠도 안 흔들린다) */}
          <div className="lkTop">
            <h3 className="lkGroup lkFirst">헤더</h3>
            <div className="lkLink lkChrome">
              <EyeToggle shown={conf[tab].chrome} what="공통헤더"
                         onToggle={() => set(tab, { chrome: !conf[tab].chrome })} />
              <span>사용유무</span>
            </div>
            {/* 막지 않고 알린다 — 스위치는 늘 먹고, 무엇을 하면 되는지만 일러 준다 */}
            {warn.map((w) => <p key={w} className="lkHint warn">{w}</p>)}
          </div>

          {/* ── 이 화면을 누가 만드는가 ─────────────────────────────────
               블로그에는 없다: 글이 DB 에서 오므로 목록을 코드가 꽂아야 한다 */}
          {tab !== 'blog' && (<>
            <h3 className="lkGroup">만드는 방법</h3>
            <div className="lkModes" role="radiogroup" aria-label="만드는 방법">
              {PAGE_MODES.map((m) => (
                <button key={m.value} type="button" role="radio"
                        aria-checked={conf[tab].mode === m.value}
                        onClick={() => pickMode(m.value)}>
                  <b>{m.label}</b><span>{m.hint}</span>
                </button>
              ))}
            </div>
          </>)}

          {/* ── 어느 파일을 실을까 ── 고르면 미리보기가 즉시 그 파일로, 「사이트에 적용」이 곧 실제 적용이다.
               파일은 **안 쓴다** — 설정에 이름만 남긴다(`PAGE_SAMPLES` 머리말: 운영 체크아웃을 더럽히지 않으려고) */}
          {code && (<>
            <h3 className="lkGroup">사용할 파일</h3>
            <div className="lkPick lkShapes lkSources">
              <button type="button" aria-pressed={conf[tab].source === PAGE_SOURCE_MINE}
                      onClick={() => set(tab, { source: PAGE_SOURCE_MINE })}>
                <Shape cells={MINE_ICON} />
                <b>내 파일</b><em>pages/{tab}.html — 소스코드에서 직접 고친 화면</em>
              </button>
              {PAGE_SAMPLES[tab].map((o, i) => (
                <button key={o.value} type="button" aria-pressed={conf[tab].source === o.value}
                        onClick={() => set(tab, { source: o.value })}>
                  <Shape cells={o.icon} />
                  <b>샘플 {i + 1} · {o.label}</b><em>{o.hint}</em>
                </button>
              ))}
            </div>
          </>)}

          {code && sample && (
            <div className="lkCode">
              <p>지금 <b>샘플 {sampleNo} · {sample.label}</b>을 쓰고 있습니다. 「사이트에 적용」을 누르면 이 샘플이 그대로 나갑니다.</p>
              <dl>
                <dt>{here.label} 소스코드</dt>
                <dd><code>{srcRel}</code>
                  <em>샘플 파일입니다. 레포를 업데이트하면 바뀔 수 있으니 직접 고치지 말고 복사해서 쓰세요.</em></dd>
                <dt>스타일</dt>
                <dd><em>샘플은 스타일을 파일 안 <code>&lt;style&gt;</code> 에 담고 있어, 파일 하나만 옮기면 모양이 따라옵니다.</em></dd>
                <dt>고쳐 쓰기</dt>
                <dd>
                  <span className="lkCmd">
                    <code>{copyCmd}</code>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(copyCmd).then(() => say('명령을 복사했습니다.'), () => {})}>복사</button>
                  </span>
                  <em>로컬에서 복사해 고친 뒤 위 「내 파일」을 고르고 커밋·배포하세요.</em></dd>
              </dl>
              {tab === 'portfolio' && (
                <p className="lkHint">직접 디자인인 동안에는 올린 작업물이 사이트에 나가지 않습니다(작업 상세 페이지도 만들지 않습니다).</p>
              )}
            </div>
          )}

          {code && !sample && (
            <div className="lkCode">
              <p>이 화면의 본문은 템플릿을 사용하지 않습니다. 아래의 파일 목록을 참고하여 수정하세요.</p>
              <dl>
                <dt>{here.label} 소스코드</dt>
                <dd><code>pages/{tab === 'main' ? 'main' : 'portfolio'}.html</code>
                  <em>{tab === 'main'
                    ? '화면에 보이는 내용입니다. <main> 부터 쓰시면 됩니다.'
                    : '화면에 보이는 내용입니다. 머리줄과 푸터까지 이 파일에 들어 있습니다.'}</em></dd>
                <dt>스타일</dt>
                <dd><code>public/assets/site.css</code>
                  <em>색·글꼴·여백을 정합니다. {tab === 'main' ? '.m-' : '.p-'} 로 시작하는 규칙이 이 화면의 것입니다.</em></dd>
                <dt>JS</dt>
                <dd><code>pages/{tab === 'main' ? 'main' : 'portfolio'}.html</code> 에 <code>&lt;script&gt;</code> 인라인 태그 형태로 넣으시면 됩니다.
                  <em>방문자가 그대로 내려받으니 꼭 필요한 것만 넣으세요. 크기는 <code>node tools/check-public.mjs</code> 로 확인하실 수 있습니다.</em></dd>
              </dl>
              <p className="lkHint">파일을 비우면 아무것도 없는 빈 화면이 나옵니다. 오른쪽 미리보기가 그 결과입니다.</p>
            </div>
          )}
          {/* 직접 디자인이면 템플릿 손잡이는 **통째로 숨긴다** — 눌러도 안 나가는 단추를 열어 두면
               「반영했는데 안 바뀐다」가 되고, 잠가만 두면 고를 수 없는 것 때문에 스크롤만 길어진다.
               값은 conf 에 그대로 있어 템플릿으로 돌리면 고른 그대로 다시 보인다 */}
          {!code && (
          <fieldset className="lkFs">
            {/* ⚠ 목록 폭은 여기 없다 — 폭은 **사이트에 하나**뿐이라 공통 → 콘텐츠가 정한다
                 (2026-09-18 사용자 지시). 머리줄만 제 스위치를 갖는다 */}
            {/* 목록 머리 — 크기·정렬·편수까지 **이 화면의 것**이다 */}
            {(tab === 'blog' || tab === 'portfolio') && (<>
              <h3>타이틀</h3>
              <div className="lkLink">
                <EyeToggle shown={conf[tab].head.show} what="타이틀"
                           onToggle={() => setHead({ show: !conf[tab].head.show })} />
                <input type="text" maxLength={20} value={conf[tab].head.name}
                       disabled={!conf[tab].head.show} aria-label="타이틀 이름"
                       onChange={(e) => setHead({ name: e.target.value })} />
              </div>
              {/* 타이틀을 숨기면 사이즈·정렬·갯수는 뜻이 없고, 대신 **공통헤더와 콘텐츠 사이**를 정한다.
                   보일 때는 타이틀 제 여백이 있어 이 값을 더하면 두 번 띄운다 */}
              {!conf[tab].head.show && (
                <label className="lkSlide">
                  <span>상단 여백 <b>{conf[tab].head.gap}px</b></span>
                  <input type="range" min="0" max="160" step="4" value={conf[tab].head.gap}
                         onChange={(e) => setHead({ gap: +e.target.value })} />
                </label>
              )}
              {conf[tab].head.show && (<>
                {/* 갯수는 타이틀에 붙는 것이라 **타이틀 바로 밑**에 둔다(2026-09-17 사용자 지시) */}
                <div className="lkLink lkEyeRow">
                  <EyeToggle shown={conf[tab].head.count} what="콘텐츠 갯수"
                             onToggle={() => setHead({ count: !conf[tab].head.count })} />
                  <span>콘텐츠 갯수 표시</span>
                </div>
                {/* 사이즈는 **미끄럼자** — 다른 수치 손잡이와 같은 모양으로(2026-09-17 사용자 지시).
                     세 칸(작게·보통·크게)이라 눈금은 셋이다 */}
                <label className="lkSlide">
                  <span>타이틀 사이즈 <b>{HEAD_SIZES.find((z) => z.value === conf[tab].head.size)?.label}</b></span>
                  <input type="range" min="0" max={HEAD_SIZES.length - 1} step="1"
                         value={Math.max(0, HEAD_SIZES.findIndex((z) => z.value === conf[tab].head.size))}
                         onChange={(e) => setHead({ size: HEAD_SIZES[+e.target.value].value })} />
                </label>
                <h4>타이틀 정렬</h4>
                <Pick list={ALIGNS.slice(0, 2).map((a) => ({ ...a, hint: '', icon: null }))} value={conf[tab].head.align}
                      onPick={(v) => setHead({ align: v })} two />
              </>)}
            </>)}

            {/* 글꼴 — 「기본서체」면 사이트 기본 글꼴을 따른다.
                 공통헤더 글꼴과는 따로 간다. */}
            <>
              <h3>글꼴</h3>
              <div className="lkRow">
                {FONT_ROLES.map(({ key, label }) => (
                  <FontPick key={key} label={label} value={conf[tab].font[key]} onPick={(v) => setFont({ [key]: v })} />
                ))}
              </div>
            </>

            <h3>템플릿</h3>
            <div className="lkPick lkShapes">
              {TEMPLATES[tab].map((o) => (
                <button key={o.value} type="button"
                        aria-pressed={conf[tab].template === o.value}
                        /* 커스텀은 고르는 것이 아니라 **닿는 곳**이다 — 배치를 고치면 켜진다 */
                        disabled={o.value === 'custom' && conf[tab].template !== 'custom'}
                        onClick={() => {
                          /* 메인은 템플릿이 **시작 배치**다. 커스텀(= 배치를 손댄 상태)에서
                             다른 것을 누르면 무엇이 사라지는지 먼저 묻는다.
                             같은 템플릿을 다시 눌러도 — 처음 배치로 돌아가는 길이다 */
                          if (tab === 'main') {
                            /* 커스텀(= 배치를 손댄 상태)에서는 무엇이 사라지는지 먼저 묻는다.
                               같은 템플릿을 다시 눌러도 — 처음 배치로 돌아가는 길이다 */
                            if (conf.main.template === 'custom') setAsk(o.value)
                            else if (o.value !== conf.main.template) switchMain(o.value)
                            return
                          }
                          /**
                           * **손잡이도 그 템플릿의 값으로 되돌린다.**
                           *
                           * 템플릿만 갈면 앞서 고른 수치(단 수·비율·간격·여백)가 그대로 남아,
                           * 인스타그램을 골라도 베한스의 3단 4:3 간격 12px 로 그려진다 —
                           * 다 같은 마크업이라 **고른 티가 하나도 안 난다**(2026-09-16 QA).
                           * 고른 뒤에 손잡이를 다시 만지는 건 그대로 된다.
                           */
                          const next = { template: o.value }
                          if (o.knobs) next.knobs = { ...o.knobs, detailGap: conf[tab].knobs?.detailGap ?? 0, detailTop: conf[tab].knobs?.detailTop ?? 48 }
                          /* 블로그 템플릿은 **글꼴 짝**을 들고 온다 — 누르면 글꼴 칸도 그 짝으로.
                             같은 카드를 다시 누르면 짝으로 돌아간다. 고른 뒤 글꼴 칸을 만지는 건 그대로 된다 */
                          if (o.font) next.font = { display: o.font.display, body: o.font.body }
                          set(tab, next)
                        }}>
                  {o.icon && <Shape cells={o.icon} />}
                  <b>{o.label}</b><em>{o.hint}</em>
                </button>
              ))}
            </div>


            {tab === 'main' && ask && (
              <div className="lkAsk" role="alertdialog" aria-modal="true" aria-label="배치 되돌리기"
                   onClick={(e) => { if (e.target === e.currentTarget) setAsk(null) }}>
                <div>
                  <p><b>{MAIN_TEMPLATES.find((t) => t.value === ask)?.label}</b>의 처음 배치로 되돌립니다.
                    옮긴 자리·보이기·목록·사진은 사라지고, 고친 글자는 그대로 둡니다.
                    {' '}직접 더한 상자는 그대로 남습니다 — 그래서 되돌린 뒤에도 「커스텀」으로 표시됩니다.</p>
                  <div className="lkAskBtns">
                    <button type="button" onClick={() => setAsk(null)}>취소</button>
                    <button type="button" className="primary" onClick={() => switchMain(ask)}>되돌리고 바꾸기</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── 메인: 콘텐츠 영역 · 요소 · 목록 ──
                 요소는 미리보기에서 **끌어서 옮기고, 두 번 눌러 글자를 고친다.** 여기서는 더하고 빼고 고른다.
                 목록은 옮기지 않고 **차례와 넣을지 말지**만 정한다 */}
            {tab === 'main' && (<>
              {/* ── 손잡이는 **켜져 있는 자리만** 낸다 ──
                   값은 먹는데 화면이 안 바뀌는 칸은 고장과 구별이 안 된다. 어느 자리를
                   켜고 끌지는 맨 아래 「목록」이 정한다(2026-09-17 사용자 지시) */}
              {shownSec('stage') && (<>
                <h3>콘텐츠 영역</h3>
                {/* ⚠ 폭 고르개가 여기 없다 — 판은 사이트의 본문 폭을 그대로 따른다.
                     이 자리는 여백이 아니라 **좌표계**라, 폭이 바뀌면 높이도 글자도 같이 바뀐다
                     (`.m-board` 머리말) */}
                {/* 범위는 **어휘(`STAGE_H`)와 같다** — 좁게 두면 관리자가 서버가 거절하는 값을
                     만들 수 있고, 여기서만 넓히면 저장이 400 으로 튕긴다 */}
                <label className="lkSlide">
                  <span>높이 <b>{conf.main.stage.height}px</b></span>
                  <input type="range" min={STAGE_H.min} max={STAGE_H.max} step="10" value={conf.main.stage.height}
                         onChange={(e) => putStage(() => ({ height: +e.target.value }))} />
                </label>
                {/* 배경 그림 — 올린 사진이 콘텐츠 영역 바닥에 깔린다. 글자는 그 위에 흰색으로 선다.
                     ⚠ 머리글이 없어 **무슨 기능인지 이름이 없었다**(2026-09-18 사용자 지적).
                     빈 자리에 「아직 없습니다」만 있으면 「없다」는 사실만 말하고 **무엇에 쓰는지**를
                     안 말한다 — 안 채운 사람에게 필요한 것은 그 쪽이다 */}
                <h4>대표 이미지</h4>
                {/* 머리글이 이름을 맡았으므로 줄 앞의 「배경 그림」은 뺀다 — 한 줄에 이름이 둘이면
                     다른 것 둘로 읽힌다. 자리는 그대로고 설명이 그 자리에 선다 */}
                <div className="lkBg">
                  {conf.main.stage.bg
                    ? <span className="lkBgOn">
                        <img src={conf.main.stage.bg} alt="" />
                        <button type="button" onClick={() => putStage(() => ({ bg: '' }))}>빼기</button>
                      </span>
                    : <span className="lkBgOff">콘텐츠 배경 이미지로 사용됩니다.</span>}
                  <label className="lkBgPick">
                    {conf.main.stage.bg ? '바꾸기' : '사진 고르기'}
                    <input type="file" accept="image/*" onChange={(e) => pickBg(e.target.files?.[0])} />
                  </label>
                </div>
              </>)}

              {shownSec('shots') && (<>
                <h3>이미지 콘텐츠 영역</h3>
                {/* 세로로 잇는 자리는 **간격이 전부**다 — 붙이면 한 장처럼, 띄우면 낱장으로 읽힌다 */}
                {SHOT_KNOBS.map((k) => (
                  <label key={k.key} className="lkSlide">
                    <span>{k.label} <b>{conf.main.stage.shotKnobs[k.key]}{k.unit}</b></span>
                    <input type="range" min={k.min} max={k.max} value={conf.main.stage.shotKnobs[k.key]}
                           onChange={(e) => putStage((st) => ({
                             shotKnobs: { ...st.shotKnobs, [k.key]: +e.target.value },
                           }))} />
                  </label>
                ))}
              </>)}

              {shownSec('slides') && (<>
                <h3>슬라이드</h3>
                <label className="lkSlide">
                  <span>배너 높이 <b>{conf.main.stage.slideH}px</b></span>
                  <input type="range" min={STAGE_H.min} max={STAGE_H.max} step="10" value={conf.main.stage.slideH}
                         onChange={(e) => putStage(() => ({ slideH: +e.target.value }))} />
                </label>
              </>)}

              {/* ── 요소 = 글자 상자와 사진이 **한 목록**에 산다 ──
                   더하기 단추도 목록이 정한다: 꺼 둔 자리에 무언가를 더할 수 있으면,
                   더해 놓고도 화면에 왜 안 나오는지 알 길이 없다 */}
              <h3>요소
                {/* 더할 것이 하나도 없으면 **테두리만 남은 빈 상자**가 뜬다 — 고장으로 보인다 */}
                {(shownSec('stage') || SECTION_KINDS.some((k) => k.of && shownSec(k.key))) && (
                <span className="lkAdd">
                  {/* 더하기는 **데이터** 일이라 편집기가 꺼져 있어도 된다 — 편집기가 꺼지는 흔한
                       까닭이 「보일 것이 없다」인데, 그때야말로 상자를 더해야 한다 */}
                  {shownSec('stage') && (
                    <button type="button" title="글자 상자 더하기" aria-label="글자 상자 더하기"
                            onClick={() => addBox()}>T</button>
                  )}
                  {SECTION_KINDS.filter((k) => k.of && shownSec(k.key)).map((k) => {
                    const full = shotsOf(k.of).length >= SHOT_MAX[k.of]
                    return (
                      <label key={k.key} className={`lkAddPic${full || busy === 'shot' ? ' is-off' : ''}`}
                             title={full ? `${k.label} 사진은 ${SHOT_MAX[k.of]}장까지입니다`
                               : `${k.label} 사진 더하기 (${shotsOf(k.of).length}/${SHOT_MAX[k.of]})`}>
                        {busy === 'shot' ? <span className="lkSpin" aria-hidden="true" /> : <IconPic />}
                        <input type="file" accept={ACCEPT} multiple aria-label={`${k.label} 사진 더하기`}
                               disabled={full || busy === 'shot'}
                               /* 목록을 먼저 베껴 둔다 — 살아 있는 목록이라 칸을 비우면 같이 비워진다
                                    (`work.jsx` 의 같은 자리 머리말) */
                               onChange={(e) => { const files = [...e.target.files]; e.target.value = ''; addShots(k.of, files) }} />
                      </label>
                    )
                  })}
                </span>
                )}
              </h3>
              <ul className="lkItems">
                {/* 글자 상자는 콘텐츠 영역이 켜져 있을 때만 — 꺼 둔 자리의 것을 목록에 세우면
                     목록과 화면이 말없이 어긋난다. 데이터는 그대로 남아 다시 켜면 돌아온다 */}
                {shownSec('stage') && conf.main.items.map((it) => (
                  <li key={it.id} className={it.show ? undefined : 'is-off'} aria-current={sel?.key === it.id || undefined}>
                    <EyeToggle shown={it.show} what={boxName(it)}
                               onToggle={() => {
                                 if (sel?.key === it.id) setSel(null)
                                 setItem(it.id, { show: !it.show })
                               }} />
                    {/* 글자는 **이 자리에서** 고친다 — 목록에서 고르고 판으로 내려가 또 고치게 두지 않는다 */}
                    <ItemName icon="T" value={it.text || ''} placeholder="빈 글자 — 화면에 안 나옵니다"
                              onFocus={() => {
                                if (editorOff) return
                                editor.current?.api.select?.(it.id)
                              }}
                              onCommit={(v) => setItem(it.id, { text: v })} />
                    <button type="button" className="lkX" title="빼기" aria-label={`${boxName(it)} 빼기`}
                            onClick={() => dropBox(it.id)}>×</button>
                  </li>
                ))}
                {/* 사진은 x·y 가 아니라 **차례**로 선다 — 그래서 ↑↓ 가 있고 눈(보이기)이 없다.
                     자리 이름을 앞에 달아 둔다: 둘이 같이 서면 어느 줄이 어디 것인지 안 보인다 */}
                {SECTION_KINDS.filter((k) => k.of && shownSec(k.key)).flatMap((k) => {
                  const list = shotsOf(k.of)
                  const tag = k.of === 'slides' ? '슬라이드' : '세로'
                  /* 켜 두었는데 사진이 없으면 화면에는 **아무것도 안 나온다.** 목록에서 켰는데
                     화면이 그대로면 켠 것이 안 먹은 줄 안다 — 그 자리에서 까닭을 말한다 */
                  if (!list.length) return [(
                    <li key={`${k.of}-none`} className="lkEmpty">
                      <b>{k.label}</b>{eul(k.label)} 켰지만 넣은 사진이 없어 화면에 안 나옵니다.
                      위 <b>사진 더하기</b>로 넣어 주세요.
                    </li>
                  )]
                  return list.map((im, i) => (
                    <li key={`${k.of}-${im.src}`} className="lkShot">
                      <img src={im.thumb || im.src} alt="" />
                      <span className="lkShotName">{tag} {i + 1}번째</span>
                      <button type="button" disabled={i === 0} title="위로"
                              aria-label={`${tag} ${i + 1}번째 위로`} onClick={() => moveShot(k.of, i, -1)}>↑</button>
                      <button type="button" disabled={i === list.length - 1} title="아래로"
                              aria-label={`${tag} ${i + 1}번째 아래로`} onClick={() => moveShot(k.of, i, 1)}>↓</button>
                      <button type="button" className="lkX" title="빼기"
                              aria-label={`${tag} ${i + 1}번째 빼기`} onClick={() => dropShot(k.of, i)}>×</button>
                    </li>
                  ))
                })}
                {/* 아무 자리도 안 켜져 있으면 화면은 흰 종이다 — 그 사실과 할 일을 말한다 */}
                {!SECTION_KINDS.some((k) => (k.key === 'stage' || k.of) && shownSec(k.key)) && (
                  <li className="lkEmpty">
                    콘텐츠 영역·이미지·슬라이드가 모두 꺼져 있어 <b>첫 화면이 비어 있습니다</b>.
                    아래 「목록」에서 켜 주세요.
                  </li>
                )}
              </ul>

              <h3>목록</h3>
              <ul className="lkSecs">
                {conf.main.sections.map((sec, i) => (
                  /* 숨긴 줄은 이름과 ↑↓ 를 흐린다 — 눈의 사선 하나로는 한눈에 안 읽혔다
                     (2026-09-18 사용자 지적). 차례 바꾸기는 **막지 않는다** */
                  <li key={sec.key} className={sec.show ? undefined : 'is-off'}>
    {/* **끌 수 없는 줄은 없다.** 다 끄면 흰 종이가 맞다 — 슬라이드만 세운 한 장짜리,
                         사진만 잇는 한 장짜리를 만들려면 콘텐츠 영역도 꺼져야 한다 */}
                    <EyeToggle shown={sec.show} what={labelOfSec(sec.key)}
                               onToggle={() => setSec(i, { show: !sec.show })} />
                    <span>{labelOfSec(sec.key)}</span>
                    {/* 차례는 **위·아래로** 옮긴다 — 미리보기에서 끌면 무대의 글자 끌기와 겹친다 */}
                    <button type="button" disabled={i === 0} aria-label={`${labelOfSec(sec.key)} 위로`}
                            onClick={() => moveSec(i, -1)}>↑</button>
                    <button type="button" disabled={i === conf.main.sections.length - 1}
                            aria-label={`${labelOfSec(sec.key)} 아래로`}
                            onClick={() => moveSec(i, 1)}>↓</button>
                  </li>
                ))}
              </ul>
            </>)}

            {/* ── 포트폴리오 손잡이 ── 만지는 즉시 오른쪽이 바뀐다
                 ⚠ 목록 폭은 여기 없다 — 「만드는 방법」 바로 아래로 옮겼다(2026-09-18 사용자 지시) */}
            {tab === 'portfolio' && (<>
              <h3>컬럼 수</h3>
              <div className="lkNums">
                {/* 1 단은 「수직 이미지」의 값이다 — 없으면 그 템플릿을 고른 채로는
                     눌린 단추가 하나도 없어 고장으로 보인다 */}
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button key={n} type="button" aria-pressed={conf.portfolio.knobs.cols === n}
                          onClick={() => setKnob('cols', n)}>{n}</button>
                ))}
              </div>

              <h3>콘텐츠 스타일</h3>
              <Pick list={RADII} value={conf.portfolio.knobs.radius} onPick={(v) => setKnob('radius', v)} />
              {SLIDERS.map((k) => (
                <label key={k.key} className="lkSlide">
                  <span>{k.label} <b>{conf.portfolio.knobs[k.key]}{k.unit}</b></span>
                  <input type="range" min={k.min} max={k.max} value={conf.portfolio.knobs[k.key]}
                         onChange={(e) => setKnob(k.key, +e.target.value)} />
                </label>
              ))}

              {/* 여기까지는 **목록**, 아래는 **열린 작업(상세)** 의 모양이다. 같은 탭에 섞여 있어
                   어디부터 상세인지 안 보였다 — 패널 끝에서 끝까지 얇은 선으로 끊는다(2026-09-17 사용자 지시) */}
              <hr className="lkRule" />
              <h3>상세페이지</h3>
              <Pick list={ZOOMS} value={conf.portfolio.zoom} onPick={(v) => set('portfolio', { zoom: v })} two />
              {DETAIL_SLIDERS.map((k) => (
                <label key={k.key} className="lkSlide">
                  <span>{k.label} <b>{conf.portfolio.knobs[k.key]}{k.unit}</b></span>
                  <input type="range" min={k.min} max={k.max} value={conf.portfolio.knobs[k.key]}
                         onChange={(e) => { setKnob(k.key, +e.target.value); showDetail() }} />
                </label>
              ))}
            </>)}

          </fieldset>
          )}
          </>)}

          {/* ── 저장 줄 ──
               **아이콘 옆에 이름을 단다.** 아이콘만 두었더니 ✓ 와 ↺ 가 무슨 일을 하는지
               눌러 보기 전에는 알 수 없었다(2026-09-17 사용자 지적). 되돌리기처럼 되돌릴 수
               없는 일일수록 이름이 있어야 한다.
               도는 동안에도 **이름은 그대로** 두고 아이콘 자리만 팽이로 바꾼다 — 단추가
               통째로 비면 폭이 튀어 옆 단추가 움직인다. */}
          <div className="lkSave">
            <button type="button" className="primary" disabled={!!busy || bad} onClick={apply}
                    title="지금 값을 사이트에 내보냅니다">
              {busy === 'apply' ? <span className="lkSpin" aria-hidden="true" /> : <IconApply />}
              사이트에 적용
            </button>
            {/* **늘 자리를 지킨다.** 되돌릴 것이 있을 때만 나타나면 단추가 탭마다 있다 없다
                 해서, 없는 탭에서는 그런 기능이 있는 줄도 모른다. 없으면 꺼 두고 이유를 단다 */}
            <button type="button" disabled={!!busy || !undoKeys.length} onClick={undo}
                    title={undoKeys.length ? '직전에 반영한 것을 되돌립니다' : '되돌릴 반영이 없습니다'}>
              {busy === 'undo' ? <span className="lkSpin" aria-hidden="true" /> : <IconUndo />}
              되돌리기
            </button>
            <span className="lkLive">{busy === 'draw' ? '다시 그리는 중…' : ''}</span>
          </div>
        </section>

        <section className="lkPreview">
          <div className="lkPreviewBar">
            {tab === 'common' ? (
              <span className="lkPages" role="group" aria-label="어느 화면으로 볼까">
                {PAGES.map((pg) => (
                  <button key={pg.key} type="button" aria-pressed={commonPath === pg.path}
                          onClick={() => setCommonPath(pg.path)}>{pg.label}</button>
                ))}
                <em title="더미 데이터로 보는 중 · 아직 사이트에 나가지 않았습니다">미리보기</em>
              </span>
            ) : (
              <span title={`${here.label} 미리보기 — 더미 데이터로 보는 중 · 아직 사이트에 나가지 않았습니다`}>
                {tab === 'main' && editorOff === 'narrow'
                  ? '창이 좁아 폰처럼 쌓인 화면입니다. 넓게 펴면 끌어서 옮길 수 있습니다'
                  : '미리보기'}</span>
            )}
            {tab === 'main' && !code && !editorOff && (
              <button type="button" className="lkGridBtn" aria-pressed={grid}
                      onClick={() => { setGrid(!grid); editor.current?.api.grid?.(!grid) }}>격자</button>
            )}
            {/* 두 벌을 **둘 다** 내준다. 더미는 판짜기를 고르라고 있는 것이고, 실제는
                 방문자가 볼 바로 그 화면이다 — 어느 쪽을 보는지 헷갈리면 둘 다 못 믿는다 */}
            <span className="lkOpen">
              <a href={`${PREVIEW.real}${here.path}`} target="_blank" rel="noopener">새 탭에서 실제 데이터로 확인</a>
              <a href={`${PREVIEW.dummy}${here.path}`} target="_blank" rel="noopener">새 탭에서 더미 데이터로 확인</a>
            </span>
          </div>
          <div className="lkPreviewWrap" ref={shrink}>
            <iframe ref={frame} key={`${tab}-${here.path}-${bust}`} title={`${here.label} 미리보기`}
                    onLoad={paint}
                    src={`${PREVIEW.dummy}${here.path}?v=${bust}`} />
          </div>
        </section>
      </div>
      {note && (
        <p className="toast" role="status"
           onMouseEnter={hold} onMouseLeave={release} onFocus={hold} onBlur={release}>
          <span className="toast-t">{note}</span>
          <button type="button" className="toast-x" aria-label="알림 닫기"
                  onClick={() => { hold(); setNote('') }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </p>
      )}
    </div>
  )
}

/**
  * 홈디자인 — 사이트 외형을 설정하는 화면.
  *
  * 탭은 공통 / 메인 / 포트폴리오 / 블로그 넷입니다. 공통은 세 화면 전부에 걸리는 것
  * (헤더 → 본문 콘텐츠), 화면별 탭은 그 화면의 템플릿·knob·글꼴·콘텐츠 타이틀입니다.
  * 색과 글꼴을 탭 바깥에 두지 않습니다 — 그 설정이 무엇에 걸리는지 화면이 알려 주지 못합니다.
  *
  * 미리보기 버튼이 없습니다. 값을 만지면 그 자리에서 반영됩니다.
  *   수치(색·간격·모서리·폭·헤더 크기)  전부 CSS 변수라 미리보기 문서의 style 블록만 교체
  *   마크업이 바뀌는 것(템플릿·메뉴 위치·이름·표시 여부)  400ms 뒤 자동으로 다시 생성
  *
  * 버튼은 「사이트에 반영」과 「이전 판으로」 둘뿐입니다.
  */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.js'
import { Eye, EyeToggle } from './eye.jsx'
import { CAT_STRIP_STYLES,
  PAGES, PAGE_MODES, PAGE_SAMPLES, PAGE_SOURCE_MINE, MAIN_TEMPLATES, BLOG_TEMPLATES, PORTFOLIO_TEMPLATES, WIDTHS, ZOOMS,
  KNOBS, OUTLINE_SKINS, TOC_SKINS, THEME_PRESETS, FONT_ROLES, contrast, mutedOn, headerContrast, buttonContrast, INK_MIN,
  MENU_PLACES, ALIGNS, HEAD_WIDTHS, SIDEBARS, DRAWER_W, NAV_STYLES, DRAWER_STYLES, NAV_LINKS, FAVICONS, BUILTIN_FAVICON, inkOn, HEAD_SIZES, mainStart,
  ITEM_SIZES, ITEM_LINKS, SECTION_KINDS, TEMPLATE_ITEM_IDS, SHOT_KNOBS, SHOT_MAX, SAMPLE_SHOTS, STAGE_H, STAGE_W, BODY_W, HEAD_H, HEAD_SCALE, isExternal,
  FOOT_KINDS, FOOT_KNOBS, FOOT_SIZES, FOOT_H, FOOT_ICON, SERVICE_ICONS, ICON_OF, footStart, footerContrast,
  blogLookOf,
} from '../../shared/site-vocab.mjs'
import { autoSlug, CATEGORY_LABEL_MAX, CATEGORY_MAX, DEFAULT_LABEL, newCategoryId, slugProblem } from '../../shared/category.mjs'
import { MENU_ICONS, MENU_ICON_GROUPS } from '../../shared/menu-icons.mjs'
import { emitInitial, headVars, knobVars, lhVars, menuVars, outlineVars, tocVars, themeVars } from '../../shared/site-css.mjs'

import { attachStage, STACK_MQ } from './stage-editor.js'
import { ALIGN_OPS, ColorField, FontPick, IconApply, IconPic, IconUndo, ItemName, MenuIcon,
  MINE_ICON, NumField, Pick, SelPanel, Shape, iconLabel } from './fields.jsx'
import { useToast } from './toast.js'
/* 사진 업로드는 무드보드와 같은 모듈을 씁니다. 한 장마다 원본(2000px)과 썸네일(720px)을
   브라우저에서 만들고, 한 장이 실패해도 나머지를 계속 업로드합니다 */
import { uploadMood, uploadFavicon, ACCEPT, FAVICON_ACCEPT } from './mood.js'
/* 글꼴 피커는 편집기와 같은 컴포넌트를 씁니다. <select> 는 macOS·Windows 가 OS 메뉴로
   렌더링해서 CSS 가 적용되지 않고, 글꼴 이름을 그 글꼴로 미리 보여줄 수도 없습니다 */
import { Picker } from '@storkspear/post-editor-react/PickMenu'
import { fontItems } from '@storkspear/post-editor-react/pickItems'

/**
 * 미리보기는 두 벌입니다. 실제 자료 한 벌, 견본 자료 한 벌(server/dummy.mjs).
 *
 * 패널의 iframe 은 견본 쪽을 표시합니다. 아무것도 등록하지 않은 사이트에서 템플릿을 고르면
 * 빈 목록만 남아서 「히어로 이미지」와 「그리드 먼저」를 눈으로 구별할 수 없습니다.
 */
const PREVIEW = { dummy: '/preview/dummy', real: '/preview/real' }
/** 미리보기 주소에서 화면 경로만 추출합니다. real, dummy 어느 쪽이든 접두사를 제거합니다 */
const barePath = (p) => String(p || '').replace(/^\/preview\/(real|dummy)(?=\/|$)/, '')

/** 받침 유무로 「을/를」을 선택합니다. 이름이 데이터라서 문장을 미리 작성할 수 없습니다 */
const eul = (word) => {
  const c = String(word || '').trim().slice(-1).charCodeAt(0)
  const hangul = c >= 0xac00 && c <= 0xd7a3
  return hangul && (c - 0xac00) % 28 ? '을' : '를'
}

const TEMPLATES = { main: MAIN_TEMPLATES, blog: BLOG_TEMPLATES, portfolio: PORTFOLIO_TEMPLATES }
/** knob 중 슬라이더로 표시할 것. cols 는 수치가 아니라 선택지라서 따로 렌더링합니다 */
const SLIDERS = KNOBS.filter((k) => !['cols', 'radius', 'detailTop', 'detailGap'].includes(k.key))
/**
 * 모서리는 세 값 중에서 선택합니다. 슬라이더로 0~32 를 조작하게 하지 않습니다.
 * 값은 템플릿들이 실제로 쓰는 셋입니다. behance·instagram 0, dribbble 8, pinterest 16.
 * 서버는 여전히 0~32 를 받으므로 이전에 저장한 값(예: 12)도 그대로 유지됩니다.
 * 그 경우 세 버튼 중 선택된 것이 없는 상태로 표시됩니다.
 */
const RADII = [
  { value: 0, label: '직각', hint: '0px' },
  { value: 8, label: '중간', hint: '8px' },
  { value: 16, label: '둥근', hint: '16px' },
]
/** 상세 페이지용 knob. 목록이 아니라 열린 작업의 모양을 정하므로 따로 둡니다 */
const DETAIL_SLIDERS = KNOBS.filter((k) => ['detailTop', 'detailGap'].includes(k.key))

/**
 * 탭 구성. 공통 다음에 포트폴리오가 블로그보다 먼저 옵니다.
 * keys 는 그 탭에서 「사이트에 반영」을 누를 때 전송하는 설정 키입니다.
 */
const PAGE = Object.fromEntries(PAGES.map((p) => [p.key, p]))
const TABS = [
  { key: 'common', label: '공통', path: '/', keys: ['theme', 'header', 'footer', 'site'] },
  { ...PAGE.main, keys: ['main'] },
  { ...PAGE.portfolio, keys: ['portfolio'] },
  { ...PAGE.blog, keys: ['blog'] },
]
/**
 * 공통 탭의 2단계 탭. 순서는 수정 빈도 순입니다.
 * 여기서 수정하는 값은 전부 theme, header, footer 안에 있어서 1단계의 keys 는 그대로입니다.
 */
const COMMON_SUBS = [
  { key: 'menu', label: '메뉴' },
  { key: 'head', label: '헤더' },
  { key: 'body', label: '콘텐츠' },
  /* 푸터는 화면 맨 아래라 탭 순서도 맨 뒤입니다. 위에서 아래로 읽히는 순서와 같습니다 */
  { key: 'foot', label: '푸터' },
  /* 설정은 화면의 일부가 아니라 사이트 전체에 걸리는 것(탭 이름·파비콘)이라 맨 끝입니다 */
  { key: 'site', label: '설정' },
]
/** 미리보기 생성에 전송하는 키. 전부 보냅니다. 하나라도 빠지면 저장된 값이 섞입니다 */
const ALL_KEYS = ['theme', 'header', 'site', 'main', 'blog', 'portfolio', 'footer']
/** 미리보기 주소 → 그 화면의 설정 키. 화면별 글꼴과 목록 제목을 현재 화면 값으로 적용합니다 */
const KEY_OF_PATH = { '/': 'main', '/portfolio/': 'portfolio', '/blog/': 'blog' }
/** 미리보기 주소가 어느 화면에 속하는지. 목록과 그 상세는 같은 화면으로 봅니다 */
const pageOf = (path) => (path === '/' ? 'main'
  : path.startsWith('/portfolio/') ? 'portfolio' : path.startsWith('/blog/') ? 'blog' : null)

/**
  * 객체 키를 정렬한 뒤 문자열로 만듭니다. JSON.stringify 를 그대로 쓰면 키 순서까지 값으로
  * 취급합니다 — mainStart 가 만드는 순서와 정규화가 만드는 순서가 달라, 화면을 다시 열기만
  * 해도 수정한 것으로 판정되어 템플릿이 커스텀으로 바뀝니다.
  */
const deepNormalized = (v) => (Array.isArray(v) ? v.map(deepNormalized)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, deepNormalized(v[k])]))
    : v)

/**
  * 메인의 배치만 추출합니다 — 글자를 뺀 좌표·표시 여부·stage·섹션. 템플릿의 시작 배치와
  * 비교해 사용자가 수정했는지 판정합니다.
  * slideH(배너 높이)는 제외합니다. 이 값만 기본값을 브라우저 창 크기에서 재어 넣으므로
  * (fullBannerH) 어휘에 고정된 값과 같아질 수 없고, 넣으면 슬라이드를 고르는 순간 항상
  * 커스텀이 됩니다. 높이는 배치가 아니라 knob 이라 빼도 판정에 영향이 없습니다.
  */
const layoutOf = (m) => JSON.stringify(deepNormalized({
  stage: { ...m.stage, slideH: 0 }, sections: m.sections,
  /* 배열 순서도 값에 포함합니다. 박스를 추가·삭제·이동하면 수정한 것으로 판정합니다 */
  items: (m.items || []).map(({ id, x, y, w, show, size, font, color, link }) =>
    ({ id, x, y, w, show, size, font, color, link })),
}))

/**
  * 선택한 값을 CSS 변수로 출력합니다. 값 계산은 shared/site-css.mjs 가 하므로 생성기와
  * 이름이 갈릴 수 없습니다.
  * 지정하지 않은 값은 initial 로 출력합니다(emitInitial). 생략하면 미리보기 문서에 남아 있는
  * 마지막 생성 결과(<style data-head>)가 그대로 적용돼 「따르기」를 눌러도 이전 색이 남습니다.
  * code 모드 화면에는 테마를 적용하지 않습니다 — 생성기의 pageStyle 과 같은 규칙입니다.
  */
const liveCss = (conf, pageKey) => {
  const t = conf.theme
  /* 설정은 늘 여섯 키가 정규화돼 오지만, 한 키라도 빠진 응답에 화면 전체가 죽지는 않게 합니다 */
  const h = conf.header ?? {}
  const pg = conf[pageKey] || {}
  /* 헤더 변수만. code 모드 화면이 받는 전부입니다 */
  const head = emitInitial([...headVars(h, t), ...menuVars(h)])
  if (pg.mode === 'code') return `:root{${pg.chrome ? head : ''}}`
  return `:root{`
    + emitInitial(themeVars(t, pg.font))
    + emitInitial(knobVars(conf.portfolio?.knobs))
    + emitInitial(outlineVars(conf.blog?.outline))
    /* 문단 바로가기 표식 색 — 미리보기가 글 상세일 때만 쓰이지만, 변수는 늘 냅니다.
       `emitInitial` 이라 비우면 `initial` 로 나가 CSS 폴백(사이트의 먹)이 살아납니다 */
    + emitInitial(tocVars(conf.blog?.toc))
    + head
    + (pg.head ? emitInitial(lhVars(pg.head)) : '')
    + `}
.prose{--accent:${t.accent}}`
}

/**
  * 사이트 값이 대신 나가는 자리(이메일·저작권)를 그 글자로 채웁니다.
  * 굽기는 상자의 글자가 비면 `site.config.mjs` 의 값을 대신 냅니다. 관리자가 그 자리를 빈 칸
  * 으로 두면 화면에는 글이 있는데 설정에는 없는 꼴이 됩니다 — 보이는 것과 나가는 것이 같아야 합니다.
  * 적용본(`saved`)에도 같이 넣습니다(안 그러면 열자마자 「바뀐 것 있음」으로 보입니다).
  */
const withText = (items, defs) => (items || []).map((it) => (
  it.kind === 'icon' || String(it.text || '').trim() || !defs[it.id] ? it : { ...it, text: defs[it.id] }))
const fillText = (st, stage, foot) => ({
  ...st,
  main: st.main ? { ...st.main, items: withText(st.main.items, stage) } : st.main,
  footer: st.footer ? Object.fromEntries(Object.entries(st.footer)
    .map(([k, v]) => [k, { ...v, items: withText(v.items, foot) }])) : st.footer,
})

export function Look({ onWorks, onCats }) {
  const [conf, setConf] = useState(null)
  /**
    * 되돌리기는 마지막 반영에 포함된 키만 되돌립니다. 반영할 때 변경된 키만 보내고 그 목록을
    * 기억했다가 그만큼만 되돌립니다.
    * 탭의 키를 전부 보내면 같은 값의 리비전이 쌓여, 제목만 고쳤는데 안 건드린 색이 옛 리비전으로
    * 돌아가거나 「리비전이 전부 같습니다」로 멈춰 절반만 되돌아갑니다.
    */
  const saved = useRef({})
  /**
   * 마지막으로 사이트에 반영한 값 하나를 꺼냅니다. saved.current 는 키별 JSON 문자열이고
   * 반영·되돌리기마다 갱신됩니다. 서버를 거치지 않고 그 색으로 돌아갈 수 있습니다.
   * 아직 한 번도 반영하지 않은 키면 undefined 를 반환해서 ↺ 버튼이 표시되지 않습니다.
   */
  const appliedOf = (key, path) => {
    try {
      return path.reduce((o, k) => (o == null ? o : o[k]), JSON.parse(saved.current[key] ?? 'null'))
    } catch { return undefined }
  }
  const [batch, setBatch] = useState({})
  const [tab, setTab] = useState('common')
  /* 공통 탭의 2단계 탭. tab 과 별도 상태로 둡니다. bad, changed, undoKeys, 미리보기 iframe 의
     key 가 전부 1차원 tab 에 묶여 있어서, 여기 값을 섞으면 TABS.find 가 실패합니다 */
  const [sub, setSub] = useState('menu')
  /**
   * 블로그 탭이 지금 고치는 카테고리 — 식별자 하나, `null` 이면 「기본」(= `/blog/`).
   * `sub` 와 같은 까닭으로 `tab` 에 섞지 않습니다: `TABS.find(t => t.key === tab)` 이 실패하면
   * 렌더링이 통째로 멈춥니다. 셋째 축입니다.
   * 식별자만 듭니다 — 객체를 들면 반영 뒤 서버가 돌려준 값과 어긋난 사본이 남습니다.
   */
  const [cat, setCat] = useState(null)
  /**
   * 카테고리 **편집모드**. 평소에는 보기만 합니다 — 줄을 눌러 고르는 일만 되고, 이름·차례·지우기는
   * 손댈 수 없습니다. 고르는 것과 고치는 것이 같은 자리에 있으면 고르려다 이름이 바뀝니다
   * (실제로 그 모양이었고 사용자가 잡았습니다).
   *
   * `cat`·`sub`·`tab` 과 섞지 않습니다 — 저 셋은 「무엇을 보고 있나」이고 이것은 「고칠 수 있나」라,
   * 탭을 옮겼다고 편집모드가 따라다니면 안 됩니다. 탭이 바뀌면 꺼집니다(아래 effect).
   */
  const [catEdit, setCatEdit] = useState(false)
  /* 탭을 옮기면 편집모드를 끕니다. **early return 앞에** 있어야 합니다 —
     `if (!conf) return` 아래에 두었더니 첫 렌더에선 안 불리고 두 번째엔 불려
     「Rendered more hooks than during the previous render」 로 화면이 통째로 죽었습니다 */
  useEffect(() => { setCatEdit(false) }, [tab])
  /* 고른 카테고리의 지금 값. 지워졌으면 「기본」으로 떨어집니다 */
  const catNow = (conf && cat && (conf.blog.categories || []).find((c) => c.id === cat)) || null
  /* 이 세션에서 막 만든 카테고리 — 이름을 치는 동안 주소가 따라옵니다(로마자). 저장돼 있던
     카테고리는 안 따라갑니다: 이름을 고쳤다고 주소가 바뀌면 바깥에 적힌 링크가 다 죽습니다 */
  const freshCats = useRef(new Set())
  /* 카테고리마다 글 편수 — 지우기 전에 「N편이 초안이 됩니다」를 말하려고. `/api/settings` 가 셉니다 */
  const [catCounts, setCatCounts] = useState({})
  /* 아이콘 선택기. 한 번에 하나만 엽니다. 링크 키를 갖고 있고 빈 값이면 닫힌 상태입니다 */
  const [iconFor, setIconFor] = useState('')
  /* 드로어 icon 스타일 여부. 사이드바를 쓰고 그 스타일일 때만 아이콘이 화면에 출력됩니다 */
  const iconMode = conf?.header?.menu === 'sidebar' && conf?.header?.drawer?.style === 'icon'
  /**
    * 공통 탭의 미리보기 대상 화면. 공통 설정은 세 화면 전부에 걸리므로 어느 화면으로 볼지 고릅니다.
    * 기본값은 블로그입니다 — 메인은 공통 헤더가 기본으로 꺼져 있고 목록 제목도 없어서 헤더나
    * 타이틀을 고쳐도 화면이 안 바뀌고, 그러면 사용자는 버그로 읽습니다. 블로그는 항상 생성기가
    * 만들고 헤더도 기본으로 켜져 있어 공통 탭의 값이 전부 드러나는 유일한 화면입니다.
    */
  const [commonPath, setCommonPath] = useState('/blog/')
  const { note, setNote, err, setErr, say, fail, hold, release } = useToast()
  const [busy, setBusy] = useState('')
  /* 생성기가 보내는 경고. 차단하지는 않지만 알아야 할 것들입니다(예: 헤더가 둘).
     미리보기를 생성할 때마다 새로 받으므로 원인을 해결하면 다음 생성에서 사라집니다 */
  const [warn, setWarn] = useState([])
  const [bust, setBust] = useState(0)          /* 미리보기 iframe 을 다시 로드하는 신호 */
  const frame = useRef(null)
  /**
   * 미리보기 iframe 을 넓게 띄운 뒤 축소해서 표시합니다.
   *
   * 패널 폭 그대로 띄우면 화면의 절반 정도(약 850px)라 STACK_MQ(860px) 아래로 떨어집니다.
   * 그러면 공개 화면이 board 를 버리고 모바일처럼 세로로 쌓아서 드래그 편집이 항상 꺼집니다.
   * 패널이 이미 1240px 이상이면 축소하지 않습니다.
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
   * stage 편집기. 미리보기 iframe 안에 얹습니다(stage-editor.js). 문서가 바뀔 때만 다시 붙이고,
   * 값이 바뀔 때는 sync 로 맞춥니다. sel 은 선택한 요소의 board 단위 좌표·크기입니다.
   */
  const editor = useRef(null)
  const [sel, setSel] = useState(null)
  const [grid, setGrid] = useState(false)
  const [editorOff, setEditorOff] = useState(null)
  /* 방금 추가한 박스. 미리보기가 다시 렌더링되면 이것을 선택합니다 */
  const wantSel = useRef(null)
  /* 배치를 수정한 뒤에 템플릿을 바꾸려 하면 한 번 확인합니다. 누른 템플릿 값을 담습니다 */
  const [ask, setAsk] = useState(null)
  /* stage 요소의 기본 문구. 편집기에서 글자를 다 지우면 이 값이 보여야 공개 화면과 같습니다 */
  const [stageText, setStageText] = useState({})
  /* 푸터도 같습니다. 이메일과 저작권은 비우면 site.config.mjs 의 값이 출력됩니다 */
  const [footText, setFootText] = useState({})
  /* 주소를 입력하지 않아도 갈 곳이 있는 아이콘(현재는 GitHub). 「주소 없음」을 잘못 표시하지 않으려고 받습니다 */
  const [footIcon, setFootIcon] = useState({})
  /* 「설정」 탭의 귀띔 — 비웠을 때 site.config.mjs 에서 무엇이 나가는지 */
  const [siteText, setSiteText] = useState({})
  /* 이 브라우저가 어두운 쪽인가. 파비콘 그림이 제 안에서 색을 뒤집으므로 관리자도 같이
     뒤집어야 보이는 것과 적힌 것이 맞습니다. 설정을 바꾸면 바로 따라옵니다 */
  const favFile = useRef(null)
  const [favOver, setFavOver] = useState(false)   /* 파일을 이 칸 위로 끌고 왔나 */
  const [favName, setFavName] = useState('')      /* 방금 올린 파일 이름 */
  const [favErr, setFavErr] = useState('')        /* 이 칸에서만 쓰는 오류 — 위 err 은 패널 맨 위에 뜹니다 */
  const [darkTab, setDarkTab] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!m) return
    const on = (e) => setDarkTab(e.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  /* 패널 폭이 바뀌어 편집기를 다시 붙일 때 현재 렌더의 paint 를 호출하기 위한 참조 */
  const paintRef = useRef(null)
  /* 왼쪽 글자 필드를 비운 채 포커스를 잃을 때 복원할 값. .lkSelText 의 onBlur 가 씁니다 */
  const textWas = useRef('')
  /**
   * 블로그 탭에서 카테고리를 골랐으면 미리보기도 그 페이지(`/blog/<slug>/`)로 — 고른 것과 보이는
   * 것이 같아야 합니다.
   *
   * **이름이 빈 줄이면 `/blog/` 에 머뭅니다.** 미리보기를 구울 때 이름 없는 카테고리는 빼므로
   * (바로 아래 `paint` 의 `filter`) 그 페이지가 디스크에 없고, 그리로 보내면 404 가 뜹니다.
   * 주소만 보고 판단하면 안 됩니다 — 주소는 `autoSlug` 가 늘 유효하게 만들어 주므로
   * ＋ 를 누른 직후 빈 줄에서도 통과해 버립니다(실제로 404 를 띄웠습니다).
   */
  const previewPath = tab === 'common' ? commonPath
    : tab === 'blog' && catNow && catNow.label && !slugProblem(catNow.slug) ? `/blog/${catNow.slug}/`
    : PAGE[tab].path
  /* 카테고리 페이지는 표에 없습니다 — `/blog/` 아래는 전부 블로그입니다 */
  const previewKey = KEY_OF_PATH[previewPath] || pageOf(previewPath)
  /**
   * 어느 푸터를 편집하는지는 현재 보고 있는 화면이 정합니다. 별도 상태로 두면 「메인 푸터」를
   * 선택했는데 미리보기에는 블로그가 표시되는 불일치가 생깁니다. 그래서 선택기가 commonPath 를
   * 바꾸고, 그 값에서 푸터 종류가 따라 나옵니다.
   */
  const footKind = previewPath === '/' ? 'main' : 'pages'
  /* 현재 화면이 code 모드인지. 블로그에는 이 구분이 없습니다 */
  const code = tab !== 'common' && tab !== 'blog' && conf[tab].mode === 'code'
  const stay = useRef(null)
  stay.current = pageOf(previewPath)

  /**
    * 배치를 한 군데라도 수정하면 템플릿이 커스텀으로 바뀝니다. 옮긴 배치를 계속 「표지」라는
    * 이름으로 부르면 무엇을 골랐는지가 맞지 않고, 다른 템플릿을 누를 때 무엇이 사라지는지도
    * 알기 어려워집니다.
    * 판정 대상은 좌표·표시 여부·섹션·높이뿐입니다(layoutOf) — 글자와 글꼴은 배치가 아닙니다.
    * 드래그 중에는 편집기가 iframe 만 고치고 놓을 때 한 번 알리므로 이 검사도 한 번 돕니다.
    */
  /* 확인 팝업은 Esc 로도 닫힙니다. 스크림을 눌러 닫는 것과 같은 경로가 키보드에도 있어야 합니다 */
  useEffect(() => {
    if (!ask) return
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); setAsk(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ask])

  /* 깊은 정규화 + JSON.stringify 라 매 렌더마다 돌릴 값이 아닙니다 */
  const shape0 = useMemo(() => (conf ? layoutOf(conf.main) : null), [conf?.main])
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
        setSiteText(d.siteText || {})
        setCatCounts(d.categoryCounts || {})
        onCats?.(d.settings.blog?.categories || [])
        saved.current = Object.fromEntries(ALL_KEYS.map((k) => [k, JSON.stringify(filled[k])]))
        /* 화면을 처음 열었을 때의 반영 그룹은 저장 시각으로 추정합니다. 한 번의 반영은 몇 초
           안에 끝나고 사용자가 두 번 반영하는 간격은 그보다 깁니다. 이전 리비전이 있는 키만 셉니다 */
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

  /* 알림은 목록 화면과 같은 토스트를 씁니다. 화면 구석에 잠깐 표시되고 마우스를 올리면
     유지됩니다. 패널 맨 위에 끼우면 아래 내용이 밀려서 조작 중이던 컨트롤을 놓칩니다 */


  /**
    * 배너 높이와 knob 값을 미리보기 문서에 직접 적용합니다. 다시 생성하지 않는 까닭은 슬라이더를
    * 만질 때마다 사이트 한 벌을 다시 생성하면 iframe 이 매번 새로 로드돼 깜빡이기 때문입니다.
    * --sh 는 CSS 변수라 문서의 값만 교체하면 즉시 반영됩니다. iframe 이 새로 로드되면 생성
    * 시점의 값이 잠깐 보이므로 paint(onLoad)에서도 한 번 더 적용합니다.
    */
  const paintStageVars = (st) => {
    const doc = frame.current?.contentDocument
    const banner = doc?.querySelector('.m-slides')
    if (banner) banner.style.setProperty('--sh', String(Math.round(st.slideH)))
    const stack = doc?.querySelector('.m-shots')
    if (stack) for (const k of SHOT_KNOBS) stack.style.setProperty(`--m${k.key}`, String(Math.round(st.shotKnobs[k.key] ?? k.d)))
    const board = doc?.querySelector('.m-board')
    /* 생성기와 같은 문자열입니다. 값을 지연 평가로 두면 본문 폭 슬라이더를 조작할 때
       board 가 따라옵니다 */
    if (board) board.style.setProperty('--bw', 'var(--body-w, 1240px)')
  }
  const knobKey = conf && [conf.main.stage.slideH, conf.theme.width, conf.theme.bodyWidth,
    ...SHOT_KNOBS.map((k) => conf.main.stage.shotKnobs[k.key])].join(',')
  useEffect(() => { if (conf) paintStageVars(conf.main.stage) }, [knobKey])

  /**
    * 푸터 knob — 전부 CSS 변수라 다시 굽지 않고 창의 푸터 한 덩이만 고쳐 넣습니다.
    * 변수 이름과 파생색 계산이 생성기의 footHtml 과 같아야 합니다.
    * board 높이(--sh)만 board 의 style 속성에 있습니다 — 인라인이 스타일시트를 이기므로
    * liveCss 로는 못 덮고 속성을 직접 고칩니다.
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

  /**
   * 「다음 미리보기는 글 상세로」 한 번짜리 신호. 켜는 순간 바로 옮길 수는 없습니다 —
   * 문단 바로가기는 마크업이 바뀌는 값이라 `shape` 가 흔들려 400ms 뒤 사이트를 다시 굽고,
   * 그때 iframe 이 통째로 새 것이 되면서 `/blog/` 목록으로 돌아가기 때문입니다.
   *
   * **담는 값이 `bust` 번호인 까닭**: `true`/`false` 로 뒀더니 옮기자마자 되돌아왔습니다.
   * 누르면 `conf` 가 먼저 바뀌어 `paint` 가 **옛 문서**로 한 번 돕니다 — 거기엔 글 목록이
   * 그대로 있어서 신호를 써 버리고, 곧이어 다시 구운 화면이 그 이동을 덮었습니다.
   * 누른 시점의 번호를 적어 두고 그 번호가 **바뀐 뒤**에만 씁니다.
   */
  const goPost = useRef(null)

  const paint = () => {
    if (!conf) return
    const doc = frame.current?.contentDocument
    if (!doc?.head) return
    paintStageVars(conf.main.stage)
    paintFoot(doc)
    let el = doc.getElementById('live')
    if (!el) { el = doc.createElement('style'); el.id = 'live'; doc.head.append(el) }
    /* 탭이 아니라 iframe 의 실제 주소로 판정합니다. 블로그 탭에서 미리보기 안의 「포트폴리오」를
       누르면 블로그 글꼴과 타이틀 크기가 포트폴리오에 적용됩니다 */
    const path = barePath(frame.current?.contentWindow?.location.pathname)
    const liveKey = KEY_OF_PATH[path] || (path.startsWith('/portfolio/') ? 'portfolio'
                  : path.startsWith('/blog/') ? 'blog' : previewKey)
    /* 블로그는 고른 카테고리의 모양으로 — 미리보기가 그 카테고리 페이지를 보고 있습니다.
       기본이면 윗단 그대로. 굽기의 `confFor` 와 같은 치환입니다 */
    const seen = liveKey === 'blog' && catNow ? { ...conf, blog: { ...conf.blog, ...catNow.look } } : conf
    el.textContent = liveCss(seen, liveKey)
    /* 새로 추가한 박스가 iframe 에 나타나면 그때 선택합니다. 추가만 하고 어디 생겼는지
       모르면 의미가 없습니다 */
    const want = wantSel.current
    if (want && doc.querySelector(`.m-i[data-i="${want}"]`)) {
      wantSel.current = null
      queueMicrotask(() => { editor.current?.api.select?.(want); frame.current?.contentWindow?.focus() })
    }
    /**
     * 편집기를 붙일 board. 메인 탭은 stage, 공통 탭의 푸터 서브탭은 푸터입니다. 그 외에는
     * 붙이지 않습니다. 한 문서에 board 가 둘(stage, 푸터)이라 선택자를 반드시 좁혀야 합니다.
     * 안 좁히면 stage 편집기가 푸터를 잡습니다.
     */
    const edAt = tab === 'main' && conf.main.mode === 'template' ? 'stage'
      : tab === 'common' && sub === 'foot' ? 'foot' : null
    const edSet = edAt === 'foot' ? conf.footer?.[footKind] : null
    /**
     * 푸터 탭에서는 미리보기를 맨 아래로 내립니다 — 고치는 자리가 화면 밖이면 아무것도 안 보입니다.
     *
     * 다시 구울 때마다 iframe 이 새로 뜨면서 스크롤이 맨 위로 돌아가므로 그때마다 다시 맞춥니다.
     * 문서마다 한 번만 합니다: 사용자가 직접 스크롤해 위쪽을 보고 있는데 knob 을 만질 때마다
     * 도로 끌어내리면 쓸 수 없습니다.
     */
    if (edAt === 'foot') {
      if (!doc.__lkFoot) {
        doc.__lkFoot = true
        doc.querySelector('.foot')?.scrollIntoView({ block: 'end' })
      }
    } else if (doc.__lkFoot) doc.__lkFoot = false
    if (edAt && doc.URL !== 'about:blank' && doc.readyState === 'complete') {
      /**
       * iframe 폭이 쌓임 경계(860px)를 넘나들면 편집기를 떼고 다시 붙입니다. 한 번 붙인 문서에는
       * 다시 붙이지 않기 때문에, 좁을 때 열면 넓혀도 편집이 안 되고, 넓을 때 붙인 뒤 좁히면
       * 세로로 쌓인 화면에서 보이지 않는 좌표가 수정됩니다.
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
      /* 붙이기에 실패한 iframe 은 다시 시도합니다. 한 번 「좁음」으로 판정되면 그 문서에는 다시
         붙이지 않는데, iframe 은 곧이어 넓어집니다(아래 축소 계산이 폭을 1240 으로 올립니다).
         그 사이에 조건을 놓치면 편집기가 계속 꺼진 상태로 남습니다.
         실패한 붙이기는 sync 가 없어서 그것으로 구분합니다. 붙이기 자체는 querySelector 두 번이라
         비용이 낮습니다.

         붙일 board 가 바뀌었으면(stage ↔ 푸터) 문서가 같아도 다시 붙입니다. at 이 그것을 구분합니다 */
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
      /* 다른 탭 — 옛 창은 이미 버려졌을 수 있습니다(문서가 사라지면 떼는 것도 할 일이 없습니다) */
      try { editor.current.api.detach?.() } catch { /* 버려진 문서 */ }
      editor.current = null
    }
    /**
      * 미리보기는 현재 탭의 화면 밖으로 이동하지 않습니다 — 메인 탭에서 작업 카드를 누르면
      * 포트폴리오 상세가 표시되어 탭과 화면이 어긋납니다.
      * 같은 화면 안의 이동(목록 ↔ 상세, 팝업의 #)은 허용하고 다른 화면·외부 주소·메일만 막습니다.
      * iframe 이 새로 로드되면 문서가 바뀌므로 문서마다 한 번 겁니다.
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
    /* 편집기 글꼴(본고딕, 본명조 등)은 레포 시트에 없습니다. 생성된 화면은 선택 후 다시
       생성하면 포함되지만, 선택하는 그 순간에도 보여야 하므로 미리보기 문서에 미리 넣어 둡니다 */
    if (!doc.querySelector('link[data-live-fonts]')) {
      const l = doc.createElement('link')
      l.rel = 'stylesheet'; l.href = '/assets/fonts.css'; l.setAttribute('data-live-fonts', '')
      doc.head.prepend(l)
    }
    /**
     * 글 상세를 만졌으면 미리보기를 글 상세로 보냅니다 — 포트폴리오의 `showDetail` 과 같은
     * 이유입니다. 블로그 미리보기는 `/blog/` 목록 고정이라, 문단 바로가기를 켜도 목록에는
     * 아무 일도 안 일어납니다. 설정은 들어갔는데 화면이 그대로면 사람은 버그로 읽습니다.
     *
     * 글 카드가 **실제로 보일 때**만 씁니다. 다시 굽는 동안 이 함수는 아직 빈 문서(새
     * iframe)로 한 번 돕니다 — 거기서 신호를 써 버리면 아무 데도 못 갑니다.
     */
    if (goPost.current !== null && goPost.current !== bust && tab === 'blog') {
      const href = doc.querySelector('.b-item a')?.getAttribute('href')
      if (href) { goPost.current = null; frame.current.contentWindow.location.href = href }
    }
  }
  /* 값이 바뀌면 다시 적용합니다. iframe 이 새로 로드될 때도 적용해야 하는데(탭을 옮기면 새
     문서입니다) 그건 onLoad 가 맡습니다. 둘 중 하나만 있으면 탭을 옮긴 뒤 컨트롤이 동작하지
     않는 것처럼 보입니다.

     의존성에 tab 과 sub 도 넣습니다. 편집기가 붙을 board 가 탭에 따라 달라지므로, 문서가
     그대로여도 푸터 탭으로 옮긴 순간 다시 적용해야 합니다. 안 그러면 푸터 board 에 편집기가
     안 붙어서 드래그할 수 없습니다 */
  useEffect(paint, [conf, bust, previewKey, tab, sub])
  paintRef.current = paint

  /**
   * 마크업이 바뀌는 값은 서버가 다시 생성해야 반영됩니다. 400ms 디바운스 후 한 번만 실행합니다.
   *
   * 아래 shape 에는 마크업을 바꾸는 값만 넣습니다. 색·모서리·크기처럼 CSS 변수로 전달되는
   * 값을 넣으면 슬라이더를 조작할 때마다 생성이 실행되어 즉시 반영의 이점이 사라집니다.
   */
  const headMarkup = (hd) => hd && [hd.show, hd.name, hd.count]
  /* 본문 대비만 검사합니다. 헤더와 메뉴 대비까지 넣으면, 공통 탭에서 대비가 부족한 조합을 둔 채
     다른 탭으로 이동했을 때 미리보기가 이유 없이 멈춥니다. 이유 문구가 공통 탭에만 있기 때문입니다.
     지정한 색끼리 충돌하면 서버가 400 과 이유를 반환하고, 그 문구는 어느 탭에서든 표시됩니다 */
  const themeOk = !!conf && contrast(conf.theme.ink, conf.theme.paper) >= INK_MIN
  const shape = useMemo(() => (conf ? JSON.stringify([
    /* 본문을 누가 만드는지와 헤더를 싣는지. 마크업이 통째로 바뀌는 값이라 맨 앞에 둡니다 */
    conf.main.mode, conf.portfolio.mode,
    /* code 모드가 읽는 파일. 바꾸면 본문이 통째로 다른 파일이 됩니다 */
    conf.main.source, conf.portfolio.source,
    conf.main.chrome, conf.portfolio.chrome, conf.blog.chrome,
    conf.main.template, conf.blog.template, conf.portfolio.template,
    /* stage. 배경 이미지·섹션 표시·요소 표시는 마크업이 바뀝니다. 좌표·높이·글자는 편집기가
       iframe 에 직접 반영합니다 */
    conf.main.stage.bg, conf.main.sections,
    /* 사진. 두 섹션의 순서가 곧 마크업입니다. 높이는 CSS 변수라 iframe 에 즉시 반영됩니다 */
    conf.main.stage.shots.map((x) => x.src).join('|'),
    conf.main.stage.slides.map((x) => x.src).join('|'),
    /* 마크업이 바뀌는 값 전부. 색과 글꼴은 박스의 style 로 생성되므로 여기 없으면 반영되지 않습니다 */
    conf.main.items.map((i) => [i.id, i.show, i.size, i.link, i.font, i.color].join(':')),
    conf.portfolio.zoom,
    headMarkup(conf.blog.head), headMarkup(conf.portfolio.head),
    /* 글 상세의 문단 바로가기 — 켜면 `<aside>` 가 통째로 생깁니다.
       표식 모양도 **여기 있어야 합니다** — `<aside>` 에 `bj-<모양>` 클래스 한 장이 붙는데,
       클래스는 구운 HTML 에 박히므로 미리보기 CSS 만 갈아서는 안 바뀝니다(바로 아래
       카드 테마와 같은 까닭입니다). 색(`toc.ink`)은 CSS 변수라 여기 없습니다 —
       넣으면 색칸을 만질 때마다 사이트를 다시 굽습니다 */
    conf.blog.toc.show, conf.blog.toc.skin,
    /* 카드 갈래의 테마 — 목록에 클래스 한 장이 붙습니다. 색·모서리는 CSS 변수라 여기 없습니다
       (넣으면 색칸을 만질 때마다 사이트를 다시 굽습니다) */
    conf.blog.outline.skin,
    /* 카테고리 — 줄·페이지·드로어 하위 항목이 전부 마크업입니다. 모양 여섯 중 마크업인 것
       (갈래·공통헤더·타이틀·바로가기·카드 테마)도 카테고리마다 따로 봅니다. 색은 여기 없습니다 */
    /* 줄 모양도 **마크업**입니다 — `<nav>` 에 클래스 한 장이 붙습니다. 여기 없으면 눌러도
       미리보기가 안 바뀝니다(CSS 변수가 아니라 클래스라 즉시 반영이 안 됩니다). 실제로 그랬습니다 */
    conf.blog.catStrip,
    (conf.blog.categories || []).map((c) => [c.id, c.label, c.slug, c.show, c.look.template, c.look.chrome,
      headMarkup(c.look.head), c.look.toc.show, c.look.toc.skin, c.look.outline.skin].join(':')).join('|'),
    /* 탭 이름과 파비콘. 둘 다 <head> 로 나가므로 마크업입니다.
       파비콘 색도 여기 있어야 합니다 — 색을 고르면 굽기가 그림을 다시 그려 data: 주소로 박으므로
       CSS 변수처럼 iframe 에 바로 먹지 않습니다(빼 두면 색만 바꿀 때 미리보기가 안 바뀝니다) */
    conf.site.title, conf.site.favicon, conf.site.faviconColor, conf.site.faviconBg,
    conf.header.title, conf.header.align, conf.header.width,
    conf.header.menu, conf.header.sidebar.kind, conf.header.links,
    /* 스타일은 클래스 이름으로 출력되므로 마크업이 바뀝니다. 색과 모서리는 CSS 변수라 여기 없습니다 */
    conf.header.nav.style, conf.header.drawer.style,
    /* 푸터. 마크업이 바뀌는 값만 넣습니다. 높이·간격·색은 CSS 변수라 iframe 에 즉시 반영되고,
       좌표와 글자는 편집기가 반영합니다. 아이콘의 text(직접 입력 이름)도 표시 내용이라 마크업입니다.

       주소는 유효한 주소가 됐는지(isExternal)로 판정합니다. !!url 로 판정하면 첫 글자를 입력한
       순간 한 번 true 가 된 뒤 바뀌지 않아서, 주소를 다 입력해도 미리보기를 다시 생성하지
       않습니다. 그러면 아이콘을 추가해도 화면에 나타나지 않습니다. 생성기도 같은 기준을 씁니다 */
    FOOT_KINDS.map((k) => (conf.footer?.[k.value]?.items || [])
      .map((i) => [i.id, i.kind, i.service, i.show, i.size, i.link, i.font, i.color, isExternal(i.url),
                   i.kind === 'icon' ? i.text : ''].join(':')).join('|')),
    /* 대비가 부족하면 서버가 400 을 반환합니다. 그동안은 생성하지 않고, 값이 고쳐지는 순간
       다시 생성합니다. 이 값이 없으면 400 이후 미리보기가 옛 화면에 멈춘 채 남습니다 */
    themeOk,
  ]) : null), [conf, themeOk])
  /**
   * 화면을 열 때도 한 번 생성합니다. 미리보기 폴더에는 마지막으로 생성된 결과가 남아 있어서
   * 처음 값을 건너뛰었더니 피커는 「헤더」인데 미리보기에는 지난번 시험의 사이드 바 햄버거가
   * 떠 있었습니다. 조작과 화면이 어긋난 미리보기는 없는 것보다 나쁩니다.
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
        /* 한 요청에 키를 전부 전송합니다. 미리보기 생성은 사이트 한 벌을 통째로 만드는
           작업이라, 키마다 따로 보내면 뒤 요청이 앞 요청의 값을 저장된 값으로 덮습니다 */
        /**
         * 아직 이름·주소가 안 된 카테고리는 미리보기에서 뺍니다. 서버는 그 줄을 400 으로 거절하는데
         * (저장은 그래야 맞습니다), 미리보기까지 거절하면 ＋ 를 누르는 순간부터 이름을 다 칠 때까지
         * 패널 맨 위에 빨간 줄이 서고 화면이 옛것에 멈춥니다 — 실제로 그랬습니다. 그 줄은 제 자리의
         * 「이름 없음」·「주소 없음」이 이미 말해 줍니다.
         */
        const blog = { ...conf.blog, categories: (conf.blog.categories || []).filter((c) => c.label && !slugProblem(c.slug)) }
        const d = await api('/settings', { method: 'POST', body: JSON.stringify({
          key: 'theme', value: conf.theme, preview: true,
          also: { ...Object.fromEntries(ALL_KEYS.map((k) => [k, conf[k]])), blog },
        }) })
        setWarn(d?.warn || [])
        /* iframe 이 교체되기 직전에 편집 중이던 글자와 드래그 위치를 확정합니다.
           안 하면 새 iframe 이 로드되면서 사라집니다 */
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
  const setSite = (patch) => set('site', patch)
  /* ── 블로그 탭이 지금 고치는 모양 ──
     기본(= /blog/)이면 블로그 윗단, 카테고리를 골랐으면 그 카테고리의 `look`. 같은 여섯 키라
     아래 조작은 전부 이 둘을 지나서만 읽고 씁니다 — `conf.blog.X` 를 직접 읽는 자리를 하나라도
     남기면 카테고리를 골랐는데 기본을 고치는 조작이 생깁니다. */
  const cats = conf.blog.categories || []
  const blogLook = catNow ? catNow.look : conf.blog
  const setBlogLook = (patch) => setConf((c) => (catNow
    ? { ...c, blog: { ...c.blog, categories: (c.blog.categories || []).map((x) =>
        (x.id === catNow.id ? { ...x, look: { ...x.look, ...patch } } : x)) } }
    : { ...c, blog: { ...c.blog, ...patch } }))
  /* 화면별 탭이 고치는 블록 — 메인·포트폴리오는 제 키, 블로그는 위의 둘 중 하나 */
  const page = tab === 'common' ? null : tab === 'blog' ? blogLook : conf[tab]
  const setPage = (patch) => (tab === 'blog' ? setBlogLook(patch) : set(tab, patch))
  const setCats = (fn) => setConf((c) => ({ ...c, blog: { ...c.blog, categories: fn(c.blog.categories || []) } }))
  const setCatRow = (id, patch) => setCats((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  /**
   * 새 카테고리 — 기본의 모양을 **통째로 베껴** 시작합니다(`blogLookOf`). 그 뒤로는 제 것을 따로 고칩니다.
   * 「초기화」가 생긴다면 같은 한 줄을 다시 부르면 됩니다. 만들자마자 고릅니다 — 더해 놓고 어디 갔는지
   * 모르면 소용이 없습니다(상자 더하기와 같은 규약).
   */
  const addCat = () => {
    const id = newCategoryId()
    freshCats.current.add(id)
    setCats((list) => [...list,
      { id, label: '', slug: autoSlug('', list.map((x) => x.slug), id), show: true, look: blogLookOf(conf.blog) }])
    setCat(id)
  }
  const moveCat = (i, d) => setCats((list) => {
    const next = [...list]
    const j = i + d
    if (j < 0 || j >= next.length) return list
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  /**
   * 이름을 치면 주소가 따라옵니다 — **이 세션에서 만든 것만**(`freshCats`).
   * 한 번 반영한 카테고리는 이름을 바꿔도 주소가 그대로입니다: 밖에 적어 둔 링크가 다 죽습니다.
   *
   * 주소를 손으로 고치는 길은 없습니다. 사용자 지시가 「카테고리명과 공개 여부만」이었고,
   * `autoSlug` 가 겹침·예약어·숫자를 스스로 비켜 가므로 사람이 손댈 거리가 남지 않습니다.
   */
  const renameCat = (c, label) => setCatRow(c.id, {
    label,
    ...(freshCats.current.has(c.id)
      ? { slug: autoSlug(label, cats.filter((x) => x.id !== c.id).map((x) => x.slug), c.id) }
      : {}),
  })
  /**
   * 지금 고른 카테고리의 편수 — 「3편 · 초안 1」. 비면 아무 말도 안 합니다.
   *
   * **기본은 더해서 셉니다.** 기본은 `/blog/` 그 자체라 모든 글이 실리는데,
   * `categoryCounts['']` 는 분류를 안 한 글만 셉니다. 그것을 그대로 쓰면 「2편」이라 적어 놓고
   * 여덟 편을 싣는 꼴이 됩니다.
   */
  const catCountLabel = (() => {
    const 센다 = catNow
      ? (catCounts[catNow.id] || { published: 0, drafts: 0 })
      : Object.values(catCounts).reduce((a, n) => ({
        published: a.published + (n.published || 0), drafts: a.drafts + (n.drafts || 0),
      }), { published: 0, drafts: 0 })
    return [센다.published ? `${센다.published}편` : '', 센다.drafts ? `초안 ${센다.drafts}` : '']
      .filter(Boolean).join(' · ')
  })()
  /** 서버에 저장돼 있는 카테고리인가 — 아직 반영 안 한 것은 서버에 지우라고 할 것이 없습니다 */
  const savedCat = (id) => {
    try { return (JSON.parse(saved.current.blog || 'null')?.categories || []).some((x) => x.id === id) } catch { return false }
  }
  /**
   * 카테고리 지우기. 서버가 설정에서 빼고 거기 있던 글을 초안으로 돌립니다 — 한 트랜잭션입니다
   * (`POST /api/categories/delete`). 돌려받은 값은 **저장된 판**이라 「마지막 반영」만 갱신하고,
   * 여기 있는 다른 수정(아직 반영 안 한 것)은 그대로 둡니다. 반영한 적 없는 줄은 그냥 뺍니다.
   */
  const dropCat = async (c) => {
    setAsk(null)
    if (cat === c.id) setCat(null)
    freshCats.current.delete(c.id)
    if (!savedCat(c.id)) { setCats((list) => list.filter((x) => x.id !== c.id)); return }
    setErr(''); setBusy('cat')
    try {
      const d = await api('/categories/delete', { method: 'POST', body: JSON.stringify({ id: c.id }) })
      setCats((list) => list.filter((x) => x.id !== c.id))
      saved.current.blog = JSON.stringify(d.value)
      onCats?.(d.value?.categories || [])
      /* 편수를 다시 셉니다 — 초안이 된 글이 「카테고리 없음」으로 옮겨 갔습니다 */
      api('/settings').then((r) => setCatCounts(r.categoryCounts || {})).catch(() => {})
      say(d.drafted ? `「${c.label}」을 지웠습니다 — 글 ${d.drafted}편이 초안이 됐습니다` : `「${c.label}」을 지웠습니다`)
      if (d?.bakeError) throw new Error('지웠지만 화면을 굽지 못했습니다: ' + d.bakeError)
      setBust((n) => n + 1)
    } catch (e) { fail(e) } finally { setBusy('') }
  }
  /* 카드 갈래의 손잡이. 색칸이 「비우면 무엇을 따르나」를 보여 주려면 지금 테마를 알아야 합니다 */
  const setOutline = (patch) => setBlogLook({ outline: { ...blogLook.outline, ...patch } })
  /* 고르면 미리보기를 첫 글로 보냅니다 — 표식은 글 상세에만 있어서 목록에 서 있으면
     바뀐 것이 안 보입니다.
     모양은 `shape` 에 들어갑니다(클래스라 다시 구워야 합니다). 색은 CSS 변수라 안 들어가고
     즉시 반영됩니다 — 둘이 한 함수를 쓰지만 반영되는 길이 다릅니다 */
  const setToc = (patch) => {
    goPost.current = bust
    setBlogLook({ toc: { ...blogLook.toc, ...patch } })
  }
  const skinNow = OUTLINE_SKINS.find((o) => o.value === blogLook.outline.skin) || OUTLINE_SKINS[0]
  /* 색을 안 고르면 파비콘은 탭 배경에 맞춰 뒤집힙니다 — 밝으면 검정, 어두우면 흰색.
     색칸이 늘 검정을 가리키면 어두운 탭에서 보이는 것과 어긋납니다(흰 그림인데 검정이라 적힘).
     그래서 관리자를 보고 있는 이 브라우저의 설정을 그대로 따릅니다 */
  const favAuto = conf.site.faviconBg ? inkOn(conf.site.faviconBg) : (darkTab ? '#ffffff' : '#0b0d10')
  /* 격자 칸이 실제로 칠할 색. 굽기의 `faviconHref` 와 같은 규칙이라야 눈으로 본 것이 나갑니다 */
  const favInk = conf.site.faviconColor || (conf.site.faviconBg ? inkOn(conf.site.faviconBg) : '')
  /* 방금 올린 파일의 이름. 설정에는 주소만 남으므로 새로고침하면 사라집니다 —
     그때는 형식으로 적습니다(없는 이름을 지어내지 않습니다) */
  const favKind = (conf.site.favicon.match(/\.([a-z0-9]+)$/i)?.[1] || '').toUpperCase()
  /* 올린 파일인가. 기본으로 주는 것은 레포(`/assets/favicons/`)에 있고, 올린 것은
     어느 글에도 안 속하는 사이트 전용 자리(`/blog/0/`)에 있습니다 */
  const upFavicon = !!conf.site.favicon && !BUILTIN_FAVICON.test(conf.site.favicon)
  /* 안 골랐으면 이 사이트의 기본 아이콘이 쓰입니다 — 화면도 그것을 눌린 것으로 보여야
     「지금 무엇이 쓰이나」를 고르는 칸이 말해 줍니다(`/api/settings` 의 siteText) */
  const favNow = conf.site.favicon || siteText.favicon || ''
  const setHeader = (patch) => set('header', patch)
  const setLink = (key, patch) => setConf((c) => ({
    ...c, header: { ...c.header, links: { ...c.header.links, [key]: { ...c.header.links[key], ...patch } } },
  }))
  const setItem = (key, patch) => setConf((c) => ({
    ...c, main: { ...c.main, items: (c.main.items || []).map((x) => (x.id === key ? { ...x, ...patch } : x)) },
  }))
  /* ── 푸터 ─────────────────────────────────────────────
     두 벌(메인 / 포트폴리오·블로그)이 footer 키 하나에 함께 저장됩니다. 한 번에 반영·되돌리기 됩니다 */
  const footSet = conf.footer?.[footKind] || footStart(footKind)
  const setFoot = (patch) => setConf((c) => ({
    ...c, footer: { ...c.footer, [footKind]: { ...c.footer[footKind], ...patch } },
  }))
  const setFootItems = (fn) => setConf((c) => ({
    ...c, footer: { ...c.footer, [footKind]: { ...c.footer[footKind], items: fn(c.footer[footKind].items || []) } },
  }))
  const setFootItem = (id, patch) => setFootItems((items) => items.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  /* 목록에 표시할 이름. 입력한 글자가 곧 이름이고, 비면 생성기가 넣을 기본 문구(footText)를
     표시합니다. 아이콘은 글자가 아니라 링크라서 서비스 이름을 씁니다 */
  const footName = (it) => (it.kind === 'icon'
    ? (String(it.text || '').trim() || SERVICE_ICONS.find((x) => x.value === it.service)?.label || '아이콘')
    : (String(it.text || '').trim() || footText[it.id] || '빈 글자'))
  const newFootId = (items, pre) => { let n = 1; while (items.some((x) => x.id === `${pre}${n}`)) n += 1; return `${pre}${n}` }
  /**
   * 푸터에 요소를 추가합니다. 추가한 뒤 바로 선택 상태로 만듭니다. 추가만 하고 어디 생겼는지
   * 모르면 의미가 없습니다.
   * 글자는 왼쪽 여백선(40)에서 아래로 쌓고, 아이콘은 오른쪽 끝에서 왼쪽으로 배치합니다.
   * 기본 배치가 그 형태라서 추가한 요소가 엉뚱한 위치에 놓이지 않습니다.
   */
  const addFoot = (icon) => setFootItems((items) => {
    const id = newFootId(items, icon ? 'i' : 'b')
    const h = footSet.height
    const mine = items.filter((x) => (x.kind === 'icon') === !!icon)
    const next = icon
      /* 「직접 입력」은 이름이 곧 표시 내용이라 정사각으로 두면 말줄임만 남습니다. 이름 길이만큼 넓게 잡습니다 */
      ? { id, kind: 'icon', service: icon, url: '', w: icon === 'link' ? 180 : 52, show: true,
          x: Math.max(40, Math.min(...mine.map((x) => x.x), 1200) - (icon === 'link' ? 190 : 62)),
          y: mine[0]?.y ?? Math.round(h / 3) }
      : { id, text: '새 글자', size: 'body', font: '', color: '', link: '', show: true, auto: true,
          x: 40, y: Math.min(mine.reduce((m, x) => Math.max(m, x.y + 44), 40), Math.max(40, h - 40)), w: 520 }
    wantSel.current = id
    return [...items, next]
  })
  /* 이 아이콘이 실제로 이동할 주소. 생성기의 iconHref 와 같은 규칙입니다.
     지정한 주소 → 사이트 기본값 → 없음 순으로 찾습니다 */
  const footHref = (it) => String(it.url || '').trim() || footIcon[it.service] || ''
  /**
    * 이 요소가 화면에 출력되는지. 생성기와 같은 규칙입니다(글자가 빈 텍스트 박스는 안 그립니다).
    * 출력되지 않는 요소는 미리보기에 없어 편집기로 못 고릅니다. 그런데 주소를 입력하려면
    * 골라야 하므로, 주소 없는 아이콘은 영영 주소를 못 넣는 상태가 됩니다 — 아래 목록이 그런
    * 항목을 데이터만으로 고를 수 있게 합니다.
    */
  const footShown = (it) => (it.kind === 'icon'
    ? true : !!(String(it.text || '').trim() || footText[it.id]))
  /**
    * 목록에서 요소를 선택합니다. iframe 에 그 요소가 실제로 있는지 확인해 분기합니다.
    * footShown 으로 분기하면 안 됩니다 — 관리자가 아는 상태와 생성된 화면이 어긋날 수 있고
    * (방금 고치고 아직 생성하지 않은 사이), 그 상태로 편집기에 넘기면 아무 일도 안 일어납니다.
    * 요소가 없으면 데이터만으로 패널을 엽니다(off).
    */
  const pickFoot = (it, keepFocus = false) => {
    const at = frame.current?.contentDocument
      ?.querySelector(`.foot .m-i[data-i="${CSS.escape(it.id)}"]`)
    if (at && !editorOff) {
      editor.current?.api.select?.(it.id)
      /* 글자 칸에서 부를 때는 초점을 옮기지 않습니다. 칸을 눌러 초점이 온 순간 미리보기
         창으로 초점을 넘기면 커서가 사라져 한 글자도 못 칩니다.
         창에 초점을 주는 까닭은 끌기·⌘Z 를 바로 쓰게 하려는 것이라, 단추로 고를 때만 줍니다 */
      if (!keepFocus) frame.current?.contentWindow?.focus()
      return
    }
    setSel({ key: it.id, x: it.x, y: it.y, w: it.w, h: 0, off: true })
  }
  const footPatch = (it, patch) => {
    if (!patch.service || patch.service === it.service) return patch
    const max = patch.service === 'link' ? FOOT_ICON.textMax : FOOT_ICON.max
    const w = Math.min(Math.max(it.w ?? 52, FOOT_ICON.min), max)
    /* 로고 → 이름 칩은 이름이 들어갈 자리가 필요합니다. 좁은 정사각 그대로면 「…」만 남습니다 */
    return { ...patch, w: patch.service === 'link' && w < 140 ? 180 : w }
  }
  const dropFoot = (id) => {
    if (sel?.key === id) setSel(null)
    setFootItems((items) => items.filter((x) => x.id !== id))
  }
  /**
   * 상자 이름 — 제가 쓴 글자가 곧 이름입니다.
   * 비어 있으면 굽기가 채울 기본 글자를(`stageText`) 알려 주고, 그것도 없으면 「빈 글자」.
   */
  const boxName = (it) => (it.text || '').trim() || stageText[it.id] || '빈 글자'

  /* 새 상자의 id — 겹치지 않게. 사람이 읽을 일이 없어 짧게 */
  const newId = (items) => { let n = 1; while (items.some((x) => x.id === `b${n}`)) n += 1; return `b${n}` }
  /** 빈 자리에 상자를 놓고 바로 고르게 합니다 — 놓기만 하고 어디 갔는지 모르면 소용이 없습니다 */
  const addBox = (extra = {}) => setConf((c) => {
    const items = c.main.items || []
    const id = newId(items)
    /* 아래로 쌓되 board 를 넘지 않게 합니다. 가로는 여백선(40)에서 시작합니다 */
    const y = Math.min(items.reduce((m, x) => Math.max(m, x.y + 60), 120), Math.max(120, c.main.stage.height - 80))
    /* 글자가 빈 채로 생성하면 생성기가 걸러내서 화면에 출력되지 않고, 출력되지 않으니
       선택할 수도 없습니다. 템플릿 기본 박스는 site.config 가 기본 문구를 채워 주지만
       사용자가 추가한 박스에는 채울 값이 없습니다 */
    const next = { id, text: '새 글자', x: 40, y, w: 600, show: true,
                   size: 'body', font: '', color: '', link: '', ...extra }
    /* 여기서 바로 선택할 수 없습니다. 미리보기는 잠시 뒤에 다시 생성되므로 그 요소가 아직
       iframe 에 없습니다. id 만 기록해 두면 새 문서가 로드된 뒤 paint 가 선택합니다 */
    wantSel.current = id
    return { ...c, main: { ...c.main, items: [...items, next] } }
  })
  const dropBox = (id) => setConf((c) => {
    if (sel?.key === id) setSel(null)
    return { ...c, main: { ...c.main, items: (c.main.items || []).filter((x) => x.id !== id) } }
  })

  /**
    * 사진 업로드. 글의 사진과 같은 엔드포인트(POST /api/media)를 uploadMood 로 호출합니다.
    * 글 번호 자리에 0 을 넣습니다 — 글 번호는 1부터라 0 은 어느 글에도 속하지 않는 사이트
    * 전용 폴더가 됩니다(/blog/0/…). 생성기는 글 폴더를 삭제하지 않으므로 안전합니다.
    * 원본을 그대로 올리지 않습니다: uploadMood 가 긴 변 2000px WebP 로 변환합니다.
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

  /* 업로드하는 동안 사용자가 높이를 조작할 수 있습니다. conf 를 클로저로 캡처하면 업로드
     전 값으로 되돌아가므로, setConf 콜백이 받는 최신 값에 얹습니다 */
  const putStage = (patch) => setConf((c) => ({ ...c, main: { ...c.main, stage: { ...c.main.stage, ...patch(c.main.stage) } } }))

  /**
   * uploadMood 의 반환값을 설정 저장 형태로 변환합니다.
   *
   * uploadMood 의 thumb 은 경로가 아니라 id 입니다. 무드보드는 DB 가 경로로 변환해 주지만
   * 여기서는 설정 jsonb 에 그대로 저장되므로 경로로 만들어야 합니다. 원본과 같은 폴더의
   * 파일 이름만 교체합니다. /blog/0/ 을 직접 쓰면 폴더 규약이 두 군데가 됩니다.
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
   * 파비콘은 줄이지 않고 그대로 올립니다 — SVG 를 캔버스로 다시 그리면 어두운 탭에서
   * 색을 뒤집는 <style> 이 사라집니다. 서버가 형식·크기·알맹이를 봅니다.
   *
   * 실패를 `setErr` 로 안 보내는 까닭: 그 글자는 패널 **맨 위**에 뜹니다(위 `err` 렌더).
   * 파비콘 칸은 「설정」 맨 아래라, 파일을 고른 사람은 올라가 봐야 까닭을 압니다.
   * 「스크립트가 든 SVG 라 못 쓴다」를 못 읽으면 거부하는 뜻이 없어집니다 — 그래서
   * 이 자리에서만 쓰는 줄을 따로 두고 칸 바로 밑에 붙입니다.
   */
  const pickFavicon = async (file) => {
    if (!file) return
    setFavErr('')
    setBusy('favicon')
    try {
      const at = await uploadFavicon(file)
      setSite({ favicon: at })
      setFavName(file.name || '')
    } catch (e) {
      setFavErr(String(e.message || e))
    } finally { setBusy('') }
  }

  /* 올린 것을 빼면 이 사이트의 기본 아이콘으로 돌아갑니다 — 빈 값도 같은 뜻이지만,
     빈 값으로 두면 관리자 격자에서 아무것도 안 눌린 것처럼 보입니다 */
  const dropFavicon = () => {
    setFavErr(''); setFavName('')
    setSite({ favicon: siteText.favicon || '', faviconColor: '' })
  }

  /**
   * 사진은 두 곳에 저장됩니다. shots(세로 나열)와 slides(배너)이고 각자 별도 목록입니다.
   * knob 은 켜져 있는 섹션만 표시합니다. 화면에 없는 것을 조작하는 컨트롤은 눌러도 반응이 없어 버그로 보입니다.
   */
  const shownSec = (key) => !!(conf.main.sections || []).find((x) => x.key === key)?.show
  const shotsOf = (slot) => conf.main.stage[slot] || []
  /* setConf 콜백이 받는 최신 값에 얹습니다. 캡처한 conf 로 배열을 다시 만들면, 업로드 중에
     순서를 바꿀 때 방금 업로드된 사진이 사라집니다 */
  const putShotsIn = (slot, fn) => putStage((st) => ({ [slot]: fn(st[slot] || []) }))

  /* 상한을 넘게 선택하면 초과분만 버리고 안내합니다. 몇 장이 왜 등록되지 않았는지 알려야 합니다 */
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
    * 섹션 하나를 켜고 끕니다. 켜면 화면에 보여야 합니다 — 사진 섹션을 켰는데 등록한 사진이
    * 없으면 화면이 그대로라 설정이 안 먹은 것처럼 보입니다. 그래서 빈 섹션을 켜는 순간 견본
    * 사진을 채웁니다(템플릿이 견본을 들고 오는 것과 같은 방식). 끌 때는 사진을 그대로 둡니다.
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
  /* 섹션 순서 변경. 배열에서 한 칸 이동합니다. 배열 순서가 곧 화면 순서입니다 */
  /**
   * 메뉴 순서 변경. order 값을 서로 교환합니다. 섹션(moveSec)은 배열 요소를 교환하지만
   * 링크는 객체라 배열 위치가 없습니다. 그래서 order 두 개를 맞바꿉니다. 결과는 같습니다.
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
    * 배너의 초기 높이를 현재 브라우저 크기에서 잽니다. 슬라이드를 고르는 사용자가 기대하는 것은
    * 열었을 때 배너가 화면을 꽉 채우는 모습이라, 아래 내용이 30px 넘게 노출되지 않게 창 높이에서
    * 그만큼 뺍니다. 어휘에 고정값으로 못 넣어(거기서는 창 크기를 모릅니다) 고르는 순간 잽니다.
    */
  const fullBannerH = () => {
    const h = Math.round((frame.current?.contentWindow?.innerHeight || window.innerHeight) - 30)
    return Math.min(STAGE_H.max, Math.max(STAGE_H.min, h))
  }

  /**
    * 제작 방식(template / code)을 고릅니다.
    * template 으로 막 전환했는데 고른 템플릿이 커스텀이면 아무것도 안 고른 것과 같습니다 —
    * 커스텀은 직접 고르는 항목이 아니라 배치를 고쳤을 때 도달하는 상태입니다. 그럴 때만 첫
    * 템플릿으로 세우고, 이미 고른 템플릿이 있으면 안 건드립니다.
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

  /** 메인 템플릿 변경. 배치는 그 템플릿의 시작 배치로 바꾸고 글자는 유지합니다 */
  const switchMain = (value) => {
    const st = mainStart(value)
    if (value === 'slides') st.stage.slideH = fullBannerH()
    setConf((c) => ({
      ...c,
      main: {
        ...c.main, template: value, stage: st.stage, sections: st.sections,
        /**
         * 템플릿 박스는 새 템플릿의 것으로 통째로 교체합니다. 이전 템플릿에만 있던 박스가
         * 남으면 선택한 템플릿과 화면이 어긋납니다. 같은 id 가 있으면 좌표만 바꾸고 수정한
         * 글자는 유지합니다.
         * 사용자가 직접 추가한 박스(b1 등)는 템플릿 소유가 아니므로 그대로 남습니다.
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

  /** 그 탭의 템플릿 어휘 한 벌 */
  const tplOf = (which, value) => TEMPLATES[which].find((t) => t.value === value)

  /**
   * 템플릿을 갈면 사라질 것이 있나.
   *
   * 메인은 배치를 손대면 template 이 `custom` 으로 바뀌므로 그 값이 곧 표시입니다.
   * 포트폴리오에는 그런 표시가 없어서, 지금 수치가 이 템플릿의 기본값과 다른지로 봅니다.
   * detailTop·detailGap 은 목록이 아니라 상세 화면의 값이고 템플릿을 갈아도 넘어가므로
   * (applyTemplate) 셈에서 뺍니다 — 넣으면 상세 여백만 고친 사람에게 엉뚱한 확인창이 뜹니다.
   */
  const willLose = (which) => {
    if (which === 'main') return conf.main.template === 'custom'
    const base = tplOf(which, conf[which].template)?.knobs
    return !!base && Object.keys(base).some((k) => conf[which].knobs?.[k] !== base[k])
  }

  /**
   * 템플릿을 갈아 끼웁니다. 메인은 배치까지 함께 바뀌므로 switchMain 이 맡습니다.
   *
   * knob 도 그 템플릿의 값으로 되돌립니다. 템플릿만 갈면 앞서 고른 수치(단 수·비율·간격·여백)가
   * 그대로 남아, 인스타그램을 골라도 베한스의 3단 4:3 간격 12px 로 렌더링됩니다 — 다 같은
   * 마크업이라 고른 티가 안 납니다. 고른 뒤에 knob 을 다시 만지는 건 그대로 됩니다.
   */
  const applyTemplate = (which, value) => {
    if (which === 'main') { switchMain(value); return }
    const o = tplOf(which, value)
    const next = { template: value }
    if (o.knobs) next.knobs = { ...o.knobs, detailGap: conf[which].knobs?.detailGap ?? 0, detailTop: conf[which].knobs?.detailTop ?? 48 }
    /* 블로그 템플릿은 글꼴 짝을 들고 옵니다 — 누르면 글꼴 칸도 그 짝으로 */
    if (o.font) next.font = { display: o.font.display, body: o.font.body }
    /* 블로그는 고른 카테고리(또는 기본)의 블록으로 — `set('blog', …)` 로 두면 늘 기본만 바뀝니다 */
    if (which === 'blog') setBlogLook(next); else set(which, next)
    setAsk(null)
  }

  /**
   * 「카드」 갈래의 테마를 갈아 끼웁니다. 템플릿을 누를 때와 같은 결로 돕니다 —
   * 테마가 글꼴 짝을 들고 오고(터미널은 고정폭, 스케치는 손글씨), 손으로 고친 색·모서리는
   * 그 테마의 기본으로 되돌립니다. 안 되돌리면 터미널의 초록 선이 스케치에 그대로 남습니다.
   */
  const applySkin = (value) => {
    const o = OUTLINE_SKINS.find((x) => x.value === value)
    const next = { outline: { skin: value, ink: '', bg: '', radius: '' } }
    if (o?.font) next.font = { display: o.font.display, body: o.font.body }
    setBlogLook(next)
    setAsk(null)
  }
  /* 색·모서리를 하나라도 고쳤으면 「손댐」입니다. 테마는 저장된 값이 곧 표시라 비교할 것이 없습니다 */
  const willLoseSkin = () => {
    const o = blogLook.outline
    return !!(o.ink || o.bg || o.radius !== '')
  }

  const selItem = sel && (conf?.main.items || []).find((i) => i.id === sel.key)
  /* 푸터 쪽 선택. 편집기는 한 번에 board 하나에만 붙으므로 둘이 동시에 선택되지 않습니다 */
  const footItem = sel && (footSet.items || []).find((i) => i.id === sel.key)
  const ci = contrast(conf.theme.ink, conf.theme.paper)
  /* 헤더 색이 비어 있으면 테마 색을 따릅니다. 빈 값끼리 대비를 계산하면 0 이 나와 반영이 막힙니다 */
  const hdBg = conf.header.bg || conf.theme.paper
  const hdFg = conf.header.color || conf.theme.ink
  const hc = headerContrast(conf.theme, conf.header)
  const bc = buttonContrast(conf.theme, conf.header)
  const tabKeys = TABS.find((t) => t.key === tab).keys
  /* accent 는 직접 선택하는 자리가 없고 프리셋이 정합니다. accent 대비는 서버가 전경색으로
     대신 검사합니다.
     현재 탭이 전송하는 키만 검사합니다. 공통 탭의 대비가 부족하다고 포트폴리오 반영까지 막으면,
     이유 문구가 공통 탭에만 있어서 왜 막혔는지 알 수 없습니다 */
  const bad = (tabKeys.includes('theme') || tabKeys.includes('header')) && (ci < INK_MIN || hc < INK_MIN || bc < INK_MIN)

  const tabDef = TABS.find((t) => t.key === tab)
  const here = { ...tabDef, path: previewPath }
  const setHead = (patch) => setPage({ head: { ...page.head, ...patch } })
  /**
   * 상세 knob 을 조작하면 상세 화면을 엽니다. 포트폴리오 미리보기는 목록이라 상단 여백과
   * 상하 간격이 보일 자리가 없습니다. 설정은 적용되는데 화면에 보이지 않으면 사용자는 버그로 읽습니다.
   * zoom 이 popup 이면 첫 작업의 팝업을, 이동이면 첫 작업 페이지를 엽니다.
   * 이미 상세 화면이면 그대로 둡니다.
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
  const setFont = (patch) => setPage({ font: { ...page.font, ...patch } })

  /** 현재 탭에서 변경된 키만 전송합니다. 같은 값의 리비전을 쌓지 않습니다 */
  const changed = here.keys.filter((k) => JSON.stringify(conf[k]) !== saved.current[k])
  /**
   * 카테고리는 **따로 저장합니다** — 「사이트에 적용」과 별개입니다.
   *
   * 카테고리는 설정 키 `blog` 안에 살지만, 하는 일이 다릅니다: 페이지와 메뉴를 만들고 지웁니다.
   * 이름만 쳐 놓고 저장됐는지 알 수 없으면 쓸 수가 없습니다(사용자 지적).
   *
   * 저장할 때 **나머지는 저장된 값 그대로** 두고 `categories` 만 갈아 보냅니다. 그래서 템플릿이나
   * 문단 바로가기를 고치던 중에 카테고리를 저장해도 그쪽은 안 나갑니다 — 그것들은 여전히
   * 「사이트에 적용」이 맡습니다.
   */
  const catsDirty = (() => {
    try { return JSON.stringify(JSON.parse(saved.current.blog || 'null')?.categories || [])
      !== JSON.stringify(conf.blog.categories || []) } catch { return true }
  })()
  const saveCats = async () => {
    setErr(''); setBusy('catsave')
    try {
      const base = JSON.parse(saved.current.blog || 'null') || conf.blog
      const value = { ...base, categories: conf.blog.categories || [] }
      const d = await api('/settings', { method: 'POST', body: JSON.stringify({
        key: 'blog', value, also: { theme: conf.theme, header: conf.header, footer: conf.footer },
      }) })
      /* 서버가 정규화한 카테고리만 받아 옵니다. 나머지(아직 반영 안 한 모양)는 손대지 않습니다 */
      const got = d?.value?.categories || []
      saved.current.blog = JSON.stringify(d.value)
      setConf((c) => ({ ...c, blog: { ...c.blog, categories: got } }))
      onCats?.(got)
      api('/settings').then((r) => setCatCounts(r.categoryCounts || {})).catch(() => {})
      say('카테고리를 저장했습니다')
      if (d?.bakeError) throw new Error('저장은 됐지만 화면을 굽지 못했습니다: ' + d.bakeError)
      setBust((n) => n + 1)
    } catch (e) { fail(e) } finally { setBusy('') }
  }
  const apply = async () => {
    setErr(''); setBusy('apply')
    const sent = []
    try {
      for (const key of changed) {
        const d = await api('/settings', { method: 'POST', body: JSON.stringify({
          /**
            * also 에 theme, header, footer 셋을 모두 실어 보냅니다. 서버의 대비 검사가 이 셋을 합쳐
            * 판정하는데 하나라도 빠지면 그 자리에 저장된 이전 값이 들어갑니다.
            * 푸터 색을 한 번이라도 지정한 사이트에서 테마를 바꾸면 이전 푸터 색과 충돌해 400 이 나고,
            * 첫 키에서 중단되므로 아무것도 반영되지 않습니다. 미리보기는 통과해 원인을 찾기 어렵습니다.
            */
          key, value: conf[key], also: { theme: conf.theme, header: conf.header, footer: conf.footer },
        }) })
        /* 서버가 정규화한 값을 받아서 반영합니다. accent 가 전경색으로 보정되거나 빈 이름이
           기본값으로 채워졌을 때 받지 않으면, 반영 버튼이 다시 활성화되고 누를 때마다 같은
           리비전이 쌓입니다 */
        if (d.value !== undefined) setConf((c) => ({ ...c, [key]: d.value }))
        saved.current[key] = JSON.stringify(d.value ?? conf[key])
        /* 작업물 목록의 공개 여부 표시는 실제로 반영된 값을 기준으로 합니다.
           선택만 한 값으로 표시하면 실제 상태와 다릅니다 */
        if (key === 'portfolio') onWorks?.((d.value ?? conf.portfolio)?.mode === 'template')
        /* 글 목록·편집기가 들고 있는 카테고리 목록도 같이 — 반영한 뒤 글쓰기로 가면 새 카테고리가 보여야 합니다 */
        if (key === 'blog') { freshCats.current.clear(); onCats?.((d.value ?? conf.blog)?.categories || []) }
        sent.push(key)
        if (d?.bakeError) throw new Error('저장은 됐지만 화면을 굽지 못했습니다: ' + d.bakeError)
      }
      setBust((n) => n + 1)
      say(sent.length ? '적용 되었습니다.' : '바뀐 것이 없습니다')
    } catch (e) { fail(e) } finally {
      /* 중간에 실패해도 이미 반영된 키는 되돌릴 수 있어야 합니다 */
      if (sent.length) setBatch((b) => ({ ...b, [tab]: sent }))
      setBusy('')
    }
  }

  /**
   * 되돌리기 대상은 마지막 반영에 포함된 키뿐입니다. 어떤 키에 이전 리비전이 없으면 그 키만
   * 건너뜁니다. 거기서 중단하면 절반만 되돌아간 상태가 남습니다.
   * 한 번 되돌리면 버튼이 사라집니다.
   */
  const undoKeys = batch[tab] || []

  /* code 모드가 현재 읽는 파일. 안내 박스가 이 경로를 그대로 표시합니다.
     생성기의 fragmentPath 와 같은 규칙입니다 */
  const sample = code ? (PAGE_SAMPLES[tab] || []).find((x) => x.value === conf[tab].source) : null
  const srcRel = !code ? '' : sample ? `sample-pages/${sample.value}.html` : `pages/${tab}.html`
  const sampleNo = sample ? PAGE_SAMPLES[tab].indexOf(sample) + 1 : 0
  const copyCmd = sample ? `cp ${srcRel} pages/${tab}.html` : ''
  const undo = async () => {
    setErr(''); setBusy('undo')
    const skipped = []
    try {
      /* 나중에 반영한 것부터 되돌립니다. 테마를 먼저 되돌리면 아직 되돌리지 않은 헤더 색과
         충돌해서 대비가 부족한 조합이 잠시라도 공개면에 출력됩니다. 서버도 그 조합을 거절합니다 */
      for (const key of [...undoKeys].reverse()) {
        try {
          const d = await api('/settings/undo', { method: 'POST', body: JSON.stringify({ key }) })
          setConf((c) => ({ ...c, [key]: d.value }))
          saved.current[key] = JSON.stringify(d.value)
          if (key === 'portfolio') onWorks?.(d.value?.mode === 'template')
          if (key === 'blog') onCats?.(d.value?.categories || [])
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


          {/* ════ 공통 ════ 세 화면 전부에 적용되는 설정.
               순서는 화면에 표시되는 순서를 따릅니다. 위에 헤더, 그 아래 본문 콘텐츠.
               색과 글꼴을 먼저 두면 수정하는 순서와 화면 순서가 반대가 됩니다 */}
          {tab === 'common' && (<>
            {/* 공통 탭의 설정은 생성기가 만드는 화면에만 적용됩니다. code 모드 화면은 자체
                 site.css 를 쓰므로 여기서 선택한 색과 헤더가 적용되지 않습니다.
                 맨 위에 안내하지 않으면 설정이 반영되지 않는 것으로 오해합니다 */}
            <p className="lkHint band lkLead">
              메인/포트폴리오 페이지를 <b>직접 디자인</b> 하실 경우,
              해당 공통 적용 내용은 <b>블로그</b>에만 적용됩니다.
            </p>
            {/**
             * 공통 탭은 메뉴 · 헤더 · 콘텐츠 · 푸터 넷으로 나뉩니다. 한 페이지에 이어 붙이면
             * 어디서 무엇을 수정하는지 구별하기 어렵습니다.
             *
             * 이 상태를 tab 에 섞지 않습니다. bad, changed, undoKeys, 미리보기 iframe 의 key 가
             * 전부 1차원 tab 에 묶여 있어서 TABS.find 가 실패하면 렌더링이 중단됩니다.
             * 서브탭이 수정하는 키는 여전히 theme, header, footer 셋뿐이라 위 계산은 그대로 맞습니다.
             */}
            <div className="lkSub" role="tablist" aria-label="공통 설정">
              {COMMON_SUBS.map((s) => (
                <button key={s.key} type="button" role="tab" aria-selected={sub === s.key}
                        onClick={() => setSub(s.key)}>{s.label}</button>
              ))}
            </div>
            {/* 탭 이름이 곧 머리글입니다 — 여기에 `h3` 를 또 두면 「메뉴」 안에 「메뉴 스타일」이
                 한 번 더 적힙니다. 안쪽 구분은 `h4` 가 맡습니다(원래 쓰던 그대로) */}
            {sub === 'head' && (<>
            <label className="lkField">
              <span>제목</span>
              <input type="text" maxLength={40} value={conf.header.title}
                     placeholder="ex) 사이트 이름"
                     onChange={(e) => setHeader({ title: e.target.value })} />
            </label>

            <h4>제목 정렬</h4>
            <Pick list={ALIGNS} value={conf.header.align} onPick={(v) => setHeader({ align: v })} />

            {/* 제목이 아니라 헤더 띠의 폭입니다 — 나가는 것이 `s-w-narrow|s-w-wide` 다 */}
            <h4>헤더 넓이</h4>
            <Pick list={HEAD_WIDTHS} value={conf.header.width} onPick={(v) => setHeader({ width: v })} two />

            {/* 띠의 높이 — 여백만 늘어납니다(글자 크기는 그대로).
                 범위는 어휘(`HEAD_H`)와 같습니다: 여기서만 넓히면 서버가 거절해 저장이 400 으로 튕깁니다.
                 아래쪽 48 은 햄버거 34px 이 정한 하한입니다.
                 shape 에 넣지 않습니다. CSS 변수라 즉시 반영으로 충분하고, 넣으면 드래그할 때마다 재생성됩니다 */}
            <h4>헤더 높이</h4>
            <label className="lkSlide">
              <span>높이 <b>{conf.header.height}px</b></span>
              <input type="range" min={HEAD_H.min} max={HEAD_H.max} step={HEAD_H.step}
                     value={conf.header.height}
                     onChange={(e) => setHeader({ height: +e.target.value })} />
            </label>

            {/* 글자 크기 — 한 숫자가 셋을 같이 움직입니다(사이트 이름 · 헤더 링크 · 드로어 링크).
                 백분율 정수로 셉니다: 이 레포의 knob 값은 전부 정수라(`pickNum` 이 반올림) 1.3 을
                 저장하면 1 로 보정되어 조용히 적용되지 않습니다. 생성기가 100 으로 나눠 --hd-size 를 출력합니다.
                 높이와 마찬가지로 shape 에 넣지 않습니다. 드래그할 때마다 재생성하면 안 됩니다 */}
            <h4>헤더 글자 크기</h4>
            <label className="lkSlide">
              <span>크기 <b>{conf.header.size}%</b></span>
              <input type="range" min={HEAD_SCALE.min} max={HEAD_SCALE.max} step={HEAD_SCALE.step}
                     value={conf.header.size}
                     onChange={(e) => setHeader({ size: +e.target.value })} />
            </label>

            <div className="lkRow">
              {/* 비어 있으면 본문 테마 색을 보여 주기만 합니다 — 만지는 순간 그 색으로 고정됩니다 */}
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

            {/* 헤더의 생김새(제목·폭·색)와 메뉴는 고치는 결이 다릅니다 — 탭을 가릅니다 */}
            {sub === 'menu' && (<>
            <h4>메뉴 위치</h4>
            <Pick list={MENU_PLACES} value={conf.header.menu} onPick={(v) => setHeader({ menu: v })} two />
            {conf.header.menu === 'sidebar' && (() => {
              const sb = conf.header.sidebar
              const putSb = (patch) => setHeader({ sidebar: { ...sb, ...patch } })
              return (<>
                <h4>사이드바 갈래</h4>
                <Pick list={SIDEBARS} value={sb.kind} onPick={(v) => putSb({ kind: v })} />
                {/* 「다운슬라이드」는 화면을 통째로 덮으므로 정할 넓이가 없습니다 —
                     반영되지도 않는 knob 을 열어 두면 버그로 보입니다 */}
                {sb.kind !== 'center' && (
                  <label className="lkSlide">
                    <span>사이드바 넓이 <b>{sb.width}px</b></span>
                    <input type="range" min={DRAWER_W.min} max={DRAWER_W.max} step={DRAWER_W.step}
                           value={sb.width} onChange={(e) => putSb({ width: +e.target.value })} />
                  </label>
                )}
                <div className="lkRow">
                  {/* 배경만 바꾸면 검은 글씨가 묻힙니다 — 글자색을 짝으로 둡니다 */}
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
              * 메뉴 한 줄의 생김새 — 자리마다 따로입니다.
              * 지금 고른 자리의 것만 냅니다: 헤더면 헤더 값, 사이드바면 사이드바 값.
              * 둘을 한 화면에 같이 표시하면 어느 쪽을 수정하는지 구별하기 어렵습니다.
              *
              * 모서리는 윤곽이 있을 때만 엽니다 — 테두리도 배경도 없으면 아무리 둥글려도
              * 눈에 안 보이고, 안 보이는 것을 만지게 두면 고장 난 줄 압니다.
              * 값은 지우지 않습니다. 다시 윤곽이 생기면 이전에 선택한 모서리가 그대로 적용됩니다.
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
                  {/* 비어 있으면 따르는 색을 보여 주기만 합니다 — 만지는 순간 그 색으로 고정됩니다 */}
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
            {/* 아이콘은 사이드바의 「아이콘」 벌에서만 화면에 나갑니다(굽기의 `withIcon`).
                 헤더 벌에는 아이콘이 없습니다 — `NAV_STYLES` 여섯 중 아무도 도형을 안 씁니다 */}
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
                {/* 아이콘 단추 — 「아이콘」 벌일 때만 보입니다. 다른 벌에서는 굽기가 도형을
                     안 내므로 골라 봐야 아무 일도 안 일어납니다(고를 수 있는데 반영되지 않는 값은 두지 않습니다) */}
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
                {/* 차례 — 「목록」의 ↑↓ 와 같은 부품입니다(생김새가 갈리면 사용자가 지적합니다).
                     끈 줄도 옮길 수 있습니다 — 막으면 숨긴 항목을 영영 못 움직입니다 */}
                <button type="button" disabled={i === 0} aria-label={`${l.label} 위로`}
                        onClick={() => moveLink(l.key, -1)}>↑</button>
                <button type="button" disabled={i === seq.length - 1}
                        aria-label={`${l.label} 아래로`}
                        onClick={() => moveLink(l.key, 1)}>↓</button>
              </div>
              {/* 어느 페이지로 가는가 — 이름은 바꿀 수 있어도 주소는 정해져 있습니다.
                   안 보이면 「블로그」를 「소식」으로 고친 사람이 어디로 가는지 알 수 없습니다 */}
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
              * 본문 폭 — 사이트에 하나뿐인 숫자입니다. 넷(공통헤더 띠·메인 콘텐츠 영역·블로그
              * 목록·포트폴리오 목록)이 「본문 폭」을 고르면 전부 이 값을 따릅니다.
              * shape 에 넣지 않습니다 — CSS 변수라 liveCss 의 즉시 반영으로 충분하고, 넣으면
              * 슬라이더를 한 칸 만질 때마다 사이트를 통째로 다시 생성합니다.
              */}
            <h4>본문 폭</h4>
            <Pick list={WIDTHS} two value={conf.theme.width}
                  onPick={(v) => set('theme', { width: v })} />
            {/* 숫자는 「본문 폭」일 때만 뜻이 있습니다 — 화면 폭에는 정할 수치가 없습니다.
                 상한이 1800 이라 더 넓은 화면에서는 여백만 늘어납니다: 거기까지 쓰려면
                 「화면 폭」이 답입니다 */}
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
              {/* 프리셋이 정하는 것은 색과 글꼴뿐입니다. 본문 폭은 프리셋의 값이 아니므로 누를 때
                     유지하고(...c.theme 을 먼저 전개), 선택 여부를 볼 때도 프리셋이 가진 키만
                     비교합니다. 전체를 비교하면 폭 하나 때문에 어느 프리셋도 선택되지 않은
                     것으로 표시됩니다 */}
              {THEME_PRESETS.map((t) => (
                <button key={t.value} type="button" className="lkChip"
                        aria-pressed={Object.keys(t.theme).every((k) => t.theme[k] === conf.theme[k])}
                        onClick={() => setConf((c) => ({ ...c, theme: { ...c.theme, ...t.theme } }))}>
                  {/* 아이콘은 이 프리셋이 실제로 바꾸는 두 색만 보입니다 — 콘텐츠 배경색 위에 콘텐츠폰트색.
                       accent 점을 찍었더니 화면 어디에도 안 보이는 색이라 실제 결과와 어긋났습니다 */}
                  <span className="lkSwatch" aria-hidden="true"
                        style={{ background: t.theme.paper, color: t.theme.ink }}>가</span>{t.label}
                </button>
              ))}
            </div>
            <div className="lkRow">
              {/* accent 는 고르지 않습니다 — 프리셋의 값을 그대로 씁니다.
                   링크 호버·포커스 테두리가 이 색이라 데이터에서는 빼지 않습니다 */}
              {[['paper', '콘텐츠 배경색'], ['ink', '콘텐츠폰트색']].map(([k, label]) => (
                /* 따를 상위가 없습니다 — 이 둘은 늘 실제 색이라 「비우기」가 없습니다 */
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
              * 푸터 — 화면 맨 아래의 푸터. 두 벌입니다: 메인은 연락이 목적지라 크고,
              * 포트폴리오·블로그는 다 보고 난 자리라 얇습니다.
              *
              * 판은 메인 콘텐츠 영역과 같은 부품(`.m-board`)이라 끌기·안내선·⌘Z 가 그대로 따라옵니다.
              * knob(높이·간격·선·색)는 전부 CSS 변수라 다시 굽지 않고 창에 바로 반영됩니다(`paintFoot`).
              */}
            {sub === 'foot' && (() => {
              const fc = footerContrast(conf.theme, footSet)
              const lineShown = footSet.line.color || conf.theme.ink
              /**
               * 직접 디자인 화면에는 푸터가 없습니다. 조각(`pages/*.html`)이 제 푸터를 들고 오므로
               * 굽기가 위에 또 얹지 않습니다 — 여기서 아무리 고쳐도 그 화면은 안 바뀝니다.
               * 막지는 않습니다. 템플릿으로 바꾸면 그대로 살아납니다. 대신 보고 있는 화면에서
               * 왜 안 바뀌는지 그 자리에서 말해 줍니다.
               */
              const codeAt = footKind === 'main' ? conf.main.mode === 'code'
                : previewPath === '/portfolio/' && conf.portfolio.mode === 'code'
              return (<>
                {/* 어느 푸터를 편집할지. 고르면 미리보기도 그 화면으로 이동합니다(둘은 항상 같이 움직입니다) */}
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
                  {/* 셋 다 비우면 본문 테마를 따릅니다 — 푸터만 어둡게 뒤집는 것이 흔한 판짜기라 열어 둡니다 */}
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
                    {/* 더하기는 데이터 일이라 편집기가 꺼져 있어도 됩니다 — 편집기가 꺼지는 흔한
                         까닭이 「창이 좁습니다」인데, 그때도 상자는 더할 수 있어야 합니다 */}
                    <button type="button" title="글자 상자 더하기" aria-label="글자 상자 더하기"
                            onClick={() => addFoot(null)}>T</button>
                    {/* <select> 를 쓰지 않습니다. macOS 와 Windows 가 option 을 OS 메뉴로
                         렌더링해서 CSS 가 적용되지 않습니다. 글꼴 필드가 Picker 를 쓰는 것과 같은
                         이유입니다. 여기만 시스템 메뉴가 뜨면 한 화면에 두 가지 스타일이 섞입니다 */}
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
                      {/* 글자 박스와 「직접 입력」 칩은 이 자리에서 바로 수정합니다(로고는 글자가 없습니다).
                           선택도 여기서 합니다. 화면에 출력되지 않는 항목도 눌러야 주소나 글자를 넣을 수 있습니다 */}
                      {it.kind !== 'icon' || it.service === 'link' ? (
                        <ItemName icon={it.kind === 'icon' ? '⊕' : 'T'} value={it.text || ''}
                                  placeholder={it.kind === 'icon' ? '무엇인지 (예: 개인 블로그)' : '빈 글자 — 화면에 안 나옵니다'}
                                  onFocus={() => pickFoot(it, true)}
                                  /* 지우면 지워진 채로 둡니다. 항목은 목록에 남아 다시 입력할 수 있고,
                                       화면에 안 나간다는 것은 옆의 「글자 없음」이 알려 줍니다 */
                                  onCommit={(v) => setFootItem(it.id, { text: v })} />
                      ) : (
                        <button type="button" className="lkItemName" disabled={!it.show}
                                onClick={() => pickFoot(it)}>
                          <i aria-hidden="true"><svg viewBox="0 0 24 24"><path d={ICON_OF[it.service] || ''} /></svg></i>
                          {footName(it)}
                        </button>
                      )}
                      {/* 생성기가 렌더링하지 않는 항목은 까닭을 그 자리에 표시합니다 */}
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
                {/* 판 밖으로 끌려 나간 상자 — 끌기는 푸터 높이를 넘어설 수 있습니다(높이는 knob 으로 키우는 값이라
                     막지 않습니다). 대신 안 보이는 까닭을 그 자리에서 말해 줍니다 */}
                {(() => {
                  /* 상자 높이까지 셈합니다 — 굽기의 `hOf` 와 같은 값입니다(글자는 칸의 한 줄, 로고는 제 크기,
                     「직접 입력」 칩은 글자가 정한 40). y 만 보면 밑이 잘린 상자를 놓칩니다 */
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
                {/* 선택한 요소. stage 와 같은 패널을 씁니다.
                     editorOff 여도 패널은 엽니다. 화면에 출력되지 않는 요소(주소 없는 아이콘,
                     글자가 빈 박스)는 편집기가 잡을 수 없는데 수정해야 나타납니다.
                     그때는 좌표도 데이터로 수정합니다(sel.off) */}
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

            {/* ── 설정 — 사이트 전체에 걸리는 것 ──────────────────────────
                 화면의 일부가 아니라 브라우저 탭에 뜨는 것입니다. 그래서 맨 끝입니다. */}
            {sub === 'site' && (<>
              <label className="lkField">
                <span>사이트 명</span>
                <input type="text" maxLength={40} value={conf.site.title}
                       placeholder={siteText.title || 'ex) HONG GILDONG'}
                       onChange={(e) => setSite({ title: e.target.value })} />
              </label>

              <h4>파비콘</h4>
              <div className="lkFav">
                {FAVICONS.map((f) => (
                  <button key={f.value} type="button" className="lkFavOne"
                          aria-pressed={favNow === `/assets/favicons/${f.value}.svg`}
                          onClick={() => setSite({ favicon: `/assets/favicons/${f.value}.svg` })}>
                    <span className={`lkFavWrap${conf.site.faviconBg ? ' on' : ''}`}
                          style={conf.site.faviconBg ? { background: conf.site.faviconBg } : undefined}>
                      <i className="lkFavPic" aria-hidden="true"
                         style={{ '--fav-src': `url(/assets/favicons/${f.value}.svg)`,
                                  ...(favInk ? { background: favInk } : {}) }} />
                    </span>
                    <em>{f.label}</em>
                  </button>
                ))}
                {/* 올리기도 **고르는 것 중 하나**라 같은 격자 안에 둡니다. 밖에 두면 무엇을
                     올리는 자리인지 안 보입니다(실제로 그렇게 보였습니다).
                     한 칸이 아니라 줄을 통째로 쓰는 이유는 셋입니다 — 79px 칸에는 형식 안내를
                     못 넣고, 올린 뒤 파일 이름을 보여 줄 자리가 없고, 열한 번째 칸이 혼자
                     남으면 격자가 어그러집니다. */}
                <button type="button"
                        className={`lkFavUp${upFavicon ? ' on' : ''}${favOver ? ' over' : ''}`}
                        aria-pressed={upFavicon} disabled={busy === 'favicon'}
                        onClick={() => favFile.current?.click()}
                        /* 파일이 아닌 끌기(요소 옮기기)까지 받으면 안 됩니다 — work.jsx 와 같은 규약.
                           preventDefault 를 빼면 브라우저가 그 파일로 페이지를 옮겨 버립니다 */
                        onDragOver={(e) => {
                          if (![...e.dataTransfer.types].includes('Files')) return
                          e.preventDefault(); setFavOver(true)
                        }}
                        onDragLeave={() => setFavOver(false)}
                        onDrop={(e) => {
                          if (![...e.dataTransfer.types].includes('Files')) return
                          e.preventDefault(); setFavOver(false); pickFavicon(e.dataTransfer.files?.[0])
                        }}>
                  {busy === 'favicon'
                    ? <span className="lkFavUpSay"><span className="lkSpin" aria-hidden="true" />올리는 중…</span>
                    : upFavicon
                      ? (<>
                          <img src={conf.site.favicon} alt="" width="22" height="22" />
                          <span className="lkFavUpSay">{favName || `올린 파일 (${favKind})`}</span>
                          {/* 지우기는 칸 안에 있지만 하는 일이 다릅니다 — 버튼 안의 버튼은
                               중첩이 안 되므로 span 으로 그리고 클릭만 가로챕니다 */}
                          <span className="lkFavUpOff" role="button" tabIndex={0}
                                aria-label="올린 파비콘 지우기" title="기본 아이콘으로 돌아갑니다"
                                onClick={(e) => { e.stopPropagation(); dropFavicon() }}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter' && e.key !== ' ') return
                                  e.preventDefault(); e.stopPropagation(); dropFavicon()
                                }}>✕</span>
                        </>)
                      : (<>
                          <span className="lkFavUpSay"><b>＋</b> 내 파일 올리기</span>
                          <em>SVG·PNG·WebP · 64KB</em>
                        </>)}
                </button>
                <input ref={favFile} type="file" accept={FAVICON_ACCEPT} hidden
                       onChange={(e) => { pickFavicon(e.target.files?.[0]); e.target.value = '' }} />
              </div>
              {/* 거부 까닭은 고른 자리 바로 밑에 붙입니다. 위 `err` 은 패널 맨 위라
                   여기서 파일을 고른 사람에게는 안 보입니다 */}
              {favErr && <p className="lkHint bad" role="alert">{favErr}</p>}
              {/* 색 칸은 **늘 같은 자리**에 둡니다. 고른 것에 따라 나타났다 사라지면 누를 때마다
                   아래가 밀려서, 색을 만지려면 먼저 무엇을 눌러야 하는지 배워야 합니다.
                   색은 레포가 가진 그림에 먹습니다 — 기본으로 주는 것들과 public/favicon.svg.
                   올린 파일은 그린 사람의 색이 이미 들어 있으므로 그때만 잠급니다.
                   비우면 밝은 탭에서 검정, 어두운 탭에서 흰색으로 저절로 뒤집힙니다 */}
              <div className="lkRow">
                <ColorField id="fav-color" label="파비콘 색" value={conf.site.faviconColor}
                            shown={conf.site.faviconColor || favAuto}
                            applied={appliedOf('site', ['faviconColor'])}
                            followLabel="기본값으로 되돌리기"
                            disabled={upFavicon} hint="올린 파일은 그대로 나갑니다"
                            onPick={(v) => setSite({ faviconColor: v })} />
                {/* 투명한 그림은 탭 테마에 기댑니다 — 밝으면 검정, 어두우면 흰색으로 뒤집혀야
                     보입니다. 바탕을 깔면 그 의존이 사라져 어느 탭에서든 같은 모양으로 섭니다 */}
                <ColorField id="fav-bg" label="파비콘 배경" value={conf.site.faviconBg}
                            shown={conf.site.faviconBg || '#25436b'}
                            applied={appliedOf('site', ['faviconBg'])}
                            followLabel="없음"
                            disabled={upFavicon}
                            hint="올린 파일은 그대로 나갑니다"
                            onPick={(v) => setSite({ faviconBg: v })} />
              </div>
            </>)}
          </>)}

          {/* ════ 화면별 ════ */}
          {/* 선택한 요소 — 피그마의 오른쪽 칸처럼 숫자로. 패널을 내려도 늘 위에 붙어 있습니다 */}
          {tab === 'main' && sel && selItem && !code && !editorOff && (
            <SelPanel sel={sel} item={selItem} defaults={stageText} sizes={ITEM_SIZES} icons={SERVICE_ICONS} say={say}
                      applied={(appliedOf('main', ['items']) || []).find((x) => x.id === selItem.id)?.color}
                      onPatch={(patch) => setItem(selItem.id, patch)}
                      onAlign={(how) => editor.current?.api.align?.(sel.key, how)}
                      onNum={(k, n) => editor.current?.api.set?.(sel.key, { [k]: n }, true)}
                      onClose={() => editor.current?.api.select?.(null)} />
          )}
          {tab !== 'common' && (<>
          {/* 공통헤더 — 세 탭 모두 맨 위의 같은 자리입니다. 화면마다 자리가 달라지면
               같은 스위치를 탭마다 다시 찾아야 합니다.
               직접 디자인에서도 살아 있습니다: 조각은 컨텐츠 영역만 갖고 헤더는 굽기가 위에 얹습니다. */}
          {/* 탭 바로 밑의 머리칸 — 스위치와 그 스위치가 낳은 귀띔이 한 블록입니다.
               한 덩이여야 아래 그룹과의 사이 여백을 한 곳에서 잡습니다(귀띔이 떠도 안 흔들립니다) */}
          <div className="lkTop">
            <h3 className="lkGroup lkFirst">헤더</h3>
            <div className="lkLink lkChrome">
              <EyeToggle shown={page.chrome} what="공통헤더"
                         onToggle={() => setPage({ chrome: !page.chrome })} />
              <span>사용유무</span>
            </div>
            {/* 막지 않고 알립니다 — 스위치는 늘 먹고, 무엇을 하면 되는지만 일러 줍니다 */}
            {warn.map((w) => <p key={w} className="lkHint warn">{w}</p>)}
          </div>
          {/* ── 블로그: 카테고리 ──
               맨 위에 둡니다. 아래 설정 전부가 「어느 줄을 골랐나」에 걸리므로 고르는 자리가 먼저여야 합니다.

               한 줄이 한 카테고리입니다. 줄 안에서 이름을 고치고, 눈으로 공개를 가르고, ↑↓ 로 차례를
               옮기고, × 로 지웁니다. **고치는 자리가 한 군데뿐입니다** — 전에는 줄에도 입력칸이 있고
               그 아래 또 이름·주소 칸이 있어 같은 것을 두 군데서 쳤습니다(사용자 지적).

               **주소 칸은 없습니다.** 이름에서 자동으로 만듭니다(`autoSlug`). 사용자 지시가
               「카테고리명과 공개 여부만」이었는데 제가 중간에 주소 칸을 끼워 넣었던 것을 되돌린 것입니다.
               주소는 「여기로 갑니다」를 알려 주는 회색 글자로만 보여 줍니다.

               「기본」은 /blog/ 그 자체라 이름도 주소도 공개도 못 고칩니다 — 고를 수만 있습니다. */}
          {tab === 'blog' && (
            <div className="lkCatsBox">
              {/* 편집 단추는 제목 오른쪽에 — 「이 목록을 고친다」는 뜻이라 목록 바로 위가 맞습니다 */}
              {/* 편수는 **머리줄 한 곳**에서만 말합니다 — 고른 카테고리의 것입니다.
                  줄마다 적으면 목록이 숫자로 가득하고, 무엇보다 「기본」 줄의 숫자가 거짓말을 합니다:
                  `categoryCounts['']` 는 분류를 안 한 글만 세는데 기본은 `/blog/` 라 **모든 글**이
                  실리기 때문입니다(2편이라 적고 8편을 싣습니다). 여기서는 그 뜻대로 셉니다 */}
              <h3 className="lkGroup lkFirst lkCatHead">카테고리
                <span className="lkCatMeta">
                  {catCountLabel && <em>{catCountLabel}</em>}
                  {/* 저장은 **편집 중에만** 보입니다. 고칠 수 없는 상태에서 저장 단추가 서 있으면
                      무엇이 저장되는지가 안 붙습니다. 안 바뀌었으면 「저장됨」이라고 말합니다 */}
                  {catEdit && (catsDirty
                    ? <button type="button" className="lkCatSave" disabled={busy === 'catsave'}
                              onClick={saveCats}>{busy === 'catsave' ? '저장 중' : '저장'}</button>
                    : <em className="lkCatSaved">저장됨</em>)}
                  <button type="button" className={'lkCatMode' + (catEdit ? ' is-on' : '')}
                          aria-pressed={catEdit} onClick={() => setCatEdit((v) => !v)}>
                    {catEdit ? '편집 중' : '편집'}
                  </button>
                </span>
              </h3>
              <ul className={'lkCats' + (catEdit ? ' is-edit' : '')}>
                <li className="is-fixed" aria-current={!catNow || undefined}>
                  {/* 기본은 숨길 수 없습니다 — 눈을 흐리게 세워 자리와 뜻을 같이 지킵니다 */}
                  <span className="lkCatEye" aria-hidden="true"><Eye /></span>
                  <button type="button" className="lkCatPick" onClick={() => setCat(null)}>{DEFAULT_LABEL}</button>
                  <span className="lkCatUrl">/blog/</span>
                </li>
                {cats.map((c, i) => (
                  <li key={c.id} className={c.show ? undefined : 'is-off'}
                      aria-current={catNow?.id === c.id || undefined}>
                    {/* 비공개 — 「주소로도 안 열리게」. 그 페이지도 거기 속한 글도 안 나갑니다.
                        보기 상태에서는 상태만 보여 주고 누를 수 없습니다 */}
                    {catEdit
                      ? <EyeToggle shown={c.show} what={c.label || '이름 없는 카테고리'}
                                   onToggle={() => setCatRow(c.id, { show: !c.show })} />
                      : <span className="lkCatEye" aria-hidden="true"><Eye off={!c.show} /></span>}
                    {catEdit
                      ? <input className="lkCatName" type="text" maxLength={CATEGORY_LABEL_MAX}
                               value={c.label} placeholder="카테고리 이름"
                               onFocus={() => setCat(c.id)}
                               onChange={(e) => renameCat(c, e.target.value)} />
                      : <button type="button" className="lkCatPick" onClick={() => setCat(c.id)}>
                          {c.label || <span className="lkCatNone">이름 없음</span>}
                        </button>}
                    <span className="lkCatUrl">/blog/{c.slug}/</span>
                    {/* 차례·지우기는 편집 중에만 — 평소에 늘 서 있으면 줄이 단추로 가득합니다 */}
                    {catEdit && (<>
                      <button type="button" className="lkCatMini" disabled={i === 0}
                              aria-label={`${c.label || '카테고리'} 위로`} onClick={() => moveCat(i, -1)}>↑</button>
                      <button type="button" className="lkCatMini" disabled={i === cats.length - 1}
                              aria-label={`${c.label || '카테고리'} 아래로`} onClick={() => moveCat(i, 1)}>↓</button>
                      <button type="button" className="lkCatMini lkX" title="지우기"
                              aria-label={`${c.label || '카테고리'} 지우기`} disabled={busy === 'cat'}
                              onClick={() => setAsk({ tab, kind: 'cat', value: c.id })}>×</button>
                    </>)}
                  </li>
                ))}
              </ul>
              {/* 더하기도 편집 중에만. 목록 끝에 둡니다 — 제목 옆에 두면 무엇에 더하는지가 안 붙습니다 */}
              {catEdit && (
                <button type="button" className="lkCatAdd" disabled={cats.length >= CATEGORY_MAX}
                        onClick={addCat}>＋ 카테고리 추가</button>
              )}
              {/* 줄 모양 — 카테고리가 하나라도 있어야 줄이 서므로 그때만 냅니다.
                  카테고리마다가 아니라 블로그 한 벌입니다(줄은 카테고리를 건너다니는 길입니다).
                  `set('blog', …)` 로 저장합니다 — 카테고리 전용 저장과 달리 이것은 모양이라
                  「사이트에 적용」이 맡습니다 */}
              {cats.length > 0 && (<>
                <h4 className="lkCatSub">카테고리 디자인</h4>
                {/* 여섯이 세 벌씩 두 줄로 섭니다 — `two` 를 안 줍니다. 두 벌씩이면 석 줄이고
                    썸네일이 줄 모양이라 가로가 짧으면 무엇인지 안 보입니다 */}
                <Pick list={CAT_STRIP_STYLES} value={conf.blog.catStrip}
                      onPick={(v) => set('blog', { catStrip: v })} />
              </>)}
              {/* 구분선은 집에서 쓰는 것 하나입니다 — 1px 옅은 선(`.lkRule`).
                  「기본」과 「상세페이지」 사이에 쓰는 바로 그것이라 패널 안에 한 결만 남습니다.
                  제목(`h3.lkGroup`)의 굵은 먹선을 쓰면 여기만 두꺼워집니다(사용자 지적).
                  위쪽 경계는 안 그립니다 — 바로 앞 `.lkTop` 이 제 아래 선을 갖고 있어 겹칩니다 */}
              <hr className="lkRule" />
            </div>
          )}

          {/* ── 이 화면을 누가 만드는가 ─────────────────────────────────
               블로그에는 없습니다: 글이 DB 에서 오므로 목록을 코드가 꽂아야 합니다 */}
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

          {/* ── 어느 파일을 실을까 ── 고르면 미리보기가 즉시 그 파일로, 「사이트에 적용」이 곧 실제 적용입니다.
               파일은 안 씁니다 — 설정에 이름만 남깁니다(`PAGE_SAMPLES` 주석: 운영 체크아웃을 더럽히지 않으려고) */}
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
                    : '화면에 보이는 내용입니다. 공통헤더와 푸터까지 이 파일에 들어 있습니다.'}</em></dd>
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
          {/* 직접 디자인이면 템플릿 knob 은 통째로 숨깁니다 — 눌러도 안 나가는 단추를 열어 두면
               「반영했는데 안 바뀝니다」가 되고, 잠가만 두면 고를 수 없는 것 때문에 스크롤만 길어집니다.
               값은 conf 에 그대로 있어 템플릿으로 돌리면 고른 그대로 다시 보입니다 */}
          {!code && (
          <fieldset className="lkFs">
            {/* 목록 폭은 여기 없습니다. 폭은 사이트에 하나뿐이라 공통 탭의 콘텐츠에서 정합니다.
                 헤더만 별도 스위치를 갖습니다 */}
            {/* 목록 머리 — 크기·정렬·편수까지 이 화면의 것입니다 */}
            {(tab === 'blog' || tab === 'portfolio') && (<>
              <h3>타이틀</h3>
              <div className="lkLink">
                <EyeToggle shown={page.head.show} what="타이틀"
                           onToggle={() => setHead({ show: !page.head.show })} />
                <input type="text" maxLength={20} value={page.head.name}
                       disabled={!page.head.show} aria-label="타이틀 이름"
                       onChange={(e) => setHead({ name: e.target.value })} />
              </div>
              {/* 타이틀을 숨기면 사이즈·정렬·갯수는 뜻이 없고, 대신 공통헤더와 콘텐츠 사이를 정합니다.
                   보일 때는 타이틀 제 여백이 있어 이 값을 더하면 두 번 띄웁니다 */}
              {!page.head.show && (
                <label className="lkSlide">
                  <span>상단 여백 <b>{page.head.gap}px</b></span>
                  <input type="range" min="0" max="160" step="4" value={page.head.gap}
                         onChange={(e) => setHead({ gap: +e.target.value })} />
                </label>
              )}
              {page.head.show && (<>
                {/* 갯수는 타이틀에 붙는 것이라 타이틀 바로 밑에 둡니다 */}
                <div className="lkLink lkEyeRow">
                  <EyeToggle shown={page.head.count} what="콘텐츠 갯수"
                             onToggle={() => setHead({ count: !page.head.count })} />
                  <span>콘텐츠 갯수 표시</span>
                </div>
                {/* 사이즈는 슬라이더 — 다른 수치 knob 과 같은 모양으로.
                     세 칸(작게·보통·크게)이라 눈금은 셋입니다 */}
                <label className="lkSlide">
                  <span>타이틀 사이즈 <b>{HEAD_SIZES.find((z) => z.value === page.head.size)?.label}</b></span>
                  <input type="range" min="0" max={HEAD_SIZES.length - 1} step="1"
                         value={Math.max(0, HEAD_SIZES.findIndex((z) => z.value === page.head.size))}
                         onChange={(e) => setHead({ size: HEAD_SIZES[+e.target.value].value })} />
                </label>
                <h4>타이틀 정렬</h4>
                <Pick list={ALIGNS.slice(0, 2).map((a) => ({ ...a, hint: '', icon: null }))} value={page.head.align}
                      onPick={(v) => setHead({ align: v })} two />
              </>)}
            </>)}

            {/* 글꼴 — 「기본서체」면 사이트 기본 글꼴을 따릅니다.
                 공통헤더 글꼴과는 따로 갑니다. */}
            <>
              <h3>글꼴</h3>
              <div className="lkRow">
                {FONT_ROLES.map(({ key, label }) => (
                  <FontPick key={key} label={label} value={page.font[key]} onPick={(v) => setFont({ [key]: v })} />
                ))}
              </div>
            </>

            <h3>템플릿</h3>
            <div className="lkPick lkShapes">
              {TEMPLATES[tab].map((o) => (
                <button key={o.value} type="button"
                        aria-pressed={page.template === o.value}
                        /* 커스텀은 고르는 것이 아니라 닿는 곳입니다 — 배치를 고치면 켜집니다 */
                        disabled={o.value === 'custom' && page.template !== 'custom'}
                        onClick={() => {
                          /* 세 탭이 같은 규칙입니다.
                               지금 것              아무 일 없음
                               다른 것 · 안 손댐    바로 적용
                               다른 것 · 손댐       무엇이 사라지는지 묻고 적용

                             지금 것을 다시 누르는 것이 예전엔 「처음 값으로 되돌리기」였습니다.
                             고른 것을 한 번 더 고른 사람이 기대할 동작이 아닙니다 — 베한스를 골라
                             간격을 맞춰 둔 사람이 베한스를 다시 누르면 그 간격이 말없이 사라졌습니다.
                             되돌리려면 다른 것을 눌렀다가 돌아오면 됩니다(그때는 확인창이 섭니다) */
                          if (o.value === page.template) return
                          if (willLose(tab)) { setAsk({ tab, value: o.value }); return }
                          applyTemplate(tab, o.value)
                        }}>
                  {o.icon && <Shape cells={o.icon} />}
                  <b>{o.label}</b><em>{o.hint}</em>
                </button>
              ))}
            </div>


            {/* 확인창은 연 탭에서만 냅니다 — 열어 둔 채 탭을 옮기면 남의 탭에 남의 문구가 섭니다 */}
            {ask?.tab === tab && (
              <div className="lkAsk" role="alertdialog" aria-modal="true"
                   aria-label={tab === 'main' ? '배치 되돌리기' : '설정 되돌리기'}
                   onClick={(e) => { if (e.target === e.currentTarget) setAsk(null) }}>
                <div>
                  {ask.kind === 'cat'
                    ? (() => {
                        const c = cats.find((x) => x.id === ask.value)
                        const n = catCounts[ask.value]?.published || 0
                        /* 무엇이 없어지는지 데이터가 문장을 정합니다(글 목록의 `lossOf` 와 같은 규약) */
                        return <p><b>{c?.label || '이 카테고리'}</b>{eul(c?.label || '이 카테고리')} 지웁니다.
                          {' '}주소 <b>/blog/{c?.slug}/</b> 는 없어지고,
                          {n ? <> 거기 있던 글 <b>{n}편</b>은 초안이 됩니다(글은 사라지지 않습니다 — 목록에서 다시 앉히면 됩니다).</>
                             : ' 거기 있던 발행 글은 없습니다.'}
                          {' '}이 일은 바로 서버에 반영됩니다.</p>
                      })()
                    : ask.kind === 'skin'
                    ? <p><b>{OUTLINE_SKINS.find((o) => o.value === ask.value)?.label}</b>의 기본 모양으로 바꿉니다.
                        고쳐 둔 선 색·배경색·모서리는 사라지고, 글꼴도 그 테마의 짝으로 바뀝니다.</p>
                    : tab === 'main'
                    ? <p><b>{tplOf('main', ask.value)?.label}</b>의 처음 배치로 되돌립니다.
                        옮긴 자리·보이기·목록·사진은 사라지고, 고친 글자는 그대로 둡니다.
                        {' '}직접 더한 상자는 그대로 남습니다 — 그래서 되돌린 뒤에도 「커스텀」으로 표시됩니다.</p>
                    : <p><b>{tplOf(tab, ask.value)?.label}</b>의 기본 설정으로 바꿉니다.
                        맞춰 둔 단 수·비율·간격·여백·모서리는 사라집니다.
                        {' '}작업 상세의 여백은 그대로 둡니다.</p>}
                  <div className="lkAskBtns">
                    <button type="button" onClick={() => setAsk(null)}>취소</button>
                    <button type="button" className="primary"
                            onClick={() => (ask.kind === 'cat' ? dropCat(cats.find((x) => x.id === ask.value))
                              : ask.kind === 'skin' ? applySkin(ask.value) : applyTemplate(ask.tab, ask.value))}>
                      {ask.kind === 'cat' ? '카테고리 지우기' : '되돌리고 바꾸기'}</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── 카드 갈래의 테마 ──
                 고른 갈래일 때만 냅니다. 늘 띄워 두면 다른 갈래를 고른 사람에게
                 눌러도 아무 데도 안 나가는 칸이 열립니다. */}
            {tab === 'blog' && blogLook.template === 'outline' && (<>
              <h3>카드 테마</h3>
              <div className="lkPick lkSkins">
                {OUTLINE_SKINS.map((o) => (
                  <button key={o.value} type="button"
                          aria-pressed={blogLook.outline.skin === o.value}
                          onClick={() => {
                            /* 템플릿과 같은 세 규칙입니다 */
                            if (o.value === blogLook.outline.skin) return
                            if (willLoseSkin()) { setAsk({ tab, kind: 'skin', value: o.value }); return }
                            applySkin(o.value)
                          }}>
                    {/* 테마의 차이는 색과 질감입니다 — 회색 막대(Shape)로는 구별이 안 됩니다 */}
                    <span className="lkSkinChip" aria-hidden="true" data-skin={o.value}
                          style={{ '--c-bg': o.chip[0], '--c-line': o.chip[1], '--c-ink': o.chip[2] }}>
                      <i /><i /><i />
                    </span>
                    <b>{o.label}</b><em>{o.hint}</em>
                  </button>
                ))}
              </div>

              {/* 색은 비우면 테마가 정한 색을 따릅니다 — 푸터 색과 같은 규약(ColorField 의 followLabel) */}
              <div className="lkRow">
                <ColorField id="bo-ink" label="선 색" hint=""
                            value={blogLook.outline.ink}
                            shown={blogLook.outline.ink || skinNow.chip[1]}
                            onPick={(v) => setOutline({ ink: v })}
                            followLabel="테마 기본으로" />
                <ColorField id="bo-bg" label="배경색" hint=""
                            value={blogLook.outline.bg}
                            shown={blogLook.outline.bg || skinNow.chip[0]}
                            onPick={(v) => setOutline({ bg: v })}
                            followLabel="테마 기본으로" />
              </div>

              <label className="lkSlide">
                <span>모서리 <b>{blogLook.outline.radius === '' ? '테마 기본' : `${blogLook.outline.radius}px`}</b></span>
                <input type="range" min="0" max="32" value={blogLook.outline.radius === '' ? 12 : blogLook.outline.radius}
                       onChange={(e) => setOutline({ radius: +e.target.value })} />
              </label>
              {blogLook.outline.radius !== '' && (
                <button type="button" className="lkReset lkResetRow"
                        onClick={() => setOutline({ radius: '' })}>모서리를 테마 기본으로</button>
              )}
              <p className="lkHint">비워 두면 고른 테마가 정한 값이 그대로 쓰입니다.
                {' '}테마를 바꾸면 글꼴 칸도 그 테마의 짝으로 바뀝니다.</p>
            </>)}

            {/* ── 블로그: 글 상세 ──
                 여기까지는 글 목록, 아래는 열린 글의 모양입니다. 같은 탭에 섞여 있어
                 어디부터 상세인지 안 보이므로 포트폴리오와 같은 선으로 끊습니다 */}
            {tab === 'blog' && (<>
              <hr className="lkRule" />
              <h3>상세페이지</h3>
              <div className="lkLink lkEyeRow">
                {/* 「목차」라 부르지 않습니다 — 목록 템플릿에 이미 「목차」가 있어 둘이 겹칩니다 */}
                <EyeToggle shown={blogLook.toc.show} what="문단 바로가기"
                           onToggle={() => {
                             /* 켜고 끈 결과는 목록이 아니라 글 안에 있습니다. 다시 구운 뒤
                                미리보기를 첫 글로 보냅니다(paint 가 받습니다) */
                             setToc({ show: !blogLook.toc.show })
                           }} />
                <span>문단 바로가기</span>
              </div>
              <p className="lkHint">글 오른쪽에 절 제목을 세웁니다. 누르면 그 자리로 옮깁니다.
                {' '}본문에 제목이 있는 글에만 나오고, 좁은 화면에서는 나오지 않습니다.</p>

              {/* ── 지금 읽는 자리 표식 ──
                   켠 사람에게만 냅니다. 꺼 둔 채로 모양을 고르게 하면 눌러도 아무 데도
                   안 나가는 칸이 열립니다(카드 테마와 같은 규칙) */}
              {blogLook.toc.show && (<>
                <h3>지금 읽는 자리 표식</h3>
                <div className="lkPick lkSkins lkTocPick">
                  {TOC_SKINS.map((o) => (
                    <button key={o.value} type="button"
                            aria-pressed={blogLook.toc.skin === o.value}
                            onClick={() => blogLook.toc.skin !== o.value && setToc({ skin: o.value })}>
                      {/* 넷의 차이는 색이 아니라 **모양**입니다 — 색 막대로는 구별이 안 됩니다.
                          선 하나에 표식을 올려 실제로 보이는 그대로 그립니다 */}
                      <span className="lkTocChip" aria-hidden="true" data-skin={o.value}
                            style={{ '--c-ink': blogLook.toc.ink || 'var(--fg)' }}>
                        <u /><i /><b /><b />
                      </span>
                      <b>{o.label}</b><em>{o.hint}</em>
                    </button>
                  ))}
                </div>
                <div className="lkRow">
                  <ColorField id="bj-ink" label="표식 색" hint=""
                              value={blogLook.toc.ink}
                              shown={blogLook.toc.ink || '#101114'}
                              onPick={(v) => setToc({ ink: v })}
                              followLabel="검정으로" />
                </div>
                <p className="lkHint">지금 읽는 절을 표시합니다. 비우면 검정입니다.
                  {' '}모양은 넷 다 글자도 같이 짙어지고 굵어집니다 — 색만으로는 약합니다.
                  {' '}파이어폭스에서는 표식이 나오지 않습니다(브라우저가 아직 못 읽습니다).</p>
              </>)}
            </>)}

            {/* ── 메인: 콘텐츠 영역 · 요소 · 목록 ──
                 요소는 미리보기에서 끌어서 옮기고, 두 번 눌러 글자를 고칩니다. 여기서는 더하고 빼고 고릅니다.
                 목록은 옮기지 않고 차례와 넣을지 말지만 정합니다 */}
            {tab === 'main' && (<>
              {/* ── knob 은 켜져 있는 자리만 냅니다 ──
                   값은 저장되는데 화면이 안 바뀌는 칸은 버그로 보입니다. 어느 자리를
                   켜고 끌지는 맨 아래 「목록」이 정합니다 */}
              {shownSec('stage') && (<>
                <h3>콘텐츠 영역</h3>
                {/* 폭 선택기가 여기 없습니다. board 는 사이트 본문 폭을 그대로 따릅니다.
                     이 값은 여백이 아니라 좌표계라서 폭이 바뀌면 높이도 글자도 같이 바뀝니다
                     (.m-board 주석 참고).
                     범위는 어휘(STAGE_H)와 같아야 합니다. 좁게 두면 서버가 거절하는 값을
                     만들 수 있고, 여기서만 넓히면 저장이 400 으로 실패합니다 */}
                <label className="lkSlide">
                  <span>높이 <b>{conf.main.stage.height}px</b></span>
                  <input type="range" min={STAGE_H.min} max={STAGE_H.max} step="10" value={conf.main.stage.height}
                         onChange={(e) => putStage(() => ({ height: +e.target.value }))} />
                </label>
                {/* 배경 이미지. 업로드한 사진이 콘텐츠 영역 바닥에 깔리고 글자는 그 위에 흰색으로
                     표시됩니다. 제목이 없으면 무슨 기능인지 알 수 없습니다.
                     빈 상태에 「아직 없습니다」만 두면 없다는 사실만 전하고 무엇에 쓰는지는
                     알려주지 못합니다. 아직 채우지 않은 사용자에게 필요한 것은 후자입니다 */}
                <h4>대표 이미지</h4>
                {/* 머리글이 이름을 맡았으므로 줄 앞의 「배경 그림」은 뺍니다 — 한 줄에 이름이 둘이면
                     서로 다른 기능으로 보입니다. 위치는 그대로 두고 설명을 그 자리에 표시합니다 */}
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
                {/* 세로 나열 섹션은 간격이 인상을 좌우합니다. 붙이면 한 장처럼, 띄우면 낱장으로 보입니다 */}
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

              {/* ── 요소 = 글자 상자와 사진이 한 목록에 삽니다 ──
                   더하기 단추도 목록이 정합니다: 꺼 둔 자리에 무언가를 더할 수 있으면,
                   더해 놓고도 화면에 왜 안 나오는지 알 길이 없습니다 */}
              <h3>요소
                {/* 추가할 항목이 하나도 없으면 테두리만 남은 빈 박스가 표시되어 고장처럼 보입니다 */}
                {(shownSec('stage') || SECTION_KINDS.some((k) => k.of && shownSec(k.key))) && (
                <span className="lkAdd">
                  {/* 더하기는 데이터 일이라 편집기가 꺼져 있어도 됩니다 — 편집기가 꺼지는 흔한
                       까닭이 「보일 것이 없습니다」인데, 그때야말로 상자를 더해야 합니다 */}
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
                               /* 목록을 먼저 베껴 둡니다 — 살아 있는 목록이라 칸을 비우면 같이 비워집니다
                                    (`work.jsx` 의 같은 자리 주석) */
                               onChange={(e) => { const files = [...e.target.files]; e.target.value = ''; addShots(k.of, files) }} />
                      </label>
                    )
                  })}
                </span>
                )}
              </h3>
              <ul className="lkItems">
                {/* 글자 상자는 콘텐츠 영역이 켜져 있을 때만 — 꺼 둔 자리의 것을 목록에 세우면
                     목록과 화면이 말없이 어긋납니다. 데이터는 그대로 남아 다시 켜면 돌아옵니다 */}
                {shownSec('stage') && conf.main.items.map((it) => (
                  <li key={it.id} className={it.show ? undefined : 'is-off'} aria-current={sel?.key === it.id || undefined}>
                    <EyeToggle shown={it.show} what={boxName(it)}
                               onToggle={() => {
                                 if (sel?.key === it.id) setSel(null)
                                 setItem(it.id, { show: !it.show })
                               }} />
                    {/* 글자는 이 자리에서 고칩니다 — 목록에서 고르고 판으로 내려가 또 고치게 두지 않습니다 */}
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
                {/* 사진은 x·y 좌표가 아니라 배열 순서로 배치됩니다. 그래서 ↑↓ 가 있고 표시 토글이 없습니다.
                     자리 이름을 앞에 달아 둡니다: 둘이 같이 서면 어느 줄이 어디 것인지 안 보입니다 */}
                {SECTION_KINDS.filter((k) => k.of && shownSec(k.key)).flatMap((k) => {
                  const list = shotsOf(k.of)
                  const tag = k.of === 'slides' ? '슬라이드' : '세로'
                  /* 켜 두었는데 사진이 없으면 화면에는 아무것도 안 나옵니다. 목록에서 켰는데
                     화면이 그대로면 켠 것이 안 먹은 줄 압니다 — 그 자리에서 까닭을 말합니다 */
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
                {/* 아무 자리도 안 켜져 있으면 화면은 흰 종입니다 — 그 사실과 할 일을 말합니다 */}
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
                  /* 숨긴 항목은 이름과 ↑↓ 를 흐리게 표시합니다. 눈 아이콘의 사선만으로는 한눈에 구별되지
                     않습니다. 순서 변경은 막지 않습니다 */
                  <li key={sec.key} className={sec.show ? undefined : 'is-off'}>
    {/* 끌 수 없는 줄은 없습니다. 다 끄면 흰 종이가 맞습니다 — 슬라이드만 세운 한 장짜리,
                         사진만 잇는 한 장짜리를 만들려면 콘텐츠 영역도 꺼져야 합니다 */}
                    <EyeToggle shown={sec.show} what={labelOfSec(sec.key)}
                               onToggle={() => setSec(i, { show: !sec.show })} />
                    <span>{labelOfSec(sec.key)}</span>
                    {/* 차례는 위·아래로 옮깁니다 — 미리보기에서 끌면 무대의 글자 끌기와 겹칩니다 */}
                    <button type="button" disabled={i === 0} aria-label={`${labelOfSec(sec.key)} 위로`}
                            onClick={() => moveSec(i, -1)}>↑</button>
                    <button type="button" disabled={i === conf.main.sections.length - 1}
                            aria-label={`${labelOfSec(sec.key)} 아래로`}
                            onClick={() => moveSec(i, 1)}>↓</button>
                  </li>
                ))}
              </ul>
            </>)}

            {/* ── 포트폴리오 knob ── 조작하는 즉시 미리보기에 반영됩니다.
                 목록 폭은 여기 없습니다. 「만드는 방법」 바로 아래로 옮겼습니다 */}
            {tab === 'portfolio' && (<>
              <h3>컬럼 수</h3>
              <div className="lkNums">
                {/* 1 단은 「수직 이미지」의 값입니다 — 없으면 그 템플릿을 고른 채로는
                     눌린 단추가 하나도 없어 고장으로 보입니다 */}
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

              {/* 여기까지는 목록, 아래는 열린 작업(상세) 의 모양입니다. 같은 탭에 섞여 있어
                   어디부터 상세인지 안 보였습니다 — 패널 끝에서 끝까지 얇은 선으로 끊습니다 */}
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
               아이콘 옆에 이름을 답니다. 아이콘만 두었더니 ✓ 와 ↺ 가 무슨 일을 하는지
               눌러 보기 전에는 알 수 없었습니다. 되돌리기처럼 되돌릴 수
               없는 일일수록 이름이 있어야 합니다.
               도는 동안에도 이름은 그대로 두고 아이콘 자리만 팽이로 바꿉니다 — 단추가
               통째로 비면 폭이 튀어 옆 단추가 움직입니다. */}
          <div className="lkSave">
            <button type="button" className="primary" disabled={!!busy || bad} onClick={apply}
                    title="지금 값을 사이트에 내보냅니다">
              {busy === 'apply' ? <span className="lkSpin" aria-hidden="true" /> : <IconApply />}
              사이트에 적용
            </button>
            {/* 항상 같은 자리에 둡니다. 되돌릴 것이 있을 때만 표시하면 버튼이 탭마다 나타났습니다
                 사라져서, 없는 탭에서는 그런 기능이 있는지도 모릅니다.
                 되돌릴 것이 없으면 비활성화하고 이유를 title 에 적습니다 */}
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
            {/* 두 벌을 둘 다 내줍니다. 더미는 판짜기를 고르라고 있는 것이고, 실제는
                 방문자가 볼 바로 그 화면입니다. 어느 쪽을 보고 있는지 헷갈리면 둘 다 신뢰할 수 없습니다 */}
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

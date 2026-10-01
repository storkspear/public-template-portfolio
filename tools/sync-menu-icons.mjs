#!/usr/bin/env node
/**
 * 메뉴 아이콘 도형을 `shared/menu-icons.mjs` 로 생성합니다.
 *
 * 푸터의 `sync-icons.mjs` 와 규약은 같고 세트만 다릅니다. 나눈 이유는 다음과 같습니다.
 *
 *   푸터 아이콘 = 서비스 브랜드 로고(GitHub·인스타그램…). 각 회사의 상표라
 *                그 서비스로 가는 링크에만, 모양 그대로 씁니다.
 *   메뉴 아이콘 = UI 픽토그램(집·봉투·별…). 상표가 아니라 뜻을 가리키는 그림이라
 *                어느 링크에 걸어도 됩니다.
 *
 * 그리는 방식도 다릅니다. 브랜드 로고는 채움 도형 하나(`fill`)이고, Lucide 는
 * 선 그림(`stroke`)이라 요소가 여럿입니다. 그래서 데이터가 `path` 한 줄이 아니라 `body` 입니다.
 *
 * npm 으로 받는 이유는 이 레포의 규약입니다(`tools/sync-vendor.mjs` 주석). 손으로 내려받은
 * 그림은 출처를 적을 수 없습니다. `lucide-static` 은 ISC 라이선스로 배포돼 상표 제약이 없습니다.
 *
 *   npm i -D lucide-static && node tools/sync-menu-icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { bodyOf } from './lucide.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'node_modules/lucide-static/icons')
const pkg = JSON.parse(await readFile(join(ROOT, 'node_modules/lucide-static/package.json'), 'utf8'))

/**
 * 메뉴 한 줄에 걸 만한 것 — 포트폴리오·블로그가 실제로 쓰는 말부터 담습니다.
 * 라벨은 관리자 피커에 그대로 나갑니다. 뜻이 겹치는 것은 넣지 않습니다(고르는 사람이 헷갈립니다).
 *
 * `group` 은 피커를 나누는 데만 씁니다 — 어느 그룹의 아이콘이든 어느 링크에나 걸 수 있습니다.
 * 서른여덟 개를 한 줄로 늘어놓으면 찾지 못합니다.
 */
const WANT = [
  /* ── 기본 — 어느 사이트에나 있는 자리 ─────────────────────────── */
  ['home', 'house', '홈', '기본'],
  ['grid', 'layout-grid', '작업', '기본'],
  ['write', 'pen-line', '글', '기본'],
  ['user', 'user', '소개', '기본'],
  ['mail', 'mail', '메일', '기본'],
  ['image', 'image', '사진', '기본'],
  ['work', 'briefcase', '일', '기본'],
  ['book', 'book-open', '읽기', '기본'],
  ['star', 'star', '추천', '기본'],
  ['calendar', 'calendar', '일정', '기본'],
  ['place', 'map-pin', '위치', '기본'],
  ['phone', 'phone', '전화', '기본'],
  ['link', 'link', '링크', '기본'],
  ['search', 'search', '찾기', '기본'],
  ['tag', 'tag', '분류', '기본'],
  ['talk', 'message-circle', '이야기', '기본'],
  ['download', 'download', '내려받기', '기본'],
  ['out', 'external-link', '바깥으로', '기본'],

  /* ── 포트폴리오 — 무엇을 만드는 사람인가 ────────────────────────── */
  ['design', 'palette', '디자인', '포트폴리오'],
  ['camera', 'camera', '촬영', '포트폴리오'],
  ['video', 'video', '영상', '포트폴리오'],
  ['code', 'code-xml', '개발', '포트폴리오'],
  ['layer', 'layers', '레이어', '포트폴리오'],
  ['web', 'monitor', '웹', '포트폴리오'],
  ['app', 'smartphone', '앱', '포트폴리오'],
  ['product', 'package', '제품', '포트폴리오'],
  ['graphic', 'shapes', '그래픽', '포트폴리오'],
  ['type', 'type', '타이포', '포트폴리오'],
  ['draw', 'pen-tool', '일러스트', '포트폴리오'],
  ['deck', 'presentation', '발표', '포트폴리오'],
  ['award', 'award', '수상', '포트폴리오'],
  ['team', 'users', '팀', '포트폴리오'],

  /* ── 블로그 — 글을 어떻게 묶어 보여 주는가 ───────────────────────── */
  ['news', 'newspaper', '소식', '블로그'],
  ['rss', 'rss', '구독', '블로그'],
  ['bookmark', 'bookmark', '북마크', '블로그'],
  ['recent', 'clock', '최근', '블로그'],
  ['archive', 'archive', '보관', '블로그'],
  ['folder', 'folder', '묶음', '블로그'],
  ['list', 'list', '목록', '블로그'],
  ['idea', 'lightbulb', '아이디어', '블로그'],
  ['quote', 'quote', '인용', '블로그'],
  ['learn', 'graduation-cap', '배움', '블로그'],
  ['daily', 'coffee', '일상', '블로그'],
  ['world', 'globe', '세계', '블로그'],
  ['hot', 'flame', '인기', '블로그'],
  ['like', 'heart', '좋아요', '블로그'],

  /* ── 이력 — 어디서 무엇을 해 왔는가 ──────────────────────────────── */
  ['resume', 'file-text', '이력서', '이력'],
  ['school', 'school', '학력', '이력'],
  ['company', 'building-2', '회사', '이력'],
  ['career', 'trending-up', '성장', '이력'],
  ['cert', 'badge-check', '자격', '이력'],
  ['history', 'history', '연혁', '이력'],
  ['card', 'contact', '명함', '이력'],
  ['language', 'languages', '언어', '이력'],
  ['goal', 'target', '목표', '이력'],
  ['partner', 'handshake', '협업', '이력'],
]

/* 도형만 꺼내는 검사(`bodyOf`)는 파비콘 도구와 **같은 한 벌**을 씁니다 — tools/lucide.mjs.
   보안 검사라 복사해 두면 한쪽만 고쳐지는 날이 오고, 그날 뚫리는 쪽은 아무도 안 보는 쪽입니다 */

const rows = []
for (const [value, file, label, group] of WANT) {
  const svg = await readFile(join(DIR, `${file}.svg`), 'utf8').catch(() => {
    throw new Error(`lucide-static 에 ${file}.svg 가 없습니다 — 이름이 바뀌었습니다`)
  })
  rows.push({ value, label, group, file, body: bodyOf(svg, value) })
}

const out = `/* 자동 생성 — tools/sync-menu-icons.mjs. 손으로 고치지 마세요.
   출처: lucide-static@${pkg.version} (ISC). 상표가 아니라 UI 픽토그램이라 쓰는 자리에 제약이 없습니다.
   푸터의 서비스 로고(site-icons.mjs)와는 다른 세트입니다. CREDITS.md 의 「메뉴 아이콘」 항목 참고. */

/**
 * 메뉴에 거는 아이콘. 생성기와 관리자가 같은 데이터로 렌더링합니다.
 *
 * body 는 24×24 좌표계의 선 그림입니다(채움이 아닙니다). 생성기가 색·선 굵기를 씌웁니다.
 *
 *   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
 *        stroke-linecap="round" stroke-linejoin="round">{body}</svg>
 *
 * 색이 \`currentColor\` 라 메뉴 글자색·호버 색이 그대로 적용됩니다(이미지 파일이면 안 됩니다).
 * 굵기 2 는 Lucide 의 기본값입니다 — 글자 크기를 키워도 선은 두꺼워지지 않습니다.
 */
export const MENU_ICONS = [
${rows.map((r) => `  { value: '${r.value}', label: '${r.label}', group: '${r.group}',\n    body: '${r.body}' },`).join('\n')}
]

/** 값 → 도형. 생성기와 관리자가 같이 씁니다. 없는 값이면 \`undefined\` 이고 호출부가 렌더링을 건너뜁니다 */
export const MENU_ICON_OF = Object.fromEntries(MENU_ICONS.map((i) => [i.value, i.body]))

/** 피커가 쓰는 그룹 순서 — 데이터에 나온 순서 그대로입니다(가나다순이 아닙니다) */
export const MENU_ICON_GROUPS = [...new Set(MENU_ICONS.map((i) => i.group))]
`

await writeFile(join(ROOT, 'shared/menu-icons.mjs'), out)
console.log(`shared/menu-icons.mjs — ${rows.length}벌 (lucide-static@${pkg.version}, ISC)`)
for (const r of rows) console.log(`  ${r.group.padEnd(6)} ${r.value.padEnd(10)} ${r.label.padEnd(6)} ${r.file}`)

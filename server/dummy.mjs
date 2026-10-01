/**
 * 미리보기에 세우는 견본 내용.
 *
 * 왜 필요한가: 아무것도 안 올린 사이트에서 템플릿을 고르면 화면에 「작성된 작업물이
 * 없습니다」와 글자 몇 줄만 남습니다. 그러면 「히어로 이미지」와 「그리드 먼저」가 눈으로
 * 구별되지 않고, 「수직 이미지」는 세로로 잇는 판짜기라는 것조차 안 보입니다.
 * 고르는 일은 모양을 보고 하는 일이라, 고를 때만큼은 내용이 차 있어야 합니다.
 *
 * 경계 — 견본이 어디까지 대신하는가:
 *   DB 에서 오는 것(작업 목록·글 목록)은 견본이 대신합니다. 내용은 나중에 채우는
 *   것이고, 지금 고르는 것은 그 내용이 놓일 판입니다.
 *   지금 고치는 중인 것(글자 상자·사진)은 손대지 않습니다. 방금 올린 사진 일곱 장을
 *   견본 셋으로 바꿔 보여 주면 그건 미리보기라고 할 수 없습니다.
 *   첫 화면의 견본 사진은 템플릿이 진짜 값으로 들고 옵니다(site-vocab 의 `SAMPLE`) —
 *   그래야 요소 목록과 화면이 같은 것을 말합니다.
 *
 * 그림은 파일로 두지 않고 주소 안에 그립니다(`data:image/svg+xml`). 견본은 공개면에
 * 한 번도 안 나가는데 레포의 `public/` 에 파일을 늘리면 파생되는 사이트마다 따라다닙니다.
 * 굽기의 `unsafeBit` 은 `data:` 중 그림만 통과시키므로 이 길은 열려 있습니다.
 */

/**
 * 한 장 그립니다 — 납작한 도형 몇 개. 견본이 실제 작업보다 예쁘면 안 됩니다.
 *
 * 번호를 크게 박습니다. 번호가 없으면 슬라이드를 넘겨도 옅은 회색 판이 옅은 회색 판으로
 * 바뀌어 아무 일도 안 일어난 것처럼 보입니다 — 넘어간다는 사실 자체가 안 읽힙니다.
 */
const draw = (w, h, bg, ink, mark, no) =>
  'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'>`
    + `<rect width='${w}' height='${h}' fill='${bg}'/>`
    + `<g fill='none' stroke='${ink}' stroke-width='${Math.round(Math.min(w, h) / 90)}'>${mark}</g>`
    + (no ? `<text x='${w / 2}' y='${h / 2}' fill='${ink}' fill-opacity='.55'`
      + ` font-family='system-ui,-apple-system,Segoe UI,sans-serif' font-weight='700'`
      + ` font-size='${Math.round(Math.min(w, h) * 0.42)}'`
      + ` text-anchor='middle' dominant-baseline='central'>${no}</text>` : '')
    + '</svg>')

/* 가로가 다른 셋 — 세로로 이었을 때 높이가 저마다 다른 것이 보여야 「수직」이 읽힙니다 */
const SHOT_ART = [
  { w: 1600, h: 900, bg: '#e7e4de', ink: '#b9b1a4',
    mark: "<circle cx='800' cy='450' r='190'/><path d='M470 640h660'/>" },
  { w: 1200, h: 1500, bg: '#e1e5e4', ink: '#a9b4b1',
    mark: "<rect x='330' y='420' width='540' height='660'/><path d='M330 750h540'/>" },
  { w: 1600, h: 1067, bg: '#eae2dd', ink: '#c0ac9f',
    mark: "<path d='M420 760l260-330 210 250 170-160 220 240'/><circle cx='1180' cy='330' r='86'/>" },
]

/* 카드에 걸리는 그림 — 격자에서는 비율이 같아야 줄이 맞습니다(4:3) */
const card = (i) => {
  const art = [
    ['#e7e4de', '#b9b1a4', "<circle cx='600' cy='450' r='150'/>"],
    ['#e1e5e4', '#a9b4b1', "<rect x='420' y='270' width='360' height='360'/>"],
    ['#eae2dd', '#c0ac9f', "<path d='M400 560l200-230 200 230z'/>"],
    ['#e5e3e8', '#aeaab8', "<path d='M400 450h400M600 250v400'/>"],
    ['#e9e6dd', '#bdb69f', "<circle cx='500' cy='450' r='120'/><circle cx='720' cy='450' r='120'/>"],
    ['#e2e4e0', '#adb3a6', "<rect x='400' y='300' width='400' height='300'/><path d='M400 450h400'/>"],
  ][i % 6]
  return draw(1200, 900, art[0], art[1], art[2])
}

/** 며칠 전 — 견본에 박힌 날짜가 늘 같으면 「멈춘 사이트」로 보입니다 */
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString()

const WORK_TITLES = ['겨울 편지', '목련 스튜디오', '밤의 지도', '한글 실험', '종이와 빛', '여백 연습']
const POST_TITLES = ['작업을 시작하는 법', '글자 사이의 공기', '다시 손으로']

/**
 * 견본 작업 여섯. 격자를 2·3·4·6칸 어디에 두어도 줄이 비지 않는 가장 작은 수입니다.
 * `slug` 에 `d-` 를 붙여 진짜 작업과 주소가 겹치지 않게 합니다.
 */
export const DUMMY_WORKS = WORK_TITLES.map((title, i) => ({
  slug: `d-${i + 1}`, no: i + 1, title, published_at: daysAgo(i * 9 + 3), cover: card(i),
  images: SHOT_ART.map((a, j) =>
    ({ src: draw(a.w, a.h, a.bg, a.ink, a.mark, j + 1), thumb: '', w: a.w, h: a.h })
  ).slice(0, 2 + (i % 2)),
}))

/** 견본 글 셋 — 메인의 글 목록이 `limit 3` 이라 그만큼만 있으면 됩니다 */
export const DUMMY_POSTS = POST_TITLES.map((title, i) => ({
  slug: `d-${i + 1}`, no: i + 1, title, published_at: daysAgo(i * 6 + 2), cover: card(i + 3),
  width: null, title_doc: null, attachments: [],
  /* `posts.body` 는 HTML 문자열입니다(sql/schema.sql). 편집기 문서 객체를 넣으면
     `readMinutes`·`summarize`·`toPublishedHtml` 이 `[object Object]` 를 받아,
     견본 글이 전부 「1분」에 본문이 깨진 채로 생성합니다 */
  /* 절 제목이 있어야 「절 바로 가기」를 켰을 때 미리보기에 목록이 뜹니다. 없으면 켜도
     화면이 그대로라 켜진 건지 알 수 없습니다. h3 를 한 칸 섞어 들여쓰기까지 보입니다 */
  body: '<p>견본 글입니다. 고르는 중인 판짜기가 실제 글에서 어떻게 보이는지 가늠하려고 세워 둔 것이라, '
    + '사이트에 반영해도 이 글은 나가지 않습니다.</p>'
    + '<h2>글의 뼈대</h2>'
    + '<p>문단이 둘이면 줄 간격과 본문 폭이 어떻게 읽히는지도 같이 보입니다.</p>'
    + '<h3>절 안의 절</h3>'
    + '<p>작은 제목은 한 칸 들여 섭니다.</p>'
    + '<h2>남는 자리</h2>'
    + '<p>본문 옆이 얼마나 비는지, 목록이 그 자리에 들어맞는지 봅니다.</p>',
}))

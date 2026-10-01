/**
 * 출력 경로와 산출물의 안전 검사.
 *
 * 여기 있는 것은 전부 「값 하나가 데이터를 지우거나 공개 화면에 실행되는 것을 내보내는」
 * 길을 막습니다. 렌더링 코드와 섞여 있으면 눈에 띄지 않아서 따로 뒀습니다.
 */
import { writeFile, rename } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { basename, dirname, resolve, join } from 'node:path'

/**
 * 심볼릭 링크까지 푼 실제 경로. 위 두 폴더가 같은지 볼 때 씁니다.
 *
 * 문자열 비교로는 못 가려냅니다. 슬래시 하나 차이, www/../blog, 심볼릭 링크가 다 다른
 * 문자열이면서 같은 폴더입니다. 한쪽이 다른 쪽 안에 들어가는 경우도 막아야 합니다.
 * 아직 없는 폴더는 있는 조상까지만 풉니다. 첫 배포에는 www/ 가 없습니다.
 */
export const realOf = (path) => {
  let at = resolve(path)
  const tail = []
  for (;;) {
    try { return join(realpathSync(at), ...tail.reverse()) } catch { /* 아직 없는 폴더 */ }
    const up = dirname(at)
    if (up === at) return resolve(path)            // 루트까지 못 찾으면 원래 경로 그대로
    tail.push(at.slice(up.length + 1))
    at = up
  }
}
/** 한쪽이 다른 쪽이거나 그 안에 들어 있는가 */
export const nested = (x, y) => x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`)
/**
 * 임시 파일에 다 쓰고 rename. 반쯤 쓰인 HTML 이 서빙되는 걸 막습니다.
 *
 * 임시 이름은 점으로 시작해야 합니다. foo.html.tmp 로 두면 굽는 동안 그 주소가 200 으로
 * 열리고, rename 이 실패하면 계속 남습니다. 점 파일은 nginx 와 개발 서버가 같이 막아줍니다.
 * 같은 폴더에 두는 건 rename 이 파일시스템 경계를 못 넘어서.
 */
export const writeAtomic = async (path, text) => {
  const tmp = join(dirname(path), `.${basename(path)}.tmp`)
  await writeFile(tmp, text)
  await rename(tmp, path)
}

/**
 * 폴더 이름으로 쓸 수 있는 슬러그인지 봅니다.
 *
 * ../../blog 같은 이름은 굽기를 PAGES 밖으로 내보내서 블로그 폴더를 덮어씁니다.
 * 관리자가 주소를 직접 입력받으므로 디스크에 쓰기 전에 막습니다.
 */
export const okSlug = (slug) => {
  const s = String(slug ?? '')
  /* 길이도 봅니다. 파일 이름 상한(255바이트)을 넘으면 mkdir 이 ENAMETOOLONG 으로 죽는데,
     그때는 이미 홈과 목록을 쓴 뒤라 존재하지 않는 작업을 가리키는 홈이 출력됩니다 */
  if (!s || Buffer.byteLength(s) > 120) return false
  return s !== '.' && s !== '..' && !/[/\\]/.test(s) && !s.startsWith('.') && !/[\u0000-\u001f]/.test(s)
}

/**
 * 실행되는 코드가 섞였는지 검사합니다. 정규화한 다음에 검사합니다.
 *
 * 정규식 목록만으로는 막을 수 없습니다. <script/src=…>, <img src=x/onerror=…>,
 * java&#115;cript:, 탭이 낀 java\tscript: 가 전부 통과합니다.
 * 그래서 먼저 실체 참조를 글자로 복원하고, 태그·속성 이름에 붙은 / 를 공백으로 바꾸고,
 * 태그 안에서만 속성 검사를 합니다. 본문 글자의 「only=」 같은 것을 잡지 않기 위해서입니다.
 */
export const safeChar = (code, fallback) =>
  (Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : fallback)

export const unsafeBit = (html) => {
  const flat = String(html)
    /* 범위를 벗어난 값(&#x110000;)에 fromCodePoint 가 예외를 던집니다. 그러면 생성 오류가
       원인 불명의 JS 오류로 표시됩니다. 해석할 수 없는 값은 원문 그대로 둡니다 */
    .replace(/&#x([0-9a-f]+);?/gi, (m, h) => safeChar(parseInt(h, 16), m))
    .replace(/&#(\d+);?/g, (m, d) => safeChar(Number(d), m))
    .replace(/&(lt|gt|quot|apos|amp|colon|tab|newline|sol);/gi,
      (_, n) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&', colon: ':', tab: '\t', newline: '\n', sol: '/' })[n.toLowerCase()])
    .replace(/<([a-z][a-z0-9-]*)\//gi, '<$1 ')            // `<script/src=…`
    .replace(/\/+(?=[a-z][a-z0-9-]*\s*=)/gi, ' ')          // `<img src=x/onerror=…`
  const tags = flat.match(/<[^>]*>/g) || []
  const banned = /^<\s*(script|iframe|object|embed|base|noscript|frame|frameset|applet)\b/i
  for (const tag of tags) {
    const m = tag.match(banned)
    if (m) return `<${m[1].toLowerCase()}>`
    if (/[\s"'/]on[a-z-]+\s*=/i.test(tag)) return 'on… 속성'
    /* <meta http-equiv="refresh"> 는 스크립트도 아니고 on… 속성도 아니지만 페이지를 통째로
       다른 주소로 이동시킵니다. <body> 안에 있어도 동작합니다.
       방문자에게 전달되는 JS 를 0바이트로 유지하는 자리라 여기서 같이 막습니다 */
    if (/^<\s*meta\b/i.test(tag) && /http-equiv\s*=\s*["']?\s*refresh/i.test(tag)) return 'meta 새로고침'
    /* 외부에서 스타일시트를 불러오면 방문자 IP 가 노출되고, 셀렉터로 내용까지 판독됩니다.
       rel 과 href 의 순서를 따지지 않습니다. 순서를 전제하면 뒤바꿔 쓴 것이 통과합니다 */
    if (/^<\s*link\b/i.test(tag) && /rel\s*=\s*["']?stylesheet/i.test(tag)
        && /href\s*=\s*["']?\s*(https?:)?\/\//i.test(tag)) return '바깥 스타일시트'
    /* 주소 안의 제어문자는 브라우저가 무시합니다. 같은 기준으로 제거한 다음 검사합니다 */
    const urls = tag.replace(/[\s\u0000-\u001f]+/g, '')
    if (/(javascript|vbscript|data):(?!image\/)/i.test(urls) || /data:text\/html/i.test(urls)) {
      return '실행되는 주소'
    }
  }
  /* style 블록 안의 @import 는 태그가 아니라 텍스트라서 따로 검사합니다(url() 없는 형태 포함) */
  if (/@import\s+(url\(\s*)?["']?\s*(https?:)?\/\//i.test(flat)) return '바깥 스타일시트(@import)'
  if (/@font-face[^}]*url\(\s*["']?\s*(https?:)?\/\//i.test(flat)) return '바깥 글꼴'
  return null
}

/**
 * 올린 SVG 가 파비콘으로 써도 되는 그림인가.
 *
 * SVG 는 그림이 아니라 **문서**입니다. 스크립트가 돌고 바깥 자원을 부릅니다. 그래서 글 첨부
 * (`/api/media`)는 아직도 SVG 를 안 받습니다 — 그 파일은 `/blog/` 로 나가고 그 자리를 관리자
 * 오리진도 alias 해서, 열면 관리자와 같은 오리진에서 실행되기 때문입니다.
 *
 * 파비콘만 여는 대신 **살균이 아니라 거부**를 씁니다. 살균은 빠뜨리는 것이 반드시 생기고,
 * 빠뜨린 것이 통과하면 그때는 아무도 모릅니다. 거부는 빠뜨려도 멀쩡한 그림이 튕길 뿐입니다.
 * nginx 가 그 자리에 CSP(`default-src 'none'`)를 함께 겁니다 — 두 겹입니다.
 *
 * `unsafeBit` 이 script·on… 속성·실행되는 주소·바깥 스타일시트를 이미 봅니다. 여기서는
 * SVG 에만 있는 통로를 더 봅니다.
 *
 * @returns 걸린 까닭, 괜찮으면 null
 */
export const svgUnsafe = (text) => {
  const src = String(text)
  /* 앞의 XML 선언·주석·공백을 지나 첫 요소가 <svg> 여야 합니다. 확장자만 믿으면
     <html> 문서를 .svg 로 올려 같은 오리진에서 열 수 있습니다 */
  if (!/^\s*(?:<\?xml[^>]*\?>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>]/i.test(src)) {
    return 'SVG 가 아닙니다'
  }
  const bad = unsafeBit(src)
  if (bad) return bad
  /* 바깥 HTML 을 SVG 안으로 들여오는 문 — 그 안에서는 SVG 규칙이 안 통합니다 */
  if (/<\s*foreignObject\b/i.test(src)) return '<foreignObject>'
  /* <use>·<image>·<a> 가 바깥 주소를 가리키면 방문자 주소가 그 서버에 찍힙니다.
     파비콘은 모든 화면에 붙어서 특히 셉니다. xlink: 는 옛 이름이라 같이 봅니다 */
  if (/\b(?:xlink:)?href\s*=\s*["']?\s*(?:https?:)?\/\//i.test(src)) return '바깥 주소 참조'
  /* 그림 안에서 글꼴·배경을 바깥에서 끌어오는 길 */
  if (/url\(\s*["']?\s*(?:https?:)?\/\//i.test(src)) return '바깥 자원(url)'
  return null
}

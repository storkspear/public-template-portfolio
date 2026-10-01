/**
 * HTML 글자 다루기 — 이스케이프와 요약.
 *
 * bake.mjs 에서 떼어냈습니다. 부작용이 없고 환경변수도 안 읽으므로 검사에서 그냥 부를 수
 * 있습니다. tools/check-summary.mjs 가 이 모듈을 직접 import 합니다.
 */

export const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * 본문에서 글자가 있는 첫 문단을 뽑습니다. 목록의 요약문과 meta description 둘 다 이 값입니다.
 *
 * 첫 <p> 만 보면 안 됩니다. 편집기가 빈 문단을 남기므로(사진 아래 빈 줄) 요약이 빈 문자열이
 * 되어 목록에 아무것도 표시되지 않습니다. 차례로 확인해서 내용이 있는 첫 문단을 씁니다.
 *
 * 실체 참조를 풉니다. 본문은 이미 HTML 이라 & 가 &amp; 로 저장돼 있어, 그대로 돌려주면
 * 호출한 쪽의 esc() 가 한 번 더 씌워 A &amp; B 가 글자 그대로 보입니다.
 *
 * 비면 빈 문자열을 돌려줍니다. 사이트 설명문으로 대신하면 목록의 모든 글이 같은 한 줄을
 * 제 요약처럼 달게 됩니다. 폴백은 meta 태그 쪽의 몫입니다.
 */
/**
 * 코드포인트 하나를 글자로. 범위 밖이면 원문을 그대로 둡니다.
 *
 * String.fromCodePoint 는 0x10FFFF 를 넘으면 RangeError 를 던집니다. 글 하나에
 * &#xFFFFFF; 가 있으면 생성 전체가 죽어 사이트가 통째로 나가지 못합니다.
 * 아래 unsafeBit 의 safeChar 가 같은 규약을 씁니다.
 */
const codeChar = (n, raw) =>
  (Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : raw)

/**
 * 실체 참조를 풉니다. 반드시 한 패스로 해야 합니다.
 *
 * replace 를 여러 번 이어 부르면 앞 패스가 만든 글자를 뒤 패스가 다시 풉니다.
 * 글쓴이가 화면에 &amp; 라고 보이게 쓰면 본문은 &#x26;amp; 로 저장되는데, 16진 패스가
 * 그것을 &amp; 로 만들고 이름 패스가 다시 & 로 풀어 버립니다. 독자가 보는 글은 &amp; 인데
 * meta description 만 & 가 됩니다. 교대(|) 하나로 훑으면 푼 자리를 다시 보지 않습니다.
 */
const NAMED = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&', nbsp: ' ' }
export const unesc = (s) =>
  String(s).replace(/&(?:#x([0-9a-f]+)|#(\d+)|(lt|gt|quot|apos|amp|nbsp));/gi,
    (m, h, d, name) => (name ? NAMED[name.toLowerCase()]
                             : codeChar(h !== undefined ? parseInt(h, 16) : Number(d), m)))

/**
 * 태그 하나를 매칭하는 정규식. 속성값 안의 > 를 태그 끝으로 읽지 않습니다.
 * <p title="a>b">본문 을 [^>]*> 로 읽으면 요약이 b">본문 이 되고 그게 그대로
 * meta description 으로 출력됩니다. 따옴표로 감싼 부분을 먼저 건너뜁니다.
 */
export const TAG = '(?:"[^"]*"|\'[^\']*\'|[^\'">])*'

export const summarize = (html, max = 150) => {
  for (const m of String(html || '').matchAll(new RegExp(`<p${TAG}>([\\s\\S]*?)</p>`, 'gi'))) {
    const text = unesc(m[1].replace(new RegExp(`<${TAG}>`, 'g'), ' '))
      /* 제어문자는 버립니다 — `&#0;` 는 NUL 을 만들고, NUL 이 든 HTML 은 브라우저가
         U+FFFD 로 바꿔 요약에 검은 마름모가 박힙니다 */
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ').trim()
    if (!text) continue
    /* 글자 단위로 자릅니다. slice() 는 이모지와 일부 한자의 서로게이트 쌍을 반으로 가릅니다 */
    const chars = [...text]
    return chars.length > max ? chars.slice(0, max).join('').trimEnd() + '…' : text
  }
  return ''
}

import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
/**
 * SVG 씻기 — 다이어그램이 본문에 들어오기 전에 한 번, 발행되기 전에 또 한 번.
 *
 * ## 왜 필요한가
 *
 * **SVG 는 그림이 아니라 문서다.** `<script>` 가 돌고, `onclick` 이 붙고,
 * `<foreignObject>` 안에는 HTML 이 통째로 들어간다. 그래서 이 프로젝트는 SVG **업로드**를
 * 일부러 막아 뒀다(`admin-api.mjs` 의 `EXT`). 다이어그램 SVG 는 업로드를 안 거치고 본문에
 * 인라인으로 사는데, 그렇다고 검사를 건너뛸 이유는 없다 —
 * mermaid·draw.io 가 만든 것이라도 **원본 텍스트는 사람이 쓰는 것**이고,
 * draw.io 는 도형에 링크와 라벨 HTML 을 넣을 수 있다.
 *
 * 「우리가 만든 거니까 괜찮다」는 방어가 아니다.
 *
 * ## 무엇을 하나
 *
 * 허용 목록이 아니라 **금지 목록**이다. 다이어그램 SVG 는 태그가 워낙 다양해서
 * (`marker`·`pattern`·`clipPath`·`filter`·`feGaussianBlur`…) 허용 목록을 만들면 그림이
 * 깨진다. 실행으로 이어지는 길만 끊는다:
 *
 * - `<script>`·`<foreignObject>`·`<iframe>`·`<object>`·`<embed>`·`<use>` 통째로 제거
 *   (`<use href="…">` 는 외부 문서를 끌어온다)
 * - `on*` 속성 전부 제거
 * - `href`·`xlink:href`·`src` 가 `http(s):`·`#` 이 아니면 제거 (`javascript:`·`data:` 차단)
 *   — 단 `<image>` 만은 `data:image/…` 를 받는다(아래 `IMAGE_TAGS` 주석)
 * - `<style>` 안의 `@import`·`url(` 제거 — 외부를 부르는 길
 *
 * ## 어디서 도나
 *
 * 브라우저와 Node **양쪽**이다. 그래서 DOMParser 가 아니라 hast 를 쓴다 —
 * `serialize.ts` 가 같은 이유로 그렇게 하고 있다(두 환경의 결과가 문자열까지 같아야 한다).
 */
const DROP_TAGS = new Set([
    'script', 'foreignobject', 'iframe', 'object', 'embed', 'set', 'animate',
    'animatemotion', 'animatetransform', 'handler', 'listener',
]);
/**
 * `<use>` 는 **남긴다** — draw.io 의 아이콘과 mermaid 의 화살표 머리가 이걸로 도형을
 * 재사용한다. 통째로 버렸더니 그림이 깨졌다.
 *
 * 대신 **같은 문서 안(`#id`)만** 허용한다. `<use>` 가 밖을 가리키면 그건 남의 문서를
 * 끌어오는 길이고, http(s) 라도 마찬가지다 — 그래서 여기만 규칙이 더 좁다.
 */
const USE_TAGS = new Set(['use']);
/**
 * 주소를 실을 수 있는 속성. 값이 수상하면 통째로 뗀다.
 *
 * ⚠ 이름을 **hast 가 주는 대로** 적어야 한다. `xlink:href` 는 `xLinkHref` 로 온다(L 이 대문자).
 * 처음에 `xlinkHref` 라고 적었더니 외부 `xlink:href` 가 그대로 통과했다 — 검사를 돌려 보고
 * 알았다. 이름을 짐작해서 적는 검사는 검사가 아니다.
 */
const URL_ATTRS = new Set(['href', 'xLinkHref', 'src', 'from', 'to', 'values']);
/**
 * `<image>` 는 **`data:image/…` 를 받는다.**
 *
 * draw.io 도면에 아이콘을 넣으면 `<image xlink:href="data:image/svg+xml;base64,…">` 로 나온다.
 * 이걸 막았더니 도형은 남고 **아이콘만 전부 사라졌다**(실제로 그랬다 — 10개 중 10개).
 *
 * 받아도 되는 이유는 `<image>` 의 규칙이 다르기 때문이다. SVG 명세상 `<image>` 로 불러온
 * 문서는 **그림으로만** 쓰인다 — 스크립트가 안 돌고 바깥을 못 부른다(secure static mode).
 * 그래서 안에 `<script>` 가 들어 있어도 실행되지 않는다. `<a href>` 나 `<use>` 와는 다르다.
 *
 * 그래도 **`image/` 로 시작하는 것만** 받는다. `data:text/html` 은 여기로 들어올 이유가 없다.
 */
const IMAGE_TAGS = new Set(['image']);
const safeDataImage = (v) => /^data:image\/(svg\+xml|png|jpeg|jpg|gif|webp|avif);base64,[A-Za-z0-9+/=\s]*$/i.test(String(v ?? '').trim());
/** `#id` 는 같은 문서 안 참조라 안전하다. 그 밖은 http(s) 만 */
const safeUrl = (v) => {
    const s = String(v ?? '').trim();
    if (!s)
        return false;
    if (s.startsWith('#'))
        return true;
    return /^https?:\/\//i.test(s);
};
function clean(node) {
    if (node.type !== 'element')
        return node;
    const el = node;
    if (DROP_TAGS.has(el.tagName.toLowerCase()))
        return null;
    const tag = el.tagName.toLowerCase();
    const localOnly = USE_TAGS.has(tag);
    const isImage = IMAGE_TAGS.has(tag);
    const props = {};
    for (const [k, v] of Object.entries(el.properties ?? {})) {
        /* on* — hast 는 `onClick` 처럼 대문자로 준다 */
        if (/^on[A-Z]/.test(k) || /^on[a-z]/.test(k))
            continue;
        if (URL_ATTRS.has(k)) {
            const ok = localOnly ? String(v ?? '').trim().startsWith('#')
                : isImage ? safeUrl(v) || safeDataImage(v)
                    : safeUrl(v);
            if (!ok)
                continue;
        }
        props[k] = v;
    }
    const kids = el.children.map(clean).filter((c) => c !== null);
    /* <style> 안에서 밖을 부르는 길을 끊는다 */
    if (tag === 'style') {
        for (const k of kids) {
            if (k.type === 'text') {
                k.value = k.value.replace(/@import[^;]*;?/gi, '').replace(/url\s*\([^)]*\)/gi, 'none');
            }
        }
    }
    return { ...el, properties: props, children: kids };
}
/**
 * 씻은 SVG 문자열. 빈 값이 들어오면 빈 값이 나간다.
 *
 * **멱등이어야 한다** — `safeSvg(safeSvg(x)) === safeSvg(x)`. `normalizeDoc` 의 계약이고,
 * 저장할 때마다 다시 도는 자리이기도 하다.
 */
export function safeSvg(svg) {
    const s = String(svg ?? '').trim();
    if (!s)
        return '';
    const tree = fromHtml(s, { fragment: true });
    const out = tree.children.map(clean).filter((c) => c !== null);
    return toHtml({ ...tree, children: out });
}
//# sourceMappingURL=svg.js.map
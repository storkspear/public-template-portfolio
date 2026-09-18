import { toHtml } from 'hast-util-to-html';
import { BLOCK_ALIGNS, FOCUS_DEFAULT, FOCUS_MAX, FOCUS_MIN, FONT_VALUES, TITLE_SIZES, TITLE_SIZE_DEFAULT, TITLE_TEXT_MAX, colorOf, imageSrc, oneOf, } from './vocab.js';
import { idOf, isRef, resolveSrc } from './attachments.js';
export const EMPTY_TITLE = {
    text: '', font: null, size: TITLE_SIZE_DEFAULT, align: 'left', color: null, banner: null,
};
function focus(v) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n))
        return FOCUS_DEFAULT;
    return Math.min(FOCUS_MAX, Math.max(FOCUS_MIN, Math.round(n)));
}
/**
 * 제목의 입구 검증 — `normalizeDoc` 과 **같은 성질**이다(전역·멱등·고정점).
 *
 * 제목도 AI 가 만들고 DB 를 거쳐 돌아오므로 어휘 밖 값이 들어올 수 있다.
 * 본문만 검사하고 제목을 안 하면, 검사를 안 한 쪽으로 이상한 값이 새어 든다.
 */
export function normalizeTitle(v) {
    const o = (v && typeof v === 'object' ? v : {});
    const b = (o.banner && typeof o.banner === 'object' ? o.banner : null);
    const src = b ? imageSrc(b.src) : null;
    return {
        // 줄바꿈·탭은 공백으로 — 제목은 한 줄이다(길면 화면에서만 접힌다).
        // trim 은 **하지 않는다** — 타이핑 도중의 끝 공백을 먹으면 다음 글자가 붙어 버린다.
        text: typeof o.text === 'string' ? o.text.replace(/[\r\n\t]+/g, ' ').slice(0, TITLE_TEXT_MAX) : '',
        font: typeof o.font === 'string' && o.font !== '' && FONT_VALUES.includes(o.font) ? o.font : null,
        size: TITLE_SIZES.includes(Number(o.size)) ? Number(o.size) : TITLE_SIZE_DEFAULT,
        align: oneOf(BLOCK_ALIGNS, o.align, 'left'),
        color: colorOf(typeof o.color === 'string' ? o.color : null),
        // src 가 어휘 밖(javascript: 등)이면 배너를 **통째로** 버린다 — 반쪽짜리 배너는 없다
        banner: src
            ? { src, focusX: focus(b.focusX), focusY: focus(b.focusY), cover: typeof b.cover === 'boolean' ? b.cover : true }
            : null,
    };
}
/**
 * 제목 글자의 인라인 style — 편집(React)과 발행(hast)이 **같은 문자열**을 쓴다.
 * 두 곳에서 각자 만들면 언젠가 갈라진다.
 */
export function titleInlineStyle(t) {
    const out = [`font-family:${t.font || 'var(--font-body)'}`, `font-size:${t.size}px`, `text-align:${t.align}`];
    // 제목은 배너 유무와 상관없이 **종이 위에** 선다(prose.css). 그래서 고른 색이 늘 산다.
    if (t.color)
        out.push(`color:${t.color}`);
    return out.join(';');
}
/** 배너 사진의 `object-position`. 50·50 이어도 **항상** 쓴다 — 생략/출력을 섞지 않는다. */
export function bannerPosition(b) {
    return `${b.focusX}% ${b.focusY}%`;
}
/**
 * 발행 페이지의 제목 덩어리. 정적 생성기가 `renderPostHead(title) + toPublishedHtml(body_html)`
 * 두 줄로 쓴다. 편집 화면(`PostTitle`)이 그리는 DOM 과 **같은 구조**여야 한다.
 */
export function renderPostHead(t, bleed = 'container') {
    const kids = [];
    if (t.banner) {
        kids.push({
            type: 'element', tagName: 'div', properties: { className: ['post-cover'] },
            children: [{
                    type: 'element', tagName: 'img',
                    // alt 는 비운다 — 장식이다. 제목 글자가 이미 h1 으로 있다.
                    properties: { src: resolveSrc(t.banner.src), alt: '', style: `object-position:${bannerPosition(t.banner)}` },
                    children: [],
                }],
        });
    }
    kids.push({
        type: 'element', tagName: 'h1',
        properties: { className: ['post-title'], style: titleInlineStyle(t) },
        children: t.text ? [{ type: 'text', value: t.text }] : [],
    });
    const head = {
        type: 'element', tagName: 'header',
        // 기본값도 항상 출력한다 — 생략/출력을 섞으면 첫 왕복에서 문자열이 달라진다
        // 기본값도 항상 출력한다 — 생략/출력을 섞으면 첫 왕복에서 문자열이 달라진다
        properties: { className: ['post-head'], 'data-banner': t.banner ? '1' : '0', 'data-bleed': bleed },
        children: kids,
    };
    return toHtml(head);
}
/**
 * 글의 대표 이미지(목록 썸네일) id. 소비자가 저장할 때 `articles.cover_attachment_id` 에 넣는다.
 *
 * 규칙이 라이브러리에 있어야 소비자마다 다른 규칙을 만들지 않는다.
 *   1. 배너가 있고 「대표」가 켜져 있으면 배너
 *   2. 아니면 본문의 첫 사진
 *   3. 없으면 null
 */
export function coverAttachmentId(t, doc) {
    if (t.banner?.cover && isRef(t.banner.src))
        return idOf(t.banner.src);
    let found = null;
    const walk = (n) => {
        if (found || !n || typeof n !== 'object')
            return;
        if (n.type === 'figure' && typeof n.attrs?.src === 'string' && isRef(n.attrs.src)) {
            found = idOf(n.attrs.src);
            return;
        }
        if (Array.isArray(n.content))
            n.content.forEach(walk);
    };
    if (doc)
        walk(doc);
    return found;
}
//# sourceMappingURL=title.js.map
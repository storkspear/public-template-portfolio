import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { safeSvg } from './svg.js';
import { normalizeLang, parseRanges, tokens, parseNotes } from './highlight.js';
import { isRef, resolveSrc } from './attachments.js';
/**
 * 발행용 HTML 보정 — editor.getHTML() 결과를 "편집 화면과 같은 DOM" 으로 맞춘다.
 *
 * 왜 hast 인가 (DOMParser 가 아니라):
 * 정적 생성 스크립트는 홈서버의 **Node** 에서 돈다. DOMParser 는 브라우저에만 있으므로
 * 그대로 두면 발행 단계에서 터진다. 게다가 hast 는 브라우저·Node 가 **같은 파서와
 * 같은 직렬화기**를 쓰므로, 두 환경의 결과가 문자열까지 동일하다.
 * (linkedom 같은 DOM 흉내는 innerHTML 직렬화가 미묘하게 달라 body_html 비교가 흔들린다.)
 *
 * 이 함수는 멱등이어야 한다 — App 이 편집 갱신마다 부른다.
 */
const isElement = (n) => n.type === 'element';
/**
 * `attachment://{id}` 를 실제 주소로 푼다.
 *
 * 본문(body_html)에는 참조가 그대로 남아 있어야 한다 — 그래야 저장 위치가 바뀌어도 글이 안 깨진다.
 * 푸는 것은 **보여주는 순간**뿐이고, 여기가 그 순간이다.
 * 정적 생성기는 resolve 를 "구워 넣은 파일의 상대 경로" 로 갈아끼우고 같은 함수를 부른다.
 */
function resolveImg(node) {
    const src = node.properties?.['src'];
    if (typeof src !== 'string' || !isRef(src))
        return node;
    return { ...node, properties: { ...node.properties, src: resolveSrc(src) } };
}
/** 요소가 그 클래스를 가졌는가 — hast 의 className 은 문자열일 수도 배열일 수도 있다 */
function hasClass(node, name) {
    const c = node.properties?.['className'];
    if (Array.isArray(c))
        return c.includes(name);
    return typeof c === 'string' && c.split(/\s+/).includes(name);
}
/** 트리를 훑어 조건에 맞는 요소를 바꾼다 (unist-util-visit 을 안 쓰고 최소 구현) */
function transformChildren(children, parent = null) {
    return children.map((node) => {
        if (!isElement(node))
            return node;
        const next = { ...node, children: transformChildren(node.children, node) };
        if (next.tagName === 'details' && next.properties?.['dataCode'] !== undefined)
            return bakeCode(next);
        if (next.tagName === 'figure' && next.properties?.['dataDiagram'] !== undefined)
            return bakeDiagram(next);
        if (next.tagName === 'img')
            return resolveImg(next);
        return wrapTable(next, parent);
    });
}
/**
 * 표를 `.tableWrapper` 로 감싼다.
 *
 * 편집 화면에서는 Tiptap 표 NodeView 가 이 감싸개를 만들지만 getHTML() 은 맨 <table> 만
 * 내놓는다. 그대로 발행하면 표의 여백이 편집 화면과 달라진다.
 * 폭도 표가 아니라 감싸개가 갖는다 — 라이브러리의 updateColumns() 가 표의 인라인 width 를
 * 매 갱신마다 지우기 때문에 편집 쪽에서 감싸개에 걸고 있고, 발행도 같은 자리에 둬야 한다.
 */
function wrapTable(node, parent) {
    if (node.tagName !== 'table')
        return node;
    // **이미 감싸져 있으면 그대로 둔다.** 안 그러면 부를 때마다 감싸개가 한 겹씩 쌓인다 —
    // 이 함수는 멱등이어야 하는데(위 머리말), 표만 그 약속을 어기고 있었다.
    if (parent && hasClass(parent, 'tableWrapper'))
        return node;
    const style = String(node.properties?.style ?? '');
    const m = /(?:^|;)\s*width\s*:\s*([\d.]+%)/.exec(style);
    const table = { ...node };
    if (m) {
        // 표에서 폭 선언만 덜어낸다 (--table-line 등 나머지는 표에 남긴다)
        const rest = style
            .split(';')
            .filter((d) => !/^\s*width\s*:/.test(d))
            .map((d) => d.trim())
            .filter(Boolean)
            .join(';');
        table.properties = { ...table.properties, style: rest || undefined };
    }
    return {
        type: 'element',
        tagName: 'div',
        properties: {
            className: ['tableWrapper'],
            ...(m ? { style: `width:${m[1]};margin-inline:auto` } : {}),
        },
        children: [table],
    };
}
/** 하위 트리의 글자를 모은다 */
function textOf(node) {
    if (node.type === 'text')
        return node.value;
    if (node.type === 'element')
        return node.children.map(textOf).join('');
    return '';
}
const span = (cls, children) => ({
    type: 'element', tagName: 'span', properties: { className: cls.split(' ').filter(Boolean) }, children: children,
});
const text = (value) => ({ type: 'text', value });
/**
 * 코드 하이라이팅을 **발행 시점에 굽는다**.
 *
 * 편집 화면은 ProseMirror 데코레이션으로 색을 입히는데, 그건 문서에 안 남는다.
 * 발행 HTML 에 span 을 미리 박아 두면 방문자 브라우저는 하이라이팅 JS 를 0바이트 받는다.
 * 색은 prose.css 의 `.hljs-*` 한 곳에서 나오므로 편집과 발행이 같은 색을 쓴다.
 *
 * 겉상자는 늘 펼쳐 둔다 — 접기는 쓰지 않기로 했다.
 */
function bakeCode(details) {
    const props = details.properties ?? {};
    const lang = normalizeLang(String(props['dataLang'] ?? '') || null);
    const hl = parseRanges(String(props['dataHl'] ?? '') || null);
    const notes = parseNotes(String(props['dataNotes'] ?? '') || null);
    const out = { ...details, properties: { ...props } };
    out.properties.open = true;
    const pre = out.children.find((c) => c.type === 'element' && c.tagName === 'pre');
    const code = pre?.children.find((c) => c.type === 'element' && c.tagName === 'code');
    if (!code)
        return out;
    const src = code.children.map(textOf).join('');
    const marks = tokens(lang, src);
    // 토큰 구간을 span 으로, 줄 시작마다 번호 span 을 끼운다
    const lineStarts = [0];
    for (let i = 0; i < src.length; i++)
        if (src[i] === '\n')
            lineStarts.push(i + 1);
    const startSet = new Map(lineStarts.map((p, i) => [p, i + 1]));
    // 줄 설명은 **다음 줄 첫머리**(개행 바로 뒤, 마지막 줄은 문서 끝)에 놓는다 —
    // 편집면 위젯과 같은 자리다. 개행 앞에 두면 빈 줄이 하나 더 생긴다.
    const noteSpots = new Map();
    lineStarts.forEach((p, i) => {
        const nl = src.indexOf('\n', p);
        noteSpots.set(nl === -1 ? src.length : nl + 1, i + 1);
    });
    const kids = [];
    let cursor = 0;
    const noteAt = (i) => {
        const n = noteSpots.get(i);
        const v = n === undefined ? undefined : notes.get(n);
        if (!v)
            return;
        kids.push({ type: 'element', tagName: 'span',
            properties: { className: ['cb-note'], dataTone: v.tone }, children: [text(v.text)] });
    };
    const emit = (from, to, cls) => {
        let i = from;
        while (i < to) {
            const n = startSet.get(i);
            if (n !== undefined) {
                kids.push({ type: 'element', tagName: 'span',
                    properties: { className: ['cb-ln', ...(hl.has(n) ? ['is-hl'] : [])], dataN: String(n) }, children: [] });
            }
            const nextStart = lineStarts.find((p) => p > i && p < to);
            const end = nextStart ?? to;
            const chunk = src.slice(i, end);
            if (chunk) {
                // 개행 **뒤**에서 설명을 끼운다
                const nl = chunk.indexOf('\n');
                if (nl >= 0) {
                    const head = chunk.slice(0, nl + 1);
                    kids.push(cls ? span(cls, [text(head)]) : text(head));
                    noteAt(i + nl + 1);
                    const tail = chunk.slice(nl + 1);
                    if (tail)
                        kids.push(cls ? span(cls, [text(tail)]) : text(tail));
                }
                else {
                    kids.push(cls ? span(cls, [text(chunk)]) : text(chunk));
                }
            }
            i = end;
        }
    };
    for (const t of marks) {
        if (t.from > cursor)
            emit(cursor, t.from, null);
        emit(t.from, t.to, t.cls);
        cursor = t.to;
    }
    if (cursor < src.length)
        emit(cursor, src.length, null);
    if (kids.length === 0)
        emit(0, src.length, null);
    noteAt(src.length); // 마지막 줄은 개행이 없다
    const newCode = { ...code, children: kids };
    const newPre = { ...pre, children: [newCode] };
    out.children = out.children.map((c) => (c === pre ? newPre : c));
    return out;
}
/**
 * 다이어그램을 **그림으로 굽는다.**
 *
 * 편집 문서에서는 SVG 가 `data-svg` 속성에 문자열로 실려 있다(Tiptap 의 renderHTML 이
 * raw HTML 자식을 못 만들기 때문 — `Diagram.ts` 참고). 발행본에서는 그걸 꺼내
 * `<div class="dg-body">` 안에 박고, **원본 텍스트와 SVG 속성은 버린다.**
 *
 * 버리는 이유가 중요하다 — 원본은 편집에만 필요하고, 발행 HTML 에 남기면 같은 것이
 * 두 벌 실려 페이지가 두 배가 된다(draw.io 도면은 수십 KB 다).
 *
 * 결과는 인라인 `<svg>` 하나다. **방문자가 받는 JS 는 0바이트**이고 요청도 안 는다 —
 * 코드 하이라이팅을 여기서 굽는 것과 같은 이유다.
 *
 * ⚠ `safeSvg` 를 여기서 **또** 돌린다. `normalizeDoc` 이 이미 씻었지만, 발행은 마지막
 * 관문이고 옛 글은 그 검사가 생기기 전에 저장됐을 수 있다.
 */
/**
 * draw.io 는 내보낸 SVG 의 루트에 `content="<mxfile …>"` 로 **도면 원본을 통째로 박는다.**
 * 그 파일 하나로 다시 열어 고칠 수 있게 하려는 배려인데, 우리에겐 이미 `src` 에 같은 것이 있다.
 *
 * 크기가 작지 않다: 실측한 도면에서 씻은 SVG 35,887 바이트 중 **15,479 바이트가 이 속성**이었다.
 * 발행본은 읽는 사람의 것이고 읽는 사람은 이걸 안 연다 — 그래서 굽는 자리에서만 뗀다.
 * 편집기 쪽 문서에는 남겨 둔다(거기서는 값이 아니라 원본 곁의 사본일 뿐이라 해가 없다).
 */
function dropEditableSource(svg) {
    return svg.replace(/(<svg\b[^>]*?)\s+content="[^"]*"/i, '$1');
}
function bakeDiagram(node) {
    const p = (node.properties ?? {});
    const svg = dropEditableSource(safeSvg(String(p['dataSvg'] ?? '')));
    const body = {
        type: 'element', tagName: 'div', properties: { className: ['dg-body'] },
        children: svg ? fromHtml(svg, { fragment: true }).children : [],
    };
    /* 편집에만 쓰는 것은 발행본에서 뗀다 */
    const { dataSvg: _s, dataSrc: _r, dataDiagram: _d, dataEngine: _e, ...rest } = p;
    void _s;
    void _r;
    void _d;
    void _e;
    const caption = node.children.find((c) => c.type === 'element' && c.tagName === 'figcaption');
    return {
        ...node,
        properties: { ...rest, className: ['dg'] },
        children: (caption && caption.children.length ? [body, caption] : [body]),
    };
}
export function toPublishedHtml(html) {
    const tree = fromHtml(html, { fragment: true });
    const out = { ...tree, children: transformChildren(tree.children) };
    return toHtml(out);
}
//# sourceMappingURL=serialize.js.map
import { CODE_NOTE_TONES, oneOf } from './vocab.js';
import { createLowlight } from 'lowlight';
import ts from 'highlight.js/lib/languages/typescript';
import js from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import java from 'highlight.js/lib/languages/java';
import kotlin from 'highlight.js/lib/languages/kotlin';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import dart from 'highlight.js/lib/languages/dart';
/**
 * 하이라이팅의 유일한 출처.
 *
 * 편집(데코레이션)과 발행(굽기)이 **같은 함수**를 쓴다. 둘이 다른 하이라이터를 쓰면
 * "편집 화면과 발행 결과가 같다" 는 계약이 색에서부터 깨진다.
 *
 * lowlight 를 쓰는 이유: 동기 함수라 편집 중 결정적이고, 언어를 나눠 실을 수 있으며,
 * hast 를 내놓아 발행 파이프라인(역시 hast)과 그대로 맞물린다.
 */
const lowlight = createLowlight();
/** 즉시 싣는 문법 — 이 블로그에서 자주 나올 것들 */
const EAGER = {
    typescript: ts, javascript: js, json, bash, java, kotlin,
    python, sql, yaml, xml, css, dart,
};
Object.entries(EAGER).forEach(([name, def]) => lowlight.register(name, def));
/** 나머지는 고를 때 불러온다 — 편집 번들을 지키려고 */
const LAZY = {
    go: () => import('highlight.js/lib/languages/go'),
    rust: () => import('highlight.js/lib/languages/rust'),
    swift: () => import('highlight.js/lib/languages/swift'),
    ruby: () => import('highlight.js/lib/languages/ruby'),
    php: () => import('highlight.js/lib/languages/php'),
    c: () => import('highlight.js/lib/languages/c'),
    cpp: () => import('highlight.js/lib/languages/cpp'),
    csharp: () => import('highlight.js/lib/languages/csharp'),
    diff: () => import('highlight.js/lib/languages/diff'),
    markdown: () => import('highlight.js/lib/languages/markdown'),
    ini: () => import('highlight.js/lib/languages/ini'),
    scss: () => import('highlight.js/lib/languages/scss'),
    graphql: () => import('highlight.js/lib/languages/graphql'),
    dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
    // 운영 글에 `language-nginx` 가 이미 있었다(2026-10 실측) — 서버 설정은 블로그 소재다
    nginx: () => import('highlight.js/lib/languages/nginx'),
};
/**
 * 실을 수 있는 문법 전부 — `LANGUAGES` 의 id 는 반드시 여기 있어야 한다
 * (`tools/check-boundary.mjs` 가 본다). 목록에는 있는데 문법이 없으면 「고를 수는 있는데
 * 색은 안 나오는」 언어가 된다.
 */
const KNOWN = new Set([...Object.keys(EAGER), ...Object.keys(LAZY)]);
/**
 * 지연 문법을 **한꺼번에** 싣는다. 발행 굽기(`toPublishedHtml`)는 동기 함수라 그 안에서
 * 기다릴 수 없다 — 그래서 사이트의 굽기 모듈이 최상단에서 `await preloadLanguages()` 하고
 * 시작한다. 안 하면 LAZY 열다섯 언어는 **색 없이** 발행된다(실측: rust·go·csharp·markdown 0 span).
 * 인자를 주면 그것만, 안 주면 LAZY 전부.
 */
export async function preloadLanguages(ids = Object.keys(LAZY)) {
    await Promise.all(ids.map((id) => ensureLanguage(id)));
}
/** 별칭 — ts/tsx → typescript 등 */
const ALIAS = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    sh: 'bash', shell: 'bash', zsh: 'bash', yml: 'yaml', html: 'xml', md: 'markdown',
    'c++': 'cpp', 'c#': 'csharp', py: 'python', kt: 'kotlin', rs: 'rust', golang: 'go',
};
/**
 * 별칭 정규화 **+ 어휘 검증** — ts/tsx → typescript, 모르는 이름 → null(텍스트).
 *
 * 전에는 별칭만 풀고 아무 문자열이나 통과시켰다. 그래서 운영 글에 `language-nginx` 가 들어왔다 —
 * `normalizeDoc` 은 codeBlock 의 language 를 아예 안 봤고, parseHTML 도 `data-lang` 을 그대로 믿었다.
 * 결과는 「라벨은 nginx 라고 말하는데 색은 한 톨도 없는」 블록 — 고장인지 그런 언어인지 아무도 모른다.
 * 모르는 언어는 여기서 null 로 접는다: 라벨 「텍스트」, 색 없음. 어휘의 다른 열거 속성과 같은 규약이다
 * (`oneOf`: 한 번 접히면 그 뒤로는 안 바뀐다).
 */
export function normalizeLang(lang) {
    if (!lang)
        return null;
    const k = String(lang).toLowerCase().replace(/[^a-z0-9+#.-]/g, '');
    const id = ALIAS[k] ?? k;
    return KNOWN.has(id) ? id : null;
}
export function isLoaded(lang) {
    return !!lang && lowlight.registered(lang);
}
/** 지연 문법을 싣는다. 이미 있으면 false(다시 그릴 필요 없음) */
export async function ensureLanguage(lang) {
    const l = normalizeLang(lang);
    if (!l || lowlight.registered(l))
        return false;
    const loader = LAZY[l];
    if (!loader)
        return false;
    const mod = await loader();
    lowlight.register(l, mod.default);
    return true;
}
/** 고를 수 있는 언어 목록 (라벨은 화면용) */
export const LANGUAGES = [
    { id: 'typescript', label: 'TypeScript' }, { id: 'javascript', label: 'JavaScript' },
    { id: 'kotlin', label: 'Kotlin' }, { id: 'java', label: 'Java' }, { id: 'dart', label: 'Dart' },
    { id: 'python', label: 'Python' }, { id: 'go', label: 'Go' }, { id: 'rust', label: 'Rust' },
    { id: 'swift', label: 'Swift' }, { id: 'ruby', label: 'Ruby' }, { id: 'php', label: 'PHP' },
    { id: 'c', label: 'C' }, { id: 'cpp', label: 'C++' }, { id: 'csharp', label: 'C#' },
    { id: 'sql', label: 'SQL' }, { id: 'bash', label: 'Bash' }, { id: 'json', label: 'JSON' },
    { id: 'yaml', label: 'YAML' }, { id: 'xml', label: 'HTML / XML' }, { id: 'css', label: 'CSS' },
    { id: 'scss', label: 'SCSS' }, { id: 'graphql', label: 'GraphQL' },
    { id: 'dockerfile', label: 'Dockerfile' }, { id: 'ini', label: 'INI / TOML' },
    { id: 'diff', label: 'Diff' }, { id: 'markdown', label: 'Markdown' },
    { id: 'nginx', label: 'Nginx' },
];
const LABEL = new Map(LANGUAGES.map((l) => [l.id, l.label]));
/**
 * 화면에 보이는 언어 이름. 편집기의 머리띠와 발행 굽기가 **같은 함수**를 쓴다 —
 * 전에는 편집기만 라벨표를 갖고 있어, 굽기는 옛 글의 머리띠 글자를 손대지 못했다.
 */
export function langLabel(lang) {
    const l = normalizeLang(lang);
    return (l && LABEL.get(l)) || '텍스트';
}
/** hast 트리를 "글자 구간 + 클래스" 목록으로 편다 (편집 데코레이션용) */
export function tokens(lang, code) {
    const l = normalizeLang(lang);
    if (!l || !lowlight.registered(l))
        return [];
    let tree;
    try {
        tree = lowlight.highlight(l, code);
    }
    catch {
        return [];
    }
    const out = [];
    let pos = 0;
    const walk = (nodes, cls) => {
        for (const n of nodes) {
            if (n.type === 'text') {
                if (cls.length)
                    out.push({ from: pos, to: pos + n.value.length, cls: cls.join(' ') });
                pos += n.value.length;
            }
            else if (n.type === 'element') {
                const c = (n.properties?.className ?? []);
                walk(n.children, [...cls, ...c]);
            }
        }
    };
    walk(tree.children, []);
    return out;
}
/** "3-5,9" → 강조할 줄 번호 집합. 잘못된 조각은 조용히 버린다(절대 throw 안 함) */
export function parseRanges(spec) {
    const out = new Set();
    if (!spec)
        return out;
    for (const part of String(spec).split(',')) {
        const t = part.trim();
        if (!t)
            continue;
        const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(t);
        if (!m)
            continue;
        const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
        if (!Number.isFinite(a) || !Number.isFinite(b))
            continue;
        for (let i = Math.min(a, b); i <= Math.max(a, b) && i - Math.min(a, b) < 500; i++) {
            if (i > 0)
                out.add(i);
        }
    }
    return out;
}
/**
 * 강조 줄 집합 → "2,5-7". parseRanges 의 역함수.
 *
 * 강조는 이제 줄 번호를 눌러서 켠다(텍스트 입력 없음). 그래서 이 함수만이 highlight 를 쓰고,
 * 값은 항상 정규형이다 — 왕복에서 표기가 흔들릴 여지가 사라진다.
 */
export function formatRanges(set) {
    const ns = [...set].filter((n) => n > 0).sort((a, b) => a - b);
    if (ns.length === 0)
        return null;
    const parts = [];
    let a = ns[0], b = ns[0];
    for (const n of ns.slice(1)) {
        if (n === b + 1) {
            b = n;
            continue;
        }
        parts.push(a === b ? `${a}` : `${a}-${b}`);
        a = b = n;
    }
    parts.push(a === b ? `${a}` : `${a}-${b}`);
    return parts.join(',');
}
/** 줄 설명의 길이 상한. 여러 줄을 쓸 수 있으므로 한 줄짜리보다 넉넉하다. */
export const CODE_NOTE_MAX = 400;
/**
 * 줄 설명 — `{"3":"여기가 핵심","7":"…"}` 한 표기.
 *
 * `formatNotes` 만이 값을 만든다(강조의 `formatRanges` 와 같은 규약). 그래서 저장된 문자열은
 * 늘 정규형이고, 줄 번호 순서나 공백 차이로 왕복이 흔들릴 일이 없다.
 */
/**
 * 설명 문자열 정규화 — **줄바꿈은 살리고** 나머지 공백만 접는다.
 *
 * 설명이 한 줄로 끝나지 않는 경우가 많아 여러 줄을 허용한다.
 * 그래서 `\s+` 로 통째 접으면 안 된다 — 개행까지 지워져 쓴 대로 안 보인다.
 */
export function tidyNote(v) {
    return v
        .replace(/\r\n?/g, '\n')
        .replace(/[^\S\n]+/g, ' ') // 개행이 아닌 공백만 하나로
        .replace(/\n{3,}/g, '\n\n') // 빈 줄은 최대 하나
        .split('\n').map((l) => l.trim()).join('\n')
        .trim()
        .slice(0, CODE_NOTE_MAX);
}
/**
 * `{"3":{"t":"…","c":"rose"}}` 한 표기.
 *
 * 기본색(slate)이면 `c` 를 아예 안 쓴다 — 안 쓰는 키가 없어야 왕복이 흔들리지 않는다.
 * 옛 표기(`{"3":"…"}`, 색이 없던 시절)도 읽어 준다 — 그때 쓴 글이 깨지면 안 된다.
 */
export function parseNotes(raw) {
    const out = new Map();
    if (!raw)
        return out;
    let obj;
    try {
        obj = JSON.parse(raw);
    }
    catch {
        return out;
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj))
        return out;
    for (const [k, v] of Object.entries(obj)) {
        const n = Number(k);
        if (!Number.isInteger(n) || n < 1)
            continue;
        const src = typeof v === 'string' ? { t: v } : v;
        if (!src || typeof src !== 'object')
            continue;
        if (typeof src.t !== 'string')
            continue;
        const text = tidyNote(src.t);
        if (!text)
            continue;
        out.set(n, { text, tone: oneOf(CODE_NOTE_TONES, src.c, 'slate') });
    }
    return out;
}
export function formatNotes(map) {
    const entries = [...map]
        .filter(([n, v]) => Number.isInteger(n) && n >= 1 && v && typeof v.text === 'string')
        .map(([n, v]) => [n, { text: tidyNote(v.text), tone: oneOf(CODE_NOTE_TONES, v.tone, 'slate') }])
        .filter(([, v]) => v.text)
        .sort((a, b) => a[0] - b[0]);
    if (!entries.length)
        return null;
    const obj = {};
    for (const [n, v] of entries)
        obj[String(n)] = v.tone === 'slate' ? { t: v.text } : { t: v.text, c: v.tone };
    return JSON.stringify(obj);
}
export { lowlight };
//# sourceMappingURL=highlight.js.map
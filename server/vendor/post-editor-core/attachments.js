/**
 * 첨부 참조 — 본문에는 파일 주소가 아니라 `attachment://{id}` 만 들어간다.
 *
 * 왜 주소를 본문에 박지 않는가:
 * - presigned URL 은 만료된다. 본문에 박으면 글이 며칠 뒤에 깨진다
 * - 저장 위치(NAS·홈서버·S3)가 바뀌면 지난 글을 전부 고쳐야 한다
 * - 발행 때 정적 디렉터리로 구우면 주소 체계가 또 달라진다
 *
 * 그래서 본문은 **id 만** 들고, 보여줄 때마다 resolve() 가 주소로 바꾼다.
 * 편집 화면은 API 주소로, 발행 페이지는 구워진 파일의 상대 경로로 각각 풀린다.
 */
export { ATTACHMENT_SCHEME as SCHEME } from './vocab.js';
import { ATTACHMENT_SCHEME as SCHEME } from './vocab.js';
export const ref = (id) => SCHEME + id;
export const isRef = (src) => typeof src === 'string' && src.startsWith(SCHEME);
export const idOf = (src) => src.slice(SCHEME.length);
// ── 갈아끼우는 자리 ─────────────────────────────────────────────────────
/** 기본값은 없다 — 소비자가 반드시 configureAttachments 로 꽂는다.
 *  조용히 동작하는 기본 저장소를 두면 그게 곧 라이브러리에 저장소를 박는 것이다. */
let uploader = () => { throw new Error('첨부 업로더가 설정되지 않았습니다 — configureAttachments({ upload }) 를 먼저 부르세요'); };
let resolver = () => null;
/** 백엔드가 붙으면 여기 두 개만 바꾼다. 나머지 코드는 손대지 않는다. */
export function configureAttachments(next) {
    if (next.upload)
        uploader = next.upload;
    if (next.resolve)
        resolver = next.resolve;
}
/** `attachment://{id}` → 지금 화면에서 쓸 주소. 참조가 아니면 그대로 돌려준다. */
export function resolveSrc(src) {
    if (!src)
        return '';
    return isRef(src) ? (resolver(idOf(src)) ?? '') : src;
}
/**
 * 본문 HTML 안의 `src="attachment://{id}"` 만 주소로 바꾼다.
 *
 * **파서를 태우지 않는다.** 같은 일을 `toPublishedHtml` 도 하지만 그쪽은 hast 파이프라인
 * (parse5·하이라이터)을 끌고 오므로, 발행 페이지가 그걸 부르면 방문자 번들이 두 배가 된다 —
 * 실제로 그렇게 만들었다가 공개 빌드가 220KB 에서 512KB 가 됐다. 보여주기만 하는 쪽은
 * 이 문자열 치환으로 충분하다. 표 감싸개·코드 굽기 같은 구조 보정은 발행 시점(Node)의 몫이다.
 *
 * 속성 자리만 바꾼다 — 본문 글자로 적힌 `attachment://5` 는 건드리지 않는다.
 */
export function resolveAttachmentSrc(html) {
    return html.replace(/(\ssrc=)(["'])(attachment:\/\/[^"']+)\2/g, (all, lead, quote, ref) => {
        const url = resolveSrc(ref);
        // 못 풀면 참조를 그대로 둔다 — 빈 src 로 바꾸면 브라우저가 현재 페이지를 다시 받는다
        return url ? `${lead}${quote}${url}${quote}` : all;
    });
}
// ── 진행 중인 업로드 수 ─────────────────────────────────────────────────
let pending = 0;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(pending));
export function onUploads(fn) {
    listeners.add(fn);
    fn(pending);
    return () => { listeners.delete(fn); };
}
export async function upload(blob, name) {
    pending++;
    notify();
    try {
        return await uploader(blob, name);
    }
    catch {
        return null;
    }
    finally {
        pending--;
        notify();
    }
}
//# sourceMappingURL=attachments.js.map
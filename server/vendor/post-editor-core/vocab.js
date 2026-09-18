/**
 * 어휘 단일 정의 — 이 파일이 유일한 출처다.
 *
 * 여기서 나가는 곳: extension 의 parseHTML 검증 · 툴바 메뉴 목록 ·
 * AI 프롬프트/JSON 스키마 · 정적 렌더러. 네 곳이 각자 목록을 갖는 순간 어긋난다.
 *
 * 라이브러리 분리 시 이 파일은 core 로 간다.
 */
/**
 * 구분선의 **모양**. 두께와 색은 아래 두 축이 따로 맡는다.
 *
 * 「굵은 선」은 모양이 아니라 **두께**다. 모양 목록에 두면 「긴 선 + 굵게」와 같은 것을
 * 두 이름으로 부르게 된다. 옛 어휘의 `bold` 는 `migrateDivider` 가
 * `long` + `weight:'bold'` + `tone:'light'` 로 옮긴다(픽셀이 같다).
 * `dots3` 는 점 **세 개**(`. .`), `dots` 는 점이 쭉 이어지는 점선이다 — 다른 물건이다.
 */
/**
 * 코드 블록의 겉모습.
 *
 * - `plain`    기본 — 어두운 판 + 머리띠(제목·언어·복사)
 * - `mac`      macOS 창 — 신호등 셋 + **가운데 제목**. 언어 라벨은 감춘다
 *              (신호등 옆에 라벨이 붙으면 창이 아니라 코드 위젯으로 되돌아간다)
 * - `terminal` 터미널 — 프롬프트 기호, 낮은 대비
 */
export const CODE_THEMES = ['plain', 'mac', 'terminal'];
export const DIVIDER_KINDS = ['short', 'long', 'dots3', 'dots', 'wave', 'diamond', 'slash', 'vertical'];
/**
 * 선 두께. **null 이 1px(기본)** 이고 속성을 아예 안 쓴다.
 * `thin` 을 넣지 않는 이유: null 과 같은 모양이라 정규형이 둘이 된다.
 * 선 모양(short·long·vertical)에만 뜻이 있고, 점·무늬는 지금 이 값을 읽지 않는다.
 */
export const DIVIDER_WEIGHTS = ['medium', 'bold'];
/**
 * 선 색 — **검정~회색 다섯 단계뿐이다.** 자유 색상값을 받지 않는다.
 *
 * 이유 셋: (1) 자유 hex 를 열면 어휘가 이 파일 밖으로 새고 AI 가 아무 색이나 넣는다.
 * (2) 다섯 단계가 전부 `prose.css` 의 기존 토큰이라 나중에 색을 손봐도 옛 글이 따라온다 —
 * 자유값은 못 따라온다. (3) 구분선은 글줄의 장식이라 잉크 톤을 벗어날 이유가 없다.
 * null 은 「모양별 기본색」이다(선은 --rule, 점·무늬는 --ink-faint).
 */
export const DIVIDER_TONES = ['faint', 'light', 'gray', 'dark', 'black'];
export const BLOCK_ALIGNS = ['left', 'center', 'right'];
export const QUOTE_VARIANTS = ['bar', 'quote', 'bubble', 'barquote', 'postit', 'frame', 'framebold'];
/** 출처 한 줄의 글자 수 상한 — 넘으면 normalizeDoc 이 자른다 */
export const QUOTE_SOURCE_MAX = 200;
/**
 * 사진 행에 들어갈 수 있는 장수의 상한.
 * 본문 폭 38rem 에서 세 장이면 한 장이 ~190px — 아직 읽힙니다. 네 장부터는 갤러리(다른 물건)입니다.
 */
export const IMAGE_ROW_MAX = 3;
export const TABLE_PRESETS = [
    'grid', 'head', 'dashgrid', 'rows', 'topline', 'minimal', 'stripes', 'column', 'clean',
    // 2026-09-11 추가 — 엑셀 표 스타일에서 절제된 톤만 가져온 넷
    'inkhead', // 머리행 검정
    'navy', // 남색 머리행 + 줄무늬
    'frame', // 굵은 바깥 테두리 + 얇은 안쪽 선
    'ledger', // 장부 — 머리행 밑 굵은 선 + 가로줄 + 첫 열 강조
];
export const TABLE_LINES = ['solid', 'dashed', 'dotted', 'double'];
/**
 * 표 바깥 모서리. **null 이 각진 모서리**(기본)이고 속성을 안 쓴다 — `line` 과 같은 규약.
 * 프리셋에 녹이지 않고 따로 둔 이유: 모서리는 「틀」의 성질이라 어느 프리셋과도 겹쳐 쓴다.
 * 녹이면 프리셋이 13 × 2 = 26 개가 된다.
 */
export const TABLE_RADII = ['soft', 'round'];
export const CAPTION_POS = ['below', 'above'];
export const LIST_MARKERS = ['disc', 'circle', 'square', 'decimal', 'lower-alpha', 'lower-roman'];
export const CALLOUT_TONES = ['note', 'tip', 'warn'];
/**
 * 다이어그램을 그리는 방식 둘.
 *
 * - `mermaid`  글로 쓴다. 시퀀스·플로우·상태·ER·프로세스
 * - `drawio`   캔버스로 그린다. AWS·Azure·GCP 아이콘이 필요한 배치도
 *
 * 둘 다 **원본이 텍스트**다 — 그래야 사람이 마우스로 고친 결과를 AI 가 다시 읽고 고친다.
 */
export const DIAGRAM_ENGINES = ['mermaid', 'drawio'];
/**
 * 글줄 정렬 — TextAlign 확장이 아는 넷과 **같아야** 한다.
 * `BLOCK_ALIGNS`(구분선·사진의 자리)와 헷갈리지 말 것: 저쪽은 「덩어리를 어디에 둘까」이고
 * 이쪽은 「글줄을 어느 쪽에 붙일까」라서 justify 가 더 있다.
 */
export const TEXT_ALIGNS = ['left', 'center', 'right', 'justify'];
/**
 * 줄 간격(%) — 문단·제목마다 따로 정한다.
 *
 * 네이버는 150~210% 만 준다. 우리 기본값이 172% 라 그 아래도 필요해서 100~140 을 덧댔다.
 * 값은 **정수 %** 로 저장하고 화면에는 `line-height: 1.8` 처럼 단위 없이 쓴다 —
 * % 로 쓰면 자식이 비율이 아니라 계산된 px 를 물려받아 글자 크기를 바꿀 때 어긋난다.
 */
export const LINE_HEIGHTS = [100, 120, 140, 150, 160, 170, 180, 190, 200, 210];
/**
 * 줄 설명 패널의 색. **코드 블록 하나에 하나**다 —
 * 한 블록 안에서 줄마다 색이 다르면 색이 뜻을 잃고 얼룩덜룩해진다.
 */
export const CODE_NOTE_TONES = ['slate', 'teal', 'violet', 'rose', 'amber'];
/**
 * 라이브러리가 **싣는** 글꼴 — npm 으로 오는 것뿐이다(`fonts.css` 와 1:1).
 *
 * ⚠ `fonts.css` 가 `@import` 하는 것과 **정확히 같아야 한다.** 선언 없는 글꼴을 목록에
 * 올리면 고를 수는 있는데 그려지지는 않는다 — 조용히 다른 글꼴로 대체될 뿐이다.
 *
 * 예전에는 여기 52벌이 있었다. 그중 37벌은 손으로 내려받아 레포에 박아 둔 것이라
 * 공개 npm 으로 재배포할 권한이 없다 — 「웹사이트 임베딩 가능」은 「파일 재배포 가능」이
 * 아니고, 서브셋으로 줄인 것은 여러 라이선스가 금지하는 **수정**이다.
 * 그 37벌은 쓰는 쪽 레포로 옮겼고, 아래 `configureFonts` 로 다시 꽂는다.
 */
const BASE = [
    { value: '', label: '기본서체' },
    { value: 'Noto Sans KR', label: '본고딕' },
    { value: 'Noto Serif KR', label: '본명조' },
    { value: 'Nanum Gothic', label: '나눔고딕' },
    { value: 'Nanum Myeongjo', label: '나눔명조' },
    { value: 'Gowun Dodum', label: '고운돋움' },
    { value: 'Gowun Batang', label: '고운바탕' },
    { value: 'Black Han Sans', label: '검은고딕' },
    { value: 'Nanum Pen Script', label: '나눔손글씨 펜' },
    { value: 'Nanum Brush Script', label: '나눔손글씨 붓' },
    { value: 'Gaegu', label: '개구쟁이' },
    { value: 'Nanum Gothic Coding', label: '나눔고딕코딩 (고정폭)' },
];
/**
 * 고를 수 있는 글꼴. **읽기 전용처럼 쓰되 배열 정체성은 바뀌지 않는다** —
 * `configureFonts` 가 제자리에서 갈아 끼우므로, 이걸 모듈 최상단에서 `map` 해 둔 곳이
 * 있으면 갱신을 못 본다. 그래서 react 쪽은 `fontItems()` 로 그때그때 만든다.
 */
export const FONTS = [...BASE];
export const FONT_VALUES = FONTS.map((f) => f.value);
/**
 * 쓰는 쪽이 제 글꼴을 더한다.
 *
 * 라이브러리는 재배포할 수 있는 것만 싣고, 레포에 직접 들고 있는 글꼴은 그 레포가 선언한다
 * (`public/assets/fonts.local.css` 의 `@font-face` + 여기 목록). 첨부 업로더를
 * `configureAttachments` 로 꽂는 것과 같은 자리다.
 *
 * **여러 번 불러도 결과가 같다** — 앞서 더한 것을 지우고 다시 넣는다.
 */
export function configureFonts(next = {}) {
    const extra = (next.extra ?? []).filter((f) => f && typeof f.value === 'string' && f.value !== '');
    FONTS.length = 0;
    FONTS.push(...BASE, ...extra);
    FONT_VALUES.length = 0;
    FONT_VALUES.push(...FONTS.map((f) => f.value));
}
/** 글자 크기(px) 상·하한 — 밖에서 들어온 값은 여기로 접는다 */
export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 96;
/**
 * 고를 수 있는 글자 크기(px). 본문 주변은 1px 씩, 제목 쪽은 성기게.
 * 툴바와 글자 버블이 **같은 목록**을 쓴다 — 따로 적어 두면 한쪽만 늘어난다.
 */
export const FONT_SIZES = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28, 32, 36];
/** 크기를 안 정했을 때의 본문 크기 — 선택칸이 보여 주는 기본값 */
export const FONT_SIZE_DEFAULT = 17;
/**
 * 글 제목의 크기(px). **본문과 목록이 다르다** — 제목은 고를 것이 적을수록 좋다.
 * 네이버는 26·32·38 셋만 준다. 우리는 더 큰 44 를 하나 더 둔다.
 */
export const TITLE_SIZES = [26, 32, 38, 44];
export const TITLE_SIZE_DEFAULT = 38;
/**
 * 제목이 받는 서식은 **서체·크기·정렬·색 넷뿐이다.**
 * 굵게·밑줄·취소선·인라인 코드·글자 배경색은 주지 않는다 — 제목은 이미 굵고 크다.
 * 거기에 서식을 더 얹으면 글의 첫인상이 들쭉날쭉해진다(네이버도 같은 넷만 준다).
 */
export const TITLE_MARKS = ['font', 'size', 'align', 'color'];
/**
 * 제목 글자 수 상한 — 넘으면 `normalizeTitle` 이 자른다.
 *
 * **저장소가 허용하는 만큼**으로 맞춘다(이 라이브러리를 쓰는 백엔드의 `title` 은 300자).
 * 더 짧게 잡으면 이미 저장된 긴 제목을 가진 글을 열었다가 저장하는 순간 제목이 잘린다 —
 * 입구 검증이 조용히 데이터를 버리는 자리가 된다. 화면에서 더 짧게 보이고 싶으면
 * 그건 자르기가 아니라 줄임표(CSS)로 할 일이다.
 */
export const TITLE_TEXT_MAX = 300;
/**
 * 제목 배너의 가로:세로.
 *
 * 우리 배너는 화면을 **꽉 채우는데** 네이버 것은 편집 열(창 폭의 약 82%)에만 걸린다.
 * 그래서 같은 비율이면 우리가 더 높아 보인다 — 눈으로 맞춘 값이다
 *.
 * 창 1600px 기준 337 → 436 → 400 → **381px**.
 *
 * CSS `aspect-ratio` 에 그대로 쓴다. **높이를 px 로 박지 않는다** — 편집·발행의 폭이
 * 같으면 비율에서 높이가 같이 나오므로 기하가 저절로 맞는다. 줄여 달라는 지시도
 * px 를 빼는 대신 비율로 옮긴다: 고정 px 를 섞으면 창 크기마다 인상이 달라진다.
 */
export const BANNER_RATIO = '21 / 5';
/** 좁은 화면에서 비율대로면 100px 남짓이다 — 제목 두 줄이 들어갈 최소 높이 */
export const BANNER_MIN_HEIGHT = 200;
/** 사진의 어느 점을 프레임 가운데에 둘지 — CSS object-position 의 % 그대로. 정수. */
export const FOCUS_MIN = 0;
export const FOCUS_MAX = 100;
export const FOCUS_DEFAULT = 50;
/** 일정 카드의 벽시계 기준. 표기는 저장하지 않고 이 상수로 렌더한다. */
export const TIME_ZONE = 'Asia/Seoul';
/**
 * 열거 속성의 유일한 관문. 어휘 밖 값은 여기서 기본값으로 접힌다.
 * 왕복 무손실은 "정규화된 문서" 에 대해 보장한다 — 어휘 밖 값이 들어오면
 * 첫 정규화에서 한 번 바뀌고, 그 뒤로는 안 바뀐다(멱등).
 */
export function oneOf(list, v, dflt) {
    return list.includes(v) ? v : dflt;
}
/**
 * null 을 허용하는 `oneOf` — 「안 정함」이 기본인 속성용(표의 선 종류·모서리, 구분선의 두께·색).
 *
 * `oneOf` 와 나눠 두는 이유: 기본값이 있는 속성은 어휘 밖 값을 **기본값으로** 접어야 하고,
 * 「안 정함」이 기본인 속성은 **null 로** 접어야 한다. 후자를 `oneOf` 로 처리하면
 * 「안 정함」과 「첫 번째 값」이 같은 뜻이 되어 정규형이 둘이 된다.
 */
export function oneOfOrNull(list, v) {
    if (v == null)
        return null;
    return list.includes(v) ? v : null;
}
/**
 * 색은 **`#rrggbb` 한 표기로만** 저장한다.
 *
 * 브라우저는 style 속성에 넣는 순간 `#c0392b` 를 `rgb(192, 57, 43)` 으로 바꾼다.
 * 그래서 JSON 이 hex 를 들고 있으면 HTML 을 거쳐 돌아올 때 rgb 가 되어 왕복이 깨진다.
 * 어느 쪽이든 하나로 굳혀야 하고, 고르는 쪽(색 팔레트)이 hex 를 쓰므로 hex 로 굳힌다.
 *
 * **extensions/ 가 아니라 여기 있다.** 제목 렌더러(`title.ts`)가 이 함수를 쓰는데,
 * extensions 에서 가져오면 `@tiptap/core` 가 딸려 와 **공개 빌드에 편집기가 실린다.**
 */
export function colorOf(raw) {
    const v = (raw ?? '').replace(/['"]+/g, '').trim().toLowerCase();
    if (!v)
        return null;
    const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(v);
    if (rgb) {
        const hex = (n) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0');
        return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
    }
    const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
    if (short)
        return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
    return /^#[0-9a-f]{6}$/.test(v) ? v : null;
}
/** 문자열 속성의 공통 처리 — 빈 문자열은 null 로 접어 "없음" 표현을 하나로 만든다. */
export function str(v, max) {
    if (typeof v !== 'string')
        return null;
    const t = max == null ? v : v.slice(0, max);
    return t.length === 0 ? null : t;
}
export function bool(v) {
    return v === true;
}
/** https?:// 만 허용. 그 외는 null (javascript: 등 차단 포함) */
export function httpUrl(v) {
    if (typeof v !== 'string')
        return null;
    return /^https?:\/\/\S+$/i.test(v.trim()) ? v.trim() : null;
}
/** 본문이 이미지를 가리키는 방식 — 저장소 참조가 정본이다 */
export const ATTACHMENT_SCHEME = 'attachment://';
/**
 * 이미지 주소로 허용하는 것 셋: 저장소 참조 · http(s) · data:image.
 *
 * `src` 를 아무 문자열이나 통과시키면 AI 가 만든 body_json 으로 `javascript:` 가 들어온다.
 * 링크(href)만 막아 두고 이미지를 열어 두면 막은 의미가 없다.
 */
export function imageSrc(v) {
    if (typeof v !== 'string')
        return null;
    const s = v.trim();
    if (s.startsWith(ATTACHMENT_SCHEME)) {
        return /^[\w.:-]{1,200}$/.test(s.slice(ATTACHMENT_SCHEME.length)) ? s : null;
    }
    if (/^https?:\/\/\S+$/i.test(s))
        return s;
    if (/^data:image\/[a-z0-9+.-]+[;,]/i.test(s))
        return s;
    return null;
}
//# sourceMappingURL=vocab.js.map
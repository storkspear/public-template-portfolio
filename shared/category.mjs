/**
 * 블로그 카테고리의 주소 규칙 — 관리자·API·굽기 셋이 이 파일 하나를 봅니다.
 *
 * 카테고리 주소(`/blog/<slug>/`)는 **글 폴더(`/blog/<번호>/`)와 같은 자리**에 섭니다.
 * 굽기는 `BLOG_DIR/<이름>/index.html` 을 쓰는데 글도 카테고리도 같은 폴더 규약이라,
 * 이름이 겹치면 한쪽이 다른 쪽을 말없이 덮어쓰고, 그 뒤 굽기의 자체검사
 * (`구운 글 ≠ 발행 글`)가 굽기 전체를 실패시킵니다. 그래서 규칙은 저장하는 문(관리자 API)과
 * 굽기 둘 다에서 같은 함수로 거릅니다 — 한쪽에만 적어 두면 다른 쪽이 조용히 어긋납니다.
 *
 * 규칙 넷:
 *   · 소문자 영문·숫자·하이픈만. 앞뒤 하이픈은 지웁니다(`text.mjs` 의 `cleanSlug` 와 같음)
 *   · **숫자만으로 된 이름은 거절**합니다 — 글 주소가 곧 글 번호(정수)라, 이 한 줄이
 *     글 폴더와의 충돌을 통째로 막습니다. 올린 사진 폴더(`/blog/0/`)도 숫자라 같이 비켜 갑니다
 *   · 견본 글의 주소 꼴(`d-1`…)을 거절합니다 — 미리보기가 그 이름으로 글을 굽습니다(`server/dummy.mjs`)
 *   · 관리자·공개면이 쓰는 낱말(`RESERVED`)을 거절합니다 — `blog` 를 가져가면 `/blog/blog/` 가
 *     되고 `assets` 는 공개면의 CSS 자리를 가립니다
 *
 * 관리자 번들에서도 불리므로 node 전용 API 를 쓰지 않습니다.
 */

/**
 * 주소로 쓸 수 없는 낱말. 원래 `server/admin-api.mjs` 에 있던 것을 여기로 옮겼습니다 —
 * 관리자가 저장 전에 같은 목록으로 거절 이유를 보여 줘야 하기 때문입니다.
 * 서버만 알면 「저장을 눌러야 안 된다는 것을 아는」 칸이 됩니다.
 */
export const RESERVED = new Set(['new', 'works', 'look', 'api', 'assets', 'fonts', 'media', 'blog',
  'portfolio', 'index', 'admin', 'preview', 'uploads', 'favicon'])

/** 견본 글의 주소 꼴 — `server/dummy.mjs` 의 `d-${i}` */
const DUMMY_SLUG = /^d-\d+$/
/** 글 폴더의 꼴 — 글 주소는 시퀀스가 준 정수뿐입니다(`admin-api.mjs` 의 `slug = no`) */
const NUMERIC = /^\d+$/
/** 폴더 이름 상한. `bake-safety.mjs` 의 `okSlug` 가 120바이트에서 끊으므로 그보다 넉넉히 짧게 */
export const SLUG_MAX = 40

/** 카테고리 이름 상한 — 목록 머리(`head.name`)와 같은 20자. 줄 하나에 들어갈 만큼만 */
export const CATEGORY_LABEL_MAX = 20
/** 카테고리 개수 상한. 줄(strip) 하나에 늘어서는 것이라 많아지면 메뉴가 아니라 벽이 됩니다 */
export const CATEGORY_MAX = 20
/** 카테고리 식별자의 꼴 — 글이 참조하는 값입니다(`posts.meta.category`). 이름이 아니라 이것을 들고 있어
    이름을 바꿔도 글이 고아가 되지 않습니다. 관리자가 만들 때 한 번 뽑고 그 뒤로 안 바뀝니다 */
export const CATEGORY_ID = /^[a-z][a-z0-9]{3,15}$/

/** 「기본」 — `/blog/` 그 자체입니다. 제 주소도 식별자도 없고, 카테고리를 안 정한 글의 자리입니다 */
export const DEFAULT_LABEL = '기본'

/** 관리자가 새 카테고리에 붙이는 식별자. `c` + 36진수 여섯 자리 — 사람이 읽을 일이 없어 짧게 */
export const newCategoryId = () => 'c' + Math.random().toString(36).slice(2, 8).padEnd(6, '0')

/* ── 로마자 ────────────────────────────────────────────────────────────
   국어의 로마자 표기법(2000) 의 글자 표를 그대로 씁니다. 음운 변동(연음·비음화 등)은
   안 적용합니다 — 여기서 만드는 것은 「고쳐도 되는 첫 제안」이지 정답이 아니고,
   변동 규칙까지 넣으면 틀리는 자리가 늘 뿐입니다. `개발 → gaebal`, `일상 → ilsang`. */
const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
const JUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo',
  'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i']
const JONG = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l',
  'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't']

/**
 * 한글 음절을 로마자로. 한글이 아닌 글자는 그대로 두되 공백은 하이픈으로 — 뒤의 `cleanSlug`
 * 가 영문·숫자·하이픈 밖을 전부 하이픈으로 바꾸므로, 여기서는 음절만 풀면 됩니다.
 */
export const romanize = (text) => [...String(text || '')].map((ch) => {
  const code = ch.codePointAt(0) - 0xac00
  if (code < 0 || code > 11171) return ch
  const cho = Math.floor(code / 588)
  const jung = Math.floor((code % 588) / 28)
  const jong = code % 28
  return CHO[cho] + JUNG[jung] + JONG[jong]
}).join('')

/** 주소 꼴로 다듬습니다 — `shared/text.mjs` 의 `cleanSlug` 와 같은 규칙에 길이 상한만 더합니다 */
export const cleanCategorySlug = (v) =>
  String(v || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    /* 자른 **뒤에** 한 번 더 깎습니다. 깎고 자르면 상한에서 하이픈이 끝에 남아
       (`'a'×39 + '-bbbb'` → `aaa…a-`) `slugProblem` 이 제가 만든 주소를 거절합니다 —
       `autoSlug` 가 읽을 수 있는 이름을 통째로 버리고 식별자로 떨어졌습니다 */
    .slice(0, SLUG_MAX).replace(/^-+|-+$/g, '')

/** 이름에서 주소 제안 하나 — 「개발」을 치면 `gaebal` 이 따라 적힙니다. 그 뒤로는 손으로 고칩니다 */
export const suggestSlug = (label) => cleanCategorySlug(romanize(label))

/**
 * 이름에서 **쓸 수 있는 주소를 끝까지 만들어 냅니다.** 관리자는 주소를 안 칩니다.
 *
 * 처음 설계에는 주소 칸이 있었는데, 사용자가 「카테고리명과 공개 여부만 설정하게 하라」고
 * 한 지시를 제가 중간에 덮어썼던 것입니다. 주소는 사람이 정할 거리가 아닙니다 —
 * 틀리면 저장이 막히고, 맞아도 얻는 것이 없습니다.
 *
 * 막히는 자리마다 스스로 비켜 갑니다. 한 번도 실패하지 않습니다:
 *   · 한글 이름 → 로마자 (`개발` → `gaebal`)
 *   · 로마자가 비면(기호·이모지뿐인 이름) 식별자를 씁니다 — 식별자는 늘 `c` 로 시작해 안전합니다
 *   · 숫자만·견본 꼴·예약어·이미 쓰는 주소면 뒤에 `-2`, `-3`… 을 답니다
 *   · 그래도 안 되면 식별자로 떨어집니다
 *
 * @param label  카테고리 이름
 * @param taken  이미 쓰는 주소들 (자기 자신은 빼고 넘기세요)
 * @param id     이 카테고리의 식별자 — 마지막 피난처
 */
export const autoSlug = (label, taken = [], id = '') => {
  const 쓴것 = new Set([...taken].filter(Boolean))
  const 된다 = (s) => s && !slugProblem(s) && !쓴것.has(s)
  const 뿌리 = suggestSlug(label)
  if (된다(뿌리)) return 뿌리
  /* 뿌리가 비면 숫자를 붙여도 비어 있습니다 — 그때는 식별자 쪽으로 갑니다 */
  if (뿌리) {
    for (let n = 2; n <= 99; n += 1) {
      /* 꼬리를 붙일 자리를 **먼저 비웁니다.** 그냥 이어 붙여 자르면 뿌리가 상한에 꽉 찼을 때
         98개 후보가 전부 뿌리와 같은 문자열이 되어, 겹침 피하기가 그 길이에서 죽습니다 */
      const 꼬리 = `-${n}`
      const 후보 = cleanCategorySlug(뿌리.slice(0, SLUG_MAX - 꼬리.length) + 꼬리)
      if (된다(후보)) return 후보
    }
  }
  if (된다(id)) return id
  for (let n = 2; n <= 99; n += 1) if (된다(`${id}-${n}`)) return `${id}-${n}`
  return id
}

/**
 * 이 주소를 쓸 수 없는 까닭. 괜찮으면 null.
 *
 * 다른 카테고리와의 겹침은 여기서 안 봅니다 — 목록을 아는 쪽(`normCategories`)이 봅니다.
 * 글 번호와의 겹침도 안 봅니다 — 숫자만으로 된 이름을 거절하는 것으로 끝납니다.
 */
export const slugProblem = (slug) => {
  const s = String(slug ?? '')
  if (!s) return '주소를 적어 주세요 (영문 소문자·숫자·하이픈)'
  if (s !== cleanCategorySlug(s)) return '영문 소문자·숫자·하이픈만 쓸 수 있습니다'
  if (NUMERIC.test(s)) return '숫자만으로 된 주소는 글 번호와 겹칩니다'
  if (DUMMY_SLUG.test(s)) return '견본 글이 쓰는 주소 꼴입니다 (d-숫자)'
  if (RESERVED.has(s)) return `쓸 수 없는 낱말입니다 (${s})`
  return null
}

/**
 * 글이 어느 카테고리에 속하나 — 식별자 하나 또는 빈 문자열.
 * `posts.meta` 는 jsonb 라 아무 모양이나 들어올 수 있습니다. 식별자 꼴이 아니면 「없음」으로 읽습니다.
 */
export const categoryOf = (meta) => {
  const id = meta && typeof meta === 'object' ? meta.category : ''
  return typeof id === 'string' && CATEGORY_ID.test(id) ? id : ''
}

/**
 * **주인 잃은 글**인가 — 카테고리를 가리키는데 그 카테고리가 설정에 없는 글.
 *
 * 처음에는 그런 글을 「기본」으로 읽었습니다. 글이 사라지는 쪽보다 `/blog/` 에만 나오는 쪽이 낫다고
 * 봤는데, 그 판단이 **비공개 카테고리에서 뒤집힙니다** — 숨기려고 넣어 둔 글이 카테고리가 빠지는
 * 순간 공개 목록으로 올라옵니다. 사라지는 것은 되돌릴 수 있고 새어 나간 것은 되돌릴 수 없습니다.
 *
 * 그래서 모르면 **안 내보냅니다.** 정상 경로로는 이 상태가 안 생깁니다 — 카테고리 삭제 문이 글을
 * 초안으로 내려 주고, 저장·되돌리기 문이 주인 잃을 글이 생기면 막습니다(`orphanedByBlog`).
 * 여기는 그 둘이 다 새었을 때 서는 마지막 난간입니다.
 *
 * @param known  설정에 있는 카테고리 식별자들 (Set)
 */
export const orphanOf = (meta, known) => {
  const id = categoryOf(meta)
  return id && !known.has(id) ? id : ''
}

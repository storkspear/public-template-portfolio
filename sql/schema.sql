-- 한 사이트의 블로그 스키마. 스키마 이름이 안 적혀 있습니다 — 연결의 search_path 가 정합니다.
-- 그래서 이 파일 하나로 어느 사이트든 똑같이 만듭니다.
-- 여러 번 돌려도 같은 결과여야 합니다(멱등).

create table if not exists posts (
  id            uuid primary key default gen_random_uuid(),
  -- 주소가 되는 번호. 날짜+무작위 대신 시퀀스를 씁니다 — 짧고, 저장 전에 미리 뽑을 수 있어서
  -- 사진을 `{번호}/` 폴더에 바로 쌓을 수 있습니다.
  no            bigint not null,
  slug          text   not null unique,
  title         text   not null,
  body          text   not null default '',
  doc           jsonb,          -- 편집 정본. 다시 열어 고칠 때 씁니다
  title_doc     jsonb,          -- 제목은 글자만이 아닙니다 — 배너·글꼴·크기·색이 같이 삽니다
  width         text,           -- 가운데폭/전체폭. 발행 페이지가 같은 폭으로 렌더링해야 합니다
  published_at  timestamptz,    -- null 이면 초안 (한 번도 안 내보낸 글)
  -- 내보냈다가 잠시 내린 글. 초안과 다른 축입니다 — 숨기려고 published_at 을 지우면
  -- 발행일이 사라져 다시 보일 때 오늘 날짜가 되고 목록 순서가 틀어집니다.
  hidden        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create sequence if not exists posts_no_seq owned by posts.no;
alter table posts alter column no set default nextval('posts_no_seq');
create unique index if not exists posts_no_key on posts (no);

-- 글에 붙은 사진. 파일은 `{BLOG_DIR}/{번호}/` 에 있고 여기가 그 경로를 압니다.
-- 경로를 id 에 박지 않는 이유: 저장소를 옮기면 지난 글을 전부 고쳐야 합니다(attachments.ts).
create table if not exists post_attachments (
  post_id       uuid not null references posts(id) on delete cascade,
  attachment_id text not null,
  file_path     text not null,
  kind          text not null default 'body',   -- 'banner' | 'body'
  created_at    timestamptz not null default now(),
  primary key (post_id, attachment_id)
);
create index if not exists post_attachments_att_idx on post_attachments (attachment_id);

-- 글을 지울 때는 파일 먼저, 행 나중입니다. 순서가 바뀌면 cascade 가 file_path 를
--   먼저 날려, 어떤 파일을 지워야 할지 모르는 고아가 남습니다.

-- 이미 있는 표에 뒤늦게 붙이는 칸들 (멱등)
alter table posts add column if not exists hidden boolean not null default false;

-- ── 초안 본문 ──────────────────────────────────────────────────────────
-- 발행한 글을 고치는 동안 나간 글은 그대로 있어야 합니다.
-- 열이 하나뿐이면 초안 저장이 곧 발행본 덮어쓰기였습니다(굽기까지 같이 돌았습니다).
-- 여기 있는 동안은 아무도 못 봅니다. 발행을 누르면 위 열로 옮겨 가고 여기는 비워집니다.
alter table posts add column if not exists draft_body      text;
alter table posts add column if not exists draft_doc       jsonb;
alter table posts add column if not exists draft_title     text;
alter table posts add column if not exists draft_title_doc jsonb;
alter table posts add column if not exists draft_width     text;
alter table posts add column if not exists draft_at        timestamptz;

-- ── 관리자 계정 ────────────────────────────────────────────────────────
-- 사이트마다 제 스키마에 하나씩 있습니다. 격리는 search_path 가 합니다.
--
-- 계정 표를 이 스키마 안에 둡니다. 외부 인증 서비스의 사용자 표를 빌려 쓰면
-- 신원 열이 대개 email 뿐이라 「아이디 + @도메인」으로 이메일을 지어내게 되고,
-- 그 표가 DB 에 하나뿐이라 사이트를 여럿 돌릴 때 서로 섞이지 않게 한 번 더 걸러야 합니다.
-- 여기로 들이면 둘 다 없어집니다 — 아이디는 그냥 아이디고, 가르는 일은 스키마가 합니다.
create table if not exists admins (
  id            text primary key,   -- 로그인에 치는 그 값. 이메일이 아니다
  password_hash text not null,      -- bcrypt. 새로 만드는 것은 cost 12
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── 로그인 세션 (RTR) ──────────────────────────────────────────────────
-- 액세스 토큰은 서명만 하고 서버가 기억하지 않습니다(30분). 리프레시만 여기 삽니다.
--
-- 토큰 자체는 저장하지 않습니다 — sha256 만 둡니다. DB 가 새도 세션은 안 넘어갑니다.
-- 한 번 로그인 = 한 `family`. 회전할 때마다 행이 하나 늘고 앞 행에 `used_at` 이 찍힙니다.
-- 이미 쓴 토큰이 다시 오면 훔쳐 갔다는 뜻이므로 그 가족 전체를 죽입니다.
create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  family      uuid not null,
  token_hash  bytea not null unique,
  admin_id    text not null references admins(id) on delete cascade,
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,          -- 회전되면 찍힙니다. 그 뒤에 또 오면 탈취입니다
  revoked_at  timestamptz,
  ua          text                  -- 진단용. 어떤 브라우저였는지만
);
create index if not exists sessions_family_idx  on sessions (family);
create index if not exists sessions_expires_idx on sessions (expires_at);

-- ── 작업물(포트폴리오) ─────────────────────────────────────────────────
-- 글과 같은 표에 삽니다. 별도 표로 가르면 굽기의 폴더 청소가 `posts` 만 보고 돌아서
-- 「우리 표에 없는 폴더」로 읽고 작업물 사진을 통째로 지운다(bake.mjs 의 `live` 참고).
-- 번호·주소·첨부·초안·휴지통이 전부 공짜로 따라옵니다 — 다른 건 `kind` 한 칸뿐입니다.
alter table posts add column if not exists kind text not null default 'post';
do $$ begin
  alter table posts add constraint posts_kind_chk check (kind in ('post', 'work'));
exception when duplicate_object then null; end $$;

-- 작업물에만 붙는 것들: 분류 태그·클라이언트·연도·역할·판형.
-- 열로 쪼개지 않는 이유 — 이 목록은 쓰는 사람이 늘리고 줄입니다. 열을 늘리면 그때마다 배포해야 합니다.
alter table posts add column if not exists meta       jsonb;
alter table posts add column if not exists draft_meta jsonb;

-- 작업물은 직접 정렬합니다. 글은 시간순이 맞지만 포트폴리오는 보여 주고 싶은 순서가 있습니다.
-- 비어 있으면 발행 역순으로 떨어진다(nulls last).
alter table posts add column if not exists ord int;

create index if not exists posts_kind_ord_idx on posts (kind, ord nulls last, published_at desc);

-- ── 사이트의 모양 ──────────────────────────────────────────────────────
-- 「틀 · 색·글꼴 · 메인 섹션 순서 · 직접 만든 화면」이 여기 삽니다.
--
-- 덧붙임 전용입니다. 고치지 않고 판(rev)을 하나 더 쌓습니다 — 지금 값은 키별 최대 rev.
-- 그래서 되돌리기가 「옛 값을 새 판으로 다시 넣기」 한 문장이 됩니다. 비개발자가 화면을
-- 통째로 갈아엎어 보게 하려면, 망쳤을 때 한 번에 되돌아가는 길이 먼저 있어야 합니다.
--
-- 행이 하나도 없으면 굽기는 기본 모양을 씁니다 — 즉 이 표가 비어 있는 상태가 지금 그대로입니다.
create table if not exists site_settings (
  key        text not null,            -- 'theme' | 'layout' | 'home' | 'custom'
  rev        int  not null,
  value      jsonb not null,
  created_at timestamptz not null default now(),
  created_by text,
  primary key (key, rev)
);
/* 이 판이 되돌리기로 생겼는지. 새로고침 뒤 「이전 판으로」가 방금 되돌린 판을
   「마지막 반영」으로 짐작해 도로 뒤집는 것을 막습니다. 반영은 null, 되돌리기는 'undo' */
alter table site_settings add column if not exists via text;

-- ── 무드보드 (작업물의 이미지) ─────────────────────────────────────────
-- 작업 하나 = 무드보드 폴더 하나. 디자이너는 글을 쓰지 않고 완성된 이미지를 올립니다.
--
-- 글의 사진과 같은 표를 씁니다(kind='mood'). 파일도 같은 폴더(`{BLOG_DIR}/{번호}/`)라
-- 지우기·휴지통·nginx 배선이 전부 그대로 따라옵니다. 다른 건 아래 네 칸뿐입니다.
alter table post_attachments add column if not exists ord   int;   -- 폴더 안의 차례
-- 원본 비율. 벽돌 목록이 자리를 미리 잡아 그림이 뜰 때 화면이 안 밀린다(CLS)
alter table post_attachments add column if not exists w     int;
alter table post_attachments add column if not exists h     int;
-- 격자용 작은 판. 없으면 원본을 씁니다 — 2000px 원본 열두 장을 격자에 그대로 깔면
-- 방문자가 그걸 다 내려받습니다. 만드는 곳은 브라우저(올릴 때), 서버에 의존성을 안 늘립니다.
alter table post_attachments add column if not exists thumb text;
create index if not exists post_attachments_ord_idx on post_attachments (post_id, ord);

-- ── 글의 카테고리·태그 ─────────────────────────────────────────────────
-- 새 열이 없습니다. 위에서 작업물용으로 파 두고 아무 문도 안 쓰던 `meta` / `draft_meta` 에
-- `{ "category": <식별자>, "tags": [...] }` 가 앉습니다(서버의 `normalizeMeta` 가 모양을 못 박습니다).
-- `category` 는 site_settings 의 `blog.categories[].id` 를 가리킵니다 — 이름이나 주소가 아니라
-- 식별자라, 카테고리 이름을 바꿔도 글이 고아가 되지 않습니다. 초안 그림자 규약은 본문과 같습니다:
-- 고치는 동안은 `draft_meta`, 발행하면 `meta` 로 옮겨 가고 `draft_meta` 는 비워집니다.
--
-- 이미 있는 글에 찍을 도장은 없습니다. 「기본」은 /blog/ 그 자체라(모든 글이 실립니다) 제 식별자가
-- 없고, 카테고리를 안 정한 글(`meta->>'category'` 가 비거나 없음)이 곧 기본입니다 — 지금 그대로가
-- 그 상태입니다. 여기서 `meta` 를 `{}` 로 채우면 모양만 바뀌고 뜻은 하나도 안 바뀝니다.
--
-- 굽기와 관리자가 `meta->>'category'` 로 거릅니다 — 비공개 카테고리의 글 빼기, 카테고리별 목록,
-- 카테고리마다 편수. 식 인덱스라 `->>` 그대로 적어야 질의가 탑니다.
create index if not exists posts_category_idx on posts (kind, (meta->>'category'));

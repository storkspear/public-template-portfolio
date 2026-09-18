#!/usr/bin/env node
/**
 * 예시 글을 **처음 한 번만** 심는다.
 *
 * 왜 한 번만인가: compose 는 다시 뜰 때마다 이걸 돈다. 매번 덮어쓰면 예시 글을 고쳐 둔
 * 사람이 재시작 한 번에 잃는다. 지운 사람에게 다시 나타나서도 안 된다.
 * 그래서 **slug 가 이미 있으면 건드리지 않는다** — 고친 것도, 지운 것도 그대로 둔다.
 *
 *   node --env-file=.env server/seed-posts.mjs
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { pgSsl } from './local.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const need = (k) => process.env[k] || (() => { throw new Error(`.env 에 ${k} 가 없습니다`) })()
const SCHEMA = need('PGSCHEMA')
if (!/^[a-z_][a-z0-9_]*$/.test(SCHEMA)) throw new Error(`PGSCHEMA 가 이상합니다: ${SCHEMA}`)

const files = (await readdir(join(HERE, 'seed')).catch(() => [])).filter((f) => f.endsWith('.json'))
if (files.length === 0) {
  console.log('예시 글 없음 — 건너뜁니다')
  process.exit(0)
}

const pool = new pg.Pool({
  host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD,
  ssl: pgSsl(), max: 1,
  options: `-c search_path=${SCHEMA},extensions,public`,
})

/**
 * **주소는 글 번호다** — 서버가 저장할 때 `slug = no` 로 못 박는다(`admin-api.mjs`).
 * 시드가 그 불변식을 어기면 두 가지가 같이 깨진다:
 *   · 관리자에서 그 글을 고쳐 저장하면 `no` 가 이미 쓰인 번호라 `posts_no_key` 로 500
 *   · 그 글을 지우면 삭제 API 가 `{번호}` 폴더만 치워 `{슬러그}/index.html` 이 공개로 남는다
 * 그래서 시드도 번호를 먼저 뽑아 슬러그로 쓴다. 파일에는 slug 를 적지 않는다.
 */
/**
 * **한 번 심었다는 사실을 표에 남긴다.**
 *
 * 「글이 있는가」로 판단하면 지운 사람에게 다시 나타난다 — 행이 없어졌으니 「없다」로
 * 읽히기 때문이다. 받은 사람이 제일 먼저 하는 일이 예시 글 지우기인데, 재시작할 때마다
 * 되살아나면 지울 방법이 없다.
 *
 * 자리는 `site_settings` — 이미 있는 「덧붙임 전용」 표라 새 표를 만들지 않는다.
 */
const SEEDED = 'seeded'
const { rowCount: 이미 } = await pool.query(
  `select 1 from site_settings where key = $1`, [SEEDED])
if (이미) {
  console.log('예시 글 — 이미 한 번 심었습니다 (지운 글은 다시 심지 않습니다)')
  await pool.end()
  process.exit(0)
}

let 심음 = 0
for (const f of files.sort()) {
  const p = JSON.parse(await readFile(join(HERE, 'seed', f), 'utf8'))
  if (!p.title) throw new Error(`seed/${f} 에 title 이 없습니다`)
  if (p.slug) throw new Error(`seed/${f} 에 slug 가 있습니다 — 주소는 글 번호로 정해집니다`)

  /* 번호를 먼저 뽑아 **그대로 슬러그로.** 서버가 저장할 때 `slug = no` 로 못 박으므로
     시드도 그 불변식을 지켜야 한다 — 어기면 그 글은 고칠 수도(500) 지울 수도(공개면에
     HTML 이 남음) 없다. */
  const { rows: [{ no }] } = await pool.query(`select nextval('posts_no_seq')::text as no`)
  await pool.query(
    /* `$1` 을 두 자리에 쓰므로 **형을 적어 준다** — 안 적으면 no(bigint)와 slug(text) 사이에서
       형 추론이 실패해 `cannot determine data type of parameter` 로 죽는다 */
    `insert into posts (no, slug, title, body, doc, title_doc, width, published_at)
     values ($1::bigint, $1::text, $2, $3, $4, $5, $6, now())
     on conflict (slug) do nothing`,
    [no, p.title, p.body ?? '', p.doc ?? null, p.title_doc ?? null, p.width ?? null])
  심음++
}

/* 표식은 **맨 나중에.** 중간에 죽으면 다음 부팅이 다시 시도한다 */
await pool.query(
  `insert into site_settings (key, rev, value) values ($1, 1, $2::jsonb)
   on conflict (key, rev) do nothing`,
  [SEEDED, JSON.stringify({ files: files.length, at: new Date().toISOString() })])

console.log(`예시 글 — ${심음}편 심었습니다`)
await pool.end()

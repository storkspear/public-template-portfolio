#!/usr/bin/env node
/**
 * 스키마를 만든다 — 여러 번 돌려도 같은 결과다.
 *
 * `sql/schema.sql` 에는 스키마 이름이 안 적혀 있다. 여기서 `search_path` 를 걸고 돌리므로
 * 같은 파일이 어느 사이트든 만든다. 스키마 이름만 다르다 — 그게 「사이트마다 스키마」의 값어치다.
 *
 *   node server/migrate.mjs            운영·로컬 공용 (PGSCHEMA 를 본다)
 *   node server/migrate.mjs --local    + pgcrypto 와 시드 계정
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { pgSsl } from './local.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const local = process.argv.includes('--local')
const need = (k) => process.env[k] || (() => { throw new Error(`.env 에 ${k} 가 없습니다`) })()
const SCHEMA = need('PGSCHEMA')

const pool = new pg.Pool({
  host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD,
  /* 로컬 도커는 TLS 가 없다 */
  ssl: pgSsl(), max: 1,
  /* ⚠ `set search_path` 한 줄로 때우면 **같은 커넥션에 떨어진다는 보장**에 기대게 된다.
     풀이 다른 연결을 주면 표가 `public` 에 생긴다. admin-api 와 같게 연결에 못 박는다.
     (스키마는 아래에서 형식을 검사한 값이라 여기 끼워 넣어도 안전하다) */
  options: `-c search_path=${/^[a-z_][a-z0-9_]*$/.test(SCHEMA) ? SCHEMA : 'public'},extensions,public`,
})

/* 스키마 이름은 파라미터로 못 넘긴다 — 식별자라서. 그래서 형식을 먼저 검사한다 */
if (!/^[a-z_][a-z0-9_]*$/.test(SCHEMA)) throw new Error(`PGSCHEMA 가 이상합니다: ${SCHEMA}`)
/* 스키마가 **이미 있으면 만들지 않는다.** 권한을 좁힌 전용 역할로 붙는 경우
   그 역할에는 스키마를 만들 권한이 없고, `create schema if not exists` 는 있어도 권한부터 본다.
   그때는 관리자 자격으로 한 번 만들어 두고 그 뒤로는 이 스크립트가 표만 손보게 한다. */
const { rowCount: hasSchema } = await pool.query('select 1 from pg_namespace where nspname = $1', [SCHEMA])
if (!hasSchema) await pool.query(`create schema ${SCHEMA}`)
await pool.query(`set search_path = ${SCHEMA},extensions,public`)

/**
 * 비밀번호 해시(`crypt`/`gen_salt`)는 pgcrypto 가 준다 — **로컬이든 배포든 필요하다.**
 * 확장은 `extensions` 스키마에 둔다: 사이트 스키마 안에 만들면 스키마를 지울 때 같이 날아가고,
 * 여러 사이트가 한 DB 를 쓸 때 자리가 갈린다.
 *
 * 관리형 DB 는 확장 만들 권한을 안 주는 곳이 있다. 그때는 **경고만 하고 넘어간다** —
 * 이미 만들어져 있으면 그대로 쓰면 되고, 없으면 로그인할 때 크게 실패한다.
 */
try {
  await pool.query('create schema if not exists extensions')
  await pool.query('create extension if not exists pgcrypto schema extensions')
} catch (e) {
  console.warn(`pgcrypto 를 준비하지 못했습니다 — 관리자가 한 번 만들어 주어야 합니다:
  create extension if not exists pgcrypto schema extensions;
  (${e.message})`)
}

await pool.query(await readFile(join(ROOT, 'sql/schema.sql'), 'utf8'))

if (local) {
  /**
   * 계정은 **표가 생긴 뒤에** 심는다 — `admins` 는 schema.sql 이 만든다.
   *
   * ⚠ 비밀번호에 **기본값을 두지 않는다.** 코드에 적힌 순간 그게 「아는 비밀번호」가 되고,
   * 누군가 그대로 쓰면 git 이력을 뒤지는 것만으로 열린다. 안 주면 안 심고 알려 준다.
   */
  /**
   * 아이디도 **기본값을 두지 않는다.** 여기 한 사람의 아이디를 박아 두면 이 템플릿을
   * 받은 사람이 제 것도 아닌 아이디로 계정을 갖게 된다.
   * `.env.example` 이 `ADMIN_ID=admin` 을 주므로 빠질 일은 없다.
   */
  const id = need('ADMIN_ID')
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) {
    console.log(`계정을 안 심었습니다 — .env 의 ADMIN_PASSWORD 가 비었습니다.`)
    console.log(`  채워 넣거나, 이걸 쓰세요:  node --env-file=.env server/set-password.mjs ${id}`)
  } else {
    await pool.query(
      `insert into admins (id, password_hash) values ($1, crypt($2, gen_salt('bf', 12)))
       on conflict (id) do update set password_hash = excluded.password_hash, updated_at = now()`,
      [id, pw])
    console.log(`로컬 계정: ${id}`)
  }
}

const { rows } = await pool.query(
  `select table_name from information_schema.tables where table_schema = $1 order by table_name`, [SCHEMA])
console.log(`스키마 ${SCHEMA}: ${rows.map((r) => r.table_name).join(', ') || '(비었음)'}`)
await pool.end()

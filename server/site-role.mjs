#!/usr/bin/env node
/**
 * 사이트 전용 DB 역할을 세웁니다 — 여러 번 돌려도 같은 결과입니다.
 *
 *   openssl rand -hex 32 | node --env-file=<관리자 env> server/site-role.mjs <스키마>
 *
 * 왜: 사이트들이 Supabase 프로젝트 하나를 스키마만 갈라 씁니다. 전부 `postgres` 로 붙으면
 * 가르는 것이 `search_path` 하나뿐이라, API 에 결함 하나가 생기면 남의 사이트 스키마와 auth 까지
 * 닿습니다. 사이트마다 제 스키마만 쓸 수 있는 역할로 붙으면 그 결함이 제 스키마 안에서 멈춥니다.
 *
 * 하는 일(한 트랜잭션 — 검사까지 통과해야 커밋합니다):
 *   1. 역할 `site_<스키마>` 를 만든다(있으면 비밀번호만 바꿉니다). 로그인만 되고 다른 권한은 없습니다.
 *   2. 관리자를 그 역할의 구성원으로 둡니다 — 소유권을 넘기려면 필요하고, 넘긴 뒤에도 대시보드
 *      SQL 편집기(postgres)에서 표를 계속 볼 수 있어야 합니다. 사이트 역할끼리는 서로 못 봅니다.
 *   3. 스키마(없으면 만들고)와 그 안의 표 소유자를 그 역할로 — migrate 가 표를 고칠 수 있게.
 *   4. `extensions` 사용 권한 — 로그인이 쓰는 crypt()/gen_salt() 가 거기 있습니다.
 *   5. 거꾸로 검사: 제 스키마는 되고, 남의 스키마·auth·storage 는 막혀야 합니다. 실패면 롤백.
 *
 * 관리자 env 는 `postgres` 로 붙는 PG* 만 있으면 됩니다. 서버에 두지 말고 맥에서 돌립니다 —
 * 관리자 자격이 서버에 있으면 셸이 뚫렸을 때 역할을 가른 값어치가 없어집니다. 끝나면 사이트 .env 를
 * PGUSER=site_<스키마>.<프로젝트 ref>, PGPASSWORD=<stdin 으로 준 값> 으로 바꿉니다.
 *
 * 비밀번호는 평문으로 DB 에 보내지 않습니다. Supabase 는 DDL 을 로그(`log_statement=ddl`)와
 *   `pg_stat_statements` 에 남기므로 `create role … password '평문'` 이 대시보드에 그대로 보입니다.
 *   SCRAM 검증값을 여기서 계산해 넘기고, 그 트랜잭션 동안은 문장 기록도 끕니다.
 * 비밀번호는 hex 로 만듭니다 — .env 는 sh(`. .env`)와 node(`--env-file`)가 둘 다 읽어서
 *   `$`·따옴표·`#` 이 들어가면 둘이 다른 값을 읽습니다.
 *
 * 되돌리기(관리자로):  reassign owned by site_<스키마> to postgres;
 *                      drop owned by site_<스키마>; drop role site_<스키마>;
 *   그리고 사이트 .env 의 PGUSER/PGPASSWORD 를 관리자 것으로(deploy.sh 는 ALLOW_ADMIN_PGUSER=1 로).
 */
import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'
import pg from 'pg'

const SCHEMA = process.argv[2] || process.env.PGSCHEMA
if (!/^[a-z_][a-z0-9_]*$/.test(SCHEMA || '')) throw new Error(`스키마 이름이 이상합니다: ${SCHEMA}`)
const ROLE = `site_${SCHEMA}`

const readPassword = () => new Promise((resolve, reject) => {
  if (process.stdin.isTTY) {
    process.stdout.write(`${ROLE} 의 DB 비밀번호: `)
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = () => {}
    rl.question('', (a) => { process.stdout.write('\n'); rl.close(); resolve(a) })
  } else {
    let s = ''
    process.stdin.on('data', (c) => { s += c }).on('end', () => resolve(s.replace(/\r?\n$/, ''))).on('error', reject)
  }
})

const pw = await readPassword()
if (!/^[0-9a-f]{48,}$/.test(pw)) {
  console.error('역할 비밀번호는 hex 48자 이상으로 — `openssl rand -hex 32`')
  process.exit(1)
}

/** Postgres 가 저장하는 형식 그대로의 SCRAM-SHA-256 검증값(RFC 5802/7677). 평문은 DB 로 안 갑니다 */
const scram = (password) => {
  const salt = randomBytes(16), iter = 4096
  const salted = pbkdf2Sync(password, salt, iter, 32, 'sha256')
  const clientKey = createHmac('sha256', salted).update('Client Key').digest()
  const storedKey = createHash('sha256').update(clientKey).digest()
  const serverKey = createHmac('sha256', salted).update('Server Key').digest()
  return `SCRAM-SHA-256$${iter}:${salt.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`
}

const pool = new pg.Pool({
  host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD,
  ssl: process.env.PGHOST === 'localhost' ? false : { rejectUnauthorized: false }, max: 1,
})
const c = await pool.connect()
try {
  await c.query('begin')
  /* 이 트랜잭션의 문장은 로그·통계에 안 남깁니다. 설정이 없는 로컬 도커에서는 조용히 넘어갑니다 */
  for (const s of ["set local log_statement = 'none'", 'set local pg_stat_statements.track_utility = off']) {
    await c.query('savepoint q'); await c.query(s).catch(() => {}); await c.query('release savepoint q').catch(() => c.query('rollback to savepoint q'))
  }
  const { rows: [me] } = await c.query('select current_user as u')

  /* 식별자는 파라미터로 못 넘깁니다 — 위에서 형식을 검사한 값만 끼웁니다. 검증값은 format('%L') 로 */
  const { rowCount: exists } = await c.query('select 1 from pg_roles where rolname = $1', [ROLE])
  const { rows: [{ lit }] } = await c.query(`select format('%L', $1::text) as lit`, [scram(pw)])
  await c.query(exists
    ? `alter role ${ROLE} with login password ${lit}`
    : `create role ${ROLE} with login noinherit password ${lit}`)
  await c.query(`grant ${ROLE} to ${me.u} with set true, inherit true`)

  const { rowCount: hasSchema } = await c.query('select 1 from pg_namespace where nspname = $1', [SCHEMA])
  await c.query(hasSchema ? `alter schema ${SCHEMA} owner to ${ROLE}` : `create schema ${SCHEMA} authorization ${ROLE}`)
  /* 표만 넘깁니다 — 인덱스와 열에 묶인 시퀀스(posts_no_seq)는 표를 따라가고, 따로 넘기면 오류가 납니다 */
  const { rows: tables } = await c.query(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relkind in ('r', 'p')`, [SCHEMA])
  for (const t of tables) await c.query(`alter table ${SCHEMA}.${t.relname} owner to ${ROLE}`)
  await c.query(`grant usage on schema extensions to ${ROLE}`)

  /* ── 거꾸로 검사 — 커밋 전에. 권한은 「준 것」이 아니라 「되는 것」으로 봅니다 ── */
  const bad = []
  const { rows: stray } = await c.query(
    `select c.relname, pg_get_userbyid(c.relowner) as owner from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relkind in ('r', 'p', 'S', 'v', 'm') and c.relowner <> (select oid from pg_roles where rolname = $2)`,
    [SCHEMA, ROLE])
  bad.push(...stray.map((r) => `${SCHEMA}.${r.relname} 소유자가 ${r.owner}`))
  const { rows: reach } = await c.query(
    `select nspname from pg_namespace
      where has_schema_privilege($1, oid, 'USAGE')
        and nspname not in ('pg_catalog', 'information_schema', 'public', 'extensions', $2)
        and nspname not like 'pg\\_%'`, [ROLE, SCHEMA])
  bad.push(...reach.map((r) => `남의 스키마 ${r.nspname} 에 닿는다`))
  const { rows: [role] } = await c.query(
    `select rolsuper, rolcreaterole, rolcreatedb, rolbypassrls, rolreplication,
            (select count(*)::int from pg_auth_members m where m.member = r.oid) as member_of
       from pg_roles r where rolname = $1`, [ROLE])
  for (const k of ['rolsuper', 'rolcreaterole', 'rolcreatedb', 'rolbypassrls', 'rolreplication']) if (role[k]) bad.push(`역할에 ${k} 가 켜져 있다`)
  if (role.member_of) bad.push(`역할이 다른 역할 ${role.member_of}개의 구성원입니다(권한을 물려받습니다)`)
  const { rows: [can] } = await c.query(
    `select has_schema_privilege($1, 'public', 'CREATE') as public_create,
            has_schema_privilege($1, 'extensions', 'CREATE') as ext_create,
            has_database_privilege($1, current_database(), 'CREATE') as db_create,
            has_function_privilege($1, 'extensions.crypt(text,text)', 'EXECUTE') as crypt,
            has_function_privilege($1, 'extensions.gen_salt(text,integer)', 'EXECUTE') as gen_salt`, [ROLE])
  for (const k of ['public_create', 'ext_create', 'db_create']) if (can[k]) bad.push(`${k} 권한이 있다`)
  for (const k of ['crypt', 'gen_salt']) if (!can[k]) bad.push(`로그인에 필요한 ${k} 를 못 부른다`)
  for (const t of tables) {
    const { rows: [p] } = await c.query(
      `select has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE') as ok`, [ROLE, `${SCHEMA}.${t.relname}`])
    if (!p.ok) bad.push(`${SCHEMA}.${t.relname} 를 읽고 쓰지 못한다`)
  }
  if (bad.length) {
    await c.query('rollback')
    console.error('✗ 검사 실패 — 아무것도 바꾸지 않았습니다(롤백):\n  ' + bad.join('\n  '))
    process.exit(1)
  }
  await c.query('commit')
  console.log(`${ROLE}: ${exists ? '비밀번호 갱신' : '생성'} · 스키마 ${SCHEMA} 와 표 ${tables.length}개 소유 · extensions 사용`)
  console.log(`✓ ${ROLE} 는 ${SCHEMA} 만 씁니다 (남의 스키마·auth·storage 에 안 닿음, 특권·구성원 없음)`)
} catch (e) {
  await c.query('rollback').catch(() => {})
  throw e
} finally {
  c.release(); await pool.end()
}

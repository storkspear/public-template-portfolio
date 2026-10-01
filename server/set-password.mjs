#!/usr/bin/env node
/**
 * 관리자 비밀번호를 정합니다.
 *
 *   node --env-file=../.env server/set-password.mjs [아이디]
 *
 * 비밀번호는 stdin 으로 가려서 받습니다 — 인자로 주면 셸 기록과 `ps` 에 남습니다.
 * 여기서도 화면에 안 찍고, 해시만 DB 로 갑니다. bcrypt cost 12.
 *
 * 계정이 없으면 만들고, 있으면 바꿉니다.
 */
import { createInterface } from 'node:readline'
import pg from 'pg'
import { pgSsl } from './local.mjs'

const need = (k) => process.env[k] || (() => { throw new Error(`.env 에 ${k} 가 없습니다`) })()
const SCHEMA = need('PGSCHEMA')
/* 인자로 주면 그걸, 없으면 `.env`. 기본값은 두지 않습니다 — 아래 migrate.mjs 와 같은 이유입니다 */
const id = process.argv[2] || need('ADMIN_ID')

/**
 * 입력한 글자를 화면에 안 보여 줍니다 — 어깨너머도 방어입니다.
 * 프롬프트는 우리가 직접 쓰고, readline 의 출력은 통째로 막습니다.
 *
 * 터미널이 아니면 바로 멈춥니다. 파이프로 넘기면 가릴 수가 없고, 예전 판은 두 번째
 * 물음에서 영영 기다렸습니다(설명 없이 멈추면 원인을 찾을 수 없습니다).
 */
const askHidden = (q) => new Promise((resolve, reject) => {
  if (!process.stdin.isTTY) {
    reject(new Error('터미널에서 직접 실행해 주세요 — 파이프로는 비밀번호를 가릴 수 없습니다'))
    return
  }
  process.stdout.write(q)
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  rl._writeToOutput = () => {}
  rl.question('', (a) => { process.stdout.write('\n'); rl.close(); resolve(a) })
})

let pw, again
try {
  pw = await askHidden(`${id} 의 새 비밀번호: `)
  again = await askHidden('한 번 더: ')
} catch (e) { console.error(e.message); process.exit(1) }
if (!pw || pw !== again) { console.error('비밀번호가 비었거나 서로 다릅니다'); process.exit(1) }
if (pw.length < 12) { console.error('12자 이상으로 해주세요'); process.exit(1) }

const pool = new pg.Pool({
  host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD,
  ssl: pgSsl(),
  options: `-c search_path=${SCHEMA},extensions,public`, max: 1,
})
try {
  await pool.query(
    `insert into admins (id, password_hash) values ($1, crypt($2, gen_salt('bf', 12)))
     on conflict (id) do update set password_hash = excluded.password_hash, updated_at = now()`,
    [id, pw])
  /* 비밀번호를 바꿨으면 열려 있던 세션도 끊습니다 — 안 그러면 바꾼 뜻이 반쪽입니다 */
  const { rowCount } = await pool.query(
    `update sessions set revoked_at = now() where admin_id = $1 and revoked_at is null`, [id])
  console.log(`${SCHEMA}.admins: ${id} 설정 완료 (bcrypt cost 12)`)
  console.log(`열려 있던 세션 ${rowCount}개를 끊었습니다 — 다시 로그인해야 합니다`)
} finally { await pool.end() }

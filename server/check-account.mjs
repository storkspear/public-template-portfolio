#!/usr/bin/env node
/**
 * 관리자 계정이 실제로 **있는지** 확인한다. 배포가 이걸 지난다.
 *
 * 왜 필요한가: `migrate.mjs` 는 `admins` 표를 만들 뿐 계정을 심지 않는다(운영은 비밀번호를
 * 모르니까). 표만 비어 있으면 `/api/health` 는 글 수만 보므로 **200 을 돌려주고**,
 * 배포는 「✓ 배포 끝」을 찍은 뒤 관리자를 잠근다. 성공을 보고하면서 잠그는 배포가
 * 제일 나쁘다 — 여기서 시끄럽게 멈춘다.
 */
import pg from 'pg'
import { pgSsl } from './local.mjs'

const need = (k) => process.env[k] || (() => { throw new Error(`.env 에 ${k} 가 없습니다`) })()
const SCHEMA = need('PGSCHEMA')
const pool = new pg.Pool({
  host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD,
  ssl: pgSsl(),
  options: `-c search_path=${SCHEMA},extensions,public`, max: 1,
})
try {
  const { rows } = await pool.query(`select id, substring(password_hash, 1, 7) as algo from admins`)
  if (!rows.length) {
    console.error(`✗ ${SCHEMA}.admins 가 비었습니다 — 이대로 배포하면 로그인이 안 됩니다.`)
    console.error('  계정을 심으세요:  node --env-file=../.env server/set-password.mjs <아이디>')
    process.exit(1)
  }
  for (const r of rows) console.log(`  계정 ${r.id} (${r.algo}…)`)
} finally { await pool.end() }

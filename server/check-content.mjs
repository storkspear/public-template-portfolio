#!/usr/bin/env node
/**
 * 구운 산출물이 있는데 DB 가 비었는지 확인합니다. 배포가 굽기 직전에 이걸 지납니다.
 *
 * 왜 필요한가: 굽기는 DB 를 읽어 공개면을 통째로 다시 씁니다. 그래서 **빈 DB 에 붙은 채로
 * 돌면 공개면이 빈 사이트로 덮입니다** — 글 목록은 0편이 되고 첫 화면도 기본값으로 돌아갑니다.
 * 사진 원본은 안전합니다(`bake.mjs` 는 `blog/<슬러그>/index.html` 만 지우고 폴더는 안 건드립니다).
 * 그래도 공개면이 비는 것은 방문자에게 그대로 보이므로 먼저 멈춥니다.
 *
 * 이 상황은 둘 중 하나입니다.
 *   · DB 를 새로 만들었거나 갈아탔습니다 — 그렇다면 굽기 전에 자료를 옮겨야 합니다
 *   · `.env` 가 엉뚱한 곳을 가리킵니다 — 남의 빈 스키마에 붙어 있습니다
 *
 * 자동 배포에서 특히 중요합니다. 사람이 돌릴 때는 화면을 보고 이상을 눈치채지만,
 * push 한 번으로 도는 배포는 아무도 안 보는 사이에 공개면을 비워 놓습니다.
 *
 * 디스크에 구운 글이 하나도 없으면(첫 배포) 통과시킵니다 — 덮어쓸 것이 없습니다.
 */
import { readdir } from 'node:fs/promises'
import pg from 'pg'
import { pgSsl } from './local.mjs'

const need = (k) => process.env[k] || (() => { throw new Error(`.env 에 ${k} 가 없습니다`) })()
const SCHEMA = need('PGSCHEMA')
const BLOG = need('BLOG_DIR')

/** 이미 구워져 있는 글 — `<슬러그>/index.html` 이 있는 폴더의 수 */
const bakedPosts = async () => {
  let n = 0
  for (const e of await readdir(BLOG, { withFileTypes: true }).catch(() => [])) {
    if (!e.isDirectory()) continue
    const inner = await readdir(`${BLOG}/${e.name}`).catch(() => [])
    if (inner.includes('index.html')) n += 1
  }
  return n
}

const pool = new pg.Pool({
  host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD,
  ssl: pgSsl(),
  options: `-c search_path=${SCHEMA},extensions,public`, max: 1,
})
try {
  const { rows } = await pool.query(`select count(*)::int as n from posts where kind = 'post'`)
  const inDb = rows[0].n
  const onDisk = await bakedPosts()
  if (onDisk > 0 && inDb === 0) {
    console.error(`✗ 디스크에는 구운 글이 ${onDisk}편인데 ${SCHEMA}.posts 는 0편입니다.`)
    console.error('  이대로 구우면 공개면이 빈 사이트로 덮입니다. 굽기 전에 멈춥니다.')
    console.error(`  .env 가 맞는 DB 를 가리키는지 보세요 — 지금 ${process.env.PGHOST} / 스키마 ${SCHEMA}`)
    console.error('  DB 를 일부러 비운 것이라면:  ALLOW_EMPTY_DB=1 sh deploy/deploy.sh')
    process.exit(1)
  }
  console.log(`  글 DB ${inDb}편 · 구운 것 ${onDisk}편`)
} finally { await pool.end() }

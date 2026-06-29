// 测对儿 · 本地 eval（带 JSON 解析埋点）
// 直接 import scanPipeline 在本地跑真实 LLM（key 来自 vercel env pull 的 .env.local），
// 读 trace.parse 统计「LLM 原始输出一次解析成功」的真实比例（区分兜底）。
//
// 用法：NODE_USE_ENV_PROXY=1 node eval/run-eval-local.mjs
//   REPS=4 可调每档重复次数。
//
// 与 run-eval.mjs（打线上端点）的区别：本地无 IP 限流、能拿到 trace.parse 埋点。

import { readFileSync, writeFileSync } from 'node:fs'

// --- 载入 .env.local ---
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim().replace(/^["']|["']$/g, '')
    if (!(m[1] in process.env)) process.env[m[1]] = v
  }
} catch { console.error('缺少 .env.local，先跑：vercel env pull .env.local --environment=production --yes'); process.exit(1) }

const { scanPipeline } = await import('../lib/scan-orchestrator.js')

const QUESTION = 'TA 还想我吗?'
const SELF = ['黏黏糖']
const PARTNER = ['深海冰山']
const REPS = Number(process.env.REPS || 4)
const RELATIONS = ['冷战中', '前任', '暗恋', '异地恋', '正在暧昧', '稳定恋爱中', '已婚']

const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

async function main() {
  if (!process.env.LLM_API_KEY || !process.env.LLM_MODEL) { console.error('LLM env 未载入'); process.exit(1) }
  console.log(`[eval-local] model=${process.env.LLM_MODEL}  reps=${REPS}  total=${RELATIONS.length * REPS} scans`)
  const raw = []
  let n = 0
  const total = RELATIONS.length * REPS
  for (const relation of RELATIONS) {
    for (let i = 0; i < REPS; i++) {
      n++
      try {
        const r = await scanPipeline(QUESTION, { relation, self_archetypes: SELF, partner_archetypes: PARTNER })
        const rec = { relation, ok: true, percent: r.percent, parseQ: r.trace.parse.q, parseHeart: r.trace.parse.heart }
        raw.push(rec)
        console.log(`[${n}/${total}] ${relation.padEnd(6)} ${r.percent}%  q:${rec.parseQ ? '✓' : '✗'} heart:${rec.parseHeart ? '✓' : '✗'}`)
      } catch (e) {
        raw.push({ relation, ok: false, error: String(e.message || e) })
        console.log(`[${n}/${total}] ${relation}  FAIL ${e.message}`)
      }
    }
  }

  // 解析埋点统计（每次 scan 含 2 个 JSON 解析型 agent：Q + Heart）
  const okRecs = raw.filter(r => r.ok)
  const qTotal = okRecs.length, qOk = okRecs.filter(r => r.parseQ).length
  const hTotal = okRecs.length, hOk = okRecs.filter(r => r.parseHeart).length
  const parseTotal = qTotal + hTotal, parseOk = qOk + hOk

  // 端到端可靠性（流水线没抛错且 percent 合法）
  const e2eOk = okRecs.filter(r => Number.isFinite(r.percent) && r.percent >= 5 && r.percent <= 95).length

  // 单调性中位数
  const byRel = {}
  for (const rel of RELATIONS) byRel[rel] = { median: median(okRecs.filter(r => r.relation === rel).map(r => r.percent)), n: okRecs.filter(r => r.relation === rel).length }

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: 'local', model: process.env.LLM_MODEL,
    config: { reps: REPS, relations: RELATIONS },
    parseReliability: {
      q: { ok: qOk, total: qTotal }, heart: { ok: hOk, total: hTotal },
      overall: { ok: parseOk, total: parseTotal, rate: parseTotal ? parseOk / parseTotal : null }
    },
    e2eReliability: { ok: e2eOk, total: raw.length },
    monotonicity: { byRel },
    raw
  }
  writeFileSync(new URL('./results-local.json', import.meta.url), JSON.stringify(summary, null, 2))

  console.log('\n===== EVAL (local, 带解析埋点) =====')
  console.log(`原始 JSON 解析成功率(区分兜底): ${parseOk}/${parseTotal} = ${(parseOk / parseTotal * 100).toFixed(1)}%`)
  console.log(`  Q-Agent:    ${qOk}/${qTotal}`)
  console.log(`  Heart-Agent:${hOk}/${hTotal}`)
  console.log(`端到端可用率: ${e2eOk}/${raw.length}`)
  console.log('心动浓度中位数:')
  for (const rel of RELATIONS) console.log(`  ${rel.padEnd(6)} ${byRel[rel].median}%`)
  console.log(`\n→ 写入 eval/results-local.json`)
}
main().catch(e => { console.error(e); process.exit(1) })

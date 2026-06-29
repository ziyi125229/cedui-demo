// 测对儿 · 离线 eval harness
// 直接打线上生产端点 /api/scan，评测真实生产路径（不依赖本地 LLM key）。
//
// 评测两件事（都不需要人工标注，property-based）：
//   E1 单调性 — 固定双方型号，只变关系状态，看 Heart-Agent 的心动浓度
//             中位数是否按 baseline 规则排序（冷战/前任 低 < 暧昧/恋爱 高）。
//   E2 输出可靠性 — 调用返回合法 {ok:true, percent∈[5,95]} 的比例。
//
// 用法：NODE_USE_ENV_PROXY=1 node eval/run-eval.mjs  → 写 eval/results.json + 打印摘要
//   （本机走代理 127.0.0.1:7897；Node fetch 默认不读 *_proxy 环境变量，
//    必须 NODE_USE_ENV_PROXY=1 才能让 fetch 走代理，否则直连 Vercel 会超时。）
//
// 节流：scan 端点限流 30/次/分钟，每次调用间隔 2.5s（任意 60s 窗口内 ≤24 次）。

const BASE = process.env.EVAL_BASE || 'https://cedui-demo.vercel.app'
const QUESTION = 'TA 还想我吗?'
const SELF = ['黏黏糖']      // 固定：自己
const PARTNER = ['深海冰山'] // 固定：TA（与 xray 场景一致）
const REPS = 4               // 每个关系状态重复次数
const GAP_MS = 2500          // 调用间隔（避开 30/min 限流）

// baseline 期望序：低 → 高（来自 heart-agent.js 的 baseline 区间规则）
const RELATIONS = ['冷战中', '前任', '暗恋', '异地恋', '正在暧昧', '稳定恋爱中', '已婚']

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function callScan(relation) {
  const body = {
    question: QUESTION,
    context: { relation, self_archetypes: SELF, partner_archetypes: PARTNER },
    debug: true // 让端点回传 meta.parse 解析埋点
  }
  const t0 = Date.now()
  try {
    const res = await fetch(`${BASE}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const ms = Date.now() - t0
    if (!res.ok) return { ok: false, status: res.status, ms }
    const data = await res.json()
    const percent = Number(data.percent)
    const valid = data.ok === true && Number.isFinite(percent) && percent >= 5 && percent <= 95
    const parse = data.meta && data.meta.parse ? data.meta.parse : null
    return { ok: valid, status: res.status, percent, judgment: data.judgment, parse, ms }
  } catch (e) {
    return { ok: false, status: 0, error: String(e.message || e), ms: Date.now() - t0 }
  }
}

function median(arr) {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

async function main() {
  const proxy = process.env.https_proxy || process.env.HTTPS_PROXY
  if (proxy && process.env.NODE_USE_ENV_PROXY !== '1') {
    console.warn(`[warn] 检测到代理 ${proxy} 但未设 NODE_USE_ENV_PROXY=1，fetch 可能直连超时。`)
  }
  console.log(`[eval] base=${BASE}  reps=${REPS}  relations=${RELATIONS.length}  total=${RELATIONS.length * REPS} calls`)
  const raw = []
  let n = 0
  const total = RELATIONS.length * REPS
  for (const relation of RELATIONS) {
    for (let i = 0; i < REPS; i++) {
      const r = await callScan(relation)
      raw.push({ relation, ...r })
      n++
      console.log(`[${n}/${total}] ${relation}  ${r.ok ? r.percent + '%  ' + (r.ms) + 'ms' : 'FAIL(' + (r.status ?? r.error) + ')'}`)
      if (n < total) await sleep(GAP_MS)
    }
  }

  // E2 端到端可靠性
  const okCount = raw.filter(r => r.ok).length
  const reliability = okCount / raw.length

  // E3 原始 JSON 解析成功率（区分兜底）— 每次 scan 含 Q + Heart 两个解析型 agent
  const withParse = raw.filter(r => r.parse)
  let qOk = 0, hOk = 0
  withParse.forEach(r => { if (r.parse.q) qOk++; if (r.parse.heart) hOk++ })
  const parseTotal = withParse.length * 2, parseOk = qOk + hOk
  const parseReliability = {
    q: { ok: qOk, total: withParse.length },
    heart: { ok: hOk, total: withParse.length },
    overall: { ok: parseOk, total: parseTotal, rate: parseTotal ? parseOk / parseTotal : null }
  }

  // E1 单调性：每个关系的中位数
  const byRel = {}
  for (const rel of RELATIONS) {
    const pcts = raw.filter(r => r.relation === rel && r.ok).map(r => r.percent)
    byRel[rel] = { n: pcts.length, median: median(pcts), values: pcts }
  }

  // 断言通过情况（只用真实存在的关系）
  const checks = [
    ['冷战中', '正在暧昧'],
    ['前任', '稳定恋爱中'],
    ['冷战中', '已婚'],
    ['前任', '正在暧昧']
  ].map(([lo, hi]) => {
    const mlo = byRel[lo]?.median, mhi = byRel[hi]?.median
    const pass = mlo != null && mhi != null && mlo < mhi
    return { lo, hi, medianLo: mlo, medianHi: mhi, pass }
  })
  const checksPassed = checks.filter(c => c.pass).length

  const summary = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    config: { question: QUESTION, self: SELF, partner: PARTNER, reps: REPS, relations: RELATIONS },
    reliability: { okCount, total: raw.length, rate: reliability },
    parseReliability,
    monotonicity: { byRel, checks, checksPassed, checksTotal: checks.length },
    latencyMs: { median: median(raw.filter(r => r.ms).map(r => r.ms)) },
    raw
  }

  const fs = await import('node:fs')
  const url = new URL('./results.json', import.meta.url)
  fs.writeFileSync(url, JSON.stringify(summary, null, 2))

  console.log('\n===== EVAL SUMMARY =====')
  console.log(`端到端可靠性: ${okCount}/${raw.length} = ${(reliability * 100).toFixed(1)}% 返回合法响应`)
  if (parseTotal) {
    console.log(`原始 JSON 解析成功率(区分兜底): ${parseOk}/${parseTotal} = ${(parseOk / parseTotal * 100).toFixed(1)}%`)
    console.log(`  Q-Agent ${qOk}/${withParse.length} · Heart-Agent ${hOk}/${withParse.length}`)
  }
  console.log('心动浓度中位数（按关系，期望递增）:')
  for (const rel of RELATIONS) console.log(`  ${rel.padEnd(6)}  ${byRel[rel].median ?? 'n/a'}%  (n=${byRel[rel].n})`)
  console.log(`单调性断言: ${checksPassed}/${checks.length} 通过`)
  checks.forEach(c => console.log(`  ${c.lo} < ${c.hi}: ${c.pass ? 'PASS' : 'FAIL'}  (${c.medianLo} vs ${c.medianHi})`))
  console.log(`\n→ 写入 ${url.pathname}`)
}

main().catch(e => { console.error(e); process.exit(1) })

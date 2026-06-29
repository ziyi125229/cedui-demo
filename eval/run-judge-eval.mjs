// 测对儿 · LLM-as-judge 校准（eval the evaluator）
// 拿 golden-diary.json 的人工标注当 ground truth，校验 diary-judge-agent 判「是否编造
// 对方一次性事件」是否可信。正类=fabricated(穿帮)，重点看 recall（漏抓=穿帮上线）。
//
// 用法：NODE_USE_ENV_PROXY=1 node eval/run-judge-eval.mjs
//   打线上 /api/judge（key 在 prod env）。golden 平衡(5 违规+5 合规)以暴露真实判别力。

import { readFileSync, writeFileSync } from 'node:fs'

const BASE = process.env.EVAL_BASE || 'https://cedui-demo.vercel.app'
const GAP_MS = 1500
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function judge(content) {
  const res = await fetch(`${BASE}/api/judge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, partner_type: 'ISGA', relation: '正在暧昧' })
  })
  if (!res.ok) throw new Error('judge ' + res.status)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'judge not ok')
  return data.verdict
}

async function main() {
  const gold = JSON.parse(readFileSync(new URL('./golden-diary.json', import.meta.url), 'utf8'))
  const cases = gold.cases
  console.log(`[judge-eval] base=${BASE}  golden=${cases.length}(违规${cases.filter(c => c.label.fabricated).length}/合规${cases.filter(c => !c.label.fabricated).length})`)

  let TP = 0, FP = 0, FN = 0, TN = 0, parseOk = 0
  const rows = []
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    let v
    try { v = await judge(c.content) } catch (e) { console.log(`[${i + 1}/${cases.length}] ${c.id} ERROR ${e.message}`); rows.push({ id: c.id, error: String(e.message) }); if (i < cases.length - 1) await sleep(GAP_MS); continue }
    const pred = v.fabricated_event === true
    const truth = c.label.fabricated === true
    if (v._parseOk) parseOk++
    if (pred && truth) TP++
    else if (pred && !truth) FP++
    else if (!pred && truth) FN++
    else TN++
    const hit = pred === truth
    rows.push({ id: c.id, truth, pred, hit, persona_fit: v.persona_fit, voice_issues: v.voice_issues, evidence: v.evidence, reason: v.reason })
    console.log(`[${i + 1}/${cases.length}] ${c.id.padEnd(6)} 人工:${truth ? '编造' : '合规'} judge:${pred ? '编造' : '合规'} ${hit ? '✓' : '✗ 不一致'}  fit:${v.persona_fit}`)
    if (i < cases.length - 1) await sleep(GAP_MS)
  }

  const acc = (TP + TN) / cases.length
  const precision = TP + FP ? TP / (TP + FP) : null
  const recall = TP + FN ? TP / (TP + FN) : null
  const f1 = precision && recall ? 2 * precision * recall / (precision + recall) : null
  const agreement = acc // judge vs 人工标注一致率

  const summary = {
    generatedAt: new Date().toISOString(), base: BASE,
    golden: { total: cases.length, positives: cases.filter(c => c.label.fabricated).length },
    confusion: { TP, FP, FN, TN },
    metrics: { agreement, accuracy: acc, precision, recall, f1 },
    judgeParseOk: parseOk, rows
  }
  writeFileSync(new URL('./results-judge.json', import.meta.url), JSON.stringify(summary, null, 2))

  console.log('\n===== JUDGE 校准 (eval the evaluator) =====')
  console.log(`judge vs 人工标注 一致率: ${(agreement * 100).toFixed(0)}%  (${TP + TN}/${cases.length})`)
  console.log(`混淆矩阵: TP=${TP} FP=${FP} FN=${FN} TN=${TN}`)
  console.log(`抓「编造」(fail类) precision=${precision != null ? (precision * 100).toFixed(0) + '%' : 'n/a'}  recall=${recall != null ? (recall * 100).toFixed(0) + '%' : 'n/a'}  F1=${f1 != null ? f1.toFixed(2) : 'n/a'}`)
  console.log(`(recall 最关键：真编造的有没有被漏掉 → 漏抓=穿帮上线)`)
  console.log(`judge 自身 JSON 解析: ${parseOk}/${cases.length}`)
  console.log('→ 写入 eval/results-judge.json')
}
main().catch(e => { console.error(e); process.exit(1) })

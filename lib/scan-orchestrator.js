// Scan Orchestrator · 测谎扫描的 multi-agent 流水线
// 优化版：Q-Agent + Heart-Agent 并行，Verdict-Agent 接住两者结果

import { qAgent } from './agents/q-agent.js'
import { heartAgent } from './agents/heart-agent.js'
import { verdictAgent } from './agents/verdict-agent.js'

const DEBUG = process.env.DEBUG_AGENTS === 'true'
const log = (label, payload) => {
  if (!DEBUG) return
  console.log('\n────────────────────────────────────')
  console.log(`[${label}]`)
  console.log(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2))
}

/**
 * 测谎扫描 pipeline · 并行版本
 * 时序：[Q + Heart 并行] → Verdict
 *
 * @param {string} question - 用户问题
 * @param {Object} context - { relation, self_archetypes, partner_archetypes, usedVerdicts }
 * @returns {Promise<Object>} { percent, judgment, trace }
 */
export async function scanPipeline(question, context = {}) {
  const t0 = Date.now()
  log('Scan input', { question, context })

  // Step 1+2 并行：问题解析 + 心动浓度推演
  const [parsed, heart] = await Promise.all([
    qAgent(question),
    heartAgent({ question, context })
  ])
  const t1 = Date.now()
  log('Q-Agent output (parallel)', parsed)
  log('Heart-Agent output (parallel)', heart)

  // Step 3：基于两者结果生成判词
  const judgment = await verdictAgent({
    percent: heart.percent,
    question,
    intent: parsed.intent,
    emotion: parsed.emotion,
    relation: context.relation,
    usedVerdicts: context.usedVerdicts || []
  })
  const t2 = Date.now()
  log('Verdict-Agent output', judgment)

  return {
    percent: heart.percent,
    judgment,
    trace: {
      parsed,
      heart_reasoning: heart.reasoning,
      // 每个 JSON 解析型 agent 的原始解析是否成功（true=一次过，false=走了兜底）
      parse: { q: parsed._parseOk === true, heart: heart._parseOk === true },
      timing: {
        parallel_qh_ms: t1 - t0,
        verdict_ms: t2 - t1,
        total_ms: t2 - t0
      }
    }
  }
}

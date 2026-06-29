// Orchestrator · 串接 Q-Agent → T-Agent → P-Agent 三步流水线
// 也是你后续改 prompt / 加 agent / 改协作方式的主入口

import { qAgent } from './agents/q-agent.js'
import { tAgent } from './agents/t-agent.js'
import { pAgent } from './agents/p-agent.js'

const DEBUG = process.env.DEBUG_AGENTS === 'true'
const log = (label, payload) => {
  if (!DEBUG) return
  console.log('\n────────────────────────────────────')
  console.log(`[${label}]`)
  console.log(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2))
}

// 把最近若干轮 ask 历史压成一小段"TA 之前说过"的上下文。
// 保持极简：不引入 chat-app 多轮交互感，只是给 T-Agent 一个连续性提示。
function buildPriorBlock(priorTurns) {
  if (!Array.isArray(priorTurns) || priorTurns.length === 0) return ''
  const lines = priorTurns
    .slice(-3)
    .map(t => {
      const q = (t && typeof t.q === 'string') ? t.q.trim().slice(0, 80) : ''
      const a = (t && typeof t.a === 'string') ? t.a.trim().slice(0, 120) : ''
      if (!a) return ''
      return `· 当被问"${q}"时，TA说："${a}"`
    })
    .filter(Boolean)
  if (lines.length === 0) return ''
  return `PREVIOUSLY TA SAID:\n${lines.join('\n')}\n`
}

/**
 * 完整 ask agent pipeline
 * @param {string} question - 用户问题
 * @param {Object} context - { score, relation, self_archetypes, partner_archetypes, ... }
 * @param {Array}  priorTurns - 可选，最近若干轮 {q,a,ts}，用来给 TA 短期记忆
 * @returns {Promise<Object>} { answer, trace } trace 是调试用的中间产物
 */
export async function askPartnerPipeline(question, context = {}, priorTurns = []) {
  const t0 = Date.now()
  log('Q-Agent input', question)

  // Step 1: 问题理解
  const parsed = await qAgent(question)
  const t1 = Date.now()
  log('Q-Agent output', parsed)

  // 把最近几轮压成 prior 段，注入到 T-Agent 的 context 里
  const priorBlock = buildPriorBlock(priorTurns)
  const tContext = priorBlock
    ? { ...context, prior_block: priorBlock }
    : context
  if (priorBlock) log('T-Agent prior block', priorBlock)

  // Step 2: TA 的内心独白
  const innerMonologue = await tAgent({
    question,
    intent: parsed.intent,
    emotion: parsed.emotion,
    focus: parsed.focus,
    context: tContext
  })
  const t2 = Date.now()
  log('T-Agent output (inner monologue)', innerMonologue)

  // Step 3: 润色为说出口的话
  const finalAnswer = await pAgent({
    innerMonologue,
    question
  })
  const t3 = Date.now()
  log('P-Agent output (final answer)', finalAnswer)

  return {
    answer: finalAnswer,
    trace: {
      parsed,
      inner_monologue: innerMonologue,
      prior_turns_used: priorBlock ? priorTurns.slice(-3).length : 0,
      timing: {
        q_agent_ms: t1 - t0,
        t_agent_ms: t2 - t1,
        p_agent_ms: t3 - t2,
        total_ms: t3 - t0
      }
    }
  }
}
// Heart-Agent · 心动浓度推演
// 输入：用户问题 + Q-Agent 解析 + 双方关系状态 + 性格原型
// 输出：{ percent: float, reasoning: string }

import { callLLM } from '../llm.js'

const SYSTEM_PROMPT = `你是「心动浓度推演 Agent」。任务：基于用户问的问题 + 双方关系状态，推断 TA 当下对用户的心动浓度。

【输入信息】你会拿到：
- 用户原话
- 问题意图、情绪、焦点（来自 Q-Agent 解析）
- 双方关系状态（暧昧 / 恋爱 / 已婚 / 前任 / 冷战中 / 异地恋 / ...）
- 双方性格原型（温柔守护型 / 直球行动型 / 神秘情绪型 / 欢脱戏精型 / 稳重持家型 / 天真烂漫型）

【推演规则】
关系状态决定 baseline 区间：
- 正在暧昧 / 刚开始恋爱：40-90，看问题敏感度
- 稳定恋爱中：60-92，相对稳定
- 已婚：65-88，浓度更稳但偶尔较低
- 异地恋：50-82，看问题指向
- 冷战中：25-58
- 前任：15-50，但某些情境下会拉高
- 暗恋：30-75
- 复杂关系：30-75

问题敏感度调整 (在 baseline 上 ±20)：
- "TA 想我吗 / 在意我吗" → 通常偏高
- "TA 有别人吗 / 第三者" → 反映 TA 忠诚度，已婚/恋爱关系 typically 高
- "TA 真的喜欢我吗 / 真心吗" → 中等
- "TA 后悔 / 会挽留吗" → 看关系是否完整
- "我们能走到最后吗" → 看 TA 对长期承诺的态度

性格原型加权（弱影响 ±5）：
- 神秘情绪型：通常浓度比表面高
- 欢脱戏精型：表面热但浓度有时虚高
- 稳重持家型：浓度稳定
- 直球行动型：心动外露
- 温柔守护型：默默深情
- 天真烂漫型：浓度上下起伏

【随机性】
在推算结果上加入 ±5 的合理随机，避免每次完全一样。

【输出格式】严格 JSON：
{
  "percent": <float, 8-95, 保留 1 位小数>,
  "reasoning": "<1-2 句简短理由，给开发者看>"
}

只输出 JSON，不要 markdown 包裹。`

export async function heartAgent({ question, context }) {
  // Heart-Agent 独立于 Q-Agent 运行（并行调用），自己读 raw question + context
  const userMsg = `【用户问题】
${question}

【关系上下文】
- 关系状态: ${context.relation || '未指定'}
- TA 在用户眼中是: ${(context.partner_archetypes || []).join('、') || '未填'}
- 用户自评是: ${(context.self_archetypes || []).join('、') || '未填'}

请推演 TA 此刻对用户的心动浓度。`

  const raw = await callLLM({
    system: SYSTEM_PROMPT,
    user: userMsg,
    temperature: 0.85,
    maxTokens: 200
  })

  // 容错解析 JSON
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      let percent = parseFloat(parsed.percent)
      if (isNaN(percent)) percent = 50.0
      percent = Math.max(5, Math.min(95, percent))
      return {
        percent: Math.round(percent * 10) / 10,
        reasoning: parsed.reasoning || '',
        // _parseOk: LLM 原始输出一次解析成功（非兜底）。供 eval 统计真实解析率。
        _parseOk: true
      }
    } catch (e) {
      // 落入兜底
    }
  }
  return {
    percent: 50.0,
    reasoning: 'fallback (json parse failed)',
    _parseOk: false
  }
}

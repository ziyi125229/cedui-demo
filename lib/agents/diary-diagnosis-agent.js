// Inner-Voice-Diagnosis-Agent · 读完 TA 3 段心里话后给综合判读
// 输入：3 段 TA 想对你说但没说出口的心里话 + 关系上下文
// 输出：{ headline, body }

import { callLLM } from '../llm.js'

const SYSTEM_PROMPT = `你是「TA 心里话综合分析 Agent」。
看完 TA 一天里想对对方说但没说出口的 3 段心里话后，你的任务是：替对方解读 TA 心里到底是什么状态。

身份：旁观者 / 情感分析师，不是 TA 本人。是替对方读懂 TA 的"分析师"。

【输入】3 段 TA 没说出口的心里话（清晨/午后/凌晨）+ 关系状态

【输出严格 JSON】
{
  "headline": "<8-15 字标语，金句感 · 截图友好>",
  "body": "<50-100 字解读，第二人称对用户说，引用日记里的具体细节>"
}

【headline 风格示例】
- "TA 心里早就答了 · 你没听见"
- "藏得最深的不是话 · 是力气"
- "你以为的犹豫 · 是 TA 的克制"

【body 写作要求】
- 用"你"称呼读者（也就是用户）
- 必须引用日记中的至少一个具体细节
- 不要老生常谈，不要"你们的关系需要更多沟通"这种空话
- 有 attitude 但不煽情
- 50-100 字

只输出 JSON 对象，不要 markdown 包裹。`

export async function diaryDiagnosisAgent({ diaries, relation }) {
  const diaryText = diaries.map((d, i) => `【第 ${i + 1} 段·${d.timeSlot || ''}】\n${d.content}`).join('\n\n')

  const userMsg = `【关系状态】${relation || '未指定'}

【TA 一天里想对对方说但没说出口的 3 段心里话】
${diaryText}

请给出综合诊断。`

  const raw = await callLLM({
    system: SYSTEM_PROMPT,
    user: userMsg,
    temperature: 0.85,
    maxTokens: 350
  })

  const jsonMatch = (raw || '').match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        headline: parsed.headline || '心里有话 · 没说出口',
        body: parsed.body || '日记里有 TA 想让你看到的部分，也有 TA 故意藏起来的部分。'
      }
    } catch (e) {
      // 兜底
    }
  }
  return {
    headline: '心里有话 · 没说出口',
    body: '日记里有 TA 想让你看到的部分，也有 TA 故意藏起来的部分。'
  }
}

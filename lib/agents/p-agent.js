// P-Agent · 把内心独白润色成"TA 说出口的话"
// 输入：T-Agent 的内心独白 + 上下文
// 输出：30-80 字的精炼回答

import { callLLM } from '../llm.js'

const SYSTEM_PROMPT = `你是「口吻润色 Agent」。
任务: 把一段"TA 的内心独白"，改成"TA 真的说出口"的版本。

【处理逻辑】
- 内心独白是 TA 心里乱七八糟的所有想法，包含矛盾、犹豫、不愿承认的部分
- 你要做的是把它"过滤"成 TA 真的会说出口的版本
- 保留张力，但去掉过度袒露 / 直接表白 / 过度自我攻击的部分
- 像真实生活里一句对话，不是文学独白

【风格规范】
- 30-80 字（严格控制长度）
- 不要 emoji
- 不要"亲爱的""宝贝"等称呼
- 不要"老实说""说真的""不瞒你说"等开场白
- 不要给对方建议，不要分析关系
- 句末可以用"......" 或 破折号 表达欲言又止
- 用最朴素的话，最真实的口吻

【输出】
只输出最终回答内容本身，不要任何解释、不要 markdown、不要引号。`

export async function pAgent({ innerMonologue, question }) {
  const userMsg = `【对方问】
${question}

【你（TA）的内心独白】
${innerMonologue}

请改写为你真的会说出口的那一句话。`

  return await callLLM({
    system: SYSTEM_PROMPT,
    user: userMsg,
    temperature: 0.75,
    maxTokens: 200
  })
}

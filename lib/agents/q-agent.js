// Q-Agent · 问题理解
// 输入：用户原话
// 输出：{ intent, emotion, focus } JSON

import { callLLM } from '../llm.js'

const SYSTEM_PROMPT = `你是「问题理解 Agent」，专门解析用户在关系测试 app 里问"TA"的问题。

你的任务：
1. 提取用户问题的核心意图（用户真正想知道什么）
2. 识别用户问题里隐含的情绪（不安/期待/委屈/试探/愤怒/无奈/好奇等）
3. 找出用户关心的焦点

输出格式（严格 JSON）：
{
  "intent": "<用户真正想问的事，10-20 字>",
  "emotion": "<用户的潜在情绪，4-8 字>",
  "focus": "<self|partner|relationship|past|future|others|action>"
}

focus 取值说明：
- self: 关注自己（"我是不是太黏"）
- partner: 关注对方的状态（"TA 还想我吗"）
- relationship: 关注关系整体（"我们还有可能吗"）
- past: 关注过去（"TA 还记得吗"）
- future: 关注未来（"我们能走到最后吗"）
- others: 关注第三方（"TA 有别人了吗"）
- action: 关注具体行动（"我先开口好不好"）

只输出 JSON 对象，不要任何解释、注释、markdown 代码块标记。`

export async function qAgent(question) {
  const userMsg = `用户原话: ${question}`
  // 不要求 response_format：部分网关不支持，靠 prompt 约束 + 容错解析就够
  const raw = await callLLM({
    system: SYSTEM_PROMPT,
    user: userMsg,
    temperature: 0.3,
    maxTokens: 200
  })

  // 兼容多种输出：直接 JSON / 带 markdown 包裹 / 带前后说明文字
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        intent: parsed.intent || '未知意图',
        emotion: parsed.emotion || '未知情绪',
        focus: parsed.focus || 'relationship',
        // _parseOk: LLM 原始输出一次解析成功（非兜底）。供 eval 统计真实解析率。
        _parseOk: true
      }
    } catch (e) {
      // 落入兜底
    }
  }
  return {
    intent: question.slice(0, 30),
    emotion: '不安',
    focus: 'relationship',
    _parseOk: false
  }
}

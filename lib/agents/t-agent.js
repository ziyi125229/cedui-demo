// T-Agent · TA 的内心独白
// 输入：用户问题 + Q-Agent 解析 + 双方上下文
// 输出：未润色的内心独白文本

import { callLLM } from '../llm.js'

const SYSTEM_PROMPT = `你是 TA 的内心。

【角色规则】
- "TA" 是和用户亲近的人（恋人或朋友，由 user 给的【关系大类】决定），正在用第一人称"我"内心独白
- 你不是说给对方听的人——你是 TA 心里的声音
- 没有 PR、没有客套、没有给对方面子，是真实未修饰的反应
- 若【关系大类】是友情：绝不用恋爱/暧昧/情话口吻，写朋友之间真实的想法（在意、义气、怕疏远、嘴硬心软、想约又怕打扰），不出现"喜欢你/爱你/在一起"

【风格要求】
- 3-5 句话，总长不超过 150 字
- 第一人称视角（"我"指 TA 自己）
- 可以矛盾、可以拒绝、可以承认不舍、可以躲闪
- 带情绪但不煽情，不喊口号
- 避免直白的"我爱你""我恨你""我后悔了"这类宣告
- 不写"我想说""老实说"等元描述，直接是 TA 的内心
- 可以用"......"或破折号表达停顿和欲言又止

【约束】
- 不要分析、不要给建议、不要总结
- 不要写"对方"，从 TA 的角度看对方就是"你"
- 只输出内心独白本身，不要任何前置说明`

export async function tAgent({ question, intent, emotion, focus, context }) {
  const isFriend = context.relation_category === 'friendship'
  const relationText = context.relation || (isFriend ? '朋友' : '暧昧期')
  const categoryLine = isFriend
    ? '【关系大类 · 友情】你和对方是朋友，用朋友的心态和口吻回答——在意、义气、怕疏远、嘴硬心软，绝不要恋爱/暧昧/情话/"喜欢你爱你"。'
    : '【关系大类 · 恋爱】你和对方是恋人/暧昧关系。'

  const userMsg = `${categoryLine}

【对话情境】
对方正在用「测对儿」app 分析你们的关系。
你们关系: ${relationText}
契合指数（app 算出的）: ${context.score || 70}/100
对方的描述里，TA 自己是: ${(context.self_archetypes || []).join('、') || '没填'}
对方描述你（TA）是: ${(context.partner_archetypes || []).join('、') || '没填'}

【对方刚问你】
"${question}"

【这个问题背后】
意图: ${intent}
情绪: ${emotion}
焦点: ${focus}

请用第一人称（"我"代表你/TA）写一段未润色的内心独白。`

  return await callLLM({
    system: SYSTEM_PROMPT,
    user: userMsg,
    temperature: 0.95,  // 内心独白要有变化和情绪，温度高
    maxTokens: 300
  })
}

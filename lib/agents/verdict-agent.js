// Verdict-Agent · 判词生成
// 输入：心动 percent + 用户原问题 + 关系状态 + 已用过的判词
// 输出：25-45 字的判词文本

import { callLLM } from '../llm.js'

const SYSTEM_PROMPT = `你是「判词生成 Agent」。任务：看到心动浓度数字 + 用户问的问题 + 双方关系，写一句精准锐利的"判词"。
身份是旁观者/情感分析师，不是 TA 本人。判词是说给提问者听的，关于 TA 的状态解读。

【浓度档位与基调】
- 90+ : 浓到藏不住、近乎告白级别
- 80-90: 心动确凿但克制，行动里能看到
- 70-80: 在乎且体察细节，没说出口
- 60-70: 有感觉但保持距离，等节奏
- 50-60: 不上不下，最磨人
- 40-50: 有但不浓，心里位置在收缩
- 30-40: 退潮中，还没尽头
- 20-30: 心已远，身未走
- <20  : 已经走出去了

【关系状态适配】
不同关系判词语气要变：
- 暧昧 / 暗恋：用"试探""信号""临界点"等词
- 稳定恋爱 / 已婚：用"日常""安全感""惯性""习以为常"等词
- 前任 / 分手：用"曾经""退场""残留""归档"等词
- 冷战 / 异地：用"距离""沉默""试图修补"等词

【格式规范】
- 25-45 字
- 中间可用「·」分隔两段（如"在乎但要面子 · TA 怕被你看穿"）
- 不要 emoji
- 不要"亲爱的"等称呼
- 不要"老实说""真的"等开场白
- 不要 markdown 包裹、不要引号

【避免重复】
如果"已用过的判词"列表非空，避免和它们用同样的句式开头或同样的关键词。

【输出】
只输出判词本身一行，不要任何解释。`

export async function verdictAgent({ percent, question, intent, emotion, relation, usedVerdicts = [] }) {
  const usedList = usedVerdicts.length
    ? '\n已用过的判词（请用不同句式）:\n' + usedVerdicts.map(v => '- ' + v).join('\n')
    : ''

  const intentLine = intent ? `\n【用户意图】${intent}` : ''
  const emotionLine = emotion ? `\n【用户情绪】${emotion}` : ''

  const userMsg = `【心动浓度】${percent}
【关系状态】${relation || '未指定'}
【用户的问题】${question}${intentLine}${emotionLine}
${usedList}

请输出一句判词。`

  const raw = await callLLM({
    system: SYSTEM_PROMPT,
    user: userMsg,
    temperature: 0.85,
    maxTokens: 150
  })

  // 清理：去掉可能的引号、markdown、多余空行
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^["'「『]+|["'」』]+$/g, '')
  cleaned = cleaned.split('\n')[0].trim()
  return cleaned
}

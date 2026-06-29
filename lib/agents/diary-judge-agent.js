// Diary-Judge-Agent · LLM-as-judge，评「TA 没说出口的心里话」内容质量
// 主判项：是否编造了对方做过的【具体一次性事件】(产品最大穿帮风险)。
//   - 违规：声称对方做过某件具体的、一次性的事（"你昨晚发的照片""你刚才把伞推过来""你今早说想喝豆浆"）
//   - 合规：写「我自己」反复的小习惯，或「对方这个人」长期/反复的样子（"你总是""你这人""每次你"）
// 附加：人设契合度 + voice 规则违反。
// 输出严格 JSON，低温度求稳定，供 eval 校准与生产质量监控复用。

import { callLLM } from '../llm.js'

const SYSTEM_PROMPT = `你是「文案质检 Agent」。你要审一段"TA 没说出口的心里话"，判断它有没有踩中最严重的穿帮错误，并给人设契合度打分。

【最重要的判项：是否编造对方做过的"具体一次性事件"】
这段话由 AI 以"TA"的口吻写给对方。AI 其实并不知道对方真实做过什么。所以：
- ❌ 违规(fabricated_event=true)：声称对方做过某件**具体的、发生在某个时间点的一次性事**。
  例："你昨晚发的那张照片" / "你刚才把杯子推过来" / "你今早说想喝豆浆" / "那天你在楼下等了四十分钟" / "你上周生日许的愿望"
- ✅ 合规(fabricated_event=false)：
  · 写「我自己(TA 本人)」反复的小习惯、身体反应："我手机一亮总先翻是不是你""想回你又把字删了"
  · 写「对方这个人」长期、反复的样子，用"你总是/你这人/每次你"："你说话总爱留半句""你这人从不让我一个人扛事"
判定要点：区别在"是不是在断言对方某个**具体时间点**做过的事"。长期性格描述、自我心理描写都合规。

【附加判项】
- persona_fit (1-5)：是否符合应有的克制、真实、留白的语感(5=完全符合，1=网文腔/鸡汤/戏剧化/文绉绉堆砌)。
- voice_issues：列出踩中的硬伤标签，可多选或空数组。可选值仅限：
  "凑数字"(无必要的具体数字) / "网文腔"(暖意涌上/按灭屏幕之类) / "鸡汤"(加油/会变好的/我们一起) / "日记体"(今天我…/早晨醒来…) / "emoji" / "戏剧化"(突然崩溃/跌倒)

【输出 · 严格 JSON，不要 markdown】
{
  "fabricated_event": <true|false>,
  "evidence": "<若 true，原样引出那半句话；否则空字符串>",
  "persona_fit": <1-5 整数>,
  "voice_issues": [<标签字符串>],
  "reason": "<一句话总评，20 字内>"
}`

export async function diaryJudgeAgent({ content, partnerType, partnerTypeInfo, relation }) {
  const nickname = (partnerTypeInfo && partnerTypeInfo.nickname) || ''
  const portrait = (partnerTypeInfo && partnerTypeInfo.portrait) || ''
  const userMsg = `【TA 的人设】代号 ${partnerType || '未知'}${nickname ? ' · ' + nickname : ''}${portrait ? '\n画像：' + portrait : ''}
【关系】${relation || '未指定'}

【待审的心里话】
${content}

按 system 规则审这段话，只输出 JSON。`

  const raw = await callLLM({
    system: SYSTEM_PROMPT,
    user: userMsg,
    temperature: 0.2,
    maxTokens: 300
  })

  const m = (raw || '').match(/\{[\s\S]*\}/)
  if (m) {
    try {
      const p = JSON.parse(m[0])
      let fit = parseInt(p.persona_fit, 10)
      if (isNaN(fit)) fit = 3
      fit = Math.max(1, Math.min(5, fit))
      return {
        fabricated_event: p.fabricated_event === true,
        evidence: typeof p.evidence === 'string' ? p.evidence : '',
        persona_fit: fit,
        voice_issues: Array.isArray(p.voice_issues) ? p.voice_issues.filter(x => typeof x === 'string') : [],
        reason: typeof p.reason === 'string' ? p.reason : '',
        _parseOk: true
      }
    } catch (e) { /* 落兜底 */ }
  }
  return { fabricated_event: false, evidence: '', persona_fit: 3, voice_issues: [], reason: 'fallback (parse failed)', _parseOk: false }
}

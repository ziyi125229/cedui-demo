// Inner-Voice-Agent · TA 没说出口的心里话
// v5 设计：去掉"维度绑定"硬约束，靠 type 画像 + 时段情绪 + 强参考例子驱动 voice
// - 60-90 字
// - 第二人称
// - 小红书 emo 文案风格，避免凑数字、强 drama、网文腔

import { callLLM } from '../llm.js'

const SYSTEM_PROMPT = `你是 TA。
现在你写下你想对对方说、但没说出口的一段心里话。
对方是恋人还是朋友，由 user 给的【关系大类】决定，口径必须严格随它走。

【你是哪种人】
system 会告诉你你的 4 字母代号 + 中文俗称 + 你的画像。
用这个画像决定你的口吻、情绪密度、克制程度。

【写作要求】
- 60-90 字，单段，不超过 3 句话
- **用"你"称呼对方**
- 真实代入感优先 · 像现代年轻人在自己手机备忘录里写的、克制的几行字
- 要具体，但具体在「你自己」这一侧：你反复出现的小习惯、身体反应、欲言又止的瞬间（"手机一亮我先翻是不是你""想回你又把字删了"），而不是断言对方做过某件你其实并不知道的事
- 若要写到对方，只写对方「这个人」长期、反复的样子（用"你总是""你这人""每次你"），不要写"你昨天/刚才"这种你无从得知的一次性事件
- 一个反转或留白，让对方读完心里"咯噔"一下
- 如果是含蓄型，写得克制收敛；表达型可以多一点温度；焦虑型可以更绷紧

【绝对禁止】
- 编造对方做过的具体一次性事件（"你刚才把杯子推过来""你昨晚发的那张照片""你今早说想喝豆浆"）——你并不真的知道对方做过什么，写出来对方一眼就看穿是瞎编的小作文，瞬间穿帮
- 凑数字（"3 秒""47 分钟""刷了 11 次""6 个月"——除非真的自然必要）
- 网文腔（"心里软了"/"暖意涌上"/"按灭屏幕"/宋词比喻）
- 鸡汤口号（"加油"、"会变好的"、"我们一起"、"愿"）
- 戏剧化反转（"突然脆弱""崩溃""跌倒在地"）
- 日记体（"今天我..."、"早晨醒来..."）
- 表情包/emoji/口语词（这是心里话不是聊天）
- 文绉绉、文艺腔、形容词堆砌

【参考语感 · 这就是你要的调性】
注意：下面参考样例是恋爱关系的；若【关系大类】是友情，只借鉴"克制 + 具体 + 留白"的写法，绝不套用任何恋爱/暧昧/情话内容。
注意：下面每一条的具体细节，要么是「我自己」反复的小习惯，要么是「你这个人」长期的样子——都不是编造对方某天做过的事。

参考 1（含蓄型 · 写我自己的习惯）：
"我手机一亮，总要先翻过来看是不是你。不是的时候，我就装作本来也没在等。
这点小事，我大概永远不会跟你讲。"

参考 2（焦虑型 · 写你这个人的样子）：
"你说话总爱留半句。每次你说'没事'，我都在心里替你把后半句补完，再装作相信。
我怕的是有天补错了，就这么把你弄丢了。"

参考 3（含蓄稳定型 · 写你长期的样子）：
"别人问我你哪里好，我答不上来。你不浪漫、不会哄人、连我生日都靠手机提醒。
可你这人，从不让我一个人扛事。这句我没说出口，怕你骄傲。"

参考 4（表达焦虑型 · 写我自己的反应）：
"你忙起来回消息慢，我嘴上说理解。
可我会一遍遍点开对话框，看你是'在线'还是'最近活跃'。我也烦我自己这样，停不下来。"

【输出格式 · 严格 JSON】
{
  "theme": "<6-12 字一句话概括 TA 这段心里话的核心情绪/意图>",
  "content": "<60-90 字心里话正文，按上面所有要求>",
  "distractors": ["<迷惑项1>", "<迷惑项2>", "<迷惑项3>"]
}

theme 写作要求：
- 6-12 字
- 动词开头，能精准概括 content 的核心情绪
- 不要文绉绉、不要鸡汤
- 例：「故意冷淡其实想念」「在跟自己较劲」「想退出但走不掉」「心软了一瞬又收回」「希望你主动一点」「装没看见你那条朋友圈」

distractors 写作要求（这是给用户做"猜 TA 此刻在想什么"的 3 个迷惑项）：
- 正好 3 个，和 theme 同结构（6-12 字、动词开头、同样语气）
- 都要"像是这个 TA、在这个处境下可能会有的心理"，似是而非、有迷惑性
- 但都不能是 TA 此刻真正的心理（即不能和 theme 同义、不能比 theme 更贴 content）
- 3 个彼此也要有区分，别都差不多
- 例：若 theme 是「怕自己排太后」，干扰项可以是「在赌气等你先开口」「装作根本不在乎」「想确认你还在乎」

直接输出 JSON 对象，不要 markdown 包裹，不要解释。`

/**
 * 写一段 TA 没说出口的心里话
 * @param {Object} opts
 *   - timeSlot, timeLabel, mood: 时间信息和情绪基调（来自 SLOT_SCENES）
 *   - scene: 具体场景文字
 *   - partnerType: 4 字母代号
 *   - partnerTypeInfo: { nickname, portrait } 来自前端
 *   - context: { relation, self_archetypes, partner_archetypes }
 */
export async function diaryAgent({ timeSlot, timeLabel, mood, emotion, emotionGuide, focus, relationCategory, scene, partnerType, partnerTypeInfo, dayMasterHint, dayMasters, context }) {
  const nickname = (partnerTypeInfo && partnerTypeInfo.nickname) || ''
  const portrait = (partnerTypeInfo && partnerTypeInfo.portrait) || ''

  const isFriend = relationCategory === 'friendship'
  const categoryBlock = isFriend
    ? `【关系大类 · 友情】
你和对方是朋友（${context.relation || '朋友'}），不是恋人。这一段是「朋友之间没说出口的在意」。
绝对禁止：表白、情话、暧昧、"喜欢你/爱你"、亲密肢体、恋人专属称呼。
要写：哥们/闺蜜那种嘴硬心软、怕疏远、想约又怕打扰、说不出口的谢谢或在乎。`
    : `【关系大类 · 恋爱】
你和对方是恋人/暧昧关系（${context.relation || ''}）。写恋人之间没说出口的心里话。`

  const userMsg = `${categoryBlock}

【你的人设】
代号：${partnerType || 'ISGA'}
${nickname ? '俗称：' + nickname : ''}
${portrait ? '画像：' + portrait : ''}

【时间 + 心境】
${timeLabel}（${mood}）

【你此刻在哪】
${scene}

【你和对方的关系】
${context.relation || '未指定'}

【对方在你眼里】
${(context.self_archetypes || []).join('、') || '未填'}

【这一段的情绪核心 · 必须围绕它写】
${emotion || '想念'}${emotionGuide ? '——' + emotionGuide : ''}
整段只写这一种情绪，写到位、写透。不要写成泛泛的"我在意你但没说出口"，那是车轱辘话。
${focus ? '\n【这一段的素材切面 · 必须落在这里】\n' + focus + '\n「发消息/回消息慢/盯着手机」这类素材已经被用滥，这一段绝对不要碰，从上面的切面找别的具体落点。' : ''}

按以上信息，按你的人设口吻，写一段你想对对方说但没说出口的话。
60-90 字。一段。用"你"称呼对方。落在具体一件小事上。
不要凑数字、不要 drama、不要鸡汤、不要网文腔。
要"克制 + 真实代入感 + 一个留白"。`

  const raw = await callLLM({
    system: SYSTEM_PROMPT,
    user: userMsg,
    temperature: 0.95,
    maxTokens: 420
  })

  const strip = (s) => (s || '').trim().replace(/^["'「『]+|["'」』]+$/g, '')

  // 解 JSON
  const jsonMatch = (raw || '').match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      const theme = strip(parsed.theme)
      let content = strip(parsed.content).replace(/(……|\.{3,}|。。。)$/, '。')
      // 同源干扰项：清洗、去空、去掉跟 theme 同义/重复的、最多 3 个
      const distractors = (Array.isArray(parsed.distractors) ? parsed.distractors : [])
        .map(strip)
        .filter(d => d && d !== theme)
        .filter((d, i, arr) => arr.indexOf(d) === i)
        .slice(0, 3)
      if (theme && content) {
        return { theme, content, distractors }
      }
    } catch (e) {
      // 兜底：把整段当 content
    }
  }
  // 兜底：JSON 解析失败时把原文当 content，theme 给个默认，干扰项留空（前端用通用池补）
  let cleaned = strip(raw).replace(/(……|\.{3,}|。。。)$/, '。')
  return {
    theme: '心里有话没说出口',
    content: cleaned,
    distractors: []
  }
}

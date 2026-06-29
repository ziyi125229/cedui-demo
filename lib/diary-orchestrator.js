// Inner-Voice Orchestrator · TA 没说出口的 3 段心里话
//
// v5 改造：去掉"每段绑维度"硬约束
// - 3 段都基于 TA 的整体 type 画像
// - 时段差异通过 mood / scene 体现
// - 整体 voice 统一一致

import { diaryAgent } from './agents/diary-agent.js'
import { diaryDiagnosisAgent } from './agents/diary-diagnosis-agent.js'
import { SLOT_SCENES } from './data/dimensions.js'

const DEBUG = process.env.DEBUG_AGENTS === 'true'
const log = (label, payload) => {
  if (!DEBUG) return
  console.log('\n────────────────────────────────────')
  console.log(`[${label}]`)
  console.log(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2))
}

const FALLBACK_TYPE = 'ISGA'

export const DIARY_VOICES = ['tsundere', 'clingy', 'tender', 'longing']
const MOMENTS_TIMELINE = ['morning', 'afternoon', 'night']

export async function diaryPipeline(context = {}, options = {}) {
  const t0 = Date.now()
  log('Diary input', context)

  const partnerType = context.partner_type || FALLBACK_TYPE
  const partnerTypeInfo = context.partner_type_info || {}
  // 关系大类：友情 / 恋爱（默认恋爱）。决定每段的情绪锚点 + 心里话口径
  const category = context.relation_category === 'friendship' ? 'friendship' : 'romance'

  // Steering options（默认 undefined → 行为与历史完全一致）
  const primaryVoice = DIARY_VOICES.includes(options.voice) ? options.voice : null
  const useMoments = options.moments === true
  log('Partner type', { partnerType, partnerTypeInfo, category, primaryVoice, useMoments })

// 日主提示：从已传入的 bazi 中取双方日干，拼一句轻量提示供 voice 调味
  const selfDayGan = (context.self && context.self.day && context.self.day.gan) || ''
  const partnerDayGan = (context.partner && context.partner.day && context.partner.day.gan) || ''
  const dayMasterHint = (selfDayGan && partnerDayGan)
    ? `日主提示：我属${partnerDayGan}，TA像${selfDayGan}`
    : ''

  // 3 段并行 · 每段随机一个场景
  const diaryPromises = SLOT_SCENES.map((slot, idx) => {
    const scene = slot.scenePrompts[Math.floor(Math.random() * slot.scenePrompts.length)]
    const track = (slot.tracks && slot.tracks[category]) || (slot.tracks && slot.tracks.romance) || {}
    // bias bucket sampling：voice 给定时，至少 idx===0 这一段被强制采用该 slice
    const forcedVoice = primaryVoice && idx === 0 ? primaryVoice : null
    // moments=true：把 3 段按时间轴分给 morning / afternoon / night
    const timeOfDay = useMoments ? (MOMENTS_TIMELINE[idx] || null) : null
return diaryAgent({
      timeSlot: slot.id,
      timeLabel: slot.label,
      mood: slot.mood,
      emotion: track.emotion,
      emotionGuide: track.emotionGuide,
      focus: track.focus,
      relationCategory: category,
      scene,
      partnerType,
      partnerTypeInfo,
      primaryVoice: forcedVoice,
      timeOfDay,
      dayMasterHint,
      dayMasters: { self: selfDayGan, partner: partnerDayGan },
      context
    }).then(({ theme, content, distractors, slice }) => ({
      timeSlot: slot.id,
      timeLabel: slot.label,
      timeStr: slot.timeStr,
      mood: slot.mood,
      scene,
      theme,        // ⭐ 6-12 字 真实主题，给前端做 4 选 1 用
      distractors,  // ⭐ 同源同处境的 3 个迷惑项（前端优先用，不足用通用池补）
      content,
      slice: slice || forcedVoice || null,
      timeOfDay
    }))
  })

  const diaries = await Promise.all(diaryPromises)
  const t1 = Date.now()
  log('All 3 inner-voice written', diaries)

  // 综合诊断
  const diagnosis = await diaryDiagnosisAgent({
    diaries,
    relation: context.relation
  })
  const t2 = Date.now()
  log('Diagnosis', diagnosis)

  const out = {
    diaries,
    diagnosis,
    partner_type: partnerType,
    trace: {
      timing: {
        parallel_diaries_ms: t1 - t0,
        diagnosis_ms: t2 - t1,
        total_ms: t2 - t0
      }
    }
  }

  if (useMoments) {
    out.diaryEntries = diaries.map((d, i) => ({
      timeOfDay: MOMENTS_TIMELINE[i] || d.timeOfDay || null,
      text: d.content,
      mood: d.mood,
      slice: d.slice || null
    }))
  }
if (primaryVoice) out.voice = primaryVoice

  return out
}

// 极速测：单段心里话 + 一句话评语 · 只跑一次 diaryAgent
export async function quickDiaryPipeline(context = {}) {
  const t0 = Date.now()
  log('Quick diary input', context)

const nameSelf = String(context.nameSelf || context.selfName || '').slice(0, 30)
  const namePartner = String(context.namePartner || context.partnerName || '').slice(0, 30)
  const relation = String(context.relation || '朋友').slice(0, 20)
  const category = context.relation_category === 'friendship' ? 'friendship' : 'romance'
  const partnerType = context.partner_type || FALLBACK_TYPE
  const partnerTypeInfo = context.partner_type_info || {}

  const slot = SLOT_SCENES[0]
  const scene = slot.scenePrompts[Math.floor(Math.random() * slot.scenePrompts.length)]
  const track = (slot.tracks && slot.tracks[category]) || (slot.tracks && slot.tracks.romance) || {}
  const primaryVoice = DIARY_VOICES[Math.floor(Math.random() * DIARY_VOICES.length)]

  const result = await diaryAgent({
    timeSlot: slot.id,
    timeLabel: slot.label,
    mood: slot.mood,
    emotion: track.emotion,
    emotionGuide: track.emotionGuide,
    focus: track.focus,
    relationCategory: category,
    scene,
    partnerType,
    partnerTypeInfo,
    primaryVoice,
    timeOfDay: null,
    mode: 'short',
    context: { ...context, nameSelf, namePartner, relation }
  })

  const fragment = {
    timeSlot: slot.id,
    timeLabel: slot.label,
    timeStr: slot.timeStr,
    mood: slot.mood,
    scene,
    theme: result.theme,
    content: result.content
  }

  const firstLine = String(result.content || '')
    .split(/[。！？\n]/)
    .map(s => s.trim())
    .find(s => s) || ''
  const verdict = firstLine
    ? `${namePartner || 'TA'}心里的${nameSelf || '你'}：${firstLine.slice(0, 40)}`
    : `${namePartner || 'TA'} 没说出口的那句已经写下`

  log('Quick diary done', { fragment, verdict })

return {
    fragment,
    verdict,
    nameSelf,
    namePartner,
    relation,
    partner_type: partnerType,
    voice: primaryVoice,
    trace: { timing: { total_ms: Date.now() - t0 } }
  }
}

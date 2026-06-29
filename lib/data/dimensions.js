// 4 字母关系型号代号 → 4 维度的人话描述
// 跟前端 utils/types.js 的 decodeDimensions 保持一致

const DIMENSION_LABELS = {
  // 维度 1 · 表达欲
  E: { id: 'expressive', label: '表达型', desc: '直接热烈表达，emoji 多，爱说情话' },
  I: { id: 'reserved',   label: '含蓄型', desc: '含蓄行动派，嘴硬手勤，不爱说"我爱你"' },

  // 维度 2 · 追逐节奏
  F: { id: 'fast',  label: '快火型', desc: '上头快，热度高，像烟花一样烈但短' },
  S: { id: 'slow',  label: '慢炖型', desc: '慢慢加温，越久越深，长期主义' },

  // 维度 3 · 心理空间
  O: { id: 'open',     label: '敞开型', desc: '坦诚敞开，什么都说，没有秘密' },
  G: { id: 'guarded',  label: '防御型', desc: '心事自己扛，试探多，不轻易袒露' },

  // 维度 4 · 关系焦虑
  C: { id: 'calm',    label: '安全型', desc: '安全感足，信任伴侣，不查岗给空间' },
  A: { id: 'anxious', label: '焦虑型', desc: '容易胡思乱想，需要不断确认，会查岗' }
}

// 4 字母代号 → 4 维度详情
export function decodeDimensions(code) {
  if (!code || typeof code !== 'string' || code.length !== 4) {
    return null
  }
  const [d1, d2, d3, d4] = code.split('')
  return {
    expressive: DIMENSION_LABELS[d1] || DIMENSION_LABELS.I,
    pace:       DIMENSION_LABELS[d2] || DIMENSION_LABELS.S,
    space:      DIMENSION_LABELS[d3] || DIMENSION_LABELS.G,
    anxiety:    DIMENSION_LABELS[d4] || DIMENSION_LABELS.A
  }
}

// 给 diary-agent 用：拿 4 维度中的某一个，作为该段日记的核心人格切片
export function getDimensionForSlot(code, slotIndex) {
  const dims = decodeDimensions(code)
  if (!dims) return null
  const order = ['expressive', 'pace', 'space', 'anxiety']
  const key = order[slotIndex]
  return dims[key]
}

// 3 段心里话的时段（清晨/午后/凌晨），各对应一种 TA 心理状态
export const SLOT_SCENES = [
  {
    id: 'morning',
    label: '清晨',
    timeStr: '07:23',
    mood: '一天开始前最诚实的一刻 · 防御还没立起来',
    tracks: {
      romance: {
        emotion: '想念',
        emotionGuide: '醒来第一个念头是对方，单纯的惦记和想见，不带焦虑、不带试探',
        focus: '聚焦「日常里习惯了对方的存在」——想听到声音、想见面、习惯被打断的早晨忽然空了一块。落在身体感受和生活细节上，不要写发消息/回消息'
      },
      friendship: {
        emotion: '惦记',
        emotionGuide: '醒来想起这个朋友，想约 ta、想起一起干过的事，单纯的惦记，绝不暧昧、不肉麻',
        focus: '聚焦「习惯了有这个人一起」——想拉 ta 一起、想分享某件事、少了 ta 的时刻有点空。落在朋友间的日常默契上，不要写发消息/回消息'
      }
    },
    scenePrompts: [
      '刚睡醒摸到手机的那两分钟',
      '通勤地铁上戴着耳机',
      '排队买早餐的时候',
      '坐到工位上但还没开始干活'
    ]
  },
  {
    id: 'afternoon',
    label: '午后',
    timeStr: '14:32',
    mood: '工作间隙的走神 · 思绪被某件小事勾到',
    tracks: {
      romance: {
        emotion: '患得患失',
        emotionGuide: '被一件小事勾起不安——吃醋、怀疑自己在对方心里的位置、怕被冷落，一边否认一边在意',
        focus: '聚焦「我在你心里到底排第几」——你对谁都温和让我拿不准、怕自己只是顺位、怕被比下去。落在内心的比较和不安上，不要写发消息/回消息'
      },
      friendship: {
        emotion: '怕疏远',
        emotionGuide: '怕渐行渐远、怕被 ta 的新朋友圈取代、或在意 ta 却拉不下脸说；嘴上不说、心里在乎',
        focus: '聚焦「你们的距离在变」——怕生分成点赞之交、怕总是我主动、怕 ta 有了新的圈子。落在友情的距离感上，不要写发消息/回消息'
      }
    },
    scenePrompts: [
      '午休发呆刷手机',
      '同事跟你聊到一半你走神了',
      '一个人在咖啡店',
      '会议开到一半瞄了下手机'
    ]
  },
  {
    id: 'late_night',
    label: '凌晨',
    timeStr: '01:48',
    mood: '夜深 · 白天压着的话开始翻上来',
    tracks: {
      romance: {
        emotion: '渴望靠近',
        emotionGuide: '夜里卸下伪装，说出白天最想要却不敢要的——想更近一步、想被在乎、想确定关系，带着克制的渴望',
        focus: '聚焦「想把关系往前推一步」——想要一个确定的说法、想更近、想被选择和承诺。落在对未来和靠近的渴望上，不要写发消息/回消息'
      },
      friendship: {
        emotion: '想交心又怕矫情',
        emotionGuide: '夜里想说一句平时说不出口的在乎/感谢/挽留，但怕太肉麻、怕黏人、怕越界，话到嘴边又咽回去',
        focus: '聚焦「想更交心一步」——想郑重说句谢谢/对不起/别走散，想让 ta 知道在自己心里的分量，但白天开不了口。落在那句没说出口的郑重上，不要写发消息/回消息'
      }
    },
    scenePrompts: [
      '失眠看着天花板',
      '洗漱完躺床上没关灯',
      '刷完剧但没睡意',
      '醉了一点点 · 还能想事'
    ]
  }
]

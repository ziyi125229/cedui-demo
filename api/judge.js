// Vercel serverless · LLM-as-judge 审一段心里话内容质量
import { diaryJudgeAgent } from '../lib/agents/diary-judge-agent.js'

const hits = new Map()
function limited(ip){
  const now = Date.now(), w = 60000, max = 40
  const e = hits.get(ip) || { n: 0, ts: now }
  if (now - e.ts > w) { e.n = 0; e.ts = now }
  e.n++; hits.set(ip, e)
  return e.n > max
}

export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'anon'
  if (limited(ip)) return res.status(429).json({ ok: false, error: '请求太频繁,稍后再试' })
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    if (!body.content) return res.status(400).json({ ok: false, error: 'missing content' })
    const verdict = await diaryJudgeAgent({
      content: String(body.content).slice(0, 600),
      partnerType: body.partner_type,
      partnerTypeInfo: body.partner_type_info,
      relation: body.relation
    })
    return res.status(200).json({ ok: true, verdict })
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e && e.message) || 'judge failed' })
  }
}

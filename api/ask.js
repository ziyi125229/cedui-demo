// Vercel serverless · 问 TA 一句(Q → T → P 串行 pipeline,以 TA 口吻回话)
import { askPartnerPipeline } from '../lib/orchestrator.js'

const hits = new Map()
function limited(ip){
  const now = Date.now(), w = 60000, max = 30
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
    if (!body.question) return res.status(400).json({ ok: false, error: 'missing question' })
    const result = await askPartnerPipeline(String(body.question).slice(0, 200), body.context || {}, [])
    return res.status(200).json({ ok: true, answer: result.answer })
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e && e.message) || 'pipeline failed' })
  }
}

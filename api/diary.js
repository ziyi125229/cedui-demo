// Vercel serverless · TA 没说出口的 3 段心里话(Diary×3 并行 → Diagnosis)
import { diaryPipeline } from '../lib/diary-orchestrator.js'

const hits = new Map() // 简易限流:每 IP 每分钟 20 次(冷启动会重置,够防刷)
function limited(ip){
  const now = Date.now(), w = 60000, max = 20
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
    const result = await diaryPipeline(body.context || {}, {})
    return res.status(200).json({ ok: true, ...result })
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e && e.message) || 'pipeline failed' })
  }
}

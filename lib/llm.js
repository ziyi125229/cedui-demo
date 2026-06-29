// LLM 客户端 · OpenAI 兼容协议（适配 New API 网关 / DeepSeek / OpenAI 等）
// 通过 env 变量切换不同 provider，代码逻辑一份不变

const DEFAULT_BASE_URL = 'https://sz.uyilink.com'

let lastLLMSuccessTs = null
let lastLLMErrorTs = null
let lastLLMErrorMsg = null

export function getLLMHealth() {
  return { lastLLMSuccessTs, lastLLMErrorTs, lastLLMErrorMsg }
}

/**
 * 调用 LLM chat completion
 * @param {Object} opts
 * @param {string} opts.system - system prompt
 * @param {string} opts.user - user message
 * @param {string} [opts.model] - 模型名（覆盖 env 默认）
 * @param {number} [opts.temperature=0.8] - 温度
 * @param {number} [opts.maxTokens=400] - 最大输出 token
 * @param {Object} [opts.responseFormat] - 比如 { type: 'json_object' }
 * @returns {Promise<string>} 模型回答的字符串
 */
export async function callLLM({
  system,
  user,
  model = process.env.LLM_MODEL,
  temperature = 0.8,
  maxTokens = 400,
  responseFormat
}) {
  const apiKey = process.env.LLM_API_KEY
  const baseUrl = (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
  if (!apiKey) {
    lastLLMErrorTs = Date.now()
    lastLLMErrorMsg = 'LLM_API_KEY not set in env'.slice(0, 200)
    throw new Error('LLM_API_KEY not set in env')
  }
  // 不再 fallback 到任何硬编码型号：codex 类模型不适合情感文案，静默降级会写出生硬内容。
  // 宁可显式报错，逼着 .env 配清楚 LLM_MODEL（如 deepseek-chat / gpt-4o）。
  if (!model) {
    lastLLMErrorTs = Date.now()
    lastLLMErrorMsg = 'LLM_MODEL not set in env'.slice(0, 200)
    throw new Error('LLM_MODEL not set in env — 请在 backend/.env 配置情感文案适用的模型')
  }

  const url = `${baseUrl}/v1/chat/completions`

  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature,
    max_tokens: maxTokens
  }
  if (responseFormat) body.response_format = responseFormat

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errText = await res.text()
      const msg = `LLM API ${res.status}: ${errText}`
      lastLLMErrorTs = Date.now()
      lastLLMErrorMsg = String(msg).slice(0, 200)
      throw new Error(msg)
    }

    const data = await res.json()
    const out = data.choices?.[0]?.message?.content?.trim() || ''
    lastLLMSuccessTs = Date.now()
    return out
  } catch (e) {
    if (!lastLLMErrorTs || lastLLMErrorTs < (lastLLMSuccessTs || 0)) {
      lastLLMErrorTs = Date.now()
      lastLLMErrorMsg = String(e && e.message ? e.message : e).slice(0, 200)
    }
    throw e
  }
}
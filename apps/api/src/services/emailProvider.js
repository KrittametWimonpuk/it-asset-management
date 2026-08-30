import { createHash } from 'node:crypto'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

function boolEnv(value) {
  return String(value || '').toLowerCase() === 'true'
}

function hasHeaderInjection(value) {
  return /[\r\n]/.test(String(value || ''))
}

export function getEmailProviderState() {
  const provider = (process.env.EMAIL_PROVIDER || 'resend').trim().toLowerCase()
  const enabled = boolEnv(process.env.EMAIL_ENABLED)
  const configured = provider === 'resend'
    && Boolean(process.env.RESEND_API_KEY?.trim())
    && Boolean(process.env.EMAIL_FROM?.trim())
  return { provider, enabled, configured, available: enabled && configured }
}

export async function sendEmail({ to, subject, html, text, idempotencyKey }) {
  const state = getEmailProviderState()
  if (!state.available) throw new Error(state.enabled ? 'EMAIL_PROVIDER_NOT_CONFIGURED' : 'EMAIL_DISABLED')
  if (state.provider !== 'resend') throw new Error('EMAIL_PROVIDER_UNSUPPORTED')
  if ([to, subject, process.env.EMAIL_FROM, process.env.EMAIL_REPLY_TO].filter(Boolean).some(hasHeaderInjection)) {
    throw new Error('EMAIL_HEADER_INVALID')
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `it-asset-${createHash('sha256').update(String(idempotencyKey)).digest('hex').slice(0, 32)}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM.trim(),
      to: [to],
      subject: String(subject).slice(0, 200),
      html,
      text,
      ...(process.env.EMAIL_REPLY_TO?.trim() ? { reply_to: process.env.EMAIL_REPLY_TO.trim() } : {}),
    }),
    signal: AbortSignal.timeout(Number(process.env.EMAIL_TIMEOUT_MS) || 10000),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(`EMAIL_PROVIDER_${response.status}`)
    error.providerStatus = response.status
    throw error
  }
  return { provider: 'resend', id: result.id || null }
}

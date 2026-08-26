// ---------------------------------------------------------------------------
// CORS configuration
//
// CORS_ORIGIN is a comma-separated allowlist of exact origins. When
// CORS_ALLOW_PAGES_PREVIEWS=true, HTTPS subdomains of an allowlisted Cloudflare
// Pages production hostname are also accepted. The server always reflects the
// verified request origin; it never returns a wildcard with credentials.
// ---------------------------------------------------------------------------

function normalizeOrigin(value) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function isCloudflarePagesPreview(origin, allowedOrigins) {
  let candidate
  try {
    candidate = new URL(origin)
  } catch {
    return false
  }

  if (candidate.protocol !== 'https:') return false

  return allowedOrigins.some((allowedOrigin) => {
    const allowed = new URL(allowedOrigin)
    return allowed.protocol === 'https:'
      && allowed.hostname.endsWith('.pages.dev')
      && candidate.hostname.endsWith(`.${allowed.hostname}`)
  })
}

export function isOriginAllowed(origin, allowedOrigins, allowPagesPreviews = false) {
  if (!origin) return true // curl, health checks, server-to-server requests

  const normalized = normalizeOrigin(origin)
  if (!normalized) return false
  if (allowedOrigins.includes(normalized)) return true

  return allowPagesPreviews && isCloudflarePagesPreview(normalized, allowedOrigins)
}

export function buildCorsOptions() {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((value) => normalizeOrigin(value.trim()))
    .filter(Boolean)
  const allowPagesPreviews = process.env.CORS_ALLOW_PAGES_PREVIEWS === 'true'

  if (allowedOrigins.length === 0 && nodeEnv !== 'production') {
    return { origin: true, credentials: true }
  }

  return {
    origin(origin, callback) {
      callback(null, isOriginAllowed(origin, allowedOrigins, allowPagesPreviews))
    },
    credentials: true,
    optionsSuccessStatus: 204,
  }
}

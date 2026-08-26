import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCorsOptions, isOriginAllowed } from './corsOptions.js'

const productionOrigin = 'https://it-asset-management.pages.dev'

test('CORS accepts the configured production origin and non-browser requests', () => {
  assert.equal(isOriginAllowed(productionOrigin, [productionOrigin]), true)
  assert.equal(isOriginAllowed(undefined, [productionOrigin]), true)
})

test('CORS only accepts Cloudflare Pages preview subdomains when enabled', () => {
  const preview = 'https://feature-login.it-asset-management.pages.dev'

  assert.equal(isOriginAllowed(preview, [productionOrigin]), false)
  assert.equal(isOriginAllowed(preview, [productionOrigin], true), true)
  assert.equal(isOriginAllowed('https://it-asset-management.pages.dev.evil.example', [productionOrigin], true), false)
  assert.equal(isOriginAllowed('http://preview.it-asset-management.pages.dev', [productionOrigin], true), false)
})

test('CORS enables secure previews by default for an allowlisted Pages project', async () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalCorsOrigin = process.env.CORS_ORIGIN
  const originalPreviewSetting = process.env.CORS_ALLOW_PAGES_PREVIEWS
  process.env.NODE_ENV = 'production'
  process.env.CORS_ORIGIN = productionOrigin
  delete process.env.CORS_ALLOW_PAGES_PREVIEWS

  try {
    const options = buildCorsOptions()
    const resolveOrigin = (origin) => new Promise((resolve, reject) => {
      options.origin(origin, (error, result) => error ? reject(error) : resolve(result))
    })

    assert.equal(await resolveOrigin('https://preview-123.it-asset-management.pages.dev'), true)
    assert.equal(await resolveOrigin('https://preview-123.other-project.pages.dev'), false)
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (originalCorsOrigin === undefined) delete process.env.CORS_ORIGIN
    else process.env.CORS_ORIGIN = originalCorsOrigin
    if (originalPreviewSetting === undefined) delete process.env.CORS_ALLOW_PAGES_PREVIEWS
    else process.env.CORS_ALLOW_PAGES_PREVIEWS = originalPreviewSetting
  }
})

test('CORS preview auto-detection can be disabled explicitly', async () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalCorsOrigin = process.env.CORS_ORIGIN
  const originalPreviewSetting = process.env.CORS_ALLOW_PAGES_PREVIEWS
  process.env.NODE_ENV = 'production'
  process.env.CORS_ORIGIN = productionOrigin
  process.env.CORS_ALLOW_PAGES_PREVIEWS = 'false'

  try {
    const options = buildCorsOptions()
    const allowed = await new Promise((resolve, reject) => {
      options.origin('https://preview-123.it-asset-management.pages.dev', (error, result) => (
        error ? reject(error) : resolve(result)
      ))
    })
    assert.equal(allowed, false)
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (originalCorsOrigin === undefined) delete process.env.CORS_ORIGIN
    else process.env.CORS_ORIGIN = originalCorsOrigin
    if (originalPreviewSetting === undefined) delete process.env.CORS_ALLOW_PAGES_PREVIEWS
    else process.env.CORS_ALLOW_PAGES_PREVIEWS = originalPreviewSetting
  }
})

test('production CORS fails closed without an allowlist', async () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalCorsOrigin = process.env.CORS_ORIGIN
  const originalPreviewSetting = process.env.CORS_ALLOW_PAGES_PREVIEWS
  process.env.NODE_ENV = 'production'
  delete process.env.CORS_ORIGIN
  delete process.env.CORS_ALLOW_PAGES_PREVIEWS

  try {
    const options = buildCorsOptions()
    const allowed = await new Promise((resolve, reject) => {
      options.origin(productionOrigin, (error, result) => error ? reject(error) : resolve(result))
    })
    assert.equal(allowed, false)
    assert.equal(options.credentials, true)
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (originalCorsOrigin === undefined) delete process.env.CORS_ORIGIN
    else process.env.CORS_ORIGIN = originalCorsOrigin
    if (originalPreviewSetting === undefined) delete process.env.CORS_ALLOW_PAGES_PREVIEWS
    else process.env.CORS_ALLOW_PAGES_PREVIEWS = originalPreviewSetting
  }
})

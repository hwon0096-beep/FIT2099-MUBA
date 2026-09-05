import type { ErrorRequestHandler, RequestHandler } from 'express'

// Public prototype access only; production authentication/subscriptions are out of scope.
export const loginHandler: RequestHandler = (request, response) => {
  const password = request.body?.password
  if (typeof password !== 'string') {
    response.status(400).json({ error: 'Malformed login request' })
    return
  }
  const premiumPassword = process.env.PREMIUM_PASSWORD || 'NUTSCOPE2026'
  if (password !== premiumPassword) {
    response.status(401).json({ error: 'Invalid premium password' })
    return
  }
  response.status(200).json({ tier: 'premium' })
}

// Also catches express.json() failures, before Express can return an HTML error.
export const loginErrorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) { next(error); return }
  const status = typeof error?.status === 'number' && Number.isInteger(error.status)
    && error.status >= 400 && error.status < 500 ? error.status : 500
  // Never log the parser's error.body, which can contain the submitted password.
  console.error('[Premium Login] Request failed', { status, type: error?.type, name: error?.name })
  response.status(status).json({
    error: status === 413 ? 'Login request is too large'
      : status < 500 ? 'Malformed login request' : 'Premium access is temporarily unavailable',
  })
}

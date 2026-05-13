const isDev = process.env.NODE_ENV === 'development'

export default defineEventHandler((event) => {
  const connectSrc = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    // Dev only: local Supabase + Vite HMR websockets. CSP 'self' doesn't grant
    // ws://, so the HMR origins have to be listed explicitly here.
    ...(isDev
      ? [
          'http://127.0.0.1:54321',
          'ws://127.0.0.1:54321',
          'ws://localhost:3000',
          'ws://localhost:5173',
        ]
      : []),
  ].join(' ')

  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    'https://*.supabase.co',
    ...(isDev ? ['http://127.0.0.1:54321'] : []),
  ].join(' ')

  setHeaders(event, {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      `img-src ${imgSrc}`,
      `media-src 'self' blob: https://*.supabase.co${isDev ? ' http://127.0.0.1:54321' : ''}`,
      "script-src 'self' 'unsafe-inline' https://client.crisp.chat",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'none'",
    ].join('; '),
  })
})

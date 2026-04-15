const isDev = process.env.NODE_ENV === "development"

export default defineEventHandler((event) => {
  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    ...(isDev ? ["http://127.0.0.1:54321", "ws://127.0.0.1:54321"] : []),
  ].join(" ")

  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    "https://*.supabase.co",
    ...(isDev ? ["http://127.0.0.1:54321"] : []),
  ].join(" ")

  setHeaders(event, {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      `img-src ${imgSrc}`,
      `media-src 'self' blob: https://*.supabase.co${isDev ? " http://127.0.0.1:54321" : ""}`,
      "script-src 'self' 'unsafe-inline' https://client.crisp.chat",
      "style-src 'self' 'unsafe-inline'",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'none'",
    ].join("; "),
  })
})

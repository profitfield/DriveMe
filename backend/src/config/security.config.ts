export const securityConfig = {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:3001',
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'Accept',
        'Origin',
        'X-Requested-With',
      ],
      credentials: true,
      maxAge: 3600,
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 минут
      max: 100, // лимит запросов с одного IP
    },
    csrf: {
      cookie: {
        key: 'XSRF-TOKEN',
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      },
    },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    }
  };
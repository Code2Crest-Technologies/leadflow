import { NextFunction, Request, Response } from 'express';

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
  );
  next();
}

export function createRateLimiter(options?: { windowMs?: number; max?: number }) {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || options?.windowMs || 15 * 60 * 1000);
  const max = Number(process.env.RATE_LIMIT_MAX || options?.max || 20);

  return (req: Request, res: Response, next: NextFunction) => {
    const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const key = `${forwardedFor || req.ip || req.socket.remoteAddress || 'unknown'}:${req.path}`;
    const now = Date.now();
    const current = rateLimitStore.get(key);

    if (!current || current.resetAt <= now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
      });
    }

    return next();
  };
}

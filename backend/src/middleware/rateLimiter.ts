import rateLimit from 'express-rate-limit';

/**
 * Rate limiter: prevents brute-force attacks on auth endpoints.
 *
 * Limit: 10 requests per 15 minutes per IP.
 * This is a good starting point:
 *   - Allows ~3 login attempts per minute (legitimate users can recover quickly)
 *   - Stops automated brute-force (≈1 attempt per second)
 *   - Hits after ~10 minutes of constant attacks
 *
 * In production, consider pairing with:
 *   - IP-based ban lists (CloudFlare, fail2ban)
 *   - Account lockout after N failed attempts
 *   - CAPTCHA
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip rate limiting on local development (127.0.0.1). This helps when testing login flows.
  skip: (req) => req.ip === '127.0.0.1',
});

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

/**
 * JWT payload structure. Must match what's encoded at login time.
 */
export interface JwtPayload {
  userId: string;
  email: string;
}

/**
 * Extend Express Request to include the authenticated user.
 * This is available after the authenticate middleware runs.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware: verify JWT from the httpOnly cookie.
 *
 * The JWT is never stored in localStorage (XSS vulnerability). Instead:
 *   1. Backend sets it in an httpOnly + Secure + SameSite=Strict cookie
 *   2. Browser automatically includes the cookie in all requests
 *   3. This middleware verifies the signature and attaches req.user
 *
 * If verification fails or the cookie is missing, returns 401 Unauthorized.
 * Requests without valid JWT are blocked before reaching route handlers.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies.authToken;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: no token' });
    return;
  }

  try {
    // Verify the token signature and decode the payload.
    // If the signature is invalid or the token has expired, jwt.verify() throws.
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    // Common causes: signature mismatch (tampered token), expired token, or malformed JWT.
    // Don't leak details about why verification failed — attackers can use it to craft better forgeries.
    res.status(401).json({ error: 'Unauthorized: invalid token' });
  }
}

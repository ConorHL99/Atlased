import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * Request body schemas for auth endpoints.
 * Each uses zod for validation, sanitization, and type coercion.
 */
const signupSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

type SignupRequest = z.infer<typeof signupSchema>;
type LoginRequest = z.infer<typeof loginSchema>;

/**
 * Set the JWT cookie on the response.
 *
 * httpOnly: prevents XSS attacks (JavaScript cannot read the cookie)
 * Secure: only sent over HTTPS (in production; Vite dev server is http)
 * SameSite=Strict: prevents CSRF attacks (cookie not sent on cross-site requests)
 */
function setAuthCookie(res: Response, token: string): void {
  res.cookie('authToken', token, {
    httpOnly: true,
    // In production: Secure: true. In dev (http://localhost:5173), set to false.
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

/**
 * Clear the auth cookie on logout.
 */
function clearAuthCookie(res: Response): void {
  res.clearCookie('authToken', { httpOnly: true, path: '/' });
}

/**
 * Generate a signed JWT.
 */
function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, config.JWT_SECRET, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expiresIn: config.JWT_EXPIRES_IN as any,
  });
}

/**
 * POST /api/auth/signup
 * Register a new user. Passwords are hashed with bcryptjs before storage.
 *
 * Security considerations:
 *   - Password is never logged or returned
 *   - Hash is computed server-side (never trust client-side "hashing")
 *   - Rate limited (authRateLimiter)
 *   - Input validated and coerced with zod
 */
router.post(
  '/signup',
  authRateLimiter,
  validate('body', signupSchema),
  async (
    req: Request<Record<string, never>, Record<string, never>, SignupRequest>,
    res: Response,
  ) => {
    const { email, password } = req.body;

    try {
      // Check if user already exists.
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        res.status(409).json({ error: 'User already exists' });
        return;
      }

      // Hash the password. bcryptjs.hash() is async and includes salt generation.
      // 12 rounds = ~250ms on modern hardware. Increases with hardware speed naturally.
      const passwordHash = await bcryptjs.hash(password, config.BCRYPT_ROUNDS);

      // Create the user in the database.
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
        },
        select: { id: true, email: true }, // Don't return the hash
      });

      // Generate and set JWT cookie.
      const token = generateToken(user.id, user.email);
      setAuthCookie(res, token);

      // Return the user (no password).
      res.status(201).json({ user });
    } catch (err) {
      console.error('[auth/signup]', err);
      res.status(500).json({ error: 'Signup failed' });
    }
  },
);

/**
 * POST /api/auth/login
 * Authenticate a user and issue a JWT.
 *
 * Security considerations:
 *   - Rate limited (authRateLimiter)
 *   - Passwords compared with bcryptjs.compare() (timing-safe)
 *   - No timing leak between "user not found" and "wrong password"
 *     (we compare against a dummy hash if user not found)
 */
router.post(
  '/login',
  authRateLimiter,
  validate('body', loginSchema),
  async (
    req: Request<Record<string, never>, Record<string, never>, LoginRequest>,
    res: Response,
  ) => {
    const { email, password } = req.body;

    try {
      const user = await prisma.user.findUnique({ where: { email } });

      // For timing attack resistance: if the user doesn't exist, we still call
      // bcryptjs.compare() with a dummy hash to keep the response time constant.
      if (!user) {
        // Use a dummy hash. The real one would take time to compute; this does too.
        await bcryptjs.compare(password, '$2a$12$K8h0gPSVJX8/8yOl4z/pu.S.SYlSKb04VRYxiYdRX4DMlr6xjMKI');
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Compare the provided password with the stored hash.
      const isPasswordValid = await bcryptjs.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Password is valid. Generate and set JWT cookie.
      const token = generateToken(user.id, user.email);
      setAuthCookie(res, token);

      res.json({ user: { id: user.id, email: user.email } });
    } catch (err) {
      console.error('[auth/login]', err);
      res.status(500).json({ error: 'Login failed' });
    }
  },
);

/**
 * POST /api/auth/logout
 * Clear the auth cookie.
 *
 * This is a POST (not GET) so the browser requires a CSRF token or same-site checks.
 * httpOnly cookies with SameSite=Strict protect against CSRF automatically.
 */
router.post('/logout', (req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out' });
});

/**
 * GET /api/auth/me
 * Return the currently authenticated user. Used by the frontend on app load
 * to check if the user is still logged in (JWT cookie is still valid).
 *
 * Requires: valid JWT in httpOnly cookie (checked by authenticate middleware)
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error('[auth/me]', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;

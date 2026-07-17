import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Middleware factory: validates request body against a Zod schema.
 *
 * Usage:
 *   const signupSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
 *   router.post('/signup', validate('body', signupSchema), handler);
 *
 * If validation fails, returns 400 Bad Request with field-level errors.
 * If validation passes, req.body is replaced with the validated (and coerced) data.
 */
export function validate(
  source: 'body' | 'params' | 'query',
  schema: ZodSchema,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Get the data to validate from the appropriate source.
    const data = req[source];

    // Parse and validate with Zod.
    const result = schema.safeParse(data);

    if (!result.success) {
      // Flatten the error structure so clients see { fieldName: ['error message'] }.
      const errors = result.error.flatten().fieldErrors;
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }

    // Replace the source data with the validated (and coerced) version.
    // This ensures type safety downstream: the handler receives exactly what the schema defines.
    req[source] = result.data;
    next();
  };
}

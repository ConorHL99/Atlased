import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { dataRateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * All routes in this file require authentication (user must be logged in).
 * The authenticate middleware attaches req.user from the JWT.
 */
router.use(authenticate);

/**
 * GET /api/user/cities/status
 * Fetch all cities the user has visited or favourited, with country info.
 */
router.get('/cities/status', dataRateLimiter, async (req: Request, res: Response) => {
  try {
    const statuses = await prisma.userCityStatus.findMany({
      where: {
        userId: req.user!.userId,
        OR: [{ isVisited: true }, { isFavorite: true }],
      },
      include: {
        city: {
          include: {
            country: { select: { isoCode: true, name: true } },
          },
        },
      },
    });

    const cities = statuses.map((s: any) => ({
      id: s.cityId,
      name: s.city.name,
      countryIsoCode: s.city.country.isoCode,
      countryName: s.city.country.name,
      isVisited: Boolean(s.isVisited),
      isFavorite: Boolean(s.isFavorite),
    }));

    res.json({ cities });
  } catch (err) {
    console.error('[user/cities/status]', err);
    res.status(500).json({ error: 'Failed to fetch city statuses' });
  }
});

/**
 * PUT /api/user/countries/:isoCode/status
 * Set or update the user's travel status for a country (VISITED or WANT_TO_VISIT).
 *
 * Body: { status: 'VISITED' | 'WANT_TO_VISIT' }
 * Returns: the updated UserCountryStatus
 */
const countryStatusSchema = z.object({
  status: z.enum(['VISITED', 'WANT_TO_VISIT']),
});

router.put(
  '/countries/:isoCode/status',
  validate('body', countryStatusSchema),
  async (
    req: Request<
      { isoCode: string },
      Record<string, never>,
      z.infer<typeof countryStatusSchema>
    >,
    res: Response,
  ) => {
    const { isoCode } = req.params;
    const { status } = req.body;

    try {
      // Find the country by ISO code.
      const country = await prisma.country.findUnique({
        where: { isoCode: isoCode.toUpperCase() },
      });

      if (!country) {
        res.status(404).json({ error: 'Country not found' });
        return;
      }

      // Upsert the user's country status. If it doesn't exist, create it.
      const userStatus = await prisma.userCountryStatus.upsert({
        where: {
          userId_countryId: {
            userId: req.user!.userId,
            countryId: country.id,
          },
        },
        update: { status },
        create: {
          userId: req.user!.userId,
          countryId: country.id,
          status,
          isFavorite: false,
        },
      });

      res.json({ userStatus });
    } catch (err) {
      console.error('[user/countries/:isoCode/status]', err);
      res.status(500).json({ error: 'Failed to update country status' });
    }
  },
);

/**
 * DELETE /api/user/countries/:isoCode/status
 * Remove the user's travel status for a country (but keep the favorite flag if set).
 *
 * This deletes the UserCountryStatus record or sets status to null.
 * Currently: deletes the entire record. In future, could set status to null to preserve favorites.
 */
router.delete('/countries/:isoCode/status', async (req: Request, res: Response) => {
  const { isoCode } = req.params;

  try {
    const country = await prisma.country.findUnique({
      where: { isoCode: isoCode.toUpperCase() },
    });

    if (!country) {
      res.status(404).json({ error: 'Country not found' });
      return;
    }

    await prisma.userCountryStatus.delete({
      where: {
        userId_countryId: {
          userId: req.user!.userId,
          countryId: country.id,
        },
      },
    });

    res.json({ message: 'Status removed' });
  } catch (err) {
    console.error('[user/countries/:isoCode/status DELETE]', err);
    res.status(500).json({ error: 'Failed to remove country status' });
  }
});

/**
 * PUT /api/user/countries/:isoCode/favorite
 * Toggle the user's favorite flag for a country (on → off, off → on).
 *
 * Returns: the updated UserCountryStatus
 */
router.put('/countries/:isoCode/favorite', async (req: Request, res: Response) => {
  const { isoCode } = req.params;

  try {
    const country = await prisma.country.findUnique({
      where: { isoCode: isoCode.toUpperCase() },
    });

    if (!country) {
      res.status(404).json({ error: 'Country not found' });
      return;
    }

    // First, fetch the current status to see if we need to toggle.
    const current = await prisma.userCountryStatus.findUnique({
      where: {
        userId_countryId: {
          userId: req.user!.userId,
          countryId: country.id,
        },
      },
    });

    // Toggle: if it exists, flip the isFavorite flag. If it doesn't exist, create with isFavorite=true.
    const updated = await prisma.userCountryStatus.upsert({
      where: {
        userId_countryId: {
          userId: req.user!.userId,
          countryId: country.id,
        },
      },
      update: {
        isFavorite: !current?.isFavorite,
      },
      create: {
        userId: req.user!.userId,
        countryId: country.id,
        isFavorite: true,
      },
    });

    res.json({ userStatus: updated });
  } catch (err) {
    console.error('[user/countries/:isoCode/favorite]', err);
    res.status(500).json({ error: 'Failed to update favorite' });
  }
});

/**
 * PUT /api/user/cities/:cityId/visited
 * Toggle the user's visited flag for a city.
 *
 * Returns: the updated UserCityStatus
 */
router.put('/cities/:cityId/visited', async (req: Request, res: Response) => {
  const { cityId } = req.params;

  try {
    // Verify the city exists.
    const city = await prisma.city.findUnique({ where: { id: cityId } });
    if (!city) {
      res.status(404).json({ error: 'City not found' });
      return;
    }

    // Fetch current status to toggle.
    const current = await prisma.userCityStatus.findUnique({
      where: {
        userId_cityId: {
          userId: req.user!.userId,
          cityId,
        },
      },
    });

    const updated = await prisma.userCityStatus.upsert({
      where: {
        userId_cityId: {
          userId: req.user!.userId,
          cityId,
        },
      },
      update: {
        isVisited: !current?.isVisited,
      },
      create: {
        userId: req.user!.userId,
        cityId,
        isVisited: true,
      },
    });

    res.json({ userStatus: updated });
  } catch (err) {
    console.error('[user/cities/:cityId/visited]', err);
    res.status(500).json({ error: 'Failed to update city visited status' });
  }
});

/**
 * PUT /api/user/cities/:cityId/favorite
 * Toggle the user's favorite flag for a city.
 *
 * Returns: the updated UserCityStatus
 */
router.put('/cities/:cityId/favorite', async (req: Request, res: Response) => {
  const { cityId } = req.params;

  try {
    const city = await prisma.city.findUnique({ where: { id: cityId } });
    if (!city) {
      res.status(404).json({ error: 'City not found' });
      return;
    }

    const current = await prisma.userCityStatus.findUnique({
      where: {
        userId_cityId: {
          userId: req.user!.userId,
          cityId,
        },
      },
    });

    const updated = await prisma.userCityStatus.upsert({
      where: {
        userId_cityId: {
          userId: req.user!.userId,
          cityId,
        },
      },
      update: {
        isFavorite: !current?.isFavorite,
      },
      create: {
        userId: req.user!.userId,
        cityId,
        isFavorite: true,
      },
    });

    res.json({ userStatus: updated });
  } catch (err) {
    console.error('[user/cities/:cityId/favorite]', err);
    res.status(500).json({ error: 'Failed to update city favorite' });
  }
});

export default router;

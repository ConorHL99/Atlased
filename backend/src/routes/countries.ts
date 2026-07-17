import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';

const router = Router();

/**
 * GET /api/countries
 * Fetch all countries with the current user's status overlay.
 *
 * Returns: array of countries with each containing:
 *   - isoCode, name, flag, image, capital, population, languages, GDP, lat/lng
 *   - userStatus: { status: 'VISITED'|'WANT_TO_VISIT'|null, isFavorite: boolean }
 *
 * No auth required for now (Phase 6 can gate this if needed).
 * In the future, add &filter=visited,favorites to reduce payload.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const countries = await prisma.country.findMany({
      orderBy: { name: 'asc' },
    });

    // If the user is authenticated, fetch their status for all countries at once.
    const userStatuses: Map<string, { status: string | null; isFavorite: boolean }> =
      new Map();

    if (req.user) {
      const statuses = await prisma.userCountryStatus.findMany({
        where: { userId: req.user.userId },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      statuses.forEach((s: any) => {
        userStatuses.set(s.countryId, {
          status: s.status,
          isFavorite: s.isFavorite,
        });
      });
    }

    // Build response with status overlay.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = countries.map((country: any) => {
      const userStatus = userStatuses.get(country.id) || {
        status: null,
        isFavorite: false,
      };
      return { ...country, userStatus };
    });

    res.json({ countries: response });
  } catch (err) {
    console.error('[countries/list]', err);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

/**
 * GET /api/countries/:isoCode
 * Fetch a single country with detailed metadata and the user's status.
 *
 * Requires: valid ISO 3166-1 alpha-2 code (e.g. "US", "FR")
 * Returns: country object with userStatus
 */
router.get('/:isoCode', authenticate, async (req: Request, res: Response) => {
  const { isoCode } = req.params;

  try {
    // Fetch the country by ISO code (case-insensitive query).
    const country = await prisma.country.findUnique({
      where: { isoCode: isoCode.toUpperCase() },
    });

    if (!country) {
      res.status(404).json({ error: 'Country not found' });
      return;
    }

    // Fetch user's status for this country.
    const userStatus = await prisma.userCountryStatus.findUnique({
      where: {
        userId_countryId: {
          userId: req.user!.userId,
          countryId: country.id,
        },
      },
    });

    res.json({
      country: {
        ...country,
        userStatus: userStatus || { status: null, isFavorite: false },
      },
    });
  } catch (err) {
    console.error('[countries/:isoCode]', err);
    res.status(500).json({ error: 'Failed to fetch country' });
  }
});

/**
 * GET /api/countries/:isoCode/cities
 * Fetch all cities in a country with the user's visited/favorite status for each.
 *
 * Returns: array of cities with each containing:
 *   - id, name, lat, lng
 *   - userStatus: { isVisited: boolean, isFavorite: boolean }
 */
router.get('/:isoCode/cities', authenticate, async (req: Request, res: Response) => {
  const { isoCode } = req.params;

  try {
    // Find the country by ISO code.
    const country = await prisma.country.findUnique({
      where: { isoCode: isoCode.toUpperCase() },
    });

    if (!country) {
      res.status(404).json({ error: 'Country not found' });
      return;
    }

    // Fetch all cities in this country.
    const cities = await prisma.city.findMany({
      where: { countryId: country.id },
      orderBy: { name: 'asc' },
    });

    // Fetch user's status for all these cities in one query.
    const userCityStatuses = await prisma.userCityStatus.findMany({
      where: {
        userId: req.user!.userId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cityId: { in: cities.map((c: any) => c.id) },
      },
    });

    // Build a map for quick lookup.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusMap = new Map(userCityStatuses.map((s: any) => [s.cityId, s]));

    // Return cities with user status overlay.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = cities.map((city: any) => ({
      ...city,
      userStatus: statusMap.get(city.id) || {
        isVisited: false,
        isFavorite: false,
      },
    }));

    res.json({ cities: response });
  } catch (err) {
    console.error('[countries/:isoCode/cities]', err);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

export default router;

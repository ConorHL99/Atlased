import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { dataRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const countryPhotoCache = new Map<string, string | null>();
const PHOTO_LOOKUP_TIMEOUT_MS = 1800;
const COUNTRY_PHOTO_CONCURRENCY = 12;

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const PHOTO_TITLE_ALIASES: Record<string, string[]> = {
  'united states': ['United States', 'USA'],
  'south korea': ['South Korea', 'Korea'],
  'north korea': ['North Korea', 'Korea'],
  'czech republic': ['Czech Republic', 'Czechia'],
  'ivory coast': ["Cote d'Ivoire", 'Ivory Coast'],
  'bosnia and herzegovina': ['Bosnia and Herzegovina'],
  'democratic republic of the congo': ['Democratic Republic of the Congo', 'DR Congo'],
  'congo': ['Republic of the Congo', 'Congo'],
  'russia': ['Russia', 'Russian Federation'],
  'laos': ['Laos', 'Lao PDR'],
  'taiwan': ['Taiwan'],
  'vatican city': ['Vatican City', 'Holy See'],
};

const looksLikeMapOrFlag = (url: string): boolean => {
  const lowered = url.toLowerCase();
  return (
    lowered.includes('topographic') ||
    lowered.includes('location_map') ||
    lowered.includes('location map') ||
    lowered.includes('relief') ||
    lowered.includes('flag_of') ||
    lowered.includes('flag of') ||
    lowered.includes('/flag') ||
    lowered.includes('coat_of_arms') ||
    lowered.includes('emblem') ||
    lowered.includes('in_its_region') ||
    lowered.includes('orthographic') ||
    (lowered.includes('map') && !lowered.includes('maputo')) ||
    lowered.endsWith('.svg')
  );
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error('timeout'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

const fetchWikiPhotoForTitle = async (title: string, flagUrl: string): Promise<string | null> => {
  const response = await withTimeout(
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: {
        'User-Agent': 'Atlased/1.0 (travel-map)',
        Accept: 'application/json',
      },
    }),
    PHOTO_LOOKUP_TIMEOUT_MS,
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
  };
  const photoUrl = data.originalimage?.source || data.thumbnail?.source;

  if (!photoUrl || looksLikeMapOrFlag(photoUrl) || photoUrl === flagUrl) {
    return null;
  }

  return photoUrl;
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  if (items.length === 0) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(limit, items.length));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const current = nextIndex;
      if (current >= items.length) {
        return;
      }
      nextIndex += 1;
      results[current] = await mapper(items[current], current);
    }
  };

  await Promise.all(Array.from({ length: safeLimit }, () => worker()));
  return results;
};

const getCountryPhotoUrl = async (
  countryName: string,
  isoCode: string,
  flagUrl: string,
  existingImageUrl?: string,
): Promise<string> => {
  const cacheKey = normalizeName(countryName);
  const cached = countryPhotoCache.get(cacheKey);
  if (typeof cached !== 'undefined') {
    return cached || '';
  }

  // 1) Try Wikipedia page summaries in parallel with timeout per request.
  const titleCandidates = [countryName, ...(PHOTO_TITLE_ALIASES[cacheKey] || [])];
  const uniqueCandidates = Array.from(new Set(titleCandidates.map((value) => value.trim()).filter(Boolean)));

  const attempts = uniqueCandidates.map(async (title) => {
    try {
      const found = await fetchWikiPhotoForTitle(title, flagUrl);
      if (!found) {
        throw new Error('No usable image');
      }
      return found;
    } catch (err) {
      return Promise.reject(err);
    }
  });

  try {
    const photoUrl = await Promise.any(attempts);
    countryPhotoCache.set(cacheKey, photoUrl);
    return photoUrl;
  } catch {
    // Fall through to fallback URL.
  }

  // 2) Fallback: stable seeded placeholder when remote sources fail/are blocked.
  const fallbackUrl = `https://picsum.photos/seed/${encodeURIComponent(isoCode.toUpperCase())}/800/400`;
  countryPhotoCache.set(cacheKey, fallbackUrl);
  return fallbackUrl;
};

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
router.get('/', authenticate, async (req: Request, res: Response) => {
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

    // Build response with status overlay and photo URLs without unbounded fan-out.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await mapWithConcurrency(countries, COUNTRY_PHOTO_CONCURRENCY, async (country: any) => {
      const userStatus = userStatuses.get(country.id) || {
        status: null,
        isFavorite: false,
      };
      const imageUrl = await getCountryPhotoUrl(
        country.name,
        country.isoCode,
        country.flagUrl,
        country.imageUrl,
      );
      return {
        ...country,
        imageUrl,
        userStatus: userStatus.status,
        isFavorite: userStatus.isFavorite,
      };
    });

    res.json({ countries: response });
  } catch (err) {
    console.error('[countries/list]', err);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

/**
 * GET /api/countries/search?q=term
 * Global search for country and city names.
 * Returns country matches and city matches mapped to their parent country.
 */
router.get('/search', dataRateLimiter, async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();

  if (!q) {
    res.json({ countries: [], cities: [] });
    return;
  }

  try {
    const countries = await prisma.country.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { isoCode: { contains: q.toUpperCase() } },
        ],
      },
      select: {
        isoCode: true,
        name: true,
        lat: true,
        lng: true,
      },
      orderBy: { name: 'asc' },
      take: 10,
    });

    const cityMatches = await prisma.city.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' },
      },
      include: {
        country: {
          select: {
            isoCode: true,
            name: true,
            lat: true,
            lng: true,
          },
        },
      },
      orderBy: { name: 'asc' },
      take: 15,
    });

    res.json({
      countries,
      cities: cityMatches.map((city: any) => ({
        name: city.name,
        lat: city.lat,
        lng: city.lng,
        countryIsoCode: city.country.isoCode,
        countryName: city.country.name,
        countryLat: city.country.lat,
        countryLng: city.country.lng,
      })),
    });
  } catch (err) {
    console.error('[countries/search]', err);
    res.status(500).json({ error: 'Failed to search countries and cities' });
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
        imageUrl: await getCountryPhotoUrl(
          country.name,
          country.isoCode,
          country.flagUrl,
          country.imageUrl,
        ),
        userStatus: userStatus?.status ?? null,
        isFavorite: userStatus?.isFavorite ?? false,
      },
    });
  } catch (err) {
    console.error('[countries/:isoCode]', err);
    res.status(500).json({ error: 'Failed to fetch country' });
  }
});

/**
 * GET /api/countries/:isoCode/cities
 * Fetch all cities in a country with the user's visited/want/favorite status for each.
 *
 * Returns: array of cities with each containing:
 *   - id, name, lat, lng
 *   - userStatus: { isVisited: boolean, isWantToVisit: boolean, isFavorite: boolean }
 */
router.get('/:isoCode/cities', authenticate, async (req: Request, res: Response) => {
  const { isoCode } = req.params;
  const query = String(req.query.q || '').trim();
  const parsedLimit = Number.parseInt(String(req.query.limit || ''), 10);
  const parsedOffset = Number.parseInt(String(req.query.offset || ''), 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 1000) : 150;
  const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

  try {
    // Find the country by ISO code.
    const country = await prisma.country.findUnique({
      where: { isoCode: isoCode.toUpperCase() },
    });

    if (!country) {
      res.status(404).json({ error: 'Country not found' });
      return;
    }

    const where = {
      countryId: country.id,
      ...(query ? { name: { contains: query, mode: 'insensitive' as const } } : {}),
    };

    // Fetch matching cities with server-side pagination for large datasets.
    const [total, cities] = await Promise.all([
      prisma.city.count({ where }),
      prisma.city.findMany({
        where,
        orderBy: [{ population: 'desc' }, { name: 'asc' }],
        skip: offset,
        take: limit,
      }),
    ]);

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
    const statusMap: Map<string, { isVisited: boolean; isWantToVisit: boolean; isFavorite: boolean }> = new Map(
      userCityStatuses.map((s: any) => [
        s.cityId,
        {
          isVisited: Boolean(s.isVisited),
          isWantToVisit: Boolean(s.isWantToVisit),
          isFavorite: Boolean(s.isFavorite),
        },
      ]),
    );

    // Return cities with user status overlay.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = cities.map((city: any) => ({
      ...city,
      userVisited: statusMap.get(city.id)?.isVisited ?? false,
      userWantToVisit: statusMap.get(city.id)?.isWantToVisit ?? false,
      userFavorite: statusMap.get(city.id)?.isFavorite ?? false,
    }));

    res.json({
      cities: response,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + response.length < total,
      },
    });
  } catch (err) {
    console.error('[countries/:isoCode/cities]', err);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

export default router;

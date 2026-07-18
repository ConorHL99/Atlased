import fs from 'fs';
import readline from 'readline';
import { prisma } from '../src/lib/prisma';

type BufferMap = Map<string, Array<{ countryId: string; name: string; lat: number; lng: number; population: number }>>;

const geonamesFile = process.env.GEONAMES_FILE;
const minPopulation = Number.parseInt(process.env.GEONAMES_MIN_POP || '500', 10);
const batchSize = Math.max(100, Number.parseInt(process.env.GEONAMES_BATCH_SIZE || '2000', 10));
const replaceExisting = (process.env.GEONAMES_REPLACE || 'true').toLowerCase() !== 'false';
const maxRows = Number.parseInt(process.env.GEONAMES_MAX_ROWS || '0', 10);

if (!geonamesFile) {
  console.error('Missing GEONAMES_FILE environment variable.');
  console.error('Example: GEONAMES_FILE=./data/cities500.txt npm run db:import:geonames');
  process.exit(1);
}

if (!fs.existsSync(geonamesFile)) {
  console.error(`GeoNames file not found: ${geonamesFile}`);
  process.exit(1);
}

const flushCountryBuffer = async (
  countryId: string,
  buffers: BufferMap,
): Promise<number> => {
  const rows = buffers.get(countryId);
  if (!rows || rows.length === 0) {
    return 0;
  }

  buffers.set(countryId, []);
  const result = await prisma.city.createMany({ data: rows, skipDuplicates: false });
  return result.count;
};

const main = async () => {
  console.log('[geonames] Starting import...');
  console.log(`[geonames] File: ${geonamesFile}`);
  console.log(`[geonames] Minimum population: ${minPopulation}`);
  console.log(`[geonames] Batch size: ${batchSize}`);
  console.log(`[geonames] Replace existing cities: ${replaceExisting}`);

  const countries = await prisma.country.findMany({
    select: { id: true, isoCode: true },
  });

  const countryByIso = new Map<string, string>();
  countries.forEach((country) => {
    countryByIso.set(country.isoCode.toUpperCase(), country.id);
  });

  if (replaceExisting) {
    const deleted = await prisma.city.deleteMany();
    console.log(`[geonames] Removed ${deleted.count} existing city rows`);
  }

  const buffers: BufferMap = new Map();
  countryByIso.forEach((countryId) => buffers.set(countryId, []));

  const input = fs.createReadStream(geonamesFile, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  let scanned = 0;
  let accepted = 0;
  let inserted = 0;

  for await (const line of rl) {
    scanned += 1;
    if (!line || line.startsWith('#')) {
      continue;
    }

    if (maxRows > 0 && scanned > maxRows) {
      break;
    }

    const parts = line.split('\t');
    if (parts.length < 15) {
      continue;
    }

    const name = parts[1]?.trim();
    const lat = Number.parseFloat(parts[4] || '');
    const lng = Number.parseFloat(parts[5] || '');
    const featureClass = parts[6];
    const countryCode = (parts[8] || '').toUpperCase();
    const population = Number.parseInt(parts[14] || '0', 10);

    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }

    if (featureClass !== 'P') {
      continue;
    }

    if (!countryCode || !countryByIso.has(countryCode)) {
      continue;
    }

    if (!Number.isFinite(population) || population < minPopulation) {
      continue;
    }

    const countryId = countryByIso.get(countryCode)!;
    const bucket = buffers.get(countryId)!;

    bucket.push({
      countryId,
      name,
      lat,
      lng,
      population,
    });
    accepted += 1;

    if (bucket.length >= batchSize) {
      inserted += await flushCountryBuffer(countryId, buffers);
    }

    if (scanned % 100000 === 0) {
      console.log(`[geonames] scanned=${scanned} accepted=${accepted} inserted=${inserted}`);
    }
  }

  for (const countryId of buffers.keys()) {
    inserted += await flushCountryBuffer(countryId, buffers);
  }

  console.log(`[geonames] Done. scanned=${scanned}, accepted=${accepted}, inserted=${inserted}`);
};

main()
  .catch((err) => {
    console.error('[geonames] Import failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

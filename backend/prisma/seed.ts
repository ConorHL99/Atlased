/**
 * Prisma seed — Atlased
 *
 * Reads country and city data from static JSON files (pre-fetched in Phase 3)
 * and upserts them into the database. Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

interface CountryData {
  isoCode: string;
  name: string;
  flagUrl: string;
  imageUrl: string;
  capital: string;
  population: number;
  languages: string[];
  gdpUsd: number | null;
  lat: number;
  lng: number;
}

interface CityEntry {
  name: string;
  lat: number;
  lng: number;
}

interface CityDataFile {
  countryIsoCode: string;
  cities: CityEntry[];
}

async function main() {
  const countriesPath = path.join(__dirname, 'data', 'countries.json');
  const citiesPath = path.join(__dirname, 'data', 'cities.json');

  if (!fs.existsSync(countriesPath) || !fs.existsSync(citiesPath)) {
    console.log('⚠️  Seed data files not found. Run the fetch script first:');
    console.log('   npx tsx scripts/fetchCountries.ts');
    console.log('Data files expected at:');
    console.log('  ', countriesPath);
    console.log('  ', citiesPath);
    return;
  }

  try {
    // Read country data
    const countriesRaw = fs.readFileSync(countriesPath, 'utf-8');
    const countries: CountryData[] = JSON.parse(countriesRaw);

    // Read city data
    const citiesRaw = fs.readFileSync(citiesPath, 'utf-8');
    const citiesData: CityDataFile[] = JSON.parse(citiesRaw);

    console.log(`Seeding ${countries.length} countries...`);

    // Upsert countries
    for (const country of countries) {
      await prisma.country.upsert({
        where: { isoCode: country.isoCode },
        update: {
          name: country.name,
          flagUrl: country.flagUrl,
          imageUrl: country.imageUrl,
          capital: country.capital,
          population: country.population,
          languages: country.languages,
          gdpUsd: country.gdpUsd,
          lat: country.lat,
          lng: country.lng,
        },
        create: {
          isoCode: country.isoCode,
          name: country.name,
          flagUrl: country.flagUrl,
          imageUrl: country.imageUrl,
          capital: country.capital,
          population: country.population,
          languages: country.languages,
          gdpUsd: country.gdpUsd,
          lat: country.lat,
          lng: country.lng,
        },
      });
    }

    console.log(`✅ Upserted ${countries.length} countries`);

    // Upsert cities
    let totalCities = 0;
    for (const countryEntry of citiesData) {
      // Find the country by ISO code
      const country = await prisma.country.findUnique({
        where: { isoCode: countryEntry.countryIsoCode },
      });

      if (!country) {
        console.warn(`⚠️  Country not found: ${countryEntry.countryIsoCode}`);
        continue;
      }

      // Upsert each city
      for (const city of countryEntry.cities) {
        // Check if city already exists (by name + country combo for idempotency)
        const existingCity = await prisma.city.findFirst({
          where: {
            countryId: country.id,
            name: city.name,
          },
        });

        if (existingCity) {
          // City exists, update lat/lng
          await prisma.city.update({
            where: { id: existingCity.id },
            data: {
              lat: city.lat,
              lng: city.lng,
            },
          });
        } else {
          // Create new city
          await prisma.city.create({
            data: {
              countryId: country.id,
              name: city.name,
              lat: city.lat,
              lng: city.lng,
            },
          });
        }
        totalCities++;
      }
    }

    console.log(`✅ Upserted ${totalCities} cities`);
    console.log('✅ Seed complete.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

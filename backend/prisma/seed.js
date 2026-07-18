/*
 * Production-safe Prisma seed script (plain Node.js).
 *
 * This avoids runtime dependency on tsx inside production containers.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const countriesPath = path.join(__dirname, 'data', 'countries.json');
  const citiesPath = path.join(__dirname, 'data', 'cities.json');

  if (!fs.existsSync(countriesPath) || !fs.existsSync(citiesPath)) {
    console.log('Seed data files not found.');
    console.log('Expected at:');
    console.log(' ', countriesPath);
    console.log(' ', citiesPath);
    return;
  }

  const countries = JSON.parse(fs.readFileSync(countriesPath, 'utf-8'));
  const citiesData = JSON.parse(fs.readFileSync(citiesPath, 'utf-8'));

  console.log(`Seeding ${countries.length} countries...`);

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
        currency: country.currency || '',
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
        currency: country.currency || '',
      },
    });
  }

  console.log(`Upserted ${countries.length} countries`);

  let totalCities = 0;
  for (const countryEntry of citiesData) {
    const country = await prisma.country.findUnique({
      where: { isoCode: countryEntry.countryIsoCode },
    });

    if (!country) {
      console.warn(`Country not found: ${countryEntry.countryIsoCode}`);
      continue;
    }

    for (const city of countryEntry.cities) {
      const existingCity = await prisma.city.findFirst({
        where: {
          countryId: country.id,
          name: city.name,
        },
      });

      if (existingCity) {
        await prisma.city.update({
          where: { id: existingCity.id },
          data: {
            lat: city.lat,
            lng: city.lng,
            population: Number(city.population || 0),
          },
        });
      } else {
        await prisma.city.create({
          data: {
            countryId: country.id,
            name: city.name,
            lat: city.lat,
            lng: city.lng,
            population: Number(city.population || 0),
          },
        });
      }

      totalCities += 1;
    }
  }

  console.log(`Upserted ${totalCities} cities`);
  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

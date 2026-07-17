/**
 * Fetch country reference data from restcountries.com API
 *
 * Runs once and caches the result in prisma/data/countries.json.
 * This file is committed to the repo — it's never fetched again at runtime.
 *
 * Usage: npx tsx scripts/fetchCountries.ts
 *
 * Fetches from: https://restcountries.com/v3.1/all
 * Requires internet access but only needs to run once during initial setup.
 */

import fs from 'fs';
import path from 'path';

interface RestCountriesRecord {
  cca2: string;
  name: { common: string };
  flags: { svg: string };
  capital?: string[];
  population: number;
  languages?: Record<string, string>;
  gdp?: Record<string, number>;
  latlng: [number, number];
  demonyms?: Record<string, { f: string; m: string }>;
  region?: string;
}

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

async function fetchCountries(): Promise<void> {
  console.log('Fetching country data from restcountries.com...');

  try {
    const response = await fetch('https://restcountries.com/v3.1/all');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const countries: RestCountriesRecord[] = await response.json();

    console.log(`Fetched ${countries.length} countries`);

    // Map to our schema
    const mapped: CountryData[] = countries
      .map((c) => {
        // Extract ISO code (2-letter, e.g., "US", "FR")
        const isoCode = c.cca2;
        const name = c.name.common;

        // Flag URL from the API (SVG)
        const flagUrl = c.flags?.svg || '';

        // Representative image: for now, use flag. In production, this could be a Wikimedia URL.
        // For demo, we'll construct a Wikimedia Commons URL based on country name.
        const imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${name}_-_Location_Map_%28relief%29.svg?width=640`;

        // Capital (first one if multiple)
        const capital = c.capital?.[0] || 'Unknown';

        // Population
        const population = c.population || 0;

        // Languages: extract language names
        const languages = c.languages ? Object.values(c.languages) : [];

        // GDP in USD: look for USD entry in the gdp object
        const gdpUsd = c.gdp?.usd || null;

        // Lat/Lng
        const [lat, lng] = c.latlng;

        return {
          isoCode,
          name,
          flagUrl,
          imageUrl,
          capital,
          population,
          languages,
          gdpUsd,
          lat,
          lng,
        };
      })
      .filter((c) => c.isoCode && c.name) // Remove any malformed entries
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort by name for readability

    // Ensure output directory exists
    const dataDir = path.join(__dirname, '..', 'prisma', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write to file
    const outputPath = path.join(dataDir, 'countries.json');
    fs.writeFileSync(outputPath, JSON.stringify(mapped, null, 2));

    console.log(`✅ Wrote ${mapped.length} countries to ${outputPath}`);
  } catch (error) {
    console.error('❌ Failed to fetch countries:');
    console.error(error);
    process.exit(1);
  }
}

fetchCountries();

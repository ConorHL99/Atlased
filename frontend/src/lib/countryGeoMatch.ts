/**
 * Shared country-to-GeoJSON polygon matching logic.
 * Used by both GlobeView and MapView to avoid duplication and ensure
 * consistent coverage across views.
 */

import worldGeoJsonData from 'geojson-world-map';

interface RawWorldFeature {
  type: 'Feature';
  properties: {
    name?: string;
    [key: string]: unknown;
  };
  geometry: GeoJSON.Geometry;
}

interface WorldFeatureCollection {
  type: 'FeatureCollection';
  features: RawWorldFeature[];
}

export interface MatchedPolygonFeature {
  type: 'Feature';
  properties: {
    isoCode: string;
    name: string;
  };
  geometry: GeoJSON.Geometry;
}

const worldGeoJson = worldGeoJsonData as WorldFeatureCollection;

/**
 * Normalize a country name for matching — only lowercase + strip diacritics.
 * Does NOT remove disambiguating words like "republic", "democratic" etc.
 */
const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'")
    .trim();

/**
 * Maps DB country names → GeoJSON feature names.
 * Key = normalized DB name, Values = normalized GeoJSON name candidates.
 */
const DB_TO_GEO_ALIASES: Record<string, string[]> = {
  // Americas
  'united states': ['united states of america'],
  'antigua and barbuda': ['antigua and barb.'],
  'saint kitts and nevis': ['st. kitts and nevis'],
  'saint vincent and the grenadines': ['st. vin. and gren.'],
  'dominican republic': ['dominican rep.'],

  // Europe
  'czechia': ['czech rep.', 'czech rep'],
  'czech republic': ['czech rep.', 'czech rep'],
  'bosnia and herzegovina': ['bosnia and herz.', 'bosnia and herz'],
  'north macedonia': ['macedonia'],
  'turkiye': ['turkey'],
  'vatican city': ['vatican'],

  // Africa
  "cote d'ivoire": ['cote d\'ivoire', "cote d'ivoire"],
  'ivory coast': ["cote d'ivoire"],
  'eswatini': ['swaziland'],
  'central african republic': ['central african rep.', 'central african rep'],
  'equatorial guinea': ['eq. guinea'],
  'dr congo': ['dem. rep. congo', 'dem rep congo'],
  'democratic republic of the congo': ['dem. rep. congo', 'dem rep congo'],
  'republic of the congo': ['congo'],
  'south sudan': ['s. sudan'],
  'cape verde': ['cabo verde'],

  // Asia
  'south korea': ['korea'],
  'north korea': ['dem. rep. korea', 'dem rep korea'],
  'myanmar': ['myanmar'],
  'laos': ['lao pdr'],
  'syria': ['syria'],
  'taiwan': ['taiwan'],
  'timor-leste': ['timor-leste', 'east timor'],

  // Oceania
  'solomon islands': ['solomon is.'],
  'marshall islands': ['marshall is.'],
  'micronesia': ['micronesia'],

  // Other
  'russia': ['russia'],
  'kosovo': ['kosovo'],
};

/**
 * Build the matched polygon feature collection once per set of countries.
 * Returns features with correct isoCode in properties for click handling.
 */
export function matchCountriesToGeoJson(
  countries: Array<{ isoCode: string; name: string }>,
): { features: MatchedPolygonFeature[]; unmatchedNames: string[] } {
  // Build lookup from normalized GeoJSON name → feature
  const geoByName = new Map<string, RawWorldFeature>();
  for (const feature of worldGeoJson.features) {
    const name = feature.properties?.name;
    if (name) {
      geoByName.set(normalize(name), feature);
    }
  }

  const matched: MatchedPolygonFeature[] = [];
  const unmatchedNames: string[] = [];

  for (const country of countries) {
    const dbNorm = normalize(country.name);

    // Try exact name first
    let feature = geoByName.get(dbNorm);

    // Try aliases
    if (!feature) {
      const aliases = DB_TO_GEO_ALIASES[dbNorm] || [];
      for (const alias of aliases) {
        feature = geoByName.get(normalize(alias));
        if (feature) break;
      }
    }

    if (!feature) {
      unmatchedNames.push(country.name);
      continue;
    }

    matched.push({
      type: 'Feature',
      properties: {
        isoCode: country.isoCode,
        name: country.name,
      },
      geometry: feature.geometry,
    });
  }

  return { features: matched, unmatchedNames: unmatchedNames.sort() };
}

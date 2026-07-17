/**
 * GlobeView — Interactive 3D globe with country markers
 */

import GlobeGL from 'react-globe.gl';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import worldGeoJsonData from 'geojson-world-map';
import { Country } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface MarkerPoint extends Country {
  markerColor: string;
}

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

interface GlobePolygonCountry {
  type: 'Feature';
  properties: {
    isoCode: string;
    name: string;
  };
  geometry: GeoJSON.Geometry;
}

const worldGeoJson = worldGeoJsonData as WorldFeatureCollection;

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(republic|democratic|federal|kingdom|state|states|of|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const NAME_ALIASES: Record<string, string[]> = {
  'united states': ['united states of america'],
  'czechia': ['czech rep'],
  'czech republic': ['czech rep'],
  'ivory coast': ["cote divoire", "cote d ivoire", "cote d'ivoire"],
  'bosnia and herzegovina': ['bosnia and herz'],
  'north macedonia': ['macedonia'],
  'eswatini': ['swaziland'],
  'myanmar': ['myanmar burma'],
  'democratic republic congo': ['dem rep congo'],
  'dr congo': ['dem rep congo'],
  'congo republic': ['congo'],
  'cape verde': ['cabo verde'],
  'south korea': ['korea', 'korea republic of', 'korea south'],
  'north korea': ['dem rep korea', 'korea north'],
  'russia': ['russian federation'],
  'laos': ['lao peoples democratic republic'],
  'syria': ['syrian arab republic'],
  'taiwan': ['taiwan province of china'],
  'micronesia': ['micronesia federated states of'],
  'vatican city': ['holy see'],
};

type GlobeRef = {
  controls: () => {
    autoRotate: boolean;
    autoRotateSpeed: number;
    enableZoom: boolean;
  };
  pointOfView: (
    camera: { lat: number; lng: number; altitude?: number },
    transitionMs?: number,
  ) => void;
};

interface GlobeViewProps {
  countries: Country[];
  selectedCountry: Country | null;
  onSelectCountry: (country: Country) => void;
  isLoading: boolean;
}

export const GlobeView: React.FC<GlobeViewProps> = ({
  countries,
  selectedCountry,
  onSelectCountry,
  isLoading,
}) => {
  const globeRef = useRef<GlobeRef>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [globeSize, setGlobeSize] = useState({ width: 960, height: 560 });
  const [activeList, setActiveList] = useState<'visited' | 'want' | 'favorite' | null>(null);
  const { theme } = useTheme();
  const backgroundColor = 'var(--color-bg)';
  const textColor = 'var(--color-text)';

  const visited = countries.filter((c) => c.userStatus === 'VISITED').length;
  const wantToVisit = countries.filter((c) => c.userStatus === 'WANT_TO_VISIT').length;
  const favorites = countries.filter((c) => c.isFavorite).length;

  const filteredCountries = useMemo(() => {
    const sorted = [...countries].sort((a, b) => a.name.localeCompare(b.name));
    if (activeList === 'visited') {
      return sorted.filter((country) => country.userStatus === 'VISITED');
    }
    if (activeList === 'want') {
      return sorted.filter((country) => country.userStatus === 'WANT_TO_VISIT');
    }
    if (activeList === 'favorite') {
      return sorted.filter((country) => country.isFavorite);
    }
    return [];
  }, [activeList, countries]);

  const markerPoints = useMemo<MarkerPoint[]>(() => {
    return countries
      .filter((country) => Number.isFinite(country.lat) && Number.isFinite(country.lng))
      .map((country) => ({
        ...country,
        markerColor: country.isFavorite
          ? 'var(--color-favorite)'
          : country.userStatus === 'VISITED'
            ? 'var(--color-visited)'
            : country.userStatus === 'WANT_TO_VISIT'
              ? 'var(--color-want-to-visit)'
              : 'var(--color-unvisited)',
      }));
  }, [countries]);

  const polygonCountries = useMemo<GlobePolygonCountry[]>(() => {
    const featureByName = new Map<string, RawWorldFeature>();

    worldGeoJson.features.forEach((feature) => {
      const featureName = feature.properties?.name;
      if (!featureName) {
        return;
      }
      featureByName.set(normalizeName(featureName), feature);
    });

    const result: GlobePolygonCountry[] = [];
    for (const country of countries) {
      const countryKey = normalizeName(country.name);
      const candidates = [countryKey, ...(NAME_ALIASES[countryKey] || [])];

      let matchedFeature: RawWorldFeature | undefined;
      for (const candidate of candidates) {
        matchedFeature = featureByName.get(normalizeName(candidate));
        if (matchedFeature) {
          break;
        }
      }

      if (!matchedFeature) {
        continue;
      }

      result.push({
        type: 'Feature',
        properties: {
          isoCode: country.isoCode,
          name: country.name,
        },
        geometry: matchedFeature.geometry,
      });
    }

    return result;
  }, [countries]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = Math.max(320, Math.floor(entry.contentRect.width));
      const height = Math.max(320, Math.floor(entry.contentRect.height));
      setGlobeSize({ width, height });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!globeRef.current) {
      return;
    }

    const controls = globeRef.current.controls();
    controls.enableZoom = true;
    controls.autoRotate = !selectedCountry;
    controls.autoRotateSpeed = 0.5;
  }, [selectedCountry]);

  useEffect(() => {
    if (!globeRef.current || !selectedCountry) {
      return;
    }

    globeRef.current.pointOfView(
      {
        lat: selectedCountry.lat,
        lng: selectedCountry.lng,
        altitude: 1.6,
      },
      1200,
    );
  }, [selectedCountry]);

  const handlePointClick = (point: object) => {
    const clicked = point as MarkerPoint;
    const country = countries.find((item) => item.isoCode === clicked.isoCode);
    if (country) {
      onSelectCountry(country);
    }
  };

  const getPointAltitude = (point: object) => {
    const marker = point as MarkerPoint;
    return selectedCountry?.isoCode === marker.isoCode ? 0.2 : 0.08;
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: textColor,
      }}
    >
      {isLoading ? (
        <div>Loading globe...</div>
      ) : (
        <>
          <GlobeGL
            ref={globeRef as React.MutableRefObject<any>}
            width={globeSize.width}
            height={globeSize.height}
            globeImageUrl="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg"
            bumpImageUrl="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth_bump.jpg"
            backgroundColor="rgba(0,0,0,0)"
            polygonsData={polygonCountries}
            polygonGeoJsonGeometry="geometry"
            polygonLabel={(polygon: object) => {
              const feature = polygon as GlobePolygonCountry;
              const country = countries.find((item) => item.isoCode === feature.properties.isoCode);
              if (!country) {
                return feature.properties.name;
              }

              const status = country.isFavorite
                ? 'Favorite'
                : country.userStatus === 'VISITED'
                  ? 'Visited'
                  : country.userStatus === 'WANT_TO_VISIT'
                    ? 'Want to Visit'
                    : 'Not Visited';

              return `${country.name} (${country.isoCode}) - ${status}`;
            }}
            onPolygonClick={(polygon: object) => {
              const feature = polygon as GlobePolygonCountry;
              const country = countries.find((item) => item.isoCode === feature.properties.isoCode);
              if (country) {
                onSelectCountry(country);
              }
            }}
            polygonCapColor={(polygon: object) => {
              const feature = polygon as GlobePolygonCountry;
              const country = countries.find((item) => item.isoCode === feature.properties.isoCode);
              if (!country) {
                return 'rgba(255,255,255,0.14)';
              }
              if (country.isFavorite) {
                return 'rgba(245, 158, 11, 0.78)';
              }
              if (country.userStatus === 'VISITED') {
                return 'rgba(34, 197, 94, 0.72)';
              }
              if (country.userStatus === 'WANT_TO_VISIT') {
                return 'rgba(14, 165, 233, 0.72)';
              }
              return 'rgba(148, 163, 184, 0.42)';
            }}
            polygonSideColor={(polygon: object) => {
              const feature = polygon as GlobePolygonCountry;
              const country = countries.find((item) => item.isoCode === feature.properties.isoCode);
              if (country?.isFavorite) {
                return 'rgba(245, 158, 11, 0.35)';
              }
              return 'rgba(15, 23, 42, 0.22)';
            }}
            polygonAltitude={(polygon: object) => {
              const feature = polygon as GlobePolygonCountry;
              const country = countries.find((item) => item.isoCode === feature.properties.isoCode);
              if (selectedCountry?.isoCode === feature.properties.isoCode) {
                return 0.03;
              }
              if (country?.isFavorite) {
                return 0.02;
              }
              return 0.008;
            }}
            pointsData={markerPoints}
            pointLat="lat"
            pointLng="lng"
            pointColor="markerColor"
            pointAltitude={getPointAltitude}
            pointRadius={0.38}
            pointResolution={14}
            pointLabel={(point: object) => {
              const marker = point as MarkerPoint;
              const status = marker.isFavorite
                ? 'Favorite'
                : marker.userStatus === 'VISITED'
                  ? 'Visited'
                  : marker.userStatus === 'WANT_TO_VISIT'
                    ? 'Want to Visit'
                    : 'Not Visited';
              return `${marker.name} (${marker.isoCode}) - ${status}`;
            }}
            onPointClick={handlePointClick}
          />

          <div
            style={{
              position: 'absolute',
              top: '1rem',
              left: '1rem',
              backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
              padding: '0.9rem',
              zIndex: 15,
            }}
          >
            <div style={{ fontSize: '0.78rem', opacity: 0.75, marginBottom: '0.5rem' }}>Countries</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(80px, 1fr))',
                gap: '0.65rem',
              }}
            >
              <div>
                <button
                  type="button"
                  onClick={() => setActiveList(activeList === 'visited' ? null : 'visited')}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left' }}
                >
                  <div style={{ color: 'var(--color-visited)', fontWeight: 700, fontSize: '1.2rem' }}>{visited}</div>
                  <div style={{ fontSize: '0.76rem', opacity: 0.8 }}>Visited</div>
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setActiveList(activeList === 'want' ? null : 'want')}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left' }}
                >
                  <div style={{ color: 'var(--color-want-to-visit)', fontWeight: 700, fontSize: '1.2rem' }}>{wantToVisit}</div>
                  <div style={{ fontSize: '0.76rem', opacity: 0.8 }}>Want</div>
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setActiveList(activeList === 'favorite' ? null : 'favorite')}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left' }}
                >
                  <div style={{ color: 'var(--color-favorite)', fontWeight: 700, fontSize: '1.2rem' }}>{favorites}</div>
                  <div style={{ fontSize: '0.76rem', opacity: 0.8 }}>Favorites</div>
                </button>
              </div>
            </div>

            {activeList ? (
              <div
                style={{
                  marginTop: '0.75rem',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: '0.6rem',
                }}
              >
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', opacity: 0.7, marginBottom: '0.4rem' }}>
                  {activeList === 'visited' ? 'Visited Countries' : activeList === 'want' ? 'Want to Visit' : 'Favorites'}
                </div>
                {filteredCountries.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>No countries in this list</div>
                ) : (
                  filteredCountries.map((country) => (
                    <button
                      key={country.isoCode}
                      type="button"
                      onClick={() => onSelectCountry(country)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        marginBottom: '0.25rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: '0.3rem',
                        padding: '0.35rem 0.5rem',
                        backgroundColor: 'var(--color-surface-raised)',
                        color: 'var(--color-text)',
                        fontSize: '0.78rem',
                      }}
                    >
                      {country.name}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          {selectedCountry ? (
            <div
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
                border: '1px solid var(--color-border)',
                borderRadius: '0.5rem',
                padding: '0.75rem 0.9rem',
                zIndex: 15,
                maxWidth: '260px',
              }}
            >
              <div style={{ fontSize: '0.76rem', opacity: 0.75, marginBottom: '0.25rem' }}>Selected</div>
              <div style={{ fontWeight: 700 }}>{selectedCountry.name}</div>
              <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>{selectedCountry.isoCode}</div>
            </div>
          ) : null}

          <div
            style={{
              position: 'absolute',
              left: '1rem',
              bottom: '1rem',
              zIndex: 15,
              backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
              padding: '0.65rem 0.8rem',
              fontSize: '0.78rem',
              opacity: 0.88,
            }}
          >
            Rotate globe by dragging, scroll to zoom, click marker to open country details.
          </div>
        </>
      )}

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '2rem',
          right: '2rem',
          backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
          border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
          borderRadius: '0.5rem',
          padding: '1rem',
          zIndex: 10,
          fontSize: '0.875rem',
          color: textColor,
        }}
      >
        <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Status</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-favorite)',
              }}
            />
            Favorite
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-visited)',
              }}
            />
            Visited
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-want-to-visit)',
              }}
            />
            Want to Visit
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-unvisited)',
              }}
            />
            Not Visited
          </div>
        </div>
      </div>
    </div>
  );
};

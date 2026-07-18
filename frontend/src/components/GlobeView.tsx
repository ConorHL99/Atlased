/**
 * GlobeView — Interactive 3D globe with country markers
 */

import GlobeGL from 'react-globe.gl';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Country } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { matchCountriesToGeoJson, MatchedPolygonFeature } from '../lib/countryGeoMatch';

interface MarkerPoint extends Country {
  markerColor: string;
}

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
  const [activeCityList, setActiveCityList] = useState<'city-visited' | 'city-favorite' | null>(null);
  const [userCities, setUserCities] = useState<Array<{ id: string; name: string; countryName: string; isVisited: boolean; isFavorite: boolean }>>([]);
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
          ? '#dc2626'
          : country.userStatus === 'VISITED'
            ? '#059669'
            : country.userStatus === 'WANT_TO_VISIT'
              ? '#2563eb'
              : '#94a3b8',
      }));
  }, [countries]);

  const polygonCountries = useMemo(() => {
    const { features } = matchCountriesToGeoJson(countries);
    return features;
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

  // Fetch user city statuses for the cities panel
  useEffect(() => {
    const loadCityStatuses = async () => {
      try {
        const res = await fetch('/api/user/cities/status', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUserCities(data.cities || []);
        }
      } catch (err) {
        console.warn('Failed to load city statuses:', err);
      }
    };
    loadCityStatuses();
  }, [selectedCountry]); // Refresh when panel closes after toggling

  const visitedCities = userCities.filter((c) => c.isVisited);
  const favoriteCities = userCities.filter((c) => c.isFavorite);

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
    return selectedCountry?.isoCode === marker.isoCode ? 0.06 : 0.01;
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
              const feature = polygon as MatchedPolygonFeature;
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
              const feature = polygon as MatchedPolygonFeature;
              const country = countries.find((item) => item.isoCode === feature.properties.isoCode);
              if (country) {
                onSelectCountry(country);
              }
            }}
            polygonCapColor={(polygon: object) => {
              const feature = polygon as MatchedPolygonFeature;
              const country = countries.find((item) => item.isoCode === feature.properties.isoCode);
              if (!country) {
                return 'rgba(255,255,255,0.14)';
              }
              // Green infill for visited (independent of favorite)
              if (country.userStatus === 'VISITED') {
                return 'rgba(5, 150, 105, 0.72)';
              }
              if (country.userStatus === 'WANT_TO_VISIT') {
                return 'rgba(37, 99, 235, 0.62)';
              }
              return 'rgba(148, 163, 184, 0.32)';
            }}
            polygonSideColor={() => 'rgba(15, 23, 42, 0.22)'}
            polygonAltitude={(polygon: object) => {
              const feature = polygon as MatchedPolygonFeature;
              if (selectedCountry?.isoCode === feature.properties.isoCode) {
                return 0.035;
              }
              const country = countries.find((item) => item.isoCode === feature.properties.isoCode);
              if (country?.isFavorite) {
                return 0.02;
              }
              return 0.006;
            }}
            polygonStrokeColor={(polygon: object) => {
              const feature = polygon as MatchedPolygonFeature;
              if (selectedCountry?.isoCode === feature.properties.isoCode) {
                return '#ffffff';
              }
              const country = countries.find((item) => item.isoCode === feature.properties.isoCode);
              // Red outline for favorite (independent of visited)
              if (country?.isFavorite) {
                return '#dc2626';
              }
              if (country?.userStatus === 'VISITED') {
                return '#059669';
              }
              if (country?.userStatus === 'WANT_TO_VISIT') {
                return '#2563eb';
              }
              return 'rgba(203, 213, 225, 0.4)';
            }}
            pointsData={markerPoints}
            pointLat="lat"
            pointLng="lng"
            pointColor="markerColor"
            pointAltitude={getPointAltitude}
            pointRadius={0.22}
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

          {/* Cities status panel */}
          {(visitedCities.length > 0 || favoriteCities.length > 0) && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(1rem + 200px)',
                left: '1rem',
                backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
                border: '1px solid var(--color-border)',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                zIndex: 15,
                maxWidth: '260px',
              }}
            >
              <div style={{ fontSize: '0.78rem', opacity: 0.75, marginBottom: '0.5rem' }}>Cities</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveCityList(activeCityList === 'city-visited' ? null : 'city-visited')}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left' }}
                >
                  <div style={{ color: 'var(--color-visited)', fontWeight: 700, fontSize: '1.1rem' }}>{visitedCities.length}</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>Visited</div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCityList(activeCityList === 'city-favorite' ? null : 'city-favorite')}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left' }}
                >
                  <div style={{ color: 'var(--color-favorite)', fontWeight: 700, fontSize: '1.1rem' }}>{favoriteCities.length}</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>Favourites</div>
                </button>
              </div>

              {activeCityList ? (
                <div
                  style={{
                    marginTop: '0.6rem',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: '0.5rem',
                  }}
                >
                  {(activeCityList === 'city-visited' ? visitedCities : favoriteCities).length === 0 ? (
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>No cities in this list</div>
                  ) : (
                    (activeCityList === 'city-visited' ? visitedCities : favoriteCities).map((city) => (
                      <div
                        key={city.id}
                        style={{
                          marginBottom: '0.25rem',
                          border: '1px solid var(--color-border)',
                          borderRadius: '0.3rem',
                          padding: '0.3rem 0.5rem',
                          backgroundColor: 'var(--color-surface-raised)',
                          color: 'var(--color-text)',
                          fontSize: '0.75rem',
                        }}
                      >
                        {city.name} <span style={{ opacity: 0.6, fontSize: '0.68rem' }}>({city.countryName})</span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          )}

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

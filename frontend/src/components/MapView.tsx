/**
 * MapView — Real-world map using Leaflet with status markers and drilldown lists.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap, PathOptions } from 'leaflet';
import { Country } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { matchCountriesToGeoJson } from '../lib/countryGeoMatch';

interface MapViewProps {
  countries: Country[];
  selectedCountry: Country | null;
  selectedCity?: { id: string; name: string; lat: number; lng: number; countryIsoCode: string; countryName: string } | null;
  onSelectCountry: (country: Country) => void;
  isLoading: boolean;
}

const getCountryColor = (country: Country): string => {
  // Fill color based on visited/want status (NOT favorite — that's the outline)
  if (country.userStatus === 'VISITED') {
    return 'var(--color-visited)';
  }
  if (country.userStatus === 'WANT_TO_VISIT') {
    return 'var(--color-want-to-visit)';
  }
  return 'var(--color-unvisited)';
};

export const MapView: React.FC<MapViewProps> = React.memo(({
  countries,
  selectedCountry,
  selectedCity,
  onSelectCountry,
  isLoading,
}) => {
  const { theme } = useTheme();
  const [zoom, setZoom] = useState(2);
  const [mapRef, setMapRef] = useState<LeafletMap | null>(null);
  const lastFocusKeyRef = useRef<string | null>(null);
  const [activeList, setActiveList] = useState<'visited' | 'want' | 'favorite' | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [statusLegendMinimized, setStatusLegendMinimized] = useState(false);
  const [showUnmatchedDebug, setShowUnmatchedDebug] = useState(false);
  const showDebugTools = import.meta.env.DEV;

  const textColor = 'var(--color-text)';
  const borderColor = 'var(--color-border)';

  const handleResetView = () => {
    if (mapRef) {
      mapRef.setView([20, 0], 2);
    }
  };

  const validCountries = countries.filter(
    (country) => Number.isFinite(country.lat) && Number.isFinite(country.lng),
  );

  const visitedCount = countries.filter((country) => country.userStatus === 'VISITED').length;
  const wantCount = countries.filter((country) => country.userStatus === 'WANT_TO_VISIT').length;
  const favoriteCount = countries.filter((country) => country.isFavorite).length;

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

  const { polygonFeatures, unmatchedCountryNames } = useMemo(() => {
    const result = matchCountriesToGeoJson(countries);
    return {
      polygonFeatures: {
        type: 'FeatureCollection' as const,
        features: result.features,
      },
      unmatchedCountryNames: result.unmatchedNames,
    };
  }, [countries]);

  const countryByIso = useMemo(() => {
    const map = new Map<string, Country>();
    countries.forEach((country) => map.set(country.isoCode, country));
    return map;
  }, [countries]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const apply = () => {
      const mobile = media.matches;
      setIsMobile(mobile);
      setStatusLegendMinimized(mobile);
    };

    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!mapRef) {
      return;
    }

    const focus = selectedCity || selectedCountry;
    if (!focus) {
      lastFocusKeyRef.current = null;
      return;
    }

    const focusKey = selectedCity ? `city:${selectedCity.id}` : `country:${selectedCountry?.isoCode || ''}`;
    if (lastFocusKeyRef.current === focusKey) {
      return;
    }

    lastFocusKeyRef.current = focusKey;

    mapRef.flyTo([focus.lat, focus.lng], Math.max(mapRef.getZoom(), selectedCity ? 6 : 4), {
      duration: 0.7,
    });
  }, [mapRef, selectedCountry?.isoCode, selectedCountry?.lat, selectedCountry?.lng, selectedCity?.id, selectedCity?.lat, selectedCity?.lng]);

  const ZoomTracker: React.FC = () => {
    const map = useMapEvents({
      zoomend: () => setZoom(map.getZoom()),
    });
    useEffect(() => {
      setZoom(map.getZoom());
    }, [map]);
    return null;
  };

  const MapRefSync: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      setMapRef(map);
    }, [map]);
    return null;
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {isLoading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            color: textColor,
          }}
        >
          Loading map...
        </div>
      ) : (
        <>
          {/* Zoom level indicator */}
          <div
            style={{
              position: 'absolute',
              top: '1rem',
              left: '1rem',
              zIndex: 20,
              backgroundColor: 'var(--color-surface)',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              color: textColor,
              border: `1px solid ${borderColor}`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>Zoom: {zoom.toFixed(1)}x</span>
            <button
              type="button"
              onClick={() => mapRef?.zoomOut()}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: '0.25rem',
                padding: '0.15rem 0.4rem',
                cursor: 'pointer',
                backgroundColor: 'var(--color-surface-raised)',
                color: textColor,
              }}
            >
              -
            </button>
            <button
              type="button"
              onClick={() => mapRef?.zoomIn()}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: '0.25rem',
                padding: '0.15rem 0.4rem',
                cursor: 'pointer',
                backgroundColor: 'var(--color-surface-raised)',
                color: textColor,
              }}
            >
              +
            </button>
            <button
              type="button"
              onClick={handleResetView}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: '0.25rem',
                padding: '0.15rem 0.4rem',
                cursor: 'pointer',
                backgroundColor: 'var(--color-surface-raised)',
                color: textColor,
              }}
            >
              Reset
            </button>
          </div>

          <MapContainer
            center={[20, 0]}
            zoom={2}
            minZoom={2}
            style={{ width: '100%', height: '100%' }}
            worldCopyJump
            maxBounds={[
              [-85, -180],
              [85, 180],
            ]}
            maxBoundsViscosity={0.8}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url={theme === 'dark' ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
            />

            <MapRefSync />
            <ZoomTracker />

            <GeoJSON
              data={polygonFeatures as GeoJSON.FeatureCollection}
              style={(feature): PathOptions => {
                const isoCode = String(feature?.properties?.isoCode || '');
                const country = countryByIso.get(isoCode);
                const isSelected = isoCode === selectedCountry?.isoCode;
                const isFavorite = Boolean(country?.isFavorite);
                const isVisited = country?.userStatus === 'VISITED';
                const fillColor = country ? getCountryColor(country) : 'var(--color-unvisited)';

                return {
                  // Red outline for favorite, green for visited, default for others
                  color: isSelected
                    ? (theme === 'dark' ? '#f8fafc' : '#0f172a')
                    : isFavorite
                      ? '#dc2626'
                      : isVisited
                        ? '#059669'
                        : theme === 'dark'
                          ? '#8fa4c5'
                          : '#415a77',
                  weight: isSelected ? 2.4 : isFavorite ? 2.5 : 1,
                  fillColor,
                  fillOpacity: isVisited ? 0.5 : country?.userStatus ? 0.4 : 0.2,
                  dashArray: isFavorite && !isSelected ? '5 4' : undefined,
                };
              }}
              onEachFeature={(feature, layer) => {
                const isoCode = String(feature.properties?.isoCode || '');
                const country = countryByIso.get(isoCode);

                if (country) {
                  layer.bindTooltip(country.name, { sticky: true });
                  layer.on('click', () => onSelectCountry(country));
                }
              }}
            />

            {validCountries.map((country) => {
              const isSelected = selectedCountry?.isoCode === country.isoCode;
              const color = getCountryColor(country);

              return (
                <CircleMarker
                  key={country.isoCode}
                  center={[country.lat, country.lng]}
                  radius={isSelected ? 9.5 : 6}
                  pathOptions={{
                    color: isSelected
                      ? (theme === 'dark' ? '#f8fafc' : '#0f172a')
                      : country.isFavorite
                        ? '#dc2626'
                        : '#ffffff',
                    weight: isSelected ? 2 : country.isFavorite ? 2 : 1,
                    fillColor: color,
                    fillOpacity: isSelected ? 0.96 : 0.82,
                  }}
                  eventHandlers={{
                    click: () => onSelectCountry(country),
                  }}
                />
              );
            })}

            {selectedCity ? (
              <CircleMarker
                center={[selectedCity.lat, selectedCity.lng]}
                radius={11}
                pathOptions={{
                  color: '#f97316',
                  weight: 3,
                  fillColor: '#fb923c',
                  fillOpacity: 0.95,
                }}
              />
            ) : null}
          </MapContainer>

          {/* Legend */}
          {statusLegendMinimized ? (
            <button
              type="button"
              aria-label="Show status legend"
              onClick={() => setStatusLegendMinimized(false)}
              style={{
                position: 'absolute',
                bottom: isMobile ? '0.8rem' : '1rem',
                right: isMobile ? '0.8rem' : '1rem',
                width: '16px',
                height: '16px',
                borderRadius: '999px',
                border: `2px solid ${theme === 'dark' ? '#e2e8f0' : '#1e293b'}`,
                backgroundColor: 'var(--color-primary)',
                zIndex: 22,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                padding: 0,
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                bottom: isMobile ? '0.7rem' : '1rem',
                right: isMobile ? '0.7rem' : '1rem',
                zIndex: 20,
                backgroundColor: 'var(--color-surface)',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                padding: isMobile ? '0.7rem' : '1rem',
                fontSize: '0.875rem',
                color: textColor,
                maxWidth: isMobile ? '220px' : 'unset',
              }}
            >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <div style={{ marginBottom: 0, fontWeight: 600 }}>Status</div>
              <button
                type="button"
                onClick={() => setStatusLegendMinimized(true)}
                aria-label="Minimize status legend"
                style={{
                  border: `1px solid ${theme === 'dark' ? '#475569' : '#cbd5e1'}`,
                  borderRadius: '0.35rem',
                  background: 'transparent',
                  color: textColor,
                  lineHeight: 1,
                  padding: '0.1rem 0.35rem',
                  cursor: 'pointer',
                }}
              >
                -
              </button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '0.4rem',
                marginBottom: '0.75rem',
                borderBottom: `1px solid ${borderColor}`,
                paddingBottom: '0.7rem',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveList(activeList === 'visited' ? null : 'visited')}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.35rem',
                  background: activeList === 'visited' ? 'var(--color-surface-raised)' : 'transparent',
                  color: textColor,
                  padding: '0.35rem 0.4rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color: 'var(--color-visited)', fontSize: '0.98rem', fontWeight: 700 }}>{visitedCount}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.78 }}>Visited</div>
              </button>
              <button
                type="button"
                onClick={() => setActiveList(activeList === 'want' ? null : 'want')}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.35rem',
                  background: activeList === 'want' ? 'var(--color-surface-raised)' : 'transparent',
                  color: textColor,
                  padding: '0.35rem 0.4rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color: 'var(--color-want-to-visit)', fontSize: '0.98rem', fontWeight: 700 }}>{wantCount}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.78 }}>Want</div>
              </button>
              <button
                type="button"
                onClick={() => setActiveList(activeList === 'favorite' ? null : 'favorite')}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.35rem',
                  background: activeList === 'favorite' ? 'var(--color-surface-raised)' : 'transparent',
                  color: textColor,
                  padding: '0.35rem 0.4rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color: 'var(--color-favorite)', fontSize: '0.98rem', fontWeight: 700 }}>{favoriteCount}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.78 }}>Favs</div>
              </button>
            </div>

            {activeList ? (
              <div
                style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  marginBottom: '0.7rem',
                  borderBottom: `1px solid ${borderColor}`,
                  paddingBottom: '0.7rem',
                }}
              >
                {filteredCountries.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>No countries in this list</div>
                ) : (
                  filteredCountries.map((country) => (
                    <button
                      key={country.isoCode}
                      type="button"
                      onClick={() => onSelectCountry(country)}
                      style={{
                        width: '100%',
                        border: '1px solid var(--color-border)',
                        borderRadius: '0.3rem',
                        background: 'var(--color-surface-raised)',
                        color: textColor,
                        padding: '0.3rem 0.45rem',
                        marginBottom: '0.25rem',
                        textAlign: 'left',
                        fontSize: '0.76rem',
                        cursor: 'pointer',
                      }}
                    >
                      {country.name}
                    </button>
                  ))
                )}
              </div>
            ) : null}

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
            <div
              style={{
                marginTop: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: `1px solid ${borderColor}`,
                fontSize: '0.75rem',
                opacity: 0.7,
              }}
            >
              <div>Scroll to zoom</div>
              <div>Drag to pan</div>
              <div>Click marker for details</div>
            </div>

            {showDebugTools && unmatchedCountryNames.length > 0 ? (
              <div
                style={{
                  marginTop: '0.65rem',
                  paddingTop: '0.65rem',
                  borderTop: `1px solid ${borderColor}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowUnmatchedDebug((prev) => !prev)}
                  style={{
                    width: '100%',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.3rem',
                    background: 'var(--color-surface-raised)',
                    color: textColor,
                    fontSize: '0.72rem',
                    textAlign: 'left',
                    padding: '0.35rem 0.45rem',
                    cursor: 'pointer',
                  }}
                >
                  Debug: unmatched names ({unmatchedCountryNames.length})
                </button>
                {showUnmatchedDebug ? (
                  <div
                    style={{
                      marginTop: '0.35rem',
                      maxHeight: '110px',
                      overflowY: 'auto',
                      fontSize: '0.7rem',
                      opacity: 0.85,
                    }}
                  >
                    {unmatchedCountryNames.map((name) => (
                      <div key={name}>{name}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
});

MapView.displayName = 'MapView';

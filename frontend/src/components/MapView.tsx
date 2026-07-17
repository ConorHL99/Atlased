/**
 * MapView — Scrollable/zoomable world map with country selection
 * Renders all countries by projecting lat/lng onto an equirectangular map plane
 */

import React, { useEffect, useRef, useState } from 'react';
import { Country } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface MapViewProps {
  countries: Country[];
  selectedCountry: Country | null;
  onSelectCountry: (country: Country) => void;
  isLoading: boolean;
}

const MAP_WIDTH = 2160;
const MAP_HEIGHT = 1080;

const getCountryColor = (country: Country): string => {
  if (country.isFavorite) {
    return 'var(--color-favorite)';
  }
  if (country.userStatus === 'VISITED') {
    return 'var(--color-visited)';
  }
  if (country.userStatus === 'WANT_TO_VISIT') {
    return 'var(--color-want-to-visit)';
  }
  return 'var(--color-unvisited)';
};

export const MapView: React.FC<MapViewProps> = ({
  countries,
  selectedCountry,
  onSelectCountry,
  isLoading,
}) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, originX: 0, originY: 0 });

  const backgroundColor = 'var(--color-bg)';
  const textColor = 'var(--color-text)';
  const borderColor = 'var(--color-border)';

  const clampZoom = (value: number) => Math.max(1, Math.min(5, value));

  const projectToMap = (lat: number, lng: number) => {
    const x = ((lng + 180) / 360) * MAP_WIDTH;
    const y = ((90 - lat) / 180) * MAP_HEIGHT;
    return { x, y };
  };

  // Handle mouse wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom((prev) => clampZoom(prev * delta));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Handle pan (drag)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY, originX: panX, originY: panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanX(panStart.originX + (e.clientX - panStart.x));
    setPanY(panStart.originY + (e.clientY - panStart.y));
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };
  const handleResetView = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  const validCountries = countries.filter(
    (country) => Number.isFinite(country.lat) && Number.isFinite(country.lng),
  );

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor,
        overflow: 'hidden',
        cursor: isPanning ? 'grabbing' : 'grab',
      }}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
              onClick={() => setZoom((prev) => clampZoom(prev * 0.9))}
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
              onClick={() => setZoom((prev) => clampZoom(prev * 1.1))}
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

          {/* Map container with zoom and pan transforms */}
          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: 'center',
              transition: isPanning ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: MAP_WIDTH,
                height: MAP_HEIGHT,
                backgroundColor: theme === 'dark' ? '#13233d' : '#d9eefe',
                border: `2px solid ${borderColor}`,
                borderRadius: '0.5rem',
                overflow: 'hidden',
              }}
            >
              {/* Latitude lines */}
              {Array.from({ length: 13 }).map((_, i) => (
                <div
                  key={`lat-${i}`}
                  style={{
                    position: 'absolute',
                    top: (i * MAP_HEIGHT) / 12,
                    left: 0,
                    width: MAP_WIDTH,
                    height: 1,
                    backgroundColor: theme === 'dark' ? '#93c5fd' : '#1d4ed8',
                    opacity: 0.15,
                  }}
                />
              ))}

              {/* Longitude lines */}
              {Array.from({ length: 25 }).map((_, i) => (
                <div
                  key={`lng-${i}`}
                  style={{
                    position: 'absolute',
                    left: (i * MAP_WIDTH) / 24,
                    top: 0,
                    width: 1,
                    height: MAP_HEIGHT,
                    backgroundColor: theme === 'dark' ? '#93c5fd' : '#1d4ed8',
                    opacity: 0.12,
                  }}
                />
              ))}

              {/* Country markers */}
              {validCountries.map((country) => {
                const pos = projectToMap(country.lat, country.lng);

                const isSelected = selectedCountry?.isoCode === country.isoCode;
                const color = getCountryColor(country);

                return (
                  <div
                    key={country.isoCode}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isPanning) {
                        onSelectCountry(country);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: pos.x,
                      top: pos.y,
                      transform: isSelected
                        ? 'translate(-50%, -50%) scale(1.18)'
                        : 'translate(-50%, -50%) scale(1)',
                      minWidth: '28px',
                      height: '28px',
                      padding: '0 0.5rem',
                      backgroundColor: color,
                      border: isSelected
                        ? `2px solid ${theme === 'dark' ? '#f8fafc' : '#0f172a'}`
                        : `1px solid ${borderColor}`,
                      borderRadius: '999px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease-out',
                      opacity: isSelected ? 1 : 0.85,
                      boxShadow: isSelected
                        ? `0 4px 12px rgba(0, 0, 0, 0.3)`
                        : '0 2px 6px rgba(0, 0, 0, 0.18)',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      color: '#fff',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                    title={country.name}
                  >
                    {country.isoCode}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div
            style={{
              position: 'absolute',
              bottom: '1rem',
              right: '1rem',
              zIndex: 20,
              backgroundColor: 'var(--color-surface)',
              border: `1px solid ${borderColor}`,
              borderRadius: '0.5rem',
              padding: '1rem',
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
          </div>
        </>
      )}
    </div>
  );
};

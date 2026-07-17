/**
 * CountryDetailPanel — Shows detailed info about selected country
 *
 * Features:
 * - Country info: flag, name, capital, population, GDP, languages
 * - Cities list with visited/favorite status
 * - Action buttons: Mark as visited, want-to-visit, favorite
 * - Close button to return to globe
 */

import React, { useEffect, useState } from 'react';
import { Country, City } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface CountryDetailPanelProps {
  country: Country;
  onClose: () => void;
  onMarkVisited?: (isoCode: string) => void;
  onMarkWantToVisit?: (isoCode: string) => void;
  onMarkFavorite?: (isoCode: string) => void;
}

export const CountryDetailPanel: React.FC<CountryDetailPanelProps> = ({
  country,
  onClose,
  onMarkVisited,
  onMarkWantToVisit,
  onMarkFavorite,
}) => {
  const { theme } = useTheme();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch cities for selected country
  useEffect(() => {
    const fetchCities = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/countries/${country.isoCode}/cities`,
          {
            credentials: 'include',
          },
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch cities: ${res.status}`);
        }

        const data = await res.json();
        setCities(data.cities || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching cities:', err);
        setError(err instanceof Error ? err.message : 'Failed to load cities');
      } finally {
        setLoading(false);
      }
    };

    fetchCities();
  }, [country.isoCode]);

  const backgroundColor =
    theme === 'dark' ? '#1e293b' : '#f8fafc';
  const textColor = theme === 'dark' ? '#f1f5f9' : '#0f172a';
  const borderColor = theme === 'dark' ? '#334155' : '#e2e8f0';
  const buttonBgHover =
    theme === 'dark' ? '#334155' : '#e2e8f0';

  const citiesVisited = cities.filter((c) => c.userVisited).length;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '100%',
        maxWidth: '400px',
        height: '100%',
        backgroundColor,
        color: textColor,
        boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.2)',
        overflow: 'auto',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1.5rem',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>
            {country.name}
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.7 }}>
            Capital: {country.capital}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: textColor,
            padding: '0',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            transition: 'background-color 200ms',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              buttonBgHover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              'transparent';
          }}
        >
          ✕
        </button>
      </div>

      {/* Flag and Image */}
      {country.flagUrl && (
        <div
          style={{
            width: '100%',
            height: '120px',
            backgroundImage: `url('${country.flagUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderBottom: `1px solid ${borderColor}`,
          }}
        />
      )}

      {/* Info Grid */}
      <div style={{ padding: '1.5rem', borderBottom: `1px solid ${borderColor}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                opacity: 0.7,
                marginBottom: '0.25rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Population
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 500 }}>
              {(country.population / 1_000_000).toFixed(1)}M
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                opacity: 0.7,
                marginBottom: '0.25rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              GDP
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 500 }}>
              ${(country.gdpUsd / 1_000_000_000).toFixed(1)}B
            </div>
          </div>
        </div>

        {country.languages && country.languages.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                opacity: 0.7,
                marginBottom: '0.25rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Languages
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              {country.languages.join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div
        style={{
          padding: '1rem',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <button
          onClick={() => onMarkVisited?.(country.isoCode)}
          style={{
            padding: '0.75rem',
            backgroundColor: country.userStatus === 'VISITED' ? 'var(--color-visited)' : 'transparent',
            color: country.userStatus === 'VISITED' ? '#fff' : textColor,
            border: `1px solid ${country.userStatus === 'VISITED' ? 'var(--color-visited)' : borderColor}`,
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
            transition: 'all 200ms',
          }}
          onMouseEnter={(e) => {
            if (country.userStatus !== 'VISITED') {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-visited)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-visited)';
            }
          }}
          onMouseLeave={(e) => {
            if (country.userStatus !== 'VISITED') {
              (e.currentTarget as HTMLButtonElement).style.borderColor = borderColor;
              (e.currentTarget as HTMLButtonElement).style.color = textColor;
            }
          }}
        >
          {country.userStatus === 'VISITED' ? '✓ Visited' : 'Mark as Visited'}
        </button>

        <button
          onClick={() => onMarkWantToVisit?.(country.isoCode)}
          style={{
            padding: '0.75rem',
            backgroundColor:
              country.userStatus === 'WANT_TO_VISIT' ? 'var(--color-want-to-visit)' : 'transparent',
            color: country.userStatus === 'WANT_TO_VISIT' ? '#fff' : textColor,
            border: `1px solid ${country.userStatus === 'WANT_TO_VISIT' ? 'var(--color-want-to-visit)' : borderColor}`,
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
            transition: 'all 200ms',
          }}
          onMouseEnter={(e) => {
            if (country.userStatus !== 'WANT_TO_VISIT') {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-want-to-visit)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-want-to-visit)';
            }
          }}
          onMouseLeave={(e) => {
            if (country.userStatus !== 'WANT_TO_VISIT') {
              (e.currentTarget as HTMLButtonElement).style.borderColor = borderColor;
              (e.currentTarget as HTMLButtonElement).style.color = textColor;
            }
          }}
        >
          {country.userStatus === 'WANT_TO_VISIT'
            ? '✓ Want to Visit'
            : 'Want to Visit'}
        </button>

        <button
          onClick={() => onMarkFavorite?.(country.isoCode)}
          style={{
            padding: '0.75rem',
            backgroundColor: country.isFavorite ? 'var(--color-favorite)' : 'transparent',
            color: country.isFavorite ? '#fff' : textColor,
            border: `1px solid ${country.isFavorite ? 'var(--color-favorite)' : borderColor}`,
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
            transition: 'all 200ms',
          }}
          onMouseEnter={(e) => {
            if (!country.isFavorite) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-favorite)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-favorite)';
            }
          }}
          onMouseLeave={(e) => {
            if (!country.isFavorite) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = borderColor;
              (e.currentTarget as HTMLButtonElement).style.color = textColor;
            }
          }}
        >
          {country.isFavorite ? '★ Favorite' : '☆ Add to Favorites'}
        </button>
      </div>

      {/* Cities List */}
      <div style={{ padding: '1rem', flex: 1, overflow: 'auto' }}>
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            opacity: 0.7,
            marginBottom: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Cities ({citiesVisited}/{cities.length})
        </div>

        {loading ? (
          <div style={{ fontSize: '0.875rem', opacity: 0.6 }}>
            Loading cities...
          </div>
        ) : error ? (
          <div style={{ fontSize: '0.875rem', color: '#ef4444' }}>
            {error}
          </div>
        ) : cities.length === 0 ? (
          <div style={{ fontSize: '0.875rem', opacity: 0.6 }}>
            No cities available
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {cities.map((city) => (
              <div
                key={city.name}
                style={{
                  padding: '0.75rem',
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#fff',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {city.userVisited && (
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>✓</span>
                )}
                {city.userFavorite && (
                  <span style={{ color: '#d97706', fontWeight: 600 }}>★</span>
                )}
                <span>{city.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

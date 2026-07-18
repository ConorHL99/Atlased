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
  styleOverride?: React.CSSProperties;
}

export const CountryDetailPanel: React.FC<CountryDetailPanelProps> = ({
  country,
  onClose,
  onMarkVisited,
  onMarkWantToVisit,
  onMarkFavorite,
  styleOverride,
}) => {
  const { theme } = useTheme();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cityActionError, setCityActionError] = useState<string | null>(null);
  const [busyCityActions, setBusyCityActions] = useState<Set<string>>(new Set());

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

  const setCityBusy = (cityId: string, isBusy: boolean) => {
    setBusyCityActions((prev) => {
      const next = new Set(prev);
      if (isBusy) {
        next.add(cityId);
      } else {
        next.delete(cityId);
      }
      return next;
    });
  };

  const handleToggleCityVisited = async (cityId: string) => {
    setCityActionError(null);
    setCityBusy(cityId, true);

    try {
      const res = await fetch(`/api/user/cities/${cityId}/visited`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`Failed to update city visited status (${res.status})`);
      }

      setCities((prev) =>
        prev.map((city) =>
          city.id === cityId
            ? { ...city, userVisited: !city.userVisited }
            : city,
        ),
      );
    } catch (err) {
      console.error('Error toggling city visited status:', err);
      setCityActionError(err instanceof Error ? err.message : 'Failed to update city visited status');
    } finally {
      setCityBusy(cityId, false);
    }
  };

  const handleToggleCityFavorite = async (cityId: string) => {
    setCityActionError(null);
    setCityBusy(cityId, true);

    try {
      const res = await fetch(`/api/user/cities/${cityId}/favorite`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`Failed to update city favorite status (${res.status})`);
      }

      setCities((prev) =>
        prev.map((city) =>
          city.id === cityId
            ? { ...city, userFavorite: !city.userFavorite }
            : city,
        ),
      );
    } catch (err) {
      console.error('Error toggling city favorite status:', err);
      setCityActionError(err instanceof Error ? err.message : 'Failed to update city favorite status');
    } finally {
      setCityBusy(cityId, false);
    }
  };

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
        ...styleOverride,
      } as React.CSSProperties}
    >
      {/* Header: name + capital left, flag + close right */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.35rem', lineHeight: 1.2 }}>
            {country.name}
          </h2>
          <p style={{ margin: 0, fontSize: '0.82rem', opacity: 0.7 }}>
            {country.capital}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          {country.flagUrl && (
            <img
              src={country.flagUrl}
              alt={`${country.name} flag`}
              style={{
                width: '48px',
                height: '32px',
                objectFit: 'cover',
                borderRadius: '3px',
                border: `1px solid ${borderColor}`,
              }}
            />
          )}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.3rem',
              cursor: 'pointer',
              color: textColor,
              padding: '0',
              width: '28px',
              height: '28px',
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
      </div>

      {/* Country photo */}
      <div
        style={{
          width: '100%',
          height: '160px',
          backgroundImage: country.imageUrl
            ? `url('${country.imageUrl}')`
            : `linear-gradient(135deg, ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}, ${theme === 'dark' ? '#334155' : '#cbd5e1'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: theme === 'dark' ? '#1a2436' : '#f0f4f8',
          borderBottom: `1px solid ${borderColor}`,
        }}
      />

      {/* Info Grid */}
      <div style={{ padding: '1.25rem', borderBottom: `1px solid ${borderColor}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
          <div>
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                opacity: 0.7,
                marginBottom: '0.2rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Population
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>
              {country.population > 0
                ? country.population >= 1_000_000
                  ? `${(country.population / 1_000_000).toFixed(1)}M`
                  : country.population.toLocaleString()
                : '—'}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                opacity: 0.7,
                marginBottom: '0.2rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              GDP
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>
              {country.gdpUsd && country.gdpUsd > 0
                ? `$${(country.gdpUsd / 1_000_000_000).toFixed(1)}B`
                : '—'}
            </div>
          </div>
          {country.currency && (
            <div>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  opacity: 0.7,
                  marginBottom: '0.2rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Currency
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                {country.currency}
              </div>
            </div>
          )}
        </div>

        {country.languages && country.languages.length > 0 && (
          <div style={{ marginTop: '0.85rem' }}>
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                opacity: 0.7,
                marginBottom: '0.2rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Languages
            </div>
            <div style={{ fontSize: '0.85rem' }}>
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

        {cityActionError ? (
          <div style={{ fontSize: '0.8rem', color: '#ef4444', marginBottom: '0.5rem' }}>
            {cityActionError}
          </div>
        ) : null}

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
                key={city.id}
                style={{
                  padding: '0.75rem',
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#fff',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                }}
              >
                <span style={{ flex: 1 }}>{city.name}</span>
                <button
                  type="button"
                  onClick={() => void handleToggleCityVisited(city.id)}
                  disabled={busyCityActions.has(city.id)}
                  style={{
                    border: `1px solid ${city.userVisited ? '#16a34a' : borderColor}`,
                    color: city.userVisited ? '#16a34a' : textColor,
                    background: 'transparent',
                    borderRadius: '0.3rem',
                    padding: '0.22rem 0.45rem',
                    fontSize: '0.75rem',
                    cursor: busyCityActions.has(city.id) ? 'not-allowed' : 'pointer',
                    opacity: busyCityActions.has(city.id) ? 0.55 : 1,
                  }}
                >
                  {city.userVisited ? 'Visited' : 'Visit'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleCityFavorite(city.id)}
                  disabled={busyCityActions.has(city.id)}
                  style={{
                    border: `1px solid ${city.userFavorite ? '#d97706' : borderColor}`,
                    color: city.userFavorite ? '#d97706' : textColor,
                    background: 'transparent',
                    borderRadius: '0.3rem',
                    padding: '0.22rem 0.45rem',
                    fontSize: '0.75rem',
                    cursor: busyCityActions.has(city.id) ? 'not-allowed' : 'pointer',
                    opacity: busyCityActions.has(city.id) ? 0.55 : 1,
                  }}
                >
                  {city.userFavorite ? 'Favorite' : 'Fav'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

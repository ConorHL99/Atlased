/**
 * CountryDetailPanel — Shows detailed info about selected country
 *
 * Features:
 * - Country info: flag, name, capital, population, GDP, languages
 * - Cities list with visited/favorite status
 * - Action buttons: Mark as visited, want-to-visit, favorite
 * - Close button to return to globe
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Country, City } from '../types';
import { useTheme } from '../contexts/ThemeContext';

type CityStatusChangePayload = {
  id: string;
  name: string;
  countryIsoCode: string;
  countryName: string;
  isVisited: boolean;
  isWantToVisit: boolean;
  isFavorite: boolean;
};

const CITY_PAGE_SIZE = 120;

interface CountryDetailPanelProps {
  country: Country;
  onClose: () => void;
  onMarkVisited?: (isoCode: string) => void;
  onMarkWantToVisit?: (isoCode: string) => void;
  onMarkFavorite?: (isoCode: string) => void;
  onCityStatusChange?: (city: CityStatusChangePayload) => void;
  highlightCityName?: string | null;
  styleOverride?: React.CSSProperties;
}

export const CountryDetailPanel: React.FC<CountryDetailPanelProps> = React.memo(({
  country,
  onClose,
  onMarkVisited,
  onMarkWantToVisit,
  onMarkFavorite,
  onCityStatusChange,
  highlightCityName,
  styleOverride,
}) => {
  const { theme } = useTheme();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cityActionError, setCityActionError] = useState<string | null>(null);
  const [busyCityActions, setBusyCityActions] = useState<Set<string>>(new Set());
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [photoFailed, setPhotoFailed] = useState(false);
  const [cityOffset, setCityOffset] = useState(0);
  const [cityTotal, setCityTotal] = useState(0);
  const [hasMoreCities, setHasMoreCities] = useState(false);
  const [loadingMoreCities, setLoadingMoreCities] = useState(false);
  const [activeCityIndex, setActiveCityIndex] = useState(-1);
  const cityRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadCities = useCallback(
    async (query: string, offset: number, append: boolean, controller?: AbortController) => {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set('q', query.trim());
      }
      params.set('limit', String(CITY_PAGE_SIZE));
      params.set('offset', String(offset));

      const res = await fetch(`/api/countries/${country.isoCode}/cities?${params.toString()}`, {
        credentials: 'include',
        signal: controller?.signal,
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch cities: ${res.status}`);
      }

      const data = await res.json();
      const nextCities: City[] = data.cities || [];
      const pagination = data.pagination || {};

      setCities((prev) => {
        if (!append) {
          return nextCities;
        }

        const seen = new Set(prev.map((city) => city.id));
        const merged = [...prev];
        nextCities.forEach((city) => {
          if (!seen.has(city.id)) {
            merged.push(city);
          }
        });
        return merged;
      });

      setCityOffset((pagination.offset ?? offset) + nextCities.length);
      setCityTotal(Number(pagination.total ?? nextCities.length));
      setHasMoreCities(Boolean(pagination.hasMore));
      setError(null);
    },
    [country.isoCode],
  );

  // Reset panel-local state when country changes.
  useEffect(() => {
    setCitySearchTerm('');
    setPhotoFailed(false);
    setCities([]);
    setCityOffset(0);
    setCityTotal(0);
    setHasMoreCities(false);
    setActiveCityIndex(-1);
  }, [country.isoCode]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        await loadCities(citySearchTerm, 0, false, controller);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        console.error('Error searching cities:', err);
        setError(err instanceof Error ? err.message : 'Failed to search cities');
      } finally {
        setLoading(false);
      }
    }, 260);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [citySearchTerm, loadCities]);

  useEffect(() => {
    if (!highlightCityName) {
      return;
    }

    // Force query to include searched city so it can be highlighted even in large lists.
    setCitySearchTerm(highlightCityName);
  }, [highlightCityName, country.isoCode]);

  const backgroundColor =
    theme === 'dark' ? '#1e293b' : '#f8fafc';
  const textColor = theme === 'dark' ? '#f1f5f9' : '#0f172a';
  const borderColor = theme === 'dark' ? '#334155' : '#e2e8f0';
  const buttonBgHover =
    theme === 'dark' ? '#334155' : '#e2e8f0';

  const citiesVisited = cities.filter((c) => c.userVisited).length;
  const citiesWanted = cities.filter((c) => c.userWantToVisit).length;
  const visibleCities = useMemo(() => cities, [cities]);

  useEffect(() => {
    if (visibleCities.length === 0) {
      setActiveCityIndex(-1);
      return;
    }

    setActiveCityIndex((prev) => {
      if (prev < 0) {
        return -1;
      }
      return Math.min(prev, visibleCities.length - 1);
    });
  }, [visibleCities]);

  useEffect(() => {
    if (!highlightCityName || visibleCities.length === 0) {
      return;
    }

    const target = highlightCityName.trim().toLowerCase();
    if (!target) {
      return;
    }

    const matchedIndex = visibleCities.findIndex((city) => city.name.trim().toLowerCase() === target);
    if (matchedIndex >= 0) {
      setActiveCityIndex(matchedIndex);
      const matchedCity = visibleCities[matchedIndex];
      const row = cityRowRefs.current[matchedCity.id];
      if (row) {
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightCityName, visibleCities]);

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

      let payload: CityStatusChangePayload | null = null;
      setCities((prev) => {
        const nextCities = prev.map((city) => {
          if (city.id !== cityId) {
            return city;
          }
          const nextVisited = !city.userVisited;
          return {
            ...city,
            userVisited: nextVisited,
            userWantToVisit: nextVisited ? false : city.userWantToVisit,
          };
        });
        const changedCity = nextCities.find((city) => city.id === cityId);
        if (changedCity) {
          payload = {
            id: changedCity.id,
            name: changedCity.name,
            countryIsoCode: country.isoCode,
            countryName: country.name,
            isVisited: Boolean(changedCity.userVisited),
            isWantToVisit: Boolean(changedCity.userWantToVisit),
            isFavorite: Boolean(changedCity.userFavorite),
          };
        }
        return nextCities;
      });

      if (payload) {
        onCityStatusChange?.(payload);
      }
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

      let payload: CityStatusChangePayload | null = null;
      setCities((prev) => {
        const nextCities = prev.map((city) =>
          city.id === cityId ? { ...city, userFavorite: !city.userFavorite } : city,
        );
        const changedCity = nextCities.find((city) => city.id === cityId);
        if (changedCity) {
          payload = {
            id: changedCity.id,
            name: changedCity.name,
            countryIsoCode: country.isoCode,
            countryName: country.name,
            isVisited: Boolean(changedCity.userVisited),
            isWantToVisit: Boolean(changedCity.userWantToVisit),
            isFavorite: Boolean(changedCity.userFavorite),
          };
        }
        return nextCities;
      });

      if (payload) {
        onCityStatusChange?.(payload);
      }
    } catch (err) {
      console.error('Error toggling city favorite status:', err);
      setCityActionError(err instanceof Error ? err.message : 'Failed to update city favorite status');
    } finally {
      setCityBusy(cityId, false);
    }
  };

  const handleToggleCityWantToVisit = async (cityId: string) => {
    setCityActionError(null);
    setCityBusy(cityId, true);

    try {
      const res = await fetch(`/api/user/cities/${cityId}/want-to-visit`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`Failed to update city want-to-visit status (${res.status})`);
      }

      let payload: CityStatusChangePayload | null = null;
      setCities((prev) => {
        const nextCities = prev.map((city) => {
          if (city.id !== cityId) {
            return city;
          }

          const nextWant = !city.userWantToVisit;
          return {
            ...city,
            userWantToVisit: nextWant,
            userVisited: nextWant ? false : city.userVisited,
          };
        });
        const changedCity = nextCities.find((city) => city.id === cityId);
        if (changedCity) {
          payload = {
            id: changedCity.id,
            name: changedCity.name,
            countryIsoCode: country.isoCode,
            countryName: country.name,
            isVisited: Boolean(changedCity.userVisited),
            isWantToVisit: Boolean(changedCity.userWantToVisit),
            isFavorite: Boolean(changedCity.userFavorite),
          };
        }
        return nextCities;
      });

      if (payload) {
        onCityStatusChange?.(payload);
      }
    } catch (err) {
      console.error('Error toggling city want-to-visit status:', err);
      setCityActionError(err instanceof Error ? err.message : 'Failed to update city want-to-visit status');
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
        width: 'min(100vw, 420px)',
        maxWidth: '100vw',
        height: '100%',
        backgroundColor,
        color: textColor,
        boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.2)',
        overflowY: 'auto',
        overflowX: 'hidden',
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
          height: '120px',
          minHeight: '80px',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: theme === 'dark' ? '#1a2436' : '#f0f4f8',
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        {!photoFailed && country.imageUrl ? (
          <img
            src={country.imageUrl}
            alt={`${country.name} landscape`}
            loading="lazy"
            onError={() => setPhotoFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: `linear-gradient(135deg, ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}, ${theme === 'dark' ? '#334155' : '#cbd5e1'})`,
            }}
          />
        )}
      </div>

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
          padding: '0.6rem 1rem',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          flexDirection: 'row',
          gap: '0.4rem',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => onMarkVisited?.(country.isoCode)}
          style={{
            flex: 1,
            padding: '0.5rem 0.25rem',
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
          {country.userStatus === 'VISITED' ? '✓ Visited' : 'Visited'}
        </button>

        <button
          onClick={() => onMarkWantToVisit?.(country.isoCode)}
          style={{
            flex: 1,
            padding: '0.5rem 0.25rem',
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
            ? '✓ Want'
            : 'Want'}
        </button>

        <button
          onClick={() => onMarkFavorite?.(country.isoCode)}
          style={{
            flex: 1,
            padding: '0.5rem 0.25rem',
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
      <div style={{ padding: '1rem', minHeight: 0 }}>
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
          Cities ({citiesVisited} visited · {citiesWanted} want · {cityTotal || cities.length} total)
        </div>

        <input
          type="text"
          value={citySearchTerm}
          onChange={(e) => setCitySearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (visibleCities.length === 0) {
              return;
            }

            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveCityIndex((prev) => Math.min(prev + 1, visibleCities.length - 1));
              return;
            }

            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveCityIndex((prev) => Math.max(prev - 1, 0));
              return;
            }

            if (e.key === 'Enter') {
              if (activeCityIndex >= 0 && activeCityIndex < visibleCities.length) {
                e.preventDefault();
                void handleToggleCityVisited(visibleCities[activeCityIndex].id);
              }
              return;
            }

            if (e.key === 'Escape') {
              e.preventDefault();
              setCitySearchTerm('');
              setActiveCityIndex(-1);
            }
          }}
          placeholder="Search cities in this country"
          style={{
            width: '100%',
            marginBottom: '0.75rem',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.375rem',
            padding: '0.45rem 0.55rem',
            fontSize: '0.82rem',
            backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
            color: textColor,
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.65rem',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              fontSize: '0.73rem',
              padding: '0.2rem 0.45rem',
              borderRadius: '999px',
              border: `1px solid ${borderColor}`,
              backgroundColor: 'var(--color-surface-raised)',
              opacity: 0.9,
            }}
          >
            {cities.length} shown / {cityTotal || cities.length}
          </span>
          <span style={{ fontSize: '0.71rem', opacity: 0.68 }}>
            ↑↓ move, Enter toggle visited
          </span>
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
        ) : visibleCities.length === 0 ? (
          <div style={{ fontSize: '0.875rem', opacity: 0.6 }}>
            No matching cities for "{citySearchTerm}"
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {visibleCities.map((city, index) => (
              <div
                key={city.id}
                ref={(node) => {
                  cityRowRefs.current[city.id] = node;
                }}
                onMouseEnter={() => setActiveCityIndex(index)}
                style={{
                  padding: '0.75rem',
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#fff',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  boxShadow: activeCityIndex === index ? '0 0 0 2px rgba(37, 99, 235, 0.35)' : 'none',
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
                  onClick={() => void handleToggleCityWantToVisit(city.id)}
                  disabled={busyCityActions.has(city.id)}
                  style={{
                    border: `1px solid ${city.userWantToVisit ? '#2563eb' : borderColor}`,
                    color: city.userWantToVisit ? '#2563eb' : textColor,
                    background: 'transparent',
                    borderRadius: '0.3rem',
                    padding: '0.22rem 0.45rem',
                    fontSize: '0.75rem',
                    cursor: busyCityActions.has(city.id) ? 'not-allowed' : 'pointer',
                    opacity: busyCityActions.has(city.id) ? 0.55 : 1,
                  }}
                >
                  {city.userWantToVisit ? 'Wanted' : 'Want'}
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

      {hasMoreCities ? (
        <div style={{ padding: '0 1rem 1rem 1rem' }}>
          <button
            type="button"
            onClick={async () => {
              try {
                setLoadingMoreCities(true);
                await loadCities(citySearchTerm, cityOffset, true);
              } catch (err) {
                console.error('Error loading more cities:', err);
                setError(err instanceof Error ? err.message : 'Failed to load more cities');
              } finally {
                setLoadingMoreCities(false);
              }
            }}
            disabled={loadingMoreCities}
            style={{
              width: '100%',
              border: `1px solid ${borderColor}`,
              borderRadius: '0.375rem',
              backgroundColor: 'var(--color-surface-raised)',
              color: textColor,
              padding: '0.55rem 0.65rem',
              fontSize: '0.82rem',
              cursor: loadingMoreCities ? 'not-allowed' : 'pointer',
              opacity: loadingMoreCities ? 0.7 : 1,
            }}
          >
            {loadingMoreCities ? 'Loading more cities...' : `Load more cities (${Math.max(cityTotal - cities.length, 0)} remaining)`}
          </button>
        </div>
      ) : null}

      <div style={{ padding: '0 1rem 1rem 1rem', fontSize: '0.74rem', opacity: 0.68 }}>
        Showing {cities.length} of {cityTotal || cities.length} cities
      </div>
    </div>
  );
});

CountryDetailPanel.displayName = 'CountryDetailPanel';

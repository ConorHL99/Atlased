/**
 * HomePage — Atlased
 *
 * Main authenticated view with 3D globe showing visited/favorite countries.
 * Phase 5: Globe implementation with country detail panel.
 */

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { GlobeView } from '../components/GlobeView';
import { CountryDetailPanel } from '../components/CountryDetailPanel';
import { SettingsMenu } from '../components/SettingsMenu';
import { Country } from '../types';
import styles from './HomePage.module.css';

const LazyMapView = lazy(async () => {
  const module = await import('../components/MapView');
  return { default: module.MapView };
});

interface SearchCountryResult {
  isoCode: string;
  name: string;
  lat: number;
  lng: number;
}

interface SearchCityResult {
  name: string;
  countryIsoCode: string;
  countryName: string;
  countryLat: number;
  countryLng: number;
}

export const HomePage: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'globe' | 'map'>('globe');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchCountries, setSearchCountries] = useState<SearchCountryResult[]>([]);
  const [searchCities, setSearchCities] = useState<SearchCityResult[]>([]);

  const textColor = theme === 'dark' ? '#f1f5f9' : '#0f172a';

  // Fetch all countries with user status on mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/countries', {
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch countries: ${res.status}`);
        }

        const data = await res.json();
        setCountries(data.countries || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching countries:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load countries',
        );
        setCountries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCountries();
  }, [user]);

  useEffect(() => {
    const query = searchTerm.trim();
    if (query.length < 2) {
      setSearchCountries([]);
      setSearchCities([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await fetch(`/api/countries/search?q=${encodeURIComponent(query)}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error(`Search failed (${res.status})`);
        }

        const data = await res.json();
        setSearchCountries(data.countries || []);
        setSearchCities(data.cities || []);
      } catch (err) {
        console.error('Search error:', err);
        setSearchCountries([]);
        setSearchCities([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (viewMode === 'map') {
      void import('../components/MapView');
    }
  }, [viewMode]);

  const ensureCountryLoaded = async (isoCode: string): Promise<Country | null> => {
    const existing = countries.find((country) => country.isoCode === isoCode);
    if (existing) {
      return existing;
    }

    try {
      const res = await fetch(`/api/countries/${isoCode}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      const loaded: Country = data.country;
      setCountries((prev) => [...prev, loaded]);
      return loaded;
    } catch (err) {
      console.error('Failed loading country from search:', err);
      return null;
    }
  };

  const handleSelectSearchCountry = async (isoCode: string) => {
    const country = await ensureCountryLoaded(isoCode);
    if (!country) {
      return;
    }

    setSelectedCountry(country);
    setSearchOpen(false);
    setSearchTerm('');
  };

  const handleMarkVisited = async (isoCode: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/user/countries/${isoCode}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'VISITED' }),
      });

      if (!res.ok) throw new Error(`Failed to mark as visited (${res.status})`);

      // Optimistically update UI
      setCountries((prev) =>
        prev.map((c) =>
          c.isoCode === isoCode
            ? { ...c, userStatus: 'VISITED' }
            : c,
        ),
      );
      if (selectedCountry?.isoCode === isoCode) {
        setSelectedCountry((prev) =>
          prev ? { ...prev, userStatus: 'VISITED' } : null,
        );
      }
    } catch (err) {
      console.error('Error marking as visited:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to mark as visited');
    }
  };

  const handleMarkWantToVisit = async (isoCode: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/user/countries/${isoCode}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'WANT_TO_VISIT' }),
      });

      if (!res.ok) throw new Error(`Failed to mark as want to visit (${res.status})`);

      setCountries((prev) =>
        prev.map((c) =>
          c.isoCode === isoCode
            ? { ...c, userStatus: 'WANT_TO_VISIT' }
            : c,
        ),
      );
      if (selectedCountry?.isoCode === isoCode) {
        setSelectedCountry((prev) =>
          prev ? { ...prev, userStatus: 'WANT_TO_VISIT' } : null,
        );
      }
    } catch (err) {
      console.error('Error marking as want to visit:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to mark as want to visit');
    }
  };

  const handleMarkFavorite = async (isoCode: string) => {
    setActionError(null);
    const currentCountry = countries.find((c) => c.isoCode === isoCode);
    const newFavorite = !currentCountry?.isFavorite;
    try {
      const res = await fetch(`/api/user/countries/${isoCode}/favorite`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: newFavorite }),
      });

      if (!res.ok) throw new Error(`Failed to toggle favorite (${res.status})`);

      setCountries((prev) =>
        prev.map((c) =>
          c.isoCode === isoCode
            ? { ...c, isFavorite: newFavorite }
            : c,
        ),
      );
      if (selectedCountry?.isoCode === isoCode) {
        setSelectedCountry((prev) =>
          prev ? { ...prev, isFavorite: newFavorite } : null,
        );
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to toggle favorite');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text)',
      }}
    >
      {/* Header */}
      <header
        className={styles.header}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className={styles.headerLeft}>
          <div className={styles.logoWrap}>
            <svg viewBox="0 0 32 32" className={styles.logoIcon} aria-hidden="true">
              <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.45" />
              <path d="M16 6 L19.6 16 L16 26 L12.4 16 Z" fill="currentColor" />
              <circle cx="16" cy="16" r="2" fill="var(--color-bg)" />
            </svg>
            <h1 className={styles.logo}>Atlased</h1>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.searchWrap}>
            <input
              value={searchTerm}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Search country or city"
              className={styles.searchInput}
            />
            {searchOpen && (
              <div className={styles.searchDropdown}>
                {searchLoading ? (
                  <div className={styles.searchEmpty}>Searching...</div>
                ) : searchTerm.trim().length < 2 ? (
                  <div className={styles.searchEmpty}>Type at least 2 characters</div>
                ) : (
                  <>
                    <div className={styles.searchSectionTitle}>Countries</div>
                    {searchCountries.length === 0 ? (
                      <div className={styles.searchEmpty}>No country matches</div>
                    ) : (
                      searchCountries.map((country) => (
                        <button
                          type="button"
                          key={`country-${country.isoCode}`}
                          className={styles.searchItem}
                          onClick={() => void handleSelectSearchCountry(country.isoCode)}
                        >
                          <span>{country.name}</span>
                          <span className={styles.searchMeta}>{country.isoCode}</span>
                        </button>
                      ))
                    )}

                    <div className={styles.searchSectionTitle}>Cities</div>
                    {searchCities.length === 0 ? (
                      <div className={styles.searchEmpty}>No city matches</div>
                    ) : (
                      searchCities.map((city, index) => (
                        <button
                          type="button"
                          key={`city-${city.countryIsoCode}-${city.name}-${index}`}
                          className={styles.searchItem}
                          onClick={() => void handleSelectSearchCountry(city.countryIsoCode)}
                        >
                          <span>{city.name}</span>
                          <span className={styles.searchMeta}>{city.countryName}</span>
                        </button>
                      ))
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--color-surface-raised)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            Settings
          </button>

          {/* View mode toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'globe' ? 'map' : 'globe')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--color-surface-raised)',
              color: textColor,
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'background-color 0.2s',
            }}
          >
            {viewMode === 'globe' ? '🗺️ Map' : '🌍 Globe'}
          </button>
          <button
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          {user && (
            <div className={styles.userMenu}>
              <span className={styles.userEmail}>{user.email}</span>
              <button onClick={logout} className={styles.logoutBtn}>
                Log Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          isolation: 'isolate',
        }}
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              fontSize: '1.125rem',
            }}
          >
            Loading globe...
          </div>
        ) : error ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              fontSize: '1rem',
              color: '#ef4444',
            }}
          >
            Error: {error}
          </div>
        ) : (
          <>
            {actionError ? (
              <div
                style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 25,
                  backgroundColor: 'var(--color-error-bg)',
                  color: 'var(--color-error)',
                  border: '1px solid var(--color-error)',
                  borderRadius: '0.5rem',
                  padding: '0.55rem 0.9rem',
                  fontSize: '0.85rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {actionError}
              </div>
            ) : null}

            <div style={{ position: 'absolute', inset: 0, zIndex: 1, isolation: 'isolate' }}>
              {viewMode === 'globe' ? (
                <GlobeView
                  countries={countries}
                  selectedCountry={selectedCountry}
                  onSelectCountry={setSelectedCountry}
                  isLoading={loading}
                />
              ) : (
                <Suspense
                  fallback={
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        fontSize: '1rem',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      Loading map view...
                    </div>
                  }
                >
                  <LazyMapView
                    countries={countries}
                    selectedCountry={selectedCountry}
                    onSelectCountry={setSelectedCountry}
                    isLoading={loading}
                  />
                </Suspense>
              )}
            </div>
            {selectedCountry && (
              <CountryDetailPanel
                country={selectedCountry}
                onClose={() => setSelectedCountry(null)}
                onMarkVisited={handleMarkVisited}
                onMarkWantToVisit={handleMarkWantToVisit}
                onMarkFavorite={handleMarkFavorite}
                styleOverride={{ zIndex: 40 }}
              />
            )}
          </>
        )}
      </main>

      <SettingsMenu isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {searchOpen && (
        <button
          type="button"
          aria-label="Close search"
          style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 5 }}
          onClick={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
};

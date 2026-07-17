/**
 * HomePage — Atlased
 *
 * Main authenticated view with 3D globe showing visited/favorite countries.
 * Phase 5: Globe implementation with country detail panel.
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { GlobeView } from '../components/GlobeView';
import { MapView } from '../components/MapView';
import { CountryDetailPanel } from '../components/CountryDetailPanel';
import { SettingsMenu } from '../components/SettingsMenu';
import { Country } from '../types';
import styles from './HomePage.module.css';

export const HomePage: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'globe' | 'map'>('globe');
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const handleMarkVisited = async (isoCode: string) => {
    try {
      const res = await fetch(`/api/user/countries/${isoCode}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'VISITED' }),
      });

      if (!res.ok) throw new Error('Failed to mark as visited');

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
    }
  };

  const handleMarkWantToVisit = async (isoCode: string) => {
    try {
      const res = await fetch(`/api/user/countries/${isoCode}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'WANT_TO_VISIT' }),
      });

      if (!res.ok) throw new Error('Failed to mark as want to visit');

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
    }
  };

  const handleMarkFavorite = async (isoCode: string) => {
    try {
      const res = await fetch(`/api/user/countries/${isoCode}/favorite`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: true }),
      });

      if (!res.ok) throw new Error('Failed to mark as favorite');

      setCountries((prev) =>
        prev.map((c) =>
          c.isoCode === isoCode
            ? { ...c, isFavorite: true }
            : c,
        ),
      );
      if (selectedCountry?.isoCode === isoCode) {
        setSelectedCountry((prev) =>
          prev ? { ...prev, isFavorite: true } : null,
        );
      }
    } catch (err) {
      console.error('Error marking as favorite:', err);
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
          <h1 className={styles.logo}>Atlased</h1>
        </div>
        <div className={styles.headerRight}>
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
            {viewMode === 'globe' ? (
              <GlobeView
                countries={countries}
                selectedCountry={selectedCountry}
                onSelectCountry={setSelectedCountry}
                isLoading={loading}
              />
            ) : (
              <MapView
                countries={countries}
                selectedCountry={selectedCountry}
                onSelectCountry={setSelectedCountry}
                isLoading={loading}
              />
            )}
            {selectedCountry && (
              <CountryDetailPanel
                country={selectedCountry}
                onClose={() => setSelectedCountry(null)}
                onMarkVisited={handleMarkVisited}
                onMarkWantToVisit={handleMarkWantToVisit}
                onMarkFavorite={handleMarkFavorite}
              />
            )}
          </>
        )}
      </main>

      <SettingsMenu isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

import React, { useMemo } from 'react';
import { Country } from '../types';
import { useTheme } from '../contexts/ThemeContext';

type UserCityStatusItem = {
  id: string;
  name: string;
  countryIsoCode: string;
  countryName: string;
  isVisited: boolean;
  isWantToVisit: boolean;
  isFavorite: boolean;
};

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  countries: Country[];
  userCities: UserCityStatusItem[];
}

const continentOverrides: Record<string, string> = {
  AU: 'Oceania', NZ: 'Oceania', FJ: 'Oceania', PG: 'Oceania', SB: 'Oceania', VU: 'Oceania', WS: 'Oceania', TO: 'Oceania', KI: 'Oceania', TV: 'Oceania', NR: 'Oceania', MH: 'Oceania', FM: 'Oceania', PW: 'Oceania', CK: 'Oceania', NU: 'Oceania', TK: 'Oceania', WF: 'Oceania', PF: 'Oceania', NC: 'Oceania', GU: 'Oceania', MP: 'Oceania', AS: 'Oceania', PN: 'Oceania', CX: 'Oceania', CC: 'Oceania', NF: 'Oceania',
  RU: 'Europe', TR: 'Europe', CY: 'Europe', GE: 'Europe', AM: 'Europe', AZ: 'Europe', KZ: 'Asia', EG: 'Africa',
  GL: 'North America', BM: 'North America', BS: 'North America', BB: 'North America', CU: 'North America', DO: 'North America', HT: 'North America', JM: 'North America', TT: 'North America', AG: 'North America', AI: 'North America', AW: 'North America', BQ: 'North America', CW: 'North America', DM: 'North America', GD: 'North America', GP: 'North America', KY: 'North America', KN: 'North America', LC: 'North America', MF: 'North America', MQ: 'North America', MS: 'North America', PR: 'North America', SX: 'North America', TC: 'North America', VC: 'North America', VG: 'North America', VI: 'North America', BL: 'North America',
};

const normalizeName = (value: string) => value.toLowerCase().normalize('NFD').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const getContinent = (country: Country): string => {
  if (continentOverrides[country.isoCode]) {
    return continentOverrides[country.isoCode];
  }

  const { lat, lng } = country;
  if (lat <= -60) return 'Antarctica';
  if (lng >= 110 && lat <= 25) return 'Oceania';
  if (lng >= -92 && lng <= -30 && lat < 15) return 'South America';
  if (lng >= -170 && lng <= -15 && lat >= 7) return 'North America';
  if (lat >= 34 && lng >= -25 && lng <= 60) return 'Europe';
  if (lat >= -38 && lat <= 38 && lng >= -25 && lng <= 60) return 'Africa';
  return 'Asia';
};

const ProgressCard: React.FC<{ title: string; value: string; subtitle: string; percent: number; accent: string; }> = ({ title, value, subtitle, percent, accent }) => (
  <div style={{ border: '1px solid var(--color-border)', borderRadius: '0.8rem', padding: '1rem', background: 'var(--color-surface-raised)' }}>
    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.72, marginBottom: '0.45rem' }}>{title}</div>
    <div style={{ fontSize: '1.9rem', fontWeight: 800, marginBottom: '0.2rem' }}>{value}</div>
    <div style={{ fontSize: '0.84rem', opacity: 0.78, marginBottom: '0.8rem' }}>{subtitle}</div>
    <div style={{ width: '100%', height: '10px', borderRadius: '999px', background: 'rgba(148,163,184,0.22)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: '100%', borderRadius: '999px', background: accent }} />
    </div>
    <div style={{ marginTop: '0.45rem', fontSize: '0.78rem', opacity: 0.76 }}>{percent.toFixed(1)}%</div>
  </div>
);

export const StatsModal: React.FC<StatsModalProps> = ({ isOpen, onClose, countries, userCities }) => {
  const { theme } = useTheme();

  const stats = useMemo(() => {
    const totalCountries = countries.length;
    const visitedCountries = countries.filter((country) => country.userStatus === 'VISITED');
    const totalContinents = new Set(countries.map(getContinent)).size;
    const visitedContinents = new Set(visitedCountries.map(getContinent)).size;

    const visitedCitySet = new Set(
      userCities
        .filter((city) => city.isVisited)
        .map((city) => `${city.countryIsoCode}:${normalizeName(city.name)}`),
    );

    const capitalCountries = countries.filter((country) => country.capital && country.capital.trim().length > 0);
    const visitedCapitals = capitalCountries.filter((country) => {
      const capitalVariants = country.capital
        .split(/,|\//)
        .map((part) => normalizeName(part))
        .filter(Boolean);
      return capitalVariants.some((capital) => visitedCitySet.has(`${country.isoCode}:${capital}`));
    }).length;

    return {
      totalCountries,
      visitedCountries: visitedCountries.length,
      totalContinents,
      visitedContinents,
      totalCapitals: capitalCountries.length,
      visitedCapitals,
      worldPercent: totalCountries ? (visitedCountries.length / totalCountries) * 100 : 0,
      capitalPercent: capitalCountries.length ? (visitedCapitals / capitalCountries.length) * 100 : 0,
      continentPercent: totalContinents ? (visitedContinents / totalContinents) * 100 : 0,
    };
  }, [countries, userCities]);

  if (!isOpen) {
    return null;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: 'min(92vw, 760px)', maxHeight: '84vh', overflowY: 'auto', borderRadius: '1rem', border: `1px solid ${theme === 'dark' ? '#334155' : '#dbe4ee'}`, background: theme === 'dark' ? '#0f172a' : '#f8fafc', boxShadow: '0 24px 80px rgba(0,0,0,0.28)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, padding: '1rem 1.1rem', background: theme === 'dark' ? 'rgba(15, 23, 42, 0.96)' : 'rgba(248, 250, 252, 0.96)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${theme === 'dark' ? '#334155' : '#dbe4ee'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>Travel Stats</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>Global Progress</div>
          </div>
          <button type="button" onClick={onClose} style={{ border: `1px solid ${theme === 'dark' ? '#475569' : '#cbd5e1'}`, borderRadius: '0.5rem', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', padding: '0.35rem 0.6rem', fontSize: '0.9rem' }}>Close</button>
        </div>

        <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
          <ProgressCard title="Continents" value={`${stats.visitedContinents}/${stats.totalContinents}`} subtitle="Continents visited" percent={stats.continentPercent} accent="linear-gradient(90deg, #0ea5e9, #2563eb)" />
          <ProgressCard title="Countries" value={`${stats.visitedCountries}/${stats.totalCountries}`} subtitle="Countries visited" percent={stats.worldPercent} accent="linear-gradient(90deg, #10b981, #059669)" />
          <ProgressCard title="World Coverage" value={`${stats.worldPercent.toFixed(1)}%`} subtitle="Of all countries visited" percent={stats.worldPercent} accent="linear-gradient(90deg, #22c55e, #16a34a)" />
          <ProgressCard title="Capital Cities" value={`${stats.visitedCapitals}/${stats.totalCapitals}`} subtitle="Capitals visited" percent={stats.capitalPercent} accent="linear-gradient(90deg, #f59e0b, #ea580c)" />
        </div>

        <div style={{ padding: '0 1rem 1rem 1rem' }}>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '0.8rem', padding: '1rem', background: 'var(--color-surface-raised)' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Summary</div>
            <div style={{ fontSize: '0.92rem', lineHeight: 1.55, opacity: 0.84 }}>
              You have visited {stats.visitedCountries} of {stats.totalCountries} countries across {stats.visitedContinents} of {stats.totalContinents} continents, and visited {stats.visitedCapitals} of {stats.totalCapitals} capital cities.
            </div>
          </div>
        </div>
      </div>
      <button type="button" aria-label="Close stats" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: -1 }} />
    </div>
  );
};
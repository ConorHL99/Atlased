import React from 'react';
import { COLOR_SCHEME_OPTIONS, useTheme } from '../contexts/ThemeContext';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme, colorScheme, setColorScheme } = useTheme();

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close settings"
        style={{
          position: 'fixed',
          inset: 0,
          border: 'none',
          background: 'rgba(0, 0, 0, 0.45)',
          zIndex: 30,
        }}
      />
      <section
        aria-label="App settings"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(760px, 92vw)',
          maxHeight: '84vh',
          overflowY: 'auto',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 31,
          color: 'var(--color-text)',
          padding: '1.25rem',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>Settings</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
              Theme mode and color palette
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: '0.45rem',
              padding: '0.4rem 0.6rem',
              backgroundColor: 'var(--color-surface-raised)',
              color: 'var(--color-text)',
            }}
          >
            Close
          </button>
        </header>

        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Mode</h3>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setTheme('light')}
              style={{
                border: theme === 'light' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                backgroundColor: theme === 'light' ? 'var(--color-surface-raised)' : 'var(--color-bg)',
                color: 'var(--color-text)',
                borderRadius: '0.45rem',
                padding: '0.5rem 0.75rem',
                fontWeight: 600,
              }}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              style={{
                border: theme === 'dark' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                backgroundColor: theme === 'dark' ? 'var(--color-surface-raised)' : 'var(--color-bg)',
                color: 'var(--color-text)',
                borderRadius: '0.45rem',
                padding: '0.5rem 0.75rem',
                fontWeight: 600,
              }}
            >
              Dark
            </button>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Color schemes</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {COLOR_SCHEME_OPTIONS.map((scheme) => {
              const isSelected = colorScheme === scheme.id;
              return (
                <button
                  key={scheme.id}
                  type="button"
                  onClick={() => setColorScheme(scheme.id)}
                  style={{
                    textAlign: 'left',
                    border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    borderRadius: '0.55rem',
                    backgroundColor: isSelected ? 'var(--color-surface-raised)' : 'var(--color-bg)',
                    padding: '0.75rem',
                    color: 'var(--color-text)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.6rem',
                    }}
                  >
                    <strong style={{ fontSize: '0.95rem' }}>{scheme.label}</strong>
                    {isSelected ? <span style={{ color: 'var(--color-primary)' }}>Active</span> : null}
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '0.6rem' }}>
                    {scheme.description}
                  </p>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', border: '1px solid var(--color-border)' }} />
                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--color-visited)', border: '1px solid var(--color-border)' }} />
                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--color-want-to-visit)', border: '1px solid var(--color-border)' }} />
                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--color-favorite)', border: '1px solid var(--color-border)' }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
};

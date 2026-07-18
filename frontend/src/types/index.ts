/**
 * Type definitions — Atlased Frontend
 */

/**
 * Authenticated user object returned from GET /api/auth/me
 */
export interface User {
  id: string;
  email: string;
  createdAt: string;
}

/**
 * Auth context state
 */
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * API error response (from backend validation middleware)
 */
export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}

/**
 * Country status for the current user
 */
export type CountryStatus = 'VISITED' | 'WANT_TO_VISIT';

/**
 * Country data with user status overlay
 */
export interface Country {
  isoCode: string;
  name: string;
  flagUrl: string;
  imageUrl: string;
  capital: string;
  population: number;
  languages: string[];
  gdpUsd: number;
  currency?: string;
  lat: number;
  lng: number;
  userStatus?: CountryStatus | null; // null = not visited, not favorited
  isFavorite?: boolean;
}

/**
 * City within a country
 */
export interface City {
  id: string;
  name: string;
  lat: number;
  lng: number;
  userVisited?: boolean;
  userFavorite?: boolean;
}

/**
 * Country detail view with cities
 */
export interface CountryDetail extends Country {
  cities: City[];
  totalCities: number;
  citiesVisited: number;
  citiesFavorited: number;
}

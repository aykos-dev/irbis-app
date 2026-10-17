import { useSyncExternalStore } from 'react';

import type { PlacesListParams, PlaceType } from '../../shared/api/generated/model';

export type DifficultyRange = { min: number; max: number };

export type ExploreFilters = {
  types: PlaceType[];
  difficulty: DifficultyRange | null;
  /** Kilometres from the origin; null = Any. */
  maxKm: number | null;
};

export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5] as const;
/** Distance options (AC5); `null` is "Any", the default. */
export const DISTANCE_OPTIONS = [50, 100, 150, null] as const;
/** Explore loads every match at once for the map (AC4). */
export const EXPLORE_LIMIT = 200;

export const noFilters: ExploreFilters = { types: [], difficulty: null, maxKm: null };

/**
 * Session store for the Explore filters (AC5): plain module state, so it survives tab switches
 * and the Place round-trip and resets when the app restarts.
 */
let current: ExploreFilters = noFilters;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach(listener => listener());
}

export const exploreFilters = {
  get: (): ExploreFilters => current,
  set(next: ExploreFilters): void {
    current = next;
    emit();
  },
  reset(): void {
    current = noFilters;
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useExploreFilters(): ExploreFilters {
  return useSyncExternalStore(exploreFilters.subscribe, exploreFilters.get, exploreFilters.get);
}

export function hasFilters(filters: ExploreFilters): boolean {
  return filters.types.length > 0 || filters.difficulty !== null || filters.maxKm !== null;
}

/** Filters → list query params; unset filters are left out so the query key stays minimal. */
export function toListParams(filters: ExploreFilters): PlacesListParams {
  return {
    ...(filters.types.length > 0 ? { types: filters.types } : {}),
    ...(filters.difficulty
      ? { difficultyMin: filters.difficulty.min, difficultyMax: filters.difficulty.max }
      : {}),
    ...(filters.maxKm !== null ? { maxDistanceKm: filters.maxKm } : {}),
  };
}

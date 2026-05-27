/**
 * Single source of truth for all configuration.
 * Override via environment variables — no code changes needed between environments.
 */

export const BASE_URL = process.env.NOTCH_BASE_URL ?? 'https://guardio.app.getnotch.dev';

export const TIMEOUTS = {
  navigation: 30_000,
  element:    10_000,
  result:     15_000, // Playground result render
} as const;

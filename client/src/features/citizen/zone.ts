// OWNER: D1. What each depicted zone result is called and how it is toned. Pure data, shared by the status line and the picker.
import type { ZoneHit } from './geo.ts';

/** Short names for map tags, legend and location cards. */
export const ZONE_SHORT = { high: 'High impact', moderate: 'Moderate impact', none: 'Outside zones' } as const;

export type ZoneInfo = { label: string; tone: 'danger' | 'warning' | 'neutral'; text: string };

export const ZONE: Record<ZoneHit, ZoneInfo> = {
  high: { label: 'High-impact zone', tone: 'danger', text: 'Inside the depicted high-impact zone (simulated).' },
  moderate: { label: 'Moderate-impact zone', tone: 'warning', text: 'Inside the depicted moderate-impact zone (simulated).' },
  none: { label: 'Outside drawn zones', tone: 'neutral', text: 'Outside the depicted zones. This does not mean it is safe.' },
};

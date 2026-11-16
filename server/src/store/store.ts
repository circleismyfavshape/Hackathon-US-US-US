// Single in-memory store for the one FLARE Node process. Demo data only; resets on restart.
import { randomUUID } from 'node:crypto';
import type { Alert, LiveEvent, Sos, SosCreate, SosPatch } from '../../../contracts/types.ts';
import { loadFixtures, type DemoFixtures } from '../seed/index.ts';

export const MAX_SOS = 500;

type Listener = (e: LiveEvent) => void;

export class DemoStore {
  fixtures: DemoFixtures;
  private sos = new Map<string, Sos>();
  private listeners = new Set<Listener>();
  startedAt = Date.now();

  constructor() {
    this.fixtures = loadFixtures(this.startedAt);
  }

  /** Subscribe to changes. Returns the unsubscribe function. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type: LiveEvent['type']) {
    for (const fn of [...this.listeners]) {
      try {
        fn({ type });
      } catch {
        /* one broken listener must not stop the others */
      }
    }
  }

  reset() {
    this.startedAt = Date.now();
    this.fixtures = loadFixtures(this.startedAt);
    this.sos.clear();
    this.emit('reset');
  }

  /** Simulated scenario updates released so far, newest first. They are released over time after start or reset. */
  simulatedAlerts(now = Date.now()): Alert[] {
    const elapsed = (now - this.startedAt) / 1000;
    return this.fixtures.alerts
      .filter((a) => a.afterSeconds <= elapsed)
      .map(({ afterSeconds, ...a }) => ({
        ...a,
        sourceType: 'simulation' as const,
        at: new Date(this.startedAt + afterSeconds * 1000).toISOString(),
        validTo: null,
        local: true,
        url: null,
      }))
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  listSos(): Sos[] {
    return [...this.sos.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  getSos(id: string): Sos | undefined {
    const s = this.sos.get(id);
    return s ? { ...s } : undefined;
  }

  createSos(input: SosCreate, now = new Date()): Sos {
    if (this.sos.size >= MAX_SOS) throw new Error('demo SOS limit reached; reset the demo');
    let id: string;
    do id = `SOS-${randomUUID().slice(0, 8).toUpperCase()}`;
    while (this.sos.has(id));
    const ts = now.toISOString();
    const record: Sos = { ...input, id, status: 'pending', assignedTeam: null, createdAt: ts, updatedAt: ts };
    this.sos.set(id, record);
    this.emit('sos');
    return { ...record };
  }

  patchSos(id: string, patch: SosPatch, now = new Date()): Sos | undefined {
    const cur = this.sos.get(id);
    if (!cur) return undefined;
    const next: Sos = { ...cur, status: patch.status, updatedAt: now.toISOString() };
    if (patch.status === 'assigned') next.assignedTeam = patch.assignedTeam;
    if (patch.status === 'pending') next.assignedTeam = null;
    this.sos.set(id, next);
    this.emit('sos');
    return { ...next };
  }
}

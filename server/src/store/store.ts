// Single in-memory store for the one FLARE Node process. Demo data only; resets on restart.
import { randomUUID } from 'node:crypto';
import type { Alert, LiveEvent, Sos, SosCreate, SosPatch } from '../../../contracts/types.ts';
import { loadFixtures, type DemoFixtures } from '../seed/index.ts';

export const MAX_SOS = 500;

type Listener = (event: LiveEvent) => void;

export type DemoSnapshot = { startedAt: number; requests: Sos[] };

export class DemoStore {
  fixtures: DemoFixtures;
  private sos = new Map<string, Sos>();
  private listeners = new Set<Listener>();
  startedAt = Date.now();

  constructor(snapshot?: DemoSnapshot) {
    if (snapshot) {
      if (
        !Number.isFinite(snapshot.startedAt) ||
        !Array.isArray(snapshot.requests) ||
        snapshot.requests.length > MAX_SOS
      ) {
        throw new Error('Invalid stored demo state');
      }
      this.startedAt = snapshot.startedAt;
      this.sos = new Map(
        structuredClone(snapshot.requests).map((request) => [request.id, request]),
      );
    }
    this.fixtures = loadFixtures(this.startedAt);
  }

  /** A portable copy for hosted storage; local development continues to use memory. */
  snapshot(): DemoSnapshot {
    return { startedAt: this.startedAt, requests: structuredClone([...this.sos.values()]) };
  }

  /** Subscribe to changes. Returns the unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(type: LiveEvent['type']) {
    for (const listener of [...this.listeners]) {
      try {
        listener({ type });
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
      .filter((alert) => alert.afterSeconds <= elapsed)
      .map(({ afterSeconds, ...alert }) => ({
        ...alert,
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
    const request = this.sos.get(id);
    return request ? { ...request } : undefined;
  }

  createSos(input: SosCreate, now = new Date()): Sos {
    if (this.sos.size >= MAX_SOS) {
      throw new Error('demo SOS limit reached; reset the demo');
    }
    let id: string;
    do {
      id = `SOS-${randomUUID().slice(0, 8).toUpperCase()}`;
    } while (this.sos.has(id));
    const timestamp = now.toISOString();
    const record: Sos = {
      ...input,
      id,
      status: 'pending',
      assignedTeam: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.sos.set(id, record);
    this.emit('sos');
    return { ...record };
  }

  patchSos(id: string, patch: SosPatch, now = new Date()): Sos | undefined {
    const current = this.sos.get(id);
    if (!current) {
      return undefined;
    }
    const updated: Sos = { ...current, status: patch.status, updatedAt: now.toISOString() };
    if (patch.status === 'assigned') {
      updated.assignedTeam = patch.assignedTeam;
    }
    if (patch.status === 'pending') {
      updated.assignedTeam = null;
    }
    this.sos.set(id, updated);
    this.emit('sos');
    return { ...updated };
  }
}

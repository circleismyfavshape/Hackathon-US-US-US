// Single in-memory store for the one FLARE Node process. Demo data only; resets on restart.
import { randomUUID } from 'node:crypto';
import type { Sos, SosCreate, SosPatch } from '../../../contracts/types.ts';
import { loadFixtures, type DemoFixtures } from '../seed/index.ts';

export const MAX_SOS = 500;

export class DemoStore {
  fixtures: DemoFixtures;
  private sos = new Map<string, Sos>();
  startedAt = Date.now();

  constructor() {
    this.fixtures = loadFixtures();
  }

  reset() {
    this.fixtures = loadFixtures();
    this.sos.clear();
    this.startedAt = Date.now();
  }

  listSos(): Sos[] {
    return [...this.sos.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  getSos(id: string): Sos | undefined {
    return this.sos.get(id);
  }

  createSos(input: SosCreate, now = new Date()): Sos {
    if (this.sos.size >= MAX_SOS) throw new Error('demo SOS limit reached; reset the demo');
    let id: string;
    do id = `SOS-${randomUUID().slice(0, 8).toUpperCase()}`;
    while (this.sos.has(id));
    const ts = now.toISOString();
    const record: Sos = { ...input, id, status: 'pending', assignedTeam: null, createdAt: ts, updatedAt: ts };
    this.sos.set(id, record);
    return { ...record };
  }

  patchSos(id: string, patch: SosPatch, now = new Date()): Sos | undefined {
    const cur = this.sos.get(id);
    if (!cur) return undefined;
    const next: Sos = { ...cur, status: patch.status, updatedAt: now.toISOString() };
    if (patch.status === 'assigned') next.assignedTeam = patch.assignedTeam;
    if (patch.status === 'pending') next.assignedTeam = null;
    this.sos.set(id, next);
    return { ...next };
  }
}

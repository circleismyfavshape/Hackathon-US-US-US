// FLARE shared shell and primitives. Every interface renders inside <Shell>, so the header,
// navigation and the simulation label are identical on every view.
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@/components/arc/foundation.css';
import type { ReactNode } from 'react';
import type { SosStatus, SosType } from '../shared/api.ts';
import { FlareLogo } from '../shared/Logo.tsx';
import './flare.css';

export const NAV = [
  { href: '/citizen', n: '01', label: 'Citizen' },
  { href: '/responder', n: '02', label: 'First responder' },
  { href: '/recovery', n: '03', label: 'RecoveryGap' },
] as const;

export const SIM_LINE = 'Simulation. Not an emergency service.';

export function Shell({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="fl-app">
      <header className="fl-top">
        <a href="/" className="fl-brand" aria-label="FLARE home">
          <FlareLogo height={22} />
        </a>
        <nav className="fl-nav" aria-label="Interfaces">
          {NAV.map((x) => (
            <a key={x.href} href={x.href} aria-current={path === x.href ? 'page' : undefined}>
              <i>{x.n}</i>
              {x.label}
            </a>
          ))}
        </nav>
        <div className="fl-sim" role="note">
          <b>Simulation</b> Not an emergency service
        </div>
      </header>
      <div className="fl-simline" role="note">
        {SIM_LINE}
      </div>
      {children}
    </div>
  );
}

export const STATUS_LABEL: Record<SosStatus, string> = { pending: 'Pending', assigned: 'Team assigned', resolved: 'Resolved' };
export const STATUS_COLOR: Record<SosStatus, string> = { pending: '#ff4d1c', assigned: '#9a6300', resolved: '#1f7a4d' };
export const TYPE_LABEL: Record<SosType, string> = { trapped: 'Trapped', 'medical-help': 'Medical', supplies: 'Supplies', other: 'Other' };

export function StatusTag({ status }: { status: SosStatus }) {
  return (
    <span className="fl-tag" data-s={status} data-testid="sos-status" data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export const myt = (iso: string | number | Date) =>
  new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kuala_Lumpur' });

export const errText = (e: unknown) => (e instanceof Error ? e.message : 'The demo service could not be reached.');

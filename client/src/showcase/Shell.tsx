// Dark shell shared by every showcase screen: preview label + floating dock.
import type { ReactNode } from 'react';
import { FloatingDock } from './effects.tsx';

export const SCREENS = [
  { href: '/showcase', label: 'All demos', icon: '▦' },
  { href: '/', label: 'Cloud hero', icon: '☁' },
  { href: '/showcase/storm', label: 'Storm hero', icon: '⚡' },
  { href: '/showcase/map', label: 'Live map', icon: '◉' },
  { href: '/showcase/command', label: 'Command centre', icon: '▤' },
  { href: '/showcase/sos', label: 'SOS flow', icon: '✚' },
  { href: '/showcase/recovery', label: 'RecoveryGap', icon: '⇄' },
];

export function Shell({ children, path }: { children: ReactNode; path: string }) {
  return (
    <div className="relative min-h-screen bg-slate-950 pb-24 text-white">
      <div className="fixed right-3 top-12 z-40 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-fuchsia-200 backdrop-blur">
        DESIGN PREVIEW · not approved
      </div>
      {children}
      <FloatingDock items={SCREENS} active={path} />
    </div>
  );
}

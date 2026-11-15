// FLARE shared shell and primitives. Every interface renders inside <Shell>, so the header,
// navigation and the simulation label are identical on every view.
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@/components/arc/foundation.css';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Smartphone } from 'lucide-react';
import type { SosStatus, SosType } from '../shared/api.ts';
import { FlareLogo, FlareMark } from '../shared/Logo.tsx';
import './flare.css';
import './extra.css';

export const NAV = [
  { href: '/citizen', n: '01', label: 'Citizen' },
  { href: '/responder', n: '02', label: 'First responder' },
  { href: '/recovery', n: '03', label: 'Recovery' },
] as const;

/** True when this page is running inside the phone frame. */
export const EMBEDDED = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

// Inside the phone frame the page scrolls like a phone: no desktop scrollbar.
if (EMBEDDED) document.documentElement.classList.add('fl-embedded');

export function Shell({ path, children }: { path: string; children: ReactNode }) {
  const phoneable = path === '/citizen' || path === '/responder' || path === '/recovery';
  return (
    <div className="fl-app" data-embedded={EMBEDDED || undefined}>
      <header className="fl-top">
        <a href="/" className="fl-brand" aria-label="FLARE home" target={EMBEDDED ? '_top' : undefined}>
          <FlareLogo height={22} />
        </a>
        <nav className="fl-nav" aria-label="Interfaces">
          {NAV.map((x) => (
            <a key={x.href} href={x.href} aria-current={path === x.href || path === `/phone${x.href}` ? 'page' : undefined}>
              <i>{x.n}</i>
              {x.label}
            </a>
          ))}
        </nav>
        <div className="fl-sim">
          {phoneable && !EMBEDDED && (
            <a className="fl-btn fl-btn-quiet fl-btn-sm" href={`/phone${path}`}>
              <Smartphone size={14} aria-hidden /> Phone view
            </a>
          )}
          <span className="fl-simtag" role="note">Simulation</span>
        </div>
      </header>
      <div className="fl-simline" role="note">Simulation. In a real emergency call 999.</div>
      {children}
    </div>
  );
}

export const STATUS_LABEL: Record<SosStatus, string> = { pending: 'Pending', assigned: 'Team assigned', resolved: 'Resolved' };
export const STATUS_COLOR: Record<SosStatus, string> = { pending: '#ff4d1c', assigned: '#9a6300', resolved: '#1f7a4d' };
export const TYPE_LABEL: Record<SosType, string> = { trapped: 'Trapped', 'medical-help': 'Medical', supplies: 'Supplies', other: 'Other' };
export const TYPE_PHRASE: Record<SosType, string> = { trapped: 'stuck', 'medical-help': 'need medical help', supplies: 'need supplies', other: 'need help' };

export function StatusTag({ status }: { status: SosStatus }) {
  return (
    <span className="fl-tag" data-s={status} data-testid="sos-status" data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export const myt = (iso: string | number | Date) =>
  new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kuala_Lumpur' });

export const errText = (e: unknown) => (e instanceof Error ? e.message : 'The service could not be reached.');

/* ── Live notifications ───────────────────────────────────────────── */
export type Toast = { id: string; title: string; body: string; meta: string; tone?: 'flare' | 'ink'; onClick?: () => void };

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Toast) => {
    setToasts((cur) => (cur.some((x) => x.id === t.id) ? cur : [t, ...cur].slice(0, 3)));
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), 8000);
  }, []);
  const dismiss = useCallback((id: string) => setToasts((cur) => cur.filter((x) => x.id !== id)), []);
  return { toasts, push, dismiss };
}

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div className="fl-toasts" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className="fl-toast"
          data-tone={t.tone ?? 'ink'}
          onClick={() => {
            t.onClick?.();
            dismiss(t.id);
          }}
        >
          <span className="fl-toast-icon"><FlareMark height={18} /></span>
          <span className="fl-toast-text">
            <span className="fl-toast-top"><b>{t.title}</b><i>now</i></span>
            <span className="fl-toast-body">{t.body}</span>
            <span className="fl-toast-meta">{t.meta}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Calls `onNew` for items that arrive after the first load. */
export function useArrivals<T extends { id: string }>(items: T[], loaded: boolean, onNew: (item: T) => void) {
  const seen = useRef<Set<string> | null>(null);
  const cb = useRef(onNew);
  cb.current = onNew;
  useEffect(() => {
    if (!loaded) return;
    if (seen.current === null) {
      seen.current = new Set(items.map((i) => i.id));
      return;
    }
    for (const it of items) {
      if (!seen.current.has(it.id)) {
        seen.current.add(it.id);
        cb.current(it);
      }
    }
  }, [items, loaded]);
}

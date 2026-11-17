// Shared viewer controls, notifications, tags and error screens.
// Role and device switches stay outside the simulated phone app.
import '@fontsource-variable/geist';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { LocateFixed, Monitor, RotateCcw, Smartphone, X } from 'lucide-react';
import { nearest } from '../features/citizen/geo.ts';
import {
  api,
  type DemoLocation,
  type Scenario,
  type SosStatus,
  type SosType,
  type ZoneLevel,
} from '../shared/api.ts';
import { FlareLogo, FlareMark } from '../shared/Logo.tsx';
import { errText, LEVEL_COLOR, LEVEL_NAME } from './data.ts';
import './theme.css';

/** True when this page is running inside the phone frame. */
export const EMBEDDED = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
if (EMBEDDED) {
  document.documentElement.classList.add('fl-embedded');
}

/* Routing: a few paths, no library */
const ROUTE_EVENT = 'flare:route';
export function navigate(to: string) {
  if (to === window.location.pathname + window.location.search) {
    return;
  }
  window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(ROUTE_EVENT));
  window.scrollTo(0, 0);
}
export function usePath(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener('popstate', sync);
    window.addEventListener(ROUTE_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(ROUTE_EVENT, sync);
    };
  }, []);
  return path.replace(/\/+$/, '') || '/';
}

/**
 * An in-app link: plain href for new tabs and assistive tech, client-side navigation on a normal
 * click.
 */
export function Link({
  to,
  children,
  ...rest
}: { to: string; children: ReactNode } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
>) {
  return (
    <a
      href={to}
      {...rest}
      onClick={(e) => {
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        ) {
          return;
        }
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

/* Viewer bar */
export type Role = 'citizen' | 'responder';
export type Device = 'phone' | 'desktop';
export const viewPath = (role: Role, device: Device) =>
  device === 'phone' ? `/phone/${role}` : `/${role}`;

type ViewerProps = {
  role: Role;
  device: Device;
  scenario: Scenario | null;
  location: DemoLocation | null;
  onLocation: (id: string) => void;
  children: ReactNode;
};

/**
 * The bar around the product. Inside the phone frame it renders nothing: a real app has no
 * "switch to responder" button.
 */
export function Viewer({ role, device, scenario, location, onLocation, children }: ViewerProps) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!note) {
      return;
    }
    const t = setTimeout(() => setNote(null), 5000);
    return () => clearTimeout(t);
  }, [note]);

  const reset = useCallback(async () => {
    setBusy(true);
    try {
      await api.resetDemo();
      setNote('Demo reset. All requests cleared.');
    } catch (e) {
      setNote(errText(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const useGps = useCallback(() => {
    if (!scenario) {
      return;
    }
    if (!('geolocation' in navigator)) {
      return setNote('This browser cannot share a location.');
    }
    setNote('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const b = scenario.demoBounds;
        if (
          here.lat < b.minLat ||
          here.lat > b.maxLat ||
          here.lng < b.minLng ||
          here.lng > b.maxLng
        ) {
          return setNote('You are outside the simulated area, so the chosen demo place is kept.');
        }
        // Privacy: the real position never leaves this page. It only picks the nearest demo place.
        const place = nearest(here, scenario.demoLocations);
        onLocation(place.id);
        setNote(`Using the demo place nearest to you: ${place.label}.`);
      },
      () => setNote('Location was not shared, so the chosen demo place is kept.'),
      { timeout: 8000, maximumAge: 60_000 },
    );
  }, [scenario, onLocation]);

  if (EMBEDDED) {
    return <div className="fl-app fl-app-embedded">{children}</div>;
  }

  return (
    <div className="fl-app" data-device={device}>
      <header className="fl-bar">
        <Link to="/" className="fl-brand" aria-label="FLARE home">
          <FlareLogo height={22} />
        </Link>

        <div className="fl-bar-group" role="group" aria-label="Whose view">
          <span className="fl-bar-label">View as</span>
          <div className="fl-seg">
            <Link
              to={viewPath('citizen', device)}
              aria-current={role === 'citizen' ? 'page' : undefined}
            >
              Citizen
            </Link>
            <Link
              to={viewPath('responder', device)}
              aria-current={role === 'responder' ? 'page' : undefined}
            >
              First responder
            </Link>
          </div>
        </div>

        <div className="fl-bar-group fl-bar-device" role="group" aria-label="Device">
          <span className="fl-bar-label">On</span>
          <div className="fl-seg">
            <Link
              to={viewPath(role, 'phone')}
              aria-current={device === 'phone' ? 'page' : undefined}
            >
              <Smartphone size={15} aria-hidden /> Phone
            </Link>
            <Link
              to={viewPath(role, 'desktop')}
              aria-current={device === 'desktop' ? 'page' : undefined}
            >
              <Monitor size={15} aria-hidden /> Desktop
            </Link>
          </div>
        </div>

        {role === 'citizen' && scenario && location && (
          <div className="fl-bar-group fl-bar-loc">
            <label className="fl-bar-label" htmlFor="fl-loc">
              Citizen is at
            </label>
            <select
              id="fl-loc"
              className="fl-select"
              value={location.id}
              onChange={(e) => onLocation(e.target.value)}
            >
              {scenario.incidents.map((i) => (
                <optgroup key={i.id} label={i.area}>
                  {scenario.demoLocations
                    .filter((l) => l.incidentId === i.id)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              className="fl-iconbtn"
              onClick={useGps}
              title="Use the demo place nearest to my real location"
              aria-label="Use the demo place nearest to my real location"
            >
              <LocateFixed size={16} aria-hidden />
            </button>
          </div>
        )}

        <div className="fl-bar-end">
          <span className="fl-simpill" role="note">
            Simulation
          </span>
          <button
            type="button"
            className="fl-btn fl-btn-ghost fl-btn-sm"
            onClick={reset}
            disabled={busy}
            title="Clear every request and restart the scenario"
          >
            <RotateCcw size={14} aria-hidden /> Reset
          </button>
        </div>
      </header>
      {note && (
        <div className="fl-barnote" role="status">
          {note}
        </div>
      )}
      {children}
    </div>
  );
}

/* Tags */
export const STATUS_LABEL: Record<SosStatus, string> = {
  pending: 'Waiting for a team',
  assigned: 'Team on the way',
  resolved: 'Resolved',
};
export const STATUS_SHORT: Record<SosStatus, string> = {
  pending: 'Waiting',
  assigned: 'On the way',
  resolved: 'Resolved',
};
export const STATUS_COLOR: Record<SosStatus, string> = {
  pending: '#dc2626',
  assigned: '#d97706',
  resolved: '#16a34a',
};
export const TYPE_LABEL: Record<SosType, string> = {
  trapped: 'Trapped',
  'medical-help': 'Medical',
  supplies: 'Supplies',
  other: 'Other',
};
export const TYPE_PHRASE: Record<SosType, string> = {
  trapped: 'trapped by flood water',
  'medical-help': 'need medical help',
  supplies: 'need supplies',
  other: 'need help',
};

export function StatusTag({ status }: { status: SosStatus }) {
  return (
    <span className="fl-tag" data-status={status} data-testid="sos-status">
      <i aria-hidden />
      {STATUS_SHORT[status]}
    </span>
  );
}

export function LevelTag({ level }: { level: ZoneLevel }) {
  return (
    <span
      className="fl-tag fl-tag-level"
      style={{ '--c': LEVEL_COLOR[level] } as React.CSSProperties}
    >
      <i aria-hidden />
      {LEVEL_NAME[level]}
    </span>
  );
}

/* Notifications (phone-style banners at the top) */
export type Toast = {
  id: string;
  title: string;
  body: string;
  meta?: string;
  tone?: 'danger' | 'info' | 'good';
  onClick?: () => void;
};

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(
    () => () => {
      for (const timer of timers.current.values()) {
        clearTimeout(timer);
      }
      timers.current.clear();
    },
    [],
  );
  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const push = useCallback(
    (toast: Toast) => {
      setToasts((current) => {
        if (current.some((item) => item.id === toast.id)) {
          return current;
        }
        // Keep the newest three banners visible without duplicating an existing one.
        return [toast, ...current].slice(0, 3);
      });
      clearTimeout(timers.current.get(toast.id));
      timers.current.set(
        toast.id,
        setTimeout(() => dismiss(toast.id), 8000),
      );
    },
    [dismiss],
  );
  return { toasts, push, dismiss };
}

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div className="fl-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />
      ))}
    </div>
  );
}

const SWIPE_AWAY_PX = 80;
const SWIPE_UP_PX = 40;

/** One banner. Tap it to open what it is about. Clear it by swiping it sideways or up (touch or mouse), or with
 *  the close button shown on wide screens. It also clears itself after a few seconds. */
function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: string) => void }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [leaving, setLeaving] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  // A drag must not also count as a tap on the banner.
  const dragged = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
      }
    },
    [],
  );

  const release = () => {
    if (!start.current) {
      return;
    }
    start.current = null;
    if (Math.abs(offset.x) > SWIPE_AWAY_PX || offset.y < -SWIPE_UP_PX) {
      // Carry on in the direction of the swipe, then remove it.
      setLeaving(true);
      setOffset({ x: Math.sign(offset.x) * 420, y: offset.y < -SWIPE_UP_PX ? -160 : 0 });
      leaveTimer.current = setTimeout(() => dismiss(toast.id), 180);
    } else {
      setOffset({ x: 0, y: 0 });
    }
  };

  const moving = offset.x !== 0 || offset.y !== 0;
  return (
    <div
      className="fl-toast"
      data-tone={toast.tone ?? 'info'}
      data-dragging={(moving && !leaving) || undefined}
      data-leaving={leaving || undefined}
      style={
        moving
          ? {
              transform: `translate(${offset.x}px, ${offset.y}px)`,
              opacity: Math.max(0, 1 - Math.max(Math.abs(offset.x) / 260, -offset.y / 130)),
            }
          : undefined
      }
      onPointerDown={(event) => {
        if (event.button !== 0 || leaving) {
          return;
        }
        start.current = { x: event.clientX, y: event.clientY };
        dragged.current = false;
      }}
      onPointerMove={(event) => {
        if (!start.current) {
          return;
        }
        const dx = event.clientX - start.current.x;
        const dy = event.clientY - start.current.y;
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6 && !dragged.current) {
          return;
        }
        dragged.current = true;
        // Follow the stronger direction only: sideways either way, or upwards.
        setOffset(Math.abs(dx) >= Math.abs(dy) ? { x: dx, y: 0 } : { x: 0, y: Math.min(0, dy) });
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
    >
      <button
        type="button"
        className="fl-toast-main"
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          toast.onClick?.();
          dismiss(toast.id);
        }}
      >
        <span className="fl-toast-icon">
          <FlareMark height={18} />
        </span>
        <span className="fl-toast-text">
          <span className="fl-toast-top">
            <b>{toast.title}</b>
            <i>now</i>
          </span>
          <span className="fl-toast-body">{toast.body}</span>
          {toast.meta && <span className="fl-toast-meta">{toast.meta}</span>}
        </span>
      </button>
      <button
        type="button"
        className="fl-toast-close"
        onClick={() => dismiss(toast.id)}
        aria-label={`Dismiss notification: ${toast.title}`}
        title="Dismiss"
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}

/* States */
export function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="fl-state" role={error ? 'alert' : 'status'}>
      {error ? (
        <>
          <strong>Could not load</strong>
          <p>{error}</p>
          <button type="button" className="fl-btn" onClick={onRetry}>
            Try again
          </button>
        </>
      ) : (
        <>
          <span className="fl-spinner" aria-hidden />
          <p>Loading…</p>
        </>
      )}
    </div>
  );
}

/**
 * Catches a render error anywhere below it, so one broken part shows a way back instead of a
 * blank page.
 */
export class Crash extends Component<{ children: ReactNode; label?: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('FLARE view crashed:', error);
  }
  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <div className="fl-state" role="alert">
        <strong>{this.props.label ?? 'This view'} stopped working</strong>
        <p>Nothing was lost. Reload to carry on.</p>
        <button type="button" className="fl-btn" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}

// FLARE showcase effect components (D2 demo). Original implementations of ideas from
// Aceternity UI's free component list: Spotlight card, Background Beams, Meteors, Flip Words,
// Text Generate, Moving Border, Multi Step Loader, Timeline, Floating Dock, Sparkles.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/utils.ts';
import './effects.css';

/** Card whose background lights up under the cursor (Card Spotlight idea). */
export function SpotlightCard({ className, children, color = 'rgba(244,63,94,0.18)' }: { className?: string; children: ReactNode; color?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        ref.current!.style.setProperty('--x', `${e.clientX - r.left}px`);
        ref.current!.style.setProperty('--y', `${e.clientY - r.top}px`);
      }}
      className={cn('group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 p-5', className)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(320px circle at var(--x) var(--y), ${color}, transparent 70%)` }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Animated light beams travelling along curved paths (Background Beams idea). */
export function BackgroundBeams({ className }: { className?: string }) {
  const paths = useMemo(
    () => Array.from({ length: 14 }, (_, i) => `M${-200 + i * 40} ${-80 + i * 12} C ${200 + i * 30} ${180 - i * 8}, ${500 + i * 20} ${120 + i * 14}, ${1100 + i * 10} ${520 - i * 6}`),
    [],
  );
  return (
    <svg className={cn('fx-beam pointer-events-none absolute inset-0 h-full w-full', className)} viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="beam" x1="0" x2="1">
          <stop offset="0" stopColor="#f43f5e" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fb7185" />
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </linearGradient>
      </defs>
      {paths.map((d, i) => (
        <g key={i}>
          <path d={d} stroke="#ffffff" strokeOpacity="0.04" fill="none" style={{ animation: 'none' }} />
          <path d={d} stroke="url(#beam)" strokeWidth="1.2" fill="none" style={{ animationDelay: `${-i * 0.6}s`, animationDuration: `${6 + (i % 4)}s` }} />
        </g>
      ))}
    </svg>
  );
}

/** Falling streaks (Meteors idea). Deterministic positions so renders are stable. */
export function Meteors({ count = 14 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="fx-meteor"
          style={{ top: `${(i * 37) % 40}%`, left: `${(i * 61) % 100}%`, animationDelay: `${(i * 0.73) % 6}s`, animationDuration: `${4 + (i % 5)}s` }}
        />
      ))}
    </>
  );
}

/** Twinkling dots (Sparkles idea). */
export function Sparkles({ count = 40, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0', className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="fx-twinkle absolute h-0.5 w-0.5 rounded-full bg-white"
          style={{ top: `${(i * 53) % 100}%`, left: `${(i * 29 + 7) % 100}%`, animationDuration: `${2 + (i % 4)}s`, animationDelay: `${(i % 7) * 0.3}s` }}
        />
      ))}
    </div>
  );
}

/** Cycles through words with a blur-slide transition (Flip Words idea). */
export function FlipWords({ words, interval = 2200, className }: { words: string[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);
  return (
    <span key={i} className={cn('fx-fade-up inline-block', className)}>
      {words[i]}
    </span>
  );
}

/** Reveals text word by word (Text Generate idea). */
export function TextGenerate({ text, className }: { text: string; className?: string }) {
  return (
    <p className={className}>
      {text.split(' ').map((w, i) => (
        <span key={i} className="fx-fade-up inline-block" style={{ animationDelay: `${i * 0.06}s` }}>
          {w}&nbsp;
        </span>
      ))}
    </p>
  );
}

/** Button with a rotating gradient border (Moving Border idea). */
export function MovingBorderButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={cn('fx-moving-border rounded-full disabled:opacity-50', className)}>
      <span className="block rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white">{children}</span>
    </button>
  );
}

/** Checklist that ticks off steps one by one (Multi Step Loader idea). */
export function MultiStepLoader({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={s} className={cn('flex items-center gap-3 text-sm transition', i <= current ? 'text-white' : 'text-white/35')}>
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full border text-[10px]',
              i < current ? 'border-emerald-400 bg-emerald-400 text-slate-950' : i === current ? 'border-rose-400 text-rose-300' : 'border-white/20',
            )}
          >
            {i < current ? '✓' : i === current ? '•' : ''}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
}

/** Vertical timeline with a progress rail (Timeline / Tracing Beam idea). */
export function Timeline({ items }: { items: { title: string; time?: string; body?: string; done: boolean; tone?: 'rose' | 'amber' | 'emerald' }[] }) {
  const doneCount = items.filter((x) => x.done).length;
  const pct = items.length > 1 ? ((Math.max(doneCount, 1) - 1) / (items.length - 1)) * 100 : 0;
  const tone = { rose: 'bg-rose-500', amber: 'bg-amber-400', emerald: 'bg-emerald-400' };
  return (
    <div className="relative pl-8">
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-white/10" />
      <div className="absolute left-[11px] top-2 w-0.5 bg-gradient-to-b from-rose-500 via-amber-400 to-emerald-400 transition-all duration-700" style={{ height: `calc(${pct}% - 8px)` }} />
      <ul className="space-y-6">
        {items.map((it) => (
          <li key={it.title} className={cn('relative transition', it.done ? 'opacity-100' : 'opacity-40')}>
            <span className={cn('absolute -left-8 top-1 h-6 w-6 rounded-full border-4 border-slate-950', it.done ? tone[it.tone ?? 'rose'] : 'bg-slate-700')} />
            <p className="font-semibold text-white">
              {it.title} {it.time && <span className="ml-2 text-xs font-normal text-white/50">{it.time}</span>}
            </p>
            {it.body && <p className="mt-1 text-sm text-white/60">{it.body}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Animated number that counts toward its value. */
export function Counter({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      setShown(Math.round(a + (value - a) * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{shown}</span>;
}

/** macOS-style dock that magnifies items near the cursor (Floating Dock idea). */
export function FloatingDock({ items, active }: { items: { href: string; label: string; icon: string }[]; active: string }) {
  const [mx, setMx] = useState<number | null>(null);
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  return (
    <nav
      aria-label="Showcase screens"
      onMouseMove={(e) => setMx(e.clientX)}
      onMouseLeave={() => setMx(null)}
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 shadow-2xl backdrop-blur-md"
    >
      {items.map((it, i) => {
        const el = refs.current[i];
        let scale = 1;
        if (mx !== null && el) {
          const r = el.getBoundingClientRect();
          const d = Math.abs(mx - (r.left + r.width / 2));
          scale = 1 + Math.max(0, 1 - d / 120) * 0.6;
        }
        const on = active === it.href;
        return (
          <a
            key={it.href}
            ref={(n) => {
              refs.current[i] = n;
            }}
            href={it.href}
            title={it.label}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'group relative flex h-10 w-10 origin-bottom items-center justify-center rounded-xl text-lg transition-transform duration-150',
              on ? 'bg-rose-500/90 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20',
            )}
            style={{ transform: `scale(${scale})` }}
          >
            <span aria-hidden>{it.icon}</span>
            <span className="pointer-events-none absolute -top-8 whitespace-nowrap rounded-md bg-slate-950 px-2 py-0.5 text-[11px] text-white opacity-0 transition group-hover:opacity-100">
              {it.label}
            </span>
          </a>
        );
      })}
    </nav>
  );
}

// /showcase router + gallery index (Focus Cards idea). D2 design preview, not yet approved.
import { useState } from 'react';
import { cn } from '../lib/utils.ts';
import Command from './Command.tsx';
import LiveMap from './LiveMap.tsx';
import Recovery from './Recovery.tsx';
import { SCREENS, Shell } from './Shell.tsx';
import SosFlow from './SosFlow.tsx';
import StormHero from './StormHero.tsx';

const ROUTES: Record<string, () => React.JSX.Element> = {
  '/showcase/storm': StormHero,
  '/showcase/map': LiveMap,
  '/showcase/command': Command,
  '/showcase/sos': SosFlow,
  '/showcase/recovery': Recovery,
};

const DESCRIPTIONS: Record<string, [string, string]> = {
  '/': ['Cloud hero', 'Bright landing page with the WebGL cloud sky and three-step cards.'],
  '/showcase/storm': ['Storm hero', 'Dark landing: beams, meteors, flip words, spotlight cards, live open-request count.'],
  '/showcase/map': ['Live ops map', 'Liveuamap-style schematic: pulsing SOS dots, zones, shelters, event feed. Polls every 2 s.'],
  '/showcase/command': ['Command centre', 'Bento dashboard with live counters, activity and supply gaps over an aurora.'],
  '/showcase/sos': ['SOS flow', 'Guided demo SOS with a step loader and a live status timeline. Real round trip.'],
  '/showcase/recovery': ['RecoveryGap', 'Focus cards for all four strategies, animated bars, engine text and optional AI summary.'],
};

export default function Showcase({ path }: { path: string }) {
  const Screen = ROUTES[path];
  return <Shell path={path}>{Screen ? <Screen /> : <Index />}</Shell>;
}

function Index() {
  const [hover, setHover] = useState<string | null>(null);
  const items = SCREENS.filter((s) => s.href !== '/showcase');
  return (
    <section className="mx-auto max-w-6xl px-4 pt-14">
      <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-300">Design preview</p>
      <h1 className="mt-2 text-3xl font-bold md:text-5xl">FLARE UI demos</h1>
      <p className="mt-3 max-w-2xl text-white/60">
        Original builds of ideas from Aceternity UI’s free components, wired to the live demo API. Nothing here is pushed until Sajid approves. Use the dock at the bottom to jump between screens.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onMouseLeave={() => setHover(null)}>
        {items.map((s) => {
          const [title, body] = DESCRIPTIONS[s.href];
          return (
            <a
              key={s.href}
              href={s.href}
              onMouseEnter={() => setHover(s.href)}
              className={cn(
                'group relative flex h-48 flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 p-5 transition duration-300',
                hover && hover !== s.href && 'scale-[0.98] opacity-50 blur-sm',
              )}
            >
              <span className="absolute right-4 top-3 text-5xl text-white/10 transition group-hover:text-rose-400/40">{s.icon}</span>
              <p className="text-lg font-semibold">{title}</p>
              <p className="mt-1 text-sm text-white/60">{body}</p>
            </a>
          );
        })}
      </div>
    </section>
  );
}

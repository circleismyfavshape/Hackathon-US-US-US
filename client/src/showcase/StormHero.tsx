// Screen: dark "storm" landing. Ideas: Spotlight, Background Beams, Meteors, Flip Words, Text Generate, Moving Border.
import { BackgroundBeams, FlipWords, Meteors, MovingBorderButton, SpotlightCard, TextGenerate } from './effects.tsx';
import { useLive } from './useLive.ts';

export default function StormHero() {
  const live = useLive();
  const open = live.sos.filter((s) => s.status !== 'resolved').length;
  return (
    <section className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-rose-600/25 blur-3xl" />
      <BackgroundBeams />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Meteors />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pt-24 text-center md:pt-32">
        <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
          SIMULATED Shah Alam flood · {open} open demo request{open === 1 ? '' : 's'}
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-7xl">
          <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">One request, from </span>
          <br className="hidden md:block" />
          <FlipWords words={['alert', 'SOS', 'response', 'recovery']} className="bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent" />
        </h1>
        <TextGenerate
          className="mx-auto mt-6 max-w-2xl text-base text-white/70 md:text-lg"
          text="FLARE links what citizens see, what responders do, and where limited supplies go, so a single SOS can be followed from the first alert to the last unmet need."
        />
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a href="/citizen">
            <MovingBorderButton type="button">Send a demo SOS</MovingBorderButton>
          </a>
          <a href="/responder" className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10">
            Open the control room
          </a>
        </div>
        <p className="mt-4 text-xs text-white/40">Hackathon demo · simulated data · no emergency service receives these requests</p>
      </div>

      <div className="relative mx-auto mt-20 grid max-w-6xl gap-4 px-4 md:grid-cols-3">
        {[
          ['Awareness', 'Source-labelled simulated incident, illustrative zones, fictional shelters. Never claims an area is safe.', 'rgba(56,189,248,0.18)'],
          ['Response', 'The citizen’s SOS lands in the responder queue with the same ID. Assign and resolve, and the citizen sees it live.', 'rgba(244,63,94,0.20)'],
          ['Recovery', 'Four allocation strategies for water, food and hygiene kits, with every shortage shown in units.', 'rgba(251,191,36,0.18)'],
        ].map(([t, b, c]) => (
          <SpotlightCard key={t} color={c}>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">{t}</p>
            <p className="mt-3 text-white/80">{b}</p>
          </SpotlightCard>
        ))}
      </div>
    </section>
  );
}

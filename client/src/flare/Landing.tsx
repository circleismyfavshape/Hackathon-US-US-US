// Home: what FLARE is, and one door into each of the three interfaces, with live figures.
import { ArrowUpRight } from 'lucide-react';
import { RESOURCES, useScenario, useSosList } from './data.ts';
import { Shell } from './ui.tsx';

export default function Landing() {
  const { scenario } = useScenario();
  const live = useSosList(4000);
  const open = live.list.filter((s) => s.status !== 'resolved').length;
  const rec = scenario?.recovery;
  const short = rec ? RESOURCES.reduce((n, r) => n + Math.max(0, rec.centres.reduce((m, c) => m + c.needs[r], 0) - rec.inventory[r]), 0) : null;

  const doors = [
    {
      n: '01', href: '/citizen', title: 'Citizen',
      body: 'See the incident and the depicted zones, check where you are, ask for help and watch the request move.',
      live: scenario ? `${scenario.incident.severity} severity · simulated` : '…',
    },
    {
      n: '02', href: '/responder', title: 'First responder',
      body: 'The same request arrives in a live queue and on the map. Assign a team, resolve it, and the citizen sees it.',
      live: live.at ? `${open} open request${open === 1 ? '' : 's'}` : '…',
    },
    {
      n: '03', href: '/recovery', title: 'RecoveryGap',
      body: 'Three relief centres, not enough stock. Compare four ways to split it and see exactly who goes short.',
      live: short === null ? '…' : `${short} units short`,
    },
  ];

  return (
    <Shell path="/">
      <main className="fl-page">
        <section className="fl-hero">
          <p className="fl-label">Disaster response and recovery · Shah Alam flood scenario</p>
          <h1 className="fl-h1">From the first alert<br />to the last <em style={{ fontStyle: 'normal', color: 'var(--flare-ink)' }}>unmet need.</em></h1>
          <p>
            Alerts, requests for help and relief supplies usually live in separate systems. FLARE keeps them on one line, so a single request can be followed from the person who sent it to the supplies that still have to reach them.
          </p>
        </section>

        <nav className="fl-index" aria-label="Open an interface">
          {doors.map((d) => (
            <a key={d.href} href={d.href}>
              <span className="fl-label">{d.n}</span>
              <h2>{d.title}</h2>
              <span className="fl-dim">{d.body}</span>
              <span className="fl-live">{d.live} <ArrowUpRight size={18} aria-hidden /></span>
            </a>
          ))}
        </nav>

        <section className="fl-flow" aria-label="How one request moves">
          {[
            ['Alert', 'A simulated flood with source-labelled zones and shelters.'],
            ['Request', 'A citizen sends a demo SOS and gets an ID back.'],
            ['Response', 'A responder assigns a team. The citizen sees it in seconds.'],
            ['Recovery', 'Scarce supplies are split, and every shortfall is shown.'],
          ].map(([t, b]) => (
            <div key={t}>
              <h3 className="fl-h3">{t}</h3>
              <p>{b}</p>
            </div>
          ))}
        </section>

        <footer className="fl-foot fl-label">
          <span>Hackathon demonstration. All data is simulated.</span>
          <span>No emergency service receives these requests.</span>
        </footer>
      </main>
    </Shell>
  );
}

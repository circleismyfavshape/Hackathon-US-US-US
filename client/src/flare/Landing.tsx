// Home: three doors, each with one live figure. Nothing else.
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
    { n: '01', href: '/citizen', title: 'Citizen', live: scenario ? `${scenario.incidents.length} flood areas` : '…' },
    { n: '02', href: '/responder', title: 'First responder', live: live.at ? `${open} open request${open === 1 ? '' : 's'}` : '…' },
    { n: '03', href: '/recovery', title: 'Recovery', live: short === null ? '…' : `${short} units short` },
  ];

  return (
    <Shell path="/">
      <main className="fl-page">
        <section className="fl-hero">
          <h1 className="fl-h1">From the first alert<br />to the last <em>unmet need.</em></h1>
        </section>
        <nav className="fl-index" aria-label="Open an interface">
          {doors.map((d) => (
            <a key={d.href} href={d.href}>
              <span className="fl-label">{d.n}</span>
              <h2>{d.title}</h2>
              <span className="fl-live">{d.live} <ArrowUpRight size={20} aria-hidden /></span>
            </a>
          ))}
        </nav>
      </main>
    </Shell>
  );
}

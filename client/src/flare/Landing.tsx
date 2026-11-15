// Home: a phone on its lock screen with one emergency alert. Opening the alert opens the citizen interface.
// The phone reuses the frame from Phone.tsx (.fl-phone), so the lock screen and the phone view are one device.
import { useEffect, useState } from 'react';
import { ChevronRight, TriangleAlert } from 'lucide-react';
import { areaName, useScenario } from './data.ts';
import { Shell } from './ui.tsx';

const W = 390;
const H = 844;
const TZ = 'Asia/Kuala_Lumpur';

/** A real phone opens the citizen page itself; a larger screen keeps the phone frame around it. */
const citizenHref = () => (window.innerWidth <= 860 ? '/citizen' : '/phone/citizen');

export default function Landing() {
  const { scenario } = useScenario();
  const [scale, setScale] = useState(1);
  const [now, setNow] = useState(() => new Date());
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 56 - 72) / (H + 24), (window.innerWidth - 48) / (W + 24)));
    fit();
    window.addEventListener('resize', fit);
    const t = setInterval(() => setNow(new Date()), 20_000);
    // Coming back with the browser's Back button must show the lock screen again, not the opened state.
    const reset = () => setOpening(false);
    window.addEventListener('pageshow', reset);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('pageshow', reset);
      clearInterval(t);
    };
  }, []);

  const clock = now.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', hour12: false, timeZone: TZ });
  const date = now.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });

  const incidents = scenario?.incidents ?? [];
  const worst = incidents.find((i) => i.severity === 'high') ?? incidents[0];
  const body = worst
    ? `Flooding reported in ${areaName(worst)}${incidents.length > 1 ? ` and ${incidents.length - 1} more area${incidents.length === 2 ? '' : 's'}` : ''}. Check your location and request help.`
    : 'Flooding reported near you. Check your location and request help.';

  const open = () => {
    if (opening) return;
    setOpening(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => (window.location.href = citizenHref()), reduced ? 0 : 420);
  };

  return (
    <Shell path="/">
      <main className="fl-page fl-lockpage">
        <section className="fl-hero">
          <h1 className="fl-h1">From the first alert<br />to the last <em>unmet need.</em></h1>
          <p>It starts with one alert on one phone. Open it to follow a request for help from the person who sends it to the supplies that still have to reach them.</p>
          <p className="fl-label fl-lockhint">Tap the alert on the phone <ChevronRight size={13} aria-hidden /></p>
        </section>

        <div className="fl-phone fl-lockphone" style={{ zoom: scale }}>
          <div className="fl-phone-screen fl-lock" data-opening={opening || undefined} style={{ width: W, height: H }}>
            <div className="fl-phone-status">
              <span>{clock}</span>
              <span>5G <i /></span>
            </div>
            <div className="fl-lock-time">
              <span className="fl-lock-date">{date}</span>
              <span className="fl-lock-clock">{clock}</span>
            </div>
            <button type="button" className="fl-lock-alert" onClick={open} data-testid="lock-alert" aria-label="Emergency flood alert. Open the citizen interface.">
              <span className="fl-lock-alert-top">
                <span className="fl-lock-alert-icon"><TriangleAlert size={17} aria-hidden /></span>
                <span className="fl-lock-alert-app">Emergency alert</span>
                <i>now</i>
              </span>
              <strong>EMERGENCY FLOOD</strong>
              <span className="fl-lock-alert-body">{body}</span>
              <span className="fl-lock-alert-meta">FLARE · Simulation · Tap to open</span>
            </button>
            <div className="fl-phone-home" />
          </div>
        </div>
      </main>
    </Shell>
  );
}

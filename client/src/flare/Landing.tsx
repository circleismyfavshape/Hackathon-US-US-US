// The front door: a phone on its lock screen with one emergency alert, because that is how it starts for a real
// person. FLARE has noticed the phone is inside a flood zone. Opening the alert opens the app on its emergency guide.
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, TriangleAlert } from 'lucide-react';
import { FlareLogo } from '../shared/Logo.tsx';
import { LEVEL_NAME, situationAt, useDemoLocation, useScenario } from './data.ts';
import { PHONE_H, PHONE_W, PhoneBody, useClock, usePhoneScale } from './Phone.tsx';
import { navigate } from './ui.tsx';
import './theme.css';

const TZ = 'Asia/Kuala_Lumpur';

export default function Landing() {
  const { scenario } = useScenario();
  const [, setLocation] = useDemoLocation(scenario);
  const scale = usePhoneScale(56 + 56);
  const clock = useClock();
  const [opening, setOpening] = useState(false);
  const date = new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });

  // The story always starts from the scenario's default place, which is inside a danger zone.
  const start = useMemo(() => {
    const place = scenario?.demoLocations.find((l) => l.id === scenario.defaultLocationId);
    return scenario && place ? situationAt(scenario, place) : null;
  }, [scenario]);

  // Coming back with the browser's Back button must show the lock screen again, not the opened state.
  useEffect(() => {
    const reset = () => setOpening(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  const body = start?.danger
    ? `You are in a ${LEVEL_NAME[start.danger.level].toLowerCase()} flood zone at ${start.danger.incident.area}. Open for what to do and the way to a safe zone.`
    : 'Flooding reported at your location. Open for what to do and the way to a safe zone.';

  const open = () => {
    if (opening) return;
    setOpening(true);
    if (start) setLocation(start.location.id);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(
      () => {
        setOpening(false);
        navigate('/phone/citizen');
      },
      reduced ? 0 : 420,
    );
  };

  return (
    <div className="fl-app fl-landing">
      <header className="fl-bar fl-bar-plain">
        <span className="fl-brand"><FlareLogo height={22} /></span>
        <div className="fl-bar-end">
          <span className="fl-simpill" role="note">Simulation</span>
        </div>
      </header>
      <main className="fl-lockpage">
        <section className="fl-intro">
          <span className="fl-eyebrow">Flood alerts that know where you are</span>
          <h1>When the water rises, FLARE tells you <em>what to do next.</em></h1>
          <p>
            FLARE watches your location. The moment you are inside a flood zone it alerts you, then shows only what matters: what to do now, who to call, and the way to the nearest safe zone.
          </p>
          <p className="fl-lockhint">Tap the alert on the phone <ChevronRight size={15} aria-hidden /></p>
        </section>

        <PhoneBody scale={scale} className="fl-lockphone">
          <div className="fl-phone-screen fl-lock" data-opening={opening || undefined} style={{ width: PHONE_W, height: PHONE_H }}>
            <div className="fl-phone-status">
              <span>{clock}</span>
              <span>5G <i /></span>
            </div>
            <div className="fl-lock-time">
              <span className="fl-lock-date">{date}</span>
              <span className="fl-lock-clock">{clock}</span>
            </div>
            <button type="button" className="fl-lock-alert" onClick={open} data-testid="lock-alert" aria-label="Emergency flood alert. Open the FLARE app.">
              <span className="fl-lock-alert-top">
                <span className="fl-lock-alert-icon"><TriangleAlert size={17} aria-hidden /></span>
                <span className="fl-lock-alert-app">FLARE · Emergency alert</span>
                <i>now</i>
              </span>
              <strong>EMERGENCY FLOOD</strong>
              <span className="fl-lock-alert-body">{body}</span>
              <span className="fl-lock-alert-meta">Simulation · Tap to open</span>
            </button>
            <div className="fl-phone-home" />
          </div>
        </PhoneBody>
      </main>
    </div>
  );
}

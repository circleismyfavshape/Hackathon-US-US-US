// Phone view: the citizen app (or the responder console) inside a phone frame at real phone size.
// It is the same
// live page in an iframe, so it scrolls and its notifications drop in at the top like push alerts.
// The switches for role, device and simulated location stay in the viewer bar, outside the phone.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PHONE_FEATURE_EVENT, PHONE_NOTES, type PhoneFeature } from './phoneNotes.ts';
import { clockMY, useDemoLocation, useScenario } from './data.ts';
import Citizen from './Citizen.tsx';
import Responder from './Responder.tsx';
import { EMBEDDED, Viewer, type Role } from './ui.tsx';

export const PHONE_W = 390;
export const PHONE_H = 844;
const STATUS = 46;

/** Fits the phone to the space under the viewer bar. */
export function usePhoneScale(reserve: number) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      const heightScale = (window.innerHeight - reserve) / (PHONE_H + 24);
      const widthScale = (window.innerWidth - 48) / (PHONE_W + 24);
      // Shrink to fit both dimensions, but keep the phone readable on short screens.
      setScale(Math.max(0.45, Math.min(1, heightScale, widthScale)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [reserve]);
  return scale;
}

/** The phone at a given scale. A transform (not CSS zoom) keeps clicks and the iframe's own layout exact;
 *  the outer box takes the scaled size so the page lays out around what is actually drawn. */
export function PhoneBody({
  scale,
  className,
  children,
}: {
  scale: number;
  className?: string;
  children: ReactNode;
}) {
  const w = PHONE_W + 24;
  const h = PHONE_H + 24;
  return (
    <div
      className={`fl-phone-fit${className ? ` ${className}` : ''}`}
      style={{ width: w * scale, height: h * scale }}
    >
      <div className="fl-phone" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return clockMY(now).replace(/^0/, '');
}

export default function Phone({ role }: { role: Role }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [feature, setFeature] = useState<PhoneFeature>(role === 'citizen' ? 'guide' : 'requests');
  const note = PHONE_NOTES[feature];
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.current?.contentWindow
      ) {
        return;
      }
      const data = event.data;
      if (data?.type === PHONE_FEATURE_EVENT && Object.hasOwn(PHONE_NOTES, data.feature)) {
        setFeature(data.feature as PhoneFeature);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  const { scenario } = useScenario();
  const [location, setLocation] = useDemoLocation(scenario);
  const scale = usePhoneScale(56 + 48);
  const clock = useClock();
  const [small, setSmall] = useState(() => window.innerWidth < 700);
  useEffect(() => {
    const sync = () => setSmall(window.innerWidth < 700);
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  // On a real phone (or already inside the frame) there is nothing to frame: show the page itself.
  if (small || EMBEDDED) {
    return role === 'citizen' ? <Citizen device="phone" /> : <Responder device="phone" />;
  }

  return (
    <Viewer
      role={role}
      device="phone"
      scenario={scenario}
      location={location}
      onLocation={setLocation}
    >
      <div className="fl-stage">
        <PhoneBody scale={scale}>
          <div className="fl-phone-screen" style={{ width: PHONE_W, height: PHONE_H }}>
            <div className="fl-phone-status">
              <span>{clock}</span>
              <span>
                5G <i />
              </span>
            </div>
            <iframe
              ref={frame}
              key={role}
              title={`FLARE ${role} app on a phone`}
              src={`/${role}`}
              width={PHONE_W}
              height={PHONE_H - STATUS}
              style={{ marginTop: STATUS }}
              allow="geolocation"
            />
            <div className="fl-phone-home" />
          </div>
        </PhoneBody>
        <aside className="fl-stage-note" aria-live="polite" data-testid="phone-feature-note">
          <span className="fl-note-label">
            {role === 'citizen' ? 'Citizen experience' : 'Responder experience'}
          </span>
          <strong>{note.title}</strong>
          <p>{note.body}</p>
          <ul>
            {note.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </aside>
      </div>
    </Viewer>
  );
}

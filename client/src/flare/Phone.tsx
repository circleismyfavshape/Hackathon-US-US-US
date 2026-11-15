// Phone view: the citizen or responder interface inside an iPhone frame, at real phone size.
// It is the same live page, so it scrolls, and notifications drop in from the top like push alerts.
import { useEffect, useState } from 'react';
import { Shell } from './ui.tsx';

const W = 390;
const H = 844;
const STATUS = 46;

export default function Phone({ which }: { which: 'citizen' | 'responder' }) {
  const [scale, setScale] = useState(1);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 56 - 100) / (H + 24)));
    fit();
    window.addEventListener('resize', fit);
    const t = setInterval(() => setNow(new Date()), 20_000);
    return () => {
      window.removeEventListener('resize', fit);
      clearInterval(t);
    };
  }, []);
  const clock = now.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', hour12: false, timeZone: 'Asia/Kuala_Lumpur' });

  return (
    <Shell path={`/phone/${which}`}>
      <div className="fl-phonepage">
        <div className="fl-seg" role="group" aria-label="Phone view" style={{ width: 300 }}>
          <button type="button" aria-pressed={which === 'citizen'} onClick={() => (window.location.href = '/phone/citizen')}>Citizen</button>
          <button type="button" aria-pressed={which === 'responder'} onClick={() => (window.location.href = '/phone/responder')}>First responder</button>
        </div>
        <div className="fl-phone" style={{ zoom: scale }}>
          <div className="fl-phone-screen" style={{ width: W, height: H }}>
            <div className="fl-phone-status">
              <span>{clock}</span>
              <span>5G <i /></span>
            </div>
            <iframe title={`FLARE ${which} on a phone`} src={`/${which}`} width={W} height={H - STATUS} style={{ marginTop: STATUS }} allow="geolocation" />
            <div className="fl-phone-home" />
          </div>
        </div>
      </div>
    </Shell>
  );
}

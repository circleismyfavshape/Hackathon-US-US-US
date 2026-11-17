// Routes only.
//   /                  the lock-screen alert
//   /phone/citizen     the citizen app in a phone frame (where the alert leads)
//   /citizen           the citizen app on a wide screen
//   /phone/responder   the responder console in a phone frame
//   /responder         the responder console on a wide screen
import { useEffect } from 'react';
import Citizen from './flare/Citizen.tsx';
import Landing from './flare/Landing.tsx';
import Phone from './flare/Phone.tsx';
import Responder from './flare/Responder.tsx';
import { Crash, usePath } from './flare/ui.tsx';

const KNOWN = new Set(['/', '/citizen', '/responder', '/phone/citizen', '/phone/responder']);

function pageForPath(path: string) {
  switch (path) {
    case '/citizen':
      return <Citizen device="desktop" />;
    case '/responder':
      return <Responder device="desktop" />;
    case '/phone/citizen':
      return <Phone role="citizen" />;
    case '/phone/responder':
      return <Phone role="responder" />;
    default:
      return <Landing />;
  }
}

export default function App() {
  const path = usePath();
  // Old links (for example /recovery, which was removed) land on the front door instead of a blank
  // page.
  useEffect(() => {
    if (!KNOWN.has(path)) {
      window.history.replaceState(null, '', '/');
    }
  }, [path]);

  return (
    // Keyed by path: each view starts clean, so nothing from the last one can break the next.
    <Crash key={path} label="FLARE">
      {pageForPath(path)}
    </Crash>
  );
}

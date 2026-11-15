// OWNER: D2. Routes only. Every route renders the shared FLARE shell (client/src/flare/ui.tsx),
// which carries the navigation and the persistent simulation label on every view.
import Citizen from './flare/Citizen.tsx';
import Landing from './flare/Landing.tsx';
import Phone from './flare/Phone.tsx';
import Recovery from './flare/Recovery.tsx';
import Responder from './flare/Responder.tsx';

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/citizen') return <Citizen />;
  if (path === '/responder') return <Responder />;
  if (path === '/recovery') return <Recovery />;
  if (path === '/phone/citizen') return <Phone which="citizen" />;
  if (path === '/phone/responder') return <Phone which="responder" />;
  if (path === '/phone/recovery') return <Phone which="recovery" />;
  return <Landing />;
}

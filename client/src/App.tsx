// OWNER: D2 — routes only. Feature code lives in features/citizen (D1) and features/responder (D3).
import FlareHero from './components/FlareHero.tsx';
import CitizenPage from './features/citizen/CitizenPage.tsx';
import ResponderPage from './features/responder/ResponderPage.tsx';
import Showcase from './showcase/Showcase.tsx';
import { DemoBanner } from './shared/DemoBanner.tsx';

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  return (
    <>
      <DemoBanner />
      {path === '/citizen' ? <CitizenPage /> : path === '/responder' ? <ResponderPage /> : path.startsWith('/showcase') ? <Showcase path={path} /> : <FlareHero />}
    </>
  );
}

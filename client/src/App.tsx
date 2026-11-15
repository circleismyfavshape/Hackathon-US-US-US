// OWNER: D2 — routes only. Feature code lives in features/citizen (D1) and features/responder (D3).
import CitizenPage from './features/citizen/CitizenPage.tsx';
import ResponderPage from './features/responder/ResponderPage.tsx';
import { DemoBanner } from './shared/DemoBanner.tsx';
import { FlareLogo } from './shared/Logo.tsx';

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  return (
    <>
      <DemoBanner />
      {path === '/citizen' ? <CitizenPage /> : path === '/responder' ? <ResponderPage /> : <Home />}
    </>
  );
}

function Home() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1>
        <FlareLogo height={56} className="text-neutral-900" />
      </h1>
      <p className="mt-1 text-slate-600">From Disaster Response to Recovery.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a className="rounded-lg border bg-white p-4 font-medium shadow-sm hover:bg-slate-100" href="/citizen">
          Citizen portal →
        </a>
        <a className="rounded-lg border bg-white p-4 font-medium shadow-sm hover:bg-slate-100" href="/responder">
          Responder portal →
        </a>
      </div>
    </main>
  );
}

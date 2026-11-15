// OWNER: D1. Polls GET /api/sos/:id every 2.5 s until resolved. Statuses come only from the backend.
import { useEffect, useState } from 'react';
import { api, ApiRequestError, poll, type Sos, type SosStatus } from '../../shared/api.ts';
import { SOS_DISCLAIMER } from '../../shared/DemoBanner.tsx';

const STATUS: Record<SosStatus, { title: string; tone: string }> = {
  pending: { title: 'Waiting for a responder', tone: 'border-amber-400 bg-amber-50 text-amber-950' },
  assigned: { title: 'A demo team is assigned', tone: 'border-sky-500 bg-sky-50 text-sky-950' },
  resolved: { title: 'Marked resolved', tone: 'border-emerald-500 bg-emerald-50 text-emerald-950' },
};

type Props = { sos: Sos; onUpdate: (sos: Sos) => void; onGone: () => void; onNew: () => void };

export function SosTracker({ sos, onUpdate, onGone, onNew }: Props) {
  const [offline, setOffline] = useState(false);
  const done = sos.status === 'resolved';

  useEffect(() => {
    if (done) return;
    return poll(async () => {
      try {
        onUpdate(await api.getSos(sos.id));
        setOffline(false);
      } catch (e) {
        if (e instanceof ApiRequestError && e.status === 404) onGone();
        else setOffline(true);
      }
    });
  }, [sos.id, done, onUpdate, onGone]);

  const s = STATUS[sos.status];
  return (
    <section aria-label="Your SOS request" className="space-y-3">
      <div className={`rounded-lg border-2 p-4 ${s.tone}`}>
        <p className="text-xs">Request ID</p>
        <p className="font-mono text-lg font-semibold" data-testid="sos-id">
          {sos.id}
        </p>
        <p role="status" aria-live="polite" className="mt-2 text-base font-semibold" data-testid="sos-status" data-status={sos.status}>
          {s.title}
          {sos.status === 'assigned' && sos.assignedTeam ? `: ${sos.assignedTeam}` : ''}
        </p>
        <p className="mt-1 text-sm">{done ? 'Updates stopped. This request is closed.' : 'This page updates by itself. No need to reload.'}</p>
      </div>

      {offline && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Cannot reach the server. Showing the last known status. Retrying.
        </p>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-600">People</dt>
        <dd>{sos.people}</dd>
        <dt className="text-slate-600">Type</dt>
        <dd>{sos.type}</dd>
        <dt className="text-slate-600">Details</dt>
        <dd className="break-words">{sos.description}</dd>
        <dt className="text-slate-600">Sent</dt>
        <dd>{new Date(sos.createdAt).toLocaleTimeString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}</dd>
      </dl>

      <p className="text-xs text-slate-600">{SOS_DISCLAIMER}</p>
      <button type="button" onClick={onNew} className="rounded-md border border-slate-400 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100">
        Send a new request
      </button>
    </section>
  );
}

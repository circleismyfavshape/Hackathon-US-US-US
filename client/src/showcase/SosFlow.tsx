// Screen: guided citizen SOS. Ideas: Moving Border button, Multi Step Loader, Stateful Button, Timeline.
// Real round trip: POST /api/sos, then polls GET /api/sos/:id. Location is a demo point only.
import { useEffect, useState } from 'react';
import { api, poll, type Sos, type SosType } from '../shared/api.ts';
import { cn } from '../lib/utils.ts';
import { MovingBorderButton, MultiStepLoader, Sparkles, Timeline } from './effects.tsx';
import { myt, useLive } from './useLive.ts';

const STEPS = ['Checking the form', 'Sending to the demo backend', 'Request ID issued', 'Visible in the responder queue'];
const TYPE_LABEL: Record<SosType, string> = { trapped: 'Trapped', 'medical-help': 'Medical help', supplies: 'Supplies', other: 'Other' };
const SOS_TYPES = Object.keys(TYPE_LABEL) as SosType[];

export default function SosFlow() {
  const live = useLive(5000);
  const [type, setType] = useState<SosType>('trapped');
  const [people, setPeople] = useState(3);
  const [desc, setDesc] = useState('Three people waiting upstairs, water rising (demo)');
  const [loc, setLoc] = useState('L1');
  const [step, setStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [sos, setSos] = useState<Sos | null>(null);

  useEffect(() => {
    if (!sos) return;
    return poll(async () => {
      try {
        setSos(await api.getSos(sos.id));
      } catch {
        /* keep last known state; the timeline shows it */
      }
    });
  }, [sos?.id]);

  async function send() {
    const point = live.config?.demoLocations.find((l) => l.id === loc);
    if (!live.incident || !point) return;
    setError(null);
    const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
    try {
      setStep(0);
      await pause(450);
      setStep(1);
      const created = await api.createSos({ incidentId: live.incident.id, people, type, description: desc, location: point.location, locationMode: 'manual-demo' });
      setStep(2);
      await pause(450);
      setStep(3);
      await pause(450);
      setStep(4);
      setSos(created);
    } catch (e) {
      setError((e as Error).message);
      setStep(-1);
    }
  }

  const sending = step >= 0 && step < 4;
  return (
    <section className="relative isolate mx-auto grid max-w-6xl gap-8 px-4 pt-14 lg:grid-cols-2">
      <Sparkles className="-z-10 opacity-60" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-300">Citizen · demo SOS</p>
        <h1 className="mt-2 text-3xl font-bold md:text-5xl">Ask for help in three taps</h1>
        <p className="mt-3 text-white/60">This is a simulation. No real responder or emergency service receives your request. Do not enter names, phone numbers or addresses.</p>

        <fieldset disabled={!!sos || sending} className="mt-8 space-y-6">
          <div>
            <legend className="text-sm text-white/60">What do you need?</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SOS_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn('rounded-xl border px-3 py-3 text-sm transition', type === t ? 'border-rose-400 bg-rose-500/15 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10')}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <label className="text-sm text-white/60">
              People
              <div className="mt-2 flex items-center rounded-xl border border-white/10 bg-white/5">
                <button type="button" onClick={() => setPeople((p) => Math.max(1, p - 1))} className="px-3 py-2 text-lg">−</button>
                <span className="flex-1 text-center text-lg font-semibold text-white tabular-nums">{people}</span>
                <button type="button" onClick={() => setPeople((p) => Math.min(50, p + 1))} className="px-3 py-2 text-lg">+</button>
              </div>
            </label>
            <label className="text-sm text-white/60">
              Where are you? (demo points only)
              <select value={loc} onChange={(e) => setLoc(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-white">
                {live.config?.demoLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.id} · {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm text-white/60">
            What is happening? <span className="text-white/35">({desc.length}/280)</span>
            <textarea value={desc} maxLength={280} onChange={(e) => setDesc(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white" />
          </label>

          <MovingBorderButton type="button" onClick={send} disabled={!desc.trim() || !live.incident}>
            {sending ? 'Sending…' : sos ? 'Sent ✓' : 'Send demo SOS'}
          </MovingBorderButton>
          {error && <p role="alert" className="text-sm text-rose-300">Could not send: {error}</p>}
        </fieldset>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="mb-4 text-sm text-white/60">Delivery</p>
          <MultiStepLoader steps={STEPS} current={step < 0 ? -1 : step} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-white/60">Live status</p>
            {sos && <span className="font-mono text-xs text-white/70">{sos.id}</span>}
          </div>
          <Timeline
            items={[
              { title: 'Received', time: sos ? myt(sos.createdAt) : undefined, body: 'Pending. The responder queue shows the same ID.', done: !!sos, tone: 'rose' },
              { title: 'Demo team assigned', time: sos?.status !== 'pending' && sos ? myt(sos.updatedAt) : undefined, body: sos?.assignedTeam ?? 'Waiting for a responder in /responder.', done: !!sos && sos.status !== 'pending', tone: 'amber' },
              { title: 'Resolved', time: sos?.status === 'resolved' ? myt(sos.updatedAt) : undefined, body: 'Marked resolved by the demo responder.', done: sos?.status === 'resolved', tone: 'emerald' },
            ]}
          />
          {sos && (
            <div className="mt-6 flex gap-2 text-sm">
              <a href="/responder" target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/10">
                Open responder in new tab ↗
              </a>
              <button type="button" onClick={() => { setSos(null); setStep(-1); }} className="rounded-full px-4 py-2 text-white/60 hover:text-white">
                New request
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// OWNER: D1. SOS form -> POST /api/sos. Field limits mirror the server rules in API_CONTRACT.md.
import { useState, type FormEvent } from 'react';
import { SOS_TYPES } from '../../../../contracts/types.ts';
import { api, type LatLng, type LocationMode, type Sos, type SosType } from '../../shared/api.ts';
import { SOS_DISCLAIMER } from '../../shared/DemoBanner.tsx';

const TYPE_LABEL: Record<SosType, string> = {
  trapped: 'Trapped',
  'medical-help': 'Medical help',
  supplies: 'Supplies',
  other: 'Other',
};
const MAX_DESC = 280;

type Props = {
  incidentId: string;
  location: (LatLng & { mode: LocationMode }) | null;
  onCreated: (sos: Sos) => void;
};

export function SosForm({ incidentId, location, onCreated }: Props) {
  const [people, setPeople] = useState('1');
  const [type, setType] = useState<SosType>('trapped');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = Number(people);
  const countOk = Number.isInteger(count) && count >= 1 && count <= 50;
  const text = description.trim();
  const valid = countOk && text.length >= 1 && text.length <= MAX_DESC && location !== null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      onCreated(
        await api.createSos({
          incidentId,
          people: count,
          type,
          description: text,
          location: { lat: location.lat, lng: location.lng },
          locationMode: location.mode,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  }

  const field = 'mt-1 w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-base';
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          People who need help
          <input type="number" inputMode="numeric" min={1} max={50} step={1} value={people} onChange={(e) => setPeople(e.target.value)} aria-invalid={!countOk} aria-describedby="people-hint" className={field} />
          <span id="people-hint" className={`mt-1 block text-xs font-normal ${countOk ? 'text-slate-600' : 'text-red-700'}`}>
            A whole number from 1 to 50.
          </span>
        </label>
        <label className="block text-sm font-medium">
          Type of help
          <select value={type} onChange={(e) => setType(e.target.value as SosType)} className={field}>
            {SOS_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium">
        What is happening
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={MAX_DESC} rows={3} aria-describedby="desc-hint" className={field} />
        <span id="desc-hint" className="mt-1 flex justify-between gap-3 text-xs font-normal text-slate-600">
          <span>No names, phone numbers or addresses.</span>
          <span>
            {text.length}/{MAX_DESC}
          </span>
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div>
        <button type="submit" disabled={!valid || busy} className="w-full rounded-md bg-red-700 px-4 py-3 text-base font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto">
          {busy ? 'Sending…' : 'Send demo SOS'}
        </button>
        {!valid && !busy && <p className="mt-2 text-xs text-slate-600">{location === null ? 'Choose a location first.' : 'Describe what is happening to enable sending.'}</p>}
        <p className="mt-2 text-xs text-slate-600">{SOS_DISCLAIMER}</p>
      </div>
    </form>
  );
}

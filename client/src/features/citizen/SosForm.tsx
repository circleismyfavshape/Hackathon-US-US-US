// OWNER: D1. SOS form -> POST /api/sos. Field limits mirror the server rules in API_CONTRACT.md.
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/arc/alert/alert';
import { Button } from '@/components/arc/button/button';
import { NumberField } from '@/components/arc/number-field/number-field';
import { RadioCards } from '@/components/arc/radio-cards/radio-cards';
import { Textarea } from '@/components/arc/textarea/textarea';
import { SOS_TYPES } from '../../../../contracts/types.ts';
import { api, type LatLng, type LocationMode, type Sos, type SosType } from '../../shared/api.ts';
import { SOS_DISCLAIMER } from '../../shared/DemoBanner.tsx';
import styles from './citizen.module.css';

const TYPE_OPTIONS: Record<SosType, { label: string; description: string }> = {
  trapped: { label: 'Trapped', description: 'Cannot get out' },
  'medical-help': { label: 'Medical help', description: 'Someone is hurt or ill' },
  supplies: { label: 'Supplies', description: 'Water, food, essentials' },
  other: { label: 'Other', description: 'Something else' },
};
const MAX_DESC = 280;

type Props = {
  incidentId: string;
  location: (LatLng & { mode: LocationMode }) | null;
  onCreated: (sos: Sos) => void;
};

export function SosForm({ incidentId, location, onCreated }: Props) {
  const [people, setPeople] = useState(1);
  const [type, setType] = useState<SosType>('trapped');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text = description.trim();
  const valid = Number.isInteger(people) && people >= 1 && people <= 50 && text.length >= 1 && text.length <= MAX_DESC && location !== null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      onCreated(
        await api.createSos({
          incidentId,
          people,
          type,
          description: text,
          location: { lat: location.lat, lng: location.lng },
          locationMode: location.mode,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={styles.group} noValidate>
      <h3 className={styles.stepTitle}>What do you need?</h3>
      <div className={styles.fields}>
        <NumberField label="People who need help" description="A whole number from 1 to 50." value={people} onValueChange={setPeople} min={1} max={50} step={1} />
        <div className={styles.group} style={{ gap: 8 }}>
          <span id="type-label" className={styles.status} style={{ fontWeight: 500 }}>
            Type of help
          </span>
          <RadioCards
            aria-labelledby="type-label"
            name="sos-type"
            layout="grid"
            minColumnWidth={160}
            value={type}
            onValueChange={(v) => setType(v as SosType)}
            options={SOS_TYPES.map((t) => ({ value: t, label: TYPE_OPTIONS[t].label, description: TYPE_OPTIONS[t].description }))}
          />
        </div>
        <Textarea
          label="What is happening"
          description={`No names, phone numbers or addresses. ${text.length} of ${MAX_DESC} characters.`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_DESC}
          rows={3}
        />
      </div>

      <Alert tone="danger" title="We could not send your request" open={error !== null}>
        {error}
      </Alert>

      <div className={styles.submitRow}>
        <Button type="submit" loading={busy} disabled={!valid}>
          Send demo SOS
        </Button>
        {!valid && !busy && location !== null && <p className={styles.fine}>Describe what is happening to enable sending.</p>}
        <p className={styles.fine}>{SOS_DISCLAIMER}</p>
      </div>
    </form>
  );
}

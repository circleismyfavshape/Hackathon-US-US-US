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
    <form onSubmit={submit} className={styles.group} style={{ gap: 12 }} noValidate>
      <div className={styles.group} style={{ gap: 6 }}>
        <p className={styles.fieldLabel} id="type-label">
          Type of help
        </p>
        <RadioCards
          aria-labelledby="type-label"
          name="sos-type"
          layout="grid"
          minColumnWidth={140}
          value={type}
          onValueChange={(v) => setType(v as SosType)}
          options={SOS_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
        />
      </div>

      <div className={`${styles.group} ${styles.field}`} style={{ gap: 4 }}>
        <Textarea label="What is happening" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={MAX_DESC} rows={2} />
        <p className={styles.hint}>No names, phone numbers or addresses.</p>
      </div>

      <Alert tone="danger" title="We could not send your request" open={error !== null}>
        {error}
      </Alert>

      <div className={styles.sendRow}>
        <div className={styles.field}>
          <NumberField label="People" value={people} onValueChange={setPeople} min={1} max={50} step={1} size="sm" />
        </div>
        <Button type="submit" loading={busy} disabled={!valid}>
          Send demo SOS
        </Button>
      </div>
      <p className={styles.fine}>{SOS_DISCLAIMER}</p>
    </form>
  );
}

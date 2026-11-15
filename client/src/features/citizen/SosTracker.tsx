// OWNER: D1. Polls GET /api/sos/:id every 2.5 s until resolved. Statuses come only from the backend.
import { useEffect, useState } from 'react';
import { Alert, type AlertTone } from '@/components/arc/alert/alert';
import { Button } from '@/components/arc/button/button';
import { api, ApiRequestError, poll, type Sos, type SosStatus } from '../../shared/api.ts';
import { SOS_DISCLAIMER } from '../../shared/DemoBanner.tsx';
import styles from './citizen.module.css';

const STATUS: Record<SosStatus, { title: string; tone: AlertTone }> = {
  pending: { title: 'Waiting for a responder', tone: 'warning' },
  assigned: { title: 'A demo team is assigned', tone: 'info' },
  resolved: { title: 'Marked resolved', tone: 'success' },
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
  const team = sos.status === 'assigned' && sos.assignedTeam ? `: ${sos.assignedTeam}` : '';
  return (
    <section aria-label="Your SOS request" className={styles.tracker}>
      <div>
        <span className={styles.hint}>Request ID</span>
        <div className={styles.requestIdValue} data-testid="sos-id">
          {sos.id}
        </div>
      </div>

      <Alert tone={s.tone} title={`${s.title}${team}`} data-testid="sos-status" data-status={sos.status} />

      <Alert tone="warning" title="Cannot reach the server" open={offline}>
        Showing the last known status. Retrying.
      </Alert>

      <dl className={styles.details}>
        <dt>People</dt>
        <dd>{sos.people}</dd>
        <dt>Type</dt>
        <dd>{sos.type}</dd>
        <dt>Details</dt>
        <dd>{sos.description}</dd>
      </dl>

      <p className={styles.fine}>{SOS_DISCLAIMER}</p>
      <div>
        <Button variant="secondary" size="sm" onClick={onNew}>
          Send a new request
        </Button>
      </div>
    </section>
  );
}

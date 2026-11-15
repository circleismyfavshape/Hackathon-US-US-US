// OWNER: D1. The floating panels around the map: incident, live bar, and the pieces they share.
import { useMemo } from 'react';
import { Badge } from '@/components/arc/badge/badge';
import { ScrollArea } from '@/components/arc/scroll-area/scroll-area';
import type { Incident, Shelter } from '../../shared/api.ts';
import { countByStatus } from './geo.ts';
import type { Live } from './useLiveSos.ts';
import { ZONE_SHORT } from './zone.ts';
import styles from './citizen.module.css';

const STATUS_LABEL = { pending: 'Pending', assigned: 'Assigned', resolved: 'Resolved' } as const;

export function ZoneLegend({ incident }: { incident: Incident }) {
  return (
    <ul className={styles.legend} aria-label="Map legend">
      {incident.zones.map((z) => (
        <li key={z.id}>
          <span aria-hidden className={`${styles.swatch} ${z.level === 'high' ? styles.swatchHigh : styles.swatchModerate}`} />
          {ZONE_SHORT[z.level]}
        </li>
      ))}
      <li>
        <span aria-hidden className={`${styles.swatch} ${styles.swatchShelter}`} />
        Shelter
      </li>
    </ul>
  );
}

export function LiveCounts({ live }: { live: Live }) {
  const counts = useMemo(() => countByStatus(live.requests), [live.requests]);
  return (
    <div className={styles.liveRow}>
      <Badge tone={live.ok ? 'success' : 'warning'} size="sm">
        {live.ok ? 'Live' : 'Paused'}
      </Badge>
      <ul className={styles.liveCounts} aria-label="Demo help requests on the map">
        {(['pending', 'assigned', 'resolved'] as const).map((s) => (
          <li key={s}>
            <span aria-hidden className={`${styles.dotKey} ${styles[s]}`} />
            {STATUS_LABEL[s]} <span className={styles.count}>{counts[s]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IncidentPanel({ incident, shelters, live }: { incident: Incident; shelters: Shelter[]; live: Live }) {
  return (
    <header className={`${styles.panel} ${styles.incident}`}>
      <div className={styles.headerTop}>
        <h1 className={styles.title}>{incident.title}</h1>
        <Badge tone="danger" size="sm">
          Severity: {incident.severity}
        </Badge>
      </div>
      <p className={styles.meta}>{incident.sourceLabel}</p>
      <div className={styles.countsMobile}>
        <LiveCounts live={live} />
      </div>
      <details className={styles.about}>
        <summary>Details and shelters</summary>
        <ScrollArea maxHeight="40dvh" label="Incident details">
          <div className={styles.aboutBody}>
            <ul className={styles.guidance}>
              {incident.guidance.map((g) => (
                <li key={g}>{g}</li>
              ))}
              <li>Updated {new Date(incident.updatedAt).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' })} MYT.</li>
            </ul>
            <div className={styles.legendInAbout}>
              <ZoneLegend incident={incident} />
            </div>
            <ul className={styles.shelters} aria-label="Shelters">
              {shelters.map((s) => (
                <li key={s.id} className={styles.shelter}>
                  <span className={styles.shelterName}>{s.name}</span>
                  <span className={styles.hint}>{s.sourceLabel}. No route is suggested.</span>
                </li>
              ))}
            </ul>
          </div>
        </ScrollArea>
      </details>
    </header>
  );
}

export function LivePanel({ incident, live, reachable }: { incident: Incident; live: Live; reachable: boolean | null }) {
  return (
    <section className={`${styles.panel} ${styles.live}`} aria-label="Live status and legend">
      <LiveCounts live={live} />
      <ZoneLegend incident={incident} />
      <p className={styles.caption} role={reachable === false || !live.ok ? 'status' : undefined}>
        {reachable === false && 'Basemap offline. '}
        {!live.ok && 'Live updates paused. '}
        Illustrative zones. Outside them is not verified safe.
      </p>
    </section>
  );
}

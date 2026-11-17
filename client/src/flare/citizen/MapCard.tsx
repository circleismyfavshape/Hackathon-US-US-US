// The route or area summary shown over the citizen map.

import { MapPin } from 'lucide-react';
import { metres } from '../../features/citizen/geo.ts';
import type { Scenario } from '../../shared/api.ts';
import { LEVEL_NAME, SEVERITY_NAME, type Situation } from '../data.ts';

type MapCardProps = {
  scenario: Scenario;
  situation: Situation;
  focusId: string | null;
  destination: Situation['options'][number] | null;
  onBack: () => void;
  onAll: () => void;
  onPick: (id: string) => void;
};

export function MapCard({
  scenario,
  situation,
  focusId,
  destination,
  onBack,
  onAll,
  onPick,
}: MapCardProps) {
  const currentAreaId = situation.danger?.incident.id ?? situation.location.incidentId;
  const focus = scenario.incidents.find((incident) => incident.id === focusId) ?? null;
  if (focusId !== currentAreaId) {
    return (
      <div className="fl-mapcard">
        <div className="fl-mapcard-text">
          <strong>{focus ? focus.area : 'All flood areas'}</strong>
          <small>
            {focus
              ? `${SEVERITY_NAME[focus.severity]} · ${focus.summary}`
              : 'Tap an area on the map to look closer.'}
          </small>
        </div>
        <button type="button" className="fl-btn fl-btn-sm" onClick={onBack}>
          <MapPin size={14} aria-hidden /> My location
        </button>
      </div>
    );
  }
  return (
    <div className="fl-mapcard">
      <div className="fl-mapcard-text">
        {destination ? (
          <>
            <strong>{destination.shelter.name}</strong>
            <small>
              <b>{destination.minutes} min walk</b> · {metres(destination.distanceM)} ·{' '}
              {destination.shelter.note}
              <span className="fl-route-warning">
                Route does not avoid floods or marked closures. Access is not verified.
              </span>
            </small>
          </>
        ) : (
          <>
            <strong>{focus?.area ?? situation.location.label}</strong>
            <small>
              {situation.danger
                ? `${LEVEL_NAME[situation.danger.level]} · ${situation.danger.zone.depth}`
                : 'You are outside the marked flood zones.'}
            </small>
          </>
        )}
      </div>
      <div className="fl-mapcard-actions">
        {destination && situation.options.length > 1 && (
          <div className="fl-pills" role="group" aria-label="Safe zones">
            {situation.options.map((option) => (
              <button
                key={option.shelter.id}
                type="button"
                aria-pressed={option.shelter.id === destination.shelter.id}
                onClick={() => onPick(option.shelter.id)}
              >
                {option.minutes} min
              </button>
            ))}
          </div>
        )}
        <button type="button" className="fl-btn fl-btn-sm fl-btn-ghost" onClick={onAll}>
          All areas
        </button>
      </div>
    </div>
  );
}

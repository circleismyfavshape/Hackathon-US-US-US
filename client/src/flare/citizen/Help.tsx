// The help form and the progress of the citizen's current demo request.
import { useState } from 'react';
import {
  Check,
  LifeBuoy,
  MapPin,
  Minus,
  Package,
  Phone as PhoneIcon,
  Plus,
  Stethoscope,
  Waves,
} from 'lucide-react';
import { nearest } from '../../features/citizen/geo.ts';
import { api, type Scenario, type Sos, type SosType } from '../../shared/api.ts';
import { ago, clockMY, errText, LEVEL_NAME, useNow, type Situation } from '../data.ts';
import { Avatar, useProfile } from '../profile.tsx';
import { LevelTag, STATUS_LABEL, TYPE_LABEL } from '../ui.tsx';

const NEEDS: { type: SosType; label: string; Icon: typeof Waves }[] = [
  { type: 'trapped', label: 'Trapped', Icon: Waves },
  { type: 'medical-help', label: 'Medical', Icon: Stethoscope },
  { type: 'supplies', label: 'Supplies', Icon: Package },
  { type: 'other', label: 'Other', Icon: LifeBuoy },
];
const STEPS = ['pending', 'assigned', 'resolved'] as const;

function requestMessage(request: Sos): string {
  switch (request.status) {
    case 'assigned':
      return `${request.assignedTeam} has your location.`;
    case 'resolved':
      return `Closed by ${request.assignedTeam ?? 'the responders'}.`;
    default:
      return 'The responders can see your request and location.';
  }
}

function timelineDetail(request: Sos, stepIndex: number, currentStep: number, now: number): string {
  if (stepIndex === 0) {
    return `${clockMY(request.createdAt)} · ${ago(request.createdAt, now)}`;
  }
  if (stepIndex === currentStep) {
    let detail = clockMY(request.updatedAt);
    if (stepIndex === 1 && request.assignedTeam) {
      detail += ` · ${request.assignedTeam}`;
    }
    return detail;
  }
  return stepIndex < currentStep ? 'Done' : 'Waiting';
}

export function Help({
  scenario,
  situation,
  sos,
  onSent,
  onClear,
}: {
  scenario: Scenario;
  situation: Situation;
  sos: Sos | null;
  onSent: (request: Sos) => void;
  onClear: () => void;
}) {
  const [type, setType] = useState<SosType>('trapped');
  const [people, setPeople] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState(true);
  const { profile } = useProfile(scenario);
  const now = useNow();

  const send = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await api.createSos({
        incidentId: situation.danger?.incident.id ?? situation.location.incidentId,
        people,
        type,
        description: note.trim(),
        location: situation.location.location,
        locationMode: 'manual-demo',
        profile: share ? profile : null,
      });
      onSent(created);
      setNote('');
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (sos) {
    const currentStep = STEPS.indexOf(sos.status);
    // A request keeps its original location even when the viewer moves the simulated citizen.
    const sentFrom = nearest(
      sos.location,
      scenario.demoLocations.filter((place) => place.incidentId === sos.incidentId),
    );
    return (
      <>
        <div className="fl-pagehead">
          <h1>Your request</h1>
        </div>
        <section className="fl-card fl-track" data-status={sos.status}>
          <div className="fl-track-head">
            <div>
              <strong data-testid="sos-headline">{STATUS_LABEL[sos.status]}</strong>
              <small>{requestMessage(sos)}</small>
            </div>
            <span className="fl-id" data-testid="sos-id">
              {sos.id}
            </span>
          </div>
          <ol className="fl-timeline">
            {(['Request sent', 'Team on the way', 'Resolved'] as const).map((label, stepIndex) => (
              <li
                key={label}
                data-done={stepIndex <= currentStep || undefined}
                data-now={stepIndex === currentStep || undefined}
              >
                <i aria-hidden>{stepIndex <= currentStep && <Check size={13} />}</i>
                <span>
                  <strong>{label}</strong>
                  <small>{timelineDetail(sos, stepIndex, currentStep, now)}</small>
                </span>
              </li>
            ))}
          </ol>
          <dl className="fl-facts">
            <div>
              <dt>Need</dt>
              <dd>{TYPE_LABEL[sos.type]}</dd>
            </div>
            <div>
              <dt>People</dt>
              <dd>{sos.people}</dd>
            </div>
            <div>
              <dt>From</dt>
              <dd>{sentFrom.label}</dd>
            </div>
          </dl>
          {sos.description && <p className="fl-quote">“{sos.description}”</p>}
        </section>
        {sos.status === 'resolved' ? (
          <button type="button" className="fl-btn fl-btn-block" onClick={onClear}>
            Send a new request
          </button>
        ) : (
          <section className="fl-card">
            <h2>While you wait</h2>
            <ul className="fl-ticks">
              {scenario.actions[situation.danger?.level ?? 'moderate'].slice(0, 3).map((s) => (
                <li key={s}>
                  <Check size={16} aria-hidden /> {s}
                </li>
              ))}
            </ul>
            <a className="fl-btn fl-btn-block" href="tel:999" target="_top">
              <PhoneIcon size={16} aria-hidden /> Call 999 if it gets worse
            </a>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <div className="fl-pagehead">
        <h1>Request help</h1>
      </div>
      <section className="fl-card">
        <h2>What do you need?</h2>
        <div className="fl-choices" role="radiogroup" aria-label="What do you need?">
          {NEEDS.map((n) => (
            <button
              key={n.type}
              type="button"
              role="radio"
              aria-checked={type === n.type}
              onClick={() => setType(n.type)}
            >
              <n.Icon size={20} aria-hidden />
              {n.label}
            </button>
          ))}
        </div>

        <h2>How many people?</h2>
        <div className="fl-stepper">
          <button
            type="button"
            onClick={() => setPeople((p) => Math.max(1, p - 1))}
            disabled={people <= 1}
            aria-label="One fewer"
          >
            <Minus size={18} aria-hidden />
          </button>
          <output aria-live="polite" data-testid="people">
            {people}
          </output>
          <button
            type="button"
            onClick={() => setPeople((p) => Math.min(50, p + 1))}
            disabled={people >= 50}
            aria-label="One more"
          >
            <Plus size={18} aria-hidden />
          </button>
        </div>

        <h2>
          <label htmlFor="fl-note">
            Anything they should know? <span className="fl-optional">Optional</span>
          </label>
        </h2>
        <textarea
          id="fl-note"
          className="fl-textarea"
          rows={3}
          maxLength={280}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="For example: second floor, one elderly person, water still rising"
        />

        <label className="fl-sendas">
          <Avatar name={profile.name} size={40} />
          <span>
            <strong>{share ? `Sending as ${profile.name}` : 'Sending without your profile'}</strong>
            <small>
              {share
                ? `Age ${profile.age}. Responders will see your profile.`
                : 'Responders will only see your location and need.'}
            </small>
          </span>
          <input
            type="checkbox"
            checked={share}
            onChange={(event) => setShare(event.target.checked)}
            aria-label="Share my profile with responders"
            data-testid="share-profile"
          />
        </label>
        <p className="fl-sendfrom">
          <MapPin size={15} aria-hidden /> Sending from <strong>{situation.location.label}</strong>
        </p>
        <p className="fl-fine">
          Public demo: use fictional details only. Requests and shared profiles are visible to all
          visitors.
        </p>
        {error && (
          <p className="fl-inline-warn" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="fl-btn fl-btn-danger fl-btn-block fl-btn-lg"
          onClick={send}
          disabled={busy}
          data-testid="send-sos"
        >
          <LifeBuoy size={18} aria-hidden /> {busy ? 'Sending…' : 'Send request'}
        </button>
        <p className="fl-fine">
          Simulation: this goes to the demo first-responder screen, not to a real emergency service.
          In a real emergency call 999.
        </p>
      </section>
      {situation.danger && (
        <p className="fl-fine fl-center">
          <LevelTag level={situation.danger.level} /> You are in the{' '}
          {LEVEL_NAME[situation.danger.level].toLowerCase()} zone at{' '}
          {situation.danger.incident.area}.
        </p>
      )}
    </>
  );
}

// The citizen's profile: who they are, so a responder knows who to look for and who they are talking to.
// The demo starts from the scenario's fictional person. Edits are kept on this device only, and the profile
// leaves it only as part of a request the person chose to share it with.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Pencil, ShieldCheck, X } from 'lucide-react';
import type { CitizenProfile, Scenario } from '../shared/api.ts';
import { safeStorage } from './data.ts';

const PROFILE_KEY = 'flare.citizen.profile';
const PROFILE_EVENT = 'flare:profile';

/** Longest text the server accepts for each field (server/src/routes/validate.ts). */
const LIMITS = {
  name: 60,
  idNumber: 24,
  phone: 24,
  bloodType: 8,
  medical: 200,
  appearance: 200,
  languages: 80,
  emergencyContact: 120,
} as const;
type TextField = keyof typeof LIMITS;

const FIELDS: { field: TextField; label: string; hint?: string; long?: boolean }[] = [
  { field: 'name', label: 'Full name' },
  { field: 'idNumber', label: 'ID number' },
  { field: 'phone', label: 'Phone' },
  { field: 'bloodType', label: 'Blood type' },
  { field: 'languages', label: 'Languages' },
  {
    field: 'medical',
    label: 'Medical notes',
    hint: 'Conditions, medicine, allergies, mobility',
    long: true,
  },
  {
    field: 'appearance',
    label: 'How to recognise you',
    hint: 'What you look like or are wearing',
    long: true,
  },
  { field: 'emergencyContact', label: 'Emergency contact', hint: 'Name, relationship, phone' },
];

function readStored(): Partial<CitizenProfile> | null {
  try {
    const raw = safeStorage.get(PROFILE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<CitizenProfile>)
      : null;
  } catch {
    return null;
  }
}

/** Keeps only well-formed saved values, so a damaged or outdated saved profile can never break a request. */
function merge(base: CitizenProfile, saved: Partial<CitizenProfile> | null): CitizenProfile {
  if (!saved) {
    return base;
  }
  const next = { ...base };
  for (const field of Object.keys(LIMITS) as TextField[]) {
    const value = saved[field];
    if (typeof value === 'string' && value.length <= LIMITS[field]) {
      next[field] = value;
    }
  }
  if (!next.name.trim()) {
    next.name = base.name;
  }
  if (Number.isInteger(saved.age) && (saved.age as number) >= 1 && (saved.age as number) <= 120) {
    next.age = saved.age as number;
  }
  return next;
}

/** The profile on this device, with save and reset. Other open views of the app follow a change at once. */
export function useProfile(scenario: Scenario) {
  const [saved, setSaved] = useState(readStored);
  useEffect(() => {
    const sync = () => setSaved(readStored());
    window.addEventListener('storage', sync);
    window.addEventListener(PROFILE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(PROFILE_EVENT, sync);
    };
  }, []);
  const profile = useMemo(() => merge(scenario.demoProfile, saved), [scenario.demoProfile, saved]);
  const save = useCallback((next: CitizenProfile | null) => {
    safeStorage.set(PROFILE_KEY, next ? JSON.stringify(next) : null);
    setSaved(next);
    window.dispatchEvent(new Event(PROFILE_EVENT));
  }, []);
  return { profile, save, edited: saved !== null };
}

/* ── Avatar ────────────────────────────────────────────────────────── */
const AVATAR_COLOURS = ['#2563eb', '#7c3aed', '#0891b2', '#0f766e', '#c2410c', '#be185d'];

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '?';

/** A drawn avatar: the person's initials on a colour chosen from their name. Stands in for a photo in the demo. */
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return (
    <span
      className="fl-avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: AVATAR_COLOURS[hash % AVATAR_COLOURS.length],
      }}
      role="img"
      aria-label={`Avatar of ${name}`}
    >
      {initials(name)}
    </span>
  );
}

/* ── What a responder sees ─────────────────────────────────────────── */
/** The shared profile as a responder reads it. What a team needs on the way (who, how to spot them, medical
 *  notes) is always showing; contact details open on request, so the dispatch controls stay in view. */
export function ProfileCard({ profile }: { profile: CitizenProfile }) {
  const first: [string, string][] = [
    ['Recognise by', profile.appearance],
    ['Medical', profile.medical],
  ];
  const more: [string, string][] = [
    ['Phone', profile.phone],
    ['Blood type', profile.bloodType],
    ['Languages', profile.languages],
    ['Emergency contact', profile.emergencyContact],
  ];
  const list = (rows: [string, string][]) => (
    <dl className="fl-who-rows">
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
  return (
    <section className="fl-who" aria-label="Who sent this request" data-testid="request-profile">
      <div className="fl-who-head">
        <Avatar name={profile.name} size={52} />
        <div>
          <strong>{profile.name}</strong>
          <small>
            Age {profile.age} · ID {profile.idNumber || 'not given'}
          </small>
        </div>
      </div>
      {first.some(([, value]) => value) && list(first)}
      {more.some(([, value]) => value) && (
        <details className="fl-who-more">
          <summary>Contact and other details</summary>
          {list(more)}
        </details>
      )}
    </section>
  );
}

/* ── The citizen's own profile screen ──────────────────────────────── */
export function ProfileView({ scenario }: { scenario: Scenario }) {
  const { profile, save, edited } = useProfile(scenario);
  const [draft, setDraft] = useState<(Omit<CitizenProfile, 'age'> & { age: string }) | null>(null);

  if (draft) {
    const age = Number(draft.age);
    const ageOk = Number.isInteger(age) && age >= 1 && age <= 120;
    const valid = draft.name.trim().length > 0 && ageOk;
    return (
      <>
        <div className="fl-pagehead">
          <h1>Edit profile</h1>
        </div>
        <form
          className="fl-card fl-profile-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid) {
              return;
            }
            const text = Object.fromEntries(
              (Object.keys(LIMITS) as TextField[]).map((field) => [field, draft[field].trim()]),
            ) as Record<TextField, string>;
            save({ ...text, age });
            setDraft(null);
          }}
        >
          <p className="fl-fine">
            Public demo: use fictional details only. Requests and shared profiles are visible to all
            visitors.
          </p>
          {FIELDS.slice(0, 1).map(({ field, label }) => (
            <div className="fl-field" key={field}>
              <label htmlFor={`fl-profile-${field}`}>{label}</label>
              <input
                id={`fl-profile-${field}`}
                className="fl-input"
                value={draft[field]}
                maxLength={LIMITS[field]}
                onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                required
              />
            </div>
          ))}
          <div className="fl-field">
            <label htmlFor="fl-profile-age">Age</label>
            <input
              id="fl-profile-age"
              className="fl-input"
              inputMode="numeric"
              value={draft.age}
              maxLength={3}
              onChange={(event) =>
                setDraft({ ...draft, age: event.target.value.replace(/\D/g, '') })
              }
              aria-invalid={!ageOk}
            />
          </div>
          {FIELDS.slice(1).map(({ field, label, hint, long }) => (
            <div className="fl-field" key={field}>
              <label htmlFor={`fl-profile-${field}`}>
                {label}
                {hint && <span className="fl-optional">{hint}</span>}
              </label>
              {long ? (
                <textarea
                  id={`fl-profile-${field}`}
                  className="fl-textarea"
                  rows={2}
                  value={draft[field]}
                  maxLength={LIMITS[field]}
                  onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                />
              ) : (
                <input
                  id={`fl-profile-${field}`}
                  className="fl-input"
                  value={draft[field]}
                  maxLength={LIMITS[field]}
                  onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                />
              )}
            </div>
          ))}
          {!valid && (
            <p className="fl-inline-warn" role="alert">
              Enter a name and an age between 1 and 120.
            </p>
          )}
          <div className="fl-profile-actions">
            <button type="button" className="fl-btn" onClick={() => setDraft(null)}>
              <X size={16} aria-hidden /> Cancel
            </button>
            <button
              type="submit"
              className="fl-btn fl-btn-primary"
              disabled={!valid}
              data-testid="save-profile"
            >
              <Check size={16} aria-hidden /> Save
            </button>
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <div className="fl-pagehead">
        <h1>Your profile</h1>
        <button
          type="button"
          className="fl-btn fl-btn-sm"
          onClick={() => setDraft({ ...profile, age: String(profile.age) })}
          data-testid="edit-profile"
        >
          <Pencil size={14} aria-hidden /> Edit
        </button>
      </div>
      <section className="fl-card fl-profile">
        <div className="fl-profile-head">
          <Avatar name={profile.name} size={72} />
          <div>
            <strong data-testid="profile-name">{profile.name}</strong>
            <small>Age {profile.age}</small>
            <small className="fl-id">ID {profile.idNumber || 'not given'}</small>
          </div>
        </div>
        <dl className="fl-profile-rows">
          {FIELDS.slice(2).map(({ field, label }) => (
            <div key={field}>
              <dt>{label}</dt>
              <dd>{profile[field] || <span className="fl-fine">Not given</span>}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="fl-card">
        <p className="fl-profile-why">
          <ShieldCheck size={18} aria-hidden />
          <span>
            When you request help, responders see this profile with your request, so they know who
            to look for and how to reach you. You can turn sharing off on the request form.
          </span>
        </p>
        <p className="fl-fine">
          Public demo: use fictional details only. Edits stay on this device until you share them
          with a request. Requests and shared profiles are visible to all visitors.
        </p>
        {edited && (
          <button
            type="button"
            className="fl-btn fl-btn-ghost fl-btn-sm"
            onClick={() => save(null)}
          >
            Restore the demo profile
          </button>
        )}
      </section>
    </>
  );
}

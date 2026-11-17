// Guidance, relief destinations and emergency contacts for the selected demo place.

import {
  ArrowRight,
  Check,
  ChevronRight,
  Cross,
  Footprints,
  House,
  LifeBuoy,
  Phone as PhoneIcon,
  ShieldCheck,
  TriangleAlert,
  Waves,
} from 'lucide-react';
import { metres } from '../../features/citizen/geo.ts';
import type { Scenario } from '../../shared/api.ts';
import { ago, LEVEL_NAME, SEVERITY_COLOR, SEVERITY_NAME, useNow, type Situation } from '../data.ts';
import { FlareMap } from '../FlareMap.tsx';

type GuideProps = {
  scenario: Scenario;
  situation: Situation;
  destination: Situation['options'][number] | null;
  onPick: (id: string) => void;
  onRoute: (id?: string) => void;
  onHelp: () => void;
  onArea: (id: string) => void;
  hasRequest: boolean;
  preview: boolean;
};

export function Guide({
  scenario,
  situation,
  destination,
  onPick,
  onRoute,
  onHelp,
  onArea,
  hasRequest,
  preview,
}: GuideProps) {
  const now = useNow();
  const { danger, location } = situation;

  if (!danger) {
    return (
      <>
        <section className="fl-hero" data-tone="safe">
          <span className="fl-hero-kicker">
            <ShieldCheck size={16} aria-hidden /> No alert for your location
          </span>
          <h1>You are outside the marked flood zones</h1>
          <p>
            {situation.nearestFlood
              ? `The nearest flood is ${situation.nearestFlood.area}, about ${metres(situation.nearestFlood.metres)} away.`
              : 'No floods are marked right now.'}{' '}
            This is not a promise that your street is dry. FLARE will alert you if your location
            enters a flood zone.
          </p>
        </section>
        <section className="fl-card">
          <h2>Floods right now</h2>
          <ul className="fl-rows">
            {scenario.incidents.map((incident) => (
              <li key={incident.id}>
                <button type="button" className="fl-row" onClick={() => onArea(incident.id)}>
                  <span
                    className="fl-row-icon"
                    style={{ background: SEVERITY_COLOR[incident.severity] }}
                  >
                    <Waves size={16} aria-hidden />
                  </span>
                  <span className="fl-row-text">
                    <strong>{incident.area}</strong>
                    <small>
                      {SEVERITY_NAME[incident.severity]} · {incident.summary}
                    </small>
                  </span>
                  <ChevronRight size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="fl-card">
          <h2>Be ready</h2>
          <ul className="fl-ticks">
            <li>
              <Check size={16} aria-hidden /> Keep your phone charged and notifications on.
            </li>
            <li>
              <Check size={16} aria-hidden /> Know your nearest safe zone before you need it.
            </li>
            <li>
              <Check size={16} aria-hidden /> Keep ID, medicine and water where you can grab them.
            </li>
          </ul>
          <button
            type="button"
            className="fl-btn fl-btn-block"
            onClick={() => onRoute(destination?.shelter.id)}
            disabled={!destination}
          >
            <Footprints size={16} aria-hidden /> Show my nearest safe zone
          </button>
        </section>
        <Contacts scenario={scenario} onHelp={onHelp} />
      </>
    );
  }

  const steps = scenario.actions[danger.level];
  return (
    <>
      <section className="fl-hero" data-tone={danger.level}>
        <span className="fl-hero-kicker">
          <TriangleAlert size={16} aria-hidden /> Flood emergency · {danger.incident.area}
        </span>
        <h1>You are inside a flood danger zone</h1>
        <p>
          <strong>{LEVEL_NAME[danger.level]} damage level.</strong> {danger.zone.depth}. Reported{' '}
          {ago(danger.incident.updatedAt, now)} for {location.label}.
        </p>
        <div className="fl-hero-actions">
          <a className="fl-btn fl-btn-white" href="tel:999" target="_top">
            <PhoneIcon size={17} aria-hidden /> Call 999
          </a>
          <button type="button" className="fl-btn fl-btn-outline-white" onClick={onHelp}>
            <LifeBuoy size={17} aria-hidden /> {hasRequest ? 'View my request' : 'Request rescue'}
          </button>
        </div>
      </section>

      <section className="fl-card">
        <h2>Do this now</h2>
        <ol className="fl-steps">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      {destination && (
        <section className="fl-card">
          <h2>Get to a safe zone</h2>
          {preview && (
            <button
              type="button"
              className="fl-minimap"
              onClick={() => onRoute()}
              aria-label="Open the map with the route to the safe zone"
            >
              <FlareMap
                scenario={scenario}
                focusId={danger.incident.id}
                user={location}
                route={destination.route}
                selectedShelterId={destination.shelter.id}
                preview
              />
              <span className="fl-minimap-cta">
                Open map <ArrowRight size={14} aria-hidden />
              </span>
            </button>
          )}
          <ul className="fl-rows">
            {situation.options.map((option, index) => {
              const isSelected = option.shelter.id === destination.shelter.id;
              const Icon = option.shelter.kind === 'medical' ? Cross : House;
              return (
                <li key={option.shelter.id}>
                  <button
                    type="button"
                    className="fl-row"
                    data-on={isSelected || undefined}
                    aria-pressed={isSelected}
                    onClick={() => onPick(option.shelter.id)}
                  >
                    <span className="fl-row-icon" data-safe>
                      <Icon size={16} aria-hidden />
                    </span>
                    <span className="fl-row-text">
                      <strong>{option.shelter.name}</strong>
                      <small>
                        <b>{option.minutes} min walk</b> · {metres(option.distanceM)}
                        {index === 0 ? ' · Nearest shelter' : ''}
                        {option.shelter.kind === 'medical' ? ' · Medical' : ''}
                      </small>
                      {isSelected && <small>{option.shelter.note}</small>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="fl-btn fl-btn-primary fl-btn-block"
            onClick={() => onRoute()}
          >
            <Footprints size={16} aria-hidden /> Show the route to{' '}
            {destination.shelter.name.split(',')[0]}
          </button>
          <p className="fl-fine">
            Routes follow roads but do not avoid floods or marked closures. Access is not verified.
            Do not enter floodwater.
          </p>
        </section>
      )}

      <Contacts scenario={scenario} onHelp={onHelp} />
    </>
  );
}

function Contacts({ scenario, onHelp }: { scenario: Scenario; onHelp: () => void }) {
  return (
    <section className="fl-card">
      <h2>Who to contact</h2>
      <ul className="fl-rows">
        {scenario.contacts.map((contact) => (
          <li key={contact.id}>
            <a
              className="fl-row"
              href={`tel:${contact.number.replace(/[^\d+]/g, '')}`}
              target="_top"
            >
              <span className="fl-row-icon" data-call>
                <PhoneIcon size={16} aria-hidden />
              </span>
              <span className="fl-row-text">
                <strong>
                  {contact.label} · {contact.number}
                </strong>
                <small>{contact.note}</small>
              </span>
            </a>
          </li>
        ))}
        <li>
          <button type="button" className="fl-row" onClick={onHelp}>
            <span className="fl-row-icon" data-help>
              <LifeBuoy size={16} aria-hidden />
            </span>
            <span className="fl-row-text">
              <strong>Request help in the app</strong>
              <small>Goes to the first responders' queue with your location</small>
            </span>
            <ChevronRight size={18} aria-hidden />
          </button>
        </li>
      </ul>
      <p className="fl-fine">
        This is a simulation: a request sent here reaches the demo responder screen only. The phone
        numbers are real. Call them only in a real emergency.
      </p>
    </section>
  );
}

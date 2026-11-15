// OWNER: D2. Persistent safety banner — required on every view.
export const DEMO_BANNER_TEXT = 'HACKATHON DEMO — simulated disaster data; not an emergency service.';
export const SOS_DISCLAIMER = 'Demo only: no emergency service receives this request.';

export function DemoBanner() {
  return (
    <div role="status" className="sticky top-0 z-50 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      {DEMO_BANNER_TEXT}
    </div>
  );
}

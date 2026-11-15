// OWNER: D2. Landing hero for "/". Layout from Aceternity UI's Cloud Shader Hero demo,
// with FLARE copy and links in place of the source's placeholder fintech content.
import { CloudShader } from "./ui/cloud-shader.tsx";

const steps = [
  {
    tag: "01 · Awareness",
    title: "Citizen portal",
    body: "A simulated Shah Alam flood with source-labelled zones, fictional shelters and a demo SOS that tracks its own status.",
    href: "/citizen",
    cta: "Open citizen view",
  },
  {
    tag: "02 · Response",
    title: "Responder control room",
    body: "The same SOS arrives in a live queue. Assign a demo team or mark it resolved, and the citizen sees it within seconds.",
    href: "/responder",
    cta: "Open responder view",
  },
  {
    tag: "03 · Recovery",
    title: "RecoveryGap",
    body: "Compare how limited water, food and hygiene stock reaches three relief centres, with every shortage shown.",
    href: "/responder#recovery",
    cta: "Compare allocations",
  },
];

export default function FlareHero() {
  return (
    <div className="relative min-h-[50rem] w-full overflow-hidden">
      <CloudShader className="absolute inset-0" />

      {/* navbar */}
      <nav className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-sm font-bold text-sky-700 shadow-sm">
            F
          </div>
          <span className="text-lg font-semibold tracking-tight text-white drop-shadow-sm">
            FLARE
          </span>
        </div>
        <div className="hidden items-center gap-8 text-sm font-medium text-white/90 md:flex">
          <a href="/citizen" className="transition hover:text-white">
            Citizen
          </a>
          <a href="/responder" className="transition hover:text-white">
            Responder
          </a>
          <a href="/responder#recovery" className="transition hover:text-white">
            RecoveryGap
          </a>
          <a href="#how-it-works" className="transition hover:text-white">
            How it works
          </a>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/responder"
            className="hidden text-sm font-medium text-white/90 transition hover:text-white sm:block"
          >
            Responder view
          </a>
          <a
            href="/citizen"
            className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-sky-700 shadow-md transition hover:bg-white/90"
          >
            Try the demo
          </a>
        </div>
      </nav>

      {/* hero */}
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 pt-12 text-center md:pt-20">
        <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-md md:text-6xl lg:text-7xl">
          From disaster response <br className="hidden md:block" /> to recovery
        </h1>
        <p className="mt-6 max-w-2xl text-base text-white/90 drop-shadow-sm md:text-lg">
          FLARE connects the alert, the person asking for help, and the
          supplies that still need to reach them. One backend, two portals,
          one request you can follow end to end.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <a
            href="/citizen"
            className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-sky-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-white/90"
          >
            Open citizen portal
          </a>
          <a
            href="/responder"
            className="rounded-full border border-white/40 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            Open responder portal
          </a>
        </div>
        <p className="mt-4 text-xs text-white/70">
          Hackathon demo &middot; Simulated data &middot; Not an emergency service
        </p>
      </div>

      {/* three-step panel (replaces the source's dashboard screenshot) */}
      <div id="how-it-works" className="relative z-10 mx-auto mt-12 w-full max-w-6xl px-4 pb-4 md:mt-16 md:px-8">
        <div className="rounded-2xl border border-white/30 bg-white/20 p-2 shadow-2xl backdrop-blur-md md:rounded-[2rem] md:p-3">
          <div className="grid gap-2 md:grid-cols-3 md:gap-3">
            {steps.map((s) => (
              <a
                key={s.title}
                href={s.href}
                className="group flex flex-col rounded-xl border border-black/5 bg-white/90 p-5 text-left shadow-lg transition hover:-translate-y-0.5 hover:bg-white md:rounded-3xl md:p-6"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                  {s.tag}
                </span>
                <span className="mt-2 text-lg font-semibold text-slate-900">{s.title}</span>
                <span className="mt-2 flex-1 text-sm text-slate-600">{s.body}</span>
                <span className="mt-4 text-sm font-semibold text-sky-700 group-hover:underline">
                  {s.cta} →
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

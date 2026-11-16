// FLARE logo, traced from the project artwork (docs/flare-logo.jpg): two orange signal arcs
// over a chevron, plus the FLARE wordmark. The chevron and wordmark use currentColor, so the
// logo works on light and dark backgrounds; the arcs stay orange.
import type { SVGProps } from 'react';

export const FLARE_ORANGE = '#ff4d1c';

type LogoProps = Omit<SVGProps<SVGSVGElement>, 'viewBox'> & { height?: number | string };

function Mark() {
  return (
    <>
      <g fill="none" stroke={FLARE_ORANGE} strokeWidth="17" strokeLinecap="round">
        <path d="M93 655a119.5 119.5 0 0 1 239 0" />
        <path d="M141 672a71.5 71.5 0 0 1 143 0" />
      </g>
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
        d="M212 655 304 773H262L212 714 162 773H120Z"
      />
    </>
  );
}

/** Icon only: arcs and chevron. */
export function FlareMark({ height = 32, ...rest }: LogoProps) {
  return (
    <svg viewBox="76 524 272 260" height={height} role="img" aria-label="FLARE" {...rest}>
      <Mark />
    </svg>
  );
}

/** Icon plus the FLARE wordmark. */
export function FlareLogo({ height = 40, ...rest }: LogoProps) {
  return (
    <svg viewBox="76 524 1122 260" height={height} role="img" aria-label="FLARE" {...rest}>
      <Mark />
      <g fill="currentColor" fillRule="evenodd">
        <path d="M403 598H540V632H443V668H527V702H443V767H403Z" />
        <path d="M563 598H603V733H672V767H563Z" />
        <path d="M757 598H803L875 767H832L818 733H742L728 767H684ZM780 640 755 700H805Z" />
        <path d="M887 598H968Q1030 598 1030 660 1030 703 993 716L1031 767H986L952 722H927V767H887ZM927 632V689H966Q990 689 990 660 990 632 966 632Z" />
        <path d="M1057 598H1187V632H1097V665H1178V698H1097V733H1190V767H1057Z" />
      </g>
    </svg>
  );
}

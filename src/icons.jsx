import React from "react";

// Icônes en ligne (SVG), dessinées sur une grille 24×24, trait 2 px.
// Elles héritent de la couleur du texte (currentColor).
const Svg = ({ children, size = 20, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    {children}
  </svg>
);

export const PlayIcon = (p) => (
  <Svg {...p}>
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" stroke="none" />
  </Svg>
);

export const PauseIcon = (p) => (
  <Svg {...p}>
    <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" />
  </Svg>
);

export const Back10Icon = (p) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v4.5h4.5" />
    <text x="12" y="15.6" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, sans-serif">10</text>
  </Svg>
);

export const Fwd10Icon = (p) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v4.5h-4.5" />
    <text x="12" y="15.6" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, sans-serif">10</text>
  </Svg>
);

export const ExpandIcon = (p) => (
  <Svg {...p}>
    <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
  </Svg>
);

export const ShrinkIcon = (p) => (
  <Svg {...p}>
    <path d="M9 4v4a1 1 0 0 1-1 1H4M20 9h-4a1 1 0 0 1-1-1V4M15 20v-4a1 1 0 0 1 1-1h4M4 15h4a1 1 0 0 1 1 1v4" />
  </Svg>
);

export const FileIcon = (p) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
    <path d="M12 12v6M9 15h6" />
  </Svg>
);

export const NoteIcon = (p) => (
  <Svg {...p}>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </Svg>
);

export const VolumeIcon = (p) => (
  <Svg {...p}>
    <path d="M11 5 6 9H3v6h3l5 4Z" fill="currentColor" fillOpacity="0.15" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </Svg>
);

export const SustainIcon = (p) => (
  <Svg {...p}>
    <path d="M3 17c3 0 3-10 6-10s4 6 7 8 3 2 5 2" />
  </Svg>
);

export const ChevronIcon = (p) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const MinusIcon = (p) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const PlusIcon = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

// Logo : trois touches, celle du milieu à l'accent.
export const Logo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="9" fill="var(--case)" />
    <rect x="6" y="7" width="6" height="18" rx="1.6" fill="var(--ivory)" />
    <rect x="13" y="7" width="6" height="18" rx="1.6" fill="var(--accent)" />
    <rect x="20" y="7" width="6" height="18" rx="1.6" fill="var(--ivory)" />
    <rect x="10.2" y="7" width="3.6" height="10.5" rx="1" fill="var(--case)" />
    <rect x="18.2" y="7" width="3.6" height="10.5" rx="1" fill="var(--case)" />
  </svg>
);

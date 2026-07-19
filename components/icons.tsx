/** Minimal stroke icon set (24×24, currentColor) used by the sidebar & modules. */
import { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const Icon = {
  home: (p: P) => (
    <svg {...base(p)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  ),
  survey: (p: P) => (
    <svg {...base(p)}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  ),
  report: (p: P) => (
    <svg {...base(p)}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  calendar: (p: P) => (
    <svg {...base(p)}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  ),
  users: (p: P) => (
    <svg {...base(p)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M16 15c2.5.3 4 2.2 4 5" />
    </svg>
  ),
  project: (p: P) => (
    <svg {...base(p)}>
      <path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H3z" />
      <path d="M3 7V5a2 2 0 0 1 2-2h3l2 2" />
    </svg>
  ),
  finance: (p: P) => (
    <svg {...base(p)}>
      <path d="M3 6h18v12H3z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9v6M18 9v6" />
    </svg>
  ),
  sync: (p: P) => (
    <svg {...base(p)}>
      <path d="M4 4v5h5" />
      <path d="M20 20v-5h-5" />
      <path d="M19 9a7 7 0 0 0-13-2M5 15a7 7 0 0 0 13 2" />
    </svg>
  ),
  profile: (p: P) => (
    <svg {...base(p)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
    </svg>
  ),
  grid: (p: P) => (
    <svg {...base(p)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  health: (p: P) => (
    <svg {...base(p)}>
      <path d="M12 21s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5C19 16.6 12 21 12 21z" />
      <path d="M12 9v4M10 11h4" />
    </svg>
  ),
  maternal: (p: P) => (
    <svg {...base(p)}>
      <circle cx="12" cy="5" r="2.2" />
      <path d="M12 8c-2 0-3 1.5-3 4v5h2l1 4M12 8c2 0 3 1.5 3 4" />
    </svg>
  ),
  docs: (p: P) => (
    <svg {...base(p)}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h6" />
    </svg>
  ),
  education: (p: P) => (
    <svg {...base(p)}>
      <path d="M3 8.5 12 4l9 4.5-9 4.5z" />
      <path d="M7 10.5V16c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-5.5" />
    </svg>
  ),
  child: (p: P) => (
    <svg {...base(p)}>
      <circle cx="12" cy="6" r="2.4" />
      <path d="M12 8.5v6M8.5 11h7M9 21l3-6 3 6" />
    </svg>
  ),
  youth: (p: P) => (
    <svg {...base(p)}>
      <circle cx="8" cy="7" r="2.6" />
      <circle cx="16" cy="7" r="2.6" />
      <path d="M3 20c0-3 2.2-5 5-5s5 2 5 5M13.5 15.2c.8-.4 1.6-.2 2.5-.2 2.8 0 5 2 5 5" />
    </svg>
  ),
  women: (p: P) => (
    <svg {...base(p)}>
      <circle cx="12" cy="7" r="4" />
      <path d="M12 11v7M9 15h6" />
    </svg>
  ),
  menu: (p: P) => (
    <svg {...base(p)}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  close: (p: P) => (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
};

export type IconName = keyof typeof Icon;

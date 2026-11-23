type P = { size?: number; className?: string };
const base = (size = 20) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const IconBag = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></svg>
);
export const IconPlus = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconCheck = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const IconClose = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconMenu = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 8h16M4 16h16" /></svg>
);
export const IconArrow = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconWhatsapp = ({ size = 20, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <path d="M12 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.2-1.4A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z" />
  </svg>
);
export const IconPin = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const IconPhone = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>
);

/** Ilustración lineal de una tarta: decorativa, para estados vacíos. */
export const CakeArt = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className={className}>
    <ellipse cx="100" cy="150" rx="78" ry="16" />
    <path d="M30 150V112c0-9 31-16 70-16s70 7 70 16v38" />
    <path d="M30 112c0 9 31 16 70 16s70-7 70-16" />
    <path d="M40 120c6 10 10 16 14 0 4 16 8 16 14 0 4 16 10 16 14 0 4 16 10 16 14 0 4 16 10 16 14 0 4 16 10 16 14 0 4 16 8 10 14 0" />
    <circle cx="100" cy="82" r="12" />
    <path d="M100 70c0-12 6-20 16-24" />
    <path d="M116 46c8 2 12 8 10 14-8 0-12-6-10-14Z" />
  </svg>
);

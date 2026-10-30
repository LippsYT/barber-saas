import { cn } from "@/lib/utils";

export type ChispaPose = "stand" | "run" | "wave" | "heart" | "point";

/** Chispa: mascota original de Pulso. Una barbera de capa, gorra y zapatillas. No es una nube. */
export function Chispa({ pose = "stand", className }: { pose?: ChispaPose; className?: string }) {
  const uid = pose;
  const lean = pose === "run" ? 8 : 0;
  const arm = pose === "wave" || pose === "point" ? "M126 108c18-28 36-26 42-8" : pose === "heart" ? "M118 118c8 10 16 16 22 14" : pose === "run" ? "M128 112c16-6 28 4 34 16" : "M124 112c10 16 8 28-2 36";
  const arm2 = pose === "run" ? "M78 114c-20 4-28 22-22 34" : pose === "heart" ? "M86 118c-6 12-2 20 10 22" : "M80 116c-8 18-2 32 12 36";
  return (
    <svg viewBox="0 0 200 250" className={cn("overflow-visible", className)} role="img" aria-label="Chispa, la mascota de Pulso">
      <defs>
        <filter id={`sticker-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="3.2" result="dilate" />
          <feFlood floodColor="#ffffff" result="flood" />
          <feComposite in="flood" in2="dilate" operator="in" result="outline" />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#sticker-${uid})`} transform={`rotate(${lean} 100 140)`}>
        <ellipse cx="100" cy="232" rx="36" ry="7" fill="#0B1220" opacity="0.18" />
        <path d="M78 168c-2 22 4 40 8 48" stroke="#1B2438" strokeWidth="7" strokeLinecap="round" fill="none" />
        <path d="M122 168c2 22-2 40-6 48" stroke="#1B2438" strokeWidth="7" strokeLinecap="round" fill="none" />
        <path d={pose === "run" ? "M62 214c8 10 28 12 36-2 2-16-18-22-32-12-6 4-8 8-4 14z" : "M58 210c6 14 28 16 36 2 4-14-10-24-26-20-8 2-12 8-10 18z"} fill="#F7F8FC" stroke="#1B2438" strokeWidth="3" />
        <path d={pose === "run" ? "M112 206c10 8 30 6 36-6 4-14-12-22-28-16-8 2-12 10-8 22z" : "M108 210c8 14 30 14 38 0 4-16-10-26-28-20-8 2-12 10-10 20z"} fill="#2F5BFF" stroke="#1B2438" strokeWidth="3" />
        <path d="M70 208h22M118 208h20" stroke="#D6FF4A" strokeWidth="4" strokeLinecap="round" />
        <path d="M62 118c-8 10-6 36 8 52 18 20 52 22 74 4 16-12 18-40 8-56-8-14-24-22-46-22s-38 8-44 22z" fill="#2F5BFF" />
        <path d="M78 124h48" stroke="#D6FF4A" strokeWidth="6" strokeLinecap="round" />
        <circle cx="100" cy="78" r="36" fill="#F4E7D4" />
        <path d="M66 74c2-28 22-44 40-44 20 0 36 16 38 40-8-10-22-8-32-2-8 6-16 8-26 4-8-2-16-2-20 2z" fill="#1230C8" />
        <path d="M64 70c8-6 18-2 22 6" stroke="#D6FF4A" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="86" cy="82" r="4.2" fill="#141820" />
        <circle cx="114" cy="82" r="4.2" fill="#141820" />
        <path d="M90 98c6 6 16 6 22 0" stroke="#141820" strokeWidth="3" strokeLinecap="round" fill="none" />
        {pose === "heart" && <path d="M92 118c0-8 16-8 16 2 0-10 16-10 16-2 0 12-16 20-16 20s-16-8-16-20z" fill="#FF4D6A" />}
        <path d={arm} stroke="#F4E7D4" strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d={arm2} stroke="#F4E7D4" strokeWidth="8" strokeLinecap="round" fill="none" />
        {pose === "point" && <circle cx="168" cy="92" r="7" fill="#D6FF4A" stroke="#141820" strokeWidth="2" />}
        {pose !== "heart" && pose !== "point" && (
          <g transform={pose === "wave" ? "translate(148 78) rotate(-20)" : pose === "run" ? "translate(150 112)" : "translate(108 140)"}>
            <rect x="0" y="0" width="22" height="7" rx="2" fill="#141820" />
            <path d="M4 7v10M9 7v12M14 7v10M19 7v8" stroke="#141820" strokeWidth="2" />
          </g>
        )}
      </g>
    </svg>
  );
}

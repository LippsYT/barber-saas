"use client";
const PALETTE = [
  { bg: "#2F5BFF", fg: "#ffffff" },
  { bg: "#D6FF4A", fg: "#14180a" },
  { bg: "#FF5A7A", fg: "#ffffff" },
  { bg: "#7C5CFF", fg: "#ffffff" },
  { bg: "#14B8A6", fg: "#04221f" },
  { bg: "#FFB020", fg: "#1c1404" },
];

export interface WeekDay { date: string; dow: string; num: string }
export interface WeekBlock { id: string; date: string; memberId: string; memberName: string; title: string; startMin: number; endMin: number }

const START = 8 * 60;
const END = 21 * 60;
const PX = 0.72;

export function WeekGrid({ days, blocks, active, onDay, onBlock }: {
  days: WeekDay[];
  blocks: WeekBlock[];
  active: string;
  onDay: (date: string) => void;
  onBlock?: (id: string) => void;
}) {
  const members = new Map<string, string>();
  for (const b of blocks) members.set(b.memberId, b.memberName);
  const order = [...members.keys()].sort();
  const colorOf = (id: string) => PALETTE[Math.max(0, order.indexOf(id)) % PALETTE.length];
  const height = (END - START) * PX;
  return (
    <div className="min-w-0">
      <div className="mb-3 flex gap-2 hscroll pb-1">
        {[...members.entries()].map(([id, name]) => {
          const c = colorOf(id);
          return <span key={id} className="pill shrink-0" style={{ background: c.bg, color: c.fg }}>{name.split(" ")[0]}</span>;
        })}
        {members.size === 0 && <span className="text-sm text-ink/50">Los bloques usan un color por barbero.</span>}
      </div>
      <div className="hscroll rounded-[1.5rem] bg-white shadow-soft">
        <div className="flex min-w-[640px]">
          <div className="w-12 shrink-0 border-r border-black/5 pt-12 text-[10px] text-ink/40">
            {Array.from({ length: 14 }, (_, i) => 8 + i).map((h) => (
              <div key={h} style={{ height: 60 * PX }} className="pr-1 text-right">{String(h).padStart(2, "0")}</div>
            ))}
          </div>
          {days.map((d) => (
            <div key={d.date} className="min-w-[88px] flex-1 border-l border-black/5">
              <button onClick={() => onDay(d.date)} className={`flex w-full flex-col items-center py-2 text-xs font-extrabold uppercase ${active === d.date ? "bg-[#2F5BFF] text-white" : ""}`}>
                <span>{d.dow}</span><span className="text-base">{d.num}</span>
              </button>
              <div className="relative" style={{ height }}>
                {blocks.filter((b) => b.date === d.date).map((b) => {
                  const c = colorOf(b.memberId);
                  const top = Math.max(0, (b.startMin - START) * PX);
                  const h = Math.max(28, (b.endMin - b.startMin) * PX);
                  if (b.endMin <= START || b.startMin >= END) return null;
                  return (
                    <button key={b.id} onClick={() => onBlock?.(b.id)} className="absolute inset-x-1 overflow-hidden rounded-lg px-1 py-0.5 text-left text-[10px] font-bold leading-tight" style={{ top, height: h, background: c.bg, color: c.fg }}>
                      <div className="truncate">{b.memberName.split(" ")[0]}</div>
                      <div className="truncate font-medium opacity-80">{b.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

export function Phone({ children, className, dark = false }: { children: React.ReactNode; className?: string; dark?: boolean }) {
  return (
    <div className={cn("phone-float relative mx-auto w-[250px] rounded-[2rem] border-[8px] border-[#12141c] bg-[#12141c] shadow-[0_30px_60px_rgba(7,11,20,.35)]", className)}>
      <div className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-[#12141c]" />
      <div className={cn("relative h-[480px] overflow-hidden rounded-[1.45rem]", dark ? "bg-[#16182a] text-white" : "bg-[#F6F4EE] text-ink")}>
        <div className="flex items-center justify-between px-4 pb-1 pt-3 text-[10px] font-semibold">
          <span>9:41</span>
          <span className="flex gap-1 opacity-70"><span>▮▮▮</span><span>WiFi</span></span>
        </div>
        {children}
      </div>
    </div>
  );
}

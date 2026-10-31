import Image from "next/image";
import type { Shot } from "@/lib/screenshots";

/** A screenshot of the app in a simple phone frame, with its caption underneath. */
export function Phone({ shot, className = "" }: { shot: Shot; className?: string }) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-[1.75rem] border-[6px] border-ink bg-ink shadow-lg">
        <Image src={shot.src} alt={shot.alt} width={390} height={844} className="block h-auto w-full" />
      </div>
      <figcaption className="mt-3 text-center text-sm font-semibold">{shot.caption}</figcaption>
    </figure>
  );
}

/** A task's duration: "45 s", "4 min 32 s", "1 h 5 min", or "–" when nothing has been timed. */
export function duration(ms: number | null) {
  if (ms === null) return "–";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 60)} h`;
}

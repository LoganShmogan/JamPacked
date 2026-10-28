/** Questions that open in place, without JavaScript. */
export function Faqs({ items }: { items: [string, string][] }) {
  return (
    <div className="divide-y divide-border">
      {items.map(([q, a]) => (
        <details key={q} className="py-4">
          <summary className="cursor-pointer font-semibold marker:text-jam">{q}</summary>
          <p className="mt-2 text-muted">{a}</p>
        </details>
      ))}
    </div>
  );
}

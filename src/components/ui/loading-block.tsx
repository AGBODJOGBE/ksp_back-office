/** Squelette d'un écran en chargement : réserve la place du contenu, sans décalage à l'arrivée. */
export function LoadingBlock({ lines = 4, label }: { lines?: number; label: string }) {
  return (
    <div aria-busy="true" className="grid gap-3">
      <p role="status" className="sr-only">
        {label}
      </p>
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="bg-surface-sunken rounded-control block h-12 animate-pulse motion-reduce:animate-none"
          style={{ width: `${100 - (index % 3) * 12}%` }}
        />
      ))}
    </div>
  );
}

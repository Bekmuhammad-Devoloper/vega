export default function Loading() {
  return (
    <div className="min-h-dvh grid place-items-center">
      <div className="flex items-center gap-3">
        <span className="inline-block h-5 w-5 rounded-full border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] animate-spin" />
        <span className="text-sm text-[var(--color-text-muted)]">Yuklanmoqda...</span>
      </div>
    </div>
  );
}

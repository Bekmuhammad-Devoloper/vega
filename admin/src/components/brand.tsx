/**
 * Vega brend belgisi — foydalanuvchi logosi (rasm).
 * Emoji/SVG o'rniga haqiqiy logo; login/register/header — hammasi shu.
 */
export function VegaMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/vega-logo.png"
      alt="Vega"
      className={`inline-block shrink-0 rounded-[24%] object-cover ${className ?? ''}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Logo + "Vega" (chiroyli qo'lyozma — Pacifico shrift). */
export function Brand({ className, size = 34 }: { className?: string; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-2 leading-none ${className ?? ''}`}>
      <VegaMark size={size} />
      <span
        className="leading-none"
        style={{
          fontFamily: "'Pacifico', cursive",
          fontSize: size * 0.72,
          color: '#0F172A',
          paddingBottom: 2,
        }}
      >
        Vega
      </span>
    </span>
  );
}

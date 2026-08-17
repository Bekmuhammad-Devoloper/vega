const SI: Record<string, string> = {
  telegram: 'telegram', whatsapp: 'whatsapp', instagram: 'instagram',
  google: 'gmail', facebook: 'facebook', tiktok: 'tiktok',
  twitter: 'x', viber: 'viber', uber: 'uber',
};

// Ikonalar LOKAL (public/brands/*.svg) — CDN'siz, miltillamaydi, darrov chiqadi.
export function ServiceIcon({ slug, emoji, className }: { slug?: string | null; emoji?: string | null; className?: string }) {
  const si = slug ? SI[slug] : undefined;
  if (si) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/brands/${si}.svg`} alt="" width={20} height={20} className={className ?? 'inline-block h-5 w-5 shrink-0 object-contain'} />;
  }
  return <span className={className}>{emoji ?? ''}</span>; // fallback (slug topilmasa emoji)
}

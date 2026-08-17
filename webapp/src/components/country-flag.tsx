/**
 * Har qanday davlat bayrog'i (iso2 kodi bo'yicha rasm).
 * Emoji bayroqlar Windows/Telegram Desktop'da harflarga aylanadi — shuning uchun rasm.
 */
export function CountryFlag({ iso2, className }: { iso2?: string | null; className?: string }) {
  const code = (iso2 ?? '').trim().toLowerCase();
  if (!code) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/flags/${code}.png`}
      alt=""
      width={22}
      height={16}
      className={
        className ??
        'inline-block h-4 w-[22px] shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.10)]'
      }
    />
  );
}

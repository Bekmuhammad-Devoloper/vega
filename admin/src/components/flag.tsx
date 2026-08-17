/** Platformadan qat'i nazar ko'rinadigan SVG bayroqlar (emoji Windows'da ishlamaydi). */
export function Flag({ code, className }: { code: 'uz' | 'ru'; className?: string }) {
  const cls = className ?? 'inline-block h-3.5 w-5 rounded-[2px] align-[-2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]';
  if (code === 'ru') {
    return (
      <svg viewBox="0 0 9 6" className={cls} aria-label="Русский" role="img">
        <rect width="9" height="6" fill="#fff" />
        <rect width="9" height="4" y="2" fill="#0039A6" />
        <rect width="9" height="2" y="4" fill="#D52B1E" />
      </svg>
    );
  }
  // Uzbekistan: ko'k / oq / yashil + qizil chiziqlar
  return (
    <svg viewBox="0 0 18 12" className={cls} aria-label="O'zbek" role="img">
      <rect width="18" height="12" fill="#fff" />
      <rect width="18" height="3.7" y="0" fill="#0099B5" />
      <rect width="18" height="3.7" y="8.3" fill="#1EB53A" />
      <rect width="18" height="0.4" y="3.7" fill="#CE1126" />
      <rect width="18" height="0.4" y="7.9" fill="#CE1126" />
    </svg>
  );
}

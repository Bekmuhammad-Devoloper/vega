import { ShieldCheck, Zap } from 'lucide-react';
import type { Locale } from '@/i18n';

const APPS = ['telegram', 'whatsapp', 'instagram', 'gmail'] as const;
const FLAGS = ['uz', 'kz', 'tr', 'us'] as const;

/**
 * Bosh sahifa karuselining birinchi slaydi — rasm emas, kod bilan chizilgan
 * banner: yengil, har qanday ekranda tiniq, slayd balandligiga moslashadi.
 */
export function HeroSlide({ locale }: { locale: Locale }) {
  const ru = locale === 'ru';
  return (
    <div className="relative flex h-full overflow-hidden bg-[radial-gradient(120%_140%_at_0%_0%,#3B82F6_0%,#1D4ED8_45%,#0B1B4D_100%)] text-white">
      {/* Fon bezaklari */}
      <div className="pointer-events-none absolute -left-16 -bottom-20 h-48 w-48 rounded-full bg-sky-400/20 blur-2xl" />
      <div className="pointer-events-none absolute right-[-30%] top-[-40%] h-[140%] w-[80%] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute right-[-18%] top-[-20%] h-[110%] w-[62%] rounded-full border border-white/10" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(white 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      />

      {/* Chap: matn */}
      <div className="relative z-10 flex w-[58%] flex-col justify-center gap-2 py-4 pl-5 pr-1">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#3b2600] shadow-[0_2px_10px_rgba(251,191,36,0.45)]">
          <Zap size={11} className="fill-current" />
          {ru ? 'Мгновенно' : 'Tezkor'}
        </span>
        <h2 className="text-[22px] font-black leading-[1.05] tracking-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.25)]">
          {ru ? (
            <>Виртуальные<br />номера</>
          ) : (
            <>Virtual<br />raqamlar</>
          )}
        </h2>
        <p className="text-[11.5px] leading-snug text-white/80">
          {ru
            ? 'SMS-код за секунды — 200+ стран'
            : 'SMS kod soniyalarda — 200+ davlat'}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <div className="flex -space-x-1.5">
            {FLAGS.map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={f}
                src={`/flags/${f}.png`}
                alt=""
                className="h-[18px] w-[18px] rounded-full border-2 border-[#1D4ED8] object-cover"
              />
            ))}
          </div>
          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-white/85">
            <ShieldCheck size={12} className="text-emerald-300" />
            {ru ? 'Надёжно · 24/7' : 'Ishonchli · 24/7'}
          </span>
        </div>
      </div>

      {/* O'ng: telefon + SMS kod */}
      <div className="relative z-10 flex w-[42%] items-center justify-center pr-3">
        <div className="relative h-[78%] max-h-[170px] w-[68%] max-w-[104px] rotate-[8deg] rounded-[18px] border border-white/25 bg-gradient-to-b from-white/25 to-white/5 p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm">
          <div className="flex h-full flex-col gap-1 rounded-[13px] bg-[#0B1B4D]/80 p-1.5">
            <div className="mx-auto mb-0.5 h-1 w-6 rounded-full bg-white/25" />
            {APPS.map((a) => (
              <div key={a} className="flex items-center gap-1 rounded-md bg-white/10 px-1 py-[3px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/brands/${a}.svg`} alt="" className="h-3 w-3 shrink-0" />
                <span className="h-1 flex-1 rounded-full bg-white/25" />
              </div>
            ))}
          </div>
        </div>

        {/* SMS kod pufakchasi */}
        <div className="absolute bottom-[14%] left-[2%] -rotate-[4deg] rounded-xl rounded-bl-sm bg-white px-2 py-1 text-[#0B1B4D] shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <p className="text-[8px] font-semibold uppercase leading-none text-slate-500">
            {ru ? 'Код' : 'Kod'}
          </p>
          <p className="mt-0.5 text-[13px] font-black leading-none tracking-[0.12em] tabular-nums">
            48 213
          </p>
        </div>

        {/* Yulduzcha */}
        <span className="absolute right-[10%] top-[12%] text-[15px] text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]">
          ✦
        </span>
      </div>
    </div>
  );
}

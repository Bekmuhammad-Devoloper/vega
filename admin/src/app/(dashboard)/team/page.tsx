'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Pencil, Eye, Trash2, UserPlus, Info, ShieldCheck, Loader2, CheckCircle2, User, Hash } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiTeam, apiAddMember, apiUpdateMemberRole, apiRemoveMember, apiLookupMember, apiMyStore } from '@/lib/endpoints';
import { toast } from '@/stores/toast-store';

const ROLE_INFO: Record<string, { label: string; desc: string; cls: string; Icon: typeof Crown }> = {
  SUPERADMIN: { label: 'Super admin', desc: 'Platforma boshqaruvi', cls: 'bg-purple-50 text-purple-600', Icon: ShieldCheck },
  ADMIN: { label: 'Egasi', desc: "Hamma narsa — sozlama, to'lov, jamoa", cls: 'bg-amber-50 text-amber-600', Icon: Crown },
  CREATOR: { label: 'Creator', desc: "Tovar, kategoriya, banner, e'lon qo'shadi", cls: 'bg-blue-50 text-blue-600', Icon: Pencil },
  MODERATOR: { label: 'Moderator', desc: "Do'konni kuzatadi, buyurtmalarni boshqaradi", cls: 'bg-emerald-50 text-emerald-600', Icon: Eye },
  MANAGER: { label: 'Manager', desc: 'Buyurtmalarni boshqaradi', cls: 'bg-gray-100 text-gray-600', Icon: Eye },
};

const LEGEND_ROLES = ['ADMIN', 'CREATOR', 'MODERATOR'] as const;

export default function TeamPage() {
  const qc = useQueryClient();
  const { data: team, isLoading } = useQuery({ queryKey: ['team'], queryFn: apiTeam });
  const { data: store } = useQuery({ queryKey: ['my-store'], queryFn: apiMyStore });

  // Tarif bo'yicha jamoa limiti. Yuklanmaguncha -1 (cheksiz) deb olamiz —
  // shunda "limit to'ldi" xabari noto'g'ri chaqnamaydi.
  const limits = store?.limits;
  const maxMod = limits?.maxModerators ?? -1;
  const maxCre = limits?.maxCreators ?? -1;
  const usedMod = team?.filter((m) => m.role === 'MODERATOR').length ?? 0;
  const usedCre = team?.filter((m) => m.role === 'CREATOR').length ?? 0;
  const fmtMax = (n: number) => (n === -1 ? '∞' : String(n));
  const roleFull = (r: 'CREATOR' | 'MODERATOR') => {
    const max = r === 'MODERATOR' ? maxMod : maxCre;
    const used = r === 'MODERATOR' ? usedMod : usedCre;
    return max !== -1 && used >= max;
  };
  const noTeam = maxMod === 0 && maxCre === 0; // FREE — jamoa qo'shib bo'lmaydi

  const [telegramId, setTelegramId] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'CREATOR' | 'MODERATOR'>('CREATOR');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [lookupUsername, setLookupUsername] = useState<string | null>(null);
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle');

  const idValid = /^\d{5,15}$/.test(telegramId.trim());

  // Telegram ID kiritilganda — ism va profil rasmni avto-to'ldirish (debounce)
  useEffect(() => {
    const id = telegramId.trim();
    if (!/^\d{5,15}$/.test(id)) {
      setLookup('idle');
      setPhotoUrl(null);
      setLookupUsername(null);
      return;
    }
    let cancelled = false;
    setLookup('loading');
    const t = setTimeout(async () => {
      try {
        const res = await apiLookupMember(id);
        if (cancelled) return;
        if (res.found) {
          setLookup('found');
          setPhotoUrl(res.photoUrl);
          setLookupUsername(res.username);
          // Ism — ID o'zgargani uchun lookup ishga tushdi, demak yangi odam: avto to'ldiramiz
          if (res.fullName) setFullName(res.fullName);
        } else {
          setLookup('notfound');
          setPhotoUrl(null);
          setLookupUsername(null);
        }
      } catch {
        if (!cancelled) {
          setLookup('notfound');
          setPhotoUrl(null);
          setLookupUsername(null);
        }
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [telegramId]);

  const resetForm = () => {
    setTelegramId('');
    setFullName('');
    setPhotoUrl(null);
    setLookupUsername(null);
    setLookup('idle');
  };

  const add = useMutation({
    mutationFn: () =>
      apiAddMember({ telegramId: telegramId.trim(), fullName: fullName.trim(), role, photoUrl }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      resetForm();
      toast.success('Xodim qo\'shildi');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, r }: { id: string; r: 'CREATOR' | 'MODERATOR' }) => apiUpdateMemberRole(id, r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success('Rol o\'zgartirildi');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRemoveMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success('Xodim chiqarildi');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="pb-10">
      <PageHeader title="Jamoa" description="Do'koningizga xodimlar qo'shing va rollarni belgilang" />

      <div className="w-full md:max-w-2xl md:mx-auto space-y-3">
        {/* Rollar haqida */}
        <Card>
          <CardHeader title="Rollar" />
          <CardBody className="divide-y divide-[var(--color-border)] py-0">
            {LEGEND_ROLES.map((k) => {
              const r = ROLE_INFO[k];
              return (
                <div key={k} className="flex items-center gap-3 py-3 first:pt-3 last:pb-3">
                  <span className={`inline-flex h-10 w-10 rounded-xl items-center justify-center shrink-0 ${r.cls}`}>
                    <r.Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{r.label}</p>
                    <p className="text-[12px] text-[var(--color-text-muted)] leading-snug">{r.desc}</p>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        {/* Xodim qo'shish */}
        <Card>
          <CardHeader title="Xodim qo'shish" />
          <CardBody className="space-y-3">
            {limits && (
              <div className="flex items-center justify-between rounded-xl bg-[var(--color-bg)] px-3 py-2 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <Pencil size={13} className="text-blue-500" />
                  <span className="font-medium">Creator</span>
                  <span className={roleFull('CREATOR') ? 'font-semibold text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}>
                    {usedCre}/{fmtMax(maxCre)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Eye size={13} className="text-emerald-500" />
                  <span className="font-medium">Moderator</span>
                  <span className={roleFull('MODERATOR') ? 'font-semibold text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}>
                    {usedMod}/{fmtMax(maxMod)}
                  </span>
                </span>
              </div>
            )}
            <div className="flex gap-2 rounded-xl bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 px-3 py-2.5 text-xs">
              <Info size={16} className="text-[var(--color-primary)] shrink-0 mt-0.5" />
              <p className="text-[var(--color-text-muted)]">
                Xodim <b>@vegastorebot</b> ga <b>/id</b> deb yozib o&apos;z Telegram ID sini biladi va sizga
                yuboradi. So&apos;ng u botdan panelga kirsa — o&apos;sha do&apos;konni ko&apos;radi.
              </p>
            </div>
            <Field label="Xodim Telegram ID">
              <Input
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value.replace(/\D/g, ''))}
                placeholder="123456789"
                inputMode="numeric"
                className="font-mono"
              />
              {lookup === 'loading' && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                  <Loader2 size={12} className="animate-spin" /> Telegramdan qidirilmoqda…
                </p>
              )}
              {lookup === 'found' && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                  <CheckCircle2 size={12} /> Topildi{lookupUsername ? ` · @${lookupUsername}` : ''}
                </p>
              )}
              {lookup === 'notfound' && idValid && (
                <p className="mt-1 text-[11px] text-amber-600">
                  Topilmadi — xodim avval <b>@vegastorebot</b> ga <b>/id</b> yozsin. Ismni qo&apos;lda kiriting.
                </p>
              )}
            </Field>
            <Field label="Ism">
              <div className="flex items-center gap-3">
                <span className="shrink-0">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt={fullName}
                      className="h-11 w-11 rounded-full object-cover ring-1 ring-[var(--color-border)]"
                    />
                  ) : (
                    <span className="inline-flex h-11 w-11 rounded-full items-center justify-center bg-gray-100 text-gray-400">
                      {lookup === 'loading' ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : fullName.trim() ? (
                        <span className="font-semibold text-gray-500">
                          {fullName.trim().slice(0, 1).toUpperCase()}
                        </span>
                      ) : (
                        <UserPlus size={18} />
                      )}
                    </span>
                  )}
                </span>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ism familiya"
                  className="flex-1"
                />
              </div>
            </Field>
            <Field label="Rol">
              <Select value={role} onChange={(e) => setRole(e.target.value as 'CREATOR' | 'MODERATOR')}>
                <option value="CREATOR">Creator — tovar qo&apos;shadi{roleFull('CREATOR') ? " (to'ldi)" : ''}</option>
                <option value="MODERATOR">Moderator — kuzatadi{roleFull('MODERATOR') ? " (to'ldi)" : ''}</option>
              </Select>
            </Field>
            <Button
              loading={add.isPending}
              disabled={telegramId.trim().length < 5 || fullName.trim().length < 2 || roleFull(role)}
              onClick={() => add.mutate()}
            >
              <UserPlus size={16} /> Qo&apos;shish
            </Button>
            {roleFull(role) && (
              <p className="text-center text-[12px] font-medium text-[var(--color-danger)]">
                {noTeam
                  ? "Jamoa a'zolari Standart tarifdan boshlanadi — tarifni yangilang."
                  : `Bu rol uchun limit to'ldi (${role === 'MODERATOR' ? maxMod : maxCre} ta). Ko'proq uchun tarifni yangilang.`}
              </p>
            )}
          </CardBody>
        </Card>

        {/* Jamoa ro'yxati */}
        <Card>
          <CardHeader title="Jamoa a'zolari" />
          <CardBody className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-16" />
            ) : (
              team?.map((m) => {
                const info = ROLE_INFO[m.role] ?? ROLE_INFO.MODERATOR;
                return (
                  <div key={m.id} className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] p-3">
                    <span className="relative shrink-0">
                      {m.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.photoUrl}
                          alt={m.fullName}
                          className="h-11 w-11 rounded-full object-cover ring-1 ring-[var(--color-border)]"
                        />
                      ) : (
                        <span className="inline-flex h-11 w-11 rounded-full items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)]">
                          <User size={22} />
                        </span>
                      )}
                      <span className={`absolute -bottom-0.5 -right-0.5 inline-flex h-5 w-5 rounded-full items-center justify-center ring-2 ring-white ${info.cls}`}>
                        <info.Icon size={11} />
                      </span>
                    </span>

                    <div className="flex-1 min-w-0">
                      {/* Ism — to'liq ko'rinadi (kerak bo'lsa 2 qatorga o'tadi) */}
                      <p className="text-sm font-semibold leading-snug break-words">
                        {m.fullName}
                        {m.isSelf && <span className="font-normal text-[var(--color-text-muted)]"> (siz)</span>}
                      </p>
                      {/* Rol */}
                      <span
                        className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${info.cls}`}
                      >
                        <info.Icon size={11} />
                        {info.label}
                      </span>
                      {/* ID — pastda, oldida belgi bilan */}
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                        <Hash size={11} className="shrink-0" />
                        ID: <span className="font-medium text-[var(--color-text)]">{m.telegramId ?? '—'}</span>
                      </p>
                    </div>

                    {m.isOwner ? (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                        Egasi
                      </span>
                    ) : (
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <select
                          value={m.role === 'MODERATOR' ? 'MODERATOR' : 'CREATOR'}
                          onChange={(e) => changeRole.mutate({ id: m.id, r: e.target.value as 'CREATOR' | 'MODERATOR' })}
                          className="h-8 rounded-lg border border-[var(--color-border)] text-xs px-2 bg-white"
                        >
                          <option value="CREATOR">Creator</option>
                          <option value="MODERATOR">Moderator</option>
                        </select>
                        <button
                          onClick={() => remove.mutate(m.id)}
                          className="h-8 w-8 grid place-items-center rounded-lg text-[var(--color-danger)] hover:bg-red-50"
                          title="Chiqarish"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {!isLoading && !team?.length && (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-2">Hozircha jamoa bo&apos;sh</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

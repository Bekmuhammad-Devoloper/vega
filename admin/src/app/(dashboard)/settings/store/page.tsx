'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Users as UsersIcon, Lock, Palette, Upload, Image as ImageIcon, RotateCcw, X } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ColorPicker } from '@/components/ui/color-picker';
import {
  apiUpdateStoreInfo,
  apiSetStoreBot,
  apiRemoveStoreBot,
  apiUpdateStoreBranding,
  apiUploadImage,
} from '@/lib/endpoints';
import { toast } from '@/stores/toast-store';
import { SettingsHeader, useStore } from '../_shared';

export default function StoreSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useStore();
  const tenant = data?.tenant ?? null;

  // Do'kon ma'lumotlari
  const [store, setStore] = useState({ name: '', phone: '', address: '', workingHours: '', about: '' });
  useEffect(() => {
    if (tenant) {
      setStore({
        name: tenant.shopName ?? '',
        phone: tenant.phone ?? '',
        address: tenant.address ?? '',
        workingHours: tenant.workingHours ?? '',
        about: tenant.about ?? '',
      });
    }
  }, [tenant]);
  const save = useMutation({
    mutationFn: () => apiUpdateStoreInfo(store),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('Saqlandi');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Telegram bot
  const [botToken, setBotToken] = useState('');
  const setBot = useMutation({
    mutationFn: () => apiSetStoreBot(botToken.trim()),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['my-store'] });
      setBotToken('');
      toast.success(`Bot ulandi: @${r.username}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const removeBot = useMutation({
    mutationFn: apiRemoveStoreBot,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-store'] });
      toast.success("Bot o'chirildi");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Brending
  const brandingAllowed = data?.limits?.branding ?? false;
  const [brand, setBrand] = useState({
    primaryColor: '#2F6BFF',
    logoUrl: '',
    backgroundColor: '',
    backgroundImageUrl: '',
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  useEffect(() => {
    if (tenant)
      setBrand({
        primaryColor: tenant.primaryColor || '#2F6BFF',
        logoUrl: tenant.logoUrl || '',
        backgroundColor: tenant.backgroundColor || '',
        backgroundImageUrl: tenant.backgroundImageUrl || '',
      });
  }, [tenant]);
  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setLogoUploading(true);
    try {
      const r = await apiUploadImage(file);
      setBrand((b) => ({ ...b, logoUrl: r.url }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLogoUploading(false);
    }
  }
  // Fon rasmi yuklanganda — rangni bo'shatamiz (rasm rangdan ustun, chalkashmasin)
  async function uploadBackground(file: File | undefined) {
    if (!file) return;
    setBgUploading(true);
    try {
      const r = await apiUploadImage(file);
      setBrand((b) => ({ ...b, backgroundImageUrl: r.url, backgroundColor: '' }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBgUploading(false);
    }
  }
  const saveBrand = useMutation({
    mutationFn: () =>
      apiUpdateStoreBranding({
        primaryColor: brand.primaryColor,
        logoUrl: brand.logoUrl || undefined,
        // '' yuborilsa backend o'sha maydonni null qiladi (standart)
        backgroundColor: brand.backgroundColor,
        backgroundImageUrl: brand.backgroundImageUrl,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('Brending saqlandi');
    },
    onError: (err: Error) => toast.error(err.message),
  });
  // Fonni standart holatga qaytarish — rang va rasmni tozalaydi
  const resetBackground = useMutation({
    mutationFn: () => apiUpdateStoreBranding({ backgroundColor: '', backgroundImageUrl: '' }),
    onSuccess: () => {
      setBrand((b) => ({ ...b, backgroundColor: '', backgroundImageUrl: '' }));
      qc.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('Fon standart holatga qaytarildi');
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const hasCustomBg = !!(brand.backgroundColor || brand.backgroundImageUrl);

  return (
    <div>
      <SettingsHeader title="Do'kon ma'lumotlari" description="Nomi, bog'lanish, bot va brending" />

      {isLoading ? (
        <div className="max-w-2xl space-y-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
        </div>
      ) : !tenant ? (
        <Card>
          <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">Do&apos;kon topilmadi</div>
        </Card>
      ) : (
        <div className="max-w-2xl space-y-4">
          <Card>
            <CardHeader title="Do'kon ma'lumotlari" />
            <CardBody className="space-y-3">
              <Field label="Nomi">
                <Input value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} />
              </Field>
              <Field label="Telefon">
                <Input value={store.phone} onChange={(e) => setStore({ ...store, phone: e.target.value })} />
              </Field>
              <Field label="Manzil">
                <Input value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} />
              </Field>
              <Field label="Ish vaqti">
                <Input value={store.workingHours} onChange={(e) => setStore({ ...store, workingHours: e.target.value })} />
              </Field>
              <Field label="Biz haqimizda">
                <Textarea value={store.about} onChange={(e) => setStore({ ...store, about: e.target.value })} rows={4} />
              </Field>
              <Button loading={save.isPending} onClick={() => save.mutate()}>Saqlash</Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Telegram bot" />
            <CardBody className="space-y-3">
              {tenant.botUsername ? (
                <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-[var(--color-primary)]/10 to-blue-50">
                    {tenant.botPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tenant.botPhotoUrl}
                        alt={tenant.botUsername ?? 'bot'}
                        className="h-14 w-14 rounded-2xl object-cover shrink-0 shadow-sm"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-blue-500 text-white grid place-items-center shrink-0 shadow-sm">
                        <Bot size={26} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold truncate">@{tenant.botUsername}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Faol
                        </span>
                      </div>
                      <a
                        href={`https://t.me/${tenant.botUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--color-primary)]"
                      >
                        t.me/{tenant.botUsername}
                      </a>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-[var(--color-border)] border-t border-[var(--color-border)]">
                    <div className="px-4 py-3 text-center">
                      <p className="text-lg font-extrabold leading-none">{tenant.customersCount}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-1 flex items-center justify-center gap-1">
                        <UsersIcon size={12} /> Mijozlar
                      </p>
                    </div>
                    <button
                      onClick={() => removeBot.mutate()}
                      disabled={removeBot.isPending}
                      className="px-4 py-3 text-center text-[var(--color-danger)] text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                    >
                      Botni uzish
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-5 text-center">
                  <div className="inline-flex h-12 w-12 rounded-2xl bg-[var(--color-bg)] text-[var(--color-text-muted)] items-center justify-center mb-2">
                    <Bot size={24} />
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">Hozircha bot ulanmagan. Pastdan tokeningizni kiriting.</p>
                </div>
              )}
              <Field
                label={tenant.botUsername ? 'Botni almashtirish' : 'Bot token'}
                hint="@BotFather → /newbot → tokenni nusxalang"
              >
                <Input
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456:ABC-DEF…"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </Field>
              <Button loading={setBot.isPending} disabled={!botToken.trim()} onClick={() => setBot.mutate()}>
                {tenant.botUsername ? 'Almashtirish' : 'Ulash'}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Brending" />
            <CardBody className="space-y-3">
              {!brandingAllowed ? (
                <div className="flex gap-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-3 text-sm">
                  <Lock size={16} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" />
                  <p className="text-[var(--color-text-muted)]">
                    Maxsus rang va logo <b>Standart</b> va undan yuqori tariflarda. Tarifni yangilang.
                  </p>
                </div>
              ) : (
                <>
                  <Field label="Asosiy rang" hint="Do'koningiz tugma va urg'u ranglari">
                    <div className="flex items-center gap-3">
                      <ColorPicker
                        value={brand.primaryColor}
                        onChange={(c) => setBrand({ ...brand, primaryColor: c })}
                      />
                      <Input
                        value={brand.primaryColor}
                        onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                        placeholder="#2F6BFF"
                        className="font-mono"
                      />
                    </div>
                  </Field>

                  <Field label="Logo" hint="Do'kon sahifasida ko'rinadi">
                    <label className="flex items-center gap-3 h-16 px-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white cursor-pointer">
                      {brand.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={brand.logoUrl} alt="logo" className="h-12 w-12 rounded-lg object-cover" />
                      ) : (
                        <span className="inline-flex h-12 w-12 rounded-lg bg-[var(--color-bg)] items-center justify-center text-[var(--color-text-muted)]">
                          <Upload size={20} />
                        </span>
                      )}
                      <span className="text-sm text-[var(--color-text-muted)]">
                        {logoUploading ? 'Yuklanmoqda…' : brand.logoUrl ? 'Logoni almashtirish' : 'Logo yuklash'}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => uploadLogo(e.target.files?.[0])}
                      />
                    </label>
                  </Field>

                  {/* ───── Do'kon foni — rang yoki rasm ───── */}
                  <Field label="Do'kon foni" hint="Storefront orqa foni — rang yoki rasm tanlang">
                    <div className="space-y-3">
                      {/* Jonli ko'rinish */}
                      <div
                        className="h-24 rounded-xl border border-[var(--color-border)] grid place-items-center overflow-hidden bg-[var(--color-bg)]"
                        style={
                          brand.backgroundImageUrl
                            ? {
                                backgroundImage: `url(${brand.backgroundImageUrl})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }
                            : brand.backgroundColor
                              ? { background: brand.backgroundColor }
                              : undefined
                        }
                      >
                        <span className="rounded-lg bg-white/85 px-3 py-1.5 text-xs font-medium shadow-sm">
                          {hasCustomBg ? "Ko'rinish namunasi" : 'Standart fon'}
                        </span>
                      </div>

                      {/* Fon rangi */}
                      <div className="flex items-center gap-3">
                        <ColorPicker
                          value={brand.backgroundColor}
                          fallback="#f4f6fa"
                          onChange={(c) =>
                            setBrand({ ...brand, backgroundColor: c, backgroundImageUrl: '' })
                          }
                        />
                        <Input
                          value={brand.backgroundColor}
                          onChange={(e) =>
                            setBrand({ ...brand, backgroundColor: e.target.value, backgroundImageUrl: '' })
                          }
                          placeholder="Fon rangi — #F4F6FA"
                          className="font-mono"
                        />
                        {brand.backgroundColor && (
                          <button
                            type="button"
                            onClick={() => setBrand({ ...brand, backgroundColor: '' })}
                            className="h-9 w-9 grid place-items-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] shrink-0"
                            title="Rangni tozalash"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>

                      {/* Fon rasmi */}
                      <label className="flex items-center gap-3 h-16 px-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white cursor-pointer">
                        {brand.backgroundImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={brand.backgroundImageUrl} alt="fon" className="h-12 w-12 rounded-lg object-cover" />
                        ) : (
                          <span className="inline-flex h-12 w-12 rounded-lg bg-[var(--color-bg)] items-center justify-center text-[var(--color-text-muted)]">
                            <ImageIcon size={20} />
                          </span>
                        )}
                        <span className="text-sm text-[var(--color-text-muted)] flex-1">
                          {bgUploading
                            ? 'Yuklanmoqda…'
                            : brand.backgroundImageUrl
                              ? 'Fon rasmini almashtirish'
                              : 'Fon rasmini yuklash'}
                        </span>
                        {brand.backgroundImageUrl && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.preventDefault();
                              setBrand({ ...brand, backgroundImageUrl: '' });
                            }}
                            className="h-9 w-9 grid place-items-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] shrink-0"
                            title="Rasmni o'chirish"
                          >
                            <X size={16} />
                          </span>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => uploadBackground(e.target.files?.[0])}
                        />
                      </label>
                    </div>
                  </Field>

                  <div className="flex items-center gap-2">
                    <Button loading={saveBrand.isPending} onClick={() => saveBrand.mutate()}>Saqlash</Button>
                    <Button
                      variant="ghost"
                      loading={resetBackground.isPending}
                      disabled={!hasCustomBg}
                      onClick={() => resetBackground.mutate()}
                    >
                      <RotateCcw size={15} /> Standart fonga qaytarish
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <Palette size={14} /> Rang, logo va fon mijozlar do&apos;koningizga qo&apos;llanadi.
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

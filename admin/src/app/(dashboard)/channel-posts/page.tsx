'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Radio, Send, Upload, Trash2, Clock, CheckCircle2, AlertCircle, ShoppingBag, Users, X, Eye, Film } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiChannelConfig,
  apiChannelInfo,
  apiSetChannel,
  apiListChannelPosts,
  apiCreateChannelPost,
  apiDeleteChannelPost,
  apiUploadImage,
  apiUploadVideo,
  type ChannelPostStatus,
} from '@/lib/endpoints';
import { formatCount } from '@/lib/format';
import { toast } from '@/stores/toast-store';

/** Hozirgi vaqtni datetime-local input formatiga (mahalliy) o'giradi. */
function nowLocalInput(offsetMinutes = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS: Record<ChannelPostStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  SCHEDULED: { label: 'Rejada', cls: 'bg-blue-50 text-blue-600', Icon: Clock },
  PUBLISHED: { label: 'Joylandi', cls: 'bg-green-50 text-green-600', Icon: CheckCircle2 },
  FAILED: { label: 'Xato', cls: 'bg-red-50 text-red-600', Icon: AlertCircle },
  CANCELLED: { label: 'Bekor', cls: 'bg-gray-100 text-gray-500', Icon: X },
};

/** E'lon matnini xavfsiz HTML-ko'rinishga o'giradi (faqat <b>,<i>,<u>,<s>,<code>). */
function previewHtml(raw: string): string {
  const esc = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/&lt;(\/?)(b|strong|i|em|u|s|code)&gt;/gi, '<$1$2>');
}

/** Yuqoridagi kichik statistika kartochkasi. */
function StatMini({ icon: Icon, label, value, cls }: { icon: typeof Users; label: string; value: string; cls: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-3 text-center">
      <span className={`mx-auto mb-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg ${cls}`}>
        <Icon size={16} />
      </span>
      <p className="text-lg font-extrabold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}

export default function ChannelPostsPage() {
  const qc = useQueryClient();
  const { data: config, isLoading: cfgLoading } = useQuery({
    queryKey: ['channel-config'],
    queryFn: apiChannelConfig,
  });
  const { data: posts } = useQuery({ queryKey: ['channel-posts'], queryFn: apiListChannelPosts });

  // Ulangan kanal haqida jonli ma'lumot (nomi, rasmi, obunachilar soni)
  const channelConfigured = !!config?.channelId && !!config?.hasBot;
  const { data: channelInfo, isLoading: infoLoading } = useQuery({
    // channelId bilan kalitlanadi — kanal o'zgarsa eski kartochka ko'rinib qolmaydi
    queryKey: ['channel-info', config?.channelId],
    queryFn: apiChannelInfo,
    enabled: channelConfigured,
  });

  // Kanal ID
  const [channelId, setChannelId] = useState('');
  useEffect(() => {
    if (config) setChannelId(config.channelId);
  }, [config]);
  const saveChannel = useMutation({
    mutationFn: () => apiSetChannel(channelId.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channel-config'] });
      qc.invalidateQueries({ queryKey: ['channel-info'] });
      toast.success('Kanal saqlandi');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Yangi e'lon
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [buyButton, setBuyButton] = useState(true);
  const [buttonText, setButtonText] = useState('');
  const [now, setNow] = useState(false);
  const [when, setWhen] = useState(nowLocalInput(10));
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Bitta media — rasm yoki video (ikkalasi emas)
  async function uploadImg(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const r = await apiUploadImage(file);
      setImageUrl(r.url);
      setVideoUrl('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function uploadVid(file: File | undefined) {
    if (!file) return;
    setUploadingVideo(true);
    try {
      const r = await apiUploadVideo(file);
      setVideoUrl(r.url);
      setImageUrl('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingVideo(false);
    }
  }

  const create = useMutation({
    mutationFn: () =>
      apiCreateChannelPost({
        text: text.trim(),
        imageUrl: imageUrl || undefined,
        videoUrl: videoUrl || undefined,
        buyButton,
        buttonText: buttonText.trim() || undefined,
        scheduledAt: new Date(now ? Date.now() : new Date(when).getTime()).toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channel-posts'] });
      setText('');
      setImageUrl('');
      setVideoUrl('');
      setButtonText('');
      toast.success(now ? "E'lon joylandi" : "E'lon rejaga qo'shildi");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiDeleteChannelPost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channel-posts'] });
      toast.success("E'lon o'chirildi");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const channelReady = !!config?.channelId && config.hasBot;
  const scheduledCount = posts?.filter((p) => p.status === 'SCHEDULED').length ?? 0;
  const publishedCount = posts?.filter((p) => p.status === 'PUBLISHED').length ?? 0;
  const captionLimit = imageUrl || videoUrl ? 1024 : 4096;

  return (
    <div className="pb-10">
      <PageHeader title="Kanal e'lonlari" description="Telegram kanalingizga rejalashtirilgan postlar" />

      <div className="w-full md:max-w-2xl md:mx-auto space-y-3">
        {/* Statistika */}
        {channelConfigured && (
          <div className="grid grid-cols-3 gap-2">
            <StatMini
              icon={Users}
              label="Obunachi"
              value={channelInfo?.subscriberCount != null ? formatCount(channelInfo.subscriberCount) : '—'}
              cls="bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
            />
            <StatMini icon={Clock} label="Rejada" value={String(scheduledCount)} cls="bg-blue-50 text-blue-600" />
            <StatMini icon={CheckCircle2} label="Joylandi" value={String(publishedCount)} cls="bg-green-50 text-green-600" />
          </div>
        )}
        {/* Kanal sozlamasi */}
        <Card>
          <CardHeader title="Kanal" />
          <CardBody className="space-y-3">
            {cfgLoading ? (
              <Skeleton className="h-10" />
            ) : (
              <>
                {!config?.hasBot && (
                  <div className="flex gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p className="flex-1 leading-snug">
                      Avval <b>Sozlamalar → Telegram bot</b> bo&apos;limidan botingizni ulang.
                    </p>
                  </div>
                )}
                <Field
                  label="Kanal ID yoki @username"
                  hint="Botingizni shu kanalga ADMIN qiling. Masalan: -1001234567890 yoki @mychannel"
                >
                  <Input
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    placeholder="-1001234567890"
                    className="font-mono"
                  />
                </Field>
                <Button loading={saveChannel.isPending} onClick={() => saveChannel.mutate()}>
                  Kanalni saqlash
                </Button>

                {/* Ulangan kanal — jonli ko'rinish (nomi, rasmi, obunachilar soni) */}
                {channelConfigured &&
                  (infoLoading ? (
                    <Skeleton className="h-[68px] rounded-xl" />
                  ) : channelInfo?.connected ? (
                    <div className="rounded-2xl border border-[var(--color-primary)]/20 bg-gradient-to-br from-[var(--color-primary)]/[0.07] to-transparent p-3.5">
                      <div className="flex items-center gap-3">
                        {channelInfo.photoDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={channelInfo.photoDataUrl}
                            alt=""
                            className="h-12 w-12 rounded-full object-cover shrink-0 border border-[var(--color-border)]"
                          />
                        ) : (
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-primary)]/10 text-lg font-bold text-[var(--color-primary)]">
                            {(channelInfo.title || '#').trim().slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm truncate">{channelInfo.title || 'Kanal'}</p>
                            <CheckCircle2 size={15} className="text-[var(--color-success)] shrink-0" />
                          </div>
                          {channelInfo.username && (
                            <p className="text-xs text-[var(--color-text-muted)] truncate">@{channelInfo.username}</p>
                          )}
                          {channelInfo.subscriberCount != null && (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                              <Users size={13} /> {formatCount(channelInfo.subscriberCount)} obunachi
                            </p>
                          )}
                        </div>
                      </div>
                      {!channelInfo.isAdmin && (
                        <div className="mt-2.5 flex gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-[11px] text-amber-700">
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          <p className="leading-snug">
                            Obunachilar soni va e&apos;lon joylash uchun botni kanalga <b>ADMIN</b> qiling.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : channelInfo && !channelInfo.connected ? (
                    <div className="flex gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <p className="flex-1 leading-snug">{channelInfo.reason}</p>
                    </div>
                  ) : null)}
              </>
            )}
          </CardBody>
        </Card>

        {/* Yangi e'lon */}
        <Card>
          <CardHeader title="Yangi e'lon" />
          <CardBody className="space-y-3">
            <Field label="Matn">
              <Textarea
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="E'lon matni… (HTML qo'llab-quvvatlanadi: <b>, <i>)"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                <span>Formatlash: &lt;b&gt; &lt;i&gt; &lt;u&gt;</span>
                <span className={text.length > captionLimit ? 'font-semibold text-[var(--color-danger)]' : ''}>
                  {text.length.toLocaleString('ru-RU')} / {captionLimit.toLocaleString('ru-RU')}
                </span>
              </div>
            </Field>

            <Field label="Rasm yoki video (ixtiyoriy)">
              {imageUrl ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="post" className="h-28 rounded-xl object-cover border border-[var(--color-border)]" />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute -top-2 -right-2 h-6 w-6 grid place-items-center rounded-full bg-[var(--color-danger)] text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : videoUrl ? (
                <div className="relative inline-block">
                  <video src={videoUrl} controls className="h-28 rounded-xl object-cover border border-[var(--color-border)] bg-black" />
                  <button
                    type="button"
                    onClick={() => setVideoUrl('')}
                    className="absolute -top-2 -right-2 h-6 w-6 grid place-items-center rounded-full bg-[var(--color-danger)] text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 h-12 px-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white cursor-pointer">
                    <Upload size={17} className="text-[var(--color-text-muted)]" />
                    <span className="text-sm text-[var(--color-text-muted)]">{uploading ? 'Yuklanmoqda…' : 'Rasm'}</span>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => uploadImg(e.target.files?.[0])}
                    />
                  </label>
                  <label className="flex items-center gap-2 h-12 px-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white cursor-pointer">
                    <Film size={17} className="text-[var(--color-text-muted)]" />
                    <span className="text-sm text-[var(--color-text-muted)]">{uploadingVideo ? 'Yuklanmoqda…' : 'Video'}</span>
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm"
                      className="hidden"
                      onChange={(e) => uploadVid(e.target.files?.[0])}
                    />
                  </label>
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">Bittasini tanlang. Video ~50MB gacha.</p>
            </Field>

            <label className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2.5 cursor-pointer select-none hover:bg-[var(--color-bg)] transition-colors">
              <span className="inline-flex h-9 w-9 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] items-center justify-center shrink-0">
                <ShoppingBag size={17} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">&quot;Sotib olish&quot; tugmasi</span>
                <span className="block text-[11px] text-[var(--color-text-muted)]">Bosilganda do&apos;kon ochiladi</span>
              </span>
              <input
                type="checkbox"
                checked={buyButton}
                onChange={(e) => setBuyButton(e.target.checked)}
                className="h-5 w-5 accent-[var(--color-primary)] shrink-0"
              />
            </label>
            {buyButton && (
              <Field label="Tugma matni (ixtiyoriy)">
                <Input
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="🛍 Sotib olish"
                />
              </Field>
            )}

            <label className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2.5 cursor-pointer select-none hover:bg-[var(--color-bg)] transition-colors">
              <span className="inline-flex h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 items-center justify-center shrink-0">
                <Send size={17} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">Hozir joylash</span>
                <span className="block text-[11px] text-[var(--color-text-muted)]">Darhol kanalga yuboriladi</span>
              </span>
              <input
                type="checkbox"
                checked={now}
                onChange={(e) => setNow(e.target.checked)}
                className="h-5 w-5 accent-[var(--color-primary)] shrink-0"
              />
            </label>
            {!now && (
              <Field label="Joylanadigan sana va vaqt">
                <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} min={nowLocalInput()} />
              </Field>
            )}

            {/* Jonli ko'rinish — kanalda qanday chiqishi */}
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <Eye size={13} /> Kanalda qanday ko&apos;rinadi
              </p>
              <div className="rounded-2xl bg-[var(--color-bg)] p-3">
                <div className="mx-auto max-w-[330px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
                  {videoUrl ? (
                    <video src={videoUrl} controls className="max-h-52 w-full bg-black object-cover" />
                  ) : imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" className="max-h-52 w-full object-cover" />
                  ) : null}
                  <div className="p-3">
                    <div className="mb-1.5 flex items-center gap-2">
                      {channelInfo?.photoDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={channelInfo.photoDataUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-primary)]/10 text-[10px] font-bold text-[var(--color-primary)]">
                          {(channelInfo?.title || config?.channelId || '#').trim().slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate text-xs font-semibold text-[var(--color-primary)]">
                        {channelInfo?.title || config?.channelId || 'Kanal'}
                      </span>
                    </div>
                    {text.trim() ? (
                      <div
                        className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[var(--color-text)]"
                        dangerouslySetInnerHTML={{ __html: previewHtml(text) }}
                      />
                    ) : (
                      <p className="text-[13px] text-[var(--color-text-muted)]">E&apos;lon matni shu yerda ko&apos;rinadi…</p>
                    )}
                    <p className="mt-2 text-right text-[10px] text-[var(--color-text-muted)]">
                      {now
                        ? 'hozir'
                        : new Date(when).toLocaleString('ru-RU', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                    </p>
                  </div>
                  {buyButton && (
                    <div className="border-t border-[var(--color-border)] p-2">
                      <div className="rounded-lg bg-[var(--color-primary)]/10 py-2 text-center text-[13px] font-semibold text-[var(--color-primary)]">
                        {buttonText.trim() || '🛍 Sotib olish'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Button
              loading={create.isPending}
              disabled={!channelReady || text.trim().length < 1}
              onClick={() => create.mutate()}
            >
              <Send size={16} /> {now ? 'Hozir joylash' : "Rejaga qo'shish"}
            </Button>
            {!channelReady && (
              <p className="text-xs text-[var(--color-text-muted)]">
                E&apos;lon joylash uchun avval kanal va botni sozlang.
              </p>
            )}
          </CardBody>
        </Card>

        {/* Ro'yxat */}
        <Card>
          <CardHeader title="E'lonlar" />
          <CardBody className="space-y-2">
            {!posts?.length ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-bg)] text-[var(--color-text-muted)]">
                  <Radio size={22} />
                </span>
                <p className="text-sm text-[var(--color-text-muted)]">Hozircha e&apos;lonlar yo&apos;q</p>
              </div>
            ) : (
              posts.map((p) => {
                const s = STATUS[p.status];
                return (
                  <div key={p.id} className="flex gap-3 rounded-xl border border-[var(--color-border)] p-3">
                    {p.videoUrl ? (
                      <span className="h-14 w-14 rounded-lg bg-black/80 grid place-items-center shrink-0 text-white">
                        <Film size={20} />
                      </span>
                    ) : p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
                          <s.Icon size={12} /> {s.label}
                        </span>
                        {p.buyButton && <ShoppingBag size={13} className="text-[var(--color-primary)]" />}
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                          {new Date(p.scheduledAt).toLocaleString('ru-RU', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm line-clamp-2 break-words">{p.text}</p>
                      {p.status === 'FAILED' && p.error && (
                        <p className="text-[11px] text-[var(--color-danger)] mt-1">{p.error}</p>
                      )}
                    </div>
                    <button
                      onClick={() => del.mutate(p.id)}
                      className="shrink-0 h-8 w-8 grid place-items-center rounded-lg text-[var(--color-danger)] hover:bg-red-50"
                      title="O'chirish"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

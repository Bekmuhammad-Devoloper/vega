'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Upload } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Sheet } from '@/components/ui/sheet';
import { Field, Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiCreateBanner,
  apiDeleteBanner,
  apiListBanners,
  apiUpdateBanner,
  apiUploadImage,
} from '@/lib/endpoints';
import { toast } from '@/stores/toast-store';
import type { BannerView } from '@/lib/types';
import { useRef } from 'react';

interface FormData {
  placement: string;
  imageUrlUz: string;
  imageUrlRu: string;
  targetType: string;
  targetValue: string;
  position: number;
  isActive: boolean;
}

const EMPTY: FormData = {
  placement: 'home',
  imageUrlUz: '',
  imageUrlRu: '',
  targetType: 'none',
  targetValue: '',
  position: 0,
  isActive: true,
};

export default function BannersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-banners'], queryFn: () => apiListBanners() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BannerView | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (files: FileList) => {
    setUploading(true);
    try {
      const res = await apiUploadImage(files[0]!);
      setForm((f) => ({ ...f, imageUrlUz: res.url }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (b: BannerView) => {
    setEditing(b);
    setForm({
      placement: b.placement,
      imageUrlUz: b.imageUrlUz,
      imageUrlRu: b.imageUrlRu ?? '',
      targetType: b.targetType,
      targetValue: b.targetValue ?? '',
      position: b.position,
      isActive: b.isActive,
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        placement: form.placement,
        imageUrlUz: form.imageUrlUz,
        imageUrlRu: form.imageUrlRu || undefined,
        targetType: form.targetType,
        targetValue: form.targetValue || undefined,
        position: form.position,
        isActive: form.isActive,
      };
      return editing ? apiUpdateBanner(editing.id, body) : apiCreateBanner(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-banners'] });
      setOpen(false);
      toast.success('Saqlandi');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDeleteBanner(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-banners'] });
      toast.success("O'chirildi");
    },
  });

  return (
    <div>
      <PageHeader title="Bannerlar" rightSlot={<Button size="sm" onClick={openCreate}><Plus size={16} /> Yangi</Button>} />

      {isLoading || !data ? (
        <Skeleton className="h-40" />
      ) : data.length === 0 ? (
        <Card>
          <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">Bannerlar yo&apos;q</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.map((b) => (
            <Card key={b.id}>
              <button onClick={() => openEdit(b)} className="block w-full text-left">
                <div className="relative aspect-[2.4/1] bg-gray-100 rounded-t-2xl overflow-hidden">
                  <Image src={b.imageUrlUz} alt="" fill className="object-cover" sizes="600px" />
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{b.placement}</span>
                    <div className="flex gap-1">
                      {b.isActive ? <Badge tone="green">Faol</Badge> : <Badge tone="gray">Off</Badge>}
                      <Badge tone="blue">#{b.position}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {b.targetType}{b.targetValue ? ` → ${b.targetValue.slice(0, 30)}...` : ''}
                  </p>
                </div>
              </button>
              <div className="px-3 pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("O'chirilsinmi?")) deleteMut.mutate(b.id);
                  }}
                >
                  <Trash2 size={14} /> O&apos;chirish
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'Tahrirlash' : 'Yangi banner'}>
        <div className="space-y-3">
          <Field label="Placement">
            <Select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>
              <option value="home">Home</option>
              <option value="category">Category</option>
            </Select>
          </Field>
          <Field label="Rasm">
            {form.imageUrlUz ? (
              <div className="relative aspect-[2.4/1] rounded-xl overflow-hidden bg-gray-100 mb-2">
                <Image src={form.imageUrlUz} alt="" fill className="object-cover" sizes="600px" />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full h-11 rounded-xl border-2 border-dashed border-[var(--color-border)] flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              {uploading ? 'Yuklanmoqda...' : <><Upload size={16} /> Rasm yuklash</>}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files && upload(e.target.files)}
            />
          </Field>
          <Field label="Target turi">
            <Select value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value })}>
              <option value="none">Yo&apos;q</option>
              <option value="product">Mahsulot (ID)</option>
              <option value="category">Kategoriya (ID)</option>
              <option value="url">URL</option>
            </Select>
          </Field>
          {form.targetType !== 'none' && (
            <Field label="Target qiymati">
              <Input value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: e.target.value })} />
            </Field>
          )}
          <Field label="Tartib (kichikroq raqam — birinchi)">
            <Input type="number" value={form.position} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} />
          </Field>
          <label className="flex items-center justify-between text-sm">
            <span>Faol</span>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-5 w-9 appearance-none rounded-full bg-gray-200 checked:bg-[var(--color-primary)] relative cursor-pointer before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white checked:before:translate-x-4 before:transition-transform"
            />
          </label>
          <Button fullWidth disabled={!form.imageUrlUz} loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
            Saqlash
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

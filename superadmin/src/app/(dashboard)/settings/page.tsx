'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Save,
  Trash2,
  Sparkles,
  CreditCard,
  Mail,
  Bot,
  Flag,
  Cog,
  Search,
  KeyRound,
  Settings as SettingsIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import {
  apiDeleteSetting,
  apiFetchSettingCategories,
  apiFetchSettings,
  apiUpsertSetting,
} from '@/lib/endpoints';
import { formatRelative } from '@/lib/format';
import { toast } from '@/stores/toast-store';
import { cn } from '@/lib/cn';

const CATEGORY_META: Record<
  string,
  { label: string; icon: typeof SettingsIcon; color: string; description: string }
> = {
  ai: {
    label: 'AI Providers',
    icon: Sparkles,
    color: 'text-[var(--color-primary)]',
    description: 'OpenAI, Anthropic API kalitlari va konfiguratsiya',
  },
  payment: {
    label: "To'lov tizimlari",
    icon: CreditCard,
    color: 'text-[var(--color-success)]',
    description: 'Payme, Click sozlamalari',
  },
  email: {
    label: 'Email',
    icon: Mail,
    color: 'text-[var(--color-info)]',
    description: 'SMTP, email shablonlar',
  },
  telegram: {
    label: 'Telegram',
    icon: Bot,
    color: 'text-[var(--color-info)]',
    description: 'Master bot, kanal IDlar',
  },
  features: {
    label: 'Feature flags',
    icon: Flag,
    color: 'text-[var(--color-warning)]',
    description: "Yangi funksiyalarni yoqish/o'chirish",
  },
  general: {
    label: 'Umumiy',
    icon: Cog,
    color: 'text-[var(--color-text-muted)]',
    description: 'Boshqa platforma sozlamalari',
  },
};

const DEFAULT_CATEGORIES = ['ai', 'payment', 'email', 'telegram', 'features', 'general'];

export default function SettingsPage() {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<string>('ai');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const settings = useQuery({
    queryKey: ['settings', activeCategory],
    queryFn: () => apiFetchSettings(activeCategory),
  });

  const categories = useQuery({
    queryKey: ['setting-categories'],
    queryFn: apiFetchSettingCategories,
  });

  const filtered = useMemo(() => {
    if (!settings.data) return [];
    if (!search.trim()) return settings.data;
    const q = search.toLowerCase();
    return settings.data.filter((s) => s.key.toLowerCase().includes(q));
  }, [settings.data, search]);

  return (
    <>
      <PageHeader
        title="Platforma sozlamalari"
        subtitle="AI keys, to'lov, email, feature flag va boshqa global config"
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            Yangi sozlama
          </Button>
        }
      />

      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar — kategoriyalar */}
        <Card className="col-span-12 md:col-span-3 p-2 h-fit md:sticky md:top-4">
          <ul className="space-y-0.5">
            {DEFAULT_CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat];
              const Icon = meta.icon;
              const count =
                categories.data?.find((c) => c.category === cat)?.count ?? 0;
              const active = activeCategory === cat;
              return (
                <li key={cat}>
                  <button
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all relative',
                      active
                        ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]',
                      active && 'dot-active',
                    )}
                  >
                    <Icon size={16} className={active ? '' : meta.color} />
                    <span className="flex-1 text-left font-medium">{meta.label}</span>
                    {count > 0 && (
                      <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-[var(--color-surface-elevated)]">
                        {count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Main */}
        <div className="col-span-12 md:col-span-9 space-y-4">
          {/* Header */}
          <Card>
            <CardBody className="flex items-center gap-4">
              <div
                className={`h-12 w-12 rounded-xl bg-[var(--color-surface-hover)] grid place-items-center ${CATEGORY_META[activeCategory].color}`}
              >
                {(() => {
                  const Icon = CATEGORY_META[activeCategory].icon;
                  return <Icon size={22} />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-[var(--color-text)]">
                  {CATEGORY_META[activeCategory].label}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {CATEGORY_META[activeCategory].description}
                </p>
              </div>
              <div className="relative w-64">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)] pointer-events-none"
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Key bo'yicha qidirish..."
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </CardBody>
          </Card>

          {/* Settings list */}
          {settings.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardBody className="py-16 text-center">
                <div className="inline-flex h-14 w-14 rounded-2xl bg-[var(--color-surface-hover)] grid place-items-center text-[var(--color-text-subtle)] mb-3">
                  <KeyRound size={24} />
                </div>
                <p className="text-sm text-[var(--color-text-muted)] mb-1">
                  Bu kategoriyada hali sozlamalar yo'q
                </p>
                <p className="text-xs text-[var(--color-text-subtle)] mb-4">
                  "Yangi sozlama" tugmasini bosib boshlang
                </p>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus size={14} />
                  Birinchi sozlamani qo'shing
                </Button>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((setting) => (
                <SettingRow
                  key={setting.key}
                  setting={setting}
                  onChanged={() => {
                    qc.invalidateQueries({ queryKey: ['settings'] });
                    qc.invalidateQueries({ queryKey: ['setting-categories'] });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateSettingModal
        open={createOpen}
        defaultCategory={activeCategory}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['settings'] });
          qc.invalidateQueries({ queryKey: ['setting-categories'] });
          setCreateOpen(false);
        }}
      />
    </>
  );
}

function SettingRow({
  setting,
  onChanged,
}: {
  setting: {
    key: string;
    value: unknown;
    category: string;
    updatedAt: string;
  };
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(JSON.stringify(setting.value, null, 2));

  const save = useMutation({
    mutationFn: () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(draft);
      } catch {
        parsed = draft;
      }
      return apiUpsertSetting(setting.key, {
        category: setting.category,
        value: parsed,
      });
    },
    onSuccess: () => {
      toast.success('Saqlandi');
      setEditing(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => apiDeleteSetting(setting.key),
    onSuccess: () => {
      toast.success("O'chirildi");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valuePreview = useMemo(() => {
    if (typeof setting.value === 'string') return setting.value;
    return JSON.stringify(setting.value);
  }, [setting.value]);

  return (
    <Card className="card-hover">
      <CardBody>
        <div className="flex items-start gap-3 mb-3">
          <div className="h-9 w-9 rounded-lg bg-[var(--color-primary)]/15 grid place-items-center text-[var(--color-primary)] shrink-0">
            <KeyRound size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-mono font-semibold text-[var(--color-text)] break-all">
                {setting.key}
              </p>
              <Badge variant="default">{setting.category}</Badge>
            </div>
            <p className="text-[10px] text-[var(--color-text-subtle)] mt-1">
              Oxirgi yangilanish: {formatRelative(setting.updatedAt)}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setDraft(JSON.stringify(setting.value, null, 2));
                  }}
                >
                  Bekor
                </Button>
                <Button size="sm" onClick={() => save.mutate()} loading={save.isPending}>
                  <Save size={12} />
                  Saqlash
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  Tahrirlash
                </Button>
                <button
                  onClick={() => {
                    if (confirm(`"${setting.key}" o'chirilsinmi?`)) remove.mutate();
                  }}
                  className="h-9 w-9 rounded-lg grid place-items-center text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {editing ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            className="font-mono text-xs"
          />
        ) : (
          <pre className="text-xs font-mono bg-[var(--color-bg)] rounded-lg p-3 overflow-x-auto text-[var(--color-text-muted)] max-h-32">
            {valuePreview}
          </pre>
        )}
      </CardBody>
    </Card>
  );
}

function CreateSettingModal({
  open,
  defaultCategory,
  onClose,
  onCreated,
}: {
  open: boolean;
  defaultCategory: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [key, setKey] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [value, setValue] = useState('""');

  const save = useMutation({
    mutationFn: () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = value;
      }
      return apiUpsertSetting(key, { category, value: parsed });
    },
    onSuccess: () => {
      toast.success('Yaratildi');
      setKey('');
      setValue('""');
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open={open} onClose={onClose} title="Yangi sozlama" size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-3"
      >
        <Field label="Key" hint="masalan: openai.api_key, payme.merchant_id">
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="openai.api_key"
            required
            autoFocus
          />
        </Field>
        <Field label="Kategoriya">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {DEFAULT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Qiymat (JSON)" hint='String uchun "sk-..." formatda yozing'>
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            className="font-mono text-xs"
            placeholder='"sk-proj-..."'
          />
        </Field>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Bekor
          </Button>
          <Button type="submit" loading={save.isPending}>
            Yaratish
          </Button>
        </div>
      </form>
    </Modal>
  );
}

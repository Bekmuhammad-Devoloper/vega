'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Shield } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Sheet } from '@/components/ui/sheet';
import { Field, Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiCreateAdmin, apiDeleteAdmin, apiListAdmins, apiUpdateAdmin } from '@/lib/endpoints';
import type { AdminDto, AdminRole } from '@/lib/types';
import { toast } from '@/stores/toast-store';
import { formatDateTime } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';

interface FormData {
  email: string;
  password: string;
  fullName: string;
  role: AdminRole;
}

const EMPTY: FormData = { email: '', password: '', fullName: '', role: 'ADMIN' };

export default function AdminsPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.admin);
  const { data, isLoading } = useQuery({ queryKey: ['admins'], queryFn: apiListAdmins });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminDto | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (a: AdminDto) => {
    setEditing(a);
    setForm({ email: a.email, password: '', fullName: a.fullName, role: a.role });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: () =>
      editing
        ? apiUpdateAdmin(editing.id, {
            fullName: form.fullName,
            role: form.role,
            ...(form.password ? { password: form.password } : {}),
          })
        : apiCreateAdmin(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      setOpen(false);
      toast.success('Saqlandi');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDeleteAdmin(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      toast.success('Deaktivlashtirildi');
    },
  });

  return (
    <div>
      <PageHeader
        title="Adminlar"
        description="Faqat superadmin yaratishi mumkin"
        rightSlot={<Button size="sm" onClick={openCreate}><Plus size={16} /> Yangi</Button>}
      />

      {isLoading || !data ? (
        <Skeleton className="h-40" />
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--color-border)]">
            {data.map((a) => (
              <li key={a.id} className="px-4 py-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] grid place-items-center font-semibold">
                  <Shield size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{a.fullName}</p>
                    <Badge tone={a.role === 'SUPERADMIN' ? 'red' : a.role === 'ADMIN' ? 'blue' : 'gray'}>{a.role}</Badge>
                    {!a.isActive && <Badge tone="gray">Off</Badge>}
                    {me?.id === a.id && <Badge tone="indigo">Siz</Badge>}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">{a.email} · {formatDateTime(a.createdAt)}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => openEdit(a)}>Edit</Button>
                {me?.id !== a.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Deaktivlashtirilsinmi?")) remove.mutate(a.id);
                    }}
                  >
                    Off
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'Tahrirlash' : 'Yangi admin'}>
        <div className="space-y-3">
          {!editing && (
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          )}
          <Field label="To'liq ism">
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </Field>
          <Field label="Rol">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}>
              <option value="MANAGER">Manager (buyurtmalar, support)</option>
              <option value="ADMIN">Admin (deyarli hammasi)</option>
              <option value="SUPERADMIN">Superadmin (hammasi)</option>
            </Select>
          </Field>
          <Field label={editing ? 'Yangi parol (bo\'sh qoldirsangiz o\'zgarmaydi)' : 'Parol'}>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Button
            fullWidth
            loading={save.isPending}
            disabled={!form.fullName || (!editing && (!form.email || !form.password))}
            onClick={() => save.mutate()}
          >
            Saqlash
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

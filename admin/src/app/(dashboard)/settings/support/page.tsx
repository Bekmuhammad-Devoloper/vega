'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { LifeBuoy, Send } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiSendSupport } from '@/lib/endpoints';
import { toast } from '@/stores/toast-store';
import { SettingsHeader, useStore } from '../_shared';

export default function SupportSettingsPage() {
  const { data, isLoading } = useStore();
  const tenant = data?.tenant ?? null;
  const prioritySupport = data?.limits?.prioritySupport ?? false;

  const [supportMsg, setSupportMsg] = useState('');
  const sendSupport = useMutation({
    mutationFn: () => apiSendSupport(supportMsg.trim()),
    onSuccess: (r) => {
      setSupportMsg('');
      toast.success(
        r.priority ? "Ustuvor so'rovingiz yuborildi — tez orada javob beramiz" : "So'rovingiz yuborildi",
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div>
      <SettingsHeader title="Qo'llab-quvvatlash" description="Savol yoki muammo bo'lsa bizga yozing" />

      {isLoading ? (
        <div className="max-w-2xl">
          <Skeleton className="h-56" />
        </div>
      ) : !tenant ? (
        <Card>
          <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">Do&apos;kon topilmadi</div>
        </Card>
      ) : (
        <div className="max-w-2xl">
          <Card>
            <CardHeader title="Qo'llab-quvvatlash" />
            <CardBody className="space-y-3">
              <div
                className={`flex gap-3 rounded-xl px-3 py-2.5 text-xs border ${
                  prioritySupport ? 'bg-amber-50 border-amber-200' : 'bg-[var(--color-bg)] border-[var(--color-border)]'
                }`}
              >
                <LifeBuoy size={16} className={`shrink-0 mt-0.5 ${prioritySupport ? 'text-amber-600' : 'text-[var(--color-text-muted)]'}`} />
                <p className="text-[var(--color-text-muted)]">
                  {prioritySupport ? (
                    <>
                      ⭐ <b className="text-amber-700">Ustuvor qo&apos;llab-quvvatlash</b> — so&apos;rovlaringiz birinchi
                      navbatda ko&apos;rib chiqiladi.
                    </>
                  ) : (
                    <>
                      Savol yoki muammo bo&apos;lsa bizga yozing. <b>Standart+</b> tariflarda so&apos;rovlar ustuvor
                      (tezroq) ko&apos;riladi.
                    </>
                  )}
                </p>
              </div>
              <Field label="Xabaringiz" hint="Kamida 5 ta belgi">
                <Textarea
                  rows={4}
                  value={supportMsg}
                  onChange={(e) => setSupportMsg(e.target.value)}
                  placeholder="Muammo yoki savolingizni yozing…"
                />
              </Field>
              {supportMsg.trim().length > 0 && supportMsg.trim().length < 5 && (
                <p className="-mt-1 text-[11px] text-amber-600">
                  Yana {5 - supportMsg.trim().length} ta belgi yozing
                </p>
              )}
              <Button loading={sendSupport.isPending} disabled={supportMsg.trim().length < 5} onClick={() => sendSupport.mutate()}>
                <Send size={16} /> Yuborish
              </Button>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

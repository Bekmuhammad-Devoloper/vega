'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/shop/page-header';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiCreateTicket } from '@/lib/api/endpoints';
import { useTelegramBackButton } from '@/hooks/use-telegram';
import { useLocaleStore } from '@/stores/locale-store';
import { getMessages, tr } from '@/i18n';
import { toast } from '@/stores/toast-store';
import { haptic } from '@/lib/telegram';
import { CheckCircle2 } from 'lucide-react';

export default function SupportPage() {
  useTelegramBackButton();
  const locale = useLocaleStore((s) => s.locale);
  const messages = getMessages(locale);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const createMut = useMutation({
    mutationFn: () => apiCreateTicket({ subject, message }),
    onSuccess: () => {
      haptic('success');
      toast.success(tr(messages, 'support.sent'));
      setSubject('');
      setMessage('');
    },
    onError: (err: Error) => {
      haptic('error');
      toast.error(err.message);
    },
  });

  const canSubmit = subject.trim().length >= 2 && message.trim().length >= 2;

  return (
    <div>
      <PageHeader title={tr(messages, 'support.title')} />
      <div className="px-4 py-4 space-y-3">
        <div className="bg-[var(--color-primary)]/5 rounded-2xl p-3 flex items-start gap-2 text-sm">
          <CheckCircle2 className="text-[var(--color-primary)] shrink-0 mt-0.5" size={18} />
          <p className="text-[var(--color-text-muted)]">
            Savol yoki muammo bo&apos;lsa, biz bilan bog&apos;laning. Tez orada javob beramiz.
          </p>
        </div>

        <div>
          <label className="text-sm text-[var(--color-text-muted)]">{tr(messages, 'support.subject')}</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={tr(messages, 'support.subject')} />
        </div>
        <div>
          <label className="text-sm text-[var(--color-text-muted)]">{tr(messages, 'support.message')}</label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder={tr(messages, 'support.message')} />
        </div>

        <Button
          fullWidth
          size="lg"
          disabled={!canSubmit}
          loading={createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          {tr(messages, 'support.send')}
        </Button>
      </div>
    </div>
  );
}

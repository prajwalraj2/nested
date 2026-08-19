// src/components/site/JobApplicationForm.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RESUME_MAX_BYTES } from '@/lib/job-types';

/**
 * The application form for one role (M-8).
 *
 * ⚠️ SUBMITS `FormData`, NOT JSON — the only form on this site that does, because it carries a
 * file. Note what is NOT set: no `Content-Type` header. The browser must generate it itself, since
 * a multipart content type includes a generated boundary string; setting it by hand produces a
 * body the server cannot parse, and the error looks like a malformed request rather than a
 * mistake in this line.
 */

type Props = {
  jobId: string;
  jobTitle: string;
  issuedAt: string;
  formToken: string;
  honeypotField: string;
};

type Status = { kind: 'idle' | 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

export function JobApplicationForm({
  jobId,
  jobTitle,
  issuedAt,
  formToken,
  honeypotField,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'sending' });

    const form = new FormData(event.currentTarget);
    form.set('jobId', jobId);
    form.set('issuedAt', issuedAt);
    form.set('formToken', formToken);

    /*
      ⚠️ CHECKED HERE TOO, PURELY AS A COURTESY. The server enforces the real cap and the real type
      check — this one exists so someone attaching a 20 MB scan learns about it instantly instead
      of after uploading it over a slow connection. It is not a security control and must never be
      mistaken for one: it is absent from a `curl`.
    */
    const file = form.get('resume');
    if (file instanceof File && file.size > RESUME_MAX_BYTES) {
      setStatus({ kind: 'error', message: 'That file is over 2 MB. Please attach a smaller PDF.' });
      return;
    }

    try {
      const response = await fetch('/api/careers/apply', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = Array.isArray(data?.fields) && data.fields[0]?.message;
        setStatus({
          kind: 'error',
          message: detail || data?.error || 'Something went wrong. Please try again.',
        });
        return;
      }

      setStatus({ kind: 'sent' });
    } catch {
      setStatus({
        kind: 'error',
        message: 'Could not reach the server. Please check your connection.',
      });
    }
  }

  if (status.kind === 'sent') {
    return (
      <div className="border-border bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Application received.</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Thank you for applying for <strong>{jobTitle}</strong>. Your CV has been stored privately
          and is read only by us. If it looks like a fit we will email you; either way you will hear
          something once the role closes.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => {
            /*
              A fresh token, and the file input cleared, via a server re-render. Same reasoning as
              the feedback form's "Send another": navigating to the current URL is a no-op.
            */
            setStatus({ kind: 'idle' });
            setFileName(null);
            router.refresh();
          }}
        >
          Apply for this role again
        </Button>
      </div>
    );
  }

  const sending = status.kind === 'sending';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* The honeypot — see the long note in FeedbackForm.tsx. */}
      <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor={`${honeypotField}-apply`}>Subject line</label>
        <input
          id={`${honeypotField}-apply`}
          name={honeypotField}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="applicant-name">Your name</Label>
          <Input
            id="applicant-name"
            name="name"
            type="text"
            required
            maxLength={120}
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="applicant-email">Your email</Label>
          <Input
            id="applicant-email"
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="email"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="resume">Your CV (PDF, under 2 MB)</Label>
        <Input
          id="resume"
          name="resume"
          type="file"
          required
          /*
            ⚠️ `accept` FILTERS THE FILE PICKER; IT DOES NOT VALIDATE. A person can still choose
            "All files" in most browsers, and a script ignores the attribute entirely. The server
            checks the first five bytes of the file itself, which is the only check that means
            anything. This is here so the picker is not full of irrelevant files.
          */
          accept="application/pdf,.pdf"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          className="file:text-foreground file:mr-3 file:cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium"
        />
        {fileName && <p className="text-muted-foreground truncate text-xs">{fileName}</p>}
      </div>

      {status.kind === 'error' && (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {status.message}
        </p>
      )}

      <Button type="submit" disabled={sending}>
        {sending ? 'Sending…' : 'Apply for this role'}
      </Button>
    </form>
  );
}

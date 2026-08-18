// src/components/site/SubmitForm.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SUBMISSION_KINDS, type SubmissionKind } from '@/lib/submission-kinds';

/**
 * The public submission form (M-6).
 *
 * ⚠️ THE SIGNED TOKEN AND THE DOMAIN LIST BOTH ARRIVE AS PROPS. Signing needs `AUTH_SECRET`, which
 * must never be reachable from a `'use client'` module, and the domain list is country-filtered on
 * the server — see the notes in the page component.
 */

type NavDomainOption = { id: string; name: string };

type Props = {
  domains: NavDomainOption[];
  /** Resolved from `?from=` on the server, so the select is correct in the first HTML. */
  preselectedDomainId?: string;
  issuedAt: string;
  formToken: string;
  honeypotField: string;
};

/**
 * ⚠️ A SENTINEL, BECAUSE RADIX FORBIDS `value=""`.
 *
 * "Not sure" has to be a first-class answer — the plan is explicit that it must not be an empty
 * select the visitor has to guess at. But shadcn's `Select` is a Radix listbox, and Radix THROWS
 * if a `SelectItem` has an empty-string value: it reserves `""` for "nothing is selected", which is
 * how the placeholder works. So the option needs a real value, mapped back to "no domain" when the
 * request is built.
 */
const NOT_SURE = '__not_sure__';

type Status = { kind: 'idle' | 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

export function SubmitForm({
  domains,
  preselectedDomainId,
  issuedAt,
  formToken,
  honeypotField,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  /*
    ⚠️ CONTROLLED STATE FOR BOTH SELECTS. A Radix `Select` renders a `<button>` plus a portalled
    list, so it does NOT appear in `new FormData(form)` — the same trap that would have posted
    `category: null` on every feedback report. Anything in a `Select` has to be lifted.
  */
  const [kind, setKind] = useState<SubmissionKind>(SUBMISSION_KINDS[0].value);
  const [domainId, setDomainId] = useState<string>(preselectedDomainId ?? NOT_SURE);

  const isTool = kind === 'tool';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'sending' });

    const form = new FormData(event.currentTarget);
    const productUrl = String(form.get('productUrl') ?? '').trim();

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          productName: form.get('productName'),
          /*
            ⚠️ OMITTED ENTIRELY WHEN BLANK, not sent as `''`. The server's schema makes this
            optional only for a domain request, and an empty string is a PRESENT value that fails
            the URL check — so sending one would produce "give a full link" on a form that never
            asked for a link.
          */
          ...(productUrl ? { productUrl } : {}),
          description: form.get('description'),
          submitterName: form.get('submitterName'),
          submitterEmail: form.get('submitterEmail'),
          // The sentinel means "no domain", so it must not travel to the server as an id.
          ...(domainId !== NOT_SURE ? { domainId } : {}),
          issuedAt,
          formToken,
          [honeypotField]: form.get(honeypotField),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        /*
          ⚠️ THE FIRST FIELD MESSAGE IS SURFACED, not just the generic one. The server returns
          per-field reasons and the most common failure here is the URL scheme check — "Please
          check the form" alone would leave someone re-reading a form that looks fine to them.
        */
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
        <h2 className="text-lg font-semibold">Thank you, that has been sent.</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Every suggestion is read by a person and checked before it goes up, so it will not appear
          straight away. If we need to ask you something we will use the email you left. Good
          suggestions usually go live within a week.
        </p>
        <div className="mt-4 flex gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/">Back to browsing</Link>
          </Button>
          {/*
            ⚠️ A BUTTON, NOT A LINK TO `/submit`. We are already on `/submit`, and Next treats
            navigation to the current URL as a no-op — which is exactly how the feedback form's
            "Send another" ended up being a dead control. `router.refresh()` re-runs the server
            component for a fresh token; the state reset brings the empty form straight back.
          */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus({ kind: 'idle' });
              setKind(SUBMISSION_KINDS[0].value);
              setDomainId(preselectedDomainId ?? NOT_SURE);
              router.refresh();
            }}
          >
            Submit another
          </Button>
        </div>
      </div>
    );
  }

  const sending = status.kind === 'sending';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* The honeypot — see the long note in FeedbackForm.tsx for why it is shaped like this. */}
      <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor={`${honeypotField}-submit`}>Subject line</label>
        <input
          id={`${honeypotField}-submit`}
          name={honeypotField}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="kind">What would you like to do?</Label>
        <Select value={kind} onValueChange={(value) => setKind(value as SubmissionKind)}>
          <SelectTrigger id="kind" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUBMISSION_KINDS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          {SUBMISSION_KINDS.find((k) => k.value === kind)?.hint}
        </p>
      </div>

      {/*
        ⚠️ HIDDEN FOR A DOMAIN REQUEST, not merely disabled. Asking "which domain does this belong
        to?" while someone is requesting a domain that does not exist is a contradiction, and a
        greyed-out control still reads as something they failed to fill in.
      */}
      {isTool && (
        <div className="space-y-2">
          <Label htmlFor="domainId">Which domain does it belong to?</Label>
          <Select value={domainId} onValueChange={setDomainId}>
            <SelectTrigger id="domainId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/*
                ⚠️ "NOT SURE" IS FIRST AND IS A REAL CHOICE. Placing it at the top, above the list,
                is what makes it an answer rather than a way of giving up — and someone who does not
                know our category names is exactly the person whose suggestion we want.
              */}
              <SelectItem value={NOT_SURE}>Not sure — you decide</SelectItem>
              {domains.map((domain) => (
                <SelectItem key={domain.id} value={domain.id}>
                  {domain.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="productName">{isTool ? 'What is it called?' : 'Which field?'}</Label>
        <Input
          id="productName"
          name="productName"
          type="text"
          required
          maxLength={200}
          placeholder={isTool ? 'Figma, freeCodeCamp, …' : 'Photography, Game Audio, …'}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="productUrl">
          Link{' '}
          {!isTool && <span className="text-muted-foreground font-normal">(optional)</span>}
        </Label>
        <Input
          id="productUrl"
          name="productUrl"
          /*
            ⚠️ `type="url"` FOR THE MOBILE KEYBOARD, NOT FOR VALIDATION. The check that matters is
            the server's scheme test, which is stricter than the browser's in the way that counts:
            the browser happily accepts `javascript:alert(1)` as a valid URL.
          */
          type="url"
          required={isTool}
          maxLength={2000}
          placeholder="https://"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          {isTool ? 'Why does it belong here?' : 'What should it cover?'}
        </Label>
        <Textarea
          id="description"
          name="description"
          required
          rows={5}
          maxLength={2000}
          placeholder={
            isTool
              ? 'What it does, who it is for, and whether it is free or paid.'
              : 'The kind of tools, courses and channels this field would need.'
          }
        />
      </div>

      {/*
        ⚠️ REQUIRED HERE, UNLIKE THE FEEDBACK FORM — and the sentence below says why rather than
        leaving someone to wonder why a "free suggestion" wants their address. Acting on a
        suggestion nearly always means asking a question first.
      */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="submitterName">Your name</Label>
          <Input
            id="submitterName"
            name="submitterName"
            type="text"
            required
            maxLength={120}
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="submitterEmail">Your email</Label>
          <Input
            id="submitterEmail"
            name="submitterEmail"
            type="email"
            required
            maxLength={200}
            autoComplete="email"
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        We only use these to ask about this suggestion. No list, no newsletter.
      </p>

      {status.kind === 'error' && (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {status.message}
        </p>
      )}

      <Button type="submit" disabled={sending}>
        {sending ? 'Sending…' : 'Send suggestion'}
      </Button>
    </form>
  );
}

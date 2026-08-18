// src/components/site/FeedbackForm.tsx

'use client';

import { useEffect, useState } from 'react';
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
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from '@/lib/feedback-categories';

/**
 * The public feedback form (M-5).
 * ============================================================================
 *
 * ⚠️ THE SIGNED TOKEN IS MINTED ON THE SERVER AND PASSED IN. It cannot be created here: signing
 * needs `AUTH_SECRET`, and a secret reachable from a `'use client'` file is a secret in the
 * JavaScript bundle. The page component issues it; this component only carries it back.
 */

type Props = {
  /** From `issueFormToken()` on the server — proves when the form was rendered. */
  issuedAt: string;
  formToken: string;
  /** The hidden field's name, imported from `lib/public-forms` by the page so the two agree. */
  honeypotField: string;
};

type Status = { kind: 'idle' | 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

export function FeedbackForm({ issuedAt, formToken, honeypotField }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [pageUrl, setPageUrl] = useState('');

  /*
    ⚠️ THE CATEGORY IS CONTROLLED STATE, WHICH THE NATIVE `<select>` DID NOT NEED.

    shadcn's `Select` is a Radix listbox, not a form control — it renders a `<button>` and a
    portalled list, so it does NOT appear in `new FormData(form)`. Swapping the element without
    also lifting the value into state would have submitted `category: null` on every report, and
    the server would have rejected all of them with an enum error. The trade is worth it for a
    control that matches the rest of the site, but it is not a drop-in replacement.
  */
  const [category, setCategory] = useState<FeedbackCategory>(FEEDBACK_CATEGORIES[0].value);

  /*
    ⚠️ `?from=` IS THE REAL SOURCE. `document.referrer` IS ONLY A FALLBACK, AND A WEAK ONE.

    The first version relied on the referrer and every single row arrived with `pageUrl: NULL`.
    The reason is not a bug in this file: `document.referrer` is set when a DOCUMENT loads, and a
    Next `<Link>` is a client-side transition that never reloads the document. Navigating here from
    anywhere inside the site leaves the referrer at whatever the tab was originally opened with —
    usually nothing at all.

    So the header now appends `?from=<path>` to its Feedback link (`resolveHref` in `SiteNav.tsx`),
    which is the one place that reliably knows where the visitor was. The referrer is kept behind
    it because it still works for the case the query string cannot cover: arriving from an EXTERNAL
    site, which is a genuine full document load.

    ⚠️ READ IN AN EFFECT, NOT DURING RENDER. Neither `window` nor `document` exists on the server,
    so reading either during render would produce different HTML on the server and the client — a
    hydration mismatch on every visit. An effect runs only after hydration.
  */
  useEffect(() => {
    const fromParam = new URLSearchParams(window.location.search).get('from');
    setPageUrl(fromParam || document.referrer || '');
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'sending' });

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message: form.get('message'),
          name: form.get('name'),
          email: form.get('email'),
          pageUrl,
          issuedAt,
          formToken,
          [honeypotField]: form.get(honeypotField),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus({
          kind: 'error',
          message: data?.error ?? 'Something went wrong. Please try again.',
        });
        return;
      }

      setStatus({ kind: 'sent' });
    } catch {
      /*
        ⚠️ A NETWORK FAILURE, NOT A SERVER ERROR — the request never arrived, so the wording must
        not imply we received and rejected it. Someone offline should be told to retry, not told
        their message was refused.
      */
      setStatus({ kind: 'error', message: 'Could not reach the server. Please check your connection.' });
    }
  }

  /*
    ⚠️ THE SUCCESS STATE SAYS WHAT HAPPENS NEXT, NOT JUST "THANKS". "Thanks!" leaves someone
    wondering whether to expect a reply, and the honest answer depends on whether they left an
    address — so the message says so rather than implying a response that may never come.
  */
  if (status.kind === 'sent') {
    return (
      <div className="border-border bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Thank you, that has been recorded.</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Every report is read. If you left an email address and the answer needs one, you will
          hear back; otherwise the fix simply appears. Broken links and wrong listings are usually
          sorted within a few days.
        </p>
        <div className="mt-4 flex gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/">Back to browsing</Link>
          </Button>
          {/*
            ⚠️ A BUTTON, NOT A `<Link href="/feedback">` — THE LINK DID NOTHING AT ALL.

            We are already ON `/feedback`. Next's router treats navigation to the current URL as a
            no-op, so nothing re-rendered, `status` stayed `sent`, and the success panel simply sat
            there. It looked like a dead control because it was one.

            `router.refresh()` re-fetches the server component, which mints a FRESH signed token
            and passes it down as a new prop. Resetting `status` in the same handler brings the
            empty form back immediately rather than waiting on the round trip.

            ⚠️ AND MY EARLIER REASONING FOR A FULL RELOAD WAS WRONG. Tokens are not single-use —
            nothing marks one as spent — so re-submitting with the same one would have worked fine.
            The only real constraint is the two-hour expiry, which `refresh()` resets anyway.
          */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus({ kind: 'idle' });
              setCategory(FEEDBACK_CATEGORIES[0].value);
              router.refresh();
            }}
          >
            Send another
          </Button>
        </div>
      </div>
    );
  }

  const sending = status.kind === 'sending';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/*
        ⚠️ THE HONEYPOT. Present and fillable in the DOM, invisible to a person.

        NOT `type="hidden"` and NOT `display: none` — the bots this targets skip both, which would
        make the field decorative. Positioned off-screen instead, which is the one approach that
        leaves it in the form for an automated filler while keeping it off the page for everyone
        else.

        `tabIndex={-1}` keeps it out of the keyboard order and `aria-hidden` keeps it out of a
        screen reader, so nobody navigating without a mouse can land in it by accident and fail a
        check they cannot see. `autoComplete="off"` is belt-and-braces on top of a field name no
        browser autofills.
      */}
      <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor={honeypotField}>Subject line</label>
        <input
          id={honeypotField}
          name={honeypotField}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {/*
        ⚠️ shadcn `Select`, NOT A NATIVE `<select>`. The first version used the native element for
        one defensible reason — it works without JavaScript — but the argument does not survive
        contact with this form: the submit handler is a `fetch`, so the whole thing already
        requires JS. What was left was one control styled unlike every other control on the site,
        including the ones directly beneath it.

        See the note on `category` state above for the catch this swap brings with it.
      */}
      <div className="space-y-2">
        <Label htmlFor="category">What is this about?</Label>
        <Select value={category} onValueChange={(value) => setCategory(value as FeedbackCategory)}>
          <SelectTrigger id="category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FEEDBACK_CATEGORIES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">What happened?</Label>
        <Textarea
          id="message"
          name="message"
          required
          rows={6}
          /*
            ⚠️ MATCHES THE SERVER CAP IN `api/feedback/route.ts`. This one is only a courtesy to
            the person typing — it stops them writing 5,000 characters and losing the overflow to
            an error. The cap that actually protects the database is the zod one, because this
            attribute does not exist in a `curl`.
          */
          maxLength={4000}
          placeholder="The more specific, the faster it gets fixed."
        />
      </div>

      {/*
        ⚠️ NAME AND EMAIL ARE OPTIONAL, AND LABELLED AS SUCH RATHER THAN JUST LACKING AN ASTERISK.
        Requiring an address to report a broken button loses most reports. Saying "optional" out
        loud is what stops someone abandoning the form because they did not want to hand one over.
      */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">
            Your name <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input id="name" name="name" type="text" maxLength={120} autoComplete="name" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            Email <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="email"
            name="email"
            /*
              ⚠️ `type="email"` GIVES A PHONE THE RIGHT KEYBOARD, which is its real value here. Its
              validation is deliberately not relied on — the server check is loose on purpose, and
              a browser refusing to submit a valid-but-unusual address would be the same mistake
              made client-side.
            */
            type="email"
            maxLength={200}
            autoComplete="email"
          />
        </div>
      </div>

      {status.kind === 'error' && (
        <p
          /*
            `role="alert"` so a screen reader announces the failure immediately. Without it the
            message appears silently and someone not looking at that part of the page never learns
            the send failed.
          */
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {status.message}
        </p>
      )}

      {/*
        ⚠️ `pageUrl` IS STILL CAPTURED AND STILL SUBMITTED — only its display was removed.

        It used to render as "About: <url>" beside this button. Dropped on request: it is
        housekeeping the visitor did not ask for and cannot act on, and a long URL made the row
        wrap awkwardly. The value continues to travel in the POST body and to land in
        `Feedback.pageUrl`, which is the part that matters — a UI bug report without the page it
        happened on is close to useless.

        ⚠️ SO DO NOT "TIDY UP" THE `pageUrl` STATE OR THE EFFECT ABOVE as unused. Nothing renders
        it any more, which is exactly what makes that look like dead code.
      */}
      <Button type="submit" disabled={sending}>
        {sending ? 'Sending…' : 'Send feedback'}
      </Button>
    </form>
  );
}

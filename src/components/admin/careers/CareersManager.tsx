// src/components/admin/careers/CareersManager.tsx

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  JOB_CATEGORIES,
  jobCategoryLabel,
  type ApplicationStatus,
} from '@/lib/job-types';

/**
 * Roles and applications (M-8).
 * ============================================================================
 *
 * ⚠️ THIS DIRECTORY IS COVERED BY THE `dangerouslySetInnerHTML` BAN in `eslint.config.mjs`,
 * alongside `admin/feedback` and `admin/submissions` — applicant names and emails are written by
 * strangers. Job titles and descriptions are ours, but the rule is per-directory and the safe
 * direction to be wrong in is this one.
 *
 * ⚠️ NO CV IS EVER RENDERED HERE, AND NO OBJECT KEY IS EVER SENT TO THIS COMPONENT. The list route
 * deliberately omits `resumeKey`; the download link points at `[id]/resume`, which resolves the key
 * server-side behind `requireAdmin()`. If a key ever appears in this file's props, that is the bug.
 */

type JobRow = {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  status: string;
  _count: { applications: number };
};

type ApplicationRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  resumeBytes: number;
  createdAt: string;
  job: { id: string; title: string };
};

const EMPTY_JOB = {
  title: '',
  description: '',
  location: '',
  category: JOB_CATEGORIES[0].value as string,
  status: 'open',
};

export default function CareersManager() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [appStatus, setAppStatus] = useState<'all' | ApplicationStatus>('new');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<JobRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_JOB);
  const [saving, setSaving] = useState(false);

  const [deleteJob, setDeleteJob] = useState<JobRow | null>(null);
  const [deleteApp, setDeleteApp] = useState<ApplicationRow | null>(null);

  const loadJobs = useCallback(async () => {
    const response = await fetch('/api/admin/jobs');
    if (!response.ok) throw new Error('Could not load roles.');
    setJobs((await response.json()).items ?? []);
  }, []);

  const loadApplications = useCallback(async () => {
    const response = await fetch(`/api/admin/applications?status=${appStatus}`);
    if (!response.ok) throw new Error('Could not load applications.');
    const data = await response.json();
    setApplications(data.items ?? []);
    setCounts(data.counts ?? {});
  }, [appStatus]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadJobs(), loadApplications()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load careers data.');
    } finally {
      setLoading(false);
    }
  }, [loadJobs, loadApplications]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(url: string, init: RequestInit, failure: string) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        /*
          ⚠️ THE SERVER'S MESSAGE IS SURFACED, NOT SWALLOWED. Deleting a role with applications
          returns a 409 explaining that closing it is the right move — replacing that with a
          generic failure would leave the admin re-clicking a button that will never work.
        */
        throw new Error(data?.error ?? failure);
      }
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : failure);
      return false;
    }
  }

  async function saveJob() {
    setSaving(true);
    const isEdit = editing !== null;
    const ok = await send(
      isEdit ? `/api/admin/jobs/${editing.id}` : '/api/admin/jobs',
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      },
      isEdit ? 'Could not save that role.' : 'Could not create that role.'
    );
    setSaving(false);
    if (ok) {
      setEditing(null);
      setCreating(false);
      setDraft(EMPTY_JOB);
    }
  }

  const dialogOpen = creating || editing !== null;

  return (
    <div className="space-y-4">
      {error && (
        <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Roles ({jobs.length})</TabsTrigger>
          <TabsTrigger value="applications">
            Applications{counts.new ? ` (${counts.new} new)` : ''}
          </TabsTrigger>
        </TabsList>

        {/* ── Roles ────────────────────────────────────────────────────── */}
        <TabsContent value="jobs" className="space-y-3 pt-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setDraft(EMPTY_JOB);
                setEditing(null);
                setCreating(true);
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              New role
            </Button>
          </div>

          {loading && <p className="text-muted-foreground text-sm">Loading…</p>}

          {!loading && jobs.length === 0 && (
            <div className="border-border text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
              No roles yet. `/careers` shows an honest empty state until one is added.
            </div>
          )}

          <ul className="space-y-2">
            {jobs.map((job) => (
              <li key={job.id} className="border-border bg-card rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{job.title}</p>
                    <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="bg-muted rounded px-1.5 py-0.5 font-medium">
                        {jobCategoryLabel(job.category)}
                      </span>
                      <span>{job.location}</span>
                      <span className={job.status === 'open' ? 'text-foreground' : ''}>
                        {job.status === 'open' ? 'Open' : 'Closed'}
                      </span>
                      <span>
                        {job._count.applications} application
                        {job._count.applications === 1 ? '' : 's'}
                      </span>
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={`Actions for ${job.title}`}>
                        <MoreVertical className="size-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setCreating(false);
                          setEditing(job);
                          setDraft({
                            title: job.title,
                            description: job.description,
                            location: job.location,
                            category: job.category,
                            status: job.status,
                          });
                        }}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                        Edit
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onSelect={() =>
                          send(
                            `/api/admin/jobs/${job.id}`,
                            {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                status: job.status === 'open' ? 'closed' : 'open',
                              }),
                            },
                            'Could not change that role.'
                          )
                        }
                      >
                        {job.status === 'open' ? 'Close role' : 'Reopen role'}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/*
                        ⚠️ DISABLED WHEN THE ROLE HAS APPLICATIONS, matching the server's 409. The
                        server is the real guard — this only saves a pointless round trip and, more
                        usefully, says WHY without needing to try first.
                      */}
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={job._count.applications > 0}
                        onSelect={() => setDeleteJob(job)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        {job._count.applications > 0 ? 'Delete (close it instead)' : 'Delete'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>

        {/* ── Applications ─────────────────────────────────────────────── */}
        <TabsContent value="applications" className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', ...APPLICATION_STATUSES] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={appStatus === value ? 'default' : 'outline'}
                onClick={() => setAppStatus(value)}
              >
                {value === 'all' ? 'All' : APPLICATION_STATUS_LABEL[value]}
                {counts[value] != null && (
                  <span className="ml-1.5 text-xs opacity-70">{counts[value]}</span>
                )}
              </Button>
            ))}
          </div>

          {!loading && applications.length === 0 && (
            <div className="border-border text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
              Nothing here.
            </div>
          )}

          <ul className="space-y-2">
            {applications.map((application) => (
              <li key={application.id} className="border-border bg-card rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="bg-muted rounded px-2 py-0.5 font-medium">
                    {application.job.title}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(application.createdAt).toLocaleString()}
                  </span>
                  <span className="text-muted-foreground ml-auto">
                    {APPLICATION_STATUS_LABEL[application.status] ?? application.status}
                  </span>
                </div>

                <p className="mt-2 text-sm font-medium break-words">{application.name}</p>
                <a
                  href={`mailto:${encodeURIComponent(application.email)}`}
                  className="text-muted-foreground hover:text-foreground text-xs break-all underline"
                >
                  {application.email}
                </a>

                <div className="mt-3 flex flex-wrap gap-2">
                  {/*
                    ⚠️ POINTS AT OUR OWN ROUTE, NEVER AT R2. That route checks the session, looks
                    the object key up from this id, and streams the file back as an attachment.
                    There is no URL anywhere that works without being signed in — which is the
                    entire reason the bucket is private.
                  */}
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/admin/applications/${application.id}/resume`}>
                      <Download className="size-4" aria-hidden="true" />
                      CV ({Math.max(1, Math.round(application.resumeBytes / 1024))} KB)
                    </a>
                  </Button>

                  {APPLICATION_STATUSES.filter((value) => value !== application.status).map(
                    (value) => (
                      <Button
                        key={value}
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          send(
                            `/api/admin/applications/${application.id}`,
                            {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: value }),
                            },
                            'Could not update that application.'
                          )
                        }
                      >
                        {APPLICATION_STATUS_LABEL[value]}
                      </Button>
                    )
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive ml-auto"
                    onClick={() => setDeleteApp(application)}
                    aria-label="Delete this application"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      {/* ── Create / edit a role ─────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (next) return;
          setCreating(false);
          setEditing(null);
        }}
      >
        <DialogContent className="max-h-[85svh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit role' : 'New role'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="job-title">Title</Label>
              <Input
                id="job-title"
                value={draft.title}
                maxLength={200}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-location">Location</Label>
              <Input
                id="job-location"
                value={draft.location}
                maxLength={160}
                placeholder="Remote · India, or Bengaluru"
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="job-category">Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(value) => setDraft((d) => ({ ...d, category: value }))}
                >
                  <SelectTrigger id="job-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-status">Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(value) => setDraft((d) => ({ ...d, status: value }))}
                >
                  <SelectTrigger id="job-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-description">Description</Label>
              <Textarea
                id="job-description"
                rows={10}
                value={draft.description}
                maxLength={20000}
                placeholder="Plain text. Line breaks are kept exactly as typed."
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={saveJob}
              disabled={
                saving ||
                draft.title.trim() === '' ||
                draft.location.trim() === '' ||
                draft.description.trim() === ''
              }
            >
              {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete a role ────────────────────────────────────────────────── */}
      <AlertDialog open={deleteJob !== null} onOpenChange={(next) => !next && setDeleteJob(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this role?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteJob
                ? `"${deleteJob.title}" will be removed permanently. It has no applications, so nothing else is affected.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => {
                if (!deleteJob) return;
                const { id } = deleteJob;
                setDeleteJob(null);
                void send(`/api/admin/jobs/${id}`, { method: 'DELETE' }, 'Could not delete that role.');
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete an application ────────────────────────────────────────── */}
      <AlertDialog open={deleteApp !== null} onOpenChange={(next) => !next && setDeleteApp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this application?</AlertDialogTitle>
            <AlertDialogDescription>
              {/*
                ⚠️ SAYS THE CV GOES TOO. That is the part worth stating out loud: it is the action
                that makes the privacy policy's "kept for the role, then removed" actually true,
                and it is irreversible.
              */}
              {deleteApp
                ? `${deleteApp.name}'s application and their CV will both be permanently deleted — the row from the database and the file from private storage. This cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => {
                if (!deleteApp) return;
                const { id } = deleteApp;
                setDeleteApp(null);
                void send(
                  `/api/admin/applications/${id}`,
                  { method: 'DELETE' },
                  'Could not delete that application.'
                );
              }}
            >
              Delete both
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

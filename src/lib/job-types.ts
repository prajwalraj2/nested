// src/lib/job-types.ts

/**
 * The careers vocabulary and the resume upload rules (M-8).
 * ============================================================================
 *
 * ⚠️ Same reason as `feedback-categories.ts`, `submission-kinds.ts` and `changelog-types.ts`: a
 * Next route handler may only export the HTTP verbs, so a list shared between a route and a
 * component cannot live in the route.
 */

export const JOB_CATEGORIES = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'design', label: 'Design' },
  { value: 'content', label: 'Content' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'operations', label: 'Operations' },
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number]['value'];

export const JOB_CATEGORY_VALUES = JOB_CATEGORIES.map((c) => c.value) as unknown as [
  JobCategory,
  ...JobCategory[],
];

export function jobCategoryLabel(value: string): string {
  return JOB_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/**
 * ⚠️ `closed` HIDES A ROLE; IT DOES NOT DELETE IT. Its applications are records of real people and
 * must stay readable after the role is filled. See the note on `Job.status` in the schema.
 */
export const JOB_STATUSES = ['open', 'closed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const APPLICATION_STATUSES = ['new', 'reviewed', 'shortlisted', 'rejected'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
};

/* ────────────────────────────────────────────────────────────────────────────
   Resume upload rules
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠️ 2 MB. A CV that is not 2 MB is unusual, and every byte above the cap is a byte an attacker
 * chose. The number is here rather than in the route so the form's client-side hint and the
 * server's rejection cannot drift.
 */
export const RESUME_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Is this actually a PDF?
 *
 * ⚠️ MAGIC BYTES, NOT THE FILENAME AND NOT THE MIME TYPE. Both of those are supplied by whoever is
 * uploading: `.pdf` is four characters anyone can type, and `Content-Type: application/pdf` is a
 * header a script sets for free. The first five bytes of the file itself are the only part of the
 * request the uploader cannot fake while still producing a real PDF.
 *
 * ⚠️ AND THIS CHECK CARRIES MORE WEIGHT HERE THAN IT DOES FOR IMAGES. An uploaded image goes
 * through `sharp`, which RE-ENCODES it — anything smuggled inside is destroyed in the process, so
 * the type check is a second line of defence. There is no equivalent for a PDF: it is stored
 * exactly as received, byte for byte. This check and the private bucket are the whole defence.
 */
export function looksLikePdf(buffer: Buffer): boolean {
  // "%PDF-" — every conforming PDF begins with it.
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

/**
 * The object key for one application's CV.
 *
 * ⚠️ THE KEY IS NOT DERIVED FROM THE UPLOADED FILENAME. A filename is attacker-controlled and can
 * contain `../`, a null byte, or 300 characters of unicode; using it would put all of that into an
 * object path. The application's own uuid is unguessable, unique and entirely ours.
 *
 * ⚠️ IT IS ALSO NOT SECRET, AND MUST NOT BE TREATED AS IF IT WERE. The bucket is private, so the
 * key grants nothing on its own — which is the point of `resumeKey` being a key rather than a URL.
 */
export function resumeObjectKey(applicationId: string): string {
  return `resumes/${applicationId}.pdf`;
}

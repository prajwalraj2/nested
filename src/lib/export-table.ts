/**
 * Trigger a browser download of a table's data.
 * ============================================================================
 *
 * WHY THIS IS A SHARED HELPER
 * ---------------------------
 * This logic already worked — inside `TableEditor.handleExport`. But the **Export** items
 * in the tables list (`TablesManager`, both view modes) were rendered with no `onClick`
 * and no link at all: they looked like buttons, were clickable, and did nothing
 * (finding #22.5). Rather than copy the working version a third time — the mistake that
 * produced #22.4's four divergent copies of the same traversal — it lives here once.
 *
 * ⚠️ WHY THE `<a download>` DANCE INSTEAD OF `window.open(url)`
 * The endpoint responds with `Content-Disposition: attachment`, but opening it in a new
 * tab still counts as a navigation: some browsers flash a blank tab, and popup blockers
 * can suppress it entirely when the call is not directly inside a user gesture (which it
 * is not here — it happens after an `await`). Fetching to a blob and clicking a
 * synthetic anchor is the reliable form, and it also lets us name the file.
 *
 * The object URL is revoked immediately after the click. Skipping that leaks the blob for
 * the lifetime of the document, which matters here because a table's export can be
 * megabytes and an admin may export several in a session.
 */

export type TableExportFormat = 'csv' | 'json'

export type ExportResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * @param tableId    the table to export
 * @param baseName   filename without extension — the page slug reads better than an id
 * @param format     `csv` or `json`
 *
 * Returns a result rather than throwing, and never calls `alert()` itself, so each caller
 * can surface failure in a way that suits its own UI. (The existing call site uses
 * `alert()`; replacing that is #22.6, deliberately not bundled in here.)
 */
export async function downloadTableExport(
  tableId: string,
  baseName: string,
  format: TableExportFormat
): Promise<ExportResult> {
  try {
    const response = await fetch(
      `/api/admin/tables/${tableId}/data?format=${format}&download=true`
    )

    if (!response.ok) {
      return { ok: false, message: `Export failed (HTTP ${response.status})` }
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    // Fall back to the id if no slug was passed — a download must always have a name.
    a.download = `${baseName || tableId}-table.${format}`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    return { ok: true }
  } catch (error) {
    console.error('[export-table] export failed:', error)
    return { ok: false, message: 'Export failed. Please try again.' }
  }
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { AlertCircle, AlertTriangle, Check, Clock, Download, FileSpreadsheet, Loader2, Search, Trash2, Upload } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import FormField from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isLandscape, isStockImageUrl } from "@/lib/event-image";
import { eventDateDay, isExpiredEvent } from "@/lib/dates";

/**
 * Image Finder — admin-only poster lookup (DESIGN_SYSTEM.md compliant).
 *
 * Finds a REAL poster image for each event on the event's own registration
 * page via POST /api/admin/fetch-image, shows it for human approval, and
 * NEVER invents or substitutes an image: if the lookup finds nothing, the
 * admin sees an honest plain-language note and a paste field instead.
 * Nothing is auto-saved — "Use this image" is the approval, and it goes
 * through the normal PUT /events/{id} flow.
 */

const LOOKUP_CONCURRENCY = 3;

const REASON_COPY = {
  login_gated: "Instagram, Facebook and LinkedIn links can't be read automatically. Paste an image link instead.",
  no_image_found: "This page doesn't publish a preview image.",
  site_default_image:
    "This page only has the site's default logo, not a poster for this event. Paste an image link instead.",
  timeout: "Couldn't open this page.",
  unreachable: "Couldn't open this page.",
  http_error: "Couldn't open this page.",
  not_html: "Couldn't open this page.",
  blocked_url: "This link isn't allowed.",
};

const BADGE_CLASS =
  "inline-flex h-6 items-center gap-1 rounded-full bg-chip px-2 t-caption font-medium text-ink";

/** A low-resolution poster still renders — it is just warned about. */
const LOW_RESOLUTION_MAX_WIDTH = 400;
/** Wider than this is a banner strip, not a poster. */
const VERY_WIDE_RATIO = 3;
/** Same URL turning up for this many events is a site logo / default banner. */
const DUPLICATE_EVENT_THRESHOLD = 2;

const lookupImage = async (url) => {
  const { data } = await api.post("/admin/fetch-image", { url });
  return data || {};
};

/**
 * Grouping key for "is this the same image?" — trimmed, with the query string
 * and hash dropped, so `poster.jpg?w=800` and `poster.jpg?w=1600` compare equal.
 */
export const imageKey = (url) => {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  return raw.split("#")[0].split("?")[0].trim();
};

/**
 * Cheap client-side quality rules for a loaded preview. They only ever warn —
 * nothing here can block saving an image the admin has decided to use.
 */
export const qualityWarnings = (natural) => {
  if (!natural) return [];
  const width = Number(natural.width);
  const height = Number(natural.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];
  const warnings = [];
  if (width < LOW_RESOLUTION_MAX_WIDTH) {
    warnings.push({ key: "low-resolution", label: "Low resolution" });
  }
  if (width / height > VERY_WIDE_RATIO) {
    warnings.push({ key: "very-wide", label: "Very wide, may be a banner strip" });
  }
  return warnings;
};

/**
 * Flag every result in a finished batch whose image URL was found for 2 or
 * more events. A repeated URL across unrelated events is almost always the
 * registration site's own logo or default social banner.
 */
export const applyDuplicateFlags = (results) => {
  const counts = new Map();
  for (const result of Object.values(results || {})) {
    const key = imageKey(displayedUrl(result));
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const next = {};
  for (const [id, result] of Object.entries(results || {})) {
    const key = imageKey(displayedUrl(result));
    const count = key ? counts.get(key) || 1 : 1;
    next[id] = { ...result, duplicateCount: count };
  }
  return next;
};

/* Simple worker pool: at most LOOKUP_CONCURRENCY lookups in flight. */
const runPool = async (items, worker, limit = LOOKUP_CONCURRENCY) => {
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(lanes);
};

const startResult = () => ({ status: "loading", data: null, idx: 0, pasted: "", natural: null, errorNote: "" });
const finishResult = (data) => ({ status: "done", data, idx: 0, pasted: "", natural: null, errorNote: "" });
const failResult = (errorNote) => ({ status: "failed", data: null, idx: 0, pasted: "", natural: null, errorNote });

/* The URL currently shown on the card: pasted wins, else the selected candidate. */
const displayedUrl = (result) => {
  if (!result) return null;
  const pasted = (result.pasted || "").trim();
  if (pasted) return pasted;
  const alts = result.data?.alternatives || [];
  return alts[result.idx] || null;
};

/**
 * Landscape / Portrait badge. Orientation is judged in the browser from the
 * preview <img>'s naturalWidth/naturalHeight via isLandscape() — the backend
 * never claims to know. Rendered only once the preview has loaded.
 */
export const OrientationBadge = ({ landscape }) => (
  <span className={BADGE_CLASS} data-testid="imagefinder-orientation-badge">
    {landscape ? (
      <>
        <Check size={16} strokeWidth={1.75} aria-hidden="true" />
        Landscape
      </>
    ) : (
      <>
        <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
        Portrait or square
      </>
    )}
  </span>
);

/* One lookup result card, shared by the event list and the spreadsheet rows. */
const ResultCard = ({ result, testId, onUse, onTryAnother, onSkip, onPaste, note }) => {
  const url = displayedUrl(result);
  const alternatives = result.data?.alternatives || [];
  const reason = result.status === "done" ? (result.data?.reason || null) : null;
  const loaded = Boolean(result.natural && result.natural.url === url);
  const landscape = loaded ? isLandscape(result.natural.width, result.natural.height) : null;
  const failedPreview = Boolean(result.previewFailed && result.previewFailedUrl === url);
  const warnings = loaded ? qualityWarnings(result.natural) : [];
  const duplicateCount = result.duplicateCount || 0;
  const duplicated = duplicateCount >= DUPLICATE_EVENT_THRESHOLD;
  /* Every warning is advisory: the label changes, saving is never blocked. */
  const useAnyway = landscape === false || warnings.length > 0 || duplicated;

  return (
    <div className="mt-3 rounded-md border border-line bg-raised p-3" data-testid={testId}>
      {url ? (
        <div className="flex flex-col sm:flex-row gap-3">
          {failedPreview ? (
            <div
              className="w-full sm:w-40 aspect-video shrink-0 rounded-md border border-line bg-surface flex items-center justify-center"
              data-testid={`${testId}-preview-unavailable`}
            >
              <AlertCircle size={24} strokeWidth={1.75} className="text-ink-muted" aria-hidden="true" />
            </div>
          ) : (
            <img
              src={url}
              alt="Candidate poster preview"
              className="w-full sm:w-40 aspect-video rounded-md border border-line bg-surface object-cover"
              referrerPolicy="no-referrer"
              decoding="async"
              loading="lazy"
              onLoad={(e) =>
                result.onNatural({
                  url,
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight,
                })
              }
              onError={() => result.onPreviewError(url)}
            />
          )}
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {loaded && <OrientationBadge landscape={landscape} />}
              {loaded && !landscape && (
                <span className="t-caption text-ink-muted">May look small on cards</span>
              )}
              {warnings.map((warning) => (
                <span
                  key={warning.key}
                  className={BADGE_CLASS}
                  data-testid={`${testId}-quality-${warning.key}`}
                >
                  <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
                  {warning.label}
                </span>
              ))}
              {duplicated && (
                <span className={BADGE_CLASS} data-testid={`${testId}-duplicate-badge`}>
                  <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
                  {`Same image found for ${duplicateCount} events, probably a site logo or default banner`}
                </span>
              )}
              {result.data?.source && (
                <span className={BADGE_CLASS}>{`Found via ${result.data.source}`}</span>
              )}
            </div>
            <p className="t-caption text-ink-2 break-all">{url}</p>
            {failedPreview && (
              <p
                className="t-caption inline-flex items-start gap-2 text-ink-2"
                data-testid={`${testId}-preview-note`}
              >
                <AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" />
                The image link was found but your browser could not load it. Try another image or paste a link.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
                onClick={() => onUse(url)}
                data-testid={`${testId}-use`}
              >
                <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                {useAnyway ? "Use anyway" : "Use this image"}
              </button>
              {alternatives.length > 1 && (
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                  onClick={onTryAnother}
                  data-testid={`${testId}-try`}
                >
                  <Search size={16} strokeWidth={1.75} aria-hidden="true" />
                  Try another image
                </button>
              )}
              <button
                type="button"
                className={cn(buttonVariants({ variant: "tertiary", size: "sm" }))}
                onClick={onSkip}
                data-testid={`${testId}-skip`}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="t-caption inline-flex items-start gap-2 text-ink-2" data-testid={`${testId}-note`}>
          <AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" />
          {result.status === "loading" && "Looking for the event poster…"}
          {result.status === "failed" && (result.errorNote || REASON_COPY.unreachable)}
          {result.status === "done" && (REASON_COPY[reason] || REASON_COPY.no_image_found)}
        </p>
      )}
      <div className="mt-3">
        <FormField label="Paste an image link" hint="Image Finder never fills this in for you — paste a real event poster URL.">
          <Input
            value={result.pasted}
            onChange={(e) => onPaste(e.target.value)}
            placeholder="https://…/poster.jpg"
            data-testid={`${testId}-paste`}
          />
        </FormField>
      </div>
      {note}
    </div>
  );
};

const SectionA = () => {
  const [events, setEvents] = useState(null); // null = loading
  const [loadFailed, setLoadFailed] = useState(false);
  const [results, setResults] = useState({});
  const [progress, setProgress] = useState(null); // { done, total } | null
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    api
      .get("/events")
      .then((res) => setEvents(Array.isArray(res.data) ? res.data : []))
      .catch(() => {
        setLoadFailed(true);
        setEvents([]);
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Expiry is judged in INDIA time (isExpiredEvent defaults to todayIST), and
   * an expired event is never listed: there is nothing to fix about a poster
   * for an event that has already happened. There is deliberately no toggle to
   * bring them back — the caption simply says how many are hidden.
   */
  const { needImage, hiddenExpired } = useMemo(() => {
    const live = (events || []).filter((ev) => !isExpiredEvent(ev.event_date));
    return {
      needImage: live.filter((ev) => {
        const current = String(ev.image_url || "").trim();
        return !current || isStockImageUrl(current);
      }),
      hiddenExpired: (events || []).length - live.length,
    };
  }, [events]);

  /* Results flagged as a repeated (probably site-default) image sink to the
   * bottom so a genuine poster stays at the top of the list. */
  const orderedNeedImage = useMemo(() => {
    const rank = (ev) =>
      (results[ev.event_id]?.duplicateCount || 0) >= DUPLICATE_EVENT_THRESHOLD ? 1 : 0;
    return needImage
      .map((ev, i) => ({ ev, i }))
      .sort((a, b) => rank(a.ev) - rank(b.ev) || a.i - b.i)
      .map((entry) => entry.ev);
  }, [needImage, results]);

  const patchResult = useCallback((key, patch) => {
    setResults((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

  const runLookup = useCallback(
    async (ev) => {
      const key = ev.event_id;
      setResults((prev) => ({ ...prev, [key]: startResult() }));
      try {
        const data = await lookupImage(ev.external_link);
        if (!mounted.current) return;
        setResults((prev) => ({ ...prev, [key]: finishResult(data) }));
      } catch {
        if (!mounted.current) return;
        setResults((prev) => ({ ...prev, [key]: failResult("Couldn't reach the image finder. Try again.") }));
      }
    },
    []
  );

  const findAll = async () => {
    const pending = needImage.filter((ev) => ev.external_link && !results[ev.event_id]);
    if (pending.length === 0) return;
    let done = 0;
    setProgress({ done, total: pending.length });
    await runPool(pending, async (ev) => {
      await runLookup(ev);
      done += 1;
      setProgress({ done, total: pending.length });
    });
    // One image URL turning up for several unrelated events is almost always
    // the registration site's own logo or default banner.
    setResults((prev) => applyDuplicateFlags(prev));
    setProgress(null);
  };

  const saveImage = async (ev, url) => {
    try {
      await api.put(`/events/${ev.event_id}`, { image_url: url });
      toast.success("Poster saved for this event");
      setEvents((prev) => (prev || []).filter((e) => e.event_id !== ev.event_id));
      setResults((prev) => {
        const next = { ...prev };
        delete next[ev.event_id];
        return next;
      });
    } catch (err) {
      if (err.response?.status === 401) toast.error("Admin authentication required");
      else toast.error("Couldn't save the image");
    }
  };

  const skip = (ev) => {
    setResults((prev) => ({ ...prev, [ev.event_id]: { status: "skipped", data: null, idx: 0, pasted: "", natural: null, errorNote: "" } }));
  };

  if (events === null) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="h-16 rounded-lg bg-raised animate-pulse" />
        <div className="h-16 rounded-lg bg-raised animate-pulse" />
        <div className="h-16 rounded-lg bg-raised animate-pulse" />
      </div>
    );
  }

  return (
    <section className="bg-surface border border-line rounded-lg p-4 lg:p-6" data-testid="imagefinder-events">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="t-h3 text-ink">Events that need a poster</h3>
          <p className="t-caption text-ink-muted mt-1">
            We only look at each event's own registration page. Nothing is saved until you approve a preview.
          </p>
          {hiddenExpired > 0 && (
            <p className="t-caption text-ink-muted mt-1" data-testid="imagefinder-expired-hidden">
              {`${hiddenExpired} expired event${hiddenExpired === 1 ? "" : "s"} hidden`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={findAll}
          disabled={!!progress}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}
          data-testid="imagefinder-find-all"
        >
          {progress ? (
            <Loader2 size={16} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
          ) : (
            <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
          {progress ? `Finding ${progress.done} of ${progress.total}…` : "Find all missing images"}
        </button>
      </div>

      {loadFailed && (
        <p className="mt-4 inline-flex items-start gap-2 bg-danger-bg border border-danger rounded-md p-4 t-caption text-danger">
          <AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" />
          Couldn't load the event list. Reload this page to try again.
        </p>
      )}

      {needImage.length === 0 ? (
        <div className="mt-6 py-8 text-center">
          <Check size={32} strokeWidth={1.75} className="mx-auto mb-2 text-ink-muted" aria-hidden="true" />
          <p className="t-body text-ink-2">Every event in the list already has a real poster image.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3" data-testid="imagefinder-events-list">
          {orderedNeedImage.map((ev) => {
            const result = results[ev.event_id];
            const stock = isStockImageUrl(String(ev.image_url || "").trim());
            return (
              <li
                key={ev.event_id}
                className="rounded-lg border border-line p-4"
                data-testid={`imagefinder-row-${ev.event_id}`}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="t-body-strong text-ink">{ev.title}</div>
                    {ev.external_link ? (
                      <a
                        href={ev.external_link}
                        target="_blank"
                        rel="noreferrer"
                        className="t-caption text-cta-text hover:underline break-all transition-colors duration-fast ease-standard"
                      >
                        {ev.external_link}
                      </a>
                    ) : (
                      <p className="t-caption text-ink-muted">No registration link to read.</p>
                    )}
                    {stock && (
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={BADGE_CLASS} data-testid={`imagefinder-stock-badge-${ev.event_id}`}>
                          <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
                          Stock photo
                        </span>
                        <img
                          src={ev.image_url}
                          alt="Current stock image in use"
                          className="w-24 aspect-video rounded-md border border-line bg-raised object-cover"
                          referrerPolicy="no-referrer"
                          decoding="async"
                          loading="lazy"
                        />
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => runLookup(ev)}
                    disabled={!ev.external_link || result?.status === "loading"}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0 self-start md:self-center")}
                    data-testid={`imagefinder-find-${ev.event_id}`}
                  >
                    {result?.status === "loading" ? (
                      <Loader2 size={16} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Search size={16} strokeWidth={1.75} aria-hidden="true" />
                    )}
                    Find image
                  </button>
                </div>
                {result && result.status !== "skipped" && (
                  <ResultCard
                    result={{
                      ...result,
                      onNatural: (natural) => patchResult(ev.event_id, { natural }),
                      onPreviewError: (previewFailedUrl) =>
                        patchResult(ev.event_id, { previewFailed: true, previewFailedUrl }),
                      previewFailed: result.previewFailed,
                      previewFailedUrl: result.previewFailedUrl,
                    }}
                    testId={`imagefinder-result-${ev.event_id}`}
                    onUse={(url) => saveImage(ev, url)}
                    onTryAnother={() => {
                      const alts = result.data?.alternatives || [];
                      if (alts.length > 1) patchResult(ev.event_id, { idx: (result.idx + 1) % alts.length });
                    }}
                    onSkip={() => skip(ev)}
                    onPaste={(pasted) => patchResult(ev.event_id, { pasted })}
                  />
                )}
                {result?.status === "skipped" && (
                  <p className="mt-2 t-caption text-ink-muted">Skipped — this event keeps its current image.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const SectionB = () => {
  const [sheet, setSheet] = useState(null); // {name, headers, rows, imgIdx, linkIdx, titleIdx, results, progress}
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const busyRef = useRef(false);

  const clearSheet = useCallback(() => setSheet(null), []);

  const parseFile = useCallback(async (file) => {
    if (!file || busyRef.current) return;
    const name = String(file.name || "").toLowerCase();
    if (!(name.endsWith(".xlsx") || name.endsWith(".csv"))) {
      toast.error("Please choose a .xlsx or .csv file");
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      // Same workbook read as the bulk importer; rows are kept as the exact
      // text they were uploaded with (raw:false) so dates and times round-trip
      // untouched into the updated sheet.
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const first = wb.SheetNames[0];
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[first], { header: 1, raw: false, defval: "" });
      if (!aoa.length) {
        toast.error("Sheet is empty");
        return;
      }
      const headers = aoa[0].map((h) => String(h ?? "").trim());
      const idxOf = (wanted) => headers.findIndex((h) => h.toLowerCase() === wanted);
      const imgIdx = idxOf("image_url");
      const linkIdx = idxOf("external_link");
      if (imgIdx < 0 || linkIdx < 0) {
        toast.error('The sheet needs "image_url" and "external_link" columns');
        return;
      }
      const titleIdx = idxOf("title");
      // event_date is optional: without the column nothing can be expired, so
      // every row is processed exactly as before.
      const dateIdx = idxOf("event_date");
      const rows = aoa
        .slice(1)
        .map((r) => headers.map((_, c) => String(r[c] ?? "").trim()));
      if (rows.length === 0) {
        toast.error("Sheet has no data rows");
        return;
      }
      setSheet({
        name: file.name,
        headers,
        rows,
        imgIdx,
        linkIdx,
        titleIdx,
        dateIdx,
        results: {},
        progress: null,
      });
    } catch {
      toast.error("Could not read that file");
    }
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) parseFile(file);
  };

  const patchRowResult = useCallback((i, patch) => {
    setSheet((prev) => prev && { ...prev, results: { ...prev.results, [i]: { ...prev.results[i], ...patch } } });
  }, []);

  /**
   * Date state per row, judged in India time before any lookup happens.
   *   "expired"  — event_date has passed: the row is skipped entirely and left
   *                untouched in the downloaded sheet.
   *   "unclear"  — a date we cannot read: processed normally, with a note.
   *   "ok"       — a date on or after today in IST.
   *   "none"     — the sheet has no event_date column at all.
   */
  const rowDates = useMemo(() => {
    const map = new Map();
    if (!sheet) return map;
    sheet.rows.forEach((row, i) => {
      if (sheet.dateIdx < 0) {
        map.set(i, "none");
        return;
      }
      const raw = row[sheet.dateIdx];
      if (isExpiredEvent(raw)) map.set(i, "expired");
      else if (eventDateDay(raw) === null) map.set(i, "unclear");
      else map.set(i, "ok");
    });
    return map;
  }, [sheet]);

  /* Rows to show (any row that still needs an image) vs rows to process
   * (the same list minus expired ones). Expired rows are excluded from every
   * count, so "N rows need an image" never includes them. */
  const { displayRows, needImageRows } = useMemo(() => {
    const display = [];
    const work = [];
    if (!sheet) return { displayRows: display, needImageRows: work };
    sheet.rows.forEach((row, i) => {
      const current = row[sheet.imgIdx] || "";
      const link = row[sheet.linkIdx] || "";
      if (!link || (current && !isStockImageUrl(current))) return;
      display.push(i);
      if (rowDates.get(i) !== "expired") work.push(i);
    });
    return { displayRows: display, needImageRows: work };
  }, [sheet, rowDates]);

  /* Repeated (probably default) images sink to the bottom of the row list. */
  const orderedRows = useMemo(() => {
    const rank = (i) =>
      (sheet?.results?.[i]?.duplicateCount || 0) >= DUPLICATE_EVENT_THRESHOLD ? 1 : 0;
    return displayRows
      .map((i, position) => ({ i, position }))
      .sort((a, b) => rank(a.i) - rank(b.i) || a.position - b.position)
      .map((entry) => entry.i);
  }, [displayRows, sheet]);

  const findAll = async () => {
    if (!sheet || needImageRows.length === 0 || busyRef.current) return;
    busyRef.current = true;
    const pending = needImageRows.filter((i) => !sheet.results[i]);
    let done = 0;
    setSheet((prev) => ({ ...prev, progress: { done, total: pending.length } }));
    await runPool(pending, async (i) => {
      const link = sheet.rows[i][sheet.linkIdx];
      patchRowResult(i, startResult());
      let data = null;
      try {
        data = await lookupImage(link);
        patchRowResult(i, finishResult(data));
      } catch {
        patchRowResult(i, failResult("Couldn't reach the image finder."));
      }
      done += 1;
      setSheet((prev) => (prev ? { ...prev, progress: { done, total: pending.length } } : prev));
    });
    setSheet((prev) =>
      prev ? { ...prev, results: applyDuplicateFlags(prev.results), progress: null } : prev
    );
    busyRef.current = false;
  };

  const applyRowImage = (i, url) => {
    setSheet((prev) => {
      const rows = prev.rows.map((r) => r.slice());
      rows[i][prev.imgIdx] = url;
      const results = { ...prev.results };
      delete results[i];
      return { ...prev, rows, results };
    });
    toast.success("Image accepted — it will be written to the downloaded sheet");
  };

  const downloadUpdated = () => {
    if (!sheet) return;
    const aoa = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Events");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const base = String(sheet.name || "events").replace(/\.[^.]+$/, "");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}-updated.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Updated sheet downloaded — ready for bulk import");
  };

  return (
    <section className="bg-surface border border-line rounded-lg p-4 lg:p-6" data-testid="imagefinder-sheet">
      <h3 className="t-h3 text-ink">Fill a spreadsheet before importing</h3>
      <p className="t-caption text-ink-muted mt-1">
        Drop the file you were about to bulk-import. Rows without a real image get a lookup — accepted links are written back, everything else stays exactly as uploaded.
      </p>

      <div
        data-testid="imagefinder-sheet-drop"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "mt-4 rounded-lg border-2 border-dashed p-8 text-center transition-colors duration-fast ease-standard",
          dragOver ? "border-focus bg-raised" : "border-line-input"
        )}
      >
        <FileSpreadsheet size={32} strokeWidth={1.75} className="mx-auto mb-2 text-ink-muted" aria-hidden="true" />
        <p className="t-body text-ink-2">
          Drag &amp; drop an <span className="text-ink-2 font-semibold">.xlsx</span> or <span className="text-ink-2 font-semibold">.csv</span> file here
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            data-testid="imagefinder-sheet-choose"
          >
            <Upload size={16} strokeWidth={1.75} aria-hidden="true" />
            Choose file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            data-testid="imagefinder-sheet-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) parseFile(f);
              e.target.value = "";
            }}
          />
          {sheet && (
            <button
              type="button"
              onClick={clearSheet}
              className={cn(buttonVariants({ variant: "tertiary", size: "sm" }))}
              data-testid="imagefinder-sheet-clear"
            >
              Remove file
            </button>
          )}
        </div>
      </div>

      {sheet && (
        <div className="mt-4 rounded-lg border border-line bg-raised p-4" data-testid="imagefinder-sheet-summary">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="t-body-strong text-ink break-all">
              {sheet.name} — {needImageRows.length} of {sheet.rows.length} rows need an image
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={findAll}
                disabled={!!sheet.progress || needImageRows.length === 0}
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                data-testid="imagefinder-sheet-find"
              >
                {sheet.progress ? (
                  <Loader2 size={16} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Search size={16} strokeWidth={1.75} aria-hidden="true" />
                )}
                {sheet.progress ? `Finding ${sheet.progress.done} of ${sheet.progress.total}…` : "Find images in this sheet"}
              </button>
              <button
                type="button"
                onClick={downloadUpdated}
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                data-testid="imagefinder-sheet-download"
              >
                <Download size={16} strokeWidth={1.75} aria-hidden="true" />
                Download updated sheet
              </button>
            </div>
          </div>

          <ul className="mt-4 space-y-3" data-testid="imagefinder-sheet-rows">
            {orderedRows.map((i) => {
              const row = sheet.rows[i];
              const title = sheet.titleIdx >= 0 ? row[sheet.titleIdx] || `Row ${i + 2}` : `Row ${i + 2}`;
              const result = sheet.results[i];
              const applied = row[sheet.imgIdx];
              const dateState = rowDates.get(i);
              const expired = dateState === "expired";
              return (
                <li key={i} className="rounded-md border border-line bg-surface p-3" data-testid={`imagefinder-sheet-row-${i}`}>
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="t-body-strong text-ink">{title}</div>
                      <div className="t-caption text-ink-muted break-all">{row[sheet.linkIdx]}</div>
                      {expired && (
                        <p
                          className="mt-2 inline-flex items-center gap-1 t-caption text-ink-muted"
                          data-testid={`imagefinder-sheet-expired-${i}`}
                        >
                          <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
                          Event date has passed, skipped
                        </p>
                      )}
                      {dateState === "unclear" && (
                        <p
                          className="mt-2 inline-flex items-center gap-1 t-caption text-ink-muted"
                          data-testid={`imagefinder-sheet-unclear-${i}`}
                        >
                          <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
                          Date unclear
                        </p>
                      )}
                      {applied && (
                        <span className="mt-2 inline-flex items-center gap-1 t-caption text-ok" data-testid={`imagefinder-sheet-applied-${i}`}>
                          <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                          Image accepted for this row
                        </span>
                      )}
                    </div>
                    {!result && !expired && (
                      <button
                        type="button"
                        onClick={() => {
                          patchRowResult(i, startResult());
                          lookupImage(row[sheet.linkIdx])
                            .then((data) => patchRowResult(i, finishResult(data)))
                            .catch(() => patchRowResult(i, failResult("Couldn't reach the image finder.")));
                        }}
                        disabled={!!sheet.progress}
                        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0 self-start md:self-center")}
                        data-testid={`imagefinder-sheet-find-row-${i}`}
                      >
                        {result?.status === "loading" ? (
                          <Loader2 size={16} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
                        )}
                        Find image
                      </button>
                    )}
                  </div>
                  {result && !expired && (
                    <ResultCard
                      result={{
                        ...result,
                        onNatural: (natural) => patchRowResult(i, { natural }),
                        onPreviewError: (previewFailedUrl) =>
                          patchRowResult(i, { previewFailed: true, previewFailedUrl }),
                        previewFailed: result.previewFailed,
                        previewFailedUrl: result.previewFailedUrl,
                      }}
                      testId={`imagefinder-sheet-result-${i}`}
                      onUse={(url) => applyRowImage(i, url)}
                      onTryAnother={() => {
                        const alts = result.data?.alternatives || [];
                        if (alts.length > 1) patchRowResult(i, { idx: (result.idx + 1) % alts.length });
                      }}
                      onSkip={() =>
                        setSheet((prev) => {
                          const results = { ...prev.results };
                          delete results[i];
                          return { ...prev, results };
                        })
                      }
                      onPaste={(pasted) => patchRowResult(i, { pasted })}
                    />
                  )}
                </li>
              );
            })}
            {displayRows.length === 0 && (
              <li className="t-caption text-ink-muted py-4 text-center">Every row already has a non-stock image URL.</li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
};

/**
 * Group non-expired events by their SAVED image_url and surface every image
 * that is currently doing duty for more than one event — usually one event
 * platform's logo that was approved for several listings by mistake.
 *
 * Removing is the existing PUT /events/{id} with an empty image_url, done for
 * every event in the group; nothing else about the event is touched.
 */
const GroupThumbnail = ({ url, label }) => {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md border border-line bg-raised">
        <AlertCircle size={24} strokeWidth={1.75} className="text-ink-muted" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={label}
      className="h-16 w-24 shrink-0 rounded-md border border-line bg-raised object-cover"
      referrerPolicy="no-referrer"
      decoding="async"
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
};

const SectionC = () => {
  const [groups, setGroups] = useState(null); // null = loading
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    api
      .get("/events")
      .then((res) => {
        if (!mounted.current) return;
        const events = Array.isArray(res.data) ? res.data : [];
        const byKey = new Map();
        for (const ev of events) {
          if (!ev || isExpiredEvent(ev.event_date)) continue;
          const key = imageKey(ev.image_url);
          if (!key) continue;
          if (!byKey.has(key)) byKey.set(key, { key, url: String(ev.image_url).trim(), events: [] });
          byKey.get(key).events.push(ev);
        }
        const shared = [...byKey.values()]
          .filter((group) => group.events.length > 1)
          .sort((a, b) => b.events.length - a.events.length);
        setGroups(shared);
      })
      .catch(() => {
        if (!mounted.current) return;
        setLoadFailed(true);
        setGroups([]);
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  const removeFromAll = async (group) => {
    setBusy(true);
    const count = group.events.length;
    try {
      for (const ev of group.events) {
        await api.put(`/events/${ev.event_id}`, { image_url: "" });
      }
      if (!mounted.current) return;
      setGroups((prev) => (prev || []).filter((g) => g.key !== group.key));
      toast.success(`Image removed from ${count} events`);
    } catch {
      if (!mounted.current) return;
      toast.error("Couldn't remove the image from every event");
    } finally {
      if (mounted.current) {
        setBusy(false);
        setConfirming(null);
      }
    }
  };

  if (groups === null) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="h-16 rounded-lg bg-raised animate-pulse" />
        <div className="h-16 rounded-lg bg-raised animate-pulse" />
      </div>
    );
  }

  return (
    <section className="bg-surface border border-line rounded-lg p-4 lg:p-6" data-testid="imagefinder-shared">
      <h3 className="t-h3 text-ink">Same image on several events</h3>
      <p className="t-caption text-ink-muted mt-1">
        One poster URL saved on more than one event is usually a site logo. Removing it here leaves everything else about those events exactly as it is.
      </p>

      {loadFailed && (
        <p className="mt-4 inline-flex items-start gap-2 bg-danger-bg border border-danger rounded-md p-4 t-caption text-danger">
          <AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" />
          Couldn't load the event list. Reload this page to try again.
        </p>
      )}

      {groups.length === 0 ? (
        <p className="mt-4 t-caption text-ink-muted" data-testid="imagefinder-shared-empty">
          No image is shared between events.
        </p>
      ) : (
        <ul className="mt-4 space-y-3" data-testid="imagefinder-shared-list">
          {groups.map((group) => (
            <li
              key={group.key}
              className="rounded-lg border border-line p-4"
              data-testid={`imagefinder-shared-group-${group.key}`}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <GroupThumbnail url={group.url} label="Image used by several events" />
                <div className="flex-1 min-w-0">
                  <div className="t-body-strong text-ink">{`Used by ${group.events.length} events`}</div>
                  <p className="t-caption text-ink-muted break-words">
                    {group.events.map((ev) => ev.title || ev.event_id).join(" · ")}
                  </p>
                  <p className="t-caption text-ink-2 break-all mt-1">{group.url}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-center">
                  <button
                    type="button"
                    onClick={() => setConfirming(group)}
                    disabled={busy}
                    className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}
                    data-testid={`imagefinder-shared-remove-${group.key}`}
                  >
                    <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                    {`Remove from all ${group.events.length} events`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroups((prev) => (prev || []).filter((g) => g.key !== group.key))}
                    className={cn(buttonVariants({ variant: "tertiary", size: "sm" }))}
                    data-testid={`imagefinder-shared-keep-${group.key}`}
                  >
                    Keep
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirming && (
        <div className="fixed inset-0 z-40 bg-scrim/60 flex items-center justify-center p-4" data-testid="imagefinder-shared-confirm">
          <div className="relative z-50 bg-surface border border-line rounded-lg p-6 max-w-sm w-full shadow-elev-2">
            <h3 className="t-h3 text-ink">Remove this image?</h3>
            <p className="mt-1 t-body text-ink-2">
              {`Remove this image from ${confirming.events.length} events? The events keep everything else and will need a new poster.`}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setConfirming(null)}
                disabled={busy}
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "flex-1")}
                data-testid="imagefinder-shared-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => removeFromAll(confirming)}
                disabled={busy}
                className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "flex-1")}
                data-testid="imagefinder-shared-confirm-btn"
              >
                Remove image
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const ImageFinder = () => (
  <div className="space-y-6" data-testid="imagefinder">
    <SectionA />
    <SectionB />
    <SectionC />
  </div>
);

export default ImageFinder;

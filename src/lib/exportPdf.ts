/**
 * Export the pursuit start schedule as a downloadable PDF, generated client-side
 * with jsPDF + autotable. Produces an on-brand A4 start sheet a race officer can
 * print or file — no print-dialog dance, just a real file download.
 */

import type { PyMeta, Schedule } from "./types";
import { formatMmSs, ordinal } from "./format";

/**
 * How the race window was set — drives the meta row and the explanatory copy.
 *  - fixed: the officer typed the total window directly.
 *  - class: the window was derived so a reference class sails a set time on the
 *    water (window = referenceMinutes × PY_slowest / PY_reference).
 * `totalMinutes` is the effective total window in both cases.
 */
export type DurationInfo =
  | { mode: "fixed"; totalMinutes: number }
  | {
      mode: "class";
      totalMinutes: number;
      referenceName: string;
      referenceMinutes: number;
    };

interface ExportOptions {
  schedule: Schedule;
  /** How the race window was configured. */
  duration: DurationInfo;
  /** Selected start-sequence label (e.g. "5-4-1"). */
  startSequence: string;
  /** PY dataset provenance, printed in the footer. */
  pyMeta: PyMeta;
  /** "now" epoch ms, supplied by the caller (no Date.now() in shared lib). */
  generatedAt: number;
}

// Brand palette (light), as [r, g, b] for jsPDF.
const INK: [number, number, number] = [11, 23, 34];
const MUTED: [number, number, number] = [71, 85, 99];
const SIGNAL: [number, number, number] = [12, 108, 121];
const AMBER: [number, number, number] = [180, 94, 0];
const ZEBRA: [number, number, number] = [241, 245, 249];
const LINE: [number, number, number] = [212, 221, 229];

/** Class names can carry a "/ variant" tail — keep the lead segment for chrome. */
function shortName(name: string): string {
  return name.split(" / ")[0]!.trim();
}

/** Human-friendly race window: "45 min" or "1 hr 15 min". */
function formatWindow(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function formatDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fileStamp(epochMs: number): string {
  const d = new Date(epochMs);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Badge label for a start, or null. First-gun takes priority over scratch. */
function badgeFor(
  start: Schedule["starts"][number],
): { label: string; color: [number, number, number] } | null {
  if (start.order === 1) return { label: "FIRST GUN", color: AMBER };
  if (start.isScratch) return { label: "SCRATCH", color: MUTED };
  return null;
}

export async function exportSchedulePdf({
  schedule,
  duration,
  startSequence,
  pyMeta,
  generatedAt,
}: ExportOptions): Promise<void> {
  // Lazy-load: keeps jsPDF (~large) out of the main bundle and off the server.
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.setFontSize(26);
  doc.text("TRIVIAL", margin, y + 6, { charSpace: 2 });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...SIGNAL);
  doc.setFontSize(9);
  doc.text("PURSUIT RACE START SHEET", margin, y + 12, { charSpace: 1.4 });

  y += 16;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + contentW, y);

  // ── Meta row ────────────────────────────────────────────────────────────
  // By-class mode surfaces the timing basis (which class sails how long) in
  // place of the start/class tallies — those are evident from the table itself.
  y += 9;
  const classCount = schedule.starts.reduce((n, s) => n + s.classes.length, 0);
  const meta: [string, string][] =
    duration.mode === "class"
      ? [
          ["TOTAL WINDOW", formatWindow(duration.totalMinutes)],
          ["TIMING REFERENCE", shortName(duration.referenceName)],
          ["REFERENCE TIME", formatWindow(duration.referenceMinutes)],
          ["START SEQUENCE", startSequence],
        ]
      : [
          ["RACE WINDOW", formatWindow(duration.totalMinutes)],
          ["START SEQUENCE", startSequence],
          ["STARTS", String(schedule.starts.length)],
          ["CLASSES", String(classCount)],
        ];
  const colW = contentW / meta.length;
  meta.forEach(([label, value], i) => {
    const x = margin + colW * i;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(label, x, y, { charSpace: 0.5 });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    // Shrink the value to fit its column (reference class names can run long).
    let valueSize = 13;
    doc.setFontSize(valueSize);
    while (valueSize > 8 && doc.getTextWidth(value) > colW - 3) {
      valueSize -= 1;
      doc.setFontSize(valueSize);
    }
    doc.text(value, x, y + 6);
  });
  y += 12;

  // ── Schedule table ──────────────────────────────────────────────────────
  const body = schedule.starts.map((s) => [
    ordinal(s.order),
    s.classes.map((c) => c.name).join(" + "),
    String(s.py),
    `+${formatMmSs(s.startFromFirstGunMs)}`,
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "CLASS", "PY", "TIMING"]],
    body,
    theme: "striped",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: { top: 2.6, bottom: 2.6, left: 3, right: 3 },
      textColor: INK,
      lineWidth: 0,
    },
    headStyles: {
      fillColor: INK,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: { top: 2.4, bottom: 2.4, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: {
      0: { cellWidth: 16, textColor: MUTED, fontStyle: "bold" },
      1: { cellWidth: "auto", fontStyle: "bold" },
      2: { cellWidth: 22, halign: "right", textColor: MUTED },
      3: { cellWidth: 26, halign: "right", fontStyle: "bold", fontSize: 11 },
    },
    // Draw a status badge (first gun / scratch) at the right edge of the class cell.
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 1) return;
      const start = schedule.starts[data.row.index];
      const badge = start && badgeFor(start);
      if (!badge) return;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      const padX = 1.6;
      const textW = doc.getTextWidth(badge.label);
      const bw = textW + padX * 2;
      const bh = 4;
      const bx = data.cell.x + data.cell.width - bw - 2;
      const by = data.cell.y + (data.cell.height - bh) / 2;
      doc.setFillColor(...badge.color);
      doc.roundedRect(bx, by, bw, bh, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(badge.label, bx + padX, by + bh - 1.3);
    },
  });

  // ── Formula note + footer ───────────────────────────────────────────────
  // @ts-expect-error – autotable augments the doc instance at runtime.
  let cursor: number = doc.lastAutoTable.finalY + 8;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(margin, cursor, margin + contentW, cursor);
  cursor += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  // Common pursuit mechanics, plus a lead sentence explaining where the window
  // came from — derived from the reference class in by-class mode, set directly
  // in fixed mode.
  const totalStr = formatWindow(duration.totalMinutes);
  const basis =
    duration.mode === "class"
      ? `Race window derived so ${shortName(duration.referenceName)} sails ${formatWindow(
          duration.referenceMinutes,
        )} on the water — a total race of ${totalStr}. `
      : `Race window set to ${totalStr}. `;
  const note =
    basis +
    `Slowest boat away first at +0:00 and sails the full window; faster classes start later and chase. ` +
    `Each start fires at  window x (1 - PY / ${schedule.slowestPy})  after the first gun, so every boat ` +
    `sailing to its PY converges at the finish (+${formatMmSs(schedule.finishFromFirstGunMs)}).`;
  const noteLines = doc.splitTextToSize(note, contentW);
  doc.text(noteLines, margin, cursor);
  cursor += noteLines.length * 4 + 5;

  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(`Generated ${formatDateTime(generatedAt)}`, margin, cursor);
  doc.text(
    `${pyMeta.source} v${pyMeta.version} · ${pyMeta.lastUpdated}`,
    margin + contentW,
    cursor,
    { align: "right" },
  );

  doc.save(`trivial-start-sheet-${fileStamp(generatedAt)}.pdf`);
}

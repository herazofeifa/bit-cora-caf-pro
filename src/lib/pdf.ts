// Real downloadable PDFs generated in the browser from server data (no window.print).
// jsPDF is loaded on demand so it never runs during SSR.

export interface PdfTable { title: string; head: string[]; rows: (string | number)[][] }

async function lib() {
  const [{ jsPDF }, autoTable] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { jsPDF, autoTable: autoTable.default };
}

function header(doc: import("jspdf").jsPDF, title: string, subtitle: string) {
  doc.setFont("times", "bold"); doc.setFontSize(18); doc.text(title, 14, 18);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110);
  doc.text(subtitle, 14, 25); doc.setTextColor(0);
}

export async function reportPdf(title: string, filters: Record<string, string>, tables: PdfTable[], fileName: string) {
  const { jsPDF, autoTable } = await lib();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, title, `Bitácora Café Pro · generado ${new Date().toLocaleString()} · datos del servidor`);
  const f = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("   ");
  doc.setFontSize(9); doc.text(doc.splitTextToSize(`Filtros: ${f || "ninguno"}`, 180), 14, 31);
  let y = 38;
  for (const t of tables) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(t.title, 14, y); doc.setFont("helvetica", "normal");
    autoTable(doc, { startY: y + 2, head: [t.head], body: t.rows.length ? t.rows : [["Sin registros", ...t.head.slice(1).map(() => "")]],
      styles: { fontSize: 8 }, headStyles: { fillColor: [74, 52, 38] }, margin: { left: 14, right: 14 } });
    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY) + 10;
    if (y > 260) { doc.addPage(); y = 20; }
  }
  doc.save(fileName);
}

export async function sackLabelsPdf(lot: { lot_code: string; friendly_name: string; variety: string; process_type: string },
  sacks: { seq: number; sack_token: string; weight_kg: number | null }[], origin: string) {
  const [{ jsPDF }, QR] = await Promise.all([import("jspdf"), import("qrcode")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 90, H = 60; let i = 0;
  for (const s of sacks) {
    if (i > 0 && i % 8 === 0) doc.addPage();
    const col = i % 2, row = Math.floor((i % 8) / 2);
    const x = 12 + col * (W + 6), y = 12 + row * (H + 6);
    doc.setDrawColor(180); doc.rect(x, y, W, H);
    const url = `${origin}/s/${s.sack_token}`;
    const png = await QR.toDataURL(url, { margin: 0, width: 300 });
    doc.addImage(png, "PNG", x + 4, y + 6, 40, 40);
    doc.setFont("times", "bold"); doc.setFontSize(12); doc.text(lot.lot_code, x + 48, y + 12);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(doc.splitTextToSize(lot.friendly_name, 38), x + 48, y + 19);
    doc.text(`${lot.variety || ""} · ${lot.process_type}`, x + 48, y + 30);
    doc.text(`Saco #${s.seq}${s.weight_kg ? ` · ${s.weight_kg} kg` : ""}`, x + 48, y + 37);
    doc.setFontSize(6); doc.text(url, x + 4, y + H - 4);
    i++;
  }
  doc.save(`etiquetas-${lot.lot_code}.pdf`);
}

export interface LotSheet {
  lot: { lot_code: string; friendly_name: string; variety: string; process_type: string; physical_state: string; quality_status: string; qty_initial_kg: number; qty_current_kg: number; created_at: string };
  origin: { farm?: string; parcel?: string; altitude?: number | null; region?: string | null };
  phases: { name: string; started_at: string; ended_at: string | null; weight_in_kg: number | null; weight_out_kg: number | null }[];
  quality: { sampled_at: string; status: string; score: number | null; notes?: string | null }[];
  photos: { title: string; dataUrl: string }[];
  story?: string | null; tasting?: string | null; publicUrl?: string | null;
}

/** Lot sheet: origin, process history, quality, selected photos and QR. */
export async function lotSheetPdf(s: LotSheet) {
  const { jsPDF, autoTable } = await lib();
  const QR = await import("qrcode");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, `${s.lot.lot_code} · ${s.lot.friendly_name}`, `Ficha de lote · Bitácora Café Pro · ${new Date().toLocaleString()}`);
  if (s.publicUrl) { doc.addImage(await QR.toDataURL(s.publicUrl, { margin: 0, width: 300 }), "PNG", 170, 8, 26, 26); }
  doc.setFontSize(10);
  const lines = [
    `Origen: ${[s.origin.farm, s.origin.parcel, s.origin.region].filter(Boolean).join(" · ") || "—"}${s.origin.altitude ? ` · ${s.origin.altitude} msnm` : ""}`,
    `Variedad: ${s.lot.variety || "—"}   Proceso: ${s.lot.process_type}   Estado: ${s.lot.physical_state}   Calidad: ${s.lot.quality_status}`,
    `Kg iniciales: ${s.lot.qty_initial_kg}   Kg actuales: ${s.lot.qty_current_kg}   Creado: ${new Date(s.lot.created_at).toLocaleDateString()}`,
  ];
  if (s.story) lines.push(`Historia: ${s.story}`);
  if (s.tasting) lines.push(`Notas de taza: ${s.tasting}`);
  doc.text(doc.splitTextToSize(lines.join("\n"), 150), 14, 38);
  autoTable(doc, { startY: 66, head: [["Fase", "Inicio", "Fin", "Entra kg", "Sale kg"]], headStyles: { fillColor: [74, 52, 38] }, styles: { fontSize: 8 },
    body: s.phases.length ? s.phases.map((p) => [p.name, new Date(p.started_at).toLocaleString(), p.ended_at ? new Date(p.ended_at).toLocaleString() : "en curso", p.weight_in_kg ?? "", p.weight_out_kg ?? ""]) : [["Sin fases", "", "", "", ""]] });
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  autoTable(doc, { startY: y, head: [["Fecha", "Resultado", "SCA", "Notas"]], headStyles: { fillColor: [74, 52, 38] }, styles: { fontSize: 8 },
    body: s.quality.length ? s.quality.map((q) => [new Date(q.sampled_at).toLocaleDateString(), q.status, q.score ?? "", q.notes ?? ""]) : [["Sin evaluaciones", "", "", ""]] });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  for (const p of s.photos) {
    if (y > 220) { doc.addPage(); y = 20; }
    try { doc.addImage(p.dataUrl, p.dataUrl.includes("image/png") ? "PNG" : "JPEG", 14, y, 80, 60); doc.setFontSize(8); doc.text(p.title, 14, y + 64); y += 70; } catch { /* unsupported image */ }
  }
  doc.save(`ficha-${s.lot.lot_code}.pdf`);
}

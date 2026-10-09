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

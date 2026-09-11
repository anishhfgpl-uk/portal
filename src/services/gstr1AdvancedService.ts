import { Invoice, SellerInfo } from '../types';

export type Gstr1NoteType = 'C' | 'D';
export type Gstr1NoteCategory = 'B2B' | 'B2C';

export interface Gstr1NoteRow {
  id: string;
  typ: Gstr1NoteType;
  ntty: string;
  nt_num: string;
  nt_dt: string;
  p_gst?: string;
  p_num?: string;
  p_dt?: string;
  rsn?: string;
  val: number;
  pos: string;
  sply_ty: 'INTRA' | 'INTER';
  itms: Array<{ num: number; itm_det: { rt: number; txval: number; iamt: number; camt: number; samt: number; csamt: number } }>;
}

export interface Gstr1ExportRow {
  id: string;
  typ: 'WPAY' | 'WOPAY';
  inum: string;
  idt: string;
  val: number;
  sbpcode?: string;
  sbnum?: string;
  sbdt?: string;
  port?: string;
  txval: number;
  rt: number;
  iamt: number;
  csamt: number;
  exp_typ?: 'WPAY' | 'WOPAY' | 'LUT';
}

export interface Gstr1AdvanceRow {
  id: string;
  typ: 'AT' | 'TXPD';
  pos: string;
  sply_ty: 'INTRA' | 'INTER';
  rt: number;
  ad_amt: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}

export interface Gstr1NilRow {
  id: string;
  sply_typ: string;
  nil_amt: number;
  ex_amt: number;
  ngsup_amt: number;
}

export interface Gstr1AmendmentRow {
  id: string;
  table: 'B2B' | 'B2CL' | 'B2CS' | 'EXP' | 'CDNR' | 'CDNUR' | 'AT' | 'TXPD';
  originalNo: string;
  originalDate: string;
  originalPeriod: string;
  amendedNo?: string;
  amendedDate?: string;
  gstin?: string;
  pos?: string;
  value: number;
  taxable: number;
  rate: number;
  igst: number;
  cgst: number;
  sgst: number;
}

export interface Gstr1EcomRow {
  id: string;
  etin: string;
  typ: 'E' | 'SEZ';
  pos: string;
  txval: number;
  rt: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}

export interface Gstr1ExtendedData {
  notesRegistered: Gstr1NoteRow[];
  notesUnregistered: Gstr1NoteRow[];
  exports: Gstr1ExportRow[];
  advances: Gstr1AdvanceRow[];
  advanceAdjustments: Gstr1AdvanceRow[];
  nilExempt: Gstr1NilRow[];
  amendments: Gstr1AmendmentRow[];
  ecom: Gstr1EcomRow[];
  ecomAmendments: Gstr1EcomRow[];
}

const key = (seller: SellerInfo, period: string) => `gstr1_extended_${seller.gstin || seller.name}_${period}`;
const n = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const r2 = (v: unknown) => Math.round(n(v) * 100) / 100;

export function emptyGstr1ExtendedData(): Gstr1ExtendedData {
  return { notesRegistered: [], notesUnregistered: [], exports: [], advances: [], advanceAdjustments: [], nilExempt: [], amendments: [], ecom: [], ecomAmendments: [] };
}

export function loadGstr1ExtendedData(seller: SellerInfo, period: string): Gstr1ExtendedData {
  try {
    const raw = localStorage.getItem(key(seller, period));
    if (!raw) return emptyGstr1ExtendedData();
    return { ...emptyGstr1ExtendedData(), ...JSON.parse(raw) };
  } catch { return emptyGstr1ExtendedData(); }
}

export function saveGstr1ExtendedData(seller: SellerInfo, period: string, data: Gstr1ExtendedData) {
  localStorage.setItem(key(seller, period), JSON.stringify(data));
}

export function createExtendedDataFromInvoices(invoices: Invoice[], seller: SellerInfo): Gstr1ExtendedData {
  const data = emptyGstr1ExtendedData();
  // Existing invoice data is the source of truth. Optional future GSTR metadata is read without
  // changing the Invoice type, so older invoices remain fully compatible.
  invoices.forEach((inv: Invoice & Record<string, any>) => {
    const meta = inv.gstr1;
    if (!meta) return;
    if (meta.export) data.exports.push(meta.export);
    if (meta.note) (meta.note.category === 'B2B' ? data.notesRegistered : data.notesUnregistered).push(meta.note);
    if (meta.advance) data.advances.push(meta.advance);
  });
  return data;
}

function noteJson(rows: Gstr1NoteRow[]) {
  return rows.map(x => ({
    ctin: x.p_gst || undefined,
    nt_num: x.nt_num,
    nt_dt: x.nt_dt,
    ntty: x.ntty,
    rsn: x.rsn || undefined,
    val: r2(x.val),
    pos: x.pos,
    sply_ty: x.sply_ty,
    p_gst: x.p_gst || undefined,
    p_num: x.p_num || undefined,
    p_dt: x.p_dt || undefined,
    itms: x.itms.map(i => ({ num: i.num, itm_det: { ...i.itm_det, txval: r2(i.itm_det.txval), iamt: r2(i.itm_det.iamt), camt: r2(i.itm_det.camt), samt: r2(i.itm_det.samt), csamt: r2(i.itm_det.csamt) } }))
  }));
}

export function buildExtendedGstr1Sections(data: Gstr1ExtendedData) {
  const exp = data.exports.map(x => ({ exp_typ: x.exp_typ || x.typ, inum: x.inum, idt: x.idt, val: r2(x.val), sbpcode: x.sbpcode || undefined, sbnum: x.sbnum || undefined, sbdt: x.sbdt || undefined, port: x.port || undefined, itms: [{ num: 1, itm_det: { txval: r2(x.txval), rt: r2(x.rt), iamt: r2(x.iamt), csamt: r2(x.csamt) } }] }));
  const at = data.advances.map(x => ({ pos: x.pos, sply_ty: x.sply_ty, rt: r2(x.rt), ad_amt: r2(x.ad_amt), iamt: r2(x.iamt), camt: r2(x.camt), samt: r2(x.samt), csamt: r2(x.csamt) }));
  const txpd = data.advanceAdjustments.map(x => ({ pos: x.pos, sply_ty: x.sply_ty, rt: r2(x.rt), ad_amt: r2(x.ad_amt), iamt: r2(x.iamt), camt: r2(x.camt), samt: r2(x.samt), csamt: r2(x.csamt) }));
  const nil = data.nilExempt.map(x => ({ sply_typ: x.sply_typ, nil_amt: r2(x.nil_amt), ex_amt: r2(x.ex_amt), ngsup_amt: r2(x.ngsup_amt) }));
  const ecom = data.ecom.map(x => ({ etin: x.etin, typ: x.typ, pos: x.pos, txval: r2(x.txval), rt: r2(x.rt), iamt: r2(x.iamt), camt: r2(x.camt), samt: r2(x.samt), csamt: r2(x.csamt) }));
  return {
    ...(data.notesRegistered.length ? { cdnr: noteJson(data.notesRegistered) } : {}),
    ...(data.notesUnregistered.length ? { cdnur: noteJson(data.notesUnregistered) } : {}),
    ...(exp.length ? { exp } : {}),
    ...(at.length ? { at } : {}),
    ...(txpd.length ? { txpd } : {}),
    ...(nil.length ? { nil } : {}),
    ...(ecom.length ? { ecom } : {}),
    ...(data.amendments.length ? { amendments: data.amendments.map(x => ({ ...x, value: r2(x.value), taxable: r2(x.taxable), rate: r2(x.rate), igst: r2(x.igst), cgst: r2(x.cgst), sgst: r2(x.sgst) })) } : {}),
    ...(data.ecomAmendments.length ? { ecoma: data.ecomAmendments.map(x => ({ ...x, txval: r2(x.txval), rt: r2(x.rt), iamt: r2(x.iamt), camt: r2(x.camt), samt: r2(x.samt), csamt: r2(x.csamt) })) } : {})
  };
}

export function buildFullGstr1Json(basePayload: Record<string, any>, data: Gstr1ExtendedData) {
  return { ...basePayload, ...buildExtendedGstr1Sections(data) };
}

export function downloadFullGstr1Json(basePayload: Record<string, any>, data: Gstr1ExtendedData, seller: SellerInfo, period: string) {
  const payload = buildFullGstr1Json(basePayload, data);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GSTR1_FULL_${seller.gstin || 'GSTIN'}_${period}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

import { Invoice, TallyConfig } from '../types';

export function sanitizeXml(str: string | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatDateToTally(dateStr: string): string {
  // input YYYY-MM-DD -> output YYYYMMDD
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '');
}

export function generateVoucherXml(invoice: Invoice, config: TallyConfig): string {
  const tallyDate = formatDateToTally(invoice.date);
  const companyTag = config.companyName.trim()
    ? `<SVCURRENTCOMPANY>${sanitizeXml(config.companyName)}</SVCURRENTCOMPANY>`
    : '';

  const totalTaxable = invoice.items.reduce((sum, item) => sum + item.amount, 0);

  let inventoryEntriesXml = '';
  if (invoice.items && invoice.items.length > 0) {
    inventoryEntriesXml = invoice.items
      .map(
        (item) => `
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>${sanitizeXml(item.name)}</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <RATE>${item.rate}/${sanitizeXml(item.unit || 'PCS')}</RATE>
            <ACTUALQTY>${item.qty} ${sanitizeXml(item.unit || 'PCS')}</ACTUALQTY>
            <BILLEDQTY>${item.qty} ${sanitizeXml(item.unit || 'PCS')}</BILLEDQTY>
            <AMOUNT>${item.amount.toFixed(2)}</AMOUNT>
            <ACCOUNTINGALLOCATIONS.LIST>
              <LEDGERNAME>${sanitizeXml(invoice.salesLedger || config.salesLedgerName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${item.amount.toFixed(2)}</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>`
      )
      .join('\n');
  }

  // Tax and party ledger entries
  const partyLedgerXml = `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${sanitizeXml(invoice.partyName)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
            <AMOUNT>-${invoice.totalAmount.toFixed(2)}</AMOUNT>
            <BILLALLOCATIONS.LIST>
              <NAME>${sanitizeXml(invoice.invoiceNo)}</NAME>
              <BILLTYPE>New Ref</BILLTYPE>
              <AMOUNT>-${invoice.totalAmount.toFixed(2)}</AMOUNT>
            </BILLALLOCATIONS.LIST>
          </ALLLEDGERENTRIES.LIST>`;

  // If no inventory entries, add simple sales ledger entry
  const salesLedgerXml =
    invoice.items.length === 0
      ? `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${sanitizeXml(invoice.salesLedger || config.salesLedgerName)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${totalTaxable.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`
      : '';

  let taxLedgersXml = '';
  if (invoice.isInterState) {
    if (invoice.igstAmount > 0) {
      taxLedgersXml += `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${sanitizeXml(config.igstLedgerName || 'IGST')}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${invoice.igstAmount.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`;
    }
  } else {
    if (invoice.cgstAmount > 0) {
      taxLedgersXml += `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${sanitizeXml(config.cgstLedgerName || 'CGST')}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${invoice.cgstAmount.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`;
    }
    if (invoice.sgstAmount > 0) {
      taxLedgersXml += `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${sanitizeXml(config.sgstLedgerName || 'SGST')}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${invoice.sgstAmount.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`;
    }
  }

  let roundOffXml = '';
  if (Math.abs(invoice.roundOff) > 0.001) {
    roundOffXml = `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${sanitizeXml(config.roundOffLedgerName || 'Round Off')}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${invoice.roundOff < 0 ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
            <AMOUNT>${Math.abs(invoice.roundOff).toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`;
  }

  const narrationXml = invoice.narration
    ? `<NARRATION>${sanitizeXml(invoice.narration)}</NARRATION>`
    : `<NARRATION>Imported from Portal Invoice #${sanitizeXml(invoice.invoiceNo)}</NARRATION>`;

  return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${sanitizeXml(invoice.voucherType || config.salesVoucherType)}" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${tallyDate}</DATE>
            <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
            <VOUCHERTYPENAME>${sanitizeXml(invoice.voucherType || config.salesVoucherType)}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${sanitizeXml(invoice.invoiceNo)}</VOUCHERNUMBER>
            <REFERENCE>${sanitizeXml(invoice.invoiceNo)}</REFERENCE>
            <PARTYLEDGERNAME>${sanitizeXml(invoice.partyName)}</PARTYLEDGERNAME>
            <PARTYNAME>${sanitizeXml(invoice.partyName)}</PARTYNAME>
            <BASICBUYERNAME>${sanitizeXml(invoice.partyName)}</BASICBUYERNAME>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
            <ISINVOICE>Yes</ISINVOICE>
            ${narrationXml}
            ${partyLedgerXml}
            ${salesLedgerXml}
            ${inventoryEntriesXml}
            ${taxLedgersXml}
            ${roundOffXml}
          </VOUCHER>
        </TALLYMESSAGE>`;
}

export function generateBulkEnvelopeXml(invoices: Invoice[], config: TallyConfig): string {
  const companyTag = config.companyName.trim()
    ? `<SVCURRENTCOMPANY>${sanitizeXml(config.companyName)}</SVCURRENTCOMPANY>`
    : '';

  const vouchersXml = invoices.map((inv) => generateVoucherXml(inv, config)).join('\n');

  return `<!-- Tally Prime Compliant XML Envelope -->
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          ${companyTag}
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${vouchersXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function generateMastersXml(invoices: Invoice[], config: TallyConfig): string {
  const companyTag = config.companyName.trim()
    ? `<SVCURRENTCOMPANY>${sanitizeXml(config.companyName)}</SVCURRENTCOMPANY>`
    : '';

  // Extract unique parties
  const uniqueParties = new Map<string, Invoice>();
  invoices.forEach((inv) => {
    if (!uniqueParties.has(inv.partyName)) {
      uniqueParties.set(inv.partyName, inv);
    }
  });

  // Extract unique items
  const uniqueItems = new Set<string>();
  invoices.forEach((inv) => {
    inv.items.forEach((item) => {
      if (item.name) uniqueItems.add(item.name);
    });
  });

  const partyLedgersXml = Array.from(uniqueParties.values())
    .map(
      (inv) => `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${sanitizeXml(inv.partyName)}" ACTION="Create">
            <NAME>${sanitizeXml(inv.partyName)}</NAME>
            <PARENT>Sundry Debtors</PARENT>
            <ISBILLWISEON>Yes</ISBILLWISEON>
            ${inv.partyState ? `<STATENAME>${sanitizeXml(inv.partyState)}</STATENAME>` : ''}
            ${inv.partyGstin ? `<PARTYGSTIN>${sanitizeXml(inv.partyGstin)}</PARTYGSTIN>` : ''}
          </LEDGER>
        </TALLYMESSAGE>`
    )
    .join('\n');

  const defaultLedgers = [
    { name: config.salesLedgerName || 'Sales Account', parent: 'Sales Accounts' },
    { name: config.cgstLedgerName || 'CGST', parent: 'Duties & Taxes' },
    { name: config.sgstLedgerName || 'SGST', parent: 'Duties & Taxes' },
    { name: config.igstLedgerName || 'IGST', parent: 'Duties & Taxes' },
    { name: config.roundOffLedgerName || 'Round Off', parent: 'Indirect Expenses' },
  ];

  const taxAndSalesLedgersXml = defaultLedgers
    .map(
      (l) => `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${sanitizeXml(l.name)}" ACTION="Create">
            <NAME>${sanitizeXml(l.name)}</NAME>
            <PARENT>${sanitizeXml(l.parent)}</PARENT>
          </LEDGER>
        </TALLYMESSAGE>`
    )
    .join('\n');

  const stockItemsXml = Array.from(uniqueItems)
    .map(
      (itemName) => `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="${sanitizeXml(itemName)}" ACTION="Create">
            <NAME>${sanitizeXml(itemName)}</NAME>
            <PARENT>Primary</PARENT>
            <BASEUNITS>PCS</BASEUNITS>
          </STOCKITEM>
        </TALLYMESSAGE>`
    )
    .join('\n');

  return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          ${companyTag}
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${partyLedgersXml}
        ${taxAndSalesLedgersXml}
        ${stockItemsXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function downloadXmlFile(xmlContent: string, fileName: string) {
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

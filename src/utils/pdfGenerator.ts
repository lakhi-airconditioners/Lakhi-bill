import { jsPDF } from 'jspdf';
import { Invoice, Quotation } from '../types';

export function renderInvoicePage(
  doc: jsPDF,
  invoice: Invoice,
  customGstin?: string,
  batchInfo?: { current: number; total: number }
): void {
  const primaryDark = [20, 20, 25]; // Slate-950
  const brandRed = [224, 30, 38]; // Lakhi Red #E01E26
  const grayText = [100, 116, 139];

  // Header Bar with Red Accent Line
  doc.setFillColor(20, 20, 25);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setFillColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.rect(0, 27, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('LAKHI AIRCONDITIONERS', 14, 15);

  if (batchInfo) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(254, 202, 202);
    doc.text(`Batch Item ${batchInfo.current} of ${batchInfo.total}`, 196, 15, { align: 'right' });
  }

  const activeGstin = customGstin || invoice.gstNumber;
  const headerSubtitle = activeGstin
    ? `Lakhi Electronics & Cooling Systems • Retail & Godown Hub • GSTIN: ${activeGstin}`
    : `Lakhi Electronics & Cooling Systems • Retail & Godown Hub • Official Tax Bill`;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(254, 202, 202);
  doc.text(headerSubtitle, 14, 22);

  // Invoice Meta
  doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', 14, 38);

  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice No: ${invoice.id}`, 14, 44);
  doc.text(`Date: ${invoice.createdAt ? invoice.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}`, 14, 49);
  doc.text(`Payment Status: ${invoice.paymentStatus}`, 14, 54);
  if (invoice.linkedQuoteId) {
    doc.text(`Linked Quote: ${invoice.linkedQuoteId}`, 14, 59);
  }

  // Billed To Box with Two Address Fields
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(110, 32, 86, 32, 2, 2, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.text('BILLED TO (LEGAL CUSTOMER):', 114, 38);

  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${invoice.customerExternalName || 'Customer'} (Ph: ${invoice.customerPhone || 'N/A'})`, 114, 43);
  if (invoice.billingAddress) {
    doc.text(`Bill Addr: ${invoice.billingAddress.slice(0, 42)}`, 114, 48);
  }
  if (invoice.installationAddress) {
    doc.text(`Inst Addr: ${invoice.installationAddress.slice(0, 42)}`, 114, 53);
  }
  doc.text(`Customer ID: ${invoice.customerId}`, 114, 58);

  // Items Table Header
  let startY = 68;
  doc.setFillColor(254, 242, 242);
  doc.rect(14, startY, 182, 8, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.text('ITEM / MODEL / SERIAL NO', 16, startY + 5.5);
  doc.text('TYPE', 90, startY + 5.5);
  doc.text('QTY', 115, startY + 5.5);
  doc.text('RATE', 130, startY + 5.5);
  doc.text('TAX', 152, startY + 5.5);
  doc.text('TOTAL', 174, startY + 5.5);

  startY += 10;
  doc.setFont('helvetica', 'normal');

  invoice.items.forEach((item, index) => {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(`${index + 1}. ${item.name} (${item.modelNo || 'Std'})`, 16, startY);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    const isAc = (item.type || '').toUpperCase() === 'AC';
    const iduModelStr = item.indoorModelNo ? `[Model: ${item.indoorModelNo}] ` : '';
    const oduModelStr = item.outdoorModelNo ? `[Model: ${item.outdoorModelNo}] ` : '';
    const snInfo = isAc
      ? `Indoor: ${iduModelStr}S/N: ${item.indoorUnitSerial || item.serialNo || '-'} | Outdoor: ${oduModelStr}S/N: ${item.outdoorUnitSerial || '-'}`
      : item.serialNo
      ? `SN: ${item.serialNo}`
      : 'Serial: Pending Registration';
    doc.text(snInfo, 16, startY + 4);

    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.setFontSize(8);
    doc.text(`${item.type || 'Appliance'}`, 90, startY);
    doc.text(`${item.quantity}`, 115, startY);
    doc.text(`₹${item.rate.toLocaleString('en-IN')}`, 130, startY);
    doc.text(`${item.taxPercent}%`, 152, startY);
    doc.text(`₹${item.lineTotal.toLocaleString('en-IN')}`, 174, startY);

    startY += 11;
  });

  startY += 2;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, startY, 196, startY);
  startY += 5;

  // Split Payment Breakdown
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('PREPAID ADVANCE & PAYMENT SPLITS:', 14, startY);
  startY += 4.5;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  const splits = invoice.prepaidSplits || { fromBalance: 0, upi: { amount: 0, receivingBank: '', utr: '' }, card: { amount: 0, receivingBank: '', authId: '' }, chequeOrNeft: { amount: 0, chequeOrSlipOrUtr: '', bank: '' }, cash: { amount: 0, drawerRegister: '' } };
  const splitLines: string[] = [];
  if (splits.fromBalance > 0) splitLines.push(`• Balance Pool: ₹${splits.fromBalance.toLocaleString('en-IN')}`);
  if (splits.upi?.amount > 0) splitLines.push(`• UPI (${splits.upi.receivingBank || 'Bank'}): ₹${splits.upi.amount.toLocaleString('en-IN')} [UTR: ${splits.upi.utr || 'N/A'}]`);
  if (splits.card?.amount > 0) splitLines.push(`• Card POS: ₹${splits.card.amount.toLocaleString('en-IN')} [Auth: ${splits.card.authId || 'N/A'}]`);
  if (splits.chequeOrNeft?.amount > 0) splitLines.push(`• Cheque/NEFT: ₹${splits.chequeOrNeft.amount.toLocaleString('en-IN')} [Ref: ${splits.chequeOrNeft.chequeOrSlipOrUtr || 'N/A'}]`);
  if (splits.cash?.amount > 0) splitLines.push(`• Cash: ₹${splits.cash.amount.toLocaleString('en-IN')}`);

  if (splitLines.length === 0) {
    doc.text('No upfront advance recorded.', 14, startY);
    startY += 4;
  } else {
    splitLines.forEach((line) => {
      doc.text(line, 14, startY);
      startY += 4;
    });
  }

  // Summary Totals Box
  const summaryBoxY = startY + 2;
  const roundOff = invoice.roundOffAmount ?? 0;
  const hasDiscount = (invoice.discountAmount || 0) > 0;
  const boxHeight = hasDiscount ? 42 : 36;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(114, summaryBoxY, 82, boxHeight, 2, 2, 'F');

  doc.setFontSize(7.5);
  doc.setTextColor(grayText[0], grayText[1], grayText[2]);
  let currentSummaryY = summaryBoxY + 5;
  
  doc.text('Subtotal (Taxable):', 118, currentSummaryY);
  doc.text(`₹${invoice.subtotal.toLocaleString('en-IN')}`, 174, currentSummaryY);
  currentSummaryY += 4.5;

  // Split GST: CGST & SGST (Equal 50% each for standard intra-state sales)
  const cgstAmount = Math.round(invoice.taxAmount / 2);
  const sgstAmount = invoice.taxAmount - cgstAmount;
  doc.text(`CGST (Central Tax):`, 118, currentSummaryY);
  doc.text(`₹${cgstAmount.toLocaleString('en-IN')}`, 174, currentSummaryY);
  currentSummaryY += 4.5;

  doc.text(`SGST (State Tax):`, 118, currentSummaryY);
  doc.text(`₹${sgstAmount.toLocaleString('en-IN')}`, 174, currentSummaryY);
  currentSummaryY += 4.5;

  if (hasDiscount) {
    doc.text('Trade Discount:', 118, currentSummaryY);
    doc.text(`-₹${(invoice.discountAmount || 0).toLocaleString('en-IN')}`, 174, currentSummaryY);
    currentSummaryY += 4.5;
  }

  // Round Off Amount
  const roundOffSign = roundOff > 0 ? '+' : '';
  doc.text('Round Off (+/-):', 118, currentSummaryY);
  doc.text(`${roundOff !== 0 ? `${roundOffSign}₹${roundOff.toFixed(2)}` : '₹0.00'}`, 174, currentSummaryY);
  currentSummaryY += 4.5;

  // Net Bill Amount
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('Net Total Bill:', 118, currentSummaryY);
  doc.text(`₹${invoice.totalAmount.toLocaleString('en-IN')}`, 174, currentSummaryY);
  currentSummaryY += 4.5;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayText[0], grayText[1], grayText[2]);
  doc.text('Total Prepaid:', 118, currentSummaryY);
  doc.text(`₹${invoice.totalPrepaid.toLocaleString('en-IN')}`, 174, currentSummaryY);
  currentSummaryY += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.text('Balance Due:', 118, currentSummaryY);
  doc.text(`₹${invoice.amountDue.toLocaleString('en-IN')}`, 174, currentSummaryY);

  // Terms and Signature Box
  const bottomY = Math.max(summaryBoxY + boxHeight + 8, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayText[0], grayText[1], grayText[2]);
  doc.text('TERMS & CONDITIONS:', 14, bottomY);
  doc.text('1. All appliances/airconditioners carry standard manufacturer brand warranty.', 14, bottomY + 3.5);
  doc.text('2. Warranty calls and repairs are handled by authorized brand service centers.', 14, bottomY + 7);
  doc.text('3. Please preserve this invoice and serial number record for brand registration.', 14, bottomY + 10.5);

  // Authorized Signatory
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('For LAKHI AIRCONDITIONERS', 140, bottomY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayText[0], grayText[1], grayText[2]);
  doc.text('Authorized Signatory / Cashier', 140, bottomY + 12);
  doc.setDrawColor(200, 200, 200);
  doc.line(140, bottomY + 10, 192, bottomY + 10);

  // Footer Note
  doc.setFontSize(7);
  doc.setTextColor(grayText[0], grayText[1], grayText[2]);
  const footerText = batchInfo
    ? `Lakhi Airconditioners • Official Tax Invoice • Batch Document ${batchInfo.current} of ${batchInfo.total} • Computer Generated.`
    : 'Lakhi Airconditioners • Official Tax Invoice with Warranty Serials • Computer Generated.';
  doc.text(footerText, 14, 282);
}

export function generateInvoicePdf(
  invoice: Invoice,
  customGstin?: string
): { doc: jsPDF; url: string; filename: string } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  renderInvoicePage(doc, invoice, customGstin);

  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  return { doc, url, filename: `Invoice_${invoice.id}.pdf` };
}

export function generateBatchInvoicesPdf(
  invoices: Invoice[],
  customGstin?: string
): { doc: jsPDF; url: string; filename: string } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  invoices.forEach((inv, index) => {
    if (index > 0) {
      doc.addPage('a4', 'portrait');
    }
    renderInvoicePage(doc, inv, customGstin, {
      current: index + 1,
      total: invoices.length,
    });
  });

  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const dateStr = new Date().toISOString().slice(0, 10);
  return {
    doc,
    url,
    filename: `Lakhi_Invoices_Batch_${invoices.length}_Docs_${dateStr}.pdf`,
  };
}

export function generateQuotationPdf(
  quotation: Quotation,
  customGstin?: string
): { doc: jsPDF; url: string; filename: string } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryDark = [20, 20, 25];
  const brandRed = [224, 30, 38];
  const grayText = [100, 116, 139];

  // Header Bar
  doc.setFillColor(20, 20, 25);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setFillColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.rect(0, 27, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('LAKHI AIRCONDITIONERS', 14, 15);

  const activeGstin = customGstin || quotation.gstNumber;
  const quoteSubtitle = activeGstin
    ? `Lakhi Electronics & Cooling Proposal • GSTIN: ${activeGstin}`
    : `Lakhi Electronics & Cooling Proposal • Official Estimate`;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(254, 202, 202);
  doc.text(quoteSubtitle, 14, 22);

  // Quotation Meta
  doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('EQUIPMENT QUOTATION', 14, 38);

  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Quote No: ${quotation.id}`, 14, 44);
  doc.text(`Date: ${quotation.createdAt.slice(0, 10)}`, 14, 49);
  doc.text(`Status: ${quotation.status}`, 14, 54);

  // Customer Box with Two Addresses
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(110, 32, 86, 30, 2, 2, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.text('PREPARED FOR:', 114, 38);

  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${quotation.customerExternalName || 'Client'} (Ph: ${quotation.customerPhone || 'N/A'})`, 114, 43);
  if (quotation.billingAddress) {
    doc.text(`Bill Addr: ${quotation.billingAddress.slice(0, 42)}`, 114, 48);
  }
  if (quotation.installationAddress) {
    doc.text(`Inst Addr: ${quotation.installationAddress.slice(0, 42)}`, 114, 53);
  }
  doc.text(`Customer ID: ${quotation.customerId}`, 114, 58);

  // Items Table Header
  let startY = 68;
  doc.setFillColor(254, 242, 242);
  doc.rect(14, startY, 182, 8, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.text('PRODUCT / MODEL', 16, startY + 5.5);
  doc.text('TYPE', 90, startY + 5.5);
  doc.text('QTY', 115, startY + 5.5);
  doc.text('RATE', 130, startY + 5.5);
  doc.text('TAX', 152, startY + 5.5);
  doc.text('TOTAL', 174, startY + 5.5);

  startY += 10;
  doc.setFont('helvetica', 'normal');

  quotation.items.forEach((item, index) => {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(`${index + 1}. ${item.name} (${item.modelNo || 'Std'})`, 16, startY);

    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${item.type || 'Appliance'}`, 90, startY);
    doc.text(`${item.quantity}`, 115, startY);
    doc.text(`₹${item.rate.toLocaleString('en-IN')}`, 130, startY);
    doc.text(`${item.taxPercent}%`, 152, startY);
    doc.text(`₹${item.lineTotal.toLocaleString('en-IN')}`, 174, startY);

    startY += 8;
  });

  startY += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, startY, 196, startY);
  startY += 8;

  // Notes
  if (quotation.notes) {
    doc.setFontSize(8);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text(`Notes: ${quotation.notes}`, 14, startY);
    startY += 8;
  }

  // Summary Totals Box
  const summaryBoxY = startY;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(120, summaryBoxY, 76, 24, 2, 2, 'F');

  doc.setFontSize(8);
  doc.setTextColor(grayText[0], grayText[1], grayText[2]);
  doc.text('Subtotal:', 124, summaryBoxY + 6);
  doc.text(`₹${quotation.subtotal.toLocaleString('en-IN')}`, 174, summaryBoxY + 6);

  doc.text('Tax Amount:', 124, summaryBoxY + 12);
  doc.text(`₹${quotation.taxAmount.toLocaleString('en-IN')}`, 174, summaryBoxY + 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.text('Total Estimate:', 124, summaryBoxY + 19);
  doc.text(`₹${quotation.totalAmount.toLocaleString('en-IN')}`, 174, summaryBoxY + 19);

  // Footer Note
  doc.setFontSize(7.5);
  doc.setTextColor(grayText[0], grayText[1], grayText[2]);
  doc.text('Lakhi Airconditioners • Valid for 15 days from issuance • Computer Generated Proposal.', 14, 280);

  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  return { doc, url, filename: `Quotation_${quotation.id}.pdf` };
}

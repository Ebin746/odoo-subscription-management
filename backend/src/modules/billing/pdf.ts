import PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';

type InvoiceForPdf = Prisma.InvoiceGetPayload<{ include: { lines: true } }>;

const money = (v: Prisma.Decimal | number) => Number(v).toFixed(2);
const day = (d: Date) => d.toISOString().slice(0, 10);

// Renders an invoice to a PDF buffer.
export function renderInvoicePdf(invoice: InvoiceForPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Brightloop Software', { align: 'left' });
    doc.fontSize(12).text(`Invoice ${invoice.number}`, { align: 'right' });
    doc.fontSize(10).text(`Status: ${invoice.status}`, { align: 'right' });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Bill to: ${invoice.customerName}`);
    if (invoice.customerCompany) doc.text(invoice.customerCompany);
    if (invoice.customerAddress) doc.text(invoice.customerAddress);
    doc.text(invoice.customerEmail);
    doc.moveDown(0.5);
    doc.text(`Issue date: ${day(invoice.issueDate)}    Due date: ${day(invoice.dueDate)}`);
    doc.text(`Billing period: ${day(invoice.periodStart)} to ${day(invoice.periodEnd)}`);
    doc.moveDown();

    const col = { desc: 50, qty: 270, price: 320, tax: 400, amount: 480 };
    let y = doc.y;
    doc.font('Helvetica-Bold');
    doc.text('Description', col.desc, y);
    doc.text('Qty', col.qty, y);
    doc.text('Unit price', col.price, y);
    doc.text('Tax', col.tax, y);
    doc.text('Amount', col.amount, y);
    doc.font('Helvetica');
    y += 18;
    doc.moveTo(50, y - 4).lineTo(545, y - 4).stroke();

    for (const line of invoice.lines) {
      if (y > 720) {
        doc.addPage();
        y = 50;
      }
      doc.text(line.description, col.desc, y, { width: 210 });
      doc.text(String(line.quantity), col.qty, y);
      doc.text(money(line.unitPrice), col.price, y);
      doc.text(money(line.taxAmount), col.tax, y);
      doc.text(money(line.amount), col.amount, y);
      y += 20;
    }

    y += 10;
    doc.moveTo(300, y).lineTo(545, y).stroke();
    y += 8;
    const totals: [string, string][] = [
      ['Subtotal', money(invoice.subtotal)],
      ['Discounts', `-${money(invoice.discountTotal)}`],
      ['Tax', money(invoice.taxTotal)],
      ['Total', money(invoice.total)],
      ['Paid', money(invoice.amountPaid)],
      ['Balance due', money(Number(invoice.total) - Number(invoice.amountPaid))],
    ];
    for (const [label, value] of totals) {
      doc.text(label, 300, y);
      doc.text(value, col.amount, y);
      y += 16;
    }

    doc.end();
  });
}

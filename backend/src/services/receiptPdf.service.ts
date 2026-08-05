import PDFDocument from 'pdfkit';
import { prisma } from '../config/database';
import { AppError } from '../middlewares/errorHandler';

/**
 * Genera un PDF con la nota de venta / factura electrónica.
 * - Si está AUTORIZADA: muestra el número de autorización del SRI.
 * - Si está REJECTED: muestra el estado y el error (si lo hay).
 * - Acepta un receiptId (comprobante) o un orderId (pedido sin factura).
 */
export async function generarNotaVentaPdf(params: { receiptId?: string; orderId?: string }): Promise<Buffer> {
  const { receiptId, orderId } = params;

  // 1. Buscar el receipt (si viene por id o por orderId)
  let receipt = receiptId
    ? await prisma.electronicReceipt.findUnique({ where: { id: receiptId } })
    : orderId
      ? await prisma.electronicReceipt.findUnique({ where: { orderId } })
      : null;

  // 2. Buscar la orden (directa o desde el receipt)
  const order = await prisma.order.findUnique({
    where: { id: receipt?.orderId || orderId || '' },
    include: {
      items: { include: { product: true } },
      payments: true,
      branch: { include: { fiscalConfig: true } },
      table: true,
      user: { select: { name: true } },
    },
  });

  if (!order) throw new AppError('Pedido no encontrado', 404);

  const fiscal = order.branch.fiscalConfig;
  const autorizada = receipt?.status === 'AUTHORIZED';
  const sec = String(receipt?.sequential || order.createdAt.getTime() % 1000000000).padStart(9, '0');
  const serie = `${fiscal?.establishmentCode || '001'}-${fiscal?.emissionPointCode || '001'}-${sec}`;
  const fecha = new Date(order.createdAt).toLocaleString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const cocoa = '#3b2416';
    const brown = '#5a3a23';
    const gold = '#c9a87c';
    const gray = '#555';
    const lightGray = '#999';

    // ===== Encabezado =====
    doc.rect(0, 0, doc.page.width, 130).fill(cocoa);
    doc
      .fill(gold)
      .fontSize(26)
      .font('Helvetica-Bold')
      .text(fiscal?.businessName || order.branch.name || 'CASA MILKS', 48, 30, { align: 'center' });
    if (fiscal?.tradeName) {
      doc.fill('#f3e0c3').fontSize(13).font('Helvetica').text(fiscal.tradeName, 48, 62, { align: 'center' });
    }
    doc
      .fill(gold)
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('NOTA DE VENTA / FACTURA ELECTRÓNICA', 48, 90, { align: 'center' });
    doc
      .fill('#f3e0c3')
      .fontSize(11)
      .font('Helvetica')
      .text(serie, 48, 112, { align: 'center' });

    // ===== Datos del emisor =====
    let y = 150;
    doc.fill(cocoa).fontSize(10).font('Helvetica-Bold').text('EMISOR', 48, y);
    y += 16;
    doc.fill(gray).fontSize(9.5).font('Helvetica');
    doc.text(`RUC: ${fiscal?.ruc || '—'}`, 48, y);
    y += 13;
    if (fiscal?.address) { doc.text(`Dirección: ${fiscal.address}`, 48, y); y += 13; }
    if (fiscal?.phone) { doc.text(`Teléfono: ${fiscal.phone}`, 48, y); y += 13; }
    if (fiscal?.email) { doc.text(`Email: ${fiscal.email}`, 48, y); y += 13; }

    // ===== Datos del comprador =====
    y += 6;
    doc.fill(cocoa).font('Helvetica-Bold').text('CLIENTE', 48, y);
    y += 16;
    doc.fill(gray).font('Helvetica').fontSize(9.5);
    doc.text(`Nombre: ${order.invoiceName || order.customerName || '—'}`, 48, y);
    y += 13;
    doc.text(`Cédula/RUC: ${order.invoiceDocId || '—'}`, 48, y);
    y += 13;
    if (order.invoiceEmail) { doc.text(`Email: ${order.invoiceEmail}`, 48, y); y += 13; }
    if (order.invoiceAddress) { doc.text(`Dirección: ${order.invoiceAddress}`, 48, y); y += 13; }

    // ===== Datos de la factura (derecha) =====
    const rightX = doc.page.width - 48 - 220;
    doc.fill(cocoa).font('Helvetica-Bold').fontSize(10).text('DATOS DE LA FACTURA', rightX, 150);
    doc.fill(gray).font('Helvetica').fontSize(9.5);
    let ry = 166;
    const row = (label: string, value: string) => {
      doc.text(label, rightX, ry);
      doc.text(value, rightX + 90, ry);
      ry += 14;
    };
    row('Fecha:', fecha);
    row('Mesa:', order.table?.name || 'Para llevar');
    row('Estado:', autorizada ? 'AUTORIZADA' : receipt ? receipt.status : 'SIN FACTURA');
    if (autorizada) {
      ry += 2;
      doc.font('Helvetica-Bold').fontSize(8.5).fill('#2e7d32').text('N°. AUTORIZACIÓN', rightX, ry);
      ry += 11;
      doc.font('Helvetica').fontSize(7.5).text(receipt?.numeroAutorizacion || '', rightX, ry, { width: 220, lineBreak: true });
      ry += 30;
      doc.font('Helvetica-Bold').fill(cocoa).fontSize(8.5).text('CLAVE DE ACCESO', rightX, ry);
      ry += 11;
      doc.font('Helvetica').fontSize(7.5).text(receipt?.claveAcceso || '', rightX, ry, { width: 220, lineBreak: true });
    } else if (receipt?.errorMessage) {
      ry += 4;
      doc.fill('#c0392b').font('Helvetica').fontSize(8).text('Error SRI:', rightX, ry);
      ry += 11;
      doc.fill(gray).fontSize(7.5).text(receipt.errorMessage.slice(0, 300), rightX, ry, { width: 220 });
    }

    // ===== Detalle de productos =====
    y = Math.max(y, ry) + 24;
    doc.fill(cocoa).font('Helvetica-Bold').fontSize(11).text('DETALLE', 48, y);
    y += 18;

    // Cabecera de la tabla
    doc.rect(48, y, doc.page.width - 96, 20).fill('#f5f0e8');
    doc.fill(cocoa).fontSize(9).font('Helvetica-Bold');
    doc.text('Cant.', 54, y + 6, { width: 40 });
    doc.text('Producto', 95, y + 6, { width: 250 });
    doc.text('P. Unit.', 355, y + 6, { width: 70, align: 'right' });
    doc.text('Subtotal', 440, y + 6, { width: 70, align: 'right' });
    y += 22;

    // Filas
    doc.font('Helvetica').fontSize(9);
    order.items.forEach((item) => {
      const subtotal = Number(item.subtotal);
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 48;
      }
      doc.fill(gray);
      doc.text(String(item.quantity), 54, y, { width: 40 });
      doc.text(item.product?.name || 'Producto', 95, y, { width: 250 });
      doc.text(`$${Number(item.unitPrice).toFixed(2)}`, 355, y, { width: 70, align: 'right' });
      doc.text(`$${subtotal.toFixed(2)}`, 440, y, { width: 70, align: 'right' });
      y += 16;
    });

    // ===== Totales =====
    y += 10;
    const total = Number(order.total);
    doc.font('Helvetica-Bold').fontSize(10).fill(cocoa);
    doc.text('TOTAL', 440 - 70, y, { width: 70, align: 'right' });
    doc.text(`$${total.toFixed(2)}`, 440, y, { width: 70, align: 'right' });
    y += 18;

    // Formas de pago
    if (order.payments?.length) {
      doc.font('Helvetica').fontSize(9).fill(gray);
      order.payments.forEach((p) => {
        doc.text(`Pago: ${p.method} — $${Number(p.amount).toFixed(2)}`, 440 - 70 - 250, y, { width: 320 });
        y += 13;
      });
    }

    // ===== Pie =====
    y += 10;
    if (fiscal?.rimpeLegend) {
      doc.fill(gray).fontSize(8).text(fiscal.rimpeLegend, 48, y, { align: 'center', width: doc.page.width - 96 });
      y += 13;
    }
    doc.fill(lightGray).fontSize(7.5).text('Documento generado electrónicamente. Verifique en el portal del SRI.', 48, y, { align: 'center', width: doc.page.width - 96 });

    doc.end();
  });
}

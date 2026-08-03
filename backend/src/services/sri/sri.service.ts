import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { generarClaveAcceso } from './claveAcceso';
import { generarFacturaXML, mapPaymentMethodToSri } from './facturaXml';
import { firmarXML, getCertInfo } from './firma';
import { enviarRecepcion, esperarAutorizacion } from './sriClient';

const AMBIENTE = process.env.SRI_AMBIENTE || '1'; // 1=pruebas, 2=producción

export interface EmitInvoiceResult {
  claveAcceso: string;
  numeroAutorizacion?: string;
  estado: string;
  mensajes: Array<{ identificador: string; mensaje: string }>;
  sequential: number;
}

/**
 * Emite la factura electrónica de una orden:
 * 1. Valida que tenga datos de factura + firma configurada.
 * 2. Genera clave de acceso y XML.
 * 3. Firma con el .p12.
 * 4. Envía al SRI (recepción) y consulta autorización.
 * 5. Guarda el comprobante en BD.
 */
export async function emitirFacturaElectronica(orderId: string): Promise<EmitInvoiceResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: true } },
      payments: true,
      branch: { include: { fiscalConfig: true } },
      table: true,
    },
  });

  if (!order) throw new AppError('Pedido no encontrado', 404);
  if (!order.invoiceName || !order.invoiceDocId) {
    throw new AppError('La orden no tiene datos de factura del cliente');
  }

  const fiscal = order.branch.fiscalConfig;
  if (!fiscal) throw new AppError('El local no tiene configuración fiscal');

  const signature = await prisma.digitalSignature.findUnique({ where: { branchId: order.branchId } });
  if (!signature) throw new AppError('No hay firma electrónica configurada para este local');

  // Secuencial
  const seq = await prisma.receiptSequence.upsert({
    where: { branchId_year_type: { branchId: order.branchId, year: new Date().getFullYear(), type: 'FACTURA' } },
    create: { branchId: order.branchId, year: new Date().getFullYear(), type: 'FACTURA', lastUsed: 1 },
    update: { lastUsed: { increment: 1 } },
  });
  const sequential = seq.lastUsed;

  // Clave de acceso
  const claveAcceso = generarClaveAcceso({
    fechaEmision: order.createdAt,
    tipoComprobante: '01',
    ruc: fiscal.ruc,
    ambiente: AMBIENTE,
    establecimiento: fiscal.establishmentCode || '001',
    puntoEmision: fiscal.emissionPointCode || '001',
    secuencial: sequential,
  });

  // XML
  const xml = generarFacturaXML({
    ambiente: AMBIENTE,
    ruc: fiscal.ruc,
    razonSocial: fiscal.businessName,
    nombreComercial: fiscal.tradeName,
    claveAcceso,
    establecimiento: fiscal.establishmentCode || '001',
    puntoEmision: fiscal.emissionPointCode || '001',
    secuencial: sequential,
    dirMatriz: fiscal.address,
    dirEstablecimiento: fiscal.address,
    obligadoContabilidad: 'SI',
    contribuyenteRimpe: fiscal.rimpeLegend || undefined,
    telefono: fiscal.phone || undefined,
    email: fiscal.email || undefined,
    identificacionComprador: order.invoiceDocId,
    razonSocialComprador: order.invoiceName,
    direccionComprador: order.invoiceAddress || 'Latacunga',
    emailComprador: order.invoiceEmail || undefined,
    telefonoComprador: order.invoicePhone || undefined,
    fechaEmision: order.createdAt,
    items: order.items.map((i) => ({
      codigoPrincipal: i.productId,
      descripcion: i.product?.name || 'Producto',
      cantidad: i.quantity,
      precioUnitario: Number(i.unitPrice),
      taxRate: Number(i.product?.taxRate || 0),
    })),
    pagos: (order.payments || []).map((p) => ({
      codigo: mapPaymentMethodToSri(p.method),
      total: Number(p.amount),
    })),
  });

  // Firmar
  const xmlFirmado = firmarXML(xml, signature.p12Base64, signature.password);

  // Guardar comprobante (estado inicial PENDING)
  const receipt = await prisma.electronicReceipt.upsert({
    where: { orderId },
    create: {
      orderId,
      branchId: order.branchId,
      sequential,
      authorization: `CASAMILKS-${sequential}`,
      claveAcceso,
      ambiente: AMBIENTE,
      xmlContent: xmlFirmado,
      status: 'PENDING',
    },
    update: {
      sequential,
      claveAcceso,
      ambiente: AMBIENTE,
      xmlContent: xmlFirmado,
      status: 'PENDING',
      errorMessage: null,
    },
  });

  // Enviar al SRI
  try {
    const recepcion = await enviarRecepcion(AMBIENTE, xmlFirmado);
    if (recepcion.estado !== 'RECIBIDA') {
      const msgs = recepcion.mensajes.map((m) => `${m.identificador}: ${m.mensaje}`).join(' | ');
      await prisma.electronicReceipt.update({
        where: { id: receipt.id },
        data: { status: 'REJECTED', errorMessage: msgs || 'Comprobante devuelto por el SRI' },
      });
      return {
        claveAcceso,
        estado: 'DEVUELTA',
        mensajes: recepcion.mensajes,
        sequential,
      };
    }

    // Consultar autorización (con reintentos)
    const autorizacion = await esperarAutorizacion(AMBIENTE, claveAcceso);

    if (autorizacion.estado === 'AUTORIZADO') {
      await prisma.electronicReceipt.update({
        where: { id: receipt.id },
        data: {
          status: 'AUTHORIZED',
          numeroAutorizacion: autorizacion.numeroAutorizacion,
          xmlAutorizado: autorizacion.xmlAutorizado,
          authorizedAt: new Date(),
        },
      });
      return {
        claveAcceso,
        numeroAutorizacion: autorizacion.numeroAutorizacion,
        estado: 'AUTORIZADO',
        mensajes: [],
        sequential,
      };
    }

    const msgs = autorizacion.mensajes.map((m) => `${m.identificador}: ${m.mensaje}`).join(' | ');
    await prisma.electronicReceipt.update({
      where: { id: receipt.id },
      data: { status: 'REJECTED', errorMessage: msgs || `Estado SRI: ${autorizacion.estado}` },
    });

    return {
      claveAcceso,
      estado: autorizacion.estado,
      mensajes: autorizacion.mensajes,
      sequential,
    };
  } catch (err: any) {
    await prisma.electronicReceipt.update({
      where: { id: receipt.id },
      data: { status: 'REJECTED', errorMessage: err?.message || 'Error de conexión con el SRI' },
    });
    throw new AppError(`Error al comunicarse con el SRI: ${err?.message || 'desconocido'}`, 502);
  }
}

/** Info de la firma configurada (sin datos sensibles). */
export async function getSignatureInfo(branchId: string) {
  const signature = await prisma.digitalSignature.findUnique({ where: { branchId } });
  if (!signature) return null;

  return {
    id: signature.id,
    label: signature.label,
    certSubject: signature.certSubject,
    certSerial: signature.certSerial,
    validFrom: signature.validFrom,
    validTo: signature.validTo,
    active: signature.active,
    createdAt: signature.createdAt,
  };
}

/** Guarda (o reemplaza) la firma electrónica del local. */
export async function saveSignature(branchId: string, p12Base64: string, password: string, label?: string) {
  // Validar que el .p12 y la clave son correctos ANTES de guardar
  let info;
  try {
    info = getCertInfo(p12Base64, password);
  } catch (err: any) {
    throw new AppError(`Archivo o clave de firma inválidos: ${err?.message || ''}`, 400);
  }

  const data = {
    branchId,
    p12Base64,
    password,
    label: label || 'Firma Electrónica',
    certSubject: info.subject,
    certSerial: info.serial,
    validFrom: info.notBefore,
    validTo: info.notAfter,
    active: true,
  };

  return prisma.digitalSignature.upsert({
    where: { branchId },
    create: data,
    update: data,
  });
}

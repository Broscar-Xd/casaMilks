import { prisma } from '../config/database';
import { AppError } from '../middlewares/errorHandler';
import { receiptRepository } from '../repositories/receipt.repository';
import { emitirFacturaElectronica } from './sri/sri.service';

export const receiptService = {
  /** Lista todas las facturas electrónicas de un local. */
  list: (branchId: string) => receiptRepository.listByBranch(branchId),

  /**
   * Vuelve a enviar una factura al SRI (recepción + autorización).
   * Se usa cuando el SRI estaba en mantenimiento o falló la comunicación.
   * Regenera el XML (nueva clave de acceso y secuencial) y lo envía de nuevo.
   */
  resend: async (receiptId: string) => {
    const receipt = await receiptRepository.findById(receiptId);
    if (!receipt) throw new AppError('Factura no encontrada', 404);
    if (!receipt.orderId) throw new AppError('La factura no tiene pedido asociado');

    // Si ya está autorizada, no se reenvía
    if (receipt.status === 'AUTHORIZED') {
      throw new AppError('La factura ya fue autorizada por el SRI');
    }

    // Reemitir contra el SRI con el código de producción (genera nueva clave/secuencial)
    const result = await emitirFacturaElectronica(receipt.orderId);
    return result;
  },

  /** Consulta el estado actual de una factura directamente en el SRI. */
  checkStatus: async (receiptId: string) => {
    const receipt = await receiptRepository.findById(receiptId);
    if (!receipt) throw new AppError('Factura no encontrada', 404);
    if (!receipt.claveAcceso) throw new AppError('La factura no tiene clave de acceso');

    const { consultarAutorizacion } = await import('./sri/sriClient.js');
    const AMBIENTE = process.env.SRI_AMBIENTE || '1';
    return consultarAutorizacion(AMBIENTE, receipt.claveAcceso);
  },

  /** Obtiene el XML de una factura (firmado o autorizado). */
  getXml: async (receiptId: string) => {
    const receipt = await receiptRepository.findById(receiptId);
    if (!receipt) throw new AppError('Factura no encontrada', 404);
    return {
      claveAcceso: receipt.claveAcceso,
      xmlContent: receipt.xmlContent,
      xmlAutorizado: receipt.xmlAutorizado,
      status: receipt.status,
    };
  },
};

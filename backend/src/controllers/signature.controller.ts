import { Response, NextFunction } from 'express';
import { getSignatureInfo, saveSignature } from '../services/sri/sri.service';
import { AuthenticatedRequest } from '../types';

export const signatureController = {
  /** GET /api/signatures/:branchId — info de la firma configurada */
  get: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const info = await getSignatureInfo(req.params.branchId);
      res.json({ success: true, data: info });
    } catch (error) {
      next(error);
    }
  },

  /** PUT /api/signatures/:branchId — subir/actualizar firma (.p12 base64 + clave) */
  upsert: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { p12Base64, password, label } = req.body;
      const signature = await saveSignature(req.params.branchId, p12Base64, password, label);
      res.json({
        success: true,
        data: {
          id: signature.id,
          label: signature.label,
          certSubject: signature.certSubject,
          certSerial: signature.certSerial,
          validFrom: signature.validFrom,
          validTo: signature.validTo,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

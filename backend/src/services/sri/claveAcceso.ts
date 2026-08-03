/**
 * Generación de clave de acceso SRI (48 dígitos).
 * Formato: fechaEmision(8) + tipoComprobante(2) + ruc(13) + ambiente(1)
 *          + serie(6) + secuencial(9) + codigoNumerico(8) + digitoVerificador(1)
 */

export function generarClaveAcceso(params: {
  fechaEmision: Date;      // fecha de emisión del comprobante
  tipoComprobante: string; // 01=factura, 04=nota crédito, ...
  ruc: string;             // 13 dígitos
  ambiente: string;        // 1=pruebas, 2=producción
  establecimiento: string; // 3 dígitos
  puntoEmision: string;    // 3 dígitos
  secuencial: number;      // número de factura
}): string {
  const { fechaEmision, tipoComprobante, ruc, ambiente, establecimiento, puntoEmision, secuencial } = params;

  const dia = String(fechaEmision.getDate()).padStart(2, '0');
  const mes = String(fechaEmision.getMonth() + 1).padStart(2, '0');
  const anio = String(fechaEmision.getFullYear());
  const fecha = `${dia}${mes}${anio}`;

  const serie = establecimiento + puntoEmision; // 6 dígitos
  const sec = String(secuencial).padStart(9, '0');
  const codigoNumerico = String(Math.floor(Math.random() * 90000000) + 10000000); // 8 dígitos

  const base = fecha + tipoComprobante + ruc + ambiente + serie + sec + codigoNumerico;
  const digito = calcularDigitoVerificador(base);

  return base + digito;
}

/**
 * Dígito verificador módulo 11 (método SRI).
 * Se multiplican los 47 primeros dígitos por factores que
 * descienden de 2 a 7 ciclando, se suma, se divide para 11
 * y se resta de 11 el residuo.
 */
export function calcularDigitoVerificador(base: string): string {
  const factores = [2, 3, 4, 5, 6, 7];
  let suma = 0;
  let posicion = base.length - 1;
  let factorIndex = 0;

  for (let i = posicion; i >= 0; i--) {
    suma += parseInt(base[i], 10) * factores[factorIndex];
    factorIndex = (factorIndex + 1) % 6;
  }

  const residuo = suma % 11;
  let digito = 11 - residuo;
  if (digito === 11) digito = 0;
  if (digito === 10) digito = 1;

  return String(digito);
}

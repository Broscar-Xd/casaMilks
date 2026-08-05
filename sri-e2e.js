/* Prueba E2E del flujo SRI completo + diagnóstico de BD.
 * Ejecutar en el contenedor: node sri-e2e.js
 * - PARTE A: estado de secuenciales, comprobantes, config fiscal, firma
 * - PARTE B: crea un pedido de prueba y emite la factura con el código REAL
 * - PARTE C: consulta la autorización de la clave generada
 */
const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();
const https = require('https');

async function partA() {
  console.log('========== PARTE A: ESTADO DE BD ==========');
  const seqs = await prisma.receiptSequence.findMany();
  console.log('SECUENCIALES:', JSON.stringify(seqs, null, 1));
  const recs = await prisma.electronicReceipt.findMany({
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { id: true, branchId: true, sequential: true, status: true, claveAcceso: true, errorMessage: true, createdAt: true },
  });
  console.log('ÚLTIMOS COMPROBANTES:');
  recs.forEach((r) => console.log(`  seq=${r.sequential} status=${r.status} err=${(r.errorMessage || '').slice(0, 80)}`));
  const maxSeq = await prisma.electronicReceipt.aggregate({ _max: { sequential: true } });
  console.log('MAX sequential en tabla:', maxSeq._max.sequential);
  const fiscals = await prisma.branchFiscalConfig.findMany({
    select: { branchId: true, ruc: true, businessName: true, establishmentCode: true, emissionPointCode: true },
  });
  console.log('CONFIG FISCAL:', JSON.stringify(fiscals, null, 1));
  const sigs = await prisma.digitalSignature.findMany({
    select: { branchId: true, certSubject: true, certRuc: true, active: true },
  });
  console.log('FIRMAS:', JSON.stringify(sigs, null, 1));
}

async function partB() {
  console.log('\n========== PARTE B: EMISIÓN E2E ==========');
  const branch = await prisma.branch.findFirst({ include: { fiscalConfig: true } });
  const user = await prisma.user.findFirst();
  const product = await prisma.product.findFirst({ where: { branchId: branch.id } });
  if (!branch || !user || !product) { console.log('Faltan datos (branch/user/product)'); return null; }
  console.log('Branch:', branch.name, '| User:', user.name, '| Producto:', product.name);

  // Crear pedido de prueba CERRADO con datos de factura
  const order = await prisma.order.create({
    data: {
      branchId: branch.id,
      userId: user.id,
      customerName: 'Prueba E2E SRI',
      invoiceName: 'Prueba E2E SRI',
      invoiceDocId: '0502073620',
      invoiceEmail: 'e2e@test.com',
      invoicePhone: '0999999999',
      invoiceAddress: 'Latacunga',
      status: 'CLOSED',
      total: Number(product.price),
      items: {
        create: [{ productId: product.id, quantity: 1, unitPrice: Number(product.price), subtotal: Number(product.price) }],
      },
      payments: { create: [{ method: 'CASH', amount: Number(product.price) }] },
    },
  });
  console.log('Orden creada:', order.id);

  // Llamar al servicio REAL de producción
  const { emitirFacturaElectronica } = require('./backend/dist/services/sri/sri.service');
  const result = await emitirFacturaElectronica(order.id);
  console.log('RESULTADO EMISIÓN:');
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function soapAuth(clave) {
  return new Promise((resolve) => {
    const url = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline';
    const env = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Header/><soapenv:Body><aut:autorizacionComprobante xmlns:aut="http://ec.gob.sri.ws.autorizacion"><claveAccesoComprobante>${clave}</claveAccesoComprobante></aut:autorizacionComprobante></soapenv:Body></soapenv:Envelope>`;
    const req = https.request(url, {
      method: 'POST',
      agent: new https.Agent({ rejectUnauthorized: false }),
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""', 'Content-Length': Buffer.byteLength(env) },
    }, (res) => {
      let d = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', (e) => resolve({ status: 0, body: 'NETWORK ERROR: ' + e.message }));
    req.setTimeout(60000, () => { req.destroy(); resolve({ status: 0, body: 'TIMEOUT' }); });
    req.write(env);
    req.end();
  });
}

async function partC(clave) {
  console.log('\n========== PARTE C: CONSULTA AUTORIZACIÓN ==========');
  if (!clave) { console.log('Sin clave que consultar'); return; }
  const r = await soapAuth(clave);
  console.log('STATUS:', r.status);
  // Extraer solo lo relevante: estado, mensajes
  const estado = r.body.match(/<estado>([^<]*)<\/estado>/);
  console.log('ESTADO:', estado?.[1]);
  const mensajes = r.body.match(/<mensaje>[\s\S]*?<\/mensaje>/g) || [];
  mensajes.forEach((m) => {
    const id = m.match(/<identificador>([^<]*)<\/identificador>/)?.[1];
    const msg = m.match(/<mensaje>([^<]*)<\/mensaje>/)?.[1];
    const info = m.match(/<informacionAdicional>([^<]*)<\/informacionAdicional>/)?.[1];
    console.log(`  [${id}] ${msg}${info ? ' | ' + info : ''}`);
  });
}

(async () => {
  try {
    await partA();
    const result = await partB();
    if (result) await partC(result.claveAcceso);
    process.exit(0);
  } catch (e) {
    console.error('\nERROR PRINCIPAL:', e.message);
    console.error(e);
    process.exit(1);
  }
})();

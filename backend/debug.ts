import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function test() {
  const branch = await p.branch.findFirst();
  if (!branch) { console.log('No branch'); return; }
  
  const tables = await p.table.findMany({ where: { branchId: branch.id } });
  console.log('Tables:', tables.map(t => `${t.name}=${t.status}`));
  
  const sends = await p.kitchenSend.findMany({ 
    include: { items: { include: { product: true } }, order: { select: { table: { select: { name: true } } } } } 
  });
  console.log('Kitchen sends:', sends.length);
  for (const s of sends) {
    console.log(` - Send: ${s.id} Status: ${s.status} Table: ${s.order?.table?.name} Items: ${s.items.map(i => `${i.product?.name} x${i.quantity}`).join(', ')}`);
  }
  
  const orders = await p.order.findMany({ where: { branchId: branch.id }, include: { table: true } });
  console.log('Orders:', orders.length);
  for (const o of orders) {
    console.log(` - Order: ${o.id.slice(0,8)} Table: ${o.table?.name} Status: ${o.status} Total: ${o.total}`);
  }
}

test().finally(() => p.$disconnect());

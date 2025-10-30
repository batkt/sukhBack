/*
 Simulate N parallel QPay callbacks to detect race conditions.
 Usage:
   BASE_URL=http://127.0.0.1:8084 ORG_ID=<org> INVOICE_ID=<id> CONCURRENCY=1000 TOKEN="Bearer <token>" node scripts/callback-storm.js
*/
const got = require('got');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8084';
const ORG_ID = process.env.ORG_ID;
const INVOICE_ID = process.env.INVOICE_ID;
const CONCURRENCY = Number(process.env.CONCURRENCY || 1000);
const TOKEN = process.env.TOKEN;

function h() {
  const headers = {};
  if (TOKEN) headers['Authorization'] = TOKEN;
  return headers;
}

async function main() {
  if (!ORG_ID || !INVOICE_ID) throw new Error('ORG_ID and INVOICE_ID are required');
  console.log(`⚡ Firing ${CONCURRENCY} callbacks → ${BASE_URL}/qpayNekhemjlekhCallback/${ORG_ID}/${INVOICE_ID}`);
  const tasks = Array.from({ length: CONCURRENCY }, async (_, i) => {
    try {
      await got.get(`${BASE_URL}/qpayNekhemjlekhCallback/${ORG_ID}/${INVOICE_ID}`, { headers: h(), timeout: { request: 15000 } });
      if ((i + 1) % 100 === 0) console.log(`Sent: ${i + 1}`);
      return true;
    } catch (e) {
      return false;
    }
  });
  const results = await Promise.allSettled(tasks);
  const ok = results.filter(r => r.status === 'fulfilled').length;
  const ko = results.length - ok;
  console.log(`✅ OK: ${ok}  ❌ Fail: ${ko}`);
}

main().catch((e) => { console.error('STORM ERROR:', e.message); process.exit(1); });



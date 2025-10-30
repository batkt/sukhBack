/*
 Stress test QPay invoice creation in parallel.
 It picks unpaid invoices for an org and triggers /qpayNekhemjlekh/:baiguullagiinId for each.

 Env:
  BASE_URL=http://127.0.0.1:8084
  ORG_ID=<orgId>
  TOKEN="Bearer <token>"
  COUNT=1000           // how many invoices to send
  CONCURRENCY=100      // parallel workers
*/
const got = require('got');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8084';
const ORG_ID = process.env.ORG_ID;
let TOKEN = process.env.TOKEN;
if (TOKEN && !/^Bearer\s+/i.test(TOKEN)) TOKEN = `Bearer ${TOKEN}`;
const COUNT = Number(process.env.COUNT || 1000);
const CONCURRENCY = Number(process.env.CONCURRENCY || 100);

function h() {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = TOKEN;
  return headers;
}

async function fetchUnpaidInvoiceIds() {
  const pageSize = Math.min(COUNT, 500);
  let ids = [];
  let page = 1;
  while (ids.length < COUNT && page <= 100) {
    const res = await got.get(`${BASE_URL}/nekhemjlekhiinTuukh`, {
      searchParams: {
        query: JSON.stringify({ baiguullagiinId: ORG_ID, tuluv: 'Төлөөгүй' }),
        khuudasniiDugaar: page,
        khuudasniiKhemjee: pageSize,
        order: JSON.stringify({ createdAt: -1 })
      },
      headers: h(),
      timeout: { request: 20000 }
    }).json();
    const list = res?.jagsaalt || res?.result || [];
    ids.push(...list.map(x => x._id).filter(Boolean));
    if (list.length < pageSize) break;
    page++;
  }
  return ids.slice(0, COUNT);
}

async function triggerQpay(invoiceId) {
  // Most implementations accept nekhemjlekhiinId in body; adjust if your API differs
  try {
    await got.post(`${BASE_URL}/qpayNekhemjlekh/${ORG_ID}`, {
      json: { nekhemjlekhiinId: invoiceId },
      headers: h(),
      timeout: { request: 20000 }
    });
    return true;
  } catch (e) {
    return false;
  }
}

async function runPool(ids) {
  let i = 0, ok = 0, ko = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= ids.length) break;
      const id = ids[idx];
      const r = await triggerQpay(id);
      if (r) ok++; else ko++;
      if ((ok + ko) % 100 === 0) console.log(`Progress: ${ok + ko}/${ids.length} ok=${ok} ko=${ko}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
  return { ok, ko };
}

async function main() {
  if (!ORG_ID || !TOKEN) throw new Error('ORG_ID and TOKEN are required');
  console.log(`🔎 Fetching up to ${COUNT} unpaid invoices for org ${ORG_ID}...`);
  const ids = await fetchUnpaidInvoiceIds();
  console.log(`Found ${ids.length} invoices`);
  if (ids.length === 0) {
    console.log('No unpaid invoices to process.');
    return;
  }
  console.log(`⚡ Sending QPay create requests with concurrency=${CONCURRENCY}`);
  const { ok, ko } = await runPool(ids);
  console.log(`✅ OK: ${ok}  ❌ Fail: ${ko}`);
}

main().catch(e => { console.error('INVOICE STRESS ERROR:', e.message); process.exit(1); });



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
const BARILGIIN_ID = process.env.BARILGIIN_ID || null;

function h() {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = TOKEN;
  return headers;
}

async function fetchUnpaidInvoiceIds() {
  const pageSize = Math.min(COUNT, 500);
  let invoices = [];
  let page = 1;
  while (invoices.length < COUNT && page <= 100) {
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
    invoices.push(...list.filter(x => x._id).map(x => ({ id: x._id, barilgiinId: x.barilgiinId })));
    if (list.length < pageSize) break;
    page++;
  }
  return invoices.slice(0, COUNT);
}

async function triggerQpay(invoice) {
  try {
    const payload = { baiguullagiinId: ORG_ID, nekhemjlekhiinId: invoice.id };
    
    // Use barilgiinId from invoice, or from env
    if (invoice.barilgiinId) {
      payload.barilgiinId = invoice.barilgiinId;
    } else if (BARILGIIN_ID) {
      payload.barilgiinId = BARILGIIN_ID;
    }
    
    const r = await got.post(`${BASE_URL}/qpayGargaya`, {
      json: payload,
      headers: h(),
      throwHttpErrors: false,
      timeout: { request: 20000 }
    });
    if (r.statusCode >= 200 && r.statusCode < 300) return true;
    console.log('QPay fail:', r.statusCode, r.body?.slice?.(0, 300));
    return false;
  } catch (e) {
    console.log('QPay error:', e.response?.statusCode, e.response?.body?.slice?.(0, 300) || e.message);
    return false;
  }
}

async function runPool(invoices) {
  let i = 0, ok = 0, ko = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= invoices.length) break;
      const invoice = invoices[idx];
      const r = await triggerQpay(invoice);
      if (r) ok++; else ko++;
      if ((ok + ko) % 100 === 0) console.log(`Progress: ${ok + ko}/${invoices.length} ok=${ok} ko=${ko}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, invoices.length) }, worker));
  return { ok, ko };
}

async function getBarilgiinIdFromBaiguullaga() {
  try {
    const res = await got.get(`${BASE_URL}/baiguullaga`, {
      searchParams: { query: JSON.stringify({ _id: ORG_ID }) },
      headers: h(),
      throwHttpErrors: false,
      timeout: { request: 5000 }
    });
    if (res.statusCode === 200) {
      const data = JSON.parse(res.body);
      const org = data?.jagsaalt?.[0] || data?.result?.[0];
      if (org?.barilguud && org.barilguud.length > 0) {
        return String(org.barilguud[0]._id);
      }
    }
  } catch (err) {
    console.error('Error fetching baiguullaga:', err.message);
  }
  return null;
}

async function main() {
  if (!ORG_ID || !TOKEN) throw new Error('ORG_ID and TOKEN are required');
  
  // Get barilgiinId from baiguullaga's barilguud
  let defaultBarilgiinId = BARILGIIN_ID;
  if (!defaultBarilgiinId) {
    console.log('🔍 Fetching barilgiinId from baiguullaga...');
    defaultBarilgiinId = await getBarilgiinIdFromBaiguullaga();
    if (defaultBarilgiinId) {
      console.log(`✅ Found barilgiinId: ${defaultBarilgiinId}`);
    } else {
      console.log('⚠️  Warning: Could not find barilgiinId from baiguullaga');
    }
  }
  
  console.log(`🔎 Fetching up to ${COUNT} unpaid invoices for org ${ORG_ID}...`);
  const invoices = await fetchUnpaidInvoiceIds();
  console.log(`Found ${invoices.length} invoices`);
  if (invoices.length === 0) {
    console.log('No unpaid invoices to process.');
    return;
  }
  
  // Set default barilgiinId for invoices that don't have it
  invoices.forEach(inv => {
    if (!inv.barilgiinId && defaultBarilgiinId) {
      inv.barilgiinId = defaultBarilgiinId;
    }
  });
  
  console.log(`⚡ Sending QPay create requests with concurrency=${CONCURRENCY}`);
  const { ok, ko } = await runPool(invoices);
  console.log(`✅ OK: ${ok}  ❌ Fail: ${ko}`);
}

main().catch(e => { console.error('INVOICE STRESS ERROR:', e.message); process.exit(1); });



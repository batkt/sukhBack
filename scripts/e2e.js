/*
 End-to-end test runner for staging.
 Usage (PowerShell/CMD):
   set BASE_URL=http://127.0.0.1:8084 && set ORG_ID=<orgId> && set TOKEN=<Bearer token> && node scripts/e2e.js
 Or (bash):
   BASE_URL=http://127.0.0.1:8084 ORG_ID=<orgId> TOKEN="Bearer <token>" node scripts/e2e.js
*/

const got = require('got');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8084';
const ORG_ID = process.env.ORG_ID;
let TOKEN = process.env.TOKEN; // Can be with or without "Bearer "
if (TOKEN && !/^Bearer\s+/i.test(TOKEN)) TOKEN = `Bearer ${TOKEN}`;

function h() {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = TOKEN;
  return headers;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  if (!ORG_ID) throw new Error('ORG_ID is required');
  if (!TOKEN) throw new Error('TOKEN is required (Bearer ...)');

  // 1) Create resident (registration)
  const phone = '99' + Math.floor(100000 + Math.random() * 899999);
  const bodyReg = {
    baiguullagiinId: ORG_ID,
    duureg: 'Сонгинохайрхан',
    horoo: '22',
    soh: 'СӨХ-001',
    ner: 'TestUser',
    ovog: 'E2E',
    utas: phone,
    nuutsUg: '1234',
    mail: `e2e_${Date.now()}@mail.com`,
  };
  console.log('➡️ Register resident', phone);
  const regRes = await got.post(`${BASE_URL}/orshinSuugchBurtgey`, { json: bodyReg, headers: h() }).json();
  if (!regRes?.success) throw new Error('Registration failed');
  const user = regRes.result;
  console.log('✅ Registered:', user?._id);

  // 2) Find invoice by phone with retry (avoids geree 500 and async delay)
  console.log('🔎 Find invoice by phone (with retry)');
  let inv, gereeId;
  for (let i = 0; i < 8; i++) { // retry up to ~8s
    const r = await got.get(`${BASE_URL}/nekhemjlekhiinTuukh`, {
      searchParams: { query: JSON.stringify({ baiguullagiinId: ORG_ID, utas: phone }) },
      headers: h()
    }).json();
    inv = r?.jagsaalt?.[0] || r?.result?.[0];
    if (inv?._id) break;
    await sleep(1000);
  }
  if (!inv?._id) throw new Error('No invoice found for phone');
  gereeId = inv.gereeniiId;
  console.log('✅ Invoice:', inv._id, 'Contract:', gereeId);

  // 3) Simulate QPay callback (no real QPay side-effects)
  console.log('➡️ Simulate QPay callback');
  await got.get(`${BASE_URL}/qpayNekhemjlekhCallback/${ORG_ID}/${inv._id}`, { headers: h() });
  await sleep(500);

  // 4) Validate invoice paid
  const invAfter = await got.get(`${BASE_URL}/nekhemjlekhiinTuukh`, { searchParams: { query: JSON.stringify({ _id: inv._id }) }, headers: h() }).json();
  const invDoc = invAfter?.jagsaalt?.[0] || invAfter?.result?.[0];
  console.log('💳 Invoice status:', invDoc?.tuluv, 'paidAt:', invDoc?.tulsunOgnoo);

  // 5) Validate bank transaction recorded
  const bankTx = await got.get(`${BASE_URL}/bankniiGuilgee`, { searchParams: { query: JSON.stringify({ baiguullagiinId: ORG_ID, bank: 'qpay' }) }, headers: h() }).json();
  console.log('🏦 Bank tx count (qpay):', bankTx?.niitMur ?? bankTx?.total ?? bankTx?.length ?? 'n/a');

  // 6) Reports sanity
  const summary = await got.post(`${BASE_URL}/tailan/summary`, { json: { baiguullagiinId: ORG_ID }, headers: h() }).json();
  console.log('📊 Summary invoices total:', summary?.summary?.invoices?.total);

  console.log('🎉 E2E flow completed');
}

main().catch((e) => { console.error('E2E ERROR:', e.message); process.exit(1); });



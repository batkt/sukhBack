/*
 Seed N residents and send QPay invoices to them in parallel.

 Env:
  BASE_URL=http://127.0.0.1:8084
  ORG_ID=<orgId>
  TOKEN="Bearer <token>"  // can also be raw token; script prepends Bearer
  COUNT=1000
  CONCURRENCY=200
  BARILGIIN_ID=<optional-building-id>
*/
const got = require('got');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8084';
const ORG_ID = process.env.ORG_ID;
let TOKEN = process.env.TOKEN;
if (TOKEN && !/^Bearer\s+/i.test(TOKEN)) TOKEN = `Bearer ${TOKEN}`;
const COUNT = Number(process.env.COUNT || 1000);
const CONCURRENCY = Number(process.env.CONCURRENCY || 200);
const BARILGIIN_ID = process.env.BARILGIIN_ID || null;

function h() {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = TOKEN;
  return headers;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function genPhone() {
  return '99' + Math.floor(100000 + Math.random() * 899999);
}

async function registerResident(phone) {
  const body = {
    baiguullagiinId: ORG_ID,
    duureg: 'Сонгинохайрхан',
    horoo: '22',
    soh: 'СӨХ-001',
    ner: 'LoadUser',
    ovog: 'Seed',
    utas: phone,
    nuutsUg: '1234',
    mail: `seed_${phone}@test.local`,
  };
  if (BARILGIIN_ID) body.barilgiinId = BARILGIIN_ID;
  const res = await got.post(`${BASE_URL}/orshinSuugchBurtgey`, { json: body, headers: h(), throwHttpErrors: false });
  if (res.statusCode >= 200 && res.statusCode < 300) return true;
  // if already exists, treat as ok for test purposes
  if (res.statusCode === 409) return true;
  console.log('Register fail:', res.statusCode, res.body?.slice?.(0, 200));
  return false;
}

async function getInvoiceByPhone(phone, retries = 8) {
  for (let i = 0; i < retries; i++) {
    const r = await got.get(`${BASE_URL}/nekhemjlekhiinTuukh`, {
      searchParams: { query: JSON.stringify({ baiguullagiinId: ORG_ID, utas: phone }) },
      headers: h(), throwHttpErrors: false
    });
    if (r.statusCode === 200) {
      const data = JSON.parse(r.body);
      const inv = data?.jagsaalt?.[0] || data?.result?.[0];
      if (inv?._id) return { id: inv._id, barilgiinId: inv.barilgiinId };
    }
    await sleep(1000);
  }
  return null;
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
  if (!ORG_ID) throw new Error('ORG_ID is required');
  if (!TOKEN) throw new Error('TOKEN is required');
  
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
  
  console.log(`🚀 Seeding ${COUNT} users with concurrency=${CONCURRENCY}`);

  const phones = Array.from({ length: COUNT }, () => genPhone());
  let i = 0, regOk = 0, regKo = 0;
  async function regWorker() {
    while (true) {
      const idx = i++;
      if (idx >= phones.length) break;
      const ok = await registerResident(phones[idx]);
      if (ok) regOk++; else regKo++;
      if ((regOk + regKo) % 100 === 0) console.log(`Reg: ${regOk + regKo}/${COUNT} ok=${regOk} ko=${regKo}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, COUNT) }, regWorker));
  console.log(`✅ Registered ok=${regOk} ko=${regKo}`);

  console.log('🔎 Resolving invoices for seeded users...');
  const invoices = [];
  for (const phone of phones) {
    const invoice = await getInvoiceByPhone(phone, 8);
    if (invoice) invoices.push(invoice);
  }
  console.log(`Found invoices: ${invoices.length}/${COUNT}`);
  
  // Set default barilgiinId for invoices that don't have it
  invoices.forEach(inv => {
    if (!inv.barilgiinId && defaultBarilgiinId) {
      inv.barilgiinId = defaultBarilgiinId;
    }
  });

  console.log(`⚡ Sending QPay create for ${invoices.length} invoices with concurrency=${CONCURRENCY}`);
  let j = 0, ok = 0, ko = 0;
  async function invWorker() {
    while (true) {
      const idx = j++;
      if (idx >= invoices.length) break;
      const invoice = invoices[idx];
      const r = await triggerQpay(invoice);
      if (r) ok++; else ko++;
      if ((ok + ko) % 100 === 0) console.log(`QPay: ${ok + ko}/${invoices.length} ok=${ok} ko=${ko}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, invoices.length) }, invWorker));
  console.log(`✅ QPay create ok=${ok} ko=${ko}`);
}

main().catch(e => { console.error('SEED+INVOICE ERROR:', e.message); process.exit(1); });



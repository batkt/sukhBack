/*
 Test script to simulate QPay payment callbacks.
 It finds unpaid invoices with QPay invoice IDs and triggers payment callbacks.

 Env:
  BASE_URL=http://127.0.0.1:8084
  ORG_ID=<orgId>
  TOKEN="Bearer <token>"
  COUNT=100        // how many invoices to pay
  CONCURRENCY=20   // parallel workers
*/
const got = require('got');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8084';
const ORG_ID = process.env.ORG_ID;
let TOKEN = process.env.TOKEN;
if (TOKEN && !/^Bearer\s+/i.test(TOKEN)) TOKEN = `Bearer ${TOKEN}`;
const COUNT = Number(process.env.COUNT || 100);
const CONCURRENCY = Number(process.env.CONCURRENCY || 20);

function h() {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = TOKEN;
  return headers;
}

async function fetchUnpaidQPayInvoices() {
  const pageSize = Math.min(COUNT, 500);
  let invoices = [];
  let page = 1;
  
  while (invoices.length < COUNT && page <= 100) {
    const res = await got.get(`${BASE_URL}/nekhemjlekhiinTuukh`, {
      searchParams: {
        query: JSON.stringify({ 
          baiguullagiinId: ORG_ID, 
          tuluv: 'Төлөөгүй',
          qpayInvoiceId: { $exists: true, $ne: null }
        }),
        khuudasniiDugaar: page,
        khuudasniiKhemjee: pageSize,
        order: JSON.stringify({ createdAt: -1 })
      },
      headers: h(),
      timeout: { request: 20000 }
    }).json();
    
    const list = res?.jagsaalt || res?.result || [];
    invoices.push(...list
      .filter(x => x._id && x.qpayInvoiceId)
      .map(x => ({ 
        id: x._id, 
        qpayInvoiceId: x.qpayInvoiceId,
        niitTulbur: x.niitTulbur || 0,
        baiguullagiinId: x.baiguullagiinId
      }))
    );
    
    if (list.length < pageSize) break;
    page++;
  }
  
  return invoices.slice(0, COUNT);
}

async function simulateQPayPayment(invoice) {
  try {
    // Call the QPay callback route (GET request)
    // The route will check QPay API to verify payment status
    const callbackUrl = `${BASE_URL}/qpayNekhemjlekhCallback/${invoice.baiguullagiinId}/${invoice.id}`;
    
    const r = await got.get(callbackUrl, {
      headers: h(),
      throwHttpErrors: false,
      timeout: { request: 15000 }
    });
    
    if (r.statusCode >= 200 && r.statusCode < 300) {
      return { success: true, invoiceId: invoice.id };
    }
    
    // If callback fails, try checking if invoice is already paid
    const checkRes = await got.get(`${BASE_URL}/nekhemjlekhiinTuukh`, {
      searchParams: { query: JSON.stringify({ _id: invoice.id }) },
      headers: h(),
      throwHttpErrors: false,
      timeout: { request: 5000 }
    });
    
    if (checkRes.statusCode === 200) {
      const data = JSON.parse(checkRes.body);
      const inv = data?.jagsaalt?.[0] || data?.result?.[0];
      if (inv?.tuluv === 'Төлсөн') {
        return { success: true, invoiceId: invoice.id, alreadyPaid: true };
      }
    }
    
    return { 
      success: false, 
      invoiceId: invoice.id, 
      status: r.statusCode, 
      body: r.body?.slice?.(0, 200) 
    };
  } catch (e) {
    return { 
      success: false, 
      invoiceId: invoice.id, 
      error: e.message 
    };
  }
}

async function runPaymentPool(invoices) {
  let i = 0, ok = 0, ko = 0, alreadyPaid = 0;
  
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= invoices.length) break;
      
      const invoice = invoices[idx];
      const result = await simulateQPayPayment(invoice);
      
      if (result.success) {
        if (result.alreadyPaid) {
          alreadyPaid++;
        } else {
          ok++;
        }
      } else {
        ko++;
        if (!result.alreadyPaid) {
          console.log(`Payment fail for invoice ${invoice.id}:`, result.status || result.error);
        }
      }
      
      const total = ok + ko + alreadyPaid;
      if (total % 50 === 0) {
        console.log(`Progress: ${total}/${invoices.length} paid=${ok} failed=${ko} alreadyPaid=${alreadyPaid}`);
      }
    }
  }
  
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, invoices.length) }, worker));
  return { ok, ko, alreadyPaid };
}

async function main() {
  if (!ORG_ID || !TOKEN) throw new Error('ORG_ID and TOKEN are required');
  
  console.log(`🔎 Fetching up to ${COUNT} unpaid invoices with QPay invoice IDs for org ${ORG_ID}...`);
  const invoices = await fetchUnpaidQPayInvoices();
  console.log(`Found ${invoices.length} invoices with QPay invoice IDs`);
  
  if (invoices.length === 0) {
    console.log('No unpaid invoices with QPay invoice IDs to process.');
    console.log('💡 Tip: Run invoice creation scripts first to generate QPay invoices.');
    return;
  }
  
  console.log(`💳 Simulating QPay payments with concurrency=${CONCURRENCY}`);
  console.log(`📊 Sample invoice: ID=${invoices[0].id}, QPayID=${invoices[0].qpayInvoiceId}, Amount=${invoices[0].niitTulbur}`);
  
  const startTime = Date.now();
  const { ok, ko, alreadyPaid } = await runPaymentPool(invoices);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log(`\n✅ Payment Test Results:`);
  console.log(`   Successfully paid: ${ok}`);
  console.log(`   Already paid: ${alreadyPaid}`);
  console.log(`   Failed: ${ko}`);
  console.log(`   Total processed: ${ok + ko + alreadyPaid}/${invoices.length}`);
  console.log(`   Duration: ${duration}s`);
  console.log(`   Rate: ${((ok + ko + alreadyPaid) / duration).toFixed(2)} payments/sec`);
}

main().catch(e => { 
  console.error('QPAY PAYMENT TEST ERROR:', e.message); 
  process.exit(1); 
});


const http = require('http');

async function testDurability(url, name) {
    console.log(`🚀 Starting Concurrency Test for ${name} at ${url}...`);
    const totalRequests = 1000; // Lowered to 1000 for a fast test
    const concurrentRequests = 10;
    let successCount = 0;
    let failCount = 0;

    const start = Date.now();

    for (let i = 0; i < totalRequests; i += concurrentRequests) {
        const batch = [];
        for (let j = 0; j < concurrentRequests; j++) {
            batch.push(
                new Promise((resolve) => {
                    const req = http.get(url, (res) => {
                        if (res.statusCode === 200) successCount++;
                        else failCount++;
                        res.on('data', () => {});
                        res.on('end', resolve);
                    });
                    req.on('error', () => { failCount++; resolve(); });
                    req.setTimeout(5000, () => { req.destroy(); failCount++; resolve(); });
                })
            );
        }
        await Promise.all(batch);
        
        // --- ADDED PROGRESS LOGS ---
        if (i % 100 === 0 && i > 0) {
            console.log(`📡 Progress: ${i}/${totalRequests} requests sent...`);
        }
    }

    const duration = Date.now() - start;
    console.log(`\n📊 FINAL RESULTS for ${name}:`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Fail:    ${failCount}`);
    console.log(`⏱️  Time:    ${duration}ms (${(totalRequests / (duration/1000)).toFixed(2)} req/sec)`);
}

const BACKEND_URL = 'http://localhost:8084/baiguullagaBairshilaarAvya';
testDurability(BACKEND_URL, 'AmarSukh Cluster');

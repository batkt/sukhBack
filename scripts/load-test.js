const http = require('http');

async function testDurability(url, name) {
    console.log(`🚀 Starting Concurrency Test for ${name} at ${url}...`);
    const totalRequests = 100000;
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
                        if (res.statusCode === 200) {
                            successCount++;
                        } else {
                            failCount++;
                        }
                        // Consume data to free memory
                        res.on('data', () => {});
                        res.on('end', resolve);
                    });
                    req.on('error', (err) => {
                        console.error(`Request ${i+j} error: ${err.message}`);
                        failCount++;
                        resolve();
                    });
                    req.setTimeout(5000, () => {
                        req.destroy();
                        failCount++;
                        resolve();
                    });
                })
            );
        }
        await Promise.all(batch);
    }

    const duration = Date.now() - start;
    console.log(`\n📊 RESULTS for ${name}:`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Fail: ${failCount}`);
    console.log(`⏱️ Duration: ${duration}ms (${(totalRequests / (duration/1000)).toFixed(2)} req/sec)`);
    console.log('-----------------------------------');
}

// Set this to your server's address
const BACKEND_URL = 'http://localhost:8084/baiguullagaBairshilaarAvya';

(async () => {
    try {
        await testDurability(BACKEND_URL, 'AmarSukh Cluster');
    } catch (err) {
        console.error('Test Failed:', err.message);
    }
})();

const http = require('http');

async function heavyTest() {
    const url = 'http://localhost:8084/baiguullagaBairshilaarAvya';
    const TOTAL = 10000;
    const CONCURRENT = 100; // 100 simultaneous requests
    
    console.log(`🔥 STARTING TURBO LOAD TEST 🔥`);
    console.log(`Target: ${url}`);
    console.log(`Pressure: ${CONCURRENT} simultaneous connections`);
    
    let success = 0;
    let fail = 0;
    const start = Date.now();

    for (let i = 0; i < TOTAL; i += CONCURRENT) {
        const batch = Array.from({ length: CONCURRENT }).map(() => {
            return new Promise((resolve) => {
                const req = http.get(url, (res) => {
                    if (res.statusCode === 200) success++;
                    else fail++;
                    res.on('data', () => {}); // consume
                    res.on('end', resolve);
                });
                req.on('error', () => { fail++; resolve(); });
                req.setTimeout(10000, () => { req.destroy(); fail++; resolve(); });
            });
        });

        await Promise.all(batch);
        
        if (i % 500 === 0) {
            const speed = (i / ((Date.now() - start) / 1000)).toFixed(2);
            console.log(`🚀 ${i}/${TOTAL} requests fired... (${speed} req/sec)`);
        }
    }

    const totalTime = (Date.now() - start) / 1000;
    console.log(`\n💎 HEAVY LOAD COMPLETE 💎`);
    console.log(`✅ Success: ${success}`);
    console.log(`❌ Fail:    ${fail}`);
    console.log(`⏱️  Total Time: ${totalTime.toFixed(2)}s`);
    console.log(`🏎️  Final Speed: ${(TOTAL / totalTime).toFixed(2)} req/sec`);
}

heavyTest();

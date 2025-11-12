/**
 * Test file for aldangiBodyo function
 * Problem: Should calculate aldangi in October but it's not doing that
 */

const moment = require("moment");

// Mock helper function
function tooZasyaSync(too) {
  var zassanToo = Math.round((too + Number.EPSILON) * 100) / 100;
  return +zassanToo.toFixed(2);
}

// Simulate the core logic from aldangiBodyo
function testAldangiCalculation() {
  console.log("=".repeat(80));
  console.log("TESTING ALDANGI CALCULATION LOGIC");
  console.log("=".repeat(80));
  console.log();

  // Test scenario: We're in November 2025, and we want to calculate penalties for October
  // Current date simulation
  const currentDate = moment("2025-11-15"); // November 15, 2025
  console.log(`Current Date: ${currentDate.format("YYYY-MM-DD")}`);
  console.log();

  // Test data: A contract with payment due in September
  const tulukhUdur = ["05"]; // Payment due on 5th of each month
  const tulukhOgnoo = moment("2025-09-05"); // Payment was due on September 5, 2025
  const uldegdel = 40000000; // Outstanding balance
  const aldagiinKhuvi = 0.5; // 0.5% penalty rate
  const aldangiChuluulukhKhonog = 25; // 25 days grace period
  const aldangiBodojEkhlekhOgnoo = moment("2025-08-15"); // Penalty calculation start date

  console.log("Test Contract Data:");
  console.log(`  Payment Due Date (tulukhOgnoo): ${tulukhOgnoo.format("YYYY-MM-DD")}`);
  console.log(`  Payment Due Day (tulukhUdur): ${tulukhUdur[0]}`);
  console.log(`  Outstanding Balance (uldegdel): ${uldegdel.toLocaleString()}`);
  console.log(`  Penalty Rate (aldagiinKhuvi): ${aldagiinKhuvi}%`);
  console.log(`  Grace Period Days (aldangiChuluulukhKhonog): ${aldangiChuluulukhKhonog}`);
  console.log(`  Penalty Start Date (aldangiBodojEkhlekhOgnoo): ${aldangiBodojEkhlekhOgnoo.format("YYYY-MM-DD")}`);
  console.log();

  // Test the month offset logic
  console.log("=".repeat(80));
  console.log("TESTING MONTH OFFSET LOGIC");
  console.log("=".repeat(80));
  console.log();

  for (let offset = -1; offset <= 0; offset++) {
    console.log(`\n--- Processing offset: ${offset} ---`);
    const targetMonth = moment(currentDate).add(offset, "month");
    console.log(`Target Month: ${targetMonth.format("YYYY-MM")}`);
    
    const start = targetMonth.clone().startOf("month").toDate();
    const end = targetMonth.clone().endOf("month").toDate();
    
    console.log(`  Date Range: ${moment(start).format("YYYY-MM-DD")} to ${moment(end).format("YYYY-MM-DD")}`);
    
    // Check if this is October
    if (targetMonth.month() === 9) { // October (0-indexed, so 9 = October)
      console.log(`  ✓ This is October!`);
    } else {
      console.log(`  ✗ This is NOT October (month index: ${targetMonth.month()})`);
    }
  }

  console.log();
  console.log("=".repeat(80));
  console.log("TESTING PENALTY CALCULATION FOR OCTOBER");
  console.log("=".repeat(80));
  console.log();

  // Simulate October processing (offset = -1 when current month is November)
  const octoberOffset = -1;
  const targetMonth = moment(currentDate).add(octoberOffset, "month");
  console.log(`Target Month: ${targetMonth.format("YYYY-MM")} (October)`);
  console.log();

  // Reconstruct tulukhOgnoo from targetMonth and tulukhUdur
  const reconstructedTulukhOgnoo = moment(
    targetMonth.format("YYYY-MM") + "-" + tulukhUdur[0]
  );
  console.log(`Reconstructed Payment Due Date: ${reconstructedTulukhOgnoo.format("YYYY-MM-DD")}`);
  console.log();

  // Calculate penalty start date
  const tulukhSar = reconstructedTulukhOgnoo.month();
  const tulukhJil = reconstructedTulukhOgnoo.year();
  
  console.log(`Payment Due Month: ${tulukhSar + 1} (${moment.months(tulukhSar)})`);
  console.log(`Payment Due Year: ${tulukhJil}`);
  console.log();

  // Дараагийн сарын 1-нээс алданги эхэлнэ (Penalty starts from 1st of next month)
  const aldangiEhlehOgnoo = moment()
    .year(tulukhJil)
    .month(tulukhSar + 1)
    .startOf("month");
  
  console.log(`Penalty Start Date (aldangiEhlehOgnoo): ${aldangiEhlehOgnoo.format("YYYY-MM-DD")}`);
  console.log(`  (This is the 1st of the month AFTER the payment due date)`);
  console.log();

  // Алданги чөлөөлөх хугацаа (Grace period)
  const aldangiChuluulukhOgnoo = moment(aldangiEhlehOgnoo).add(
    aldangiChuluulukhKhonog,
    "days"
  );
  
  console.log(`Grace Period End Date (aldangiChuluulukhOgnoo): ${aldangiChuluulukhOgnoo.format("YYYY-MM-DD")}`);
  console.log(`  (Penalty starts after this date)`);
  console.log();

  // Check if penalty should be calculated
  const shouldCalculatePenalty = moment(currentDate).isAfter(aldangiChuluulukhOgnoo);
  console.log(`Current Date: ${currentDate.format("YYYY-MM-DD")}`);
  console.log(`Grace Period End: ${aldangiChuluulukhOgnoo.format("YYYY-MM-DD")}`);
  console.log(`Should Calculate Penalty: ${shouldCalculatePenalty ? "YES ✓" : "NO ✗"}`);
  console.log();

  if (shouldCalculatePenalty) {
    const bodogdsonKhuu = tooZasyaSync(
      (uldegdel * aldagiinKhuvi) / 100
    );
    console.log(`Calculated Penalty: ${bodogdsonKhuu.toLocaleString()}`);
    console.log(`  Formula: (${uldegdel.toLocaleString()} * ${aldagiinKhuvi}) / 100`);
  } else {
    console.log("Penalty NOT calculated because current date is before grace period end");
  }

  console.log();
  console.log("=".repeat(80));
  console.log("IDENTIFYING THE PROBLEM");
  console.log("=".repeat(80));
  console.log();

  // The issue: The code reconstructs tulukhOgnoo from targetMonth
  // But targetMonth is October, so it creates "2025-10-05"
  // But the actual payment due date might be from September!
  
  console.log("POTENTIAL ISSUE #1: Date Reconstruction");
  console.log("  The code reconstructs tulukhOgnoo from targetMonth:");
  console.log(`    targetMonth: ${targetMonth.format("YYYY-MM")}`);
  console.log(`    tulukhUdur[0]: ${tulukhUdur[0]}`);
  console.log(`    Reconstructed: ${reconstructedTulukhOgnoo.format("YYYY-MM-DD")}`);
  console.log(`  But the actual payment might be due in September (2025-09-05)`);
  console.log(`  This means penalties for September payments won't be calculated in October!`);
  console.log();

  console.log("POTENTIAL ISSUE #2: Month Offset Range");
  console.log("  The code only processes offsets -1 and 0:");
  console.log("    offset -1: Previous month (October when current is November)");
  console.log("    offset 0: Current month (November)");
  console.log("  This means it only looks at transactions in October and November.");
  console.log("  But penalties for September payments should be calculated in October!");
  console.log("  The transaction might be dated in September, but penalty calculation should happen in October.");
  console.log();

  console.log("POTENTIAL ISSUE #3: Transaction Date Matching");
  console.log("  The code matches transactions where:");
  const octStart = targetMonth.clone().startOf("month").toDate();
  const octEnd = targetMonth.clone().endOf("month").toDate();
  console.log(`    "avlaga.guilgeenuud.ognoo": { $gte: ${moment(octStart).format("YYYY-MM-DD")}, $lte: ${moment(octEnd).format("YYYY-MM-DD")} }`);
  console.log("  This means it only finds transactions DATED in October.");
  console.log("  But to calculate October penalties, we need to find:");
  console.log("    - Transactions from September (or earlier) that are still unpaid");
  console.log("    - Where the payment due date + grace period has passed");
  console.log();

  console.log("=".repeat(80));
  console.log("RECOMMENDED FIX");
  console.log("=".repeat(80));
  console.log();

  console.log("The logic should be:");
  console.log("1. For each month (October in this case), find ALL unpaid transactions");
  console.log("2. For each transaction, check if the payment due date + grace period has passed");
  console.log("3. Calculate penalty based on the outstanding balance");
  console.log();
  console.log("The current code only looks at transactions DATED in the target month,");
  console.log("but it should look at transactions that are DUE in or before the target month.");
  console.log();

  // Test with a September transaction
  console.log("=".repeat(80));
  console.log("TESTING WITH SEPTEMBER TRANSACTION");
  console.log("=".repeat(80));
  console.log();

  const septemberTransactionDate = moment("2025-09-05");
  const octoberStart = moment("2025-10-01").startOf("month").toDate();
  const octoberEnd = moment("2025-10-31").endOf("month").toDate();

  console.log(`Transaction Date: ${septemberTransactionDate.format("YYYY-MM-DD")}`);
  console.log(`October Range: ${moment(octoberStart).format("YYYY-MM-DD")} to ${moment(octoberEnd).format("YYYY-MM-DD")}`);
  
  const isInOctoberRange = 
    septemberTransactionDate.toDate() >= octoberStart && 
    septemberTransactionDate.toDate() <= octoberEnd;
  
  console.log(`Is September transaction in October range? ${isInOctoberRange ? "YES" : "NO ✗"}`);
  console.log();
  console.log("This is the problem! September transactions won't be found when processing October.");
  console.log();

  // Calculate when penalty should start for September payment
  const septTulukhOgnoo = moment("2025-09-05");
  const septTulukhSar = septTulukhOgnoo.month();
  const septTulukhJil = septTulukhOgnoo.year();
  const septAldangiEhlehOgnoo = moment()
    .year(septTulukhJil)
    .month(septTulukhSar + 1)
    .startOf("month"); // October 1st
  const septAldangiChuluulukhOgnoo = moment(septAldangiEhlehOgnoo).add(
    aldangiChuluulukhKhonog,
    "days"
  ); // October 26th (25 days after Oct 1)

  console.log("For September payment (due 2025-09-05):");
  console.log(`  Penalty starts: ${septAldangiEhlehOgnoo.format("YYYY-MM-DD")} (October 1st)`);
  console.log(`  Grace period ends: ${septAldangiChuluulukhOgnoo.format("YYYY-MM-DD")} (October 26th)`);
  console.log(`  Should calculate penalty on ${currentDate.format("YYYY-MM-DD")}? ${moment(currentDate).isAfter(septAldangiChuluulukhOgnoo) ? "YES ✓" : "NO ✗"}`);
  console.log();
  console.log("So penalties for September payments SHOULD be calculated in October,");
  console.log("but the current code won't find September transactions when processing October!");
  console.log();

  console.log("=".repeat(80));
  console.log("ROOT CAUSE ANALYSIS");
  console.log("=".repeat(80));
  console.log();

  console.log("The core problem is in the aggregation query:");
  console.log();
  console.log("Current logic:");
  console.log("  1. For October (offset -1), it looks for transactions DATED in October");
  console.log("  2. It then reconstructs the payment due date using October + tulukhUdur");
  console.log("  3. This creates a payment due date of October 5th");
  console.log("  4. Penalty would start November 1st (next month after October 5th)");
  console.log("  5. But we're in November 15th, so grace period hasn't passed yet");
  console.log();
  console.log("What SHOULD happen:");
  console.log("  1. For October, find ALL unpaid transactions (regardless of transaction date)");
  console.log("  2. For each transaction, use the ACTUAL payment due date (from the transaction)");
  console.log("  3. Check if: payment due date + grace period < current date");
  console.log("  4. If yes, calculate penalty");
  console.log();
  console.log("Example:");
  console.log("  - Transaction dated: September 5, 2025");
  console.log("  - Payment due date: September 5, 2025");
  console.log("  - Penalty starts: October 1, 2025 (next month after due date)");
  console.log("  - Grace period ends: October 26, 2025 (25 days after Oct 1)");
  console.log("  - Current date: November 15, 2025");
  console.log("  - Should calculate penalty: YES (Nov 15 > Oct 26)");
  console.log();
  console.log("=".repeat(80));
  console.log("SUGGESTED FIX");
  console.log("=".repeat(80));
  console.log();
  console.log("Instead of filtering by transaction date in the target month,");
  console.log("the query should:");
  console.log("  1. Find all contracts with outstanding balances");
  console.log("  2. For each contract, find all unpaid transactions");
  console.log("  3. For each transaction, calculate when penalty should start:");
  console.log("     - Get the actual payment due date from the transaction");
  console.log("     - Calculate: penalty start = next month after due date");
  console.log("     - Calculate: grace period end = penalty start + grace days");
  console.log("  4. If current date > grace period end, calculate penalty");
  console.log();
  console.log("The key change: Don't filter by transaction date in target month.");
  console.log("Instead, filter by whether the penalty calculation date falls in the target month,");
  console.log("or check if the grace period has passed by the target month.");
  console.log();
}

// Run the test
testAldangiCalculation();


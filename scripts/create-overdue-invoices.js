/*
  Create test invoices with different overdue dates for testing "Төлөгдөөгүй удсан авлага 2+ сар" report.
  
  This script creates invoices with tulukhOgnoo (due date) set to different months in the past:
  - 2 months ago
  - 3 months ago
  - 4 months ago
  - 6 months ago
  - etc.
  
  Usage:
    node scripts/create-overdue-invoices.js
    
  Environment variables:
    BAIGULLAGIIN_ID=<organizationId> (required)
    BARILGIIN_ID=<buildingId> (optional)
    USER_IDS=<userId1,userId2,userId3> (optional - comma-separated user IDs to create invoices for)
    COUNT=10 (number of invoices per month, default: 5)
    MONTHS=[2,3,4,6] (comma-separated list of months ago, default: 2,3,4,6)
*/

// Change to project root directory
const path = require("path");
const projectRoot = path.resolve(__dirname, "..");
process.chdir(projectRoot);

const { db } = require("zevbackv2");
const nekhemjlekhiinTuukh = require(path.join(
  projectRoot,
  "models",
  "nekhemjlekhiinTuukh"
));
const Geree = require(path.join(projectRoot, "models", "geree"));
const OrshinSuugch = require(path.join(projectRoot, "models", "orshinSuugch"));

const BAIGULLAGIIN_ID = process.env.BAIGULLAGIIN_ID;
const BARILGIIN_ID = process.env.BARILGIIN_ID || null;
const USER_IDS = process.env.USER_IDS
  ? process.env.USER_IDS.split(",")
      .map((id) => id.trim())
      .filter((id) => id)
  : null;
const COUNT_PER_MONTH = Number(process.env.COUNT || 5);
const MONTHS_AGO = process.env.MONTHS
  ? process.env.MONTHS.split(",").map((m) => parseInt(m.trim()))
  : [2, 3, 4, 6];

if (!BAIGULLAGIIN_ID) {
  console.error("❌ BAIGULLAGIIN_ID is required");
  process.exit(1);
}

async function createOverdueInvoices() {
  try {
    console.log("🚀 Starting overdue invoice creation...");
    console.log(`📋 Config:`, {
      baiguullagiinId: BAIGULLAGIIN_ID,
      barilgiinId: BARILGIIN_ID || "all buildings",
      userIds: USER_IDS || "all users",
      countPerMonth: COUNT_PER_MONTH,
      monthsAgo: MONTHS_AGO,
    });

    // Find tenant connection
    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(BAIGULLAGIIN_ID)
    );

    if (!kholbolt) {
      throw new Error("Холболтын мэдээлэл олдсонгүй");
    }

    const NekhemjlekhiinTuukhModel = nekhemjlekhiinTuukh(kholbolt);
    const GereeModel = Geree(kholbolt);

    // Find active gerees (contracts)
    const gereeMatch = {
      baiguullagiinId: String(BAIGULLAGIIN_ID),
      tuluv: "Идэвхитэй", // Only active contracts
    };

    if (BARILGIIN_ID) {
      gereeMatch.barilgiinId = String(BARILGIIN_ID);
    }

    // If USER_IDS specified, filter gerees by those users
    if (USER_IDS && USER_IDS.length > 0) {
      gereeMatch.orshinSuugchId = { $in: USER_IDS };
      console.log(`🔍 Filtering by user IDs: ${USER_IDS.join(", ")}`);
    }

    const activeGerees = await GereeModel.find(gereeMatch)
      .limit(COUNT_PER_MONTH * MONTHS_AGO.length * 2) // Get enough gerees
      .lean();

    if (activeGerees.length === 0) {
      throw new Error("Идэвхитэй гэрээ олдсонгүй");
    }

    console.log(`✅ Found ${activeGerees.length} active contracts`);

    const today = new Date();
    let totalCreated = 0;
    let gereeIndex = 0;

    // Create invoices for each month
    for (const monthsAgo of MONTHS_AGO) {
      console.log(`\n📅 Creating invoices for ${monthsAgo} months ago...`);

      // Calculate the due date (tulukhOgnoo) - X months ago
      const dueDate = new Date(today);
      dueDate.setMonth(dueDate.getMonth() - monthsAgo);
      dueDate.setDate(15); // Set to 15th of that month
      dueDate.setHours(0, 0, 0, 0);

      // Calculate invoice date (ognoo) - a few days before due date
      const invoiceDate = new Date(dueDate);
      invoiceDate.setDate(invoiceDate.getDate() - 5);

      let createdThisMonth = 0;

      for (
        let i = 0;
        i < COUNT_PER_MONTH && gereeIndex < activeGerees.length;
        i++
      ) {
        const geree = activeGerees[gereeIndex];
        gereeIndex++;

        // Check if invoice already exists for this geree with this due date
        const existingInvoice = await NekhemjlekhiinTuukhModel.findOne({
          gereeniiId: geree._id.toString(),
          tulukhOgnoo: dueDate,
        });

        if (existingInvoice) {
          console.log(
            `  ⚠️  Invoice already exists for contract ${
              geree.gereeniiDugaar
            } with due date ${dueDate.toISOString().split("T")[0]}, skipping...`
          );
          continue;
        }

        // Create new invoice with past due date
        const invoice = new NekhemjlekhiinTuukhModel({
          gereeniiId: geree._id.toString(),
          gereeniiDugaar: geree.gereeniiDugaar || "",
          baiguullagiinId: geree.baiguullagiinId || BAIGULLAGIIN_ID,
          baiguullagiinNer: geree.baiguullagiinNer || "",
          barilgiinId: geree.barilgiinId || BARILGIIN_ID || "",
          ovog: geree.ovog || "",
          ner: geree.ner || "",
          utas: geree.utas || [],
          khayag: geree.khayag || "",
          gereeniiOgnoo: geree.gereeniiOgnoo || new Date(),
          turul: geree.turul || "Үндсэн",
          davkhar: geree.davkhar || "",
          toot: geree.toot || "",
          bairNer: geree.bairNer || "",
          ognoo: invoiceDate, // Invoice date (created date)
          tulukhOgnoo: dueDate, // Due date (X months ago)
          niitTulbur: geree.niitTulbur || 50000, // Use contract amount or default
          tuluv: "Төлөөгүй", // Unpaid
          medeelel: {
            zardluud: geree.zardluud || [],
          },
          nekhemjlekhiinDans: geree.nekhemjlekhiinDans || "",
          nekhemjlekhiinDansniiNer: geree.nekhemjlekhiinDansniiNer || "",
          nekhemjlekhiinBank: geree.nekhemjlekhiinBank || "",
        });

        await invoice.save();
        createdThisMonth++;

        // Get user information from geree
        let userInfo = "No user";
        if (geree.orshinSuugchId) {
          try {
            const user = await OrshinSuugch(db.erunkhiiKholbolt)
              .findById(geree.orshinSuugchId)
              .lean();
            if (user) {
              userInfo = `${user.ovog || ""} ${user.ner || ""} (${
                user.utas || ""
              })`.trim();
            }
          } catch (userError) {
            // User might not exist, that's okay
          }
        }

        console.log(
          `  ✅ Created invoice for ${geree.gereeniiDugaar} (${
            geree.ner
          }) - User: ${userInfo} - Due: ${
            dueDate.toISOString().split("T")[0]
          } (${monthsAgo} months ago)`
        );
      }

      totalCreated += createdThisMonth;
      console.log(
        `  📊 Created ${createdThisMonth} invoices for ${monthsAgo} months ago`
      );
    }

    console.log(`\n✅ Total invoices created: ${totalCreated}`);
    console.log(`\n📊 Summary by months ago:`);
    for (const monthsAgo of MONTHS_AGO) {
      const dueDate = new Date(today);
      dueDate.setMonth(dueDate.getMonth() - monthsAgo);
      dueDate.setDate(15);
      dueDate.setHours(0, 0, 0, 0);

      const invoices = await NekhemjlekhiinTuukhModel.find({
        baiguullagiinId: String(BAIGULLAGIIN_ID),
        tulukhOgnoo: dueDate,
        tuluv: { $ne: "Төлсөн" },
      })
        .lean()
        .limit(10); // Show first 10 for details

      console.log(
        `\n  ${monthsAgo} months ago: ${invoices.length} unpaid invoices`
      );

      // Show user details for each invoice
      for (const inv of invoices) {
        let userInfo = "No user";
        if (inv.gereeniiId) {
          try {
            const geree = await GereeModel.findById(inv.gereeniiId).lean();
            if (geree && geree.orshinSuugchId) {
              const user = await OrshinSuugch(db.erunkhiiKholbolt)
                .findById(geree.orshinSuugchId)
                .lean();
              if (user) {
                userInfo = `${user.ovog || ""} ${user.ner || ""} (${
                  user.utas || ""
                })`.trim();
              }
            }
          } catch (err) {
            // Skip if error
          }
        }
        console.log(
          `    - Invoice ${inv.gereeniiDugaar || inv._id}: ${
            inv.ner || ""
          } | User: ${userInfo} | Amount: ${inv.niitTulbur || 0}`
        );
      }
    }

    console.log("\n💡 To find which user an invoice belongs to:");
    console.log("   1. Invoice has gereeniiId → Get geree from gereeniiId");
    console.log(
      "   2. Geree has orshinSuugchId → Get user from orshinSuugchId"
    );
    console.log("   3. Or use invoice.utas to find user by phone number");
    console.log("\n🎉 Done! You can now test the overdue receivables report.");
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
createOverdueInvoices()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });

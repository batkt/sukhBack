/**
 * Cleanup script to remove duplicate liftShalgaya entries
 * 
 * This script:
 * 1. Finds all liftShalgaya entries grouped by baiguullagiinId + barilgiinId
 * 2. Keeps only the most recent entry with the most choloolugdokhDavkhar values
 * 3. Deletes all duplicate entries
 * 
 * Run with: node scripts/cleanupLiftShalgayaDuplicates.js
 */

const mongoose = require("mongoose");

// MongoDB connection string (same as index.js)
const MONGO_URI = "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin";

async function cleanupDuplicates() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get all organization databases
    const adminDb = mongoose.connection.db.admin();
    const databases = await adminDb.listDatabases();
    
    let totalDuplicatesRemoved = 0;
    
    for (const dbInfo of databases.databases) {
      const dbName = dbInfo.name;
      
      // Skip system databases
      if (["admin", "local", "config", "amarSukh"].includes(dbName)) {
        continue;
      }

      console.log(`\n📂 Processing database: ${dbName}`);
      
      const db = mongoose.connection.useDb(dbName);
      const collection = db.collection("liftShalgaya");
      
      // Check if collection exists
      const collections = await db.listCollections({ name: "liftShalgaya" }).toArray();
      if (collections.length === 0) {
        console.log(`   ⏭️  No liftShalgaya collection in ${dbName}`);
        continue;
      }

      // Find duplicates using aggregation
      const duplicates = await collection.aggregate([
        {
          $group: {
            _id: {
              baiguullagiinId: "$baiguullagiinId",
              barilgiinId: "$barilgiinId"
            },
            docs: { $push: { id: "$_id", choloolugdokhDavkhar: "$choloolugdokhDavkhar", updatedAt: "$updatedAt" } },
            count: { $sum: 1 }
          }
        },
        {
          $match: {
            count: { $gt: 1 }
          }
        }
      ]).toArray();

      if (duplicates.length === 0) {
        console.log(`   ✅ No duplicates found in ${dbName}`);
        continue;
      }

      console.log(`   🔍 Found ${duplicates.length} duplicate groups in ${dbName}`);

      for (const group of duplicates) {
        const { baiguullagiinId, barilgiinId } = group._id;
        const docs = group.docs;

        console.log(`   📍 Processing: baiguullaga=${baiguullagiinId}, barilga=${barilgiinId} (${docs.length} entries)`);

        // Sort by: 1) Most choloolugdokhDavkhar entries, 2) Most recent updatedAt
        docs.sort((a, b) => {
          const aCount = (a.choloolugdokhDavkhar || []).length;
          const bCount = (b.choloolugdokhDavkhar || []).length;
          
          // Prefer more floors
          if (bCount !== aCount) {
            return bCount - aCount;
          }
          
          // If same floor count, prefer more recent
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bTime - aTime;
        });

        // Keep the first one (best one), delete the rest
        const keepId = docs[0].id;
        const deleteIds = docs.slice(1).map(d => d.id);

        console.log(`      ✓ Keeping: ${keepId} (${(docs[0].choloolugdokhDavkhar || []).length} floors)`);
        console.log(`      ✗ Deleting: ${deleteIds.length} duplicates`);

        // Delete duplicates
        const deleteResult = await collection.deleteMany({
          _id: { $in: deleteIds }
        });

        totalDuplicatesRemoved += deleteResult.deletedCount;
        console.log(`      🗑️  Deleted ${deleteResult.deletedCount} entries`);
      }
    }

    console.log(`\n========================================`);
    console.log(`✅ Cleanup complete!`);
    console.log(`🗑️  Total duplicates removed: ${totalDuplicatesRemoved}`);
    console.log(`========================================`);

  } catch (error) {
    console.error("❌ Error during cleanup:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

// Run the cleanup
cleanupDuplicates();

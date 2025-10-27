const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const ashiglaltiinZardluudSchema = new Schema(
  {
    baiguullagiinId: String,
    barilgiinId: String,
    ner: String,
    turul: String,
    bodokhArga: String, //togtmol tomyotoi baidag arguud
    tseverUsDun: Number, // xaluun xuiten ustei ued xatuu bodno
    bokhirUsDun: Number, // xaluun xuiten ustei ued xatuu bodno
    usKhalaasniiDun: Number, // xaluun us ued xatuu bodno
    tsakhilgaanUrjver: Number, //tsakhilgaanii coefficent
    tsakhilgaanChadal: Number,
    tsakhilgaanDemjikh: Number,
    tariff: Number,
    tariffUsgeer: String,
    suuriKhuraamj: Number,
    nuatNemekhEsekh: Boolean,
    togtmolUtga: Number,
    choloolugdsonDavkhar: Boolean,
    zardliinTurul : String,
    dun: Number,
    ognoonuud: [Date],
    nuatBodokhEsekh: Boolean,
  },
  {
    timestamps: true,
  }
);

// Middleware to update geree and nekhemjlekh when ashiglaltiinZardluud is updated
console.log("🔧 Registering ashiglaltiinZardluud middleware...");

// For save operations
ashiglaltiinZardluudSchema.post('save', async function(doc) {
  await handleZardluudUpdate(doc);
});

// For findOneAndUpdate operations
ashiglaltiinZardluudSchema.post('findOneAndUpdate', async function(result) {
  if (result) {
    await handleZardluudUpdate(result);
  }
});

// For updateOne operations - we need to get the document separately
ashiglaltiinZardluudSchema.post('updateOne', async function() {
  // Get the document that was updated
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    await handleZardluudUpdate(doc);
  }
});

async function handleZardluudUpdate(doc) {
  try {
    console.log("🔥 ASHIGLALTIIN ZARDLUUD MIDDLEWARE TRIGGERED!");
    console.log("Document:", doc);
    console.log("Document baiguullagiinId:", doc.baiguullagiinId);
    if (!doc) {
      console.log("❌ No document found, exiting");
      return;
    }
    
    const { db } = require("zevbackv2");
    const Geree = require("./geree");
    const nekhemjlekhiinTuukh = require("./nekhemjlekhiinTuukh");
    
    // Get the organization connection
    const kholbolt = db.kholboltuud.find(
      (a) => a.baiguullagiinId == doc.baiguullagiinId
    );
    
    if (!kholbolt) return;
    
    // Find ALL geree records for this organization (not just ones with this item)
    const gereenuud = await Geree(kholbolt, true).find({
      baiguullagiinId: doc.baiguullagiinId
    });
    
    console.log(`📋 Found ${gereenuud.length} geree records for organization ${doc.baiguullagiinId}`);
    
    // Update each geree record
    for (const geree of gereenuud) {
      // Ensure zardluud array exists
      if (!geree.zardluud) {
        geree.zardluud = [];
      }
      
      // Find the specific zardal in the geree by matching name and other fields
      const zardalIndex = geree.zardluud.findIndex(z => 
        z.ner === doc.ner && 
        z.turul === doc.turul && 
        z.zardliinTurul === doc.zardliinTurul
      );
      
      if (zardalIndex !== -1) {
        // Update existing zardal
        console.log(`✅ Updating existing zardluud in geree ${geree.gereeniiDugaar}`);
        // Update the zardal in geree
        geree.zardluud[zardalIndex] = {
          ...geree.zardluud[zardalIndex].toObject(),
          ner: doc.ner,
          turul: doc.turul,
          tariff: doc.tariff,
          tariffUsgeer: doc.tariffUsgeer,
          zardliinTurul: doc.zardliinTurul,
          tseverUsDun: doc.tseverUsDun,
          bokhirUsDun: doc.bokhirUsDun,
          usKhalaasniiDun: doc.usKhalaasniiDun,
          tsakhilgaanUrjver: doc.tsakhilgaanUrjver,
          tsakhilgaanChadal: doc.tsakhilgaanChadal,
          tsakhilgaanDemjikh: doc.tsakhilgaanDemjikh,
          suuriKhuraamj: doc.suuriKhuraamj,
          nuatNemekhEsekh: doc.nuatNemekhEsekh,
          dun: doc.dun
        };
        
        // Recalculate niitTulbur using tariff instead of dun
        const niitTulbur = geree.zardluud.reduce((sum, zardal) => {
          return sum + (zardal.tariff || 0);
        }, 0);
        
        geree.niitTulbur = niitTulbur;
        
        // Save the updated geree
        await geree.save();
        
        // Update corresponding nekhemjlekh if it exists
        const nekhemjlekh = await nekhemjlekhiinTuukh(kholbolt).findOne({
          gereeniiId: geree._id,
          tuluv: { $ne: "Төлсөн" } // Only update unpaid invoices
        });
        
        if (nekhemjlekh) {
          // Ensure medeelel and zardluud exist
          if (!nekhemjlekh.medeelel) nekhemjlekh.medeelel = {};
          if (!nekhemjlekh.medeelel.zardluud) nekhemjlekh.medeelel.zardluud = [];
          
          // Update nekhemjlekh zardluud by matching name and other fields
          const nekhemjlekhZardalIndex = nekhemjlekh.medeelel.zardluud.findIndex(z => 
            z.ner === doc.ner && 
            z.turul === doc.turul && 
            z.zardliinTurul === doc.zardliinTurul
          );
          
          if (nekhemjlekhZardalIndex !== -1) {
            nekhemjlekh.medeelel.zardluud[nekhemjlekhZardalIndex] = {
              ...nekhemjlekh.medeelel.zardluud[nekhemjlekhZardalIndex],
              ner: doc.ner,
              turul: doc.turul,
              tariff: doc.tariff,
              tariffUsgeer: doc.tariffUsgeer,
              zardliinTurul: doc.zardliinTurul,
              tseverUsDun: doc.tseverUsDun,
              bokhirUsDun: doc.bokhirUsDun,
              usKhalaasniiDun: doc.usKhalaasniiDun,
              tsakhilgaanUrjver: doc.tsakhilgaanUrjver,
              tsakhilgaanChadal: doc.tsakhilgaanChadal,
              tsakhilgaanDemjikh: doc.tsakhilgaanDemjikh,
              suuriKhuraamj: doc.suuriKhuraamj,
              nuatNemekhEsekh: doc.nuatNemekhEsekh,
              dun: doc.dun
            };
            
            // Recalculate nekhemjlekh total using tariff instead of dun
            nekhemjlekh.niitTulbur = nekhemjlekh.medeelel.zardluud.reduce((sum, zardal) => {
              return sum + (zardal.tariff || 0);
            }, 0);
            
            // Update content
            nekhemjlekh.content = `Гэрээний дугаар: ${geree.gereeniiDugaar}, Нийт төлбөр: ${nekhemjlekh.niitTulbur}₮`;
            
            await nekhemjlekh.save();
          }
        }
      } else {
        // Add new zardal to geree
        console.log(`➕ Adding new zardluud to geree ${geree.gereeniiDugaar}`);
        
        const newZardal = {
          ner: doc.ner,
          turul: doc.turul,
          tariff: doc.tariff,
          tariffUsgeer: doc.tariffUsgeer,
          zardliinTurul: doc.zardliinTurul,
          tulukhDun: 0,
          dun: doc.dun || 0,
          bodokhArga: doc.bodokhArga || "",
          tseverUsDun: doc.tseverUsDun || 0,
          bokhirUsDun: doc.bokhirUsDun || 0,
          usKhalaasniiDun: doc.usKhalaasniiDun || 0,
          tsakhilgaanUrjver: doc.tsakhilgaanUrjver || 1,
          tsakhilgaanChadal: doc.tsakhilgaanChadal || 0,
          tsakhilgaanDemjikh: doc.tsakhilgaanDemjikh || 0,
          suuriKhuraamj: doc.suuriKhuraamj || 0,
          nuatNemekhEsekh: doc.nuatNemekhEsekh || false,
          ognoonuud: doc.ognoonuud || []
        };
        
        geree.zardluud.push(newZardal);
        
        // Recalculate niitTulbur using tariff instead of dun
        const niitTulbur = geree.zardluud.reduce((sum, zardal) => {
          return sum + (zardal.tariff || 0);
        }, 0);
        
        geree.niitTulbur = niitTulbur;
        
        // Save the updated geree
        await geree.save();
        
        // Update corresponding nekhemjlekh if it exists
        const nekhemjlekh = await nekhemjlekhiinTuukh(kholbolt).findOne({
          gereeniiId: geree._id,
          tuluv: { $ne: "Төлсөн" } // Only update unpaid invoices
        });
        
        if (nekhemjlekh) {
          // Ensure medeelel and zardluud exist
          if (!nekhemjlekh.medeelel) nekhemjlekh.medeelel = {};
          if (!nekhemjlekh.medeelel.zardluud) nekhemjlekh.medeelel.zardluud = [];
          
          // Add new zardal to nekhemjlekh
          const nekhemjlekhZardalIndex = nekhemjlekh.medeelel.zardluud.findIndex(z => 
            z.ner === doc.ner && 
            z.turul === doc.turul && 
            z.zardliinTurul === doc.zardliinTurul
          );
          
          if (nekhemjlekhZardalIndex === -1) {
            nekhemjlekh.medeelel.zardluud.push(newZardal);
          } else {
            nekhemjlekh.medeelel.zardluud[nekhemjlekhZardalIndex] = newZardal;
          }
          
          // Recalculate nekhemjlekh total using tariff instead of dun
          nekhemjlekh.niitTulbur = nekhemjlekh.medeelel.zardluud.reduce((sum, zardal) => {
            return sum + (zardal.tariff || 0);
          }, 0);
          
          // Update content
          nekhemjlekh.content = `Гэрээний дугаар: ${geree.gereeniiDugaar}, Нийт төлбөр: ${nekhemjlekh.niitTulbur}₮`;
          
          await nekhemjlekh.save();
        }
      }
    }
  } catch (error) {
    console.error("Error updating geree and nekhemjlekh after ashiglaltiinZardluud update:", error);
  }
}

// Middleware to handle deletion of ashiglaltiinZardluud
ashiglaltiinZardluudSchema.post(['findOneAndDelete', 'deleteOne'], async function(doc) {
  try {
    if (!doc) return;
    
    const { db } = require("zevbackv2");
    const Geree = require("./geree");
    const nekhemjlekhiinTuukh = require("./nekhemjlekhiinTuukh");
    
    // Get the organization connection
    const kholbolt = db.kholboltuud.find(
      (a) => a.baiguullagiinId == doc.baiguullagiinId
    );
    
    if (!kholbolt) return;
    
    // Find ALL geree records for this organization
    const gereenuud = await Geree(kholbolt, true).find({
      baiguullagiinId: doc.baiguullagiinId
    });
    
    console.log(`📋 Deleting zardluud from ${gereenuud.length} geree records`);
    
    // Update each geree record
    for (const geree of gereenuud) {
      if (!geree.zardluud) {
        geree.zardluud = [];
      }
      
      // Remove the zardal from geree by matching name and other fields
      geree.zardluud = geree.zardluud.filter(z => 
        !(z.ner === doc.ner && 
          z.turul === doc.turul && 
          z.zardliinTurul === doc.zardliinTurul)
      );
      
      // Recalculate niitTulbur using tariff instead of dun
      const niitTulbur = geree.zardluud.reduce((sum, zardal) => {
        return sum + (zardal.tariff || 0);
      }, 0);
      
      geree.niitTulbur = niitTulbur;
      
      // Save the updated geree
      await geree.save();
      
      // Update corresponding nekhemjlekh if it exists
      const nekhemjlekh = await nekhemjlekhiinTuukh(kholbolt).findOne({
        gereeniiId: geree._id,
        tuluv: { $ne: "Төлсөн" } // Only update unpaid invoices
      });
      
      if (nekhemjlekh) {
        if (!nekhemjlekh.medeelel) nekhemjlekh.medeelel = {};
        if (!nekhemjlekh.medeelel.zardluud) nekhemjlekh.medeelel.zardluud = [];
        
        // Remove the zardal from nekhemjlekh by matching name and other fields
        nekhemjlekh.medeelel.zardluud = nekhemjlekh.medeelel.zardluud.filter(z => 
          !(z.ner === doc.ner && 
            z.turul === doc.turul && 
            z.zardliinTurul === doc.zardliinTurul)
        );
        
        // Recalculate nekhemjlekh total using tariff instead of dun
        nekhemjlekh.niitTulbur = nekhemjlekh.medeelel.zardluud.reduce((sum, zardal) => {
          return sum + (zardal.tariff || 0);
        }, 0);
        
        // Update content
        nekhemjlekh.content = `Гэрээний дугаар: ${geree.gereeniiDugaar}, Нийт төлбөр: ${nekhemjlekh.niitTulbur}₮`;
        
        await nekhemjlekh.save();
      }
    }
  } catch (error) {
    console.error("Error updating geree and nekhemjlekh after ashiglaltiinZardluud deletion:", error);
  }
});

//module.exports = mongoose.model("ashiglaltiinZardluud", ashiglaltiinZardluudSchema);

module.exports = function a(conn) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = conn.kholbolt;
  
  // Check if model already exists to avoid re-registering middleware
  if (conn.models.ashiglaltiinZardluud) {
    return conn.model("ashiglaltiinZardluud");
  }
  
  return conn.model("ashiglaltiinZardluud", ashiglaltiinZardluudSchema);
};

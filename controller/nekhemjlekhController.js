const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const Geree = require("../models/geree");
const Baiguullaga = require("../models/baiguullaga");

// Гэрээнээс нэхэмжлэх үүсгэх функц
const gereeNeesNekhemjlekhUusgekh = async (tempData, org, tukhainBaaziinKholbolt, uusgegsenEsekh = "garan") => {
  try {
    // Нэхэмжлэхийн бичлэг үүсгэх
    const tuukh = new nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)();
    
    // Гэрээний мэдээллийг нэхэмжлэх рүү хуулах
    tuukh.baiguullagiinNer = tempData.baiguullagiinNer || org.ner;
    tuukh.baiguullagiinId = tempData.baiguullagiinId;
    tuukh.barilgiinId = tempData.barilgiinId || "";
    tuukh.ovog = tempData.ovog;
    tuukh.ner = tempData.ner;
    tuukh.register = tempData.register || "";
    tuukh.utas = tempData.utas || [];
    tuukh.khayag = tempData.khayag || tempData.bairNer;
    tuukh.gereeniiOgnoo = tempData.gereeniiOgnoo;
    tuukh.turul = tempData.turul;
    tuukh.gereeniiId = tempData._id;
    tuukh.gereeniiDugaar = tempData.gereeniiDugaar;
    tuukh.davkhar = tempData.davkhar;
    tuukh.uldegdel = tempData.uldegdel || tempData.baritsaaniiUldegdel || 0;
    tuukh.daraagiinTulukhOgnoo = tempData.daraagiinTulukhOgnoo || tempData.tulukhOgnoo;
    tuukh.dansniiDugaar = tempData.dans || tempData.dansniiDugaar || "";
    tuukh.gereeniiZagvariinId = tempData.gereeniiZagvariinId || "";
    tuukh.tulukhUdur = tempData.tulukhUdur || [];
    tuukh.tuluv = tempData.tuluv || 1;
    tuukh.ognoo = tempData.ognoo || new Date();
    tuukh.mailKhayagTo = tempData.mail;
    tuukh.maililgeesenAjiltniiId = tempData.maililgeesenAjiltniiId || tempData.burtgesenAjiltan;
    tuukh.maililgeesenAjiltniiNer = tempData.maililgeesenAjiltniiNer || tempData.ner;
    tuukh.nekhemjlekhiinZagvarId = tempData.nekhemjlekhiinZagvarId || "";
    tuukh.medeelel = {
      zardluud: tempData.zardluud || [],
      segmentuud: tempData.segmentuud || [],
      khungulultuud: tempData.khungulultuud || [],
      toot: tempData.toot,
      temdeglel: tempData.temdeglel,
      uusgegsenEsekh: uusgegsenEsekh,
      uusgegsenOgnoo: new Date()
    };
    tuukh.nekhemjlekh = tempData.nekhemjlekh || (uusgegsenEsekh === "automataar" ? "Автоматаар үүссэн нэхэмжлэх" : "Гаран үүссэн нэхэмжлэх");
    tuukh.zagvariinNer = tempData.zagvariinNer || org.ner;
    tuukh.content = `Гэрээний дугаар: ${tempData.gereeniiDugaar}, Нийт төлбөр: ${tempData.niitTulbur}₮`;
    tuukh.nekhemjlekhiinDans = tempData.nekhemjlekhiinDans || "";
    tuukh.nekhemjlekhiinDansniiNer = tempData.nekhemjlekhiinDansniiNer || "";
    tuukh.nekhemjlekhiinBank = tempData.nekhemjlekhiinBank || "";
    tuukh.nekhemjlekhiinIbanDugaar = tempData.nekhemjlekhiinIbanDugaar || "";
    tuukh.nekhemjlekhiinOgnoo = new Date();
    tuukh.niitTulbur = tempData.niitTulbur || 0;
    
    // Set payment due date (30 days from creation)
    tuukh.tulukhOgnoo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    // Initialize payment status
    tuukh.tuluv = "Төлөөгүй";
    
    // Нэхэмжлэхийн дугаар үүсгэх
    const suuliinNekhemjlekh = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)
      .findOne()
      .sort({ dugaalaltDugaar: -1 });
    
    const suuliinDugaar = suuliinNekhemjlekh?.dugaalaltDugaar;
    tuukh.dugaalaltDugaar = (suuliinDugaar && !isNaN(suuliinDugaar)) ? suuliinDugaar + 1 : 1;

    // Нэхэмжлэх хадгалах
    await tuukh.save();
    
    // Гэрээг нэхэмжлэхийн огноогоор шинэчлэх
    await Geree(tukhainBaaziinKholbolt).findByIdAndUpdate(tempData._id, {
      nekhemjlekhiinOgnoo: new Date()
    });
    
    return {
      success: true,
      nekhemjlekh: tuukh,
      gereeniiId: tempData._id,
      gereeniiDugaar: tempData.gereeniiDugaar,
      tulbur: tempData.niitTulbur
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      gereeniiId: tempData._id,
      gereeniiDugaar: tempData.gereeniiDugaar
    };
  }
};


// Function to update geree and nekhemjlekh when ashiglaltiinZardluud changes
const updateGereeAndNekhemjlekhFromZardluud = async (ashiglaltiinZardal, tukhainBaaziinKholbolt) => {
  try {
    const Geree = require("../models/geree");
    const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
    
    // Find all geree records that use this ashiglaltiinZardal by matching name and other fields
    // Use $or to match either the same barilgiinId or empty barilgiinId
    const gereenuud = await Geree(tukhainBaaziinKholbolt, true).find({
      baiguullagiinId: ashiglaltiinZardal.baiguullagiinId,
      $or: [
        { barilgiinId: ashiglaltiinZardal.barilgiinId },
        { barilgiinId: "" },
        { barilgiinId: { $exists: false } }
      ],
      "zardluud.ner": ashiglaltiinZardal.ner,
      "zardluud.turul": ashiglaltiinZardal.turul,
      "zardluud.zardliinTurul": ashiglaltiinZardal.zardliinTurul
    });
    
    // Update each geree record
    for (const geree of gereenuud) {
      // Find the specific zardal in the geree by matching name and other fields
      const zardalIndex = geree.zardluud.findIndex(z => 
        z.ner === ashiglaltiinZardal.ner && 
        z.turul === ashiglaltiinZardal.turul && 
        z.zardliinTurul === ashiglaltiinZardal.zardliinTurul
      );
      
      if (zardalIndex !== -1) {
        // Update the zardal in geree
        geree.zardluud[zardalIndex] = {
          ...geree.zardluud[zardalIndex].toObject(),
          ner: ashiglaltiinZardal.ner,
          turul: ashiglaltiinZardal.turul,
          tariff: ashiglaltiinZardal.tariff,
          tariffUsgeer: ashiglaltiinZardal.tariffUsgeer,
          zardliinTurul: ashiglaltiinZardal.zardliinTurul,
          tseverUsDun: ashiglaltiinZardal.tseverUsDun,
          bokhirUsDun: ashiglaltiinZardal.bokhirUsDun,
          usKhalaasniiDun: ashiglaltiinZardal.usKhalaasniiDun,
          tsakhilgaanUrjver: ashiglaltiinZardal.tsakhilgaanUrjver,
          tsakhilgaanChadal: ashiglaltiinZardal.tsakhilgaanChadal,
          tsakhilgaanDemjikh: ashiglaltiinZardal.tsakhilgaanDemjikh,
          suuriKhuraamj: ashiglaltiinZardal.suuriKhuraamj,
          nuatNemekhEsekh: ashiglaltiinZardal.nuatNemekhEsekh,
          dun: ashiglaltiinZardal.dun
        };
        
        // Recalculate niitTulbur
        const niitTulbur = geree.zardluud.reduce((sum, zardal) => {
          return sum + (zardal.dun || 0);
        }, 0);
        
        geree.niitTulbur = niitTulbur;
        
        // Save the updated geree
        await geree.save();
        
        // Update corresponding nekhemjlekh if it exists
        const nekhemjlekh = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).findOne({
          gereeniiId: geree._id,
          tuluv: { $ne: "Төлсөн" } // Only update unpaid invoices
        });
        
        if (nekhemjlekh) {
          // Update nekhemjlekh zardluud by matching name and other fields
          const nekhemjlekhZardalIndex = nekhemjlekh.medeelel.zardluud.findIndex(z => 
            z.ner === ashiglaltiinZardal.ner && 
            z.turul === ashiglaltiinZardal.turul && 
            z.zardliinTurul === ashiglaltiinZardal.zardliinTurul
          );
          
          if (nekhemjlekhZardalIndex !== -1) {
            nekhemjlekh.medeelel.zardluud[nekhemjlekhZardalIndex] = {
              ...nekhemjlekh.medeelel.zardluud[nekhemjlekhZardalIndex],
              ner: ashiglaltiinZardal.ner,
              turul: ashiglaltiinZardal.turul,
              tariff: ashiglaltiinZardal.tariff,
              tariffUsgeer: ashiglaltiinZardal.tariffUsgeer,
              zardliinTurul: ashiglaltiinZardal.zardliinTurul,
              tseverUsDun: ashiglaltiinZardal.tseverUsDun,
              bokhirUsDun: ashiglaltiinZardal.bokhirUsDun,
              usKhalaasniiDun: ashiglaltiinZardal.usKhalaasniiDun,
              tsakhilgaanUrjver: ashiglaltiinZardal.tsakhilgaanUrjver,
              tsakhilgaanChadal: ashiglaltiinZardal.tsakhilgaanChadal,
              tsakhilgaanDemjikh: ashiglaltiinZardal.tsakhilgaanDemjikh,
              suuriKhuraamj: ashiglaltiinZardal.suuriKhuraamj,
              nuatNemekhEsekh: ashiglaltiinZardal.nuatNemekhEsekh,
              dun: ashiglaltiinZardal.dun
            };
            
            // Recalculate nekhemjlekh total
            nekhemjlekh.niitTulbur = nekhemjlekh.medeelel.zardluud.reduce((sum, zardal) => {
              return sum + (zardal.dun || 0);
            }, 0);
            
            // Update content
            nekhemjlekh.content = `Гэрээний дугаар: ${geree.gereeniiDugaar}, Нийт төлбөр: ${nekhemjlekh.niitTulbur}₮`;
            
            await nekhemjlekh.save();
          }
        }
      }
    }
    
    return { success: true, updatedGereenuud: gereenuud.length };
  } catch (error) {
    console.error("Error updating geree and nekhemjlekh from zardluud:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  gereeNeesNekhemjlekhUusgekh,
  updateGereeAndNekhemjlekhFromZardluud,
};

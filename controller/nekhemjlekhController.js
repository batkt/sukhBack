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


module.exports = {
  gereeNeesNekhemjlekhUusgekh,
};

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
    
    // Нэхэмжлэхийн дугаар үүсгэх
    const suuliinNekhemjlekh = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)
      .findOne()
      .sort({ dugaalaltDugaar: -1 });
    tuukh.dugaalaltDugaar = suuliinNekhemjlekh ? suuliinNekhemjlekh.dugaalaltDugaar + 1 : 1;

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

// Мобайл апп-д зориулсан нэхэмжлэх авах
const mubailApdNekhemjlekhAvya = async (req, res, next) => {
  try {
    const { baiguullagiinId } = req.params;
    const { huudas = 1, hadgalakh = 10, ehelsenOgnoo, duusakhOgnoo } = req.query;

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "Байгууллагын ID заавал бөглөх шаардлагатай!"
      });
    }

    // Байгууллагын мэдээлэл авах
    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId);
    if (!baiguullaga) {
      return res.status(404).json({
        success: false,
        message: "Байгууллагын мэдээлэл олдсонгүй!"
      });
    }

    // Түхайн баазын холболт авах
    const tukhainBaaziinKholbolt = { kholbolt: await db.kholboltAvya(baiguullagiinId) };

    // Хайлтын нөхцөл бүрдүүлэх
    const hailt = { baiguullagiinId };
    
    if (ehelsenOgnoo || duusakhOgnoo) {
      hailt.nekhemjlekhiinOgnoo = {};
      if (ehelsenOgnoo) hailt.nekhemjlekhiinOgnoo.$gte = new Date(ehelsenOgnoo);
      if (duusakhOgnoo) hailt.nekhemjlekhiinOgnoo.$lte = new Date(duusakhOgnoo);
    }

    // Нэхэмжлэхүүдийг хуудаслалттайгаар авах
    const nekhemjlekhuud = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)
      .find(hailt)
      .sort({ nekhemjlekhiinOgnoo: -1 })
      .skip((huudas - 1) * hadgalakh)
      .limit(parseInt(hadgalakh));

    // Нийт тоо авах
    const niitToo = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).countDocuments(hailt);

    // Мобайл апп-д зориулсан хариу бэлтгэх
    const mubailApdZorilsonNekhemjlekhuud = nekhemjlekhuud.map(nekhemjlekh => ({
      nekhemjlekhiinId: nekhemjlekh._id,
      nekhemjlekhiinDugaar: nekhemjlekh.dugaalaltDugaar,
      gereeniiDugaar: nekhemjlekh.gereeniiDugaar,
      hereglegchiinNer: `${nekhemjlekh.ovog} ${nekhemjlekh.ner}`,
      hereglegchiinUtas: nekhemjlekh.utas?.[0] || "",
      hereglegchiinMail: nekhemjlekh.mailKhayagTo || "",
      davkhar: nekhemjlekh.davkhar || "",
      tulbur: nekhemjlekh.content?.match(/Нийт төлбөр: (\d+)₮/)?.[1] || "0",
      uusgegsenOgnoo: nekhemjlekh.nekhemjlekhiinOgnoo,
      tuluv: "uusgegsen",
      baiguullaga: nekhemjlekh.baiguullagiinNer
    }));

    res.json({
      success: true,
      data: {
        nekhemjlekhuud: mubailApdZorilsonNekhemjlekhuud,
        huudaslalt: {
          odoogiinHuudas: parseInt(huudas),
          niitHuudas: Math.ceil(niitToo / hadgalakh),
          niitToo,
          daraagiinHuudasBaih: huudas * hadgalakh < niitToo,
          umnuugiinHuudasBaih: huudas > 1
        }
      }
    });

  } catch (error) {
    console.error("Мобайл апп-д нэхэмжлэх авах алдаа:", error);
    next(error);
  }
};

module.exports = {
  gereeNeesNekhemjlekhUusgekh,
  mubailApdNekhemjlekhAvya
};

const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const Geree = require("../models/geree");
const Baiguullaga = require("../models/baiguullaga");

// Reusable function to create invoice from contract (used by both endpoint and cron)
const createInvoiceFromContract = async (tempData, org, tukhainBaaziinKholbolt, generatedFor = "manual") => {
  try {
    // Create invoice record
    const tuukh = new nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)();
    
    // Map contract data to invoice (only using model fields)
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
      generatedFor: generatedFor,
      generationDate: new Date()
    };
    tuukh.nekhemjlekh = tempData.nekhemjlekh || (generatedFor === "cron_job" ? "Автоматаар үүссэн нэхэмжлэх" : "Мобайл апп-д зориулсан нэхэмжлэх");
    tuukh.zagvariinNer = tempData.zagvariinNer || org.ner;
    tuukh.content = `Гэрээний дугаар: ${tempData.gereeniiDugaar}, Нийт төлбөр: ${tempData.niitTulbur}₮`;
    tuukh.nekhemjlekhiinDans = tempData.nekhemjlekhiinDans || "";
    tuukh.nekhemjlekhiinDansniiNer = tempData.nekhemjlekhiinDansniiNer || "";
    tuukh.nekhemjlekhiinBank = tempData.nekhemjlekhiinBank || "";
    tuukh.nekhemjlekhiinIbanDugaar = tempData.nekhemjlekhiinIbanDugaar || "";
    tuukh.nekhemjlekhiinOgnoo = new Date();
    
    // Generate invoice number
    const lastInvoice = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)
      .findOne()
      .sort({ dugaalaltDugaar: -1 });
    tuukh.dugaalaltDugaar = lastInvoice ? lastInvoice.dugaalaltDugaar + 1 : 1;

    // Save invoice
    await tuukh.save();
    
    // Update contract with invoice date
    await Geree(tukhainBaaziinKholbolt).findByIdAndUpdate(tempData._id, {
      nekhemjlekhiinOgnoo: new Date()
    });
    
    return {
      success: true,
      invoice: tuukh,
      contractId: tempData._id,
      contractNumber: tempData.gereeniiDugaar,
      amount: tempData.niitTulbur
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      contractId: tempData._id,
      contractNumber: tempData.gereeniiDugaar
    };
  }
};

// Controller for creating invoices from contracts (mobile app endpoint)
const nekhemjlekhAvya = async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    
    // Get organization info
    var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(req.body.baiguullagiinId);
    if (!baiguullaga) {
      throw new Error("Байгууллагын мэдээлэл олдсонгүй!");
    }

    console.log("=== CREATING INVOICES FOR MOBILE APP ===");
    console.log("Organization:", baiguullaga.ner);
    console.log("Contracts to process:", req.body.gereenuud?.length || 0);

    const createdInvoices = [];
    const errors = [];

    if (req.body.gereenuud && req.body.gereenuud.length > 0) {
      for await (const tempData of req.body.gereenuud) {
        try {
          console.log(`Processing contract: ${tempData.gereeniiDugaar}`);
          
          const result = await createInvoiceFromContract(tempData, baiguullaga, req.body.tukhainBaaziinKholbolt, "mobile_app");
          
          if (result.success) {
            console.log(`✅ Invoice created for contract ${result.contractNumber} - Amount: ${result.amount}₮`);
            
            createdInvoices.push({
              invoiceId: result.invoice._id,
              contractId: result.contractId,
              contractNumber: result.contractNumber,
              amount: result.amount,
              user: {
                name: tempData.ner,
                phone: tempData.utas?.[0],
                email: tempData.mail,
                department: tempData.davkhar
              },
              status: "created"
            });
          } else {
            console.error(`❌ Error processing contract ${result.contractNumber}:`, result.error);
            errors.push({
              contractId: result.contractId,
              contractNumber: result.contractNumber,
              error: result.error
            });
          }

        } catch (contractError) {
          console.error(`❌ Error processing contract ${tempData.gereeniiDugaar}:`, contractError.message);
          errors.push({
            contractId: tempData._id,
            contractNumber: tempData.gereeniiDugaar,
            error: contractError.message
          });
        }
      }
    }

    console.log(`=== INVOICE CREATION COMPLETED ===`);
    console.log(`Successfully created: ${createdInvoices.length} invoices`);
    console.log(`Errors: ${errors.length}`);

    res.json({
      success: true,
      message: `Амжилттай ${createdInvoices.length} нэхэмжлэх үүсгэгдлээ`,
      data: {
        createdInvoices,
        errors,
        summary: {
          totalProcessed: req.body.gereenuud?.length || 0,
          successful: createdInvoices.length,
          failed: errors.length
        }
      }
    });

  } catch (err) {
    console.error("❌ CRITICAL ERROR in invoice creation:", err);
    next(err);
  }
};



module.exports = {
  createInvoiceFromContract,
  nekhemjlekhAvya
};

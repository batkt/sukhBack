const asyncHandler = require("express-async-handler");
const Geree = require("../models/geree");
const BankniiGuilgee = require("../models/bankniiGuilgee");
const Medegdel = require("../models/medegdel");
const { daraagiinTulukhOgnooZasya } = require("./tulbur");

exports.gereeniiGuilgeeKhadgalya = asyncHandler(async (req, res, next) => {
  try {
    console.log("gereeniiGuilgeeKhadgalya -----> Ийшээ орлоо");
    const { db } = require("zevbackv2");
    var guilgee = req.body.guilgee;

    if (!guilgee.gereeniiId) {
      throw new Error("Гэрээний ID заавал бөглөх шаардлагатай!");
    }

    // Get baiguullagiinId from request body or from geree document
    let baiguullagiinId = req.body.baiguullagiinId;
    
    // If not provided, get it from the geree document
    if (!baiguullagiinId) {
      // Try to find geree in any connection to get baiguullagiinId
      // We'll need to search through connections or get it from a temporary connection
      // For now, let's require it in the body or get from geree if we can find it
      const allConnections = db.kholboltuud || [];
      let foundGeree = null;
      
      for (const conn of allConnections) {
        try {
          const tempGeree = await Geree(conn, true).findById(guilgee.gereeniiId).select("baiguullagiinId");
          if (tempGeree) {
            foundGeree = tempGeree;
            baiguullagiinId = tempGeree.baiguullagiinId;
            break;
          }
        } catch (err) {
          // Continue searching
        }
      }
      
      if (!baiguullagiinId) {
        throw new Error("Байгууллагын ID олдсонгүй! Гэрээ олдсонгүй эсвэл байгууллагын ID-г body-д оруулна уу.");
      }
    }

    // Get connection from baiguullagiinId
    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => String(kholbolt.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!tukhainBaaziinKholbolt) {
      throw new Error("Холболтын мэдээлэл олдсонгүй!");
    }

    if (guilgee.guilgeeniiId) {
      var shalguur = await BankniiGuilgee(
        tukhainBaaziinKholbolt, true
      ).findOne({
        "guilgee.guilgeeniiId": guilgee.guilgeeniiId,
        kholbosonGereeniiId: guilgee.gereeniiId,
      });
      if (shalguur)
        throw new Error("Тухайн гүйлгээ тухайн гэрээнд холбогдсон байна!");
    }
    
    if (
      (guilgee.turul == "barter" ||
        guilgee.turul == "avlaga" ||
        guilgee.turul == "aldangi") &&
      !guilgee.tailbar
    ) {
      throw new Error("Тайлбар заавал оруулна уу?");
    }
    
    guilgee.guilgeeKhiisenOgnoo = new Date();
    if (req.body.nevtersenAjiltniiToken) {
      guilgee.guilgeeKhiisenAjiltniiNer = req.body.nevtersenAjiltniiToken.ner;
      guilgee.guilgeeKhiisenAjiltniiId = req.body.nevtersenAjiltniiToken.id;
    }

    var inc = {
      uldegdel: -(guilgee?.tulsunDun || 0),
    };
    
    if (guilgee.turul == "aldangi") {
      inc["aldangiinUldegdel"] = -guilgee.tulsunAldangi;
      inc["niitTulsunAldangi"] = +guilgee.tulsunAldangi;
    }

    // Create a copy for guilgeenuudForNekhemjlekh (one-time tracking)
    const guilgeeForNekhemjlekh = { ...guilgee };
    // Get the index where this guilgee will be added
    // Also select fields needed for notifications
    const geree = await Geree(tukhainBaaziinKholbolt, true)
      .findById(guilgee.gereeniiId)
      .select("+avlaga orshinSuugchId gereeniiDugaar barilgiinId");
    const currentGuilgeenuudCount = geree?.avlaga?.guilgeenuud?.length || 0;
    guilgeeForNekhemjlekh.avlagaGuilgeeIndex = currentGuilgeenuudCount;

    const result = await Geree(tukhainBaaziinKholbolt)
      .findByIdAndUpdate(
        { _id: guilgee.gereeniiId },
        {
          $push: {
            [`avlaga.guilgeenuud`]: guilgee,
            guilgeenuudForNekhemjlekh: guilgeeForNekhemjlekh, // Add to tracking array for one-time inclusion in invoice
          },
          $inc: inc,
        }
      );

    await daraagiinTulukhOgnooZasya(
      guilgee.gereeniiId,
      tukhainBaaziinKholbolt
    );

    // Send notification when avlaga payment is added
    try {
      if (guilgee.turul === "avlaga" && geree && geree.orshinSuugchId) {
        const medegdel = new Medegdel(tukhainBaaziinKholbolt)();
        medegdel.orshinSuugchId = geree.orshinSuugchId;
        medegdel.baiguullagiinId = baiguullagiinId;
        medegdel.barilgiinId = geree.barilgiinId || "";
        medegdel.title = "Шинэ авлага нэмэгдлээ";
        medegdel.message = `Гэрээний дугаар: ${geree.gereeniiDugaar || "N/A"}, Төлбөр: ${guilgee.tulsunDun || 0}₮`;
        medegdel.kharsanEsekh = false;
        medegdel.turul = "мэдэгдэл";
        medegdel.ognoo = new Date();

        await medegdel.save();

        // Emit socket event if available
        const io = req.app.get("socketio");
        if (io) {
          io.emit("orshinSuugch" + geree.orshinSuugchId, medegdel);
        }
      }
    } catch (notificationError) {
      console.error("Error sending notification for avlaga:", notificationError);
      // Don't fail the avlaga addition if notification fails
    }

    // If avlaga type, create invoice immediately without month restrictions
    if (guilgee.turul === "avlaga") {
      try {
        const { gereeNeesNekhemjlekhUusgekh } = require("./nekhemjlekhController");
        const Baiguullaga = require("../models/baiguullaga");
        
        // Get fresh geree data with all fields needed for invoice
        const freshGeree = await Geree(tukhainBaaziinKholbolt, true)
          .findById(guilgee.gereeniiId)
          .lean();
        
        if (freshGeree) {
          // Get baiguullaga
          const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt)
            .findById(baiguullagiinId)
            .lean();
          
          if (baiguullaga) {
            const invoiceResult = await gereeNeesNekhemjlekhUusgekh(
              freshGeree,
              baiguullaga,
              tukhainBaaziinKholbolt,
              "garan",
              true // skipDuplicateCheck = true to bypass month restrictions
            );
            
            // Emit socket event for invoice notification if invoice was created successfully
            if (invoiceResult && invoiceResult.success && invoiceResult.nekhemjlekh && freshGeree.orshinSuugchId) {
              try {
                console.log("🔍 [SOCKET] Starting socket emission process...", {
                  invoiceId: invoiceResult.nekhemjlekh._id,
                  orshinSuugchId: freshGeree.orshinSuugchId,
                  baiguullagiinId: baiguullagiinId,
                  hasMedegdel: !!invoiceResult.medegdel,
                });

                const io = req.app.get("socketio");
                
                if (!io) {
                  console.error("❌ [SOCKET] Socket.io instance not found in req.app");
                  return;
                }

                console.log("✅ [SOCKET] Socket.io instance found");

                // Use the medegdel returned from invoice creation, or find the most recent one
                let medegdelToEmit = invoiceResult.medegdel;
                
                if (!medegdelToEmit) {
                  console.log("⚠️ [SOCKET] No medegdel in invoice result, querying database...");
                  // Fallback: Get the notification that was created by gereeNeesNekhemjlekhUusgekh
                  const kholbolt = db.kholboltuud.find(
                    (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
                  );
                  
                  if (!kholbolt) {
                    console.error("❌ [SOCKET] Kholbolt not found for baiguullagiinId:", baiguullagiinId);
                    return;
                  }

                  console.log("🔍 [SOCKET] Querying for recent medegdel...", {
                    orshinSuugchId: freshGeree.orshinSuugchId,
                    kholbolt: kholbolt.kholbolt,
                  });

                  // Find the most recent notification for this orshinSuugch
                  const recentMedegdel = await Medegdel(kholbolt)
                    .findOne({ orshinSuugchId: freshGeree.orshinSuugchId })
                    .sort({ createdAt: -1 })
                    .lean();
                  
                  if (recentMedegdel) {
                    console.log("✅ [SOCKET] Found recent medegdel:", recentMedegdel._id);
                    // Convert dates to Mongolian time (UTC+8) for socket emission
                    const mongolianOffset = 8 * 60 * 60 * 1000;
                    if (recentMedegdel.createdAt) {
                      recentMedegdel.createdAt = new Date(recentMedegdel.createdAt.getTime() + mongolianOffset).toISOString();
                    }
                    if (recentMedegdel.updatedAt) {
                      recentMedegdel.updatedAt = new Date(recentMedegdel.updatedAt.getTime() + mongolianOffset).toISOString();
                    }
                    if (recentMedegdel.ognoo) {
                      recentMedegdel.ognoo = new Date(recentMedegdel.ognoo.getTime() + mongolianOffset).toISOString();
                    }
                    medegdelToEmit = recentMedegdel;
                  } else {
                    console.warn("⚠️ [SOCKET] No recent medegdel found for orshinSuugchId:", freshGeree.orshinSuugchId);
                  }
                } else {
                  console.log("✅ [SOCKET] Using medegdel from invoice result");
                }
                
                if (medegdelToEmit) {
                  const eventName = "orshinSuugch" + freshGeree.orshinSuugchId;
                  
                  console.log("📡 [SOCKET] Emitting invoice notification...", {
                    eventName: eventName,
                    orshinSuugchId: freshGeree.orshinSuugchId,
                    medegdelId: medegdelToEmit._id,
                    title: medegdelToEmit.title,
                    message: medegdelToEmit.message,
                    timestamp: new Date().toISOString(),
                  });

                  io.emit(eventName, medegdelToEmit);
                  
                  console.log("✅ [SOCKET] Invoice notification emitted successfully", {
                    eventName: eventName,
                    timestamp: new Date().toISOString(),
                  });
                } else {
                  console.error("❌ [SOCKET] No medegdel to emit");
                }
              } catch (socketError) {
                console.error("❌ [SOCKET] Error emitting socket event for invoice notification:", {
                  error: socketError.message,
                  stack: socketError.stack,
                  orshinSuugchId: freshGeree.orshinSuugchId,
                  timestamp: new Date().toISOString(),
                });
              }
            } else {
              console.warn("⚠️ [SOCKET] Invoice notification not emitted - conditions not met:", {
                hasInvoiceResult: !!invoiceResult,
                invoiceSuccess: invoiceResult?.success,
                hasNekhemjlekh: !!invoiceResult?.nekhemjlekh,
                hasOrshinSuugchId: !!freshGeree?.orshinSuugchId,
                orshinSuugchId: freshGeree?.orshinSuugchId,
                invoiceResultKeys: invoiceResult ? Object.keys(invoiceResult) : [],
                freshGereeKeys: freshGeree ? Object.keys(freshGeree) : [],
              });
            }
          } else {
            console.warn("⚠️ [SOCKET] Baiguullaga not found for baiguullagiinId:", baiguullagiinId);
          }
        } else {
          console.warn("⚠️ [SOCKET] Fresh geree not found for gereeniiId:", guilgee.gereeniiId);
        }
      } catch (invoiceError) {
        console.error("❌ [SOCKET] Error creating invoice from avlaga:", {
          error: invoiceError.message,
          stack: invoiceError.stack,
          gereeniiId: guilgee.gereeniiId,
        });
        // Don't fail the guilgee addition if invoice creation fails
      }
    }

    if (guilgee.guilgeeniiId) {
      const result1 = await BankniiGuilgee(tukhainBaaziinKholbolt)
        .updateOne(
          { _id: guilgee.guilgeeniiId },
          {
            $set: {
              kholbosonGereeniiId: guilgee.gereeniiId,
              kholbosonTalbainId: result.talbainDugaar,
            },
          }
        );
      res.send(result1);
    } else {
      res.send(result);
    }
  } catch (aldaa) {
    next(aldaa);
  }
});


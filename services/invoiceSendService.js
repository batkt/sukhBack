const { db } = require("zevbackv2");
const Geree = require("../models/geree");
const Baiguullaga = require("../models/baiguullaga");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const Medegdel = require("../models/medegdel");
const { getKholboltByBaiguullagiinId } = require("../utils/dbConnection");
const { gereeNeesNekhemjlekhUusgekh } = require("./invoiceCreationService");
const { previewInvoice } = require("./invoicePreviewService");

function isZardalExcludingEkhniiUldegdel(z) {
  return (
    !z.isEkhniiUldegdel &&
    z.ner !== "Эхний үлдэгдэл" &&
    !(z.ner && z.ner.includes("Эхний үлдэгдэл"))
  );
}

function isEkhniiUldegdelEntry(z) {
  return (
    z.isEkhniiUldegdel ||
    z.ner === "Эхний үлдэгдэл" ||
    (z.ner && z.ner.includes("Эхний үлдэгдэл"))
  );
}

function sumZardalDun(zardluud) {
  return (zardluud || []).reduce((sum, z) => sum + (z.dun || z.tariff || 0), 0);
}

function invoiceHasPayments(inv) {
  return (
    (inv.paymentHistory && inv.paymentHistory.length > 0) ||
    (inv.uldegdel !== inv.niitTulbur && inv.uldegdel < inv.niitTulbur)
  );
}

function toPlainObject(obj) {
  return obj && typeof obj.toObject === "function" ? obj.toObject() : obj;
}

async function deleteDuplicateUnsentInvoices(
  existingUnsentInvoices,
  tukhainBaaziinKholbolt,
) {
  if (existingUnsentInvoices.length <= 1) return;
  for (let i = 1; i < existingUnsentInvoices.length; i++) {
    const inv = existingUnsentInvoices[i];
    if (!invoiceHasPayments(inv)) {
      await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).deleteOne({
        _id: inv._id,
      });
    }
  }
}

const manualSendInvoice = async (
  gereeId,
  baiguullagiinId,
  override = false,
  targetMonth = null,
  targetYear = null,
  app = null,
) => {
  try {
    const tukhainBaaziinKholbolt =
      getKholboltByBaiguullagiinId(baiguullagiinId);

    if (!tukhainBaaziinKholbolt) {
      return { success: false, error: "Холболтын мэдээлэл олдсонгүй!" };
    }

    const geree = await Geree(tukhainBaaziinKholbolt).findById(gereeId).lean();
    if (!geree) {
      return { success: false, error: "Гэрээ олдсонгүй!" };
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt)
      .findById(baiguullagiinId)
      .lean();
    if (!baiguullaga) {
      return { success: false, error: "Байгууллага олдсонгүй!" };
    }

    const currentDate =
      targetMonth !== null && targetYear !== null
        ? new Date(targetYear, targetMonth - 1, 1)
        : new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const monthStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const monthEnd = new Date(
      currentYear,
      currentMonth + 1,
      0,
      23,
      59,
      59,
      999,
    );

    // Check for ANY existing invoices (Paid or Unpaid) for this month to prevent duplicates
    const allExistingInvoices = await nekhemjlekhiinTuukh(
      tukhainBaaziinKholbolt,
    )
      .find({
        gereeniiId: String(gereeId),
        $or: [
          { ognoo: { $gte: monthStart, $lte: monthEnd } },
          { createdAt: { $gte: monthStart, $lte: monthEnd } },
        ],
      })
      .sort({ createdAt: 1 });

    // Previously: if override=false and there was at least one PAID invoice for this month,
    // we blocked creating a new invoice with the message:
    // "Энэ сарын нэхэмжлэх төлөгдсөн байна. Дахин үүсгэх боломжгүй."
    // This prevented resending/creating invoices when a month was already fully paid.
    // Now we allow creating/sending again regardless of existing paid invoices.

    // Filter for UNSENT/UNPAID invoices for update logic
    const existingUnsentInvoices = allExistingInvoices.filter(
      (inv) => inv.tuluv === "Төлөөгүй" || inv.tuluv === "Хугацаа хэтэрсэн",
    );

    if (override) {
      // If override=true, delete ALL existing invoices for this month
      for (const invoice of allExistingInvoices) {
        await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).deleteOne({
          _id: invoice._id,
        });
      }
    } else if (existingUnsentInvoices.length > 0) {
      // If override=false but there are unsent invoices, check if we need to update
      const oldestUnsentInvoice = existingUnsentInvoices[0];

      const hasPayments = invoiceHasPayments(oldestUnsentInvoice);

      // SMART UPDATE CHECK: Calculate what the new invoice WOULD look like
      // NOTE: previewInvoice includes ekhniiUldegdel, but we DON'T want to include it in manual send
      const previewResult = await previewInvoice(
        gereeId,
        baiguullagiinId,
        null,
        targetMonth,
        targetYear,
      );

      if (previewResult.success) {
        const previewZardluud = previewResult.preview.zardluud || [];
        const newZardluudOnly = previewZardluud.filter(
          isZardalExcludingEkhniiUldegdel,
        );
        const zardluudOnlyTotal = sumZardalDun(newZardluudOnly);

        const oldZardluud = oldestUnsentInvoice.medeelel?.zardluud || [];
        const oldZardluudOnly = oldZardluud.filter(
          isZardalExcludingEkhniiUldegdel,
        );
        const oldZardluudOnlyTotal = sumZardalDun(oldZardluudOnly);

        const newZardluudCount = newZardluudOnly.length;
        const oldZardluudCount = oldZardluudOnly.length;

        // If zardluud amounts are effectively equal and item counts match, skip update entirely
        if (
          Math.abs(zardluudOnlyTotal - oldZardluudOnlyTotal) < 0.5 &&
          newZardluudCount === oldZardluudCount
        ) {
          await deleteDuplicateUnsentInvoices(
            existingUnsentInvoices,
            tukhainBaaziinKholbolt,
          );
          return {
            success: true,
            message: "Нэхэмжлэх хэвийн байна. Өөрчлөлт ороогүй.",
            skipped: true,
            nekhemjlekh: oldestUnsentInvoice,
            gereeniiId: geree._id,
            gereeniiDugaar: geree.gereeniiDugaar,
            tulbur: oldestUnsentInvoice.niitTulbur,
          };
        }

        // Safety guard: if preview returned 0 non-ekhnii zardluud but old invoice
        // had some, the building config may be out of sync — preserve old zardluud
        // to avoid accidentally wiping invoice line items.
        if (newZardluudCount === 0 && oldZardluudCount > 0) {
          await deleteDuplicateUnsentInvoices(
            existingUnsentInvoices,
            tukhainBaaziinKholbolt,
          );
          return {
            success: true,
            message: "Нэхэмжлэх хэвийн байна. Өөрчлөлт ороогүй.",
            skipped: true,
            nekhemjlekh: oldestUnsentInvoice,
            gereeniiId: geree._id,
            gereeniiDugaar: geree.gereeniiDugaar,
            tulbur: oldestUnsentInvoice.niitTulbur,
          };
        }

        // Update in place: new zardluud (no ekhniiUldegdel) + preserved ekhniiUldegdel from old invoice
        const newZardluudWithoutEkhniiUldegdel = newZardluudOnly;
        const oldEkhniiUldegdelEntries = oldZardluud.filter(
          isEkhniiUldegdelEntry,
        );
        const updatedZardluud = [
          ...newZardluudWithoutEkhniiUldegdel,
          ...oldEkhniiUldegdelEntries,
        ];
        const newNiitTulbur = sumZardalDun(updatedZardluud);

        oldestUnsentInvoice.medeelel = {
          ...toPlainObject(oldestUnsentInvoice.medeelel),
          zardluud: updatedZardluud,
        };
        // Ensure original total is preserved
        if (typeof oldestUnsentInvoice.niitTulburOriginal !== "number") {
          oldestUnsentInvoice.niitTulburOriginal =
            oldestUnsentInvoice.niitTulbur;
        }

        oldestUnsentInvoice.niitTulbur = newNiitTulbur;

        // Recalculate uldegdel based on payments
        const totalPaid = (oldestUnsentInvoice.paymentHistory || []).reduce(
          (sum, p) => sum + (p.dun || 0),
          0,
        );
        if (totalPaid > 0) {
          oldestUnsentInvoice.uldegdel = Math.max(0, newNiitTulbur - totalPaid);
        } else {
          oldestUnsentInvoice.uldegdel = newNiitTulbur;
        }

        // IMPORTANT: Do NOT update tuluv until uldegdel or niitTulbur reaches 0.
        // tuluv stays "Төлөөгүй" on manual send updates unless fully paid.
        if (oldestUnsentInvoice.uldegdel <= 0.01 || newNiitTulbur <= 0.01) {
          oldestUnsentInvoice.tuluv = "Төлсөн";
        } else {
          oldestUnsentInvoice.tuluv = "Төлөөгүй";
        }
        // Flag to skip the pre-save hook from overriding tuluv
        oldestUnsentInvoice._skipTuluvRecalc = true;

        // Update zaalt metadata if available
        const zaaltEntry = newZardluudWithoutEkhniiUldegdel.find(
          (z) =>
            z.zaalt === true &&
            z.ner?.toLowerCase().includes("цахилгаан") &&
            !z.ner?.toLowerCase().includes("дундын"),
        );
        if (zaaltEntry) {
          oldestUnsentInvoice.medeelel = {
            ...toPlainObject(oldestUnsentInvoice.medeelel),
            zaalt: {
              ...(oldestUnsentInvoice.medeelel.zaalt || {}),
              zoruu: zaaltEntry.zoruu || 0,
              zaaltDun: zaaltEntry.dun || zaaltEntry.tariff || 0,
            },
          };
          oldestUnsentInvoice.tsahilgaanNekhemjlekh =
            zaaltEntry.dun ||
            zaaltEntry.tariff ||
            oldestUnsentInvoice.tsahilgaanNekhemjlekh;
        }

        // Mark medeelel as modified to ensure Mongoose saves the changes
        oldestUnsentInvoice.markModified("medeelel");

        await oldestUnsentInvoice.save();

        const oldNiitTulbur = sumZardalDun(oldZardluud);
        const delta = newNiitTulbur - oldNiitTulbur;
        if (Math.abs(delta) > 0.01) {
          try {
            await Geree(tukhainBaaziinKholbolt).findByIdAndUpdate(
              gereeId,
              { $inc: { globalUldegdel: delta } },
              { runValidators: false },
            );
          } catch (gereeErr) {
            // Error updating geree.globalUldegdel - silently continue
          }
        }

        await deleteDuplicateUnsentInvoices(
          existingUnsentInvoices,
          tukhainBaaziinKholbolt,
        );

        // Send socket notification so home header refreshes balance
        if (app && geree.orshinSuugchId) {
          try {
            const kholbolt = getKholboltByBaiguullagiinId(baiguullagiinId);
            if (kholbolt) {
              const medegdel = new Medegdel(kholbolt)();
              medegdel.orshinSuugchId = geree.orshinSuugchId;
              medegdel.baiguullagiinId = baiguullagiinId;
              medegdel.barilgiinId = geree.barilgiinId || "";
              medegdel.title = "Шинэ авлага нэмэгдлээ";
              medegdel.message = `Гэрээний дугаар: ${geree.gereeniiDugaar || "N/A"}, Нийт төлбөр: ${newNiitTulbur}₮`;
              medegdel.kharsanEsekh = false;
              medegdel.turul = "мэдэгдэл";
              medegdel.ognoo = new Date();
              await medegdel.save();
              const io = app.get("socketio");
              if (io)
                io.emit(
                  "orshinSuugch" + geree.orshinSuugchId,
                  toPlainObject(medegdel),
                );
            }
          } catch (notifErr) {
            // Error sending socket notification - silently continue
          }
        }

        return {
          success: true,
          nekhemjlekh: oldestUnsentInvoice,
          gereeniiId: geree._id,
          gereeniiDugaar: geree.gereeniiDugaar,
          tulbur: newNiitTulbur,
          alreadyExists: true,
          updated: true,
          preservedPayments: hasPayments,
        };
      }

      // If preview failed, just return the existing invoice without changes
      return {
        success: true,
        nekhemjlekh: oldestUnsentInvoice,
        gereeniiId: geree._id,
        gereeniiDugaar: geree.gereeniiDugaar,
        tulbur: oldestUnsentInvoice.niitTulbur,
        alreadyExists: true,
      };
    }

    // includeEkhniiUldegdel = false: manual send must not add ekhniiUldegdel (Excel/TransactionModal only)
    const result = await gereeNeesNekhemjlekhUusgekh(
      geree,
      baiguullaga,
      tukhainBaaziinKholbolt,
      "manual",
      false, // includeEkhniiUldegdel = false on manual send
    );

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const manualSendMassInvoices = async (
  baiguullagiinId,
  barilgiinId = null,
  override = false,
  targetMonth = null,
  targetYear = null,
  app = null,
) => {
  try {
    const tukhainBaaziinKholbolt =
      getKholboltByBaiguullagiinId(baiguullagiinId);

    if (!tukhainBaaziinKholbolt) {
      return { success: false, error: "Холболтын мэдээлэл олдсонгүй!" };
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt)
      .findById(baiguullagiinId)
      .lean();
    if (!baiguullaga) {
      return { success: false, error: "Байгууллага олдсонгүй!" };
    }

    const gereeQuery = {
      baiguullagiinId: String(baiguullagiinId),
      tuluv: "Идэвхтэй",
    };

    if (barilgiinId) {
      gereeQuery.barilgiinId = String(barilgiinId);
    }

    const gerees = await Geree(tukhainBaaziinKholbolt).find(gereeQuery).lean();

    const results = {
      success: true,
      total: gerees.length,
      created: 0,
      errors: 0,
      invoices: [],
      errorsList: [],
    };

    for (let i = 0; i < gerees.length; i++) {
      const geree = gerees[i];
      try {
        const invoiceResult = await manualSendInvoice(
          geree._id,
          baiguullagiinId,
          override,
          targetMonth,
          targetYear,
          app,
        );

        if (invoiceResult.success) {
          results.created++;
          results.invoices.push({
            gereeniiDugaar: geree.gereeniiDugaar,
            nekhemjlekhiinId:
              invoiceResult.nekhemjlekh?._id || invoiceResult.nekhemjlekh,
            tulbur: invoiceResult.tulbur,
          });
        } else {
          results.errors++;
          results.errorsList.push({
            gereeniiDugaar: geree.gereeniiDugaar,
            error: invoiceResult.error || "Unknown error",
          });
        }
      } catch (error) {
        results.errors++;
        results.errorsList.push({
          gereeniiDugaar: geree.gereeniiDugaar,
          error: error.message || "Unknown error",
        });
      }
    }

    return results;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Manual send invoices for selected/checked contracts
// Accepts array of gereeIds (can be one or many)
const manualSendSelectedInvoices = async (
  gereeIds,
  baiguullagiinId,
  override = false,
  targetMonth = null,
  targetYear = null,
  app = null,
) => {
  try {
    if (!Array.isArray(gereeIds) || gereeIds.length === 0) {
      return {
        success: false,
        error: "gereeIds нь хоосон биш массив байх ёстой!",
      };
    }

    const tukhainBaaziinKholbolt =
      getKholboltByBaiguullagiinId(baiguullagiinId);

    if (!tukhainBaaziinKholbolt) {
      return { success: false, error: "Холболтын мэдээлэл олдсонгүй!" };
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt)
      .findById(baiguullagiinId)
      .lean();
    if (!baiguullaga) {
      return { success: false, error: "Байгууллага олдсонгүй!" };
    }

    // Fetch all selected contracts
    const gerees = await Geree(tukhainBaaziinKholbolt)
      .find({
        _id: { $in: gereeIds },
        baiguullagiinId: String(baiguullagiinId),
      })
      .lean();

    if (gerees.length === 0) {
      return { success: false, error: "Сонгосон гэрээ олдсонгүй!" };
    }

    const results = {
      success: true,
      total: gereeIds.length,
      processed: gerees.length,
      created: 0,
      errors: 0,
      invoices: [],
      errorsList: [],
    };

    // Process each checked contract
    for (let i = 0; i < gerees.length; i++) {
      const geree = gerees[i];
      try {
        const invoiceResult = await manualSendInvoice(
          geree._id,
          baiguullagiinId,
          override,
          targetMonth,
          targetYear,
          app,
        );

        if (invoiceResult.success) {
          results.created++;
          results.invoices.push({
            gereeniiId: geree._id,
            gereeniiDugaar: geree.gereeniiDugaar,
            nekhemjlekhiinId:
              invoiceResult.nekhemjlekh?._id || invoiceResult.nekhemjlekh,
            tulbur: invoiceResult.tulbur,
          });
        } else {
          results.errors++;
          results.errorsList.push({
            gereeniiId: geree._id,
            gereeniiDugaar: geree.gereeniiDugaar,
            error: invoiceResult.error || "Unknown error",
          });
        }
      } catch (error) {
        results.errors++;
        results.errorsList.push({
          gereeniiId: geree._id,
          gereeniiDugaar: geree.gereeniiDugaar,
          error: error.message || "Unknown error",
        });
      }
    }

    return results;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = {
  manualSendInvoice,
  manualSendMassInvoices,
  manualSendSelectedInvoices,
};

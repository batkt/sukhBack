const { db } = require("zevbackv2");
const Geree = require("../models/geree");
const Baiguullaga = require("../models/baiguullaga");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const Medegdel = require("../models/medegdel");
const NekhemjlekhCron = require("../models/cronSchedule");
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

    // Determine the start of the check period based on the scheduled day
    let monthStart;
    try {
      const { getCronScheduleForGeree } = require("./invoiceCreationService");
      const cronSchedule = await getCronScheduleForGeree(
        tukhainBaaziinKholbolt,
        geree,
        baiguullaga,
      );

      if (cronSchedule && cronSchedule.nekhemjlekhUusgekhOgnoo) {
        const scheduledDay = cronSchedule.nekhemjlekhUusgekhOgnoo;
        if (currentDate.getDate() >= scheduledDay) {
          monthStart = new Date(
            currentYear,
            currentMonth,
            scheduledDay,
            0,
            0,
            0,
            0,
          );
        } else {
          let prevMonth = currentMonth - 1;
          let prevYear = currentYear;
          if (prevMonth < 0) {
            prevMonth = 11;
            prevYear -= 1;
          }
          monthStart = new Date(prevYear, prevMonth, scheduledDay, 0, 0, 0, 0);
        }
      } else {
        monthStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      }
    } catch (err) {
      monthStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    }

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

    // We want to identify any existing invoice for this period to potentially update it
    // instead of creating a new one. Includes all statuses to prevent duplicates.
    const invoicesToUpdate = allExistingInvoices;

    if (override) {
      // If override=true, delete ALL existing invoices for this month
      for (const invoice of allExistingInvoices) {
        await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).deleteOne({
          _id: invoice._id,
        });
      }
    } else if (invoicesToUpdate.length > 0) {
      // If override=false but there are already invoices, check if we need to update
      const invoiceToSync = invoicesToUpdate[0];

      const hasPayments = invoiceHasPayments(invoiceToSync);

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

        const oldZardluud = invoiceToSync.medeelel?.zardluud || [];
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
            invoicesToUpdate,
            tukhainBaaziinKholbolt,
          );
          return {
            success: true,
            message: "Нэхэмжлэх хэвийн байна. Өөрчлөлт ороогүй.",
            skipped: true,
            nekhemjlekh: invoiceToSync,
            gereeniiId: geree._id,
            gereeniiDugaar: geree.gereeniiDugaar,
            tulbur: invoiceToSync.niitTulbur,
          };
        }

        // Safety guard: if preview returned 0 non-ekhnii zardluud but old invoice
        // had some, the building config may be out of sync — preserve old zardluud
        // to avoid accidentally wiping invoice line items.
        if (newZardluudCount === 0 && oldZardluudCount > 0) {
          await deleteDuplicateUnsentInvoices(
            invoicesToUpdate,
            tukhainBaaziinKholbolt,
          );
          return {
            success: true,
            message: "Нэхэмжлэх хэвийн байна. Өөрчлөлт ороогүй.",
            skipped: true,
            nekhemjlekh: invoiceToSync,
            gereeniiId: geree._id,
            gereeniiDugaar: geree.gereeniiDugaar,
            tulbur: invoiceToSync.niitTulbur,
          };
        }

        // Update in place: new zardluud (no ekhniiUldegdel)
        const updatedZardluud = [
          ...newZardluudOnly,
        ];
        const newNiitTulbur = sumZardalDun(updatedZardluud);

        invoiceToSync.medeelel = {
          ...toPlainObject(invoiceToSync.medeelel),
          zardluud: updatedZardluud,
        };
        // Ensure original total is preserved
        if (typeof invoiceToSync.niitTulburOriginal !== "number") {
          invoiceToSync.niitTulburOriginal =
            invoiceToSync.niitTulbur;
        }

        invoiceToSync.niitTulbur = newNiitTulbur;

        // Recalculate uldegdel based on payments
        const totalPaid = (invoiceToSync.paymentHistory || []).reduce(
          (sum, p) => sum + (p.dun || 0),
          0,
        );
        if (totalPaid > 0) {
          invoiceToSync.uldegdel = Math.max(0, newNiitTulbur - totalPaid);
        } else {
          invoiceToSync.uldegdel = newNiitTulbur;
        }

        // IMPORTANT: Do NOT update tuluv until uldegdel or niitTulbur reaches 0.
        // tuluv stays "Төлөөгүй" on manual send updates unless fully paid.
        if (invoiceToSync.uldegdel <= 0.01 || newNiitTulbur <= 0.01) {
          invoiceToSync.tuluv = "Төлсөн";
        } else {
          invoiceToSync.tuluv = "Төлөөгүй";
        }
        // Flag to skip the pre-save hook from overriding tuluv
        invoiceToSync._skipTuluvRecalc = true;

        // Update zaalt metadata if available
        const zaaltEntry = updatedZardluud.find(
          (z) =>
            z.zaalt === true &&
            z.ner?.toLowerCase().includes("цахилгаан") &&
            !z.ner?.toLowerCase().includes("дундын"),
        );
        if (zaaltEntry) {
          invoiceToSync.medeelel = {
            ...toPlainObject(invoiceToSync.medeelel),
            zaalt: {
              ...(invoiceToSync.medeelel.zaalt || {}),
              zoruu: zaaltEntry.zoruu || 0,
              zaaltDun: zaaltEntry.dun || zaaltEntry.tariff || 0,
            },
          };
          invoiceToSync.tsahilgaanNekhemjlekh =
            zaaltEntry.dun ||
            zaaltEntry.tariff ||
            invoiceToSync.tsahilgaanNekhemjlekh;
        }

        // Mark medeelel as modified to ensure Mongoose saves the changes
        invoiceToSync.markModified("medeelel");

        await invoiceToSync.save();

        const delta = newNiitTulbur - oldZardluudOnlyTotal;
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
          invoicesToUpdate,
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
          nekhemjlekh: invoiceToSync,
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
        nekhemjlekh: invoiceToSync,
        gereeniiId: geree._id,
        gereeniiDugaar: geree.gereeniiDugaar,
        tulbur: invoiceToSync.niitTulbur,
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

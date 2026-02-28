const { db } = require("zevbackv2");
const Geree = require("../models/geree");
const Baiguullaga = require("../models/baiguullaga");
const OrshinSuugch = require("../models/orshinSuugch");
const NekhemjlekhCron = require("../models/cronSchedule");
const { getKholboltByBaiguullagiinId } = require("../utils/dbConnection");
const {
  normalizeZardluudTurul,
  sumZardalDun,
} = require("../utils/zardalUtils");
const previewInvoice = async (
  gereeId,
  baiguullagiinId,
  barilgiinId,
  targetMonth = null,
  targetYear = null,
) => {
  try {
    const tukhainBaaziinKholbolt =
      getKholboltByBaiguullagiinId(baiguullagiinId);

    if (!tukhainBaaziinKholbolt) {
      return {
        success: false,
        error: `Холболтын мэдээлэл олдсонгүй! (baiguullagiinId: ${baiguullagiinId})`,
      };
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

    const targetBarilga = baiguullaga?.barilguud?.find(
      (b) => String(b._id) === String(barilgiinId || geree.barilgiinId || ""),
    );

    let ashiglaltiinZardluud =
      targetBarilga?.tokhirgoo?.ashiglaltiinZardluud || [];

    // Fallback: if building config has no ashiglaltiinZardluud, use geree.zardluud
    // (ashiglaltiinZardluud may be stored in the standalone collection and synced
    // to geree.zardluud but not to baiguullaga embedded array)
    if (ashiglaltiinZardluud.length === 0 && geree.zardluud && geree.zardluud.length > 0) {
      ashiglaltiinZardluud = geree.zardluud;
    }

    let filteredZardluud = ashiglaltiinZardluud
      .filter((zardal) => zardal.zaalt !== true)
      .map((zardal) => {
        const dun = zardal.dun > 0 ? zardal.dun : zardal.tariff || 0;
        return { ...zardal, dun: dun };
      });

    filteredZardluud = normalizeZardluudTurul(filteredZardluud);

    let choloolugdokhDavkhar = [];
    let liftTariff = null;

    if (geree.davkhar && geree.barilgiinId && geree.baiguullagiinId) {
      choloolugdokhDavkhar =
        targetBarilga?.tokhirgoo?.liftShalgaya?.choloolugdokhDavkhar || [];

      const liftZardalFromBuilding =
        targetBarilga?.tokhirgoo?.ashiglaltiinZardluud?.find(
          (z) =>
            z.zardliinTurul === "Лифт" || (z.ner && z.ner.includes("Лифт")),
        );
      if (liftZardalFromBuilding) {
        liftTariff =
          liftZardalFromBuilding.tariff || liftZardalFromBuilding.dun;
      }

      if (choloolugdokhDavkhar.length === 0 && geree.barilgiinId) {
        try {
          const LiftShalgaya = require("../models/liftShalgaya");
          const liftShalgayaRecord = await LiftShalgaya(tukhainBaaziinKholbolt)
            .findOne({
              baiguullagiinId: String(geree.baiguullagiinId),
              barilgiinId: String(geree.barilgiinId),
            })
            .lean();

          if (
            liftShalgayaRecord?.choloolugdokhDavkhar &&
            liftShalgayaRecord.choloolugdokhDavkhar.length > 0
          ) {
            choloolugdokhDavkhar = liftShalgayaRecord.choloolugdokhDavkhar;
          }
        } catch (error) {
          // Error fetching liftShalgaya - silently continue
        }
      }

      const davkharStr = String(geree.davkhar);
      const choloolugdokhDavkharStr = choloolugdokhDavkhar.map((d) =>
        String(d),
      );

      if (choloolugdokhDavkharStr.includes(davkharStr)) {
        filteredZardluud = filteredZardluud.filter(
          (zardal) =>
            zardal.zardliinTurul !== "Лифт" &&
            !(zardal.ner && zardal.ner.trim() === "Лифт") &&
            !(zardal.ner && zardal.ner.includes("Лифт")) &&
            !(
              liftTariff !== null &&
              (zardal.dun === liftTariff || zardal.tariff === liftTariff)
            ),
        );
      }
    }

    let ekhniiUldegdelAmount = 0;
    let ekhniiUldegdelTailbar = ""; // Store the description from gereeniiTulukhAvlaga

    // First check gereeniiTulukhAvlaga for ekhniiUldegdel records (primary source)
    try {
      const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");
      const tulukhAvlagaRecords = await GereeniiTulukhAvlaga(
        tukhainBaaziinKholbolt,
      )
        .find({
          gereeniiId: String(gereeId),
          baiguullagiinId: String(baiguullagiinId),
          ekhniiUldegdelEsekh: true,
        })
        .lean();

      if (tulukhAvlagaRecords && tulukhAvlagaRecords.length > 0) {
        // Sum up all ekhniiUldegdel records using undsenDun (original amount before payments)
        // The preview should show the original charged amount, not the remaining balance
        ekhniiUldegdelAmount = tulukhAvlagaRecords.reduce((sum, record) => {
          // Use undsenDun (original amount) - this shows what was originally charged
          const amount = Number(
            record.undsenDun ?? record.tulukhDun ?? record.uldegdel ?? 0,
          );
          return sum + amount;
        }, 0);

        // Get the tailbar (description) from the first record
        const firstRecord = tulukhAvlagaRecords[0];
        ekhniiUldegdelTailbar =
          firstRecord.tailbar || firstRecord.temdeglel || "";
      }
    } catch (error) {
      // Error fetching ekhniiUldegdel from gereeniiTulukhAvlaga - silently continue
    }

    // Fallback to orshinSuugch.ekhniiUldegdel if no gereeniiTulukhAvlaga records found
    if (ekhniiUldegdelAmount === 0 && geree.orshinSuugchId) {
      try {
        const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
          .findById(geree.orshinSuugchId)
          .select("ekhniiUldegdel")
          .lean();
        if (orshinSuugch && orshinSuugch.ekhniiUldegdel) {
          ekhniiUldegdelAmount = orshinSuugch.ekhniiUldegdel;
        }
      } catch (error) {
        // Error fetching ekhniiUldegdel from orshinSuugch - silently continue
      }
    }

    let zardluudWithDun = filteredZardluud.map((zardal) => {
      if (zardal.zaalt === true) return zardal;
      const dun = zardal.dun > 0 ? zardal.dun : zardal.tariff || 0;
      const result = {
        ...zardal,
        dun: dun,
        zardliinTurul: zardal.zardliinTurul || "Энгийн",
      };
      if (result.dun === 0 && result.tariff > 0) {
        result.dun = result.tariff;
      }
      return result;
    });

    // Add electricity (zaalt) entries for preview - process ALL zaalt zardals
    // Combine both contract-level and building-level electricity expenses
    try {
      // Helper to check if an expense is a VARIABLE electricity charge (meter-based)
      // "Дундын өмчлөл Цахилгаан" is FIXED - should NOT be processed as zaalt
      // Only "Цахилгаан" (without "дундын" or "өмчлөл") should be processed as zaalt
      const isVariableElectricity = (z) => {
        if (!z.zaalt) return false;
        const nameLower = (z.ner || "").toLowerCase();
        // Exclude fixed electricity charges from zaalt processing
        if (nameLower.includes("дундын") || nameLower.includes("өмчлөл")) {
          return false;
        }
        return true;
      };

      const gereeZaaltZardluud = (geree.zardluud || []).filter(
        isVariableElectricity,
      );
      const buildingZaaltZardluud = ashiglaltiinZardluud.filter(
        isVariableElectricity,
      );

      // Combine both sources, then deduplicate by name (contract entries take priority)
      const combinedZaalt = [...gereeZaaltZardluud, ...buildingZaaltZardluud];
      const seenNames = new Set();
      const zaaltZardluud = combinedZaalt.filter((z) => {
        const key = z.ner || z.zardliinTurul || "Цахилгаан";
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      });

      if (zaaltZardluud.length > 0) {
        const ZaaltUnshlalt = require("../models/zaaltUnshlalt");
        let zaaltTariff = 0;

        // Try to get tariff from orshinSuugch first (for calculated electricity)
        if (geree.orshinSuugchId) {
          const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
            .findById(geree.orshinSuugchId)
            .select("tsahilgaaniiZaalt")
            .lean();
          zaaltTariff = Number(orshinSuugch?.tsahilgaaniiZaalt) || 0;
        }

        // Get latest reading for this geree (for calculated electricity)
        let latestReading = null;
        try {
          latestReading = await ZaaltUnshlalt(tukhainBaaziinKholbolt)
            .findOne({
              $or: [
                { gereeniiId: String(gereeId) },
                { gereeniiDugaar: geree.gereeniiDugaar },
              ],
            })
            .sort({ importOgnoo: -1, "zaaltCalculation.calculatedAt": -1 })
            .lean();
        } catch (e) {
          // Error finding zaalt readings - silently continue
        }

        // Process each electricity zardal
        for (const zaaltZardal of zaaltZardluud) {
          let electricityDun = 0;
          let zoruu = 0;
          let defaultDun = 0;
          let kwhTariff = zaaltTariff; // from orshinSuugch

          // Variable electricity = zaalt + цахилгаан (not дундын өмчлөл) - needs Excel, don't show suuriKhuraamj alone
          const pvNameLower = (zaaltZardal.ner || "").toLowerCase();
          const pvIsVariableElectricity =
            zaaltZardal.zaalt &&
            pvNameLower.includes("цахилгаан") &&
            !pvNameLower.includes("дундын") &&
            !pvNameLower.includes("өмчлөл");

          // For variable цахилгаан: when no Excel reading, skip - match Excel behavior
          if (pvIsVariableElectricity && !latestReading) {
            continue;
          }

          // Determine if this is a FIXED or CALCULATED electricity charge:
          // FIXED: tariffUsgeer = "₮" -> use tariff directly as the total amount
          // CALCULATED: tariffUsgeer = "кВт" -> tariff is kWh rate, suuriKhuraamj is base fee from Excel
          //
          // Key distinction:
          // - "Дундын өмчлөл Цахилгаан": tariffUsgeer="₮", tariff=6883.44 -> FIXED
          // - "Цахилгаан": tariffUsgeer="кВт", tariff=kWh rate, suuriKhuraamj=Excel imported -> CALCULATED

          // If tariffUsgeer is "кВт", it's ALWAYS a calculated type (per-kWh billing)
          const isCalculatedType = zaaltZardal.tariffUsgeer === "кВт";

          if (!isCalculatedType) {
            // FIXED electricity charge - use tariff directly
            electricityDun = zaaltZardal.tariff || zaaltZardal.dun || 0;
          } else {
            // CALCULATED electricity charge
            // For calculated: tariff = кВт rate, suuriKhuraamj = base fee
            if (!kwhTariff || kwhTariff === 0) {
              kwhTariff = zaaltZardal.tariff || 0;
            }

            if (latestReading) {
              // Get all calculation data from Excel reading
              defaultDun =
                latestReading.zaaltCalculation?.defaultDun ||
                latestReading.defaultDun ||
                0;
              zoruu =
                latestReading.zoruu ||
                latestReading.zaaltCalculation?.zoruu ||
                0;

              // Get tariff from Excel reading (kWh rate used during import)
              const readingTariff =
                latestReading.zaaltCalculation?.tariff ||
                latestReading.tariff ||
                0;

              // Use the pre-calculated zaaltDun from Excel if available
              if (latestReading.zaaltDun > 0) {
                electricityDun = latestReading.zaaltDun;
              } else {
                // Recalculate if no zaaltDun stored
                if (readingTariff > 0) {
                  kwhTariff = readingTariff;
                }
                electricityDun = zoruu * kwhTariff + defaultDun;
              }
            } else {
              // For цахилгаан (кВт): do NOT show suuriKhuraamj when no Excel - match Excel behavior
              if (zoruu === 0) {
                continue;
              }
              // Fallback to zardal's suuriKhuraamj, zaaltDefaultDun, or tariff (for old data format)
              defaultDun =
                Number(zaaltZardal.suuriKhuraamj) ||
                zaaltZardal.zaaltDefaultDun ||
                zaaltZardal.tariff ||
                0;
              electricityDun = zoruu * kwhTariff + defaultDun;
            }

            // For calculated цахилгаан: do NOT show suuriKhuraamj alone when no Excel
            if (electricityDun === 0 && zoruu === 0) {
              const wouldUseSuuriKhuraamj =
                Number(zaaltZardal.suuriKhuraamj) ||
                zaaltZardal.zaaltDefaultDun ||
                zaaltZardal.tariff ||
                0;
              if (wouldUseSuuriKhuraamj > 0) {
                continue;
              }
            }
            // Final fallback: if electricityDun is still 0 but zardal has suuriKhuraamj, use that
            if (electricityDun === 0) {
              const fallbackDun =
                Number(zaaltZardal.suuriKhuraamj) ||
                zaaltZardal.zaaltDefaultDun ||
                zaaltZardal.tariff ||
                0;
              if (fallbackDun > 0) {
                electricityDun = fallbackDun;
                defaultDun = fallbackDun;
              }
            }
          }

          if (electricityDun > 0) {
            zardluudWithDun.push({
              ner: zaaltZardal.ner || "Цахилгаан",
              turul: zaaltZardal.turul || "Тогтмол",
              bodokhArga: "тогтмол",
              zardliinTurul: zaaltZardal.zardliinTurul || "Цахилгаан",
              tariff: electricityDun,
              tariffUsgeer: !isCalculatedType
                ? zaaltZardal.tariffUsgeer || "₮"
                : "₮",
              dun: electricityDun,
              zaalt: true,
              zaaltTariff: isCalculatedType ? kwhTariff : 0,
              zoruu: zoruu,
              suuriKhuraamj: defaultDun,
              ognoonuud: [],
            });
          }
        }
      }
    } catch (error) {
      // Error calculating electricity for preview - silently continue
    }

    const zardluudTotal = sumZardalDun(zardluudWithDun);

    // Always add ekhniiUldegdel row (even when 0) for display purposes
    zardluudWithDun.push({
      ner: "Эхний үлдэгдэл",
      turul: "Тогтмол",
      bodokhArga: "тогтмол",
      zardliinTurul: "Энгийн",
      tariff: ekhniiUldegdelAmount,
      tariffUsgeer: "₮",
      dun: ekhniiUldegdelAmount,
      zaalt: false,
      ognoonuud: [],
      nuatNemekhEsekh: false,
      nuatBodokhEsekh: false,
      tseverUsDun: 0,
      bokhirUsDun: 0,
      usKhalaasniiDun: 0,
      tsakhilgaanUrjver: 1,
      tsakhilgaanChadal: 0,
      tsakhilgaanDemjikh: 0,
      suuriKhuraamj: 0,
      togtmolUtga: 0,
      choloolugdsonDavkhar: false,
      isEkhniiUldegdel: true, // Flag to identify this row
      tailbar: ekhniiUldegdelTailbar || "", // Include the description from gereeniiTulukhAvlaga
    });

    const finalNiitTulbur = zardluudTotal + ekhniiUldegdelAmount;

    let tulukhOgnoo = null;
    try {
      let cronSchedule = await NekhemjlekhCron(tukhainBaaziinKholbolt).findOne({
        baiguullagiinId: String(baiguullagiinId),
        barilgiinId: barilgiinId ? String(barilgiinId) : null,
      });

      if (!cronSchedule) {
        cronSchedule = await NekhemjlekhCron(tukhainBaaziinKholbolt).findOne({
          baiguullagiinId: String(baiguullagiinId),
          barilgiinId: null,
        });
      }

      if (cronSchedule && cronSchedule.nekhemjlekhUusgekhOgnoo) {
        const today = new Date();
        const scheduledDay = cronSchedule.nekhemjlekhUusgekhOgnoo;
        let nextMonth = currentMonth + 1;
        let nextYear = currentYear;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear = currentYear + 1;
        }
        const lastDayOfNextMonth = new Date(
          nextYear,
          nextMonth + 1,
          0,
        ).getDate();
        const dayToUse = Math.min(scheduledDay, lastDayOfNextMonth);
        tulukhOgnoo = new Date(nextYear, nextMonth, dayToUse, 0, 0, 0, 0);
      }
    } catch (error) {
      // Error fetching cron schedule - silently continue
    }

    if (!tulukhOgnoo) {
      tulukhOgnoo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

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

    const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
    const existingInvoice = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)
      .findOne({
        gereeniiId: String(gereeId),
        $or: [
          { ognoo: { $gte: monthStart, $lte: monthEnd } },
          { createdAt: { $gte: monthStart, $lte: monthEnd } },
        ],
      })
      .lean();

    const sohNer = targetBarilga?.tokhirgoo?.sohNer || "";
    const orgUtas = Array.isArray(baiguullaga?.utas)
      ? baiguullaga.utas[0]
      : baiguullaga?.utas || "";
    const dansInfo =
      [baiguullaga?.bankniiNer, baiguullaga?.dans].filter(Boolean).join(" ") ||
      "";

    console.log(
      "[NEKHEMJLEKH] previewInvoice success",
      gereeId,
      finalNiitTulbur,
    );
    return {
      success: true,
      preview: {
        gereeniiDugaar: geree.gereeniiDugaar,
        gereeniiId: geree._id,
        ner: geree.ner,
        ovog: geree.ovog,
        utas: geree.utas,
        davkhar: geree.davkhar,
        toot: geree.toot,
        orts: geree.orts,
        sohNer: sohNer || baiguullaga?.ner,
        baiguullagiinNer: baiguullaga?.ner,
        baiguullagiinUtas: orgUtas,
        baiguullagiinKhayag: baiguullaga?.khayag,
        dansniiMedeelel: dansInfo,
        zardluud: zardluudWithDun,
        zardluudTotal: zardluudTotal,
        ekhniiUldegdel: ekhniiUldegdelAmount,
        niitTulbur: finalNiitTulbur,
        tulukhOgnoo: tulukhOgnoo,
        ognoo: new Date(),
        existingInvoice: existingInvoice
          ? {
              _id: existingInvoice._id,
              nekhemjlekhiinDugaar: existingInvoice.nekhemjlekhiinDugaar,
              niitTulbur: existingInvoice.niitTulbur,
              tuluv: existingInvoice.tuluv,
              ognoo: existingInvoice.ognoo,
            }
          : null,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = { previewInvoice };

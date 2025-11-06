const asyncHandler = require("express-async-handler");
const GereeniiZagvar = require("../models/gereeniiZagvar");
const Geree = require("../models/geree");
const OrshinSuugch = require("../models/orshinSuugch");

// Helper function to get value from geree or orshinSuugch based on tag type
function getVariableValue(tagType, geree, orshinSuugch) {
  // Format date to Mongolian format (YYYY оны MM сарын DD)
  function formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year} оны ${month} сарын ${day}`;
  }

  // Format date to simple format (YYYY-MM-DD)
  function formatDateSimple(date) {
    if (!date) return "";
    return new Date(date).toISOString().split("T")[0];
  }

  // Format number to currency
  function formatCurrency(amount) {
    if (!amount) return "0";
    return Number(amount).toLocaleString("mn-MN");
  }

  // Handle arrays (like utas)
  function formatArray(arr) {
    if (!arr) return "";
    if (Array.isArray(arr)) {
      return arr.join(", ");
    }
    return String(arr);
  }

  // Handle nested objects (like horoo)
  function formatObject(obj) {
    if (!obj) return "";
    if (typeof obj === "object" && obj.ner) {
      return obj.ner;
    }
    return String(obj);
  }

  // Check geree first, then orshinSuugch
  let value = null;

  // Direct geree fields
  if (geree && geree[tagType] !== undefined && geree[tagType] !== null) {
    value = geree[tagType];
  }
  // Direct orshinSuugch fields
  else if (
    orshinSuugch &&
    orshinSuugch[tagType] !== undefined &&
    orshinSuugch[tagType] !== null
  ) {
    value = orshinSuugch[tagType];
  }
  // Nested properties (e.g., "horoo.ner")
  else if (tagType.includes(".")) {
    const parts = tagType.split(".");
    let source = geree || orshinSuugch;
    for (const part of parts) {
      if (source && source[part] !== undefined) {
        source = source[part];
      } else {
        source = null;
        break;
      }
    }
    value = source;
  }

  // Format the value based on type
  if (value === null || value === undefined) {
    return "";
  }

  // Date formatting
  if (tagType.includes("Ognoo") || tagType.includes("ognoo")) {
    return formatDate(value);
  }

  // Array formatting
  if (Array.isArray(value)) {
    return formatArray(value);
  }

  // Object formatting
  if (typeof value === "object" && value !== null) {
    return formatObject(value);
  }

  // Number formatting for currency fields
  if (
    tagType.includes("Tulbur") ||
    tagType.includes("Zardal") ||
    tagType.includes("Dun")
  ) {
    return formatCurrency(value);
  }

  return String(value);
}

// Main function to replace data-tag-type variables in HTML
function replaceTemplateVariables(htmlContent, geree, orshinSuugch) {
  if (!htmlContent) return "";

  // Regular expression to match <span data-tag-type="variableName" class="custom-tag"></span>
  const tagRegex =
    /<span\s+data-tag-type="([^"]+)"\s+class="custom-tag"><\/span>/g;

  return htmlContent.replace(tagRegex, (match, tagType) => {
    const value = getVariableValue(tagType.trim(), geree, orshinSuugch);
    return value || ""; // Return empty string if value not found
  });
}

// Unified endpoint to get processed contract template(s)
// Can handle single geree or multiple geree based on request
exports.gereeniiZagvarSoliyo = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const {
      gereeniiZagvariinId,
      gereeniiId, // Single geree ID (optional)
      baiguullagiinId, // For multiple geree
      barilgiinId, // Optional filter for multiple geree
    } = req.body;

    // Determine if single or multiple geree request
    const isSingleGeree = !!gereeniiId;
    const isMultipleGeree = !!baiguullagiinId && !gereeniiId;

    if (!gereeniiZagvariinId) {
      return res.status(400).json({
        success: false,
        message: "Гэрээний загварын ID заавал бөглөх шаардлагатай!",
      });
    }

    if (!isSingleGeree && !isMultipleGeree) {
      return res.status(400).json({
        success: false,
        message:
          "Гэрээний ID эсвэл Байгууллагын ID заавал бөглөх шаардлагатай!",
      });
    }

    // Get connection
    let kholbolt = null;
    let finalBaiguullagiinId = baiguullagiinId;

    if (isSingleGeree) {
      // For single geree, find connection by searching for geree
      if (!finalBaiguullagiinId) {
        for (const conn of db.kholboltuud) {
          try {
            const tempGeree = await Geree(conn).findById(gereeniiId);
            if (tempGeree) {
              finalBaiguullagiinId = tempGeree.baiguullagiinId;
              kholbolt = conn;
              break;
            }
          } catch (e) {
            // Continue searching
          }
        }
      } else {
        kholbolt = db.kholboltuud.find(
          (k) => String(k.baiguullagiinId) === String(finalBaiguullagiinId)
        );
      }
    } else {
      // For multiple geree, use provided baiguullagiinId
      kholbolt = db.kholboltuud.find(
        (k) => String(k.baiguullagiinId) === String(finalBaiguullagiinId)
      );
    }

    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй!",
      });
    }

    // Get template
    const zagvar = await GereeniiZagvar(kholbolt).findById(
      gereeniiZagvariinId
    );

    if (!zagvar) {
      return res.status(404).json({
        success: false,
        message: "Гэрээний загвар олдсонгүй!",
      });
    }

    // Helper function to process a single geree
    const processGeree = async (geree) => {
      // Get orshinSuugch if orshinSuugchId exists
      let orshinSuugch = null;
      if (geree.orshinSuugchId) {
        orshinSuugch = await OrshinSuugch(kholbolt).findById(
          geree.orshinSuugchId
        );
      }

      // Process all template fields
      return {
        aguulga: replaceTemplateVariables(
          zagvar.aguulga || "",
          geree,
          orshinSuugch
        ),
        tolgoi: replaceTemplateVariables(
          zagvar.tolgoi || "",
          geree,
          orshinSuugch
        ),
        baruunTolgoi: replaceTemplateVariables(
          zagvar.baruunTolgoi || "",
          geree,
          orshinSuugch
        ),
        zuunTolgoi: replaceTemplateVariables(
          zagvar.zuunTolgoi || "",
          geree,
          orshinSuugch
        ),
        baruunKhul: replaceTemplateVariables(
          zagvar.baruunKhul || "",
          geree,
          orshinSuugch
        ),
        zuunKhul: replaceTemplateVariables(
          zagvar.zuunKhul || "",
          geree,
          orshinSuugch
        ),
      };
    };

    if (isSingleGeree) {
      // Single geree processing
      const geree = await Geree(kholbolt).findById(gereeniiId);

      if (!geree) {
        return res.status(404).json({
          success: false,
          message: "Гэрээ олдсонгүй!",
        });
      }

      const processedTemplate = await processGeree(geree);

      res.json({
        success: true,
        message: "Гэрээний загвар боловсруулагдлаа",
        result: {
          _id: zagvar._id,
          ner: zagvar.ner,
          tailbar: zagvar.tailbar,
          ...processedTemplate,
          turul: zagvar.turul,
          dedKhesguud: zagvar.dedKhesguud || [],
          geree: {
            _id: geree._id,
            gereeniiDugaar: geree.gereeniiDugaar,
            gereeniiOgnoo: geree.gereeniiOgnoo,
            ner: geree.ner,
            ovog: geree.ovog,
            utas: geree.utas,
            toot: geree.toot,
            davkhar: geree.davkhar,
          },
        },
      });
    } else {
      // Multiple geree processing (for list view with eye icon)
      // Build query for geree
      const gereeQuery = {
        baiguullagiinId: finalBaiguullagiinId,
      };

      if (barilgiinId) {
        gereeQuery.barilgiinId = barilgiinId;
      }

      // Get all geree
      const gereenuud = await Geree(kholbolt).find(gereeQuery).sort({
        createdAt: -1,
      });

      // Get all orshinSuugch IDs to fetch in batch
      const orshinSuugchIds = gereenuud
        .map((g) => g.orshinSuugchId)
        .filter((id) => id);

      // Fetch all orshinSuugch in one query
      const orshinSuugchuud = await OrshinSuugch(kholbolt).find({
        _id: { $in: orshinSuugchIds },
      });

      // Create a map for quick lookup
      const orshinSuugchMap = new Map();
      orshinSuugchuud.forEach((os) => {
        orshinSuugchMap.set(String(os._id), os);
      });

      // Process each geree with its template
      const processedGereenuud = await Promise.all(
        gereenuud.map(async (geree) => {
          const orshinSuugch = geree.orshinSuugchId
            ? orshinSuugchMap.get(String(geree.orshinSuugchId))
            : null;

          // Process template
          const processedTemplate = {
            aguulga: replaceTemplateVariables(
              zagvar.aguulga || "",
              geree,
              orshinSuugch
            ),
            tolgoi: replaceTemplateVariables(
              zagvar.tolgoi || "",
              geree,
              orshinSuugch
            ),
            baruunTolgoi: replaceTemplateVariables(
              zagvar.baruunTolgoi || "",
              geree,
              orshinSuugch
            ),
            zuunTolgoi: replaceTemplateVariables(
              zagvar.zuunTolgoi || "",
              geree,
              orshinSuugch
            ),
            baruunKhul: replaceTemplateVariables(
              zagvar.baruunKhul || "",
              geree,
              orshinSuugch
            ),
            zuunKhul: replaceTemplateVariables(
              zagvar.zuunKhul || "",
              geree,
              orshinSuugch
            ),
          };

          // Return geree data with processed template
          return {
            _id: geree._id,
            gereeniiDugaar: geree.gereeniiDugaar,
            gereeniiOgnoo: geree.gereeniiOgnoo,
            ner: geree.ner,
            ovog: geree.ovog,
            utas: geree.utas,
            mail: geree.mail,
            toot: geree.toot,
            davkhar: geree.davkhar,
            bairNer: geree.bairNer,
            niitTulbur: geree.niitTulbur,
            ashiglaltiinZardal: geree.ashiglaltiinZardal,
            ekhlekhOgnoo: geree.ekhlekhOgnoo,
            duusakhOgnoo: geree.duusakhOgnoo,
            baiguullagiinId: geree.baiguullagiinId,
            baiguullagiinNer: geree.baiguullagiinNer,
            barilgiinId: geree.barilgiinId,
            orshinSuugchId: geree.orshinSuugchId,
            createdAt: geree.createdAt,
            updatedAt: geree.updatedAt,
            // Processed template data (90% same structure, different values)
            processedTemplate: processedTemplate,
            // Original geree data for reference
            gereeData: {
              register: geree.register,
              duureg: geree.duureg,
              horoo: geree.horoo,
              sohNer: geree.sohNer,
              sukhBairshil: geree.sukhBairshil,
              temdeglel: geree.temdeglel,
            },
          };
        })
      );

      res.json({
        success: true,
        message: "Гэрээний жагсаалт амжилттай",
        result: {
          gereenuud: processedGereenuud,
          niitToo: processedGereenuud.length,
          zagvariinNer: zagvar.ner,
          zagvariinId: zagvar._id,
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

// Endpoint to get variable values - can list all available or get specific variable value
exports.gereeniiZagvarHuvisagchAvya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { gereeniiId, variableName, baiguullagiinId } = req.body;

    // Get connection
    let kholbolt = null;
    let finalBaiguullagiinId = baiguullagiinId;

    if (gereeniiId) {
      // Find connection by searching for geree
      if (!finalBaiguullagiinId) {
        for (const conn of db.kholboltuud) {
          try {
            const tempGeree = await Geree(conn).findById(gereeniiId);
            if (tempGeree) {
              finalBaiguullagiinId = tempGeree.baiguullagiinId;
              kholbolt = conn;
              break;
            }
          } catch (e) {
            // Continue searching
          }
        }
      } else {
        kholbolt = db.kholboltuud.find(
          (k) => String(k.baiguullagiinId) === String(finalBaiguullagiinId)
        );
      }
    } else if (finalBaiguullagiinId) {
      kholbolt = db.kholboltuud.find(
        (k) => String(k.baiguullagiinId) === String(finalBaiguullagiinId)
      );
    }

    if (!kholbolt && gereeniiId) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй!",
      });
    }

    // If specific variable name requested with geree
    if (variableName && gereeniiId) {
      const geree = await Geree(kholbolt).findById(gereeniiId);

      if (!geree) {
        return res.status(404).json({
          success: false,
          message: "Гэрээ олдсонгүй!",
        });
      }

      // Get orshinSuugch if exists
      let orshinSuugch = null;
      if (geree.orshinSuugchId) {
        orshinSuugch = await OrshinSuugch(kholbolt).findById(
          geree.orshinSuugchId
        );
      }

      // Get variable value
      const value = getVariableValue(variableName, geree, orshinSuugch);

      res.json({
        success: true,
        message: "Хувьсагчийн утга амжилттай",
        result: {
          variableName: variableName,
          value: value,
          gereeId: gereeniiId,
        },
      });
      return;
    }

    // If no specific variable, return list of available variables
    // Get sample geree to show structure
    let sampleGeree = null;
    let sampleOrshinSuugch = null;

    if (gereeniiId && kholbolt) {
      sampleGeree = await Geree(kholbolt).findById(gereeniiId);
      if (sampleGeree && sampleGeree.orshinSuugchId) {
        sampleOrshinSuugch = await OrshinSuugch(kholbolt).findById(
          sampleGeree.orshinSuugchId
        );
      }
    }

    // List of available variables from geree model
    const gereeVariables = [
      "gereeniiDugaar",
      "gereeniiOgnoo",
      "ovog",
      "ner",
      "register",
      "utas",
      "mail",
      "toot",
      "davkhar",
      "bairNer",
      "sukhBairshil",
      "duureg",
      "horoo",
      "horoo.ner",
      "horoo.kod",
      "sohNer",
      "niitTulbur",
      "ashiglaltiinZardal",
      "ashiglaltiinZardalUsgeer",
      "niitTulburUsgeer",
      "ekhlekhOgnoo",
      "duusakhOgnoo",
      "tulukhOgnoo",
      "baiguullagiinNer",
      "temdeglel",
    ];

    // List of available variables from orshinSuugch model
    const orshinSuugchVariables = [
      "ner",
      "ovog",
      "utas",
      "mail",
      "toot",
      "davkhar",
      "bairniiNer",
      "duureg",
      "horoo",
      "soh",
    ];

    // Get example values if sample geree exists
    const exampleValues = {};
    if (sampleGeree) {
      gereeVariables.forEach((varName) => {
        const value = getVariableValue(varName, sampleGeree, sampleOrshinSuugch);
        if (value) {
          exampleValues[varName] = value;
        }
      });
    }

    if (sampleOrshinSuugch) {
      orshinSuugchVariables.forEach((varName) => {
        const value = getVariableValue(varName, sampleGeree, sampleOrshinSuugch);
        if (value && !exampleValues[varName]) {
          exampleValues[varName] = value;
        }
      });
    }

    res.json({
      success: true,
      message: "Боломжтой хувьсагчдын жагсаалт",
      result: {
        gereeVariables: gereeVariables.map((name) => ({
          name: name,
          description: getVariableDescription(name),
          exampleValue: exampleValues[name] || null,
        })),
        orshinSuugchVariables: orshinSuugchVariables.map((name) => ({
          name: name,
          description: getVariableDescription(name),
          exampleValue: exampleValues[name] || null,
        })),
        allVariables: [...gereeVariables, ...orshinSuugchVariables],
        usage: {
          singleValue: "POST with gereeniiId and variableName to get specific value",
          allVariables: "POST with gereeniiId (optional) to get list of all variables",
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to get variable description
function getVariableDescription(variableName) {
  const descriptions = {
    gereeniiDugaar: "Гэрээний дугаар",
    gereeniiOgnoo: "Гэрээний огноо",
    ovog: "Овог",
    ner: "Нэр",
    register: "Регистр",
    utas: "Утас",
    mail: "Имэйл",
    toot: "Тоот",
    davkhar: "Давхар",
    bairNer: "Байрны нэр",
    sukhBairshil: "Суух байршил",
    duureg: "Дүүрэг",
    horoo: "Хороо (объект)",
    "horoo.ner": "Хорооны нэр",
    "horoo.kod": "Хорооны код",
    sohNer: "СӨХ-ийн нэр",
    niitTulbur: "Нийт төлбөр",
    ashiglaltiinZardal: "Ашиглалтын зардал",
    ashiglaltiinZardalUsgeer: "Ашиглалтын зардлын үгээр",
    niitTulburUsgeer: "Нийт төлбөрийн үгээр",
    ekhlekhOgnoo: "Эхлэх огноо",
    duusakhOgnoo: "Дуусах огноо",
    tulukhOgnoo: "Төлөх огноо",
    baiguullagiinNer: "Байгууллагын нэр",
    temdeglel: "Тэмдэглэл",
    bairniiNer: "Байрны нэр (оршин суугчаас)",
    soh: "СӨХ (оршин суугчаас)",
  };

  return descriptions[variableName] || variableName;
}

// Export helper function for use in other controllers
exports.replaceTemplateVariables = replaceTemplateVariables;
exports.getVariableValue = getVariableValue;


const asyncHandler = require("express-async-handler");
const GereeniiZagvar = require("../models/gereeniiZagvar");
const Geree = require("../models/geree");
const OrshinSuugch = require("../models/orshinSuugch");
const { toWords } = require("mon_num");

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
    if (!amount && amount !== 0) return "0";
    return Number(amount).toLocaleString("mn-MN");
  }

  // Convert number to words (Mongolian)
  function numberToWords(number, bukhel = "төгрөг", butarhai = "мөнгө") {
    if (!number && number !== 0) return "";
    const fixed = 2;
    let resValue = "";
    const value = Number(number).toFixed(fixed).toString();
    if (value.includes(".")) {
      resValue = toWords(Number(value.split(".")[0]), { suffix: "n" });
      if (bukhel) resValue += ` ${bukhel}`;
      if (Number(value.split(".")[1]) > 0) {
        resValue += ` ${toWords(Number(value.split(".")[1]), { suffix: "n" })}`;
        if (butarhai) resValue += ` ${butarhai}`;
      }
    } else {
      resValue = toWords(Number(value), { suffix: "n" });
      if (bukhel) resValue += ` ${bukhel}`;
    }
    return resValue;
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
    if (typeof obj === "object" && obj.kod) {
      return obj.kod;
    }
    return String(obj);
  }

  // Calculate contract duration in months
  function calculateKhugatsaa(ekhlekhOgnoo, duusakhOgnoo) {
    if (!ekhlekhOgnoo || !duusakhOgnoo) return "";
    const start = new Date(ekhlekhOgnoo);
    const end = new Date(duusakhOgnoo);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return months > 0 ? `${months} сар` : "";
  }

  let value = null;

  // Special handling for specific variables
  switch (tagType) {
    // Basic information
    case "ovog":
      value = geree?.ovog || orshinSuugch?.ovog || "";
      break;
    case "ner":
      value = geree?.ner || orshinSuugch?.ner || "";
      break;
    case "utas":
      value = geree?.utas || orshinSuugch?.utas || "";
      if (Array.isArray(value)) value = formatArray(value);
      break;
    case "mail":
      value = geree?.mail || orshinSuugch?.mail || "";
      break;
    case "khayag":
      value = geree?.sukhBairshil || orshinSuugch?.khayag || "";
      break;
    case "baingiinKhayag":
      value = geree?.baingiinKhayag || "";
      break;
    case "register":
      value = geree?.register || orshinSuugch?.register || "";
      break;
    case "gereeniiDugaar":
      value = geree?.gereeniiDugaar || "";
      break;
    case "gereeniiOgnoo":
      value = geree?.gereeniiOgnoo || "";
      if (value) return formatDate(value);
      return "";
    case "turul":
      value = geree?.turul || "";
      break;

    // SUH information
    case "suhNer":
      value = geree?.suhNer || "";
      break;
    case "suhRegister":
      value = geree?.suhRegister || "";
      break;
    case "suhUtas":
      value = geree?.suhUtas || "";
      if (Array.isArray(value)) value = formatArray(value);
      break;
    case "suhMail":
      value = geree?.suhMail || "";
      break;

    // Duration
    case "khugatsaa":
      value = geree?.khugatsaa || "";
      if (value) return `${value} сар`;
      return "";
    case "tulukhOgnoo":
      value = geree?.tulukhOgnoo || "";
      if (value) return formatDate(value);
      return "";
    case "gereeniiKhugatsaa":
      value = calculateKhugatsaa(geree?.ekhlekhOgnoo, geree?.duusakhOgnoo);
      if (value) return value;
      return "";
    case "TulultHiigdehOgnoo":
      value = geree?.tulukhOgnoo || "";
      if (value) return formatDate(value);
      return "";

    // Payment
    case "suhTulbur":
      value = geree?.suhTulbur || "";
      break;
    case "suhTulburUsgeer":
      value = geree?.suhTulbur || "";
      if (value) return numberToWords(value);
      return "";
    case "ashiglaltiinZardal":
      value = geree?.ashiglaltiinZardal || "";
      if (value || value === 0) return formatCurrency(value);
      return "";
    case "ashiglaltiinZardalUsgeer":
      value = geree?.ashiglaltiinZardal || "";
      if (value || value === 0) return numberToWords(value);
      return "";
    case "niitTulbur":
      value = geree?.niitTulbur || "";
      if (value || value === 0) return formatCurrency(value);
      return "";
    case "niitTulburUsgeer":
      value = geree?.niitTulbur || "";
      if (value || value === 0) return numberToWords(value);
      return "";

    // Property information
    case "bairNer":
      value = geree?.bairNer || orshinSuugch?.bairniiNer || "";
      break;
    case "orts":
      value = geree?.orts || orshinSuugch?.orts || "";
      break;
    case "toot":
      value = geree?.toot || orshinSuugch?.toot || "";
      break;
    case "davkhar":
      value = geree?.davkhar || orshinSuugch?.davkhar || "";
      break;

    // Additional information
    case "burtgesenAjiltan":
      value = geree?.burtgesenAjiltan || "";
      break;
    case "temdeglel":
      value = geree?.temdeglel || "";
      break;

    // Location information
    case "duureg":
      value = geree?.duureg || orshinSuugch?.duureg || "";
      break;
    case "horoo":
      value = geree?.horoo || orshinSuugch?.horoo || "";
      if (typeof value === "object" && value !== null) {
        return formatObject(value);
      }
      break;
    case "soh":
      value = geree?.sohNer || orshinSuugch?.soh || "";
      break;

    // Default: try direct field access
    default:
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
      break;
  }

  // Format the value based on type
  if (value === null || value === undefined) {
    return "";
  }

  // Date formatting (for any remaining date fields)
  if (tagType.includes("Ognoo") || tagType.includes("ognoo")) {
    if (value instanceof Date || (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/))) {
      return formatDate(value);
    }
  }

  // Array formatting
  if (Array.isArray(value)) {
    return formatArray(value);
  }

  // Object formatting
  if (typeof value === "object" && value !== null) {
    return formatObject(value);
  }

  // Number formatting for currency fields (if not already formatted)
  if (
    (tagType.includes("Tulbur") || tagType.includes("Zardal") || tagType.includes("Dun")) &&
    !tagType.includes("Usgeer")
  ) {
    if (typeof value === "number" || (typeof value === "string" && !isNaN(value))) {
      return formatCurrency(value);
    }
  }

  return String(value);
}

// Main function to replace data-tag-type variables in HTML
function replaceTemplateVariables(htmlContent, geree, orshinSuugch) {
  if (!htmlContent) return "";

  // Regular expression to match <span data-tag-type="variableName" class="custom-tag"></span>
  // Handles both single and double quotes, with or without spaces
  const tagRegex =
    /<span\s+data-tag-type=["']([^"']+)["']\s+class=["']custom-tag["']\s*\/?>\s*<\/span>/gi;

  let processedContent = htmlContent;
  
  // Replace all variable tags
  processedContent = processedContent.replace(tagRegex, (match, tagType) => {
    const value = getVariableValue(tagType.trim(), geree, orshinSuugch);
    // Debug: log if replacement is happening
    if (value) {
      console.log(`Replacing ${tagType} with: ${value}`);
    }
    return value || ""; // Return empty string if value not found
  });

  return processedContent;
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

    // List of all available variables matching tagCategories structure
    const allVariables = [
      // Basic information
      "ovog",
      "ner",
      "utas",
      "mail",
      "khayag",
      "baingiinKhayag",
      "register",
      "gereeniiDugaar",
      "gereeniiOgnoo",
      "turul",
      // SUH information
      "suhNer",
      "suhRegister",
      "suhUtas",
      "suhMail",
      // Duration
      "khugatsaa",
      "tulukhOgnoo",
      "gereeniiKhugatsaa",
      "TulultHiigdehOgnoo",
      // Payment
      "suhTulbur",
      "suhTulburUsgeer",
      "ashiglaltiinZardal",
      "ashiglaltiinZardalUsgeer",
      "niitTulbur",
      "niitTulburUsgeer",
      // Property information
      "bairNer",
      "orts",
      "toot",
      "davkhar",
      // Additional information
      "burtgesenAjiltan",
      "temdeglel",
      // Location information
      "duureg",
      "horoo",
      "soh",
    ];

    // Variables that can come from both geree and orshinSuugch
    const sharedVariables = ["ovog", "ner", "utas", "mail", "toot", "davkhar", "duureg", "horoo", "orts"];

    // Variables specific to geree
    const gereeVariables = allVariables.filter(v => !sharedVariables.includes(v) || v === "register");

    // Variables specific to orshinSuugch (these are already in sharedVariables)
    const orshinSuugchVariables = sharedVariables.filter(v => v !== "register");

    // Get example values if sample geree exists
    const exampleValues = {};
    if (sampleGeree || sampleOrshinSuugch) {
      allVariables.forEach((varName) => {
        const value = getVariableValue(varName, sampleGeree, sampleOrshinSuugch);
        if (value) {
          exampleValues[varName] = value;
        }
      });
    }

    res.json({
      success: true,
      message: "Боломжтой хувьсагчдын жагсаалт",
      result: {
        allVariables: allVariables.map((name) => ({
          name: name,
          exampleValue: exampleValues[name] || null,
          description: getVariableDescription(name),
        })),
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
    // Basic information
    ovog: "Овог",
    ner: "Нэр",
    utas: "Утас",
    mail: "И-мэйл",
    khayag: "Хаяг",
    baingiinKhayag: "Байнгын хаяг",
    register: "Регистр",
    gereeniiDugaar: "Гэрээний дугаар",
    gereeniiOgnoo: "Гэрээний огноо",
    turul: "Төрөл",
    // SUH information
    suhNer: "СӨХ-ийн нэр",
    suhRegister: "СӨХ-ийн регистр",
    suhUtas: "СӨХ-ийн утас",
    suhMail: "СӨХ-ийн и-мэйл",
    // Duration
    khugatsaa: "Хугацаа",
    tulukhOgnoo: "Төлөх огноо",
    gereeniiKhugatsaa: "Гэрээний хугацаа",
    TulultHiigdehOgnoo: "Төлөлт хийгдэх огноо",
    // Payment
    suhTulbur: "СӨХ хураамж",
    suhTulburUsgeer: "СӨХ хураамж үсгээр",
    ashiglaltiinZardal: "Ашиглалтын зардал",
    ashiglaltiinZardalUsgeer: "Ашиглалт үсгээр",
    niitTulbur: "Нийт төлбөр",
    niitTulburUsgeer: "Нийт төлбөр үсгээр",
    // Property information
    bairNer: "Байрны нэр",
    orts: "Орц",
    toot: "Тоот",
    davkhar: "Давхар",
    // Additional information
    burtgesenAjiltan: "Бүртгэсэн ажилтан",
    temdeglel: "Тэмдэглэл",
    // Location information
    duureg: "Дүүрэг",
    horoo: "Хороо",
    soh: "СӨХ",
  };

  return descriptions[variableName] || variableName;
}

// Export helper function for use in other controllers
exports.replaceTemplateVariables = replaceTemplateVariables;
exports.getVariableValue = getVariableValue;


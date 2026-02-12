const Ajiltan = require("../models/ajiltan");
const ZasakhTuukh = require("../models/zasakhTuukh");
const UstgakhTuukh = require("../models/ustgakhTuukh");

/**
 * Get employee info from request token
 */
async function getAjiltanFromRequest(req, db) {
  try {
    if (!req.headers.authorization) {
      return null;
    }

    const token = req.headers.authorization.replace("Bearer ", "");
    if (!token) {
      return null;
    }

    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");

    if (decoded && decoded.id) {
      const ajiltan = await Ajiltan(db.erunkhiiKholbolt)
        .findById(decoded.id)
        .select("_id ner nevtrekhNer baiguullagiinId")
        .lean();

      if (ajiltan) {
        return {
          id: ajiltan._id.toString(),
          ner: ajiltan.ner,
          nevtrekhNer: ajiltan.nevtrekhNer,
          baiguullagiinId: ajiltan.baiguullagiinId,
        };
      }
    }
  } catch (err) {
    // Token invalid or expired - that's okay, just return null
  }

  return null;
}

/**
 * Get IP address from request
 */
function getIpFromRequest(req) {
  return (
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"] ||
    req.ip ||
    req.connection.remoteAddress ||
    ""
  );
}

/**
 * Get user agent from request
 */
function getUserAgentFromRequest(req) {
  if (req.headers["user-agent"]) {
    try {
      const useragent = require("express-useragent");
      return useragent.parse(req.headers["user-agent"]);
    } catch (err) {
      return { browser: req.headers["user-agent"] };
    }
  }
  return {};
}

/**
 * Compare two objects and return array of changes
 */
function getChanges(oldDoc, newDoc, excludeFields = ["updatedAt", "__v", "_id"]) {
  const changes = [];
  const allKeys = new Set([...Object.keys(oldDoc || {}), ...Object.keys(newDoc || {})]);

  for (const key of allKeys) {
    if (excludeFields.includes(key)) continue;

    const oldValue = oldDoc?.[key];
    const newValue = newDoc?.[key];

    // Deep comparison for objects/arrays
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({
        field: key,
        oldValue: oldValue,
        newValue: newValue,
      });
    }
  }

  return changes;
}

/**
 * Log edit/update operation
 */
async function logEdit(req, db, modelName, documentId, oldDoc, newDoc, additionalContext = {}) {
  try {
    const ajiltan = await getAjiltanFromRequest(req, db);
    if (!ajiltan) {
      // No user logged in - skip logging
      return;
    }

    const changes = getChanges(oldDoc, newDoc);
    if (changes.length === 0) {
      // No actual changes - skip logging
      return;
    }

    // Get organization info if available
    let baiguullagiinRegister = null;
    if (ajiltan.baiguullagiinId) {
      try {
        const Baiguullaga = require("../models/baiguullaga");
        const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt)
          .findById(ajiltan.baiguullagiinId)
          .select("register")
          .lean();
        if (baiguullaga) {
          baiguullagiinRegister = baiguullaga.register;
        }
      } catch (err) {
        // Ignore errors
      }
    }

    const zasakhTuukh = new ZasakhTuukh(db.erunkhiiKholbolt)({
      modelName: modelName,
      documentId: documentId?.toString(),
      collectionName: modelName,
      ajiltniiId: ajiltan.id,
      ajiltniiNer: ajiltan.ner,
      ajiltniiNevtrekhNer: ajiltan.nevtrekhNer,
      changes: changes,
      baiguullagiinId: ajiltan.baiguullagiinId,
      baiguullagiinRegister: baiguullagiinRegister,
      barilgiinId: additionalContext.barilgiinId || null,
      ip: getIpFromRequest(req),
      useragent: getUserAgentFromRequest(req),
      method: req.method || "PUT",
      ognoo: new Date(),
    });

    await zasakhTuukh.save();
  } catch (err) {
    // Don't throw errors - audit logging should not break the main operation
    console.error("❌ [AUDIT] Error logging edit:", err.message);
  }
}

/**
 * Log delete operation
 */
async function logDelete(
  req,
  db,
  modelName,
  documentId,
  deletedDoc,
  deletionType = "hard",
  reason = null,
  additionalContext = {}
) {
  try {
    const ajiltan = await getAjiltanFromRequest(req, db);
    if (!ajiltan) {
      // No user logged in - skip logging
      return;
    }

    // Get organization info if available
    let baiguullagiinRegister = null;
    if (ajiltan.baiguullagiinId) {
      try {
        const Baiguullaga = require("../models/baiguullaga");
        const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt)
          .findById(ajiltan.baiguullagiinId)
          .select("register")
          .lean();
        if (baiguullaga) {
          baiguullagiinRegister = baiguullaga.register;
        }
      } catch (err) {
        // Ignore errors
      }
    }

    // Extract baiguullagiinId and barilgiinId from deleted document if available
    const docBaiguullagiinId = deletedDoc?.baiguullagiinId || additionalContext.baiguullagiinId || ajiltan.baiguullagiinId;
    const docBarilgiinId = deletedDoc?.barilgiinId || additionalContext.barilgiinId;

    const ustgakhTuukh = new UstgakhTuukh(db.erunkhiiKholbolt)({
      modelName: modelName,
      documentId: documentId?.toString(),
      collectionName: modelName,
      deletedData: deletedDoc,
      ajiltniiId: ajiltan.id,
      ajiltniiNer: ajiltan.ner,
      ajiltniiNevtrekhNer: ajiltan.nevtrekhNer,
      baiguullagiinId: docBaiguullagiinId,
      baiguullagiinRegister: baiguullagiinRegister,
      barilgiinId: docBarilgiinId,
      ip: getIpFromRequest(req),
      useragent: getUserAgentFromRequest(req),
      method: req.method || "DELETE",
      deletionType: deletionType,
      reason: reason,
      ognoo: new Date(),
    });

    await ustgakhTuukh.save();
  } catch (err) {
    // Don't throw errors - audit logging should not break the main operation
    console.error("❌ [AUDIT] Error logging delete:", err.message);
  }
}

module.exports = {
  logEdit,
  logDelete,
  getChanges,
};

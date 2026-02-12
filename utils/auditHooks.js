/**
 * Utility to add audit hooks to any Mongoose model
 * This automatically tracks edits and deletes for any model
 */

const { logEdit, logDelete } = require("../services/auditService");
const { getCurrentRequest } = require("../middleware/requestContext");

/**
 * Add audit hooks to a Mongoose schema
 * @param {Schema} schema - Mongoose schema
 * @param {String} modelName - Name of the model (e.g., "ajiltan", "geree")
 */
function addAuditHooks(schema, modelName) {
  // Pre-update hook to capture old document
  schema.pre("findOneAndUpdate", async function () {
    if (!this._oldDoc) {
      try {
        this._oldDoc = await this.model.findOne(this.getQuery()).lean();
      } catch (err) {
        // Ignore errors
      }
    }
  });

  schema.pre("updateOne", async function () {
    if (!this._oldDoc) {
      try {
        this._oldDoc = await this.model.findOne(this.getQuery()).lean();
      } catch (err) {
        // Ignore errors
      }
    }
  });

  // Post-update hook for audit logging
  schema.post("findOneAndUpdate", async function (doc) {
    if (doc && this._oldDoc) {
      try {
        const { db } = require("zevbackv2");
        const req = getCurrentRequest();
        
        if (req) {
          const oldDoc = this._oldDoc;
          const newDoc = doc.toObject ? doc.toObject() : doc;
          
          // Extract context from document
          const additionalContext = {
            baiguullagiinId: doc.baiguullagiinId || null,
            barilgiinId: doc.barilgiinId || null,
          };
          
          await logEdit(
            req,
            db,
            modelName,
            doc._id.toString(),
            oldDoc,
            newDoc,
            additionalContext
          );
        }
      } catch (err) {
        console.error(`❌ [AUDIT] Error logging ${modelName} edit:`, err.message);
      }
    }
  });

  schema.post("updateOne", async function () {
    try {
      const doc = await this.model.findOne(this.getQuery()).lean();
      if (doc && this._oldDoc) {
        const { db } = require("zevbackv2");
        const req = getCurrentRequest();
        
        if (req) {
          const oldDoc = this._oldDoc;
          const newDoc = doc;
          
          const additionalContext = {
            baiguullagiinId: doc.baiguullagiinId || null,
            barilgiinId: doc.barilgiinId || null,
          };
          
          await logEdit(
            req,
            db,
            modelName,
            doc._id.toString(),
            oldDoc,
            newDoc,
            additionalContext
          );
        }
      }
    } catch (err) {
      console.error(`❌ [AUDIT] Error logging ${modelName} edit:`, err.message);
    }
  });

  // Post-delete hook for audit logging
  schema.post("findOneAndDelete", async function (doc) {
    if (doc) {
      try {
        const { db } = require("zevbackv2");
        const req = getCurrentRequest();
        
        if (req) {
          const deletedDoc = doc.toObject ? doc.toObject() : doc;
          
          const additionalContext = {
            baiguullagiinId: doc.baiguullagiinId || null,
            barilgiinId: doc.barilgiinId || null,
          };
          
          await logDelete(
            req,
            db,
            modelName,
            doc._id.toString(),
            deletedDoc,
            "hard",
            null,
            additionalContext
          );
        }
      } catch (err) {
        console.error(`❌ [AUDIT] Error logging ${modelName} delete:`, err.message);
      }
    }
  });

  schema.post("deleteOne", { document: true, query: true }, async function () {
    try {
      const doc = this.getQuery ? await this.model.findOne(this.getQuery()).lean() : this;
      if (doc) {
        const { db } = require("zevbackv2");
        const req = getCurrentRequest();
        
        if (req) {
          const deletedDoc = doc;
          
          const additionalContext = {
            baiguullagiinId: doc.baiguullagiinId || null,
            barilgiinId: doc.barilgiinId || null,
          };
          
          await logDelete(
            req,
            db,
            modelName,
            doc._id.toString(),
            deletedDoc,
            "hard",
            null,
            additionalContext
          );
        }
      }
    } catch (err) {
      console.error(`❌ [AUDIT] Error logging ${modelName} delete:`, err.message);
    }
  });
}

/**
 * Special hook for tracking tokhirgoo (settings) changes
 * This tracks nested tokhirgoo object changes in models like baiguullaga, geree, etc.
 */
function addTokhirgooAuditHook(schema, modelName) {
  schema.post("findOneAndUpdate", async function (doc) {
    if (doc && this._oldDoc) {
      try {
        const oldTokhirgoo = this._oldDoc.tokhirgoo || {};
        const newTokhirgoo = doc.tokhirgoo || {};
        
        // Check if tokhirgoo changed
        if (JSON.stringify(oldTokhirgoo) !== JSON.stringify(newTokhirgoo)) {
          const { db } = require("zevbackv2");
          const req = getCurrentRequest();
          
          if (req) {
            const { logEdit } = require("../services/auditService");
            
            // Create a focused change log for tokhirgoo
            const changes = [];
            const allKeys = new Set([
              ...Object.keys(oldTokhirgoo),
              ...Object.keys(newTokhirgoo),
            ]);
            
            for (const key of allKeys) {
              const oldValue = oldTokhirgoo[key];
              const newValue = newTokhirgoo[key];
              
              if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                changes.push({
                  field: `tokhirgoo.${key}`,
                  oldValue: oldValue,
                  newValue: newValue,
                });
              }
            }
            
            if (changes.length > 0) {
              const oldDoc = { tokhirgoo: oldTokhirgoo };
              const newDoc = { tokhirgoo: newTokhirgoo };
              
              await logEdit(
                req,
                db,
                modelName,
                doc._id.toString(),
                oldDoc,
                newDoc,
                {
                  baiguullagiinId: doc.baiguullagiinId || null,
                  barilgiinId: doc.barilgiinId || null,
                  isTokhirgooChange: true, // Flag to indicate this is a settings change
                }
              );
            }
          }
        }
      } catch (err) {
        console.error(`❌ [AUDIT] Error logging ${modelName} tokhirgoo change:`, err.message);
      }
    }
  });
}

module.exports = {
  addAuditHooks,
  addTokhirgooAuditHook,
};

const asyncHandler = require("express-async-handler");
const { db } = require("zevbackv2");
const Medegdel = require("../models/medegdel");

exports.medegdelUnreadCount = asyncHandler(async (req, res, next) => {
  try {
    const source = req.method === "GET" ? req.query : req.body;
    const { baiguullagiinId, barilgiinId } = source || {};

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: true,
        count: 0,
        message: "baiguullagiinId is required",
      });
    }

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.json({ success: true, count: 0 });
    }

    const query = {
      baiguullagiinId: String(baiguullagiinId),
      status: "pending",
      turul: { $in: ["sanal", "санал", "gomdol", "гомдол"] },
      kharsanEsekh: { $ne: true },
    };
    if (barilgiinId) query.barilgiinId = String(barilgiinId);

    const count = await Medegdel(kholbolt).countDocuments(query);

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    next(error);
  }
});

exports.medegdelUnreadList = asyncHandler(async (req, res, next) => {
  try {
    const source = req.method === "GET" ? req.query : req.body;
    const { baiguullagiinId, barilgiinId } = source || {};

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: true,
        data: [],
        message: "baiguullagiinId is required",
      });
    }

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.json({ success: true, data: [] });
    }

    const baseQuery = {
      baiguullagiinId: String(baiguullagiinId),
      turul: { $in: ["sanal", "санал", "gomdol", "гомдол"] },
    };
    if (barilgiinId) baseQuery.barilgiinId = String(barilgiinId);

    // Return last 10 items (read + unread) as history; unread badge count stays separate
    const list = await Medegdel(kholbolt)
      .find(baseQuery)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: list,
    });
  } catch (error) {
    next(error);
  }
});

exports.medegdelAvya = asyncHandler(async (req, res, next) => {
  try {
    const source = req.params.baiguullagiinId
      ? {
          baiguullagiinId: req.params.baiguullagiinId,
          ...(req.method === "GET" ? req.query : req.body),
        }
      : req.method === "GET"
      ? req.query
      : req.body;

    const { baiguullagiinId, barilgiinId, orshinSuugchId, tukhainBaaziinKholbolt, turul } = source || {};

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId is required",
      });
    }

    // tukhainBaaziinKholbolt check removed as we find connection by baiguullagiinId below

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй",
      });
    }

    const query = { baiguullagiinId: String(baiguullagiinId) };
    if (barilgiinId) query.barilgiinId = String(barilgiinId);
    if (orshinSuugchId) query.orshinSuugchId = String(orshinSuugchId);
    if (turul) query.turul = String(turul);

    const medegdeluud = await Medegdel(kholbolt)
      .find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: medegdeluud,
      count: medegdeluud.length,
    });
  } catch (error) {
    next(error);
  }
});

exports.medegdelNegAvya = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { baiguullagiinId, tukhainBaaziinKholbolt } = req.query || req.body || {};

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id is required",
      });
    }

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId is required",
      });
    }

    if (!tukhainBaaziinKholbolt) {
      return res.status(400).json({
        success: false,
        message: "tukhainBaaziinKholbolt is required",
      });
    }

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй",
      });
    }

    const medegdel = await Medegdel(kholbolt).findById(id).lean();

    if (!medegdel) {
      return res.status(404).json({
        success: false,
        message: "Мэдэгдэл олдсонгүй",
      });
    }

    res.json({
      success: true,
      data: medegdel,
    });
  } catch (error) {
    next(error);
  }
});

// Mark a single medegdel as seen (kharsanEsekh: true). Only updates the document with the given id.
exports.medegdelKharsanEsekh = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const baiguullagiinId = req.query.baiguullagiinId || req.body?.baiguullagiinId;

    if (!id) {
      return res.status(400).json({ success: false, message: "id is required" });
    }
    if (!baiguullagiinId) {
      return res.status(400).json({ success: false, message: "baiguullagiinId is required" });
    }

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );
    if (!kholbolt) {
      return res.status(404).json({ success: false, message: "Холболтын мэдээлэл олдсонгүй" });
    }

    const result = await Medegdel(kholbolt).findByIdAndUpdate(
      id,
      { $set: { kharsanEsekh: true, updatedAt: new Date() } },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: "Мэдэгдэл олдсонгүй" });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

exports.medegdelZasah = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { baiguullagiinId, tukhainBaaziinKholbolt } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id is required",
      });
    }

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId is required",
      });
    }

    if (!tukhainBaaziinKholbolt) {
      return res.status(400).json({
        success: false,
        message: "tukhainBaaziinKholbolt is required",
      });
    }

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй",
      });
    }

    const existingMedegdel = await Medegdel(kholbolt).findById(id).lean();
    
    if (!existingMedegdel) {
      return res.status(404).json({
        success: false,
        message: "Мэдэгдэл олдсонгүй",
      });
    }

    const updateFields = {
      updatedAt: new Date(),
    };

    if (req.body.kharsanEsekh !== undefined) {
      updateFields.kharsanEsekh = Boolean(req.body.kharsanEsekh);
    }

    const allowedTypesForReply = ["sanal", "huselt", "gomdol"];
    const isReplyableType = existingMedegdel.turul && 
      allowedTypesForReply.includes(String(existingMedegdel.turul).toLowerCase());

    if (isReplyableType) {
      if (req.body.status !== undefined) {
        const allowedStatuses = ["pending", "in_progress", "done", "cancelled", "rejected"];
        if (allowedStatuses.includes(req.body.status)) {
          updateFields.status = req.body.status;
          
          if (req.body.status === "done" || req.body.status === "rejected") {
            updateFields.repliedAt = new Date();
            
            if (req.body.repliedBy) {
              updateFields.repliedBy = String(req.body.repliedBy);
            }
          }
        }
      }

      if (req.body.tailbar !== undefined) {
        updateFields.tailbar = String(req.body.tailbar);
      }
    }

    const medegdel = await Medegdel(kholbolt).findByIdAndUpdate(
      id,
      {
        $set: updateFields,
      },
      { 
        new: true, 
        runValidators: true,
        select: '-nevtersenAjiltniiToken -erunkhiiKholbolt'
      }
    );

    if (!medegdel) {
      return res.status(404).json({
        success: false,
        message: "Мэдэгдэл олдсонгүй",
      });
    }

    const statusWasSetToDone = updateFields.status === "done";
    const statusWasSetToRejected = updateFields.status === "rejected";
    const shouldSendReplyToApp = statusWasSetToDone || statusWasSetToRejected;
    const hasTailbar = updateFields.tailbar || medegdel.tailbar;  
    console.log("🔍 [REPLY CHECK] isReplyableType:", isReplyableType);
    console.log("🔍 [REPLY CHECK] shouldSendReplyToApp:", shouldSendReplyToApp);
    console.log("🔍 [REPLY CHECK] hasTailbar:", hasTailbar);
    
    if (isReplyableType && shouldSendReplyToApp && hasTailbar) {
      try {
        console.log("📤 [REPLY] Creating reply notification...");
        console.log("📤 [REPLY] orshinSuugchId:", medegdel.orshinSuugchId);
        console.log("📤 [REPLY] tailbar:", updateFields.tailbar || medegdel.tailbar);
        
        const replyMedegdel = new Medegdel(kholbolt)();
        replyMedegdel.parentId = medegdel._id; // Thread: link reply to root for chat
        replyMedegdel.orshinSuugchId = medegdel.orshinSuugchId;
        replyMedegdel.baiguullagiinId = medegdel.baiguullagiinId;
        replyMedegdel.barilgiinId = medegdel.barilgiinId || "";
        const prefix = statusWasSetToRejected ? "Татгалзсан: " : "Хариу: ";
        replyMedegdel.title = `${prefix}${medegdel.title || existingMedegdel.title || "Хариу"}`;
        replyMedegdel.message = updateFields.tailbar || medegdel.tailbar;
        replyMedegdel.kharsanEsekh = false;
        replyMedegdel.turul = "khariu";
        replyMedegdel.ognoo = new Date();

        await replyMedegdel.save();
        console.log("✅ [REPLY] Reply notification saved:", replyMedegdel._id);

        const replyData = replyMedegdel.toObject ? replyMedegdel.toObject() : replyMedegdel;

        const io = req.app.get("socketio");
        if (io && medegdel.orshinSuugchId) {
          const socketEventName = "orshinSuugch" + medegdel.orshinSuugchId;
          console.log("📡 [SOCKET] Emitting event:", socketEventName);
          io.emit(socketEventName, replyData);
          console.log("✅ [SOCKET] Event emitted successfully");
        } else {
          console.warn("⚠️ [SOCKET] Socket.io not available or orshinSuugchId missing");
          console.warn("⚠️ [SOCKET] io:", !!io, "orshinSuugchId:", medegdel.orshinSuugchId);
        }
      } catch (replyError) {
        console.error("❌ [REPLY] Error sending reply notification:", replyError);
        console.error("❌ [REPLY] Error stack:", replyError.stack);
      }
    }

    res.json({
      success: true,
      data: medegdel,
      message: "Мэдэгдэл амжилттай шинэчлэгдлээ",
    });
  } catch (error) {
    next(error);
  }
});

exports.medegdelUstgakh = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { baiguullagiinId, tukhainBaaziinKholbolt } = req.query || req.body || {};

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id is required",
      });
    }

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId is required",
      });
    }

    if (!tukhainBaaziinKholbolt) {
      return res.status(400).json({
        success: false,
        message: "tukhainBaaziinKholbolt is required",
      });
    }

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй",
      });
    }

    const medegdel = await Medegdel(kholbolt).findByIdAndDelete(id);

    if (!medegdel) {
      return res.status(404).json({
        success: false,
        message: "Мэдэгдэл олдсонгүй",
      });
    }

    res.json({
      success: true,
      message: "Мэдэгдэл амжилттай устгагдлаа",
    });
  } catch (error) {
    next(error);
  }
});

exports.medegdelIlgeeye = asyncHandler(async (req, res, next) => {
  try {
    const {
      medeelel: medeelelRaw,
      orshinSuugchId,
      baiguullagiinId,
      barilgiinId,
      tukhainBaaziinKholbolt,
      turul,
    } = req.body;

    // medeelel might be stringified if sent via multipart/form-data
    const medeelel = typeof medeelelRaw === 'string' ? JSON.parse(medeelelRaw) : medeelelRaw;

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId is required",
      });
    }

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй",
      });
    }

    if (!orshinSuugchId) {
      return res.status(400).json({
        success: false,
        message: "orshinSuugchId is required",
      });
    }

    const orshinSuugchIds = Array.isArray(orshinSuugchId)
      ? orshinSuugchId
      : [orshinSuugchId];

    const medegdelList = [];
    const io = req.app.get("socketio");

    for (const id of orshinSuugchIds) {
      const medegdel = new Medegdel(kholbolt)();
      medegdel.orshinSuugchId = id;
      medegdel.baiguullagiinId = baiguullagiinId;
      medegdel.barilgiinId = barilgiinId;
      medegdel.title = medeelel?.title || "";
      medegdel.message = medeelel?.body || medeelel?.message || "";
      medegdel.kharsanEsekh = false;
      medegdel.ognoo = new Date();
      if (turul) medegdel.turul = String(turul);

      // Add image path if file was uploaded
      if (req.file) {
        medegdel.zurag = req.file.path.replace(/\\/g, "/");
      }

      await medegdel.save();

      // Convert UTC dates to Mongolian time (UTC+8) for response
      const medegdelObj = medegdel.toObject();
      const mongolianOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

      if (medegdelObj.createdAt) {
        medegdelObj.createdAt = new Date(medegdelObj.createdAt.getTime() + mongolianOffset).toISOString();
      }
      if (medegdelObj.updatedAt) {
        medegdelObj.updatedAt = new Date(medegdelObj.updatedAt.getTime() + mongolianOffset).toISOString();
      }
      if (medegdelObj.ognoo) {
        medegdelObj.ognoo = new Date(medegdelObj.ognoo.getTime() + mongolianOffset).toISOString();
      }

      medegdelList.push(medegdelObj);

      if (io) {
        const eventName = "orshinSuugch" + id;
        io.emit(eventName, medegdelObj);
      }
    }

    res.json({
      success: true,
      data: medegdelList.length === 1 ? medegdelList[0] : medegdelList,
      count: medegdelList.length,
      message: "Мэдэгдэл амжилттай илгээгдлээ",
    });
  } catch (error) {
    next(error);
  }
});

// Get full thread (root + all replies) for chat-like view. id can be root or any reply in thread.
exports.medegdelThread = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { baiguullagiinId, tukhainBaaziinKholbolt } = req.query || req.body || {};

    if (!id || !baiguullagiinId || !tukhainBaaziinKholbolt) {
      return res.status(400).json({
        success: false,
        message: "id, baiguullagiinId and tukhainBaaziinKholbolt are required",
      });
    }

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );
    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй",
      });
    }

    const doc = await Medegdel(kholbolt).findById(id).lean();
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Мэдэгдэл олдсонгүй",
      });
    }

    const rootId = doc.parentId || doc._id;
    const thread = await Medegdel(kholbolt)
      .find({
        $or: [{ _id: rootId }, { parentId: rootId }],
      })
      .sort({ createdAt: 1 })
      .lean();

    const mongolianOffset = 8 * 60 * 60 * 1000;
    const normalized = thread.map((t) => {
      const o = { ...t };
      if (o.createdAt) o.createdAt = new Date(o.createdAt.getTime ? o.createdAt.getTime() + mongolianOffset : new Date(o.createdAt).getTime() + mongolianOffset).toISOString();
      if (o.updatedAt) o.updatedAt = new Date(o.updatedAt.getTime ? o.updatedAt.getTime() + mongolianOffset : new Date(o.updatedAt).getTime() + mongolianOffset).toISOString();
      if (o.ognoo) o.ognoo = new Date(o.ognoo.getTime ? o.ognoo.getTime() + mongolianOffset : new Date(o.ognoo).getTime() + mongolianOffset).toISOString();
      return o;
    });

    res.json({
      success: true,
      data: normalized,
      count: normalized.length,
    });
  } catch (error) {
    next(error);
  }
});

// User reply back (chat): create a new medegdel in the thread.
exports.medegdelUserReply = asyncHandler(async (req, res, next) => {
  try {
    const { parentId, message, orshinSuugchId } = req.body;

    if (!parentId || !message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "parentId and message are required",
      });
    }

    const baiguullagiinId = req.body.baiguullagiinId;
    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId is required",
      });
    }

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );
    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй",
      });
    }

    const root = await Medegdel(kholbolt).findById(parentId).lean();
    if (!root) {
      return res.status(404).json({
        success: false,
        message: "Эх мэдэгдэл олдсонгүй",
      });
    }

    const userId = orshinSuugchId || root.orshinSuugchId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "orshinSuugchId is required",
      });
    }

    const reply = new Medegdel(kholbolt)();
    reply.parentId = root._id;
    reply.orshinSuugchId = String(userId);
    reply.baiguullagiinId = root.baiguullagiinId;
    reply.barilgiinId = root.barilgiinId || "";
    reply.title = "Хариу: " + (root.title || "Чат");
    reply.message = message.trim();
    reply.kharsanEsekh = false;
    reply.turul = "user_reply";
    reply.ognoo = new Date();

    await reply.save();

    const replyObj = reply.toObject ? reply.toObject() : reply;
    const mongolianOffset = 8 * 60 * 60 * 1000;
    if (replyObj.createdAt) replyObj.createdAt = new Date(replyObj.createdAt.getTime ? replyObj.createdAt.getTime() + mongolianOffset : new Date(replyObj.createdAt).getTime() + mongolianOffset).toISOString();
    if (replyObj.updatedAt) replyObj.updatedAt = new Date(replyObj.updatedAt.getTime ? replyObj.updatedAt.getTime() + mongolianOffset : new Date(replyObj.updatedAt).getTime() + mongolianOffset).toISOString();
    if (replyObj.ognoo) replyObj.ognoo = new Date(replyObj.ognoo.getTime ? replyObj.ognoo.getTime() + mongolianOffset : new Date(replyObj.ognoo).getTime() + mongolianOffset).toISOString();

    const io = req.app.get("socketio");
    if (io && userId) {
      io.emit("orshinSuugch" + userId, replyObj);
    }

    res.json({
      success: true,
      data: replyObj,
      message: "Хариу илгээгдлээ",
    });
  } catch (error) {
    next(error);
  }
});

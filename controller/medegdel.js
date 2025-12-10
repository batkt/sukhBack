const asyncHandler = require("express-async-handler");
const { db } = require("zevbackv2");
const Medegdel = require("../models/medegdel");

// Get all notifications (medegdel)
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

    if (!tukhainBaaziinKholbolt) {
      return res.status(400).json({
        success: false,
        message: "tukhainBaaziinKholbolt is required",
      });
    }

    // Find the connection
    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй",
      });
    }

    // Build query
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

// Get single notification (medegdel)
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

    // Find the connection
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

// Update notification (medegdel)
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

    // Find the connection
    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй",
      });
    }

    // Get the existing medegdel to check its type
    const existingMedegdel = await Medegdel(kholbolt).findById(id).lean();
    
    if (!existingMedegdel) {
      return res.status(404).json({
        success: false,
        message: "Мэдэгдэл олдсонгүй",
      });
    }

    // ONLY update specific fields - explicitly exclude everything else
    // Do NOT include baiguullagiinId or tukhainBaaziinKholbolt in the update
    // as they are not document fields, just used for connection lookup
    const updateFields = {
      updatedAt: new Date(),
    };

    // Only update kharsanEsekh if it's provided
    if (req.body.kharsanEsekh !== undefined) {
      updateFields.kharsanEsekh = Boolean(req.body.kharsanEsekh);
    }

    // For gomdol, sanal, huselt - allow updating status and tailbar
    const allowedTypesForReply = ["sanal", "huselt", "gomdol"];
    const isReplyableType = existingMedegdel.turul && 
      allowedTypesForReply.includes(String(existingMedegdel.turul).toLowerCase());

    if (isReplyableType) {
      // Allow updating status
      if (req.body.status !== undefined) {
        const allowedStatuses = ["pending", "in_progress", "done", "cancelled"];
        if (allowedStatuses.includes(req.body.status)) {
          updateFields.status = req.body.status;
          
          // If status is set to "done", set repliedAt timestamp
          if (req.body.status === "done") {
            updateFields.repliedAt = new Date();
            
            // Set repliedBy if provided (admin/employee ID)
            if (req.body.repliedBy) {
              updateFields.repliedBy = String(req.body.repliedBy);
            }
          }
        }
      }

      // Allow updating tailbar (reply/notes)
      if (req.body.tailbar !== undefined) {
        updateFields.tailbar = String(req.body.tailbar);
      }
    }

    // Use $set to explicitly set only these fields
    const medegdel = await Medegdel(kholbolt).findByIdAndUpdate(
      id,
      {
        $set: updateFields,
      },
      { 
        new: true, 
        runValidators: true,
        // Explicitly exclude fields that might have circular references
        select: '-nevtersenAjiltniiToken -erunkhiiKholbolt'
      }
    );

    if (!medegdel) {
      return res.status(404).json({
        success: false,
        message: "Мэдэгдэл олдсонгүй",
      });
    }

    // If status is set to "done" with tailbar, send notification back to application
    const statusWasSetToDone = updateFields.status === "done";
    const hasTailbar = updateFields.tailbar || medegdel.tailbar;
    
    if (isReplyableType && statusWasSetToDone && hasTailbar) {
      try {
        // Create a reply notification to send to the orshinSuugch
        const replyMedegdel = new Medegdel(kholbolt)();
        replyMedegdel.orshinSuugchId = medegdel.orshinSuugchId;
        replyMedegdel.baiguullagiinId = medegdel.baiguullagiinId;
        replyMedegdel.barilgiinId = medegdel.barilgiinId || "";
        replyMedegdel.title = `Хариу: ${medegdel.title || existingMedegdel.title || "Хариу"}`;
        replyMedegdel.message = updateFields.tailbar || medegdel.tailbar;
        replyMedegdel.kharsanEsekh = false;
        replyMedegdel.turul = "хариу"; // Reply type
        replyMedegdel.ognoo = new Date();

        await replyMedegdel.save();

        // Emit socket event to notify the application
        const io = req.app.get("socketio");
        if (io && medegdel.orshinSuugchId) {
          io.emit("orshinSuugch" + medegdel.orshinSuugchId, replyMedegdel);
        }
      } catch (replyError) {
        console.error("Error sending reply notification:", replyError);
        // Don't fail the update if reply notification fails
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

// Delete notification (medegdel)
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

    // Find the connection
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

// Create/send notification (medegdel) - This function is imported but the route has its own implementation
exports.medegdelIlgeeye = asyncHandler(async (req, res, next) => {
  try {
    const {
      medeelel,
      orshinSuugchId,
      baiguullagiinId,
      barilgiinId,
      tukhainBaaziinKholbolt,
      turul,
    } = req.body;

    if (!baiguullagiinId || !tukhainBaaziinKholbolt) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId and tukhainBaaziinKholbolt are required",
      });
    }

    // Find the connection
    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй",
      });
    }

    const medegdel = new Medegdel(kholbolt)();
    medegdel.orshinSuugchId = orshinSuugchId;
    medegdel.baiguullagiinId = baiguullagiinId;
    medegdel.barilgiinId = barilgiinId;
    medegdel.title = medeelel?.title || "";
    medegdel.message = medeelel?.body || medeelel?.message || "";
    medegdel.kharsanEsekh = false;
    medegdel.ognoo = new Date();
    if (turul) medegdel.turul = String(turul);

    await medegdel.save();

    res.json({
      success: true,
      data: medegdel,
      message: "Мэдэгдэл амжилттай илгээгдлээ",
    });
  } catch (error) {
    next(error);
  }
});

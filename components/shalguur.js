const Ajiltan = require("../models/ajiltan");

async function gereeZasakhShalguur(req, res, next) {
  const { db } = require("zevbackv2");
  if (req.body.nevtersenAjiltniiToken && req.body.barilgiinId) {
    var ajiltan = await Ajiltan(db.erunkhiiKholbolt).findById(
      req.body.nevtersenAjiltniiToken.id
    );
    if (
      ajiltan.erkh == "Admin" ||
      (ajiltan.tokhirgoo &&
        ajiltan.tokhirgoo.gereeZasakhErkh &&
        ajiltan.tokhirgoo.gereeZasakhErkh.length > 0 &&
        ajiltan.tokhirgoo.gereeZasakhErkh.includes(req.body.barilgiinId))
    ) {
      next();
    } else next(new Error("Энэ гэрээ засах үйлдлийн эрхгүй байна!"));
  } else next(new Error("Энэ гэрээ засах үйлдлийн эрхгүй байна!"));
}

async function gereeSungakhShalguur(req, res, next) {
  const { db } = require("zevbackv2");
  if (req.body.nevtersenAjiltniiToken && req.body.barilgiinId) {
    var ajiltan = await Ajiltan(db.erunkhiiKholbolt).findById(
      req.body.nevtersenAjiltniiToken.id
    );
    if (
      ajiltan.erkh == "Admin" ||
      (ajiltan.tokhirgoo &&
        ajiltan.tokhirgoo.gereeSungakhErkh &&
        ajiltan.tokhirgoo.gereeSungakhErkh.length > 0 &&
        ajiltan.tokhirgoo.gereeSungakhErkh.includes(req.body.barilgiinId))
    ) {
      next();
    } else next(new Error("Энэ гэрээ сунгах үйлдлийн эрхгүй байна!"));
  } else next(new Error("Энэ гэрээ сунгах үйлдлийн эрхгүй байна!"));
}

async function gereeSergeekhShalguur(req, res, next) {
  const { db } = require("zevbackv2");
  if (req.body.nevtersenAjiltniiToken && req.body.barilgiinId) {
    var ajiltan = await Ajiltan(db.erunkhiiKholbolt).findById(
      req.body.nevtersenAjiltniiToken.id
    );
    if (
      ajiltan.erkh == "Admin" ||
      (ajiltan.tokhirgoo &&
        ajiltan.tokhirgoo.gereeSergeekhErkh &&
        ajiltan.tokhirgoo.gereeSergeekhErkh.length > 0 &&
        ajiltan.tokhirgoo.gereeSergeekhErkh.includes(req.body.barilgiinId))
    ) {
      next();
    } else next(new Error("Энэ гэрээ сэргээх үйлдлийн эрхгүй байна!"));
  } else next(new Error("Энэ гэрээ сэргээх үйлдлийн эрхгүй байна!"));
}

async function gereeTsutslakhShalguur(req, res, next) {
  const { db } = require("zevbackv2");
  if (req.body.nevtersenAjiltniiToken && req.body.barilgiinId) {
    var ajiltan = await Ajiltan(db.erunkhiiKholbolt).findById(
      req.body.nevtersenAjiltniiToken.id
    );
    if (
      ajiltan.erkh == "Admin" ||
      (ajiltan.tokhirgoo &&
        ajiltan.tokhirgoo.gereeTsutslakhErkh &&
        ajiltan.tokhirgoo.gereeTsutslakhErkh.length > 0 &&
        ajiltan.tokhirgoo.gereeTsutslakhErkh.includes(req.body.barilgiinId))
    ) {
      next();
    } else next(new Error("Энэ гэрээ цуцлах үйлдлийн эрхгүй байна!"));
  } else next(new Error("Энэ гэрээ цуцлах үйлдлийн эрхгүй байна!"));
}

async function guilgeeUstgakhShalguur(req, res, next) {
  const { db } = require("zevbackv2");
  if (req.body.nevtersenAjiltniiToken && req.body.barilgiinId) {
    var ajiltan = await Ajiltan(db.erunkhiiKholbolt).findById(
      req.body.nevtersenAjiltniiToken.id
    );
    if (
      ajiltan.erkh == "Admin" ||
      (ajiltan.tokhirgoo &&
        ajiltan.tokhirgoo.guilgeeUstgakhErkh &&
        ajiltan.tokhirgoo.guilgeeUstgakhErkh.length > 0 &&
        ajiltan.tokhirgoo.guilgeeUstgakhErkh.includes(req.body.barilgiinId))
    ) {
      next();
    } else next(new Error("Энэ үйлдлийн эрхгүй байна!"));
  } else next(new Error("Энэ үйлдлийн эрхгүй байна!"));
}

module.exports = {
  gereeZasakhShalguur,
  gereeSungakhShalguur,
  gereeSergeekhShalguur,
  gereeTsutslakhShalguur,
  guilgeeUstgakhShalguur,
};

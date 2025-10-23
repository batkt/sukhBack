const jwt = require("jsonwebtoken");

const localTokenShalgakh = async (req, res, next) => {
  try {
    console.log("🔍 localTokenShalgakh called");

    if (!req.headers.authorization) {
      return res.status(401).json({
        success: false,
        message: "Authorization header is required",
      });
    }

    const token = req.headers.authorization.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token is required",
      });
    }

    console.log("🔍 Verifying token with APP_SECRET:", process.env.APP_SECRET);
    console.log("🔍 Token length:", token.length);
    console.log("🔍 Token first 50 chars:", token.substring(0, 50));

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.APP_SECRET);
      console.log("✅ Token verified successfully:", decoded);
    } catch (jwtError) {
      console.error("❌ JWT Verification Error:", jwtError.message);
      console.error("❌ JWT Error name:", jwtError.name);
      console.error("❌ Full JWT Error:", jwtError);
      return res.status(401).json({
        success: false,
        message: "Invalid token",
        error: jwtError.message,
      });
    }

    // Add the decoded token to the request
    req.body.nevtersenAjiltniiToken = decoded;
    req.body.tukhainBaaziinKholbolt =
      req.body.tukhainBaaziinKholbolt || "default";

    next();
  } catch (error) {
    console.error("❌ localTokenShalgakh error:", error);
    res.status(500).json({
      success: false,
      message: "Token verification failed",
      error: error.message,
    });
  }
};

module.exports = { localTokenShalgakh };

const path = require("path");

const ENV_ROOT = process.env.MEDEGDEL_UPLOAD_ROOT
  ? path.resolve(process.env.MEDEGDEL_UPLOAD_ROOT)
  : null;

/**
 * Ordered list of directory roots for medegdel upload/serve.
 * If MEDEGDEL_UPLOAD_ROOT is set, only that path is used (recommended in production).
 */
function getMedegdelRoots() {
  if (ENV_ROOT) return [ENV_ROOT];
  const roots = [];
  if (require.main && require.main.filename) {
    roots.push(path.join(path.dirname(require.main.filename), "public", "medegdel"));
  }
  roots.push(path.join(__dirname, "..", "public", "medegdel"));
  roots.push(path.join(process.cwd(), "public", "medegdel"));
  return roots;
}

/**
 * Single root for uploads. Upload writes here; serve uses getMedegdelRoots() so they stay in sync.
 */
function getMedegdelPublicRoot() {
  if (ENV_ROOT) return ENV_ROOT;
  return getMedegdelRoots()[0];
}

module.exports = { getMedegdelRoots, getMedegdelPublicRoot };

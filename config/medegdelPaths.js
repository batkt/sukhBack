const path = require("path");

const ENV_ROOT = process.env.MEDEGDEL_UPLOAD_ROOT
  ? path.resolve(process.env.MEDEGDEL_UPLOAD_ROOT)
  : null;

/**
 * Single root for uploads. All medegdel/chat files must go here so serve finds them.
 * Prefer process.cwd() so it matches the legacy "public/medegdel/..." relative path.
 */
function getMedegdelPublicRoot() {
  if (ENV_ROOT) return ENV_ROOT;
  return path.join(process.cwd(), "public", "medegdel");
}

/**
 * Ordered list of directory roots for serving. Try upload root first, then fallbacks.
 */
function getMedegdelRoots() {
  if (ENV_ROOT) return [ENV_ROOT];
  const roots = [];
  roots.push(path.join(process.cwd(), "public", "medegdel"));
  if (require.main && require.main.filename) {
    roots.push(path.join(path.dirname(require.main.filename), "public", "medegdel"));
  }
  roots.push(path.join(__dirname, "..", "public", "medegdel"));
  return roots;
}

module.exports = { getMedegdelRoots, getMedegdelPublicRoot };

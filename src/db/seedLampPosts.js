const fs = require("fs");
const path = require("path");
const { isDbEnabled } = require("./client");
const lampPostRepository = require("./lampPostRepository");

async function seedLampPostsFromFile(filePath) {
  if (!isDbEnabled()) {
    return { skipped: true, reason: "database disabled" };
  }

  const absolutePath = filePath || path.join(__dirname, "..", "..", "data", "lamp-posts.seed.json");
  if (!fs.existsSync(absolutePath)) {
    return { skipped: true, reason: "seed file missing" };
  }

  const rows = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  let inserted = 0;
  for (const row of rows) {
    await lampPostRepository.upsertLampPost(row);
    inserted += 1;
  }
  return { skipped: false, inserted, total: await lampPostRepository.count() };
}

module.exports = {
  seedLampPostsFromFile,
};

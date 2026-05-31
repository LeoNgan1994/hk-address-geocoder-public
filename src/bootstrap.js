const { runMigrations } = require("./db/migrate");
const { seedLampPostsFromFile } = require("./db/seedLampPosts");
const lampPostRepository = require("./db/lampPostRepository");
const geocodeCacheRepository = require("./db/geocodeCacheRepository");

async function bootstrap() {
  const migration = await runMigrations();
  let cachePurged = 0;
  try {
    cachePurged = await geocodeCacheRepository.purgeExpired();
  } catch {
    cachePurged = 0;
  }
  let lampSeed = { skipped: true };
  let lampPostCount = 0;

  try {
    lampPostCount = await lampPostRepository.count();
    if (lampPostCount === 0) {
      lampSeed = await seedLampPostsFromFile();
      lampPostCount = await lampPostRepository.count();
    }
  } catch (error) {
    lampSeed = { skipped: true, reason: error.message };
  }

  return {
    migration,
    cachePurged,
    lampSeed,
    lampPostCount,
  };
}

module.exports = {
  bootstrap,
};

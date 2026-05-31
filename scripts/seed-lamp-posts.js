#!/usr/bin/env node
require("../src/loadEnv").loadEnv();
const { runMigrations } = require("../src/db/migrate");
const { seedLampPostsFromFile } = require("../src/db/seedLampPosts");
const { closePool } = require("../src/db/client");

async function main() {
  await runMigrations();
  const result = await seedLampPostsFromFile();
  console.log(JSON.stringify(result, null, 2));
  await closePool();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

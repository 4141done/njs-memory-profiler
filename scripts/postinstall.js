const fs = require("fs/promises");
console.log(`install script excuting from ${__dirname}`);
const path = require("path");
const package = require("../package.json");

// This is the user's local directory
const projectRoot = process.env.INIT_CWD;

const dest =
  process.env["NJS_MODULES_DIR"] || path.resolve(projectRoot, "/njs_modules");

try {
  await fs.access(dest);
} catch {
  await mkdir(dest, { recursive: true });
}

await fs.copyFile(path.resolve("..", package.main), dest);

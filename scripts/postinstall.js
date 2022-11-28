const fs = require("fs/promises");
console.log(`njs-memory-profiler install script excuting from ${__dirname}`);
const path = require("path");
const package = require("../package.json");

// This is the user's local directory
const projectRoot = process.env.INIT_CWD || "./";

// We'll assume that `njs_modules` is where all modules will go but let the user
// override if desired
const moduleBase =
  process.env["NJS_MODULES_DIR"] || path.resolve(projectRoot, "./njs_modules");

// Each module should be in its own folder in case it has multiple files
const dest = path.join(moduleBase, "njs-memory-profiler");

async function doCopy() {
  try {
    await fs.access(dest);
  } catch {
    await fs.mkdir(dest, { recursive: true });
  }

  await fs.copyFile(package.main, `${dest}/njs-memory-profiler.mjs`);
}

doCopy();

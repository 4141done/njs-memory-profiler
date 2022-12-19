const fs = require("fs/promises");
const path = require("path");
const package = require("../package.json");

// This is the user's local directory
const projectRoot = process.env.INIT_CWD || "./";

const moduleBase = path.resolve(projectRoot, "./njs_modules");

// Each module should be in its own folder in case it has multiple files
const libraryDirname = "njs-memory-profiler";
const dest = path.join(moduleBase, libraryDirname);
const tempDir = path.join(moduleBase, `${libraryDirname}.new`);
const confSrc = "./conf";

run();

// The goal here is to make sure we can assemble the new files in the
// expected location before deleting the old one.
async function run() {
  try {
    // copy to a new dir
    await doCopy(confSrc, tempDir);

    // remove the old files
    await removeExisting(dest);

    // rename dir we just copied to the expected name
    fs.rename(tempDir, dest);
  } catch (e) {
    console.error(`Failed to install njs-memory-profiler: ${e}`);
    removeExisting(tempDir);
  }
}

async function doCopy(confSrc, targetBaseDir) {
  const targetConfPath = path.join(targetBaseDir, "conf");
  // If we make the conf path recursively, it will ensure the existence of
  // the main dir as well.
  await fs.mkdir(targetConfPath, { recursive: true });
  await fs.copyFile(package.main, `${targetBaseDir}/njs-memory-profiler.mjs`);

  const files = await fs.readdir(confSrc);
  if (files.length === 0) throw `Expected files to be present in ${confSrc}`;

  for (let file of files) {
    await fs.copyFile(
      path.join(confSrc, file),
      path.join(targetConfPath, file)
    );
  }
}

async function removeExisting(existingBaseDir) {
  try {
    await fs.rm(existingBaseDir, { recursive: true });
  } catch (_e) {
    // We don't care if the folder was not there
  }
}

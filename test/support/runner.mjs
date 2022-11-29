/** @module Test Support Runner
 * Adapted from the Kaluma project's example at:
 * https://github.com/kaluma-project/kaluma/blob/master/tests/test-all.js
 * Note that this file is executed with nodejs, so njs restrictions are not
 * in place
 */

import childProcess from "child_process";

function cmd(cmd, args) {
  return childProcess.spawnSync(cmd, args, { stdio: "inherit" });
}

const tests = [
  cmd("njs", ["./test/main.test.mjs"]),
  // Your test file here
];

if (tests.some((r) => r.status !== 0)) {
  console.error(
    "\x1b[2K\r\x1b[97;101m SUITE FAILED \x1b[0m\x1b[91m\x1b[0m\r\n"
  );
  process.exit(1);
}

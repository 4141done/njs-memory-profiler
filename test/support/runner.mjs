import childProcess from "child_process";

function cmd(cmd, args) {
  return childProcess.spawnSync(cmd, args, { stdio: "inherit" });
}
let failed = false;
let result;
// Manually add test files here
const tests = [cmd("njs", ["./test/main.test.mjs"])];

if (tests.some((r) => r.status !== 0)) {
  console.error(
    "\x1b[2K\r\x1b[97;101m SUITE FAILED \x1b[0m\x1b[91m\x1b[0m\r\n"
  );
  process.exit(1);
}

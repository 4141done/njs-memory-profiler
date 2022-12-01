const fs = require("node:fs");
const readline = require("node:readline");
const REGEX = /.+js\:\s(\{.+\})/;
const src = process.argv[2];
const dest = process.argv[3];

if (!src || !dest) {
  console.error("usage: npm run log2json src.log dest.log");
  process.exit(1);
}

const rl = readline.createInterface({
  input: fs.createReadStream(src),
  crlfDelay: Infinity,
});
const ws = fs.createWriteStream(dest);
ws.write("[");
let lines = 0;
rl.on("line", (line) => {
  const match = line.match(REGEX);
  if (match) {
    if (lines === 0) {
      ws.write(`${match[1]}`);
    } else {
      ws.write(`, ${match[1]}`);
    }
    lines = lines + 1;
  }
});

rl.on("close", () => {
  ws.write("]");
  ws.end();
});

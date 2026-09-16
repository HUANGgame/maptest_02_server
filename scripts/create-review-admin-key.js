const fs = require("node:fs");
const path = require("node:path");
const { randomBytes, createHash } = require("node:crypto");
const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination)) throw new Error("Provide an absolute private output path outside this repository.");
const repository = path.resolve(__dirname, "..");
const relative = path.relative(repository, destination);
if (!relative.startsWith(".." + path.sep) && !path.isAbsolute(relative)) throw new Error("The key must stay outside the repository.");
const key = randomBytes(32).toString("hex");
fs.writeFileSync(destination, key + "\n", {flag: "wx", mode: 0o600});
fs.mkdirSync(path.join(repository, "config"), {recursive: true});
fs.writeFileSync(path.join(repository, "config/review-moderation.json"), JSON.stringify({
  keyHash: createHash("sha256").update(key).digest("hex"),
}, null, 2) + "\n");
console.log("Private key written outside the repository; only its SHA-256 verifier is stored in config.");

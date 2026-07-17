import crypto from "crypto";

const key = crypto.randomBytes(32);
const base64 = key.toString("base64");
const hex = key.toString("hex");

console.log("MESSAGE_ENCRYPTION_KEY (base64, 32 bytes):");
console.log(base64);
console.log("");
console.log("MESSAGE_ENCRYPTION_KEY (hex, 64 chars):");
console.log(hex);

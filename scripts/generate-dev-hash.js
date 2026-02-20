import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("Usage: node scripts/generate-dev-hash.js \"YourPasswordHere\"");
  process.exit(1);
}

const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
const hash = bcrypt.hashSync(password, rounds);

console.log(`DEV_OVERRIDE_PASSWORD_HASH=${hash}`);

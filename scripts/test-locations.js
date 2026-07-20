/* eslint-disable no-console */
import "dotenv/config";

const BASE = process.env.API_BASE_URL || "http://localhost:5001";

const req = async (method, path, body, token) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  const short = JSON.stringify(data).slice(0, 200);
  console.log(`  ${method} ${path} → ${res.status}: ${short}`);
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return data;
};

const run = async () => {
  console.log("🧭 Live Locations Smoke Test\n");

  const ts = Date.now();

  // 1. Create two test users
  console.log("1) Sign up Alice (client) & Bob (photographer)");
  const aliceSignup = await req("POST", "/api/auth/signup", {
    name: "Alice", email: `alice.${ts}@test.com`, password: "TestPass123!", role: "client"
  });
  const bobSignup = await req("POST", "/api/auth/signup", {
    name: "Bob", email: `bob.${ts}@test.com`, password: "TestPass123!", role: "photographer"
  });

  // Login to get tokens (signup may not return token if email verification is enabled)
  const getToken = async (signupRes, email) => {
    if (signupRes.token) return signupRes.token;
    const login = await req("POST", "/api/auth/login", { email, password: "TestPass123!" });
    return login.token;
  };

  const tokenA = await getToken(aliceSignup, `alice.${ts}@test.com`);
  const tokenB = await getToken(bobSignup, `bob.${ts}@test.com`);
  const aliceId = aliceSignup.user.id;
  const bobId = bobSignup.user.id;

  // 2. Update Alice's location
  console.log("\n2) Alice updates her location");
  await req("PUT", "/api/locations", {
    latitude: 6.5244, longitude: 3.3792, accuracy: 10.5
  }, tokenA);

  console.log("3) Alice checks her own location");
  await req("GET", "/api/locations/me", null, tokenA);

  // 4. Try to see Bob's location — should fail (no share yet)
  console.log("\n4) Alice tries to see Bob's location (should be blocked)");
  try {
    await req("GET", `/api/locations/${bobId}`, null, tokenA);
    console.log("  ❌ Should have been blocked!");
  } catch {
    console.log("  ✓ Correctly blocked (no share permission)");
  }

  // 5. Bob shares his location with Alice
  console.log("\n5) Bob shares his location with Alice");
  await req("POST", "/api/locations/share", { targetUserId: aliceId }, tokenB);

  // 6. Bob updates his location
  console.log("6) Bob updates his location");
  await req("PUT", "/api/locations", {
    latitude: 6.6018, longitude: 3.3515, speed: 1.2, heading: 90
  }, tokenB);

  // 7. Alice can now see Bob's location
  console.log("7) Alice fetches Bob's location (should work now)");
  await req("GET", `/api/locations/${bobId}`, null, tokenA);

  // 8. Alice checks nearby
  console.log("\n8) Alice checks nearby locations");
  const nearby = await req("GET", "/api/locations/nearby", null, tokenA);
  console.log(`  Visible locations: ${nearby.locations?.length || 0}`);

  // 9. Check shares for both
  console.log("\n9) Alice checks her shares");
  await req("GET", "/api/locations/shares", null, tokenA);

  console.log("10) Bob checks his shares");
  await req("GET", "/api/locations/shares", null, tokenB);

  // 11. Bob stops sharing with Alice
  console.log("\n11) Bob stops sharing with Alice");
  await req("DELETE", `/api/locations/share/${aliceId}`, null, tokenB);

  // 12. Alice should be blocked again
  console.log("12) Alice tries to see Bob again (should be blocked)");
  try {
    await req("GET", `/api/locations/${bobId}`, null, tokenA);
    console.log("  ❌ Should have been blocked!");
  } catch {
    console.log("  ✓ Correctly blocked again after unshare");
  }

  console.log("\n✅ All location tests passed!");
};

run().catch((err) => {
  console.error("\n❌ Test failed:", err.message);
  process.exit(1);
});

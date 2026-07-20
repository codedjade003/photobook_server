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
  const short = JSON.stringify(data).slice(0, 350);
  console.log(`  ${method} ${path} → ${res.status}: ${short}`);
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return data;
};

const run = async () => {
  console.log("🤝 Custom Offers Smoke Test\n");

  const ts = Date.now();

  // 1. Sign up a photographer and a client
  console.log("1) Create photographer (Alice) & client (Bob)");
  const alice = await req("POST", "/api/auth/signup", {
    name: "Alice Photo", email: `alice.${ts}@test.com`, password: "TestPass123!", role: "photographer"
  });
  const bob = await req("POST", "/api/auth/signup", {
    name: "Bob Client", email: `bob.${ts}@test.com`, password: "TestPass123!", role: "client"
  });

  const getToken = async (signupRes, email) => {
    if (signupRes.token) return signupRes.token;
    const login = await req("POST", "/api/auth/login", { email, password: "TestPass123!" });
    return login.token;
  };

  const tokA = await getToken(alice, `alice.${ts}@test.com`);
  const tokB = await getToken(bob, `bob.${ts}@test.com`);
  const aliceId = alice.user.id;
  const bobId = bob.user.id;

  // 2. Photographer sends an offer to client
  console.log("\n2) Alice (photographer) sends custom offer to Bob (client)");
  const offer1 = await req("POST", "/api/offers", {
    sentTo: bobId,
    serviceName: "Custom Wedding Package",
    pricingAmount: 350000,
    currencyCode: "NGN",
    description: "Tailored wedding coverage with extra hours and drone shots",
    categories: ["weddings", "events"],
    whatsIncluded: ["600+ edited photos", "12-hour coverage", "3 photographers", "Drone footage"],
    deliveryTime: "3-4 weeks",
    sessionDate: "2026-08-15",
    sessionTime: "09:00",
    locationType: "outdoor",
    locationText: "Lagos Island"
  }, tokA);
  const offer1Id = offer1.offer.id;
  console.log(`  Offer ID: ${offer1Id}, Status: ${offer1.offer.status}`);

  // 3. Client lists offers → should see it in "received"
  console.log("\n3) Bob checks his offers");
  const bobOffers = await req("GET", "/api/offers", null, tokB);
  console.log(`  Sent: ${bobOffers.sent.length}, Received: ${bobOffers.received.length}`);
  console.log(`  Received offer status: ${bobOffers.received[0]?.status}`);

  // 4. Client accepts the offer → session should be booked
  console.log("\n4) Bob ACCEPTS the offer");
  const accepted = await req("PATCH", `/api/offers/${offer1Id}/accept`, null, tokB);
  console.log(`  Offer status: ${accepted.offer.status}, Session ID: ${accepted.session.id}`);

  // 5. Client sends a counter-offer back to photographer
  console.log("\n5) Bob (client) sends a counter-offer to Alice");
  const offer2 = await req("POST", "/api/offers", {
    sentTo: aliceId,
    serviceName: "Budget Portrait Session",
    pricingAmount: 75000,
    description: "Can we do a shorter portrait session at this price?",
    categories: ["headshots", "events"],
    whatsIncluded: ["20 edited photos", "1-hour session"],
    deliveryTime: "1 week"
  }, tokB);
  const offer2Id = offer2.offer.id;

  // 6. Photographer declines the counter-offer
  console.log("\n6) Alice DECLINES the counter-offer");
  const declined = await req("PATCH", `/api/offers/${offer2Id}/decline`, null, tokA);
  console.log(`  Offer status: ${declined.offer.status}`);

  // 7. Photographer checks her offers (sent + received)
  console.log("\n7) Alice checks all her offers");
  const aliceOffers = await req("GET", "/api/offers", null, tokA);
  console.log(`  Sent: ${aliceOffers.sent.length}, Received: ${aliceOffers.received.length}`);
  const sentByAlice = aliceOffers.sent.find(o => o.id === offer1Id);
  console.log(`  Sent offer #1 status: ${sentByAlice?.status} (should be 'accepted')`);
  const receivedByAlice = aliceOffers.received.find(o => o.id === offer2Id);
  console.log(`  Received offer #2 status: ${receivedByAlice?.status} (should be 'declined')`);

  // 8. Create a 3rd offer and cancel it (sender cancels)
  console.log("\n8) Alice sends another offer then cancels it");
  const offer3 = await req("POST", "/api/offers", {
    sentTo: bobId,
    serviceName: "Cancel Test",
    pricingAmount: 1000
  }, tokA);
  const cancelled = await req("PATCH", `/api/offers/${offer3.offer.id}/cancel`, null, tokA);
  console.log(`  Offer status: ${cancelled.offer.status} (should be 'cancelled')`);

  console.log("\n✅ All custom offer tests passed!");
};

run().catch((err) => {
  console.error("\n❌ Test failed:", err.message);
  process.exit(1);
});

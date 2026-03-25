/* eslint-disable no-console */
const baseUrl = process.env.API_BASE_URL || "http://localhost:5000";

const request = async (method, path, body, token) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
};

const tryRequest = async (method, path, body, token) => {
  try {
    const data = await request(method, path, body, token);
    return { ok: true, status: 200, data };
  } catch (err) {
    const statusMatch = err.message.match(/failed \((\d+)\):\s*(.*)$/);
    const status = statusMatch ? Number(statusMatch[1]) : null;
    const payloadText = statusMatch ? statusMatch[2] : "{}";
    let payload = {};
    try {
      payload = JSON.parse(payloadText);
    } catch {
      payload = { message: payloadText };
    }
    return { ok: false, status, data: payload };
  }
};

const resolveTokenAfterSignup = async (signupResponse, email) => {
  if (signupResponse.token) {
    return signupResponse.token;
  }

  const configuredVerificationCode = process.env.SMOKE_TEST_VERIFICATION_CODE;
  if (configuredVerificationCode) {
    const verified = await request("POST", "/api/auth/verify-email", {
      email,
      code: configuredVerificationCode
    });
    return verified.token;
  }

  const resendAttempt = await tryRequest("POST", "/api/auth/verify-email/resend", { email });
  if (!resendAttempt.ok && resendAttempt.status === 429) {
    throw new Error(
      "Verification is enabled and token was not returned on signup. Resend endpoint is active (429 cooldown/limit). " +
      "Set SMOKE_TEST_VERIFICATION_CODE to continue full smoke test, or run with EMAIL_FEATURE_ENABLED=false for automated flow."
    );
  }
  if (!resendAttempt.ok) {
    throw new Error(
      `Verification is enabled and token was not returned on signup. Resend failed (${resendAttempt.status}): ${JSON.stringify(resendAttempt.data)}`
    );
  }

  throw new Error(
    "Verification is enabled and resend endpoint is working, but no code is available to this script. " +
    "Set SMOKE_TEST_VERIFICATION_CODE for automated verification, or run with EMAIL_FEATURE_ENABLED=false."
  );
};

const now = Date.now();
const photographerEmail = `photographer.${now}@example.com`;
const clientEmail = `client.${now}@example.com`;
const password = "Password123!";

const run = async () => {
  console.log("1) Signup photographer");
  const photographerSignup = await request("POST", "/api/auth/signup", {
    name: "Photographer Test",
    email: photographerEmail,
    password,
    role: "photographer"
  });
  const photographerToken = await resolveTokenAfterSignup(photographerSignup, photographerEmail);
  const photographerId = photographerSignup.user.id;

  console.log("2) Photographer profile");
  await request("PUT", "/api/profiles/photographer", {
    businessName: "Timmon Photography",
    displayTitle: "Corporate Photographer",
    about: "Backend smoke test photographer profile",
    tags: ["corporate", "event"]
  }, photographerToken);

  console.log("3) Photographer rate card");
  await request("POST", "/api/rate-card", {
    serviceName: "Corporate Event - Indoor",
    quantityLabel: "50 people",
    quantityMax: 50,
    pricingMode: "fixed",
    pricingAmount: 150000,
    currencyCode: "NGN",
    sortOrder: 1
  }, photographerToken);

  console.log("4) Photographer portfolio");
  await request("POST", "/api/portfolio", {
    mediaType: "image",
    storageKey: `portfolio/${now}.jpg`,
    mediaUrl: "https://example.com/photo.jpg",
    title: "Sample Work",
    description: "Smoke test media",
    tags: ["corporate", "indoor"],
    fileSizeBytes: 250000
  }, photographerToken);

  console.log("5) Signup client");
  const clientSignup = await request("POST", "/api/auth/signup", {
    name: "Client Test",
    email: clientEmail,
    password
  });
  const clientToken = await resolveTokenAfterSignup(clientSignup, clientEmail);

  console.log("6) Client selects role");
  await request("PATCH", "/api/auth/role", { role: "client" }, clientToken);

  console.log("7) Fetch event types and book session");
  const eventTypes = await request("GET", "/api/sessions/event-types");
  const firstEventType = eventTypes.eventTypes[0];
  if (!firstEventType) throw new Error("No event types found");

  await request("POST", "/api/sessions", {
    photographerId,
    eventTypeId: firstEventType.id,
    packageType: "regular",
    sessionDate: "2026-03-21",
    sessionTime: "15:30",
    locationType: "indoor",
    locationText: "Victoria Island, Lagos"
  }, clientToken);

  console.log("8) Verify session views");
  await request("GET", "/api/sessions/me", null, clientToken);
  await request("GET", "/api/sessions/me", null, photographerToken);

  console.log("Smoke test passed");
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

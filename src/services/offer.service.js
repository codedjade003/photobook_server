import { getClient } from "../config/db.js";
import { createOffer, findOfferById, listOffersForUser, updateOfferStatus, linkOfferToSession } from "../repositories/offer.repo.js";
import { findUserById } from "../repositories/user.repo.js";

export const sendOffer = async ({ userId, payload }) => {
  if (userId === payload.sentTo) {
    throw new Error("Cannot send an offer to yourself");
  }

  const recipient = await findUserById(payload.sentTo);
  if (!recipient) {
    throw new Error("Recipient not found");
  }

  const offer = await createOffer({ userId, payload });
  return offer;
};

export const getMyOffers = async (userId) => {
  const offers = await listOffersForUser(userId);

  const sent = [];
  const received = [];

  for (const offer of offers) {
    const isSender = offer.created_by === userId;
    const entry = {
      id: offer.id,
      serviceName: offer.service_name,
      description: offer.description,
      pricingAmount: offer.pricing_amount,
      currencyCode: offer.currency_code,
      pricingMode: offer.pricing_mode,
      categories: offer.categories,
      whatsIncluded: offer.whats_included,
      deliveryTime: offer.delivery_time,
      quantityLabel: offer.quantity_label,
      quantityMax: offer.quantity_max,
      status: offer.status,
      sessionId: offer.session_id,
      sessionDate: offer.session_date,
      sessionTime: offer.session_time,
      locationType: offer.location_type,
      locationText: offer.location_text,
      createdAt: offer.created_at,
      updatedAt: offer.updated_at,
      counterparty: isSender
        ? { id: offer.sent_to, name: offer.recipient_name, role: offer.recipient_role }
        : { id: offer.created_by, name: offer.sender_name, role: offer.sender_role },
      direction: isSender ? "sent" : "received"
    };

    if (isSender) {
      sent.push(entry);
    } else {
      received.push(entry);
    }
  }

  return { sent, received };
};

export const acceptOffer = async ({ userId, offerId }) => {
  const offer = await findOfferById(offerId);
  if (!offer) throw new Error("Offer not found");

  // Only the recipient can accept
  if (offer.sent_to !== userId) throw new Error("forbidden");

  if (offer.status !== "pending") {
    throw new Error(`Offer is already ${offer.status}`);
  }

  // Determine who is photographer and who is client based on roles
  const sender = await findUserById(offer.created_by);
  const recipient = await findUserById(offer.sent_to);

  const photographerId = sender.role === "photographer" ? sender.id : recipient.id;
  const clientId = sender.role === "client" ? sender.id : recipient.id;

  // If neither is a photographer, default to sender as photographer
  const effectivePhotographerId = photographerId || (sender.role === "photographer" ? sender.id : recipient.id);
  const effectiveClientId = clientId || (sender.role === "client" ? sender.id : recipient.id);

  // Auto-create a session (use a transaction so session + offer update are atomic)
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Get first available event type (default)
    const { rows: eventRows } = await client.query(
      `SELECT id FROM event_types WHERE active = TRUE ORDER BY id ASC LIMIT 1`
    );
    const defaultEventTypeId = eventRows[0]?.id || 1;

    const { rows: sessionRows } = await client.query(
      `INSERT INTO sessions (
        client_id, photographer_id, event_type_id, package_type,
        session_date, session_time, location_type, location_text
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        effectiveClientId,
        effectivePhotographerId,
        defaultEventTypeId,
        "regular",
        offer.session_date || new Date().toISOString().split("T")[0],
        offer.session_time || "12:00",
        offer.location_type || "indoor",
        offer.location_text || "To be confirmed"
      ]
    );
    const session = sessionRows[0];

    // Update offer using the SAME transaction client so it can see the session row
    await client.query(
      `UPDATE custom_offers SET status = 'accepted', session_id = $2, updated_at = NOW() WHERE id = $1`,
      [offerId, session.id]
    );

    await client.query("COMMIT");

    const updated = await findOfferById(offerId);
    return { offer: updated, session };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const declineOffer = async ({ userId, offerId }) => {
  const offer = await findOfferById(offerId);
  if (!offer) throw new Error("Offer not found");

  // Only the recipient can decline
  if (offer.sent_to !== userId) throw new Error("forbidden");

  if (offer.status !== "pending") {
    throw new Error(`Offer is already ${offer.status}`);
  }

  const updated = await updateOfferStatus({ offerId, status: "declined" });
  return updated;
};

export const cancelOffer = async ({ userId, offerId }) => {
  const offer = await findOfferById(offerId);
  if (!offer) throw new Error("Offer not found");

  // Only the sender can cancel their own pending offer
  if (offer.created_by !== userId) throw new Error("forbidden");

  if (offer.status !== "pending") {
    throw new Error(`Offer is already ${offer.status}`);
  }

  const updated = await updateOfferStatus({ offerId, status: "cancelled" });
  return updated;
};

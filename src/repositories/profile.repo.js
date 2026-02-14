import { query } from "../config/db.js";

export const ensureRoleProfile = async ({ userId, role }) => {
  if (role === "photographer") {
    await query(
      `INSERT INTO photographer_profiles (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    return;
  }

  await query(
    `INSERT INTO client_profiles (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
};

export const getMyProfile = async (userId) => {
  const { rows } = await query(
    `SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.phone,
      cp.profile_photo_url AS client_profile_photo_url,
      cp.location AS client_location,
      cp.joined_at,
      cp.bookings_count,
      pp.profile_photo_url AS photographer_profile_photo_url,
      pp.business_name,
      pp.display_title,
      pp.about_me,
      pp.tags,
      pp.star_rating,
      pp.total_reviews,
      pp.gallery_count,
      pp.media_used_bytes,
      pp.media_limit_bytes,
      pp.messaging_enabled
    FROM users u
    LEFT JOIN client_profiles cp ON cp.user_id = u.id
    LEFT JOIN photographer_profiles pp ON pp.user_id = u.id
    WHERE u.id = $1`,
    [userId]
  );
  return rows[0];
};

export const updatePhotographerProfile = async ({ userId, payload }) => {
  const { rows } = await query(
    `UPDATE photographer_profiles
     SET
       business_name = COALESCE($2, business_name),
       profile_photo_url = COALESCE($3, profile_photo_url),
       display_title = COALESCE($4, display_title),
       about_me = COALESCE($5, about_me),
       tags = COALESCE($6, tags),
       updated_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [
      userId,
      payload.businessName ?? null,
      payload.profilePhotoUrl ?? null,
      payload.displayTitle ?? null,
      payload.about ?? null,
      payload.tags ?? null
    ]
  );
  return rows[0];
};

export const updateClientProfile = async ({ userId, payload }) => {
  const { rows } = await query(
    `UPDATE client_profiles
     SET
       profile_photo_url = COALESCE($2, profile_photo_url),
       location = COALESCE($3, location),
       updated_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [userId, payload.profilePhotoUrl ?? null, payload.location ?? null]
  );
  return rows[0];
};

import { query } from "../config/db.js";

const getUsersOrderBy = (sort) => {
  if (sort === "rating") {
    return "COALESCE(pp.star_rating, 0) DESC, COALESCE(pp.total_reviews, 0) DESC, discovery_score DESC, u.created_at DESC";
  }
  if (sort === "reviews") {
    return "COALESCE(pp.total_reviews, 0) DESC, COALESCE(pp.star_rating, 0) DESC, discovery_score DESC, u.created_at DESC";
  }
  if (sort === "relevance") {
    return "discovery_score DESC, COALESCE(pp.star_rating, 0) DESC, COALESCE(pp.total_reviews, 0) DESC, u.created_at DESC";
  }
  if (sort === "trending") {
    return "trending_score DESC, discovery_score DESC, u.created_at DESC";
  }
  return "u.created_at DESC, discovery_score DESC";
};

const getPortfolioOrderBy = (sort) => {
  if (sort === "popular") {
    return "COALESCE(pm.view_count, 0) DESC, search_score DESC, pm.created_at DESC";
  }
  if (sort === "relevance") {
    return "search_score DESC, COALESCE(pm.view_count, 0) DESC, pm.created_at DESC";
  }
  return "pm.created_at DESC, search_score DESC";
};

export const searchUsers = async ({
  q,
  role,
  limit,
  offset,
  sort,
  minRating,
  minReviews,
  location,
  tags,
  matchAllTags,
  hasPortfolio
}) => {
  const searchTerm = q ? q.trim() : null;
  const normalizedTags = Array.isArray(tags) && tags.length ? tags : null;

  const whereClause = `
    WHERE ($1::text IS NULL OR u.role = $1)
      AND ($2::numeric IS NULL OR COALESCE(pp.star_rating, 0) >= $2)
      AND ($3::int IS NULL OR COALESCE(pp.total_reviews, 0) >= $3)
      AND (
        $4::text IS NULL
        OR cp.location ILIKE '%' || $4 || '%'
        OR pp.business_name ILIKE '%' || $4 || '%'
      )
      AND (
        $5::text[] IS NULL
        OR (
          CASE
            WHEN $6::boolean = TRUE THEN COALESCE(pp.tags, ARRAY[]::text[]) @> $5::text[]
            ELSE COALESCE(pp.tags, ARRAY[]::text[]) && $5::text[]
          END
        )
      )
      AND (
        $7::boolean IS NULL
        OR $7::boolean = FALSE
        OR EXISTS (
          SELECT 1
          FROM portfolio_media pm_any
          WHERE pm_any.photographer_id = u.id
        )
      )
      AND (
        $8::text IS NULL
        OR u.name ILIKE '%' || $8 || '%'
        OR pp.business_name ILIKE '%' || $8 || '%'
        OR pp.display_title ILIKE '%' || $8 || '%'
        OR pp.about_me ILIKE '%' || $8 || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(pp.tags, ARRAY[]::text[])) tag
          WHERE tag ILIKE '%' || $8 || '%'
        )
      )
  `;

  const listSql = `
    SELECT
      u.id,
      u.name,
      u.role,
      u.created_at,
      cp.profile_photo_url AS client_profile_photo_url,
      cp.location AS client_location,
      pp.profile_photo_url AS photographer_profile_photo_url,
      pp.business_name,
      pp.display_title,
      pp.about_me,
      pp.tags,
      pp.star_rating,
      pp.total_reviews,
      pp.gallery_count,
      cover.media_url AS cover_media_url,
      (
        COALESCE(
          CASE
            WHEN $8::text IS NULL THEN 0
            ELSE ts_rank_cd(
              setweight(to_tsvector('simple', COALESCE(u.name, '')), 'A')
              || setweight(to_tsvector('simple', COALESCE(pp.business_name, '')), 'A')
              || setweight(to_tsvector('simple', COALESCE(pp.display_title, '')), 'B')
              || setweight(to_tsvector('simple', COALESCE(pp.about_me, '')), 'C')
              || setweight(to_tsvector('simple', array_to_string(COALESCE(pp.tags, ARRAY[]::text[]), ' ')), 'A'),
              plainto_tsquery('simple', $8)
            )
          END,
          0
        ) * 0.50
        + (COALESCE(pp.star_rating, 0) / 5.0) * 0.20
        + (LN(COALESCE(pp.total_reviews, 0) + 1) / LN(101)) * 0.15
        + (LN(COALESCE(pp.gallery_count, 0) + 1) / LN(201)) * 0.10
        + GREATEST(0, 1 - (EXTRACT(EPOCH FROM (NOW() - u.created_at)) / 31536000)) * 0.05
      ) AS discovery_score,
      (
        (COALESCE(pp.star_rating, 0) / 5.0) * 0.35
        + (LN(COALESCE(pp.total_reviews, 0) + 1) / LN(201)) * 0.40
        + (LN(COALESCE(pp.gallery_count, 0) + 1) / LN(301)) * 0.15
        + GREATEST(0, 1 - (EXTRACT(EPOCH FROM (NOW() - u.created_at)) / 2592000)) * 0.10
      ) AS trending_score
    FROM users u
    LEFT JOIN client_profiles cp ON cp.user_id = u.id
    LEFT JOIN photographer_profiles pp ON pp.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT pm.media_url
      FROM portfolio_media pm
      WHERE pm.photographer_id = u.id
      ORDER BY pm.is_cover DESC, pm.created_at DESC
      LIMIT 1
    ) cover ON TRUE
    ${whereClause}
    ORDER BY ${getUsersOrderBy(sort)}
    LIMIT $9 OFFSET $10
  `;

  const countSql = `
    SELECT COUNT(*)::INT AS total
    FROM users u
    LEFT JOIN client_profiles cp ON cp.user_id = u.id
    LEFT JOIN photographer_profiles pp ON pp.user_id = u.id
    ${whereClause}
  `;

  const params = [
    role || null,
    minRating ?? null,
    minReviews ?? null,
    location || null,
    normalizedTags,
    Boolean(matchAllTags),
    hasPortfolio ?? null,
    searchTerm,
    limit,
    offset
  ];

  const [listResult, countResult] = await Promise.all([
    query(listSql, params),
    query(countSql, params.slice(0, 8))
  ]);

  return {
    items: listResult.rows,
    total: countResult.rows[0]?.total || 0
  };
};

export const searchPortfolio = async ({ q, mediaType, tags, photographerId, limit, offset, sort }) => {
  const searchTerm = q ? q.trim() : null;
  const normalizedTags = Array.isArray(tags) && tags.length ? tags : null;

  const whereClause = `
    WHERE ($1::text IS NULL OR pm.photographer_id = $1::uuid)
      AND ($2::text IS NULL OR pm.media_type = $2)
      AND ($3::text[] IS NULL OR COALESCE(pm.tags, ARRAY[]::text[]) && $3::text[])
      AND (
        $4::text IS NULL
        OR pm.title ILIKE '%' || $4 || '%'
        OR pm.description ILIKE '%' || $4 || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(pm.tags, ARRAY[]::text[])) tag
          WHERE tag ILIKE '%' || $4 || '%'
        )
      )
  `;

  const listSql = `
    SELECT
      pm.id,
      pm.photographer_id,
      pm.media_type,
      pm.media_url,
      pm.title,
      pm.description,
      pm.tags,
      pm.duration_seconds,
      pm.view_count,
      pm.is_cover,
      pm.created_at,
      u.name AS photographer_name,
      pp.business_name,
      pp.display_title,
      pp.star_rating,
      pp.total_reviews,
      (
        COALESCE(
          CASE
            WHEN $4::text IS NULL THEN 0
            ELSE ts_rank_cd(
              setweight(to_tsvector('simple', COALESCE(pm.title, '')), 'A')
              || setweight(to_tsvector('simple', COALESCE(pm.description, '')), 'B')
              || setweight(to_tsvector('simple', array_to_string(COALESCE(pm.tags, ARRAY[]::text[]), ' ')), 'A'),
              plainto_tsquery('simple', $4)
            )
          END,
          0
        ) * 0.70
        + (LN(COALESCE(pm.view_count, 0) + 1) / LN(1001)) * 0.20
        + GREATEST(0, 1 - (EXTRACT(EPOCH FROM (NOW() - pm.created_at)) / 31536000)) * 0.10
      ) AS search_score
    FROM portfolio_media pm
    INNER JOIN users u ON u.id = pm.photographer_id
    LEFT JOIN photographer_profiles pp ON pp.user_id = pm.photographer_id
    ${whereClause}
    ORDER BY ${getPortfolioOrderBy(sort)}
    LIMIT $5 OFFSET $6
  `;

  const countSql = `
    SELECT COUNT(*)::INT AS total
    FROM portfolio_media pm
    ${whereClause}
  `;

  const params = [photographerId || null, mediaType || null, normalizedTags, searchTerm, limit, offset];
  const [listResult, countResult] = await Promise.all([
    query(listSql, params),
    query(countSql, params.slice(0, 4))
  ]);

  return {
    items: listResult.rows,
    total: countResult.rows[0]?.total || 0
  };
};

export const findSimilarPhotographers = async ({ userId, limit, offset }) => {
  const sql = `
    WITH target AS (
      SELECT
        u.id,
        COALESCE(pp.tags, ARRAY[]::text[]) AS tags,
        CONCAT_WS(' ', u.name, pp.business_name, pp.display_title, pp.about_me) AS text_blob
      FROM users u
      LEFT JOIN photographer_profiles pp ON pp.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    )
    SELECT
      u.id,
      u.name,
      u.role,
      u.created_at,
      pp.profile_photo_url AS photographer_profile_photo_url,
      pp.business_name,
      pp.display_title,
      pp.about_me,
      pp.tags,
      pp.star_rating,
      pp.total_reviews,
      pp.gallery_count,
      cover.media_url AS cover_media_url,
      (
        (
          SELECT COUNT(*)::numeric
          FROM unnest(COALESCE(pp.tags, ARRAY[]::text[])) candidate_tag
          WHERE candidate_tag = ANY(target.tags)
        ) / GREATEST(array_length(target.tags, 1), 1)
      ) * 0.55
      + COALESCE(
        ts_rank_cd(
          to_tsvector('simple', CONCAT_WS(' ', u.name, pp.business_name, pp.display_title, pp.about_me, array_to_string(COALESCE(pp.tags, ARRAY[]::text[]), ' '))),
          plainto_tsquery('simple', target.text_blob)
        ),
        0
      ) * 0.25
      + (COALESCE(pp.star_rating, 0) / 5.0) * 0.10
      + (LN(COALESCE(pp.total_reviews, 0) + 1) / LN(201)) * 0.10
      AS similarity_score
    FROM target
    INNER JOIN users u ON u.id <> target.id
    LEFT JOIN photographer_profiles pp ON pp.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT pm.media_url
      FROM portfolio_media pm
      WHERE pm.photographer_id = u.id
      ORDER BY pm.is_cover DESC, pm.created_at DESC
      LIMIT 1
    ) cover ON TRUE
    WHERE u.role = 'photographer'
    ORDER BY similarity_score DESC, pp.star_rating DESC NULLS LAST, pp.total_reviews DESC, u.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const countSql = `
    SELECT COUNT(*)::INT AS total
    FROM users
    WHERE role = 'photographer' AND id <> $1
  `;

  const [listResult, countResult] = await Promise.all([
    query(sql, [userId, limit, offset]),
    query(countSql, [userId])
  ]);

  return {
    items: listResult.rows,
    total: countResult.rows[0]?.total || 0
  };
};

export const findSimilarPortfolioItems = async ({ itemId, limit, offset }) => {
  const sql = `
    WITH target AS (
      SELECT
        pm.id,
        pm.photographer_id,
        COALESCE(pm.tags, ARRAY[]::text[]) AS tags,
        CONCAT_WS(' ', pm.title, pm.description, array_to_string(COALESCE(pm.tags, ARRAY[]::text[]), ' ')) AS text_blob
      FROM portfolio_media pm
      WHERE pm.id = $1
      LIMIT 1
    )
    SELECT
      pm.id,
      pm.photographer_id,
      pm.media_type,
      pm.media_url,
      pm.title,
      pm.description,
      pm.tags,
      pm.duration_seconds,
      pm.view_count,
      pm.is_cover,
      pm.created_at,
      u.name AS photographer_name,
      pp.business_name,
      (
        (
          SELECT COUNT(*)::numeric
          FROM unnest(COALESCE(pm.tags, ARRAY[]::text[])) candidate_tag
          WHERE candidate_tag = ANY(target.tags)
        ) / GREATEST(array_length(target.tags, 1), 1)
      ) * 0.60
      + COALESCE(
        ts_rank_cd(
          to_tsvector('simple', CONCAT_WS(' ', pm.title, pm.description, array_to_string(COALESCE(pm.tags, ARRAY[]::text[]), ' '))),
          plainto_tsquery('simple', target.text_blob)
        ),
        0
      ) * 0.30
      + CASE WHEN pm.photographer_id = target.photographer_id THEN 0.10 ELSE 0 END
      AS similarity_score
    FROM target
    INNER JOIN portfolio_media pm ON pm.id <> target.id
    INNER JOIN users u ON u.id = pm.photographer_id
    LEFT JOIN photographer_profiles pp ON pp.user_id = pm.photographer_id
    ORDER BY similarity_score DESC, COALESCE(pm.view_count, 0) DESC, pm.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const countSql = `
    SELECT COUNT(*)::INT AS total
    FROM portfolio_media
    WHERE id <> $1
  `;

  const [listResult, countResult] = await Promise.all([
    query(sql, [itemId, limit, offset]),
    query(countSql, [itemId])
  ]);

  return {
    items: listResult.rows,
    total: countResult.rows[0]?.total || 0
  };
};

export const getTrendingTags = async (limit = 20) => {
  const sql = `
    SELECT tag, usage_count
    FROM (
      SELECT
        LOWER(TRIM(tag)) AS tag,
        COUNT(*)::INT AS usage_count
      FROM portfolio_media pm,
      LATERAL unnest(COALESCE(pm.tags, ARRAY[]::text[])) tag
      WHERE TRIM(tag) <> ''
      GROUP BY LOWER(TRIM(tag))
    ) ranked
    ORDER BY usage_count DESC, tag ASC
    LIMIT $1
  `;

  const { rows } = await query(sql, [limit]);
  return rows;
};

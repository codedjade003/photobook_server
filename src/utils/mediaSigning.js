import { getSignedObjectUrl } from "../config/b2.js";

export const normalizePortfolioItemWithSignedUrl = async (item) => {
  if (!item) return null;
  const signedUrl = await getSignedObjectUrl({
    storageKey: item.storage_key,
    mediaUrl: item.media_url
  });

  return {
    id: item.id,
    type: item.media_type,
    url: signedUrl || item.media_url || null,
    signedUrl,
    storageKey: item.storage_key,
    title: item.title,
    description: item.description,
    tags: item.tags,
    fileSizeBytes: item.file_size_bytes,
    durationSeconds: item.duration_seconds,
    isCover: item.is_cover,
    viewCount: item.view_count,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
};

export const signProfilePhotoUrls = async (profile) => {
  if (!profile) return profile;

  const [profilePhotoSignedUrl, clientPhotoSignedUrl, photographerPhotoSignedUrl] = await Promise.all([
    getSignedObjectUrl({ mediaUrl: profile.profile_photo_url }),
    getSignedObjectUrl({ mediaUrl: profile.client_profile_photo_url }),
    getSignedObjectUrl({ mediaUrl: profile.photographer_profile_photo_url })
  ]);

  return {
    ...profile,
    profile_photo_signed_url: profilePhotoSignedUrl,
    client_profile_photo_signed_url: clientPhotoSignedUrl,
    photographer_profile_photo_signed_url: photographerPhotoSignedUrl,
    profile_photo_url: profilePhotoSignedUrl || profile.profile_photo_url || null,
    client_profile_photo_url: clientPhotoSignedUrl || profile.client_profile_photo_url || null,
    photographer_profile_photo_url: photographerPhotoSignedUrl || profile.photographer_profile_photo_url || null
  };
};

export const signUserDiscoveryMedia = async (item) => {
  const [coverSignedUrl, clientPhotoSignedUrl, photographerPhotoSignedUrl] = await Promise.all([
    getSignedObjectUrl({ mediaUrl: item.cover_media_url }),
    getSignedObjectUrl({ mediaUrl: item.client_profile_photo_url }),
    getSignedObjectUrl({ mediaUrl: item.photographer_profile_photo_url })
  ]);

  return {
    ...item,
    cover_media_signed_url: coverSignedUrl,
    cover_media_url: coverSignedUrl || item.cover_media_url || null,
    client_profile_photo_signed_url: clientPhotoSignedUrl,
    client_profile_photo_url: clientPhotoSignedUrl || item.client_profile_photo_url || null,
    photographer_profile_photo_signed_url: photographerPhotoSignedUrl,
    photographer_profile_photo_url: photographerPhotoSignedUrl || item.photographer_profile_photo_url || null
  };
};

export const signPortfolioSearchMedia = async (item) => {
  const signedUrl = await getSignedObjectUrl({
    storageKey: item.storage_key,
    mediaUrl: item.media_url
  });

  return {
    ...item,
    media_signed_url: signedUrl,
    media_url: signedUrl || item.media_url || null
  };
};

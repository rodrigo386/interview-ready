import { gravatarUrl } from "./gravatar";

type StorageLike = {
  storage: {
    from(bucket: string): {
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
};

export function resolveAvatarUrl(
  profile: { email: string; avatarPath: string | null; avatarUpdatedAt: string | null },
  supabase: StorageLike,
): string {
  if (!profile.avatarPath) {
    return gravatarUrl(profile.email, 128);
  }
  const { data } = supabase.storage.from("avatars").getPublicUrl(profile.avatarPath);
  const v = profile.avatarUpdatedAt ? new Date(profile.avatarUpdatedAt).getTime() : 0;
  return `${data.publicUrl}?v=${v}`;
}

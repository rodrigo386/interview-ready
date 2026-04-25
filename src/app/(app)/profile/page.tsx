"use client";

import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { useProfileShell } from "@/components/profile/ProfileShellProvider";
import { AvatarEditor } from "@/components/profile/AvatarEditor";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { removeAvatar, updateAvatarPath, updateProfile } from "./actions";

export default function ProfilePage() {
  const data = useProfileShell();
  const supabase = createBrowserClient();

  const uploadFn = async (path: string, file: File) => {
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Foto</h2>
        <AvatarEditor
          userId={data.id}
          currentUrl={data.resolvedAvatarUrl}
          hasCustomAvatar={Boolean(data.avatarPath)}
          uploadFn={uploadFn}
          updatePathAction={updateAvatarPath}
          removeAction={removeAvatar}
        />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Identidade</h2>
        <ProfileForm
          initialFullName={data.fullName}
          initialLanguage={data.preferredLanguage}
          action={updateProfile}
        />
      </section>
    </div>
  );
}

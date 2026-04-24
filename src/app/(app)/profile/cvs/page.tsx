import { CvList } from "@/components/profile/CvList";

export default function ProfileCvsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-text-primary">Seus CVs</h2>
        <p className="text-sm text-text-secondary">
          Originais que você enviou e versões reescritas pela IA.
        </p>
      </header>
      <CvList />
    </div>
  );
}

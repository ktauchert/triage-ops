import Link from "next/link";
import {
  LegalDocumentBody,
  readLegalDocument,
} from "@/lib/legal/render-legal-document";
import { LEGAL_PATHS } from "@/lib/legal/paths";

export default async function ImpressumPage() {
  const markdown = await readLegalDocument("impressum.md");

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b px-4 py-3 text-sm text-muted-foreground">
        <Link href="/login" className="underline">
          Back to sign in
        </Link>
        <span className="mx-2">·</span>
        <Link href={LEGAL_PATHS.privacy} className="underline">
          Privacy Policy
        </Link>
        <span className="mx-2">·</span>
        <Link href={LEGAL_PATHS.eula} className="underline">
          EULA
        </Link>
      </div>
      <LegalDocumentBody markdown={markdown} />
    </div>
  );
}

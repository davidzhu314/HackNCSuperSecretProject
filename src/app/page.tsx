import { PersonaFlow } from "@/components/PersonaFlow";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">PERSONA</h1>
        <p className="text-muted-foreground">One identity. Every platform. Authentically you.</p>
        <p className="text-sm text-muted-foreground">
          Improve how you express yourself, without inventing who you are. Rewrites only use facts you confirm.
        </p>
      </header>
      <PersonaFlow />
    </main>
  );
}

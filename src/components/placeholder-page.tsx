import { messages } from "@/messages/pt-BR";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p>{messages.placeholders.comingSoon}</p>
    </main>
  );
}

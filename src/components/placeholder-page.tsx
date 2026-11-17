import { messages } from "@/messages/pt-BR";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <section className="sheet p-6 min-[60rem]:p-10">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="lbl mt-2">{messages.placeholders.comingSoon}</p>
      </section>
    </main>
  );
}

import { messages } from "@/messages/pt-BR";

const skeletonWidths = ["70%", "45%", "82%", "58%", "66%", "40%", "74%"];

export default function TransactionsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <div className="h-10 w-64 rounded-lg bg-accent motion-safe:animate-pulse" />
      <section
        className="sheet p-6 min-[60rem]:px-8 min-[60rem]:py-8"
        aria-busy="true"
        aria-label={messages.transactions.loadingAria}
      >
        {skeletonWidths.map((width, index) => (
          <div key={index} className="sk motion-safe:animate-pulse">
            <span />
            <span style={{ width }} />
            <span />
          </div>
        ))}
      </section>
    </main>
  );
}

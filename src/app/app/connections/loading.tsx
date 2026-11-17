import { messages } from "@/messages/pt-BR";

export default function ConnectionsLoading() {
  return (
    <main
      role="status"
      aria-label={messages.screens.connectionsLoadingAria}
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10"
    >
      <div className="h-7 w-56 rounded bg-accent motion-safe:animate-pulse" />
      <section className="sheet p-5 min-[60rem]:p-8" aria-busy="true">
        <div className="sk">
          <span />
          <span className="w-3/5" />
          <span />
        </div>
        <div className="sk">
          <span />
          <span className="w-2/5" />
          <span />
        </div>
        <div className="sk">
          <span />
          <span className="w-4/5" />
          <span />
        </div>
      </section>
    </main>
  );
}

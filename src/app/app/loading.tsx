import { messages } from "@/messages/pt-BR";

export default function OverviewLoading() {
  return (
    <main
      role="status"
      aria-label={messages.overview.loadingAria}
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10"
    >
      <div className="h-11 w-64 rounded-lg bg-secondary p-1 motion-safe:animate-pulse min-[60rem]:h-9" />

      <div className="flex flex-col gap-8 min-[60rem]:flex-row min-[60rem]:items-start min-[60rem]:gap-10">
        <article className="min-w-0 flex-1 rounded-lg border border-border bg-card p-5 shadow-xs min-[60rem]:p-10">
          <div className="h-4 w-48 rounded bg-accent motion-safe:animate-pulse" />
          <div className="mt-3 h-12 w-72 max-w-full rounded bg-accent motion-safe:animate-pulse" />
          <div className="mt-3 h-4 w-80 max-w-full rounded bg-accent motion-safe:animate-pulse" />

          <div className="mt-8 h-40 w-full rounded bg-accent motion-safe:animate-pulse" />

          <div className="mt-8 flex flex-col gap-3">
            <div className="h-5 w-40 rounded bg-accent motion-safe:animate-pulse" />
            <div className="h-8 w-full rounded bg-accent motion-safe:animate-pulse" />
            <div className="h-8 w-full rounded bg-accent motion-safe:animate-pulse" />
            <div className="h-8 w-full rounded bg-accent motion-safe:animate-pulse" />
          </div>
        </article>

        <aside className="flex w-full flex-col gap-6 min-[60rem]:w-80 min-[60rem]:shrink-0">
          <div className="h-32 w-full rounded-lg bg-accent motion-safe:animate-pulse" />
          <div className="h-24 w-full rounded-lg bg-accent motion-safe:animate-pulse" />
        </aside>
      </div>
    </main>
  );
}

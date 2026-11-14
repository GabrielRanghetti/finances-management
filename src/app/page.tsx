import Link from "next/link";

import { messages } from "@/messages/pt-BR";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">{messages.home.title}</h1>
      <p className="text-zinc-600">{messages.home.subtitle}</p>
      <div className="flex gap-3">
        <Link className="rounded bg-black px-4 py-2 text-white" href="/sign-in">
          {messages.home.ctaSignIn}
        </Link>
        <Link className="rounded border px-4 py-2" href="/sign-up">
          {messages.home.ctaSignUp}
        </Link>
      </div>
    </main>
  );
}

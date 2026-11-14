"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { messages } from "@/messages/pt-BR";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
    });

    if (signUpError) {
      setError(messages.signUp.errorGeneric);
      return;
    }

    router.push("/app");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">{messages.signUp.title}</h1>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <input
          className="rounded border px-3 py-2"
          type="text"
          placeholder={messages.signUp.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="rounded border px-3 py-2"
          type="email"
          placeholder={messages.signUp.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="rounded border px-3 py-2"
          type="password"
          placeholder={messages.signUp.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="rounded bg-black px-3 py-2 text-white" type="submit">
          {messages.signUp.submit}
        </button>
      </form>
      <Link className="text-sm underline" href="/sign-in">
        {messages.signUp.hasAccount}
      </Link>
    </main>
  );
}

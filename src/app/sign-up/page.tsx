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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <section className="sheet flex flex-col gap-6 p-6 min-[60rem]:p-10">
        <div>
          <p className="lbl">{messages.appName}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {messages.signUp.title}
          </h1>
        </div>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="field">
            <span className="lbl">{messages.signUp.name}</span>
            <input
              className="inp"
              type="text"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="lbl">{messages.signUp.email}</span>
            <input
              className="inp"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="lbl">{messages.signUp.password}</span>
            <input
              className="inp"
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>

          {error ? (
            <p role="alert" className="neg text-sm font-medium">
              {error}
            </p>
          ) : null}

          <button className="btn btn--ink mt-1" type="submit">
            {messages.signUp.submit}
          </button>
        </form>

        <div className="border-t border-border pt-4 text-sm">
          <Link href="/sign-in">{messages.signUp.hasAccount}</Link>
        </div>
      </section>
    </main>
  );
}

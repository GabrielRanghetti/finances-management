"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (needsTwoFactor) {
      const { error: verifyError } = await authClient.twoFactor.verifyTotp({
        code: totpCode,
      });
      if (verifyError) {
        setError(verifyError.message ?? "Código inválido");
        return;
      }
      router.push("/app");
      return;
    }

    const { data, error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message ?? "Falha ao entrar");
      return;
    }

    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setNeedsTwoFactor(true);
      return;
    }

    router.push("/app");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        {!needsTwoFactor ? (
          <>
            <input
              className="rounded border px-3 py-2"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="rounded border px-3 py-2"
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </>
        ) : (
          <input
            className="rounded border px-3 py-2"
            type="text"
            placeholder="Código TOTP"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            required
          />
        )}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="rounded bg-black px-3 py-2 text-white" type="submit">
          {needsTwoFactor ? "Verificar" : "Entrar"}
        </button>
      </form>
      <a className="text-sm underline" href="/sign-up">
        Criar conta
      </a>
    </main>
  );
}

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { messages } from "@/messages/pt-BR";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (needsTwoFactor) {
      if (useRecoveryCode) {
        const { error: verifyError } =
          await authClient.twoFactor.verifyBackupCode({
            code: recoveryCode,
          });
        if (verifyError) {
          setError(verifyError.message ?? messages.signIn.errorRecovery);
          return;
        }
      } else {
        const { error: verifyError } = await authClient.twoFactor.verifyTotp({
          code: totpCode,
        });
        if (verifyError) {
          setError(verifyError.message ?? messages.signIn.errorTotp);
          return;
        }
      }
      router.push("/app");
      return;
    }

    const { data, error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message ?? messages.signIn.errorGeneric);
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
      <h1 className="text-2xl font-semibold">{messages.signIn.title}</h1>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        {!needsTwoFactor ? (
          <>
            <input
              className="rounded border px-3 py-2"
              type="email"
              placeholder={messages.signIn.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="rounded border px-3 py-2"
              type="password"
              placeholder={messages.signIn.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </>
        ) : useRecoveryCode ? (
          <input
            className="rounded border px-3 py-2"
            type="text"
            placeholder={messages.signIn.recoveryCode}
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            required
          />
        ) : (
          <input
            className="rounded border px-3 py-2"
            type="text"
            placeholder={messages.signIn.totp}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            required
          />
        )}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="rounded bg-black px-3 py-2 text-white" type="submit">
          {needsTwoFactor ? messages.signIn.verify : messages.signIn.submit}
        </button>
      </form>
      {needsTwoFactor ? (
        <button
          className="text-left text-sm underline"
          type="button"
          onClick={() => {
            setUseRecoveryCode((value) => !value);
            setError(null);
          }}
        >
          {useRecoveryCode
            ? messages.signIn.useTotp
            : messages.signIn.useRecoveryCode}
        </button>
      ) : null}
      <Link className="text-sm underline" href="/sign-up">
        {messages.signIn.createAccount}
      </Link>
    </main>
  );
}

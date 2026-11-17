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
          setError(messages.signIn.errorRecovery);
          return;
        }
      } else {
        const { error: verifyError } = await authClient.twoFactor.verifyTotp({
          code: totpCode,
        });
        if (verifyError) {
          setError(messages.signIn.errorTotp);
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
      setError(messages.signIn.errorGeneric);
      return;
    }

    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setNeedsTwoFactor(true);
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
            {messages.signIn.title}
          </h1>
        </div>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          {!needsTwoFactor ? (
            <>
              <label className="field">
                <span className="lbl">{messages.signIn.email}</span>
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
                <span className="lbl">{messages.signIn.password}</span>
                <input
                  className="inp"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
            </>
          ) : useRecoveryCode ? (
            <label className="field">
              <span className="lbl">{messages.signIn.recoveryCode}</span>
              <input
                className="inp fig"
                type="text"
                name="recoveryCode"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                required
              />
            </label>
          ) : (
            <label className="field">
              <span className="lbl">{messages.signIn.totp}</span>
              <input
                className="inp fig"
                type="text"
                name="totpCode"
                inputMode="numeric"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                required
              />
            </label>
          )}

          {error ? (
            <p role="alert" className="neg text-sm font-medium">
              {error}
            </p>
          ) : null}

          <button className="btn btn--ink mt-1" type="submit">
            {needsTwoFactor ? messages.signIn.verify : messages.signIn.submit}
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
          {needsTwoFactor ? (
            <button
              className="btn btn--card"
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
          <Link href="/sign-up">{messages.signIn.createAccount}</Link>
        </div>
      </section>
    </main>
  );
}

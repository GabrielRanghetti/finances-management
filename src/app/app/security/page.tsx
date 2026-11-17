"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { messages } from "@/messages/pt-BR";

export default function SecurityPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enableTwoFactor(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const { data, error: enableError } = await authClient.twoFactor.enable({
      password,
    });

    if (enableError) {
      setError(messages.security.errorEnable);
      return;
    }

    if (data && "totpURI" in data) {
      setTotpURI(data.totpURI);
      setBackupCodes(data.backupCodes);
    }
  }

  async function verifyTwoFactor(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const { error: verifyError } = await authClient.twoFactor.verifyTotp({
      code: totpCode,
    });

    if (verifyError) {
      setError(messages.security.errorTotp);
      return;
    }

    setMessage(messages.security.enabled);
  }

  async function registerPasskey() {
    setError(null);
    setMessage(null);

    const { error: passkeyError } = await authClient.passkey.addPasskey({
      name: messages.security.passkeyName,
    });

    if (passkeyError) {
      setError(messages.security.errorPasskey);
      return;
    }

    setMessage(messages.security.passkeyRegistered);
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <section className="sheet max-w-2xl p-6 min-[60rem]:p-10">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {messages.security.title}
        </h1>

        <form
          className="mt-6 flex flex-col gap-4 border-t border-border pt-6"
          onSubmit={enableTwoFactor}
        >
          <h2 className="text-base font-semibold text-foreground">
            {messages.security.enableTotpTitle}
          </h2>
          <label className="field">
            <span className="lbl">{messages.security.currentPassword}</span>
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
          <button
            className={`btn ${totpURI ? "btn--card" : "btn--ink"} self-start`}
            type="submit"
          >
            {messages.security.generateTotp}
          </button>
        </form>

        {totpURI ? (
          <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6 text-sm">
            <div>
              <p className="lbl">{messages.security.totpUri}</p>
              <code className="fig mt-1 block break-all rounded bg-secondary p-3 text-xs text-foreground">
                {totpURI}
              </code>
            </div>
            {backupCodes ? (
              <div>
                <p className="lbl">{messages.security.recoveryCodes}</p>
                <ul className="mt-1 list-disc pl-5">
                  {backupCodes.map((code) => (
                    <li key={code}>
                      <code className="fig">{code}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <form className="flex flex-col gap-4" onSubmit={verifyTwoFactor}>
              <label className="field">
                <span className="lbl">
                  {messages.security.authenticatorCode}
                </span>
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
              <button className="btn btn--ink self-start" type="submit">
                {messages.security.confirmTotp}
              </button>
            </form>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-6">
          <button
            className="btn btn--card"
            type="button"
            onClick={registerPasskey}
          >
            {messages.security.registerPasskey}
          </button>

          <button className="btn btn--card" type="button" onClick={signOut}>
            {messages.security.signOut}
          </button>
        </div>

        {error ? (
          <p role="alert" className="neg mt-4 text-sm font-medium">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="pos mt-4 text-sm font-medium">{message}</p>
        ) : null}
      </section>
    </main>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

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
      setError(enableError.message ?? "Não foi possível iniciar o 2FA");
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
      setError(verifyError.message ?? "Código inválido");
      return;
    }

    setMessage("2FA ativado.");
  }

  async function registerPasskey() {
    setError(null);
    setMessage(null);

    const { error: passkeyError } = await authClient.passkey.addPasskey({
      name: "Este dispositivo",
    });

    if (passkeyError) {
      setError(passkeyError.message ?? "Falha ao registrar passkey");
      return;
    }

    setMessage("Passkey registrada.");
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Segurança</h1>

      <form className="flex flex-col gap-3" onSubmit={enableTwoFactor}>
        <h2 className="font-medium">Ativar 2FA (TOTP)</h2>
        <input
          className="rounded border px-3 py-2"
          type="password"
          placeholder="Senha atual"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="rounded bg-black px-3 py-2 text-white" type="submit">
          Gerar TOTP
        </button>
      </form>

      {totpURI ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>URI TOTP:</p>
          <code className="break-all rounded bg-zinc-100 p-2">{totpURI}</code>
          {backupCodes ? (
            <>
              <p>Códigos de recuperação:</p>
              <ul className="list-disc pl-5">
                {backupCodes.map((code) => (
                  <li key={code}>
                    <code>{code}</code>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <form className="flex flex-col gap-3" onSubmit={verifyTwoFactor}>
            <input
              className="rounded border px-3 py-2"
              type="text"
              placeholder="Código do autenticador"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              required
            />
            <button
              className="rounded bg-black px-3 py-2 text-white"
              type="submit"
            >
              Confirmar 2FA
            </button>
          </form>
        </div>
      ) : null}

      <button
        className="rounded border px-3 py-2"
        type="button"
        onClick={registerPasskey}
      >
        Registrar passkey
      </button>

      <button
        className="rounded border px-3 py-2"
        type="button"
        onClick={signOut}
      >
        Sair
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
    </main>
  );
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Input } from "@/components/ui";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Email ou palavra-passe incorretos."
          : `Erro ao entrar: ${error.message}`,
      );
      setLoading(false);
      return;
    }
    // reload completo para o middleware apanhar os cookies de sessão
    window.location.href = "/";
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </Field>
      <Field label="Palavra-passe">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </Field>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "A entrar…" : "Entrar"}
      </Button>
    </form>
  );
}

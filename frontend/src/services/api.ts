import type { Character, Session } from "../domain/types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => null))?.error?.message ??
        `请求失败 (${response.status})`,
    );
  return response.json() as Promise<T>;
}

export async function getCharacters(): Promise<Character[]> {
  return (await request<{ data: Character[] }>("/api/v1/characters")).data;
}

export async function createSession(characterId?: string): Promise<Session> {
  await request("/api/v1/auth/anonymous", { method: "POST", body: "{}" });
  const session = await request<Session>("/api/v1/realtime/sessions", {
    method: "POST",
    body: JSON.stringify(characterId ? { characterId } : {}),
  });
  return { ...session, wsUrl: new URL(session.wsUrl, API_BASE).toString() };
}

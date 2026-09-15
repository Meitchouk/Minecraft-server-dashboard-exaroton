"use client";
import { usePoll } from "@/hooks/use-server";
import { apiFetch } from "@/lib/client";

export type Me = { username: string; role: "admin" | "user"; approved: boolean; lastLogin: number | null };

export function useMe() {
  const { data } = usePoll(() => apiFetch<Me>("/api/auth/me"), 5 * 60000);
  return data;
}

import { API_URL } from "@/config/web3";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Games
  getLobbyGames: () => apiFetch<any[]>("/games/lobby"),
  getActiveGames: () => apiFetch<any[]>("/games/active"),
  getGame: (id: string) => apiFetch<any>(`/games/${id}`),

  createGame: (data: {
    walletAddress: string;
    stakeAmount?: string;
    perMoveTimeLimit?: number;
    isPrivate?: boolean;
    txHash?: string;
  }) => apiFetch<any>("/games", { method: "POST", body: JSON.stringify(data) }),

  joinGame: (id: string, data: { walletAddress: string; txHash?: string }) =>
    apiFetch<any>(`/games/${id}/join`, { method: "POST", body: JSON.stringify(data) }),

  makeMove: (id: string, data: { walletAddress: string; from: string; to: string; promotion?: string }) =>
    apiFetch<any>(`/games/${id}/move`, { method: "POST", body: JSON.stringify(data) }),

  cancelGame: (id: string, walletAddress: string) =>
    apiFetch<any>(`/games/${id}/cancel`, { method: "POST", body: JSON.stringify({ walletAddress }) }),

  // Chat
  getMessages: (id: string) => apiFetch<any[]>(`/games/${id}/messages`),
  sendMessage: (id: string, data: { walletAddress: string; content: string }) =>
    apiFetch<any>(`/games/${id}/messages`, { method: "POST", body: JSON.stringify(data) }),

  // Users
  getUser: (wallet: string) => apiFetch<any>(`/users/${wallet}`),
  getUserGames: (wallet: string) => apiFetch<any[]>(`/users/${wallet}/games`),

  // Health
  health: () => apiFetch<{ status: string }>("/health"),
};

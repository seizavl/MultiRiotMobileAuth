import { getCode } from "./totp";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1].padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isValidJwt(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return false;
  }

  const exp = payload.exp;
  if (typeof exp === "number" && exp < Date.now() / 1000) {
    return false;
  }

  return true;
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function riotHeaders(csrfToken: string, cookies?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    "csrf-token": csrfToken,
    origin: "https://account.riotgames.com",
    referer: "https://account.riotgames.com/",
  };

  if (cookies) {
    headers.cookie = cookieHeader(cookies);
  }

  return headers;
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
  }

  return (await response.json()) as T;
}

export async function fetchRiotId(
  cookies: Record<string, string>,
  csrfToken: string,
): Promise<string> {
  const data = await requestJson<{
    alias?: { game_name?: string; tag_line?: string };
    username?: string;
    sub?: string;
  }>("https://account.riotgames.com/api/account/v1/user", {
    method: "GET",
    headers: riotHeaders(csrfToken, cookies),
  });

  const gameName = data.alias?.game_name;
  const tagLine = data.alias?.tag_line;
  if (gameName && tagLine) {
    return `${gameName}#${tagLine}`;
  }
  return gameName || data.username || data.sub || "Unknown";
}

export async function enableMfa(
  cookies: Record<string, string>,
  csrfToken: string,
): Promise<string> {
  const data = await requestJson<{ secret: string }>(
    "https://account.riotgames.com/api/mfa/v2/factors/riotmobile/enable",
    {
      method: "POST",
      headers: riotHeaders(csrfToken, cookies),
    },
  );

  return data.secret;
}

export async function verifyMfa(idToken: string, seed: string): Promise<void> {
  await requestJson<unknown>("https://api.account.riotgames.com/mfa/v1/factor/riotmobile/verify", {
    method: "POST",
    headers: {
      authorization: `Bearer ${idToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      device: "Riot 2FA Manager",
      otp: getCode(seed),
    }),
  });
}

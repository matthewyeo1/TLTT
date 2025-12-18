import { BASE_URL } from "../constants/api";

type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
};

async function safeJson(res: Response) {
  try {
    const text = await res.text();
    // try parse JSON, otherwise return raw text
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (err) {
    return null;
  }
}

// Send registration request to backend
export async function registerUser(name: string, email: string, password: string): Promise<ApiResult<any>> {
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const parsed = await safeJson(res);
    if (!res.ok) {
      return { ok: false, status: res.status, data: null, error: parsed?.error ?? String(parsed) ?? "Server error" };
    }
    return { ok: true, status: res.status, data: parsed };
  } catch (err: any) {
    console.error("registerUser error:", err);
    return { ok: false, status: 0, data: null, error: err?.message ?? "Network error" };
  }
}

// Send login request to backend
export async function loginUser(email: string, password: string): Promise<ApiResult<any>> {
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const parsed = await safeJson(res);
    if (!res.ok) {
      return { ok: false, status: res.status, data: null, error: parsed?.error ?? String(parsed) ?? "Server error" };
    }
    return { ok: true, status: res.status, data: parsed };
  } catch (err: any) {
    console.error("loginUser error:", err);
    return { ok: false, status: 0, data: null, error: err?.message ?? "Network error" };
  }
}

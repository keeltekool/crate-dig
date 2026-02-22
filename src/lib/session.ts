import { cookies } from "next/headers";

const SESSION_COOKIE = "cratedig_session";

export async function getSession(): Promise<{ connected: boolean; email?: string }> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);

  if (!session?.value) {
    return { connected: false };
  }

  try {
    const data = JSON.parse(Buffer.from(session.value, "base64").toString());
    return { connected: true, email: data.email };
  } catch {
    return { connected: false };
  }
}

export function createSessionCookie(email: string): { name: string; value: string; options: Record<string, unknown> } {
  const payload = Buffer.from(JSON.stringify({ email, ts: Date.now() })).toString("base64");
  return {
    name: SESSION_COOKIE,
    value: payload,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
  };
}

/**
 * Reading, writing and clearing the stored auth session.
 *
 * A stored access token on its own is not a session. The app also needs the user
 * record, and treating the token as enough let protected routes render with the
 * app-level `user` and `fileStore` refs still null (prod Sentry, 2026-09-04).
 * Everything that touches these three keys goes through here so they can never
 * be written or cleared apart.
 */

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const USER_KEY = "user";

/**
 * Return the stored session, or null when any part of it is missing or unusable.
 *
 * @returns {{token: string, refreshToken: string|null, user: object}|null}
 */
export function readSession() {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)?.trim();
  if (!token) return null;

  let user = null;
  try {
    user = JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
  if (!user || typeof user !== "object") return null;

  return { token, refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY), user };
}

/** Write all three keys together, so a half session cannot be persisted. */
export function saveSession({ accessToken, refreshToken, user }) {
  if (!accessToken || !user || typeof user !== "object") {
    throw new Error("saveSession needs both an access token and a user");
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

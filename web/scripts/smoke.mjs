/**
 * Minimal smoke tests for your Next.js API (no test framework).
 *
 * Run:
 *   BASE_URL=http://localhost:3000 node scripts/smoke.mjs
 *
 * Prereq:
 *   - `npm run dev` is running
 *   - Postgres container is up
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function randEmail(prefix = "user") {
  const r = Math.random().toString(16).slice(2);
  return `${prefix}-${Date.now()}-${r}@example.com`;
}

function pickSetCookie(headers) {
  // Node fetch: headers.getSetCookie() is not always available; fall back to raw.
  // We only need the "session=..." cookie.
  const raw = headers.get("set-cookie");
  if (!raw) return null;
  return raw;
}

function extractSessionCookie(setCookie) {
  if (!setCookie) return null;
  // Example: session=abc; Path=/; HttpOnly; SameSite=Lax; ...
  const m = setCookie.match(/(^|,\s*)session=([^;]+)/);
  if (!m) return null;
  return `session=${m[2]}`;
}

async function request(path, { method = "GET", json, cookie, headers: extraHeaders } = {}) {
  const headers = { ...(extraHeaders ?? {}) };
  if (json !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers["Cookie"] = cookie;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
  });

  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  const setCookie = pickSetCookie(res.headers);
  const sessionCookie = extractSessionCookie(setCookie);

  return { res, body, setCookie, sessionCookie };
}

async function main() {
  console.log(`Smoke test base: ${BASE_URL}`);

  // 1) register -> should set cookie, /api/me should be non-null
  const emailA = randEmail("a");
  const passwordA = "123456789";

  // 1a) weak password register should fail
  const weak = await request("/api/auth/register", {
    method: "POST",
    json: { email: randEmail("weak"), password: "12345678", name: "Weak" },
  });
  assert(weak.res.status === 400, `weak register expected 400, got ${weak.res.status}: ${JSON.stringify(weak.body)}`);
  assert(weak.body?.error?.code === "BAD_REQUEST", `weak register error code mismatch: ${JSON.stringify(weak.body)}`);

  const r1 = await request("/api/auth/register", {
    method: "POST",
    json: { email: emailA, password: passwordA, name: "A" },
  });
  assert(r1.res.status === 201, `register A expected 201, got ${r1.res.status}: ${JSON.stringify(r1.body)}`);
  assert(r1.sessionCookie, "register A should return Set-Cookie session=...");

  const cookieA = r1.sessionCookie;
  const meA = await request("/api/me", { cookie: cookieA });
  assert(meA.res.status === 200, `me A expected 200, got ${meA.res.status}`);
  assert(meA.body?.data?.email === emailA, `me A email mismatch: ${JSON.stringify(meA.body)}`);

  const csrfA = await request("/api/csrf", { cookie: cookieA });
  assert(csrfA.res.status === 200, `csrf A expected 200, got ${csrfA.res.status}: ${JSON.stringify(csrfA.body)}`);
  const tokenA = csrfA.body?.data?.token;
  assert(typeof tokenA === "string" && tokenA.length > 0, `csrf token missing: ${JSON.stringify(csrfA.body)}`);

  // 2) create post as A
  const createNoCsrf = await request("/api/posts", {
    method: "POST",
    cookie: cookieA,
    json: { title: "no-csrf" },
  });
  assert(createNoCsrf.res.status === 403, `create without csrf should be 403, got ${createNoCsrf.res.status}`);

  const created = await request("/api/posts", {
    method: "POST",
    cookie: cookieA,
    headers: { "x-csrf-token": tokenA },
    json: { title: "hello", content: "world" },
  });
  assert(created.res.status === 201, `create post expected 201, got ${created.res.status}`);
  const postId = created.body?.data?.id;
  assert(typeof postId === "number", `create post missing id: ${JSON.stringify(created.body)}`);

  // 3) update post as A
  const patched = await request(`/api/posts/${postId}`, {
    method: "PATCH",
    cookie: cookieA,
    headers: { "x-csrf-token": tokenA },
    json: { title: "hello2" },
  });
  assert(patched.res.status === 200, `patch expected 200, got ${patched.res.status}: ${JSON.stringify(patched.body)}`);
  assert(patched.body?.data?.title === "hello2", `patch title mismatch: ${JSON.stringify(patched.body)}`);

  // 4) register B, try patch/delete A's post -> 403
  const emailB = randEmail("b");
  const rB = await request("/api/auth/register", {
    method: "POST",
    json: { email: emailB, password: "123456789", name: "B" },
  });
  assert(rB.res.status === 201, `register B expected 201, got ${rB.res.status}`);
  const cookieB = rB.sessionCookie;
  assert(cookieB, "register B should set cookie");

  const patchByB = await request(`/api/posts/${postId}`, {
    method: "PATCH",
    cookie: cookieB,
    headers: { "x-csrf-token": tokenA },
    json: { title: "hacked" },
  });
  assert(patchByB.res.status === 403, `B patch should be 403, got ${patchByB.res.status}`);

  const deleteByB = await request(`/api/posts/${postId}`, {
    method: "DELETE",
    cookie: cookieB,
    headers: { "x-csrf-token": tokenA },
  });
  assert(deleteByB.res.status === 403, `B delete should be 403, got ${deleteByB.res.status}`);

  // 5) logout A -> /api/me null -> post should 401
  const outA = await request("/api/auth/logout", { method: "POST", cookie: cookieA, headers: { "x-csrf-token": tokenA } });
  assert(outA.res.status === 200, `logout A expected 200, got ${outA.res.status}`);

  const meAfter = await request("/api/me", { cookie: cookieA });
  assert(meAfter.res.status === 200, `me after logout expected 200, got ${meAfter.res.status}`);
  assert(meAfter.body?.data === null, `me after logout should be null: ${JSON.stringify(meAfter.body)}`);

  const createAfterLogout = await request("/api/posts", {
    method: "POST",
    cookie: cookieA,
    json: { title: "nope" },
  });
  assert(createAfterLogout.res.status === 401, `post after logout should be 401, got ${createAfterLogout.res.status}`);

  // 6) delete post as A should now be 401 (since logged out), login again, then delete ok
  const loginA = await request("/api/auth/login", {
    method: "POST",
    json: { email: emailA, password: passwordA },
  });
  assert(loginA.res.status === 200, `login A expected 200, got ${loginA.res.status}`);
  const cookieA2 = loginA.sessionCookie;
  assert(cookieA2, "login A should set cookie");

  const csrfA2 = await request("/api/csrf", { cookie: cookieA2 });
  assert(csrfA2.res.status === 200, `csrf A2 expected 200, got ${csrfA2.res.status}: ${JSON.stringify(csrfA2.body)}`);
  const tokenA2 = csrfA2.body?.data?.token;
  assert(typeof tokenA2 === "string" && tokenA2.length > 0, `csrf token A2 missing: ${JSON.stringify(csrfA2.body)}`);

  const deleteByA = await request(`/api/posts/${postId}`, { method: "DELETE", cookie: cookieA2, headers: { "x-csrf-token": tokenA2 } });
  assert(deleteByA.res.status === 200, `A delete should be 200, got ${deleteByA.res.status}`);

  // 7) rate limit: login wrong password many times -> should hit 429 at least once
  let saw429 = false;
  for (let i = 0; i < 6; i += 1) {
    const r = await request("/api/auth/login", {
      method: "POST",
      json: { email: emailA, password: "wrong-password" },
    });
    if (r.res.status === 429) saw429 = true;
    else assert(r.res.status === 401, `wrong login expected 401/429, got ${r.res.status}: ${JSON.stringify(r.body)}`);
  }
  assert(saw429, "login rate limit should return 429 at least once");

  console.log("✅ smoke tests passed");
}

main().catch((e) => {
  console.error("❌ smoke tests failed");
  console.error(e);
  process.exitCode = 1;
});


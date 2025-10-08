// auth.js — Vite + Vercel Edge Basic Auth (no Next imports)
const USER = process.env.BASIC_AUTH_USER ?? "";
const PASS = process.env.BASIC_AUTH_PASS ?? "";

const EXCLUDE = [
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/manifest\.json$/,
  /^\/assets\//,
  /^\/static\//,
  /^\/.*\.(css|js|map|png|jpg|jpeg|gif|svg|webp|ico|txt)$/i
];

export default function middleware(req) {
  const { pathname } = new URL(req.url);
  if (EXCLUDE.some((re) => re.test(pathname))) return;

  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme?.toLowerCase() === "basic" && encoded) {
      const [u, p] = atob(encoded).split(":");
      if (u === USER && p === PASS) return;
    }
  }

  return new Response("Auth required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' }
  });
}

// middleware.js — Basic Auth for Vite on Vercel Edge (no Next.js imports)

const USER = process.env.BASIC_AUTH_USER ?? "";
const PASS = process.env.BASIC_AUTH_PASS ?? "";

// Skip static assets so we don't prompt for CSS/JS/images/etc.
const EXCLUDE = [
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/manifest\.json$/,
  /^\/assets\//,
  /^\/static\//,
  /^\/.*\.(css|js|map|png|jpg|jpeg|gif|svg|webp|ico|txt)$/i,
];

export default function middleware(req) {
  const { pathname } = new URL(req.url);

  // Let static assets through
  if (EXCLUDE.some((re) => re.test(pathname))) return;

  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme?.toLowerCase() === "basic" && encoded) {
      const [user, pass] = atob(encoded).split(":");
      if (user === USER && pass === PASS) {
        // Allow
        return;
      }
    }
  }

  // Challenge
  return new Response("Auth required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
  });
}

// middleware.ts — framework-agnostic Basic Auth for Vercel Edge

const USER = process.env.BASIC_AUTH_USER ?? "";
const PASS = process.env.BASIC_AUTH_PASS ?? "";

// Exclude static assets and public files (tweak as needed)
const EXCLUDE = [
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/manifest\.json$/,
  /^\/assets\//,         // Vite's default static asset folder
  /^\/static\//,         // if you have one
  /^\/.*\.(css|js|map|png|jpg|jpeg|gif|svg|webp|ico|txt)$/i,
];

export default function middleware(req: Request): Response | void {
  const { pathname } = new URL(req.url);

  // Allow excluded paths through
  if (EXCLUDE.some((re) => re.test(pathname))) {
    return; // let the request continue
  }

  // Require credentials for everything else
  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme?.toLowerCase() === "basic" && encoded) {
      const [user, pass] = atob(encoded).split(":");
      if (user === USER && pass === PASS) {
        return; // correct creds -> continue to app
      }
    }
  }

  return new Response("Auth required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
  });
}

const REALM = 'Frontline Pricing Demo';
const EXPECTED_USERNAME = process.env.BASIC_AUTH_USERNAME;
const EXPECTED_PASSWORD = process.env.BASIC_AUTH_PASSWORD;

function unauthorizedResponse(): Response {
  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Cache-Control': 'no-store',
    },
  });
}

function configurationError(): Response {
  return new Response('Server configuration error.', {
    status: 500,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function decodeCredentials(header: string): { username: string; password: string } | null {
  const [scheme, encoded] = header.split(' ');

  if (scheme !== 'Basic' || !encoded) {
    return null;
  }

  try {
    const decoded = globalThis.atob(encoded);
    const separatorIndex = decoded.indexOf(':');

    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch (error) {
    console.error('Failed to decode authorization header', error);
    return null;
  }
}

export const config = {
  matcher: '/(.*)',
};

export default function middleware(request: Request): Response | undefined {
  if (!EXPECTED_USERNAME || !EXPECTED_PASSWORD) {
    return configurationError();
  }

  const authorization = request.headers.get('authorization');

  if (!authorization) {
    return unauthorizedResponse();
  }

  const credentials = decodeCredentials(authorization);

  if (!credentials) {
    return unauthorizedResponse();
  }

  const isAuthorized =
    credentials.username === EXPECTED_USERNAME &&
    credentials.password === EXPECTED_PASSWORD;

  if (!isAuthorized) {
    return unauthorizedResponse();
  }

  return undefined;
}

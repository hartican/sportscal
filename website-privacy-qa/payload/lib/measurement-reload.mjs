export function measurementReload(request) {
  const denied = new URL(request.url).searchParams.get('off') === '1';
  return new Response(null, {
    status: 303,
    headers: {
      Location: denied ? '/?privacy=off' : '/?privacy=resume',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

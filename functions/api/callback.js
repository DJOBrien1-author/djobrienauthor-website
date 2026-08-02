function renderBody(status, content) {
  const safeContent = JSON.stringify(content).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>GitHub authentication</title></head>
<body>
<script>
(function () {
  const payload = ${safeContent};
  const receiveMessage = (message) => {
    window.opener.postMessage(
      'authorization:github:${status}:' + JSON.stringify(payload),
      message.origin
    );
    window.removeEventListener('message', receiveMessage, false);
  };
  window.addEventListener('message', receiveMessage, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response('GitHub OAuth credentials are not configured.', {
      status: 500,
    });
  }

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    if (!code) {
      return new Response(renderBody('error', { error: 'Missing OAuth code' }), {
        status: 400,
        headers: { 'content-type': 'text/html;charset=UTF-8' },
      });
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'djobrienauthor-decap-cms',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const result = await response.json();
    if (!response.ok || result.error || !result.access_token) {
      return new Response(renderBody('error', result), {
        status: 401,
        headers: { 'content-type': 'text/html;charset=UTF-8' },
      });
    }

    return new Response(
      renderBody('success', {
        token: result.access_token,
        provider: 'github',
      }),
      {
        status: 200,
        headers: { 'content-type': 'text/html;charset=UTF-8' },
      },
    );
  } catch (error) {
    console.error(error);
    return new Response(
      renderBody('error', {
        error: error instanceof Error ? error.message : 'OAuth error',
      }),
      {
        status: 500,
        headers: { 'content-type': 'text/html;charset=UTF-8' },
      },
    );
  }
}

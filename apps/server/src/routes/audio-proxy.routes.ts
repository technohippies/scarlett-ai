import { Hono } from 'hono';

const audioProxyRouter = new Hono();

// Audio proxy endpoint for maid.zone
audioProxyRouter.get('/proxy/:trackId{.+}', async (c) => {
  try {
    const trackId = c.req.param('trackId');
    console.log('[Audio Proxy] Proxying track:', trackId);

    // Try sc.maid.zone format
    const scMaidZoneUrl = `https://sc.maid.zone/${trackId}`;
    console.log('[Audio Proxy] Fetching page:', scMaidZoneUrl);

    const pageResponse = await fetch(scMaidZoneUrl);
    if (!pageResponse.ok) {
      console.error('[Audio Proxy] Failed to fetch page:', pageResponse.status);
      return c.json({ error: 'Track not found' }, 404);
    }

    const html = await pageResponse.text();

    // Look for the audio element with restream URL
    const audioSrcMatch = html.match(/src="([^"]*\/_\/restream\/[^"]*)"/);
    if (!audioSrcMatch) {
      console.error('[Audio Proxy] No audio URL found in page');
      return c.json({ error: 'Audio URL not found' }, 404);
    }

    const relativeAudioUrl = audioSrcMatch[1];
    const fullAudioUrl = `https://sc.maid.zone${relativeAudioUrl}`;
    console.log('[Audio Proxy] Found audio URL:', fullAudioUrl);

    // Fetch the actual audio
    const audioResponse = await fetch(fullAudioUrl);
    if (!audioResponse.ok) {
      console.error('[Audio Proxy] Failed to fetch audio:', audioResponse.status);
      return c.json({ error: 'Failed to fetch audio' }, 500);
    }

    // Return the audio with CORS headers
    return new Response(audioResponse.body, {
      headers: {
        'Content-Type': audioResponse.headers.get('Content-Type') || 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
        'Cache-Control': 'public, max-age=3600',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('[Audio Proxy] Error:', error);
    return c.json({ error: 'Failed to proxy audio' }, 500);
  }
});

export { audioProxyRouter };
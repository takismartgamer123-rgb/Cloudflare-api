export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. المتغيرات تاعك من Cloudflare
    const API_KEYS = [env.YT_KEY_1, env.YT_KEY_2, env.YT_KEY_3, env.YT_KEY_4, env.YT_KEY_5];
    const CHANNEL_ID = env.CHANNEL_ID;
    const CLIENT_ID = env.YT_CLIENT_ID;
    const CLIENT_SECRET = env.YT_CLIENT_SECRET;
    const REFRESH_TOKEN = env.YT_REFRESH_TOKEN;

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    };

    // 2. /stats - الإحصائيات بـ 5 مفاتيح
    if (url.pathname === '/stats') {
      for (const key of API_KEYS) {
        try {
          const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${CHANNEL_ID}&key=${key}`;
          const res = await fetch(apiUrl);
          if (res.status === 403) continue; // مفتاح طاح, نجرب اللي بعدو
          const data = await res.json();
          if (!data.items ||!data.items.length) continue;

          const stats = data.items[0].statistics;
          return new Response(JSON.stringify({
            subs: parseInt(stats.subscriberCount).toLocaleString('ar-DZ'),
            views: parseInt(stats.viewCount).toLocaleString('ar-DZ'),
            videos: stats.videoCount,
            raw_subs: parseInt(stats.subscriberCount),
            success: true
          }), { headers });
        } catch (e) {
          continue;
        }
      }
      return new Response(JSON.stringify({
        error: "كل المفاتيح خلصو الكوتا",
        success: false
      }), { status: 429, headers });
    }

    // 3. /chat - الشات الحقيقي من YouTube API
    if (url.pathname === '/chat') {
      try {
        // أ. نجدد Access Token من Refresh Token
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${REFRESH_TOKEN}&grant_type=refresh_token`
        });

        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
          throw new Error('فشل تجديد Token: ' + JSON.stringify(tokenData));
        }
        const access_token = tokenData.access_token;

        // ب. نجيبو liveChatId تاع البث الحالي
        const liveRes = await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet&broadcastStatus=active&broadcastType=all`, {
          headers: { 'Authorization': `Bearer ${access_token}` }
        });
        const liveData = await liveRes.json();

        if (!liveData.items ||!liveData.items.length) {
          return new Response(JSON.stringify({
            messages: [],
            error: "ما كاش بث مباشر حاليا",
            success: false
          }), { headers });
        }

        const liveChatId = liveData.items[0].snippet.liveChatId;

        // ج. نجيبو آخر 25 رسالة
        const chatRes = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&maxResults=25`, {
          headers: { 'Authorization': `Bearer ${access_token}` }
        });
        const chatData = await chatRes.json();

        const messages = chatData.items.map(item => ({
          id: item.id,
          user: item.authorDetails.displayName,
          message: item.snippet.displayMessage,
          isMod: item.authorDetails.isChatModerator,
          isSub: item.authorDetails.isChatSponsor,
          isOwner: item.authorDetails.isChatOwner,
          timestamp: item.snippet.publishedAt
        }));

        return new Response(JSON.stringify({
          messages,
          success: true
        }), { headers });

      } catch (e) {
        return new Response(JSON.stringify({
          error: e.message,
          messages: [],
          success: false
        }), { status: 500, headers });
      }
    }

    // 4. الصفحة الرئيسية
    return new Response('TAKI ULTIMATE API V13.1 👑', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
export default {
  async fetch(request) {
    const original = new URL(request.url), url = new URL(request.url);
    url.hostname = 'explorer.macula.co.za';
    url.pathname = '/developer' + url.pathname;
    url.searchParams.set('_macula_release', '20261013-r2');
    const headers = new Headers(request.headers);
    headers.set('X-Macula-Developer-Host', 'dev.macula.co.za');
    headers.set('Cache-Control', 'no-cache');
    const upstream = await fetch(new Request(url, {method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual'}), {cf:{cacheTtl:0,cacheEverything:false}});
    const result = new Response(upstream.body,upstream);
    result.headers.set('Cache-Control',original.pathname.startsWith('/assets/')?'public, max-age=86400':'no-store');
    return result;
  }
};

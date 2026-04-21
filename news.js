'use strict';
const https = require('https');
const http  = require('http');
const { URL } = require('url');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Cache-Control':                'public, max-age=300', // 5 min cache
};

const FEEDS = {
  world: [
    { name:'BBC World',     url:'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { name:'Reuters',       url:'https://feeds.reuters.com/reuters/worldNews' },
    { name:'AP News',       url:'https://feeds.apnews.com/ApNews/worldnews' },
    { name:'Al Jazeera',    url:'https://www.aljazeera.com/xml/rss/all.xml' },
  ],
  tech: [
    { name:'Hacker News',   url:'https://news.ycombinator.com/rss' },
    { name:'The Verge',     url:'https://www.theverge.com/rss/index.xml' },
    { name:'Ars Technica',  url:'https://feeds.arstechnica.com/arstechnica/index' },
    { name:'TechCrunch',    url:'https://techcrunch.com/feed/' },
    { name:'Wired',         url:'https://www.wired.com/feed/rss' },
  ],
  science: [
    { name:'NASA',          url:'https://www.nasa.gov/rss/dyn/breaking_news.rss' },
    { name:'Nature',        url:'https://www.nature.com/nature.rss' },
    { name:'Science Daily', url:'https://www.sciencedaily.com/rss/all.xml' },
    { name:'Space.com',     url:'https://www.space.com/feeds/all' },
  ],
  gaming: [
    { name:'IGN',           url:'https://feeds.ign.com/ign/games-all' },
    { name:'Kotaku',        url:'https://kotaku.com/rss' },
    { name:'PC Gamer',      url:'https://www.pcgamer.com/rss/' },
    { name:'Polygon',       url:'https://www.polygon.com/rss/index.xml' },
  ],
  us: [
    { name:'NPR',           url:'https://feeds.npr.org/1001/rss.xml' },
    { name:'CNN',           url:'http://rss.cnn.com/rss/edition.rss' },
    { name:'BBC US',        url:'https://feeds.bbci.co.uk/news/rss.xml' },
  ],
};

function fetchUrl(rawUrl) {
  return new Promise((resolve, reject) => {
    const target = new URL(rawUrl);
    const lib = target.protocol === 'https:' ? https : http;
    const chunks = [];
    const req = lib.get({
      hostname: target.hostname,
      path: target.pathname + target.search,
      headers: {
        'User-Agent': 'BlueNebula/1.0 RSS Reader',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 8000,
    }, res => {

      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        return fetchUrl(new URL(res.headers.location, rawUrl).href).then(resolve).catch(reject);
      }
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function parseRSS(xml, sourceName) {
  const items = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag, fallback = '') => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 'si');
      const match = r.exec(block);
      return match ? match[1].trim().replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'") : fallback;
    };
    const getAttr = (tag, attr) => {
      const r = new RegExp(`<${tag}[^>]+${attr}="([^"]+)"`, 'i');
      const match = r.exec(block);
      return match ? match[1] : '';
    };

    const title = get('title');
    const link  = get('link') || getAttr('link','href');
    if (!title || !link) continue;

    const desc = get('description') || get('summary') || get('content:encoded','');

    const cleanDesc = desc.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,280);

    const img = getAttr('media:thumbnail','url') || getAttr('enclosure','url') || getAttr('media:content','url') || '';

    const pubDate = get('pubDate') || get('published') || get('updated') || '';
    const ts = pubDate ? new Date(pubDate).getTime() : Date.now();

    items.push({ title, link, desc: cleanDesc, img, ts, source: sourceName });
  }
  return items;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const p        = event.queryStringParameters || {};
  const category = (p.category || 'world').toLowerCase();
  const limit    = Math.min(parseInt(p.limit || '40'), 80);

  const feeds = FEEDS[category] || FEEDS.world;

  const results = await Promise.allSettled(
    feeds.map(async feed => {
      const xml = await fetchUrl(feed.url);
      return parseRSS(xml, feed.name);
    })
  );

  const articles = [];
  for (const r of results) {
    if (r.status === 'fulfilled') articles.push(...r.value);
  }
  articles.sort((a, b) => b.ts - a.ts);

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category,
      count: Math.min(articles.length, limit),
      articles: articles.slice(0, limit),
    }),
  };
};
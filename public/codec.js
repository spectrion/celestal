(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.CelestialCodec = factory();
}(typeof globalThis !== 'undefined' ? globalThis : self, function () {
  'use strict';

  const KEY = 0x42;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function encode(str) {
    if (typeof str !== 'string') str = String(str);
    const bytes = enc.encode(str);
    const out   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ KEY;
    return btoa(String.fromCharCode(...out))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function decode(str) {
    try {
      const padded = str.replace(/-/g, '+').replace(/_/g, '/');
      const bin    = atob(padded);
      const bytes  = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) ^ KEY;
      return dec.decode(bytes);
    } catch { return null; }
  }

  function encodeUrl(raw, base) {
    if (!raw) return null;
    raw = String(raw).trim();
    if (/^(javascript:|data:|blob:|mailto:|tel:|#|\s*$)/.test(raw)) return null;
    try {
      return encode(base ? new URL(raw, base).href : new URL(raw).href);
    } catch { return null; }
  }

  function decodeUrl(encoded) { return decode(encoded); }

  function isProxyEncoded(str, prefix) {
    if (!str || !prefix) return false;
    try { return new URL(str, location.href).pathname.startsWith(prefix); }
    catch { return false; }
  }

  return { encode, decode, encodeUrl, decodeUrl, isProxyEncoded };
}));
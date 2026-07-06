export const API_BASE_URL = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : 'https://interstate-matthew-grateful-past.trycloudflare.com')
  : 'https://interstate-matthew-grateful-past.trycloudflare.com';

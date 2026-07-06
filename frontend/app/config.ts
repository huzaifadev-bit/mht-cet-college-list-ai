export const API_BASE_URL = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : (window.location.hostname.includes('vercel.app')
          ? window.location.origin
          : 'https://interstate-matthew-grateful-past.trycloudflare.com'))
  : '';

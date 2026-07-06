// Production backend hosted on Railway (always online, no PC needed)
// Updated: force Vercel redeploy
const RAILWAY_BACKEND_URL = 'https://mhtcet-backend-production.up.railway.app';

export const API_BASE_URL = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : RAILWAY_BACKEND_URL)
  : RAILWAY_BACKEND_URL;

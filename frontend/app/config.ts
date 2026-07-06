// Production backend hosted on Render.com (always online, no PC needed)
const RENDER_BACKEND_URL = 'https://mhtcet-backend-j8wq.onrender.com';

export const API_BASE_URL = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : RENDER_BACKEND_URL)
  : RENDER_BACKEND_URL;


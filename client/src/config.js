const serverUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5002').replace(/\/+$/, '');

export const apiBaseUrl = `${serverUrl}/api`;
export const socketUrl = serverUrl;

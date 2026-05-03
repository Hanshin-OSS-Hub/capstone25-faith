import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.0.121:8000';

const api = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;

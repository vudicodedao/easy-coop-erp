import axios from 'axios';

const API_URL = 'http://localhost:5000/api/reports';

export const getDashboardStats = () => axios.get(`${API_URL}/stats`);
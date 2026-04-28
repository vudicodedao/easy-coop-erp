import axios from 'axios';

const API_URL = 'http://localhost:5000/api/production';

export const getAllLogs = () => axios.get(API_URL);
export const createLog = (data) => axios.post(API_URL, data);
export const updateLog = (id, data) => axios.put(`${API_URL}/${id}`, data);
export const deleteLog = (id) => axios.delete(`${API_URL}/${id}`);

// [THÊM MỚI] - API Trả/Báo mất đồ
export const handleToolAction = (data) => axios.post(`${API_URL}/tool-action`, data);
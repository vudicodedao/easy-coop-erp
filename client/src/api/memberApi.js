import axios from 'axios';

// Địa chỉ của Backend chúng ta vừa làm
const API_URL = 'http://localhost:5000/api/members';

export const getAllMembers = () => axios.get(API_URL);
export const createMember = (data) => axios.post(API_URL, data);

// Thêm API xóa
export const deleteMember = (id) => axios.delete(`${API_URL}/${id}`);
export const updateMember = (id, data) => axios.put(`${API_URL}/${id}`, data);

export const resetPassword = (id) => axios.put(`${API_URL}/${id}/reset-password`);
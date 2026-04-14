import axios from 'axios';
const API_URL = 'http://localhost:5000/api/sales';

export const getAllOrders = () => axios.get(API_URL);
export const createOrder = (data) => axios.post(API_URL, data);
export const updateOrder = (id, data) => axios.put(`${API_URL}/${id}`, data);
export const deleteOrder = (id) => axios.delete(`${API_URL}/${id}`);
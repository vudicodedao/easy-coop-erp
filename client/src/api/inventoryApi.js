import axios from 'axios';

const API_URL = 'http://localhost:5000/api/inventory';

export const getAllItems = () => axios.get(API_URL);
export const createItem = (data) => axios.post(API_URL, data);
export const updateItem = (id, data) => axios.put(`${API_URL}/${id}`, data);
export const deleteItem = (id) => axios.delete(`${API_URL}/${id}`);

export const getTransactions = (type) => axios.get(`${API_URL}/transactions${type ? `?type=${type}` : ''}`);
export const createTransaction = (data) => axios.post(`${API_URL}/transactions`, data);
export const deleteTransaction = (id) => axios.delete(`${API_URL}/transactions/${id}`);
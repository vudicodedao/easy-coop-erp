import axios from 'axios';

const API_URL = 'http://localhost:5000/api/finance';

export const getAllRecords = () => axios.get(API_URL);
export const createRecord = (data) => axios.post(API_URL, data);
export const updateRecord = (id, data) => axios.put(`${API_URL}/${id}`, data);
export const deleteRecord = (id) => axios.delete(`${API_URL}/${id}`);
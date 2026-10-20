import httpClient from "../http/httpClient";

export const getUsers = () => httpClient.get("/api/users");
export const createUser = (user) => httpClient.post("/api/users", user);
export const updateUser = (id, user) => httpClient.put(`/api/users/${id}`, user);
export const setUserStatus = (id, active) =>
  httpClient.post(`/api/users/${id}/status?active=${active}`);
export const resetBusinessData = (request) =>
  httpClient.post("/api/users/data-reset", request);

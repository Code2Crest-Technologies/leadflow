// src/utils/index.ts

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString();
};

export const formatTime = (date: string | Date) => {
  return new Date(date).toLocaleTimeString();
};

export { openWhatsApp } from './whatsapp';

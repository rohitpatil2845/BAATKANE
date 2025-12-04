// Helper module for PostgreSQL database operations
import db from './database';
import crypto from 'crypto';

/**
 * Generate a UUID for database insertion
 */
export const generateUUID = (): string => {
  return crypto.randomUUID();
};

/**
 * Execute a query and return results in a consistent format
 * Returns [rows, fields] similar to MySQL for easier migration
 */
export const query = async (sql: string, params: any[] = []) => {
  return db.query(sql, params);
};

/**
 * Format a Date object to PostgreSQL timestamp format
 */
export const formatTimestamp = (date: Date): string => {
  return date.toISOString();
};

/**
 * Helper to get first row from query results
 */
export const getFirstRow = (results: any): any => {
  const [rows] = results;
  return rows && rows.length > 0 ? rows[0] : null;
};

/**
 * Helper to get all rows from query results
 */
export const getAllRows = (results: any): any[] => {
  const [rows] = results;
  return rows || [];
};

export default {
  query,
  generateUUID,
  formatTimestamp,
  getFirstRow,
  getAllRows,
};

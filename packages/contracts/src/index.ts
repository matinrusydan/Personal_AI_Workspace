/**
 * @paw/contracts
 * Canonical API contract definitions for Personal AI Workspace
 */

export const API_VERSION = 'v1';
export const API_PREFIX = '/api/v1';

// Re-export generated schema types if generated, otherwise fallback types
export type * from './generated.js';

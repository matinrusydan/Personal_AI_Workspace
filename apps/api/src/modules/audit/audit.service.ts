import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface AuditRecord {
  id: string;
  actorType: 'user' | 'system' | 'device';
  actorId: string;
  action: string;
  target?: string;
  traceId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'ticket',
  'code',
  'authorization',
  'jwt',
]);

@Injectable()
export class AuditService {
  private readonly records: AuditRecord[] = [];

  record(params: {
    actorType: 'user' | 'system' | 'device';
    actorId: string;
    action: string;
    target?: string;
    traceId?: string;
    metadata?: Record<string, unknown>;
  }): AuditRecord {
    const sanitizedMetadata = this.sanitizeMetadata(params.metadata || {});

    const record: AuditRecord = {
      id: randomUUID(),
      actorType: params.actorType,
      actorId: params.actorId,
      action: params.action,
      target: params.target,
      traceId: params.traceId || randomUUID(),
      metadata: sanitizedMetadata,
      createdAt: new Date().toISOString(),
    };

    this.records.push(record);
    return record;
  }

  getLogs(limit = 50): AuditRecord[] {
    return this.records.slice(-limit).reverse();
  }

  private sanitizeMetadata(obj: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        clean[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        clean[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        clean[key] = value;
      }
    }

    return clean;
  }
}

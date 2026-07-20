import type { SerializableError } from '@/src/core/domain/errors';

export type Result<T> = { ok: true; value: T } | { ok: false; error: SerializableError };

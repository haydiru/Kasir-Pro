/**
 * Recursively converts all Date objects in an object or array to ISO strings.
 * This ensures data returned from Server Actions is safe for Next.js serialization.
 */
export function serialize<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (obj instanceof Date) {
    return obj.toISOString() as any;
  }

  if (Array.isArray(obj)) {
    return obj.map(serialize) as any;
  }

  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = serialize(obj[key]);
      }
    }
    return newObj;
  }

  return obj;
}

/**
 * Standard response format for all server actions
 */
export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

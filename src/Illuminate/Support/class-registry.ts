import type { Constructor } from './Traits'

// class-registry.ts
const REGISTRY = new Map<string, Constructor>()

// export function registerClass (key: string, ctor: new (...args: unknown[]) => unknown): void {
export function registerClass (key: string, ctor: Constructor): void {
  REGISTRY.set(key, ctor)
}

export function resolveClass<T> (key: string): new (...args: unknown[]) => T {
  const ctor = REGISTRY.get(key)

  if (ctor === undefined) {
    throw new Error(`Class not registered: ${key}`)
  }

  return ctor as new (...args: unknown[]) => T
}

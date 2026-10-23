import { AgentError } from "./errors.js";

export interface ServiceToken<T> {
  readonly key: symbol;
  readonly name: string;
  readonly __type?: (value: T) => T;
}

export function createServiceToken<T>(name: string): ServiceToken<T> {
  if (name.trim().length === 0) {
    throw new AgentError("CONFIG_INVALID", "Service token name must be nonempty");
  }
  return Object.freeze({ key: Symbol(name), name });
}

type Lifetime = "singleton" | "transient";
interface Registration {
  factory: (container: ServiceContainer) => unknown;
  lifetime: Lifetime;
  cached: boolean;
  value?: unknown;
}

export class ServiceContainer {
  private readonly services = new Map<symbol, Registration>();
  private readonly resolving = new Set<symbol>();

  registerSingleton<T>(token: ServiceToken<T>, factory: (c: ServiceContainer) => T): this {
    return this.register(token, factory, "singleton");
  }

  registerTransient<T>(token: ServiceToken<T>, factory: (c: ServiceContainer) => T): this {
    return this.register(token, factory, "transient");
  }

  private register<T>(
    token: ServiceToken<T>, factory: (c: ServiceContainer) => T, lifetime: Lifetime,
  ): this {
    if (this.services.has(token.key)) {
      throw new AgentError("SERVICE_ALREADY_REGISTERED", "Service already registered");
    }
    this.services.set(token.key, { factory, lifetime, cached: false });
    return this;
  }

  resolve<T>(token: ServiceToken<T>): T {
    const item = this.services.get(token.key);
    if (!item) throw new AgentError("SERVICE_NOT_FOUND", "Service not registered");
    if (this.resolving.has(token.key)) {
      throw new AgentError("SERVICE_CYCLE", "Circular service dependency");
    }
    if (item.lifetime === "singleton" && item.cached) return item.value as T;
    this.resolving.add(token.key);
    try {
      const value = item.factory(this) as T;
      if (item.lifetime === "singleton") {
        item.value = value;
        item.cached = true;
      }
      return value;
    } finally {
      this.resolving.delete(token.key);
    }
  }
}

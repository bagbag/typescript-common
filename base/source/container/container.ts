import { CircularBuffer } from '#/data-structures/circular-buffer';
import { MultiKeyMap } from '#/data-structures/multi-key-map';
import type { Record, TypedOmit } from '#/types';
import { mapAsync, toArrayAsync } from '#/utils/async-iterable-helpers';
import { ForwardRef } from '#/utils/object/forward-ref';
import { isDefined, isFunction, isPromise, isUndefined } from '#/utils/type-guards';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import type { AfterResolve, Injectable, InjectableArgument } from './interfaces';
import { afterResolve } from './interfaces';
import type { Provider } from './provider';
import { isAsyncFactoryProvider, isClassProvider, isFactoryProvider, isTokenProvider, isValueProvider } from './provider';
import { ResolveChain } from './resolve-chain';
import { ResolveError } from './resolve.error';
import type { InjectionToken } from './token';
import { getTokenName } from './token';
import type { InjectMetadata, TypeInfo } from './type-info';
import { typeInfos } from './type-info';
import type { ArgumentProvider, Mapper, ResolveContext } from './types';

type InternalResolveContext = {
  isAsync: boolean,
  resolves: number,
  forwardRefQueue: CircularBuffer<() => void | Promise<void>>,
  resolutions: { instance: any, registration: Registration }[],
  forwardRefs: Set<ForwardRef>,
  providedInstances: Map<InjectionToken, any>,
  instances: MultiKeyMap<[InjectionToken, any], any>,
  resolving: MultiKeyMap<[InjectionToken, any], true>
};

/**
 * transient: a new instance will be created with each resolve
 * singleton: each resolve will return the same instance
 * resolution: the same instance will be resolved for each resolution of this dependency during a single resolution chain
 */
export type Lifecycle = 'transient' | 'singleton' | 'resolution';

export type RegistrationOptions<T, A = unknown> = {
  lifecycle?: Lifecycle,

  /** default resolve argument used when neither token nor explicit resolve argument is provided */
  defaultArgument?: InjectableArgument<T, A>,

  /** default resolve argument used when neither token nor explicit resolve argument is provided */
  defaultArgumentProvider?: ArgumentProvider<InjectableArgument<T, A>>,

  /**
   * value to distinguish scoped and singleton instances based on argument
   * by default it uses strict equality (===) on the original argument,
   * so modifications to argument objects and literal objects in the call
   * may not yield the expected result
   *
   * hint: {@link JSON.stringify} is a simple solution for many use cases,
   * but will fail if properties have different order
   */
  argumentIdentityProvider?: Mapper<InjectableArgument<T, A> | undefined>,

  /** function which gets called after a resolve */
  initializer?: (instance: T) => any | Promise<any>,

  /** custom metadata */
  metadata?: Record
};

export type Registration<T = any, A = any> = {
  token: InjectionToken<T, A>,
  provider: Provider<T, A>,
  options: RegistrationOptions<T, A>,
  instances: Map<any, T>
};

export class Container {
  private readonly registrationMap: Map<InjectionToken, Registration>;
  private readonly registrationSubject: Subject<Registration>;

  /** emits on new registration */
  readonly registration$: Observable<Registration>;

  /** all registrations */
  get registrations(): Iterable<Registration> {
    return this.registrationMap.values();
  }

  constructor() {
    this.registrationMap = new Map();
    this.registrationSubject = new Subject();

    this.registration$ = this.registrationSubject.asObservable();
  }

  /**
   * register a provider for a token
   * @param token token to register
   * @param provider provider used to resolve the token
   * @param options registration options
   */
  register<T, A = any>(token: InjectionToken<T, A>, provider: Provider<T, A>, options: RegistrationOptions<T, A> = {}): void {
    if (isClassProvider(provider)) {
      if (!typeInfos.has(provider.useClass)) {
        throw new Error(`${provider.useClass.name} is not injectable`);
      }
    }

    const registration: Registration = {
      token,
      provider,
      options,
      instances: new Map()
    };

    this.registrationMap.set(token, registration);
    this.registrationSubject.next(registration);
  }

  /**
   * register a provider for a token as a singleton. Alias for {@link register} with `singleton` lifecycle
   * @param token token to register
   * @param provider provider used to resolve the token
   * @param options registration options
   */
  registerSingleton<T, A = any>(token: InjectionToken<T, A>, provider: Provider<T, A>, options?: TypedOmit<RegistrationOptions<T, A>, 'lifecycle'>): void {
    this.register(token, provider, { ...options, lifecycle: 'singleton' });
  }

  /**
   * check if token has a registered provider
   * @param token token check
   */
  hasRegistration(token: InjectionToken): boolean {
    return this.registrationMap.has(token);
  }

  /**
   * get registration
   * @param token token to get registration for
   */
  getRegistration<T, A>(token: InjectionToken<T, A>): Registration<T, A> {
    const registration = this.registrationMap.get(token);

    if (isUndefined(registration)) {
      const tokenName = getTokenName(token);
      throw new Error(`no provider for ${tokenName} registered`);
    }

    return registration;
  }

  /**
   * try to get registration
   * @param token token to get registration for
   */
  tryGetRegistration<T, A>(token: InjectionToken<T, A>): Registration<T, A> | undefined {
    return this.registrationMap.get(token);
  }

  /**
   * resolve a token
   * @param token token to resolve
   * @param argument argument used for resolving (overrides token and default arguments)
   * @returns
   */
  resolve<T, A = T extends Injectable<infer AInject> ? AInject : any>(token: InjectionToken<T, A>, argument?: T extends Injectable<infer AInject> ? AInject : A, instances?: [InjectionToken, any][]): T {
    const context: InternalResolveContext = {
      isAsync: false,
      resolves: 0,
      forwardRefQueue: new CircularBuffer(),
      resolutions: [],
      forwardRefs: new Set(),
      providedInstances: new Map(instances),
      instances: new MultiKeyMap(),
      resolving: new MultiKeyMap()
    };

    const chain = new ResolveChain();
    return this._resolve(token, false, argument, context, chain.addToken(token), true);
  }

  /**
   * resolve a token
   * @param token token to resolve
   * @param argument argument used for resolving (overrides token and default arguments)
   * @returns
   */
  async resolveAsync<T, A = T extends Injectable<infer AInject> ? AInject : any>(token: InjectionToken<T, A>, argument?: T extends Injectable<infer AInject> ? AInject : A, instances?: [InjectionToken, any][]): Promise<T> {
    const context: InternalResolveContext = {
      isAsync: true,
      resolves: 0,
      forwardRefQueue: new CircularBuffer(),
      resolutions: [],
      forwardRefs: new Set(),
      providedInstances: new Map(instances),
      instances: new MultiKeyMap(),
      resolving: new MultiKeyMap()
    };

    const chain = new ResolveChain();
    return this._resolveAsync(token, false, argument, context, chain.addToken(token), true);
  }

  // eslint-disable-next-line max-statements, max-lines-per-function, complexity
  private _resolve<T, A>(token: InjectionToken<T, A>, optional: boolean | undefined, _argument: InjectableArgument<T, A> | undefined, context: InternalResolveContext, chain: ResolveChain, isFirst: boolean): T {
    if ((chain.length > 5000) || (++context.resolves > 5000)) {
      throw new ResolveError('resolve stack overflow. This can happen on circular dependencies with transient lifecycles. Use scoped or singleton lifecycle instead', chain.truncate(15));
    }

    if (isUndefined(token)) {
      throw new ResolveError('token is undefined - this might be because of circular dependencies, use alias or forwardRef in this case', chain);
    }

    if (context.providedInstances.has(token)) {
      return context.providedInstances.get(token) as T;
    }

    const registration = this.tryGetRegistration(token);

    if (isUndefined(registration)) {
      if (optional == true) {
        return undefined as unknown as T;
      }

      throw new ResolveError(`no provider for ${getTokenName(token)} registered`, chain);
    }

    const resolveArgument = _argument ?? registration.options.defaultArgument ?? registration.options.defaultArgumentProvider?.(this.getResolveContext(context, chain));

    if (isPromise(resolveArgument)) {
      throw new ResolveError(`cannot evaluate async argument provider for token ${getTokenName(token)} in synchronous resolve, use resolveAsync instead`, chain);
    }

    const argumentIdentity = (isDefined(registration.options.argumentIdentityProvider) && ((registration.options.lifecycle == 'resolution') || (registration.options.lifecycle == 'singleton')))
      ? registration.options.argumentIdentityProvider(resolveArgument)
      : resolveArgument;

    if (isPromise(argumentIdentity)) {
      throw new ResolveError(`cannot evaluate async argument identity provider for token ${getTokenName(token)} in synchronous resolve, use resolveAsync instead`, chain);
    }

    if ((registration.options.lifecycle == 'resolution') && context.instances.has([token, argumentIdentity])) {
      return context.instances.get([token, argumentIdentity]) as T;
    }

    if ((registration.options.lifecycle == 'singleton') && registration.instances.has(argumentIdentity)) {
      return registration.instances.get(argumentIdentity)!;
    }

    if (context.resolving.has([token, argumentIdentity])) {
      throw new ResolveError('circular dependency to itself detected. Please check your registrations and providers', chain.truncate(15));
    }

    context.resolving.set([token, argumentIdentity], true);

    let instance!: T;

    if (isClassProvider(registration.provider)) {
      const typeInfo = typeInfos.get(registration.provider.useClass);

      if (isUndefined(typeInfo)) {
        throw new ResolveError(`${registration.provider.useClass.name} is not injectable`, chain);
      }

      const parameters = typeInfo.parameters.map((metadata): unknown => this.resolveInjection(token, context, typeInfo, metadata, resolveArgument, chain));

      instance = new typeInfo.constructor(...parameters) as T;

      for (const [property, metadata] of Object.entries(typeInfo.properties)) {
        (instance as Record)[property] = this.resolveInjection(token, context, typeInfo, metadata, resolveArgument, chain);
      }
    }

    if (isValueProvider(registration.provider)) {
      instance = registration.provider.useValue;
    }

    if (isTokenProvider(registration.provider)) {
      const arg = resolveArgument ?? registration.provider.argument ?? registration.provider.argumentProvider?.();
      const innerToken = registration.provider.useToken ?? registration.provider.useTokenProvider();

      instance = this._resolve<T, A>(innerToken, false, arg, context, chain.addToken(innerToken), false);
    }

    if (isFactoryProvider(registration.provider)) {
      try {
        instance = registration.provider.useFactory(resolveArgument, this.getResolveContext(context, chain));
      }
      catch (error) {
        throw new ResolveError('error in factory', chain, error as Error);
      }
    }

    if (isAsyncFactoryProvider(registration.provider)) {
      throw new ResolveError(`cannot evaluate async factory provider for token ${getTokenName(token)} in synchronous resolve, use resolveAsync instead`, chain);
    }

    if (!isTokenProvider(registration.provider)) {
      if (registration.options.lifecycle == 'resolution') {
        context.instances.set([token, argumentIdentity], instance);
      }

      if (registration.options.lifecycle == 'singleton') {
        registration.instances.set(argumentIdentity, instance);
      }

      context.resolutions.push({ instance, registration });
    }

    context.resolving.delete([token, argumentIdentity]);

    if (isFirst) {
      for (const fn of context.forwardRefQueue.consume()) {
        (fn as () => void)();
      }

      derefForwardRefs(context);

      for (let i = context.resolutions.length - 1; i >= 0; i--) {
        const resolution = context.resolutions[i]!;

        if (isFunction((resolution.instance as AfterResolve | undefined)?.[afterResolve])) {
          const returnValue = (resolution.instance as AfterResolve)[afterResolve]!();

          if (isPromise(returnValue)) {
            throw new ResolveError(`cannot execute async [afterResolve] for token ${getTokenName(token)} in synchronous resolve, use resolveAsync instead`, chain);
          }
        }

        if (isDefined(resolution.registration.options.initializer)) {
          const returnValue = resolution.registration.options.initializer(resolution.instance);

          if (isPromise(returnValue)) {
            throw new ResolveError(`cannot execute async initializer for token ${getTokenName(token)} in synchronous resolve, use resolveAsync instead`, chain);
          }
        }
      }
    }

    return instance;
  }

  // eslint-disable-next-line max-statements, max-lines-per-function, complexity
  private async _resolveAsync<T, A>(token: InjectionToken<T, A>, optional: boolean | undefined, _argument: InjectableArgument<T, A> | undefined, context: InternalResolveContext, chain: ResolveChain, isFirst: boolean): Promise<T> {
    if ((chain.length > 5000) || (++context.resolves > 5000)) {
      throw new ResolveError('resolve stack overflow. This can happen on circular dependencies with transient lifecycles. Use scoped or singleton lifecycle instead', chain.truncate(15));
    }

    if (isUndefined(token)) {
      throw new ResolveError('token is undefined - this might be because of circular dependencies, use alias or forwardRef in this case', chain);
    }

    if (context.providedInstances.has(token)) {
      return context.providedInstances.get(token) as T;
    }

    const registration = this.tryGetRegistration(token);

    if (isUndefined(registration)) {
      if (optional == true) {
        return undefined as unknown as T;
      }

      throw new ResolveError(`no provider for ${getTokenName(token)} registered`, chain);
    }

    const resolveArgument = _argument ?? registration.options.defaultArgument ?? (await registration.options.defaultArgumentProvider?.(this.getResolveContext(context, chain)));

    const argumentIdentity = (isDefined(registration.options.argumentIdentityProvider) && ((registration.options.lifecycle == 'resolution') || (registration.options.lifecycle == 'singleton')))
      ? await registration.options.argumentIdentityProvider(resolveArgument)
      : resolveArgument;

    if ((registration.options.lifecycle == 'resolution') && context.instances.has([token, argumentIdentity])) {
      return context.instances.get([token, argumentIdentity]) as T;
    }

    if ((registration.options.lifecycle == 'singleton') && registration.instances.has(argumentIdentity)) {
      return registration.instances.get(argumentIdentity)!;
    }

    if (context.resolving.has([token, argumentIdentity])) {
      throw new ResolveError('circular dependency to itself detected. Please check your registrations and providers', chain.truncate(15));
    }

    context.resolving.set([token, argumentIdentity], true);

    let instance!: T;

    if (isClassProvider(registration.provider)) {
      const typeInfo = typeInfos.get(registration.provider.useClass);

      if (isUndefined(typeInfo)) {
        throw new ResolveError(`${registration.provider.useClass.name} is not injectable`, chain);
      }

      const boxedParameters = await toArrayAsync(mapAsync(typeInfo.parameters, async (metadata) => this.resolveInjectionAsync(context, typeInfo, metadata, resolveArgument, chain)));
      const parameters = boxedParameters.map((box) => box.resolved);

      instance = new typeInfo.constructor(...parameters) as T;

      for (const [property, metadata] of Object.entries(typeInfo.properties)) {
        (instance as Record)[property] = (await this.resolveInjectionAsync(context, typeInfo, metadata, resolveArgument, chain)).resolved;
      }
    }

    if (isValueProvider(registration.provider)) {
      instance = registration.provider.useValue;
    }

    if (isTokenProvider(registration.provider)) {
      const arg = resolveArgument ?? registration.provider.argument ?? registration.provider.argumentProvider?.();
      const innerToken = registration.provider.useToken ?? registration.provider.useTokenProvider();

      instance = await this._resolveAsync<T, A>(innerToken, false, arg, context, chain.addToken(innerToken), false);
    }

    if (isFactoryProvider(registration.provider)) {
      try {
        instance = registration.provider.useFactory(resolveArgument, this.getResolveContext(context, chain));
      }
      catch (error) {
        throw new ResolveError('error in factory', chain, error as Error);
      }
    }

    if (isAsyncFactoryProvider(registration.provider)) {
      try {
        instance = await registration.provider.useAsyncFactory(resolveArgument, this.getResolveContext(context, chain));
      }
      catch (error) {
        throw new ResolveError('error in factory', chain, error as Error);
      }
    }

    if (!isTokenProvider(registration.provider)) {
      if (registration.options.lifecycle == 'resolution') {
        context.instances.set([token, argumentIdentity], instance);
      }

      if (registration.options.lifecycle == 'singleton') {
        registration.instances.set(argumentIdentity, instance);
      }

      context.resolutions.push({ instance, registration });
    }

    context.resolving.delete([token, argumentIdentity]);

    if (isFirst) {
      for (const fn of context.forwardRefQueue.consume()) {
        await fn();
      }

      derefForwardRefs(context);

      for (let i = context.resolutions.length - 1; i >= 0; i--) {
        const resolution = context.resolutions[i]!;

        if (isFunction((resolution.instance as AfterResolve | undefined)?.[afterResolve])) {
          await (resolution.instance as AfterResolve)[afterResolve]!();
        }

        if (isDefined(resolution.registration.options.initializer)) {
          await resolution.registration.options.initializer(resolution.instance);
        }
      }
    }

    return instance;
  }

  private resolveInjection(token: InjectionToken, context: InternalResolveContext, typeInfo: TypeInfo, metadata: InjectMetadata, resolveArgument: any, chain: ResolveChain): unknown {
    const getChain = metadata.type == 'parameter'
      ? (injectToken: InjectionToken | undefined) => chain.addParameter(typeInfo.constructor, metadata.parameterIndex, injectToken!).addToken(injectToken!)
      : (injectToken: InjectionToken | undefined) => chain.addProperty(typeInfo.constructor, metadata.propertyKey, injectToken!).addToken(injectToken!);

    const injectToken = (metadata.injectToken ?? metadata.token)!;

    if (isDefined(metadata.injectArgumentMapper)) {
      const mapped = metadata.injectArgumentMapper(resolveArgument);

      if (isPromise(mapped)) {
        throw new ResolveError(`cannot evaluate async argument mapper for token ${getTokenName(token)} in synchronous resolve, use resolveAsync instead`, getChain(injectToken));
      }

      return mapped;
    }

    const parameterResolveArgument = metadata.forwardArgumentMapper?.(resolveArgument) ?? metadata.resolveArgumentProvider?.(this.getResolveContext(context, getChain(injectToken)));

    if (isPromise(parameterResolveArgument)) {
      throw new ResolveError(`cannot evaluate async argument provider for token ${getTokenName(token)} in synchronous resolve, use resolveAsync instead`, getChain(injectToken));
    }

    if (isDefined(metadata.forwardRefToken)) {
      const forwardRef = ForwardRef.create();
      const forwardRefToken = metadata.forwardRefToken;

      context.forwardRefQueue.add(() => {
        const forwardToken = isFunction(forwardRefToken) ? forwardRefToken() : forwardRefToken;

        if (isDefined(metadata.mapper)) {
          throw new ResolveError('cannot use inject mapper with forwardRef', getChain(forwardToken));
        }

        const resolved = this._resolve(forwardToken, metadata.optional, parameterResolveArgument, context, getChain(forwardToken), false);
        ForwardRef.setRef(forwardRef, resolved);
      });

      context.forwardRefs.add(forwardRef);
      return forwardRef;
    }

    const resolved = this._resolve(injectToken, metadata.optional, parameterResolveArgument, context, getChain(injectToken), false);
    return isDefined(metadata.mapper) ? metadata.mapper(resolved) : resolved;
  }

  private async resolveInjectionAsync(context: InternalResolveContext, typeInfo: TypeInfo, metadata: InjectMetadata, resolveArgument: any, chain: ResolveChain): Promise<{ resolved: unknown }> {
    if (isDefined(metadata.injectArgumentMapper)) {
      return { resolved: metadata.injectArgumentMapper(resolveArgument) };
    }

    const getChain = metadata.type == 'parameter'
      ? (injectToken: InjectionToken | undefined) => chain.addParameter(typeInfo.constructor, metadata.parameterIndex, injectToken!).addToken(injectToken!)
      : (injectToken: InjectionToken | undefined) => chain.addProperty(typeInfo.constructor, metadata.propertyKey, injectToken!).addToken(injectToken!);

    const injectToken = (metadata.injectToken ?? metadata.token)!;
    const parameterResolveArgument = await (metadata.forwardArgumentMapper?.(resolveArgument) ?? metadata.resolveArgumentProvider?.(this.getResolveContext(context, getChain(injectToken))));

    if (isDefined(metadata.forwardRefToken)) {
      const forwardRef = ForwardRef.create();
      const forwardRefToken = metadata.forwardRefToken;

      context.forwardRefQueue.add(async () => {
        const forwardToken = isFunction(forwardRefToken) ? forwardRefToken() : forwardRefToken;

        if (isDefined(metadata.mapper)) {
          throw new ResolveError('cannot use inject mapper with forwardRef', getChain(forwardToken));
        }

        const resolved = await this._resolveAsync(forwardToken, metadata.optional, parameterResolveArgument, context, getChain(forwardToken), false);
        ForwardRef.setRef(forwardRef, resolved);
      });

      context.forwardRefs.add(forwardRef);
      return { resolved: forwardRef };
    }

    const resolved = await this._resolveAsync(injectToken, metadata.optional, parameterResolveArgument, context, getChain(injectToken), false);
    return { resolved: isDefined(metadata.mapper) ? metadata.mapper(resolved) : resolved };
  }

  private getResolveContext(resolveContext: InternalResolveContext, chain: ResolveChain): ResolveContext {
    const context: ResolveContext = {
      isAsync: resolveContext.isAsync,
      resolve: (token, argument, instances) => {
        this.addInstancesToResolveContext(instances, resolveContext);
        return this._resolve(token, false, argument, resolveContext, chain.addToken(token), false);
      },
      resolveAsync: async (token, argument, instances) => {
        this.addInstancesToResolveContext(instances, resolveContext);
        return this._resolveAsync(token, false, argument, resolveContext, chain.addToken(token), false);
      }
    };

    return context;
  }

  private addInstancesToResolveContext(instances: [InjectionToken, any][] | undefined, resolveContext: InternalResolveContext): void {
    if (isUndefined(instances)) {
      return;
    }

    for (const [instanceToken, instance] of instances) {
      resolveContext.providedInstances.set(instanceToken, instance);
    }
  }
}

function derefForwardRefs(context: InternalResolveContext): void {
  for (const resolution of context.resolutions) {
    if (!(typeof resolution.instance == 'object')) {
      continue;
    }

    for (const [key, value] of Object.entries(resolution.instance as Record)) {
      if (!context.forwardRefs.has(value as ForwardRef)) {
        continue;
      }

      (resolution.instance as Record)[key] = ForwardRef.deref(value);
    }
  }
}

export const container = new Container();

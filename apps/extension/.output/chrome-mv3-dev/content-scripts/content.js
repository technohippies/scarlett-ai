var content = function() {
  "use strict";var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  var _a, _b;
  const IS_DEV = true;
  const equalFn = (a, b) => a === b;
  const $PROXY = Symbol("solid-proxy");
  const SUPPORTS_PROXY = typeof Proxy === "function";
  const $TRACK = Symbol("solid-track");
  const $DEVCOMP = Symbol("solid-dev-component");
  const signalOptions = {
    equals: equalFn
  };
  let runEffects = runQueue;
  const STALE = 1;
  const PENDING = 2;
  const UNOWNED = {};
  const NO_INIT = {};
  var Owner = null;
  let Transition = null;
  let ExternalSourceConfig = null;
  let Listener = null;
  let Updates = null;
  let Effects = null;
  let ExecCount = 0;
  function createRoot(fn, detachedOwner) {
    const listener = Listener, owner = Owner, unowned = fn.length === 0, current = detachedOwner === void 0 ? owner : detachedOwner, root = unowned ? {
      owned: null,
      cleanups: null,
      context: null,
      owner: null
    } : {
      owned: null,
      cleanups: null,
      context: current ? current.context : null,
      owner: current
    }, updateFn = unowned ? () => fn(() => {
      throw new Error("Dispose method must be an explicit argument to createRoot function");
    }) : () => fn(() => untrack(() => cleanNode(root)));
    Owner = root;
    Listener = null;
    try {
      return runUpdates(updateFn, true);
    } finally {
      Listener = listener;
      Owner = owner;
    }
  }
  function createSignal(value, options) {
    options = options ? Object.assign({}, signalOptions, options) : signalOptions;
    const s = {
      value,
      observers: null,
      observerSlots: null,
      comparator: options.equals || void 0
    };
    {
      if (options.name) s.name = options.name;
      if (options.internal) {
        s.internal = true;
      } else {
        registerGraph(s);
      }
    }
    const setter = (value2) => {
      if (typeof value2 === "function") {
        value2 = value2(s.value);
      }
      return writeSignal(s, value2);
    };
    return [readSignal.bind(s), setter];
  }
  function createComputed(fn, value, options) {
    const c = createComputation(fn, value, true, STALE, options);
    updateComputation(c);
  }
  function createRenderEffect(fn, value, options) {
    const c = createComputation(fn, value, false, STALE, options);
    updateComputation(c);
  }
  function createEffect(fn, value, options) {
    runEffects = runUserEffects;
    const c = createComputation(fn, value, false, STALE, options);
    c.user = true;
    Effects ? Effects.push(c) : updateComputation(c);
  }
  function createMemo(fn, value, options) {
    options = options ? Object.assign({}, signalOptions, options) : signalOptions;
    const c = createComputation(fn, value, true, 0, options);
    c.observers = null;
    c.observerSlots = null;
    c.comparator = options.equals || void 0;
    updateComputation(c);
    return readSignal.bind(c);
  }
  function isPromise(v) {
    return v && typeof v === "object" && "then" in v;
  }
  function createResource(pSource, pFetcher, pOptions) {
    let source;
    let fetcher;
    let options;
    {
      source = true;
      fetcher = pSource;
      options = {};
    }
    let pr = null, initP = NO_INIT, scheduled = false, resolved = "initialValue" in options, dynamic = typeof source === "function" && createMemo(source);
    const contexts = /* @__PURE__ */ new Set(), [value, setValue] = (options.storage || createSignal)(options.initialValue), [error, setError] = createSignal(void 0), [track, trigger] = createSignal(void 0, {
      equals: false
    }), [state, setState] = createSignal(resolved ? "ready" : "unresolved");
    function loadEnd(p, v, error2, key) {
      if (pr === p) {
        pr = null;
        key !== void 0 && (resolved = true);
        if ((p === initP || v === initP) && options.onHydrated) queueMicrotask(() => options.onHydrated(key, {
          value: v
        }));
        initP = NO_INIT;
        completeLoad(v, error2);
      }
      return v;
    }
    function completeLoad(v, err) {
      runUpdates(() => {
        if (err === void 0) setValue(() => v);
        setState(err !== void 0 ? "errored" : resolved ? "ready" : "unresolved");
        setError(err);
        for (const c of contexts.keys()) c.decrement();
        contexts.clear();
      }, false);
    }
    function read() {
      const c = SuspenseContext, v = value(), err = error();
      if (err !== void 0 && !pr) throw err;
      if (Listener && !Listener.user && c) ;
      return v;
    }
    function load(refetching = true) {
      if (refetching !== false && scheduled) return;
      scheduled = false;
      const lookup = dynamic ? dynamic() : source;
      if (lookup == null || lookup === false) {
        loadEnd(pr, untrack(value));
        return;
      }
      let error2;
      const p = initP !== NO_INIT ? initP : untrack(() => {
        try {
          return fetcher(lookup, {
            value: value(),
            refetching
          });
        } catch (fetcherError) {
          error2 = fetcherError;
        }
      });
      if (error2 !== void 0) {
        loadEnd(pr, void 0, castError(error2), lookup);
        return;
      } else if (!isPromise(p)) {
        loadEnd(pr, p, void 0, lookup);
        return p;
      }
      pr = p;
      if ("v" in p) {
        if (p.s === 1) loadEnd(pr, p.v, void 0, lookup);
        else loadEnd(pr, void 0, castError(p.v), lookup);
        return p;
      }
      scheduled = true;
      queueMicrotask(() => scheduled = false);
      runUpdates(() => {
        setState(resolved ? "refreshing" : "pending");
        trigger();
      }, false);
      return p.then((v) => loadEnd(p, v, void 0, lookup), (e) => loadEnd(p, void 0, castError(e), lookup));
    }
    Object.defineProperties(read, {
      state: {
        get: () => state()
      },
      error: {
        get: () => error()
      },
      loading: {
        get() {
          const s = state();
          return s === "pending" || s === "refreshing";
        }
      },
      latest: {
        get() {
          if (!resolved) return read();
          const err = error();
          if (err && !pr) throw err;
          return value();
        }
      }
    });
    let owner = Owner;
    if (dynamic) createComputed(() => (owner = Owner, load(false)));
    else load(false);
    return [read, {
      refetch: (info) => runWithOwner(owner, () => load(info)),
      mutate: setValue
    }];
  }
  function untrack(fn) {
    if (Listener === null) return fn();
    const listener = Listener;
    Listener = null;
    try {
      if (ExternalSourceConfig) ;
      return fn();
    } finally {
      Listener = listener;
    }
  }
  function onMount(fn) {
    createEffect(() => untrack(fn));
  }
  function onCleanup(fn) {
    if (Owner === null) console.warn("cleanups created outside a `createRoot` or `render` will never be run");
    else if (Owner.cleanups === null) Owner.cleanups = [fn];
    else Owner.cleanups.push(fn);
    return fn;
  }
  function runWithOwner(o, fn) {
    const prev = Owner;
    const prevListener = Listener;
    Owner = o;
    Listener = null;
    try {
      return runUpdates(fn, true);
    } catch (err) {
      handleError(err);
    } finally {
      Owner = prev;
      Listener = prevListener;
    }
  }
  const [transPending, setTransPending] = /* @__PURE__ */ createSignal(false);
  function devComponent(Comp, props) {
    const c = createComputation(() => untrack(() => {
      Object.assign(Comp, {
        [$DEVCOMP]: true
      });
      return Comp(props);
    }), void 0, true, 0);
    c.props = props;
    c.observers = null;
    c.observerSlots = null;
    c.name = Comp.name;
    c.component = Comp;
    updateComputation(c);
    return c.tValue !== void 0 ? c.tValue : c.value;
  }
  function registerGraph(value) {
    if (Owner) {
      if (Owner.sourceMap) Owner.sourceMap.push(value);
      else Owner.sourceMap = [value];
      value.graph = Owner;
    }
  }
  function createContext(defaultValue, options) {
    const id = Symbol("context");
    return {
      id,
      Provider: createProvider(id, options),
      defaultValue
    };
  }
  function useContext(context) {
    let value;
    return Owner && Owner.context && (value = Owner.context[context.id]) !== void 0 ? value : context.defaultValue;
  }
  function children(fn) {
    const children2 = createMemo(fn);
    const memo2 = createMemo(() => resolveChildren(children2()), void 0, {
      name: "children"
    });
    memo2.toArray = () => {
      const c = memo2();
      return Array.isArray(c) ? c : c != null ? [c] : [];
    };
    return memo2;
  }
  let SuspenseContext;
  function readSignal() {
    if (this.sources && this.state) {
      if (this.state === STALE) updateComputation(this);
      else {
        const updates = Updates;
        Updates = null;
        runUpdates(() => lookUpstream(this), false);
        Updates = updates;
      }
    }
    if (Listener) {
      const sSlot = this.observers ? this.observers.length : 0;
      if (!Listener.sources) {
        Listener.sources = [this];
        Listener.sourceSlots = [sSlot];
      } else {
        Listener.sources.push(this);
        Listener.sourceSlots.push(sSlot);
      }
      if (!this.observers) {
        this.observers = [Listener];
        this.observerSlots = [Listener.sources.length - 1];
      } else {
        this.observers.push(Listener);
        this.observerSlots.push(Listener.sources.length - 1);
      }
    }
    return this.value;
  }
  function writeSignal(node, value, isComp) {
    let current = node.value;
    if (!node.comparator || !node.comparator(current, value)) {
      node.value = value;
      if (node.observers && node.observers.length) {
        runUpdates(() => {
          for (let i = 0; i < node.observers.length; i += 1) {
            const o = node.observers[i];
            const TransitionRunning = Transition && Transition.running;
            if (TransitionRunning && Transition.disposed.has(o)) ;
            if (TransitionRunning ? !o.tState : !o.state) {
              if (o.pure) Updates.push(o);
              else Effects.push(o);
              if (o.observers) markDownstream(o);
            }
            if (!TransitionRunning) o.state = STALE;
          }
          if (Updates.length > 1e6) {
            Updates = [];
            if (IS_DEV) throw new Error("Potential Infinite Loop Detected.");
            throw new Error();
          }
        }, false);
      }
    }
    return value;
  }
  function updateComputation(node) {
    if (!node.fn) return;
    cleanNode(node);
    const time = ExecCount;
    runComputation(node, node.value, time);
  }
  function runComputation(node, value, time) {
    let nextValue;
    const owner = Owner, listener = Listener;
    Listener = Owner = node;
    try {
      nextValue = node.fn(value);
    } catch (err) {
      if (node.pure) {
        {
          node.state = STALE;
          node.owned && node.owned.forEach(cleanNode);
          node.owned = null;
        }
      }
      node.updatedAt = time + 1;
      return handleError(err);
    } finally {
      Listener = listener;
      Owner = owner;
    }
    if (!node.updatedAt || node.updatedAt <= time) {
      if (node.updatedAt != null && "observers" in node) {
        writeSignal(node, nextValue);
      } else node.value = nextValue;
      node.updatedAt = time;
    }
  }
  function createComputation(fn, init, pure, state = STALE, options) {
    const c = {
      fn,
      state,
      updatedAt: null,
      owned: null,
      sources: null,
      sourceSlots: null,
      cleanups: null,
      value: init,
      owner: Owner,
      context: Owner ? Owner.context : null,
      pure
    };
    if (Owner === null) console.warn("computations created outside a `createRoot` or `render` will never be disposed");
    else if (Owner !== UNOWNED) {
      {
        if (!Owner.owned) Owner.owned = [c];
        else Owner.owned.push(c);
      }
    }
    if (options && options.name) c.name = options.name;
    return c;
  }
  function runTop(node) {
    if (node.state === 0) return;
    if (node.state === PENDING) return lookUpstream(node);
    if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
    const ancestors = [node];
    while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
      if (node.state) ancestors.push(node);
    }
    for (let i = ancestors.length - 1; i >= 0; i--) {
      node = ancestors[i];
      if (node.state === STALE) {
        updateComputation(node);
      } else if (node.state === PENDING) {
        const updates = Updates;
        Updates = null;
        runUpdates(() => lookUpstream(node, ancestors[0]), false);
        Updates = updates;
      }
    }
  }
  function runUpdates(fn, init) {
    if (Updates) return fn();
    let wait = false;
    if (!init) Updates = [];
    if (Effects) wait = true;
    else Effects = [];
    ExecCount++;
    try {
      const res = fn();
      completeUpdates(wait);
      return res;
    } catch (err) {
      if (!wait) Effects = null;
      Updates = null;
      handleError(err);
    }
  }
  function completeUpdates(wait) {
    if (Updates) {
      runQueue(Updates);
      Updates = null;
    }
    if (wait) return;
    const e = Effects;
    Effects = null;
    if (e.length) runUpdates(() => runEffects(e), false);
  }
  function runQueue(queue) {
    for (let i = 0; i < queue.length; i++) runTop(queue[i]);
  }
  function runUserEffects(queue) {
    let i, userLength = 0;
    for (i = 0; i < queue.length; i++) {
      const e = queue[i];
      if (!e.user) runTop(e);
      else queue[userLength++] = e;
    }
    for (i = 0; i < userLength; i++) runTop(queue[i]);
  }
  function lookUpstream(node, ignore) {
    node.state = 0;
    for (let i = 0; i < node.sources.length; i += 1) {
      const source = node.sources[i];
      if (source.sources) {
        const state = source.state;
        if (state === STALE) {
          if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount)) runTop(source);
        } else if (state === PENDING) lookUpstream(source, ignore);
      }
    }
  }
  function markDownstream(node) {
    for (let i = 0; i < node.observers.length; i += 1) {
      const o = node.observers[i];
      if (!o.state) {
        o.state = PENDING;
        if (o.pure) Updates.push(o);
        else Effects.push(o);
        o.observers && markDownstream(o);
      }
    }
  }
  function cleanNode(node) {
    let i;
    if (node.sources) {
      while (node.sources.length) {
        const source = node.sources.pop(), index2 = node.sourceSlots.pop(), obs = source.observers;
        if (obs && obs.length) {
          const n = obs.pop(), s = source.observerSlots.pop();
          if (index2 < obs.length) {
            n.sourceSlots[s] = index2;
            obs[index2] = n;
            source.observerSlots[index2] = s;
          }
        }
      }
    }
    if (node.tOwned) {
      for (i = node.tOwned.length - 1; i >= 0; i--) cleanNode(node.tOwned[i]);
      delete node.tOwned;
    }
    if (node.owned) {
      for (i = node.owned.length - 1; i >= 0; i--) cleanNode(node.owned[i]);
      node.owned = null;
    }
    if (node.cleanups) {
      for (i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]();
      node.cleanups = null;
    }
    node.state = 0;
    delete node.sourceMap;
  }
  function castError(err) {
    if (err instanceof Error) return err;
    return new Error(typeof err === "string" ? err : "Unknown error", {
      cause: err
    });
  }
  function handleError(err, owner = Owner) {
    const error = castError(err);
    throw error;
  }
  function resolveChildren(children2) {
    if (typeof children2 === "function" && !children2.length) return resolveChildren(children2());
    if (Array.isArray(children2)) {
      const results = [];
      for (let i = 0; i < children2.length; i++) {
        const result2 = resolveChildren(children2[i]);
        Array.isArray(result2) ? results.push.apply(results, result2) : results.push(result2);
      }
      return results;
    }
    return children2;
  }
  function createProvider(id, options) {
    return function provider(props) {
      let res;
      createRenderEffect(() => res = untrack(() => {
        Owner.context = {
          ...Owner.context,
          [id]: props.value
        };
        return children(() => props.children);
      }), void 0, options);
      return res;
    };
  }
  const FALLBACK = Symbol("fallback");
  function dispose(d) {
    for (let i = 0; i < d.length; i++) d[i]();
  }
  function mapArray(list, mapFn, options = {}) {
    let items = [], mapped = [], disposers = [], len = 0, indexes = mapFn.length > 1 ? [] : null;
    onCleanup(() => dispose(disposers));
    return () => {
      let newItems = list() || [], newLen = newItems.length, i, j;
      newItems[$TRACK];
      return untrack(() => {
        let newIndices, newIndicesNext, temp, tempdisposers, tempIndexes, start, end, newEnd, item;
        if (newLen === 0) {
          if (len !== 0) {
            dispose(disposers);
            disposers = [];
            items = [];
            mapped = [];
            len = 0;
            indexes && (indexes = []);
          }
          if (options.fallback) {
            items = [FALLBACK];
            mapped[0] = createRoot((disposer) => {
              disposers[0] = disposer;
              return options.fallback();
            });
            len = 1;
          }
        } else if (len === 0) {
          mapped = new Array(newLen);
          for (j = 0; j < newLen; j++) {
            items[j] = newItems[j];
            mapped[j] = createRoot(mapper);
          }
          len = newLen;
        } else {
          temp = new Array(newLen);
          tempdisposers = new Array(newLen);
          indexes && (tempIndexes = new Array(newLen));
          for (start = 0, end = Math.min(len, newLen); start < end && items[start] === newItems[start]; start++) ;
          for (end = len - 1, newEnd = newLen - 1; end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
            temp[newEnd] = mapped[end];
            tempdisposers[newEnd] = disposers[end];
            indexes && (tempIndexes[newEnd] = indexes[end]);
          }
          newIndices = /* @__PURE__ */ new Map();
          newIndicesNext = new Array(newEnd + 1);
          for (j = newEnd; j >= start; j--) {
            item = newItems[j];
            i = newIndices.get(item);
            newIndicesNext[j] = i === void 0 ? -1 : i;
            newIndices.set(item, j);
          }
          for (i = start; i <= end; i++) {
            item = items[i];
            j = newIndices.get(item);
            if (j !== void 0 && j !== -1) {
              temp[j] = mapped[i];
              tempdisposers[j] = disposers[i];
              indexes && (tempIndexes[j] = indexes[i]);
              j = newIndicesNext[j];
              newIndices.set(item, j);
            } else disposers[i]();
          }
          for (j = start; j < newLen; j++) {
            if (j in temp) {
              mapped[j] = temp[j];
              disposers[j] = tempdisposers[j];
              if (indexes) {
                indexes[j] = tempIndexes[j];
                indexes[j](j);
              }
            } else mapped[j] = createRoot(mapper);
          }
          mapped = mapped.slice(0, len = newLen);
          items = newItems.slice(0);
        }
        return mapped;
      });
      function mapper(disposer) {
        disposers[j] = disposer;
        if (indexes) {
          const [s, set] = createSignal(j, {
            name: "index"
          });
          indexes[j] = set;
          return mapFn(newItems[j], s);
        }
        return mapFn(newItems[j]);
      }
    };
  }
  function createComponent(Comp, props) {
    return devComponent(Comp, props || {});
  }
  function trueFn() {
    return true;
  }
  const propTraps = {
    get(_, property, receiver) {
      if (property === $PROXY) return receiver;
      return _.get(property);
    },
    has(_, property) {
      if (property === $PROXY) return true;
      return _.has(property);
    },
    set: trueFn,
    deleteProperty: trueFn,
    getOwnPropertyDescriptor(_, property) {
      return {
        configurable: true,
        enumerable: true,
        get() {
          return _.get(property);
        },
        set: trueFn,
        deleteProperty: trueFn
      };
    },
    ownKeys(_) {
      return _.keys();
    }
  };
  function resolveSource(s) {
    return !(s = typeof s === "function" ? s() : s) ? {} : s;
  }
  function resolveSources() {
    for (let i = 0, length = this.length; i < length; ++i) {
      const v = this[i]();
      if (v !== void 0) return v;
    }
  }
  function mergeProps(...sources) {
    let proxy = false;
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      proxy = proxy || !!s && $PROXY in s;
      sources[i] = typeof s === "function" ? (proxy = true, createMemo(s)) : s;
    }
    if (SUPPORTS_PROXY && proxy) {
      return new Proxy({
        get(property) {
          for (let i = sources.length - 1; i >= 0; i--) {
            const v = resolveSource(sources[i])[property];
            if (v !== void 0) return v;
          }
        },
        has(property) {
          for (let i = sources.length - 1; i >= 0; i--) {
            if (property in resolveSource(sources[i])) return true;
          }
          return false;
        },
        keys() {
          const keys = [];
          for (let i = 0; i < sources.length; i++) keys.push(...Object.keys(resolveSource(sources[i])));
          return [...new Set(keys)];
        }
      }, propTraps);
    }
    const sourcesMap = {};
    const defined = /* @__PURE__ */ Object.create(null);
    for (let i = sources.length - 1; i >= 0; i--) {
      const source = sources[i];
      if (!source) continue;
      const sourceKeys = Object.getOwnPropertyNames(source);
      for (let i2 = sourceKeys.length - 1; i2 >= 0; i2--) {
        const key = sourceKeys[i2];
        if (key === "__proto__" || key === "constructor") continue;
        const desc = Object.getOwnPropertyDescriptor(source, key);
        if (!defined[key]) {
          defined[key] = desc.get ? {
            enumerable: true,
            configurable: true,
            get: resolveSources.bind(sourcesMap[key] = [desc.get.bind(source)])
          } : desc.value !== void 0 ? desc : void 0;
        } else {
          const sources2 = sourcesMap[key];
          if (sources2) {
            if (desc.get) sources2.push(desc.get.bind(source));
            else if (desc.value !== void 0) sources2.push(() => desc.value);
          }
        }
      }
    }
    const target = {};
    const definedKeys = Object.keys(defined);
    for (let i = definedKeys.length - 1; i >= 0; i--) {
      const key = definedKeys[i], desc = defined[key];
      if (desc && desc.get) Object.defineProperty(target, key, desc);
      else target[key] = desc ? desc.value : void 0;
    }
    return target;
  }
  function splitProps(props, ...keys) {
    if (SUPPORTS_PROXY && $PROXY in props) {
      const blocked = new Set(keys.length > 1 ? keys.flat() : keys[0]);
      const res = keys.map((k) => {
        return new Proxy({
          get(property) {
            return k.includes(property) ? props[property] : void 0;
          },
          has(property) {
            return k.includes(property) && property in props;
          },
          keys() {
            return k.filter((property) => property in props);
          }
        }, propTraps);
      });
      res.push(new Proxy({
        get(property) {
          return blocked.has(property) ? void 0 : props[property];
        },
        has(property) {
          return blocked.has(property) ? false : property in props;
        },
        keys() {
          return Object.keys(props).filter((k) => !blocked.has(k));
        }
      }, propTraps));
      return res;
    }
    const otherObject = {};
    const objects = keys.map(() => ({}));
    for (const propName of Object.getOwnPropertyNames(props)) {
      const desc = Object.getOwnPropertyDescriptor(props, propName);
      const isDefaultDesc = !desc.get && !desc.set && desc.enumerable && desc.writable && desc.configurable;
      let blocked = false;
      let objectIndex = 0;
      for (const k of keys) {
        if (k.includes(propName)) {
          blocked = true;
          isDefaultDesc ? objects[objectIndex][propName] = desc.value : Object.defineProperty(objects[objectIndex], propName, desc);
        }
        ++objectIndex;
      }
      if (!blocked) {
        isDefaultDesc ? otherObject[propName] = desc.value : Object.defineProperty(otherObject, propName, desc);
      }
    }
    return [...objects, otherObject];
  }
  const narrowedError = (name) => `Attempting to access a stale value from <${name}> that could possibly be undefined. This may occur because you are reading the accessor returned from the component at a time where it has already been unmounted. We recommend cleaning up any stale timers or async, or reading from the initial condition.`;
  function For(props) {
    const fallback = "fallback" in props && {
      fallback: () => props.fallback
    };
    return createMemo(mapArray(() => props.each, props.children, fallback || void 0), void 0, {
      name: "value"
    });
  }
  function Show(props) {
    const keyed = props.keyed;
    const conditionValue = createMemo(() => props.when, void 0, {
      name: "condition value"
    });
    const condition = keyed ? conditionValue : createMemo(conditionValue, void 0, {
      equals: (a, b) => !a === !b,
      name: "condition"
    });
    return createMemo(() => {
      const c = condition();
      if (c) {
        const child = props.children;
        const fn = typeof child === "function" && child.length > 0;
        return fn ? untrack(() => child(keyed ? c : () => {
          if (!untrack(condition)) throw narrowedError("Show");
          return conditionValue();
        })) : child;
      }
      return props.fallback;
    }, void 0, {
      name: "value"
    });
  }
  if (globalThis) {
    if (!globalThis.Solid$$) globalThis.Solid$$ = true;
    else console.warn("You appear to have multiple instances of Solid. This can lead to unexpected behavior.");
  }
  const booleans = ["allowfullscreen", "async", "autofocus", "autoplay", "checked", "controls", "default", "disabled", "formnovalidate", "hidden", "indeterminate", "inert", "ismap", "loop", "multiple", "muted", "nomodule", "novalidate", "open", "playsinline", "readonly", "required", "reversed", "seamless", "selected"];
  const Properties = /* @__PURE__ */ new Set(["className", "value", "readOnly", "noValidate", "formNoValidate", "isMap", "noModule", "playsInline", ...booleans]);
  const ChildProperties = /* @__PURE__ */ new Set(["innerHTML", "textContent", "innerText", "children"]);
  const Aliases = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(null), {
    className: "class",
    htmlFor: "for"
  });
  const PropAliases = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(null), {
    class: "className",
    novalidate: {
      $: "noValidate",
      FORM: 1
    },
    formnovalidate: {
      $: "formNoValidate",
      BUTTON: 1,
      INPUT: 1
    },
    ismap: {
      $: "isMap",
      IMG: 1
    },
    nomodule: {
      $: "noModule",
      SCRIPT: 1
    },
    playsinline: {
      $: "playsInline",
      VIDEO: 1
    },
    readonly: {
      $: "readOnly",
      INPUT: 1,
      TEXTAREA: 1
    }
  });
  function getPropAlias(prop, tagName) {
    const a = PropAliases[prop];
    return typeof a === "object" ? a[tagName] ? a["$"] : void 0 : a;
  }
  const DelegatedEvents = /* @__PURE__ */ new Set(["beforeinput", "click", "dblclick", "contextmenu", "focusin", "focusout", "input", "keydown", "keyup", "mousedown", "mousemove", "mouseout", "mouseover", "mouseup", "pointerdown", "pointermove", "pointerout", "pointerover", "pointerup", "touchend", "touchmove", "touchstart"]);
  const memo = (fn) => createMemo(() => fn());
  function reconcileArrays(parentNode, a, b) {
    let bLength = b.length, aEnd = a.length, bEnd = bLength, aStart = 0, bStart = 0, after = a[aEnd - 1].nextSibling, map = null;
    while (aStart < aEnd || bStart < bEnd) {
      if (a[aStart] === b[bStart]) {
        aStart++;
        bStart++;
        continue;
      }
      while (a[aEnd - 1] === b[bEnd - 1]) {
        aEnd--;
        bEnd--;
      }
      if (aEnd === aStart) {
        const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
        while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
      } else if (bEnd === bStart) {
        while (aStart < aEnd) {
          if (!map || !map.has(a[aStart])) a[aStart].remove();
          aStart++;
        }
      } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
        const node = a[--aEnd].nextSibling;
        parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
        parentNode.insertBefore(b[--bEnd], node);
        a[aEnd] = b[bEnd];
      } else {
        if (!map) {
          map = /* @__PURE__ */ new Map();
          let i = bStart;
          while (i < bEnd) map.set(b[i], i++);
        }
        const index2 = map.get(a[aStart]);
        if (index2 != null) {
          if (bStart < index2 && index2 < bEnd) {
            let i = aStart, sequence = 1, t;
            while (++i < aEnd && i < bEnd) {
              if ((t = map.get(a[i])) == null || t !== index2 + sequence) break;
              sequence++;
            }
            if (sequence > index2 - bStart) {
              const node = a[aStart];
              while (bStart < index2) parentNode.insertBefore(b[bStart++], node);
            } else parentNode.replaceChild(b[bStart++], a[aStart++]);
          } else aStart++;
        } else a[aStart++].remove();
      }
    }
  }
  const $$EVENTS = "_$DX_DELEGATE";
  function render(code, element, init, options = {}) {
    if (!element) {
      throw new Error("The `element` passed to `render(..., element)` doesn't exist. Make sure `element` exists in the document.");
    }
    let disposer;
    createRoot((dispose2) => {
      disposer = dispose2;
      element === document ? code() : insert(element, code(), element.firstChild ? null : void 0, init);
    }, options.owner);
    return () => {
      disposer();
      element.textContent = "";
    };
  }
  function template(html, isImportNode, isSVG, isMathML) {
    let node;
    const create = () => {
      const t = document.createElement("template");
      t.innerHTML = html;
      return t.content.firstChild;
    };
    const fn = () => (node || (node = create())).cloneNode(true);
    fn.cloneNode = fn;
    return fn;
  }
  function delegateEvents(eventNames, document2 = window.document) {
    const e = document2[$$EVENTS] || (document2[$$EVENTS] = /* @__PURE__ */ new Set());
    for (let i = 0, l = eventNames.length; i < l; i++) {
      const name = eventNames[i];
      if (!e.has(name)) {
        e.add(name);
        document2.addEventListener(name, eventHandler);
      }
    }
  }
  function setAttribute(node, name, value) {
    if (value == null) node.removeAttribute(name);
    else node.setAttribute(name, value);
  }
  function setBoolAttribute(node, name, value) {
    value ? node.setAttribute(name, "") : node.removeAttribute(name);
  }
  function className(node, value) {
    if (value == null) node.removeAttribute("class");
    else node.className = value;
  }
  function addEventListener$1(node, name, handler, delegate) {
    if (delegate) {
      if (Array.isArray(handler)) {
        node[`$$${name}`] = handler[0];
        node[`$$${name}Data`] = handler[1];
      } else node[`$$${name}`] = handler;
    } else if (Array.isArray(handler)) {
      const handlerFn = handler[0];
      node.addEventListener(name, handler[0] = (e) => handlerFn.call(node, handler[1], e));
    } else node.addEventListener(name, handler, typeof handler !== "function" && handler);
  }
  function classList(node, value, prev = {}) {
    const classKeys = Object.keys(value || {}), prevKeys = Object.keys(prev);
    let i, len;
    for (i = 0, len = prevKeys.length; i < len; i++) {
      const key = prevKeys[i];
      if (!key || key === "undefined" || value[key]) continue;
      toggleClassKey(node, key, false);
      delete prev[key];
    }
    for (i = 0, len = classKeys.length; i < len; i++) {
      const key = classKeys[i], classValue = !!value[key];
      if (!key || key === "undefined" || prev[key] === classValue || !classValue) continue;
      toggleClassKey(node, key, true);
      prev[key] = classValue;
    }
    return prev;
  }
  function style(node, value, prev) {
    if (!value) return prev ? setAttribute(node, "style") : value;
    const nodeStyle = node.style;
    if (typeof value === "string") return nodeStyle.cssText = value;
    typeof prev === "string" && (nodeStyle.cssText = prev = void 0);
    prev || (prev = {});
    value || (value = {});
    let v, s;
    for (s in prev) {
      value[s] == null && nodeStyle.removeProperty(s);
      delete prev[s];
    }
    for (s in value) {
      v = value[s];
      if (v !== prev[s]) {
        nodeStyle.setProperty(s, v);
        prev[s] = v;
      }
    }
    return prev;
  }
  function spread(node, props = {}, isSVG, skipChildren) {
    const prevProps = {};
    createRenderEffect(() => typeof props.ref === "function" && use(props.ref, node));
    createRenderEffect(() => assign(node, props, isSVG, true, prevProps, true));
    return prevProps;
  }
  function use(fn, element, arg) {
    return untrack(() => fn(element, arg));
  }
  function insert(parent, accessor, marker, initial) {
    if (marker !== void 0 && !initial) initial = [];
    if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
    createRenderEffect((current) => insertExpression(parent, accessor(), current, marker), initial);
  }
  function assign(node, props, isSVG, skipChildren, prevProps = {}, skipRef = false) {
    props || (props = {});
    for (const prop in prevProps) {
      if (!(prop in props)) {
        if (prop === "children") continue;
        prevProps[prop] = assignProp(node, prop, null, prevProps[prop], isSVG, skipRef, props);
      }
    }
    for (const prop in props) {
      if (prop === "children") {
        continue;
      }
      const value = props[prop];
      prevProps[prop] = assignProp(node, prop, value, prevProps[prop], isSVG, skipRef, props);
    }
  }
  function toPropertyName(name) {
    return name.toLowerCase().replace(/-([a-z])/g, (_, w) => w.toUpperCase());
  }
  function toggleClassKey(node, key, value) {
    const classNames = key.trim().split(/\s+/);
    for (let i = 0, nameLen = classNames.length; i < nameLen; i++) node.classList.toggle(classNames[i], value);
  }
  function assignProp(node, prop, value, prev, isSVG, skipRef, props) {
    let isCE, isProp, isChildProp, propAlias, forceProp;
    if (prop === "style") return style(node, value, prev);
    if (prop === "classList") return classList(node, value, prev);
    if (value === prev) return prev;
    if (prop === "ref") {
      if (!skipRef) value(node);
    } else if (prop.slice(0, 3) === "on:") {
      const e = prop.slice(3);
      prev && node.removeEventListener(e, prev, typeof prev !== "function" && prev);
      value && node.addEventListener(e, value, typeof value !== "function" && value);
    } else if (prop.slice(0, 10) === "oncapture:") {
      const e = prop.slice(10);
      prev && node.removeEventListener(e, prev, true);
      value && node.addEventListener(e, value, true);
    } else if (prop.slice(0, 2) === "on") {
      const name = prop.slice(2).toLowerCase();
      const delegate = DelegatedEvents.has(name);
      if (!delegate && prev) {
        const h = Array.isArray(prev) ? prev[0] : prev;
        node.removeEventListener(name, h);
      }
      if (delegate || value) {
        addEventListener$1(node, name, value, delegate);
        delegate && delegateEvents([name]);
      }
    } else if (prop.slice(0, 5) === "attr:") {
      setAttribute(node, prop.slice(5), value);
    } else if (prop.slice(0, 5) === "bool:") {
      setBoolAttribute(node, prop.slice(5), value);
    } else if ((forceProp = prop.slice(0, 5) === "prop:") || (isChildProp = ChildProperties.has(prop)) || ((propAlias = getPropAlias(prop, node.tagName)) || (isProp = Properties.has(prop))) || (isCE = node.nodeName.includes("-") || "is" in props)) {
      if (forceProp) {
        prop = prop.slice(5);
        isProp = true;
      }
      if (prop === "class" || prop === "className") className(node, value);
      else if (isCE && !isProp && !isChildProp) node[toPropertyName(prop)] = value;
      else node[propAlias || prop] = value;
    } else {
      setAttribute(node, Aliases[prop] || prop, value);
    }
    return value;
  }
  function eventHandler(e) {
    let node = e.target;
    const key = `$$${e.type}`;
    const oriTarget = e.target;
    const oriCurrentTarget = e.currentTarget;
    const retarget = (value) => Object.defineProperty(e, "target", {
      configurable: true,
      value
    });
    const handleNode = () => {
      const handler = node[key];
      if (handler && !node.disabled) {
        const data = node[`${key}Data`];
        data !== void 0 ? handler.call(node, data, e) : handler.call(node, e);
        if (e.cancelBubble) return;
      }
      node.host && typeof node.host !== "string" && !node.host._$host && node.contains(e.target) && retarget(node.host);
      return true;
    };
    const walkUpTree = () => {
      while (handleNode() && (node = node._$host || node.parentNode || node.host)) ;
    };
    Object.defineProperty(e, "currentTarget", {
      configurable: true,
      get() {
        return node || document;
      }
    });
    if (e.composedPath) {
      const path = e.composedPath();
      retarget(path[0]);
      for (let i = 0; i < path.length - 2; i++) {
        node = path[i];
        if (!handleNode()) break;
        if (node._$host) {
          node = node._$host;
          walkUpTree();
          break;
        }
        if (node.parentNode === oriCurrentTarget) {
          break;
        }
      }
    } else walkUpTree();
    retarget(oriTarget);
  }
  function insertExpression(parent, value, current, marker, unwrapArray) {
    while (typeof current === "function") current = current();
    if (value === current) return current;
    const t = typeof value, multi = marker !== void 0;
    parent = multi && current[0] && current[0].parentNode || parent;
    if (t === "string" || t === "number") {
      if (t === "number") {
        value = value.toString();
        if (value === current) return current;
      }
      if (multi) {
        let node = current[0];
        if (node && node.nodeType === 3) {
          node.data !== value && (node.data = value);
        } else node = document.createTextNode(value);
        current = cleanChildren(parent, current, marker, node);
      } else {
        if (current !== "" && typeof current === "string") {
          current = parent.firstChild.data = value;
        } else current = parent.textContent = value;
      }
    } else if (value == null || t === "boolean") {
      current = cleanChildren(parent, current, marker);
    } else if (t === "function") {
      createRenderEffect(() => {
        let v = value();
        while (typeof v === "function") v = v();
        current = insertExpression(parent, v, current, marker);
      });
      return () => current;
    } else if (Array.isArray(value)) {
      const array = [];
      const currentArray = current && Array.isArray(current);
      if (normalizeIncomingArray(array, value, current, unwrapArray)) {
        createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
        return () => current;
      }
      if (array.length === 0) {
        current = cleanChildren(parent, current, marker);
        if (multi) return current;
      } else if (currentArray) {
        if (current.length === 0) {
          appendNodes(parent, array, marker);
        } else reconcileArrays(parent, current, array);
      } else {
        current && cleanChildren(parent);
        appendNodes(parent, array);
      }
      current = array;
    } else if (value.nodeType) {
      if (Array.isArray(current)) {
        if (multi) return current = cleanChildren(parent, current, marker, value);
        cleanChildren(parent, current, null, value);
      } else if (current == null || current === "" || !parent.firstChild) {
        parent.appendChild(value);
      } else parent.replaceChild(value, parent.firstChild);
      current = value;
    } else console.warn(`Unrecognized value. Skipped inserting`, value);
    return current;
  }
  function normalizeIncomingArray(normalized, array, current, unwrap) {
    let dynamic = false;
    for (let i = 0, len = array.length; i < len; i++) {
      let item = array[i], prev = current && current[normalized.length], t;
      if (item == null || item === true || item === false) ;
      else if ((t = typeof item) === "object" && item.nodeType) {
        normalized.push(item);
      } else if (Array.isArray(item)) {
        dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
      } else if (t === "function") {
        if (unwrap) {
          while (typeof item === "function") item = item();
          dynamic = normalizeIncomingArray(normalized, Array.isArray(item) ? item : [item], Array.isArray(prev) ? prev : [prev]) || dynamic;
        } else {
          normalized.push(item);
          dynamic = true;
        }
      } else {
        const value = String(item);
        if (prev && prev.nodeType === 3 && prev.data === value) normalized.push(prev);
        else normalized.push(document.createTextNode(value));
      }
    }
    return dynamic;
  }
  function appendNodes(parent, array, marker = null) {
    for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
  }
  function cleanChildren(parent, current, marker, replacement) {
    if (marker === void 0) return parent.textContent = "";
    const node = replacement || document.createTextNode("");
    if (current.length) {
      let inserted = false;
      for (let i = current.length - 1; i >= 0; i--) {
        const el = current[i];
        if (node !== el) {
          const isParent = el.parentNode === parent;
          if (!inserted && !i) isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);
          else isParent && el.remove();
        } else inserted = true;
      }
    } else parent.insertBefore(node, marker);
    return [node];
  }
  const browser$1 = ((_b = (_a = globalThis.browser) == null ? void 0 : _a.runtime) == null ? void 0 : _b.id) ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
  }
  var isPotentialCustomElementName_1;
  var hasRequiredIsPotentialCustomElementName;
  function requireIsPotentialCustomElementName() {
    if (hasRequiredIsPotentialCustomElementName) return isPotentialCustomElementName_1;
    hasRequiredIsPotentialCustomElementName = 1;
    var regex = /^[a-z](?:[\.0-9_a-z\xB7\xC0-\xD6\xD8-\xF6\xF8-\u037D\u037F-\u1FFF\u200C\u200D\u203F\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]|[\uD800-\uDB7F][\uDC00-\uDFFF])*-(?:[\x2D\.0-9_a-z\xB7\xC0-\xD6\xD8-\xF6\xF8-\u037D\u037F-\u1FFF\u200C\u200D\u203F\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]|[\uD800-\uDB7F][\uDC00-\uDFFF])*$/;
    var isPotentialCustomElementName2 = function(string) {
      return regex.test(string);
    };
    isPotentialCustomElementName_1 = isPotentialCustomElementName2;
    return isPotentialCustomElementName_1;
  }
  var isPotentialCustomElementNameExports = requireIsPotentialCustomElementName();
  const isPotentialCustomElementName = /* @__PURE__ */ getDefaultExportFromCjs(isPotentialCustomElementNameExports);
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };
  function createIsolatedElement(options) {
    return __async(this, null, function* () {
      const { name, mode = "closed", css, isolateEvents = false } = options;
      if (!isPotentialCustomElementName(name)) {
        throw Error(
          `"${name}" is not a valid custom element name. It must be two words and kebab-case, with a few exceptions. See spec for more details: https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name`
        );
      }
      const parentElement = document.createElement(name);
      const shadow = parentElement.attachShadow({ mode });
      const isolatedElement = document.createElement("html");
      const body = document.createElement("body");
      const head = document.createElement("head");
      if (css) {
        const style2 = document.createElement("style");
        if ("url" in css) {
          style2.textContent = yield fetch(css.url).then((res) => res.text());
        } else {
          style2.textContent = css.textContent;
        }
        head.appendChild(style2);
      }
      isolatedElement.appendChild(head);
      isolatedElement.appendChild(body);
      shadow.appendChild(isolatedElement);
      if (isolateEvents) {
        const eventTypes = Array.isArray(isolateEvents) ? isolateEvents : ["keydown", "keyup", "keypress"];
        eventTypes.forEach((eventType) => {
          body.addEventListener(eventType, (e) => e.stopPropagation());
        });
      }
      return {
        parentElement,
        shadow,
        isolatedElement: body
      };
    });
  }
  const nullKey = Symbol("null");
  let keyCounter = 0;
  class ManyKeysMap extends Map {
    constructor() {
      super();
      this._objectHashes = /* @__PURE__ */ new WeakMap();
      this._symbolHashes = /* @__PURE__ */ new Map();
      this._publicKeys = /* @__PURE__ */ new Map();
      const [pairs] = arguments;
      if (pairs === null || pairs === void 0) {
        return;
      }
      if (typeof pairs[Symbol.iterator] !== "function") {
        throw new TypeError(typeof pairs + " is not iterable (cannot read property Symbol(Symbol.iterator))");
      }
      for (const [keys, value] of pairs) {
        this.set(keys, value);
      }
    }
    _getPublicKeys(keys, create = false) {
      if (!Array.isArray(keys)) {
        throw new TypeError("The keys parameter must be an array");
      }
      const privateKey = this._getPrivateKey(keys, create);
      let publicKey;
      if (privateKey && this._publicKeys.has(privateKey)) {
        publicKey = this._publicKeys.get(privateKey);
      } else if (create) {
        publicKey = [...keys];
        this._publicKeys.set(privateKey, publicKey);
      }
      return { privateKey, publicKey };
    }
    _getPrivateKey(keys, create = false) {
      const privateKeys = [];
      for (let key of keys) {
        if (key === null) {
          key = nullKey;
        }
        const hashes = typeof key === "object" || typeof key === "function" ? "_objectHashes" : typeof key === "symbol" ? "_symbolHashes" : false;
        if (!hashes) {
          privateKeys.push(key);
        } else if (this[hashes].has(key)) {
          privateKeys.push(this[hashes].get(key));
        } else if (create) {
          const privateKey = `@@mkm-ref-${keyCounter++}@@`;
          this[hashes].set(key, privateKey);
          privateKeys.push(privateKey);
        } else {
          return false;
        }
      }
      return JSON.stringify(privateKeys);
    }
    set(keys, value) {
      const { publicKey } = this._getPublicKeys(keys, true);
      return super.set(publicKey, value);
    }
    get(keys) {
      const { publicKey } = this._getPublicKeys(keys);
      return super.get(publicKey);
    }
    has(keys) {
      const { publicKey } = this._getPublicKeys(keys);
      return super.has(publicKey);
    }
    delete(keys) {
      const { publicKey, privateKey } = this._getPublicKeys(keys);
      return Boolean(publicKey && super.delete(publicKey) && this._publicKeys.delete(privateKey));
    }
    clear() {
      super.clear();
      this._symbolHashes.clear();
      this._publicKeys.clear();
    }
    get [Symbol.toStringTag]() {
      return "ManyKeysMap";
    }
    get size() {
      return super.size;
    }
  }
  function isPlainObject(value) {
    if (value === null || typeof value !== "object") {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) {
      return false;
    }
    if (Symbol.iterator in value) {
      return false;
    }
    if (Symbol.toStringTag in value) {
      return Object.prototype.toString.call(value) === "[object Module]";
    }
    return true;
  }
  function _defu(baseObject, defaults, namespace = ".", merger) {
    if (!isPlainObject(defaults)) {
      return _defu(baseObject, {}, namespace, merger);
    }
    const object = Object.assign({}, defaults);
    for (const key in baseObject) {
      if (key === "__proto__" || key === "constructor") {
        continue;
      }
      const value = baseObject[key];
      if (value === null || value === void 0) {
        continue;
      }
      if (merger && merger(object, key, value, namespace)) {
        continue;
      }
      if (Array.isArray(value) && Array.isArray(object[key])) {
        object[key] = [...value, ...object[key]];
      } else if (isPlainObject(value) && isPlainObject(object[key])) {
        object[key] = _defu(
          value,
          object[key],
          (namespace ? `${namespace}.` : "") + key.toString(),
          merger
        );
      } else {
        object[key] = value;
      }
    }
    return object;
  }
  function createDefu(merger) {
    return (...arguments_) => (
      // eslint-disable-next-line unicorn/no-array-reduce
      arguments_.reduce((p, c) => _defu(p, c, "", merger), {})
    );
  }
  const defu = createDefu();
  const isExist = (element) => {
    return element !== null ? { isDetected: true, result: element } : { isDetected: false };
  };
  const isNotExist = (element) => {
    return element === null ? { isDetected: true, result: null } : { isDetected: false };
  };
  const getDefaultOptions = () => ({
    target: globalThis.document,
    unifyProcess: true,
    detector: isExist,
    observeConfigs: {
      childList: true,
      subtree: true,
      attributes: true
    },
    signal: void 0,
    customMatcher: void 0
  });
  const mergeOptions = (userSideOptions, defaultOptions) => {
    return defu(userSideOptions, defaultOptions);
  };
  const unifyCache = new ManyKeysMap();
  function createWaitElement(instanceOptions) {
    const { defaultOptions } = instanceOptions;
    return (selector, options) => {
      const {
        target,
        unifyProcess,
        observeConfigs,
        detector,
        signal,
        customMatcher
      } = mergeOptions(options, defaultOptions);
      const unifyPromiseKey = [
        selector,
        target,
        unifyProcess,
        observeConfigs,
        detector,
        signal,
        customMatcher
      ];
      const cachedPromise = unifyCache.get(unifyPromiseKey);
      if (unifyProcess && cachedPromise) {
        return cachedPromise;
      }
      const detectPromise = new Promise(
        // biome-ignore lint/suspicious/noAsyncPromiseExecutor: avoid nesting promise
        async (resolve, reject) => {
          if (signal == null ? void 0 : signal.aborted) {
            return reject(signal.reason);
          }
          const observer = new MutationObserver(
            async (mutations) => {
              for (const _ of mutations) {
                if (signal == null ? void 0 : signal.aborted) {
                  observer.disconnect();
                  break;
                }
                const detectResult2 = await detectElement({
                  selector,
                  target,
                  detector,
                  customMatcher
                });
                if (detectResult2.isDetected) {
                  observer.disconnect();
                  resolve(detectResult2.result);
                  break;
                }
              }
            }
          );
          signal == null ? void 0 : signal.addEventListener(
            "abort",
            () => {
              observer.disconnect();
              return reject(signal.reason);
            },
            { once: true }
          );
          const detectResult = await detectElement({
            selector,
            target,
            detector,
            customMatcher
          });
          if (detectResult.isDetected) {
            return resolve(detectResult.result);
          }
          observer.observe(target, observeConfigs);
        }
      ).finally(() => {
        unifyCache.delete(unifyPromiseKey);
      });
      unifyCache.set(unifyPromiseKey, detectPromise);
      return detectPromise;
    };
  }
  async function detectElement({
    target,
    selector,
    detector,
    customMatcher
  }) {
    const element = customMatcher ? customMatcher(selector) : target.querySelector(selector);
    return await detector(element);
  }
  const waitElement = createWaitElement({
    defaultOptions: getDefaultOptions()
  });
  function print$1(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger$1 = {
    debug: (...args) => print$1(console.debug, ...args),
    log: (...args) => print$1(console.log, ...args),
    warn: (...args) => print$1(console.warn, ...args),
    error: (...args) => print$1(console.error, ...args)
  };
  function applyPosition(root, positionedElement, options) {
    var _a2, _b2;
    if (options.position === "inline") return;
    if (options.zIndex != null) root.style.zIndex = String(options.zIndex);
    root.style.overflow = "visible";
    root.style.position = "relative";
    root.style.width = "0";
    root.style.height = "0";
    root.style.display = "block";
    if (positionedElement) {
      if (options.position === "overlay") {
        positionedElement.style.position = "absolute";
        if ((_a2 = options.alignment) == null ? void 0 : _a2.startsWith("bottom-"))
          positionedElement.style.bottom = "0";
        else positionedElement.style.top = "0";
        if ((_b2 = options.alignment) == null ? void 0 : _b2.endsWith("-right"))
          positionedElement.style.right = "0";
        else positionedElement.style.left = "0";
      } else {
        positionedElement.style.position = "fixed";
        positionedElement.style.top = "0";
        positionedElement.style.bottom = "0";
        positionedElement.style.left = "0";
        positionedElement.style.right = "0";
      }
    }
  }
  function getAnchor(options) {
    if (options.anchor == null) return document.body;
    let resolved = typeof options.anchor === "function" ? options.anchor() : options.anchor;
    if (typeof resolved === "string") {
      if (resolved.startsWith("/")) {
        const result2 = document.evaluate(
          resolved,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        return result2.singleNodeValue ?? void 0;
      } else {
        return document.querySelector(resolved) ?? void 0;
      }
    }
    return resolved ?? void 0;
  }
  function mountUi(root, options) {
    var _a2, _b2;
    const anchor = getAnchor(options);
    if (anchor == null)
      throw Error(
        "Failed to mount content script UI: could not find anchor element"
      );
    switch (options.append) {
      case void 0:
      case "last":
        anchor.append(root);
        break;
      case "first":
        anchor.prepend(root);
        break;
      case "replace":
        anchor.replaceWith(root);
        break;
      case "after":
        (_a2 = anchor.parentElement) == null ? void 0 : _a2.insertBefore(root, anchor.nextElementSibling);
        break;
      case "before":
        (_b2 = anchor.parentElement) == null ? void 0 : _b2.insertBefore(root, anchor);
        break;
      default:
        options.append(anchor, root);
        break;
    }
  }
  function createMountFunctions(baseFunctions, options) {
    let autoMountInstance = void 0;
    const stopAutoMount = () => {
      autoMountInstance == null ? void 0 : autoMountInstance.stopAutoMount();
      autoMountInstance = void 0;
    };
    const mount = () => {
      baseFunctions.mount();
    };
    const unmount = baseFunctions.remove;
    const remove = () => {
      stopAutoMount();
      baseFunctions.remove();
    };
    const autoMount = (autoMountOptions) => {
      if (autoMountInstance) {
        logger$1.warn("autoMount is already set.");
      }
      autoMountInstance = autoMountUi(
        { mount, unmount, stopAutoMount },
        {
          ...options,
          ...autoMountOptions
        }
      );
    };
    return {
      mount,
      remove,
      autoMount
    };
  }
  function autoMountUi(uiCallbacks, options) {
    const abortController = new AbortController();
    const EXPLICIT_STOP_REASON = "explicit_stop_auto_mount";
    const _stopAutoMount = () => {
      var _a2;
      abortController.abort(EXPLICIT_STOP_REASON);
      (_a2 = options.onStop) == null ? void 0 : _a2.call(options);
    };
    let resolvedAnchor = typeof options.anchor === "function" ? options.anchor() : options.anchor;
    if (resolvedAnchor instanceof Element) {
      throw Error(
        "autoMount and Element anchor option cannot be combined. Avoid passing `Element` directly or `() => Element` to the anchor."
      );
    }
    async function observeElement(selector) {
      let isAnchorExist = !!getAnchor(options);
      if (isAnchorExist) {
        uiCallbacks.mount();
      }
      while (!abortController.signal.aborted) {
        try {
          const changedAnchor = await waitElement(selector ?? "body", {
            customMatcher: () => getAnchor(options) ?? null,
            detector: isAnchorExist ? isNotExist : isExist,
            signal: abortController.signal
          });
          isAnchorExist = !!changedAnchor;
          if (isAnchorExist) {
            uiCallbacks.mount();
          } else {
            uiCallbacks.unmount();
            if (options.once) {
              uiCallbacks.stopAutoMount();
            }
          }
        } catch (error) {
          if (abortController.signal.aborted && abortController.signal.reason === EXPLICIT_STOP_REASON) {
            break;
          } else {
            throw error;
          }
        }
      }
    }
    observeElement(resolvedAnchor);
    return { stopAutoMount: _stopAutoMount };
  }
  function splitShadowRootCss(css) {
    let shadowCss = css;
    let documentCss = "";
    const rulesRegex = /(\s*@(property|font-face)[\s\S]*?{[\s\S]*?})/gm;
    let match;
    while ((match = rulesRegex.exec(css)) !== null) {
      documentCss += match[1];
      shadowCss = shadowCss.replace(match[1], "");
    }
    return {
      documentCss: documentCss.trim(),
      shadowCss: shadowCss.trim()
    };
  }
  async function createShadowRootUi(ctx, options) {
    var _a2;
    const instanceId = Math.random().toString(36).substring(2, 15);
    const css = [];
    if (!options.inheritStyles) {
      css.push(`/* WXT Shadow Root Reset */ :host{all:initial !important;}`);
    }
    if (options.css) {
      css.push(options.css);
    }
    if (((_a2 = ctx.options) == null ? void 0 : _a2.cssInjectionMode) === "ui") {
      const entryCss = await loadCss();
      css.push(entryCss.replaceAll(":root", ":host"));
    }
    const { shadowCss, documentCss } = splitShadowRootCss(css.join("\n").trim());
    const {
      isolatedElement: uiContainer,
      parentElement: shadowHost,
      shadow
    } = await createIsolatedElement({
      name: options.name,
      css: {
        textContent: shadowCss
      },
      mode: options.mode ?? "open",
      isolateEvents: options.isolateEvents
    });
    shadowHost.setAttribute("data-wxt-shadow-root", "");
    let mounted;
    const mount = () => {
      mountUi(shadowHost, options);
      applyPosition(shadowHost, shadow.querySelector("html"), options);
      if (documentCss && !document.querySelector(
        `style[wxt-shadow-root-document-styles="${instanceId}"]`
      )) {
        const style2 = document.createElement("style");
        style2.textContent = documentCss;
        style2.setAttribute("wxt-shadow-root-document-styles", instanceId);
        (document.head ?? document.body).append(style2);
      }
      mounted = options.onMount(uiContainer, shadow, shadowHost);
    };
    const remove = () => {
      var _a3;
      (_a3 = options.onRemove) == null ? void 0 : _a3.call(options, mounted);
      shadowHost.remove();
      const documentStyle = document.querySelector(
        `style[wxt-shadow-root-document-styles="${instanceId}"]`
      );
      documentStyle == null ? void 0 : documentStyle.remove();
      while (uiContainer.lastChild)
        uiContainer.removeChild(uiContainer.lastChild);
      mounted = void 0;
    };
    const mountFunctions = createMountFunctions(
      {
        mount,
        remove
      },
      options
    );
    ctx.onInvalidated(remove);
    return {
      shadow,
      shadowHost,
      uiContainer,
      ...mountFunctions,
      get mounted() {
        return mounted;
      }
    };
  }
  async function loadCss() {
    const url = browser.runtime.getURL(`/content-scripts/${"content"}.css`);
    try {
      const res = await fetch(url);
      return await res.text();
    } catch (err) {
      logger$1.warn(
        `Failed to load styles @ ${url}. Did you forget to import the stylesheet in your entrypoint?`,
        err
      );
      return "";
    }
  }
  function defineContentScript(definition2) {
    return definition2;
  }
  function r(e) {
    var t, f, n = "";
    if ("string" == typeof e || "number" == typeof e) n += e;
    else if ("object" == typeof e) if (Array.isArray(e)) {
      var o = e.length;
      for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
    } else for (f in e) e[f] && (n && (n += " "), n += f);
    return n;
  }
  function clsx() {
    for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
    return n;
  }
  function cn(...inputs) {
    return clsx(inputs);
  }
  content;
  content;
  content;
  content;
  content;
  delegateEvents(["click"]);
  content;
  content;
  var _tmpl$$j = /* @__PURE__ */ template(`<div><div class="bg-surface rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px]"><div class="text-2xl font-mono font-bold text-purple-500"></div><div class="text-sm text-secondary mt-1">Score</div></div><div class="bg-surface rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px]"><div class="text-2xl font-mono font-bold text-pink-500"></div><div class="text-sm text-secondary mt-1">Rank`);
  const ScorePanel = (props) => {
    return (() => {
      var _el$ = _tmpl$$j(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$2.nextSibling, _el$5 = _el$4.firstChild;
      insert(_el$3, () => props.score !== null ? props.score : "—");
      insert(_el$5, () => props.rank !== null ? props.rank : "—");
      createRenderEffect(() => className(_el$, cn("grid grid-cols-[1fr_1fr] gap-2 p-4", props.class)));
      return _el$;
    })();
  };
  content;
  content;
  var _tmpl$$i = /* @__PURE__ */ template(`<svg class="animate-spin h-4 w-4"xmlns=http://www.w3.org/2000/svg fill=none viewBox="0 0 24 24"><circle class=opacity-25 cx=12 cy=12 r=10 stroke=currentColor stroke-width=4></circle><path class=opacity-75 fill=currentColor d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">`), _tmpl$2$a = /* @__PURE__ */ template(`<span>`), _tmpl$3$5 = /* @__PURE__ */ template(`<button>`);
  const Button = (props) => {
    const [local, others] = splitProps(props, ["variant", "size", "fullWidth", "loading", "leftIcon", "rightIcon", "children", "class", "disabled"]);
    const variant = () => local.variant || "primary";
    const size = () => local.size || "md";
    return (() => {
      var _el$ = _tmpl$3$5();
      spread(_el$, mergeProps({
        get disabled() {
          return local.disabled || local.loading;
        },
        get ["class"]() {
          return cn("inline-flex items-center justify-center font-medium transition-all cursor-pointer outline-none disabled:cursor-not-allowed disabled:opacity-50", {
            // Variants
            "bg-gradient-primary text-white hover:shadow-lg hover:brightness-110 glow-primary": variant() === "primary",
            "bg-surface text-primary border border-default hover:bg-elevated hover:border-strong": variant() === "secondary",
            "text-secondary hover:text-primary hover:bg-surface": variant() === "ghost",
            "bg-red-600 text-white hover:bg-red-700 hover:shadow-lg": variant() === "danger",
            // Sizes
            "h-8 px-3 text-sm rounded-md gap-1.5": size() === "sm",
            "h-10 px-4 text-base rounded-lg gap-2": size() === "md",
            "h-12 px-6 text-lg rounded-lg gap-2.5": size() === "lg",
            // Full width
            "w-full": local.fullWidth,
            // Loading state
            "cursor-wait": local.loading
          }, local.class);
        }
      }, others), false);
      insert(_el$, createComponent(Show, {
        get when() {
          return local.loading;
        },
        get children() {
          return _tmpl$$i();
        }
      }), null);
      insert(_el$, createComponent(Show, {
        get when() {
          return local.leftIcon && !local.loading;
        },
        get children() {
          return local.leftIcon;
        }
      }), null);
      insert(_el$, createComponent(Show, {
        get when() {
          return local.children;
        },
        get children() {
          var _el$3 = _tmpl$2$a();
          insert(_el$3, () => local.children);
          return _el$3;
        }
      }), null);
      insert(_el$, createComponent(Show, {
        get when() {
          return local.rightIcon;
        },
        get children() {
          return local.rightIcon;
        }
      }), null);
      return _el$;
    })();
  };
  content;
  content;
  delegateEvents(["click", "input"]);
  content;
  content;
  var _tmpl$$h = /* @__PURE__ */ template(`<div><div class=space-y-8>`), _tmpl$2$9 = /* @__PURE__ */ template(`<div>`);
  const LyricsDisplay = (props) => {
    const [currentLineIndex, setCurrentLineIndex] = createSignal(-1);
    let containerRef;
    const getLineScore = (lineIndex) => {
      var _a2, _b2;
      return ((_b2 = (_a2 = props.lineScores) == null ? void 0 : _a2.find((s) => s.lineIndex === lineIndex)) == null ? void 0 : _b2.score) || null;
    };
    const getScoreStyle = (score) => {
      if (score === null) return {};
      if (score >= 95) {
        return {
          color: "#ff3838"
        };
      } else if (score >= 90) {
        return {
          color: "#ff6b6b"
        };
      } else if (score >= 80) {
        return {
          color: "#ff8787"
        };
      } else if (score >= 70) {
        return {
          color: "#ffa8a8"
        };
      } else if (score >= 60) {
        return {
          color: "#ffcece"
        };
      } else {
        return {
          color: "#ffe0e0"
        };
      }
    };
    createEffect(() => {
      if (!props.currentTime || !props.lyrics.length) {
        setCurrentLineIndex(-1);
        return;
      }
      const time = props.currentTime / 1e3;
      const TIMING_OFFSET = 0.3;
      const adjustedTime = time + TIMING_OFFSET;
      let foundIndex = -1;
      for (let i = 0; i < props.lyrics.length; i++) {
        const line = props.lyrics[i];
        if (!line) continue;
        const endTime = line.startTime + line.duration / 1e3;
        if (adjustedTime >= line.startTime && adjustedTime < endTime) {
          foundIndex = i;
          break;
        }
      }
      if (foundIndex === -1 && time > 0) {
        for (let i = props.lyrics.length - 1; i >= 0; i--) {
          const line = props.lyrics[i];
          if (!line) continue;
          if (time >= line.startTime) {
            foundIndex = i;
            break;
          }
        }
      }
      if (foundIndex !== currentLineIndex()) {
        const prevIndex = currentLineIndex();
        if (Math.abs(foundIndex - prevIndex) > 5) {
          console.log("[LyricsDisplay] Current line changed:", {
            from: prevIndex,
            to: foundIndex,
            time: props.currentTime,
            timeInSeconds: time,
            jump: Math.abs(foundIndex - prevIndex)
          });
        }
        if (prevIndex !== -1 && Math.abs(foundIndex - prevIndex) > 10) {
          console.warn("[LyricsDisplay] Large line jump detected!", {
            from: prevIndex,
            to: foundIndex,
            fromLine: props.lyrics[prevIndex],
            toLine: props.lyrics[foundIndex]
          });
        }
        setCurrentLineIndex(foundIndex);
      }
    });
    createEffect(() => {
      const index2 = currentLineIndex();
      if (index2 === -1 || !containerRef || !props.isPlaying) return;
      const lineElements = containerRef.querySelectorAll("[data-line-index]");
      const currentElement = lineElements[index2];
      if (currentElement) {
        const containerHeight = containerRef.clientHeight;
        const lineTop = currentElement.offsetTop;
        const lineHeight = currentElement.offsetHeight;
        const targetScrollTop = lineTop - containerHeight / 2 + lineHeight / 2;
        containerRef.scrollTo({
          top: targetScrollTop,
          behavior: "smooth"
        });
      }
    });
    return (() => {
      var _el$ = _tmpl$$h(), _el$2 = _el$.firstChild;
      var _ref$ = containerRef;
      typeof _ref$ === "function" ? use(_ref$, _el$) : containerRef = _el$;
      insert(_el$2, createComponent(For, {
        get each() {
          return props.lyrics;
        },
        children: (line, index2) => {
          const lineScore = () => getLineScore(index2());
          const scoreStyle = () => getScoreStyle(lineScore());
          return (() => {
            var _el$3 = _tmpl$2$9();
            insert(_el$3, () => line.text);
            createRenderEffect((_p$) => {
              var _v$ = index2(), _v$2 = cn("text-center", "text-2xl leading-relaxed", index2() === currentLineIndex() ? "opacity-100" : "opacity-60"), _v$3 = index2() === currentLineIndex() && !lineScore() ? "#ffffff" : scoreStyle().color || "#ffffff";
              _v$ !== _p$.e && setAttribute(_el$3, "data-line-index", _p$.e = _v$);
              _v$2 !== _p$.t && className(_el$3, _p$.t = _v$2);
              _v$3 !== _p$.a && ((_p$.a = _v$3) != null ? _el$3.style.setProperty("color", _v$3) : _el$3.style.removeProperty("color"));
              return _p$;
            }, {
              e: void 0,
              t: void 0,
              a: void 0
            });
            return _el$3;
          })();
        }
      }));
      createRenderEffect(() => className(_el$, cn("lyrics-display overflow-y-auto scroll-smooth", "h-full px-6 py-12", props.class)));
      return _el$;
    })();
  };
  content;
  content;
  delegateEvents(["click"]);
  content;
  content;
  var _tmpl$$g = /* @__PURE__ */ template(`<div>`), _tmpl$2$8 = /* @__PURE__ */ template(`<div class="flex flex-col items-center justify-center py-12 px-6 text-center"><div class="text-6xl mb-4 opacity-30">🎤</div><p class="text-lg text-secondary mb-2">Nobody has completed this song yet!</p><p class="text-sm text-tertiary">Be the first to set a high score`), _tmpl$3$4 = /* @__PURE__ */ template(`<div><span>#</span><span></span><span>`);
  const LeaderboardPanel = (props) => {
    return (() => {
      var _el$ = _tmpl$$g();
      insert(_el$, createComponent(Show, {
        get when() {
          return props.entries.length > 0;
        },
        get fallback() {
          return _tmpl$2$8();
        },
        get children() {
          return createComponent(For, {
            get each() {
              return props.entries;
            },
            children: (entry) => (() => {
              var _el$3 = _tmpl$3$4(), _el$4 = _el$3.firstChild;
              _el$4.firstChild;
              var _el$6 = _el$4.nextSibling, _el$7 = _el$6.nextSibling;
              insert(_el$4, () => entry.rank, null);
              insert(_el$6, () => entry.username);
              insert(_el$7, () => entry.score.toLocaleString());
              createRenderEffect((_p$) => {
                var _v$ = cn("flex items-center gap-3 px-3 py-2 rounded-lg transition-colors", entry.isCurrentUser ? "bg-accent-primary/10 border border-accent-primary/20" : "bg-surface hover:bg-surface-hover"), _v$2 = cn("w-8 text-center font-mono font-bold", entry.rank <= 3 ? "text-accent-primary" : "text-secondary"), _v$3 = cn("flex-1 truncate", entry.isCurrentUser ? "text-accent-primary font-medium" : "text-primary"), _v$4 = cn("font-mono font-bold", entry.isCurrentUser ? "text-accent-primary" : "text-primary");
                _v$ !== _p$.e && className(_el$3, _p$.e = _v$);
                _v$2 !== _p$.t && className(_el$4, _p$.t = _v$2);
                _v$3 !== _p$.a && className(_el$6, _p$.a = _v$3);
                _v$4 !== _p$.o && className(_el$7, _p$.o = _v$4);
                return _p$;
              }, {
                e: void 0,
                t: void 0,
                a: void 0,
                o: void 0
              });
              return _el$3;
            })()
          });
        }
      }));
      createRenderEffect(() => className(_el$, cn("flex flex-col gap-2 p-4", props.class)));
      return _el$;
    })();
  };
  content;
  content;
  var _tmpl$$f = /* @__PURE__ */ template(`<div><button><span class="relative z-10">Start</span></button><div class="w-px bg-black/20"></div><button aria-label="Change playback speed"><span class="relative z-10">`);
  const speeds = ["1x", "0.75x", "0.5x"];
  const SplitButton = (props) => {
    const [currentSpeedIndex, setCurrentSpeedIndex] = createSignal(0);
    const currentSpeed = () => speeds[currentSpeedIndex()];
    const cycleSpeed = (e) => {
      var _a2;
      e.stopPropagation();
      const nextIndex = (currentSpeedIndex() + 1) % speeds.length;
      setCurrentSpeedIndex(nextIndex);
      const newSpeed = speeds[nextIndex];
      if (newSpeed) {
        (_a2 = props.onSpeedChange) == null ? void 0 : _a2.call(props, newSpeed);
      }
    };
    return (() => {
      var _el$ = _tmpl$$f(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling, _el$4 = _el$3.nextSibling, _el$5 = _el$4.firstChild;
      addEventListener$1(_el$2, "click", props.onStart, true);
      _el$4.$$click = cycleSpeed;
      insert(_el$5, currentSpeed);
      createRenderEffect((_p$) => {
        var _v$ = cn("relative inline-flex w-full rounded-lg overflow-hidden", "bg-gradient-primary text-white shadow-lg", "transition-all duration-300", props.class), _v$2 = props.disabled, _v$3 = cn("flex-1 inline-flex items-center justify-center relative overflow-hidden", "h-12 px-6 text-lg font-medium", "cursor-pointer border-none outline-none", "disabled:cursor-not-allowed disabled:opacity-50", "hover:bg-white/10 active:bg-white/20"), _v$4 = props.disabled, _v$5 = cn("inline-flex items-center justify-center relative", "w-20 text-lg font-medium", "cursor-pointer border-none outline-none", "disabled:cursor-not-allowed disabled:opacity-50", "hover:bg-white/10 active:bg-white/20", 'after:content-[""] after:absolute after:inset-0', "after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent", "after:translate-x-[-200%] hover:after:translate-x-[200%]", "after:transition-transform after:duration-700");
        _v$ !== _p$.e && className(_el$, _p$.e = _v$);
        _v$2 !== _p$.t && (_el$2.disabled = _p$.t = _v$2);
        _v$3 !== _p$.a && className(_el$2, _p$.a = _v$3);
        _v$4 !== _p$.o && (_el$4.disabled = _p$.o = _v$4);
        _v$5 !== _p$.i && className(_el$4, _p$.i = _v$5);
        return _p$;
      }, {
        e: void 0,
        t: void 0,
        a: void 0,
        o: void 0,
        i: void 0
      });
      return _el$;
    })();
  };
  delegateEvents(["click"]);
  content;
  content;
  var _tmpl$$e = /* @__PURE__ */ template(`<div>`), _tmpl$2$7 = /* @__PURE__ */ template(`<button>`);
  const TabsContext = createContext();
  const Tabs = (props) => {
    var _a2, _b2;
    const [activeTab, setActiveTab] = createSignal(props.defaultTab || ((_a2 = props.tabs[0]) == null ? void 0 : _a2.id) || "");
    console.log("[Tabs] Initializing with:", {
      defaultTab: props.defaultTab,
      firstTabId: (_b2 = props.tabs[0]) == null ? void 0 : _b2.id,
      activeTab: activeTab()
    });
    const handleTabChange = (id) => {
      var _a3;
      console.log("[Tabs] Tab changed to:", id);
      setActiveTab(id);
      (_a3 = props.onTabChange) == null ? void 0 : _a3.call(props, id);
    };
    const contextValue = {
      activeTab,
      setActiveTab: handleTabChange
    };
    return createComponent(TabsContext.Provider, {
      value: contextValue,
      get children() {
        var _el$ = _tmpl$$e();
        insert(_el$, () => props.children);
        createRenderEffect(() => className(_el$, cn("w-full", props.class)));
        return _el$;
      }
    });
  };
  const TabsList = (props) => {
    return (() => {
      var _el$2 = _tmpl$$e();
      insert(_el$2, () => props.children);
      createRenderEffect(() => className(_el$2, cn("inline-flex h-10 items-center justify-center rounded-md bg-surface p-1 text-secondary", "w-full", props.class)));
      return _el$2;
    })();
  };
  const TabsTrigger = (props) => {
    const context = useContext(TabsContext);
    if (!context) {
      console.error("[TabsTrigger] No TabsContext found. TabsTrigger must be used within Tabs component.");
      return null;
    }
    const isActive = () => context.activeTab() === props.value;
    return (() => {
      var _el$3 = _tmpl$2$7();
      _el$3.$$click = () => context.setActiveTab(props.value);
      insert(_el$3, () => props.children);
      createRenderEffect(() => className(_el$3, cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5", "text-sm font-medium ring-offset-base transition-all", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2", "disabled:pointer-events-none disabled:opacity-50", "flex-1", isActive() ? "bg-base text-primary shadow-sm" : "text-secondary hover:text-primary", props.class)));
      return _el$3;
    })();
  };
  const TabsContent = (props) => {
    const context = useContext(TabsContext);
    if (!context) {
      console.error("[TabsContent] No TabsContext found. TabsContent must be used within Tabs component.");
      return null;
    }
    const isActive = () => context.activeTab() === props.value;
    return createComponent(Show, {
      get when() {
        return isActive();
      },
      get children() {
        var _el$4 = _tmpl$$e();
        insert(_el$4, () => props.children);
        createRenderEffect(() => className(_el$4, cn("mt-2 ring-offset-base", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2", props.class)));
        return _el$4;
      }
    });
  };
  delegateEvents(["click"]);
  content;
  content;
  const fireContainer = "_fireContainer_1dsec_1";
  const fireEmoji = "_fireEmoji_1dsec_12";
  const styles = {
    fireContainer,
    fireEmoji
  };
  var _tmpl$$d = /* @__PURE__ */ template(`<div><div>🔥`);
  const FireEmojiAnimation = (props) => {
    const [showFire, setShowFire] = createSignal(false);
    const [fireX, setFireX] = createSignal(50);
    let lastLineIndex = -1;
    let hideTimer;
    createEffect(() => {
      if (props.lineIndex > lastLineIndex && props.score >= 80) {
        setFireX(20 + Math.random() * 60);
        setShowFire(true);
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          setShowFire(false);
        }, 2e3);
        lastLineIndex = props.lineIndex;
      }
    });
    onCleanup(() => {
      if (hideTimer) clearTimeout(hideTimer);
    });
    return createComponent(Show, {
      get when() {
        return showFire();
      },
      get children() {
        var _el$ = _tmpl$$d(), _el$2 = _el$.firstChild;
        _el$2.style.setProperty("font-size", "32px");
        createRenderEffect((_p$) => {
          var _v$ = cn(styles.fireContainer, props.class), _v$2 = styles.fireEmoji, _v$3 = `${fireX()}%`;
          _v$ !== _p$.e && className(_el$, _p$.e = _v$);
          _v$2 !== _p$.t && className(_el$2, _p$.t = _v$2);
          _v$3 !== _p$.a && ((_p$.a = _v$3) != null ? _el$2.style.setProperty("left", _v$3) : _el$2.style.removeProperty("left"));
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0
        });
        return _el$;
      }
    });
  };
  content;
  content;
  var _tmpl$$c = /* @__PURE__ */ template(`<div class=px-4>`), _tmpl$2$6 = /* @__PURE__ */ template(`<div class="p-4 bg-surface border-t border-subtle">`), _tmpl$3$3 = /* @__PURE__ */ template(`<div class="flex flex-col h-full"><div class="flex-1 min-h-0 overflow-hidden">`), _tmpl$4$3 = /* @__PURE__ */ template(`<div class="overflow-y-auto h-full">`), _tmpl$5$1 = /* @__PURE__ */ template(`<div>`), _tmpl$6$1 = /* @__PURE__ */ template(`<div class="flex-1 flex flex-col min-h-0"><div class="flex-1 min-h-0 overflow-hidden">`);
  const ExtensionKaraokeView = (props) => {
    const getLatestHighScoreLine = () => {
      const scores = props.lineScores || [];
      if (scores.length === 0) return {
        score: 0,
        lineIndex: -1
      };
      const latest = scores[scores.length - 1];
      return {
        score: (latest == null ? void 0 : latest.score) || 0,
        lineIndex: (latest == null ? void 0 : latest.lineIndex) || -1
      };
    };
    return (() => {
      var _el$ = _tmpl$5$1();
      insert(_el$, createComponent(Show, {
        get when() {
          return !props.isPlaying;
        },
        get children() {
          return createComponent(ScorePanel, {
            get score() {
              return props.score;
            },
            get rank() {
              return props.rank;
            }
          });
        }
      }), null);
      insert(_el$, createComponent(Show, {
        get when() {
          return !props.isPlaying;
        },
        get fallback() {
          return (() => {
            var _el$7 = _tmpl$6$1(), _el$8 = _el$7.firstChild;
            insert(_el$8, createComponent(LyricsDisplay, {
              get lyrics() {
                return props.lyrics;
              },
              get currentTime() {
                return props.currentTime;
              },
              get isPlaying() {
                return props.isPlaying;
              },
              get lineScores() {
                return props.lineScores;
              }
            }));
            return _el$7;
          })();
        },
        get children() {
          return createComponent(Tabs, {
            tabs: [{
              id: "lyrics",
              label: "Lyrics"
            }, {
              id: "leaderboard",
              label: "Leaderboard"
            }],
            defaultTab: "lyrics",
            "class": "flex-1 flex flex-col min-h-0",
            get children() {
              return [(() => {
                var _el$2 = _tmpl$$c();
                insert(_el$2, createComponent(TabsList, {
                  get children() {
                    return [createComponent(TabsTrigger, {
                      value: "lyrics",
                      children: "Lyrics"
                    }), createComponent(TabsTrigger, {
                      value: "leaderboard",
                      children: "Leaderboard"
                    })];
                  }
                }));
                return _el$2;
              })(), createComponent(TabsContent, {
                value: "lyrics",
                "class": "flex-1 min-h-0",
                get children() {
                  var _el$3 = _tmpl$3$3(), _el$4 = _el$3.firstChild;
                  insert(_el$4, createComponent(LyricsDisplay, {
                    get lyrics() {
                      return props.lyrics;
                    },
                    get currentTime() {
                      return props.currentTime;
                    },
                    get isPlaying() {
                      return props.isPlaying;
                    },
                    get lineScores() {
                      return props.lineScores;
                    }
                  }));
                  insert(_el$3, createComponent(Show, {
                    get when() {
                      return !props.isPlaying && props.onStart;
                    },
                    get children() {
                      var _el$5 = _tmpl$2$6();
                      _el$5.style.setProperty("flex-shrink", "0");
                      insert(_el$5, createComponent(SplitButton, {
                        get onStart() {
                          return props.onStart;
                        },
                        get onSpeedChange() {
                          return props.onSpeedChange;
                        }
                      }));
                      return _el$5;
                    }
                  }), null);
                  return _el$3;
                }
              }), createComponent(TabsContent, {
                value: "leaderboard",
                "class": "flex-1 overflow-hidden",
                get children() {
                  var _el$6 = _tmpl$4$3();
                  insert(_el$6, createComponent(LeaderboardPanel, {
                    get entries() {
                      return props.leaderboard;
                    }
                  }));
                  return _el$6;
                }
              })];
            }
          });
        }
      }), null);
      insert(_el$, createComponent(Show, {
        get when() {
          return props.isPlaying;
        },
        get children() {
          return createComponent(FireEmojiAnimation, {
            get score() {
              return getLatestHighScoreLine().score;
            },
            get lineIndex() {
              return getLatestHighScoreLine().lineIndex;
            }
          });
        }
      }), null);
      createRenderEffect(() => className(_el$, cn("flex flex-col h-full bg-base relative", props.class)));
      return _el$;
    })();
  };
  content;
  content;
  content;
  content;
  const __variableDynamicImportRuntimeHelper = (glob, path, segs) => {
    const v = glob[path];
    if (v) {
      return typeof v === "function" ? v() : Promise.resolve(v);
    }
    return new Promise((_, reject) => {
      (typeof queueMicrotask === "function" ? queueMicrotask : setTimeout)(
        reject.bind(
          null,
          new Error(
            "Unknown variable dynamic import: " + path + (path.split("/").length !== segs ? ". Note that variables only represent file names one level deep." : "")
          )
        )
      );
    });
  };
  const I18nContext = createContext();
  const I18nProvider = (props) => {
    const [locale, setLocale] = createSignal(props.defaultLocale || "en");
    const [translations2, setTranslations] = createSignal();
    createEffect(async () => {
      const currentLocale = locale();
      try {
        const module = await __variableDynamicImportRuntimeHelper(/* @__PURE__ */ Object.assign({ "./locales/en/index.ts": () => Promise.resolve().then(() => index$1), "./locales/zh-CN/index.ts": () => Promise.resolve().then(() => index) }), `./locales/${currentLocale}/index.ts`, 4);
        setTranslations(module.default);
      } catch (_e) {
        console.warn(`Failed to load locale ${currentLocale}, falling back to English`);
        const module = await Promise.resolve().then(() => index$1);
        setTranslations(module.default);
      }
    });
    const t = (key, params) => {
      const keys = key.split(".");
      let value2 = translations2();
      for (const k of keys) {
        value2 = value2 == null ? void 0 : value2[k];
      }
      if (typeof value2 === "string" && params) {
        return value2.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] || ""));
      }
      return value2 || key;
    };
    const dir = () => "ltr";
    const numberFormatter = createMemo(() => new Intl.NumberFormat(locale()));
    const formatNumber = (num) => numberFormatter().format(num);
    const formatDate = (date, options) => {
      return new Intl.DateTimeFormat(locale(), options).format(date);
    };
    const value = {
      locale,
      setLocale,
      t,
      dir,
      formatNumber,
      formatDate
    };
    return createComponent(I18nContext.Provider, {
      value,
      get children() {
        return props.children;
      }
    });
  };
  const useI18n = () => {
    const context = useContext(I18nContext);
    if (!context) {
      throw new Error("useI18n must be used within I18nProvider");
    }
    return context;
  };
  content;
  content;
  var _tmpl$$b = /* @__PURE__ */ template(`<div class="p-4 bg-surface border-t border-subtle">`), _tmpl$2$5 = /* @__PURE__ */ template(`<div><div class="flex-1 flex flex-col items-center justify-center p-6"><div class="text-center flex flex-col mb-10"><div class="text-lg text-secondary mb-3 order-1"></div><div class="text-7xl font-mono font-bold text-accent-primary order-2"></div></div><div class="flex gap-12 mb-12"><div class="text-center flex flex-col"><div class="text-lg text-secondary mb-2 order-1">Rank</div><div class="text-3xl font-bold text-primary order-2">#</div></div><div class="text-center flex flex-col"><div class="text-lg text-secondary mb-2 order-1"></div><div class="text-3xl font-bold text-primary order-2"></div></div></div><div class="max-w-md text-center"><p class="text-xl text-primary leading-relaxed">`);
  const CompletionView = (props) => {
    const {
      t,
      formatNumber
    } = useI18n();
    const getFeedbackText = createMemo(() => {
      if (props.feedbackText) return props.feedbackText;
      if (props.score >= 95) return t("karaoke.scoring.perfect");
      if (props.score >= 85) return t("karaoke.scoring.excellent");
      if (props.score >= 70) return t("karaoke.scoring.great");
      if (props.score >= 50) return t("karaoke.scoring.good");
      return t("karaoke.scoring.keepPracticing");
    });
    return (() => {
      var _el$ = _tmpl$2$5(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling, _el$6 = _el$3.nextSibling, _el$7 = _el$6.firstChild, _el$8 = _el$7.firstChild, _el$9 = _el$8.nextSibling;
      _el$9.firstChild;
      var _el$1 = _el$7.nextSibling, _el$10 = _el$1.firstChild, _el$11 = _el$10.nextSibling, _el$12 = _el$6.nextSibling, _el$13 = _el$12.firstChild;
      insert(_el$4, () => t("karaoke.scoring.score"));
      insert(_el$5, () => formatNumber(props.score));
      insert(_el$9, () => formatNumber(props.rank), null);
      insert(_el$10, () => t("common.speed.label"));
      insert(_el$11, () => props.speed);
      insert(_el$13, getFeedbackText);
      insert(_el$, createComponent(Show, {
        get when() {
          return props.onPractice;
        },
        get children() {
          var _el$14 = _tmpl$$b();
          insert(_el$14, createComponent(Button, {
            variant: "primary",
            size: "lg",
            fullWidth: true,
            get onClick() {
              return props.onPractice;
            },
            children: "Practice Errors"
          }));
          return _el$14;
        }
      }), null);
      createRenderEffect(() => className(_el$, cn("flex flex-col h-full bg-base", props.class)));
      return _el$;
    })();
  };
  content;
  content;
  function createKaraokeAudioProcessor(options) {
    const [audioContext, setAudioContext] = createSignal(null);
    const [mediaStream, setMediaStream] = createSignal(null);
    const [, setAudioWorkletNode] = createSignal(null);
    const [isReady, setIsReady] = createSignal(false);
    const [error, setError] = createSignal(null);
    const [isListening, setIsListening] = createSignal(false);
    const [currentRecordingLine, setCurrentRecordingLine] = createSignal(null);
    const [recordedAudioBuffer, setRecordedAudioBuffer] = createSignal([]);
    const [isSessionActive, setIsSessionActive] = createSignal(false);
    const [fullSessionBuffer, setFullSessionBuffer] = createSignal([]);
    const sampleRate = options == null ? void 0 : options.sampleRate;
    const initialize = async () => {
      if (audioContext()) return;
      setError(null);
      try {
        const ctx = new AudioContext({ sampleRate });
        setAudioContext(ctx);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
        setMediaStream(stream);
        await ctx.audioWorklet.addModule(createAudioWorkletProcessor());
        const workletNode = new AudioWorkletNode(ctx, "karaoke-audio-processor", {
          numberOfInputs: 1,
          numberOfOutputs: 0,
          channelCount: 1
        });
        workletNode.port.onmessage = (event) => {
          if (event.data.type === "audioData") {
            const audioData = new Float32Array(event.data.audioData);
            if (currentRecordingLine() !== null) {
              setRecordedAudioBuffer((prev) => [...prev, audioData]);
            }
            if (isSessionActive()) {
              setFullSessionBuffer((prev) => [...prev, audioData]);
            }
          }
        };
        setAudioWorkletNode(workletNode);
        const source = ctx.createMediaStreamSource(stream);
        const gainNode = ctx.createGain();
        gainNode.gain.value = 1.2;
        source.connect(gainNode);
        gainNode.connect(workletNode);
        setIsReady(true);
      } catch (e) {
        console.error("[KaraokeAudioProcessor] Failed to initialize:", e);
        setError(e instanceof Error ? e : new Error("Unknown audio initialization error"));
        setIsReady(false);
      }
    };
    const createAudioWorkletProcessor = () => {
      const processorCode = `
      class KaraokeAudioProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.bufferSize = 1024;
          this.rmsHistory = [];
          this.maxHistoryLength = 10;
        }

        process(inputs, outputs, parameters) {
          const input = inputs[0];
          if (input && input[0]) {
            const inputData = input[0];
            
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
              sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);
            
            this.rmsHistory.push(rms);
            if (this.rmsHistory.length > this.maxHistoryLength) {
              this.rmsHistory.shift();
            }
            
            const avgRms = this.rmsHistory.reduce((a, b) => a + b, 0) / this.rmsHistory.length;
            
            this.port.postMessage({
              type: 'audioData',
              audioData: inputData,
              rmsLevel: rms,
              avgRmsLevel: avgRms,
              isTooQuiet: avgRms < 0.01,
              isTooLoud: avgRms > 0.3
            });
          }
          return true;
        }
      }
      registerProcessor('karaoke-audio-processor', KaraokeAudioProcessor);
    `;
      const blob = new Blob([processorCode], { type: "application/javascript" });
      return URL.createObjectURL(blob);
    };
    const startListening = () => {
      const ctx = audioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume();
      }
      setIsListening(true);
    };
    const pauseListening = () => {
      const ctx = audioContext();
      if (ctx && ctx.state === "running") {
        ctx.suspend();
      }
      setIsListening(false);
    };
    const cleanup = () => {
      const stream = mediaStream();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setMediaStream(null);
      }
      const ctx = audioContext();
      if (ctx && ctx.state !== "closed") {
        ctx.close();
        setAudioContext(null);
      }
      setAudioWorkletNode(null);
      setIsReady(false);
      setIsListening(false);
    };
    onCleanup(cleanup);
    const startRecordingLine = (lineIndex) => {
      setCurrentRecordingLine(lineIndex);
      setRecordedAudioBuffer([]);
      if (isReady() && !isListening()) {
        startListening();
      }
    };
    const stopRecordingLineAndGetRawAudio = () => {
      const lineIndex = currentRecordingLine();
      if (lineIndex === null) {
        return [];
      }
      const audioBuffer = recordedAudioBuffer();
      setCurrentRecordingLine(null);
      const result2 = [...audioBuffer];
      setRecordedAudioBuffer([]);
      if (result2.length === 0) ;
      return result2;
    };
    const convertAudioToWavBlob = (audioChunks) => {
      if (audioChunks.length === 0) return null;
      const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const concatenated = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of audioChunks) {
        concatenated.set(chunk, offset);
        offset += chunk.length;
      }
      return audioBufferToWav(concatenated, sampleRate);
    };
    const audioBufferToWav = (buffer, sampleRate2) => {
      const length = buffer.length;
      const arrayBuffer = new ArrayBuffer(44 + length * 2);
      const view = new DataView(arrayBuffer);
      const writeString = (offset2, string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset2 + i, string.charCodeAt(i));
        }
      };
      writeString(0, "RIFF");
      view.setUint32(4, 36 + length * 2, true);
      writeString(8, "WAVE");
      writeString(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate2, true);
      view.setUint32(28, sampleRate2 * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeString(36, "data");
      view.setUint32(40, length * 2, true);
      const offset = 44;
      for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, buffer[i] || 0));
        view.setInt16(offset + i * 2, sample * 32767, true);
      }
      return new Blob([arrayBuffer], { type: "audio/wav" });
    };
    const startFullSession = () => {
      setFullSessionBuffer([]);
      setIsSessionActive(true);
    };
    const stopFullSessionAndGetWav = () => {
      setIsSessionActive(false);
      const sessionChunks = fullSessionBuffer();
      const wavBlob = convertAudioToWavBlob(sessionChunks);
      setFullSessionBuffer([]);
      return wavBlob;
    };
    return {
      isReady,
      error,
      isListening,
      isSessionActive,
      initialize,
      startListening,
      pauseListening,
      cleanup,
      startRecordingLine,
      stopRecordingLineAndGetRawAudio,
      convertAudioToWavBlob,
      startFullSession,
      stopFullSessionAndGetWav
    };
  }
  content;
  content;
  let KaraokeApiService$1 = class KaraokeApiService {
    constructor(serverUrl = "http://localhost:8787") {
      this.serverUrl = serverUrl;
    }
    async fetchKaraokeData(trackId, title, artist) {
      try {
        const url = new URL(`${this.serverUrl}/api/karaoke/${trackId}`);
        if (title) url.searchParams.set("title", title);
        if (artist) url.searchParams.set("artist", artist);
        const response = await fetch(url.toString());
        if (response.ok) {
          return await response.json();
        }
        return null;
      } catch (error) {
        console.error("[KaraokeApi] Failed to fetch karaoke data:", error);
        return null;
      }
    }
    async startSession(trackId, songData, authToken, songCatalogId, playbackSpeed) {
      try {
        const headers = {
          "Content-Type": "application/json"
        };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }
        const response = await fetch(`${this.serverUrl}/karaoke/start`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            trackId,
            songData,
            songCatalogId,
            playbackSpeed
          })
        });
        if (response.ok) {
          const data = await response.json();
          return data.session;
        }
        console.error("[KaraokeApi] Failed to start session:", response.status, await response.text());
        return null;
      } catch (error) {
        console.error("[KaraokeApi] Failed to start session:", error);
        return null;
      }
    }
    async gradeRecording(sessionId, lineIndex, audioBuffer, expectedText, startTime, endTime, authToken, playbackSpeed) {
      try {
        const headers = {
          "Content-Type": "application/json"
        };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }
        const response = await fetch(`${this.serverUrl}/karaoke/grade`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            sessionId,
            lineIndex,
            audioBuffer,
            expectedText,
            startTime,
            endTime,
            playbackSpeed
          })
        });
        if (response.ok) {
          const result2 = await response.json();
          return {
            score: Math.round(result2.score),
            feedback: result2.feedback,
            transcript: result2.transcription,
            wordScores: result2.wordScores
          };
        }
        return null;
      } catch (error) {
        console.error("[KaraokeApi] Failed to grade recording:", error);
        return null;
      }
    }
    async completeSession(sessionId, fullAudioBuffer, authToken) {
      try {
        const headers = {
          "Content-Type": "application/json"
        };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }
        const response = await fetch(`${this.serverUrl}/karaoke/complete`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            sessionId,
            fullAudioBuffer
          })
        });
        if (response.ok) {
          const result2 = await response.json();
          return {
            success: result2.success,
            finalScore: result2.finalScore,
            totalLines: result2.totalLines,
            perfectLines: result2.perfectLines,
            goodLines: result2.goodLines,
            needsWorkLines: result2.needsWorkLines,
            accuracy: result2.accuracy,
            sessionId: result2.sessionId
          };
        }
        return null;
      } catch (error) {
        console.error("[KaraokeApi] Failed to complete session:", error);
        return null;
      }
    }
    async getUserBestScore(songId, authToken) {
      try {
        const response = await fetch(
          `${this.serverUrl}/users/me/songs/${songId}/best-score`,
          {
            headers: {
              "Authorization": `Bearer ${authToken}`,
              "Content-Type": "application/json"
            }
          }
        );
        if (response.ok) {
          const data = await response.json();
          return data.bestScore || null;
        }
        if (response.status === 404) {
          return null;
        }
        throw new Error("Failed to fetch best score");
      } catch (error) {
        console.error("[KaraokeApi] Failed to fetch user best score:", error);
        return null;
      }
    }
    async getSongLeaderboard(songId, limit = 10) {
      try {
        const response = await fetch(
          `${this.serverUrl}/songs/${songId}/leaderboard?limit=${limit}`
        );
        if (response.ok) {
          const data = await response.json();
          return data.entries || [];
        }
        return [];
      } catch (error) {
        console.error("[KaraokeApi] Failed to fetch leaderboard:", error);
        return [];
      }
    }
  };
  content;
  function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
  }
  function shouldChunkLines(lines, startIndex) {
    const line = lines[startIndex];
    if (!line) {
      return {
        startIndex,
        endIndex: startIndex,
        expectedText: "",
        wordCount: 0
      };
    }
    const wordCount = countWords(line.text || "");
    return {
      startIndex,
      endIndex: startIndex,
      // Single line, so start and end are the same
      expectedText: line.text || "",
      wordCount
    };
  }
  function calculateRecordingDuration(lines, chunkInfo) {
    var _a2;
    const { startIndex, endIndex } = chunkInfo;
    const line = lines[startIndex];
    if (!line) return 3e3;
    if (endIndex > startIndex) {
      if (endIndex + 1 < lines.length) {
        const nextLine = lines[endIndex + 1];
        if (nextLine) {
          return (nextLine.startTime - line.startTime) * 1e3;
        }
      }
      let duration = 0;
      for (let i = startIndex; i <= endIndex; i++) {
        duration += ((_a2 = lines[i]) == null ? void 0 : _a2.duration) || 3e3;
      }
      return Math.min(duration, 8e3);
    } else {
      if (startIndex + 1 < lines.length) {
        const nextLine = lines[startIndex + 1];
        if (nextLine) {
          const calculatedDuration = (nextLine.startTime - line.startTime) * 1e3;
          return Math.min(Math.max(calculatedDuration, 1e3), 5e3);
        }
      }
      return Math.min(line.duration || 3e3, 5e3);
    }
  }
  content;
  content;
  content;
  content;
  content;
  content;
  content;
  content;
  content;
  var _tmpl$$a = /* @__PURE__ */ template(`<div><div class="h-full bg-accent transition-all duration-300 ease-out rounded-r-sm">`);
  const ProgressBar = (props) => {
    const percentage = () => Math.min(100, Math.max(0, props.current / props.total * 100));
    return (() => {
      var _el$ = _tmpl$$a(), _el$2 = _el$.firstChild;
      createRenderEffect((_p$) => {
        var _v$ = cn("w-full h-1.5 bg-highlight", props.class), _v$2 = `${percentage()}%`;
        _v$ !== _p$.e && className(_el$, _p$.e = _v$);
        _v$2 !== _p$.t && ((_p$.t = _v$2) != null ? _el$2.style.setProperty("width", _v$2) : _el$2.style.removeProperty("width"));
        return _p$;
      }, {
        e: void 0,
        t: void 0
      });
      return _el$;
    })();
  };
  content;
  content;
  content;
  content;
  content;
  content;
  content;
  content;
  content;
  content;
  var _tmpl$$9 = /* @__PURE__ */ template(`<button aria-label="Open Karaoke"><span>🎤`);
  const MinimizedKaraoke = (props) => {
    return (() => {
      var _el$ = _tmpl$$9(), _el$2 = _el$.firstChild;
      _el$.addEventListener("mouseleave", (e) => {
        e.currentTarget.style.transform = "scale(1)";
      });
      _el$.addEventListener("mouseenter", (e) => {
        e.currentTarget.style.transform = "scale(1.1)";
      });
      addEventListener$1(_el$, "click", props.onClick, true);
      _el$.style.setProperty("position", "fixed");
      _el$.style.setProperty("bottom", "24px");
      _el$.style.setProperty("right", "24px");
      _el$.style.setProperty("width", "80px");
      _el$.style.setProperty("height", "80px");
      _el$.style.setProperty("border-radius", "50%");
      _el$.style.setProperty("background", "linear-gradient(135deg, #FF006E 0%, #C13584 100%)");
      _el$.style.setProperty("box-shadow", "0 8px 32px rgba(0, 0, 0, 0.3)");
      _el$.style.setProperty("display", "flex");
      _el$.style.setProperty("align-items", "center");
      _el$.style.setProperty("justify-content", "center");
      _el$.style.setProperty("overflow", "hidden");
      _el$.style.setProperty("cursor", "pointer");
      _el$.style.setProperty("z-index", "99999");
      _el$.style.setProperty("border", "none");
      _el$.style.setProperty("transition", "transform 0.2s ease");
      _el$2.style.setProperty("font-size", "36px");
      return _el$;
    })();
  };
  delegateEvents(["click"]);
  content;
  content;
  var _tmpl$$8 = /* @__PURE__ */ template(`<header><h1 class="text-lg font-semibold text-primary">`);
  const PracticeHeader = (props) => {
    return createComponent(Show, {
      get when() {
        return props.title;
      },
      get children() {
        var _el$ = _tmpl$$8(), _el$2 = _el$.firstChild;
        insert(_el$2, () => props.title);
        createRenderEffect(() => className(_el$, cn("flex items-center justify-center h-14 px-4 bg-transparent", props.class)));
        return _el$;
      }
    });
  };
  content;
  content;
  var _tmpl$$7 = /* @__PURE__ */ template(`<footer><div class="max-w-2xl mx-auto">`);
  const ExerciseFooter = (props) => {
    return (() => {
      var _el$ = _tmpl$$7(), _el$2 = _el$.firstChild;
      insert(_el$2, createComponent(Show, {
        get when() {
          return !props.isRecording;
        },
        get fallback() {
          return createComponent(Button, {
            variant: "primary",
            size: "lg",
            fullWidth: true,
            get onClick() {
              return props.onStop;
            },
            get disabled() {
              return props.isProcessing;
            },
            children: "Stop"
          });
        },
        get children() {
          return createComponent(Show, {
            get when() {
              return props.canSubmit;
            },
            get fallback() {
              return createComponent(Button, {
                variant: "primary",
                size: "lg",
                fullWidth: true,
                get onClick() {
                  return props.onRecord;
                },
                get disabled() {
                  return props.isProcessing;
                },
                children: "Record"
              });
            },
            get children() {
              return createComponent(Button, {
                variant: "primary",
                size: "lg",
                fullWidth: true,
                get onClick() {
                  return props.onSubmit;
                },
                get disabled() {
                  return props.isProcessing;
                },
                get children() {
                  return props.isProcessing ? "Processing..." : "Submit";
                }
              });
            }
          });
        }
      }));
      createRenderEffect(() => className(_el$, cn("border-t border-gray-700 bg-surface p-6", props.class)));
      return _el$;
    })();
  };
  content;
  content;
  var _tmpl$$6 = /* @__PURE__ */ template(`<svg data-phosphor-icon=check-circle aria-hidden=true width=1em height=1em pointer-events=none display=inline-block xmlns=http://www.w3.org/2000/svg fill=currentColor viewBox="0 0 256 256"><path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m45.66 85.66-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 11.32">`);
  const IconCheckCircleFill = (p) => (() => {
    var _el$ = _tmpl$$6();
    createRenderEffect(() => setAttribute(_el$, "class", p.class));
    return _el$;
  })();
  content;
  var _tmpl$$5 = /* @__PURE__ */ template(`<svg data-phosphor-icon=x-circle aria-hidden=true width=1em height=1em pointer-events=none display=inline-block xmlns=http://www.w3.org/2000/svg fill=currentColor viewBox="0 0 256 256"><path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m37.66 130.34a8 8 0 0 1-11.32 11.32L128 139.31l-26.34 26.35a8 8 0 0 1-11.32-11.32L116.69 128l-26.35-26.34a8 8 0 0 1 11.32-11.32L128 116.69l26.34-26.35a8 8 0 0 1 11.32 11.32L139.31 128Z">`);
  const IconXCircleFill = (p) => (() => {
    var _el$ = _tmpl$$5();
    createRenderEffect(() => setAttribute(_el$, "class", p.class));
    return _el$;
  })();
  content;
  var _tmpl$$4 = /* @__PURE__ */ template(`<div class="border-t border-gray-700 bg-surface p-6"><div class="max-w-2xl mx-auto">`), _tmpl$2$4 = /* @__PURE__ */ template(`<p class="text-base text-secondary mt-1">`), _tmpl$3$2 = /* @__PURE__ */ template(`<div class="flex items-center gap-4"><div><p class="text-2xl font-bold">`), _tmpl$4$2 = /* @__PURE__ */ template(`<div class="flex items-center justify-between gap-6">`);
  const ResponseFooter = (props) => {
    return (() => {
      var _el$ = _tmpl$$4(), _el$2 = _el$.firstChild;
      insert(_el$2, createComponent(Show, {
        get when() {
          return props.mode === "check";
        },
        get fallback() {
          return (() => {
            var _el$3 = _tmpl$4$2();
            insert(_el$3, createComponent(Show, {
              get when() {
                return props.isCorrect !== void 0;
              },
              get children() {
                var _el$4 = _tmpl$3$2(), _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild;
                insert(_el$4, createComponent(Show, {
                  get when() {
                    return props.isCorrect;
                  },
                  get fallback() {
                    return createComponent(IconXCircleFill, {
                      style: "color: #ef4444;",
                      "class": "w-16 h-16 flex-shrink-0"
                    });
                  },
                  get children() {
                    return createComponent(IconCheckCircleFill, {
                      style: "color: #22c55e;",
                      "class": "w-16 h-16 flex-shrink-0"
                    });
                  }
                }), _el$5);
                insert(_el$6, () => props.isCorrect ? "Correct!" : "Incorrect");
                insert(_el$5, createComponent(Show, {
                  get when() {
                    return props.feedbackText && !props.isCorrect;
                  },
                  get children() {
                    var _el$7 = _tmpl$2$4();
                    insert(_el$7, () => props.feedbackText);
                    return _el$7;
                  }
                }), null);
                createRenderEffect((_$p) => style(_el$6, `color: ${props.isCorrect ? "#22c55e" : "#ef4444"};`, _$p));
                return _el$4;
              }
            }), null);
            insert(_el$3, createComponent(Button, {
              variant: "primary",
              size: "lg",
              get onClick() {
                return props.onContinue;
              },
              "class": "min-w-[180px]",
              get children() {
                return props.continueLabel || "Next";
              }
            }), null);
            return _el$3;
          })();
        },
        get children() {
          return createComponent(Button, {
            variant: "primary",
            size: "lg",
            fullWidth: true,
            get onClick() {
              return props.onCheck;
            },
            children: "Check"
          });
        }
      }));
      return _el$;
    })();
  };
  content;
  content;
  var _tmpl$$3 = /* @__PURE__ */ template(`<div><div class="flex-grow overflow-y-auto flex flex-col pb-24"><div class="w-full max-w-2xl mx-auto px-4 py-8">`), _tmpl$2$3 = /* @__PURE__ */ template(`<p class="text-lg text-muted-foreground mb-4 text-left">`);
  const ExerciseTemplate = (props) => {
    return (() => {
      var _el$ = _tmpl$$3(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild;
      insert(_el$3, (() => {
        var _c$ = memo(() => !!props.instructionText);
        return () => _c$() && (() => {
          var _el$4 = _tmpl$2$3();
          insert(_el$4, () => props.instructionText);
          return _el$4;
        })();
      })(), null);
      insert(_el$3, () => props.children, null);
      createRenderEffect(() => className(_el$, cn("flex flex-col h-full bg-base text-primary", props.class)));
      return _el$;
    })();
  };
  content;
  content;
  var _tmpl$$2 = /* @__PURE__ */ template(`<div class=mt-8><p class="text-lg text-muted-foreground mb-4">You said:</p><p class="text-2xl text-left leading-relaxed">`), _tmpl$2$2 = /* @__PURE__ */ template(`<div><p class="text-2xl text-left leading-relaxed">`);
  const ReadAloud = (props) => {
    return (() => {
      var _el$ = _tmpl$2$2(), _el$2 = _el$.firstChild;
      insert(_el$2, () => props.prompt);
      insert(_el$, createComponent(Show, {
        get when() {
          return props.userTranscript;
        },
        get children() {
          var _el$3 = _tmpl$$2(), _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling;
          insert(_el$5, () => props.userTranscript);
          return _el$3;
        }
      }), null);
      createRenderEffect(() => className(_el$, cn("space-y-4", props.class)));
      return _el$;
    })();
  };
  content;
  content;
  content;
  content;
  content;
  content;
  var _tmpl$$1 = /* @__PURE__ */ template(`<div class="h-full bg-base flex flex-col">`), _tmpl$2$1 = /* @__PURE__ */ template(`<div class="flex-1 flex items-center justify-center"><div class=text-center><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div><p class=text-muted-foreground>Loading exercises...`), _tmpl$3$1 = /* @__PURE__ */ template(`<div class="flex-1 flex items-center justify-center p-8"><div class="text-center max-w-md"><p class="text-lg text-muted-foreground mb-4">No practice exercises available yet.</p><p class="text-sm text-muted-foreground">Complete karaoke sessions with errors to generate personalized exercises!`), _tmpl$4$1 = /* @__PURE__ */ template(`<main class=flex-1>`);
  const PracticeExerciseView = (props) => {
    const [currentExerciseIndex, setCurrentExerciseIndex] = createSignal(0);
    const [isRecording, setIsRecording] = createSignal(false);
    const [isProcessing, setIsProcessing] = createSignal(false);
    const [userTranscript, setUserTranscript] = createSignal("");
    const [currentScore, setCurrentScore] = createSignal(null);
    const [mediaRecorder, setMediaRecorder] = createSignal(null);
    const [audioChunks, setAudioChunks] = createSignal([]);
    const [showFeedback, setShowFeedback] = createSignal(false);
    const [isCorrect, setIsCorrect] = createSignal(false);
    const apiBaseUrl = () => props.apiBaseUrl || "http://localhost:8787";
    const [exercises] = createResource(async () => {
      try {
        const url = props.sessionId ? `${apiBaseUrl()}/api/practice/exercises?limit=10&sessionId=${props.sessionId}` : `${apiBaseUrl()}/api/practice/exercises?limit=10`;
        const headers = {};
        if (props.authToken) {
          headers["Authorization"] = `Bearer ${props.authToken}`;
        }
        const response = await fetch(url, {
          headers
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error("[PracticeExerciseView] API error:", response.status, errorText);
          throw new Error("Failed to fetch exercises");
        }
        const data = await response.json();
        if (data.data && data.data.exercises) {
          return data.data.exercises;
        }
        return [];
      } catch (error) {
        console.error("[PracticeExerciseView] Failed to fetch:", error);
        return [];
      }
    });
    createEffect(() => {
      exercises();
    });
    const handleStartRecording = async () => {
      setUserTranscript("");
      setCurrentScore(null);
      setAudioChunks([]);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
        const recorder = new MediaRecorder(stream, {
          mimeType
        });
        const chunks = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        recorder.onstop = async () => {
          const audioBlob = new Blob(chunks, {
            type: mimeType
          });
          await processRecording(audioBlob);
          stream.getTracks().forEach((track) => track.stop());
        };
        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
      } catch (error) {
        console.error("[PracticeExerciseView] Failed to start recording:", error);
        setIsRecording(false);
      }
    };
    const processRecording = async (blob) => {
      var _a2, _b2;
      try {
        setIsProcessing(true);
        const reader = new FileReader();
        const base64 = await new Promise((resolve) => {
          reader.onloadend = () => {
            const base64String = reader.result;
            resolve(base64String.split(",")[1]);
          };
          reader.readAsDataURL(blob);
        });
        let response;
        let attempts = 0;
        const maxAttempts = 2;
        const headers = {
          "Content-Type": "application/json"
        };
        if (props.authToken) {
          headers["Authorization"] = `Bearer ${props.authToken}`;
        }
        while (attempts < maxAttempts) {
          try {
            response = await fetch(`${apiBaseUrl()}/api/speech-to-text/transcribe`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                audioBase64: base64,
                expectedText: (_a2 = currentExercise()) == null ? void 0 : _a2.full_line,
                // Use Deepgram on retry
                preferDeepgram: attempts > 0
              })
            });
            if (response.ok) {
              break;
            }
          } catch (fetchError) {
            console.error(`[PracticeExerciseView] STT attempt ${attempts + 1} failed:`, fetchError);
          }
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
        if (response && response.ok) {
          const result2 = await response.json();
          setUserTranscript(result2.data.transcript);
          const score = calculateScore(((_b2 = currentExercise()) == null ? void 0 : _b2.full_line) || "", result2.data.transcript);
          setCurrentScore(score);
          await handleAutoSubmit(score);
        } else {
          throw new Error("STT failed after retries");
        }
      } catch (error) {
        console.error("[PracticeExerciseView] Failed to process recording:", error);
      } finally {
        setIsProcessing(false);
      }
    };
    const handleStopRecording = () => {
      const recorder = mediaRecorder();
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
        setIsRecording(false);
      }
    };
    const calculateScore = (expected, actual) => {
      const expectedWords = expected.toLowerCase().split(/\s+/);
      const actualWords = actual.toLowerCase().split(/\s+/);
      let matches = 0;
      for (let i = 0; i < expectedWords.length; i++) {
        if (actualWords[i] === expectedWords[i]) {
          matches++;
        }
      }
      return Math.round(matches / expectedWords.length * 100);
    };
    const handleAutoSubmit = async (score) => {
      var _a2;
      const currentExercise2 = (_a2 = exercises()) == null ? void 0 : _a2[currentExerciseIndex()];
      const chunks = audioChunks();
      const blob = chunks.length > 0 ? new Blob(chunks, {
        type: "audio/webm"
      }) : null;
      setIsCorrect(score >= 80);
      setShowFeedback(true);
      if (currentExercise2 && currentExercise2.card_ids.length > 0 && blob) {
        try {
          const reader = new FileReader();
          const base64 = await new Promise((resolve) => {
            reader.onloadend = () => {
              const base64String = reader.result;
              resolve(base64String.split(",")[1]);
            };
            reader.readAsDataURL(blob);
          });
          const headers = {
            "Content-Type": "application/json"
          };
          if (props.authToken) {
            headers["Authorization"] = `Bearer ${props.authToken}`;
          }
          const response = await fetch(`${apiBaseUrl()}/api/practice/review`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              exerciseId: currentExercise2.id,
              audioBase64: base64,
              cardScores: currentExercise2.card_ids.map((cardId) => ({
                cardId,
                score
              }))
            })
          });
          if (response.ok) {
          }
        } catch (error) {
          console.error("[PracticeExerciseView] Failed to submit review:", error);
        }
      }
    };
    const handleSubmit = async () => {
      const score = currentScore();
      if (score !== null) {
        await handleAutoSubmit(score);
      }
    };
    const handleContinue = () => {
      var _a2;
      if (currentExerciseIndex() < (((_a2 = exercises()) == null ? void 0 : _a2.length) || 0) - 1) {
        setCurrentExerciseIndex(currentExerciseIndex() + 1);
        setUserTranscript("");
        setCurrentScore(null);
        setAudioChunks([]);
        setShowFeedback(false);
        setIsCorrect(false);
      } else {
        props.onBack();
      }
    };
    const currentExercise = () => {
      var _a2;
      return (_a2 = exercises()) == null ? void 0 : _a2[currentExerciseIndex()];
    };
    return (() => {
      var _el$ = _tmpl$$1();
      insert(_el$, createComponent(Show, {
        get when() {
          return !exercises.loading;
        },
        get fallback() {
          return _tmpl$2$1();
        },
        get children() {
          return createComponent(Show, {
            get when() {
              return (exercises() || []).length > 0;
            },
            get fallback() {
              return _tmpl$3$1();
            },
            get children() {
              return createComponent(Show, {
                get when() {
                  return currentExercise();
                },
                children: (exercise) => [createComponent(ProgressBar, {
                  get current() {
                    return currentExerciseIndex() + 1;
                  },
                  get total() {
                    var _a2;
                    return ((_a2 = exercises()) == null ? void 0 : _a2.length) || 0;
                  }
                }), createComponent(PracticeHeader, {
                  get title() {
                    return props.headerTitle || "";
                  },
                  get onExit() {
                    return props.onBack;
                  }
                }), (() => {
                  var _el$4 = _tmpl$4$1();
                  insert(_el$4, createComponent(ExerciseTemplate, {
                    instructionText: "Read aloud:",
                    get children() {
                      return createComponent(ReadAloud, {
                        get prompt() {
                          return exercise().full_line;
                        },
                        get userTranscript() {
                          return userTranscript();
                        }
                      });
                    }
                  }));
                  return _el$4;
                })(), createComponent(Show, {
                  get when() {
                    return showFeedback();
                  },
                  get fallback() {
                    return createComponent(ExerciseFooter, {
                      get isRecording() {
                        return isRecording();
                      },
                      get isProcessing() {
                        return isProcessing();
                      },
                      get canSubmit() {
                        return userTranscript().trim().length > 0;
                      },
                      onRecord: handleStartRecording,
                      onStop: handleStopRecording,
                      onSubmit: handleSubmit
                    });
                  },
                  get children() {
                    return createComponent(ResponseFooter, {
                      mode: "feedback",
                      get isCorrect() {
                        return isCorrect();
                      },
                      onContinue: handleContinue
                    });
                  }
                })]
              });
            }
          });
        }
      }));
      return _el$;
    })();
  };
  content;
  content;
  content;
  content;
  content;
  content;
  content;
  content;
  delegateEvents(["click"]);
  content;
  content;
  delegateEvents(["click"]);
  content;
  content;
  content;
  function useKaraokeSession(options) {
    const [isPlaying, setIsPlaying] = createSignal(false);
    const [currentTime, setCurrentTime] = createSignal(0);
    const [score, setScore] = createSignal(0);
    const [countdown, setCountdown] = createSignal(null);
    const [sessionId, setSessionId] = createSignal(null);
    const [lineScores, setLineScores] = createSignal([]);
    const [currentChunk, setCurrentChunk] = createSignal(null);
    const [isRecording, setIsRecording] = createSignal(false);
    const [audioElement, setAudioElement] = createSignal(options.audioElement);
    const [recordedChunks, setRecordedChunks] = createSignal(/* @__PURE__ */ new Set());
    const [playbackSpeed, setPlaybackSpeed] = createSignal("1x");
    let audioUpdateInterval = null;
    let recordingTimeout = null;
    const audioProcessor = createKaraokeAudioProcessor({
      sampleRate: 16e3
    });
    const karaokeApi2 = new KaraokeApiService$1(options.apiUrl);
    const getPlaybackRate = (speed2) => {
      switch (speed2) {
        case "0.5x":
          return 0.5;
        case "0.75x":
          return 0.75;
        case "1x":
          return 1;
        default:
          return 1;
      }
    };
    const getSpeedMultiplier = (speed2) => {
      switch (speed2) {
        case "0.5x":
          return 1.2;
        // 20% score boost for slowest speed
        case "0.75x":
          return 1.1;
        // 10% score boost for medium speed
        case "1x":
          return 1;
        // No adjustment for normal speed
        default:
          return 1;
      }
    };
    const handleSpeedChange = (speed2) => {
      console.log("[KaraokeSession] handleSpeedChange called with:", speed2);
      setPlaybackSpeed(speed2);
      const audio = audioElement();
      if (audio) {
        const rate = getPlaybackRate(speed2);
        console.log("[KaraokeSession] Setting audio playback rate to:", rate, "audio paused:", audio.paused);
        audio.playbackRate = rate;
      } else {
        console.log("[KaraokeSession] No audio element available yet");
      }
    };
    const startSession = async () => {
      try {
        await audioProcessor.initialize();
      } catch (error) {
        console.error("[KaraokeSession] Failed to initialize audio:", error);
      }
      if (options.trackId && options.songData) {
        try {
          const session = await karaokeApi2.startSession(
            options.trackId,
            {
              title: options.songData.title,
              artist: options.songData.artist,
              duration: options.songData.duration,
              difficulty: "intermediate"
              // Default difficulty
            },
            void 0,
            // authToken
            options.songCatalogId,
            playbackSpeed()
          );
          if (session) {
            setSessionId(session.id);
          } else {
            console.error("[KaraokeSession] Failed to create session");
          }
        } catch (error) {
          console.error("[KaraokeSession] Failed to create session:", error);
        }
      }
      setCountdown(3);
      const countdownInterval = setInterval(() => {
        const current = countdown();
        if (current !== null && current > 1) {
          setCountdown(current - 1);
        } else {
          clearInterval(countdownInterval);
          setCountdown(null);
          startPlayback();
        }
      }, 1e3);
    };
    const startPlayback = () => {
      setIsPlaying(true);
      audioProcessor.startFullSession();
      const audio = audioElement() || options.audioElement;
      if (audio) {
        const rate = getPlaybackRate(playbackSpeed());
        console.log("[KaraokeSession] Starting playback with speed:", playbackSpeed(), "rate:", rate);
        audio.playbackRate = rate;
        audio.play().catch(console.error);
        const updateTime = () => {
          const time = audio.currentTime * 1e3;
          setCurrentTime(time);
          checkForUpcomingLines(time);
        };
        audioUpdateInterval = setInterval(updateTime, 100);
        audio.addEventListener("ended", handleEnd);
      }
    };
    const checkForUpcomingLines = (currentTimeMs) => {
      if (isRecording() || !options.lyrics.length) return;
      const recorded = recordedChunks();
      for (let i = 0; i < options.lyrics.length; i++) {
        if (recorded.has(i)) {
          continue;
        }
        const chunk = shouldChunkLines(options.lyrics, i);
        const firstLine = options.lyrics[chunk.startIndex];
        if (firstLine && firstLine.startTime !== void 0) {
          const recordingStartTime = firstLine.startTime * 1e3 - 1e3;
          const lineStartTime = firstLine.startTime * 1e3;
          if (currentTimeMs >= recordingStartTime && currentTimeMs < lineStartTime + 500) {
            setRecordedChunks((prev) => new Set(prev).add(chunk.startIndex));
            startRecordingChunk(chunk);
            break;
          }
        }
        i = chunk.endIndex;
      }
    };
    const startRecordingChunk = async (chunk) => {
      if (chunk.startIndex >= 5) {
        handleEnd();
        return;
      }
      setCurrentChunk(chunk);
      setIsRecording(true);
      audioProcessor.startRecordingLine(chunk.startIndex);
      const baseDuration = calculateRecordingDuration(options.lyrics, chunk);
      const speedFactor = 1 / getPlaybackRate(playbackSpeed());
      const duration = baseDuration * speedFactor;
      recordingTimeout = setTimeout(() => {
        stopRecordingChunk();
      }, duration);
    };
    const stopRecordingChunk = async () => {
      const chunk = currentChunk();
      if (!chunk) return;
      setIsRecording(false);
      const audioChunks = audioProcessor.stopRecordingLineAndGetRawAudio();
      const wavBlob = audioProcessor.convertAudioToWavBlob(audioChunks);
      if (wavBlob && wavBlob.size > 1e3 && sessionId()) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          var _a2;
          const base64Audio = (_a2 = reader.result) == null ? void 0 : _a2.toString().split(",")[1];
          if (base64Audio && base64Audio.length > 100) {
            await gradeChunk(chunk, base64Audio);
          }
        };
        reader.readAsDataURL(wavBlob);
      } else if (wavBlob && wavBlob.size <= 1e3) {
        setLineScores((prev) => [...prev, {
          lineIndex: chunk.startIndex,
          score: 50,
          transcription: "",
          feedback: "Recording too short"
        }]);
      } else if (wavBlob && !sessionId()) ;
      setCurrentChunk(null);
      if (recordingTimeout) {
        clearTimeout(recordingTimeout);
        recordingTimeout = null;
      }
    };
    const gradeChunk = async (chunk, audioBase64) => {
      var _a2, _b2, _c;
      const currentSessionId = sessionId();
      if (!currentSessionId) {
        return;
      }
      try {
        const lineScore = await karaokeApi2.gradeRecording(
          currentSessionId,
          chunk.startIndex,
          audioBase64,
          chunk.expectedText,
          ((_a2 = options.lyrics[chunk.startIndex]) == null ? void 0 : _a2.startTime) || 0,
          (((_b2 = options.lyrics[chunk.endIndex]) == null ? void 0 : _b2.startTime) || 0) + (((_c = options.lyrics[chunk.endIndex]) == null ? void 0 : _c.duration) || 0) / 1e3,
          void 0,
          // authToken
          playbackSpeed()
        );
        if (lineScore) {
          const speedMultiplier = getSpeedMultiplier(playbackSpeed());
          const adjustedScore = Math.min(100, Math.round(lineScore.score * speedMultiplier));
          const newLineScore = {
            lineIndex: chunk.startIndex,
            score: adjustedScore,
            transcription: lineScore.transcript || "",
            feedback: lineScore.feedback
          };
          setLineScores((prev) => [...prev, newLineScore]);
          setScore((prev) => {
            const allScores = [...lineScores(), newLineScore];
            const avgScore = allScores.reduce((sum, s) => sum + s.score, 0) / allScores.length;
            return Math.round(avgScore);
          });
        } else {
          setLineScores((prev) => [...prev, {
            lineIndex: chunk.startIndex,
            score: 50,
            // Neutral score
            transcription: "",
            feedback: "Failed to grade recording"
          }]);
        }
      } catch (error) {
        console.error("[KaraokeSession] Failed to grade chunk:", error);
      }
    };
    const handleEnd = async () => {
      var _a2;
      setIsPlaying(false);
      if (audioUpdateInterval) {
        clearInterval(audioUpdateInterval);
      }
      const audio = audioElement() || options.audioElement;
      if (audio && !audio.paused) {
        audio.pause();
      }
      if (isRecording()) {
        await stopRecordingChunk();
      }
      const loadingResults = {
        score: -1,
        // Special value to indicate loading
        accuracy: 0,
        totalLines: lineScores().length,
        perfectLines: 0,
        goodLines: 0,
        needsWorkLines: 0,
        sessionId: sessionId() || void 0,
        isLoading: true
      };
      (_a2 = options.onComplete) == null ? void 0 : _a2.call(options, loadingResults);
      const fullAudioBlob = audioProcessor.stopFullSessionAndGetWav();
      const currentSessionId = sessionId();
      if (currentSessionId && fullAudioBlob && fullAudioBlob.size > 1e3) {
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            var _a3, _b2;
            const base64Audio = (_a3 = reader.result) == null ? void 0 : _a3.toString().split(",")[1];
            const sessionResults = await karaokeApi2.completeSession(
              currentSessionId,
              base64Audio
            );
            if (sessionResults) {
              const results = {
                score: sessionResults.finalScore,
                accuracy: sessionResults.accuracy,
                totalLines: sessionResults.totalLines,
                perfectLines: sessionResults.perfectLines,
                goodLines: sessionResults.goodLines,
                needsWorkLines: sessionResults.needsWorkLines,
                sessionId: currentSessionId
              };
              (_b2 = options.onComplete) == null ? void 0 : _b2.call(options, results);
            } else {
              calculateLocalResults();
            }
          };
          reader.readAsDataURL(fullAudioBlob);
        } catch (error) {
          console.error("[KaraokeSession] Failed to complete session:", error);
          calculateLocalResults();
        }
      } else {
        calculateLocalResults();
      }
    };
    const calculateLocalResults = () => {
      var _a2;
      const scores = lineScores();
      const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length : 0;
      const results = {
        score: Math.round(avgScore),
        accuracy: Math.round(avgScore),
        totalLines: scores.length,
        // Use actual completed lines for test mode
        perfectLines: scores.filter((s) => s.score >= 90).length,
        goodLines: scores.filter((s) => s.score >= 70 && s.score < 90).length,
        needsWorkLines: scores.filter((s) => s.score < 70).length,
        sessionId: sessionId() || void 0
      };
      (_a2 = options.onComplete) == null ? void 0 : _a2.call(options, results);
    };
    const stopSession = () => {
      setIsPlaying(false);
      setCountdown(null);
      setIsRecording(false);
      setCurrentChunk(null);
      setRecordedChunks(/* @__PURE__ */ new Set());
      if (audioUpdateInterval) {
        clearInterval(audioUpdateInterval);
        audioUpdateInterval = null;
      }
      if (recordingTimeout) {
        clearTimeout(recordingTimeout);
        recordingTimeout = null;
      }
      const audio = audioElement() || options.audioElement;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.removeEventListener("ended", handleEnd);
      }
      audioProcessor.cleanup();
    };
    onCleanup(() => {
      stopSession();
    });
    return {
      // State
      isPlaying,
      currentTime,
      score,
      countdown,
      sessionId,
      lineScores,
      isRecording,
      currentChunk,
      playbackSpeed,
      // Actions
      startSession,
      stopSession,
      handleSpeedChange,
      // Audio processor (for direct access if needed)
      audioProcessor,
      // Method to update audio element after initialization
      setAudioElement: (element) => {
        setAudioElement(element);
        if (element) {
          element.playbackRate = getPlaybackRate(playbackSpeed());
        }
      }
    };
  }
  content;
  content;
  content;
  content;
  content;
  content;
  class TrackDetector {
    /**
     * Detect current track from the page (SoundCloud only)
     */
    detectCurrentTrack() {
      const url = window.location.href;
      if (url.includes("sc.maid.zone")) {
        return this.detectSoundCloudTrack();
      }
      return null;
    }
    /**
     * Extract track info from SoundCloud (sc.maid.zone)
     */
    detectSoundCloudTrack() {
      var _a2, _b2;
      try {
        const pathParts = window.location.pathname.split("/").filter(Boolean);
        if (pathParts.length < 2) return null;
        const artistPath = pathParts[0];
        const trackSlug = pathParts[1];
        let title = "";
        const h1Elements = document.querySelectorAll("h1");
        for (const h1 of h1Elements) {
          if ((_a2 = h1.textContent) == null ? void 0 : _a2.toLowerCase().includes("soundcloak")) continue;
          title = ((_b2 = h1.textContent) == null ? void 0 : _b2.trim()) || "";
          if (title) break;
        }
        if (!title) {
          title = trackSlug.replace(/-/g, " ");
        }
        let artist = "";
        const artistLink = document.querySelector("a.listing .meta h3");
        if (artistLink && artistLink.textContent) {
          artist = artistLink.textContent.trim();
        }
        if (!artist) {
          const pageTitle = document.title;
          const match = pageTitle.match(/by\s+(.+?)\s*~/);
          if (match) {
            artist = match[1].trim();
          }
        }
        if (!artist) {
          artist = artistPath.replace(/-/g, " ").replace(/_/g, " ");
        }
        console.log("[TrackDetector] Detected track:", { title, artist, artistPath, trackSlug });
        return {
          trackId: `${artistPath}/${trackSlug}`,
          title,
          artist,
          platform: "soundcloud",
          url: window.location.href
        };
      } catch (error) {
        console.error("[TrackDetector] Error detecting SoundCloud track:", error);
        return null;
      }
    }
    /**
     * Watch for page changes (SoundCloud is a SPA)
     */
    watchForChanges(callback) {
      let currentUrl = window.location.href;
      let currentTrack = this.detectCurrentTrack();
      callback(currentTrack);
      const checkForChanges = () => {
        const newUrl = window.location.href;
        if (newUrl !== currentUrl) {
          currentUrl = newUrl;
          const newTrack = this.detectCurrentTrack();
          const trackChanged = !currentTrack || !newTrack || currentTrack.trackId !== newTrack.trackId;
          if (trackChanged) {
            currentTrack = newTrack;
            callback(newTrack);
          }
        }
      };
      const interval = setInterval(checkForChanges, 1e3);
      const handleNavigation = () => {
        setTimeout(checkForChanges, 100);
      };
      window.addEventListener("popstate", handleNavigation);
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      history.pushState = function(...args) {
        originalPushState.apply(history, args);
        handleNavigation();
      };
      history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        handleNavigation();
      };
      return () => {
        clearInterval(interval);
        window.removeEventListener("popstate", handleNavigation);
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
      };
    }
  }
  const trackDetector = new TrackDetector();
  content;
  async function getAuthToken() {
    const result2 = await browser.storage.local.get("authToken");
    return result2.authToken || null;
  }
  content;
  class KaraokeApiService {
    constructor() {
      __publicField(this, "baseUrl");
      this.baseUrl = "http://localhost:8787/api";
    }
    /**
     * Get karaoke data for a track ID (YouTube/SoundCloud)
     */
    async getKaraokeData(trackId, title, artist) {
      try {
        const params = new URLSearchParams();
        if (title) params.set("title", title);
        if (artist) params.set("artist", artist);
        const url = `${this.baseUrl}/karaoke/${encodeURIComponent(trackId)}${params.toString() ? "?" + params.toString() : ""}`;
        console.log("[KaraokeApi] Fetching karaoke data:", url);
        const response = await fetch(url, {
          method: "GET"
          // Remove Content-Type header to avoid CORS preflight
          // headers: {
          //   'Content-Type': 'application/json',
          // },
        });
        if (!response.ok) {
          console.error("[KaraokeApi] Failed to fetch karaoke data:", response.status);
          return null;
        }
        const data = await response.json();
        console.log("[KaraokeApi] Received karaoke data:", data);
        if (data.error) {
          console.log("[KaraokeApi] Server error (but API is reachable):", data.error);
          return {
            success: false,
            has_karaoke: false,
            error: data.error,
            track_id: trackId,
            api_connected: true
          };
        }
        return data;
      } catch (error) {
        console.error("[KaraokeApi] Error fetching karaoke data:", error);
        return null;
      }
    }
    /**
     * Start a karaoke session
     */
    async startSession(trackId, songData) {
      try {
        const response = await fetch(`${this.baseUrl}/karaoke/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
            // TODO: Add auth token when available
          },
          body: JSON.stringify({
            trackId,
            songData
          })
        });
        if (!response.ok) {
          console.error("[KaraokeApi] Failed to start session:", response.status);
          return null;
        }
        const result2 = await response.json();
        return result2.session;
      } catch (error) {
        console.error("[KaraokeApi] Error starting session:", error);
        return null;
      }
    }
    /**
     * Test connection to the API
     */
    async testConnection() {
      try {
        const response = await fetch(`${this.baseUrl.replace("/api", "")}/health`);
        return response.ok;
      } catch (error) {
        console.error("[KaraokeApi] Connection test failed:", error);
        return false;
      }
    }
  }
  const karaokeApi = new KaraokeApiService();
  content;
  const PracticeView = (props) => {
    return createComponent(PracticeExerciseView, {
      get sessionId() {
        return props.sessionId;
      },
      get onBack() {
        return props.onBack;
      }
    });
  };
  content;
  var _tmpl$ = /* @__PURE__ */ template(`<button class="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"aria-label="Close Practice"><svg width=20 height=20 viewBox="0 0 20 20"fill=none xmlns=http://www.w3.org/2000/svg><path d="M15 5L5 15M5 5L15 15"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>`), _tmpl$2 = /* @__PURE__ */ template(`<div class="h-full overflow-y-auto">`), _tmpl$3 = /* @__PURE__ */ template(`<div><div class="h-full bg-surface rounded-2xl overflow-hidden flex flex-col"><div class="flex items-center justify-end p-2 bg-surface border-b border-subtle"><div class="flex items-center gap-2"><button class="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"aria-label=Minimize><svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M6 12h12"stroke=currentColor stroke-width=3 stroke-linecap=round></path></svg></button></div></div><div class="flex-1 min-h-0 overflow-hidden">`), _tmpl$4 = /* @__PURE__ */ template(`<div>`), _tmpl$5 = /* @__PURE__ */ template(`<div class="absolute inset-0 bg-black/80 flex items-center justify-center z-50"><div class=text-center><div class="text-8xl font-bold text-white animate-pulse"></div><p class="text-xl text-white/80 mt-4">Get ready!`), _tmpl$6 = /* @__PURE__ */ template(`<div class="h-full flex flex-col"><div class="flex-1 min-h-0 overflow-hidden">`), _tmpl$7 = /* @__PURE__ */ template(`<div class="flex items-center justify-center h-full bg-base"><div class=text-center><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div><p class=text-secondary>Loading lyrics...`), _tmpl$8 = /* @__PURE__ */ template(`<div class="flex items-center justify-center h-full p-8"><div class=text-center><p class="text-lg text-secondary mb-2">No lyrics available</p><p class="text-sm text-tertiary">Try a different song`), _tmpl$9 = /* @__PURE__ */ template(`<div class="h-full flex flex-col">`), _tmpl$0 = /* @__PURE__ */ template(`<div class="flex items-center justify-center h-full bg-base"><div class=text-center><div class="animate-spin rounded-full h-16 w-16 border-b-2 border-accent-primary mx-auto mb-4"></div><p class="text-lg text-secondary">Calculating your final score...</p><p class="text-sm text-tertiary mt-2">Analyzing full performance`);
  const ContentApp = () => {
    console.log("[ContentApp] Rendering ContentApp component");
    const [currentTrack, setCurrentTrack] = createSignal(null);
    const [authToken, setAuthToken] = createSignal(null);
    const [showKaraoke, setShowKaraoke] = createSignal(false);
    const [karaokeData, setKaraokeData] = createSignal(null);
    const [loading, setLoading] = createSignal(false);
    const [sessionStarted, setSessionStarted] = createSignal(false);
    const [isMinimized, setIsMinimized] = createSignal(false);
    const [countdown, setCountdown] = createSignal(null);
    const [isPlaying, setIsPlaying] = createSignal(false);
    const [currentTime, setCurrentTime] = createSignal(0);
    const [audioRef, setAudioRef] = createSignal(null);
    const [karaokeSession, setKaraokeSession] = createSignal(null);
    const [completionData, setCompletionData] = createSignal(null);
    const [showPractice, setShowPractice] = createSignal(false);
    const [selectedSpeed, setSelectedSpeed] = createSignal("1x");
    onMount(async () => {
      console.log("[ContentApp] Loading auth token");
      const token = await getAuthToken();
      if (token) {
        setAuthToken(token);
        console.log("[ContentApp] Auth token loaded");
      } else {
        console.log("[ContentApp] No auth token found, using demo token");
        setAuthToken("scarlett_demo_token_123");
      }
      const cleanup = trackDetector.watchForChanges((track) => {
        console.log("[ContentApp] Track changed:", track);
        setCurrentTrack(track);
        if (track) {
          setShowKaraoke(true);
          fetchKaraokeData(track);
        }
      });
      onCleanup(cleanup);
    });
    const fetchKaraokeData = async (track) => {
      console.log("[ContentApp] Fetching karaoke data for track:", track);
      setLoading(true);
      try {
        const data = await karaokeApi.getKaraokeData(track.trackId, track.title, track.artist);
        console.log("[ContentApp] Karaoke data loaded:", data);
        setKaraokeData(data);
      } catch (error) {
        console.error("[ContentApp] Failed to fetch karaoke data:", error);
      } finally {
        setLoading(false);
      }
    };
    const handleStart = async () => {
      var _a2, _b2;
      console.log("[ContentApp] Start karaoke session");
      setSessionStarted(true);
      const data = karaokeData();
      audioRef();
      const track = currentTrack();
      if (data && track && ((_a2 = data.lyrics) == null ? void 0 : _a2.lines)) {
        console.log("[ContentApp] Creating karaoke session with audio capture", {
          trackId: track.id,
          trackTitle: track.title,
          songData: data.song,
          hasLyrics: !!((_b2 = data.lyrics) == null ? void 0 : _b2.lines)
        });
        const newSession = useKaraokeSession({
          lyrics: data.lyrics.lines,
          trackId: track.trackId,
          songData: data.song ? {
            title: data.song.title,
            artist: data.song.artist,
            album: data.song.album,
            duration: data.song.duration
          } : {
            title: track.title,
            artist: track.artist
          },
          songCatalogId: data.song_catalog_id,
          audioElement: void 0,
          // Will be set when audio starts playing
          apiUrl: "http://localhost:8787/api",
          onComplete: (results) => {
            console.log("[ContentApp] Karaoke session completed:", results);
            setSessionStarted(false);
            setIsPlaying(false);
            setCompletionData(results);
            const audio2 = audioRef();
            if (audio2) {
              audio2.pause();
            }
          }
        });
        console.log("[ContentApp] Applying selected speed to new session:", selectedSpeed());
        newSession.handleSpeedChange(selectedSpeed());
        setKaraokeSession(newSession);
        await newSession.startSession();
        createEffect(() => {
          if (newSession.countdown() === null && newSession.isPlaying() && !isPlaying()) {
            console.log("[ContentApp] Countdown finished, starting audio playback");
            startAudioPlayback();
          }
          const audio2 = audioRef();
          if (audio2 && newSession) {
            console.log("[ContentApp] Setting audio element on new session");
            newSession.setAudioElement(audio2);
          }
        });
      } else {
        console.log("[ContentApp] Fallback to simple countdown");
        setCountdown(3);
        const countdownInterval = setInterval(() => {
          const current = countdown();
          if (current !== null && current > 1) {
            setCountdown(current - 1);
          } else {
            clearInterval(countdownInterval);
            setCountdown(null);
            startAudioPlayback();
          }
        }, 1e3);
      }
    };
    const startAudioPlayback = () => {
      console.log("[ContentApp] Starting audio playback");
      setIsPlaying(true);
      const audioElements = document.querySelectorAll("audio");
      console.log("[ContentApp] Found audio elements:", audioElements.length);
      if (audioElements.length > 0) {
        const audio = audioElements[0];
        console.log("[ContentApp] Audio element:", {
          src: audio.src,
          paused: audio.paused,
          duration: audio.duration,
          currentTime: audio.currentTime
        });
        setAudioRef(audio);
        const session = karaokeSession();
        if (session) {
          console.log("[ContentApp] Setting audio element on karaoke session");
          session.setAudioElement(audio);
          if (!session.audioProcessor.isReady()) {
            console.log("[ContentApp] Initializing audio processor for session");
            session.audioProcessor.initialize().catch(console.error);
          }
        }
        audio.play().then(() => {
          console.log("[ContentApp] Audio started playing successfully");
        }).catch((err) => {
          console.error("[ContentApp] Failed to play audio:", err);
          console.log("[ContentApp] Attempting to click play button...");
          const playButton = document.querySelector('button[title*="Play"], button[aria-label*="Play"], .playControl, .playButton, [class*="play-button"]');
          if (playButton) {
            console.log("[ContentApp] Found play button, clicking it");
            playButton.click();
          }
        });
        const updateTime = () => {
          setCurrentTime(audio.currentTime);
        };
        audio.addEventListener("timeupdate", updateTime);
        audio.addEventListener("ended", () => {
          setIsPlaying(false);
          audio.removeEventListener("timeupdate", updateTime);
        });
      } else {
        console.log("[ContentApp] No audio elements found, trying SoundCloud-specific approach");
        const playButton = document.querySelector('.playControl, .sc-button-play, button[title*="Play"]');
        if (playButton) {
          console.log("[ContentApp] Found SoundCloud play button, clicking it");
          playButton.click();
          setTimeout(() => {
            const newAudioElements = document.querySelectorAll("audio");
            if (newAudioElements.length > 0) {
              console.log("[ContentApp] Found audio element after clicking play");
              const audio = newAudioElements[0];
              setAudioRef(audio);
              const updateTime = () => {
                setCurrentTime(audio.currentTime);
              };
              audio.addEventListener("timeupdate", updateTime);
              audio.addEventListener("ended", () => {
                setIsPlaying(false);
                audio.removeEventListener("timeupdate", updateTime);
              });
            }
          }, 500);
        }
      }
    };
    const handleMinimize = () => {
      console.log("[ContentApp] Minimize karaoke widget");
      setIsMinimized(true);
    };
    const handleRestore = () => {
      console.log("[ContentApp] Restore karaoke widget");
      setIsMinimized(false);
    };
    console.log("[ContentApp] Render state:", {
      showKaraoke: showKaraoke(),
      currentTrack: currentTrack(),
      karaokeData: karaokeData(),
      loading: loading()
    });
    return [createComponent(Show, {
      get when() {
        return memo(() => !!(showKaraoke() && currentTrack()))() && isMinimized();
      },
      get children() {
        return createComponent(MinimizedKaraoke, {
          onClick: handleRestore
        });
      }
    }), createComponent(Show, {
      get when() {
        return memo(() => !!(showKaraoke() && currentTrack()))() && !isMinimized();
      },
      get fallback() {
        return (() => {
          var _el$9 = _tmpl$4();
          _el$9.style.setProperty("display", "none");
          insert(_el$9, () => console.log("[ContentApp] Not showing - showKaraoke:", showKaraoke(), "currentTrack:", currentTrack()));
          return _el$9;
        })();
      },
      get children() {
        var _el$ = _tmpl$3(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$6 = _el$4.firstChild, _el$7 = _el$3.nextSibling;
        _el$.style.setProperty("position", "fixed");
        _el$.style.setProperty("top", "20px");
        _el$.style.setProperty("right", "20px");
        _el$.style.setProperty("bottom", "20px");
        _el$.style.setProperty("width", "480px");
        _el$.style.setProperty("z-index", "99999");
        _el$.style.setProperty("overflow", "hidden");
        _el$.style.setProperty("border-radius", "16px");
        _el$.style.setProperty("box-shadow", "0 25px 50px -12px rgba(0, 0, 0, 0.6)");
        _el$.style.setProperty("display", "flex");
        _el$.style.setProperty("flex-direction", "column");
        insert(_el$, () => console.log("[ContentApp] Rendering with completion data:", completionData()), _el$2);
        _el$3.style.setProperty("height", "48px");
        insert(_el$4, createComponent(Show, {
          get when() {
            return showPractice();
          },
          get children() {
            var _el$5 = _tmpl$();
            _el$5.$$click = () => setShowPractice(false);
            _el$5.style.setProperty("color", "#a8a8a8");
            return _el$5;
          }
        }), _el$6);
        _el$6.$$click = handleMinimize;
        _el$6.style.setProperty("color", "#a8a8a8");
        insert(_el$7, createComponent(Show, {
          get when() {
            return completionData();
          },
          get fallback() {
            return createComponent(Show, {
              get when() {
                return !loading();
              },
              get fallback() {
                return _tmpl$7();
              },
              get children() {
                return createComponent(Show, {
                  get when() {
                    var _a2, _b2;
                    return (_b2 = (_a2 = karaokeData()) == null ? void 0 : _a2.lyrics) == null ? void 0 : _b2.lines;
                  },
                  get fallback() {
                    return _tmpl$8();
                  },
                  get children() {
                    var _el$0 = _tmpl$6(), _el$1 = _el$0.firstChild;
                    insert(_el$1, createComponent(ExtensionKaraokeView, {
                      get score() {
                        return memo(() => !!karaokeSession())() ? karaokeSession().score() : 0;
                      },
                      rank: 1,
                      get lyrics() {
                        var _a2, _b2;
                        return ((_b2 = (_a2 = karaokeData()) == null ? void 0 : _a2.lyrics) == null ? void 0 : _b2.lines) || [];
                      },
                      get currentTime() {
                        return memo(() => !!karaokeSession())() ? karaokeSession().currentTime() : currentTime() * 1e3;
                      },
                      leaderboard: [],
                      get isPlaying() {
                        return memo(() => !!karaokeSession())() ? karaokeSession().isPlaying() || karaokeSession().countdown() !== null : isPlaying() || countdown() !== null;
                      },
                      onStart: handleStart,
                      onSpeedChange: (speed2) => {
                        console.log("[ContentApp] Speed changed:", speed2);
                        setSelectedSpeed(speed2);
                        const session = karaokeSession();
                        if (session) {
                          console.log("[ContentApp] Applying speed change to session");
                          session.handleSpeedChange(speed2);
                        } else {
                          console.log("[ContentApp] No session yet, speed will be applied when session starts");
                        }
                        const audio = audioRef();
                        if (audio) {
                          const rate = speed2 === "0.5x" ? 0.5 : speed2 === "0.75x" ? 0.75 : 1;
                          console.log("[ContentApp] Setting audio playback rate directly to:", rate);
                          audio.playbackRate = rate;
                        }
                      },
                      get isRecording() {
                        return memo(() => !!karaokeSession())() ? karaokeSession().isRecording() : false;
                      },
                      get lineScores() {
                        return memo(() => !!karaokeSession())() ? karaokeSession().lineScores() : [];
                      }
                    }));
                    insert(_el$0, createComponent(Show, {
                      get when() {
                        return memo(() => !!karaokeSession())() ? karaokeSession().countdown() !== null : countdown() !== null;
                      },
                      get children() {
                        var _el$10 = _tmpl$5(), _el$11 = _el$10.firstChild, _el$12 = _el$11.firstChild;
                        insert(_el$12, (() => {
                          var _c$ = memo(() => !!karaokeSession());
                          return () => _c$() ? karaokeSession().countdown() : countdown();
                        })());
                        return _el$10;
                      }
                    }), null);
                    return _el$0;
                  }
                });
              }
            });
          },
          get children() {
            return createComponent(Show, {
              get when() {
                return showPractice();
              },
              get fallback() {
                return createComponent(I18nProvider, {
                  get children() {
                    var _el$15 = _tmpl$9();
                    insert(_el$15, createComponent(Show, {
                      get when() {
                        return !completionData().isLoading;
                      },
                      get fallback() {
                        return _tmpl$0();
                      },
                      get children() {
                        return createComponent(CompletionView, {
                          "class": "h-full",
                          get score() {
                            return completionData().score;
                          },
                          rank: 1,
                          get speed() {
                            return selectedSpeed();
                          },
                          get feedbackText() {
                            return memo(() => completionData().score >= 95)() ? "Perfect! You nailed it!" : memo(() => completionData().score >= 85)() ? "Excellent performance!" : memo(() => completionData().score >= 70)() ? "Great job!" : completionData().score >= 50 ? "Good effort!" : "Keep practicing!";
                          },
                          onPractice: () => {
                            console.log("[ContentApp] Practice errors clicked");
                            setShowPractice(true);
                          }
                        });
                      }
                    }));
                    return _el$15;
                  }
                });
              },
              get children() {
                var _el$8 = _tmpl$2();
                insert(_el$8, createComponent(PracticeView, {
                  get sessionId() {
                    var _a2;
                    return (_a2 = completionData()) == null ? void 0 : _a2.sessionId;
                  },
                  onBack: () => setShowPractice(false)
                }));
                return _el$8;
              }
            });
          }
        }));
        return _el$;
      }
    })];
  };
  delegateEvents(["click"]);
  content;
  const definition = defineContentScript({
    matches: ["*://soundcloud.com/*", "*://soundcloak.com/*", "*://sc.maid.zone/*", "*://*.maid.zone/*"],
    runAt: "document_idle",
    cssInjectionMode: "ui",
    async main(ctx) {
      if (window.top !== window.self) {
        console.log("[Scarlett CS] Not top-level frame, skipping content script.");
        return;
      }
      console.log("[Scarlett CS] Scarlett Karaoke content script loaded");
      const ui = await createShadowRootUi(ctx, {
        name: "scarlett-karaoke-ui",
        position: "overlay",
        anchor: "body",
        onMount: async (container) => {
          var _a2;
          console.log("[Content Script] onMount called, container:", container);
          console.log("[Content Script] Shadow root:", container.getRootNode());
          const shadowRoot = container.getRootNode();
          console.log("[Content Script] Shadow root stylesheets:", (_a2 = shadowRoot.styleSheets) == null ? void 0 : _a2.length);
          const wrapper = document.createElement("div");
          wrapper.className = "karaoke-widget-container";
          container.appendChild(wrapper);
          console.log("[Content Script] Wrapper created and appended:", wrapper);
          console.log("[Content Script] Wrapper computed styles:", window.getComputedStyle(wrapper));
          console.log("[Content Script] About to render ContentApp");
          const dispose2 = render(() => createComponent(ContentApp, {}), wrapper);
          console.log("[Content Script] ContentApp rendered, dispose function:", dispose2);
          return dispose2;
        },
        onRemove: (cleanup) => {
          cleanup == null ? void 0 : cleanup();
        }
      });
      ui.mount();
      console.log("[Scarlett CS] Karaoke overlay mounted");
    }
  });
  content;
  const _WxtLocationChangeEvent = class _WxtLocationChangeEvent extends Event {
    constructor(newUrl, oldUrl) {
      super(_WxtLocationChangeEvent.EVENT_NAME, {});
      this.newUrl = newUrl;
      this.oldUrl = oldUrl;
    }
  };
  __publicField(_WxtLocationChangeEvent, "EVENT_NAME", getUniqueEventName("wxt:locationchange"));
  let WxtLocationChangeEvent = _WxtLocationChangeEvent;
  function getUniqueEventName(eventName) {
    var _a2;
    return `${(_a2 = browser == null ? void 0 : browser.runtime) == null ? void 0 : _a2.id}:${"content"}:${eventName}`;
  }
  function createLocationWatcher(ctx) {
    let interval;
    let oldUrl;
    return {
      /**
       * Ensure the location watcher is actively looking for URL changes. If it's already watching,
       * this is a noop.
       */
      run() {
        if (interval != null) return;
        oldUrl = new URL(location.href);
        interval = ctx.setInterval(() => {
          let newUrl = new URL(location.href);
          if (newUrl.href !== oldUrl.href) {
            window.dispatchEvent(new WxtLocationChangeEvent(newUrl, oldUrl));
            oldUrl = newUrl;
          }
        }, 1e3);
      }
    };
  }
  const _ContentScriptContext = class _ContentScriptContext {
    constructor(contentScriptName, options) {
      __publicField(this, "isTopFrame", window.self === window.top);
      __publicField(this, "abortController");
      __publicField(this, "locationWatcher", createLocationWatcher(this));
      __publicField(this, "receivedMessageIds", /* @__PURE__ */ new Set());
      this.contentScriptName = contentScriptName;
      this.options = options;
      this.abortController = new AbortController();
      if (this.isTopFrame) {
        this.listenForNewerScripts({ ignoreFirstEvent: true });
        this.stopOldScripts();
      } else {
        this.listenForNewerScripts();
      }
    }
    get signal() {
      return this.abortController.signal;
    }
    abort(reason) {
      return this.abortController.abort(reason);
    }
    get isInvalid() {
      if (browser.runtime.id == null) {
        this.notifyInvalidated();
      }
      return this.signal.aborted;
    }
    get isValid() {
      return !this.isInvalid;
    }
    /**
     * Add a listener that is called when the content script's context is invalidated.
     *
     * @returns A function to remove the listener.
     *
     * @example
     * browser.runtime.onMessage.addListener(cb);
     * const removeInvalidatedListener = ctx.onInvalidated(() => {
     *   browser.runtime.onMessage.removeListener(cb);
     * })
     * // ...
     * removeInvalidatedListener();
     */
    onInvalidated(cb) {
      this.signal.addEventListener("abort", cb);
      return () => this.signal.removeEventListener("abort", cb);
    }
    /**
     * Return a promise that never resolves. Useful if you have an async function that shouldn't run
     * after the context is expired.
     *
     * @example
     * const getValueFromStorage = async () => {
     *   if (ctx.isInvalid) return ctx.block();
     *
     *   // ...
     * }
     */
    block() {
      return new Promise(() => {
      });
    }
    /**
     * Wrapper around `window.setInterval` that automatically clears the interval when invalidated.
     */
    setInterval(handler, timeout) {
      const id = setInterval(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearInterval(id));
      return id;
    }
    /**
     * Wrapper around `window.setTimeout` that automatically clears the interval when invalidated.
     */
    setTimeout(handler, timeout) {
      const id = setTimeout(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearTimeout(id));
      return id;
    }
    /**
     * Wrapper around `window.requestAnimationFrame` that automatically cancels the request when
     * invalidated.
     */
    requestAnimationFrame(callback) {
      const id = requestAnimationFrame((...args) => {
        if (this.isValid) callback(...args);
      });
      this.onInvalidated(() => cancelAnimationFrame(id));
      return id;
    }
    /**
     * Wrapper around `window.requestIdleCallback` that automatically cancels the request when
     * invalidated.
     */
    requestIdleCallback(callback, options) {
      const id = requestIdleCallback((...args) => {
        if (!this.signal.aborted) callback(...args);
      }, options);
      this.onInvalidated(() => cancelIdleCallback(id));
      return id;
    }
    addEventListener(target, type, handler, options) {
      var _a2;
      if (type === "wxt:locationchange") {
        if (this.isValid) this.locationWatcher.run();
      }
      (_a2 = target.addEventListener) == null ? void 0 : _a2.call(
        target,
        type.startsWith("wxt:") ? getUniqueEventName(type) : type,
        handler,
        {
          ...options,
          signal: this.signal
        }
      );
    }
    /**
     * @internal
     * Abort the abort controller and execute all `onInvalidated` listeners.
     */
    notifyInvalidated() {
      this.abort("Content script context invalidated");
      logger$1.debug(
        `Content script "${this.contentScriptName}" context invalidated`
      );
    }
    stopOldScripts() {
      window.postMessage(
        {
          type: _ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE,
          contentScriptName: this.contentScriptName,
          messageId: Math.random().toString(36).slice(2)
        },
        "*"
      );
    }
    verifyScriptStartedEvent(event) {
      var _a2, _b2, _c;
      const isScriptStartedEvent = ((_a2 = event.data) == null ? void 0 : _a2.type) === _ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE;
      const isSameContentScript = ((_b2 = event.data) == null ? void 0 : _b2.contentScriptName) === this.contentScriptName;
      const isNotDuplicate = !this.receivedMessageIds.has((_c = event.data) == null ? void 0 : _c.messageId);
      return isScriptStartedEvent && isSameContentScript && isNotDuplicate;
    }
    listenForNewerScripts(options) {
      let isFirst = true;
      const cb = (event) => {
        if (this.verifyScriptStartedEvent(event)) {
          this.receivedMessageIds.add(event.data.messageId);
          const wasFirst = isFirst;
          isFirst = false;
          if (wasFirst && (options == null ? void 0 : options.ignoreFirstEvent)) return;
          this.notifyInvalidated();
        }
      };
      addEventListener("message", cb);
      this.onInvalidated(() => removeEventListener("message", cb));
    }
  };
  __publicField(_ContentScriptContext, "SCRIPT_STARTED_MESSAGE_TYPE", getUniqueEventName(
    "wxt:content-script-started"
  ));
  let ContentScriptContext = _ContentScriptContext;
  function initPlugins() {
  }
  function print(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  const result = (async () => {
    try {
      initPlugins();
      const { main, ...options } = definition;
      const ctx = new ContentScriptContext("content", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"content"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  const buttons$1 = { "start": "Start", "stop": "Stop", "continue": "Continue", "cancel": "Cancel", "back": "Back", "next": "Next", "skip": "Skip", "save": "Save", "share": "Share" };
  const status$1 = { "loading": "Loading...", "ready": "Ready", "recording": "Recording", "processing": "Processing...", "error": "Error", "success": "Success", "offline": "Offline" };
  const speed$1 = { "label": "Speed", "slow": "Slow", "normal": "Normal", "fast": "Fast" };
  const common$1 = {
    buttons: buttons$1,
    status: status$1,
    speed: speed$1
  };
  const header$1 = { "title": "Karaoke Session", "subtitle": "Sing along and have fun!", "songBy": "by {{artist}}" };
  const lyrics$1 = { "loading": "Loading lyrics...", "noLyrics": "No lyrics available", "scrollPrompt": "Scroll to see more" };
  const recording$1 = { "listening": "Listening...", "speak": "Start singing!", "processing": "Processing your performance..." };
  const scoring$1 = { "perfect": "Perfect! You nailed every note!", "excellent": "Excellent performance!", "great": "Great job!", "good": "Good performance!", "keepPracticing": "Keep practicing!", "score": "Score", "accuracy": "Accuracy", "timing": "Timing" };
  const completion$1 = { "title": "Performance Complete!", "performanceComplete": "You've completed the song!", "yourScore": "Your score: {{score}}", "sharePrompt": "Share your performance", "shareMessage": "I just scored {{score}} on {{song}} by {{artist}}! 🎤", "playAgain": "Play Again", "tryAnotherSong": "Try Another Song", "downloadRecording": "Download Recording" };
  const leaderboard$1 = { "title": "Leaderboard", "topPerformers": "Top Performers", "yourRank": "Your Rank: #{{rank}}", "anonymous": "Anonymous" };
  const karaoke$1 = {
    header: header$1,
    lyrics: lyrics$1,
    recording: recording$1,
    scoring: scoring$1,
    completion: completion$1,
    leaderboard: leaderboard$1
  };
  const scorePanel$1 = { "currentScore": "Current Score", "bestScore": "Best Score", "streak": "Streak", "multiplier": "{{value}}x Multiplier" };
  const display$1 = {
    scorePanel: scorePanel$1
  };
  const translations$1 = {
    common: common$1,
    karaoke: karaoke$1,
    display: display$1
  };
  content;
  const index$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    default: translations$1
  }, Symbol.toStringTag, { value: "Module" }));
  const buttons = { "start": "开始", "stop": "停止", "continue": "继续", "cancel": "取消", "back": "返回", "next": "下一步", "skip": "跳过", "save": "保存", "share": "分享" };
  const status = { "loading": "加载中...", "ready": "准备就绪", "recording": "录音中", "processing": "处理中...", "error": "错误", "success": "成功", "offline": "离线" };
  const speed = { "label": "速度", "slow": "慢速", "normal": "正常", "fast": "快速" };
  const common = {
    buttons,
    status,
    speed
  };
  const header = { "title": "卡拉OK时间", "subtitle": "跟着唱，享受乐趣！", "songBy": "演唱：{{artist}}" };
  const lyrics = { "loading": "歌词加载中...", "noLyrics": "暂无歌词", "scrollPrompt": "滚动查看更多" };
  const recording = { "listening": "聆听中...", "speak": "开始唱歌吧！", "processing": "正在处理您的表演..." };
  const scoring = { "perfect": "完美！每个音符都唱对了！", "excellent": "表现出色！", "great": "唱得很棒！", "good": "表现不错！", "keepPracticing": "继续加油！", "score": "得分", "accuracy": "准确度", "timing": "节奏感" };
  const completion = { "title": "演唱完成！", "performanceComplete": "您已完成这首歌！", "yourScore": "您的得分：{{score}}", "sharePrompt": "分享您的表演", "shareMessage": "我刚在《{{song}}》（{{artist}}）中获得了{{score}}分！🎤", "playAgain": "再唱一次", "tryAnotherSong": "换首歌试试", "downloadRecording": "下载录音" };
  const leaderboard = { "title": "排行榜", "topPerformers": "最佳表演者", "yourRank": "您的排名：第{{rank}}名", "anonymous": "匿名用户" };
  const karaoke = {
    header,
    lyrics,
    recording,
    scoring,
    completion,
    leaderboard
  };
  const scorePanel = { "currentScore": "当前得分", "bestScore": "最高得分", "streak": "连击", "multiplier": "{{value}}倍加成" };
  const display = {
    scorePanel
  };
  const translations = {
    common,
    karaoke,
    display
  };
  content;
  const index = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    default: translations
  }, Symbol.toStringTag, { value: "Module" }));
  return result;
}();
content;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL2Rpc3QvZGV2LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL3dlYi9kaXN0L2Rldi5qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWUvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnQvbGliL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbnkta2V5cy1tYXAvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvZGVmdS9kaXN0L2RlZnUubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0AxbmF0c3Uvd2FpdC1lbGVtZW50L2Rpc3QvZGV0ZWN0b3JzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AMW5hdHN1L3dhaXQtZWxlbWVudC9kaXN0L2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYXJlZC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9jbHN4L2Rpc3QvY2xzeC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvY24udHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9sYXlvdXQvSGVhZGVyL0hlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9kaXNwbGF5L1Njb3JlUGFuZWwvU2NvcmVQYW5lbC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vQnV0dG9uL0J1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9vbmJvYXJkaW5nL09uYm9hcmRpbmdGbG93L09uYm9hcmRpbmdGbG93LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheS9MeXJpY3NEaXNwbGF5LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvS2FyYW9rZUhlYWRlci9LYXJhb2tlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbC9MZWFkZXJib2FyZFBhbmVsLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9TcGxpdEJ1dHRvbi9TcGxpdEJ1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vVGFicy9UYWJzLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2VmZmVjdHMvRmlyZUVtb2ppQW5pbWF0aW9uL0ZpcmVFbW9qaUFuaW1hdGlvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9rYXJhb2tlL0V4dGVuc2lvbkthcmFva2VWaWV3L0V4dGVuc2lvbkthcmFva2VWaWV3LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9pMThuL3Byb3ZpZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvQ29tcGxldGlvblZpZXcvQ29tcGxldGlvblZpZXcudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL3NlcnZpY2VzL2F1ZGlvL2thcmFva2VBdWRpb1Byb2Nlc3Nvci50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9zZXJ2aWNlcy9rYXJhb2tlL2thcmFva2VBcGkudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvc2VydmljZXMva2FyYW9rZS9jaHVua2luZ1V0aWxzLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvY29tbW9uL1Byb2dyZXNzQmFyL1Byb2dyZXNzQmFyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL01pbmltaXplZEthcmFva2UudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcHJhY3RpY2UvUHJhY3RpY2VIZWFkZXIvUHJhY3RpY2VIZWFkZXIudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcHJhY3RpY2UvRXhlcmNpc2VGb290ZXIvRXhlcmNpc2VGb290ZXIudHN4IiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3Bob3NwaG9yLWljb25zLXNvbGlkL2Rpc3QvSWNvbkNoZWNrQ2lyY2xlRmlsbC5qc3giLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvcGhvc3Bob3ItaWNvbnMtc29saWQvZGlzdC9JY29uWENpcmNsZUZpbGwuanN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcHJhY3RpY2UvUmVzcG9uc2VGb290ZXIvUmVzcG9uc2VGb290ZXIudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcHJhY3RpY2UvRXhlcmNpc2VUZW1wbGF0ZS9FeGVyY2lzZVRlbXBsYXRlLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3ByYWN0aWNlL1JlYWRBbG91ZC9SZWFkQWxvdWQudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcHJhY3RpY2UvUHJhY3RpY2VFeGVyY2lzZVZpZXcvUHJhY3RpY2VFeGVyY2lzZVZpZXcudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvZmFyY2FzdGVyL0ZhcmNhc3Rlck1pbmlBcHAvRmFyY2FzdGVyTWluaUFwcC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wYWdlcy9Ib21lUGFnZS9Ib21lUGFnZS50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvaG9va3MvdXNlS2FyYW9rZVNlc3Npb24udHMiLCIuLi8uLi8uLi9zcmMvc2VydmljZXMvdHJhY2stZGV0ZWN0b3IudHMiLCIuLi8uLi8uLi9zcmMvdXRpbHMvc3RvcmFnZS50cyIsIi4uLy4uLy4uL3NyYy9zZXJ2aWNlcy9rYXJhb2tlLWFwaS50cyIsIi4uLy4uLy4uL3NyYy92aWV3cy9jb250ZW50L1ByYWN0aWNlVmlldy50c3giLCIuLi8uLi8uLi9zcmMvdmlld3MvY29udGVudC9Db250ZW50QXBwLnRzeCIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQudHN4IiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQubWpzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2kxOG4vbG9jYWxlcy9lbi9pbmRleC50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9pMThuL2xvY2FsZXMvemgtQ04vaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsibGV0IHRhc2tJZENvdW50ZXIgPSAxLFxuICBpc0NhbGxiYWNrU2NoZWR1bGVkID0gZmFsc2UsXG4gIGlzUGVyZm9ybWluZ1dvcmsgPSBmYWxzZSxcbiAgdGFza1F1ZXVlID0gW10sXG4gIGN1cnJlbnRUYXNrID0gbnVsbCxcbiAgc2hvdWxkWWllbGRUb0hvc3QgPSBudWxsLFxuICB5aWVsZEludGVydmFsID0gNSxcbiAgZGVhZGxpbmUgPSAwLFxuICBtYXhZaWVsZEludGVydmFsID0gMzAwLFxuICBzY2hlZHVsZUNhbGxiYWNrID0gbnVsbCxcbiAgc2NoZWR1bGVkQ2FsbGJhY2sgPSBudWxsO1xuY29uc3QgbWF4U2lnbmVkMzFCaXRJbnQgPSAxMDczNzQxODIzO1xuZnVuY3Rpb24gc2V0dXBTY2hlZHVsZXIoKSB7XG4gIGNvbnN0IGNoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKSxcbiAgICBwb3J0ID0gY2hhbm5lbC5wb3J0MjtcbiAgc2NoZWR1bGVDYWxsYmFjayA9ICgpID0+IHBvcnQucG9zdE1lc3NhZ2UobnVsbCk7XG4gIGNoYW5uZWwucG9ydDEub25tZXNzYWdlID0gKCkgPT4ge1xuICAgIGlmIChzY2hlZHVsZWRDYWxsYmFjayAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgY3VycmVudFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGRlYWRsaW5lID0gY3VycmVudFRpbWUgKyB5aWVsZEludGVydmFsO1xuICAgICAgY29uc3QgaGFzVGltZVJlbWFpbmluZyA9IHRydWU7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBoYXNNb3JlV29yayA9IHNjaGVkdWxlZENhbGxiYWNrKGhhc1RpbWVSZW1haW5pbmcsIGN1cnJlbnRUaW1lKTtcbiAgICAgICAgaWYgKCFoYXNNb3JlV29yaykge1xuICAgICAgICAgIHNjaGVkdWxlZENhbGxiYWNrID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHBvcnQucG9zdE1lc3NhZ2UobnVsbCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBwb3J0LnBvc3RNZXNzYWdlKG51bGwpO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH1cbiAgICB9XG4gIH07XG4gIGlmIChuYXZpZ2F0b3IgJiYgbmF2aWdhdG9yLnNjaGVkdWxpbmcgJiYgbmF2aWdhdG9yLnNjaGVkdWxpbmcuaXNJbnB1dFBlbmRpbmcpIHtcbiAgICBjb25zdCBzY2hlZHVsaW5nID0gbmF2aWdhdG9yLnNjaGVkdWxpbmc7XG4gICAgc2hvdWxkWWllbGRUb0hvc3QgPSAoKSA9PiB7XG4gICAgICBjb25zdCBjdXJyZW50VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgaWYgKGN1cnJlbnRUaW1lID49IGRlYWRsaW5lKSB7XG4gICAgICAgIGlmIChzY2hlZHVsaW5nLmlzSW5wdXRQZW5kaW5nKCkpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY3VycmVudFRpbWUgPj0gbWF4WWllbGRJbnRlcnZhbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHNob3VsZFlpZWxkVG9Ib3N0ID0gKCkgPT4gcGVyZm9ybWFuY2Uubm93KCkgPj0gZGVhZGxpbmU7XG4gIH1cbn1cbmZ1bmN0aW9uIGVucXVldWUodGFza1F1ZXVlLCB0YXNrKSB7XG4gIGZ1bmN0aW9uIGZpbmRJbmRleCgpIHtcbiAgICBsZXQgbSA9IDA7XG4gICAgbGV0IG4gPSB0YXNrUXVldWUubGVuZ3RoIC0gMTtcbiAgICB3aGlsZSAobSA8PSBuKSB7XG4gICAgICBjb25zdCBrID0gbiArIG0gPj4gMTtcbiAgICAgIGNvbnN0IGNtcCA9IHRhc2suZXhwaXJhdGlvblRpbWUgLSB0YXNrUXVldWVba10uZXhwaXJhdGlvblRpbWU7XG4gICAgICBpZiAoY21wID4gMCkgbSA9IGsgKyAxO2Vsc2UgaWYgKGNtcCA8IDApIG4gPSBrIC0gMTtlbHNlIHJldHVybiBrO1xuICAgIH1cbiAgICByZXR1cm4gbTtcbiAgfVxuICB0YXNrUXVldWUuc3BsaWNlKGZpbmRJbmRleCgpLCAwLCB0YXNrKTtcbn1cbmZ1bmN0aW9uIHJlcXVlc3RDYWxsYmFjayhmbiwgb3B0aW9ucykge1xuICBpZiAoIXNjaGVkdWxlQ2FsbGJhY2spIHNldHVwU2NoZWR1bGVyKCk7XG4gIGxldCBzdGFydFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKSxcbiAgICB0aW1lb3V0ID0gbWF4U2lnbmVkMzFCaXRJbnQ7XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMudGltZW91dCkgdGltZW91dCA9IG9wdGlvbnMudGltZW91dDtcbiAgY29uc3QgbmV3VGFzayA9IHtcbiAgICBpZDogdGFza0lkQ291bnRlcisrLFxuICAgIGZuLFxuICAgIHN0YXJ0VGltZSxcbiAgICBleHBpcmF0aW9uVGltZTogc3RhcnRUaW1lICsgdGltZW91dFxuICB9O1xuICBlbnF1ZXVlKHRhc2tRdWV1ZSwgbmV3VGFzayk7XG4gIGlmICghaXNDYWxsYmFja1NjaGVkdWxlZCAmJiAhaXNQZXJmb3JtaW5nV29yaykge1xuICAgIGlzQ2FsbGJhY2tTY2hlZHVsZWQgPSB0cnVlO1xuICAgIHNjaGVkdWxlZENhbGxiYWNrID0gZmx1c2hXb3JrO1xuICAgIHNjaGVkdWxlQ2FsbGJhY2soKTtcbiAgfVxuICByZXR1cm4gbmV3VGFzaztcbn1cbmZ1bmN0aW9uIGNhbmNlbENhbGxiYWNrKHRhc2spIHtcbiAgdGFzay5mbiA9IG51bGw7XG59XG5mdW5jdGlvbiBmbHVzaFdvcmsoaGFzVGltZVJlbWFpbmluZywgaW5pdGlhbFRpbWUpIHtcbiAgaXNDYWxsYmFja1NjaGVkdWxlZCA9IGZhbHNlO1xuICBpc1BlcmZvcm1pbmdXb3JrID0gdHJ1ZTtcbiAgdHJ5IHtcbiAgICByZXR1cm4gd29ya0xvb3AoaGFzVGltZVJlbWFpbmluZywgaW5pdGlhbFRpbWUpO1xuICB9IGZpbmFsbHkge1xuICAgIGN1cnJlbnRUYXNrID0gbnVsbDtcbiAgICBpc1BlcmZvcm1pbmdXb3JrID0gZmFsc2U7XG4gIH1cbn1cbmZ1bmN0aW9uIHdvcmtMb29wKGhhc1RpbWVSZW1haW5pbmcsIGluaXRpYWxUaW1lKSB7XG4gIGxldCBjdXJyZW50VGltZSA9IGluaXRpYWxUaW1lO1xuICBjdXJyZW50VGFzayA9IHRhc2tRdWV1ZVswXSB8fCBudWxsO1xuICB3aGlsZSAoY3VycmVudFRhc2sgIT09IG51bGwpIHtcbiAgICBpZiAoY3VycmVudFRhc2suZXhwaXJhdGlvblRpbWUgPiBjdXJyZW50VGltZSAmJiAoIWhhc1RpbWVSZW1haW5pbmcgfHwgc2hvdWxkWWllbGRUb0hvc3QoKSkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjb25zdCBjYWxsYmFjayA9IGN1cnJlbnRUYXNrLmZuO1xuICAgIGlmIChjYWxsYmFjayAhPT0gbnVsbCkge1xuICAgICAgY3VycmVudFRhc2suZm4gPSBudWxsO1xuICAgICAgY29uc3QgZGlkVXNlckNhbGxiYWNrVGltZW91dCA9IGN1cnJlbnRUYXNrLmV4cGlyYXRpb25UaW1lIDw9IGN1cnJlbnRUaW1lO1xuICAgICAgY2FsbGJhY2soZGlkVXNlckNhbGxiYWNrVGltZW91dCk7XG4gICAgICBjdXJyZW50VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgaWYgKGN1cnJlbnRUYXNrID09PSB0YXNrUXVldWVbMF0pIHtcbiAgICAgICAgdGFza1F1ZXVlLnNoaWZ0KCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHRhc2tRdWV1ZS5zaGlmdCgpO1xuICAgIGN1cnJlbnRUYXNrID0gdGFza1F1ZXVlWzBdIHx8IG51bGw7XG4gIH1cbiAgcmV0dXJuIGN1cnJlbnRUYXNrICE9PSBudWxsO1xufVxuXG5jb25zdCBzaGFyZWRDb25maWcgPSB7XG4gIGNvbnRleHQ6IHVuZGVmaW5lZCxcbiAgcmVnaXN0cnk6IHVuZGVmaW5lZCxcbiAgZWZmZWN0czogdW5kZWZpbmVkLFxuICBkb25lOiBmYWxzZSxcbiAgZ2V0Q29udGV4dElkKCkge1xuICAgIHJldHVybiBnZXRDb250ZXh0SWQodGhpcy5jb250ZXh0LmNvdW50KTtcbiAgfSxcbiAgZ2V0TmV4dENvbnRleHRJZCgpIHtcbiAgICByZXR1cm4gZ2V0Q29udGV4dElkKHRoaXMuY29udGV4dC5jb3VudCsrKTtcbiAgfVxufTtcbmZ1bmN0aW9uIGdldENvbnRleHRJZChjb3VudCkge1xuICBjb25zdCBudW0gPSBTdHJpbmcoY291bnQpLFxuICAgIGxlbiA9IG51bS5sZW5ndGggLSAxO1xuICByZXR1cm4gc2hhcmVkQ29uZmlnLmNvbnRleHQuaWQgKyAobGVuID8gU3RyaW5nLmZyb21DaGFyQ29kZSg5NiArIGxlbikgOiBcIlwiKSArIG51bTtcbn1cbmZ1bmN0aW9uIHNldEh5ZHJhdGVDb250ZXh0KGNvbnRleHQpIHtcbiAgc2hhcmVkQ29uZmlnLmNvbnRleHQgPSBjb250ZXh0O1xufVxuZnVuY3Rpb24gbmV4dEh5ZHJhdGVDb250ZXh0KCkge1xuICByZXR1cm4ge1xuICAgIC4uLnNoYXJlZENvbmZpZy5jb250ZXh0LFxuICAgIGlkOiBzaGFyZWRDb25maWcuZ2V0TmV4dENvbnRleHRJZCgpLFxuICAgIGNvdW50OiAwXG4gIH07XG59XG5cbmNvbnN0IElTX0RFViA9IHRydWU7XG5jb25zdCBlcXVhbEZuID0gKGEsIGIpID0+IGEgPT09IGI7XG5jb25zdCAkUFJPWFkgPSBTeW1ib2woXCJzb2xpZC1wcm94eVwiKTtcbmNvbnN0IFNVUFBPUlRTX1BST1hZID0gdHlwZW9mIFByb3h5ID09PSBcImZ1bmN0aW9uXCI7XG5jb25zdCAkVFJBQ0sgPSBTeW1ib2woXCJzb2xpZC10cmFja1wiKTtcbmNvbnN0ICRERVZDT01QID0gU3ltYm9sKFwic29saWQtZGV2LWNvbXBvbmVudFwiKTtcbmNvbnN0IHNpZ25hbE9wdGlvbnMgPSB7XG4gIGVxdWFsczogZXF1YWxGblxufTtcbmxldCBFUlJPUiA9IG51bGw7XG5sZXQgcnVuRWZmZWN0cyA9IHJ1blF1ZXVlO1xuY29uc3QgU1RBTEUgPSAxO1xuY29uc3QgUEVORElORyA9IDI7XG5jb25zdCBVTk9XTkVEID0ge1xuICBvd25lZDogbnVsbCxcbiAgY2xlYW51cHM6IG51bGwsXG4gIGNvbnRleHQ6IG51bGwsXG4gIG93bmVyOiBudWxsXG59O1xuY29uc3QgTk9fSU5JVCA9IHt9O1xudmFyIE93bmVyID0gbnVsbDtcbmxldCBUcmFuc2l0aW9uID0gbnVsbDtcbmxldCBTY2hlZHVsZXIgPSBudWxsO1xubGV0IEV4dGVybmFsU291cmNlQ29uZmlnID0gbnVsbDtcbmxldCBMaXN0ZW5lciA9IG51bGw7XG5sZXQgVXBkYXRlcyA9IG51bGw7XG5sZXQgRWZmZWN0cyA9IG51bGw7XG5sZXQgRXhlY0NvdW50ID0gMDtcbmNvbnN0IERldkhvb2tzID0ge1xuICBhZnRlclVwZGF0ZTogbnVsbCxcbiAgYWZ0ZXJDcmVhdGVPd25lcjogbnVsbCxcbiAgYWZ0ZXJDcmVhdGVTaWduYWw6IG51bGwsXG4gIGFmdGVyUmVnaXN0ZXJHcmFwaDogbnVsbFxufTtcbmZ1bmN0aW9uIGNyZWF0ZVJvb3QoZm4sIGRldGFjaGVkT3duZXIpIHtcbiAgY29uc3QgbGlzdGVuZXIgPSBMaXN0ZW5lcixcbiAgICBvd25lciA9IE93bmVyLFxuICAgIHVub3duZWQgPSBmbi5sZW5ndGggPT09IDAsXG4gICAgY3VycmVudCA9IGRldGFjaGVkT3duZXIgPT09IHVuZGVmaW5lZCA/IG93bmVyIDogZGV0YWNoZWRPd25lcixcbiAgICByb290ID0gdW5vd25lZCA/IHtcbiAgICAgIG93bmVkOiBudWxsLFxuICAgICAgY2xlYW51cHM6IG51bGwsXG4gICAgICBjb250ZXh0OiBudWxsLFxuICAgICAgb3duZXI6IG51bGxcbiAgICB9ICA6IHtcbiAgICAgIG93bmVkOiBudWxsLFxuICAgICAgY2xlYW51cHM6IG51bGwsXG4gICAgICBjb250ZXh0OiBjdXJyZW50ID8gY3VycmVudC5jb250ZXh0IDogbnVsbCxcbiAgICAgIG93bmVyOiBjdXJyZW50XG4gICAgfSxcbiAgICB1cGRhdGVGbiA9IHVub3duZWQgPyAoKSA9PiBmbigoKSA9PiB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJEaXNwb3NlIG1ldGhvZCBtdXN0IGJlIGFuIGV4cGxpY2l0IGFyZ3VtZW50IHRvIGNyZWF0ZVJvb3QgZnVuY3Rpb25cIik7XG4gICAgfSkgIDogKCkgPT4gZm4oKCkgPT4gdW50cmFjaygoKSA9PiBjbGVhbk5vZGUocm9vdCkpKTtcbiAgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lciAmJiBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyKHJvb3QpO1xuICBPd25lciA9IHJvb3Q7XG4gIExpc3RlbmVyID0gbnVsbDtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcnVuVXBkYXRlcyh1cGRhdGVGbiwgdHJ1ZSk7XG4gIH0gZmluYWxseSB7XG4gICAgTGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgICBPd25lciA9IG93bmVyO1xuICB9XG59XG5mdW5jdGlvbiBjcmVhdGVTaWduYWwodmFsdWUsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgPyBPYmplY3QuYXNzaWduKHt9LCBzaWduYWxPcHRpb25zLCBvcHRpb25zKSA6IHNpZ25hbE9wdGlvbnM7XG4gIGNvbnN0IHMgPSB7XG4gICAgdmFsdWUsXG4gICAgb2JzZXJ2ZXJzOiBudWxsLFxuICAgIG9ic2VydmVyU2xvdHM6IG51bGwsXG4gICAgY29tcGFyYXRvcjogb3B0aW9ucy5lcXVhbHMgfHwgdW5kZWZpbmVkXG4gIH07XG4gIHtcbiAgICBpZiAob3B0aW9ucy5uYW1lKSBzLm5hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgaWYgKG9wdGlvbnMuaW50ZXJuYWwpIHtcbiAgICAgIHMuaW50ZXJuYWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWdpc3RlckdyYXBoKHMpO1xuICAgICAgaWYgKERldkhvb2tzLmFmdGVyQ3JlYXRlU2lnbmFsKSBEZXZIb29rcy5hZnRlckNyZWF0ZVNpZ25hbChzKTtcbiAgICB9XG4gIH1cbiAgY29uc3Qgc2V0dGVyID0gdmFsdWUgPT4ge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMocykpIHZhbHVlID0gdmFsdWUocy50VmFsdWUpO2Vsc2UgdmFsdWUgPSB2YWx1ZShzLnZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyaXRlU2lnbmFsKHMsIHZhbHVlKTtcbiAgfTtcbiAgcmV0dXJuIFtyZWFkU2lnbmFsLmJpbmQocyksIHNldHRlcl07XG59XG5mdW5jdGlvbiBjcmVhdGVDb21wdXRlZChmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgdHJ1ZSwgU1RBTEUsIG9wdGlvbnMgKTtcbiAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgVXBkYXRlcy5wdXNoKGMpO2Vsc2UgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG59XG5mdW5jdGlvbiBjcmVhdGVSZW5kZXJFZmZlY3QoZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIGZhbHNlLCBTVEFMRSwgb3B0aW9ucyApO1xuICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBVcGRhdGVzLnB1c2goYyk7ZWxzZSB1cGRhdGVDb21wdXRhdGlvbihjKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUVmZmVjdChmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgcnVuRWZmZWN0cyA9IHJ1blVzZXJFZmZlY3RzO1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCBmYWxzZSwgU1RBTEUsIG9wdGlvbnMgKSxcbiAgICBzID0gU3VzcGVuc2VDb250ZXh0ICYmIHVzZUNvbnRleHQoU3VzcGVuc2VDb250ZXh0KTtcbiAgaWYgKHMpIGMuc3VzcGVuc2UgPSBzO1xuICBpZiAoIW9wdGlvbnMgfHwgIW9wdGlvbnMucmVuZGVyKSBjLnVzZXIgPSB0cnVlO1xuICBFZmZlY3RzID8gRWZmZWN0cy5wdXNoKGMpIDogdXBkYXRlQ29tcHV0YXRpb24oYyk7XG59XG5mdW5jdGlvbiBjcmVhdGVSZWFjdGlvbihvbkludmFsaWRhdGUsIG9wdGlvbnMpIHtcbiAgbGV0IGZuO1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oKCkgPT4ge1xuICAgICAgZm4gPyBmbigpIDogdW50cmFjayhvbkludmFsaWRhdGUpO1xuICAgICAgZm4gPSB1bmRlZmluZWQ7XG4gICAgfSwgdW5kZWZpbmVkLCBmYWxzZSwgMCwgb3B0aW9ucyApLFxuICAgIHMgPSBTdXNwZW5zZUNvbnRleHQgJiYgdXNlQ29udGV4dChTdXNwZW5zZUNvbnRleHQpO1xuICBpZiAocykgYy5zdXNwZW5zZSA9IHM7XG4gIGMudXNlciA9IHRydWU7XG4gIHJldHVybiB0cmFja2luZyA9PiB7XG4gICAgZm4gPSB0cmFja2luZztcbiAgICB1cGRhdGVDb21wdXRhdGlvbihjKTtcbiAgfTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZU1lbW8oZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zID8gT2JqZWN0LmFzc2lnbih7fSwgc2lnbmFsT3B0aW9ucywgb3B0aW9ucykgOiBzaWduYWxPcHRpb25zO1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCB0cnVlLCAwLCBvcHRpb25zICk7XG4gIGMub2JzZXJ2ZXJzID0gbnVsbDtcbiAgYy5vYnNlcnZlclNsb3RzID0gbnVsbDtcbiAgYy5jb21wYXJhdG9yID0gb3B0aW9ucy5lcXVhbHMgfHwgdW5kZWZpbmVkO1xuICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgYy50U3RhdGUgPSBTVEFMRTtcbiAgICBVcGRhdGVzLnB1c2goYyk7XG4gIH0gZWxzZSB1cGRhdGVDb21wdXRhdGlvbihjKTtcbiAgcmV0dXJuIHJlYWRTaWduYWwuYmluZChjKTtcbn1cbmZ1bmN0aW9uIGlzUHJvbWlzZSh2KSB7XG4gIHJldHVybiB2ICYmIHR5cGVvZiB2ID09PSBcIm9iamVjdFwiICYmIFwidGhlblwiIGluIHY7XG59XG5mdW5jdGlvbiBjcmVhdGVSZXNvdXJjZShwU291cmNlLCBwRmV0Y2hlciwgcE9wdGlvbnMpIHtcbiAgbGV0IHNvdXJjZTtcbiAgbGV0IGZldGNoZXI7XG4gIGxldCBvcHRpb25zO1xuICBpZiAodHlwZW9mIHBGZXRjaGVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBzb3VyY2UgPSBwU291cmNlO1xuICAgIGZldGNoZXIgPSBwRmV0Y2hlcjtcbiAgICBvcHRpb25zID0gcE9wdGlvbnMgfHwge307XG4gIH0gZWxzZSB7XG4gICAgc291cmNlID0gdHJ1ZTtcbiAgICBmZXRjaGVyID0gcFNvdXJjZTtcbiAgICBvcHRpb25zID0gcEZldGNoZXIgfHwge307XG4gIH1cbiAgbGV0IHByID0gbnVsbCxcbiAgICBpbml0UCA9IE5PX0lOSVQsXG4gICAgaWQgPSBudWxsLFxuICAgIGxvYWRlZFVuZGVyVHJhbnNpdGlvbiA9IGZhbHNlLFxuICAgIHNjaGVkdWxlZCA9IGZhbHNlLFxuICAgIHJlc29sdmVkID0gXCJpbml0aWFsVmFsdWVcIiBpbiBvcHRpb25zLFxuICAgIGR5bmFtaWMgPSB0eXBlb2Ygc291cmNlID09PSBcImZ1bmN0aW9uXCIgJiYgY3JlYXRlTWVtbyhzb3VyY2UpO1xuICBjb25zdCBjb250ZXh0cyA9IG5ldyBTZXQoKSxcbiAgICBbdmFsdWUsIHNldFZhbHVlXSA9IChvcHRpb25zLnN0b3JhZ2UgfHwgY3JlYXRlU2lnbmFsKShvcHRpb25zLmluaXRpYWxWYWx1ZSksXG4gICAgW2Vycm9yLCBzZXRFcnJvcl0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkKSxcbiAgICBbdHJhY2ssIHRyaWdnZXJdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCwge1xuICAgICAgZXF1YWxzOiBmYWxzZVxuICAgIH0pLFxuICAgIFtzdGF0ZSwgc2V0U3RhdGVdID0gY3JlYXRlU2lnbmFsKHJlc29sdmVkID8gXCJyZWFkeVwiIDogXCJ1bnJlc29sdmVkXCIpO1xuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQpIHtcbiAgICBpZCA9IHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCk7XG4gICAgaWYgKG9wdGlvbnMuc3NyTG9hZEZyb20gPT09IFwiaW5pdGlhbFwiKSBpbml0UCA9IG9wdGlvbnMuaW5pdGlhbFZhbHVlO2Vsc2UgaWYgKHNoYXJlZENvbmZpZy5sb2FkICYmIHNoYXJlZENvbmZpZy5oYXMoaWQpKSBpbml0UCA9IHNoYXJlZENvbmZpZy5sb2FkKGlkKTtcbiAgfVxuICBmdW5jdGlvbiBsb2FkRW5kKHAsIHYsIGVycm9yLCBrZXkpIHtcbiAgICBpZiAocHIgPT09IHApIHtcbiAgICAgIHByID0gbnVsbDtcbiAgICAgIGtleSAhPT0gdW5kZWZpbmVkICYmIChyZXNvbHZlZCA9IHRydWUpO1xuICAgICAgaWYgKChwID09PSBpbml0UCB8fCB2ID09PSBpbml0UCkgJiYgb3B0aW9ucy5vbkh5ZHJhdGVkKSBxdWV1ZU1pY3JvdGFzaygoKSA9PiBvcHRpb25zLm9uSHlkcmF0ZWQoa2V5LCB7XG4gICAgICAgIHZhbHVlOiB2XG4gICAgICB9KSk7XG4gICAgICBpbml0UCA9IE5PX0lOSVQ7XG4gICAgICBpZiAoVHJhbnNpdGlvbiAmJiBwICYmIGxvYWRlZFVuZGVyVHJhbnNpdGlvbikge1xuICAgICAgICBUcmFuc2l0aW9uLnByb21pc2VzLmRlbGV0ZShwKTtcbiAgICAgICAgbG9hZGVkVW5kZXJUcmFuc2l0aW9uID0gZmFsc2U7XG4gICAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICAgIFRyYW5zaXRpb24ucnVubmluZyA9IHRydWU7XG4gICAgICAgICAgY29tcGxldGVMb2FkKHYsIGVycm9yKTtcbiAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgfSBlbHNlIGNvbXBsZXRlTG9hZCh2LCBlcnJvcik7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG4gIGZ1bmN0aW9uIGNvbXBsZXRlTG9hZCh2LCBlcnIpIHtcbiAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgIGlmIChlcnIgPT09IHVuZGVmaW5lZCkgc2V0VmFsdWUoKCkgPT4gdik7XG4gICAgICBzZXRTdGF0ZShlcnIgIT09IHVuZGVmaW5lZCA/IFwiZXJyb3JlZFwiIDogcmVzb2x2ZWQgPyBcInJlYWR5XCIgOiBcInVucmVzb2x2ZWRcIik7XG4gICAgICBzZXRFcnJvcihlcnIpO1xuICAgICAgZm9yIChjb25zdCBjIG9mIGNvbnRleHRzLmtleXMoKSkgYy5kZWNyZW1lbnQoKTtcbiAgICAgIGNvbnRleHRzLmNsZWFyKCk7XG4gICAgfSwgZmFsc2UpO1xuICB9XG4gIGZ1bmN0aW9uIHJlYWQoKSB7XG4gICAgY29uc3QgYyA9IFN1c3BlbnNlQ29udGV4dCAmJiB1c2VDb250ZXh0KFN1c3BlbnNlQ29udGV4dCksXG4gICAgICB2ID0gdmFsdWUoKSxcbiAgICAgIGVyciA9IGVycm9yKCk7XG4gICAgaWYgKGVyciAhPT0gdW5kZWZpbmVkICYmICFwcikgdGhyb3cgZXJyO1xuICAgIGlmIChMaXN0ZW5lciAmJiAhTGlzdGVuZXIudXNlciAmJiBjKSB7XG4gICAgICBjcmVhdGVDb21wdXRlZCgoKSA9PiB7XG4gICAgICAgIHRyYWNrKCk7XG4gICAgICAgIGlmIChwcikge1xuICAgICAgICAgIGlmIChjLnJlc29sdmVkICYmIFRyYW5zaXRpb24gJiYgbG9hZGVkVW5kZXJUcmFuc2l0aW9uKSBUcmFuc2l0aW9uLnByb21pc2VzLmFkZChwcik7ZWxzZSBpZiAoIWNvbnRleHRzLmhhcyhjKSkge1xuICAgICAgICAgICAgYy5pbmNyZW1lbnQoKTtcbiAgICAgICAgICAgIGNvbnRleHRzLmFkZChjKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuICBmdW5jdGlvbiBsb2FkKHJlZmV0Y2hpbmcgPSB0cnVlKSB7XG4gICAgaWYgKHJlZmV0Y2hpbmcgIT09IGZhbHNlICYmIHNjaGVkdWxlZCkgcmV0dXJuO1xuICAgIHNjaGVkdWxlZCA9IGZhbHNlO1xuICAgIGNvbnN0IGxvb2t1cCA9IGR5bmFtaWMgPyBkeW5hbWljKCkgOiBzb3VyY2U7XG4gICAgbG9hZGVkVW5kZXJUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gICAgaWYgKGxvb2t1cCA9PSBudWxsIHx8IGxvb2t1cCA9PT0gZmFsc2UpIHtcbiAgICAgIGxvYWRFbmQocHIsIHVudHJhY2sodmFsdWUpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKFRyYW5zaXRpb24gJiYgcHIpIFRyYW5zaXRpb24ucHJvbWlzZXMuZGVsZXRlKHByKTtcbiAgICBsZXQgZXJyb3I7XG4gICAgY29uc3QgcCA9IGluaXRQICE9PSBOT19JTklUID8gaW5pdFAgOiB1bnRyYWNrKCgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBmZXRjaGVyKGxvb2t1cCwge1xuICAgICAgICAgIHZhbHVlOiB2YWx1ZSgpLFxuICAgICAgICAgIHJlZmV0Y2hpbmdcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoIChmZXRjaGVyRXJyb3IpIHtcbiAgICAgICAgZXJyb3IgPSBmZXRjaGVyRXJyb3I7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKGVycm9yICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxvYWRFbmQocHIsIHVuZGVmaW5lZCwgY2FzdEVycm9yKGVycm9yKSwgbG9va3VwKTtcbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKCFpc1Byb21pc2UocCkpIHtcbiAgICAgIGxvYWRFbmQocHIsIHAsIHVuZGVmaW5lZCwgbG9va3VwKTtcbiAgICAgIHJldHVybiBwO1xuICAgIH1cbiAgICBwciA9IHA7XG4gICAgaWYgKFwidlwiIGluIHApIHtcbiAgICAgIGlmIChwLnMgPT09IDEpIGxvYWRFbmQocHIsIHAudiwgdW5kZWZpbmVkLCBsb29rdXApO2Vsc2UgbG9hZEVuZChwciwgdW5kZWZpbmVkLCBjYXN0RXJyb3IocC52KSwgbG9va3VwKTtcbiAgICAgIHJldHVybiBwO1xuICAgIH1cbiAgICBzY2hlZHVsZWQgPSB0cnVlO1xuICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHNjaGVkdWxlZCA9IGZhbHNlKTtcbiAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgIHNldFN0YXRlKHJlc29sdmVkID8gXCJyZWZyZXNoaW5nXCIgOiBcInBlbmRpbmdcIik7XG4gICAgICB0cmlnZ2VyKCk7XG4gICAgfSwgZmFsc2UpO1xuICAgIHJldHVybiBwLnRoZW4odiA9PiBsb2FkRW5kKHAsIHYsIHVuZGVmaW5lZCwgbG9va3VwKSwgZSA9PiBsb2FkRW5kKHAsIHVuZGVmaW5lZCwgY2FzdEVycm9yKGUpLCBsb29rdXApKTtcbiAgfVxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhyZWFkLCB7XG4gICAgc3RhdGU6IHtcbiAgICAgIGdldDogKCkgPT4gc3RhdGUoKVxuICAgIH0sXG4gICAgZXJyb3I6IHtcbiAgICAgIGdldDogKCkgPT4gZXJyb3IoKVxuICAgIH0sXG4gICAgbG9hZGluZzoge1xuICAgICAgZ2V0KCkge1xuICAgICAgICBjb25zdCBzID0gc3RhdGUoKTtcbiAgICAgICAgcmV0dXJuIHMgPT09IFwicGVuZGluZ1wiIHx8IHMgPT09IFwicmVmcmVzaGluZ1wiO1xuICAgICAgfVxuICAgIH0sXG4gICAgbGF0ZXN0OiB7XG4gICAgICBnZXQoKSB7XG4gICAgICAgIGlmICghcmVzb2x2ZWQpIHJldHVybiByZWFkKCk7XG4gICAgICAgIGNvbnN0IGVyciA9IGVycm9yKCk7XG4gICAgICAgIGlmIChlcnIgJiYgIXByKSB0aHJvdyBlcnI7XG4gICAgICAgIHJldHVybiB2YWx1ZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG4gIGxldCBvd25lciA9IE93bmVyO1xuICBpZiAoZHluYW1pYykgY3JlYXRlQ29tcHV0ZWQoKCkgPT4gKG93bmVyID0gT3duZXIsIGxvYWQoZmFsc2UpKSk7ZWxzZSBsb2FkKGZhbHNlKTtcbiAgcmV0dXJuIFtyZWFkLCB7XG4gICAgcmVmZXRjaDogaW5mbyA9PiBydW5XaXRoT3duZXIob3duZXIsICgpID0+IGxvYWQoaW5mbykpLFxuICAgIG11dGF0ZTogc2V0VmFsdWVcbiAgfV07XG59XG5mdW5jdGlvbiBjcmVhdGVEZWZlcnJlZChzb3VyY2UsIG9wdGlvbnMpIHtcbiAgbGV0IHQsXG4gICAgdGltZW91dCA9IG9wdGlvbnMgPyBvcHRpb25zLnRpbWVvdXRNcyA6IHVuZGVmaW5lZDtcbiAgY29uc3Qgbm9kZSA9IGNyZWF0ZUNvbXB1dGF0aW9uKCgpID0+IHtcbiAgICBpZiAoIXQgfHwgIXQuZm4pIHQgPSByZXF1ZXN0Q2FsbGJhY2soKCkgPT4gc2V0RGVmZXJyZWQoKCkgPT4gbm9kZS52YWx1ZSksIHRpbWVvdXQgIT09IHVuZGVmaW5lZCA/IHtcbiAgICAgIHRpbWVvdXRcbiAgICB9IDogdW5kZWZpbmVkKTtcbiAgICByZXR1cm4gc291cmNlKCk7XG4gIH0sIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIGNvbnN0IFtkZWZlcnJlZCwgc2V0RGVmZXJyZWRdID0gY3JlYXRlU2lnbmFsKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUsIG9wdGlvbnMpO1xuICB1cGRhdGVDb21wdXRhdGlvbihub2RlKTtcbiAgc2V0RGVmZXJyZWQoKCkgPT4gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSk7XG4gIHJldHVybiBkZWZlcnJlZDtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVNlbGVjdG9yKHNvdXJjZSwgZm4gPSBlcXVhbEZuLCBvcHRpb25zKSB7XG4gIGNvbnN0IHN1YnMgPSBuZXcgTWFwKCk7XG4gIGNvbnN0IG5vZGUgPSBjcmVhdGVDb21wdXRhdGlvbihwID0+IHtcbiAgICBjb25zdCB2ID0gc291cmNlKCk7XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWxdIG9mIHN1YnMuZW50cmllcygpKSBpZiAoZm4oa2V5LCB2KSAhPT0gZm4oa2V5LCBwKSkge1xuICAgICAgZm9yIChjb25zdCBjIG9mIHZhbC52YWx1ZXMoKSkge1xuICAgICAgICBjLnN0YXRlID0gU1RBTEU7XG4gICAgICAgIGlmIChjLnB1cmUpIFVwZGF0ZXMucHVzaChjKTtlbHNlIEVmZmVjdHMucHVzaChjKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH0sIHVuZGVmaW5lZCwgdHJ1ZSwgU1RBTEUsIG9wdGlvbnMgKTtcbiAgdXBkYXRlQ29tcHV0YXRpb24obm9kZSk7XG4gIHJldHVybiBrZXkgPT4ge1xuICAgIGNvbnN0IGxpc3RlbmVyID0gTGlzdGVuZXI7XG4gICAgaWYgKGxpc3RlbmVyKSB7XG4gICAgICBsZXQgbDtcbiAgICAgIGlmIChsID0gc3Vicy5nZXQoa2V5KSkgbC5hZGQobGlzdGVuZXIpO2Vsc2Ugc3Vicy5zZXQoa2V5LCBsID0gbmV3IFNldChbbGlzdGVuZXJdKSk7XG4gICAgICBvbkNsZWFudXAoKCkgPT4ge1xuICAgICAgICBsLmRlbGV0ZShsaXN0ZW5lcik7XG4gICAgICAgICFsLnNpemUgJiYgc3Vicy5kZWxldGUoa2V5KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gZm4oa2V5LCBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlKTtcbiAgfTtcbn1cbmZ1bmN0aW9uIGJhdGNoKGZuKSB7XG4gIHJldHVybiBydW5VcGRhdGVzKGZuLCBmYWxzZSk7XG59XG5mdW5jdGlvbiB1bnRyYWNrKGZuKSB7XG4gIGlmICghRXh0ZXJuYWxTb3VyY2VDb25maWcgJiYgTGlzdGVuZXIgPT09IG51bGwpIHJldHVybiBmbigpO1xuICBjb25zdCBsaXN0ZW5lciA9IExpc3RlbmVyO1xuICBMaXN0ZW5lciA9IG51bGw7XG4gIHRyeSB7XG4gICAgaWYgKEV4dGVybmFsU291cmNlQ29uZmlnKSByZXR1cm4gRXh0ZXJuYWxTb3VyY2VDb25maWcudW50cmFjayhmbik7XG4gICAgcmV0dXJuIGZuKCk7XG4gIH0gZmluYWxseSB7XG4gICAgTGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgfVxufVxuZnVuY3Rpb24gb24oZGVwcywgZm4sIG9wdGlvbnMpIHtcbiAgY29uc3QgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkoZGVwcyk7XG4gIGxldCBwcmV2SW5wdXQ7XG4gIGxldCBkZWZlciA9IG9wdGlvbnMgJiYgb3B0aW9ucy5kZWZlcjtcbiAgcmV0dXJuIHByZXZWYWx1ZSA9PiB7XG4gICAgbGV0IGlucHV0O1xuICAgIGlmIChpc0FycmF5KSB7XG4gICAgICBpbnB1dCA9IEFycmF5KGRlcHMubGVuZ3RoKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGVwcy5sZW5ndGg7IGkrKykgaW5wdXRbaV0gPSBkZXBzW2ldKCk7XG4gICAgfSBlbHNlIGlucHV0ID0gZGVwcygpO1xuICAgIGlmIChkZWZlcikge1xuICAgICAgZGVmZXIgPSBmYWxzZTtcbiAgICAgIHJldHVybiBwcmV2VmFsdWU7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IHVudHJhY2soKCkgPT4gZm4oaW5wdXQsIHByZXZJbnB1dCwgcHJldlZhbHVlKSk7XG4gICAgcHJldklucHV0ID0gaW5wdXQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcbn1cbmZ1bmN0aW9uIG9uTW91bnQoZm4pIHtcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHVudHJhY2soZm4pKTtcbn1cbmZ1bmN0aW9uIG9uQ2xlYW51cChmbikge1xuICBpZiAoT3duZXIgPT09IG51bGwpIGNvbnNvbGUud2FybihcImNsZWFudXBzIGNyZWF0ZWQgb3V0c2lkZSBhIGBjcmVhdGVSb290YCBvciBgcmVuZGVyYCB3aWxsIG5ldmVyIGJlIHJ1blwiKTtlbHNlIGlmIChPd25lci5jbGVhbnVwcyA9PT0gbnVsbCkgT3duZXIuY2xlYW51cHMgPSBbZm5dO2Vsc2UgT3duZXIuY2xlYW51cHMucHVzaChmbik7XG4gIHJldHVybiBmbjtcbn1cbmZ1bmN0aW9uIGNhdGNoRXJyb3IoZm4sIGhhbmRsZXIpIHtcbiAgRVJST1IgfHwgKEVSUk9SID0gU3ltYm9sKFwiZXJyb3JcIikpO1xuICBPd25lciA9IGNyZWF0ZUNvbXB1dGF0aW9uKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgT3duZXIuY29udGV4dCA9IHtcbiAgICAuLi5Pd25lci5jb250ZXh0LFxuICAgIFtFUlJPUl06IFtoYW5kbGVyXVxuICB9O1xuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIFRyYW5zaXRpb24uc291cmNlcy5hZGQoT3duZXIpO1xuICB0cnkge1xuICAgIHJldHVybiBmbigpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBoYW5kbGVFcnJvcihlcnIpO1xuICB9IGZpbmFsbHkge1xuICAgIE93bmVyID0gT3duZXIub3duZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIGdldExpc3RlbmVyKCkge1xuICByZXR1cm4gTGlzdGVuZXI7XG59XG5mdW5jdGlvbiBnZXRPd25lcigpIHtcbiAgcmV0dXJuIE93bmVyO1xufVxuZnVuY3Rpb24gcnVuV2l0aE93bmVyKG8sIGZuKSB7XG4gIGNvbnN0IHByZXYgPSBPd25lcjtcbiAgY29uc3QgcHJldkxpc3RlbmVyID0gTGlzdGVuZXI7XG4gIE93bmVyID0gbztcbiAgTGlzdGVuZXIgPSBudWxsO1xuICB0cnkge1xuICAgIHJldHVybiBydW5VcGRhdGVzKGZuLCB0cnVlKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaGFuZGxlRXJyb3IoZXJyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBPd25lciA9IHByZXY7XG4gICAgTGlzdGVuZXIgPSBwcmV2TGlzdGVuZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIGVuYWJsZVNjaGVkdWxpbmcoc2NoZWR1bGVyID0gcmVxdWVzdENhbGxiYWNrKSB7XG4gIFNjaGVkdWxlciA9IHNjaGVkdWxlcjtcbn1cbmZ1bmN0aW9uIHN0YXJ0VHJhbnNpdGlvbihmbikge1xuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICBmbigpO1xuICAgIHJldHVybiBUcmFuc2l0aW9uLmRvbmU7XG4gIH1cbiAgY29uc3QgbCA9IExpc3RlbmVyO1xuICBjb25zdCBvID0gT3duZXI7XG4gIHJldHVybiBQcm9taXNlLnJlc29sdmUoKS50aGVuKCgpID0+IHtcbiAgICBMaXN0ZW5lciA9IGw7XG4gICAgT3duZXIgPSBvO1xuICAgIGxldCB0O1xuICAgIGlmIChTY2hlZHVsZXIgfHwgU3VzcGVuc2VDb250ZXh0KSB7XG4gICAgICB0ID0gVHJhbnNpdGlvbiB8fCAoVHJhbnNpdGlvbiA9IHtcbiAgICAgICAgc291cmNlczogbmV3IFNldCgpLFxuICAgICAgICBlZmZlY3RzOiBbXSxcbiAgICAgICAgcHJvbWlzZXM6IG5ldyBTZXQoKSxcbiAgICAgICAgZGlzcG9zZWQ6IG5ldyBTZXQoKSxcbiAgICAgICAgcXVldWU6IG5ldyBTZXQoKSxcbiAgICAgICAgcnVubmluZzogdHJ1ZVxuICAgICAgfSk7XG4gICAgICB0LmRvbmUgfHwgKHQuZG9uZSA9IG5ldyBQcm9taXNlKHJlcyA9PiB0LnJlc29sdmUgPSByZXMpKTtcbiAgICAgIHQucnVubmluZyA9IHRydWU7XG4gICAgfVxuICAgIHJ1blVwZGF0ZXMoZm4sIGZhbHNlKTtcbiAgICBMaXN0ZW5lciA9IE93bmVyID0gbnVsbDtcbiAgICByZXR1cm4gdCA/IHQuZG9uZSA6IHVuZGVmaW5lZDtcbiAgfSk7XG59XG5jb25zdCBbdHJhbnNQZW5kaW5nLCBzZXRUcmFuc1BlbmRpbmddID0gLypAX19QVVJFX18qL2NyZWF0ZVNpZ25hbChmYWxzZSk7XG5mdW5jdGlvbiB1c2VUcmFuc2l0aW9uKCkge1xuICByZXR1cm4gW3RyYW5zUGVuZGluZywgc3RhcnRUcmFuc2l0aW9uXTtcbn1cbmZ1bmN0aW9uIHJlc3VtZUVmZmVjdHMoZSkge1xuICBFZmZlY3RzLnB1c2guYXBwbHkoRWZmZWN0cywgZSk7XG4gIGUubGVuZ3RoID0gMDtcbn1cbmZ1bmN0aW9uIGRldkNvbXBvbmVudChDb21wLCBwcm9wcykge1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oKCkgPT4gdW50cmFjaygoKSA9PiB7XG4gICAgT2JqZWN0LmFzc2lnbihDb21wLCB7XG4gICAgICBbJERFVkNPTVBdOiB0cnVlXG4gICAgfSk7XG4gICAgcmV0dXJuIENvbXAocHJvcHMpO1xuICB9KSwgdW5kZWZpbmVkLCB0cnVlLCAwKTtcbiAgYy5wcm9wcyA9IHByb3BzO1xuICBjLm9ic2VydmVycyA9IG51bGw7XG4gIGMub2JzZXJ2ZXJTbG90cyA9IG51bGw7XG4gIGMubmFtZSA9IENvbXAubmFtZTtcbiAgYy5jb21wb25lbnQgPSBDb21wO1xuICB1cGRhdGVDb21wdXRhdGlvbihjKTtcbiAgcmV0dXJuIGMudFZhbHVlICE9PSB1bmRlZmluZWQgPyBjLnRWYWx1ZSA6IGMudmFsdWU7XG59XG5mdW5jdGlvbiByZWdpc3RlckdyYXBoKHZhbHVlKSB7XG4gIGlmIChPd25lcikge1xuICAgIGlmIChPd25lci5zb3VyY2VNYXApIE93bmVyLnNvdXJjZU1hcC5wdXNoKHZhbHVlKTtlbHNlIE93bmVyLnNvdXJjZU1hcCA9IFt2YWx1ZV07XG4gICAgdmFsdWUuZ3JhcGggPSBPd25lcjtcbiAgfVxuICBpZiAoRGV2SG9va3MuYWZ0ZXJSZWdpc3RlckdyYXBoKSBEZXZIb29rcy5hZnRlclJlZ2lzdGVyR3JhcGgodmFsdWUpO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29udGV4dChkZWZhdWx0VmFsdWUsIG9wdGlvbnMpIHtcbiAgY29uc3QgaWQgPSBTeW1ib2woXCJjb250ZXh0XCIpO1xuICByZXR1cm4ge1xuICAgIGlkLFxuICAgIFByb3ZpZGVyOiBjcmVhdGVQcm92aWRlcihpZCwgb3B0aW9ucyksXG4gICAgZGVmYXVsdFZhbHVlXG4gIH07XG59XG5mdW5jdGlvbiB1c2VDb250ZXh0KGNvbnRleHQpIHtcbiAgbGV0IHZhbHVlO1xuICByZXR1cm4gT3duZXIgJiYgT3duZXIuY29udGV4dCAmJiAodmFsdWUgPSBPd25lci5jb250ZXh0W2NvbnRleHQuaWRdKSAhPT0gdW5kZWZpbmVkID8gdmFsdWUgOiBjb250ZXh0LmRlZmF1bHRWYWx1ZTtcbn1cbmZ1bmN0aW9uIGNoaWxkcmVuKGZuKSB7XG4gIGNvbnN0IGNoaWxkcmVuID0gY3JlYXRlTWVtbyhmbik7XG4gIGNvbnN0IG1lbW8gPSBjcmVhdGVNZW1vKCgpID0+IHJlc29sdmVDaGlsZHJlbihjaGlsZHJlbigpKSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJjaGlsZHJlblwiXG4gIH0pIDtcbiAgbWVtby50b0FycmF5ID0gKCkgPT4ge1xuICAgIGNvbnN0IGMgPSBtZW1vKCk7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYykgPyBjIDogYyAhPSBudWxsID8gW2NdIDogW107XG4gIH07XG4gIHJldHVybiBtZW1vO1xufVxubGV0IFN1c3BlbnNlQ29udGV4dDtcbmZ1bmN0aW9uIGdldFN1c3BlbnNlQ29udGV4dCgpIHtcbiAgcmV0dXJuIFN1c3BlbnNlQ29udGV4dCB8fCAoU3VzcGVuc2VDb250ZXh0ID0gY3JlYXRlQ29udGV4dCgpKTtcbn1cbmZ1bmN0aW9uIGVuYWJsZUV4dGVybmFsU291cmNlKGZhY3RvcnksIHVudHJhY2sgPSBmbiA9PiBmbigpKSB7XG4gIGlmIChFeHRlcm5hbFNvdXJjZUNvbmZpZykge1xuICAgIGNvbnN0IHtcbiAgICAgIGZhY3Rvcnk6IG9sZEZhY3RvcnksXG4gICAgICB1bnRyYWNrOiBvbGRVbnRyYWNrXG4gICAgfSA9IEV4dGVybmFsU291cmNlQ29uZmlnO1xuICAgIEV4dGVybmFsU291cmNlQ29uZmlnID0ge1xuICAgICAgZmFjdG9yeTogKGZuLCB0cmlnZ2VyKSA9PiB7XG4gICAgICAgIGNvbnN0IG9sZFNvdXJjZSA9IG9sZEZhY3RvcnkoZm4sIHRyaWdnZXIpO1xuICAgICAgICBjb25zdCBzb3VyY2UgPSBmYWN0b3J5KHggPT4gb2xkU291cmNlLnRyYWNrKHgpLCB0cmlnZ2VyKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0cmFjazogeCA9PiBzb3VyY2UudHJhY2soeCksXG4gICAgICAgICAgZGlzcG9zZSgpIHtcbiAgICAgICAgICAgIHNvdXJjZS5kaXNwb3NlKCk7XG4gICAgICAgICAgICBvbGRTb3VyY2UuZGlzcG9zZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICB1bnRyYWNrOiBmbiA9PiBvbGRVbnRyYWNrKCgpID0+IHVudHJhY2soZm4pKVxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgRXh0ZXJuYWxTb3VyY2VDb25maWcgPSB7XG4gICAgICBmYWN0b3J5LFxuICAgICAgdW50cmFja1xuICAgIH07XG4gIH1cbn1cbmZ1bmN0aW9uIHJlYWRTaWduYWwoKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGlmICh0aGlzLnNvdXJjZXMgJiYgKHJ1bm5pbmdUcmFuc2l0aW9uID8gdGhpcy50U3RhdGUgOiB0aGlzLnN0YXRlKSkge1xuICAgIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyB0aGlzLnRTdGF0ZSA6IHRoaXMuc3RhdGUpID09PSBTVEFMRSkgdXBkYXRlQ29tcHV0YXRpb24odGhpcyk7ZWxzZSB7XG4gICAgICBjb25zdCB1cGRhdGVzID0gVXBkYXRlcztcbiAgICAgIFVwZGF0ZXMgPSBudWxsO1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiBsb29rVXBzdHJlYW0odGhpcyksIGZhbHNlKTtcbiAgICAgIFVwZGF0ZXMgPSB1cGRhdGVzO1xuICAgIH1cbiAgfVxuICBpZiAoTGlzdGVuZXIpIHtcbiAgICBjb25zdCBzU2xvdCA9IHRoaXMub2JzZXJ2ZXJzID8gdGhpcy5vYnNlcnZlcnMubGVuZ3RoIDogMDtcbiAgICBpZiAoIUxpc3RlbmVyLnNvdXJjZXMpIHtcbiAgICAgIExpc3RlbmVyLnNvdXJjZXMgPSBbdGhpc107XG4gICAgICBMaXN0ZW5lci5zb3VyY2VTbG90cyA9IFtzU2xvdF07XG4gICAgfSBlbHNlIHtcbiAgICAgIExpc3RlbmVyLnNvdXJjZXMucHVzaCh0aGlzKTtcbiAgICAgIExpc3RlbmVyLnNvdXJjZVNsb3RzLnB1c2goc1Nsb3QpO1xuICAgIH1cbiAgICBpZiAoIXRoaXMub2JzZXJ2ZXJzKSB7XG4gICAgICB0aGlzLm9ic2VydmVycyA9IFtMaXN0ZW5lcl07XG4gICAgICB0aGlzLm9ic2VydmVyU2xvdHMgPSBbTGlzdGVuZXIuc291cmNlcy5sZW5ndGggLSAxXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vYnNlcnZlcnMucHVzaChMaXN0ZW5lcik7XG4gICAgICB0aGlzLm9ic2VydmVyU2xvdHMucHVzaChMaXN0ZW5lci5zb3VyY2VzLmxlbmd0aCAtIDEpO1xuICAgIH1cbiAgfVxuICBpZiAocnVubmluZ1RyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyh0aGlzKSkgcmV0dXJuIHRoaXMudFZhbHVlO1xuICByZXR1cm4gdGhpcy52YWx1ZTtcbn1cbmZ1bmN0aW9uIHdyaXRlU2lnbmFsKG5vZGUsIHZhbHVlLCBpc0NvbXApIHtcbiAgbGV0IGN1cnJlbnQgPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlO1xuICBpZiAoIW5vZGUuY29tcGFyYXRvciB8fCAhbm9kZS5jb21wYXJhdG9yKGN1cnJlbnQsIHZhbHVlKSkge1xuICAgIGlmIChUcmFuc2l0aW9uKSB7XG4gICAgICBjb25zdCBUcmFuc2l0aW9uUnVubmluZyA9IFRyYW5zaXRpb24ucnVubmluZztcbiAgICAgIGlmIChUcmFuc2l0aW9uUnVubmluZyB8fCAhaXNDb21wICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkpIHtcbiAgICAgICAgVHJhbnNpdGlvbi5zb3VyY2VzLmFkZChub2RlKTtcbiAgICAgICAgbm9kZS50VmFsdWUgPSB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIGlmICghVHJhbnNpdGlvblJ1bm5pbmcpIG5vZGUudmFsdWUgPSB2YWx1ZTtcbiAgICB9IGVsc2Ugbm9kZS52YWx1ZSA9IHZhbHVlO1xuICAgIGlmIChub2RlLm9ic2VydmVycyAmJiBub2RlLm9ic2VydmVycy5sZW5ndGgpIHtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUub2JzZXJ2ZXJzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgY29uc3QgbyA9IG5vZGUub2JzZXJ2ZXJzW2ldO1xuICAgICAgICAgIGNvbnN0IFRyYW5zaXRpb25SdW5uaW5nID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gICAgICAgICAgaWYgKFRyYW5zaXRpb25SdW5uaW5nICYmIFRyYW5zaXRpb24uZGlzcG9zZWQuaGFzKG8pKSBjb250aW51ZTtcbiAgICAgICAgICBpZiAoVHJhbnNpdGlvblJ1bm5pbmcgPyAhby50U3RhdGUgOiAhby5zdGF0ZSkge1xuICAgICAgICAgICAgaWYgKG8ucHVyZSkgVXBkYXRlcy5wdXNoKG8pO2Vsc2UgRWZmZWN0cy5wdXNoKG8pO1xuICAgICAgICAgICAgaWYgKG8ub2JzZXJ2ZXJzKSBtYXJrRG93bnN0cmVhbShvKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFUcmFuc2l0aW9uUnVubmluZykgby5zdGF0ZSA9IFNUQUxFO2Vsc2Ugby50U3RhdGUgPSBTVEFMRTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoVXBkYXRlcy5sZW5ndGggPiAxMGU1KSB7XG4gICAgICAgICAgVXBkYXRlcyA9IFtdO1xuICAgICAgICAgIGlmIChJU19ERVYpIHRocm93IG5ldyBFcnJvcihcIlBvdGVudGlhbCBJbmZpbml0ZSBMb29wIERldGVjdGVkLlwiKTtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgfSwgZmFsc2UpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5mdW5jdGlvbiB1cGRhdGVDb21wdXRhdGlvbihub2RlKSB7XG4gIGlmICghbm9kZS5mbikgcmV0dXJuO1xuICBjbGVhbk5vZGUobm9kZSk7XG4gIGNvbnN0IHRpbWUgPSBFeGVjQ291bnQ7XG4gIHJ1bkNvbXB1dGF0aW9uKG5vZGUsIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUsIHRpbWUpO1xuICBpZiAoVHJhbnNpdGlvbiAmJiAhVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkpIHtcbiAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgVHJhbnNpdGlvbiAmJiAoVHJhbnNpdGlvbi5ydW5uaW5nID0gdHJ1ZSk7XG4gICAgICAgIExpc3RlbmVyID0gT3duZXIgPSBub2RlO1xuICAgICAgICBydW5Db21wdXRhdGlvbihub2RlLCBub2RlLnRWYWx1ZSwgdGltZSk7XG4gICAgICAgIExpc3RlbmVyID0gT3duZXIgPSBudWxsO1xuICAgICAgfSwgZmFsc2UpO1xuICAgIH0pO1xuICB9XG59XG5mdW5jdGlvbiBydW5Db21wdXRhdGlvbihub2RlLCB2YWx1ZSwgdGltZSkge1xuICBsZXQgbmV4dFZhbHVlO1xuICBjb25zdCBvd25lciA9IE93bmVyLFxuICAgIGxpc3RlbmVyID0gTGlzdGVuZXI7XG4gIExpc3RlbmVyID0gT3duZXIgPSBub2RlO1xuICB0cnkge1xuICAgIG5leHRWYWx1ZSA9IG5vZGUuZm4odmFsdWUpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAobm9kZS5wdXJlKSB7XG4gICAgICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICAgICAgbm9kZS50U3RhdGUgPSBTVEFMRTtcbiAgICAgICAgbm9kZS50T3duZWQgJiYgbm9kZS50T3duZWQuZm9yRWFjaChjbGVhbk5vZGUpO1xuICAgICAgICBub2RlLnRPd25lZCA9IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5vZGUuc3RhdGUgPSBTVEFMRTtcbiAgICAgICAgbm9kZS5vd25lZCAmJiBub2RlLm93bmVkLmZvckVhY2goY2xlYW5Ob2RlKTtcbiAgICAgICAgbm9kZS5vd25lZCA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIG5vZGUudXBkYXRlZEF0ID0gdGltZSArIDE7XG4gICAgcmV0dXJuIGhhbmRsZUVycm9yKGVycik7XG4gIH0gZmluYWxseSB7XG4gICAgTGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgICBPd25lciA9IG93bmVyO1xuICB9XG4gIGlmICghbm9kZS51cGRhdGVkQXQgfHwgbm9kZS51cGRhdGVkQXQgPD0gdGltZSkge1xuICAgIGlmIChub2RlLnVwZGF0ZWRBdCAhPSBudWxsICYmIFwib2JzZXJ2ZXJzXCIgaW4gbm9kZSkge1xuICAgICAgd3JpdGVTaWduYWwobm9kZSwgbmV4dFZhbHVlLCB0cnVlKTtcbiAgICB9IGVsc2UgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIG5vZGUucHVyZSkge1xuICAgICAgVHJhbnNpdGlvbi5zb3VyY2VzLmFkZChub2RlKTtcbiAgICAgIG5vZGUudFZhbHVlID0gbmV4dFZhbHVlO1xuICAgIH0gZWxzZSBub2RlLnZhbHVlID0gbmV4dFZhbHVlO1xuICAgIG5vZGUudXBkYXRlZEF0ID0gdGltZTtcbiAgfVxufVxuZnVuY3Rpb24gY3JlYXRlQ29tcHV0YXRpb24oZm4sIGluaXQsIHB1cmUsIHN0YXRlID0gU1RBTEUsIG9wdGlvbnMpIHtcbiAgY29uc3QgYyA9IHtcbiAgICBmbixcbiAgICBzdGF0ZTogc3RhdGUsXG4gICAgdXBkYXRlZEF0OiBudWxsLFxuICAgIG93bmVkOiBudWxsLFxuICAgIHNvdXJjZXM6IG51bGwsXG4gICAgc291cmNlU2xvdHM6IG51bGwsXG4gICAgY2xlYW51cHM6IG51bGwsXG4gICAgdmFsdWU6IGluaXQsXG4gICAgb3duZXI6IE93bmVyLFxuICAgIGNvbnRleHQ6IE93bmVyID8gT3duZXIuY29udGV4dCA6IG51bGwsXG4gICAgcHVyZVxuICB9O1xuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICBjLnN0YXRlID0gMDtcbiAgICBjLnRTdGF0ZSA9IHN0YXRlO1xuICB9XG4gIGlmIChPd25lciA9PT0gbnVsbCkgY29uc29sZS53YXJuKFwiY29tcHV0YXRpb25zIGNyZWF0ZWQgb3V0c2lkZSBhIGBjcmVhdGVSb290YCBvciBgcmVuZGVyYCB3aWxsIG5ldmVyIGJlIGRpc3Bvc2VkXCIpO2Vsc2UgaWYgKE93bmVyICE9PSBVTk9XTkVEKSB7XG4gICAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIE93bmVyLnB1cmUpIHtcbiAgICAgIGlmICghT3duZXIudE93bmVkKSBPd25lci50T3duZWQgPSBbY107ZWxzZSBPd25lci50T3duZWQucHVzaChjKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFPd25lci5vd25lZCkgT3duZXIub3duZWQgPSBbY107ZWxzZSBPd25lci5vd25lZC5wdXNoKGMpO1xuICAgIH1cbiAgfVxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLm5hbWUpIGMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgaWYgKEV4dGVybmFsU291cmNlQ29uZmlnICYmIGMuZm4pIHtcbiAgICBjb25zdCBbdHJhY2ssIHRyaWdnZXJdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCwge1xuICAgICAgZXF1YWxzOiBmYWxzZVxuICAgIH0pO1xuICAgIGNvbnN0IG9yZGluYXJ5ID0gRXh0ZXJuYWxTb3VyY2VDb25maWcuZmFjdG9yeShjLmZuLCB0cmlnZ2VyKTtcbiAgICBvbkNsZWFudXAoKCkgPT4gb3JkaW5hcnkuZGlzcG9zZSgpKTtcbiAgICBjb25zdCB0cmlnZ2VySW5UcmFuc2l0aW9uID0gKCkgPT4gc3RhcnRUcmFuc2l0aW9uKHRyaWdnZXIpLnRoZW4oKCkgPT4gaW5UcmFuc2l0aW9uLmRpc3Bvc2UoKSk7XG4gICAgY29uc3QgaW5UcmFuc2l0aW9uID0gRXh0ZXJuYWxTb3VyY2VDb25maWcuZmFjdG9yeShjLmZuLCB0cmlnZ2VySW5UcmFuc2l0aW9uKTtcbiAgICBjLmZuID0geCA9PiB7XG4gICAgICB0cmFjaygpO1xuICAgICAgcmV0dXJuIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nID8gaW5UcmFuc2l0aW9uLnRyYWNrKHgpIDogb3JkaW5hcnkudHJhY2soeCk7XG4gICAgfTtcbiAgfVxuICBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyICYmIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIoYyk7XG4gIHJldHVybiBjO1xufVxuZnVuY3Rpb24gcnVuVG9wKG5vZGUpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgPT09IDApIHJldHVybjtcbiAgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgPT09IFBFTkRJTkcpIHJldHVybiBsb29rVXBzdHJlYW0obm9kZSk7XG4gIGlmIChub2RlLnN1c3BlbnNlICYmIHVudHJhY2sobm9kZS5zdXNwZW5zZS5pbkZhbGxiYWNrKSkgcmV0dXJuIG5vZGUuc3VzcGVuc2UuZWZmZWN0cy5wdXNoKG5vZGUpO1xuICBjb25zdCBhbmNlc3RvcnMgPSBbbm9kZV07XG4gIHdoaWxlICgobm9kZSA9IG5vZGUub3duZXIpICYmICghbm9kZS51cGRhdGVkQXQgfHwgbm9kZS51cGRhdGVkQXQgPCBFeGVjQ291bnQpKSB7XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24uZGlzcG9zZWQuaGFzKG5vZGUpKSByZXR1cm47XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSBhbmNlc3RvcnMucHVzaChub2RlKTtcbiAgfVxuICBmb3IgKGxldCBpID0gYW5jZXN0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgbm9kZSA9IGFuY2VzdG9yc1tpXTtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24pIHtcbiAgICAgIGxldCB0b3AgPSBub2RlLFxuICAgICAgICBwcmV2ID0gYW5jZXN0b3JzW2kgKyAxXTtcbiAgICAgIHdoaWxlICgodG9wID0gdG9wLm93bmVyKSAmJiB0b3AgIT09IHByZXYpIHtcbiAgICAgICAgaWYgKFRyYW5zaXRpb24uZGlzcG9zZWQuaGFzKHRvcCkpIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgPT09IFNUQUxFKSB7XG4gICAgICB1cGRhdGVDb21wdXRhdGlvbihub2RlKTtcbiAgICB9IGVsc2UgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgPT09IFBFTkRJTkcpIHtcbiAgICAgIGNvbnN0IHVwZGF0ZXMgPSBVcGRhdGVzO1xuICAgICAgVXBkYXRlcyA9IG51bGw7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IGxvb2tVcHN0cmVhbShub2RlLCBhbmNlc3RvcnNbMF0pLCBmYWxzZSk7XG4gICAgICBVcGRhdGVzID0gdXBkYXRlcztcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIHJ1blVwZGF0ZXMoZm4sIGluaXQpIHtcbiAgaWYgKFVwZGF0ZXMpIHJldHVybiBmbigpO1xuICBsZXQgd2FpdCA9IGZhbHNlO1xuICBpZiAoIWluaXQpIFVwZGF0ZXMgPSBbXTtcbiAgaWYgKEVmZmVjdHMpIHdhaXQgPSB0cnVlO2Vsc2UgRWZmZWN0cyA9IFtdO1xuICBFeGVjQ291bnQrKztcbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBmbigpO1xuICAgIGNvbXBsZXRlVXBkYXRlcyh3YWl0KTtcbiAgICByZXR1cm4gcmVzO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoIXdhaXQpIEVmZmVjdHMgPSBudWxsO1xuICAgIFVwZGF0ZXMgPSBudWxsO1xuICAgIGhhbmRsZUVycm9yKGVycik7XG4gIH1cbn1cbmZ1bmN0aW9uIGNvbXBsZXRlVXBkYXRlcyh3YWl0KSB7XG4gIGlmIChVcGRhdGVzKSB7XG4gICAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgc2NoZWR1bGVRdWV1ZShVcGRhdGVzKTtlbHNlIHJ1blF1ZXVlKFVwZGF0ZXMpO1xuICAgIFVwZGF0ZXMgPSBudWxsO1xuICB9XG4gIGlmICh3YWl0KSByZXR1cm47XG4gIGxldCByZXM7XG4gIGlmIChUcmFuc2l0aW9uKSB7XG4gICAgaWYgKCFUcmFuc2l0aW9uLnByb21pc2VzLnNpemUgJiYgIVRyYW5zaXRpb24ucXVldWUuc2l6ZSkge1xuICAgICAgY29uc3Qgc291cmNlcyA9IFRyYW5zaXRpb24uc291cmNlcztcbiAgICAgIGNvbnN0IGRpc3Bvc2VkID0gVHJhbnNpdGlvbi5kaXNwb3NlZDtcbiAgICAgIEVmZmVjdHMucHVzaC5hcHBseShFZmZlY3RzLCBUcmFuc2l0aW9uLmVmZmVjdHMpO1xuICAgICAgcmVzID0gVHJhbnNpdGlvbi5yZXNvbHZlO1xuICAgICAgZm9yIChjb25zdCBlIG9mIEVmZmVjdHMpIHtcbiAgICAgICAgXCJ0U3RhdGVcIiBpbiBlICYmIChlLnN0YXRlID0gZS50U3RhdGUpO1xuICAgICAgICBkZWxldGUgZS50U3RhdGU7XG4gICAgICB9XG4gICAgICBUcmFuc2l0aW9uID0gbnVsbDtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICBmb3IgKGNvbnN0IGQgb2YgZGlzcG9zZWQpIGNsZWFuTm9kZShkKTtcbiAgICAgICAgZm9yIChjb25zdCB2IG9mIHNvdXJjZXMpIHtcbiAgICAgICAgICB2LnZhbHVlID0gdi50VmFsdWU7XG4gICAgICAgICAgaWYgKHYub3duZWQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB2Lm93bmVkLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSBjbGVhbk5vZGUodi5vd25lZFtpXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh2LnRPd25lZCkgdi5vd25lZCA9IHYudE93bmVkO1xuICAgICAgICAgIGRlbGV0ZSB2LnRWYWx1ZTtcbiAgICAgICAgICBkZWxldGUgdi50T3duZWQ7XG4gICAgICAgICAgdi50U3RhdGUgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHNldFRyYW5zUGVuZGluZyhmYWxzZSk7XG4gICAgICB9LCBmYWxzZSk7XG4gICAgfSBlbHNlIGlmIChUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICAgIFRyYW5zaXRpb24ucnVubmluZyA9IGZhbHNlO1xuICAgICAgVHJhbnNpdGlvbi5lZmZlY3RzLnB1c2guYXBwbHkoVHJhbnNpdGlvbi5lZmZlY3RzLCBFZmZlY3RzKTtcbiAgICAgIEVmZmVjdHMgPSBudWxsO1xuICAgICAgc2V0VHJhbnNQZW5kaW5nKHRydWUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuICBjb25zdCBlID0gRWZmZWN0cztcbiAgRWZmZWN0cyA9IG51bGw7XG4gIGlmIChlLmxlbmd0aCkgcnVuVXBkYXRlcygoKSA9PiBydW5FZmZlY3RzKGUpLCBmYWxzZSk7ZWxzZSBEZXZIb29rcy5hZnRlclVwZGF0ZSAmJiBEZXZIb29rcy5hZnRlclVwZGF0ZSgpO1xuICBpZiAocmVzKSByZXMoKTtcbn1cbmZ1bmN0aW9uIHJ1blF1ZXVlKHF1ZXVlKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHJ1blRvcChxdWV1ZVtpXSk7XG59XG5mdW5jdGlvbiBzY2hlZHVsZVF1ZXVlKHF1ZXVlKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBpdGVtID0gcXVldWVbaV07XG4gICAgY29uc3QgdGFza3MgPSBUcmFuc2l0aW9uLnF1ZXVlO1xuICAgIGlmICghdGFza3MuaGFzKGl0ZW0pKSB7XG4gICAgICB0YXNrcy5hZGQoaXRlbSk7XG4gICAgICBTY2hlZHVsZXIoKCkgPT4ge1xuICAgICAgICB0YXNrcy5kZWxldGUoaXRlbSk7XG4gICAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICAgIFRyYW5zaXRpb24ucnVubmluZyA9IHRydWU7XG4gICAgICAgICAgcnVuVG9wKGl0ZW0pO1xuICAgICAgICB9LCBmYWxzZSk7XG4gICAgICAgIFRyYW5zaXRpb24gJiYgKFRyYW5zaXRpb24ucnVubmluZyA9IGZhbHNlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gcnVuVXNlckVmZmVjdHMocXVldWUpIHtcbiAgbGV0IGksXG4gICAgdXNlckxlbmd0aCA9IDA7XG4gIGZvciAoaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGUgPSBxdWV1ZVtpXTtcbiAgICBpZiAoIWUudXNlcikgcnVuVG9wKGUpO2Vsc2UgcXVldWVbdXNlckxlbmd0aCsrXSA9IGU7XG4gIH1cbiAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0KSB7XG4gICAgaWYgKHNoYXJlZENvbmZpZy5jb3VudCkge1xuICAgICAgc2hhcmVkQ29uZmlnLmVmZmVjdHMgfHwgKHNoYXJlZENvbmZpZy5lZmZlY3RzID0gW10pO1xuICAgICAgc2hhcmVkQ29uZmlnLmVmZmVjdHMucHVzaCguLi5xdWV1ZS5zbGljZSgwLCB1c2VyTGVuZ3RoKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHNldEh5ZHJhdGVDb250ZXh0KCk7XG4gIH1cbiAgaWYgKHNoYXJlZENvbmZpZy5lZmZlY3RzICYmIChzaGFyZWRDb25maWcuZG9uZSB8fCAhc2hhcmVkQ29uZmlnLmNvdW50KSkge1xuICAgIHF1ZXVlID0gWy4uLnNoYXJlZENvbmZpZy5lZmZlY3RzLCAuLi5xdWV1ZV07XG4gICAgdXNlckxlbmd0aCArPSBzaGFyZWRDb25maWcuZWZmZWN0cy5sZW5ndGg7XG4gICAgZGVsZXRlIHNoYXJlZENvbmZpZy5lZmZlY3RzO1xuICB9XG4gIGZvciAoaSA9IDA7IGkgPCB1c2VyTGVuZ3RoOyBpKyspIHJ1blRvcChxdWV1ZVtpXSk7XG59XG5mdW5jdGlvbiBsb29rVXBzdHJlYW0obm9kZSwgaWdub3JlKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGlmIChydW5uaW5nVHJhbnNpdGlvbikgbm9kZS50U3RhdGUgPSAwO2Vsc2Ugbm9kZS5zdGF0ZSA9IDA7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5zb3VyY2VzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgY29uc3Qgc291cmNlID0gbm9kZS5zb3VyY2VzW2ldO1xuICAgIGlmIChzb3VyY2Uuc291cmNlcykge1xuICAgICAgY29uc3Qgc3RhdGUgPSBydW5uaW5nVHJhbnNpdGlvbiA/IHNvdXJjZS50U3RhdGUgOiBzb3VyY2Uuc3RhdGU7XG4gICAgICBpZiAoc3RhdGUgPT09IFNUQUxFKSB7XG4gICAgICAgIGlmIChzb3VyY2UgIT09IGlnbm9yZSAmJiAoIXNvdXJjZS51cGRhdGVkQXQgfHwgc291cmNlLnVwZGF0ZWRBdCA8IEV4ZWNDb3VudCkpIHJ1blRvcChzb3VyY2UpO1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gUEVORElORykgbG9va1Vwc3RyZWFtKHNvdXJjZSwgaWdub3JlKTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIG1hcmtEb3duc3RyZWFtKG5vZGUpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLm9ic2VydmVycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGNvbnN0IG8gPSBub2RlLm9ic2VydmVyc1tpXTtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24gPyAhby50U3RhdGUgOiAhby5zdGF0ZSkge1xuICAgICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uKSBvLnRTdGF0ZSA9IFBFTkRJTkc7ZWxzZSBvLnN0YXRlID0gUEVORElORztcbiAgICAgIGlmIChvLnB1cmUpIFVwZGF0ZXMucHVzaChvKTtlbHNlIEVmZmVjdHMucHVzaChvKTtcbiAgICAgIG8ub2JzZXJ2ZXJzICYmIG1hcmtEb3duc3RyZWFtKG8pO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gY2xlYW5Ob2RlKG5vZGUpIHtcbiAgbGV0IGk7XG4gIGlmIChub2RlLnNvdXJjZXMpIHtcbiAgICB3aGlsZSAobm9kZS5zb3VyY2VzLmxlbmd0aCkge1xuICAgICAgY29uc3Qgc291cmNlID0gbm9kZS5zb3VyY2VzLnBvcCgpLFxuICAgICAgICBpbmRleCA9IG5vZGUuc291cmNlU2xvdHMucG9wKCksXG4gICAgICAgIG9icyA9IHNvdXJjZS5vYnNlcnZlcnM7XG4gICAgICBpZiAob2JzICYmIG9icy5sZW5ndGgpIHtcbiAgICAgICAgY29uc3QgbiA9IG9icy5wb3AoKSxcbiAgICAgICAgICBzID0gc291cmNlLm9ic2VydmVyU2xvdHMucG9wKCk7XG4gICAgICAgIGlmIChpbmRleCA8IG9icy5sZW5ndGgpIHtcbiAgICAgICAgICBuLnNvdXJjZVNsb3RzW3NdID0gaW5kZXg7XG4gICAgICAgICAgb2JzW2luZGV4XSA9IG47XG4gICAgICAgICAgc291cmNlLm9ic2VydmVyU2xvdHNbaW5kZXhdID0gcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAobm9kZS50T3duZWQpIHtcbiAgICBmb3IgKGkgPSBub2RlLnRPd25lZC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgY2xlYW5Ob2RlKG5vZGUudE93bmVkW2ldKTtcbiAgICBkZWxldGUgbm9kZS50T3duZWQ7XG4gIH1cbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIG5vZGUucHVyZSkge1xuICAgIHJlc2V0KG5vZGUsIHRydWUpO1xuICB9IGVsc2UgaWYgKG5vZGUub3duZWQpIHtcbiAgICBmb3IgKGkgPSBub2RlLm93bmVkLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBjbGVhbk5vZGUobm9kZS5vd25lZFtpXSk7XG4gICAgbm9kZS5vd25lZCA9IG51bGw7XG4gIH1cbiAgaWYgKG5vZGUuY2xlYW51cHMpIHtcbiAgICBmb3IgKGkgPSBub2RlLmNsZWFudXBzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBub2RlLmNsZWFudXBzW2ldKCk7XG4gICAgbm9kZS5jbGVhbnVwcyA9IG51bGw7XG4gIH1cbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBub2RlLnRTdGF0ZSA9IDA7ZWxzZSBub2RlLnN0YXRlID0gMDtcbiAgZGVsZXRlIG5vZGUuc291cmNlTWFwO1xufVxuZnVuY3Rpb24gcmVzZXQobm9kZSwgdG9wKSB7XG4gIGlmICghdG9wKSB7XG4gICAgbm9kZS50U3RhdGUgPSAwO1xuICAgIFRyYW5zaXRpb24uZGlzcG9zZWQuYWRkKG5vZGUpO1xuICB9XG4gIGlmIChub2RlLm93bmVkKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLm93bmVkLmxlbmd0aDsgaSsrKSByZXNldChub2RlLm93bmVkW2ldKTtcbiAgfVxufVxuZnVuY3Rpb24gY2FzdEVycm9yKGVycikge1xuICBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHJldHVybiBlcnI7XG4gIHJldHVybiBuZXcgRXJyb3IodHlwZW9mIGVyciA9PT0gXCJzdHJpbmdcIiA/IGVyciA6IFwiVW5rbm93biBlcnJvclwiLCB7XG4gICAgY2F1c2U6IGVyclxuICB9KTtcbn1cbmZ1bmN0aW9uIHJ1bkVycm9ycyhlcnIsIGZucywgb3duZXIpIHtcbiAgdHJ5IHtcbiAgICBmb3IgKGNvbnN0IGYgb2YgZm5zKSBmKGVycik7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBoYW5kbGVFcnJvcihlLCBvd25lciAmJiBvd25lci5vd25lciB8fCBudWxsKTtcbiAgfVxufVxuZnVuY3Rpb24gaGFuZGxlRXJyb3IoZXJyLCBvd25lciA9IE93bmVyKSB7XG4gIGNvbnN0IGZucyA9IEVSUk9SICYmIG93bmVyICYmIG93bmVyLmNvbnRleHQgJiYgb3duZXIuY29udGV4dFtFUlJPUl07XG4gIGNvbnN0IGVycm9yID0gY2FzdEVycm9yKGVycik7XG4gIGlmICghZm5zKSB0aHJvdyBlcnJvcjtcbiAgaWYgKEVmZmVjdHMpIEVmZmVjdHMucHVzaCh7XG4gICAgZm4oKSB7XG4gICAgICBydW5FcnJvcnMoZXJyb3IsIGZucywgb3duZXIpO1xuICAgIH0sXG4gICAgc3RhdGU6IFNUQUxFXG4gIH0pO2Vsc2UgcnVuRXJyb3JzKGVycm9yLCBmbnMsIG93bmVyKTtcbn1cbmZ1bmN0aW9uIHJlc29sdmVDaGlsZHJlbihjaGlsZHJlbikge1xuICBpZiAodHlwZW9mIGNoaWxkcmVuID09PSBcImZ1bmN0aW9uXCIgJiYgIWNoaWxkcmVuLmxlbmd0aCkgcmV0dXJuIHJlc29sdmVDaGlsZHJlbihjaGlsZHJlbigpKTtcbiAgaWYgKEFycmF5LmlzQXJyYXkoY2hpbGRyZW4pKSB7XG4gICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHJlc29sdmVDaGlsZHJlbihjaGlsZHJlbltpXSk7XG4gICAgICBBcnJheS5pc0FycmF5KHJlc3VsdCkgPyByZXN1bHRzLnB1c2guYXBwbHkocmVzdWx0cywgcmVzdWx0KSA6IHJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxuICByZXR1cm4gY2hpbGRyZW47XG59XG5mdW5jdGlvbiBjcmVhdGVQcm92aWRlcihpZCwgb3B0aW9ucykge1xuICByZXR1cm4gZnVuY3Rpb24gcHJvdmlkZXIocHJvcHMpIHtcbiAgICBsZXQgcmVzO1xuICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiByZXMgPSB1bnRyYWNrKCgpID0+IHtcbiAgICAgIE93bmVyLmNvbnRleHQgPSB7XG4gICAgICAgIC4uLk93bmVyLmNvbnRleHQsXG4gICAgICAgIFtpZF06IHByb3BzLnZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIGNoaWxkcmVuKCgpID0+IHByb3BzLmNoaWxkcmVuKTtcbiAgICB9KSwgdW5kZWZpbmVkLCBvcHRpb25zKTtcbiAgICByZXR1cm4gcmVzO1xuICB9O1xufVxuZnVuY3Rpb24gb25FcnJvcihmbikge1xuICBFUlJPUiB8fCAoRVJST1IgPSBTeW1ib2woXCJlcnJvclwiKSk7XG4gIGlmIChPd25lciA9PT0gbnVsbCkgY29uc29sZS53YXJuKFwiZXJyb3IgaGFuZGxlcnMgY3JlYXRlZCBvdXRzaWRlIGEgYGNyZWF0ZVJvb3RgIG9yIGByZW5kZXJgIHdpbGwgbmV2ZXIgYmUgcnVuXCIpO2Vsc2UgaWYgKE93bmVyLmNvbnRleHQgPT09IG51bGwgfHwgIU93bmVyLmNvbnRleHRbRVJST1JdKSB7XG4gICAgT3duZXIuY29udGV4dCA9IHtcbiAgICAgIC4uLk93bmVyLmNvbnRleHQsXG4gICAgICBbRVJST1JdOiBbZm5dXG4gICAgfTtcbiAgICBtdXRhdGVDb250ZXh0KE93bmVyLCBFUlJPUiwgW2ZuXSk7XG4gIH0gZWxzZSBPd25lci5jb250ZXh0W0VSUk9SXS5wdXNoKGZuKTtcbn1cbmZ1bmN0aW9uIG11dGF0ZUNvbnRleHQobywga2V5LCB2YWx1ZSkge1xuICBpZiAoby5vd25lZCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgby5vd25lZC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKG8ub3duZWRbaV0uY29udGV4dCA9PT0gby5jb250ZXh0KSBtdXRhdGVDb250ZXh0KG8ub3duZWRbaV0sIGtleSwgdmFsdWUpO1xuICAgICAgaWYgKCFvLm93bmVkW2ldLmNvbnRleHQpIHtcbiAgICAgICAgby5vd25lZFtpXS5jb250ZXh0ID0gby5jb250ZXh0O1xuICAgICAgICBtdXRhdGVDb250ZXh0KG8ub3duZWRbaV0sIGtleSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIGlmICghby5vd25lZFtpXS5jb250ZXh0W2tleV0pIHtcbiAgICAgICAgby5vd25lZFtpXS5jb250ZXh0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgbXV0YXRlQ29udGV4dChvLm93bmVkW2ldLCBrZXksIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gb2JzZXJ2YWJsZShpbnB1dCkge1xuICByZXR1cm4ge1xuICAgIHN1YnNjcmliZShvYnNlcnZlcikge1xuICAgICAgaWYgKCEob2JzZXJ2ZXIgaW5zdGFuY2VvZiBPYmplY3QpIHx8IG9ic2VydmVyID09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkV4cGVjdGVkIHRoZSBvYnNlcnZlciB0byBiZSBhbiBvYmplY3QuXCIpO1xuICAgICAgfVxuICAgICAgY29uc3QgaGFuZGxlciA9IHR5cGVvZiBvYnNlcnZlciA9PT0gXCJmdW5jdGlvblwiID8gb2JzZXJ2ZXIgOiBvYnNlcnZlci5uZXh0ICYmIG9ic2VydmVyLm5leHQuYmluZChvYnNlcnZlcik7XG4gICAgICBpZiAoIWhhbmRsZXIpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1bnN1YnNjcmliZSgpIHt9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBjb25zdCBkaXNwb3NlID0gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgICAgICAgY29uc3QgdiA9IGlucHV0KCk7XG4gICAgICAgICAgdW50cmFjaygoKSA9PiBoYW5kbGVyKHYpKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkaXNwb3NlcjtcbiAgICAgIH0pO1xuICAgICAgaWYgKGdldE93bmVyKCkpIG9uQ2xlYW51cChkaXNwb3NlKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCkge1xuICAgICAgICAgIGRpc3Bvc2UoKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9LFxuICAgIFtTeW1ib2wub2JzZXJ2YWJsZSB8fCBcIkBAb2JzZXJ2YWJsZVwiXSgpIHtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfTtcbn1cbmZ1bmN0aW9uIGZyb20ocHJvZHVjZXIsIGluaXRhbFZhbHVlID0gdW5kZWZpbmVkKSB7XG4gIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKGluaXRhbFZhbHVlLCB7XG4gICAgZXF1YWxzOiBmYWxzZVxuICB9KTtcbiAgaWYgKFwic3Vic2NyaWJlXCIgaW4gcHJvZHVjZXIpIHtcbiAgICBjb25zdCB1bnN1YiA9IHByb2R1Y2VyLnN1YnNjcmliZSh2ID0+IHNldCgoKSA9PiB2KSk7XG4gICAgb25DbGVhbnVwKCgpID0+IFwidW5zdWJzY3JpYmVcIiBpbiB1bnN1YiA/IHVuc3ViLnVuc3Vic2NyaWJlKCkgOiB1bnN1YigpKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBjbGVhbiA9IHByb2R1Y2VyKHNldCk7XG4gICAgb25DbGVhbnVwKGNsZWFuKTtcbiAgfVxuICByZXR1cm4gcztcbn1cblxuY29uc3QgRkFMTEJBQ0sgPSBTeW1ib2woXCJmYWxsYmFja1wiKTtcbmZ1bmN0aW9uIGRpc3Bvc2UoZCkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGQubGVuZ3RoOyBpKyspIGRbaV0oKTtcbn1cbmZ1bmN0aW9uIG1hcEFycmF5KGxpc3QsIG1hcEZuLCBvcHRpb25zID0ge30pIHtcbiAgbGV0IGl0ZW1zID0gW10sXG4gICAgbWFwcGVkID0gW10sXG4gICAgZGlzcG9zZXJzID0gW10sXG4gICAgbGVuID0gMCxcbiAgICBpbmRleGVzID0gbWFwRm4ubGVuZ3RoID4gMSA/IFtdIDogbnVsbDtcbiAgb25DbGVhbnVwKCgpID0+IGRpc3Bvc2UoZGlzcG9zZXJzKSk7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgbGV0IG5ld0l0ZW1zID0gbGlzdCgpIHx8IFtdLFxuICAgICAgbmV3TGVuID0gbmV3SXRlbXMubGVuZ3RoLFxuICAgICAgaSxcbiAgICAgIGo7XG4gICAgbmV3SXRlbXNbJFRSQUNLXTtcbiAgICByZXR1cm4gdW50cmFjaygoKSA9PiB7XG4gICAgICBsZXQgbmV3SW5kaWNlcywgbmV3SW5kaWNlc05leHQsIHRlbXAsIHRlbXBkaXNwb3NlcnMsIHRlbXBJbmRleGVzLCBzdGFydCwgZW5kLCBuZXdFbmQsIGl0ZW07XG4gICAgICBpZiAobmV3TGVuID09PSAwKSB7XG4gICAgICAgIGlmIChsZW4gIT09IDApIHtcbiAgICAgICAgICBkaXNwb3NlKGRpc3Bvc2Vycyk7XG4gICAgICAgICAgZGlzcG9zZXJzID0gW107XG4gICAgICAgICAgaXRlbXMgPSBbXTtcbiAgICAgICAgICBtYXBwZWQgPSBbXTtcbiAgICAgICAgICBsZW4gPSAwO1xuICAgICAgICAgIGluZGV4ZXMgJiYgKGluZGV4ZXMgPSBbXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZmFsbGJhY2spIHtcbiAgICAgICAgICBpdGVtcyA9IFtGQUxMQkFDS107XG4gICAgICAgICAgbWFwcGVkWzBdID0gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgICAgICBkaXNwb3NlcnNbMF0gPSBkaXNwb3NlcjtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb25zLmZhbGxiYWNrKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGVuID0gMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAobGVuID09PSAwKSB7XG4gICAgICAgIG1hcHBlZCA9IG5ldyBBcnJheShuZXdMZW4pO1xuICAgICAgICBmb3IgKGogPSAwOyBqIDwgbmV3TGVuOyBqKyspIHtcbiAgICAgICAgICBpdGVtc1tqXSA9IG5ld0l0ZW1zW2pdO1xuICAgICAgICAgIG1hcHBlZFtqXSA9IGNyZWF0ZVJvb3QobWFwcGVyKTtcbiAgICAgICAgfVxuICAgICAgICBsZW4gPSBuZXdMZW47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZW1wID0gbmV3IEFycmF5KG5ld0xlbik7XG4gICAgICAgIHRlbXBkaXNwb3NlcnMgPSBuZXcgQXJyYXkobmV3TGVuKTtcbiAgICAgICAgaW5kZXhlcyAmJiAodGVtcEluZGV4ZXMgPSBuZXcgQXJyYXkobmV3TGVuKSk7XG4gICAgICAgIGZvciAoc3RhcnQgPSAwLCBlbmQgPSBNYXRoLm1pbihsZW4sIG5ld0xlbik7IHN0YXJ0IDwgZW5kICYmIGl0ZW1zW3N0YXJ0XSA9PT0gbmV3SXRlbXNbc3RhcnRdOyBzdGFydCsrKTtcbiAgICAgICAgZm9yIChlbmQgPSBsZW4gLSAxLCBuZXdFbmQgPSBuZXdMZW4gLSAxOyBlbmQgPj0gc3RhcnQgJiYgbmV3RW5kID49IHN0YXJ0ICYmIGl0ZW1zW2VuZF0gPT09IG5ld0l0ZW1zW25ld0VuZF07IGVuZC0tLCBuZXdFbmQtLSkge1xuICAgICAgICAgIHRlbXBbbmV3RW5kXSA9IG1hcHBlZFtlbmRdO1xuICAgICAgICAgIHRlbXBkaXNwb3NlcnNbbmV3RW5kXSA9IGRpc3Bvc2Vyc1tlbmRdO1xuICAgICAgICAgIGluZGV4ZXMgJiYgKHRlbXBJbmRleGVzW25ld0VuZF0gPSBpbmRleGVzW2VuZF0pO1xuICAgICAgICB9XG4gICAgICAgIG5ld0luZGljZXMgPSBuZXcgTWFwKCk7XG4gICAgICAgIG5ld0luZGljZXNOZXh0ID0gbmV3IEFycmF5KG5ld0VuZCArIDEpO1xuICAgICAgICBmb3IgKGogPSBuZXdFbmQ7IGogPj0gc3RhcnQ7IGotLSkge1xuICAgICAgICAgIGl0ZW0gPSBuZXdJdGVtc1tqXTtcbiAgICAgICAgICBpID0gbmV3SW5kaWNlcy5nZXQoaXRlbSk7XG4gICAgICAgICAgbmV3SW5kaWNlc05leHRbal0gPSBpID09PSB1bmRlZmluZWQgPyAtMSA6IGk7XG4gICAgICAgICAgbmV3SW5kaWNlcy5zZXQoaXRlbSwgaik7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChpID0gc3RhcnQ7IGkgPD0gZW5kOyBpKyspIHtcbiAgICAgICAgICBpdGVtID0gaXRlbXNbaV07XG4gICAgICAgICAgaiA9IG5ld0luZGljZXMuZ2V0KGl0ZW0pO1xuICAgICAgICAgIGlmIChqICE9PSB1bmRlZmluZWQgJiYgaiAhPT0gLTEpIHtcbiAgICAgICAgICAgIHRlbXBbal0gPSBtYXBwZWRbaV07XG4gICAgICAgICAgICB0ZW1wZGlzcG9zZXJzW2pdID0gZGlzcG9zZXJzW2ldO1xuICAgICAgICAgICAgaW5kZXhlcyAmJiAodGVtcEluZGV4ZXNbal0gPSBpbmRleGVzW2ldKTtcbiAgICAgICAgICAgIGogPSBuZXdJbmRpY2VzTmV4dFtqXTtcbiAgICAgICAgICAgIG5ld0luZGljZXMuc2V0KGl0ZW0sIGopO1xuICAgICAgICAgIH0gZWxzZSBkaXNwb3NlcnNbaV0oKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGogPSBzdGFydDsgaiA8IG5ld0xlbjsgaisrKSB7XG4gICAgICAgICAgaWYgKGogaW4gdGVtcCkge1xuICAgICAgICAgICAgbWFwcGVkW2pdID0gdGVtcFtqXTtcbiAgICAgICAgICAgIGRpc3Bvc2Vyc1tqXSA9IHRlbXBkaXNwb3NlcnNbal07XG4gICAgICAgICAgICBpZiAoaW5kZXhlcykge1xuICAgICAgICAgICAgICBpbmRleGVzW2pdID0gdGVtcEluZGV4ZXNbal07XG4gICAgICAgICAgICAgIGluZGV4ZXNbal0oaik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIG1hcHBlZFtqXSA9IGNyZWF0ZVJvb3QobWFwcGVyKTtcbiAgICAgICAgfVxuICAgICAgICBtYXBwZWQgPSBtYXBwZWQuc2xpY2UoMCwgbGVuID0gbmV3TGVuKTtcbiAgICAgICAgaXRlbXMgPSBuZXdJdGVtcy5zbGljZSgwKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXBwZWQ7XG4gICAgfSk7XG4gICAgZnVuY3Rpb24gbWFwcGVyKGRpc3Bvc2VyKSB7XG4gICAgICBkaXNwb3NlcnNbal0gPSBkaXNwb3NlcjtcbiAgICAgIGlmIChpbmRleGVzKSB7XG4gICAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKGosIHtcbiAgICAgICAgICBuYW1lOiBcImluZGV4XCJcbiAgICAgICAgfSkgO1xuICAgICAgICBpbmRleGVzW2pdID0gc2V0O1xuICAgICAgICByZXR1cm4gbWFwRm4obmV3SXRlbXNbal0sIHMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1hcEZuKG5ld0l0ZW1zW2pdKTtcbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiBpbmRleEFycmF5KGxpc3QsIG1hcEZuLCBvcHRpb25zID0ge30pIHtcbiAgbGV0IGl0ZW1zID0gW10sXG4gICAgbWFwcGVkID0gW10sXG4gICAgZGlzcG9zZXJzID0gW10sXG4gICAgc2lnbmFscyA9IFtdLFxuICAgIGxlbiA9IDAsXG4gICAgaTtcbiAgb25DbGVhbnVwKCgpID0+IGRpc3Bvc2UoZGlzcG9zZXJzKSk7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgY29uc3QgbmV3SXRlbXMgPSBsaXN0KCkgfHwgW10sXG4gICAgICBuZXdMZW4gPSBuZXdJdGVtcy5sZW5ndGg7XG4gICAgbmV3SXRlbXNbJFRSQUNLXTtcbiAgICByZXR1cm4gdW50cmFjaygoKSA9PiB7XG4gICAgICBpZiAobmV3TGVuID09PSAwKSB7XG4gICAgICAgIGlmIChsZW4gIT09IDApIHtcbiAgICAgICAgICBkaXNwb3NlKGRpc3Bvc2Vycyk7XG4gICAgICAgICAgZGlzcG9zZXJzID0gW107XG4gICAgICAgICAgaXRlbXMgPSBbXTtcbiAgICAgICAgICBtYXBwZWQgPSBbXTtcbiAgICAgICAgICBsZW4gPSAwO1xuICAgICAgICAgIHNpZ25hbHMgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5mYWxsYmFjaykge1xuICAgICAgICAgIGl0ZW1zID0gW0ZBTExCQUNLXTtcbiAgICAgICAgICBtYXBwZWRbMF0gPSBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgICAgIGRpc3Bvc2Vyc1swXSA9IGRpc3Bvc2VyO1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMuZmFsbGJhY2soKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBsZW4gPSAxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXBwZWQ7XG4gICAgICB9XG4gICAgICBpZiAoaXRlbXNbMF0gPT09IEZBTExCQUNLKSB7XG4gICAgICAgIGRpc3Bvc2Vyc1swXSgpO1xuICAgICAgICBkaXNwb3NlcnMgPSBbXTtcbiAgICAgICAgaXRlbXMgPSBbXTtcbiAgICAgICAgbWFwcGVkID0gW107XG4gICAgICAgIGxlbiA9IDA7XG4gICAgICB9XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbmV3TGVuOyBpKyspIHtcbiAgICAgICAgaWYgKGkgPCBpdGVtcy5sZW5ndGggJiYgaXRlbXNbaV0gIT09IG5ld0l0ZW1zW2ldKSB7XG4gICAgICAgICAgc2lnbmFsc1tpXSgoKSA9PiBuZXdJdGVtc1tpXSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaSA+PSBpdGVtcy5sZW5ndGgpIHtcbiAgICAgICAgICBtYXBwZWRbaV0gPSBjcmVhdGVSb290KG1hcHBlcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZvciAoOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZGlzcG9zZXJzW2ldKCk7XG4gICAgICB9XG4gICAgICBsZW4gPSBzaWduYWxzLmxlbmd0aCA9IGRpc3Bvc2Vycy5sZW5ndGggPSBuZXdMZW47XG4gICAgICBpdGVtcyA9IG5ld0l0ZW1zLnNsaWNlKDApO1xuICAgICAgcmV0dXJuIG1hcHBlZCA9IG1hcHBlZC5zbGljZSgwLCBsZW4pO1xuICAgIH0pO1xuICAgIGZ1bmN0aW9uIG1hcHBlcihkaXNwb3Nlcikge1xuICAgICAgZGlzcG9zZXJzW2ldID0gZGlzcG9zZXI7XG4gICAgICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbChuZXdJdGVtc1tpXSwge1xuICAgICAgICBuYW1lOiBcInZhbHVlXCJcbiAgICAgIH0pIDtcbiAgICAgIHNpZ25hbHNbaV0gPSBzZXQ7XG4gICAgICByZXR1cm4gbWFwRm4ocywgaSk7XG4gICAgfVxuICB9O1xufVxuXG5sZXQgaHlkcmF0aW9uRW5hYmxlZCA9IGZhbHNlO1xuZnVuY3Rpb24gZW5hYmxlSHlkcmF0aW9uKCkge1xuICBoeWRyYXRpb25FbmFibGVkID0gdHJ1ZTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudChDb21wLCBwcm9wcykge1xuICBpZiAoaHlkcmF0aW9uRW5hYmxlZCkge1xuICAgIGlmIChzaGFyZWRDb25maWcuY29udGV4dCkge1xuICAgICAgY29uc3QgYyA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICAgICAgc2V0SHlkcmF0ZUNvbnRleHQobmV4dEh5ZHJhdGVDb250ZXh0KCkpO1xuICAgICAgY29uc3QgciA9IGRldkNvbXBvbmVudChDb21wLCBwcm9wcyB8fCB7fSkgO1xuICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoYyk7XG4gICAgICByZXR1cm4gcjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRldkNvbXBvbmVudChDb21wLCBwcm9wcyB8fCB7fSk7XG59XG5mdW5jdGlvbiB0cnVlRm4oKSB7XG4gIHJldHVybiB0cnVlO1xufVxuY29uc3QgcHJvcFRyYXBzID0ge1xuICBnZXQoXywgcHJvcGVydHksIHJlY2VpdmVyKSB7XG4gICAgaWYgKHByb3BlcnR5ID09PSAkUFJPWFkpIHJldHVybiByZWNlaXZlcjtcbiAgICByZXR1cm4gXy5nZXQocHJvcGVydHkpO1xuICB9LFxuICBoYXMoXywgcHJvcGVydHkpIHtcbiAgICBpZiAocHJvcGVydHkgPT09ICRQUk9YWSkgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIF8uaGFzKHByb3BlcnR5KTtcbiAgfSxcbiAgc2V0OiB0cnVlRm4sXG4gIGRlbGV0ZVByb3BlcnR5OiB0cnVlRm4sXG4gIGdldE93blByb3BlcnR5RGVzY3JpcHRvcihfLCBwcm9wZXJ0eSkge1xuICAgIHJldHVybiB7XG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgZ2V0KCkge1xuICAgICAgICByZXR1cm4gXy5nZXQocHJvcGVydHkpO1xuICAgICAgfSxcbiAgICAgIHNldDogdHJ1ZUZuLFxuICAgICAgZGVsZXRlUHJvcGVydHk6IHRydWVGblxuICAgIH07XG4gIH0sXG4gIG93bktleXMoXykge1xuICAgIHJldHVybiBfLmtleXMoKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHJlc29sdmVTb3VyY2Uocykge1xuICByZXR1cm4gIShzID0gdHlwZW9mIHMgPT09IFwiZnVuY3Rpb25cIiA/IHMoKSA6IHMpID8ge30gOiBzO1xufVxuZnVuY3Rpb24gcmVzb2x2ZVNvdXJjZXMoKSB7XG4gIGZvciAobGV0IGkgPSAwLCBsZW5ndGggPSB0aGlzLmxlbmd0aDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgY29uc3QgdiA9IHRoaXNbaV0oKTtcbiAgICBpZiAodiAhPT0gdW5kZWZpbmVkKSByZXR1cm4gdjtcbiAgfVxufVxuZnVuY3Rpb24gbWVyZ2VQcm9wcyguLi5zb3VyY2VzKSB7XG4gIGxldCBwcm94eSA9IGZhbHNlO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHNvdXJjZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBzID0gc291cmNlc1tpXTtcbiAgICBwcm94eSA9IHByb3h5IHx8ICEhcyAmJiAkUFJPWFkgaW4gcztcbiAgICBzb3VyY2VzW2ldID0gdHlwZW9mIHMgPT09IFwiZnVuY3Rpb25cIiA/IChwcm94eSA9IHRydWUsIGNyZWF0ZU1lbW8ocykpIDogcztcbiAgfVxuICBpZiAoU1VQUE9SVFNfUFJPWFkgJiYgcHJveHkpIHtcbiAgICByZXR1cm4gbmV3IFByb3h5KHtcbiAgICAgIGdldChwcm9wZXJ0eSkge1xuICAgICAgICBmb3IgKGxldCBpID0gc291cmNlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgIGNvbnN0IHYgPSByZXNvbHZlU291cmNlKHNvdXJjZXNbaV0pW3Byb3BlcnR5XTtcbiAgICAgICAgICBpZiAodiAhPT0gdW5kZWZpbmVkKSByZXR1cm4gdjtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGhhcyhwcm9wZXJ0eSkge1xuICAgICAgICBmb3IgKGxldCBpID0gc291cmNlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgIGlmIChwcm9wZXJ0eSBpbiByZXNvbHZlU291cmNlKHNvdXJjZXNbaV0pKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAga2V5cygpIHtcbiAgICAgICAgY29uc3Qga2V5cyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvdXJjZXMubGVuZ3RoOyBpKyspIGtleXMucHVzaCguLi5PYmplY3Qua2V5cyhyZXNvbHZlU291cmNlKHNvdXJjZXNbaV0pKSk7XG4gICAgICAgIHJldHVybiBbLi4ubmV3IFNldChrZXlzKV07XG4gICAgICB9XG4gICAgfSwgcHJvcFRyYXBzKTtcbiAgfVxuICBjb25zdCBzb3VyY2VzTWFwID0ge307XG4gIGNvbnN0IGRlZmluZWQgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICBmb3IgKGxldCBpID0gc291cmNlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGNvbnN0IHNvdXJjZSA9IHNvdXJjZXNbaV07XG4gICAgaWYgKCFzb3VyY2UpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHNvdXJjZUtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhzb3VyY2UpO1xuICAgIGZvciAobGV0IGkgPSBzb3VyY2VLZXlzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBrZXkgPSBzb3VyY2VLZXlzW2ldO1xuICAgICAgaWYgKGtleSA9PT0gXCJfX3Byb3RvX19cIiB8fCBrZXkgPT09IFwiY29uc3RydWN0b3JcIikgY29udGludWU7XG4gICAgICBjb25zdCBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihzb3VyY2UsIGtleSk7XG4gICAgICBpZiAoIWRlZmluZWRba2V5XSkge1xuICAgICAgICBkZWZpbmVkW2tleV0gPSBkZXNjLmdldCA/IHtcbiAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBnZXQ6IHJlc29sdmVTb3VyY2VzLmJpbmQoc291cmNlc01hcFtrZXldID0gW2Rlc2MuZ2V0LmJpbmQoc291cmNlKV0pXG4gICAgICAgIH0gOiBkZXNjLnZhbHVlICE9PSB1bmRlZmluZWQgPyBkZXNjIDogdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3Qgc291cmNlcyA9IHNvdXJjZXNNYXBba2V5XTtcbiAgICAgICAgaWYgKHNvdXJjZXMpIHtcbiAgICAgICAgICBpZiAoZGVzYy5nZXQpIHNvdXJjZXMucHVzaChkZXNjLmdldC5iaW5kKHNvdXJjZSkpO2Vsc2UgaWYgKGRlc2MudmFsdWUgIT09IHVuZGVmaW5lZCkgc291cmNlcy5wdXNoKCgpID0+IGRlc2MudmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNvbnN0IHRhcmdldCA9IHt9O1xuICBjb25zdCBkZWZpbmVkS2V5cyA9IE9iamVjdC5rZXlzKGRlZmluZWQpO1xuICBmb3IgKGxldCBpID0gZGVmaW5lZEtleXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBjb25zdCBrZXkgPSBkZWZpbmVkS2V5c1tpXSxcbiAgICAgIGRlc2MgPSBkZWZpbmVkW2tleV07XG4gICAgaWYgKGRlc2MgJiYgZGVzYy5nZXQpIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgZGVzYyk7ZWxzZSB0YXJnZXRba2V5XSA9IGRlc2MgPyBkZXNjLnZhbHVlIDogdW5kZWZpbmVkO1xuICB9XG4gIHJldHVybiB0YXJnZXQ7XG59XG5mdW5jdGlvbiBzcGxpdFByb3BzKHByb3BzLCAuLi5rZXlzKSB7XG4gIGlmIChTVVBQT1JUU19QUk9YWSAmJiAkUFJPWFkgaW4gcHJvcHMpIHtcbiAgICBjb25zdCBibG9ja2VkID0gbmV3IFNldChrZXlzLmxlbmd0aCA+IDEgPyBrZXlzLmZsYXQoKSA6IGtleXNbMF0pO1xuICAgIGNvbnN0IHJlcyA9IGtleXMubWFwKGsgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm94eSh7XG4gICAgICAgIGdldChwcm9wZXJ0eSkge1xuICAgICAgICAgIHJldHVybiBrLmluY2x1ZGVzKHByb3BlcnR5KSA/IHByb3BzW3Byb3BlcnR5XSA6IHVuZGVmaW5lZDtcbiAgICAgICAgfSxcbiAgICAgICAgaGFzKHByb3BlcnR5KSB7XG4gICAgICAgICAgcmV0dXJuIGsuaW5jbHVkZXMocHJvcGVydHkpICYmIHByb3BlcnR5IGluIHByb3BzO1xuICAgICAgICB9LFxuICAgICAgICBrZXlzKCkge1xuICAgICAgICAgIHJldHVybiBrLmZpbHRlcihwcm9wZXJ0eSA9PiBwcm9wZXJ0eSBpbiBwcm9wcyk7XG4gICAgICAgIH1cbiAgICAgIH0sIHByb3BUcmFwcyk7XG4gICAgfSk7XG4gICAgcmVzLnB1c2gobmV3IFByb3h5KHtcbiAgICAgIGdldChwcm9wZXJ0eSkge1xuICAgICAgICByZXR1cm4gYmxvY2tlZC5oYXMocHJvcGVydHkpID8gdW5kZWZpbmVkIDogcHJvcHNbcHJvcGVydHldO1xuICAgICAgfSxcbiAgICAgIGhhcyhwcm9wZXJ0eSkge1xuICAgICAgICByZXR1cm4gYmxvY2tlZC5oYXMocHJvcGVydHkpID8gZmFsc2UgOiBwcm9wZXJ0eSBpbiBwcm9wcztcbiAgICAgIH0sXG4gICAgICBrZXlzKCkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMocHJvcHMpLmZpbHRlcihrID0+ICFibG9ja2VkLmhhcyhrKSk7XG4gICAgICB9XG4gICAgfSwgcHJvcFRyYXBzKSk7XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuICBjb25zdCBvdGhlck9iamVjdCA9IHt9O1xuICBjb25zdCBvYmplY3RzID0ga2V5cy5tYXAoKCkgPT4gKHt9KSk7XG4gIGZvciAoY29uc3QgcHJvcE5hbWUgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMocHJvcHMpKSB7XG4gICAgY29uc3QgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IocHJvcHMsIHByb3BOYW1lKTtcbiAgICBjb25zdCBpc0RlZmF1bHREZXNjID0gIWRlc2MuZ2V0ICYmICFkZXNjLnNldCAmJiBkZXNjLmVudW1lcmFibGUgJiYgZGVzYy53cml0YWJsZSAmJiBkZXNjLmNvbmZpZ3VyYWJsZTtcbiAgICBsZXQgYmxvY2tlZCA9IGZhbHNlO1xuICAgIGxldCBvYmplY3RJbmRleCA9IDA7XG4gICAgZm9yIChjb25zdCBrIG9mIGtleXMpIHtcbiAgICAgIGlmIChrLmluY2x1ZGVzKHByb3BOYW1lKSkge1xuICAgICAgICBibG9ja2VkID0gdHJ1ZTtcbiAgICAgICAgaXNEZWZhdWx0RGVzYyA/IG9iamVjdHNbb2JqZWN0SW5kZXhdW3Byb3BOYW1lXSA9IGRlc2MudmFsdWUgOiBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqZWN0c1tvYmplY3RJbmRleF0sIHByb3BOYW1lLCBkZXNjKTtcbiAgICAgIH1cbiAgICAgICsrb2JqZWN0SW5kZXg7XG4gICAgfVxuICAgIGlmICghYmxvY2tlZCkge1xuICAgICAgaXNEZWZhdWx0RGVzYyA/IG90aGVyT2JqZWN0W3Byb3BOYW1lXSA9IGRlc2MudmFsdWUgOiBPYmplY3QuZGVmaW5lUHJvcGVydHkob3RoZXJPYmplY3QsIHByb3BOYW1lLCBkZXNjKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIFsuLi5vYmplY3RzLCBvdGhlck9iamVjdF07XG59XG5mdW5jdGlvbiBsYXp5KGZuKSB7XG4gIGxldCBjb21wO1xuICBsZXQgcDtcbiAgY29uc3Qgd3JhcCA9IHByb3BzID0+IHtcbiAgICBjb25zdCBjdHggPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICBpZiAoY3R4KSB7XG4gICAgICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbCgpO1xuICAgICAgc2hhcmVkQ29uZmlnLmNvdW50IHx8IChzaGFyZWRDb25maWcuY291bnQgPSAwKTtcbiAgICAgIHNoYXJlZENvbmZpZy5jb3VudCsrO1xuICAgICAgKHAgfHwgKHAgPSBmbigpKSkudGhlbihtb2QgPT4ge1xuICAgICAgICAhc2hhcmVkQ29uZmlnLmRvbmUgJiYgc2V0SHlkcmF0ZUNvbnRleHQoY3R4KTtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmNvdW50LS07XG4gICAgICAgIHNldCgoKSA9PiBtb2QuZGVmYXVsdCk7XG4gICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KCk7XG4gICAgICB9KTtcbiAgICAgIGNvbXAgPSBzO1xuICAgIH0gZWxzZSBpZiAoIWNvbXApIHtcbiAgICAgIGNvbnN0IFtzXSA9IGNyZWF0ZVJlc291cmNlKCgpID0+IChwIHx8IChwID0gZm4oKSkpLnRoZW4obW9kID0+IG1vZC5kZWZhdWx0KSk7XG4gICAgICBjb21wID0gcztcbiAgICB9XG4gICAgbGV0IENvbXA7XG4gICAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4gKENvbXAgPSBjb21wKCkpID8gdW50cmFjaygoKSA9PiB7XG4gICAgICBpZiAoSVNfREVWKSBPYmplY3QuYXNzaWduKENvbXAsIHtcbiAgICAgICAgWyRERVZDT01QXTogdHJ1ZVxuICAgICAgfSk7XG4gICAgICBpZiAoIWN0eCB8fCBzaGFyZWRDb25maWcuZG9uZSkgcmV0dXJuIENvbXAocHJvcHMpO1xuICAgICAgY29uc3QgYyA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoY3R4KTtcbiAgICAgIGNvbnN0IHIgPSBDb21wKHByb3BzKTtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGMpO1xuICAgICAgcmV0dXJuIHI7XG4gICAgfSkgOiBcIlwiKTtcbiAgfTtcbiAgd3JhcC5wcmVsb2FkID0gKCkgPT4gcCB8fCAoKHAgPSBmbigpKS50aGVuKG1vZCA9PiBjb21wID0gKCkgPT4gbW9kLmRlZmF1bHQpLCBwKTtcbiAgcmV0dXJuIHdyYXA7XG59XG5sZXQgY291bnRlciA9IDA7XG5mdW5jdGlvbiBjcmVhdGVVbmlxdWVJZCgpIHtcbiAgY29uc3QgY3R4ID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gIHJldHVybiBjdHggPyBzaGFyZWRDb25maWcuZ2V0TmV4dENvbnRleHRJZCgpIDogYGNsLSR7Y291bnRlcisrfWA7XG59XG5cbmNvbnN0IG5hcnJvd2VkRXJyb3IgPSBuYW1lID0+IGBBdHRlbXB0aW5nIHRvIGFjY2VzcyBhIHN0YWxlIHZhbHVlIGZyb20gPCR7bmFtZX0+IHRoYXQgY291bGQgcG9zc2libHkgYmUgdW5kZWZpbmVkLiBUaGlzIG1heSBvY2N1ciBiZWNhdXNlIHlvdSBhcmUgcmVhZGluZyB0aGUgYWNjZXNzb3IgcmV0dXJuZWQgZnJvbSB0aGUgY29tcG9uZW50IGF0IGEgdGltZSB3aGVyZSBpdCBoYXMgYWxyZWFkeSBiZWVuIHVubW91bnRlZC4gV2UgcmVjb21tZW5kIGNsZWFuaW5nIHVwIGFueSBzdGFsZSB0aW1lcnMgb3IgYXN5bmMsIG9yIHJlYWRpbmcgZnJvbSB0aGUgaW5pdGlhbCBjb25kaXRpb24uYCA7XG5mdW5jdGlvbiBGb3IocHJvcHMpIHtcbiAgY29uc3QgZmFsbGJhY2sgPSBcImZhbGxiYWNrXCIgaW4gcHJvcHMgJiYge1xuICAgIGZhbGxiYWNrOiAoKSA9PiBwcm9wcy5mYWxsYmFja1xuICB9O1xuICByZXR1cm4gY3JlYXRlTWVtbyhtYXBBcnJheSgoKSA9PiBwcm9wcy5lYWNoLCBwcm9wcy5jaGlsZHJlbiwgZmFsbGJhY2sgfHwgdW5kZWZpbmVkKSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJ2YWx1ZVwiXG4gIH0pIDtcbn1cbmZ1bmN0aW9uIEluZGV4KHByb3BzKSB7XG4gIGNvbnN0IGZhbGxiYWNrID0gXCJmYWxsYmFja1wiIGluIHByb3BzICYmIHtcbiAgICBmYWxsYmFjazogKCkgPT4gcHJvcHMuZmFsbGJhY2tcbiAgfTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oaW5kZXhBcnJheSgoKSA9PiBwcm9wcy5lYWNoLCBwcm9wcy5jaGlsZHJlbiwgZmFsbGJhY2sgfHwgdW5kZWZpbmVkKSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJ2YWx1ZVwiXG4gIH0pIDtcbn1cbmZ1bmN0aW9uIFNob3cocHJvcHMpIHtcbiAgY29uc3Qga2V5ZWQgPSBwcm9wcy5rZXllZDtcbiAgY29uc3QgY29uZGl0aW9uVmFsdWUgPSBjcmVhdGVNZW1vKCgpID0+IHByb3BzLndoZW4sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwiY29uZGl0aW9uIHZhbHVlXCJcbiAgfSApO1xuICBjb25zdCBjb25kaXRpb24gPSBrZXllZCA/IGNvbmRpdGlvblZhbHVlIDogY3JlYXRlTWVtbyhjb25kaXRpb25WYWx1ZSwgdW5kZWZpbmVkLCB7XG4gICAgZXF1YWxzOiAoYSwgYikgPT4gIWEgPT09ICFiLFxuICAgIG5hbWU6IFwiY29uZGl0aW9uXCJcbiAgfSApO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgYyA9IGNvbmRpdGlvbigpO1xuICAgIGlmIChjKSB7XG4gICAgICBjb25zdCBjaGlsZCA9IHByb3BzLmNoaWxkcmVuO1xuICAgICAgY29uc3QgZm4gPSB0eXBlb2YgY2hpbGQgPT09IFwiZnVuY3Rpb25cIiAmJiBjaGlsZC5sZW5ndGggPiAwO1xuICAgICAgcmV0dXJuIGZuID8gdW50cmFjaygoKSA9PiBjaGlsZChrZXllZCA/IGMgOiAoKSA9PiB7XG4gICAgICAgIGlmICghdW50cmFjayhjb25kaXRpb24pKSB0aHJvdyBuYXJyb3dlZEVycm9yKFwiU2hvd1wiKTtcbiAgICAgICAgcmV0dXJuIGNvbmRpdGlvblZhbHVlKCk7XG4gICAgICB9KSkgOiBjaGlsZDtcbiAgICB9XG4gICAgcmV0dXJuIHByb3BzLmZhbGxiYWNrO1xuICB9LCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSApO1xufVxuZnVuY3Rpb24gU3dpdGNoKHByb3BzKSB7XG4gIGNvbnN0IGNocyA9IGNoaWxkcmVuKCgpID0+IHByb3BzLmNoaWxkcmVuKTtcbiAgY29uc3Qgc3dpdGNoRnVuYyA9IGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGNoID0gY2hzKCk7XG4gICAgY29uc3QgbXBzID0gQXJyYXkuaXNBcnJheShjaCkgPyBjaCA6IFtjaF07XG4gICAgbGV0IGZ1bmMgPSAoKSA9PiB1bmRlZmluZWQ7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gaTtcbiAgICAgIGNvbnN0IG1wID0gbXBzW2ldO1xuICAgICAgY29uc3QgcHJldkZ1bmMgPSBmdW5jO1xuICAgICAgY29uc3QgY29uZGl0aW9uVmFsdWUgPSBjcmVhdGVNZW1vKCgpID0+IHByZXZGdW5jKCkgPyB1bmRlZmluZWQgOiBtcC53aGVuLCB1bmRlZmluZWQsIHtcbiAgICAgICAgbmFtZTogXCJjb25kaXRpb24gdmFsdWVcIlxuICAgICAgfSApO1xuICAgICAgY29uc3QgY29uZGl0aW9uID0gbXAua2V5ZWQgPyBjb25kaXRpb25WYWx1ZSA6IGNyZWF0ZU1lbW8oY29uZGl0aW9uVmFsdWUsIHVuZGVmaW5lZCwge1xuICAgICAgICBlcXVhbHM6IChhLCBiKSA9PiAhYSA9PT0gIWIsXG4gICAgICAgIG5hbWU6IFwiY29uZGl0aW9uXCJcbiAgICAgIH0gKTtcbiAgICAgIGZ1bmMgPSAoKSA9PiBwcmV2RnVuYygpIHx8IChjb25kaXRpb24oKSA/IFtpbmRleCwgY29uZGl0aW9uVmFsdWUsIG1wXSA6IHVuZGVmaW5lZCk7XG4gICAgfVxuICAgIHJldHVybiBmdW5jO1xuICB9KTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IHNlbCA9IHN3aXRjaEZ1bmMoKSgpO1xuICAgIGlmICghc2VsKSByZXR1cm4gcHJvcHMuZmFsbGJhY2s7XG4gICAgY29uc3QgW2luZGV4LCBjb25kaXRpb25WYWx1ZSwgbXBdID0gc2VsO1xuICAgIGNvbnN0IGNoaWxkID0gbXAuY2hpbGRyZW47XG4gICAgY29uc3QgZm4gPSB0eXBlb2YgY2hpbGQgPT09IFwiZnVuY3Rpb25cIiAmJiBjaGlsZC5sZW5ndGggPiAwO1xuICAgIHJldHVybiBmbiA/IHVudHJhY2soKCkgPT4gY2hpbGQobXAua2V5ZWQgPyBjb25kaXRpb25WYWx1ZSgpIDogKCkgPT4ge1xuICAgICAgaWYgKHVudHJhY2soc3dpdGNoRnVuYykoKT8uWzBdICE9PSBpbmRleCkgdGhyb3cgbmFycm93ZWRFcnJvcihcIk1hdGNoXCIpO1xuICAgICAgcmV0dXJuIGNvbmRpdGlvblZhbHVlKCk7XG4gICAgfSkpIDogY2hpbGQ7XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwiZXZhbCBjb25kaXRpb25zXCJcbiAgfSApO1xufVxuZnVuY3Rpb24gTWF0Y2gocHJvcHMpIHtcbiAgcmV0dXJuIHByb3BzO1xufVxubGV0IEVycm9ycztcbmZ1bmN0aW9uIHJlc2V0RXJyb3JCb3VuZGFyaWVzKCkge1xuICBFcnJvcnMgJiYgWy4uLkVycm9yc10uZm9yRWFjaChmbiA9PiBmbigpKTtcbn1cbmZ1bmN0aW9uIEVycm9yQm91bmRhcnkocHJvcHMpIHtcbiAgbGV0IGVycjtcbiAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0ICYmIHNoYXJlZENvbmZpZy5sb2FkKSBlcnIgPSBzaGFyZWRDb25maWcubG9hZChzaGFyZWRDb25maWcuZ2V0Q29udGV4dElkKCkpO1xuICBjb25zdCBbZXJyb3JlZCwgc2V0RXJyb3JlZF0gPSBjcmVhdGVTaWduYWwoZXJyLCB7XG4gICAgbmFtZTogXCJlcnJvcmVkXCJcbiAgfSApO1xuICBFcnJvcnMgfHwgKEVycm9ycyA9IG5ldyBTZXQoKSk7XG4gIEVycm9ycy5hZGQoc2V0RXJyb3JlZCk7XG4gIG9uQ2xlYW51cCgoKSA9PiBFcnJvcnMuZGVsZXRlKHNldEVycm9yZWQpKTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGxldCBlO1xuICAgIGlmIChlID0gZXJyb3JlZCgpKSB7XG4gICAgICBjb25zdCBmID0gcHJvcHMuZmFsbGJhY2s7XG4gICAgICBpZiAoKHR5cGVvZiBmICE9PSBcImZ1bmN0aW9uXCIgfHwgZi5sZW5ndGggPT0gMCkpIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICByZXR1cm4gdHlwZW9mIGYgPT09IFwiZnVuY3Rpb25cIiAmJiBmLmxlbmd0aCA/IHVudHJhY2soKCkgPT4gZihlLCAoKSA9PiBzZXRFcnJvcmVkKCkpKSA6IGY7XG4gICAgfVxuICAgIHJldHVybiBjYXRjaEVycm9yKCgpID0+IHByb3BzLmNoaWxkcmVuLCBzZXRFcnJvcmVkKTtcbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJ2YWx1ZVwiXG4gIH0gKTtcbn1cblxuY29uc3Qgc3VzcGVuc2VMaXN0RXF1YWxzID0gKGEsIGIpID0+IGEuc2hvd0NvbnRlbnQgPT09IGIuc2hvd0NvbnRlbnQgJiYgYS5zaG93RmFsbGJhY2sgPT09IGIuc2hvd0ZhbGxiYWNrO1xuY29uc3QgU3VzcGVuc2VMaXN0Q29udGV4dCA9IC8qICNfX1BVUkVfXyAqL2NyZWF0ZUNvbnRleHQoKTtcbmZ1bmN0aW9uIFN1c3BlbnNlTGlzdChwcm9wcykge1xuICBsZXQgW3dyYXBwZXIsIHNldFdyYXBwZXJdID0gY3JlYXRlU2lnbmFsKCgpID0+ICh7XG4gICAgICBpbkZhbGxiYWNrOiBmYWxzZVxuICAgIH0pKSxcbiAgICBzaG93O1xuICBjb25zdCBsaXN0Q29udGV4dCA9IHVzZUNvbnRleHQoU3VzcGVuc2VMaXN0Q29udGV4dCk7XG4gIGNvbnN0IFtyZWdpc3RyeSwgc2V0UmVnaXN0cnldID0gY3JlYXRlU2lnbmFsKFtdKTtcbiAgaWYgKGxpc3RDb250ZXh0KSB7XG4gICAgc2hvdyA9IGxpc3RDb250ZXh0LnJlZ2lzdGVyKGNyZWF0ZU1lbW8oKCkgPT4gd3JhcHBlcigpKCkuaW5GYWxsYmFjaykpO1xuICB9XG4gIGNvbnN0IHJlc29sdmVkID0gY3JlYXRlTWVtbyhwcmV2ID0+IHtcbiAgICBjb25zdCByZXZlYWwgPSBwcm9wcy5yZXZlYWxPcmRlcixcbiAgICAgIHRhaWwgPSBwcm9wcy50YWlsLFxuICAgICAge1xuICAgICAgICBzaG93Q29udGVudCA9IHRydWUsXG4gICAgICAgIHNob3dGYWxsYmFjayA9IHRydWVcbiAgICAgIH0gPSBzaG93ID8gc2hvdygpIDoge30sXG4gICAgICByZWcgPSByZWdpc3RyeSgpLFxuICAgICAgcmV2ZXJzZSA9IHJldmVhbCA9PT0gXCJiYWNrd2FyZHNcIjtcbiAgICBpZiAocmV2ZWFsID09PSBcInRvZ2V0aGVyXCIpIHtcbiAgICAgIGNvbnN0IGFsbCA9IHJlZy5ldmVyeShpbkZhbGxiYWNrID0+ICFpbkZhbGxiYWNrKCkpO1xuICAgICAgY29uc3QgcmVzID0gcmVnLm1hcCgoKSA9PiAoe1xuICAgICAgICBzaG93Q29udGVudDogYWxsICYmIHNob3dDb250ZW50LFxuICAgICAgICBzaG93RmFsbGJhY2tcbiAgICAgIH0pKTtcbiAgICAgIHJlcy5pbkZhbGxiYWNrID0gIWFsbDtcbiAgICAgIHJldHVybiByZXM7XG4gICAgfVxuICAgIGxldCBzdG9wID0gZmFsc2U7XG4gICAgbGV0IGluRmFsbGJhY2sgPSBwcmV2LmluRmFsbGJhY2s7XG4gICAgY29uc3QgcmVzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHJlZy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgY29uc3QgbiA9IHJldmVyc2UgPyBsZW4gLSBpIC0gMSA6IGksXG4gICAgICAgIHMgPSByZWdbbl0oKTtcbiAgICAgIGlmICghc3RvcCAmJiAhcykge1xuICAgICAgICByZXNbbl0gPSB7XG4gICAgICAgICAgc2hvd0NvbnRlbnQsXG4gICAgICAgICAgc2hvd0ZhbGxiYWNrXG4gICAgICAgIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXh0ID0gIXN0b3A7XG4gICAgICAgIGlmIChuZXh0KSBpbkZhbGxiYWNrID0gdHJ1ZTtcbiAgICAgICAgcmVzW25dID0ge1xuICAgICAgICAgIHNob3dDb250ZW50OiBuZXh0LFxuICAgICAgICAgIHNob3dGYWxsYmFjazogIXRhaWwgfHwgbmV4dCAmJiB0YWlsID09PSBcImNvbGxhcHNlZFwiID8gc2hvd0ZhbGxiYWNrIDogZmFsc2VcbiAgICAgICAgfTtcbiAgICAgICAgc3RvcCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghc3RvcCkgaW5GYWxsYmFjayA9IGZhbHNlO1xuICAgIHJlcy5pbkZhbGxiYWNrID0gaW5GYWxsYmFjaztcbiAgICByZXR1cm4gcmVzO1xuICB9LCB7XG4gICAgaW5GYWxsYmFjazogZmFsc2VcbiAgfSk7XG4gIHNldFdyYXBwZXIoKCkgPT4gcmVzb2x2ZWQpO1xuICByZXR1cm4gY3JlYXRlQ29tcG9uZW50KFN1c3BlbnNlTGlzdENvbnRleHQuUHJvdmlkZXIsIHtcbiAgICB2YWx1ZToge1xuICAgICAgcmVnaXN0ZXI6IGluRmFsbGJhY2sgPT4ge1xuICAgICAgICBsZXQgaW5kZXg7XG4gICAgICAgIHNldFJlZ2lzdHJ5KHJlZ2lzdHJ5ID0+IHtcbiAgICAgICAgICBpbmRleCA9IHJlZ2lzdHJ5Lmxlbmd0aDtcbiAgICAgICAgICByZXR1cm4gWy4uLnJlZ2lzdHJ5LCBpbkZhbGxiYWNrXTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHJlc29sdmVkKClbaW5kZXhdLCB1bmRlZmluZWQsIHtcbiAgICAgICAgICBlcXVhbHM6IHN1c3BlbnNlTGlzdEVxdWFsc1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGdldCBjaGlsZHJlbigpIHtcbiAgICAgIHJldHVybiBwcm9wcy5jaGlsZHJlbjtcbiAgICB9XG4gIH0pO1xufVxuZnVuY3Rpb24gU3VzcGVuc2UocHJvcHMpIHtcbiAgbGV0IGNvdW50ZXIgPSAwLFxuICAgIHNob3csXG4gICAgY3R4LFxuICAgIHAsXG4gICAgZmxpY2tlcixcbiAgICBlcnJvcjtcbiAgY29uc3QgW2luRmFsbGJhY2ssIHNldEZhbGxiYWNrXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSksXG4gICAgU3VzcGVuc2VDb250ZXh0ID0gZ2V0U3VzcGVuc2VDb250ZXh0KCksXG4gICAgc3RvcmUgPSB7XG4gICAgICBpbmNyZW1lbnQ6ICgpID0+IHtcbiAgICAgICAgaWYgKCsrY291bnRlciA9PT0gMSkgc2V0RmFsbGJhY2sodHJ1ZSk7XG4gICAgICB9LFxuICAgICAgZGVjcmVtZW50OiAoKSA9PiB7XG4gICAgICAgIGlmICgtLWNvdW50ZXIgPT09IDApIHNldEZhbGxiYWNrKGZhbHNlKTtcbiAgICAgIH0sXG4gICAgICBpbkZhbGxiYWNrLFxuICAgICAgZWZmZWN0czogW10sXG4gICAgICByZXNvbHZlZDogZmFsc2VcbiAgICB9LFxuICAgIG93bmVyID0gZ2V0T3duZXIoKTtcbiAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0ICYmIHNoYXJlZENvbmZpZy5sb2FkKSB7XG4gICAgY29uc3Qga2V5ID0gc2hhcmVkQ29uZmlnLmdldENvbnRleHRJZCgpO1xuICAgIGxldCByZWYgPSBzaGFyZWRDb25maWcubG9hZChrZXkpO1xuICAgIGlmIChyZWYpIHtcbiAgICAgIGlmICh0eXBlb2YgcmVmICE9PSBcIm9iamVjdFwiIHx8IHJlZi5zICE9PSAxKSBwID0gcmVmO2Vsc2Ugc2hhcmVkQ29uZmlnLmdhdGhlcihrZXkpO1xuICAgIH1cbiAgICBpZiAocCAmJiBwICE9PSBcIiQkZlwiKSB7XG4gICAgICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQsIHtcbiAgICAgICAgZXF1YWxzOiBmYWxzZVxuICAgICAgfSk7XG4gICAgICBmbGlja2VyID0gcztcbiAgICAgIHAudGhlbigoKSA9PiB7XG4gICAgICAgIGlmIChzaGFyZWRDb25maWcuZG9uZSkgcmV0dXJuIHNldCgpO1xuICAgICAgICBzaGFyZWRDb25maWcuZ2F0aGVyKGtleSk7XG4gICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGN0eCk7XG4gICAgICAgIHNldCgpO1xuICAgICAgICBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICAgICAgfSwgZXJyID0+IHtcbiAgICAgICAgZXJyb3IgPSBlcnI7XG4gICAgICAgIHNldCgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGNvbnN0IGxpc3RDb250ZXh0ID0gdXNlQ29udGV4dChTdXNwZW5zZUxpc3RDb250ZXh0KTtcbiAgaWYgKGxpc3RDb250ZXh0KSBzaG93ID0gbGlzdENvbnRleHQucmVnaXN0ZXIoc3RvcmUuaW5GYWxsYmFjayk7XG4gIGxldCBkaXNwb3NlO1xuICBvbkNsZWFudXAoKCkgPT4gZGlzcG9zZSAmJiBkaXNwb3NlKCkpO1xuICByZXR1cm4gY3JlYXRlQ29tcG9uZW50KFN1c3BlbnNlQ29udGV4dC5Qcm92aWRlciwge1xuICAgIHZhbHVlOiBzdG9yZSxcbiAgICBnZXQgY2hpbGRyZW4oKSB7XG4gICAgICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikgdGhyb3cgZXJyb3I7XG4gICAgICAgIGN0eCA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICAgICAgICBpZiAoZmxpY2tlcikge1xuICAgICAgICAgIGZsaWNrZXIoKTtcbiAgICAgICAgICByZXR1cm4gZmxpY2tlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY3R4ICYmIHAgPT09IFwiJCRmXCIpIHNldEh5ZHJhdGVDb250ZXh0KCk7XG4gICAgICAgIGNvbnN0IHJlbmRlcmVkID0gY3JlYXRlTWVtbygoKSA9PiBwcm9wcy5jaGlsZHJlbik7XG4gICAgICAgIHJldHVybiBjcmVhdGVNZW1vKHByZXYgPT4ge1xuICAgICAgICAgIGNvbnN0IGluRmFsbGJhY2sgPSBzdG9yZS5pbkZhbGxiYWNrKCksXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHNob3dDb250ZW50ID0gdHJ1ZSxcbiAgICAgICAgICAgICAgc2hvd0ZhbGxiYWNrID0gdHJ1ZVxuICAgICAgICAgICAgfSA9IHNob3cgPyBzaG93KCkgOiB7fTtcbiAgICAgICAgICBpZiAoKCFpbkZhbGxiYWNrIHx8IHAgJiYgcCAhPT0gXCIkJGZcIikgJiYgc2hvd0NvbnRlbnQpIHtcbiAgICAgICAgICAgIHN0b3JlLnJlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGRpc3Bvc2UgJiYgZGlzcG9zZSgpO1xuICAgICAgICAgICAgZGlzcG9zZSA9IGN0eCA9IHAgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICByZXN1bWVFZmZlY3RzKHN0b3JlLmVmZmVjdHMpO1xuICAgICAgICAgICAgcmV0dXJuIHJlbmRlcmVkKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghc2hvd0ZhbGxiYWNrKSByZXR1cm47XG4gICAgICAgICAgaWYgKGRpc3Bvc2UpIHJldHVybiBwcmV2O1xuICAgICAgICAgIHJldHVybiBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgICAgIGRpc3Bvc2UgPSBkaXNwb3NlcjtcbiAgICAgICAgICAgIGlmIChjdHgpIHtcbiAgICAgICAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoe1xuICAgICAgICAgICAgICAgIGlkOiBjdHguaWQgKyBcIkZcIixcbiAgICAgICAgICAgICAgICBjb3VudDogMFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgY3R4ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHByb3BzLmZhbGxiYWNrO1xuICAgICAgICAgIH0sIG93bmVyKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xufVxuXG5jb25zdCBERVYgPSB7XG4gIGhvb2tzOiBEZXZIb29rcyxcbiAgd3JpdGVTaWduYWwsXG4gIHJlZ2lzdGVyR3JhcGhcbn0gO1xuaWYgKGdsb2JhbFRoaXMpIHtcbiAgaWYgKCFnbG9iYWxUaGlzLlNvbGlkJCQpIGdsb2JhbFRoaXMuU29saWQkJCA9IHRydWU7ZWxzZSBjb25zb2xlLndhcm4oXCJZb3UgYXBwZWFyIHRvIGhhdmUgbXVsdGlwbGUgaW5zdGFuY2VzIG9mIFNvbGlkLiBUaGlzIGNhbiBsZWFkIHRvIHVuZXhwZWN0ZWQgYmVoYXZpb3IuXCIpO1xufVxuXG5leHBvcnQgeyAkREVWQ09NUCwgJFBST1hZLCAkVFJBQ0ssIERFViwgRXJyb3JCb3VuZGFyeSwgRm9yLCBJbmRleCwgTWF0Y2gsIFNob3csIFN1c3BlbnNlLCBTdXNwZW5zZUxpc3QsIFN3aXRjaCwgYmF0Y2gsIGNhbmNlbENhbGxiYWNrLCBjYXRjaEVycm9yLCBjaGlsZHJlbiwgY3JlYXRlQ29tcG9uZW50LCBjcmVhdGVDb21wdXRlZCwgY3JlYXRlQ29udGV4dCwgY3JlYXRlRGVmZXJyZWQsIGNyZWF0ZUVmZmVjdCwgY3JlYXRlTWVtbywgY3JlYXRlUmVhY3Rpb24sIGNyZWF0ZVJlbmRlckVmZmVjdCwgY3JlYXRlUmVzb3VyY2UsIGNyZWF0ZVJvb3QsIGNyZWF0ZVNlbGVjdG9yLCBjcmVhdGVTaWduYWwsIGNyZWF0ZVVuaXF1ZUlkLCBlbmFibGVFeHRlcm5hbFNvdXJjZSwgZW5hYmxlSHlkcmF0aW9uLCBlbmFibGVTY2hlZHVsaW5nLCBlcXVhbEZuLCBmcm9tLCBnZXRMaXN0ZW5lciwgZ2V0T3duZXIsIGluZGV4QXJyYXksIGxhenksIG1hcEFycmF5LCBtZXJnZVByb3BzLCBvYnNlcnZhYmxlLCBvbiwgb25DbGVhbnVwLCBvbkVycm9yLCBvbk1vdW50LCByZXF1ZXN0Q2FsbGJhY2ssIHJlc2V0RXJyb3JCb3VuZGFyaWVzLCBydW5XaXRoT3duZXIsIHNoYXJlZENvbmZpZywgc3BsaXRQcm9wcywgc3RhcnRUcmFuc2l0aW9uLCB1bnRyYWNrLCB1c2VDb250ZXh0LCB1c2VUcmFuc2l0aW9uIH07XG4iLCJpbXBvcnQgeyBjcmVhdGVNZW1vLCBjcmVhdGVSb290LCBjcmVhdGVSZW5kZXJFZmZlY3QsIHVudHJhY2ssIHNoYXJlZENvbmZpZywgZW5hYmxlSHlkcmF0aW9uLCBnZXRPd25lciwgY3JlYXRlRWZmZWN0LCBydW5XaXRoT3duZXIsIGNyZWF0ZVNpZ25hbCwgb25DbGVhbnVwLCAkREVWQ09NUCwgc3BsaXRQcm9wcyB9IGZyb20gJ3NvbGlkLWpzJztcbmV4cG9ydCB7IEVycm9yQm91bmRhcnksIEZvciwgSW5kZXgsIE1hdGNoLCBTaG93LCBTdXNwZW5zZSwgU3VzcGVuc2VMaXN0LCBTd2l0Y2gsIGNyZWF0ZUNvbXBvbmVudCwgY3JlYXRlUmVuZGVyRWZmZWN0IGFzIGVmZmVjdCwgZ2V0T3duZXIsIG1lcmdlUHJvcHMsIHVudHJhY2sgfSBmcm9tICdzb2xpZC1qcyc7XG5cbmNvbnN0IGJvb2xlYW5zID0gW1wiYWxsb3dmdWxsc2NyZWVuXCIsIFwiYXN5bmNcIiwgXCJhdXRvZm9jdXNcIiwgXCJhdXRvcGxheVwiLCBcImNoZWNrZWRcIiwgXCJjb250cm9sc1wiLCBcImRlZmF1bHRcIiwgXCJkaXNhYmxlZFwiLCBcImZvcm1ub3ZhbGlkYXRlXCIsIFwiaGlkZGVuXCIsIFwiaW5kZXRlcm1pbmF0ZVwiLCBcImluZXJ0XCIsIFwiaXNtYXBcIiwgXCJsb29wXCIsIFwibXVsdGlwbGVcIiwgXCJtdXRlZFwiLCBcIm5vbW9kdWxlXCIsIFwibm92YWxpZGF0ZVwiLCBcIm9wZW5cIiwgXCJwbGF5c2lubGluZVwiLCBcInJlYWRvbmx5XCIsIFwicmVxdWlyZWRcIiwgXCJyZXZlcnNlZFwiLCBcInNlYW1sZXNzXCIsIFwic2VsZWN0ZWRcIl07XG5jb25zdCBQcm9wZXJ0aWVzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1wiY2xhc3NOYW1lXCIsIFwidmFsdWVcIiwgXCJyZWFkT25seVwiLCBcIm5vVmFsaWRhdGVcIiwgXCJmb3JtTm9WYWxpZGF0ZVwiLCBcImlzTWFwXCIsIFwibm9Nb2R1bGVcIiwgXCJwbGF5c0lubGluZVwiLCAuLi5ib29sZWFuc10pO1xuY29uc3QgQ2hpbGRQcm9wZXJ0aWVzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1wiaW5uZXJIVE1MXCIsIFwidGV4dENvbnRlbnRcIiwgXCJpbm5lclRleHRcIiwgXCJjaGlsZHJlblwiXSk7XG5jb25zdCBBbGlhc2VzID0gLyojX19QVVJFX18qL09iamVjdC5hc3NpZ24oT2JqZWN0LmNyZWF0ZShudWxsKSwge1xuICBjbGFzc05hbWU6IFwiY2xhc3NcIixcbiAgaHRtbEZvcjogXCJmb3JcIlxufSk7XG5jb25zdCBQcm9wQWxpYXNlcyA9IC8qI19fUFVSRV9fKi9PYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUobnVsbCksIHtcbiAgY2xhc3M6IFwiY2xhc3NOYW1lXCIsXG4gIG5vdmFsaWRhdGU6IHtcbiAgICAkOiBcIm5vVmFsaWRhdGVcIixcbiAgICBGT1JNOiAxXG4gIH0sXG4gIGZvcm1ub3ZhbGlkYXRlOiB7XG4gICAgJDogXCJmb3JtTm9WYWxpZGF0ZVwiLFxuICAgIEJVVFRPTjogMSxcbiAgICBJTlBVVDogMVxuICB9LFxuICBpc21hcDoge1xuICAgICQ6IFwiaXNNYXBcIixcbiAgICBJTUc6IDFcbiAgfSxcbiAgbm9tb2R1bGU6IHtcbiAgICAkOiBcIm5vTW9kdWxlXCIsXG4gICAgU0NSSVBUOiAxXG4gIH0sXG4gIHBsYXlzaW5saW5lOiB7XG4gICAgJDogXCJwbGF5c0lubGluZVwiLFxuICAgIFZJREVPOiAxXG4gIH0sXG4gIHJlYWRvbmx5OiB7XG4gICAgJDogXCJyZWFkT25seVwiLFxuICAgIElOUFVUOiAxLFxuICAgIFRFWFRBUkVBOiAxXG4gIH1cbn0pO1xuZnVuY3Rpb24gZ2V0UHJvcEFsaWFzKHByb3AsIHRhZ05hbWUpIHtcbiAgY29uc3QgYSA9IFByb3BBbGlhc2VzW3Byb3BdO1xuICByZXR1cm4gdHlwZW9mIGEgPT09IFwib2JqZWN0XCIgPyBhW3RhZ05hbWVdID8gYVtcIiRcIl0gOiB1bmRlZmluZWQgOiBhO1xufVxuY29uc3QgRGVsZWdhdGVkRXZlbnRzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1wiYmVmb3JlaW5wdXRcIiwgXCJjbGlja1wiLCBcImRibGNsaWNrXCIsIFwiY29udGV4dG1lbnVcIiwgXCJmb2N1c2luXCIsIFwiZm9jdXNvdXRcIiwgXCJpbnB1dFwiLCBcImtleWRvd25cIiwgXCJrZXl1cFwiLCBcIm1vdXNlZG93blwiLCBcIm1vdXNlbW92ZVwiLCBcIm1vdXNlb3V0XCIsIFwibW91c2VvdmVyXCIsIFwibW91c2V1cFwiLCBcInBvaW50ZXJkb3duXCIsIFwicG9pbnRlcm1vdmVcIiwgXCJwb2ludGVyb3V0XCIsIFwicG9pbnRlcm92ZXJcIiwgXCJwb2ludGVydXBcIiwgXCJ0b3VjaGVuZFwiLCBcInRvdWNobW92ZVwiLCBcInRvdWNoc3RhcnRcIl0pO1xuY29uc3QgU1ZHRWxlbWVudHMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXG5cImFsdEdseXBoXCIsIFwiYWx0R2x5cGhEZWZcIiwgXCJhbHRHbHlwaEl0ZW1cIiwgXCJhbmltYXRlXCIsIFwiYW5pbWF0ZUNvbG9yXCIsIFwiYW5pbWF0ZU1vdGlvblwiLCBcImFuaW1hdGVUcmFuc2Zvcm1cIiwgXCJjaXJjbGVcIiwgXCJjbGlwUGF0aFwiLCBcImNvbG9yLXByb2ZpbGVcIiwgXCJjdXJzb3JcIiwgXCJkZWZzXCIsIFwiZGVzY1wiLCBcImVsbGlwc2VcIiwgXCJmZUJsZW5kXCIsIFwiZmVDb2xvck1hdHJpeFwiLCBcImZlQ29tcG9uZW50VHJhbnNmZXJcIiwgXCJmZUNvbXBvc2l0ZVwiLCBcImZlQ29udm9sdmVNYXRyaXhcIiwgXCJmZURpZmZ1c2VMaWdodGluZ1wiLCBcImZlRGlzcGxhY2VtZW50TWFwXCIsIFwiZmVEaXN0YW50TGlnaHRcIiwgXCJmZURyb3BTaGFkb3dcIiwgXCJmZUZsb29kXCIsIFwiZmVGdW5jQVwiLCBcImZlRnVuY0JcIiwgXCJmZUZ1bmNHXCIsIFwiZmVGdW5jUlwiLCBcImZlR2F1c3NpYW5CbHVyXCIsIFwiZmVJbWFnZVwiLCBcImZlTWVyZ2VcIiwgXCJmZU1lcmdlTm9kZVwiLCBcImZlTW9ycGhvbG9neVwiLCBcImZlT2Zmc2V0XCIsIFwiZmVQb2ludExpZ2h0XCIsIFwiZmVTcGVjdWxhckxpZ2h0aW5nXCIsIFwiZmVTcG90TGlnaHRcIiwgXCJmZVRpbGVcIiwgXCJmZVR1cmJ1bGVuY2VcIiwgXCJmaWx0ZXJcIiwgXCJmb250XCIsIFwiZm9udC1mYWNlXCIsIFwiZm9udC1mYWNlLWZvcm1hdFwiLCBcImZvbnQtZmFjZS1uYW1lXCIsIFwiZm9udC1mYWNlLXNyY1wiLCBcImZvbnQtZmFjZS11cmlcIiwgXCJmb3JlaWduT2JqZWN0XCIsIFwiZ1wiLCBcImdseXBoXCIsIFwiZ2x5cGhSZWZcIiwgXCJoa2VyblwiLCBcImltYWdlXCIsIFwibGluZVwiLCBcImxpbmVhckdyYWRpZW50XCIsIFwibWFya2VyXCIsIFwibWFza1wiLCBcIm1ldGFkYXRhXCIsIFwibWlzc2luZy1nbHlwaFwiLCBcIm1wYXRoXCIsIFwicGF0aFwiLCBcInBhdHRlcm5cIiwgXCJwb2x5Z29uXCIsIFwicG9seWxpbmVcIiwgXCJyYWRpYWxHcmFkaWVudFwiLCBcInJlY3RcIixcblwic2V0XCIsIFwic3RvcFwiLFxuXCJzdmdcIiwgXCJzd2l0Y2hcIiwgXCJzeW1ib2xcIiwgXCJ0ZXh0XCIsIFwidGV4dFBhdGhcIixcblwidHJlZlwiLCBcInRzcGFuXCIsIFwidXNlXCIsIFwidmlld1wiLCBcInZrZXJuXCJdKTtcbmNvbnN0IFNWR05hbWVzcGFjZSA9IHtcbiAgeGxpbms6IFwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiLFxuICB4bWw6IFwiaHR0cDovL3d3dy53My5vcmcvWE1MLzE5OTgvbmFtZXNwYWNlXCJcbn07XG5jb25zdCBET01FbGVtZW50cyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImh0bWxcIiwgXCJiYXNlXCIsIFwiaGVhZFwiLCBcImxpbmtcIiwgXCJtZXRhXCIsIFwic3R5bGVcIiwgXCJ0aXRsZVwiLCBcImJvZHlcIiwgXCJhZGRyZXNzXCIsIFwiYXJ0aWNsZVwiLCBcImFzaWRlXCIsIFwiZm9vdGVyXCIsIFwiaGVhZGVyXCIsIFwibWFpblwiLCBcIm5hdlwiLCBcInNlY3Rpb25cIiwgXCJib2R5XCIsIFwiYmxvY2txdW90ZVwiLCBcImRkXCIsIFwiZGl2XCIsIFwiZGxcIiwgXCJkdFwiLCBcImZpZ2NhcHRpb25cIiwgXCJmaWd1cmVcIiwgXCJoclwiLCBcImxpXCIsIFwib2xcIiwgXCJwXCIsIFwicHJlXCIsIFwidWxcIiwgXCJhXCIsIFwiYWJiclwiLCBcImJcIiwgXCJiZGlcIiwgXCJiZG9cIiwgXCJiclwiLCBcImNpdGVcIiwgXCJjb2RlXCIsIFwiZGF0YVwiLCBcImRmblwiLCBcImVtXCIsIFwiaVwiLCBcImtiZFwiLCBcIm1hcmtcIiwgXCJxXCIsIFwicnBcIiwgXCJydFwiLCBcInJ1YnlcIiwgXCJzXCIsIFwic2FtcFwiLCBcInNtYWxsXCIsIFwic3BhblwiLCBcInN0cm9uZ1wiLCBcInN1YlwiLCBcInN1cFwiLCBcInRpbWVcIiwgXCJ1XCIsIFwidmFyXCIsIFwid2JyXCIsIFwiYXJlYVwiLCBcImF1ZGlvXCIsIFwiaW1nXCIsIFwibWFwXCIsIFwidHJhY2tcIiwgXCJ2aWRlb1wiLCBcImVtYmVkXCIsIFwiaWZyYW1lXCIsIFwib2JqZWN0XCIsIFwicGFyYW1cIiwgXCJwaWN0dXJlXCIsIFwicG9ydGFsXCIsIFwic291cmNlXCIsIFwic3ZnXCIsIFwibWF0aFwiLCBcImNhbnZhc1wiLCBcIm5vc2NyaXB0XCIsIFwic2NyaXB0XCIsIFwiZGVsXCIsIFwiaW5zXCIsIFwiY2FwdGlvblwiLCBcImNvbFwiLCBcImNvbGdyb3VwXCIsIFwidGFibGVcIiwgXCJ0Ym9keVwiLCBcInRkXCIsIFwidGZvb3RcIiwgXCJ0aFwiLCBcInRoZWFkXCIsIFwidHJcIiwgXCJidXR0b25cIiwgXCJkYXRhbGlzdFwiLCBcImZpZWxkc2V0XCIsIFwiZm9ybVwiLCBcImlucHV0XCIsIFwibGFiZWxcIiwgXCJsZWdlbmRcIiwgXCJtZXRlclwiLCBcIm9wdGdyb3VwXCIsIFwib3B0aW9uXCIsIFwib3V0cHV0XCIsIFwicHJvZ3Jlc3NcIiwgXCJzZWxlY3RcIiwgXCJ0ZXh0YXJlYVwiLCBcImRldGFpbHNcIiwgXCJkaWFsb2dcIiwgXCJtZW51XCIsIFwic3VtbWFyeVwiLCBcImRldGFpbHNcIiwgXCJzbG90XCIsIFwidGVtcGxhdGVcIiwgXCJhY3JvbnltXCIsIFwiYXBwbGV0XCIsIFwiYmFzZWZvbnRcIiwgXCJiZ3NvdW5kXCIsIFwiYmlnXCIsIFwiYmxpbmtcIiwgXCJjZW50ZXJcIiwgXCJjb250ZW50XCIsIFwiZGlyXCIsIFwiZm9udFwiLCBcImZyYW1lXCIsIFwiZnJhbWVzZXRcIiwgXCJoZ3JvdXBcIiwgXCJpbWFnZVwiLCBcImtleWdlblwiLCBcIm1hcnF1ZWVcIiwgXCJtZW51aXRlbVwiLCBcIm5vYnJcIiwgXCJub2VtYmVkXCIsIFwibm9mcmFtZXNcIiwgXCJwbGFpbnRleHRcIiwgXCJyYlwiLCBcInJ0Y1wiLCBcInNoYWRvd1wiLCBcInNwYWNlclwiLCBcInN0cmlrZVwiLCBcInR0XCIsIFwieG1wXCIsIFwiYVwiLCBcImFiYnJcIiwgXCJhY3JvbnltXCIsIFwiYWRkcmVzc1wiLCBcImFwcGxldFwiLCBcImFyZWFcIiwgXCJhcnRpY2xlXCIsIFwiYXNpZGVcIiwgXCJhdWRpb1wiLCBcImJcIiwgXCJiYXNlXCIsIFwiYmFzZWZvbnRcIiwgXCJiZGlcIiwgXCJiZG9cIiwgXCJiZ3NvdW5kXCIsIFwiYmlnXCIsIFwiYmxpbmtcIiwgXCJibG9ja3F1b3RlXCIsIFwiYm9keVwiLCBcImJyXCIsIFwiYnV0dG9uXCIsIFwiY2FudmFzXCIsIFwiY2FwdGlvblwiLCBcImNlbnRlclwiLCBcImNpdGVcIiwgXCJjb2RlXCIsIFwiY29sXCIsIFwiY29sZ3JvdXBcIiwgXCJjb250ZW50XCIsIFwiZGF0YVwiLCBcImRhdGFsaXN0XCIsIFwiZGRcIiwgXCJkZWxcIiwgXCJkZXRhaWxzXCIsIFwiZGZuXCIsIFwiZGlhbG9nXCIsIFwiZGlyXCIsIFwiZGl2XCIsIFwiZGxcIiwgXCJkdFwiLCBcImVtXCIsIFwiZW1iZWRcIiwgXCJmaWVsZHNldFwiLCBcImZpZ2NhcHRpb25cIiwgXCJmaWd1cmVcIiwgXCJmb250XCIsIFwiZm9vdGVyXCIsIFwiZm9ybVwiLCBcImZyYW1lXCIsIFwiZnJhbWVzZXRcIiwgXCJoZWFkXCIsIFwiaGVhZGVyXCIsIFwiaGdyb3VwXCIsIFwiaHJcIiwgXCJodG1sXCIsIFwiaVwiLCBcImlmcmFtZVwiLCBcImltYWdlXCIsIFwiaW1nXCIsIFwiaW5wdXRcIiwgXCJpbnNcIiwgXCJrYmRcIiwgXCJrZXlnZW5cIiwgXCJsYWJlbFwiLCBcImxlZ2VuZFwiLCBcImxpXCIsIFwibGlua1wiLCBcIm1haW5cIiwgXCJtYXBcIiwgXCJtYXJrXCIsIFwibWFycXVlZVwiLCBcIm1lbnVcIiwgXCJtZW51aXRlbVwiLCBcIm1ldGFcIiwgXCJtZXRlclwiLCBcIm5hdlwiLCBcIm5vYnJcIiwgXCJub2VtYmVkXCIsIFwibm9mcmFtZXNcIiwgXCJub3NjcmlwdFwiLCBcIm9iamVjdFwiLCBcIm9sXCIsIFwib3B0Z3JvdXBcIiwgXCJvcHRpb25cIiwgXCJvdXRwdXRcIiwgXCJwXCIsIFwicGFyYW1cIiwgXCJwaWN0dXJlXCIsIFwicGxhaW50ZXh0XCIsIFwicG9ydGFsXCIsIFwicHJlXCIsIFwicHJvZ3Jlc3NcIiwgXCJxXCIsIFwicmJcIiwgXCJycFwiLCBcInJ0XCIsIFwicnRjXCIsIFwicnVieVwiLCBcInNcIiwgXCJzYW1wXCIsIFwic2NyaXB0XCIsIFwic2VjdGlvblwiLCBcInNlbGVjdFwiLCBcInNoYWRvd1wiLCBcInNsb3RcIiwgXCJzbWFsbFwiLCBcInNvdXJjZVwiLCBcInNwYWNlclwiLCBcInNwYW5cIiwgXCJzdHJpa2VcIiwgXCJzdHJvbmdcIiwgXCJzdHlsZVwiLCBcInN1YlwiLCBcInN1bW1hcnlcIiwgXCJzdXBcIiwgXCJ0YWJsZVwiLCBcInRib2R5XCIsIFwidGRcIiwgXCJ0ZW1wbGF0ZVwiLCBcInRleHRhcmVhXCIsIFwidGZvb3RcIiwgXCJ0aFwiLCBcInRoZWFkXCIsIFwidGltZVwiLCBcInRpdGxlXCIsIFwidHJcIiwgXCJ0cmFja1wiLCBcInR0XCIsIFwidVwiLCBcInVsXCIsIFwidmFyXCIsIFwidmlkZW9cIiwgXCJ3YnJcIiwgXCJ4bXBcIiwgXCJpbnB1dFwiLCBcImgxXCIsIFwiaDJcIiwgXCJoM1wiLCBcImg0XCIsIFwiaDVcIiwgXCJoNlwiXSk7XG5cbmNvbnN0IG1lbW8gPSBmbiA9PiBjcmVhdGVNZW1vKCgpID0+IGZuKCkpO1xuXG5mdW5jdGlvbiByZWNvbmNpbGVBcnJheXMocGFyZW50Tm9kZSwgYSwgYikge1xuICBsZXQgYkxlbmd0aCA9IGIubGVuZ3RoLFxuICAgIGFFbmQgPSBhLmxlbmd0aCxcbiAgICBiRW5kID0gYkxlbmd0aCxcbiAgICBhU3RhcnQgPSAwLFxuICAgIGJTdGFydCA9IDAsXG4gICAgYWZ0ZXIgPSBhW2FFbmQgLSAxXS5uZXh0U2libGluZyxcbiAgICBtYXAgPSBudWxsO1xuICB3aGlsZSAoYVN0YXJ0IDwgYUVuZCB8fCBiU3RhcnQgPCBiRW5kKSB7XG4gICAgaWYgKGFbYVN0YXJ0XSA9PT0gYltiU3RhcnRdKSB7XG4gICAgICBhU3RhcnQrKztcbiAgICAgIGJTdGFydCsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHdoaWxlIChhW2FFbmQgLSAxXSA9PT0gYltiRW5kIC0gMV0pIHtcbiAgICAgIGFFbmQtLTtcbiAgICAgIGJFbmQtLTtcbiAgICB9XG4gICAgaWYgKGFFbmQgPT09IGFTdGFydCkge1xuICAgICAgY29uc3Qgbm9kZSA9IGJFbmQgPCBiTGVuZ3RoID8gYlN0YXJ0ID8gYltiU3RhcnQgLSAxXS5uZXh0U2libGluZyA6IGJbYkVuZCAtIGJTdGFydF0gOiBhZnRlcjtcbiAgICAgIHdoaWxlIChiU3RhcnQgPCBiRW5kKSBwYXJlbnROb2RlLmluc2VydEJlZm9yZShiW2JTdGFydCsrXSwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChiRW5kID09PSBiU3RhcnQpIHtcbiAgICAgIHdoaWxlIChhU3RhcnQgPCBhRW5kKSB7XG4gICAgICAgIGlmICghbWFwIHx8ICFtYXAuaGFzKGFbYVN0YXJ0XSkpIGFbYVN0YXJ0XS5yZW1vdmUoKTtcbiAgICAgICAgYVN0YXJ0Kys7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChhW2FTdGFydF0gPT09IGJbYkVuZCAtIDFdICYmIGJbYlN0YXJ0XSA9PT0gYVthRW5kIC0gMV0pIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBhWy0tYUVuZF0ubmV4dFNpYmxpbmc7XG4gICAgICBwYXJlbnROb2RlLmluc2VydEJlZm9yZShiW2JTdGFydCsrXSwgYVthU3RhcnQrK10ubmV4dFNpYmxpbmcpO1xuICAgICAgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYlstLWJFbmRdLCBub2RlKTtcbiAgICAgIGFbYUVuZF0gPSBiW2JFbmRdO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIW1hcCkge1xuICAgICAgICBtYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgIGxldCBpID0gYlN0YXJ0O1xuICAgICAgICB3aGlsZSAoaSA8IGJFbmQpIG1hcC5zZXQoYltpXSwgaSsrKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGluZGV4ID0gbWFwLmdldChhW2FTdGFydF0pO1xuICAgICAgaWYgKGluZGV4ICE9IG51bGwpIHtcbiAgICAgICAgaWYgKGJTdGFydCA8IGluZGV4ICYmIGluZGV4IDwgYkVuZCkge1xuICAgICAgICAgIGxldCBpID0gYVN0YXJ0LFxuICAgICAgICAgICAgc2VxdWVuY2UgPSAxLFxuICAgICAgICAgICAgdDtcbiAgICAgICAgICB3aGlsZSAoKytpIDwgYUVuZCAmJiBpIDwgYkVuZCkge1xuICAgICAgICAgICAgaWYgKCh0ID0gbWFwLmdldChhW2ldKSkgPT0gbnVsbCB8fCB0ICE9PSBpbmRleCArIHNlcXVlbmNlKSBicmVhaztcbiAgICAgICAgICAgIHNlcXVlbmNlKys7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzZXF1ZW5jZSA+IGluZGV4IC0gYlN0YXJ0KSB7XG4gICAgICAgICAgICBjb25zdCBub2RlID0gYVthU3RhcnRdO1xuICAgICAgICAgICAgd2hpbGUgKGJTdGFydCA8IGluZGV4KSBwYXJlbnROb2RlLmluc2VydEJlZm9yZShiW2JTdGFydCsrXSwgbm9kZSk7XG4gICAgICAgICAgfSBlbHNlIHBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGJbYlN0YXJ0KytdLCBhW2FTdGFydCsrXSk7XG4gICAgICAgIH0gZWxzZSBhU3RhcnQrKztcbiAgICAgIH0gZWxzZSBhW2FTdGFydCsrXS5yZW1vdmUoKTtcbiAgICB9XG4gIH1cbn1cblxuY29uc3QgJCRFVkVOVFMgPSBcIl8kRFhfREVMRUdBVEVcIjtcbmZ1bmN0aW9uIHJlbmRlcihjb2RlLCBlbGVtZW50LCBpbml0LCBvcHRpb25zID0ge30pIHtcbiAgaWYgKCFlbGVtZW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGBlbGVtZW50YCBwYXNzZWQgdG8gYHJlbmRlciguLi4sIGVsZW1lbnQpYCBkb2Vzbid0IGV4aXN0LiBNYWtlIHN1cmUgYGVsZW1lbnRgIGV4aXN0cyBpbiB0aGUgZG9jdW1lbnQuXCIpO1xuICB9XG4gIGxldCBkaXNwb3NlcjtcbiAgY3JlYXRlUm9vdChkaXNwb3NlID0+IHtcbiAgICBkaXNwb3NlciA9IGRpc3Bvc2U7XG4gICAgZWxlbWVudCA9PT0gZG9jdW1lbnQgPyBjb2RlKCkgOiBpbnNlcnQoZWxlbWVudCwgY29kZSgpLCBlbGVtZW50LmZpcnN0Q2hpbGQgPyBudWxsIDogdW5kZWZpbmVkLCBpbml0KTtcbiAgfSwgb3B0aW9ucy5vd25lcik7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgZGlzcG9zZXIoKTtcbiAgICBlbGVtZW50LnRleHRDb250ZW50ID0gXCJcIjtcbiAgfTtcbn1cbmZ1bmN0aW9uIHRlbXBsYXRlKGh0bWwsIGlzSW1wb3J0Tm9kZSwgaXNTVkcsIGlzTWF0aE1MKSB7XG4gIGxldCBub2RlO1xuICBjb25zdCBjcmVhdGUgPSAoKSA9PiB7XG4gICAgaWYgKGlzSHlkcmF0aW5nKCkpIHRocm93IG5ldyBFcnJvcihcIkZhaWxlZCBhdHRlbXB0IHRvIGNyZWF0ZSBuZXcgRE9NIGVsZW1lbnRzIGR1cmluZyBoeWRyYXRpb24uIENoZWNrIHRoYXQgdGhlIGxpYnJhcmllcyB5b3UgYXJlIHVzaW5nIHN1cHBvcnQgaHlkcmF0aW9uLlwiKTtcbiAgICBjb25zdCB0ID0gaXNNYXRoTUwgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8xOTk4L01hdGgvTWF0aE1MXCIsIFwidGVtcGxhdGVcIikgOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIik7XG4gICAgdC5pbm5lckhUTUwgPSBodG1sO1xuICAgIHJldHVybiBpc1NWRyA/IHQuY29udGVudC5maXJzdENoaWxkLmZpcnN0Q2hpbGQgOiBpc01hdGhNTCA/IHQuZmlyc3RDaGlsZCA6IHQuY29udGVudC5maXJzdENoaWxkO1xuICB9O1xuICBjb25zdCBmbiA9IGlzSW1wb3J0Tm9kZSA/ICgpID0+IHVudHJhY2soKCkgPT4gZG9jdW1lbnQuaW1wb3J0Tm9kZShub2RlIHx8IChub2RlID0gY3JlYXRlKCkpLCB0cnVlKSkgOiAoKSA9PiAobm9kZSB8fCAobm9kZSA9IGNyZWF0ZSgpKSkuY2xvbmVOb2RlKHRydWUpO1xuICBmbi5jbG9uZU5vZGUgPSBmbjtcbiAgcmV0dXJuIGZuO1xufVxuZnVuY3Rpb24gZGVsZWdhdGVFdmVudHMoZXZlbnROYW1lcywgZG9jdW1lbnQgPSB3aW5kb3cuZG9jdW1lbnQpIHtcbiAgY29uc3QgZSA9IGRvY3VtZW50WyQkRVZFTlRTXSB8fCAoZG9jdW1lbnRbJCRFVkVOVFNdID0gbmV3IFNldCgpKTtcbiAgZm9yIChsZXQgaSA9IDAsIGwgPSBldmVudE5hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGNvbnN0IG5hbWUgPSBldmVudE5hbWVzW2ldO1xuICAgIGlmICghZS5oYXMobmFtZSkpIHtcbiAgICAgIGUuYWRkKG5hbWUpO1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBldmVudEhhbmRsZXIpO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gY2xlYXJEZWxlZ2F0ZWRFdmVudHMoZG9jdW1lbnQgPSB3aW5kb3cuZG9jdW1lbnQpIHtcbiAgaWYgKGRvY3VtZW50WyQkRVZFTlRTXSkge1xuICAgIGZvciAobGV0IG5hbWUgb2YgZG9jdW1lbnRbJCRFVkVOVFNdLmtleXMoKSkgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBldmVudEhhbmRsZXIpO1xuICAgIGRlbGV0ZSBkb2N1bWVudFskJEVWRU5UU107XG4gIH1cbn1cbmZ1bmN0aW9uIHNldFByb3BlcnR5KG5vZGUsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBub2RlW25hbWVdID0gdmFsdWU7XG59XG5mdW5jdGlvbiBzZXRBdHRyaWJ1dGUobm9kZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIGlmICh2YWx1ZSA9PSBudWxsKSBub2RlLnJlbW92ZUF0dHJpYnV0ZShuYW1lKTtlbHNlIG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIHNldEF0dHJpYnV0ZU5TKG5vZGUsIG5hbWVzcGFjZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIGlmICh2YWx1ZSA9PSBudWxsKSBub2RlLnJlbW92ZUF0dHJpYnV0ZU5TKG5hbWVzcGFjZSwgbmFtZSk7ZWxzZSBub2RlLnNldEF0dHJpYnV0ZU5TKG5hbWVzcGFjZSwgbmFtZSwgdmFsdWUpO1xufVxuZnVuY3Rpb24gc2V0Qm9vbEF0dHJpYnV0ZShub2RlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgdmFsdWUgPyBub2RlLnNldEF0dHJpYnV0ZShuYW1lLCBcIlwiKSA6IG5vZGUucmVtb3ZlQXR0cmlidXRlKG5hbWUpO1xufVxuZnVuY3Rpb24gY2xhc3NOYW1lKG5vZGUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBpZiAodmFsdWUgPT0gbnVsbCkgbm9kZS5yZW1vdmVBdHRyaWJ1dGUoXCJjbGFzc1wiKTtlbHNlIG5vZGUuY2xhc3NOYW1lID0gdmFsdWU7XG59XG5mdW5jdGlvbiBhZGRFdmVudExpc3RlbmVyKG5vZGUsIG5hbWUsIGhhbmRsZXIsIGRlbGVnYXRlKSB7XG4gIGlmIChkZWxlZ2F0ZSkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KGhhbmRsZXIpKSB7XG4gICAgICBub2RlW2AkJCR7bmFtZX1gXSA9IGhhbmRsZXJbMF07XG4gICAgICBub2RlW2AkJCR7bmFtZX1EYXRhYF0gPSBoYW5kbGVyWzFdO1xuICAgIH0gZWxzZSBub2RlW2AkJCR7bmFtZX1gXSA9IGhhbmRsZXI7XG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShoYW5kbGVyKSkge1xuICAgIGNvbnN0IGhhbmRsZXJGbiA9IGhhbmRsZXJbMF07XG4gICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGhhbmRsZXJbMF0gPSBlID0+IGhhbmRsZXJGbi5jYWxsKG5vZGUsIGhhbmRsZXJbMV0sIGUpKTtcbiAgfSBlbHNlIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBoYW5kbGVyLCB0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiICYmIGhhbmRsZXIpO1xufVxuZnVuY3Rpb24gY2xhc3NMaXN0KG5vZGUsIHZhbHVlLCBwcmV2ID0ge30pIHtcbiAgY29uc3QgY2xhc3NLZXlzID0gT2JqZWN0LmtleXModmFsdWUgfHwge30pLFxuICAgIHByZXZLZXlzID0gT2JqZWN0LmtleXMocHJldik7XG4gIGxldCBpLCBsZW47XG4gIGZvciAoaSA9IDAsIGxlbiA9IHByZXZLZXlzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgY29uc3Qga2V5ID0gcHJldktleXNbaV07XG4gICAgaWYgKCFrZXkgfHwga2V5ID09PSBcInVuZGVmaW5lZFwiIHx8IHZhbHVlW2tleV0pIGNvbnRpbnVlO1xuICAgIHRvZ2dsZUNsYXNzS2V5KG5vZGUsIGtleSwgZmFsc2UpO1xuICAgIGRlbGV0ZSBwcmV2W2tleV07XG4gIH1cbiAgZm9yIChpID0gMCwgbGVuID0gY2xhc3NLZXlzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgY29uc3Qga2V5ID0gY2xhc3NLZXlzW2ldLFxuICAgICAgY2xhc3NWYWx1ZSA9ICEhdmFsdWVba2V5XTtcbiAgICBpZiAoIWtleSB8fCBrZXkgPT09IFwidW5kZWZpbmVkXCIgfHwgcHJldltrZXldID09PSBjbGFzc1ZhbHVlIHx8ICFjbGFzc1ZhbHVlKSBjb250aW51ZTtcbiAgICB0b2dnbGVDbGFzc0tleShub2RlLCBrZXksIHRydWUpO1xuICAgIHByZXZba2V5XSA9IGNsYXNzVmFsdWU7XG4gIH1cbiAgcmV0dXJuIHByZXY7XG59XG5mdW5jdGlvbiBzdHlsZShub2RlLCB2YWx1ZSwgcHJldikge1xuICBpZiAoIXZhbHVlKSByZXR1cm4gcHJldiA/IHNldEF0dHJpYnV0ZShub2RlLCBcInN0eWxlXCIpIDogdmFsdWU7XG4gIGNvbnN0IG5vZGVTdHlsZSA9IG5vZGUuc3R5bGU7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHJldHVybiBub2RlU3R5bGUuY3NzVGV4dCA9IHZhbHVlO1xuICB0eXBlb2YgcHJldiA9PT0gXCJzdHJpbmdcIiAmJiAobm9kZVN0eWxlLmNzc1RleHQgPSBwcmV2ID0gdW5kZWZpbmVkKTtcbiAgcHJldiB8fCAocHJldiA9IHt9KTtcbiAgdmFsdWUgfHwgKHZhbHVlID0ge30pO1xuICBsZXQgdiwgcztcbiAgZm9yIChzIGluIHByZXYpIHtcbiAgICB2YWx1ZVtzXSA9PSBudWxsICYmIG5vZGVTdHlsZS5yZW1vdmVQcm9wZXJ0eShzKTtcbiAgICBkZWxldGUgcHJldltzXTtcbiAgfVxuICBmb3IgKHMgaW4gdmFsdWUpIHtcbiAgICB2ID0gdmFsdWVbc107XG4gICAgaWYgKHYgIT09IHByZXZbc10pIHtcbiAgICAgIG5vZGVTdHlsZS5zZXRQcm9wZXJ0eShzLCB2KTtcbiAgICAgIHByZXZbc10gPSB2O1xuICAgIH1cbiAgfVxuICByZXR1cm4gcHJldjtcbn1cbmZ1bmN0aW9uIHNwcmVhZChub2RlLCBwcm9wcyA9IHt9LCBpc1NWRywgc2tpcENoaWxkcmVuKSB7XG4gIGNvbnN0IHByZXZQcm9wcyA9IHt9O1xuICBpZiAoIXNraXBDaGlsZHJlbikge1xuICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiBwcmV2UHJvcHMuY2hpbGRyZW4gPSBpbnNlcnRFeHByZXNzaW9uKG5vZGUsIHByb3BzLmNoaWxkcmVuLCBwcmV2UHJvcHMuY2hpbGRyZW4pKTtcbiAgfVxuICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gdHlwZW9mIHByb3BzLnJlZiA9PT0gXCJmdW5jdGlvblwiICYmIHVzZShwcm9wcy5yZWYsIG5vZGUpKTtcbiAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IGFzc2lnbihub2RlLCBwcm9wcywgaXNTVkcsIHRydWUsIHByZXZQcm9wcywgdHJ1ZSkpO1xuICByZXR1cm4gcHJldlByb3BzO1xufVxuZnVuY3Rpb24gZHluYW1pY1Byb3BlcnR5KHByb3BzLCBrZXkpIHtcbiAgY29uc3Qgc3JjID0gcHJvcHNba2V5XTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3BzLCBrZXksIHtcbiAgICBnZXQoKSB7XG4gICAgICByZXR1cm4gc3JjKCk7XG4gICAgfSxcbiAgICBlbnVtZXJhYmxlOiB0cnVlXG4gIH0pO1xuICByZXR1cm4gcHJvcHM7XG59XG5mdW5jdGlvbiB1c2UoZm4sIGVsZW1lbnQsIGFyZykge1xuICByZXR1cm4gdW50cmFjaygoKSA9PiBmbihlbGVtZW50LCBhcmcpKTtcbn1cbmZ1bmN0aW9uIGluc2VydChwYXJlbnQsIGFjY2Vzc29yLCBtYXJrZXIsIGluaXRpYWwpIHtcbiAgaWYgKG1hcmtlciAhPT0gdW5kZWZpbmVkICYmICFpbml0aWFsKSBpbml0aWFsID0gW107XG4gIGlmICh0eXBlb2YgYWNjZXNzb3IgIT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIGluc2VydEV4cHJlc3Npb24ocGFyZW50LCBhY2Nlc3NvciwgaW5pdGlhbCwgbWFya2VyKTtcbiAgY3JlYXRlUmVuZGVyRWZmZWN0KGN1cnJlbnQgPT4gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIGFjY2Vzc29yKCksIGN1cnJlbnQsIG1hcmtlciksIGluaXRpYWwpO1xufVxuZnVuY3Rpb24gYXNzaWduKG5vZGUsIHByb3BzLCBpc1NWRywgc2tpcENoaWxkcmVuLCBwcmV2UHJvcHMgPSB7fSwgc2tpcFJlZiA9IGZhbHNlKSB7XG4gIHByb3BzIHx8IChwcm9wcyA9IHt9KTtcbiAgZm9yIChjb25zdCBwcm9wIGluIHByZXZQcm9wcykge1xuICAgIGlmICghKHByb3AgaW4gcHJvcHMpKSB7XG4gICAgICBpZiAocHJvcCA9PT0gXCJjaGlsZHJlblwiKSBjb250aW51ZTtcbiAgICAgIHByZXZQcm9wc1twcm9wXSA9IGFzc2lnblByb3Aobm9kZSwgcHJvcCwgbnVsbCwgcHJldlByb3BzW3Byb3BdLCBpc1NWRywgc2tpcFJlZiwgcHJvcHMpO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IHByb3AgaW4gcHJvcHMpIHtcbiAgICBpZiAocHJvcCA9PT0gXCJjaGlsZHJlblwiKSB7XG4gICAgICBpZiAoIXNraXBDaGlsZHJlbikgaW5zZXJ0RXhwcmVzc2lvbihub2RlLCBwcm9wcy5jaGlsZHJlbik7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSBwcm9wc1twcm9wXTtcbiAgICBwcmV2UHJvcHNbcHJvcF0gPSBhc3NpZ25Qcm9wKG5vZGUsIHByb3AsIHZhbHVlLCBwcmV2UHJvcHNbcHJvcF0sIGlzU1ZHLCBza2lwUmVmLCBwcm9wcyk7XG4gIH1cbn1cbmZ1bmN0aW9uIGh5ZHJhdGUkMShjb2RlLCBlbGVtZW50LCBvcHRpb25zID0ge30pIHtcbiAgaWYgKGdsb2JhbFRoaXMuXyRIWS5kb25lKSByZXR1cm4gcmVuZGVyKGNvZGUsIGVsZW1lbnQsIFsuLi5lbGVtZW50LmNoaWxkTm9kZXNdLCBvcHRpb25zKTtcbiAgc2hhcmVkQ29uZmlnLmNvbXBsZXRlZCA9IGdsb2JhbFRoaXMuXyRIWS5jb21wbGV0ZWQ7XG4gIHNoYXJlZENvbmZpZy5ldmVudHMgPSBnbG9iYWxUaGlzLl8kSFkuZXZlbnRzO1xuICBzaGFyZWRDb25maWcubG9hZCA9IGlkID0+IGdsb2JhbFRoaXMuXyRIWS5yW2lkXTtcbiAgc2hhcmVkQ29uZmlnLmhhcyA9IGlkID0+IGlkIGluIGdsb2JhbFRoaXMuXyRIWS5yO1xuICBzaGFyZWRDb25maWcuZ2F0aGVyID0gcm9vdCA9PiBnYXRoZXJIeWRyYXRhYmxlKGVsZW1lbnQsIHJvb3QpO1xuICBzaGFyZWRDb25maWcucmVnaXN0cnkgPSBuZXcgTWFwKCk7XG4gIHNoYXJlZENvbmZpZy5jb250ZXh0ID0ge1xuICAgIGlkOiBvcHRpb25zLnJlbmRlcklkIHx8IFwiXCIsXG4gICAgY291bnQ6IDBcbiAgfTtcbiAgdHJ5IHtcbiAgICBnYXRoZXJIeWRyYXRhYmxlKGVsZW1lbnQsIG9wdGlvbnMucmVuZGVySWQpO1xuICAgIHJldHVybiByZW5kZXIoY29kZSwgZWxlbWVudCwgWy4uLmVsZW1lbnQuY2hpbGROb2Rlc10sIG9wdGlvbnMpO1xuICB9IGZpbmFsbHkge1xuICAgIHNoYXJlZENvbmZpZy5jb250ZXh0ID0gbnVsbDtcbiAgfVxufVxuZnVuY3Rpb24gZ2V0TmV4dEVsZW1lbnQodGVtcGxhdGUpIHtcbiAgbGV0IG5vZGUsXG4gICAga2V5LFxuICAgIGh5ZHJhdGluZyA9IGlzSHlkcmF0aW5nKCk7XG4gIGlmICghaHlkcmF0aW5nIHx8ICEobm9kZSA9IHNoYXJlZENvbmZpZy5yZWdpc3RyeS5nZXQoa2V5ID0gZ2V0SHlkcmF0aW9uS2V5KCkpKSkge1xuICAgIGlmIChoeWRyYXRpbmcpIHtcbiAgICAgIHNoYXJlZENvbmZpZy5kb25lID0gdHJ1ZTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSHlkcmF0aW9uIE1pc21hdGNoLiBVbmFibGUgdG8gZmluZCBET00gbm9kZXMgZm9yIGh5ZHJhdGlvbiBrZXk6ICR7a2V5fVxcbiR7dGVtcGxhdGUgPyB0ZW1wbGF0ZSgpLm91dGVySFRNTCA6IFwiXCJ9YCk7XG4gICAgfVxuICAgIHJldHVybiB0ZW1wbGF0ZSgpO1xuICB9XG4gIGlmIChzaGFyZWRDb25maWcuY29tcGxldGVkKSBzaGFyZWRDb25maWcuY29tcGxldGVkLmFkZChub2RlKTtcbiAgc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LmRlbGV0ZShrZXkpO1xuICByZXR1cm4gbm9kZTtcbn1cbmZ1bmN0aW9uIGdldE5leHRNYXRjaChlbCwgbm9kZU5hbWUpIHtcbiAgd2hpbGUgKGVsICYmIGVsLmxvY2FsTmFtZSAhPT0gbm9kZU5hbWUpIGVsID0gZWwubmV4dFNpYmxpbmc7XG4gIHJldHVybiBlbDtcbn1cbmZ1bmN0aW9uIGdldE5leHRNYXJrZXIoc3RhcnQpIHtcbiAgbGV0IGVuZCA9IHN0YXJ0LFxuICAgIGNvdW50ID0gMCxcbiAgICBjdXJyZW50ID0gW107XG4gIGlmIChpc0h5ZHJhdGluZyhzdGFydCkpIHtcbiAgICB3aGlsZSAoZW5kKSB7XG4gICAgICBpZiAoZW5kLm5vZGVUeXBlID09PSA4KSB7XG4gICAgICAgIGNvbnN0IHYgPSBlbmQubm9kZVZhbHVlO1xuICAgICAgICBpZiAodiA9PT0gXCIkXCIpIGNvdW50Kys7ZWxzZSBpZiAodiA9PT0gXCIvXCIpIHtcbiAgICAgICAgICBpZiAoY291bnQgPT09IDApIHJldHVybiBbZW5kLCBjdXJyZW50XTtcbiAgICAgICAgICBjb3VudC0tO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjdXJyZW50LnB1c2goZW5kKTtcbiAgICAgIGVuZCA9IGVuZC5uZXh0U2libGluZztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIFtlbmQsIGN1cnJlbnRdO1xufVxuZnVuY3Rpb24gcnVuSHlkcmF0aW9uRXZlbnRzKCkge1xuICBpZiAoc2hhcmVkQ29uZmlnLmV2ZW50cyAmJiAhc2hhcmVkQ29uZmlnLmV2ZW50cy5xdWV1ZWQpIHtcbiAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIGNvbXBsZXRlZCxcbiAgICAgICAgZXZlbnRzXG4gICAgICB9ID0gc2hhcmVkQ29uZmlnO1xuICAgICAgaWYgKCFldmVudHMpIHJldHVybjtcbiAgICAgIGV2ZW50cy5xdWV1ZWQgPSBmYWxzZTtcbiAgICAgIHdoaWxlIChldmVudHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IFtlbCwgZV0gPSBldmVudHNbMF07XG4gICAgICAgIGlmICghY29tcGxldGVkLmhhcyhlbCkpIHJldHVybjtcbiAgICAgICAgZXZlbnRzLnNoaWZ0KCk7XG4gICAgICAgIGV2ZW50SGFuZGxlcihlKTtcbiAgICAgIH1cbiAgICAgIGlmIChzaGFyZWRDb25maWcuZG9uZSkge1xuICAgICAgICBzaGFyZWRDb25maWcuZXZlbnRzID0gXyRIWS5ldmVudHMgPSBudWxsO1xuICAgICAgICBzaGFyZWRDb25maWcuY29tcGxldGVkID0gXyRIWS5jb21wbGV0ZWQgPSBudWxsO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHNoYXJlZENvbmZpZy5ldmVudHMucXVldWVkID0gdHJ1ZTtcbiAgfVxufVxuZnVuY3Rpb24gaXNIeWRyYXRpbmcobm9kZSkge1xuICByZXR1cm4gISFzaGFyZWRDb25maWcuY29udGV4dCAmJiAhc2hhcmVkQ29uZmlnLmRvbmUgJiYgKCFub2RlIHx8IG5vZGUuaXNDb25uZWN0ZWQpO1xufVxuZnVuY3Rpb24gdG9Qcm9wZXJ0eU5hbWUobmFtZSkge1xuICByZXR1cm4gbmFtZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoLy0oW2Etel0pL2csIChfLCB3KSA9PiB3LnRvVXBwZXJDYXNlKCkpO1xufVxuZnVuY3Rpb24gdG9nZ2xlQ2xhc3NLZXkobm9kZSwga2V5LCB2YWx1ZSkge1xuICBjb25zdCBjbGFzc05hbWVzID0ga2V5LnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICBmb3IgKGxldCBpID0gMCwgbmFtZUxlbiA9IGNsYXNzTmFtZXMubGVuZ3RoOyBpIDwgbmFtZUxlbjsgaSsrKSBub2RlLmNsYXNzTGlzdC50b2dnbGUoY2xhc3NOYW1lc1tpXSwgdmFsdWUpO1xufVxuZnVuY3Rpb24gYXNzaWduUHJvcChub2RlLCBwcm9wLCB2YWx1ZSwgcHJldiwgaXNTVkcsIHNraXBSZWYsIHByb3BzKSB7XG4gIGxldCBpc0NFLCBpc1Byb3AsIGlzQ2hpbGRQcm9wLCBwcm9wQWxpYXMsIGZvcmNlUHJvcDtcbiAgaWYgKHByb3AgPT09IFwic3R5bGVcIikgcmV0dXJuIHN0eWxlKG5vZGUsIHZhbHVlLCBwcmV2KTtcbiAgaWYgKHByb3AgPT09IFwiY2xhc3NMaXN0XCIpIHJldHVybiBjbGFzc0xpc3Qobm9kZSwgdmFsdWUsIHByZXYpO1xuICBpZiAodmFsdWUgPT09IHByZXYpIHJldHVybiBwcmV2O1xuICBpZiAocHJvcCA9PT0gXCJyZWZcIikge1xuICAgIGlmICghc2tpcFJlZikgdmFsdWUobm9kZSk7XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCAzKSA9PT0gXCJvbjpcIikge1xuICAgIGNvbnN0IGUgPSBwcm9wLnNsaWNlKDMpO1xuICAgIHByZXYgJiYgbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKGUsIHByZXYsIHR5cGVvZiBwcmV2ICE9PSBcImZ1bmN0aW9uXCIgJiYgcHJldik7XG4gICAgdmFsdWUgJiYgbm9kZS5hZGRFdmVudExpc3RlbmVyKGUsIHZhbHVlLCB0eXBlb2YgdmFsdWUgIT09IFwiZnVuY3Rpb25cIiAmJiB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCAxMCkgPT09IFwib25jYXB0dXJlOlwiKSB7XG4gICAgY29uc3QgZSA9IHByb3Auc2xpY2UoMTApO1xuICAgIHByZXYgJiYgbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKGUsIHByZXYsIHRydWUpO1xuICAgIHZhbHVlICYmIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihlLCB2YWx1ZSwgdHJ1ZSk7XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCAyKSA9PT0gXCJvblwiKSB7XG4gICAgY29uc3QgbmFtZSA9IHByb3Auc2xpY2UoMikudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBkZWxlZ2F0ZSA9IERlbGVnYXRlZEV2ZW50cy5oYXMobmFtZSk7XG4gICAgaWYgKCFkZWxlZ2F0ZSAmJiBwcmV2KSB7XG4gICAgICBjb25zdCBoID0gQXJyYXkuaXNBcnJheShwcmV2KSA/IHByZXZbMF0gOiBwcmV2O1xuICAgICAgbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKG5hbWUsIGgpO1xuICAgIH1cbiAgICBpZiAoZGVsZWdhdGUgfHwgdmFsdWUpIHtcbiAgICAgIGFkZEV2ZW50TGlzdGVuZXIobm9kZSwgbmFtZSwgdmFsdWUsIGRlbGVnYXRlKTtcbiAgICAgIGRlbGVnYXRlICYmIGRlbGVnYXRlRXZlbnRzKFtuYW1lXSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgNSkgPT09IFwiYXR0cjpcIikge1xuICAgIHNldEF0dHJpYnV0ZShub2RlLCBwcm9wLnNsaWNlKDUpLCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCA1KSA9PT0gXCJib29sOlwiKSB7XG4gICAgc2V0Qm9vbEF0dHJpYnV0ZShub2RlLCBwcm9wLnNsaWNlKDUpLCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoKGZvcmNlUHJvcCA9IHByb3Auc2xpY2UoMCwgNSkgPT09IFwicHJvcDpcIikgfHwgKGlzQ2hpbGRQcm9wID0gQ2hpbGRQcm9wZXJ0aWVzLmhhcyhwcm9wKSkgfHwgIWlzU1ZHICYmICgocHJvcEFsaWFzID0gZ2V0UHJvcEFsaWFzKHByb3AsIG5vZGUudGFnTmFtZSkpIHx8IChpc1Byb3AgPSBQcm9wZXJ0aWVzLmhhcyhwcm9wKSkpIHx8IChpc0NFID0gbm9kZS5ub2RlTmFtZS5pbmNsdWRlcyhcIi1cIikgfHwgXCJpc1wiIGluIHByb3BzKSkge1xuICAgIGlmIChmb3JjZVByb3ApIHtcbiAgICAgIHByb3AgPSBwcm9wLnNsaWNlKDUpO1xuICAgICAgaXNQcm9wID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm4gdmFsdWU7XG4gICAgaWYgKHByb3AgPT09IFwiY2xhc3NcIiB8fCBwcm9wID09PSBcImNsYXNzTmFtZVwiKSBjbGFzc05hbWUobm9kZSwgdmFsdWUpO2Vsc2UgaWYgKGlzQ0UgJiYgIWlzUHJvcCAmJiAhaXNDaGlsZFByb3ApIG5vZGVbdG9Qcm9wZXJ0eU5hbWUocHJvcCldID0gdmFsdWU7ZWxzZSBub2RlW3Byb3BBbGlhcyB8fCBwcm9wXSA9IHZhbHVlO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IG5zID0gaXNTVkcgJiYgcHJvcC5pbmRleE9mKFwiOlwiKSA+IC0xICYmIFNWR05hbWVzcGFjZVtwcm9wLnNwbGl0KFwiOlwiKVswXV07XG4gICAgaWYgKG5zKSBzZXRBdHRyaWJ1dGVOUyhub2RlLCBucywgcHJvcCwgdmFsdWUpO2Vsc2Ugc2V0QXR0cmlidXRlKG5vZGUsIEFsaWFzZXNbcHJvcF0gfHwgcHJvcCwgdmFsdWUpO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIGV2ZW50SGFuZGxlcihlKSB7XG4gIGlmIChzaGFyZWRDb25maWcucmVnaXN0cnkgJiYgc2hhcmVkQ29uZmlnLmV2ZW50cykge1xuICAgIGlmIChzaGFyZWRDb25maWcuZXZlbnRzLmZpbmQoKFtlbCwgZXZdKSA9PiBldiA9PT0gZSkpIHJldHVybjtcbiAgfVxuICBsZXQgbm9kZSA9IGUudGFyZ2V0O1xuICBjb25zdCBrZXkgPSBgJCQke2UudHlwZX1gO1xuICBjb25zdCBvcmlUYXJnZXQgPSBlLnRhcmdldDtcbiAgY29uc3Qgb3JpQ3VycmVudFRhcmdldCA9IGUuY3VycmVudFRhcmdldDtcbiAgY29uc3QgcmV0YXJnZXQgPSB2YWx1ZSA9PiBPYmplY3QuZGVmaW5lUHJvcGVydHkoZSwgXCJ0YXJnZXRcIiwge1xuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB2YWx1ZVxuICB9KTtcbiAgY29uc3QgaGFuZGxlTm9kZSA9ICgpID0+IHtcbiAgICBjb25zdCBoYW5kbGVyID0gbm9kZVtrZXldO1xuICAgIGlmIChoYW5kbGVyICYmICFub2RlLmRpc2FibGVkKSB7XG4gICAgICBjb25zdCBkYXRhID0gbm9kZVtgJHtrZXl9RGF0YWBdO1xuICAgICAgZGF0YSAhPT0gdW5kZWZpbmVkID8gaGFuZGxlci5jYWxsKG5vZGUsIGRhdGEsIGUpIDogaGFuZGxlci5jYWxsKG5vZGUsIGUpO1xuICAgICAgaWYgKGUuY2FuY2VsQnViYmxlKSByZXR1cm47XG4gICAgfVxuICAgIG5vZGUuaG9zdCAmJiB0eXBlb2Ygbm9kZS5ob3N0ICE9PSBcInN0cmluZ1wiICYmICFub2RlLmhvc3QuXyRob3N0ICYmIG5vZGUuY29udGFpbnMoZS50YXJnZXQpICYmIHJldGFyZ2V0KG5vZGUuaG9zdCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG4gIGNvbnN0IHdhbGtVcFRyZWUgPSAoKSA9PiB7XG4gICAgd2hpbGUgKGhhbmRsZU5vZGUoKSAmJiAobm9kZSA9IG5vZGUuXyRob3N0IHx8IG5vZGUucGFyZW50Tm9kZSB8fCBub2RlLmhvc3QpKTtcbiAgfTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGUsIFwiY3VycmVudFRhcmdldFwiLCB7XG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIGdldCgpIHtcbiAgICAgIHJldHVybiBub2RlIHx8IGRvY3VtZW50O1xuICAgIH1cbiAgfSk7XG4gIGlmIChzaGFyZWRDb25maWcucmVnaXN0cnkgJiYgIXNoYXJlZENvbmZpZy5kb25lKSBzaGFyZWRDb25maWcuZG9uZSA9IF8kSFkuZG9uZSA9IHRydWU7XG4gIGlmIChlLmNvbXBvc2VkUGF0aCkge1xuICAgIGNvbnN0IHBhdGggPSBlLmNvbXBvc2VkUGF0aCgpO1xuICAgIHJldGFyZ2V0KHBhdGhbMF0pO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0aC5sZW5ndGggLSAyOyBpKyspIHtcbiAgICAgIG5vZGUgPSBwYXRoW2ldO1xuICAgICAgaWYgKCFoYW5kbGVOb2RlKCkpIGJyZWFrO1xuICAgICAgaWYgKG5vZGUuXyRob3N0KSB7XG4gICAgICAgIG5vZGUgPSBub2RlLl8kaG9zdDtcbiAgICAgICAgd2Fsa1VwVHJlZSgpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmIChub2RlLnBhcmVudE5vZGUgPT09IG9yaUN1cnJlbnRUYXJnZXQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGVsc2Ugd2Fsa1VwVHJlZSgpO1xuICByZXRhcmdldChvcmlUYXJnZXQpO1xufVxuZnVuY3Rpb24gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIHZhbHVlLCBjdXJyZW50LCBtYXJrZXIsIHVud3JhcEFycmF5KSB7XG4gIGNvbnN0IGh5ZHJhdGluZyA9IGlzSHlkcmF0aW5nKHBhcmVudCk7XG4gIGlmIChoeWRyYXRpbmcpIHtcbiAgICAhY3VycmVudCAmJiAoY3VycmVudCA9IFsuLi5wYXJlbnQuY2hpbGROb2Rlc10pO1xuICAgIGxldCBjbGVhbmVkID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjdXJyZW50Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBub2RlID0gY3VycmVudFtpXTtcbiAgICAgIGlmIChub2RlLm5vZGVUeXBlID09PSA4ICYmIG5vZGUuZGF0YS5zbGljZSgwLCAyKSA9PT0gXCIhJFwiKSBub2RlLnJlbW92ZSgpO2Vsc2UgY2xlYW5lZC5wdXNoKG5vZGUpO1xuICAgIH1cbiAgICBjdXJyZW50ID0gY2xlYW5lZDtcbiAgfVxuICB3aGlsZSAodHlwZW9mIGN1cnJlbnQgPT09IFwiZnVuY3Rpb25cIikgY3VycmVudCA9IGN1cnJlbnQoKTtcbiAgaWYgKHZhbHVlID09PSBjdXJyZW50KSByZXR1cm4gY3VycmVudDtcbiAgY29uc3QgdCA9IHR5cGVvZiB2YWx1ZSxcbiAgICBtdWx0aSA9IG1hcmtlciAhPT0gdW5kZWZpbmVkO1xuICBwYXJlbnQgPSBtdWx0aSAmJiBjdXJyZW50WzBdICYmIGN1cnJlbnRbMF0ucGFyZW50Tm9kZSB8fCBwYXJlbnQ7XG4gIGlmICh0ID09PSBcInN0cmluZ1wiIHx8IHQgPT09IFwibnVtYmVyXCIpIHtcbiAgICBpZiAoaHlkcmF0aW5nKSByZXR1cm4gY3VycmVudDtcbiAgICBpZiAodCA9PT0gXCJudW1iZXJcIikge1xuICAgICAgdmFsdWUgPSB2YWx1ZS50b1N0cmluZygpO1xuICAgICAgaWYgKHZhbHVlID09PSBjdXJyZW50KSByZXR1cm4gY3VycmVudDtcbiAgICB9XG4gICAgaWYgKG11bHRpKSB7XG4gICAgICBsZXQgbm9kZSA9IGN1cnJlbnRbMF07XG4gICAgICBpZiAobm9kZSAmJiBub2RlLm5vZGVUeXBlID09PSAzKSB7XG4gICAgICAgIG5vZGUuZGF0YSAhPT0gdmFsdWUgJiYgKG5vZGUuZGF0YSA9IHZhbHVlKTtcbiAgICAgIH0gZWxzZSBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodmFsdWUpO1xuICAgICAgY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIsIG5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoY3VycmVudCAhPT0gXCJcIiAmJiB0eXBlb2YgY3VycmVudCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICBjdXJyZW50ID0gcGFyZW50LmZpcnN0Q2hpbGQuZGF0YSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIGN1cnJlbnQgPSBwYXJlbnQudGV4dENvbnRlbnQgPSB2YWx1ZTtcbiAgICB9XG4gIH0gZWxzZSBpZiAodmFsdWUgPT0gbnVsbCB8fCB0ID09PSBcImJvb2xlYW5cIikge1xuICAgIGlmIChoeWRyYXRpbmcpIHJldHVybiBjdXJyZW50O1xuICAgIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyKTtcbiAgfSBlbHNlIGlmICh0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4ge1xuICAgICAgbGV0IHYgPSB2YWx1ZSgpO1xuICAgICAgd2hpbGUgKHR5cGVvZiB2ID09PSBcImZ1bmN0aW9uXCIpIHYgPSB2KCk7XG4gICAgICBjdXJyZW50ID0gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIHYsIGN1cnJlbnQsIG1hcmtlcik7XG4gICAgfSk7XG4gICAgcmV0dXJuICgpID0+IGN1cnJlbnQ7XG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICBjb25zdCBhcnJheSA9IFtdO1xuICAgIGNvbnN0IGN1cnJlbnRBcnJheSA9IGN1cnJlbnQgJiYgQXJyYXkuaXNBcnJheShjdXJyZW50KTtcbiAgICBpZiAobm9ybWFsaXplSW5jb21pbmdBcnJheShhcnJheSwgdmFsdWUsIGN1cnJlbnQsIHVud3JhcEFycmF5KSkge1xuICAgICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IGN1cnJlbnQgPSBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgYXJyYXksIGN1cnJlbnQsIG1hcmtlciwgdHJ1ZSkpO1xuICAgICAgcmV0dXJuICgpID0+IGN1cnJlbnQ7XG4gICAgfVxuICAgIGlmIChoeWRyYXRpbmcpIHtcbiAgICAgIGlmICghYXJyYXkubGVuZ3RoKSByZXR1cm4gY3VycmVudDtcbiAgICAgIGlmIChtYXJrZXIgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGN1cnJlbnQgPSBbLi4ucGFyZW50LmNoaWxkTm9kZXNdO1xuICAgICAgbGV0IG5vZGUgPSBhcnJheVswXTtcbiAgICAgIGlmIChub2RlLnBhcmVudE5vZGUgIT09IHBhcmVudCkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgICBjb25zdCBub2RlcyA9IFtub2RlXTtcbiAgICAgIHdoaWxlICgobm9kZSA9IG5vZGUubmV4dFNpYmxpbmcpICE9PSBtYXJrZXIpIG5vZGVzLnB1c2gobm9kZSk7XG4gICAgICByZXR1cm4gY3VycmVudCA9IG5vZGVzO1xuICAgIH1cbiAgICBpZiAoYXJyYXkubGVuZ3RoID09PSAwKSB7XG4gICAgICBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlcik7XG4gICAgICBpZiAobXVsdGkpIHJldHVybiBjdXJyZW50O1xuICAgIH0gZWxzZSBpZiAoY3VycmVudEFycmF5KSB7XG4gICAgICBpZiAoY3VycmVudC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgYXBwZW5kTm9kZXMocGFyZW50LCBhcnJheSwgbWFya2VyKTtcbiAgICAgIH0gZWxzZSByZWNvbmNpbGVBcnJheXMocGFyZW50LCBjdXJyZW50LCBhcnJheSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN1cnJlbnQgJiYgY2xlYW5DaGlsZHJlbihwYXJlbnQpO1xuICAgICAgYXBwZW5kTm9kZXMocGFyZW50LCBhcnJheSk7XG4gICAgfVxuICAgIGN1cnJlbnQgPSBhcnJheTtcbiAgfSBlbHNlIGlmICh2YWx1ZS5ub2RlVHlwZSkge1xuICAgIGlmIChoeWRyYXRpbmcgJiYgdmFsdWUucGFyZW50Tm9kZSkgcmV0dXJuIGN1cnJlbnQgPSBtdWx0aSA/IFt2YWx1ZV0gOiB2YWx1ZTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShjdXJyZW50KSkge1xuICAgICAgaWYgKG11bHRpKSByZXR1cm4gY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIsIHZhbHVlKTtcbiAgICAgIGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBudWxsLCB2YWx1ZSk7XG4gICAgfSBlbHNlIGlmIChjdXJyZW50ID09IG51bGwgfHwgY3VycmVudCA9PT0gXCJcIiB8fCAhcGFyZW50LmZpcnN0Q2hpbGQpIHtcbiAgICAgIHBhcmVudC5hcHBlbmRDaGlsZCh2YWx1ZSk7XG4gICAgfSBlbHNlIHBhcmVudC5yZXBsYWNlQ2hpbGQodmFsdWUsIHBhcmVudC5maXJzdENoaWxkKTtcbiAgICBjdXJyZW50ID0gdmFsdWU7XG4gIH0gZWxzZSBjb25zb2xlLndhcm4oYFVucmVjb2duaXplZCB2YWx1ZS4gU2tpcHBlZCBpbnNlcnRpbmdgLCB2YWx1ZSk7XG4gIHJldHVybiBjdXJyZW50O1xufVxuZnVuY3Rpb24gbm9ybWFsaXplSW5jb21pbmdBcnJheShub3JtYWxpemVkLCBhcnJheSwgY3VycmVudCwgdW53cmFwKSB7XG4gIGxldCBkeW5hbWljID0gZmFsc2U7XG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBhcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGxldCBpdGVtID0gYXJyYXlbaV0sXG4gICAgICBwcmV2ID0gY3VycmVudCAmJiBjdXJyZW50W25vcm1hbGl6ZWQubGVuZ3RoXSxcbiAgICAgIHQ7XG4gICAgaWYgKGl0ZW0gPT0gbnVsbCB8fCBpdGVtID09PSB0cnVlIHx8IGl0ZW0gPT09IGZhbHNlKSA7IGVsc2UgaWYgKCh0ID0gdHlwZW9mIGl0ZW0pID09PSBcIm9iamVjdFwiICYmIGl0ZW0ubm9kZVR5cGUpIHtcbiAgICAgIG5vcm1hbGl6ZWQucHVzaChpdGVtKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaXRlbSkpIHtcbiAgICAgIGR5bmFtaWMgPSBub3JtYWxpemVJbmNvbWluZ0FycmF5KG5vcm1hbGl6ZWQsIGl0ZW0sIHByZXYpIHx8IGR5bmFtaWM7XG4gICAgfSBlbHNlIGlmICh0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGlmICh1bndyYXApIHtcbiAgICAgICAgd2hpbGUgKHR5cGVvZiBpdGVtID09PSBcImZ1bmN0aW9uXCIpIGl0ZW0gPSBpdGVtKCk7XG4gICAgICAgIGR5bmFtaWMgPSBub3JtYWxpemVJbmNvbWluZ0FycmF5KG5vcm1hbGl6ZWQsIEFycmF5LmlzQXJyYXkoaXRlbSkgPyBpdGVtIDogW2l0ZW1dLCBBcnJheS5pc0FycmF5KHByZXYpID8gcHJldiA6IFtwcmV2XSkgfHwgZHluYW1pYztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5vcm1hbGl6ZWQucHVzaChpdGVtKTtcbiAgICAgICAgZHluYW1pYyA9IHRydWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gU3RyaW5nKGl0ZW0pO1xuICAgICAgaWYgKHByZXYgJiYgcHJldi5ub2RlVHlwZSA9PT0gMyAmJiBwcmV2LmRhdGEgPT09IHZhbHVlKSBub3JtYWxpemVkLnB1c2gocHJldik7ZWxzZSBub3JtYWxpemVkLnB1c2goZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodmFsdWUpKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGR5bmFtaWM7XG59XG5mdW5jdGlvbiBhcHBlbmROb2RlcyhwYXJlbnQsIGFycmF5LCBtYXJrZXIgPSBudWxsKSB7XG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBhcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykgcGFyZW50Lmluc2VydEJlZm9yZShhcnJheVtpXSwgbWFya2VyKTtcbn1cbmZ1bmN0aW9uIGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIsIHJlcGxhY2VtZW50KSB7XG4gIGlmIChtYXJrZXIgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHBhcmVudC50ZXh0Q29udGVudCA9IFwiXCI7XG4gIGNvbnN0IG5vZGUgPSByZXBsYWNlbWVudCB8fCBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIlwiKTtcbiAgaWYgKGN1cnJlbnQubGVuZ3RoKSB7XG4gICAgbGV0IGluc2VydGVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IGN1cnJlbnQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IGVsID0gY3VycmVudFtpXTtcbiAgICAgIGlmIChub2RlICE9PSBlbCkge1xuICAgICAgICBjb25zdCBpc1BhcmVudCA9IGVsLnBhcmVudE5vZGUgPT09IHBhcmVudDtcbiAgICAgICAgaWYgKCFpbnNlcnRlZCAmJiAhaSkgaXNQYXJlbnQgPyBwYXJlbnQucmVwbGFjZUNoaWxkKG5vZGUsIGVsKSA6IHBhcmVudC5pbnNlcnRCZWZvcmUobm9kZSwgbWFya2VyKTtlbHNlIGlzUGFyZW50ICYmIGVsLnJlbW92ZSgpO1xuICAgICAgfSBlbHNlIGluc2VydGVkID0gdHJ1ZTtcbiAgICB9XG4gIH0gZWxzZSBwYXJlbnQuaW5zZXJ0QmVmb3JlKG5vZGUsIG1hcmtlcik7XG4gIHJldHVybiBbbm9kZV07XG59XG5mdW5jdGlvbiBnYXRoZXJIeWRyYXRhYmxlKGVsZW1lbnQsIHJvb3QpIHtcbiAgY29uc3QgdGVtcGxhdGVzID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKGAqW2RhdGEtaGtdYCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcGxhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qgbm9kZSA9IHRlbXBsYXRlc1tpXTtcbiAgICBjb25zdCBrZXkgPSBub2RlLmdldEF0dHJpYnV0ZShcImRhdGEtaGtcIik7XG4gICAgaWYgKCghcm9vdCB8fCBrZXkuc3RhcnRzV2l0aChyb290KSkgJiYgIXNoYXJlZENvbmZpZy5yZWdpc3RyeS5oYXMoa2V5KSkgc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LnNldChrZXksIG5vZGUpO1xuICB9XG59XG5mdW5jdGlvbiBnZXRIeWRyYXRpb25LZXkoKSB7XG4gIHJldHVybiBzaGFyZWRDb25maWcuZ2V0TmV4dENvbnRleHRJZCgpO1xufVxuZnVuY3Rpb24gTm9IeWRyYXRpb24ocHJvcHMpIHtcbiAgcmV0dXJuIHNoYXJlZENvbmZpZy5jb250ZXh0ID8gdW5kZWZpbmVkIDogcHJvcHMuY2hpbGRyZW47XG59XG5mdW5jdGlvbiBIeWRyYXRpb24ocHJvcHMpIHtcbiAgcmV0dXJuIHByb3BzLmNoaWxkcmVuO1xufVxuY29uc3Qgdm9pZEZuID0gKCkgPT4gdW5kZWZpbmVkO1xuY29uc3QgUmVxdWVzdENvbnRleHQgPSBTeW1ib2woKTtcbmZ1bmN0aW9uIGlubmVySFRNTChwYXJlbnQsIGNvbnRlbnQpIHtcbiAgIXNoYXJlZENvbmZpZy5jb250ZXh0ICYmIChwYXJlbnQuaW5uZXJIVE1MID0gY29udGVudCk7XG59XG5cbmZ1bmN0aW9uIHRocm93SW5Ccm93c2VyKGZ1bmMpIHtcbiAgY29uc3QgZXJyID0gbmV3IEVycm9yKGAke2Z1bmMubmFtZX0gaXMgbm90IHN1cHBvcnRlZCBpbiB0aGUgYnJvd3NlciwgcmV0dXJuaW5nIHVuZGVmaW5lZGApO1xuICBjb25zb2xlLmVycm9yKGVycik7XG59XG5mdW5jdGlvbiByZW5kZXJUb1N0cmluZyhmbiwgb3B0aW9ucykge1xuICB0aHJvd0luQnJvd3NlcihyZW5kZXJUb1N0cmluZyk7XG59XG5mdW5jdGlvbiByZW5kZXJUb1N0cmluZ0FzeW5jKGZuLCBvcHRpb25zKSB7XG4gIHRocm93SW5Ccm93c2VyKHJlbmRlclRvU3RyaW5nQXN5bmMpO1xufVxuZnVuY3Rpb24gcmVuZGVyVG9TdHJlYW0oZm4sIG9wdGlvbnMpIHtcbiAgdGhyb3dJbkJyb3dzZXIocmVuZGVyVG9TdHJlYW0pO1xufVxuZnVuY3Rpb24gc3NyKHRlbXBsYXRlLCAuLi5ub2Rlcykge31cbmZ1bmN0aW9uIHNzckVsZW1lbnQobmFtZSwgcHJvcHMsIGNoaWxkcmVuLCBuZWVkc0lkKSB7fVxuZnVuY3Rpb24gc3NyQ2xhc3NMaXN0KHZhbHVlKSB7fVxuZnVuY3Rpb24gc3NyU3R5bGUodmFsdWUpIHt9XG5mdW5jdGlvbiBzc3JBdHRyaWJ1dGUoa2V5LCB2YWx1ZSkge31cbmZ1bmN0aW9uIHNzckh5ZHJhdGlvbktleSgpIHt9XG5mdW5jdGlvbiByZXNvbHZlU1NSTm9kZShub2RlKSB7fVxuZnVuY3Rpb24gZXNjYXBlKGh0bWwpIHt9XG5mdW5jdGlvbiBzc3JTcHJlYWQocHJvcHMsIGlzU1ZHLCBza2lwQ2hpbGRyZW4pIHt9XG5cbmNvbnN0IGlzU2VydmVyID0gZmFsc2U7XG5jb25zdCBpc0RldiA9IHRydWU7XG5jb25zdCBTVkdfTkFNRVNQQUNFID0gXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiO1xuZnVuY3Rpb24gY3JlYXRlRWxlbWVudCh0YWdOYW1lLCBpc1NWRyA9IGZhbHNlKSB7XG4gIHJldHVybiBpc1NWRyA/IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhTVkdfTkFNRVNQQUNFLCB0YWdOYW1lKSA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSk7XG59XG5jb25zdCBoeWRyYXRlID0gKC4uLmFyZ3MpID0+IHtcbiAgZW5hYmxlSHlkcmF0aW9uKCk7XG4gIHJldHVybiBoeWRyYXRlJDEoLi4uYXJncyk7XG59O1xuZnVuY3Rpb24gUG9ydGFsKHByb3BzKSB7XG4gIGNvbnN0IHtcbiAgICAgIHVzZVNoYWRvd1xuICAgIH0gPSBwcm9wcyxcbiAgICBtYXJrZXIgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIlwiKSxcbiAgICBtb3VudCA9ICgpID0+IHByb3BzLm1vdW50IHx8IGRvY3VtZW50LmJvZHksXG4gICAgb3duZXIgPSBnZXRPd25lcigpO1xuICBsZXQgY29udGVudDtcbiAgbGV0IGh5ZHJhdGluZyA9ICEhc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGh5ZHJhdGluZykgZ2V0T3duZXIoKS51c2VyID0gaHlkcmF0aW5nID0gZmFsc2U7XG4gICAgY29udGVudCB8fCAoY29udGVudCA9IHJ1bldpdGhPd25lcihvd25lciwgKCkgPT4gY3JlYXRlTWVtbygoKSA9PiBwcm9wcy5jaGlsZHJlbikpKTtcbiAgICBjb25zdCBlbCA9IG1vdW50KCk7XG4gICAgaWYgKGVsIGluc3RhbmNlb2YgSFRNTEhlYWRFbGVtZW50KSB7XG4gICAgICBjb25zdCBbY2xlYW4sIHNldENsZWFuXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gICAgICBjb25zdCBjbGVhbnVwID0gKCkgPT4gc2V0Q2xlYW4odHJ1ZSk7XG4gICAgICBjcmVhdGVSb290KGRpc3Bvc2UgPT4gaW5zZXJ0KGVsLCAoKSA9PiAhY2xlYW4oKSA/IGNvbnRlbnQoKSA6IGRpc3Bvc2UoKSwgbnVsbCkpO1xuICAgICAgb25DbGVhbnVwKGNsZWFudXApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBjb250YWluZXIgPSBjcmVhdGVFbGVtZW50KHByb3BzLmlzU1ZHID8gXCJnXCIgOiBcImRpdlwiLCBwcm9wcy5pc1NWRyksXG4gICAgICAgIHJlbmRlclJvb3QgPSB1c2VTaGFkb3cgJiYgY29udGFpbmVyLmF0dGFjaFNoYWRvdyA/IGNvbnRhaW5lci5hdHRhY2hTaGFkb3coe1xuICAgICAgICAgIG1vZGU6IFwib3BlblwiXG4gICAgICAgIH0pIDogY29udGFpbmVyO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvbnRhaW5lciwgXCJfJGhvc3RcIiwge1xuICAgICAgICBnZXQoKSB7XG4gICAgICAgICAgcmV0dXJuIG1hcmtlci5wYXJlbnROb2RlO1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0pO1xuICAgICAgaW5zZXJ0KHJlbmRlclJvb3QsIGNvbnRlbnQpO1xuICAgICAgZWwuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcbiAgICAgIHByb3BzLnJlZiAmJiBwcm9wcy5yZWYoY29udGFpbmVyKTtcbiAgICAgIG9uQ2xlYW51cCgoKSA9PiBlbC5yZW1vdmVDaGlsZChjb250YWluZXIpKTtcbiAgICB9XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIHJlbmRlcjogIWh5ZHJhdGluZ1xuICB9KTtcbiAgcmV0dXJuIG1hcmtlcjtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUR5bmFtaWMoY29tcG9uZW50LCBwcm9wcykge1xuICBjb25zdCBjYWNoZWQgPSBjcmVhdGVNZW1vKGNvbXBvbmVudCk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBjb21wb25lbnQgPSBjYWNoZWQoKTtcbiAgICBzd2l0Y2ggKHR5cGVvZiBjb21wb25lbnQpIHtcbiAgICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgICBPYmplY3QuYXNzaWduKGNvbXBvbmVudCwge1xuICAgICAgICAgIFskREVWQ09NUF06IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB1bnRyYWNrKCgpID0+IGNvbXBvbmVudChwcm9wcykpO1xuICAgICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgICBjb25zdCBpc1N2ZyA9IFNWR0VsZW1lbnRzLmhhcyhjb21wb25lbnQpO1xuICAgICAgICBjb25zdCBlbCA9IHNoYXJlZENvbmZpZy5jb250ZXh0ID8gZ2V0TmV4dEVsZW1lbnQoKSA6IGNyZWF0ZUVsZW1lbnQoY29tcG9uZW50LCBpc1N2Zyk7XG4gICAgICAgIHNwcmVhZChlbCwgcHJvcHMsIGlzU3ZnKTtcbiAgICAgICAgcmV0dXJuIGVsO1xuICAgIH1cbiAgfSk7XG59XG5mdW5jdGlvbiBEeW5hbWljKHByb3BzKSB7XG4gIGNvbnN0IFssIG90aGVyc10gPSBzcGxpdFByb3BzKHByb3BzLCBbXCJjb21wb25lbnRcIl0pO1xuICByZXR1cm4gY3JlYXRlRHluYW1pYygoKSA9PiBwcm9wcy5jb21wb25lbnQsIG90aGVycyk7XG59XG5cbmV4cG9ydCB7IEFsaWFzZXMsIHZvaWRGbiBhcyBBc3NldHMsIENoaWxkUHJvcGVydGllcywgRE9NRWxlbWVudHMsIERlbGVnYXRlZEV2ZW50cywgRHluYW1pYywgSHlkcmF0aW9uLCB2b2lkRm4gYXMgSHlkcmF0aW9uU2NyaXB0LCBOb0h5ZHJhdGlvbiwgUG9ydGFsLCBQcm9wZXJ0aWVzLCBSZXF1ZXN0Q29udGV4dCwgU1ZHRWxlbWVudHMsIFNWR05hbWVzcGFjZSwgYWRkRXZlbnRMaXN0ZW5lciwgYXNzaWduLCBjbGFzc0xpc3QsIGNsYXNzTmFtZSwgY2xlYXJEZWxlZ2F0ZWRFdmVudHMsIGNyZWF0ZUR5bmFtaWMsIGRlbGVnYXRlRXZlbnRzLCBkeW5hbWljUHJvcGVydHksIGVzY2FwZSwgdm9pZEZuIGFzIGdlbmVyYXRlSHlkcmF0aW9uU2NyaXB0LCB2b2lkRm4gYXMgZ2V0QXNzZXRzLCBnZXRIeWRyYXRpb25LZXksIGdldE5leHRFbGVtZW50LCBnZXROZXh0TWFya2VyLCBnZXROZXh0TWF0Y2gsIGdldFByb3BBbGlhcywgdm9pZEZuIGFzIGdldFJlcXVlc3RFdmVudCwgaHlkcmF0ZSwgaW5uZXJIVE1MLCBpbnNlcnQsIGlzRGV2LCBpc1NlcnZlciwgbWVtbywgcmVuZGVyLCByZW5kZXJUb1N0cmVhbSwgcmVuZGVyVG9TdHJpbmcsIHJlbmRlclRvU3RyaW5nQXN5bmMsIHJlc29sdmVTU1JOb2RlLCBydW5IeWRyYXRpb25FdmVudHMsIHNldEF0dHJpYnV0ZSwgc2V0QXR0cmlidXRlTlMsIHNldEJvb2xBdHRyaWJ1dGUsIHNldFByb3BlcnR5LCBzcHJlYWQsIHNzciwgc3NyQXR0cmlidXRlLCBzc3JDbGFzc0xpc3QsIHNzckVsZW1lbnQsIHNzckh5ZHJhdGlvbktleSwgc3NyU3ByZWFkLCBzc3JTdHlsZSwgc3R5bGUsIHRlbXBsYXRlLCB1c2UsIHZvaWRGbiBhcyB1c2VBc3NldHMgfTtcbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsIi8vIEdlbmVyYXRlZCB1c2luZyBgbnBtIHJ1biBidWlsZGAuIERvIG5vdCBlZGl0LlxuXG52YXIgcmVnZXggPSAvXlthLXpdKD86W1xcLjAtOV9hLXpcXHhCN1xceEMwLVxceEQ2XFx4RDgtXFx4RjZcXHhGOC1cXHUwMzdEXFx1MDM3Ri1cXHUxRkZGXFx1MjAwQ1xcdTIwMERcXHUyMDNGXFx1MjA0MFxcdTIwNzAtXFx1MjE4RlxcdTJDMDAtXFx1MkZFRlxcdTMwMDEtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZGRF18W1xcdUQ4MDAtXFx1REI3Rl1bXFx1REMwMC1cXHVERkZGXSkqLSg/OltcXHgyRFxcLjAtOV9hLXpcXHhCN1xceEMwLVxceEQ2XFx4RDgtXFx4RjZcXHhGOC1cXHUwMzdEXFx1MDM3Ri1cXHUxRkZGXFx1MjAwQ1xcdTIwMERcXHUyMDNGXFx1MjA0MFxcdTIwNzAtXFx1MjE4RlxcdTJDMDAtXFx1MkZFRlxcdTMwMDEtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZGRF18W1xcdUQ4MDAtXFx1REI3Rl1bXFx1REMwMC1cXHVERkZGXSkqJC87XG5cbnZhciBpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lID0gZnVuY3Rpb24oc3RyaW5nKSB7XG5cdHJldHVybiByZWdleC50ZXN0KHN0cmluZyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWU7XG4iLCJ2YXIgX19hc3luYyA9IChfX3RoaXMsIF9fYXJndW1lbnRzLCBnZW5lcmF0b3IpID0+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICB2YXIgZnVsZmlsbGVkID0gKHZhbHVlKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciByZWplY3RlZCA9ICh2YWx1ZSkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgc3RlcChnZW5lcmF0b3IudGhyb3codmFsdWUpKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgfVxuICAgIH07XG4gICAgdmFyIHN0ZXAgPSAoeCkgPT4geC5kb25lID8gcmVzb2x2ZSh4LnZhbHVlKSA6IFByb21pc2UucmVzb2x2ZSh4LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpO1xuICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseShfX3RoaXMsIF9fYXJndW1lbnRzKSkubmV4dCgpKTtcbiAgfSk7XG59O1xuXG4vLyBzcmMvaW5kZXgudHNcbmltcG9ydCBpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lIGZyb20gXCJpcy1wb3RlbnRpYWwtY3VzdG9tLWVsZW1lbnQtbmFtZVwiO1xuZnVuY3Rpb24gY3JlYXRlSXNvbGF0ZWRFbGVtZW50KG9wdGlvbnMpIHtcbiAgcmV0dXJuIF9fYXN5bmModGhpcywgbnVsbCwgZnVuY3Rpb24qICgpIHtcbiAgICBjb25zdCB7IG5hbWUsIG1vZGUgPSBcImNsb3NlZFwiLCBjc3MsIGlzb2xhdGVFdmVudHMgPSBmYWxzZSB9ID0gb3B0aW9ucztcbiAgICBpZiAoIWlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUobmFtZSkpIHtcbiAgICAgIHRocm93IEVycm9yKFxuICAgICAgICBgXCIke25hbWV9XCIgaXMgbm90IGEgdmFsaWQgY3VzdG9tIGVsZW1lbnQgbmFtZS4gSXQgbXVzdCBiZSB0d28gd29yZHMgYW5kIGtlYmFiLWNhc2UsIHdpdGggYSBmZXcgZXhjZXB0aW9ucy4gU2VlIHNwZWMgZm9yIG1vcmUgZGV0YWlsczogaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2UvY3VzdG9tLWVsZW1lbnRzLmh0bWwjdmFsaWQtY3VzdG9tLWVsZW1lbnQtbmFtZWBcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IHBhcmVudEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KG5hbWUpO1xuICAgIGNvbnN0IHNoYWRvdyA9IHBhcmVudEVsZW1lbnQuYXR0YWNoU2hhZG93KHsgbW9kZSB9KTtcbiAgICBjb25zdCBpc29sYXRlZEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaHRtbFwiKTtcbiAgICBjb25zdCBib2R5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJvZHlcIik7XG4gICAgY29uc3QgaGVhZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJoZWFkXCIpO1xuICAgIGlmIChjc3MpIHtcbiAgICAgIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpO1xuICAgICAgaWYgKFwidXJsXCIgaW4gY3NzKSB7XG4gICAgICAgIHN0eWxlLnRleHRDb250ZW50ID0geWllbGQgZmV0Y2goY3NzLnVybCkudGhlbigocmVzKSA9PiByZXMudGV4dCgpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0eWxlLnRleHRDb250ZW50ID0gY3NzLnRleHRDb250ZW50O1xuICAgICAgfVxuICAgICAgaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7XG4gICAgfVxuICAgIGlzb2xhdGVkRWxlbWVudC5hcHBlbmRDaGlsZChoZWFkKTtcbiAgICBpc29sYXRlZEVsZW1lbnQuYXBwZW5kQ2hpbGQoYm9keSk7XG4gICAgc2hhZG93LmFwcGVuZENoaWxkKGlzb2xhdGVkRWxlbWVudCk7XG4gICAgaWYgKGlzb2xhdGVFdmVudHMpIHtcbiAgICAgIGNvbnN0IGV2ZW50VHlwZXMgPSBBcnJheS5pc0FycmF5KGlzb2xhdGVFdmVudHMpID8gaXNvbGF0ZUV2ZW50cyA6IFtcImtleWRvd25cIiwgXCJrZXl1cFwiLCBcImtleXByZXNzXCJdO1xuICAgICAgZXZlbnRUeXBlcy5mb3JFYWNoKChldmVudFR5cGUpID0+IHtcbiAgICAgICAgYm9keS5hZGRFdmVudExpc3RlbmVyKGV2ZW50VHlwZSwgKGUpID0+IGUuc3RvcFByb3BhZ2F0aW9uKCkpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBwYXJlbnRFbGVtZW50LFxuICAgICAgc2hhZG93LFxuICAgICAgaXNvbGF0ZWRFbGVtZW50OiBib2R5XG4gICAgfTtcbiAgfSk7XG59XG5leHBvcnQge1xuICBjcmVhdGVJc29sYXRlZEVsZW1lbnRcbn07XG4iLCJjb25zdCBudWxsS2V5ID0gU3ltYm9sKCdudWxsJyk7IC8vIGBvYmplY3RIYXNoZXNgIGtleSBmb3IgbnVsbFxuXG5sZXQga2V5Q291bnRlciA9IDA7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1hbnlLZXlzTWFwIGV4dGVuZHMgTWFwIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX29iamVjdEhhc2hlcyA9IG5ldyBXZWFrTWFwKCk7XG5cdFx0dGhpcy5fc3ltYm9sSGFzaGVzID0gbmV3IE1hcCgpOyAvLyBodHRwczovL2dpdGh1Yi5jb20vdGMzOS9lY21hMjYyL2lzc3Vlcy8xMTk0XG5cdFx0dGhpcy5fcHVibGljS2V5cyA9IG5ldyBNYXAoKTtcblxuXHRcdGNvbnN0IFtwYWlyc10gPSBhcmd1bWVudHM7IC8vIE1hcCBjb21wYXRcblx0XHRpZiAocGFpcnMgPT09IG51bGwgfHwgcGFpcnMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgcGFpcnNbU3ltYm9sLml0ZXJhdG9yXSAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcih0eXBlb2YgcGFpcnMgKyAnIGlzIG5vdCBpdGVyYWJsZSAoY2Fubm90IHJlYWQgcHJvcGVydHkgU3ltYm9sKFN5bWJvbC5pdGVyYXRvcikpJyk7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBba2V5cywgdmFsdWVdIG9mIHBhaXJzKSB7XG5cdFx0XHR0aGlzLnNldChrZXlzLCB2YWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0X2dldFB1YmxpY0tleXMoa2V5cywgY3JlYXRlID0gZmFsc2UpIHtcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoa2V5cykpIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBrZXlzIHBhcmFtZXRlciBtdXN0IGJlIGFuIGFycmF5Jyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJpdmF0ZUtleSA9IHRoaXMuX2dldFByaXZhdGVLZXkoa2V5cywgY3JlYXRlKTtcblxuXHRcdGxldCBwdWJsaWNLZXk7XG5cdFx0aWYgKHByaXZhdGVLZXkgJiYgdGhpcy5fcHVibGljS2V5cy5oYXMocHJpdmF0ZUtleSkpIHtcblx0XHRcdHB1YmxpY0tleSA9IHRoaXMuX3B1YmxpY0tleXMuZ2V0KHByaXZhdGVLZXkpO1xuXHRcdH0gZWxzZSBpZiAoY3JlYXRlKSB7XG5cdFx0XHRwdWJsaWNLZXkgPSBbLi4ua2V5c107IC8vIFJlZ2VuZXJhdGUga2V5cyBhcnJheSB0byBhdm9pZCBleHRlcm5hbCBpbnRlcmFjdGlvblxuXHRcdFx0dGhpcy5fcHVibGljS2V5cy5zZXQocHJpdmF0ZUtleSwgcHVibGljS2V5KTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge3ByaXZhdGVLZXksIHB1YmxpY0tleX07XG5cdH1cblxuXHRfZ2V0UHJpdmF0ZUtleShrZXlzLCBjcmVhdGUgPSBmYWxzZSkge1xuXHRcdGNvbnN0IHByaXZhdGVLZXlzID0gW107XG5cdFx0Zm9yIChsZXQga2V5IG9mIGtleXMpIHtcblx0XHRcdGlmIChrZXkgPT09IG51bGwpIHtcblx0XHRcdFx0a2V5ID0gbnVsbEtleTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaGFzaGVzID0gdHlwZW9mIGtleSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIGtleSA9PT0gJ2Z1bmN0aW9uJyA/ICdfb2JqZWN0SGFzaGVzJyA6ICh0eXBlb2Yga2V5ID09PSAnc3ltYm9sJyA/ICdfc3ltYm9sSGFzaGVzJyA6IGZhbHNlKTtcblxuXHRcdFx0aWYgKCFoYXNoZXMpIHtcblx0XHRcdFx0cHJpdmF0ZUtleXMucHVzaChrZXkpO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzW2hhc2hlc10uaGFzKGtleSkpIHtcblx0XHRcdFx0cHJpdmF0ZUtleXMucHVzaCh0aGlzW2hhc2hlc10uZ2V0KGtleSkpO1xuXHRcdFx0fSBlbHNlIGlmIChjcmVhdGUpIHtcblx0XHRcdFx0Y29uc3QgcHJpdmF0ZUtleSA9IGBAQG1rbS1yZWYtJHtrZXlDb3VudGVyKyt9QEBgO1xuXHRcdFx0XHR0aGlzW2hhc2hlc10uc2V0KGtleSwgcHJpdmF0ZUtleSk7XG5cdFx0XHRcdHByaXZhdGVLZXlzLnB1c2gocHJpdmF0ZUtleSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KHByaXZhdGVLZXlzKTtcblx0fVxuXG5cdHNldChrZXlzLCB2YWx1ZSkge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzLCB0cnVlKTtcblx0XHRyZXR1cm4gc3VwZXIuc2V0KHB1YmxpY0tleSwgdmFsdWUpO1xuXHR9XG5cblx0Z2V0KGtleXMpIHtcblx0XHRjb25zdCB7cHVibGljS2V5fSA9IHRoaXMuX2dldFB1YmxpY0tleXMoa2V5cyk7XG5cdFx0cmV0dXJuIHN1cGVyLmdldChwdWJsaWNLZXkpO1xuXHR9XG5cblx0aGFzKGtleXMpIHtcblx0XHRjb25zdCB7cHVibGljS2V5fSA9IHRoaXMuX2dldFB1YmxpY0tleXMoa2V5cyk7XG5cdFx0cmV0dXJuIHN1cGVyLmhhcyhwdWJsaWNLZXkpO1xuXHR9XG5cblx0ZGVsZXRlKGtleXMpIHtcblx0XHRjb25zdCB7cHVibGljS2V5LCBwcml2YXRlS2V5fSA9IHRoaXMuX2dldFB1YmxpY0tleXMoa2V5cyk7XG5cdFx0cmV0dXJuIEJvb2xlYW4ocHVibGljS2V5ICYmIHN1cGVyLmRlbGV0ZShwdWJsaWNLZXkpICYmIHRoaXMuX3B1YmxpY0tleXMuZGVsZXRlKHByaXZhdGVLZXkpKTtcblx0fVxuXG5cdGNsZWFyKCkge1xuXHRcdHN1cGVyLmNsZWFyKCk7XG5cdFx0dGhpcy5fc3ltYm9sSGFzaGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5fcHVibGljS2V5cy5jbGVhcigpO1xuXHR9XG5cblx0Z2V0IFtTeW1ib2wudG9TdHJpbmdUYWddKCkge1xuXHRcdHJldHVybiAnTWFueUtleXNNYXAnO1xuXHR9XG5cblx0Z2V0IHNpemUoKSB7XG5cdFx0cmV0dXJuIHN1cGVyLnNpemU7XG5cdH1cbn1cbiIsImZ1bmN0aW9uIGlzUGxhaW5PYmplY3QodmFsdWUpIHtcbiAgaWYgKHZhbHVlID09PSBudWxsIHx8IHR5cGVvZiB2YWx1ZSAhPT0gXCJvYmplY3RcIikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBwcm90b3R5cGUgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YodmFsdWUpO1xuICBpZiAocHJvdG90eXBlICE9PSBudWxsICYmIHByb3RvdHlwZSAhPT0gT2JqZWN0LnByb3RvdHlwZSAmJiBPYmplY3QuZ2V0UHJvdG90eXBlT2YocHJvdG90eXBlKSAhPT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoU3ltYm9sLml0ZXJhdG9yIGluIHZhbHVlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChTeW1ib2wudG9TdHJpbmdUYWcgaW4gdmFsdWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSA9PT0gXCJbb2JqZWN0IE1vZHVsZV1cIjtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gX2RlZnUoYmFzZU9iamVjdCwgZGVmYXVsdHMsIG5hbWVzcGFjZSA9IFwiLlwiLCBtZXJnZXIpIHtcbiAgaWYgKCFpc1BsYWluT2JqZWN0KGRlZmF1bHRzKSkge1xuICAgIHJldHVybiBfZGVmdShiYXNlT2JqZWN0LCB7fSwgbmFtZXNwYWNlLCBtZXJnZXIpO1xuICB9XG4gIGNvbnN0IG9iamVjdCA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRzKTtcbiAgZm9yIChjb25zdCBrZXkgaW4gYmFzZU9iamVjdCkge1xuICAgIGlmIChrZXkgPT09IFwiX19wcm90b19fXCIgfHwga2V5ID09PSBcImNvbnN0cnVjdG9yXCIpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZSA9IGJhc2VPYmplY3Rba2V5XTtcbiAgICBpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHZvaWQgMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChtZXJnZXIgJiYgbWVyZ2VyKG9iamVjdCwga2V5LCB2YWx1ZSwgbmFtZXNwYWNlKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSAmJiBBcnJheS5pc0FycmF5KG9iamVjdFtrZXldKSkge1xuICAgICAgb2JqZWN0W2tleV0gPSBbLi4udmFsdWUsIC4uLm9iamVjdFtrZXldXTtcbiAgICB9IGVsc2UgaWYgKGlzUGxhaW5PYmplY3QodmFsdWUpICYmIGlzUGxhaW5PYmplY3Qob2JqZWN0W2tleV0pKSB7XG4gICAgICBvYmplY3Rba2V5XSA9IF9kZWZ1KFxuICAgICAgICB2YWx1ZSxcbiAgICAgICAgb2JqZWN0W2tleV0sXG4gICAgICAgIChuYW1lc3BhY2UgPyBgJHtuYW1lc3BhY2V9LmAgOiBcIlwiKSArIGtleS50b1N0cmluZygpLFxuICAgICAgICBtZXJnZXJcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9iamVjdFtrZXldID0gdmFsdWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBvYmplY3Q7XG59XG5mdW5jdGlvbiBjcmVhdGVEZWZ1KG1lcmdlcikge1xuICByZXR1cm4gKC4uLmFyZ3VtZW50c18pID0+IChcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgdW5pY29ybi9uby1hcnJheS1yZWR1Y2VcbiAgICBhcmd1bWVudHNfLnJlZHVjZSgocCwgYykgPT4gX2RlZnUocCwgYywgXCJcIiwgbWVyZ2VyKSwge30pXG4gICk7XG59XG5jb25zdCBkZWZ1ID0gY3JlYXRlRGVmdSgpO1xuY29uc3QgZGVmdUZuID0gY3JlYXRlRGVmdSgob2JqZWN0LCBrZXksIGN1cnJlbnRWYWx1ZSkgPT4ge1xuICBpZiAob2JqZWN0W2tleV0gIT09IHZvaWQgMCAmJiB0eXBlb2YgY3VycmVudFZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBvYmplY3Rba2V5XSA9IGN1cnJlbnRWYWx1ZShvYmplY3Rba2V5XSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn0pO1xuY29uc3QgZGVmdUFycmF5Rm4gPSBjcmVhdGVEZWZ1KChvYmplY3QsIGtleSwgY3VycmVudFZhbHVlKSA9PiB7XG4gIGlmIChBcnJheS5pc0FycmF5KG9iamVjdFtrZXldKSAmJiB0eXBlb2YgY3VycmVudFZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBvYmplY3Rba2V5XSA9IGN1cnJlbnRWYWx1ZShvYmplY3Rba2V5XSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn0pO1xuXG5leHBvcnQgeyBjcmVhdGVEZWZ1LCBkZWZ1IGFzIGRlZmF1bHQsIGRlZnUsIGRlZnVBcnJheUZuLCBkZWZ1Rm4gfTtcbiIsImNvbnN0IGlzRXhpc3QgPSAoZWxlbWVudCkgPT4ge1xuICByZXR1cm4gZWxlbWVudCAhPT0gbnVsbCA/IHsgaXNEZXRlY3RlZDogdHJ1ZSwgcmVzdWx0OiBlbGVtZW50IH0gOiB7IGlzRGV0ZWN0ZWQ6IGZhbHNlIH07XG59O1xuY29uc3QgaXNOb3RFeGlzdCA9IChlbGVtZW50KSA9PiB7XG4gIHJldHVybiBlbGVtZW50ID09PSBudWxsID8geyBpc0RldGVjdGVkOiB0cnVlLCByZXN1bHQ6IG51bGwgfSA6IHsgaXNEZXRlY3RlZDogZmFsc2UgfTtcbn07XG5cbmV4cG9ydCB7IGlzRXhpc3QsIGlzTm90RXhpc3QgfTtcbiIsImltcG9ydCBNYW55S2V5c01hcCBmcm9tICdtYW55LWtleXMtbWFwJztcbmltcG9ydCB7IGRlZnUgfSBmcm9tICdkZWZ1JztcbmltcG9ydCB7IGlzRXhpc3QgfSBmcm9tICcuL2RldGVjdG9ycy5tanMnO1xuXG5jb25zdCBnZXREZWZhdWx0T3B0aW9ucyA9ICgpID0+ICh7XG4gIHRhcmdldDogZ2xvYmFsVGhpcy5kb2N1bWVudCxcbiAgdW5pZnlQcm9jZXNzOiB0cnVlLFxuICBkZXRlY3RvcjogaXNFeGlzdCxcbiAgb2JzZXJ2ZUNvbmZpZ3M6IHtcbiAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgc3VidHJlZTogdHJ1ZSxcbiAgICBhdHRyaWJ1dGVzOiB0cnVlXG4gIH0sXG4gIHNpZ25hbDogdm9pZCAwLFxuICBjdXN0b21NYXRjaGVyOiB2b2lkIDBcbn0pO1xuY29uc3QgbWVyZ2VPcHRpb25zID0gKHVzZXJTaWRlT3B0aW9ucywgZGVmYXVsdE9wdGlvbnMpID0+IHtcbiAgcmV0dXJuIGRlZnUodXNlclNpZGVPcHRpb25zLCBkZWZhdWx0T3B0aW9ucyk7XG59O1xuXG5jb25zdCB1bmlmeUNhY2hlID0gbmV3IE1hbnlLZXlzTWFwKCk7XG5mdW5jdGlvbiBjcmVhdGVXYWl0RWxlbWVudChpbnN0YW5jZU9wdGlvbnMpIHtcbiAgY29uc3QgeyBkZWZhdWx0T3B0aW9ucyB9ID0gaW5zdGFuY2VPcHRpb25zO1xuICByZXR1cm4gKHNlbGVjdG9yLCBvcHRpb25zKSA9PiB7XG4gICAgY29uc3Qge1xuICAgICAgdGFyZ2V0LFxuICAgICAgdW5pZnlQcm9jZXNzLFxuICAgICAgb2JzZXJ2ZUNvbmZpZ3MsXG4gICAgICBkZXRlY3RvcixcbiAgICAgIHNpZ25hbCxcbiAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICB9ID0gbWVyZ2VPcHRpb25zKG9wdGlvbnMsIGRlZmF1bHRPcHRpb25zKTtcbiAgICBjb25zdCB1bmlmeVByb21pc2VLZXkgPSBbXG4gICAgICBzZWxlY3RvcixcbiAgICAgIHRhcmdldCxcbiAgICAgIHVuaWZ5UHJvY2VzcyxcbiAgICAgIG9ic2VydmVDb25maWdzLFxuICAgICAgZGV0ZWN0b3IsXG4gICAgICBzaWduYWwsXG4gICAgICBjdXN0b21NYXRjaGVyXG4gICAgXTtcbiAgICBjb25zdCBjYWNoZWRQcm9taXNlID0gdW5pZnlDYWNoZS5nZXQodW5pZnlQcm9taXNlS2V5KTtcbiAgICBpZiAodW5pZnlQcm9jZXNzICYmIGNhY2hlZFByb21pc2UpIHtcbiAgICAgIHJldHVybiBjYWNoZWRQcm9taXNlO1xuICAgIH1cbiAgICBjb25zdCBkZXRlY3RQcm9taXNlID0gbmV3IFByb21pc2UoXG4gICAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQXN5bmNQcm9taXNlRXhlY3V0b3I6IGF2b2lkIG5lc3RpbmcgcHJvbWlzZVxuICAgICAgYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAoc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChzaWduYWwucmVhc29uKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKFxuICAgICAgICAgIGFzeW5jIChtdXRhdGlvbnMpID0+IHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgXyBvZiBtdXRhdGlvbnMpIHtcbiAgICAgICAgICAgICAgaWYgKHNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb25zdCBkZXRlY3RSZXN1bHQyID0gYXdhaXQgZGV0ZWN0RWxlbWVudCh7XG4gICAgICAgICAgICAgICAgc2VsZWN0b3IsXG4gICAgICAgICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgICAgICAgIGRldGVjdG9yLFxuICAgICAgICAgICAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGlmIChkZXRlY3RSZXN1bHQyLmlzRGV0ZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShkZXRlY3RSZXN1bHQyLnJlc3VsdCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICAgIHNpZ25hbD8uYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICBcImFib3J0XCIsXG4gICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChzaWduYWwucmVhc29uKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHsgb25jZTogdHJ1ZSB9XG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IGRldGVjdFJlc3VsdCA9IGF3YWl0IGRldGVjdEVsZW1lbnQoe1xuICAgICAgICAgIHNlbGVjdG9yLFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICBkZXRlY3RvcixcbiAgICAgICAgICBjdXN0b21NYXRjaGVyXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoZGV0ZWN0UmVzdWx0LmlzRGV0ZWN0ZWQpIHtcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZShkZXRlY3RSZXN1bHQucmVzdWx0KTtcbiAgICAgICAgfVxuICAgICAgICBvYnNlcnZlci5vYnNlcnZlKHRhcmdldCwgb2JzZXJ2ZUNvbmZpZ3MpO1xuICAgICAgfVxuICAgICkuZmluYWxseSgoKSA9PiB7XG4gICAgICB1bmlmeUNhY2hlLmRlbGV0ZSh1bmlmeVByb21pc2VLZXkpO1xuICAgIH0pO1xuICAgIHVuaWZ5Q2FjaGUuc2V0KHVuaWZ5UHJvbWlzZUtleSwgZGV0ZWN0UHJvbWlzZSk7XG4gICAgcmV0dXJuIGRldGVjdFByb21pc2U7XG4gIH07XG59XG5hc3luYyBmdW5jdGlvbiBkZXRlY3RFbGVtZW50KHtcbiAgdGFyZ2V0LFxuICBzZWxlY3RvcixcbiAgZGV0ZWN0b3IsXG4gIGN1c3RvbU1hdGNoZXJcbn0pIHtcbiAgY29uc3QgZWxlbWVudCA9IGN1c3RvbU1hdGNoZXIgPyBjdXN0b21NYXRjaGVyKHNlbGVjdG9yKSA6IHRhcmdldC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgcmV0dXJuIGF3YWl0IGRldGVjdG9yKGVsZW1lbnQpO1xufVxuY29uc3Qgd2FpdEVsZW1lbnQgPSBjcmVhdGVXYWl0RWxlbWVudCh7XG4gIGRlZmF1bHRPcHRpb25zOiBnZXREZWZhdWx0T3B0aW9ucygpXG59KTtcblxuZXhwb3J0IHsgY3JlYXRlV2FpdEVsZW1lbnQsIGdldERlZmF1bHRPcHRpb25zLCB3YWl0RWxlbWVudCB9O1xuIiwiZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG4gIGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcbiAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGFyZ3Muc2hpZnQoKTtcbiAgICBtZXRob2QoYFt3eHRdICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcbiAgfSBlbHNlIHtcbiAgICBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbiAgfVxufVxuZXhwb3J0IGNvbnN0IGxvZ2dlciA9IHtcbiAgZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcbiAgbG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuICB3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcbiAgZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbiIsImltcG9ydCB7IHdhaXRFbGVtZW50IH0gZnJvbSBcIkAxbmF0c3Uvd2FpdC1lbGVtZW50XCI7XG5pbXBvcnQge1xuICBpc0V4aXN0IGFzIG1vdW50RGV0ZWN0b3IsXG4gIGlzTm90RXhpc3QgYXMgcmVtb3ZlRGV0ZWN0b3Jcbn0gZnJvbSBcIkAxbmF0c3Uvd2FpdC1lbGVtZW50L2RldGVjdG9yc1wiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBhcHBseVBvc2l0aW9uKHJvb3QsIHBvc2l0aW9uZWRFbGVtZW50LCBvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zLnBvc2l0aW9uID09PSBcImlubGluZVwiKSByZXR1cm47XG4gIGlmIChvcHRpb25zLnpJbmRleCAhPSBudWxsKSByb290LnN0eWxlLnpJbmRleCA9IFN0cmluZyhvcHRpb25zLnpJbmRleCk7XG4gIHJvb3Quc3R5bGUub3ZlcmZsb3cgPSBcInZpc2libGVcIjtcbiAgcm9vdC5zdHlsZS5wb3NpdGlvbiA9IFwicmVsYXRpdmVcIjtcbiAgcm9vdC5zdHlsZS53aWR0aCA9IFwiMFwiO1xuICByb290LnN0eWxlLmhlaWdodCA9IFwiMFwiO1xuICByb290LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gIGlmIChwb3NpdGlvbmVkRWxlbWVudCkge1xuICAgIGlmIChvcHRpb25zLnBvc2l0aW9uID09PSBcIm92ZXJsYXlcIikge1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImFic29sdXRlXCI7XG4gICAgICBpZiAob3B0aW9ucy5hbGlnbm1lbnQ/LnN0YXJ0c1dpdGgoXCJib3R0b20tXCIpKVxuICAgICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5ib3R0b20gPSBcIjBcIjtcbiAgICAgIGVsc2UgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUudG9wID0gXCIwXCI7XG4gICAgICBpZiAob3B0aW9ucy5hbGlnbm1lbnQ/LmVuZHNXaXRoKFwiLXJpZ2h0XCIpKVxuICAgICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMFwiO1xuICAgICAgZWxzZSBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5sZWZ0ID0gXCIwXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUudG9wID0gXCIwXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5ib3R0b20gPSBcIjBcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmxlZnQgPSBcIjBcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIwXCI7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0QW5jaG9yKG9wdGlvbnMpIHtcbiAgaWYgKG9wdGlvbnMuYW5jaG9yID09IG51bGwpIHJldHVybiBkb2N1bWVudC5ib2R5O1xuICBsZXQgcmVzb2x2ZWQgPSB0eXBlb2Ygb3B0aW9ucy5hbmNob3IgPT09IFwiZnVuY3Rpb25cIiA/IG9wdGlvbnMuYW5jaG9yKCkgOiBvcHRpb25zLmFuY2hvcjtcbiAgaWYgKHR5cGVvZiByZXNvbHZlZCA9PT0gXCJzdHJpbmdcIikge1xuICAgIGlmIChyZXNvbHZlZC5zdGFydHNXaXRoKFwiL1wiKSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gZG9jdW1lbnQuZXZhbHVhdGUoXG4gICAgICAgIHJlc29sdmVkLFxuICAgICAgICBkb2N1bWVudCxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgWFBhdGhSZXN1bHQuRklSU1RfT1JERVJFRF9OT0RFX1RZUEUsXG4gICAgICAgIG51bGxcbiAgICAgICk7XG4gICAgICByZXR1cm4gcmVzdWx0LnNpbmdsZU5vZGVWYWx1ZSA/PyB2b2lkIDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHJlc29sdmVkKSA/PyB2b2lkIDA7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXNvbHZlZCA/PyB2b2lkIDA7XG59XG5leHBvcnQgZnVuY3Rpb24gbW91bnRVaShyb290LCBvcHRpb25zKSB7XG4gIGNvbnN0IGFuY2hvciA9IGdldEFuY2hvcihvcHRpb25zKTtcbiAgaWYgKGFuY2hvciA9PSBudWxsKVxuICAgIHRocm93IEVycm9yKFxuICAgICAgXCJGYWlsZWQgdG8gbW91bnQgY29udGVudCBzY3JpcHQgVUk6IGNvdWxkIG5vdCBmaW5kIGFuY2hvciBlbGVtZW50XCJcbiAgICApO1xuICBzd2l0Y2ggKG9wdGlvbnMuYXBwZW5kKSB7XG4gICAgY2FzZSB2b2lkIDA6XG4gICAgY2FzZSBcImxhc3RcIjpcbiAgICAgIGFuY2hvci5hcHBlbmQocm9vdCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiZmlyc3RcIjpcbiAgICAgIGFuY2hvci5wcmVwZW5kKHJvb3QpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcInJlcGxhY2VcIjpcbiAgICAgIGFuY2hvci5yZXBsYWNlV2l0aChyb290KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJhZnRlclwiOlxuICAgICAgYW5jaG9yLnBhcmVudEVsZW1lbnQ/Lmluc2VydEJlZm9yZShyb290LCBhbmNob3IubmV4dEVsZW1lbnRTaWJsaW5nKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJiZWZvcmVcIjpcbiAgICAgIGFuY2hvci5wYXJlbnRFbGVtZW50Py5pbnNlcnRCZWZvcmUocm9vdCwgYW5jaG9yKTtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICBvcHRpb25zLmFwcGVuZChhbmNob3IsIHJvb3QpO1xuICAgICAgYnJlYWs7XG4gIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNb3VudEZ1bmN0aW9ucyhiYXNlRnVuY3Rpb25zLCBvcHRpb25zKSB7XG4gIGxldCBhdXRvTW91bnRJbnN0YW5jZSA9IHZvaWQgMDtcbiAgY29uc3Qgc3RvcEF1dG9Nb3VudCA9ICgpID0+IHtcbiAgICBhdXRvTW91bnRJbnN0YW5jZT8uc3RvcEF1dG9Nb3VudCgpO1xuICAgIGF1dG9Nb3VudEluc3RhbmNlID0gdm9pZCAwO1xuICB9O1xuICBjb25zdCBtb3VudCA9ICgpID0+IHtcbiAgICBiYXNlRnVuY3Rpb25zLm1vdW50KCk7XG4gIH07XG4gIGNvbnN0IHVubW91bnQgPSBiYXNlRnVuY3Rpb25zLnJlbW92ZTtcbiAgY29uc3QgcmVtb3ZlID0gKCkgPT4ge1xuICAgIHN0b3BBdXRvTW91bnQoKTtcbiAgICBiYXNlRnVuY3Rpb25zLnJlbW92ZSgpO1xuICB9O1xuICBjb25zdCBhdXRvTW91bnQgPSAoYXV0b01vdW50T3B0aW9ucykgPT4ge1xuICAgIGlmIChhdXRvTW91bnRJbnN0YW5jZSkge1xuICAgICAgbG9nZ2VyLndhcm4oXCJhdXRvTW91bnQgaXMgYWxyZWFkeSBzZXQuXCIpO1xuICAgIH1cbiAgICBhdXRvTW91bnRJbnN0YW5jZSA9IGF1dG9Nb3VudFVpKFxuICAgICAgeyBtb3VudCwgdW5tb3VudCwgc3RvcEF1dG9Nb3VudCB9LFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAuLi5hdXRvTW91bnRPcHRpb25zXG4gICAgICB9XG4gICAgKTtcbiAgfTtcbiAgcmV0dXJuIHtcbiAgICBtb3VudCxcbiAgICByZW1vdmUsXG4gICAgYXV0b01vdW50XG4gIH07XG59XG5mdW5jdGlvbiBhdXRvTW91bnRVaSh1aUNhbGxiYWNrcywgb3B0aW9ucykge1xuICBjb25zdCBhYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gIGNvbnN0IEVYUExJQ0lUX1NUT1BfUkVBU09OID0gXCJleHBsaWNpdF9zdG9wX2F1dG9fbW91bnRcIjtcbiAgY29uc3QgX3N0b3BBdXRvTW91bnQgPSAoKSA9PiB7XG4gICAgYWJvcnRDb250cm9sbGVyLmFib3J0KEVYUExJQ0lUX1NUT1BfUkVBU09OKTtcbiAgICBvcHRpb25zLm9uU3RvcD8uKCk7XG4gIH07XG4gIGxldCByZXNvbHZlZEFuY2hvciA9IHR5cGVvZiBvcHRpb25zLmFuY2hvciA9PT0gXCJmdW5jdGlvblwiID8gb3B0aW9ucy5hbmNob3IoKSA6IG9wdGlvbnMuYW5jaG9yO1xuICBpZiAocmVzb2x2ZWRBbmNob3IgaW5zdGFuY2VvZiBFbGVtZW50KSB7XG4gICAgdGhyb3cgRXJyb3IoXG4gICAgICBcImF1dG9Nb3VudCBhbmQgRWxlbWVudCBhbmNob3Igb3B0aW9uIGNhbm5vdCBiZSBjb21iaW5lZC4gQXZvaWQgcGFzc2luZyBgRWxlbWVudGAgZGlyZWN0bHkgb3IgYCgpID0+IEVsZW1lbnRgIHRvIHRoZSBhbmNob3IuXCJcbiAgICApO1xuICB9XG4gIGFzeW5jIGZ1bmN0aW9uIG9ic2VydmVFbGVtZW50KHNlbGVjdG9yKSB7XG4gICAgbGV0IGlzQW5jaG9yRXhpc3QgPSAhIWdldEFuY2hvcihvcHRpb25zKTtcbiAgICBpZiAoaXNBbmNob3JFeGlzdCkge1xuICAgICAgdWlDYWxsYmFja3MubW91bnQoKTtcbiAgICB9XG4gICAgd2hpbGUgKCFhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNoYW5nZWRBbmNob3IgPSBhd2FpdCB3YWl0RWxlbWVudChzZWxlY3RvciA/PyBcImJvZHlcIiwge1xuICAgICAgICAgIGN1c3RvbU1hdGNoZXI6ICgpID0+IGdldEFuY2hvcihvcHRpb25zKSA/PyBudWxsLFxuICAgICAgICAgIGRldGVjdG9yOiBpc0FuY2hvckV4aXN0ID8gcmVtb3ZlRGV0ZWN0b3IgOiBtb3VudERldGVjdG9yLFxuICAgICAgICAgIHNpZ25hbDogYWJvcnRDb250cm9sbGVyLnNpZ25hbFxuICAgICAgICB9KTtcbiAgICAgICAgaXNBbmNob3JFeGlzdCA9ICEhY2hhbmdlZEFuY2hvcjtcbiAgICAgICAgaWYgKGlzQW5jaG9yRXhpc3QpIHtcbiAgICAgICAgICB1aUNhbGxiYWNrcy5tb3VudCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHVpQ2FsbGJhY2tzLnVubW91bnQoKTtcbiAgICAgICAgICBpZiAob3B0aW9ucy5vbmNlKSB7XG4gICAgICAgICAgICB1aUNhbGxiYWNrcy5zdG9wQXV0b01vdW50KCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkICYmIGFib3J0Q29udHJvbGxlci5zaWduYWwucmVhc29uID09PSBFWFBMSUNJVF9TVE9QX1JFQVNPTikge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIG9ic2VydmVFbGVtZW50KHJlc29sdmVkQW5jaG9yKTtcbiAgcmV0dXJuIHsgc3RvcEF1dG9Nb3VudDogX3N0b3BBdXRvTW91bnQgfTtcbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBzcGxpdFNoYWRvd1Jvb3RDc3MoY3NzKSB7XG4gIGxldCBzaGFkb3dDc3MgPSBjc3M7XG4gIGxldCBkb2N1bWVudENzcyA9IFwiXCI7XG4gIGNvbnN0IHJ1bGVzUmVnZXggPSAvKFxccypAKHByb3BlcnR5fGZvbnQtZmFjZSlbXFxzXFxTXSo/e1tcXHNcXFNdKj99KS9nbTtcbiAgbGV0IG1hdGNoO1xuICB3aGlsZSAoKG1hdGNoID0gcnVsZXNSZWdleC5leGVjKGNzcykpICE9PSBudWxsKSB7XG4gICAgZG9jdW1lbnRDc3MgKz0gbWF0Y2hbMV07XG4gICAgc2hhZG93Q3NzID0gc2hhZG93Q3NzLnJlcGxhY2UobWF0Y2hbMV0sIFwiXCIpO1xuICB9XG4gIHJldHVybiB7XG4gICAgZG9jdW1lbnRDc3M6IGRvY3VtZW50Q3NzLnRyaW0oKSxcbiAgICBzaGFkb3dDc3M6IHNoYWRvd0Nzcy50cmltKClcbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGNyZWF0ZUlzb2xhdGVkRWxlbWVudCB9IGZyb20gXCJAd2ViZXh0LWNvcmUvaXNvbGF0ZWQtZWxlbWVudFwiO1xuaW1wb3J0IHsgYXBwbHlQb3NpdGlvbiwgY3JlYXRlTW91bnRGdW5jdGlvbnMsIG1vdW50VWkgfSBmcm9tIFwiLi9zaGFyZWQubWpzXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHsgc3BsaXRTaGFkb3dSb290Q3NzIH0gZnJvbSBcIi4uL3NwbGl0LXNoYWRvdy1yb290LWNzcy5tanNcIjtcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVTaGFkb3dSb290VWkoY3R4LCBvcHRpb25zKSB7XG4gIGNvbnN0IGluc3RhbmNlSWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoMiwgMTUpO1xuICBjb25zdCBjc3MgPSBbXTtcbiAgaWYgKCFvcHRpb25zLmluaGVyaXRTdHlsZXMpIHtcbiAgICBjc3MucHVzaChgLyogV1hUIFNoYWRvdyBSb290IFJlc2V0ICovIDpob3N0e2FsbDppbml0aWFsICFpbXBvcnRhbnQ7fWApO1xuICB9XG4gIGlmIChvcHRpb25zLmNzcykge1xuICAgIGNzcy5wdXNoKG9wdGlvbnMuY3NzKTtcbiAgfVxuICBpZiAoY3R4Lm9wdGlvbnM/LmNzc0luamVjdGlvbk1vZGUgPT09IFwidWlcIikge1xuICAgIGNvbnN0IGVudHJ5Q3NzID0gYXdhaXQgbG9hZENzcygpO1xuICAgIGNzcy5wdXNoKGVudHJ5Q3NzLnJlcGxhY2VBbGwoXCI6cm9vdFwiLCBcIjpob3N0XCIpKTtcbiAgfVxuICBjb25zdCB7IHNoYWRvd0NzcywgZG9jdW1lbnRDc3MgfSA9IHNwbGl0U2hhZG93Um9vdENzcyhjc3Muam9pbihcIlxcblwiKS50cmltKCkpO1xuICBjb25zdCB7XG4gICAgaXNvbGF0ZWRFbGVtZW50OiB1aUNvbnRhaW5lcixcbiAgICBwYXJlbnRFbGVtZW50OiBzaGFkb3dIb3N0LFxuICAgIHNoYWRvd1xuICB9ID0gYXdhaXQgY3JlYXRlSXNvbGF0ZWRFbGVtZW50KHtcbiAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgY3NzOiB7XG4gICAgICB0ZXh0Q29udGVudDogc2hhZG93Q3NzXG4gICAgfSxcbiAgICBtb2RlOiBvcHRpb25zLm1vZGUgPz8gXCJvcGVuXCIsXG4gICAgaXNvbGF0ZUV2ZW50czogb3B0aW9ucy5pc29sYXRlRXZlbnRzXG4gIH0pO1xuICBzaGFkb3dIb3N0LnNldEF0dHJpYnV0ZShcImRhdGEtd3h0LXNoYWRvdy1yb290XCIsIFwiXCIpO1xuICBsZXQgbW91bnRlZDtcbiAgY29uc3QgbW91bnQgPSAoKSA9PiB7XG4gICAgbW91bnRVaShzaGFkb3dIb3N0LCBvcHRpb25zKTtcbiAgICBhcHBseVBvc2l0aW9uKHNoYWRvd0hvc3QsIHNoYWRvdy5xdWVyeVNlbGVjdG9yKFwiaHRtbFwiKSwgb3B0aW9ucyk7XG4gICAgaWYgKGRvY3VtZW50Q3NzICYmICFkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFxuICAgICAgYHN0eWxlW3d4dC1zaGFkb3ctcm9vdC1kb2N1bWVudC1zdHlsZXM9XCIke2luc3RhbmNlSWR9XCJdYFxuICAgICkpIHtcbiAgICAgIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpO1xuICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSBkb2N1bWVudENzcztcbiAgICAgIHN0eWxlLnNldEF0dHJpYnV0ZShcInd4dC1zaGFkb3ctcm9vdC1kb2N1bWVudC1zdHlsZXNcIiwgaW5zdGFuY2VJZCk7XG4gICAgICAoZG9jdW1lbnQuaGVhZCA/PyBkb2N1bWVudC5ib2R5KS5hcHBlbmQoc3R5bGUpO1xuICAgIH1cbiAgICBtb3VudGVkID0gb3B0aW9ucy5vbk1vdW50KHVpQ29udGFpbmVyLCBzaGFkb3csIHNoYWRvd0hvc3QpO1xuICB9O1xuICBjb25zdCByZW1vdmUgPSAoKSA9PiB7XG4gICAgb3B0aW9ucy5vblJlbW92ZT8uKG1vdW50ZWQpO1xuICAgIHNoYWRvd0hvc3QucmVtb3ZlKCk7XG4gICAgY29uc3QgZG9jdW1lbnRTdHlsZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXG4gICAgICBgc3R5bGVbd3h0LXNoYWRvdy1yb290LWRvY3VtZW50LXN0eWxlcz1cIiR7aW5zdGFuY2VJZH1cIl1gXG4gICAgKTtcbiAgICBkb2N1bWVudFN0eWxlPy5yZW1vdmUoKTtcbiAgICB3aGlsZSAodWlDb250YWluZXIubGFzdENoaWxkKVxuICAgICAgdWlDb250YWluZXIucmVtb3ZlQ2hpbGQodWlDb250YWluZXIubGFzdENoaWxkKTtcbiAgICBtb3VudGVkID0gdm9pZCAwO1xuICB9O1xuICBjb25zdCBtb3VudEZ1bmN0aW9ucyA9IGNyZWF0ZU1vdW50RnVuY3Rpb25zKFxuICAgIHtcbiAgICAgIG1vdW50LFxuICAgICAgcmVtb3ZlXG4gICAgfSxcbiAgICBvcHRpb25zXG4gICk7XG4gIGN0eC5vbkludmFsaWRhdGVkKHJlbW92ZSk7XG4gIHJldHVybiB7XG4gICAgc2hhZG93LFxuICAgIHNoYWRvd0hvc3QsXG4gICAgdWlDb250YWluZXIsXG4gICAgLi4ubW91bnRGdW5jdGlvbnMsXG4gICAgZ2V0IG1vdW50ZWQoKSB7XG4gICAgICByZXR1cm4gbW91bnRlZDtcbiAgICB9XG4gIH07XG59XG5hc3luYyBmdW5jdGlvbiBsb2FkQ3NzKCkge1xuICBjb25zdCB1cmwgPSBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKGAvY29udGVudC1zY3JpcHRzLyR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9LmNzc2ApO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCk7XG4gICAgcmV0dXJuIGF3YWl0IHJlcy50ZXh0KCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGxvZ2dlci53YXJuKFxuICAgICAgYEZhaWxlZCB0byBsb2FkIHN0eWxlcyBAICR7dXJsfS4gRGlkIHlvdSBmb3JnZXQgdG8gaW1wb3J0IHRoZSBzdHlsZXNoZWV0IGluIHlvdXIgZW50cnlwb2ludD9gLFxuICAgICAgZXJyXG4gICAgKTtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUNvbnRlbnRTY3JpcHQoZGVmaW5pdGlvbikge1xuICByZXR1cm4gZGVmaW5pdGlvbjtcbn1cbiIsImZ1bmN0aW9uIHIoZSl7dmFyIHQsZixuPVwiXCI7aWYoXCJzdHJpbmdcIj09dHlwZW9mIGV8fFwibnVtYmVyXCI9PXR5cGVvZiBlKW4rPWU7ZWxzZSBpZihcIm9iamVjdFwiPT10eXBlb2YgZSlpZihBcnJheS5pc0FycmF5KGUpKXt2YXIgbz1lLmxlbmd0aDtmb3IodD0wO3Q8bzt0KyspZVt0XSYmKGY9cihlW3RdKSkmJihuJiYobis9XCIgXCIpLG4rPWYpfWVsc2UgZm9yKGYgaW4gZSllW2ZdJiYobiYmKG4rPVwiIFwiKSxuKz1mKTtyZXR1cm4gbn1leHBvcnQgZnVuY3Rpb24gY2xzeCgpe2Zvcih2YXIgZSx0LGY9MCxuPVwiXCIsbz1hcmd1bWVudHMubGVuZ3RoO2Y8bztmKyspKGU9YXJndW1lbnRzW2ZdKSYmKHQ9cihlKSkmJihuJiYobis9XCIgXCIpLG4rPXQpO3JldHVybiBufWV4cG9ydCBkZWZhdWx0IGNsc3g7IiwiaW1wb3J0IHsgY2xzeCwgdHlwZSBDbGFzc1ZhbHVlIH0gZnJvbSAnY2xzeCdcblxuZXhwb3J0IGZ1bmN0aW9uIGNuKC4uLmlucHV0czogQ2xhc3NWYWx1ZVtdKSB7XG4gIHJldHVybiBjbHN4KGlucHV0cylcbn0iLCJpbXBvcnQgeyBTaG93LCBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCwgSlNYIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGVhZGVyUHJvcHMge1xuICB0aXRsZT86IHN0cmluZztcbiAgbG9nbz86IEpTWC5FbGVtZW50O1xuICBhY3Rpb25zPzogSlNYLkVsZW1lbnQ7XG4gIHZhcmlhbnQ/OiAnZGVmYXVsdCcgfCAnbWluaW1hbCcgfCAndHJhbnNwYXJlbnQnO1xuICBzdGlja3k/OiBib29sZWFuO1xuICBzaG93TWVudUJ1dHRvbj86IGJvb2xlYW47XG4gIG9uTWVudUNsaWNrPzogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBIZWFkZXI6IENvbXBvbmVudDxIZWFkZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2lzU2Nyb2xsZWQsIHNldElzU2Nyb2xsZWRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcblxuICAvLyBUcmFjayBzY3JvbGwgcG9zaXRpb24gZm9yIHN0aWNreSBoZWFkZXIgZWZmZWN0c1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgcHJvcHMuc3RpY2t5KSB7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsICgpID0+IHtcbiAgICAgIHNldElzU2Nyb2xsZWQod2luZG93LnNjcm9sbFkgPiAxMCk7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCB2YXJpYW50ID0gKCkgPT4gcHJvcHMudmFyaWFudCB8fCAnZGVmYXVsdCc7XG5cbiAgcmV0dXJuIChcbiAgICA8aGVhZGVyXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICd3LWZ1bGwgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMjAwJyxcbiAgICAgICAge1xuICAgICAgICAgIC8vIFZhcmlhbnRzXG4gICAgICAgICAgJ2JnLXN1cmZhY2UgYm9yZGVyLWIgYm9yZGVyLXN1YnRsZSc6IHZhcmlhbnQoKSA9PT0gJ2RlZmF1bHQnLFxuICAgICAgICAgICdiZy10cmFuc3BhcmVudCc6IHZhcmlhbnQoKSA9PT0gJ21pbmltYWwnIHx8IHZhcmlhbnQoKSA9PT0gJ3RyYW5zcGFyZW50JyxcbiAgICAgICAgICAnYmFja2Ryb3AtYmx1ci1tZCBiZy1zdXJmYWNlLzgwJzogdmFyaWFudCgpID09PSAndHJhbnNwYXJlbnQnICYmIGlzU2Nyb2xsZWQoKSxcbiAgICAgICAgICAvLyBTdGlja3kgYmVoYXZpb3JcbiAgICAgICAgICAnc3RpY2t5IHRvcC0wIHotNTAnOiBwcm9wcy5zdGlja3ksXG4gICAgICAgICAgJ3NoYWRvdy1sZyc6IHByb3BzLnN0aWNreSAmJiBpc1Njcm9sbGVkKCksXG4gICAgICAgIH0sXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy1zY3JlZW4teGwgbXgtYXV0byBweC00IHNtOnB4LTYgbGc6cHgtOFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGgtMTZcIj5cbiAgICAgICAgICB7LyogTGVmdCBzZWN0aW9uICovfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtNFwiPlxuICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuc2hvd01lbnVCdXR0b259PlxuICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25NZW51Q2xpY2t9XG4gICAgICAgICAgICAgICAgY2xhc3M9XCJwLTIgcm91bmRlZC1sZyBob3ZlcjpiZy1oaWdobGlnaHQgdHJhbnNpdGlvbi1jb2xvcnMgbGc6aGlkZGVuXCJcbiAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiTWVudVwiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8c3ZnIGNsYXNzPVwidy02IGgtNlwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiPlxuICAgICAgICAgICAgICAgICAgPHBhdGggc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIGQ9XCJNNCA2aDE2TTQgMTJoMTZNNCAxOGgxNlwiIC8+XG4gICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5sb2dvfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnRpdGxlfT5cbiAgICAgICAgICAgICAgICA8aDEgY2xhc3M9XCJ0ZXh0LXhsIGZvbnQtYm9sZCB0ZXh0LXByaW1hcnlcIj57cHJvcHMudGl0bGV9PC9oMT5cbiAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAge3Byb3BzLmxvZ299XG4gICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICB7LyogUmlnaHQgc2VjdGlvbiAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5hY3Rpb25zfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICB7cHJvcHMuYWN0aW9uc31cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2hlYWRlcj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBTY29yZVBhbmVsUHJvcHMge1xuICBzY29yZTogbnVtYmVyIHwgbnVsbDtcbiAgcmFuazogbnVtYmVyIHwgbnVsbDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBTY29yZVBhbmVsOiBDb21wb25lbnQ8U2NvcmVQYW5lbFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdncmlkIGdyaWQtY29scy1bMWZyXzFmcl0gZ2FwLTIgcC00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBTY29yZSBCb3ggKi99XG4gICAgICA8ZGl2IGNsYXNzPVwiYmctc3VyZmFjZSByb3VuZGVkLWxnIHAtNCBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBtaW4taC1bODBweF1cIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtMnhsIGZvbnQtbW9ubyBmb250LWJvbGQgdGV4dC1wdXJwbGUtNTAwXCI+XG4gICAgICAgICAge3Byb3BzLnNjb3JlICE9PSBudWxsID8gcHJvcHMuc2NvcmUgOiAn4oCUJ31cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtc2Vjb25kYXJ5IG10LTFcIj5cbiAgICAgICAgICBTY29yZVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgXG4gICAgICB7LyogUmFuayBCb3ggKi99XG4gICAgICA8ZGl2IGNsYXNzPVwiYmctc3VyZmFjZSByb3VuZGVkLWxnIHAtNCBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBtaW4taC1bODBweF1cIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtMnhsIGZvbnQtbW9ubyBmb250LWJvbGQgdGV4dC1waW5rLTUwMFwiPlxuICAgICAgICAgIHtwcm9wcy5yYW5rICE9PSBudWxsID8gcHJvcHMucmFuayA6ICfigJQnfVxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtc20gdGV4dC1zZWNvbmRhcnkgbXQtMVwiPlxuICAgICAgICAgIFJhbmtcbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdywgc3BsaXRQcm9wcyB9IGZyb20gJ3NvbGlkLWpzJ1xuaW1wb3J0IHR5cGUgeyBKU1ggfSBmcm9tICdzb2xpZC1qcydcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nXG5cbmV4cG9ydCBpbnRlcmZhY2UgQnV0dG9uUHJvcHMgZXh0ZW5kcyBKU1guQnV0dG9uSFRNTEF0dHJpYnV0ZXM8SFRNTEJ1dHRvbkVsZW1lbnQ+IHtcbiAgdmFyaWFudD86ICdwcmltYXJ5JyB8ICdzZWNvbmRhcnknIHwgJ2dob3N0JyB8ICdkYW5nZXInXG4gIHNpemU/OiAnc20nIHwgJ21kJyB8ICdsZydcbiAgZnVsbFdpZHRoPzogYm9vbGVhblxuICBsb2FkaW5nPzogYm9vbGVhblxuICBsZWZ0SWNvbj86IEpTWC5FbGVtZW50XG4gIHJpZ2h0SWNvbj86IEpTWC5FbGVtZW50XG59XG5cbmV4cG9ydCBjb25zdCBCdXR0b24gPSAocHJvcHM6IEJ1dHRvblByb3BzKSA9PiB7XG4gIGNvbnN0IFtsb2NhbCwgb3RoZXJzXSA9IHNwbGl0UHJvcHMocHJvcHMsIFtcbiAgICAndmFyaWFudCcsXG4gICAgJ3NpemUnLFxuICAgICdmdWxsV2lkdGgnLFxuICAgICdsb2FkaW5nJyxcbiAgICAnbGVmdEljb24nLFxuICAgICdyaWdodEljb24nLFxuICAgICdjaGlsZHJlbicsXG4gICAgJ2NsYXNzJyxcbiAgICAnZGlzYWJsZWQnLFxuICBdKVxuXG4gIGNvbnN0IHZhcmlhbnQgPSAoKSA9PiBsb2NhbC52YXJpYW50IHx8ICdwcmltYXJ5J1xuICBjb25zdCBzaXplID0gKCkgPT4gbG9jYWwuc2l6ZSB8fCAnbWQnXG5cbiAgcmV0dXJuIChcbiAgICA8YnV0dG9uXG4gICAgICBkaXNhYmxlZD17bG9jYWwuZGlzYWJsZWQgfHwgbG9jYWwubG9hZGluZ31cbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2lubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBmb250LW1lZGl1bSB0cmFuc2l0aW9uLWFsbCBjdXJzb3ItcG9pbnRlciBvdXRsaW5lLW5vbmUgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICB7XG4gICAgICAgICAgLy8gVmFyaWFudHNcbiAgICAgICAgICAnYmctZ3JhZGllbnQtcHJpbWFyeSB0ZXh0LXdoaXRlIGhvdmVyOnNoYWRvdy1sZyBob3ZlcjpicmlnaHRuZXNzLTExMCBnbG93LXByaW1hcnknOlxuICAgICAgICAgICAgdmFyaWFudCgpID09PSAncHJpbWFyeScsXG4gICAgICAgICAgJ2JnLXN1cmZhY2UgdGV4dC1wcmltYXJ5IGJvcmRlciBib3JkZXItZGVmYXVsdCBob3ZlcjpiZy1lbGV2YXRlZCBob3Zlcjpib3JkZXItc3Ryb25nJzpcbiAgICAgICAgICAgIHZhcmlhbnQoKSA9PT0gJ3NlY29uZGFyeScsXG4gICAgICAgICAgJ3RleHQtc2Vjb25kYXJ5IGhvdmVyOnRleHQtcHJpbWFyeSBob3ZlcjpiZy1zdXJmYWNlJzpcbiAgICAgICAgICAgIHZhcmlhbnQoKSA9PT0gJ2dob3N0JyxcbiAgICAgICAgICAnYmctcmVkLTYwMCB0ZXh0LXdoaXRlIGhvdmVyOmJnLXJlZC03MDAgaG92ZXI6c2hhZG93LWxnJzpcbiAgICAgICAgICAgIHZhcmlhbnQoKSA9PT0gJ2RhbmdlcicsXG4gICAgICAgICAgLy8gU2l6ZXNcbiAgICAgICAgICAnaC04IHB4LTMgdGV4dC1zbSByb3VuZGVkLW1kIGdhcC0xLjUnOiBzaXplKCkgPT09ICdzbScsXG4gICAgICAgICAgJ2gtMTAgcHgtNCB0ZXh0LWJhc2Ugcm91bmRlZC1sZyBnYXAtMic6IHNpemUoKSA9PT0gJ21kJyxcbiAgICAgICAgICAnaC0xMiBweC02IHRleHQtbGcgcm91bmRlZC1sZyBnYXAtMi41Jzogc2l6ZSgpID09PSAnbGcnLFxuICAgICAgICAgIC8vIEZ1bGwgd2lkdGhcbiAgICAgICAgICAndy1mdWxsJzogbG9jYWwuZnVsbFdpZHRoLFxuICAgICAgICAgIC8vIExvYWRpbmcgc3RhdGVcbiAgICAgICAgICAnY3Vyc29yLXdhaXQnOiBsb2NhbC5sb2FkaW5nLFxuICAgICAgICB9LFxuICAgICAgICBsb2NhbC5jbGFzc1xuICAgICAgKX1cbiAgICAgIHsuLi5vdGhlcnN9XG4gICAgPlxuICAgICAgPFNob3cgd2hlbj17bG9jYWwubG9hZGluZ30+XG4gICAgICAgIDxzdmdcbiAgICAgICAgICBjbGFzcz1cImFuaW1hdGUtc3BpbiBoLTQgdy00XCJcbiAgICAgICAgICB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCJcbiAgICAgICAgICBmaWxsPVwibm9uZVwiXG4gICAgICAgICAgdmlld0JveD1cIjAgMCAyNCAyNFwiXG4gICAgICAgID5cbiAgICAgICAgICA8Y2lyY2xlXG4gICAgICAgICAgICBjbGFzcz1cIm9wYWNpdHktMjVcIlxuICAgICAgICAgICAgY3g9XCIxMlwiXG4gICAgICAgICAgICBjeT1cIjEyXCJcbiAgICAgICAgICAgIHI9XCIxMFwiXG4gICAgICAgICAgICBzdHJva2U9XCJjdXJyZW50Q29sb3JcIlxuICAgICAgICAgICAgc3Ryb2tlLXdpZHRoPVwiNFwiXG4gICAgICAgICAgLz5cbiAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgY2xhc3M9XCJvcGFjaXR5LTc1XCJcbiAgICAgICAgICAgIGZpbGw9XCJjdXJyZW50Q29sb3JcIlxuICAgICAgICAgICAgZD1cIk00IDEyYTggOCAwIDAxOC04VjBDNS4zNzMgMCAwIDUuMzczIDAgMTJoNHptMiA1LjI5MUE3Ljk2MiA3Ljk2MiAwIDAxNCAxMkgwYzAgMy4wNDIgMS4xMzUgNS44MjQgMyA3LjkzOGwzLTIuNjQ3elwiXG4gICAgICAgICAgLz5cbiAgICAgICAgPC9zdmc+XG4gICAgICA8L1Nob3c+XG5cbiAgICAgIDxTaG93IHdoZW49e2xvY2FsLmxlZnRJY29uICYmICFsb2NhbC5sb2FkaW5nfT5cbiAgICAgICAge2xvY2FsLmxlZnRJY29ufVxuICAgICAgPC9TaG93PlxuXG4gICAgICA8U2hvdyB3aGVuPXtsb2NhbC5jaGlsZHJlbn0+XG4gICAgICAgIDxzcGFuPntsb2NhbC5jaGlsZHJlbn08L3NwYW4+XG4gICAgICA8L1Nob3c+XG5cbiAgICAgIDxTaG93IHdoZW49e2xvY2FsLnJpZ2h0SWNvbn0+XG4gICAgICAgIHtsb2NhbC5yaWdodEljb259XG4gICAgICA8L1Nob3c+XG4gICAgPC9idXR0b24+XG4gIClcbn0iLCJpbXBvcnQgeyBTaG93LCBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL0J1dHRvbic7XG5cbmV4cG9ydCB0eXBlIE9uYm9hcmRpbmdTdGVwID0gJ2Nvbm5lY3Qtd2FsbGV0JyB8ICdnZW5lcmF0aW5nLXRva2VuJyB8ICdjb21wbGV0ZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT25ib2FyZGluZ0Zsb3dQcm9wcyB7XG4gIHN0ZXA6IE9uYm9hcmRpbmdTdGVwO1xuICBlcnJvcj86IHN0cmluZyB8IG51bGw7XG4gIHdhbGxldEFkZHJlc3M/OiBzdHJpbmcgfCBudWxsO1xuICB0b2tlbj86IHN0cmluZyB8IG51bGw7XG4gIG9uQ29ubmVjdFdhbGxldDogKCkgPT4gdm9pZDtcbiAgb25Vc2VUZXN0TW9kZTogKCkgPT4gdm9pZDtcbiAgb25Vc2VQcml2YXRlS2V5OiAocHJpdmF0ZUtleTogc3RyaW5nKSA9PiB2b2lkO1xuICBvbkNvbXBsZXRlOiAoKSA9PiB2b2lkO1xuICBpc0Nvbm5lY3Rpbmc/OiBib29sZWFuO1xuICBpc0dlbmVyYXRpbmc/OiBib29sZWFuO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IE9uYm9hcmRpbmdGbG93OiBDb21wb25lbnQ8T25ib2FyZGluZ0Zsb3dQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW3Nob3dUZXN0T3B0aW9uLCBzZXRTaG93VGVzdE9wdGlvbl0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbc2hvd1ByaXZhdGVLZXlJbnB1dCwgc2V0U2hvd1ByaXZhdGVLZXlJbnB1dF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbcHJpdmF0ZUtleSwgc2V0UHJpdmF0ZUtleV0gPSBjcmVhdGVTaWduYWwoJycpO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAnbWluLWgtc2NyZWVuIGJnLWdyYWRpZW50LXRvLWJyIGZyb20tZ3JheS05MDAgdG8tYmxhY2sgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXInLFxuICAgICAgcHJvcHMuY2xhc3NcbiAgICApfT5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy0yeGwgdy1mdWxsIHAtMTJcIj5cbiAgICAgICAgey8qIExvZ28vSGVhZGVyICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgbWItMTJcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC04eGwgbWItNlwiPvCfjqQ8L2Rpdj5cbiAgICAgICAgICA8aDEgY2xhc3M9XCJ0ZXh0LTZ4bCBmb250LWJvbGQgdGV4dC13aGl0ZSBtYi00XCI+XG4gICAgICAgICAgICBTY2FybGV0dCBLYXJhb2tlXG4gICAgICAgICAgPC9oMT5cbiAgICAgICAgICA8cCBjbGFzcz1cInRleHQteGwgdGV4dC1ncmF5LTQwMFwiPlxuICAgICAgICAgICAgQUktcG93ZXJlZCBrYXJhb2tlIGZvciBTb3VuZENsb3VkXG4gICAgICAgICAgPC9wPlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICB7LyogUHJvZ3Jlc3MgRG90cyAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgganVzdGlmeS1jZW50ZXIgbWItMTJcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBnYXAtM1wiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICd3LTMgaC0zIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICAgICAgICBwcm9wcy5zdGVwID09PSAnY29ubmVjdC13YWxsZXQnIFxuICAgICAgICAgICAgICAgID8gJ2JnLXB1cnBsZS01MDAgdy0xMicgXG4gICAgICAgICAgICAgICAgOiBwcm9wcy53YWxsZXRBZGRyZXNzIFxuICAgICAgICAgICAgICAgICAgPyAnYmctZ3JlZW4tNTAwJyBcbiAgICAgICAgICAgICAgICAgIDogJ2JnLWdyYXktNjAwJ1xuICAgICAgICAgICAgKX0gLz5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAndy0zIGgtMyByb3VuZGVkLWZ1bGwgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgICAgICAgcHJvcHMuc3RlcCA9PT0gJ2dlbmVyYXRpbmctdG9rZW4nIFxuICAgICAgICAgICAgICAgID8gJ2JnLXB1cnBsZS01MDAgdy0xMicgXG4gICAgICAgICAgICAgICAgOiBwcm9wcy50b2tlbiBcbiAgICAgICAgICAgICAgICAgID8gJ2JnLWdyZWVuLTUwMCcgXG4gICAgICAgICAgICAgICAgICA6ICdiZy1ncmF5LTYwMCdcbiAgICAgICAgICAgICl9IC8+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3ctMyBoLTMgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgICAgICAgIHByb3BzLnN0ZXAgPT09ICdjb21wbGV0ZScgXG4gICAgICAgICAgICAgICAgPyAnYmctZ3JlZW4tNTAwIHctMTInIFxuICAgICAgICAgICAgICAgIDogJ2JnLWdyYXktNjAwJ1xuICAgICAgICAgICAgKX0gLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgey8qIEVycm9yIERpc3BsYXkgKi99XG4gICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmVycm9yfT5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwibWItOCBwLTYgYmctcmVkLTkwMC8yMCBib3JkZXIgYm9yZGVyLXJlZC04MDAgcm91bmRlZC14bFwiPlxuICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXJlZC00MDAgdGV4dC1jZW50ZXIgdGV4dC1sZ1wiPntwcm9wcy5lcnJvcn08L3A+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvU2hvdz5cblxuICAgICAgICB7LyogQ29udGVudCAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNlwiPlxuICAgICAgICAgIHsvKiBDb25uZWN0IFdhbGxldCBTdGVwICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnN0ZXAgPT09ICdjb25uZWN0LXdhbGxldCd9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIHNwYWNlLXktOFwiPlxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQtNHhsIGZvbnQtc2VtaWJvbGQgdGV4dC13aGl0ZSBtYi00XCI+XG4gICAgICAgICAgICAgICAgICBDb25uZWN0IFlvdXIgV2FsbGV0XG4gICAgICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS00MDAgdGV4dC1sZyBtYXgtdy1tZCBteC1hdXRvXCI+XG4gICAgICAgICAgICAgICAgICBDb25uZWN0IHlvdXIgd2FsbGV0IHRvIGdldCBzdGFydGVkXG4gICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS00IG1heC13LW1kIG14LWF1dG9cIj5cbiAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNvbm5lY3RXYWxsZXR9XG4gICAgICAgICAgICAgICAgICBkaXNhYmxlZD17cHJvcHMuaXNDb25uZWN0aW5nfVxuICAgICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTYgdGV4dC1sZ1wiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAge3Byb3BzLmlzQ29ubmVjdGluZyA/IChcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidy00IGgtNCBib3JkZXItMiBib3JkZXItY3VycmVudCBib3JkZXItci10cmFuc3BhcmVudCByb3VuZGVkLWZ1bGwgYW5pbWF0ZS1zcGluXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICBDb25uZWN0aW5nLi4uXG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj7wn6aKPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgIENvbm5lY3Qgd2l0aCBNZXRhTWFza1xuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuXG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17IXNob3dUZXN0T3B0aW9uKCkgJiYgIXNob3dQcml2YXRlS2V5SW5wdXQoKX0+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBnYXAtNCBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd1Rlc3RPcHRpb24odHJ1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIGhvdmVyOnRleHQtZ3JheS0zMDAgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgVXNlIGRlbW8gbW9kZVxuICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0ZXh0LWdyYXktNjAwXCI+fDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dQcml2YXRlS2V5SW5wdXQodHJ1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIGhvdmVyOnRleHQtZ3JheS0zMDAgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgVXNlIHByaXZhdGUga2V5XG4gICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17c2hvd1Rlc3RPcHRpb24oKX0+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicHQtNiBzcGFjZS15LTRcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJvcmRlci10IGJvcmRlci1ncmF5LTgwMCBwdC02XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25Vc2VUZXN0TW9kZX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJzZWNvbmRhcnlcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTRcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIENvbnRpbnVlIHdpdGggRGVtbyBNb2RlXG4gICAgICAgICAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd1Rlc3RPcHRpb24oZmFsc2UpfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIGhvdmVyOnRleHQtZ3JheS0zMDAgdHJhbnNpdGlvbi1jb2xvcnMgbXQtM1wiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgQmFja1xuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Nob3dQcml2YXRlS2V5SW5wdXQoKX0+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicHQtNiBzcGFjZS15LTRcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJvcmRlci10IGJvcmRlci1ncmF5LTgwMCBwdC02XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwicGFzc3dvcmRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e3ByaXZhdGVLZXkoKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uSW5wdXQ9eyhlKSA9PiBzZXRQcml2YXRlS2V5KGUuY3VycmVudFRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkVudGVyIHByaXZhdGUga2V5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTQgcHgtNCBiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQtbGcgdGV4dC13aGl0ZSBwbGFjZWhvbGRlci1ncmF5LTUwMCBmb2N1czpvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLXB1cnBsZS01MDBcIlxuICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gcHJvcHMub25Vc2VQcml2YXRlS2V5KHByaXZhdGVLZXkoKSl9XG4gICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17IXByaXZhdGVLZXkoKSB8fCBwcml2YXRlS2V5KCkubGVuZ3RoICE9PSA2NH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJzZWNvbmRhcnlcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTQgbXQtM1wiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgQ29ubmVjdCB3aXRoIFByaXZhdGUgS2V5XG4gICAgICAgICAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTaG93UHJpdmF0ZUtleUlucHV0KGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0UHJpdmF0ZUtleSgnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIGhvdmVyOnRleHQtZ3JheS0zMDAgdHJhbnNpdGlvbi1jb2xvcnMgbXQtM1wiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgQmFja1xuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgIHsvKiBHZW5lcmF0aW5nIFRva2VuIFN0ZXAgKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuc3RlcCA9PT0gJ2dlbmVyYXRpbmctdG9rZW4nfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBzcGFjZS15LThcIj5cbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTR4bCBmb250LXNlbWlib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgICAgICAgU2V0dGluZyBVcCBZb3VyIEFjY291bnRcbiAgICAgICAgICAgICAgICA8L2gyPlxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLndhbGxldEFkZHJlc3N9PlxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQtbGcgbWItM1wiPlxuICAgICAgICAgICAgICAgICAgICBDb25uZWN0ZWQgd2FsbGV0OlxuICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgPGNvZGUgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtcHVycGxlLTQwMCBiZy1ncmF5LTgwMCBweC00IHB5LTIgcm91bmRlZC1sZyBmb250LW1vbm8gaW5saW5lLWJsb2NrXCI+XG4gICAgICAgICAgICAgICAgICAgIHtwcm9wcy53YWxsZXRBZGRyZXNzPy5zbGljZSgwLCA2KX0uLi57cHJvcHMud2FsbGV0QWRkcmVzcz8uc2xpY2UoLTQpfVxuICAgICAgICAgICAgICAgICAgPC9jb2RlPlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB5LTEyXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInctMjAgaC0yMCBib3JkZXItNCBib3JkZXItcHVycGxlLTUwMCBib3JkZXItdC10cmFuc3BhcmVudCByb3VuZGVkLWZ1bGwgYW5pbWF0ZS1zcGluIG14LWF1dG9cIiAvPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS00MDAgdGV4dC14bFwiPlxuICAgICAgICAgICAgICAgIHtwcm9wcy5pc0dlbmVyYXRpbmcgXG4gICAgICAgICAgICAgICAgICA/ICdHZW5lcmF0aW5nIHlvdXIgYWNjZXNzIHRva2VuLi4uJyBcbiAgICAgICAgICAgICAgICAgIDogJ1ZlcmlmeWluZyB5b3VyIGFjY291bnQuLi4nfVxuICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICB7LyogQ29tcGxldGUgU3RlcCAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zdGVwID09PSAnY29tcGxldGUnfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBzcGFjZS15LThcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtOHhsIG1iLTZcIj7wn46JPC9kaXY+XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQtNHhsIGZvbnQtc2VtaWJvbGQgdGV4dC13aGl0ZSBtYi00XCI+XG4gICAgICAgICAgICAgICAgICBZb3UncmUgQWxsIFNldCFcbiAgICAgICAgICAgICAgICA8L2gyPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTQwMCB0ZXh0LXhsIG1heC13LW1kIG14LWF1dG8gbWItOFwiPlxuICAgICAgICAgICAgICAgICAgWW91ciBhY2NvdW50IGlzIHJlYWR5LiBUaW1lIHRvIHNpbmchXG4gICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWF4LXctbWQgbXgtYXV0b1wiPlxuICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ29tcGxldGV9XG4gICAgICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNiB0ZXh0LWxnXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICBTdGFydCBTaW5naW5nISDwn5qAXG4gICAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBtdC02XCI+XG4gICAgICAgICAgICAgICAgTG9vayBmb3IgdGhlIGthcmFva2Ugd2lkZ2V0IG9uIGFueSBTb3VuZENsb3VkIHRyYWNrXG4gICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgRm9yLCBjcmVhdGVFZmZlY3QsIGNyZWF0ZVNpZ25hbCwgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTHlyaWNMaW5lIHtcbiAgaWQ6IHN0cmluZztcbiAgdGV4dDogc3RyaW5nO1xuICBzdGFydFRpbWU6IG51bWJlcjsgLy8gaW4gc2Vjb25kc1xuICBkdXJhdGlvbjogbnVtYmVyOyAvLyBpbiBtaWxsaXNlY29uZHNcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMeXJpY3NEaXNwbGF5UHJvcHMge1xuICBseXJpY3M6IEx5cmljTGluZVtdO1xuICBjdXJyZW50VGltZT86IG51bWJlcjsgLy8gaW4gbWlsbGlzZWNvbmRzXG4gIGlzUGxheWluZz86IGJvb2xlYW47XG4gIGxpbmVTY29yZXM/OiBBcnJheTx7IGxpbmVJbmRleDogbnVtYmVyOyBzY29yZTogbnVtYmVyOyB0cmFuc2NyaXB0aW9uOiBzdHJpbmc7IGZlZWRiYWNrPzogc3RyaW5nIH0+O1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEx5cmljc0Rpc3BsYXk6IENvbXBvbmVudDxMeXJpY3NEaXNwbGF5UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtjdXJyZW50TGluZUluZGV4LCBzZXRDdXJyZW50TGluZUluZGV4XSA9IGNyZWF0ZVNpZ25hbCgtMSk7XG4gIGxldCBjb250YWluZXJSZWY6IEhUTUxEaXZFbGVtZW50IHwgdW5kZWZpbmVkO1xuICBcbiAgLy8gSGVscGVyIHRvIGdldCBzY29yZSBmb3IgYSBsaW5lXG4gIGNvbnN0IGdldExpbmVTY29yZSA9IChsaW5lSW5kZXg6IG51bWJlcikgPT4ge1xuICAgIHJldHVybiBwcm9wcy5saW5lU2NvcmVzPy5maW5kKHMgPT4gcy5saW5lSW5kZXggPT09IGxpbmVJbmRleCk/LnNjb3JlIHx8IG51bGw7XG4gIH07XG4gIFxuICAvLyBIZWxwZXIgdG8gZ2V0IGNvbG9yIGJhc2VkIG9uIHNjb3JlXG4gIGNvbnN0IGdldFNjb3JlU3R5bGUgPSAoc2NvcmU6IG51bWJlciB8IG51bGwpID0+IHtcbiAgICBpZiAoc2NvcmUgPT09IG51bGwpIHJldHVybiB7fTtcbiAgICBcbiAgICAvLyBTaW1wbGUgY29sb3IgY2hhbmdlcyBvbmx5IC0gbm8gYW5pbWF0aW9ucyBvciBlZmZlY3RzXG4gICAgaWYgKHNjb3JlID49IDk1KSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZjM4MzgnIH07XG4gICAgfSBlbHNlIGlmIChzY29yZSA+PSA5MCkge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmY2YjZiJyB9O1xuICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gODApIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmODc4NycgfTtcbiAgICB9IGVsc2UgaWYgKHNjb3JlID49IDcwKSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZmE4YTgnIH07XG4gICAgfSBlbHNlIGlmIChzY29yZSA+PSA2MCkge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmZjZWNlJyB9O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZmUwZTAnIH07XG4gICAgfVxuICB9O1xuICBcbiAgLy8gUmVtb3ZlZCBlbW9qaSBmdW5jdGlvbiAtIHVzaW5nIGNvbG9ycyBvbmx5XG5cbiAgLy8gRmluZCBjdXJyZW50IGxpbmUgYmFzZWQgb24gdGltZVxuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghcHJvcHMuY3VycmVudFRpbWUgfHwgIXByb3BzLmx5cmljcy5sZW5ndGgpIHtcbiAgICAgIHNldEN1cnJlbnRMaW5lSW5kZXgoLTEpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRpbWUgPSBwcm9wcy5jdXJyZW50VGltZSAvIDEwMDA7IC8vIENvbnZlcnQgZnJvbSBtaWxsaXNlY29uZHMgdG8gc2Vjb25kc1xuICAgIGNvbnN0IFRJTUlOR19PRkZTRVQgPSAwLjM7IC8vIE9mZnNldCB0byBtYWtlIGx5cmljcyBhcHBlYXIgMC4zcyBlYXJsaWVyXG4gICAgY29uc3QgYWRqdXN0ZWRUaW1lID0gdGltZSArIFRJTUlOR19PRkZTRVQ7XG4gICAgXG4gICAgLy8gRmluZCB0aGUgbGluZSB0aGF0IGNvbnRhaW5zIHRoZSBjdXJyZW50IHRpbWVcbiAgICBsZXQgZm91bmRJbmRleCA9IC0xO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJvcHMubHlyaWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBsaW5lID0gcHJvcHMubHlyaWNzW2ldO1xuICAgICAgaWYgKCFsaW5lKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGVuZFRpbWUgPSBsaW5lLnN0YXJ0VGltZSArIGxpbmUuZHVyYXRpb24gLyAxMDAwOyAvLyBDb252ZXJ0IGR1cmF0aW9uIGZyb20gbXMgdG8gc2Vjb25kc1xuICAgICAgXG4gICAgICBpZiAoYWRqdXN0ZWRUaW1lID49IGxpbmUuc3RhcnRUaW1lICYmIGFkanVzdGVkVGltZSA8IGVuZFRpbWUpIHtcbiAgICAgICAgZm91bmRJbmRleCA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBJZiBubyBsaW5lIGNvbnRhaW5zIGN1cnJlbnQgdGltZSwgZmluZCB0aGUgbW9zdCByZWNlbnQgcGFzdCBsaW5lXG4gICAgaWYgKGZvdW5kSW5kZXggPT09IC0xICYmIHRpbWUgPiAwKSB7XG4gICAgICBmb3IgKGxldCBpID0gcHJvcHMubHlyaWNzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGNvbnN0IGxpbmUgPSBwcm9wcy5seXJpY3NbaV07XG4gICAgICAgIGlmICghbGluZSkgY29udGludWU7XG4gICAgICAgIGlmICh0aW1lID49IGxpbmUuc3RhcnRUaW1lKSB7XG4gICAgICAgICAgZm91bmRJbmRleCA9IGk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gT25seSB1cGRhdGUgaWYgdGhlIGluZGV4IGhhcyBjaGFuZ2VkIHRvIGF2b2lkIHVubmVjZXNzYXJ5IHNjcm9sbGluZ1xuICAgIGlmIChmb3VuZEluZGV4ICE9PSBjdXJyZW50TGluZUluZGV4KCkpIHtcbiAgICAgIGNvbnN0IHByZXZJbmRleCA9IGN1cnJlbnRMaW5lSW5kZXgoKTtcbiAgICAgIC8vIE9ubHkgbG9nIGxhcmdlIGp1bXBzIHRvIHJlZHVjZSBjb25zb2xlIHNwYW1cbiAgICAgIGlmIChNYXRoLmFicyhmb3VuZEluZGV4IC0gcHJldkluZGV4KSA+IDUpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tMeXJpY3NEaXNwbGF5XSBDdXJyZW50IGxpbmUgY2hhbmdlZDonLCB7XG4gICAgICAgICAgZnJvbTogcHJldkluZGV4LFxuICAgICAgICAgIHRvOiBmb3VuZEluZGV4LFxuICAgICAgICAgIHRpbWU6IHByb3BzLmN1cnJlbnRUaW1lLFxuICAgICAgICAgIHRpbWVJblNlY29uZHM6IHRpbWUsXG4gICAgICAgICAganVtcDogTWF0aC5hYnMoZm91bmRJbmRleCAtIHByZXZJbmRleClcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIExvZyB3YXJuaW5nIGZvciBsYXJnZSBqdW1wc1xuICAgICAgaWYgKHByZXZJbmRleCAhPT0gLTEgJiYgTWF0aC5hYnMoZm91bmRJbmRleCAtIHByZXZJbmRleCkgPiAxMCkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tMeXJpY3NEaXNwbGF5XSBMYXJnZSBsaW5lIGp1bXAgZGV0ZWN0ZWQhJywge1xuICAgICAgICAgIGZyb206IHByZXZJbmRleCxcbiAgICAgICAgICB0bzogZm91bmRJbmRleCxcbiAgICAgICAgICBmcm9tTGluZTogcHJvcHMubHlyaWNzW3ByZXZJbmRleF0sXG4gICAgICAgICAgdG9MaW5lOiBwcm9wcy5seXJpY3NbZm91bmRJbmRleF1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHNldEN1cnJlbnRMaW5lSW5kZXgoZm91bmRJbmRleCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBBdXRvLXNjcm9sbCB0byBjdXJyZW50IGxpbmVcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBpbmRleCA9IGN1cnJlbnRMaW5lSW5kZXgoKTtcbiAgICBpZiAoaW5kZXggPT09IC0xIHx8ICFjb250YWluZXJSZWYgfHwgIXByb3BzLmlzUGxheWluZykgcmV0dXJuO1xuXG4gICAgY29uc3QgbGluZUVsZW1lbnRzID0gY29udGFpbmVyUmVmLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWxpbmUtaW5kZXhdJyk7XG4gICAgY29uc3QgY3VycmVudEVsZW1lbnQgPSBsaW5lRWxlbWVudHNbaW5kZXhdIGFzIEhUTUxFbGVtZW50O1xuXG4gICAgaWYgKGN1cnJlbnRFbGVtZW50KSB7XG4gICAgICBjb25zdCBjb250YWluZXJIZWlnaHQgPSBjb250YWluZXJSZWYuY2xpZW50SGVpZ2h0O1xuICAgICAgY29uc3QgbGluZVRvcCA9IGN1cnJlbnRFbGVtZW50Lm9mZnNldFRvcDtcbiAgICAgIGNvbnN0IGxpbmVIZWlnaHQgPSBjdXJyZW50RWxlbWVudC5vZmZzZXRIZWlnaHQ7XG4gICAgICBcbiAgICAgIC8vIENlbnRlciB0aGUgY3VycmVudCBsaW5lXG4gICAgICBjb25zdCB0YXJnZXRTY3JvbGxUb3AgPSBsaW5lVG9wIC0gY29udGFpbmVySGVpZ2h0IC8gMiArIGxpbmVIZWlnaHQgLyAyO1xuICAgICAgXG4gICAgICBjb250YWluZXJSZWYuc2Nyb2xsVG8oe1xuICAgICAgICB0b3A6IHRhcmdldFNjcm9sbFRvcCxcbiAgICAgICAgYmVoYXZpb3I6ICdzbW9vdGgnLFxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gKFxuICAgIDxkaXZcbiAgICAgIHJlZj17Y29udGFpbmVyUmVmfVxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAnbHlyaWNzLWRpc3BsYXkgb3ZlcmZsb3cteS1hdXRvIHNjcm9sbC1zbW9vdGgnLFxuICAgICAgICAnaC1mdWxsIHB4LTYgcHktMTInLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS04XCI+XG4gICAgICAgIDxGb3IgZWFjaD17cHJvcHMubHlyaWNzfT5cbiAgICAgICAgICB7KGxpbmUsIGluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBsaW5lU2NvcmUgPSAoKSA9PiBnZXRMaW5lU2NvcmUoaW5kZXgoKSk7XG4gICAgICAgICAgICBjb25zdCBzY29yZVN0eWxlID0gKCkgPT4gZ2V0U2NvcmVTdHlsZShsaW5lU2NvcmUoKSk7XG4gICAgICAgICAgICAvLyBVc2luZyBjb2xvciBncmFkaWVudHMgaW5zdGVhZCBvZiBlbW9qaXNcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgIGRhdGEtbGluZS1pbmRleD17aW5kZXgoKX1cbiAgICAgICAgICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICAgICAndGV4dC1jZW50ZXInLFxuICAgICAgICAgICAgICAgICAgJ3RleHQtMnhsIGxlYWRpbmctcmVsYXhlZCcsXG4gICAgICAgICAgICAgICAgICBpbmRleCgpID09PSBjdXJyZW50TGluZUluZGV4KClcbiAgICAgICAgICAgICAgICAgICAgPyAnb3BhY2l0eS0xMDAnXG4gICAgICAgICAgICAgICAgICAgIDogJ29wYWNpdHktNjAnXG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAgICAgY29sb3I6IGluZGV4KCkgPT09IGN1cnJlbnRMaW5lSW5kZXgoKSAmJiAhbGluZVNjb3JlKCkgXG4gICAgICAgICAgICAgICAgICAgID8gJyNmZmZmZmYnIC8vIFdoaXRlIGZvciBjdXJyZW50IGxpbmUgd2l0aG91dCBzY29yZVxuICAgICAgICAgICAgICAgICAgICA6IHNjb3JlU3R5bGUoKS5jb2xvciB8fCAnI2ZmZmZmZidcbiAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAge2xpbmUudGV4dH1cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICApO1xuICAgICAgICAgIH19XG4gICAgICAgIDwvRm9yPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgS2FyYW9rZUhlYWRlclByb3BzIHtcbiAgc29uZ1RpdGxlOiBzdHJpbmc7XG4gIGFydGlzdDogc3RyaW5nO1xuICBvbkJhY2s/OiAoKSA9PiB2b2lkO1xuICBpc1BsYXlpbmc/OiBib29sZWFuO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuY29uc3QgQ2hldnJvbkxlZnQgPSAoKSA9PiAoXG4gIDxzdmcgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIGNsYXNzPVwidy02IGgtNlwiPlxuICAgIDxwYXRoIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiIGQ9XCJNMTUgMTlsLTctNyA3LTdcIiAvPlxuICA8L3N2Zz5cbik7XG5cbmNvbnN0IFBhdXNlSWNvbiA9ICgpID0+IChcbiAgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgY2xhc3M9XCJ3LTYgaC02XCI+XG4gICAgPHBhdGggc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIgZD1cIk0xMCA5djZtNC02djZtNy0zYTkgOSAwIDExLTE4IDAgOSA5IDAgMDExOCAwelwiIC8+XG4gIDwvc3ZnPlxuKTtcblxuZXhwb3J0IGNvbnN0IEthcmFva2VIZWFkZXI6IENvbXBvbmVudDxLYXJhb2tlSGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ3JlbGF0aXZlIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHAtNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogQmFjay9QYXVzZSBidXR0b24gLSBhYnNvbHV0ZSBwb3NpdGlvbmVkICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkJhY2t9XG4gICAgICAgIGNsYXNzPVwiYWJzb2x1dGUgbGVmdC00IHAtMiAtbS0yIHRleHQtc2Vjb25kYXJ5IGhvdmVyOnRleHQtcHJpbWFyeSB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgIGFyaWEtbGFiZWw9e3Byb3BzLmlzUGxheWluZyA/IFwiUGF1c2VcIiA6IFwiR28gYmFja1wifVxuICAgICAgPlxuICAgICAgICB7cHJvcHMuaXNQbGF5aW5nID8gPFBhdXNlSWNvbiAvPiA6IDxDaGV2cm9uTGVmdCAvPn1cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgXG4gICAgICB7LyogU29uZyBpbmZvIC0gY2VudGVyZWQgKi99XG4gICAgICA8aDEgY2xhc3M9XCJ0ZXh0LWJhc2UgZm9udC1tZWRpdW0gdGV4dC1wcmltYXJ5IHRleHQtY2VudGVyIHB4LTEyIHRydW5jYXRlIG1heC13LWZ1bGxcIj5cbiAgICAgICAge3Byb3BzLnNvbmdUaXRsZX0gLSB7cHJvcHMuYXJ0aXN0fVxuICAgICAgPC9oMT5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgRm9yLCBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBMZWFkZXJib2FyZEVudHJ5IHtcbiAgcmFuazogbnVtYmVyO1xuICB1c2VybmFtZTogc3RyaW5nO1xuICBzY29yZTogbnVtYmVyO1xuICBpc0N1cnJlbnRVc2VyPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMZWFkZXJib2FyZFBhbmVsUHJvcHMge1xuICBlbnRyaWVzOiBMZWFkZXJib2FyZEVudHJ5W107XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgTGVhZGVyYm9hcmRQYW5lbDogQ29tcG9uZW50PExlYWRlcmJvYXJkUGFuZWxQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZmxleCBmbGV4LWNvbCBnYXAtMiBwLTQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgPFNob3cgXG4gICAgICAgIHdoZW49e3Byb3BzLmVudHJpZXMubGVuZ3RoID4gMH1cbiAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBweS0xMiBweC02IHRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC02eGwgbWItNCBvcGFjaXR5LTMwXCI+8J+OpDwvZGl2PlxuICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5IG1iLTJcIj5Ob2JvZHkgaGFzIGNvbXBsZXRlZCB0aGlzIHNvbmcgeWV0ITwvcD5cbiAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zbSB0ZXh0LXRlcnRpYXJ5XCI+QmUgdGhlIGZpcnN0IHRvIHNldCBhIGhpZ2ggc2NvcmU8L3A+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIH1cbiAgICAgID5cbiAgICAgICAgPEZvciBlYWNoPXtwcm9wcy5lbnRyaWVzfT5cbiAgICAgICAgICB7KGVudHJ5KSA9PiAoXG4gICAgICAgICAgICA8ZGl2IFxuICAgICAgICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICAgJ2ZsZXggaXRlbXMtY2VudGVyIGdhcC0zIHB4LTMgcHktMiByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzJyxcbiAgICAgICAgICAgICAgICBlbnRyeS5pc0N1cnJlbnRVc2VyIFxuICAgICAgICAgICAgICAgICAgPyAnYmctYWNjZW50LXByaW1hcnkvMTAgYm9yZGVyIGJvcmRlci1hY2NlbnQtcHJpbWFyeS8yMCcgXG4gICAgICAgICAgICAgICAgICA6ICdiZy1zdXJmYWNlIGhvdmVyOmJnLXN1cmZhY2UtaG92ZXInXG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxzcGFuIFxuICAgICAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAgICd3LTggdGV4dC1jZW50ZXIgZm9udC1tb25vIGZvbnQtYm9sZCcsXG4gICAgICAgICAgICAgICAgICBlbnRyeS5yYW5rIDw9IDMgPyAndGV4dC1hY2NlbnQtcHJpbWFyeScgOiAndGV4dC1zZWNvbmRhcnknXG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICN7ZW50cnkucmFua31cbiAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICAgJ2ZsZXgtMSB0cnVuY2F0ZScsXG4gICAgICAgICAgICAgICAgZW50cnkuaXNDdXJyZW50VXNlciA/ICd0ZXh0LWFjY2VudC1wcmltYXJ5IGZvbnQtbWVkaXVtJyA6ICd0ZXh0LXByaW1hcnknXG4gICAgICAgICAgICAgICl9PlxuICAgICAgICAgICAgICAgIHtlbnRyeS51c2VybmFtZX1cbiAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICAgJ2ZvbnQtbW9ubyBmb250LWJvbGQnLFxuICAgICAgICAgICAgICAgIGVudHJ5LmlzQ3VycmVudFVzZXIgPyAndGV4dC1hY2NlbnQtcHJpbWFyeScgOiAndGV4dC1wcmltYXJ5J1xuICAgICAgICAgICAgICApfT5cbiAgICAgICAgICAgICAgICB7ZW50cnkuc2NvcmUudG9Mb2NhbGVTdHJpbmcoKX1cbiAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9Gb3I+XG4gICAgICA8L1Nob3c+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCB0eXBlIFBsYXliYWNrU3BlZWQgPSAnMXgnIHwgJzAuNzV4JyB8ICcwLjV4JztcblxuZXhwb3J0IGludGVyZmFjZSBTcGxpdEJ1dHRvblByb3BzIHtcbiAgb25TdGFydD86ICgpID0+IHZvaWQ7XG4gIG9uU3BlZWRDaGFuZ2U/OiAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpID0+IHZvaWQ7XG4gIGRpc2FibGVkPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmNvbnN0IHNwZWVkczogUGxheWJhY2tTcGVlZFtdID0gWycxeCcsICcwLjc1eCcsICcwLjV4J107XG5cbmV4cG9ydCBjb25zdCBTcGxpdEJ1dHRvbjogQ29tcG9uZW50PFNwbGl0QnV0dG9uUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtjdXJyZW50U3BlZWRJbmRleCwgc2V0Q3VycmVudFNwZWVkSW5kZXhdID0gY3JlYXRlU2lnbmFsKDApO1xuICBcbiAgY29uc3QgY3VycmVudFNwZWVkID0gKCkgPT4gc3BlZWRzW2N1cnJlbnRTcGVlZEluZGV4KCldO1xuICBcbiAgY29uc3QgY3ljbGVTcGVlZCA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBjb25zdCBuZXh0SW5kZXggPSAoY3VycmVudFNwZWVkSW5kZXgoKSArIDEpICUgc3BlZWRzLmxlbmd0aDtcbiAgICBzZXRDdXJyZW50U3BlZWRJbmRleChuZXh0SW5kZXgpO1xuICAgIGNvbnN0IG5ld1NwZWVkID0gc3BlZWRzW25leHRJbmRleF07XG4gICAgaWYgKG5ld1NwZWVkKSB7XG4gICAgICBwcm9wcy5vblNwZWVkQ2hhbmdlPy4obmV3U3BlZWQpO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdyZWxhdGl2ZSBpbmxpbmUtZmxleCB3LWZ1bGwgcm91bmRlZC1sZyBvdmVyZmxvdy1oaWRkZW4nLFxuICAgICAgICAnYmctZ3JhZGllbnQtcHJpbWFyeSB0ZXh0LXdoaXRlIHNoYWRvdy1sZycsXG4gICAgICAgICd0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICB7LyogTWFpbiBidXR0b24gKi99XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uU3RhcnR9XG4gICAgICAgIGRpc2FibGVkPXtwcm9wcy5kaXNhYmxlZH1cbiAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICdmbGV4LTEgaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJlbGF0aXZlIG92ZXJmbG93LWhpZGRlbicsXG4gICAgICAgICAgJ2gtMTIgcHgtNiB0ZXh0LWxnIGZvbnQtbWVkaXVtJyxcbiAgICAgICAgICAnY3Vyc29yLXBvaW50ZXIgYm9yZGVyLW5vbmUgb3V0bGluZS1ub25lJyxcbiAgICAgICAgICAnZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICAgICdob3ZlcjpiZy13aGl0ZS8xMCBhY3RpdmU6Ymctd2hpdGUvMjAnXG4gICAgICAgICl9XG4gICAgICA+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwicmVsYXRpdmUgei0xMFwiPlN0YXJ0PC9zcGFuPlxuICAgICAgPC9idXR0b24+XG4gICAgICBcbiAgICAgIHsvKiBEaXZpZGVyICovfVxuICAgICAgPGRpdiBjbGFzcz1cInctcHggYmctYmxhY2svMjBcIiAvPlxuICAgICAgXG4gICAgICB7LyogU3BlZWQgYnV0dG9uICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtjeWNsZVNwZWVkfVxuICAgICAgICBkaXNhYmxlZD17cHJvcHMuZGlzYWJsZWR9XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJlbGF0aXZlJyxcbiAgICAgICAgICAndy0yMCB0ZXh0LWxnIGZvbnQtbWVkaXVtJyxcbiAgICAgICAgICAnY3Vyc29yLXBvaW50ZXIgYm9yZGVyLW5vbmUgb3V0bGluZS1ub25lJyxcbiAgICAgICAgICAnZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICAgICdob3ZlcjpiZy13aGl0ZS8xMCBhY3RpdmU6Ymctd2hpdGUvMjAnLFxuICAgICAgICAgICdhZnRlcjpjb250ZW50LVtcIlwiXSBhZnRlcjphYnNvbHV0ZSBhZnRlcjppbnNldC0wJyxcbiAgICAgICAgICAnYWZ0ZXI6YmctZ3JhZGllbnQtdG8tciBhZnRlcjpmcm9tLXRyYW5zcGFyZW50IGFmdGVyOnZpYS13aGl0ZS8yMCBhZnRlcjp0by10cmFuc3BhcmVudCcsXG4gICAgICAgICAgJ2FmdGVyOnRyYW5zbGF0ZS14LVstMjAwJV0gaG92ZXI6YWZ0ZXI6dHJhbnNsYXRlLXgtWzIwMCVdJyxcbiAgICAgICAgICAnYWZ0ZXI6dHJhbnNpdGlvbi10cmFuc2Zvcm0gYWZ0ZXI6ZHVyYXRpb24tNzAwJ1xuICAgICAgICApfVxuICAgICAgICBhcmlhLWxhYmVsPVwiQ2hhbmdlIHBsYXliYWNrIHNwZWVkXCJcbiAgICAgID5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJyZWxhdGl2ZSB6LTEwXCI+e2N1cnJlbnRTcGVlZCgpfTwvc3Bhbj5cbiAgICAgIDwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIFNob3csIGNyZWF0ZUNvbnRleHQsIHVzZUNvbnRleHQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCwgSlNYLCBQYXJlbnRDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBUYWIge1xuICBpZDogc3RyaW5nO1xuICBsYWJlbDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNQcm9wcyB7XG4gIHRhYnM6IFRhYltdO1xuICBkZWZhdWx0VGFiPzogc3RyaW5nO1xuICBvblRhYkNoYW5nZT86ICh0YWJJZDogc3RyaW5nKSA9PiB2b2lkO1xuICBjaGlsZHJlbjogSlNYLkVsZW1lbnQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNMaXN0UHJvcHMge1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNUcmlnZ2VyUHJvcHMge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNDb250ZW50UHJvcHMge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG4vLyBDb250ZXh0IGZvciB0YWJzIHN0YXRlXG5pbnRlcmZhY2UgVGFic0NvbnRleHRWYWx1ZSB7XG4gIGFjdGl2ZVRhYjogKCkgPT4gc3RyaW5nO1xuICBzZXRBY3RpdmVUYWI6IChpZDogc3RyaW5nKSA9PiB2b2lkO1xufVxuXG5jb25zdCBUYWJzQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8VGFic0NvbnRleHRWYWx1ZT4oKTtcblxuZXhwb3J0IGNvbnN0IFRhYnM6IFBhcmVudENvbXBvbmVudDxUYWJzUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFthY3RpdmVUYWIsIHNldEFjdGl2ZVRhYl0gPSBjcmVhdGVTaWduYWwocHJvcHMuZGVmYXVsdFRhYiB8fCBwcm9wcy50YWJzWzBdPy5pZCB8fCAnJyk7XG4gIFxuICBjb25zb2xlLmxvZygnW1RhYnNdIEluaXRpYWxpemluZyB3aXRoOicsIHtcbiAgICBkZWZhdWx0VGFiOiBwcm9wcy5kZWZhdWx0VGFiLFxuICAgIGZpcnN0VGFiSWQ6IHByb3BzLnRhYnNbMF0/LmlkLFxuICAgIGFjdGl2ZVRhYjogYWN0aXZlVGFiKClcbiAgfSk7XG4gIFxuICBjb25zdCBoYW5kbGVUYWJDaGFuZ2UgPSAoaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbVGFic10gVGFiIGNoYW5nZWQgdG86JywgaWQpO1xuICAgIHNldEFjdGl2ZVRhYihpZCk7XG4gICAgcHJvcHMub25UYWJDaGFuZ2U/LihpZCk7XG4gIH07XG5cbiAgY29uc3QgY29udGV4dFZhbHVlOiBUYWJzQ29udGV4dFZhbHVlID0ge1xuICAgIGFjdGl2ZVRhYixcbiAgICBzZXRBY3RpdmVUYWI6IGhhbmRsZVRhYkNoYW5nZVxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPFRhYnNDb250ZXh0LlByb3ZpZGVyIHZhbHVlPXtjb250ZXh0VmFsdWV9PlxuICAgICAgPGRpdiBjbGFzcz17Y24oJ3ctZnVsbCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICAgIDwvZGl2PlxuICAgIDwvVGFic0NvbnRleHQuUHJvdmlkZXI+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgVGFic0xpc3Q6IENvbXBvbmVudDxUYWJzTGlzdFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdpbmxpbmUtZmxleCBoLTEwIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLW1kIGJnLXN1cmZhY2UgcC0xIHRleHQtc2Vjb25kYXJ5JyxcbiAgICAgICAgJ3ctZnVsbCcsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICA8L2Rpdj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBUYWJzVHJpZ2dlcjogQ29tcG9uZW50PFRhYnNUcmlnZ2VyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IGNvbnRleHQgPSB1c2VDb250ZXh0KFRhYnNDb250ZXh0KTtcbiAgaWYgKCFjb250ZXh0KSB7XG4gICAgY29uc29sZS5lcnJvcignW1RhYnNUcmlnZ2VyXSBObyBUYWJzQ29udGV4dCBmb3VuZC4gVGFic1RyaWdnZXIgbXVzdCBiZSB1c2VkIHdpdGhpbiBUYWJzIGNvbXBvbmVudC4nKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBcbiAgY29uc3QgaXNBY3RpdmUgPSAoKSA9PiBjb250ZXh0LmFjdGl2ZVRhYigpID09PSBwcm9wcy52YWx1ZTtcblxuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIG9uQ2xpY2s9eygpID0+IGNvbnRleHQuc2V0QWN0aXZlVGFiKHByb3BzLnZhbHVlKX1cbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2lubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB3aGl0ZXNwYWNlLW5vd3JhcCByb3VuZGVkLXNtIHB4LTMgcHktMS41JyxcbiAgICAgICAgJ3RleHQtc20gZm9udC1tZWRpdW0gcmluZy1vZmZzZXQtYmFzZSB0cmFuc2l0aW9uLWFsbCcsXG4gICAgICAgICdmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZSBmb2N1cy12aXNpYmxlOnJpbmctMiBmb2N1cy12aXNpYmxlOnJpbmctcHVycGxlLTUwMCBmb2N1cy12aXNpYmxlOnJpbmctb2Zmc2V0LTInLFxuICAgICAgICAnZGlzYWJsZWQ6cG9pbnRlci1ldmVudHMtbm9uZSBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAgJ2ZsZXgtMScsXG4gICAgICAgIGlzQWN0aXZlKClcbiAgICAgICAgICA/ICdiZy1iYXNlIHRleHQtcHJpbWFyeSBzaGFkb3ctc20nXG4gICAgICAgICAgOiAndGV4dC1zZWNvbmRhcnkgaG92ZXI6dGV4dC1wcmltYXJ5JyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgIDwvYnV0dG9uPlxuICApO1xufTtcblxuZXhwb3J0IGNvbnN0IFRhYnNDb250ZW50OiBDb21wb25lbnQ8VGFic0NvbnRlbnRQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgY29udGV4dCA9IHVzZUNvbnRleHQoVGFic0NvbnRleHQpO1xuICBpZiAoIWNvbnRleHQpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbVGFic0NvbnRlbnRdIE5vIFRhYnNDb250ZXh0IGZvdW5kLiBUYWJzQ29udGVudCBtdXN0IGJlIHVzZWQgd2l0aGluIFRhYnMgY29tcG9uZW50LicpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIFxuICBjb25zdCBpc0FjdGl2ZSA9ICgpID0+IGNvbnRleHQuYWN0aXZlVGFiKCkgPT09IHByb3BzLnZhbHVlO1xuICBcbiAgcmV0dXJuIChcbiAgICA8U2hvdyB3aGVuPXtpc0FjdGl2ZSgpfT5cbiAgICAgIDxkaXZcbiAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICdtdC0yIHJpbmctb2Zmc2V0LWJhc2UnLFxuICAgICAgICAgICdmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZSBmb2N1cy12aXNpYmxlOnJpbmctMiBmb2N1cy12aXNpYmxlOnJpbmctcHVycGxlLTUwMCBmb2N1cy12aXNpYmxlOnJpbmctb2Zmc2V0LTInLFxuICAgICAgICAgIHByb3BzLmNsYXNzXG4gICAgICAgICl9XG4gICAgICA+XG4gICAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICAgIDwvZGl2PlxuICAgIDwvU2hvdz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsLCBjcmVhdGVFZmZlY3QsIFNob3csIG9uQ2xlYW51cCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5pbXBvcnQgc3R5bGVzIGZyb20gJy4vRmlyZUVtb2ppQW5pbWF0aW9uLm1vZHVsZS5jc3MnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZpcmVFbW9qaUFuaW1hdGlvblByb3BzIHtcbiAgc2NvcmU6IG51bWJlcjtcbiAgbGluZUluZGV4OiBudW1iZXI7IC8vIFVzZSBsaW5lIGluZGV4IGluc3RlYWQgb2YgdHJpZ2dlclxuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEZpcmVFbW9qaUFuaW1hdGlvbjogQ29tcG9uZW50PEZpcmVFbW9qaUFuaW1hdGlvblByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbc2hvd0ZpcmUsIHNldFNob3dGaXJlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtmaXJlWCwgc2V0RmlyZVhdID0gY3JlYXRlU2lnbmFsKDUwKTtcbiAgbGV0IGxhc3RMaW5lSW5kZXggPSAtMTtcbiAgbGV0IGhpZGVUaW1lcjogbnVtYmVyIHwgdW5kZWZpbmVkO1xuICBcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICAvLyBDaGVjayBpZiB3ZSBoYXZlIGEgbmV3IGxpbmUgd2l0aCBoaWdoIHNjb3JlXG4gICAgaWYgKHByb3BzLmxpbmVJbmRleCA+IGxhc3RMaW5lSW5kZXggJiYgcHJvcHMuc2NvcmUgPj0gODApIHtcbiAgICAgIC8vIFJhbmRvbSBYIHBvc2l0aW9uIGJldHdlZW4gMjAlIGFuZCA4MCVcbiAgICAgIHNldEZpcmVYKDIwICsgTWF0aC5yYW5kb20oKSAqIDYwKTtcbiAgICAgIHNldFNob3dGaXJlKHRydWUpO1xuICAgICAgXG4gICAgICAvLyBDbGVhciBleGlzdGluZyB0aW1lclxuICAgICAgaWYgKGhpZGVUaW1lcikgY2xlYXJUaW1lb3V0KGhpZGVUaW1lcik7XG4gICAgICBcbiAgICAgIC8vIEhpZGUgYWZ0ZXIgYW5pbWF0aW9uIGNvbXBsZXRlc1xuICAgICAgaGlkZVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHNldFNob3dGaXJlKGZhbHNlKTtcbiAgICAgIH0sIDIwMDApO1xuICAgICAgXG4gICAgICBsYXN0TGluZUluZGV4ID0gcHJvcHMubGluZUluZGV4O1xuICAgIH1cbiAgfSk7XG4gIFxuICBvbkNsZWFudXAoKCkgPT4ge1xuICAgIGlmIChoaWRlVGltZXIpIGNsZWFyVGltZW91dChoaWRlVGltZXIpO1xuICB9KTtcblxuICByZXR1cm4gKFxuICAgIDxTaG93IHdoZW49e3Nob3dGaXJlKCl9PlxuICAgICAgPGRpdiBjbGFzcz17Y24oc3R5bGVzLmZpcmVDb250YWluZXIsIHByb3BzLmNsYXNzKX0+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICBjbGFzcz17c3R5bGVzLmZpcmVFbW9qaX1cbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgbGVmdDogYCR7ZmlyZVgoKX0lYCxcbiAgICAgICAgICAgICdmb250LXNpemUnOiAnMzJweCdcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAg8J+UpVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvU2hvdz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdywgdHlwZSBDb21wb25lbnQsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlRWZmZWN0IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5pbXBvcnQgeyBTY29yZVBhbmVsIH0gZnJvbSAnLi4vLi4vZGlzcGxheS9TY29yZVBhbmVsJztcbmltcG9ydCB7IEx5cmljc0Rpc3BsYXksIHR5cGUgTHlyaWNMaW5lIH0gZnJvbSAnLi4vTHlyaWNzRGlzcGxheSc7XG5pbXBvcnQgeyBMZWFkZXJib2FyZFBhbmVsLCB0eXBlIExlYWRlcmJvYXJkRW50cnkgfSBmcm9tICcuLi9MZWFkZXJib2FyZFBhbmVsJztcbmltcG9ydCB7IFNwbGl0QnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL1NwbGl0QnV0dG9uJztcbmltcG9ydCB0eXBlIHsgUGxheWJhY2tTcGVlZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5pbXBvcnQgeyBUYWJzLCBUYWJzTGlzdCwgVGFic1RyaWdnZXIsIFRhYnNDb250ZW50IH0gZnJvbSAnLi4vLi4vY29tbW9uL1RhYnMnO1xuaW1wb3J0IHsgRmlyZUVtb2ppQW5pbWF0aW9uIH0gZnJvbSAnLi4vLi4vZWZmZWN0cy9GaXJlRW1vamlBbmltYXRpb24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4dGVuc2lvbkthcmFva2VWaWV3UHJvcHMge1xuICAvLyBTY29yZXNcbiAgc2NvcmU6IG51bWJlcjtcbiAgcmFuazogbnVtYmVyO1xuICBcbiAgLy8gTHlyaWNzXG4gIGx5cmljczogTHlyaWNMaW5lW107XG4gIGN1cnJlbnRUaW1lPzogbnVtYmVyO1xuICBcbiAgLy8gTGVhZGVyYm9hcmRcbiAgbGVhZGVyYm9hcmQ6IExlYWRlcmJvYXJkRW50cnlbXTtcbiAgXG4gIC8vIFN0YXRlXG4gIGlzUGxheWluZz86IGJvb2xlYW47XG4gIGlzUmVjb3JkaW5nPzogYm9vbGVhbjtcbiAgb25TdGFydD86ICgpID0+IHZvaWQ7XG4gIG9uU3BlZWRDaGFuZ2U/OiAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpID0+IHZvaWQ7XG4gIFxuICAvLyBMaW5lIHNjb3JlcyBmb3IgdmlzdWFsIGZlZWRiYWNrXG4gIGxpbmVTY29yZXM/OiBBcnJheTx7IGxpbmVJbmRleDogbnVtYmVyOyBzY29yZTogbnVtYmVyOyB0cmFuc2NyaXB0aW9uOiBzdHJpbmc7IGZlZWRiYWNrPzogc3RyaW5nIH0+O1xuICBcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBFeHRlbnNpb25LYXJhb2tlVmlldzogQ29tcG9uZW50PEV4dGVuc2lvbkthcmFva2VWaWV3UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIC8vIEdldCB0aGUgbGF0ZXN0IGhpZ2ggc2NvcmUgbGluZSBpbmRleFxuICBjb25zdCBnZXRMYXRlc3RIaWdoU2NvcmVMaW5lID0gKCkgPT4ge1xuICAgIGNvbnN0IHNjb3JlcyA9IHByb3BzLmxpbmVTY29yZXMgfHwgW107XG4gICAgaWYgKHNjb3Jlcy5sZW5ndGggPT09IDApIHJldHVybiB7IHNjb3JlOiAwLCBsaW5lSW5kZXg6IC0xIH07XG4gICAgXG4gICAgY29uc3QgbGF0ZXN0ID0gc2NvcmVzW3Njb3Jlcy5sZW5ndGggLSAxXTtcbiAgICByZXR1cm4ge1xuICAgICAgc2NvcmU6IGxhdGVzdD8uc2NvcmUgfHwgMCxcbiAgICAgIGxpbmVJbmRleDogbGF0ZXN0Py5saW5lSW5kZXggfHwgLTFcbiAgICB9O1xuICB9O1xuICBcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZmxleCBmbGV4LWNvbCBoLWZ1bGwgYmctYmFzZSByZWxhdGl2ZScsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogU2NvcmUgUGFuZWwgLSBvbmx5IHNob3cgd2hlbiBub3QgcGxheWluZyAqL31cbiAgICAgIDxTaG93IHdoZW49eyFwcm9wcy5pc1BsYXlpbmd9PlxuICAgICAgICA8U2NvcmVQYW5lbFxuICAgICAgICAgIHNjb3JlPXtwcm9wcy5zY29yZX1cbiAgICAgICAgICByYW5rPXtwcm9wcy5yYW5rfVxuICAgICAgICAvPlxuICAgICAgPC9TaG93PlxuXG4gICAgICB7LyogU2hvdyB0YWJzIG9ubHkgd2hlbiBub3QgcGxheWluZyAqL31cbiAgICAgIDxTaG93IHdoZW49eyFwcm9wcy5pc1BsYXlpbmd9IGZhbGxiYWNrPXtcbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBmbGV4IGZsZXgtY29sIG1pbi1oLTBcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIG1pbi1oLTAgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICA8THlyaWNzRGlzcGxheVxuICAgICAgICAgICAgICBseXJpY3M9e3Byb3BzLmx5cmljc31cbiAgICAgICAgICAgICAgY3VycmVudFRpbWU9e3Byb3BzLmN1cnJlbnRUaW1lfVxuICAgICAgICAgICAgICBpc1BsYXlpbmc9e3Byb3BzLmlzUGxheWluZ31cbiAgICAgICAgICAgICAgbGluZVNjb3Jlcz17cHJvcHMubGluZVNjb3Jlc31cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgfT5cbiAgICAgICAgey8qIFRhYnMgYW5kIGNvbnRlbnQgKi99XG4gICAgICAgIDxUYWJzIFxuICAgICAgICAgIHRhYnM9e1tcbiAgICAgICAgICAgIHsgaWQ6ICdseXJpY3MnLCBsYWJlbDogJ0x5cmljcycgfSxcbiAgICAgICAgICAgIHsgaWQ6ICdsZWFkZXJib2FyZCcsIGxhYmVsOiAnTGVhZGVyYm9hcmQnIH1cbiAgICAgICAgICBdfVxuICAgICAgICAgIGRlZmF1bHRUYWI9XCJseXJpY3NcIlxuICAgICAgICAgIGNsYXNzPVwiZmxleC0xIGZsZXggZmxleC1jb2wgbWluLWgtMFwiXG4gICAgICAgID5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwicHgtNFwiPlxuICAgICAgICAgICAgPFRhYnNMaXN0PlxuICAgICAgICAgICAgICA8VGFic1RyaWdnZXIgdmFsdWU9XCJseXJpY3NcIj5MeXJpY3M8L1RhYnNUcmlnZ2VyPlxuICAgICAgICAgICAgICA8VGFic1RyaWdnZXIgdmFsdWU9XCJsZWFkZXJib2FyZFwiPkxlYWRlcmJvYXJkPC9UYWJzVHJpZ2dlcj5cbiAgICAgICAgICAgIDwvVGFic0xpc3Q+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgXG4gICAgICAgICAgPFRhYnNDb250ZW50IHZhbHVlPVwibHlyaWNzXCIgY2xhc3M9XCJmbGV4LTEgbWluLWgtMFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZmxleC1jb2wgaC1mdWxsXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgbWluLWgtMCBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgICAgICA8THlyaWNzRGlzcGxheVxuICAgICAgICAgICAgICAgICAgbHlyaWNzPXtwcm9wcy5seXJpY3N9XG4gICAgICAgICAgICAgICAgICBjdXJyZW50VGltZT17cHJvcHMuY3VycmVudFRpbWV9XG4gICAgICAgICAgICAgICAgICBpc1BsYXlpbmc9e3Byb3BzLmlzUGxheWluZ31cbiAgICAgICAgICAgICAgICAgIGxpbmVTY29yZXM9e3Byb3BzLmxpbmVTY29yZXN9XG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICB7LyogRm9vdGVyIHdpdGggc3RhcnQgYnV0dG9uICovfVxuICAgICAgICAgICAgICA8U2hvdyB3aGVuPXshcHJvcHMuaXNQbGF5aW5nICYmIHByb3BzLm9uU3RhcnR9PlxuICAgICAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInAtNCBiZy1zdXJmYWNlIGJvcmRlci10IGJvcmRlci1zdWJ0bGVcIlxuICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgICAgJ2ZsZXgtc2hyaW5rJzogJzAnXG4gICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxTcGxpdEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBvblN0YXJ0PXtwcm9wcy5vblN0YXJ0fVxuICAgICAgICAgICAgICAgICAgICBvblNwZWVkQ2hhbmdlPXtwcm9wcy5vblNwZWVkQ2hhbmdlfVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9UYWJzQ29udGVudD5cbiAgICAgICAgICBcbiAgICAgICAgICA8VGFic0NvbnRlbnQgdmFsdWU9XCJsZWFkZXJib2FyZFwiIGNsYXNzPVwiZmxleC0xIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm92ZXJmbG93LXktYXV0byBoLWZ1bGxcIj5cbiAgICAgICAgICAgICAgPExlYWRlcmJvYXJkUGFuZWwgZW50cmllcz17cHJvcHMubGVhZGVyYm9hcmR9IC8+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1RhYnNDb250ZW50PlxuICAgICAgICA8L1RhYnM+XG4gICAgICA8L1Nob3c+XG4gICAgICBcbiAgICAgIHsvKiBGaXJlIGVtb2ppIGVmZmVjdCAqL31cbiAgICAgIDxTaG93IHdoZW49e3Byb3BzLmlzUGxheWluZ30+XG4gICAgICAgIDxGaXJlRW1vamlBbmltYXRpb24gXG4gICAgICAgICAgc2NvcmU9e2dldExhdGVzdEhpZ2hTY29yZUxpbmUoKS5zY29yZX0gXG4gICAgICAgICAgbGluZUluZGV4PXtnZXRMYXRlc3RIaWdoU2NvcmVMaW5lKCkubGluZUluZGV4fVxuICAgICAgICAvPlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVDb250ZXh0LCB1c2VDb250ZXh0LCBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCwgY3JlYXRlTWVtbyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgUGFyZW50Q29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBUcmFuc2xhdGlvbnMsIExvY2FsZUNvZGUgfSBmcm9tICcuL3R5cGVzJztcblxuaW50ZXJmYWNlIEkxOG5Db250ZXh0VmFsdWUge1xuICBsb2NhbGU6ICgpID0+IExvY2FsZUNvZGU7XG4gIHNldExvY2FsZTogKGxvY2FsZTogTG9jYWxlQ29kZSkgPT4gdm9pZDtcbiAgdDogKGtleTogc3RyaW5nLCBwYXJhbXM/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBzdHJpbmc7XG4gIGRpcjogKCkgPT4gJ2x0cicgfCAncnRsJztcbiAgZm9ybWF0TnVtYmVyOiAobnVtOiBudW1iZXIpID0+IHN0cmluZztcbiAgZm9ybWF0RGF0ZTogKGRhdGU6IERhdGUsIG9wdGlvbnM/OiBJbnRsLkRhdGVUaW1lRm9ybWF0T3B0aW9ucykgPT4gc3RyaW5nO1xufVxuXG5jb25zdCBJMThuQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8STE4bkNvbnRleHRWYWx1ZT4oKTtcblxuZXhwb3J0IGNvbnN0IEkxOG5Qcm92aWRlcjogUGFyZW50Q29tcG9uZW50PHsgZGVmYXVsdExvY2FsZT86IExvY2FsZUNvZGUgfT4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2xvY2FsZSwgc2V0TG9jYWxlXSA9IGNyZWF0ZVNpZ25hbDxMb2NhbGVDb2RlPihwcm9wcy5kZWZhdWx0TG9jYWxlIHx8ICdlbicpO1xuICBjb25zdCBbdHJhbnNsYXRpb25zLCBzZXRUcmFuc2xhdGlvbnNdID0gY3JlYXRlU2lnbmFsPFRyYW5zbGF0aW9ucz4oKTtcbiAgXG4gIC8vIExvYWQgdHJhbnNsYXRpb25zIGR5bmFtaWNhbGx5XG4gIGNyZWF0ZUVmZmVjdChhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgY3VycmVudExvY2FsZSA9IGxvY2FsZSgpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBtb2R1bGUgPSBhd2FpdCBpbXBvcnQoYC4vbG9jYWxlcy8ke2N1cnJlbnRMb2NhbGV9L2luZGV4LnRzYCk7XG4gICAgICBzZXRUcmFuc2xhdGlvbnMobW9kdWxlLmRlZmF1bHQpO1xuICAgIH0gY2F0Y2ggKF9lKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEZhaWxlZCB0byBsb2FkIGxvY2FsZSAke2N1cnJlbnRMb2NhbGV9LCBmYWxsaW5nIGJhY2sgdG8gRW5nbGlzaGApO1xuICAgICAgY29uc3QgbW9kdWxlID0gYXdhaXQgaW1wb3J0KCcuL2xvY2FsZXMvZW4vaW5kZXgudHMnKTtcbiAgICAgIHNldFRyYW5zbGF0aW9ucyhtb2R1bGUuZGVmYXVsdCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBEZWVwIGtleSBhY2Nlc3Mgd2l0aCBkb3Qgbm90YXRpb25cbiAgY29uc3QgdCA9IChrZXk6IHN0cmluZywgcGFyYW1zPzogUmVjb3JkPHN0cmluZywgYW55PikgPT4ge1xuICAgIGNvbnN0IGtleXMgPSBrZXkuc3BsaXQoJy4nKTtcbiAgICBsZXQgdmFsdWU6IGFueSA9IHRyYW5zbGF0aW9ucygpO1xuICAgIFxuICAgIGZvciAoY29uc3QgayBvZiBrZXlzKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlPy5ba107XG4gICAgfVxuICAgIFxuICAgIC8vIEhhbmRsZSBwYXJhbWV0ZXIgcmVwbGFjZW1lbnRcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiBwYXJhbXMpIHtcbiAgICAgIHJldHVybiB2YWx1ZS5yZXBsYWNlKC9cXHtcXHsoXFx3KylcXH1cXH0vZywgKF8sIGspID0+IFN0cmluZyhwYXJhbXNba10gfHwgJycpKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHZhbHVlIHx8IGtleTtcbiAgfTtcblxuICAvLyBEaXJlY3Rpb24gKGZvciBSVEwgbGFuZ3VhZ2VzIGluIGZ1dHVyZSlcbiAgY29uc3QgZGlyID0gKCk6ICdsdHInIHwgJ3J0bCcgPT4gJ2x0cic7IC8vIE9ubHkgTFRSIGxhbmd1YWdlcyBzdXBwb3J0ZWQgY3VycmVudGx5XG5cbiAgLy8gTnVtYmVyIGZvcm1hdHRpbmdcbiAgY29uc3QgbnVtYmVyRm9ybWF0dGVyID0gY3JlYXRlTWVtbygoKSA9PiBcbiAgICBuZXcgSW50bC5OdW1iZXJGb3JtYXQobG9jYWxlKCkpXG4gICk7XG5cbiAgY29uc3QgZm9ybWF0TnVtYmVyID0gKG51bTogbnVtYmVyKSA9PiBudW1iZXJGb3JtYXR0ZXIoKS5mb3JtYXQobnVtKTtcblxuICAvLyBEYXRlIGZvcm1hdHRpbmdcbiAgY29uc3QgZm9ybWF0RGF0ZSA9IChkYXRlOiBEYXRlLCBvcHRpb25zPzogSW50bC5EYXRlVGltZUZvcm1hdE9wdGlvbnMpID0+IHtcbiAgICByZXR1cm4gbmV3IEludGwuRGF0ZVRpbWVGb3JtYXQobG9jYWxlKCksIG9wdGlvbnMpLmZvcm1hdChkYXRlKTtcbiAgfTtcblxuICBjb25zdCB2YWx1ZTogSTE4bkNvbnRleHRWYWx1ZSA9IHtcbiAgICBsb2NhbGUsXG4gICAgc2V0TG9jYWxlLFxuICAgIHQsXG4gICAgZGlyLFxuICAgIGZvcm1hdE51bWJlcixcbiAgICBmb3JtYXREYXRlLFxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPEkxOG5Db250ZXh0LlByb3ZpZGVyIHZhbHVlPXt2YWx1ZX0+XG4gICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgPC9JMThuQ29udGV4dC5Qcm92aWRlcj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCB1c2VJMThuID0gKCkgPT4ge1xuICBjb25zdCBjb250ZXh0ID0gdXNlQ29udGV4dChJMThuQ29udGV4dCk7XG4gIGlmICghY29udGV4dCkge1xuICAgIHRocm93IG5ldyBFcnJvcigndXNlSTE4biBtdXN0IGJlIHVzZWQgd2l0aGluIEkxOG5Qcm92aWRlcicpO1xuICB9XG4gIHJldHVybiBjb250ZXh0O1xufTsiLCJpbXBvcnQgeyBTaG93LCBjcmVhdGVNZW1vIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB0eXBlIHsgUGxheWJhY2tTcGVlZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vQnV0dG9uJztcbmltcG9ydCB7IHVzZUkxOG4gfSBmcm9tICcuLi8uLi8uLi9pMThuJztcblxuZXhwb3J0IGludGVyZmFjZSBDb21wbGV0aW9uVmlld1Byb3BzIHtcbiAgc2NvcmU6IG51bWJlcjtcbiAgcmFuazogbnVtYmVyO1xuICBzcGVlZDogUGxheWJhY2tTcGVlZDtcbiAgZmVlZGJhY2tUZXh0Pzogc3RyaW5nO1xuICBvblByYWN0aWNlPzogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBDb21wbGV0aW9uVmlldzogQ29tcG9uZW50PENvbXBsZXRpb25WaWV3UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHsgdCwgZm9ybWF0TnVtYmVyIH0gPSB1c2VJMThuKCk7XG4gIFxuICAvLyBHZXQgZmVlZGJhY2sgdGV4dCBiYXNlZCBvbiBzY29yZVxuICBjb25zdCBnZXRGZWVkYmFja1RleHQgPSBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBpZiAocHJvcHMuZmVlZGJhY2tUZXh0KSByZXR1cm4gcHJvcHMuZmVlZGJhY2tUZXh0O1xuICAgIFxuICAgIGlmIChwcm9wcy5zY29yZSA+PSA5NSkgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5wZXJmZWN0Jyk7XG4gICAgaWYgKHByb3BzLnNjb3JlID49IDg1KSByZXR1cm4gdCgna2FyYW9rZS5zY29yaW5nLmV4Y2VsbGVudCcpO1xuICAgIGlmIChwcm9wcy5zY29yZSA+PSA3MCkgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5ncmVhdCcpO1xuICAgIGlmIChwcm9wcy5zY29yZSA+PSA1MCkgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5nb29kJyk7XG4gICAgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5rZWVwUHJhY3RpY2luZycpO1xuICB9KTtcbiAgXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgaC1mdWxsIGJnLWJhc2UnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgey8qIE1haW4gY29udGVudCBhcmVhICovfVxuICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLTZcIj5cbiAgICAgICAgey8qIFNjb3JlICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgZmxleCBmbGV4LWNvbCBtYi0xMFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5IG1iLTMgb3JkZXItMVwiPnt0KCdrYXJhb2tlLnNjb3Jpbmcuc2NvcmUnKX08L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC03eGwgZm9udC1tb25vIGZvbnQtYm9sZCB0ZXh0LWFjY2VudC1wcmltYXJ5IG9yZGVyLTJcIj5cbiAgICAgICAgICAgIHtmb3JtYXROdW1iZXIocHJvcHMuc2NvcmUpfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgXG4gICAgICAgIHsvKiBTdGF0cyByb3cgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGdhcC0xMiBtYi0xMlwiPlxuICAgICAgICAgIHsvKiBSYW5rICovfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0yIG9yZGVyLTFcIj5SYW5rPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0zeGwgZm9udC1ib2xkIHRleHQtcHJpbWFyeSBvcmRlci0yXCI+I3tmb3JtYXROdW1iZXIocHJvcHMucmFuayl9PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgXG4gICAgICAgICAgey8qIFNwZWVkICovfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0yIG9yZGVyLTFcIj57dCgnY29tbW9uLnNwZWVkLmxhYmVsJyl9PC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0zeGwgZm9udC1ib2xkIHRleHQtcHJpbWFyeSBvcmRlci0yXCI+e3Byb3BzLnNwZWVkfTwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgXG4gICAgICAgIHsvKiBGZWVkYmFjayB0ZXh0ICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwibWF4LXctbWQgdGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICA8cCBjbGFzcz1cInRleHQteGwgdGV4dC1wcmltYXJ5IGxlYWRpbmctcmVsYXhlZFwiPlxuICAgICAgICAgICAge2dldEZlZWRiYWNrVGV4dCgpfVxuICAgICAgICAgIDwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgey8qIEZvb3RlciB3aXRoIHByYWN0aWNlIGJ1dHRvbiAtIHBvc2l0aW9uZWQgYXQgYm90dG9tIG9mIHdpZGdldCAqL31cbiAgICAgIDxTaG93IHdoZW49e3Byb3BzLm9uUHJhY3RpY2V9PlxuICAgICAgICA8ZGl2IGNsYXNzPVwicC00IGJnLXN1cmZhY2UgYm9yZGVyLXQgYm9yZGVyLXN1YnRsZVwiPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIHZhcmlhbnQ9XCJwcmltYXJ5XCJcbiAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uUHJhY3RpY2V9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgUHJhY3RpY2UgRXJyb3JzXG4gICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIG9uQ2xlYW51cCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQXVkaW9Qcm9jZXNzb3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vdHlwZXMva2FyYW9rZSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVLYXJhb2tlQXVkaW9Qcm9jZXNzb3Iob3B0aW9ucz86IEF1ZGlvUHJvY2Vzc29yT3B0aW9ucykge1xuICBjb25zdCBbYXVkaW9Db250ZXh0LCBzZXRBdWRpb0NvbnRleHRdID0gY3JlYXRlU2lnbmFsPEF1ZGlvQ29udGV4dCB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbbWVkaWFTdHJlYW0sIHNldE1lZGlhU3RyZWFtXSA9IGNyZWF0ZVNpZ25hbDxNZWRpYVN0cmVhbSB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbLCBzZXRBdWRpb1dvcmtsZXROb2RlXSA9IGNyZWF0ZVNpZ25hbDxBdWRpb1dvcmtsZXROb2RlIHwgbnVsbD4obnVsbCk7XG4gIFxuICBjb25zdCBbaXNSZWFkeSwgc2V0SXNSZWFkeV0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IGNyZWF0ZVNpZ25hbDxFcnJvciB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbaXNMaXN0ZW5pbmcsIHNldElzTGlzdGVuaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIFxuICBjb25zdCBbY3VycmVudFJlY29yZGluZ0xpbmUsIHNldEN1cnJlbnRSZWNvcmRpbmdMaW5lXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW3JlY29yZGVkQXVkaW9CdWZmZXIsIHNldFJlY29yZGVkQXVkaW9CdWZmZXJdID0gY3JlYXRlU2lnbmFsPEZsb2F0MzJBcnJheVtdPihbXSk7XG4gIFxuICBjb25zdCBbaXNTZXNzaW9uQWN0aXZlLCBzZXRJc1Nlc3Npb25BY3RpdmVdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2Z1bGxTZXNzaW9uQnVmZmVyLCBzZXRGdWxsU2Vzc2lvbkJ1ZmZlcl0gPSBjcmVhdGVTaWduYWw8RmxvYXQzMkFycmF5W10+KFtdKTtcbiAgXG4gIGNvbnN0IHNhbXBsZVJhdGUgPSBvcHRpb25zPy5zYW1wbGVSYXRlIHx8IDE2MDAwO1xuICBcbiAgY29uc3QgaW5pdGlhbGl6ZSA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoYXVkaW9Db250ZXh0KCkpIHJldHVybjtcbiAgICBzZXRFcnJvcihudWxsKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgXG4gICAgICBjb25zdCBjdHggPSBuZXcgQXVkaW9Db250ZXh0KHsgc2FtcGxlUmF0ZSB9KTtcbiAgICAgIHNldEF1ZGlvQ29udGV4dChjdHgpO1xuICAgICAgXG4gICAgICBjb25zdCBzdHJlYW0gPSBhd2FpdCBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSh7XG4gICAgICAgIGF1ZGlvOiB7XG4gICAgICAgICAgc2FtcGxlUmF0ZSxcbiAgICAgICAgICBjaGFubmVsQ291bnQ6IDEsXG4gICAgICAgICAgZWNob0NhbmNlbGxhdGlvbjogZmFsc2UsXG4gICAgICAgICAgbm9pc2VTdXBwcmVzc2lvbjogZmFsc2UsXG4gICAgICAgICAgYXV0b0dhaW5Db250cm9sOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0TWVkaWFTdHJlYW0oc3RyZWFtKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY3R4LmF1ZGlvV29ya2xldC5hZGRNb2R1bGUoY3JlYXRlQXVkaW9Xb3JrbGV0UHJvY2Vzc29yKCkpO1xuICAgICAgXG4gICAgICBjb25zdCB3b3JrbGV0Tm9kZSA9IG5ldyBBdWRpb1dvcmtsZXROb2RlKGN0eCwgJ2thcmFva2UtYXVkaW8tcHJvY2Vzc29yJywge1xuICAgICAgICBudW1iZXJPZklucHV0czogMSxcbiAgICAgICAgbnVtYmVyT2ZPdXRwdXRzOiAwLFxuICAgICAgICBjaGFubmVsQ291bnQ6IDEsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgd29ya2xldE5vZGUucG9ydC5vbm1lc3NhZ2UgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgaWYgKGV2ZW50LmRhdGEudHlwZSA9PT0gJ2F1ZGlvRGF0YScpIHtcbiAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KGV2ZW50LmRhdGEuYXVkaW9EYXRhKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoY3VycmVudFJlY29yZGluZ0xpbmUoKSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgc2V0UmVjb3JkZWRBdWRpb0J1ZmZlcigocHJldikgPT4gWy4uLnByZXYsIGF1ZGlvRGF0YV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoaXNTZXNzaW9uQWN0aXZlKCkpIHtcbiAgICAgICAgICAgIHNldEZ1bGxTZXNzaW9uQnVmZmVyKChwcmV2KSA9PiBbLi4ucHJldiwgYXVkaW9EYXRhXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgXG4gICAgICBzZXRBdWRpb1dvcmtsZXROb2RlKHdvcmtsZXROb2RlKTtcbiAgICAgIFxuICAgICAgY29uc3Qgc291cmNlID0gY3R4LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG4gICAgICBjb25zdCBnYWluTm9kZSA9IGN0eC5jcmVhdGVHYWluKCk7XG4gICAgICBnYWluTm9kZS5nYWluLnZhbHVlID0gMS4yO1xuICAgICAgXG4gICAgICBzb3VyY2UuY29ubmVjdChnYWluTm9kZSk7XG4gICAgICBnYWluTm9kZS5jb25uZWN0KHdvcmtsZXROb2RlKTtcbiAgICAgIFxuICAgICAgc2V0SXNSZWFkeSh0cnVlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBGYWlsZWQgdG8gaW5pdGlhbGl6ZTonLCBlKTtcbiAgICAgIHNldEVycm9yKGUgaW5zdGFuY2VvZiBFcnJvciA/IGUgOiBuZXcgRXJyb3IoJ1Vua25vd24gYXVkaW8gaW5pdGlhbGl6YXRpb24gZXJyb3InKSk7XG4gICAgICBzZXRJc1JlYWR5KGZhbHNlKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBjcmVhdGVBdWRpb1dvcmtsZXRQcm9jZXNzb3IgPSAoKSA9PiB7XG4gICAgY29uc3QgcHJvY2Vzc29yQ29kZSA9IGBcbiAgICAgIGNsYXNzIEthcmFva2VBdWRpb1Byb2Nlc3NvciBleHRlbmRzIEF1ZGlvV29ya2xldFByb2Nlc3NvciB7XG4gICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgIHN1cGVyKCk7XG4gICAgICAgICAgdGhpcy5idWZmZXJTaXplID0gMTAyNDtcbiAgICAgICAgICB0aGlzLnJtc0hpc3RvcnkgPSBbXTtcbiAgICAgICAgICB0aGlzLm1heEhpc3RvcnlMZW5ndGggPSAxMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3MoaW5wdXRzLCBvdXRwdXRzLCBwYXJhbWV0ZXJzKSB7XG4gICAgICAgICAgY29uc3QgaW5wdXQgPSBpbnB1dHNbMF07XG4gICAgICAgICAgaWYgKGlucHV0ICYmIGlucHV0WzBdKSB7XG4gICAgICAgICAgICBjb25zdCBpbnB1dERhdGEgPSBpbnB1dFswXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHN1bSA9IDA7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0RGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBzdW0gKz0gaW5wdXREYXRhW2ldICogaW5wdXREYXRhW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgcm1zID0gTWF0aC5zcXJ0KHN1bSAvIGlucHV0RGF0YS5sZW5ndGgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLnJtc0hpc3RvcnkucHVzaChybXMpO1xuICAgICAgICAgICAgaWYgKHRoaXMucm1zSGlzdG9yeS5sZW5ndGggPiB0aGlzLm1heEhpc3RvcnlMZW5ndGgpIHtcbiAgICAgICAgICAgICAgdGhpcy5ybXNIaXN0b3J5LnNoaWZ0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGF2Z1JtcyA9IHRoaXMucm1zSGlzdG9yeS5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLCAwKSAvIHRoaXMucm1zSGlzdG9yeS5sZW5ndGg7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMucG9ydC5wb3N0TWVzc2FnZSh7XG4gICAgICAgICAgICAgIHR5cGU6ICdhdWRpb0RhdGEnLFxuICAgICAgICAgICAgICBhdWRpb0RhdGE6IGlucHV0RGF0YSxcbiAgICAgICAgICAgICAgcm1zTGV2ZWw6IHJtcyxcbiAgICAgICAgICAgICAgYXZnUm1zTGV2ZWw6IGF2Z1JtcyxcbiAgICAgICAgICAgICAgaXNUb29RdWlldDogYXZnUm1zIDwgMC4wMSxcbiAgICAgICAgICAgICAgaXNUb29Mb3VkOiBhdmdSbXMgPiAwLjNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmVnaXN0ZXJQcm9jZXNzb3IoJ2thcmFva2UtYXVkaW8tcHJvY2Vzc29yJywgS2FyYW9rZUF1ZGlvUHJvY2Vzc29yKTtcbiAgICBgO1xuICAgIFxuICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbcHJvY2Vzc29yQ29kZV0sIHsgdHlwZTogJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnIH0pO1xuICAgIHJldHVybiBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuICB9O1xuICBcbiAgY29uc3Qgc3RhcnRMaXN0ZW5pbmcgPSAoKSA9PiB7XG4gICAgY29uc3QgY3R4ID0gYXVkaW9Db250ZXh0KCk7XG4gICAgaWYgKGN0eCAmJiBjdHguc3RhdGUgPT09ICdzdXNwZW5kZWQnKSB7XG4gICAgICBjdHgucmVzdW1lKCk7XG4gICAgfVxuICAgIHNldElzTGlzdGVuaW5nKHRydWUpO1xuICB9O1xuICBcbiAgY29uc3QgcGF1c2VMaXN0ZW5pbmcgPSAoKSA9PiB7XG4gICAgY29uc3QgY3R4ID0gYXVkaW9Db250ZXh0KCk7XG4gICAgaWYgKGN0eCAmJiBjdHguc3RhdGUgPT09ICdydW5uaW5nJykge1xuICAgICAgY3R4LnN1c3BlbmQoKTtcbiAgICB9XG4gICAgc2V0SXNMaXN0ZW5pbmcoZmFsc2UpO1xuICB9O1xuICBcbiAgY29uc3QgY2xlYW51cCA9ICgpID0+IHtcbiAgICBcbiAgICBjb25zdCBzdHJlYW0gPSBtZWRpYVN0cmVhbSgpO1xuICAgIGlmIChzdHJlYW0pIHtcbiAgICAgIHN0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKCh0cmFjaykgPT4gdHJhY2suc3RvcCgpKTtcbiAgICAgIHNldE1lZGlhU3RyZWFtKG51bGwpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBjdHggPSBhdWRpb0NvbnRleHQoKTtcbiAgICBpZiAoY3R4ICYmIGN0eC5zdGF0ZSAhPT0gJ2Nsb3NlZCcpIHtcbiAgICAgIGN0eC5jbG9zZSgpO1xuICAgICAgc2V0QXVkaW9Db250ZXh0KG51bGwpO1xuICAgIH1cbiAgICBcbiAgICBzZXRBdWRpb1dvcmtsZXROb2RlKG51bGwpO1xuICAgIHNldElzUmVhZHkoZmFsc2UpO1xuICAgIHNldElzTGlzdGVuaW5nKGZhbHNlKTtcbiAgfTtcbiAgXG4gIG9uQ2xlYW51cChjbGVhbnVwKTtcbiAgXG4gIGNvbnN0IHN0YXJ0UmVjb3JkaW5nTGluZSA9IChsaW5lSW5kZXg6IG51bWJlcikgPT4ge1xuICAgIFxuICAgIHNldEN1cnJlbnRSZWNvcmRpbmdMaW5lKGxpbmVJbmRleCk7XG4gICAgc2V0UmVjb3JkZWRBdWRpb0J1ZmZlcihbXSk7XG4gICAgXG4gICAgaWYgKGlzUmVhZHkoKSAmJiAhaXNMaXN0ZW5pbmcoKSkge1xuICAgICAgc3RhcnRMaXN0ZW5pbmcoKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBzdG9wUmVjb3JkaW5nTGluZUFuZEdldFJhd0F1ZGlvID0gKCk6IEZsb2F0MzJBcnJheVtdID0+IHtcbiAgICBjb25zdCBsaW5lSW5kZXggPSBjdXJyZW50UmVjb3JkaW5nTGluZSgpO1xuICAgIGlmIChsaW5lSW5kZXggPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYXVkaW9CdWZmZXIgPSByZWNvcmRlZEF1ZGlvQnVmZmVyKCk7XG4gICAgXG4gICAgc2V0Q3VycmVudFJlY29yZGluZ0xpbmUobnVsbCk7XG4gICAgXG4gICAgY29uc3QgcmVzdWx0ID0gWy4uLmF1ZGlvQnVmZmVyXTtcbiAgICBzZXRSZWNvcmRlZEF1ZGlvQnVmZmVyKFtdKTtcbiAgICBcbiAgICBpZiAocmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuICBcbiAgY29uc3QgY29udmVydEF1ZGlvVG9XYXZCbG9iID0gKGF1ZGlvQ2h1bmtzOiBGbG9hdDMyQXJyYXlbXSk6IEJsb2IgfCBudWxsID0+IHtcbiAgICBpZiAoYXVkaW9DaHVua3MubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcbiAgICBcbiAgICBjb25zdCB0b3RhbExlbmd0aCA9IGF1ZGlvQ2h1bmtzLnJlZHVjZSgoc3VtLCBjaHVuaykgPT4gc3VtICsgY2h1bmsubGVuZ3RoLCAwKTtcbiAgICBjb25zdCBjb25jYXRlbmF0ZWQgPSBuZXcgRmxvYXQzMkFycmF5KHRvdGFsTGVuZ3RoKTtcbiAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICBmb3IgKGNvbnN0IGNodW5rIG9mIGF1ZGlvQ2h1bmtzKSB7XG4gICAgICBjb25jYXRlbmF0ZWQuc2V0KGNodW5rLCBvZmZzZXQpO1xuICAgICAgb2Zmc2V0ICs9IGNodW5rLmxlbmd0aDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGF1ZGlvQnVmZmVyVG9XYXYoY29uY2F0ZW5hdGVkLCBzYW1wbGVSYXRlKTtcbiAgfTtcbiAgXG4gIGNvbnN0IGF1ZGlvQnVmZmVyVG9XYXYgPSAoYnVmZmVyOiBGbG9hdDMyQXJyYXksIHNhbXBsZVJhdGU6IG51bWJlcik6IEJsb2IgPT4ge1xuICAgIGNvbnN0IGxlbmd0aCA9IGJ1ZmZlci5sZW5ndGg7XG4gICAgY29uc3QgYXJyYXlCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoNDQgKyBsZW5ndGggKiAyKTtcbiAgICBjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGFycmF5QnVmZmVyKTtcbiAgICBcbiAgICBjb25zdCB3cml0ZVN0cmluZyA9IChvZmZzZXQ6IG51bWJlciwgc3RyaW5nOiBzdHJpbmcpID0+IHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyaW5nLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZpZXcuc2V0VWludDgob2Zmc2V0ICsgaSwgc3RyaW5nLmNoYXJDb2RlQXQoaSkpO1xuICAgICAgfVxuICAgIH07XG4gICAgXG4gICAgd3JpdGVTdHJpbmcoMCwgJ1JJRkYnKTtcbiAgICB2aWV3LnNldFVpbnQzMig0LCAzNiArIGxlbmd0aCAqIDIsIHRydWUpO1xuICAgIHdyaXRlU3RyaW5nKDgsICdXQVZFJyk7XG4gICAgd3JpdGVTdHJpbmcoMTIsICdmbXQgJyk7XG4gICAgdmlldy5zZXRVaW50MzIoMTYsIDE2LCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigyMCwgMSwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMjIsIDEsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDMyKDI0LCBzYW1wbGVSYXRlLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQzMigyOCwgc2FtcGxlUmF0ZSAqIDIsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDMyLCAyLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigzNCwgMTYsIHRydWUpO1xuICAgIHdyaXRlU3RyaW5nKDM2LCAnZGF0YScpO1xuICAgIHZpZXcuc2V0VWludDMyKDQwLCBsZW5ndGggKiAyLCB0cnVlKTtcbiAgICBcbiAgICBjb25zdCBvZmZzZXQgPSA0NDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBzYW1wbGUgPSBNYXRoLm1heCgtMSwgTWF0aC5taW4oMSwgYnVmZmVyW2ldIHx8IDApKTtcbiAgICAgIHZpZXcuc2V0SW50MTYob2Zmc2V0ICsgaSAqIDIsIHNhbXBsZSAqIDB4N2ZmZiwgdHJ1ZSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBuZXcgQmxvYihbYXJyYXlCdWZmZXJdLCB7IHR5cGU6ICdhdWRpby93YXYnIH0pO1xuICB9O1xuICBcbiAgY29uc3Qgc3RhcnRGdWxsU2Vzc2lvbiA9ICgpID0+IHtcbiAgICBzZXRGdWxsU2Vzc2lvbkJ1ZmZlcihbXSk7XG4gICAgc2V0SXNTZXNzaW9uQWN0aXZlKHRydWUpO1xuICB9O1xuICBcbiAgY29uc3Qgc3RvcEZ1bGxTZXNzaW9uQW5kR2V0V2F2ID0gKCk6IEJsb2IgfCBudWxsID0+IHtcbiAgICBzZXRJc1Nlc3Npb25BY3RpdmUoZmFsc2UpO1xuICAgIFxuICAgIGNvbnN0IHNlc3Npb25DaHVua3MgPSBmdWxsU2Vzc2lvbkJ1ZmZlcigpO1xuICAgIGNvbnN0IHdhdkJsb2IgPSBjb252ZXJ0QXVkaW9Ub1dhdkJsb2Ioc2Vzc2lvbkNodW5rcyk7XG4gICAgXG4gICAgXG4gICAgc2V0RnVsbFNlc3Npb25CdWZmZXIoW10pO1xuICAgIFxuICAgIHJldHVybiB3YXZCbG9iO1xuICB9O1xuICBcbiAgcmV0dXJuIHtcbiAgICBpc1JlYWR5LFxuICAgIGVycm9yLFxuICAgIGlzTGlzdGVuaW5nLFxuICAgIGlzU2Vzc2lvbkFjdGl2ZSxcbiAgICBcbiAgICBpbml0aWFsaXplLFxuICAgIHN0YXJ0TGlzdGVuaW5nLFxuICAgIHBhdXNlTGlzdGVuaW5nLFxuICAgIGNsZWFudXAsXG4gICAgc3RhcnRSZWNvcmRpbmdMaW5lLFxuICAgIHN0b3BSZWNvcmRpbmdMaW5lQW5kR2V0UmF3QXVkaW8sXG4gICAgY29udmVydEF1ZGlvVG9XYXZCbG9iLFxuICAgIFxuICAgIHN0YXJ0RnVsbFNlc3Npb24sXG4gICAgc3RvcEZ1bGxTZXNzaW9uQW5kR2V0V2F2LFxuICB9O1xufSIsImltcG9ydCB0eXBlIHsgS2FyYW9rZURhdGEsIEthcmFva2VTZXNzaW9uLCBMaW5lU2NvcmUsIFNlc3Npb25SZXN1bHRzIH0gZnJvbSAnLi4vLi4vdHlwZXMva2FyYW9rZSc7XG5cbmV4cG9ydCBjbGFzcyBLYXJhb2tlQXBpU2VydmljZSB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgc2VydmVyVXJsOiBzdHJpbmcgPSBpbXBvcnQubWV0YS5lbnYuVklURV9BUElfVVJMIHx8ICdodHRwOi8vbG9jYWxob3N0Ojg3ODcnKSB7fVxuXG4gIGFzeW5jIGZldGNoS2FyYW9rZURhdGEoXG4gICAgdHJhY2tJZDogc3RyaW5nLFxuICAgIHRpdGxlPzogc3RyaW5nLFxuICAgIGFydGlzdD86IHN0cmluZ1xuICApOiBQcm9taXNlPEthcmFva2VEYXRhIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB1cmwgPSBuZXcgVVJMKGAke3RoaXMuc2VydmVyVXJsfS9hcGkva2FyYW9rZS8ke3RyYWNrSWR9YCk7XG4gICAgICBpZiAodGl0bGUpIHVybC5zZWFyY2hQYXJhbXMuc2V0KCd0aXRsZScsIHRpdGxlKTtcbiAgICAgIGlmIChhcnRpc3QpIHVybC5zZWFyY2hQYXJhbXMuc2V0KCdhcnRpc3QnLCBhcnRpc3QpO1xuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybC50b1N0cmluZygpKTtcbiAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICByZXR1cm4gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZmV0Y2gga2FyYW9rZSBkYXRhOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHN0YXJ0U2Vzc2lvbihcbiAgICB0cmFja0lkOiBzdHJpbmcsXG4gICAgc29uZ0RhdGE6IHsgdGl0bGU6IHN0cmluZzsgYXJ0aXN0OiBzdHJpbmc7IGdlbml1c0lkPzogc3RyaW5nOyBkdXJhdGlvbj86IG51bWJlcjsgZGlmZmljdWx0eT86IHN0cmluZyB9LFxuICAgIGF1dGhUb2tlbj86IHN0cmluZyxcbiAgICBzb25nQ2F0YWxvZ0lkPzogc3RyaW5nLFxuICAgIHBsYXliYWNrU3BlZWQ/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxLYXJhb2tlU2Vzc2lvbiB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgaGVhZGVyczogSGVhZGVyc0luaXQgPSB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICB9O1xuICAgICAgXG4gICAgICBpZiAoYXV0aFRva2VuKSB7XG4gICAgICAgIGhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9IGBCZWFyZXIgJHthdXRoVG9rZW59YDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHt0aGlzLnNlcnZlclVybH0va2FyYW9rZS9zdGFydGAsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnMsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICB0cmFja0lkLFxuICAgICAgICAgIHNvbmdEYXRhLFxuICAgICAgICAgIHNvbmdDYXRhbG9nSWQsXG4gICAgICAgICAgcGxheWJhY2tTcGVlZCxcbiAgICAgICAgfSksXG4gICAgICB9KTtcblxuICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIHJldHVybiBkYXRhLnNlc3Npb247XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gc3RhcnQgc2Vzc2lvbjonLCByZXNwb25zZS5zdGF0dXMsIGF3YWl0IHJlc3BvbnNlLnRleHQoKSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBzdGFydCBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdyYWRlUmVjb3JkaW5nKFxuICAgIHNlc3Npb25JZDogc3RyaW5nLFxuICAgIGxpbmVJbmRleDogbnVtYmVyLFxuICAgIGF1ZGlvQnVmZmVyOiBzdHJpbmcsXG4gICAgZXhwZWN0ZWRUZXh0OiBzdHJpbmcsXG4gICAgc3RhcnRUaW1lOiBudW1iZXIsXG4gICAgZW5kVGltZTogbnVtYmVyLFxuICAgIGF1dGhUb2tlbj86IHN0cmluZyxcbiAgICBwbGF5YmFja1NwZWVkPzogc3RyaW5nXG4gICk6IFByb21pc2U8TGluZVNjb3JlIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBoZWFkZXJzOiBIZWFkZXJzSW5pdCA9IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGlmIChhdXRoVG9rZW4pIHtcbiAgICAgICAgaGVhZGVyc1snQXV0aG9yaXphdGlvbiddID0gYEJlYXJlciAke2F1dGhUb2tlbn1gO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuc2VydmVyVXJsfS9rYXJhb2tlL2dyYWRlYCwge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVycyxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHNlc3Npb25JZCxcbiAgICAgICAgICBsaW5lSW5kZXgsXG4gICAgICAgICAgYXVkaW9CdWZmZXIsXG4gICAgICAgICAgZXhwZWN0ZWRUZXh0LFxuICAgICAgICAgIHN0YXJ0VGltZSxcbiAgICAgICAgICBlbmRUaW1lLFxuICAgICAgICAgIHBsYXliYWNrU3BlZWQsXG4gICAgICAgIH0pLFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc2NvcmU6IE1hdGgucm91bmQocmVzdWx0LnNjb3JlKSxcbiAgICAgICAgICBmZWVkYmFjazogcmVzdWx0LmZlZWRiYWNrLFxuICAgICAgICAgIHRyYW5zY3JpcHQ6IHJlc3VsdC50cmFuc2NyaXB0aW9uLFxuICAgICAgICAgIHdvcmRTY29yZXM6IHJlc3VsdC53b3JkU2NvcmVzLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZ3JhZGUgcmVjb3JkaW5nOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGNvbXBsZXRlU2Vzc2lvbihcbiAgICBzZXNzaW9uSWQ6IHN0cmluZyxcbiAgICBmdWxsQXVkaW9CdWZmZXI/OiBzdHJpbmcsXG4gICAgYXV0aFRva2VuPzogc3RyaW5nXG4gICk6IFByb21pc2U8U2Vzc2lvblJlc3VsdHMgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGhlYWRlcnM6IEhlYWRlcnNJbml0ID0ge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgfTtcbiAgICAgIFxuICAgICAgaWYgKGF1dGhUb2tlbikge1xuICAgICAgICBoZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSBgQmVhcmVyICR7YXV0aFRva2VufWA7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7dGhpcy5zZXJ2ZXJVcmx9L2thcmFva2UvY29tcGxldGVgLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgc2Vzc2lvbklkLFxuICAgICAgICAgIGZ1bGxBdWRpb0J1ZmZlcixcbiAgICAgICAgfSksXG4gICAgICB9KTtcblxuICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiByZXN1bHQuc3VjY2VzcyxcbiAgICAgICAgICBmaW5hbFNjb3JlOiByZXN1bHQuZmluYWxTY29yZSxcbiAgICAgICAgICB0b3RhbExpbmVzOiByZXN1bHQudG90YWxMaW5lcyxcbiAgICAgICAgICBwZXJmZWN0TGluZXM6IHJlc3VsdC5wZXJmZWN0TGluZXMsXG4gICAgICAgICAgZ29vZExpbmVzOiByZXN1bHQuZ29vZExpbmVzLFxuICAgICAgICAgIG5lZWRzV29ya0xpbmVzOiByZXN1bHQubmVlZHNXb3JrTGluZXMsXG4gICAgICAgICAgYWNjdXJhY3k6IHJlc3VsdC5hY2N1cmFjeSxcbiAgICAgICAgICBzZXNzaW9uSWQ6IHJlc3VsdC5zZXNzaW9uSWQsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBjb21wbGV0ZSBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldFVzZXJCZXN0U2NvcmUoc29uZ0lkOiBzdHJpbmcsIGF1dGhUb2tlbjogc3RyaW5nKTogUHJvbWlzZTxudW1iZXIgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXG4gICAgICAgIGAke3RoaXMuc2VydmVyVXJsfS91c2Vycy9tZS9zb25ncy8ke3NvbmdJZH0vYmVzdC1zY29yZWAsXG4gICAgICAgIHtcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHthdXRoVG9rZW59YCxcbiAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIHJldHVybiBkYXRhLmJlc3RTY29yZSB8fCBudWxsO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGZldGNoIGJlc3Qgc2NvcmUnKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBmZXRjaCB1c2VyIGJlc3Qgc2NvcmU6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ2V0U29uZ0xlYWRlcmJvYXJkKHNvbmdJZDogc3RyaW5nLCBsaW1pdDogbnVtYmVyID0gMTApOiBQcm9taXNlPGFueVtdPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXG4gICAgICAgIGAke3RoaXMuc2VydmVyVXJsfS9zb25ncy8ke3NvbmdJZH0vbGVhZGVyYm9hcmQ/bGltaXQ9JHtsaW1pdH1gXG4gICAgICApO1xuXG4gICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgcmV0dXJuIGRhdGEuZW50cmllcyB8fCBbXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBbXTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBmZXRjaCBsZWFkZXJib2FyZDonLCBlcnJvcik7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICB9XG59IiwiaW1wb3J0IHR5cGUgeyBDaHVua0luZm8gfSBmcm9tICcuLi8uLi90eXBlcy9rYXJhb2tlJztcbmltcG9ydCB0eXBlIHsgTHlyaWNMaW5lIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9rYXJhb2tlL0x5cmljc0Rpc3BsYXknO1xuXG5leHBvcnQgZnVuY3Rpb24gY291bnRXb3Jkcyh0ZXh0OiBzdHJpbmcpOiBudW1iZXIge1xuICBpZiAoIXRleHQpIHJldHVybiAwO1xuICByZXR1cm4gdGV4dFxuICAgIC50cmltKClcbiAgICAuc3BsaXQoL1xccysvKVxuICAgIC5maWx0ZXIoKHdvcmQpID0+IHdvcmQubGVuZ3RoID4gMCkubGVuZ3RoO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkQ2h1bmtMaW5lcyhcbiAgbGluZXM6IEx5cmljTGluZVtdLFxuICBzdGFydEluZGV4OiBudW1iZXJcbik6IENodW5rSW5mbyB7XG4gIC8vIFByb2Nlc3MgaW5kaXZpZHVhbCBsaW5lcyBpbnN0ZWFkIG9mIGdyb3VwaW5nXG4gIGNvbnN0IGxpbmUgPSBsaW5lc1tzdGFydEluZGV4XTtcbiAgaWYgKCFsaW5lKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXJ0SW5kZXgsXG4gICAgICBlbmRJbmRleDogc3RhcnRJbmRleCxcbiAgICAgIGV4cGVjdGVkVGV4dDogJycsXG4gICAgICB3b3JkQ291bnQ6IDAsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHdvcmRDb3VudCA9IGNvdW50V29yZHMobGluZS50ZXh0IHx8ICcnKTtcbiAgXG4gIHJldHVybiB7XG4gICAgc3RhcnRJbmRleCxcbiAgICBlbmRJbmRleDogc3RhcnRJbmRleCwgLy8gU2luZ2xlIGxpbmUsIHNvIHN0YXJ0IGFuZCBlbmQgYXJlIHRoZSBzYW1lXG4gICAgZXhwZWN0ZWRUZXh0OiBsaW5lLnRleHQgfHwgJycsXG4gICAgd29yZENvdW50LFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2FsY3VsYXRlUmVjb3JkaW5nRHVyYXRpb24oXG4gIGxpbmVzOiBMeXJpY0xpbmVbXSxcbiAgY2h1bmtJbmZvOiBDaHVua0luZm9cbik6IG51bWJlciB7XG4gIGNvbnN0IHsgc3RhcnRJbmRleCwgZW5kSW5kZXggfSA9IGNodW5rSW5mbztcbiAgY29uc3QgbGluZSA9IGxpbmVzW3N0YXJ0SW5kZXhdO1xuICBcbiAgaWYgKCFsaW5lKSByZXR1cm4gMzAwMDtcblxuICBpZiAoZW5kSW5kZXggPiBzdGFydEluZGV4KSB7XG4gICAgaWYgKGVuZEluZGV4ICsgMSA8IGxpbmVzLmxlbmd0aCkge1xuICAgICAgY29uc3QgbmV4dExpbmUgPSBsaW5lc1tlbmRJbmRleCArIDFdO1xuICAgICAgaWYgKG5leHRMaW5lKSB7XG4gICAgICAgIC8vIENvbnZlcnQgc2Vjb25kcyB0byBtaWxsaXNlY29uZHNcbiAgICAgICAgcmV0dXJuIChuZXh0TGluZS5zdGFydFRpbWUgLSBsaW5lLnN0YXJ0VGltZSkgKiAxMDAwO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBsZXQgZHVyYXRpb24gPSAwO1xuICAgIGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDw9IGVuZEluZGV4OyBpKyspIHtcbiAgICAgIC8vIGR1cmF0aW9uIGlzIGFscmVhZHkgaW4gbWlsbGlzZWNvbmRzXG4gICAgICBkdXJhdGlvbiArPSBsaW5lc1tpXT8uZHVyYXRpb24gfHwgMzAwMDtcbiAgICB9XG4gICAgcmV0dXJuIE1hdGgubWluKGR1cmF0aW9uLCA4MDAwKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoc3RhcnRJbmRleCArIDEgPCBsaW5lcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IG5leHRMaW5lID0gbGluZXNbc3RhcnRJbmRleCArIDFdO1xuICAgICAgaWYgKG5leHRMaW5lKSB7XG4gICAgICAgIC8vIENvbnZlcnQgc2Vjb25kcyB0byBtaWxsaXNlY29uZHNcbiAgICAgICAgY29uc3QgY2FsY3VsYXRlZER1cmF0aW9uID0gKG5leHRMaW5lLnN0YXJ0VGltZSAtIGxpbmUuc3RhcnRUaW1lKSAqIDEwMDA7XG4gICAgICAgIHJldHVybiBNYXRoLm1pbihNYXRoLm1heChjYWxjdWxhdGVkRHVyYXRpb24sIDEwMDApLCA1MDAwKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIE1hdGgubWluKGxpbmUuZHVyYXRpb24gfHwgMzAwMCwgNTAwMCk7XG4gIH1cbn0iLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByb2dyZXNzQmFyUHJvcHMge1xuICBjdXJyZW50OiBudW1iZXI7XG4gIHRvdGFsOiBudW1iZXI7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgUHJvZ3Jlc3NCYXI6IENvbXBvbmVudDxQcm9ncmVzc0JhclByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBwZXJjZW50YWdlID0gKCkgPT4gTWF0aC5taW4oMTAwLCBNYXRoLm1heCgwLCAocHJvcHMuY3VycmVudCAvIHByb3BzLnRvdGFsKSAqIDEwMCkpO1xuICBcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbigndy1mdWxsIGgtMS41IGJnLWhpZ2hsaWdodCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzPVwiaC1mdWxsIGJnLWFjY2VudCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAgZWFzZS1vdXQgcm91bmRlZC1yLXNtXCJcbiAgICAgICAgc3R5bGU9e3sgd2lkdGg6IGAke3BlcmNlbnRhZ2UoKX0lYCB9fVxuICAgICAgLz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWluaW1pemVkS2FyYW9rZVByb3BzIHtcbiAgb25DbGljazogKCkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IE1pbmltaXplZEthcmFva2U6IENvbXBvbmVudDxNaW5pbWl6ZWRLYXJhb2tlUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGJ1dHRvblxuICAgICAgb25DbGljaz17cHJvcHMub25DbGlja31cbiAgICAgIHN0eWxlPXt7XG4gICAgICAgIHBvc2l0aW9uOiAnZml4ZWQnLFxuICAgICAgICBib3R0b206ICcyNHB4JyxcbiAgICAgICAgcmlnaHQ6ICcyNHB4JyxcbiAgICAgICAgd2lkdGg6ICc4MHB4JyxcbiAgICAgICAgaGVpZ2h0OiAnODBweCcsXG4gICAgICAgICdib3JkZXItcmFkaXVzJzogJzUwJScsXG4gICAgICAgIGJhY2tncm91bmQ6ICdsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCAjRkYwMDZFIDAlLCAjQzEzNTg0IDEwMCUpJyxcbiAgICAgICAgJ2JveC1zaGFkb3cnOiAnMCA4cHggMzJweCByZ2JhKDAsIDAsIDAsIDAuMyknLFxuICAgICAgICBkaXNwbGF5OiAnZmxleCcsXG4gICAgICAgICdhbGlnbi1pdGVtcyc6ICdjZW50ZXInLFxuICAgICAgICAnanVzdGlmeS1jb250ZW50JzogJ2NlbnRlcicsXG4gICAgICAgIG92ZXJmbG93OiAnaGlkZGVuJyxcbiAgICAgICAgY3Vyc29yOiAncG9pbnRlcicsXG4gICAgICAgICd6LWluZGV4JzogJzk5OTk5JyxcbiAgICAgICAgYm9yZGVyOiAnbm9uZScsXG4gICAgICAgIHRyYW5zaXRpb246ICd0cmFuc2Zvcm0gMC4ycyBlYXNlJyxcbiAgICAgIH19XG4gICAgICBvbk1vdXNlRW50ZXI9eyhlKSA9PiB7XG4gICAgICAgIGUuY3VycmVudFRhcmdldC5zdHlsZS50cmFuc2Zvcm0gPSAnc2NhbGUoMS4xKSc7XG4gICAgICB9fVxuICAgICAgb25Nb3VzZUxlYXZlPXsoZSkgPT4ge1xuICAgICAgICBlLmN1cnJlbnRUYXJnZXQuc3R5bGUudHJhbnNmb3JtID0gJ3NjYWxlKDEpJztcbiAgICAgIH19XG4gICAgICBhcmlhLWxhYmVsPVwiT3BlbiBLYXJhb2tlXCJcbiAgICA+XG4gICAgICB7LyogUGxhY2UgeW91ciAyMDB4MjAwIGltYWdlIGhlcmUgYXM6ICovfVxuICAgICAgey8qIDxpbWcgc3JjPVwiL3BhdGgvdG8veW91ci9pbWFnZS5wbmdcIiBhbHQ9XCJLYXJhb2tlXCIgc3R5bGU9XCJ3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDAlOyBvYmplY3QtZml0OiBjb3ZlcjtcIiAvPiAqL31cbiAgICAgIFxuICAgICAgey8qIEZvciBub3csIHVzaW5nIGEgcGxhY2Vob2xkZXIgaWNvbiAqL31cbiAgICAgIDxzcGFuIHN0eWxlPXt7ICdmb250LXNpemUnOiAnMzZweCcgfX0+8J+OpDwvc3Bhbj5cbiAgICA8L2J1dHRvbj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IEljb25YUmVndWxhciBmcm9tICdwaG9zcGhvci1pY29ucy1zb2xpZC9JY29uWFJlZ3VsYXInO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJhY3RpY2VIZWFkZXJQcm9wcyB7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBvbkV4aXQ6ICgpID0+IHZvaWQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgUHJhY3RpY2VIZWFkZXI6IENvbXBvbmVudDxQcmFjdGljZUhlYWRlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxTaG93IHdoZW49e3Byb3BzLnRpdGxlfT5cbiAgICAgIDxoZWFkZXIgY2xhc3M9e2NuKCdmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBoLTE0IHB4LTQgYmctdHJhbnNwYXJlbnQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgICA8aDEgY2xhc3M9XCJ0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgdGV4dC1wcmltYXJ5XCI+XG4gICAgICAgICAge3Byb3BzLnRpdGxlfVxuICAgICAgICA8L2gxPlxuICAgICAgPC9oZWFkZXI+XG4gICAgPC9TaG93PlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vQnV0dG9uJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4ZXJjaXNlRm9vdGVyUHJvcHMge1xuICBpc1JlY29yZGluZz86IGJvb2xlYW47XG4gIGlzUHJvY2Vzc2luZz86IGJvb2xlYW47XG4gIGNhblN1Ym1pdD86IGJvb2xlYW47XG4gIG9uUmVjb3JkPzogKCkgPT4gdm9pZDtcbiAgb25TdG9wPzogKCkgPT4gdm9pZDtcbiAgb25TdWJtaXQ/OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEV4ZXJjaXNlRm9vdGVyOiBDb21wb25lbnQ8RXhlcmNpc2VGb290ZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8Zm9vdGVyIGNsYXNzPXtjbignYm9yZGVyLXQgYm9yZGVyLWdyYXktNzAwIGJnLXN1cmZhY2UgcC02JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy0yeGwgbXgtYXV0b1wiPlxuICAgICAgICA8U2hvd1xuICAgICAgICAgIHdoZW49eyFwcm9wcy5pc1JlY29yZGluZ31cbiAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgIHZhcmlhbnQ9XCJwcmltYXJ5XCJcbiAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgZnVsbFdpZHRoXG4gICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uU3RvcH1cbiAgICAgICAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmlzUHJvY2Vzc2luZ31cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgU3RvcFxuICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgfVxuICAgICAgICA+XG4gICAgICAgICAgPFNob3dcbiAgICAgICAgICAgIHdoZW49e3Byb3BzLmNhblN1Ym1pdH1cbiAgICAgICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJwcmltYXJ5XCJcbiAgICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICAgIGZ1bGxXaWR0aFxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uUmVjb3JkfVxuICAgICAgICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5pc1Byb2Nlc3Npbmd9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICBSZWNvcmRcbiAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICB9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgIGZ1bGxXaWR0aFxuICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblN1Ym1pdH1cbiAgICAgICAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmlzUHJvY2Vzc2luZ31cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAge3Byb3BzLmlzUHJvY2Vzc2luZyA/ICdQcm9jZXNzaW5nLi4uJyA6ICdTdWJtaXQnfVxuICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgPC9TaG93PlxuICAgICAgICA8L1Nob3c+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Zvb3Rlcj5cbiAgKTtcbn07IiwiZXhwb3J0IGRlZmF1bHQgKHApID0+ICg8c3ZnIGNsYXNzPXtwLmNsYXNzfSBkYXRhLXBob3NwaG9yLWljb249XCJjaGVjay1jaXJjbGVcIiBhcmlhLWhpZGRlbj1cInRydWVcIiB3aWR0aD1cIjFlbVwiIGhlaWdodD1cIjFlbVwiIHBvaW50ZXItZXZlbnRzPVwibm9uZVwiIGRpc3BsYXk9XCJpbmxpbmUtYmxvY2tcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgZmlsbD1cImN1cnJlbnRDb2xvclwiIHZpZXdCb3g9XCIwIDAgMjU2IDI1NlwiPjxwYXRoIGQ9XCJNMTI4IDI0YTEwNCAxMDQgMCAxIDAgMTA0IDEwNEExMDQuMTEgMTA0LjExIDAgMCAwIDEyOCAyNG00NS42NiA4NS42Ni01NiA1NmE4IDggMCAwIDEtMTEuMzIgMGwtMjQtMjRhOCA4IDAgMCAxIDExLjMyLTExLjMyTDExMiAxNDguNjlsNTAuMzQtNTAuMzVhOCA4IDAgMCAxIDExLjMyIDExLjMyXCIvPjwvc3ZnPik7XG4iLCJleHBvcnQgZGVmYXVsdCAocCkgPT4gKDxzdmcgY2xhc3M9e3AuY2xhc3N9IGRhdGEtcGhvc3Bob3ItaWNvbj1cIngtY2lyY2xlXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCIgd2lkdGg9XCIxZW1cIiBoZWlnaHQ9XCIxZW1cIiBwb2ludGVyLWV2ZW50cz1cIm5vbmVcIiBkaXNwbGF5PVwiaW5saW5lLWJsb2NrXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiB2aWV3Qm94PVwiMCAwIDI1NiAyNTZcIj48cGF0aCBkPVwiTTEyOCAyNGExMDQgMTA0IDAgMSAwIDEwNCAxMDRBMTA0LjExIDEwNC4xMSAwIDAgMCAxMjggMjRtMzcuNjYgMTMwLjM0YTggOCAwIDAgMS0xMS4zMiAxMS4zMkwxMjggMTM5LjMxbC0yNi4zNCAyNi4zNWE4IDggMCAwIDEtMTEuMzItMTEuMzJMMTE2LjY5IDEyOGwtMjYuMzUtMjYuMzRhOCA4IDAgMCAxIDExLjMyLTExLjMyTDEyOCAxMTYuNjlsMjYuMzQtMjYuMzVhOCA4IDAgMCAxIDExLjMyIDExLjMyTDEzOS4zMSAxMjhaXCIvPjwvc3ZnPik7XG4iLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vQnV0dG9uJztcbmltcG9ydCBJY29uQ2hlY2tDaXJjbGVGaWxsIGZyb20gJ3Bob3NwaG9yLWljb25zLXNvbGlkL0ljb25DaGVja0NpcmNsZUZpbGwnO1xuaW1wb3J0IEljb25YQ2lyY2xlRmlsbCBmcm9tICdwaG9zcGhvci1pY29ucy1zb2xpZC9JY29uWENpcmNsZUZpbGwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlc3BvbnNlRm9vdGVyUHJvcHMge1xuICBtb2RlOiAnY2hlY2snIHwgJ2ZlZWRiYWNrJztcbiAgaXNDb3JyZWN0PzogYm9vbGVhbjtcbiAgZmVlZGJhY2tUZXh0Pzogc3RyaW5nO1xuICBjb250aW51ZUxhYmVsPzogc3RyaW5nO1xuICBvbkNoZWNrPzogKCkgPT4gdm9pZDtcbiAgb25Db250aW51ZT86ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBSZXNwb25zZUZvb3RlcjogQ29tcG9uZW50PFJlc3BvbnNlRm9vdGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz1cImJvcmRlci10IGJvcmRlci1ncmF5LTcwMCBiZy1zdXJmYWNlIHAtNlwiPlxuICAgICAgPGRpdiBjbGFzcz1cIm1heC13LTJ4bCBteC1hdXRvXCI+XG4gICAgICAgIDxTaG93XG4gICAgICAgICAgd2hlbj17cHJvcHMubW9kZSA9PT0gJ2NoZWNrJ31cbiAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGdhcC02XCI+XG4gICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5pc0NvcnJlY3QgIT09IHVuZGVmaW5lZH0+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtNFwiPlxuICAgICAgICAgICAgICAgIDxTaG93XG4gICAgICAgICAgICAgICAgICB3aGVuPXtwcm9wcy5pc0NvcnJlY3R9XG4gICAgICAgICAgICAgICAgICBmYWxsYmFjaz17PEljb25YQ2lyY2xlRmlsbCBzdHlsZT1cImNvbG9yOiAjZWY0NDQ0O1wiIGNsYXNzPVwidy0xNiBoLTE2IGZsZXgtc2hyaW5rLTBcIiAvPn1cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8SWNvbkNoZWNrQ2lyY2xlRmlsbCBzdHlsZT1cImNvbG9yOiAjMjJjNTVlO1wiIGNsYXNzPVwidy0xNiBoLTE2IGZsZXgtc2hyaW5rLTBcIiAvPlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LTJ4bCBmb250LWJvbGRcIiBzdHlsZT17YGNvbG9yOiAke3Byb3BzLmlzQ29ycmVjdCA/ICcjMjJjNTVlJyA6ICcjZWY0NDQ0J307YH0+XG4gICAgICAgICAgICAgICAgICAgIHtwcm9wcy5pc0NvcnJlY3QgPyAnQ29ycmVjdCEnIDogJ0luY29ycmVjdCd9XG4gICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5mZWVkYmFja1RleHQgJiYgIXByb3BzLmlzQ29ycmVjdH0+XG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1iYXNlIHRleHQtc2Vjb25kYXJ5IG10LTFcIj57cHJvcHMuZmVlZGJhY2tUZXh0fTwvcD5cbiAgICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgIHZhcmlhbnQ9XCJwcmltYXJ5XCJcbiAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25Db250aW51ZX1cbiAgICAgICAgICAgICAgY2xhc3M9XCJtaW4tdy1bMTgwcHhdXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAge3Byb3BzLmNvbnRpbnVlTGFiZWwgfHwgJ05leHQnfVxuICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIH1cbiAgICAgID5cbiAgICAgICAgPEJ1dHRvblxuICAgICAgICAgIHZhcmlhbnQ9XCJwcmltYXJ5XCJcbiAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgIGZ1bGxXaWR0aFxuICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ2hlY2t9XG4gICAgICAgID5cbiAgICAgICAgICBDaGVja1xuICAgICAgICA8L0J1dHRvbj5cbiAgICAgIDwvU2hvdz5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCwgSlNYIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXhlcmNpc2VUZW1wbGF0ZVByb3BzIHtcbiAgaW5zdHJ1Y3Rpb25UZXh0Pzogc3RyaW5nO1xuICBjaGlsZHJlbjogSlNYLkVsZW1lbnQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgRXhlcmNpc2VUZW1wbGF0ZTogQ29tcG9uZW50PEV4ZXJjaXNlVGVtcGxhdGVQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZmxleCBmbGV4LWNvbCBoLWZ1bGwgYmctYmFzZSB0ZXh0LXByaW1hcnknLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgPGRpdiBjbGFzcz1cImZsZXgtZ3JvdyBvdmVyZmxvdy15LWF1dG8gZmxleCBmbGV4LWNvbCBwYi0yNFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwidy1mdWxsIG1heC13LTJ4bCBteC1hdXRvIHB4LTQgcHktOFwiPlxuICAgICAgICAgIHtwcm9wcy5pbnN0cnVjdGlvblRleHQgJiYgKFxuICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtbXV0ZWQtZm9yZWdyb3VuZCBtYi00IHRleHQtbGVmdFwiPlxuICAgICAgICAgICAgICB7cHJvcHMuaW5zdHJ1Y3Rpb25UZXh0fVxuICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICl9XG4gICAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBSZWFkQWxvdWRQcm9wcyB7XG4gIHByb21wdDogc3RyaW5nO1xuICB1c2VyVHJhbnNjcmlwdD86IHN0cmluZztcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBSZWFkQWxvdWQ6IENvbXBvbmVudDxSZWFkQWxvdWRQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignc3BhY2UteS00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxwIGNsYXNzPVwidGV4dC0yeGwgdGV4dC1sZWZ0IGxlYWRpbmctcmVsYXhlZFwiPlxuICAgICAgICB7cHJvcHMucHJvbXB0fVxuICAgICAgPC9wPlxuICAgICAgXG4gICAgICA8U2hvdyB3aGVuPXtwcm9wcy51c2VyVHJhbnNjcmlwdH0+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJtdC04XCI+XG4gICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtbXV0ZWQtZm9yZWdyb3VuZCBtYi00XCI+WW91IHNhaWQ6PC9wPlxuICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC0yeGwgdGV4dC1sZWZ0IGxlYWRpbmctcmVsYXhlZFwiPlxuICAgICAgICAgICAge3Byb3BzLnVzZXJUcmFuc2NyaXB0fVxuICAgICAgICAgIDwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L1Nob3c+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY3JlYXRlUmVzb3VyY2UsIFNob3csIGNyZWF0ZVNpZ25hbCwgY3JlYXRlRWZmZWN0IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgUmVhZEFsb3VkIH0gZnJvbSAnLi4vUmVhZEFsb3VkJztcbmltcG9ydCB7IFByb2dyZXNzQmFyIH0gZnJvbSAnLi4vLi4vY29tbW9uL1Byb2dyZXNzQmFyJztcbmltcG9ydCB7IFByYWN0aWNlSGVhZGVyIH0gZnJvbSAnLi4vUHJhY3RpY2VIZWFkZXInO1xuaW1wb3J0IHsgRXhlcmNpc2VUZW1wbGF0ZSB9IGZyb20gJy4uL0V4ZXJjaXNlVGVtcGxhdGUnO1xuaW1wb3J0IHsgRXhlcmNpc2VGb290ZXIgfSBmcm9tICcuLi9FeGVyY2lzZUZvb3Rlcic7XG5pbXBvcnQgeyBSZXNwb25zZUZvb3RlciB9IGZyb20gJy4uL1Jlc3BvbnNlRm9vdGVyJztcblxuZXhwb3J0IGludGVyZmFjZSBFeGVyY2lzZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHR5cGU6ICdyZWFkX2Fsb3VkJztcbiAgZnVsbF9saW5lOiBzdHJpbmc7XG4gIGZvY3VzX3dvcmRzOiBzdHJpbmdbXTtcbiAgY2FyZF9pZHM6IHN0cmluZ1tdO1xuICBzb25nX2NvbnRleHQ6IHtcbiAgICB0aXRsZTogc3RyaW5nO1xuICAgIGFydGlzdDogc3RyaW5nO1xuICAgIHNvbmdfaWQ6IHN0cmluZztcbiAgICBsaW5lX2luZGV4OiBudW1iZXI7XG4gIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJhY3RpY2VFeGVyY2lzZVZpZXdQcm9wcyB7XG4gIHNlc3Npb25JZD86IHN0cmluZztcbiAgb25CYWNrOiAoKSA9PiB2b2lkO1xuICBhcGlCYXNlVXJsPzogc3RyaW5nO1xuICBhdXRoVG9rZW4/OiBzdHJpbmc7XG4gIGhlYWRlclRpdGxlPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgUHJhY3RpY2VFeGVyY2lzZVZpZXc6IENvbXBvbmVudDxQcmFjdGljZUV4ZXJjaXNlVmlld1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbY3VycmVudEV4ZXJjaXNlSW5kZXgsIHNldEN1cnJlbnRFeGVyY2lzZUluZGV4XSA9IGNyZWF0ZVNpZ25hbCgwKTtcbiAgY29uc3QgW2lzUmVjb3JkaW5nLCBzZXRJc1JlY29yZGluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbaXNQcm9jZXNzaW5nLCBzZXRJc1Byb2Nlc3NpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3VzZXJUcmFuc2NyaXB0LCBzZXRVc2VyVHJhbnNjcmlwdF0gPSBjcmVhdGVTaWduYWwoJycpO1xuICBjb25zdCBbY3VycmVudFNjb3JlLCBzZXRDdXJyZW50U2NvcmVdID0gY3JlYXRlU2lnbmFsPG51bWJlciB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbbWVkaWFSZWNvcmRlciwgc2V0TWVkaWFSZWNvcmRlcl0gPSBjcmVhdGVTaWduYWw8TWVkaWFSZWNvcmRlciB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbYXVkaW9DaHVua3MsIHNldEF1ZGlvQ2h1bmtzXSA9IGNyZWF0ZVNpZ25hbDxCbG9iW10+KFtdKTtcbiAgY29uc3QgW3Nob3dGZWVkYmFjaywgc2V0U2hvd0ZlZWRiYWNrXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtpc0NvcnJlY3QsIHNldElzQ29ycmVjdF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBcbiAgY29uc3QgYXBpQmFzZVVybCA9ICgpID0+IHByb3BzLmFwaUJhc2VVcmwgfHwgJ2h0dHA6Ly9sb2NhbGhvc3Q6ODc4Nyc7XG4gIFxuICAvLyBGZXRjaCBleGVyY2lzZXMgZnJvbSB0aGUgQVBJXG4gIGNvbnN0IFtleGVyY2lzZXNdID0gY3JlYXRlUmVzb3VyY2UoYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICAvLyBJbmNsdWRlIHNlc3Npb25JZCBpZiBwcm92aWRlZCB0byBnZXQgZXhlcmNpc2VzIGZyb20gdGhpcyBzZXNzaW9uIG9ubHlcbiAgICAgIGNvbnN0IHVybCA9IHByb3BzLnNlc3Npb25JZCBcbiAgICAgICAgPyBgJHthcGlCYXNlVXJsKCl9L2FwaS9wcmFjdGljZS9leGVyY2lzZXM/bGltaXQ9MTAmc2Vzc2lvbklkPSR7cHJvcHMuc2Vzc2lvbklkfWBcbiAgICAgICAgOiBgJHthcGlCYXNlVXJsKCl9L2FwaS9wcmFjdGljZS9leGVyY2lzZXM/bGltaXQ9MTBgO1xuICAgICAgXG4gICAgICBjb25zdCBoZWFkZXJzOiBIZWFkZXJzSW5pdCA9IHt9O1xuICAgICAgaWYgKHByb3BzLmF1dGhUb2tlbikge1xuICAgICAgICBoZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSBgQmVhcmVyICR7cHJvcHMuYXV0aFRva2VufWA7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7IGhlYWRlcnMgfSk7XG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IGVycm9yVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICAgICAgY29uc29sZS5lcnJvcignW1ByYWN0aWNlRXhlcmNpc2VWaWV3XSBBUEkgZXJyb3I6JywgcmVzcG9uc2Uuc3RhdHVzLCBlcnJvclRleHQpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBmZXRjaCBleGVyY2lzZXMnKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICBcbiAgICAgIGlmIChkYXRhLmRhdGEgJiYgZGF0YS5kYXRhLmV4ZXJjaXNlcykge1xuICAgICAgICByZXR1cm4gZGF0YS5kYXRhLmV4ZXJjaXNlcyBhcyBFeGVyY2lzZVtdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIFtdO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbUHJhY3RpY2VFeGVyY2lzZVZpZXddIEZhaWxlZCB0byBmZXRjaDonLCBlcnJvcik7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICB9KTtcblxuICAvLyBMb2cgd2hlbiBleGVyY2lzZXMgbG9hZFxuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IGV4ZXJjaXNlTGlzdCA9IGV4ZXJjaXNlcygpO1xuICB9KTtcblxuICBjb25zdCBoYW5kbGVTdGFydFJlY29yZGluZyA9IGFzeW5jICgpID0+IHtcbiAgICBzZXRVc2VyVHJhbnNjcmlwdCgnJyk7XG4gICAgc2V0Q3VycmVudFNjb3JlKG51bGwpO1xuICAgIHNldEF1ZGlvQ2h1bmtzKFtdKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3RyZWFtID0gYXdhaXQgbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXRVc2VyTWVkaWEoeyBcbiAgICAgICAgYXVkaW86IHtcbiAgICAgICAgICBlY2hvQ2FuY2VsbGF0aW9uOiB0cnVlLFxuICAgICAgICAgIG5vaXNlU3VwcHJlc3Npb246IHRydWUsXG4gICAgICAgICAgYXV0b0dhaW5Db250cm9sOiB0cnVlXG4gICAgICAgIH0gXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgbWltZVR5cGUgPSBNZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZCgnYXVkaW8vd2VibTtjb2RlY3M9b3B1cycpIFxuICAgICAgICA/ICdhdWRpby93ZWJtO2NvZGVjcz1vcHVzJyBcbiAgICAgICAgOiAnYXVkaW8vd2VibSc7XG4gICAgICAgIFxuICAgICAgY29uc3QgcmVjb3JkZXIgPSBuZXcgTWVkaWFSZWNvcmRlcihzdHJlYW0sIHsgbWltZVR5cGUgfSk7XG4gICAgICBjb25zdCBjaHVua3M6IEJsb2JbXSA9IFtdO1xuICAgICAgXG4gICAgICByZWNvcmRlci5vbmRhdGFhdmFpbGFibGUgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgaWYgKGV2ZW50LmRhdGEuc2l6ZSA+IDApIHtcbiAgICAgICAgICBjaHVua3MucHVzaChldmVudC5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIFxuICAgICAgcmVjb3JkZXIub25zdG9wID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBhdWRpb0Jsb2IgPSBuZXcgQmxvYihjaHVua3MsIHsgdHlwZTogbWltZVR5cGUgfSk7XG4gICAgICAgIGF3YWl0IHByb2Nlc3NSZWNvcmRpbmcoYXVkaW9CbG9iKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFN0b3AgYWxsIHRyYWNrc1xuICAgICAgICBzdHJlYW0uZ2V0VHJhY2tzKCkuZm9yRWFjaCh0cmFjayA9PiB0cmFjay5zdG9wKCkpO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgcmVjb3JkZXIuc3RhcnQoKTtcbiAgICAgIHNldE1lZGlhUmVjb3JkZXIocmVjb3JkZXIpO1xuICAgICAgc2V0SXNSZWNvcmRpbmcodHJ1ZSk7XG4gICAgICBcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW1ByYWN0aWNlRXhlcmNpc2VWaWV3XSBGYWlsZWQgdG8gc3RhcnQgcmVjb3JkaW5nOicsIGVycm9yKTtcbiAgICAgIHNldElzUmVjb3JkaW5nKGZhbHNlKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgcHJvY2Vzc1JlY29yZGluZyA9IGFzeW5jIChibG9iOiBCbG9iKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIHNldElzUHJvY2Vzc2luZyh0cnVlKTtcbiAgICAgIFxuICAgICAgLy8gQ29udmVydCB0byBiYXNlNjQgZm9yIEFQSVxuICAgICAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgIGNvbnN0IGJhc2U2NCA9IGF3YWl0IG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgcmVhZGVyLm9ubG9hZGVuZCA9ICgpID0+IHtcbiAgICAgICAgICBjb25zdCBiYXNlNjRTdHJpbmcgPSByZWFkZXIucmVzdWx0IGFzIHN0cmluZztcbiAgICAgICAgICByZXNvbHZlKGJhc2U2NFN0cmluZy5zcGxpdCgnLCcpWzFdKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoYmxvYik7XG4gICAgICB9KTtcblxuICAgICAgLy8gU2VuZCB0byBTVFQgQVBJIHdpdGggcmV0cnkgbG9naWNcbiAgICAgIGxldCByZXNwb25zZTtcbiAgICAgIGxldCBhdHRlbXB0cyA9IDA7XG4gICAgICBjb25zdCBtYXhBdHRlbXB0cyA9IDI7XG4gICAgICBcbiAgICAgIGNvbnN0IGhlYWRlcnM6IEhlYWRlcnNJbml0ID0geyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH07XG4gICAgICBpZiAocHJvcHMuYXV0aFRva2VuKSB7XG4gICAgICAgIGhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9IGBCZWFyZXIgJHtwcm9wcy5hdXRoVG9rZW59YDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgd2hpbGUgKGF0dGVtcHRzIDwgbWF4QXR0ZW1wdHMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke2FwaUJhc2VVcmwoKX0vYXBpL3NwZWVjaC10by10ZXh0L3RyYW5zY3JpYmVgLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgIGhlYWRlcnMsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IFxuICAgICAgICAgICAgICBhdWRpb0Jhc2U2NDogYmFzZTY0LFxuICAgICAgICAgICAgICBleHBlY3RlZFRleHQ6IGN1cnJlbnRFeGVyY2lzZSgpPy5mdWxsX2xpbmUsXG4gICAgICAgICAgICAgIC8vIFVzZSBEZWVwZ3JhbSBvbiByZXRyeVxuICAgICAgICAgICAgICBwcmVmZXJEZWVwZ3JhbTogYXR0ZW1wdHMgPiAwXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChmZXRjaEVycm9yKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihgW1ByYWN0aWNlRXhlcmNpc2VWaWV3XSBTVFQgYXR0ZW1wdCAke2F0dGVtcHRzICsgMX0gZmFpbGVkOmAsIGZldGNoRXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBhdHRlbXB0cysrO1xuICAgICAgICBpZiAoYXR0ZW1wdHMgPCBtYXhBdHRlbXB0cykge1xuICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCA1MDApKTsgLy8gU21hbGwgZGVsYXkgYmVmb3JlIHJldHJ5XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgc2V0VXNlclRyYW5zY3JpcHQocmVzdWx0LmRhdGEudHJhbnNjcmlwdCk7XG4gICAgICAgIFxuICAgICAgICAvLyBDYWxjdWxhdGUgYSBzaW1wbGUgc2NvcmUgYmFzZWQgb24gbWF0Y2hpbmcgd29yZHNcbiAgICAgICAgY29uc3Qgc2NvcmUgPSBjYWxjdWxhdGVTY29yZShjdXJyZW50RXhlcmNpc2UoKT8uZnVsbF9saW5lIHx8ICcnLCByZXN1bHQuZGF0YS50cmFuc2NyaXB0KTtcbiAgICAgICAgc2V0Q3VycmVudFNjb3JlKHNjb3JlKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEF1dG9tYXRpY2FsbHkgc3VibWl0IGFmdGVyIHRyYW5zY3JpcHRpb25cbiAgICAgICAgYXdhaXQgaGFuZGxlQXV0b1N1Ym1pdChzY29yZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NUVCBmYWlsZWQgYWZ0ZXIgcmV0cmllcycpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbUHJhY3RpY2VFeGVyY2lzZVZpZXddIEZhaWxlZCB0byBwcm9jZXNzIHJlY29yZGluZzonLCBlcnJvcik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldElzUHJvY2Vzc2luZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVN0b3BSZWNvcmRpbmcgPSAoKSA9PiB7XG4gICAgY29uc3QgcmVjb3JkZXIgPSBtZWRpYVJlY29yZGVyKCk7XG4gICAgaWYgKHJlY29yZGVyICYmIHJlY29yZGVyLnN0YXRlICE9PSAnaW5hY3RpdmUnKSB7XG4gICAgICByZWNvcmRlci5zdG9wKCk7XG4gICAgICBzZXRJc1JlY29yZGluZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGNhbGN1bGF0ZVNjb3JlID0gKGV4cGVjdGVkOiBzdHJpbmcsIGFjdHVhbDogc3RyaW5nKTogbnVtYmVyID0+IHtcbiAgICBjb25zdCBleHBlY3RlZFdvcmRzID0gZXhwZWN0ZWQudG9Mb3dlckNhc2UoKS5zcGxpdCgvXFxzKy8pO1xuICAgIGNvbnN0IGFjdHVhbFdvcmRzID0gYWN0dWFsLnRvTG93ZXJDYXNlKCkuc3BsaXQoL1xccysvKTtcbiAgICBsZXQgbWF0Y2hlcyA9IDA7XG4gICAgXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHBlY3RlZFdvcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYWN0dWFsV29yZHNbaV0gPT09IGV4cGVjdGVkV29yZHNbaV0pIHtcbiAgICAgICAgbWF0Y2hlcysrO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gTWF0aC5yb3VuZCgobWF0Y2hlcyAvIGV4cGVjdGVkV29yZHMubGVuZ3RoKSAqIDEwMCk7XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlQXV0b1N1Ym1pdCA9IGFzeW5jIChzY29yZTogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgY3VycmVudEV4ZXJjaXNlID0gZXhlcmNpc2VzKCk/LltjdXJyZW50RXhlcmNpc2VJbmRleCgpXTtcbiAgICBjb25zdCBjaHVua3MgPSBhdWRpb0NodW5rcygpO1xuICAgIGNvbnN0IGJsb2IgPSBjaHVua3MubGVuZ3RoID4gMCA/IG5ldyBCbG9iKGNodW5rcywgeyB0eXBlOiAnYXVkaW8vd2VibScgfSkgOiBudWxsO1xuICAgIFxuICAgIC8vIERldGVybWluZSBpZiBjb3JyZWN0ICg4MCUgb3IgaGlnaGVyKVxuICAgIHNldElzQ29ycmVjdChzY29yZSA+PSA4MCk7XG4gICAgc2V0U2hvd0ZlZWRiYWNrKHRydWUpO1xuICAgIFxuICAgIGlmIChjdXJyZW50RXhlcmNpc2UgJiYgY3VycmVudEV4ZXJjaXNlLmNhcmRfaWRzLmxlbmd0aCA+IDAgJiYgYmxvYikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gQ29udmVydCBhdWRpbyB0byBiYXNlNjRcbiAgICAgICAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgICAgY29uc3QgYmFzZTY0ID0gYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBiYXNlNjRTdHJpbmcgPSByZWFkZXIucmVzdWx0IGFzIHN0cmluZztcbiAgICAgICAgICAgIHJlc29sdmUoYmFzZTY0U3RyaW5nLnNwbGl0KCcsJylbMV0pO1xuICAgICAgICAgIH07XG4gICAgICAgICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoYmxvYik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGhlYWRlcnM6IEhlYWRlcnNJbml0ID0geyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH07XG4gICAgICAgIGlmIChwcm9wcy5hdXRoVG9rZW4pIHtcbiAgICAgICAgICBoZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSBgQmVhcmVyICR7cHJvcHMuYXV0aFRva2VufWA7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTdWJtaXQgcmV2aWV3XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7YXBpQmFzZVVybCgpfS9hcGkvcHJhY3RpY2UvcmV2aWV3YCwge1xuICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgIGhlYWRlcnMsXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgZXhlcmNpc2VJZDogY3VycmVudEV4ZXJjaXNlLmlkLFxuICAgICAgICAgICAgYXVkaW9CYXNlNjQ6IGJhc2U2NCxcbiAgICAgICAgICAgIGNhcmRTY29yZXM6IGN1cnJlbnRFeGVyY2lzZS5jYXJkX2lkcy5tYXAoY2FyZElkID0+ICh7XG4gICAgICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgICAgICAgc2NvcmVcbiAgICAgICAgICAgIH0pKVxuICAgICAgICAgIH0pXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbUHJhY3RpY2VFeGVyY2lzZVZpZXddIEZhaWxlZCB0byBzdWJtaXQgcmV2aWV3OicsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBoYW5kbGVTdWJtaXQgPSBhc3luYyAoKSA9PiB7XG4gICAgLy8gVGhpcyBpcyBub3cgb25seSB1c2VkIGFzIGZhbGxiYWNrIGlmIG5lZWRlZFxuICAgIGNvbnN0IHNjb3JlID0gY3VycmVudFNjb3JlKCk7XG4gICAgaWYgKHNjb3JlICE9PSBudWxsKSB7XG4gICAgICBhd2FpdCBoYW5kbGVBdXRvU3VibWl0KHNjb3JlKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBoYW5kbGVDb250aW51ZSA9ICgpID0+IHtcbiAgICAvLyBNb3ZlIHRvIG5leHQgZXhlcmNpc2VcbiAgICBpZiAoY3VycmVudEV4ZXJjaXNlSW5kZXgoKSA8IChleGVyY2lzZXMoKT8ubGVuZ3RoIHx8IDApIC0gMSkge1xuICAgICAgc2V0Q3VycmVudEV4ZXJjaXNlSW5kZXgoY3VycmVudEV4ZXJjaXNlSW5kZXgoKSArIDEpO1xuICAgICAgc2V0VXNlclRyYW5zY3JpcHQoJycpO1xuICAgICAgc2V0Q3VycmVudFNjb3JlKG51bGwpO1xuICAgICAgc2V0QXVkaW9DaHVua3MoW10pO1xuICAgICAgc2V0U2hvd0ZlZWRiYWNrKGZhbHNlKTtcbiAgICAgIHNldElzQ29ycmVjdChmYWxzZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEFsbCBleGVyY2lzZXMgY29tcGxldGVkXG4gICAgICBwcm9wcy5vbkJhY2soKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlU2tpcCA9ICgpID0+IHtcbiAgICBcbiAgICAvLyBNb3ZlIHRvIG5leHQgZXhlcmNpc2VcbiAgICBpZiAoY3VycmVudEV4ZXJjaXNlSW5kZXgoKSA8IChleGVyY2lzZXMoKT8ubGVuZ3RoIHx8IDApIC0gMSkge1xuICAgICAgc2V0Q3VycmVudEV4ZXJjaXNlSW5kZXgoY3VycmVudEV4ZXJjaXNlSW5kZXgoKSArIDEpO1xuICAgICAgc2V0VXNlclRyYW5zY3JpcHQoJycpO1xuICAgICAgc2V0Q3VycmVudFNjb3JlKG51bGwpO1xuICAgICAgc2V0QXVkaW9DaHVua3MoW10pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBBbGwgZXhlcmNpc2VzIGNvbXBsZXRlZFxuICAgICAgcHJvcHMub25CYWNrKCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGN1cnJlbnRFeGVyY2lzZSA9ICgpID0+IGV4ZXJjaXNlcygpPy5bY3VycmVudEV4ZXJjaXNlSW5kZXgoKV07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPVwiaC1mdWxsIGJnLWJhc2UgZmxleCBmbGV4LWNvbFwiPlxuICAgICAgPFNob3dcbiAgICAgICAgd2hlbj17IWV4ZXJjaXNlcy5sb2FkaW5nfVxuICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhbmltYXRlLXNwaW4gcm91bmRlZC1mdWxsIGgtMTIgdy0xMiBib3JkZXItYi0yIGJvcmRlci1hY2NlbnQtcHJpbWFyeSBteC1hdXRvIG1iLTRcIj48L2Rpdj5cbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LW11dGVkLWZvcmVncm91bmRcIj5Mb2FkaW5nIGV4ZXJjaXNlcy4uLjwvcD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICB9XG4gICAgICA+XG4gICAgICAgIDxTaG93XG4gICAgICAgICAgd2hlbj17KGV4ZXJjaXNlcygpIHx8IFtdKS5sZW5ndGggPiAwfVxuICAgICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcC04XCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBtYXgtdy1tZFwiPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1sZyB0ZXh0LW11dGVkLWZvcmVncm91bmQgbWItNFwiPk5vIHByYWN0aWNlIGV4ZXJjaXNlcyBhdmFpbGFibGUgeWV0LjwvcD5cbiAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc20gdGV4dC1tdXRlZC1mb3JlZ3JvdW5kXCI+Q29tcGxldGUga2FyYW9rZSBzZXNzaW9ucyB3aXRoIGVycm9ycyB0byBnZW5lcmF0ZSBwZXJzb25hbGl6ZWQgZXhlcmNpc2VzITwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICB9XG4gICAgICAgID5cbiAgICAgICAgICA8U2hvdyB3aGVuPXtjdXJyZW50RXhlcmNpc2UoKX0+XG4gICAgICAgICAgICB7KGV4ZXJjaXNlKSA9PiAoXG4gICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgPFByb2dyZXNzQmFyIFxuICAgICAgICAgICAgICAgICAgY3VycmVudD17Y3VycmVudEV4ZXJjaXNlSW5kZXgoKSArIDF9IFxuICAgICAgICAgICAgICAgICAgdG90YWw9e2V4ZXJjaXNlcygpPy5sZW5ndGggfHwgMH0gXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICA8UHJhY3RpY2VIZWFkZXIgXG4gICAgICAgICAgICAgICAgICB0aXRsZT17cHJvcHMuaGVhZGVyVGl0bGUgfHwgXCJcIn0gXG4gICAgICAgICAgICAgICAgICBvbkV4aXQ9e3Byb3BzLm9uQmFja30gXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICA8bWFpbiBjbGFzcz1cImZsZXgtMVwiPlxuICAgICAgICAgICAgICAgICAgPEV4ZXJjaXNlVGVtcGxhdGUgaW5zdHJ1Y3Rpb25UZXh0PVwiUmVhZCBhbG91ZDpcIj5cbiAgICAgICAgICAgICAgICAgICAgPFJlYWRBbG91ZFxuICAgICAgICAgICAgICAgICAgICAgIHByb21wdD17ZXhlcmNpc2UoKS5mdWxsX2xpbmV9XG4gICAgICAgICAgICAgICAgICAgICAgdXNlclRyYW5zY3JpcHQ9e3VzZXJUcmFuc2NyaXB0KCl9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICA8L0V4ZXJjaXNlVGVtcGxhdGU+XG4gICAgICAgICAgICAgICAgPC9tYWluPlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxTaG93XG4gICAgICAgICAgICAgICAgICB3aGVuPXtzaG93RmVlZGJhY2soKX1cbiAgICAgICAgICAgICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICAgICAgPEV4ZXJjaXNlRm9vdGVyXG4gICAgICAgICAgICAgICAgICAgICAgaXNSZWNvcmRpbmc9e2lzUmVjb3JkaW5nKCl9XG4gICAgICAgICAgICAgICAgICAgICAgaXNQcm9jZXNzaW5nPXtpc1Byb2Nlc3NpbmcoKX1cbiAgICAgICAgICAgICAgICAgICAgICBjYW5TdWJtaXQ9e3VzZXJUcmFuc2NyaXB0KCkudHJpbSgpLmxlbmd0aCA+IDB9XG4gICAgICAgICAgICAgICAgICAgICAgb25SZWNvcmQ9e2hhbmRsZVN0YXJ0UmVjb3JkaW5nfVxuICAgICAgICAgICAgICAgICAgICAgIG9uU3RvcD17aGFuZGxlU3RvcFJlY29yZGluZ31cbiAgICAgICAgICAgICAgICAgICAgICBvblN1Ym1pdD17aGFuZGxlU3VibWl0fVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxSZXNwb25zZUZvb3RlclxuICAgICAgICAgICAgICAgICAgICBtb2RlPVwiZmVlZGJhY2tcIlxuICAgICAgICAgICAgICAgICAgICBpc0NvcnJlY3Q9e2lzQ29ycmVjdCgpfVxuICAgICAgICAgICAgICAgICAgICBvbkNvbnRpbnVlPXtoYW5kbGVDb250aW51ZX1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9TaG93PlxuICAgICAgICA8L1Nob3c+XG4gICAgICA8L1Nob3c+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgU2hvdywgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5pbXBvcnQgeyBVc2VyUHJvZmlsZSB9IGZyb20gJy4uL1VzZXJQcm9maWxlJztcbmltcG9ydCB7IENyZWRpdFBhY2sgfSBmcm9tICcuLi9DcmVkaXRQYWNrJztcbmltcG9ydCB7IFdhbGxldENvbm5lY3QgfSBmcm9tICcuLi9XYWxsZXRDb25uZWN0JztcbmltcG9ydCB7IEZhcmNhc3RlckthcmFva2VWaWV3IH0gZnJvbSAnLi4vLi4va2FyYW9rZS9GYXJjYXN0ZXJLYXJhb2tlVmlldyc7XG5pbXBvcnQgdHlwZSB7IEx5cmljTGluZSB9IGZyb20gJy4uLy4uL2thcmFva2UvTHlyaWNzRGlzcGxheSc7XG5pbXBvcnQgdHlwZSB7IExlYWRlcmJvYXJkRW50cnkgfSBmcm9tICcuLi8uLi9rYXJhb2tlL0xlYWRlcmJvYXJkUGFuZWwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZhcmNhc3Rlck1pbmlBcHBQcm9wcyB7XG4gIC8vIFVzZXIgaW5mb1xuICB1c2VyPzoge1xuICAgIGZpZD86IG51bWJlcjtcbiAgICB1c2VybmFtZT86IHN0cmluZztcbiAgICBkaXNwbGF5TmFtZT86IHN0cmluZztcbiAgICBwZnBVcmw/OiBzdHJpbmc7XG4gIH07XG4gIFxuICAvLyBXYWxsZXRcbiAgd2FsbGV0QWRkcmVzcz86IHN0cmluZztcbiAgd2FsbGV0Q2hhaW4/OiAnQmFzZScgfCAnU29sYW5hJztcbiAgaXNXYWxsZXRDb25uZWN0ZWQ/OiBib29sZWFuO1xuICBcbiAgLy8gQ3JlZGl0c1xuICB1c2VyQ3JlZGl0cz86IG51bWJlcjtcbiAgXG4gIC8vIENhbGxiYWNrc1xuICBvbkNvbm5lY3RXYWxsZXQ/OiAoKSA9PiB2b2lkO1xuICBvbkRpc2Nvbm5lY3RXYWxsZXQ/OiAoKSA9PiB2b2lkO1xuICBvblB1cmNoYXNlQ3JlZGl0cz86IChwYWNrOiB7IGNyZWRpdHM6IG51bWJlcjsgcHJpY2U6IHN0cmluZzsgY3VycmVuY3k6IHN0cmluZyB9KSA9PiB2b2lkO1xuICBvblNlbGVjdFNvbmc/OiAoKSA9PiB2b2lkO1xuICBcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBGYXJjYXN0ZXJNaW5pQXBwOiBDb21wb25lbnQ8RmFyY2FzdGVyTWluaUFwcFByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbc2hvd0thcmFva2UsIHNldFNob3dLYXJhb2tlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIFxuICAvLyBNb2NrIGRhdGEgZm9yIGRlbW9cbiAgY29uc3QgbW9ja0x5cmljczogTHlyaWNMaW5lW10gPSBbXG4gICAgeyBpZDogJzEnLCB0ZXh0OiBcIklzIHRoaXMgdGhlIHJlYWwgbGlmZT9cIiwgc3RhcnRUaW1lOiAwLCBkdXJhdGlvbjogMjAwMCB9LFxuICAgIHsgaWQ6ICcyJywgdGV4dDogXCJJcyB0aGlzIGp1c3QgZmFudGFzeT9cIiwgc3RhcnRUaW1lOiAyMDAwLCBkdXJhdGlvbjogMjAwMCB9LFxuICAgIHsgaWQ6ICczJywgdGV4dDogXCJDYXVnaHQgaW4gYSBsYW5kc2xpZGVcIiwgc3RhcnRUaW1lOiA0MDAwLCBkdXJhdGlvbjogMjAwMCB9LFxuICAgIHsgaWQ6ICc0JywgdGV4dDogXCJObyBlc2NhcGUgZnJvbSByZWFsaXR5XCIsIHN0YXJ0VGltZTogNjAwMCwgZHVyYXRpb246IDIwMDAgfSxcbiAgXTtcbiAgXG4gIGNvbnN0IG1vY2tMZWFkZXJib2FyZDogTGVhZGVyYm9hcmRFbnRyeVtdID0gW1xuICAgIHsgcmFuazogMSwgdXNlcm5hbWU6IFwiYWxpY2VcIiwgc2NvcmU6IDk4MCB9LFxuICAgIHsgcmFuazogMiwgdXNlcm5hbWU6IFwiYm9iXCIsIHNjb3JlOiA5NDUgfSxcbiAgICB7IHJhbms6IDMsIHVzZXJuYW1lOiBcImNhcm9sXCIsIHNjb3JlOiA5MjAgfSxcbiAgXTtcblxuICBjb25zdCBjcmVkaXRQYWNrcyA9IFtcbiAgICB7IGNyZWRpdHM6IDI1MCwgcHJpY2U6ICcyLjUwJywgY3VycmVuY3k6ICdVU0RDJyBhcyBjb25zdCB9LFxuICAgIHsgY3JlZGl0czogNTAwLCBwcmljZTogJzQuNzUnLCBjdXJyZW5jeTogJ1VTREMnIGFzIGNvbnN0LCBkaXNjb3VudDogNSwgcmVjb21tZW5kZWQ6IHRydWUgfSxcbiAgICB7IGNyZWRpdHM6IDEyMDAsIHByaWNlOiAnMTAuMDAnLCBjdXJyZW5jeTogJ1VTREMnIGFzIGNvbnN0LCBkaXNjb3VudDogMTYgfSxcbiAgXTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sIGgtc2NyZWVuIGJnLWJhc2UnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgey8qIEhlYWRlciB3aXRoIHVzZXIgcHJvZmlsZSAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJiZy1zdXJmYWNlIGJvcmRlci1iIGJvcmRlci1zdWJ0bGVcIj5cbiAgICAgICAgPFVzZXJQcm9maWxlXG4gICAgICAgICAgZmlkPXtwcm9wcy51c2VyPy5maWR9XG4gICAgICAgICAgdXNlcm5hbWU9e3Byb3BzLnVzZXI/LnVzZXJuYW1lfVxuICAgICAgICAgIGRpc3BsYXlOYW1lPXtwcm9wcy51c2VyPy5kaXNwbGF5TmFtZX1cbiAgICAgICAgICBwZnBVcmw9e3Byb3BzLnVzZXI/LnBmcFVybH1cbiAgICAgICAgICBjcmVkaXRzPXtwcm9wcy51c2VyQ3JlZGl0cyB8fCAwfVxuICAgICAgICAvPlxuICAgICAgPC9kaXY+XG4gICAgICBcbiAgICAgIHsvKiBNYWluIGNvbnRlbnQgKi99XG4gICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIG92ZXJmbG93LWF1dG9cIj5cbiAgICAgICAgPFNob3dcbiAgICAgICAgICB3aGVuPXtzaG93S2FyYW9rZSgpfVxuICAgICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwLTQgc3BhY2UteS02XCI+XG4gICAgICAgICAgICAgIHsvKiBIZXJvIHNlY3Rpb24gKi99XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBweS04XCI+XG4gICAgICAgICAgICAgICAgPGgxIGNsYXNzPVwidGV4dC0zeGwgZm9udC1ib2xkIG1iLTJcIj5TY2FybGV0dCBLYXJhb2tlPC9oMT5cbiAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc2Vjb25kYXJ5XCI+XG4gICAgICAgICAgICAgICAgICBTaW5nIHlvdXIgZmF2b3JpdGUgc29uZ3MgYW5kIGNvbXBldGUgd2l0aCBmcmllbmRzIVxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICB7LyogQ3JlZGl0cyBjaGVjayAqL31cbiAgICAgICAgICAgICAgPFNob3dcbiAgICAgICAgICAgICAgICB3aGVuPXtwcm9wcy51c2VyQ3JlZGl0cyAmJiBwcm9wcy51c2VyQ3JlZGl0cyA+IDB9XG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNlwiPlxuICAgICAgICAgICAgICAgICAgICB7LyogV2FsbGV0IGNvbm5lY3Rpb24gKi99XG4gICAgICAgICAgICAgICAgICAgIDxXYWxsZXRDb25uZWN0XG4gICAgICAgICAgICAgICAgICAgICAgYWRkcmVzcz17cHJvcHMud2FsbGV0QWRkcmVzc31cbiAgICAgICAgICAgICAgICAgICAgICBjaGFpbj17cHJvcHMud2FsbGV0Q2hhaW59XG4gICAgICAgICAgICAgICAgICAgICAgaXNDb25uZWN0ZWQ9e3Byb3BzLmlzV2FsbGV0Q29ubmVjdGVkfVxuICAgICAgICAgICAgICAgICAgICAgIG9uQ29ubmVjdD17cHJvcHMub25Db25uZWN0V2FsbGV0fVxuICAgICAgICAgICAgICAgICAgICAgIG9uRGlzY29ubmVjdD17cHJvcHMub25EaXNjb25uZWN0V2FsbGV0fVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgey8qIENyZWRpdCBwYWNrcyAqL31cbiAgICAgICAgICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuaXNXYWxsZXRDb25uZWN0ZWR9PlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LXhsIGZvbnQtc2VtaWJvbGQgbWItNFwiPlB1cmNoYXNlIENyZWRpdHM8L2gyPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImdyaWQgZ3JpZC1jb2xzLTEgbWQ6Z3JpZC1jb2xzLTMgZ2FwLTRcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAge2NyZWRpdFBhY2tzLm1hcCgocGFjaykgPT4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxDcmVkaXRQYWNrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Li4ucGFja31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uUHVyY2hhc2U9eygpID0+IHByb3BzLm9uUHVyY2hhc2VDcmVkaXRzPy4ocGFjayl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgey8qIFNvbmcgc2VsZWN0aW9uICovfVxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LTRcIj5cbiAgICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQteGwgZm9udC1zZW1pYm9sZFwiPlNlbGVjdCBhIFNvbmc8L2gyPlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgcC00IGJnLXN1cmZhY2Ugcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLXN1YnRsZSBob3Zlcjpib3JkZXItYWNjZW50LXByaW1hcnkgdHJhbnNpdGlvbi1jb2xvcnMgdGV4dC1sZWZ0XCJcbiAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd0thcmFva2UodHJ1ZSl9XG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmb250LXNlbWlib2xkXCI+Qm9oZW1pYW4gUmhhcHNvZHk8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtc20gdGV4dC1zZWNvbmRhcnlcIj5RdWVlbjwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC14cyB0ZXh0LXRlcnRpYXJ5IG10LTFcIj5Db3N0OiA1MCBjcmVkaXRzPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgfVxuICAgICAgICA+XG4gICAgICAgICAgPEZhcmNhc3RlckthcmFva2VWaWV3XG4gICAgICAgICAgICBzb25nVGl0bGU9XCJCb2hlbWlhbiBSaGFwc29keVwiXG4gICAgICAgICAgICBhcnRpc3Q9XCJRdWVlblwiXG4gICAgICAgICAgICBzY29yZT17MH1cbiAgICAgICAgICAgIHJhbms9ezF9XG4gICAgICAgICAgICBseXJpY3M9e21vY2tMeXJpY3N9XG4gICAgICAgICAgICBjdXJyZW50VGltZT17MH1cbiAgICAgICAgICAgIGxlYWRlcmJvYXJkPXttb2NrTGVhZGVyYm9hcmR9XG4gICAgICAgICAgICBpc1BsYXlpbmc9e2ZhbHNlfVxuICAgICAgICAgICAgb25TdGFydD17KCkgPT4gY29uc29sZS5sb2coJ1N0YXJ0IGthcmFva2UnKX1cbiAgICAgICAgICAgIG9uU3BlZWRDaGFuZ2U9eyhzcGVlZCkgPT4gY29uc29sZS5sb2coJ1NwZWVkOicsIHNwZWVkKX1cbiAgICAgICAgICAgIG9uQmFjaz17KCkgPT4gc2V0U2hvd0thcmFva2UoZmFsc2UpfVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvU2hvdz5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IEZvciB9IGZyb20gJ3NvbGlkLWpzJztcblxuZXhwb3J0IGludGVyZmFjZSBTb25nIHtcbiAgaWQ6IHN0cmluZztcbiAgdHJhY2tJZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBhcnRpc3Q6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIb21lUGFnZVByb3BzIHtcbiAgc29uZ3M6IFNvbmdbXTtcbiAgb25Tb25nU2VsZWN0PzogKHNvbmc6IFNvbmcpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBIb21lUGFnZTogQ29tcG9uZW50PEhvbWVQYWdlUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHNvbmdJdGVtU3R5bGUgPSB7XG4gICAgcGFkZGluZzogJzE2cHgnLFxuICAgICdtYXJnaW4tYm90dG9tJzogJzhweCcsXG4gICAgJ2JhY2tncm91bmQtY29sb3InOiAnIzFhMWExYScsXG4gICAgJ2JvcmRlci1yYWRpdXMnOiAnOHB4JyxcbiAgICBjdXJzb3I6ICdwb2ludGVyJ1xuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdj5cbiAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogJzE2cHgnLCAnYmFja2dyb3VuZC1jb2xvcic6ICcjMWExYTFhJyB9fT5cbiAgICAgICAgPGgxIHN0eWxlPXt7IG1hcmdpbjogJzAgMCA4cHggMCcsICdmb250LXNpemUnOiAnMjRweCcgfX0+UG9wdWxhciBTb25nczwvaDE+XG4gICAgICAgIDxwIHN0eWxlPXt7IG1hcmdpbjogJzAnLCBjb2xvcjogJyM4ODgnIH19PkNob29zZSBhIHNvbmcgdG8gc3RhcnQgc2luZ2luZzwvcD5cbiAgICAgIDwvZGl2PlxuICAgICAgXG4gICAgICA8ZGl2IHN0eWxlPXt7IHBhZGRpbmc6ICcxNnB4JyB9fT5cbiAgICAgICAgPEZvciBlYWNoPXtwcm9wcy5zb25nc30+XG4gICAgICAgICAgeyhzb25nLCBpbmRleCkgPT4gKFxuICAgICAgICAgICAgPGRpdiBcbiAgICAgICAgICAgICAgc3R5bGU9e3NvbmdJdGVtU3R5bGV9XG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHByb3BzLm9uU29uZ1NlbGVjdD8uKHNvbmcpfVxuICAgICAgICAgICAgICBvbk1vdXNlRW50ZXI9eyhlKSA9PiBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyMyYTJhMmEnfVxuICAgICAgICAgICAgICBvbk1vdXNlTGVhdmU9eyhlKSA9PiBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyMxYTFhMWEnfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAnMTZweCcgfX0+XG4gICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9e3sgY29sb3I6ICcjNjY2JyB9fT57aW5kZXgoKSArIDF9PC9zcGFuPlxuICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7ICdmb250LXdlaWdodCc6ICdib2xkJyB9fT57c29uZy50aXRsZX08L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgY29sb3I6ICcjODg4JyB9fT57c29uZy5hcnRpc3R9PC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9Gb3I+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsLCBvbkNsZWFudXAgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IEx5cmljTGluZSB9IGZyb20gJy4uL2NvbXBvbmVudHMva2FyYW9rZS9MeXJpY3NEaXNwbGF5JztcbmltcG9ydCB7IGNyZWF0ZUthcmFva2VBdWRpb1Byb2Nlc3NvciB9IGZyb20gJy4uL3NlcnZpY2VzL2F1ZGlvL2thcmFva2VBdWRpb1Byb2Nlc3Nvcic7XG5pbXBvcnQgeyBzaG91bGRDaHVua0xpbmVzLCBjYWxjdWxhdGVSZWNvcmRpbmdEdXJhdGlvbiB9IGZyb20gJy4uL3NlcnZpY2VzL2thcmFva2UvY2h1bmtpbmdVdGlscyc7XG5pbXBvcnQgeyBLYXJhb2tlQXBpU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2thcmFva2Uva2FyYW9rZUFwaSc7XG5pbXBvcnQgdHlwZSB7IENodW5rSW5mbyB9IGZyb20gJy4uL3R5cGVzL2thcmFva2UnO1xuaW1wb3J0IHR5cGUgeyBQbGF5YmFja1NwZWVkIH0gZnJvbSAnLi4vY29tcG9uZW50cy9jb21tb24vU3BsaXRCdXR0b24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFVzZUthcmFva2VTZXNzaW9uT3B0aW9ucyB7XG4gIGx5cmljczogTHlyaWNMaW5lW107XG4gIG9uQ29tcGxldGU/OiAocmVzdWx0czogS2FyYW9rZVJlc3VsdHMpID0+IHZvaWQ7XG4gIGF1ZGlvRWxlbWVudD86IEhUTUxBdWRpb0VsZW1lbnQ7XG4gIHRyYWNrSWQ/OiBzdHJpbmc7XG4gIHNvbmdEYXRhPzoge1xuICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgYXJ0aXN0OiBzdHJpbmc7XG4gICAgYWxidW0/OiBzdHJpbmc7XG4gICAgZHVyYXRpb24/OiBudW1iZXI7XG4gIH07XG4gIHNvbmdDYXRhbG9nSWQ/OiBzdHJpbmc7XG4gIGFwaVVybD86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlUmVzdWx0cyB7XG4gIHNjb3JlOiBudW1iZXI7XG4gIGFjY3VyYWN5OiBudW1iZXI7XG4gIHRvdGFsTGluZXM6IG51bWJlcjtcbiAgcGVyZmVjdExpbmVzOiBudW1iZXI7XG4gIGdvb2RMaW5lczogbnVtYmVyO1xuICBuZWVkc1dvcmtMaW5lczogbnVtYmVyO1xuICBzZXNzaW9uSWQ/OiBzdHJpbmc7XG4gIGlzTG9hZGluZz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGluZVNjb3JlIHtcbiAgbGluZUluZGV4OiBudW1iZXI7XG4gIHNjb3JlOiBudW1iZXI7XG4gIHRyYW5zY3JpcHRpb246IHN0cmluZztcbiAgZmVlZGJhY2s/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VLYXJhb2tlU2Vzc2lvbihvcHRpb25zOiBVc2VLYXJhb2tlU2Vzc2lvbk9wdGlvbnMpIHtcbiAgY29uc3QgW2lzUGxheWluZywgc2V0SXNQbGF5aW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtjdXJyZW50VGltZSwgc2V0Q3VycmVudFRpbWVdID0gY3JlYXRlU2lnbmFsKDApO1xuICBjb25zdCBbc2NvcmUsIHNldFNjb3JlXSA9IGNyZWF0ZVNpZ25hbCgwKTtcbiAgY29uc3QgW2NvdW50ZG93biwgc2V0Q291bnRkb3duXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW3Nlc3Npb25JZCwgc2V0U2Vzc2lvbklkXSA9IGNyZWF0ZVNpZ25hbDxzdHJpbmcgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2xpbmVTY29yZXMsIHNldExpbmVTY29yZXNdID0gY3JlYXRlU2lnbmFsPExpbmVTY29yZVtdPihbXSk7XG4gIGNvbnN0IFtjdXJyZW50Q2h1bmssIHNldEN1cnJlbnRDaHVua10gPSBjcmVhdGVTaWduYWw8Q2h1bmtJbmZvIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtpc1JlY29yZGluZywgc2V0SXNSZWNvcmRpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2F1ZGlvRWxlbWVudCwgc2V0QXVkaW9FbGVtZW50XSA9IGNyZWF0ZVNpZ25hbDxIVE1MQXVkaW9FbGVtZW50IHwgdW5kZWZpbmVkPihvcHRpb25zLmF1ZGlvRWxlbWVudCk7XG4gIGNvbnN0IFtyZWNvcmRlZENodW5rcywgc2V0UmVjb3JkZWRDaHVua3NdID0gY3JlYXRlU2lnbmFsPFNldDxudW1iZXI+PihuZXcgU2V0KCkpO1xuICBjb25zdCBbcGxheWJhY2tTcGVlZCwgc2V0UGxheWJhY2tTcGVlZF0gPSBjcmVhdGVTaWduYWw8UGxheWJhY2tTcGVlZD4oJzF4Jyk7XG4gIFxuICBsZXQgYXVkaW9VcGRhdGVJbnRlcnZhbDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gIGxldCByZWNvcmRpbmdUaW1lb3V0OiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgXG4gIGNvbnN0IGF1ZGlvUHJvY2Vzc29yID0gY3JlYXRlS2FyYW9rZUF1ZGlvUHJvY2Vzc29yKHtcbiAgICBzYW1wbGVSYXRlOiAxNjAwMFxuICB9KTtcbiAgXG4gIGNvbnN0IGthcmFva2VBcGkgPSBuZXcgS2FyYW9rZUFwaVNlcnZpY2Uob3B0aW9ucy5hcGlVcmwpO1xuXG4gIC8vIEhlbHBlciB0byBjb252ZXJ0IHNwZWVkIHRvIHBsYXliYWNrIHJhdGVcbiAgY29uc3QgZ2V0UGxheWJhY2tSYXRlID0gKHNwZWVkOiBQbGF5YmFja1NwZWVkKTogbnVtYmVyID0+IHtcbiAgICBzd2l0Y2ggKHNwZWVkKSB7XG4gICAgICBjYXNlICcwLjV4JzogcmV0dXJuIDAuNTtcbiAgICAgIGNhc2UgJzAuNzV4JzogcmV0dXJuIDAuNzU7XG4gICAgICBjYXNlICcxeCc6IHJldHVybiAxLjA7XG4gICAgICBkZWZhdWx0OiByZXR1cm4gMS4wO1xuICAgIH1cbiAgfTtcblxuICAvLyBIZWxwZXIgdG8gZ2V0IHNwZWVkIG11bHRpcGxpZXIgZm9yIHNjb3JpbmdcbiAgY29uc3QgZ2V0U3BlZWRNdWx0aXBsaWVyID0gKHNwZWVkOiBQbGF5YmFja1NwZWVkKTogbnVtYmVyID0+IHtcbiAgICBzd2l0Y2ggKHNwZWVkKSB7XG4gICAgICBjYXNlICcwLjV4JzogcmV0dXJuIDEuMjsgIC8vIDIwJSBzY29yZSBib29zdCBmb3Igc2xvd2VzdCBzcGVlZFxuICAgICAgY2FzZSAnMC43NXgnOiByZXR1cm4gMS4xOyAvLyAxMCUgc2NvcmUgYm9vc3QgZm9yIG1lZGl1bSBzcGVlZFxuICAgICAgY2FzZSAnMXgnOiByZXR1cm4gMS4wOyAgICAvLyBObyBhZGp1c3RtZW50IGZvciBub3JtYWwgc3BlZWRcbiAgICAgIGRlZmF1bHQ6IHJldHVybiAxLjA7XG4gICAgfVxuICB9O1xuXG4gIC8vIEhhbmRsZSBzcGVlZCBjaGFuZ2VcbiAgY29uc3QgaGFuZGxlU3BlZWRDaGFuZ2UgPSAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBoYW5kbGVTcGVlZENoYW5nZSBjYWxsZWQgd2l0aDonLCBzcGVlZCk7XG4gICAgc2V0UGxheWJhY2tTcGVlZChzcGVlZCk7XG4gICAgY29uc3QgYXVkaW8gPSBhdWRpb0VsZW1lbnQoKTtcbiAgICBpZiAoYXVkaW8pIHtcbiAgICAgIGNvbnN0IHJhdGUgPSBnZXRQbGF5YmFja1JhdGUoc3BlZWQpO1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlU2Vzc2lvbl0gU2V0dGluZyBhdWRpbyBwbGF5YmFjayByYXRlIHRvOicsIHJhdGUsICdhdWRpbyBwYXVzZWQ6JywgYXVkaW8ucGF1c2VkKTtcbiAgICAgIGF1ZGlvLnBsYXliYWNrUmF0ZSA9IHJhdGU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIE5vIGF1ZGlvIGVsZW1lbnQgYXZhaWxhYmxlIHlldCcpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBzdGFydFNlc3Npb24gPSBhc3luYyAoKSA9PiB7XG4gICAgLy8gSW5pdGlhbGl6ZSBhdWRpbyBjYXB0dXJlXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGF1ZGlvUHJvY2Vzc29yLmluaXRpYWxpemUoKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VTZXNzaW9uXSBGYWlsZWQgdG8gaW5pdGlhbGl6ZSBhdWRpbzonLCBlcnJvcik7XG4gICAgfVxuICAgIFxuICAgIC8vIENyZWF0ZSBzZXNzaW9uIG9uIHNlcnZlciBpZiB0cmFja0lkIHByb3ZpZGVkXG4gICAgXG4gICAgaWYgKG9wdGlvbnMudHJhY2tJZCAmJiBvcHRpb25zLnNvbmdEYXRhKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQga2FyYW9rZUFwaS5zdGFydFNlc3Npb24oXG4gICAgICAgICAgb3B0aW9ucy50cmFja0lkLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRpdGxlOiBvcHRpb25zLnNvbmdEYXRhLnRpdGxlLFxuICAgICAgICAgICAgYXJ0aXN0OiBvcHRpb25zLnNvbmdEYXRhLmFydGlzdCxcbiAgICAgICAgICAgIGR1cmF0aW9uOiBvcHRpb25zLnNvbmdEYXRhLmR1cmF0aW9uLFxuICAgICAgICAgICAgZGlmZmljdWx0eTogJ2ludGVybWVkaWF0ZScsIC8vIERlZmF1bHQgZGlmZmljdWx0eVxuICAgICAgICAgIH0sXG4gICAgICAgICAgdW5kZWZpbmVkLCAvLyBhdXRoVG9rZW5cbiAgICAgICAgICBvcHRpb25zLnNvbmdDYXRhbG9nSWQsXG4gICAgICAgICAgcGxheWJhY2tTcGVlZCgpXG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICBpZiAoc2Vzc2lvbikge1xuICAgICAgICAgIHNldFNlc3Npb25JZChzZXNzaW9uLmlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBjcmVhdGUgc2Vzc2lvbicpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBjcmVhdGUgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICB9XG4gICAgXG4gICAgLy8gU3RhcnQgY291bnRkb3duXG4gICAgc2V0Q291bnRkb3duKDMpO1xuICAgIFxuICAgIGNvbnN0IGNvdW50ZG93bkludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudCA9IGNvdW50ZG93bigpO1xuICAgICAgaWYgKGN1cnJlbnQgIT09IG51bGwgJiYgY3VycmVudCA+IDEpIHtcbiAgICAgICAgc2V0Q291bnRkb3duKGN1cnJlbnQgLSAxKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwoY291bnRkb3duSW50ZXJ2YWwpO1xuICAgICAgICBzZXRDb3VudGRvd24obnVsbCk7XG4gICAgICAgIHN0YXJ0UGxheWJhY2soKTtcbiAgICAgIH1cbiAgICB9LCAxMDAwKTtcbiAgfTtcblxuICBjb25zdCBzdGFydFBsYXliYWNrID0gKCkgPT4ge1xuICAgIHNldElzUGxheWluZyh0cnVlKTtcbiAgICBcbiAgICAvLyBTdGFydCBmdWxsIHNlc3Npb24gYXVkaW8gY2FwdHVyZVxuICAgIGF1ZGlvUHJvY2Vzc29yLnN0YXJ0RnVsbFNlc3Npb24oKTtcbiAgICBcbiAgICBjb25zdCBhdWRpbyA9IGF1ZGlvRWxlbWVudCgpIHx8IG9wdGlvbnMuYXVkaW9FbGVtZW50O1xuICAgIGlmIChhdWRpbykge1xuICAgICAgLy8gU2V0IHBsYXliYWNrIHJhdGUgYmFzZWQgb24gY3VycmVudCBzcGVlZFxuICAgICAgY29uc3QgcmF0ZSA9IGdldFBsYXliYWNrUmF0ZShwbGF5YmFja1NwZWVkKCkpO1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlU2Vzc2lvbl0gU3RhcnRpbmcgcGxheWJhY2sgd2l0aCBzcGVlZDonLCBwbGF5YmFja1NwZWVkKCksICdyYXRlOicsIHJhdGUpO1xuICAgICAgYXVkaW8ucGxheWJhY2tSYXRlID0gcmF0ZTtcbiAgICAgIC8vIElmIGF1ZGlvIGVsZW1lbnQgaXMgcHJvdmlkZWQsIHVzZSBpdFxuICAgICAgYXVkaW8ucGxheSgpLmNhdGNoKGNvbnNvbGUuZXJyb3IpO1xuICAgICAgXG4gICAgICBjb25zdCB1cGRhdGVUaW1lID0gKCkgPT4ge1xuICAgICAgICBjb25zdCB0aW1lID0gYXVkaW8uY3VycmVudFRpbWUgKiAxMDAwO1xuICAgICAgICBzZXRDdXJyZW50VGltZSh0aW1lKTtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIHdlIG5lZWQgdG8gc3RhcnQgcmVjb3JkaW5nIGZvciB1cGNvbWluZyBsaW5lc1xuICAgICAgICBjaGVja0ZvclVwY29taW5nTGluZXModGltZSk7XG4gICAgICB9O1xuICAgICAgXG4gICAgICBhdWRpb1VwZGF0ZUludGVydmFsID0gc2V0SW50ZXJ2YWwodXBkYXRlVGltZSwgMTAwKSBhcyB1bmtub3duIGFzIG51bWJlcjtcbiAgICAgIFxuICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCBoYW5kbGVFbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgY2hlY2tGb3JVcGNvbWluZ0xpbmVzID0gKGN1cnJlbnRUaW1lTXM6IG51bWJlcikgPT4ge1xuICAgIGlmIChpc1JlY29yZGluZygpIHx8ICFvcHRpb25zLmx5cmljcy5sZW5ndGgpIHJldHVybjtcbiAgICBcbiAgICBjb25zdCByZWNvcmRlZCA9IHJlY29yZGVkQ2h1bmtzKCk7XG4gICAgXG4gICAgLy8gTG9vayBmb3IgY2h1bmtzIHRoYXQgc2hvdWxkIHN0YXJ0IHJlY29yZGluZyBzb29uXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmx5cmljcy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gU2tpcCBpZiB3ZSd2ZSBhbHJlYWR5IHJlY29yZGVkIGEgY2h1bmsgc3RhcnRpbmcgYXQgdGhpcyBpbmRleFxuICAgICAgaWYgKHJlY29yZGVkLmhhcyhpKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgY2h1bmsgPSBzaG91bGRDaHVua0xpbmVzKG9wdGlvbnMubHlyaWNzLCBpKTtcbiAgICAgIGNvbnN0IGZpcnN0TGluZSA9IG9wdGlvbnMubHlyaWNzW2NodW5rLnN0YXJ0SW5kZXhdO1xuICAgICAgXG4gICAgICBpZiAoZmlyc3RMaW5lICYmIGZpcnN0TGluZS5zdGFydFRpbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCByZWNvcmRpbmdTdGFydFRpbWUgPSBmaXJzdExpbmUuc3RhcnRUaW1lICogMTAwMCAtIDEwMDA7IC8vIFN0YXJ0IDFzIGVhcmx5XG4gICAgICAgIGNvbnN0IGxpbmVTdGFydFRpbWUgPSBmaXJzdExpbmUuc3RhcnRUaW1lICogMTAwMDtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIHdlJ3JlIGluIHRoZSByZWNvcmRpbmcgd2luZG93IGFuZCBoYXZlbid0IHBhc3NlZCB0aGUgbGluZSBzdGFydFxuICAgICAgICBpZiAoY3VycmVudFRpbWVNcyA+PSByZWNvcmRpbmdTdGFydFRpbWUgJiYgY3VycmVudFRpbWVNcyA8IGxpbmVTdGFydFRpbWUgKyA1MDApIHsgLy8gQWxsb3cgNTAwbXMgYnVmZmVyIGFmdGVyIGxpbmUgc3RhcnRcbiAgICAgICAgICAvLyBNYXJrIHRoaXMgY2h1bmsgYXMgcmVjb3JkZWRcbiAgICAgICAgICBzZXRSZWNvcmRlZENodW5rcyhwcmV2ID0+IG5ldyBTZXQocHJldikuYWRkKGNodW5rLnN0YXJ0SW5kZXgpKTtcbiAgICAgICAgICAvLyBTdGFydCByZWNvcmRpbmcgdGhpcyBjaHVua1xuICAgICAgICAgIHN0YXJ0UmVjb3JkaW5nQ2h1bmsoY2h1bmspO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFNraXAgYWhlYWQgdG8gYXZvaWQgY2hlY2tpbmcgbGluZXMgd2UndmUgYWxyZWFkeSBwYXNzZWRcbiAgICAgIGkgPSBjaHVuay5lbmRJbmRleDtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBzdGFydFJlY29yZGluZ0NodW5rID0gYXN5bmMgKGNodW5rOiBDaHVua0luZm8pID0+IHtcbiAgICAvLyBURVNUSU5HIE1PREU6IEF1dG8tY29tcGxldGUgYWZ0ZXIgNSBsaW5lc1xuICAgIGlmIChjaHVuay5zdGFydEluZGV4ID49IDUpIHtcbiAgICAgIGhhbmRsZUVuZCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICBzZXRDdXJyZW50Q2h1bmsoY2h1bmspO1xuICAgIHNldElzUmVjb3JkaW5nKHRydWUpO1xuICAgIFxuICAgIC8vIFN0YXJ0IGF1ZGlvIGNhcHR1cmUgZm9yIHRoaXMgY2h1bmtcbiAgICBhdWRpb1Byb2Nlc3Nvci5zdGFydFJlY29yZGluZ0xpbmUoY2h1bmsuc3RhcnRJbmRleCk7XG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlIHJlY29yZGluZyBkdXJhdGlvbiBhZGp1c3RlZCBmb3IgcGxheWJhY2sgc3BlZWRcbiAgICBjb25zdCBiYXNlRHVyYXRpb24gPSBjYWxjdWxhdGVSZWNvcmRpbmdEdXJhdGlvbihvcHRpb25zLmx5cmljcywgY2h1bmspO1xuICAgIGNvbnN0IHNwZWVkRmFjdG9yID0gMSAvIGdldFBsYXliYWNrUmF0ZShwbGF5YmFja1NwZWVkKCkpOyAvLyBJbnZlcnNlIG9mIHBsYXliYWNrIHJhdGVcbiAgICBjb25zdCBkdXJhdGlvbiA9IGJhc2VEdXJhdGlvbiAqIHNwZWVkRmFjdG9yO1xuICAgIFxuICAgIC8vIFN0b3AgcmVjb3JkaW5nIGFmdGVyIGR1cmF0aW9uXG4gICAgcmVjb3JkaW5nVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgc3RvcFJlY29yZGluZ0NodW5rKCk7XG4gICAgfSwgZHVyYXRpb24pIGFzIHVua25vd24gYXMgbnVtYmVyO1xuICB9O1xuICBcbiAgY29uc3Qgc3RvcFJlY29yZGluZ0NodW5rID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IGNodW5rID0gY3VycmVudENodW5rKCk7XG4gICAgaWYgKCFjaHVuaykgcmV0dXJuO1xuICAgIFxuICAgIHNldElzUmVjb3JkaW5nKGZhbHNlKTtcbiAgICBcbiAgICAvLyBHZXQgdGhlIHJlY29yZGVkIGF1ZGlvXG4gICAgY29uc3QgYXVkaW9DaHVua3MgPSBhdWRpb1Byb2Nlc3Nvci5zdG9wUmVjb3JkaW5nTGluZUFuZEdldFJhd0F1ZGlvKCk7XG4gICAgY29uc3Qgd2F2QmxvYiA9IGF1ZGlvUHJvY2Vzc29yLmNvbnZlcnRBdWRpb1RvV2F2QmxvYihhdWRpb0NodW5rcyk7XG4gICAgXG4gICAgXG4gICAgLy8gQ2hlY2sgaWYgd2UgaGF2ZSBlbm91Z2ggYXVkaW8gZGF0YVxuICAgIGlmICh3YXZCbG9iICYmIHdhdkJsb2Iuc2l6ZSA+IDEwMDAgJiYgc2Vzc2lvbklkKCkpIHsgLy8gTWluaW11bSAxS0Igb2YgYXVkaW8gZGF0YVxuICAgICAgLy8gQ29udmVydCB0byBiYXNlNjQgZm9yIEFQSVxuICAgICAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGJhc2U2NEF1ZGlvID0gcmVhZGVyLnJlc3VsdD8udG9TdHJpbmcoKS5zcGxpdCgnLCcpWzFdO1xuICAgICAgICBpZiAoYmFzZTY0QXVkaW8gJiYgYmFzZTY0QXVkaW8ubGVuZ3RoID4gMTAwKSB7IC8vIEVuc3VyZSB3ZSBoYXZlIG1lYW5pbmdmdWwgYmFzZTY0IGRhdGFcbiAgICAgICAgICBhd2FpdCBncmFkZUNodW5rKGNodW5rLCBiYXNlNjRBdWRpbyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB9XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwod2F2QmxvYik7XG4gICAgfSBlbHNlIGlmICh3YXZCbG9iICYmIHdhdkJsb2Iuc2l6ZSA8PSAxMDAwKSB7XG4gICAgICAvLyBBZGQgYSBuZXV0cmFsIHNjb3JlIGZvciBVSSBmZWVkYmFja1xuICAgICAgc2V0TGluZVNjb3JlcyhwcmV2ID0+IFsuLi5wcmV2LCB7XG4gICAgICAgIGxpbmVJbmRleDogY2h1bmsuc3RhcnRJbmRleCxcbiAgICAgICAgc2NvcmU6IDUwLFxuICAgICAgICB0cmFuc2NyaXB0aW9uOiAnJyxcbiAgICAgICAgZmVlZGJhY2s6ICdSZWNvcmRpbmcgdG9vIHNob3J0J1xuICAgICAgfV0pO1xuICAgIH0gZWxzZSBpZiAod2F2QmxvYiAmJiAhc2Vzc2lvbklkKCkpIHtcbiAgICB9XG4gICAgXG4gICAgc2V0Q3VycmVudENodW5rKG51bGwpO1xuICAgIFxuICAgIGlmIChyZWNvcmRpbmdUaW1lb3V0KSB7XG4gICAgICBjbGVhclRpbWVvdXQocmVjb3JkaW5nVGltZW91dCk7XG4gICAgICByZWNvcmRpbmdUaW1lb3V0ID0gbnVsbDtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBncmFkZUNodW5rID0gYXN5bmMgKGNodW5rOiBDaHVua0luZm8sIGF1ZGlvQmFzZTY0OiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjdXJyZW50U2Vzc2lvbklkID0gc2Vzc2lvbklkKCk7XG4gICAgXG4gICAgaWYgKCFjdXJyZW50U2Vzc2lvbklkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBsaW5lU2NvcmUgPSBhd2FpdCBrYXJhb2tlQXBpLmdyYWRlUmVjb3JkaW5nKFxuICAgICAgICBjdXJyZW50U2Vzc2lvbklkLFxuICAgICAgICBjaHVuay5zdGFydEluZGV4LFxuICAgICAgICBhdWRpb0Jhc2U2NCxcbiAgICAgICAgY2h1bmsuZXhwZWN0ZWRUZXh0LFxuICAgICAgICBvcHRpb25zLmx5cmljc1tjaHVuay5zdGFydEluZGV4XT8uc3RhcnRUaW1lIHx8IDAsXG4gICAgICAgIChvcHRpb25zLmx5cmljc1tjaHVuay5lbmRJbmRleF0/LnN0YXJ0VGltZSB8fCAwKSArIChvcHRpb25zLmx5cmljc1tjaHVuay5lbmRJbmRleF0/LmR1cmF0aW9uIHx8IDApIC8gMTAwMCxcbiAgICAgICAgdW5kZWZpbmVkLCAvLyBhdXRoVG9rZW5cbiAgICAgICAgcGxheWJhY2tTcGVlZCgpXG4gICAgICApO1xuICAgICAgXG4gICAgICBpZiAobGluZVNjb3JlKSB7XG4gICAgICAgIFxuICAgICAgICAvLyBBcHBseSBzcGVlZCBtdWx0aXBsaWVyIHRvIHNjb3JlIGZvciBsYW5ndWFnZSBsZWFybmVyc1xuICAgICAgICBjb25zdCBzcGVlZE11bHRpcGxpZXIgPSBnZXRTcGVlZE11bHRpcGxpZXIocGxheWJhY2tTcGVlZCgpKTtcbiAgICAgICAgY29uc3QgYWRqdXN0ZWRTY29yZSA9IE1hdGgubWluKDEwMCwgTWF0aC5yb3VuZChsaW5lU2NvcmUuc2NvcmUgKiBzcGVlZE11bHRpcGxpZXIpKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFVwZGF0ZSBsaW5lIHNjb3Jlc1xuICAgICAgICBjb25zdCBuZXdMaW5lU2NvcmUgPSB7XG4gICAgICAgICAgbGluZUluZGV4OiBjaHVuay5zdGFydEluZGV4LFxuICAgICAgICAgIHNjb3JlOiBhZGp1c3RlZFNjb3JlLFxuICAgICAgICAgIHRyYW5zY3JpcHRpb246IGxpbmVTY29yZS50cmFuc2NyaXB0IHx8ICcnLFxuICAgICAgICAgIGZlZWRiYWNrOiBsaW5lU2NvcmUuZmVlZGJhY2tcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIHNldExpbmVTY29yZXMocHJldiA9PiBbLi4ucHJldiwgbmV3TGluZVNjb3JlXSk7XG4gICAgICAgIFxuICAgICAgICAvLyBVcGRhdGUgdG90YWwgc2NvcmUgKHNpbXBsZSBhdmVyYWdlIGZvciBub3cpIC0gdXNlIHByZXYgdG8gYXZvaWQgZGVwZW5kZW5jeVxuICAgICAgICBzZXRTY29yZShwcmV2ID0+IHtcbiAgICAgICAgICBjb25zdCBhbGxTY29yZXMgPSBbLi4ubGluZVNjb3JlcygpLCBuZXdMaW5lU2NvcmVdO1xuICAgICAgICAgIGNvbnN0IGF2Z1Njb3JlID0gYWxsU2NvcmVzLnJlZHVjZSgoc3VtLCBzKSA9PiBzdW0gKyBzLnNjb3JlLCAwKSAvIGFsbFNjb3Jlcy5sZW5ndGg7XG4gICAgICAgICAgcmV0dXJuIE1hdGgucm91bmQoYXZnU2NvcmUpO1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIC8vIFJlbW92ZWQgdGVzdCBtb2RlIGxpbWl0XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBcbiAgICAgICAgLy8gQWRkIGEgbmV1dHJhbCBzY29yZSBmb3IgVUkgZmVlZGJhY2tcbiAgICAgICAgc2V0TGluZVNjb3JlcyhwcmV2ID0+IFsuLi5wcmV2LCB7XG4gICAgICAgICAgbGluZUluZGV4OiBjaHVuay5zdGFydEluZGV4LFxuICAgICAgICAgIHNjb3JlOiA1MCwgLy8gTmV1dHJhbCBzY29yZVxuICAgICAgICAgIHRyYW5zY3JpcHRpb246ICcnLFxuICAgICAgICAgIGZlZWRiYWNrOiAnRmFpbGVkIHRvIGdyYWRlIHJlY29yZGluZydcbiAgICAgICAgfV0pO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBncmFkZSBjaHVuazonLCBlcnJvcik7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUVuZCA9IGFzeW5jICgpID0+IHtcbiAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgIGlmIChhdWRpb1VwZGF0ZUludGVydmFsKSB7XG4gICAgICBjbGVhckludGVydmFsKGF1ZGlvVXBkYXRlSW50ZXJ2YWwpO1xuICAgIH1cbiAgICBcbiAgICAvLyBQYXVzZSB0aGUgYXVkaW9cbiAgICBjb25zdCBhdWRpbyA9IGF1ZGlvRWxlbWVudCgpIHx8IG9wdGlvbnMuYXVkaW9FbGVtZW50O1xuICAgIGlmIChhdWRpbyAmJiAhYXVkaW8ucGF1c2VkKSB7XG4gICAgICBhdWRpby5wYXVzZSgpO1xuICAgIH1cbiAgICBcbiAgICAvLyBTdG9wIGFueSBvbmdvaW5nIHJlY29yZGluZ1xuICAgIGlmIChpc1JlY29yZGluZygpKSB7XG4gICAgICBhd2FpdCBzdG9wUmVjb3JkaW5nQ2h1bmsoKTtcbiAgICB9XG4gICAgXG4gICAgLy8gU2hvdyBsb2FkaW5nIHN0YXRlIGltbWVkaWF0ZWx5XG4gICAgY29uc3QgbG9hZGluZ1Jlc3VsdHM6IEthcmFva2VSZXN1bHRzID0ge1xuICAgICAgc2NvcmU6IC0xLCAvLyBTcGVjaWFsIHZhbHVlIHRvIGluZGljYXRlIGxvYWRpbmdcbiAgICAgIGFjY3VyYWN5OiAwLFxuICAgICAgdG90YWxMaW5lczogbGluZVNjb3JlcygpLmxlbmd0aCxcbiAgICAgIHBlcmZlY3RMaW5lczogMCxcbiAgICAgIGdvb2RMaW5lczogMCxcbiAgICAgIG5lZWRzV29ya0xpbmVzOiAwLFxuICAgICAgc2Vzc2lvbklkOiBzZXNzaW9uSWQoKSB8fCB1bmRlZmluZWQsXG4gICAgICBpc0xvYWRpbmc6IHRydWVcbiAgICB9O1xuICAgIG9wdGlvbnMub25Db21wbGV0ZT8uKGxvYWRpbmdSZXN1bHRzKTtcbiAgICBcbiAgICAvLyBHZXQgZnVsbCBzZXNzaW9uIGF1ZGlvXG4gICAgY29uc3QgZnVsbEF1ZGlvQmxvYiA9IGF1ZGlvUHJvY2Vzc29yLnN0b3BGdWxsU2Vzc2lvbkFuZEdldFdhdigpO1xuICAgIFxuICAgIC8vIENvbXBsZXRlIHNlc3Npb24gb24gc2VydmVyXG4gICAgY29uc3QgY3VycmVudFNlc3Npb25JZCA9IHNlc3Npb25JZCgpO1xuICAgIGlmIChjdXJyZW50U2Vzc2lvbklkICYmIGZ1bGxBdWRpb0Jsb2IgJiYgZnVsbEF1ZGlvQmxvYi5zaXplID4gMTAwMCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgICAgcmVhZGVyLm9ubG9hZGVuZCA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zdCBiYXNlNjRBdWRpbyA9IHJlYWRlci5yZXN1bHQ/LnRvU3RyaW5nKCkuc3BsaXQoJywnKVsxXTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBzZXNzaW9uUmVzdWx0cyA9IGF3YWl0IGthcmFva2VBcGkuY29tcGxldGVTZXNzaW9uKFxuICAgICAgICAgICAgY3VycmVudFNlc3Npb25JZCxcbiAgICAgICAgICAgIGJhc2U2NEF1ZGlvXG4gICAgICAgICAgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoc2Vzc2lvblJlc3VsdHMpIHtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgcmVzdWx0czogS2FyYW9rZVJlc3VsdHMgPSB7XG4gICAgICAgICAgICAgIHNjb3JlOiBzZXNzaW9uUmVzdWx0cy5maW5hbFNjb3JlLFxuICAgICAgICAgICAgICBhY2N1cmFjeTogc2Vzc2lvblJlc3VsdHMuYWNjdXJhY3ksXG4gICAgICAgICAgICAgIHRvdGFsTGluZXM6IHNlc3Npb25SZXN1bHRzLnRvdGFsTGluZXMsXG4gICAgICAgICAgICAgIHBlcmZlY3RMaW5lczogc2Vzc2lvblJlc3VsdHMucGVyZmVjdExpbmVzLFxuICAgICAgICAgICAgICBnb29kTGluZXM6IHNlc3Npb25SZXN1bHRzLmdvb2RMaW5lcyxcbiAgICAgICAgICAgICAgbmVlZHNXb3JrTGluZXM6IHNlc3Npb25SZXN1bHRzLm5lZWRzV29ya0xpbmVzLFxuICAgICAgICAgICAgICBzZXNzaW9uSWQ6IGN1cnJlbnRTZXNzaW9uSWRcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIG9wdGlvbnMub25Db21wbGV0ZT8uKHJlc3VsdHMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBsb2NhbCBjYWxjdWxhdGlvblxuICAgICAgICAgICAgY2FsY3VsYXRlTG9jYWxSZXN1bHRzKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICByZWFkZXIucmVhZEFzRGF0YVVSTChmdWxsQXVkaW9CbG9iKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIGNvbXBsZXRlIHNlc3Npb246JywgZXJyb3IpO1xuICAgICAgICBjYWxjdWxhdGVMb2NhbFJlc3VsdHMoKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm8gc2Vzc2lvbiwganVzdCByZXR1cm4gbG9jYWwgcmVzdWx0c1xuICAgICAgY2FsY3VsYXRlTG9jYWxSZXN1bHRzKCk7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgY2FsY3VsYXRlTG9jYWxSZXN1bHRzID0gKCkgPT4ge1xuICAgIGNvbnN0IHNjb3JlcyA9IGxpbmVTY29yZXMoKTtcbiAgICBjb25zdCBhdmdTY29yZSA9IHNjb3Jlcy5sZW5ndGggPiAwIFxuICAgICAgPyBzY29yZXMucmVkdWNlKChzdW0sIHMpID0+IHN1bSArIHMuc2NvcmUsIDApIC8gc2NvcmVzLmxlbmd0aFxuICAgICAgOiAwO1xuICAgIFxuICAgIGNvbnN0IHJlc3VsdHM6IEthcmFva2VSZXN1bHRzID0ge1xuICAgICAgc2NvcmU6IE1hdGgucm91bmQoYXZnU2NvcmUpLFxuICAgICAgYWNjdXJhY3k6IE1hdGgucm91bmQoYXZnU2NvcmUpLFxuICAgICAgdG90YWxMaW5lczogc2NvcmVzLmxlbmd0aCwgLy8gVXNlIGFjdHVhbCBjb21wbGV0ZWQgbGluZXMgZm9yIHRlc3QgbW9kZVxuICAgICAgcGVyZmVjdExpbmVzOiBzY29yZXMuZmlsdGVyKHMgPT4gcy5zY29yZSA+PSA5MCkubGVuZ3RoLFxuICAgICAgZ29vZExpbmVzOiBzY29yZXMuZmlsdGVyKHMgPT4gcy5zY29yZSA+PSA3MCAmJiBzLnNjb3JlIDwgOTApLmxlbmd0aCxcbiAgICAgIG5lZWRzV29ya0xpbmVzOiBzY29yZXMuZmlsdGVyKHMgPT4gcy5zY29yZSA8IDcwKS5sZW5ndGgsXG4gICAgICBzZXNzaW9uSWQ6IHNlc3Npb25JZCgpIHx8IHVuZGVmaW5lZFxuICAgIH07XG4gICAgXG4gICAgb3B0aW9ucy5vbkNvbXBsZXRlPy4ocmVzdWx0cyk7XG4gIH07XG5cbiAgY29uc3Qgc3RvcFNlc3Npb24gPSAoKSA9PiB7XG4gICAgc2V0SXNQbGF5aW5nKGZhbHNlKTtcbiAgICBzZXRDb3VudGRvd24obnVsbCk7XG4gICAgc2V0SXNSZWNvcmRpbmcoZmFsc2UpO1xuICAgIHNldEN1cnJlbnRDaHVuayhudWxsKTtcbiAgICBzZXRSZWNvcmRlZENodW5rcyhuZXcgU2V0PG51bWJlcj4oKSk7XG4gICAgXG4gICAgaWYgKGF1ZGlvVXBkYXRlSW50ZXJ2YWwpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwoYXVkaW9VcGRhdGVJbnRlcnZhbCk7XG4gICAgICBhdWRpb1VwZGF0ZUludGVydmFsID0gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgaWYgKHJlY29yZGluZ1RpbWVvdXQpIHtcbiAgICAgIGNsZWFyVGltZW91dChyZWNvcmRpbmdUaW1lb3V0KTtcbiAgICAgIHJlY29yZGluZ1RpbWVvdXQgPSBudWxsO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBhdWRpbyA9IGF1ZGlvRWxlbWVudCgpIHx8IG9wdGlvbnMuYXVkaW9FbGVtZW50O1xuICAgIGlmIChhdWRpbykge1xuICAgICAgYXVkaW8ucGF1c2UoKTtcbiAgICAgIGF1ZGlvLmN1cnJlbnRUaW1lID0gMDtcbiAgICAgIGF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgaGFuZGxlRW5kKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ2xlYW51cCBhdWRpbyBwcm9jZXNzb3JcbiAgICBhdWRpb1Byb2Nlc3Nvci5jbGVhbnVwKCk7XG4gIH07XG5cbiAgb25DbGVhbnVwKCgpID0+IHtcbiAgICBzdG9wU2Vzc2lvbigpO1xuICB9KTtcblxuICByZXR1cm4ge1xuICAgIC8vIFN0YXRlXG4gICAgaXNQbGF5aW5nLFxuICAgIGN1cnJlbnRUaW1lLFxuICAgIHNjb3JlLFxuICAgIGNvdW50ZG93bixcbiAgICBzZXNzaW9uSWQsXG4gICAgbGluZVNjb3JlcyxcbiAgICBpc1JlY29yZGluZyxcbiAgICBjdXJyZW50Q2h1bmssXG4gICAgcGxheWJhY2tTcGVlZCxcbiAgICBcbiAgICAvLyBBY3Rpb25zXG4gICAgc3RhcnRTZXNzaW9uLFxuICAgIHN0b3BTZXNzaW9uLFxuICAgIGhhbmRsZVNwZWVkQ2hhbmdlLFxuICAgIFxuICAgIC8vIEF1ZGlvIHByb2Nlc3NvciAoZm9yIGRpcmVjdCBhY2Nlc3MgaWYgbmVlZGVkKVxuICAgIGF1ZGlvUHJvY2Vzc29yLFxuICAgIFxuICAgIC8vIE1ldGhvZCB0byB1cGRhdGUgYXVkaW8gZWxlbWVudCBhZnRlciBpbml0aWFsaXphdGlvblxuICAgIHNldEF1ZGlvRWxlbWVudDogKGVsZW1lbnQ6IEhUTUxBdWRpb0VsZW1lbnQgfCB1bmRlZmluZWQpID0+IHtcbiAgICAgIHNldEF1ZGlvRWxlbWVudChlbGVtZW50KTtcbiAgICAgIC8vIEFwcGx5IGN1cnJlbnQgcGxheWJhY2sgcmF0ZSB0byBuZXcgYXVkaW8gZWxlbWVudFxuICAgICAgaWYgKGVsZW1lbnQpIHtcbiAgICAgICAgZWxlbWVudC5wbGF5YmFja1JhdGUgPSBnZXRQbGF5YmFja1JhdGUocGxheWJhY2tTcGVlZCgpKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59IiwiZXhwb3J0IGludGVyZmFjZSBUcmFja0luZm8ge1xuICB0cmFja0lkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGFydGlzdDogc3RyaW5nO1xuICBwbGF0Zm9ybTogJ3NvdW5kY2xvdWQnO1xuICB1cmw6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFRyYWNrRGV0ZWN0b3Ige1xuICAvKipcbiAgICogRGV0ZWN0IGN1cnJlbnQgdHJhY2sgZnJvbSB0aGUgcGFnZSAoU291bmRDbG91ZCBvbmx5KVxuICAgKi9cbiAgZGV0ZWN0Q3VycmVudFRyYWNrKCk6IFRyYWNrSW5mbyB8IG51bGwge1xuICAgIGNvbnN0IHVybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICAgIFxuICAgIC8vIE9ubHkgd29yayBvbiBzYy5tYWlkLnpvbmUgKFNvdW5kQ2xvdWQgcHJveHkpXG4gICAgaWYgKHVybC5pbmNsdWRlcygnc2MubWFpZC56b25lJykpIHtcbiAgICAgIHJldHVybiB0aGlzLmRldGVjdFNvdW5kQ2xvdWRUcmFjaygpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIEV4dHJhY3QgdHJhY2sgaW5mbyBmcm9tIFNvdW5kQ2xvdWQgKHNjLm1haWQuem9uZSlcbiAgICovXG4gIHByaXZhdGUgZGV0ZWN0U291bmRDbG91ZFRyYWNrKCk6IFRyYWNrSW5mbyB8IG51bGwge1xuICAgIHRyeSB7XG4gICAgICAvLyBTb3VuZENsb3VkIFVSTHM6IHNjLm1haWQuem9uZS91c2VyL3RyYWNrLW5hbWVcbiAgICAgIGNvbnN0IHBhdGhQYXJ0cyA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5zcGxpdCgnLycpLmZpbHRlcihCb29sZWFuKTtcbiAgICAgIGlmIChwYXRoUGFydHMubGVuZ3RoIDwgMikgcmV0dXJuIG51bGw7XG5cbiAgICAgIGNvbnN0IGFydGlzdFBhdGggPSBwYXRoUGFydHNbMF07XG4gICAgICBjb25zdCB0cmFja1NsdWcgPSBwYXRoUGFydHNbMV07XG4gICAgICBcbiAgICAgIC8vIFRyeSB0byBnZXQgYWN0dWFsIHRpdGxlIGZyb20gcGFnZVxuICAgICAgbGV0IHRpdGxlID0gJyc7XG4gICAgICBcbiAgICAgIC8vIEZvciBzb3VuZGNsb2FrLCBsb29rIGZvciBoMSBhZnRlciB0aGUgaW1hZ2VcbiAgICAgIGNvbnN0IGgxRWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdoMScpO1xuICAgICAgZm9yIChjb25zdCBoMSBvZiBoMUVsZW1lbnRzKSB7XG4gICAgICAgIC8vIFNraXAgdGhlIFwic291bmRjbG9ha1wiIGhlYWRlclxuICAgICAgICBpZiAoaDEudGV4dENvbnRlbnQ/LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3NvdW5kY2xvYWsnKSkgY29udGludWU7XG4gICAgICAgIHRpdGxlID0gaDEudGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJztcbiAgICAgICAgaWYgKHRpdGxlKSBicmVhaztcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gRmFsbGJhY2sgdG8gc2x1Z1xuICAgICAgaWYgKCF0aXRsZSkge1xuICAgICAgICB0aXRsZSA9IHRyYWNrU2x1Zy5yZXBsYWNlKC8tL2csICcgJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFRyeSB0byBnZXQgYWN0dWFsIGFydGlzdCBuYW1lIGZyb20gcGFnZVxuICAgICAgbGV0IGFydGlzdCA9ICcnO1xuICAgICAgXG4gICAgICAvLyBMb29rIGZvciBhcnRpc3QgbGluayB3aXRoIG1ldGEgY2xhc3NcbiAgICAgIGNvbnN0IGFydGlzdExpbmsgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdhLmxpc3RpbmcgLm1ldGEgaDMnKTtcbiAgICAgIGlmIChhcnRpc3RMaW5rICYmIGFydGlzdExpbmsudGV4dENvbnRlbnQpIHtcbiAgICAgICAgYXJ0aXN0ID0gYXJ0aXN0TGluay50ZXh0Q29udGVudC50cmltKCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEZhbGxiYWNrOiB0cnkgcGFnZSB0aXRsZVxuICAgICAgaWYgKCFhcnRpc3QpIHtcbiAgICAgICAgY29uc3QgcGFnZVRpdGxlID0gZG9jdW1lbnQudGl0bGU7XG4gICAgICAgIC8vIFRpdGxlIGZvcm1hdDogXCJTb25nIGJ5IEFydGlzdCB+IHNvdW5kY2xvYWtcIlxuICAgICAgICBjb25zdCBtYXRjaCA9IHBhZ2VUaXRsZS5tYXRjaCgvYnlcXHMrKC4rPylcXHMqfi8pO1xuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICBhcnRpc3QgPSBtYXRjaFsxXS50cmltKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gRmluYWwgZmFsbGJhY2sgdG8gVVJMXG4gICAgICBpZiAoIWFydGlzdCkge1xuICAgICAgICBhcnRpc3QgPSBhcnRpc3RQYXRoLnJlcGxhY2UoLy0vZywgJyAnKS5yZXBsYWNlKC9fL2csICcgJyk7XG4gICAgICB9XG5cbiAgICAgIGNvbnNvbGUubG9nKCdbVHJhY2tEZXRlY3Rvcl0gRGV0ZWN0ZWQgdHJhY2s6JywgeyB0aXRsZSwgYXJ0aXN0LCBhcnRpc3RQYXRoLCB0cmFja1NsdWcgfSk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRyYWNrSWQ6IGAke2FydGlzdFBhdGh9LyR7dHJhY2tTbHVnfWAsXG4gICAgICAgIHRpdGxlOiB0aXRsZSxcbiAgICAgICAgYXJ0aXN0OiBhcnRpc3QsXG4gICAgICAgIHBsYXRmb3JtOiAnc291bmRjbG91ZCcsXG4gICAgICAgIHVybDogd2luZG93LmxvY2F0aW9uLmhyZWYsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbVHJhY2tEZXRlY3Rvcl0gRXJyb3IgZGV0ZWN0aW5nIFNvdW5kQ2xvdWQgdHJhY2s6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cblxuICAvKipcbiAgICogV2F0Y2ggZm9yIHBhZ2UgY2hhbmdlcyAoU291bmRDbG91ZCBpcyBhIFNQQSlcbiAgICovXG4gIHdhdGNoRm9yQ2hhbmdlcyhjYWxsYmFjazogKHRyYWNrOiBUcmFja0luZm8gfCBudWxsKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XG4gICAgbGV0IGN1cnJlbnRVcmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICBsZXQgY3VycmVudFRyYWNrID0gdGhpcy5kZXRlY3RDdXJyZW50VHJhY2soKTtcbiAgICBcbiAgICAvLyBJbml0aWFsIGRldGVjdGlvblxuICAgIGNhbGxiYWNrKGN1cnJlbnRUcmFjayk7XG5cbiAgICAvLyBXYXRjaCBmb3IgVVJMIGNoYW5nZXNcbiAgICBjb25zdCBjaGVja0ZvckNoYW5nZXMgPSAoKSA9PiB7XG4gICAgICBjb25zdCBuZXdVcmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICAgIGlmIChuZXdVcmwgIT09IGN1cnJlbnRVcmwpIHtcbiAgICAgICAgY3VycmVudFVybCA9IG5ld1VybDtcbiAgICAgICAgY29uc3QgbmV3VHJhY2sgPSB0aGlzLmRldGVjdEN1cnJlbnRUcmFjaygpO1xuICAgICAgICBcbiAgICAgICAgLy8gT25seSB0cmlnZ2VyIGNhbGxiYWNrIGlmIHRyYWNrIGFjdHVhbGx5IGNoYW5nZWRcbiAgICAgICAgY29uc3QgdHJhY2tDaGFuZ2VkID0gIWN1cnJlbnRUcmFjayB8fCAhbmV3VHJhY2sgfHwgXG4gICAgICAgICAgY3VycmVudFRyYWNrLnRyYWNrSWQgIT09IG5ld1RyYWNrLnRyYWNrSWQ7XG4gICAgICAgICAgXG4gICAgICAgIGlmICh0cmFja0NoYW5nZWQpIHtcbiAgICAgICAgICBjdXJyZW50VHJhY2sgPSBuZXdUcmFjaztcbiAgICAgICAgICBjYWxsYmFjayhuZXdUcmFjayk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gUG9sbCBmb3IgY2hhbmdlcyAoU1BBcyBkb24ndCBhbHdheXMgdHJpZ2dlciBwcm9wZXIgbmF2aWdhdGlvbiBldmVudHMpXG4gICAgY29uc3QgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChjaGVja0ZvckNoYW5nZXMsIDEwMDApO1xuXG4gICAgLy8gQWxzbyBsaXN0ZW4gZm9yIG5hdmlnYXRpb24gZXZlbnRzXG4gICAgY29uc3QgaGFuZGxlTmF2aWdhdGlvbiA9ICgpID0+IHtcbiAgICAgIHNldFRpbWVvdXQoY2hlY2tGb3JDaGFuZ2VzLCAxMDApOyAvLyBTbWFsbCBkZWxheSBmb3IgRE9NIHVwZGF0ZXNcbiAgICB9O1xuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgaGFuZGxlTmF2aWdhdGlvbik7XG4gICAgXG4gICAgLy8gTGlzdGVuIGZvciBwdXNoc3RhdGUvcmVwbGFjZXN0YXRlIChTb3VuZENsb3VkIHVzZXMgdGhlc2UpXG4gICAgY29uc3Qgb3JpZ2luYWxQdXNoU3RhdGUgPSBoaXN0b3J5LnB1c2hTdGF0ZTtcbiAgICBjb25zdCBvcmlnaW5hbFJlcGxhY2VTdGF0ZSA9IGhpc3RvcnkucmVwbGFjZVN0YXRlO1xuICAgIFxuICAgIGhpc3RvcnkucHVzaFN0YXRlID0gZnVuY3Rpb24oLi4uYXJncykge1xuICAgICAgb3JpZ2luYWxQdXNoU3RhdGUuYXBwbHkoaGlzdG9yeSwgYXJncyk7XG4gICAgICBoYW5kbGVOYXZpZ2F0aW9uKCk7XG4gICAgfTtcbiAgICBcbiAgICBoaXN0b3J5LnJlcGxhY2VTdGF0ZSA9IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICAgIG9yaWdpbmFsUmVwbGFjZVN0YXRlLmFwcGx5KGhpc3RvcnksIGFyZ3MpO1xuICAgICAgaGFuZGxlTmF2aWdhdGlvbigpO1xuICAgIH07XG5cbiAgICAvLyBSZXR1cm4gY2xlYW51cCBmdW5jdGlvblxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb3BzdGF0ZScsIGhhbmRsZU5hdmlnYXRpb24pO1xuICAgICAgaGlzdG9yeS5wdXNoU3RhdGUgPSBvcmlnaW5hbFB1c2hTdGF0ZTtcbiAgICAgIGhpc3RvcnkucmVwbGFjZVN0YXRlID0gb3JpZ2luYWxSZXBsYWNlU3RhdGU7XG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgdHJhY2tEZXRlY3RvciA9IG5ldyBUcmFja0RldGVjdG9yKCk7IiwiLy8gVXNpbmcgYnJvd3Nlci5zdG9yYWdlIEFQSSBkaXJlY3RseSBmb3Igc2ltcGxpY2l0eVxuaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gJ3d4dC9icm93c2VyJztcblxuLy8gSGVscGVyIHRvIGdldCBhdXRoIHRva2VuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0QXV0aFRva2VuKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuZ2V0KCdhdXRoVG9rZW4nKTtcbiAgcmV0dXJuIHJlc3VsdC5hdXRoVG9rZW4gfHwgbnVsbDtcbn1cblxuLy8gSGVscGVyIHRvIHNldCBhdXRoIHRva2VuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0QXV0aFRva2VuKHRva2VuOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnNldCh7IGF1dGhUb2tlbjogdG9rZW4gfSk7XG59XG5cbi8vIEhlbHBlciB0byBnZXQgaW5zdGFsbGF0aW9uIHN0YXRlXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0SW5zdGFsbGF0aW9uU3RhdGUoKTogUHJvbWlzZTx7XG4gIGNvbXBsZXRlZDogYm9vbGVhbjtcbiAgand0VmVyaWZpZWQ6IGJvb2xlYW47XG4gIHRpbWVzdGFtcD86IG51bWJlcjtcbn0+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLmdldCgnaW5zdGFsbGF0aW9uU3RhdGUnKTtcbiAgcmV0dXJuIHJlc3VsdC5pbnN0YWxsYXRpb25TdGF0ZSB8fCB7XG4gICAgY29tcGxldGVkOiBmYWxzZSxcbiAgICBqd3RWZXJpZmllZDogZmFsc2UsXG4gIH07XG59XG5cbi8vIEhlbHBlciB0byBzZXQgaW5zdGFsbGF0aW9uIHN0YXRlXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0SW5zdGFsbGF0aW9uU3RhdGUoc3RhdGU6IHtcbiAgY29tcGxldGVkOiBib29sZWFuO1xuICBqd3RWZXJpZmllZDogYm9vbGVhbjtcbiAgdGltZXN0YW1wPzogbnVtYmVyO1xufSk6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuc2V0KHsgaW5zdGFsbGF0aW9uU3RhdGU6IHN0YXRlIH0pO1xufVxuXG4vLyBIZWxwZXIgdG8gY2hlY2sgaWYgdXNlciBpcyBhdXRoZW50aWNhdGVkXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaXNBdXRoZW50aWNhdGVkKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBjb25zdCB0b2tlbiA9IGF3YWl0IGdldEF1dGhUb2tlbigpO1xuICByZXR1cm4gISF0b2tlbiAmJiB0b2tlbi5zdGFydHNXaXRoKCdzY2FybGV0dF8nKTtcbn1cblxuLy8gSGVscGVyIHRvIGNsZWFyIGF1dGggZGF0YVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNsZWFyQXV0aCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnJlbW92ZShbJ2F1dGhUb2tlbicsICdpbnN0YWxsYXRpb25TdGF0ZSddKTtcbn0iLCJleHBvcnQgaW50ZXJmYWNlIEthcmFva2VEYXRhIHtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgdHJhY2tfaWQ/OiBzdHJpbmc7XG4gIHRyYWNrSWQ/OiBzdHJpbmc7XG4gIGhhc19rYXJhb2tlPzogYm9vbGVhbjtcbiAgaGFzS2FyYW9rZT86IGJvb2xlYW47XG4gIHNvbmc/OiB7XG4gICAgaWQ6IHN0cmluZztcbiAgICB0aXRsZTogc3RyaW5nO1xuICAgIGFydGlzdDogc3RyaW5nO1xuICAgIGFsYnVtPzogc3RyaW5nO1xuICAgIGFydHdvcmtVcmw/OiBzdHJpbmc7XG4gICAgZHVyYXRpb24/OiBudW1iZXI7XG4gICAgZGlmZmljdWx0eTogJ2JlZ2lubmVyJyB8ICdpbnRlcm1lZGlhdGUnIHwgJ2FkdmFuY2VkJztcbiAgfTtcbiAgbHlyaWNzPzoge1xuICAgIHNvdXJjZTogc3RyaW5nO1xuICAgIHR5cGU6ICdzeW5jZWQnO1xuICAgIGxpbmVzOiBMeXJpY0xpbmVbXTtcbiAgICB0b3RhbExpbmVzOiBudW1iZXI7XG4gIH07XG4gIG1lc3NhZ2U/OiBzdHJpbmc7XG4gIGVycm9yPzogc3RyaW5nO1xuICBhcGlfY29ubmVjdGVkPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMeXJpY0xpbmUge1xuICBpZDogc3RyaW5nO1xuICB0ZXh0OiBzdHJpbmc7XG4gIHN0YXJ0VGltZTogbnVtYmVyO1xuICBkdXJhdGlvbjogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEthcmFva2VTZXNzaW9uIHtcbiAgaWQ6IHN0cmluZztcbiAgdHJhY2tJZDogc3RyaW5nO1xuICBzb25nVGl0bGU6IHN0cmluZztcbiAgc29uZ0FydGlzdDogc3RyaW5nO1xuICBzdGF0dXM6IHN0cmluZztcbiAgY3JlYXRlZEF0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBLYXJhb2tlQXBpU2VydmljZSB7XG4gIHByaXZhdGUgYmFzZVVybDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIC8vIFVzZSB0aGUgbG9jYWwgc2VydmVyIGVuZHBvaW50XG4gICAgdGhpcy5iYXNlVXJsID0gJ2h0dHA6Ly9sb2NhbGhvc3Q6ODc4Ny9hcGknO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBrYXJhb2tlIGRhdGEgZm9yIGEgdHJhY2sgSUQgKFlvdVR1YmUvU291bmRDbG91ZClcbiAgICovXG4gIGFzeW5jIGdldEthcmFva2VEYXRhKFxuICAgIHRyYWNrSWQ6IHN0cmluZywgXG4gICAgdGl0bGU/OiBzdHJpbmcsIFxuICAgIGFydGlzdD86IHN0cmluZ1xuICApOiBQcm9taXNlPEthcmFva2VEYXRhIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCk7XG4gICAgICBpZiAodGl0bGUpIHBhcmFtcy5zZXQoJ3RpdGxlJywgdGl0bGUpO1xuICAgICAgaWYgKGFydGlzdCkgcGFyYW1zLnNldCgnYXJ0aXN0JywgYXJ0aXN0KTtcbiAgICAgIFxuICAgICAgY29uc3QgdXJsID0gYCR7dGhpcy5iYXNlVXJsfS9rYXJhb2tlLyR7ZW5jb2RlVVJJQ29tcG9uZW50KHRyYWNrSWQpfSR7cGFyYW1zLnRvU3RyaW5nKCkgPyAnPycgKyBwYXJhbXMudG9TdHJpbmcoKSA6ICcnfWA7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUFwaV0gRmV0Y2hpbmcga2FyYW9rZSBkYXRhOicsIHVybCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIC8vIFJlbW92ZSBDb250ZW50LVR5cGUgaGVhZGVyIHRvIGF2b2lkIENPUlMgcHJlZmxpZ2h0XG4gICAgICAgIC8vIGhlYWRlcnM6IHtcbiAgICAgICAgLy8gICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAvLyB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBmZXRjaCBrYXJhb2tlIGRhdGE6JywgcmVzcG9uc2Uuc3RhdHVzKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VBcGldIFJlY2VpdmVkIGthcmFva2UgZGF0YTonLCBkYXRhKTtcbiAgICAgIFxuICAgICAgLy8gSWYgdGhlcmUncyBhbiBlcnJvciBidXQgd2UgZ290IGEgcmVzcG9uc2UsIGl0IG1lYW5zIEFQSSBpcyBjb25uZWN0ZWRcbiAgICAgIGlmIChkYXRhLmVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUFwaV0gU2VydmVyIGVycm9yIChidXQgQVBJIGlzIHJlYWNoYWJsZSk6JywgZGF0YS5lcnJvcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgaGFzX2thcmFva2U6IGZhbHNlLFxuICAgICAgICAgIGVycm9yOiBkYXRhLmVycm9yLFxuICAgICAgICAgIHRyYWNrX2lkOiB0cmFja0lkLFxuICAgICAgICAgIGFwaV9jb25uZWN0ZWQ6IHRydWVcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBFcnJvciBmZXRjaGluZyBrYXJhb2tlIGRhdGE6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IGEga2FyYW9rZSBzZXNzaW9uXG4gICAqL1xuICBhc3luYyBzdGFydFNlc3Npb24oXG4gICAgdHJhY2tJZDogc3RyaW5nLFxuICAgIHNvbmdEYXRhOiB7XG4gICAgICB0aXRsZTogc3RyaW5nO1xuICAgICAgYXJ0aXN0OiBzdHJpbmc7XG4gICAgICBhbGJ1bT86IHN0cmluZztcbiAgICAgIGR1cmF0aW9uPzogbnVtYmVyO1xuICAgIH1cbiAgKTogUHJvbWlzZTxLYXJhb2tlU2Vzc2lvbiB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHt0aGlzLmJhc2VVcmx9L2thcmFva2Uvc3RhcnRgLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAvLyBUT0RPOiBBZGQgYXV0aCB0b2tlbiB3aGVuIGF2YWlsYWJsZVxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgdHJhY2tJZCxcbiAgICAgICAgICBzb25nRGF0YSxcbiAgICAgICAgfSksXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIHN0YXJ0IHNlc3Npb246JywgcmVzcG9uc2Uuc3RhdHVzKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgIHJldHVybiByZXN1bHQuc2Vzc2lvbjtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEVycm9yIHN0YXJ0aW5nIHNlc3Npb246JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRlc3QgY29ubmVjdGlvbiB0byB0aGUgQVBJXG4gICAqL1xuICBhc3luYyB0ZXN0Q29ubmVjdGlvbigpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHt0aGlzLmJhc2VVcmwucmVwbGFjZSgnL2FwaScsICcnKX0vaGVhbHRoYCk7XG4gICAgICByZXR1cm4gcmVzcG9uc2Uub2s7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBDb25uZWN0aW9uIHRlc3QgZmFpbGVkOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGthcmFva2VBcGkgPSBuZXcgS2FyYW9rZUFwaVNlcnZpY2UoKTsiLCJpbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBQcmFjdGljZUV4ZXJjaXNlVmlldyB9IGZyb20gJ0BzY2FybGV0dC91aSc7XG5cbmludGVyZmFjZSBQcmFjdGljZVZpZXdQcm9wcyB7XG4gIHNlc3Npb25JZD86IHN0cmluZztcbiAgb25CYWNrOiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgUHJhY3RpY2VWaWV3OiBDb21wb25lbnQ8UHJhY3RpY2VWaWV3UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPFByYWN0aWNlRXhlcmNpc2VWaWV3IFxuICAgICAgc2Vzc2lvbklkPXtwcm9wcy5zZXNzaW9uSWR9XG4gICAgICBvbkJhY2s9e3Byb3BzLm9uQmFja31cbiAgICAgIC8vIEV4dGVuc2lvbiBkb2Vzbid0IHVzZSBhdXRoIHlldFxuICAgICAgLy8gYXBpQmFzZVVybCBpcyBkZWZhdWx0IGxvY2FsaG9zdDo4Nzg3XG4gICAgLz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgQ29tcG9uZW50LCBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCwgb25Nb3VudCwgb25DbGVhbnVwLCBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uS2FyYW9rZVZpZXcsIE1pbmltaXplZEthcmFva2UsIENvdW50ZG93biwgQ29tcGxldGlvblZpZXcsIHVzZUthcmFva2VTZXNzaW9uLCBFeHRlbnNpb25BdWRpb1NlcnZpY2UsIEkxOG5Qcm92aWRlciwgdHlwZSBQbGF5YmFja1NwZWVkIH0gZnJvbSAnQHNjYXJsZXR0L3VpJztcbmltcG9ydCB7IHRyYWNrRGV0ZWN0b3IsIHR5cGUgVHJhY2tJbmZvIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvdHJhY2stZGV0ZWN0b3InO1xuaW1wb3J0IHsgZ2V0QXV0aFRva2VuIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3RvcmFnZSc7XG5pbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xuaW1wb3J0IHsga2FyYW9rZUFwaSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2thcmFva2UtYXBpJztcbmltcG9ydCB7IFByYWN0aWNlVmlldyB9IGZyb20gJy4vUHJhY3RpY2VWaWV3JztcblxuZXhwb3J0IGludGVyZmFjZSBDb250ZW50QXBwUHJvcHMge31cblxuZXhwb3J0IGNvbnN0IENvbnRlbnRBcHA6IENvbXBvbmVudDxDb250ZW50QXBwUHJvcHM+ID0gKCkgPT4ge1xuICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlbmRlcmluZyBDb250ZW50QXBwIGNvbXBvbmVudCcpO1xuICBcbiAgLy8gU3RhdGVcbiAgY29uc3QgW2N1cnJlbnRUcmFjaywgc2V0Q3VycmVudFRyYWNrXSA9IGNyZWF0ZVNpZ25hbDxUcmFja0luZm8gfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2F1dGhUb2tlbiwgc2V0QXV0aFRva2VuXSA9IGNyZWF0ZVNpZ25hbDxzdHJpbmcgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW3Nob3dLYXJhb2tlLCBzZXRTaG93S2FyYW9rZV0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBba2FyYW9rZURhdGEsIHNldEthcmFva2VEYXRhXSA9IGNyZWF0ZVNpZ25hbDxhbnk+KG51bGwpO1xuICBjb25zdCBbbG9hZGluZywgc2V0TG9hZGluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbc2Vzc2lvblN0YXJ0ZWQsIHNldFNlc3Npb25TdGFydGVkXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtpc01pbmltaXplZCwgc2V0SXNNaW5pbWl6ZWRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2NvdW50ZG93biwgc2V0Q291bnRkb3duXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2lzUGxheWluZywgc2V0SXNQbGF5aW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtjdXJyZW50VGltZSwgc2V0Q3VycmVudFRpbWVdID0gY3JlYXRlU2lnbmFsKDApO1xuICBjb25zdCBbYXVkaW9SZWYsIHNldEF1ZGlvUmVmXSA9IGNyZWF0ZVNpZ25hbDxIVE1MQXVkaW9FbGVtZW50IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtrYXJhb2tlU2Vzc2lvbiwgc2V0S2FyYW9rZVNlc3Npb25dID0gY3JlYXRlU2lnbmFsPFJldHVyblR5cGU8dHlwZW9mIHVzZUthcmFva2VTZXNzaW9uPiB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbY29tcGxldGlvbkRhdGEsIHNldENvbXBsZXRpb25EYXRhXSA9IGNyZWF0ZVNpZ25hbDxhbnk+KG51bGwpO1xuICBjb25zdCBbc2hvd1ByYWN0aWNlLCBzZXRTaG93UHJhY3RpY2VdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3NlbGVjdGVkU3BlZWQsIHNldFNlbGVjdGVkU3BlZWRdID0gY3JlYXRlU2lnbmFsPFBsYXliYWNrU3BlZWQ+KCcxeCcpO1xuICBcbiAgLy8gTG9hZCBhdXRoIHRva2VuIG9uIG1vdW50XG4gIG9uTW91bnQoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTG9hZGluZyBhdXRoIHRva2VuJyk7XG4gICAgY29uc3QgdG9rZW4gPSBhd2FpdCBnZXRBdXRoVG9rZW4oKTtcbiAgICBpZiAodG9rZW4pIHtcbiAgICAgIHNldEF1dGhUb2tlbih0b2tlbik7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEF1dGggdG9rZW4gbG9hZGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBkZW1vIHRva2VuIGZvciBkZXZlbG9wbWVudFxuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBObyBhdXRoIHRva2VuIGZvdW5kLCB1c2luZyBkZW1vIHRva2VuJyk7XG4gICAgICBzZXRBdXRoVG9rZW4oJ3NjYXJsZXR0X2RlbW9fdG9rZW5fMTIzJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIFN0YXJ0IHdhdGNoaW5nIGZvciB0cmFjayBjaGFuZ2VzXG4gICAgY29uc3QgY2xlYW51cCA9IHRyYWNrRGV0ZWN0b3Iud2F0Y2hGb3JDaGFuZ2VzKCh0cmFjaykgPT4ge1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBUcmFjayBjaGFuZ2VkOicsIHRyYWNrKTtcbiAgICAgIHNldEN1cnJlbnRUcmFjayh0cmFjayk7XG4gICAgICAvLyBTaG93IGthcmFva2Ugd2hlbiB0cmFjayBpcyBkZXRlY3RlZCBhbmQgZmV0Y2ggZGF0YVxuICAgICAgaWYgKHRyYWNrKSB7XG4gICAgICAgIHNldFNob3dLYXJhb2tlKHRydWUpO1xuICAgICAgICBmZXRjaEthcmFva2VEYXRhKHRyYWNrKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIG9uQ2xlYW51cChjbGVhbnVwKTtcbiAgfSk7XG5cbiAgY29uc3QgZmV0Y2hLYXJhb2tlRGF0YSA9IGFzeW5jICh0cmFjazogVHJhY2tJbmZvKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGZXRjaGluZyBrYXJhb2tlIGRhdGEgZm9yIHRyYWNrOicsIHRyYWNrKTtcbiAgICBzZXRMb2FkaW5nKHRydWUpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQga2FyYW9rZUFwaS5nZXRLYXJhb2tlRGF0YShcbiAgICAgICAgdHJhY2sudHJhY2tJZCxcbiAgICAgICAgdHJhY2sudGl0bGUsXG4gICAgICAgIHRyYWNrLmFydGlzdFxuICAgICAgKTtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gS2FyYW9rZSBkYXRhIGxvYWRlZDonLCBkYXRhKTtcbiAgICAgIHNldEthcmFva2VEYXRhKGRhdGEpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQ29udGVudEFwcF0gRmFpbGVkIHRvIGZldGNoIGthcmFva2UgZGF0YTonLCBlcnJvcik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldExvYWRpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVTdGFydCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFN0YXJ0IGthcmFva2Ugc2Vzc2lvbicpO1xuICAgIHNldFNlc3Npb25TdGFydGVkKHRydWUpO1xuICAgIFxuICAgIGNvbnN0IGRhdGEgPSBrYXJhb2tlRGF0YSgpO1xuICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9SZWYoKTtcbiAgICBjb25zdCB0cmFjayA9IGN1cnJlbnRUcmFjaygpO1xuICAgIFxuICAgIGlmIChkYXRhICYmIHRyYWNrICYmIGRhdGEubHlyaWNzPy5saW5lcykge1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBDcmVhdGluZyBrYXJhb2tlIHNlc3Npb24gd2l0aCBhdWRpbyBjYXB0dXJlJywge1xuICAgICAgICB0cmFja0lkOiB0cmFjay5pZCxcbiAgICAgICAgdHJhY2tUaXRsZTogdHJhY2sudGl0bGUsXG4gICAgICAgIHNvbmdEYXRhOiBkYXRhLnNvbmcsXG4gICAgICAgIGhhc0x5cmljczogISFkYXRhLmx5cmljcz8ubGluZXNcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyBDcmVhdGUgYW5kIHN0YXJ0IHNlc3Npb25cbiAgICAgIGNvbnN0IG5ld1Nlc3Npb24gPSB1c2VLYXJhb2tlU2Vzc2lvbih7XG4gICAgICAgIGx5cmljczogZGF0YS5seXJpY3MubGluZXMsXG4gICAgICAgIHRyYWNrSWQ6IHRyYWNrLnRyYWNrSWQsXG4gICAgICAgIHNvbmdEYXRhOiBkYXRhLnNvbmcgPyB7XG4gICAgICAgICAgdGl0bGU6IGRhdGEuc29uZy50aXRsZSxcbiAgICAgICAgICBhcnRpc3Q6IGRhdGEuc29uZy5hcnRpc3QsXG4gICAgICAgICAgYWxidW06IGRhdGEuc29uZy5hbGJ1bSxcbiAgICAgICAgICBkdXJhdGlvbjogZGF0YS5zb25nLmR1cmF0aW9uXG4gICAgICAgIH0gOiB7XG4gICAgICAgICAgdGl0bGU6IHRyYWNrLnRpdGxlLFxuICAgICAgICAgIGFydGlzdDogdHJhY2suYXJ0aXN0XG4gICAgICAgIH0sXG4gICAgICAgIHNvbmdDYXRhbG9nSWQ6IGRhdGEuc29uZ19jYXRhbG9nX2lkLFxuICAgICAgICBhdWRpb0VsZW1lbnQ6IHVuZGVmaW5lZCwgLy8gV2lsbCBiZSBzZXQgd2hlbiBhdWRpbyBzdGFydHMgcGxheWluZ1xuICAgICAgICBhcGlVcmw6ICdodHRwOi8vbG9jYWxob3N0Ojg3ODcvYXBpJyxcbiAgICAgICAgb25Db21wbGV0ZTogKHJlc3VsdHMpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEthcmFva2Ugc2Vzc2lvbiBjb21wbGV0ZWQ6JywgcmVzdWx0cyk7XG4gICAgICAgICAgc2V0U2Vzc2lvblN0YXJ0ZWQoZmFsc2UpO1xuICAgICAgICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgICAgICAgc2V0Q29tcGxldGlvbkRhdGEocmVzdWx0cyk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gU3RvcCBhdWRpbyBwbGF5YmFja1xuICAgICAgICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9SZWYoKTtcbiAgICAgICAgICBpZiAoYXVkaW8pIHtcbiAgICAgICAgICAgIGF1ZGlvLnBhdXNlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gQXBwbHkgdGhlIHNlbGVjdGVkIHNwZWVkIHRvIHRoZSBuZXcgc2Vzc2lvblxuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBBcHBseWluZyBzZWxlY3RlZCBzcGVlZCB0byBuZXcgc2Vzc2lvbjonLCBzZWxlY3RlZFNwZWVkKCkpO1xuICAgICAgbmV3U2Vzc2lvbi5oYW5kbGVTcGVlZENoYW5nZShzZWxlY3RlZFNwZWVkKCkpO1xuICAgICAgXG4gICAgICBzZXRLYXJhb2tlU2Vzc2lvbihuZXdTZXNzaW9uKTtcbiAgICAgIFxuICAgICAgLy8gU3RhcnQgdGhlIHNlc3Npb24gKGluY2x1ZGVzIGNvdW50ZG93biBhbmQgYXVkaW8gaW5pdGlhbGl6YXRpb24pXG4gICAgICBhd2FpdCBuZXdTZXNzaW9uLnN0YXJ0U2Vzc2lvbigpO1xuICAgICAgXG4gICAgICAvLyBXYXRjaCBmb3IgY291bnRkb3duIHRvIGZpbmlzaCBhbmQgc3RhcnQgYXVkaW9cbiAgICAgIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgICAgIGlmIChuZXdTZXNzaW9uLmNvdW50ZG93bigpID09PSBudWxsICYmIG5ld1Nlc3Npb24uaXNQbGF5aW5nKCkgJiYgIWlzUGxheWluZygpKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBDb3VudGRvd24gZmluaXNoZWQsIHN0YXJ0aW5nIGF1ZGlvIHBsYXliYWNrJyk7XG4gICAgICAgICAgc3RhcnRBdWRpb1BsYXliYWNrKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFVwZGF0ZSBzZXNzaW9uIHdpdGggYXVkaW8gZWxlbWVudCB3aGVuIGF2YWlsYWJsZVxuICAgICAgICBjb25zdCBhdWRpbyA9IGF1ZGlvUmVmKCk7XG4gICAgICAgIGlmIChhdWRpbyAmJiBuZXdTZXNzaW9uKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTZXR0aW5nIGF1ZGlvIGVsZW1lbnQgb24gbmV3IHNlc3Npb24nKTtcbiAgICAgICAgICBuZXdTZXNzaW9uLnNldEF1ZGlvRWxlbWVudChhdWRpbyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZhbGxiYWNrIHRvIHNpbXBsZSBjb3VudGRvd24nKTtcbiAgICAgIC8vIEZhbGxiYWNrIHRvIG9sZCBiZWhhdmlvclxuICAgICAgc2V0Q291bnRkb3duKDMpO1xuICAgICAgXG4gICAgICBjb25zdCBjb3VudGRvd25JbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgY29uc3QgY3VycmVudCA9IGNvdW50ZG93bigpO1xuICAgICAgICBpZiAoY3VycmVudCAhPT0gbnVsbCAmJiBjdXJyZW50ID4gMSkge1xuICAgICAgICAgIHNldENvdW50ZG93bihjdXJyZW50IC0gMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2xlYXJJbnRlcnZhbChjb3VudGRvd25JbnRlcnZhbCk7XG4gICAgICAgICAgc2V0Q291bnRkb3duKG51bGwpO1xuICAgICAgICAgIHN0YXJ0QXVkaW9QbGF5YmFjaygpO1xuICAgICAgICB9XG4gICAgICB9LCAxMDAwKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3Qgc3RhcnRBdWRpb1BsYXliYWNrID0gKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU3RhcnRpbmcgYXVkaW8gcGxheWJhY2snKTtcbiAgICBzZXRJc1BsYXlpbmcodHJ1ZSk7XG4gICAgXG4gICAgLy8gVHJ5IG11bHRpcGxlIG1ldGhvZHMgdG8gZmluZCBhbmQgcGxheSBhdWRpb1xuICAgIC8vIE1ldGhvZCAxOiBMb29rIGZvciBhdWRpbyBlbGVtZW50c1xuICAgIGNvbnN0IGF1ZGlvRWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdhdWRpbycpO1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRm91bmQgYXVkaW8gZWxlbWVudHM6JywgYXVkaW9FbGVtZW50cy5sZW5ndGgpO1xuICAgIFxuICAgIGlmIChhdWRpb0VsZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9FbGVtZW50c1swXSBhcyBIVE1MQXVkaW9FbGVtZW50O1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBBdWRpbyBlbGVtZW50OicsIHtcbiAgICAgICAgc3JjOiBhdWRpby5zcmMsXG4gICAgICAgIHBhdXNlZDogYXVkaW8ucGF1c2VkLFxuICAgICAgICBkdXJhdGlvbjogYXVkaW8uZHVyYXRpb24sXG4gICAgICAgIGN1cnJlbnRUaW1lOiBhdWRpby5jdXJyZW50VGltZVxuICAgICAgfSk7XG4gICAgICBzZXRBdWRpb1JlZihhdWRpbyk7XG4gICAgICBcbiAgICAgIC8vIFVwZGF0ZSBrYXJhb2tlIHNlc3Npb24gd2l0aCBhdWRpbyBlbGVtZW50IGlmIGl0IGV4aXN0c1xuICAgICAgY29uc3Qgc2Vzc2lvbiA9IGthcmFva2VTZXNzaW9uKCk7XG4gICAgICBpZiAoc2Vzc2lvbikge1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFNldHRpbmcgYXVkaW8gZWxlbWVudCBvbiBrYXJhb2tlIHNlc3Npb24nKTtcbiAgICAgICAgc2Vzc2lvbi5zZXRBdWRpb0VsZW1lbnQoYXVkaW8pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzZXNzaW9uLmF1ZGlvUHJvY2Vzc29yLmlzUmVhZHkoKSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gSW5pdGlhbGl6aW5nIGF1ZGlvIHByb2Nlc3NvciBmb3Igc2Vzc2lvbicpO1xuICAgICAgICAgIHNlc3Npb24uYXVkaW9Qcm9jZXNzb3IuaW5pdGlhbGl6ZSgpLmNhdGNoKGNvbnNvbGUuZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFRyeSB0byBwbGF5IHRoZSBhdWRpb1xuICAgICAgYXVkaW8ucGxheSgpLnRoZW4oKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEF1ZGlvIHN0YXJ0ZWQgcGxheWluZyBzdWNjZXNzZnVsbHknKTtcbiAgICAgIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tDb250ZW50QXBwXSBGYWlsZWQgdG8gcGxheSBhdWRpbzonLCBlcnIpO1xuICAgICAgICBcbiAgICAgICAgLy8gTWV0aG9kIDI6IFRyeSBjbGlja2luZyB0aGUgcGxheSBidXR0b24gb24gdGhlIHBhZ2VcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBBdHRlbXB0aW5nIHRvIGNsaWNrIHBsYXkgYnV0dG9uLi4uJyk7XG4gICAgICAgIGNvbnN0IHBsYXlCdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdidXR0b25bdGl0bGUqPVwiUGxheVwiXSwgYnV0dG9uW2FyaWEtbGFiZWwqPVwiUGxheVwiXSwgLnBsYXlDb250cm9sLCAucGxheUJ1dHRvbiwgW2NsYXNzKj1cInBsYXktYnV0dG9uXCJdJyk7XG4gICAgICAgIGlmIChwbGF5QnV0dG9uKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGb3VuZCBwbGF5IGJ1dHRvbiwgY2xpY2tpbmcgaXQnKTtcbiAgICAgICAgICAocGxheUJ1dHRvbiBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIFVwZGF0ZSBjdXJyZW50IHRpbWVcbiAgICAgIGNvbnN0IHVwZGF0ZVRpbWUgPSAoKSA9PiB7XG4gICAgICAgIHNldEN1cnJlbnRUaW1lKGF1ZGlvLmN1cnJlbnRUaW1lKTtcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB1cGRhdGVUaW1lKTtcbiAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgKCkgPT4ge1xuICAgICAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgICAgICBhdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdXBkYXRlVGltZSk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTWV0aG9kIDM6IFRyeSBTb3VuZENsb3VkIHNwZWNpZmljIHNlbGVjdG9yc1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBObyBhdWRpbyBlbGVtZW50cyBmb3VuZCwgdHJ5aW5nIFNvdW5kQ2xvdWQtc3BlY2lmaWMgYXBwcm9hY2gnKTtcbiAgICAgIGNvbnN0IHBsYXlCdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcucGxheUNvbnRyb2wsIC5zYy1idXR0b24tcGxheSwgYnV0dG9uW3RpdGxlKj1cIlBsYXlcIl0nKTtcbiAgICAgIGlmIChwbGF5QnV0dG9uKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRm91bmQgU291bmRDbG91ZCBwbGF5IGJ1dHRvbiwgY2xpY2tpbmcgaXQnKTtcbiAgICAgICAgKHBsYXlCdXR0b24gYXMgSFRNTEVsZW1lbnQpLmNsaWNrKCk7XG4gICAgICAgIFxuICAgICAgICAvLyBXYWl0IGEgYml0IGFuZCB0aGVuIGxvb2sgZm9yIGF1ZGlvIGVsZW1lbnQgYWdhaW5cbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgY29uc3QgbmV3QXVkaW9FbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2F1ZGlvJyk7XG4gICAgICAgICAgaWYgKG5ld0F1ZGlvRWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGb3VuZCBhdWRpbyBlbGVtZW50IGFmdGVyIGNsaWNraW5nIHBsYXknKTtcbiAgICAgICAgICAgIGNvbnN0IGF1ZGlvID0gbmV3QXVkaW9FbGVtZW50c1swXSBhcyBIVE1MQXVkaW9FbGVtZW50O1xuICAgICAgICAgICAgc2V0QXVkaW9SZWYoYXVkaW8pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBVcGRhdGUgY3VycmVudCB0aW1lXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVUaW1lID0gKCkgPT4ge1xuICAgICAgICAgICAgICBzZXRDdXJyZW50VGltZShhdWRpby5jdXJyZW50VGltZSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdXBkYXRlVGltZSk7XG4gICAgICAgICAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsICgpID0+IHtcbiAgICAgICAgICAgICAgc2V0SXNQbGF5aW5nKGZhbHNlKTtcbiAgICAgICAgICAgICAgYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIHVwZGF0ZVRpbWUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCA1MDApO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVDbG9zZSA9ICgpID0+IHtcbiAgICAvLyBTdG9wIHNlc3Npb24gaWYgYWN0aXZlXG4gICAgY29uc3Qgc2Vzc2lvbiA9IGthcmFva2VTZXNzaW9uKCk7XG4gICAgaWYgKHNlc3Npb24pIHtcbiAgICAgIHNlc3Npb24uc3RvcFNlc3Npb24oKTtcbiAgICB9XG4gICAgXG4gICAgc2V0U2hvd0thcmFva2UoZmFsc2UpO1xuICAgIHNldEthcmFva2VEYXRhKG51bGwpO1xuICAgIHNldFNlc3Npb25TdGFydGVkKGZhbHNlKTtcbiAgICBzZXRLYXJhb2tlU2Vzc2lvbihudWxsKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVNaW5pbWl6ZSA9ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE1pbmltaXplIGthcmFva2Ugd2lkZ2V0Jyk7XG4gICAgc2V0SXNNaW5pbWl6ZWQodHJ1ZSk7XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlUmVzdG9yZSA9ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlc3RvcmUga2FyYW9rZSB3aWRnZXQnKTtcbiAgICBzZXRJc01pbmltaXplZChmYWxzZSk7XG4gIH07XG5cbiAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBSZW5kZXIgc3RhdGU6Jywge1xuICAgIHNob3dLYXJhb2tlOiBzaG93S2FyYW9rZSgpLFxuICAgIGN1cnJlbnRUcmFjazogY3VycmVudFRyYWNrKCksXG4gICAga2FyYW9rZURhdGE6IGthcmFva2VEYXRhKCksXG4gICAgbG9hZGluZzogbG9hZGluZygpXG4gIH0pO1xuXG5cbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAgey8qIE1pbmltaXplZCBzdGF0ZSAqL31cbiAgICAgIDxTaG93IHdoZW49e3Nob3dLYXJhb2tlKCkgJiYgY3VycmVudFRyYWNrKCkgJiYgaXNNaW5pbWl6ZWQoKX0+XG4gICAgICAgIDxNaW5pbWl6ZWRLYXJhb2tlIG9uQ2xpY2s9e2hhbmRsZVJlc3RvcmV9IC8+XG4gICAgICA8L1Nob3c+XG5cbiAgICAgIHsvKiBGdWxsIHdpZGdldCBzdGF0ZSAqL31cbiAgICAgIDxTaG93IHdoZW49e3Nob3dLYXJhb2tlKCkgJiYgY3VycmVudFRyYWNrKCkgJiYgIWlzTWluaW1pemVkKCl9IGZhbGxiYWNrPXtcbiAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnbm9uZScgfX0+XG4gICAgICAgICAge2NvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTm90IHNob3dpbmcgLSBzaG93S2FyYW9rZTonLCBzaG93S2FyYW9rZSgpLCAnY3VycmVudFRyYWNrOicsIGN1cnJlbnRUcmFjaygpKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICB9PlxuICAgICAgICA8ZGl2IHN0eWxlPXt7XG4gICAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICAgICAgdG9wOiAnMjBweCcsXG4gICAgICAgICAgcmlnaHQ6ICcyMHB4JyxcbiAgICAgICAgICBib3R0b206ICcyMHB4JyxcbiAgICAgICAgICB3aWR0aDogJzQ4MHB4JyxcbiAgICAgICAgICAnei1pbmRleCc6ICc5OTk5OScsXG4gICAgICAgICAgb3ZlcmZsb3c6ICdoaWRkZW4nLFxuICAgICAgICAgICdib3JkZXItcmFkaXVzJzogJzE2cHgnLFxuICAgICAgICAgICdib3gtc2hhZG93JzogJzAgMjVweCA1MHB4IC0xMnB4IHJnYmEoMCwgMCwgMCwgMC42KScsXG4gICAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxuICAgICAgICAgICdmbGV4LWRpcmVjdGlvbic6ICdjb2x1bW4nXG4gICAgICAgIH19PlxuICAgICAgICAgIHtjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlbmRlcmluZyB3aXRoIGNvbXBsZXRpb24gZGF0YTonLCBjb21wbGV0aW9uRGF0YSgpKX1cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiaC1mdWxsIGJnLXN1cmZhY2Ugcm91bmRlZC0yeGwgb3ZlcmZsb3ctaGlkZGVuIGZsZXggZmxleC1jb2xcIj5cbiAgICAgICAgICAgIHsvKiBIZWFkZXIgd2l0aCBtaW5pbWl6ZSBhbmQgY2xvc2UgYnV0dG9ucyAqL31cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWVuZCBwLTIgYmctc3VyZmFjZSBib3JkZXItYiBib3JkZXItc3VidGxlXCIgc3R5bGU9e3sgaGVpZ2h0OiAnNDhweCcgfX0+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Nob3dQcmFjdGljZSgpfT5cbiAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd1ByYWN0aWNlKGZhbHNlKX1cbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LTEwIGgtMTAgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1sZyB0cmFuc2l0aW9uLWNvbG9ycyBob3ZlcjpiZy13aGl0ZS8xMFwiXG4gICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IGNvbG9yOiAnI2E4YThhOCcgfX1cbiAgICAgICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIkNsb3NlIFByYWN0aWNlXCJcbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgPHN2ZyB3aWR0aD1cIjIwXCIgaGVpZ2h0PVwiMjBcIiB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHBhdGggZD1cIk0xNSA1TDUgMTVNNSA1TDE1IDE1XCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiLz5cbiAgICAgICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlTWluaW1pemV9XG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInctMTAgaC0xMCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzIGhvdmVyOmJnLXdoaXRlLzEwXCJcbiAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IGNvbG9yOiAnI2E4YThhOCcgfX1cbiAgICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCJNaW5pbWl6ZVwiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPHN2ZyB3aWR0aD1cIjI0XCIgaGVpZ2h0PVwiMjRcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+XG4gICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9XCJNNiAxMmgxMlwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjNcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIvPlxuICAgICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHsvKiBNYWluIGNvbnRlbnQgYXJlYSAqL31cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgbWluLWgtMCBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgICAgPFNob3cgd2hlbj17Y29tcGxldGlvbkRhdGEoKX0gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49eyFsb2FkaW5nKCl9IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBoLWZ1bGwgYmctYmFzZVwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYW5pbWF0ZS1zcGluIHJvdW5kZWQtZnVsbCBoLTEyIHctMTIgYm9yZGVyLWItMiBib3JkZXItYWNjZW50LXByaW1hcnkgbXgtYXV0byBtYi00XCI+PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNlY29uZGFyeVwiPkxvYWRpbmcgbHlyaWNzLi4uPC9wPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtrYXJhb2tlRGF0YSgpPy5seXJpY3M/LmxpbmVzfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBoLWZ1bGwgcC04XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1zZWNvbmRhcnkgbWItMlwiPk5vIGx5cmljcyBhdmFpbGFibGU8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc20gdGV4dC10ZXJ0aWFyeVwiPlRyeSBhIGRpZmZlcmVudCBzb25nPC9wPlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoLWZ1bGwgZmxleCBmbGV4LWNvbFwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgbWluLWgtMCBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxFeHRlbnNpb25LYXJhb2tlVmlld1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzY29yZT17a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLnNjb3JlKCkgOiAwfVxuICAgICAgICAgICAgICAgICAgICAgICAgICByYW5rPXsxfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBseXJpY3M9e2thcmFva2VEYXRhKCk/Lmx5cmljcz8ubGluZXMgfHwgW119XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnRUaW1lPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuY3VycmVudFRpbWUoKSA6IGN1cnJlbnRUaW1lKCkgKiAxMDAwfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBsZWFkZXJib2FyZD17W119XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlzUGxheWluZz17a2FyYW9rZVNlc3Npb24oKSA/IChrYXJhb2tlU2Vzc2lvbigpIS5pc1BsYXlpbmcoKSB8fCBrYXJhb2tlU2Vzc2lvbigpIS5jb3VudGRvd24oKSAhPT0gbnVsbCkgOiAoaXNQbGF5aW5nKCkgfHwgY291bnRkb3duKCkgIT09IG51bGwpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvblN0YXJ0PXtoYW5kbGVTdGFydH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25TcGVlZENoYW5nZT17KHNwZWVkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTcGVlZCBjaGFuZ2VkOicsIHNwZWVkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTZWxlY3RlZFNwZWVkKHNwZWVkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXNzaW9uID0ga2FyYW9rZVNlc3Npb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2Vzc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBBcHBseWluZyBzcGVlZCBjaGFuZ2UgdG8gc2Vzc2lvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbi5oYW5kbGVTcGVlZENoYW5nZShzcGVlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTm8gc2Vzc2lvbiB5ZXQsIHNwZWVkIHdpbGwgYmUgYXBwbGllZCB3aGVuIHNlc3Npb24gc3RhcnRzJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFsc28gYXBwbHkgdG8gYXVkaW8gZWxlbWVudCBkaXJlY3RseSBpZiBpdCBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhdWRpbyA9IGF1ZGlvUmVmKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF1ZGlvKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByYXRlID0gc3BlZWQgPT09ICcwLjV4JyA/IDAuNSA6IHNwZWVkID09PSAnMC43NXgnID8gMC43NSA6IDEuMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU2V0dGluZyBhdWRpbyBwbGF5YmFjayByYXRlIGRpcmVjdGx5IHRvOicsIHJhdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXVkaW8ucGxheWJhY2tSYXRlID0gcmF0ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlzUmVjb3JkaW5nPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuaXNSZWNvcmRpbmcoKSA6IGZhbHNlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBsaW5lU2NvcmVzPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEubGluZVNjb3JlcygpIDogW119XG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgIHsvKiBDb3VudGRvd24gb3ZlcmxheSAqL31cbiAgICAgICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuY291bnRkb3duKCkgIT09IG51bGwgOiBjb3VudGRvd24oKSAhPT0gbnVsbH0+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWJzb2x1dGUgaW5zZXQtMCBiZy1ibGFjay84MCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB6LTUwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTh4bCBmb250LWJvbGQgdGV4dC13aGl0ZSBhbmltYXRlLXB1bHNlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLmNvdW50ZG93bigpIDogY291bnRkb3duKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXhsIHRleHQtd2hpdGUvODAgbXQtNFwiPkdldCByZWFkeSE8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgICAgey8qIENvbXBsZXRpb24gVmlldyBvciBQcmFjdGljZSBWaWV3ICovfVxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Nob3dQcmFjdGljZSgpfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICA8STE4blByb3ZpZGVyPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaC1mdWxsIGZsZXggZmxleC1jb2xcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXshY29tcGxldGlvbkRhdGEoKS5pc0xvYWRpbmd9IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBoLWZ1bGwgYmctYmFzZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYW5pbWF0ZS1zcGluIHJvdW5kZWQtZnVsbCBoLTE2IHctMTYgYm9yZGVyLWItMiBib3JkZXItYWNjZW50LXByaW1hcnkgbXgtYXV0byBtYi00XCI+PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5XCI+Q2FsY3VsYXRpbmcgeW91ciBmaW5hbCBzY29yZS4uLjwvcD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc20gdGV4dC10ZXJ0aWFyeSBtdC0yXCI+QW5hbHl6aW5nIGZ1bGwgcGVyZm9ybWFuY2U8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxDb21wbGV0aW9uVmlld1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImgtZnVsbFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3JlPXtjb21wbGV0aW9uRGF0YSgpLnNjb3JlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICByYW5rPXsxfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBzcGVlZD17c2VsZWN0ZWRTcGVlZCgpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBmZWVkYmFja1RleHQ9e1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRpb25EYXRhKCkuc2NvcmUgPj0gOTUgPyBcIlBlcmZlY3QhIFlvdSBuYWlsZWQgaXQhXCIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRpb25EYXRhKCkuc2NvcmUgPj0gODUgPyBcIkV4Y2VsbGVudCBwZXJmb3JtYW5jZSFcIiA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGlvbkRhdGEoKS5zY29yZSA+PSA3MCA/IFwiR3JlYXQgam9iIVwiIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0aW9uRGF0YSgpLnNjb3JlID49IDUwID8gXCJHb29kIGVmZm9ydCFcIiA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJLZWVwIHByYWN0aWNpbmchXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvblByYWN0aWNlPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBQcmFjdGljZSBlcnJvcnMgY2xpY2tlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFNob3dQcmFjdGljZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvSTE4blByb3ZpZGVyPlxuICAgICAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgICAgICB7LyogUHJhY3RpY2UgVmlldyAqL31cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoLWZ1bGwgb3ZlcmZsb3cteS1hdXRvXCI+XG4gICAgICAgICAgICAgICAgICAgIDxQcmFjdGljZVZpZXdcbiAgICAgICAgICAgICAgICAgICAgICBzZXNzaW9uSWQ9e2NvbXBsZXRpb25EYXRhKCk/LnNlc3Npb25JZH1cbiAgICAgICAgICAgICAgICAgICAgICBvbkJhY2s9eygpID0+IHNldFNob3dQcmFjdGljZShmYWxzZSl9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvU2hvdz5cbiAgICA8Lz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2hhZG93Um9vdFVpIH0gZnJvbSAnd3h0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYWRvdy1yb290JztcbmltcG9ydCB7IGRlZmluZUNvbnRlbnRTY3JpcHQgfSBmcm9tICd3eHQvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0JztcbmltcG9ydCB0eXBlIHsgQ29udGVudFNjcmlwdENvbnRleHQgfSBmcm9tICd3eHQvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dCc7XG5pbXBvcnQgeyByZW5kZXIgfSBmcm9tICdzb2xpZC1qcy93ZWInO1xuaW1wb3J0IHsgQ29udGVudEFwcCB9IGZyb20gJy4uL3NyYy92aWV3cy9jb250ZW50L0NvbnRlbnRBcHAnO1xuaW1wb3J0ICcuLi9zcmMvc3R5bGVzL2V4dGVuc2lvbi5jc3MnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWycqOi8vc291bmRjbG91ZC5jb20vKicsICcqOi8vc291bmRjbG9hay5jb20vKicsICcqOi8vc2MubWFpZC56b25lLyonLCAnKjovLyoubWFpZC56b25lLyonXSxcbiAgcnVuQXQ6ICdkb2N1bWVudF9pZGxlJyxcbiAgY3NzSW5qZWN0aW9uTW9kZTogJ3VpJyxcblxuICBhc3luYyBtYWluKGN0eDogQ29udGVudFNjcmlwdENvbnRleHQpIHtcbiAgICAvLyBPbmx5IHJ1biBpbiB0b3AtbGV2ZWwgZnJhbWUgdG8gYXZvaWQgZHVwbGljYXRlIHByb2Nlc3NpbmcgaW4gaWZyYW1lc1xuICAgIGlmICh3aW5kb3cudG9wICE9PSB3aW5kb3cuc2VsZikge1xuICAgICAgY29uc29sZS5sb2coJ1tTY2FybGV0dCBDU10gTm90IHRvcC1sZXZlbCBmcmFtZSwgc2tpcHBpbmcgY29udGVudCBzY3JpcHQuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ1tTY2FybGV0dCBDU10gU2NhcmxldHQgS2FyYW9rZSBjb250ZW50IHNjcmlwdCBsb2FkZWQnKTtcblxuICAgIC8vIENyZWF0ZSBzaGFkb3cgRE9NIGFuZCBtb3VudCBrYXJhb2tlIHdpZGdldFxuICAgIGNvbnN0IHVpID0gYXdhaXQgY3JlYXRlU2hhZG93Um9vdFVpKGN0eCwge1xuICAgICAgbmFtZTogJ3NjYXJsZXR0LWthcmFva2UtdWknLFxuICAgICAgcG9zaXRpb246ICdvdmVybGF5JyxcbiAgICAgIGFuY2hvcjogJ2JvZHknLFxuICAgICAgb25Nb3VudDogYXN5bmMgKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gb25Nb3VudCBjYWxsZWQsIGNvbnRhaW5lcjonLCBjb250YWluZXIpO1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBTaGFkb3cgcm9vdDonLCBjb250YWluZXIuZ2V0Um9vdE5vZGUoKSk7XG4gICAgICAgIFxuICAgICAgICAvLyBMb2cgd2hhdCBzdHlsZXNoZWV0cyBhcmUgYXZhaWxhYmxlXG4gICAgICAgIGNvbnN0IHNoYWRvd1Jvb3QgPSBjb250YWluZXIuZ2V0Um9vdE5vZGUoKSBhcyBTaGFkb3dSb290O1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBTaGFkb3cgcm9vdCBzdHlsZXNoZWV0czonLCBzaGFkb3dSb290LnN0eWxlU2hlZXRzPy5sZW5ndGgpO1xuICAgICAgICBcbiAgICAgICAgLy8gQ3JlYXRlIHdyYXBwZXIgZGl2IChDb250ZW50QXBwIHdpbGwgaGFuZGxlIHBvc2l0aW9uaW5nIGJhc2VkIG9uIHN0YXRlKVxuICAgICAgICBjb25zdCB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gJ2thcmFva2Utd2lkZ2V0LWNvbnRhaW5lcic7XG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh3cmFwcGVyKTtcblxuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBXcmFwcGVyIGNyZWF0ZWQgYW5kIGFwcGVuZGVkOicsIHdyYXBwZXIpO1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBXcmFwcGVyIGNvbXB1dGVkIHN0eWxlczonLCB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh3cmFwcGVyKSk7XG5cbiAgICAgICAgLy8gUmVuZGVyIENvbnRlbnRBcHAgY29tcG9uZW50ICh3aGljaCB1c2VzIEV4dGVuc2lvbkthcmFva2VWaWV3KVxuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBBYm91dCB0byByZW5kZXIgQ29udGVudEFwcCcpO1xuICAgICAgICBjb25zdCBkaXNwb3NlID0gcmVuZGVyKCgpID0+IDxDb250ZW50QXBwIC8+LCB3cmFwcGVyKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIENvbnRlbnRBcHAgcmVuZGVyZWQsIGRpc3Bvc2UgZnVuY3Rpb246JywgZGlzcG9zZSk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gZGlzcG9zZTtcbiAgICAgIH0sXG4gICAgICBvblJlbW92ZTogKGNsZWFudXA/OiAoKSA9PiB2b2lkKSA9PiB7XG4gICAgICAgIGNsZWFudXA/LigpO1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIE1vdW50IHRoZSBVSVxuICAgIHVpLm1vdW50KCk7XG4gICAgY29uc29sZS5sb2coJ1tTY2FybGV0dCBDU10gS2FyYW9rZSBvdmVybGF5IG1vdW50ZWQnKTtcbiAgfSxcbn0pOyIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIiwiaW1wb3J0IGNvbW1vbiBmcm9tICcuL2NvbW1vbi5qc29uJztcbmltcG9ydCBrYXJhb2tlIGZyb20gJy4va2FyYW9rZS5qc29uJztcbmltcG9ydCBkaXNwbGF5IGZyb20gJy4vZGlzcGxheS5qc29uJztcbmltcG9ydCB0eXBlIHsgVHJhbnNsYXRpb25zIH0gZnJvbSAnLi4vLi4vdHlwZXMnO1xuXG5jb25zdCB0cmFuc2xhdGlvbnM6IFRyYW5zbGF0aW9ucyA9IHtcbiAgY29tbW9uLFxuICBrYXJhb2tlLFxuICBkaXNwbGF5LFxufTtcblxuZXhwb3J0IGRlZmF1bHQgdHJhbnNsYXRpb25zOyIsImltcG9ydCBjb21tb24gZnJvbSAnLi9jb21tb24uanNvbic7XG5pbXBvcnQga2FyYW9rZSBmcm9tICcuL2thcmFva2UuanNvbic7XG5pbXBvcnQgZGlzcGxheSBmcm9tICcuL2Rpc3BsYXkuanNvbic7XG5pbXBvcnQgdHlwZSB7IFRyYW5zbGF0aW9ucyB9IGZyb20gJy4uLy4uL3R5cGVzJztcblxuY29uc3QgdHJhbnNsYXRpb25zOiBUcmFuc2xhdGlvbnMgPSB7XG4gIGNvbW1vbixcbiAga2FyYW9rZSxcbiAgZGlzcGxheSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHRyYW5zbGF0aW9uczsiXSwibmFtZXMiOlsidmFsdWUiLCJlcnJvciIsImNoaWxkcmVuIiwibWVtbyIsImluZGV4IiwicmVzdWx0IiwiaSIsInNvdXJjZXMiLCJkaXNwb3NlIiwiZG9jdW1lbnQiLCJhZGRFdmVudExpc3RlbmVyIiwiYnJvd3NlciIsIl9icm93c2VyIiwiaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSIsInN0eWxlIiwicHJpbnQiLCJsb2dnZXIiLCJfYSIsIl9iIiwicmVtb3ZlRGV0ZWN0b3IiLCJtb3VudERldGVjdG9yIiwiZGVmaW5pdGlvbiIsIl8kZGVsZWdhdGVFdmVudHMiLCJTY29yZVBhbmVsIiwicHJvcHMiLCJfZWwkIiwiX3RtcGwkIiwiX2VsJDIiLCJmaXJzdENoaWxkIiwiX2VsJDMiLCJfZWwkNCIsIm5leHRTaWJsaW5nIiwiX2VsJDUiLCJfJGluc2VydCIsInNjb3JlIiwicmFuayIsIl8kY2xhc3NOYW1lIiwiY24iLCJjbGFzcyIsIkJ1dHRvbiIsImxvY2FsIiwib3RoZXJzIiwic3BsaXRQcm9wcyIsInZhcmlhbnQiLCJzaXplIiwiX3RtcGwkMyIsIl8kc3ByZWFkIiwiXyRtZXJnZVByb3BzIiwiZGlzYWJsZWQiLCJsb2FkaW5nIiwiZnVsbFdpZHRoIiwiXyRjcmVhdGVDb21wb25lbnQiLCJTaG93Iiwid2hlbiIsImxlZnRJY29uIiwiX3RtcGwkMiIsInJpZ2h0SWNvbiIsIkx5cmljc0Rpc3BsYXkiLCJjdXJyZW50TGluZUluZGV4Iiwic2V0Q3VycmVudExpbmVJbmRleCIsImNyZWF0ZVNpZ25hbCIsImNvbnRhaW5lclJlZiIsImdldExpbmVTY29yZSIsImxpbmVJbmRleCIsImxpbmVTY29yZXMiLCJmaW5kIiwicyIsImdldFNjb3JlU3R5bGUiLCJjb2xvciIsImNyZWF0ZUVmZmVjdCIsImN1cnJlbnRUaW1lIiwibHlyaWNzIiwibGVuZ3RoIiwidGltZSIsIlRJTUlOR19PRkZTRVQiLCJhZGp1c3RlZFRpbWUiLCJmb3VuZEluZGV4IiwibGluZSIsImVuZFRpbWUiLCJzdGFydFRpbWUiLCJkdXJhdGlvbiIsInByZXZJbmRleCIsIk1hdGgiLCJhYnMiLCJjb25zb2xlIiwibG9nIiwiZnJvbSIsInRvIiwidGltZUluU2Vjb25kcyIsImp1bXAiLCJ3YXJuIiwiZnJvbUxpbmUiLCJ0b0xpbmUiLCJpc1BsYXlpbmciLCJsaW5lRWxlbWVudHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwiY3VycmVudEVsZW1lbnQiLCJjb250YWluZXJIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJsaW5lVG9wIiwib2Zmc2V0VG9wIiwibGluZUhlaWdodCIsIm9mZnNldEhlaWdodCIsInRhcmdldFNjcm9sbFRvcCIsInNjcm9sbFRvIiwidG9wIiwiYmVoYXZpb3IiLCJfcmVmJCIsIl8kdXNlIiwiRm9yIiwiZWFjaCIsImxpbmVTY29yZSIsInNjb3JlU3R5bGUiLCJ0ZXh0IiwiXyRlZmZlY3QiLCJfcCQiLCJfdiQiLCJfdiQyIiwiX3YkMyIsImUiLCJfJHNldEF0dHJpYnV0ZSIsInQiLCJhIiwic2V0UHJvcGVydHkiLCJyZW1vdmVQcm9wZXJ0eSIsInVuZGVmaW5lZCIsIkxlYWRlcmJvYXJkUGFuZWwiLCJlbnRyaWVzIiwiZmFsbGJhY2siLCJlbnRyeSIsIl9lbCQ2IiwiX2VsJDciLCJ1c2VybmFtZSIsInRvTG9jYWxlU3RyaW5nIiwiaXNDdXJyZW50VXNlciIsIl92JDQiLCJvIiwic3BlZWRzIiwiU3BsaXRCdXR0b24iLCJjdXJyZW50U3BlZWRJbmRleCIsInNldEN1cnJlbnRTcGVlZEluZGV4IiwiY3VycmVudFNwZWVkIiwiY3ljbGVTcGVlZCIsInN0b3BQcm9wYWdhdGlvbiIsIm5leHRJbmRleCIsIm5ld1NwZWVkIiwib25TcGVlZENoYW5nZSIsIl8kYWRkRXZlbnRMaXN0ZW5lciIsIm9uU3RhcnQiLCIkJGNsaWNrIiwiX3YkNSIsIlRhYnNDb250ZXh0IiwiY3JlYXRlQ29udGV4dCIsIlRhYnMiLCJhY3RpdmVUYWIiLCJzZXRBY3RpdmVUYWIiLCJkZWZhdWx0VGFiIiwidGFicyIsImlkIiwiZmlyc3RUYWJJZCIsImhhbmRsZVRhYkNoYW5nZSIsIm9uVGFiQ2hhbmdlIiwiY29udGV4dFZhbHVlIiwiUHJvdmlkZXIiLCJUYWJzTGlzdCIsIlRhYnNUcmlnZ2VyIiwiY29udGV4dCIsInVzZUNvbnRleHQiLCJpc0FjdGl2ZSIsIlRhYnNDb250ZW50IiwiRmlyZUVtb2ppQW5pbWF0aW9uIiwic2hvd0ZpcmUiLCJzZXRTaG93RmlyZSIsImZpcmVYIiwic2V0RmlyZVgiLCJsYXN0TGluZUluZGV4IiwiaGlkZVRpbWVyIiwicmFuZG9tIiwic2V0VGltZW91dCIsIm9uQ2xlYW51cCIsInN0eWxlcyIsImZpcmVDb250YWluZXIiLCJmaXJlRW1vamkiLCJFeHRlbnNpb25LYXJhb2tlVmlldyIsImdldExhdGVzdEhpZ2hTY29yZUxpbmUiLCJzY29yZXMiLCJsYXRlc3QiLCJfdG1wbCQ1IiwiX3RtcGwkNiIsIl9lbCQ4IiwibGFiZWwiLCJfdG1wbCQ0IiwibGVhZGVyYm9hcmQiLCJJMThuQ29udGV4dCIsIkkxOG5Qcm92aWRlciIsImxvY2FsZSIsInNldExvY2FsZSIsImRlZmF1bHRMb2NhbGUiLCJ0cmFuc2xhdGlvbnMiLCJzZXRUcmFuc2xhdGlvbnMiLCJjdXJyZW50TG9jYWxlIiwibW9kdWxlIiwiZGVmYXVsdCIsIl9lIiwia2V5IiwicGFyYW1zIiwia2V5cyIsInNwbGl0IiwiayIsInJlcGxhY2UiLCJfIiwiU3RyaW5nIiwiZGlyIiwibnVtYmVyRm9ybWF0dGVyIiwiY3JlYXRlTWVtbyIsIkludGwiLCJOdW1iZXJGb3JtYXQiLCJmb3JtYXROdW1iZXIiLCJudW0iLCJmb3JtYXQiLCJmb3JtYXREYXRlIiwiZGF0ZSIsIm9wdGlvbnMiLCJEYXRlVGltZUZvcm1hdCIsInVzZUkxOG4iLCJFcnJvciIsIkNvbXBsZXRpb25WaWV3IiwiZ2V0RmVlZGJhY2tUZXh0IiwiZmVlZGJhY2tUZXh0IiwiX2VsJDkiLCJfZWwkMSIsIl9lbCQxMCIsIl9lbCQxMSIsIl9lbCQxMiIsIl9lbCQxMyIsInNwZWVkIiwib25QcmFjdGljZSIsIl9lbCQxNCIsIm9uQ2xpY2siLCJzYW1wbGVSYXRlIiwib2Zmc2V0IiwiUHJvZ3Jlc3NCYXIiLCJwZXJjZW50YWdlIiwibWluIiwibWF4IiwiY3VycmVudCIsInRvdGFsIiwiTWluaW1pemVkS2FyYW9rZSIsImN1cnJlbnRUYXJnZXQiLCJ0cmFuc2Zvcm0iLCJQcmFjdGljZUhlYWRlciIsInRpdGxlIiwiRXhlcmNpc2VGb290ZXIiLCJpc1JlY29yZGluZyIsIm9uU3RvcCIsImlzUHJvY2Vzc2luZyIsImNhblN1Ym1pdCIsIm9uUmVjb3JkIiwib25TdWJtaXQiLCJwIiwiUmVzcG9uc2VGb290ZXIiLCJtb2RlIiwiaXNDb3JyZWN0IiwiSWNvblhDaXJjbGVGaWxsIiwiSWNvbkNoZWNrQ2lyY2xlRmlsbCIsIl8kcCIsIl8kc3R5bGUiLCJvbkNvbnRpbnVlIiwiY29udGludWVMYWJlbCIsIm9uQ2hlY2siLCJFeGVyY2lzZVRlbXBsYXRlIiwiX2MkIiwiXyRtZW1vIiwiaW5zdHJ1Y3Rpb25UZXh0IiwiUmVhZEFsb3VkIiwicHJvbXB0IiwidXNlclRyYW5zY3JpcHQiLCJQcmFjdGljZUV4ZXJjaXNlVmlldyIsImN1cnJlbnRFeGVyY2lzZUluZGV4Iiwic2V0Q3VycmVudEV4ZXJjaXNlSW5kZXgiLCJzZXRJc1JlY29yZGluZyIsInNldElzUHJvY2Vzc2luZyIsInNldFVzZXJUcmFuc2NyaXB0IiwiY3VycmVudFNjb3JlIiwic2V0Q3VycmVudFNjb3JlIiwibWVkaWFSZWNvcmRlciIsInNldE1lZGlhUmVjb3JkZXIiLCJhdWRpb0NodW5rcyIsInNldEF1ZGlvQ2h1bmtzIiwic2hvd0ZlZWRiYWNrIiwic2V0U2hvd0ZlZWRiYWNrIiwic2V0SXNDb3JyZWN0IiwiYXBpQmFzZVVybCIsImV4ZXJjaXNlcyIsImNyZWF0ZVJlc291cmNlIiwidXJsIiwic2Vzc2lvbklkIiwiaGVhZGVycyIsImF1dGhUb2tlbiIsInJlc3BvbnNlIiwiZmV0Y2giLCJvayIsImVycm9yVGV4dCIsInN0YXR1cyIsImRhdGEiLCJqc29uIiwiaGFuZGxlU3RhcnRSZWNvcmRpbmciLCJzdHJlYW0iLCJuYXZpZ2F0b3IiLCJtZWRpYURldmljZXMiLCJnZXRVc2VyTWVkaWEiLCJhdWRpbyIsImVjaG9DYW5jZWxsYXRpb24iLCJub2lzZVN1cHByZXNzaW9uIiwiYXV0b0dhaW5Db250cm9sIiwibWltZVR5cGUiLCJNZWRpYVJlY29yZGVyIiwiaXNUeXBlU3VwcG9ydGVkIiwicmVjb3JkZXIiLCJjaHVua3MiLCJvbmRhdGFhdmFpbGFibGUiLCJldmVudCIsInB1c2giLCJvbnN0b3AiLCJhdWRpb0Jsb2IiLCJCbG9iIiwidHlwZSIsInByb2Nlc3NSZWNvcmRpbmciLCJnZXRUcmFja3MiLCJmb3JFYWNoIiwidHJhY2siLCJzdG9wIiwic3RhcnQiLCJibG9iIiwicmVhZGVyIiwiRmlsZVJlYWRlciIsImJhc2U2NCIsIlByb21pc2UiLCJyZXNvbHZlIiwib25sb2FkZW5kIiwiYmFzZTY0U3RyaW5nIiwicmVhZEFzRGF0YVVSTCIsImF0dGVtcHRzIiwibWF4QXR0ZW1wdHMiLCJtZXRob2QiLCJib2R5IiwiSlNPTiIsInN0cmluZ2lmeSIsImF1ZGlvQmFzZTY0IiwiZXhwZWN0ZWRUZXh0IiwiY3VycmVudEV4ZXJjaXNlIiwiZnVsbF9saW5lIiwicHJlZmVyRGVlcGdyYW0iLCJmZXRjaEVycm9yIiwidHJhbnNjcmlwdCIsImNhbGN1bGF0ZVNjb3JlIiwiaGFuZGxlQXV0b1N1Ym1pdCIsImhhbmRsZVN0b3BSZWNvcmRpbmciLCJzdGF0ZSIsImV4cGVjdGVkIiwiYWN0dWFsIiwiZXhwZWN0ZWRXb3JkcyIsInRvTG93ZXJDYXNlIiwiYWN0dWFsV29yZHMiLCJtYXRjaGVzIiwicm91bmQiLCJjYXJkX2lkcyIsImV4ZXJjaXNlSWQiLCJjYXJkU2NvcmVzIiwibWFwIiwiY2FyZElkIiwiaGFuZGxlU3VibWl0IiwiaGFuZGxlQ29udGludWUiLCJvbkJhY2siLCJleGVyY2lzZSIsImhlYWRlclRpdGxlIiwib25FeGl0IiwidHJpbSIsImthcmFva2VBcGkiLCJLYXJhb2tlQXBpU2VydmljZSIsIlByYWN0aWNlVmlldyIsIkNvbnRlbnRBcHAiLCJjdXJyZW50VHJhY2siLCJzZXRDdXJyZW50VHJhY2siLCJzZXRBdXRoVG9rZW4iLCJzaG93S2FyYW9rZSIsInNldFNob3dLYXJhb2tlIiwia2FyYW9rZURhdGEiLCJzZXRLYXJhb2tlRGF0YSIsInNldExvYWRpbmciLCJzZXNzaW9uU3RhcnRlZCIsInNldFNlc3Npb25TdGFydGVkIiwiaXNNaW5pbWl6ZWQiLCJzZXRJc01pbmltaXplZCIsImNvdW50ZG93biIsInNldENvdW50ZG93biIsInNldElzUGxheWluZyIsInNldEN1cnJlbnRUaW1lIiwiYXVkaW9SZWYiLCJzZXRBdWRpb1JlZiIsImthcmFva2VTZXNzaW9uIiwic2V0S2FyYW9rZVNlc3Npb24iLCJjb21wbGV0aW9uRGF0YSIsInNldENvbXBsZXRpb25EYXRhIiwic2hvd1ByYWN0aWNlIiwic2V0U2hvd1ByYWN0aWNlIiwic2VsZWN0ZWRTcGVlZCIsInNldFNlbGVjdGVkU3BlZWQiLCJvbk1vdW50IiwidG9rZW4iLCJnZXRBdXRoVG9rZW4iLCJjbGVhbnVwIiwidHJhY2tEZXRlY3RvciIsIndhdGNoRm9yQ2hhbmdlcyIsImZldGNoS2FyYW9rZURhdGEiLCJnZXRLYXJhb2tlRGF0YSIsInRyYWNrSWQiLCJhcnRpc3QiLCJoYW5kbGVTdGFydCIsImxpbmVzIiwidHJhY2tUaXRsZSIsInNvbmdEYXRhIiwic29uZyIsImhhc0x5cmljcyIsIm5ld1Nlc3Npb24iLCJ1c2VLYXJhb2tlU2Vzc2lvbiIsImFsYnVtIiwic29uZ0NhdGFsb2dJZCIsInNvbmdfY2F0YWxvZ19pZCIsImF1ZGlvRWxlbWVudCIsImFwaVVybCIsIm9uQ29tcGxldGUiLCJyZXN1bHRzIiwicGF1c2UiLCJoYW5kbGVTcGVlZENoYW5nZSIsInN0YXJ0U2Vzc2lvbiIsInNldEF1ZGlvRWxlbWVudCIsImNvdW50ZG93bkludGVydmFsIiwic2V0SW50ZXJ2YWwiLCJjbGVhckludGVydmFsIiwic3RhcnRBdWRpb1BsYXliYWNrIiwiYXVkaW9FbGVtZW50cyIsInNyYyIsInBhdXNlZCIsInNlc3Npb24iLCJhdWRpb1Byb2Nlc3NvciIsImlzUmVhZHkiLCJpbml0aWFsaXplIiwiY2F0Y2giLCJwbGF5IiwidGhlbiIsImVyciIsInBsYXlCdXR0b24iLCJxdWVyeVNlbGVjdG9yIiwiY2xpY2siLCJ1cGRhdGVUaW1lIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsIm5ld0F1ZGlvRWxlbWVudHMiLCJoYW5kbGVNaW5pbWl6ZSIsImhhbmRsZVJlc3RvcmUiLCJfdG1wbCQ3IiwiX3RtcGwkOCIsIl9lbCQwIiwicmF0ZSIsInBsYXliYWNrUmF0ZSIsIl9lbCQxNSIsIl90bXBsJDkiLCJpc0xvYWRpbmciLCJfdG1wbCQwIiwiZGVmaW5lQ29udGVudFNjcmlwdCIsInJ1bkF0IiwiY3NzSW5qZWN0aW9uTW9kZSIsIm1haW4iLCJjdHgiLCJ3aW5kb3ciLCJzZWxmIiwidWkiLCJjcmVhdGVTaGFkb3dSb290VWkiLCJuYW1lIiwicG9zaXRpb24iLCJhbmNob3IiLCJjb250YWluZXIiLCJnZXRSb290Tm9kZSIsInNoYWRvd1Jvb3QiLCJzdHlsZVNoZWV0cyIsIndyYXBwZXIiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwiYXBwZW5kQ2hpbGQiLCJnZXRDb21wdXRlZFN0eWxlIiwicmVuZGVyIiwib25SZW1vdmUiLCJtb3VudCIsImNvbW1vbiIsImthcmFva2UiLCJkaXNwbGF5Il0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFnSkEsUUFBTSxTQUFT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QUNFLE1BQU0sc0JBQXFCO0FBQUEsVUFDM0IsbUJBQW1CLEtBQUs7QUFBQSxVQUN4QixXQUFXLEtBQUssT0FBUSxFQUFDLFNBQVMsRUFBRSxFQUFFLE1BQU0sQ0FBQztBQUFBLFFBQzlDO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNMO0FBQUEsSUFDRSx5QkFBeUIsT0FBTzs7QUFDOUIsWUFBTSx5QkFBdUJDLE1BQUEsTUFBTSxTQUFOLGdCQUFBQSxJQUFZLFVBQVMsc0JBQXFCO0FBQ3ZFLFlBQU0sd0JBQXNCQyxNQUFBLE1BQU0sU0FBTixnQkFBQUEsSUFBWSx1QkFBc0IsS0FBSztBQUNuRSxZQUFNLGlCQUFpQixDQUFDLEtBQUssbUJBQW1CLEtBQUksV0FBTSxTQUFOLG1CQUFZLFNBQVM7QUFDekUsYUFBTyx3QkFBd0IsdUJBQXVCO0FBQUEsSUFDMUQ7QUFBQSxJQUNFLHNCQUFzQixTQUFTO0FBQzdCLFVBQUksVUFBVTtBQUNkLFlBQU0sS0FBSyxDQUFDLFVBQVU7QUFDcEIsWUFBSSxLQUFLLHlCQUF5QixLQUFLLEdBQUc7QUFDeEMsZUFBSyxtQkFBbUIsSUFBSSxNQUFNLEtBQUssU0FBUztBQUNoRCxnQkFBTSxXQUFXO0FBQ2pCLG9CQUFVO0FBQ1YsY0FBSSxhQUFZLG1DQUFTLGtCQUFrQjtBQUMzQyxlQUFLLGtCQUFtQjtBQUFBLFFBQ2hDO0FBQUEsTUFDSztBQUNELHVCQUFpQixXQUFXLEVBQUU7QUFDOUIsV0FBSyxjQUFjLE1BQU0sb0JBQW9CLFdBQVcsRUFBRSxDQUFDO0FBQUEsSUFDL0Q7QUFBQSxFQUNBO0FBckpFLGdCQVpXLHVCQVlKLCtCQUE4QjtBQUFBLElBQ25DO0FBQUEsRUFDRDtBQWRJLE1BQU0sdUJBQU47Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0RQLFFBQU1vTCxpQkFBNkI7QUFBQSxJQUFBLFFBQ2pDdVM7QUFBQUEsSUFBQSxTQUNBQztBQUFBQSxJQUNBQyxTQUFBQTtBQUFBQSxFQUNGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0pBLFFBQU0sZUFBNkI7QUFBQSxJQUNqQztBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDRjs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsMSwyLDMsNCw1LDYsNyw4LDksMTAsMTEsMTIsMTMsMTQsMTUsMzcsMzgsNTIsNTMsNTRdfQ==

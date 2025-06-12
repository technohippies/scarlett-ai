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
    var _a2;
    const [activeTab, setActiveTab] = createSignal(props.defaultTab || ((_a2 = props.tabs[0]) == null ? void 0 : _a2.id) || "");
    const handleTabChange = (id) => {
      var _a3;
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
  class ApiClient {
    constructor(config) {
      __publicField(this, "baseUrl");
      __publicField(this, "getAuthToken");
      __publicField(this, "onError");
      this.baseUrl = config.baseUrl.replace(/\/$/, "");
      this.getAuthToken = config.getAuthToken;
      this.onError = config.onError;
    }
    async request(path, options = {}) {
      try {
        const headers = {
          "Content-Type": "application/json",
          ...options.headers || {}
        };
        if (this.getAuthToken) {
          const token = await this.getAuthToken();
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
        }
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers
        });
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`API Error ${response.status}: ${error}`);
        }
        return await response.json();
      } catch (error) {
        if (this.onError) {
          this.onError(error);
        }
        throw error;
      }
    }
    // Health check
    async healthCheck() {
      try {
        await this.request("/health");
        return true;
      } catch {
        return false;
      }
    }
    // Auth endpoints
    async getDemoToken() {
      const response = await this.request("/auth/demo", {
        method: "POST"
      });
      return response.token;
    }
    async getUserCredits() {
      return this.request("/api/user/credits");
    }
    async purchaseCredits(request) {
      return this.request("/api/user/credits/purchase", {
        method: "POST",
        body: JSON.stringify(request)
      });
    }
    // Karaoke endpoints
    async getKaraokeData(trackId) {
      return this.request(`/api/karaoke/${encodeURIComponent(trackId)}`);
    }
    async startKaraokeSession(request) {
      return this.request("/api/karaoke/start", {
        method: "POST",
        body: JSON.stringify(request)
      });
    }
    async gradeKaraokeLine(request) {
      return this.request("/api/karaoke/grade", {
        method: "POST",
        body: JSON.stringify(request)
      });
    }
    async completeKaraokeSession(request) {
      return this.request("/api/karaoke/complete", {
        method: "POST",
        body: JSON.stringify(request)
      });
    }
    // Speech-to-text endpoints
    async transcribeAudio(request) {
      return this.request("/api/speech-to-text/transcribe", {
        method: "POST",
        body: JSON.stringify(request)
      });
    }
    // Practice endpoints
    async getPracticeExercises(sessionId, limit = 10) {
      const params = new URLSearchParams();
      if (sessionId) params.append("sessionId", sessionId);
      params.append("limit", limit.toString());
      return this.request(
        `/api/practice/exercises?${params}`
      );
    }
    async submitPracticeReview(cardId, score, reviewTime) {
      return this.request("/api/practice/review", {
        method: "POST",
        body: JSON.stringify({ cardId, score, reviewTime })
      });
    }
    // User endpoints
    async getUserBestScore(songId) {
      return this.request(
        `/api/users/me/songs/${songId}/best-score`
      );
    }
    // Leaderboard endpoints
    async getSongLeaderboard(songId, limit = 10) {
      return this.request(
        `/api/songs/${songId}/leaderboard?limit=${limit}`
      );
    }
  }
  content;
  class KaraokeEndpoint {
    constructor(client) {
      this.client = client;
    }
    /**
     * Fetch karaoke data for a track
     */
    async getData(trackId) {
      return this.client.getKaraokeData(trackId);
    }
    /**
     * Start a new karaoke session
     */
    async startSession(trackId, songData, songCatalogId) {
      const response = await this.client.startKaraokeSession({
        trackId,
        songData,
        songCatalogId
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to start session");
      }
      return response.data;
    }
    /**
     * Grade a karaoke line recording
     */
    async gradeLine(sessionId, lineIndex, audioBase64, expectedText, startTime, endTime) {
      const response = await this.client.gradeKaraokeLine({
        sessionId,
        lineIndex,
        audioBuffer: audioBase64,
        expectedText,
        startTime,
        endTime
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to grade line");
      }
      return response.data;
    }
    /**
     * Complete a karaoke session
     */
    async completeSession(sessionId, fullAudioBase64) {
      const response = await this.client.completeKaraokeSession({
        sessionId,
        fullAudioBuffer: fullAudioBase64
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to complete session");
      }
      return response.data;
    }
  }
  content;
  class PracticeEndpoint {
    constructor(client) {
      this.client = client;
    }
    /**
     * Get practice exercises for a user
     */
    async getExercises(sessionId, limit = 10) {
      const response = await this.client.getPracticeExercises(sessionId, limit);
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to fetch exercises");
      }
      return response.data;
    }
    /**
     * Submit a practice review
     */
    async submitReview(cardId, score, reviewTime = (/* @__PURE__ */ new Date()).toISOString()) {
      const response = await this.client.submitPracticeReview(
        cardId,
        score,
        reviewTime
      );
      if (!response.success) {
        throw new Error(response.error || "Failed to submit review");
      }
    }
  }
  content;
  class STTEndpoint {
    constructor(client) {
      this.client = client;
    }
    /**
     * Transcribe audio using speech-to-text
     */
    async transcribe(audioBase64, expectedText, preferDeepgram = false) {
      const response = await this.client.transcribeAudio({
        audioBase64,
        expectedText,
        preferDeepgram
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to transcribe audio");
      }
      return response.data;
    }
    /**
     * Transcribe with retry logic
     */
    async transcribeWithRetry(audioBase64, expectedText, maxRetries = 2) {
      let lastError = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result2 = await this.transcribe(
            audioBase64,
            expectedText,
            false
          );
          return result2;
        } catch (error) {
          lastError = error;
          console.log(`[STT] Attempt ${attempt}/${maxRetries} failed:`, error);
          if (attempt === 1) {
            try {
              console.log("[STT] Retrying with Deepgram...");
              const result2 = await this.transcribe(
                audioBase64,
                expectedText,
                true
              );
              return result2;
            } catch (deepgramError) {
              lastError = deepgramError;
              console.error("[STT] Deepgram also failed:", deepgramError);
            }
          }
        }
      }
      throw lastError || new Error("STT failed after retries");
    }
  }
  content;
  class AuthEndpoint {
    constructor(client) {
      this.client = client;
    }
    /**
     * Get a demo authentication token
     */
    async getDemoToken() {
      return this.client.getDemoToken();
    }
    /**
     * Get current user credits
     */
    async getUserCredits() {
      return this.client.getUserCredits();
    }
    /**
     * Purchase credits
     */
    async purchaseCredits(fid, credits, chain = "Base", transactionHash) {
      return this.client.purchaseCredits({
        fid,
        credits,
        chain,
        transactionHash
      });
    }
  }
  content;
  content;
  function createApiClient(config) {
    const client = new ApiClient(config);
    return {
      client,
      karaoke: new KaraokeEndpoint(client),
      practice: new PracticeEndpoint(client),
      stt: new STTEndpoint(client),
      auth: new AuthEndpoint(client),
      // Direct access to base methods
      healthCheck: () => client.healthCheck()
    };
  }
  content;
  let KaraokeApiService$1 = class KaraokeApiService {
    constructor(baseUrl = "http://localhost:8787") {
      __publicField(this, "client");
      this.client = createApiClient({ baseUrl });
    }
    async fetchKaraokeData(trackId) {
      try {
        return await this.client.karaoke.getData(trackId);
      } catch (error) {
        console.error("[KaraokeApi] Failed to fetch karaoke data:", error);
        return null;
      }
    }
    async startSession(trackId, songData, authToken, songCatalogId, playbackSpeed) {
      try {
        const session = await this.client.karaoke.startSession(
          trackId,
          songData,
          songCatalogId
        );
        return session;
      } catch (error) {
        console.error("[KaraokeApi] Failed to start session:", error);
        return null;
      }
    }
    async gradeRecording(sessionId, lineIndex, audioBuffer, expectedText, startTime, endTime, authToken, playbackSpeed) {
      try {
        const lineScore = await this.client.karaoke.gradeLine(
          sessionId,
          lineIndex,
          audioBuffer,
          expectedText,
          startTime,
          endTime
        );
        return lineScore;
      } catch (error) {
        console.error("[KaraokeApi] Failed to grade recording:", error);
        return null;
      }
    }
    async completeSession(sessionId, fullAudioBuffer) {
      try {
        const results = await this.client.karaoke.completeSession(
          sessionId,
          fullAudioBuffer
        );
        return results;
      } catch (error) {
        console.error("[KaraokeApi] Failed to complete session:", error);
        return null;
      }
    }
    async getUserBestScore(songId) {
      var _a2;
      try {
        const response = await this.client.client.getUserBestScore(songId);
        return ((_a2 = response.data) == null ? void 0 : _a2.score) ?? null;
      } catch (error) {
        console.error("[KaraokeApi] Failed to get user best score:", error);
        return null;
      }
    }
    async getSongLeaderboard(songId, limit = 10) {
      try {
        const response = await this.client.client.getSongLeaderboard(songId, limit);
        return response.data ?? [];
      } catch (error) {
        console.error("[KaraokeApi] Failed to get song leaderboard:", error);
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
  delegateEvents(["click"]);
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
    const normalizeText = (text) => {
      return text.toLowerCase().replace(/[^\w\s'-]/g, "").replace(/\s+/g, " ").trim();
    };
    const calculateScore = (expected, actual) => {
      const normalizedExpected = normalizeText(expected);
      const normalizedActual = normalizeText(actual);
      if (normalizedExpected === normalizedActual) {
        return 100;
      }
      const expectedWords = normalizedExpected.split(/\s+/);
      const actualWords = normalizedActual.split(/\s+/);
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
      setIsCorrect(score === 100);
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
      setPlaybackSpeed(speed2);
      const audio = audioElement();
      if (audio) {
        const rate = getPlaybackRate(speed2);
        audio.playbackRate = rate;
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
        return;
      }
      const ui = await createShadowRootUi(ctx, {
        name: "scarlett-karaoke-ui",
        position: "overlay",
        anchor: "body",
        onMount: async (container) => {
          const wrapper = document.createElement("div");
          wrapper.className = "karaoke-widget-container";
          container.appendChild(wrapper);
          const dispose2 = render(() => createComponent(ContentApp, {}), wrapper);
          return dispose2;
        },
        onRemove: (cleanup) => {
          cleanup == null ? void 0 : cleanup();
        }
      });
      ui.mount();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL2Rpc3QvZGV2LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL3dlYi9kaXN0L2Rldi5qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWUvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnQvbGliL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbnkta2V5cy1tYXAvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvZGVmdS9kaXN0L2RlZnUubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0AxbmF0c3Uvd2FpdC1lbGVtZW50L2Rpc3QvZGV0ZWN0b3JzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AMW5hdHN1L3dhaXQtZWxlbWVudC9kaXN0L2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYXJlZC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9jbHN4L2Rpc3QvY2xzeC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvY24udHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9sYXlvdXQvSGVhZGVyL0hlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9kaXNwbGF5L1Njb3JlUGFuZWwvU2NvcmVQYW5lbC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vQnV0dG9uL0J1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9vbmJvYXJkaW5nL09uYm9hcmRpbmdGbG93L09uYm9hcmRpbmdGbG93LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheS9MeXJpY3NEaXNwbGF5LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvS2FyYW9rZUhlYWRlci9LYXJhb2tlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbC9MZWFkZXJib2FyZFBhbmVsLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9TcGxpdEJ1dHRvbi9TcGxpdEJ1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vVGFicy9UYWJzLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2VmZmVjdHMvRmlyZUVtb2ppQW5pbWF0aW9uL0ZpcmVFbW9qaUFuaW1hdGlvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9rYXJhb2tlL0V4dGVuc2lvbkthcmFva2VWaWV3L0V4dGVuc2lvbkthcmFva2VWaWV3LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9pMThuL3Byb3ZpZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvQ29tcGxldGlvblZpZXcvQ29tcGxldGlvblZpZXcudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL3NlcnZpY2VzL2F1ZGlvL2thcmFva2VBdWRpb1Byb2Nlc3Nvci50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2NsaWVudC50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2VuZHBvaW50cy9rYXJhb2tlLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvZW5kcG9pbnRzL3ByYWN0aWNlLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvZW5kcG9pbnRzL3N0dC50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2VuZHBvaW50cy9hdXRoLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvaW5kZXgudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvc2VydmljZXMva2FyYW9rZS9rYXJhb2tlQXBpLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL3NlcnZpY2VzL2thcmFva2UvY2h1bmtpbmdVdGlscy50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9Qcm9ncmVzc0Jhci9Qcm9ncmVzc0Jhci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vTW9kYWwvTW9kYWwudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvTWluaW1pemVkS2FyYW9rZS50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9QcmFjdGljZUhlYWRlci9QcmFjdGljZUhlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9FeGVyY2lzZUZvb3Rlci9FeGVyY2lzZUZvb3Rlci50c3giLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvcGhvc3Bob3ItaWNvbnMtc29saWQvZGlzdC9JY29uQ2hlY2tDaXJjbGVGaWxsLmpzeCIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9waG9zcGhvci1pY29ucy1zb2xpZC9kaXN0L0ljb25YQ2lyY2xlRmlsbC5qc3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9SZXNwb25zZUZvb3Rlci9SZXNwb25zZUZvb3Rlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9FeGVyY2lzZVRlbXBsYXRlL0V4ZXJjaXNlVGVtcGxhdGUudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcHJhY3RpY2UvUmVhZEFsb3VkL1JlYWRBbG91ZC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9QcmFjdGljZUV4ZXJjaXNlVmlldy9QcmFjdGljZUV4ZXJjaXNlVmlldy50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy93ZWIvRmFyY2FzdGVyTWluaUFwcC9GYXJjYXN0ZXJNaW5pQXBwLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3dlYi9BdXRoQnV0dG9uL0F1dGhCdXR0b24udHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcGFnZXMvSG9tZVBhZ2UvSG9tZVBhZ2UudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2hvb2tzL3VzZUthcmFva2VTZXNzaW9uLnRzIiwiLi4vLi4vLi4vc3JjL3NlcnZpY2VzL3RyYWNrLWRldGVjdG9yLnRzIiwiLi4vLi4vLi4vc3JjL3V0aWxzL3N0b3JhZ2UudHMiLCIuLi8uLi8uLi9zcmMvc2VydmljZXMva2FyYW9rZS1hcGkudHMiLCIuLi8uLi8uLi9zcmMvdmlld3MvY29udGVudC9QcmFjdGljZVZpZXcudHN4IiwiLi4vLi4vLi4vc3JjL3ZpZXdzL2NvbnRlbnQvQ29udGVudEFwcC50c3giLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50LnRzeCIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9pMThuL2xvY2FsZXMvZW4vaW5kZXgudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvaTE4bi9sb2NhbGVzL3poLUNOL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImxldCB0YXNrSWRDb3VudGVyID0gMSxcbiAgaXNDYWxsYmFja1NjaGVkdWxlZCA9IGZhbHNlLFxuICBpc1BlcmZvcm1pbmdXb3JrID0gZmFsc2UsXG4gIHRhc2tRdWV1ZSA9IFtdLFxuICBjdXJyZW50VGFzayA9IG51bGwsXG4gIHNob3VsZFlpZWxkVG9Ib3N0ID0gbnVsbCxcbiAgeWllbGRJbnRlcnZhbCA9IDUsXG4gIGRlYWRsaW5lID0gMCxcbiAgbWF4WWllbGRJbnRlcnZhbCA9IDMwMCxcbiAgc2NoZWR1bGVDYWxsYmFjayA9IG51bGwsXG4gIHNjaGVkdWxlZENhbGxiYWNrID0gbnVsbDtcbmNvbnN0IG1heFNpZ25lZDMxQml0SW50ID0gMTA3Mzc0MTgyMztcbmZ1bmN0aW9uIHNldHVwU2NoZWR1bGVyKCkge1xuICBjb25zdCBjaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsKCksXG4gICAgcG9ydCA9IGNoYW5uZWwucG9ydDI7XG4gIHNjaGVkdWxlQ2FsbGJhY2sgPSAoKSA9PiBwb3J0LnBvc3RNZXNzYWdlKG51bGwpO1xuICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9ICgpID0+IHtcbiAgICBpZiAoc2NoZWR1bGVkQ2FsbGJhY2sgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBkZWFkbGluZSA9IGN1cnJlbnRUaW1lICsgeWllbGRJbnRlcnZhbDtcbiAgICAgIGNvbnN0IGhhc1RpbWVSZW1haW5pbmcgPSB0cnVlO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgaGFzTW9yZVdvcmsgPSBzY2hlZHVsZWRDYWxsYmFjayhoYXNUaW1lUmVtYWluaW5nLCBjdXJyZW50VGltZSk7XG4gICAgICAgIGlmICghaGFzTW9yZVdvcmspIHtcbiAgICAgICAgICBzY2hlZHVsZWRDYWxsYmFjayA9IG51bGw7XG4gICAgICAgIH0gZWxzZSBwb3J0LnBvc3RNZXNzYWdlKG51bGwpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9XG4gICAgfVxuICB9O1xuICBpZiAobmF2aWdhdG9yICYmIG5hdmlnYXRvci5zY2hlZHVsaW5nICYmIG5hdmlnYXRvci5zY2hlZHVsaW5nLmlzSW5wdXRQZW5kaW5nKSB7XG4gICAgY29uc3Qgc2NoZWR1bGluZyA9IG5hdmlnYXRvci5zY2hlZHVsaW5nO1xuICAgIHNob3VsZFlpZWxkVG9Ib3N0ID0gKCkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGlmIChjdXJyZW50VGltZSA+PSBkZWFkbGluZSkge1xuICAgICAgICBpZiAoc2NoZWR1bGluZy5pc0lucHV0UGVuZGluZygpKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGN1cnJlbnRUaW1lID49IG1heFlpZWxkSW50ZXJ2YWw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBzaG91bGRZaWVsZFRvSG9zdCA9ICgpID0+IHBlcmZvcm1hbmNlLm5vdygpID49IGRlYWRsaW5lO1xuICB9XG59XG5mdW5jdGlvbiBlbnF1ZXVlKHRhc2tRdWV1ZSwgdGFzaykge1xuICBmdW5jdGlvbiBmaW5kSW5kZXgoKSB7XG4gICAgbGV0IG0gPSAwO1xuICAgIGxldCBuID0gdGFza1F1ZXVlLmxlbmd0aCAtIDE7XG4gICAgd2hpbGUgKG0gPD0gbikge1xuICAgICAgY29uc3QgayA9IG4gKyBtID4+IDE7XG4gICAgICBjb25zdCBjbXAgPSB0YXNrLmV4cGlyYXRpb25UaW1lIC0gdGFza1F1ZXVlW2tdLmV4cGlyYXRpb25UaW1lO1xuICAgICAgaWYgKGNtcCA+IDApIG0gPSBrICsgMTtlbHNlIGlmIChjbXAgPCAwKSBuID0gayAtIDE7ZWxzZSByZXR1cm4gaztcbiAgICB9XG4gICAgcmV0dXJuIG07XG4gIH1cbiAgdGFza1F1ZXVlLnNwbGljZShmaW5kSW5kZXgoKSwgMCwgdGFzayk7XG59XG5mdW5jdGlvbiByZXF1ZXN0Q2FsbGJhY2soZm4sIG9wdGlvbnMpIHtcbiAgaWYgKCFzY2hlZHVsZUNhbGxiYWNrKSBzZXR1cFNjaGVkdWxlcigpO1xuICBsZXQgc3RhcnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCksXG4gICAgdGltZW91dCA9IG1heFNpZ25lZDMxQml0SW50O1xuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnRpbWVvdXQpIHRpbWVvdXQgPSBvcHRpb25zLnRpbWVvdXQ7XG4gIGNvbnN0IG5ld1Rhc2sgPSB7XG4gICAgaWQ6IHRhc2tJZENvdW50ZXIrKyxcbiAgICBmbixcbiAgICBzdGFydFRpbWUsXG4gICAgZXhwaXJhdGlvblRpbWU6IHN0YXJ0VGltZSArIHRpbWVvdXRcbiAgfTtcbiAgZW5xdWV1ZSh0YXNrUXVldWUsIG5ld1Rhc2spO1xuICBpZiAoIWlzQ2FsbGJhY2tTY2hlZHVsZWQgJiYgIWlzUGVyZm9ybWluZ1dvcmspIHtcbiAgICBpc0NhbGxiYWNrU2NoZWR1bGVkID0gdHJ1ZTtcbiAgICBzY2hlZHVsZWRDYWxsYmFjayA9IGZsdXNoV29yaztcbiAgICBzY2hlZHVsZUNhbGxiYWNrKCk7XG4gIH1cbiAgcmV0dXJuIG5ld1Rhc2s7XG59XG5mdW5jdGlvbiBjYW5jZWxDYWxsYmFjayh0YXNrKSB7XG4gIHRhc2suZm4gPSBudWxsO1xufVxuZnVuY3Rpb24gZmx1c2hXb3JrKGhhc1RpbWVSZW1haW5pbmcsIGluaXRpYWxUaW1lKSB7XG4gIGlzQ2FsbGJhY2tTY2hlZHVsZWQgPSBmYWxzZTtcbiAgaXNQZXJmb3JtaW5nV29yayA9IHRydWU7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHdvcmtMb29wKGhhc1RpbWVSZW1haW5pbmcsIGluaXRpYWxUaW1lKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBjdXJyZW50VGFzayA9IG51bGw7XG4gICAgaXNQZXJmb3JtaW5nV29yayA9IGZhbHNlO1xuICB9XG59XG5mdW5jdGlvbiB3b3JrTG9vcChoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSkge1xuICBsZXQgY3VycmVudFRpbWUgPSBpbml0aWFsVGltZTtcbiAgY3VycmVudFRhc2sgPSB0YXNrUXVldWVbMF0gfHwgbnVsbDtcbiAgd2hpbGUgKGN1cnJlbnRUYXNrICE9PSBudWxsKSB7XG4gICAgaWYgKGN1cnJlbnRUYXNrLmV4cGlyYXRpb25UaW1lID4gY3VycmVudFRpbWUgJiYgKCFoYXNUaW1lUmVtYWluaW5nIHx8IHNob3VsZFlpZWxkVG9Ib3N0KCkpKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY29uc3QgY2FsbGJhY2sgPSBjdXJyZW50VGFzay5mbjtcbiAgICBpZiAoY2FsbGJhY2sgIT09IG51bGwpIHtcbiAgICAgIGN1cnJlbnRUYXNrLmZuID0gbnVsbDtcbiAgICAgIGNvbnN0IGRpZFVzZXJDYWxsYmFja1RpbWVvdXQgPSBjdXJyZW50VGFzay5leHBpcmF0aW9uVGltZSA8PSBjdXJyZW50VGltZTtcbiAgICAgIGNhbGxiYWNrKGRpZFVzZXJDYWxsYmFja1RpbWVvdXQpO1xuICAgICAgY3VycmVudFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGlmIChjdXJyZW50VGFzayA9PT0gdGFza1F1ZXVlWzBdKSB7XG4gICAgICAgIHRhc2tRdWV1ZS5zaGlmdCgpO1xuICAgICAgfVxuICAgIH0gZWxzZSB0YXNrUXVldWUuc2hpZnQoKTtcbiAgICBjdXJyZW50VGFzayA9IHRhc2tRdWV1ZVswXSB8fCBudWxsO1xuICB9XG4gIHJldHVybiBjdXJyZW50VGFzayAhPT0gbnVsbDtcbn1cblxuY29uc3Qgc2hhcmVkQ29uZmlnID0ge1xuICBjb250ZXh0OiB1bmRlZmluZWQsXG4gIHJlZ2lzdHJ5OiB1bmRlZmluZWQsXG4gIGVmZmVjdHM6IHVuZGVmaW5lZCxcbiAgZG9uZTogZmFsc2UsXG4gIGdldENvbnRleHRJZCgpIHtcbiAgICByZXR1cm4gZ2V0Q29udGV4dElkKHRoaXMuY29udGV4dC5jb3VudCk7XG4gIH0sXG4gIGdldE5leHRDb250ZXh0SWQoKSB7XG4gICAgcmV0dXJuIGdldENvbnRleHRJZCh0aGlzLmNvbnRleHQuY291bnQrKyk7XG4gIH1cbn07XG5mdW5jdGlvbiBnZXRDb250ZXh0SWQoY291bnQpIHtcbiAgY29uc3QgbnVtID0gU3RyaW5nKGNvdW50KSxcbiAgICBsZW4gPSBudW0ubGVuZ3RoIC0gMTtcbiAgcmV0dXJuIHNoYXJlZENvbmZpZy5jb250ZXh0LmlkICsgKGxlbiA/IFN0cmluZy5mcm9tQ2hhckNvZGUoOTYgKyBsZW4pIDogXCJcIikgKyBudW07XG59XG5mdW5jdGlvbiBzZXRIeWRyYXRlQ29udGV4dChjb250ZXh0KSB7XG4gIHNoYXJlZENvbmZpZy5jb250ZXh0ID0gY29udGV4dDtcbn1cbmZ1bmN0aW9uIG5leHRIeWRyYXRlQ29udGV4dCgpIHtcbiAgcmV0dXJuIHtcbiAgICAuLi5zaGFyZWRDb25maWcuY29udGV4dCxcbiAgICBpZDogc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKSxcbiAgICBjb3VudDogMFxuICB9O1xufVxuXG5jb25zdCBJU19ERVYgPSB0cnVlO1xuY29uc3QgZXF1YWxGbiA9IChhLCBiKSA9PiBhID09PSBiO1xuY29uc3QgJFBST1hZID0gU3ltYm9sKFwic29saWQtcHJveHlcIik7XG5jb25zdCBTVVBQT1JUU19QUk9YWSA9IHR5cGVvZiBQcm94eSA9PT0gXCJmdW5jdGlvblwiO1xuY29uc3QgJFRSQUNLID0gU3ltYm9sKFwic29saWQtdHJhY2tcIik7XG5jb25zdCAkREVWQ09NUCA9IFN5bWJvbChcInNvbGlkLWRldi1jb21wb25lbnRcIik7XG5jb25zdCBzaWduYWxPcHRpb25zID0ge1xuICBlcXVhbHM6IGVxdWFsRm5cbn07XG5sZXQgRVJST1IgPSBudWxsO1xubGV0IHJ1bkVmZmVjdHMgPSBydW5RdWV1ZTtcbmNvbnN0IFNUQUxFID0gMTtcbmNvbnN0IFBFTkRJTkcgPSAyO1xuY29uc3QgVU5PV05FRCA9IHtcbiAgb3duZWQ6IG51bGwsXG4gIGNsZWFudXBzOiBudWxsLFxuICBjb250ZXh0OiBudWxsLFxuICBvd25lcjogbnVsbFxufTtcbmNvbnN0IE5PX0lOSVQgPSB7fTtcbnZhciBPd25lciA9IG51bGw7XG5sZXQgVHJhbnNpdGlvbiA9IG51bGw7XG5sZXQgU2NoZWR1bGVyID0gbnVsbDtcbmxldCBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IG51bGw7XG5sZXQgTGlzdGVuZXIgPSBudWxsO1xubGV0IFVwZGF0ZXMgPSBudWxsO1xubGV0IEVmZmVjdHMgPSBudWxsO1xubGV0IEV4ZWNDb3VudCA9IDA7XG5jb25zdCBEZXZIb29rcyA9IHtcbiAgYWZ0ZXJVcGRhdGU6IG51bGwsXG4gIGFmdGVyQ3JlYXRlT3duZXI6IG51bGwsXG4gIGFmdGVyQ3JlYXRlU2lnbmFsOiBudWxsLFxuICBhZnRlclJlZ2lzdGVyR3JhcGg6IG51bGxcbn07XG5mdW5jdGlvbiBjcmVhdGVSb290KGZuLCBkZXRhY2hlZE93bmVyKSB7XG4gIGNvbnN0IGxpc3RlbmVyID0gTGlzdGVuZXIsXG4gICAgb3duZXIgPSBPd25lcixcbiAgICB1bm93bmVkID0gZm4ubGVuZ3RoID09PSAwLFxuICAgIGN1cnJlbnQgPSBkZXRhY2hlZE93bmVyID09PSB1bmRlZmluZWQgPyBvd25lciA6IGRldGFjaGVkT3duZXIsXG4gICAgcm9vdCA9IHVub3duZWQgPyB7XG4gICAgICBvd25lZDogbnVsbCxcbiAgICAgIGNsZWFudXBzOiBudWxsLFxuICAgICAgY29udGV4dDogbnVsbCxcbiAgICAgIG93bmVyOiBudWxsXG4gICAgfSAgOiB7XG4gICAgICBvd25lZDogbnVsbCxcbiAgICAgIGNsZWFudXBzOiBudWxsLFxuICAgICAgY29udGV4dDogY3VycmVudCA/IGN1cnJlbnQuY29udGV4dCA6IG51bGwsXG4gICAgICBvd25lcjogY3VycmVudFxuICAgIH0sXG4gICAgdXBkYXRlRm4gPSB1bm93bmVkID8gKCkgPT4gZm4oKCkgPT4ge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRGlzcG9zZSBtZXRob2QgbXVzdCBiZSBhbiBleHBsaWNpdCBhcmd1bWVudCB0byBjcmVhdGVSb290IGZ1bmN0aW9uXCIpO1xuICAgIH0pICA6ICgpID0+IGZuKCgpID0+IHVudHJhY2soKCkgPT4gY2xlYW5Ob2RlKHJvb3QpKSk7XG4gIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIgJiYgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lcihyb290KTtcbiAgT3duZXIgPSByb290O1xuICBMaXN0ZW5lciA9IG51bGw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJ1blVwZGF0ZXModXBkYXRlRm4sIHRydWUpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gICAgT3duZXIgPSBvd25lcjtcbiAgfVxufVxuZnVuY3Rpb24gY3JlYXRlU2lnbmFsKHZhbHVlLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zID8gT2JqZWN0LmFzc2lnbih7fSwgc2lnbmFsT3B0aW9ucywgb3B0aW9ucykgOiBzaWduYWxPcHRpb25zO1xuICBjb25zdCBzID0ge1xuICAgIHZhbHVlLFxuICAgIG9ic2VydmVyczogbnVsbCxcbiAgICBvYnNlcnZlclNsb3RzOiBudWxsLFxuICAgIGNvbXBhcmF0b3I6IG9wdGlvbnMuZXF1YWxzIHx8IHVuZGVmaW5lZFxuICB9O1xuICB7XG4gICAgaWYgKG9wdGlvbnMubmFtZSkgcy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIGlmIChvcHRpb25zLmludGVybmFsKSB7XG4gICAgICBzLmludGVybmFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVnaXN0ZXJHcmFwaChzKTtcbiAgICAgIGlmIChEZXZIb29rcy5hZnRlckNyZWF0ZVNpZ25hbCkgRGV2SG9va3MuYWZ0ZXJDcmVhdGVTaWduYWwocyk7XG4gICAgfVxuICB9XG4gIGNvbnN0IHNldHRlciA9IHZhbHVlID0+IHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKHMpKSB2YWx1ZSA9IHZhbHVlKHMudFZhbHVlKTtlbHNlIHZhbHVlID0gdmFsdWUocy52YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiB3cml0ZVNpZ25hbChzLCB2YWx1ZSk7XG4gIH07XG4gIHJldHVybiBbcmVhZFNpZ25hbC5iaW5kKHMpLCBzZXR0ZXJdO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29tcHV0ZWQoZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIHRydWUsIFNUQUxFLCBvcHRpb25zICk7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIFVwZGF0ZXMucHVzaChjKTtlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlUmVuZGVyRWZmZWN0KGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCBmYWxzZSwgU1RBTEUsIG9wdGlvbnMgKTtcbiAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgVXBkYXRlcy5wdXNoKGMpO2Vsc2UgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG59XG5mdW5jdGlvbiBjcmVhdGVFZmZlY3QoZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIHJ1bkVmZmVjdHMgPSBydW5Vc2VyRWZmZWN0cztcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgZmFsc2UsIFNUQUxFLCBvcHRpb25zICksXG4gICAgcyA9IFN1c3BlbnNlQ29udGV4dCAmJiB1c2VDb250ZXh0KFN1c3BlbnNlQ29udGV4dCk7XG4gIGlmIChzKSBjLnN1c3BlbnNlID0gcztcbiAgaWYgKCFvcHRpb25zIHx8ICFvcHRpb25zLnJlbmRlcikgYy51c2VyID0gdHJ1ZTtcbiAgRWZmZWN0cyA/IEVmZmVjdHMucHVzaChjKSA6IHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlUmVhY3Rpb24ob25JbnZhbGlkYXRlLCBvcHRpb25zKSB7XG4gIGxldCBmbjtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKCgpID0+IHtcbiAgICAgIGZuID8gZm4oKSA6IHVudHJhY2sob25JbnZhbGlkYXRlKTtcbiAgICAgIGZuID0gdW5kZWZpbmVkO1xuICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UsIDAsIG9wdGlvbnMgKSxcbiAgICBzID0gU3VzcGVuc2VDb250ZXh0ICYmIHVzZUNvbnRleHQoU3VzcGVuc2VDb250ZXh0KTtcbiAgaWYgKHMpIGMuc3VzcGVuc2UgPSBzO1xuICBjLnVzZXIgPSB0cnVlO1xuICByZXR1cm4gdHJhY2tpbmcgPT4ge1xuICAgIGZuID0gdHJhY2tpbmc7XG4gICAgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIH07XG59XG5mdW5jdGlvbiBjcmVhdGVNZW1vKGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyA/IE9iamVjdC5hc3NpZ24oe30sIHNpZ25hbE9wdGlvbnMsIG9wdGlvbnMpIDogc2lnbmFsT3B0aW9ucztcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgdHJ1ZSwgMCwgb3B0aW9ucyApO1xuICBjLm9ic2VydmVycyA9IG51bGw7XG4gIGMub2JzZXJ2ZXJTbG90cyA9IG51bGw7XG4gIGMuY29tcGFyYXRvciA9IG9wdGlvbnMuZXF1YWxzIHx8IHVuZGVmaW5lZDtcbiAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGMudFN0YXRlID0gU1RBTEU7XG4gICAgVXBkYXRlcy5wdXNoKGMpO1xuICB9IGVsc2UgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIHJldHVybiByZWFkU2lnbmFsLmJpbmQoYyk7XG59XG5mdW5jdGlvbiBpc1Byb21pc2Uodikge1xuICByZXR1cm4gdiAmJiB0eXBlb2YgdiA9PT0gXCJvYmplY3RcIiAmJiBcInRoZW5cIiBpbiB2O1xufVxuZnVuY3Rpb24gY3JlYXRlUmVzb3VyY2UocFNvdXJjZSwgcEZldGNoZXIsIHBPcHRpb25zKSB7XG4gIGxldCBzb3VyY2U7XG4gIGxldCBmZXRjaGVyO1xuICBsZXQgb3B0aW9ucztcbiAgaWYgKHR5cGVvZiBwRmV0Y2hlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgc291cmNlID0gcFNvdXJjZTtcbiAgICBmZXRjaGVyID0gcEZldGNoZXI7XG4gICAgb3B0aW9ucyA9IHBPcHRpb25zIHx8IHt9O1xuICB9IGVsc2Uge1xuICAgIHNvdXJjZSA9IHRydWU7XG4gICAgZmV0Y2hlciA9IHBTb3VyY2U7XG4gICAgb3B0aW9ucyA9IHBGZXRjaGVyIHx8IHt9O1xuICB9XG4gIGxldCBwciA9IG51bGwsXG4gICAgaW5pdFAgPSBOT19JTklULFxuICAgIGlkID0gbnVsbCxcbiAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBmYWxzZSxcbiAgICBzY2hlZHVsZWQgPSBmYWxzZSxcbiAgICByZXNvbHZlZCA9IFwiaW5pdGlhbFZhbHVlXCIgaW4gb3B0aW9ucyxcbiAgICBkeW5hbWljID0gdHlwZW9mIHNvdXJjZSA9PT0gXCJmdW5jdGlvblwiICYmIGNyZWF0ZU1lbW8oc291cmNlKTtcbiAgY29uc3QgY29udGV4dHMgPSBuZXcgU2V0KCksXG4gICAgW3ZhbHVlLCBzZXRWYWx1ZV0gPSAob3B0aW9ucy5zdG9yYWdlIHx8IGNyZWF0ZVNpZ25hbCkob3B0aW9ucy5pbml0aWFsVmFsdWUpLFxuICAgIFtlcnJvciwgc2V0RXJyb3JdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCksXG4gICAgW3RyYWNrLCB0cmlnZ2VyXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQsIHtcbiAgICAgIGVxdWFsczogZmFsc2VcbiAgICB9KSxcbiAgICBbc3RhdGUsIHNldFN0YXRlXSA9IGNyZWF0ZVNpZ25hbChyZXNvbHZlZCA/IFwicmVhZHlcIiA6IFwidW5yZXNvbHZlZFwiKTtcbiAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0KSB7XG4gICAgaWQgPSBzaGFyZWRDb25maWcuZ2V0TmV4dENvbnRleHRJZCgpO1xuICAgIGlmIChvcHRpb25zLnNzckxvYWRGcm9tID09PSBcImluaXRpYWxcIikgaW5pdFAgPSBvcHRpb25zLmluaXRpYWxWYWx1ZTtlbHNlIGlmIChzaGFyZWRDb25maWcubG9hZCAmJiBzaGFyZWRDb25maWcuaGFzKGlkKSkgaW5pdFAgPSBzaGFyZWRDb25maWcubG9hZChpZCk7XG4gIH1cbiAgZnVuY3Rpb24gbG9hZEVuZChwLCB2LCBlcnJvciwga2V5KSB7XG4gICAgaWYgKHByID09PSBwKSB7XG4gICAgICBwciA9IG51bGw7XG4gICAgICBrZXkgIT09IHVuZGVmaW5lZCAmJiAocmVzb2x2ZWQgPSB0cnVlKTtcbiAgICAgIGlmICgocCA9PT0gaW5pdFAgfHwgdiA9PT0gaW5pdFApICYmIG9wdGlvbnMub25IeWRyYXRlZCkgcXVldWVNaWNyb3Rhc2soKCkgPT4gb3B0aW9ucy5vbkh5ZHJhdGVkKGtleSwge1xuICAgICAgICB2YWx1ZTogdlxuICAgICAgfSkpO1xuICAgICAgaW5pdFAgPSBOT19JTklUO1xuICAgICAgaWYgKFRyYW5zaXRpb24gJiYgcCAmJiBsb2FkZWRVbmRlclRyYW5zaXRpb24pIHtcbiAgICAgICAgVHJhbnNpdGlvbi5wcm9taXNlcy5kZWxldGUocCk7XG4gICAgICAgIGxvYWRlZFVuZGVyVHJhbnNpdGlvbiA9IGZhbHNlO1xuICAgICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgIGNvbXBsZXRlTG9hZCh2LCBlcnJvcik7XG4gICAgICAgIH0sIGZhbHNlKTtcbiAgICAgIH0gZWxzZSBjb21wbGV0ZUxvYWQodiwgZXJyb3IpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuICBmdW5jdGlvbiBjb21wbGV0ZUxvYWQodiwgZXJyKSB7XG4gICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICBpZiAoZXJyID09PSB1bmRlZmluZWQpIHNldFZhbHVlKCgpID0+IHYpO1xuICAgICAgc2V0U3RhdGUoZXJyICE9PSB1bmRlZmluZWQgPyBcImVycm9yZWRcIiA6IHJlc29sdmVkID8gXCJyZWFkeVwiIDogXCJ1bnJlc29sdmVkXCIpO1xuICAgICAgc2V0RXJyb3IoZXJyKTtcbiAgICAgIGZvciAoY29uc3QgYyBvZiBjb250ZXh0cy5rZXlzKCkpIGMuZGVjcmVtZW50KCk7XG4gICAgICBjb250ZXh0cy5jbGVhcigpO1xuICAgIH0sIGZhbHNlKTtcbiAgfVxuICBmdW5jdGlvbiByZWFkKCkge1xuICAgIGNvbnN0IGMgPSBTdXNwZW5zZUNvbnRleHQgJiYgdXNlQ29udGV4dChTdXNwZW5zZUNvbnRleHQpLFxuICAgICAgdiA9IHZhbHVlKCksXG4gICAgICBlcnIgPSBlcnJvcigpO1xuICAgIGlmIChlcnIgIT09IHVuZGVmaW5lZCAmJiAhcHIpIHRocm93IGVycjtcbiAgICBpZiAoTGlzdGVuZXIgJiYgIUxpc3RlbmVyLnVzZXIgJiYgYykge1xuICAgICAgY3JlYXRlQ29tcHV0ZWQoKCkgPT4ge1xuICAgICAgICB0cmFjaygpO1xuICAgICAgICBpZiAocHIpIHtcbiAgICAgICAgICBpZiAoYy5yZXNvbHZlZCAmJiBUcmFuc2l0aW9uICYmIGxvYWRlZFVuZGVyVHJhbnNpdGlvbikgVHJhbnNpdGlvbi5wcm9taXNlcy5hZGQocHIpO2Vsc2UgaWYgKCFjb250ZXh0cy5oYXMoYykpIHtcbiAgICAgICAgICAgIGMuaW5jcmVtZW50KCk7XG4gICAgICAgICAgICBjb250ZXh0cy5hZGQoYyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cbiAgZnVuY3Rpb24gbG9hZChyZWZldGNoaW5nID0gdHJ1ZSkge1xuICAgIGlmIChyZWZldGNoaW5nICE9PSBmYWxzZSAmJiBzY2hlZHVsZWQpIHJldHVybjtcbiAgICBzY2hlZHVsZWQgPSBmYWxzZTtcbiAgICBjb25zdCBsb29rdXAgPSBkeW5hbWljID8gZHluYW1pYygpIDogc291cmNlO1xuICAgIGxvYWRlZFVuZGVyVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgIGlmIChsb29rdXAgPT0gbnVsbCB8fCBsb29rdXAgPT09IGZhbHNlKSB7XG4gICAgICBsb2FkRW5kKHByLCB1bnRyYWNrKHZhbHVlKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChUcmFuc2l0aW9uICYmIHByKSBUcmFuc2l0aW9uLnByb21pc2VzLmRlbGV0ZShwcik7XG4gICAgbGV0IGVycm9yO1xuICAgIGNvbnN0IHAgPSBpbml0UCAhPT0gTk9fSU5JVCA/IGluaXRQIDogdW50cmFjaygoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gZmV0Y2hlcihsb29rdXAsIHtcbiAgICAgICAgICB2YWx1ZTogdmFsdWUoKSxcbiAgICAgICAgICByZWZldGNoaW5nXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZmV0Y2hlckVycm9yKSB7XG4gICAgICAgIGVycm9yID0gZmV0Y2hlckVycm9yO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChlcnJvciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsb2FkRW5kKHByLCB1bmRlZmluZWQsIGNhc3RFcnJvcihlcnJvciksIGxvb2t1cCk7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmICghaXNQcm9taXNlKHApKSB7XG4gICAgICBsb2FkRW5kKHByLCBwLCB1bmRlZmluZWQsIGxvb2t1cCk7XG4gICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgcHIgPSBwO1xuICAgIGlmIChcInZcIiBpbiBwKSB7XG4gICAgICBpZiAocC5zID09PSAxKSBsb2FkRW5kKHByLCBwLnYsIHVuZGVmaW5lZCwgbG9va3VwKTtlbHNlIGxvYWRFbmQocHIsIHVuZGVmaW5lZCwgY2FzdEVycm9yKHAudiksIGxvb2t1cCk7XG4gICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgc2NoZWR1bGVkID0gdHJ1ZTtcbiAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiBzY2hlZHVsZWQgPSBmYWxzZSk7XG4gICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICBzZXRTdGF0ZShyZXNvbHZlZCA/IFwicmVmcmVzaGluZ1wiIDogXCJwZW5kaW5nXCIpO1xuICAgICAgdHJpZ2dlcigpO1xuICAgIH0sIGZhbHNlKTtcbiAgICByZXR1cm4gcC50aGVuKHYgPT4gbG9hZEVuZChwLCB2LCB1bmRlZmluZWQsIGxvb2t1cCksIGUgPT4gbG9hZEVuZChwLCB1bmRlZmluZWQsIGNhc3RFcnJvcihlKSwgbG9va3VwKSk7XG4gIH1cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMocmVhZCwge1xuICAgIHN0YXRlOiB7XG4gICAgICBnZXQ6ICgpID0+IHN0YXRlKClcbiAgICB9LFxuICAgIGVycm9yOiB7XG4gICAgICBnZXQ6ICgpID0+IGVycm9yKClcbiAgICB9LFxuICAgIGxvYWRpbmc6IHtcbiAgICAgIGdldCgpIHtcbiAgICAgICAgY29uc3QgcyA9IHN0YXRlKCk7XG4gICAgICAgIHJldHVybiBzID09PSBcInBlbmRpbmdcIiB8fCBzID09PSBcInJlZnJlc2hpbmdcIjtcbiAgICAgIH1cbiAgICB9LFxuICAgIGxhdGVzdDoge1xuICAgICAgZ2V0KCkge1xuICAgICAgICBpZiAoIXJlc29sdmVkKSByZXR1cm4gcmVhZCgpO1xuICAgICAgICBjb25zdCBlcnIgPSBlcnJvcigpO1xuICAgICAgICBpZiAoZXJyICYmICFwcikgdGhyb3cgZXJyO1xuICAgICAgICByZXR1cm4gdmFsdWUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuICBsZXQgb3duZXIgPSBPd25lcjtcbiAgaWYgKGR5bmFtaWMpIGNyZWF0ZUNvbXB1dGVkKCgpID0+IChvd25lciA9IE93bmVyLCBsb2FkKGZhbHNlKSkpO2Vsc2UgbG9hZChmYWxzZSk7XG4gIHJldHVybiBbcmVhZCwge1xuICAgIHJlZmV0Y2g6IGluZm8gPT4gcnVuV2l0aE93bmVyKG93bmVyLCAoKSA9PiBsb2FkKGluZm8pKSxcbiAgICBtdXRhdGU6IHNldFZhbHVlXG4gIH1dO1xufVxuZnVuY3Rpb24gY3JlYXRlRGVmZXJyZWQoc291cmNlLCBvcHRpb25zKSB7XG4gIGxldCB0LFxuICAgIHRpbWVvdXQgPSBvcHRpb25zID8gb3B0aW9ucy50aW1lb3V0TXMgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IG5vZGUgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB7XG4gICAgaWYgKCF0IHx8ICF0LmZuKSB0ID0gcmVxdWVzdENhbGxiYWNrKCgpID0+IHNldERlZmVycmVkKCgpID0+IG5vZGUudmFsdWUpLCB0aW1lb3V0ICE9PSB1bmRlZmluZWQgPyB7XG4gICAgICB0aW1lb3V0XG4gICAgfSA6IHVuZGVmaW5lZCk7XG4gICAgcmV0dXJuIHNvdXJjZSgpO1xuICB9LCB1bmRlZmluZWQsIHRydWUpO1xuICBjb25zdCBbZGVmZXJyZWQsIHNldERlZmVycmVkXSA9IGNyZWF0ZVNpZ25hbChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlLCBvcHRpb25zKTtcbiAgdXBkYXRlQ29tcHV0YXRpb24obm9kZSk7XG4gIHNldERlZmVycmVkKCgpID0+IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUpO1xuICByZXR1cm4gZGVmZXJyZWQ7XG59XG5mdW5jdGlvbiBjcmVhdGVTZWxlY3Rvcihzb3VyY2UsIGZuID0gZXF1YWxGbiwgb3B0aW9ucykge1xuICBjb25zdCBzdWJzID0gbmV3IE1hcCgpO1xuICBjb25zdCBub2RlID0gY3JlYXRlQ29tcHV0YXRpb24ocCA9PiB7XG4gICAgY29uc3QgdiA9IHNvdXJjZSgpO1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsXSBvZiBzdWJzLmVudHJpZXMoKSkgaWYgKGZuKGtleSwgdikgIT09IGZuKGtleSwgcCkpIHtcbiAgICAgIGZvciAoY29uc3QgYyBvZiB2YWwudmFsdWVzKCkpIHtcbiAgICAgICAgYy5zdGF0ZSA9IFNUQUxFO1xuICAgICAgICBpZiAoYy5wdXJlKSBVcGRhdGVzLnB1c2goYyk7ZWxzZSBFZmZlY3RzLnB1c2goYyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9LCB1bmRlZmluZWQsIHRydWUsIFNUQUxFLCBvcHRpb25zICk7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICByZXR1cm4ga2V5ID0+IHtcbiAgICBjb25zdCBsaXN0ZW5lciA9IExpc3RlbmVyO1xuICAgIGlmIChsaXN0ZW5lcikge1xuICAgICAgbGV0IGw7XG4gICAgICBpZiAobCA9IHN1YnMuZ2V0KGtleSkpIGwuYWRkKGxpc3RlbmVyKTtlbHNlIHN1YnMuc2V0KGtleSwgbCA9IG5ldyBTZXQoW2xpc3RlbmVyXSkpO1xuICAgICAgb25DbGVhbnVwKCgpID0+IHtcbiAgICAgICAgbC5kZWxldGUobGlzdGVuZXIpO1xuICAgICAgICAhbC5zaXplICYmIHN1YnMuZGVsZXRlKGtleSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGZuKGtleSwgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSk7XG4gIH07XG59XG5mdW5jdGlvbiBiYXRjaChmbikge1xuICByZXR1cm4gcnVuVXBkYXRlcyhmbiwgZmFsc2UpO1xufVxuZnVuY3Rpb24gdW50cmFjayhmbikge1xuICBpZiAoIUV4dGVybmFsU291cmNlQ29uZmlnICYmIExpc3RlbmVyID09PSBudWxsKSByZXR1cm4gZm4oKTtcbiAgY29uc3QgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgTGlzdGVuZXIgPSBudWxsO1xuICB0cnkge1xuICAgIGlmIChFeHRlcm5hbFNvdXJjZUNvbmZpZykgcmV0dXJuIEV4dGVybmFsU291cmNlQ29uZmlnLnVudHJhY2soZm4pO1xuICAgIHJldHVybiBmbigpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIG9uKGRlcHMsIGZuLCBvcHRpb25zKSB7XG4gIGNvbnN0IGlzQXJyYXkgPSBBcnJheS5pc0FycmF5KGRlcHMpO1xuICBsZXQgcHJldklucHV0O1xuICBsZXQgZGVmZXIgPSBvcHRpb25zICYmIG9wdGlvbnMuZGVmZXI7XG4gIHJldHVybiBwcmV2VmFsdWUgPT4ge1xuICAgIGxldCBpbnB1dDtcbiAgICBpZiAoaXNBcnJheSkge1xuICAgICAgaW5wdXQgPSBBcnJheShkZXBzLmxlbmd0aCk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRlcHMubGVuZ3RoOyBpKyspIGlucHV0W2ldID0gZGVwc1tpXSgpO1xuICAgIH0gZWxzZSBpbnB1dCA9IGRlcHMoKTtcbiAgICBpZiAoZGVmZXIpIHtcbiAgICAgIGRlZmVyID0gZmFsc2U7XG4gICAgICByZXR1cm4gcHJldlZhbHVlO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSB1bnRyYWNrKCgpID0+IGZuKGlucHV0LCBwcmV2SW5wdXQsIHByZXZWYWx1ZSkpO1xuICAgIHByZXZJbnB1dCA9IGlucHV0O1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG59XG5mdW5jdGlvbiBvbk1vdW50KGZuKSB7XG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB1bnRyYWNrKGZuKSk7XG59XG5mdW5jdGlvbiBvbkNsZWFudXAoZm4pIHtcbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJjbGVhbnVwcyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBydW5cIik7ZWxzZSBpZiAoT3duZXIuY2xlYW51cHMgPT09IG51bGwpIE93bmVyLmNsZWFudXBzID0gW2ZuXTtlbHNlIE93bmVyLmNsZWFudXBzLnB1c2goZm4pO1xuICByZXR1cm4gZm47XG59XG5mdW5jdGlvbiBjYXRjaEVycm9yKGZuLCBoYW5kbGVyKSB7XG4gIEVSUk9SIHx8IChFUlJPUiA9IFN5bWJvbChcImVycm9yXCIpKTtcbiAgT3duZXIgPSBjcmVhdGVDb21wdXRhdGlvbih1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIE93bmVyLmNvbnRleHQgPSB7XG4gICAgLi4uT3duZXIuY29udGV4dCxcbiAgICBbRVJST1JdOiBbaGFuZGxlcl1cbiAgfTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKE93bmVyKTtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZm4oKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaGFuZGxlRXJyb3IoZXJyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBPd25lciA9IE93bmVyLm93bmVyO1xuICB9XG59XG5mdW5jdGlvbiBnZXRMaXN0ZW5lcigpIHtcbiAgcmV0dXJuIExpc3RlbmVyO1xufVxuZnVuY3Rpb24gZ2V0T3duZXIoKSB7XG4gIHJldHVybiBPd25lcjtcbn1cbmZ1bmN0aW9uIHJ1bldpdGhPd25lcihvLCBmbikge1xuICBjb25zdCBwcmV2ID0gT3duZXI7XG4gIGNvbnN0IHByZXZMaXN0ZW5lciA9IExpc3RlbmVyO1xuICBPd25lciA9IG87XG4gIExpc3RlbmVyID0gbnVsbDtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcnVuVXBkYXRlcyhmbiwgdHJ1ZSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGhhbmRsZUVycm9yKGVycik7XG4gIH0gZmluYWxseSB7XG4gICAgT3duZXIgPSBwcmV2O1xuICAgIExpc3RlbmVyID0gcHJldkxpc3RlbmVyO1xuICB9XG59XG5mdW5jdGlvbiBlbmFibGVTY2hlZHVsaW5nKHNjaGVkdWxlciA9IHJlcXVlc3RDYWxsYmFjaykge1xuICBTY2hlZHVsZXIgPSBzY2hlZHVsZXI7XG59XG5mdW5jdGlvbiBzdGFydFRyYW5zaXRpb24oZm4pIHtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgZm4oKTtcbiAgICByZXR1cm4gVHJhbnNpdGlvbi5kb25lO1xuICB9XG4gIGNvbnN0IGwgPSBMaXN0ZW5lcjtcbiAgY29uc3QgbyA9IE93bmVyO1xuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbigoKSA9PiB7XG4gICAgTGlzdGVuZXIgPSBsO1xuICAgIE93bmVyID0gbztcbiAgICBsZXQgdDtcbiAgICBpZiAoU2NoZWR1bGVyIHx8IFN1c3BlbnNlQ29udGV4dCkge1xuICAgICAgdCA9IFRyYW5zaXRpb24gfHwgKFRyYW5zaXRpb24gPSB7XG4gICAgICAgIHNvdXJjZXM6IG5ldyBTZXQoKSxcbiAgICAgICAgZWZmZWN0czogW10sXG4gICAgICAgIHByb21pc2VzOiBuZXcgU2V0KCksXG4gICAgICAgIGRpc3Bvc2VkOiBuZXcgU2V0KCksXG4gICAgICAgIHF1ZXVlOiBuZXcgU2V0KCksXG4gICAgICAgIHJ1bm5pbmc6IHRydWVcbiAgICAgIH0pO1xuICAgICAgdC5kb25lIHx8ICh0LmRvbmUgPSBuZXcgUHJvbWlzZShyZXMgPT4gdC5yZXNvbHZlID0gcmVzKSk7XG4gICAgICB0LnJ1bm5pbmcgPSB0cnVlO1xuICAgIH1cbiAgICBydW5VcGRhdGVzKGZuLCBmYWxzZSk7XG4gICAgTGlzdGVuZXIgPSBPd25lciA9IG51bGw7XG4gICAgcmV0dXJuIHQgPyB0LmRvbmUgOiB1bmRlZmluZWQ7XG4gIH0pO1xufVxuY29uc3QgW3RyYW5zUGVuZGluZywgc2V0VHJhbnNQZW5kaW5nXSA9IC8qQF9fUFVSRV9fKi9jcmVhdGVTaWduYWwoZmFsc2UpO1xuZnVuY3Rpb24gdXNlVHJhbnNpdGlvbigpIHtcbiAgcmV0dXJuIFt0cmFuc1BlbmRpbmcsIHN0YXJ0VHJhbnNpdGlvbl07XG59XG5mdW5jdGlvbiByZXN1bWVFZmZlY3RzKGUpIHtcbiAgRWZmZWN0cy5wdXNoLmFwcGx5KEVmZmVjdHMsIGUpO1xuICBlLmxlbmd0aCA9IDA7XG59XG5mdW5jdGlvbiBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMpIHtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKCgpID0+IHVudHJhY2soKCkgPT4ge1xuICAgIE9iamVjdC5hc3NpZ24oQ29tcCwge1xuICAgICAgWyRERVZDT01QXTogdHJ1ZVxuICAgIH0pO1xuICAgIHJldHVybiBDb21wKHByb3BzKTtcbiAgfSksIHVuZGVmaW5lZCwgdHJ1ZSwgMCk7XG4gIGMucHJvcHMgPSBwcm9wcztcbiAgYy5vYnNlcnZlcnMgPSBudWxsO1xuICBjLm9ic2VydmVyU2xvdHMgPSBudWxsO1xuICBjLm5hbWUgPSBDb21wLm5hbWU7XG4gIGMuY29tcG9uZW50ID0gQ29tcDtcbiAgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIHJldHVybiBjLnRWYWx1ZSAhPT0gdW5kZWZpbmVkID8gYy50VmFsdWUgOiBjLnZhbHVlO1xufVxuZnVuY3Rpb24gcmVnaXN0ZXJHcmFwaCh2YWx1ZSkge1xuICBpZiAoT3duZXIpIHtcbiAgICBpZiAoT3duZXIuc291cmNlTWFwKSBPd25lci5zb3VyY2VNYXAucHVzaCh2YWx1ZSk7ZWxzZSBPd25lci5zb3VyY2VNYXAgPSBbdmFsdWVdO1xuICAgIHZhbHVlLmdyYXBoID0gT3duZXI7XG4gIH1cbiAgaWYgKERldkhvb2tzLmFmdGVyUmVnaXN0ZXJHcmFwaCkgRGV2SG9va3MuYWZ0ZXJSZWdpc3RlckdyYXBoKHZhbHVlKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbnRleHQoZGVmYXVsdFZhbHVlLCBvcHRpb25zKSB7XG4gIGNvbnN0IGlkID0gU3ltYm9sKFwiY29udGV4dFwiKTtcbiAgcmV0dXJuIHtcbiAgICBpZCxcbiAgICBQcm92aWRlcjogY3JlYXRlUHJvdmlkZXIoaWQsIG9wdGlvbnMpLFxuICAgIGRlZmF1bHRWYWx1ZVxuICB9O1xufVxuZnVuY3Rpb24gdXNlQ29udGV4dChjb250ZXh0KSB7XG4gIGxldCB2YWx1ZTtcbiAgcmV0dXJuIE93bmVyICYmIE93bmVyLmNvbnRleHQgJiYgKHZhbHVlID0gT3duZXIuY29udGV4dFtjb250ZXh0LmlkXSkgIT09IHVuZGVmaW5lZCA/IHZhbHVlIDogY29udGV4dC5kZWZhdWx0VmFsdWU7XG59XG5mdW5jdGlvbiBjaGlsZHJlbihmbikge1xuICBjb25zdCBjaGlsZHJlbiA9IGNyZWF0ZU1lbW8oZm4pO1xuICBjb25zdCBtZW1vID0gY3JlYXRlTWVtbygoKSA9PiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4oKSksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwiY2hpbGRyZW5cIlxuICB9KSA7XG4gIG1lbW8udG9BcnJheSA9ICgpID0+IHtcbiAgICBjb25zdCBjID0gbWVtbygpO1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KGMpID8gYyA6IGMgIT0gbnVsbCA/IFtjXSA6IFtdO1xuICB9O1xuICByZXR1cm4gbWVtbztcbn1cbmxldCBTdXNwZW5zZUNvbnRleHQ7XG5mdW5jdGlvbiBnZXRTdXNwZW5zZUNvbnRleHQoKSB7XG4gIHJldHVybiBTdXNwZW5zZUNvbnRleHQgfHwgKFN1c3BlbnNlQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQoKSk7XG59XG5mdW5jdGlvbiBlbmFibGVFeHRlcm5hbFNvdXJjZShmYWN0b3J5LCB1bnRyYWNrID0gZm4gPT4gZm4oKSkge1xuICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcpIHtcbiAgICBjb25zdCB7XG4gICAgICBmYWN0b3J5OiBvbGRGYWN0b3J5LFxuICAgICAgdW50cmFjazogb2xkVW50cmFja1xuICAgIH0gPSBFeHRlcm5hbFNvdXJjZUNvbmZpZztcbiAgICBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IHtcbiAgICAgIGZhY3Rvcnk6IChmbiwgdHJpZ2dlcikgPT4ge1xuICAgICAgICBjb25zdCBvbGRTb3VyY2UgPSBvbGRGYWN0b3J5KGZuLCB0cmlnZ2VyKTtcbiAgICAgICAgY29uc3Qgc291cmNlID0gZmFjdG9yeSh4ID0+IG9sZFNvdXJjZS50cmFjayh4KSwgdHJpZ2dlcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHJhY2s6IHggPT4gc291cmNlLnRyYWNrKHgpLFxuICAgICAgICAgIGRpc3Bvc2UoKSB7XG4gICAgICAgICAgICBzb3VyY2UuZGlzcG9zZSgpO1xuICAgICAgICAgICAgb2xkU291cmNlLmRpc3Bvc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgdW50cmFjazogZm4gPT4gb2xkVW50cmFjaygoKSA9PiB1bnRyYWNrKGZuKSlcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIEV4dGVybmFsU291cmNlQ29uZmlnID0ge1xuICAgICAgZmFjdG9yeSxcbiAgICAgIHVudHJhY2tcbiAgICB9O1xuICB9XG59XG5mdW5jdGlvbiByZWFkU2lnbmFsKCkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAodGhpcy5zb3VyY2VzICYmIChydW5uaW5nVHJhbnNpdGlvbiA/IHRoaXMudFN0YXRlIDogdGhpcy5zdGF0ZSkpIHtcbiAgICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gdGhpcy50U3RhdGUgOiB0aGlzLnN0YXRlKSA9PT0gU1RBTEUpIHVwZGF0ZUNvbXB1dGF0aW9uKHRoaXMpO2Vsc2Uge1xuICAgICAgY29uc3QgdXBkYXRlcyA9IFVwZGF0ZXM7XG4gICAgICBVcGRhdGVzID0gbnVsbDtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4gbG9va1Vwc3RyZWFtKHRoaXMpLCBmYWxzZSk7XG4gICAgICBVcGRhdGVzID0gdXBkYXRlcztcbiAgICB9XG4gIH1cbiAgaWYgKExpc3RlbmVyKSB7XG4gICAgY29uc3Qgc1Nsb3QgPSB0aGlzLm9ic2VydmVycyA/IHRoaXMub2JzZXJ2ZXJzLmxlbmd0aCA6IDA7XG4gICAgaWYgKCFMaXN0ZW5lci5zb3VyY2VzKSB7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VzID0gW3RoaXNdO1xuICAgICAgTGlzdGVuZXIuc291cmNlU2xvdHMgPSBbc1Nsb3RdO1xuICAgIH0gZWxzZSB7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VzLnB1c2godGhpcyk7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VTbG90cy5wdXNoKHNTbG90KTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLm9ic2VydmVycykge1xuICAgICAgdGhpcy5vYnNlcnZlcnMgPSBbTGlzdGVuZXJdO1xuICAgICAgdGhpcy5vYnNlcnZlclNsb3RzID0gW0xpc3RlbmVyLnNvdXJjZXMubGVuZ3RoIC0gMV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub2JzZXJ2ZXJzLnB1c2goTGlzdGVuZXIpO1xuICAgICAgdGhpcy5vYnNlcnZlclNsb3RzLnB1c2goTGlzdGVuZXIuc291cmNlcy5sZW5ndGggLSAxKTtcbiAgICB9XG4gIH1cbiAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXModGhpcykpIHJldHVybiB0aGlzLnRWYWx1ZTtcbiAgcmV0dXJuIHRoaXMudmFsdWU7XG59XG5mdW5jdGlvbiB3cml0ZVNpZ25hbChub2RlLCB2YWx1ZSwgaXNDb21wKSB7XG4gIGxldCBjdXJyZW50ID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZTtcbiAgaWYgKCFub2RlLmNvbXBhcmF0b3IgfHwgIW5vZGUuY29tcGFyYXRvcihjdXJyZW50LCB2YWx1ZSkpIHtcbiAgICBpZiAoVHJhbnNpdGlvbikge1xuICAgICAgY29uc3QgVHJhbnNpdGlvblJ1bm5pbmcgPSBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gICAgICBpZiAoVHJhbnNpdGlvblJ1bm5pbmcgfHwgIWlzQ29tcCAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpKSB7XG4gICAgICAgIFRyYW5zaXRpb24uc291cmNlcy5hZGQobm9kZSk7XG4gICAgICAgIG5vZGUudFZhbHVlID0gdmFsdWU7XG4gICAgICB9XG4gICAgICBpZiAoIVRyYW5zaXRpb25SdW5uaW5nKSBub2RlLnZhbHVlID0gdmFsdWU7XG4gICAgfSBlbHNlIG5vZGUudmFsdWUgPSB2YWx1ZTtcbiAgICBpZiAobm9kZS5vYnNlcnZlcnMgJiYgbm9kZS5vYnNlcnZlcnMubGVuZ3RoKSB7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLm9ic2VydmVycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgIGNvbnN0IG8gPSBub2RlLm9ic2VydmVyc1tpXTtcbiAgICAgICAgICBjb25zdCBUcmFuc2l0aW9uUnVubmluZyA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgICAgICAgIGlmIChUcmFuc2l0aW9uUnVubmluZyAmJiBUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyhvKSkgY29udGludWU7XG4gICAgICAgICAgaWYgKFRyYW5zaXRpb25SdW5uaW5nID8gIW8udFN0YXRlIDogIW8uc3RhdGUpIHtcbiAgICAgICAgICAgIGlmIChvLnB1cmUpIFVwZGF0ZXMucHVzaChvKTtlbHNlIEVmZmVjdHMucHVzaChvKTtcbiAgICAgICAgICAgIGlmIChvLm9ic2VydmVycykgbWFya0Rvd25zdHJlYW0obyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghVHJhbnNpdGlvblJ1bm5pbmcpIG8uc3RhdGUgPSBTVEFMRTtlbHNlIG8udFN0YXRlID0gU1RBTEU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFVwZGF0ZXMubGVuZ3RoID4gMTBlNSkge1xuICAgICAgICAgIFVwZGF0ZXMgPSBbXTtcbiAgICAgICAgICBpZiAoSVNfREVWKSB0aHJvdyBuZXcgRXJyb3IoXCJQb3RlbnRpYWwgSW5maW5pdGUgTG9vcCBEZXRlY3RlZC5cIik7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gdXBkYXRlQ29tcHV0YXRpb24obm9kZSkge1xuICBpZiAoIW5vZGUuZm4pIHJldHVybjtcbiAgY2xlYW5Ob2RlKG5vZGUpO1xuICBjb25zdCB0aW1lID0gRXhlY0NvdW50O1xuICBydW5Db21wdXRhdGlvbihub2RlLCBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlLCB0aW1lKTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgIVRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpKSB7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIFRyYW5zaXRpb24gJiYgKFRyYW5zaXRpb24ucnVubmluZyA9IHRydWUpO1xuICAgICAgICBMaXN0ZW5lciA9IE93bmVyID0gbm9kZTtcbiAgICAgICAgcnVuQ29tcHV0YXRpb24obm9kZSwgbm9kZS50VmFsdWUsIHRpbWUpO1xuICAgICAgICBMaXN0ZW5lciA9IE93bmVyID0gbnVsbDtcbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9KTtcbiAgfVxufVxuZnVuY3Rpb24gcnVuQ29tcHV0YXRpb24obm9kZSwgdmFsdWUsIHRpbWUpIHtcbiAgbGV0IG5leHRWYWx1ZTtcbiAgY29uc3Qgb3duZXIgPSBPd25lcixcbiAgICBsaXN0ZW5lciA9IExpc3RlbmVyO1xuICBMaXN0ZW5lciA9IE93bmVyID0gbm9kZTtcbiAgdHJ5IHtcbiAgICBuZXh0VmFsdWUgPSBub2RlLmZuKHZhbHVlKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKG5vZGUucHVyZSkge1xuICAgICAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgICAgIG5vZGUudFN0YXRlID0gU1RBTEU7XG4gICAgICAgIG5vZGUudE93bmVkICYmIG5vZGUudE93bmVkLmZvckVhY2goY2xlYW5Ob2RlKTtcbiAgICAgICAgbm9kZS50T3duZWQgPSB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBub2RlLnN0YXRlID0gU1RBTEU7XG4gICAgICAgIG5vZGUub3duZWQgJiYgbm9kZS5vd25lZC5mb3JFYWNoKGNsZWFuTm9kZSk7XG4gICAgICAgIG5vZGUub3duZWQgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBub2RlLnVwZGF0ZWRBdCA9IHRpbWUgKyAxO1xuICAgIHJldHVybiBoYW5kbGVFcnJvcihlcnIpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gICAgT3duZXIgPSBvd25lcjtcbiAgfVxuICBpZiAoIW5vZGUudXBkYXRlZEF0IHx8IG5vZGUudXBkYXRlZEF0IDw9IHRpbWUpIHtcbiAgICBpZiAobm9kZS51cGRhdGVkQXQgIT0gbnVsbCAmJiBcIm9ic2VydmVyc1wiIGluIG5vZGUpIHtcbiAgICAgIHdyaXRlU2lnbmFsKG5vZGUsIG5leHRWYWx1ZSwgdHJ1ZSk7XG4gICAgfSBlbHNlIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBub2RlLnB1cmUpIHtcbiAgICAgIFRyYW5zaXRpb24uc291cmNlcy5hZGQobm9kZSk7XG4gICAgICBub2RlLnRWYWx1ZSA9IG5leHRWYWx1ZTtcbiAgICB9IGVsc2Ugbm9kZS52YWx1ZSA9IG5leHRWYWx1ZTtcbiAgICBub2RlLnVwZGF0ZWRBdCA9IHRpbWU7XG4gIH1cbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCBpbml0LCBwdXJlLCBzdGF0ZSA9IFNUQUxFLCBvcHRpb25zKSB7XG4gIGNvbnN0IGMgPSB7XG4gICAgZm4sXG4gICAgc3RhdGU6IHN0YXRlLFxuICAgIHVwZGF0ZWRBdDogbnVsbCxcbiAgICBvd25lZDogbnVsbCxcbiAgICBzb3VyY2VzOiBudWxsLFxuICAgIHNvdXJjZVNsb3RzOiBudWxsLFxuICAgIGNsZWFudXBzOiBudWxsLFxuICAgIHZhbHVlOiBpbml0LFxuICAgIG93bmVyOiBPd25lcixcbiAgICBjb250ZXh0OiBPd25lciA/IE93bmVyLmNvbnRleHQgOiBudWxsLFxuICAgIHB1cmVcbiAgfTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgYy5zdGF0ZSA9IDA7XG4gICAgYy50U3RhdGUgPSBzdGF0ZTtcbiAgfVxuICBpZiAoT3duZXIgPT09IG51bGwpIGNvbnNvbGUud2FybihcImNvbXB1dGF0aW9ucyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBkaXNwb3NlZFwiKTtlbHNlIGlmIChPd25lciAhPT0gVU5PV05FRCkge1xuICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBPd25lci5wdXJlKSB7XG4gICAgICBpZiAoIU93bmVyLnRPd25lZCkgT3duZXIudE93bmVkID0gW2NdO2Vsc2UgT3duZXIudE93bmVkLnB1c2goYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghT3duZXIub3duZWQpIE93bmVyLm93bmVkID0gW2NdO2Vsc2UgT3duZXIub3duZWQucHVzaChjKTtcbiAgICB9XG4gIH1cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5uYW1lKSBjLm5hbWUgPSBvcHRpb25zLm5hbWU7XG4gIGlmIChFeHRlcm5hbFNvdXJjZUNvbmZpZyAmJiBjLmZuKSB7XG4gICAgY29uc3QgW3RyYWNrLCB0cmlnZ2VyXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQsIHtcbiAgICAgIGVxdWFsczogZmFsc2VcbiAgICB9KTtcbiAgICBjb25zdCBvcmRpbmFyeSA9IEV4dGVybmFsU291cmNlQ29uZmlnLmZhY3RvcnkoYy5mbiwgdHJpZ2dlcik7XG4gICAgb25DbGVhbnVwKCgpID0+IG9yZGluYXJ5LmRpc3Bvc2UoKSk7XG4gICAgY29uc3QgdHJpZ2dlckluVHJhbnNpdGlvbiA9ICgpID0+IHN0YXJ0VHJhbnNpdGlvbih0cmlnZ2VyKS50aGVuKCgpID0+IGluVHJhbnNpdGlvbi5kaXNwb3NlKCkpO1xuICAgIGNvbnN0IGluVHJhbnNpdGlvbiA9IEV4dGVybmFsU291cmNlQ29uZmlnLmZhY3RvcnkoYy5mbiwgdHJpZ2dlckluVHJhbnNpdGlvbik7XG4gICAgYy5mbiA9IHggPT4ge1xuICAgICAgdHJhY2soKTtcbiAgICAgIHJldHVybiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyA/IGluVHJhbnNpdGlvbi50cmFjayh4KSA6IG9yZGluYXJ5LnRyYWNrKHgpO1xuICAgIH07XG4gIH1cbiAgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lciAmJiBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyKGMpO1xuICByZXR1cm4gYztcbn1cbmZ1bmN0aW9uIHJ1blRvcChub2RlKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSAwKSByZXR1cm47XG4gIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBQRU5ESU5HKSByZXR1cm4gbG9va1Vwc3RyZWFtKG5vZGUpO1xuICBpZiAobm9kZS5zdXNwZW5zZSAmJiB1bnRyYWNrKG5vZGUuc3VzcGVuc2UuaW5GYWxsYmFjaykpIHJldHVybiBub2RlLnN1c3BlbnNlLmVmZmVjdHMucHVzaChub2RlKTtcbiAgY29uc3QgYW5jZXN0b3JzID0gW25vZGVdO1xuICB3aGlsZSAoKG5vZGUgPSBub2RlLm93bmVyKSAmJiAoIW5vZGUudXBkYXRlZEF0IHx8IG5vZGUudXBkYXRlZEF0IDwgRXhlY0NvdW50KSkge1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyhub2RlKSkgcmV0dXJuO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgYW5jZXN0b3JzLnB1c2gobm9kZSk7XG4gIH1cbiAgZm9yIChsZXQgaSA9IGFuY2VzdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIG5vZGUgPSBhbmNlc3RvcnNbaV07XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uKSB7XG4gICAgICBsZXQgdG9wID0gbm9kZSxcbiAgICAgICAgcHJldiA9IGFuY2VzdG9yc1tpICsgMV07XG4gICAgICB3aGlsZSAoKHRvcCA9IHRvcC5vd25lcikgJiYgdG9wICE9PSBwcmV2KSB7XG4gICAgICAgIGlmIChUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyh0b3ApKSByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBTVEFMRSkge1xuICAgICAgdXBkYXRlQ29tcHV0YXRpb24obm9kZSk7XG4gICAgfSBlbHNlIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBQRU5ESU5HKSB7XG4gICAgICBjb25zdCB1cGRhdGVzID0gVXBkYXRlcztcbiAgICAgIFVwZGF0ZXMgPSBudWxsO1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiBsb29rVXBzdHJlYW0obm9kZSwgYW5jZXN0b3JzWzBdKSwgZmFsc2UpO1xuICAgICAgVXBkYXRlcyA9IHVwZGF0ZXM7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBydW5VcGRhdGVzKGZuLCBpbml0KSB7XG4gIGlmIChVcGRhdGVzKSByZXR1cm4gZm4oKTtcbiAgbGV0IHdhaXQgPSBmYWxzZTtcbiAgaWYgKCFpbml0KSBVcGRhdGVzID0gW107XG4gIGlmIChFZmZlY3RzKSB3YWl0ID0gdHJ1ZTtlbHNlIEVmZmVjdHMgPSBbXTtcbiAgRXhlY0NvdW50Kys7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gZm4oKTtcbiAgICBjb21wbGV0ZVVwZGF0ZXMod2FpdCk7XG4gICAgcmV0dXJuIHJlcztcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKCF3YWl0KSBFZmZlY3RzID0gbnVsbDtcbiAgICBVcGRhdGVzID0gbnVsbDtcbiAgICBoYW5kbGVFcnJvcihlcnIpO1xuICB9XG59XG5mdW5jdGlvbiBjb21wbGV0ZVVwZGF0ZXMod2FpdCkge1xuICBpZiAoVXBkYXRlcykge1xuICAgIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHNjaGVkdWxlUXVldWUoVXBkYXRlcyk7ZWxzZSBydW5RdWV1ZShVcGRhdGVzKTtcbiAgICBVcGRhdGVzID0gbnVsbDtcbiAgfVxuICBpZiAod2FpdCkgcmV0dXJuO1xuICBsZXQgcmVzO1xuICBpZiAoVHJhbnNpdGlvbikge1xuICAgIGlmICghVHJhbnNpdGlvbi5wcm9taXNlcy5zaXplICYmICFUcmFuc2l0aW9uLnF1ZXVlLnNpemUpIHtcbiAgICAgIGNvbnN0IHNvdXJjZXMgPSBUcmFuc2l0aW9uLnNvdXJjZXM7XG4gICAgICBjb25zdCBkaXNwb3NlZCA9IFRyYW5zaXRpb24uZGlzcG9zZWQ7XG4gICAgICBFZmZlY3RzLnB1c2guYXBwbHkoRWZmZWN0cywgVHJhbnNpdGlvbi5lZmZlY3RzKTtcbiAgICAgIHJlcyA9IFRyYW5zaXRpb24ucmVzb2x2ZTtcbiAgICAgIGZvciAoY29uc3QgZSBvZiBFZmZlY3RzKSB7XG4gICAgICAgIFwidFN0YXRlXCIgaW4gZSAmJiAoZS5zdGF0ZSA9IGUudFN0YXRlKTtcbiAgICAgICAgZGVsZXRlIGUudFN0YXRlO1xuICAgICAgfVxuICAgICAgVHJhbnNpdGlvbiA9IG51bGw7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBkIG9mIGRpc3Bvc2VkKSBjbGVhbk5vZGUoZCk7XG4gICAgICAgIGZvciAoY29uc3QgdiBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgdi52YWx1ZSA9IHYudFZhbHVlO1xuICAgICAgICAgIGlmICh2Lm93bmVkKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdi5vd25lZC5sZW5ndGg7IGkgPCBsZW47IGkrKykgY2xlYW5Ob2RlKHYub3duZWRbaV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodi50T3duZWQpIHYub3duZWQgPSB2LnRPd25lZDtcbiAgICAgICAgICBkZWxldGUgdi50VmFsdWU7XG4gICAgICAgICAgZGVsZXRlIHYudE93bmVkO1xuICAgICAgICAgIHYudFN0YXRlID0gMDtcbiAgICAgICAgfVxuICAgICAgICBzZXRUcmFuc1BlbmRpbmcoZmFsc2UpO1xuICAgICAgfSwgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgIFRyYW5zaXRpb24uZWZmZWN0cy5wdXNoLmFwcGx5KFRyYW5zaXRpb24uZWZmZWN0cywgRWZmZWN0cyk7XG4gICAgICBFZmZlY3RzID0gbnVsbDtcbiAgICAgIHNldFRyYW5zUGVuZGluZyh0cnVlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cbiAgY29uc3QgZSA9IEVmZmVjdHM7XG4gIEVmZmVjdHMgPSBudWxsO1xuICBpZiAoZS5sZW5ndGgpIHJ1blVwZGF0ZXMoKCkgPT4gcnVuRWZmZWN0cyhlKSwgZmFsc2UpO2Vsc2UgRGV2SG9va3MuYWZ0ZXJVcGRhdGUgJiYgRGV2SG9va3MuYWZ0ZXJVcGRhdGUoKTtcbiAgaWYgKHJlcykgcmVzKCk7XG59XG5mdW5jdGlvbiBydW5RdWV1ZShxdWV1ZSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSBydW5Ub3AocXVldWVbaV0pO1xufVxuZnVuY3Rpb24gc2NoZWR1bGVRdWV1ZShxdWV1ZSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgaXRlbSA9IHF1ZXVlW2ldO1xuICAgIGNvbnN0IHRhc2tzID0gVHJhbnNpdGlvbi5xdWV1ZTtcbiAgICBpZiAoIXRhc2tzLmhhcyhpdGVtKSkge1xuICAgICAgdGFza3MuYWRkKGl0ZW0pO1xuICAgICAgU2NoZWR1bGVyKCgpID0+IHtcbiAgICAgICAgdGFza3MuZGVsZXRlKGl0ZW0pO1xuICAgICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgIHJ1blRvcChpdGVtKTtcbiAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICBUcmFuc2l0aW9uICYmIChUcmFuc2l0aW9uLnJ1bm5pbmcgPSBmYWxzZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIHJ1blVzZXJFZmZlY3RzKHF1ZXVlKSB7XG4gIGxldCBpLFxuICAgIHVzZXJMZW5ndGggPSAwO1xuICBmb3IgKGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBlID0gcXVldWVbaV07XG4gICAgaWYgKCFlLnVzZXIpIHJ1blRvcChlKTtlbHNlIHF1ZXVlW3VzZXJMZW5ndGgrK10gPSBlO1xuICB9XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCkge1xuICAgIGlmIChzaGFyZWRDb25maWcuY291bnQpIHtcbiAgICAgIHNoYXJlZENvbmZpZy5lZmZlY3RzIHx8IChzaGFyZWRDb25maWcuZWZmZWN0cyA9IFtdKTtcbiAgICAgIHNoYXJlZENvbmZpZy5lZmZlY3RzLnB1c2goLi4ucXVldWUuc2xpY2UoMCwgdXNlckxlbmd0aCkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICB9XG4gIGlmIChzaGFyZWRDb25maWcuZWZmZWN0cyAmJiAoc2hhcmVkQ29uZmlnLmRvbmUgfHwgIXNoYXJlZENvbmZpZy5jb3VudCkpIHtcbiAgICBxdWV1ZSA9IFsuLi5zaGFyZWRDb25maWcuZWZmZWN0cywgLi4ucXVldWVdO1xuICAgIHVzZXJMZW5ndGggKz0gc2hhcmVkQ29uZmlnLmVmZmVjdHMubGVuZ3RoO1xuICAgIGRlbGV0ZSBzaGFyZWRDb25maWcuZWZmZWN0cztcbiAgfVxuICBmb3IgKGkgPSAwOyBpIDwgdXNlckxlbmd0aDsgaSsrKSBydW5Ub3AocXVldWVbaV0pO1xufVxuZnVuY3Rpb24gbG9va1Vwc3RyZWFtKG5vZGUsIGlnbm9yZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAocnVubmluZ1RyYW5zaXRpb24pIG5vZGUudFN0YXRlID0gMDtlbHNlIG5vZGUuc3RhdGUgPSAwO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuc291cmNlcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGNvbnN0IHNvdXJjZSA9IG5vZGUuc291cmNlc1tpXTtcbiAgICBpZiAoc291cmNlLnNvdXJjZXMpIHtcbiAgICAgIGNvbnN0IHN0YXRlID0gcnVubmluZ1RyYW5zaXRpb24gPyBzb3VyY2UudFN0YXRlIDogc291cmNlLnN0YXRlO1xuICAgICAgaWYgKHN0YXRlID09PSBTVEFMRSkge1xuICAgICAgICBpZiAoc291cmNlICE9PSBpZ25vcmUgJiYgKCFzb3VyY2UudXBkYXRlZEF0IHx8IHNvdXJjZS51cGRhdGVkQXQgPCBFeGVjQ291bnQpKSBydW5Ub3Aoc291cmNlKTtcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IFBFTkRJTkcpIGxvb2tVcHN0cmVhbShzb3VyY2UsIGlnbm9yZSk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBtYXJrRG93bnN0cmVhbShub2RlKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vYnNlcnZlcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBjb25zdCBvID0gbm9kZS5vYnNlcnZlcnNbaV07XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uID8gIW8udFN0YXRlIDogIW8uc3RhdGUpIHtcbiAgICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbikgby50U3RhdGUgPSBQRU5ESU5HO2Vsc2Ugby5zdGF0ZSA9IFBFTkRJTkc7XG4gICAgICBpZiAoby5wdXJlKSBVcGRhdGVzLnB1c2gobyk7ZWxzZSBFZmZlY3RzLnB1c2gobyk7XG4gICAgICBvLm9ic2VydmVycyAmJiBtYXJrRG93bnN0cmVhbShvKTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIGNsZWFuTm9kZShub2RlKSB7XG4gIGxldCBpO1xuICBpZiAobm9kZS5zb3VyY2VzKSB7XG4gICAgd2hpbGUgKG5vZGUuc291cmNlcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHNvdXJjZSA9IG5vZGUuc291cmNlcy5wb3AoKSxcbiAgICAgICAgaW5kZXggPSBub2RlLnNvdXJjZVNsb3RzLnBvcCgpLFxuICAgICAgICBvYnMgPSBzb3VyY2Uub2JzZXJ2ZXJzO1xuICAgICAgaWYgKG9icyAmJiBvYnMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IG4gPSBvYnMucG9wKCksXG4gICAgICAgICAgcyA9IHNvdXJjZS5vYnNlcnZlclNsb3RzLnBvcCgpO1xuICAgICAgICBpZiAoaW5kZXggPCBvYnMubGVuZ3RoKSB7XG4gICAgICAgICAgbi5zb3VyY2VTbG90c1tzXSA9IGluZGV4O1xuICAgICAgICAgIG9ic1tpbmRleF0gPSBuO1xuICAgICAgICAgIHNvdXJjZS5vYnNlcnZlclNsb3RzW2luZGV4XSA9IHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKG5vZGUudE93bmVkKSB7XG4gICAgZm9yIChpID0gbm9kZS50T3duZWQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGNsZWFuTm9kZShub2RlLnRPd25lZFtpXSk7XG4gICAgZGVsZXRlIG5vZGUudE93bmVkO1xuICB9XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBub2RlLnB1cmUpIHtcbiAgICByZXNldChub2RlLCB0cnVlKTtcbiAgfSBlbHNlIGlmIChub2RlLm93bmVkKSB7XG4gICAgZm9yIChpID0gbm9kZS5vd25lZC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgY2xlYW5Ob2RlKG5vZGUub3duZWRbaV0pO1xuICAgIG5vZGUub3duZWQgPSBudWxsO1xuICB9XG4gIGlmIChub2RlLmNsZWFudXBzKSB7XG4gICAgZm9yIChpID0gbm9kZS5jbGVhbnVwcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgbm9kZS5jbGVhbnVwc1tpXSgpO1xuICAgIG5vZGUuY2xlYW51cHMgPSBudWxsO1xuICB9XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgbm9kZS50U3RhdGUgPSAwO2Vsc2Ugbm9kZS5zdGF0ZSA9IDA7XG4gIGRlbGV0ZSBub2RlLnNvdXJjZU1hcDtcbn1cbmZ1bmN0aW9uIHJlc2V0KG5vZGUsIHRvcCkge1xuICBpZiAoIXRvcCkge1xuICAgIG5vZGUudFN0YXRlID0gMDtcbiAgICBUcmFuc2l0aW9uLmRpc3Bvc2VkLmFkZChub2RlKTtcbiAgfVxuICBpZiAobm9kZS5vd25lZCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vd25lZC5sZW5ndGg7IGkrKykgcmVzZXQobm9kZS5vd25lZFtpXSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGNhc3RFcnJvcihlcnIpIHtcbiAgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gZXJyO1xuICByZXR1cm4gbmV3IEVycm9yKHR5cGVvZiBlcnIgPT09IFwic3RyaW5nXCIgPyBlcnIgOiBcIlVua25vd24gZXJyb3JcIiwge1xuICAgIGNhdXNlOiBlcnJcbiAgfSk7XG59XG5mdW5jdGlvbiBydW5FcnJvcnMoZXJyLCBmbnMsIG93bmVyKSB7XG4gIHRyeSB7XG4gICAgZm9yIChjb25zdCBmIG9mIGZucykgZihlcnIpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaGFuZGxlRXJyb3IoZSwgb3duZXIgJiYgb3duZXIub3duZXIgfHwgbnVsbCk7XG4gIH1cbn1cbmZ1bmN0aW9uIGhhbmRsZUVycm9yKGVyciwgb3duZXIgPSBPd25lcikge1xuICBjb25zdCBmbnMgPSBFUlJPUiAmJiBvd25lciAmJiBvd25lci5jb250ZXh0ICYmIG93bmVyLmNvbnRleHRbRVJST1JdO1xuICBjb25zdCBlcnJvciA9IGNhc3RFcnJvcihlcnIpO1xuICBpZiAoIWZucykgdGhyb3cgZXJyb3I7XG4gIGlmIChFZmZlY3RzKSBFZmZlY3RzLnB1c2goe1xuICAgIGZuKCkge1xuICAgICAgcnVuRXJyb3JzKGVycm9yLCBmbnMsIG93bmVyKTtcbiAgICB9LFxuICAgIHN0YXRlOiBTVEFMRVxuICB9KTtlbHNlIHJ1bkVycm9ycyhlcnJvciwgZm5zLCBvd25lcik7XG59XG5mdW5jdGlvbiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4pIHtcbiAgaWYgKHR5cGVvZiBjaGlsZHJlbiA9PT0gXCJmdW5jdGlvblwiICYmICFjaGlsZHJlbi5sZW5ndGgpIHJldHVybiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4oKSk7XG4gIGlmIChBcnJheS5pc0FycmF5KGNoaWxkcmVuKSkge1xuICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW5baV0pO1xuICAgICAgQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0cy5wdXNoLmFwcGx5KHJlc3VsdHMsIHJlc3VsdCkgOiByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cbiAgcmV0dXJuIGNoaWxkcmVuO1xufVxuZnVuY3Rpb24gY3JlYXRlUHJvdmlkZXIoaWQsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHByb3ZpZGVyKHByb3BzKSB7XG4gICAgbGV0IHJlcztcbiAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gcmVzID0gdW50cmFjaygoKSA9PiB7XG4gICAgICBPd25lci5jb250ZXh0ID0ge1xuICAgICAgICAuLi5Pd25lci5jb250ZXh0LFxuICAgICAgICBbaWRdOiBwcm9wcy52YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiBjaGlsZHJlbigoKSA9PiBwcm9wcy5jaGlsZHJlbik7XG4gICAgfSksIHVuZGVmaW5lZCwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcbn1cbmZ1bmN0aW9uIG9uRXJyb3IoZm4pIHtcbiAgRVJST1IgfHwgKEVSUk9SID0gU3ltYm9sKFwiZXJyb3JcIikpO1xuICBpZiAoT3duZXIgPT09IG51bGwpIGNvbnNvbGUud2FybihcImVycm9yIGhhbmRsZXJzIGNyZWF0ZWQgb3V0c2lkZSBhIGBjcmVhdGVSb290YCBvciBgcmVuZGVyYCB3aWxsIG5ldmVyIGJlIHJ1blwiKTtlbHNlIGlmIChPd25lci5jb250ZXh0ID09PSBudWxsIHx8ICFPd25lci5jb250ZXh0W0VSUk9SXSkge1xuICAgIE93bmVyLmNvbnRleHQgPSB7XG4gICAgICAuLi5Pd25lci5jb250ZXh0LFxuICAgICAgW0VSUk9SXTogW2ZuXVxuICAgIH07XG4gICAgbXV0YXRlQ29udGV4dChPd25lciwgRVJST1IsIFtmbl0pO1xuICB9IGVsc2UgT3duZXIuY29udGV4dFtFUlJPUl0ucHVzaChmbik7XG59XG5mdW5jdGlvbiBtdXRhdGVDb250ZXh0KG8sIGtleSwgdmFsdWUpIHtcbiAgaWYgKG8ub3duZWQpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG8ub3duZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChvLm93bmVkW2ldLmNvbnRleHQgPT09IG8uY29udGV4dCkgbXV0YXRlQ29udGV4dChvLm93bmVkW2ldLCBrZXksIHZhbHVlKTtcbiAgICAgIGlmICghby5vd25lZFtpXS5jb250ZXh0KSB7XG4gICAgICAgIG8ub3duZWRbaV0uY29udGV4dCA9IG8uY29udGV4dDtcbiAgICAgICAgbXV0YXRlQ29udGV4dChvLm93bmVkW2ldLCBrZXksIHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoIW8ub3duZWRbaV0uY29udGV4dFtrZXldKSB7XG4gICAgICAgIG8ub3duZWRbaV0uY29udGV4dFtrZXldID0gdmFsdWU7XG4gICAgICAgIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIG9ic2VydmFibGUoaW5wdXQpIHtcbiAgcmV0dXJuIHtcbiAgICBzdWJzY3JpYmUob2JzZXJ2ZXIpIHtcbiAgICAgIGlmICghKG9ic2VydmVyIGluc3RhbmNlb2YgT2JqZWN0KSB8fCBvYnNlcnZlciA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJFeHBlY3RlZCB0aGUgb2JzZXJ2ZXIgdG8gYmUgYW4gb2JqZWN0LlwiKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGhhbmRsZXIgPSB0eXBlb2Ygb2JzZXJ2ZXIgPT09IFwiZnVuY3Rpb25cIiA/IG9ic2VydmVyIDogb2JzZXJ2ZXIubmV4dCAmJiBvYnNlcnZlci5uZXh0LmJpbmQob2JzZXJ2ZXIpO1xuICAgICAgaWYgKCFoYW5kbGVyKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdW5zdWJzY3JpYmUoKSB7fVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgY29uc3QgZGlzcG9zZSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHYgPSBpbnB1dCgpO1xuICAgICAgICAgIHVudHJhY2soKCkgPT4gaGFuZGxlcih2KSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGlzcG9zZXI7XG4gICAgICB9KTtcbiAgICAgIGlmIChnZXRPd25lcigpKSBvbkNsZWFudXAoZGlzcG9zZSk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpIHtcbiAgICAgICAgICBkaXNwb3NlKCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSxcbiAgICBbU3ltYm9sLm9ic2VydmFibGUgfHwgXCJAQG9ic2VydmFibGVcIl0oKSB7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiBmcm9tKHByb2R1Y2VyLCBpbml0YWxWYWx1ZSA9IHVuZGVmaW5lZCkge1xuICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbChpbml0YWxWYWx1ZSwge1xuICAgIGVxdWFsczogZmFsc2VcbiAgfSk7XG4gIGlmIChcInN1YnNjcmliZVwiIGluIHByb2R1Y2VyKSB7XG4gICAgY29uc3QgdW5zdWIgPSBwcm9kdWNlci5zdWJzY3JpYmUodiA9PiBzZXQoKCkgPT4gdikpO1xuICAgIG9uQ2xlYW51cCgoKSA9PiBcInVuc3Vic2NyaWJlXCIgaW4gdW5zdWIgPyB1bnN1Yi51bnN1YnNjcmliZSgpIDogdW5zdWIoKSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgY2xlYW4gPSBwcm9kdWNlcihzZXQpO1xuICAgIG9uQ2xlYW51cChjbGVhbik7XG4gIH1cbiAgcmV0dXJuIHM7XG59XG5cbmNvbnN0IEZBTExCQUNLID0gU3ltYm9sKFwiZmFsbGJhY2tcIik7XG5mdW5jdGlvbiBkaXNwb3NlKGQpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBkLmxlbmd0aDsgaSsrKSBkW2ldKCk7XG59XG5mdW5jdGlvbiBtYXBBcnJheShsaXN0LCBtYXBGbiwgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCBpdGVtcyA9IFtdLFxuICAgIG1hcHBlZCA9IFtdLFxuICAgIGRpc3Bvc2VycyA9IFtdLFxuICAgIGxlbiA9IDAsXG4gICAgaW5kZXhlcyA9IG1hcEZuLmxlbmd0aCA+IDEgPyBbXSA6IG51bGw7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlKGRpc3Bvc2VycykpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGxldCBuZXdJdGVtcyA9IGxpc3QoKSB8fCBbXSxcbiAgICAgIG5ld0xlbiA9IG5ld0l0ZW1zLmxlbmd0aCxcbiAgICAgIGksXG4gICAgICBqO1xuICAgIG5ld0l0ZW1zWyRUUkFDS107XG4gICAgcmV0dXJuIHVudHJhY2soKCkgPT4ge1xuICAgICAgbGV0IG5ld0luZGljZXMsIG5ld0luZGljZXNOZXh0LCB0ZW1wLCB0ZW1wZGlzcG9zZXJzLCB0ZW1wSW5kZXhlcywgc3RhcnQsIGVuZCwgbmV3RW5kLCBpdGVtO1xuICAgICAgaWYgKG5ld0xlbiA9PT0gMCkge1xuICAgICAgICBpZiAobGVuICE9PSAwKSB7XG4gICAgICAgICAgZGlzcG9zZShkaXNwb3NlcnMpO1xuICAgICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgICAgbWFwcGVkID0gW107XG4gICAgICAgICAgbGVuID0gMDtcbiAgICAgICAgICBpbmRleGVzICYmIChpbmRleGVzID0gW10pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLmZhbGxiYWNrKSB7XG4gICAgICAgICAgaXRlbXMgPSBbRkFMTEJBQ0tdO1xuICAgICAgICAgIG1hcHBlZFswXSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZXJzWzBdID0gZGlzcG9zZXI7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9ucy5mYWxsYmFjaygpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxlbiA9IDE7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGxlbiA9PT0gMCkge1xuICAgICAgICBtYXBwZWQgPSBuZXcgQXJyYXkobmV3TGVuKTtcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IG5ld0xlbjsgaisrKSB7XG4gICAgICAgICAgaXRlbXNbal0gPSBuZXdJdGVtc1tqXTtcbiAgICAgICAgICBtYXBwZWRbal0gPSBjcmVhdGVSb290KG1hcHBlcik7XG4gICAgICAgIH1cbiAgICAgICAgbGVuID0gbmV3TGVuO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGVtcCA9IG5ldyBBcnJheShuZXdMZW4pO1xuICAgICAgICB0ZW1wZGlzcG9zZXJzID0gbmV3IEFycmF5KG5ld0xlbik7XG4gICAgICAgIGluZGV4ZXMgJiYgKHRlbXBJbmRleGVzID0gbmV3IEFycmF5KG5ld0xlbikpO1xuICAgICAgICBmb3IgKHN0YXJ0ID0gMCwgZW5kID0gTWF0aC5taW4obGVuLCBuZXdMZW4pOyBzdGFydCA8IGVuZCAmJiBpdGVtc1tzdGFydF0gPT09IG5ld0l0ZW1zW3N0YXJ0XTsgc3RhcnQrKyk7XG4gICAgICAgIGZvciAoZW5kID0gbGVuIC0gMSwgbmV3RW5kID0gbmV3TGVuIC0gMTsgZW5kID49IHN0YXJ0ICYmIG5ld0VuZCA+PSBzdGFydCAmJiBpdGVtc1tlbmRdID09PSBuZXdJdGVtc1tuZXdFbmRdOyBlbmQtLSwgbmV3RW5kLS0pIHtcbiAgICAgICAgICB0ZW1wW25ld0VuZF0gPSBtYXBwZWRbZW5kXTtcbiAgICAgICAgICB0ZW1wZGlzcG9zZXJzW25ld0VuZF0gPSBkaXNwb3NlcnNbZW5kXTtcbiAgICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlc1tuZXdFbmRdID0gaW5kZXhlc1tlbmRdKTtcbiAgICAgICAgfVxuICAgICAgICBuZXdJbmRpY2VzID0gbmV3IE1hcCgpO1xuICAgICAgICBuZXdJbmRpY2VzTmV4dCA9IG5ldyBBcnJheShuZXdFbmQgKyAxKTtcbiAgICAgICAgZm9yIChqID0gbmV3RW5kOyBqID49IHN0YXJ0OyBqLS0pIHtcbiAgICAgICAgICBpdGVtID0gbmV3SXRlbXNbal07XG4gICAgICAgICAgaSA9IG5ld0luZGljZXMuZ2V0KGl0ZW0pO1xuICAgICAgICAgIG5ld0luZGljZXNOZXh0W2pdID0gaSA9PT0gdW5kZWZpbmVkID8gLTEgOiBpO1xuICAgICAgICAgIG5ld0luZGljZXMuc2V0KGl0ZW0sIGopO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IHN0YXJ0OyBpIDw9IGVuZDsgaSsrKSB7XG4gICAgICAgICAgaXRlbSA9IGl0ZW1zW2ldO1xuICAgICAgICAgIGogPSBuZXdJbmRpY2VzLmdldChpdGVtKTtcbiAgICAgICAgICBpZiAoaiAhPT0gdW5kZWZpbmVkICYmIGogIT09IC0xKSB7XG4gICAgICAgICAgICB0ZW1wW2pdID0gbWFwcGVkW2ldO1xuICAgICAgICAgICAgdGVtcGRpc3Bvc2Vyc1tqXSA9IGRpc3Bvc2Vyc1tpXTtcbiAgICAgICAgICAgIGluZGV4ZXMgJiYgKHRlbXBJbmRleGVzW2pdID0gaW5kZXhlc1tpXSk7XG4gICAgICAgICAgICBqID0gbmV3SW5kaWNlc05leHRbal07XG4gICAgICAgICAgICBuZXdJbmRpY2VzLnNldChpdGVtLCBqKTtcbiAgICAgICAgICB9IGVsc2UgZGlzcG9zZXJzW2ldKCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChqID0gc3RhcnQ7IGogPCBuZXdMZW47IGorKykge1xuICAgICAgICAgIGlmIChqIGluIHRlbXApIHtcbiAgICAgICAgICAgIG1hcHBlZFtqXSA9IHRlbXBbal07XG4gICAgICAgICAgICBkaXNwb3NlcnNbal0gPSB0ZW1wZGlzcG9zZXJzW2pdO1xuICAgICAgICAgICAgaWYgKGluZGV4ZXMpIHtcbiAgICAgICAgICAgICAgaW5kZXhlc1tqXSA9IHRlbXBJbmRleGVzW2pdO1xuICAgICAgICAgICAgICBpbmRleGVzW2pdKGopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBtYXBwZWRbal0gPSBjcmVhdGVSb290KG1hcHBlcik7XG4gICAgICAgIH1cbiAgICAgICAgbWFwcGVkID0gbWFwcGVkLnNsaWNlKDAsIGxlbiA9IG5ld0xlbik7XG4gICAgICAgIGl0ZW1zID0gbmV3SXRlbXMuc2xpY2UoMCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWFwcGVkO1xuICAgIH0pO1xuICAgIGZ1bmN0aW9uIG1hcHBlcihkaXNwb3Nlcikge1xuICAgICAgZGlzcG9zZXJzW2pdID0gZGlzcG9zZXI7XG4gICAgICBpZiAoaW5kZXhlcykge1xuICAgICAgICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbChqLCB7XG4gICAgICAgICAgbmFtZTogXCJpbmRleFwiXG4gICAgICAgIH0pIDtcbiAgICAgICAgaW5kZXhlc1tqXSA9IHNldDtcbiAgICAgICAgcmV0dXJuIG1hcEZuKG5ld0l0ZW1zW2pdLCBzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXBGbihuZXdJdGVtc1tqXSk7XG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gaW5kZXhBcnJheShsaXN0LCBtYXBGbiwgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCBpdGVtcyA9IFtdLFxuICAgIG1hcHBlZCA9IFtdLFxuICAgIGRpc3Bvc2VycyA9IFtdLFxuICAgIHNpZ25hbHMgPSBbXSxcbiAgICBsZW4gPSAwLFxuICAgIGk7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlKGRpc3Bvc2VycykpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGNvbnN0IG5ld0l0ZW1zID0gbGlzdCgpIHx8IFtdLFxuICAgICAgbmV3TGVuID0gbmV3SXRlbXMubGVuZ3RoO1xuICAgIG5ld0l0ZW1zWyRUUkFDS107XG4gICAgcmV0dXJuIHVudHJhY2soKCkgPT4ge1xuICAgICAgaWYgKG5ld0xlbiA9PT0gMCkge1xuICAgICAgICBpZiAobGVuICE9PSAwKSB7XG4gICAgICAgICAgZGlzcG9zZShkaXNwb3NlcnMpO1xuICAgICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgICAgbWFwcGVkID0gW107XG4gICAgICAgICAgbGVuID0gMDtcbiAgICAgICAgICBzaWduYWxzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZmFsbGJhY2spIHtcbiAgICAgICAgICBpdGVtcyA9IFtGQUxMQkFDS107XG4gICAgICAgICAgbWFwcGVkWzBdID0gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgICAgICBkaXNwb3NlcnNbMF0gPSBkaXNwb3NlcjtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb25zLmZhbGxiYWNrKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGVuID0gMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWFwcGVkO1xuICAgICAgfVxuICAgICAgaWYgKGl0ZW1zWzBdID09PSBGQUxMQkFDSykge1xuICAgICAgICBkaXNwb3NlcnNbMF0oKTtcbiAgICAgICAgZGlzcG9zZXJzID0gW107XG4gICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICBsZW4gPSAwO1xuICAgICAgfVxuICAgICAgZm9yIChpID0gMDsgaSA8IG5ld0xlbjsgaSsrKSB7XG4gICAgICAgIGlmIChpIDwgaXRlbXMubGVuZ3RoICYmIGl0ZW1zW2ldICE9PSBuZXdJdGVtc1tpXSkge1xuICAgICAgICAgIHNpZ25hbHNbaV0oKCkgPT4gbmV3SXRlbXNbaV0pO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPj0gaXRlbXMubGVuZ3RoKSB7XG4gICAgICAgICAgbWFwcGVkW2ldID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKDsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGRpc3Bvc2Vyc1tpXSgpO1xuICAgICAgfVxuICAgICAgbGVuID0gc2lnbmFscy5sZW5ndGggPSBkaXNwb3NlcnMubGVuZ3RoID0gbmV3TGVuO1xuICAgICAgaXRlbXMgPSBuZXdJdGVtcy5zbGljZSgwKTtcbiAgICAgIHJldHVybiBtYXBwZWQgPSBtYXBwZWQuc2xpY2UoMCwgbGVuKTtcbiAgICB9KTtcbiAgICBmdW5jdGlvbiBtYXBwZXIoZGlzcG9zZXIpIHtcbiAgICAgIGRpc3Bvc2Vyc1tpXSA9IGRpc3Bvc2VyO1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwobmV3SXRlbXNbaV0sIHtcbiAgICAgICAgbmFtZTogXCJ2YWx1ZVwiXG4gICAgICB9KSA7XG4gICAgICBzaWduYWxzW2ldID0gc2V0O1xuICAgICAgcmV0dXJuIG1hcEZuKHMsIGkpO1xuICAgIH1cbiAgfTtcbn1cblxubGV0IGh5ZHJhdGlvbkVuYWJsZWQgPSBmYWxzZTtcbmZ1bmN0aW9uIGVuYWJsZUh5ZHJhdGlvbigpIHtcbiAgaHlkcmF0aW9uRW5hYmxlZCA9IHRydWU7XG59XG5mdW5jdGlvbiBjcmVhdGVDb21wb25lbnQoQ29tcCwgcHJvcHMpIHtcbiAgaWYgKGh5ZHJhdGlvbkVuYWJsZWQpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQpIHtcbiAgICAgIGNvbnN0IGMgPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KG5leHRIeWRyYXRlQ29udGV4dCgpKTtcbiAgICAgIGNvbnN0IHIgPSBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMgfHwge30pIDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGMpO1xuICAgICAgcmV0dXJuIHI7XG4gICAgfVxuICB9XG4gIHJldHVybiBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMgfHwge30pO1xufVxuZnVuY3Rpb24gdHJ1ZUZuKCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cbmNvbnN0IHByb3BUcmFwcyA9IHtcbiAgZ2V0KF8sIHByb3BlcnR5LCByZWNlaXZlcikge1xuICAgIGlmIChwcm9wZXJ0eSA9PT0gJFBST1hZKSByZXR1cm4gcmVjZWl2ZXI7XG4gICAgcmV0dXJuIF8uZ2V0KHByb3BlcnR5KTtcbiAgfSxcbiAgaGFzKF8sIHByb3BlcnR5KSB7XG4gICAgaWYgKHByb3BlcnR5ID09PSAkUFJPWFkpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBfLmhhcyhwcm9wZXJ0eSk7XG4gIH0sXG4gIHNldDogdHJ1ZUZuLFxuICBkZWxldGVQcm9wZXJ0eTogdHJ1ZUZuLFxuICBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoXywgcHJvcGVydHkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGdldCgpIHtcbiAgICAgICAgcmV0dXJuIF8uZ2V0KHByb3BlcnR5KTtcbiAgICAgIH0sXG4gICAgICBzZXQ6IHRydWVGbixcbiAgICAgIGRlbGV0ZVByb3BlcnR5OiB0cnVlRm5cbiAgICB9O1xuICB9LFxuICBvd25LZXlzKF8pIHtcbiAgICByZXR1cm4gXy5rZXlzKCk7XG4gIH1cbn07XG5mdW5jdGlvbiByZXNvbHZlU291cmNlKHMpIHtcbiAgcmV0dXJuICEocyA9IHR5cGVvZiBzID09PSBcImZ1bmN0aW9uXCIgPyBzKCkgOiBzKSA/IHt9IDogcztcbn1cbmZ1bmN0aW9uIHJlc29sdmVTb3VyY2VzKCkge1xuICBmb3IgKGxldCBpID0gMCwgbGVuZ3RoID0gdGhpcy5sZW5ndGg7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGNvbnN0IHYgPSB0aGlzW2ldKCk7XG4gICAgaWYgKHYgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHY7XG4gIH1cbn1cbmZ1bmN0aW9uIG1lcmdlUHJvcHMoLi4uc291cmNlcykge1xuICBsZXQgcHJveHkgPSBmYWxzZTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgcyA9IHNvdXJjZXNbaV07XG4gICAgcHJveHkgPSBwcm94eSB8fCAhIXMgJiYgJFBST1hZIGluIHM7XG4gICAgc291cmNlc1tpXSA9IHR5cGVvZiBzID09PSBcImZ1bmN0aW9uXCIgPyAocHJveHkgPSB0cnVlLCBjcmVhdGVNZW1vKHMpKSA6IHM7XG4gIH1cbiAgaWYgKFNVUFBPUlRTX1BST1hZICYmIHByb3h5KSB7XG4gICAgcmV0dXJuIG5ldyBQcm94eSh7XG4gICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICBjb25zdCB2ID0gcmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKVtwcm9wZXJ0eV07XG4gICAgICAgICAgaWYgKHYgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHY7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICBpZiAocHJvcGVydHkgaW4gcmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKSkgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIGtleXMoKSB7XG4gICAgICAgIGNvbnN0IGtleXMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VzLmxlbmd0aDsgaSsrKSBrZXlzLnB1c2goLi4uT2JqZWN0LmtleXMocmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKSkpO1xuICAgICAgICByZXR1cm4gWy4uLm5ldyBTZXQoa2V5cyldO1xuICAgICAgfVxuICAgIH0sIHByb3BUcmFwcyk7XG4gIH1cbiAgY29uc3Qgc291cmNlc01hcCA9IHt9O1xuICBjb25zdCBkZWZpbmVkID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBjb25zdCBzb3VyY2UgPSBzb3VyY2VzW2ldO1xuICAgIGlmICghc291cmNlKSBjb250aW51ZTtcbiAgICBjb25zdCBzb3VyY2VLZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoc291cmNlKTtcbiAgICBmb3IgKGxldCBpID0gc291cmNlS2V5cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3Qga2V5ID0gc291cmNlS2V5c1tpXTtcbiAgICAgIGlmIChrZXkgPT09IFwiX19wcm90b19fXCIgfHwga2V5ID09PSBcImNvbnN0cnVjdG9yXCIpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Ioc291cmNlLCBrZXkpO1xuICAgICAgaWYgKCFkZWZpbmVkW2tleV0pIHtcbiAgICAgICAgZGVmaW5lZFtrZXldID0gZGVzYy5nZXQgPyB7XG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgZ2V0OiByZXNvbHZlU291cmNlcy5iaW5kKHNvdXJjZXNNYXBba2V5XSA9IFtkZXNjLmdldC5iaW5kKHNvdXJjZSldKVxuICAgICAgICB9IDogZGVzYy52YWx1ZSAhPT0gdW5kZWZpbmVkID8gZGVzYyA6IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZXMgPSBzb3VyY2VzTWFwW2tleV07XG4gICAgICAgIGlmIChzb3VyY2VzKSB7XG4gICAgICAgICAgaWYgKGRlc2MuZ2V0KSBzb3VyY2VzLnB1c2goZGVzYy5nZXQuYmluZChzb3VyY2UpKTtlbHNlIGlmIChkZXNjLnZhbHVlICE9PSB1bmRlZmluZWQpIHNvdXJjZXMucHVzaCgoKSA9PiBkZXNjLnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBjb25zdCB0YXJnZXQgPSB7fTtcbiAgY29uc3QgZGVmaW5lZEtleXMgPSBPYmplY3Qua2V5cyhkZWZpbmVkKTtcbiAgZm9yIChsZXQgaSA9IGRlZmluZWRLZXlzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3Qga2V5ID0gZGVmaW5lZEtleXNbaV0sXG4gICAgICBkZXNjID0gZGVmaW5lZFtrZXldO1xuICAgIGlmIChkZXNjICYmIGRlc2MuZ2V0KSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIGRlc2MpO2Vsc2UgdGFyZ2V0W2tleV0gPSBkZXNjID8gZGVzYy52YWx1ZSA6IHVuZGVmaW5lZDtcbiAgfVxuICByZXR1cm4gdGFyZ2V0O1xufVxuZnVuY3Rpb24gc3BsaXRQcm9wcyhwcm9wcywgLi4ua2V5cykge1xuICBpZiAoU1VQUE9SVFNfUFJPWFkgJiYgJFBST1hZIGluIHByb3BzKSB7XG4gICAgY29uc3QgYmxvY2tlZCA9IG5ldyBTZXQoa2V5cy5sZW5ndGggPiAxID8ga2V5cy5mbGF0KCkgOiBrZXlzWzBdKTtcbiAgICBjb25zdCByZXMgPSBrZXlzLm1hcChrID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJveHkoe1xuICAgICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gay5pbmNsdWRlcyhwcm9wZXJ0eSkgPyBwcm9wc1twcm9wZXJ0eV0gOiB1bmRlZmluZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIGhhcyhwcm9wZXJ0eSkge1xuICAgICAgICAgIHJldHVybiBrLmluY2x1ZGVzKHByb3BlcnR5KSAmJiBwcm9wZXJ0eSBpbiBwcm9wcztcbiAgICAgICAgfSxcbiAgICAgICAga2V5cygpIHtcbiAgICAgICAgICByZXR1cm4gay5maWx0ZXIocHJvcGVydHkgPT4gcHJvcGVydHkgaW4gcHJvcHMpO1xuICAgICAgICB9XG4gICAgICB9LCBwcm9wVHJhcHMpO1xuICAgIH0pO1xuICAgIHJlcy5wdXNoKG5ldyBQcm94eSh7XG4gICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIGJsb2NrZWQuaGFzKHByb3BlcnR5KSA/IHVuZGVmaW5lZCA6IHByb3BzW3Byb3BlcnR5XTtcbiAgICAgIH0sXG4gICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIGJsb2NrZWQuaGFzKHByb3BlcnR5KSA/IGZhbHNlIDogcHJvcGVydHkgaW4gcHJvcHM7XG4gICAgICB9LFxuICAgICAga2V5cygpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHByb3BzKS5maWx0ZXIoayA9PiAhYmxvY2tlZC5oYXMoaykpO1xuICAgICAgfVxuICAgIH0sIHByb3BUcmFwcykpO1xuICAgIHJldHVybiByZXM7XG4gIH1cbiAgY29uc3Qgb3RoZXJPYmplY3QgPSB7fTtcbiAgY29uc3Qgb2JqZWN0cyA9IGtleXMubWFwKCgpID0+ICh7fSkpO1xuICBmb3IgKGNvbnN0IHByb3BOYW1lIG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHByb3BzKSkge1xuICAgIGNvbnN0IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHByb3BzLCBwcm9wTmFtZSk7XG4gICAgY29uc3QgaXNEZWZhdWx0RGVzYyA9ICFkZXNjLmdldCAmJiAhZGVzYy5zZXQgJiYgZGVzYy5lbnVtZXJhYmxlICYmIGRlc2Mud3JpdGFibGUgJiYgZGVzYy5jb25maWd1cmFibGU7XG4gICAgbGV0IGJsb2NrZWQgPSBmYWxzZTtcbiAgICBsZXQgb2JqZWN0SW5kZXggPSAwO1xuICAgIGZvciAoY29uc3QgayBvZiBrZXlzKSB7XG4gICAgICBpZiAoay5pbmNsdWRlcyhwcm9wTmFtZSkpIHtcbiAgICAgICAgYmxvY2tlZCA9IHRydWU7XG4gICAgICAgIGlzRGVmYXVsdERlc2MgPyBvYmplY3RzW29iamVjdEluZGV4XVtwcm9wTmFtZV0gPSBkZXNjLnZhbHVlIDogT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iamVjdHNbb2JqZWN0SW5kZXhdLCBwcm9wTmFtZSwgZGVzYyk7XG4gICAgICB9XG4gICAgICArK29iamVjdEluZGV4O1xuICAgIH1cbiAgICBpZiAoIWJsb2NrZWQpIHtcbiAgICAgIGlzRGVmYXVsdERlc2MgPyBvdGhlck9iamVjdFtwcm9wTmFtZV0gPSBkZXNjLnZhbHVlIDogT2JqZWN0LmRlZmluZVByb3BlcnR5KG90aGVyT2JqZWN0LCBwcm9wTmFtZSwgZGVzYyk7XG4gICAgfVxuICB9XG4gIHJldHVybiBbLi4ub2JqZWN0cywgb3RoZXJPYmplY3RdO1xufVxuZnVuY3Rpb24gbGF6eShmbikge1xuICBsZXQgY29tcDtcbiAgbGV0IHA7XG4gIGNvbnN0IHdyYXAgPSBwcm9wcyA9PiB7XG4gICAgY29uc3QgY3R4ID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgaWYgKGN0eCkge1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoKTtcbiAgICAgIHNoYXJlZENvbmZpZy5jb3VudCB8fCAoc2hhcmVkQ29uZmlnLmNvdW50ID0gMCk7XG4gICAgICBzaGFyZWRDb25maWcuY291bnQrKztcbiAgICAgIChwIHx8IChwID0gZm4oKSkpLnRoZW4obW9kID0+IHtcbiAgICAgICAgIXNoYXJlZENvbmZpZy5kb25lICYmIHNldEh5ZHJhdGVDb250ZXh0KGN0eCk7XG4gICAgICAgIHNoYXJlZENvbmZpZy5jb3VudC0tO1xuICAgICAgICBzZXQoKCkgPT4gbW9kLmRlZmF1bHQpO1xuICAgICAgICBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICAgICAgfSk7XG4gICAgICBjb21wID0gcztcbiAgICB9IGVsc2UgaWYgKCFjb21wKSB7XG4gICAgICBjb25zdCBbc10gPSBjcmVhdGVSZXNvdXJjZSgoKSA9PiAocCB8fCAocCA9IGZuKCkpKS50aGVuKG1vZCA9PiBtb2QuZGVmYXVsdCkpO1xuICAgICAgY29tcCA9IHM7XG4gICAgfVxuICAgIGxldCBDb21wO1xuICAgIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IChDb21wID0gY29tcCgpKSA/IHVudHJhY2soKCkgPT4ge1xuICAgICAgaWYgKElTX0RFVikgT2JqZWN0LmFzc2lnbihDb21wLCB7XG4gICAgICAgIFskREVWQ09NUF06IHRydWVcbiAgICAgIH0pO1xuICAgICAgaWYgKCFjdHggfHwgc2hhcmVkQ29uZmlnLmRvbmUpIHJldHVybiBDb21wKHByb3BzKTtcbiAgICAgIGNvbnN0IGMgPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGN0eCk7XG4gICAgICBjb25zdCByID0gQ29tcChwcm9wcyk7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjKTtcbiAgICAgIHJldHVybiByO1xuICAgIH0pIDogXCJcIik7XG4gIH07XG4gIHdyYXAucHJlbG9hZCA9ICgpID0+IHAgfHwgKChwID0gZm4oKSkudGhlbihtb2QgPT4gY29tcCA9ICgpID0+IG1vZC5kZWZhdWx0KSwgcCk7XG4gIHJldHVybiB3cmFwO1xufVxubGV0IGNvdW50ZXIgPSAwO1xuZnVuY3Rpb24gY3JlYXRlVW5pcXVlSWQoKSB7XG4gIGNvbnN0IGN0eCA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICByZXR1cm4gY3R4ID8gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKSA6IGBjbC0ke2NvdW50ZXIrK31gO1xufVxuXG5jb25zdCBuYXJyb3dlZEVycm9yID0gbmFtZSA9PiBgQXR0ZW1wdGluZyB0byBhY2Nlc3MgYSBzdGFsZSB2YWx1ZSBmcm9tIDwke25hbWV9PiB0aGF0IGNvdWxkIHBvc3NpYmx5IGJlIHVuZGVmaW5lZC4gVGhpcyBtYXkgb2NjdXIgYmVjYXVzZSB5b3UgYXJlIHJlYWRpbmcgdGhlIGFjY2Vzc29yIHJldHVybmVkIGZyb20gdGhlIGNvbXBvbmVudCBhdCBhIHRpbWUgd2hlcmUgaXQgaGFzIGFscmVhZHkgYmVlbiB1bm1vdW50ZWQuIFdlIHJlY29tbWVuZCBjbGVhbmluZyB1cCBhbnkgc3RhbGUgdGltZXJzIG9yIGFzeW5jLCBvciByZWFkaW5nIGZyb20gdGhlIGluaXRpYWwgY29uZGl0aW9uLmAgO1xuZnVuY3Rpb24gRm9yKHByb3BzKSB7XG4gIGNvbnN0IGZhbGxiYWNrID0gXCJmYWxsYmFja1wiIGluIHByb3BzICYmIHtcbiAgICBmYWxsYmFjazogKCkgPT4gcHJvcHMuZmFsbGJhY2tcbiAgfTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8obWFwQXJyYXkoKCkgPT4gcHJvcHMuZWFjaCwgcHJvcHMuY2hpbGRyZW4sIGZhbGxiYWNrIHx8IHVuZGVmaW5lZCksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9KSA7XG59XG5mdW5jdGlvbiBJbmRleChwcm9wcykge1xuICBjb25zdCBmYWxsYmFjayA9IFwiZmFsbGJhY2tcIiBpbiBwcm9wcyAmJiB7XG4gICAgZmFsbGJhY2s6ICgpID0+IHByb3BzLmZhbGxiYWNrXG4gIH07XG4gIHJldHVybiBjcmVhdGVNZW1vKGluZGV4QXJyYXkoKCkgPT4gcHJvcHMuZWFjaCwgcHJvcHMuY2hpbGRyZW4sIGZhbGxiYWNrIHx8IHVuZGVmaW5lZCksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9KSA7XG59XG5mdW5jdGlvbiBTaG93KHByb3BzKSB7XG4gIGNvbnN0IGtleWVkID0gcHJvcHMua2V5ZWQ7XG4gIGNvbnN0IGNvbmRpdGlvblZhbHVlID0gY3JlYXRlTWVtbygoKSA9PiBwcm9wcy53aGVuLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImNvbmRpdGlvbiB2YWx1ZVwiXG4gIH0gKTtcbiAgY29uc3QgY29uZGl0aW9uID0ga2V5ZWQgPyBjb25kaXRpb25WYWx1ZSA6IGNyZWF0ZU1lbW8oY29uZGl0aW9uVmFsdWUsIHVuZGVmaW5lZCwge1xuICAgIGVxdWFsczogKGEsIGIpID0+ICFhID09PSAhYixcbiAgICBuYW1lOiBcImNvbmRpdGlvblwiXG4gIH0gKTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGMgPSBjb25kaXRpb24oKTtcbiAgICBpZiAoYykge1xuICAgICAgY29uc3QgY2hpbGQgPSBwcm9wcy5jaGlsZHJlbjtcbiAgICAgIGNvbnN0IGZuID0gdHlwZW9mIGNoaWxkID09PSBcImZ1bmN0aW9uXCIgJiYgY2hpbGQubGVuZ3RoID4gMDtcbiAgICAgIHJldHVybiBmbiA/IHVudHJhY2soKCkgPT4gY2hpbGQoa2V5ZWQgPyBjIDogKCkgPT4ge1xuICAgICAgICBpZiAoIXVudHJhY2soY29uZGl0aW9uKSkgdGhyb3cgbmFycm93ZWRFcnJvcihcIlNob3dcIik7XG4gICAgICAgIHJldHVybiBjb25kaXRpb25WYWx1ZSgpO1xuICAgICAgfSkpIDogY2hpbGQ7XG4gICAgfVxuICAgIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJ2YWx1ZVwiXG4gIH0gKTtcbn1cbmZ1bmN0aW9uIFN3aXRjaChwcm9wcykge1xuICBjb25zdCBjaHMgPSBjaGlsZHJlbigoKSA9PiBwcm9wcy5jaGlsZHJlbik7XG4gIGNvbnN0IHN3aXRjaEZ1bmMgPSBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBjaCA9IGNocygpO1xuICAgIGNvbnN0IG1wcyA9IEFycmF5LmlzQXJyYXkoY2gpID8gY2ggOiBbY2hdO1xuICAgIGxldCBmdW5jID0gKCkgPT4gdW5kZWZpbmVkO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbmRleCA9IGk7XG4gICAgICBjb25zdCBtcCA9IG1wc1tpXTtcbiAgICAgIGNvbnN0IHByZXZGdW5jID0gZnVuYztcbiAgICAgIGNvbnN0IGNvbmRpdGlvblZhbHVlID0gY3JlYXRlTWVtbygoKSA9PiBwcmV2RnVuYygpID8gdW5kZWZpbmVkIDogbXAud2hlbiwgdW5kZWZpbmVkLCB7XG4gICAgICAgIG5hbWU6IFwiY29uZGl0aW9uIHZhbHVlXCJcbiAgICAgIH0gKTtcbiAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IG1wLmtleWVkID8gY29uZGl0aW9uVmFsdWUgOiBjcmVhdGVNZW1vKGNvbmRpdGlvblZhbHVlLCB1bmRlZmluZWQsIHtcbiAgICAgICAgZXF1YWxzOiAoYSwgYikgPT4gIWEgPT09ICFiLFxuICAgICAgICBuYW1lOiBcImNvbmRpdGlvblwiXG4gICAgICB9ICk7XG4gICAgICBmdW5jID0gKCkgPT4gcHJldkZ1bmMoKSB8fCAoY29uZGl0aW9uKCkgPyBbaW5kZXgsIGNvbmRpdGlvblZhbHVlLCBtcF0gOiB1bmRlZmluZWQpO1xuICAgIH1cbiAgICByZXR1cm4gZnVuYztcbiAgfSk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBzZWwgPSBzd2l0Y2hGdW5jKCkoKTtcbiAgICBpZiAoIXNlbCkgcmV0dXJuIHByb3BzLmZhbGxiYWNrO1xuICAgIGNvbnN0IFtpbmRleCwgY29uZGl0aW9uVmFsdWUsIG1wXSA9IHNlbDtcbiAgICBjb25zdCBjaGlsZCA9IG1wLmNoaWxkcmVuO1xuICAgIGNvbnN0IGZuID0gdHlwZW9mIGNoaWxkID09PSBcImZ1bmN0aW9uXCIgJiYgY2hpbGQubGVuZ3RoID4gMDtcbiAgICByZXR1cm4gZm4gPyB1bnRyYWNrKCgpID0+IGNoaWxkKG1wLmtleWVkID8gY29uZGl0aW9uVmFsdWUoKSA6ICgpID0+IHtcbiAgICAgIGlmICh1bnRyYWNrKHN3aXRjaEZ1bmMpKCk/LlswXSAhPT0gaW5kZXgpIHRocm93IG5hcnJvd2VkRXJyb3IoXCJNYXRjaFwiKTtcbiAgICAgIHJldHVybiBjb25kaXRpb25WYWx1ZSgpO1xuICAgIH0pKSA6IGNoaWxkO1xuICB9LCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImV2YWwgY29uZGl0aW9uc1wiXG4gIH0gKTtcbn1cbmZ1bmN0aW9uIE1hdGNoKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcztcbn1cbmxldCBFcnJvcnM7XG5mdW5jdGlvbiByZXNldEVycm9yQm91bmRhcmllcygpIHtcbiAgRXJyb3JzICYmIFsuLi5FcnJvcnNdLmZvckVhY2goZm4gPT4gZm4oKSk7XG59XG5mdW5jdGlvbiBFcnJvckJvdW5kYXJ5KHByb3BzKSB7XG4gIGxldCBlcnI7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCAmJiBzaGFyZWRDb25maWcubG9hZCkgZXJyID0gc2hhcmVkQ29uZmlnLmxvYWQoc2hhcmVkQ29uZmlnLmdldENvbnRleHRJZCgpKTtcbiAgY29uc3QgW2Vycm9yZWQsIHNldEVycm9yZWRdID0gY3JlYXRlU2lnbmFsKGVyciwge1xuICAgIG5hbWU6IFwiZXJyb3JlZFwiXG4gIH0gKTtcbiAgRXJyb3JzIHx8IChFcnJvcnMgPSBuZXcgU2V0KCkpO1xuICBFcnJvcnMuYWRkKHNldEVycm9yZWQpO1xuICBvbkNsZWFudXAoKCkgPT4gRXJyb3JzLmRlbGV0ZShzZXRFcnJvcmVkKSk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBsZXQgZTtcbiAgICBpZiAoZSA9IGVycm9yZWQoKSkge1xuICAgICAgY29uc3QgZiA9IHByb3BzLmZhbGxiYWNrO1xuICAgICAgaWYgKCh0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiIHx8IGYubGVuZ3RoID09IDApKSBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgcmV0dXJuIHR5cGVvZiBmID09PSBcImZ1bmN0aW9uXCIgJiYgZi5sZW5ndGggPyB1bnRyYWNrKCgpID0+IGYoZSwgKCkgPT4gc2V0RXJyb3JlZCgpKSkgOiBmO1xuICAgIH1cbiAgICByZXR1cm4gY2F0Y2hFcnJvcigoKSA9PiBwcm9wcy5jaGlsZHJlbiwgc2V0RXJyb3JlZCk7XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9ICk7XG59XG5cbmNvbnN0IHN1c3BlbnNlTGlzdEVxdWFscyA9IChhLCBiKSA9PiBhLnNob3dDb250ZW50ID09PSBiLnNob3dDb250ZW50ICYmIGEuc2hvd0ZhbGxiYWNrID09PSBiLnNob3dGYWxsYmFjaztcbmNvbnN0IFN1c3BlbnNlTGlzdENvbnRleHQgPSAvKiAjX19QVVJFX18gKi9jcmVhdGVDb250ZXh0KCk7XG5mdW5jdGlvbiBTdXNwZW5zZUxpc3QocHJvcHMpIHtcbiAgbGV0IFt3cmFwcGVyLCBzZXRXcmFwcGVyXSA9IGNyZWF0ZVNpZ25hbCgoKSA9PiAoe1xuICAgICAgaW5GYWxsYmFjazogZmFsc2VcbiAgICB9KSksXG4gICAgc2hvdztcbiAgY29uc3QgbGlzdENvbnRleHQgPSB1c2VDb250ZXh0KFN1c3BlbnNlTGlzdENvbnRleHQpO1xuICBjb25zdCBbcmVnaXN0cnksIHNldFJlZ2lzdHJ5XSA9IGNyZWF0ZVNpZ25hbChbXSk7XG4gIGlmIChsaXN0Q29udGV4dCkge1xuICAgIHNob3cgPSBsaXN0Q29udGV4dC5yZWdpc3RlcihjcmVhdGVNZW1vKCgpID0+IHdyYXBwZXIoKSgpLmluRmFsbGJhY2spKTtcbiAgfVxuICBjb25zdCByZXNvbHZlZCA9IGNyZWF0ZU1lbW8ocHJldiA9PiB7XG4gICAgY29uc3QgcmV2ZWFsID0gcHJvcHMucmV2ZWFsT3JkZXIsXG4gICAgICB0YWlsID0gcHJvcHMudGFpbCxcbiAgICAgIHtcbiAgICAgICAgc2hvd0NvbnRlbnQgPSB0cnVlLFxuICAgICAgICBzaG93RmFsbGJhY2sgPSB0cnVlXG4gICAgICB9ID0gc2hvdyA/IHNob3coKSA6IHt9LFxuICAgICAgcmVnID0gcmVnaXN0cnkoKSxcbiAgICAgIHJldmVyc2UgPSByZXZlYWwgPT09IFwiYmFja3dhcmRzXCI7XG4gICAgaWYgKHJldmVhbCA9PT0gXCJ0b2dldGhlclwiKSB7XG4gICAgICBjb25zdCBhbGwgPSByZWcuZXZlcnkoaW5GYWxsYmFjayA9PiAhaW5GYWxsYmFjaygpKTtcbiAgICAgIGNvbnN0IHJlcyA9IHJlZy5tYXAoKCkgPT4gKHtcbiAgICAgICAgc2hvd0NvbnRlbnQ6IGFsbCAmJiBzaG93Q29udGVudCxcbiAgICAgICAgc2hvd0ZhbGxiYWNrXG4gICAgICB9KSk7XG4gICAgICByZXMuaW5GYWxsYmFjayA9ICFhbGw7XG4gICAgICByZXR1cm4gcmVzO1xuICAgIH1cbiAgICBsZXQgc3RvcCA9IGZhbHNlO1xuICAgIGxldCBpbkZhbGxiYWNrID0gcHJldi5pbkZhbGxiYWNrO1xuICAgIGNvbnN0IHJlcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSByZWcubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGNvbnN0IG4gPSByZXZlcnNlID8gbGVuIC0gaSAtIDEgOiBpLFxuICAgICAgICBzID0gcmVnW25dKCk7XG4gICAgICBpZiAoIXN0b3AgJiYgIXMpIHtcbiAgICAgICAgcmVzW25dID0ge1xuICAgICAgICAgIHNob3dDb250ZW50LFxuICAgICAgICAgIHNob3dGYWxsYmFja1xuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV4dCA9ICFzdG9wO1xuICAgICAgICBpZiAobmV4dCkgaW5GYWxsYmFjayA9IHRydWU7XG4gICAgICAgIHJlc1tuXSA9IHtcbiAgICAgICAgICBzaG93Q29udGVudDogbmV4dCxcbiAgICAgICAgICBzaG93RmFsbGJhY2s6ICF0YWlsIHx8IG5leHQgJiYgdGFpbCA9PT0gXCJjb2xsYXBzZWRcIiA/IHNob3dGYWxsYmFjayA6IGZhbHNlXG4gICAgICAgIH07XG4gICAgICAgIHN0b3AgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXN0b3ApIGluRmFsbGJhY2sgPSBmYWxzZTtcbiAgICByZXMuaW5GYWxsYmFjayA9IGluRmFsbGJhY2s7XG4gICAgcmV0dXJuIHJlcztcbiAgfSwge1xuICAgIGluRmFsbGJhY2s6IGZhbHNlXG4gIH0pO1xuICBzZXRXcmFwcGVyKCgpID0+IHJlc29sdmVkKTtcbiAgcmV0dXJuIGNyZWF0ZUNvbXBvbmVudChTdXNwZW5zZUxpc3RDb250ZXh0LlByb3ZpZGVyLCB7XG4gICAgdmFsdWU6IHtcbiAgICAgIHJlZ2lzdGVyOiBpbkZhbGxiYWNrID0+IHtcbiAgICAgICAgbGV0IGluZGV4O1xuICAgICAgICBzZXRSZWdpc3RyeShyZWdpc3RyeSA9PiB7XG4gICAgICAgICAgaW5kZXggPSByZWdpc3RyeS5sZW5ndGg7XG4gICAgICAgICAgcmV0dXJuIFsuLi5yZWdpc3RyeSwgaW5GYWxsYmFja107XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiByZXNvbHZlZCgpW2luZGV4XSwgdW5kZWZpbmVkLCB7XG4gICAgICAgICAgZXF1YWxzOiBzdXNwZW5zZUxpc3RFcXVhbHNcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgICBnZXQgY2hpbGRyZW4oKSB7XG4gICAgICByZXR1cm4gcHJvcHMuY2hpbGRyZW47XG4gICAgfVxuICB9KTtcbn1cbmZ1bmN0aW9uIFN1c3BlbnNlKHByb3BzKSB7XG4gIGxldCBjb3VudGVyID0gMCxcbiAgICBzaG93LFxuICAgIGN0eCxcbiAgICBwLFxuICAgIGZsaWNrZXIsXG4gICAgZXJyb3I7XG4gIGNvbnN0IFtpbkZhbGxiYWNrLCBzZXRGYWxsYmFja10gPSBjcmVhdGVTaWduYWwoZmFsc2UpLFxuICAgIFN1c3BlbnNlQ29udGV4dCA9IGdldFN1c3BlbnNlQ29udGV4dCgpLFxuICAgIHN0b3JlID0ge1xuICAgICAgaW5jcmVtZW50OiAoKSA9PiB7XG4gICAgICAgIGlmICgrK2NvdW50ZXIgPT09IDEpIHNldEZhbGxiYWNrKHRydWUpO1xuICAgICAgfSxcbiAgICAgIGRlY3JlbWVudDogKCkgPT4ge1xuICAgICAgICBpZiAoLS1jb3VudGVyID09PSAwKSBzZXRGYWxsYmFjayhmYWxzZSk7XG4gICAgICB9LFxuICAgICAgaW5GYWxsYmFjayxcbiAgICAgIGVmZmVjdHM6IFtdLFxuICAgICAgcmVzb2x2ZWQ6IGZhbHNlXG4gICAgfSxcbiAgICBvd25lciA9IGdldE93bmVyKCk7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCAmJiBzaGFyZWRDb25maWcubG9hZCkge1xuICAgIGNvbnN0IGtleSA9IHNoYXJlZENvbmZpZy5nZXRDb250ZXh0SWQoKTtcbiAgICBsZXQgcmVmID0gc2hhcmVkQ29uZmlnLmxvYWQoa2V5KTtcbiAgICBpZiAocmVmKSB7XG4gICAgICBpZiAodHlwZW9mIHJlZiAhPT0gXCJvYmplY3RcIiB8fCByZWYucyAhPT0gMSkgcCA9IHJlZjtlbHNlIHNoYXJlZENvbmZpZy5nYXRoZXIoa2V5KTtcbiAgICB9XG4gICAgaWYgKHAgJiYgcCAhPT0gXCIkJGZcIikge1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICAgIGVxdWFsczogZmFsc2VcbiAgICAgIH0pO1xuICAgICAgZmxpY2tlciA9IHM7XG4gICAgICBwLnRoZW4oKCkgPT4ge1xuICAgICAgICBpZiAoc2hhcmVkQ29uZmlnLmRvbmUpIHJldHVybiBzZXQoKTtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmdhdGhlcihrZXkpO1xuICAgICAgICBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgICBzZXQoKTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgIH0sIGVyciA9PiB7XG4gICAgICAgIGVycm9yID0gZXJyO1xuICAgICAgICBzZXQoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBjb25zdCBsaXN0Q29udGV4dCA9IHVzZUNvbnRleHQoU3VzcGVuc2VMaXN0Q29udGV4dCk7XG4gIGlmIChsaXN0Q29udGV4dCkgc2hvdyA9IGxpc3RDb250ZXh0LnJlZ2lzdGVyKHN0b3JlLmluRmFsbGJhY2spO1xuICBsZXQgZGlzcG9zZTtcbiAgb25DbGVhbnVwKCgpID0+IGRpc3Bvc2UgJiYgZGlzcG9zZSgpKTtcbiAgcmV0dXJuIGNyZWF0ZUNvbXBvbmVudChTdXNwZW5zZUNvbnRleHQuUHJvdmlkZXIsIHtcbiAgICB2YWx1ZTogc3RvcmUsXG4gICAgZ2V0IGNoaWxkcmVuKCkge1xuICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHRocm93IGVycm9yO1xuICAgICAgICBjdHggPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgICAgaWYgKGZsaWNrZXIpIHtcbiAgICAgICAgICBmbGlja2VyKCk7XG4gICAgICAgICAgcmV0dXJuIGZsaWNrZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN0eCAmJiBwID09PSBcIiQkZlwiKSBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICAgICAgICBjb25zdCByZW5kZXJlZCA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICAgICAgICByZXR1cm4gY3JlYXRlTWVtbyhwcmV2ID0+IHtcbiAgICAgICAgICBjb25zdCBpbkZhbGxiYWNrID0gc3RvcmUuaW5GYWxsYmFjaygpLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzaG93Q29udGVudCA9IHRydWUsXG4gICAgICAgICAgICAgIHNob3dGYWxsYmFjayA9IHRydWVcbiAgICAgICAgICAgIH0gPSBzaG93ID8gc2hvdygpIDoge307XG4gICAgICAgICAgaWYgKCghaW5GYWxsYmFjayB8fCBwICYmIHAgIT09IFwiJCRmXCIpICYmIHNob3dDb250ZW50KSB7XG4gICAgICAgICAgICBzdG9yZS5yZXNvbHZlZCA9IHRydWU7XG4gICAgICAgICAgICBkaXNwb3NlICYmIGRpc3Bvc2UoKTtcbiAgICAgICAgICAgIGRpc3Bvc2UgPSBjdHggPSBwID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgcmVzdW1lRWZmZWN0cyhzdG9yZS5lZmZlY3RzKTtcbiAgICAgICAgICAgIHJldHVybiByZW5kZXJlZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXNob3dGYWxsYmFjaykgcmV0dXJuO1xuICAgICAgICAgIGlmIChkaXNwb3NlKSByZXR1cm4gcHJldjtcbiAgICAgICAgICByZXR1cm4gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgICAgICBkaXNwb3NlID0gZGlzcG9zZXI7XG4gICAgICAgICAgICBpZiAoY3R4KSB7XG4gICAgICAgICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KHtcbiAgICAgICAgICAgICAgICBpZDogY3R4LmlkICsgXCJGXCIsXG4gICAgICAgICAgICAgICAgY291bnQ6IDBcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGN0eCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgICAgICAgICB9LCBvd25lcik7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcbn1cblxuY29uc3QgREVWID0ge1xuICBob29rczogRGV2SG9va3MsXG4gIHdyaXRlU2lnbmFsLFxuICByZWdpc3RlckdyYXBoXG59IDtcbmlmIChnbG9iYWxUaGlzKSB7XG4gIGlmICghZ2xvYmFsVGhpcy5Tb2xpZCQkKSBnbG9iYWxUaGlzLlNvbGlkJCQgPSB0cnVlO2Vsc2UgY29uc29sZS53YXJuKFwiWW91IGFwcGVhciB0byBoYXZlIG11bHRpcGxlIGluc3RhbmNlcyBvZiBTb2xpZC4gVGhpcyBjYW4gbGVhZCB0byB1bmV4cGVjdGVkIGJlaGF2aW9yLlwiKTtcbn1cblxuZXhwb3J0IHsgJERFVkNPTVAsICRQUk9YWSwgJFRSQUNLLCBERVYsIEVycm9yQm91bmRhcnksIEZvciwgSW5kZXgsIE1hdGNoLCBTaG93LCBTdXNwZW5zZSwgU3VzcGVuc2VMaXN0LCBTd2l0Y2gsIGJhdGNoLCBjYW5jZWxDYWxsYmFjaywgY2F0Y2hFcnJvciwgY2hpbGRyZW4sIGNyZWF0ZUNvbXBvbmVudCwgY3JlYXRlQ29tcHV0ZWQsIGNyZWF0ZUNvbnRleHQsIGNyZWF0ZURlZmVycmVkLCBjcmVhdGVFZmZlY3QsIGNyZWF0ZU1lbW8sIGNyZWF0ZVJlYWN0aW9uLCBjcmVhdGVSZW5kZXJFZmZlY3QsIGNyZWF0ZVJlc291cmNlLCBjcmVhdGVSb290LCBjcmVhdGVTZWxlY3RvciwgY3JlYXRlU2lnbmFsLCBjcmVhdGVVbmlxdWVJZCwgZW5hYmxlRXh0ZXJuYWxTb3VyY2UsIGVuYWJsZUh5ZHJhdGlvbiwgZW5hYmxlU2NoZWR1bGluZywgZXF1YWxGbiwgZnJvbSwgZ2V0TGlzdGVuZXIsIGdldE93bmVyLCBpbmRleEFycmF5LCBsYXp5LCBtYXBBcnJheSwgbWVyZ2VQcm9wcywgb2JzZXJ2YWJsZSwgb24sIG9uQ2xlYW51cCwgb25FcnJvciwgb25Nb3VudCwgcmVxdWVzdENhbGxiYWNrLCByZXNldEVycm9yQm91bmRhcmllcywgcnVuV2l0aE93bmVyLCBzaGFyZWRDb25maWcsIHNwbGl0UHJvcHMsIHN0YXJ0VHJhbnNpdGlvbiwgdW50cmFjaywgdXNlQ29udGV4dCwgdXNlVHJhbnNpdGlvbiB9O1xuIiwiaW1wb3J0IHsgY3JlYXRlTWVtbywgY3JlYXRlUm9vdCwgY3JlYXRlUmVuZGVyRWZmZWN0LCB1bnRyYWNrLCBzaGFyZWRDb25maWcsIGVuYWJsZUh5ZHJhdGlvbiwgZ2V0T3duZXIsIGNyZWF0ZUVmZmVjdCwgcnVuV2l0aE93bmVyLCBjcmVhdGVTaWduYWwsIG9uQ2xlYW51cCwgJERFVkNPTVAsIHNwbGl0UHJvcHMgfSBmcm9tICdzb2xpZC1qcyc7XG5leHBvcnQgeyBFcnJvckJvdW5kYXJ5LCBGb3IsIEluZGV4LCBNYXRjaCwgU2hvdywgU3VzcGVuc2UsIFN1c3BlbnNlTGlzdCwgU3dpdGNoLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZVJlbmRlckVmZmVjdCBhcyBlZmZlY3QsIGdldE93bmVyLCBtZXJnZVByb3BzLCB1bnRyYWNrIH0gZnJvbSAnc29saWQtanMnO1xuXG5jb25zdCBib29sZWFucyA9IFtcImFsbG93ZnVsbHNjcmVlblwiLCBcImFzeW5jXCIsIFwiYXV0b2ZvY3VzXCIsIFwiYXV0b3BsYXlcIiwgXCJjaGVja2VkXCIsIFwiY29udHJvbHNcIiwgXCJkZWZhdWx0XCIsIFwiZGlzYWJsZWRcIiwgXCJmb3Jtbm92YWxpZGF0ZVwiLCBcImhpZGRlblwiLCBcImluZGV0ZXJtaW5hdGVcIiwgXCJpbmVydFwiLCBcImlzbWFwXCIsIFwibG9vcFwiLCBcIm11bHRpcGxlXCIsIFwibXV0ZWRcIiwgXCJub21vZHVsZVwiLCBcIm5vdmFsaWRhdGVcIiwgXCJvcGVuXCIsIFwicGxheXNpbmxpbmVcIiwgXCJyZWFkb25seVwiLCBcInJlcXVpcmVkXCIsIFwicmV2ZXJzZWRcIiwgXCJzZWFtbGVzc1wiLCBcInNlbGVjdGVkXCJdO1xuY29uc3QgUHJvcGVydGllcyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImNsYXNzTmFtZVwiLCBcInZhbHVlXCIsIFwicmVhZE9ubHlcIiwgXCJub1ZhbGlkYXRlXCIsIFwiZm9ybU5vVmFsaWRhdGVcIiwgXCJpc01hcFwiLCBcIm5vTW9kdWxlXCIsIFwicGxheXNJbmxpbmVcIiwgLi4uYm9vbGVhbnNdKTtcbmNvbnN0IENoaWxkUHJvcGVydGllcyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImlubmVySFRNTFwiLCBcInRleHRDb250ZW50XCIsIFwiaW5uZXJUZXh0XCIsIFwiY2hpbGRyZW5cIl0pO1xuY29uc3QgQWxpYXNlcyA9IC8qI19fUFVSRV9fKi9PYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUobnVsbCksIHtcbiAgY2xhc3NOYW1lOiBcImNsYXNzXCIsXG4gIGh0bWxGb3I6IFwiZm9yXCJcbn0pO1xuY29uc3QgUHJvcEFsaWFzZXMgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmFzc2lnbihPYmplY3QuY3JlYXRlKG51bGwpLCB7XG4gIGNsYXNzOiBcImNsYXNzTmFtZVwiLFxuICBub3ZhbGlkYXRlOiB7XG4gICAgJDogXCJub1ZhbGlkYXRlXCIsXG4gICAgRk9STTogMVxuICB9LFxuICBmb3Jtbm92YWxpZGF0ZToge1xuICAgICQ6IFwiZm9ybU5vVmFsaWRhdGVcIixcbiAgICBCVVRUT046IDEsXG4gICAgSU5QVVQ6IDFcbiAgfSxcbiAgaXNtYXA6IHtcbiAgICAkOiBcImlzTWFwXCIsXG4gICAgSU1HOiAxXG4gIH0sXG4gIG5vbW9kdWxlOiB7XG4gICAgJDogXCJub01vZHVsZVwiLFxuICAgIFNDUklQVDogMVxuICB9LFxuICBwbGF5c2lubGluZToge1xuICAgICQ6IFwicGxheXNJbmxpbmVcIixcbiAgICBWSURFTzogMVxuICB9LFxuICByZWFkb25seToge1xuICAgICQ6IFwicmVhZE9ubHlcIixcbiAgICBJTlBVVDogMSxcbiAgICBURVhUQVJFQTogMVxuICB9XG59KTtcbmZ1bmN0aW9uIGdldFByb3BBbGlhcyhwcm9wLCB0YWdOYW1lKSB7XG4gIGNvbnN0IGEgPSBQcm9wQWxpYXNlc1twcm9wXTtcbiAgcmV0dXJuIHR5cGVvZiBhID09PSBcIm9iamVjdFwiID8gYVt0YWdOYW1lXSA/IGFbXCIkXCJdIDogdW5kZWZpbmVkIDogYTtcbn1cbmNvbnN0IERlbGVnYXRlZEV2ZW50cyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImJlZm9yZWlucHV0XCIsIFwiY2xpY2tcIiwgXCJkYmxjbGlja1wiLCBcImNvbnRleHRtZW51XCIsIFwiZm9jdXNpblwiLCBcImZvY3Vzb3V0XCIsIFwiaW5wdXRcIiwgXCJrZXlkb3duXCIsIFwia2V5dXBcIiwgXCJtb3VzZWRvd25cIiwgXCJtb3VzZW1vdmVcIiwgXCJtb3VzZW91dFwiLCBcIm1vdXNlb3ZlclwiLCBcIm1vdXNldXBcIiwgXCJwb2ludGVyZG93blwiLCBcInBvaW50ZXJtb3ZlXCIsIFwicG9pbnRlcm91dFwiLCBcInBvaW50ZXJvdmVyXCIsIFwicG9pbnRlcnVwXCIsIFwidG91Y2hlbmRcIiwgXCJ0b3VjaG1vdmVcIiwgXCJ0b3VjaHN0YXJ0XCJdKTtcbmNvbnN0IFNWR0VsZW1lbnRzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1xuXCJhbHRHbHlwaFwiLCBcImFsdEdseXBoRGVmXCIsIFwiYWx0R2x5cGhJdGVtXCIsIFwiYW5pbWF0ZVwiLCBcImFuaW1hdGVDb2xvclwiLCBcImFuaW1hdGVNb3Rpb25cIiwgXCJhbmltYXRlVHJhbnNmb3JtXCIsIFwiY2lyY2xlXCIsIFwiY2xpcFBhdGhcIiwgXCJjb2xvci1wcm9maWxlXCIsIFwiY3Vyc29yXCIsIFwiZGVmc1wiLCBcImRlc2NcIiwgXCJlbGxpcHNlXCIsIFwiZmVCbGVuZFwiLCBcImZlQ29sb3JNYXRyaXhcIiwgXCJmZUNvbXBvbmVudFRyYW5zZmVyXCIsIFwiZmVDb21wb3NpdGVcIiwgXCJmZUNvbnZvbHZlTWF0cml4XCIsIFwiZmVEaWZmdXNlTGlnaHRpbmdcIiwgXCJmZURpc3BsYWNlbWVudE1hcFwiLCBcImZlRGlzdGFudExpZ2h0XCIsIFwiZmVEcm9wU2hhZG93XCIsIFwiZmVGbG9vZFwiLCBcImZlRnVuY0FcIiwgXCJmZUZ1bmNCXCIsIFwiZmVGdW5jR1wiLCBcImZlRnVuY1JcIiwgXCJmZUdhdXNzaWFuQmx1clwiLCBcImZlSW1hZ2VcIiwgXCJmZU1lcmdlXCIsIFwiZmVNZXJnZU5vZGVcIiwgXCJmZU1vcnBob2xvZ3lcIiwgXCJmZU9mZnNldFwiLCBcImZlUG9pbnRMaWdodFwiLCBcImZlU3BlY3VsYXJMaWdodGluZ1wiLCBcImZlU3BvdExpZ2h0XCIsIFwiZmVUaWxlXCIsIFwiZmVUdXJidWxlbmNlXCIsIFwiZmlsdGVyXCIsIFwiZm9udFwiLCBcImZvbnQtZmFjZVwiLCBcImZvbnQtZmFjZS1mb3JtYXRcIiwgXCJmb250LWZhY2UtbmFtZVwiLCBcImZvbnQtZmFjZS1zcmNcIiwgXCJmb250LWZhY2UtdXJpXCIsIFwiZm9yZWlnbk9iamVjdFwiLCBcImdcIiwgXCJnbHlwaFwiLCBcImdseXBoUmVmXCIsIFwiaGtlcm5cIiwgXCJpbWFnZVwiLCBcImxpbmVcIiwgXCJsaW5lYXJHcmFkaWVudFwiLCBcIm1hcmtlclwiLCBcIm1hc2tcIiwgXCJtZXRhZGF0YVwiLCBcIm1pc3NpbmctZ2x5cGhcIiwgXCJtcGF0aFwiLCBcInBhdGhcIiwgXCJwYXR0ZXJuXCIsIFwicG9seWdvblwiLCBcInBvbHlsaW5lXCIsIFwicmFkaWFsR3JhZGllbnRcIiwgXCJyZWN0XCIsXG5cInNldFwiLCBcInN0b3BcIixcblwic3ZnXCIsIFwic3dpdGNoXCIsIFwic3ltYm9sXCIsIFwidGV4dFwiLCBcInRleHRQYXRoXCIsXG5cInRyZWZcIiwgXCJ0c3BhblwiLCBcInVzZVwiLCBcInZpZXdcIiwgXCJ2a2VyblwiXSk7XG5jb25zdCBTVkdOYW1lc3BhY2UgPSB7XG4gIHhsaW5rOiBcImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIixcbiAgeG1sOiBcImh0dHA6Ly93d3cudzMub3JnL1hNTC8xOTk4L25hbWVzcGFjZVwiXG59O1xuY29uc3QgRE9NRWxlbWVudHMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJodG1sXCIsIFwiYmFzZVwiLCBcImhlYWRcIiwgXCJsaW5rXCIsIFwibWV0YVwiLCBcInN0eWxlXCIsIFwidGl0bGVcIiwgXCJib2R5XCIsIFwiYWRkcmVzc1wiLCBcImFydGljbGVcIiwgXCJhc2lkZVwiLCBcImZvb3RlclwiLCBcImhlYWRlclwiLCBcIm1haW5cIiwgXCJuYXZcIiwgXCJzZWN0aW9uXCIsIFwiYm9keVwiLCBcImJsb2NrcXVvdGVcIiwgXCJkZFwiLCBcImRpdlwiLCBcImRsXCIsIFwiZHRcIiwgXCJmaWdjYXB0aW9uXCIsIFwiZmlndXJlXCIsIFwiaHJcIiwgXCJsaVwiLCBcIm9sXCIsIFwicFwiLCBcInByZVwiLCBcInVsXCIsIFwiYVwiLCBcImFiYnJcIiwgXCJiXCIsIFwiYmRpXCIsIFwiYmRvXCIsIFwiYnJcIiwgXCJjaXRlXCIsIFwiY29kZVwiLCBcImRhdGFcIiwgXCJkZm5cIiwgXCJlbVwiLCBcImlcIiwgXCJrYmRcIiwgXCJtYXJrXCIsIFwicVwiLCBcInJwXCIsIFwicnRcIiwgXCJydWJ5XCIsIFwic1wiLCBcInNhbXBcIiwgXCJzbWFsbFwiLCBcInNwYW5cIiwgXCJzdHJvbmdcIiwgXCJzdWJcIiwgXCJzdXBcIiwgXCJ0aW1lXCIsIFwidVwiLCBcInZhclwiLCBcIndiclwiLCBcImFyZWFcIiwgXCJhdWRpb1wiLCBcImltZ1wiLCBcIm1hcFwiLCBcInRyYWNrXCIsIFwidmlkZW9cIiwgXCJlbWJlZFwiLCBcImlmcmFtZVwiLCBcIm9iamVjdFwiLCBcInBhcmFtXCIsIFwicGljdHVyZVwiLCBcInBvcnRhbFwiLCBcInNvdXJjZVwiLCBcInN2Z1wiLCBcIm1hdGhcIiwgXCJjYW52YXNcIiwgXCJub3NjcmlwdFwiLCBcInNjcmlwdFwiLCBcImRlbFwiLCBcImluc1wiLCBcImNhcHRpb25cIiwgXCJjb2xcIiwgXCJjb2xncm91cFwiLCBcInRhYmxlXCIsIFwidGJvZHlcIiwgXCJ0ZFwiLCBcInRmb290XCIsIFwidGhcIiwgXCJ0aGVhZFwiLCBcInRyXCIsIFwiYnV0dG9uXCIsIFwiZGF0YWxpc3RcIiwgXCJmaWVsZHNldFwiLCBcImZvcm1cIiwgXCJpbnB1dFwiLCBcImxhYmVsXCIsIFwibGVnZW5kXCIsIFwibWV0ZXJcIiwgXCJvcHRncm91cFwiLCBcIm9wdGlvblwiLCBcIm91dHB1dFwiLCBcInByb2dyZXNzXCIsIFwic2VsZWN0XCIsIFwidGV4dGFyZWFcIiwgXCJkZXRhaWxzXCIsIFwiZGlhbG9nXCIsIFwibWVudVwiLCBcInN1bW1hcnlcIiwgXCJkZXRhaWxzXCIsIFwic2xvdFwiLCBcInRlbXBsYXRlXCIsIFwiYWNyb255bVwiLCBcImFwcGxldFwiLCBcImJhc2Vmb250XCIsIFwiYmdzb3VuZFwiLCBcImJpZ1wiLCBcImJsaW5rXCIsIFwiY2VudGVyXCIsIFwiY29udGVudFwiLCBcImRpclwiLCBcImZvbnRcIiwgXCJmcmFtZVwiLCBcImZyYW1lc2V0XCIsIFwiaGdyb3VwXCIsIFwiaW1hZ2VcIiwgXCJrZXlnZW5cIiwgXCJtYXJxdWVlXCIsIFwibWVudWl0ZW1cIiwgXCJub2JyXCIsIFwibm9lbWJlZFwiLCBcIm5vZnJhbWVzXCIsIFwicGxhaW50ZXh0XCIsIFwicmJcIiwgXCJydGNcIiwgXCJzaGFkb3dcIiwgXCJzcGFjZXJcIiwgXCJzdHJpa2VcIiwgXCJ0dFwiLCBcInhtcFwiLCBcImFcIiwgXCJhYmJyXCIsIFwiYWNyb255bVwiLCBcImFkZHJlc3NcIiwgXCJhcHBsZXRcIiwgXCJhcmVhXCIsIFwiYXJ0aWNsZVwiLCBcImFzaWRlXCIsIFwiYXVkaW9cIiwgXCJiXCIsIFwiYmFzZVwiLCBcImJhc2Vmb250XCIsIFwiYmRpXCIsIFwiYmRvXCIsIFwiYmdzb3VuZFwiLCBcImJpZ1wiLCBcImJsaW5rXCIsIFwiYmxvY2txdW90ZVwiLCBcImJvZHlcIiwgXCJiclwiLCBcImJ1dHRvblwiLCBcImNhbnZhc1wiLCBcImNhcHRpb25cIiwgXCJjZW50ZXJcIiwgXCJjaXRlXCIsIFwiY29kZVwiLCBcImNvbFwiLCBcImNvbGdyb3VwXCIsIFwiY29udGVudFwiLCBcImRhdGFcIiwgXCJkYXRhbGlzdFwiLCBcImRkXCIsIFwiZGVsXCIsIFwiZGV0YWlsc1wiLCBcImRmblwiLCBcImRpYWxvZ1wiLCBcImRpclwiLCBcImRpdlwiLCBcImRsXCIsIFwiZHRcIiwgXCJlbVwiLCBcImVtYmVkXCIsIFwiZmllbGRzZXRcIiwgXCJmaWdjYXB0aW9uXCIsIFwiZmlndXJlXCIsIFwiZm9udFwiLCBcImZvb3RlclwiLCBcImZvcm1cIiwgXCJmcmFtZVwiLCBcImZyYW1lc2V0XCIsIFwiaGVhZFwiLCBcImhlYWRlclwiLCBcImhncm91cFwiLCBcImhyXCIsIFwiaHRtbFwiLCBcImlcIiwgXCJpZnJhbWVcIiwgXCJpbWFnZVwiLCBcImltZ1wiLCBcImlucHV0XCIsIFwiaW5zXCIsIFwia2JkXCIsIFwia2V5Z2VuXCIsIFwibGFiZWxcIiwgXCJsZWdlbmRcIiwgXCJsaVwiLCBcImxpbmtcIiwgXCJtYWluXCIsIFwibWFwXCIsIFwibWFya1wiLCBcIm1hcnF1ZWVcIiwgXCJtZW51XCIsIFwibWVudWl0ZW1cIiwgXCJtZXRhXCIsIFwibWV0ZXJcIiwgXCJuYXZcIiwgXCJub2JyXCIsIFwibm9lbWJlZFwiLCBcIm5vZnJhbWVzXCIsIFwibm9zY3JpcHRcIiwgXCJvYmplY3RcIiwgXCJvbFwiLCBcIm9wdGdyb3VwXCIsIFwib3B0aW9uXCIsIFwib3V0cHV0XCIsIFwicFwiLCBcInBhcmFtXCIsIFwicGljdHVyZVwiLCBcInBsYWludGV4dFwiLCBcInBvcnRhbFwiLCBcInByZVwiLCBcInByb2dyZXNzXCIsIFwicVwiLCBcInJiXCIsIFwicnBcIiwgXCJydFwiLCBcInJ0Y1wiLCBcInJ1YnlcIiwgXCJzXCIsIFwic2FtcFwiLCBcInNjcmlwdFwiLCBcInNlY3Rpb25cIiwgXCJzZWxlY3RcIiwgXCJzaGFkb3dcIiwgXCJzbG90XCIsIFwic21hbGxcIiwgXCJzb3VyY2VcIiwgXCJzcGFjZXJcIiwgXCJzcGFuXCIsIFwic3RyaWtlXCIsIFwic3Ryb25nXCIsIFwic3R5bGVcIiwgXCJzdWJcIiwgXCJzdW1tYXJ5XCIsIFwic3VwXCIsIFwidGFibGVcIiwgXCJ0Ym9keVwiLCBcInRkXCIsIFwidGVtcGxhdGVcIiwgXCJ0ZXh0YXJlYVwiLCBcInRmb290XCIsIFwidGhcIiwgXCJ0aGVhZFwiLCBcInRpbWVcIiwgXCJ0aXRsZVwiLCBcInRyXCIsIFwidHJhY2tcIiwgXCJ0dFwiLCBcInVcIiwgXCJ1bFwiLCBcInZhclwiLCBcInZpZGVvXCIsIFwid2JyXCIsIFwieG1wXCIsIFwiaW5wdXRcIiwgXCJoMVwiLCBcImgyXCIsIFwiaDNcIiwgXCJoNFwiLCBcImg1XCIsIFwiaDZcIl0pO1xuXG5jb25zdCBtZW1vID0gZm4gPT4gY3JlYXRlTWVtbygoKSA9PiBmbigpKTtcblxuZnVuY3Rpb24gcmVjb25jaWxlQXJyYXlzKHBhcmVudE5vZGUsIGEsIGIpIHtcbiAgbGV0IGJMZW5ndGggPSBiLmxlbmd0aCxcbiAgICBhRW5kID0gYS5sZW5ndGgsXG4gICAgYkVuZCA9IGJMZW5ndGgsXG4gICAgYVN0YXJ0ID0gMCxcbiAgICBiU3RhcnQgPSAwLFxuICAgIGFmdGVyID0gYVthRW5kIC0gMV0ubmV4dFNpYmxpbmcsXG4gICAgbWFwID0gbnVsbDtcbiAgd2hpbGUgKGFTdGFydCA8IGFFbmQgfHwgYlN0YXJ0IDwgYkVuZCkge1xuICAgIGlmIChhW2FTdGFydF0gPT09IGJbYlN0YXJ0XSkge1xuICAgICAgYVN0YXJ0Kys7XG4gICAgICBiU3RhcnQrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICB3aGlsZSAoYVthRW5kIC0gMV0gPT09IGJbYkVuZCAtIDFdKSB7XG4gICAgICBhRW5kLS07XG4gICAgICBiRW5kLS07XG4gICAgfVxuICAgIGlmIChhRW5kID09PSBhU3RhcnQpIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBiRW5kIDwgYkxlbmd0aCA/IGJTdGFydCA/IGJbYlN0YXJ0IC0gMV0ubmV4dFNpYmxpbmcgOiBiW2JFbmQgLSBiU3RhcnRdIDogYWZ0ZXI7XG4gICAgICB3aGlsZSAoYlN0YXJ0IDwgYkVuZCkgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAoYkVuZCA9PT0gYlN0YXJ0KSB7XG4gICAgICB3aGlsZSAoYVN0YXJ0IDwgYUVuZCkge1xuICAgICAgICBpZiAoIW1hcCB8fCAhbWFwLmhhcyhhW2FTdGFydF0pKSBhW2FTdGFydF0ucmVtb3ZlKCk7XG4gICAgICAgIGFTdGFydCsrO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYVthU3RhcnRdID09PSBiW2JFbmQgLSAxXSAmJiBiW2JTdGFydF0gPT09IGFbYUVuZCAtIDFdKSB7XG4gICAgICBjb25zdCBub2RlID0gYVstLWFFbmRdLm5leHRTaWJsaW5nO1xuICAgICAgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIGFbYVN0YXJ0KytdLm5leHRTaWJsaW5nKTtcbiAgICAgIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbLS1iRW5kXSwgbm9kZSk7XG4gICAgICBhW2FFbmRdID0gYltiRW5kXTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFtYXApIHtcbiAgICAgICAgbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICBsZXQgaSA9IGJTdGFydDtcbiAgICAgICAgd2hpbGUgKGkgPCBiRW5kKSBtYXAuc2V0KGJbaV0sIGkrKyk7XG4gICAgICB9XG4gICAgICBjb25zdCBpbmRleCA9IG1hcC5nZXQoYVthU3RhcnRdKTtcbiAgICAgIGlmIChpbmRleCAhPSBudWxsKSB7XG4gICAgICAgIGlmIChiU3RhcnQgPCBpbmRleCAmJiBpbmRleCA8IGJFbmQpIHtcbiAgICAgICAgICBsZXQgaSA9IGFTdGFydCxcbiAgICAgICAgICAgIHNlcXVlbmNlID0gMSxcbiAgICAgICAgICAgIHQ7XG4gICAgICAgICAgd2hpbGUgKCsraSA8IGFFbmQgJiYgaSA8IGJFbmQpIHtcbiAgICAgICAgICAgIGlmICgodCA9IG1hcC5nZXQoYVtpXSkpID09IG51bGwgfHwgdCAhPT0gaW5kZXggKyBzZXF1ZW5jZSkgYnJlYWs7XG4gICAgICAgICAgICBzZXF1ZW5jZSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc2VxdWVuY2UgPiBpbmRleCAtIGJTdGFydCkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGFbYVN0YXJ0XTtcbiAgICAgICAgICAgIHdoaWxlIChiU3RhcnQgPCBpbmRleCkgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIG5vZGUpO1xuICAgICAgICAgIH0gZWxzZSBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChiW2JTdGFydCsrXSwgYVthU3RhcnQrK10pO1xuICAgICAgICB9IGVsc2UgYVN0YXJ0Kys7XG4gICAgICB9IGVsc2UgYVthU3RhcnQrK10ucmVtb3ZlKCk7XG4gICAgfVxuICB9XG59XG5cbmNvbnN0ICQkRVZFTlRTID0gXCJfJERYX0RFTEVHQVRFXCI7XG5mdW5jdGlvbiByZW5kZXIoY29kZSwgZWxlbWVudCwgaW5pdCwgb3B0aW9ucyA9IHt9KSB7XG4gIGlmICghZWxlbWVudCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBgZWxlbWVudGAgcGFzc2VkIHRvIGByZW5kZXIoLi4uLCBlbGVtZW50KWAgZG9lc24ndCBleGlzdC4gTWFrZSBzdXJlIGBlbGVtZW50YCBleGlzdHMgaW4gdGhlIGRvY3VtZW50LlwiKTtcbiAgfVxuICBsZXQgZGlzcG9zZXI7XG4gIGNyZWF0ZVJvb3QoZGlzcG9zZSA9PiB7XG4gICAgZGlzcG9zZXIgPSBkaXNwb3NlO1xuICAgIGVsZW1lbnQgPT09IGRvY3VtZW50ID8gY29kZSgpIDogaW5zZXJ0KGVsZW1lbnQsIGNvZGUoKSwgZWxlbWVudC5maXJzdENoaWxkID8gbnVsbCA6IHVuZGVmaW5lZCwgaW5pdCk7XG4gIH0sIG9wdGlvbnMub3duZXIpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGRpc3Bvc2VyKCk7XG4gICAgZWxlbWVudC50ZXh0Q29udGVudCA9IFwiXCI7XG4gIH07XG59XG5mdW5jdGlvbiB0ZW1wbGF0ZShodG1sLCBpc0ltcG9ydE5vZGUsIGlzU1ZHLCBpc01hdGhNTCkge1xuICBsZXQgbm9kZTtcbiAgY29uc3QgY3JlYXRlID0gKCkgPT4ge1xuICAgIGlmIChpc0h5ZHJhdGluZygpKSB0aHJvdyBuZXcgRXJyb3IoXCJGYWlsZWQgYXR0ZW1wdCB0byBjcmVhdGUgbmV3IERPTSBlbGVtZW50cyBkdXJpbmcgaHlkcmF0aW9uLiBDaGVjayB0aGF0IHRoZSBsaWJyYXJpZXMgeW91IGFyZSB1c2luZyBzdXBwb3J0IGh5ZHJhdGlvbi5cIik7XG4gICAgY29uc3QgdCA9IGlzTWF0aE1MID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMTk5OC9NYXRoL01hdGhNTFwiLCBcInRlbXBsYXRlXCIpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIpO1xuICAgIHQuaW5uZXJIVE1MID0gaHRtbDtcbiAgICByZXR1cm4gaXNTVkcgPyB0LmNvbnRlbnQuZmlyc3RDaGlsZC5maXJzdENoaWxkIDogaXNNYXRoTUwgPyB0LmZpcnN0Q2hpbGQgOiB0LmNvbnRlbnQuZmlyc3RDaGlsZDtcbiAgfTtcbiAgY29uc3QgZm4gPSBpc0ltcG9ydE5vZGUgPyAoKSA9PiB1bnRyYWNrKCgpID0+IGRvY3VtZW50LmltcG9ydE5vZGUobm9kZSB8fCAobm9kZSA9IGNyZWF0ZSgpKSwgdHJ1ZSkpIDogKCkgPT4gKG5vZGUgfHwgKG5vZGUgPSBjcmVhdGUoKSkpLmNsb25lTm9kZSh0cnVlKTtcbiAgZm4uY2xvbmVOb2RlID0gZm47XG4gIHJldHVybiBmbjtcbn1cbmZ1bmN0aW9uIGRlbGVnYXRlRXZlbnRzKGV2ZW50TmFtZXMsIGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50KSB7XG4gIGNvbnN0IGUgPSBkb2N1bWVudFskJEVWRU5UU10gfHwgKGRvY3VtZW50WyQkRVZFTlRTXSA9IG5ldyBTZXQoKSk7XG4gIGZvciAobGV0IGkgPSAwLCBsID0gZXZlbnROYW1lcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBjb25zdCBuYW1lID0gZXZlbnROYW1lc1tpXTtcbiAgICBpZiAoIWUuaGFzKG5hbWUpKSB7XG4gICAgICBlLmFkZChuYW1lKTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZXZlbnRIYW5kbGVyKTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIGNsZWFyRGVsZWdhdGVkRXZlbnRzKGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50KSB7XG4gIGlmIChkb2N1bWVudFskJEVWRU5UU10pIHtcbiAgICBmb3IgKGxldCBuYW1lIG9mIGRvY3VtZW50WyQkRVZFTlRTXS5rZXlzKCkpIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgZXZlbnRIYW5kbGVyKTtcbiAgICBkZWxldGUgZG9jdW1lbnRbJCRFVkVOVFNdO1xuICB9XG59XG5mdW5jdGlvbiBzZXRQcm9wZXJ0eShub2RlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgbm9kZVtuYW1lXSA9IHZhbHVlO1xufVxuZnVuY3Rpb24gc2V0QXR0cmlidXRlKG5vZGUsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBpZiAodmFsdWUgPT0gbnVsbCkgbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7ZWxzZSBub2RlLnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBzZXRBdHRyaWJ1dGVOUyhub2RlLCBuYW1lc3BhY2UsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBpZiAodmFsdWUgPT0gbnVsbCkgbm9kZS5yZW1vdmVBdHRyaWJ1dGVOUyhuYW1lc3BhY2UsIG5hbWUpO2Vsc2Ugbm9kZS5zZXRBdHRyaWJ1dGVOUyhuYW1lc3BhY2UsIG5hbWUsIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIHNldEJvb2xBdHRyaWJ1dGUobm9kZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIHZhbHVlID8gbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgXCJcIikgOiBub2RlLnJlbW92ZUF0dHJpYnV0ZShuYW1lKTtcbn1cbmZ1bmN0aW9uIGNsYXNzTmFtZShub2RlLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlKFwiY2xhc3NcIik7ZWxzZSBub2RlLmNsYXNzTmFtZSA9IHZhbHVlO1xufVxuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcihub2RlLCBuYW1lLCBoYW5kbGVyLCBkZWxlZ2F0ZSkge1xuICBpZiAoZGVsZWdhdGUpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShoYW5kbGVyKSkge1xuICAgICAgbm9kZVtgJCQke25hbWV9YF0gPSBoYW5kbGVyWzBdO1xuICAgICAgbm9kZVtgJCQke25hbWV9RGF0YWBdID0gaGFuZGxlclsxXTtcbiAgICB9IGVsc2Ugbm9kZVtgJCQke25hbWV9YF0gPSBoYW5kbGVyO1xuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaGFuZGxlcikpIHtcbiAgICBjb25zdCBoYW5kbGVyRm4gPSBoYW5kbGVyWzBdO1xuICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBoYW5kbGVyWzBdID0gZSA9PiBoYW5kbGVyRm4uY2FsbChub2RlLCBoYW5kbGVyWzFdLCBlKSk7XG4gIH0gZWxzZSBub2RlLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgaGFuZGxlciwgdHlwZW9mIGhhbmRsZXIgIT09IFwiZnVuY3Rpb25cIiAmJiBoYW5kbGVyKTtcbn1cbmZ1bmN0aW9uIGNsYXNzTGlzdChub2RlLCB2YWx1ZSwgcHJldiA9IHt9KSB7XG4gIGNvbnN0IGNsYXNzS2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlIHx8IHt9KSxcbiAgICBwcmV2S2V5cyA9IE9iamVjdC5rZXlzKHByZXYpO1xuICBsZXQgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBwcmV2S2V5cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNvbnN0IGtleSA9IHByZXZLZXlzW2ldO1xuICAgIGlmICgha2V5IHx8IGtleSA9PT0gXCJ1bmRlZmluZWRcIiB8fCB2YWx1ZVtrZXldKSBjb250aW51ZTtcbiAgICB0b2dnbGVDbGFzc0tleShub2RlLCBrZXksIGZhbHNlKTtcbiAgICBkZWxldGUgcHJldltrZXldO1xuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IGNsYXNzS2V5cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNvbnN0IGtleSA9IGNsYXNzS2V5c1tpXSxcbiAgICAgIGNsYXNzVmFsdWUgPSAhIXZhbHVlW2tleV07XG4gICAgaWYgKCFrZXkgfHwga2V5ID09PSBcInVuZGVmaW5lZFwiIHx8IHByZXZba2V5XSA9PT0gY2xhc3NWYWx1ZSB8fCAhY2xhc3NWYWx1ZSkgY29udGludWU7XG4gICAgdG9nZ2xlQ2xhc3NLZXkobm9kZSwga2V5LCB0cnVlKTtcbiAgICBwcmV2W2tleV0gPSBjbGFzc1ZhbHVlO1xuICB9XG4gIHJldHVybiBwcmV2O1xufVxuZnVuY3Rpb24gc3R5bGUobm9kZSwgdmFsdWUsIHByZXYpIHtcbiAgaWYgKCF2YWx1ZSkgcmV0dXJuIHByZXYgPyBzZXRBdHRyaWJ1dGUobm9kZSwgXCJzdHlsZVwiKSA6IHZhbHVlO1xuICBjb25zdCBub2RlU3R5bGUgPSBub2RlLnN0eWxlO1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSByZXR1cm4gbm9kZVN0eWxlLmNzc1RleHQgPSB2YWx1ZTtcbiAgdHlwZW9mIHByZXYgPT09IFwic3RyaW5nXCIgJiYgKG5vZGVTdHlsZS5jc3NUZXh0ID0gcHJldiA9IHVuZGVmaW5lZCk7XG4gIHByZXYgfHwgKHByZXYgPSB7fSk7XG4gIHZhbHVlIHx8ICh2YWx1ZSA9IHt9KTtcbiAgbGV0IHYsIHM7XG4gIGZvciAocyBpbiBwcmV2KSB7XG4gICAgdmFsdWVbc10gPT0gbnVsbCAmJiBub2RlU3R5bGUucmVtb3ZlUHJvcGVydHkocyk7XG4gICAgZGVsZXRlIHByZXZbc107XG4gIH1cbiAgZm9yIChzIGluIHZhbHVlKSB7XG4gICAgdiA9IHZhbHVlW3NdO1xuICAgIGlmICh2ICE9PSBwcmV2W3NdKSB7XG4gICAgICBub2RlU3R5bGUuc2V0UHJvcGVydHkocywgdik7XG4gICAgICBwcmV2W3NdID0gdjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHByZXY7XG59XG5mdW5jdGlvbiBzcHJlYWQobm9kZSwgcHJvcHMgPSB7fSwgaXNTVkcsIHNraXBDaGlsZHJlbikge1xuICBjb25zdCBwcmV2UHJvcHMgPSB7fTtcbiAgaWYgKCFza2lwQ2hpbGRyZW4pIHtcbiAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gcHJldlByb3BzLmNoaWxkcmVuID0gaW5zZXJ0RXhwcmVzc2lvbihub2RlLCBwcm9wcy5jaGlsZHJlbiwgcHJldlByb3BzLmNoaWxkcmVuKSk7XG4gIH1cbiAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHR5cGVvZiBwcm9wcy5yZWYgPT09IFwiZnVuY3Rpb25cIiAmJiB1c2UocHJvcHMucmVmLCBub2RlKSk7XG4gIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiBhc3NpZ24obm9kZSwgcHJvcHMsIGlzU1ZHLCB0cnVlLCBwcmV2UHJvcHMsIHRydWUpKTtcbiAgcmV0dXJuIHByZXZQcm9wcztcbn1cbmZ1bmN0aW9uIGR5bmFtaWNQcm9wZXJ0eShwcm9wcywga2V5KSB7XG4gIGNvbnN0IHNyYyA9IHByb3BzW2tleV07XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm9wcywga2V5LCB7XG4gICAgZ2V0KCkge1xuICAgICAgcmV0dXJuIHNyYygpO1xuICAgIH0sXG4gICAgZW51bWVyYWJsZTogdHJ1ZVxuICB9KTtcbiAgcmV0dXJuIHByb3BzO1xufVxuZnVuY3Rpb24gdXNlKGZuLCBlbGVtZW50LCBhcmcpIHtcbiAgcmV0dXJuIHVudHJhY2soKCkgPT4gZm4oZWxlbWVudCwgYXJnKSk7XG59XG5mdW5jdGlvbiBpbnNlcnQocGFyZW50LCBhY2Nlc3NvciwgbWFya2VyLCBpbml0aWFsKSB7XG4gIGlmIChtYXJrZXIgIT09IHVuZGVmaW5lZCAmJiAhaW5pdGlhbCkgaW5pdGlhbCA9IFtdO1xuICBpZiAodHlwZW9mIGFjY2Vzc29yICE9PSBcImZ1bmN0aW9uXCIpIHJldHVybiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgYWNjZXNzb3IsIGluaXRpYWwsIG1hcmtlcik7XG4gIGNyZWF0ZVJlbmRlckVmZmVjdChjdXJyZW50ID0+IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCBhY2Nlc3NvcigpLCBjdXJyZW50LCBtYXJrZXIpLCBpbml0aWFsKTtcbn1cbmZ1bmN0aW9uIGFzc2lnbihub2RlLCBwcm9wcywgaXNTVkcsIHNraXBDaGlsZHJlbiwgcHJldlByb3BzID0ge30sIHNraXBSZWYgPSBmYWxzZSkge1xuICBwcm9wcyB8fCAocHJvcHMgPSB7fSk7XG4gIGZvciAoY29uc3QgcHJvcCBpbiBwcmV2UHJvcHMpIHtcbiAgICBpZiAoIShwcm9wIGluIHByb3BzKSkge1xuICAgICAgaWYgKHByb3AgPT09IFwiY2hpbGRyZW5cIikgY29udGludWU7XG4gICAgICBwcmV2UHJvcHNbcHJvcF0gPSBhc3NpZ25Qcm9wKG5vZGUsIHByb3AsIG51bGwsIHByZXZQcm9wc1twcm9wXSwgaXNTVkcsIHNraXBSZWYsIHByb3BzKTtcbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBwcm9wIGluIHByb3BzKSB7XG4gICAgaWYgKHByb3AgPT09IFwiY2hpbGRyZW5cIikge1xuICAgICAgaWYgKCFza2lwQ2hpbGRyZW4pIGluc2VydEV4cHJlc3Npb24obm9kZSwgcHJvcHMuY2hpbGRyZW4pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gcHJvcHNbcHJvcF07XG4gICAgcHJldlByb3BzW3Byb3BdID0gYXNzaWduUHJvcChub2RlLCBwcm9wLCB2YWx1ZSwgcHJldlByb3BzW3Byb3BdLCBpc1NWRywgc2tpcFJlZiwgcHJvcHMpO1xuICB9XG59XG5mdW5jdGlvbiBoeWRyYXRlJDEoY29kZSwgZWxlbWVudCwgb3B0aW9ucyA9IHt9KSB7XG4gIGlmIChnbG9iYWxUaGlzLl8kSFkuZG9uZSkgcmV0dXJuIHJlbmRlcihjb2RlLCBlbGVtZW50LCBbLi4uZWxlbWVudC5jaGlsZE5vZGVzXSwgb3B0aW9ucyk7XG4gIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQgPSBnbG9iYWxUaGlzLl8kSFkuY29tcGxldGVkO1xuICBzaGFyZWRDb25maWcuZXZlbnRzID0gZ2xvYmFsVGhpcy5fJEhZLmV2ZW50cztcbiAgc2hhcmVkQ29uZmlnLmxvYWQgPSBpZCA9PiBnbG9iYWxUaGlzLl8kSFkucltpZF07XG4gIHNoYXJlZENvbmZpZy5oYXMgPSBpZCA9PiBpZCBpbiBnbG9iYWxUaGlzLl8kSFkucjtcbiAgc2hhcmVkQ29uZmlnLmdhdGhlciA9IHJvb3QgPT4gZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCByb290KTtcbiAgc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ID0gbmV3IE1hcCgpO1xuICBzaGFyZWRDb25maWcuY29udGV4dCA9IHtcbiAgICBpZDogb3B0aW9ucy5yZW5kZXJJZCB8fCBcIlwiLFxuICAgIGNvdW50OiAwXG4gIH07XG4gIHRyeSB7XG4gICAgZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCBvcHRpb25zLnJlbmRlcklkKTtcbiAgICByZXR1cm4gcmVuZGVyKGNvZGUsIGVsZW1lbnQsIFsuLi5lbGVtZW50LmNoaWxkTm9kZXNdLCBvcHRpb25zKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBzaGFyZWRDb25maWcuY29udGV4dCA9IG51bGw7XG4gIH1cbn1cbmZ1bmN0aW9uIGdldE5leHRFbGVtZW50KHRlbXBsYXRlKSB7XG4gIGxldCBub2RlLFxuICAgIGtleSxcbiAgICBoeWRyYXRpbmcgPSBpc0h5ZHJhdGluZygpO1xuICBpZiAoIWh5ZHJhdGluZyB8fCAhKG5vZGUgPSBzaGFyZWRDb25maWcucmVnaXN0cnkuZ2V0KGtleSA9IGdldEh5ZHJhdGlvbktleSgpKSkpIHtcbiAgICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgICBzaGFyZWRDb25maWcuZG9uZSA9IHRydWU7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEh5ZHJhdGlvbiBNaXNtYXRjaC4gVW5hYmxlIHRvIGZpbmQgRE9NIG5vZGVzIGZvciBoeWRyYXRpb24ga2V5OiAke2tleX1cXG4ke3RlbXBsYXRlID8gdGVtcGxhdGUoKS5vdXRlckhUTUwgOiBcIlwifWApO1xuICAgIH1cbiAgICByZXR1cm4gdGVtcGxhdGUoKTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmNvbXBsZXRlZCkgc2hhcmVkQ29uZmlnLmNvbXBsZXRlZC5hZGQobm9kZSk7XG4gIHNoYXJlZENvbmZpZy5yZWdpc3RyeS5kZWxldGUoa2V5KTtcbiAgcmV0dXJuIG5vZGU7XG59XG5mdW5jdGlvbiBnZXROZXh0TWF0Y2goZWwsIG5vZGVOYW1lKSB7XG4gIHdoaWxlIChlbCAmJiBlbC5sb2NhbE5hbWUgIT09IG5vZGVOYW1lKSBlbCA9IGVsLm5leHRTaWJsaW5nO1xuICByZXR1cm4gZWw7XG59XG5mdW5jdGlvbiBnZXROZXh0TWFya2VyKHN0YXJ0KSB7XG4gIGxldCBlbmQgPSBzdGFydCxcbiAgICBjb3VudCA9IDAsXG4gICAgY3VycmVudCA9IFtdO1xuICBpZiAoaXNIeWRyYXRpbmcoc3RhcnQpKSB7XG4gICAgd2hpbGUgKGVuZCkge1xuICAgICAgaWYgKGVuZC5ub2RlVHlwZSA9PT0gOCkge1xuICAgICAgICBjb25zdCB2ID0gZW5kLm5vZGVWYWx1ZTtcbiAgICAgICAgaWYgKHYgPT09IFwiJFwiKSBjb3VudCsrO2Vsc2UgaWYgKHYgPT09IFwiL1wiKSB7XG4gICAgICAgICAgaWYgKGNvdW50ID09PSAwKSByZXR1cm4gW2VuZCwgY3VycmVudF07XG4gICAgICAgICAgY291bnQtLTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY3VycmVudC5wdXNoKGVuZCk7XG4gICAgICBlbmQgPSBlbmQubmV4dFNpYmxpbmc7XG4gICAgfVxuICB9XG4gIHJldHVybiBbZW5kLCBjdXJyZW50XTtcbn1cbmZ1bmN0aW9uIHJ1bkh5ZHJhdGlvbkV2ZW50cygpIHtcbiAgaWYgKHNoYXJlZENvbmZpZy5ldmVudHMgJiYgIXNoYXJlZENvbmZpZy5ldmVudHMucXVldWVkKSB7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuICAgICAgY29uc3Qge1xuICAgICAgICBjb21wbGV0ZWQsXG4gICAgICAgIGV2ZW50c1xuICAgICAgfSA9IHNoYXJlZENvbmZpZztcbiAgICAgIGlmICghZXZlbnRzKSByZXR1cm47XG4gICAgICBldmVudHMucXVldWVkID0gZmFsc2U7XG4gICAgICB3aGlsZSAoZXZlbnRzLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBbZWwsIGVdID0gZXZlbnRzWzBdO1xuICAgICAgICBpZiAoIWNvbXBsZXRlZC5oYXMoZWwpKSByZXR1cm47XG4gICAgICAgIGV2ZW50cy5zaGlmdCgpO1xuICAgICAgICBldmVudEhhbmRsZXIoZSk7XG4gICAgICB9XG4gICAgICBpZiAoc2hhcmVkQ29uZmlnLmRvbmUpIHtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmV2ZW50cyA9IF8kSFkuZXZlbnRzID0gbnVsbDtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmNvbXBsZXRlZCA9IF8kSFkuY29tcGxldGVkID0gbnVsbDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBzaGFyZWRDb25maWcuZXZlbnRzLnF1ZXVlZCA9IHRydWU7XG4gIH1cbn1cbmZ1bmN0aW9uIGlzSHlkcmF0aW5nKG5vZGUpIHtcbiAgcmV0dXJuICEhc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgIXNoYXJlZENvbmZpZy5kb25lICYmICghbm9kZSB8fCBub2RlLmlzQ29ubmVjdGVkKTtcbn1cbmZ1bmN0aW9uIHRvUHJvcGVydHlOYW1lKG5hbWUpIHtcbiAgcmV0dXJuIG5hbWUudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC8tKFthLXpdKS9nLCAoXywgdykgPT4gdy50b1VwcGVyQ2FzZSgpKTtcbn1cbmZ1bmN0aW9uIHRvZ2dsZUNsYXNzS2V5KG5vZGUsIGtleSwgdmFsdWUpIHtcbiAgY29uc3QgY2xhc3NOYW1lcyA9IGtleS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgZm9yIChsZXQgaSA9IDAsIG5hbWVMZW4gPSBjbGFzc05hbWVzLmxlbmd0aDsgaSA8IG5hbWVMZW47IGkrKykgbm9kZS5jbGFzc0xpc3QudG9nZ2xlKGNsYXNzTmFtZXNbaV0sIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIGFzc2lnblByb3Aobm9kZSwgcHJvcCwgdmFsdWUsIHByZXYsIGlzU1ZHLCBza2lwUmVmLCBwcm9wcykge1xuICBsZXQgaXNDRSwgaXNQcm9wLCBpc0NoaWxkUHJvcCwgcHJvcEFsaWFzLCBmb3JjZVByb3A7XG4gIGlmIChwcm9wID09PSBcInN0eWxlXCIpIHJldHVybiBzdHlsZShub2RlLCB2YWx1ZSwgcHJldik7XG4gIGlmIChwcm9wID09PSBcImNsYXNzTGlzdFwiKSByZXR1cm4gY2xhc3NMaXN0KG5vZGUsIHZhbHVlLCBwcmV2KTtcbiAgaWYgKHZhbHVlID09PSBwcmV2KSByZXR1cm4gcHJldjtcbiAgaWYgKHByb3AgPT09IFwicmVmXCIpIHtcbiAgICBpZiAoIXNraXBSZWYpIHZhbHVlKG5vZGUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMykgPT09IFwib246XCIpIHtcbiAgICBjb25zdCBlID0gcHJvcC5zbGljZSgzKTtcbiAgICBwcmV2ICYmIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihlLCBwcmV2LCB0eXBlb2YgcHJldiAhPT0gXCJmdW5jdGlvblwiICYmIHByZXYpO1xuICAgIHZhbHVlICYmIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihlLCB2YWx1ZSwgdHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIgJiYgdmFsdWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMTApID09PSBcIm9uY2FwdHVyZTpcIikge1xuICAgIGNvbnN0IGUgPSBwcm9wLnNsaWNlKDEwKTtcbiAgICBwcmV2ICYmIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihlLCBwcmV2LCB0cnVlKTtcbiAgICB2YWx1ZSAmJiBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZSwgdmFsdWUsIHRydWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMikgPT09IFwib25cIikge1xuICAgIGNvbnN0IG5hbWUgPSBwcm9wLnNsaWNlKDIpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgZGVsZWdhdGUgPSBEZWxlZ2F0ZWRFdmVudHMuaGFzKG5hbWUpO1xuICAgIGlmICghZGVsZWdhdGUgJiYgcHJldikge1xuICAgICAgY29uc3QgaCA9IEFycmF5LmlzQXJyYXkocHJldikgPyBwcmV2WzBdIDogcHJldjtcbiAgICAgIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBoKTtcbiAgICB9XG4gICAgaWYgKGRlbGVnYXRlIHx8IHZhbHVlKSB7XG4gICAgICBhZGRFdmVudExpc3RlbmVyKG5vZGUsIG5hbWUsIHZhbHVlLCBkZWxlZ2F0ZSk7XG4gICAgICBkZWxlZ2F0ZSAmJiBkZWxlZ2F0ZUV2ZW50cyhbbmFtZV0pO1xuICAgIH1cbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDUpID09PSBcImF0dHI6XCIpIHtcbiAgICBzZXRBdHRyaWJ1dGUobm9kZSwgcHJvcC5zbGljZSg1KSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgNSkgPT09IFwiYm9vbDpcIikge1xuICAgIHNldEJvb2xBdHRyaWJ1dGUobm9kZSwgcHJvcC5zbGljZSg1KSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKChmb3JjZVByb3AgPSBwcm9wLnNsaWNlKDAsIDUpID09PSBcInByb3A6XCIpIHx8IChpc0NoaWxkUHJvcCA9IENoaWxkUHJvcGVydGllcy5oYXMocHJvcCkpIHx8ICFpc1NWRyAmJiAoKHByb3BBbGlhcyA9IGdldFByb3BBbGlhcyhwcm9wLCBub2RlLnRhZ05hbWUpKSB8fCAoaXNQcm9wID0gUHJvcGVydGllcy5oYXMocHJvcCkpKSB8fCAoaXNDRSA9IG5vZGUubm9kZU5hbWUuaW5jbHVkZXMoXCItXCIpIHx8IFwiaXNcIiBpbiBwcm9wcykpIHtcbiAgICBpZiAoZm9yY2VQcm9wKSB7XG4gICAgICBwcm9wID0gcHJvcC5zbGljZSg1KTtcbiAgICAgIGlzUHJvcCA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuIHZhbHVlO1xuICAgIGlmIChwcm9wID09PSBcImNsYXNzXCIgfHwgcHJvcCA9PT0gXCJjbGFzc05hbWVcIikgY2xhc3NOYW1lKG5vZGUsIHZhbHVlKTtlbHNlIGlmIChpc0NFICYmICFpc1Byb3AgJiYgIWlzQ2hpbGRQcm9wKSBub2RlW3RvUHJvcGVydHlOYW1lKHByb3ApXSA9IHZhbHVlO2Vsc2Ugbm9kZVtwcm9wQWxpYXMgfHwgcHJvcF0gPSB2YWx1ZTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBucyA9IGlzU1ZHICYmIHByb3AuaW5kZXhPZihcIjpcIikgPiAtMSAmJiBTVkdOYW1lc3BhY2VbcHJvcC5zcGxpdChcIjpcIilbMF1dO1xuICAgIGlmIChucykgc2V0QXR0cmlidXRlTlMobm9kZSwgbnMsIHByb3AsIHZhbHVlKTtlbHNlIHNldEF0dHJpYnV0ZShub2RlLCBBbGlhc2VzW3Byb3BdIHx8IHByb3AsIHZhbHVlKTtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5mdW5jdGlvbiBldmVudEhhbmRsZXIoZSkge1xuICBpZiAoc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ICYmIHNoYXJlZENvbmZpZy5ldmVudHMpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmV2ZW50cy5maW5kKChbZWwsIGV2XSkgPT4gZXYgPT09IGUpKSByZXR1cm47XG4gIH1cbiAgbGV0IG5vZGUgPSBlLnRhcmdldDtcbiAgY29uc3Qga2V5ID0gYCQkJHtlLnR5cGV9YDtcbiAgY29uc3Qgb3JpVGFyZ2V0ID0gZS50YXJnZXQ7XG4gIGNvbnN0IG9yaUN1cnJlbnRUYXJnZXQgPSBlLmN1cnJlbnRUYXJnZXQ7XG4gIGNvbnN0IHJldGFyZ2V0ID0gdmFsdWUgPT4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGUsIFwidGFyZ2V0XCIsIHtcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgdmFsdWVcbiAgfSk7XG4gIGNvbnN0IGhhbmRsZU5vZGUgPSAoKSA9PiB7XG4gICAgY29uc3QgaGFuZGxlciA9IG5vZGVba2V5XTtcbiAgICBpZiAoaGFuZGxlciAmJiAhbm9kZS5kaXNhYmxlZCkge1xuICAgICAgY29uc3QgZGF0YSA9IG5vZGVbYCR7a2V5fURhdGFgXTtcbiAgICAgIGRhdGEgIT09IHVuZGVmaW5lZCA/IGhhbmRsZXIuY2FsbChub2RlLCBkYXRhLCBlKSA6IGhhbmRsZXIuY2FsbChub2RlLCBlKTtcbiAgICAgIGlmIChlLmNhbmNlbEJ1YmJsZSkgcmV0dXJuO1xuICAgIH1cbiAgICBub2RlLmhvc3QgJiYgdHlwZW9mIG5vZGUuaG9zdCAhPT0gXCJzdHJpbmdcIiAmJiAhbm9kZS5ob3N0Ll8kaG9zdCAmJiBub2RlLmNvbnRhaW5zKGUudGFyZ2V0KSAmJiByZXRhcmdldChub2RlLmhvc3QpO1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xuICBjb25zdCB3YWxrVXBUcmVlID0gKCkgPT4ge1xuICAgIHdoaWxlIChoYW5kbGVOb2RlKCkgJiYgKG5vZGUgPSBub2RlLl8kaG9zdCB8fCBub2RlLnBhcmVudE5vZGUgfHwgbm9kZS5ob3N0KSk7XG4gIH07XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlLCBcImN1cnJlbnRUYXJnZXRcIiwge1xuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBnZXQoKSB7XG4gICAgICByZXR1cm4gbm9kZSB8fCBkb2N1bWVudDtcbiAgICB9XG4gIH0pO1xuICBpZiAoc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ICYmICFzaGFyZWRDb25maWcuZG9uZSkgc2hhcmVkQ29uZmlnLmRvbmUgPSBfJEhZLmRvbmUgPSB0cnVlO1xuICBpZiAoZS5jb21wb3NlZFBhdGgpIHtcbiAgICBjb25zdCBwYXRoID0gZS5jb21wb3NlZFBhdGgoKTtcbiAgICByZXRhcmdldChwYXRoWzBdKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdGgubGVuZ3RoIC0gMjsgaSsrKSB7XG4gICAgICBub2RlID0gcGF0aFtpXTtcbiAgICAgIGlmICghaGFuZGxlTm9kZSgpKSBicmVhaztcbiAgICAgIGlmIChub2RlLl8kaG9zdCkge1xuICAgICAgICBub2RlID0gbm9kZS5fJGhvc3Q7XG4gICAgICAgIHdhbGtVcFRyZWUoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAobm9kZS5wYXJlbnROb2RlID09PSBvcmlDdXJyZW50VGFyZ2V0KSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBlbHNlIHdhbGtVcFRyZWUoKTtcbiAgcmV0YXJnZXQob3JpVGFyZ2V0KTtcbn1cbmZ1bmN0aW9uIGluc2VydEV4cHJlc3Npb24ocGFyZW50LCB2YWx1ZSwgY3VycmVudCwgbWFya2VyLCB1bndyYXBBcnJheSkge1xuICBjb25zdCBoeWRyYXRpbmcgPSBpc0h5ZHJhdGluZyhwYXJlbnQpO1xuICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgIWN1cnJlbnQgJiYgKGN1cnJlbnQgPSBbLi4ucGFyZW50LmNoaWxkTm9kZXNdKTtcbiAgICBsZXQgY2xlYW5lZCA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY3VycmVudC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgbm9kZSA9IGN1cnJlbnRbaV07XG4gICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gOCAmJiBub2RlLmRhdGEuc2xpY2UoMCwgMikgPT09IFwiISRcIikgbm9kZS5yZW1vdmUoKTtlbHNlIGNsZWFuZWQucHVzaChub2RlKTtcbiAgICB9XG4gICAgY3VycmVudCA9IGNsZWFuZWQ7XG4gIH1cbiAgd2hpbGUgKHR5cGVvZiBjdXJyZW50ID09PSBcImZ1bmN0aW9uXCIpIGN1cnJlbnQgPSBjdXJyZW50KCk7XG4gIGlmICh2YWx1ZSA9PT0gY3VycmVudCkgcmV0dXJuIGN1cnJlbnQ7XG4gIGNvbnN0IHQgPSB0eXBlb2YgdmFsdWUsXG4gICAgbXVsdGkgPSBtYXJrZXIgIT09IHVuZGVmaW5lZDtcbiAgcGFyZW50ID0gbXVsdGkgJiYgY3VycmVudFswXSAmJiBjdXJyZW50WzBdLnBhcmVudE5vZGUgfHwgcGFyZW50O1xuICBpZiAodCA9PT0gXCJzdHJpbmdcIiB8fCB0ID09PSBcIm51bWJlclwiKSB7XG4gICAgaWYgKGh5ZHJhdGluZykgcmV0dXJuIGN1cnJlbnQ7XG4gICAgaWYgKHQgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIHZhbHVlID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gY3VycmVudCkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgfVxuICAgIGlmIChtdWx0aSkge1xuICAgICAgbGV0IG5vZGUgPSBjdXJyZW50WzBdO1xuICAgICAgaWYgKG5vZGUgJiYgbm9kZS5ub2RlVHlwZSA9PT0gMykge1xuICAgICAgICBub2RlLmRhdGEgIT09IHZhbHVlICYmIChub2RlLmRhdGEgPSB2YWx1ZSk7XG4gICAgICB9IGVsc2Ugbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZhbHVlKTtcbiAgICAgIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCBub2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGN1cnJlbnQgIT09IFwiXCIgJiYgdHlwZW9mIGN1cnJlbnQgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgY3VycmVudCA9IHBhcmVudC5maXJzdENoaWxkLmRhdGEgPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSBjdXJyZW50ID0gcGFyZW50LnRleHRDb250ZW50ID0gdmFsdWU7XG4gICAgfVxuICB9IGVsc2UgaWYgKHZhbHVlID09IG51bGwgfHwgdCA9PT0gXCJib29sZWFuXCIpIHtcbiAgICBpZiAoaHlkcmF0aW5nKSByZXR1cm4gY3VycmVudDtcbiAgICBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlcik7XG4gIH0gZWxzZSBpZiAodCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHtcbiAgICAgIGxldCB2ID0gdmFsdWUoKTtcbiAgICAgIHdoaWxlICh0eXBlb2YgdiA9PT0gXCJmdW5jdGlvblwiKSB2ID0gdigpO1xuICAgICAgY3VycmVudCA9IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCB2LCBjdXJyZW50LCBtYXJrZXIpO1xuICAgIH0pO1xuICAgIHJldHVybiAoKSA9PiBjdXJyZW50O1xuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgY29uc3QgYXJyYXkgPSBbXTtcbiAgICBjb25zdCBjdXJyZW50QXJyYXkgPSBjdXJyZW50ICYmIEFycmF5LmlzQXJyYXkoY3VycmVudCk7XG4gICAgaWYgKG5vcm1hbGl6ZUluY29taW5nQXJyYXkoYXJyYXksIHZhbHVlLCBjdXJyZW50LCB1bndyYXBBcnJheSkpIHtcbiAgICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiBjdXJyZW50ID0gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIGFycmF5LCBjdXJyZW50LCBtYXJrZXIsIHRydWUpKTtcbiAgICAgIHJldHVybiAoKSA9PiBjdXJyZW50O1xuICAgIH1cbiAgICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgICBpZiAoIWFycmF5Lmxlbmd0aCkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgICBpZiAobWFya2VyID09PSB1bmRlZmluZWQpIHJldHVybiBjdXJyZW50ID0gWy4uLnBhcmVudC5jaGlsZE5vZGVzXTtcbiAgICAgIGxldCBub2RlID0gYXJyYXlbMF07XG4gICAgICBpZiAobm9kZS5wYXJlbnROb2RlICE9PSBwYXJlbnQpIHJldHVybiBjdXJyZW50O1xuICAgICAgY29uc3Qgbm9kZXMgPSBbbm9kZV07XG4gICAgICB3aGlsZSAoKG5vZGUgPSBub2RlLm5leHRTaWJsaW5nKSAhPT0gbWFya2VyKSBub2Rlcy5wdXNoKG5vZGUpO1xuICAgICAgcmV0dXJuIGN1cnJlbnQgPSBub2RlcztcbiAgICB9XG4gICAgaWYgKGFycmF5Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIpO1xuICAgICAgaWYgKG11bHRpKSByZXR1cm4gY3VycmVudDtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnRBcnJheSkge1xuICAgICAgaWYgKGN1cnJlbnQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXksIG1hcmtlcik7XG4gICAgICB9IGVsc2UgcmVjb25jaWxlQXJyYXlzKHBhcmVudCwgY3VycmVudCwgYXJyYXkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdXJyZW50ICYmIGNsZWFuQ2hpbGRyZW4ocGFyZW50KTtcbiAgICAgIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXkpO1xuICAgIH1cbiAgICBjdXJyZW50ID0gYXJyYXk7XG4gIH0gZWxzZSBpZiAodmFsdWUubm9kZVR5cGUpIHtcbiAgICBpZiAoaHlkcmF0aW5nICYmIHZhbHVlLnBhcmVudE5vZGUpIHJldHVybiBjdXJyZW50ID0gbXVsdGkgPyBbdmFsdWVdIDogdmFsdWU7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoY3VycmVudCkpIHtcbiAgICAgIGlmIChtdWx0aSkgcmV0dXJuIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCB2YWx1ZSk7XG4gICAgICBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbnVsbCwgdmFsdWUpO1xuICAgIH0gZWxzZSBpZiAoY3VycmVudCA9PSBudWxsIHx8IGN1cnJlbnQgPT09IFwiXCIgfHwgIXBhcmVudC5maXJzdENoaWxkKSB7XG4gICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQodmFsdWUpO1xuICAgIH0gZWxzZSBwYXJlbnQucmVwbGFjZUNoaWxkKHZhbHVlLCBwYXJlbnQuZmlyc3RDaGlsZCk7XG4gICAgY3VycmVudCA9IHZhbHVlO1xuICB9IGVsc2UgY29uc29sZS53YXJuKGBVbnJlY29nbml6ZWQgdmFsdWUuIFNraXBwZWQgaW5zZXJ0aW5nYCwgdmFsdWUpO1xuICByZXR1cm4gY3VycmVudDtcbn1cbmZ1bmN0aW9uIG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgYXJyYXksIGN1cnJlbnQsIHVud3JhcCkge1xuICBsZXQgZHluYW1pYyA9IGZhbHNlO1xuICBmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBsZXQgaXRlbSA9IGFycmF5W2ldLFxuICAgICAgcHJldiA9IGN1cnJlbnQgJiYgY3VycmVudFtub3JtYWxpemVkLmxlbmd0aF0sXG4gICAgICB0O1xuICAgIGlmIChpdGVtID09IG51bGwgfHwgaXRlbSA9PT0gdHJ1ZSB8fCBpdGVtID09PSBmYWxzZSkgOyBlbHNlIGlmICgodCA9IHR5cGVvZiBpdGVtKSA9PT0gXCJvYmplY3RcIiAmJiBpdGVtLm5vZGVUeXBlKSB7XG4gICAgICBub3JtYWxpemVkLnB1c2goaXRlbSk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGl0ZW0pKSB7XG4gICAgICBkeW5hbWljID0gbm9ybWFsaXplSW5jb21pbmdBcnJheShub3JtYWxpemVkLCBpdGVtLCBwcmV2KSB8fCBkeW5hbWljO1xuICAgIH0gZWxzZSBpZiAodCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBpZiAodW53cmFwKSB7XG4gICAgICAgIHdoaWxlICh0eXBlb2YgaXRlbSA9PT0gXCJmdW5jdGlvblwiKSBpdGVtID0gaXRlbSgpO1xuICAgICAgICBkeW5hbWljID0gbm9ybWFsaXplSW5jb21pbmdBcnJheShub3JtYWxpemVkLCBBcnJheS5pc0FycmF5KGl0ZW0pID8gaXRlbSA6IFtpdGVtXSwgQXJyYXkuaXNBcnJheShwcmV2KSA/IHByZXYgOiBbcHJldl0pIHx8IGR5bmFtaWM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBub3JtYWxpemVkLnB1c2goaXRlbSk7XG4gICAgICAgIGR5bmFtaWMgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IFN0cmluZyhpdGVtKTtcbiAgICAgIGlmIChwcmV2ICYmIHByZXYubm9kZVR5cGUgPT09IDMgJiYgcHJldi5kYXRhID09PSB2YWx1ZSkgbm9ybWFsaXplZC5wdXNoKHByZXYpO2Vsc2Ugbm9ybWFsaXplZC5wdXNoKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZhbHVlKSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBkeW5hbWljO1xufVxuZnVuY3Rpb24gYXBwZW5kTm9kZXMocGFyZW50LCBhcnJheSwgbWFya2VyID0gbnVsbCkge1xuICBmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHBhcmVudC5pbnNlcnRCZWZvcmUoYXJyYXlbaV0sIG1hcmtlcik7XG59XG5mdW5jdGlvbiBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCByZXBsYWNlbWVudCkge1xuICBpZiAobWFya2VyID09PSB1bmRlZmluZWQpIHJldHVybiBwYXJlbnQudGV4dENvbnRlbnQgPSBcIlwiO1xuICBjb25zdCBub2RlID0gcmVwbGFjZW1lbnQgfHwgZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcIik7XG4gIGlmIChjdXJyZW50Lmxlbmd0aCkge1xuICAgIGxldCBpbnNlcnRlZCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSBjdXJyZW50Lmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBlbCA9IGN1cnJlbnRbaV07XG4gICAgICBpZiAobm9kZSAhPT0gZWwpIHtcbiAgICAgICAgY29uc3QgaXNQYXJlbnQgPSBlbC5wYXJlbnROb2RlID09PSBwYXJlbnQ7XG4gICAgICAgIGlmICghaW5zZXJ0ZWQgJiYgIWkpIGlzUGFyZW50ID8gcGFyZW50LnJlcGxhY2VDaGlsZChub2RlLCBlbCkgOiBwYXJlbnQuaW5zZXJ0QmVmb3JlKG5vZGUsIG1hcmtlcik7ZWxzZSBpc1BhcmVudCAmJiBlbC5yZW1vdmUoKTtcbiAgICAgIH0gZWxzZSBpbnNlcnRlZCA9IHRydWU7XG4gICAgfVxuICB9IGVsc2UgcGFyZW50Lmluc2VydEJlZm9yZShub2RlLCBtYXJrZXIpO1xuICByZXR1cm4gW25vZGVdO1xufVxuZnVuY3Rpb24gZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCByb290KSB7XG4gIGNvbnN0IHRlbXBsYXRlcyA9IGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChgKltkYXRhLWhrXWApO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHRlbXBsYXRlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IG5vZGUgPSB0ZW1wbGF0ZXNbaV07XG4gICAgY29uc3Qga2V5ID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCJkYXRhLWhrXCIpO1xuICAgIGlmICgoIXJvb3QgfHwga2V5LnN0YXJ0c1dpdGgocm9vdCkpICYmICFzaGFyZWRDb25maWcucmVnaXN0cnkuaGFzKGtleSkpIHNoYXJlZENvbmZpZy5yZWdpc3RyeS5zZXQoa2V5LCBub2RlKTtcbiAgfVxufVxuZnVuY3Rpb24gZ2V0SHlkcmF0aW9uS2V5KCkge1xuICByZXR1cm4gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKTtcbn1cbmZ1bmN0aW9uIE5vSHlkcmF0aW9uKHByb3BzKSB7XG4gIHJldHVybiBzaGFyZWRDb25maWcuY29udGV4dCA/IHVuZGVmaW5lZCA6IHByb3BzLmNoaWxkcmVuO1xufVxuZnVuY3Rpb24gSHlkcmF0aW9uKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcy5jaGlsZHJlbjtcbn1cbmNvbnN0IHZvaWRGbiA9ICgpID0+IHVuZGVmaW5lZDtcbmNvbnN0IFJlcXVlc3RDb250ZXh0ID0gU3ltYm9sKCk7XG5mdW5jdGlvbiBpbm5lckhUTUwocGFyZW50LCBjb250ZW50KSB7XG4gICFzaGFyZWRDb25maWcuY29udGV4dCAmJiAocGFyZW50LmlubmVySFRNTCA9IGNvbnRlbnQpO1xufVxuXG5mdW5jdGlvbiB0aHJvd0luQnJvd3NlcihmdW5jKSB7XG4gIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgJHtmdW5jLm5hbWV9IGlzIG5vdCBzdXBwb3J0ZWQgaW4gdGhlIGJyb3dzZXIsIHJldHVybmluZyB1bmRlZmluZWRgKTtcbiAgY29uc29sZS5lcnJvcihlcnIpO1xufVxuZnVuY3Rpb24gcmVuZGVyVG9TdHJpbmcoZm4sIG9wdGlvbnMpIHtcbiAgdGhyb3dJbkJyb3dzZXIocmVuZGVyVG9TdHJpbmcpO1xufVxuZnVuY3Rpb24gcmVuZGVyVG9TdHJpbmdBc3luYyhmbiwgb3B0aW9ucykge1xuICB0aHJvd0luQnJvd3NlcihyZW5kZXJUb1N0cmluZ0FzeW5jKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyZWFtKGZuLCBvcHRpb25zKSB7XG4gIHRocm93SW5Ccm93c2VyKHJlbmRlclRvU3RyZWFtKTtcbn1cbmZ1bmN0aW9uIHNzcih0ZW1wbGF0ZSwgLi4ubm9kZXMpIHt9XG5mdW5jdGlvbiBzc3JFbGVtZW50KG5hbWUsIHByb3BzLCBjaGlsZHJlbiwgbmVlZHNJZCkge31cbmZ1bmN0aW9uIHNzckNsYXNzTGlzdCh2YWx1ZSkge31cbmZ1bmN0aW9uIHNzclN0eWxlKHZhbHVlKSB7fVxuZnVuY3Rpb24gc3NyQXR0cmlidXRlKGtleSwgdmFsdWUpIHt9XG5mdW5jdGlvbiBzc3JIeWRyYXRpb25LZXkoKSB7fVxuZnVuY3Rpb24gcmVzb2x2ZVNTUk5vZGUobm9kZSkge31cbmZ1bmN0aW9uIGVzY2FwZShodG1sKSB7fVxuZnVuY3Rpb24gc3NyU3ByZWFkKHByb3BzLCBpc1NWRywgc2tpcENoaWxkcmVuKSB7fVxuXG5jb25zdCBpc1NlcnZlciA9IGZhbHNlO1xuY29uc3QgaXNEZXYgPSB0cnVlO1xuY29uc3QgU1ZHX05BTUVTUEFDRSA9IFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIjtcbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQodGFnTmFtZSwgaXNTVkcgPSBmYWxzZSkge1xuICByZXR1cm4gaXNTVkcgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoU1ZHX05BTUVTUEFDRSwgdGFnTmFtZSkgOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xufVxuY29uc3QgaHlkcmF0ZSA9ICguLi5hcmdzKSA9PiB7XG4gIGVuYWJsZUh5ZHJhdGlvbigpO1xuICByZXR1cm4gaHlkcmF0ZSQxKC4uLmFyZ3MpO1xufTtcbmZ1bmN0aW9uIFBvcnRhbChwcm9wcykge1xuICBjb25zdCB7XG4gICAgICB1c2VTaGFkb3dcbiAgICB9ID0gcHJvcHMsXG4gICAgbWFya2VyID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcIiksXG4gICAgbW91bnQgPSAoKSA9PiBwcm9wcy5tb3VudCB8fCBkb2N1bWVudC5ib2R5LFxuICAgIG93bmVyID0gZ2V0T3duZXIoKTtcbiAgbGV0IGNvbnRlbnQ7XG4gIGxldCBoeWRyYXRpbmcgPSAhIXNoYXJlZENvbmZpZy5jb250ZXh0O1xuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChoeWRyYXRpbmcpIGdldE93bmVyKCkudXNlciA9IGh5ZHJhdGluZyA9IGZhbHNlO1xuICAgIGNvbnRlbnQgfHwgKGNvbnRlbnQgPSBydW5XaXRoT3duZXIob3duZXIsICgpID0+IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMuY2hpbGRyZW4pKSk7XG4gICAgY29uc3QgZWwgPSBtb3VudCgpO1xuICAgIGlmIChlbCBpbnN0YW5jZW9mIEhUTUxIZWFkRWxlbWVudCkge1xuICAgICAgY29uc3QgW2NsZWFuLCBzZXRDbGVhbl0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICAgICAgY29uc3QgY2xlYW51cCA9ICgpID0+IHNldENsZWFuKHRydWUpO1xuICAgICAgY3JlYXRlUm9vdChkaXNwb3NlID0+IGluc2VydChlbCwgKCkgPT4gIWNsZWFuKCkgPyBjb250ZW50KCkgOiBkaXNwb3NlKCksIG51bGwpKTtcbiAgICAgIG9uQ2xlYW51cChjbGVhbnVwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgY29udGFpbmVyID0gY3JlYXRlRWxlbWVudChwcm9wcy5pc1NWRyA/IFwiZ1wiIDogXCJkaXZcIiwgcHJvcHMuaXNTVkcpLFxuICAgICAgICByZW5kZXJSb290ID0gdXNlU2hhZG93ICYmIGNvbnRhaW5lci5hdHRhY2hTaGFkb3cgPyBjb250YWluZXIuYXR0YWNoU2hhZG93KHtcbiAgICAgICAgICBtb2RlOiBcIm9wZW5cIlxuICAgICAgICB9KSA6IGNvbnRhaW5lcjtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb250YWluZXIsIFwiXyRob3N0XCIsIHtcbiAgICAgICAgZ2V0KCkge1xuICAgICAgICAgIHJldHVybiBtYXJrZXIucGFyZW50Tm9kZTtcbiAgICAgICAgfSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIGluc2VydChyZW5kZXJSb290LCBjb250ZW50KTtcbiAgICAgIGVsLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG4gICAgICBwcm9wcy5yZWYgJiYgcHJvcHMucmVmKGNvbnRhaW5lcik7XG4gICAgICBvbkNsZWFudXAoKCkgPT4gZWwucmVtb3ZlQ2hpbGQoY29udGFpbmVyKSk7XG4gICAgfVxuICB9LCB1bmRlZmluZWQsIHtcbiAgICByZW5kZXI6ICFoeWRyYXRpbmdcbiAgfSk7XG4gIHJldHVybiBtYXJrZXI7XG59XG5mdW5jdGlvbiBjcmVhdGVEeW5hbWljKGNvbXBvbmVudCwgcHJvcHMpIHtcbiAgY29uc3QgY2FjaGVkID0gY3JlYXRlTWVtbyhjb21wb25lbnQpO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgY29tcG9uZW50ID0gY2FjaGVkKCk7XG4gICAgc3dpdGNoICh0eXBlb2YgY29tcG9uZW50KSB7XG4gICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgICAgT2JqZWN0LmFzc2lnbihjb21wb25lbnQsIHtcbiAgICAgICAgICBbJERFVkNPTVBdOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdW50cmFjaygoKSA9PiBjb21wb25lbnQocHJvcHMpKTtcbiAgICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgICAgY29uc3QgaXNTdmcgPSBTVkdFbGVtZW50cy5oYXMoY29tcG9uZW50KTtcbiAgICAgICAgY29uc3QgZWwgPSBzaGFyZWRDb25maWcuY29udGV4dCA/IGdldE5leHRFbGVtZW50KCkgOiBjcmVhdGVFbGVtZW50KGNvbXBvbmVudCwgaXNTdmcpO1xuICAgICAgICBzcHJlYWQoZWwsIHByb3BzLCBpc1N2Zyk7XG4gICAgICAgIHJldHVybiBlbDtcbiAgICB9XG4gIH0pO1xufVxuZnVuY3Rpb24gRHluYW1pYyhwcm9wcykge1xuICBjb25zdCBbLCBvdGhlcnNdID0gc3BsaXRQcm9wcyhwcm9wcywgW1wiY29tcG9uZW50XCJdKTtcbiAgcmV0dXJuIGNyZWF0ZUR5bmFtaWMoKCkgPT4gcHJvcHMuY29tcG9uZW50LCBvdGhlcnMpO1xufVxuXG5leHBvcnQgeyBBbGlhc2VzLCB2b2lkRm4gYXMgQXNzZXRzLCBDaGlsZFByb3BlcnRpZXMsIERPTUVsZW1lbnRzLCBEZWxlZ2F0ZWRFdmVudHMsIER5bmFtaWMsIEh5ZHJhdGlvbiwgdm9pZEZuIGFzIEh5ZHJhdGlvblNjcmlwdCwgTm9IeWRyYXRpb24sIFBvcnRhbCwgUHJvcGVydGllcywgUmVxdWVzdENvbnRleHQsIFNWR0VsZW1lbnRzLCBTVkdOYW1lc3BhY2UsIGFkZEV2ZW50TGlzdGVuZXIsIGFzc2lnbiwgY2xhc3NMaXN0LCBjbGFzc05hbWUsIGNsZWFyRGVsZWdhdGVkRXZlbnRzLCBjcmVhdGVEeW5hbWljLCBkZWxlZ2F0ZUV2ZW50cywgZHluYW1pY1Byb3BlcnR5LCBlc2NhcGUsIHZvaWRGbiBhcyBnZW5lcmF0ZUh5ZHJhdGlvblNjcmlwdCwgdm9pZEZuIGFzIGdldEFzc2V0cywgZ2V0SHlkcmF0aW9uS2V5LCBnZXROZXh0RWxlbWVudCwgZ2V0TmV4dE1hcmtlciwgZ2V0TmV4dE1hdGNoLCBnZXRQcm9wQWxpYXMsIHZvaWRGbiBhcyBnZXRSZXF1ZXN0RXZlbnQsIGh5ZHJhdGUsIGlubmVySFRNTCwgaW5zZXJ0LCBpc0RldiwgaXNTZXJ2ZXIsIG1lbW8sIHJlbmRlciwgcmVuZGVyVG9TdHJlYW0sIHJlbmRlclRvU3RyaW5nLCByZW5kZXJUb1N0cmluZ0FzeW5jLCByZXNvbHZlU1NSTm9kZSwgcnVuSHlkcmF0aW9uRXZlbnRzLCBzZXRBdHRyaWJ1dGUsIHNldEF0dHJpYnV0ZU5TLCBzZXRCb29sQXR0cmlidXRlLCBzZXRQcm9wZXJ0eSwgc3ByZWFkLCBzc3IsIHNzckF0dHJpYnV0ZSwgc3NyQ2xhc3NMaXN0LCBzc3JFbGVtZW50LCBzc3JIeWRyYXRpb25LZXksIHNzclNwcmVhZCwgc3NyU3R5bGUsIHN0eWxlLCB0ZW1wbGF0ZSwgdXNlLCB2b2lkRm4gYXMgdXNlQXNzZXRzIH07XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCIvLyBHZW5lcmF0ZWQgdXNpbmcgYG5wbSBydW4gYnVpbGRgLiBEbyBub3QgZWRpdC5cblxudmFyIHJlZ2V4ID0gL15bYS16XSg/OltcXC4wLTlfYS16XFx4QjdcXHhDMC1cXHhENlxceEQ4LVxceEY2XFx4RjgtXFx1MDM3RFxcdTAzN0YtXFx1MUZGRlxcdTIwMENcXHUyMDBEXFx1MjAzRlxcdTIwNDBcXHUyMDcwLVxcdTIxOEZcXHUyQzAwLVxcdTJGRUZcXHUzMDAxLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRkRdfFtcXHVEODAwLVxcdURCN0ZdW1xcdURDMDAtXFx1REZGRl0pKi0oPzpbXFx4MkRcXC4wLTlfYS16XFx4QjdcXHhDMC1cXHhENlxceEQ4LVxceEY2XFx4RjgtXFx1MDM3RFxcdTAzN0YtXFx1MUZGRlxcdTIwMENcXHUyMDBEXFx1MjAzRlxcdTIwNDBcXHUyMDcwLVxcdTIxOEZcXHUyQzAwLVxcdTJGRUZcXHUzMDAxLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRkRdfFtcXHVEODAwLVxcdURCN0ZdW1xcdURDMDAtXFx1REZGRl0pKiQvO1xuXG52YXIgaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSA9IGZ1bmN0aW9uKHN0cmluZykge1xuXHRyZXR1cm4gcmVnZXgudGVzdChzdHJpbmcpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lO1xuIiwidmFyIF9fYXN5bmMgPSAoX190aGlzLCBfX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSA9PiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgdmFyIGZ1bGZpbGxlZCA9ICh2YWx1ZSkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZWplY3QoZSk7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgcmVqZWN0ZWQgPSAodmFsdWUpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHN0ZXAoZ2VuZXJhdG9yLnRocm93KHZhbHVlKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciBzdGVwID0gKHgpID0+IHguZG9uZSA/IHJlc29sdmUoeC52YWx1ZSkgOiBQcm9taXNlLnJlc29sdmUoeC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTtcbiAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkoX190aGlzLCBfX2FyZ3VtZW50cykpLm5leHQoKSk7XG4gIH0pO1xufTtcblxuLy8gc3JjL2luZGV4LnRzXG5pbXBvcnQgaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSBmcm9tIFwiaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWVcIjtcbmZ1bmN0aW9uIGNyZWF0ZUlzb2xhdGVkRWxlbWVudChvcHRpb25zKSB7XG4gIHJldHVybiBfX2FzeW5jKHRoaXMsIG51bGwsIGZ1bmN0aW9uKiAoKSB7XG4gICAgY29uc3QgeyBuYW1lLCBtb2RlID0gXCJjbG9zZWRcIiwgY3NzLCBpc29sYXRlRXZlbnRzID0gZmFsc2UgfSA9IG9wdGlvbnM7XG4gICAgaWYgKCFpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lKG5hbWUpKSB7XG4gICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgYFwiJHtuYW1lfVwiIGlzIG5vdCBhIHZhbGlkIGN1c3RvbSBlbGVtZW50IG5hbWUuIEl0IG11c3QgYmUgdHdvIHdvcmRzIGFuZCBrZWJhYi1jYXNlLCB3aXRoIGEgZmV3IGV4Y2VwdGlvbnMuIFNlZSBzcGVjIGZvciBtb3JlIGRldGFpbHM6IGh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL2N1c3RvbS1lbGVtZW50cy5odG1sI3ZhbGlkLWN1c3RvbS1lbGVtZW50LW5hbWVgXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCBwYXJlbnRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChuYW1lKTtcbiAgICBjb25zdCBzaGFkb3cgPSBwYXJlbnRFbGVtZW50LmF0dGFjaFNoYWRvdyh7IG1vZGUgfSk7XG4gICAgY29uc3QgaXNvbGF0ZWRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImh0bWxcIik7XG4gICAgY29uc3QgYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJib2R5XCIpO1xuICAgIGNvbnN0IGhlYWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaGVhZFwiKTtcbiAgICBpZiAoY3NzKSB7XG4gICAgICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcbiAgICAgIGlmIChcInVybFwiIGluIGNzcykge1xuICAgICAgICBzdHlsZS50ZXh0Q29udGVudCA9IHlpZWxkIGZldGNoKGNzcy51cmwpLnRoZW4oKHJlcykgPT4gcmVzLnRleHQoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHlsZS50ZXh0Q29udGVudCA9IGNzcy50ZXh0Q29udGVudDtcbiAgICAgIH1cbiAgICAgIGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICAgIH1cbiAgICBpc29sYXRlZEVsZW1lbnQuYXBwZW5kQ2hpbGQoaGVhZCk7XG4gICAgaXNvbGF0ZWRFbGVtZW50LmFwcGVuZENoaWxkKGJvZHkpO1xuICAgIHNoYWRvdy5hcHBlbmRDaGlsZChpc29sYXRlZEVsZW1lbnQpO1xuICAgIGlmIChpc29sYXRlRXZlbnRzKSB7XG4gICAgICBjb25zdCBldmVudFR5cGVzID0gQXJyYXkuaXNBcnJheShpc29sYXRlRXZlbnRzKSA/IGlzb2xhdGVFdmVudHMgOiBbXCJrZXlkb3duXCIsIFwia2V5dXBcIiwgXCJrZXlwcmVzc1wiXTtcbiAgICAgIGV2ZW50VHlwZXMuZm9yRWFjaCgoZXZlbnRUeXBlKSA9PiB7XG4gICAgICAgIGJvZHkuYWRkRXZlbnRMaXN0ZW5lcihldmVudFR5cGUsIChlKSA9PiBlLnN0b3BQcm9wYWdhdGlvbigpKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgcGFyZW50RWxlbWVudCxcbiAgICAgIHNoYWRvdyxcbiAgICAgIGlzb2xhdGVkRWxlbWVudDogYm9keVxuICAgIH07XG4gIH0pO1xufVxuZXhwb3J0IHtcbiAgY3JlYXRlSXNvbGF0ZWRFbGVtZW50XG59O1xuIiwiY29uc3QgbnVsbEtleSA9IFN5bWJvbCgnbnVsbCcpOyAvLyBgb2JqZWN0SGFzaGVzYCBrZXkgZm9yIG51bGxcblxubGV0IGtleUNvdW50ZXIgPSAwO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNYW55S2V5c01hcCBleHRlbmRzIE1hcCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9vYmplY3RIYXNoZXMgPSBuZXcgV2Vha01hcCgpO1xuXHRcdHRoaXMuX3N5bWJvbEhhc2hlcyA9IG5ldyBNYXAoKTsgLy8gaHR0cHM6Ly9naXRodWIuY29tL3RjMzkvZWNtYTI2Mi9pc3N1ZXMvMTE5NFxuXHRcdHRoaXMuX3B1YmxpY0tleXMgPSBuZXcgTWFwKCk7XG5cblx0XHRjb25zdCBbcGFpcnNdID0gYXJndW1lbnRzOyAvLyBNYXAgY29tcGF0XG5cdFx0aWYgKHBhaXJzID09PSBudWxsIHx8IHBhaXJzID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHBhaXJzW1N5bWJvbC5pdGVyYXRvcl0gIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IodHlwZW9mIHBhaXJzICsgJyBpcyBub3QgaXRlcmFibGUgKGNhbm5vdCByZWFkIHByb3BlcnR5IFN5bWJvbChTeW1ib2wuaXRlcmF0b3IpKScpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgW2tleXMsIHZhbHVlXSBvZiBwYWlycykge1xuXHRcdFx0dGhpcy5zZXQoa2V5cywgdmFsdWUpO1xuXHRcdH1cblx0fVxuXG5cdF9nZXRQdWJsaWNLZXlzKGtleXMsIGNyZWF0ZSA9IGZhbHNlKSB7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGtleXMpKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUga2V5cyBwYXJhbWV0ZXIgbXVzdCBiZSBhbiBhcnJheScpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByaXZhdGVLZXkgPSB0aGlzLl9nZXRQcml2YXRlS2V5KGtleXMsIGNyZWF0ZSk7XG5cblx0XHRsZXQgcHVibGljS2V5O1xuXHRcdGlmIChwcml2YXRlS2V5ICYmIHRoaXMuX3B1YmxpY0tleXMuaGFzKHByaXZhdGVLZXkpKSB7XG5cdFx0XHRwdWJsaWNLZXkgPSB0aGlzLl9wdWJsaWNLZXlzLmdldChwcml2YXRlS2V5KTtcblx0XHR9IGVsc2UgaWYgKGNyZWF0ZSkge1xuXHRcdFx0cHVibGljS2V5ID0gWy4uLmtleXNdOyAvLyBSZWdlbmVyYXRlIGtleXMgYXJyYXkgdG8gYXZvaWQgZXh0ZXJuYWwgaW50ZXJhY3Rpb25cblx0XHRcdHRoaXMuX3B1YmxpY0tleXMuc2V0KHByaXZhdGVLZXksIHB1YmxpY0tleSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtwcml2YXRlS2V5LCBwdWJsaWNLZXl9O1xuXHR9XG5cblx0X2dldFByaXZhdGVLZXkoa2V5cywgY3JlYXRlID0gZmFsc2UpIHtcblx0XHRjb25zdCBwcml2YXRlS2V5cyA9IFtdO1xuXHRcdGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG5cdFx0XHRpZiAoa2V5ID09PSBudWxsKSB7XG5cdFx0XHRcdGtleSA9IG51bGxLZXk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGhhc2hlcyA9IHR5cGVvZiBrZXkgPT09ICdvYmplY3QnIHx8IHR5cGVvZiBrZXkgPT09ICdmdW5jdGlvbicgPyAnX29iamVjdEhhc2hlcycgOiAodHlwZW9mIGtleSA9PT0gJ3N5bWJvbCcgPyAnX3N5bWJvbEhhc2hlcycgOiBmYWxzZSk7XG5cblx0XHRcdGlmICghaGFzaGVzKSB7XG5cdFx0XHRcdHByaXZhdGVLZXlzLnB1c2goa2V5KTtcblx0XHRcdH0gZWxzZSBpZiAodGhpc1toYXNoZXNdLmhhcyhrZXkpKSB7XG5cdFx0XHRcdHByaXZhdGVLZXlzLnB1c2godGhpc1toYXNoZXNdLmdldChrZXkpKTtcblx0XHRcdH0gZWxzZSBpZiAoY3JlYXRlKSB7XG5cdFx0XHRcdGNvbnN0IHByaXZhdGVLZXkgPSBgQEBta20tcmVmLSR7a2V5Q291bnRlcisrfUBAYDtcblx0XHRcdFx0dGhpc1toYXNoZXNdLnNldChrZXksIHByaXZhdGVLZXkpO1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKHByaXZhdGVLZXkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeShwcml2YXRlS2V5cyk7XG5cdH1cblxuXHRzZXQoa2V5cywgdmFsdWUpIHtcblx0XHRjb25zdCB7cHVibGljS2V5fSA9IHRoaXMuX2dldFB1YmxpY0tleXMoa2V5cywgdHJ1ZSk7XG5cdFx0cmV0dXJuIHN1cGVyLnNldChwdWJsaWNLZXksIHZhbHVlKTtcblx0fVxuXG5cdGdldChrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBzdXBlci5nZXQocHVibGljS2V5KTtcblx0fVxuXG5cdGhhcyhrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBzdXBlci5oYXMocHVibGljS2V5KTtcblx0fVxuXG5cdGRlbGV0ZShrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleSwgcHJpdmF0ZUtleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBCb29sZWFuKHB1YmxpY0tleSAmJiBzdXBlci5kZWxldGUocHVibGljS2V5KSAmJiB0aGlzLl9wdWJsaWNLZXlzLmRlbGV0ZShwcml2YXRlS2V5KSk7XG5cdH1cblxuXHRjbGVhcigpIHtcblx0XHRzdXBlci5jbGVhcigpO1xuXHRcdHRoaXMuX3N5bWJvbEhhc2hlcy5jbGVhcigpO1xuXHRcdHRoaXMuX3B1YmxpY0tleXMuY2xlYXIoKTtcblx0fVxuXG5cdGdldCBbU3ltYm9sLnRvU3RyaW5nVGFnXSgpIHtcblx0XHRyZXR1cm4gJ01hbnlLZXlzTWFwJztcblx0fVxuXG5cdGdldCBzaXplKCkge1xuXHRcdHJldHVybiBzdXBlci5zaXplO1xuXHR9XG59XG4iLCJmdW5jdGlvbiBpc1BsYWluT2JqZWN0KHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgcHJvdG90eXBlID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKTtcbiAgaWYgKHByb3RvdHlwZSAhPT0gbnVsbCAmJiBwcm90b3R5cGUgIT09IE9iamVjdC5wcm90b3R5cGUgJiYgT2JqZWN0LmdldFByb3RvdHlwZU9mKHByb3RvdHlwZSkgIT09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKFN5bWJvbC5pdGVyYXRvciBpbiB2YWx1ZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoU3ltYm9sLnRvU3RyaW5nVGFnIGluIHZhbHVlKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT09IFwiW29iamVjdCBNb2R1bGVdXCI7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIF9kZWZ1KGJhc2VPYmplY3QsIGRlZmF1bHRzLCBuYW1lc3BhY2UgPSBcIi5cIiwgbWVyZ2VyKSB7XG4gIGlmICghaXNQbGFpbk9iamVjdChkZWZhdWx0cykpIHtcbiAgICByZXR1cm4gX2RlZnUoYmFzZU9iamVjdCwge30sIG5hbWVzcGFjZSwgbWVyZ2VyKTtcbiAgfVxuICBjb25zdCBvYmplY3QgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0cyk7XG4gIGZvciAoY29uc3Qga2V5IGluIGJhc2VPYmplY3QpIHtcbiAgICBpZiAoa2V5ID09PSBcIl9fcHJvdG9fX1wiIHx8IGtleSA9PT0gXCJjb25zdHJ1Y3RvclwiKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSBiYXNlT2JqZWN0W2tleV07XG4gICAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB2b2lkIDApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAobWVyZ2VyICYmIG1lcmdlcihvYmplY3QsIGtleSwgdmFsdWUsIG5hbWVzcGFjZSkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgQXJyYXkuaXNBcnJheShvYmplY3Rba2V5XSkpIHtcbiAgICAgIG9iamVjdFtrZXldID0gWy4uLnZhbHVlLCAuLi5vYmplY3Rba2V5XV07XG4gICAgfSBlbHNlIGlmIChpc1BsYWluT2JqZWN0KHZhbHVlKSAmJiBpc1BsYWluT2JqZWN0KG9iamVjdFtrZXldKSkge1xuICAgICAgb2JqZWN0W2tleV0gPSBfZGVmdShcbiAgICAgICAgdmFsdWUsXG4gICAgICAgIG9iamVjdFtrZXldLFxuICAgICAgICAobmFtZXNwYWNlID8gYCR7bmFtZXNwYWNlfS5gIDogXCJcIikgKyBrZXkudG9TdHJpbmcoKSxcbiAgICAgICAgbWVyZ2VyXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBvYmplY3Rba2V5XSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gb2JqZWN0O1xufVxuZnVuY3Rpb24gY3JlYXRlRGVmdShtZXJnZXIpIHtcbiAgcmV0dXJuICguLi5hcmd1bWVudHNfKSA9PiAoXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHVuaWNvcm4vbm8tYXJyYXktcmVkdWNlXG4gICAgYXJndW1lbnRzXy5yZWR1Y2UoKHAsIGMpID0+IF9kZWZ1KHAsIGMsIFwiXCIsIG1lcmdlciksIHt9KVxuICApO1xufVxuY29uc3QgZGVmdSA9IGNyZWF0ZURlZnUoKTtcbmNvbnN0IGRlZnVGbiA9IGNyZWF0ZURlZnUoKG9iamVjdCwga2V5LCBjdXJyZW50VmFsdWUpID0+IHtcbiAgaWYgKG9iamVjdFtrZXldICE9PSB2b2lkIDAgJiYgdHlwZW9mIGN1cnJlbnRWYWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgb2JqZWN0W2tleV0gPSBjdXJyZW50VmFsdWUob2JqZWN0W2tleV0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59KTtcbmNvbnN0IGRlZnVBcnJheUZuID0gY3JlYXRlRGVmdSgob2JqZWN0LCBrZXksIGN1cnJlbnRWYWx1ZSkgPT4ge1xuICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3Rba2V5XSkgJiYgdHlwZW9mIGN1cnJlbnRWYWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgb2JqZWN0W2tleV0gPSBjdXJyZW50VmFsdWUob2JqZWN0W2tleV0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59KTtcblxuZXhwb3J0IHsgY3JlYXRlRGVmdSwgZGVmdSBhcyBkZWZhdWx0LCBkZWZ1LCBkZWZ1QXJyYXlGbiwgZGVmdUZuIH07XG4iLCJjb25zdCBpc0V4aXN0ID0gKGVsZW1lbnQpID0+IHtcbiAgcmV0dXJuIGVsZW1lbnQgIT09IG51bGwgPyB7IGlzRGV0ZWN0ZWQ6IHRydWUsIHJlc3VsdDogZWxlbWVudCB9IDogeyBpc0RldGVjdGVkOiBmYWxzZSB9O1xufTtcbmNvbnN0IGlzTm90RXhpc3QgPSAoZWxlbWVudCkgPT4ge1xuICByZXR1cm4gZWxlbWVudCA9PT0gbnVsbCA/IHsgaXNEZXRlY3RlZDogdHJ1ZSwgcmVzdWx0OiBudWxsIH0gOiB7IGlzRGV0ZWN0ZWQ6IGZhbHNlIH07XG59O1xuXG5leHBvcnQgeyBpc0V4aXN0LCBpc05vdEV4aXN0IH07XG4iLCJpbXBvcnQgTWFueUtleXNNYXAgZnJvbSAnbWFueS1rZXlzLW1hcCc7XG5pbXBvcnQgeyBkZWZ1IH0gZnJvbSAnZGVmdSc7XG5pbXBvcnQgeyBpc0V4aXN0IH0gZnJvbSAnLi9kZXRlY3RvcnMubWpzJztcblxuY29uc3QgZ2V0RGVmYXVsdE9wdGlvbnMgPSAoKSA9PiAoe1xuICB0YXJnZXQ6IGdsb2JhbFRoaXMuZG9jdW1lbnQsXG4gIHVuaWZ5UHJvY2VzczogdHJ1ZSxcbiAgZGV0ZWN0b3I6IGlzRXhpc3QsXG4gIG9ic2VydmVDb25maWdzOiB7XG4gICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgIHN1YnRyZWU6IHRydWUsXG4gICAgYXR0cmlidXRlczogdHJ1ZVxuICB9LFxuICBzaWduYWw6IHZvaWQgMCxcbiAgY3VzdG9tTWF0Y2hlcjogdm9pZCAwXG59KTtcbmNvbnN0IG1lcmdlT3B0aW9ucyA9ICh1c2VyU2lkZU9wdGlvbnMsIGRlZmF1bHRPcHRpb25zKSA9PiB7XG4gIHJldHVybiBkZWZ1KHVzZXJTaWRlT3B0aW9ucywgZGVmYXVsdE9wdGlvbnMpO1xufTtcblxuY29uc3QgdW5pZnlDYWNoZSA9IG5ldyBNYW55S2V5c01hcCgpO1xuZnVuY3Rpb24gY3JlYXRlV2FpdEVsZW1lbnQoaW5zdGFuY2VPcHRpb25zKSB7XG4gIGNvbnN0IHsgZGVmYXVsdE9wdGlvbnMgfSA9IGluc3RhbmNlT3B0aW9ucztcbiAgcmV0dXJuIChzZWxlY3Rvciwgb3B0aW9ucykgPT4ge1xuICAgIGNvbnN0IHtcbiAgICAgIHRhcmdldCxcbiAgICAgIHVuaWZ5UHJvY2VzcyxcbiAgICAgIG9ic2VydmVDb25maWdzLFxuICAgICAgZGV0ZWN0b3IsXG4gICAgICBzaWduYWwsXG4gICAgICBjdXN0b21NYXRjaGVyXG4gICAgfSA9IG1lcmdlT3B0aW9ucyhvcHRpb25zLCBkZWZhdWx0T3B0aW9ucyk7XG4gICAgY29uc3QgdW5pZnlQcm9taXNlS2V5ID0gW1xuICAgICAgc2VsZWN0b3IsXG4gICAgICB0YXJnZXQsXG4gICAgICB1bmlmeVByb2Nlc3MsXG4gICAgICBvYnNlcnZlQ29uZmlncyxcbiAgICAgIGRldGVjdG9yLFxuICAgICAgc2lnbmFsLFxuICAgICAgY3VzdG9tTWF0Y2hlclxuICAgIF07XG4gICAgY29uc3QgY2FjaGVkUHJvbWlzZSA9IHVuaWZ5Q2FjaGUuZ2V0KHVuaWZ5UHJvbWlzZUtleSk7XG4gICAgaWYgKHVuaWZ5UHJvY2VzcyAmJiBjYWNoZWRQcm9taXNlKSB7XG4gICAgICByZXR1cm4gY2FjaGVkUHJvbWlzZTtcbiAgICB9XG4gICAgY29uc3QgZGV0ZWN0UHJvbWlzZSA9IG5ldyBQcm9taXNlKFxuICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0FzeW5jUHJvbWlzZUV4ZWN1dG9yOiBhdm9pZCBuZXN0aW5nIHByb21pc2VcbiAgICAgIGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgIHJldHVybiByZWplY3Qoc2lnbmFsLnJlYXNvbik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihcbiAgICAgICAgICBhc3luYyAobXV0YXRpb25zKSA9PiB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IF8gb2YgbXV0YXRpb25zKSB7XG4gICAgICAgICAgICAgIGlmIChzaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29uc3QgZGV0ZWN0UmVzdWx0MiA9IGF3YWl0IGRldGVjdEVsZW1lbnQoe1xuICAgICAgICAgICAgICAgIHNlbGVjdG9yLFxuICAgICAgICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICAgICAgICBkZXRlY3RvcixcbiAgICAgICAgICAgICAgICBjdXN0b21NYXRjaGVyXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBpZiAoZGV0ZWN0UmVzdWx0Mi5pc0RldGVjdGVkKSB7XG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZGV0ZWN0UmVzdWx0Mi5yZXN1bHQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgICBzaWduYWw/LmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgXCJhYm9ydFwiLFxuICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHJldHVybiByZWplY3Qoc2lnbmFsLnJlYXNvbik7XG4gICAgICAgICAgfSxcbiAgICAgICAgICB7IG9uY2U6IHRydWUgfVxuICAgICAgICApO1xuICAgICAgICBjb25zdCBkZXRlY3RSZXN1bHQgPSBhd2FpdCBkZXRlY3RFbGVtZW50KHtcbiAgICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgZGV0ZWN0b3IsXG4gICAgICAgICAgY3VzdG9tTWF0Y2hlclxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGRldGVjdFJlc3VsdC5pc0RldGVjdGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoZGV0ZWN0UmVzdWx0LnJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZSh0YXJnZXQsIG9ic2VydmVDb25maWdzKTtcbiAgICAgIH1cbiAgICApLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgdW5pZnlDYWNoZS5kZWxldGUodW5pZnlQcm9taXNlS2V5KTtcbiAgICB9KTtcbiAgICB1bmlmeUNhY2hlLnNldCh1bmlmeVByb21pc2VLZXksIGRldGVjdFByb21pc2UpO1xuICAgIHJldHVybiBkZXRlY3RQcm9taXNlO1xuICB9O1xufVxuYXN5bmMgZnVuY3Rpb24gZGV0ZWN0RWxlbWVudCh7XG4gIHRhcmdldCxcbiAgc2VsZWN0b3IsXG4gIGRldGVjdG9yLFxuICBjdXN0b21NYXRjaGVyXG59KSB7XG4gIGNvbnN0IGVsZW1lbnQgPSBjdXN0b21NYXRjaGVyID8gY3VzdG9tTWF0Y2hlcihzZWxlY3RvcikgOiB0YXJnZXQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gIHJldHVybiBhd2FpdCBkZXRlY3RvcihlbGVtZW50KTtcbn1cbmNvbnN0IHdhaXRFbGVtZW50ID0gY3JlYXRlV2FpdEVsZW1lbnQoe1xuICBkZWZhdWx0T3B0aW9uczogZ2V0RGVmYXVsdE9wdGlvbnMoKVxufSk7XG5cbmV4cG9ydCB7IGNyZWF0ZVdhaXRFbGVtZW50LCBnZXREZWZhdWx0T3B0aW9ucywgd2FpdEVsZW1lbnQgfTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyB3YWl0RWxlbWVudCB9IGZyb20gXCJAMW5hdHN1L3dhaXQtZWxlbWVudFwiO1xuaW1wb3J0IHtcbiAgaXNFeGlzdCBhcyBtb3VudERldGVjdG9yLFxuICBpc05vdEV4aXN0IGFzIHJlbW92ZURldGVjdG9yXG59IGZyb20gXCJAMW5hdHN1L3dhaXQtZWxlbWVudC9kZXRlY3RvcnNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi8uLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gYXBwbHlQb3NpdGlvbihyb290LCBwb3NpdGlvbmVkRWxlbWVudCwgb3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5wb3NpdGlvbiA9PT0gXCJpbmxpbmVcIikgcmV0dXJuO1xuICBpZiAob3B0aW9ucy56SW5kZXggIT0gbnVsbCkgcm9vdC5zdHlsZS56SW5kZXggPSBTdHJpbmcob3B0aW9ucy56SW5kZXgpO1xuICByb290LnN0eWxlLm92ZXJmbG93ID0gXCJ2aXNpYmxlXCI7XG4gIHJvb3Quc3R5bGUucG9zaXRpb24gPSBcInJlbGF0aXZlXCI7XG4gIHJvb3Quc3R5bGUud2lkdGggPSBcIjBcIjtcbiAgcm9vdC5zdHlsZS5oZWlnaHQgPSBcIjBcIjtcbiAgcm9vdC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICBpZiAocG9zaXRpb25lZEVsZW1lbnQpIHtcbiAgICBpZiAob3B0aW9ucy5wb3NpdGlvbiA9PT0gXCJvdmVybGF5XCIpIHtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xuICAgICAgaWYgKG9wdGlvbnMuYWxpZ25tZW50Py5zdGFydHNXaXRoKFwiYm90dG9tLVwiKSlcbiAgICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUuYm90dG9tID0gXCIwXCI7XG4gICAgICBlbHNlIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiO1xuICAgICAgaWYgKG9wdGlvbnMuYWxpZ25tZW50Py5lbmRzV2l0aChcIi1yaWdodFwiKSlcbiAgICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIjtcbiAgICAgIGVsc2UgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUubGVmdCA9IFwiMFwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUuYm90dG9tID0gXCIwXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5sZWZ0ID0gXCIwXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMFwiO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIGdldEFuY2hvcihvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zLmFuY2hvciA9PSBudWxsKSByZXR1cm4gZG9jdW1lbnQuYm9keTtcbiAgbGV0IHJlc29sdmVkID0gdHlwZW9mIG9wdGlvbnMuYW5jaG9yID09PSBcImZ1bmN0aW9uXCIgPyBvcHRpb25zLmFuY2hvcigpIDogb3B0aW9ucy5hbmNob3I7XG4gIGlmICh0eXBlb2YgcmVzb2x2ZWQgPT09IFwic3RyaW5nXCIpIHtcbiAgICBpZiAocmVzb2x2ZWQuc3RhcnRzV2l0aChcIi9cIikpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGRvY3VtZW50LmV2YWx1YXRlKFxuICAgICAgICByZXNvbHZlZCxcbiAgICAgICAgZG9jdW1lbnQsXG4gICAgICAgIG51bGwsXG4gICAgICAgIFhQYXRoUmVzdWx0LkZJUlNUX09SREVSRURfTk9ERV9UWVBFLFxuICAgICAgICBudWxsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlc3VsdC5zaW5nbGVOb2RlVmFsdWUgPz8gdm9pZCAwO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihyZXNvbHZlZCkgPz8gdm9pZCAwO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzb2x2ZWQgPz8gdm9pZCAwO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG1vdW50VWkocm9vdCwgb3B0aW9ucykge1xuICBjb25zdCBhbmNob3IgPSBnZXRBbmNob3Iob3B0aW9ucyk7XG4gIGlmIChhbmNob3IgPT0gbnVsbClcbiAgICB0aHJvdyBFcnJvcihcbiAgICAgIFwiRmFpbGVkIHRvIG1vdW50IGNvbnRlbnQgc2NyaXB0IFVJOiBjb3VsZCBub3QgZmluZCBhbmNob3IgZWxlbWVudFwiXG4gICAgKTtcbiAgc3dpdGNoIChvcHRpb25zLmFwcGVuZCkge1xuICAgIGNhc2Ugdm9pZCAwOlxuICAgIGNhc2UgXCJsYXN0XCI6XG4gICAgICBhbmNob3IuYXBwZW5kKHJvb3QpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImZpcnN0XCI6XG4gICAgICBhbmNob3IucHJlcGVuZChyb290KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJyZXBsYWNlXCI6XG4gICAgICBhbmNob3IucmVwbGFjZVdpdGgocm9vdCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiYWZ0ZXJcIjpcbiAgICAgIGFuY2hvci5wYXJlbnRFbGVtZW50Py5pbnNlcnRCZWZvcmUocm9vdCwgYW5jaG9yLm5leHRFbGVtZW50U2libGluZyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiYmVmb3JlXCI6XG4gICAgICBhbmNob3IucGFyZW50RWxlbWVudD8uaW5zZXJ0QmVmb3JlKHJvb3QsIGFuY2hvcik7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgb3B0aW9ucy5hcHBlbmQoYW5jaG9yLCByb290KTtcbiAgICAgIGJyZWFrO1xuICB9XG59XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTW91bnRGdW5jdGlvbnMoYmFzZUZ1bmN0aW9ucywgb3B0aW9ucykge1xuICBsZXQgYXV0b01vdW50SW5zdGFuY2UgPSB2b2lkIDA7XG4gIGNvbnN0IHN0b3BBdXRvTW91bnQgPSAoKSA9PiB7XG4gICAgYXV0b01vdW50SW5zdGFuY2U/LnN0b3BBdXRvTW91bnQoKTtcbiAgICBhdXRvTW91bnRJbnN0YW5jZSA9IHZvaWQgMDtcbiAgfTtcbiAgY29uc3QgbW91bnQgPSAoKSA9PiB7XG4gICAgYmFzZUZ1bmN0aW9ucy5tb3VudCgpO1xuICB9O1xuICBjb25zdCB1bm1vdW50ID0gYmFzZUZ1bmN0aW9ucy5yZW1vdmU7XG4gIGNvbnN0IHJlbW92ZSA9ICgpID0+IHtcbiAgICBzdG9wQXV0b01vdW50KCk7XG4gICAgYmFzZUZ1bmN0aW9ucy5yZW1vdmUoKTtcbiAgfTtcbiAgY29uc3QgYXV0b01vdW50ID0gKGF1dG9Nb3VudE9wdGlvbnMpID0+IHtcbiAgICBpZiAoYXV0b01vdW50SW5zdGFuY2UpIHtcbiAgICAgIGxvZ2dlci53YXJuKFwiYXV0b01vdW50IGlzIGFscmVhZHkgc2V0LlwiKTtcbiAgICB9XG4gICAgYXV0b01vdW50SW5zdGFuY2UgPSBhdXRvTW91bnRVaShcbiAgICAgIHsgbW91bnQsIHVubW91bnQsIHN0b3BBdXRvTW91bnQgfSxcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgLi4uYXV0b01vdW50T3B0aW9uc1xuICAgICAgfVxuICAgICk7XG4gIH07XG4gIHJldHVybiB7XG4gICAgbW91bnQsXG4gICAgcmVtb3ZlLFxuICAgIGF1dG9Nb3VudFxuICB9O1xufVxuZnVuY3Rpb24gYXV0b01vdW50VWkodWlDYWxsYmFja3MsIG9wdGlvbnMpIHtcbiAgY29uc3QgYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBjb25zdCBFWFBMSUNJVF9TVE9QX1JFQVNPTiA9IFwiZXhwbGljaXRfc3RvcF9hdXRvX21vdW50XCI7XG4gIGNvbnN0IF9zdG9wQXV0b01vdW50ID0gKCkgPT4ge1xuICAgIGFib3J0Q29udHJvbGxlci5hYm9ydChFWFBMSUNJVF9TVE9QX1JFQVNPTik7XG4gICAgb3B0aW9ucy5vblN0b3A/LigpO1xuICB9O1xuICBsZXQgcmVzb2x2ZWRBbmNob3IgPSB0eXBlb2Ygb3B0aW9ucy5hbmNob3IgPT09IFwiZnVuY3Rpb25cIiA/IG9wdGlvbnMuYW5jaG9yKCkgOiBvcHRpb25zLmFuY2hvcjtcbiAgaWYgKHJlc29sdmVkQW5jaG9yIGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgIHRocm93IEVycm9yKFxuICAgICAgXCJhdXRvTW91bnQgYW5kIEVsZW1lbnQgYW5jaG9yIG9wdGlvbiBjYW5ub3QgYmUgY29tYmluZWQuIEF2b2lkIHBhc3NpbmcgYEVsZW1lbnRgIGRpcmVjdGx5IG9yIGAoKSA9PiBFbGVtZW50YCB0byB0aGUgYW5jaG9yLlwiXG4gICAgKTtcbiAgfVxuICBhc3luYyBmdW5jdGlvbiBvYnNlcnZlRWxlbWVudChzZWxlY3Rvcikge1xuICAgIGxldCBpc0FuY2hvckV4aXN0ID0gISFnZXRBbmNob3Iob3B0aW9ucyk7XG4gICAgaWYgKGlzQW5jaG9yRXhpc3QpIHtcbiAgICAgIHVpQ2FsbGJhY2tzLm1vdW50KCk7XG4gICAgfVxuICAgIHdoaWxlICghYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjaGFuZ2VkQW5jaG9yID0gYXdhaXQgd2FpdEVsZW1lbnQoc2VsZWN0b3IgPz8gXCJib2R5XCIsIHtcbiAgICAgICAgICBjdXN0b21NYXRjaGVyOiAoKSA9PiBnZXRBbmNob3Iob3B0aW9ucykgPz8gbnVsbCxcbiAgICAgICAgICBkZXRlY3RvcjogaXNBbmNob3JFeGlzdCA/IHJlbW92ZURldGVjdG9yIDogbW91bnREZXRlY3RvcixcbiAgICAgICAgICBzaWduYWw6IGFib3J0Q29udHJvbGxlci5zaWduYWxcbiAgICAgICAgfSk7XG4gICAgICAgIGlzQW5jaG9yRXhpc3QgPSAhIWNoYW5nZWRBbmNob3I7XG4gICAgICAgIGlmIChpc0FuY2hvckV4aXN0KSB7XG4gICAgICAgICAgdWlDYWxsYmFja3MubW91bnQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB1aUNhbGxiYWNrcy51bm1vdW50KCk7XG4gICAgICAgICAgaWYgKG9wdGlvbnMub25jZSkge1xuICAgICAgICAgICAgdWlDYWxsYmFja3Muc3RvcEF1dG9Nb3VudCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgaWYgKGFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCAmJiBhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlYXNvbiA9PT0gRVhQTElDSVRfU1RPUF9SRUFTT04pIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBvYnNlcnZlRWxlbWVudChyZXNvbHZlZEFuY2hvcik7XG4gIHJldHVybiB7IHN0b3BBdXRvTW91bnQ6IF9zdG9wQXV0b01vdW50IH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gc3BsaXRTaGFkb3dSb290Q3NzKGNzcykge1xuICBsZXQgc2hhZG93Q3NzID0gY3NzO1xuICBsZXQgZG9jdW1lbnRDc3MgPSBcIlwiO1xuICBjb25zdCBydWxlc1JlZ2V4ID0gLyhcXHMqQChwcm9wZXJ0eXxmb250LWZhY2UpW1xcc1xcU10qP3tbXFxzXFxTXSo/fSkvZ207XG4gIGxldCBtYXRjaDtcbiAgd2hpbGUgKChtYXRjaCA9IHJ1bGVzUmVnZXguZXhlYyhjc3MpKSAhPT0gbnVsbCkge1xuICAgIGRvY3VtZW50Q3NzICs9IG1hdGNoWzFdO1xuICAgIHNoYWRvd0NzcyA9IHNoYWRvd0Nzcy5yZXBsYWNlKG1hdGNoWzFdLCBcIlwiKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIGRvY3VtZW50Q3NzOiBkb2N1bWVudENzcy50cmltKCksXG4gICAgc2hhZG93Q3NzOiBzaGFkb3dDc3MudHJpbSgpXG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBjcmVhdGVJc29sYXRlZEVsZW1lbnQgfSBmcm9tIFwiQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnRcIjtcbmltcG9ydCB7IGFwcGx5UG9zaXRpb24sIGNyZWF0ZU1vdW50RnVuY3Rpb25zLCBtb3VudFVpIH0gZnJvbSBcIi4vc2hhcmVkLm1qc1wiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7IHNwbGl0U2hhZG93Um9vdENzcyB9IGZyb20gXCIuLi9zcGxpdC1zaGFkb3ctcm9vdC1jc3MubWpzXCI7XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlU2hhZG93Um9vdFVpKGN0eCwgb3B0aW9ucykge1xuICBjb25zdCBpbnN0YW5jZUlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDIsIDE1KTtcbiAgY29uc3QgY3NzID0gW107XG4gIGlmICghb3B0aW9ucy5pbmhlcml0U3R5bGVzKSB7XG4gICAgY3NzLnB1c2goYC8qIFdYVCBTaGFkb3cgUm9vdCBSZXNldCAqLyA6aG9zdHthbGw6aW5pdGlhbCAhaW1wb3J0YW50O31gKTtcbiAgfVxuICBpZiAob3B0aW9ucy5jc3MpIHtcbiAgICBjc3MucHVzaChvcHRpb25zLmNzcyk7XG4gIH1cbiAgaWYgKGN0eC5vcHRpb25zPy5jc3NJbmplY3Rpb25Nb2RlID09PSBcInVpXCIpIHtcbiAgICBjb25zdCBlbnRyeUNzcyA9IGF3YWl0IGxvYWRDc3MoKTtcbiAgICBjc3MucHVzaChlbnRyeUNzcy5yZXBsYWNlQWxsKFwiOnJvb3RcIiwgXCI6aG9zdFwiKSk7XG4gIH1cbiAgY29uc3QgeyBzaGFkb3dDc3MsIGRvY3VtZW50Q3NzIH0gPSBzcGxpdFNoYWRvd1Jvb3RDc3MoY3NzLmpvaW4oXCJcXG5cIikudHJpbSgpKTtcbiAgY29uc3Qge1xuICAgIGlzb2xhdGVkRWxlbWVudDogdWlDb250YWluZXIsXG4gICAgcGFyZW50RWxlbWVudDogc2hhZG93SG9zdCxcbiAgICBzaGFkb3dcbiAgfSA9IGF3YWl0IGNyZWF0ZUlzb2xhdGVkRWxlbWVudCh7XG4gICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgIGNzczoge1xuICAgICAgdGV4dENvbnRlbnQ6IHNoYWRvd0Nzc1xuICAgIH0sXG4gICAgbW9kZTogb3B0aW9ucy5tb2RlID8/IFwib3BlblwiLFxuICAgIGlzb2xhdGVFdmVudHM6IG9wdGlvbnMuaXNvbGF0ZUV2ZW50c1xuICB9KTtcbiAgc2hhZG93SG9zdC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXd4dC1zaGFkb3ctcm9vdFwiLCBcIlwiKTtcbiAgbGV0IG1vdW50ZWQ7XG4gIGNvbnN0IG1vdW50ID0gKCkgPT4ge1xuICAgIG1vdW50VWkoc2hhZG93SG9zdCwgb3B0aW9ucyk7XG4gICAgYXBwbHlQb3NpdGlvbihzaGFkb3dIb3N0LCBzaGFkb3cucXVlcnlTZWxlY3RvcihcImh0bWxcIiksIG9wdGlvbnMpO1xuICAgIGlmIChkb2N1bWVudENzcyAmJiAhZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgIGBzdHlsZVt3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzPVwiJHtpbnN0YW5jZUlkfVwiXWBcbiAgICApKSB7XG4gICAgICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcbiAgICAgIHN0eWxlLnRleHRDb250ZW50ID0gZG9jdW1lbnRDc3M7XG4gICAgICBzdHlsZS5zZXRBdHRyaWJ1dGUoXCJ3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzXCIsIGluc3RhbmNlSWQpO1xuICAgICAgKGRvY3VtZW50LmhlYWQgPz8gZG9jdW1lbnQuYm9keSkuYXBwZW5kKHN0eWxlKTtcbiAgICB9XG4gICAgbW91bnRlZCA9IG9wdGlvbnMub25Nb3VudCh1aUNvbnRhaW5lciwgc2hhZG93LCBzaGFkb3dIb3N0KTtcbiAgfTtcbiAgY29uc3QgcmVtb3ZlID0gKCkgPT4ge1xuICAgIG9wdGlvbnMub25SZW1vdmU/Lihtb3VudGVkKTtcbiAgICBzaGFkb3dIb3N0LnJlbW92ZSgpO1xuICAgIGNvbnN0IGRvY3VtZW50U3R5bGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFxuICAgICAgYHN0eWxlW3d4dC1zaGFkb3ctcm9vdC1kb2N1bWVudC1zdHlsZXM9XCIke2luc3RhbmNlSWR9XCJdYFxuICAgICk7XG4gICAgZG9jdW1lbnRTdHlsZT8ucmVtb3ZlKCk7XG4gICAgd2hpbGUgKHVpQ29udGFpbmVyLmxhc3RDaGlsZClcbiAgICAgIHVpQ29udGFpbmVyLnJlbW92ZUNoaWxkKHVpQ29udGFpbmVyLmxhc3RDaGlsZCk7XG4gICAgbW91bnRlZCA9IHZvaWQgMDtcbiAgfTtcbiAgY29uc3QgbW91bnRGdW5jdGlvbnMgPSBjcmVhdGVNb3VudEZ1bmN0aW9ucyhcbiAgICB7XG4gICAgICBtb3VudCxcbiAgICAgIHJlbW92ZVxuICAgIH0sXG4gICAgb3B0aW9uc1xuICApO1xuICBjdHgub25JbnZhbGlkYXRlZChyZW1vdmUpO1xuICByZXR1cm4ge1xuICAgIHNoYWRvdyxcbiAgICBzaGFkb3dIb3N0LFxuICAgIHVpQ29udGFpbmVyLFxuICAgIC4uLm1vdW50RnVuY3Rpb25zLFxuICAgIGdldCBtb3VudGVkKCkge1xuICAgICAgcmV0dXJuIG1vdW50ZWQ7XG4gICAgfVxuICB9O1xufVxuYXN5bmMgZnVuY3Rpb24gbG9hZENzcygpIHtcbiAgY29uc3QgdXJsID0gYnJvd3Nlci5ydW50aW1lLmdldFVSTChgL2NvbnRlbnQtc2NyaXB0cy8ke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfS5jc3NgKTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwpO1xuICAgIHJldHVybiBhd2FpdCByZXMudGV4dCgpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBsb2dnZXIud2FybihcbiAgICAgIGBGYWlsZWQgdG8gbG9hZCBzdHlsZXMgQCAke3VybH0uIERpZCB5b3UgZm9yZ2V0IHRvIGltcG9ydCB0aGUgc3R5bGVzaGVldCBpbiB5b3VyIGVudHJ5cG9pbnQ/YCxcbiAgICAgIGVyclxuICAgICk7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVDb250ZW50U2NyaXB0KGRlZmluaXRpb24pIHtcbiAgcmV0dXJuIGRlZmluaXRpb247XG59XG4iLCJmdW5jdGlvbiByKGUpe3ZhciB0LGYsbj1cIlwiO2lmKFwic3RyaW5nXCI9PXR5cGVvZiBlfHxcIm51bWJlclwiPT10eXBlb2YgZSluKz1lO2Vsc2UgaWYoXCJvYmplY3RcIj09dHlwZW9mIGUpaWYoQXJyYXkuaXNBcnJheShlKSl7dmFyIG89ZS5sZW5ndGg7Zm9yKHQ9MDt0PG87dCsrKWVbdF0mJihmPXIoZVt0XSkpJiYobiYmKG4rPVwiIFwiKSxuKz1mKX1lbHNlIGZvcihmIGluIGUpZVtmXSYmKG4mJihuKz1cIiBcIiksbis9Zik7cmV0dXJuIG59ZXhwb3J0IGZ1bmN0aW9uIGNsc3goKXtmb3IodmFyIGUsdCxmPTAsbj1cIlwiLG89YXJndW1lbnRzLmxlbmd0aDtmPG87ZisrKShlPWFyZ3VtZW50c1tmXSkmJih0PXIoZSkpJiYobiYmKG4rPVwiIFwiKSxuKz10KTtyZXR1cm4gbn1leHBvcnQgZGVmYXVsdCBjbHN4OyIsImltcG9ydCB7IGNsc3gsIHR5cGUgQ2xhc3NWYWx1ZSB9IGZyb20gJ2Nsc3gnXG5cbmV4cG9ydCBmdW5jdGlvbiBjbiguLi5pbnB1dHM6IENsYXNzVmFsdWVbXSkge1xuICByZXR1cm4gY2xzeChpbnB1dHMpXG59IiwiaW1wb3J0IHsgU2hvdywgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQsIEpTWCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEhlYWRlclByb3BzIHtcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIGxvZ28/OiBKU1guRWxlbWVudDtcbiAgYWN0aW9ucz86IEpTWC5FbGVtZW50O1xuICB2YXJpYW50PzogJ2RlZmF1bHQnIHwgJ21pbmltYWwnIHwgJ3RyYW5zcGFyZW50JztcbiAgc3RpY2t5PzogYm9vbGVhbjtcbiAgc2hvd01lbnVCdXR0b24/OiBib29sZWFuO1xuICBvbk1lbnVDbGljaz86ICgpID0+IHZvaWQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgSGVhZGVyOiBDb21wb25lbnQ8SGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtpc1Njcm9sbGVkLCBzZXRJc1Njcm9sbGVkXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG5cbiAgLy8gVHJhY2sgc2Nyb2xsIHBvc2l0aW9uIGZvciBzdGlja3kgaGVhZGVyIGVmZmVjdHNcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHByb3BzLnN0aWNreSkge1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdzY3JvbGwnLCAoKSA9PiB7XG4gICAgICBzZXRJc1Njcm9sbGVkKHdpbmRvdy5zY3JvbGxZID4gMTApO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgdmFyaWFudCA9ICgpID0+IHByb3BzLnZhcmlhbnQgfHwgJ2RlZmF1bHQnO1xuXG4gIHJldHVybiAoXG4gICAgPGhlYWRlclxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAndy1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMCcsXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBWYXJpYW50c1xuICAgICAgICAgICdiZy1zdXJmYWNlIGJvcmRlci1iIGJvcmRlci1zdWJ0bGUnOiB2YXJpYW50KCkgPT09ICdkZWZhdWx0JyxcbiAgICAgICAgICAnYmctdHJhbnNwYXJlbnQnOiB2YXJpYW50KCkgPT09ICdtaW5pbWFsJyB8fCB2YXJpYW50KCkgPT09ICd0cmFuc3BhcmVudCcsXG4gICAgICAgICAgJ2JhY2tkcm9wLWJsdXItbWQgYmctc3VyZmFjZS84MCc6IHZhcmlhbnQoKSA9PT0gJ3RyYW5zcGFyZW50JyAmJiBpc1Njcm9sbGVkKCksXG4gICAgICAgICAgLy8gU3RpY2t5IGJlaGF2aW9yXG4gICAgICAgICAgJ3N0aWNreSB0b3AtMCB6LTUwJzogcHJvcHMuc3RpY2t5LFxuICAgICAgICAgICdzaGFkb3ctbGcnOiBwcm9wcy5zdGlja3kgJiYgaXNTY3JvbGxlZCgpLFxuICAgICAgICB9LFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICA8ZGl2IGNsYXNzPVwibWF4LXctc2NyZWVuLXhsIG14LWF1dG8gcHgtNCBzbTpweC02IGxnOnB4LThcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBoLTE2XCI+XG4gICAgICAgICAgey8qIExlZnQgc2VjdGlvbiAqL31cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTRcIj5cbiAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnNob3dNZW51QnV0dG9ufT5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uTWVudUNsaWNrfVxuICAgICAgICAgICAgICAgIGNsYXNzPVwicC0yIHJvdW5kZWQtbGcgaG92ZXI6YmctaGlnaGxpZ2h0IHRyYW5zaXRpb24tY29sb3JzIGxnOmhpZGRlblwiXG4gICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIk1lbnVcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPHN2ZyBjbGFzcz1cInctNiBoLTZcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIj5cbiAgICAgICAgICAgICAgICAgIDxwYXRoIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiIHN0cm9rZS13aWR0aD1cIjJcIiBkPVwiTTQgNmgxNk00IDEyaDE2TTQgMThoMTZcIiAvPlxuICAgICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMubG9nb30gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy50aXRsZX0+XG4gICAgICAgICAgICAgICAgPGgxIGNsYXNzPVwidGV4dC14bCBmb250LWJvbGQgdGV4dC1wcmltYXJ5XCI+e3Byb3BzLnRpdGxlfTwvaDE+XG4gICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgIHtwcm9wcy5sb2dvfVxuICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgey8qIFJpZ2h0IHNlY3Rpb24gKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuYWN0aW9uc30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAge3Byb3BzLmFjdGlvbnN9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9oZWFkZXI+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2NvcmVQYW5lbFByb3BzIHtcbiAgc2NvcmU6IG51bWJlciB8IG51bGw7XG4gIHJhbms6IG51bWJlciB8IG51bGw7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgU2NvcmVQYW5lbDogQ29tcG9uZW50PFNjb3JlUGFuZWxQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZ3JpZCBncmlkLWNvbHMtWzFmcl8xZnJdIGdhcC0yIHAtNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogU2NvcmUgQm94ICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2Ugcm91bmRlZC1sZyBwLTQgZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgbWluLWgtWzgwcHhdXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTJ4bCBmb250LW1vbm8gZm9udC1ib2xkIHRleHQtcHVycGxlLTUwMFwiPlxuICAgICAgICAgIHtwcm9wcy5zY29yZSAhPT0gbnVsbCA/IHByb3BzLnNjb3JlIDogJ+KAlCd9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+XG4gICAgICAgICAgU2NvcmVcbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgey8qIFJhbmsgQm94ICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2Ugcm91bmRlZC1sZyBwLTQgZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgbWluLWgtWzgwcHhdXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTJ4bCBmb250LW1vbm8gZm9udC1ib2xkIHRleHQtcGluay01MDBcIj5cbiAgICAgICAgICB7cHJvcHMucmFuayAhPT0gbnVsbCA/IHByb3BzLnJhbmsgOiAn4oCUJ31cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtc2Vjb25kYXJ5IG10LTFcIj5cbiAgICAgICAgICBSYW5rXG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3csIHNwbGl0UHJvcHMgfSBmcm9tICdzb2xpZC1qcydcbmltcG9ydCB0eXBlIHsgSlNYIH0gZnJvbSAnc29saWQtanMnXG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJ1xuXG5leHBvcnQgaW50ZXJmYWNlIEJ1dHRvblByb3BzIGV4dGVuZHMgSlNYLkJ1dHRvbkhUTUxBdHRyaWJ1dGVzPEhUTUxCdXR0b25FbGVtZW50PiB7XG4gIHZhcmlhbnQ/OiAncHJpbWFyeScgfCAnc2Vjb25kYXJ5JyB8ICdnaG9zdCcgfCAnZGFuZ2VyJ1xuICBzaXplPzogJ3NtJyB8ICdtZCcgfCAnbGcnXG4gIGZ1bGxXaWR0aD86IGJvb2xlYW5cbiAgbG9hZGluZz86IGJvb2xlYW5cbiAgbGVmdEljb24/OiBKU1guRWxlbWVudFxuICByaWdodEljb24/OiBKU1guRWxlbWVudFxufVxuXG5leHBvcnQgY29uc3QgQnV0dG9uID0gKHByb3BzOiBCdXR0b25Qcm9wcykgPT4ge1xuICBjb25zdCBbbG9jYWwsIG90aGVyc10gPSBzcGxpdFByb3BzKHByb3BzLCBbXG4gICAgJ3ZhcmlhbnQnLFxuICAgICdzaXplJyxcbiAgICAnZnVsbFdpZHRoJyxcbiAgICAnbG9hZGluZycsXG4gICAgJ2xlZnRJY29uJyxcbiAgICAncmlnaHRJY29uJyxcbiAgICAnY2hpbGRyZW4nLFxuICAgICdjbGFzcycsXG4gICAgJ2Rpc2FibGVkJyxcbiAgXSlcblxuICBjb25zdCB2YXJpYW50ID0gKCkgPT4gbG9jYWwudmFyaWFudCB8fCAncHJpbWFyeSdcbiAgY29uc3Qgc2l6ZSA9ICgpID0+IGxvY2FsLnNpemUgfHwgJ21kJ1xuXG4gIHJldHVybiAoXG4gICAgPGJ1dHRvblxuICAgICAgZGlzYWJsZWQ9e2xvY2FsLmRpc2FibGVkIHx8IGxvY2FsLmxvYWRpbmd9XG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZm9udC1tZWRpdW0gdHJhbnNpdGlvbi1hbGwgY3Vyc29yLXBvaW50ZXIgb3V0bGluZS1ub25lIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAge1xuICAgICAgICAgIC8vIFZhcmlhbnRzXG4gICAgICAgICAgJ2JnLWdyYWRpZW50LXByaW1hcnkgdGV4dC13aGl0ZSBob3ZlcjpzaGFkb3ctbGcgaG92ZXI6YnJpZ2h0bmVzcy0xMTAgZ2xvdy1wcmltYXJ5JzpcbiAgICAgICAgICAgIHZhcmlhbnQoKSA9PT0gJ3ByaW1hcnknLFxuICAgICAgICAgICdiZy1zdXJmYWNlIHRleHQtcHJpbWFyeSBib3JkZXIgYm9yZGVyLWRlZmF1bHQgaG92ZXI6YmctZWxldmF0ZWQgaG92ZXI6Ym9yZGVyLXN0cm9uZyc6XG4gICAgICAgICAgICB2YXJpYW50KCkgPT09ICdzZWNvbmRhcnknLFxuICAgICAgICAgICd0ZXh0LXNlY29uZGFyeSBob3Zlcjp0ZXh0LXByaW1hcnkgaG92ZXI6Ymctc3VyZmFjZSc6XG4gICAgICAgICAgICB2YXJpYW50KCkgPT09ICdnaG9zdCcsXG4gICAgICAgICAgJ2JnLXJlZC02MDAgdGV4dC13aGl0ZSBob3ZlcjpiZy1yZWQtNzAwIGhvdmVyOnNoYWRvdy1sZyc6XG4gICAgICAgICAgICB2YXJpYW50KCkgPT09ICdkYW5nZXInLFxuICAgICAgICAgIC8vIFNpemVzXG4gICAgICAgICAgJ2gtOCBweC0zIHRleHQtc20gcm91bmRlZC1tZCBnYXAtMS41Jzogc2l6ZSgpID09PSAnc20nLFxuICAgICAgICAgICdoLTEwIHB4LTQgdGV4dC1iYXNlIHJvdW5kZWQtbGcgZ2FwLTInOiBzaXplKCkgPT09ICdtZCcsXG4gICAgICAgICAgJ2gtMTIgcHgtNiB0ZXh0LWxnIHJvdW5kZWQtbGcgZ2FwLTIuNSc6IHNpemUoKSA9PT0gJ2xnJyxcbiAgICAgICAgICAvLyBGdWxsIHdpZHRoXG4gICAgICAgICAgJ3ctZnVsbCc6IGxvY2FsLmZ1bGxXaWR0aCxcbiAgICAgICAgICAvLyBMb2FkaW5nIHN0YXRlXG4gICAgICAgICAgJ2N1cnNvci13YWl0JzogbG9jYWwubG9hZGluZyxcbiAgICAgICAgfSxcbiAgICAgICAgbG9jYWwuY2xhc3NcbiAgICAgICl9XG4gICAgICB7Li4ub3RoZXJzfVxuICAgID5cbiAgICAgIDxTaG93IHdoZW49e2xvY2FsLmxvYWRpbmd9PlxuICAgICAgICA8c3ZnXG4gICAgICAgICAgY2xhc3M9XCJhbmltYXRlLXNwaW4gaC00IHctNFwiXG4gICAgICAgICAgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiXG4gICAgICAgICAgZmlsbD1cIm5vbmVcIlxuICAgICAgICAgIHZpZXdCb3g9XCIwIDAgMjQgMjRcIlxuICAgICAgICA+XG4gICAgICAgICAgPGNpcmNsZVxuICAgICAgICAgICAgY2xhc3M9XCJvcGFjaXR5LTI1XCJcbiAgICAgICAgICAgIGN4PVwiMTJcIlxuICAgICAgICAgICAgY3k9XCIxMlwiXG4gICAgICAgICAgICByPVwiMTBcIlxuICAgICAgICAgICAgc3Ryb2tlPVwiY3VycmVudENvbG9yXCJcbiAgICAgICAgICAgIHN0cm9rZS13aWR0aD1cIjRcIlxuICAgICAgICAgIC8+XG4gICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgIGNsYXNzPVwib3BhY2l0eS03NVwiXG4gICAgICAgICAgICBmaWxsPVwiY3VycmVudENvbG9yXCJcbiAgICAgICAgICAgIGQ9XCJNNCAxMmE4IDggMCAwMTgtOFYwQzUuMzczIDAgMCA1LjM3MyAwIDEyaDR6bTIgNS4yOTFBNy45NjIgNy45NjIgMCAwMTQgMTJIMGMwIDMuMDQyIDEuMTM1IDUuODI0IDMgNy45MzhsMy0yLjY0N3pcIlxuICAgICAgICAgIC8+XG4gICAgICAgIDwvc3ZnPlxuICAgICAgPC9TaG93PlxuXG4gICAgICA8U2hvdyB3aGVuPXtsb2NhbC5sZWZ0SWNvbiAmJiAhbG9jYWwubG9hZGluZ30+XG4gICAgICAgIHtsb2NhbC5sZWZ0SWNvbn1cbiAgICAgIDwvU2hvdz5cblxuICAgICAgPFNob3cgd2hlbj17bG9jYWwuY2hpbGRyZW59PlxuICAgICAgICA8c3Bhbj57bG9jYWwuY2hpbGRyZW59PC9zcGFuPlxuICAgICAgPC9TaG93PlxuXG4gICAgICA8U2hvdyB3aGVuPXtsb2NhbC5yaWdodEljb259PlxuICAgICAgICB7bG9jYWwucmlnaHRJY29ufVxuICAgICAgPC9TaG93PlxuICAgIDwvYnV0dG9uPlxuICApXG59IiwiaW1wb3J0IHsgU2hvdywgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9CdXR0b24nO1xuXG5leHBvcnQgdHlwZSBPbmJvYXJkaW5nU3RlcCA9ICdjb25uZWN0LXdhbGxldCcgfCAnZ2VuZXJhdGluZy10b2tlbicgfCAnY29tcGxldGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE9uYm9hcmRpbmdGbG93UHJvcHMge1xuICBzdGVwOiBPbmJvYXJkaW5nU3RlcDtcbiAgZXJyb3I/OiBzdHJpbmcgfCBudWxsO1xuICB3YWxsZXRBZGRyZXNzPzogc3RyaW5nIHwgbnVsbDtcbiAgdG9rZW4/OiBzdHJpbmcgfCBudWxsO1xuICBvbkNvbm5lY3RXYWxsZXQ6ICgpID0+IHZvaWQ7XG4gIG9uVXNlVGVzdE1vZGU6ICgpID0+IHZvaWQ7XG4gIG9uVXNlUHJpdmF0ZUtleTogKHByaXZhdGVLZXk6IHN0cmluZykgPT4gdm9pZDtcbiAgb25Db21wbGV0ZTogKCkgPT4gdm9pZDtcbiAgaXNDb25uZWN0aW5nPzogYm9vbGVhbjtcbiAgaXNHZW5lcmF0aW5nPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBPbmJvYXJkaW5nRmxvdzogQ29tcG9uZW50PE9uYm9hcmRpbmdGbG93UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtzaG93VGVzdE9wdGlvbiwgc2V0U2hvd1Rlc3RPcHRpb25dID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3Nob3dQcml2YXRlS2V5SW5wdXQsIHNldFNob3dQcml2YXRlS2V5SW5wdXRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3ByaXZhdGVLZXksIHNldFByaXZhdGVLZXldID0gY3JlYXRlU2lnbmFsKCcnKTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgJ21pbi1oLXNjcmVlbiBiZy1ncmFkaWVudC10by1iciBmcm9tLWdyYXktOTAwIHRvLWJsYWNrIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyJyxcbiAgICAgIHByb3BzLmNsYXNzXG4gICAgKX0+XG4gICAgICA8ZGl2IGNsYXNzPVwibWF4LXctMnhsIHctZnVsbCBwLTEyXCI+XG4gICAgICAgIHsvKiBMb2dvL0hlYWRlciAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIG1iLTEyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtOHhsIG1iLTZcIj7wn46kPC9kaXY+XG4gICAgICAgICAgPGgxIGNsYXNzPVwidGV4dC02eGwgZm9udC1ib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgU2NhcmxldHQgS2FyYW9rZVxuICAgICAgICAgIDwvaDE+XG4gICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXhsIHRleHQtZ3JheS00MDBcIj5cbiAgICAgICAgICAgIEFJLXBvd2VyZWQga2FyYW9rZSBmb3IgU291bmRDbG91ZFxuICAgICAgICAgIDwvcD5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgey8qIFByb2dyZXNzIERvdHMgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGp1c3RpZnktY2VudGVyIG1iLTEyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZ2FwLTNcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAndy0zIGgtMyByb3VuZGVkLWZ1bGwgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgICAgICAgcHJvcHMuc3RlcCA9PT0gJ2Nvbm5lY3Qtd2FsbGV0JyBcbiAgICAgICAgICAgICAgICA/ICdiZy1wdXJwbGUtNTAwIHctMTInIFxuICAgICAgICAgICAgICAgIDogcHJvcHMud2FsbGV0QWRkcmVzcyBcbiAgICAgICAgICAgICAgICAgID8gJ2JnLWdyZWVuLTUwMCcgXG4gICAgICAgICAgICAgICAgICA6ICdiZy1ncmF5LTYwMCdcbiAgICAgICAgICAgICl9IC8+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3ctMyBoLTMgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgICAgICAgIHByb3BzLnN0ZXAgPT09ICdnZW5lcmF0aW5nLXRva2VuJyBcbiAgICAgICAgICAgICAgICA/ICdiZy1wdXJwbGUtNTAwIHctMTInIFxuICAgICAgICAgICAgICAgIDogcHJvcHMudG9rZW4gXG4gICAgICAgICAgICAgICAgICA/ICdiZy1ncmVlbi01MDAnIFxuICAgICAgICAgICAgICAgICAgOiAnYmctZ3JheS02MDAnXG4gICAgICAgICAgICApfSAvPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICd3LTMgaC0zIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICAgICAgICBwcm9wcy5zdGVwID09PSAnY29tcGxldGUnIFxuICAgICAgICAgICAgICAgID8gJ2JnLWdyZWVuLTUwMCB3LTEyJyBcbiAgICAgICAgICAgICAgICA6ICdiZy1ncmF5LTYwMCdcbiAgICAgICAgICAgICl9IC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHsvKiBFcnJvciBEaXNwbGF5ICovfVxuICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5lcnJvcn0+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm1iLTggcC02IGJnLXJlZC05MDAvMjAgYm9yZGVyIGJvcmRlci1yZWQtODAwIHJvdW5kZWQteGxcIj5cbiAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1yZWQtNDAwIHRleHQtY2VudGVyIHRleHQtbGdcIj57cHJvcHMuZXJyb3J9PC9wPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgey8qIENvbnRlbnQgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LTZcIj5cbiAgICAgICAgICB7LyogQ29ubmVjdCBXYWxsZXQgU3RlcCAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zdGVwID09PSAnY29ubmVjdC13YWxsZXQnfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBzcGFjZS15LThcIj5cbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTR4bCBmb250LXNlbWlib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgICAgICAgQ29ubmVjdCBZb3VyIFdhbGxldFxuICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQtbGcgbWF4LXctbWQgbXgtYXV0b1wiPlxuICAgICAgICAgICAgICAgICAgQ29ubmVjdCB5b3VyIHdhbGxldCB0byBnZXQgc3RhcnRlZFxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNCBtYXgtdy1tZCBteC1hdXRvXCI+XG4gICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25Db25uZWN0V2FsbGV0fVxuICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmlzQ29ubmVjdGluZ31cbiAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE2IHRleHQtbGdcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIHtwcm9wcy5pc0Nvbm5lY3RpbmcgPyAoXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInctNCBoLTQgYm9yZGVyLTIgYm9yZGVyLWN1cnJlbnQgYm9yZGVyLXItdHJhbnNwYXJlbnQgcm91bmRlZC1mdWxsIGFuaW1hdGUtc3BpblwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgQ29ubmVjdGluZy4uLlxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4+8J+mijwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICBDb25uZWN0IHdpdGggTWV0YU1hc2tcbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L0J1dHRvbj5cblxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49eyFzaG93VGVzdE9wdGlvbigpICYmICFzaG93UHJpdmF0ZUtleUlucHV0KCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZ2FwLTQganVzdGlmeS1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dUZXN0T3B0aW9uKHRydWUpfVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIFVzZSBkZW1vIG1vZGVcbiAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidGV4dC1ncmF5LTYwMFwiPnw8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93UHJpdmF0ZUtleUlucHV0KHRydWUpfVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIFVzZSBwcml2YXRlIGtleVxuICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Nob3dUZXN0T3B0aW9uKCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB0LTYgc3BhY2UteS00XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib3JkZXItdCBib3JkZXItZ3JheS04MDAgcHQtNlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uVXNlVGVzdE1vZGV9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwic2Vjb25kYXJ5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0XCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICBDb250aW51ZSB3aXRoIERlbW8gTW9kZVxuICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dUZXN0T3B0aW9uKGZhbHNlKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzIG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIEJhY2tcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtzaG93UHJpdmF0ZUtleUlucHV0KCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB0LTYgc3BhY2UteS00XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib3JkZXItdCBib3JkZXItZ3JheS04MDAgcHQtNlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cInBhc3N3b3JkXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtwcml2YXRlS2V5KCl9XG4gICAgICAgICAgICAgICAgICAgICAgICBvbklucHV0PXsoZSkgPT4gc2V0UHJpdmF0ZUtleShlLmN1cnJlbnRUYXJnZXQudmFsdWUpfVxuICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJFbnRlciBwcml2YXRlIGtleVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0IHB4LTQgYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLWxnIHRleHQtd2hpdGUgcGxhY2Vob2xkZXItZ3JheS01MDAgZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1wdXJwbGUtNTAwXCJcbiAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHByb3BzLm9uVXNlUHJpdmF0ZUtleShwcml2YXRlS2V5KCkpfVxuICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFwcml2YXRlS2V5KCkgfHwgcHJpdmF0ZUtleSgpLmxlbmd0aCAhPT0gNjR9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwic2Vjb25kYXJ5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0IG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIENvbm5lY3Qgd2l0aCBQcml2YXRlIEtleVxuICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd1ByaXZhdGVLZXlJbnB1dChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldFByaXZhdGVLZXkoJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzIG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIEJhY2tcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICB7LyogR2VuZXJhdGluZyBUb2tlbiBTdGVwICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnN0ZXAgPT09ICdnZW5lcmF0aW5nLXRva2VuJ30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgc3BhY2UteS04XCI+XG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC00eGwgZm9udC1zZW1pYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj5cbiAgICAgICAgICAgICAgICAgIFNldHRpbmcgVXAgWW91ciBBY2NvdW50XG4gICAgICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy53YWxsZXRBZGRyZXNzfT5cbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTQwMCB0ZXh0LWxnIG1iLTNcIj5cbiAgICAgICAgICAgICAgICAgICAgQ29ubmVjdGVkIHdhbGxldDpcbiAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgIDxjb2RlIGNsYXNzPVwidGV4dC1sZyB0ZXh0LXB1cnBsZS00MDAgYmctZ3JheS04MDAgcHgtNCBweS0yIHJvdW5kZWQtbGcgZm9udC1tb25vIGlubGluZS1ibG9ja1wiPlxuICAgICAgICAgICAgICAgICAgICB7cHJvcHMud2FsbGV0QWRkcmVzcz8uc2xpY2UoMCwgNil9Li4ue3Byb3BzLndhbGxldEFkZHJlc3M/LnNsaWNlKC00KX1cbiAgICAgICAgICAgICAgICAgIDwvY29kZT5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJweS0xMlwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ3LTIwIGgtMjAgYm9yZGVyLTQgYm9yZGVyLXB1cnBsZS01MDAgYm9yZGVyLXQtdHJhbnNwYXJlbnQgcm91bmRlZC1mdWxsIGFuaW1hdGUtc3BpbiBteC1hdXRvXCIgLz5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQteGxcIj5cbiAgICAgICAgICAgICAgICB7cHJvcHMuaXNHZW5lcmF0aW5nIFxuICAgICAgICAgICAgICAgICAgPyAnR2VuZXJhdGluZyB5b3VyIGFjY2VzcyB0b2tlbi4uLicgXG4gICAgICAgICAgICAgICAgICA6ICdWZXJpZnlpbmcgeW91ciBhY2NvdW50Li4uJ31cbiAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgey8qIENvbXBsZXRlIFN0ZXAgKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuc3RlcCA9PT0gJ2NvbXBsZXRlJ30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgc3BhY2UteS04XCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTh4bCBtYi02XCI+8J+OiTwvZGl2PlxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTR4bCBmb250LXNlbWlib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgICAgICAgWW91J3JlIEFsbCBTZXQhXG4gICAgICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS00MDAgdGV4dC14bCBtYXgtdy1tZCBteC1hdXRvIG1iLThcIj5cbiAgICAgICAgICAgICAgICAgIFlvdXIgYWNjb3VudCBpcyByZWFkeS4gVGltZSB0byBzaW5nIVxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1heC13LW1kIG14LWF1dG9cIj5cbiAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNvbXBsZXRlfVxuICAgICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTYgdGV4dC1sZ1wiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgU3RhcnQgU2luZ2luZyEg8J+agFxuICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS01MDAgbXQtNlwiPlxuICAgICAgICAgICAgICAgIExvb2sgZm9yIHRoZSBrYXJhb2tlIHdpZGdldCBvbiBhbnkgU291bmRDbG91ZCB0cmFja1xuICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IEZvciwgY3JlYXRlRWZmZWN0LCBjcmVhdGVTaWduYWwsIFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEx5cmljTGluZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRleHQ6IHN0cmluZztcbiAgc3RhcnRUaW1lOiBudW1iZXI7IC8vIGluIHNlY29uZHNcbiAgZHVyYXRpb246IG51bWJlcjsgLy8gaW4gbWlsbGlzZWNvbmRzXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTHlyaWNzRGlzcGxheVByb3BzIHtcbiAgbHlyaWNzOiBMeXJpY0xpbmVbXTtcbiAgY3VycmVudFRpbWU/OiBudW1iZXI7IC8vIGluIG1pbGxpc2Vjb25kc1xuICBpc1BsYXlpbmc/OiBib29sZWFuO1xuICBsaW5lU2NvcmVzPzogQXJyYXk8eyBsaW5lSW5kZXg6IG51bWJlcjsgc2NvcmU6IG51bWJlcjsgdHJhbnNjcmlwdGlvbjogc3RyaW5nOyBmZWVkYmFjaz86IHN0cmluZyB9PjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBMeXJpY3NEaXNwbGF5OiBDb21wb25lbnQ8THlyaWNzRGlzcGxheVByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbY3VycmVudExpbmVJbmRleCwgc2V0Q3VycmVudExpbmVJbmRleF0gPSBjcmVhdGVTaWduYWwoLTEpO1xuICBsZXQgY29udGFpbmVyUmVmOiBIVE1MRGl2RWxlbWVudCB8IHVuZGVmaW5lZDtcbiAgXG4gIC8vIEhlbHBlciB0byBnZXQgc2NvcmUgZm9yIGEgbGluZVxuICBjb25zdCBnZXRMaW5lU2NvcmUgPSAobGluZUluZGV4OiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gcHJvcHMubGluZVNjb3Jlcz8uZmluZChzID0+IHMubGluZUluZGV4ID09PSBsaW5lSW5kZXgpPy5zY29yZSB8fCBudWxsO1xuICB9O1xuICBcbiAgLy8gSGVscGVyIHRvIGdldCBjb2xvciBiYXNlZCBvbiBzY29yZVxuICBjb25zdCBnZXRTY29yZVN0eWxlID0gKHNjb3JlOiBudW1iZXIgfCBudWxsKSA9PiB7XG4gICAgaWYgKHNjb3JlID09PSBudWxsKSByZXR1cm4ge307XG4gICAgXG4gICAgLy8gU2ltcGxlIGNvbG9yIGNoYW5nZXMgb25seSAtIG5vIGFuaW1hdGlvbnMgb3IgZWZmZWN0c1xuICAgIGlmIChzY29yZSA+PSA5NSkge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmYzODM4JyB9O1xuICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gOTApIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmNmI2YicgfTtcbiAgICB9IGVsc2UgaWYgKHNjb3JlID49IDgwKSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZjg3ODcnIH07XG4gICAgfSBlbHNlIGlmIChzY29yZSA+PSA3MCkge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmZhOGE4JyB9O1xuICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gNjApIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmY2VjZScgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmZlMGUwJyB9O1xuICAgIH1cbiAgfTtcbiAgXG4gIC8vIFJlbW92ZWQgZW1vamkgZnVuY3Rpb24gLSB1c2luZyBjb2xvcnMgb25seVxuXG4gIC8vIEZpbmQgY3VycmVudCBsaW5lIGJhc2VkIG9uIHRpbWVcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIXByb3BzLmN1cnJlbnRUaW1lIHx8ICFwcm9wcy5seXJpY3MubGVuZ3RoKSB7XG4gICAgICBzZXRDdXJyZW50TGluZUluZGV4KC0xKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0aW1lID0gcHJvcHMuY3VycmVudFRpbWUgLyAxMDAwOyAvLyBDb252ZXJ0IGZyb20gbWlsbGlzZWNvbmRzIHRvIHNlY29uZHNcbiAgICBjb25zdCBUSU1JTkdfT0ZGU0VUID0gMC4zOyAvLyBPZmZzZXQgdG8gbWFrZSBseXJpY3MgYXBwZWFyIDAuM3MgZWFybGllclxuICAgIGNvbnN0IGFkanVzdGVkVGltZSA9IHRpbWUgKyBUSU1JTkdfT0ZGU0VUO1xuICAgIFxuICAgIC8vIEZpbmQgdGhlIGxpbmUgdGhhdCBjb250YWlucyB0aGUgY3VycmVudCB0aW1lXG4gICAgbGV0IGZvdW5kSW5kZXggPSAtMTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByb3BzLmx5cmljcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgbGluZSA9IHByb3BzLmx5cmljc1tpXTtcbiAgICAgIGlmICghbGluZSkgY29udGludWU7XG4gICAgICBjb25zdCBlbmRUaW1lID0gbGluZS5zdGFydFRpbWUgKyBsaW5lLmR1cmF0aW9uIC8gMTAwMDsgLy8gQ29udmVydCBkdXJhdGlvbiBmcm9tIG1zIHRvIHNlY29uZHNcbiAgICAgIFxuICAgICAgaWYgKGFkanVzdGVkVGltZSA+PSBsaW5lLnN0YXJ0VGltZSAmJiBhZGp1c3RlZFRpbWUgPCBlbmRUaW1lKSB7XG4gICAgICAgIGZvdW5kSW5kZXggPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gSWYgbm8gbGluZSBjb250YWlucyBjdXJyZW50IHRpbWUsIGZpbmQgdGhlIG1vc3QgcmVjZW50IHBhc3QgbGluZVxuICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSAmJiB0aW1lID4gMCkge1xuICAgICAgZm9yIChsZXQgaSA9IHByb3BzLmx5cmljcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBjb25zdCBsaW5lID0gcHJvcHMubHlyaWNzW2ldO1xuICAgICAgICBpZiAoIWxpbmUpIGNvbnRpbnVlO1xuICAgICAgICBpZiAodGltZSA+PSBsaW5lLnN0YXJ0VGltZSkge1xuICAgICAgICAgIGZvdW5kSW5kZXggPSBpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIE9ubHkgdXBkYXRlIGlmIHRoZSBpbmRleCBoYXMgY2hhbmdlZCB0byBhdm9pZCB1bm5lY2Vzc2FyeSBzY3JvbGxpbmdcbiAgICBpZiAoZm91bmRJbmRleCAhPT0gY3VycmVudExpbmVJbmRleCgpKSB7XG4gICAgICBjb25zdCBwcmV2SW5kZXggPSBjdXJyZW50TGluZUluZGV4KCk7XG4gICAgICAvLyBPbmx5IGxvZyBsYXJnZSBqdW1wcyB0byByZWR1Y2UgY29uc29sZSBzcGFtXG4gICAgICBpZiAoTWF0aC5hYnMoZm91bmRJbmRleCAtIHByZXZJbmRleCkgPiA1KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbTHlyaWNzRGlzcGxheV0gQ3VycmVudCBsaW5lIGNoYW5nZWQ6Jywge1xuICAgICAgICAgIGZyb206IHByZXZJbmRleCxcbiAgICAgICAgICB0bzogZm91bmRJbmRleCxcbiAgICAgICAgICB0aW1lOiBwcm9wcy5jdXJyZW50VGltZSxcbiAgICAgICAgICB0aW1lSW5TZWNvbmRzOiB0aW1lLFxuICAgICAgICAgIGp1bXA6IE1hdGguYWJzKGZvdW5kSW5kZXggLSBwcmV2SW5kZXgpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBMb2cgd2FybmluZyBmb3IgbGFyZ2UganVtcHNcbiAgICAgIGlmIChwcmV2SW5kZXggIT09IC0xICYmIE1hdGguYWJzKGZvdW5kSW5kZXggLSBwcmV2SW5kZXgpID4gMTApIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdbTHlyaWNzRGlzcGxheV0gTGFyZ2UgbGluZSBqdW1wIGRldGVjdGVkIScsIHtcbiAgICAgICAgICBmcm9tOiBwcmV2SW5kZXgsXG4gICAgICAgICAgdG86IGZvdW5kSW5kZXgsXG4gICAgICAgICAgZnJvbUxpbmU6IHByb3BzLmx5cmljc1twcmV2SW5kZXhdLFxuICAgICAgICAgIHRvTGluZTogcHJvcHMubHlyaWNzW2ZvdW5kSW5kZXhdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBzZXRDdXJyZW50TGluZUluZGV4KGZvdW5kSW5kZXgpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gQXV0by1zY3JvbGwgdG8gY3VycmVudCBsaW5lXG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgaW5kZXggPSBjdXJyZW50TGluZUluZGV4KCk7XG4gICAgaWYgKGluZGV4ID09PSAtMSB8fCAhY29udGFpbmVyUmVmIHx8ICFwcm9wcy5pc1BsYXlpbmcpIHJldHVybjtcblxuICAgIGNvbnN0IGxpbmVFbGVtZW50cyA9IGNvbnRhaW5lclJlZi5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1saW5lLWluZGV4XScpO1xuICAgIGNvbnN0IGN1cnJlbnRFbGVtZW50ID0gbGluZUVsZW1lbnRzW2luZGV4XSBhcyBIVE1MRWxlbWVudDtcblxuICAgIGlmIChjdXJyZW50RWxlbWVudCkge1xuICAgICAgY29uc3QgY29udGFpbmVySGVpZ2h0ID0gY29udGFpbmVyUmVmLmNsaWVudEhlaWdodDtcbiAgICAgIGNvbnN0IGxpbmVUb3AgPSBjdXJyZW50RWxlbWVudC5vZmZzZXRUb3A7XG4gICAgICBjb25zdCBsaW5lSGVpZ2h0ID0gY3VycmVudEVsZW1lbnQub2Zmc2V0SGVpZ2h0O1xuICAgICAgXG4gICAgICAvLyBDZW50ZXIgdGhlIGN1cnJlbnQgbGluZVxuICAgICAgY29uc3QgdGFyZ2V0U2Nyb2xsVG9wID0gbGluZVRvcCAtIGNvbnRhaW5lckhlaWdodCAvIDIgKyBsaW5lSGVpZ2h0IC8gMjtcbiAgICAgIFxuICAgICAgY29udGFpbmVyUmVmLnNjcm9sbFRvKHtcbiAgICAgICAgdG9wOiB0YXJnZXRTY3JvbGxUb3AsXG4gICAgICAgIGJlaGF2aW9yOiAnc21vb3RoJyxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICByZWY9e2NvbnRhaW5lclJlZn1cbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2x5cmljcy1kaXNwbGF5IG92ZXJmbG93LXktYXV0byBzY3JvbGwtc21vb3RoJyxcbiAgICAgICAgJ2gtZnVsbCBweC02IHB5LTEyJyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktOFwiPlxuICAgICAgICA8Rm9yIGVhY2g9e3Byb3BzLmx5cmljc30+XG4gICAgICAgICAgeyhsaW5lLCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbGluZVNjb3JlID0gKCkgPT4gZ2V0TGluZVNjb3JlKGluZGV4KCkpO1xuICAgICAgICAgICAgY29uc3Qgc2NvcmVTdHlsZSA9ICgpID0+IGdldFNjb3JlU3R5bGUobGluZVNjb3JlKCkpO1xuICAgICAgICAgICAgLy8gVXNpbmcgY29sb3IgZ3JhZGllbnRzIGluc3RlYWQgb2YgZW1vamlzXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICBkYXRhLWxpbmUtaW5kZXg9e2luZGV4KCl9XG4gICAgICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICAgJ3RleHQtY2VudGVyJyxcbiAgICAgICAgICAgICAgICAgICd0ZXh0LTJ4bCBsZWFkaW5nLXJlbGF4ZWQnLFxuICAgICAgICAgICAgICAgICAgaW5kZXgoKSA9PT0gY3VycmVudExpbmVJbmRleCgpXG4gICAgICAgICAgICAgICAgICAgID8gJ29wYWNpdHktMTAwJ1xuICAgICAgICAgICAgICAgICAgICA6ICdvcGFjaXR5LTYwJ1xuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgIGNvbG9yOiBpbmRleCgpID09PSBjdXJyZW50TGluZUluZGV4KCkgJiYgIWxpbmVTY29yZSgpIFxuICAgICAgICAgICAgICAgICAgICA/ICcjZmZmZmZmJyAvLyBXaGl0ZSBmb3IgY3VycmVudCBsaW5lIHdpdGhvdXQgc2NvcmVcbiAgICAgICAgICAgICAgICAgICAgOiBzY29yZVN0eWxlKCkuY29sb3IgfHwgJyNmZmZmZmYnXG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIHtsaW5lLnRleHR9XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9fVxuICAgICAgICA8L0Zvcj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEthcmFva2VIZWFkZXJQcm9wcyB7XG4gIHNvbmdUaXRsZTogc3RyaW5nO1xuICBhcnRpc3Q6IHN0cmluZztcbiAgb25CYWNrPzogKCkgPT4gdm9pZDtcbiAgaXNQbGF5aW5nPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmNvbnN0IENoZXZyb25MZWZ0ID0gKCkgPT4gKFxuICA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBjbGFzcz1cInctNiBoLTZcIj5cbiAgICA8cGF0aCBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBkPVwiTTE1IDE5bC03LTcgNy03XCIgLz5cbiAgPC9zdmc+XG4pO1xuXG5jb25zdCBQYXVzZUljb24gPSAoKSA9PiAoXG4gIDxzdmcgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIGNsYXNzPVwidy02IGgtNlwiPlxuICAgIDxwYXRoIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiIGQ9XCJNMTAgOXY2bTQtNnY2bTctM2E5IDkgMCAxMS0xOCAwIDkgOSAwIDAxMTggMHpcIiAvPlxuICA8L3N2Zz5cbik7XG5cbmV4cG9ydCBjb25zdCBLYXJhb2tlSGVhZGVyOiBDb21wb25lbnQ8S2FyYW9rZUhlYWRlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdyZWxhdGl2ZSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLTQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgey8qIEJhY2svUGF1c2UgYnV0dG9uIC0gYWJzb2x1dGUgcG9zaXRpb25lZCAqL31cbiAgICAgIDxidXR0b25cbiAgICAgICAgb25DbGljaz17cHJvcHMub25CYWNrfVxuICAgICAgICBjbGFzcz1cImFic29sdXRlIGxlZnQtNCBwLTIgLW0tMiB0ZXh0LXNlY29uZGFyeSBob3Zlcjp0ZXh0LXByaW1hcnkgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICBhcmlhLWxhYmVsPXtwcm9wcy5pc1BsYXlpbmcgPyBcIlBhdXNlXCIgOiBcIkdvIGJhY2tcIn1cbiAgICAgID5cbiAgICAgICAge3Byb3BzLmlzUGxheWluZyA/IDxQYXVzZUljb24gLz4gOiA8Q2hldnJvbkxlZnQgLz59XG4gICAgICA8L2J1dHRvbj5cbiAgICAgIFxuICAgICAgey8qIFNvbmcgaW5mbyAtIGNlbnRlcmVkICovfVxuICAgICAgPGgxIGNsYXNzPVwidGV4dC1iYXNlIGZvbnQtbWVkaXVtIHRleHQtcHJpbWFyeSB0ZXh0LWNlbnRlciBweC0xMiB0cnVuY2F0ZSBtYXgtdy1mdWxsXCI+XG4gICAgICAgIHtwcm9wcy5zb25nVGl0bGV9IC0ge3Byb3BzLmFydGlzdH1cbiAgICAgIDwvaDE+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IEZvciwgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGVhZGVyYm9hcmRFbnRyeSB7XG4gIHJhbms6IG51bWJlcjtcbiAgdXNlcm5hbWU6IHN0cmluZztcbiAgc2NvcmU6IG51bWJlcjtcbiAgaXNDdXJyZW50VXNlcj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGVhZGVyYm9hcmRQYW5lbFByb3BzIHtcbiAgZW50cmllczogTGVhZGVyYm9hcmRFbnRyeVtdO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IExlYWRlcmJvYXJkUGFuZWw6IENvbXBvbmVudDxMZWFkZXJib2FyZFBhbmVsUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgZ2FwLTIgcC00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxTaG93IFxuICAgICAgICB3aGVuPXtwcm9wcy5lbnRyaWVzLmxlbmd0aCA+IDB9XG4gICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcHktMTIgcHgtNiB0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtNnhsIG1iLTQgb3BhY2l0eS0zMFwiPvCfjqQ8L2Rpdj5cbiAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0yXCI+Tm9ib2R5IGhhcyBjb21wbGV0ZWQgdGhpcyBzb25nIHlldCE8L3A+XG4gICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc20gdGV4dC10ZXJ0aWFyeVwiPkJlIHRoZSBmaXJzdCB0byBzZXQgYSBoaWdoIHNjb3JlPC9wPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICB9XG4gICAgICA+XG4gICAgICAgIDxGb3IgZWFjaD17cHJvcHMuZW50cmllc30+XG4gICAgICAgICAgeyhlbnRyeSkgPT4gKFxuICAgICAgICAgICAgPGRpdiBcbiAgICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICdmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBweC0zIHB5LTIgcm91bmRlZC1sZyB0cmFuc2l0aW9uLWNvbG9ycycsXG4gICAgICAgICAgICAgICAgZW50cnkuaXNDdXJyZW50VXNlciBcbiAgICAgICAgICAgICAgICAgID8gJ2JnLWFjY2VudC1wcmltYXJ5LzEwIGJvcmRlciBib3JkZXItYWNjZW50LXByaW1hcnkvMjAnIFxuICAgICAgICAgICAgICAgICAgOiAnYmctc3VyZmFjZSBob3ZlcjpiZy1zdXJmYWNlLWhvdmVyJ1xuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8c3BhbiBcbiAgICAgICAgICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICAgICAndy04IHRleHQtY2VudGVyIGZvbnQtbW9ubyBmb250LWJvbGQnLFxuICAgICAgICAgICAgICAgICAgZW50cnkucmFuayA8PSAzID8gJ3RleHQtYWNjZW50LXByaW1hcnknIDogJ3RleHQtc2Vjb25kYXJ5J1xuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAje2VudHJ5LnJhbmt9XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICdmbGV4LTEgdHJ1bmNhdGUnLFxuICAgICAgICAgICAgICAgIGVudHJ5LmlzQ3VycmVudFVzZXIgPyAndGV4dC1hY2NlbnQtcHJpbWFyeSBmb250LW1lZGl1bScgOiAndGV4dC1wcmltYXJ5J1xuICAgICAgICAgICAgICApfT5cbiAgICAgICAgICAgICAgICB7ZW50cnkudXNlcm5hbWV9XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICdmb250LW1vbm8gZm9udC1ib2xkJyxcbiAgICAgICAgICAgICAgICBlbnRyeS5pc0N1cnJlbnRVc2VyID8gJ3RleHQtYWNjZW50LXByaW1hcnknIDogJ3RleHQtcHJpbWFyeSdcbiAgICAgICAgICAgICAgKX0+XG4gICAgICAgICAgICAgICAge2VudHJ5LnNjb3JlLnRvTG9jYWxlU3RyaW5nKCl9XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvRm9yPlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgdHlwZSBQbGF5YmFja1NwZWVkID0gJzF4JyB8ICcwLjc1eCcgfCAnMC41eCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3BsaXRCdXR0b25Qcm9wcyB7XG4gIG9uU3RhcnQ/OiAoKSA9PiB2b2lkO1xuICBvblNwZWVkQ2hhbmdlPzogKHNwZWVkOiBQbGF5YmFja1NwZWVkKSA9PiB2b2lkO1xuICBkaXNhYmxlZD86IGJvb2xlYW47XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5jb25zdCBzcGVlZHM6IFBsYXliYWNrU3BlZWRbXSA9IFsnMXgnLCAnMC43NXgnLCAnMC41eCddO1xuXG5leHBvcnQgY29uc3QgU3BsaXRCdXR0b246IENvbXBvbmVudDxTcGxpdEJ1dHRvblByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbY3VycmVudFNwZWVkSW5kZXgsIHNldEN1cnJlbnRTcGVlZEluZGV4XSA9IGNyZWF0ZVNpZ25hbCgwKTtcbiAgXG4gIGNvbnN0IGN1cnJlbnRTcGVlZCA9ICgpID0+IHNwZWVkc1tjdXJyZW50U3BlZWRJbmRleCgpXTtcbiAgXG4gIGNvbnN0IGN5Y2xlU3BlZWQgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgY29uc3QgbmV4dEluZGV4ID0gKGN1cnJlbnRTcGVlZEluZGV4KCkgKyAxKSAlIHNwZWVkcy5sZW5ndGg7XG4gICAgc2V0Q3VycmVudFNwZWVkSW5kZXgobmV4dEluZGV4KTtcbiAgICBjb25zdCBuZXdTcGVlZCA9IHNwZWVkc1tuZXh0SW5kZXhdO1xuICAgIGlmIChuZXdTcGVlZCkge1xuICAgICAgcHJvcHMub25TcGVlZENoYW5nZT8uKG5ld1NwZWVkKTtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IFxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAncmVsYXRpdmUgaW5saW5lLWZsZXggdy1mdWxsIHJvdW5kZWQtbGcgb3ZlcmZsb3ctaGlkZGVuJyxcbiAgICAgICAgJ2JnLWdyYWRpZW50LXByaW1hcnkgdGV4dC13aGl0ZSBzaGFkb3ctbGcnLFxuICAgICAgICAndHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgey8qIE1haW4gYnV0dG9uICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblN0YXJ0fVxuICAgICAgICBkaXNhYmxlZD17cHJvcHMuZGlzYWJsZWR9XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnZmxleC0xIGlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByZWxhdGl2ZSBvdmVyZmxvdy1oaWRkZW4nLFxuICAgICAgICAgICdoLTEyIHB4LTYgdGV4dC1sZyBmb250LW1lZGl1bScsXG4gICAgICAgICAgJ2N1cnNvci1wb2ludGVyIGJvcmRlci1ub25lIG91dGxpbmUtbm9uZScsXG4gICAgICAgICAgJ2Rpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAgICAnaG92ZXI6Ymctd2hpdGUvMTAgYWN0aXZlOmJnLXdoaXRlLzIwJ1xuICAgICAgICApfVxuICAgICAgPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInJlbGF0aXZlIHotMTBcIj5TdGFydDwvc3Bhbj5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgXG4gICAgICB7LyogRGl2aWRlciAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJ3LXB4IGJnLWJsYWNrLzIwXCIgLz5cbiAgICAgIFxuICAgICAgey8qIFNwZWVkIGJ1dHRvbiAqL31cbiAgICAgIDxidXR0b25cbiAgICAgICAgb25DbGljaz17Y3ljbGVTcGVlZH1cbiAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmRpc2FibGVkfVxuICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgJ2lubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByZWxhdGl2ZScsXG4gICAgICAgICAgJ3ctMjAgdGV4dC1sZyBmb250LW1lZGl1bScsXG4gICAgICAgICAgJ2N1cnNvci1wb2ludGVyIGJvcmRlci1ub25lIG91dGxpbmUtbm9uZScsXG4gICAgICAgICAgJ2Rpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAgICAnaG92ZXI6Ymctd2hpdGUvMTAgYWN0aXZlOmJnLXdoaXRlLzIwJyxcbiAgICAgICAgICAnYWZ0ZXI6Y29udGVudC1bXCJcIl0gYWZ0ZXI6YWJzb2x1dGUgYWZ0ZXI6aW5zZXQtMCcsXG4gICAgICAgICAgJ2FmdGVyOmJnLWdyYWRpZW50LXRvLXIgYWZ0ZXI6ZnJvbS10cmFuc3BhcmVudCBhZnRlcjp2aWEtd2hpdGUvMjAgYWZ0ZXI6dG8tdHJhbnNwYXJlbnQnLFxuICAgICAgICAgICdhZnRlcjp0cmFuc2xhdGUteC1bLTIwMCVdIGhvdmVyOmFmdGVyOnRyYW5zbGF0ZS14LVsyMDAlXScsXG4gICAgICAgICAgJ2FmdGVyOnRyYW5zaXRpb24tdHJhbnNmb3JtIGFmdGVyOmR1cmF0aW9uLTcwMCdcbiAgICAgICAgKX1cbiAgICAgICAgYXJpYS1sYWJlbD1cIkNoYW5nZSBwbGF5YmFjayBzcGVlZFwiXG4gICAgICA+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwicmVsYXRpdmUgei0xMFwiPntjdXJyZW50U3BlZWQoKX08L3NwYW4+XG4gICAgICA8L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsLCBTaG93LCBjcmVhdGVDb250ZXh0LCB1c2VDb250ZXh0IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQsIEpTWCwgUGFyZW50Q29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFiIHtcbiAgaWQ6IHN0cmluZztcbiAgbGFiZWw6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzUHJvcHMge1xuICB0YWJzOiBUYWJbXTtcbiAgZGVmYXVsdFRhYj86IHN0cmluZztcbiAgb25UYWJDaGFuZ2U/OiAodGFiSWQ6IHN0cmluZykgPT4gdm9pZDtcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzTGlzdFByb3BzIHtcbiAgY2xhc3M/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzVHJpZ2dlclByb3BzIHtcbiAgdmFsdWU6IHN0cmluZztcbiAgY2xhc3M/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzQ29udGVudFByb3BzIHtcbiAgdmFsdWU6IHN0cmluZztcbiAgY2xhc3M/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbn1cblxuLy8gQ29udGV4dCBmb3IgdGFicyBzdGF0ZVxuaW50ZXJmYWNlIFRhYnNDb250ZXh0VmFsdWUge1xuICBhY3RpdmVUYWI6ICgpID0+IHN0cmluZztcbiAgc2V0QWN0aXZlVGFiOiAoaWQ6IHN0cmluZykgPT4gdm9pZDtcbn1cblxuY29uc3QgVGFic0NvbnRleHQgPSBjcmVhdGVDb250ZXh0PFRhYnNDb250ZXh0VmFsdWU+KCk7XG5cbmV4cG9ydCBjb25zdCBUYWJzOiBQYXJlbnRDb21wb25lbnQ8VGFic1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbYWN0aXZlVGFiLCBzZXRBY3RpdmVUYWJdID0gY3JlYXRlU2lnbmFsKHByb3BzLmRlZmF1bHRUYWIgfHwgcHJvcHMudGFic1swXT8uaWQgfHwgJycpO1xuICBcbiAgXG4gIGNvbnN0IGhhbmRsZVRhYkNoYW5nZSA9IChpZDogc3RyaW5nKSA9PiB7XG4gICAgc2V0QWN0aXZlVGFiKGlkKTtcbiAgICBwcm9wcy5vblRhYkNoYW5nZT8uKGlkKTtcbiAgfTtcblxuICBjb25zdCBjb250ZXh0VmFsdWU6IFRhYnNDb250ZXh0VmFsdWUgPSB7XG4gICAgYWN0aXZlVGFiLFxuICAgIHNldEFjdGl2ZVRhYjogaGFuZGxlVGFiQ2hhbmdlXG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8VGFic0NvbnRleHQuUHJvdmlkZXIgdmFsdWU9e2NvbnRleHRWYWx1ZX0+XG4gICAgICA8ZGl2IGNsYXNzPXtjbigndy1mdWxsJywgcHJvcHMuY2xhc3MpfT5cbiAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgPC9kaXY+XG4gICAgPC9UYWJzQ29udGV4dC5Qcm92aWRlcj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBUYWJzTGlzdDogQ29tcG9uZW50PFRhYnNMaXN0UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBcbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2lubGluZS1mbGV4IGgtMTAgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbWQgYmctc3VyZmFjZSBwLTEgdGV4dC1zZWNvbmRhcnknLFxuICAgICAgICAndy1mdWxsJyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgIDwvZGl2PlxuICApO1xufTtcblxuZXhwb3J0IGNvbnN0IFRhYnNUcmlnZ2VyOiBDb21wb25lbnQ8VGFic1RyaWdnZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgY29udGV4dCA9IHVzZUNvbnRleHQoVGFic0NvbnRleHQpO1xuICBpZiAoIWNvbnRleHQpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbVGFic1RyaWdnZXJdIE5vIFRhYnNDb250ZXh0IGZvdW5kLiBUYWJzVHJpZ2dlciBtdXN0IGJlIHVzZWQgd2l0aGluIFRhYnMgY29tcG9uZW50LicpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIFxuICBjb25zdCBpc0FjdGl2ZSA9ICgpID0+IGNvbnRleHQuYWN0aXZlVGFiKCkgPT09IHByb3BzLnZhbHVlO1xuXG4gIHJldHVybiAoXG4gICAgPGJ1dHRvblxuICAgICAgb25DbGljaz17KCkgPT4gY29udGV4dC5zZXRBY3RpdmVUYWIocHJvcHMudmFsdWUpfVxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAnaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHdoaXRlc3BhY2Utbm93cmFwIHJvdW5kZWQtc20gcHgtMyBweS0xLjUnLFxuICAgICAgICAndGV4dC1zbSBmb250LW1lZGl1bSByaW5nLW9mZnNldC1iYXNlIHRyYW5zaXRpb24tYWxsJyxcbiAgICAgICAgJ2ZvY3VzLXZpc2libGU6b3V0bGluZS1ub25lIGZvY3VzLXZpc2libGU6cmluZy0yIGZvY3VzLXZpc2libGU6cmluZy1wdXJwbGUtNTAwIGZvY3VzLXZpc2libGU6cmluZy1vZmZzZXQtMicsXG4gICAgICAgICdkaXNhYmxlZDpwb2ludGVyLWV2ZW50cy1ub25lIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICAnZmxleC0xJyxcbiAgICAgICAgaXNBY3RpdmUoKVxuICAgICAgICAgID8gJ2JnLWJhc2UgdGV4dC1wcmltYXJ5IHNoYWRvdy1zbSdcbiAgICAgICAgICA6ICd0ZXh0LXNlY29uZGFyeSBob3Zlcjp0ZXh0LXByaW1hcnknLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgPC9idXR0b24+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgVGFic0NvbnRlbnQ6IENvbXBvbmVudDxUYWJzQ29udGVudFByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBjb250ZXh0ID0gdXNlQ29udGV4dChUYWJzQ29udGV4dCk7XG4gIGlmICghY29udGV4dCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1tUYWJzQ29udGVudF0gTm8gVGFic0NvbnRleHQgZm91bmQuIFRhYnNDb250ZW50IG11c3QgYmUgdXNlZCB3aXRoaW4gVGFicyBjb21wb25lbnQuJyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgXG4gIGNvbnN0IGlzQWN0aXZlID0gKCkgPT4gY29udGV4dC5hY3RpdmVUYWIoKSA9PT0gcHJvcHMudmFsdWU7XG4gIFxuICByZXR1cm4gKFxuICAgIDxTaG93IHdoZW49e2lzQWN0aXZlKCl9PlxuICAgICAgPGRpdlxuICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgJ210LTIgcmluZy1vZmZzZXQtYmFzZScsXG4gICAgICAgICAgJ2ZvY3VzLXZpc2libGU6b3V0bGluZS1ub25lIGZvY3VzLXZpc2libGU6cmluZy0yIGZvY3VzLXZpc2libGU6cmluZy1wdXJwbGUtNTAwIGZvY3VzLXZpc2libGU6cmluZy1vZmZzZXQtMicsXG4gICAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICAgKX1cbiAgICAgID5cbiAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgPC9kaXY+XG4gICAgPC9TaG93PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCwgU2hvdywgb25DbGVhbnVwIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCBzdHlsZXMgZnJvbSAnLi9GaXJlRW1vamlBbmltYXRpb24ubW9kdWxlLmNzcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmlyZUVtb2ppQW5pbWF0aW9uUHJvcHMge1xuICBzY29yZTogbnVtYmVyO1xuICBsaW5lSW5kZXg6IG51bWJlcjsgLy8gVXNlIGxpbmUgaW5kZXggaW5zdGVhZCBvZiB0cmlnZ2VyXG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgRmlyZUVtb2ppQW5pbWF0aW9uOiBDb21wb25lbnQ8RmlyZUVtb2ppQW5pbWF0aW9uUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtzaG93RmlyZSwgc2V0U2hvd0ZpcmVdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2ZpcmVYLCBzZXRGaXJlWF0gPSBjcmVhdGVTaWduYWwoNTApO1xuICBsZXQgbGFzdExpbmVJbmRleCA9IC0xO1xuICBsZXQgaGlkZVRpbWVyOiBudW1iZXIgfCB1bmRlZmluZWQ7XG4gIFxuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIC8vIENoZWNrIGlmIHdlIGhhdmUgYSBuZXcgbGluZSB3aXRoIGhpZ2ggc2NvcmVcbiAgICBpZiAocHJvcHMubGluZUluZGV4ID4gbGFzdExpbmVJbmRleCAmJiBwcm9wcy5zY29yZSA+PSA4MCkge1xuICAgICAgLy8gUmFuZG9tIFggcG9zaXRpb24gYmV0d2VlbiAyMCUgYW5kIDgwJVxuICAgICAgc2V0RmlyZVgoMjAgKyBNYXRoLnJhbmRvbSgpICogNjApO1xuICAgICAgc2V0U2hvd0ZpcmUodHJ1ZSk7XG4gICAgICBcbiAgICAgIC8vIENsZWFyIGV4aXN0aW5nIHRpbWVyXG4gICAgICBpZiAoaGlkZVRpbWVyKSBjbGVhclRpbWVvdXQoaGlkZVRpbWVyKTtcbiAgICAgIFxuICAgICAgLy8gSGlkZSBhZnRlciBhbmltYXRpb24gY29tcGxldGVzXG4gICAgICBoaWRlVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgc2V0U2hvd0ZpcmUoZmFsc2UpO1xuICAgICAgfSwgMjAwMCk7XG4gICAgICBcbiAgICAgIGxhc3RMaW5lSW5kZXggPSBwcm9wcy5saW5lSW5kZXg7XG4gICAgfVxuICB9KTtcbiAgXG4gIG9uQ2xlYW51cCgoKSA9PiB7XG4gICAgaWYgKGhpZGVUaW1lcikgY2xlYXJUaW1lb3V0KGhpZGVUaW1lcik7XG4gIH0pO1xuXG4gIHJldHVybiAoXG4gICAgPFNob3cgd2hlbj17c2hvd0ZpcmUoKX0+XG4gICAgICA8ZGl2IGNsYXNzPXtjbihzdHlsZXMuZmlyZUNvbnRhaW5lciwgcHJvcHMuY2xhc3MpfT5cbiAgICAgICAgPGRpdlxuICAgICAgICAgIGNsYXNzPXtzdHlsZXMuZmlyZUVtb2ppfVxuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBsZWZ0OiBgJHtmaXJlWCgpfSVgLFxuICAgICAgICAgICAgJ2ZvbnQtc2l6ZSc6ICczMnB4J1xuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICDwn5SlXG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9TaG93PlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93LCB0eXBlIENvbXBvbmVudCwgY3JlYXRlU2lnbmFsLCBjcmVhdGVFZmZlY3QgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB7IFNjb3JlUGFuZWwgfSBmcm9tICcuLi8uLi9kaXNwbGF5L1Njb3JlUGFuZWwnO1xuaW1wb3J0IHsgTHlyaWNzRGlzcGxheSwgdHlwZSBMeXJpY0xpbmUgfSBmcm9tICcuLi9MeXJpY3NEaXNwbGF5JztcbmltcG9ydCB7IExlYWRlcmJvYXJkUGFuZWwsIHR5cGUgTGVhZGVyYm9hcmRFbnRyeSB9IGZyb20gJy4uL0xlYWRlcmJvYXJkUGFuZWwnO1xuaW1wb3J0IHsgU3BsaXRCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vU3BsaXRCdXR0b24nO1xuaW1wb3J0IHR5cGUgeyBQbGF5YmFja1NwZWVkIH0gZnJvbSAnLi4vLi4vY29tbW9uL1NwbGl0QnV0dG9uJztcbmltcG9ydCB7IFRhYnMsIFRhYnNMaXN0LCBUYWJzVHJpZ2dlciwgVGFic0NvbnRlbnQgfSBmcm9tICcuLi8uLi9jb21tb24vVGFicyc7XG5pbXBvcnQgeyBGaXJlRW1vamlBbmltYXRpb24gfSBmcm9tICcuLi8uLi9lZmZlY3RzL0ZpcmVFbW9qaUFuaW1hdGlvbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXh0ZW5zaW9uS2FyYW9rZVZpZXdQcm9wcyB7XG4gIC8vIFNjb3Jlc1xuICBzY29yZTogbnVtYmVyO1xuICByYW5rOiBudW1iZXI7XG4gIFxuICAvLyBMeXJpY3NcbiAgbHlyaWNzOiBMeXJpY0xpbmVbXTtcbiAgY3VycmVudFRpbWU/OiBudW1iZXI7XG4gIFxuICAvLyBMZWFkZXJib2FyZFxuICBsZWFkZXJib2FyZDogTGVhZGVyYm9hcmRFbnRyeVtdO1xuICBcbiAgLy8gU3RhdGVcbiAgaXNQbGF5aW5nPzogYm9vbGVhbjtcbiAgaXNSZWNvcmRpbmc/OiBib29sZWFuO1xuICBvblN0YXJ0PzogKCkgPT4gdm9pZDtcbiAgb25TcGVlZENoYW5nZT86IChzcGVlZDogUGxheWJhY2tTcGVlZCkgPT4gdm9pZDtcbiAgXG4gIC8vIExpbmUgc2NvcmVzIGZvciB2aXN1YWwgZmVlZGJhY2tcbiAgbGluZVNjb3Jlcz86IEFycmF5PHsgbGluZUluZGV4OiBudW1iZXI7IHNjb3JlOiBudW1iZXI7IHRyYW5zY3JpcHRpb246IHN0cmluZzsgZmVlZGJhY2s/OiBzdHJpbmcgfT47XG4gIFxuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEV4dGVuc2lvbkthcmFva2VWaWV3OiBDb21wb25lbnQ8RXh0ZW5zaW9uS2FyYW9rZVZpZXdQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgLy8gR2V0IHRoZSBsYXRlc3QgaGlnaCBzY29yZSBsaW5lIGluZGV4XG4gIGNvbnN0IGdldExhdGVzdEhpZ2hTY29yZUxpbmUgPSAoKSA9PiB7XG4gICAgY29uc3Qgc2NvcmVzID0gcHJvcHMubGluZVNjb3JlcyB8fCBbXTtcbiAgICBpZiAoc2NvcmVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHsgc2NvcmU6IDAsIGxpbmVJbmRleDogLTEgfTtcbiAgICBcbiAgICBjb25zdCBsYXRlc3QgPSBzY29yZXNbc2NvcmVzLmxlbmd0aCAtIDFdO1xuICAgIHJldHVybiB7XG4gICAgICBzY29yZTogbGF0ZXN0Py5zY29yZSB8fCAwLFxuICAgICAgbGluZUluZGV4OiBsYXRlc3Q/LmxpbmVJbmRleCB8fCAtMVxuICAgIH07XG4gIH07XG4gIFxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sIGgtZnVsbCBiZy1iYXNlIHJlbGF0aXZlJywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBTY29yZSBQYW5lbCAtIG9ubHkgc2hvdyB3aGVuIG5vdCBwbGF5aW5nICovfVxuICAgICAgPFNob3cgd2hlbj17IXByb3BzLmlzUGxheWluZ30+XG4gICAgICAgIDxTY29yZVBhbmVsXG4gICAgICAgICAgc2NvcmU9e3Byb3BzLnNjb3JlfVxuICAgICAgICAgIHJhbms9e3Byb3BzLnJhbmt9XG4gICAgICAgIC8+XG4gICAgICA8L1Nob3c+XG5cbiAgICAgIHsvKiBTaG93IHRhYnMgb25seSB3aGVuIG5vdCBwbGF5aW5nICovfVxuICAgICAgPFNob3cgd2hlbj17IXByb3BzLmlzUGxheWluZ30gZmFsbGJhY2s9e1xuICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIGZsZXggZmxleC1jb2wgbWluLWgtMFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgbWluLWgtMCBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgIDxMeXJpY3NEaXNwbGF5XG4gICAgICAgICAgICAgIGx5cmljcz17cHJvcHMubHlyaWNzfVxuICAgICAgICAgICAgICBjdXJyZW50VGltZT17cHJvcHMuY3VycmVudFRpbWV9XG4gICAgICAgICAgICAgIGlzUGxheWluZz17cHJvcHMuaXNQbGF5aW5nfVxuICAgICAgICAgICAgICBsaW5lU2NvcmVzPXtwcm9wcy5saW5lU2NvcmVzfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICB9PlxuICAgICAgICB7LyogVGFicyBhbmQgY29udGVudCAqL31cbiAgICAgICAgPFRhYnMgXG4gICAgICAgICAgdGFicz17W1xuICAgICAgICAgICAgeyBpZDogJ2x5cmljcycsIGxhYmVsOiAnTHlyaWNzJyB9LFxuICAgICAgICAgICAgeyBpZDogJ2xlYWRlcmJvYXJkJywgbGFiZWw6ICdMZWFkZXJib2FyZCcgfVxuICAgICAgICAgIF19XG4gICAgICAgICAgZGVmYXVsdFRhYj1cImx5cmljc1wiXG4gICAgICAgICAgY2xhc3M9XCJmbGV4LTEgZmxleCBmbGV4LWNvbCBtaW4taC0wXCJcbiAgICAgICAgPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJweC00XCI+XG4gICAgICAgICAgICA8VGFic0xpc3Q+XG4gICAgICAgICAgICAgIDxUYWJzVHJpZ2dlciB2YWx1ZT1cImx5cmljc1wiPkx5cmljczwvVGFic1RyaWdnZXI+XG4gICAgICAgICAgICAgIDxUYWJzVHJpZ2dlciB2YWx1ZT1cImxlYWRlcmJvYXJkXCI+TGVhZGVyYm9hcmQ8L1RhYnNUcmlnZ2VyPlxuICAgICAgICAgICAgPC9UYWJzTGlzdD5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICBcbiAgICAgICAgICA8VGFic0NvbnRlbnQgdmFsdWU9XCJseXJpY3NcIiBjbGFzcz1cImZsZXgtMSBtaW4taC0wXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBmbGV4LWNvbCBoLWZ1bGxcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBtaW4taC0wIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgICAgIDxMeXJpY3NEaXNwbGF5XG4gICAgICAgICAgICAgICAgICBseXJpY3M9e3Byb3BzLmx5cmljc31cbiAgICAgICAgICAgICAgICAgIGN1cnJlbnRUaW1lPXtwcm9wcy5jdXJyZW50VGltZX1cbiAgICAgICAgICAgICAgICAgIGlzUGxheWluZz17cHJvcHMuaXNQbGF5aW5nfVxuICAgICAgICAgICAgICAgICAgbGluZVNjb3Jlcz17cHJvcHMubGluZVNjb3Jlc31cbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIHsvKiBGb290ZXIgd2l0aCBzdGFydCBidXR0b24gKi99XG4gICAgICAgICAgICAgIDxTaG93IHdoZW49eyFwcm9wcy5pc1BsYXlpbmcgJiYgcHJvcHMub25TdGFydH0+XG4gICAgICAgICAgICAgICAgPGRpdiBcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwicC00IGJnLXN1cmZhY2UgYm9yZGVyLXQgYm9yZGVyLXN1YnRsZVwiXG4gICAgICAgICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAgICAgICAnZmxleC1zaHJpbmsnOiAnMCdcbiAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPFNwbGl0QnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIG9uU3RhcnQ9e3Byb3BzLm9uU3RhcnR9XG4gICAgICAgICAgICAgICAgICAgIG9uU3BlZWRDaGFuZ2U9e3Byb3BzLm9uU3BlZWRDaGFuZ2V9XG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1RhYnNDb250ZW50PlxuICAgICAgICAgIFxuICAgICAgICAgIDxUYWJzQ29udGVudCB2YWx1ZT1cImxlYWRlcmJvYXJkXCIgY2xhc3M9XCJmbGV4LTEgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwib3ZlcmZsb3cteS1hdXRvIGgtZnVsbFwiPlxuICAgICAgICAgICAgICA8TGVhZGVyYm9hcmRQYW5lbCBlbnRyaWVzPXtwcm9wcy5sZWFkZXJib2FyZH0gLz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvVGFic0NvbnRlbnQ+XG4gICAgICAgIDwvVGFicz5cbiAgICAgIDwvU2hvdz5cbiAgICAgIFxuICAgICAgey8qIEZpcmUgZW1vamkgZWZmZWN0ICovfVxuICAgICAgPFNob3cgd2hlbj17cHJvcHMuaXNQbGF5aW5nfT5cbiAgICAgICAgPEZpcmVFbW9qaUFuaW1hdGlvbiBcbiAgICAgICAgICBzY29yZT17Z2V0TGF0ZXN0SGlnaFNjb3JlTGluZSgpLnNjb3JlfSBcbiAgICAgICAgICBsaW5lSW5kZXg9e2dldExhdGVzdEhpZ2hTY29yZUxpbmUoKS5saW5lSW5kZXh9XG4gICAgICAgIC8+XG4gICAgICA8L1Nob3c+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZUNvbnRleHQsIHVzZUNvbnRleHQsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlRWZmZWN0LCBjcmVhdGVNZW1vIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBQYXJlbnRDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IFRyYW5zbGF0aW9ucywgTG9jYWxlQ29kZSB9IGZyb20gJy4vdHlwZXMnO1xuXG5pbnRlcmZhY2UgSTE4bkNvbnRleHRWYWx1ZSB7XG4gIGxvY2FsZTogKCkgPT4gTG9jYWxlQ29kZTtcbiAgc2V0TG9jYWxlOiAobG9jYWxlOiBMb2NhbGVDb2RlKSA9PiB2b2lkO1xuICB0OiAoa2V5OiBzdHJpbmcsIHBhcmFtcz86IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IHN0cmluZztcbiAgZGlyOiAoKSA9PiAnbHRyJyB8ICdydGwnO1xuICBmb3JtYXROdW1iZXI6IChudW06IG51bWJlcikgPT4gc3RyaW5nO1xuICBmb3JtYXREYXRlOiAoZGF0ZTogRGF0ZSwgb3B0aW9ucz86IEludGwuRGF0ZVRpbWVGb3JtYXRPcHRpb25zKSA9PiBzdHJpbmc7XG59XG5cbmNvbnN0IEkxOG5Db250ZXh0ID0gY3JlYXRlQ29udGV4dDxJMThuQ29udGV4dFZhbHVlPigpO1xuXG5leHBvcnQgY29uc3QgSTE4blByb3ZpZGVyOiBQYXJlbnRDb21wb25lbnQ8eyBkZWZhdWx0TG9jYWxlPzogTG9jYWxlQ29kZSB9PiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbbG9jYWxlLCBzZXRMb2NhbGVdID0gY3JlYXRlU2lnbmFsPExvY2FsZUNvZGU+KHByb3BzLmRlZmF1bHRMb2NhbGUgfHwgJ2VuJyk7XG4gIGNvbnN0IFt0cmFuc2xhdGlvbnMsIHNldFRyYW5zbGF0aW9uc10gPSBjcmVhdGVTaWduYWw8VHJhbnNsYXRpb25zPigpO1xuICBcbiAgLy8gTG9hZCB0cmFuc2xhdGlvbnMgZHluYW1pY2FsbHlcbiAgY3JlYXRlRWZmZWN0KGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBjdXJyZW50TG9jYWxlID0gbG9jYWxlKCk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1vZHVsZSA9IGF3YWl0IGltcG9ydChgLi9sb2NhbGVzLyR7Y3VycmVudExvY2FsZX0vaW5kZXgudHNgKTtcbiAgICAgIHNldFRyYW5zbGF0aW9ucyhtb2R1bGUuZGVmYXVsdCk7XG4gICAgfSBjYXRjaCAoX2UpIHtcbiAgICAgIGNvbnNvbGUud2FybihgRmFpbGVkIHRvIGxvYWQgbG9jYWxlICR7Y3VycmVudExvY2FsZX0sIGZhbGxpbmcgYmFjayB0byBFbmdsaXNoYCk7XG4gICAgICBjb25zdCBtb2R1bGUgPSBhd2FpdCBpbXBvcnQoJy4vbG9jYWxlcy9lbi9pbmRleC50cycpO1xuICAgICAgc2V0VHJhbnNsYXRpb25zKG1vZHVsZS5kZWZhdWx0KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIERlZXAga2V5IGFjY2VzcyB3aXRoIGRvdCBub3RhdGlvblxuICBjb25zdCB0ID0gKGtleTogc3RyaW5nLCBwYXJhbXM/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiB7XG4gICAgY29uc3Qga2V5cyA9IGtleS5zcGxpdCgnLicpO1xuICAgIGxldCB2YWx1ZTogYW55ID0gdHJhbnNsYXRpb25zKCk7XG4gICAgXG4gICAgZm9yIChjb25zdCBrIG9mIGtleXMpIHtcbiAgICAgIHZhbHVlID0gdmFsdWU/LltrXTtcbiAgICB9XG4gICAgXG4gICAgLy8gSGFuZGxlIHBhcmFtZXRlciByZXBsYWNlbWVudFxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHBhcmFtcykge1xuICAgICAgcmV0dXJuIHZhbHVlLnJlcGxhY2UoL1xce1xceyhcXHcrKVxcfVxcfS9nLCAoXywgaykgPT4gU3RyaW5nKHBhcmFtc1trXSB8fCAnJykpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gdmFsdWUgfHwga2V5O1xuICB9O1xuXG4gIC8vIERpcmVjdGlvbiAoZm9yIFJUTCBsYW5ndWFnZXMgaW4gZnV0dXJlKVxuICBjb25zdCBkaXIgPSAoKTogJ2x0cicgfCAncnRsJyA9PiAnbHRyJzsgLy8gT25seSBMVFIgbGFuZ3VhZ2VzIHN1cHBvcnRlZCBjdXJyZW50bHlcblxuICAvLyBOdW1iZXIgZm9ybWF0dGluZ1xuICBjb25zdCBudW1iZXJGb3JtYXR0ZXIgPSBjcmVhdGVNZW1vKCgpID0+IFxuICAgIG5ldyBJbnRsLk51bWJlckZvcm1hdChsb2NhbGUoKSlcbiAgKTtcblxuICBjb25zdCBmb3JtYXROdW1iZXIgPSAobnVtOiBudW1iZXIpID0+IG51bWJlckZvcm1hdHRlcigpLmZvcm1hdChudW0pO1xuXG4gIC8vIERhdGUgZm9ybWF0dGluZ1xuICBjb25zdCBmb3JtYXREYXRlID0gKGRhdGU6IERhdGUsIG9wdGlvbnM/OiBJbnRsLkRhdGVUaW1lRm9ybWF0T3B0aW9ucykgPT4ge1xuICAgIHJldHVybiBuZXcgSW50bC5EYXRlVGltZUZvcm1hdChsb2NhbGUoKSwgb3B0aW9ucykuZm9ybWF0KGRhdGUpO1xuICB9O1xuXG4gIGNvbnN0IHZhbHVlOiBJMThuQ29udGV4dFZhbHVlID0ge1xuICAgIGxvY2FsZSxcbiAgICBzZXRMb2NhbGUsXG4gICAgdCxcbiAgICBkaXIsXG4gICAgZm9ybWF0TnVtYmVyLFxuICAgIGZvcm1hdERhdGUsXG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8STE4bkNvbnRleHQuUHJvdmlkZXIgdmFsdWU9e3ZhbHVlfT5cbiAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICA8L0kxOG5Db250ZXh0LlByb3ZpZGVyPlxuICApO1xufTtcblxuZXhwb3J0IGNvbnN0IHVzZUkxOG4gPSAoKSA9PiB7XG4gIGNvbnN0IGNvbnRleHQgPSB1c2VDb250ZXh0KEkxOG5Db250ZXh0KTtcbiAgaWYgKCFjb250ZXh0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd1c2VJMThuIG11c3QgYmUgdXNlZCB3aXRoaW4gSTE4blByb3ZpZGVyJyk7XG4gIH1cbiAgcmV0dXJuIGNvbnRleHQ7XG59OyIsImltcG9ydCB7IFNob3csIGNyZWF0ZU1lbW8gfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuaW1wb3J0IHR5cGUgeyBQbGF5YmFja1NwZWVkIH0gZnJvbSAnLi4vLi4vY29tbW9uL1NwbGl0QnV0dG9uJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9CdXR0b24nO1xuaW1wb3J0IHsgdXNlSTE4biB9IGZyb20gJy4uLy4uLy4uL2kxOG4nO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbXBsZXRpb25WaWV3UHJvcHMge1xuICBzY29yZTogbnVtYmVyO1xuICByYW5rOiBudW1iZXI7XG4gIHNwZWVkOiBQbGF5YmFja1NwZWVkO1xuICBmZWVkYmFja1RleHQ/OiBzdHJpbmc7XG4gIG9uUHJhY3RpY2U/OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IENvbXBsZXRpb25WaWV3OiBDb21wb25lbnQ8Q29tcGxldGlvblZpZXdQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgeyB0LCBmb3JtYXROdW1iZXIgfSA9IHVzZUkxOG4oKTtcbiAgXG4gIC8vIEdldCBmZWVkYmFjayB0ZXh0IGJhc2VkIG9uIHNjb3JlXG4gIGNvbnN0IGdldEZlZWRiYWNrVGV4dCA9IGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGlmIChwcm9wcy5mZWVkYmFja1RleHQpIHJldHVybiBwcm9wcy5mZWVkYmFja1RleHQ7XG4gICAgXG4gICAgaWYgKHByb3BzLnNjb3JlID49IDk1KSByZXR1cm4gdCgna2FyYW9rZS5zY29yaW5nLnBlcmZlY3QnKTtcbiAgICBpZiAocHJvcHMuc2NvcmUgPj0gODUpIHJldHVybiB0KCdrYXJhb2tlLnNjb3JpbmcuZXhjZWxsZW50Jyk7XG4gICAgaWYgKHByb3BzLnNjb3JlID49IDcwKSByZXR1cm4gdCgna2FyYW9rZS5zY29yaW5nLmdyZWF0Jyk7XG4gICAgaWYgKHByb3BzLnNjb3JlID49IDUwKSByZXR1cm4gdCgna2FyYW9rZS5zY29yaW5nLmdvb2QnKTtcbiAgICByZXR1cm4gdCgna2FyYW9rZS5zY29yaW5nLmtlZXBQcmFjdGljaW5nJyk7XG4gIH0pO1xuICBcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZmxleCBmbGV4LWNvbCBoLWZ1bGwgYmctYmFzZScsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogTWFpbiBjb250ZW50IGFyZWEgKi99XG4gICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHAtNlwiPlxuICAgICAgICB7LyogU2NvcmUgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBmbGV4IGZsZXgtY29sIG1iLTEwXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtbGcgdGV4dC1zZWNvbmRhcnkgbWItMyBvcmRlci0xXCI+e3QoJ2thcmFva2Uuc2NvcmluZy5zY29yZScpfTwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTd4bCBmb250LW1vbm8gZm9udC1ib2xkIHRleHQtYWNjZW50LXByaW1hcnkgb3JkZXItMlwiPlxuICAgICAgICAgICAge2Zvcm1hdE51bWJlcihwcm9wcy5zY29yZSl9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICBcbiAgICAgICAgey8qIFN0YXRzIHJvdyAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZ2FwLTEyIG1iLTEyXCI+XG4gICAgICAgICAgey8qIFJhbmsgKi99XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIGZsZXggZmxleC1jb2xcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5IG1iLTIgb3JkZXItMVwiPlJhbms8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTN4bCBmb250LWJvbGQgdGV4dC1wcmltYXJ5IG9yZGVyLTJcIj4je2Zvcm1hdE51bWJlcihwcm9wcy5yYW5rKX08L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICBcbiAgICAgICAgICB7LyogU3BlZWQgKi99XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIGZsZXggZmxleC1jb2xcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5IG1iLTIgb3JkZXItMVwiPnt0KCdjb21tb24uc3BlZWQubGFiZWwnKX08L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTN4bCBmb250LWJvbGQgdGV4dC1wcmltYXJ5IG9yZGVyLTJcIj57cHJvcHMuc3BlZWR9PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICBcbiAgICAgICAgey8qIEZlZWRiYWNrIHRleHQgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy1tZCB0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC14bCB0ZXh0LXByaW1hcnkgbGVhZGluZy1yZWxheGVkXCI+XG4gICAgICAgICAgICB7Z2V0RmVlZGJhY2tUZXh0KCl9XG4gICAgICAgICAgPC9wPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgXG4gICAgICB7LyogRm9vdGVyIHdpdGggcHJhY3RpY2UgYnV0dG9uIC0gcG9zaXRpb25lZCBhdCBib3R0b20gb2Ygd2lkZ2V0ICovfVxuICAgICAgPFNob3cgd2hlbj17cHJvcHMub25QcmFjdGljZX0+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJwLTQgYmctc3VyZmFjZSBib3JkZXItdCBib3JkZXItc3VidGxlXCI+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgdmFyaWFudD1cInByaW1hcnlcIlxuICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgIGZ1bGxXaWR0aFxuICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25QcmFjdGljZX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICBQcmFjdGljZSBFcnJvcnNcbiAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L1Nob3c+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCwgb25DbGVhbnVwIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBBdWRpb1Byb2Nlc3Nvck9wdGlvbnMgfSBmcm9tICdAc2NhcmxldHQvY29yZSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVLYXJhb2tlQXVkaW9Qcm9jZXNzb3Iob3B0aW9ucz86IEF1ZGlvUHJvY2Vzc29yT3B0aW9ucykge1xuICBjb25zdCBbYXVkaW9Db250ZXh0LCBzZXRBdWRpb0NvbnRleHRdID0gY3JlYXRlU2lnbmFsPEF1ZGlvQ29udGV4dCB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbbWVkaWFTdHJlYW0sIHNldE1lZGlhU3RyZWFtXSA9IGNyZWF0ZVNpZ25hbDxNZWRpYVN0cmVhbSB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbLCBzZXRBdWRpb1dvcmtsZXROb2RlXSA9IGNyZWF0ZVNpZ25hbDxBdWRpb1dvcmtsZXROb2RlIHwgbnVsbD4obnVsbCk7XG4gIFxuICBjb25zdCBbaXNSZWFkeSwgc2V0SXNSZWFkeV0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IGNyZWF0ZVNpZ25hbDxFcnJvciB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbaXNMaXN0ZW5pbmcsIHNldElzTGlzdGVuaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIFxuICBjb25zdCBbY3VycmVudFJlY29yZGluZ0xpbmUsIHNldEN1cnJlbnRSZWNvcmRpbmdMaW5lXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW3JlY29yZGVkQXVkaW9CdWZmZXIsIHNldFJlY29yZGVkQXVkaW9CdWZmZXJdID0gY3JlYXRlU2lnbmFsPEZsb2F0MzJBcnJheVtdPihbXSk7XG4gIFxuICBjb25zdCBbaXNTZXNzaW9uQWN0aXZlLCBzZXRJc1Nlc3Npb25BY3RpdmVdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2Z1bGxTZXNzaW9uQnVmZmVyLCBzZXRGdWxsU2Vzc2lvbkJ1ZmZlcl0gPSBjcmVhdGVTaWduYWw8RmxvYXQzMkFycmF5W10+KFtdKTtcbiAgXG4gIGNvbnN0IHNhbXBsZVJhdGUgPSBvcHRpb25zPy5zYW1wbGVSYXRlIHx8IDE2MDAwO1xuICBcbiAgY29uc3QgaW5pdGlhbGl6ZSA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoYXVkaW9Db250ZXh0KCkpIHJldHVybjtcbiAgICBzZXRFcnJvcihudWxsKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgXG4gICAgICBjb25zdCBjdHggPSBuZXcgQXVkaW9Db250ZXh0KHsgc2FtcGxlUmF0ZSB9KTtcbiAgICAgIHNldEF1ZGlvQ29udGV4dChjdHgpO1xuICAgICAgXG4gICAgICBjb25zdCBzdHJlYW0gPSBhd2FpdCBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSh7XG4gICAgICAgIGF1ZGlvOiB7XG4gICAgICAgICAgc2FtcGxlUmF0ZSxcbiAgICAgICAgICBjaGFubmVsQ291bnQ6IDEsXG4gICAgICAgICAgZWNob0NhbmNlbGxhdGlvbjogZmFsc2UsXG4gICAgICAgICAgbm9pc2VTdXBwcmVzc2lvbjogZmFsc2UsXG4gICAgICAgICAgYXV0b0dhaW5Db250cm9sOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0TWVkaWFTdHJlYW0oc3RyZWFtKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY3R4LmF1ZGlvV29ya2xldC5hZGRNb2R1bGUoY3JlYXRlQXVkaW9Xb3JrbGV0UHJvY2Vzc29yKCkpO1xuICAgICAgXG4gICAgICBjb25zdCB3b3JrbGV0Tm9kZSA9IG5ldyBBdWRpb1dvcmtsZXROb2RlKGN0eCwgJ2thcmFva2UtYXVkaW8tcHJvY2Vzc29yJywge1xuICAgICAgICBudW1iZXJPZklucHV0czogMSxcbiAgICAgICAgbnVtYmVyT2ZPdXRwdXRzOiAwLFxuICAgICAgICBjaGFubmVsQ291bnQ6IDEsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgd29ya2xldE5vZGUucG9ydC5vbm1lc3NhZ2UgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgaWYgKGV2ZW50LmRhdGEudHlwZSA9PT0gJ2F1ZGlvRGF0YScpIHtcbiAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KGV2ZW50LmRhdGEuYXVkaW9EYXRhKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoY3VycmVudFJlY29yZGluZ0xpbmUoKSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgc2V0UmVjb3JkZWRBdWRpb0J1ZmZlcigocHJldikgPT4gWy4uLnByZXYsIGF1ZGlvRGF0YV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoaXNTZXNzaW9uQWN0aXZlKCkpIHtcbiAgICAgICAgICAgIHNldEZ1bGxTZXNzaW9uQnVmZmVyKChwcmV2KSA9PiBbLi4ucHJldiwgYXVkaW9EYXRhXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgXG4gICAgICBzZXRBdWRpb1dvcmtsZXROb2RlKHdvcmtsZXROb2RlKTtcbiAgICAgIFxuICAgICAgY29uc3Qgc291cmNlID0gY3R4LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG4gICAgICBjb25zdCBnYWluTm9kZSA9IGN0eC5jcmVhdGVHYWluKCk7XG4gICAgICBnYWluTm9kZS5nYWluLnZhbHVlID0gMS4yO1xuICAgICAgXG4gICAgICBzb3VyY2UuY29ubmVjdChnYWluTm9kZSk7XG4gICAgICBnYWluTm9kZS5jb25uZWN0KHdvcmtsZXROb2RlKTtcbiAgICAgIFxuICAgICAgc2V0SXNSZWFkeSh0cnVlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBGYWlsZWQgdG8gaW5pdGlhbGl6ZTonLCBlKTtcbiAgICAgIHNldEVycm9yKGUgaW5zdGFuY2VvZiBFcnJvciA/IGUgOiBuZXcgRXJyb3IoJ1Vua25vd24gYXVkaW8gaW5pdGlhbGl6YXRpb24gZXJyb3InKSk7XG4gICAgICBzZXRJc1JlYWR5KGZhbHNlKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBjcmVhdGVBdWRpb1dvcmtsZXRQcm9jZXNzb3IgPSAoKSA9PiB7XG4gICAgY29uc3QgcHJvY2Vzc29yQ29kZSA9IGBcbiAgICAgIGNsYXNzIEthcmFva2VBdWRpb1Byb2Nlc3NvciBleHRlbmRzIEF1ZGlvV29ya2xldFByb2Nlc3NvciB7XG4gICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgIHN1cGVyKCk7XG4gICAgICAgICAgdGhpcy5idWZmZXJTaXplID0gMTAyNDtcbiAgICAgICAgICB0aGlzLnJtc0hpc3RvcnkgPSBbXTtcbiAgICAgICAgICB0aGlzLm1heEhpc3RvcnlMZW5ndGggPSAxMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3MoaW5wdXRzLCBvdXRwdXRzLCBwYXJhbWV0ZXJzKSB7XG4gICAgICAgICAgY29uc3QgaW5wdXQgPSBpbnB1dHNbMF07XG4gICAgICAgICAgaWYgKGlucHV0ICYmIGlucHV0WzBdKSB7XG4gICAgICAgICAgICBjb25zdCBpbnB1dERhdGEgPSBpbnB1dFswXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHN1bSA9IDA7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0RGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBzdW0gKz0gaW5wdXREYXRhW2ldICogaW5wdXREYXRhW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgcm1zID0gTWF0aC5zcXJ0KHN1bSAvIGlucHV0RGF0YS5sZW5ndGgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLnJtc0hpc3RvcnkucHVzaChybXMpO1xuICAgICAgICAgICAgaWYgKHRoaXMucm1zSGlzdG9yeS5sZW5ndGggPiB0aGlzLm1heEhpc3RvcnlMZW5ndGgpIHtcbiAgICAgICAgICAgICAgdGhpcy5ybXNIaXN0b3J5LnNoaWZ0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGF2Z1JtcyA9IHRoaXMucm1zSGlzdG9yeS5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLCAwKSAvIHRoaXMucm1zSGlzdG9yeS5sZW5ndGg7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMucG9ydC5wb3N0TWVzc2FnZSh7XG4gICAgICAgICAgICAgIHR5cGU6ICdhdWRpb0RhdGEnLFxuICAgICAgICAgICAgICBhdWRpb0RhdGE6IGlucHV0RGF0YSxcbiAgICAgICAgICAgICAgcm1zTGV2ZWw6IHJtcyxcbiAgICAgICAgICAgICAgYXZnUm1zTGV2ZWw6IGF2Z1JtcyxcbiAgICAgICAgICAgICAgaXNUb29RdWlldDogYXZnUm1zIDwgMC4wMSxcbiAgICAgICAgICAgICAgaXNUb29Mb3VkOiBhdmdSbXMgPiAwLjNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmVnaXN0ZXJQcm9jZXNzb3IoJ2thcmFva2UtYXVkaW8tcHJvY2Vzc29yJywgS2FyYW9rZUF1ZGlvUHJvY2Vzc29yKTtcbiAgICBgO1xuICAgIFxuICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbcHJvY2Vzc29yQ29kZV0sIHsgdHlwZTogJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnIH0pO1xuICAgIHJldHVybiBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuICB9O1xuICBcbiAgY29uc3Qgc3RhcnRMaXN0ZW5pbmcgPSAoKSA9PiB7XG4gICAgY29uc3QgY3R4ID0gYXVkaW9Db250ZXh0KCk7XG4gICAgaWYgKGN0eCAmJiBjdHguc3RhdGUgPT09ICdzdXNwZW5kZWQnKSB7XG4gICAgICBjdHgucmVzdW1lKCk7XG4gICAgfVxuICAgIHNldElzTGlzdGVuaW5nKHRydWUpO1xuICB9O1xuICBcbiAgY29uc3QgcGF1c2VMaXN0ZW5pbmcgPSAoKSA9PiB7XG4gICAgY29uc3QgY3R4ID0gYXVkaW9Db250ZXh0KCk7XG4gICAgaWYgKGN0eCAmJiBjdHguc3RhdGUgPT09ICdydW5uaW5nJykge1xuICAgICAgY3R4LnN1c3BlbmQoKTtcbiAgICB9XG4gICAgc2V0SXNMaXN0ZW5pbmcoZmFsc2UpO1xuICB9O1xuICBcbiAgY29uc3QgY2xlYW51cCA9ICgpID0+IHtcbiAgICBcbiAgICBjb25zdCBzdHJlYW0gPSBtZWRpYVN0cmVhbSgpO1xuICAgIGlmIChzdHJlYW0pIHtcbiAgICAgIHN0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKCh0cmFjaykgPT4gdHJhY2suc3RvcCgpKTtcbiAgICAgIHNldE1lZGlhU3RyZWFtKG51bGwpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBjdHggPSBhdWRpb0NvbnRleHQoKTtcbiAgICBpZiAoY3R4ICYmIGN0eC5zdGF0ZSAhPT0gJ2Nsb3NlZCcpIHtcbiAgICAgIGN0eC5jbG9zZSgpO1xuICAgICAgc2V0QXVkaW9Db250ZXh0KG51bGwpO1xuICAgIH1cbiAgICBcbiAgICBzZXRBdWRpb1dvcmtsZXROb2RlKG51bGwpO1xuICAgIHNldElzUmVhZHkoZmFsc2UpO1xuICAgIHNldElzTGlzdGVuaW5nKGZhbHNlKTtcbiAgfTtcbiAgXG4gIG9uQ2xlYW51cChjbGVhbnVwKTtcbiAgXG4gIGNvbnN0IHN0YXJ0UmVjb3JkaW5nTGluZSA9IChsaW5lSW5kZXg6IG51bWJlcikgPT4ge1xuICAgIFxuICAgIHNldEN1cnJlbnRSZWNvcmRpbmdMaW5lKGxpbmVJbmRleCk7XG4gICAgc2V0UmVjb3JkZWRBdWRpb0J1ZmZlcihbXSk7XG4gICAgXG4gICAgaWYgKGlzUmVhZHkoKSAmJiAhaXNMaXN0ZW5pbmcoKSkge1xuICAgICAgc3RhcnRMaXN0ZW5pbmcoKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBzdG9wUmVjb3JkaW5nTGluZUFuZEdldFJhd0F1ZGlvID0gKCk6IEZsb2F0MzJBcnJheVtdID0+IHtcbiAgICBjb25zdCBsaW5lSW5kZXggPSBjdXJyZW50UmVjb3JkaW5nTGluZSgpO1xuICAgIGlmIChsaW5lSW5kZXggPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYXVkaW9CdWZmZXIgPSByZWNvcmRlZEF1ZGlvQnVmZmVyKCk7XG4gICAgXG4gICAgc2V0Q3VycmVudFJlY29yZGluZ0xpbmUobnVsbCk7XG4gICAgXG4gICAgY29uc3QgcmVzdWx0ID0gWy4uLmF1ZGlvQnVmZmVyXTtcbiAgICBzZXRSZWNvcmRlZEF1ZGlvQnVmZmVyKFtdKTtcbiAgICBcbiAgICBpZiAocmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuICBcbiAgY29uc3QgY29udmVydEF1ZGlvVG9XYXZCbG9iID0gKGF1ZGlvQ2h1bmtzOiBGbG9hdDMyQXJyYXlbXSk6IEJsb2IgfCBudWxsID0+IHtcbiAgICBpZiAoYXVkaW9DaHVua3MubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcbiAgICBcbiAgICBjb25zdCB0b3RhbExlbmd0aCA9IGF1ZGlvQ2h1bmtzLnJlZHVjZSgoc3VtLCBjaHVuaykgPT4gc3VtICsgY2h1bmsubGVuZ3RoLCAwKTtcbiAgICBjb25zdCBjb25jYXRlbmF0ZWQgPSBuZXcgRmxvYXQzMkFycmF5KHRvdGFsTGVuZ3RoKTtcbiAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICBmb3IgKGNvbnN0IGNodW5rIG9mIGF1ZGlvQ2h1bmtzKSB7XG4gICAgICBjb25jYXRlbmF0ZWQuc2V0KGNodW5rLCBvZmZzZXQpO1xuICAgICAgb2Zmc2V0ICs9IGNodW5rLmxlbmd0aDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGF1ZGlvQnVmZmVyVG9XYXYoY29uY2F0ZW5hdGVkLCBzYW1wbGVSYXRlKTtcbiAgfTtcbiAgXG4gIGNvbnN0IGF1ZGlvQnVmZmVyVG9XYXYgPSAoYnVmZmVyOiBGbG9hdDMyQXJyYXksIHNhbXBsZVJhdGU6IG51bWJlcik6IEJsb2IgPT4ge1xuICAgIGNvbnN0IGxlbmd0aCA9IGJ1ZmZlci5sZW5ndGg7XG4gICAgY29uc3QgYXJyYXlCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoNDQgKyBsZW5ndGggKiAyKTtcbiAgICBjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGFycmF5QnVmZmVyKTtcbiAgICBcbiAgICBjb25zdCB3cml0ZVN0cmluZyA9IChvZmZzZXQ6IG51bWJlciwgc3RyaW5nOiBzdHJpbmcpID0+IHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyaW5nLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZpZXcuc2V0VWludDgob2Zmc2V0ICsgaSwgc3RyaW5nLmNoYXJDb2RlQXQoaSkpO1xuICAgICAgfVxuICAgIH07XG4gICAgXG4gICAgd3JpdGVTdHJpbmcoMCwgJ1JJRkYnKTtcbiAgICB2aWV3LnNldFVpbnQzMig0LCAzNiArIGxlbmd0aCAqIDIsIHRydWUpO1xuICAgIHdyaXRlU3RyaW5nKDgsICdXQVZFJyk7XG4gICAgd3JpdGVTdHJpbmcoMTIsICdmbXQgJyk7XG4gICAgdmlldy5zZXRVaW50MzIoMTYsIDE2LCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigyMCwgMSwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMjIsIDEsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDMyKDI0LCBzYW1wbGVSYXRlLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQzMigyOCwgc2FtcGxlUmF0ZSAqIDIsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDMyLCAyLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigzNCwgMTYsIHRydWUpO1xuICAgIHdyaXRlU3RyaW5nKDM2LCAnZGF0YScpO1xuICAgIHZpZXcuc2V0VWludDMyKDQwLCBsZW5ndGggKiAyLCB0cnVlKTtcbiAgICBcbiAgICBjb25zdCBvZmZzZXQgPSA0NDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBzYW1wbGUgPSBNYXRoLm1heCgtMSwgTWF0aC5taW4oMSwgYnVmZmVyW2ldIHx8IDApKTtcbiAgICAgIHZpZXcuc2V0SW50MTYob2Zmc2V0ICsgaSAqIDIsIHNhbXBsZSAqIDB4N2ZmZiwgdHJ1ZSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBuZXcgQmxvYihbYXJyYXlCdWZmZXJdLCB7IHR5cGU6ICdhdWRpby93YXYnIH0pO1xuICB9O1xuICBcbiAgY29uc3Qgc3RhcnRGdWxsU2Vzc2lvbiA9ICgpID0+IHtcbiAgICBzZXRGdWxsU2Vzc2lvbkJ1ZmZlcihbXSk7XG4gICAgc2V0SXNTZXNzaW9uQWN0aXZlKHRydWUpO1xuICB9O1xuICBcbiAgY29uc3Qgc3RvcEZ1bGxTZXNzaW9uQW5kR2V0V2F2ID0gKCk6IEJsb2IgfCBudWxsID0+IHtcbiAgICBzZXRJc1Nlc3Npb25BY3RpdmUoZmFsc2UpO1xuICAgIFxuICAgIGNvbnN0IHNlc3Npb25DaHVua3MgPSBmdWxsU2Vzc2lvbkJ1ZmZlcigpO1xuICAgIGNvbnN0IHdhdkJsb2IgPSBjb252ZXJ0QXVkaW9Ub1dhdkJsb2Ioc2Vzc2lvbkNodW5rcyk7XG4gICAgXG4gICAgXG4gICAgc2V0RnVsbFNlc3Npb25CdWZmZXIoW10pO1xuICAgIFxuICAgIHJldHVybiB3YXZCbG9iO1xuICB9O1xuICBcbiAgcmV0dXJuIHtcbiAgICBpc1JlYWR5LFxuICAgIGVycm9yLFxuICAgIGlzTGlzdGVuaW5nLFxuICAgIGlzU2Vzc2lvbkFjdGl2ZSxcbiAgICBcbiAgICBpbml0aWFsaXplLFxuICAgIHN0YXJ0TGlzdGVuaW5nLFxuICAgIHBhdXNlTGlzdGVuaW5nLFxuICAgIGNsZWFudXAsXG4gICAgc3RhcnRSZWNvcmRpbmdMaW5lLFxuICAgIHN0b3BSZWNvcmRpbmdMaW5lQW5kR2V0UmF3QXVkaW8sXG4gICAgY29udmVydEF1ZGlvVG9XYXZCbG9iLFxuICAgIFxuICAgIHN0YXJ0RnVsbFNlc3Npb24sXG4gICAgc3RvcEZ1bGxTZXNzaW9uQW5kR2V0V2F2LFxuICB9O1xufSIsImltcG9ydCB0eXBlIHtcbiAgQXBpUmVzcG9uc2UsXG4gIFN0YXJ0U2Vzc2lvblJlcXVlc3QsXG4gIEdyYWRlTGluZVJlcXVlc3QsXG4gIENvbXBsZXRlU2Vzc2lvblJlcXVlc3QsXG4gIFRyYW5zY3JpYmVSZXF1ZXN0LFxuICBUcmFuc2NyaWJlUmVzcG9uc2UsXG4gIEthcmFva2VEYXRhLFxuICBLYXJhb2tlU2Vzc2lvbixcbiAgTGluZVNjb3JlLFxuICBTZXNzaW9uUmVzdWx0cyxcbiAgRGVtb1Rva2VuUmVzcG9uc2UsXG4gIFVzZXJDcmVkaXRzUmVzcG9uc2UsXG4gIFB1cmNoYXNlQ3JlZGl0c1JlcXVlc3QsXG4gIFB1cmNoYXNlQ3JlZGl0c1Jlc3BvbnNlLFxuICBFeGVyY2lzZSxcbiAgUHJhY3RpY2VDYXJkLFxufSBmcm9tICdAc2NhcmxldHQvY29yZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXBpQ2xpZW50Q29uZmlnIHtcbiAgYmFzZVVybDogc3RyaW5nO1xuICBnZXRBdXRoVG9rZW4/OiAoKSA9PiBQcm9taXNlPHN0cmluZyB8IG51bGw+O1xuICBvbkVycm9yPzogKGVycm9yOiBFcnJvcikgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIEFwaUNsaWVudCB7XG4gIHByaXZhdGUgYmFzZVVybDogc3RyaW5nO1xuICBwcml2YXRlIGdldEF1dGhUb2tlbj86ICgpID0+IFByb21pc2U8c3RyaW5nIHwgbnVsbD47XG4gIHByaXZhdGUgb25FcnJvcj86IChlcnJvcjogRXJyb3IpID0+IHZvaWQ7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnOiBBcGlDbGllbnRDb25maWcpIHtcbiAgICB0aGlzLmJhc2VVcmwgPSBjb25maWcuYmFzZVVybC5yZXBsYWNlKC9cXC8kLywgJycpOyAvLyBSZW1vdmUgdHJhaWxpbmcgc2xhc2hcbiAgICB0aGlzLmdldEF1dGhUb2tlbiA9IGNvbmZpZy5nZXRBdXRoVG9rZW47XG4gICAgdGhpcy5vbkVycm9yID0gY29uZmlnLm9uRXJyb3I7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlcXVlc3Q8VD4oXG4gICAgcGF0aDogc3RyaW5nLFxuICAgIG9wdGlvbnM6IFJlcXVlc3RJbml0ID0ge31cbiAgKTogUHJvbWlzZTxUPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIC4uLihvcHRpb25zLmhlYWRlcnMgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPiB8fCB7fSksXG4gICAgICB9O1xuXG4gICAgICAvLyBBZGQgYXV0aCB0b2tlbiBpZiBhdmFpbGFibGVcbiAgICAgIGlmICh0aGlzLmdldEF1dGhUb2tlbikge1xuICAgICAgICBjb25zdCB0b2tlbiA9IGF3YWl0IHRoaXMuZ2V0QXV0aFRva2VuKCk7XG4gICAgICAgIGlmICh0b2tlbikge1xuICAgICAgICAgIGhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9IGBCZWFyZXIgJHt0b2tlbn1gO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7dGhpcy5iYXNlVXJsfSR7cGF0aH1gLCB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIGhlYWRlcnMsXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCBlcnJvciA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBUEkgRXJyb3IgJHtyZXNwb25zZS5zdGF0dXN9OiAke2Vycm9yfWApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYXdhaXQgcmVzcG9uc2UuanNvbigpIGFzIFQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGlmICh0aGlzLm9uRXJyb3IpIHtcbiAgICAgICAgdGhpcy5vbkVycm9yKGVycm9yIGFzIEVycm9yKTtcbiAgICAgIH1cbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8vIEhlYWx0aCBjaGVja1xuICBhc3luYyBoZWFsdGhDaGVjaygpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCcvaGVhbHRoJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvLyBBdXRoIGVuZHBvaW50c1xuICBhc3luYyBnZXREZW1vVG9rZW4oKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMucmVxdWVzdDxEZW1vVG9rZW5SZXNwb25zZT4oJy9hdXRoL2RlbW8nLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzcG9uc2UudG9rZW47XG4gIH1cblxuICBhc3luYyBnZXRVc2VyQ3JlZGl0cygpOiBQcm9taXNlPFVzZXJDcmVkaXRzUmVzcG9uc2U+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFVzZXJDcmVkaXRzUmVzcG9uc2U+KCcvYXBpL3VzZXIvY3JlZGl0cycpO1xuICB9XG5cbiAgYXN5bmMgcHVyY2hhc2VDcmVkaXRzKFxuICAgIHJlcXVlc3Q6IFB1cmNoYXNlQ3JlZGl0c1JlcXVlc3RcbiAgKTogUHJvbWlzZTxQdXJjaGFzZUNyZWRpdHNSZXNwb25zZT4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8UHVyY2hhc2VDcmVkaXRzUmVzcG9uc2U+KCcvYXBpL3VzZXIvY3JlZGl0cy9wdXJjaGFzZScsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVxdWVzdCksXG4gICAgfSk7XG4gIH1cblxuICAvLyBLYXJhb2tlIGVuZHBvaW50c1xuICBhc3luYyBnZXRLYXJhb2tlRGF0YSh0cmFja0lkOiBzdHJpbmcpOiBQcm9taXNlPEthcmFva2VEYXRhPiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxLYXJhb2tlRGF0YT4oYC9hcGkva2FyYW9rZS8ke2VuY29kZVVSSUNvbXBvbmVudCh0cmFja0lkKX1gKTtcbiAgfVxuXG4gIGFzeW5jIHN0YXJ0S2FyYW9rZVNlc3Npb24oXG4gICAgcmVxdWVzdDogU3RhcnRTZXNzaW9uUmVxdWVzdFxuICApOiBQcm9taXNlPEFwaVJlc3BvbnNlPEthcmFva2VTZXNzaW9uPj4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QXBpUmVzcG9uc2U8S2FyYW9rZVNlc3Npb24+PignL2FwaS9rYXJhb2tlL3N0YXJ0Jywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSxcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIGdyYWRlS2FyYW9rZUxpbmUoXG4gICAgcmVxdWVzdDogR3JhZGVMaW5lUmVxdWVzdFxuICApOiBQcm9taXNlPEFwaVJlc3BvbnNlPExpbmVTY29yZT4+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFwaVJlc3BvbnNlPExpbmVTY29yZT4+KCcvYXBpL2thcmFva2UvZ3JhZGUnLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpLFxuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgY29tcGxldGVLYXJhb2tlU2Vzc2lvbihcbiAgICByZXF1ZXN0OiBDb21wbGV0ZVNlc3Npb25SZXF1ZXN0XG4gICk6IFByb21pc2U8QXBpUmVzcG9uc2U8U2Vzc2lvblJlc3VsdHM+PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBcGlSZXNwb25zZTxTZXNzaW9uUmVzdWx0cz4+KCcvYXBpL2thcmFva2UvY29tcGxldGUnLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gU3BlZWNoLXRvLXRleHQgZW5kcG9pbnRzXG4gIGFzeW5jIHRyYW5zY3JpYmVBdWRpbyhcbiAgICByZXF1ZXN0OiBUcmFuc2NyaWJlUmVxdWVzdFxuICApOiBQcm9taXNlPFRyYW5zY3JpYmVSZXNwb25zZT4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8VHJhbnNjcmliZVJlc3BvbnNlPignL2FwaS9zcGVlY2gtdG8tdGV4dC90cmFuc2NyaWJlJywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFByYWN0aWNlIGVuZHBvaW50c1xuICBhc3luYyBnZXRQcmFjdGljZUV4ZXJjaXNlcyhcbiAgICBzZXNzaW9uSWQ/OiBzdHJpbmcsXG4gICAgbGltaXQgPSAxMFxuICApOiBQcm9taXNlPEFwaVJlc3BvbnNlPHsgZXhlcmNpc2VzOiBFeGVyY2lzZVtdOyBjYXJkczogUHJhY3RpY2VDYXJkW10gfT4+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCk7XG4gICAgaWYgKHNlc3Npb25JZCkgcGFyYW1zLmFwcGVuZCgnc2Vzc2lvbklkJywgc2Vzc2lvbklkKTtcbiAgICBwYXJhbXMuYXBwZW5kKCdsaW1pdCcsIGxpbWl0LnRvU3RyaW5nKCkpO1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBcGlSZXNwb25zZTx7IGV4ZXJjaXNlczogRXhlcmNpc2VbXTsgY2FyZHM6IFByYWN0aWNlQ2FyZFtdIH0+PihcbiAgICAgIGAvYXBpL3ByYWN0aWNlL2V4ZXJjaXNlcz8ke3BhcmFtc31gXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHN1Ym1pdFByYWN0aWNlUmV2aWV3KFxuICAgIGNhcmRJZDogc3RyaW5nLFxuICAgIHNjb3JlOiBudW1iZXIsXG4gICAgcmV2aWV3VGltZTogc3RyaW5nXG4gICk6IFByb21pc2U8QXBpUmVzcG9uc2U+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFwaVJlc3BvbnNlPignL2FwaS9wcmFjdGljZS9yZXZpZXcnLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgY2FyZElkLCBzY29yZSwgcmV2aWV3VGltZSB9KSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFVzZXIgZW5kcG9pbnRzXG4gIGFzeW5jIGdldFVzZXJCZXN0U2NvcmUoc29uZ0lkOiBzdHJpbmcpOiBQcm9taXNlPEFwaVJlc3BvbnNlPHsgc2NvcmU6IG51bWJlciB9Pj4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QXBpUmVzcG9uc2U8eyBzY29yZTogbnVtYmVyIH0+PihcbiAgICAgIGAvYXBpL3VzZXJzL21lL3NvbmdzLyR7c29uZ0lkfS9iZXN0LXNjb3JlYFxuICAgICk7XG4gIH1cblxuICAvLyBMZWFkZXJib2FyZCBlbmRwb2ludHNcbiAgYXN5bmMgZ2V0U29uZ0xlYWRlcmJvYXJkKFxuICAgIHNvbmdJZDogc3RyaW5nLFxuICAgIGxpbWl0ID0gMTBcbiAgKTogUHJvbWlzZTxBcGlSZXNwb25zZTxBcnJheTx7IHVzZXJJZDogc3RyaW5nOyBzY29yZTogbnVtYmVyOyByYW5rOiBudW1iZXIgfT4+PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBcGlSZXNwb25zZTxBcnJheTx7IHVzZXJJZDogc3RyaW5nOyBzY29yZTogbnVtYmVyOyByYW5rOiBudW1iZXIgfT4+PihcbiAgICAgIGAvYXBpL3NvbmdzLyR7c29uZ0lkfS9sZWFkZXJib2FyZD9saW1pdD0ke2xpbWl0fWBcbiAgICApO1xuICB9XG59IiwiaW1wb3J0IHR5cGUgeyBBcGlDbGllbnQgfSBmcm9tICcuLi9jbGllbnQnO1xuaW1wb3J0IHR5cGUge1xuICBLYXJhb2tlRGF0YSxcbiAgS2FyYW9rZVNlc3Npb24sXG4gIExpbmVTY29yZSxcbiAgU2Vzc2lvblJlc3VsdHMsXG4gIEFwaVJlc3BvbnNlLFxufSBmcm9tICdAc2NhcmxldHQvY29yZSc7XG5cbmV4cG9ydCBjbGFzcyBLYXJhb2tlRW5kcG9pbnQge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGNsaWVudDogQXBpQ2xpZW50KSB7fVxuXG4gIC8qKlxuICAgKiBGZXRjaCBrYXJhb2tlIGRhdGEgZm9yIGEgdHJhY2tcbiAgICovXG4gIGFzeW5jIGdldERhdGEodHJhY2tJZDogc3RyaW5nKTogUHJvbWlzZTxLYXJhb2tlRGF0YT4ge1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5nZXRLYXJhb2tlRGF0YSh0cmFja0lkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFydCBhIG5ldyBrYXJhb2tlIHNlc3Npb25cbiAgICovXG4gIGFzeW5jIHN0YXJ0U2Vzc2lvbihcbiAgICB0cmFja0lkOiBzdHJpbmcsXG4gICAgc29uZ0RhdGE6IHtcbiAgICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgICBhcnRpc3Q6IHN0cmluZztcbiAgICAgIGdlbml1c0lkPzogc3RyaW5nO1xuICAgICAgZHVyYXRpb24/OiBudW1iZXI7XG4gICAgICBkaWZmaWN1bHR5Pzogc3RyaW5nO1xuICAgIH0sXG4gICAgc29uZ0NhdGFsb2dJZD86IHN0cmluZ1xuICApOiBQcm9taXNlPEthcmFva2VTZXNzaW9uPiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNsaWVudC5zdGFydEthcmFva2VTZXNzaW9uKHtcbiAgICAgIHRyYWNrSWQsXG4gICAgICBzb25nRGF0YSxcbiAgICAgIHNvbmdDYXRhbG9nSWQsXG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLnN1Y2Nlc3MgfHwgIXJlc3BvbnNlLmRhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihyZXNwb25zZS5lcnJvciB8fCAnRmFpbGVkIHRvIHN0YXJ0IHNlc3Npb24nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHcmFkZSBhIGthcmFva2UgbGluZSByZWNvcmRpbmdcbiAgICovXG4gIGFzeW5jIGdyYWRlTGluZShcbiAgICBzZXNzaW9uSWQ6IHN0cmluZyxcbiAgICBsaW5lSW5kZXg6IG51bWJlcixcbiAgICBhdWRpb0Jhc2U2NDogc3RyaW5nLFxuICAgIGV4cGVjdGVkVGV4dDogc3RyaW5nLFxuICAgIHN0YXJ0VGltZTogbnVtYmVyLFxuICAgIGVuZFRpbWU6IG51bWJlclxuICApOiBQcm9taXNlPExpbmVTY29yZT4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuZ3JhZGVLYXJhb2tlTGluZSh7XG4gICAgICBzZXNzaW9uSWQsXG4gICAgICBsaW5lSW5kZXgsXG4gICAgICBhdWRpb0J1ZmZlcjogYXVkaW9CYXNlNjQsXG4gICAgICBleHBlY3RlZFRleHQsXG4gICAgICBzdGFydFRpbWUsXG4gICAgICBlbmRUaW1lLFxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXNwb25zZS5zdWNjZXNzIHx8ICFyZXNwb25zZS5kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IocmVzcG9uc2UuZXJyb3IgfHwgJ0ZhaWxlZCB0byBncmFkZSBsaW5lJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gIH1cblxuICAvKipcbiAgICogQ29tcGxldGUgYSBrYXJhb2tlIHNlc3Npb25cbiAgICovXG4gIGFzeW5jIGNvbXBsZXRlU2Vzc2lvbihcbiAgICBzZXNzaW9uSWQ6IHN0cmluZyxcbiAgICBmdWxsQXVkaW9CYXNlNjQ/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxTZXNzaW9uUmVzdWx0cz4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuY29tcGxldGVLYXJhb2tlU2Vzc2lvbih7XG4gICAgICBzZXNzaW9uSWQsXG4gICAgICBmdWxsQXVkaW9CdWZmZXI6IGZ1bGxBdWRpb0Jhc2U2NCxcbiAgICB9KTtcblxuICAgIGlmICghcmVzcG9uc2Uuc3VjY2VzcyB8fCAhcmVzcG9uc2UuZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHJlc3BvbnNlLmVycm9yIHx8ICdGYWlsZWQgdG8gY29tcGxldGUgc2Vzc2lvbicpO1xuICAgIH1cblxuICAgIHJldHVybiByZXNwb25zZS5kYXRhO1xuICB9XG59IiwiaW1wb3J0IHR5cGUgeyBBcGlDbGllbnQgfSBmcm9tICcuLi9jbGllbnQnO1xuaW1wb3J0IHR5cGUgeyBFeGVyY2lzZSwgUHJhY3RpY2VDYXJkIH0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuXG5leHBvcnQgY2xhc3MgUHJhY3RpY2VFbmRwb2ludCB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY2xpZW50OiBBcGlDbGllbnQpIHt9XG5cbiAgLyoqXG4gICAqIEdldCBwcmFjdGljZSBleGVyY2lzZXMgZm9yIGEgdXNlclxuICAgKi9cbiAgYXN5bmMgZ2V0RXhlcmNpc2VzKFxuICAgIHNlc3Npb25JZD86IHN0cmluZyxcbiAgICBsaW1pdCA9IDEwXG4gICk6IFByb21pc2U8eyBleGVyY2lzZXM6IEV4ZXJjaXNlW107IGNhcmRzOiBQcmFjdGljZUNhcmRbXSB9PiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNsaWVudC5nZXRQcmFjdGljZUV4ZXJjaXNlcyhzZXNzaW9uSWQsIGxpbWl0KTtcblxuICAgIGlmICghcmVzcG9uc2Uuc3VjY2VzcyB8fCAhcmVzcG9uc2UuZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHJlc3BvbnNlLmVycm9yIHx8ICdGYWlsZWQgdG8gZmV0Y2ggZXhlcmNpc2VzJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gIH1cblxuICAvKipcbiAgICogU3VibWl0IGEgcHJhY3RpY2UgcmV2aWV3XG4gICAqL1xuICBhc3luYyBzdWJtaXRSZXZpZXcoXG4gICAgY2FyZElkOiBzdHJpbmcsXG4gICAgc2NvcmU6IG51bWJlcixcbiAgICByZXZpZXdUaW1lOiBzdHJpbmcgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNsaWVudC5zdWJtaXRQcmFjdGljZVJldmlldyhcbiAgICAgIGNhcmRJZCxcbiAgICAgIHNjb3JlLFxuICAgICAgcmV2aWV3VGltZVxuICAgICk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLnN1Y2Nlc3MpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihyZXNwb25zZS5lcnJvciB8fCAnRmFpbGVkIHRvIHN1Ym1pdCByZXZpZXcnKTtcbiAgICB9XG4gIH1cbn0iLCJpbXBvcnQgdHlwZSB7IEFwaUNsaWVudCB9IGZyb20gJy4uL2NsaWVudCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHJhbnNjcmlwdGlvblJlc3VsdCB7XG4gIHRyYW5zY3JpcHQ6IHN0cmluZztcbiAgY29uZmlkZW5jZTogbnVtYmVyO1xuICBwcm92aWRlcj86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFNUVEVuZHBvaW50IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBjbGllbnQ6IEFwaUNsaWVudCkge31cblxuICAvKipcbiAgICogVHJhbnNjcmliZSBhdWRpbyB1c2luZyBzcGVlY2gtdG8tdGV4dFxuICAgKi9cbiAgYXN5bmMgdHJhbnNjcmliZShcbiAgICBhdWRpb0Jhc2U2NDogc3RyaW5nLFxuICAgIGV4cGVjdGVkVGV4dD86IHN0cmluZyxcbiAgICBwcmVmZXJEZWVwZ3JhbSA9IGZhbHNlXG4gICk6IFByb21pc2U8VHJhbnNjcmlwdGlvblJlc3VsdD4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQudHJhbnNjcmliZUF1ZGlvKHtcbiAgICAgIGF1ZGlvQmFzZTY0LFxuICAgICAgZXhwZWN0ZWRUZXh0LFxuICAgICAgcHJlZmVyRGVlcGdyYW0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLnN1Y2Nlc3MgfHwgIXJlc3BvbnNlLmRhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihyZXNwb25zZS5lcnJvciB8fCAnRmFpbGVkIHRvIHRyYW5zY3JpYmUgYXVkaW8nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmFuc2NyaWJlIHdpdGggcmV0cnkgbG9naWNcbiAgICovXG4gIGFzeW5jIHRyYW5zY3JpYmVXaXRoUmV0cnkoXG4gICAgYXVkaW9CYXNlNjQ6IHN0cmluZyxcbiAgICBleHBlY3RlZFRleHQ/OiBzdHJpbmcsXG4gICAgbWF4UmV0cmllcyA9IDJcbiAgKTogUHJvbWlzZTxUcmFuc2NyaXB0aW9uUmVzdWx0PiB7XG4gICAgbGV0IGxhc3RFcnJvcjogRXJyb3IgfCBudWxsID0gbnVsbDtcblxuICAgIGZvciAobGV0IGF0dGVtcHQgPSAxOyBhdHRlbXB0IDw9IG1heFJldHJpZXM7IGF0dGVtcHQrKykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gVHJ5IEVsZXZlbkxhYnMgZmlyc3RcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy50cmFuc2NyaWJlKFxuICAgICAgICAgIGF1ZGlvQmFzZTY0LFxuICAgICAgICAgIGV4cGVjdGVkVGV4dCxcbiAgICAgICAgICBmYWxzZVxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbGFzdEVycm9yID0gZXJyb3IgYXMgRXJyb3I7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbU1RUXSBBdHRlbXB0ICR7YXR0ZW1wdH0vJHttYXhSZXRyaWVzfSBmYWlsZWQ6YCwgZXJyb3IpO1xuXG4gICAgICAgIC8vIElmIGZpcnN0IGF0dGVtcHQgZmFpbGVkLCB0cnkgd2l0aCBEZWVwZ3JhbVxuICAgICAgICBpZiAoYXR0ZW1wdCA9PT0gMSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW1NUVF0gUmV0cnlpbmcgd2l0aCBEZWVwZ3JhbS4uLicpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy50cmFuc2NyaWJlKFxuICAgICAgICAgICAgICBhdWRpb0Jhc2U2NCxcbiAgICAgICAgICAgICAgZXhwZWN0ZWRUZXh0LFxuICAgICAgICAgICAgICB0cnVlXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICB9IGNhdGNoIChkZWVwZ3JhbUVycm9yKSB7XG4gICAgICAgICAgICBsYXN0RXJyb3IgPSBkZWVwZ3JhbUVycm9yIGFzIEVycm9yO1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1NUVF0gRGVlcGdyYW0gYWxzbyBmYWlsZWQ6JywgZGVlcGdyYW1FcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhyb3cgbGFzdEVycm9yIHx8IG5ldyBFcnJvcignU1RUIGZhaWxlZCBhZnRlciByZXRyaWVzJyk7XG4gIH1cbn0iLCJpbXBvcnQgdHlwZSB7IEFwaUNsaWVudCB9IGZyb20gJy4uL2NsaWVudCc7XG5pbXBvcnQgdHlwZSB7XG4gIFVzZXJDcmVkaXRzUmVzcG9uc2UsXG4gIFB1cmNoYXNlQ3JlZGl0c1JlcXVlc3QsXG4gIFB1cmNoYXNlQ3JlZGl0c1Jlc3BvbnNlLFxufSBmcm9tICdAc2NhcmxldHQvY29yZSc7XG5cbmV4cG9ydCBjbGFzcyBBdXRoRW5kcG9pbnQge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGNsaWVudDogQXBpQ2xpZW50KSB7fVxuXG4gIC8qKlxuICAgKiBHZXQgYSBkZW1vIGF1dGhlbnRpY2F0aW9uIHRva2VuXG4gICAqL1xuICBhc3luYyBnZXREZW1vVG9rZW4oKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZ2V0RGVtb1Rva2VuKCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGN1cnJlbnQgdXNlciBjcmVkaXRzXG4gICAqL1xuICBhc3luYyBnZXRVc2VyQ3JlZGl0cygpOiBQcm9taXNlPFVzZXJDcmVkaXRzUmVzcG9uc2U+IHtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZ2V0VXNlckNyZWRpdHMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQdXJjaGFzZSBjcmVkaXRzXG4gICAqL1xuICBhc3luYyBwdXJjaGFzZUNyZWRpdHMoXG4gICAgZmlkOiBudW1iZXIsXG4gICAgY3JlZGl0czogbnVtYmVyLFxuICAgIGNoYWluOiAnQmFzZScgfCAnU29sYW5hJyA9ICdCYXNlJyxcbiAgICB0cmFuc2FjdGlvbkhhc2g/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxQdXJjaGFzZUNyZWRpdHNSZXNwb25zZT4ge1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5wdXJjaGFzZUNyZWRpdHMoe1xuICAgICAgZmlkLFxuICAgICAgY3JlZGl0cyxcbiAgICAgIGNoYWluLFxuICAgICAgdHJhbnNhY3Rpb25IYXNoLFxuICAgIH0pO1xuICB9XG59IiwiaW1wb3J0IHsgQXBpQ2xpZW50LCB0eXBlIEFwaUNsaWVudENvbmZpZyB9IGZyb20gJy4vY2xpZW50JztcbmltcG9ydCB7XG4gIEthcmFva2VFbmRwb2ludCxcbiAgUHJhY3RpY2VFbmRwb2ludCxcbiAgU1RURW5kcG9pbnQsXG4gIEF1dGhFbmRwb2ludCxcbn0gZnJvbSAnLi9lbmRwb2ludHMnO1xuXG5leHBvcnQgeyBBcGlDbGllbnQsIHR5cGUgQXBpQ2xpZW50Q29uZmlnIH07XG5leHBvcnQgKiBmcm9tICcuL2VuZHBvaW50cyc7XG5cbi8qKlxuICogQ3JlYXRlIGEgY29uZmlndXJlZCBBUEkgY2xpZW50IHdpdGggYWxsIGVuZHBvaW50c1xuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQXBpQ2xpZW50KGNvbmZpZzogQXBpQ2xpZW50Q29uZmlnKSB7XG4gIGNvbnN0IGNsaWVudCA9IG5ldyBBcGlDbGllbnQoY29uZmlnKTtcblxuICByZXR1cm4ge1xuICAgIGNsaWVudCxcbiAgICBrYXJhb2tlOiBuZXcgS2FyYW9rZUVuZHBvaW50KGNsaWVudCksXG4gICAgcHJhY3RpY2U6IG5ldyBQcmFjdGljZUVuZHBvaW50KGNsaWVudCksXG4gICAgc3R0OiBuZXcgU1RURW5kcG9pbnQoY2xpZW50KSxcbiAgICBhdXRoOiBuZXcgQXV0aEVuZHBvaW50KGNsaWVudCksXG4gICAgXG4gICAgLy8gRGlyZWN0IGFjY2VzcyB0byBiYXNlIG1ldGhvZHNcbiAgICBoZWFsdGhDaGVjazogKCkgPT4gY2xpZW50LmhlYWx0aENoZWNrKCksXG4gIH07XG59XG5cbmV4cG9ydCB0eXBlIFNjYXJsZXR0QXBpQ2xpZW50ID0gUmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlQXBpQ2xpZW50PjsiLCJpbXBvcnQgeyBjcmVhdGVBcGlDbGllbnQsIHR5cGUgU2NhcmxldHRBcGlDbGllbnQgfSBmcm9tICdAc2NhcmxldHQvYXBpLWNsaWVudCc7XG5pbXBvcnQgdHlwZSB7IEthcmFva2VEYXRhLCBLYXJhb2tlU2Vzc2lvbiwgTGluZVNjb3JlLCBTZXNzaW9uUmVzdWx0cyB9IGZyb20gJ0BzY2FybGV0dC9jb3JlJztcblxuLyoqXG4gKiBBZGFwdGVyIGNsYXNzIHRoYXQgcHJvdmlkZXMgdGhlIHNhbWUgaW50ZXJmYWNlIGFzIHRoZSBvbGQgS2FyYW9rZUFwaVNlcnZpY2VcbiAqIGJ1dCB1c2VzIHRoZSBuZXcgQHNjYXJsZXR0L2FwaS1jbGllbnQgdW5kZXIgdGhlIGhvb2RcbiAqL1xuZXhwb3J0IGNsYXNzIEthcmFva2VBcGlTZXJ2aWNlIHtcbiAgcHJpdmF0ZSBjbGllbnQ6IFNjYXJsZXR0QXBpQ2xpZW50O1xuXG4gIGNvbnN0cnVjdG9yKGJhc2VVcmw6IHN0cmluZyA9IGltcG9ydC5tZXRhLmVudi5WSVRFX0FQSV9VUkwgfHwgJ2h0dHA6Ly9sb2NhbGhvc3Q6ODc4NycpIHtcbiAgICB0aGlzLmNsaWVudCA9IGNyZWF0ZUFwaUNsaWVudCh7IGJhc2VVcmwgfSk7XG4gIH1cblxuICBhc3luYyBmZXRjaEthcmFva2VEYXRhKHRyYWNrSWQ6IHN0cmluZyk6IFByb21pc2U8S2FyYW9rZURhdGEgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNsaWVudC5rYXJhb2tlLmdldERhdGEodHJhY2tJZCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZmV0Y2gga2FyYW9rZSBkYXRhOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHN0YXJ0U2Vzc2lvbihcbiAgICB0cmFja0lkOiBzdHJpbmcsXG4gICAgc29uZ0RhdGE6IHsgdGl0bGU6IHN0cmluZzsgYXJ0aXN0OiBzdHJpbmc7IGdlbml1c0lkPzogc3RyaW5nOyBkdXJhdGlvbj86IG51bWJlcjsgZGlmZmljdWx0eT86IHN0cmluZyB9LFxuICAgIGF1dGhUb2tlbj86IHN0cmluZyxcbiAgICBzb25nQ2F0YWxvZ0lkPzogc3RyaW5nLFxuICAgIHBsYXliYWNrU3BlZWQ/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxLYXJhb2tlU2Vzc2lvbiB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgLy8gTm90ZTogcGxheWJhY2tTcGVlZCBpcyBzdG9yZWQgYnV0IG5vdCB1c2VkIGJ5IHRoZSBjdXJyZW50IGFwaS1jbGllbnRcbiAgICAgIC8vIFRoaXMgbWFpbnRhaW5zIGNvbXBhdGliaWxpdHkgd2l0aCB0aGUgZXhpc3RpbmcgaW50ZXJmYWNlXG4gICAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgdGhpcy5jbGllbnQua2FyYW9rZS5zdGFydFNlc3Npb24oXG4gICAgICAgIHRyYWNrSWQsXG4gICAgICAgIHNvbmdEYXRhLFxuICAgICAgICBzb25nQ2F0YWxvZ0lkXG4gICAgICApO1xuICAgICAgcmV0dXJuIHNlc3Npb247XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gc3RhcnQgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBncmFkZVJlY29yZGluZyhcbiAgICBzZXNzaW9uSWQ6IHN0cmluZyxcbiAgICBsaW5lSW5kZXg6IG51bWJlcixcbiAgICBhdWRpb0J1ZmZlcjogc3RyaW5nLFxuICAgIGV4cGVjdGVkVGV4dDogc3RyaW5nLFxuICAgIHN0YXJ0VGltZTogbnVtYmVyLFxuICAgIGVuZFRpbWU6IG51bWJlcixcbiAgICBhdXRoVG9rZW4/OiBzdHJpbmcsXG4gICAgcGxheWJhY2tTcGVlZD86IHN0cmluZ1xuICApOiBQcm9taXNlPExpbmVTY29yZSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgLy8gTm90ZTogcGxheWJhY2tTcGVlZCBpcyBwYXNzZWQgYnV0IG5vdCB1c2VkIGJ5IHRoZSBjdXJyZW50IGFwaS1jbGllbnRcbiAgICAgIGNvbnN0IGxpbmVTY29yZSA9IGF3YWl0IHRoaXMuY2xpZW50LmthcmFva2UuZ3JhZGVMaW5lKFxuICAgICAgICBzZXNzaW9uSWQsXG4gICAgICAgIGxpbmVJbmRleCxcbiAgICAgICAgYXVkaW9CdWZmZXIsXG4gICAgICAgIGV4cGVjdGVkVGV4dCxcbiAgICAgICAgc3RhcnRUaW1lLFxuICAgICAgICBlbmRUaW1lXG4gICAgICApO1xuICAgICAgcmV0dXJuIGxpbmVTY29yZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBncmFkZSByZWNvcmRpbmc6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgY29tcGxldGVTZXNzaW9uKFxuICAgIHNlc3Npb25JZDogc3RyaW5nLFxuICAgIGZ1bGxBdWRpb0J1ZmZlcj86IHN0cmluZ1xuICApOiBQcm9taXNlPFNlc3Npb25SZXN1bHRzIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgdGhpcy5jbGllbnQua2FyYW9rZS5jb21wbGV0ZVNlc3Npb24oXG4gICAgICAgIHNlc3Npb25JZCxcbiAgICAgICAgZnVsbEF1ZGlvQnVmZmVyXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gY29tcGxldGUgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBnZXRVc2VyQmVzdFNjb3JlKHNvbmdJZDogc3RyaW5nKTogUHJvbWlzZTxudW1iZXIgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuY2xpZW50LmdldFVzZXJCZXN0U2NvcmUoc29uZ0lkKTtcbiAgICAgIHJldHVybiByZXNwb25zZS5kYXRhPy5zY29yZSA/PyBudWxsO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGdldCB1c2VyIGJlc3Qgc2NvcmU6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ2V0U29uZ0xlYWRlcmJvYXJkKHNvbmdJZDogc3RyaW5nLCBsaW1pdCA9IDEwKTogUHJvbWlzZTxBcnJheTx7IHVzZXJJZDogc3RyaW5nOyBzY29yZTogbnVtYmVyOyByYW5rOiBudW1iZXIgfT4+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNsaWVudC5jbGllbnQuZ2V0U29uZ0xlYWRlcmJvYXJkKHNvbmdJZCwgbGltaXQpO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmRhdGEgPz8gW107XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZ2V0IHNvbmcgbGVhZGVyYm9hcmQ6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxufSIsImltcG9ydCB0eXBlIHsgQ2h1bmtJbmZvIH0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuaW1wb3J0IHR5cGUgeyBMeXJpY0xpbmUgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb3VudFdvcmRzKHRleHQ6IHN0cmluZyk6IG51bWJlciB7XG4gIGlmICghdGV4dCkgcmV0dXJuIDA7XG4gIHJldHVybiB0ZXh0XG4gICAgLnRyaW0oKVxuICAgIC5zcGxpdCgvXFxzKy8pXG4gICAgLmZpbHRlcigod29yZCkgPT4gd29yZC5sZW5ndGggPiAwKS5sZW5ndGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRDaHVua0xpbmVzKFxuICBsaW5lczogTHlyaWNMaW5lW10sXG4gIHN0YXJ0SW5kZXg6IG51bWJlclxuKTogQ2h1bmtJbmZvIHtcbiAgLy8gUHJvY2VzcyBpbmRpdmlkdWFsIGxpbmVzIGluc3RlYWQgb2YgZ3JvdXBpbmdcbiAgY29uc3QgbGluZSA9IGxpbmVzW3N0YXJ0SW5kZXhdO1xuICBpZiAoIWxpbmUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhcnRJbmRleCxcbiAgICAgIGVuZEluZGV4OiBzdGFydEluZGV4LFxuICAgICAgZXhwZWN0ZWRUZXh0OiAnJyxcbiAgICAgIHdvcmRDb3VudDogMCxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgd29yZENvdW50ID0gY291bnRXb3JkcyhsaW5lLnRleHQgfHwgJycpO1xuICBcbiAgcmV0dXJuIHtcbiAgICBzdGFydEluZGV4LFxuICAgIGVuZEluZGV4OiBzdGFydEluZGV4LCAvLyBTaW5nbGUgbGluZSwgc28gc3RhcnQgYW5kIGVuZCBhcmUgdGhlIHNhbWVcbiAgICBleHBlY3RlZFRleHQ6IGxpbmUudGV4dCB8fCAnJyxcbiAgICB3b3JkQ291bnQsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYWxjdWxhdGVSZWNvcmRpbmdEdXJhdGlvbihcbiAgbGluZXM6IEx5cmljTGluZVtdLFxuICBjaHVua0luZm86IENodW5rSW5mb1xuKTogbnVtYmVyIHtcbiAgY29uc3QgeyBzdGFydEluZGV4LCBlbmRJbmRleCB9ID0gY2h1bmtJbmZvO1xuICBjb25zdCBsaW5lID0gbGluZXNbc3RhcnRJbmRleF07XG4gIFxuICBpZiAoIWxpbmUpIHJldHVybiAzMDAwO1xuXG4gIGlmIChlbmRJbmRleCA+IHN0YXJ0SW5kZXgpIHtcbiAgICBpZiAoZW5kSW5kZXggKyAxIDwgbGluZXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBuZXh0TGluZSA9IGxpbmVzW2VuZEluZGV4ICsgMV07XG4gICAgICBpZiAobmV4dExpbmUpIHtcbiAgICAgICAgLy8gQ29udmVydCBzZWNvbmRzIHRvIG1pbGxpc2Vjb25kc1xuICAgICAgICByZXR1cm4gKG5leHRMaW5lLnN0YXJ0VGltZSAtIGxpbmUuc3RhcnRUaW1lKSAqIDEwMDA7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGxldCBkdXJhdGlvbiA9IDA7XG4gICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPD0gZW5kSW5kZXg7IGkrKykge1xuICAgICAgLy8gZHVyYXRpb24gaXMgYWxyZWFkeSBpbiBtaWxsaXNlY29uZHNcbiAgICAgIGR1cmF0aW9uICs9IGxpbmVzW2ldPy5kdXJhdGlvbiB8fCAzMDAwO1xuICAgIH1cbiAgICByZXR1cm4gTWF0aC5taW4oZHVyYXRpb24sIDgwMDApO1xuICB9IGVsc2Uge1xuICAgIGlmIChzdGFydEluZGV4ICsgMSA8IGxpbmVzLmxlbmd0aCkge1xuICAgICAgY29uc3QgbmV4dExpbmUgPSBsaW5lc1tzdGFydEluZGV4ICsgMV07XG4gICAgICBpZiAobmV4dExpbmUpIHtcbiAgICAgICAgLy8gQ29udmVydCBzZWNvbmRzIHRvIG1pbGxpc2Vjb25kc1xuICAgICAgICBjb25zdCBjYWxjdWxhdGVkRHVyYXRpb24gPSAobmV4dExpbmUuc3RhcnRUaW1lIC0gbGluZS5zdGFydFRpbWUpICogMTAwMDtcbiAgICAgICAgcmV0dXJuIE1hdGgubWluKE1hdGgubWF4KGNhbGN1bGF0ZWREdXJhdGlvbiwgMTAwMCksIDUwMDApO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gTWF0aC5taW4obGluZS5kdXJhdGlvbiB8fCAzMDAwLCA1MDAwKTtcbiAgfVxufSIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJvZ3Jlc3NCYXJQcm9wcyB7XG4gIGN1cnJlbnQ6IG51bWJlcjtcbiAgdG90YWw6IG51bWJlcjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBQcm9ncmVzc0JhcjogQ29tcG9uZW50PFByb2dyZXNzQmFyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHBlcmNlbnRhZ2UgPSAoKSA9PiBNYXRoLm1pbigxMDAsIE1hdGgubWF4KDAsIChwcm9wcy5jdXJyZW50IC8gcHJvcHMudG90YWwpICogMTAwKSk7XG4gIFxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCd3LWZ1bGwgaC0xLjUgYmctaGlnaGxpZ2h0JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxkaXZcbiAgICAgICAgY2xhc3M9XCJoLWZ1bGwgYmctYWNjZW50IHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCBlYXNlLW91dCByb3VuZGVkLXItc21cIlxuICAgICAgICBzdHlsZT17eyB3aWR0aDogYCR7cGVyY2VudGFnZSgpfSVgIH19XG4gICAgICAvPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93LCBzcGxpdFByb3BzLCBjcmVhdGVFZmZlY3QsIG9uQ2xlYW51cCB9IGZyb20gJ3NvbGlkLWpzJ1xuaW1wb3J0IHR5cGUgeyBKU1gsIENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJ1xuaW1wb3J0IHsgUG9ydGFsIH0gZnJvbSAnc29saWQtanMvd2ViJ1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbidcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uL0J1dHRvbidcblxuZXhwb3J0IGludGVyZmFjZSBNb2RhbFByb3BzIHtcbiAgb3BlbjogYm9vbGVhblxuICBvbkNsb3NlPzogKCkgPT4gdm9pZFxuICB0aXRsZT86IHN0cmluZ1xuICBkZXNjcmlwdGlvbj86IHN0cmluZ1xuICBzaXplPzogJ3NtJyB8ICdtZCcgfCAnbGcnIHwgJ3hsJ1xuICB2YXJpYW50PzogJ2RlZmF1bHQnIHwgJ2RhbmdlcicgfCAnc3VjY2VzcydcbiAgaGlkZUNsb3NlQnV0dG9uPzogYm9vbGVhblxuICBjbG9zZU9uQmFja2Ryb3BDbGljaz86IGJvb2xlYW5cbiAgY2xvc2VPbkVzY2FwZT86IGJvb2xlYW5cbiAgY2hpbGRyZW4/OiBKU1guRWxlbWVudFxuICBmb290ZXI/OiBKU1guRWxlbWVudFxufVxuXG5leHBvcnQgY29uc3QgTW9kYWw6IENvbXBvbmVudDxNb2RhbFByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbbG9jYWwsIG90aGVyc10gPSBzcGxpdFByb3BzKHByb3BzLCBbXG4gICAgJ29wZW4nLFxuICAgICdvbkNsb3NlJyxcbiAgICAndGl0bGUnLFxuICAgICdkZXNjcmlwdGlvbicsXG4gICAgJ3NpemUnLFxuICAgICd2YXJpYW50JyxcbiAgICAnaGlkZUNsb3NlQnV0dG9uJyxcbiAgICAnY2xvc2VPbkJhY2tkcm9wQ2xpY2snLFxuICAgICdjbG9zZU9uRXNjYXBlJyxcbiAgICAnY2hpbGRyZW4nLFxuICAgICdmb290ZXInLFxuICBdKVxuXG4gIGNvbnN0IHNpemUgPSAoKSA9PiBsb2NhbC5zaXplIHx8ICdtZCdcbiAgY29uc3QgdmFyaWFudCA9ICgpID0+IGxvY2FsLnZhcmlhbnQgfHwgJ2RlZmF1bHQnXG4gIGNvbnN0IGNsb3NlT25CYWNrZHJvcENsaWNrID0gKCkgPT4gbG9jYWwuY2xvc2VPbkJhY2tkcm9wQ2xpY2sgPz8gdHJ1ZVxuICBjb25zdCBjbG9zZU9uRXNjYXBlID0gKCkgPT4gbG9jYWwuY2xvc2VPbkVzY2FwZSA/PyB0cnVlXG5cbiAgLy8gSGFuZGxlIGVzY2FwZSBrZXlcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAobG9jYWwub3BlbiAmJiBjbG9zZU9uRXNjYXBlKCkpIHtcbiAgICAgIGNvbnN0IGhhbmRsZUVzY2FwZSA9IChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gICAgICAgIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHtcbiAgICAgICAgICBsb2NhbC5vbkNsb3NlPy4oKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgaGFuZGxlRXNjYXBlKVxuICAgICAgb25DbGVhbnVwKCgpID0+IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBoYW5kbGVFc2NhcGUpKVxuICAgIH1cbiAgfSlcblxuICAvLyBMb2NrIGJvZHkgc2Nyb2xsIHdoZW4gbW9kYWwgaXMgb3BlblxuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChsb2NhbC5vcGVuKSB7XG4gICAgICBjb25zdCBvcmlnaW5hbE92ZXJmbG93ID0gZG9jdW1lbnQuYm9keS5zdHlsZS5vdmVyZmxvd1xuICAgICAgZG9jdW1lbnQuYm9keS5zdHlsZS5vdmVyZmxvdyA9ICdoaWRkZW4nXG4gICAgICBvbkNsZWFudXAoKCkgPT4ge1xuICAgICAgICBkb2N1bWVudC5ib2R5LnN0eWxlLm92ZXJmbG93ID0gb3JpZ2luYWxPdmVyZmxvd1xuICAgICAgfSlcbiAgICB9XG4gIH0pXG5cbiAgY29uc3QgaGFuZGxlQmFja2Ryb3BDbGljayA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgaWYgKGNsb3NlT25CYWNrZHJvcENsaWNrKCkgJiYgZS50YXJnZXQgPT09IGUuY3VycmVudFRhcmdldCkge1xuICAgICAgbG9jYWwub25DbG9zZT8uKClcbiAgICB9XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxTaG93IHdoZW49e2xvY2FsLm9wZW59PlxuICAgICAgPFBvcnRhbD5cbiAgICAgICAgPGRpdlxuICAgICAgICAgIGNsYXNzPVwiZml4ZWQgaW5zZXQtMCB6LTUwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHAtNFwiXG4gICAgICAgICAgb25DbGljaz17aGFuZGxlQmFja2Ryb3BDbGlja31cbiAgICAgICAgICB7Li4ub3RoZXJzfVxuICAgICAgICA+XG4gICAgICAgICAgey8qIEJhY2tkcm9wICovfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJhYnNvbHV0ZSBpbnNldC0wIGJnLWJsYWNrLzgwIGJhY2tkcm9wLWJsdXItc20gdHJhbnNpdGlvbi1vcGFjaXR5IGR1cmF0aW9uLTIwMFwiIC8+XG4gICAgICAgICAgXG4gICAgICAgICAgey8qIE1vZGFsICovfVxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3JlbGF0aXZlIGJnLWVsZXZhdGVkIHJvdW5kZWQteGwgc2hhZG93LTJ4bCBib3JkZXIgYm9yZGVyLXN1YnRsZScsXG4gICAgICAgICAgICAgICd0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0yMDAgc2NhbGUtMTAwIG9wYWNpdHktMTAwJyxcbiAgICAgICAgICAgICAgJ21heC1oLVs5MHZoXSBvdmVyZmxvdy1oaWRkZW4gZmxleCBmbGV4LWNvbCcsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvLyBTaXplc1xuICAgICAgICAgICAgICAgICd3LWZ1bGwgbWF4LXctc20nOiBzaXplKCkgPT09ICdzbScsXG4gICAgICAgICAgICAgICAgJ3ctZnVsbCBtYXgtdy1tZCc6IHNpemUoKSA9PT0gJ21kJyxcbiAgICAgICAgICAgICAgICAndy1mdWxsIG1heC13LWxnJzogc2l6ZSgpID09PSAnbGcnLFxuICAgICAgICAgICAgICAgICd3LWZ1bGwgbWF4LXcteGwnOiBzaXplKCkgPT09ICd4bCcsXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICB7LyogSGVhZGVyICovfVxuICAgICAgICAgICAgPFNob3cgd2hlbj17bG9jYWwudGl0bGUgfHwgIWxvY2FsLmhpZGVDbG9zZUJ1dHRvbn0+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLXN0YXJ0IGp1c3RpZnktYmV0d2VlbiBwLTYgcGItMFwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e2xvY2FsLnRpdGxlfT5cbiAgICAgICAgICAgICAgICAgICAgPGgyXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RleHQteGwgZm9udC1zZW1pYm9sZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICd0ZXh0LXByaW1hcnknOiB2YXJpYW50KCkgPT09ICdkZWZhdWx0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RleHQtcmVkLTUwMCc6IHZhcmlhbnQoKSA9PT0gJ2RhbmdlcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICd0ZXh0LWdyZWVuLTUwMCc6IHZhcmlhbnQoKSA9PT0gJ3N1Y2Nlc3MnLFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICB7bG9jYWwudGl0bGV9XG4gICAgICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtsb2NhbC5kZXNjcmlwdGlvbn0+XG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAge2xvY2FsLmRlc2NyaXB0aW9ufVxuICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17IWxvY2FsLmhpZGVDbG9zZUJ1dHRvbn0+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2xvY2FsLm9uQ2xvc2V9XG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwibWwtNCBwLTEgcm91bmRlZC1sZyB0ZXh0LXNlY29uZGFyeSBob3Zlcjp0ZXh0LXByaW1hcnkgaG92ZXI6Ymctc3VyZmFjZSB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCJDbG9zZSBtb2RhbFwiXG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIDxzdmdcbiAgICAgICAgICAgICAgICAgICAgICB3aWR0aD1cIjIwXCJcbiAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ9XCIyMFwiXG4gICAgICAgICAgICAgICAgICAgICAgdmlld0JveD1cIjAgMCAyMCAyMFwiXG4gICAgICAgICAgICAgICAgICAgICAgZmlsbD1cIm5vbmVcIlxuICAgICAgICAgICAgICAgICAgICAgIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIlxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgIGQ9XCJNMTUgNUw1IDE1TTUgNWwxMCAxMFwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJva2U9XCJjdXJyZW50Q29sb3JcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc3Ryb2tlLXdpZHRoPVwiMlwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJva2UtbGluZWNhcD1cInJvdW5kXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCJcbiAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgIHsvKiBDb250ZW50ICovfVxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBvdmVyZmxvdy15LWF1dG8gcC02XCI+XG4gICAgICAgICAgICAgIHtsb2NhbC5jaGlsZHJlbn1cbiAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICB7LyogRm9vdGVyICovfVxuICAgICAgICAgICAgPFNob3cgd2hlbj17bG9jYWwuZm9vdGVyfT5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInAtNiBwdC0wIG10LWF1dG9cIj5cbiAgICAgICAgICAgICAgICB7bG9jYWwuZm9vdGVyfVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L1BvcnRhbD5cbiAgICA8L1Nob3c+XG4gIClcbn1cblxuLy8gUHJlLWJ1aWx0IG1vZGFsIGZvb3RlciBjb21wb25lbnRzXG5leHBvcnQgaW50ZXJmYWNlIE1vZGFsRm9vdGVyUHJvcHMge1xuICBvbkNvbmZpcm0/OiAoKSA9PiB2b2lkXG4gIG9uQ2FuY2VsPzogKCkgPT4gdm9pZFxuICBjb25maXJtVGV4dD86IHN0cmluZ1xuICBjYW5jZWxUZXh0Pzogc3RyaW5nXG4gIGNvbmZpcm1WYXJpYW50PzogJ3ByaW1hcnknIHwgJ2RhbmdlcicgfCAnc2Vjb25kYXJ5J1xuICBjb25maXJtTG9hZGluZz86IGJvb2xlYW5cbiAgY29uZmlybURpc2FibGVkPzogYm9vbGVhblxufVxuXG5leHBvcnQgY29uc3QgTW9kYWxGb290ZXI6IENvbXBvbmVudDxNb2RhbEZvb3RlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBjb25maXJtVGV4dCA9ICgpID0+IHByb3BzLmNvbmZpcm1UZXh0IHx8ICdDb25maXJtJ1xuICBjb25zdCBjYW5jZWxUZXh0ID0gKCkgPT4gcHJvcHMuY2FuY2VsVGV4dCB8fCAnQ2FuY2VsJ1xuICBjb25zdCBjb25maXJtVmFyaWFudCA9ICgpID0+IHByb3BzLmNvbmZpcm1WYXJpYW50IHx8ICdwcmltYXJ5J1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktZW5kIGdhcC0zXCI+XG4gICAgICA8U2hvdyB3aGVuPXtwcm9wcy5vbkNhbmNlbH0+XG4gICAgICAgIDxCdXR0b25cbiAgICAgICAgICB2YXJpYW50PVwiZ2hvc3RcIlxuICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ2FuY2VsfVxuICAgICAgICA+XG4gICAgICAgICAge2NhbmNlbFRleHQoKX1cbiAgICAgICAgPC9CdXR0b24+XG4gICAgICA8L1Nob3c+XG4gICAgICA8U2hvdyB3aGVuPXtwcm9wcy5vbkNvbmZpcm19PlxuICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgdmFyaWFudD17Y29uZmlybVZhcmlhbnQoKX1cbiAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNvbmZpcm19XG4gICAgICAgICAgbG9hZGluZz17cHJvcHMuY29uZmlybUxvYWRpbmd9XG4gICAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmNvbmZpcm1EaXNhYmxlZH1cbiAgICAgICAgPlxuICAgICAgICAgIHtjb25maXJtVGV4dCgpfVxuICAgICAgICA8L0J1dHRvbj5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKVxufVxuXG4vLyBVdGlsaXR5IGZ1bmN0aW9uIGZvciBjb21tb24gbW9kYWwgcGF0dGVybnNcbmV4cG9ydCBpbnRlcmZhY2UgQ29uZmlybU1vZGFsUHJvcHMge1xuICBvcGVuOiBib29sZWFuXG4gIG9uQ2xvc2U6ICgpID0+IHZvaWRcbiAgb25Db25maXJtOiAoKSA9PiB2b2lkXG4gIHRpdGxlOiBzdHJpbmdcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmdcbiAgY29uZmlybVRleHQ/OiBzdHJpbmdcbiAgY2FuY2VsVGV4dD86IHN0cmluZ1xuICB2YXJpYW50PzogJ2RlZmF1bHQnIHwgJ2RhbmdlcidcbiAgY29uZmlybUxvYWRpbmc/OiBib29sZWFuXG59XG5cbmV4cG9ydCBjb25zdCBDb25maXJtTW9kYWw6IENvbXBvbmVudDxDb25maXJtTW9kYWxQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8TW9kYWxcbiAgICAgIG9wZW49e3Byb3BzLm9wZW59XG4gICAgICBvbkNsb3NlPXtwcm9wcy5vbkNsb3NlfVxuICAgICAgdGl0bGU9e3Byb3BzLnRpdGxlfVxuICAgICAgZGVzY3JpcHRpb249e3Byb3BzLmRlc2NyaXB0aW9ufVxuICAgICAgdmFyaWFudD17cHJvcHMudmFyaWFudH1cbiAgICAgIHNpemU9XCJzbVwiXG4gICAgICBmb290ZXI9e1xuICAgICAgICA8TW9kYWxGb290ZXJcbiAgICAgICAgICBvbkNvbmZpcm09e3Byb3BzLm9uQ29uZmlybX1cbiAgICAgICAgICBvbkNhbmNlbD17cHJvcHMub25DbG9zZX1cbiAgICAgICAgICBjb25maXJtVGV4dD17cHJvcHMuY29uZmlybVRleHR9XG4gICAgICAgICAgY2FuY2VsVGV4dD17cHJvcHMuY2FuY2VsVGV4dH1cbiAgICAgICAgICBjb25maXJtVmFyaWFudD17cHJvcHMudmFyaWFudCA9PT0gJ2RhbmdlcicgPyAnZGFuZ2VyJyA6ICdwcmltYXJ5J31cbiAgICAgICAgICBjb25maXJtTG9hZGluZz17cHJvcHMuY29uZmlybUxvYWRpbmd9XG4gICAgICAgIC8+XG4gICAgICB9XG4gICAgLz5cbiAgKVxufSIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1pbmltaXplZEthcmFva2VQcm9wcyB7XG4gIG9uQ2xpY2s6ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBNaW5pbWl6ZWRLYXJhb2tlOiBDb21wb25lbnQ8TWluaW1pemVkS2FyYW9rZVByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ2xpY2t9XG4gICAgICBzdHlsZT17e1xuICAgICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgICAgYm90dG9tOiAnMjRweCcsXG4gICAgICAgIHJpZ2h0OiAnMjRweCcsXG4gICAgICAgIHdpZHRoOiAnODBweCcsXG4gICAgICAgIGhlaWdodDogJzgwcHgnLFxuICAgICAgICAnYm9yZGVyLXJhZGl1cyc6ICc1MCUnLFxuICAgICAgICBiYWNrZ3JvdW5kOiAnbGluZWFyLWdyYWRpZW50KDEzNWRlZywgI0ZGMDA2RSAwJSwgI0MxMzU4NCAxMDAlKScsXG4gICAgICAgICdib3gtc2hhZG93JzogJzAgOHB4IDMycHggcmdiYSgwLCAwLCAwLCAwLjMpJyxcbiAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxuICAgICAgICAnYWxpZ24taXRlbXMnOiAnY2VudGVyJyxcbiAgICAgICAgJ2p1c3RpZnktY29udGVudCc6ICdjZW50ZXInLFxuICAgICAgICBvdmVyZmxvdzogJ2hpZGRlbicsXG4gICAgICAgIGN1cnNvcjogJ3BvaW50ZXInLFxuICAgICAgICAnei1pbmRleCc6ICc5OTk5OScsXG4gICAgICAgIGJvcmRlcjogJ25vbmUnLFxuICAgICAgICB0cmFuc2l0aW9uOiAndHJhbnNmb3JtIDAuMnMgZWFzZScsXG4gICAgICB9fVxuICAgICAgb25Nb3VzZUVudGVyPXsoZSkgPT4ge1xuICAgICAgICBlLmN1cnJlbnRUYXJnZXQuc3R5bGUudHJhbnNmb3JtID0gJ3NjYWxlKDEuMSknO1xuICAgICAgfX1cbiAgICAgIG9uTW91c2VMZWF2ZT17KGUpID0+IHtcbiAgICAgICAgZS5jdXJyZW50VGFyZ2V0LnN0eWxlLnRyYW5zZm9ybSA9ICdzY2FsZSgxKSc7XG4gICAgICB9fVxuICAgICAgYXJpYS1sYWJlbD1cIk9wZW4gS2FyYW9rZVwiXG4gICAgPlxuICAgICAgey8qIFBsYWNlIHlvdXIgMjAweDIwMCBpbWFnZSBoZXJlIGFzOiAqL31cbiAgICAgIHsvKiA8aW1nIHNyYz1cIi9wYXRoL3RvL3lvdXIvaW1hZ2UucG5nXCIgYWx0PVwiS2FyYW9rZVwiIHN0eWxlPVwid2lkdGg6IDEwMCU7IGhlaWdodDogMTAwJTsgb2JqZWN0LWZpdDogY292ZXI7XCIgLz4gKi99XG4gICAgICBcbiAgICAgIHsvKiBGb3Igbm93LCB1c2luZyBhIHBsYWNlaG9sZGVyIGljb24gKi99XG4gICAgICA8c3BhbiBzdHlsZT17eyAnZm9udC1zaXplJzogJzM2cHgnIH19PvCfjqQ8L3NwYW4+XG4gICAgPC9idXR0b24+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCBJY29uWFJlZ3VsYXIgZnJvbSAncGhvc3Bob3ItaWNvbnMtc29saWQvSWNvblhSZWd1bGFyJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByYWN0aWNlSGVhZGVyUHJvcHMge1xuICB0aXRsZT86IHN0cmluZztcbiAgb25FeGl0OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFByYWN0aWNlSGVhZGVyOiBDb21wb25lbnQ8UHJhY3RpY2VIZWFkZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8U2hvdyB3aGVuPXtwcm9wcy50aXRsZX0+XG4gICAgICA8aGVhZGVyIGNsYXNzPXtjbignZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgaC0xNCBweC00IGJnLXRyYW5zcGFyZW50JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgICAgPGgxIGNsYXNzPVwidGV4dC1sZyBmb250LXNlbWlib2xkIHRleHQtcHJpbWFyeVwiPlxuICAgICAgICAgIHtwcm9wcy50aXRsZX1cbiAgICAgICAgPC9oMT5cbiAgICAgIDwvaGVhZGVyPlxuICAgIDwvU2hvdz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL0J1dHRvbic7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBFeGVyY2lzZUZvb3RlclByb3BzIHtcbiAgaXNSZWNvcmRpbmc/OiBib29sZWFuO1xuICBpc1Byb2Nlc3Npbmc/OiBib29sZWFuO1xuICBjYW5TdWJtaXQ/OiBib29sZWFuO1xuICBvblJlY29yZD86ICgpID0+IHZvaWQ7XG4gIG9uU3RvcD86ICgpID0+IHZvaWQ7XG4gIG9uU3VibWl0PzogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBFeGVyY2lzZUZvb3RlcjogQ29tcG9uZW50PEV4ZXJjaXNlRm9vdGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGZvb3RlciBjbGFzcz17Y24oJ2JvcmRlci10IGJvcmRlci1ncmF5LTcwMCBiZy1zdXJmYWNlIHAtNicsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8ZGl2IGNsYXNzPVwibWF4LXctMnhsIG14LWF1dG9cIj5cbiAgICAgICAgPFNob3dcbiAgICAgICAgICB3aGVuPXshcHJvcHMuaXNSZWNvcmRpbmd9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgIGZ1bGxXaWR0aFxuICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblN0b3B9XG4gICAgICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5pc1Byb2Nlc3Npbmd9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIFN0b3BcbiAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIH1cbiAgICAgICAgPlxuICAgICAgICAgIDxTaG93XG4gICAgICAgICAgICB3aGVuPXtwcm9wcy5jYW5TdWJtaXR9XG4gICAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblJlY29yZH1cbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17cHJvcHMuaXNQcm9jZXNzaW5nfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgUmVjb3JkXG4gICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgdmFyaWFudD1cInByaW1hcnlcIlxuICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25TdWJtaXR9XG4gICAgICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5pc1Byb2Nlc3Npbmd9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtwcm9wcy5pc1Byb2Nlc3NpbmcgPyAnUHJvY2Vzc2luZy4uLicgOiAnU3VibWl0J31cbiAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgPC9TaG93PlxuICAgICAgPC9kaXY+XG4gICAgPC9mb290ZXI+XG4gICk7XG59OyIsImV4cG9ydCBkZWZhdWx0IChwKSA9PiAoPHN2ZyBjbGFzcz17cC5jbGFzc30gZGF0YS1waG9zcGhvci1pY29uPVwiY2hlY2stY2lyY2xlXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCIgd2lkdGg9XCIxZW1cIiBoZWlnaHQ9XCIxZW1cIiBwb2ludGVyLWV2ZW50cz1cIm5vbmVcIiBkaXNwbGF5PVwiaW5saW5lLWJsb2NrXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiB2aWV3Qm94PVwiMCAwIDI1NiAyNTZcIj48cGF0aCBkPVwiTTEyOCAyNGExMDQgMTA0IDAgMSAwIDEwNCAxMDRBMTA0LjExIDEwNC4xMSAwIDAgMCAxMjggMjRtNDUuNjYgODUuNjYtNTYgNTZhOCA4IDAgMCAxLTExLjMyIDBsLTI0LTI0YTggOCAwIDAgMSAxMS4zMi0xMS4zMkwxMTIgMTQ4LjY5bDUwLjM0LTUwLjM1YTggOCAwIDAgMSAxMS4zMiAxMS4zMlwiLz48L3N2Zz4pO1xuIiwiZXhwb3J0IGRlZmF1bHQgKHApID0+ICg8c3ZnIGNsYXNzPXtwLmNsYXNzfSBkYXRhLXBob3NwaG9yLWljb249XCJ4LWNpcmNsZVwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiIHdpZHRoPVwiMWVtXCIgaGVpZ2h0PVwiMWVtXCIgcG9pbnRlci1ldmVudHM9XCJub25lXCIgZGlzcGxheT1cImlubGluZS1ibG9ja1wiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBmaWxsPVwiY3VycmVudENvbG9yXCIgdmlld0JveD1cIjAgMCAyNTYgMjU2XCI+PHBhdGggZD1cIk0xMjggMjRhMTA0IDEwNCAwIDEgMCAxMDQgMTA0QTEwNC4xMSAxMDQuMTEgMCAwIDAgMTI4IDI0bTM3LjY2IDEzMC4zNGE4IDggMCAwIDEtMTEuMzIgMTEuMzJMMTI4IDEzOS4zMWwtMjYuMzQgMjYuMzVhOCA4IDAgMCAxLTExLjMyLTExLjMyTDExNi42OSAxMjhsLTI2LjM1LTI2LjM0YTggOCAwIDAgMSAxMS4zMi0xMS4zMkwxMjggMTE2LjY5bDI2LjM0LTI2LjM1YTggOCAwIDAgMSAxMS4zMiAxMS4zMkwxMzkuMzEgMTI4WlwiLz48L3N2Zz4pO1xuIiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL0J1dHRvbic7XG5pbXBvcnQgSWNvbkNoZWNrQ2lyY2xlRmlsbCBmcm9tICdwaG9zcGhvci1pY29ucy1zb2xpZC9JY29uQ2hlY2tDaXJjbGVGaWxsJztcbmltcG9ydCBJY29uWENpcmNsZUZpbGwgZnJvbSAncGhvc3Bob3ItaWNvbnMtc29saWQvSWNvblhDaXJjbGVGaWxsJztcblxuZXhwb3J0IGludGVyZmFjZSBSZXNwb25zZUZvb3RlclByb3BzIHtcbiAgbW9kZTogJ2NoZWNrJyB8ICdmZWVkYmFjayc7XG4gIGlzQ29ycmVjdD86IGJvb2xlYW47XG4gIGZlZWRiYWNrVGV4dD86IHN0cmluZztcbiAgY29udGludWVMYWJlbD86IHN0cmluZztcbiAgb25DaGVjaz86ICgpID0+IHZvaWQ7XG4gIG9uQ29udGludWU/OiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgUmVzcG9uc2VGb290ZXI6IENvbXBvbmVudDxSZXNwb25zZUZvb3RlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9XCJib3JkZXItdCBib3JkZXItZ3JheS03MDAgYmctc3VyZmFjZSBwLTZcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy0yeGwgbXgtYXV0b1wiPlxuICAgICAgICA8U2hvd1xuICAgICAgICAgIHdoZW49e3Byb3BzLm1vZGUgPT09ICdjaGVjayd9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtNlwiPlxuICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuaXNDb3JyZWN0ICE9PSB1bmRlZmluZWR9PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTRcIj5cbiAgICAgICAgICAgICAgICA8U2hvd1xuICAgICAgICAgICAgICAgICAgd2hlbj17cHJvcHMuaXNDb3JyZWN0fVxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9ezxJY29uWENpcmNsZUZpbGwgc3R5bGU9XCJjb2xvcjogI2VmNDQ0NDtcIiBjbGFzcz1cInctMTYgaC0xNiBmbGV4LXNocmluay0wXCIgLz59XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPEljb25DaGVja0NpcmNsZUZpbGwgc3R5bGU9XCJjb2xvcjogIzIyYzU1ZTtcIiBjbGFzcz1cInctMTYgaC0xNiBmbGV4LXNocmluay0wXCIgLz5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC0yeGwgZm9udC1ib2xkXCIgc3R5bGU9e2Bjb2xvcjogJHtwcm9wcy5pc0NvcnJlY3QgPyAnIzIyYzU1ZScgOiAnI2VmNDQ0NCd9O2B9PlxuICAgICAgICAgICAgICAgICAgICB7cHJvcHMuaXNDb3JyZWN0ID8gJ0NvcnJlY3QhJyA6ICdJbmNvcnJlY3QnfVxuICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuZmVlZGJhY2tUZXh0ICYmICFwcm9wcy5pc0NvcnJlY3R9PlxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtYmFzZSB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+e3Byb3BzLmZlZWRiYWNrVGV4dH08L3A+XG4gICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ29udGludWV9XG4gICAgICAgICAgICAgIGNsYXNzPVwibWluLXctWzE4MHB4XVwiXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtwcm9wcy5jb250aW51ZUxhYmVsIHx8ICdOZXh0J31cbiAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICB9XG4gICAgICA+XG4gICAgICAgIDxCdXR0b25cbiAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNoZWNrfVxuICAgICAgICA+XG4gICAgICAgICAgQ2hlY2tcbiAgICAgICAgPC9CdXR0b24+XG4gICAgICA8L1Nob3c+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQsIEpTWCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4ZXJjaXNlVGVtcGxhdGVQcm9wcyB7XG4gIGluc3RydWN0aW9uVGV4dD86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEV4ZXJjaXNlVGVtcGxhdGU6IENvbXBvbmVudDxFeGVyY2lzZVRlbXBsYXRlUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgaC1mdWxsIGJnLWJhc2UgdGV4dC1wcmltYXJ5JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LWdyb3cgb3ZlcmZsb3cteS1hdXRvIGZsZXggZmxleC1jb2wgcGItMjRcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInctZnVsbCBtYXgtdy0yeGwgbXgtYXV0byBweC00IHB5LThcIj5cbiAgICAgICAgICB7cHJvcHMuaW5zdHJ1Y3Rpb25UZXh0ICYmIChcbiAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1sZyB0ZXh0LW11dGVkLWZvcmVncm91bmQgbWItNCB0ZXh0LWxlZnRcIj5cbiAgICAgICAgICAgICAge3Byb3BzLmluc3RydWN0aW9uVGV4dH1cbiAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICApfVxuICAgICAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVhZEFsb3VkUHJvcHMge1xuICBwcm9tcHQ6IHN0cmluZztcbiAgdXNlclRyYW5zY3JpcHQ/OiBzdHJpbmc7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgUmVhZEFsb3VkOiBDb21wb25lbnQ8UmVhZEFsb3VkUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ3NwYWNlLXktNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8cCBjbGFzcz1cInRleHQtMnhsIHRleHQtbGVmdCBsZWFkaW5nLXJlbGF4ZWRcIj5cbiAgICAgICAge3Byb3BzLnByb21wdH1cbiAgICAgIDwvcD5cbiAgICAgIFxuICAgICAgPFNob3cgd2hlbj17cHJvcHMudXNlclRyYW5zY3JpcHR9PlxuICAgICAgICA8ZGl2IGNsYXNzPVwibXQtOFwiPlxuICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1sZyB0ZXh0LW11dGVkLWZvcmVncm91bmQgbWItNFwiPllvdSBzYWlkOjwvcD5cbiAgICAgICAgICA8cCBjbGFzcz1cInRleHQtMnhsIHRleHQtbGVmdCBsZWFkaW5nLXJlbGF4ZWRcIj5cbiAgICAgICAgICAgIHtwcm9wcy51c2VyVHJhbnNjcmlwdH1cbiAgICAgICAgICA8L3A+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNyZWF0ZVJlc291cmNlLCBTaG93LCBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IFJlYWRBbG91ZCB9IGZyb20gJy4uL1JlYWRBbG91ZCc7XG5pbXBvcnQgeyBQcm9ncmVzc0JhciB9IGZyb20gJy4uLy4uL2NvbW1vbi9Qcm9ncmVzc0Jhcic7XG5pbXBvcnQgeyBQcmFjdGljZUhlYWRlciB9IGZyb20gJy4uL1ByYWN0aWNlSGVhZGVyJztcbmltcG9ydCB7IEV4ZXJjaXNlVGVtcGxhdGUgfSBmcm9tICcuLi9FeGVyY2lzZVRlbXBsYXRlJztcbmltcG9ydCB7IEV4ZXJjaXNlRm9vdGVyIH0gZnJvbSAnLi4vRXhlcmNpc2VGb290ZXInO1xuaW1wb3J0IHsgUmVzcG9uc2VGb290ZXIgfSBmcm9tICcuLi9SZXNwb25zZUZvb3Rlcic7XG5pbXBvcnQgdHlwZSB7IFJlYWRBbG91ZEV4ZXJjaXNlIGFzIEV4ZXJjaXNlIH0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByYWN0aWNlRXhlcmNpc2VWaWV3UHJvcHMge1xuICBzZXNzaW9uSWQ/OiBzdHJpbmc7XG4gIG9uQmFjazogKCkgPT4gdm9pZDtcbiAgYXBpQmFzZVVybD86IHN0cmluZztcbiAgYXV0aFRva2VuPzogc3RyaW5nO1xuICBoZWFkZXJUaXRsZT86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFByYWN0aWNlRXhlcmNpc2VWaWV3OiBDb21wb25lbnQ8UHJhY3RpY2VFeGVyY2lzZVZpZXdQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2N1cnJlbnRFeGVyY2lzZUluZGV4LCBzZXRDdXJyZW50RXhlcmNpc2VJbmRleF0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFtpc1JlY29yZGluZywgc2V0SXNSZWNvcmRpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2lzUHJvY2Vzc2luZywgc2V0SXNQcm9jZXNzaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFt1c2VyVHJhbnNjcmlwdCwgc2V0VXNlclRyYW5zY3JpcHRdID0gY3JlYXRlU2lnbmFsKCcnKTtcbiAgY29uc3QgW2N1cnJlbnRTY29yZSwgc2V0Q3VycmVudFNjb3JlXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW21lZGlhUmVjb3JkZXIsIHNldE1lZGlhUmVjb3JkZXJdID0gY3JlYXRlU2lnbmFsPE1lZGlhUmVjb3JkZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2F1ZGlvQ2h1bmtzLCBzZXRBdWRpb0NodW5rc10gPSBjcmVhdGVTaWduYWw8QmxvYltdPihbXSk7XG4gIGNvbnN0IFtzaG93RmVlZGJhY2ssIHNldFNob3dGZWVkYmFja10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbaXNDb3JyZWN0LCBzZXRJc0NvcnJlY3RdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgXG4gIGNvbnN0IGFwaUJhc2VVcmwgPSAoKSA9PiBwcm9wcy5hcGlCYXNlVXJsIHx8ICdodHRwOi8vbG9jYWxob3N0Ojg3ODcnO1xuICBcbiAgLy8gRmV0Y2ggZXhlcmNpc2VzIGZyb20gdGhlIEFQSVxuICBjb25zdCBbZXhlcmNpc2VzXSA9IGNyZWF0ZVJlc291cmNlKGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgLy8gSW5jbHVkZSBzZXNzaW9uSWQgaWYgcHJvdmlkZWQgdG8gZ2V0IGV4ZXJjaXNlcyBmcm9tIHRoaXMgc2Vzc2lvbiBvbmx5XG4gICAgICBjb25zdCB1cmwgPSBwcm9wcy5zZXNzaW9uSWQgXG4gICAgICAgID8gYCR7YXBpQmFzZVVybCgpfS9hcGkvcHJhY3RpY2UvZXhlcmNpc2VzP2xpbWl0PTEwJnNlc3Npb25JZD0ke3Byb3BzLnNlc3Npb25JZH1gXG4gICAgICAgIDogYCR7YXBpQmFzZVVybCgpfS9hcGkvcHJhY3RpY2UvZXhlcmNpc2VzP2xpbWl0PTEwYDtcbiAgICAgIFxuICAgICAgY29uc3QgaGVhZGVyczogSGVhZGVyc0luaXQgPSB7fTtcbiAgICAgIGlmIChwcm9wcy5hdXRoVG9rZW4pIHtcbiAgICAgICAgaGVhZGVyc1snQXV0aG9yaXphdGlvbiddID0gYEJlYXJlciAke3Byb3BzLmF1dGhUb2tlbn1gO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwgeyBoZWFkZXJzIH0pO1xuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCBlcnJvclRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQcmFjdGljZUV4ZXJjaXNlVmlld10gQVBJIGVycm9yOicsIHJlc3BvbnNlLnN0YXR1cywgZXJyb3JUZXh0KTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gZmV0Y2ggZXhlcmNpc2VzJyk7XG4gICAgICB9XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgXG4gICAgICBpZiAoZGF0YS5kYXRhICYmIGRhdGEuZGF0YS5leGVyY2lzZXMpIHtcbiAgICAgICAgcmV0dXJuIGRhdGEuZGF0YS5leGVyY2lzZXMgYXMgRXhlcmNpc2VbXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBbXTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW1ByYWN0aWNlRXhlcmNpc2VWaWV3XSBGYWlsZWQgdG8gZmV0Y2g6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gTG9nIHdoZW4gZXhlcmNpc2VzIGxvYWRcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBleGVyY2lzZUxpc3QgPSBleGVyY2lzZXMoKTtcbiAgfSk7XG5cbiAgY29uc3QgaGFuZGxlU3RhcnRSZWNvcmRpbmcgPSBhc3luYyAoKSA9PiB7XG4gICAgc2V0VXNlclRyYW5zY3JpcHQoJycpO1xuICAgIHNldEN1cnJlbnRTY29yZShudWxsKTtcbiAgICBzZXRBdWRpb0NodW5rcyhbXSk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN0cmVhbSA9IGF3YWl0IG5hdmlnYXRvci5tZWRpYURldmljZXMuZ2V0VXNlck1lZGlhKHsgXG4gICAgICAgIGF1ZGlvOiB7XG4gICAgICAgICAgZWNob0NhbmNlbGxhdGlvbjogdHJ1ZSxcbiAgICAgICAgICBub2lzZVN1cHByZXNzaW9uOiB0cnVlLFxuICAgICAgICAgIGF1dG9HYWluQ29udHJvbDogdHJ1ZVxuICAgICAgICB9IFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IG1pbWVUeXBlID0gTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQoJ2F1ZGlvL3dlYm07Y29kZWNzPW9wdXMnKSBcbiAgICAgICAgPyAnYXVkaW8vd2VibTtjb2RlY3M9b3B1cycgXG4gICAgICAgIDogJ2F1ZGlvL3dlYm0nO1xuICAgICAgICBcbiAgICAgIGNvbnN0IHJlY29yZGVyID0gbmV3IE1lZGlhUmVjb3JkZXIoc3RyZWFtLCB7IG1pbWVUeXBlIH0pO1xuICAgICAgY29uc3QgY2h1bmtzOiBCbG9iW10gPSBbXTtcbiAgICAgIFxuICAgICAgcmVjb3JkZXIub25kYXRhYXZhaWxhYmxlID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIGlmIChldmVudC5kYXRhLnNpemUgPiAwKSB7XG4gICAgICAgICAgY2h1bmtzLnB1c2goZXZlbnQuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBcbiAgICAgIHJlY29yZGVyLm9uc3RvcCA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgYXVkaW9CbG9iID0gbmV3IEJsb2IoY2h1bmtzLCB7IHR5cGU6IG1pbWVUeXBlIH0pO1xuICAgICAgICBhd2FpdCBwcm9jZXNzUmVjb3JkaW5nKGF1ZGlvQmxvYik7XG4gICAgICAgIFxuICAgICAgICAvLyBTdG9wIGFsbCB0cmFja3NcbiAgICAgICAgc3RyZWFtLmdldFRyYWNrcygpLmZvckVhY2godHJhY2sgPT4gdHJhY2suc3RvcCgpKTtcbiAgICAgIH07XG4gICAgICBcbiAgICAgIHJlY29yZGVyLnN0YXJ0KCk7XG4gICAgICBzZXRNZWRpYVJlY29yZGVyKHJlY29yZGVyKTtcbiAgICAgIHNldElzUmVjb3JkaW5nKHRydWUpO1xuICAgICAgXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQcmFjdGljZUV4ZXJjaXNlVmlld10gRmFpbGVkIHRvIHN0YXJ0IHJlY29yZGluZzonLCBlcnJvcik7XG4gICAgICBzZXRJc1JlY29yZGluZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IHByb2Nlc3NSZWNvcmRpbmcgPSBhc3luYyAoYmxvYjogQmxvYikgPT4ge1xuICAgIHRyeSB7XG4gICAgICBzZXRJc1Byb2Nlc3NpbmcodHJ1ZSk7XG4gICAgICBcbiAgICAgIC8vIENvbnZlcnQgdG8gYmFzZTY0IGZvciBBUElcbiAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICBjb25zdCBiYXNlNjQgPSBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgYmFzZTY0U3RyaW5nID0gcmVhZGVyLnJlc3VsdCBhcyBzdHJpbmc7XG4gICAgICAgICAgcmVzb2x2ZShiYXNlNjRTdHJpbmcuc3BsaXQoJywnKVsxXSk7XG4gICAgICAgIH07XG4gICAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKGJsb2IpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIFNlbmQgdG8gU1RUIEFQSSB3aXRoIHJldHJ5IGxvZ2ljXG4gICAgICBsZXQgcmVzcG9uc2U7XG4gICAgICBsZXQgYXR0ZW1wdHMgPSAwO1xuICAgICAgY29uc3QgbWF4QXR0ZW1wdHMgPSAyO1xuICAgICAgXG4gICAgICBjb25zdCBoZWFkZXJzOiBIZWFkZXJzSW5pdCA9IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9O1xuICAgICAgaWYgKHByb3BzLmF1dGhUb2tlbikge1xuICAgICAgICBoZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSBgQmVhcmVyICR7cHJvcHMuYXV0aFRva2VufWA7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHdoaWxlIChhdHRlbXB0cyA8IG1heEF0dGVtcHRzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHthcGlCYXNlVXJsKCl9L2FwaS9zcGVlY2gtdG8tdGV4dC90cmFuc2NyaWJlYCwge1xuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICBoZWFkZXJzLFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBcbiAgICAgICAgICAgICAgYXVkaW9CYXNlNjQ6IGJhc2U2NCxcbiAgICAgICAgICAgICAgZXhwZWN0ZWRUZXh0OiBjdXJyZW50RXhlcmNpc2UoKT8uZnVsbF9saW5lLFxuICAgICAgICAgICAgICAvLyBVc2UgRGVlcGdyYW0gb24gcmV0cnlcbiAgICAgICAgICAgICAgcHJlZmVyRGVlcGdyYW06IGF0dGVtcHRzID4gMFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZmV0Y2hFcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtQcmFjdGljZUV4ZXJjaXNlVmlld10gU1RUIGF0dGVtcHQgJHthdHRlbXB0cyArIDF9IGZhaWxlZDpgLCBmZXRjaEVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXR0ZW1wdHMrKztcbiAgICAgICAgaWYgKGF0dGVtcHRzIDwgbWF4QXR0ZW1wdHMpIHtcbiAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgNTAwKSk7IC8vIFNtYWxsIGRlbGF5IGJlZm9yZSByZXRyeVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIHNldFVzZXJUcmFuc2NyaXB0KHJlc3VsdC5kYXRhLnRyYW5zY3JpcHQpO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2FsY3VsYXRlIGEgc2ltcGxlIHNjb3JlIGJhc2VkIG9uIG1hdGNoaW5nIHdvcmRzXG4gICAgICAgIGNvbnN0IHNjb3JlID0gY2FsY3VsYXRlU2NvcmUoY3VycmVudEV4ZXJjaXNlKCk/LmZ1bGxfbGluZSB8fCAnJywgcmVzdWx0LmRhdGEudHJhbnNjcmlwdCk7XG4gICAgICAgIHNldEN1cnJlbnRTY29yZShzY29yZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBBdXRvbWF0aWNhbGx5IHN1Ym1pdCBhZnRlciB0cmFuc2NyaXB0aW9uXG4gICAgICAgIGF3YWl0IGhhbmRsZUF1dG9TdWJtaXQoc2NvcmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTVFQgZmFpbGVkIGFmdGVyIHJldHJpZXMnKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW1ByYWN0aWNlRXhlcmNpc2VWaWV3XSBGYWlsZWQgdG8gcHJvY2VzcyByZWNvcmRpbmc6JywgZXJyb3IpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRJc1Byb2Nlc3NpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVTdG9wUmVjb3JkaW5nID0gKCkgPT4ge1xuICAgIGNvbnN0IHJlY29yZGVyID0gbWVkaWFSZWNvcmRlcigpO1xuICAgIGlmIChyZWNvcmRlciAmJiByZWNvcmRlci5zdGF0ZSAhPT0gJ2luYWN0aXZlJykge1xuICAgICAgcmVjb3JkZXIuc3RvcCgpO1xuICAgICAgc2V0SXNSZWNvcmRpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICAvLyBOb3JtYWxpemUgdGV4dCBmb3IgY29tcGFyaXNvbiAoc2FtZSBhcyBzZXJ2ZXItc2lkZSlcbiAgY29uc3Qgbm9ybWFsaXplVGV4dCA9ICh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICAgIHJldHVybiB0ZXh0XG4gICAgICAudG9Mb3dlckNhc2UoKVxuICAgICAgLnJlcGxhY2UoL1teXFx3XFxzJy1dL2csICcnKSAvLyBSZW1vdmUgcHVuY3R1YXRpb24gZXhjZXB0IGFwb3N0cm9waGVzIGFuZCBoeXBoZW5zXG4gICAgICAucmVwbGFjZSgvXFxzKy9nLCAnICcpXG4gICAgICAudHJpbSgpO1xuICB9O1xuICBcbiAgY29uc3QgY2FsY3VsYXRlU2NvcmUgPSAoZXhwZWN0ZWQ6IHN0cmluZywgYWN0dWFsOiBzdHJpbmcpOiBudW1iZXIgPT4ge1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRFeHBlY3RlZCA9IG5vcm1hbGl6ZVRleHQoZXhwZWN0ZWQpO1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRBY3R1YWwgPSBub3JtYWxpemVUZXh0KGFjdHVhbCk7XG4gICAgXG4gICAgLy8gSWYgdGhleSdyZSBleGFjdGx5IHRoZSBzYW1lIGFmdGVyIG5vcm1hbGl6YXRpb24sIGl0J3MgMTAwJVxuICAgIGlmIChub3JtYWxpemVkRXhwZWN0ZWQgPT09IG5vcm1hbGl6ZWRBY3R1YWwpIHtcbiAgICAgIHJldHVybiAxMDA7XG4gICAgfVxuICAgIFxuICAgIC8vIE90aGVyd2lzZSwgZG8gd29yZC1ieS13b3JkIGNvbXBhcmlzb25cbiAgICBjb25zdCBleHBlY3RlZFdvcmRzID0gbm9ybWFsaXplZEV4cGVjdGVkLnNwbGl0KC9cXHMrLyk7XG4gICAgY29uc3QgYWN0dWFsV29yZHMgPSBub3JtYWxpemVkQWN0dWFsLnNwbGl0KC9cXHMrLyk7XG4gICAgbGV0IG1hdGNoZXMgPSAwO1xuICAgIFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwZWN0ZWRXb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFjdHVhbFdvcmRzW2ldID09PSBleHBlY3RlZFdvcmRzW2ldKSB7XG4gICAgICAgIG1hdGNoZXMrKztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIE1hdGgucm91bmQoKG1hdGNoZXMgLyBleHBlY3RlZFdvcmRzLmxlbmd0aCkgKiAxMDApO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUF1dG9TdWJtaXQgPSBhc3luYyAoc2NvcmU6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IGN1cnJlbnRFeGVyY2lzZSA9IGV4ZXJjaXNlcygpPy5bY3VycmVudEV4ZXJjaXNlSW5kZXgoKV07XG4gICAgY29uc3QgY2h1bmtzID0gYXVkaW9DaHVua3MoKTtcbiAgICBjb25zdCBibG9iID0gY2h1bmtzLmxlbmd0aCA+IDAgPyBuZXcgQmxvYihjaHVua3MsIHsgdHlwZTogJ2F1ZGlvL3dlYm0nIH0pIDogbnVsbDtcbiAgICBcbiAgICAvLyBEZXRlcm1pbmUgaWYgY29ycmVjdCAoMTAwJSBhZnRlciBub3JtYWxpemF0aW9uKVxuICAgIHNldElzQ29ycmVjdChzY29yZSA9PT0gMTAwKTtcbiAgICBzZXRTaG93RmVlZGJhY2sodHJ1ZSk7XG4gICAgXG4gICAgaWYgKGN1cnJlbnRFeGVyY2lzZSAmJiBjdXJyZW50RXhlcmNpc2UuY2FyZF9pZHMubGVuZ3RoID4gMCAmJiBibG9iKSB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyBDb252ZXJ0IGF1ZGlvIHRvIGJhc2U2NFxuICAgICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgICBjb25zdCBiYXNlNjQgPSBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgcmVhZGVyLm9ubG9hZGVuZCA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGJhc2U2NFN0cmluZyA9IHJlYWRlci5yZXN1bHQgYXMgc3RyaW5nO1xuICAgICAgICAgICAgcmVzb2x2ZShiYXNlNjRTdHJpbmcuc3BsaXQoJywnKVsxXSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgICByZWFkZXIucmVhZEFzRGF0YVVSTChibG9iKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgaGVhZGVyczogSGVhZGVyc0luaXQgPSB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfTtcbiAgICAgICAgaWYgKHByb3BzLmF1dGhUb2tlbikge1xuICAgICAgICAgIGhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9IGBCZWFyZXIgJHtwcm9wcy5hdXRoVG9rZW59YDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN1Ym1pdCByZXZpZXdcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHthcGlCYXNlVXJsKCl9L2FwaS9wcmFjdGljZS9yZXZpZXdgLCB7XG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgaGVhZGVycyxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBleGVyY2lzZUlkOiBjdXJyZW50RXhlcmNpc2UuaWQsXG4gICAgICAgICAgICBhdWRpb0Jhc2U2NDogYmFzZTY0LFxuICAgICAgICAgICAgY2FyZFNjb3JlczogY3VycmVudEV4ZXJjaXNlLmNhcmRfaWRzLm1hcChjYXJkSWQgPT4gKHtcbiAgICAgICAgICAgICAgY2FyZElkLFxuICAgICAgICAgICAgICBzY29yZVxuICAgICAgICAgICAgfSkpXG4gICAgICAgICAgfSlcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQcmFjdGljZUV4ZXJjaXNlVmlld10gRmFpbGVkIHRvIHN1Ym1pdCByZXZpZXc6JywgZXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGhhbmRsZVN1Ym1pdCA9IGFzeW5jICgpID0+IHtcbiAgICAvLyBUaGlzIGlzIG5vdyBvbmx5IHVzZWQgYXMgZmFsbGJhY2sgaWYgbmVlZGVkXG4gICAgY29uc3Qgc2NvcmUgPSBjdXJyZW50U2NvcmUoKTtcbiAgICBpZiAoc2NvcmUgIT09IG51bGwpIHtcbiAgICAgIGF3YWl0IGhhbmRsZUF1dG9TdWJtaXQoc2NvcmUpO1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGhhbmRsZUNvbnRpbnVlID0gKCkgPT4ge1xuICAgIC8vIE1vdmUgdG8gbmV4dCBleGVyY2lzZVxuICAgIGlmIChjdXJyZW50RXhlcmNpc2VJbmRleCgpIDwgKGV4ZXJjaXNlcygpPy5sZW5ndGggfHwgMCkgLSAxKSB7XG4gICAgICBzZXRDdXJyZW50RXhlcmNpc2VJbmRleChjdXJyZW50RXhlcmNpc2VJbmRleCgpICsgMSk7XG4gICAgICBzZXRVc2VyVHJhbnNjcmlwdCgnJyk7XG4gICAgICBzZXRDdXJyZW50U2NvcmUobnVsbCk7XG4gICAgICBzZXRBdWRpb0NodW5rcyhbXSk7XG4gICAgICBzZXRTaG93RmVlZGJhY2soZmFsc2UpO1xuICAgICAgc2V0SXNDb3JyZWN0KGZhbHNlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQWxsIGV4ZXJjaXNlcyBjb21wbGV0ZWRcbiAgICAgIHByb3BzLm9uQmFjaygpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVTa2lwID0gKCkgPT4ge1xuICAgIFxuICAgIC8vIE1vdmUgdG8gbmV4dCBleGVyY2lzZVxuICAgIGlmIChjdXJyZW50RXhlcmNpc2VJbmRleCgpIDwgKGV4ZXJjaXNlcygpPy5sZW5ndGggfHwgMCkgLSAxKSB7XG4gICAgICBzZXRDdXJyZW50RXhlcmNpc2VJbmRleChjdXJyZW50RXhlcmNpc2VJbmRleCgpICsgMSk7XG4gICAgICBzZXRVc2VyVHJhbnNjcmlwdCgnJyk7XG4gICAgICBzZXRDdXJyZW50U2NvcmUobnVsbCk7XG4gICAgICBzZXRBdWRpb0NodW5rcyhbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEFsbCBleGVyY2lzZXMgY29tcGxldGVkXG4gICAgICBwcm9wcy5vbkJhY2soKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgY3VycmVudEV4ZXJjaXNlID0gKCkgPT4gZXhlcmNpc2VzKCk/LltjdXJyZW50RXhlcmNpc2VJbmRleCgpXTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9XCJoLWZ1bGwgYmctYmFzZSBmbGV4IGZsZXgtY29sXCI+XG4gICAgICA8U2hvd1xuICAgICAgICB3aGVuPXshZXhlcmNpc2VzLmxvYWRpbmd9XG4gICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFuaW1hdGUtc3BpbiByb3VuZGVkLWZ1bGwgaC0xMiB3LTEyIGJvcmRlci1iLTIgYm9yZGVyLWFjY2VudC1wcmltYXJ5IG14LWF1dG8gbWItNFwiPjwvZGl2PlxuICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbXV0ZWQtZm9yZWdyb3VuZFwiPkxvYWRpbmcgZXhlcmNpc2VzLi4uPC9wPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIH1cbiAgICAgID5cbiAgICAgICAgPFNob3dcbiAgICAgICAgICB3aGVuPXsoZXhlcmNpc2VzKCkgfHwgW10pLmxlbmd0aCA+IDB9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLThcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIG1heC13LW1kXCI+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtbXV0ZWQtZm9yZWdyb3VuZCBtYi00XCI+Tm8gcHJhY3RpY2UgZXhlcmNpc2VzIGF2YWlsYWJsZSB5ZXQuPC9wPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zbSB0ZXh0LW11dGVkLWZvcmVncm91bmRcIj5Db21wbGV0ZSBrYXJhb2tlIHNlc3Npb25zIHdpdGggZXJyb3JzIHRvIGdlbmVyYXRlIHBlcnNvbmFsaXplZCBleGVyY2lzZXMhPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIH1cbiAgICAgICAgPlxuICAgICAgICAgIDxTaG93IHdoZW49e2N1cnJlbnRFeGVyY2lzZSgpfT5cbiAgICAgICAgICAgIHsoZXhlcmNpc2UpID0+IChcbiAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICA8UHJvZ3Jlc3NCYXIgXG4gICAgICAgICAgICAgICAgICBjdXJyZW50PXtjdXJyZW50RXhlcmNpc2VJbmRleCgpICsgMX0gXG4gICAgICAgICAgICAgICAgICB0b3RhbD17ZXhlcmNpc2VzKCk/Lmxlbmd0aCB8fCAwfSBcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxQcmFjdGljZUhlYWRlciBcbiAgICAgICAgICAgICAgICAgIHRpdGxlPXtwcm9wcy5oZWFkZXJUaXRsZSB8fCBcIlwifSBcbiAgICAgICAgICAgICAgICAgIG9uRXhpdD17cHJvcHMub25CYWNrfSBcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxtYWluIGNsYXNzPVwiZmxleC0xXCI+XG4gICAgICAgICAgICAgICAgICA8RXhlcmNpc2VUZW1wbGF0ZSBpbnN0cnVjdGlvblRleHQ9XCJSZWFkIGFsb3VkOlwiPlxuICAgICAgICAgICAgICAgICAgICA8UmVhZEFsb3VkXG4gICAgICAgICAgICAgICAgICAgICAgcHJvbXB0PXtleGVyY2lzZSgpLmZ1bGxfbGluZX1cbiAgICAgICAgICAgICAgICAgICAgICB1c2VyVHJhbnNjcmlwdD17dXNlclRyYW5zY3JpcHQoKX1cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgIDwvRXhlcmNpc2VUZW1wbGF0ZT5cbiAgICAgICAgICAgICAgICA8L21haW4+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgPFNob3dcbiAgICAgICAgICAgICAgICAgIHdoZW49e3Nob3dGZWVkYmFjaygpfVxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgICAgICA8RXhlcmNpc2VGb290ZXJcbiAgICAgICAgICAgICAgICAgICAgICBpc1JlY29yZGluZz17aXNSZWNvcmRpbmcoKX1cbiAgICAgICAgICAgICAgICAgICAgICBpc1Byb2Nlc3Npbmc9e2lzUHJvY2Vzc2luZygpfVxuICAgICAgICAgICAgICAgICAgICAgIGNhblN1Ym1pdD17dXNlclRyYW5zY3JpcHQoKS50cmltKCkubGVuZ3RoID4gMH1cbiAgICAgICAgICAgICAgICAgICAgICBvblJlY29yZD17aGFuZGxlU3RhcnRSZWNvcmRpbmd9XG4gICAgICAgICAgICAgICAgICAgICAgb25TdG9wPXtoYW5kbGVTdG9wUmVjb3JkaW5nfVxuICAgICAgICAgICAgICAgICAgICAgIG9uU3VibWl0PXtoYW5kbGVTdWJtaXR9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPFJlc3BvbnNlRm9vdGVyXG4gICAgICAgICAgICAgICAgICAgIG1vZGU9XCJmZWVkYmFja1wiXG4gICAgICAgICAgICAgICAgICAgIGlzQ29ycmVjdD17aXNDb3JyZWN0KCl9XG4gICAgICAgICAgICAgICAgICAgIG9uQ29udGludWU9e2hhbmRsZUNvbnRpbnVlfVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvU2hvdz5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBTaG93LCBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB7IFVzZXJQcm9maWxlIH0gZnJvbSAnLi4vVXNlclByb2ZpbGUnO1xuaW1wb3J0IHsgQ3JlZGl0UGFjayB9IGZyb20gJy4uL0NyZWRpdFBhY2snO1xuaW1wb3J0IHsgV2FsbGV0Q29ubmVjdCB9IGZyb20gJy4uL1dhbGxldENvbm5lY3QnO1xuaW1wb3J0IHsgRmFyY2FzdGVyS2FyYW9rZVZpZXcgfSBmcm9tICcuLi8uLi9rYXJhb2tlL0ZhcmNhc3RlckthcmFva2VWaWV3JztcbmltcG9ydCB0eXBlIHsgTHlyaWNMaW5lIH0gZnJvbSAnLi4vLi4va2FyYW9rZS9MeXJpY3NEaXNwbGF5JztcbmltcG9ydCB0eXBlIHsgTGVhZGVyYm9hcmRFbnRyeSB9IGZyb20gJy4uLy4uL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmFyY2FzdGVyTWluaUFwcFByb3BzIHtcbiAgLy8gVXNlciBpbmZvXG4gIHVzZXI/OiB7XG4gICAgZmlkPzogbnVtYmVyO1xuICAgIHVzZXJuYW1lPzogc3RyaW5nO1xuICAgIGRpc3BsYXlOYW1lPzogc3RyaW5nO1xuICAgIHBmcFVybD86IHN0cmluZztcbiAgfTtcbiAgXG4gIC8vIFdhbGxldFxuICB3YWxsZXRBZGRyZXNzPzogc3RyaW5nO1xuICB3YWxsZXRDaGFpbj86ICdCYXNlJyB8ICdTb2xhbmEnO1xuICBpc1dhbGxldENvbm5lY3RlZD86IGJvb2xlYW47XG4gIFxuICAvLyBDcmVkaXRzXG4gIHVzZXJDcmVkaXRzPzogbnVtYmVyO1xuICBcbiAgLy8gQ2FsbGJhY2tzXG4gIG9uQ29ubmVjdFdhbGxldD86ICgpID0+IHZvaWQ7XG4gIG9uRGlzY29ubmVjdFdhbGxldD86ICgpID0+IHZvaWQ7XG4gIG9uUHVyY2hhc2VDcmVkaXRzPzogKHBhY2s6IHsgY3JlZGl0czogbnVtYmVyOyBwcmljZTogc3RyaW5nOyBjdXJyZW5jeTogc3RyaW5nIH0pID0+IHZvaWQ7XG4gIG9uU2VsZWN0U29uZz86ICgpID0+IHZvaWQ7XG4gIFxuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEZhcmNhc3Rlck1pbmlBcHA6IENvbXBvbmVudDxGYXJjYXN0ZXJNaW5pQXBwUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtzaG93S2FyYW9rZSwgc2V0U2hvd0thcmFva2VdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgXG4gIC8vIE1vY2sgZGF0YSBmb3IgZGVtb1xuICBjb25zdCBtb2NrTHlyaWNzOiBMeXJpY0xpbmVbXSA9IFtcbiAgICB7IGlkOiAnMScsIHRleHQ6IFwiSXMgdGhpcyB0aGUgcmVhbCBsaWZlP1wiLCBzdGFydFRpbWU6IDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzInLCB0ZXh0OiBcIklzIHRoaXMganVzdCBmYW50YXN5P1wiLCBzdGFydFRpbWU6IDIwMDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzMnLCB0ZXh0OiBcIkNhdWdodCBpbiBhIGxhbmRzbGlkZVwiLCBzdGFydFRpbWU6IDQwMDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzQnLCB0ZXh0OiBcIk5vIGVzY2FwZSBmcm9tIHJlYWxpdHlcIiwgc3RhcnRUaW1lOiA2MDAwLCBkdXJhdGlvbjogMjAwMCB9LFxuICBdO1xuICBcbiAgY29uc3QgbW9ja0xlYWRlcmJvYXJkOiBMZWFkZXJib2FyZEVudHJ5W10gPSBbXG4gICAgeyByYW5rOiAxLCB1c2VybmFtZTogXCJhbGljZVwiLCBzY29yZTogOTgwIH0sXG4gICAgeyByYW5rOiAyLCB1c2VybmFtZTogXCJib2JcIiwgc2NvcmU6IDk0NSB9LFxuICAgIHsgcmFuazogMywgdXNlcm5hbWU6IFwiY2Fyb2xcIiwgc2NvcmU6IDkyMCB9LFxuICBdO1xuXG4gIGNvbnN0IGNyZWRpdFBhY2tzID0gW1xuICAgIHsgY3JlZGl0czogMjUwLCBwcmljZTogJzIuNTAnLCBjdXJyZW5jeTogJ1VTREMnIGFzIGNvbnN0IH0sXG4gICAgeyBjcmVkaXRzOiA1MDAsIHByaWNlOiAnNC43NScsIGN1cnJlbmN5OiAnVVNEQycgYXMgY29uc3QsIGRpc2NvdW50OiA1LCByZWNvbW1lbmRlZDogdHJ1ZSB9LFxuICAgIHsgY3JlZGl0czogMTIwMCwgcHJpY2U6ICcxMC4wMCcsIGN1cnJlbmN5OiAnVVNEQycgYXMgY29uc3QsIGRpc2NvdW50OiAxNiB9LFxuICBdO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgaC1zY3JlZW4gYmctYmFzZScsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogSGVhZGVyIHdpdGggdXNlciBwcm9maWxlICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2UgYm9yZGVyLWIgYm9yZGVyLXN1YnRsZVwiPlxuICAgICAgICA8VXNlclByb2ZpbGVcbiAgICAgICAgICBmaWQ9e3Byb3BzLnVzZXI/LmZpZH1cbiAgICAgICAgICB1c2VybmFtZT17cHJvcHMudXNlcj8udXNlcm5hbWV9XG4gICAgICAgICAgZGlzcGxheU5hbWU9e3Byb3BzLnVzZXI/LmRpc3BsYXlOYW1lfVxuICAgICAgICAgIHBmcFVybD17cHJvcHMudXNlcj8ucGZwVXJsfVxuICAgICAgICAgIGNyZWRpdHM9e3Byb3BzLnVzZXJDcmVkaXRzIHx8IDB9XG4gICAgICAgIC8+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgey8qIE1haW4gY29udGVudCAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgb3ZlcmZsb3ctYXV0b1wiPlxuICAgICAgICA8U2hvd1xuICAgICAgICAgIHdoZW49e3Nob3dLYXJhb2tlKCl9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInAtNCBzcGFjZS15LTZcIj5cbiAgICAgICAgICAgICAgey8qIEhlcm8gc2VjdGlvbiAqL31cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIHB5LThcIj5cbiAgICAgICAgICAgICAgICA8aDEgY2xhc3M9XCJ0ZXh0LTN4bCBmb250LWJvbGQgbWItMlwiPlNjYXJsZXR0IEthcmFva2U8L2gxPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zZWNvbmRhcnlcIj5cbiAgICAgICAgICAgICAgICAgIFNpbmcgeW91ciBmYXZvcml0ZSBzb25ncyBhbmQgY29tcGV0ZSB3aXRoIGZyaWVuZHMhXG4gICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIHsvKiBDcmVkaXRzIGNoZWNrICovfVxuICAgICAgICAgICAgICA8U2hvd1xuICAgICAgICAgICAgICAgIHdoZW49e3Byb3BzLnVzZXJDcmVkaXRzICYmIHByb3BzLnVzZXJDcmVkaXRzID4gMH1cbiAgICAgICAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS02XCI+XG4gICAgICAgICAgICAgICAgICAgIHsvKiBXYWxsZXQgY29ubmVjdGlvbiAqL31cbiAgICAgICAgICAgICAgICAgICAgPFdhbGxldENvbm5lY3RcbiAgICAgICAgICAgICAgICAgICAgICBhZGRyZXNzPXtwcm9wcy53YWxsZXRBZGRyZXNzfVxuICAgICAgICAgICAgICAgICAgICAgIGNoYWluPXtwcm9wcy53YWxsZXRDaGFpbn1cbiAgICAgICAgICAgICAgICAgICAgICBpc0Nvbm5lY3RlZD17cHJvcHMuaXNXYWxsZXRDb25uZWN0ZWR9XG4gICAgICAgICAgICAgICAgICAgICAgb25Db25uZWN0PXtwcm9wcy5vbkNvbm5lY3RXYWxsZXR9XG4gICAgICAgICAgICAgICAgICAgICAgb25EaXNjb25uZWN0PXtwcm9wcy5vbkRpc2Nvbm5lY3RXYWxsZXR9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB7LyogQ3JlZGl0IHBhY2tzICovfVxuICAgICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5pc1dhbGxldENvbm5lY3RlZH0+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQteGwgZm9udC1zZW1pYm9sZCBtYi00XCI+UHVyY2hhc2UgQ3JlZGl0czwvaDI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtMyBnYXAtNFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7Y3JlZGl0UGFja3MubWFwKChwYWNrKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPENyZWRpdFBhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsuLi5wYWNrfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25QdXJjaGFzZT17KCkgPT4gcHJvcHMub25QdXJjaGFzZUNyZWRpdHM/LihwYWNrKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICB7LyogU29uZyBzZWxlY3Rpb24gKi99XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNFwiPlxuICAgICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC14bCBmb250LXNlbWlib2xkXCI+U2VsZWN0IGEgU29uZzwvaDI+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uIFxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBwLTQgYmctc3VyZmFjZSByb3VuZGVkLWxnIGJvcmRlciBib3JkZXItc3VidGxlIGhvdmVyOmJvcmRlci1hY2NlbnQtcHJpbWFyeSB0cmFuc2l0aW9uLWNvbG9ycyB0ZXh0LWxlZnRcIlxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93S2FyYW9rZSh0cnVlKX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZvbnQtc2VtaWJvbGRcIj5Cb2hlbWlhbiBSaGFwc29keTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeVwiPlF1ZWVuPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXhzIHRleHQtdGVydGlhcnkgbXQtMVwiPkNvc3Q6IDUwIGNyZWRpdHM8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICB9XG4gICAgICAgID5cbiAgICAgICAgICA8RmFyY2FzdGVyS2FyYW9rZVZpZXdcbiAgICAgICAgICAgIHNvbmdUaXRsZT1cIkJvaGVtaWFuIFJoYXBzb2R5XCJcbiAgICAgICAgICAgIGFydGlzdD1cIlF1ZWVuXCJcbiAgICAgICAgICAgIHNjb3JlPXswfVxuICAgICAgICAgICAgcmFuaz17MX1cbiAgICAgICAgICAgIGx5cmljcz17bW9ja0x5cmljc31cbiAgICAgICAgICAgIGN1cnJlbnRUaW1lPXswfVxuICAgICAgICAgICAgbGVhZGVyYm9hcmQ9e21vY2tMZWFkZXJib2FyZH1cbiAgICAgICAgICAgIGlzUGxheWluZz17ZmFsc2V9XG4gICAgICAgICAgICBvblN0YXJ0PXsoKSA9PiBjb25zb2xlLmxvZygnU3RhcnQga2FyYW9rZScpfVxuICAgICAgICAgICAgb25TcGVlZENoYW5nZT17KHNwZWVkKSA9PiBjb25zb2xlLmxvZygnU3BlZWQ6Jywgc3BlZWQpfVxuICAgICAgICAgICAgb25CYWNrPXsoKSA9PiBzZXRTaG93S2FyYW9rZShmYWxzZSl9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9TaG93PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3csIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgSlNYIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL0J1dHRvbic7XG5pbXBvcnQgSWNvblVzZXJSZWd1bGFyIGZyb20gJ3Bob3NwaG9yLWljb25zLXNvbGlkL0ljb25Vc2VyUmVndWxhcic7XG5pbXBvcnQgSWNvbkNhcmV0RG93blJlZ3VsYXIgZnJvbSAncGhvc3Bob3ItaWNvbnMtc29saWQvSWNvbkNhcmV0RG93blJlZ3VsYXInO1xuaW1wb3J0IEljb25TaWduT3V0UmVndWxhciBmcm9tICdwaG9zcGhvci1pY29ucy1zb2xpZC9JY29uU2lnbk91dFJlZ3VsYXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIEF1dGhCdXR0b25Qcm9wcyB7XG4gIHVzZXI/OiB7XG4gICAgdXNlcm5hbWU/OiBzdHJpbmc7XG4gICAgYWRkcmVzcz86IHN0cmluZztcbiAgICBhdmF0YXJVcmw/OiBzdHJpbmc7XG4gICAgY3JlZGl0cz86IG51bWJlcjtcbiAgfTtcbiAgaXNMb2FkaW5nPzogYm9vbGVhbjtcbiAgb25TaWduSW5DbGljaz86ICgpID0+IHZvaWQ7XG4gIG9uU2lnbk91dENsaWNrPzogKCkgPT4gdm9pZDtcbiAgdmFyaWFudD86ICdwcmltYXJ5JyB8ICdzZWNvbmRhcnknIHwgJ2dob3N0JztcbiAgc2l6ZT86ICdzbScgfCAnbWQnIHwgJ2xnJztcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBBdXRoQnV0dG9uKHByb3BzOiBBdXRoQnV0dG9uUHJvcHMpIHtcbiAgY29uc3QgW3Nob3dEcm9wZG93biwgc2V0U2hvd0Ryb3Bkb3duXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG5cbiAgY29uc3QgZm9ybWF0QWRkcmVzcyA9IChhZGRyZXNzOiBzdHJpbmcpID0+IHtcbiAgICByZXR1cm4gYCR7YWRkcmVzcy5zbGljZSgwLCA2KX0uLi4ke2FkZHJlc3Muc2xpY2UoLTQpfWA7XG4gIH07XG5cbiAgY29uc3QgZGlzcGxheU5hbWUgPSAoKSA9PiB7XG4gICAgY29uc3QgdXNlciA9IHByb3BzLnVzZXI7XG4gICAgaWYgKCF1c2VyKSByZXR1cm4gJyc7XG4gICAgXG4gICAgaWYgKHVzZXIudXNlcm5hbWUpIHtcbiAgICAgIHJldHVybiBgQCR7dXNlci51c2VybmFtZX1gO1xuICAgIH0gZWxzZSBpZiAodXNlci5hZGRyZXNzKSB7XG4gICAgICByZXR1cm4gZm9ybWF0QWRkcmVzcyh1c2VyLmFkZHJlc3MpO1xuICAgIH1cbiAgICByZXR1cm4gJ1VzZXInO1xuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz1cInJlbGF0aXZlXCI+XG4gICAgICA8U2hvd1xuICAgICAgICB3aGVuPXtwcm9wcy51c2VyfVxuICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgdmFyaWFudD17cHJvcHMudmFyaWFudCB8fCAncHJpbWFyeSd9XG4gICAgICAgICAgICBzaXplPXtwcm9wcy5zaXplIHx8ICdtZCd9XG4gICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblNpZ25JbkNsaWNrfVxuICAgICAgICAgICAgbG9hZGluZz17cHJvcHMuaXNMb2FkaW5nfVxuICAgICAgICAgICAgY2xhc3M9e3Byb3BzLmNsYXNzfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxJY29uVXNlclJlZ3VsYXIgY2xhc3M9XCJ3LTQgaC00IG1yLTJcIiAvPlxuICAgICAgICAgICAgU2lnbiBJblxuICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICB9XG4gICAgICA+XG4gICAgICAgIDxidXR0b25cbiAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93RHJvcGRvd24oIXNob3dEcm9wZG93bigpKX1cbiAgICAgICAgICBjbGFzcz17YFxuICAgICAgICAgICAgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgcHgtNCBweS0yIHJvdW5kZWQtbGdcbiAgICAgICAgICAgIGJnLXN1cmZhY2UtZWxldmF0ZWQgYm9yZGVyIGJvcmRlci1ib3JkZXItc3VidGxlXG4gICAgICAgICAgICBob3ZlcjpiZy1zdXJmYWNlLWhvdmVyIGhvdmVyOmJvcmRlci1ib3JkZXJcbiAgICAgICAgICAgIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMFxuICAgICAgICAgICAgJHtwcm9wcy5jbGFzcyB8fCAnJ31cbiAgICAgICAgICBgfVxuICAgICAgICA+XG4gICAgICAgICAgPFNob3dcbiAgICAgICAgICAgIHdoZW49e3Byb3BzLnVzZXI/LmF2YXRhclVybH1cbiAgICAgICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInctOCBoLTggcm91bmRlZC1mdWxsIGJnLXN1cmZhY2UgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICA8SGlPdXRsaW5lVXNlciBjbGFzcz1cInctNCBoLTQgdGV4dC1jb250ZW50LXNlY29uZGFyeVwiIC8+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxpbWdcbiAgICAgICAgICAgICAgc3JjPXtwcm9wcy51c2VyIS5hdmF0YXJVcmx9XG4gICAgICAgICAgICAgIGFsdD17ZGlzcGxheU5hbWUoKX1cbiAgICAgICAgICAgICAgY2xhc3M9XCJ3LTggaC04IHJvdW5kZWQtZnVsbCBvYmplY3QtY292ZXJcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgXG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtY29udGVudFwiPlxuICAgICAgICAgICAge2Rpc3BsYXlOYW1lKCl9XG4gICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgIFxuICAgICAgICAgIDxIaU91dGxpbmVDaGV2cm9uRG93blxuICAgICAgICAgICAgY2xhc3M9e2B3LTQgaC00IHRleHQtY29udGVudC1zZWNvbmRhcnkgdHJhbnNpdGlvbi10cmFuc2Zvcm0gZHVyYXRpb24tMjAwICR7XG4gICAgICAgICAgICAgIHNob3dEcm9wZG93bigpID8gJ3JvdGF0ZS0xODAnIDogJydcbiAgICAgICAgICAgIH1gfVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvYnV0dG9uPlxuXG4gICAgICAgIDxTaG93IHdoZW49e3Nob3dEcm9wZG93bigpfT5cbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBjbGFzcz1cImFic29sdXRlIHJpZ2h0LTAgbXQtMiB3LTU2IHJvdW5kZWQtbGcgYmctc3VyZmFjZS1lbGV2YXRlZCBib3JkZXIgYm9yZGVyLWJvcmRlci1zdWJ0bGUgc2hhZG93LWxnIG92ZXJmbG93LWhpZGRlbiB6LTUwXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwLTJcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicHgtMyBweS0yXCI+XG4gICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1jb250ZW50XCI+XG4gICAgICAgICAgICAgICAgICAgIHtkaXNwbGF5TmFtZSgpfVxuICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMudXNlcj8uY3JlZGl0cyAhPT0gdW5kZWZpbmVkfT5cbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXhzIHRleHQtY29udGVudC1zZWNvbmRhcnkgbXQtMVwiPlxuICAgICAgICAgICAgICAgICAgICAgIPCfkrAge3Byb3BzLnVzZXIhLmNyZWRpdHN9IGNyZWRpdHNcbiAgICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoLXB4IGJnLWJvcmRlci1zdWJ0bGUgbXktMlwiIC8+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25TaWduT3V0Q2xpY2t9XG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBweC0zIHB5LTIgdGV4dC1zbSB0ZXh0LWNvbnRlbnQgaG92ZXI6Ymctc3VyZmFjZS1ob3ZlciByb3VuZGVkLW1kIHRyYW5zaXRpb24tY29sb3JzIGR1cmF0aW9uLTIwMFwiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPEZpTG9nT3V0IGNsYXNzPVwidy00IGgtNFwiIC8+XG4gICAgICAgICAgICAgICAgICBTaWduIE91dFxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKTtcbn0iLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IEZvciB9IGZyb20gJ3NvbGlkLWpzJztcblxuZXhwb3J0IGludGVyZmFjZSBTb25nIHtcbiAgaWQ6IHN0cmluZztcbiAgdHJhY2tJZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBhcnRpc3Q6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIb21lUGFnZVByb3BzIHtcbiAgc29uZ3M6IFNvbmdbXTtcbiAgb25Tb25nU2VsZWN0PzogKHNvbmc6IFNvbmcpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBIb21lUGFnZTogQ29tcG9uZW50PEhvbWVQYWdlUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHNvbmdJdGVtU3R5bGUgPSB7XG4gICAgcGFkZGluZzogJzE2cHgnLFxuICAgICdtYXJnaW4tYm90dG9tJzogJzhweCcsXG4gICAgJ2JhY2tncm91bmQtY29sb3InOiAnIzFhMWExYScsXG4gICAgJ2JvcmRlci1yYWRpdXMnOiAnOHB4JyxcbiAgICBjdXJzb3I6ICdwb2ludGVyJ1xuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdj5cbiAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogJzE2cHgnLCAnYmFja2dyb3VuZC1jb2xvcic6ICcjMWExYTFhJyB9fT5cbiAgICAgICAgPGgxIHN0eWxlPXt7IG1hcmdpbjogJzAgMCA4cHggMCcsICdmb250LXNpemUnOiAnMjRweCcgfX0+UG9wdWxhciBTb25nczwvaDE+XG4gICAgICAgIDxwIHN0eWxlPXt7IG1hcmdpbjogJzAnLCBjb2xvcjogJyM4ODgnIH19PkNob29zZSBhIHNvbmcgdG8gc3RhcnQgc2luZ2luZzwvcD5cbiAgICAgIDwvZGl2PlxuICAgICAgXG4gICAgICA8ZGl2IHN0eWxlPXt7IHBhZGRpbmc6ICcxNnB4JyB9fT5cbiAgICAgICAgPEZvciBlYWNoPXtwcm9wcy5zb25nc30+XG4gICAgICAgICAgeyhzb25nLCBpbmRleCkgPT4gKFxuICAgICAgICAgICAgPGRpdiBcbiAgICAgICAgICAgICAgc3R5bGU9e3NvbmdJdGVtU3R5bGV9XG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHByb3BzLm9uU29uZ1NlbGVjdD8uKHNvbmcpfVxuICAgICAgICAgICAgICBvbk1vdXNlRW50ZXI9eyhlKSA9PiBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyMyYTJhMmEnfVxuICAgICAgICAgICAgICBvbk1vdXNlTGVhdmU9eyhlKSA9PiBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyMxYTFhMWEnfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAnMTZweCcgfX0+XG4gICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9e3sgY29sb3I6ICcjNjY2JyB9fT57aW5kZXgoKSArIDF9PC9zcGFuPlxuICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7ICdmb250LXdlaWdodCc6ICdib2xkJyB9fT57c29uZy50aXRsZX08L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgY29sb3I6ICcjODg4JyB9fT57c29uZy5hcnRpc3R9PC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9Gb3I+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsLCBvbkNsZWFudXAgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IEx5cmljTGluZSB9IGZyb20gJy4uL2NvbXBvbmVudHMva2FyYW9rZS9MeXJpY3NEaXNwbGF5JztcbmltcG9ydCB7IGNyZWF0ZUthcmFva2VBdWRpb1Byb2Nlc3NvciB9IGZyb20gJy4uL3NlcnZpY2VzL2F1ZGlvL2thcmFva2VBdWRpb1Byb2Nlc3Nvcic7XG5pbXBvcnQgeyBzaG91bGRDaHVua0xpbmVzLCBjYWxjdWxhdGVSZWNvcmRpbmdEdXJhdGlvbiB9IGZyb20gJy4uL3NlcnZpY2VzL2thcmFva2UvY2h1bmtpbmdVdGlscyc7XG5pbXBvcnQgeyBLYXJhb2tlQXBpU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2thcmFva2Uva2FyYW9rZUFwaSc7XG5pbXBvcnQgdHlwZSB7IENodW5rSW5mbyB9IGZyb20gJ0BzY2FybGV0dC9jb3JlJztcbmltcG9ydCB0eXBlIHsgUGxheWJhY2tTcGVlZCB9IGZyb20gJy4uL2NvbXBvbmVudHMvY29tbW9uL1NwbGl0QnV0dG9uJztcblxuZXhwb3J0IGludGVyZmFjZSBVc2VLYXJhb2tlU2Vzc2lvbk9wdGlvbnMge1xuICBseXJpY3M6IEx5cmljTGluZVtdO1xuICBvbkNvbXBsZXRlPzogKHJlc3VsdHM6IEthcmFva2VSZXN1bHRzKSA9PiB2b2lkO1xuICBhdWRpb0VsZW1lbnQ/OiBIVE1MQXVkaW9FbGVtZW50O1xuICB0cmFja0lkPzogc3RyaW5nO1xuICBzb25nRGF0YT86IHtcbiAgICB0aXRsZTogc3RyaW5nO1xuICAgIGFydGlzdDogc3RyaW5nO1xuICAgIGFsYnVtPzogc3RyaW5nO1xuICAgIGR1cmF0aW9uPzogbnVtYmVyO1xuICB9O1xuICBzb25nQ2F0YWxvZ0lkPzogc3RyaW5nO1xuICBhcGlVcmw/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgS2FyYW9rZVJlc3VsdHMge1xuICBzY29yZTogbnVtYmVyO1xuICBhY2N1cmFjeTogbnVtYmVyO1xuICB0b3RhbExpbmVzOiBudW1iZXI7XG4gIHBlcmZlY3RMaW5lczogbnVtYmVyO1xuICBnb29kTGluZXM6IG51bWJlcjtcbiAgbmVlZHNXb3JrTGluZXM6IG51bWJlcjtcbiAgc2Vzc2lvbklkPzogc3RyaW5nO1xuICBpc0xvYWRpbmc/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIExpbmVTY29yZSB7XG4gIGxpbmVJbmRleDogbnVtYmVyO1xuICBzY29yZTogbnVtYmVyO1xuICB0cmFuc2NyaXB0aW9uOiBzdHJpbmc7XG4gIGZlZWRiYWNrPzogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXNlS2FyYW9rZVNlc3Npb24ob3B0aW9uczogVXNlS2FyYW9rZVNlc3Npb25PcHRpb25zKSB7XG4gIGNvbnN0IFtpc1BsYXlpbmcsIHNldElzUGxheWluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbY3VycmVudFRpbWUsIHNldEN1cnJlbnRUaW1lXSA9IGNyZWF0ZVNpZ25hbCgwKTtcbiAgY29uc3QgW3Njb3JlLCBzZXRTY29yZV0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFtjb3VudGRvd24sIHNldENvdW50ZG93bl0gPSBjcmVhdGVTaWduYWw8bnVtYmVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtzZXNzaW9uSWQsIHNldFNlc3Npb25JZF0gPSBjcmVhdGVTaWduYWw8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtsaW5lU2NvcmVzLCBzZXRMaW5lU2NvcmVzXSA9IGNyZWF0ZVNpZ25hbDxMaW5lU2NvcmVbXT4oW10pO1xuICBjb25zdCBbY3VycmVudENodW5rLCBzZXRDdXJyZW50Q2h1bmtdID0gY3JlYXRlU2lnbmFsPENodW5rSW5mbyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbaXNSZWNvcmRpbmcsIHNldElzUmVjb3JkaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFthdWRpb0VsZW1lbnQsIHNldEF1ZGlvRWxlbWVudF0gPSBjcmVhdGVTaWduYWw8SFRNTEF1ZGlvRWxlbWVudCB8IHVuZGVmaW5lZD4ob3B0aW9ucy5hdWRpb0VsZW1lbnQpO1xuICBjb25zdCBbcmVjb3JkZWRDaHVua3MsIHNldFJlY29yZGVkQ2h1bmtzXSA9IGNyZWF0ZVNpZ25hbDxTZXQ8bnVtYmVyPj4obmV3IFNldCgpKTtcbiAgY29uc3QgW3BsYXliYWNrU3BlZWQsIHNldFBsYXliYWNrU3BlZWRdID0gY3JlYXRlU2lnbmFsPFBsYXliYWNrU3BlZWQ+KCcxeCcpO1xuICBcbiAgbGV0IGF1ZGlvVXBkYXRlSW50ZXJ2YWw6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBsZXQgcmVjb3JkaW5nVGltZW91dDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gIFxuICBjb25zdCBhdWRpb1Byb2Nlc3NvciA9IGNyZWF0ZUthcmFva2VBdWRpb1Byb2Nlc3Nvcih7XG4gICAgc2FtcGxlUmF0ZTogMTYwMDBcbiAgfSk7XG4gIFxuICBjb25zdCBrYXJhb2tlQXBpID0gbmV3IEthcmFva2VBcGlTZXJ2aWNlKG9wdGlvbnMuYXBpVXJsKTtcblxuICAvLyBIZWxwZXIgdG8gY29udmVydCBzcGVlZCB0byBwbGF5YmFjayByYXRlXG4gIGNvbnN0IGdldFBsYXliYWNrUmF0ZSA9IChzcGVlZDogUGxheWJhY2tTcGVlZCk6IG51bWJlciA9PiB7XG4gICAgc3dpdGNoIChzcGVlZCkge1xuICAgICAgY2FzZSAnMC41eCc6IHJldHVybiAwLjU7XG4gICAgICBjYXNlICcwLjc1eCc6IHJldHVybiAwLjc1O1xuICAgICAgY2FzZSAnMXgnOiByZXR1cm4gMS4wO1xuICAgICAgZGVmYXVsdDogcmV0dXJuIDEuMDtcbiAgICB9XG4gIH07XG5cbiAgLy8gSGVscGVyIHRvIGdldCBzcGVlZCBtdWx0aXBsaWVyIGZvciBzY29yaW5nXG4gIGNvbnN0IGdldFNwZWVkTXVsdGlwbGllciA9IChzcGVlZDogUGxheWJhY2tTcGVlZCk6IG51bWJlciA9PiB7XG4gICAgc3dpdGNoIChzcGVlZCkge1xuICAgICAgY2FzZSAnMC41eCc6IHJldHVybiAxLjI7ICAvLyAyMCUgc2NvcmUgYm9vc3QgZm9yIHNsb3dlc3Qgc3BlZWRcbiAgICAgIGNhc2UgJzAuNzV4JzogcmV0dXJuIDEuMTsgLy8gMTAlIHNjb3JlIGJvb3N0IGZvciBtZWRpdW0gc3BlZWRcbiAgICAgIGNhc2UgJzF4JzogcmV0dXJuIDEuMDsgICAgLy8gTm8gYWRqdXN0bWVudCBmb3Igbm9ybWFsIHNwZWVkXG4gICAgICBkZWZhdWx0OiByZXR1cm4gMS4wO1xuICAgIH1cbiAgfTtcblxuICAvLyBIYW5kbGUgc3BlZWQgY2hhbmdlXG4gIGNvbnN0IGhhbmRsZVNwZWVkQ2hhbmdlID0gKHNwZWVkOiBQbGF5YmFja1NwZWVkKSA9PiB7XG4gICAgc2V0UGxheWJhY2tTcGVlZChzcGVlZCk7XG4gICAgY29uc3QgYXVkaW8gPSBhdWRpb0VsZW1lbnQoKTtcbiAgICBpZiAoYXVkaW8pIHtcbiAgICAgIGNvbnN0IHJhdGUgPSBnZXRQbGF5YmFja1JhdGUoc3BlZWQpO1xuICAgICAgYXVkaW8ucGxheWJhY2tSYXRlID0gcmF0ZTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3Qgc3RhcnRTZXNzaW9uID0gYXN5bmMgKCkgPT4ge1xuICAgIC8vIEluaXRpYWxpemUgYXVkaW8gY2FwdHVyZVxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBhdWRpb1Byb2Nlc3Nvci5pbml0aWFsaXplKCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIGluaXRpYWxpemUgYXVkaW86JywgZXJyb3IpO1xuICAgIH1cbiAgICBcbiAgICAvLyBDcmVhdGUgc2Vzc2lvbiBvbiBzZXJ2ZXIgaWYgdHJhY2tJZCBwcm92aWRlZFxuICAgIFxuICAgIGlmIChvcHRpb25zLnRyYWNrSWQgJiYgb3B0aW9ucy5zb25nRGF0YSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGthcmFva2VBcGkuc3RhcnRTZXNzaW9uKFxuICAgICAgICAgIG9wdGlvbnMudHJhY2tJZCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0aXRsZTogb3B0aW9ucy5zb25nRGF0YS50aXRsZSxcbiAgICAgICAgICAgIGFydGlzdDogb3B0aW9ucy5zb25nRGF0YS5hcnRpc3QsXG4gICAgICAgICAgICBkdXJhdGlvbjogb3B0aW9ucy5zb25nRGF0YS5kdXJhdGlvbixcbiAgICAgICAgICAgIGRpZmZpY3VsdHk6ICdpbnRlcm1lZGlhdGUnLCAvLyBEZWZhdWx0IGRpZmZpY3VsdHlcbiAgICAgICAgICB9LFxuICAgICAgICAgIHVuZGVmaW5lZCwgLy8gYXV0aFRva2VuXG4gICAgICAgICAgb3B0aW9ucy5zb25nQ2F0YWxvZ0lkLFxuICAgICAgICAgIHBsYXliYWNrU3BlZWQoKVxuICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgaWYgKHNlc3Npb24pIHtcbiAgICAgICAgICBzZXRTZXNzaW9uSWQoc2Vzc2lvbi5pZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VTZXNzaW9uXSBGYWlsZWQgdG8gY3JlYXRlIHNlc3Npb24nKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VTZXNzaW9uXSBGYWlsZWQgdG8gY3JlYXRlIHNlc3Npb246JywgZXJyb3IpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgfVxuICAgIFxuICAgIC8vIFN0YXJ0IGNvdW50ZG93blxuICAgIHNldENvdW50ZG93bigzKTtcbiAgICBcbiAgICBjb25zdCBjb3VudGRvd25JbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGNvbnN0IGN1cnJlbnQgPSBjb3VudGRvd24oKTtcbiAgICAgIGlmIChjdXJyZW50ICE9PSBudWxsICYmIGN1cnJlbnQgPiAxKSB7XG4gICAgICAgIHNldENvdW50ZG93bihjdXJyZW50IC0gMSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjbGVhckludGVydmFsKGNvdW50ZG93bkludGVydmFsKTtcbiAgICAgICAgc2V0Q291bnRkb3duKG51bGwpO1xuICAgICAgICBzdGFydFBsYXliYWNrKCk7XG4gICAgICB9XG4gICAgfSwgMTAwMCk7XG4gIH07XG5cbiAgY29uc3Qgc3RhcnRQbGF5YmFjayA9ICgpID0+IHtcbiAgICBzZXRJc1BsYXlpbmcodHJ1ZSk7XG4gICAgXG4gICAgLy8gU3RhcnQgZnVsbCBzZXNzaW9uIGF1ZGlvIGNhcHR1cmVcbiAgICBhdWRpb1Byb2Nlc3Nvci5zdGFydEZ1bGxTZXNzaW9uKCk7XG4gICAgXG4gICAgY29uc3QgYXVkaW8gPSBhdWRpb0VsZW1lbnQoKSB8fCBvcHRpb25zLmF1ZGlvRWxlbWVudDtcbiAgICBpZiAoYXVkaW8pIHtcbiAgICAgIC8vIFNldCBwbGF5YmFjayByYXRlIGJhc2VkIG9uIGN1cnJlbnQgc3BlZWRcbiAgICAgIGNvbnN0IHJhdGUgPSBnZXRQbGF5YmFja1JhdGUocGxheWJhY2tTcGVlZCgpKTtcbiAgICAgIGF1ZGlvLnBsYXliYWNrUmF0ZSA9IHJhdGU7XG4gICAgICAvLyBJZiBhdWRpbyBlbGVtZW50IGlzIHByb3ZpZGVkLCB1c2UgaXRcbiAgICAgIGF1ZGlvLnBsYXkoKS5jYXRjaChjb25zb2xlLmVycm9yKTtcbiAgICAgIFxuICAgICAgY29uc3QgdXBkYXRlVGltZSA9ICgpID0+IHtcbiAgICAgICAgY29uc3QgdGltZSA9IGF1ZGlvLmN1cnJlbnRUaW1lICogMTAwMDtcbiAgICAgICAgc2V0Q3VycmVudFRpbWUodGltZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBpZiB3ZSBuZWVkIHRvIHN0YXJ0IHJlY29yZGluZyBmb3IgdXBjb21pbmcgbGluZXNcbiAgICAgICAgY2hlY2tGb3JVcGNvbWluZ0xpbmVzKHRpbWUpO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgYXVkaW9VcGRhdGVJbnRlcnZhbCA9IHNldEludGVydmFsKHVwZGF0ZVRpbWUsIDEwMCkgYXMgdW5rbm93biBhcyBudW1iZXI7XG4gICAgICBcbiAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgaGFuZGxlRW5kKTtcbiAgICB9IGVsc2Uge1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGNoZWNrRm9yVXBjb21pbmdMaW5lcyA9IChjdXJyZW50VGltZU1zOiBudW1iZXIpID0+IHtcbiAgICBpZiAoaXNSZWNvcmRpbmcoKSB8fCAhb3B0aW9ucy5seXJpY3MubGVuZ3RoKSByZXR1cm47XG4gICAgXG4gICAgY29uc3QgcmVjb3JkZWQgPSByZWNvcmRlZENodW5rcygpO1xuICAgIFxuICAgIC8vIExvb2sgZm9yIGNodW5rcyB0aGF0IHNob3VsZCBzdGFydCByZWNvcmRpbmcgc29vblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3B0aW9ucy5seXJpY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vIFNraXAgaWYgd2UndmUgYWxyZWFkeSByZWNvcmRlZCBhIGNodW5rIHN0YXJ0aW5nIGF0IHRoaXMgaW5kZXhcbiAgICAgIGlmIChyZWNvcmRlZC5oYXMoaSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNodW5rID0gc2hvdWxkQ2h1bmtMaW5lcyhvcHRpb25zLmx5cmljcywgaSk7XG4gICAgICBjb25zdCBmaXJzdExpbmUgPSBvcHRpb25zLmx5cmljc1tjaHVuay5zdGFydEluZGV4XTtcbiAgICAgIFxuICAgICAgaWYgKGZpcnN0TGluZSAmJiBmaXJzdExpbmUuc3RhcnRUaW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgcmVjb3JkaW5nU3RhcnRUaW1lID0gZmlyc3RMaW5lLnN0YXJ0VGltZSAqIDEwMDAgLSAxMDAwOyAvLyBTdGFydCAxcyBlYXJseVxuICAgICAgICBjb25zdCBsaW5lU3RhcnRUaW1lID0gZmlyc3RMaW5lLnN0YXJ0VGltZSAqIDEwMDA7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBpZiB3ZSdyZSBpbiB0aGUgcmVjb3JkaW5nIHdpbmRvdyBhbmQgaGF2ZW4ndCBwYXNzZWQgdGhlIGxpbmUgc3RhcnRcbiAgICAgICAgaWYgKGN1cnJlbnRUaW1lTXMgPj0gcmVjb3JkaW5nU3RhcnRUaW1lICYmIGN1cnJlbnRUaW1lTXMgPCBsaW5lU3RhcnRUaW1lICsgNTAwKSB7IC8vIEFsbG93IDUwMG1zIGJ1ZmZlciBhZnRlciBsaW5lIHN0YXJ0XG4gICAgICAgICAgLy8gTWFyayB0aGlzIGNodW5rIGFzIHJlY29yZGVkXG4gICAgICAgICAgc2V0UmVjb3JkZWRDaHVua3MocHJldiA9PiBuZXcgU2V0KHByZXYpLmFkZChjaHVuay5zdGFydEluZGV4KSk7XG4gICAgICAgICAgLy8gU3RhcnQgcmVjb3JkaW5nIHRoaXMgY2h1bmtcbiAgICAgICAgICBzdGFydFJlY29yZGluZ0NodW5rKGNodW5rKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBTa2lwIGFoZWFkIHRvIGF2b2lkIGNoZWNraW5nIGxpbmVzIHdlJ3ZlIGFscmVhZHkgcGFzc2VkXG4gICAgICBpID0gY2h1bmsuZW5kSW5kZXg7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3Qgc3RhcnRSZWNvcmRpbmdDaHVuayA9IGFzeW5jIChjaHVuazogQ2h1bmtJbmZvKSA9PiB7XG4gICAgLy8gVEVTVElORyBNT0RFOiBBdXRvLWNvbXBsZXRlIGFmdGVyIDUgbGluZXNcbiAgICBpZiAoY2h1bmsuc3RhcnRJbmRleCA+PSA1KSB7XG4gICAgICBoYW5kbGVFbmQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgc2V0Q3VycmVudENodW5rKGNodW5rKTtcbiAgICBzZXRJc1JlY29yZGluZyh0cnVlKTtcbiAgICBcbiAgICAvLyBTdGFydCBhdWRpbyBjYXB0dXJlIGZvciB0aGlzIGNodW5rXG4gICAgYXVkaW9Qcm9jZXNzb3Iuc3RhcnRSZWNvcmRpbmdMaW5lKGNodW5rLnN0YXJ0SW5kZXgpO1xuICAgIFxuICAgIC8vIENhbGN1bGF0ZSByZWNvcmRpbmcgZHVyYXRpb24gYWRqdXN0ZWQgZm9yIHBsYXliYWNrIHNwZWVkXG4gICAgY29uc3QgYmFzZUR1cmF0aW9uID0gY2FsY3VsYXRlUmVjb3JkaW5nRHVyYXRpb24ob3B0aW9ucy5seXJpY3MsIGNodW5rKTtcbiAgICBjb25zdCBzcGVlZEZhY3RvciA9IDEgLyBnZXRQbGF5YmFja1JhdGUocGxheWJhY2tTcGVlZCgpKTsgLy8gSW52ZXJzZSBvZiBwbGF5YmFjayByYXRlXG4gICAgY29uc3QgZHVyYXRpb24gPSBiYXNlRHVyYXRpb24gKiBzcGVlZEZhY3RvcjtcbiAgICBcbiAgICAvLyBTdG9wIHJlY29yZGluZyBhZnRlciBkdXJhdGlvblxuICAgIHJlY29yZGluZ1RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHN0b3BSZWNvcmRpbmdDaHVuaygpO1xuICAgIH0sIGR1cmF0aW9uKSBhcyB1bmtub3duIGFzIG51bWJlcjtcbiAgfTtcbiAgXG4gIGNvbnN0IHN0b3BSZWNvcmRpbmdDaHVuayA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBjaHVuayA9IGN1cnJlbnRDaHVuaygpO1xuICAgIGlmICghY2h1bmspIHJldHVybjtcbiAgICBcbiAgICBzZXRJc1JlY29yZGluZyhmYWxzZSk7XG4gICAgXG4gICAgLy8gR2V0IHRoZSByZWNvcmRlZCBhdWRpb1xuICAgIGNvbnN0IGF1ZGlvQ2h1bmtzID0gYXVkaW9Qcm9jZXNzb3Iuc3RvcFJlY29yZGluZ0xpbmVBbmRHZXRSYXdBdWRpbygpO1xuICAgIGNvbnN0IHdhdkJsb2IgPSBhdWRpb1Byb2Nlc3Nvci5jb252ZXJ0QXVkaW9Ub1dhdkJsb2IoYXVkaW9DaHVua3MpO1xuICAgIFxuICAgIFxuICAgIC8vIENoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGF1ZGlvIGRhdGFcbiAgICBpZiAod2F2QmxvYiAmJiB3YXZCbG9iLnNpemUgPiAxMDAwICYmIHNlc3Npb25JZCgpKSB7IC8vIE1pbmltdW0gMUtCIG9mIGF1ZGlvIGRhdGFcbiAgICAgIC8vIENvbnZlcnQgdG8gYmFzZTY0IGZvciBBUElcbiAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkZW5kID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBiYXNlNjRBdWRpbyA9IHJlYWRlci5yZXN1bHQ/LnRvU3RyaW5nKCkuc3BsaXQoJywnKVsxXTtcbiAgICAgICAgaWYgKGJhc2U2NEF1ZGlvICYmIGJhc2U2NEF1ZGlvLmxlbmd0aCA+IDEwMCkgeyAvLyBFbnN1cmUgd2UgaGF2ZSBtZWFuaW5nZnVsIGJhc2U2NCBkYXRhXG4gICAgICAgICAgYXdhaXQgZ3JhZGVDaHVuayhjaHVuaywgYmFzZTY0QXVkaW8pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKHdhdkJsb2IpO1xuICAgIH0gZWxzZSBpZiAod2F2QmxvYiAmJiB3YXZCbG9iLnNpemUgPD0gMTAwMCkge1xuICAgICAgLy8gQWRkIGEgbmV1dHJhbCBzY29yZSBmb3IgVUkgZmVlZGJhY2tcbiAgICAgIHNldExpbmVTY29yZXMocHJldiA9PiBbLi4ucHJldiwge1xuICAgICAgICBsaW5lSW5kZXg6IGNodW5rLnN0YXJ0SW5kZXgsXG4gICAgICAgIHNjb3JlOiA1MCxcbiAgICAgICAgdHJhbnNjcmlwdGlvbjogJycsXG4gICAgICAgIGZlZWRiYWNrOiAnUmVjb3JkaW5nIHRvbyBzaG9ydCdcbiAgICAgIH1dKTtcbiAgICB9IGVsc2UgaWYgKHdhdkJsb2IgJiYgIXNlc3Npb25JZCgpKSB7XG4gICAgfVxuICAgIFxuICAgIHNldEN1cnJlbnRDaHVuayhudWxsKTtcbiAgICBcbiAgICBpZiAocmVjb3JkaW5nVGltZW91dCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHJlY29yZGluZ1RpbWVvdXQpO1xuICAgICAgcmVjb3JkaW5nVGltZW91dCA9IG51bGw7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgZ3JhZGVDaHVuayA9IGFzeW5jIChjaHVuazogQ2h1bmtJbmZvLCBhdWRpb0Jhc2U2NDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY3VycmVudFNlc3Npb25JZCA9IHNlc3Npb25JZCgpO1xuICAgIFxuICAgIGlmICghY3VycmVudFNlc3Npb25JZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3QgbGluZVNjb3JlID0gYXdhaXQga2FyYW9rZUFwaS5ncmFkZVJlY29yZGluZyhcbiAgICAgICAgY3VycmVudFNlc3Npb25JZCxcbiAgICAgICAgY2h1bmsuc3RhcnRJbmRleCxcbiAgICAgICAgYXVkaW9CYXNlNjQsXG4gICAgICAgIGNodW5rLmV4cGVjdGVkVGV4dCxcbiAgICAgICAgb3B0aW9ucy5seXJpY3NbY2h1bmsuc3RhcnRJbmRleF0/LnN0YXJ0VGltZSB8fCAwLFxuICAgICAgICAob3B0aW9ucy5seXJpY3NbY2h1bmsuZW5kSW5kZXhdPy5zdGFydFRpbWUgfHwgMCkgKyAob3B0aW9ucy5seXJpY3NbY2h1bmsuZW5kSW5kZXhdPy5kdXJhdGlvbiB8fCAwKSAvIDEwMDAsXG4gICAgICAgIHVuZGVmaW5lZCwgLy8gYXV0aFRva2VuXG4gICAgICAgIHBsYXliYWNrU3BlZWQoKVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgaWYgKGxpbmVTY29yZSkge1xuICAgICAgICBcbiAgICAgICAgLy8gQXBwbHkgc3BlZWQgbXVsdGlwbGllciB0byBzY29yZSBmb3IgbGFuZ3VhZ2UgbGVhcm5lcnNcbiAgICAgICAgY29uc3Qgc3BlZWRNdWx0aXBsaWVyID0gZ2V0U3BlZWRNdWx0aXBsaWVyKHBsYXliYWNrU3BlZWQoKSk7XG4gICAgICAgIGNvbnN0IGFkanVzdGVkU2NvcmUgPSBNYXRoLm1pbigxMDAsIE1hdGgucm91bmQobGluZVNjb3JlLnNjb3JlICogc3BlZWRNdWx0aXBsaWVyKSk7XG4gICAgICAgIFxuICAgICAgICAvLyBVcGRhdGUgbGluZSBzY29yZXNcbiAgICAgICAgY29uc3QgbmV3TGluZVNjb3JlID0ge1xuICAgICAgICAgIGxpbmVJbmRleDogY2h1bmsuc3RhcnRJbmRleCxcbiAgICAgICAgICBzY29yZTogYWRqdXN0ZWRTY29yZSxcbiAgICAgICAgICB0cmFuc2NyaXB0aW9uOiBsaW5lU2NvcmUudHJhbnNjcmlwdCB8fCAnJyxcbiAgICAgICAgICBmZWVkYmFjazogbGluZVNjb3JlLmZlZWRiYWNrXG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBzZXRMaW5lU2NvcmVzKHByZXYgPT4gWy4uLnByZXYsIG5ld0xpbmVTY29yZV0pO1xuICAgICAgICBcbiAgICAgICAgLy8gVXBkYXRlIHRvdGFsIHNjb3JlIChzaW1wbGUgYXZlcmFnZSBmb3Igbm93KSAtIHVzZSBwcmV2IHRvIGF2b2lkIGRlcGVuZGVuY3lcbiAgICAgICAgc2V0U2NvcmUocHJldiA9PiB7XG4gICAgICAgICAgY29uc3QgYWxsU2NvcmVzID0gWy4uLmxpbmVTY29yZXMoKSwgbmV3TGluZVNjb3JlXTtcbiAgICAgICAgICBjb25zdCBhdmdTY29yZSA9IGFsbFNjb3Jlcy5yZWR1Y2UoKHN1bSwgcykgPT4gc3VtICsgcy5zY29yZSwgMCkgLyBhbGxTY29yZXMubGVuZ3RoO1xuICAgICAgICAgIHJldHVybiBNYXRoLnJvdW5kKGF2Z1Njb3JlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICAvLyBSZW1vdmVkIHRlc3QgbW9kZSBsaW1pdFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgXG4gICAgICAgIC8vIEFkZCBhIG5ldXRyYWwgc2NvcmUgZm9yIFVJIGZlZWRiYWNrXG4gICAgICAgIHNldExpbmVTY29yZXMocHJldiA9PiBbLi4ucHJldiwge1xuICAgICAgICAgIGxpbmVJbmRleDogY2h1bmsuc3RhcnRJbmRleCxcbiAgICAgICAgICBzY29yZTogNTAsIC8vIE5ldXRyYWwgc2NvcmVcbiAgICAgICAgICB0cmFuc2NyaXB0aW9uOiAnJyxcbiAgICAgICAgICBmZWVkYmFjazogJ0ZhaWxlZCB0byBncmFkZSByZWNvcmRpbmcnXG4gICAgICAgIH1dKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VTZXNzaW9uXSBGYWlsZWQgdG8gZ3JhZGUgY2h1bms6JywgZXJyb3IpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVFbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgc2V0SXNQbGF5aW5nKGZhbHNlKTtcbiAgICBpZiAoYXVkaW9VcGRhdGVJbnRlcnZhbCkge1xuICAgICAgY2xlYXJJbnRlcnZhbChhdWRpb1VwZGF0ZUludGVydmFsKTtcbiAgICB9XG4gICAgXG4gICAgLy8gUGF1c2UgdGhlIGF1ZGlvXG4gICAgY29uc3QgYXVkaW8gPSBhdWRpb0VsZW1lbnQoKSB8fCBvcHRpb25zLmF1ZGlvRWxlbWVudDtcbiAgICBpZiAoYXVkaW8gJiYgIWF1ZGlvLnBhdXNlZCkge1xuICAgICAgYXVkaW8ucGF1c2UoKTtcbiAgICB9XG4gICAgXG4gICAgLy8gU3RvcCBhbnkgb25nb2luZyByZWNvcmRpbmdcbiAgICBpZiAoaXNSZWNvcmRpbmcoKSkge1xuICAgICAgYXdhaXQgc3RvcFJlY29yZGluZ0NodW5rKCk7XG4gICAgfVxuICAgIFxuICAgIC8vIFNob3cgbG9hZGluZyBzdGF0ZSBpbW1lZGlhdGVseVxuICAgIGNvbnN0IGxvYWRpbmdSZXN1bHRzOiBLYXJhb2tlUmVzdWx0cyA9IHtcbiAgICAgIHNjb3JlOiAtMSwgLy8gU3BlY2lhbCB2YWx1ZSB0byBpbmRpY2F0ZSBsb2FkaW5nXG4gICAgICBhY2N1cmFjeTogMCxcbiAgICAgIHRvdGFsTGluZXM6IGxpbmVTY29yZXMoKS5sZW5ndGgsXG4gICAgICBwZXJmZWN0TGluZXM6IDAsXG4gICAgICBnb29kTGluZXM6IDAsXG4gICAgICBuZWVkc1dvcmtMaW5lczogMCxcbiAgICAgIHNlc3Npb25JZDogc2Vzc2lvbklkKCkgfHwgdW5kZWZpbmVkLFxuICAgICAgaXNMb2FkaW5nOiB0cnVlXG4gICAgfTtcbiAgICBvcHRpb25zLm9uQ29tcGxldGU/Lihsb2FkaW5nUmVzdWx0cyk7XG4gICAgXG4gICAgLy8gR2V0IGZ1bGwgc2Vzc2lvbiBhdWRpb1xuICAgIGNvbnN0IGZ1bGxBdWRpb0Jsb2IgPSBhdWRpb1Byb2Nlc3Nvci5zdG9wRnVsbFNlc3Npb25BbmRHZXRXYXYoKTtcbiAgICBcbiAgICAvLyBDb21wbGV0ZSBzZXNzaW9uIG9uIHNlcnZlclxuICAgIGNvbnN0IGN1cnJlbnRTZXNzaW9uSWQgPSBzZXNzaW9uSWQoKTtcbiAgICBpZiAoY3VycmVudFNlc3Npb25JZCAmJiBmdWxsQXVkaW9CbG9iICYmIGZ1bGxBdWRpb0Jsb2Iuc2l6ZSA+IDEwMDApIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgYmFzZTY0QXVkaW8gPSByZWFkZXIucmVzdWx0Py50b1N0cmluZygpLnNwbGl0KCcsJylbMV07XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3Qgc2Vzc2lvblJlc3VsdHMgPSBhd2FpdCBrYXJhb2tlQXBpLmNvbXBsZXRlU2Vzc2lvbihcbiAgICAgICAgICAgIGN1cnJlbnRTZXNzaW9uSWQsXG4gICAgICAgICAgICBiYXNlNjRBdWRpb1xuICAgICAgICAgICk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHNlc3Npb25SZXN1bHRzKSB7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IEthcmFva2VSZXN1bHRzID0ge1xuICAgICAgICAgICAgICBzY29yZTogc2Vzc2lvblJlc3VsdHMuZmluYWxTY29yZSxcbiAgICAgICAgICAgICAgYWNjdXJhY3k6IHNlc3Npb25SZXN1bHRzLmFjY3VyYWN5LFxuICAgICAgICAgICAgICB0b3RhbExpbmVzOiBzZXNzaW9uUmVzdWx0cy50b3RhbExpbmVzLFxuICAgICAgICAgICAgICBwZXJmZWN0TGluZXM6IHNlc3Npb25SZXN1bHRzLnBlcmZlY3RMaW5lcyxcbiAgICAgICAgICAgICAgZ29vZExpbmVzOiBzZXNzaW9uUmVzdWx0cy5nb29kTGluZXMsXG4gICAgICAgICAgICAgIG5lZWRzV29ya0xpbmVzOiBzZXNzaW9uUmVzdWx0cy5uZWVkc1dvcmtMaW5lcyxcbiAgICAgICAgICAgICAgc2Vzc2lvbklkOiBjdXJyZW50U2Vzc2lvbklkXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBvcHRpb25zLm9uQ29tcGxldGU/LihyZXN1bHRzKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gbG9jYWwgY2FsY3VsYXRpb25cbiAgICAgICAgICAgIGNhbGN1bGF0ZUxvY2FsUmVzdWx0cygpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoZnVsbEF1ZGlvQmxvYik7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBjb21wbGV0ZSBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgICAgY2FsY3VsYXRlTG9jYWxSZXN1bHRzKCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vIHNlc3Npb24sIGp1c3QgcmV0dXJuIGxvY2FsIHJlc3VsdHNcbiAgICAgIGNhbGN1bGF0ZUxvY2FsUmVzdWx0cygpO1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGNhbGN1bGF0ZUxvY2FsUmVzdWx0cyA9ICgpID0+IHtcbiAgICBjb25zdCBzY29yZXMgPSBsaW5lU2NvcmVzKCk7XG4gICAgY29uc3QgYXZnU2NvcmUgPSBzY29yZXMubGVuZ3RoID4gMCBcbiAgICAgID8gc2NvcmVzLnJlZHVjZSgoc3VtLCBzKSA9PiBzdW0gKyBzLnNjb3JlLCAwKSAvIHNjb3Jlcy5sZW5ndGhcbiAgICAgIDogMDtcbiAgICBcbiAgICBjb25zdCByZXN1bHRzOiBLYXJhb2tlUmVzdWx0cyA9IHtcbiAgICAgIHNjb3JlOiBNYXRoLnJvdW5kKGF2Z1Njb3JlKSxcbiAgICAgIGFjY3VyYWN5OiBNYXRoLnJvdW5kKGF2Z1Njb3JlKSxcbiAgICAgIHRvdGFsTGluZXM6IHNjb3Jlcy5sZW5ndGgsIC8vIFVzZSBhY3R1YWwgY29tcGxldGVkIGxpbmVzIGZvciB0ZXN0IG1vZGVcbiAgICAgIHBlcmZlY3RMaW5lczogc2NvcmVzLmZpbHRlcihzID0+IHMuc2NvcmUgPj0gOTApLmxlbmd0aCxcbiAgICAgIGdvb2RMaW5lczogc2NvcmVzLmZpbHRlcihzID0+IHMuc2NvcmUgPj0gNzAgJiYgcy5zY29yZSA8IDkwKS5sZW5ndGgsXG4gICAgICBuZWVkc1dvcmtMaW5lczogc2NvcmVzLmZpbHRlcihzID0+IHMuc2NvcmUgPCA3MCkubGVuZ3RoLFxuICAgICAgc2Vzc2lvbklkOiBzZXNzaW9uSWQoKSB8fCB1bmRlZmluZWRcbiAgICB9O1xuICAgIFxuICAgIG9wdGlvbnMub25Db21wbGV0ZT8uKHJlc3VsdHMpO1xuICB9O1xuXG4gIGNvbnN0IHN0b3BTZXNzaW9uID0gKCkgPT4ge1xuICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgc2V0Q291bnRkb3duKG51bGwpO1xuICAgIHNldElzUmVjb3JkaW5nKGZhbHNlKTtcbiAgICBzZXRDdXJyZW50Q2h1bmsobnVsbCk7XG4gICAgc2V0UmVjb3JkZWRDaHVua3MobmV3IFNldDxudW1iZXI+KCkpO1xuICAgIFxuICAgIGlmIChhdWRpb1VwZGF0ZUludGVydmFsKSB7XG4gICAgICBjbGVhckludGVydmFsKGF1ZGlvVXBkYXRlSW50ZXJ2YWwpO1xuICAgICAgYXVkaW9VcGRhdGVJbnRlcnZhbCA9IG51bGw7XG4gICAgfVxuICAgIFxuICAgIGlmIChyZWNvcmRpbmdUaW1lb3V0KSB7XG4gICAgICBjbGVhclRpbWVvdXQocmVjb3JkaW5nVGltZW91dCk7XG4gICAgICByZWNvcmRpbmdUaW1lb3V0ID0gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYXVkaW8gPSBhdWRpb0VsZW1lbnQoKSB8fCBvcHRpb25zLmF1ZGlvRWxlbWVudDtcbiAgICBpZiAoYXVkaW8pIHtcbiAgICAgIGF1ZGlvLnBhdXNlKCk7XG4gICAgICBhdWRpby5jdXJyZW50VGltZSA9IDA7XG4gICAgICBhdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCdlbmRlZCcsIGhhbmRsZUVuZCk7XG4gICAgfVxuICAgIFxuICAgIC8vIENsZWFudXAgYXVkaW8gcHJvY2Vzc29yXG4gICAgYXVkaW9Qcm9jZXNzb3IuY2xlYW51cCgpO1xuICB9O1xuXG4gIG9uQ2xlYW51cCgoKSA9PiB7XG4gICAgc3RvcFNlc3Npb24oKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICAvLyBTdGF0ZVxuICAgIGlzUGxheWluZyxcbiAgICBjdXJyZW50VGltZSxcbiAgICBzY29yZSxcbiAgICBjb3VudGRvd24sXG4gICAgc2Vzc2lvbklkLFxuICAgIGxpbmVTY29yZXMsXG4gICAgaXNSZWNvcmRpbmcsXG4gICAgY3VycmVudENodW5rLFxuICAgIHBsYXliYWNrU3BlZWQsXG4gICAgXG4gICAgLy8gQWN0aW9uc1xuICAgIHN0YXJ0U2Vzc2lvbixcbiAgICBzdG9wU2Vzc2lvbixcbiAgICBoYW5kbGVTcGVlZENoYW5nZSxcbiAgICBcbiAgICAvLyBBdWRpbyBwcm9jZXNzb3IgKGZvciBkaXJlY3QgYWNjZXNzIGlmIG5lZWRlZClcbiAgICBhdWRpb1Byb2Nlc3NvcixcbiAgICBcbiAgICAvLyBNZXRob2QgdG8gdXBkYXRlIGF1ZGlvIGVsZW1lbnQgYWZ0ZXIgaW5pdGlhbGl6YXRpb25cbiAgICBzZXRBdWRpb0VsZW1lbnQ6IChlbGVtZW50OiBIVE1MQXVkaW9FbGVtZW50IHwgdW5kZWZpbmVkKSA9PiB7XG4gICAgICBzZXRBdWRpb0VsZW1lbnQoZWxlbWVudCk7XG4gICAgICAvLyBBcHBseSBjdXJyZW50IHBsYXliYWNrIHJhdGUgdG8gbmV3IGF1ZGlvIGVsZW1lbnRcbiAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgIGVsZW1lbnQucGxheWJhY2tSYXRlID0gZ2V0UGxheWJhY2tSYXRlKHBsYXliYWNrU3BlZWQoKSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufSIsImV4cG9ydCBpbnRlcmZhY2UgVHJhY2tJbmZvIHtcbiAgdHJhY2tJZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBhcnRpc3Q6IHN0cmluZztcbiAgcGxhdGZvcm06ICdzb3VuZGNsb3VkJztcbiAgdXJsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFja0RldGVjdG9yIHtcbiAgLyoqXG4gICAqIERldGVjdCBjdXJyZW50IHRyYWNrIGZyb20gdGhlIHBhZ2UgKFNvdW5kQ2xvdWQgb25seSlcbiAgICovXG4gIGRldGVjdEN1cnJlbnRUcmFjaygpOiBUcmFja0luZm8gfCBudWxsIHtcbiAgICBjb25zdCB1cmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICBcbiAgICAvLyBPbmx5IHdvcmsgb24gc2MubWFpZC56b25lIChTb3VuZENsb3VkIHByb3h5KVxuICAgIGlmICh1cmwuaW5jbHVkZXMoJ3NjLm1haWQuem9uZScpKSB7XG4gICAgICByZXR1cm4gdGhpcy5kZXRlY3RTb3VuZENsb3VkVHJhY2soKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IHRyYWNrIGluZm8gZnJvbSBTb3VuZENsb3VkIChzYy5tYWlkLnpvbmUpXG4gICAqL1xuICBwcml2YXRlIGRldGVjdFNvdW5kQ2xvdWRUcmFjaygpOiBUcmFja0luZm8gfCBudWxsIHtcbiAgICB0cnkge1xuICAgICAgLy8gU291bmRDbG91ZCBVUkxzOiBzYy5tYWlkLnpvbmUvdXNlci90cmFjay1uYW1lXG4gICAgICBjb25zdCBwYXRoUGFydHMgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBpZiAocGF0aFBhcnRzLmxlbmd0aCA8IDIpIHJldHVybiBudWxsO1xuXG4gICAgICBjb25zdCBhcnRpc3RQYXRoID0gcGF0aFBhcnRzWzBdO1xuICAgICAgY29uc3QgdHJhY2tTbHVnID0gcGF0aFBhcnRzWzFdO1xuICAgICAgXG4gICAgICAvLyBUcnkgdG8gZ2V0IGFjdHVhbCB0aXRsZSBmcm9tIHBhZ2VcbiAgICAgIGxldCB0aXRsZSA9ICcnO1xuICAgICAgXG4gICAgICAvLyBGb3Igc291bmRjbG9haywgbG9vayBmb3IgaDEgYWZ0ZXIgdGhlIGltYWdlXG4gICAgICBjb25zdCBoMUVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnaDEnKTtcbiAgICAgIGZvciAoY29uc3QgaDEgb2YgaDFFbGVtZW50cykge1xuICAgICAgICAvLyBTa2lwIHRoZSBcInNvdW5kY2xvYWtcIiBoZWFkZXJcbiAgICAgICAgaWYgKGgxLnRleHRDb250ZW50Py50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzb3VuZGNsb2FrJykpIGNvbnRpbnVlO1xuICAgICAgICB0aXRsZSA9IGgxLnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgIGlmICh0aXRsZSkgYnJlYWs7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEZhbGxiYWNrIHRvIHNsdWdcbiAgICAgIGlmICghdGl0bGUpIHtcbiAgICAgICAgdGl0bGUgPSB0cmFja1NsdWcucmVwbGFjZSgvLS9nLCAnICcpO1xuICAgICAgfVxuXG4gICAgICAvLyBUcnkgdG8gZ2V0IGFjdHVhbCBhcnRpc3QgbmFtZSBmcm9tIHBhZ2VcbiAgICAgIGxldCBhcnRpc3QgPSAnJztcbiAgICAgIFxuICAgICAgLy8gTG9vayBmb3IgYXJ0aXN0IGxpbmsgd2l0aCBtZXRhIGNsYXNzXG4gICAgICBjb25zdCBhcnRpc3RMaW5rID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYS5saXN0aW5nIC5tZXRhIGgzJyk7XG4gICAgICBpZiAoYXJ0aXN0TGluayAmJiBhcnRpc3RMaW5rLnRleHRDb250ZW50KSB7XG4gICAgICAgIGFydGlzdCA9IGFydGlzdExpbmsudGV4dENvbnRlbnQudHJpbSgpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBGYWxsYmFjazogdHJ5IHBhZ2UgdGl0bGVcbiAgICAgIGlmICghYXJ0aXN0KSB7XG4gICAgICAgIGNvbnN0IHBhZ2VUaXRsZSA9IGRvY3VtZW50LnRpdGxlO1xuICAgICAgICAvLyBUaXRsZSBmb3JtYXQ6IFwiU29uZyBieSBBcnRpc3QgfiBzb3VuZGNsb2FrXCJcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBwYWdlVGl0bGUubWF0Y2goL2J5XFxzKyguKz8pXFxzKn4vKTtcbiAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgYXJ0aXN0ID0gbWF0Y2hbMV0udHJpbSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEZpbmFsIGZhbGxiYWNrIHRvIFVSTFxuICAgICAgaWYgKCFhcnRpc3QpIHtcbiAgICAgICAgYXJ0aXN0ID0gYXJ0aXN0UGF0aC5yZXBsYWNlKC8tL2csICcgJykucmVwbGFjZSgvXy9nLCAnICcpO1xuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZygnW1RyYWNrRGV0ZWN0b3JdIERldGVjdGVkIHRyYWNrOicsIHsgdGl0bGUsIGFydGlzdCwgYXJ0aXN0UGF0aCwgdHJhY2tTbHVnIH0pO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0cmFja0lkOiBgJHthcnRpc3RQYXRofS8ke3RyYWNrU2x1Z31gLFxuICAgICAgICB0aXRsZTogdGl0bGUsXG4gICAgICAgIGFydGlzdDogYXJ0aXN0LFxuICAgICAgICBwbGF0Zm9ybTogJ3NvdW5kY2xvdWQnLFxuICAgICAgICB1cmw6IHdpbmRvdy5sb2NhdGlvbi5ocmVmLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW1RyYWNrRGV0ZWN0b3JdIEVycm9yIGRldGVjdGluZyBTb3VuZENsb3VkIHRyYWNrOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG5cbiAgLyoqXG4gICAqIFdhdGNoIGZvciBwYWdlIGNoYW5nZXMgKFNvdW5kQ2xvdWQgaXMgYSBTUEEpXG4gICAqL1xuICB3YXRjaEZvckNoYW5nZXMoY2FsbGJhY2s6ICh0cmFjazogVHJhY2tJbmZvIHwgbnVsbCkgPT4gdm9pZCk6ICgpID0+IHZvaWQge1xuICAgIGxldCBjdXJyZW50VXJsID0gd2luZG93LmxvY2F0aW9uLmhyZWY7XG4gICAgbGV0IGN1cnJlbnRUcmFjayA9IHRoaXMuZGV0ZWN0Q3VycmVudFRyYWNrKCk7XG4gICAgXG4gICAgLy8gSW5pdGlhbCBkZXRlY3Rpb25cbiAgICBjYWxsYmFjayhjdXJyZW50VHJhY2spO1xuXG4gICAgLy8gV2F0Y2ggZm9yIFVSTCBjaGFuZ2VzXG4gICAgY29uc3QgY2hlY2tGb3JDaGFuZ2VzID0gKCkgPT4ge1xuICAgICAgY29uc3QgbmV3VXJsID0gd2luZG93LmxvY2F0aW9uLmhyZWY7XG4gICAgICBpZiAobmV3VXJsICE9PSBjdXJyZW50VXJsKSB7XG4gICAgICAgIGN1cnJlbnRVcmwgPSBuZXdVcmw7XG4gICAgICAgIGNvbnN0IG5ld1RyYWNrID0gdGhpcy5kZXRlY3RDdXJyZW50VHJhY2soKTtcbiAgICAgICAgXG4gICAgICAgIC8vIE9ubHkgdHJpZ2dlciBjYWxsYmFjayBpZiB0cmFjayBhY3R1YWxseSBjaGFuZ2VkXG4gICAgICAgIGNvbnN0IHRyYWNrQ2hhbmdlZCA9ICFjdXJyZW50VHJhY2sgfHwgIW5ld1RyYWNrIHx8IFxuICAgICAgICAgIGN1cnJlbnRUcmFjay50cmFja0lkICE9PSBuZXdUcmFjay50cmFja0lkO1xuICAgICAgICAgIFxuICAgICAgICBpZiAodHJhY2tDaGFuZ2VkKSB7XG4gICAgICAgICAgY3VycmVudFRyYWNrID0gbmV3VHJhY2s7XG4gICAgICAgICAgY2FsbGJhY2sobmV3VHJhY2spO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIFBvbGwgZm9yIGNoYW5nZXMgKFNQQXMgZG9uJ3QgYWx3YXlzIHRyaWdnZXIgcHJvcGVyIG5hdmlnYXRpb24gZXZlbnRzKVxuICAgIGNvbnN0IGludGVydmFsID0gc2V0SW50ZXJ2YWwoY2hlY2tGb3JDaGFuZ2VzLCAxMDAwKTtcblxuICAgIC8vIEFsc28gbGlzdGVuIGZvciBuYXZpZ2F0aW9uIGV2ZW50c1xuICAgIGNvbnN0IGhhbmRsZU5hdmlnYXRpb24gPSAoKSA9PiB7XG4gICAgICBzZXRUaW1lb3V0KGNoZWNrRm9yQ2hhbmdlcywgMTAwKTsgLy8gU21hbGwgZGVsYXkgZm9yIERPTSB1cGRhdGVzXG4gICAgfTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb3BzdGF0ZScsIGhhbmRsZU5hdmlnYXRpb24pO1xuICAgIFxuICAgIC8vIExpc3RlbiBmb3IgcHVzaHN0YXRlL3JlcGxhY2VzdGF0ZSAoU291bmRDbG91ZCB1c2VzIHRoZXNlKVxuICAgIGNvbnN0IG9yaWdpbmFsUHVzaFN0YXRlID0gaGlzdG9yeS5wdXNoU3RhdGU7XG4gICAgY29uc3Qgb3JpZ2luYWxSZXBsYWNlU3RhdGUgPSBoaXN0b3J5LnJlcGxhY2VTdGF0ZTtcbiAgICBcbiAgICBoaXN0b3J5LnB1c2hTdGF0ZSA9IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICAgIG9yaWdpbmFsUHVzaFN0YXRlLmFwcGx5KGhpc3RvcnksIGFyZ3MpO1xuICAgICAgaGFuZGxlTmF2aWdhdGlvbigpO1xuICAgIH07XG4gICAgXG4gICAgaGlzdG9yeS5yZXBsYWNlU3RhdGUgPSBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgICBvcmlnaW5hbFJlcGxhY2VTdGF0ZS5hcHBseShoaXN0b3J5LCBhcmdzKTtcbiAgICAgIGhhbmRsZU5hdmlnYXRpb24oKTtcbiAgICB9O1xuXG4gICAgLy8gUmV0dXJuIGNsZWFudXAgZnVuY3Rpb25cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCBoYW5kbGVOYXZpZ2F0aW9uKTtcbiAgICAgIGhpc3RvcnkucHVzaFN0YXRlID0gb3JpZ2luYWxQdXNoU3RhdGU7XG4gICAgICBoaXN0b3J5LnJlcGxhY2VTdGF0ZSA9IG9yaWdpbmFsUmVwbGFjZVN0YXRlO1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IHRyYWNrRGV0ZWN0b3IgPSBuZXcgVHJhY2tEZXRlY3RvcigpOyIsIi8vIFVzaW5nIGJyb3dzZXIuc3RvcmFnZSBBUEkgZGlyZWN0bHkgZm9yIHNpbXBsaWNpdHlcbmltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG5cbi8vIEhlbHBlciB0byBnZXQgYXV0aCB0b2tlblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEF1dGhUb2tlbigpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLmdldCgnYXV0aFRva2VuJyk7XG4gIHJldHVybiByZXN1bHQuYXV0aFRva2VuIHx8IG51bGw7XG59XG5cbi8vIEhlbHBlciB0byBzZXQgYXV0aCB0b2tlblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldEF1dGhUb2tlbih0b2tlbjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5zZXQoeyBhdXRoVG9rZW46IHRva2VuIH0pO1xufVxuXG4vLyBIZWxwZXIgdG8gZ2V0IGluc3RhbGxhdGlvbiBzdGF0ZVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEluc3RhbGxhdGlvblN0YXRlKCk6IFByb21pc2U8e1xuICBjb21wbGV0ZWQ6IGJvb2xlYW47XG4gIGp3dFZlcmlmaWVkOiBib29sZWFuO1xuICB0aW1lc3RhbXA/OiBudW1iZXI7XG59PiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5nZXQoJ2luc3RhbGxhdGlvblN0YXRlJyk7XG4gIHJldHVybiByZXN1bHQuaW5zdGFsbGF0aW9uU3RhdGUgfHwge1xuICAgIGNvbXBsZXRlZDogZmFsc2UsXG4gICAgand0VmVyaWZpZWQ6IGZhbHNlLFxuICB9O1xufVxuXG4vLyBIZWxwZXIgdG8gc2V0IGluc3RhbGxhdGlvbiBzdGF0ZVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldEluc3RhbGxhdGlvblN0YXRlKHN0YXRlOiB7XG4gIGNvbXBsZXRlZDogYm9vbGVhbjtcbiAgand0VmVyaWZpZWQ6IGJvb2xlYW47XG4gIHRpbWVzdGFtcD86IG51bWJlcjtcbn0pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnNldCh7IGluc3RhbGxhdGlvblN0YXRlOiBzdGF0ZSB9KTtcbn1cblxuLy8gSGVscGVyIHRvIGNoZWNrIGlmIHVzZXIgaXMgYXV0aGVudGljYXRlZFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGlzQXV0aGVudGljYXRlZCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgY29uc3QgdG9rZW4gPSBhd2FpdCBnZXRBdXRoVG9rZW4oKTtcbiAgcmV0dXJuICEhdG9rZW4gJiYgdG9rZW4uc3RhcnRzV2l0aCgnc2NhcmxldHRfJyk7XG59XG5cbi8vIEhlbHBlciB0byBjbGVhciBhdXRoIGRhdGFcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjbGVhckF1dGgoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5yZW1vdmUoWydhdXRoVG9rZW4nLCAnaW5zdGFsbGF0aW9uU3RhdGUnXSk7XG59IiwiZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlRGF0YSB7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIHRyYWNrX2lkPzogc3RyaW5nO1xuICB0cmFja0lkPzogc3RyaW5nO1xuICBoYXNfa2FyYW9rZT86IGJvb2xlYW47XG4gIGhhc0thcmFva2U/OiBib29sZWFuO1xuICBzb25nPzoge1xuICAgIGlkOiBzdHJpbmc7XG4gICAgdGl0bGU6IHN0cmluZztcbiAgICBhcnRpc3Q6IHN0cmluZztcbiAgICBhbGJ1bT86IHN0cmluZztcbiAgICBhcnR3b3JrVXJsPzogc3RyaW5nO1xuICAgIGR1cmF0aW9uPzogbnVtYmVyO1xuICAgIGRpZmZpY3VsdHk6ICdiZWdpbm5lcicgfCAnaW50ZXJtZWRpYXRlJyB8ICdhZHZhbmNlZCc7XG4gIH07XG4gIGx5cmljcz86IHtcbiAgICBzb3VyY2U6IHN0cmluZztcbiAgICB0eXBlOiAnc3luY2VkJztcbiAgICBsaW5lczogTHlyaWNMaW5lW107XG4gICAgdG90YWxMaW5lczogbnVtYmVyO1xuICB9O1xuICBtZXNzYWdlPzogc3RyaW5nO1xuICBlcnJvcj86IHN0cmluZztcbiAgYXBpX2Nvbm5lY3RlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTHlyaWNMaW5lIHtcbiAgaWQ6IHN0cmluZztcbiAgdGV4dDogc3RyaW5nO1xuICBzdGFydFRpbWU6IG51bWJlcjtcbiAgZHVyYXRpb246IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlU2Vzc2lvbiB7XG4gIGlkOiBzdHJpbmc7XG4gIHRyYWNrSWQ6IHN0cmluZztcbiAgc29uZ1RpdGxlOiBzdHJpbmc7XG4gIHNvbmdBcnRpc3Q6IHN0cmluZztcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGNyZWF0ZWRBdDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgS2FyYW9rZUFwaVNlcnZpY2Uge1xuICBwcml2YXRlIGJhc2VVcmw6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICAvLyBVc2UgdGhlIGxvY2FsIHNlcnZlciBlbmRwb2ludFxuICAgIHRoaXMuYmFzZVVybCA9ICdodHRwOi8vbG9jYWxob3N0Ojg3ODcvYXBpJztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQga2FyYW9rZSBkYXRhIGZvciBhIHRyYWNrIElEIChZb3VUdWJlL1NvdW5kQ2xvdWQpXG4gICAqL1xuICBhc3luYyBnZXRLYXJhb2tlRGF0YShcbiAgICB0cmFja0lkOiBzdHJpbmcsIFxuICAgIHRpdGxlPzogc3RyaW5nLCBcbiAgICBhcnRpc3Q/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxLYXJhb2tlRGF0YSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xuICAgICAgaWYgKHRpdGxlKSBwYXJhbXMuc2V0KCd0aXRsZScsIHRpdGxlKTtcbiAgICAgIGlmIChhcnRpc3QpIHBhcmFtcy5zZXQoJ2FydGlzdCcsIGFydGlzdCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0va2FyYW9rZS8ke2VuY29kZVVSSUNvbXBvbmVudCh0cmFja0lkKX0ke3BhcmFtcy50b1N0cmluZygpID8gJz8nICsgcGFyYW1zLnRvU3RyaW5nKCkgOiAnJ31gO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VBcGldIEZldGNoaW5nIGthcmFva2UgZGF0YTonLCB1cmwpO1xuICAgICAgXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAvLyBSZW1vdmUgQ29udGVudC1UeXBlIGhlYWRlciB0byBhdm9pZCBDT1JTIHByZWZsaWdodFxuICAgICAgICAvLyBoZWFkZXJzOiB7XG4gICAgICAgIC8vICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgLy8gfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZmV0Y2gga2FyYW9rZSBkYXRhOicsIHJlc3BvbnNlLnN0YXR1cyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXBpXSBSZWNlaXZlZCBrYXJhb2tlIGRhdGE6JywgZGF0YSk7XG4gICAgICBcbiAgICAgIC8vIElmIHRoZXJlJ3MgYW4gZXJyb3IgYnV0IHdlIGdvdCBhIHJlc3BvbnNlLCBpdCBtZWFucyBBUEkgaXMgY29ubmVjdGVkXG4gICAgICBpZiAoZGF0YS5lcnJvcikge1xuICAgICAgICBjb25zb2xlLmxvZygnW0thcmFva2VBcGldIFNlcnZlciBlcnJvciAoYnV0IEFQSSBpcyByZWFjaGFibGUpOicsIGRhdGEuZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGhhc19rYXJhb2tlOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcjogZGF0YS5lcnJvcixcbiAgICAgICAgICB0cmFja19pZDogdHJhY2tJZCxcbiAgICAgICAgICBhcGlfY29ubmVjdGVkOiB0cnVlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRXJyb3IgZmV0Y2hpbmcga2FyYW9rZSBkYXRhOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFydCBhIGthcmFva2Ugc2Vzc2lvblxuICAgKi9cbiAgYXN5bmMgc3RhcnRTZXNzaW9uKFxuICAgIHRyYWNrSWQ6IHN0cmluZyxcbiAgICBzb25nRGF0YToge1xuICAgICAgdGl0bGU6IHN0cmluZztcbiAgICAgIGFydGlzdDogc3RyaW5nO1xuICAgICAgYWxidW0/OiBzdHJpbmc7XG4gICAgICBkdXJhdGlvbj86IG51bWJlcjtcbiAgICB9XG4gICk6IFByb21pc2U8S2FyYW9rZVNlc3Npb24gfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7dGhpcy5iYXNlVXJsfS9rYXJhb2tlL3N0YXJ0YCwge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgLy8gVE9ETzogQWRkIGF1dGggdG9rZW4gd2hlbiBhdmFpbGFibGVcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHRyYWNrSWQsXG4gICAgICAgICAgc29uZ0RhdGEsXG4gICAgICAgIH0pLFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBzdGFydCBzZXNzaW9uOicsIHJlc3BvbnNlLnN0YXR1cyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICByZXR1cm4gcmVzdWx0LnNlc3Npb247XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBFcnJvciBzdGFydGluZyBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUZXN0IGNvbm5lY3Rpb24gdG8gdGhlIEFQSVxuICAgKi9cbiAgYXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7dGhpcy5iYXNlVXJsLnJlcGxhY2UoJy9hcGknLCAnJyl9L2hlYWx0aGApO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLm9rO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gQ29ubmVjdGlvbiB0ZXN0IGZhaWxlZDonLCBlcnJvcik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBrYXJhb2tlQXBpID0gbmV3IEthcmFva2VBcGlTZXJ2aWNlKCk7IiwiaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgUHJhY3RpY2VFeGVyY2lzZVZpZXcgfSBmcm9tICdAc2NhcmxldHQvdWknO1xuXG5pbnRlcmZhY2UgUHJhY3RpY2VWaWV3UHJvcHMge1xuICBzZXNzaW9uSWQ/OiBzdHJpbmc7XG4gIG9uQmFjazogKCkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IFByYWN0aWNlVmlldzogQ29tcG9uZW50PFByYWN0aWNlVmlld1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxQcmFjdGljZUV4ZXJjaXNlVmlldyBcbiAgICAgIHNlc3Npb25JZD17cHJvcHMuc2Vzc2lvbklkfVxuICAgICAgb25CYWNrPXtwcm9wcy5vbkJhY2t9XG4gICAgICAvLyBFeHRlbnNpb24gZG9lc24ndCB1c2UgYXV0aCB5ZXRcbiAgICAgIC8vIGFwaUJhc2VVcmwgaXMgZGVmYXVsdCBsb2NhbGhvc3Q6ODc4N1xuICAgIC8+XG4gICk7XG59OyIsImltcG9ydCB7IENvbXBvbmVudCwgY3JlYXRlU2lnbmFsLCBjcmVhdGVFZmZlY3QsIG9uTW91bnQsIG9uQ2xlYW51cCwgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkthcmFva2VWaWV3LCBNaW5pbWl6ZWRLYXJhb2tlLCBDb3VudGRvd24sIENvbXBsZXRpb25WaWV3LCB1c2VLYXJhb2tlU2Vzc2lvbiwgRXh0ZW5zaW9uQXVkaW9TZXJ2aWNlLCBJMThuUHJvdmlkZXIsIHR5cGUgUGxheWJhY2tTcGVlZCB9IGZyb20gJ0BzY2FybGV0dC91aSc7XG5pbXBvcnQgeyB0cmFja0RldGVjdG9yLCB0eXBlIFRyYWNrSW5mbyB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3RyYWNrLWRldGVjdG9yJztcbmltcG9ydCB7IGdldEF1dGhUb2tlbiB9IGZyb20gJy4uLy4uL3V0aWxzL3N0b3JhZ2UnO1xuaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gJ3d4dC9icm93c2VyJztcbmltcG9ydCB7IGthcmFva2VBcGkgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9rYXJhb2tlLWFwaSc7XG5pbXBvcnQgeyBQcmFjdGljZVZpZXcgfSBmcm9tICcuL1ByYWN0aWNlVmlldyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29udGVudEFwcFByb3BzIHt9XG5cbmV4cG9ydCBjb25zdCBDb250ZW50QXBwOiBDb21wb25lbnQ8Q29udGVudEFwcFByb3BzPiA9ICgpID0+IHtcbiAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBSZW5kZXJpbmcgQ29udGVudEFwcCBjb21wb25lbnQnKTtcbiAgXG4gIC8vIFN0YXRlXG4gIGNvbnN0IFtjdXJyZW50VHJhY2ssIHNldEN1cnJlbnRUcmFja10gPSBjcmVhdGVTaWduYWw8VHJhY2tJbmZvIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFthdXRoVG9rZW4sIHNldEF1dGhUb2tlbl0gPSBjcmVhdGVTaWduYWw8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtzaG93S2FyYW9rZSwgc2V0U2hvd0thcmFva2VdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2thcmFva2VEYXRhLCBzZXRLYXJhb2tlRGF0YV0gPSBjcmVhdGVTaWduYWw8YW55PihudWxsKTtcbiAgY29uc3QgW2xvYWRpbmcsIHNldExvYWRpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3Nlc3Npb25TdGFydGVkLCBzZXRTZXNzaW9uU3RhcnRlZF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbaXNNaW5pbWl6ZWQsIHNldElzTWluaW1pemVkXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtjb3VudGRvd24sIHNldENvdW50ZG93bl0gPSBjcmVhdGVTaWduYWw8bnVtYmVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtpc1BsYXlpbmcsIHNldElzUGxheWluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbY3VycmVudFRpbWUsIHNldEN1cnJlbnRUaW1lXSA9IGNyZWF0ZVNpZ25hbCgwKTtcbiAgY29uc3QgW2F1ZGlvUmVmLCBzZXRBdWRpb1JlZl0gPSBjcmVhdGVTaWduYWw8SFRNTEF1ZGlvRWxlbWVudCB8IG51bGw+KG51bGwpO1xuICBjb25zdCBba2FyYW9rZVNlc3Npb24sIHNldEthcmFva2VTZXNzaW9uXSA9IGNyZWF0ZVNpZ25hbDxSZXR1cm5UeXBlPHR5cGVvZiB1c2VLYXJhb2tlU2Vzc2lvbj4gfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2NvbXBsZXRpb25EYXRhLCBzZXRDb21wbGV0aW9uRGF0YV0gPSBjcmVhdGVTaWduYWw8YW55PihudWxsKTtcbiAgY29uc3QgW3Nob3dQcmFjdGljZSwgc2V0U2hvd1ByYWN0aWNlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtzZWxlY3RlZFNwZWVkLCBzZXRTZWxlY3RlZFNwZWVkXSA9IGNyZWF0ZVNpZ25hbDxQbGF5YmFja1NwZWVkPignMXgnKTtcbiAgXG4gIC8vIExvYWQgYXV0aCB0b2tlbiBvbiBtb3VudFxuICBvbk1vdW50KGFzeW5jICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIExvYWRpbmcgYXV0aCB0b2tlbicpO1xuICAgIGNvbnN0IHRva2VuID0gYXdhaXQgZ2V0QXV0aFRva2VuKCk7XG4gICAgaWYgKHRva2VuKSB7XG4gICAgICBzZXRBdXRoVG9rZW4odG9rZW4pO1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBBdXRoIHRva2VuIGxvYWRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgZGVtbyB0b2tlbiBmb3IgZGV2ZWxvcG1lbnRcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTm8gYXV0aCB0b2tlbiBmb3VuZCwgdXNpbmcgZGVtbyB0b2tlbicpO1xuICAgICAgc2V0QXV0aFRva2VuKCdzY2FybGV0dF9kZW1vX3Rva2VuXzEyMycpO1xuICAgIH1cbiAgICBcbiAgICAvLyBTdGFydCB3YXRjaGluZyBmb3IgdHJhY2sgY2hhbmdlc1xuICAgIGNvbnN0IGNsZWFudXAgPSB0cmFja0RldGVjdG9yLndhdGNoRm9yQ2hhbmdlcygodHJhY2spID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gVHJhY2sgY2hhbmdlZDonLCB0cmFjayk7XG4gICAgICBzZXRDdXJyZW50VHJhY2sodHJhY2spO1xuICAgICAgLy8gU2hvdyBrYXJhb2tlIHdoZW4gdHJhY2sgaXMgZGV0ZWN0ZWQgYW5kIGZldGNoIGRhdGFcbiAgICAgIGlmICh0cmFjaykge1xuICAgICAgICBzZXRTaG93S2FyYW9rZSh0cnVlKTtcbiAgICAgICAgZmV0Y2hLYXJhb2tlRGF0YSh0cmFjayk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBvbkNsZWFudXAoY2xlYW51cCk7XG4gIH0pO1xuXG4gIGNvbnN0IGZldGNoS2FyYW9rZURhdGEgPSBhc3luYyAodHJhY2s6IFRyYWNrSW5mbykgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRmV0Y2hpbmcga2FyYW9rZSBkYXRhIGZvciB0cmFjazonLCB0cmFjayk7XG4gICAgc2V0TG9hZGluZyh0cnVlKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGthcmFva2VBcGkuZ2V0S2FyYW9rZURhdGEoXG4gICAgICAgIHRyYWNrLnRyYWNrSWQsXG4gICAgICAgIHRyYWNrLnRpdGxlLFxuICAgICAgICB0cmFjay5hcnRpc3RcbiAgICAgICk7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEthcmFva2UgZGF0YSBsb2FkZWQ6JywgZGF0YSk7XG4gICAgICBzZXRLYXJhb2tlRGF0YShkYXRhKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0NvbnRlbnRBcHBdIEZhaWxlZCB0byBmZXRjaCBrYXJhb2tlIGRhdGE6JywgZXJyb3IpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRMb2FkaW5nKGZhbHNlKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlU3RhcnQgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTdGFydCBrYXJhb2tlIHNlc3Npb24nKTtcbiAgICBzZXRTZXNzaW9uU3RhcnRlZCh0cnVlKTtcbiAgICBcbiAgICBjb25zdCBkYXRhID0ga2FyYW9rZURhdGEoKTtcbiAgICBjb25zdCBhdWRpbyA9IGF1ZGlvUmVmKCk7XG4gICAgY29uc3QgdHJhY2sgPSBjdXJyZW50VHJhY2soKTtcbiAgICBcbiAgICBpZiAoZGF0YSAmJiB0cmFjayAmJiBkYXRhLmx5cmljcz8ubGluZXMpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQ3JlYXRpbmcga2FyYW9rZSBzZXNzaW9uIHdpdGggYXVkaW8gY2FwdHVyZScsIHtcbiAgICAgICAgdHJhY2tJZDogdHJhY2suaWQsXG4gICAgICAgIHRyYWNrVGl0bGU6IHRyYWNrLnRpdGxlLFxuICAgICAgICBzb25nRGF0YTogZGF0YS5zb25nLFxuICAgICAgICBoYXNMeXJpY3M6ICEhZGF0YS5seXJpY3M/LmxpbmVzXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gQ3JlYXRlIGFuZCBzdGFydCBzZXNzaW9uXG4gICAgICBjb25zdCBuZXdTZXNzaW9uID0gdXNlS2FyYW9rZVNlc3Npb24oe1xuICAgICAgICBseXJpY3M6IGRhdGEubHlyaWNzLmxpbmVzLFxuICAgICAgICB0cmFja0lkOiB0cmFjay50cmFja0lkLFxuICAgICAgICBzb25nRGF0YTogZGF0YS5zb25nID8ge1xuICAgICAgICAgIHRpdGxlOiBkYXRhLnNvbmcudGl0bGUsXG4gICAgICAgICAgYXJ0aXN0OiBkYXRhLnNvbmcuYXJ0aXN0LFxuICAgICAgICAgIGFsYnVtOiBkYXRhLnNvbmcuYWxidW0sXG4gICAgICAgICAgZHVyYXRpb246IGRhdGEuc29uZy5kdXJhdGlvblxuICAgICAgICB9IDoge1xuICAgICAgICAgIHRpdGxlOiB0cmFjay50aXRsZSxcbiAgICAgICAgICBhcnRpc3Q6IHRyYWNrLmFydGlzdFxuICAgICAgICB9LFxuICAgICAgICBzb25nQ2F0YWxvZ0lkOiBkYXRhLnNvbmdfY2F0YWxvZ19pZCxcbiAgICAgICAgYXVkaW9FbGVtZW50OiB1bmRlZmluZWQsIC8vIFdpbGwgYmUgc2V0IHdoZW4gYXVkaW8gc3RhcnRzIHBsYXlpbmdcbiAgICAgICAgYXBpVXJsOiAnaHR0cDovL2xvY2FsaG9zdDo4Nzg3L2FwaScsXG4gICAgICAgIG9uQ29tcGxldGU6IChyZXN1bHRzKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBLYXJhb2tlIHNlc3Npb24gY29tcGxldGVkOicsIHJlc3VsdHMpO1xuICAgICAgICAgIHNldFNlc3Npb25TdGFydGVkKGZhbHNlKTtcbiAgICAgICAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgICAgICAgIHNldENvbXBsZXRpb25EYXRhKHJlc3VsdHMpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIFN0b3AgYXVkaW8gcGxheWJhY2tcbiAgICAgICAgICBjb25zdCBhdWRpbyA9IGF1ZGlvUmVmKCk7XG4gICAgICAgICAgaWYgKGF1ZGlvKSB7XG4gICAgICAgICAgICBhdWRpby5wYXVzZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIEFwcGx5IHRoZSBzZWxlY3RlZCBzcGVlZCB0byB0aGUgbmV3IHNlc3Npb25cbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXBwbHlpbmcgc2VsZWN0ZWQgc3BlZWQgdG8gbmV3IHNlc3Npb246Jywgc2VsZWN0ZWRTcGVlZCgpKTtcbiAgICAgIG5ld1Nlc3Npb24uaGFuZGxlU3BlZWRDaGFuZ2Uoc2VsZWN0ZWRTcGVlZCgpKTtcbiAgICAgIFxuICAgICAgc2V0S2FyYW9rZVNlc3Npb24obmV3U2Vzc2lvbik7XG4gICAgICBcbiAgICAgIC8vIFN0YXJ0IHRoZSBzZXNzaW9uIChpbmNsdWRlcyBjb3VudGRvd24gYW5kIGF1ZGlvIGluaXRpYWxpemF0aW9uKVxuICAgICAgYXdhaXQgbmV3U2Vzc2lvbi5zdGFydFNlc3Npb24oKTtcbiAgICAgIFxuICAgICAgLy8gV2F0Y2ggZm9yIGNvdW50ZG93biB0byBmaW5pc2ggYW5kIHN0YXJ0IGF1ZGlvXG4gICAgICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgICAgICBpZiAobmV3U2Vzc2lvbi5jb3VudGRvd24oKSA9PT0gbnVsbCAmJiBuZXdTZXNzaW9uLmlzUGxheWluZygpICYmICFpc1BsYXlpbmcoKSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQ291bnRkb3duIGZpbmlzaGVkLCBzdGFydGluZyBhdWRpbyBwbGF5YmFjaycpO1xuICAgICAgICAgIHN0YXJ0QXVkaW9QbGF5YmFjaygpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBVcGRhdGUgc2Vzc2lvbiB3aXRoIGF1ZGlvIGVsZW1lbnQgd2hlbiBhdmFpbGFibGVcbiAgICAgICAgY29uc3QgYXVkaW8gPSBhdWRpb1JlZigpO1xuICAgICAgICBpZiAoYXVkaW8gJiYgbmV3U2Vzc2lvbikge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU2V0dGluZyBhdWRpbyBlbGVtZW50IG9uIG5ldyBzZXNzaW9uJyk7XG4gICAgICAgICAgbmV3U2Vzc2lvbi5zZXRBdWRpb0VsZW1lbnQoYXVkaW8pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGYWxsYmFjayB0byBzaW1wbGUgY291bnRkb3duJyk7XG4gICAgICAvLyBGYWxsYmFjayB0byBvbGQgYmVoYXZpb3JcbiAgICAgIHNldENvdW50ZG93bigzKTtcbiAgICAgIFxuICAgICAgY29uc3QgY291bnRkb3duSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSBjb3VudGRvd24oKTtcbiAgICAgICAgaWYgKGN1cnJlbnQgIT09IG51bGwgJiYgY3VycmVudCA+IDEpIHtcbiAgICAgICAgICBzZXRDb3VudGRvd24oY3VycmVudCAtIDEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNsZWFySW50ZXJ2YWwoY291bnRkb3duSW50ZXJ2YWwpO1xuICAgICAgICAgIHNldENvdW50ZG93bihudWxsKTtcbiAgICAgICAgICBzdGFydEF1ZGlvUGxheWJhY2soKTtcbiAgICAgICAgfVxuICAgICAgfSwgMTAwMCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IHN0YXJ0QXVkaW9QbGF5YmFjayA9ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFN0YXJ0aW5nIGF1ZGlvIHBsYXliYWNrJyk7XG4gICAgc2V0SXNQbGF5aW5nKHRydWUpO1xuICAgIFxuICAgIC8vIFRyeSBtdWx0aXBsZSBtZXRob2RzIHRvIGZpbmQgYW5kIHBsYXkgYXVkaW9cbiAgICAvLyBNZXRob2QgMTogTG9vayBmb3IgYXVkaW8gZWxlbWVudHNcbiAgICBjb25zdCBhdWRpb0VsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnYXVkaW8nKTtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZvdW5kIGF1ZGlvIGVsZW1lbnRzOicsIGF1ZGlvRWxlbWVudHMubGVuZ3RoKTtcbiAgICBcbiAgICBpZiAoYXVkaW9FbGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBhdWRpbyA9IGF1ZGlvRWxlbWVudHNbMF0gYXMgSFRNTEF1ZGlvRWxlbWVudDtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXVkaW8gZWxlbWVudDonLCB7XG4gICAgICAgIHNyYzogYXVkaW8uc3JjLFxuICAgICAgICBwYXVzZWQ6IGF1ZGlvLnBhdXNlZCxcbiAgICAgICAgZHVyYXRpb246IGF1ZGlvLmR1cmF0aW9uLFxuICAgICAgICBjdXJyZW50VGltZTogYXVkaW8uY3VycmVudFRpbWVcbiAgICAgIH0pO1xuICAgICAgc2V0QXVkaW9SZWYoYXVkaW8pO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUga2FyYW9rZSBzZXNzaW9uIHdpdGggYXVkaW8gZWxlbWVudCBpZiBpdCBleGlzdHNcbiAgICAgIGNvbnN0IHNlc3Npb24gPSBrYXJhb2tlU2Vzc2lvbigpO1xuICAgICAgaWYgKHNlc3Npb24pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTZXR0aW5nIGF1ZGlvIGVsZW1lbnQgb24ga2FyYW9rZSBzZXNzaW9uJyk7XG4gICAgICAgIHNlc3Npb24uc2V0QXVkaW9FbGVtZW50KGF1ZGlvKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghc2Vzc2lvbi5hdWRpb1Byb2Nlc3Nvci5pc1JlYWR5KCkpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEluaXRpYWxpemluZyBhdWRpbyBwcm9jZXNzb3IgZm9yIHNlc3Npb24nKTtcbiAgICAgICAgICBzZXNzaW9uLmF1ZGlvUHJvY2Vzc29yLmluaXRpYWxpemUoKS5jYXRjaChjb25zb2xlLmVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBUcnkgdG8gcGxheSB0aGUgYXVkaW9cbiAgICAgIGF1ZGlvLnBsYXkoKS50aGVuKCgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBBdWRpbyBzdGFydGVkIHBsYXlpbmcgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICB9KS5jYXRjaChlcnIgPT4ge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbQ29udGVudEFwcF0gRmFpbGVkIHRvIHBsYXkgYXVkaW86JywgZXJyKTtcbiAgICAgICAgXG4gICAgICAgIC8vIE1ldGhvZCAyOiBUcnkgY2xpY2tpbmcgdGhlIHBsYXkgYnV0dG9uIG9uIHRoZSBwYWdlXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXR0ZW1wdGluZyB0byBjbGljayBwbGF5IGJ1dHRvbi4uLicpO1xuICAgICAgICBjb25zdCBwbGF5QnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYnV0dG9uW3RpdGxlKj1cIlBsYXlcIl0sIGJ1dHRvblthcmlhLWxhYmVsKj1cIlBsYXlcIl0sIC5wbGF5Q29udHJvbCwgLnBsYXlCdXR0b24sIFtjbGFzcyo9XCJwbGF5LWJ1dHRvblwiXScpO1xuICAgICAgICBpZiAocGxheUJ1dHRvbikge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRm91bmQgcGxheSBidXR0b24sIGNsaWNraW5nIGl0Jyk7XG4gICAgICAgICAgKHBsYXlCdXR0b24gYXMgSFRNTEVsZW1lbnQpLmNsaWNrKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgY3VycmVudCB0aW1lXG4gICAgICBjb25zdCB1cGRhdGVUaW1lID0gKCkgPT4ge1xuICAgICAgICBzZXRDdXJyZW50VGltZShhdWRpby5jdXJyZW50VGltZSk7XG4gICAgICB9O1xuICAgICAgXG4gICAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdXBkYXRlVGltZSk7XG4gICAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsICgpID0+IHtcbiAgICAgICAgc2V0SXNQbGF5aW5nKGZhbHNlKTtcbiAgICAgICAgYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIHVwZGF0ZVRpbWUpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE1ldGhvZCAzOiBUcnkgU291bmRDbG91ZCBzcGVjaWZpYyBzZWxlY3RvcnNcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTm8gYXVkaW8gZWxlbWVudHMgZm91bmQsIHRyeWluZyBTb3VuZENsb3VkLXNwZWNpZmljIGFwcHJvYWNoJyk7XG4gICAgICBjb25zdCBwbGF5QnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnBsYXlDb250cm9sLCAuc2MtYnV0dG9uLXBsYXksIGJ1dHRvblt0aXRsZSo9XCJQbGF5XCJdJyk7XG4gICAgICBpZiAocGxheUJ1dHRvbikge1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZvdW5kIFNvdW5kQ2xvdWQgcGxheSBidXR0b24sIGNsaWNraW5nIGl0Jyk7XG4gICAgICAgIChwbGF5QnV0dG9uIGFzIEhUTUxFbGVtZW50KS5jbGljaygpO1xuICAgICAgICBcbiAgICAgICAgLy8gV2FpdCBhIGJpdCBhbmQgdGhlbiBsb29rIGZvciBhdWRpbyBlbGVtZW50IGFnYWluXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IG5ld0F1ZGlvRWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdhdWRpbycpO1xuICAgICAgICAgIGlmIChuZXdBdWRpb0VsZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRm91bmQgYXVkaW8gZWxlbWVudCBhZnRlciBjbGlja2luZyBwbGF5Jyk7XG4gICAgICAgICAgICBjb25zdCBhdWRpbyA9IG5ld0F1ZGlvRWxlbWVudHNbMF0gYXMgSFRNTEF1ZGlvRWxlbWVudDtcbiAgICAgICAgICAgIHNldEF1ZGlvUmVmKGF1ZGlvKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVXBkYXRlIGN1cnJlbnQgdGltZVxuICAgICAgICAgICAgY29uc3QgdXBkYXRlVGltZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgc2V0Q3VycmVudFRpbWUoYXVkaW8uY3VycmVudFRpbWUpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIHVwZGF0ZVRpbWUpO1xuICAgICAgICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgICAgICAgICAgIGF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB1cGRhdGVUaW1lKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgNTAwKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlQ2xvc2UgPSAoKSA9PiB7XG4gICAgLy8gU3RvcCBzZXNzaW9uIGlmIGFjdGl2ZVxuICAgIGNvbnN0IHNlc3Npb24gPSBrYXJhb2tlU2Vzc2lvbigpO1xuICAgIGlmIChzZXNzaW9uKSB7XG4gICAgICBzZXNzaW9uLnN0b3BTZXNzaW9uKCk7XG4gICAgfVxuICAgIFxuICAgIHNldFNob3dLYXJhb2tlKGZhbHNlKTtcbiAgICBzZXRLYXJhb2tlRGF0YShudWxsKTtcbiAgICBzZXRTZXNzaW9uU3RhcnRlZChmYWxzZSk7XG4gICAgc2V0S2FyYW9rZVNlc3Npb24obnVsbCk7XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlTWluaW1pemUgPSAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBNaW5pbWl6ZSBrYXJhb2tlIHdpZGdldCcpO1xuICAgIHNldElzTWluaW1pemVkKHRydWUpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVJlc3RvcmUgPSAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBSZXN0b3JlIGthcmFva2Ugd2lkZ2V0Jyk7XG4gICAgc2V0SXNNaW5pbWl6ZWQoZmFsc2UpO1xuICB9O1xuXG4gIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUmVuZGVyIHN0YXRlOicsIHtcbiAgICBzaG93S2FyYW9rZTogc2hvd0thcmFva2UoKSxcbiAgICBjdXJyZW50VHJhY2s6IGN1cnJlbnRUcmFjaygpLFxuICAgIGthcmFva2VEYXRhOiBrYXJhb2tlRGF0YSgpLFxuICAgIGxvYWRpbmc6IGxvYWRpbmcoKVxuICB9KTtcblxuXG4gIHJldHVybiAoXG4gICAgPD5cbiAgICAgIHsvKiBNaW5pbWl6ZWQgc3RhdGUgKi99XG4gICAgICA8U2hvdyB3aGVuPXtzaG93S2FyYW9rZSgpICYmIGN1cnJlbnRUcmFjaygpICYmIGlzTWluaW1pemVkKCl9PlxuICAgICAgICA8TWluaW1pemVkS2FyYW9rZSBvbkNsaWNrPXtoYW5kbGVSZXN0b3JlfSAvPlxuICAgICAgPC9TaG93PlxuXG4gICAgICB7LyogRnVsbCB3aWRnZXQgc3RhdGUgKi99XG4gICAgICA8U2hvdyB3aGVuPXtzaG93S2FyYW9rZSgpICYmIGN1cnJlbnRUcmFjaygpICYmICFpc01pbmltaXplZCgpfSBmYWxsYmFjaz17XG4gICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ25vbmUnIH19PlxuICAgICAgICAgIHtjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE5vdCBzaG93aW5nIC0gc2hvd0thcmFva2U6Jywgc2hvd0thcmFva2UoKSwgJ2N1cnJlbnRUcmFjazonLCBjdXJyZW50VHJhY2soKSl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgfT5cbiAgICAgICAgPGRpdiBzdHlsZT17e1xuICAgICAgICAgIHBvc2l0aW9uOiAnZml4ZWQnLFxuICAgICAgICAgIHRvcDogJzIwcHgnLFxuICAgICAgICAgIHJpZ2h0OiAnMjBweCcsXG4gICAgICAgICAgYm90dG9tOiAnMjBweCcsXG4gICAgICAgICAgd2lkdGg6ICc0ODBweCcsXG4gICAgICAgICAgJ3otaW5kZXgnOiAnOTk5OTknLFxuICAgICAgICAgIG92ZXJmbG93OiAnaGlkZGVuJyxcbiAgICAgICAgICAnYm9yZGVyLXJhZGl1cyc6ICcxNnB4JyxcbiAgICAgICAgICAnYm94LXNoYWRvdyc6ICcwIDI1cHggNTBweCAtMTJweCByZ2JhKDAsIDAsIDAsIDAuNiknLFxuICAgICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcbiAgICAgICAgICAnZmxleC1kaXJlY3Rpb24nOiAnY29sdW1uJ1xuICAgICAgICB9fT5cbiAgICAgICAgICB7Y29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBSZW5kZXJpbmcgd2l0aCBjb21wbGV0aW9uIGRhdGE6JywgY29tcGxldGlvbkRhdGEoKSl9XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImgtZnVsbCBiZy1zdXJmYWNlIHJvdW5kZWQtMnhsIG92ZXJmbG93LWhpZGRlbiBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICB7LyogSGVhZGVyIHdpdGggbWluaW1pemUgYW5kIGNsb3NlIGJ1dHRvbnMgKi99XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1lbmQgcC0yIGJnLXN1cmZhY2UgYm9yZGVyLWIgYm9yZGVyLXN1YnRsZVwiIHN0eWxlPXt7IGhlaWdodDogJzQ4cHgnIH19PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtzaG93UHJhY3RpY2UoKX0+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dQcmFjdGljZShmYWxzZSl9XG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy0xMCBoLTEwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbGcgdHJhbnNpdGlvbi1jb2xvcnMgaG92ZXI6Ymctd2hpdGUvMTBcIlxuICAgICAgICAgICAgICAgICAgICBzdHlsZT17eyBjb2xvcjogJyNhOGE4YTgnIH19XG4gICAgICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCJDbG9zZSBQcmFjdGljZVwiXG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIDxzdmcgd2lkdGg9XCIyMFwiIGhlaWdodD1cIjIwXCIgdmlld0JveD1cIjAgMCAyMCAyMFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPlxuICAgICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9XCJNMTUgNUw1IDE1TTUgNUwxNSAxNVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIi8+XG4gICAgICAgICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZU1pbmltaXplfVxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LTEwIGgtMTAgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1sZyB0cmFuc2l0aW9uLWNvbG9ycyBob3ZlcjpiZy13aGl0ZS8xMFwiXG4gICAgICAgICAgICAgICAgICBzdHlsZT17eyBjb2xvcjogJyNhOGE4YTgnIH19XG4gICAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiTWluaW1pemVcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxzdmcgd2lkdGg9XCIyNFwiIGhlaWdodD1cIjI0XCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPlxuICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPVwiTTYgMTJoMTJcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIzXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiLz5cbiAgICAgICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgXG4gICAgICAgICAgICB7LyogTWFpbiBjb250ZW50IGFyZWEgKi99XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIG1pbi1oLTAgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICAgIDxTaG93IHdoZW49e2NvbXBsZXRpb25EYXRhKCl9IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXshbG9hZGluZygpfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgaC1mdWxsIGJnLWJhc2VcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFuaW1hdGUtc3BpbiByb3VuZGVkLWZ1bGwgaC0xMiB3LTEyIGJvcmRlci1iLTIgYm9yZGVyLWFjY2VudC1wcmltYXJ5IG14LWF1dG8gbWItNFwiPjwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zZWNvbmRhcnlcIj5Mb2FkaW5nIGx5cmljcy4uLjwvcD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICB9PlxuICAgICAgICAgICAgICAgICAgPFNob3cgd2hlbj17a2FyYW9rZURhdGEoKT8ubHlyaWNzPy5saW5lc30gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgaC1mdWxsIHAtOFwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5IG1iLTJcIj5ObyBseXJpY3MgYXZhaWxhYmxlPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtdGVydGlhcnlcIj5UcnkgYSBkaWZmZXJlbnQgc29uZzwvcD5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICB9PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaC1mdWxsIGZsZXggZmxleC1jb2xcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIG1pbi1oLTAgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8RXh0ZW5zaW9uS2FyYW9rZVZpZXdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcmU9e2thcmFva2VTZXNzaW9uKCkgPyBrYXJhb2tlU2Vzc2lvbigpIS5zY29yZSgpIDogMH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmFuaz17MX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgbHlyaWNzPXtrYXJhb2tlRGF0YSgpPy5seXJpY3M/LmxpbmVzIHx8IFtdfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50VGltZT17a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLmN1cnJlbnRUaW1lKCkgOiBjdXJyZW50VGltZSgpICogMTAwMH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgbGVhZGVyYm9hcmQ9e1tdfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBpc1BsYXlpbmc9e2thcmFva2VTZXNzaW9uKCkgPyAoa2FyYW9rZVNlc3Npb24oKSEuaXNQbGF5aW5nKCkgfHwga2FyYW9rZVNlc3Npb24oKSEuY291bnRkb3duKCkgIT09IG51bGwpIDogKGlzUGxheWluZygpIHx8IGNvdW50ZG93bigpICE9PSBudWxsKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25TdGFydD17aGFuZGxlU3RhcnR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uU3BlZWRDaGFuZ2U9eyhzcGVlZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU3BlZWQgY2hhbmdlZDonLCBzcGVlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2VsZWN0ZWRTcGVlZChzcGVlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2Vzc2lvbiA9IGthcmFva2VTZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNlc3Npb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXBwbHlpbmcgc3BlZWQgY2hhbmdlIHRvIHNlc3Npb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlc3Npb24uaGFuZGxlU3BlZWRDaGFuZ2Uoc3BlZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE5vIHNlc3Npb24geWV0LCBzcGVlZCB3aWxsIGJlIGFwcGxpZWQgd2hlbiBzZXNzaW9uIHN0YXJ0cycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbHNvIGFwcGx5IHRvIGF1ZGlvIGVsZW1lbnQgZGlyZWN0bHkgaWYgaXQgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXVkaW8gPSBhdWRpb1JlZigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhdWRpbykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmF0ZSA9IHNwZWVkID09PSAnMC41eCcgPyAwLjUgOiBzcGVlZCA9PT0gJzAuNzV4JyA/IDAuNzUgOiAxLjA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFNldHRpbmcgYXVkaW8gcGxheWJhY2sgcmF0ZSBkaXJlY3RseSB0bzonLCByYXRlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF1ZGlvLnBsYXliYWNrUmF0ZSA9IHJhdGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICBpc1JlY29yZGluZz17a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLmlzUmVjb3JkaW5nKCkgOiBmYWxzZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgbGluZVNjb3Jlcz17a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLmxpbmVTY29yZXMoKSA6IFtdfVxuICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICB7LyogQ291bnRkb3duIG92ZXJsYXkgKi99XG4gICAgICAgICAgICAgICAgICAgICAgPFNob3cgd2hlbj17a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLmNvdW50ZG93bigpICE9PSBudWxsIDogY291bnRkb3duKCkgIT09IG51bGx9PlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFic29sdXRlIGluc2V0LTAgYmctYmxhY2svODAgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgei01MFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC04eGwgZm9udC1ib2xkIHRleHQtd2hpdGUgYW5pbWF0ZS1wdWxzZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2thcmFva2VTZXNzaW9uKCkgPyBrYXJhb2tlU2Vzc2lvbigpIS5jb3VudGRvd24oKSA6IGNvdW50ZG93bigpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC14bCB0ZXh0LXdoaXRlLzgwIG10LTRcIj5HZXQgcmVhZHkhPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICB9PlxuICAgICAgICAgICAgICAgIHsvKiBDb21wbGV0aW9uIFZpZXcgb3IgUHJhY3RpY2UgVmlldyAqL31cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtzaG93UHJhY3RpY2UoKX0gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgICAgPEkxOG5Qcm92aWRlcj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImgtZnVsbCBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPFNob3cgd2hlbj17IWNvbXBsZXRpb25EYXRhKCkuaXNMb2FkaW5nfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgaC1mdWxsIGJnLWJhc2VcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFuaW1hdGUtc3BpbiByb3VuZGVkLWZ1bGwgaC0xNiB3LTE2IGJvcmRlci1iLTIgYm9yZGVyLWFjY2VudC1wcmltYXJ5IG14LWF1dG8gbWItNFwiPjwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeVwiPkNhbGN1bGF0aW5nIHlvdXIgZmluYWwgc2NvcmUuLi48L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtdGVydGlhcnkgbXQtMlwiPkFuYWx5emluZyBmdWxsIHBlcmZvcm1hbmNlPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgICAgICAgICAgICA8Q29tcGxldGlvblZpZXdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJoLWZ1bGxcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICBzY29yZT17Y29tcGxldGlvbkRhdGEoKS5zY29yZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmFuaz17MX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgc3BlZWQ9e3NlbGVjdGVkU3BlZWQoKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmVlZGJhY2tUZXh0PXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0aW9uRGF0YSgpLnNjb3JlID49IDk1ID8gXCJQZXJmZWN0ISBZb3UgbmFpbGVkIGl0IVwiIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0aW9uRGF0YSgpLnNjb3JlID49IDg1ID8gXCJFeGNlbGxlbnQgcGVyZm9ybWFuY2UhXCIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRpb25EYXRhKCkuc2NvcmUgPj0gNzAgPyBcIkdyZWF0IGpvYiFcIiA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGlvbkRhdGEoKS5zY29yZSA+PSA1MCA/IFwiR29vZCBlZmZvcnQhXCIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiS2VlcCBwcmFjdGljaW5nIVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25QcmFjdGljZT17KCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUHJhY3RpY2UgZXJyb3JzIGNsaWNrZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTaG93UHJhY3RpY2UodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L0kxOG5Qcm92aWRlcj5cbiAgICAgICAgICAgICAgICB9PlxuICAgICAgICAgICAgICAgICAgey8qIFByYWN0aWNlIFZpZXcgKi99XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaC1mdWxsIG92ZXJmbG93LXktYXV0b1wiPlxuICAgICAgICAgICAgICAgICAgICA8UHJhY3RpY2VWaWV3XG4gICAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbklkPXtjb21wbGV0aW9uRGF0YSgpPy5zZXNzaW9uSWR9XG4gICAgICAgICAgICAgICAgICAgICAgb25CYWNrPXsoKSA9PiBzZXRTaG93UHJhY3RpY2UoZmFsc2UpfVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L1Nob3c+XG4gICAgPC8+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNoYWRvd1Jvb3RVaSB9IGZyb20gJ3d4dC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdCc7XG5pbXBvcnQgeyBkZWZpbmVDb250ZW50U2NyaXB0IH0gZnJvbSAnd3h0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdCc7XG5pbXBvcnQgdHlwZSB7IENvbnRlbnRTY3JpcHRDb250ZXh0IH0gZnJvbSAnd3h0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQnO1xuaW1wb3J0IHsgcmVuZGVyIH0gZnJvbSAnc29saWQtanMvd2ViJztcbmltcG9ydCB7IENvbnRlbnRBcHAgfSBmcm9tICcuLi9zcmMvdmlld3MvY29udGVudC9Db250ZW50QXBwJztcbmltcG9ydCAnLi4vc3JjL3N0eWxlcy9leHRlbnNpb24uY3NzJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFsnKjovL3NvdW5kY2xvdWQuY29tLyonLCAnKjovL3NvdW5kY2xvYWsuY29tLyonLCAnKjovL3NjLm1haWQuem9uZS8qJywgJyo6Ly8qLm1haWQuem9uZS8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gIGNzc0luamVjdGlvbk1vZGU6ICd1aScsXG5cbiAgYXN5bmMgbWFpbihjdHg6IENvbnRlbnRTY3JpcHRDb250ZXh0KSB7XG4gICAgLy8gT25seSBydW4gaW4gdG9wLWxldmVsIGZyYW1lIHRvIGF2b2lkIGR1cGxpY2F0ZSBwcm9jZXNzaW5nIGluIGlmcmFtZXNcbiAgICBpZiAod2luZG93LnRvcCAhPT0gd2luZG93LnNlbGYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgc2hhZG93IERPTSBhbmQgbW91bnQga2FyYW9rZSB3aWRnZXRcbiAgICBjb25zdCB1aSA9IGF3YWl0IGNyZWF0ZVNoYWRvd1Jvb3RVaShjdHgsIHtcbiAgICAgIG5hbWU6ICdzY2FybGV0dC1rYXJhb2tlLXVpJyxcbiAgICAgIHBvc2l0aW9uOiAnb3ZlcmxheScsXG4gICAgICBhbmNob3I6ICdib2R5JyxcbiAgICAgIG9uTW91bnQ6IGFzeW5jIChjb250YWluZXI6IEhUTUxFbGVtZW50KSA9PiB7XG4gICAgICAgIC8vIENyZWF0ZSB3cmFwcGVyIGRpdiAoQ29udGVudEFwcCB3aWxsIGhhbmRsZSBwb3NpdGlvbmluZyBiYXNlZCBvbiBzdGF0ZSlcbiAgICAgICAgY29uc3Qgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICB3cmFwcGVyLmNsYXNzTmFtZSA9ICdrYXJhb2tlLXdpZGdldC1jb250YWluZXInO1xuICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQod3JhcHBlcik7XG5cbiAgICAgICAgLy8gUmVuZGVyIENvbnRlbnRBcHAgY29tcG9uZW50ICh3aGljaCB1c2VzIEV4dGVuc2lvbkthcmFva2VWaWV3KVxuICAgICAgICBjb25zdCBkaXNwb3NlID0gcmVuZGVyKCgpID0+IDxDb250ZW50QXBwIC8+LCB3cmFwcGVyKTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiBkaXNwb3NlO1xuICAgICAgfSxcbiAgICAgIG9uUmVtb3ZlOiAoY2xlYW51cD86ICgpID0+IHZvaWQpID0+IHtcbiAgICAgICAgY2xlYW51cD8uKCk7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gTW91bnQgdGhlIFVJXG4gICAgdWkubW91bnQoKTtcbiAgfSxcbn0pOyIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIiwiaW1wb3J0IGNvbW1vbiBmcm9tICcuL2NvbW1vbi5qc29uJztcbmltcG9ydCBrYXJhb2tlIGZyb20gJy4va2FyYW9rZS5qc29uJztcbmltcG9ydCBkaXNwbGF5IGZyb20gJy4vZGlzcGxheS5qc29uJztcbmltcG9ydCB0eXBlIHsgVHJhbnNsYXRpb25zIH0gZnJvbSAnLi4vLi4vdHlwZXMnO1xuXG5jb25zdCB0cmFuc2xhdGlvbnM6IFRyYW5zbGF0aW9ucyA9IHtcbiAgY29tbW9uLFxuICBrYXJhb2tlLFxuICBkaXNwbGF5LFxufTtcblxuZXhwb3J0IGRlZmF1bHQgdHJhbnNsYXRpb25zOyIsImltcG9ydCBjb21tb24gZnJvbSAnLi9jb21tb24uanNvbic7XG5pbXBvcnQga2FyYW9rZSBmcm9tICcuL2thcmFva2UuanNvbic7XG5pbXBvcnQgZGlzcGxheSBmcm9tICcuL2Rpc3BsYXkuanNvbic7XG5pbXBvcnQgdHlwZSB7IFRyYW5zbGF0aW9ucyB9IGZyb20gJy4uLy4uL3R5cGVzJztcblxuY29uc3QgdHJhbnNsYXRpb25zOiBUcmFuc2xhdGlvbnMgPSB7XG4gIGNvbW1vbixcbiAga2FyYW9rZSxcbiAgZGlzcGxheSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHRyYW5zbGF0aW9uczsiXSwibmFtZXMiOlsidmFsdWUiLCJlcnJvciIsImNoaWxkcmVuIiwibWVtbyIsImluZGV4IiwicmVzdWx0IiwiaSIsInNvdXJjZXMiLCJkaXNwb3NlIiwiZG9jdW1lbnQiLCJhZGRFdmVudExpc3RlbmVyIiwiYnJvd3NlciIsIl9icm93c2VyIiwiaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSIsInN0eWxlIiwicHJpbnQiLCJsb2dnZXIiLCJfYSIsIl9iIiwicmVtb3ZlRGV0ZWN0b3IiLCJtb3VudERldGVjdG9yIiwiZGVmaW5pdGlvbiIsIl8kZGVsZWdhdGVFdmVudHMiLCJTY29yZVBhbmVsIiwicHJvcHMiLCJfZWwkIiwiX3RtcGwkIiwiX2VsJDIiLCJmaXJzdENoaWxkIiwiX2VsJDMiLCJfZWwkNCIsIm5leHRTaWJsaW5nIiwiX2VsJDUiLCJfJGluc2VydCIsInNjb3JlIiwicmFuayIsIl8kY2xhc3NOYW1lIiwiY24iLCJjbGFzcyIsIkJ1dHRvbiIsImxvY2FsIiwib3RoZXJzIiwic3BsaXRQcm9wcyIsInZhcmlhbnQiLCJzaXplIiwiX3RtcGwkMyIsIl8kc3ByZWFkIiwiXyRtZXJnZVByb3BzIiwiZGlzYWJsZWQiLCJsb2FkaW5nIiwiZnVsbFdpZHRoIiwiXyRjcmVhdGVDb21wb25lbnQiLCJTaG93Iiwid2hlbiIsImxlZnRJY29uIiwiX3RtcGwkMiIsInJpZ2h0SWNvbiIsIkx5cmljc0Rpc3BsYXkiLCJjdXJyZW50TGluZUluZGV4Iiwic2V0Q3VycmVudExpbmVJbmRleCIsImNyZWF0ZVNpZ25hbCIsImNvbnRhaW5lclJlZiIsImdldExpbmVTY29yZSIsImxpbmVJbmRleCIsImxpbmVTY29yZXMiLCJmaW5kIiwicyIsImdldFNjb3JlU3R5bGUiLCJjb2xvciIsImNyZWF0ZUVmZmVjdCIsImN1cnJlbnRUaW1lIiwibHlyaWNzIiwibGVuZ3RoIiwidGltZSIsIlRJTUlOR19PRkZTRVQiLCJhZGp1c3RlZFRpbWUiLCJmb3VuZEluZGV4IiwibGluZSIsImVuZFRpbWUiLCJzdGFydFRpbWUiLCJkdXJhdGlvbiIsInByZXZJbmRleCIsIk1hdGgiLCJhYnMiLCJjb25zb2xlIiwibG9nIiwiZnJvbSIsInRvIiwidGltZUluU2Vjb25kcyIsImp1bXAiLCJ3YXJuIiwiZnJvbUxpbmUiLCJ0b0xpbmUiLCJpc1BsYXlpbmciLCJsaW5lRWxlbWVudHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwiY3VycmVudEVsZW1lbnQiLCJjb250YWluZXJIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJsaW5lVG9wIiwib2Zmc2V0VG9wIiwibGluZUhlaWdodCIsIm9mZnNldEhlaWdodCIsInRhcmdldFNjcm9sbFRvcCIsInNjcm9sbFRvIiwidG9wIiwiYmVoYXZpb3IiLCJfcmVmJCIsIl8kdXNlIiwiRm9yIiwiZWFjaCIsImxpbmVTY29yZSIsInNjb3JlU3R5bGUiLCJ0ZXh0IiwiXyRlZmZlY3QiLCJfcCQiLCJfdiQiLCJfdiQyIiwiX3YkMyIsImUiLCJfJHNldEF0dHJpYnV0ZSIsInQiLCJhIiwic2V0UHJvcGVydHkiLCJyZW1vdmVQcm9wZXJ0eSIsInVuZGVmaW5lZCIsIkxlYWRlcmJvYXJkUGFuZWwiLCJlbnRyaWVzIiwiZmFsbGJhY2siLCJlbnRyeSIsIl9lbCQ2IiwiX2VsJDciLCJ1c2VybmFtZSIsInRvTG9jYWxlU3RyaW5nIiwiaXNDdXJyZW50VXNlciIsIl92JDQiLCJvIiwic3BlZWRzIiwiU3BsaXRCdXR0b24iLCJjdXJyZW50U3BlZWRJbmRleCIsInNldEN1cnJlbnRTcGVlZEluZGV4IiwiY3VycmVudFNwZWVkIiwiY3ljbGVTcGVlZCIsInN0b3BQcm9wYWdhdGlvbiIsIm5leHRJbmRleCIsIm5ld1NwZWVkIiwib25TcGVlZENoYW5nZSIsIl8kYWRkRXZlbnRMaXN0ZW5lciIsIm9uU3RhcnQiLCIkJGNsaWNrIiwiX3YkNSIsIlRhYnNDb250ZXh0IiwiY3JlYXRlQ29udGV4dCIsIlRhYnMiLCJhY3RpdmVUYWIiLCJzZXRBY3RpdmVUYWIiLCJkZWZhdWx0VGFiIiwidGFicyIsImlkIiwiaGFuZGxlVGFiQ2hhbmdlIiwib25UYWJDaGFuZ2UiLCJjb250ZXh0VmFsdWUiLCJQcm92aWRlciIsIlRhYnNMaXN0IiwiVGFic1RyaWdnZXIiLCJjb250ZXh0IiwidXNlQ29udGV4dCIsImlzQWN0aXZlIiwiVGFic0NvbnRlbnQiLCJGaXJlRW1vamlBbmltYXRpb24iLCJzaG93RmlyZSIsInNldFNob3dGaXJlIiwiZmlyZVgiLCJzZXRGaXJlWCIsImxhc3RMaW5lSW5kZXgiLCJoaWRlVGltZXIiLCJyYW5kb20iLCJzZXRUaW1lb3V0Iiwib25DbGVhbnVwIiwic3R5bGVzIiwiZmlyZUNvbnRhaW5lciIsImZpcmVFbW9qaSIsIkV4dGVuc2lvbkthcmFva2VWaWV3IiwiZ2V0TGF0ZXN0SGlnaFNjb3JlTGluZSIsInNjb3JlcyIsImxhdGVzdCIsIl90bXBsJDUiLCJfdG1wbCQ2IiwiX2VsJDgiLCJsYWJlbCIsIl90bXBsJDQiLCJsZWFkZXJib2FyZCIsIkkxOG5Db250ZXh0IiwiSTE4blByb3ZpZGVyIiwibG9jYWxlIiwic2V0TG9jYWxlIiwiZGVmYXVsdExvY2FsZSIsInRyYW5zbGF0aW9ucyIsInNldFRyYW5zbGF0aW9ucyIsImN1cnJlbnRMb2NhbGUiLCJtb2R1bGUiLCJkZWZhdWx0IiwiX2UiLCJrZXkiLCJwYXJhbXMiLCJrZXlzIiwic3BsaXQiLCJrIiwicmVwbGFjZSIsIl8iLCJTdHJpbmciLCJkaXIiLCJudW1iZXJGb3JtYXR0ZXIiLCJjcmVhdGVNZW1vIiwiSW50bCIsIk51bWJlckZvcm1hdCIsImZvcm1hdE51bWJlciIsIm51bSIsImZvcm1hdCIsImZvcm1hdERhdGUiLCJkYXRlIiwib3B0aW9ucyIsIkRhdGVUaW1lRm9ybWF0IiwidXNlSTE4biIsIkVycm9yIiwiQ29tcGxldGlvblZpZXciLCJnZXRGZWVkYmFja1RleHQiLCJmZWVkYmFja1RleHQiLCJfZWwkOSIsIl9lbCQxIiwiX2VsJDEwIiwiX2VsJDExIiwiX2VsJDEyIiwiX2VsJDEzIiwic3BlZWQiLCJvblByYWN0aWNlIiwiX2VsJDE0Iiwib25DbGljayIsInNhbXBsZVJhdGUiLCJvZmZzZXQiLCJQcm9ncmVzc0JhciIsInBlcmNlbnRhZ2UiLCJtaW4iLCJtYXgiLCJjdXJyZW50IiwidG90YWwiLCJNaW5pbWl6ZWRLYXJhb2tlIiwiY3VycmVudFRhcmdldCIsInRyYW5zZm9ybSIsIlByYWN0aWNlSGVhZGVyIiwidGl0bGUiLCJFeGVyY2lzZUZvb3RlciIsImlzUmVjb3JkaW5nIiwib25TdG9wIiwiaXNQcm9jZXNzaW5nIiwiY2FuU3VibWl0Iiwib25SZWNvcmQiLCJvblN1Ym1pdCIsInAiLCJSZXNwb25zZUZvb3RlciIsIm1vZGUiLCJpc0NvcnJlY3QiLCJJY29uWENpcmNsZUZpbGwiLCJJY29uQ2hlY2tDaXJjbGVGaWxsIiwiXyRwIiwiXyRzdHlsZSIsIm9uQ29udGludWUiLCJjb250aW51ZUxhYmVsIiwib25DaGVjayIsIkV4ZXJjaXNlVGVtcGxhdGUiLCJfYyQiLCJfJG1lbW8iLCJpbnN0cnVjdGlvblRleHQiLCJSZWFkQWxvdWQiLCJwcm9tcHQiLCJ1c2VyVHJhbnNjcmlwdCIsIlByYWN0aWNlRXhlcmNpc2VWaWV3IiwiY3VycmVudEV4ZXJjaXNlSW5kZXgiLCJzZXRDdXJyZW50RXhlcmNpc2VJbmRleCIsInNldElzUmVjb3JkaW5nIiwic2V0SXNQcm9jZXNzaW5nIiwic2V0VXNlclRyYW5zY3JpcHQiLCJjdXJyZW50U2NvcmUiLCJzZXRDdXJyZW50U2NvcmUiLCJtZWRpYVJlY29yZGVyIiwic2V0TWVkaWFSZWNvcmRlciIsImF1ZGlvQ2h1bmtzIiwic2V0QXVkaW9DaHVua3MiLCJzaG93RmVlZGJhY2siLCJzZXRTaG93RmVlZGJhY2siLCJzZXRJc0NvcnJlY3QiLCJhcGlCYXNlVXJsIiwiZXhlcmNpc2VzIiwiY3JlYXRlUmVzb3VyY2UiLCJ1cmwiLCJzZXNzaW9uSWQiLCJoZWFkZXJzIiwiYXV0aFRva2VuIiwicmVzcG9uc2UiLCJmZXRjaCIsIm9rIiwiZXJyb3JUZXh0Iiwic3RhdHVzIiwiZGF0YSIsImpzb24iLCJoYW5kbGVTdGFydFJlY29yZGluZyIsInN0cmVhbSIsIm5hdmlnYXRvciIsIm1lZGlhRGV2aWNlcyIsImdldFVzZXJNZWRpYSIsImF1ZGlvIiwiZWNob0NhbmNlbGxhdGlvbiIsIm5vaXNlU3VwcHJlc3Npb24iLCJhdXRvR2FpbkNvbnRyb2wiLCJtaW1lVHlwZSIsIk1lZGlhUmVjb3JkZXIiLCJpc1R5cGVTdXBwb3J0ZWQiLCJyZWNvcmRlciIsImNodW5rcyIsIm9uZGF0YWF2YWlsYWJsZSIsImV2ZW50IiwicHVzaCIsIm9uc3RvcCIsImF1ZGlvQmxvYiIsIkJsb2IiLCJ0eXBlIiwicHJvY2Vzc1JlY29yZGluZyIsImdldFRyYWNrcyIsImZvckVhY2giLCJ0cmFjayIsInN0b3AiLCJzdGFydCIsImJsb2IiLCJyZWFkZXIiLCJGaWxlUmVhZGVyIiwiYmFzZTY0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJvbmxvYWRlbmQiLCJiYXNlNjRTdHJpbmciLCJyZWFkQXNEYXRhVVJMIiwiYXR0ZW1wdHMiLCJtYXhBdHRlbXB0cyIsIm1ldGhvZCIsImJvZHkiLCJKU09OIiwic3RyaW5naWZ5IiwiYXVkaW9CYXNlNjQiLCJleHBlY3RlZFRleHQiLCJjdXJyZW50RXhlcmNpc2UiLCJmdWxsX2xpbmUiLCJwcmVmZXJEZWVwZ3JhbSIsImZldGNoRXJyb3IiLCJ0cmFuc2NyaXB0IiwiY2FsY3VsYXRlU2NvcmUiLCJoYW5kbGVBdXRvU3VibWl0IiwiaGFuZGxlU3RvcFJlY29yZGluZyIsInN0YXRlIiwibm9ybWFsaXplVGV4dCIsInRvTG93ZXJDYXNlIiwidHJpbSIsImV4cGVjdGVkIiwiYWN0dWFsIiwibm9ybWFsaXplZEV4cGVjdGVkIiwibm9ybWFsaXplZEFjdHVhbCIsImV4cGVjdGVkV29yZHMiLCJhY3R1YWxXb3JkcyIsIm1hdGNoZXMiLCJyb3VuZCIsImNhcmRfaWRzIiwiZXhlcmNpc2VJZCIsImNhcmRTY29yZXMiLCJtYXAiLCJjYXJkSWQiLCJoYW5kbGVTdWJtaXQiLCJoYW5kbGVDb250aW51ZSIsIm9uQmFjayIsImV4ZXJjaXNlIiwiaGVhZGVyVGl0bGUiLCJvbkV4aXQiLCJrYXJhb2tlQXBpIiwiS2FyYW9rZUFwaVNlcnZpY2UiLCJQcmFjdGljZVZpZXciLCJDb250ZW50QXBwIiwiY3VycmVudFRyYWNrIiwic2V0Q3VycmVudFRyYWNrIiwic2V0QXV0aFRva2VuIiwic2hvd0thcmFva2UiLCJzZXRTaG93S2FyYW9rZSIsImthcmFva2VEYXRhIiwic2V0S2FyYW9rZURhdGEiLCJzZXRMb2FkaW5nIiwic2Vzc2lvblN0YXJ0ZWQiLCJzZXRTZXNzaW9uU3RhcnRlZCIsImlzTWluaW1pemVkIiwic2V0SXNNaW5pbWl6ZWQiLCJjb3VudGRvd24iLCJzZXRDb3VudGRvd24iLCJzZXRJc1BsYXlpbmciLCJzZXRDdXJyZW50VGltZSIsImF1ZGlvUmVmIiwic2V0QXVkaW9SZWYiLCJrYXJhb2tlU2Vzc2lvbiIsInNldEthcmFva2VTZXNzaW9uIiwiY29tcGxldGlvbkRhdGEiLCJzZXRDb21wbGV0aW9uRGF0YSIsInNob3dQcmFjdGljZSIsInNldFNob3dQcmFjdGljZSIsInNlbGVjdGVkU3BlZWQiLCJzZXRTZWxlY3RlZFNwZWVkIiwib25Nb3VudCIsInRva2VuIiwiZ2V0QXV0aFRva2VuIiwiY2xlYW51cCIsInRyYWNrRGV0ZWN0b3IiLCJ3YXRjaEZvckNoYW5nZXMiLCJmZXRjaEthcmFva2VEYXRhIiwiZ2V0S2FyYW9rZURhdGEiLCJ0cmFja0lkIiwiYXJ0aXN0IiwiaGFuZGxlU3RhcnQiLCJsaW5lcyIsInRyYWNrVGl0bGUiLCJzb25nRGF0YSIsInNvbmciLCJoYXNMeXJpY3MiLCJuZXdTZXNzaW9uIiwidXNlS2FyYW9rZVNlc3Npb24iLCJhbGJ1bSIsInNvbmdDYXRhbG9nSWQiLCJzb25nX2NhdGFsb2dfaWQiLCJhdWRpb0VsZW1lbnQiLCJhcGlVcmwiLCJvbkNvbXBsZXRlIiwicmVzdWx0cyIsInBhdXNlIiwiaGFuZGxlU3BlZWRDaGFuZ2UiLCJzdGFydFNlc3Npb24iLCJzZXRBdWRpb0VsZW1lbnQiLCJjb3VudGRvd25JbnRlcnZhbCIsInNldEludGVydmFsIiwiY2xlYXJJbnRlcnZhbCIsInN0YXJ0QXVkaW9QbGF5YmFjayIsImF1ZGlvRWxlbWVudHMiLCJzcmMiLCJwYXVzZWQiLCJzZXNzaW9uIiwiYXVkaW9Qcm9jZXNzb3IiLCJpc1JlYWR5IiwiaW5pdGlhbGl6ZSIsImNhdGNoIiwicGxheSIsInRoZW4iLCJlcnIiLCJwbGF5QnV0dG9uIiwicXVlcnlTZWxlY3RvciIsImNsaWNrIiwidXBkYXRlVGltZSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJuZXdBdWRpb0VsZW1lbnRzIiwiaGFuZGxlTWluaW1pemUiLCJoYW5kbGVSZXN0b3JlIiwiX3RtcGwkNyIsIl90bXBsJDgiLCJfZWwkMCIsInJhdGUiLCJwbGF5YmFja1JhdGUiLCJfZWwkMTUiLCJfdG1wbCQ5IiwiaXNMb2FkaW5nIiwiX3RtcGwkMCIsImRlZmluZUNvbnRlbnRTY3JpcHQiLCJydW5BdCIsImNzc0luamVjdGlvbk1vZGUiLCJtYWluIiwiY3R4Iiwid2luZG93Iiwic2VsZiIsInVpIiwiY3JlYXRlU2hhZG93Um9vdFVpIiwibmFtZSIsInBvc2l0aW9uIiwiYW5jaG9yIiwiY29udGFpbmVyIiwid3JhcHBlciIsImNyZWF0ZUVsZW1lbnQiLCJjbGFzc05hbWUiLCJhcHBlbmRDaGlsZCIsInJlbmRlciIsIm9uUmVtb3ZlIiwibW91bnQiLCJjb21tb24iLCJrYXJhb2tlIiwiZGlzcGxheSJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBZ0pBLFFBQU0sU0FBUztBQUNmLFFBQU0sVUFBVSxDQUFDLEdBQUcsTUFBTSxNQUFNO0FBQ2hDLFFBQU0sU0FBUyxPQUFPLGFBQWE7QUFDbkMsUUFBTSxpQkFBaUIsT0FBTyxVQUFVO0FBQ3hDLFFBQU0sU0FBUyxPQUFPLGFBQWE7QUFDbkMsUUFBTSxXQUFXLE9BQU8scUJBQXFCO0FBQzdDLFFBQU0sZ0JBQWdCO0FBQUEsSUFDcEIsUUFBUTtBQUFB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QztBQUFBLE1BQ0s7QUFDRCx1QkFBaUIsV0FBVyxFQUFFO0FBQzlCLFdBQUssY0FBYyxNQUFNLG9CQUFvQixXQUFXLEVBQUUsQ0FBQztBQUFBLElBQy9EO0FBQUEsRUFDQTtBQXJKRSxnQkFaVyx1QkFZSiwrQkFBOEI7QUFBQSxJQUNuQztBQUFBLEVBQ0Q7QUFkSSxNQUFNLHVCQUFOOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNEUCxRQUFNbUwsaUJBQTZCO0FBQUEsSUFBQSxRQUNqQ3NTO0FBQUFBLElBQUEsU0FDQUM7QUFBQUEsSUFDQUMsU0FBQUE7QUFBQUEsRUFDRjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNKQSxRQUFNLGVBQTZCO0FBQUEsSUFDakM7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7Ozs7Ozs7OyIsInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDEsMiwzLDQsNSw2LDcsOCw5LDEwLDExLDEyLDEzLDE0LDE1LDQ0LDQ1LDYwLDYxLDYyXX0=

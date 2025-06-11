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
  var _tmpl$$h = /* @__PURE__ */ template(`<div><div class="bg-surface rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px]"><div class="text-2xl font-mono font-bold text-purple-500"></div><div class="text-sm text-secondary mt-1">Score</div></div><div class="bg-surface rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px]"><div class="text-2xl font-mono font-bold text-pink-500"></div><div class="text-sm text-secondary mt-1">Rank`);
  const ScorePanel = (props) => {
    return (() => {
      var _el$ = _tmpl$$h(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$2.nextSibling, _el$5 = _el$4.firstChild;
      insert(_el$3, () => props.score);
      insert(_el$5, () => props.rank);
      createRenderEffect(() => className(_el$, cn("grid grid-cols-[1fr_1fr] gap-2 p-4", props.class)));
      return _el$;
    })();
  };
  content;
  content;
  var _tmpl$$g = /* @__PURE__ */ template(`<svg class="animate-spin h-4 w-4"xmlns=http://www.w3.org/2000/svg fill=none viewBox="0 0 24 24"><circle class=opacity-25 cx=12 cy=12 r=10 stroke=currentColor stroke-width=4></circle><path class=opacity-75 fill=currentColor d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">`), _tmpl$2$a = /* @__PURE__ */ template(`<span>`), _tmpl$3$4 = /* @__PURE__ */ template(`<button>`);
  const Button = (props) => {
    const [local, others] = splitProps(props, ["variant", "size", "fullWidth", "loading", "leftIcon", "rightIcon", "children", "class", "disabled"]);
    const variant = () => local.variant || "primary";
    const size = () => local.size || "md";
    return (() => {
      var _el$ = _tmpl$3$4();
      spread(_el$, mergeProps({
        get disabled() {
          return local.disabled || local.loading;
        },
        get ["class"]() {
          return cn("inline-flex items-center justify-center font-medium transition-all cursor-pointer outline-none disabled:cursor-not-allowed disabled:opacity-50", {
            // Variants
            "bg-gradient-primary text-white hover:shadow-lg hover:scale-105 glow-primary": variant() === "primary",
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
          return _tmpl$$g();
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
  var _tmpl$$f = /* @__PURE__ */ template(`<div><div class=space-y-8>`), _tmpl$2$9 = /* @__PURE__ */ template(`<div>`);
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
      var _el$ = _tmpl$$f(), _el$2 = _el$.firstChild;
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
  var _tmpl$$e = /* @__PURE__ */ template(`<div>`), _tmpl$2$8 = /* @__PURE__ */ template(`<div class="flex flex-col items-center justify-center py-12 px-6 text-center"><div class="text-6xl mb-4 opacity-30">🎤</div><p class="text-lg text-secondary mb-2">Nobody has completed this song yet!</p><p class="text-sm text-tertiary">Be the first to set a high score`), _tmpl$3$3 = /* @__PURE__ */ template(`<div><span>#</span><span></span><span>`);
  const LeaderboardPanel = (props) => {
    return (() => {
      var _el$ = _tmpl$$e();
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
              var _el$3 = _tmpl$3$3(), _el$4 = _el$3.firstChild;
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
  var _tmpl$$d = /* @__PURE__ */ template(`<div><button><span class="relative z-10">Start</span></button><div class="w-px bg-black/20"></div><button aria-label="Change playback speed"><span class="relative z-10">`);
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
      var _el$ = _tmpl$$d(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling, _el$4 = _el$3.nextSibling, _el$5 = _el$4.firstChild;
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
  var _tmpl$$c = /* @__PURE__ */ template(`<div>`), _tmpl$2$7 = /* @__PURE__ */ template(`<button>`);
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
        var _el$ = _tmpl$$c();
        insert(_el$, () => props.children);
        createRenderEffect(() => className(_el$, cn("w-full", props.class)));
        return _el$;
      }
    });
  };
  const TabsList = (props) => {
    return (() => {
      var _el$2 = _tmpl$$c();
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
        var _el$4 = _tmpl$$c();
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
  var _tmpl$$b = /* @__PURE__ */ template(`<div><div>🔥`);
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
        var _el$ = _tmpl$$b(), _el$2 = _el$.firstChild;
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
  var _tmpl$$a = /* @__PURE__ */ template(`<div class=px-4>`), _tmpl$2$6 = /* @__PURE__ */ template(`<div class="p-4 bg-surface border-t border-subtle">`), _tmpl$3$2 = /* @__PURE__ */ template(`<div class="flex flex-col h-full"><div class="flex-1 min-h-0 overflow-hidden">`), _tmpl$4$2 = /* @__PURE__ */ template(`<div class="overflow-y-auto h-full">`), _tmpl$5$1 = /* @__PURE__ */ template(`<div>`), _tmpl$6$1 = /* @__PURE__ */ template(`<div class="flex-1 flex flex-col min-h-0"><div class="flex-1 min-h-0 overflow-hidden">`);
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
                var _el$2 = _tmpl$$a();
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
                  var _el$3 = _tmpl$3$2(), _el$4 = _el$3.firstChild;
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
                  var _el$6 = _tmpl$4$2();
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
  var _tmpl$$9 = /* @__PURE__ */ template(`<div class="p-4 bg-surface border-t border-subtle">`), _tmpl$2$5 = /* @__PURE__ */ template(`<div><div class="flex-1 flex flex-col items-center justify-center p-6"><div class="text-center flex flex-col mb-10"><div class="text-lg text-secondary mb-3 order-1"></div><div class="text-7xl font-mono font-bold text-accent-primary order-2"></div></div><div class="flex gap-12 mb-12"><div class="text-center flex flex-col"><div class="text-lg text-secondary mb-2 order-1">Rank</div><div class="text-3xl font-bold text-primary order-2">#</div></div><div class="text-center flex flex-col"><div class="text-lg text-secondary mb-2 order-1"></div><div class="text-3xl font-bold text-primary order-2"></div></div></div><div class="max-w-md text-center"><p class="text-xl text-primary leading-relaxed">`);
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
          var _el$14 = _tmpl$$9();
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
        console.log("[KaraokeAudioProcessor] Initializing audio capture...");
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
        console.log("[KaraokeAudioProcessor] Audio capture initialized successfully.");
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
      console.log("[KaraokeAudioProcessor] Started listening for audio.");
    };
    const pauseListening = () => {
      const ctx = audioContext();
      if (ctx && ctx.state === "running") {
        ctx.suspend();
      }
      setIsListening(false);
      console.log("[KaraokeAudioProcessor] Paused listening for audio.");
    };
    const cleanup = () => {
      console.log("[KaraokeAudioProcessor] Cleaning up audio capture...");
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
      console.log("[KaraokeAudioProcessor] Audio capture cleaned up.");
    };
    onCleanup(cleanup);
    const startRecordingLine = (lineIndex) => {
      console.log(`[KaraokeAudioProcessor] Starting audio capture for line ${lineIndex}`);
      setCurrentRecordingLine(lineIndex);
      setRecordedAudioBuffer([]);
      if (isReady() && !isListening()) {
        startListening();
      }
    };
    const stopRecordingLineAndGetRawAudio = () => {
      const lineIndex = currentRecordingLine();
      if (lineIndex === null) {
        console.warn("[KaraokeAudioProcessor] No active recording line.");
        return [];
      }
      const audioBuffer = recordedAudioBuffer();
      console.log(`[KaraokeAudioProcessor] Stopping capture for line ${lineIndex}. Collected ${audioBuffer.length} chunks.`);
      setCurrentRecordingLine(null);
      const result2 = [...audioBuffer];
      setRecordedAudioBuffer([]);
      if (result2.length === 0) {
        console.log(`[KaraokeAudioProcessor] No audio captured for line ${lineIndex}.`);
      }
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
      console.log("[KaraokeAudioProcessor] Starting full session recording");
      setFullSessionBuffer([]);
      setIsSessionActive(true);
    };
    const stopFullSessionAndGetWav = () => {
      console.log("[KaraokeAudioProcessor] Stopping full session recording");
      setIsSessionActive(false);
      const sessionChunks = fullSessionBuffer();
      const wavBlob = convertAudioToWavBlob(sessionChunks);
      console.log(
        `[KaraokeAudioProcessor] Full session: ${sessionChunks.length} chunks, ${wavBlob ? (wavBlob.size / 1024).toFixed(1) + "KB" : "null"}`
      );
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
    async startSession(trackId, songData, authToken, songCatalogId) {
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
            songCatalogId
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
    async gradeRecording(sessionId, lineIndex, audioBuffer, expectedText, startTime, endTime, authToken) {
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
            endTime
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
  var _tmpl$$8 = /* @__PURE__ */ template(`<div><div class="h-full bg-accent transition-all duration-300 ease-out rounded-r-sm">`);
  const ProgressBar = (props) => {
    const percentage = () => Math.min(100, Math.max(0, props.current / props.total * 100));
    return (() => {
      var _el$ = _tmpl$$8(), _el$2 = _el$.firstChild;
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
  var _tmpl$$7 = /* @__PURE__ */ template(`<button aria-label="Open Karaoke"><span>🎤`);
  const MinimizedKaraoke = (props) => {
    return (() => {
      var _el$ = _tmpl$$7(), _el$2 = _el$.firstChild;
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
  var _tmpl$$6 = /* @__PURE__ */ template(`<svg data-phosphor-icon=x aria-hidden=true width=1em height=1em pointer-events=none display=inline-block xmlns=http://www.w3.org/2000/svg fill=currentColor viewBox="0 0 256 256"><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z">`);
  const IconXRegular = (p) => (() => {
    var _el$ = _tmpl$$6();
    createRenderEffect(() => setAttribute(_el$, "class", p.class));
    return _el$;
  })();
  content;
  var _tmpl$$5 = /* @__PURE__ */ template(`<h1 class="text-lg font-semibold text-primary absolute left-1/2 transform -translate-x-1/2">`), _tmpl$2$4 = /* @__PURE__ */ template(`<header><button class="p-2 -ml-2 rounded-full hover:bg-highlight transition-colors"aria-label="Exit practice"></button><div class=w-10>`);
  const PracticeHeader = (props) => {
    return (() => {
      var _el$ = _tmpl$2$4(), _el$2 = _el$.firstChild, _el$4 = _el$2.nextSibling;
      addEventListener$1(_el$2, "click", props.onExit, true);
      insert(_el$2, createComponent(IconXRegular, {
        "class": "text-secondary w-6 h-6"
      }));
      insert(_el$, createComponent(Show, {
        get when() {
          return props.title;
        },
        get children() {
          var _el$3 = _tmpl$$5();
          insert(_el$3, () => props.title);
          return _el$3;
        }
      }), _el$4);
      createRenderEffect(() => className(_el$, cn("flex items-center justify-between h-14 px-4 bg-transparent", props.class)));
      return _el$;
    })();
  };
  delegateEvents(["click"]);
  content;
  content;
  var _tmpl$$4 = /* @__PURE__ */ template(`<footer><div class=p-4>`);
  const ExerciseFooter = (props) => {
    return (() => {
      var _el$ = _tmpl$$4(), _el$2 = _el$.firstChild;
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
      createRenderEffect(() => className(_el$, cn("fixed bottom-0 left-0 right-0 bg-base border-t border-secondary/20", props.class)));
      return _el$;
    })();
  };
  content;
  content;
  content;
  content;
  content;
  content;
  var _tmpl$$3 = /* @__PURE__ */ template(`<div><div class="flex-grow overflow-y-auto flex flex-col pb-24"><div class="w-full max-w-2xl mx-auto px-4 pt-6">`), _tmpl$2$3 = /* @__PURE__ */ template(`<p class="text-lg font-semibold mb-4 text-left">`);
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
  var _tmpl$$2 = /* @__PURE__ */ template(`<div class="mt-6 pt-6 border-t border-border"><p class="text-sm text-muted-foreground mb-2">You said:</p><p class="text-lg text-foreground">`), _tmpl$2$2 = /* @__PURE__ */ template(`<div><p class="text-2xl text-left leading-relaxed">`);
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
    let audioUpdateInterval = null;
    let recordingTimeout = null;
    const audioProcessor = createKaraokeAudioProcessor({
      sampleRate: 16e3
    });
    const karaokeApi2 = new KaraokeApiService$1(options.apiUrl);
    const startSession = async () => {
      try {
        await audioProcessor.initialize();
        console.log("[KaraokeSession] Audio processor initialized");
      } catch (error) {
        console.error("[KaraokeSession] Failed to initialize audio:", error);
      }
      console.log("[KaraokeSession] Session creation check:", {
        hasTrackId: !!options.trackId,
        hasSongData: !!options.songData,
        trackId: options.trackId,
        songData: options.songData,
        apiUrl: options.apiUrl
      });
      if (options.trackId && options.songData) {
        try {
          console.log("[KaraokeSession] Creating session on server...");
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
            options.songCatalogId
          );
          if (session) {
            setSessionId(session.id);
            console.log("[KaraokeSession] Session created:", session.id);
          } else {
            console.error("[KaraokeSession] Failed to create session");
          }
        } catch (error) {
          console.error("[KaraokeSession] Failed to create session:", error);
        }
      } else {
        console.log("[KaraokeSession] Skipping session creation - missing trackId or songData");
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
        console.log("[KaraokeSession] Starting playback with audio element");
        audio.play().catch(console.error);
        const updateTime = () => {
          const time = audio.currentTime * 1e3;
          setCurrentTime(time);
          checkForUpcomingLines(time);
        };
        audioUpdateInterval = setInterval(updateTime, 100);
        audio.addEventListener("ended", handleEnd);
      } else {
        console.log("[KaraokeSession] No audio element available for playback");
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
            console.log(`[KaraokeSession] Time to start recording chunk ${chunk.startIndex}-${chunk.endIndex}: ${currentTimeMs}ms is between ${recordingStartTime}ms and ${lineStartTime + 500}ms`);
            setRecordedChunks((prev) => new Set(prev).add(chunk.startIndex));
            startRecordingChunk(chunk);
            break;
          }
        }
        i = chunk.endIndex;
      }
    };
    const startRecordingChunk = async (chunk) => {
      console.log(`[KaraokeSession] Starting recording for chunk ${chunk.startIndex}-${chunk.endIndex}`);
      if (chunk.startIndex >= 5) {
        console.log("[KaraokeSession] TEST MODE: Stopping after 5 lines");
        handleEnd();
        return;
      }
      setCurrentChunk(chunk);
      setIsRecording(true);
      audioProcessor.startRecordingLine(chunk.startIndex);
      const duration = calculateRecordingDuration(options.lyrics, chunk);
      console.log(`[KaraokeSession] Recording duration for chunk ${chunk.startIndex}-${chunk.endIndex}: ${duration}ms`);
      recordingTimeout = setTimeout(() => {
        stopRecordingChunk();
      }, duration);
    };
    const stopRecordingChunk = async () => {
      const chunk = currentChunk();
      if (!chunk) return;
      console.log(`[KaraokeSession] Stopping recording for chunk ${chunk.startIndex}-${chunk.endIndex}`);
      setIsRecording(false);
      const audioChunks = audioProcessor.stopRecordingLineAndGetRawAudio();
      const wavBlob = audioProcessor.convertAudioToWavBlob(audioChunks);
      console.log(`[KaraokeSession] Audio blob created:`, {
        hasBlob: !!wavBlob,
        blobSize: wavBlob == null ? void 0 : wavBlob.size,
        chunksLength: audioChunks.length,
        hasSessionId: !!sessionId(),
        sessionId: sessionId()
      });
      if (wavBlob && wavBlob.size > 1e3 && sessionId()) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          var _a2;
          const base64Audio = (_a2 = reader.result) == null ? void 0 : _a2.toString().split(",")[1];
          if (base64Audio && base64Audio.length > 100) {
            await gradeChunk(chunk, base64Audio);
          } else {
            console.warn("[KaraokeSession] Base64 audio too short, skipping grade");
          }
        };
        reader.readAsDataURL(wavBlob);
      } else if (wavBlob && wavBlob.size <= 1e3) {
        console.warn("[KaraokeSession] Audio blob too small, skipping grade:", wavBlob.size, "bytes");
        setLineScores((prev) => [...prev, {
          lineIndex: chunk.startIndex,
          score: 50,
          transcription: "",
          feedback: "Recording too short"
        }]);
      } else if (wavBlob && !sessionId()) {
        console.warn("[KaraokeSession] Have audio but no session ID - cannot grade");
      }
      setCurrentChunk(null);
      if (recordingTimeout) {
        clearTimeout(recordingTimeout);
        recordingTimeout = null;
      }
    };
    const gradeChunk = async (chunk, audioBase64) => {
      var _a2, _b2, _c;
      const currentSessionId = sessionId();
      console.log("[KaraokeSession] Grading chunk:", {
        hasSessionId: !!currentSessionId,
        sessionId: currentSessionId,
        chunkIndex: chunk.startIndex,
        audioLength: audioBase64.length
      });
      if (!currentSessionId) {
        console.warn("[KaraokeSession] No session ID, skipping grade");
        return;
      }
      try {
        console.log("[KaraokeSession] Sending grade request...");
        const lineScore = await karaokeApi2.gradeRecording(
          currentSessionId,
          chunk.startIndex,
          audioBase64,
          chunk.expectedText,
          ((_a2 = options.lyrics[chunk.startIndex]) == null ? void 0 : _a2.startTime) || 0,
          (((_b2 = options.lyrics[chunk.endIndex]) == null ? void 0 : _b2.startTime) || 0) + (((_c = options.lyrics[chunk.endIndex]) == null ? void 0 : _c.duration) || 0) / 1e3
        );
        if (lineScore) {
          console.log(`[KaraokeSession] Chunk graded:`, lineScore);
          const newLineScore = {
            lineIndex: chunk.startIndex,
            score: lineScore.score,
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
          console.warn(`[KaraokeSession] Failed to grade chunk`);
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
      console.log("[KaraokeSession] Handling session end");
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
      console.log("[KaraokeSession] Full session audio blob:", {
        hasBlob: !!fullAudioBlob,
        blobSize: fullAudioBlob == null ? void 0 : fullAudioBlob.size
      });
      const currentSessionId = sessionId();
      if (currentSessionId && fullAudioBlob && fullAudioBlob.size > 1e3) {
        try {
          console.log("[KaraokeSession] Converting full audio to base64...");
          const reader = new FileReader();
          reader.onloadend = async () => {
            var _a3, _b2;
            const base64Audio = (_a3 = reader.result) == null ? void 0 : _a3.toString().split(",")[1];
            console.log("[KaraokeSession] Sending completion request with full audio");
            const sessionResults = await karaokeApi2.completeSession(
              currentSessionId,
              base64Audio
            );
            if (sessionResults) {
              console.log("[KaraokeSession] Session completed:", sessionResults);
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
              console.log("[KaraokeSession] No session results, calculating locally");
              calculateLocalResults();
            }
          };
          reader.readAsDataURL(fullAudioBlob);
        } catch (error) {
          console.error("[KaraokeSession] Failed to complete session:", error);
          calculateLocalResults();
        }
      } else {
        console.log("[KaraokeSession] No session/audio, returning local results");
        calculateLocalResults();
      }
    };
    const calculateLocalResults = () => {
      var _a2;
      console.log("[KaraokeSession] Calculating local results");
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
      console.log("[KaraokeSession] Local results calculated:", results);
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
      // Actions
      startSession,
      stopSession,
      // Audio processor (for direct access if needed)
      audioProcessor,
      // Method to update audio element after initialization
      setAudioElement
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
  var _tmpl$$1 = /* @__PURE__ */ template(`<div class="h-full bg-base flex flex-col">`), _tmpl$2$1 = /* @__PURE__ */ template(`<div class="flex-1 flex items-center justify-center"><div class=text-center><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div><p class=text-muted-foreground>Loading exercises...`), _tmpl$3$1 = /* @__PURE__ */ template(`<div class="flex-1 flex items-center justify-center p-8"><div class="text-center max-w-md"><p class="text-lg text-muted-foreground mb-4">No practice exercises available yet.</p><p class="text-sm text-muted-foreground">Complete karaoke sessions with errors to generate personalized exercises!`), _tmpl$4$1 = /* @__PURE__ */ template(`<main class=flex-1>`);
  const PracticeView = (props) => {
    const [currentExerciseIndex, setCurrentExerciseIndex] = createSignal(0);
    const [isRecording, setIsRecording] = createSignal(false);
    const [isProcessing, setIsProcessing] = createSignal(false);
    const [userTranscript, setUserTranscript] = createSignal("");
    const [currentScore, setCurrentScore] = createSignal(null);
    const [mediaRecorder, setMediaRecorder] = createSignal(null);
    const [audioChunks, setAudioChunks] = createSignal([]);
    const [exercises] = createResource(async () => {
      try {
        console.log("[PracticeView] Fetching exercises...");
        const url = props.sessionId ? `http://localhost:8787/api/practice/exercises?limit=10&sessionId=${props.sessionId}` : "http://localhost:8787/api/practice/exercises?limit=10";
        const response = await fetch(url);
        if (!response.ok) {
          const errorText = await response.text();
          console.error("[PracticeView] API error:", response.status, errorText);
          throw new Error("Failed to fetch exercises");
        }
        const data = await response.json();
        console.log("[PracticeView] Fetched exercises:", data);
        if (data.data && data.data.exercises) {
          return data.data.exercises;
        }
        return [];
      } catch (error) {
        console.error("[PracticeView] Failed to fetch:", error);
        return [];
      }
    });
    createEffect(() => {
      const exerciseList = exercises();
      if (exerciseList && exerciseList.length > 0) {
        console.log("[PracticeView] Exercises loaded, count:", exerciseList.length);
      }
    });
    const handleStartRecording = async () => {
      console.log("[PracticeView] Starting recording...");
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
        console.error("[PracticeView] Failed to start recording:", error);
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
        const response = await fetch("http://localhost:8787/api/speech-to-text/transcribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            audioBase64: base64,
            expectedText: (_a2 = currentExercise()) == null ? void 0 : _a2.full_line
          })
        });
        if (response.ok) {
          const result2 = await response.json();
          setUserTranscript(result2.data.transcript);
          const score = calculateScore(((_b2 = currentExercise()) == null ? void 0 : _b2.full_line) || "", result2.data.transcript);
          setCurrentScore(score);
        }
      } catch (error) {
        console.error("[PracticeView] Failed to process recording:", error);
      } finally {
        setIsProcessing(false);
      }
    };
    const handleStopRecording = () => {
      console.log("[PracticeView] Stopping recording...");
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
    const handleSubmit = async () => {
      var _a2, _b2;
      const currentExercise2 = (_a2 = exercises()) == null ? void 0 : _a2[currentExerciseIndex()];
      const score = currentScore();
      const chunks = audioChunks();
      const blob = chunks.length > 0 ? new Blob(chunks, {
        type: "audio/webm"
      }) : null;
      if (currentExercise2 && currentExercise2.card_ids.length > 0 && blob && score !== null) {
        try {
          const reader = new FileReader();
          const base64 = await new Promise((resolve) => {
            reader.onloadend = () => {
              const base64String = reader.result;
              resolve(base64String.split(",")[1]);
            };
            reader.readAsDataURL(blob);
          });
          const response = await fetch("http://localhost:8787/api/practice/review", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
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
            console.log("[PracticeView] Review submitted successfully");
          }
        } catch (error) {
          console.error("[PracticeView] Failed to submit review:", error);
        }
      }
      if (currentExerciseIndex() < (((_b2 = exercises()) == null ? void 0 : _b2.length) || 0) - 1) {
        setCurrentExerciseIndex(currentExerciseIndex() + 1);
        setUserTranscript("");
        setCurrentScore(null);
        setAudioChunks([]);
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
                  title: "Practice",
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
                })(), createComponent(ExerciseFooter, {
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
                  onSubmit: handleSubmit,
                  "class": "!relative !bottom-auto !left-auto !right-auto"
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
                      onSpeedChange: (speed2) => console.log("[ContentApp] Speed changed:", speed2),
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
                          speed: "1x",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL2Rpc3QvZGV2LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL3dlYi9kaXN0L2Rldi5qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWUvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnQvbGliL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbnkta2V5cy1tYXAvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvZGVmdS9kaXN0L2RlZnUubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0AxbmF0c3Uvd2FpdC1lbGVtZW50L2Rpc3QvZGV0ZWN0b3JzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AMW5hdHN1L3dhaXQtZWxlbWVudC9kaXN0L2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYXJlZC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9jbHN4L2Rpc3QvY2xzeC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvY24udHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9sYXlvdXQvSGVhZGVyL0hlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9kaXNwbGF5L1Njb3JlUGFuZWwvU2NvcmVQYW5lbC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vQnV0dG9uL0J1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9vbmJvYXJkaW5nL09uYm9hcmRpbmdGbG93L09uYm9hcmRpbmdGbG93LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheS9MeXJpY3NEaXNwbGF5LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvS2FyYW9rZUhlYWRlci9LYXJhb2tlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbC9MZWFkZXJib2FyZFBhbmVsLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9TcGxpdEJ1dHRvbi9TcGxpdEJ1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vVGFicy9UYWJzLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2VmZmVjdHMvRmlyZUVtb2ppQW5pbWF0aW9uL0ZpcmVFbW9qaUFuaW1hdGlvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9rYXJhb2tlL0V4dGVuc2lvbkthcmFva2VWaWV3L0V4dGVuc2lvbkthcmFva2VWaWV3LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9pMThuL3Byb3ZpZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvQ29tcGxldGlvblZpZXcvQ29tcGxldGlvblZpZXcudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL3NlcnZpY2VzL2F1ZGlvL2thcmFva2VBdWRpb1Byb2Nlc3Nvci50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9zZXJ2aWNlcy9rYXJhb2tlL2thcmFva2VBcGkudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvc2VydmljZXMva2FyYW9rZS9jaHVua2luZ1V0aWxzLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvY29tbW9uL1Byb2dyZXNzQmFyL1Byb2dyZXNzQmFyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL01pbmltaXplZEthcmFva2UudHN4IiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3Bob3NwaG9yLWljb25zLXNvbGlkL2Rpc3QvSWNvblhSZWd1bGFyLmpzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3ByYWN0aWNlL1ByYWN0aWNlSGVhZGVyL1ByYWN0aWNlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3ByYWN0aWNlL0V4ZXJjaXNlRm9vdGVyL0V4ZXJjaXNlRm9vdGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3ByYWN0aWNlL0V4ZXJjaXNlVGVtcGxhdGUvRXhlcmNpc2VUZW1wbGF0ZS50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9SZWFkQWxvdWQvUmVhZEFsb3VkLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2ZhcmNhc3Rlci9GYXJjYXN0ZXJNaW5pQXBwL0ZhcmNhc3Rlck1pbmlBcHAudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcGFnZXMvSG9tZVBhZ2UvSG9tZVBhZ2UudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2hvb2tzL3VzZUthcmFva2VTZXNzaW9uLnRzIiwiLi4vLi4vLi4vc3JjL3NlcnZpY2VzL3RyYWNrLWRldGVjdG9yLnRzIiwiLi4vLi4vLi4vc3JjL3V0aWxzL3N0b3JhZ2UudHMiLCIuLi8uLi8uLi9zcmMvc2VydmljZXMva2FyYW9rZS1hcGkudHMiLCIuLi8uLi8uLi9zcmMvYXBwcy9jb250ZW50L1ByYWN0aWNlVmlldy50c3giLCIuLi8uLi8uLi9zcmMvYXBwcy9jb250ZW50L0NvbnRlbnRBcHAudHN4IiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC50c3giLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvaTE4bi9sb2NhbGVzL2VuL2luZGV4LnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2kxOG4vbG9jYWxlcy96aC1DTi9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgdGFza0lkQ291bnRlciA9IDEsXG4gIGlzQ2FsbGJhY2tTY2hlZHVsZWQgPSBmYWxzZSxcbiAgaXNQZXJmb3JtaW5nV29yayA9IGZhbHNlLFxuICB0YXNrUXVldWUgPSBbXSxcbiAgY3VycmVudFRhc2sgPSBudWxsLFxuICBzaG91bGRZaWVsZFRvSG9zdCA9IG51bGwsXG4gIHlpZWxkSW50ZXJ2YWwgPSA1LFxuICBkZWFkbGluZSA9IDAsXG4gIG1heFlpZWxkSW50ZXJ2YWwgPSAzMDAsXG4gIHNjaGVkdWxlQ2FsbGJhY2sgPSBudWxsLFxuICBzY2hlZHVsZWRDYWxsYmFjayA9IG51bGw7XG5jb25zdCBtYXhTaWduZWQzMUJpdEludCA9IDEwNzM3NDE4MjM7XG5mdW5jdGlvbiBzZXR1cFNjaGVkdWxlcigpIHtcbiAgY29uc3QgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpLFxuICAgIHBvcnQgPSBjaGFubmVsLnBvcnQyO1xuICBzY2hlZHVsZUNhbGxiYWNrID0gKCkgPT4gcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSAoKSA9PiB7XG4gICAgaWYgKHNjaGVkdWxlZENhbGxiYWNrICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBjdXJyZW50VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgZGVhZGxpbmUgPSBjdXJyZW50VGltZSArIHlpZWxkSW50ZXJ2YWw7XG4gICAgICBjb25zdCBoYXNUaW1lUmVtYWluaW5nID0gdHJ1ZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGhhc01vcmVXb3JrID0gc2NoZWR1bGVkQ2FsbGJhY2soaGFzVGltZVJlbWFpbmluZywgY3VycmVudFRpbWUpO1xuICAgICAgICBpZiAoIWhhc01vcmVXb3JrKSB7XG4gICAgICAgICAgc2NoZWR1bGVkQ2FsbGJhY2sgPSBudWxsO1xuICAgICAgICB9IGVsc2UgcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHBvcnQucG9zdE1lc3NhZ2UobnVsbCk7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgaWYgKG5hdmlnYXRvciAmJiBuYXZpZ2F0b3Iuc2NoZWR1bGluZyAmJiBuYXZpZ2F0b3Iuc2NoZWR1bGluZy5pc0lucHV0UGVuZGluZykge1xuICAgIGNvbnN0IHNjaGVkdWxpbmcgPSBuYXZpZ2F0b3Iuc2NoZWR1bGluZztcbiAgICBzaG91bGRZaWVsZFRvSG9zdCA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBpZiAoY3VycmVudFRpbWUgPj0gZGVhZGxpbmUpIHtcbiAgICAgICAgaWYgKHNjaGVkdWxpbmcuaXNJbnB1dFBlbmRpbmcoKSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjdXJyZW50VGltZSA+PSBtYXhZaWVsZEludGVydmFsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgc2hvdWxkWWllbGRUb0hvc3QgPSAoKSA9PiBwZXJmb3JtYW5jZS5ub3coKSA+PSBkZWFkbGluZTtcbiAgfVxufVxuZnVuY3Rpb24gZW5xdWV1ZSh0YXNrUXVldWUsIHRhc2spIHtcbiAgZnVuY3Rpb24gZmluZEluZGV4KCkge1xuICAgIGxldCBtID0gMDtcbiAgICBsZXQgbiA9IHRhc2tRdWV1ZS5sZW5ndGggLSAxO1xuICAgIHdoaWxlIChtIDw9IG4pIHtcbiAgICAgIGNvbnN0IGsgPSBuICsgbSA+PiAxO1xuICAgICAgY29uc3QgY21wID0gdGFzay5leHBpcmF0aW9uVGltZSAtIHRhc2tRdWV1ZVtrXS5leHBpcmF0aW9uVGltZTtcbiAgICAgIGlmIChjbXAgPiAwKSBtID0gayArIDE7ZWxzZSBpZiAoY21wIDwgMCkgbiA9IGsgLSAxO2Vsc2UgcmV0dXJuIGs7XG4gICAgfVxuICAgIHJldHVybiBtO1xuICB9XG4gIHRhc2tRdWV1ZS5zcGxpY2UoZmluZEluZGV4KCksIDAsIHRhc2spO1xufVxuZnVuY3Rpb24gcmVxdWVzdENhbGxiYWNrKGZuLCBvcHRpb25zKSB7XG4gIGlmICghc2NoZWR1bGVDYWxsYmFjaykgc2V0dXBTY2hlZHVsZXIoKTtcbiAgbGV0IHN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpLFxuICAgIHRpbWVvdXQgPSBtYXhTaWduZWQzMUJpdEludDtcbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy50aW1lb3V0KSB0aW1lb3V0ID0gb3B0aW9ucy50aW1lb3V0O1xuICBjb25zdCBuZXdUYXNrID0ge1xuICAgIGlkOiB0YXNrSWRDb3VudGVyKyssXG4gICAgZm4sXG4gICAgc3RhcnRUaW1lLFxuICAgIGV4cGlyYXRpb25UaW1lOiBzdGFydFRpbWUgKyB0aW1lb3V0XG4gIH07XG4gIGVucXVldWUodGFza1F1ZXVlLCBuZXdUYXNrKTtcbiAgaWYgKCFpc0NhbGxiYWNrU2NoZWR1bGVkICYmICFpc1BlcmZvcm1pbmdXb3JrKSB7XG4gICAgaXNDYWxsYmFja1NjaGVkdWxlZCA9IHRydWU7XG4gICAgc2NoZWR1bGVkQ2FsbGJhY2sgPSBmbHVzaFdvcms7XG4gICAgc2NoZWR1bGVDYWxsYmFjaygpO1xuICB9XG4gIHJldHVybiBuZXdUYXNrO1xufVxuZnVuY3Rpb24gY2FuY2VsQ2FsbGJhY2sodGFzaykge1xuICB0YXNrLmZuID0gbnVsbDtcbn1cbmZ1bmN0aW9uIGZsdXNoV29yayhoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSkge1xuICBpc0NhbGxiYWNrU2NoZWR1bGVkID0gZmFsc2U7XG4gIGlzUGVyZm9ybWluZ1dvcmsgPSB0cnVlO1xuICB0cnkge1xuICAgIHJldHVybiB3b3JrTG9vcChoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSk7XG4gIH0gZmluYWxseSB7XG4gICAgY3VycmVudFRhc2sgPSBudWxsO1xuICAgIGlzUGVyZm9ybWluZ1dvcmsgPSBmYWxzZTtcbiAgfVxufVxuZnVuY3Rpb24gd29ya0xvb3AoaGFzVGltZVJlbWFpbmluZywgaW5pdGlhbFRpbWUpIHtcbiAgbGV0IGN1cnJlbnRUaW1lID0gaW5pdGlhbFRpbWU7XG4gIGN1cnJlbnRUYXNrID0gdGFza1F1ZXVlWzBdIHx8IG51bGw7XG4gIHdoaWxlIChjdXJyZW50VGFzayAhPT0gbnVsbCkge1xuICAgIGlmIChjdXJyZW50VGFzay5leHBpcmF0aW9uVGltZSA+IGN1cnJlbnRUaW1lICYmICghaGFzVGltZVJlbWFpbmluZyB8fCBzaG91bGRZaWVsZFRvSG9zdCgpKSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNvbnN0IGNhbGxiYWNrID0gY3VycmVudFRhc2suZm47XG4gICAgaWYgKGNhbGxiYWNrICE9PSBudWxsKSB7XG4gICAgICBjdXJyZW50VGFzay5mbiA9IG51bGw7XG4gICAgICBjb25zdCBkaWRVc2VyQ2FsbGJhY2tUaW1lb3V0ID0gY3VycmVudFRhc2suZXhwaXJhdGlvblRpbWUgPD0gY3VycmVudFRpbWU7XG4gICAgICBjYWxsYmFjayhkaWRVc2VyQ2FsbGJhY2tUaW1lb3V0KTtcbiAgICAgIGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBpZiAoY3VycmVudFRhc2sgPT09IHRhc2tRdWV1ZVswXSkge1xuICAgICAgICB0YXNrUXVldWUuc2hpZnQoKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgdGFza1F1ZXVlLnNoaWZ0KCk7XG4gICAgY3VycmVudFRhc2sgPSB0YXNrUXVldWVbMF0gfHwgbnVsbDtcbiAgfVxuICByZXR1cm4gY3VycmVudFRhc2sgIT09IG51bGw7XG59XG5cbmNvbnN0IHNoYXJlZENvbmZpZyA9IHtcbiAgY29udGV4dDogdW5kZWZpbmVkLFxuICByZWdpc3RyeTogdW5kZWZpbmVkLFxuICBlZmZlY3RzOiB1bmRlZmluZWQsXG4gIGRvbmU6IGZhbHNlLFxuICBnZXRDb250ZXh0SWQoKSB7XG4gICAgcmV0dXJuIGdldENvbnRleHRJZCh0aGlzLmNvbnRleHQuY291bnQpO1xuICB9LFxuICBnZXROZXh0Q29udGV4dElkKCkge1xuICAgIHJldHVybiBnZXRDb250ZXh0SWQodGhpcy5jb250ZXh0LmNvdW50KyspO1xuICB9XG59O1xuZnVuY3Rpb24gZ2V0Q29udGV4dElkKGNvdW50KSB7XG4gIGNvbnN0IG51bSA9IFN0cmluZyhjb3VudCksXG4gICAgbGVuID0gbnVtLmxlbmd0aCAtIDE7XG4gIHJldHVybiBzaGFyZWRDb25maWcuY29udGV4dC5pZCArIChsZW4gPyBTdHJpbmcuZnJvbUNoYXJDb2RlKDk2ICsgbGVuKSA6IFwiXCIpICsgbnVtO1xufVxuZnVuY3Rpb24gc2V0SHlkcmF0ZUNvbnRleHQoY29udGV4dCkge1xuICBzaGFyZWRDb25maWcuY29udGV4dCA9IGNvbnRleHQ7XG59XG5mdW5jdGlvbiBuZXh0SHlkcmF0ZUNvbnRleHQoKSB7XG4gIHJldHVybiB7XG4gICAgLi4uc2hhcmVkQ29uZmlnLmNvbnRleHQsXG4gICAgaWQ6IHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCksXG4gICAgY291bnQ6IDBcbiAgfTtcbn1cblxuY29uc3QgSVNfREVWID0gdHJ1ZTtcbmNvbnN0IGVxdWFsRm4gPSAoYSwgYikgPT4gYSA9PT0gYjtcbmNvbnN0ICRQUk9YWSA9IFN5bWJvbChcInNvbGlkLXByb3h5XCIpO1xuY29uc3QgU1VQUE9SVFNfUFJPWFkgPSB0eXBlb2YgUHJveHkgPT09IFwiZnVuY3Rpb25cIjtcbmNvbnN0ICRUUkFDSyA9IFN5bWJvbChcInNvbGlkLXRyYWNrXCIpO1xuY29uc3QgJERFVkNPTVAgPSBTeW1ib2woXCJzb2xpZC1kZXYtY29tcG9uZW50XCIpO1xuY29uc3Qgc2lnbmFsT3B0aW9ucyA9IHtcbiAgZXF1YWxzOiBlcXVhbEZuXG59O1xubGV0IEVSUk9SID0gbnVsbDtcbmxldCBydW5FZmZlY3RzID0gcnVuUXVldWU7XG5jb25zdCBTVEFMRSA9IDE7XG5jb25zdCBQRU5ESU5HID0gMjtcbmNvbnN0IFVOT1dORUQgPSB7XG4gIG93bmVkOiBudWxsLFxuICBjbGVhbnVwczogbnVsbCxcbiAgY29udGV4dDogbnVsbCxcbiAgb3duZXI6IG51bGxcbn07XG5jb25zdCBOT19JTklUID0ge307XG52YXIgT3duZXIgPSBudWxsO1xubGV0IFRyYW5zaXRpb24gPSBudWxsO1xubGV0IFNjaGVkdWxlciA9IG51bGw7XG5sZXQgRXh0ZXJuYWxTb3VyY2VDb25maWcgPSBudWxsO1xubGV0IExpc3RlbmVyID0gbnVsbDtcbmxldCBVcGRhdGVzID0gbnVsbDtcbmxldCBFZmZlY3RzID0gbnVsbDtcbmxldCBFeGVjQ291bnQgPSAwO1xuY29uc3QgRGV2SG9va3MgPSB7XG4gIGFmdGVyVXBkYXRlOiBudWxsLFxuICBhZnRlckNyZWF0ZU93bmVyOiBudWxsLFxuICBhZnRlckNyZWF0ZVNpZ25hbDogbnVsbCxcbiAgYWZ0ZXJSZWdpc3RlckdyYXBoOiBudWxsXG59O1xuZnVuY3Rpb24gY3JlYXRlUm9vdChmbiwgZGV0YWNoZWRPd25lcikge1xuICBjb25zdCBsaXN0ZW5lciA9IExpc3RlbmVyLFxuICAgIG93bmVyID0gT3duZXIsXG4gICAgdW5vd25lZCA9IGZuLmxlbmd0aCA9PT0gMCxcbiAgICBjdXJyZW50ID0gZGV0YWNoZWRPd25lciA9PT0gdW5kZWZpbmVkID8gb3duZXIgOiBkZXRhY2hlZE93bmVyLFxuICAgIHJvb3QgPSB1bm93bmVkID8ge1xuICAgICAgb3duZWQ6IG51bGwsXG4gICAgICBjbGVhbnVwczogbnVsbCxcbiAgICAgIGNvbnRleHQ6IG51bGwsXG4gICAgICBvd25lcjogbnVsbFxuICAgIH0gIDoge1xuICAgICAgb3duZWQ6IG51bGwsXG4gICAgICBjbGVhbnVwczogbnVsbCxcbiAgICAgIGNvbnRleHQ6IGN1cnJlbnQgPyBjdXJyZW50LmNvbnRleHQgOiBudWxsLFxuICAgICAgb3duZXI6IGN1cnJlbnRcbiAgICB9LFxuICAgIHVwZGF0ZUZuID0gdW5vd25lZCA/ICgpID0+IGZuKCgpID0+IHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkRpc3Bvc2UgbWV0aG9kIG11c3QgYmUgYW4gZXhwbGljaXQgYXJndW1lbnQgdG8gY3JlYXRlUm9vdCBmdW5jdGlvblwiKTtcbiAgICB9KSAgOiAoKSA9PiBmbigoKSA9PiB1bnRyYWNrKCgpID0+IGNsZWFuTm9kZShyb290KSkpO1xuICBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyICYmIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIocm9vdCk7XG4gIE93bmVyID0gcm9vdDtcbiAgTGlzdGVuZXIgPSBudWxsO1xuICB0cnkge1xuICAgIHJldHVybiBydW5VcGRhdGVzKHVwZGF0ZUZuLCB0cnVlKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICAgIE93bmVyID0gb3duZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIGNyZWF0ZVNpZ25hbCh2YWx1ZSwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyA/IE9iamVjdC5hc3NpZ24oe30sIHNpZ25hbE9wdGlvbnMsIG9wdGlvbnMpIDogc2lnbmFsT3B0aW9ucztcbiAgY29uc3QgcyA9IHtcbiAgICB2YWx1ZSxcbiAgICBvYnNlcnZlcnM6IG51bGwsXG4gICAgb2JzZXJ2ZXJTbG90czogbnVsbCxcbiAgICBjb21wYXJhdG9yOiBvcHRpb25zLmVxdWFscyB8fCB1bmRlZmluZWRcbiAgfTtcbiAge1xuICAgIGlmIChvcHRpb25zLm5hbWUpIHMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICBpZiAob3B0aW9ucy5pbnRlcm5hbCkge1xuICAgICAgcy5pbnRlcm5hbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZ2lzdGVyR3JhcGgocyk7XG4gICAgICBpZiAoRGV2SG9va3MuYWZ0ZXJDcmVhdGVTaWduYWwpIERldkhvb2tzLmFmdGVyQ3JlYXRlU2lnbmFsKHMpO1xuICAgIH1cbiAgfVxuICBjb25zdCBzZXR0ZXIgPSB2YWx1ZSA9PiB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhzKSkgdmFsdWUgPSB2YWx1ZShzLnRWYWx1ZSk7ZWxzZSB2YWx1ZSA9IHZhbHVlKHMudmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gd3JpdGVTaWduYWwocywgdmFsdWUpO1xuICB9O1xuICByZXR1cm4gW3JlYWRTaWduYWwuYmluZChzKSwgc2V0dGVyXTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbXB1dGVkKGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCB0cnVlLCBTVEFMRSwgb3B0aW9ucyApO1xuICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBVcGRhdGVzLnB1c2goYyk7ZWxzZSB1cGRhdGVDb21wdXRhdGlvbihjKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlbmRlckVmZmVjdChmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgZmFsc2UsIFNUQUxFLCBvcHRpb25zICk7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIFVwZGF0ZXMucHVzaChjKTtlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlRWZmZWN0KGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBydW5FZmZlY3RzID0gcnVuVXNlckVmZmVjdHM7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIGZhbHNlLCBTVEFMRSwgb3B0aW9ucyApLFxuICAgIHMgPSBTdXNwZW5zZUNvbnRleHQgJiYgdXNlQ29udGV4dChTdXNwZW5zZUNvbnRleHQpO1xuICBpZiAocykgYy5zdXNwZW5zZSA9IHM7XG4gIGlmICghb3B0aW9ucyB8fCAhb3B0aW9ucy5yZW5kZXIpIGMudXNlciA9IHRydWU7XG4gIEVmZmVjdHMgPyBFZmZlY3RzLnB1c2goYykgOiB1cGRhdGVDb21wdXRhdGlvbihjKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlYWN0aW9uKG9uSW52YWxpZGF0ZSwgb3B0aW9ucykge1xuICBsZXQgZm47XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB7XG4gICAgICBmbiA/IGZuKCkgOiB1bnRyYWNrKG9uSW52YWxpZGF0ZSk7XG4gICAgICBmbiA9IHVuZGVmaW5lZDtcbiAgICB9LCB1bmRlZmluZWQsIGZhbHNlLCAwLCBvcHRpb25zICksXG4gICAgcyA9IFN1c3BlbnNlQ29udGV4dCAmJiB1c2VDb250ZXh0KFN1c3BlbnNlQ29udGV4dCk7XG4gIGlmIChzKSBjLnN1c3BlbnNlID0gcztcbiAgYy51c2VyID0gdHJ1ZTtcbiAgcmV0dXJuIHRyYWNraW5nID0+IHtcbiAgICBmbiA9IHRyYWNraW5nO1xuICAgIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICB9O1xufVxuZnVuY3Rpb24gY3JlYXRlTWVtbyhmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgPyBPYmplY3QuYXNzaWduKHt9LCBzaWduYWxPcHRpb25zLCBvcHRpb25zKSA6IHNpZ25hbE9wdGlvbnM7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIHRydWUsIDAsIG9wdGlvbnMgKTtcbiAgYy5vYnNlcnZlcnMgPSBudWxsO1xuICBjLm9ic2VydmVyU2xvdHMgPSBudWxsO1xuICBjLmNvbXBhcmF0b3IgPSBvcHRpb25zLmVxdWFscyB8fCB1bmRlZmluZWQ7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICBjLnRTdGF0ZSA9IFNUQUxFO1xuICAgIFVwZGF0ZXMucHVzaChjKTtcbiAgfSBlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICByZXR1cm4gcmVhZFNpZ25hbC5iaW5kKGMpO1xufVxuZnVuY3Rpb24gaXNQcm9taXNlKHYpIHtcbiAgcmV0dXJuIHYgJiYgdHlwZW9mIHYgPT09IFwib2JqZWN0XCIgJiYgXCJ0aGVuXCIgaW4gdjtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlc291cmNlKHBTb3VyY2UsIHBGZXRjaGVyLCBwT3B0aW9ucykge1xuICBsZXQgc291cmNlO1xuICBsZXQgZmV0Y2hlcjtcbiAgbGV0IG9wdGlvbnM7XG4gIGlmICh0eXBlb2YgcEZldGNoZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIHNvdXJjZSA9IHBTb3VyY2U7XG4gICAgZmV0Y2hlciA9IHBGZXRjaGVyO1xuICAgIG9wdGlvbnMgPSBwT3B0aW9ucyB8fCB7fTtcbiAgfSBlbHNlIHtcbiAgICBzb3VyY2UgPSB0cnVlO1xuICAgIGZldGNoZXIgPSBwU291cmNlO1xuICAgIG9wdGlvbnMgPSBwRmV0Y2hlciB8fCB7fTtcbiAgfVxuICBsZXQgcHIgPSBudWxsLFxuICAgIGluaXRQID0gTk9fSU5JVCxcbiAgICBpZCA9IG51bGwsXG4gICAgbG9hZGVkVW5kZXJUcmFuc2l0aW9uID0gZmFsc2UsXG4gICAgc2NoZWR1bGVkID0gZmFsc2UsXG4gICAgcmVzb2x2ZWQgPSBcImluaXRpYWxWYWx1ZVwiIGluIG9wdGlvbnMsXG4gICAgZHluYW1pYyA9IHR5cGVvZiBzb3VyY2UgPT09IFwiZnVuY3Rpb25cIiAmJiBjcmVhdGVNZW1vKHNvdXJjZSk7XG4gIGNvbnN0IGNvbnRleHRzID0gbmV3IFNldCgpLFxuICAgIFt2YWx1ZSwgc2V0VmFsdWVdID0gKG9wdGlvbnMuc3RvcmFnZSB8fCBjcmVhdGVTaWduYWwpKG9wdGlvbnMuaW5pdGlhbFZhbHVlKSxcbiAgICBbZXJyb3IsIHNldEVycm9yXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQpLFxuICAgIFt0cmFjaywgdHJpZ2dlcl0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICBlcXVhbHM6IGZhbHNlXG4gICAgfSksXG4gICAgW3N0YXRlLCBzZXRTdGF0ZV0gPSBjcmVhdGVTaWduYWwocmVzb2x2ZWQgPyBcInJlYWR5XCIgOiBcInVucmVzb2x2ZWRcIik7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCkge1xuICAgIGlkID0gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKTtcbiAgICBpZiAob3B0aW9ucy5zc3JMb2FkRnJvbSA9PT0gXCJpbml0aWFsXCIpIGluaXRQID0gb3B0aW9ucy5pbml0aWFsVmFsdWU7ZWxzZSBpZiAoc2hhcmVkQ29uZmlnLmxvYWQgJiYgc2hhcmVkQ29uZmlnLmhhcyhpZCkpIGluaXRQID0gc2hhcmVkQ29uZmlnLmxvYWQoaWQpO1xuICB9XG4gIGZ1bmN0aW9uIGxvYWRFbmQocCwgdiwgZXJyb3IsIGtleSkge1xuICAgIGlmIChwciA9PT0gcCkge1xuICAgICAgcHIgPSBudWxsO1xuICAgICAga2V5ICE9PSB1bmRlZmluZWQgJiYgKHJlc29sdmVkID0gdHJ1ZSk7XG4gICAgICBpZiAoKHAgPT09IGluaXRQIHx8IHYgPT09IGluaXRQKSAmJiBvcHRpb25zLm9uSHlkcmF0ZWQpIHF1ZXVlTWljcm90YXNrKCgpID0+IG9wdGlvbnMub25IeWRyYXRlZChrZXksIHtcbiAgICAgICAgdmFsdWU6IHZcbiAgICAgIH0pKTtcbiAgICAgIGluaXRQID0gTk9fSU5JVDtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIHAgJiYgbG9hZGVkVW5kZXJUcmFuc2l0aW9uKSB7XG4gICAgICAgIFRyYW5zaXRpb24ucHJvbWlzZXMuZGVsZXRlKHApO1xuICAgICAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBmYWxzZTtcbiAgICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICBjb21wbGV0ZUxvYWQodiwgZXJyb3IpO1xuICAgICAgICB9LCBmYWxzZSk7XG4gICAgICB9IGVsc2UgY29tcGxldGVMb2FkKHYsIGVycm9yKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cbiAgZnVuY3Rpb24gY29tcGxldGVMb2FkKHYsIGVycikge1xuICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgaWYgKGVyciA9PT0gdW5kZWZpbmVkKSBzZXRWYWx1ZSgoKSA9PiB2KTtcbiAgICAgIHNldFN0YXRlKGVyciAhPT0gdW5kZWZpbmVkID8gXCJlcnJvcmVkXCIgOiByZXNvbHZlZCA/IFwicmVhZHlcIiA6IFwidW5yZXNvbHZlZFwiKTtcbiAgICAgIHNldEVycm9yKGVycik7XG4gICAgICBmb3IgKGNvbnN0IGMgb2YgY29udGV4dHMua2V5cygpKSBjLmRlY3JlbWVudCgpO1xuICAgICAgY29udGV4dHMuY2xlYXIoKTtcbiAgICB9LCBmYWxzZSk7XG4gIH1cbiAgZnVuY3Rpb24gcmVhZCgpIHtcbiAgICBjb25zdCBjID0gU3VzcGVuc2VDb250ZXh0ICYmIHVzZUNvbnRleHQoU3VzcGVuc2VDb250ZXh0KSxcbiAgICAgIHYgPSB2YWx1ZSgpLFxuICAgICAgZXJyID0gZXJyb3IoKTtcbiAgICBpZiAoZXJyICE9PSB1bmRlZmluZWQgJiYgIXByKSB0aHJvdyBlcnI7XG4gICAgaWYgKExpc3RlbmVyICYmICFMaXN0ZW5lci51c2VyICYmIGMpIHtcbiAgICAgIGNyZWF0ZUNvbXB1dGVkKCgpID0+IHtcbiAgICAgICAgdHJhY2soKTtcbiAgICAgICAgaWYgKHByKSB7XG4gICAgICAgICAgaWYgKGMucmVzb2x2ZWQgJiYgVHJhbnNpdGlvbiAmJiBsb2FkZWRVbmRlclRyYW5zaXRpb24pIFRyYW5zaXRpb24ucHJvbWlzZXMuYWRkKHByKTtlbHNlIGlmICghY29udGV4dHMuaGFzKGMpKSB7XG4gICAgICAgICAgICBjLmluY3JlbWVudCgpO1xuICAgICAgICAgICAgY29udGV4dHMuYWRkKGMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG4gIGZ1bmN0aW9uIGxvYWQocmVmZXRjaGluZyA9IHRydWUpIHtcbiAgICBpZiAocmVmZXRjaGluZyAhPT0gZmFsc2UgJiYgc2NoZWR1bGVkKSByZXR1cm47XG4gICAgc2NoZWR1bGVkID0gZmFsc2U7XG4gICAgY29uc3QgbG9va3VwID0gZHluYW1pYyA/IGR5bmFtaWMoKSA6IHNvdXJjZTtcbiAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgICBpZiAobG9va3VwID09IG51bGwgfHwgbG9va3VwID09PSBmYWxzZSkge1xuICAgICAgbG9hZEVuZChwciwgdW50cmFjayh2YWx1ZSkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoVHJhbnNpdGlvbiAmJiBwcikgVHJhbnNpdGlvbi5wcm9taXNlcy5kZWxldGUocHIpO1xuICAgIGxldCBlcnJvcjtcbiAgICBjb25zdCBwID0gaW5pdFAgIT09IE5PX0lOSVQgPyBpbml0UCA6IHVudHJhY2soKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIGZldGNoZXIobG9va3VwLCB7XG4gICAgICAgICAgdmFsdWU6IHZhbHVlKCksXG4gICAgICAgICAgcmVmZXRjaGluZ1xuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2ggKGZldGNoZXJFcnJvcikge1xuICAgICAgICBlcnJvciA9IGZldGNoZXJFcnJvcjtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoZXJyb3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbG9hZEVuZChwciwgdW5kZWZpbmVkLCBjYXN0RXJyb3IoZXJyb3IpLCBsb29rdXApO1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoIWlzUHJvbWlzZShwKSkge1xuICAgICAgbG9hZEVuZChwciwgcCwgdW5kZWZpbmVkLCBsb29rdXApO1xuICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIHByID0gcDtcbiAgICBpZiAoXCJ2XCIgaW4gcCkge1xuICAgICAgaWYgKHAucyA9PT0gMSkgbG9hZEVuZChwciwgcC52LCB1bmRlZmluZWQsIGxvb2t1cCk7ZWxzZSBsb2FkRW5kKHByLCB1bmRlZmluZWQsIGNhc3RFcnJvcihwLnYpLCBsb29rdXApO1xuICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIHNjaGVkdWxlZCA9IHRydWU7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4gc2NoZWR1bGVkID0gZmFsc2UpO1xuICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgc2V0U3RhdGUocmVzb2x2ZWQgPyBcInJlZnJlc2hpbmdcIiA6IFwicGVuZGluZ1wiKTtcbiAgICAgIHRyaWdnZXIoKTtcbiAgICB9LCBmYWxzZSk7XG4gICAgcmV0dXJuIHAudGhlbih2ID0+IGxvYWRFbmQocCwgdiwgdW5kZWZpbmVkLCBsb29rdXApLCBlID0+IGxvYWRFbmQocCwgdW5kZWZpbmVkLCBjYXN0RXJyb3IoZSksIGxvb2t1cCkpO1xuICB9XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHJlYWQsIHtcbiAgICBzdGF0ZToge1xuICAgICAgZ2V0OiAoKSA9PiBzdGF0ZSgpXG4gICAgfSxcbiAgICBlcnJvcjoge1xuICAgICAgZ2V0OiAoKSA9PiBlcnJvcigpXG4gICAgfSxcbiAgICBsb2FkaW5nOiB7XG4gICAgICBnZXQoKSB7XG4gICAgICAgIGNvbnN0IHMgPSBzdGF0ZSgpO1xuICAgICAgICByZXR1cm4gcyA9PT0gXCJwZW5kaW5nXCIgfHwgcyA9PT0gXCJyZWZyZXNoaW5nXCI7XG4gICAgICB9XG4gICAgfSxcbiAgICBsYXRlc3Q6IHtcbiAgICAgIGdldCgpIHtcbiAgICAgICAgaWYgKCFyZXNvbHZlZCkgcmV0dXJuIHJlYWQoKTtcbiAgICAgICAgY29uc3QgZXJyID0gZXJyb3IoKTtcbiAgICAgICAgaWYgKGVyciAmJiAhcHIpIHRocm93IGVycjtcbiAgICAgICAgcmV0dXJuIHZhbHVlKCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbiAgbGV0IG93bmVyID0gT3duZXI7XG4gIGlmIChkeW5hbWljKSBjcmVhdGVDb21wdXRlZCgoKSA9PiAob3duZXIgPSBPd25lciwgbG9hZChmYWxzZSkpKTtlbHNlIGxvYWQoZmFsc2UpO1xuICByZXR1cm4gW3JlYWQsIHtcbiAgICByZWZldGNoOiBpbmZvID0+IHJ1bldpdGhPd25lcihvd25lciwgKCkgPT4gbG9hZChpbmZvKSksXG4gICAgbXV0YXRlOiBzZXRWYWx1ZVxuICB9XTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZURlZmVycmVkKHNvdXJjZSwgb3B0aW9ucykge1xuICBsZXQgdCxcbiAgICB0aW1lb3V0ID0gb3B0aW9ucyA/IG9wdGlvbnMudGltZW91dE1zIDogdW5kZWZpbmVkO1xuICBjb25zdCBub2RlID0gY3JlYXRlQ29tcHV0YXRpb24oKCkgPT4ge1xuICAgIGlmICghdCB8fCAhdC5mbikgdCA9IHJlcXVlc3RDYWxsYmFjaygoKSA9PiBzZXREZWZlcnJlZCgoKSA9PiBub2RlLnZhbHVlKSwgdGltZW91dCAhPT0gdW5kZWZpbmVkID8ge1xuICAgICAgdGltZW91dFxuICAgIH0gOiB1bmRlZmluZWQpO1xuICAgIHJldHVybiBzb3VyY2UoKTtcbiAgfSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgY29uc3QgW2RlZmVycmVkLCBzZXREZWZlcnJlZF0gPSBjcmVhdGVTaWduYWwoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSwgb3B0aW9ucyk7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICBzZXREZWZlcnJlZCgoKSA9PiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlKTtcbiAgcmV0dXJuIGRlZmVycmVkO1xufVxuZnVuY3Rpb24gY3JlYXRlU2VsZWN0b3Ioc291cmNlLCBmbiA9IGVxdWFsRm4sIG9wdGlvbnMpIHtcbiAgY29uc3Qgc3VicyA9IG5ldyBNYXAoKTtcbiAgY29uc3Qgbm9kZSA9IGNyZWF0ZUNvbXB1dGF0aW9uKHAgPT4ge1xuICAgIGNvbnN0IHYgPSBzb3VyY2UoKTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2Ygc3Vicy5lbnRyaWVzKCkpIGlmIChmbihrZXksIHYpICE9PSBmbihrZXksIHApKSB7XG4gICAgICBmb3IgKGNvbnN0IGMgb2YgdmFsLnZhbHVlcygpKSB7XG4gICAgICAgIGMuc3RhdGUgPSBTVEFMRTtcbiAgICAgICAgaWYgKGMucHVyZSkgVXBkYXRlcy5wdXNoKGMpO2Vsc2UgRWZmZWN0cy5wdXNoKGMpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfSwgdW5kZWZpbmVkLCB0cnVlLCBTVEFMRSwgb3B0aW9ucyApO1xuICB1cGRhdGVDb21wdXRhdGlvbihub2RlKTtcbiAgcmV0dXJuIGtleSA9PiB7XG4gICAgY29uc3QgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgICBpZiAobGlzdGVuZXIpIHtcbiAgICAgIGxldCBsO1xuICAgICAgaWYgKGwgPSBzdWJzLmdldChrZXkpKSBsLmFkZChsaXN0ZW5lcik7ZWxzZSBzdWJzLnNldChrZXksIGwgPSBuZXcgU2V0KFtsaXN0ZW5lcl0pKTtcbiAgICAgIG9uQ2xlYW51cCgoKSA9PiB7XG4gICAgICAgIGwuZGVsZXRlKGxpc3RlbmVyKTtcbiAgICAgICAgIWwuc2l6ZSAmJiBzdWJzLmRlbGV0ZShrZXkpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBmbihrZXksIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUpO1xuICB9O1xufVxuZnVuY3Rpb24gYmF0Y2goZm4pIHtcbiAgcmV0dXJuIHJ1blVwZGF0ZXMoZm4sIGZhbHNlKTtcbn1cbmZ1bmN0aW9uIHVudHJhY2soZm4pIHtcbiAgaWYgKCFFeHRlcm5hbFNvdXJjZUNvbmZpZyAmJiBMaXN0ZW5lciA9PT0gbnVsbCkgcmV0dXJuIGZuKCk7XG4gIGNvbnN0IGxpc3RlbmVyID0gTGlzdGVuZXI7XG4gIExpc3RlbmVyID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcpIHJldHVybiBFeHRlcm5hbFNvdXJjZUNvbmZpZy51bnRyYWNrKGZuKTtcbiAgICByZXR1cm4gZm4oKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICB9XG59XG5mdW5jdGlvbiBvbihkZXBzLCBmbiwgb3B0aW9ucykge1xuICBjb25zdCBpc0FycmF5ID0gQXJyYXkuaXNBcnJheShkZXBzKTtcbiAgbGV0IHByZXZJbnB1dDtcbiAgbGV0IGRlZmVyID0gb3B0aW9ucyAmJiBvcHRpb25zLmRlZmVyO1xuICByZXR1cm4gcHJldlZhbHVlID0+IHtcbiAgICBsZXQgaW5wdXQ7XG4gICAgaWYgKGlzQXJyYXkpIHtcbiAgICAgIGlucHV0ID0gQXJyYXkoZGVwcy5sZW5ndGgpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZXBzLmxlbmd0aDsgaSsrKSBpbnB1dFtpXSA9IGRlcHNbaV0oKTtcbiAgICB9IGVsc2UgaW5wdXQgPSBkZXBzKCk7XG4gICAgaWYgKGRlZmVyKSB7XG4gICAgICBkZWZlciA9IGZhbHNlO1xuICAgICAgcmV0dXJuIHByZXZWYWx1ZTtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gdW50cmFjaygoKSA9PiBmbihpbnB1dCwgcHJldklucHV0LCBwcmV2VmFsdWUpKTtcbiAgICBwcmV2SW5wdXQgPSBpbnB1dDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xufVxuZnVuY3Rpb24gb25Nb3VudChmbikge1xuICBjcmVhdGVFZmZlY3QoKCkgPT4gdW50cmFjayhmbikpO1xufVxuZnVuY3Rpb24gb25DbGVhbnVwKGZuKSB7XG4gIGlmIChPd25lciA9PT0gbnVsbCkgY29uc29sZS53YXJuKFwiY2xlYW51cHMgY3JlYXRlZCBvdXRzaWRlIGEgYGNyZWF0ZVJvb3RgIG9yIGByZW5kZXJgIHdpbGwgbmV2ZXIgYmUgcnVuXCIpO2Vsc2UgaWYgKE93bmVyLmNsZWFudXBzID09PSBudWxsKSBPd25lci5jbGVhbnVwcyA9IFtmbl07ZWxzZSBPd25lci5jbGVhbnVwcy5wdXNoKGZuKTtcbiAgcmV0dXJuIGZuO1xufVxuZnVuY3Rpb24gY2F0Y2hFcnJvcihmbiwgaGFuZGxlcikge1xuICBFUlJPUiB8fCAoRVJST1IgPSBTeW1ib2woXCJlcnJvclwiKSk7XG4gIE93bmVyID0gY3JlYXRlQ29tcHV0YXRpb24odW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuICBPd25lci5jb250ZXh0ID0ge1xuICAgIC4uLk93bmVyLmNvbnRleHQsXG4gICAgW0VSUk9SXTogW2hhbmRsZXJdXG4gIH07XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgVHJhbnNpdGlvbi5zb3VyY2VzLmFkZChPd25lcik7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGZuKCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGhhbmRsZUVycm9yKGVycik7XG4gIH0gZmluYWxseSB7XG4gICAgT3duZXIgPSBPd25lci5vd25lcjtcbiAgfVxufVxuZnVuY3Rpb24gZ2V0TGlzdGVuZXIoKSB7XG4gIHJldHVybiBMaXN0ZW5lcjtcbn1cbmZ1bmN0aW9uIGdldE93bmVyKCkge1xuICByZXR1cm4gT3duZXI7XG59XG5mdW5jdGlvbiBydW5XaXRoT3duZXIobywgZm4pIHtcbiAgY29uc3QgcHJldiA9IE93bmVyO1xuICBjb25zdCBwcmV2TGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgT3duZXIgPSBvO1xuICBMaXN0ZW5lciA9IG51bGw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJ1blVwZGF0ZXMoZm4sIHRydWUpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBoYW5kbGVFcnJvcihlcnIpO1xuICB9IGZpbmFsbHkge1xuICAgIE93bmVyID0gcHJldjtcbiAgICBMaXN0ZW5lciA9IHByZXZMaXN0ZW5lcjtcbiAgfVxufVxuZnVuY3Rpb24gZW5hYmxlU2NoZWR1bGluZyhzY2hlZHVsZXIgPSByZXF1ZXN0Q2FsbGJhY2spIHtcbiAgU2NoZWR1bGVyID0gc2NoZWR1bGVyO1xufVxuZnVuY3Rpb24gc3RhcnRUcmFuc2l0aW9uKGZuKSB7XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGZuKCk7XG4gICAgcmV0dXJuIFRyYW5zaXRpb24uZG9uZTtcbiAgfVxuICBjb25zdCBsID0gTGlzdGVuZXI7XG4gIGNvbnN0IG8gPSBPd25lcjtcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oKCkgPT4ge1xuICAgIExpc3RlbmVyID0gbDtcbiAgICBPd25lciA9IG87XG4gICAgbGV0IHQ7XG4gICAgaWYgKFNjaGVkdWxlciB8fCBTdXNwZW5zZUNvbnRleHQpIHtcbiAgICAgIHQgPSBUcmFuc2l0aW9uIHx8IChUcmFuc2l0aW9uID0ge1xuICAgICAgICBzb3VyY2VzOiBuZXcgU2V0KCksXG4gICAgICAgIGVmZmVjdHM6IFtdLFxuICAgICAgICBwcm9taXNlczogbmV3IFNldCgpLFxuICAgICAgICBkaXNwb3NlZDogbmV3IFNldCgpLFxuICAgICAgICBxdWV1ZTogbmV3IFNldCgpLFxuICAgICAgICBydW5uaW5nOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIHQuZG9uZSB8fCAodC5kb25lID0gbmV3IFByb21pc2UocmVzID0+IHQucmVzb2x2ZSA9IHJlcykpO1xuICAgICAgdC5ydW5uaW5nID0gdHJ1ZTtcbiAgICB9XG4gICAgcnVuVXBkYXRlcyhmbiwgZmFsc2UpO1xuICAgIExpc3RlbmVyID0gT3duZXIgPSBudWxsO1xuICAgIHJldHVybiB0ID8gdC5kb25lIDogdW5kZWZpbmVkO1xuICB9KTtcbn1cbmNvbnN0IFt0cmFuc1BlbmRpbmcsIHNldFRyYW5zUGVuZGluZ10gPSAvKkBfX1BVUkVfXyovY3JlYXRlU2lnbmFsKGZhbHNlKTtcbmZ1bmN0aW9uIHVzZVRyYW5zaXRpb24oKSB7XG4gIHJldHVybiBbdHJhbnNQZW5kaW5nLCBzdGFydFRyYW5zaXRpb25dO1xufVxuZnVuY3Rpb24gcmVzdW1lRWZmZWN0cyhlKSB7XG4gIEVmZmVjdHMucHVzaC5hcHBseShFZmZlY3RzLCBlKTtcbiAgZS5sZW5ndGggPSAwO1xufVxuZnVuY3Rpb24gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzKSB7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB1bnRyYWNrKCgpID0+IHtcbiAgICBPYmplY3QuYXNzaWduKENvbXAsIHtcbiAgICAgIFskREVWQ09NUF06IHRydWVcbiAgICB9KTtcbiAgICByZXR1cm4gQ29tcChwcm9wcyk7XG4gIH0pLCB1bmRlZmluZWQsIHRydWUsIDApO1xuICBjLnByb3BzID0gcHJvcHM7XG4gIGMub2JzZXJ2ZXJzID0gbnVsbDtcbiAgYy5vYnNlcnZlclNsb3RzID0gbnVsbDtcbiAgYy5uYW1lID0gQ29tcC5uYW1lO1xuICBjLmNvbXBvbmVudCA9IENvbXA7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICByZXR1cm4gYy50VmFsdWUgIT09IHVuZGVmaW5lZCA/IGMudFZhbHVlIDogYy52YWx1ZTtcbn1cbmZ1bmN0aW9uIHJlZ2lzdGVyR3JhcGgodmFsdWUpIHtcbiAgaWYgKE93bmVyKSB7XG4gICAgaWYgKE93bmVyLnNvdXJjZU1hcCkgT3duZXIuc291cmNlTWFwLnB1c2godmFsdWUpO2Vsc2UgT3duZXIuc291cmNlTWFwID0gW3ZhbHVlXTtcbiAgICB2YWx1ZS5ncmFwaCA9IE93bmVyO1xuICB9XG4gIGlmIChEZXZIb29rcy5hZnRlclJlZ2lzdGVyR3JhcGgpIERldkhvb2tzLmFmdGVyUmVnaXN0ZXJHcmFwaCh2YWx1ZSk7XG59XG5mdW5jdGlvbiBjcmVhdGVDb250ZXh0KGRlZmF1bHRWYWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBpZCA9IFN5bWJvbChcImNvbnRleHRcIik7XG4gIHJldHVybiB7XG4gICAgaWQsXG4gICAgUHJvdmlkZXI6IGNyZWF0ZVByb3ZpZGVyKGlkLCBvcHRpb25zKSxcbiAgICBkZWZhdWx0VmFsdWVcbiAgfTtcbn1cbmZ1bmN0aW9uIHVzZUNvbnRleHQoY29udGV4dCkge1xuICBsZXQgdmFsdWU7XG4gIHJldHVybiBPd25lciAmJiBPd25lci5jb250ZXh0ICYmICh2YWx1ZSA9IE93bmVyLmNvbnRleHRbY29udGV4dC5pZF0pICE9PSB1bmRlZmluZWQgPyB2YWx1ZSA6IGNvbnRleHQuZGVmYXVsdFZhbHVlO1xufVxuZnVuY3Rpb24gY2hpbGRyZW4oZm4pIHtcbiAgY29uc3QgY2hpbGRyZW4gPSBjcmVhdGVNZW1vKGZuKTtcbiAgY29uc3QgbWVtbyA9IGNyZWF0ZU1lbW8oKCkgPT4gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKCkpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImNoaWxkcmVuXCJcbiAgfSkgO1xuICBtZW1vLnRvQXJyYXkgPSAoKSA9PiB7XG4gICAgY29uc3QgYyA9IG1lbW8oKTtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShjKSA/IGMgOiBjICE9IG51bGwgPyBbY10gOiBbXTtcbiAgfTtcbiAgcmV0dXJuIG1lbW87XG59XG5sZXQgU3VzcGVuc2VDb250ZXh0O1xuZnVuY3Rpb24gZ2V0U3VzcGVuc2VDb250ZXh0KCkge1xuICByZXR1cm4gU3VzcGVuc2VDb250ZXh0IHx8IChTdXNwZW5zZUNvbnRleHQgPSBjcmVhdGVDb250ZXh0KCkpO1xufVxuZnVuY3Rpb24gZW5hYmxlRXh0ZXJuYWxTb3VyY2UoZmFjdG9yeSwgdW50cmFjayA9IGZuID0+IGZuKCkpIHtcbiAgaWYgKEV4dGVybmFsU291cmNlQ29uZmlnKSB7XG4gICAgY29uc3Qge1xuICAgICAgZmFjdG9yeTogb2xkRmFjdG9yeSxcbiAgICAgIHVudHJhY2s6IG9sZFVudHJhY2tcbiAgICB9ID0gRXh0ZXJuYWxTb3VyY2VDb25maWc7XG4gICAgRXh0ZXJuYWxTb3VyY2VDb25maWcgPSB7XG4gICAgICBmYWN0b3J5OiAoZm4sIHRyaWdnZXIpID0+IHtcbiAgICAgICAgY29uc3Qgb2xkU291cmNlID0gb2xkRmFjdG9yeShmbiwgdHJpZ2dlcik7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IGZhY3RvcnkoeCA9PiBvbGRTb3VyY2UudHJhY2soeCksIHRyaWdnZXIpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHRyYWNrOiB4ID0+IHNvdXJjZS50cmFjayh4KSxcbiAgICAgICAgICBkaXNwb3NlKCkge1xuICAgICAgICAgICAgc291cmNlLmRpc3Bvc2UoKTtcbiAgICAgICAgICAgIG9sZFNvdXJjZS5kaXNwb3NlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIHVudHJhY2s6IGZuID0+IG9sZFVudHJhY2soKCkgPT4gdW50cmFjayhmbikpXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IHtcbiAgICAgIGZhY3RvcnksXG4gICAgICB1bnRyYWNrXG4gICAgfTtcbiAgfVxufVxuZnVuY3Rpb24gcmVhZFNpZ25hbCgpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgaWYgKHRoaXMuc291cmNlcyAmJiAocnVubmluZ1RyYW5zaXRpb24gPyB0aGlzLnRTdGF0ZSA6IHRoaXMuc3RhdGUpKSB7XG4gICAgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IHRoaXMudFN0YXRlIDogdGhpcy5zdGF0ZSkgPT09IFNUQUxFKSB1cGRhdGVDb21wdXRhdGlvbih0aGlzKTtlbHNlIHtcbiAgICAgIGNvbnN0IHVwZGF0ZXMgPSBVcGRhdGVzO1xuICAgICAgVXBkYXRlcyA9IG51bGw7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IGxvb2tVcHN0cmVhbSh0aGlzKSwgZmFsc2UpO1xuICAgICAgVXBkYXRlcyA9IHVwZGF0ZXM7XG4gICAgfVxuICB9XG4gIGlmIChMaXN0ZW5lcikge1xuICAgIGNvbnN0IHNTbG90ID0gdGhpcy5vYnNlcnZlcnMgPyB0aGlzLm9ic2VydmVycy5sZW5ndGggOiAwO1xuICAgIGlmICghTGlzdGVuZXIuc291cmNlcykge1xuICAgICAgTGlzdGVuZXIuc291cmNlcyA9IFt0aGlzXTtcbiAgICAgIExpc3RlbmVyLnNvdXJjZVNsb3RzID0gW3NTbG90XTtcbiAgICB9IGVsc2Uge1xuICAgICAgTGlzdGVuZXIuc291cmNlcy5wdXNoKHRoaXMpO1xuICAgICAgTGlzdGVuZXIuc291cmNlU2xvdHMucHVzaChzU2xvdCk7XG4gICAgfVxuICAgIGlmICghdGhpcy5vYnNlcnZlcnMpIHtcbiAgICAgIHRoaXMub2JzZXJ2ZXJzID0gW0xpc3RlbmVyXTtcbiAgICAgIHRoaXMub2JzZXJ2ZXJTbG90cyA9IFtMaXN0ZW5lci5zb3VyY2VzLmxlbmd0aCAtIDFdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9ic2VydmVycy5wdXNoKExpc3RlbmVyKTtcbiAgICAgIHRoaXMub2JzZXJ2ZXJTbG90cy5wdXNoKExpc3RlbmVyLnNvdXJjZXMubGVuZ3RoIC0gMSk7XG4gICAgfVxuICB9XG4gIGlmIChydW5uaW5nVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKHRoaXMpKSByZXR1cm4gdGhpcy50VmFsdWU7XG4gIHJldHVybiB0aGlzLnZhbHVlO1xufVxuZnVuY3Rpb24gd3JpdGVTaWduYWwobm9kZSwgdmFsdWUsIGlzQ29tcCkge1xuICBsZXQgY3VycmVudCA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWU7XG4gIGlmICghbm9kZS5jb21wYXJhdG9yIHx8ICFub2RlLmNvbXBhcmF0b3IoY3VycmVudCwgdmFsdWUpKSB7XG4gICAgaWYgKFRyYW5zaXRpb24pIHtcbiAgICAgIGNvbnN0IFRyYW5zaXRpb25SdW5uaW5nID0gVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgICAgaWYgKFRyYW5zaXRpb25SdW5uaW5nIHx8ICFpc0NvbXAgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSkge1xuICAgICAgICBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKG5vZGUpO1xuICAgICAgICBub2RlLnRWYWx1ZSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgaWYgKCFUcmFuc2l0aW9uUnVubmluZykgbm9kZS52YWx1ZSA9IHZhbHVlO1xuICAgIH0gZWxzZSBub2RlLnZhbHVlID0gdmFsdWU7XG4gICAgaWYgKG5vZGUub2JzZXJ2ZXJzICYmIG5vZGUub2JzZXJ2ZXJzLmxlbmd0aCkge1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vYnNlcnZlcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICBjb25zdCBvID0gbm9kZS5vYnNlcnZlcnNbaV07XG4gICAgICAgICAgY29uc3QgVHJhbnNpdGlvblJ1bm5pbmcgPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgICAgICAgICBpZiAoVHJhbnNpdGlvblJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXMobykpIGNvbnRpbnVlO1xuICAgICAgICAgIGlmIChUcmFuc2l0aW9uUnVubmluZyA/ICFvLnRTdGF0ZSA6ICFvLnN0YXRlKSB7XG4gICAgICAgICAgICBpZiAoby5wdXJlKSBVcGRhdGVzLnB1c2gobyk7ZWxzZSBFZmZlY3RzLnB1c2gobyk7XG4gICAgICAgICAgICBpZiAoby5vYnNlcnZlcnMpIG1hcmtEb3duc3RyZWFtKG8pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIVRyYW5zaXRpb25SdW5uaW5nKSBvLnN0YXRlID0gU1RBTEU7ZWxzZSBvLnRTdGF0ZSA9IFNUQUxFO1xuICAgICAgICB9XG4gICAgICAgIGlmIChVcGRhdGVzLmxlbmd0aCA+IDEwZTUpIHtcbiAgICAgICAgICBVcGRhdGVzID0gW107XG4gICAgICAgICAgaWYgKElTX0RFVikgdGhyb3cgbmV3IEVycm9yKFwiUG90ZW50aWFsIEluZmluaXRlIExvb3AgRGV0ZWN0ZWQuXCIpO1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuICAgICAgICB9XG4gICAgICB9LCBmYWxzZSk7XG4gICAgfVxuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpIHtcbiAgaWYgKCFub2RlLmZuKSByZXR1cm47XG4gIGNsZWFuTm9kZShub2RlKTtcbiAgY29uc3QgdGltZSA9IEV4ZWNDb3VudDtcbiAgcnVuQ29tcHV0YXRpb24obm9kZSwgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSwgdGltZSk7XG4gIGlmIChUcmFuc2l0aW9uICYmICFUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSkge1xuICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICBUcmFuc2l0aW9uICYmIChUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlKTtcbiAgICAgICAgTGlzdGVuZXIgPSBPd25lciA9IG5vZGU7XG4gICAgICAgIHJ1bkNvbXB1dGF0aW9uKG5vZGUsIG5vZGUudFZhbHVlLCB0aW1lKTtcbiAgICAgICAgTGlzdGVuZXIgPSBPd25lciA9IG51bGw7XG4gICAgICB9LCBmYWxzZSk7XG4gICAgfSk7XG4gIH1cbn1cbmZ1bmN0aW9uIHJ1bkNvbXB1dGF0aW9uKG5vZGUsIHZhbHVlLCB0aW1lKSB7XG4gIGxldCBuZXh0VmFsdWU7XG4gIGNvbnN0IG93bmVyID0gT3duZXIsXG4gICAgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgTGlzdGVuZXIgPSBPd25lciA9IG5vZGU7XG4gIHRyeSB7XG4gICAgbmV4dFZhbHVlID0gbm9kZS5mbih2YWx1ZSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmIChub2RlLnB1cmUpIHtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgICAgICBub2RlLnRTdGF0ZSA9IFNUQUxFO1xuICAgICAgICBub2RlLnRPd25lZCAmJiBub2RlLnRPd25lZC5mb3JFYWNoKGNsZWFuTm9kZSk7XG4gICAgICAgIG5vZGUudE93bmVkID0gdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9kZS5zdGF0ZSA9IFNUQUxFO1xuICAgICAgICBub2RlLm93bmVkICYmIG5vZGUub3duZWQuZm9yRWFjaChjbGVhbk5vZGUpO1xuICAgICAgICBub2RlLm93bmVkID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgbm9kZS51cGRhdGVkQXQgPSB0aW1lICsgMTtcbiAgICByZXR1cm4gaGFuZGxlRXJyb3IoZXJyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICAgIE93bmVyID0gb3duZXI7XG4gIH1cbiAgaWYgKCFub2RlLnVwZGF0ZWRBdCB8fCBub2RlLnVwZGF0ZWRBdCA8PSB0aW1lKSB7XG4gICAgaWYgKG5vZGUudXBkYXRlZEF0ICE9IG51bGwgJiYgXCJvYnNlcnZlcnNcIiBpbiBub2RlKSB7XG4gICAgICB3cml0ZVNpZ25hbChub2RlLCBuZXh0VmFsdWUsIHRydWUpO1xuICAgIH0gZWxzZSBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgbm9kZS5wdXJlKSB7XG4gICAgICBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKG5vZGUpO1xuICAgICAgbm9kZS50VmFsdWUgPSBuZXh0VmFsdWU7XG4gICAgfSBlbHNlIG5vZGUudmFsdWUgPSBuZXh0VmFsdWU7XG4gICAgbm9kZS51cGRhdGVkQXQgPSB0aW1lO1xuICB9XG59XG5mdW5jdGlvbiBjcmVhdGVDb21wdXRhdGlvbihmbiwgaW5pdCwgcHVyZSwgc3RhdGUgPSBTVEFMRSwgb3B0aW9ucykge1xuICBjb25zdCBjID0ge1xuICAgIGZuLFxuICAgIHN0YXRlOiBzdGF0ZSxcbiAgICB1cGRhdGVkQXQ6IG51bGwsXG4gICAgb3duZWQ6IG51bGwsXG4gICAgc291cmNlczogbnVsbCxcbiAgICBzb3VyY2VTbG90czogbnVsbCxcbiAgICBjbGVhbnVwczogbnVsbCxcbiAgICB2YWx1ZTogaW5pdCxcbiAgICBvd25lcjogT3duZXIsXG4gICAgY29udGV4dDogT3duZXIgPyBPd25lci5jb250ZXh0IDogbnVsbCxcbiAgICBwdXJlXG4gIH07XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGMuc3RhdGUgPSAwO1xuICAgIGMudFN0YXRlID0gc3RhdGU7XG4gIH1cbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJjb21wdXRhdGlvbnMgY3JlYXRlZCBvdXRzaWRlIGEgYGNyZWF0ZVJvb3RgIG9yIGByZW5kZXJgIHdpbGwgbmV2ZXIgYmUgZGlzcG9zZWRcIik7ZWxzZSBpZiAoT3duZXIgIT09IFVOT1dORUQpIHtcbiAgICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgT3duZXIucHVyZSkge1xuICAgICAgaWYgKCFPd25lci50T3duZWQpIE93bmVyLnRPd25lZCA9IFtjXTtlbHNlIE93bmVyLnRPd25lZC5wdXNoKGMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIU93bmVyLm93bmVkKSBPd25lci5vd25lZCA9IFtjXTtlbHNlIE93bmVyLm93bmVkLnB1c2goYyk7XG4gICAgfVxuICB9XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMubmFtZSkgYy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcgJiYgYy5mbikge1xuICAgIGNvbnN0IFt0cmFjaywgdHJpZ2dlcl0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICBlcXVhbHM6IGZhbHNlXG4gICAgfSk7XG4gICAgY29uc3Qgb3JkaW5hcnkgPSBFeHRlcm5hbFNvdXJjZUNvbmZpZy5mYWN0b3J5KGMuZm4sIHRyaWdnZXIpO1xuICAgIG9uQ2xlYW51cCgoKSA9PiBvcmRpbmFyeS5kaXNwb3NlKCkpO1xuICAgIGNvbnN0IHRyaWdnZXJJblRyYW5zaXRpb24gPSAoKSA9PiBzdGFydFRyYW5zaXRpb24odHJpZ2dlcikudGhlbigoKSA9PiBpblRyYW5zaXRpb24uZGlzcG9zZSgpKTtcbiAgICBjb25zdCBpblRyYW5zaXRpb24gPSBFeHRlcm5hbFNvdXJjZUNvbmZpZy5mYWN0b3J5KGMuZm4sIHRyaWdnZXJJblRyYW5zaXRpb24pO1xuICAgIGMuZm4gPSB4ID0+IHtcbiAgICAgIHRyYWNrKCk7XG4gICAgICByZXR1cm4gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgPyBpblRyYW5zaXRpb24udHJhY2soeCkgOiBvcmRpbmFyeS50cmFjayh4KTtcbiAgICB9O1xuICB9XG4gIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIgJiYgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lcihjKTtcbiAgcmV0dXJuIGM7XG59XG5mdW5jdGlvbiBydW5Ub3Aobm9kZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gMCkgcmV0dXJuO1xuICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gUEVORElORykgcmV0dXJuIGxvb2tVcHN0cmVhbShub2RlKTtcbiAgaWYgKG5vZGUuc3VzcGVuc2UgJiYgdW50cmFjayhub2RlLnN1c3BlbnNlLmluRmFsbGJhY2spKSByZXR1cm4gbm9kZS5zdXNwZW5zZS5lZmZlY3RzLnB1c2gobm9kZSk7XG4gIGNvbnN0IGFuY2VzdG9ycyA9IFtub2RlXTtcbiAgd2hpbGUgKChub2RlID0gbm9kZS5vd25lcikgJiYgKCFub2RlLnVwZGF0ZWRBdCB8fCBub2RlLnVwZGF0ZWRBdCA8IEV4ZWNDb3VudCkpIHtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXMobm9kZSkpIHJldHVybjtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpIGFuY2VzdG9ycy5wdXNoKG5vZGUpO1xuICB9XG4gIGZvciAobGV0IGkgPSBhbmNlc3RvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBub2RlID0gYW5jZXN0b3JzW2ldO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbikge1xuICAgICAgbGV0IHRvcCA9IG5vZGUsXG4gICAgICAgIHByZXYgPSBhbmNlc3RvcnNbaSArIDFdO1xuICAgICAgd2hpbGUgKCh0b3AgPSB0b3Aub3duZXIpICYmIHRvcCAhPT0gcHJldikge1xuICAgICAgICBpZiAoVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXModG9wKSkgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gU1RBTEUpIHtcbiAgICAgIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICAgIH0gZWxzZSBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gUEVORElORykge1xuICAgICAgY29uc3QgdXBkYXRlcyA9IFVwZGF0ZXM7XG4gICAgICBVcGRhdGVzID0gbnVsbDtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4gbG9va1Vwc3RyZWFtKG5vZGUsIGFuY2VzdG9yc1swXSksIGZhbHNlKTtcbiAgICAgIFVwZGF0ZXMgPSB1cGRhdGVzO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gcnVuVXBkYXRlcyhmbiwgaW5pdCkge1xuICBpZiAoVXBkYXRlcykgcmV0dXJuIGZuKCk7XG4gIGxldCB3YWl0ID0gZmFsc2U7XG4gIGlmICghaW5pdCkgVXBkYXRlcyA9IFtdO1xuICBpZiAoRWZmZWN0cykgd2FpdCA9IHRydWU7ZWxzZSBFZmZlY3RzID0gW107XG4gIEV4ZWNDb3VudCsrO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGZuKCk7XG4gICAgY29tcGxldGVVcGRhdGVzKHdhaXQpO1xuICAgIHJldHVybiByZXM7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmICghd2FpdCkgRWZmZWN0cyA9IG51bGw7XG4gICAgVXBkYXRlcyA9IG51bGw7XG4gICAgaGFuZGxlRXJyb3IoZXJyKTtcbiAgfVxufVxuZnVuY3Rpb24gY29tcGxldGVVcGRhdGVzKHdhaXQpIHtcbiAgaWYgKFVwZGF0ZXMpIHtcbiAgICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBzY2hlZHVsZVF1ZXVlKFVwZGF0ZXMpO2Vsc2UgcnVuUXVldWUoVXBkYXRlcyk7XG4gICAgVXBkYXRlcyA9IG51bGw7XG4gIH1cbiAgaWYgKHdhaXQpIHJldHVybjtcbiAgbGV0IHJlcztcbiAgaWYgKFRyYW5zaXRpb24pIHtcbiAgICBpZiAoIVRyYW5zaXRpb24ucHJvbWlzZXMuc2l6ZSAmJiAhVHJhbnNpdGlvbi5xdWV1ZS5zaXplKSB7XG4gICAgICBjb25zdCBzb3VyY2VzID0gVHJhbnNpdGlvbi5zb3VyY2VzO1xuICAgICAgY29uc3QgZGlzcG9zZWQgPSBUcmFuc2l0aW9uLmRpc3Bvc2VkO1xuICAgICAgRWZmZWN0cy5wdXNoLmFwcGx5KEVmZmVjdHMsIFRyYW5zaXRpb24uZWZmZWN0cyk7XG4gICAgICByZXMgPSBUcmFuc2l0aW9uLnJlc29sdmU7XG4gICAgICBmb3IgKGNvbnN0IGUgb2YgRWZmZWN0cykge1xuICAgICAgICBcInRTdGF0ZVwiIGluIGUgJiYgKGUuc3RhdGUgPSBlLnRTdGF0ZSk7XG4gICAgICAgIGRlbGV0ZSBlLnRTdGF0ZTtcbiAgICAgIH1cbiAgICAgIFRyYW5zaXRpb24gPSBudWxsO1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgZCBvZiBkaXNwb3NlZCkgY2xlYW5Ob2RlKGQpO1xuICAgICAgICBmb3IgKGNvbnN0IHYgb2Ygc291cmNlcykge1xuICAgICAgICAgIHYudmFsdWUgPSB2LnRWYWx1ZTtcbiAgICAgICAgICBpZiAodi5vd25lZCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHYub3duZWQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIGNsZWFuTm9kZSh2Lm93bmVkW2ldKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHYudE93bmVkKSB2Lm93bmVkID0gdi50T3duZWQ7XG4gICAgICAgICAgZGVsZXRlIHYudFZhbHVlO1xuICAgICAgICAgIGRlbGV0ZSB2LnRPd25lZDtcbiAgICAgICAgICB2LnRTdGF0ZSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgc2V0VHJhbnNQZW5kaW5nKGZhbHNlKTtcbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKFRyYW5zaXRpb24ucnVubmluZykge1xuICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gZmFsc2U7XG4gICAgICBUcmFuc2l0aW9uLmVmZmVjdHMucHVzaC5hcHBseShUcmFuc2l0aW9uLmVmZmVjdHMsIEVmZmVjdHMpO1xuICAgICAgRWZmZWN0cyA9IG51bGw7XG4gICAgICBzZXRUcmFuc1BlbmRpbmcodHJ1ZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG4gIGNvbnN0IGUgPSBFZmZlY3RzO1xuICBFZmZlY3RzID0gbnVsbDtcbiAgaWYgKGUubGVuZ3RoKSBydW5VcGRhdGVzKCgpID0+IHJ1bkVmZmVjdHMoZSksIGZhbHNlKTtlbHNlIERldkhvb2tzLmFmdGVyVXBkYXRlICYmIERldkhvb2tzLmFmdGVyVXBkYXRlKCk7XG4gIGlmIChyZXMpIHJlcygpO1xufVxuZnVuY3Rpb24gcnVuUXVldWUocXVldWUpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykgcnVuVG9wKHF1ZXVlW2ldKTtcbn1cbmZ1bmN0aW9uIHNjaGVkdWxlUXVldWUocXVldWUpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGl0ZW0gPSBxdWV1ZVtpXTtcbiAgICBjb25zdCB0YXNrcyA9IFRyYW5zaXRpb24ucXVldWU7XG4gICAgaWYgKCF0YXNrcy5oYXMoaXRlbSkpIHtcbiAgICAgIHRhc2tzLmFkZChpdGVtKTtcbiAgICAgIFNjaGVkdWxlcigoKSA9PiB7XG4gICAgICAgIHRhc2tzLmRlbGV0ZShpdGVtKTtcbiAgICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICBydW5Ub3AoaXRlbSk7XG4gICAgICAgIH0sIGZhbHNlKTtcbiAgICAgICAgVHJhbnNpdGlvbiAmJiAoVHJhbnNpdGlvbi5ydW5uaW5nID0gZmFsc2UpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBydW5Vc2VyRWZmZWN0cyhxdWV1ZSkge1xuICBsZXQgaSxcbiAgICB1c2VyTGVuZ3RoID0gMDtcbiAgZm9yIChpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZSA9IHF1ZXVlW2ldO1xuICAgIGlmICghZS51c2VyKSBydW5Ub3AoZSk7ZWxzZSBxdWV1ZVt1c2VyTGVuZ3RoKytdID0gZTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmNvdW50KSB7XG4gICAgICBzaGFyZWRDb25maWcuZWZmZWN0cyB8fCAoc2hhcmVkQ29uZmlnLmVmZmVjdHMgPSBbXSk7XG4gICAgICBzaGFyZWRDb25maWcuZWZmZWN0cy5wdXNoKC4uLnF1ZXVlLnNsaWNlKDAsIHVzZXJMZW5ndGgpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmVmZmVjdHMgJiYgKHNoYXJlZENvbmZpZy5kb25lIHx8ICFzaGFyZWRDb25maWcuY291bnQpKSB7XG4gICAgcXVldWUgPSBbLi4uc2hhcmVkQ29uZmlnLmVmZmVjdHMsIC4uLnF1ZXVlXTtcbiAgICB1c2VyTGVuZ3RoICs9IHNoYXJlZENvbmZpZy5lZmZlY3RzLmxlbmd0aDtcbiAgICBkZWxldGUgc2hhcmVkQ29uZmlnLmVmZmVjdHM7XG4gIH1cbiAgZm9yIChpID0gMDsgaSA8IHVzZXJMZW5ndGg7IGkrKykgcnVuVG9wKHF1ZXVlW2ldKTtcbn1cbmZ1bmN0aW9uIGxvb2tVcHN0cmVhbShub2RlLCBpZ25vcmUpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uKSBub2RlLnRTdGF0ZSA9IDA7ZWxzZSBub2RlLnN0YXRlID0gMDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLnNvdXJjZXMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBjb25zdCBzb3VyY2UgPSBub2RlLnNvdXJjZXNbaV07XG4gICAgaWYgKHNvdXJjZS5zb3VyY2VzKSB7XG4gICAgICBjb25zdCBzdGF0ZSA9IHJ1bm5pbmdUcmFuc2l0aW9uID8gc291cmNlLnRTdGF0ZSA6IHNvdXJjZS5zdGF0ZTtcbiAgICAgIGlmIChzdGF0ZSA9PT0gU1RBTEUpIHtcbiAgICAgICAgaWYgKHNvdXJjZSAhPT0gaWdub3JlICYmICghc291cmNlLnVwZGF0ZWRBdCB8fCBzb3VyY2UudXBkYXRlZEF0IDwgRXhlY0NvdW50KSkgcnVuVG9wKHNvdXJjZSk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBQRU5ESU5HKSBsb29rVXBzdHJlYW0oc291cmNlLCBpZ25vcmUpO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gbWFya0Rvd25zdHJlYW0obm9kZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUub2JzZXJ2ZXJzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgY29uc3QgbyA9IG5vZGUub2JzZXJ2ZXJzW2ldO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiA/ICFvLnRTdGF0ZSA6ICFvLnN0YXRlKSB7XG4gICAgICBpZiAocnVubmluZ1RyYW5zaXRpb24pIG8udFN0YXRlID0gUEVORElORztlbHNlIG8uc3RhdGUgPSBQRU5ESU5HO1xuICAgICAgaWYgKG8ucHVyZSkgVXBkYXRlcy5wdXNoKG8pO2Vsc2UgRWZmZWN0cy5wdXNoKG8pO1xuICAgICAgby5vYnNlcnZlcnMgJiYgbWFya0Rvd25zdHJlYW0obyk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBjbGVhbk5vZGUobm9kZSkge1xuICBsZXQgaTtcbiAgaWYgKG5vZGUuc291cmNlcykge1xuICAgIHdoaWxlIChub2RlLnNvdXJjZXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBzb3VyY2UgPSBub2RlLnNvdXJjZXMucG9wKCksXG4gICAgICAgIGluZGV4ID0gbm9kZS5zb3VyY2VTbG90cy5wb3AoKSxcbiAgICAgICAgb2JzID0gc291cmNlLm9ic2VydmVycztcbiAgICAgIGlmIChvYnMgJiYgb2JzLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBuID0gb2JzLnBvcCgpLFxuICAgICAgICAgIHMgPSBzb3VyY2Uub2JzZXJ2ZXJTbG90cy5wb3AoKTtcbiAgICAgICAgaWYgKGluZGV4IDwgb2JzLmxlbmd0aCkge1xuICAgICAgICAgIG4uc291cmNlU2xvdHNbc10gPSBpbmRleDtcbiAgICAgICAgICBvYnNbaW5kZXhdID0gbjtcbiAgICAgICAgICBzb3VyY2Uub2JzZXJ2ZXJTbG90c1tpbmRleF0gPSBzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChub2RlLnRPd25lZCkge1xuICAgIGZvciAoaSA9IG5vZGUudE93bmVkLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBjbGVhbk5vZGUobm9kZS50T3duZWRbaV0pO1xuICAgIGRlbGV0ZSBub2RlLnRPd25lZDtcbiAgfVxuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgbm9kZS5wdXJlKSB7XG4gICAgcmVzZXQobm9kZSwgdHJ1ZSk7XG4gIH0gZWxzZSBpZiAobm9kZS5vd25lZCkge1xuICAgIGZvciAoaSA9IG5vZGUub3duZWQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGNsZWFuTm9kZShub2RlLm93bmVkW2ldKTtcbiAgICBub2RlLm93bmVkID0gbnVsbDtcbiAgfVxuICBpZiAobm9kZS5jbGVhbnVwcykge1xuICAgIGZvciAoaSA9IG5vZGUuY2xlYW51cHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIG5vZGUuY2xlYW51cHNbaV0oKTtcbiAgICBub2RlLmNsZWFudXBzID0gbnVsbDtcbiAgfVxuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIG5vZGUudFN0YXRlID0gMDtlbHNlIG5vZGUuc3RhdGUgPSAwO1xuICBkZWxldGUgbm9kZS5zb3VyY2VNYXA7XG59XG5mdW5jdGlvbiByZXNldChub2RlLCB0b3ApIHtcbiAgaWYgKCF0b3ApIHtcbiAgICBub2RlLnRTdGF0ZSA9IDA7XG4gICAgVHJhbnNpdGlvbi5kaXNwb3NlZC5hZGQobm9kZSk7XG4gIH1cbiAgaWYgKG5vZGUub3duZWQpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUub3duZWQubGVuZ3RoOyBpKyspIHJlc2V0KG5vZGUub3duZWRbaV0pO1xuICB9XG59XG5mdW5jdGlvbiBjYXN0RXJyb3IoZXJyKSB7XG4gIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikgcmV0dXJuIGVycjtcbiAgcmV0dXJuIG5ldyBFcnJvcih0eXBlb2YgZXJyID09PSBcInN0cmluZ1wiID8gZXJyIDogXCJVbmtub3duIGVycm9yXCIsIHtcbiAgICBjYXVzZTogZXJyXG4gIH0pO1xufVxuZnVuY3Rpb24gcnVuRXJyb3JzKGVyciwgZm5zLCBvd25lcikge1xuICB0cnkge1xuICAgIGZvciAoY29uc3QgZiBvZiBmbnMpIGYoZXJyKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGhhbmRsZUVycm9yKGUsIG93bmVyICYmIG93bmVyLm93bmVyIHx8IG51bGwpO1xuICB9XG59XG5mdW5jdGlvbiBoYW5kbGVFcnJvcihlcnIsIG93bmVyID0gT3duZXIpIHtcbiAgY29uc3QgZm5zID0gRVJST1IgJiYgb3duZXIgJiYgb3duZXIuY29udGV4dCAmJiBvd25lci5jb250ZXh0W0VSUk9SXTtcbiAgY29uc3QgZXJyb3IgPSBjYXN0RXJyb3IoZXJyKTtcbiAgaWYgKCFmbnMpIHRocm93IGVycm9yO1xuICBpZiAoRWZmZWN0cykgRWZmZWN0cy5wdXNoKHtcbiAgICBmbigpIHtcbiAgICAgIHJ1bkVycm9ycyhlcnJvciwgZm5zLCBvd25lcik7XG4gICAgfSxcbiAgICBzdGF0ZTogU1RBTEVcbiAgfSk7ZWxzZSBydW5FcnJvcnMoZXJyb3IsIGZucywgb3duZXIpO1xufVxuZnVuY3Rpb24gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKSB7XG4gIGlmICh0eXBlb2YgY2hpbGRyZW4gPT09IFwiZnVuY3Rpb25cIiAmJiAhY2hpbGRyZW4ubGVuZ3RoKSByZXR1cm4gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKCkpO1xuICBpZiAoQXJyYXkuaXNBcnJheShjaGlsZHJlbikpIHtcbiAgICBjb25zdCByZXN1bHRzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgcmVzdWx0ID0gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuW2ldKTtcbiAgICAgIEFycmF5LmlzQXJyYXkocmVzdWx0KSA/IHJlc3VsdHMucHVzaC5hcHBseShyZXN1bHRzLCByZXN1bHQpIDogcmVzdWx0cy5wdXNoKHJlc3VsdCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG4gIHJldHVybiBjaGlsZHJlbjtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVByb3ZpZGVyKGlkLCBvcHRpb25zKSB7XG4gIHJldHVybiBmdW5jdGlvbiBwcm92aWRlcihwcm9wcykge1xuICAgIGxldCByZXM7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHJlcyA9IHVudHJhY2soKCkgPT4ge1xuICAgICAgT3duZXIuY29udGV4dCA9IHtcbiAgICAgICAgLi4uT3duZXIuY29udGV4dCxcbiAgICAgICAgW2lkXTogcHJvcHMudmFsdWVcbiAgICAgIH07XG4gICAgICByZXR1cm4gY2hpbGRyZW4oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICAgIH0pLCB1bmRlZmluZWQsIG9wdGlvbnMpO1xuICAgIHJldHVybiByZXM7XG4gIH07XG59XG5mdW5jdGlvbiBvbkVycm9yKGZuKSB7XG4gIEVSUk9SIHx8IChFUlJPUiA9IFN5bWJvbChcImVycm9yXCIpKTtcbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJlcnJvciBoYW5kbGVycyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBydW5cIik7ZWxzZSBpZiAoT3duZXIuY29udGV4dCA9PT0gbnVsbCB8fCAhT3duZXIuY29udGV4dFtFUlJPUl0pIHtcbiAgICBPd25lci5jb250ZXh0ID0ge1xuICAgICAgLi4uT3duZXIuY29udGV4dCxcbiAgICAgIFtFUlJPUl06IFtmbl1cbiAgICB9O1xuICAgIG11dGF0ZUNvbnRleHQoT3duZXIsIEVSUk9SLCBbZm5dKTtcbiAgfSBlbHNlIE93bmVyLmNvbnRleHRbRVJST1JdLnB1c2goZm4pO1xufVxuZnVuY3Rpb24gbXV0YXRlQ29udGV4dChvLCBrZXksIHZhbHVlKSB7XG4gIGlmIChvLm93bmVkKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvLm93bmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoby5vd25lZFtpXS5jb250ZXh0ID09PSBvLmNvbnRleHQpIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICBpZiAoIW8ub3duZWRbaV0uY29udGV4dCkge1xuICAgICAgICBvLm93bmVkW2ldLmNvbnRleHQgPSBvLmNvbnRleHQ7XG4gICAgICAgIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKCFvLm93bmVkW2ldLmNvbnRleHRba2V5XSkge1xuICAgICAgICBvLm93bmVkW2ldLmNvbnRleHRba2V5XSA9IHZhbHVlO1xuICAgICAgICBtdXRhdGVDb250ZXh0KG8ub3duZWRbaV0sIGtleSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBvYnNlcnZhYmxlKGlucHV0KSB7XG4gIHJldHVybiB7XG4gICAgc3Vic2NyaWJlKG9ic2VydmVyKSB7XG4gICAgICBpZiAoIShvYnNlcnZlciBpbnN0YW5jZW9mIE9iamVjdCkgfHwgb2JzZXJ2ZXIgPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRXhwZWN0ZWQgdGhlIG9ic2VydmVyIHRvIGJlIGFuIG9iamVjdC5cIik7XG4gICAgICB9XG4gICAgICBjb25zdCBoYW5kbGVyID0gdHlwZW9mIG9ic2VydmVyID09PSBcImZ1bmN0aW9uXCIgPyBvYnNlcnZlciA6IG9ic2VydmVyLm5leHQgJiYgb2JzZXJ2ZXIubmV4dC5iaW5kKG9ic2VydmVyKTtcbiAgICAgIGlmICghaGFuZGxlcikge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHVuc3Vic2NyaWJlKCkge31cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRpc3Bvc2UgPSBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgICBjb25zdCB2ID0gaW5wdXQoKTtcbiAgICAgICAgICB1bnRyYWNrKCgpID0+IGhhbmRsZXIodikpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRpc3Bvc2VyO1xuICAgICAgfSk7XG4gICAgICBpZiAoZ2V0T3duZXIoKSkgb25DbGVhbnVwKGRpc3Bvc2UpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKSB7XG4gICAgICAgICAgZGlzcG9zZSgpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0sXG4gICAgW1N5bWJvbC5vYnNlcnZhYmxlIHx8IFwiQEBvYnNlcnZhYmxlXCJdKCkge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gZnJvbShwcm9kdWNlciwgaW5pdGFsVmFsdWUgPSB1bmRlZmluZWQpIHtcbiAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoaW5pdGFsVmFsdWUsIHtcbiAgICBlcXVhbHM6IGZhbHNlXG4gIH0pO1xuICBpZiAoXCJzdWJzY3JpYmVcIiBpbiBwcm9kdWNlcikge1xuICAgIGNvbnN0IHVuc3ViID0gcHJvZHVjZXIuc3Vic2NyaWJlKHYgPT4gc2V0KCgpID0+IHYpKTtcbiAgICBvbkNsZWFudXAoKCkgPT4gXCJ1bnN1YnNjcmliZVwiIGluIHVuc3ViID8gdW5zdWIudW5zdWJzY3JpYmUoKSA6IHVuc3ViKCkpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGNsZWFuID0gcHJvZHVjZXIoc2V0KTtcbiAgICBvbkNsZWFudXAoY2xlYW4pO1xuICB9XG4gIHJldHVybiBzO1xufVxuXG5jb25zdCBGQUxMQkFDSyA9IFN5bWJvbChcImZhbGxiYWNrXCIpO1xuZnVuY3Rpb24gZGlzcG9zZShkKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZC5sZW5ndGg7IGkrKykgZFtpXSgpO1xufVxuZnVuY3Rpb24gbWFwQXJyYXkobGlzdCwgbWFwRm4sIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgaXRlbXMgPSBbXSxcbiAgICBtYXBwZWQgPSBbXSxcbiAgICBkaXNwb3NlcnMgPSBbXSxcbiAgICBsZW4gPSAwLFxuICAgIGluZGV4ZXMgPSBtYXBGbi5sZW5ndGggPiAxID8gW10gOiBudWxsO1xuICBvbkNsZWFudXAoKCkgPT4gZGlzcG9zZShkaXNwb3NlcnMpKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBsZXQgbmV3SXRlbXMgPSBsaXN0KCkgfHwgW10sXG4gICAgICBuZXdMZW4gPSBuZXdJdGVtcy5sZW5ndGgsXG4gICAgICBpLFxuICAgICAgajtcbiAgICBuZXdJdGVtc1skVFJBQ0tdO1xuICAgIHJldHVybiB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGxldCBuZXdJbmRpY2VzLCBuZXdJbmRpY2VzTmV4dCwgdGVtcCwgdGVtcGRpc3Bvc2VycywgdGVtcEluZGV4ZXMsIHN0YXJ0LCBlbmQsIG5ld0VuZCwgaXRlbTtcbiAgICAgIGlmIChuZXdMZW4gPT09IDApIHtcbiAgICAgICAgaWYgKGxlbiAhPT0gMCkge1xuICAgICAgICAgIGRpc3Bvc2UoZGlzcG9zZXJzKTtcbiAgICAgICAgICBkaXNwb3NlcnMgPSBbXTtcbiAgICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICAgIGxlbiA9IDA7XG4gICAgICAgICAgaW5kZXhlcyAmJiAoaW5kZXhlcyA9IFtdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5mYWxsYmFjaykge1xuICAgICAgICAgIGl0ZW1zID0gW0ZBTExCQUNLXTtcbiAgICAgICAgICBtYXBwZWRbMF0gPSBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgICAgIGRpc3Bvc2Vyc1swXSA9IGRpc3Bvc2VyO1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMuZmFsbGJhY2soKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBsZW4gPSAxO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChsZW4gPT09IDApIHtcbiAgICAgICAgbWFwcGVkID0gbmV3IEFycmF5KG5ld0xlbik7XG4gICAgICAgIGZvciAoaiA9IDA7IGogPCBuZXdMZW47IGorKykge1xuICAgICAgICAgIGl0ZW1zW2pdID0gbmV3SXRlbXNbal07XG4gICAgICAgICAgbWFwcGVkW2pdID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICAgIGxlbiA9IG5ld0xlbjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRlbXAgPSBuZXcgQXJyYXkobmV3TGVuKTtcbiAgICAgICAgdGVtcGRpc3Bvc2VycyA9IG5ldyBBcnJheShuZXdMZW4pO1xuICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlcyA9IG5ldyBBcnJheShuZXdMZW4pKTtcbiAgICAgICAgZm9yIChzdGFydCA9IDAsIGVuZCA9IE1hdGgubWluKGxlbiwgbmV3TGVuKTsgc3RhcnQgPCBlbmQgJiYgaXRlbXNbc3RhcnRdID09PSBuZXdJdGVtc1tzdGFydF07IHN0YXJ0KyspO1xuICAgICAgICBmb3IgKGVuZCA9IGxlbiAtIDEsIG5ld0VuZCA9IG5ld0xlbiAtIDE7IGVuZCA+PSBzdGFydCAmJiBuZXdFbmQgPj0gc3RhcnQgJiYgaXRlbXNbZW5kXSA9PT0gbmV3SXRlbXNbbmV3RW5kXTsgZW5kLS0sIG5ld0VuZC0tKSB7XG4gICAgICAgICAgdGVtcFtuZXdFbmRdID0gbWFwcGVkW2VuZF07XG4gICAgICAgICAgdGVtcGRpc3Bvc2Vyc1tuZXdFbmRdID0gZGlzcG9zZXJzW2VuZF07XG4gICAgICAgICAgaW5kZXhlcyAmJiAodGVtcEluZGV4ZXNbbmV3RW5kXSA9IGluZGV4ZXNbZW5kXSk7XG4gICAgICAgIH1cbiAgICAgICAgbmV3SW5kaWNlcyA9IG5ldyBNYXAoKTtcbiAgICAgICAgbmV3SW5kaWNlc05leHQgPSBuZXcgQXJyYXkobmV3RW5kICsgMSk7XG4gICAgICAgIGZvciAoaiA9IG5ld0VuZDsgaiA+PSBzdGFydDsgai0tKSB7XG4gICAgICAgICAgaXRlbSA9IG5ld0l0ZW1zW2pdO1xuICAgICAgICAgIGkgPSBuZXdJbmRpY2VzLmdldChpdGVtKTtcbiAgICAgICAgICBuZXdJbmRpY2VzTmV4dFtqXSA9IGkgPT09IHVuZGVmaW5lZCA/IC0xIDogaTtcbiAgICAgICAgICBuZXdJbmRpY2VzLnNldChpdGVtLCBqKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGkgPSBzdGFydDsgaSA8PSBlbmQ7IGkrKykge1xuICAgICAgICAgIGl0ZW0gPSBpdGVtc1tpXTtcbiAgICAgICAgICBqID0gbmV3SW5kaWNlcy5nZXQoaXRlbSk7XG4gICAgICAgICAgaWYgKGogIT09IHVuZGVmaW5lZCAmJiBqICE9PSAtMSkge1xuICAgICAgICAgICAgdGVtcFtqXSA9IG1hcHBlZFtpXTtcbiAgICAgICAgICAgIHRlbXBkaXNwb3NlcnNbal0gPSBkaXNwb3NlcnNbaV07XG4gICAgICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlc1tqXSA9IGluZGV4ZXNbaV0pO1xuICAgICAgICAgICAgaiA9IG5ld0luZGljZXNOZXh0W2pdO1xuICAgICAgICAgICAgbmV3SW5kaWNlcy5zZXQoaXRlbSwgaik7XG4gICAgICAgICAgfSBlbHNlIGRpc3Bvc2Vyc1tpXSgpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaiA9IHN0YXJ0OyBqIDwgbmV3TGVuOyBqKyspIHtcbiAgICAgICAgICBpZiAoaiBpbiB0ZW1wKSB7XG4gICAgICAgICAgICBtYXBwZWRbal0gPSB0ZW1wW2pdO1xuICAgICAgICAgICAgZGlzcG9zZXJzW2pdID0gdGVtcGRpc3Bvc2Vyc1tqXTtcbiAgICAgICAgICAgIGlmIChpbmRleGVzKSB7XG4gICAgICAgICAgICAgIGluZGV4ZXNbal0gPSB0ZW1wSW5kZXhlc1tqXTtcbiAgICAgICAgICAgICAgaW5kZXhlc1tqXShqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgbWFwcGVkW2pdID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICAgIG1hcHBlZCA9IG1hcHBlZC5zbGljZSgwLCBsZW4gPSBuZXdMZW4pO1xuICAgICAgICBpdGVtcyA9IG5ld0l0ZW1zLnNsaWNlKDApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1hcHBlZDtcbiAgICB9KTtcbiAgICBmdW5jdGlvbiBtYXBwZXIoZGlzcG9zZXIpIHtcbiAgICAgIGRpc3Bvc2Vyc1tqXSA9IGRpc3Bvc2VyO1xuICAgICAgaWYgKGluZGV4ZXMpIHtcbiAgICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoaiwge1xuICAgICAgICAgIG5hbWU6IFwiaW5kZXhcIlxuICAgICAgICB9KSA7XG4gICAgICAgIGluZGV4ZXNbal0gPSBzZXQ7XG4gICAgICAgIHJldHVybiBtYXBGbihuZXdJdGVtc1tqXSwgcyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWFwRm4obmV3SXRlbXNbal0pO1xuICAgIH1cbiAgfTtcbn1cbmZ1bmN0aW9uIGluZGV4QXJyYXkobGlzdCwgbWFwRm4sIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgaXRlbXMgPSBbXSxcbiAgICBtYXBwZWQgPSBbXSxcbiAgICBkaXNwb3NlcnMgPSBbXSxcbiAgICBzaWduYWxzID0gW10sXG4gICAgbGVuID0gMCxcbiAgICBpO1xuICBvbkNsZWFudXAoKCkgPT4gZGlzcG9zZShkaXNwb3NlcnMpKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBjb25zdCBuZXdJdGVtcyA9IGxpc3QoKSB8fCBbXSxcbiAgICAgIG5ld0xlbiA9IG5ld0l0ZW1zLmxlbmd0aDtcbiAgICBuZXdJdGVtc1skVFJBQ0tdO1xuICAgIHJldHVybiB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGlmIChuZXdMZW4gPT09IDApIHtcbiAgICAgICAgaWYgKGxlbiAhPT0gMCkge1xuICAgICAgICAgIGRpc3Bvc2UoZGlzcG9zZXJzKTtcbiAgICAgICAgICBkaXNwb3NlcnMgPSBbXTtcbiAgICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICAgIGxlbiA9IDA7XG4gICAgICAgICAgc2lnbmFscyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLmZhbGxiYWNrKSB7XG4gICAgICAgICAgaXRlbXMgPSBbRkFMTEJBQ0tdO1xuICAgICAgICAgIG1hcHBlZFswXSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZXJzWzBdID0gZGlzcG9zZXI7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9ucy5mYWxsYmFjaygpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxlbiA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hcHBlZDtcbiAgICAgIH1cbiAgICAgIGlmIChpdGVtc1swXSA9PT0gRkFMTEJBQ0spIHtcbiAgICAgICAgZGlzcG9zZXJzWzBdKCk7XG4gICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICBtYXBwZWQgPSBbXTtcbiAgICAgICAgbGVuID0gMDtcbiAgICAgIH1cbiAgICAgIGZvciAoaSA9IDA7IGkgPCBuZXdMZW47IGkrKykge1xuICAgICAgICBpZiAoaSA8IGl0ZW1zLmxlbmd0aCAmJiBpdGVtc1tpXSAhPT0gbmV3SXRlbXNbaV0pIHtcbiAgICAgICAgICBzaWduYWxzW2ldKCgpID0+IG5ld0l0ZW1zW2ldKTtcbiAgICAgICAgfSBlbHNlIGlmIChpID49IGl0ZW1zLmxlbmd0aCkge1xuICAgICAgICAgIG1hcHBlZFtpXSA9IGNyZWF0ZVJvb3QobWFwcGVyKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yICg7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBkaXNwb3NlcnNbaV0oKTtcbiAgICAgIH1cbiAgICAgIGxlbiA9IHNpZ25hbHMubGVuZ3RoID0gZGlzcG9zZXJzLmxlbmd0aCA9IG5ld0xlbjtcbiAgICAgIGl0ZW1zID0gbmV3SXRlbXMuc2xpY2UoMCk7XG4gICAgICByZXR1cm4gbWFwcGVkID0gbWFwcGVkLnNsaWNlKDAsIGxlbik7XG4gICAgfSk7XG4gICAgZnVuY3Rpb24gbWFwcGVyKGRpc3Bvc2VyKSB7XG4gICAgICBkaXNwb3NlcnNbaV0gPSBkaXNwb3NlcjtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKG5ld0l0ZW1zW2ldLCB7XG4gICAgICAgIG5hbWU6IFwidmFsdWVcIlxuICAgICAgfSkgO1xuICAgICAgc2lnbmFsc1tpXSA9IHNldDtcbiAgICAgIHJldHVybiBtYXBGbihzLCBpKTtcbiAgICB9XG4gIH07XG59XG5cbmxldCBoeWRyYXRpb25FbmFibGVkID0gZmFsc2U7XG5mdW5jdGlvbiBlbmFibGVIeWRyYXRpb24oKSB7XG4gIGh5ZHJhdGlvbkVuYWJsZWQgPSB0cnVlO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50KENvbXAsIHByb3BzKSB7XG4gIGlmIChoeWRyYXRpb25FbmFibGVkKSB7XG4gICAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0KSB7XG4gICAgICBjb25zdCBjID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChuZXh0SHlkcmF0ZUNvbnRleHQoKSk7XG4gICAgICBjb25zdCByID0gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzIHx8IHt9KSA7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjKTtcbiAgICAgIHJldHVybiByO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzIHx8IHt9KTtcbn1cbmZ1bmN0aW9uIHRydWVGbigpIHtcbiAgcmV0dXJuIHRydWU7XG59XG5jb25zdCBwcm9wVHJhcHMgPSB7XG4gIGdldChfLCBwcm9wZXJ0eSwgcmVjZWl2ZXIpIHtcbiAgICBpZiAocHJvcGVydHkgPT09ICRQUk9YWSkgcmV0dXJuIHJlY2VpdmVyO1xuICAgIHJldHVybiBfLmdldChwcm9wZXJ0eSk7XG4gIH0sXG4gIGhhcyhfLCBwcm9wZXJ0eSkge1xuICAgIGlmIChwcm9wZXJ0eSA9PT0gJFBST1hZKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gXy5oYXMocHJvcGVydHkpO1xuICB9LFxuICBzZXQ6IHRydWVGbixcbiAgZGVsZXRlUHJvcGVydHk6IHRydWVGbixcbiAgZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKF8sIHByb3BlcnR5KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBnZXQoKSB7XG4gICAgICAgIHJldHVybiBfLmdldChwcm9wZXJ0eSk7XG4gICAgICB9LFxuICAgICAgc2V0OiB0cnVlRm4sXG4gICAgICBkZWxldGVQcm9wZXJ0eTogdHJ1ZUZuXG4gICAgfTtcbiAgfSxcbiAgb3duS2V5cyhfKSB7XG4gICAgcmV0dXJuIF8ua2V5cygpO1xuICB9XG59O1xuZnVuY3Rpb24gcmVzb2x2ZVNvdXJjZShzKSB7XG4gIHJldHVybiAhKHMgPSB0eXBlb2YgcyA9PT0gXCJmdW5jdGlvblwiID8gcygpIDogcykgPyB7fSA6IHM7XG59XG5mdW5jdGlvbiByZXNvbHZlU291cmNlcygpIHtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbmd0aCA9IHRoaXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICBjb25zdCB2ID0gdGhpc1tpXSgpO1xuICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHJldHVybiB2O1xuICB9XG59XG5mdW5jdGlvbiBtZXJnZVByb3BzKC4uLnNvdXJjZXMpIHtcbiAgbGV0IHByb3h5ID0gZmFsc2U7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHMgPSBzb3VyY2VzW2ldO1xuICAgIHByb3h5ID0gcHJveHkgfHwgISFzICYmICRQUk9YWSBpbiBzO1xuICAgIHNvdXJjZXNbaV0gPSB0eXBlb2YgcyA9PT0gXCJmdW5jdGlvblwiID8gKHByb3h5ID0gdHJ1ZSwgY3JlYXRlTWVtbyhzKSkgOiBzO1xuICB9XG4gIGlmIChTVVBQT1JUU19QUk9YWSAmJiBwcm94eSkge1xuICAgIHJldHVybiBuZXcgUHJveHkoe1xuICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgY29uc3QgdiA9IHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSlbcHJvcGVydHldO1xuICAgICAgICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHJldHVybiB2O1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFzKHByb3BlcnR5KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgaWYgKHByb3BlcnR5IGluIHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSkpIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBrZXlzKCkge1xuICAgICAgICBjb25zdCBrZXlzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc291cmNlcy5sZW5ndGg7IGkrKykga2V5cy5wdXNoKC4uLk9iamVjdC5rZXlzKHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSkpKTtcbiAgICAgICAgcmV0dXJuIFsuLi5uZXcgU2V0KGtleXMpXTtcbiAgICAgIH1cbiAgICB9LCBwcm9wVHJhcHMpO1xuICB9XG4gIGNvbnN0IHNvdXJjZXNNYXAgPSB7fTtcbiAgY29uc3QgZGVmaW5lZCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3Qgc291cmNlID0gc291cmNlc1tpXTtcbiAgICBpZiAoIXNvdXJjZSkgY29udGludWU7XG4gICAgY29uc3Qgc291cmNlS2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHNvdXJjZSk7XG4gICAgZm9yIChsZXQgaSA9IHNvdXJjZUtleXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IGtleSA9IHNvdXJjZUtleXNbaV07XG4gICAgICBpZiAoa2V5ID09PSBcIl9fcHJvdG9fX1wiIHx8IGtleSA9PT0gXCJjb25zdHJ1Y3RvclwiKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHNvdXJjZSwga2V5KTtcbiAgICAgIGlmICghZGVmaW5lZFtrZXldKSB7XG4gICAgICAgIGRlZmluZWRba2V5XSA9IGRlc2MuZ2V0ID8ge1xuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGdldDogcmVzb2x2ZVNvdXJjZXMuYmluZChzb3VyY2VzTWFwW2tleV0gPSBbZGVzYy5nZXQuYmluZChzb3VyY2UpXSlcbiAgICAgICAgfSA6IGRlc2MudmFsdWUgIT09IHVuZGVmaW5lZCA/IGRlc2MgOiB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBzb3VyY2VzID0gc291cmNlc01hcFtrZXldO1xuICAgICAgICBpZiAoc291cmNlcykge1xuICAgICAgICAgIGlmIChkZXNjLmdldCkgc291cmNlcy5wdXNoKGRlc2MuZ2V0LmJpbmQoc291cmNlKSk7ZWxzZSBpZiAoZGVzYy52YWx1ZSAhPT0gdW5kZWZpbmVkKSBzb3VyY2VzLnB1c2goKCkgPT4gZGVzYy52YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY29uc3QgdGFyZ2V0ID0ge307XG4gIGNvbnN0IGRlZmluZWRLZXlzID0gT2JqZWN0LmtleXMoZGVmaW5lZCk7XG4gIGZvciAobGV0IGkgPSBkZWZpbmVkS2V5cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGNvbnN0IGtleSA9IGRlZmluZWRLZXlzW2ldLFxuICAgICAgZGVzYyA9IGRlZmluZWRba2V5XTtcbiAgICBpZiAoZGVzYyAmJiBkZXNjLmdldCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCBkZXNjKTtlbHNlIHRhcmdldFtrZXldID0gZGVzYyA/IGRlc2MudmFsdWUgOiB1bmRlZmluZWQ7XG4gIH1cbiAgcmV0dXJuIHRhcmdldDtcbn1cbmZ1bmN0aW9uIHNwbGl0UHJvcHMocHJvcHMsIC4uLmtleXMpIHtcbiAgaWYgKFNVUFBPUlRTX1BST1hZICYmICRQUk9YWSBpbiBwcm9wcykge1xuICAgIGNvbnN0IGJsb2NrZWQgPSBuZXcgU2V0KGtleXMubGVuZ3RoID4gMSA/IGtleXMuZmxhdCgpIDoga2V5c1swXSk7XG4gICAgY29uc3QgcmVzID0ga2V5cy5tYXAoayA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb3h5KHtcbiAgICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgICAgcmV0dXJuIGsuaW5jbHVkZXMocHJvcGVydHkpID8gcHJvcHNbcHJvcGVydHldIDogdW5kZWZpbmVkO1xuICAgICAgICB9LFxuICAgICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gay5pbmNsdWRlcyhwcm9wZXJ0eSkgJiYgcHJvcGVydHkgaW4gcHJvcHM7XG4gICAgICAgIH0sXG4gICAgICAgIGtleXMoKSB7XG4gICAgICAgICAgcmV0dXJuIGsuZmlsdGVyKHByb3BlcnR5ID0+IHByb3BlcnR5IGluIHByb3BzKTtcbiAgICAgICAgfVxuICAgICAgfSwgcHJvcFRyYXBzKTtcbiAgICB9KTtcbiAgICByZXMucHVzaChuZXcgUHJveHkoe1xuICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgIHJldHVybiBibG9ja2VkLmhhcyhwcm9wZXJ0eSkgPyB1bmRlZmluZWQgOiBwcm9wc1twcm9wZXJ0eV07XG4gICAgICB9LFxuICAgICAgaGFzKHByb3BlcnR5KSB7XG4gICAgICAgIHJldHVybiBibG9ja2VkLmhhcyhwcm9wZXJ0eSkgPyBmYWxzZSA6IHByb3BlcnR5IGluIHByb3BzO1xuICAgICAgfSxcbiAgICAgIGtleXMoKSB7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhwcm9wcykuZmlsdGVyKGsgPT4gIWJsb2NrZWQuaGFzKGspKTtcbiAgICAgIH1cbiAgICB9LCBwcm9wVHJhcHMpKTtcbiAgICByZXR1cm4gcmVzO1xuICB9XG4gIGNvbnN0IG90aGVyT2JqZWN0ID0ge307XG4gIGNvbnN0IG9iamVjdHMgPSBrZXlzLm1hcCgoKSA9PiAoe30pKTtcbiAgZm9yIChjb25zdCBwcm9wTmFtZSBvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhwcm9wcykpIHtcbiAgICBjb25zdCBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwcm9wcywgcHJvcE5hbWUpO1xuICAgIGNvbnN0IGlzRGVmYXVsdERlc2MgPSAhZGVzYy5nZXQgJiYgIWRlc2Muc2V0ICYmIGRlc2MuZW51bWVyYWJsZSAmJiBkZXNjLndyaXRhYmxlICYmIGRlc2MuY29uZmlndXJhYmxlO1xuICAgIGxldCBibG9ja2VkID0gZmFsc2U7XG4gICAgbGV0IG9iamVjdEluZGV4ID0gMDtcbiAgICBmb3IgKGNvbnN0IGsgb2Yga2V5cykge1xuICAgICAgaWYgKGsuaW5jbHVkZXMocHJvcE5hbWUpKSB7XG4gICAgICAgIGJsb2NrZWQgPSB0cnVlO1xuICAgICAgICBpc0RlZmF1bHREZXNjID8gb2JqZWN0c1tvYmplY3RJbmRleF1bcHJvcE5hbWVdID0gZGVzYy52YWx1ZSA6IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmplY3RzW29iamVjdEluZGV4XSwgcHJvcE5hbWUsIGRlc2MpO1xuICAgICAgfVxuICAgICAgKytvYmplY3RJbmRleDtcbiAgICB9XG4gICAgaWYgKCFibG9ja2VkKSB7XG4gICAgICBpc0RlZmF1bHREZXNjID8gb3RoZXJPYmplY3RbcHJvcE5hbWVdID0gZGVzYy52YWx1ZSA6IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvdGhlck9iamVjdCwgcHJvcE5hbWUsIGRlc2MpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gWy4uLm9iamVjdHMsIG90aGVyT2JqZWN0XTtcbn1cbmZ1bmN0aW9uIGxhenkoZm4pIHtcbiAgbGV0IGNvbXA7XG4gIGxldCBwO1xuICBjb25zdCB3cmFwID0gcHJvcHMgPT4ge1xuICAgIGNvbnN0IGN0eCA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICAgIGlmIChjdHgpIHtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKCk7XG4gICAgICBzaGFyZWRDb25maWcuY291bnQgfHwgKHNoYXJlZENvbmZpZy5jb3VudCA9IDApO1xuICAgICAgc2hhcmVkQ29uZmlnLmNvdW50Kys7XG4gICAgICAocCB8fCAocCA9IGZuKCkpKS50aGVuKG1vZCA9PiB7XG4gICAgICAgICFzaGFyZWRDb25maWcuZG9uZSAmJiBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgICBzaGFyZWRDb25maWcuY291bnQtLTtcbiAgICAgICAgc2V0KCgpID0+IG1vZC5kZWZhdWx0KTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgIH0pO1xuICAgICAgY29tcCA9IHM7XG4gICAgfSBlbHNlIGlmICghY29tcCkge1xuICAgICAgY29uc3QgW3NdID0gY3JlYXRlUmVzb3VyY2UoKCkgPT4gKHAgfHwgKHAgPSBmbigpKSkudGhlbihtb2QgPT4gbW9kLmRlZmF1bHQpKTtcbiAgICAgIGNvbXAgPSBzO1xuICAgIH1cbiAgICBsZXQgQ29tcDtcbiAgICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiAoQ29tcCA9IGNvbXAoKSkgPyB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGlmIChJU19ERVYpIE9iamVjdC5hc3NpZ24oQ29tcCwge1xuICAgICAgICBbJERFVkNPTVBdOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIGlmICghY3R4IHx8IHNoYXJlZENvbmZpZy5kb25lKSByZXR1cm4gQ29tcChwcm9wcyk7XG4gICAgICBjb25zdCBjID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgY29uc3QgciA9IENvbXAocHJvcHMpO1xuICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoYyk7XG4gICAgICByZXR1cm4gcjtcbiAgICB9KSA6IFwiXCIpO1xuICB9O1xuICB3cmFwLnByZWxvYWQgPSAoKSA9PiBwIHx8ICgocCA9IGZuKCkpLnRoZW4obW9kID0+IGNvbXAgPSAoKSA9PiBtb2QuZGVmYXVsdCksIHApO1xuICByZXR1cm4gd3JhcDtcbn1cbmxldCBjb3VudGVyID0gMDtcbmZ1bmN0aW9uIGNyZWF0ZVVuaXF1ZUlkKCkge1xuICBjb25zdCBjdHggPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgcmV0dXJuIGN0eCA/IHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCkgOiBgY2wtJHtjb3VudGVyKyt9YDtcbn1cblxuY29uc3QgbmFycm93ZWRFcnJvciA9IG5hbWUgPT4gYEF0dGVtcHRpbmcgdG8gYWNjZXNzIGEgc3RhbGUgdmFsdWUgZnJvbSA8JHtuYW1lfT4gdGhhdCBjb3VsZCBwb3NzaWJseSBiZSB1bmRlZmluZWQuIFRoaXMgbWF5IG9jY3VyIGJlY2F1c2UgeW91IGFyZSByZWFkaW5nIHRoZSBhY2Nlc3NvciByZXR1cm5lZCBmcm9tIHRoZSBjb21wb25lbnQgYXQgYSB0aW1lIHdoZXJlIGl0IGhhcyBhbHJlYWR5IGJlZW4gdW5tb3VudGVkLiBXZSByZWNvbW1lbmQgY2xlYW5pbmcgdXAgYW55IHN0YWxlIHRpbWVycyBvciBhc3luYywgb3IgcmVhZGluZyBmcm9tIHRoZSBpbml0aWFsIGNvbmRpdGlvbi5gIDtcbmZ1bmN0aW9uIEZvcihwcm9wcykge1xuICBjb25zdCBmYWxsYmFjayA9IFwiZmFsbGJhY2tcIiBpbiBwcm9wcyAmJiB7XG4gICAgZmFsbGJhY2s6ICgpID0+IHByb3BzLmZhbGxiYWNrXG4gIH07XG4gIHJldHVybiBjcmVhdGVNZW1vKG1hcEFycmF5KCgpID0+IHByb3BzLmVhY2gsIHByb3BzLmNoaWxkcmVuLCBmYWxsYmFjayB8fCB1bmRlZmluZWQpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSkgO1xufVxuZnVuY3Rpb24gSW5kZXgocHJvcHMpIHtcbiAgY29uc3QgZmFsbGJhY2sgPSBcImZhbGxiYWNrXCIgaW4gcHJvcHMgJiYge1xuICAgIGZhbGxiYWNrOiAoKSA9PiBwcm9wcy5mYWxsYmFja1xuICB9O1xuICByZXR1cm4gY3JlYXRlTWVtbyhpbmRleEFycmF5KCgpID0+IHByb3BzLmVhY2gsIHByb3BzLmNoaWxkcmVuLCBmYWxsYmFjayB8fCB1bmRlZmluZWQpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSkgO1xufVxuZnVuY3Rpb24gU2hvdyhwcm9wcykge1xuICBjb25zdCBrZXllZCA9IHByb3BzLmtleWVkO1xuICBjb25zdCBjb25kaXRpb25WYWx1ZSA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMud2hlbiwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJjb25kaXRpb24gdmFsdWVcIlxuICB9ICk7XG4gIGNvbnN0IGNvbmRpdGlvbiA9IGtleWVkID8gY29uZGl0aW9uVmFsdWUgOiBjcmVhdGVNZW1vKGNvbmRpdGlvblZhbHVlLCB1bmRlZmluZWQsIHtcbiAgICBlcXVhbHM6IChhLCBiKSA9PiAhYSA9PT0gIWIsXG4gICAgbmFtZTogXCJjb25kaXRpb25cIlxuICB9ICk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBjID0gY29uZGl0aW9uKCk7XG4gICAgaWYgKGMpIHtcbiAgICAgIGNvbnN0IGNoaWxkID0gcHJvcHMuY2hpbGRyZW47XG4gICAgICBjb25zdCBmbiA9IHR5cGVvZiBjaGlsZCA9PT0gXCJmdW5jdGlvblwiICYmIGNoaWxkLmxlbmd0aCA+IDA7XG4gICAgICByZXR1cm4gZm4gPyB1bnRyYWNrKCgpID0+IGNoaWxkKGtleWVkID8gYyA6ICgpID0+IHtcbiAgICAgICAgaWYgKCF1bnRyYWNrKGNvbmRpdGlvbikpIHRocm93IG5hcnJvd2VkRXJyb3IoXCJTaG93XCIpO1xuICAgICAgICByZXR1cm4gY29uZGl0aW9uVmFsdWUoKTtcbiAgICAgIH0pKSA6IGNoaWxkO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcHMuZmFsbGJhY2s7XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9ICk7XG59XG5mdW5jdGlvbiBTd2l0Y2gocHJvcHMpIHtcbiAgY29uc3QgY2hzID0gY2hpbGRyZW4oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICBjb25zdCBzd2l0Y2hGdW5jID0gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgY2ggPSBjaHMoKTtcbiAgICBjb25zdCBtcHMgPSBBcnJheS5pc0FycmF5KGNoKSA/IGNoIDogW2NoXTtcbiAgICBsZXQgZnVuYyA9ICgpID0+IHVuZGVmaW5lZDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1wcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaW5kZXggPSBpO1xuICAgICAgY29uc3QgbXAgPSBtcHNbaV07XG4gICAgICBjb25zdCBwcmV2RnVuYyA9IGZ1bmM7XG4gICAgICBjb25zdCBjb25kaXRpb25WYWx1ZSA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJldkZ1bmMoKSA/IHVuZGVmaW5lZCA6IG1wLndoZW4sIHVuZGVmaW5lZCwge1xuICAgICAgICBuYW1lOiBcImNvbmRpdGlvbiB2YWx1ZVwiXG4gICAgICB9ICk7XG4gICAgICBjb25zdCBjb25kaXRpb24gPSBtcC5rZXllZCA/IGNvbmRpdGlvblZhbHVlIDogY3JlYXRlTWVtbyhjb25kaXRpb25WYWx1ZSwgdW5kZWZpbmVkLCB7XG4gICAgICAgIGVxdWFsczogKGEsIGIpID0+ICFhID09PSAhYixcbiAgICAgICAgbmFtZTogXCJjb25kaXRpb25cIlxuICAgICAgfSApO1xuICAgICAgZnVuYyA9ICgpID0+IHByZXZGdW5jKCkgfHwgKGNvbmRpdGlvbigpID8gW2luZGV4LCBjb25kaXRpb25WYWx1ZSwgbXBdIDogdW5kZWZpbmVkKTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmM7XG4gIH0pO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3Qgc2VsID0gc3dpdGNoRnVuYygpKCk7XG4gICAgaWYgKCFzZWwpIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgICBjb25zdCBbaW5kZXgsIGNvbmRpdGlvblZhbHVlLCBtcF0gPSBzZWw7XG4gICAgY29uc3QgY2hpbGQgPSBtcC5jaGlsZHJlbjtcbiAgICBjb25zdCBmbiA9IHR5cGVvZiBjaGlsZCA9PT0gXCJmdW5jdGlvblwiICYmIGNoaWxkLmxlbmd0aCA+IDA7XG4gICAgcmV0dXJuIGZuID8gdW50cmFjaygoKSA9PiBjaGlsZChtcC5rZXllZCA/IGNvbmRpdGlvblZhbHVlKCkgOiAoKSA9PiB7XG4gICAgICBpZiAodW50cmFjayhzd2l0Y2hGdW5jKSgpPy5bMF0gIT09IGluZGV4KSB0aHJvdyBuYXJyb3dlZEVycm9yKFwiTWF0Y2hcIik7XG4gICAgICByZXR1cm4gY29uZGl0aW9uVmFsdWUoKTtcbiAgICB9KSkgOiBjaGlsZDtcbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJldmFsIGNvbmRpdGlvbnNcIlxuICB9ICk7XG59XG5mdW5jdGlvbiBNYXRjaChwcm9wcykge1xuICByZXR1cm4gcHJvcHM7XG59XG5sZXQgRXJyb3JzO1xuZnVuY3Rpb24gcmVzZXRFcnJvckJvdW5kYXJpZXMoKSB7XG4gIEVycm9ycyAmJiBbLi4uRXJyb3JzXS5mb3JFYWNoKGZuID0+IGZuKCkpO1xufVxuZnVuY3Rpb24gRXJyb3JCb3VuZGFyeShwcm9wcykge1xuICBsZXQgZXJyO1xuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgc2hhcmVkQ29uZmlnLmxvYWQpIGVyciA9IHNoYXJlZENvbmZpZy5sb2FkKHNoYXJlZENvbmZpZy5nZXRDb250ZXh0SWQoKSk7XG4gIGNvbnN0IFtlcnJvcmVkLCBzZXRFcnJvcmVkXSA9IGNyZWF0ZVNpZ25hbChlcnIsIHtcbiAgICBuYW1lOiBcImVycm9yZWRcIlxuICB9ICk7XG4gIEVycm9ycyB8fCAoRXJyb3JzID0gbmV3IFNldCgpKTtcbiAgRXJyb3JzLmFkZChzZXRFcnJvcmVkKTtcbiAgb25DbGVhbnVwKCgpID0+IEVycm9ycy5kZWxldGUoc2V0RXJyb3JlZCkpO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgbGV0IGU7XG4gICAgaWYgKGUgPSBlcnJvcmVkKCkpIHtcbiAgICAgIGNvbnN0IGYgPSBwcm9wcy5mYWxsYmFjaztcbiAgICAgIGlmICgodHlwZW9mIGYgIT09IFwiZnVuY3Rpb25cIiB8fCBmLmxlbmd0aCA9PSAwKSkgY29uc29sZS5lcnJvcihlKTtcbiAgICAgIHJldHVybiB0eXBlb2YgZiA9PT0gXCJmdW5jdGlvblwiICYmIGYubGVuZ3RoID8gdW50cmFjaygoKSA9PiBmKGUsICgpID0+IHNldEVycm9yZWQoKSkpIDogZjtcbiAgICB9XG4gICAgcmV0dXJuIGNhdGNoRXJyb3IoKCkgPT4gcHJvcHMuY2hpbGRyZW4sIHNldEVycm9yZWQpO1xuICB9LCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSApO1xufVxuXG5jb25zdCBzdXNwZW5zZUxpc3RFcXVhbHMgPSAoYSwgYikgPT4gYS5zaG93Q29udGVudCA9PT0gYi5zaG93Q29udGVudCAmJiBhLnNob3dGYWxsYmFjayA9PT0gYi5zaG93RmFsbGJhY2s7XG5jb25zdCBTdXNwZW5zZUxpc3RDb250ZXh0ID0gLyogI19fUFVSRV9fICovY3JlYXRlQ29udGV4dCgpO1xuZnVuY3Rpb24gU3VzcGVuc2VMaXN0KHByb3BzKSB7XG4gIGxldCBbd3JhcHBlciwgc2V0V3JhcHBlcl0gPSBjcmVhdGVTaWduYWwoKCkgPT4gKHtcbiAgICAgIGluRmFsbGJhY2s6IGZhbHNlXG4gICAgfSkpLFxuICAgIHNob3c7XG4gIGNvbnN0IGxpc3RDb250ZXh0ID0gdXNlQ29udGV4dChTdXNwZW5zZUxpc3RDb250ZXh0KTtcbiAgY29uc3QgW3JlZ2lzdHJ5LCBzZXRSZWdpc3RyeV0gPSBjcmVhdGVTaWduYWwoW10pO1xuICBpZiAobGlzdENvbnRleHQpIHtcbiAgICBzaG93ID0gbGlzdENvbnRleHQucmVnaXN0ZXIoY3JlYXRlTWVtbygoKSA9PiB3cmFwcGVyKCkoKS5pbkZhbGxiYWNrKSk7XG4gIH1cbiAgY29uc3QgcmVzb2x2ZWQgPSBjcmVhdGVNZW1vKHByZXYgPT4ge1xuICAgIGNvbnN0IHJldmVhbCA9IHByb3BzLnJldmVhbE9yZGVyLFxuICAgICAgdGFpbCA9IHByb3BzLnRhaWwsXG4gICAgICB7XG4gICAgICAgIHNob3dDb250ZW50ID0gdHJ1ZSxcbiAgICAgICAgc2hvd0ZhbGxiYWNrID0gdHJ1ZVxuICAgICAgfSA9IHNob3cgPyBzaG93KCkgOiB7fSxcbiAgICAgIHJlZyA9IHJlZ2lzdHJ5KCksXG4gICAgICByZXZlcnNlID0gcmV2ZWFsID09PSBcImJhY2t3YXJkc1wiO1xuICAgIGlmIChyZXZlYWwgPT09IFwidG9nZXRoZXJcIikge1xuICAgICAgY29uc3QgYWxsID0gcmVnLmV2ZXJ5KGluRmFsbGJhY2sgPT4gIWluRmFsbGJhY2soKSk7XG4gICAgICBjb25zdCByZXMgPSByZWcubWFwKCgpID0+ICh7XG4gICAgICAgIHNob3dDb250ZW50OiBhbGwgJiYgc2hvd0NvbnRlbnQsXG4gICAgICAgIHNob3dGYWxsYmFja1xuICAgICAgfSkpO1xuICAgICAgcmVzLmluRmFsbGJhY2sgPSAhYWxsO1xuICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG4gICAgbGV0IHN0b3AgPSBmYWxzZTtcbiAgICBsZXQgaW5GYWxsYmFjayA9IHByZXYuaW5GYWxsYmFjaztcbiAgICBjb25zdCByZXMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcmVnLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBjb25zdCBuID0gcmV2ZXJzZSA/IGxlbiAtIGkgLSAxIDogaSxcbiAgICAgICAgcyA9IHJlZ1tuXSgpO1xuICAgICAgaWYgKCFzdG9wICYmICFzKSB7XG4gICAgICAgIHJlc1tuXSA9IHtcbiAgICAgICAgICBzaG93Q29udGVudCxcbiAgICAgICAgICBzaG93RmFsbGJhY2tcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5leHQgPSAhc3RvcDtcbiAgICAgICAgaWYgKG5leHQpIGluRmFsbGJhY2sgPSB0cnVlO1xuICAgICAgICByZXNbbl0gPSB7XG4gICAgICAgICAgc2hvd0NvbnRlbnQ6IG5leHQsXG4gICAgICAgICAgc2hvd0ZhbGxiYWNrOiAhdGFpbCB8fCBuZXh0ICYmIHRhaWwgPT09IFwiY29sbGFwc2VkXCIgPyBzaG93RmFsbGJhY2sgOiBmYWxzZVxuICAgICAgICB9O1xuICAgICAgICBzdG9wID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFzdG9wKSBpbkZhbGxiYWNrID0gZmFsc2U7XG4gICAgcmVzLmluRmFsbGJhY2sgPSBpbkZhbGxiYWNrO1xuICAgIHJldHVybiByZXM7XG4gIH0sIHtcbiAgICBpbkZhbGxiYWNrOiBmYWxzZVxuICB9KTtcbiAgc2V0V3JhcHBlcigoKSA9PiByZXNvbHZlZCk7XG4gIHJldHVybiBjcmVhdGVDb21wb25lbnQoU3VzcGVuc2VMaXN0Q29udGV4dC5Qcm92aWRlciwge1xuICAgIHZhbHVlOiB7XG4gICAgICByZWdpc3RlcjogaW5GYWxsYmFjayA9PiB7XG4gICAgICAgIGxldCBpbmRleDtcbiAgICAgICAgc2V0UmVnaXN0cnkocmVnaXN0cnkgPT4ge1xuICAgICAgICAgIGluZGV4ID0gcmVnaXN0cnkubGVuZ3RoO1xuICAgICAgICAgIHJldHVybiBbLi4ucmVnaXN0cnksIGluRmFsbGJhY2tdO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4gcmVzb2x2ZWQoKVtpbmRleF0sIHVuZGVmaW5lZCwge1xuICAgICAgICAgIGVxdWFsczogc3VzcGVuc2VMaXN0RXF1YWxzXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgZ2V0IGNoaWxkcmVuKCkge1xuICAgICAgcmV0dXJuIHByb3BzLmNoaWxkcmVuO1xuICAgIH1cbiAgfSk7XG59XG5mdW5jdGlvbiBTdXNwZW5zZShwcm9wcykge1xuICBsZXQgY291bnRlciA9IDAsXG4gICAgc2hvdyxcbiAgICBjdHgsXG4gICAgcCxcbiAgICBmbGlja2VyLFxuICAgIGVycm9yO1xuICBjb25zdCBbaW5GYWxsYmFjaywgc2V0RmFsbGJhY2tdID0gY3JlYXRlU2lnbmFsKGZhbHNlKSxcbiAgICBTdXNwZW5zZUNvbnRleHQgPSBnZXRTdXNwZW5zZUNvbnRleHQoKSxcbiAgICBzdG9yZSA9IHtcbiAgICAgIGluY3JlbWVudDogKCkgPT4ge1xuICAgICAgICBpZiAoKytjb3VudGVyID09PSAxKSBzZXRGYWxsYmFjayh0cnVlKTtcbiAgICAgIH0sXG4gICAgICBkZWNyZW1lbnQ6ICgpID0+IHtcbiAgICAgICAgaWYgKC0tY291bnRlciA9PT0gMCkgc2V0RmFsbGJhY2soZmFsc2UpO1xuICAgICAgfSxcbiAgICAgIGluRmFsbGJhY2ssXG4gICAgICBlZmZlY3RzOiBbXSxcbiAgICAgIHJlc29sdmVkOiBmYWxzZVxuICAgIH0sXG4gICAgb3duZXIgPSBnZXRPd25lcigpO1xuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgc2hhcmVkQ29uZmlnLmxvYWQpIHtcbiAgICBjb25zdCBrZXkgPSBzaGFyZWRDb25maWcuZ2V0Q29udGV4dElkKCk7XG4gICAgbGV0IHJlZiA9IHNoYXJlZENvbmZpZy5sb2FkKGtleSk7XG4gICAgaWYgKHJlZikge1xuICAgICAgaWYgKHR5cGVvZiByZWYgIT09IFwib2JqZWN0XCIgfHwgcmVmLnMgIT09IDEpIHAgPSByZWY7ZWxzZSBzaGFyZWRDb25maWcuZ2F0aGVyKGtleSk7XG4gICAgfVxuICAgIGlmIChwICYmIHAgIT09IFwiJCRmXCIpIHtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCwge1xuICAgICAgICBlcXVhbHM6IGZhbHNlXG4gICAgICB9KTtcbiAgICAgIGZsaWNrZXIgPSBzO1xuICAgICAgcC50aGVuKCgpID0+IHtcbiAgICAgICAgaWYgKHNoYXJlZENvbmZpZy5kb25lKSByZXR1cm4gc2V0KCk7XG4gICAgICAgIHNoYXJlZENvbmZpZy5nYXRoZXIoa2V5KTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoY3R4KTtcbiAgICAgICAgc2V0KCk7XG4gICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KCk7XG4gICAgICB9LCBlcnIgPT4ge1xuICAgICAgICBlcnJvciA9IGVycjtcbiAgICAgICAgc2V0KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgY29uc3QgbGlzdENvbnRleHQgPSB1c2VDb250ZXh0KFN1c3BlbnNlTGlzdENvbnRleHQpO1xuICBpZiAobGlzdENvbnRleHQpIHNob3cgPSBsaXN0Q29udGV4dC5yZWdpc3RlcihzdG9yZS5pbkZhbGxiYWNrKTtcbiAgbGV0IGRpc3Bvc2U7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlICYmIGRpc3Bvc2UoKSk7XG4gIHJldHVybiBjcmVhdGVDb21wb25lbnQoU3VzcGVuc2VDb250ZXh0LlByb3ZpZGVyLCB7XG4gICAgdmFsdWU6IHN0b3JlLFxuICAgIGdldCBjaGlsZHJlbigpIHtcbiAgICAgIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtcbiAgICAgICAgY3R4ID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICAgIGlmIChmbGlja2VyKSB7XG4gICAgICAgICAgZmxpY2tlcigpO1xuICAgICAgICAgIHJldHVybiBmbGlja2VyID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjdHggJiYgcCA9PT0gXCIkJGZcIikgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgICAgY29uc3QgcmVuZGVyZWQgPSBjcmVhdGVNZW1vKCgpID0+IHByb3BzLmNoaWxkcmVuKTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8ocHJldiA9PiB7XG4gICAgICAgICAgY29uc3QgaW5GYWxsYmFjayA9IHN0b3JlLmluRmFsbGJhY2soKSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc2hvd0NvbnRlbnQgPSB0cnVlLFxuICAgICAgICAgICAgICBzaG93RmFsbGJhY2sgPSB0cnVlXG4gICAgICAgICAgICB9ID0gc2hvdyA/IHNob3coKSA6IHt9O1xuICAgICAgICAgIGlmICgoIWluRmFsbGJhY2sgfHwgcCAmJiBwICE9PSBcIiQkZlwiKSAmJiBzaG93Q29udGVudCkge1xuICAgICAgICAgICAgc3RvcmUucmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgZGlzcG9zZSAmJiBkaXNwb3NlKCk7XG4gICAgICAgICAgICBkaXNwb3NlID0gY3R4ID0gcCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VtZUVmZmVjdHMoc3RvcmUuZWZmZWN0cyk7XG4gICAgICAgICAgICByZXR1cm4gcmVuZGVyZWQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFzaG93RmFsbGJhY2spIHJldHVybjtcbiAgICAgICAgICBpZiAoZGlzcG9zZSkgcmV0dXJuIHByZXY7XG4gICAgICAgICAgcmV0dXJuIGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZSA9IGRpc3Bvc2VyO1xuICAgICAgICAgICAgaWYgKGN0eCkge1xuICAgICAgICAgICAgICBzZXRIeWRyYXRlQ29udGV4dCh7XG4gICAgICAgICAgICAgICAgaWQ6IGN0eC5pZCArIFwiRlwiLFxuICAgICAgICAgICAgICAgIGNvdW50OiAwXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBjdHggPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcHJvcHMuZmFsbGJhY2s7XG4gICAgICAgICAgfSwgb3duZXIpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG59XG5cbmNvbnN0IERFViA9IHtcbiAgaG9va3M6IERldkhvb2tzLFxuICB3cml0ZVNpZ25hbCxcbiAgcmVnaXN0ZXJHcmFwaFxufSA7XG5pZiAoZ2xvYmFsVGhpcykge1xuICBpZiAoIWdsb2JhbFRoaXMuU29saWQkJCkgZ2xvYmFsVGhpcy5Tb2xpZCQkID0gdHJ1ZTtlbHNlIGNvbnNvbGUud2FybihcIllvdSBhcHBlYXIgdG8gaGF2ZSBtdWx0aXBsZSBpbnN0YW5jZXMgb2YgU29saWQuIFRoaXMgY2FuIGxlYWQgdG8gdW5leHBlY3RlZCBiZWhhdmlvci5cIik7XG59XG5cbmV4cG9ydCB7ICRERVZDT01QLCAkUFJPWFksICRUUkFDSywgREVWLCBFcnJvckJvdW5kYXJ5LCBGb3IsIEluZGV4LCBNYXRjaCwgU2hvdywgU3VzcGVuc2UsIFN1c3BlbnNlTGlzdCwgU3dpdGNoLCBiYXRjaCwgY2FuY2VsQ2FsbGJhY2ssIGNhdGNoRXJyb3IsIGNoaWxkcmVuLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZUNvbXB1dGVkLCBjcmVhdGVDb250ZXh0LCBjcmVhdGVEZWZlcnJlZCwgY3JlYXRlRWZmZWN0LCBjcmVhdGVNZW1vLCBjcmVhdGVSZWFjdGlvbiwgY3JlYXRlUmVuZGVyRWZmZWN0LCBjcmVhdGVSZXNvdXJjZSwgY3JlYXRlUm9vdCwgY3JlYXRlU2VsZWN0b3IsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlVW5pcXVlSWQsIGVuYWJsZUV4dGVybmFsU291cmNlLCBlbmFibGVIeWRyYXRpb24sIGVuYWJsZVNjaGVkdWxpbmcsIGVxdWFsRm4sIGZyb20sIGdldExpc3RlbmVyLCBnZXRPd25lciwgaW5kZXhBcnJheSwgbGF6eSwgbWFwQXJyYXksIG1lcmdlUHJvcHMsIG9ic2VydmFibGUsIG9uLCBvbkNsZWFudXAsIG9uRXJyb3IsIG9uTW91bnQsIHJlcXVlc3RDYWxsYmFjaywgcmVzZXRFcnJvckJvdW5kYXJpZXMsIHJ1bldpdGhPd25lciwgc2hhcmVkQ29uZmlnLCBzcGxpdFByb3BzLCBzdGFydFRyYW5zaXRpb24sIHVudHJhY2ssIHVzZUNvbnRleHQsIHVzZVRyYW5zaXRpb24gfTtcbiIsImltcG9ydCB7IGNyZWF0ZU1lbW8sIGNyZWF0ZVJvb3QsIGNyZWF0ZVJlbmRlckVmZmVjdCwgdW50cmFjaywgc2hhcmVkQ29uZmlnLCBlbmFibGVIeWRyYXRpb24sIGdldE93bmVyLCBjcmVhdGVFZmZlY3QsIHJ1bldpdGhPd25lciwgY3JlYXRlU2lnbmFsLCBvbkNsZWFudXAsICRERVZDT01QLCBzcGxpdFByb3BzIH0gZnJvbSAnc29saWQtanMnO1xuZXhwb3J0IHsgRXJyb3JCb3VuZGFyeSwgRm9yLCBJbmRleCwgTWF0Y2gsIFNob3csIFN1c3BlbnNlLCBTdXNwZW5zZUxpc3QsIFN3aXRjaCwgY3JlYXRlQ29tcG9uZW50LCBjcmVhdGVSZW5kZXJFZmZlY3QgYXMgZWZmZWN0LCBnZXRPd25lciwgbWVyZ2VQcm9wcywgdW50cmFjayB9IGZyb20gJ3NvbGlkLWpzJztcblxuY29uc3QgYm9vbGVhbnMgPSBbXCJhbGxvd2Z1bGxzY3JlZW5cIiwgXCJhc3luY1wiLCBcImF1dG9mb2N1c1wiLCBcImF1dG9wbGF5XCIsIFwiY2hlY2tlZFwiLCBcImNvbnRyb2xzXCIsIFwiZGVmYXVsdFwiLCBcImRpc2FibGVkXCIsIFwiZm9ybW5vdmFsaWRhdGVcIiwgXCJoaWRkZW5cIiwgXCJpbmRldGVybWluYXRlXCIsIFwiaW5lcnRcIiwgXCJpc21hcFwiLCBcImxvb3BcIiwgXCJtdWx0aXBsZVwiLCBcIm11dGVkXCIsIFwibm9tb2R1bGVcIiwgXCJub3ZhbGlkYXRlXCIsIFwib3BlblwiLCBcInBsYXlzaW5saW5lXCIsIFwicmVhZG9ubHlcIiwgXCJyZXF1aXJlZFwiLCBcInJldmVyc2VkXCIsIFwic2VhbWxlc3NcIiwgXCJzZWxlY3RlZFwiXTtcbmNvbnN0IFByb3BlcnRpZXMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJjbGFzc05hbWVcIiwgXCJ2YWx1ZVwiLCBcInJlYWRPbmx5XCIsIFwibm9WYWxpZGF0ZVwiLCBcImZvcm1Ob1ZhbGlkYXRlXCIsIFwiaXNNYXBcIiwgXCJub01vZHVsZVwiLCBcInBsYXlzSW5saW5lXCIsIC4uLmJvb2xlYW5zXSk7XG5jb25zdCBDaGlsZFByb3BlcnRpZXMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJpbm5lckhUTUxcIiwgXCJ0ZXh0Q29udGVudFwiLCBcImlubmVyVGV4dFwiLCBcImNoaWxkcmVuXCJdKTtcbmNvbnN0IEFsaWFzZXMgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmFzc2lnbihPYmplY3QuY3JlYXRlKG51bGwpLCB7XG4gIGNsYXNzTmFtZTogXCJjbGFzc1wiLFxuICBodG1sRm9yOiBcImZvclwiXG59KTtcbmNvbnN0IFByb3BBbGlhc2VzID0gLyojX19QVVJFX18qL09iamVjdC5hc3NpZ24oT2JqZWN0LmNyZWF0ZShudWxsKSwge1xuICBjbGFzczogXCJjbGFzc05hbWVcIixcbiAgbm92YWxpZGF0ZToge1xuICAgICQ6IFwibm9WYWxpZGF0ZVwiLFxuICAgIEZPUk06IDFcbiAgfSxcbiAgZm9ybW5vdmFsaWRhdGU6IHtcbiAgICAkOiBcImZvcm1Ob1ZhbGlkYXRlXCIsXG4gICAgQlVUVE9OOiAxLFxuICAgIElOUFVUOiAxXG4gIH0sXG4gIGlzbWFwOiB7XG4gICAgJDogXCJpc01hcFwiLFxuICAgIElNRzogMVxuICB9LFxuICBub21vZHVsZToge1xuICAgICQ6IFwibm9Nb2R1bGVcIixcbiAgICBTQ1JJUFQ6IDFcbiAgfSxcbiAgcGxheXNpbmxpbmU6IHtcbiAgICAkOiBcInBsYXlzSW5saW5lXCIsXG4gICAgVklERU86IDFcbiAgfSxcbiAgcmVhZG9ubHk6IHtcbiAgICAkOiBcInJlYWRPbmx5XCIsXG4gICAgSU5QVVQ6IDEsXG4gICAgVEVYVEFSRUE6IDFcbiAgfVxufSk7XG5mdW5jdGlvbiBnZXRQcm9wQWxpYXMocHJvcCwgdGFnTmFtZSkge1xuICBjb25zdCBhID0gUHJvcEFsaWFzZXNbcHJvcF07XG4gIHJldHVybiB0eXBlb2YgYSA9PT0gXCJvYmplY3RcIiA/IGFbdGFnTmFtZV0gPyBhW1wiJFwiXSA6IHVuZGVmaW5lZCA6IGE7XG59XG5jb25zdCBEZWxlZ2F0ZWRFdmVudHMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJiZWZvcmVpbnB1dFwiLCBcImNsaWNrXCIsIFwiZGJsY2xpY2tcIiwgXCJjb250ZXh0bWVudVwiLCBcImZvY3VzaW5cIiwgXCJmb2N1c291dFwiLCBcImlucHV0XCIsIFwia2V5ZG93blwiLCBcImtleXVwXCIsIFwibW91c2Vkb3duXCIsIFwibW91c2Vtb3ZlXCIsIFwibW91c2VvdXRcIiwgXCJtb3VzZW92ZXJcIiwgXCJtb3VzZXVwXCIsIFwicG9pbnRlcmRvd25cIiwgXCJwb2ludGVybW92ZVwiLCBcInBvaW50ZXJvdXRcIiwgXCJwb2ludGVyb3ZlclwiLCBcInBvaW50ZXJ1cFwiLCBcInRvdWNoZW5kXCIsIFwidG91Y2htb3ZlXCIsIFwidG91Y2hzdGFydFwiXSk7XG5jb25zdCBTVkdFbGVtZW50cyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcblwiYWx0R2x5cGhcIiwgXCJhbHRHbHlwaERlZlwiLCBcImFsdEdseXBoSXRlbVwiLCBcImFuaW1hdGVcIiwgXCJhbmltYXRlQ29sb3JcIiwgXCJhbmltYXRlTW90aW9uXCIsIFwiYW5pbWF0ZVRyYW5zZm9ybVwiLCBcImNpcmNsZVwiLCBcImNsaXBQYXRoXCIsIFwiY29sb3ItcHJvZmlsZVwiLCBcImN1cnNvclwiLCBcImRlZnNcIiwgXCJkZXNjXCIsIFwiZWxsaXBzZVwiLCBcImZlQmxlbmRcIiwgXCJmZUNvbG9yTWF0cml4XCIsIFwiZmVDb21wb25lbnRUcmFuc2ZlclwiLCBcImZlQ29tcG9zaXRlXCIsIFwiZmVDb252b2x2ZU1hdHJpeFwiLCBcImZlRGlmZnVzZUxpZ2h0aW5nXCIsIFwiZmVEaXNwbGFjZW1lbnRNYXBcIiwgXCJmZURpc3RhbnRMaWdodFwiLCBcImZlRHJvcFNoYWRvd1wiLCBcImZlRmxvb2RcIiwgXCJmZUZ1bmNBXCIsIFwiZmVGdW5jQlwiLCBcImZlRnVuY0dcIiwgXCJmZUZ1bmNSXCIsIFwiZmVHYXVzc2lhbkJsdXJcIiwgXCJmZUltYWdlXCIsIFwiZmVNZXJnZVwiLCBcImZlTWVyZ2VOb2RlXCIsIFwiZmVNb3JwaG9sb2d5XCIsIFwiZmVPZmZzZXRcIiwgXCJmZVBvaW50TGlnaHRcIiwgXCJmZVNwZWN1bGFyTGlnaHRpbmdcIiwgXCJmZVNwb3RMaWdodFwiLCBcImZlVGlsZVwiLCBcImZlVHVyYnVsZW5jZVwiLCBcImZpbHRlclwiLCBcImZvbnRcIiwgXCJmb250LWZhY2VcIiwgXCJmb250LWZhY2UtZm9ybWF0XCIsIFwiZm9udC1mYWNlLW5hbWVcIiwgXCJmb250LWZhY2Utc3JjXCIsIFwiZm9udC1mYWNlLXVyaVwiLCBcImZvcmVpZ25PYmplY3RcIiwgXCJnXCIsIFwiZ2x5cGhcIiwgXCJnbHlwaFJlZlwiLCBcImhrZXJuXCIsIFwiaW1hZ2VcIiwgXCJsaW5lXCIsIFwibGluZWFyR3JhZGllbnRcIiwgXCJtYXJrZXJcIiwgXCJtYXNrXCIsIFwibWV0YWRhdGFcIiwgXCJtaXNzaW5nLWdseXBoXCIsIFwibXBhdGhcIiwgXCJwYXRoXCIsIFwicGF0dGVyblwiLCBcInBvbHlnb25cIiwgXCJwb2x5bGluZVwiLCBcInJhZGlhbEdyYWRpZW50XCIsIFwicmVjdFwiLFxuXCJzZXRcIiwgXCJzdG9wXCIsXG5cInN2Z1wiLCBcInN3aXRjaFwiLCBcInN5bWJvbFwiLCBcInRleHRcIiwgXCJ0ZXh0UGF0aFwiLFxuXCJ0cmVmXCIsIFwidHNwYW5cIiwgXCJ1c2VcIiwgXCJ2aWV3XCIsIFwidmtlcm5cIl0pO1xuY29uc3QgU1ZHTmFtZXNwYWNlID0ge1xuICB4bGluazogXCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCIsXG4gIHhtbDogXCJodHRwOi8vd3d3LnczLm9yZy9YTUwvMTk5OC9uYW1lc3BhY2VcIlxufTtcbmNvbnN0IERPTUVsZW1lbnRzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1wiaHRtbFwiLCBcImJhc2VcIiwgXCJoZWFkXCIsIFwibGlua1wiLCBcIm1ldGFcIiwgXCJzdHlsZVwiLCBcInRpdGxlXCIsIFwiYm9keVwiLCBcImFkZHJlc3NcIiwgXCJhcnRpY2xlXCIsIFwiYXNpZGVcIiwgXCJmb290ZXJcIiwgXCJoZWFkZXJcIiwgXCJtYWluXCIsIFwibmF2XCIsIFwic2VjdGlvblwiLCBcImJvZHlcIiwgXCJibG9ja3F1b3RlXCIsIFwiZGRcIiwgXCJkaXZcIiwgXCJkbFwiLCBcImR0XCIsIFwiZmlnY2FwdGlvblwiLCBcImZpZ3VyZVwiLCBcImhyXCIsIFwibGlcIiwgXCJvbFwiLCBcInBcIiwgXCJwcmVcIiwgXCJ1bFwiLCBcImFcIiwgXCJhYmJyXCIsIFwiYlwiLCBcImJkaVwiLCBcImJkb1wiLCBcImJyXCIsIFwiY2l0ZVwiLCBcImNvZGVcIiwgXCJkYXRhXCIsIFwiZGZuXCIsIFwiZW1cIiwgXCJpXCIsIFwia2JkXCIsIFwibWFya1wiLCBcInFcIiwgXCJycFwiLCBcInJ0XCIsIFwicnVieVwiLCBcInNcIiwgXCJzYW1wXCIsIFwic21hbGxcIiwgXCJzcGFuXCIsIFwic3Ryb25nXCIsIFwic3ViXCIsIFwic3VwXCIsIFwidGltZVwiLCBcInVcIiwgXCJ2YXJcIiwgXCJ3YnJcIiwgXCJhcmVhXCIsIFwiYXVkaW9cIiwgXCJpbWdcIiwgXCJtYXBcIiwgXCJ0cmFja1wiLCBcInZpZGVvXCIsIFwiZW1iZWRcIiwgXCJpZnJhbWVcIiwgXCJvYmplY3RcIiwgXCJwYXJhbVwiLCBcInBpY3R1cmVcIiwgXCJwb3J0YWxcIiwgXCJzb3VyY2VcIiwgXCJzdmdcIiwgXCJtYXRoXCIsIFwiY2FudmFzXCIsIFwibm9zY3JpcHRcIiwgXCJzY3JpcHRcIiwgXCJkZWxcIiwgXCJpbnNcIiwgXCJjYXB0aW9uXCIsIFwiY29sXCIsIFwiY29sZ3JvdXBcIiwgXCJ0YWJsZVwiLCBcInRib2R5XCIsIFwidGRcIiwgXCJ0Zm9vdFwiLCBcInRoXCIsIFwidGhlYWRcIiwgXCJ0clwiLCBcImJ1dHRvblwiLCBcImRhdGFsaXN0XCIsIFwiZmllbGRzZXRcIiwgXCJmb3JtXCIsIFwiaW5wdXRcIiwgXCJsYWJlbFwiLCBcImxlZ2VuZFwiLCBcIm1ldGVyXCIsIFwib3B0Z3JvdXBcIiwgXCJvcHRpb25cIiwgXCJvdXRwdXRcIiwgXCJwcm9ncmVzc1wiLCBcInNlbGVjdFwiLCBcInRleHRhcmVhXCIsIFwiZGV0YWlsc1wiLCBcImRpYWxvZ1wiLCBcIm1lbnVcIiwgXCJzdW1tYXJ5XCIsIFwiZGV0YWlsc1wiLCBcInNsb3RcIiwgXCJ0ZW1wbGF0ZVwiLCBcImFjcm9ueW1cIiwgXCJhcHBsZXRcIiwgXCJiYXNlZm9udFwiLCBcImJnc291bmRcIiwgXCJiaWdcIiwgXCJibGlua1wiLCBcImNlbnRlclwiLCBcImNvbnRlbnRcIiwgXCJkaXJcIiwgXCJmb250XCIsIFwiZnJhbWVcIiwgXCJmcmFtZXNldFwiLCBcImhncm91cFwiLCBcImltYWdlXCIsIFwia2V5Z2VuXCIsIFwibWFycXVlZVwiLCBcIm1lbnVpdGVtXCIsIFwibm9iclwiLCBcIm5vZW1iZWRcIiwgXCJub2ZyYW1lc1wiLCBcInBsYWludGV4dFwiLCBcInJiXCIsIFwicnRjXCIsIFwic2hhZG93XCIsIFwic3BhY2VyXCIsIFwic3RyaWtlXCIsIFwidHRcIiwgXCJ4bXBcIiwgXCJhXCIsIFwiYWJiclwiLCBcImFjcm9ueW1cIiwgXCJhZGRyZXNzXCIsIFwiYXBwbGV0XCIsIFwiYXJlYVwiLCBcImFydGljbGVcIiwgXCJhc2lkZVwiLCBcImF1ZGlvXCIsIFwiYlwiLCBcImJhc2VcIiwgXCJiYXNlZm9udFwiLCBcImJkaVwiLCBcImJkb1wiLCBcImJnc291bmRcIiwgXCJiaWdcIiwgXCJibGlua1wiLCBcImJsb2NrcXVvdGVcIiwgXCJib2R5XCIsIFwiYnJcIiwgXCJidXR0b25cIiwgXCJjYW52YXNcIiwgXCJjYXB0aW9uXCIsIFwiY2VudGVyXCIsIFwiY2l0ZVwiLCBcImNvZGVcIiwgXCJjb2xcIiwgXCJjb2xncm91cFwiLCBcImNvbnRlbnRcIiwgXCJkYXRhXCIsIFwiZGF0YWxpc3RcIiwgXCJkZFwiLCBcImRlbFwiLCBcImRldGFpbHNcIiwgXCJkZm5cIiwgXCJkaWFsb2dcIiwgXCJkaXJcIiwgXCJkaXZcIiwgXCJkbFwiLCBcImR0XCIsIFwiZW1cIiwgXCJlbWJlZFwiLCBcImZpZWxkc2V0XCIsIFwiZmlnY2FwdGlvblwiLCBcImZpZ3VyZVwiLCBcImZvbnRcIiwgXCJmb290ZXJcIiwgXCJmb3JtXCIsIFwiZnJhbWVcIiwgXCJmcmFtZXNldFwiLCBcImhlYWRcIiwgXCJoZWFkZXJcIiwgXCJoZ3JvdXBcIiwgXCJoclwiLCBcImh0bWxcIiwgXCJpXCIsIFwiaWZyYW1lXCIsIFwiaW1hZ2VcIiwgXCJpbWdcIiwgXCJpbnB1dFwiLCBcImluc1wiLCBcImtiZFwiLCBcImtleWdlblwiLCBcImxhYmVsXCIsIFwibGVnZW5kXCIsIFwibGlcIiwgXCJsaW5rXCIsIFwibWFpblwiLCBcIm1hcFwiLCBcIm1hcmtcIiwgXCJtYXJxdWVlXCIsIFwibWVudVwiLCBcIm1lbnVpdGVtXCIsIFwibWV0YVwiLCBcIm1ldGVyXCIsIFwibmF2XCIsIFwibm9iclwiLCBcIm5vZW1iZWRcIiwgXCJub2ZyYW1lc1wiLCBcIm5vc2NyaXB0XCIsIFwib2JqZWN0XCIsIFwib2xcIiwgXCJvcHRncm91cFwiLCBcIm9wdGlvblwiLCBcIm91dHB1dFwiLCBcInBcIiwgXCJwYXJhbVwiLCBcInBpY3R1cmVcIiwgXCJwbGFpbnRleHRcIiwgXCJwb3J0YWxcIiwgXCJwcmVcIiwgXCJwcm9ncmVzc1wiLCBcInFcIiwgXCJyYlwiLCBcInJwXCIsIFwicnRcIiwgXCJydGNcIiwgXCJydWJ5XCIsIFwic1wiLCBcInNhbXBcIiwgXCJzY3JpcHRcIiwgXCJzZWN0aW9uXCIsIFwic2VsZWN0XCIsIFwic2hhZG93XCIsIFwic2xvdFwiLCBcInNtYWxsXCIsIFwic291cmNlXCIsIFwic3BhY2VyXCIsIFwic3BhblwiLCBcInN0cmlrZVwiLCBcInN0cm9uZ1wiLCBcInN0eWxlXCIsIFwic3ViXCIsIFwic3VtbWFyeVwiLCBcInN1cFwiLCBcInRhYmxlXCIsIFwidGJvZHlcIiwgXCJ0ZFwiLCBcInRlbXBsYXRlXCIsIFwidGV4dGFyZWFcIiwgXCJ0Zm9vdFwiLCBcInRoXCIsIFwidGhlYWRcIiwgXCJ0aW1lXCIsIFwidGl0bGVcIiwgXCJ0clwiLCBcInRyYWNrXCIsIFwidHRcIiwgXCJ1XCIsIFwidWxcIiwgXCJ2YXJcIiwgXCJ2aWRlb1wiLCBcIndiclwiLCBcInhtcFwiLCBcImlucHV0XCIsIFwiaDFcIiwgXCJoMlwiLCBcImgzXCIsIFwiaDRcIiwgXCJoNVwiLCBcImg2XCJdKTtcblxuY29uc3QgbWVtbyA9IGZuID0+IGNyZWF0ZU1lbW8oKCkgPT4gZm4oKSk7XG5cbmZ1bmN0aW9uIHJlY29uY2lsZUFycmF5cyhwYXJlbnROb2RlLCBhLCBiKSB7XG4gIGxldCBiTGVuZ3RoID0gYi5sZW5ndGgsXG4gICAgYUVuZCA9IGEubGVuZ3RoLFxuICAgIGJFbmQgPSBiTGVuZ3RoLFxuICAgIGFTdGFydCA9IDAsXG4gICAgYlN0YXJ0ID0gMCxcbiAgICBhZnRlciA9IGFbYUVuZCAtIDFdLm5leHRTaWJsaW5nLFxuICAgIG1hcCA9IG51bGw7XG4gIHdoaWxlIChhU3RhcnQgPCBhRW5kIHx8IGJTdGFydCA8IGJFbmQpIHtcbiAgICBpZiAoYVthU3RhcnRdID09PSBiW2JTdGFydF0pIHtcbiAgICAgIGFTdGFydCsrO1xuICAgICAgYlN0YXJ0Kys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgd2hpbGUgKGFbYUVuZCAtIDFdID09PSBiW2JFbmQgLSAxXSkge1xuICAgICAgYUVuZC0tO1xuICAgICAgYkVuZC0tO1xuICAgIH1cbiAgICBpZiAoYUVuZCA9PT0gYVN0YXJ0KSB7XG4gICAgICBjb25zdCBub2RlID0gYkVuZCA8IGJMZW5ndGggPyBiU3RhcnQgPyBiW2JTdGFydCAtIDFdLm5leHRTaWJsaW5nIDogYltiRW5kIC0gYlN0YXJ0XSA6IGFmdGVyO1xuICAgICAgd2hpbGUgKGJTdGFydCA8IGJFbmQpIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKGJFbmQgPT09IGJTdGFydCkge1xuICAgICAgd2hpbGUgKGFTdGFydCA8IGFFbmQpIHtcbiAgICAgICAgaWYgKCFtYXAgfHwgIW1hcC5oYXMoYVthU3RhcnRdKSkgYVthU3RhcnRdLnJlbW92ZSgpO1xuICAgICAgICBhU3RhcnQrKztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGFbYVN0YXJ0XSA9PT0gYltiRW5kIC0gMV0gJiYgYltiU3RhcnRdID09PSBhW2FFbmQgLSAxXSkge1xuICAgICAgY29uc3Qgbm9kZSA9IGFbLS1hRW5kXS5uZXh0U2libGluZztcbiAgICAgIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBhW2FTdGFydCsrXS5uZXh0U2libGluZyk7XG4gICAgICBwYXJlbnROb2RlLmluc2VydEJlZm9yZShiWy0tYkVuZF0sIG5vZGUpO1xuICAgICAgYVthRW5kXSA9IGJbYkVuZF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghbWFwKSB7XG4gICAgICAgIG1hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgbGV0IGkgPSBiU3RhcnQ7XG4gICAgICAgIHdoaWxlIChpIDwgYkVuZCkgbWFwLnNldChiW2ldLCBpKyspO1xuICAgICAgfVxuICAgICAgY29uc3QgaW5kZXggPSBtYXAuZ2V0KGFbYVN0YXJ0XSk7XG4gICAgICBpZiAoaW5kZXggIT0gbnVsbCkge1xuICAgICAgICBpZiAoYlN0YXJ0IDwgaW5kZXggJiYgaW5kZXggPCBiRW5kKSB7XG4gICAgICAgICAgbGV0IGkgPSBhU3RhcnQsXG4gICAgICAgICAgICBzZXF1ZW5jZSA9IDEsXG4gICAgICAgICAgICB0O1xuICAgICAgICAgIHdoaWxlICgrK2kgPCBhRW5kICYmIGkgPCBiRW5kKSB7XG4gICAgICAgICAgICBpZiAoKHQgPSBtYXAuZ2V0KGFbaV0pKSA9PSBudWxsIHx8IHQgIT09IGluZGV4ICsgc2VxdWVuY2UpIGJyZWFrO1xuICAgICAgICAgICAgc2VxdWVuY2UrKztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNlcXVlbmNlID4gaW5kZXggLSBiU3RhcnQpIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBhW2FTdGFydF07XG4gICAgICAgICAgICB3aGlsZSAoYlN0YXJ0IDwgaW5kZXgpIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBub2RlKTtcbiAgICAgICAgICB9IGVsc2UgcGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoYltiU3RhcnQrK10sIGFbYVN0YXJ0KytdKTtcbiAgICAgICAgfSBlbHNlIGFTdGFydCsrO1xuICAgICAgfSBlbHNlIGFbYVN0YXJ0KytdLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxufVxuXG5jb25zdCAkJEVWRU5UUyA9IFwiXyREWF9ERUxFR0FURVwiO1xuZnVuY3Rpb24gcmVuZGVyKGNvZGUsIGVsZW1lbnQsIGluaXQsIG9wdGlvbnMgPSB7fSkge1xuICBpZiAoIWVsZW1lbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYGVsZW1lbnRgIHBhc3NlZCB0byBgcmVuZGVyKC4uLiwgZWxlbWVudClgIGRvZXNuJ3QgZXhpc3QuIE1ha2Ugc3VyZSBgZWxlbWVudGAgZXhpc3RzIGluIHRoZSBkb2N1bWVudC5cIik7XG4gIH1cbiAgbGV0IGRpc3Bvc2VyO1xuICBjcmVhdGVSb290KGRpc3Bvc2UgPT4ge1xuICAgIGRpc3Bvc2VyID0gZGlzcG9zZTtcbiAgICBlbGVtZW50ID09PSBkb2N1bWVudCA/IGNvZGUoKSA6IGluc2VydChlbGVtZW50LCBjb2RlKCksIGVsZW1lbnQuZmlyc3RDaGlsZCA/IG51bGwgOiB1bmRlZmluZWQsIGluaXQpO1xuICB9LCBvcHRpb25zLm93bmVyKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBkaXNwb3NlcigpO1xuICAgIGVsZW1lbnQudGV4dENvbnRlbnQgPSBcIlwiO1xuICB9O1xufVxuZnVuY3Rpb24gdGVtcGxhdGUoaHRtbCwgaXNJbXBvcnROb2RlLCBpc1NWRywgaXNNYXRoTUwpIHtcbiAgbGV0IG5vZGU7XG4gIGNvbnN0IGNyZWF0ZSA9ICgpID0+IHtcbiAgICBpZiAoaXNIeWRyYXRpbmcoKSkgdGhyb3cgbmV3IEVycm9yKFwiRmFpbGVkIGF0dGVtcHQgdG8gY3JlYXRlIG5ldyBET00gZWxlbWVudHMgZHVyaW5nIGh5ZHJhdGlvbi4gQ2hlY2sgdGhhdCB0aGUgbGlicmFyaWVzIHlvdSBhcmUgdXNpbmcgc3VwcG9ydCBoeWRyYXRpb24uXCIpO1xuICAgIGNvbnN0IHQgPSBpc01hdGhNTCA/IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzE5OTgvTWF0aC9NYXRoTUxcIiwgXCJ0ZW1wbGF0ZVwiKSA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiKTtcbiAgICB0LmlubmVySFRNTCA9IGh0bWw7XG4gICAgcmV0dXJuIGlzU1ZHID8gdC5jb250ZW50LmZpcnN0Q2hpbGQuZmlyc3RDaGlsZCA6IGlzTWF0aE1MID8gdC5maXJzdENoaWxkIDogdC5jb250ZW50LmZpcnN0Q2hpbGQ7XG4gIH07XG4gIGNvbnN0IGZuID0gaXNJbXBvcnROb2RlID8gKCkgPT4gdW50cmFjaygoKSA9PiBkb2N1bWVudC5pbXBvcnROb2RlKG5vZGUgfHwgKG5vZGUgPSBjcmVhdGUoKSksIHRydWUpKSA6ICgpID0+IChub2RlIHx8IChub2RlID0gY3JlYXRlKCkpKS5jbG9uZU5vZGUodHJ1ZSk7XG4gIGZuLmNsb25lTm9kZSA9IGZuO1xuICByZXR1cm4gZm47XG59XG5mdW5jdGlvbiBkZWxlZ2F0ZUV2ZW50cyhldmVudE5hbWVzLCBkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudCkge1xuICBjb25zdCBlID0gZG9jdW1lbnRbJCRFVkVOVFNdIHx8IChkb2N1bWVudFskJEVWRU5UU10gPSBuZXcgU2V0KCkpO1xuICBmb3IgKGxldCBpID0gMCwgbCA9IGV2ZW50TmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgY29uc3QgbmFtZSA9IGV2ZW50TmFtZXNbaV07XG4gICAgaWYgKCFlLmhhcyhuYW1lKSkge1xuICAgICAgZS5hZGQobmFtZSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50SGFuZGxlcik7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBjbGVhckRlbGVnYXRlZEV2ZW50cyhkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudCkge1xuICBpZiAoZG9jdW1lbnRbJCRFVkVOVFNdKSB7XG4gICAgZm9yIChsZXQgbmFtZSBvZiBkb2N1bWVudFskJEVWRU5UU10ua2V5cygpKSBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50SGFuZGxlcik7XG4gICAgZGVsZXRlIGRvY3VtZW50WyQkRVZFTlRTXTtcbiAgfVxufVxuZnVuY3Rpb24gc2V0UHJvcGVydHkobm9kZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIG5vZGVbbmFtZV0gPSB2YWx1ZTtcbn1cbmZ1bmN0aW9uIHNldEF0dHJpYnV0ZShub2RlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlKG5hbWUpO2Vsc2Ugbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xufVxuZnVuY3Rpb24gc2V0QXR0cmlidXRlTlMobm9kZSwgbmFtZXNwYWNlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlTlMobmFtZXNwYWNlLCBuYW1lKTtlbHNlIG5vZGUuc2V0QXR0cmlidXRlTlMobmFtZXNwYWNlLCBuYW1lLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBzZXRCb29sQXR0cmlidXRlKG5vZGUsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICB2YWx1ZSA/IG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsIFwiXCIpIDogbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7XG59XG5mdW5jdGlvbiBjbGFzc05hbWUobm9kZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIGlmICh2YWx1ZSA9PSBudWxsKSBub2RlLnJlbW92ZUF0dHJpYnV0ZShcImNsYXNzXCIpO2Vsc2Ugbm9kZS5jbGFzc05hbWUgPSB2YWx1ZTtcbn1cbmZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXIobm9kZSwgbmFtZSwgaGFuZGxlciwgZGVsZWdhdGUpIHtcbiAgaWYgKGRlbGVnYXRlKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoaGFuZGxlcikpIHtcbiAgICAgIG5vZGVbYCQkJHtuYW1lfWBdID0gaGFuZGxlclswXTtcbiAgICAgIG5vZGVbYCQkJHtuYW1lfURhdGFgXSA9IGhhbmRsZXJbMV07XG4gICAgfSBlbHNlIG5vZGVbYCQkJHtuYW1lfWBdID0gaGFuZGxlcjtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGhhbmRsZXIpKSB7XG4gICAgY29uc3QgaGFuZGxlckZuID0gaGFuZGxlclswXTtcbiAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgaGFuZGxlclswXSA9IGUgPT4gaGFuZGxlckZuLmNhbGwobm9kZSwgaGFuZGxlclsxXSwgZSkpO1xuICB9IGVsc2Ugbm9kZS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGhhbmRsZXIsIHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIgJiYgaGFuZGxlcik7XG59XG5mdW5jdGlvbiBjbGFzc0xpc3Qobm9kZSwgdmFsdWUsIHByZXYgPSB7fSkge1xuICBjb25zdCBjbGFzc0tleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSB8fCB7fSksXG4gICAgcHJldktleXMgPSBPYmplY3Qua2V5cyhwcmV2KTtcbiAgbGV0IGksIGxlbjtcbiAgZm9yIChpID0gMCwgbGVuID0gcHJldktleXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBwcmV2S2V5c1tpXTtcbiAgICBpZiAoIWtleSB8fCBrZXkgPT09IFwidW5kZWZpbmVkXCIgfHwgdmFsdWVba2V5XSkgY29udGludWU7XG4gICAgdG9nZ2xlQ2xhc3NLZXkobm9kZSwga2V5LCBmYWxzZSk7XG4gICAgZGVsZXRlIHByZXZba2V5XTtcbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBjbGFzc0tleXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBjbGFzc0tleXNbaV0sXG4gICAgICBjbGFzc1ZhbHVlID0gISF2YWx1ZVtrZXldO1xuICAgIGlmICgha2V5IHx8IGtleSA9PT0gXCJ1bmRlZmluZWRcIiB8fCBwcmV2W2tleV0gPT09IGNsYXNzVmFsdWUgfHwgIWNsYXNzVmFsdWUpIGNvbnRpbnVlO1xuICAgIHRvZ2dsZUNsYXNzS2V5KG5vZGUsIGtleSwgdHJ1ZSk7XG4gICAgcHJldltrZXldID0gY2xhc3NWYWx1ZTtcbiAgfVxuICByZXR1cm4gcHJldjtcbn1cbmZ1bmN0aW9uIHN0eWxlKG5vZGUsIHZhbHVlLCBwcmV2KSB7XG4gIGlmICghdmFsdWUpIHJldHVybiBwcmV2ID8gc2V0QXR0cmlidXRlKG5vZGUsIFwic3R5bGVcIikgOiB2YWx1ZTtcbiAgY29uc3Qgbm9kZVN0eWxlID0gbm9kZS5zdHlsZTtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIG5vZGVTdHlsZS5jc3NUZXh0ID0gdmFsdWU7XG4gIHR5cGVvZiBwcmV2ID09PSBcInN0cmluZ1wiICYmIChub2RlU3R5bGUuY3NzVGV4dCA9IHByZXYgPSB1bmRlZmluZWQpO1xuICBwcmV2IHx8IChwcmV2ID0ge30pO1xuICB2YWx1ZSB8fCAodmFsdWUgPSB7fSk7XG4gIGxldCB2LCBzO1xuICBmb3IgKHMgaW4gcHJldikge1xuICAgIHZhbHVlW3NdID09IG51bGwgJiYgbm9kZVN0eWxlLnJlbW92ZVByb3BlcnR5KHMpO1xuICAgIGRlbGV0ZSBwcmV2W3NdO1xuICB9XG4gIGZvciAocyBpbiB2YWx1ZSkge1xuICAgIHYgPSB2YWx1ZVtzXTtcbiAgICBpZiAodiAhPT0gcHJldltzXSkge1xuICAgICAgbm9kZVN0eWxlLnNldFByb3BlcnR5KHMsIHYpO1xuICAgICAgcHJldltzXSA9IHY7XG4gICAgfVxuICB9XG4gIHJldHVybiBwcmV2O1xufVxuZnVuY3Rpb24gc3ByZWFkKG5vZGUsIHByb3BzID0ge30sIGlzU1ZHLCBza2lwQ2hpbGRyZW4pIHtcbiAgY29uc3QgcHJldlByb3BzID0ge307XG4gIGlmICghc2tpcENoaWxkcmVuKSB7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHByZXZQcm9wcy5jaGlsZHJlbiA9IGluc2VydEV4cHJlc3Npb24obm9kZSwgcHJvcHMuY2hpbGRyZW4sIHByZXZQcm9wcy5jaGlsZHJlbikpO1xuICB9XG4gIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiB0eXBlb2YgcHJvcHMucmVmID09PSBcImZ1bmN0aW9uXCIgJiYgdXNlKHByb3BzLnJlZiwgbm9kZSkpO1xuICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gYXNzaWduKG5vZGUsIHByb3BzLCBpc1NWRywgdHJ1ZSwgcHJldlByb3BzLCB0cnVlKSk7XG4gIHJldHVybiBwcmV2UHJvcHM7XG59XG5mdW5jdGlvbiBkeW5hbWljUHJvcGVydHkocHJvcHMsIGtleSkge1xuICBjb25zdCBzcmMgPSBwcm9wc1trZXldO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvcHMsIGtleSwge1xuICAgIGdldCgpIHtcbiAgICAgIHJldHVybiBzcmMoKTtcbiAgICB9LFxuICAgIGVudW1lcmFibGU6IHRydWVcbiAgfSk7XG4gIHJldHVybiBwcm9wcztcbn1cbmZ1bmN0aW9uIHVzZShmbiwgZWxlbWVudCwgYXJnKSB7XG4gIHJldHVybiB1bnRyYWNrKCgpID0+IGZuKGVsZW1lbnQsIGFyZykpO1xufVxuZnVuY3Rpb24gaW5zZXJ0KHBhcmVudCwgYWNjZXNzb3IsIG1hcmtlciwgaW5pdGlhbCkge1xuICBpZiAobWFya2VyICE9PSB1bmRlZmluZWQgJiYgIWluaXRpYWwpIGluaXRpYWwgPSBbXTtcbiAgaWYgKHR5cGVvZiBhY2Nlc3NvciAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm4gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIGFjY2Vzc29yLCBpbml0aWFsLCBtYXJrZXIpO1xuICBjcmVhdGVSZW5kZXJFZmZlY3QoY3VycmVudCA9PiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgYWNjZXNzb3IoKSwgY3VycmVudCwgbWFya2VyKSwgaW5pdGlhbCk7XG59XG5mdW5jdGlvbiBhc3NpZ24obm9kZSwgcHJvcHMsIGlzU1ZHLCBza2lwQ2hpbGRyZW4sIHByZXZQcm9wcyA9IHt9LCBza2lwUmVmID0gZmFsc2UpIHtcbiAgcHJvcHMgfHwgKHByb3BzID0ge30pO1xuICBmb3IgKGNvbnN0IHByb3AgaW4gcHJldlByb3BzKSB7XG4gICAgaWYgKCEocHJvcCBpbiBwcm9wcykpIHtcbiAgICAgIGlmIChwcm9wID09PSBcImNoaWxkcmVuXCIpIGNvbnRpbnVlO1xuICAgICAgcHJldlByb3BzW3Byb3BdID0gYXNzaWduUHJvcChub2RlLCBwcm9wLCBudWxsLCBwcmV2UHJvcHNbcHJvcF0sIGlzU1ZHLCBza2lwUmVmLCBwcm9wcyk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgcHJvcCBpbiBwcm9wcykge1xuICAgIGlmIChwcm9wID09PSBcImNoaWxkcmVuXCIpIHtcbiAgICAgIGlmICghc2tpcENoaWxkcmVuKSBpbnNlcnRFeHByZXNzaW9uKG5vZGUsIHByb3BzLmNoaWxkcmVuKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZSA9IHByb3BzW3Byb3BdO1xuICAgIHByZXZQcm9wc1twcm9wXSA9IGFzc2lnblByb3Aobm9kZSwgcHJvcCwgdmFsdWUsIHByZXZQcm9wc1twcm9wXSwgaXNTVkcsIHNraXBSZWYsIHByb3BzKTtcbiAgfVxufVxuZnVuY3Rpb24gaHlkcmF0ZSQxKGNvZGUsIGVsZW1lbnQsIG9wdGlvbnMgPSB7fSkge1xuICBpZiAoZ2xvYmFsVGhpcy5fJEhZLmRvbmUpIHJldHVybiByZW5kZXIoY29kZSwgZWxlbWVudCwgWy4uLmVsZW1lbnQuY2hpbGROb2Rlc10sIG9wdGlvbnMpO1xuICBzaGFyZWRDb25maWcuY29tcGxldGVkID0gZ2xvYmFsVGhpcy5fJEhZLmNvbXBsZXRlZDtcbiAgc2hhcmVkQ29uZmlnLmV2ZW50cyA9IGdsb2JhbFRoaXMuXyRIWS5ldmVudHM7XG4gIHNoYXJlZENvbmZpZy5sb2FkID0gaWQgPT4gZ2xvYmFsVGhpcy5fJEhZLnJbaWRdO1xuICBzaGFyZWRDb25maWcuaGFzID0gaWQgPT4gaWQgaW4gZ2xvYmFsVGhpcy5fJEhZLnI7XG4gIHNoYXJlZENvbmZpZy5nYXRoZXIgPSByb290ID0+IGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgcm9vdCk7XG4gIHNoYXJlZENvbmZpZy5yZWdpc3RyeSA9IG5ldyBNYXAoKTtcbiAgc2hhcmVkQ29uZmlnLmNvbnRleHQgPSB7XG4gICAgaWQ6IG9wdGlvbnMucmVuZGVySWQgfHwgXCJcIixcbiAgICBjb3VudDogMFxuICB9O1xuICB0cnkge1xuICAgIGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgb3B0aW9ucy5yZW5kZXJJZCk7XG4gICAgcmV0dXJuIHJlbmRlcihjb2RlLCBlbGVtZW50LCBbLi4uZWxlbWVudC5jaGlsZE5vZGVzXSwgb3B0aW9ucyk7XG4gIH0gZmluYWxseSB7XG4gICAgc2hhcmVkQ29uZmlnLmNvbnRleHQgPSBudWxsO1xuICB9XG59XG5mdW5jdGlvbiBnZXROZXh0RWxlbWVudCh0ZW1wbGF0ZSkge1xuICBsZXQgbm9kZSxcbiAgICBrZXksXG4gICAgaHlkcmF0aW5nID0gaXNIeWRyYXRpbmcoKTtcbiAgaWYgKCFoeWRyYXRpbmcgfHwgIShub2RlID0gc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LmdldChrZXkgPSBnZXRIeWRyYXRpb25LZXkoKSkpKSB7XG4gICAgaWYgKGh5ZHJhdGluZykge1xuICAgICAgc2hhcmVkQ29uZmlnLmRvbmUgPSB0cnVlO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBIeWRyYXRpb24gTWlzbWF0Y2guIFVuYWJsZSB0byBmaW5kIERPTSBub2RlcyBmb3IgaHlkcmF0aW9uIGtleTogJHtrZXl9XFxuJHt0ZW1wbGF0ZSA/IHRlbXBsYXRlKCkub3V0ZXJIVE1MIDogXCJcIn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRlbXBsYXRlKCk7XG4gIH1cbiAgaWYgKHNoYXJlZENvbmZpZy5jb21wbGV0ZWQpIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQuYWRkKG5vZGUpO1xuICBzaGFyZWRDb25maWcucmVnaXN0cnkuZGVsZXRlKGtleSk7XG4gIHJldHVybiBub2RlO1xufVxuZnVuY3Rpb24gZ2V0TmV4dE1hdGNoKGVsLCBub2RlTmFtZSkge1xuICB3aGlsZSAoZWwgJiYgZWwubG9jYWxOYW1lICE9PSBub2RlTmFtZSkgZWwgPSBlbC5uZXh0U2libGluZztcbiAgcmV0dXJuIGVsO1xufVxuZnVuY3Rpb24gZ2V0TmV4dE1hcmtlcihzdGFydCkge1xuICBsZXQgZW5kID0gc3RhcnQsXG4gICAgY291bnQgPSAwLFxuICAgIGN1cnJlbnQgPSBbXTtcbiAgaWYgKGlzSHlkcmF0aW5nKHN0YXJ0KSkge1xuICAgIHdoaWxlIChlbmQpIHtcbiAgICAgIGlmIChlbmQubm9kZVR5cGUgPT09IDgpIHtcbiAgICAgICAgY29uc3QgdiA9IGVuZC5ub2RlVmFsdWU7XG4gICAgICAgIGlmICh2ID09PSBcIiRcIikgY291bnQrKztlbHNlIGlmICh2ID09PSBcIi9cIikge1xuICAgICAgICAgIGlmIChjb3VudCA9PT0gMCkgcmV0dXJuIFtlbmQsIGN1cnJlbnRdO1xuICAgICAgICAgIGNvdW50LS07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGN1cnJlbnQucHVzaChlbmQpO1xuICAgICAgZW5kID0gZW5kLm5leHRTaWJsaW5nO1xuICAgIH1cbiAgfVxuICByZXR1cm4gW2VuZCwgY3VycmVudF07XG59XG5mdW5jdGlvbiBydW5IeWRyYXRpb25FdmVudHMoKSB7XG4gIGlmIChzaGFyZWRDb25maWcuZXZlbnRzICYmICFzaGFyZWRDb25maWcuZXZlbnRzLnF1ZXVlZCkge1xuICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgY29tcGxldGVkLFxuICAgICAgICBldmVudHNcbiAgICAgIH0gPSBzaGFyZWRDb25maWc7XG4gICAgICBpZiAoIWV2ZW50cykgcmV0dXJuO1xuICAgICAgZXZlbnRzLnF1ZXVlZCA9IGZhbHNlO1xuICAgICAgd2hpbGUgKGV2ZW50cy5sZW5ndGgpIHtcbiAgICAgICAgY29uc3QgW2VsLCBlXSA9IGV2ZW50c1swXTtcbiAgICAgICAgaWYgKCFjb21wbGV0ZWQuaGFzKGVsKSkgcmV0dXJuO1xuICAgICAgICBldmVudHMuc2hpZnQoKTtcbiAgICAgICAgZXZlbnRIYW5kbGVyKGUpO1xuICAgICAgfVxuICAgICAgaWYgKHNoYXJlZENvbmZpZy5kb25lKSB7XG4gICAgICAgIHNoYXJlZENvbmZpZy5ldmVudHMgPSBfJEhZLmV2ZW50cyA9IG51bGw7XG4gICAgICAgIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQgPSBfJEhZLmNvbXBsZXRlZCA9IG51bGw7XG4gICAgICB9XG4gICAgfSk7XG4gICAgc2hhcmVkQ29uZmlnLmV2ZW50cy5xdWV1ZWQgPSB0cnVlO1xuICB9XG59XG5mdW5jdGlvbiBpc0h5ZHJhdGluZyhub2RlKSB7XG4gIHJldHVybiAhIXNoYXJlZENvbmZpZy5jb250ZXh0ICYmICFzaGFyZWRDb25maWcuZG9uZSAmJiAoIW5vZGUgfHwgbm9kZS5pc0Nvbm5lY3RlZCk7XG59XG5mdW5jdGlvbiB0b1Byb3BlcnR5TmFtZShuYW1lKSB7XG4gIHJldHVybiBuYW1lLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvLShbYS16XSkvZywgKF8sIHcpID0+IHcudG9VcHBlckNhc2UoKSk7XG59XG5mdW5jdGlvbiB0b2dnbGVDbGFzc0tleShub2RlLCBrZXksIHZhbHVlKSB7XG4gIGNvbnN0IGNsYXNzTmFtZXMgPSBrZXkudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gIGZvciAobGV0IGkgPSAwLCBuYW1lTGVuID0gY2xhc3NOYW1lcy5sZW5ndGg7IGkgPCBuYW1lTGVuOyBpKyspIG5vZGUuY2xhc3NMaXN0LnRvZ2dsZShjbGFzc05hbWVzW2ldLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBhc3NpZ25Qcm9wKG5vZGUsIHByb3AsIHZhbHVlLCBwcmV2LCBpc1NWRywgc2tpcFJlZiwgcHJvcHMpIHtcbiAgbGV0IGlzQ0UsIGlzUHJvcCwgaXNDaGlsZFByb3AsIHByb3BBbGlhcywgZm9yY2VQcm9wO1xuICBpZiAocHJvcCA9PT0gXCJzdHlsZVwiKSByZXR1cm4gc3R5bGUobm9kZSwgdmFsdWUsIHByZXYpO1xuICBpZiAocHJvcCA9PT0gXCJjbGFzc0xpc3RcIikgcmV0dXJuIGNsYXNzTGlzdChub2RlLCB2YWx1ZSwgcHJldik7XG4gIGlmICh2YWx1ZSA9PT0gcHJldikgcmV0dXJuIHByZXY7XG4gIGlmIChwcm9wID09PSBcInJlZlwiKSB7XG4gICAgaWYgKCFza2lwUmVmKSB2YWx1ZShub2RlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDMpID09PSBcIm9uOlwiKSB7XG4gICAgY29uc3QgZSA9IHByb3Auc2xpY2UoMyk7XG4gICAgcHJldiAmJiBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoZSwgcHJldiwgdHlwZW9mIHByZXYgIT09IFwiZnVuY3Rpb25cIiAmJiBwcmV2KTtcbiAgICB2YWx1ZSAmJiBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZSwgdmFsdWUsIHR5cGVvZiB2YWx1ZSAhPT0gXCJmdW5jdGlvblwiICYmIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDEwKSA9PT0gXCJvbmNhcHR1cmU6XCIpIHtcbiAgICBjb25zdCBlID0gcHJvcC5zbGljZSgxMCk7XG4gICAgcHJldiAmJiBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoZSwgcHJldiwgdHJ1ZSk7XG4gICAgdmFsdWUgJiYgbm9kZS5hZGRFdmVudExpc3RlbmVyKGUsIHZhbHVlLCB0cnVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDIpID09PSBcIm9uXCIpIHtcbiAgICBjb25zdCBuYW1lID0gcHJvcC5zbGljZSgyKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGRlbGVnYXRlID0gRGVsZWdhdGVkRXZlbnRzLmhhcyhuYW1lKTtcbiAgICBpZiAoIWRlbGVnYXRlICYmIHByZXYpIHtcbiAgICAgIGNvbnN0IGggPSBBcnJheS5pc0FycmF5KHByZXYpID8gcHJldlswXSA6IHByZXY7XG4gICAgICBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgaCk7XG4gICAgfVxuICAgIGlmIChkZWxlZ2F0ZSB8fCB2YWx1ZSkge1xuICAgICAgYWRkRXZlbnRMaXN0ZW5lcihub2RlLCBuYW1lLCB2YWx1ZSwgZGVsZWdhdGUpO1xuICAgICAgZGVsZWdhdGUgJiYgZGVsZWdhdGVFdmVudHMoW25hbWVdKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCA1KSA9PT0gXCJhdHRyOlwiKSB7XG4gICAgc2V0QXR0cmlidXRlKG5vZGUsIHByb3Auc2xpY2UoNSksIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDUpID09PSBcImJvb2w6XCIpIHtcbiAgICBzZXRCb29sQXR0cmlidXRlKG5vZGUsIHByb3Auc2xpY2UoNSksIHZhbHVlKTtcbiAgfSBlbHNlIGlmICgoZm9yY2VQcm9wID0gcHJvcC5zbGljZSgwLCA1KSA9PT0gXCJwcm9wOlwiKSB8fCAoaXNDaGlsZFByb3AgPSBDaGlsZFByb3BlcnRpZXMuaGFzKHByb3ApKSB8fCAhaXNTVkcgJiYgKChwcm9wQWxpYXMgPSBnZXRQcm9wQWxpYXMocHJvcCwgbm9kZS50YWdOYW1lKSkgfHwgKGlzUHJvcCA9IFByb3BlcnRpZXMuaGFzKHByb3ApKSkgfHwgKGlzQ0UgPSBub2RlLm5vZGVOYW1lLmluY2x1ZGVzKFwiLVwiKSB8fCBcImlzXCIgaW4gcHJvcHMpKSB7XG4gICAgaWYgKGZvcmNlUHJvcCkge1xuICAgICAgcHJvcCA9IHByb3Auc2xpY2UoNSk7XG4gICAgICBpc1Byb3AgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybiB2YWx1ZTtcbiAgICBpZiAocHJvcCA9PT0gXCJjbGFzc1wiIHx8IHByb3AgPT09IFwiY2xhc3NOYW1lXCIpIGNsYXNzTmFtZShub2RlLCB2YWx1ZSk7ZWxzZSBpZiAoaXNDRSAmJiAhaXNQcm9wICYmICFpc0NoaWxkUHJvcCkgbm9kZVt0b1Byb3BlcnR5TmFtZShwcm9wKV0gPSB2YWx1ZTtlbHNlIG5vZGVbcHJvcEFsaWFzIHx8IHByb3BdID0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgbnMgPSBpc1NWRyAmJiBwcm9wLmluZGV4T2YoXCI6XCIpID4gLTEgJiYgU1ZHTmFtZXNwYWNlW3Byb3Auc3BsaXQoXCI6XCIpWzBdXTtcbiAgICBpZiAobnMpIHNldEF0dHJpYnV0ZU5TKG5vZGUsIG5zLCBwcm9wLCB2YWx1ZSk7ZWxzZSBzZXRBdHRyaWJ1dGUobm9kZSwgQWxpYXNlc1twcm9wXSB8fCBwcm9wLCB2YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gZXZlbnRIYW5kbGVyKGUpIHtcbiAgaWYgKHNoYXJlZENvbmZpZy5yZWdpc3RyeSAmJiBzaGFyZWRDb25maWcuZXZlbnRzKSB7XG4gICAgaWYgKHNoYXJlZENvbmZpZy5ldmVudHMuZmluZCgoW2VsLCBldl0pID0+IGV2ID09PSBlKSkgcmV0dXJuO1xuICB9XG4gIGxldCBub2RlID0gZS50YXJnZXQ7XG4gIGNvbnN0IGtleSA9IGAkJCR7ZS50eXBlfWA7XG4gIGNvbnN0IG9yaVRhcmdldCA9IGUudGFyZ2V0O1xuICBjb25zdCBvcmlDdXJyZW50VGFyZ2V0ID0gZS5jdXJyZW50VGFyZ2V0O1xuICBjb25zdCByZXRhcmdldCA9IHZhbHVlID0+IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlLCBcInRhcmdldFwiLCB7XG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHZhbHVlXG4gIH0pO1xuICBjb25zdCBoYW5kbGVOb2RlID0gKCkgPT4ge1xuICAgIGNvbnN0IGhhbmRsZXIgPSBub2RlW2tleV07XG4gICAgaWYgKGhhbmRsZXIgJiYgIW5vZGUuZGlzYWJsZWQpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSBub2RlW2Ake2tleX1EYXRhYF07XG4gICAgICBkYXRhICE9PSB1bmRlZmluZWQgPyBoYW5kbGVyLmNhbGwobm9kZSwgZGF0YSwgZSkgOiBoYW5kbGVyLmNhbGwobm9kZSwgZSk7XG4gICAgICBpZiAoZS5jYW5jZWxCdWJibGUpIHJldHVybjtcbiAgICB9XG4gICAgbm9kZS5ob3N0ICYmIHR5cGVvZiBub2RlLmhvc3QgIT09IFwic3RyaW5nXCIgJiYgIW5vZGUuaG9zdC5fJGhvc3QgJiYgbm9kZS5jb250YWlucyhlLnRhcmdldCkgJiYgcmV0YXJnZXQobm9kZS5ob3N0KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbiAgY29uc3Qgd2Fsa1VwVHJlZSA9ICgpID0+IHtcbiAgICB3aGlsZSAoaGFuZGxlTm9kZSgpICYmIChub2RlID0gbm9kZS5fJGhvc3QgfHwgbm9kZS5wYXJlbnROb2RlIHx8IG5vZGUuaG9zdCkpO1xuICB9O1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZSwgXCJjdXJyZW50VGFyZ2V0XCIsIHtcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgZ2V0KCkge1xuICAgICAgcmV0dXJuIG5vZGUgfHwgZG9jdW1lbnQ7XG4gICAgfVxuICB9KTtcbiAgaWYgKHNoYXJlZENvbmZpZy5yZWdpc3RyeSAmJiAhc2hhcmVkQ29uZmlnLmRvbmUpIHNoYXJlZENvbmZpZy5kb25lID0gXyRIWS5kb25lID0gdHJ1ZTtcbiAgaWYgKGUuY29tcG9zZWRQYXRoKSB7XG4gICAgY29uc3QgcGF0aCA9IGUuY29tcG9zZWRQYXRoKCk7XG4gICAgcmV0YXJnZXQocGF0aFswXSk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXRoLmxlbmd0aCAtIDI7IGkrKykge1xuICAgICAgbm9kZSA9IHBhdGhbaV07XG4gICAgICBpZiAoIWhhbmRsZU5vZGUoKSkgYnJlYWs7XG4gICAgICBpZiAobm9kZS5fJGhvc3QpIHtcbiAgICAgICAgbm9kZSA9IG5vZGUuXyRob3N0O1xuICAgICAgICB3YWxrVXBUcmVlKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKG5vZGUucGFyZW50Tm9kZSA9PT0gb3JpQ3VycmVudFRhcmdldCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZWxzZSB3YWxrVXBUcmVlKCk7XG4gIHJldGFyZ2V0KG9yaVRhcmdldCk7XG59XG5mdW5jdGlvbiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgdmFsdWUsIGN1cnJlbnQsIG1hcmtlciwgdW53cmFwQXJyYXkpIHtcbiAgY29uc3QgaHlkcmF0aW5nID0gaXNIeWRyYXRpbmcocGFyZW50KTtcbiAgaWYgKGh5ZHJhdGluZykge1xuICAgICFjdXJyZW50ICYmIChjdXJyZW50ID0gWy4uLnBhcmVudC5jaGlsZE5vZGVzXSk7XG4gICAgbGV0IGNsZWFuZWQgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGN1cnJlbnQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBjdXJyZW50W2ldO1xuICAgICAgaWYgKG5vZGUubm9kZVR5cGUgPT09IDggJiYgbm9kZS5kYXRhLnNsaWNlKDAsIDIpID09PSBcIiEkXCIpIG5vZGUucmVtb3ZlKCk7ZWxzZSBjbGVhbmVkLnB1c2gobm9kZSk7XG4gICAgfVxuICAgIGN1cnJlbnQgPSBjbGVhbmVkO1xuICB9XG4gIHdoaWxlICh0eXBlb2YgY3VycmVudCA9PT0gXCJmdW5jdGlvblwiKSBjdXJyZW50ID0gY3VycmVudCgpO1xuICBpZiAodmFsdWUgPT09IGN1cnJlbnQpIHJldHVybiBjdXJyZW50O1xuICBjb25zdCB0ID0gdHlwZW9mIHZhbHVlLFxuICAgIG11bHRpID0gbWFya2VyICE9PSB1bmRlZmluZWQ7XG4gIHBhcmVudCA9IG11bHRpICYmIGN1cnJlbnRbMF0gJiYgY3VycmVudFswXS5wYXJlbnROb2RlIHx8IHBhcmVudDtcbiAgaWYgKHQgPT09IFwic3RyaW5nXCIgfHwgdCA9PT0gXCJudW1iZXJcIikge1xuICAgIGlmIChoeWRyYXRpbmcpIHJldHVybiBjdXJyZW50O1xuICAgIGlmICh0ID09PSBcIm51bWJlclwiKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICBpZiAodmFsdWUgPT09IGN1cnJlbnQpIHJldHVybiBjdXJyZW50O1xuICAgIH1cbiAgICBpZiAobXVsdGkpIHtcbiAgICAgIGxldCBub2RlID0gY3VycmVudFswXTtcbiAgICAgIGlmIChub2RlICYmIG5vZGUubm9kZVR5cGUgPT09IDMpIHtcbiAgICAgICAgbm9kZS5kYXRhICE9PSB2YWx1ZSAmJiAobm9kZS5kYXRhID0gdmFsdWUpO1xuICAgICAgfSBlbHNlIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh2YWx1ZSk7XG4gICAgICBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgbm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChjdXJyZW50ICE9PSBcIlwiICYmIHR5cGVvZiBjdXJyZW50ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGN1cnJlbnQgPSBwYXJlbnQuZmlyc3RDaGlsZC5kYXRhID0gdmFsdWU7XG4gICAgICB9IGVsc2UgY3VycmVudCA9IHBhcmVudC50ZXh0Q29udGVudCA9IHZhbHVlO1xuICAgIH1cbiAgfSBlbHNlIGlmICh2YWx1ZSA9PSBudWxsIHx8IHQgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgaWYgKGh5ZHJhdGluZykgcmV0dXJuIGN1cnJlbnQ7XG4gICAgY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIpO1xuICB9IGVsc2UgaWYgKHQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiB7XG4gICAgICBsZXQgdiA9IHZhbHVlKCk7XG4gICAgICB3aGlsZSAodHlwZW9mIHYgPT09IFwiZnVuY3Rpb25cIikgdiA9IHYoKTtcbiAgICAgIGN1cnJlbnQgPSBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgdiwgY3VycmVudCwgbWFya2VyKTtcbiAgICB9KTtcbiAgICByZXR1cm4gKCkgPT4gY3VycmVudDtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIGNvbnN0IGFycmF5ID0gW107XG4gICAgY29uc3QgY3VycmVudEFycmF5ID0gY3VycmVudCAmJiBBcnJheS5pc0FycmF5KGN1cnJlbnQpO1xuICAgIGlmIChub3JtYWxpemVJbmNvbWluZ0FycmF5KGFycmF5LCB2YWx1ZSwgY3VycmVudCwgdW53cmFwQXJyYXkpKSB7XG4gICAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gY3VycmVudCA9IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCBhcnJheSwgY3VycmVudCwgbWFya2VyLCB0cnVlKSk7XG4gICAgICByZXR1cm4gKCkgPT4gY3VycmVudDtcbiAgICB9XG4gICAgaWYgKGh5ZHJhdGluZykge1xuICAgICAgaWYgKCFhcnJheS5sZW5ndGgpIHJldHVybiBjdXJyZW50O1xuICAgICAgaWYgKG1hcmtlciA9PT0gdW5kZWZpbmVkKSByZXR1cm4gY3VycmVudCA9IFsuLi5wYXJlbnQuY2hpbGROb2Rlc107XG4gICAgICBsZXQgbm9kZSA9IGFycmF5WzBdO1xuICAgICAgaWYgKG5vZGUucGFyZW50Tm9kZSAhPT0gcGFyZW50KSByZXR1cm4gY3VycmVudDtcbiAgICAgIGNvbnN0IG5vZGVzID0gW25vZGVdO1xuICAgICAgd2hpbGUgKChub2RlID0gbm9kZS5uZXh0U2libGluZykgIT09IG1hcmtlcikgbm9kZXMucHVzaChub2RlKTtcbiAgICAgIHJldHVybiBjdXJyZW50ID0gbm9kZXM7XG4gICAgfVxuICAgIGlmIChhcnJheS5sZW5ndGggPT09IDApIHtcbiAgICAgIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyKTtcbiAgICAgIGlmIChtdWx0aSkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgfSBlbHNlIGlmIChjdXJyZW50QXJyYXkpIHtcbiAgICAgIGlmIChjdXJyZW50Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBhcHBlbmROb2RlcyhwYXJlbnQsIGFycmF5LCBtYXJrZXIpO1xuICAgICAgfSBlbHNlIHJlY29uY2lsZUFycmF5cyhwYXJlbnQsIGN1cnJlbnQsIGFycmF5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY3VycmVudCAmJiBjbGVhbkNoaWxkcmVuKHBhcmVudCk7XG4gICAgICBhcHBlbmROb2RlcyhwYXJlbnQsIGFycmF5KTtcbiAgICB9XG4gICAgY3VycmVudCA9IGFycmF5O1xuICB9IGVsc2UgaWYgKHZhbHVlLm5vZGVUeXBlKSB7XG4gICAgaWYgKGh5ZHJhdGluZyAmJiB2YWx1ZS5wYXJlbnROb2RlKSByZXR1cm4gY3VycmVudCA9IG11bHRpID8gW3ZhbHVlXSA6IHZhbHVlO1xuICAgIGlmIChBcnJheS5pc0FycmF5KGN1cnJlbnQpKSB7XG4gICAgICBpZiAobXVsdGkpIHJldHVybiBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgdmFsdWUpO1xuICAgICAgY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG51bGwsIHZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnQgPT0gbnVsbCB8fCBjdXJyZW50ID09PSBcIlwiIHx8ICFwYXJlbnQuZmlyc3RDaGlsZCkge1xuICAgICAgcGFyZW50LmFwcGVuZENoaWxkKHZhbHVlKTtcbiAgICB9IGVsc2UgcGFyZW50LnJlcGxhY2VDaGlsZCh2YWx1ZSwgcGFyZW50LmZpcnN0Q2hpbGQpO1xuICAgIGN1cnJlbnQgPSB2YWx1ZTtcbiAgfSBlbHNlIGNvbnNvbGUud2FybihgVW5yZWNvZ25pemVkIHZhbHVlLiBTa2lwcGVkIGluc2VydGluZ2AsIHZhbHVlKTtcbiAgcmV0dXJuIGN1cnJlbnQ7XG59XG5mdW5jdGlvbiBub3JtYWxpemVJbmNvbWluZ0FycmF5KG5vcm1hbGl6ZWQsIGFycmF5LCBjdXJyZW50LCB1bndyYXApIHtcbiAgbGV0IGR5bmFtaWMgPSBmYWxzZTtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgbGV0IGl0ZW0gPSBhcnJheVtpXSxcbiAgICAgIHByZXYgPSBjdXJyZW50ICYmIGN1cnJlbnRbbm9ybWFsaXplZC5sZW5ndGhdLFxuICAgICAgdDtcbiAgICBpZiAoaXRlbSA9PSBudWxsIHx8IGl0ZW0gPT09IHRydWUgfHwgaXRlbSA9PT0gZmFsc2UpIDsgZWxzZSBpZiAoKHQgPSB0eXBlb2YgaXRlbSkgPT09IFwib2JqZWN0XCIgJiYgaXRlbS5ub2RlVHlwZSkge1xuICAgICAgbm9ybWFsaXplZC5wdXNoKGl0ZW0pO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShpdGVtKSkge1xuICAgICAgZHluYW1pYyA9IG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgaXRlbSwgcHJldikgfHwgZHluYW1pYztcbiAgICB9IGVsc2UgaWYgKHQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgaWYgKHVud3JhcCkge1xuICAgICAgICB3aGlsZSAodHlwZW9mIGl0ZW0gPT09IFwiZnVuY3Rpb25cIikgaXRlbSA9IGl0ZW0oKTtcbiAgICAgICAgZHluYW1pYyA9IG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgQXJyYXkuaXNBcnJheShpdGVtKSA/IGl0ZW0gOiBbaXRlbV0sIEFycmF5LmlzQXJyYXkocHJldikgPyBwcmV2IDogW3ByZXZdKSB8fCBkeW5hbWljO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9ybWFsaXplZC5wdXNoKGl0ZW0pO1xuICAgICAgICBkeW5hbWljID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdmFsdWUgPSBTdHJpbmcoaXRlbSk7XG4gICAgICBpZiAocHJldiAmJiBwcmV2Lm5vZGVUeXBlID09PSAzICYmIHByZXYuZGF0YSA9PT0gdmFsdWUpIG5vcm1hbGl6ZWQucHVzaChwcmV2KTtlbHNlIG5vcm1hbGl6ZWQucHVzaChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh2YWx1ZSkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZHluYW1pYztcbn1cbmZ1bmN0aW9uIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXksIG1hcmtlciA9IG51bGwpIHtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSBwYXJlbnQuaW5zZXJ0QmVmb3JlKGFycmF5W2ldLCBtYXJrZXIpO1xufVxuZnVuY3Rpb24gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgcmVwbGFjZW1lbnQpIHtcbiAgaWYgKG1hcmtlciA9PT0gdW5kZWZpbmVkKSByZXR1cm4gcGFyZW50LnRleHRDb250ZW50ID0gXCJcIjtcbiAgY29uc3Qgbm9kZSA9IHJlcGxhY2VtZW50IHx8IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXCIpO1xuICBpZiAoY3VycmVudC5sZW5ndGgpIHtcbiAgICBsZXQgaW5zZXJ0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gY3VycmVudC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgZWwgPSBjdXJyZW50W2ldO1xuICAgICAgaWYgKG5vZGUgIT09IGVsKSB7XG4gICAgICAgIGNvbnN0IGlzUGFyZW50ID0gZWwucGFyZW50Tm9kZSA9PT0gcGFyZW50O1xuICAgICAgICBpZiAoIWluc2VydGVkICYmICFpKSBpc1BhcmVudCA/IHBhcmVudC5yZXBsYWNlQ2hpbGQobm9kZSwgZWwpIDogcGFyZW50Lmluc2VydEJlZm9yZShub2RlLCBtYXJrZXIpO2Vsc2UgaXNQYXJlbnQgJiYgZWwucmVtb3ZlKCk7XG4gICAgICB9IGVsc2UgaW5zZXJ0ZWQgPSB0cnVlO1xuICAgIH1cbiAgfSBlbHNlIHBhcmVudC5pbnNlcnRCZWZvcmUobm9kZSwgbWFya2VyKTtcbiAgcmV0dXJuIFtub2RlXTtcbn1cbmZ1bmN0aW9uIGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgcm9vdCkge1xuICBjb25zdCB0ZW1wbGF0ZXMgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoYCpbZGF0YS1oa11gKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wbGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBub2RlID0gdGVtcGxhdGVzW2ldO1xuICAgIGNvbnN0IGtleSA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiZGF0YS1oa1wiKTtcbiAgICBpZiAoKCFyb290IHx8IGtleS5zdGFydHNXaXRoKHJvb3QpKSAmJiAhc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LmhhcyhrZXkpKSBzaGFyZWRDb25maWcucmVnaXN0cnkuc2V0KGtleSwgbm9kZSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGdldEh5ZHJhdGlvbktleSgpIHtcbiAgcmV0dXJuIHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCk7XG59XG5mdW5jdGlvbiBOb0h5ZHJhdGlvbihwcm9wcykge1xuICByZXR1cm4gc2hhcmVkQ29uZmlnLmNvbnRleHQgPyB1bmRlZmluZWQgOiBwcm9wcy5jaGlsZHJlbjtcbn1cbmZ1bmN0aW9uIEh5ZHJhdGlvbihwcm9wcykge1xuICByZXR1cm4gcHJvcHMuY2hpbGRyZW47XG59XG5jb25zdCB2b2lkRm4gPSAoKSA9PiB1bmRlZmluZWQ7XG5jb25zdCBSZXF1ZXN0Q29udGV4dCA9IFN5bWJvbCgpO1xuZnVuY3Rpb24gaW5uZXJIVE1MKHBhcmVudCwgY29udGVudCkge1xuICAhc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgKHBhcmVudC5pbm5lckhUTUwgPSBjb250ZW50KTtcbn1cblxuZnVuY3Rpb24gdGhyb3dJbkJyb3dzZXIoZnVuYykge1xuICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYCR7ZnVuYy5uYW1lfSBpcyBub3Qgc3VwcG9ydGVkIGluIHRoZSBicm93c2VyLCByZXR1cm5pbmcgdW5kZWZpbmVkYCk7XG4gIGNvbnNvbGUuZXJyb3IoZXJyKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyaW5nKGZuLCBvcHRpb25zKSB7XG4gIHRocm93SW5Ccm93c2VyKHJlbmRlclRvU3RyaW5nKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyaW5nQXN5bmMoZm4sIG9wdGlvbnMpIHtcbiAgdGhyb3dJbkJyb3dzZXIocmVuZGVyVG9TdHJpbmdBc3luYyk7XG59XG5mdW5jdGlvbiByZW5kZXJUb1N0cmVhbShmbiwgb3B0aW9ucykge1xuICB0aHJvd0luQnJvd3NlcihyZW5kZXJUb1N0cmVhbSk7XG59XG5mdW5jdGlvbiBzc3IodGVtcGxhdGUsIC4uLm5vZGVzKSB7fVxuZnVuY3Rpb24gc3NyRWxlbWVudChuYW1lLCBwcm9wcywgY2hpbGRyZW4sIG5lZWRzSWQpIHt9XG5mdW5jdGlvbiBzc3JDbGFzc0xpc3QodmFsdWUpIHt9XG5mdW5jdGlvbiBzc3JTdHlsZSh2YWx1ZSkge31cbmZ1bmN0aW9uIHNzckF0dHJpYnV0ZShrZXksIHZhbHVlKSB7fVxuZnVuY3Rpb24gc3NySHlkcmF0aW9uS2V5KCkge31cbmZ1bmN0aW9uIHJlc29sdmVTU1JOb2RlKG5vZGUpIHt9XG5mdW5jdGlvbiBlc2NhcGUoaHRtbCkge31cbmZ1bmN0aW9uIHNzclNwcmVhZChwcm9wcywgaXNTVkcsIHNraXBDaGlsZHJlbikge31cblxuY29uc3QgaXNTZXJ2ZXIgPSBmYWxzZTtcbmNvbnN0IGlzRGV2ID0gdHJ1ZTtcbmNvbnN0IFNWR19OQU1FU1BBQ0UgPSBcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI7XG5mdW5jdGlvbiBjcmVhdGVFbGVtZW50KHRhZ05hbWUsIGlzU1ZHID0gZmFsc2UpIHtcbiAgcmV0dXJuIGlzU1ZHID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR19OQU1FU1BBQ0UsIHRhZ05hbWUpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbn1cbmNvbnN0IGh5ZHJhdGUgPSAoLi4uYXJncykgPT4ge1xuICBlbmFibGVIeWRyYXRpb24oKTtcbiAgcmV0dXJuIGh5ZHJhdGUkMSguLi5hcmdzKTtcbn07XG5mdW5jdGlvbiBQb3J0YWwocHJvcHMpIHtcbiAgY29uc3Qge1xuICAgICAgdXNlU2hhZG93XG4gICAgfSA9IHByb3BzLFxuICAgIG1hcmtlciA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXCIpLFxuICAgIG1vdW50ID0gKCkgPT4gcHJvcHMubW91bnQgfHwgZG9jdW1lbnQuYm9keSxcbiAgICBvd25lciA9IGdldE93bmVyKCk7XG4gIGxldCBjb250ZW50O1xuICBsZXQgaHlkcmF0aW5nID0gISFzaGFyZWRDb25maWcuY29udGV4dDtcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoaHlkcmF0aW5nKSBnZXRPd25lcigpLnVzZXIgPSBoeWRyYXRpbmcgPSBmYWxzZTtcbiAgICBjb250ZW50IHx8IChjb250ZW50ID0gcnVuV2l0aE93bmVyKG93bmVyLCAoKSA9PiBjcmVhdGVNZW1vKCgpID0+IHByb3BzLmNoaWxkcmVuKSkpO1xuICAgIGNvbnN0IGVsID0gbW91bnQoKTtcbiAgICBpZiAoZWwgaW5zdGFuY2VvZiBIVE1MSGVhZEVsZW1lbnQpIHtcbiAgICAgIGNvbnN0IFtjbGVhbiwgc2V0Q2xlYW5dID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgICAgIGNvbnN0IGNsZWFudXAgPSAoKSA9PiBzZXRDbGVhbih0cnVlKTtcbiAgICAgIGNyZWF0ZVJvb3QoZGlzcG9zZSA9PiBpbnNlcnQoZWwsICgpID0+ICFjbGVhbigpID8gY29udGVudCgpIDogZGlzcG9zZSgpLCBudWxsKSk7XG4gICAgICBvbkNsZWFudXAoY2xlYW51cCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGNyZWF0ZUVsZW1lbnQocHJvcHMuaXNTVkcgPyBcImdcIiA6IFwiZGl2XCIsIHByb3BzLmlzU1ZHKSxcbiAgICAgICAgcmVuZGVyUm9vdCA9IHVzZVNoYWRvdyAmJiBjb250YWluZXIuYXR0YWNoU2hhZG93ID8gY29udGFpbmVyLmF0dGFjaFNoYWRvdyh7XG4gICAgICAgICAgbW9kZTogXCJvcGVuXCJcbiAgICAgICAgfSkgOiBjb250YWluZXI7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29udGFpbmVyLCBcIl8kaG9zdFwiLCB7XG4gICAgICAgIGdldCgpIHtcbiAgICAgICAgICByZXR1cm4gbWFya2VyLnBhcmVudE5vZGU7XG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gICAgICBpbnNlcnQocmVuZGVyUm9vdCwgY29udGVudCk7XG4gICAgICBlbC5hcHBlbmRDaGlsZChjb250YWluZXIpO1xuICAgICAgcHJvcHMucmVmICYmIHByb3BzLnJlZihjb250YWluZXIpO1xuICAgICAgb25DbGVhbnVwKCgpID0+IGVsLnJlbW92ZUNoaWxkKGNvbnRhaW5lcikpO1xuICAgIH1cbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgcmVuZGVyOiAhaHlkcmF0aW5nXG4gIH0pO1xuICByZXR1cm4gbWFya2VyO1xufVxuZnVuY3Rpb24gY3JlYXRlRHluYW1pYyhjb21wb25lbnQsIHByb3BzKSB7XG4gIGNvbnN0IGNhY2hlZCA9IGNyZWF0ZU1lbW8oY29tcG9uZW50KTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IGNhY2hlZCgpO1xuICAgIHN3aXRjaCAodHlwZW9mIGNvbXBvbmVudCkge1xuICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgICAgIE9iamVjdC5hc3NpZ24oY29tcG9uZW50LCB7XG4gICAgICAgICAgWyRERVZDT01QXTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHVudHJhY2soKCkgPT4gY29tcG9uZW50KHByb3BzKSk7XG4gICAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICAgIGNvbnN0IGlzU3ZnID0gU1ZHRWxlbWVudHMuaGFzKGNvbXBvbmVudCk7XG4gICAgICAgIGNvbnN0IGVsID0gc2hhcmVkQ29uZmlnLmNvbnRleHQgPyBnZXROZXh0RWxlbWVudCgpIDogY3JlYXRlRWxlbWVudChjb21wb25lbnQsIGlzU3ZnKTtcbiAgICAgICAgc3ByZWFkKGVsLCBwcm9wcywgaXNTdmcpO1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgfVxuICB9KTtcbn1cbmZ1bmN0aW9uIER5bmFtaWMocHJvcHMpIHtcbiAgY29uc3QgWywgb3RoZXJzXSA9IHNwbGl0UHJvcHMocHJvcHMsIFtcImNvbXBvbmVudFwiXSk7XG4gIHJldHVybiBjcmVhdGVEeW5hbWljKCgpID0+IHByb3BzLmNvbXBvbmVudCwgb3RoZXJzKTtcbn1cblxuZXhwb3J0IHsgQWxpYXNlcywgdm9pZEZuIGFzIEFzc2V0cywgQ2hpbGRQcm9wZXJ0aWVzLCBET01FbGVtZW50cywgRGVsZWdhdGVkRXZlbnRzLCBEeW5hbWljLCBIeWRyYXRpb24sIHZvaWRGbiBhcyBIeWRyYXRpb25TY3JpcHQsIE5vSHlkcmF0aW9uLCBQb3J0YWwsIFByb3BlcnRpZXMsIFJlcXVlc3RDb250ZXh0LCBTVkdFbGVtZW50cywgU1ZHTmFtZXNwYWNlLCBhZGRFdmVudExpc3RlbmVyLCBhc3NpZ24sIGNsYXNzTGlzdCwgY2xhc3NOYW1lLCBjbGVhckRlbGVnYXRlZEV2ZW50cywgY3JlYXRlRHluYW1pYywgZGVsZWdhdGVFdmVudHMsIGR5bmFtaWNQcm9wZXJ0eSwgZXNjYXBlLCB2b2lkRm4gYXMgZ2VuZXJhdGVIeWRyYXRpb25TY3JpcHQsIHZvaWRGbiBhcyBnZXRBc3NldHMsIGdldEh5ZHJhdGlvbktleSwgZ2V0TmV4dEVsZW1lbnQsIGdldE5leHRNYXJrZXIsIGdldE5leHRNYXRjaCwgZ2V0UHJvcEFsaWFzLCB2b2lkRm4gYXMgZ2V0UmVxdWVzdEV2ZW50LCBoeWRyYXRlLCBpbm5lckhUTUwsIGluc2VydCwgaXNEZXYsIGlzU2VydmVyLCBtZW1vLCByZW5kZXIsIHJlbmRlclRvU3RyZWFtLCByZW5kZXJUb1N0cmluZywgcmVuZGVyVG9TdHJpbmdBc3luYywgcmVzb2x2ZVNTUk5vZGUsIHJ1bkh5ZHJhdGlvbkV2ZW50cywgc2V0QXR0cmlidXRlLCBzZXRBdHRyaWJ1dGVOUywgc2V0Qm9vbEF0dHJpYnV0ZSwgc2V0UHJvcGVydHksIHNwcmVhZCwgc3NyLCBzc3JBdHRyaWJ1dGUsIHNzckNsYXNzTGlzdCwgc3NyRWxlbWVudCwgc3NySHlkcmF0aW9uS2V5LCBzc3JTcHJlYWQsIHNzclN0eWxlLCBzdHlsZSwgdGVtcGxhdGUsIHVzZSwgdm9pZEZuIGFzIHVzZUFzc2V0cyB9O1xuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiLy8gR2VuZXJhdGVkIHVzaW5nIGBucG0gcnVuIGJ1aWxkYC4gRG8gbm90IGVkaXQuXG5cbnZhciByZWdleCA9IC9eW2Etel0oPzpbXFwuMC05X2EtelxceEI3XFx4QzAtXFx4RDZcXHhEOC1cXHhGNlxceEY4LVxcdTAzN0RcXHUwMzdGLVxcdTFGRkZcXHUyMDBDXFx1MjAwRFxcdTIwM0ZcXHUyMDQwXFx1MjA3MC1cXHUyMThGXFx1MkMwMC1cXHUyRkVGXFx1MzAwMS1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkZEXXxbXFx1RDgwMC1cXHVEQjdGXVtcXHVEQzAwLVxcdURGRkZdKSotKD86W1xceDJEXFwuMC05X2EtelxceEI3XFx4QzAtXFx4RDZcXHhEOC1cXHhGNlxceEY4LVxcdTAzN0RcXHUwMzdGLVxcdTFGRkZcXHUyMDBDXFx1MjAwRFxcdTIwM0ZcXHUyMDQwXFx1MjA3MC1cXHUyMThGXFx1MkMwMC1cXHUyRkVGXFx1MzAwMS1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkZEXXxbXFx1RDgwMC1cXHVEQjdGXVtcXHVEQzAwLVxcdURGRkZdKSokLztcblxudmFyIGlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUgPSBmdW5jdGlvbihzdHJpbmcpIHtcblx0cmV0dXJuIHJlZ2V4LnRlc3Qoc3RyaW5nKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZTtcbiIsInZhciBfX2FzeW5jID0gKF9fdGhpcywgX19hcmd1bWVudHMsIGdlbmVyYXRvcikgPT4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIHZhciBmdWxmaWxsZWQgPSAodmFsdWUpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgfVxuICAgIH07XG4gICAgdmFyIHJlamVjdGVkID0gKHZhbHVlKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBzdGVwKGdlbmVyYXRvci50aHJvdyh2YWx1ZSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZWplY3QoZSk7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgc3RlcCA9ICh4KSA9PiB4LmRvbmUgPyByZXNvbHZlKHgudmFsdWUpIDogUHJvbWlzZS5yZXNvbHZlKHgudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7XG4gICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KF9fdGhpcywgX19hcmd1bWVudHMpKS5uZXh0KCkpO1xuICB9KTtcbn07XG5cbi8vIHNyYy9pbmRleC50c1xuaW1wb3J0IGlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUgZnJvbSBcImlzLXBvdGVudGlhbC1jdXN0b20tZWxlbWVudC1uYW1lXCI7XG5mdW5jdGlvbiBjcmVhdGVJc29sYXRlZEVsZW1lbnQob3B0aW9ucykge1xuICByZXR1cm4gX19hc3luYyh0aGlzLCBudWxsLCBmdW5jdGlvbiogKCkge1xuICAgIGNvbnN0IHsgbmFtZSwgbW9kZSA9IFwiY2xvc2VkXCIsIGNzcywgaXNvbGF0ZUV2ZW50cyA9IGZhbHNlIH0gPSBvcHRpb25zO1xuICAgIGlmICghaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZShuYW1lKSkge1xuICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgIGBcIiR7bmFtZX1cIiBpcyBub3QgYSB2YWxpZCBjdXN0b20gZWxlbWVudCBuYW1lLiBJdCBtdXN0IGJlIHR3byB3b3JkcyBhbmQga2ViYWItY2FzZSwgd2l0aCBhIGZldyBleGNlcHRpb25zLiBTZWUgc3BlYyBmb3IgbW9yZSBkZXRhaWxzOiBodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9jdXN0b20tZWxlbWVudHMuaHRtbCN2YWxpZC1jdXN0b20tZWxlbWVudC1uYW1lYFxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgcGFyZW50RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQobmFtZSk7XG4gICAgY29uc3Qgc2hhZG93ID0gcGFyZW50RWxlbWVudC5hdHRhY2hTaGFkb3coeyBtb2RlIH0pO1xuICAgIGNvbnN0IGlzb2xhdGVkRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJodG1sXCIpO1xuICAgIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYm9keVwiKTtcbiAgICBjb25zdCBoZWFkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImhlYWRcIik7XG4gICAgaWYgKGNzcykge1xuICAgICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XG4gICAgICBpZiAoXCJ1cmxcIiBpbiBjc3MpIHtcbiAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSB5aWVsZCBmZXRjaChjc3MudXJsKS50aGVuKChyZXMpID0+IHJlcy50ZXh0KCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSBjc3MudGV4dENvbnRlbnQ7XG4gICAgICB9XG4gICAgICBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICB9XG4gICAgaXNvbGF0ZWRFbGVtZW50LmFwcGVuZENoaWxkKGhlYWQpO1xuICAgIGlzb2xhdGVkRWxlbWVudC5hcHBlbmRDaGlsZChib2R5KTtcbiAgICBzaGFkb3cuYXBwZW5kQ2hpbGQoaXNvbGF0ZWRFbGVtZW50KTtcbiAgICBpZiAoaXNvbGF0ZUV2ZW50cykge1xuICAgICAgY29uc3QgZXZlbnRUeXBlcyA9IEFycmF5LmlzQXJyYXkoaXNvbGF0ZUV2ZW50cykgPyBpc29sYXRlRXZlbnRzIDogW1wia2V5ZG93blwiLCBcImtleXVwXCIsIFwia2V5cHJlc3NcIl07XG4gICAgICBldmVudFR5cGVzLmZvckVhY2goKGV2ZW50VHlwZSkgPT4ge1xuICAgICAgICBib2R5LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnRUeXBlLCAoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHBhcmVudEVsZW1lbnQsXG4gICAgICBzaGFkb3csXG4gICAgICBpc29sYXRlZEVsZW1lbnQ6IGJvZHlcbiAgICB9O1xuICB9KTtcbn1cbmV4cG9ydCB7XG4gIGNyZWF0ZUlzb2xhdGVkRWxlbWVudFxufTtcbiIsImNvbnN0IG51bGxLZXkgPSBTeW1ib2woJ251bGwnKTsgLy8gYG9iamVjdEhhc2hlc2Aga2V5IGZvciBudWxsXG5cbmxldCBrZXlDb3VudGVyID0gMDtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWFueUtleXNNYXAgZXh0ZW5kcyBNYXAge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fb2JqZWN0SGFzaGVzID0gbmV3IFdlYWtNYXAoKTtcblx0XHR0aGlzLl9zeW1ib2xIYXNoZXMgPSBuZXcgTWFwKCk7IC8vIGh0dHBzOi8vZ2l0aHViLmNvbS90YzM5L2VjbWEyNjIvaXNzdWVzLzExOTRcblx0XHR0aGlzLl9wdWJsaWNLZXlzID0gbmV3IE1hcCgpO1xuXG5cdFx0Y29uc3QgW3BhaXJzXSA9IGFyZ3VtZW50czsgLy8gTWFwIGNvbXBhdFxuXHRcdGlmIChwYWlycyA9PT0gbnVsbCB8fCBwYWlycyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBwYWlyc1tTeW1ib2wuaXRlcmF0b3JdICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHR5cGVvZiBwYWlycyArICcgaXMgbm90IGl0ZXJhYmxlIChjYW5ub3QgcmVhZCBwcm9wZXJ0eSBTeW1ib2woU3ltYm9sLml0ZXJhdG9yKSknKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IFtrZXlzLCB2YWx1ZV0gb2YgcGFpcnMpIHtcblx0XHRcdHRoaXMuc2V0KGtleXMsIHZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRfZ2V0UHVibGljS2V5cyhrZXlzLCBjcmVhdGUgPSBmYWxzZSkge1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShrZXlzKSkge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIGtleXMgcGFyYW1ldGVyIG11c3QgYmUgYW4gYXJyYXknKTtcblx0XHR9XG5cblx0XHRjb25zdCBwcml2YXRlS2V5ID0gdGhpcy5fZ2V0UHJpdmF0ZUtleShrZXlzLCBjcmVhdGUpO1xuXG5cdFx0bGV0IHB1YmxpY0tleTtcblx0XHRpZiAocHJpdmF0ZUtleSAmJiB0aGlzLl9wdWJsaWNLZXlzLmhhcyhwcml2YXRlS2V5KSkge1xuXHRcdFx0cHVibGljS2V5ID0gdGhpcy5fcHVibGljS2V5cy5nZXQocHJpdmF0ZUtleSk7XG5cdFx0fSBlbHNlIGlmIChjcmVhdGUpIHtcblx0XHRcdHB1YmxpY0tleSA9IFsuLi5rZXlzXTsgLy8gUmVnZW5lcmF0ZSBrZXlzIGFycmF5IHRvIGF2b2lkIGV4dGVybmFsIGludGVyYWN0aW9uXG5cdFx0XHR0aGlzLl9wdWJsaWNLZXlzLnNldChwcml2YXRlS2V5LCBwdWJsaWNLZXkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7cHJpdmF0ZUtleSwgcHVibGljS2V5fTtcblx0fVxuXG5cdF9nZXRQcml2YXRlS2V5KGtleXMsIGNyZWF0ZSA9IGZhbHNlKSB7XG5cdFx0Y29uc3QgcHJpdmF0ZUtleXMgPSBbXTtcblx0XHRmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuXHRcdFx0aWYgKGtleSA9PT0gbnVsbCkge1xuXHRcdFx0XHRrZXkgPSBudWxsS2V5O1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBoYXNoZXMgPSB0eXBlb2Yga2V5ID09PSAnb2JqZWN0JyB8fCB0eXBlb2Yga2V5ID09PSAnZnVuY3Rpb24nID8gJ19vYmplY3RIYXNoZXMnIDogKHR5cGVvZiBrZXkgPT09ICdzeW1ib2wnID8gJ19zeW1ib2xIYXNoZXMnIDogZmFsc2UpO1xuXG5cdFx0XHRpZiAoIWhhc2hlcykge1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKGtleSk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXNbaGFzaGVzXS5oYXMoa2V5KSkge1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKHRoaXNbaGFzaGVzXS5nZXQoa2V5KSk7XG5cdFx0XHR9IGVsc2UgaWYgKGNyZWF0ZSkge1xuXHRcdFx0XHRjb25zdCBwcml2YXRlS2V5ID0gYEBAbWttLXJlZi0ke2tleUNvdW50ZXIrK31AQGA7XG5cdFx0XHRcdHRoaXNbaGFzaGVzXS5zZXQoa2V5LCBwcml2YXRlS2V5KTtcblx0XHRcdFx0cHJpdmF0ZUtleXMucHVzaChwcml2YXRlS2V5KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkocHJpdmF0ZUtleXMpO1xuXHR9XG5cblx0c2V0KGtleXMsIHZhbHVlKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMsIHRydWUpO1xuXHRcdHJldHVybiBzdXBlci5zZXQocHVibGljS2V5LCB2YWx1ZSk7XG5cdH1cblxuXHRnZXQoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gc3VwZXIuZ2V0KHB1YmxpY0tleSk7XG5cdH1cblxuXHRoYXMoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gc3VwZXIuaGFzKHB1YmxpY0tleSk7XG5cdH1cblxuXHRkZWxldGUoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXksIHByaXZhdGVLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gQm9vbGVhbihwdWJsaWNLZXkgJiYgc3VwZXIuZGVsZXRlKHB1YmxpY0tleSkgJiYgdGhpcy5fcHVibGljS2V5cy5kZWxldGUocHJpdmF0ZUtleSkpO1xuXHR9XG5cblx0Y2xlYXIoKSB7XG5cdFx0c3VwZXIuY2xlYXIoKTtcblx0XHR0aGlzLl9zeW1ib2xIYXNoZXMuY2xlYXIoKTtcblx0XHR0aGlzLl9wdWJsaWNLZXlzLmNsZWFyKCk7XG5cdH1cblxuXHRnZXQgW1N5bWJvbC50b1N0cmluZ1RhZ10oKSB7XG5cdFx0cmV0dXJuICdNYW55S2V5c01hcCc7XG5cdH1cblxuXHRnZXQgc2l6ZSgpIHtcblx0XHRyZXR1cm4gc3VwZXIuc2l6ZTtcblx0fVxufVxuIiwiZnVuY3Rpb24gaXNQbGFpbk9iamVjdCh2YWx1ZSkge1xuICBpZiAodmFsdWUgPT09IG51bGwgfHwgdHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHByb3RvdHlwZSA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSk7XG4gIGlmIChwcm90b3R5cGUgIT09IG51bGwgJiYgcHJvdG90eXBlICE9PSBPYmplY3QucHJvdG90eXBlICYmIE9iamVjdC5nZXRQcm90b3R5cGVPZihwcm90b3R5cGUpICE9PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChTeW1ib2wuaXRlcmF0b3IgaW4gdmFsdWUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKFN5bWJvbC50b1N0cmluZ1RhZyBpbiB2YWx1ZSkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpID09PSBcIltvYmplY3QgTW9kdWxlXVwiO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBfZGVmdShiYXNlT2JqZWN0LCBkZWZhdWx0cywgbmFtZXNwYWNlID0gXCIuXCIsIG1lcmdlcikge1xuICBpZiAoIWlzUGxhaW5PYmplY3QoZGVmYXVsdHMpKSB7XG4gICAgcmV0dXJuIF9kZWZ1KGJhc2VPYmplY3QsIHt9LCBuYW1lc3BhY2UsIG1lcmdlcik7XG4gIH1cbiAgY29uc3Qgb2JqZWN0ID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdHMpO1xuICBmb3IgKGNvbnN0IGtleSBpbiBiYXNlT2JqZWN0KSB7XG4gICAgaWYgKGtleSA9PT0gXCJfX3Byb3RvX19cIiB8fCBrZXkgPT09IFwiY29uc3RydWN0b3JcIikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gYmFzZU9iamVjdFtrZXldO1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdm9pZCAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKG1lcmdlciAmJiBtZXJnZXIob2JqZWN0LCBrZXksIHZhbHVlLCBuYW1lc3BhY2UpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpICYmIEFycmF5LmlzQXJyYXkob2JqZWN0W2tleV0pKSB7XG4gICAgICBvYmplY3Rba2V5XSA9IFsuLi52YWx1ZSwgLi4ub2JqZWN0W2tleV1dO1xuICAgIH0gZWxzZSBpZiAoaXNQbGFpbk9iamVjdCh2YWx1ZSkgJiYgaXNQbGFpbk9iamVjdChvYmplY3Rba2V5XSkpIHtcbiAgICAgIG9iamVjdFtrZXldID0gX2RlZnUoXG4gICAgICAgIHZhbHVlLFxuICAgICAgICBvYmplY3Rba2V5XSxcbiAgICAgICAgKG5hbWVzcGFjZSA/IGAke25hbWVzcGFjZX0uYCA6IFwiXCIpICsga2V5LnRvU3RyaW5nKCksXG4gICAgICAgIG1lcmdlclxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG9iamVjdDtcbn1cbmZ1bmN0aW9uIGNyZWF0ZURlZnUobWVyZ2VyKSB7XG4gIHJldHVybiAoLi4uYXJndW1lbnRzXykgPT4gKFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSB1bmljb3JuL25vLWFycmF5LXJlZHVjZVxuICAgIGFyZ3VtZW50c18ucmVkdWNlKChwLCBjKSA9PiBfZGVmdShwLCBjLCBcIlwiLCBtZXJnZXIpLCB7fSlcbiAgKTtcbn1cbmNvbnN0IGRlZnUgPSBjcmVhdGVEZWZ1KCk7XG5jb25zdCBkZWZ1Rm4gPSBjcmVhdGVEZWZ1KChvYmplY3QsIGtleSwgY3VycmVudFZhbHVlKSA9PiB7XG4gIGlmIChvYmplY3Rba2V5XSAhPT0gdm9pZCAwICYmIHR5cGVvZiBjdXJyZW50VmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIG9iamVjdFtrZXldID0gY3VycmVudFZhbHVlKG9iamVjdFtrZXldKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufSk7XG5jb25zdCBkZWZ1QXJyYXlGbiA9IGNyZWF0ZURlZnUoKG9iamVjdCwga2V5LCBjdXJyZW50VmFsdWUpID0+IHtcbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0W2tleV0pICYmIHR5cGVvZiBjdXJyZW50VmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIG9iamVjdFtrZXldID0gY3VycmVudFZhbHVlKG9iamVjdFtrZXldKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufSk7XG5cbmV4cG9ydCB7IGNyZWF0ZURlZnUsIGRlZnUgYXMgZGVmYXVsdCwgZGVmdSwgZGVmdUFycmF5Rm4sIGRlZnVGbiB9O1xuIiwiY29uc3QgaXNFeGlzdCA9IChlbGVtZW50KSA9PiB7XG4gIHJldHVybiBlbGVtZW50ICE9PSBudWxsID8geyBpc0RldGVjdGVkOiB0cnVlLCByZXN1bHQ6IGVsZW1lbnQgfSA6IHsgaXNEZXRlY3RlZDogZmFsc2UgfTtcbn07XG5jb25zdCBpc05vdEV4aXN0ID0gKGVsZW1lbnQpID0+IHtcbiAgcmV0dXJuIGVsZW1lbnQgPT09IG51bGwgPyB7IGlzRGV0ZWN0ZWQ6IHRydWUsIHJlc3VsdDogbnVsbCB9IDogeyBpc0RldGVjdGVkOiBmYWxzZSB9O1xufTtcblxuZXhwb3J0IHsgaXNFeGlzdCwgaXNOb3RFeGlzdCB9O1xuIiwiaW1wb3J0IE1hbnlLZXlzTWFwIGZyb20gJ21hbnkta2V5cy1tYXAnO1xuaW1wb3J0IHsgZGVmdSB9IGZyb20gJ2RlZnUnO1xuaW1wb3J0IHsgaXNFeGlzdCB9IGZyb20gJy4vZGV0ZWN0b3JzLm1qcyc7XG5cbmNvbnN0IGdldERlZmF1bHRPcHRpb25zID0gKCkgPT4gKHtcbiAgdGFyZ2V0OiBnbG9iYWxUaGlzLmRvY3VtZW50LFxuICB1bmlmeVByb2Nlc3M6IHRydWUsXG4gIGRldGVjdG9yOiBpc0V4aXN0LFxuICBvYnNlcnZlQ29uZmlnczoge1xuICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICBzdWJ0cmVlOiB0cnVlLFxuICAgIGF0dHJpYnV0ZXM6IHRydWVcbiAgfSxcbiAgc2lnbmFsOiB2b2lkIDAsXG4gIGN1c3RvbU1hdGNoZXI6IHZvaWQgMFxufSk7XG5jb25zdCBtZXJnZU9wdGlvbnMgPSAodXNlclNpZGVPcHRpb25zLCBkZWZhdWx0T3B0aW9ucykgPT4ge1xuICByZXR1cm4gZGVmdSh1c2VyU2lkZU9wdGlvbnMsIGRlZmF1bHRPcHRpb25zKTtcbn07XG5cbmNvbnN0IHVuaWZ5Q2FjaGUgPSBuZXcgTWFueUtleXNNYXAoKTtcbmZ1bmN0aW9uIGNyZWF0ZVdhaXRFbGVtZW50KGluc3RhbmNlT3B0aW9ucykge1xuICBjb25zdCB7IGRlZmF1bHRPcHRpb25zIH0gPSBpbnN0YW5jZU9wdGlvbnM7XG4gIHJldHVybiAoc2VsZWN0b3IsIG9wdGlvbnMpID0+IHtcbiAgICBjb25zdCB7XG4gICAgICB0YXJnZXQsXG4gICAgICB1bmlmeVByb2Nlc3MsXG4gICAgICBvYnNlcnZlQ29uZmlncyxcbiAgICAgIGRldGVjdG9yLFxuICAgICAgc2lnbmFsLFxuICAgICAgY3VzdG9tTWF0Y2hlclxuICAgIH0gPSBtZXJnZU9wdGlvbnMob3B0aW9ucywgZGVmYXVsdE9wdGlvbnMpO1xuICAgIGNvbnN0IHVuaWZ5UHJvbWlzZUtleSA9IFtcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgdGFyZ2V0LFxuICAgICAgdW5pZnlQcm9jZXNzLFxuICAgICAgb2JzZXJ2ZUNvbmZpZ3MsXG4gICAgICBkZXRlY3RvcixcbiAgICAgIHNpZ25hbCxcbiAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICBdO1xuICAgIGNvbnN0IGNhY2hlZFByb21pc2UgPSB1bmlmeUNhY2hlLmdldCh1bmlmeVByb21pc2VLZXkpO1xuICAgIGlmICh1bmlmeVByb2Nlc3MgJiYgY2FjaGVkUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIGNhY2hlZFByb21pc2U7XG4gICAgfVxuICAgIGNvbnN0IGRldGVjdFByb21pc2UgPSBuZXcgUHJvbWlzZShcbiAgICAgIC8vIGJpb21lLWlnbm9yZSBsaW50L3N1c3BpY2lvdXMvbm9Bc3luY1Byb21pc2VFeGVjdXRvcjogYXZvaWQgbmVzdGluZyBwcm9taXNlXG4gICAgICBhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmIChzaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KHNpZ25hbC5yZWFzb24pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoXG4gICAgICAgICAgYXN5bmMgKG11dGF0aW9ucykgPT4ge1xuICAgICAgICAgICAgZm9yIChjb25zdCBfIG9mIG11dGF0aW9ucykge1xuICAgICAgICAgICAgICBpZiAoc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnN0IGRldGVjdFJlc3VsdDIgPSBhd2FpdCBkZXRlY3RFbGVtZW50KHtcbiAgICAgICAgICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgICAgICAgZGV0ZWN0b3IsXG4gICAgICAgICAgICAgICAgY3VzdG9tTWF0Y2hlclxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgaWYgKGRldGVjdFJlc3VsdDIuaXNEZXRlY3RlZCkge1xuICAgICAgICAgICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGRldGVjdFJlc3VsdDIucmVzdWx0KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgICAgc2lnbmFsPy5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgIFwiYWJvcnRcIixcbiAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KHNpZ25hbC5yZWFzb24pO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgeyBvbmNlOiB0cnVlIH1cbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgZGV0ZWN0UmVzdWx0ID0gYXdhaXQgZGV0ZWN0RWxlbWVudCh7XG4gICAgICAgICAgc2VsZWN0b3IsXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgIGRldGVjdG9yLFxuICAgICAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChkZXRlY3RSZXN1bHQuaXNEZXRlY3RlZCkge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKGRldGVjdFJlc3VsdC5yZXN1bHQpO1xuICAgICAgICB9XG4gICAgICAgIG9ic2VydmVyLm9ic2VydmUodGFyZ2V0LCBvYnNlcnZlQ29uZmlncyk7XG4gICAgICB9XG4gICAgKS5maW5hbGx5KCgpID0+IHtcbiAgICAgIHVuaWZ5Q2FjaGUuZGVsZXRlKHVuaWZ5UHJvbWlzZUtleSk7XG4gICAgfSk7XG4gICAgdW5pZnlDYWNoZS5zZXQodW5pZnlQcm9taXNlS2V5LCBkZXRlY3RQcm9taXNlKTtcbiAgICByZXR1cm4gZGV0ZWN0UHJvbWlzZTtcbiAgfTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGRldGVjdEVsZW1lbnQoe1xuICB0YXJnZXQsXG4gIHNlbGVjdG9yLFxuICBkZXRlY3RvcixcbiAgY3VzdG9tTWF0Y2hlclxufSkge1xuICBjb25zdCBlbGVtZW50ID0gY3VzdG9tTWF0Y2hlciA/IGN1c3RvbU1hdGNoZXIoc2VsZWN0b3IpIDogdGFyZ2V0LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuICByZXR1cm4gYXdhaXQgZGV0ZWN0b3IoZWxlbWVudCk7XG59XG5jb25zdCB3YWl0RWxlbWVudCA9IGNyZWF0ZVdhaXRFbGVtZW50KHtcbiAgZGVmYXVsdE9wdGlvbnM6IGdldERlZmF1bHRPcHRpb25zKClcbn0pO1xuXG5leHBvcnQgeyBjcmVhdGVXYWl0RWxlbWVudCwgZ2V0RGVmYXVsdE9wdGlvbnMsIHdhaXRFbGVtZW50IH07XG4iLCJmdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcbiAgaWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXJncy5zaGlmdCgpO1xuICAgIG1ldGhvZChgW3d4dF0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xuICB9XG59XG5leHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuICBsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG4gIHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuICBlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuIiwiaW1wb3J0IHsgd2FpdEVsZW1lbnQgfSBmcm9tIFwiQDFuYXRzdS93YWl0LWVsZW1lbnRcIjtcbmltcG9ydCB7XG4gIGlzRXhpc3QgYXMgbW91bnREZXRlY3RvcixcbiAgaXNOb3RFeGlzdCBhcyByZW1vdmVEZXRlY3RvclxufSBmcm9tIFwiQDFuYXRzdS93YWl0LWVsZW1lbnQvZGV0ZWN0b3JzXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5UG9zaXRpb24ocm9vdCwgcG9zaXRpb25lZEVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgaWYgKG9wdGlvbnMucG9zaXRpb24gPT09IFwiaW5saW5lXCIpIHJldHVybjtcbiAgaWYgKG9wdGlvbnMuekluZGV4ICE9IG51bGwpIHJvb3Quc3R5bGUuekluZGV4ID0gU3RyaW5nKG9wdGlvbnMuekluZGV4KTtcbiAgcm9vdC5zdHlsZS5vdmVyZmxvdyA9IFwidmlzaWJsZVwiO1xuICByb290LnN0eWxlLnBvc2l0aW9uID0gXCJyZWxhdGl2ZVwiO1xuICByb290LnN0eWxlLndpZHRoID0gXCIwXCI7XG4gIHJvb3Quc3R5bGUuaGVpZ2h0ID0gXCIwXCI7XG4gIHJvb3Quc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgaWYgKHBvc2l0aW9uZWRFbGVtZW50KSB7XG4gICAgaWYgKG9wdGlvbnMucG9zaXRpb24gPT09IFwib3ZlcmxheVwiKSB7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiYWJzb2x1dGVcIjtcbiAgICAgIGlmIChvcHRpb25zLmFsaWdubWVudD8uc3RhcnRzV2l0aChcImJvdHRvbS1cIikpXG4gICAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmJvdHRvbSA9IFwiMFwiO1xuICAgICAgZWxzZSBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIjtcbiAgICAgIGlmIChvcHRpb25zLmFsaWdubWVudD8uZW5kc1dpdGgoXCItcmlnaHRcIikpXG4gICAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIwXCI7XG4gICAgICBlbHNlIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmxlZnQgPSBcIjBcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmJvdHRvbSA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUubGVmdCA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIjtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRBbmNob3Iob3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5hbmNob3IgPT0gbnVsbCkgcmV0dXJuIGRvY3VtZW50LmJvZHk7XG4gIGxldCByZXNvbHZlZCA9IHR5cGVvZiBvcHRpb25zLmFuY2hvciA9PT0gXCJmdW5jdGlvblwiID8gb3B0aW9ucy5hbmNob3IoKSA6IG9wdGlvbnMuYW5jaG9yO1xuICBpZiAodHlwZW9mIHJlc29sdmVkID09PSBcInN0cmluZ1wiKSB7XG4gICAgaWYgKHJlc29sdmVkLnN0YXJ0c1dpdGgoXCIvXCIpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBkb2N1bWVudC5ldmFsdWF0ZShcbiAgICAgICAgcmVzb2x2ZWQsXG4gICAgICAgIGRvY3VtZW50LFxuICAgICAgICBudWxsLFxuICAgICAgICBYUGF0aFJlc3VsdC5GSVJTVF9PUkRFUkVEX05PREVfVFlQRSxcbiAgICAgICAgbnVsbFxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXN1bHQuc2luZ2xlTm9kZVZhbHVlID8/IHZvaWQgMDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IocmVzb2x2ZWQpID8/IHZvaWQgMDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc29sdmVkID8/IHZvaWQgMDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtb3VudFVpKHJvb3QsIG9wdGlvbnMpIHtcbiAgY29uc3QgYW5jaG9yID0gZ2V0QW5jaG9yKG9wdGlvbnMpO1xuICBpZiAoYW5jaG9yID09IG51bGwpXG4gICAgdGhyb3cgRXJyb3IoXG4gICAgICBcIkZhaWxlZCB0byBtb3VudCBjb250ZW50IHNjcmlwdCBVSTogY291bGQgbm90IGZpbmQgYW5jaG9yIGVsZW1lbnRcIlxuICAgICk7XG4gIHN3aXRjaCAob3B0aW9ucy5hcHBlbmQpIHtcbiAgICBjYXNlIHZvaWQgMDpcbiAgICBjYXNlIFwibGFzdFwiOlxuICAgICAgYW5jaG9yLmFwcGVuZChyb290KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJmaXJzdFwiOlxuICAgICAgYW5jaG9yLnByZXBlbmQocm9vdCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwicmVwbGFjZVwiOlxuICAgICAgYW5jaG9yLnJlcGxhY2VXaXRoKHJvb3QpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImFmdGVyXCI6XG4gICAgICBhbmNob3IucGFyZW50RWxlbWVudD8uaW5zZXJ0QmVmb3JlKHJvb3QsIGFuY2hvci5uZXh0RWxlbWVudFNpYmxpbmcpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImJlZm9yZVwiOlxuICAgICAgYW5jaG9yLnBhcmVudEVsZW1lbnQ/Lmluc2VydEJlZm9yZShyb290LCBhbmNob3IpO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIG9wdGlvbnMuYXBwZW5kKGFuY2hvciwgcm9vdCk7XG4gICAgICBicmVhaztcbiAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1vdW50RnVuY3Rpb25zKGJhc2VGdW5jdGlvbnMsIG9wdGlvbnMpIHtcbiAgbGV0IGF1dG9Nb3VudEluc3RhbmNlID0gdm9pZCAwO1xuICBjb25zdCBzdG9wQXV0b01vdW50ID0gKCkgPT4ge1xuICAgIGF1dG9Nb3VudEluc3RhbmNlPy5zdG9wQXV0b01vdW50KCk7XG4gICAgYXV0b01vdW50SW5zdGFuY2UgPSB2b2lkIDA7XG4gIH07XG4gIGNvbnN0IG1vdW50ID0gKCkgPT4ge1xuICAgIGJhc2VGdW5jdGlvbnMubW91bnQoKTtcbiAgfTtcbiAgY29uc3QgdW5tb3VudCA9IGJhc2VGdW5jdGlvbnMucmVtb3ZlO1xuICBjb25zdCByZW1vdmUgPSAoKSA9PiB7XG4gICAgc3RvcEF1dG9Nb3VudCgpO1xuICAgIGJhc2VGdW5jdGlvbnMucmVtb3ZlKCk7XG4gIH07XG4gIGNvbnN0IGF1dG9Nb3VudCA9IChhdXRvTW91bnRPcHRpb25zKSA9PiB7XG4gICAgaWYgKGF1dG9Nb3VudEluc3RhbmNlKSB7XG4gICAgICBsb2dnZXIud2FybihcImF1dG9Nb3VudCBpcyBhbHJlYWR5IHNldC5cIik7XG4gICAgfVxuICAgIGF1dG9Nb3VudEluc3RhbmNlID0gYXV0b01vdW50VWkoXG4gICAgICB7IG1vdW50LCB1bm1vdW50LCBzdG9wQXV0b01vdW50IH0sXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIC4uLmF1dG9Nb3VudE9wdGlvbnNcbiAgICAgIH1cbiAgICApO1xuICB9O1xuICByZXR1cm4ge1xuICAgIG1vdW50LFxuICAgIHJlbW92ZSxcbiAgICBhdXRvTW91bnRcbiAgfTtcbn1cbmZ1bmN0aW9uIGF1dG9Nb3VudFVpKHVpQ2FsbGJhY2tzLCBvcHRpb25zKSB7XG4gIGNvbnN0IGFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgY29uc3QgRVhQTElDSVRfU1RPUF9SRUFTT04gPSBcImV4cGxpY2l0X3N0b3BfYXV0b19tb3VudFwiO1xuICBjb25zdCBfc3RvcEF1dG9Nb3VudCA9ICgpID0+IHtcbiAgICBhYm9ydENvbnRyb2xsZXIuYWJvcnQoRVhQTElDSVRfU1RPUF9SRUFTT04pO1xuICAgIG9wdGlvbnMub25TdG9wPy4oKTtcbiAgfTtcbiAgbGV0IHJlc29sdmVkQW5jaG9yID0gdHlwZW9mIG9wdGlvbnMuYW5jaG9yID09PSBcImZ1bmN0aW9uXCIgPyBvcHRpb25zLmFuY2hvcigpIDogb3B0aW9ucy5hbmNob3I7XG4gIGlmIChyZXNvbHZlZEFuY2hvciBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICB0aHJvdyBFcnJvcihcbiAgICAgIFwiYXV0b01vdW50IGFuZCBFbGVtZW50IGFuY2hvciBvcHRpb24gY2Fubm90IGJlIGNvbWJpbmVkLiBBdm9pZCBwYXNzaW5nIGBFbGVtZW50YCBkaXJlY3RseSBvciBgKCkgPT4gRWxlbWVudGAgdG8gdGhlIGFuY2hvci5cIlxuICAgICk7XG4gIH1cbiAgYXN5bmMgZnVuY3Rpb24gb2JzZXJ2ZUVsZW1lbnQoc2VsZWN0b3IpIHtcbiAgICBsZXQgaXNBbmNob3JFeGlzdCA9ICEhZ2V0QW5jaG9yKG9wdGlvbnMpO1xuICAgIGlmIChpc0FuY2hvckV4aXN0KSB7XG4gICAgICB1aUNhbGxiYWNrcy5tb3VudCgpO1xuICAgIH1cbiAgICB3aGlsZSAoIWFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY2hhbmdlZEFuY2hvciA9IGF3YWl0IHdhaXRFbGVtZW50KHNlbGVjdG9yID8/IFwiYm9keVwiLCB7XG4gICAgICAgICAgY3VzdG9tTWF0Y2hlcjogKCkgPT4gZ2V0QW5jaG9yKG9wdGlvbnMpID8/IG51bGwsXG4gICAgICAgICAgZGV0ZWN0b3I6IGlzQW5jaG9yRXhpc3QgPyByZW1vdmVEZXRlY3RvciA6IG1vdW50RGV0ZWN0b3IsXG4gICAgICAgICAgc2lnbmFsOiBhYm9ydENvbnRyb2xsZXIuc2lnbmFsXG4gICAgICAgIH0pO1xuICAgICAgICBpc0FuY2hvckV4aXN0ID0gISFjaGFuZ2VkQW5jaG9yO1xuICAgICAgICBpZiAoaXNBbmNob3JFeGlzdCkge1xuICAgICAgICAgIHVpQ2FsbGJhY2tzLm1vdW50KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdWlDYWxsYmFja3MudW5tb3VudCgpO1xuICAgICAgICAgIGlmIChvcHRpb25zLm9uY2UpIHtcbiAgICAgICAgICAgIHVpQ2FsbGJhY2tzLnN0b3BBdXRvTW91bnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGlmIChhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQgJiYgYWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZWFzb24gPT09IEVYUExJQ0lUX1NUT1BfUkVBU09OKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgb2JzZXJ2ZUVsZW1lbnQocmVzb2x2ZWRBbmNob3IpO1xuICByZXR1cm4geyBzdG9wQXV0b01vdW50OiBfc3RvcEF1dG9Nb3VudCB9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIHNwbGl0U2hhZG93Um9vdENzcyhjc3MpIHtcbiAgbGV0IHNoYWRvd0NzcyA9IGNzcztcbiAgbGV0IGRvY3VtZW50Q3NzID0gXCJcIjtcbiAgY29uc3QgcnVsZXNSZWdleCA9IC8oXFxzKkAocHJvcGVydHl8Zm9udC1mYWNlKVtcXHNcXFNdKj97W1xcc1xcU10qP30pL2dtO1xuICBsZXQgbWF0Y2g7XG4gIHdoaWxlICgobWF0Y2ggPSBydWxlc1JlZ2V4LmV4ZWMoY3NzKSkgIT09IG51bGwpIHtcbiAgICBkb2N1bWVudENzcyArPSBtYXRjaFsxXTtcbiAgICBzaGFkb3dDc3MgPSBzaGFkb3dDc3MucmVwbGFjZShtYXRjaFsxXSwgXCJcIik7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBkb2N1bWVudENzczogZG9jdW1lbnRDc3MudHJpbSgpLFxuICAgIHNoYWRvd0Nzczogc2hhZG93Q3NzLnRyaW0oKVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgY3JlYXRlSXNvbGF0ZWRFbGVtZW50IH0gZnJvbSBcIkB3ZWJleHQtY29yZS9pc29sYXRlZC1lbGVtZW50XCI7XG5pbXBvcnQgeyBhcHBseVBvc2l0aW9uLCBjcmVhdGVNb3VudEZ1bmN0aW9ucywgbW91bnRVaSB9IGZyb20gXCIuL3NoYXJlZC5tanNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQgeyBzcGxpdFNoYWRvd1Jvb3RDc3MgfSBmcm9tIFwiLi4vc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qc1wiO1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVNoYWRvd1Jvb3RVaShjdHgsIG9wdGlvbnMpIHtcbiAgY29uc3QgaW5zdGFuY2VJZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZygyLCAxNSk7XG4gIGNvbnN0IGNzcyA9IFtdO1xuICBpZiAoIW9wdGlvbnMuaW5oZXJpdFN0eWxlcykge1xuICAgIGNzcy5wdXNoKGAvKiBXWFQgU2hhZG93IFJvb3QgUmVzZXQgKi8gOmhvc3R7YWxsOmluaXRpYWwgIWltcG9ydGFudDt9YCk7XG4gIH1cbiAgaWYgKG9wdGlvbnMuY3NzKSB7XG4gICAgY3NzLnB1c2gob3B0aW9ucy5jc3MpO1xuICB9XG4gIGlmIChjdHgub3B0aW9ucz8uY3NzSW5qZWN0aW9uTW9kZSA9PT0gXCJ1aVwiKSB7XG4gICAgY29uc3QgZW50cnlDc3MgPSBhd2FpdCBsb2FkQ3NzKCk7XG4gICAgY3NzLnB1c2goZW50cnlDc3MucmVwbGFjZUFsbChcIjpyb290XCIsIFwiOmhvc3RcIikpO1xuICB9XG4gIGNvbnN0IHsgc2hhZG93Q3NzLCBkb2N1bWVudENzcyB9ID0gc3BsaXRTaGFkb3dSb290Q3NzKGNzcy5qb2luKFwiXFxuXCIpLnRyaW0oKSk7XG4gIGNvbnN0IHtcbiAgICBpc29sYXRlZEVsZW1lbnQ6IHVpQ29udGFpbmVyLFxuICAgIHBhcmVudEVsZW1lbnQ6IHNoYWRvd0hvc3QsXG4gICAgc2hhZG93XG4gIH0gPSBhd2FpdCBjcmVhdGVJc29sYXRlZEVsZW1lbnQoe1xuICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICBjc3M6IHtcbiAgICAgIHRleHRDb250ZW50OiBzaGFkb3dDc3NcbiAgICB9LFxuICAgIG1vZGU6IG9wdGlvbnMubW9kZSA/PyBcIm9wZW5cIixcbiAgICBpc29sYXRlRXZlbnRzOiBvcHRpb25zLmlzb2xhdGVFdmVudHNcbiAgfSk7XG4gIHNoYWRvd0hvc3Quc2V0QXR0cmlidXRlKFwiZGF0YS13eHQtc2hhZG93LXJvb3RcIiwgXCJcIik7XG4gIGxldCBtb3VudGVkO1xuICBjb25zdCBtb3VudCA9ICgpID0+IHtcbiAgICBtb3VudFVpKHNoYWRvd0hvc3QsIG9wdGlvbnMpO1xuICAgIGFwcGx5UG9zaXRpb24oc2hhZG93SG9zdCwgc2hhZG93LnF1ZXJ5U2VsZWN0b3IoXCJodG1sXCIpLCBvcHRpb25zKTtcbiAgICBpZiAoZG9jdW1lbnRDc3MgJiYgIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXG4gICAgICBgc3R5bGVbd3h0LXNoYWRvdy1yb290LWRvY3VtZW50LXN0eWxlcz1cIiR7aW5zdGFuY2VJZH1cIl1gXG4gICAgKSkge1xuICAgICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XG4gICAgICBzdHlsZS50ZXh0Q29udGVudCA9IGRvY3VtZW50Q3NzO1xuICAgICAgc3R5bGUuc2V0QXR0cmlidXRlKFwid3h0LXNoYWRvdy1yb290LWRvY3VtZW50LXN0eWxlc1wiLCBpbnN0YW5jZUlkKTtcbiAgICAgIChkb2N1bWVudC5oZWFkID8/IGRvY3VtZW50LmJvZHkpLmFwcGVuZChzdHlsZSk7XG4gICAgfVxuICAgIG1vdW50ZWQgPSBvcHRpb25zLm9uTW91bnQodWlDb250YWluZXIsIHNoYWRvdywgc2hhZG93SG9zdCk7XG4gIH07XG4gIGNvbnN0IHJlbW92ZSA9ICgpID0+IHtcbiAgICBvcHRpb25zLm9uUmVtb3ZlPy4obW91bnRlZCk7XG4gICAgc2hhZG93SG9zdC5yZW1vdmUoKTtcbiAgICBjb25zdCBkb2N1bWVudFN0eWxlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgIGBzdHlsZVt3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzPVwiJHtpbnN0YW5jZUlkfVwiXWBcbiAgICApO1xuICAgIGRvY3VtZW50U3R5bGU/LnJlbW92ZSgpO1xuICAgIHdoaWxlICh1aUNvbnRhaW5lci5sYXN0Q2hpbGQpXG4gICAgICB1aUNvbnRhaW5lci5yZW1vdmVDaGlsZCh1aUNvbnRhaW5lci5sYXN0Q2hpbGQpO1xuICAgIG1vdW50ZWQgPSB2b2lkIDA7XG4gIH07XG4gIGNvbnN0IG1vdW50RnVuY3Rpb25zID0gY3JlYXRlTW91bnRGdW5jdGlvbnMoXG4gICAge1xuICAgICAgbW91bnQsXG4gICAgICByZW1vdmVcbiAgICB9LFxuICAgIG9wdGlvbnNcbiAgKTtcbiAgY3R4Lm9uSW52YWxpZGF0ZWQocmVtb3ZlKTtcbiAgcmV0dXJuIHtcbiAgICBzaGFkb3csXG4gICAgc2hhZG93SG9zdCxcbiAgICB1aUNvbnRhaW5lcixcbiAgICAuLi5tb3VudEZ1bmN0aW9ucyxcbiAgICBnZXQgbW91bnRlZCgpIHtcbiAgICAgIHJldHVybiBtb3VudGVkO1xuICAgIH1cbiAgfTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGxvYWRDc3MoKSB7XG4gIGNvbnN0IHVybCA9IGJyb3dzZXIucnVudGltZS5nZXRVUkwoYC9jb250ZW50LXNjcmlwdHMvJHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH0uY3NzYCk7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsKTtcbiAgICByZXR1cm4gYXdhaXQgcmVzLnRleHQoKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgbG9nZ2VyLndhcm4oXG4gICAgICBgRmFpbGVkIHRvIGxvYWQgc3R5bGVzIEAgJHt1cmx9LiBEaWQgeW91IGZvcmdldCB0byBpbXBvcnQgdGhlIHN0eWxlc2hlZXQgaW4geW91ciBlbnRyeXBvaW50P2AsXG4gICAgICBlcnJcbiAgICApO1xuICAgIHJldHVybiBcIlwiO1xuICB9XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiZnVuY3Rpb24gcihlKXt2YXIgdCxmLG49XCJcIjtpZihcInN0cmluZ1wiPT10eXBlb2YgZXx8XCJudW1iZXJcIj09dHlwZW9mIGUpbis9ZTtlbHNlIGlmKFwib2JqZWN0XCI9PXR5cGVvZiBlKWlmKEFycmF5LmlzQXJyYXkoZSkpe3ZhciBvPWUubGVuZ3RoO2Zvcih0PTA7dDxvO3QrKyllW3RdJiYoZj1yKGVbdF0pKSYmKG4mJihuKz1cIiBcIiksbis9Zil9ZWxzZSBmb3IoZiBpbiBlKWVbZl0mJihuJiYobis9XCIgXCIpLG4rPWYpO3JldHVybiBufWV4cG9ydCBmdW5jdGlvbiBjbHN4KCl7Zm9yKHZhciBlLHQsZj0wLG49XCJcIixvPWFyZ3VtZW50cy5sZW5ndGg7ZjxvO2YrKykoZT1hcmd1bWVudHNbZl0pJiYodD1yKGUpKSYmKG4mJihuKz1cIiBcIiksbis9dCk7cmV0dXJuIG59ZXhwb3J0IGRlZmF1bHQgY2xzeDsiLCJpbXBvcnQgeyBjbHN4LCB0eXBlIENsYXNzVmFsdWUgfSBmcm9tICdjbHN4J1xuXG5leHBvcnQgZnVuY3Rpb24gY24oLi4uaW5wdXRzOiBDbGFzc1ZhbHVlW10pIHtcbiAgcmV0dXJuIGNsc3goaW5wdXRzKVxufSIsImltcG9ydCB7IFNob3csIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50LCBKU1ggfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBIZWFkZXJQcm9wcyB7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBsb2dvPzogSlNYLkVsZW1lbnQ7XG4gIGFjdGlvbnM/OiBKU1guRWxlbWVudDtcbiAgdmFyaWFudD86ICdkZWZhdWx0JyB8ICdtaW5pbWFsJyB8ICd0cmFuc3BhcmVudCc7XG4gIHN0aWNreT86IGJvb2xlYW47XG4gIHNob3dNZW51QnV0dG9uPzogYm9vbGVhbjtcbiAgb25NZW51Q2xpY2s/OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEhlYWRlcjogQ29tcG9uZW50PEhlYWRlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbaXNTY3JvbGxlZCwgc2V0SXNTY3JvbGxlZF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuXG4gIC8vIFRyYWNrIHNjcm9sbCBwb3NpdGlvbiBmb3Igc3RpY2t5IGhlYWRlciBlZmZlY3RzXG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiBwcm9wcy5zdGlja3kpIHtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgKCkgPT4ge1xuICAgICAgc2V0SXNTY3JvbGxlZCh3aW5kb3cuc2Nyb2xsWSA+IDEwKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHZhcmlhbnQgPSAoKSA9PiBwcm9wcy52YXJpYW50IHx8ICdkZWZhdWx0JztcblxuICByZXR1cm4gKFxuICAgIDxoZWFkZXJcbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ3ctZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0yMDAnLFxuICAgICAgICB7XG4gICAgICAgICAgLy8gVmFyaWFudHNcbiAgICAgICAgICAnYmctc3VyZmFjZSBib3JkZXItYiBib3JkZXItc3VidGxlJzogdmFyaWFudCgpID09PSAnZGVmYXVsdCcsXG4gICAgICAgICAgJ2JnLXRyYW5zcGFyZW50JzogdmFyaWFudCgpID09PSAnbWluaW1hbCcgfHwgdmFyaWFudCgpID09PSAndHJhbnNwYXJlbnQnLFxuICAgICAgICAgICdiYWNrZHJvcC1ibHVyLW1kIGJnLXN1cmZhY2UvODAnOiB2YXJpYW50KCkgPT09ICd0cmFuc3BhcmVudCcgJiYgaXNTY3JvbGxlZCgpLFxuICAgICAgICAgIC8vIFN0aWNreSBiZWhhdmlvclxuICAgICAgICAgICdzdGlja3kgdG9wLTAgei01MCc6IHByb3BzLnN0aWNreSxcbiAgICAgICAgICAnc2hhZG93LWxnJzogcHJvcHMuc3RpY2t5ICYmIGlzU2Nyb2xsZWQoKSxcbiAgICAgICAgfSxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgPGRpdiBjbGFzcz1cIm1heC13LXNjcmVlbi14bCBteC1hdXRvIHB4LTQgc206cHgtNiBsZzpweC04XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gaC0xNlwiPlxuICAgICAgICAgIHsvKiBMZWZ0IHNlY3Rpb24gKi99XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC00XCI+XG4gICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zaG93TWVudUJ1dHRvbn0+XG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbk1lbnVDbGlja31cbiAgICAgICAgICAgICAgICBjbGFzcz1cInAtMiByb3VuZGVkLWxnIGhvdmVyOmJnLWhpZ2hsaWdodCB0cmFuc2l0aW9uLWNvbG9ycyBsZzpoaWRkZW5cIlxuICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCJNZW51XCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxzdmcgY2xhc3M9XCJ3LTYgaC02XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCI+XG4gICAgICAgICAgICAgICAgICA8cGF0aCBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBzdHJva2Utd2lkdGg9XCIyXCIgZD1cIk00IDZoMTZNNCAxMmgxNk00IDE4aDE2XCIgLz5cbiAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmxvZ299IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMudGl0bGV9PlxuICAgICAgICAgICAgICAgIDxoMSBjbGFzcz1cInRleHQteGwgZm9udC1ib2xkIHRleHQtcHJpbWFyeVwiPntwcm9wcy50aXRsZX08L2gxPlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICB9PlxuICAgICAgICAgICAgICB7cHJvcHMubG9nb31cbiAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgIHsvKiBSaWdodCBzZWN0aW9uICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmFjdGlvbnN9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgIHtwcm9wcy5hY3Rpb25zfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvaGVhZGVyPlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNjb3JlUGFuZWxQcm9wcyB7XG4gIHNjb3JlOiBudW1iZXI7XG4gIHJhbms6IG51bWJlcjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBTY29yZVBhbmVsOiBDb21wb25lbnQ8U2NvcmVQYW5lbFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdncmlkIGdyaWQtY29scy1bMWZyXzFmcl0gZ2FwLTIgcC00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBTY29yZSBCb3ggKi99XG4gICAgICA8ZGl2IGNsYXNzPVwiYmctc3VyZmFjZSByb3VuZGVkLWxnIHAtNCBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBtaW4taC1bODBweF1cIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtMnhsIGZvbnQtbW9ubyBmb250LWJvbGQgdGV4dC1wdXJwbGUtNTAwXCI+XG4gICAgICAgICAge3Byb3BzLnNjb3JlfVxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtc20gdGV4dC1zZWNvbmRhcnkgbXQtMVwiPlxuICAgICAgICAgIFNjb3JlXG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICBcbiAgICAgIHsvKiBSYW5rIEJveCAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJiZy1zdXJmYWNlIHJvdW5kZWQtbGcgcC00IGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIG1pbi1oLVs4MHB4XVwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0yeGwgZm9udC1tb25vIGZvbnQtYm9sZCB0ZXh0LXBpbmstNTAwXCI+XG4gICAgICAgICAge3Byb3BzLnJhbmt9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+XG4gICAgICAgICAgUmFua1xuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93LCBzcGxpdFByb3BzIH0gZnJvbSAnc29saWQtanMnXG5pbXBvcnQgdHlwZSB7IEpTWCB9IGZyb20gJ3NvbGlkLWpzJ1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbidcblxuZXhwb3J0IGludGVyZmFjZSBCdXR0b25Qcm9wcyBleHRlbmRzIEpTWC5CdXR0b25IVE1MQXR0cmlidXRlczxIVE1MQnV0dG9uRWxlbWVudD4ge1xuICB2YXJpYW50PzogJ3ByaW1hcnknIHwgJ3NlY29uZGFyeScgfCAnZ2hvc3QnIHwgJ2RhbmdlcidcbiAgc2l6ZT86ICdzbScgfCAnbWQnIHwgJ2xnJ1xuICBmdWxsV2lkdGg/OiBib29sZWFuXG4gIGxvYWRpbmc/OiBib29sZWFuXG4gIGxlZnRJY29uPzogSlNYLkVsZW1lbnRcbiAgcmlnaHRJY29uPzogSlNYLkVsZW1lbnRcbn1cblxuZXhwb3J0IGNvbnN0IEJ1dHRvbiA9IChwcm9wczogQnV0dG9uUHJvcHMpID0+IHtcbiAgY29uc3QgW2xvY2FsLCBvdGhlcnNdID0gc3BsaXRQcm9wcyhwcm9wcywgW1xuICAgICd2YXJpYW50JyxcbiAgICAnc2l6ZScsXG4gICAgJ2Z1bGxXaWR0aCcsXG4gICAgJ2xvYWRpbmcnLFxuICAgICdsZWZ0SWNvbicsXG4gICAgJ3JpZ2h0SWNvbicsXG4gICAgJ2NoaWxkcmVuJyxcbiAgICAnY2xhc3MnLFxuICAgICdkaXNhYmxlZCcsXG4gIF0pXG5cbiAgY29uc3QgdmFyaWFudCA9ICgpID0+IGxvY2FsLnZhcmlhbnQgfHwgJ3ByaW1hcnknXG4gIGNvbnN0IHNpemUgPSAoKSA9PiBsb2NhbC5zaXplIHx8ICdtZCdcblxuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIGRpc2FibGVkPXtsb2NhbC5kaXNhYmxlZCB8fCBsb2NhbC5sb2FkaW5nfVxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAnaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGZvbnQtbWVkaXVtIHRyYW5zaXRpb24tYWxsIGN1cnNvci1wb2ludGVyIG91dGxpbmUtbm9uZSBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS01MCcsXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBWYXJpYW50c1xuICAgICAgICAgICdiZy1ncmFkaWVudC1wcmltYXJ5IHRleHQtd2hpdGUgaG92ZXI6c2hhZG93LWxnIGhvdmVyOnNjYWxlLTEwNSBnbG93LXByaW1hcnknOlxuICAgICAgICAgICAgdmFyaWFudCgpID09PSAncHJpbWFyeScsXG4gICAgICAgICAgJ2JnLXN1cmZhY2UgdGV4dC1wcmltYXJ5IGJvcmRlciBib3JkZXItZGVmYXVsdCBob3ZlcjpiZy1lbGV2YXRlZCBob3Zlcjpib3JkZXItc3Ryb25nJzpcbiAgICAgICAgICAgIHZhcmlhbnQoKSA9PT0gJ3NlY29uZGFyeScsXG4gICAgICAgICAgJ3RleHQtc2Vjb25kYXJ5IGhvdmVyOnRleHQtcHJpbWFyeSBob3ZlcjpiZy1zdXJmYWNlJzpcbiAgICAgICAgICAgIHZhcmlhbnQoKSA9PT0gJ2dob3N0JyxcbiAgICAgICAgICAnYmctcmVkLTYwMCB0ZXh0LXdoaXRlIGhvdmVyOmJnLXJlZC03MDAgaG92ZXI6c2hhZG93LWxnJzpcbiAgICAgICAgICAgIHZhcmlhbnQoKSA9PT0gJ2RhbmdlcicsXG4gICAgICAgICAgLy8gU2l6ZXNcbiAgICAgICAgICAnaC04IHB4LTMgdGV4dC1zbSByb3VuZGVkLW1kIGdhcC0xLjUnOiBzaXplKCkgPT09ICdzbScsXG4gICAgICAgICAgJ2gtMTAgcHgtNCB0ZXh0LWJhc2Ugcm91bmRlZC1sZyBnYXAtMic6IHNpemUoKSA9PT0gJ21kJyxcbiAgICAgICAgICAnaC0xMiBweC02IHRleHQtbGcgcm91bmRlZC1sZyBnYXAtMi41Jzogc2l6ZSgpID09PSAnbGcnLFxuICAgICAgICAgIC8vIEZ1bGwgd2lkdGhcbiAgICAgICAgICAndy1mdWxsJzogbG9jYWwuZnVsbFdpZHRoLFxuICAgICAgICAgIC8vIExvYWRpbmcgc3RhdGVcbiAgICAgICAgICAnY3Vyc29yLXdhaXQnOiBsb2NhbC5sb2FkaW5nLFxuICAgICAgICB9LFxuICAgICAgICBsb2NhbC5jbGFzc1xuICAgICAgKX1cbiAgICAgIHsuLi5vdGhlcnN9XG4gICAgPlxuICAgICAgPFNob3cgd2hlbj17bG9jYWwubG9hZGluZ30+XG4gICAgICAgIDxzdmdcbiAgICAgICAgICBjbGFzcz1cImFuaW1hdGUtc3BpbiBoLTQgdy00XCJcbiAgICAgICAgICB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCJcbiAgICAgICAgICBmaWxsPVwibm9uZVwiXG4gICAgICAgICAgdmlld0JveD1cIjAgMCAyNCAyNFwiXG4gICAgICAgID5cbiAgICAgICAgICA8Y2lyY2xlXG4gICAgICAgICAgICBjbGFzcz1cIm9wYWNpdHktMjVcIlxuICAgICAgICAgICAgY3g9XCIxMlwiXG4gICAgICAgICAgICBjeT1cIjEyXCJcbiAgICAgICAgICAgIHI9XCIxMFwiXG4gICAgICAgICAgICBzdHJva2U9XCJjdXJyZW50Q29sb3JcIlxuICAgICAgICAgICAgc3Ryb2tlLXdpZHRoPVwiNFwiXG4gICAgICAgICAgLz5cbiAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgY2xhc3M9XCJvcGFjaXR5LTc1XCJcbiAgICAgICAgICAgIGZpbGw9XCJjdXJyZW50Q29sb3JcIlxuICAgICAgICAgICAgZD1cIk00IDEyYTggOCAwIDAxOC04VjBDNS4zNzMgMCAwIDUuMzczIDAgMTJoNHptMiA1LjI5MUE3Ljk2MiA3Ljk2MiAwIDAxNCAxMkgwYzAgMy4wNDIgMS4xMzUgNS44MjQgMyA3LjkzOGwzLTIuNjQ3elwiXG4gICAgICAgICAgLz5cbiAgICAgICAgPC9zdmc+XG4gICAgICA8L1Nob3c+XG5cbiAgICAgIDxTaG93IHdoZW49e2xvY2FsLmxlZnRJY29uICYmICFsb2NhbC5sb2FkaW5nfT5cbiAgICAgICAge2xvY2FsLmxlZnRJY29ufVxuICAgICAgPC9TaG93PlxuXG4gICAgICA8U2hvdyB3aGVuPXtsb2NhbC5jaGlsZHJlbn0+XG4gICAgICAgIDxzcGFuPntsb2NhbC5jaGlsZHJlbn08L3NwYW4+XG4gICAgICA8L1Nob3c+XG5cbiAgICAgIDxTaG93IHdoZW49e2xvY2FsLnJpZ2h0SWNvbn0+XG4gICAgICAgIHtsb2NhbC5yaWdodEljb259XG4gICAgICA8L1Nob3c+XG4gICAgPC9idXR0b24+XG4gIClcbn0iLCJpbXBvcnQgeyBTaG93LCBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL0J1dHRvbic7XG5cbmV4cG9ydCB0eXBlIE9uYm9hcmRpbmdTdGVwID0gJ2Nvbm5lY3Qtd2FsbGV0JyB8ICdnZW5lcmF0aW5nLXRva2VuJyB8ICdjb21wbGV0ZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT25ib2FyZGluZ0Zsb3dQcm9wcyB7XG4gIHN0ZXA6IE9uYm9hcmRpbmdTdGVwO1xuICBlcnJvcj86IHN0cmluZyB8IG51bGw7XG4gIHdhbGxldEFkZHJlc3M/OiBzdHJpbmcgfCBudWxsO1xuICB0b2tlbj86IHN0cmluZyB8IG51bGw7XG4gIG9uQ29ubmVjdFdhbGxldDogKCkgPT4gdm9pZDtcbiAgb25Vc2VUZXN0TW9kZTogKCkgPT4gdm9pZDtcbiAgb25Vc2VQcml2YXRlS2V5OiAocHJpdmF0ZUtleTogc3RyaW5nKSA9PiB2b2lkO1xuICBvbkNvbXBsZXRlOiAoKSA9PiB2b2lkO1xuICBpc0Nvbm5lY3Rpbmc/OiBib29sZWFuO1xuICBpc0dlbmVyYXRpbmc/OiBib29sZWFuO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IE9uYm9hcmRpbmdGbG93OiBDb21wb25lbnQ8T25ib2FyZGluZ0Zsb3dQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW3Nob3dUZXN0T3B0aW9uLCBzZXRTaG93VGVzdE9wdGlvbl0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbc2hvd1ByaXZhdGVLZXlJbnB1dCwgc2V0U2hvd1ByaXZhdGVLZXlJbnB1dF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbcHJpdmF0ZUtleSwgc2V0UHJpdmF0ZUtleV0gPSBjcmVhdGVTaWduYWwoJycpO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAnbWluLWgtc2NyZWVuIGJnLWdyYWRpZW50LXRvLWJyIGZyb20tZ3JheS05MDAgdG8tYmxhY2sgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXInLFxuICAgICAgcHJvcHMuY2xhc3NcbiAgICApfT5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy0yeGwgdy1mdWxsIHAtMTJcIj5cbiAgICAgICAgey8qIExvZ28vSGVhZGVyICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgbWItMTJcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC04eGwgbWItNlwiPvCfjqQ8L2Rpdj5cbiAgICAgICAgICA8aDEgY2xhc3M9XCJ0ZXh0LTZ4bCBmb250LWJvbGQgdGV4dC13aGl0ZSBtYi00XCI+XG4gICAgICAgICAgICBTY2FybGV0dCBLYXJhb2tlXG4gICAgICAgICAgPC9oMT5cbiAgICAgICAgICA8cCBjbGFzcz1cInRleHQteGwgdGV4dC1ncmF5LTQwMFwiPlxuICAgICAgICAgICAgQUktcG93ZXJlZCBrYXJhb2tlIGZvciBTb3VuZENsb3VkXG4gICAgICAgICAgPC9wPlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICB7LyogUHJvZ3Jlc3MgRG90cyAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgganVzdGlmeS1jZW50ZXIgbWItMTJcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBnYXAtM1wiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICd3LTMgaC0zIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICAgICAgICBwcm9wcy5zdGVwID09PSAnY29ubmVjdC13YWxsZXQnIFxuICAgICAgICAgICAgICAgID8gJ2JnLXB1cnBsZS01MDAgdy0xMicgXG4gICAgICAgICAgICAgICAgOiBwcm9wcy53YWxsZXRBZGRyZXNzIFxuICAgICAgICAgICAgICAgICAgPyAnYmctZ3JlZW4tNTAwJyBcbiAgICAgICAgICAgICAgICAgIDogJ2JnLWdyYXktNjAwJ1xuICAgICAgICAgICAgKX0gLz5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAndy0zIGgtMyByb3VuZGVkLWZ1bGwgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgICAgICAgcHJvcHMuc3RlcCA9PT0gJ2dlbmVyYXRpbmctdG9rZW4nIFxuICAgICAgICAgICAgICAgID8gJ2JnLXB1cnBsZS01MDAgdy0xMicgXG4gICAgICAgICAgICAgICAgOiBwcm9wcy50b2tlbiBcbiAgICAgICAgICAgICAgICAgID8gJ2JnLWdyZWVuLTUwMCcgXG4gICAgICAgICAgICAgICAgICA6ICdiZy1ncmF5LTYwMCdcbiAgICAgICAgICAgICl9IC8+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3ctMyBoLTMgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgICAgICAgIHByb3BzLnN0ZXAgPT09ICdjb21wbGV0ZScgXG4gICAgICAgICAgICAgICAgPyAnYmctZ3JlZW4tNTAwIHctMTInIFxuICAgICAgICAgICAgICAgIDogJ2JnLWdyYXktNjAwJ1xuICAgICAgICAgICAgKX0gLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgey8qIEVycm9yIERpc3BsYXkgKi99XG4gICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmVycm9yfT5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwibWItOCBwLTYgYmctcmVkLTkwMC8yMCBib3JkZXIgYm9yZGVyLXJlZC04MDAgcm91bmRlZC14bFwiPlxuICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXJlZC00MDAgdGV4dC1jZW50ZXIgdGV4dC1sZ1wiPntwcm9wcy5lcnJvcn08L3A+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvU2hvdz5cblxuICAgICAgICB7LyogQ29udGVudCAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNlwiPlxuICAgICAgICAgIHsvKiBDb25uZWN0IFdhbGxldCBTdGVwICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnN0ZXAgPT09ICdjb25uZWN0LXdhbGxldCd9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIHNwYWNlLXktOFwiPlxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQtNHhsIGZvbnQtc2VtaWJvbGQgdGV4dC13aGl0ZSBtYi00XCI+XG4gICAgICAgICAgICAgICAgICBDb25uZWN0IFlvdXIgV2FsbGV0XG4gICAgICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS00MDAgdGV4dC1sZyBtYXgtdy1tZCBteC1hdXRvXCI+XG4gICAgICAgICAgICAgICAgICBDb25uZWN0IHlvdXIgd2FsbGV0IHRvIGdldCBzdGFydGVkXG4gICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS00IG1heC13LW1kIG14LWF1dG9cIj5cbiAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNvbm5lY3RXYWxsZXR9XG4gICAgICAgICAgICAgICAgICBkaXNhYmxlZD17cHJvcHMuaXNDb25uZWN0aW5nfVxuICAgICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTYgdGV4dC1sZ1wiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAge3Byb3BzLmlzQ29ubmVjdGluZyA/IChcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidy00IGgtNCBib3JkZXItMiBib3JkZXItY3VycmVudCBib3JkZXItci10cmFuc3BhcmVudCByb3VuZGVkLWZ1bGwgYW5pbWF0ZS1zcGluXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICBDb25uZWN0aW5nLi4uXG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj7wn6aKPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgIENvbm5lY3Qgd2l0aCBNZXRhTWFza1xuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuXG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17IXNob3dUZXN0T3B0aW9uKCkgJiYgIXNob3dQcml2YXRlS2V5SW5wdXQoKX0+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBnYXAtNCBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd1Rlc3RPcHRpb24odHJ1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIGhvdmVyOnRleHQtZ3JheS0zMDAgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgVXNlIGRlbW8gbW9kZVxuICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0ZXh0LWdyYXktNjAwXCI+fDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dQcml2YXRlS2V5SW5wdXQodHJ1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIGhvdmVyOnRleHQtZ3JheS0zMDAgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgVXNlIHByaXZhdGUga2V5XG4gICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17c2hvd1Rlc3RPcHRpb24oKX0+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicHQtNiBzcGFjZS15LTRcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJvcmRlci10IGJvcmRlci1ncmF5LTgwMCBwdC02XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25Vc2VUZXN0TW9kZX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJzZWNvbmRhcnlcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTRcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIENvbnRpbnVlIHdpdGggRGVtbyBNb2RlXG4gICAgICAgICAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd1Rlc3RPcHRpb24oZmFsc2UpfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIGhvdmVyOnRleHQtZ3JheS0zMDAgdHJhbnNpdGlvbi1jb2xvcnMgbXQtM1wiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgQmFja1xuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Nob3dQcml2YXRlS2V5SW5wdXQoKX0+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicHQtNiBzcGFjZS15LTRcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJvcmRlci10IGJvcmRlci1ncmF5LTgwMCBwdC02XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwicGFzc3dvcmRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e3ByaXZhdGVLZXkoKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uSW5wdXQ9eyhlKSA9PiBzZXRQcml2YXRlS2V5KGUuY3VycmVudFRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkVudGVyIHByaXZhdGUga2V5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTQgcHgtNCBiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQtbGcgdGV4dC13aGl0ZSBwbGFjZWhvbGRlci1ncmF5LTUwMCBmb2N1czpvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLXB1cnBsZS01MDBcIlxuICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gcHJvcHMub25Vc2VQcml2YXRlS2V5KHByaXZhdGVLZXkoKSl9XG4gICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17IXByaXZhdGVLZXkoKSB8fCBwcml2YXRlS2V5KCkubGVuZ3RoICE9PSA2NH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJzZWNvbmRhcnlcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTQgbXQtM1wiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgQ29ubmVjdCB3aXRoIFByaXZhdGUgS2V5XG4gICAgICAgICAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTaG93UHJpdmF0ZUtleUlucHV0KGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0UHJpdmF0ZUtleSgnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIGhvdmVyOnRleHQtZ3JheS0zMDAgdHJhbnNpdGlvbi1jb2xvcnMgbXQtM1wiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgQmFja1xuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgIHsvKiBHZW5lcmF0aW5nIFRva2VuIFN0ZXAgKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuc3RlcCA9PT0gJ2dlbmVyYXRpbmctdG9rZW4nfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBzcGFjZS15LThcIj5cbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTR4bCBmb250LXNlbWlib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgICAgICAgU2V0dGluZyBVcCBZb3VyIEFjY291bnRcbiAgICAgICAgICAgICAgICA8L2gyPlxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLndhbGxldEFkZHJlc3N9PlxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQtbGcgbWItM1wiPlxuICAgICAgICAgICAgICAgICAgICBDb25uZWN0ZWQgd2FsbGV0OlxuICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgPGNvZGUgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtcHVycGxlLTQwMCBiZy1ncmF5LTgwMCBweC00IHB5LTIgcm91bmRlZC1sZyBmb250LW1vbm8gaW5saW5lLWJsb2NrXCI+XG4gICAgICAgICAgICAgICAgICAgIHtwcm9wcy53YWxsZXRBZGRyZXNzPy5zbGljZSgwLCA2KX0uLi57cHJvcHMud2FsbGV0QWRkcmVzcz8uc2xpY2UoLTQpfVxuICAgICAgICAgICAgICAgICAgPC9jb2RlPlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB5LTEyXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInctMjAgaC0yMCBib3JkZXItNCBib3JkZXItcHVycGxlLTUwMCBib3JkZXItdC10cmFuc3BhcmVudCByb3VuZGVkLWZ1bGwgYW5pbWF0ZS1zcGluIG14LWF1dG9cIiAvPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS00MDAgdGV4dC14bFwiPlxuICAgICAgICAgICAgICAgIHtwcm9wcy5pc0dlbmVyYXRpbmcgXG4gICAgICAgICAgICAgICAgICA/ICdHZW5lcmF0aW5nIHlvdXIgYWNjZXNzIHRva2VuLi4uJyBcbiAgICAgICAgICAgICAgICAgIDogJ1ZlcmlmeWluZyB5b3VyIGFjY291bnQuLi4nfVxuICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICB7LyogQ29tcGxldGUgU3RlcCAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zdGVwID09PSAnY29tcGxldGUnfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBzcGFjZS15LThcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtOHhsIG1iLTZcIj7wn46JPC9kaXY+XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQtNHhsIGZvbnQtc2VtaWJvbGQgdGV4dC13aGl0ZSBtYi00XCI+XG4gICAgICAgICAgICAgICAgICBZb3UncmUgQWxsIFNldCFcbiAgICAgICAgICAgICAgICA8L2gyPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTQwMCB0ZXh0LXhsIG1heC13LW1kIG14LWF1dG8gbWItOFwiPlxuICAgICAgICAgICAgICAgICAgWW91ciBhY2NvdW50IGlzIHJlYWR5LiBUaW1lIHRvIHNpbmchXG4gICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWF4LXctbWQgbXgtYXV0b1wiPlxuICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ29tcGxldGV9XG4gICAgICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNiB0ZXh0LWxnXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICBTdGFydCBTaW5naW5nISDwn5qAXG4gICAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBtdC02XCI+XG4gICAgICAgICAgICAgICAgTG9vayBmb3IgdGhlIGthcmFva2Ugd2lkZ2V0IG9uIGFueSBTb3VuZENsb3VkIHRyYWNrXG4gICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgRm9yLCBjcmVhdGVFZmZlY3QsIGNyZWF0ZVNpZ25hbCwgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTHlyaWNMaW5lIHtcbiAgaWQ6IHN0cmluZztcbiAgdGV4dDogc3RyaW5nO1xuICBzdGFydFRpbWU6IG51bWJlcjsgLy8gaW4gc2Vjb25kc1xuICBkdXJhdGlvbjogbnVtYmVyOyAvLyBpbiBtaWxsaXNlY29uZHNcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMeXJpY3NEaXNwbGF5UHJvcHMge1xuICBseXJpY3M6IEx5cmljTGluZVtdO1xuICBjdXJyZW50VGltZT86IG51bWJlcjsgLy8gaW4gbWlsbGlzZWNvbmRzXG4gIGlzUGxheWluZz86IGJvb2xlYW47XG4gIGxpbmVTY29yZXM/OiBBcnJheTx7IGxpbmVJbmRleDogbnVtYmVyOyBzY29yZTogbnVtYmVyOyB0cmFuc2NyaXB0aW9uOiBzdHJpbmc7IGZlZWRiYWNrPzogc3RyaW5nIH0+O1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEx5cmljc0Rpc3BsYXk6IENvbXBvbmVudDxMeXJpY3NEaXNwbGF5UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtjdXJyZW50TGluZUluZGV4LCBzZXRDdXJyZW50TGluZUluZGV4XSA9IGNyZWF0ZVNpZ25hbCgtMSk7XG4gIGxldCBjb250YWluZXJSZWY6IEhUTUxEaXZFbGVtZW50IHwgdW5kZWZpbmVkO1xuICBcbiAgLy8gSGVscGVyIHRvIGdldCBzY29yZSBmb3IgYSBsaW5lXG4gIGNvbnN0IGdldExpbmVTY29yZSA9IChsaW5lSW5kZXg6IG51bWJlcikgPT4ge1xuICAgIHJldHVybiBwcm9wcy5saW5lU2NvcmVzPy5maW5kKHMgPT4gcy5saW5lSW5kZXggPT09IGxpbmVJbmRleCk/LnNjb3JlIHx8IG51bGw7XG4gIH07XG4gIFxuICAvLyBIZWxwZXIgdG8gZ2V0IGNvbG9yIGJhc2VkIG9uIHNjb3JlXG4gIGNvbnN0IGdldFNjb3JlU3R5bGUgPSAoc2NvcmU6IG51bWJlciB8IG51bGwpID0+IHtcbiAgICBpZiAoc2NvcmUgPT09IG51bGwpIHJldHVybiB7fTtcbiAgICBcbiAgICAvLyBTaW1wbGUgY29sb3IgY2hhbmdlcyBvbmx5IC0gbm8gYW5pbWF0aW9ucyBvciBlZmZlY3RzXG4gICAgaWYgKHNjb3JlID49IDk1KSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZjM4MzgnIH07XG4gICAgfSBlbHNlIGlmIChzY29yZSA+PSA5MCkge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmY2YjZiJyB9O1xuICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gODApIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmODc4NycgfTtcbiAgICB9IGVsc2UgaWYgKHNjb3JlID49IDcwKSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZmE4YTgnIH07XG4gICAgfSBlbHNlIGlmIChzY29yZSA+PSA2MCkge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmZjZWNlJyB9O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZmUwZTAnIH07XG4gICAgfVxuICB9O1xuICBcbiAgLy8gUmVtb3ZlZCBlbW9qaSBmdW5jdGlvbiAtIHVzaW5nIGNvbG9ycyBvbmx5XG5cbiAgLy8gRmluZCBjdXJyZW50IGxpbmUgYmFzZWQgb24gdGltZVxuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghcHJvcHMuY3VycmVudFRpbWUgfHwgIXByb3BzLmx5cmljcy5sZW5ndGgpIHtcbiAgICAgIHNldEN1cnJlbnRMaW5lSW5kZXgoLTEpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRpbWUgPSBwcm9wcy5jdXJyZW50VGltZSAvIDEwMDA7IC8vIENvbnZlcnQgZnJvbSBtaWxsaXNlY29uZHMgdG8gc2Vjb25kc1xuICAgIGNvbnN0IFRJTUlOR19PRkZTRVQgPSAwLjM7IC8vIE9mZnNldCB0byBtYWtlIGx5cmljcyBhcHBlYXIgMC4zcyBlYXJsaWVyXG4gICAgY29uc3QgYWRqdXN0ZWRUaW1lID0gdGltZSArIFRJTUlOR19PRkZTRVQ7XG4gICAgXG4gICAgLy8gRmluZCB0aGUgbGluZSB0aGF0IGNvbnRhaW5zIHRoZSBjdXJyZW50IHRpbWVcbiAgICBsZXQgZm91bmRJbmRleCA9IC0xO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJvcHMubHlyaWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBsaW5lID0gcHJvcHMubHlyaWNzW2ldO1xuICAgICAgaWYgKCFsaW5lKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGVuZFRpbWUgPSBsaW5lLnN0YXJ0VGltZSArIGxpbmUuZHVyYXRpb24gLyAxMDAwOyAvLyBDb252ZXJ0IGR1cmF0aW9uIGZyb20gbXMgdG8gc2Vjb25kc1xuICAgICAgXG4gICAgICBpZiAoYWRqdXN0ZWRUaW1lID49IGxpbmUuc3RhcnRUaW1lICYmIGFkanVzdGVkVGltZSA8IGVuZFRpbWUpIHtcbiAgICAgICAgZm91bmRJbmRleCA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBJZiBubyBsaW5lIGNvbnRhaW5zIGN1cnJlbnQgdGltZSwgZmluZCB0aGUgbW9zdCByZWNlbnQgcGFzdCBsaW5lXG4gICAgaWYgKGZvdW5kSW5kZXggPT09IC0xICYmIHRpbWUgPiAwKSB7XG4gICAgICBmb3IgKGxldCBpID0gcHJvcHMubHlyaWNzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGNvbnN0IGxpbmUgPSBwcm9wcy5seXJpY3NbaV07XG4gICAgICAgIGlmICghbGluZSkgY29udGludWU7XG4gICAgICAgIGlmICh0aW1lID49IGxpbmUuc3RhcnRUaW1lKSB7XG4gICAgICAgICAgZm91bmRJbmRleCA9IGk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gT25seSB1cGRhdGUgaWYgdGhlIGluZGV4IGhhcyBjaGFuZ2VkIHRvIGF2b2lkIHVubmVjZXNzYXJ5IHNjcm9sbGluZ1xuICAgIGlmIChmb3VuZEluZGV4ICE9PSBjdXJyZW50TGluZUluZGV4KCkpIHtcbiAgICAgIGNvbnN0IHByZXZJbmRleCA9IGN1cnJlbnRMaW5lSW5kZXgoKTtcbiAgICAgIC8vIE9ubHkgbG9nIGxhcmdlIGp1bXBzIHRvIHJlZHVjZSBjb25zb2xlIHNwYW1cbiAgICAgIGlmIChNYXRoLmFicyhmb3VuZEluZGV4IC0gcHJldkluZGV4KSA+IDUpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tMeXJpY3NEaXNwbGF5XSBDdXJyZW50IGxpbmUgY2hhbmdlZDonLCB7XG4gICAgICAgICAgZnJvbTogcHJldkluZGV4LFxuICAgICAgICAgIHRvOiBmb3VuZEluZGV4LFxuICAgICAgICAgIHRpbWU6IHByb3BzLmN1cnJlbnRUaW1lLFxuICAgICAgICAgIHRpbWVJblNlY29uZHM6IHRpbWUsXG4gICAgICAgICAganVtcDogTWF0aC5hYnMoZm91bmRJbmRleCAtIHByZXZJbmRleClcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIExvZyB3YXJuaW5nIGZvciBsYXJnZSBqdW1wc1xuICAgICAgaWYgKHByZXZJbmRleCAhPT0gLTEgJiYgTWF0aC5hYnMoZm91bmRJbmRleCAtIHByZXZJbmRleCkgPiAxMCkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tMeXJpY3NEaXNwbGF5XSBMYXJnZSBsaW5lIGp1bXAgZGV0ZWN0ZWQhJywge1xuICAgICAgICAgIGZyb206IHByZXZJbmRleCxcbiAgICAgICAgICB0bzogZm91bmRJbmRleCxcbiAgICAgICAgICBmcm9tTGluZTogcHJvcHMubHlyaWNzW3ByZXZJbmRleF0sXG4gICAgICAgICAgdG9MaW5lOiBwcm9wcy5seXJpY3NbZm91bmRJbmRleF1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHNldEN1cnJlbnRMaW5lSW5kZXgoZm91bmRJbmRleCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBBdXRvLXNjcm9sbCB0byBjdXJyZW50IGxpbmVcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBpbmRleCA9IGN1cnJlbnRMaW5lSW5kZXgoKTtcbiAgICBpZiAoaW5kZXggPT09IC0xIHx8ICFjb250YWluZXJSZWYgfHwgIXByb3BzLmlzUGxheWluZykgcmV0dXJuO1xuXG4gICAgY29uc3QgbGluZUVsZW1lbnRzID0gY29udGFpbmVyUmVmLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWxpbmUtaW5kZXhdJyk7XG4gICAgY29uc3QgY3VycmVudEVsZW1lbnQgPSBsaW5lRWxlbWVudHNbaW5kZXhdIGFzIEhUTUxFbGVtZW50O1xuXG4gICAgaWYgKGN1cnJlbnRFbGVtZW50KSB7XG4gICAgICBjb25zdCBjb250YWluZXJIZWlnaHQgPSBjb250YWluZXJSZWYuY2xpZW50SGVpZ2h0O1xuICAgICAgY29uc3QgbGluZVRvcCA9IGN1cnJlbnRFbGVtZW50Lm9mZnNldFRvcDtcbiAgICAgIGNvbnN0IGxpbmVIZWlnaHQgPSBjdXJyZW50RWxlbWVudC5vZmZzZXRIZWlnaHQ7XG4gICAgICBcbiAgICAgIC8vIENlbnRlciB0aGUgY3VycmVudCBsaW5lXG4gICAgICBjb25zdCB0YXJnZXRTY3JvbGxUb3AgPSBsaW5lVG9wIC0gY29udGFpbmVySGVpZ2h0IC8gMiArIGxpbmVIZWlnaHQgLyAyO1xuICAgICAgXG4gICAgICBjb250YWluZXJSZWYuc2Nyb2xsVG8oe1xuICAgICAgICB0b3A6IHRhcmdldFNjcm9sbFRvcCxcbiAgICAgICAgYmVoYXZpb3I6ICdzbW9vdGgnLFxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gKFxuICAgIDxkaXZcbiAgICAgIHJlZj17Y29udGFpbmVyUmVmfVxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAnbHlyaWNzLWRpc3BsYXkgb3ZlcmZsb3cteS1hdXRvIHNjcm9sbC1zbW9vdGgnLFxuICAgICAgICAnaC1mdWxsIHB4LTYgcHktMTInLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS04XCI+XG4gICAgICAgIDxGb3IgZWFjaD17cHJvcHMubHlyaWNzfT5cbiAgICAgICAgICB7KGxpbmUsIGluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBsaW5lU2NvcmUgPSAoKSA9PiBnZXRMaW5lU2NvcmUoaW5kZXgoKSk7XG4gICAgICAgICAgICBjb25zdCBzY29yZVN0eWxlID0gKCkgPT4gZ2V0U2NvcmVTdHlsZShsaW5lU2NvcmUoKSk7XG4gICAgICAgICAgICAvLyBVc2luZyBjb2xvciBncmFkaWVudHMgaW5zdGVhZCBvZiBlbW9qaXNcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgIGRhdGEtbGluZS1pbmRleD17aW5kZXgoKX1cbiAgICAgICAgICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICAgICAndGV4dC1jZW50ZXInLFxuICAgICAgICAgICAgICAgICAgJ3RleHQtMnhsIGxlYWRpbmctcmVsYXhlZCcsXG4gICAgICAgICAgICAgICAgICBpbmRleCgpID09PSBjdXJyZW50TGluZUluZGV4KClcbiAgICAgICAgICAgICAgICAgICAgPyAnb3BhY2l0eS0xMDAnXG4gICAgICAgICAgICAgICAgICAgIDogJ29wYWNpdHktNjAnXG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAgICAgY29sb3I6IGluZGV4KCkgPT09IGN1cnJlbnRMaW5lSW5kZXgoKSAmJiAhbGluZVNjb3JlKCkgXG4gICAgICAgICAgICAgICAgICAgID8gJyNmZmZmZmYnIC8vIFdoaXRlIGZvciBjdXJyZW50IGxpbmUgd2l0aG91dCBzY29yZVxuICAgICAgICAgICAgICAgICAgICA6IHNjb3JlU3R5bGUoKS5jb2xvciB8fCAnI2ZmZmZmZidcbiAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAge2xpbmUudGV4dH1cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICApO1xuICAgICAgICAgIH19XG4gICAgICAgIDwvRm9yPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgS2FyYW9rZUhlYWRlclByb3BzIHtcbiAgc29uZ1RpdGxlOiBzdHJpbmc7XG4gIGFydGlzdDogc3RyaW5nO1xuICBvbkJhY2s/OiAoKSA9PiB2b2lkO1xuICBpc1BsYXlpbmc/OiBib29sZWFuO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuY29uc3QgQ2hldnJvbkxlZnQgPSAoKSA9PiAoXG4gIDxzdmcgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIGNsYXNzPVwidy02IGgtNlwiPlxuICAgIDxwYXRoIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiIGQ9XCJNMTUgMTlsLTctNyA3LTdcIiAvPlxuICA8L3N2Zz5cbik7XG5cbmNvbnN0IFBhdXNlSWNvbiA9ICgpID0+IChcbiAgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgY2xhc3M9XCJ3LTYgaC02XCI+XG4gICAgPHBhdGggc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIgZD1cIk0xMCA5djZtNC02djZtNy0zYTkgOSAwIDExLTE4IDAgOSA5IDAgMDExOCAwelwiIC8+XG4gIDwvc3ZnPlxuKTtcblxuZXhwb3J0IGNvbnN0IEthcmFva2VIZWFkZXI6IENvbXBvbmVudDxLYXJhb2tlSGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ3JlbGF0aXZlIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHAtNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogQmFjay9QYXVzZSBidXR0b24gLSBhYnNvbHV0ZSBwb3NpdGlvbmVkICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkJhY2t9XG4gICAgICAgIGNsYXNzPVwiYWJzb2x1dGUgbGVmdC00IHAtMiAtbS0yIHRleHQtc2Vjb25kYXJ5IGhvdmVyOnRleHQtcHJpbWFyeSB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgIGFyaWEtbGFiZWw9e3Byb3BzLmlzUGxheWluZyA/IFwiUGF1c2VcIiA6IFwiR28gYmFja1wifVxuICAgICAgPlxuICAgICAgICB7cHJvcHMuaXNQbGF5aW5nID8gPFBhdXNlSWNvbiAvPiA6IDxDaGV2cm9uTGVmdCAvPn1cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgXG4gICAgICB7LyogU29uZyBpbmZvIC0gY2VudGVyZWQgKi99XG4gICAgICA8aDEgY2xhc3M9XCJ0ZXh0LWJhc2UgZm9udC1tZWRpdW0gdGV4dC1wcmltYXJ5IHRleHQtY2VudGVyIHB4LTEyIHRydW5jYXRlIG1heC13LWZ1bGxcIj5cbiAgICAgICAge3Byb3BzLnNvbmdUaXRsZX0gLSB7cHJvcHMuYXJ0aXN0fVxuICAgICAgPC9oMT5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgRm9yLCBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBMZWFkZXJib2FyZEVudHJ5IHtcbiAgcmFuazogbnVtYmVyO1xuICB1c2VybmFtZTogc3RyaW5nO1xuICBzY29yZTogbnVtYmVyO1xuICBpc0N1cnJlbnRVc2VyPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMZWFkZXJib2FyZFBhbmVsUHJvcHMge1xuICBlbnRyaWVzOiBMZWFkZXJib2FyZEVudHJ5W107XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgTGVhZGVyYm9hcmRQYW5lbDogQ29tcG9uZW50PExlYWRlcmJvYXJkUGFuZWxQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZmxleCBmbGV4LWNvbCBnYXAtMiBwLTQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgPFNob3cgXG4gICAgICAgIHdoZW49e3Byb3BzLmVudHJpZXMubGVuZ3RoID4gMH1cbiAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBweS0xMiBweC02IHRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC02eGwgbWItNCBvcGFjaXR5LTMwXCI+8J+OpDwvZGl2PlxuICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5IG1iLTJcIj5Ob2JvZHkgaGFzIGNvbXBsZXRlZCB0aGlzIHNvbmcgeWV0ITwvcD5cbiAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zbSB0ZXh0LXRlcnRpYXJ5XCI+QmUgdGhlIGZpcnN0IHRvIHNldCBhIGhpZ2ggc2NvcmU8L3A+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIH1cbiAgICAgID5cbiAgICAgICAgPEZvciBlYWNoPXtwcm9wcy5lbnRyaWVzfT5cbiAgICAgICAgICB7KGVudHJ5KSA9PiAoXG4gICAgICAgICAgICA8ZGl2IFxuICAgICAgICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICAgJ2ZsZXggaXRlbXMtY2VudGVyIGdhcC0zIHB4LTMgcHktMiByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzJyxcbiAgICAgICAgICAgICAgICBlbnRyeS5pc0N1cnJlbnRVc2VyIFxuICAgICAgICAgICAgICAgICAgPyAnYmctYWNjZW50LXByaW1hcnkvMTAgYm9yZGVyIGJvcmRlci1hY2NlbnQtcHJpbWFyeS8yMCcgXG4gICAgICAgICAgICAgICAgICA6ICdiZy1zdXJmYWNlIGhvdmVyOmJnLXN1cmZhY2UtaG92ZXInXG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxzcGFuIFxuICAgICAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAgICd3LTggdGV4dC1jZW50ZXIgZm9udC1tb25vIGZvbnQtYm9sZCcsXG4gICAgICAgICAgICAgICAgICBlbnRyeS5yYW5rIDw9IDMgPyAndGV4dC1hY2NlbnQtcHJpbWFyeScgOiAndGV4dC1zZWNvbmRhcnknXG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICN7ZW50cnkucmFua31cbiAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICAgJ2ZsZXgtMSB0cnVuY2F0ZScsXG4gICAgICAgICAgICAgICAgZW50cnkuaXNDdXJyZW50VXNlciA/ICd0ZXh0LWFjY2VudC1wcmltYXJ5IGZvbnQtbWVkaXVtJyA6ICd0ZXh0LXByaW1hcnknXG4gICAgICAgICAgICAgICl9PlxuICAgICAgICAgICAgICAgIHtlbnRyeS51c2VybmFtZX1cbiAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICAgJ2ZvbnQtbW9ubyBmb250LWJvbGQnLFxuICAgICAgICAgICAgICAgIGVudHJ5LmlzQ3VycmVudFVzZXIgPyAndGV4dC1hY2NlbnQtcHJpbWFyeScgOiAndGV4dC1wcmltYXJ5J1xuICAgICAgICAgICAgICApfT5cbiAgICAgICAgICAgICAgICB7ZW50cnkuc2NvcmUudG9Mb2NhbGVTdHJpbmcoKX1cbiAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9Gb3I+XG4gICAgICA8L1Nob3c+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCB0eXBlIFBsYXliYWNrU3BlZWQgPSAnMXgnIHwgJzAuNzV4JyB8ICcwLjV4JztcblxuZXhwb3J0IGludGVyZmFjZSBTcGxpdEJ1dHRvblByb3BzIHtcbiAgb25TdGFydD86ICgpID0+IHZvaWQ7XG4gIG9uU3BlZWRDaGFuZ2U/OiAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpID0+IHZvaWQ7XG4gIGRpc2FibGVkPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmNvbnN0IHNwZWVkczogUGxheWJhY2tTcGVlZFtdID0gWycxeCcsICcwLjc1eCcsICcwLjV4J107XG5cbmV4cG9ydCBjb25zdCBTcGxpdEJ1dHRvbjogQ29tcG9uZW50PFNwbGl0QnV0dG9uUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtjdXJyZW50U3BlZWRJbmRleCwgc2V0Q3VycmVudFNwZWVkSW5kZXhdID0gY3JlYXRlU2lnbmFsKDApO1xuICBcbiAgY29uc3QgY3VycmVudFNwZWVkID0gKCkgPT4gc3BlZWRzW2N1cnJlbnRTcGVlZEluZGV4KCldO1xuICBcbiAgY29uc3QgY3ljbGVTcGVlZCA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBjb25zdCBuZXh0SW5kZXggPSAoY3VycmVudFNwZWVkSW5kZXgoKSArIDEpICUgc3BlZWRzLmxlbmd0aDtcbiAgICBzZXRDdXJyZW50U3BlZWRJbmRleChuZXh0SW5kZXgpO1xuICAgIGNvbnN0IG5ld1NwZWVkID0gc3BlZWRzW25leHRJbmRleF07XG4gICAgaWYgKG5ld1NwZWVkKSB7XG4gICAgICBwcm9wcy5vblNwZWVkQ2hhbmdlPy4obmV3U3BlZWQpO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdyZWxhdGl2ZSBpbmxpbmUtZmxleCB3LWZ1bGwgcm91bmRlZC1sZyBvdmVyZmxvdy1oaWRkZW4nLFxuICAgICAgICAnYmctZ3JhZGllbnQtcHJpbWFyeSB0ZXh0LXdoaXRlIHNoYWRvdy1sZycsXG4gICAgICAgICd0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICB7LyogTWFpbiBidXR0b24gKi99XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uU3RhcnR9XG4gICAgICAgIGRpc2FibGVkPXtwcm9wcy5kaXNhYmxlZH1cbiAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICdmbGV4LTEgaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJlbGF0aXZlIG92ZXJmbG93LWhpZGRlbicsXG4gICAgICAgICAgJ2gtMTIgcHgtNiB0ZXh0LWxnIGZvbnQtbWVkaXVtJyxcbiAgICAgICAgICAnY3Vyc29yLXBvaW50ZXIgYm9yZGVyLW5vbmUgb3V0bGluZS1ub25lJyxcbiAgICAgICAgICAnZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICAgICdob3ZlcjpiZy13aGl0ZS8xMCBhY3RpdmU6Ymctd2hpdGUvMjAnXG4gICAgICAgICl9XG4gICAgICA+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwicmVsYXRpdmUgei0xMFwiPlN0YXJ0PC9zcGFuPlxuICAgICAgPC9idXR0b24+XG4gICAgICBcbiAgICAgIHsvKiBEaXZpZGVyICovfVxuICAgICAgPGRpdiBjbGFzcz1cInctcHggYmctYmxhY2svMjBcIiAvPlxuICAgICAgXG4gICAgICB7LyogU3BlZWQgYnV0dG9uICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtjeWNsZVNwZWVkfVxuICAgICAgICBkaXNhYmxlZD17cHJvcHMuZGlzYWJsZWR9XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJlbGF0aXZlJyxcbiAgICAgICAgICAndy0yMCB0ZXh0LWxnIGZvbnQtbWVkaXVtJyxcbiAgICAgICAgICAnY3Vyc29yLXBvaW50ZXIgYm9yZGVyLW5vbmUgb3V0bGluZS1ub25lJyxcbiAgICAgICAgICAnZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICAgICdob3ZlcjpiZy13aGl0ZS8xMCBhY3RpdmU6Ymctd2hpdGUvMjAnLFxuICAgICAgICAgICdhZnRlcjpjb250ZW50LVtcIlwiXSBhZnRlcjphYnNvbHV0ZSBhZnRlcjppbnNldC0wJyxcbiAgICAgICAgICAnYWZ0ZXI6YmctZ3JhZGllbnQtdG8tciBhZnRlcjpmcm9tLXRyYW5zcGFyZW50IGFmdGVyOnZpYS13aGl0ZS8yMCBhZnRlcjp0by10cmFuc3BhcmVudCcsXG4gICAgICAgICAgJ2FmdGVyOnRyYW5zbGF0ZS14LVstMjAwJV0gaG92ZXI6YWZ0ZXI6dHJhbnNsYXRlLXgtWzIwMCVdJyxcbiAgICAgICAgICAnYWZ0ZXI6dHJhbnNpdGlvbi10cmFuc2Zvcm0gYWZ0ZXI6ZHVyYXRpb24tNzAwJ1xuICAgICAgICApfVxuICAgICAgICBhcmlhLWxhYmVsPVwiQ2hhbmdlIHBsYXliYWNrIHNwZWVkXCJcbiAgICAgID5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJyZWxhdGl2ZSB6LTEwXCI+e2N1cnJlbnRTcGVlZCgpfTwvc3Bhbj5cbiAgICAgIDwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIFNob3csIGNyZWF0ZUNvbnRleHQsIHVzZUNvbnRleHQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCwgSlNYLCBQYXJlbnRDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBUYWIge1xuICBpZDogc3RyaW5nO1xuICBsYWJlbDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNQcm9wcyB7XG4gIHRhYnM6IFRhYltdO1xuICBkZWZhdWx0VGFiPzogc3RyaW5nO1xuICBvblRhYkNoYW5nZT86ICh0YWJJZDogc3RyaW5nKSA9PiB2b2lkO1xuICBjaGlsZHJlbjogSlNYLkVsZW1lbnQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNMaXN0UHJvcHMge1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNUcmlnZ2VyUHJvcHMge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNDb250ZW50UHJvcHMge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG4vLyBDb250ZXh0IGZvciB0YWJzIHN0YXRlXG5pbnRlcmZhY2UgVGFic0NvbnRleHRWYWx1ZSB7XG4gIGFjdGl2ZVRhYjogKCkgPT4gc3RyaW5nO1xuICBzZXRBY3RpdmVUYWI6IChpZDogc3RyaW5nKSA9PiB2b2lkO1xufVxuXG5jb25zdCBUYWJzQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8VGFic0NvbnRleHRWYWx1ZT4oKTtcblxuZXhwb3J0IGNvbnN0IFRhYnM6IFBhcmVudENvbXBvbmVudDxUYWJzUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFthY3RpdmVUYWIsIHNldEFjdGl2ZVRhYl0gPSBjcmVhdGVTaWduYWwocHJvcHMuZGVmYXVsdFRhYiB8fCBwcm9wcy50YWJzWzBdPy5pZCB8fCAnJyk7XG4gIFxuICBjb25zb2xlLmxvZygnW1RhYnNdIEluaXRpYWxpemluZyB3aXRoOicsIHtcbiAgICBkZWZhdWx0VGFiOiBwcm9wcy5kZWZhdWx0VGFiLFxuICAgIGZpcnN0VGFiSWQ6IHByb3BzLnRhYnNbMF0/LmlkLFxuICAgIGFjdGl2ZVRhYjogYWN0aXZlVGFiKClcbiAgfSk7XG4gIFxuICBjb25zdCBoYW5kbGVUYWJDaGFuZ2UgPSAoaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbVGFic10gVGFiIGNoYW5nZWQgdG86JywgaWQpO1xuICAgIHNldEFjdGl2ZVRhYihpZCk7XG4gICAgcHJvcHMub25UYWJDaGFuZ2U/LihpZCk7XG4gIH07XG5cbiAgY29uc3QgY29udGV4dFZhbHVlOiBUYWJzQ29udGV4dFZhbHVlID0ge1xuICAgIGFjdGl2ZVRhYixcbiAgICBzZXRBY3RpdmVUYWI6IGhhbmRsZVRhYkNoYW5nZVxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPFRhYnNDb250ZXh0LlByb3ZpZGVyIHZhbHVlPXtjb250ZXh0VmFsdWV9PlxuICAgICAgPGRpdiBjbGFzcz17Y24oJ3ctZnVsbCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICAgIDwvZGl2PlxuICAgIDwvVGFic0NvbnRleHQuUHJvdmlkZXI+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgVGFic0xpc3Q6IENvbXBvbmVudDxUYWJzTGlzdFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdpbmxpbmUtZmxleCBoLTEwIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLW1kIGJnLXN1cmZhY2UgcC0xIHRleHQtc2Vjb25kYXJ5JyxcbiAgICAgICAgJ3ctZnVsbCcsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICA8L2Rpdj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBUYWJzVHJpZ2dlcjogQ29tcG9uZW50PFRhYnNUcmlnZ2VyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IGNvbnRleHQgPSB1c2VDb250ZXh0KFRhYnNDb250ZXh0KTtcbiAgaWYgKCFjb250ZXh0KSB7XG4gICAgY29uc29sZS5lcnJvcignW1RhYnNUcmlnZ2VyXSBObyBUYWJzQ29udGV4dCBmb3VuZC4gVGFic1RyaWdnZXIgbXVzdCBiZSB1c2VkIHdpdGhpbiBUYWJzIGNvbXBvbmVudC4nKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBcbiAgY29uc3QgaXNBY3RpdmUgPSAoKSA9PiBjb250ZXh0LmFjdGl2ZVRhYigpID09PSBwcm9wcy52YWx1ZTtcblxuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIG9uQ2xpY2s9eygpID0+IGNvbnRleHQuc2V0QWN0aXZlVGFiKHByb3BzLnZhbHVlKX1cbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2lubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB3aGl0ZXNwYWNlLW5vd3JhcCByb3VuZGVkLXNtIHB4LTMgcHktMS41JyxcbiAgICAgICAgJ3RleHQtc20gZm9udC1tZWRpdW0gcmluZy1vZmZzZXQtYmFzZSB0cmFuc2l0aW9uLWFsbCcsXG4gICAgICAgICdmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZSBmb2N1cy12aXNpYmxlOnJpbmctMiBmb2N1cy12aXNpYmxlOnJpbmctcHVycGxlLTUwMCBmb2N1cy12aXNpYmxlOnJpbmctb2Zmc2V0LTInLFxuICAgICAgICAnZGlzYWJsZWQ6cG9pbnRlci1ldmVudHMtbm9uZSBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAgJ2ZsZXgtMScsXG4gICAgICAgIGlzQWN0aXZlKClcbiAgICAgICAgICA/ICdiZy1iYXNlIHRleHQtcHJpbWFyeSBzaGFkb3ctc20nXG4gICAgICAgICAgOiAndGV4dC1zZWNvbmRhcnkgaG92ZXI6dGV4dC1wcmltYXJ5JyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgIDwvYnV0dG9uPlxuICApO1xufTtcblxuZXhwb3J0IGNvbnN0IFRhYnNDb250ZW50OiBDb21wb25lbnQ8VGFic0NvbnRlbnRQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgY29udGV4dCA9IHVzZUNvbnRleHQoVGFic0NvbnRleHQpO1xuICBpZiAoIWNvbnRleHQpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbVGFic0NvbnRlbnRdIE5vIFRhYnNDb250ZXh0IGZvdW5kLiBUYWJzQ29udGVudCBtdXN0IGJlIHVzZWQgd2l0aGluIFRhYnMgY29tcG9uZW50LicpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIFxuICBjb25zdCBpc0FjdGl2ZSA9ICgpID0+IGNvbnRleHQuYWN0aXZlVGFiKCkgPT09IHByb3BzLnZhbHVlO1xuICBcbiAgcmV0dXJuIChcbiAgICA8U2hvdyB3aGVuPXtpc0FjdGl2ZSgpfT5cbiAgICAgIDxkaXZcbiAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICdtdC0yIHJpbmctb2Zmc2V0LWJhc2UnLFxuICAgICAgICAgICdmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZSBmb2N1cy12aXNpYmxlOnJpbmctMiBmb2N1cy12aXNpYmxlOnJpbmctcHVycGxlLTUwMCBmb2N1cy12aXNpYmxlOnJpbmctb2Zmc2V0LTInLFxuICAgICAgICAgIHByb3BzLmNsYXNzXG4gICAgICAgICl9XG4gICAgICA+XG4gICAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICAgIDwvZGl2PlxuICAgIDwvU2hvdz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsLCBjcmVhdGVFZmZlY3QsIFNob3csIG9uQ2xlYW51cCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5pbXBvcnQgc3R5bGVzIGZyb20gJy4vRmlyZUVtb2ppQW5pbWF0aW9uLm1vZHVsZS5jc3MnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZpcmVFbW9qaUFuaW1hdGlvblByb3BzIHtcbiAgc2NvcmU6IG51bWJlcjtcbiAgbGluZUluZGV4OiBudW1iZXI7IC8vIFVzZSBsaW5lIGluZGV4IGluc3RlYWQgb2YgdHJpZ2dlclxuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEZpcmVFbW9qaUFuaW1hdGlvbjogQ29tcG9uZW50PEZpcmVFbW9qaUFuaW1hdGlvblByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbc2hvd0ZpcmUsIHNldFNob3dGaXJlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtmaXJlWCwgc2V0RmlyZVhdID0gY3JlYXRlU2lnbmFsKDUwKTtcbiAgbGV0IGxhc3RMaW5lSW5kZXggPSAtMTtcbiAgbGV0IGhpZGVUaW1lcjogbnVtYmVyIHwgdW5kZWZpbmVkO1xuICBcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICAvLyBDaGVjayBpZiB3ZSBoYXZlIGEgbmV3IGxpbmUgd2l0aCBoaWdoIHNjb3JlXG4gICAgaWYgKHByb3BzLmxpbmVJbmRleCA+IGxhc3RMaW5lSW5kZXggJiYgcHJvcHMuc2NvcmUgPj0gODApIHtcbiAgICAgIC8vIFJhbmRvbSBYIHBvc2l0aW9uIGJldHdlZW4gMjAlIGFuZCA4MCVcbiAgICAgIHNldEZpcmVYKDIwICsgTWF0aC5yYW5kb20oKSAqIDYwKTtcbiAgICAgIHNldFNob3dGaXJlKHRydWUpO1xuICAgICAgXG4gICAgICAvLyBDbGVhciBleGlzdGluZyB0aW1lclxuICAgICAgaWYgKGhpZGVUaW1lcikgY2xlYXJUaW1lb3V0KGhpZGVUaW1lcik7XG4gICAgICBcbiAgICAgIC8vIEhpZGUgYWZ0ZXIgYW5pbWF0aW9uIGNvbXBsZXRlc1xuICAgICAgaGlkZVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHNldFNob3dGaXJlKGZhbHNlKTtcbiAgICAgIH0sIDIwMDApO1xuICAgICAgXG4gICAgICBsYXN0TGluZUluZGV4ID0gcHJvcHMubGluZUluZGV4O1xuICAgIH1cbiAgfSk7XG4gIFxuICBvbkNsZWFudXAoKCkgPT4ge1xuICAgIGlmIChoaWRlVGltZXIpIGNsZWFyVGltZW91dChoaWRlVGltZXIpO1xuICB9KTtcblxuICByZXR1cm4gKFxuICAgIDxTaG93IHdoZW49e3Nob3dGaXJlKCl9PlxuICAgICAgPGRpdiBjbGFzcz17Y24oc3R5bGVzLmZpcmVDb250YWluZXIsIHByb3BzLmNsYXNzKX0+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICBjbGFzcz17c3R5bGVzLmZpcmVFbW9qaX1cbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgbGVmdDogYCR7ZmlyZVgoKX0lYCxcbiAgICAgICAgICAgICdmb250LXNpemUnOiAnMzJweCdcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAg8J+UpVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvU2hvdz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdywgdHlwZSBDb21wb25lbnQsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlRWZmZWN0IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5pbXBvcnQgeyBTY29yZVBhbmVsIH0gZnJvbSAnLi4vLi4vZGlzcGxheS9TY29yZVBhbmVsJztcbmltcG9ydCB7IEx5cmljc0Rpc3BsYXksIHR5cGUgTHlyaWNMaW5lIH0gZnJvbSAnLi4vTHlyaWNzRGlzcGxheSc7XG5pbXBvcnQgeyBMZWFkZXJib2FyZFBhbmVsLCB0eXBlIExlYWRlcmJvYXJkRW50cnkgfSBmcm9tICcuLi9MZWFkZXJib2FyZFBhbmVsJztcbmltcG9ydCB7IFNwbGl0QnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL1NwbGl0QnV0dG9uJztcbmltcG9ydCB0eXBlIHsgUGxheWJhY2tTcGVlZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5pbXBvcnQgeyBUYWJzLCBUYWJzTGlzdCwgVGFic1RyaWdnZXIsIFRhYnNDb250ZW50IH0gZnJvbSAnLi4vLi4vY29tbW9uL1RhYnMnO1xuaW1wb3J0IHsgRmlyZUVtb2ppQW5pbWF0aW9uIH0gZnJvbSAnLi4vLi4vZWZmZWN0cy9GaXJlRW1vamlBbmltYXRpb24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4dGVuc2lvbkthcmFva2VWaWV3UHJvcHMge1xuICAvLyBTY29yZXNcbiAgc2NvcmU6IG51bWJlcjtcbiAgcmFuazogbnVtYmVyO1xuICBcbiAgLy8gTHlyaWNzXG4gIGx5cmljczogTHlyaWNMaW5lW107XG4gIGN1cnJlbnRUaW1lPzogbnVtYmVyO1xuICBcbiAgLy8gTGVhZGVyYm9hcmRcbiAgbGVhZGVyYm9hcmQ6IExlYWRlcmJvYXJkRW50cnlbXTtcbiAgXG4gIC8vIFN0YXRlXG4gIGlzUGxheWluZz86IGJvb2xlYW47XG4gIGlzUmVjb3JkaW5nPzogYm9vbGVhbjtcbiAgb25TdGFydD86ICgpID0+IHZvaWQ7XG4gIG9uU3BlZWRDaGFuZ2U/OiAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpID0+IHZvaWQ7XG4gIFxuICAvLyBMaW5lIHNjb3JlcyBmb3IgdmlzdWFsIGZlZWRiYWNrXG4gIGxpbmVTY29yZXM/OiBBcnJheTx7IGxpbmVJbmRleDogbnVtYmVyOyBzY29yZTogbnVtYmVyOyB0cmFuc2NyaXB0aW9uOiBzdHJpbmc7IGZlZWRiYWNrPzogc3RyaW5nIH0+O1xuICBcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBFeHRlbnNpb25LYXJhb2tlVmlldzogQ29tcG9uZW50PEV4dGVuc2lvbkthcmFva2VWaWV3UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIC8vIEdldCB0aGUgbGF0ZXN0IGhpZ2ggc2NvcmUgbGluZSBpbmRleFxuICBjb25zdCBnZXRMYXRlc3RIaWdoU2NvcmVMaW5lID0gKCkgPT4ge1xuICAgIGNvbnN0IHNjb3JlcyA9IHByb3BzLmxpbmVTY29yZXMgfHwgW107XG4gICAgaWYgKHNjb3Jlcy5sZW5ndGggPT09IDApIHJldHVybiB7IHNjb3JlOiAwLCBsaW5lSW5kZXg6IC0xIH07XG4gICAgXG4gICAgY29uc3QgbGF0ZXN0ID0gc2NvcmVzW3Njb3Jlcy5sZW5ndGggLSAxXTtcbiAgICByZXR1cm4ge1xuICAgICAgc2NvcmU6IGxhdGVzdD8uc2NvcmUgfHwgMCxcbiAgICAgIGxpbmVJbmRleDogbGF0ZXN0Py5saW5lSW5kZXggfHwgLTFcbiAgICB9O1xuICB9O1xuICBcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZmxleCBmbGV4LWNvbCBoLWZ1bGwgYmctYmFzZSByZWxhdGl2ZScsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogU2NvcmUgUGFuZWwgLSBvbmx5IHNob3cgd2hlbiBub3QgcGxheWluZyAqL31cbiAgICAgIDxTaG93IHdoZW49eyFwcm9wcy5pc1BsYXlpbmd9PlxuICAgICAgICA8U2NvcmVQYW5lbFxuICAgICAgICAgIHNjb3JlPXtwcm9wcy5zY29yZX1cbiAgICAgICAgICByYW5rPXtwcm9wcy5yYW5rfVxuICAgICAgICAvPlxuICAgICAgPC9TaG93PlxuXG4gICAgICB7LyogU2hvdyB0YWJzIG9ubHkgd2hlbiBub3QgcGxheWluZyAqL31cbiAgICAgIDxTaG93IHdoZW49eyFwcm9wcy5pc1BsYXlpbmd9IGZhbGxiYWNrPXtcbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBmbGV4IGZsZXgtY29sIG1pbi1oLTBcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIG1pbi1oLTAgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICA8THlyaWNzRGlzcGxheVxuICAgICAgICAgICAgICBseXJpY3M9e3Byb3BzLmx5cmljc31cbiAgICAgICAgICAgICAgY3VycmVudFRpbWU9e3Byb3BzLmN1cnJlbnRUaW1lfVxuICAgICAgICAgICAgICBpc1BsYXlpbmc9e3Byb3BzLmlzUGxheWluZ31cbiAgICAgICAgICAgICAgbGluZVNjb3Jlcz17cHJvcHMubGluZVNjb3Jlc31cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgfT5cbiAgICAgICAgey8qIFRhYnMgYW5kIGNvbnRlbnQgKi99XG4gICAgICAgIDxUYWJzIFxuICAgICAgICAgIHRhYnM9e1tcbiAgICAgICAgICAgIHsgaWQ6ICdseXJpY3MnLCBsYWJlbDogJ0x5cmljcycgfSxcbiAgICAgICAgICAgIHsgaWQ6ICdsZWFkZXJib2FyZCcsIGxhYmVsOiAnTGVhZGVyYm9hcmQnIH1cbiAgICAgICAgICBdfVxuICAgICAgICAgIGRlZmF1bHRUYWI9XCJseXJpY3NcIlxuICAgICAgICAgIGNsYXNzPVwiZmxleC0xIGZsZXggZmxleC1jb2wgbWluLWgtMFwiXG4gICAgICAgID5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwicHgtNFwiPlxuICAgICAgICAgICAgPFRhYnNMaXN0PlxuICAgICAgICAgICAgICA8VGFic1RyaWdnZXIgdmFsdWU9XCJseXJpY3NcIj5MeXJpY3M8L1RhYnNUcmlnZ2VyPlxuICAgICAgICAgICAgICA8VGFic1RyaWdnZXIgdmFsdWU9XCJsZWFkZXJib2FyZFwiPkxlYWRlcmJvYXJkPC9UYWJzVHJpZ2dlcj5cbiAgICAgICAgICAgIDwvVGFic0xpc3Q+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgXG4gICAgICAgICAgPFRhYnNDb250ZW50IHZhbHVlPVwibHlyaWNzXCIgY2xhc3M9XCJmbGV4LTEgbWluLWgtMFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZmxleC1jb2wgaC1mdWxsXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgbWluLWgtMCBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgICAgICA8THlyaWNzRGlzcGxheVxuICAgICAgICAgICAgICAgICAgbHlyaWNzPXtwcm9wcy5seXJpY3N9XG4gICAgICAgICAgICAgICAgICBjdXJyZW50VGltZT17cHJvcHMuY3VycmVudFRpbWV9XG4gICAgICAgICAgICAgICAgICBpc1BsYXlpbmc9e3Byb3BzLmlzUGxheWluZ31cbiAgICAgICAgICAgICAgICAgIGxpbmVTY29yZXM9e3Byb3BzLmxpbmVTY29yZXN9XG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICB7LyogRm9vdGVyIHdpdGggc3RhcnQgYnV0dG9uICovfVxuICAgICAgICAgICAgICA8U2hvdyB3aGVuPXshcHJvcHMuaXNQbGF5aW5nICYmIHByb3BzLm9uU3RhcnR9PlxuICAgICAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInAtNCBiZy1zdXJmYWNlIGJvcmRlci10IGJvcmRlci1zdWJ0bGVcIlxuICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgICAgJ2ZsZXgtc2hyaW5rJzogJzAnXG4gICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxTcGxpdEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBvblN0YXJ0PXtwcm9wcy5vblN0YXJ0fVxuICAgICAgICAgICAgICAgICAgICBvblNwZWVkQ2hhbmdlPXtwcm9wcy5vblNwZWVkQ2hhbmdlfVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9UYWJzQ29udGVudD5cbiAgICAgICAgICBcbiAgICAgICAgICA8VGFic0NvbnRlbnQgdmFsdWU9XCJsZWFkZXJib2FyZFwiIGNsYXNzPVwiZmxleC0xIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm92ZXJmbG93LXktYXV0byBoLWZ1bGxcIj5cbiAgICAgICAgICAgICAgPExlYWRlcmJvYXJkUGFuZWwgZW50cmllcz17cHJvcHMubGVhZGVyYm9hcmR9IC8+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1RhYnNDb250ZW50PlxuICAgICAgICA8L1RhYnM+XG4gICAgICA8L1Nob3c+XG4gICAgICBcbiAgICAgIHsvKiBGaXJlIGVtb2ppIGVmZmVjdCAqL31cbiAgICAgIDxTaG93IHdoZW49e3Byb3BzLmlzUGxheWluZ30+XG4gICAgICAgIDxGaXJlRW1vamlBbmltYXRpb24gXG4gICAgICAgICAgc2NvcmU9e2dldExhdGVzdEhpZ2hTY29yZUxpbmUoKS5zY29yZX0gXG4gICAgICAgICAgbGluZUluZGV4PXtnZXRMYXRlc3RIaWdoU2NvcmVMaW5lKCkubGluZUluZGV4fVxuICAgICAgICAvPlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVDb250ZXh0LCB1c2VDb250ZXh0LCBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCwgY3JlYXRlTWVtbyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgUGFyZW50Q29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBUcmFuc2xhdGlvbnMsIExvY2FsZUNvZGUgfSBmcm9tICcuL3R5cGVzJztcblxuaW50ZXJmYWNlIEkxOG5Db250ZXh0VmFsdWUge1xuICBsb2NhbGU6ICgpID0+IExvY2FsZUNvZGU7XG4gIHNldExvY2FsZTogKGxvY2FsZTogTG9jYWxlQ29kZSkgPT4gdm9pZDtcbiAgdDogKGtleTogc3RyaW5nLCBwYXJhbXM/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBzdHJpbmc7XG4gIGRpcjogKCkgPT4gJ2x0cicgfCAncnRsJztcbiAgZm9ybWF0TnVtYmVyOiAobnVtOiBudW1iZXIpID0+IHN0cmluZztcbiAgZm9ybWF0RGF0ZTogKGRhdGU6IERhdGUsIG9wdGlvbnM/OiBJbnRsLkRhdGVUaW1lRm9ybWF0T3B0aW9ucykgPT4gc3RyaW5nO1xufVxuXG5jb25zdCBJMThuQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8STE4bkNvbnRleHRWYWx1ZT4oKTtcblxuZXhwb3J0IGNvbnN0IEkxOG5Qcm92aWRlcjogUGFyZW50Q29tcG9uZW50PHsgZGVmYXVsdExvY2FsZT86IExvY2FsZUNvZGUgfT4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2xvY2FsZSwgc2V0TG9jYWxlXSA9IGNyZWF0ZVNpZ25hbDxMb2NhbGVDb2RlPihwcm9wcy5kZWZhdWx0TG9jYWxlIHx8ICdlbicpO1xuICBjb25zdCBbdHJhbnNsYXRpb25zLCBzZXRUcmFuc2xhdGlvbnNdID0gY3JlYXRlU2lnbmFsPFRyYW5zbGF0aW9ucz4oKTtcbiAgXG4gIC8vIExvYWQgdHJhbnNsYXRpb25zIGR5bmFtaWNhbGx5XG4gIGNyZWF0ZUVmZmVjdChhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgY3VycmVudExvY2FsZSA9IGxvY2FsZSgpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBtb2R1bGUgPSBhd2FpdCBpbXBvcnQoYC4vbG9jYWxlcy8ke2N1cnJlbnRMb2NhbGV9L2luZGV4LnRzYCk7XG4gICAgICBzZXRUcmFuc2xhdGlvbnMobW9kdWxlLmRlZmF1bHQpO1xuICAgIH0gY2F0Y2ggKF9lKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEZhaWxlZCB0byBsb2FkIGxvY2FsZSAke2N1cnJlbnRMb2NhbGV9LCBmYWxsaW5nIGJhY2sgdG8gRW5nbGlzaGApO1xuICAgICAgY29uc3QgbW9kdWxlID0gYXdhaXQgaW1wb3J0KCcuL2xvY2FsZXMvZW4vaW5kZXgudHMnKTtcbiAgICAgIHNldFRyYW5zbGF0aW9ucyhtb2R1bGUuZGVmYXVsdCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBEZWVwIGtleSBhY2Nlc3Mgd2l0aCBkb3Qgbm90YXRpb25cbiAgY29uc3QgdCA9IChrZXk6IHN0cmluZywgcGFyYW1zPzogUmVjb3JkPHN0cmluZywgYW55PikgPT4ge1xuICAgIGNvbnN0IGtleXMgPSBrZXkuc3BsaXQoJy4nKTtcbiAgICBsZXQgdmFsdWU6IGFueSA9IHRyYW5zbGF0aW9ucygpO1xuICAgIFxuICAgIGZvciAoY29uc3QgayBvZiBrZXlzKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlPy5ba107XG4gICAgfVxuICAgIFxuICAgIC8vIEhhbmRsZSBwYXJhbWV0ZXIgcmVwbGFjZW1lbnRcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiBwYXJhbXMpIHtcbiAgICAgIHJldHVybiB2YWx1ZS5yZXBsYWNlKC9cXHtcXHsoXFx3KylcXH1cXH0vZywgKF8sIGspID0+IFN0cmluZyhwYXJhbXNba10gfHwgJycpKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHZhbHVlIHx8IGtleTtcbiAgfTtcblxuICAvLyBEaXJlY3Rpb24gKGZvciBSVEwgbGFuZ3VhZ2VzIGluIGZ1dHVyZSlcbiAgY29uc3QgZGlyID0gKCk6ICdsdHInIHwgJ3J0bCcgPT4gJ2x0cic7IC8vIE9ubHkgTFRSIGxhbmd1YWdlcyBzdXBwb3J0ZWQgY3VycmVudGx5XG5cbiAgLy8gTnVtYmVyIGZvcm1hdHRpbmdcbiAgY29uc3QgbnVtYmVyRm9ybWF0dGVyID0gY3JlYXRlTWVtbygoKSA9PiBcbiAgICBuZXcgSW50bC5OdW1iZXJGb3JtYXQobG9jYWxlKCkpXG4gICk7XG5cbiAgY29uc3QgZm9ybWF0TnVtYmVyID0gKG51bTogbnVtYmVyKSA9PiBudW1iZXJGb3JtYXR0ZXIoKS5mb3JtYXQobnVtKTtcblxuICAvLyBEYXRlIGZvcm1hdHRpbmdcbiAgY29uc3QgZm9ybWF0RGF0ZSA9IChkYXRlOiBEYXRlLCBvcHRpb25zPzogSW50bC5EYXRlVGltZUZvcm1hdE9wdGlvbnMpID0+IHtcbiAgICByZXR1cm4gbmV3IEludGwuRGF0ZVRpbWVGb3JtYXQobG9jYWxlKCksIG9wdGlvbnMpLmZvcm1hdChkYXRlKTtcbiAgfTtcblxuICBjb25zdCB2YWx1ZTogSTE4bkNvbnRleHRWYWx1ZSA9IHtcbiAgICBsb2NhbGUsXG4gICAgc2V0TG9jYWxlLFxuICAgIHQsXG4gICAgZGlyLFxuICAgIGZvcm1hdE51bWJlcixcbiAgICBmb3JtYXREYXRlLFxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPEkxOG5Db250ZXh0LlByb3ZpZGVyIHZhbHVlPXt2YWx1ZX0+XG4gICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgPC9JMThuQ29udGV4dC5Qcm92aWRlcj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCB1c2VJMThuID0gKCkgPT4ge1xuICBjb25zdCBjb250ZXh0ID0gdXNlQ29udGV4dChJMThuQ29udGV4dCk7XG4gIGlmICghY29udGV4dCkge1xuICAgIHRocm93IG5ldyBFcnJvcigndXNlSTE4biBtdXN0IGJlIHVzZWQgd2l0aGluIEkxOG5Qcm92aWRlcicpO1xuICB9XG4gIHJldHVybiBjb250ZXh0O1xufTsiLCJpbXBvcnQgeyBTaG93LCBjcmVhdGVNZW1vIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB0eXBlIHsgUGxheWJhY2tTcGVlZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vQnV0dG9uJztcbmltcG9ydCB7IHVzZUkxOG4gfSBmcm9tICcuLi8uLi8uLi9pMThuJztcblxuZXhwb3J0IGludGVyZmFjZSBDb21wbGV0aW9uVmlld1Byb3BzIHtcbiAgc2NvcmU6IG51bWJlcjtcbiAgcmFuazogbnVtYmVyO1xuICBzcGVlZDogUGxheWJhY2tTcGVlZDtcbiAgZmVlZGJhY2tUZXh0Pzogc3RyaW5nO1xuICBvblByYWN0aWNlPzogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBDb21wbGV0aW9uVmlldzogQ29tcG9uZW50PENvbXBsZXRpb25WaWV3UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHsgdCwgZm9ybWF0TnVtYmVyIH0gPSB1c2VJMThuKCk7XG4gIFxuICAvLyBHZXQgZmVlZGJhY2sgdGV4dCBiYXNlZCBvbiBzY29yZVxuICBjb25zdCBnZXRGZWVkYmFja1RleHQgPSBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBpZiAocHJvcHMuZmVlZGJhY2tUZXh0KSByZXR1cm4gcHJvcHMuZmVlZGJhY2tUZXh0O1xuICAgIFxuICAgIGlmIChwcm9wcy5zY29yZSA+PSA5NSkgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5wZXJmZWN0Jyk7XG4gICAgaWYgKHByb3BzLnNjb3JlID49IDg1KSByZXR1cm4gdCgna2FyYW9rZS5zY29yaW5nLmV4Y2VsbGVudCcpO1xuICAgIGlmIChwcm9wcy5zY29yZSA+PSA3MCkgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5ncmVhdCcpO1xuICAgIGlmIChwcm9wcy5zY29yZSA+PSA1MCkgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5nb29kJyk7XG4gICAgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5rZWVwUHJhY3RpY2luZycpO1xuICB9KTtcbiAgXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgaC1mdWxsIGJnLWJhc2UnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgey8qIE1haW4gY29udGVudCBhcmVhICovfVxuICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLTZcIj5cbiAgICAgICAgey8qIFNjb3JlICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgZmxleCBmbGV4LWNvbCBtYi0xMFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5IG1iLTMgb3JkZXItMVwiPnt0KCdrYXJhb2tlLnNjb3Jpbmcuc2NvcmUnKX08L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC03eGwgZm9udC1tb25vIGZvbnQtYm9sZCB0ZXh0LWFjY2VudC1wcmltYXJ5IG9yZGVyLTJcIj5cbiAgICAgICAgICAgIHtmb3JtYXROdW1iZXIocHJvcHMuc2NvcmUpfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgXG4gICAgICAgIHsvKiBTdGF0cyByb3cgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGdhcC0xMiBtYi0xMlwiPlxuICAgICAgICAgIHsvKiBSYW5rICovfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0yIG9yZGVyLTFcIj5SYW5rPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0zeGwgZm9udC1ib2xkIHRleHQtcHJpbWFyeSBvcmRlci0yXCI+I3tmb3JtYXROdW1iZXIocHJvcHMucmFuayl9PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgXG4gICAgICAgICAgey8qIFNwZWVkICovfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0yIG9yZGVyLTFcIj57dCgnY29tbW9uLnNwZWVkLmxhYmVsJyl9PC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0zeGwgZm9udC1ib2xkIHRleHQtcHJpbWFyeSBvcmRlci0yXCI+e3Byb3BzLnNwZWVkfTwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgXG4gICAgICAgIHsvKiBGZWVkYmFjayB0ZXh0ICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwibWF4LXctbWQgdGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICA8cCBjbGFzcz1cInRleHQteGwgdGV4dC1wcmltYXJ5IGxlYWRpbmctcmVsYXhlZFwiPlxuICAgICAgICAgICAge2dldEZlZWRiYWNrVGV4dCgpfVxuICAgICAgICAgIDwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgey8qIEZvb3RlciB3aXRoIHByYWN0aWNlIGJ1dHRvbiAtIHBvc2l0aW9uZWQgYXQgYm90dG9tIG9mIHdpZGdldCAqL31cbiAgICAgIDxTaG93IHdoZW49e3Byb3BzLm9uUHJhY3RpY2V9PlxuICAgICAgICA8ZGl2IGNsYXNzPVwicC00IGJnLXN1cmZhY2UgYm9yZGVyLXQgYm9yZGVyLXN1YnRsZVwiPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIHZhcmlhbnQ9XCJwcmltYXJ5XCJcbiAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uUHJhY3RpY2V9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgUHJhY3RpY2UgRXJyb3JzXG4gICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIG9uQ2xlYW51cCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQXVkaW9Qcm9jZXNzb3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vdHlwZXMva2FyYW9rZSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVLYXJhb2tlQXVkaW9Qcm9jZXNzb3Iob3B0aW9ucz86IEF1ZGlvUHJvY2Vzc29yT3B0aW9ucykge1xuICBjb25zdCBbYXVkaW9Db250ZXh0LCBzZXRBdWRpb0NvbnRleHRdID0gY3JlYXRlU2lnbmFsPEF1ZGlvQ29udGV4dCB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbbWVkaWFTdHJlYW0sIHNldE1lZGlhU3RyZWFtXSA9IGNyZWF0ZVNpZ25hbDxNZWRpYVN0cmVhbSB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbLCBzZXRBdWRpb1dvcmtsZXROb2RlXSA9IGNyZWF0ZVNpZ25hbDxBdWRpb1dvcmtsZXROb2RlIHwgbnVsbD4obnVsbCk7XG4gIFxuICBjb25zdCBbaXNSZWFkeSwgc2V0SXNSZWFkeV0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IGNyZWF0ZVNpZ25hbDxFcnJvciB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbaXNMaXN0ZW5pbmcsIHNldElzTGlzdGVuaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIFxuICBjb25zdCBbY3VycmVudFJlY29yZGluZ0xpbmUsIHNldEN1cnJlbnRSZWNvcmRpbmdMaW5lXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW3JlY29yZGVkQXVkaW9CdWZmZXIsIHNldFJlY29yZGVkQXVkaW9CdWZmZXJdID0gY3JlYXRlU2lnbmFsPEZsb2F0MzJBcnJheVtdPihbXSk7XG4gIFxuICBjb25zdCBbaXNTZXNzaW9uQWN0aXZlLCBzZXRJc1Nlc3Npb25BY3RpdmVdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2Z1bGxTZXNzaW9uQnVmZmVyLCBzZXRGdWxsU2Vzc2lvbkJ1ZmZlcl0gPSBjcmVhdGVTaWduYWw8RmxvYXQzMkFycmF5W10+KFtdKTtcbiAgXG4gIGNvbnN0IHNhbXBsZVJhdGUgPSBvcHRpb25zPy5zYW1wbGVSYXRlIHx8IDE2MDAwO1xuICBcbiAgY29uc3QgaW5pdGlhbGl6ZSA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoYXVkaW9Db250ZXh0KCkpIHJldHVybjtcbiAgICBzZXRFcnJvcihudWxsKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIEluaXRpYWxpemluZyBhdWRpbyBjYXB0dXJlLi4uJyk7XG4gICAgICBcbiAgICAgIGNvbnN0IGN0eCA9IG5ldyBBdWRpb0NvbnRleHQoeyBzYW1wbGVSYXRlIH0pO1xuICAgICAgc2V0QXVkaW9Db250ZXh0KGN0eCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHN0cmVhbSA9IGF3YWl0IG5hdmlnYXRvci5tZWRpYURldmljZXMuZ2V0VXNlck1lZGlhKHtcbiAgICAgICAgYXVkaW86IHtcbiAgICAgICAgICBzYW1wbGVSYXRlLFxuICAgICAgICAgIGNoYW5uZWxDb3VudDogMSxcbiAgICAgICAgICBlY2hvQ2FuY2VsbGF0aW9uOiBmYWxzZSxcbiAgICAgICAgICBub2lzZVN1cHByZXNzaW9uOiBmYWxzZSxcbiAgICAgICAgICBhdXRvR2FpbkNvbnRyb2w6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBzZXRNZWRpYVN0cmVhbShzdHJlYW0pO1xuICAgICAgXG4gICAgICBhd2FpdCBjdHguYXVkaW9Xb3JrbGV0LmFkZE1vZHVsZShjcmVhdGVBdWRpb1dvcmtsZXRQcm9jZXNzb3IoKSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHdvcmtsZXROb2RlID0gbmV3IEF1ZGlvV29ya2xldE5vZGUoY3R4LCAna2FyYW9rZS1hdWRpby1wcm9jZXNzb3InLCB7XG4gICAgICAgIG51bWJlck9mSW5wdXRzOiAxLFxuICAgICAgICBudW1iZXJPZk91dHB1dHM6IDAsXG4gICAgICAgIGNoYW5uZWxDb3VudDogMSxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICB3b3JrbGV0Tm9kZS5wb3J0Lm9ubWVzc2FnZSA9IChldmVudCkgPT4ge1xuICAgICAgICBpZiAoZXZlbnQuZGF0YS50eXBlID09PSAnYXVkaW9EYXRhJykge1xuICAgICAgICAgIGNvbnN0IGF1ZGlvRGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoZXZlbnQuZGF0YS5hdWRpb0RhdGEpO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChjdXJyZW50UmVjb3JkaW5nTGluZSgpICE9PSBudWxsKSB7XG4gICAgICAgICAgICBzZXRSZWNvcmRlZEF1ZGlvQnVmZmVyKChwcmV2KSA9PiBbLi4ucHJldiwgYXVkaW9EYXRhXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGlmIChpc1Nlc3Npb25BY3RpdmUoKSkge1xuICAgICAgICAgICAgc2V0RnVsbFNlc3Npb25CdWZmZXIoKHByZXYpID0+IFsuLi5wcmV2LCBhdWRpb0RhdGFdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBcbiAgICAgIHNldEF1ZGlvV29ya2xldE5vZGUod29ya2xldE5vZGUpO1xuICAgICAgXG4gICAgICBjb25zdCBzb3VyY2UgPSBjdHguY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2Uoc3RyZWFtKTtcbiAgICAgIGNvbnN0IGdhaW5Ob2RlID0gY3R4LmNyZWF0ZUdhaW4oKTtcbiAgICAgIGdhaW5Ob2RlLmdhaW4udmFsdWUgPSAxLjI7XG4gICAgICBcbiAgICAgIHNvdXJjZS5jb25uZWN0KGdhaW5Ob2RlKTtcbiAgICAgIGdhaW5Ob2RlLmNvbm5lY3Qod29ya2xldE5vZGUpO1xuICAgICAgXG4gICAgICBzZXRJc1JlYWR5KHRydWUpO1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIEF1ZGlvIGNhcHR1cmUgaW5pdGlhbGl6ZWQgc3VjY2Vzc2Z1bGx5LicpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIEZhaWxlZCB0byBpbml0aWFsaXplOicsIGUpO1xuICAgICAgc2V0RXJyb3IoZSBpbnN0YW5jZW9mIEVycm9yID8gZSA6IG5ldyBFcnJvcignVW5rbm93biBhdWRpbyBpbml0aWFsaXphdGlvbiBlcnJvcicpKTtcbiAgICAgIHNldElzUmVhZHkoZmFsc2UpO1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGNyZWF0ZUF1ZGlvV29ya2xldFByb2Nlc3NvciA9ICgpID0+IHtcbiAgICBjb25zdCBwcm9jZXNzb3JDb2RlID0gYFxuICAgICAgY2xhc3MgS2FyYW9rZUF1ZGlvUHJvY2Vzc29yIGV4dGVuZHMgQXVkaW9Xb3JrbGV0UHJvY2Vzc29yIHtcbiAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgICB0aGlzLmJ1ZmZlclNpemUgPSAxMDI0O1xuICAgICAgICAgIHRoaXMucm1zSGlzdG9yeSA9IFtdO1xuICAgICAgICAgIHRoaXMubWF4SGlzdG9yeUxlbmd0aCA9IDEwO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvY2VzcyhpbnB1dHMsIG91dHB1dHMsIHBhcmFtZXRlcnMpIHtcbiAgICAgICAgICBjb25zdCBpbnB1dCA9IGlucHV0c1swXTtcbiAgICAgICAgICBpZiAoaW5wdXQgJiYgaW5wdXRbMF0pIHtcbiAgICAgICAgICAgIGNvbnN0IGlucHV0RGF0YSA9IGlucHV0WzBdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgc3VtID0gMDtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXREYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIHN1bSArPSBpbnB1dERhdGFbaV0gKiBpbnB1dERhdGFbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBybXMgPSBNYXRoLnNxcnQoc3VtIC8gaW5wdXREYXRhLmxlbmd0aCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMucm1zSGlzdG9yeS5wdXNoKHJtcyk7XG4gICAgICAgICAgICBpZiAodGhpcy5ybXNIaXN0b3J5Lmxlbmd0aCA+IHRoaXMubWF4SGlzdG9yeUxlbmd0aCkge1xuICAgICAgICAgICAgICB0aGlzLnJtc0hpc3Rvcnkuc2hpZnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgYXZnUm1zID0gdGhpcy5ybXNIaXN0b3J5LnJlZHVjZSgoYSwgYikgPT4gYSArIGIsIDApIC8gdGhpcy5ybXNIaXN0b3J5Lmxlbmd0aDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5wb3J0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgICAgdHlwZTogJ2F1ZGlvRGF0YScsXG4gICAgICAgICAgICAgIGF1ZGlvRGF0YTogaW5wdXREYXRhLFxuICAgICAgICAgICAgICBybXNMZXZlbDogcm1zLFxuICAgICAgICAgICAgICBhdmdSbXNMZXZlbDogYXZnUm1zLFxuICAgICAgICAgICAgICBpc1Rvb1F1aWV0OiBhdmdSbXMgPCAwLjAxLFxuICAgICAgICAgICAgICBpc1Rvb0xvdWQ6IGF2Z1JtcyA+IDAuM1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZWdpc3RlclByb2Nlc3Nvcigna2FyYW9rZS1hdWRpby1wcm9jZXNzb3InLCBLYXJhb2tlQXVkaW9Qcm9jZXNzb3IpO1xuICAgIGA7XG4gICAgXG4gICAgY29uc3QgYmxvYiA9IG5ldyBCbG9iKFtwcm9jZXNzb3JDb2RlXSwgeyB0eXBlOiAnYXBwbGljYXRpb24vamF2YXNjcmlwdCcgfSk7XG4gICAgcmV0dXJuIFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG4gIH07XG4gIFxuICBjb25zdCBzdGFydExpc3RlbmluZyA9ICgpID0+IHtcbiAgICBjb25zdCBjdHggPSBhdWRpb0NvbnRleHQoKTtcbiAgICBpZiAoY3R4ICYmIGN0eC5zdGF0ZSA9PT0gJ3N1c3BlbmRlZCcpIHtcbiAgICAgIGN0eC5yZXN1bWUoKTtcbiAgICB9XG4gICAgc2V0SXNMaXN0ZW5pbmcodHJ1ZSk7XG4gICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIFN0YXJ0ZWQgbGlzdGVuaW5nIGZvciBhdWRpby4nKTtcbiAgfTtcbiAgXG4gIGNvbnN0IHBhdXNlTGlzdGVuaW5nID0gKCkgPT4ge1xuICAgIGNvbnN0IGN0eCA9IGF1ZGlvQ29udGV4dCgpO1xuICAgIGlmIChjdHggJiYgY3R4LnN0YXRlID09PSAncnVubmluZycpIHtcbiAgICAgIGN0eC5zdXNwZW5kKCk7XG4gICAgfVxuICAgIHNldElzTGlzdGVuaW5nKGZhbHNlKTtcbiAgICBjb25zb2xlLmxvZygnW0thcmFva2VBdWRpb1Byb2Nlc3Nvcl0gUGF1c2VkIGxpc3RlbmluZyBmb3IgYXVkaW8uJyk7XG4gIH07XG4gIFxuICBjb25zdCBjbGVhbnVwID0gKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBDbGVhbmluZyB1cCBhdWRpbyBjYXB0dXJlLi4uJyk7XG4gICAgXG4gICAgY29uc3Qgc3RyZWFtID0gbWVkaWFTdHJlYW0oKTtcbiAgICBpZiAoc3RyZWFtKSB7XG4gICAgICBzdHJlYW0uZ2V0VHJhY2tzKCkuZm9yRWFjaCgodHJhY2spID0+IHRyYWNrLnN0b3AoKSk7XG4gICAgICBzZXRNZWRpYVN0cmVhbShudWxsKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgY3R4ID0gYXVkaW9Db250ZXh0KCk7XG4gICAgaWYgKGN0eCAmJiBjdHguc3RhdGUgIT09ICdjbG9zZWQnKSB7XG4gICAgICBjdHguY2xvc2UoKTtcbiAgICAgIHNldEF1ZGlvQ29udGV4dChudWxsKTtcbiAgICB9XG4gICAgXG4gICAgc2V0QXVkaW9Xb3JrbGV0Tm9kZShudWxsKTtcbiAgICBzZXRJc1JlYWR5KGZhbHNlKTtcbiAgICBzZXRJc0xpc3RlbmluZyhmYWxzZSk7XG4gICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIEF1ZGlvIGNhcHR1cmUgY2xlYW5lZCB1cC4nKTtcbiAgfTtcbiAgXG4gIG9uQ2xlYW51cChjbGVhbnVwKTtcbiAgXG4gIGNvbnN0IHN0YXJ0UmVjb3JkaW5nTGluZSA9IChsaW5lSW5kZXg6IG51bWJlcikgPT4ge1xuICAgIGNvbnNvbGUubG9nKGBbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBTdGFydGluZyBhdWRpbyBjYXB0dXJlIGZvciBsaW5lICR7bGluZUluZGV4fWApO1xuICAgIFxuICAgIHNldEN1cnJlbnRSZWNvcmRpbmdMaW5lKGxpbmVJbmRleCk7XG4gICAgc2V0UmVjb3JkZWRBdWRpb0J1ZmZlcihbXSk7XG4gICAgXG4gICAgaWYgKGlzUmVhZHkoKSAmJiAhaXNMaXN0ZW5pbmcoKSkge1xuICAgICAgc3RhcnRMaXN0ZW5pbmcoKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBzdG9wUmVjb3JkaW5nTGluZUFuZEdldFJhd0F1ZGlvID0gKCk6IEZsb2F0MzJBcnJheVtdID0+IHtcbiAgICBjb25zdCBsaW5lSW5kZXggPSBjdXJyZW50UmVjb3JkaW5nTGluZSgpO1xuICAgIGlmIChsaW5lSW5kZXggPT09IG51bGwpIHtcbiAgICAgIGNvbnNvbGUud2FybignW0thcmFva2VBdWRpb1Byb2Nlc3Nvcl0gTm8gYWN0aXZlIHJlY29yZGluZyBsaW5lLicpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBhdWRpb0J1ZmZlciA9IHJlY29yZGVkQXVkaW9CdWZmZXIoKTtcbiAgICBjb25zb2xlLmxvZyhgW0thcmFva2VBdWRpb1Byb2Nlc3Nvcl0gU3RvcHBpbmcgY2FwdHVyZSBmb3IgbGluZSAke2xpbmVJbmRleH0uIENvbGxlY3RlZCAke2F1ZGlvQnVmZmVyLmxlbmd0aH0gY2h1bmtzLmApO1xuICAgIFxuICAgIHNldEN1cnJlbnRSZWNvcmRpbmdMaW5lKG51bGwpO1xuICAgIFxuICAgIGNvbnN0IHJlc3VsdCA9IFsuLi5hdWRpb0J1ZmZlcl07XG4gICAgc2V0UmVjb3JkZWRBdWRpb0J1ZmZlcihbXSk7XG4gICAgXG4gICAgaWYgKHJlc3VsdC5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnNvbGUubG9nKGBbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBObyBhdWRpbyBjYXB0dXJlZCBmb3IgbGluZSAke2xpbmVJbmRleH0uYCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG4gIFxuICBjb25zdCBjb252ZXJ0QXVkaW9Ub1dhdkJsb2IgPSAoYXVkaW9DaHVua3M6IEZsb2F0MzJBcnJheVtdKTogQmxvYiB8IG51bGwgPT4ge1xuICAgIGlmIChhdWRpb0NodW5rcy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuICAgIFxuICAgIGNvbnN0IHRvdGFsTGVuZ3RoID0gYXVkaW9DaHVua3MucmVkdWNlKChzdW0sIGNodW5rKSA9PiBzdW0gKyBjaHVuay5sZW5ndGgsIDApO1xuICAgIGNvbnN0IGNvbmNhdGVuYXRlZCA9IG5ldyBGbG9hdDMyQXJyYXkodG90YWxMZW5ndGgpO1xuICAgIGxldCBvZmZzZXQgPSAwO1xuICAgIGZvciAoY29uc3QgY2h1bmsgb2YgYXVkaW9DaHVua3MpIHtcbiAgICAgIGNvbmNhdGVuYXRlZC5zZXQoY2h1bmssIG9mZnNldCk7XG4gICAgICBvZmZzZXQgKz0gY2h1bmsubGVuZ3RoO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gYXVkaW9CdWZmZXJUb1dhdihjb25jYXRlbmF0ZWQsIHNhbXBsZVJhdGUpO1xuICB9O1xuICBcbiAgY29uc3QgYXVkaW9CdWZmZXJUb1dhdiA9IChidWZmZXI6IEZsb2F0MzJBcnJheSwgc2FtcGxlUmF0ZTogbnVtYmVyKTogQmxvYiA9PiB7XG4gICAgY29uc3QgbGVuZ3RoID0gYnVmZmVyLmxlbmd0aDtcbiAgICBjb25zdCBhcnJheUJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig0NCArIGxlbmd0aCAqIDIpO1xuICAgIGNvbnN0IHZpZXcgPSBuZXcgRGF0YVZpZXcoYXJyYXlCdWZmZXIpO1xuICAgIFxuICAgIGNvbnN0IHdyaXRlU3RyaW5nID0gKG9mZnNldDogbnVtYmVyLCBzdHJpbmc6IHN0cmluZykgPT4ge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHJpbmcubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmlldy5zZXRVaW50OChvZmZzZXQgKyBpLCBzdHJpbmcuY2hhckNvZGVBdChpKSk7XG4gICAgICB9XG4gICAgfTtcbiAgICBcbiAgICB3cml0ZVN0cmluZygwLCAnUklGRicpO1xuICAgIHZpZXcuc2V0VWludDMyKDQsIDM2ICsgbGVuZ3RoICogMiwgdHJ1ZSk7XG4gICAgd3JpdGVTdHJpbmcoOCwgJ1dBVkUnKTtcbiAgICB3cml0ZVN0cmluZygxMiwgJ2ZtdCAnKTtcbiAgICB2aWV3LnNldFVpbnQzMigxNiwgMTYsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDIwLCAxLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigyMiwgMSwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MzIoMjQsIHNhbXBsZVJhdGUsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDMyKDI4LCBzYW1wbGVSYXRlICogMiwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMzIsIDIsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDM0LCAxNiwgdHJ1ZSk7XG4gICAgd3JpdGVTdHJpbmcoMzYsICdkYXRhJyk7XG4gICAgdmlldy5zZXRVaW50MzIoNDAsIGxlbmd0aCAqIDIsIHRydWUpO1xuICAgIFxuICAgIGNvbnN0IG9mZnNldCA9IDQ0O1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHNhbXBsZSA9IE1hdGgubWF4KC0xLCBNYXRoLm1pbigxLCBidWZmZXJbaV0gfHwgMCkpO1xuICAgICAgdmlldy5zZXRJbnQxNihvZmZzZXQgKyBpICogMiwgc2FtcGxlICogMHg3ZmZmLCB0cnVlKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG5ldyBCbG9iKFthcnJheUJ1ZmZlcl0sIHsgdHlwZTogJ2F1ZGlvL3dhdicgfSk7XG4gIH07XG4gIFxuICBjb25zdCBzdGFydEZ1bGxTZXNzaW9uID0gKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBTdGFydGluZyBmdWxsIHNlc3Npb24gcmVjb3JkaW5nJyk7XG4gICAgc2V0RnVsbFNlc3Npb25CdWZmZXIoW10pO1xuICAgIHNldElzU2Vzc2lvbkFjdGl2ZSh0cnVlKTtcbiAgfTtcbiAgXG4gIGNvbnN0IHN0b3BGdWxsU2Vzc2lvbkFuZEdldFdhdiA9ICgpOiBCbG9iIHwgbnVsbCA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIFN0b3BwaW5nIGZ1bGwgc2Vzc2lvbiByZWNvcmRpbmcnKTtcbiAgICBzZXRJc1Nlc3Npb25BY3RpdmUoZmFsc2UpO1xuICAgIFxuICAgIGNvbnN0IHNlc3Npb25DaHVua3MgPSBmdWxsU2Vzc2lvbkJ1ZmZlcigpO1xuICAgIGNvbnN0IHdhdkJsb2IgPSBjb252ZXJ0QXVkaW9Ub1dhdkJsb2Ioc2Vzc2lvbkNodW5rcyk7XG4gICAgXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0thcmFva2VBdWRpb1Byb2Nlc3Nvcl0gRnVsbCBzZXNzaW9uOiAke3Nlc3Npb25DaHVua3MubGVuZ3RofSBjaHVua3MsIGAgK1xuICAgICAgICBgJHt3YXZCbG9iID8gKHdhdkJsb2Iuc2l6ZSAvIDEwMjQpLnRvRml4ZWQoMSkgKyAnS0InIDogJ251bGwnfWBcbiAgICApO1xuICAgIFxuICAgIHNldEZ1bGxTZXNzaW9uQnVmZmVyKFtdKTtcbiAgICBcbiAgICByZXR1cm4gd2F2QmxvYjtcbiAgfTtcbiAgXG4gIHJldHVybiB7XG4gICAgaXNSZWFkeSxcbiAgICBlcnJvcixcbiAgICBpc0xpc3RlbmluZyxcbiAgICBpc1Nlc3Npb25BY3RpdmUsXG4gICAgXG4gICAgaW5pdGlhbGl6ZSxcbiAgICBzdGFydExpc3RlbmluZyxcbiAgICBwYXVzZUxpc3RlbmluZyxcbiAgICBjbGVhbnVwLFxuICAgIHN0YXJ0UmVjb3JkaW5nTGluZSxcbiAgICBzdG9wUmVjb3JkaW5nTGluZUFuZEdldFJhd0F1ZGlvLFxuICAgIGNvbnZlcnRBdWRpb1RvV2F2QmxvYixcbiAgICBcbiAgICBzdGFydEZ1bGxTZXNzaW9uLFxuICAgIHN0b3BGdWxsU2Vzc2lvbkFuZEdldFdhdixcbiAgfTtcbn0iLCJpbXBvcnQgdHlwZSB7IEthcmFva2VEYXRhLCBLYXJhb2tlU2Vzc2lvbiwgTGluZVNjb3JlLCBTZXNzaW9uUmVzdWx0cyB9IGZyb20gJy4uLy4uL3R5cGVzL2thcmFva2UnO1xuXG5leHBvcnQgY2xhc3MgS2FyYW9rZUFwaVNlcnZpY2Uge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHNlcnZlclVybDogc3RyaW5nID0gaW1wb3J0Lm1ldGEuZW52LlZJVEVfQVBJX1VSTCB8fCAnaHR0cDovL2xvY2FsaG9zdDo4Nzg3Jykge31cblxuICBhc3luYyBmZXRjaEthcmFva2VEYXRhKFxuICAgIHRyYWNrSWQ6IHN0cmluZyxcbiAgICB0aXRsZT86IHN0cmluZyxcbiAgICBhcnRpc3Q/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxLYXJhb2tlRGF0YSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdXJsID0gbmV3IFVSTChgJHt0aGlzLnNlcnZlclVybH0vYXBpL2thcmFva2UvJHt0cmFja0lkfWApO1xuICAgICAgaWYgKHRpdGxlKSB1cmwuc2VhcmNoUGFyYW1zLnNldCgndGl0bGUnLCB0aXRsZSk7XG4gICAgICBpZiAoYXJ0aXN0KSB1cmwuc2VhcmNoUGFyYW1zLnNldCgnYXJ0aXN0JywgYXJ0aXN0KTtcblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwudG9TdHJpbmcoKSk7XG4gICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGZldGNoIGthcmFva2UgZGF0YTonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBzdGFydFNlc3Npb24oXG4gICAgdHJhY2tJZDogc3RyaW5nLFxuICAgIHNvbmdEYXRhOiB7IHRpdGxlOiBzdHJpbmc7IGFydGlzdDogc3RyaW5nOyBnZW5pdXNJZD86IHN0cmluZzsgZHVyYXRpb24/OiBudW1iZXI7IGRpZmZpY3VsdHk/OiBzdHJpbmcgfSxcbiAgICBhdXRoVG9rZW4/OiBzdHJpbmcsXG4gICAgc29uZ0NhdGFsb2dJZD86IHN0cmluZ1xuICApOiBQcm9taXNlPEthcmFva2VTZXNzaW9uIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBoZWFkZXJzOiBIZWFkZXJzSW5pdCA9IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGlmIChhdXRoVG9rZW4pIHtcbiAgICAgICAgaGVhZGVyc1snQXV0aG9yaXphdGlvbiddID0gYEJlYXJlciAke2F1dGhUb2tlbn1gO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuc2VydmVyVXJsfS9rYXJhb2tlL3N0YXJ0YCwge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVycyxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHRyYWNrSWQsXG4gICAgICAgICAgc29uZ0RhdGEsXG4gICAgICAgICAgc29uZ0NhdGFsb2dJZCxcbiAgICAgICAgfSksXG4gICAgICB9KTtcblxuICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIHJldHVybiBkYXRhLnNlc3Npb247XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gc3RhcnQgc2Vzc2lvbjonLCByZXNwb25zZS5zdGF0dXMsIGF3YWl0IHJlc3BvbnNlLnRleHQoKSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBzdGFydCBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdyYWRlUmVjb3JkaW5nKFxuICAgIHNlc3Npb25JZDogc3RyaW5nLFxuICAgIGxpbmVJbmRleDogbnVtYmVyLFxuICAgIGF1ZGlvQnVmZmVyOiBzdHJpbmcsXG4gICAgZXhwZWN0ZWRUZXh0OiBzdHJpbmcsXG4gICAgc3RhcnRUaW1lOiBudW1iZXIsXG4gICAgZW5kVGltZTogbnVtYmVyLFxuICAgIGF1dGhUb2tlbj86IHN0cmluZ1xuICApOiBQcm9taXNlPExpbmVTY29yZSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgaGVhZGVyczogSGVhZGVyc0luaXQgPSB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICB9O1xuICAgICAgXG4gICAgICBpZiAoYXV0aFRva2VuKSB7XG4gICAgICAgIGhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9IGBCZWFyZXIgJHthdXRoVG9rZW59YDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHt0aGlzLnNlcnZlclVybH0va2FyYW9rZS9ncmFkZWAsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnMsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBzZXNzaW9uSWQsXG4gICAgICAgICAgbGluZUluZGV4LFxuICAgICAgICAgIGF1ZGlvQnVmZmVyLFxuICAgICAgICAgIGV4cGVjdGVkVGV4dCxcbiAgICAgICAgICBzdGFydFRpbWUsXG4gICAgICAgICAgZW5kVGltZSxcbiAgICAgICAgfSksXG4gICAgICB9KTtcblxuICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzY29yZTogTWF0aC5yb3VuZChyZXN1bHQuc2NvcmUpLFxuICAgICAgICAgIGZlZWRiYWNrOiByZXN1bHQuZmVlZGJhY2ssXG4gICAgICAgICAgdHJhbnNjcmlwdDogcmVzdWx0LnRyYW5zY3JpcHRpb24sXG4gICAgICAgICAgd29yZFNjb3JlczogcmVzdWx0LndvcmRTY29yZXMsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBncmFkZSByZWNvcmRpbmc6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgY29tcGxldGVTZXNzaW9uKFxuICAgIHNlc3Npb25JZDogc3RyaW5nLFxuICAgIGZ1bGxBdWRpb0J1ZmZlcj86IHN0cmluZyxcbiAgICBhdXRoVG9rZW4/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxTZXNzaW9uUmVzdWx0cyB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgaGVhZGVyczogSGVhZGVyc0luaXQgPSB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICB9O1xuICAgICAgXG4gICAgICBpZiAoYXV0aFRva2VuKSB7XG4gICAgICAgIGhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9IGBCZWFyZXIgJHthdXRoVG9rZW59YDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHt0aGlzLnNlcnZlclVybH0va2FyYW9rZS9jb21wbGV0ZWAsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnMsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBzZXNzaW9uSWQsXG4gICAgICAgICAgZnVsbEF1ZGlvQnVmZmVyLFxuICAgICAgICB9KSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IHJlc3VsdC5zdWNjZXNzLFxuICAgICAgICAgIGZpbmFsU2NvcmU6IHJlc3VsdC5maW5hbFNjb3JlLFxuICAgICAgICAgIHRvdGFsTGluZXM6IHJlc3VsdC50b3RhbExpbmVzLFxuICAgICAgICAgIHBlcmZlY3RMaW5lczogcmVzdWx0LnBlcmZlY3RMaW5lcyxcbiAgICAgICAgICBnb29kTGluZXM6IHJlc3VsdC5nb29kTGluZXMsXG4gICAgICAgICAgbmVlZHNXb3JrTGluZXM6IHJlc3VsdC5uZWVkc1dvcmtMaW5lcyxcbiAgICAgICAgICBhY2N1cmFjeTogcmVzdWx0LmFjY3VyYWN5LFxuICAgICAgICAgIHNlc3Npb25JZDogcmVzdWx0LnNlc3Npb25JZCxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGNvbXBsZXRlIHNlc3Npb246JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ2V0VXNlckJlc3RTY29yZShzb25nSWQ6IHN0cmluZywgYXV0aFRva2VuOiBzdHJpbmcpOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChcbiAgICAgICAgYCR7dGhpcy5zZXJ2ZXJVcmx9L3VzZXJzL21lL3NvbmdzLyR7c29uZ0lkfS9iZXN0LXNjb3JlYCxcbiAgICAgICAge1xuICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICdBdXRob3JpemF0aW9uJzogYEJlYXJlciAke2F1dGhUb2tlbn1gLFxuICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgcmV0dXJuIGRhdGEuYmVzdFNjb3JlIHx8IG51bGw7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gZmV0Y2ggYmVzdCBzY29yZScpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGZldGNoIHVzZXIgYmVzdCBzY29yZTonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBnZXRTb25nTGVhZGVyYm9hcmQoc29uZ0lkOiBzdHJpbmcsIGxpbWl0OiBudW1iZXIgPSAxMCk6IFByb21pc2U8YW55W10+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChcbiAgICAgICAgYCR7dGhpcy5zZXJ2ZXJVcmx9L3NvbmdzLyR7c29uZ0lkfS9sZWFkZXJib2FyZD9saW1pdD0ke2xpbWl0fWBcbiAgICAgICk7XG5cbiAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICByZXR1cm4gZGF0YS5lbnRyaWVzIHx8IFtdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIFtdO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGZldGNoIGxlYWRlcmJvYXJkOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gIH1cbn0iLCJpbXBvcnQgdHlwZSB7IENodW5rSW5mbyB9IGZyb20gJy4uLy4uL3R5cGVzL2thcmFva2UnO1xuaW1wb3J0IHR5cGUgeyBMeXJpY0xpbmUgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb3VudFdvcmRzKHRleHQ6IHN0cmluZyk6IG51bWJlciB7XG4gIGlmICghdGV4dCkgcmV0dXJuIDA7XG4gIHJldHVybiB0ZXh0XG4gICAgLnRyaW0oKVxuICAgIC5zcGxpdCgvXFxzKy8pXG4gICAgLmZpbHRlcigod29yZCkgPT4gd29yZC5sZW5ndGggPiAwKS5sZW5ndGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRDaHVua0xpbmVzKFxuICBsaW5lczogTHlyaWNMaW5lW10sXG4gIHN0YXJ0SW5kZXg6IG51bWJlclxuKTogQ2h1bmtJbmZvIHtcbiAgLy8gUHJvY2VzcyBpbmRpdmlkdWFsIGxpbmVzIGluc3RlYWQgb2YgZ3JvdXBpbmdcbiAgY29uc3QgbGluZSA9IGxpbmVzW3N0YXJ0SW5kZXhdO1xuICBpZiAoIWxpbmUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhcnRJbmRleCxcbiAgICAgIGVuZEluZGV4OiBzdGFydEluZGV4LFxuICAgICAgZXhwZWN0ZWRUZXh0OiAnJyxcbiAgICAgIHdvcmRDb3VudDogMCxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgd29yZENvdW50ID0gY291bnRXb3JkcyhsaW5lLnRleHQgfHwgJycpO1xuICBcbiAgcmV0dXJuIHtcbiAgICBzdGFydEluZGV4LFxuICAgIGVuZEluZGV4OiBzdGFydEluZGV4LCAvLyBTaW5nbGUgbGluZSwgc28gc3RhcnQgYW5kIGVuZCBhcmUgdGhlIHNhbWVcbiAgICBleHBlY3RlZFRleHQ6IGxpbmUudGV4dCB8fCAnJyxcbiAgICB3b3JkQ291bnQsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYWxjdWxhdGVSZWNvcmRpbmdEdXJhdGlvbihcbiAgbGluZXM6IEx5cmljTGluZVtdLFxuICBjaHVua0luZm86IENodW5rSW5mb1xuKTogbnVtYmVyIHtcbiAgY29uc3QgeyBzdGFydEluZGV4LCBlbmRJbmRleCB9ID0gY2h1bmtJbmZvO1xuICBjb25zdCBsaW5lID0gbGluZXNbc3RhcnRJbmRleF07XG4gIFxuICBpZiAoIWxpbmUpIHJldHVybiAzMDAwO1xuXG4gIGlmIChlbmRJbmRleCA+IHN0YXJ0SW5kZXgpIHtcbiAgICBpZiAoZW5kSW5kZXggKyAxIDwgbGluZXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBuZXh0TGluZSA9IGxpbmVzW2VuZEluZGV4ICsgMV07XG4gICAgICBpZiAobmV4dExpbmUpIHtcbiAgICAgICAgLy8gQ29udmVydCBzZWNvbmRzIHRvIG1pbGxpc2Vjb25kc1xuICAgICAgICByZXR1cm4gKG5leHRMaW5lLnN0YXJ0VGltZSAtIGxpbmUuc3RhcnRUaW1lKSAqIDEwMDA7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGxldCBkdXJhdGlvbiA9IDA7XG4gICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPD0gZW5kSW5kZXg7IGkrKykge1xuICAgICAgLy8gZHVyYXRpb24gaXMgYWxyZWFkeSBpbiBtaWxsaXNlY29uZHNcbiAgICAgIGR1cmF0aW9uICs9IGxpbmVzW2ldPy5kdXJhdGlvbiB8fCAzMDAwO1xuICAgIH1cbiAgICByZXR1cm4gTWF0aC5taW4oZHVyYXRpb24sIDgwMDApO1xuICB9IGVsc2Uge1xuICAgIGlmIChzdGFydEluZGV4ICsgMSA8IGxpbmVzLmxlbmd0aCkge1xuICAgICAgY29uc3QgbmV4dExpbmUgPSBsaW5lc1tzdGFydEluZGV4ICsgMV07XG4gICAgICBpZiAobmV4dExpbmUpIHtcbiAgICAgICAgLy8gQ29udmVydCBzZWNvbmRzIHRvIG1pbGxpc2Vjb25kc1xuICAgICAgICBjb25zdCBjYWxjdWxhdGVkRHVyYXRpb24gPSAobmV4dExpbmUuc3RhcnRUaW1lIC0gbGluZS5zdGFydFRpbWUpICogMTAwMDtcbiAgICAgICAgcmV0dXJuIE1hdGgubWluKE1hdGgubWF4KGNhbGN1bGF0ZWREdXJhdGlvbiwgMTAwMCksIDUwMDApO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gTWF0aC5taW4obGluZS5kdXJhdGlvbiB8fCAzMDAwLCA1MDAwKTtcbiAgfVxufSIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJvZ3Jlc3NCYXJQcm9wcyB7XG4gIGN1cnJlbnQ6IG51bWJlcjtcbiAgdG90YWw6IG51bWJlcjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBQcm9ncmVzc0JhcjogQ29tcG9uZW50PFByb2dyZXNzQmFyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHBlcmNlbnRhZ2UgPSAoKSA9PiBNYXRoLm1pbigxMDAsIE1hdGgubWF4KDAsIChwcm9wcy5jdXJyZW50IC8gcHJvcHMudG90YWwpICogMTAwKSk7XG4gIFxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCd3LWZ1bGwgaC0xLjUgYmctaGlnaGxpZ2h0JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxkaXZcbiAgICAgICAgY2xhc3M9XCJoLWZ1bGwgYmctYWNjZW50IHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCBlYXNlLW91dCByb3VuZGVkLXItc21cIlxuICAgICAgICBzdHlsZT17eyB3aWR0aDogYCR7cGVyY2VudGFnZSgpfSVgIH19XG4gICAgICAvPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcblxuZXhwb3J0IGludGVyZmFjZSBNaW5pbWl6ZWRLYXJhb2tlUHJvcHMge1xuICBvbkNsaWNrOiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgTWluaW1pemVkS2FyYW9rZTogQ29tcG9uZW50PE1pbmltaXplZEthcmFva2VQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8YnV0dG9uXG4gICAgICBvbkNsaWNrPXtwcm9wcy5vbkNsaWNrfVxuICAgICAgc3R5bGU9e3tcbiAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICAgIGJvdHRvbTogJzI0cHgnLFxuICAgICAgICByaWdodDogJzI0cHgnLFxuICAgICAgICB3aWR0aDogJzgwcHgnLFxuICAgICAgICBoZWlnaHQ6ICc4MHB4JyxcbiAgICAgICAgJ2JvcmRlci1yYWRpdXMnOiAnNTAlJyxcbiAgICAgICAgYmFja2dyb3VuZDogJ2xpbmVhci1ncmFkaWVudCgxMzVkZWcsICNGRjAwNkUgMCUsICNDMTM1ODQgMTAwJSknLFxuICAgICAgICAnYm94LXNoYWRvdyc6ICcwIDhweCAzMnB4IHJnYmEoMCwgMCwgMCwgMC4zKScsXG4gICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcbiAgICAgICAgJ2FsaWduLWl0ZW1zJzogJ2NlbnRlcicsXG4gICAgICAgICdqdXN0aWZ5LWNvbnRlbnQnOiAnY2VudGVyJyxcbiAgICAgICAgb3ZlcmZsb3c6ICdoaWRkZW4nLFxuICAgICAgICBjdXJzb3I6ICdwb2ludGVyJyxcbiAgICAgICAgJ3otaW5kZXgnOiAnOTk5OTknLFxuICAgICAgICBib3JkZXI6ICdub25lJyxcbiAgICAgICAgdHJhbnNpdGlvbjogJ3RyYW5zZm9ybSAwLjJzIGVhc2UnLFxuICAgICAgfX1cbiAgICAgIG9uTW91c2VFbnRlcj17KGUpID0+IHtcbiAgICAgICAgZS5jdXJyZW50VGFyZ2V0LnN0eWxlLnRyYW5zZm9ybSA9ICdzY2FsZSgxLjEpJztcbiAgICAgIH19XG4gICAgICBvbk1vdXNlTGVhdmU9eyhlKSA9PiB7XG4gICAgICAgIGUuY3VycmVudFRhcmdldC5zdHlsZS50cmFuc2Zvcm0gPSAnc2NhbGUoMSknO1xuICAgICAgfX1cbiAgICAgIGFyaWEtbGFiZWw9XCJPcGVuIEthcmFva2VcIlxuICAgID5cbiAgICAgIHsvKiBQbGFjZSB5b3VyIDIwMHgyMDAgaW1hZ2UgaGVyZSBhczogKi99XG4gICAgICB7LyogPGltZyBzcmM9XCIvcGF0aC90by95b3VyL2ltYWdlLnBuZ1wiIGFsdD1cIkthcmFva2VcIiBzdHlsZT1cIndpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IG9iamVjdC1maXQ6IGNvdmVyO1wiIC8+ICovfVxuICAgICAgXG4gICAgICB7LyogRm9yIG5vdywgdXNpbmcgYSBwbGFjZWhvbGRlciBpY29uICovfVxuICAgICAgPHNwYW4gc3R5bGU9e3sgJ2ZvbnQtc2l6ZSc6ICczNnB4JyB9fT7wn46kPC9zcGFuPlxuICAgIDwvYnV0dG9uPlxuICApO1xufTsiLCJleHBvcnQgZGVmYXVsdCAocCkgPT4gKDxzdmcgY2xhc3M9e3AuY2xhc3N9IGRhdGEtcGhvc3Bob3ItaWNvbj1cInhcIiBhcmlhLWhpZGRlbj1cInRydWVcIiB3aWR0aD1cIjFlbVwiIGhlaWdodD1cIjFlbVwiIHBvaW50ZXItZXZlbnRzPVwibm9uZVwiIGRpc3BsYXk9XCJpbmxpbmUtYmxvY2tcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgZmlsbD1cImN1cnJlbnRDb2xvclwiIHZpZXdCb3g9XCIwIDAgMjU2IDI1NlwiPjxwYXRoIGQ9XCJNMjA1LjY2IDE5NC4zNGE4IDggMCAwIDEtMTEuMzIgMTEuMzJMMTI4IDEzOS4zMWwtNjYuMzQgNjYuMzVhOCA4IDAgMCAxLTExLjMyLTExLjMyTDExNi42OSAxMjggNTAuMzQgNjEuNjZhOCA4IDAgMCAxIDExLjMyLTExLjMyTDEyOCAxMTYuNjlsNjYuMzQtNjYuMzVhOCA4IDAgMCAxIDExLjMyIDExLjMyTDEzOS4zMSAxMjhaXCIvPjwvc3ZnPik7XG4iLCJpbXBvcnQgeyBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgSWNvblhSZWd1bGFyIGZyb20gJ3Bob3NwaG9yLWljb25zLXNvbGlkL0ljb25YUmVndWxhcic7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBQcmFjdGljZUhlYWRlclByb3BzIHtcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIG9uRXhpdDogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBQcmFjdGljZUhlYWRlcjogQ29tcG9uZW50PFByYWN0aWNlSGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGhlYWRlciBjbGFzcz17Y24oJ2ZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBoLTE0IHB4LTQgYmctdHJhbnNwYXJlbnQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkV4aXR9XG4gICAgICAgIGNsYXNzPVwicC0yIC1tbC0yIHJvdW5kZWQtZnVsbCBob3ZlcjpiZy1oaWdobGlnaHQgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICBhcmlhLWxhYmVsPVwiRXhpdCBwcmFjdGljZVwiXG4gICAgICA+XG4gICAgICAgIDxJY29uWFJlZ3VsYXIgY2xhc3M9XCJ0ZXh0LXNlY29uZGFyeSB3LTYgaC02XCIgLz5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgXG4gICAgICA8U2hvdyB3aGVuPXtwcm9wcy50aXRsZX0+XG4gICAgICAgIDxoMSBjbGFzcz1cInRleHQtbGcgZm9udC1zZW1pYm9sZCB0ZXh0LXByaW1hcnkgYWJzb2x1dGUgbGVmdC0xLzIgdHJhbnNmb3JtIC10cmFuc2xhdGUteC0xLzJcIj5cbiAgICAgICAgICB7cHJvcHMudGl0bGV9XG4gICAgICAgIDwvaDE+XG4gICAgICA8L1Nob3c+XG4gICAgICBcbiAgICAgIHsvKiBTcGFjZXIgdG8gYmFsYW5jZSB0aGUgbGF5b3V0ICovfVxuICAgICAgPGRpdiBjbGFzcz1cInctMTBcIiAvPlxuICAgIDwvaGVhZGVyPlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vQnV0dG9uJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4ZXJjaXNlRm9vdGVyUHJvcHMge1xuICBpc1JlY29yZGluZz86IGJvb2xlYW47XG4gIGlzUHJvY2Vzc2luZz86IGJvb2xlYW47XG4gIGNhblN1Ym1pdD86IGJvb2xlYW47XG4gIG9uUmVjb3JkPzogKCkgPT4gdm9pZDtcbiAgb25TdG9wPzogKCkgPT4gdm9pZDtcbiAgb25TdWJtaXQ/OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEV4ZXJjaXNlRm9vdGVyOiBDb21wb25lbnQ8RXhlcmNpc2VGb290ZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8Zm9vdGVyIGNsYXNzPXtjbignZml4ZWQgYm90dG9tLTAgbGVmdC0wIHJpZ2h0LTAgYmctYmFzZSBib3JkZXItdCBib3JkZXItc2Vjb25kYXJ5LzIwJywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxkaXYgY2xhc3M9XCJwLTRcIj5cbiAgICAgICAgPFNob3dcbiAgICAgICAgICB3aGVuPXshcHJvcHMuaXNSZWNvcmRpbmd9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgIGZ1bGxXaWR0aFxuICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblN0b3B9XG4gICAgICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5pc1Byb2Nlc3Npbmd9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIFN0b3BcbiAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIH1cbiAgICAgICAgPlxuICAgICAgICAgIDxTaG93XG4gICAgICAgICAgICB3aGVuPXtwcm9wcy5jYW5TdWJtaXR9XG4gICAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblJlY29yZH1cbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17cHJvcHMuaXNQcm9jZXNzaW5nfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgUmVjb3JkXG4gICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgdmFyaWFudD1cInByaW1hcnlcIlxuICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25TdWJtaXR9XG4gICAgICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5pc1Byb2Nlc3Npbmd9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtwcm9wcy5pc1Byb2Nlc3NpbmcgPyAnUHJvY2Vzc2luZy4uLicgOiAnU3VibWl0J31cbiAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgPC9TaG93PlxuICAgICAgPC9kaXY+XG4gICAgPC9mb290ZXI+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50LCBKU1ggfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBFeGVyY2lzZVRlbXBsYXRlUHJvcHMge1xuICBpbnN0cnVjdGlvblRleHQ/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBFeGVyY2lzZVRlbXBsYXRlOiBDb21wb25lbnQ8RXhlcmNpc2VUZW1wbGF0ZVByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sIGgtZnVsbCBiZy1iYXNlIHRleHQtcHJpbWFyeScsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8ZGl2IGNsYXNzPVwiZmxleC1ncm93IG92ZXJmbG93LXktYXV0byBmbGV4IGZsZXgtY29sIHBiLTI0XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ3LWZ1bGwgbWF4LXctMnhsIG14LWF1dG8gcHgtNCBwdC02XCI+XG4gICAgICAgICAge3Byb3BzLmluc3RydWN0aW9uVGV4dCAmJiAoXG4gICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgZm9udC1zZW1pYm9sZCBtYi00IHRleHQtbGVmdFwiPlxuICAgICAgICAgICAgICB7cHJvcHMuaW5zdHJ1Y3Rpb25UZXh0fVxuICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICl9XG4gICAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBSZWFkQWxvdWRQcm9wcyB7XG4gIHByb21wdDogc3RyaW5nO1xuICB1c2VyVHJhbnNjcmlwdD86IHN0cmluZztcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBSZWFkQWxvdWQ6IENvbXBvbmVudDxSZWFkQWxvdWRQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignc3BhY2UteS00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxwIGNsYXNzPVwidGV4dC0yeGwgdGV4dC1sZWZ0IGxlYWRpbmctcmVsYXhlZFwiPlxuICAgICAgICB7cHJvcHMucHJvbXB0fVxuICAgICAgPC9wPlxuICAgICAgXG4gICAgICA8U2hvdyB3aGVuPXtwcm9wcy51c2VyVHJhbnNjcmlwdH0+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJtdC02IHB0LTYgYm9yZGVyLXQgYm9yZGVyLWJvcmRlclwiPlxuICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zbSB0ZXh0LW11dGVkLWZvcmVncm91bmQgbWItMlwiPllvdSBzYWlkOjwvcD5cbiAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1mb3JlZ3JvdW5kXCI+XG4gICAgICAgICAgICB7cHJvcHMudXNlclRyYW5zY3JpcHR9XG4gICAgICAgICAgPC9wPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBTaG93LCBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB7IFVzZXJQcm9maWxlIH0gZnJvbSAnLi4vVXNlclByb2ZpbGUnO1xuaW1wb3J0IHsgQ3JlZGl0UGFjayB9IGZyb20gJy4uL0NyZWRpdFBhY2snO1xuaW1wb3J0IHsgV2FsbGV0Q29ubmVjdCB9IGZyb20gJy4uL1dhbGxldENvbm5lY3QnO1xuaW1wb3J0IHsgRmFyY2FzdGVyS2FyYW9rZVZpZXcgfSBmcm9tICcuLi8uLi9rYXJhb2tlL0ZhcmNhc3RlckthcmFva2VWaWV3JztcbmltcG9ydCB0eXBlIHsgTHlyaWNMaW5lIH0gZnJvbSAnLi4vLi4va2FyYW9rZS9MeXJpY3NEaXNwbGF5JztcbmltcG9ydCB0eXBlIHsgTGVhZGVyYm9hcmRFbnRyeSB9IGZyb20gJy4uLy4uL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmFyY2FzdGVyTWluaUFwcFByb3BzIHtcbiAgLy8gVXNlciBpbmZvXG4gIHVzZXI/OiB7XG4gICAgZmlkPzogbnVtYmVyO1xuICAgIHVzZXJuYW1lPzogc3RyaW5nO1xuICAgIGRpc3BsYXlOYW1lPzogc3RyaW5nO1xuICAgIHBmcFVybD86IHN0cmluZztcbiAgfTtcbiAgXG4gIC8vIFdhbGxldFxuICB3YWxsZXRBZGRyZXNzPzogc3RyaW5nO1xuICB3YWxsZXRDaGFpbj86ICdCYXNlJyB8ICdTb2xhbmEnO1xuICBpc1dhbGxldENvbm5lY3RlZD86IGJvb2xlYW47XG4gIFxuICAvLyBDcmVkaXRzXG4gIHVzZXJDcmVkaXRzPzogbnVtYmVyO1xuICBcbiAgLy8gQ2FsbGJhY2tzXG4gIG9uQ29ubmVjdFdhbGxldD86ICgpID0+IHZvaWQ7XG4gIG9uRGlzY29ubmVjdFdhbGxldD86ICgpID0+IHZvaWQ7XG4gIG9uUHVyY2hhc2VDcmVkaXRzPzogKHBhY2s6IHsgY3JlZGl0czogbnVtYmVyOyBwcmljZTogc3RyaW5nOyBjdXJyZW5jeTogc3RyaW5nIH0pID0+IHZvaWQ7XG4gIG9uU2VsZWN0U29uZz86ICgpID0+IHZvaWQ7XG4gIFxuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEZhcmNhc3Rlck1pbmlBcHA6IENvbXBvbmVudDxGYXJjYXN0ZXJNaW5pQXBwUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtzaG93S2FyYW9rZSwgc2V0U2hvd0thcmFva2VdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgXG4gIC8vIE1vY2sgZGF0YSBmb3IgZGVtb1xuICBjb25zdCBtb2NrTHlyaWNzOiBMeXJpY0xpbmVbXSA9IFtcbiAgICB7IGlkOiAnMScsIHRleHQ6IFwiSXMgdGhpcyB0aGUgcmVhbCBsaWZlP1wiLCBzdGFydFRpbWU6IDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzInLCB0ZXh0OiBcIklzIHRoaXMganVzdCBmYW50YXN5P1wiLCBzdGFydFRpbWU6IDIwMDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzMnLCB0ZXh0OiBcIkNhdWdodCBpbiBhIGxhbmRzbGlkZVwiLCBzdGFydFRpbWU6IDQwMDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzQnLCB0ZXh0OiBcIk5vIGVzY2FwZSBmcm9tIHJlYWxpdHlcIiwgc3RhcnRUaW1lOiA2MDAwLCBkdXJhdGlvbjogMjAwMCB9LFxuICBdO1xuICBcbiAgY29uc3QgbW9ja0xlYWRlcmJvYXJkOiBMZWFkZXJib2FyZEVudHJ5W10gPSBbXG4gICAgeyByYW5rOiAxLCB1c2VybmFtZTogXCJhbGljZVwiLCBzY29yZTogOTgwIH0sXG4gICAgeyByYW5rOiAyLCB1c2VybmFtZTogXCJib2JcIiwgc2NvcmU6IDk0NSB9LFxuICAgIHsgcmFuazogMywgdXNlcm5hbWU6IFwiY2Fyb2xcIiwgc2NvcmU6IDkyMCB9LFxuICBdO1xuXG4gIGNvbnN0IGNyZWRpdFBhY2tzID0gW1xuICAgIHsgY3JlZGl0czogMjUwLCBwcmljZTogJzIuNTAnLCBjdXJyZW5jeTogJ1VTREMnIGFzIGNvbnN0IH0sXG4gICAgeyBjcmVkaXRzOiA1MDAsIHByaWNlOiAnNC43NScsIGN1cnJlbmN5OiAnVVNEQycgYXMgY29uc3QsIGRpc2NvdW50OiA1LCByZWNvbW1lbmRlZDogdHJ1ZSB9LFxuICAgIHsgY3JlZGl0czogMTIwMCwgcHJpY2U6ICcxMC4wMCcsIGN1cnJlbmN5OiAnVVNEQycgYXMgY29uc3QsIGRpc2NvdW50OiAxNiB9LFxuICBdO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgaC1zY3JlZW4gYmctYmFzZScsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogSGVhZGVyIHdpdGggdXNlciBwcm9maWxlICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2UgYm9yZGVyLWIgYm9yZGVyLXN1YnRsZVwiPlxuICAgICAgICA8VXNlclByb2ZpbGVcbiAgICAgICAgICBmaWQ9e3Byb3BzLnVzZXI/LmZpZH1cbiAgICAgICAgICB1c2VybmFtZT17cHJvcHMudXNlcj8udXNlcm5hbWV9XG4gICAgICAgICAgZGlzcGxheU5hbWU9e3Byb3BzLnVzZXI/LmRpc3BsYXlOYW1lfVxuICAgICAgICAgIHBmcFVybD17cHJvcHMudXNlcj8ucGZwVXJsfVxuICAgICAgICAgIGNyZWRpdHM9e3Byb3BzLnVzZXJDcmVkaXRzIHx8IDB9XG4gICAgICAgIC8+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgey8qIE1haW4gY29udGVudCAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgb3ZlcmZsb3ctYXV0b1wiPlxuICAgICAgICA8U2hvd1xuICAgICAgICAgIHdoZW49e3Nob3dLYXJhb2tlKCl9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInAtNCBzcGFjZS15LTZcIj5cbiAgICAgICAgICAgICAgey8qIEhlcm8gc2VjdGlvbiAqL31cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIHB5LThcIj5cbiAgICAgICAgICAgICAgICA8aDEgY2xhc3M9XCJ0ZXh0LTN4bCBmb250LWJvbGQgbWItMlwiPlNjYXJsZXR0IEthcmFva2U8L2gxPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zZWNvbmRhcnlcIj5cbiAgICAgICAgICAgICAgICAgIFNpbmcgeW91ciBmYXZvcml0ZSBzb25ncyBhbmQgY29tcGV0ZSB3aXRoIGZyaWVuZHMhXG4gICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIHsvKiBDcmVkaXRzIGNoZWNrICovfVxuICAgICAgICAgICAgICA8U2hvd1xuICAgICAgICAgICAgICAgIHdoZW49e3Byb3BzLnVzZXJDcmVkaXRzICYmIHByb3BzLnVzZXJDcmVkaXRzID4gMH1cbiAgICAgICAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS02XCI+XG4gICAgICAgICAgICAgICAgICAgIHsvKiBXYWxsZXQgY29ubmVjdGlvbiAqL31cbiAgICAgICAgICAgICAgICAgICAgPFdhbGxldENvbm5lY3RcbiAgICAgICAgICAgICAgICAgICAgICBhZGRyZXNzPXtwcm9wcy53YWxsZXRBZGRyZXNzfVxuICAgICAgICAgICAgICAgICAgICAgIGNoYWluPXtwcm9wcy53YWxsZXRDaGFpbn1cbiAgICAgICAgICAgICAgICAgICAgICBpc0Nvbm5lY3RlZD17cHJvcHMuaXNXYWxsZXRDb25uZWN0ZWR9XG4gICAgICAgICAgICAgICAgICAgICAgb25Db25uZWN0PXtwcm9wcy5vbkNvbm5lY3RXYWxsZXR9XG4gICAgICAgICAgICAgICAgICAgICAgb25EaXNjb25uZWN0PXtwcm9wcy5vbkRpc2Nvbm5lY3RXYWxsZXR9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB7LyogQ3JlZGl0IHBhY2tzICovfVxuICAgICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5pc1dhbGxldENvbm5lY3RlZH0+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQteGwgZm9udC1zZW1pYm9sZCBtYi00XCI+UHVyY2hhc2UgQ3JlZGl0czwvaDI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtMyBnYXAtNFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7Y3JlZGl0UGFja3MubWFwKChwYWNrKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPENyZWRpdFBhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsuLi5wYWNrfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25QdXJjaGFzZT17KCkgPT4gcHJvcHMub25QdXJjaGFzZUNyZWRpdHM/LihwYWNrKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICB7LyogU29uZyBzZWxlY3Rpb24gKi99XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNFwiPlxuICAgICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC14bCBmb250LXNlbWlib2xkXCI+U2VsZWN0IGEgU29uZzwvaDI+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uIFxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBwLTQgYmctc3VyZmFjZSByb3VuZGVkLWxnIGJvcmRlciBib3JkZXItc3VidGxlIGhvdmVyOmJvcmRlci1hY2NlbnQtcHJpbWFyeSB0cmFuc2l0aW9uLWNvbG9ycyB0ZXh0LWxlZnRcIlxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93S2FyYW9rZSh0cnVlKX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZvbnQtc2VtaWJvbGRcIj5Cb2hlbWlhbiBSaGFwc29keTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeVwiPlF1ZWVuPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXhzIHRleHQtdGVydGlhcnkgbXQtMVwiPkNvc3Q6IDUwIGNyZWRpdHM8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICB9XG4gICAgICAgID5cbiAgICAgICAgICA8RmFyY2FzdGVyS2FyYW9rZVZpZXdcbiAgICAgICAgICAgIHNvbmdUaXRsZT1cIkJvaGVtaWFuIFJoYXBzb2R5XCJcbiAgICAgICAgICAgIGFydGlzdD1cIlF1ZWVuXCJcbiAgICAgICAgICAgIHNjb3JlPXswfVxuICAgICAgICAgICAgcmFuaz17MX1cbiAgICAgICAgICAgIGx5cmljcz17bW9ja0x5cmljc31cbiAgICAgICAgICAgIGN1cnJlbnRUaW1lPXswfVxuICAgICAgICAgICAgbGVhZGVyYm9hcmQ9e21vY2tMZWFkZXJib2FyZH1cbiAgICAgICAgICAgIGlzUGxheWluZz17ZmFsc2V9XG4gICAgICAgICAgICBvblN0YXJ0PXsoKSA9PiBjb25zb2xlLmxvZygnU3RhcnQga2FyYW9rZScpfVxuICAgICAgICAgICAgb25TcGVlZENoYW5nZT17KHNwZWVkKSA9PiBjb25zb2xlLmxvZygnU3BlZWQ6Jywgc3BlZWQpfVxuICAgICAgICAgICAgb25CYWNrPXsoKSA9PiBzZXRTaG93S2FyYW9rZShmYWxzZSl9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9TaG93PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgRm9yIH0gZnJvbSAnc29saWQtanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNvbmcge1xuICBpZDogc3RyaW5nO1xuICB0cmFja0lkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGFydGlzdDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhvbWVQYWdlUHJvcHMge1xuICBzb25nczogU29uZ1tdO1xuICBvblNvbmdTZWxlY3Q/OiAoc29uZzogU29uZykgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IEhvbWVQYWdlOiBDb21wb25lbnQ8SG9tZVBhZ2VQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3Qgc29uZ0l0ZW1TdHlsZSA9IHtcbiAgICBwYWRkaW5nOiAnMTZweCcsXG4gICAgJ21hcmdpbi1ib3R0b20nOiAnOHB4JyxcbiAgICAnYmFja2dyb3VuZC1jb2xvcic6ICcjMWExYTFhJyxcbiAgICAnYm9yZGVyLXJhZGl1cyc6ICc4cHgnLFxuICAgIGN1cnNvcjogJ3BvaW50ZXInXG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2PlxuICAgICAgPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAnMTZweCcsICdiYWNrZ3JvdW5kLWNvbG9yJzogJyMxYTFhMWEnIH19PlxuICAgICAgICA8aDEgc3R5bGU9e3sgbWFyZ2luOiAnMCAwIDhweCAwJywgJ2ZvbnQtc2l6ZSc6ICcyNHB4JyB9fT5Qb3B1bGFyIFNvbmdzPC9oMT5cbiAgICAgICAgPHAgc3R5bGU9e3sgbWFyZ2luOiAnMCcsIGNvbG9yOiAnIzg4OCcgfX0+Q2hvb3NlIGEgc29uZyB0byBzdGFydCBzaW5naW5nPC9wPlxuICAgICAgPC9kaXY+XG4gICAgICBcbiAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogJzE2cHgnIH19PlxuICAgICAgICA8Rm9yIGVhY2g9e3Byb3BzLnNvbmdzfT5cbiAgICAgICAgICB7KHNvbmcsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICA8ZGl2IFxuICAgICAgICAgICAgICBzdHlsZT17c29uZ0l0ZW1TdHlsZX1cbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gcHJvcHMub25Tb25nU2VsZWN0Py4oc29uZyl9XG4gICAgICAgICAgICAgIG9uTW91c2VFbnRlcj17KGUpID0+IGUuY3VycmVudFRhcmdldC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnIzJhMmEyYSd9XG4gICAgICAgICAgICAgIG9uTW91c2VMZWF2ZT17KGUpID0+IGUuY3VycmVudFRhcmdldC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnIzFhMWExYSd9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBnYXA6ICcxNnB4JyB9fT5cbiAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17eyBjb2xvcjogJyM2NjYnIH19PntpbmRleCgpICsgMX08L3NwYW4+XG4gICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgJ2ZvbnQtd2VpZ2h0JzogJ2JvbGQnIH19Pntzb25nLnRpdGxlfTwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBjb2xvcjogJyM4ODgnIH19Pntzb25nLmFydGlzdH08L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApfVxuICAgICAgICA8L0Zvcj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIG9uQ2xlYW51cCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgTHlyaWNMaW5lIH0gZnJvbSAnLi4vY29tcG9uZW50cy9rYXJhb2tlL0x5cmljc0Rpc3BsYXknO1xuaW1wb3J0IHsgY3JlYXRlS2FyYW9rZUF1ZGlvUHJvY2Vzc29yIH0gZnJvbSAnLi4vc2VydmljZXMvYXVkaW8va2FyYW9rZUF1ZGlvUHJvY2Vzc29yJztcbmltcG9ydCB7IHNob3VsZENodW5rTGluZXMsIGNhbGN1bGF0ZVJlY29yZGluZ0R1cmF0aW9uIH0gZnJvbSAnLi4vc2VydmljZXMva2FyYW9rZS9jaHVua2luZ1V0aWxzJztcbmltcG9ydCB7IEthcmFva2VBcGlTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMva2FyYW9rZS9rYXJhb2tlQXBpJztcbmltcG9ydCB0eXBlIHsgQ2h1bmtJbmZvIH0gZnJvbSAnLi4vdHlwZXMva2FyYW9rZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVXNlS2FyYW9rZVNlc3Npb25PcHRpb25zIHtcbiAgbHlyaWNzOiBMeXJpY0xpbmVbXTtcbiAgb25Db21wbGV0ZT86IChyZXN1bHRzOiBLYXJhb2tlUmVzdWx0cykgPT4gdm9pZDtcbiAgYXVkaW9FbGVtZW50PzogSFRNTEF1ZGlvRWxlbWVudDtcbiAgdHJhY2tJZD86IHN0cmluZztcbiAgc29uZ0RhdGE/OiB7XG4gICAgdGl0bGU6IHN0cmluZztcbiAgICBhcnRpc3Q6IHN0cmluZztcbiAgICBhbGJ1bT86IHN0cmluZztcbiAgICBkdXJhdGlvbj86IG51bWJlcjtcbiAgfTtcbiAgc29uZ0NhdGFsb2dJZD86IHN0cmluZztcbiAgYXBpVXJsPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEthcmFva2VSZXN1bHRzIHtcbiAgc2NvcmU6IG51bWJlcjtcbiAgYWNjdXJhY3k6IG51bWJlcjtcbiAgdG90YWxMaW5lczogbnVtYmVyO1xuICBwZXJmZWN0TGluZXM6IG51bWJlcjtcbiAgZ29vZExpbmVzOiBudW1iZXI7XG4gIG5lZWRzV29ya0xpbmVzOiBudW1iZXI7XG4gIHNlc3Npb25JZD86IHN0cmluZztcbiAgaXNMb2FkaW5nPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMaW5lU2NvcmUge1xuICBsaW5lSW5kZXg6IG51bWJlcjtcbiAgc2NvcmU6IG51bWJlcjtcbiAgdHJhbnNjcmlwdGlvbjogc3RyaW5nO1xuICBmZWVkYmFjaz86IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUthcmFva2VTZXNzaW9uKG9wdGlvbnM6IFVzZUthcmFva2VTZXNzaW9uT3B0aW9ucykge1xuICBjb25zdCBbaXNQbGF5aW5nLCBzZXRJc1BsYXlpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2N1cnJlbnRUaW1lLCBzZXRDdXJyZW50VGltZV0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFtzY29yZSwgc2V0U2NvcmVdID0gY3JlYXRlU2lnbmFsKDApO1xuICBjb25zdCBbY291bnRkb3duLCBzZXRDb3VudGRvd25dID0gY3JlYXRlU2lnbmFsPG51bWJlciB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbc2Vzc2lvbklkLCBzZXRTZXNzaW9uSWRdID0gY3JlYXRlU2lnbmFsPHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbbGluZVNjb3Jlcywgc2V0TGluZVNjb3Jlc10gPSBjcmVhdGVTaWduYWw8TGluZVNjb3JlW10+KFtdKTtcbiAgY29uc3QgW2N1cnJlbnRDaHVuaywgc2V0Q3VycmVudENodW5rXSA9IGNyZWF0ZVNpZ25hbDxDaHVua0luZm8gfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2lzUmVjb3JkaW5nLCBzZXRJc1JlY29yZGluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbYXVkaW9FbGVtZW50LCBzZXRBdWRpb0VsZW1lbnRdID0gY3JlYXRlU2lnbmFsPEhUTUxBdWRpb0VsZW1lbnQgfCB1bmRlZmluZWQ+KG9wdGlvbnMuYXVkaW9FbGVtZW50KTtcbiAgY29uc3QgW3JlY29yZGVkQ2h1bmtzLCBzZXRSZWNvcmRlZENodW5rc10gPSBjcmVhdGVTaWduYWw8U2V0PG51bWJlcj4+KG5ldyBTZXQoKSk7XG4gIFxuICBsZXQgYXVkaW9VcGRhdGVJbnRlcnZhbDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gIGxldCByZWNvcmRpbmdUaW1lb3V0OiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgXG4gIGNvbnN0IGF1ZGlvUHJvY2Vzc29yID0gY3JlYXRlS2FyYW9rZUF1ZGlvUHJvY2Vzc29yKHtcbiAgICBzYW1wbGVSYXRlOiAxNjAwMFxuICB9KTtcbiAgXG4gIGNvbnN0IGthcmFva2VBcGkgPSBuZXcgS2FyYW9rZUFwaVNlcnZpY2Uob3B0aW9ucy5hcGlVcmwpO1xuXG4gIGNvbnN0IHN0YXJ0U2Vzc2lvbiA9IGFzeW5jICgpID0+IHtcbiAgICAvLyBJbml0aWFsaXplIGF1ZGlvIGNhcHR1cmVcbiAgICB0cnkge1xuICAgICAgYXdhaXQgYXVkaW9Qcm9jZXNzb3IuaW5pdGlhbGl6ZSgpO1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlU2Vzc2lvbl0gQXVkaW8gcHJvY2Vzc29yIGluaXRpYWxpemVkJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIGluaXRpYWxpemUgYXVkaW86JywgZXJyb3IpO1xuICAgIH1cbiAgICBcbiAgICAvLyBDcmVhdGUgc2Vzc2lvbiBvbiBzZXJ2ZXIgaWYgdHJhY2tJZCBwcm92aWRlZFxuICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIFNlc3Npb24gY3JlYXRpb24gY2hlY2s6Jywge1xuICAgICAgaGFzVHJhY2tJZDogISFvcHRpb25zLnRyYWNrSWQsXG4gICAgICBoYXNTb25nRGF0YTogISFvcHRpb25zLnNvbmdEYXRhLFxuICAgICAgdHJhY2tJZDogb3B0aW9ucy50cmFja0lkLFxuICAgICAgc29uZ0RhdGE6IG9wdGlvbnMuc29uZ0RhdGEsXG4gICAgICBhcGlVcmw6IG9wdGlvbnMuYXBpVXJsXG4gICAgfSk7XG4gICAgXG4gICAgaWYgKG9wdGlvbnMudHJhY2tJZCAmJiBvcHRpb25zLnNvbmdEYXRhKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBDcmVhdGluZyBzZXNzaW9uIG9uIHNlcnZlci4uLicpO1xuICAgICAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQga2FyYW9rZUFwaS5zdGFydFNlc3Npb24oXG4gICAgICAgICAgb3B0aW9ucy50cmFja0lkLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRpdGxlOiBvcHRpb25zLnNvbmdEYXRhLnRpdGxlLFxuICAgICAgICAgICAgYXJ0aXN0OiBvcHRpb25zLnNvbmdEYXRhLmFydGlzdCxcbiAgICAgICAgICAgIGR1cmF0aW9uOiBvcHRpb25zLnNvbmdEYXRhLmR1cmF0aW9uLFxuICAgICAgICAgICAgZGlmZmljdWx0eTogJ2ludGVybWVkaWF0ZScsIC8vIERlZmF1bHQgZGlmZmljdWx0eVxuICAgICAgICAgIH0sXG4gICAgICAgICAgdW5kZWZpbmVkLCAvLyBhdXRoVG9rZW5cbiAgICAgICAgICBvcHRpb25zLnNvbmdDYXRhbG9nSWRcbiAgICAgICAgKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChzZXNzaW9uKSB7XG4gICAgICAgICAgc2V0U2Vzc2lvbklkKHNlc3Npb24uaWQpO1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIFNlc3Npb24gY3JlYXRlZDonLCBzZXNzaW9uLmlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBjcmVhdGUgc2Vzc2lvbicpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBjcmVhdGUgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIFNraXBwaW5nIHNlc3Npb24gY3JlYXRpb24gLSBtaXNzaW5nIHRyYWNrSWQgb3Igc29uZ0RhdGEnKTtcbiAgICB9XG4gICAgXG4gICAgLy8gU3RhcnQgY291bnRkb3duXG4gICAgc2V0Q291bnRkb3duKDMpO1xuICAgIFxuICAgIGNvbnN0IGNvdW50ZG93bkludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudCA9IGNvdW50ZG93bigpO1xuICAgICAgaWYgKGN1cnJlbnQgIT09IG51bGwgJiYgY3VycmVudCA+IDEpIHtcbiAgICAgICAgc2V0Q291bnRkb3duKGN1cnJlbnQgLSAxKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwoY291bnRkb3duSW50ZXJ2YWwpO1xuICAgICAgICBzZXRDb3VudGRvd24obnVsbCk7XG4gICAgICAgIHN0YXJ0UGxheWJhY2soKTtcbiAgICAgIH1cbiAgICB9LCAxMDAwKTtcbiAgfTtcblxuICBjb25zdCBzdGFydFBsYXliYWNrID0gKCkgPT4ge1xuICAgIHNldElzUGxheWluZyh0cnVlKTtcbiAgICBcbiAgICAvLyBTdGFydCBmdWxsIHNlc3Npb24gYXVkaW8gY2FwdHVyZVxuICAgIGF1ZGlvUHJvY2Vzc29yLnN0YXJ0RnVsbFNlc3Npb24oKTtcbiAgICBcbiAgICBjb25zdCBhdWRpbyA9IGF1ZGlvRWxlbWVudCgpIHx8IG9wdGlvbnMuYXVkaW9FbGVtZW50O1xuICAgIGlmIChhdWRpbykge1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlU2Vzc2lvbl0gU3RhcnRpbmcgcGxheWJhY2sgd2l0aCBhdWRpbyBlbGVtZW50Jyk7XG4gICAgICAvLyBJZiBhdWRpbyBlbGVtZW50IGlzIHByb3ZpZGVkLCB1c2UgaXRcbiAgICAgIGF1ZGlvLnBsYXkoKS5jYXRjaChjb25zb2xlLmVycm9yKTtcbiAgICAgIFxuICAgICAgY29uc3QgdXBkYXRlVGltZSA9ICgpID0+IHtcbiAgICAgICAgY29uc3QgdGltZSA9IGF1ZGlvLmN1cnJlbnRUaW1lICogMTAwMDtcbiAgICAgICAgc2V0Q3VycmVudFRpbWUodGltZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBpZiB3ZSBuZWVkIHRvIHN0YXJ0IHJlY29yZGluZyBmb3IgdXBjb21pbmcgbGluZXNcbiAgICAgICAgY2hlY2tGb3JVcGNvbWluZ0xpbmVzKHRpbWUpO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgYXVkaW9VcGRhdGVJbnRlcnZhbCA9IHNldEludGVydmFsKHVwZGF0ZVRpbWUsIDEwMCkgYXMgdW5rbm93biBhcyBudW1iZXI7XG4gICAgICBcbiAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgaGFuZGxlRW5kKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlU2Vzc2lvbl0gTm8gYXVkaW8gZWxlbWVudCBhdmFpbGFibGUgZm9yIHBsYXliYWNrJyk7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgY2hlY2tGb3JVcGNvbWluZ0xpbmVzID0gKGN1cnJlbnRUaW1lTXM6IG51bWJlcikgPT4ge1xuICAgIGlmIChpc1JlY29yZGluZygpIHx8ICFvcHRpb25zLmx5cmljcy5sZW5ndGgpIHJldHVybjtcbiAgICBcbiAgICBjb25zdCByZWNvcmRlZCA9IHJlY29yZGVkQ2h1bmtzKCk7XG4gICAgXG4gICAgLy8gTG9vayBmb3IgY2h1bmtzIHRoYXQgc2hvdWxkIHN0YXJ0IHJlY29yZGluZyBzb29uXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmx5cmljcy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gU2tpcCBpZiB3ZSd2ZSBhbHJlYWR5IHJlY29yZGVkIGEgY2h1bmsgc3RhcnRpbmcgYXQgdGhpcyBpbmRleFxuICAgICAgaWYgKHJlY29yZGVkLmhhcyhpKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgY2h1bmsgPSBzaG91bGRDaHVua0xpbmVzKG9wdGlvbnMubHlyaWNzLCBpKTtcbiAgICAgIGNvbnN0IGZpcnN0TGluZSA9IG9wdGlvbnMubHlyaWNzW2NodW5rLnN0YXJ0SW5kZXhdO1xuICAgICAgXG4gICAgICBpZiAoZmlyc3RMaW5lICYmIGZpcnN0TGluZS5zdGFydFRpbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCByZWNvcmRpbmdTdGFydFRpbWUgPSBmaXJzdExpbmUuc3RhcnRUaW1lICogMTAwMCAtIDEwMDA7IC8vIFN0YXJ0IDFzIGVhcmx5XG4gICAgICAgIGNvbnN0IGxpbmVTdGFydFRpbWUgPSBmaXJzdExpbmUuc3RhcnRUaW1lICogMTAwMDtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIHdlJ3JlIGluIHRoZSByZWNvcmRpbmcgd2luZG93IGFuZCBoYXZlbid0IHBhc3NlZCB0aGUgbGluZSBzdGFydFxuICAgICAgICBpZiAoY3VycmVudFRpbWVNcyA+PSByZWNvcmRpbmdTdGFydFRpbWUgJiYgY3VycmVudFRpbWVNcyA8IGxpbmVTdGFydFRpbWUgKyA1MDApIHsgLy8gQWxsb3cgNTAwbXMgYnVmZmVyIGFmdGVyIGxpbmUgc3RhcnRcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0thcmFva2VTZXNzaW9uXSBUaW1lIHRvIHN0YXJ0IHJlY29yZGluZyBjaHVuayAke2NodW5rLnN0YXJ0SW5kZXh9LSR7Y2h1bmsuZW5kSW5kZXh9OiAke2N1cnJlbnRUaW1lTXN9bXMgaXMgYmV0d2VlbiAke3JlY29yZGluZ1N0YXJ0VGltZX1tcyBhbmQgJHtsaW5lU3RhcnRUaW1lICsgNTAwfW1zYCk7XG4gICAgICAgICAgLy8gTWFyayB0aGlzIGNodW5rIGFzIHJlY29yZGVkXG4gICAgICAgICAgc2V0UmVjb3JkZWRDaHVua3MocHJldiA9PiBuZXcgU2V0KHByZXYpLmFkZChjaHVuay5zdGFydEluZGV4KSk7XG4gICAgICAgICAgLy8gU3RhcnQgcmVjb3JkaW5nIHRoaXMgY2h1bmtcbiAgICAgICAgICBzdGFydFJlY29yZGluZ0NodW5rKGNodW5rKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBTa2lwIGFoZWFkIHRvIGF2b2lkIGNoZWNraW5nIGxpbmVzIHdlJ3ZlIGFscmVhZHkgcGFzc2VkXG4gICAgICBpID0gY2h1bmsuZW5kSW5kZXg7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3Qgc3RhcnRSZWNvcmRpbmdDaHVuayA9IGFzeW5jIChjaHVuazogQ2h1bmtJbmZvKSA9PiB7XG4gICAgY29uc29sZS5sb2coYFtLYXJhb2tlU2Vzc2lvbl0gU3RhcnRpbmcgcmVjb3JkaW5nIGZvciBjaHVuayAke2NodW5rLnN0YXJ0SW5kZXh9LSR7Y2h1bmsuZW5kSW5kZXh9YCk7XG4gICAgXG4gICAgLy8gVEVTVElORyBNT0RFOiBBdXRvLWNvbXBsZXRlIGFmdGVyIDUgbGluZXNcbiAgICBpZiAoY2h1bmsuc3RhcnRJbmRleCA+PSA1KSB7XG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBURVNUIE1PREU6IFN0b3BwaW5nIGFmdGVyIDUgbGluZXMnKTtcbiAgICAgIGhhbmRsZUVuZCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICBzZXRDdXJyZW50Q2h1bmsoY2h1bmspO1xuICAgIHNldElzUmVjb3JkaW5nKHRydWUpO1xuICAgIFxuICAgIC8vIFN0YXJ0IGF1ZGlvIGNhcHR1cmUgZm9yIHRoaXMgY2h1bmtcbiAgICBhdWRpb1Byb2Nlc3Nvci5zdGFydFJlY29yZGluZ0xpbmUoY2h1bmsuc3RhcnRJbmRleCk7XG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlIHJlY29yZGluZyBkdXJhdGlvblxuICAgIGNvbnN0IGR1cmF0aW9uID0gY2FsY3VsYXRlUmVjb3JkaW5nRHVyYXRpb24ob3B0aW9ucy5seXJpY3MsIGNodW5rKTtcbiAgICBjb25zb2xlLmxvZyhgW0thcmFva2VTZXNzaW9uXSBSZWNvcmRpbmcgZHVyYXRpb24gZm9yIGNodW5rICR7Y2h1bmsuc3RhcnRJbmRleH0tJHtjaHVuay5lbmRJbmRleH06ICR7ZHVyYXRpb259bXNgKTtcbiAgICBcbiAgICAvLyBTdG9wIHJlY29yZGluZyBhZnRlciBkdXJhdGlvblxuICAgIHJlY29yZGluZ1RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHN0b3BSZWNvcmRpbmdDaHVuaygpO1xuICAgIH0sIGR1cmF0aW9uKSBhcyB1bmtub3duIGFzIG51bWJlcjtcbiAgfTtcbiAgXG4gIGNvbnN0IHN0b3BSZWNvcmRpbmdDaHVuayA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBjaHVuayA9IGN1cnJlbnRDaHVuaygpO1xuICAgIGlmICghY2h1bmspIHJldHVybjtcbiAgICBcbiAgICBjb25zb2xlLmxvZyhgW0thcmFva2VTZXNzaW9uXSBTdG9wcGluZyByZWNvcmRpbmcgZm9yIGNodW5rICR7Y2h1bmsuc3RhcnRJbmRleH0tJHtjaHVuay5lbmRJbmRleH1gKTtcbiAgICBzZXRJc1JlY29yZGluZyhmYWxzZSk7XG4gICAgXG4gICAgLy8gR2V0IHRoZSByZWNvcmRlZCBhdWRpb1xuICAgIGNvbnN0IGF1ZGlvQ2h1bmtzID0gYXVkaW9Qcm9jZXNzb3Iuc3RvcFJlY29yZGluZ0xpbmVBbmRHZXRSYXdBdWRpbygpO1xuICAgIGNvbnN0IHdhdkJsb2IgPSBhdWRpb1Byb2Nlc3Nvci5jb252ZXJ0QXVkaW9Ub1dhdkJsb2IoYXVkaW9DaHVua3MpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbS2FyYW9rZVNlc3Npb25dIEF1ZGlvIGJsb2IgY3JlYXRlZDpgLCB7XG4gICAgICBoYXNCbG9iOiAhIXdhdkJsb2IsXG4gICAgICBibG9iU2l6ZTogd2F2QmxvYj8uc2l6ZSxcbiAgICAgIGNodW5rc0xlbmd0aDogYXVkaW9DaHVua3MubGVuZ3RoLFxuICAgICAgaGFzU2Vzc2lvbklkOiAhIXNlc3Npb25JZCgpLFxuICAgICAgc2Vzc2lvbklkOiBzZXNzaW9uSWQoKVxuICAgIH0pO1xuICAgIFxuICAgIC8vIENoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGF1ZGlvIGRhdGFcbiAgICBpZiAod2F2QmxvYiAmJiB3YXZCbG9iLnNpemUgPiAxMDAwICYmIHNlc3Npb25JZCgpKSB7IC8vIE1pbmltdW0gMUtCIG9mIGF1ZGlvIGRhdGFcbiAgICAgIC8vIENvbnZlcnQgdG8gYmFzZTY0IGZvciBBUElcbiAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkZW5kID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBiYXNlNjRBdWRpbyA9IHJlYWRlci5yZXN1bHQ/LnRvU3RyaW5nKCkuc3BsaXQoJywnKVsxXTtcbiAgICAgICAgaWYgKGJhc2U2NEF1ZGlvICYmIGJhc2U2NEF1ZGlvLmxlbmd0aCA+IDEwMCkgeyAvLyBFbnN1cmUgd2UgaGF2ZSBtZWFuaW5nZnVsIGJhc2U2NCBkYXRhXG4gICAgICAgICAgYXdhaXQgZ3JhZGVDaHVuayhjaHVuaywgYmFzZTY0QXVkaW8pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUud2FybignW0thcmFva2VTZXNzaW9uXSBCYXNlNjQgYXVkaW8gdG9vIHNob3J0LCBza2lwcGluZyBncmFkZScpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwod2F2QmxvYik7XG4gICAgfSBlbHNlIGlmICh3YXZCbG9iICYmIHdhdkJsb2Iuc2l6ZSA8PSAxMDAwKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ1tLYXJhb2tlU2Vzc2lvbl0gQXVkaW8gYmxvYiB0b28gc21hbGwsIHNraXBwaW5nIGdyYWRlOicsIHdhdkJsb2Iuc2l6ZSwgJ2J5dGVzJyk7XG4gICAgICAvLyBBZGQgYSBuZXV0cmFsIHNjb3JlIGZvciBVSSBmZWVkYmFja1xuICAgICAgc2V0TGluZVNjb3JlcyhwcmV2ID0+IFsuLi5wcmV2LCB7XG4gICAgICAgIGxpbmVJbmRleDogY2h1bmsuc3RhcnRJbmRleCxcbiAgICAgICAgc2NvcmU6IDUwLFxuICAgICAgICB0cmFuc2NyaXB0aW9uOiAnJyxcbiAgICAgICAgZmVlZGJhY2s6ICdSZWNvcmRpbmcgdG9vIHNob3J0J1xuICAgICAgfV0pO1xuICAgIH0gZWxzZSBpZiAod2F2QmxvYiAmJiAhc2Vzc2lvbklkKCkpIHtcbiAgICAgIGNvbnNvbGUud2FybignW0thcmFva2VTZXNzaW9uXSBIYXZlIGF1ZGlvIGJ1dCBubyBzZXNzaW9uIElEIC0gY2Fubm90IGdyYWRlJyk7XG4gICAgfVxuICAgIFxuICAgIHNldEN1cnJlbnRDaHVuayhudWxsKTtcbiAgICBcbiAgICBpZiAocmVjb3JkaW5nVGltZW91dCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHJlY29yZGluZ1RpbWVvdXQpO1xuICAgICAgcmVjb3JkaW5nVGltZW91dCA9IG51bGw7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgZ3JhZGVDaHVuayA9IGFzeW5jIChjaHVuazogQ2h1bmtJbmZvLCBhdWRpb0Jhc2U2NDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY3VycmVudFNlc3Npb25JZCA9IHNlc3Npb25JZCgpO1xuICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIEdyYWRpbmcgY2h1bms6Jywge1xuICAgICAgaGFzU2Vzc2lvbklkOiAhIWN1cnJlbnRTZXNzaW9uSWQsXG4gICAgICBzZXNzaW9uSWQ6IGN1cnJlbnRTZXNzaW9uSWQsXG4gICAgICBjaHVua0luZGV4OiBjaHVuay5zdGFydEluZGV4LFxuICAgICAgYXVkaW9MZW5ndGg6IGF1ZGlvQmFzZTY0Lmxlbmd0aFxuICAgIH0pO1xuICAgIFxuICAgIGlmICghY3VycmVudFNlc3Npb25JZCkge1xuICAgICAgY29uc29sZS53YXJuKCdbS2FyYW9rZVNlc3Npb25dIE5vIHNlc3Npb24gSUQsIHNraXBwaW5nIGdyYWRlJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBTZW5kaW5nIGdyYWRlIHJlcXVlc3QuLi4nKTtcbiAgICAgIGNvbnN0IGxpbmVTY29yZSA9IGF3YWl0IGthcmFva2VBcGkuZ3JhZGVSZWNvcmRpbmcoXG4gICAgICAgIGN1cnJlbnRTZXNzaW9uSWQsXG4gICAgICAgIGNodW5rLnN0YXJ0SW5kZXgsXG4gICAgICAgIGF1ZGlvQmFzZTY0LFxuICAgICAgICBjaHVuay5leHBlY3RlZFRleHQsXG4gICAgICAgIG9wdGlvbnMubHlyaWNzW2NodW5rLnN0YXJ0SW5kZXhdPy5zdGFydFRpbWUgfHwgMCxcbiAgICAgICAgKG9wdGlvbnMubHlyaWNzW2NodW5rLmVuZEluZGV4XT8uc3RhcnRUaW1lIHx8IDApICsgKG9wdGlvbnMubHlyaWNzW2NodW5rLmVuZEluZGV4XT8uZHVyYXRpb24gfHwgMCkgLyAxMDAwXG4gICAgICApO1xuICAgICAgXG4gICAgICBpZiAobGluZVNjb3JlKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbS2FyYW9rZVNlc3Npb25dIENodW5rIGdyYWRlZDpgLCBsaW5lU2NvcmUpO1xuICAgICAgICBcbiAgICAgICAgLy8gVXBkYXRlIGxpbmUgc2NvcmVzXG4gICAgICAgIGNvbnN0IG5ld0xpbmVTY29yZSA9IHtcbiAgICAgICAgICBsaW5lSW5kZXg6IGNodW5rLnN0YXJ0SW5kZXgsXG4gICAgICAgICAgc2NvcmU6IGxpbmVTY29yZS5zY29yZSxcbiAgICAgICAgICB0cmFuc2NyaXB0aW9uOiBsaW5lU2NvcmUudHJhbnNjcmlwdCB8fCAnJyxcbiAgICAgICAgICBmZWVkYmFjazogbGluZVNjb3JlLmZlZWRiYWNrXG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBzZXRMaW5lU2NvcmVzKHByZXYgPT4gWy4uLnByZXYsIG5ld0xpbmVTY29yZV0pO1xuICAgICAgICBcbiAgICAgICAgLy8gVXBkYXRlIHRvdGFsIHNjb3JlIChzaW1wbGUgYXZlcmFnZSBmb3Igbm93KSAtIHVzZSBwcmV2IHRvIGF2b2lkIGRlcGVuZGVuY3lcbiAgICAgICAgc2V0U2NvcmUocHJldiA9PiB7XG4gICAgICAgICAgY29uc3QgYWxsU2NvcmVzID0gWy4uLmxpbmVTY29yZXMoKSwgbmV3TGluZVNjb3JlXTtcbiAgICAgICAgICBjb25zdCBhdmdTY29yZSA9IGFsbFNjb3Jlcy5yZWR1Y2UoKHN1bSwgcykgPT4gc3VtICsgcy5zY29yZSwgMCkgLyBhbGxTY29yZXMubGVuZ3RoO1xuICAgICAgICAgIHJldHVybiBNYXRoLnJvdW5kKGF2Z1Njb3JlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICAvLyBSZW1vdmVkIHRlc3QgbW9kZSBsaW1pdFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBncmFkZSBjaHVua2ApO1xuICAgICAgICBcbiAgICAgICAgLy8gQWRkIGEgbmV1dHJhbCBzY29yZSBmb3IgVUkgZmVlZGJhY2tcbiAgICAgICAgc2V0TGluZVNjb3JlcyhwcmV2ID0+IFsuLi5wcmV2LCB7XG4gICAgICAgICAgbGluZUluZGV4OiBjaHVuay5zdGFydEluZGV4LFxuICAgICAgICAgIHNjb3JlOiA1MCwgLy8gTmV1dHJhbCBzY29yZVxuICAgICAgICAgIHRyYW5zY3JpcHRpb246ICcnLFxuICAgICAgICAgIGZlZWRiYWNrOiAnRmFpbGVkIHRvIGdyYWRlIHJlY29yZGluZydcbiAgICAgICAgfV0pO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBncmFkZSBjaHVuazonLCBlcnJvcik7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUVuZCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBIYW5kbGluZyBzZXNzaW9uIGVuZCcpO1xuICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgaWYgKGF1ZGlvVXBkYXRlSW50ZXJ2YWwpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwoYXVkaW9VcGRhdGVJbnRlcnZhbCk7XG4gICAgfVxuICAgIFxuICAgIC8vIFBhdXNlIHRoZSBhdWRpb1xuICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9FbGVtZW50KCkgfHwgb3B0aW9ucy5hdWRpb0VsZW1lbnQ7XG4gICAgaWYgKGF1ZGlvICYmICFhdWRpby5wYXVzZWQpIHtcbiAgICAgIGF1ZGlvLnBhdXNlKCk7XG4gICAgfVxuICAgIFxuICAgIC8vIFN0b3AgYW55IG9uZ29pbmcgcmVjb3JkaW5nXG4gICAgaWYgKGlzUmVjb3JkaW5nKCkpIHtcbiAgICAgIGF3YWl0IHN0b3BSZWNvcmRpbmdDaHVuaygpO1xuICAgIH1cbiAgICBcbiAgICAvLyBTaG93IGxvYWRpbmcgc3RhdGUgaW1tZWRpYXRlbHlcbiAgICBjb25zdCBsb2FkaW5nUmVzdWx0czogS2FyYW9rZVJlc3VsdHMgPSB7XG4gICAgICBzY29yZTogLTEsIC8vIFNwZWNpYWwgdmFsdWUgdG8gaW5kaWNhdGUgbG9hZGluZ1xuICAgICAgYWNjdXJhY3k6IDAsXG4gICAgICB0b3RhbExpbmVzOiBsaW5lU2NvcmVzKCkubGVuZ3RoLFxuICAgICAgcGVyZmVjdExpbmVzOiAwLFxuICAgICAgZ29vZExpbmVzOiAwLFxuICAgICAgbmVlZHNXb3JrTGluZXM6IDAsXG4gICAgICBzZXNzaW9uSWQ6IHNlc3Npb25JZCgpIHx8IHVuZGVmaW5lZCxcbiAgICAgIGlzTG9hZGluZzogdHJ1ZVxuICAgIH07XG4gICAgb3B0aW9ucy5vbkNvbXBsZXRlPy4obG9hZGluZ1Jlc3VsdHMpO1xuICAgIFxuICAgIC8vIEdldCBmdWxsIHNlc3Npb24gYXVkaW9cbiAgICBjb25zdCBmdWxsQXVkaW9CbG9iID0gYXVkaW9Qcm9jZXNzb3Iuc3RvcEZ1bGxTZXNzaW9uQW5kR2V0V2F2KCk7XG4gICAgY29uc29sZS5sb2coJ1tLYXJhb2tlU2Vzc2lvbl0gRnVsbCBzZXNzaW9uIGF1ZGlvIGJsb2I6Jywge1xuICAgICAgaGFzQmxvYjogISFmdWxsQXVkaW9CbG9iLFxuICAgICAgYmxvYlNpemU6IGZ1bGxBdWRpb0Jsb2I/LnNpemVcbiAgICB9KTtcbiAgICBcbiAgICAvLyBDb21wbGV0ZSBzZXNzaW9uIG9uIHNlcnZlclxuICAgIGNvbnN0IGN1cnJlbnRTZXNzaW9uSWQgPSBzZXNzaW9uSWQoKTtcbiAgICBpZiAoY3VycmVudFNlc3Npb25JZCAmJiBmdWxsQXVkaW9CbG9iICYmIGZ1bGxBdWRpb0Jsb2Iuc2l6ZSA+IDEwMDApIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIENvbnZlcnRpbmcgZnVsbCBhdWRpbyB0byBiYXNlNjQuLi4nKTtcbiAgICAgICAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgICAgcmVhZGVyLm9ubG9hZGVuZCA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zdCBiYXNlNjRBdWRpbyA9IHJlYWRlci5yZXN1bHQ/LnRvU3RyaW5nKCkuc3BsaXQoJywnKVsxXTtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBTZW5kaW5nIGNvbXBsZXRpb24gcmVxdWVzdCB3aXRoIGZ1bGwgYXVkaW8nKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBzZXNzaW9uUmVzdWx0cyA9IGF3YWl0IGthcmFva2VBcGkuY29tcGxldGVTZXNzaW9uKFxuICAgICAgICAgICAgY3VycmVudFNlc3Npb25JZCxcbiAgICAgICAgICAgIGJhc2U2NEF1ZGlvXG4gICAgICAgICAgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoc2Vzc2lvblJlc3VsdHMpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIFNlc3Npb24gY29tcGxldGVkOicsIHNlc3Npb25SZXN1bHRzKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgcmVzdWx0czogS2FyYW9rZVJlc3VsdHMgPSB7XG4gICAgICAgICAgICAgIHNjb3JlOiBzZXNzaW9uUmVzdWx0cy5maW5hbFNjb3JlLFxuICAgICAgICAgICAgICBhY2N1cmFjeTogc2Vzc2lvblJlc3VsdHMuYWNjdXJhY3ksXG4gICAgICAgICAgICAgIHRvdGFsTGluZXM6IHNlc3Npb25SZXN1bHRzLnRvdGFsTGluZXMsXG4gICAgICAgICAgICAgIHBlcmZlY3RMaW5lczogc2Vzc2lvblJlc3VsdHMucGVyZmVjdExpbmVzLFxuICAgICAgICAgICAgICBnb29kTGluZXM6IHNlc3Npb25SZXN1bHRzLmdvb2RMaW5lcyxcbiAgICAgICAgICAgICAgbmVlZHNXb3JrTGluZXM6IHNlc3Npb25SZXN1bHRzLm5lZWRzV29ya0xpbmVzLFxuICAgICAgICAgICAgICBzZXNzaW9uSWQ6IGN1cnJlbnRTZXNzaW9uSWRcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIG9wdGlvbnMub25Db21wbGV0ZT8uKHJlc3VsdHMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBObyBzZXNzaW9uIHJlc3VsdHMsIGNhbGN1bGF0aW5nIGxvY2FsbHknKTtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIGxvY2FsIGNhbGN1bGF0aW9uXG4gICAgICAgICAgICBjYWxjdWxhdGVMb2NhbFJlc3VsdHMoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKGZ1bGxBdWRpb0Jsb2IpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VTZXNzaW9uXSBGYWlsZWQgdG8gY29tcGxldGUgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICAgIGNhbGN1bGF0ZUxvY2FsUmVzdWx0cygpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBObyBzZXNzaW9uL2F1ZGlvLCByZXR1cm5pbmcgbG9jYWwgcmVzdWx0cycpO1xuICAgICAgLy8gTm8gc2Vzc2lvbiwganVzdCByZXR1cm4gbG9jYWwgcmVzdWx0c1xuICAgICAgY2FsY3VsYXRlTG9jYWxSZXN1bHRzKCk7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgY2FsY3VsYXRlTG9jYWxSZXN1bHRzID0gKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIENhbGN1bGF0aW5nIGxvY2FsIHJlc3VsdHMnKTtcbiAgICBjb25zdCBzY29yZXMgPSBsaW5lU2NvcmVzKCk7XG4gICAgY29uc3QgYXZnU2NvcmUgPSBzY29yZXMubGVuZ3RoID4gMCBcbiAgICAgID8gc2NvcmVzLnJlZHVjZSgoc3VtLCBzKSA9PiBzdW0gKyBzLnNjb3JlLCAwKSAvIHNjb3Jlcy5sZW5ndGhcbiAgICAgIDogMDtcbiAgICBcbiAgICBjb25zdCByZXN1bHRzOiBLYXJhb2tlUmVzdWx0cyA9IHtcbiAgICAgIHNjb3JlOiBNYXRoLnJvdW5kKGF2Z1Njb3JlKSxcbiAgICAgIGFjY3VyYWN5OiBNYXRoLnJvdW5kKGF2Z1Njb3JlKSxcbiAgICAgIHRvdGFsTGluZXM6IHNjb3Jlcy5sZW5ndGgsIC8vIFVzZSBhY3R1YWwgY29tcGxldGVkIGxpbmVzIGZvciB0ZXN0IG1vZGVcbiAgICAgIHBlcmZlY3RMaW5lczogc2NvcmVzLmZpbHRlcihzID0+IHMuc2NvcmUgPj0gOTApLmxlbmd0aCxcbiAgICAgIGdvb2RMaW5lczogc2NvcmVzLmZpbHRlcihzID0+IHMuc2NvcmUgPj0gNzAgJiYgcy5zY29yZSA8IDkwKS5sZW5ndGgsXG4gICAgICBuZWVkc1dvcmtMaW5lczogc2NvcmVzLmZpbHRlcihzID0+IHMuc2NvcmUgPCA3MCkubGVuZ3RoLFxuICAgICAgc2Vzc2lvbklkOiBzZXNzaW9uSWQoKSB8fCB1bmRlZmluZWRcbiAgICB9O1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIExvY2FsIHJlc3VsdHMgY2FsY3VsYXRlZDonLCByZXN1bHRzKTtcbiAgICBvcHRpb25zLm9uQ29tcGxldGU/LihyZXN1bHRzKTtcbiAgfTtcblxuICBjb25zdCBzdG9wU2Vzc2lvbiA9ICgpID0+IHtcbiAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgIHNldENvdW50ZG93bihudWxsKTtcbiAgICBzZXRJc1JlY29yZGluZyhmYWxzZSk7XG4gICAgc2V0Q3VycmVudENodW5rKG51bGwpO1xuICAgIHNldFJlY29yZGVkQ2h1bmtzKG5ldyBTZXQ8bnVtYmVyPigpKTtcbiAgICBcbiAgICBpZiAoYXVkaW9VcGRhdGVJbnRlcnZhbCkge1xuICAgICAgY2xlYXJJbnRlcnZhbChhdWRpb1VwZGF0ZUludGVydmFsKTtcbiAgICAgIGF1ZGlvVXBkYXRlSW50ZXJ2YWwgPSBudWxsO1xuICAgIH1cbiAgICBcbiAgICBpZiAocmVjb3JkaW5nVGltZW91dCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHJlY29yZGluZ1RpbWVvdXQpO1xuICAgICAgcmVjb3JkaW5nVGltZW91dCA9IG51bGw7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9FbGVtZW50KCkgfHwgb3B0aW9ucy5hdWRpb0VsZW1lbnQ7XG4gICAgaWYgKGF1ZGlvKSB7XG4gICAgICBhdWRpby5wYXVzZSgpO1xuICAgICAgYXVkaW8uY3VycmVudFRpbWUgPSAwO1xuICAgICAgYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZW5kZWQnLCBoYW5kbGVFbmQpO1xuICAgIH1cbiAgICBcbiAgICAvLyBDbGVhbnVwIGF1ZGlvIHByb2Nlc3NvclxuICAgIGF1ZGlvUHJvY2Vzc29yLmNsZWFudXAoKTtcbiAgfTtcblxuICBvbkNsZWFudXAoKCkgPT4ge1xuICAgIHN0b3BTZXNzaW9uKCk7XG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgLy8gU3RhdGVcbiAgICBpc1BsYXlpbmcsXG4gICAgY3VycmVudFRpbWUsXG4gICAgc2NvcmUsXG4gICAgY291bnRkb3duLFxuICAgIHNlc3Npb25JZCxcbiAgICBsaW5lU2NvcmVzLFxuICAgIGlzUmVjb3JkaW5nLFxuICAgIGN1cnJlbnRDaHVuayxcbiAgICBcbiAgICAvLyBBY3Rpb25zXG4gICAgc3RhcnRTZXNzaW9uLFxuICAgIHN0b3BTZXNzaW9uLFxuICAgIFxuICAgIC8vIEF1ZGlvIHByb2Nlc3NvciAoZm9yIGRpcmVjdCBhY2Nlc3MgaWYgbmVlZGVkKVxuICAgIGF1ZGlvUHJvY2Vzc29yLFxuICAgIFxuICAgIC8vIE1ldGhvZCB0byB1cGRhdGUgYXVkaW8gZWxlbWVudCBhZnRlciBpbml0aWFsaXphdGlvblxuICAgIHNldEF1ZGlvRWxlbWVudFxuICB9O1xufSIsImV4cG9ydCBpbnRlcmZhY2UgVHJhY2tJbmZvIHtcbiAgdHJhY2tJZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBhcnRpc3Q6IHN0cmluZztcbiAgcGxhdGZvcm06ICdzb3VuZGNsb3VkJztcbiAgdXJsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFja0RldGVjdG9yIHtcbiAgLyoqXG4gICAqIERldGVjdCBjdXJyZW50IHRyYWNrIGZyb20gdGhlIHBhZ2UgKFNvdW5kQ2xvdWQgb25seSlcbiAgICovXG4gIGRldGVjdEN1cnJlbnRUcmFjaygpOiBUcmFja0luZm8gfCBudWxsIHtcbiAgICBjb25zdCB1cmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICBcbiAgICAvLyBPbmx5IHdvcmsgb24gc2MubWFpZC56b25lIChTb3VuZENsb3VkIHByb3h5KVxuICAgIGlmICh1cmwuaW5jbHVkZXMoJ3NjLm1haWQuem9uZScpKSB7XG4gICAgICByZXR1cm4gdGhpcy5kZXRlY3RTb3VuZENsb3VkVHJhY2soKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IHRyYWNrIGluZm8gZnJvbSBTb3VuZENsb3VkIChzYy5tYWlkLnpvbmUpXG4gICAqL1xuICBwcml2YXRlIGRldGVjdFNvdW5kQ2xvdWRUcmFjaygpOiBUcmFja0luZm8gfCBudWxsIHtcbiAgICB0cnkge1xuICAgICAgLy8gU291bmRDbG91ZCBVUkxzOiBzYy5tYWlkLnpvbmUvdXNlci90cmFjay1uYW1lXG4gICAgICBjb25zdCBwYXRoUGFydHMgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBpZiAocGF0aFBhcnRzLmxlbmd0aCA8IDIpIHJldHVybiBudWxsO1xuXG4gICAgICBjb25zdCBhcnRpc3RQYXRoID0gcGF0aFBhcnRzWzBdO1xuICAgICAgY29uc3QgdHJhY2tTbHVnID0gcGF0aFBhcnRzWzFdO1xuICAgICAgXG4gICAgICAvLyBUcnkgdG8gZ2V0IGFjdHVhbCB0aXRsZSBmcm9tIHBhZ2VcbiAgICAgIGxldCB0aXRsZSA9ICcnO1xuICAgICAgXG4gICAgICAvLyBGb3Igc291bmRjbG9haywgbG9vayBmb3IgaDEgYWZ0ZXIgdGhlIGltYWdlXG4gICAgICBjb25zdCBoMUVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnaDEnKTtcbiAgICAgIGZvciAoY29uc3QgaDEgb2YgaDFFbGVtZW50cykge1xuICAgICAgICAvLyBTa2lwIHRoZSBcInNvdW5kY2xvYWtcIiBoZWFkZXJcbiAgICAgICAgaWYgKGgxLnRleHRDb250ZW50Py50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzb3VuZGNsb2FrJykpIGNvbnRpbnVlO1xuICAgICAgICB0aXRsZSA9IGgxLnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgIGlmICh0aXRsZSkgYnJlYWs7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEZhbGxiYWNrIHRvIHNsdWdcbiAgICAgIGlmICghdGl0bGUpIHtcbiAgICAgICAgdGl0bGUgPSB0cmFja1NsdWcucmVwbGFjZSgvLS9nLCAnICcpO1xuICAgICAgfVxuXG4gICAgICAvLyBUcnkgdG8gZ2V0IGFjdHVhbCBhcnRpc3QgbmFtZSBmcm9tIHBhZ2VcbiAgICAgIGxldCBhcnRpc3QgPSAnJztcbiAgICAgIFxuICAgICAgLy8gTG9vayBmb3IgYXJ0aXN0IGxpbmsgd2l0aCBtZXRhIGNsYXNzXG4gICAgICBjb25zdCBhcnRpc3RMaW5rID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYS5saXN0aW5nIC5tZXRhIGgzJyk7XG4gICAgICBpZiAoYXJ0aXN0TGluayAmJiBhcnRpc3RMaW5rLnRleHRDb250ZW50KSB7XG4gICAgICAgIGFydGlzdCA9IGFydGlzdExpbmsudGV4dENvbnRlbnQudHJpbSgpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBGYWxsYmFjazogdHJ5IHBhZ2UgdGl0bGVcbiAgICAgIGlmICghYXJ0aXN0KSB7XG4gICAgICAgIGNvbnN0IHBhZ2VUaXRsZSA9IGRvY3VtZW50LnRpdGxlO1xuICAgICAgICAvLyBUaXRsZSBmb3JtYXQ6IFwiU29uZyBieSBBcnRpc3QgfiBzb3VuZGNsb2FrXCJcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBwYWdlVGl0bGUubWF0Y2goL2J5XFxzKyguKz8pXFxzKn4vKTtcbiAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgYXJ0aXN0ID0gbWF0Y2hbMV0udHJpbSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEZpbmFsIGZhbGxiYWNrIHRvIFVSTFxuICAgICAgaWYgKCFhcnRpc3QpIHtcbiAgICAgICAgYXJ0aXN0ID0gYXJ0aXN0UGF0aC5yZXBsYWNlKC8tL2csICcgJykucmVwbGFjZSgvXy9nLCAnICcpO1xuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZygnW1RyYWNrRGV0ZWN0b3JdIERldGVjdGVkIHRyYWNrOicsIHsgdGl0bGUsIGFydGlzdCwgYXJ0aXN0UGF0aCwgdHJhY2tTbHVnIH0pO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0cmFja0lkOiBgJHthcnRpc3RQYXRofS8ke3RyYWNrU2x1Z31gLFxuICAgICAgICB0aXRsZTogdGl0bGUsXG4gICAgICAgIGFydGlzdDogYXJ0aXN0LFxuICAgICAgICBwbGF0Zm9ybTogJ3NvdW5kY2xvdWQnLFxuICAgICAgICB1cmw6IHdpbmRvdy5sb2NhdGlvbi5ocmVmLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW1RyYWNrRGV0ZWN0b3JdIEVycm9yIGRldGVjdGluZyBTb3VuZENsb3VkIHRyYWNrOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG5cbiAgLyoqXG4gICAqIFdhdGNoIGZvciBwYWdlIGNoYW5nZXMgKFNvdW5kQ2xvdWQgaXMgYSBTUEEpXG4gICAqL1xuICB3YXRjaEZvckNoYW5nZXMoY2FsbGJhY2s6ICh0cmFjazogVHJhY2tJbmZvIHwgbnVsbCkgPT4gdm9pZCk6ICgpID0+IHZvaWQge1xuICAgIGxldCBjdXJyZW50VXJsID0gd2luZG93LmxvY2F0aW9uLmhyZWY7XG4gICAgbGV0IGN1cnJlbnRUcmFjayA9IHRoaXMuZGV0ZWN0Q3VycmVudFRyYWNrKCk7XG4gICAgXG4gICAgLy8gSW5pdGlhbCBkZXRlY3Rpb25cbiAgICBjYWxsYmFjayhjdXJyZW50VHJhY2spO1xuXG4gICAgLy8gV2F0Y2ggZm9yIFVSTCBjaGFuZ2VzXG4gICAgY29uc3QgY2hlY2tGb3JDaGFuZ2VzID0gKCkgPT4ge1xuICAgICAgY29uc3QgbmV3VXJsID0gd2luZG93LmxvY2F0aW9uLmhyZWY7XG4gICAgICBpZiAobmV3VXJsICE9PSBjdXJyZW50VXJsKSB7XG4gICAgICAgIGN1cnJlbnRVcmwgPSBuZXdVcmw7XG4gICAgICAgIGNvbnN0IG5ld1RyYWNrID0gdGhpcy5kZXRlY3RDdXJyZW50VHJhY2soKTtcbiAgICAgICAgXG4gICAgICAgIC8vIE9ubHkgdHJpZ2dlciBjYWxsYmFjayBpZiB0cmFjayBhY3R1YWxseSBjaGFuZ2VkXG4gICAgICAgIGNvbnN0IHRyYWNrQ2hhbmdlZCA9ICFjdXJyZW50VHJhY2sgfHwgIW5ld1RyYWNrIHx8IFxuICAgICAgICAgIGN1cnJlbnRUcmFjay50cmFja0lkICE9PSBuZXdUcmFjay50cmFja0lkO1xuICAgICAgICAgIFxuICAgICAgICBpZiAodHJhY2tDaGFuZ2VkKSB7XG4gICAgICAgICAgY3VycmVudFRyYWNrID0gbmV3VHJhY2s7XG4gICAgICAgICAgY2FsbGJhY2sobmV3VHJhY2spO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIFBvbGwgZm9yIGNoYW5nZXMgKFNQQXMgZG9uJ3QgYWx3YXlzIHRyaWdnZXIgcHJvcGVyIG5hdmlnYXRpb24gZXZlbnRzKVxuICAgIGNvbnN0IGludGVydmFsID0gc2V0SW50ZXJ2YWwoY2hlY2tGb3JDaGFuZ2VzLCAxMDAwKTtcblxuICAgIC8vIEFsc28gbGlzdGVuIGZvciBuYXZpZ2F0aW9uIGV2ZW50c1xuICAgIGNvbnN0IGhhbmRsZU5hdmlnYXRpb24gPSAoKSA9PiB7XG4gICAgICBzZXRUaW1lb3V0KGNoZWNrRm9yQ2hhbmdlcywgMTAwKTsgLy8gU21hbGwgZGVsYXkgZm9yIERPTSB1cGRhdGVzXG4gICAgfTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb3BzdGF0ZScsIGhhbmRsZU5hdmlnYXRpb24pO1xuICAgIFxuICAgIC8vIExpc3RlbiBmb3IgcHVzaHN0YXRlL3JlcGxhY2VzdGF0ZSAoU291bmRDbG91ZCB1c2VzIHRoZXNlKVxuICAgIGNvbnN0IG9yaWdpbmFsUHVzaFN0YXRlID0gaGlzdG9yeS5wdXNoU3RhdGU7XG4gICAgY29uc3Qgb3JpZ2luYWxSZXBsYWNlU3RhdGUgPSBoaXN0b3J5LnJlcGxhY2VTdGF0ZTtcbiAgICBcbiAgICBoaXN0b3J5LnB1c2hTdGF0ZSA9IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICAgIG9yaWdpbmFsUHVzaFN0YXRlLmFwcGx5KGhpc3RvcnksIGFyZ3MpO1xuICAgICAgaGFuZGxlTmF2aWdhdGlvbigpO1xuICAgIH07XG4gICAgXG4gICAgaGlzdG9yeS5yZXBsYWNlU3RhdGUgPSBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgICBvcmlnaW5hbFJlcGxhY2VTdGF0ZS5hcHBseShoaXN0b3J5LCBhcmdzKTtcbiAgICAgIGhhbmRsZU5hdmlnYXRpb24oKTtcbiAgICB9O1xuXG4gICAgLy8gUmV0dXJuIGNsZWFudXAgZnVuY3Rpb25cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCBoYW5kbGVOYXZpZ2F0aW9uKTtcbiAgICAgIGhpc3RvcnkucHVzaFN0YXRlID0gb3JpZ2luYWxQdXNoU3RhdGU7XG4gICAgICBoaXN0b3J5LnJlcGxhY2VTdGF0ZSA9IG9yaWdpbmFsUmVwbGFjZVN0YXRlO1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IHRyYWNrRGV0ZWN0b3IgPSBuZXcgVHJhY2tEZXRlY3RvcigpOyIsIi8vIFVzaW5nIGJyb3dzZXIuc3RvcmFnZSBBUEkgZGlyZWN0bHkgZm9yIHNpbXBsaWNpdHlcbmltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG5cbi8vIEhlbHBlciB0byBnZXQgYXV0aCB0b2tlblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEF1dGhUb2tlbigpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLmdldCgnYXV0aFRva2VuJyk7XG4gIHJldHVybiByZXN1bHQuYXV0aFRva2VuIHx8IG51bGw7XG59XG5cbi8vIEhlbHBlciB0byBzZXQgYXV0aCB0b2tlblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldEF1dGhUb2tlbih0b2tlbjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5zZXQoeyBhdXRoVG9rZW46IHRva2VuIH0pO1xufVxuXG4vLyBIZWxwZXIgdG8gZ2V0IGluc3RhbGxhdGlvbiBzdGF0ZVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEluc3RhbGxhdGlvblN0YXRlKCk6IFByb21pc2U8e1xuICBjb21wbGV0ZWQ6IGJvb2xlYW47XG4gIGp3dFZlcmlmaWVkOiBib29sZWFuO1xuICB0aW1lc3RhbXA/OiBudW1iZXI7XG59PiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5nZXQoJ2luc3RhbGxhdGlvblN0YXRlJyk7XG4gIHJldHVybiByZXN1bHQuaW5zdGFsbGF0aW9uU3RhdGUgfHwge1xuICAgIGNvbXBsZXRlZDogZmFsc2UsXG4gICAgand0VmVyaWZpZWQ6IGZhbHNlLFxuICB9O1xufVxuXG4vLyBIZWxwZXIgdG8gc2V0IGluc3RhbGxhdGlvbiBzdGF0ZVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldEluc3RhbGxhdGlvblN0YXRlKHN0YXRlOiB7XG4gIGNvbXBsZXRlZDogYm9vbGVhbjtcbiAgand0VmVyaWZpZWQ6IGJvb2xlYW47XG4gIHRpbWVzdGFtcD86IG51bWJlcjtcbn0pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnNldCh7IGluc3RhbGxhdGlvblN0YXRlOiBzdGF0ZSB9KTtcbn1cblxuLy8gSGVscGVyIHRvIGNoZWNrIGlmIHVzZXIgaXMgYXV0aGVudGljYXRlZFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGlzQXV0aGVudGljYXRlZCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgY29uc3QgdG9rZW4gPSBhd2FpdCBnZXRBdXRoVG9rZW4oKTtcbiAgcmV0dXJuICEhdG9rZW4gJiYgdG9rZW4uc3RhcnRzV2l0aCgnc2NhcmxldHRfJyk7XG59XG5cbi8vIEhlbHBlciB0byBjbGVhciBhdXRoIGRhdGFcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjbGVhckF1dGgoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5yZW1vdmUoWydhdXRoVG9rZW4nLCAnaW5zdGFsbGF0aW9uU3RhdGUnXSk7XG59IiwiZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlRGF0YSB7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIHRyYWNrX2lkPzogc3RyaW5nO1xuICB0cmFja0lkPzogc3RyaW5nO1xuICBoYXNfa2FyYW9rZT86IGJvb2xlYW47XG4gIGhhc0thcmFva2U/OiBib29sZWFuO1xuICBzb25nPzoge1xuICAgIGlkOiBzdHJpbmc7XG4gICAgdGl0bGU6IHN0cmluZztcbiAgICBhcnRpc3Q6IHN0cmluZztcbiAgICBhbGJ1bT86IHN0cmluZztcbiAgICBhcnR3b3JrVXJsPzogc3RyaW5nO1xuICAgIGR1cmF0aW9uPzogbnVtYmVyO1xuICAgIGRpZmZpY3VsdHk6ICdiZWdpbm5lcicgfCAnaW50ZXJtZWRpYXRlJyB8ICdhZHZhbmNlZCc7XG4gIH07XG4gIGx5cmljcz86IHtcbiAgICBzb3VyY2U6IHN0cmluZztcbiAgICB0eXBlOiAnc3luY2VkJztcbiAgICBsaW5lczogTHlyaWNMaW5lW107XG4gICAgdG90YWxMaW5lczogbnVtYmVyO1xuICB9O1xuICBtZXNzYWdlPzogc3RyaW5nO1xuICBlcnJvcj86IHN0cmluZztcbiAgYXBpX2Nvbm5lY3RlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTHlyaWNMaW5lIHtcbiAgaWQ6IHN0cmluZztcbiAgdGV4dDogc3RyaW5nO1xuICBzdGFydFRpbWU6IG51bWJlcjtcbiAgZHVyYXRpb246IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlU2Vzc2lvbiB7XG4gIGlkOiBzdHJpbmc7XG4gIHRyYWNrSWQ6IHN0cmluZztcbiAgc29uZ1RpdGxlOiBzdHJpbmc7XG4gIHNvbmdBcnRpc3Q6IHN0cmluZztcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGNyZWF0ZWRBdDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgS2FyYW9rZUFwaVNlcnZpY2Uge1xuICBwcml2YXRlIGJhc2VVcmw6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICAvLyBVc2UgdGhlIGxvY2FsIHNlcnZlciBlbmRwb2ludFxuICAgIHRoaXMuYmFzZVVybCA9ICdodHRwOi8vbG9jYWxob3N0Ojg3ODcvYXBpJztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQga2FyYW9rZSBkYXRhIGZvciBhIHRyYWNrIElEIChZb3VUdWJlL1NvdW5kQ2xvdWQpXG4gICAqL1xuICBhc3luYyBnZXRLYXJhb2tlRGF0YShcbiAgICB0cmFja0lkOiBzdHJpbmcsIFxuICAgIHRpdGxlPzogc3RyaW5nLCBcbiAgICBhcnRpc3Q/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxLYXJhb2tlRGF0YSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xuICAgICAgaWYgKHRpdGxlKSBwYXJhbXMuc2V0KCd0aXRsZScsIHRpdGxlKTtcbiAgICAgIGlmIChhcnRpc3QpIHBhcmFtcy5zZXQoJ2FydGlzdCcsIGFydGlzdCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0va2FyYW9rZS8ke2VuY29kZVVSSUNvbXBvbmVudCh0cmFja0lkKX0ke3BhcmFtcy50b1N0cmluZygpID8gJz8nICsgcGFyYW1zLnRvU3RyaW5nKCkgOiAnJ31gO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VBcGldIEZldGNoaW5nIGthcmFva2UgZGF0YTonLCB1cmwpO1xuICAgICAgXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAvLyBSZW1vdmUgQ29udGVudC1UeXBlIGhlYWRlciB0byBhdm9pZCBDT1JTIHByZWZsaWdodFxuICAgICAgICAvLyBoZWFkZXJzOiB7XG4gICAgICAgIC8vICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgLy8gfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZmV0Y2gga2FyYW9rZSBkYXRhOicsIHJlc3BvbnNlLnN0YXR1cyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXBpXSBSZWNlaXZlZCBrYXJhb2tlIGRhdGE6JywgZGF0YSk7XG4gICAgICBcbiAgICAgIC8vIElmIHRoZXJlJ3MgYW4gZXJyb3IgYnV0IHdlIGdvdCBhIHJlc3BvbnNlLCBpdCBtZWFucyBBUEkgaXMgY29ubmVjdGVkXG4gICAgICBpZiAoZGF0YS5lcnJvcikge1xuICAgICAgICBjb25zb2xlLmxvZygnW0thcmFva2VBcGldIFNlcnZlciBlcnJvciAoYnV0IEFQSSBpcyByZWFjaGFibGUpOicsIGRhdGEuZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGhhc19rYXJhb2tlOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcjogZGF0YS5lcnJvcixcbiAgICAgICAgICB0cmFja19pZDogdHJhY2tJZCxcbiAgICAgICAgICBhcGlfY29ubmVjdGVkOiB0cnVlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRXJyb3IgZmV0Y2hpbmcga2FyYW9rZSBkYXRhOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFydCBhIGthcmFva2Ugc2Vzc2lvblxuICAgKi9cbiAgYXN5bmMgc3RhcnRTZXNzaW9uKFxuICAgIHRyYWNrSWQ6IHN0cmluZyxcbiAgICBzb25nRGF0YToge1xuICAgICAgdGl0bGU6IHN0cmluZztcbiAgICAgIGFydGlzdDogc3RyaW5nO1xuICAgICAgYWxidW0/OiBzdHJpbmc7XG4gICAgICBkdXJhdGlvbj86IG51bWJlcjtcbiAgICB9XG4gICk6IFByb21pc2U8S2FyYW9rZVNlc3Npb24gfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7dGhpcy5iYXNlVXJsfS9rYXJhb2tlL3N0YXJ0YCwge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgLy8gVE9ETzogQWRkIGF1dGggdG9rZW4gd2hlbiBhdmFpbGFibGVcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHRyYWNrSWQsXG4gICAgICAgICAgc29uZ0RhdGEsXG4gICAgICAgIH0pLFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBzdGFydCBzZXNzaW9uOicsIHJlc3BvbnNlLnN0YXR1cyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICByZXR1cm4gcmVzdWx0LnNlc3Npb247XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBFcnJvciBzdGFydGluZyBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUZXN0IGNvbm5lY3Rpb24gdG8gdGhlIEFQSVxuICAgKi9cbiAgYXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7dGhpcy5iYXNlVXJsLnJlcGxhY2UoJy9hcGknLCAnJyl9L2hlYWx0aGApO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLm9rO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gQ29ubmVjdGlvbiB0ZXN0IGZhaWxlZDonLCBlcnJvcik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBrYXJhb2tlQXBpID0gbmV3IEthcmFva2VBcGlTZXJ2aWNlKCk7IiwiaW1wb3J0IHsgQ29tcG9uZW50LCBjcmVhdGVSZXNvdXJjZSwgU2hvdywgY3JlYXRlU2lnbmFsLCBjcmVhdGVFZmZlY3QgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBcbiAgUmVhZEFsb3VkLCBcbiAgUHJvZ3Jlc3NCYXIsIFxuICBQcmFjdGljZUhlYWRlciwgXG4gIEV4ZXJjaXNlVGVtcGxhdGUsIFxuICBFeGVyY2lzZUZvb3RlciBcbn0gZnJvbSAnQHNjYXJsZXR0L3VpJztcblxuaW50ZXJmYWNlIEV4ZXJjaXNlIHtcbiAgaWQ6IHN0cmluZztcbiAgdHlwZTogJ3JlYWRfYWxvdWQnO1xuICBmdWxsX2xpbmU6IHN0cmluZztcbiAgZm9jdXNfd29yZHM6IHN0cmluZ1tdO1xuICBjYXJkX2lkczogc3RyaW5nW107XG4gIHNvbmdfY29udGV4dDoge1xuICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgYXJ0aXN0OiBzdHJpbmc7XG4gICAgc29uZ19pZDogc3RyaW5nO1xuICAgIGxpbmVfaW5kZXg6IG51bWJlcjtcbiAgfTtcbn1cblxuaW50ZXJmYWNlIFByYWN0aWNlVmlld1Byb3BzIHtcbiAgc2Vzc2lvbklkPzogc3RyaW5nO1xuICBvbkJhY2s6ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBQcmFjdGljZVZpZXc6IENvbXBvbmVudDxQcmFjdGljZVZpZXdQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2N1cnJlbnRFeGVyY2lzZUluZGV4LCBzZXRDdXJyZW50RXhlcmNpc2VJbmRleF0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFtpc1JlY29yZGluZywgc2V0SXNSZWNvcmRpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2lzUHJvY2Vzc2luZywgc2V0SXNQcm9jZXNzaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFt1c2VyVHJhbnNjcmlwdCwgc2V0VXNlclRyYW5zY3JpcHRdID0gY3JlYXRlU2lnbmFsKCcnKTtcbiAgY29uc3QgW2N1cnJlbnRTY29yZSwgc2V0Q3VycmVudFNjb3JlXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW21lZGlhUmVjb3JkZXIsIHNldE1lZGlhUmVjb3JkZXJdID0gY3JlYXRlU2lnbmFsPE1lZGlhUmVjb3JkZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2F1ZGlvQ2h1bmtzLCBzZXRBdWRpb0NodW5rc10gPSBjcmVhdGVTaWduYWw8QmxvYltdPihbXSk7XG4gIFxuICAvLyBGZXRjaCBleGVyY2lzZXMgZnJvbSB0aGUgQVBJXG4gIGNvbnN0IFtleGVyY2lzZXNdID0gY3JlYXRlUmVzb3VyY2UoYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZygnW1ByYWN0aWNlVmlld10gRmV0Y2hpbmcgZXhlcmNpc2VzLi4uJyk7XG4gICAgICAvLyBJbmNsdWRlIHNlc3Npb25JZCBpZiBwcm92aWRlZCB0byBnZXQgZXhlcmNpc2VzIGZyb20gdGhpcyBzZXNzaW9uIG9ubHlcbiAgICAgIGNvbnN0IHVybCA9IHByb3BzLnNlc3Npb25JZCBcbiAgICAgICAgPyBgaHR0cDovL2xvY2FsaG9zdDo4Nzg3L2FwaS9wcmFjdGljZS9leGVyY2lzZXM/bGltaXQ9MTAmc2Vzc2lvbklkPSR7cHJvcHMuc2Vzc2lvbklkfWBcbiAgICAgICAgOiAnaHR0cDovL2xvY2FsaG9zdDo4Nzg3L2FwaS9wcmFjdGljZS9leGVyY2lzZXM/bGltaXQ9MTAnO1xuICAgICAgXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCk7XG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IGVycm9yVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICAgICAgY29uc29sZS5lcnJvcignW1ByYWN0aWNlVmlld10gQVBJIGVycm9yOicsIHJlc3BvbnNlLnN0YXR1cywgZXJyb3JUZXh0KTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gZmV0Y2ggZXhlcmNpc2VzJyk7XG4gICAgICB9XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgY29uc29sZS5sb2coJ1tQcmFjdGljZVZpZXddIEZldGNoZWQgZXhlcmNpc2VzOicsIGRhdGEpO1xuICAgICAgXG4gICAgICBpZiAoZGF0YS5kYXRhICYmIGRhdGEuZGF0YS5leGVyY2lzZXMpIHtcbiAgICAgICAgcmV0dXJuIGRhdGEuZGF0YS5leGVyY2lzZXMgYXMgRXhlcmNpc2VbXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBbXTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW1ByYWN0aWNlVmlld10gRmFpbGVkIHRvIGZldGNoOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIExvZyB3aGVuIGV4ZXJjaXNlcyBsb2FkXG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgZXhlcmNpc2VMaXN0ID0gZXhlcmNpc2VzKCk7XG4gICAgaWYgKGV4ZXJjaXNlTGlzdCAmJiBleGVyY2lzZUxpc3QubGVuZ3RoID4gMCkge1xuICAgICAgY29uc29sZS5sb2coJ1tQcmFjdGljZVZpZXddIEV4ZXJjaXNlcyBsb2FkZWQsIGNvdW50OicsIGV4ZXJjaXNlTGlzdC5sZW5ndGgpO1xuICAgIH1cbiAgfSk7XG5cbiAgY29uc3QgaGFuZGxlU3RhcnRSZWNvcmRpbmcgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tQcmFjdGljZVZpZXddIFN0YXJ0aW5nIHJlY29yZGluZy4uLicpO1xuICAgIHNldFVzZXJUcmFuc2NyaXB0KCcnKTtcbiAgICBzZXRDdXJyZW50U2NvcmUobnVsbCk7XG4gICAgc2V0QXVkaW9DaHVua3MoW10pO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdHJlYW0gPSBhd2FpdCBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSh7IFxuICAgICAgICBhdWRpbzoge1xuICAgICAgICAgIGVjaG9DYW5jZWxsYXRpb246IHRydWUsXG4gICAgICAgICAgbm9pc2VTdXBwcmVzc2lvbjogdHJ1ZSxcbiAgICAgICAgICBhdXRvR2FpbkNvbnRyb2w6IHRydWVcbiAgICAgICAgfSBcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBtaW1lVHlwZSA9IE1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKCdhdWRpby93ZWJtO2NvZGVjcz1vcHVzJykgXG4gICAgICAgID8gJ2F1ZGlvL3dlYm07Y29kZWNzPW9wdXMnIFxuICAgICAgICA6ICdhdWRpby93ZWJtJztcbiAgICAgICAgXG4gICAgICBjb25zdCByZWNvcmRlciA9IG5ldyBNZWRpYVJlY29yZGVyKHN0cmVhbSwgeyBtaW1lVHlwZSB9KTtcbiAgICAgIGNvbnN0IGNodW5rczogQmxvYltdID0gW107XG4gICAgICBcbiAgICAgIHJlY29yZGVyLm9uZGF0YWF2YWlsYWJsZSA9IChldmVudCkgPT4ge1xuICAgICAgICBpZiAoZXZlbnQuZGF0YS5zaXplID4gMCkge1xuICAgICAgICAgIGNodW5rcy5wdXNoKGV2ZW50LmRhdGEpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgXG4gICAgICByZWNvcmRlci5vbnN0b3AgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGF1ZGlvQmxvYiA9IG5ldyBCbG9iKGNodW5rcywgeyB0eXBlOiBtaW1lVHlwZSB9KTtcbiAgICAgICAgYXdhaXQgcHJvY2Vzc1JlY29yZGluZyhhdWRpb0Jsb2IpO1xuICAgICAgICBcbiAgICAgICAgLy8gU3RvcCBhbGwgdHJhY2tzXG4gICAgICAgIHN0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKHRyYWNrID0+IHRyYWNrLnN0b3AoKSk7XG4gICAgICB9O1xuICAgICAgXG4gICAgICByZWNvcmRlci5zdGFydCgpO1xuICAgICAgc2V0TWVkaWFSZWNvcmRlcihyZWNvcmRlcik7XG4gICAgICBzZXRJc1JlY29yZGluZyh0cnVlKTtcbiAgICAgIFxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbUHJhY3RpY2VWaWV3XSBGYWlsZWQgdG8gc3RhcnQgcmVjb3JkaW5nOicsIGVycm9yKTtcbiAgICAgIHNldElzUmVjb3JkaW5nKGZhbHNlKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgcHJvY2Vzc1JlY29yZGluZyA9IGFzeW5jIChibG9iOiBCbG9iKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIHNldElzUHJvY2Vzc2luZyh0cnVlKTtcbiAgICAgIFxuICAgICAgLy8gQ29udmVydCB0byBiYXNlNjQgZm9yIEFQSVxuICAgICAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgIGNvbnN0IGJhc2U2NCA9IGF3YWl0IG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgcmVhZGVyLm9ubG9hZGVuZCA9ICgpID0+IHtcbiAgICAgICAgICBjb25zdCBiYXNlNjRTdHJpbmcgPSByZWFkZXIucmVzdWx0IGFzIHN0cmluZztcbiAgICAgICAgICByZXNvbHZlKGJhc2U2NFN0cmluZy5zcGxpdCgnLCcpWzFdKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoYmxvYik7XG4gICAgICB9KTtcblxuICAgICAgLy8gU2VuZCB0byBTVFQgQVBJXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCdodHRwOi8vbG9jYWxob3N0Ojg3ODcvYXBpL3NwZWVjaC10by10ZXh0L3RyYW5zY3JpYmUnLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBcbiAgICAgICAgICBhdWRpb0Jhc2U2NDogYmFzZTY0LFxuICAgICAgICAgIGV4cGVjdGVkVGV4dDogY3VycmVudEV4ZXJjaXNlKCk/LmZ1bGxfbGluZVxuICAgICAgICB9KVxuICAgICAgfSk7XG5cbiAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIHNldFVzZXJUcmFuc2NyaXB0KHJlc3VsdC5kYXRhLnRyYW5zY3JpcHQpO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2FsY3VsYXRlIGEgc2ltcGxlIHNjb3JlIGJhc2VkIG9uIG1hdGNoaW5nIHdvcmRzXG4gICAgICAgIGNvbnN0IHNjb3JlID0gY2FsY3VsYXRlU2NvcmUoY3VycmVudEV4ZXJjaXNlKCk/LmZ1bGxfbGluZSB8fCAnJywgcmVzdWx0LmRhdGEudHJhbnNjcmlwdCk7XG4gICAgICAgIHNldEN1cnJlbnRTY29yZShzY29yZSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQcmFjdGljZVZpZXddIEZhaWxlZCB0byBwcm9jZXNzIHJlY29yZGluZzonLCBlcnJvcik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldElzUHJvY2Vzc2luZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVN0b3BSZWNvcmRpbmcgPSAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tQcmFjdGljZVZpZXddIFN0b3BwaW5nIHJlY29yZGluZy4uLicpO1xuICAgIGNvbnN0IHJlY29yZGVyID0gbWVkaWFSZWNvcmRlcigpO1xuICAgIGlmIChyZWNvcmRlciAmJiByZWNvcmRlci5zdGF0ZSAhPT0gJ2luYWN0aXZlJykge1xuICAgICAgcmVjb3JkZXIuc3RvcCgpO1xuICAgICAgc2V0SXNSZWNvcmRpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBjYWxjdWxhdGVTY29yZSA9IChleHBlY3RlZDogc3RyaW5nLCBhY3R1YWw6IHN0cmluZyk6IG51bWJlciA9PiB7XG4gICAgY29uc3QgZXhwZWN0ZWRXb3JkcyA9IGV4cGVjdGVkLnRvTG93ZXJDYXNlKCkuc3BsaXQoL1xccysvKTtcbiAgICBjb25zdCBhY3R1YWxXb3JkcyA9IGFjdHVhbC50b0xvd2VyQ2FzZSgpLnNwbGl0KC9cXHMrLyk7XG4gICAgbGV0IG1hdGNoZXMgPSAwO1xuICAgIFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwZWN0ZWRXb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFjdHVhbFdvcmRzW2ldID09PSBleHBlY3RlZFdvcmRzW2ldKSB7XG4gICAgICAgIG1hdGNoZXMrKztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIE1hdGgucm91bmQoKG1hdGNoZXMgLyBleHBlY3RlZFdvcmRzLmxlbmd0aCkgKiAxMDApO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVN1Ym1pdCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBjdXJyZW50RXhlcmNpc2UgPSBleGVyY2lzZXMoKT8uW2N1cnJlbnRFeGVyY2lzZUluZGV4KCldO1xuICAgIGNvbnN0IHNjb3JlID0gY3VycmVudFNjb3JlKCk7XG4gICAgY29uc3QgY2h1bmtzID0gYXVkaW9DaHVua3MoKTtcbiAgICBjb25zdCBibG9iID0gY2h1bmtzLmxlbmd0aCA+IDAgPyBuZXcgQmxvYihjaHVua3MsIHsgdHlwZTogJ2F1ZGlvL3dlYm0nIH0pIDogbnVsbDtcbiAgICBcbiAgICBpZiAoY3VycmVudEV4ZXJjaXNlICYmIGN1cnJlbnRFeGVyY2lzZS5jYXJkX2lkcy5sZW5ndGggPiAwICYmIGJsb2IgJiYgc2NvcmUgIT09IG51bGwpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIENvbnZlcnQgYXVkaW8gdG8gYmFzZTY0XG4gICAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICAgIGNvbnN0IGJhc2U2NCA9IGF3YWl0IG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICByZWFkZXIub25sb2FkZW5kID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYmFzZTY0U3RyaW5nID0gcmVhZGVyLnJlc3VsdCBhcyBzdHJpbmc7XG4gICAgICAgICAgICByZXNvbHZlKGJhc2U2NFN0cmluZy5zcGxpdCgnLCcpWzFdKTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKGJsb2IpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTdWJtaXQgcmV2aWV3XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJ2h0dHA6Ly9sb2NhbGhvc3Q6ODc4Ny9hcGkvcHJhY3RpY2UvcmV2aWV3Jywge1xuICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGV4ZXJjaXNlSWQ6IGN1cnJlbnRFeGVyY2lzZS5pZCxcbiAgICAgICAgICAgIGF1ZGlvQmFzZTY0OiBiYXNlNjQsXG4gICAgICAgICAgICBjYXJkU2NvcmVzOiBjdXJyZW50RXhlcmNpc2UuY2FyZF9pZHMubWFwKGNhcmRJZCA9PiAoe1xuICAgICAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgICAgIHNjb3JlXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgICB9KVxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW1ByYWN0aWNlVmlld10gUmV2aWV3IHN1Ym1pdHRlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW1ByYWN0aWNlVmlld10gRmFpbGVkIHRvIHN1Ym1pdCByZXZpZXc6JywgZXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBNb3ZlIHRvIG5leHQgZXhlcmNpc2VcbiAgICBpZiAoY3VycmVudEV4ZXJjaXNlSW5kZXgoKSA8IChleGVyY2lzZXMoKT8ubGVuZ3RoIHx8IDApIC0gMSkge1xuICAgICAgc2V0Q3VycmVudEV4ZXJjaXNlSW5kZXgoY3VycmVudEV4ZXJjaXNlSW5kZXgoKSArIDEpO1xuICAgICAgc2V0VXNlclRyYW5zY3JpcHQoJycpO1xuICAgICAgc2V0Q3VycmVudFNjb3JlKG51bGwpO1xuICAgICAgc2V0QXVkaW9DaHVua3MoW10pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBBbGwgZXhlcmNpc2VzIGNvbXBsZXRlZFxuICAgICAgcHJvcHMub25CYWNrKCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVNraXAgPSAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tQcmFjdGljZVZpZXddIFNraXBwaW5nIGV4ZXJjaXNlJyk7XG4gICAgXG4gICAgLy8gTW92ZSB0byBuZXh0IGV4ZXJjaXNlXG4gICAgaWYgKGN1cnJlbnRFeGVyY2lzZUluZGV4KCkgPCAoZXhlcmNpc2VzKCk/Lmxlbmd0aCB8fCAwKSAtIDEpIHtcbiAgICAgIHNldEN1cnJlbnRFeGVyY2lzZUluZGV4KGN1cnJlbnRFeGVyY2lzZUluZGV4KCkgKyAxKTtcbiAgICAgIHNldFVzZXJUcmFuc2NyaXB0KCcnKTtcbiAgICAgIHNldEN1cnJlbnRTY29yZShudWxsKTtcbiAgICAgIHNldEF1ZGlvQ2h1bmtzKFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQWxsIGV4ZXJjaXNlcyBjb21wbGV0ZWRcbiAgICAgIHByb3BzLm9uQmFjaygpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBjdXJyZW50RXhlcmNpc2UgPSAoKSA9PiBleGVyY2lzZXMoKT8uW2N1cnJlbnRFeGVyY2lzZUluZGV4KCldO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz1cImgtZnVsbCBiZy1iYXNlIGZsZXggZmxleC1jb2xcIj5cbiAgICAgIDxTaG93XG4gICAgICAgIHdoZW49eyFleGVyY2lzZXMubG9hZGluZ31cbiAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXJcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYW5pbWF0ZS1zcGluIHJvdW5kZWQtZnVsbCBoLTEyIHctMTIgYm9yZGVyLWItMiBib3JkZXItYWNjZW50LXByaW1hcnkgbXgtYXV0byBtYi00XCI+PC9kaXY+XG4gICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1tdXRlZC1mb3JlZ3JvdW5kXCI+TG9hZGluZyBleGVyY2lzZXMuLi48L3A+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgfVxuICAgICAgPlxuICAgICAgICA8U2hvd1xuICAgICAgICAgIHdoZW49eyhleGVyY2lzZXMoKSB8fCBbXSkubGVuZ3RoID4gMH1cbiAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHAtOFwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgbWF4LXctbWRcIj5cbiAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1tdXRlZC1mb3JlZ3JvdW5kIG1iLTRcIj5ObyBwcmFjdGljZSBleGVyY2lzZXMgYXZhaWxhYmxlIHlldC48L3A+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtbXV0ZWQtZm9yZWdyb3VuZFwiPkNvbXBsZXRlIGthcmFva2Ugc2Vzc2lvbnMgd2l0aCBlcnJvcnMgdG8gZ2VuZXJhdGUgcGVyc29uYWxpemVkIGV4ZXJjaXNlcyE8L3A+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgfVxuICAgICAgICA+XG4gICAgICAgICAgPFNob3cgd2hlbj17Y3VycmVudEV4ZXJjaXNlKCl9PlxuICAgICAgICAgICAgeyhleGVyY2lzZSkgPT4gKFxuICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgIDxQcm9ncmVzc0JhciBcbiAgICAgICAgICAgICAgICAgIGN1cnJlbnQ9e2N1cnJlbnRFeGVyY2lzZUluZGV4KCkgKyAxfSBcbiAgICAgICAgICAgICAgICAgIHRvdGFsPXtleGVyY2lzZXMoKT8ubGVuZ3RoIHx8IDB9IFxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgPFByYWN0aWNlSGVhZGVyIFxuICAgICAgICAgICAgICAgICAgdGl0bGU9XCJQcmFjdGljZVwiIFxuICAgICAgICAgICAgICAgICAgb25FeGl0PXtwcm9wcy5vbkJhY2t9IFxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgPG1haW4gY2xhc3M9XCJmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgIDxFeGVyY2lzZVRlbXBsYXRlIGluc3RydWN0aW9uVGV4dD1cIlJlYWQgYWxvdWQ6XCI+XG4gICAgICAgICAgICAgICAgICAgIDxSZWFkQWxvdWRcbiAgICAgICAgICAgICAgICAgICAgICBwcm9tcHQ9e2V4ZXJjaXNlKCkuZnVsbF9saW5lfVxuICAgICAgICAgICAgICAgICAgICAgIHVzZXJUcmFuc2NyaXB0PXt1c2VyVHJhbnNjcmlwdCgpfVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgPC9FeGVyY2lzZVRlbXBsYXRlPlxuICAgICAgICAgICAgICAgIDwvbWFpbj5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICA8RXhlcmNpc2VGb290ZXJcbiAgICAgICAgICAgICAgICAgIGlzUmVjb3JkaW5nPXtpc1JlY29yZGluZygpfVxuICAgICAgICAgICAgICAgICAgaXNQcm9jZXNzaW5nPXtpc1Byb2Nlc3NpbmcoKX1cbiAgICAgICAgICAgICAgICAgIGNhblN1Ym1pdD17dXNlclRyYW5zY3JpcHQoKS50cmltKCkubGVuZ3RoID4gMH1cbiAgICAgICAgICAgICAgICAgIG9uUmVjb3JkPXtoYW5kbGVTdGFydFJlY29yZGluZ31cbiAgICAgICAgICAgICAgICAgIG9uU3RvcD17aGFuZGxlU3RvcFJlY29yZGluZ31cbiAgICAgICAgICAgICAgICAgIG9uU3VibWl0PXtoYW5kbGVTdWJtaXR9XG4gICAgICAgICAgICAgICAgICBjbGFzcz1cIiFyZWxhdGl2ZSAhYm90dG9tLWF1dG8gIWxlZnQtYXV0byAhcmlnaHQtYXV0b1wiXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgPC9TaG93PlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBDb21wb25lbnQsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlRWZmZWN0LCBvbk1vdW50LCBvbkNsZWFudXAsIFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25LYXJhb2tlVmlldywgTWluaW1pemVkS2FyYW9rZSwgQ291bnRkb3duLCBDb21wbGV0aW9uVmlldywgdXNlS2FyYW9rZVNlc3Npb24sIEV4dGVuc2lvbkF1ZGlvU2VydmljZSwgSTE4blByb3ZpZGVyIH0gZnJvbSAnQHNjYXJsZXR0L3VpJztcbmltcG9ydCB7IHRyYWNrRGV0ZWN0b3IsIHR5cGUgVHJhY2tJbmZvIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvdHJhY2stZGV0ZWN0b3InO1xuaW1wb3J0IHsgZ2V0QXV0aFRva2VuIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3RvcmFnZSc7XG5pbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xuaW1wb3J0IHsga2FyYW9rZUFwaSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2thcmFva2UtYXBpJztcbmltcG9ydCB7IFByYWN0aWNlVmlldyB9IGZyb20gJy4vUHJhY3RpY2VWaWV3JztcblxuZXhwb3J0IGludGVyZmFjZSBDb250ZW50QXBwUHJvcHMge31cblxuZXhwb3J0IGNvbnN0IENvbnRlbnRBcHA6IENvbXBvbmVudDxDb250ZW50QXBwUHJvcHM+ID0gKCkgPT4ge1xuICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlbmRlcmluZyBDb250ZW50QXBwIGNvbXBvbmVudCcpO1xuICBcbiAgLy8gU3RhdGVcbiAgY29uc3QgW2N1cnJlbnRUcmFjaywgc2V0Q3VycmVudFRyYWNrXSA9IGNyZWF0ZVNpZ25hbDxUcmFja0luZm8gfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2F1dGhUb2tlbiwgc2V0QXV0aFRva2VuXSA9IGNyZWF0ZVNpZ25hbDxzdHJpbmcgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW3Nob3dLYXJhb2tlLCBzZXRTaG93S2FyYW9rZV0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBba2FyYW9rZURhdGEsIHNldEthcmFva2VEYXRhXSA9IGNyZWF0ZVNpZ25hbDxhbnk+KG51bGwpO1xuICBjb25zdCBbbG9hZGluZywgc2V0TG9hZGluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbc2Vzc2lvblN0YXJ0ZWQsIHNldFNlc3Npb25TdGFydGVkXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtpc01pbmltaXplZCwgc2V0SXNNaW5pbWl6ZWRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2NvdW50ZG93biwgc2V0Q291bnRkb3duXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2lzUGxheWluZywgc2V0SXNQbGF5aW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtjdXJyZW50VGltZSwgc2V0Q3VycmVudFRpbWVdID0gY3JlYXRlU2lnbmFsKDApO1xuICBjb25zdCBbYXVkaW9SZWYsIHNldEF1ZGlvUmVmXSA9IGNyZWF0ZVNpZ25hbDxIVE1MQXVkaW9FbGVtZW50IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtrYXJhb2tlU2Vzc2lvbiwgc2V0S2FyYW9rZVNlc3Npb25dID0gY3JlYXRlU2lnbmFsPFJldHVyblR5cGU8dHlwZW9mIHVzZUthcmFva2VTZXNzaW9uPiB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbY29tcGxldGlvbkRhdGEsIHNldENvbXBsZXRpb25EYXRhXSA9IGNyZWF0ZVNpZ25hbDxhbnk+KG51bGwpO1xuICBjb25zdCBbc2hvd1ByYWN0aWNlLCBzZXRTaG93UHJhY3RpY2VdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgXG4gIC8vIExvYWQgYXV0aCB0b2tlbiBvbiBtb3VudFxuICBvbk1vdW50KGFzeW5jICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIExvYWRpbmcgYXV0aCB0b2tlbicpO1xuICAgIGNvbnN0IHRva2VuID0gYXdhaXQgZ2V0QXV0aFRva2VuKCk7XG4gICAgaWYgKHRva2VuKSB7XG4gICAgICBzZXRBdXRoVG9rZW4odG9rZW4pO1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBBdXRoIHRva2VuIGxvYWRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgZGVtbyB0b2tlbiBmb3IgZGV2ZWxvcG1lbnRcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTm8gYXV0aCB0b2tlbiBmb3VuZCwgdXNpbmcgZGVtbyB0b2tlbicpO1xuICAgICAgc2V0QXV0aFRva2VuKCdzY2FybGV0dF9kZW1vX3Rva2VuXzEyMycpO1xuICAgIH1cbiAgICBcbiAgICAvLyBTdGFydCB3YXRjaGluZyBmb3IgdHJhY2sgY2hhbmdlc1xuICAgIGNvbnN0IGNsZWFudXAgPSB0cmFja0RldGVjdG9yLndhdGNoRm9yQ2hhbmdlcygodHJhY2spID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gVHJhY2sgY2hhbmdlZDonLCB0cmFjayk7XG4gICAgICBzZXRDdXJyZW50VHJhY2sodHJhY2spO1xuICAgICAgLy8gU2hvdyBrYXJhb2tlIHdoZW4gdHJhY2sgaXMgZGV0ZWN0ZWQgYW5kIGZldGNoIGRhdGFcbiAgICAgIGlmICh0cmFjaykge1xuICAgICAgICBzZXRTaG93S2FyYW9rZSh0cnVlKTtcbiAgICAgICAgZmV0Y2hLYXJhb2tlRGF0YSh0cmFjayk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBvbkNsZWFudXAoY2xlYW51cCk7XG4gIH0pO1xuXG4gIGNvbnN0IGZldGNoS2FyYW9rZURhdGEgPSBhc3luYyAodHJhY2s6IFRyYWNrSW5mbykgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRmV0Y2hpbmcga2FyYW9rZSBkYXRhIGZvciB0cmFjazonLCB0cmFjayk7XG4gICAgc2V0TG9hZGluZyh0cnVlKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGthcmFva2VBcGkuZ2V0S2FyYW9rZURhdGEoXG4gICAgICAgIHRyYWNrLnRyYWNrSWQsXG4gICAgICAgIHRyYWNrLnRpdGxlLFxuICAgICAgICB0cmFjay5hcnRpc3RcbiAgICAgICk7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEthcmFva2UgZGF0YSBsb2FkZWQ6JywgZGF0YSk7XG4gICAgICBzZXRLYXJhb2tlRGF0YShkYXRhKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0NvbnRlbnRBcHBdIEZhaWxlZCB0byBmZXRjaCBrYXJhb2tlIGRhdGE6JywgZXJyb3IpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRMb2FkaW5nKGZhbHNlKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlU3RhcnQgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTdGFydCBrYXJhb2tlIHNlc3Npb24nKTtcbiAgICBzZXRTZXNzaW9uU3RhcnRlZCh0cnVlKTtcbiAgICBcbiAgICBjb25zdCBkYXRhID0ga2FyYW9rZURhdGEoKTtcbiAgICBjb25zdCBhdWRpbyA9IGF1ZGlvUmVmKCk7XG4gICAgY29uc3QgdHJhY2sgPSBjdXJyZW50VHJhY2soKTtcbiAgICBcbiAgICBpZiAoZGF0YSAmJiB0cmFjayAmJiBkYXRhLmx5cmljcz8ubGluZXMpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQ3JlYXRpbmcga2FyYW9rZSBzZXNzaW9uIHdpdGggYXVkaW8gY2FwdHVyZScsIHtcbiAgICAgICAgdHJhY2tJZDogdHJhY2suaWQsXG4gICAgICAgIHRyYWNrVGl0bGU6IHRyYWNrLnRpdGxlLFxuICAgICAgICBzb25nRGF0YTogZGF0YS5zb25nLFxuICAgICAgICBoYXNMeXJpY3M6ICEhZGF0YS5seXJpY3M/LmxpbmVzXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gQ3JlYXRlIGFuZCBzdGFydCBzZXNzaW9uXG4gICAgICBjb25zdCBuZXdTZXNzaW9uID0gdXNlS2FyYW9rZVNlc3Npb24oe1xuICAgICAgICBseXJpY3M6IGRhdGEubHlyaWNzLmxpbmVzLFxuICAgICAgICB0cmFja0lkOiB0cmFjay50cmFja0lkLFxuICAgICAgICBzb25nRGF0YTogZGF0YS5zb25nID8ge1xuICAgICAgICAgIHRpdGxlOiBkYXRhLnNvbmcudGl0bGUsXG4gICAgICAgICAgYXJ0aXN0OiBkYXRhLnNvbmcuYXJ0aXN0LFxuICAgICAgICAgIGFsYnVtOiBkYXRhLnNvbmcuYWxidW0sXG4gICAgICAgICAgZHVyYXRpb246IGRhdGEuc29uZy5kdXJhdGlvblxuICAgICAgICB9IDoge1xuICAgICAgICAgIHRpdGxlOiB0cmFjay50aXRsZSxcbiAgICAgICAgICBhcnRpc3Q6IHRyYWNrLmFydGlzdFxuICAgICAgICB9LFxuICAgICAgICBzb25nQ2F0YWxvZ0lkOiBkYXRhLnNvbmdfY2F0YWxvZ19pZCxcbiAgICAgICAgYXVkaW9FbGVtZW50OiB1bmRlZmluZWQsIC8vIFdpbGwgYmUgc2V0IHdoZW4gYXVkaW8gc3RhcnRzIHBsYXlpbmdcbiAgICAgICAgYXBpVXJsOiAnaHR0cDovL2xvY2FsaG9zdDo4Nzg3L2FwaScsXG4gICAgICAgIG9uQ29tcGxldGU6IChyZXN1bHRzKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBLYXJhb2tlIHNlc3Npb24gY29tcGxldGVkOicsIHJlc3VsdHMpO1xuICAgICAgICAgIHNldFNlc3Npb25TdGFydGVkKGZhbHNlKTtcbiAgICAgICAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgICAgICAgIHNldENvbXBsZXRpb25EYXRhKHJlc3VsdHMpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIFN0b3AgYXVkaW8gcGxheWJhY2tcbiAgICAgICAgICBjb25zdCBhdWRpbyA9IGF1ZGlvUmVmKCk7XG4gICAgICAgICAgaWYgKGF1ZGlvKSB7XG4gICAgICAgICAgICBhdWRpby5wYXVzZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIHNldEthcmFva2VTZXNzaW9uKG5ld1Nlc3Npb24pO1xuICAgICAgXG4gICAgICAvLyBTdGFydCB0aGUgc2Vzc2lvbiAoaW5jbHVkZXMgY291bnRkb3duIGFuZCBhdWRpbyBpbml0aWFsaXphdGlvbilcbiAgICAgIGF3YWl0IG5ld1Nlc3Npb24uc3RhcnRTZXNzaW9uKCk7XG4gICAgICBcbiAgICAgIC8vIFdhdGNoIGZvciBjb3VudGRvd24gdG8gZmluaXNoIGFuZCBzdGFydCBhdWRpb1xuICAgICAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKG5ld1Nlc3Npb24uY291bnRkb3duKCkgPT09IG51bGwgJiYgbmV3U2Vzc2lvbi5pc1BsYXlpbmcoKSAmJiAhaXNQbGF5aW5nKCkpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIENvdW50ZG93biBmaW5pc2hlZCwgc3RhcnRpbmcgYXVkaW8gcGxheWJhY2snKTtcbiAgICAgICAgICBzdGFydEF1ZGlvUGxheWJhY2soKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gVXBkYXRlIHNlc3Npb24gd2l0aCBhdWRpbyBlbGVtZW50IHdoZW4gYXZhaWxhYmxlXG4gICAgICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9SZWYoKTtcbiAgICAgICAgaWYgKGF1ZGlvICYmIG5ld1Nlc3Npb24pIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFNldHRpbmcgYXVkaW8gZWxlbWVudCBvbiBuZXcgc2Vzc2lvbicpO1xuICAgICAgICAgIG5ld1Nlc3Npb24uc2V0QXVkaW9FbGVtZW50KGF1ZGlvKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRmFsbGJhY2sgdG8gc2ltcGxlIGNvdW50ZG93bicpO1xuICAgICAgLy8gRmFsbGJhY2sgdG8gb2xkIGJlaGF2aW9yXG4gICAgICBzZXRDb3VudGRvd24oMyk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNvdW50ZG93bkludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gY291bnRkb3duKCk7XG4gICAgICAgIGlmIChjdXJyZW50ICE9PSBudWxsICYmIGN1cnJlbnQgPiAxKSB7XG4gICAgICAgICAgc2V0Q291bnRkb3duKGN1cnJlbnQgLSAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjbGVhckludGVydmFsKGNvdW50ZG93bkludGVydmFsKTtcbiAgICAgICAgICBzZXRDb3VudGRvd24obnVsbCk7XG4gICAgICAgICAgc3RhcnRBdWRpb1BsYXliYWNrKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIDEwMDApO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBzdGFydEF1ZGlvUGxheWJhY2sgPSAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTdGFydGluZyBhdWRpbyBwbGF5YmFjaycpO1xuICAgIHNldElzUGxheWluZyh0cnVlKTtcbiAgICBcbiAgICAvLyBUcnkgbXVsdGlwbGUgbWV0aG9kcyB0byBmaW5kIGFuZCBwbGF5IGF1ZGlvXG4gICAgLy8gTWV0aG9kIDE6IExvb2sgZm9yIGF1ZGlvIGVsZW1lbnRzXG4gICAgY29uc3QgYXVkaW9FbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2F1ZGlvJyk7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGb3VuZCBhdWRpbyBlbGVtZW50czonLCBhdWRpb0VsZW1lbnRzLmxlbmd0aCk7XG4gICAgXG4gICAgaWYgKGF1ZGlvRWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgYXVkaW8gPSBhdWRpb0VsZW1lbnRzWzBdIGFzIEhUTUxBdWRpb0VsZW1lbnQ7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEF1ZGlvIGVsZW1lbnQ6Jywge1xuICAgICAgICBzcmM6IGF1ZGlvLnNyYyxcbiAgICAgICAgcGF1c2VkOiBhdWRpby5wYXVzZWQsXG4gICAgICAgIGR1cmF0aW9uOiBhdWRpby5kdXJhdGlvbixcbiAgICAgICAgY3VycmVudFRpbWU6IGF1ZGlvLmN1cnJlbnRUaW1lXG4gICAgICB9KTtcbiAgICAgIHNldEF1ZGlvUmVmKGF1ZGlvKTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIGthcmFva2Ugc2Vzc2lvbiB3aXRoIGF1ZGlvIGVsZW1lbnQgaWYgaXQgZXhpc3RzXG4gICAgICBjb25zdCBzZXNzaW9uID0ga2FyYW9rZVNlc3Npb24oKTtcbiAgICAgIGlmIChzZXNzaW9uKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU2V0dGluZyBhdWRpbyBlbGVtZW50IG9uIGthcmFva2Ugc2Vzc2lvbicpO1xuICAgICAgICBzZXNzaW9uLnNldEF1ZGlvRWxlbWVudChhdWRpbyk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlc3Npb24uYXVkaW9Qcm9jZXNzb3IuaXNSZWFkeSgpKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBJbml0aWFsaXppbmcgYXVkaW8gcHJvY2Vzc29yIGZvciBzZXNzaW9uJyk7XG4gICAgICAgICAgc2Vzc2lvbi5hdWRpb1Byb2Nlc3Nvci5pbml0aWFsaXplKCkuY2F0Y2goY29uc29sZS5lcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gVHJ5IHRvIHBsYXkgdGhlIGF1ZGlvXG4gICAgICBhdWRpby5wbGF5KCkudGhlbigoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXVkaW8gc3RhcnRlZCBwbGF5aW5nIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgfSkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0NvbnRlbnRBcHBdIEZhaWxlZCB0byBwbGF5IGF1ZGlvOicsIGVycik7XG4gICAgICAgIFxuICAgICAgICAvLyBNZXRob2QgMjogVHJ5IGNsaWNraW5nIHRoZSBwbGF5IGJ1dHRvbiBvbiB0aGUgcGFnZVxuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEF0dGVtcHRpbmcgdG8gY2xpY2sgcGxheSBidXR0b24uLi4nKTtcbiAgICAgICAgY29uc3QgcGxheUJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvblt0aXRsZSo9XCJQbGF5XCJdLCBidXR0b25bYXJpYS1sYWJlbCo9XCJQbGF5XCJdLCAucGxheUNvbnRyb2wsIC5wbGF5QnV0dG9uLCBbY2xhc3MqPVwicGxheS1idXR0b25cIl0nKTtcbiAgICAgICAgaWYgKHBsYXlCdXR0b24pIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZvdW5kIHBsYXkgYnV0dG9uLCBjbGlja2luZyBpdCcpO1xuICAgICAgICAgIChwbGF5QnV0dG9uIGFzIEhUTUxFbGVtZW50KS5jbGljaygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIGN1cnJlbnQgdGltZVxuICAgICAgY29uc3QgdXBkYXRlVGltZSA9ICgpID0+IHtcbiAgICAgICAgc2V0Q3VycmVudFRpbWUoYXVkaW8uY3VycmVudFRpbWUpO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIHVwZGF0ZVRpbWUpO1xuICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCAoKSA9PiB7XG4gICAgICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgICAgIGF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB1cGRhdGVUaW1lKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBNZXRob2QgMzogVHJ5IFNvdW5kQ2xvdWQgc3BlY2lmaWMgc2VsZWN0b3JzXG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE5vIGF1ZGlvIGVsZW1lbnRzIGZvdW5kLCB0cnlpbmcgU291bmRDbG91ZC1zcGVjaWZpYyBhcHByb2FjaCcpO1xuICAgICAgY29uc3QgcGxheUJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5wbGF5Q29udHJvbCwgLnNjLWJ1dHRvbi1wbGF5LCBidXR0b25bdGl0bGUqPVwiUGxheVwiXScpO1xuICAgICAgaWYgKHBsYXlCdXR0b24pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGb3VuZCBTb3VuZENsb3VkIHBsYXkgYnV0dG9uLCBjbGlja2luZyBpdCcpO1xuICAgICAgICAocGxheUJ1dHRvbiBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFdhaXQgYSBiaXQgYW5kIHRoZW4gbG9vayBmb3IgYXVkaW8gZWxlbWVudCBhZ2FpblxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICBjb25zdCBuZXdBdWRpb0VsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnYXVkaW8nKTtcbiAgICAgICAgICBpZiAobmV3QXVkaW9FbGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZvdW5kIGF1ZGlvIGVsZW1lbnQgYWZ0ZXIgY2xpY2tpbmcgcGxheScpO1xuICAgICAgICAgICAgY29uc3QgYXVkaW8gPSBuZXdBdWRpb0VsZW1lbnRzWzBdIGFzIEhUTUxBdWRpb0VsZW1lbnQ7XG4gICAgICAgICAgICBzZXRBdWRpb1JlZihhdWRpbyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFVwZGF0ZSBjdXJyZW50IHRpbWVcbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZVRpbWUgPSAoKSA9PiB7XG4gICAgICAgICAgICAgIHNldEN1cnJlbnRUaW1lKGF1ZGlvLmN1cnJlbnRUaW1lKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB1cGRhdGVUaW1lKTtcbiAgICAgICAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgKCkgPT4ge1xuICAgICAgICAgICAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgICAgICAgICAgICBhdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdXBkYXRlVGltZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIDUwMCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUNsb3NlID0gKCkgPT4ge1xuICAgIC8vIFN0b3Agc2Vzc2lvbiBpZiBhY3RpdmVcbiAgICBjb25zdCBzZXNzaW9uID0ga2FyYW9rZVNlc3Npb24oKTtcbiAgICBpZiAoc2Vzc2lvbikge1xuICAgICAgc2Vzc2lvbi5zdG9wU2Vzc2lvbigpO1xuICAgIH1cbiAgICBcbiAgICBzZXRTaG93S2FyYW9rZShmYWxzZSk7XG4gICAgc2V0S2FyYW9rZURhdGEobnVsbCk7XG4gICAgc2V0U2Vzc2lvblN0YXJ0ZWQoZmFsc2UpO1xuICAgIHNldEthcmFva2VTZXNzaW9uKG51bGwpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZU1pbmltaXplID0gKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTWluaW1pemUga2FyYW9rZSB3aWRnZXQnKTtcbiAgICBzZXRJc01pbmltaXplZCh0cnVlKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVSZXN0b3JlID0gKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUmVzdG9yZSBrYXJhb2tlIHdpZGdldCcpO1xuICAgIHNldElzTWluaW1pemVkKGZhbHNlKTtcbiAgfTtcblxuICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlbmRlciBzdGF0ZTonLCB7XG4gICAgc2hvd0thcmFva2U6IHNob3dLYXJhb2tlKCksXG4gICAgY3VycmVudFRyYWNrOiBjdXJyZW50VHJhY2soKSxcbiAgICBrYXJhb2tlRGF0YToga2FyYW9rZURhdGEoKSxcbiAgICBsb2FkaW5nOiBsb2FkaW5nKClcbiAgfSk7XG5cblxuICByZXR1cm4gKFxuICAgIDw+XG4gICAgICB7LyogTWluaW1pemVkIHN0YXRlICovfVxuICAgICAgPFNob3cgd2hlbj17c2hvd0thcmFva2UoKSAmJiBjdXJyZW50VHJhY2soKSAmJiBpc01pbmltaXplZCgpfT5cbiAgICAgICAgPE1pbmltaXplZEthcmFva2Ugb25DbGljaz17aGFuZGxlUmVzdG9yZX0gLz5cbiAgICAgIDwvU2hvdz5cblxuICAgICAgey8qIEZ1bGwgd2lkZ2V0IHN0YXRlICovfVxuICAgICAgPFNob3cgd2hlbj17c2hvd0thcmFva2UoKSAmJiBjdXJyZW50VHJhY2soKSAmJiAhaXNNaW5pbWl6ZWQoKX0gZmFsbGJhY2s9e1xuICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdub25lJyB9fT5cbiAgICAgICAgICB7Y29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBOb3Qgc2hvd2luZyAtIHNob3dLYXJhb2tlOicsIHNob3dLYXJhb2tlKCksICdjdXJyZW50VHJhY2s6JywgY3VycmVudFRyYWNrKCkpfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIH0+XG4gICAgICAgIDxkaXYgc3R5bGU9e3tcbiAgICAgICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgICAgICB0b3A6ICcyMHB4JyxcbiAgICAgICAgICByaWdodDogJzIwcHgnLFxuICAgICAgICAgIGJvdHRvbTogJzIwcHgnLFxuICAgICAgICAgIHdpZHRoOiAnNDgwcHgnLFxuICAgICAgICAgICd6LWluZGV4JzogJzk5OTk5JyxcbiAgICAgICAgICBvdmVyZmxvdzogJ2hpZGRlbicsXG4gICAgICAgICAgJ2JvcmRlci1yYWRpdXMnOiAnMTZweCcsXG4gICAgICAgICAgJ2JveC1zaGFkb3cnOiAnMCAyNXB4IDUwcHggLTEycHggcmdiYSgwLCAwLCAwLCAwLjYpJyxcbiAgICAgICAgICBkaXNwbGF5OiAnZmxleCcsXG4gICAgICAgICAgJ2ZsZXgtZGlyZWN0aW9uJzogJ2NvbHVtbidcbiAgICAgICAgfX0+XG4gICAgICAgICAge2NvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUmVuZGVyaW5nIHdpdGggY29tcGxldGlvbiBkYXRhOicsIGNvbXBsZXRpb25EYXRhKCkpfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJoLWZ1bGwgYmctc3VyZmFjZSByb3VuZGVkLTJ4bCBvdmVyZmxvdy1oaWRkZW4gZmxleCBmbGV4LWNvbFwiPlxuICAgICAgICAgICAgey8qIEhlYWRlciB3aXRoIG1pbmltaXplIGFuZCBjbG9zZSBidXR0b25zICovfVxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktZW5kIHAtMiBiZy1zdXJmYWNlIGJvcmRlci1iIGJvcmRlci1zdWJ0bGVcIiBzdHlsZT17eyBoZWlnaHQ6ICc0OHB4JyB9fT5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17c2hvd1ByYWN0aWNlKCl9PlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93UHJhY3RpY2UoZmFsc2UpfVxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctMTAgaC0xMCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzIGhvdmVyOmJnLXdoaXRlLzEwXCJcbiAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgY29sb3I6ICcjYThhOGE4JyB9fVxuICAgICAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiQ2xvc2UgUHJhY3RpY2VcIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICA8c3ZnIHdpZHRoPVwiMjBcIiBoZWlnaHQ9XCIyMFwiIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPVwiTTE1IDVMNSAxNU01IDVMMTUgMTVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIvPlxuICAgICAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVNaW5pbWl6ZX1cbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy0xMCBoLTEwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbGcgdHJhbnNpdGlvbi1jb2xvcnMgaG92ZXI6Ymctd2hpdGUvMTBcIlxuICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgY29sb3I6ICcjYThhOGE4JyB9fVxuICAgICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIk1pbmltaXplXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8c3ZnIHdpZHRoPVwiMjRcIiBoZWlnaHQ9XCIyNFwiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj5cbiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD1cIk02IDEyaDEyXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiM1wiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIi8+XG4gICAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgey8qIE1haW4gY29udGVudCBhcmVhICovfVxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBtaW4taC0wIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtjb21wbGV0aW9uRGF0YSgpfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17IWxvYWRpbmcoKX0gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGgtZnVsbCBiZy1iYXNlXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhbmltYXRlLXNwaW4gcm91bmRlZC1mdWxsIGgtMTIgdy0xMiBib3JkZXItYi0yIGJvcmRlci1hY2NlbnQtcHJpbWFyeSBteC1hdXRvIG1iLTRcIj48L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc2Vjb25kYXJ5XCI+TG9hZGluZyBseXJpY3MuLi48L3A+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e2thcmFva2VEYXRhKCk/Lmx5cmljcz8ubGluZXN9IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGgtZnVsbCBwLThcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0yXCI+Tm8gbHlyaWNzIGF2YWlsYWJsZTwvcD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zbSB0ZXh0LXRlcnRpYXJ5XCI+VHJ5IGEgZGlmZmVyZW50IHNvbmc8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImgtZnVsbCBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBtaW4taC0wIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPEV4dGVuc2lvbkthcmFva2VWaWV3XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3JlPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuc2NvcmUoKSA6IDB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJhbms9ezF9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGx5cmljcz17a2FyYW9rZURhdGEoKT8ubHlyaWNzPy5saW5lcyB8fCBbXX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudFRpbWU9e2thcmFva2VTZXNzaW9uKCkgPyBrYXJhb2tlU2Vzc2lvbigpIS5jdXJyZW50VGltZSgpIDogY3VycmVudFRpbWUoKSAqIDEwMDB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxlYWRlcmJvYXJkPXtbXX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgaXNQbGF5aW5nPXtrYXJhb2tlU2Vzc2lvbigpID8gKGthcmFva2VTZXNzaW9uKCkhLmlzUGxheWluZygpIHx8IGthcmFva2VTZXNzaW9uKCkhLmNvdW50ZG93bigpICE9PSBudWxsKSA6IChpc1BsYXlpbmcoKSB8fCBjb3VudGRvd24oKSAhPT0gbnVsbCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uU3RhcnQ9e2hhbmRsZVN0YXJ0fVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvblNwZWVkQ2hhbmdlPXsoc3BlZWQpID0+IGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU3BlZWQgY2hhbmdlZDonLCBzcGVlZCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlzUmVjb3JkaW5nPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuaXNSZWNvcmRpbmcoKSA6IGZhbHNlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBsaW5lU2NvcmVzPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEubGluZVNjb3JlcygpIDogW119XG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgIHsvKiBDb3VudGRvd24gb3ZlcmxheSAqL31cbiAgICAgICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuY291bnRkb3duKCkgIT09IG51bGwgOiBjb3VudGRvd24oKSAhPT0gbnVsbH0+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWJzb2x1dGUgaW5zZXQtMCBiZy1ibGFjay84MCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB6LTUwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTh4bCBmb250LWJvbGQgdGV4dC13aGl0ZSBhbmltYXRlLXB1bHNlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLmNvdW50ZG93bigpIDogY291bnRkb3duKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXhsIHRleHQtd2hpdGUvODAgbXQtNFwiPkdldCByZWFkeSE8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgICAgey8qIENvbXBsZXRpb24gVmlldyBvciBQcmFjdGljZSBWaWV3ICovfVxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Nob3dQcmFjdGljZSgpfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICA8STE4blByb3ZpZGVyPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaC1mdWxsIGZsZXggZmxleC1jb2xcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXshY29tcGxldGlvbkRhdGEoKS5pc0xvYWRpbmd9IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBoLWZ1bGwgYmctYmFzZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYW5pbWF0ZS1zcGluIHJvdW5kZWQtZnVsbCBoLTE2IHctMTYgYm9yZGVyLWItMiBib3JkZXItYWNjZW50LXByaW1hcnkgbXgtYXV0byBtYi00XCI+PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5XCI+Q2FsY3VsYXRpbmcgeW91ciBmaW5hbCBzY29yZS4uLjwvcD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc20gdGV4dC10ZXJ0aWFyeSBtdC0yXCI+QW5hbHl6aW5nIGZ1bGwgcGVyZm9ybWFuY2U8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxDb21wbGV0aW9uVmlld1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImgtZnVsbFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3JlPXtjb21wbGV0aW9uRGF0YSgpLnNjb3JlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICByYW5rPXsxfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBzcGVlZD17JzF4J31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmVlZGJhY2tUZXh0PXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0aW9uRGF0YSgpLnNjb3JlID49IDk1ID8gXCJQZXJmZWN0ISBZb3UgbmFpbGVkIGl0IVwiIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0aW9uRGF0YSgpLnNjb3JlID49IDg1ID8gXCJFeGNlbGxlbnQgcGVyZm9ybWFuY2UhXCIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRpb25EYXRhKCkuc2NvcmUgPj0gNzAgPyBcIkdyZWF0IGpvYiFcIiA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGlvbkRhdGEoKS5zY29yZSA+PSA1MCA/IFwiR29vZCBlZmZvcnQhXCIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiS2VlcCBwcmFjdGljaW5nIVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25QcmFjdGljZT17KCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUHJhY3RpY2UgZXJyb3JzIGNsaWNrZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTaG93UHJhY3RpY2UodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L0kxOG5Qcm92aWRlcj5cbiAgICAgICAgICAgICAgICB9PlxuICAgICAgICAgICAgICAgICAgey8qIFByYWN0aWNlIFZpZXcgKi99XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaC1mdWxsIG92ZXJmbG93LXktYXV0b1wiPlxuICAgICAgICAgICAgICAgICAgICA8UHJhY3RpY2VWaWV3XG4gICAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbklkPXtjb21wbGV0aW9uRGF0YSgpPy5zZXNzaW9uSWR9XG4gICAgICAgICAgICAgICAgICAgICAgb25CYWNrPXsoKSA9PiBzZXRTaG93UHJhY3RpY2UoZmFsc2UpfVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L1Nob3c+XG4gICAgPC8+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNoYWRvd1Jvb3RVaSB9IGZyb20gJ3d4dC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdCc7XG5pbXBvcnQgeyBkZWZpbmVDb250ZW50U2NyaXB0IH0gZnJvbSAnd3h0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdCc7XG5pbXBvcnQgdHlwZSB7IENvbnRlbnRTY3JpcHRDb250ZXh0IH0gZnJvbSAnd3h0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQnO1xuaW1wb3J0IHsgcmVuZGVyIH0gZnJvbSAnc29saWQtanMvd2ViJztcbmltcG9ydCB7IENvbnRlbnRBcHAgfSBmcm9tICcuLi9zcmMvYXBwcy9jb250ZW50L0NvbnRlbnRBcHAnO1xuaW1wb3J0ICcuLi9zcmMvc3R5bGVzL2V4dGVuc2lvbi5jc3MnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWycqOi8vc291bmRjbG91ZC5jb20vKicsICcqOi8vc291bmRjbG9hay5jb20vKicsICcqOi8vc2MubWFpZC56b25lLyonLCAnKjovLyoubWFpZC56b25lLyonXSxcbiAgcnVuQXQ6ICdkb2N1bWVudF9pZGxlJyxcbiAgY3NzSW5qZWN0aW9uTW9kZTogJ3VpJyxcblxuICBhc3luYyBtYWluKGN0eDogQ29udGVudFNjcmlwdENvbnRleHQpIHtcbiAgICAvLyBPbmx5IHJ1biBpbiB0b3AtbGV2ZWwgZnJhbWUgdG8gYXZvaWQgZHVwbGljYXRlIHByb2Nlc3NpbmcgaW4gaWZyYW1lc1xuICAgIGlmICh3aW5kb3cudG9wICE9PSB3aW5kb3cuc2VsZikge1xuICAgICAgY29uc29sZS5sb2coJ1tTY2FybGV0dCBDU10gTm90IHRvcC1sZXZlbCBmcmFtZSwgc2tpcHBpbmcgY29udGVudCBzY3JpcHQuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ1tTY2FybGV0dCBDU10gU2NhcmxldHQgS2FyYW9rZSBjb250ZW50IHNjcmlwdCBsb2FkZWQnKTtcblxuICAgIC8vIENyZWF0ZSBzaGFkb3cgRE9NIGFuZCBtb3VudCBrYXJhb2tlIHdpZGdldFxuICAgIGNvbnN0IHVpID0gYXdhaXQgY3JlYXRlU2hhZG93Um9vdFVpKGN0eCwge1xuICAgICAgbmFtZTogJ3NjYXJsZXR0LWthcmFva2UtdWknLFxuICAgICAgcG9zaXRpb246ICdvdmVybGF5JyxcbiAgICAgIGFuY2hvcjogJ2JvZHknLFxuICAgICAgb25Nb3VudDogYXN5bmMgKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gb25Nb3VudCBjYWxsZWQsIGNvbnRhaW5lcjonLCBjb250YWluZXIpO1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBTaGFkb3cgcm9vdDonLCBjb250YWluZXIuZ2V0Um9vdE5vZGUoKSk7XG4gICAgICAgIFxuICAgICAgICAvLyBMb2cgd2hhdCBzdHlsZXNoZWV0cyBhcmUgYXZhaWxhYmxlXG4gICAgICAgIGNvbnN0IHNoYWRvd1Jvb3QgPSBjb250YWluZXIuZ2V0Um9vdE5vZGUoKSBhcyBTaGFkb3dSb290O1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBTaGFkb3cgcm9vdCBzdHlsZXNoZWV0czonLCBzaGFkb3dSb290LnN0eWxlU2hlZXRzPy5sZW5ndGgpO1xuICAgICAgICBcbiAgICAgICAgLy8gQ3JlYXRlIHdyYXBwZXIgZGl2IChDb250ZW50QXBwIHdpbGwgaGFuZGxlIHBvc2l0aW9uaW5nIGJhc2VkIG9uIHN0YXRlKVxuICAgICAgICBjb25zdCB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gJ2thcmFva2Utd2lkZ2V0LWNvbnRhaW5lcic7XG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh3cmFwcGVyKTtcblxuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBXcmFwcGVyIGNyZWF0ZWQgYW5kIGFwcGVuZGVkOicsIHdyYXBwZXIpO1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBXcmFwcGVyIGNvbXB1dGVkIHN0eWxlczonLCB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh3cmFwcGVyKSk7XG5cbiAgICAgICAgLy8gUmVuZGVyIENvbnRlbnRBcHAgY29tcG9uZW50ICh3aGljaCB1c2VzIEV4dGVuc2lvbkthcmFva2VWaWV3KVxuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBBYm91dCB0byByZW5kZXIgQ29udGVudEFwcCcpO1xuICAgICAgICBjb25zdCBkaXNwb3NlID0gcmVuZGVyKCgpID0+IDxDb250ZW50QXBwIC8+LCB3cmFwcGVyKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIENvbnRlbnRBcHAgcmVuZGVyZWQsIGRpc3Bvc2UgZnVuY3Rpb246JywgZGlzcG9zZSk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gZGlzcG9zZTtcbiAgICAgIH0sXG4gICAgICBvblJlbW92ZTogKGNsZWFudXA/OiAoKSA9PiB2b2lkKSA9PiB7XG4gICAgICAgIGNsZWFudXA/LigpO1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIE1vdW50IHRoZSBVSVxuICAgIHVpLm1vdW50KCk7XG4gICAgY29uc29sZS5sb2coJ1tTY2FybGV0dCBDU10gS2FyYW9rZSBvdmVybGF5IG1vdW50ZWQnKTtcbiAgfSxcbn0pOyIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIiwiaW1wb3J0IGNvbW1vbiBmcm9tICcuL2NvbW1vbi5qc29uJztcbmltcG9ydCBrYXJhb2tlIGZyb20gJy4va2FyYW9rZS5qc29uJztcbmltcG9ydCBkaXNwbGF5IGZyb20gJy4vZGlzcGxheS5qc29uJztcbmltcG9ydCB0eXBlIHsgVHJhbnNsYXRpb25zIH0gZnJvbSAnLi4vLi4vdHlwZXMnO1xuXG5jb25zdCB0cmFuc2xhdGlvbnM6IFRyYW5zbGF0aW9ucyA9IHtcbiAgY29tbW9uLFxuICBrYXJhb2tlLFxuICBkaXNwbGF5LFxufTtcblxuZXhwb3J0IGRlZmF1bHQgdHJhbnNsYXRpb25zOyIsImltcG9ydCBjb21tb24gZnJvbSAnLi9jb21tb24uanNvbic7XG5pbXBvcnQga2FyYW9rZSBmcm9tICcuL2thcmFva2UuanNvbic7XG5pbXBvcnQgZGlzcGxheSBmcm9tICcuL2Rpc3BsYXkuanNvbic7XG5pbXBvcnQgdHlwZSB7IFRyYW5zbGF0aW9ucyB9IGZyb20gJy4uLy4uL3R5cGVzJztcblxuY29uc3QgdHJhbnNsYXRpb25zOiBUcmFuc2xhdGlvbnMgPSB7XG4gIGNvbW1vbixcbiAga2FyYW9rZSxcbiAgZGlzcGxheSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHRyYW5zbGF0aW9uczsiXSwibmFtZXMiOlsidmFsdWUiLCJlcnJvciIsImNoaWxkcmVuIiwibWVtbyIsImluZGV4IiwicmVzdWx0IiwiaSIsInNvdXJjZXMiLCJkaXNwb3NlIiwiZG9jdW1lbnQiLCJhZGRFdmVudExpc3RlbmVyIiwiYnJvd3NlciIsIl9icm93c2VyIiwiaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSIsInN0eWxlIiwicHJpbnQiLCJsb2dnZXIiLCJfYSIsIl9iIiwicmVtb3ZlRGV0ZWN0b3IiLCJtb3VudERldGVjdG9yIiwiZGVmaW5pdGlvbiIsIl8kZGVsZWdhdGVFdmVudHMiLCJTY29yZVBhbmVsIiwicHJvcHMiLCJfZWwkIiwiX3RtcGwkIiwiX2VsJDIiLCJmaXJzdENoaWxkIiwiX2VsJDMiLCJfZWwkNCIsIm5leHRTaWJsaW5nIiwiX2VsJDUiLCJzY29yZSIsInJhbmsiLCJfJGNsYXNzTmFtZSIsImNuIiwiY2xhc3MiLCJCdXR0b24iLCJsb2NhbCIsIm90aGVycyIsInNwbGl0UHJvcHMiLCJ2YXJpYW50Iiwic2l6ZSIsIl90bXBsJDMiLCJfJHNwcmVhZCIsIl8kbWVyZ2VQcm9wcyIsImRpc2FibGVkIiwibG9hZGluZyIsImZ1bGxXaWR0aCIsIl8kY3JlYXRlQ29tcG9uZW50IiwiU2hvdyIsIndoZW4iLCJsZWZ0SWNvbiIsIl90bXBsJDIiLCJyaWdodEljb24iLCJMeXJpY3NEaXNwbGF5IiwiY3VycmVudExpbmVJbmRleCIsInNldEN1cnJlbnRMaW5lSW5kZXgiLCJjcmVhdGVTaWduYWwiLCJjb250YWluZXJSZWYiLCJnZXRMaW5lU2NvcmUiLCJsaW5lSW5kZXgiLCJsaW5lU2NvcmVzIiwiZmluZCIsInMiLCJnZXRTY29yZVN0eWxlIiwiY29sb3IiLCJjcmVhdGVFZmZlY3QiLCJjdXJyZW50VGltZSIsImx5cmljcyIsImxlbmd0aCIsInRpbWUiLCJUSU1JTkdfT0ZGU0VUIiwiYWRqdXN0ZWRUaW1lIiwiZm91bmRJbmRleCIsImxpbmUiLCJlbmRUaW1lIiwic3RhcnRUaW1lIiwiZHVyYXRpb24iLCJwcmV2SW5kZXgiLCJNYXRoIiwiYWJzIiwiY29uc29sZSIsImxvZyIsImZyb20iLCJ0byIsInRpbWVJblNlY29uZHMiLCJqdW1wIiwid2FybiIsImZyb21MaW5lIiwidG9MaW5lIiwiaXNQbGF5aW5nIiwibGluZUVsZW1lbnRzIiwicXVlcnlTZWxlY3RvckFsbCIsImN1cnJlbnRFbGVtZW50IiwiY29udGFpbmVySGVpZ2h0IiwiY2xpZW50SGVpZ2h0IiwibGluZVRvcCIsIm9mZnNldFRvcCIsImxpbmVIZWlnaHQiLCJvZmZzZXRIZWlnaHQiLCJ0YXJnZXRTY3JvbGxUb3AiLCJzY3JvbGxUbyIsInRvcCIsImJlaGF2aW9yIiwiX3JlZiQiLCJfJHVzZSIsIkZvciIsImVhY2giLCJsaW5lU2NvcmUiLCJzY29yZVN0eWxlIiwidGV4dCIsIl8kZWZmZWN0IiwiX3AkIiwiX3YkIiwiX3YkMiIsIl92JDMiLCJlIiwiXyRzZXRBdHRyaWJ1dGUiLCJ0IiwiYSIsInNldFByb3BlcnR5IiwicmVtb3ZlUHJvcGVydHkiLCJ1bmRlZmluZWQiLCJMZWFkZXJib2FyZFBhbmVsIiwiZW50cmllcyIsImZhbGxiYWNrIiwiZW50cnkiLCJfZWwkNiIsIl9lbCQ3IiwiXyRpbnNlcnQiLCJ1c2VybmFtZSIsInRvTG9jYWxlU3RyaW5nIiwiaXNDdXJyZW50VXNlciIsIl92JDQiLCJvIiwic3BlZWRzIiwiU3BsaXRCdXR0b24iLCJjdXJyZW50U3BlZWRJbmRleCIsInNldEN1cnJlbnRTcGVlZEluZGV4IiwiY3VycmVudFNwZWVkIiwiY3ljbGVTcGVlZCIsInN0b3BQcm9wYWdhdGlvbiIsIm5leHRJbmRleCIsIm5ld1NwZWVkIiwib25TcGVlZENoYW5nZSIsIl8kYWRkRXZlbnRMaXN0ZW5lciIsIm9uU3RhcnQiLCIkJGNsaWNrIiwiX3YkNSIsIlRhYnNDb250ZXh0IiwiY3JlYXRlQ29udGV4dCIsIlRhYnMiLCJhY3RpdmVUYWIiLCJzZXRBY3RpdmVUYWIiLCJkZWZhdWx0VGFiIiwidGFicyIsImlkIiwiZmlyc3RUYWJJZCIsImhhbmRsZVRhYkNoYW5nZSIsIm9uVGFiQ2hhbmdlIiwiY29udGV4dFZhbHVlIiwiUHJvdmlkZXIiLCJUYWJzTGlzdCIsIlRhYnNUcmlnZ2VyIiwiY29udGV4dCIsInVzZUNvbnRleHQiLCJpc0FjdGl2ZSIsIlRhYnNDb250ZW50IiwiRmlyZUVtb2ppQW5pbWF0aW9uIiwic2hvd0ZpcmUiLCJzZXRTaG93RmlyZSIsImZpcmVYIiwic2V0RmlyZVgiLCJsYXN0TGluZUluZGV4IiwiaGlkZVRpbWVyIiwicmFuZG9tIiwic2V0VGltZW91dCIsIm9uQ2xlYW51cCIsInN0eWxlcyIsImZpcmVDb250YWluZXIiLCJmaXJlRW1vamkiLCJFeHRlbnNpb25LYXJhb2tlVmlldyIsImdldExhdGVzdEhpZ2hTY29yZUxpbmUiLCJzY29yZXMiLCJsYXRlc3QiLCJfdG1wbCQ1IiwiX3RtcGwkNiIsIl9lbCQ4IiwibGFiZWwiLCJfdG1wbCQ0IiwibGVhZGVyYm9hcmQiLCJJMThuQ29udGV4dCIsIkkxOG5Qcm92aWRlciIsImxvY2FsZSIsInNldExvY2FsZSIsImRlZmF1bHRMb2NhbGUiLCJ0cmFuc2xhdGlvbnMiLCJzZXRUcmFuc2xhdGlvbnMiLCJjdXJyZW50TG9jYWxlIiwibW9kdWxlIiwiZGVmYXVsdCIsIl9lIiwia2V5IiwicGFyYW1zIiwia2V5cyIsInNwbGl0IiwiayIsInJlcGxhY2UiLCJfIiwiU3RyaW5nIiwiZGlyIiwibnVtYmVyRm9ybWF0dGVyIiwiY3JlYXRlTWVtbyIsIkludGwiLCJOdW1iZXJGb3JtYXQiLCJmb3JtYXROdW1iZXIiLCJudW0iLCJmb3JtYXQiLCJmb3JtYXREYXRlIiwiZGF0ZSIsIm9wdGlvbnMiLCJEYXRlVGltZUZvcm1hdCIsInVzZUkxOG4iLCJFcnJvciIsIkNvbXBsZXRpb25WaWV3IiwiZ2V0RmVlZGJhY2tUZXh0IiwiZmVlZGJhY2tUZXh0IiwiX2VsJDkiLCJfZWwkMSIsIl9lbCQxMCIsIl9lbCQxMSIsIl9lbCQxMiIsIl9lbCQxMyIsInNwZWVkIiwib25QcmFjdGljZSIsIl9lbCQxNCIsIm9uQ2xpY2siLCJzYW1wbGVSYXRlIiwib2Zmc2V0IiwiUHJvZ3Jlc3NCYXIiLCJwZXJjZW50YWdlIiwibWluIiwibWF4IiwiY3VycmVudCIsInRvdGFsIiwiTWluaW1pemVkS2FyYW9rZSIsImN1cnJlbnRUYXJnZXQiLCJ0cmFuc2Zvcm0iLCJwIiwiUHJhY3RpY2VIZWFkZXIiLCJvbkV4aXQiLCJJY29uWFJlZ3VsYXIiLCJ0aXRsZSIsIkV4ZXJjaXNlRm9vdGVyIiwiaXNSZWNvcmRpbmciLCJvblN0b3AiLCJpc1Byb2Nlc3NpbmciLCJjYW5TdWJtaXQiLCJvblJlY29yZCIsIm9uU3VibWl0IiwiRXhlcmNpc2VUZW1wbGF0ZSIsIl9jJCIsIl8kbWVtbyIsImluc3RydWN0aW9uVGV4dCIsIlJlYWRBbG91ZCIsInByb21wdCIsInVzZXJUcmFuc2NyaXB0Iiwia2FyYW9rZUFwaSIsIkthcmFva2VBcGlTZXJ2aWNlIiwiUHJhY3RpY2VWaWV3IiwiY3VycmVudEV4ZXJjaXNlSW5kZXgiLCJzZXRDdXJyZW50RXhlcmNpc2VJbmRleCIsInNldElzUmVjb3JkaW5nIiwic2V0SXNQcm9jZXNzaW5nIiwic2V0VXNlclRyYW5zY3JpcHQiLCJjdXJyZW50U2NvcmUiLCJzZXRDdXJyZW50U2NvcmUiLCJtZWRpYVJlY29yZGVyIiwic2V0TWVkaWFSZWNvcmRlciIsImF1ZGlvQ2h1bmtzIiwic2V0QXVkaW9DaHVua3MiLCJleGVyY2lzZXMiLCJjcmVhdGVSZXNvdXJjZSIsInVybCIsInNlc3Npb25JZCIsInJlc3BvbnNlIiwiZmV0Y2giLCJvayIsImVycm9yVGV4dCIsInN0YXR1cyIsImRhdGEiLCJqc29uIiwiZXhlcmNpc2VMaXN0IiwiaGFuZGxlU3RhcnRSZWNvcmRpbmciLCJzdHJlYW0iLCJuYXZpZ2F0b3IiLCJtZWRpYURldmljZXMiLCJnZXRVc2VyTWVkaWEiLCJhdWRpbyIsImVjaG9DYW5jZWxsYXRpb24iLCJub2lzZVN1cHByZXNzaW9uIiwiYXV0b0dhaW5Db250cm9sIiwibWltZVR5cGUiLCJNZWRpYVJlY29yZGVyIiwiaXNUeXBlU3VwcG9ydGVkIiwicmVjb3JkZXIiLCJjaHVua3MiLCJvbmRhdGFhdmFpbGFibGUiLCJldmVudCIsInB1c2giLCJvbnN0b3AiLCJhdWRpb0Jsb2IiLCJCbG9iIiwidHlwZSIsInByb2Nlc3NSZWNvcmRpbmciLCJnZXRUcmFja3MiLCJmb3JFYWNoIiwidHJhY2siLCJzdG9wIiwic3RhcnQiLCJibG9iIiwicmVhZGVyIiwiRmlsZVJlYWRlciIsImJhc2U2NCIsIlByb21pc2UiLCJyZXNvbHZlIiwib25sb2FkZW5kIiwiYmFzZTY0U3RyaW5nIiwicmVhZEFzRGF0YVVSTCIsIm1ldGhvZCIsImhlYWRlcnMiLCJib2R5IiwiSlNPTiIsInN0cmluZ2lmeSIsImF1ZGlvQmFzZTY0IiwiZXhwZWN0ZWRUZXh0IiwiY3VycmVudEV4ZXJjaXNlIiwiZnVsbF9saW5lIiwidHJhbnNjcmlwdCIsImNhbGN1bGF0ZVNjb3JlIiwiaGFuZGxlU3RvcFJlY29yZGluZyIsInN0YXRlIiwiZXhwZWN0ZWQiLCJhY3R1YWwiLCJleHBlY3RlZFdvcmRzIiwidG9Mb3dlckNhc2UiLCJhY3R1YWxXb3JkcyIsIm1hdGNoZXMiLCJyb3VuZCIsImhhbmRsZVN1Ym1pdCIsImNhcmRfaWRzIiwiZXhlcmNpc2VJZCIsImNhcmRTY29yZXMiLCJtYXAiLCJjYXJkSWQiLCJvbkJhY2siLCJleGVyY2lzZSIsInRyaW0iLCJDb250ZW50QXBwIiwiY3VycmVudFRyYWNrIiwic2V0Q3VycmVudFRyYWNrIiwiYXV0aFRva2VuIiwic2V0QXV0aFRva2VuIiwic2hvd0thcmFva2UiLCJzZXRTaG93S2FyYW9rZSIsImthcmFva2VEYXRhIiwic2V0S2FyYW9rZURhdGEiLCJzZXRMb2FkaW5nIiwic2Vzc2lvblN0YXJ0ZWQiLCJzZXRTZXNzaW9uU3RhcnRlZCIsImlzTWluaW1pemVkIiwic2V0SXNNaW5pbWl6ZWQiLCJjb3VudGRvd24iLCJzZXRDb3VudGRvd24iLCJzZXRJc1BsYXlpbmciLCJzZXRDdXJyZW50VGltZSIsImF1ZGlvUmVmIiwic2V0QXVkaW9SZWYiLCJrYXJhb2tlU2Vzc2lvbiIsInNldEthcmFva2VTZXNzaW9uIiwiY29tcGxldGlvbkRhdGEiLCJzZXRDb21wbGV0aW9uRGF0YSIsInNob3dQcmFjdGljZSIsInNldFNob3dQcmFjdGljZSIsIm9uTW91bnQiLCJ0b2tlbiIsImdldEF1dGhUb2tlbiIsImNsZWFudXAiLCJ0cmFja0RldGVjdG9yIiwid2F0Y2hGb3JDaGFuZ2VzIiwiZmV0Y2hLYXJhb2tlRGF0YSIsImdldEthcmFva2VEYXRhIiwidHJhY2tJZCIsImFydGlzdCIsImhhbmRsZVN0YXJ0IiwibGluZXMiLCJ0cmFja1RpdGxlIiwic29uZ0RhdGEiLCJzb25nIiwiaGFzTHlyaWNzIiwibmV3U2Vzc2lvbiIsInVzZUthcmFva2VTZXNzaW9uIiwiYWxidW0iLCJzb25nQ2F0YWxvZ0lkIiwic29uZ19jYXRhbG9nX2lkIiwiYXVkaW9FbGVtZW50IiwiYXBpVXJsIiwib25Db21wbGV0ZSIsInJlc3VsdHMiLCJwYXVzZSIsInN0YXJ0U2Vzc2lvbiIsInNldEF1ZGlvRWxlbWVudCIsImNvdW50ZG93bkludGVydmFsIiwic2V0SW50ZXJ2YWwiLCJjbGVhckludGVydmFsIiwic3RhcnRBdWRpb1BsYXliYWNrIiwiYXVkaW9FbGVtZW50cyIsInNyYyIsInBhdXNlZCIsInNlc3Npb24iLCJhdWRpb1Byb2Nlc3NvciIsImlzUmVhZHkiLCJpbml0aWFsaXplIiwiY2F0Y2giLCJwbGF5IiwidGhlbiIsImVyciIsInBsYXlCdXR0b24iLCJxdWVyeVNlbGVjdG9yIiwiY2xpY2siLCJ1cGRhdGVUaW1lIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsIm5ld0F1ZGlvRWxlbWVudHMiLCJoYW5kbGVNaW5pbWl6ZSIsImhhbmRsZVJlc3RvcmUiLCJfdG1wbCQ3IiwiX3RtcGwkOCIsIl9lbCQwIiwiX2VsJDE1IiwiX3RtcGwkOSIsImlzTG9hZGluZyIsIl90bXBsJDAiLCJkZWZpbmVDb250ZW50U2NyaXB0IiwicnVuQXQiLCJjc3NJbmplY3Rpb25Nb2RlIiwibWFpbiIsImN0eCIsIndpbmRvdyIsInNlbGYiLCJ1aSIsImNyZWF0ZVNoYWRvd1Jvb3RVaSIsIm5hbWUiLCJwb3NpdGlvbiIsImFuY2hvciIsImNvbnRhaW5lciIsImdldFJvb3ROb2RlIiwic2hhZG93Um9vdCIsInN0eWxlU2hlZXRzIiwid3JhcHBlciIsImNyZWF0ZUVsZW1lbnQiLCJjbGFzc05hbWUiLCJhcHBlbmRDaGlsZCIsImdldENvbXB1dGVkU3R5bGUiLCJyZW5kZXIiLCJvblJlbW92ZSIsIm1vdW50IiwiY29tbW9uIiwia2FyYW9rZSIsImRpc3BsYXkiXSwibWFwcGluZ3MiOiI7Ozs7OztBQWdKQSxRQUFNLFNBQVM7QUFDZixRQUFNLFVBQVUsQ0FBQyxHQUFHLE1BQU0sTUFBTTtBQUNoQyxRQUFNLFNBQVMsT0FBTyxhQUFhO0FBQ25DLFFBQU0saUJBQWlCLE9BQU8sVUFBVTtBQUN4QyxRQUFNLFNBQVMsT0FBTyxhQUFhO0FBQ25DLFFBQU0sV0FBVyxPQUFPLHFCQUFxQjtBQUM3QyxRQUFNLGdCQUFnQjtBQUFBLElBQ3BCLFFBQVE7QUFBQSxFQUNWO0FBRUEsTUFBSSxhQUFhO0FBQ2pCLFFBQU0sUUFBUTtBQUNkLFFBQU0sVUFBVTtBQUNoQixRQUFNLFVBQVUsQ0FLaEI7QUFDQSxRQUFNLFVBQVUsQ0FBQztBQUNqQixNQUFJLFFBQVE7QUFDWixNQUFJLGFBQWE7QUFFakIsTUFBSSx1QkFBdUI7QUFDM0IsTUFBSSxXQUFXO0FBQ2YsTUFBSSxVQUFVO0FBQ2QsTUFBSSxVQUFVO0FBQ2QsTUFBSSxZQUFZO0FBT2hCLFdBQVMsV0FBVyxJQUFJLGVBQWU7QUFDckMsVUFBTSxXQUFXLFVBQ2YsUUFBUSxPQUNSLFVBQVUsR0FBRyxXQUFXLEdBQ3hCLFVBQVUsa0JBQWtCLFNBQVksUUFBUSxlQUNoRCxPQUFPLFVBQVU7QUFBQSxNQUNmLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLFNBQVM7QUFBQSxNQUNULE9BQU87QUFBQSxJQUFBLElBQ0o7QUFBQSxNQUNILE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLFNBQVMsVUFBVSxRQUFRLFVBQVU7QUFBQSxNQUNyQyxPQUFPO0FBQUEsSUFFVCxHQUFBLFdBQVcsVUFBVSxNQUFNLEdBQUcsTUFBTTtBQUM1QixZQUFBLElBQUksTUFBTSxvRUFBb0U7QUFBQSxJQUFBLENBQ3JGLElBQUssTUFBTSxHQUFHLE1BQU0sUUFB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TztBQUFBLFFBQ0w7QUFBQSxVQUNFLE1BQU0sc0JBQXFCO0FBQUEsVUFDM0IsbUJBQW1CLEtBQUs7QUFBQSxVQUN4QixXQUFXLEtBQUssT0FBUSxFQUFDLFNBQVMsRUFBRSxFQUFFLE1BQU0sQ0FBQztBQUFBLFFBQzlDO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNMO0FBQUEsSUFDRSx5QkFBeUIsT0FBTzs7QUFDOUIsWUFBTSx5QkFBdUJDLE1BQUEsTUFBTSxTQUFOLGdCQUFBQSxJQUFZLFVBQVMsc0JBQXFCO0FBQ3ZFLFlBQU0sd0JBQXNCQyxNQUFBLE1BQU0sU0FBTixnQkFBQUEsSUFBWSx1QkFBc0IsS0FBSztBQUNuRSxZQUFNLGlCQUFpQixDQUFDLEtBQUssbUJBQW1CLEtBQUksV0FBTSxTQUFOLG1CQUFZLFNBQVM7QUFDekUsYUFBTyx3QkFBd0IsdUJBQXVCO0FBQUEsSUFDMUQ7QUFBQSxJQUNFLHNCQUFzQixTQUFTO0FBQzdCLFVBQUksVUFBVTtBQUNkLFlBQU0sS0FBSyxDQUFDLFVBQVU7QUFDcEIsWUFBSSxLQUFLLHlCQUF5QixLQUFLLEdBQUc7QUFDeEMsZUFBSyxtQkFBbUIsSUFBSSxNQUFNLEtBQUssU0FBUztBQUNoRCxnQkFBTSxXQUFXO0FBQ2pCLG9CQUFVO0FBQ1YsY0FBSSxhQUFZLG1DQUFTLGtCQUFrQjtBQUMzQyxlQUFLLGtCQUFtQjtBQUFBLFFBQ2hDO0FBQUEsTUFDSztBQUNELHVCQUFpQixXQUFXLEVBQUU7QUFDOUIsV0FBSyxjQUFjLE1BQU0sb0JBQW9CLFdBQVcsRUFBRSxDQUFDO0FBQUEsSUFDL0Q7QUFBQSxFQUNBO0FBckpFLGdCQVpXLHVCQVlKLCtCQUE4QjtBQUFBLElBQ25DO0FBQUEsRUFDRDtBQWRJLE1BQU0sdUJBQU47Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0RQLFFBQU1vTCxpQkFBNkI7QUFBQSxJQUFBLFFBQ2pDOFE7QUFBQUEsSUFBQSxTQUNBQztBQUFBQSxJQUNBQyxTQUFBQTtBQUFBQSxFQUNGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0pBLFFBQU0sZUFBNkI7QUFBQSxJQUNqQztBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDRjs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsMSwyLDMsNCw1LDYsNyw4LDksMTAsMTEsMTIsMTMsMTQsMTUsMzUsNDksNTAsNTFdfQ==

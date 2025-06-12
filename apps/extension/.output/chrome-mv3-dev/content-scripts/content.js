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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL2Rpc3QvZGV2LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL3dlYi9kaXN0L2Rldi5qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWUvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnQvbGliL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbnkta2V5cy1tYXAvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvZGVmdS9kaXN0L2RlZnUubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0AxbmF0c3Uvd2FpdC1lbGVtZW50L2Rpc3QvZGV0ZWN0b3JzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AMW5hdHN1L3dhaXQtZWxlbWVudC9kaXN0L2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYXJlZC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9jbHN4L2Rpc3QvY2xzeC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvY24udHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9sYXlvdXQvSGVhZGVyL0hlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9kaXNwbGF5L1Njb3JlUGFuZWwvU2NvcmVQYW5lbC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vQnV0dG9uL0J1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9vbmJvYXJkaW5nL09uYm9hcmRpbmdGbG93L09uYm9hcmRpbmdGbG93LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheS9MeXJpY3NEaXNwbGF5LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvS2FyYW9rZUhlYWRlci9LYXJhb2tlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbC9MZWFkZXJib2FyZFBhbmVsLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9TcGxpdEJ1dHRvbi9TcGxpdEJ1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vVGFicy9UYWJzLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2VmZmVjdHMvRmlyZUVtb2ppQW5pbWF0aW9uL0ZpcmVFbW9qaUFuaW1hdGlvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9rYXJhb2tlL0V4dGVuc2lvbkthcmFva2VWaWV3L0V4dGVuc2lvbkthcmFva2VWaWV3LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9pMThuL3Byb3ZpZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvQ29tcGxldGlvblZpZXcvQ29tcGxldGlvblZpZXcudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL3NlcnZpY2VzL2F1ZGlvL2thcmFva2VBdWRpb1Byb2Nlc3Nvci50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2NsaWVudC50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2VuZHBvaW50cy9rYXJhb2tlLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvZW5kcG9pbnRzL3ByYWN0aWNlLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvZW5kcG9pbnRzL3N0dC50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2VuZHBvaW50cy9hdXRoLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvaW5kZXgudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvc2VydmljZXMva2FyYW9rZS9rYXJhb2tlQXBpLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL3NlcnZpY2VzL2thcmFva2UvY2h1bmtpbmdVdGlscy50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9Qcm9ncmVzc0Jhci9Qcm9ncmVzc0Jhci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9NaW5pbWl6ZWRLYXJhb2tlLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3ByYWN0aWNlL1ByYWN0aWNlSGVhZGVyL1ByYWN0aWNlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3ByYWN0aWNlL0V4ZXJjaXNlRm9vdGVyL0V4ZXJjaXNlRm9vdGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9waG9zcGhvci1pY29ucy1zb2xpZC9kaXN0L0ljb25DaGVja0NpcmNsZUZpbGwuanN4IiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3Bob3NwaG9yLWljb25zLXNvbGlkL2Rpc3QvSWNvblhDaXJjbGVGaWxsLmpzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3ByYWN0aWNlL1Jlc3BvbnNlRm9vdGVyL1Jlc3BvbnNlRm9vdGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3ByYWN0aWNlL0V4ZXJjaXNlVGVtcGxhdGUvRXhlcmNpc2VUZW1wbGF0ZS50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9SZWFkQWxvdWQvUmVhZEFsb3VkLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3ByYWN0aWNlL1ByYWN0aWNlRXhlcmNpc2VWaWV3L1ByYWN0aWNlRXhlcmNpc2VWaWV3LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2ZhcmNhc3Rlci9GYXJjYXN0ZXJNaW5pQXBwL0ZhcmNhc3Rlck1pbmlBcHAudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcGFnZXMvSG9tZVBhZ2UvSG9tZVBhZ2UudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2hvb2tzL3VzZUthcmFva2VTZXNzaW9uLnRzIiwiLi4vLi4vLi4vc3JjL3NlcnZpY2VzL3RyYWNrLWRldGVjdG9yLnRzIiwiLi4vLi4vLi4vc3JjL3V0aWxzL3N0b3JhZ2UudHMiLCIuLi8uLi8uLi9zcmMvc2VydmljZXMva2FyYW9rZS1hcGkudHMiLCIuLi8uLi8uLi9zcmMvdmlld3MvY29udGVudC9QcmFjdGljZVZpZXcudHN4IiwiLi4vLi4vLi4vc3JjL3ZpZXdzL2NvbnRlbnQvQ29udGVudEFwcC50c3giLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50LnRzeCIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9pMThuL2xvY2FsZXMvZW4vaW5kZXgudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvaTE4bi9sb2NhbGVzL3poLUNOL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImxldCB0YXNrSWRDb3VudGVyID0gMSxcbiAgaXNDYWxsYmFja1NjaGVkdWxlZCA9IGZhbHNlLFxuICBpc1BlcmZvcm1pbmdXb3JrID0gZmFsc2UsXG4gIHRhc2tRdWV1ZSA9IFtdLFxuICBjdXJyZW50VGFzayA9IG51bGwsXG4gIHNob3VsZFlpZWxkVG9Ib3N0ID0gbnVsbCxcbiAgeWllbGRJbnRlcnZhbCA9IDUsXG4gIGRlYWRsaW5lID0gMCxcbiAgbWF4WWllbGRJbnRlcnZhbCA9IDMwMCxcbiAgc2NoZWR1bGVDYWxsYmFjayA9IG51bGwsXG4gIHNjaGVkdWxlZENhbGxiYWNrID0gbnVsbDtcbmNvbnN0IG1heFNpZ25lZDMxQml0SW50ID0gMTA3Mzc0MTgyMztcbmZ1bmN0aW9uIHNldHVwU2NoZWR1bGVyKCkge1xuICBjb25zdCBjaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsKCksXG4gICAgcG9ydCA9IGNoYW5uZWwucG9ydDI7XG4gIHNjaGVkdWxlQ2FsbGJhY2sgPSAoKSA9PiBwb3J0LnBvc3RNZXNzYWdlKG51bGwpO1xuICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9ICgpID0+IHtcbiAgICBpZiAoc2NoZWR1bGVkQ2FsbGJhY2sgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBkZWFkbGluZSA9IGN1cnJlbnRUaW1lICsgeWllbGRJbnRlcnZhbDtcbiAgICAgIGNvbnN0IGhhc1RpbWVSZW1haW5pbmcgPSB0cnVlO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgaGFzTW9yZVdvcmsgPSBzY2hlZHVsZWRDYWxsYmFjayhoYXNUaW1lUmVtYWluaW5nLCBjdXJyZW50VGltZSk7XG4gICAgICAgIGlmICghaGFzTW9yZVdvcmspIHtcbiAgICAgICAgICBzY2hlZHVsZWRDYWxsYmFjayA9IG51bGw7XG4gICAgICAgIH0gZWxzZSBwb3J0LnBvc3RNZXNzYWdlKG51bGwpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9XG4gICAgfVxuICB9O1xuICBpZiAobmF2aWdhdG9yICYmIG5hdmlnYXRvci5zY2hlZHVsaW5nICYmIG5hdmlnYXRvci5zY2hlZHVsaW5nLmlzSW5wdXRQZW5kaW5nKSB7XG4gICAgY29uc3Qgc2NoZWR1bGluZyA9IG5hdmlnYXRvci5zY2hlZHVsaW5nO1xuICAgIHNob3VsZFlpZWxkVG9Ib3N0ID0gKCkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGlmIChjdXJyZW50VGltZSA+PSBkZWFkbGluZSkge1xuICAgICAgICBpZiAoc2NoZWR1bGluZy5pc0lucHV0UGVuZGluZygpKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGN1cnJlbnRUaW1lID49IG1heFlpZWxkSW50ZXJ2YWw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBzaG91bGRZaWVsZFRvSG9zdCA9ICgpID0+IHBlcmZvcm1hbmNlLm5vdygpID49IGRlYWRsaW5lO1xuICB9XG59XG5mdW5jdGlvbiBlbnF1ZXVlKHRhc2tRdWV1ZSwgdGFzaykge1xuICBmdW5jdGlvbiBmaW5kSW5kZXgoKSB7XG4gICAgbGV0IG0gPSAwO1xuICAgIGxldCBuID0gdGFza1F1ZXVlLmxlbmd0aCAtIDE7XG4gICAgd2hpbGUgKG0gPD0gbikge1xuICAgICAgY29uc3QgayA9IG4gKyBtID4+IDE7XG4gICAgICBjb25zdCBjbXAgPSB0YXNrLmV4cGlyYXRpb25UaW1lIC0gdGFza1F1ZXVlW2tdLmV4cGlyYXRpb25UaW1lO1xuICAgICAgaWYgKGNtcCA+IDApIG0gPSBrICsgMTtlbHNlIGlmIChjbXAgPCAwKSBuID0gayAtIDE7ZWxzZSByZXR1cm4gaztcbiAgICB9XG4gICAgcmV0dXJuIG07XG4gIH1cbiAgdGFza1F1ZXVlLnNwbGljZShmaW5kSW5kZXgoKSwgMCwgdGFzayk7XG59XG5mdW5jdGlvbiByZXF1ZXN0Q2FsbGJhY2soZm4sIG9wdGlvbnMpIHtcbiAgaWYgKCFzY2hlZHVsZUNhbGxiYWNrKSBzZXR1cFNjaGVkdWxlcigpO1xuICBsZXQgc3RhcnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCksXG4gICAgdGltZW91dCA9IG1heFNpZ25lZDMxQml0SW50O1xuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnRpbWVvdXQpIHRpbWVvdXQgPSBvcHRpb25zLnRpbWVvdXQ7XG4gIGNvbnN0IG5ld1Rhc2sgPSB7XG4gICAgaWQ6IHRhc2tJZENvdW50ZXIrKyxcbiAgICBmbixcbiAgICBzdGFydFRpbWUsXG4gICAgZXhwaXJhdGlvblRpbWU6IHN0YXJ0VGltZSArIHRpbWVvdXRcbiAgfTtcbiAgZW5xdWV1ZSh0YXNrUXVldWUsIG5ld1Rhc2spO1xuICBpZiAoIWlzQ2FsbGJhY2tTY2hlZHVsZWQgJiYgIWlzUGVyZm9ybWluZ1dvcmspIHtcbiAgICBpc0NhbGxiYWNrU2NoZWR1bGVkID0gdHJ1ZTtcbiAgICBzY2hlZHVsZWRDYWxsYmFjayA9IGZsdXNoV29yaztcbiAgICBzY2hlZHVsZUNhbGxiYWNrKCk7XG4gIH1cbiAgcmV0dXJuIG5ld1Rhc2s7XG59XG5mdW5jdGlvbiBjYW5jZWxDYWxsYmFjayh0YXNrKSB7XG4gIHRhc2suZm4gPSBudWxsO1xufVxuZnVuY3Rpb24gZmx1c2hXb3JrKGhhc1RpbWVSZW1haW5pbmcsIGluaXRpYWxUaW1lKSB7XG4gIGlzQ2FsbGJhY2tTY2hlZHVsZWQgPSBmYWxzZTtcbiAgaXNQZXJmb3JtaW5nV29yayA9IHRydWU7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHdvcmtMb29wKGhhc1RpbWVSZW1haW5pbmcsIGluaXRpYWxUaW1lKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBjdXJyZW50VGFzayA9IG51bGw7XG4gICAgaXNQZXJmb3JtaW5nV29yayA9IGZhbHNlO1xuICB9XG59XG5mdW5jdGlvbiB3b3JrTG9vcChoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSkge1xuICBsZXQgY3VycmVudFRpbWUgPSBpbml0aWFsVGltZTtcbiAgY3VycmVudFRhc2sgPSB0YXNrUXVldWVbMF0gfHwgbnVsbDtcbiAgd2hpbGUgKGN1cnJlbnRUYXNrICE9PSBudWxsKSB7XG4gICAgaWYgKGN1cnJlbnRUYXNrLmV4cGlyYXRpb25UaW1lID4gY3VycmVudFRpbWUgJiYgKCFoYXNUaW1lUmVtYWluaW5nIHx8IHNob3VsZFlpZWxkVG9Ib3N0KCkpKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY29uc3QgY2FsbGJhY2sgPSBjdXJyZW50VGFzay5mbjtcbiAgICBpZiAoY2FsbGJhY2sgIT09IG51bGwpIHtcbiAgICAgIGN1cnJlbnRUYXNrLmZuID0gbnVsbDtcbiAgICAgIGNvbnN0IGRpZFVzZXJDYWxsYmFja1RpbWVvdXQgPSBjdXJyZW50VGFzay5leHBpcmF0aW9uVGltZSA8PSBjdXJyZW50VGltZTtcbiAgICAgIGNhbGxiYWNrKGRpZFVzZXJDYWxsYmFja1RpbWVvdXQpO1xuICAgICAgY3VycmVudFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGlmIChjdXJyZW50VGFzayA9PT0gdGFza1F1ZXVlWzBdKSB7XG4gICAgICAgIHRhc2tRdWV1ZS5zaGlmdCgpO1xuICAgICAgfVxuICAgIH0gZWxzZSB0YXNrUXVldWUuc2hpZnQoKTtcbiAgICBjdXJyZW50VGFzayA9IHRhc2tRdWV1ZVswXSB8fCBudWxsO1xuICB9XG4gIHJldHVybiBjdXJyZW50VGFzayAhPT0gbnVsbDtcbn1cblxuY29uc3Qgc2hhcmVkQ29uZmlnID0ge1xuICBjb250ZXh0OiB1bmRlZmluZWQsXG4gIHJlZ2lzdHJ5OiB1bmRlZmluZWQsXG4gIGVmZmVjdHM6IHVuZGVmaW5lZCxcbiAgZG9uZTogZmFsc2UsXG4gIGdldENvbnRleHRJZCgpIHtcbiAgICByZXR1cm4gZ2V0Q29udGV4dElkKHRoaXMuY29udGV4dC5jb3VudCk7XG4gIH0sXG4gIGdldE5leHRDb250ZXh0SWQoKSB7XG4gICAgcmV0dXJuIGdldENvbnRleHRJZCh0aGlzLmNvbnRleHQuY291bnQrKyk7XG4gIH1cbn07XG5mdW5jdGlvbiBnZXRDb250ZXh0SWQoY291bnQpIHtcbiAgY29uc3QgbnVtID0gU3RyaW5nKGNvdW50KSxcbiAgICBsZW4gPSBudW0ubGVuZ3RoIC0gMTtcbiAgcmV0dXJuIHNoYXJlZENvbmZpZy5jb250ZXh0LmlkICsgKGxlbiA/IFN0cmluZy5mcm9tQ2hhckNvZGUoOTYgKyBsZW4pIDogXCJcIikgKyBudW07XG59XG5mdW5jdGlvbiBzZXRIeWRyYXRlQ29udGV4dChjb250ZXh0KSB7XG4gIHNoYXJlZENvbmZpZy5jb250ZXh0ID0gY29udGV4dDtcbn1cbmZ1bmN0aW9uIG5leHRIeWRyYXRlQ29udGV4dCgpIHtcbiAgcmV0dXJuIHtcbiAgICAuLi5zaGFyZWRDb25maWcuY29udGV4dCxcbiAgICBpZDogc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKSxcbiAgICBjb3VudDogMFxuICB9O1xufVxuXG5jb25zdCBJU19ERVYgPSB0cnVlO1xuY29uc3QgZXF1YWxGbiA9IChhLCBiKSA9PiBhID09PSBiO1xuY29uc3QgJFBST1hZID0gU3ltYm9sKFwic29saWQtcHJveHlcIik7XG5jb25zdCBTVVBQT1JUU19QUk9YWSA9IHR5cGVvZiBQcm94eSA9PT0gXCJmdW5jdGlvblwiO1xuY29uc3QgJFRSQUNLID0gU3ltYm9sKFwic29saWQtdHJhY2tcIik7XG5jb25zdCAkREVWQ09NUCA9IFN5bWJvbChcInNvbGlkLWRldi1jb21wb25lbnRcIik7XG5jb25zdCBzaWduYWxPcHRpb25zID0ge1xuICBlcXVhbHM6IGVxdWFsRm5cbn07XG5sZXQgRVJST1IgPSBudWxsO1xubGV0IHJ1bkVmZmVjdHMgPSBydW5RdWV1ZTtcbmNvbnN0IFNUQUxFID0gMTtcbmNvbnN0IFBFTkRJTkcgPSAyO1xuY29uc3QgVU5PV05FRCA9IHtcbiAgb3duZWQ6IG51bGwsXG4gIGNsZWFudXBzOiBudWxsLFxuICBjb250ZXh0OiBudWxsLFxuICBvd25lcjogbnVsbFxufTtcbmNvbnN0IE5PX0lOSVQgPSB7fTtcbnZhciBPd25lciA9IG51bGw7XG5sZXQgVHJhbnNpdGlvbiA9IG51bGw7XG5sZXQgU2NoZWR1bGVyID0gbnVsbDtcbmxldCBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IG51bGw7XG5sZXQgTGlzdGVuZXIgPSBudWxsO1xubGV0IFVwZGF0ZXMgPSBudWxsO1xubGV0IEVmZmVjdHMgPSBudWxsO1xubGV0IEV4ZWNDb3VudCA9IDA7XG5jb25zdCBEZXZIb29rcyA9IHtcbiAgYWZ0ZXJVcGRhdGU6IG51bGwsXG4gIGFmdGVyQ3JlYXRlT3duZXI6IG51bGwsXG4gIGFmdGVyQ3JlYXRlU2lnbmFsOiBudWxsLFxuICBhZnRlclJlZ2lzdGVyR3JhcGg6IG51bGxcbn07XG5mdW5jdGlvbiBjcmVhdGVSb290KGZuLCBkZXRhY2hlZE93bmVyKSB7XG4gIGNvbnN0IGxpc3RlbmVyID0gTGlzdGVuZXIsXG4gICAgb3duZXIgPSBPd25lcixcbiAgICB1bm93bmVkID0gZm4ubGVuZ3RoID09PSAwLFxuICAgIGN1cnJlbnQgPSBkZXRhY2hlZE93bmVyID09PSB1bmRlZmluZWQgPyBvd25lciA6IGRldGFjaGVkT3duZXIsXG4gICAgcm9vdCA9IHVub3duZWQgPyB7XG4gICAgICBvd25lZDogbnVsbCxcbiAgICAgIGNsZWFudXBzOiBudWxsLFxuICAgICAgY29udGV4dDogbnVsbCxcbiAgICAgIG93bmVyOiBudWxsXG4gICAgfSAgOiB7XG4gICAgICBvd25lZDogbnVsbCxcbiAgICAgIGNsZWFudXBzOiBudWxsLFxuICAgICAgY29udGV4dDogY3VycmVudCA/IGN1cnJlbnQuY29udGV4dCA6IG51bGwsXG4gICAgICBvd25lcjogY3VycmVudFxuICAgIH0sXG4gICAgdXBkYXRlRm4gPSB1bm93bmVkID8gKCkgPT4gZm4oKCkgPT4ge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRGlzcG9zZSBtZXRob2QgbXVzdCBiZSBhbiBleHBsaWNpdCBhcmd1bWVudCB0byBjcmVhdGVSb290IGZ1bmN0aW9uXCIpO1xuICAgIH0pICA6ICgpID0+IGZuKCgpID0+IHVudHJhY2soKCkgPT4gY2xlYW5Ob2RlKHJvb3QpKSk7XG4gIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIgJiYgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lcihyb290KTtcbiAgT3duZXIgPSByb290O1xuICBMaXN0ZW5lciA9IG51bGw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJ1blVwZGF0ZXModXBkYXRlRm4sIHRydWUpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gICAgT3duZXIgPSBvd25lcjtcbiAgfVxufVxuZnVuY3Rpb24gY3JlYXRlU2lnbmFsKHZhbHVlLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zID8gT2JqZWN0LmFzc2lnbih7fSwgc2lnbmFsT3B0aW9ucywgb3B0aW9ucykgOiBzaWduYWxPcHRpb25zO1xuICBjb25zdCBzID0ge1xuICAgIHZhbHVlLFxuICAgIG9ic2VydmVyczogbnVsbCxcbiAgICBvYnNlcnZlclNsb3RzOiBudWxsLFxuICAgIGNvbXBhcmF0b3I6IG9wdGlvbnMuZXF1YWxzIHx8IHVuZGVmaW5lZFxuICB9O1xuICB7XG4gICAgaWYgKG9wdGlvbnMubmFtZSkgcy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIGlmIChvcHRpb25zLmludGVybmFsKSB7XG4gICAgICBzLmludGVybmFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVnaXN0ZXJHcmFwaChzKTtcbiAgICAgIGlmIChEZXZIb29rcy5hZnRlckNyZWF0ZVNpZ25hbCkgRGV2SG9va3MuYWZ0ZXJDcmVhdGVTaWduYWwocyk7XG4gICAgfVxuICB9XG4gIGNvbnN0IHNldHRlciA9IHZhbHVlID0+IHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKHMpKSB2YWx1ZSA9IHZhbHVlKHMudFZhbHVlKTtlbHNlIHZhbHVlID0gdmFsdWUocy52YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiB3cml0ZVNpZ25hbChzLCB2YWx1ZSk7XG4gIH07XG4gIHJldHVybiBbcmVhZFNpZ25hbC5iaW5kKHMpLCBzZXR0ZXJdO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29tcHV0ZWQoZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIHRydWUsIFNUQUxFLCBvcHRpb25zICk7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIFVwZGF0ZXMucHVzaChjKTtlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlUmVuZGVyRWZmZWN0KGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCBmYWxzZSwgU1RBTEUsIG9wdGlvbnMgKTtcbiAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgVXBkYXRlcy5wdXNoKGMpO2Vsc2UgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG59XG5mdW5jdGlvbiBjcmVhdGVFZmZlY3QoZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIHJ1bkVmZmVjdHMgPSBydW5Vc2VyRWZmZWN0cztcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgZmFsc2UsIFNUQUxFLCBvcHRpb25zICksXG4gICAgcyA9IFN1c3BlbnNlQ29udGV4dCAmJiB1c2VDb250ZXh0KFN1c3BlbnNlQ29udGV4dCk7XG4gIGlmIChzKSBjLnN1c3BlbnNlID0gcztcbiAgaWYgKCFvcHRpb25zIHx8ICFvcHRpb25zLnJlbmRlcikgYy51c2VyID0gdHJ1ZTtcbiAgRWZmZWN0cyA/IEVmZmVjdHMucHVzaChjKSA6IHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlUmVhY3Rpb24ob25JbnZhbGlkYXRlLCBvcHRpb25zKSB7XG4gIGxldCBmbjtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKCgpID0+IHtcbiAgICAgIGZuID8gZm4oKSA6IHVudHJhY2sob25JbnZhbGlkYXRlKTtcbiAgICAgIGZuID0gdW5kZWZpbmVkO1xuICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UsIDAsIG9wdGlvbnMgKSxcbiAgICBzID0gU3VzcGVuc2VDb250ZXh0ICYmIHVzZUNvbnRleHQoU3VzcGVuc2VDb250ZXh0KTtcbiAgaWYgKHMpIGMuc3VzcGVuc2UgPSBzO1xuICBjLnVzZXIgPSB0cnVlO1xuICByZXR1cm4gdHJhY2tpbmcgPT4ge1xuICAgIGZuID0gdHJhY2tpbmc7XG4gICAgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIH07XG59XG5mdW5jdGlvbiBjcmVhdGVNZW1vKGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyA/IE9iamVjdC5hc3NpZ24oe30sIHNpZ25hbE9wdGlvbnMsIG9wdGlvbnMpIDogc2lnbmFsT3B0aW9ucztcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgdHJ1ZSwgMCwgb3B0aW9ucyApO1xuICBjLm9ic2VydmVycyA9IG51bGw7XG4gIGMub2JzZXJ2ZXJTbG90cyA9IG51bGw7XG4gIGMuY29tcGFyYXRvciA9IG9wdGlvbnMuZXF1YWxzIHx8IHVuZGVmaW5lZDtcbiAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGMudFN0YXRlID0gU1RBTEU7XG4gICAgVXBkYXRlcy5wdXNoKGMpO1xuICB9IGVsc2UgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIHJldHVybiByZWFkU2lnbmFsLmJpbmQoYyk7XG59XG5mdW5jdGlvbiBpc1Byb21pc2Uodikge1xuICByZXR1cm4gdiAmJiB0eXBlb2YgdiA9PT0gXCJvYmplY3RcIiAmJiBcInRoZW5cIiBpbiB2O1xufVxuZnVuY3Rpb24gY3JlYXRlUmVzb3VyY2UocFNvdXJjZSwgcEZldGNoZXIsIHBPcHRpb25zKSB7XG4gIGxldCBzb3VyY2U7XG4gIGxldCBmZXRjaGVyO1xuICBsZXQgb3B0aW9ucztcbiAgaWYgKHR5cGVvZiBwRmV0Y2hlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgc291cmNlID0gcFNvdXJjZTtcbiAgICBmZXRjaGVyID0gcEZldGNoZXI7XG4gICAgb3B0aW9ucyA9IHBPcHRpb25zIHx8IHt9O1xuICB9IGVsc2Uge1xuICAgIHNvdXJjZSA9IHRydWU7XG4gICAgZmV0Y2hlciA9IHBTb3VyY2U7XG4gICAgb3B0aW9ucyA9IHBGZXRjaGVyIHx8IHt9O1xuICB9XG4gIGxldCBwciA9IG51bGwsXG4gICAgaW5pdFAgPSBOT19JTklULFxuICAgIGlkID0gbnVsbCxcbiAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBmYWxzZSxcbiAgICBzY2hlZHVsZWQgPSBmYWxzZSxcbiAgICByZXNvbHZlZCA9IFwiaW5pdGlhbFZhbHVlXCIgaW4gb3B0aW9ucyxcbiAgICBkeW5hbWljID0gdHlwZW9mIHNvdXJjZSA9PT0gXCJmdW5jdGlvblwiICYmIGNyZWF0ZU1lbW8oc291cmNlKTtcbiAgY29uc3QgY29udGV4dHMgPSBuZXcgU2V0KCksXG4gICAgW3ZhbHVlLCBzZXRWYWx1ZV0gPSAob3B0aW9ucy5zdG9yYWdlIHx8IGNyZWF0ZVNpZ25hbCkob3B0aW9ucy5pbml0aWFsVmFsdWUpLFxuICAgIFtlcnJvciwgc2V0RXJyb3JdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCksXG4gICAgW3RyYWNrLCB0cmlnZ2VyXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQsIHtcbiAgICAgIGVxdWFsczogZmFsc2VcbiAgICB9KSxcbiAgICBbc3RhdGUsIHNldFN0YXRlXSA9IGNyZWF0ZVNpZ25hbChyZXNvbHZlZCA/IFwicmVhZHlcIiA6IFwidW5yZXNvbHZlZFwiKTtcbiAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0KSB7XG4gICAgaWQgPSBzaGFyZWRDb25maWcuZ2V0TmV4dENvbnRleHRJZCgpO1xuICAgIGlmIChvcHRpb25zLnNzckxvYWRGcm9tID09PSBcImluaXRpYWxcIikgaW5pdFAgPSBvcHRpb25zLmluaXRpYWxWYWx1ZTtlbHNlIGlmIChzaGFyZWRDb25maWcubG9hZCAmJiBzaGFyZWRDb25maWcuaGFzKGlkKSkgaW5pdFAgPSBzaGFyZWRDb25maWcubG9hZChpZCk7XG4gIH1cbiAgZnVuY3Rpb24gbG9hZEVuZChwLCB2LCBlcnJvciwga2V5KSB7XG4gICAgaWYgKHByID09PSBwKSB7XG4gICAgICBwciA9IG51bGw7XG4gICAgICBrZXkgIT09IHVuZGVmaW5lZCAmJiAocmVzb2x2ZWQgPSB0cnVlKTtcbiAgICAgIGlmICgocCA9PT0gaW5pdFAgfHwgdiA9PT0gaW5pdFApICYmIG9wdGlvbnMub25IeWRyYXRlZCkgcXVldWVNaWNyb3Rhc2soKCkgPT4gb3B0aW9ucy5vbkh5ZHJhdGVkKGtleSwge1xuICAgICAgICB2YWx1ZTogdlxuICAgICAgfSkpO1xuICAgICAgaW5pdFAgPSBOT19JTklUO1xuICAgICAgaWYgKFRyYW5zaXRpb24gJiYgcCAmJiBsb2FkZWRVbmRlclRyYW5zaXRpb24pIHtcbiAgICAgICAgVHJhbnNpdGlvbi5wcm9taXNlcy5kZWxldGUocCk7XG4gICAgICAgIGxvYWRlZFVuZGVyVHJhbnNpdGlvbiA9IGZhbHNlO1xuICAgICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgIGNvbXBsZXRlTG9hZCh2LCBlcnJvcik7XG4gICAgICAgIH0sIGZhbHNlKTtcbiAgICAgIH0gZWxzZSBjb21wbGV0ZUxvYWQodiwgZXJyb3IpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuICBmdW5jdGlvbiBjb21wbGV0ZUxvYWQodiwgZXJyKSB7XG4gICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICBpZiAoZXJyID09PSB1bmRlZmluZWQpIHNldFZhbHVlKCgpID0+IHYpO1xuICAgICAgc2V0U3RhdGUoZXJyICE9PSB1bmRlZmluZWQgPyBcImVycm9yZWRcIiA6IHJlc29sdmVkID8gXCJyZWFkeVwiIDogXCJ1bnJlc29sdmVkXCIpO1xuICAgICAgc2V0RXJyb3IoZXJyKTtcbiAgICAgIGZvciAoY29uc3QgYyBvZiBjb250ZXh0cy5rZXlzKCkpIGMuZGVjcmVtZW50KCk7XG4gICAgICBjb250ZXh0cy5jbGVhcigpO1xuICAgIH0sIGZhbHNlKTtcbiAgfVxuICBmdW5jdGlvbiByZWFkKCkge1xuICAgIGNvbnN0IGMgPSBTdXNwZW5zZUNvbnRleHQgJiYgdXNlQ29udGV4dChTdXNwZW5zZUNvbnRleHQpLFxuICAgICAgdiA9IHZhbHVlKCksXG4gICAgICBlcnIgPSBlcnJvcigpO1xuICAgIGlmIChlcnIgIT09IHVuZGVmaW5lZCAmJiAhcHIpIHRocm93IGVycjtcbiAgICBpZiAoTGlzdGVuZXIgJiYgIUxpc3RlbmVyLnVzZXIgJiYgYykge1xuICAgICAgY3JlYXRlQ29tcHV0ZWQoKCkgPT4ge1xuICAgICAgICB0cmFjaygpO1xuICAgICAgICBpZiAocHIpIHtcbiAgICAgICAgICBpZiAoYy5yZXNvbHZlZCAmJiBUcmFuc2l0aW9uICYmIGxvYWRlZFVuZGVyVHJhbnNpdGlvbikgVHJhbnNpdGlvbi5wcm9taXNlcy5hZGQocHIpO2Vsc2UgaWYgKCFjb250ZXh0cy5oYXMoYykpIHtcbiAgICAgICAgICAgIGMuaW5jcmVtZW50KCk7XG4gICAgICAgICAgICBjb250ZXh0cy5hZGQoYyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cbiAgZnVuY3Rpb24gbG9hZChyZWZldGNoaW5nID0gdHJ1ZSkge1xuICAgIGlmIChyZWZldGNoaW5nICE9PSBmYWxzZSAmJiBzY2hlZHVsZWQpIHJldHVybjtcbiAgICBzY2hlZHVsZWQgPSBmYWxzZTtcbiAgICBjb25zdCBsb29rdXAgPSBkeW5hbWljID8gZHluYW1pYygpIDogc291cmNlO1xuICAgIGxvYWRlZFVuZGVyVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgIGlmIChsb29rdXAgPT0gbnVsbCB8fCBsb29rdXAgPT09IGZhbHNlKSB7XG4gICAgICBsb2FkRW5kKHByLCB1bnRyYWNrKHZhbHVlKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChUcmFuc2l0aW9uICYmIHByKSBUcmFuc2l0aW9uLnByb21pc2VzLmRlbGV0ZShwcik7XG4gICAgbGV0IGVycm9yO1xuICAgIGNvbnN0IHAgPSBpbml0UCAhPT0gTk9fSU5JVCA/IGluaXRQIDogdW50cmFjaygoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gZmV0Y2hlcihsb29rdXAsIHtcbiAgICAgICAgICB2YWx1ZTogdmFsdWUoKSxcbiAgICAgICAgICByZWZldGNoaW5nXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZmV0Y2hlckVycm9yKSB7XG4gICAgICAgIGVycm9yID0gZmV0Y2hlckVycm9yO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChlcnJvciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsb2FkRW5kKHByLCB1bmRlZmluZWQsIGNhc3RFcnJvcihlcnJvciksIGxvb2t1cCk7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmICghaXNQcm9taXNlKHApKSB7XG4gICAgICBsb2FkRW5kKHByLCBwLCB1bmRlZmluZWQsIGxvb2t1cCk7XG4gICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgcHIgPSBwO1xuICAgIGlmIChcInZcIiBpbiBwKSB7XG4gICAgICBpZiAocC5zID09PSAxKSBsb2FkRW5kKHByLCBwLnYsIHVuZGVmaW5lZCwgbG9va3VwKTtlbHNlIGxvYWRFbmQocHIsIHVuZGVmaW5lZCwgY2FzdEVycm9yKHAudiksIGxvb2t1cCk7XG4gICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgc2NoZWR1bGVkID0gdHJ1ZTtcbiAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiBzY2hlZHVsZWQgPSBmYWxzZSk7XG4gICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICBzZXRTdGF0ZShyZXNvbHZlZCA/IFwicmVmcmVzaGluZ1wiIDogXCJwZW5kaW5nXCIpO1xuICAgICAgdHJpZ2dlcigpO1xuICAgIH0sIGZhbHNlKTtcbiAgICByZXR1cm4gcC50aGVuKHYgPT4gbG9hZEVuZChwLCB2LCB1bmRlZmluZWQsIGxvb2t1cCksIGUgPT4gbG9hZEVuZChwLCB1bmRlZmluZWQsIGNhc3RFcnJvcihlKSwgbG9va3VwKSk7XG4gIH1cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMocmVhZCwge1xuICAgIHN0YXRlOiB7XG4gICAgICBnZXQ6ICgpID0+IHN0YXRlKClcbiAgICB9LFxuICAgIGVycm9yOiB7XG4gICAgICBnZXQ6ICgpID0+IGVycm9yKClcbiAgICB9LFxuICAgIGxvYWRpbmc6IHtcbiAgICAgIGdldCgpIHtcbiAgICAgICAgY29uc3QgcyA9IHN0YXRlKCk7XG4gICAgICAgIHJldHVybiBzID09PSBcInBlbmRpbmdcIiB8fCBzID09PSBcInJlZnJlc2hpbmdcIjtcbiAgICAgIH1cbiAgICB9LFxuICAgIGxhdGVzdDoge1xuICAgICAgZ2V0KCkge1xuICAgICAgICBpZiAoIXJlc29sdmVkKSByZXR1cm4gcmVhZCgpO1xuICAgICAgICBjb25zdCBlcnIgPSBlcnJvcigpO1xuICAgICAgICBpZiAoZXJyICYmICFwcikgdGhyb3cgZXJyO1xuICAgICAgICByZXR1cm4gdmFsdWUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuICBsZXQgb3duZXIgPSBPd25lcjtcbiAgaWYgKGR5bmFtaWMpIGNyZWF0ZUNvbXB1dGVkKCgpID0+IChvd25lciA9IE93bmVyLCBsb2FkKGZhbHNlKSkpO2Vsc2UgbG9hZChmYWxzZSk7XG4gIHJldHVybiBbcmVhZCwge1xuICAgIHJlZmV0Y2g6IGluZm8gPT4gcnVuV2l0aE93bmVyKG93bmVyLCAoKSA9PiBsb2FkKGluZm8pKSxcbiAgICBtdXRhdGU6IHNldFZhbHVlXG4gIH1dO1xufVxuZnVuY3Rpb24gY3JlYXRlRGVmZXJyZWQoc291cmNlLCBvcHRpb25zKSB7XG4gIGxldCB0LFxuICAgIHRpbWVvdXQgPSBvcHRpb25zID8gb3B0aW9ucy50aW1lb3V0TXMgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IG5vZGUgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB7XG4gICAgaWYgKCF0IHx8ICF0LmZuKSB0ID0gcmVxdWVzdENhbGxiYWNrKCgpID0+IHNldERlZmVycmVkKCgpID0+IG5vZGUudmFsdWUpLCB0aW1lb3V0ICE9PSB1bmRlZmluZWQgPyB7XG4gICAgICB0aW1lb3V0XG4gICAgfSA6IHVuZGVmaW5lZCk7XG4gICAgcmV0dXJuIHNvdXJjZSgpO1xuICB9LCB1bmRlZmluZWQsIHRydWUpO1xuICBjb25zdCBbZGVmZXJyZWQsIHNldERlZmVycmVkXSA9IGNyZWF0ZVNpZ25hbChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlLCBvcHRpb25zKTtcbiAgdXBkYXRlQ29tcHV0YXRpb24obm9kZSk7XG4gIHNldERlZmVycmVkKCgpID0+IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUpO1xuICByZXR1cm4gZGVmZXJyZWQ7XG59XG5mdW5jdGlvbiBjcmVhdGVTZWxlY3Rvcihzb3VyY2UsIGZuID0gZXF1YWxGbiwgb3B0aW9ucykge1xuICBjb25zdCBzdWJzID0gbmV3IE1hcCgpO1xuICBjb25zdCBub2RlID0gY3JlYXRlQ29tcHV0YXRpb24ocCA9PiB7XG4gICAgY29uc3QgdiA9IHNvdXJjZSgpO1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsXSBvZiBzdWJzLmVudHJpZXMoKSkgaWYgKGZuKGtleSwgdikgIT09IGZuKGtleSwgcCkpIHtcbiAgICAgIGZvciAoY29uc3QgYyBvZiB2YWwudmFsdWVzKCkpIHtcbiAgICAgICAgYy5zdGF0ZSA9IFNUQUxFO1xuICAgICAgICBpZiAoYy5wdXJlKSBVcGRhdGVzLnB1c2goYyk7ZWxzZSBFZmZlY3RzLnB1c2goYyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9LCB1bmRlZmluZWQsIHRydWUsIFNUQUxFLCBvcHRpb25zICk7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICByZXR1cm4ga2V5ID0+IHtcbiAgICBjb25zdCBsaXN0ZW5lciA9IExpc3RlbmVyO1xuICAgIGlmIChsaXN0ZW5lcikge1xuICAgICAgbGV0IGw7XG4gICAgICBpZiAobCA9IHN1YnMuZ2V0KGtleSkpIGwuYWRkKGxpc3RlbmVyKTtlbHNlIHN1YnMuc2V0KGtleSwgbCA9IG5ldyBTZXQoW2xpc3RlbmVyXSkpO1xuICAgICAgb25DbGVhbnVwKCgpID0+IHtcbiAgICAgICAgbC5kZWxldGUobGlzdGVuZXIpO1xuICAgICAgICAhbC5zaXplICYmIHN1YnMuZGVsZXRlKGtleSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGZuKGtleSwgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSk7XG4gIH07XG59XG5mdW5jdGlvbiBiYXRjaChmbikge1xuICByZXR1cm4gcnVuVXBkYXRlcyhmbiwgZmFsc2UpO1xufVxuZnVuY3Rpb24gdW50cmFjayhmbikge1xuICBpZiAoIUV4dGVybmFsU291cmNlQ29uZmlnICYmIExpc3RlbmVyID09PSBudWxsKSByZXR1cm4gZm4oKTtcbiAgY29uc3QgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgTGlzdGVuZXIgPSBudWxsO1xuICB0cnkge1xuICAgIGlmIChFeHRlcm5hbFNvdXJjZUNvbmZpZykgcmV0dXJuIEV4dGVybmFsU291cmNlQ29uZmlnLnVudHJhY2soZm4pO1xuICAgIHJldHVybiBmbigpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIG9uKGRlcHMsIGZuLCBvcHRpb25zKSB7XG4gIGNvbnN0IGlzQXJyYXkgPSBBcnJheS5pc0FycmF5KGRlcHMpO1xuICBsZXQgcHJldklucHV0O1xuICBsZXQgZGVmZXIgPSBvcHRpb25zICYmIG9wdGlvbnMuZGVmZXI7XG4gIHJldHVybiBwcmV2VmFsdWUgPT4ge1xuICAgIGxldCBpbnB1dDtcbiAgICBpZiAoaXNBcnJheSkge1xuICAgICAgaW5wdXQgPSBBcnJheShkZXBzLmxlbmd0aCk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRlcHMubGVuZ3RoOyBpKyspIGlucHV0W2ldID0gZGVwc1tpXSgpO1xuICAgIH0gZWxzZSBpbnB1dCA9IGRlcHMoKTtcbiAgICBpZiAoZGVmZXIpIHtcbiAgICAgIGRlZmVyID0gZmFsc2U7XG4gICAgICByZXR1cm4gcHJldlZhbHVlO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSB1bnRyYWNrKCgpID0+IGZuKGlucHV0LCBwcmV2SW5wdXQsIHByZXZWYWx1ZSkpO1xuICAgIHByZXZJbnB1dCA9IGlucHV0O1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG59XG5mdW5jdGlvbiBvbk1vdW50KGZuKSB7XG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB1bnRyYWNrKGZuKSk7XG59XG5mdW5jdGlvbiBvbkNsZWFudXAoZm4pIHtcbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJjbGVhbnVwcyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBydW5cIik7ZWxzZSBpZiAoT3duZXIuY2xlYW51cHMgPT09IG51bGwpIE93bmVyLmNsZWFudXBzID0gW2ZuXTtlbHNlIE93bmVyLmNsZWFudXBzLnB1c2goZm4pO1xuICByZXR1cm4gZm47XG59XG5mdW5jdGlvbiBjYXRjaEVycm9yKGZuLCBoYW5kbGVyKSB7XG4gIEVSUk9SIHx8IChFUlJPUiA9IFN5bWJvbChcImVycm9yXCIpKTtcbiAgT3duZXIgPSBjcmVhdGVDb21wdXRhdGlvbih1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIE93bmVyLmNvbnRleHQgPSB7XG4gICAgLi4uT3duZXIuY29udGV4dCxcbiAgICBbRVJST1JdOiBbaGFuZGxlcl1cbiAgfTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKE93bmVyKTtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZm4oKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaGFuZGxlRXJyb3IoZXJyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBPd25lciA9IE93bmVyLm93bmVyO1xuICB9XG59XG5mdW5jdGlvbiBnZXRMaXN0ZW5lcigpIHtcbiAgcmV0dXJuIExpc3RlbmVyO1xufVxuZnVuY3Rpb24gZ2V0T3duZXIoKSB7XG4gIHJldHVybiBPd25lcjtcbn1cbmZ1bmN0aW9uIHJ1bldpdGhPd25lcihvLCBmbikge1xuICBjb25zdCBwcmV2ID0gT3duZXI7XG4gIGNvbnN0IHByZXZMaXN0ZW5lciA9IExpc3RlbmVyO1xuICBPd25lciA9IG87XG4gIExpc3RlbmVyID0gbnVsbDtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcnVuVXBkYXRlcyhmbiwgdHJ1ZSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGhhbmRsZUVycm9yKGVycik7XG4gIH0gZmluYWxseSB7XG4gICAgT3duZXIgPSBwcmV2O1xuICAgIExpc3RlbmVyID0gcHJldkxpc3RlbmVyO1xuICB9XG59XG5mdW5jdGlvbiBlbmFibGVTY2hlZHVsaW5nKHNjaGVkdWxlciA9IHJlcXVlc3RDYWxsYmFjaykge1xuICBTY2hlZHVsZXIgPSBzY2hlZHVsZXI7XG59XG5mdW5jdGlvbiBzdGFydFRyYW5zaXRpb24oZm4pIHtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgZm4oKTtcbiAgICByZXR1cm4gVHJhbnNpdGlvbi5kb25lO1xuICB9XG4gIGNvbnN0IGwgPSBMaXN0ZW5lcjtcbiAgY29uc3QgbyA9IE93bmVyO1xuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbigoKSA9PiB7XG4gICAgTGlzdGVuZXIgPSBsO1xuICAgIE93bmVyID0gbztcbiAgICBsZXQgdDtcbiAgICBpZiAoU2NoZWR1bGVyIHx8IFN1c3BlbnNlQ29udGV4dCkge1xuICAgICAgdCA9IFRyYW5zaXRpb24gfHwgKFRyYW5zaXRpb24gPSB7XG4gICAgICAgIHNvdXJjZXM6IG5ldyBTZXQoKSxcbiAgICAgICAgZWZmZWN0czogW10sXG4gICAgICAgIHByb21pc2VzOiBuZXcgU2V0KCksXG4gICAgICAgIGRpc3Bvc2VkOiBuZXcgU2V0KCksXG4gICAgICAgIHF1ZXVlOiBuZXcgU2V0KCksXG4gICAgICAgIHJ1bm5pbmc6IHRydWVcbiAgICAgIH0pO1xuICAgICAgdC5kb25lIHx8ICh0LmRvbmUgPSBuZXcgUHJvbWlzZShyZXMgPT4gdC5yZXNvbHZlID0gcmVzKSk7XG4gICAgICB0LnJ1bm5pbmcgPSB0cnVlO1xuICAgIH1cbiAgICBydW5VcGRhdGVzKGZuLCBmYWxzZSk7XG4gICAgTGlzdGVuZXIgPSBPd25lciA9IG51bGw7XG4gICAgcmV0dXJuIHQgPyB0LmRvbmUgOiB1bmRlZmluZWQ7XG4gIH0pO1xufVxuY29uc3QgW3RyYW5zUGVuZGluZywgc2V0VHJhbnNQZW5kaW5nXSA9IC8qQF9fUFVSRV9fKi9jcmVhdGVTaWduYWwoZmFsc2UpO1xuZnVuY3Rpb24gdXNlVHJhbnNpdGlvbigpIHtcbiAgcmV0dXJuIFt0cmFuc1BlbmRpbmcsIHN0YXJ0VHJhbnNpdGlvbl07XG59XG5mdW5jdGlvbiByZXN1bWVFZmZlY3RzKGUpIHtcbiAgRWZmZWN0cy5wdXNoLmFwcGx5KEVmZmVjdHMsIGUpO1xuICBlLmxlbmd0aCA9IDA7XG59XG5mdW5jdGlvbiBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMpIHtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKCgpID0+IHVudHJhY2soKCkgPT4ge1xuICAgIE9iamVjdC5hc3NpZ24oQ29tcCwge1xuICAgICAgWyRERVZDT01QXTogdHJ1ZVxuICAgIH0pO1xuICAgIHJldHVybiBDb21wKHByb3BzKTtcbiAgfSksIHVuZGVmaW5lZCwgdHJ1ZSwgMCk7XG4gIGMucHJvcHMgPSBwcm9wcztcbiAgYy5vYnNlcnZlcnMgPSBudWxsO1xuICBjLm9ic2VydmVyU2xvdHMgPSBudWxsO1xuICBjLm5hbWUgPSBDb21wLm5hbWU7XG4gIGMuY29tcG9uZW50ID0gQ29tcDtcbiAgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIHJldHVybiBjLnRWYWx1ZSAhPT0gdW5kZWZpbmVkID8gYy50VmFsdWUgOiBjLnZhbHVlO1xufVxuZnVuY3Rpb24gcmVnaXN0ZXJHcmFwaCh2YWx1ZSkge1xuICBpZiAoT3duZXIpIHtcbiAgICBpZiAoT3duZXIuc291cmNlTWFwKSBPd25lci5zb3VyY2VNYXAucHVzaCh2YWx1ZSk7ZWxzZSBPd25lci5zb3VyY2VNYXAgPSBbdmFsdWVdO1xuICAgIHZhbHVlLmdyYXBoID0gT3duZXI7XG4gIH1cbiAgaWYgKERldkhvb2tzLmFmdGVyUmVnaXN0ZXJHcmFwaCkgRGV2SG9va3MuYWZ0ZXJSZWdpc3RlckdyYXBoKHZhbHVlKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbnRleHQoZGVmYXVsdFZhbHVlLCBvcHRpb25zKSB7XG4gIGNvbnN0IGlkID0gU3ltYm9sKFwiY29udGV4dFwiKTtcbiAgcmV0dXJuIHtcbiAgICBpZCxcbiAgICBQcm92aWRlcjogY3JlYXRlUHJvdmlkZXIoaWQsIG9wdGlvbnMpLFxuICAgIGRlZmF1bHRWYWx1ZVxuICB9O1xufVxuZnVuY3Rpb24gdXNlQ29udGV4dChjb250ZXh0KSB7XG4gIGxldCB2YWx1ZTtcbiAgcmV0dXJuIE93bmVyICYmIE93bmVyLmNvbnRleHQgJiYgKHZhbHVlID0gT3duZXIuY29udGV4dFtjb250ZXh0LmlkXSkgIT09IHVuZGVmaW5lZCA/IHZhbHVlIDogY29udGV4dC5kZWZhdWx0VmFsdWU7XG59XG5mdW5jdGlvbiBjaGlsZHJlbihmbikge1xuICBjb25zdCBjaGlsZHJlbiA9IGNyZWF0ZU1lbW8oZm4pO1xuICBjb25zdCBtZW1vID0gY3JlYXRlTWVtbygoKSA9PiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4oKSksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwiY2hpbGRyZW5cIlxuICB9KSA7XG4gIG1lbW8udG9BcnJheSA9ICgpID0+IHtcbiAgICBjb25zdCBjID0gbWVtbygpO1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KGMpID8gYyA6IGMgIT0gbnVsbCA/IFtjXSA6IFtdO1xuICB9O1xuICByZXR1cm4gbWVtbztcbn1cbmxldCBTdXNwZW5zZUNvbnRleHQ7XG5mdW5jdGlvbiBnZXRTdXNwZW5zZUNvbnRleHQoKSB7XG4gIHJldHVybiBTdXNwZW5zZUNvbnRleHQgfHwgKFN1c3BlbnNlQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQoKSk7XG59XG5mdW5jdGlvbiBlbmFibGVFeHRlcm5hbFNvdXJjZShmYWN0b3J5LCB1bnRyYWNrID0gZm4gPT4gZm4oKSkge1xuICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcpIHtcbiAgICBjb25zdCB7XG4gICAgICBmYWN0b3J5OiBvbGRGYWN0b3J5LFxuICAgICAgdW50cmFjazogb2xkVW50cmFja1xuICAgIH0gPSBFeHRlcm5hbFNvdXJjZUNvbmZpZztcbiAgICBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IHtcbiAgICAgIGZhY3Rvcnk6IChmbiwgdHJpZ2dlcikgPT4ge1xuICAgICAgICBjb25zdCBvbGRTb3VyY2UgPSBvbGRGYWN0b3J5KGZuLCB0cmlnZ2VyKTtcbiAgICAgICAgY29uc3Qgc291cmNlID0gZmFjdG9yeSh4ID0+IG9sZFNvdXJjZS50cmFjayh4KSwgdHJpZ2dlcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHJhY2s6IHggPT4gc291cmNlLnRyYWNrKHgpLFxuICAgICAgICAgIGRpc3Bvc2UoKSB7XG4gICAgICAgICAgICBzb3VyY2UuZGlzcG9zZSgpO1xuICAgICAgICAgICAgb2xkU291cmNlLmRpc3Bvc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgdW50cmFjazogZm4gPT4gb2xkVW50cmFjaygoKSA9PiB1bnRyYWNrKGZuKSlcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIEV4dGVybmFsU291cmNlQ29uZmlnID0ge1xuICAgICAgZmFjdG9yeSxcbiAgICAgIHVudHJhY2tcbiAgICB9O1xuICB9XG59XG5mdW5jdGlvbiByZWFkU2lnbmFsKCkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAodGhpcy5zb3VyY2VzICYmIChydW5uaW5nVHJhbnNpdGlvbiA/IHRoaXMudFN0YXRlIDogdGhpcy5zdGF0ZSkpIHtcbiAgICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gdGhpcy50U3RhdGUgOiB0aGlzLnN0YXRlKSA9PT0gU1RBTEUpIHVwZGF0ZUNvbXB1dGF0aW9uKHRoaXMpO2Vsc2Uge1xuICAgICAgY29uc3QgdXBkYXRlcyA9IFVwZGF0ZXM7XG4gICAgICBVcGRhdGVzID0gbnVsbDtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4gbG9va1Vwc3RyZWFtKHRoaXMpLCBmYWxzZSk7XG4gICAgICBVcGRhdGVzID0gdXBkYXRlcztcbiAgICB9XG4gIH1cbiAgaWYgKExpc3RlbmVyKSB7XG4gICAgY29uc3Qgc1Nsb3QgPSB0aGlzLm9ic2VydmVycyA/IHRoaXMub2JzZXJ2ZXJzLmxlbmd0aCA6IDA7XG4gICAgaWYgKCFMaXN0ZW5lci5zb3VyY2VzKSB7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VzID0gW3RoaXNdO1xuICAgICAgTGlzdGVuZXIuc291cmNlU2xvdHMgPSBbc1Nsb3RdO1xuICAgIH0gZWxzZSB7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VzLnB1c2godGhpcyk7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VTbG90cy5wdXNoKHNTbG90KTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLm9ic2VydmVycykge1xuICAgICAgdGhpcy5vYnNlcnZlcnMgPSBbTGlzdGVuZXJdO1xuICAgICAgdGhpcy5vYnNlcnZlclNsb3RzID0gW0xpc3RlbmVyLnNvdXJjZXMubGVuZ3RoIC0gMV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub2JzZXJ2ZXJzLnB1c2goTGlzdGVuZXIpO1xuICAgICAgdGhpcy5vYnNlcnZlclNsb3RzLnB1c2goTGlzdGVuZXIuc291cmNlcy5sZW5ndGggLSAxKTtcbiAgICB9XG4gIH1cbiAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXModGhpcykpIHJldHVybiB0aGlzLnRWYWx1ZTtcbiAgcmV0dXJuIHRoaXMudmFsdWU7XG59XG5mdW5jdGlvbiB3cml0ZVNpZ25hbChub2RlLCB2YWx1ZSwgaXNDb21wKSB7XG4gIGxldCBjdXJyZW50ID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZTtcbiAgaWYgKCFub2RlLmNvbXBhcmF0b3IgfHwgIW5vZGUuY29tcGFyYXRvcihjdXJyZW50LCB2YWx1ZSkpIHtcbiAgICBpZiAoVHJhbnNpdGlvbikge1xuICAgICAgY29uc3QgVHJhbnNpdGlvblJ1bm5pbmcgPSBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gICAgICBpZiAoVHJhbnNpdGlvblJ1bm5pbmcgfHwgIWlzQ29tcCAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpKSB7XG4gICAgICAgIFRyYW5zaXRpb24uc291cmNlcy5hZGQobm9kZSk7XG4gICAgICAgIG5vZGUudFZhbHVlID0gdmFsdWU7XG4gICAgICB9XG4gICAgICBpZiAoIVRyYW5zaXRpb25SdW5uaW5nKSBub2RlLnZhbHVlID0gdmFsdWU7XG4gICAgfSBlbHNlIG5vZGUudmFsdWUgPSB2YWx1ZTtcbiAgICBpZiAobm9kZS5vYnNlcnZlcnMgJiYgbm9kZS5vYnNlcnZlcnMubGVuZ3RoKSB7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLm9ic2VydmVycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgIGNvbnN0IG8gPSBub2RlLm9ic2VydmVyc1tpXTtcbiAgICAgICAgICBjb25zdCBUcmFuc2l0aW9uUnVubmluZyA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgICAgICAgIGlmIChUcmFuc2l0aW9uUnVubmluZyAmJiBUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyhvKSkgY29udGludWU7XG4gICAgICAgICAgaWYgKFRyYW5zaXRpb25SdW5uaW5nID8gIW8udFN0YXRlIDogIW8uc3RhdGUpIHtcbiAgICAgICAgICAgIGlmIChvLnB1cmUpIFVwZGF0ZXMucHVzaChvKTtlbHNlIEVmZmVjdHMucHVzaChvKTtcbiAgICAgICAgICAgIGlmIChvLm9ic2VydmVycykgbWFya0Rvd25zdHJlYW0obyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghVHJhbnNpdGlvblJ1bm5pbmcpIG8uc3RhdGUgPSBTVEFMRTtlbHNlIG8udFN0YXRlID0gU1RBTEU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFVwZGF0ZXMubGVuZ3RoID4gMTBlNSkge1xuICAgICAgICAgIFVwZGF0ZXMgPSBbXTtcbiAgICAgICAgICBpZiAoSVNfREVWKSB0aHJvdyBuZXcgRXJyb3IoXCJQb3RlbnRpYWwgSW5maW5pdGUgTG9vcCBEZXRlY3RlZC5cIik7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gdXBkYXRlQ29tcHV0YXRpb24obm9kZSkge1xuICBpZiAoIW5vZGUuZm4pIHJldHVybjtcbiAgY2xlYW5Ob2RlKG5vZGUpO1xuICBjb25zdCB0aW1lID0gRXhlY0NvdW50O1xuICBydW5Db21wdXRhdGlvbihub2RlLCBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlLCB0aW1lKTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgIVRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpKSB7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIFRyYW5zaXRpb24gJiYgKFRyYW5zaXRpb24ucnVubmluZyA9IHRydWUpO1xuICAgICAgICBMaXN0ZW5lciA9IE93bmVyID0gbm9kZTtcbiAgICAgICAgcnVuQ29tcHV0YXRpb24obm9kZSwgbm9kZS50VmFsdWUsIHRpbWUpO1xuICAgICAgICBMaXN0ZW5lciA9IE93bmVyID0gbnVsbDtcbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9KTtcbiAgfVxufVxuZnVuY3Rpb24gcnVuQ29tcHV0YXRpb24obm9kZSwgdmFsdWUsIHRpbWUpIHtcbiAgbGV0IG5leHRWYWx1ZTtcbiAgY29uc3Qgb3duZXIgPSBPd25lcixcbiAgICBsaXN0ZW5lciA9IExpc3RlbmVyO1xuICBMaXN0ZW5lciA9IE93bmVyID0gbm9kZTtcbiAgdHJ5IHtcbiAgICBuZXh0VmFsdWUgPSBub2RlLmZuKHZhbHVlKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKG5vZGUucHVyZSkge1xuICAgICAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgICAgIG5vZGUudFN0YXRlID0gU1RBTEU7XG4gICAgICAgIG5vZGUudE93bmVkICYmIG5vZGUudE93bmVkLmZvckVhY2goY2xlYW5Ob2RlKTtcbiAgICAgICAgbm9kZS50T3duZWQgPSB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBub2RlLnN0YXRlID0gU1RBTEU7XG4gICAgICAgIG5vZGUub3duZWQgJiYgbm9kZS5vd25lZC5mb3JFYWNoKGNsZWFuTm9kZSk7XG4gICAgICAgIG5vZGUub3duZWQgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBub2RlLnVwZGF0ZWRBdCA9IHRpbWUgKyAxO1xuICAgIHJldHVybiBoYW5kbGVFcnJvcihlcnIpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gICAgT3duZXIgPSBvd25lcjtcbiAgfVxuICBpZiAoIW5vZGUudXBkYXRlZEF0IHx8IG5vZGUudXBkYXRlZEF0IDw9IHRpbWUpIHtcbiAgICBpZiAobm9kZS51cGRhdGVkQXQgIT0gbnVsbCAmJiBcIm9ic2VydmVyc1wiIGluIG5vZGUpIHtcbiAgICAgIHdyaXRlU2lnbmFsKG5vZGUsIG5leHRWYWx1ZSwgdHJ1ZSk7XG4gICAgfSBlbHNlIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBub2RlLnB1cmUpIHtcbiAgICAgIFRyYW5zaXRpb24uc291cmNlcy5hZGQobm9kZSk7XG4gICAgICBub2RlLnRWYWx1ZSA9IG5leHRWYWx1ZTtcbiAgICB9IGVsc2Ugbm9kZS52YWx1ZSA9IG5leHRWYWx1ZTtcbiAgICBub2RlLnVwZGF0ZWRBdCA9IHRpbWU7XG4gIH1cbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCBpbml0LCBwdXJlLCBzdGF0ZSA9IFNUQUxFLCBvcHRpb25zKSB7XG4gIGNvbnN0IGMgPSB7XG4gICAgZm4sXG4gICAgc3RhdGU6IHN0YXRlLFxuICAgIHVwZGF0ZWRBdDogbnVsbCxcbiAgICBvd25lZDogbnVsbCxcbiAgICBzb3VyY2VzOiBudWxsLFxuICAgIHNvdXJjZVNsb3RzOiBudWxsLFxuICAgIGNsZWFudXBzOiBudWxsLFxuICAgIHZhbHVlOiBpbml0LFxuICAgIG93bmVyOiBPd25lcixcbiAgICBjb250ZXh0OiBPd25lciA/IE93bmVyLmNvbnRleHQgOiBudWxsLFxuICAgIHB1cmVcbiAgfTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgYy5zdGF0ZSA9IDA7XG4gICAgYy50U3RhdGUgPSBzdGF0ZTtcbiAgfVxuICBpZiAoT3duZXIgPT09IG51bGwpIGNvbnNvbGUud2FybihcImNvbXB1dGF0aW9ucyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBkaXNwb3NlZFwiKTtlbHNlIGlmIChPd25lciAhPT0gVU5PV05FRCkge1xuICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBPd25lci5wdXJlKSB7XG4gICAgICBpZiAoIU93bmVyLnRPd25lZCkgT3duZXIudE93bmVkID0gW2NdO2Vsc2UgT3duZXIudE93bmVkLnB1c2goYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghT3duZXIub3duZWQpIE93bmVyLm93bmVkID0gW2NdO2Vsc2UgT3duZXIub3duZWQucHVzaChjKTtcbiAgICB9XG4gIH1cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5uYW1lKSBjLm5hbWUgPSBvcHRpb25zLm5hbWU7XG4gIGlmIChFeHRlcm5hbFNvdXJjZUNvbmZpZyAmJiBjLmZuKSB7XG4gICAgY29uc3QgW3RyYWNrLCB0cmlnZ2VyXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQsIHtcbiAgICAgIGVxdWFsczogZmFsc2VcbiAgICB9KTtcbiAgICBjb25zdCBvcmRpbmFyeSA9IEV4dGVybmFsU291cmNlQ29uZmlnLmZhY3RvcnkoYy5mbiwgdHJpZ2dlcik7XG4gICAgb25DbGVhbnVwKCgpID0+IG9yZGluYXJ5LmRpc3Bvc2UoKSk7XG4gICAgY29uc3QgdHJpZ2dlckluVHJhbnNpdGlvbiA9ICgpID0+IHN0YXJ0VHJhbnNpdGlvbih0cmlnZ2VyKS50aGVuKCgpID0+IGluVHJhbnNpdGlvbi5kaXNwb3NlKCkpO1xuICAgIGNvbnN0IGluVHJhbnNpdGlvbiA9IEV4dGVybmFsU291cmNlQ29uZmlnLmZhY3RvcnkoYy5mbiwgdHJpZ2dlckluVHJhbnNpdGlvbik7XG4gICAgYy5mbiA9IHggPT4ge1xuICAgICAgdHJhY2soKTtcbiAgICAgIHJldHVybiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyA/IGluVHJhbnNpdGlvbi50cmFjayh4KSA6IG9yZGluYXJ5LnRyYWNrKHgpO1xuICAgIH07XG4gIH1cbiAgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lciAmJiBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyKGMpO1xuICByZXR1cm4gYztcbn1cbmZ1bmN0aW9uIHJ1blRvcChub2RlKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSAwKSByZXR1cm47XG4gIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBQRU5ESU5HKSByZXR1cm4gbG9va1Vwc3RyZWFtKG5vZGUpO1xuICBpZiAobm9kZS5zdXNwZW5zZSAmJiB1bnRyYWNrKG5vZGUuc3VzcGVuc2UuaW5GYWxsYmFjaykpIHJldHVybiBub2RlLnN1c3BlbnNlLmVmZmVjdHMucHVzaChub2RlKTtcbiAgY29uc3QgYW5jZXN0b3JzID0gW25vZGVdO1xuICB3aGlsZSAoKG5vZGUgPSBub2RlLm93bmVyKSAmJiAoIW5vZGUudXBkYXRlZEF0IHx8IG5vZGUudXBkYXRlZEF0IDwgRXhlY0NvdW50KSkge1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyhub2RlKSkgcmV0dXJuO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgYW5jZXN0b3JzLnB1c2gobm9kZSk7XG4gIH1cbiAgZm9yIChsZXQgaSA9IGFuY2VzdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIG5vZGUgPSBhbmNlc3RvcnNbaV07XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uKSB7XG4gICAgICBsZXQgdG9wID0gbm9kZSxcbiAgICAgICAgcHJldiA9IGFuY2VzdG9yc1tpICsgMV07XG4gICAgICB3aGlsZSAoKHRvcCA9IHRvcC5vd25lcikgJiYgdG9wICE9PSBwcmV2KSB7XG4gICAgICAgIGlmIChUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyh0b3ApKSByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBTVEFMRSkge1xuICAgICAgdXBkYXRlQ29tcHV0YXRpb24obm9kZSk7XG4gICAgfSBlbHNlIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBQRU5ESU5HKSB7XG4gICAgICBjb25zdCB1cGRhdGVzID0gVXBkYXRlcztcbiAgICAgIFVwZGF0ZXMgPSBudWxsO1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiBsb29rVXBzdHJlYW0obm9kZSwgYW5jZXN0b3JzWzBdKSwgZmFsc2UpO1xuICAgICAgVXBkYXRlcyA9IHVwZGF0ZXM7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBydW5VcGRhdGVzKGZuLCBpbml0KSB7XG4gIGlmIChVcGRhdGVzKSByZXR1cm4gZm4oKTtcbiAgbGV0IHdhaXQgPSBmYWxzZTtcbiAgaWYgKCFpbml0KSBVcGRhdGVzID0gW107XG4gIGlmIChFZmZlY3RzKSB3YWl0ID0gdHJ1ZTtlbHNlIEVmZmVjdHMgPSBbXTtcbiAgRXhlY0NvdW50Kys7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gZm4oKTtcbiAgICBjb21wbGV0ZVVwZGF0ZXMod2FpdCk7XG4gICAgcmV0dXJuIHJlcztcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKCF3YWl0KSBFZmZlY3RzID0gbnVsbDtcbiAgICBVcGRhdGVzID0gbnVsbDtcbiAgICBoYW5kbGVFcnJvcihlcnIpO1xuICB9XG59XG5mdW5jdGlvbiBjb21wbGV0ZVVwZGF0ZXMod2FpdCkge1xuICBpZiAoVXBkYXRlcykge1xuICAgIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHNjaGVkdWxlUXVldWUoVXBkYXRlcyk7ZWxzZSBydW5RdWV1ZShVcGRhdGVzKTtcbiAgICBVcGRhdGVzID0gbnVsbDtcbiAgfVxuICBpZiAod2FpdCkgcmV0dXJuO1xuICBsZXQgcmVzO1xuICBpZiAoVHJhbnNpdGlvbikge1xuICAgIGlmICghVHJhbnNpdGlvbi5wcm9taXNlcy5zaXplICYmICFUcmFuc2l0aW9uLnF1ZXVlLnNpemUpIHtcbiAgICAgIGNvbnN0IHNvdXJjZXMgPSBUcmFuc2l0aW9uLnNvdXJjZXM7XG4gICAgICBjb25zdCBkaXNwb3NlZCA9IFRyYW5zaXRpb24uZGlzcG9zZWQ7XG4gICAgICBFZmZlY3RzLnB1c2guYXBwbHkoRWZmZWN0cywgVHJhbnNpdGlvbi5lZmZlY3RzKTtcbiAgICAgIHJlcyA9IFRyYW5zaXRpb24ucmVzb2x2ZTtcbiAgICAgIGZvciAoY29uc3QgZSBvZiBFZmZlY3RzKSB7XG4gICAgICAgIFwidFN0YXRlXCIgaW4gZSAmJiAoZS5zdGF0ZSA9IGUudFN0YXRlKTtcbiAgICAgICAgZGVsZXRlIGUudFN0YXRlO1xuICAgICAgfVxuICAgICAgVHJhbnNpdGlvbiA9IG51bGw7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBkIG9mIGRpc3Bvc2VkKSBjbGVhbk5vZGUoZCk7XG4gICAgICAgIGZvciAoY29uc3QgdiBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgdi52YWx1ZSA9IHYudFZhbHVlO1xuICAgICAgICAgIGlmICh2Lm93bmVkKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdi5vd25lZC5sZW5ndGg7IGkgPCBsZW47IGkrKykgY2xlYW5Ob2RlKHYub3duZWRbaV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodi50T3duZWQpIHYub3duZWQgPSB2LnRPd25lZDtcbiAgICAgICAgICBkZWxldGUgdi50VmFsdWU7XG4gICAgICAgICAgZGVsZXRlIHYudE93bmVkO1xuICAgICAgICAgIHYudFN0YXRlID0gMDtcbiAgICAgICAgfVxuICAgICAgICBzZXRUcmFuc1BlbmRpbmcoZmFsc2UpO1xuICAgICAgfSwgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgIFRyYW5zaXRpb24uZWZmZWN0cy5wdXNoLmFwcGx5KFRyYW5zaXRpb24uZWZmZWN0cywgRWZmZWN0cyk7XG4gICAgICBFZmZlY3RzID0gbnVsbDtcbiAgICAgIHNldFRyYW5zUGVuZGluZyh0cnVlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cbiAgY29uc3QgZSA9IEVmZmVjdHM7XG4gIEVmZmVjdHMgPSBudWxsO1xuICBpZiAoZS5sZW5ndGgpIHJ1blVwZGF0ZXMoKCkgPT4gcnVuRWZmZWN0cyhlKSwgZmFsc2UpO2Vsc2UgRGV2SG9va3MuYWZ0ZXJVcGRhdGUgJiYgRGV2SG9va3MuYWZ0ZXJVcGRhdGUoKTtcbiAgaWYgKHJlcykgcmVzKCk7XG59XG5mdW5jdGlvbiBydW5RdWV1ZShxdWV1ZSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSBydW5Ub3AocXVldWVbaV0pO1xufVxuZnVuY3Rpb24gc2NoZWR1bGVRdWV1ZShxdWV1ZSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgaXRlbSA9IHF1ZXVlW2ldO1xuICAgIGNvbnN0IHRhc2tzID0gVHJhbnNpdGlvbi5xdWV1ZTtcbiAgICBpZiAoIXRhc2tzLmhhcyhpdGVtKSkge1xuICAgICAgdGFza3MuYWRkKGl0ZW0pO1xuICAgICAgU2NoZWR1bGVyKCgpID0+IHtcbiAgICAgICAgdGFza3MuZGVsZXRlKGl0ZW0pO1xuICAgICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgIHJ1blRvcChpdGVtKTtcbiAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICBUcmFuc2l0aW9uICYmIChUcmFuc2l0aW9uLnJ1bm5pbmcgPSBmYWxzZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIHJ1blVzZXJFZmZlY3RzKHF1ZXVlKSB7XG4gIGxldCBpLFxuICAgIHVzZXJMZW5ndGggPSAwO1xuICBmb3IgKGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBlID0gcXVldWVbaV07XG4gICAgaWYgKCFlLnVzZXIpIHJ1blRvcChlKTtlbHNlIHF1ZXVlW3VzZXJMZW5ndGgrK10gPSBlO1xuICB9XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCkge1xuICAgIGlmIChzaGFyZWRDb25maWcuY291bnQpIHtcbiAgICAgIHNoYXJlZENvbmZpZy5lZmZlY3RzIHx8IChzaGFyZWRDb25maWcuZWZmZWN0cyA9IFtdKTtcbiAgICAgIHNoYXJlZENvbmZpZy5lZmZlY3RzLnB1c2goLi4ucXVldWUuc2xpY2UoMCwgdXNlckxlbmd0aCkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICB9XG4gIGlmIChzaGFyZWRDb25maWcuZWZmZWN0cyAmJiAoc2hhcmVkQ29uZmlnLmRvbmUgfHwgIXNoYXJlZENvbmZpZy5jb3VudCkpIHtcbiAgICBxdWV1ZSA9IFsuLi5zaGFyZWRDb25maWcuZWZmZWN0cywgLi4ucXVldWVdO1xuICAgIHVzZXJMZW5ndGggKz0gc2hhcmVkQ29uZmlnLmVmZmVjdHMubGVuZ3RoO1xuICAgIGRlbGV0ZSBzaGFyZWRDb25maWcuZWZmZWN0cztcbiAgfVxuICBmb3IgKGkgPSAwOyBpIDwgdXNlckxlbmd0aDsgaSsrKSBydW5Ub3AocXVldWVbaV0pO1xufVxuZnVuY3Rpb24gbG9va1Vwc3RyZWFtKG5vZGUsIGlnbm9yZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAocnVubmluZ1RyYW5zaXRpb24pIG5vZGUudFN0YXRlID0gMDtlbHNlIG5vZGUuc3RhdGUgPSAwO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuc291cmNlcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGNvbnN0IHNvdXJjZSA9IG5vZGUuc291cmNlc1tpXTtcbiAgICBpZiAoc291cmNlLnNvdXJjZXMpIHtcbiAgICAgIGNvbnN0IHN0YXRlID0gcnVubmluZ1RyYW5zaXRpb24gPyBzb3VyY2UudFN0YXRlIDogc291cmNlLnN0YXRlO1xuICAgICAgaWYgKHN0YXRlID09PSBTVEFMRSkge1xuICAgICAgICBpZiAoc291cmNlICE9PSBpZ25vcmUgJiYgKCFzb3VyY2UudXBkYXRlZEF0IHx8IHNvdXJjZS51cGRhdGVkQXQgPCBFeGVjQ291bnQpKSBydW5Ub3Aoc291cmNlKTtcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IFBFTkRJTkcpIGxvb2tVcHN0cmVhbShzb3VyY2UsIGlnbm9yZSk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBtYXJrRG93bnN0cmVhbShub2RlKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vYnNlcnZlcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBjb25zdCBvID0gbm9kZS5vYnNlcnZlcnNbaV07XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uID8gIW8udFN0YXRlIDogIW8uc3RhdGUpIHtcbiAgICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbikgby50U3RhdGUgPSBQRU5ESU5HO2Vsc2Ugby5zdGF0ZSA9IFBFTkRJTkc7XG4gICAgICBpZiAoby5wdXJlKSBVcGRhdGVzLnB1c2gobyk7ZWxzZSBFZmZlY3RzLnB1c2gobyk7XG4gICAgICBvLm9ic2VydmVycyAmJiBtYXJrRG93bnN0cmVhbShvKTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIGNsZWFuTm9kZShub2RlKSB7XG4gIGxldCBpO1xuICBpZiAobm9kZS5zb3VyY2VzKSB7XG4gICAgd2hpbGUgKG5vZGUuc291cmNlcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHNvdXJjZSA9IG5vZGUuc291cmNlcy5wb3AoKSxcbiAgICAgICAgaW5kZXggPSBub2RlLnNvdXJjZVNsb3RzLnBvcCgpLFxuICAgICAgICBvYnMgPSBzb3VyY2Uub2JzZXJ2ZXJzO1xuICAgICAgaWYgKG9icyAmJiBvYnMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IG4gPSBvYnMucG9wKCksXG4gICAgICAgICAgcyA9IHNvdXJjZS5vYnNlcnZlclNsb3RzLnBvcCgpO1xuICAgICAgICBpZiAoaW5kZXggPCBvYnMubGVuZ3RoKSB7XG4gICAgICAgICAgbi5zb3VyY2VTbG90c1tzXSA9IGluZGV4O1xuICAgICAgICAgIG9ic1tpbmRleF0gPSBuO1xuICAgICAgICAgIHNvdXJjZS5vYnNlcnZlclNsb3RzW2luZGV4XSA9IHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKG5vZGUudE93bmVkKSB7XG4gICAgZm9yIChpID0gbm9kZS50T3duZWQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGNsZWFuTm9kZShub2RlLnRPd25lZFtpXSk7XG4gICAgZGVsZXRlIG5vZGUudE93bmVkO1xuICB9XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBub2RlLnB1cmUpIHtcbiAgICByZXNldChub2RlLCB0cnVlKTtcbiAgfSBlbHNlIGlmIChub2RlLm93bmVkKSB7XG4gICAgZm9yIChpID0gbm9kZS5vd25lZC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgY2xlYW5Ob2RlKG5vZGUub3duZWRbaV0pO1xuICAgIG5vZGUub3duZWQgPSBudWxsO1xuICB9XG4gIGlmIChub2RlLmNsZWFudXBzKSB7XG4gICAgZm9yIChpID0gbm9kZS5jbGVhbnVwcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgbm9kZS5jbGVhbnVwc1tpXSgpO1xuICAgIG5vZGUuY2xlYW51cHMgPSBudWxsO1xuICB9XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgbm9kZS50U3RhdGUgPSAwO2Vsc2Ugbm9kZS5zdGF0ZSA9IDA7XG4gIGRlbGV0ZSBub2RlLnNvdXJjZU1hcDtcbn1cbmZ1bmN0aW9uIHJlc2V0KG5vZGUsIHRvcCkge1xuICBpZiAoIXRvcCkge1xuICAgIG5vZGUudFN0YXRlID0gMDtcbiAgICBUcmFuc2l0aW9uLmRpc3Bvc2VkLmFkZChub2RlKTtcbiAgfVxuICBpZiAobm9kZS5vd25lZCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vd25lZC5sZW5ndGg7IGkrKykgcmVzZXQobm9kZS5vd25lZFtpXSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGNhc3RFcnJvcihlcnIpIHtcbiAgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gZXJyO1xuICByZXR1cm4gbmV3IEVycm9yKHR5cGVvZiBlcnIgPT09IFwic3RyaW5nXCIgPyBlcnIgOiBcIlVua25vd24gZXJyb3JcIiwge1xuICAgIGNhdXNlOiBlcnJcbiAgfSk7XG59XG5mdW5jdGlvbiBydW5FcnJvcnMoZXJyLCBmbnMsIG93bmVyKSB7XG4gIHRyeSB7XG4gICAgZm9yIChjb25zdCBmIG9mIGZucykgZihlcnIpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaGFuZGxlRXJyb3IoZSwgb3duZXIgJiYgb3duZXIub3duZXIgfHwgbnVsbCk7XG4gIH1cbn1cbmZ1bmN0aW9uIGhhbmRsZUVycm9yKGVyciwgb3duZXIgPSBPd25lcikge1xuICBjb25zdCBmbnMgPSBFUlJPUiAmJiBvd25lciAmJiBvd25lci5jb250ZXh0ICYmIG93bmVyLmNvbnRleHRbRVJST1JdO1xuICBjb25zdCBlcnJvciA9IGNhc3RFcnJvcihlcnIpO1xuICBpZiAoIWZucykgdGhyb3cgZXJyb3I7XG4gIGlmIChFZmZlY3RzKSBFZmZlY3RzLnB1c2goe1xuICAgIGZuKCkge1xuICAgICAgcnVuRXJyb3JzKGVycm9yLCBmbnMsIG93bmVyKTtcbiAgICB9LFxuICAgIHN0YXRlOiBTVEFMRVxuICB9KTtlbHNlIHJ1bkVycm9ycyhlcnJvciwgZm5zLCBvd25lcik7XG59XG5mdW5jdGlvbiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4pIHtcbiAgaWYgKHR5cGVvZiBjaGlsZHJlbiA9PT0gXCJmdW5jdGlvblwiICYmICFjaGlsZHJlbi5sZW5ndGgpIHJldHVybiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4oKSk7XG4gIGlmIChBcnJheS5pc0FycmF5KGNoaWxkcmVuKSkge1xuICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW5baV0pO1xuICAgICAgQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0cy5wdXNoLmFwcGx5KHJlc3VsdHMsIHJlc3VsdCkgOiByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cbiAgcmV0dXJuIGNoaWxkcmVuO1xufVxuZnVuY3Rpb24gY3JlYXRlUHJvdmlkZXIoaWQsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHByb3ZpZGVyKHByb3BzKSB7XG4gICAgbGV0IHJlcztcbiAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gcmVzID0gdW50cmFjaygoKSA9PiB7XG4gICAgICBPd25lci5jb250ZXh0ID0ge1xuICAgICAgICAuLi5Pd25lci5jb250ZXh0LFxuICAgICAgICBbaWRdOiBwcm9wcy52YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiBjaGlsZHJlbigoKSA9PiBwcm9wcy5jaGlsZHJlbik7XG4gICAgfSksIHVuZGVmaW5lZCwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcbn1cbmZ1bmN0aW9uIG9uRXJyb3IoZm4pIHtcbiAgRVJST1IgfHwgKEVSUk9SID0gU3ltYm9sKFwiZXJyb3JcIikpO1xuICBpZiAoT3duZXIgPT09IG51bGwpIGNvbnNvbGUud2FybihcImVycm9yIGhhbmRsZXJzIGNyZWF0ZWQgb3V0c2lkZSBhIGBjcmVhdGVSb290YCBvciBgcmVuZGVyYCB3aWxsIG5ldmVyIGJlIHJ1blwiKTtlbHNlIGlmIChPd25lci5jb250ZXh0ID09PSBudWxsIHx8ICFPd25lci5jb250ZXh0W0VSUk9SXSkge1xuICAgIE93bmVyLmNvbnRleHQgPSB7XG4gICAgICAuLi5Pd25lci5jb250ZXh0LFxuICAgICAgW0VSUk9SXTogW2ZuXVxuICAgIH07XG4gICAgbXV0YXRlQ29udGV4dChPd25lciwgRVJST1IsIFtmbl0pO1xuICB9IGVsc2UgT3duZXIuY29udGV4dFtFUlJPUl0ucHVzaChmbik7XG59XG5mdW5jdGlvbiBtdXRhdGVDb250ZXh0KG8sIGtleSwgdmFsdWUpIHtcbiAgaWYgKG8ub3duZWQpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG8ub3duZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChvLm93bmVkW2ldLmNvbnRleHQgPT09IG8uY29udGV4dCkgbXV0YXRlQ29udGV4dChvLm93bmVkW2ldLCBrZXksIHZhbHVlKTtcbiAgICAgIGlmICghby5vd25lZFtpXS5jb250ZXh0KSB7XG4gICAgICAgIG8ub3duZWRbaV0uY29udGV4dCA9IG8uY29udGV4dDtcbiAgICAgICAgbXV0YXRlQ29udGV4dChvLm93bmVkW2ldLCBrZXksIHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoIW8ub3duZWRbaV0uY29udGV4dFtrZXldKSB7XG4gICAgICAgIG8ub3duZWRbaV0uY29udGV4dFtrZXldID0gdmFsdWU7XG4gICAgICAgIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIG9ic2VydmFibGUoaW5wdXQpIHtcbiAgcmV0dXJuIHtcbiAgICBzdWJzY3JpYmUob2JzZXJ2ZXIpIHtcbiAgICAgIGlmICghKG9ic2VydmVyIGluc3RhbmNlb2YgT2JqZWN0KSB8fCBvYnNlcnZlciA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJFeHBlY3RlZCB0aGUgb2JzZXJ2ZXIgdG8gYmUgYW4gb2JqZWN0LlwiKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGhhbmRsZXIgPSB0eXBlb2Ygb2JzZXJ2ZXIgPT09IFwiZnVuY3Rpb25cIiA/IG9ic2VydmVyIDogb2JzZXJ2ZXIubmV4dCAmJiBvYnNlcnZlci5uZXh0LmJpbmQob2JzZXJ2ZXIpO1xuICAgICAgaWYgKCFoYW5kbGVyKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdW5zdWJzY3JpYmUoKSB7fVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgY29uc3QgZGlzcG9zZSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHYgPSBpbnB1dCgpO1xuICAgICAgICAgIHVudHJhY2soKCkgPT4gaGFuZGxlcih2KSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGlzcG9zZXI7XG4gICAgICB9KTtcbiAgICAgIGlmIChnZXRPd25lcigpKSBvbkNsZWFudXAoZGlzcG9zZSk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpIHtcbiAgICAgICAgICBkaXNwb3NlKCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSxcbiAgICBbU3ltYm9sLm9ic2VydmFibGUgfHwgXCJAQG9ic2VydmFibGVcIl0oKSB7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiBmcm9tKHByb2R1Y2VyLCBpbml0YWxWYWx1ZSA9IHVuZGVmaW5lZCkge1xuICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbChpbml0YWxWYWx1ZSwge1xuICAgIGVxdWFsczogZmFsc2VcbiAgfSk7XG4gIGlmIChcInN1YnNjcmliZVwiIGluIHByb2R1Y2VyKSB7XG4gICAgY29uc3QgdW5zdWIgPSBwcm9kdWNlci5zdWJzY3JpYmUodiA9PiBzZXQoKCkgPT4gdikpO1xuICAgIG9uQ2xlYW51cCgoKSA9PiBcInVuc3Vic2NyaWJlXCIgaW4gdW5zdWIgPyB1bnN1Yi51bnN1YnNjcmliZSgpIDogdW5zdWIoKSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgY2xlYW4gPSBwcm9kdWNlcihzZXQpO1xuICAgIG9uQ2xlYW51cChjbGVhbik7XG4gIH1cbiAgcmV0dXJuIHM7XG59XG5cbmNvbnN0IEZBTExCQUNLID0gU3ltYm9sKFwiZmFsbGJhY2tcIik7XG5mdW5jdGlvbiBkaXNwb3NlKGQpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBkLmxlbmd0aDsgaSsrKSBkW2ldKCk7XG59XG5mdW5jdGlvbiBtYXBBcnJheShsaXN0LCBtYXBGbiwgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCBpdGVtcyA9IFtdLFxuICAgIG1hcHBlZCA9IFtdLFxuICAgIGRpc3Bvc2VycyA9IFtdLFxuICAgIGxlbiA9IDAsXG4gICAgaW5kZXhlcyA9IG1hcEZuLmxlbmd0aCA+IDEgPyBbXSA6IG51bGw7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlKGRpc3Bvc2VycykpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGxldCBuZXdJdGVtcyA9IGxpc3QoKSB8fCBbXSxcbiAgICAgIG5ld0xlbiA9IG5ld0l0ZW1zLmxlbmd0aCxcbiAgICAgIGksXG4gICAgICBqO1xuICAgIG5ld0l0ZW1zWyRUUkFDS107XG4gICAgcmV0dXJuIHVudHJhY2soKCkgPT4ge1xuICAgICAgbGV0IG5ld0luZGljZXMsIG5ld0luZGljZXNOZXh0LCB0ZW1wLCB0ZW1wZGlzcG9zZXJzLCB0ZW1wSW5kZXhlcywgc3RhcnQsIGVuZCwgbmV3RW5kLCBpdGVtO1xuICAgICAgaWYgKG5ld0xlbiA9PT0gMCkge1xuICAgICAgICBpZiAobGVuICE9PSAwKSB7XG4gICAgICAgICAgZGlzcG9zZShkaXNwb3NlcnMpO1xuICAgICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgICAgbWFwcGVkID0gW107XG4gICAgICAgICAgbGVuID0gMDtcbiAgICAgICAgICBpbmRleGVzICYmIChpbmRleGVzID0gW10pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLmZhbGxiYWNrKSB7XG4gICAgICAgICAgaXRlbXMgPSBbRkFMTEJBQ0tdO1xuICAgICAgICAgIG1hcHBlZFswXSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZXJzWzBdID0gZGlzcG9zZXI7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9ucy5mYWxsYmFjaygpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxlbiA9IDE7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGxlbiA9PT0gMCkge1xuICAgICAgICBtYXBwZWQgPSBuZXcgQXJyYXkobmV3TGVuKTtcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IG5ld0xlbjsgaisrKSB7XG4gICAgICAgICAgaXRlbXNbal0gPSBuZXdJdGVtc1tqXTtcbiAgICAgICAgICBtYXBwZWRbal0gPSBjcmVhdGVSb290KG1hcHBlcik7XG4gICAgICAgIH1cbiAgICAgICAgbGVuID0gbmV3TGVuO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGVtcCA9IG5ldyBBcnJheShuZXdMZW4pO1xuICAgICAgICB0ZW1wZGlzcG9zZXJzID0gbmV3IEFycmF5KG5ld0xlbik7XG4gICAgICAgIGluZGV4ZXMgJiYgKHRlbXBJbmRleGVzID0gbmV3IEFycmF5KG5ld0xlbikpO1xuICAgICAgICBmb3IgKHN0YXJ0ID0gMCwgZW5kID0gTWF0aC5taW4obGVuLCBuZXdMZW4pOyBzdGFydCA8IGVuZCAmJiBpdGVtc1tzdGFydF0gPT09IG5ld0l0ZW1zW3N0YXJ0XTsgc3RhcnQrKyk7XG4gICAgICAgIGZvciAoZW5kID0gbGVuIC0gMSwgbmV3RW5kID0gbmV3TGVuIC0gMTsgZW5kID49IHN0YXJ0ICYmIG5ld0VuZCA+PSBzdGFydCAmJiBpdGVtc1tlbmRdID09PSBuZXdJdGVtc1tuZXdFbmRdOyBlbmQtLSwgbmV3RW5kLS0pIHtcbiAgICAgICAgICB0ZW1wW25ld0VuZF0gPSBtYXBwZWRbZW5kXTtcbiAgICAgICAgICB0ZW1wZGlzcG9zZXJzW25ld0VuZF0gPSBkaXNwb3NlcnNbZW5kXTtcbiAgICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlc1tuZXdFbmRdID0gaW5kZXhlc1tlbmRdKTtcbiAgICAgICAgfVxuICAgICAgICBuZXdJbmRpY2VzID0gbmV3IE1hcCgpO1xuICAgICAgICBuZXdJbmRpY2VzTmV4dCA9IG5ldyBBcnJheShuZXdFbmQgKyAxKTtcbiAgICAgICAgZm9yIChqID0gbmV3RW5kOyBqID49IHN0YXJ0OyBqLS0pIHtcbiAgICAgICAgICBpdGVtID0gbmV3SXRlbXNbal07XG4gICAgICAgICAgaSA9IG5ld0luZGljZXMuZ2V0KGl0ZW0pO1xuICAgICAgICAgIG5ld0luZGljZXNOZXh0W2pdID0gaSA9PT0gdW5kZWZpbmVkID8gLTEgOiBpO1xuICAgICAgICAgIG5ld0luZGljZXMuc2V0KGl0ZW0sIGopO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IHN0YXJ0OyBpIDw9IGVuZDsgaSsrKSB7XG4gICAgICAgICAgaXRlbSA9IGl0ZW1zW2ldO1xuICAgICAgICAgIGogPSBuZXdJbmRpY2VzLmdldChpdGVtKTtcbiAgICAgICAgICBpZiAoaiAhPT0gdW5kZWZpbmVkICYmIGogIT09IC0xKSB7XG4gICAgICAgICAgICB0ZW1wW2pdID0gbWFwcGVkW2ldO1xuICAgICAgICAgICAgdGVtcGRpc3Bvc2Vyc1tqXSA9IGRpc3Bvc2Vyc1tpXTtcbiAgICAgICAgICAgIGluZGV4ZXMgJiYgKHRlbXBJbmRleGVzW2pdID0gaW5kZXhlc1tpXSk7XG4gICAgICAgICAgICBqID0gbmV3SW5kaWNlc05leHRbal07XG4gICAgICAgICAgICBuZXdJbmRpY2VzLnNldChpdGVtLCBqKTtcbiAgICAgICAgICB9IGVsc2UgZGlzcG9zZXJzW2ldKCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChqID0gc3RhcnQ7IGogPCBuZXdMZW47IGorKykge1xuICAgICAgICAgIGlmIChqIGluIHRlbXApIHtcbiAgICAgICAgICAgIG1hcHBlZFtqXSA9IHRlbXBbal07XG4gICAgICAgICAgICBkaXNwb3NlcnNbal0gPSB0ZW1wZGlzcG9zZXJzW2pdO1xuICAgICAgICAgICAgaWYgKGluZGV4ZXMpIHtcbiAgICAgICAgICAgICAgaW5kZXhlc1tqXSA9IHRlbXBJbmRleGVzW2pdO1xuICAgICAgICAgICAgICBpbmRleGVzW2pdKGopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBtYXBwZWRbal0gPSBjcmVhdGVSb290KG1hcHBlcik7XG4gICAgICAgIH1cbiAgICAgICAgbWFwcGVkID0gbWFwcGVkLnNsaWNlKDAsIGxlbiA9IG5ld0xlbik7XG4gICAgICAgIGl0ZW1zID0gbmV3SXRlbXMuc2xpY2UoMCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWFwcGVkO1xuICAgIH0pO1xuICAgIGZ1bmN0aW9uIG1hcHBlcihkaXNwb3Nlcikge1xuICAgICAgZGlzcG9zZXJzW2pdID0gZGlzcG9zZXI7XG4gICAgICBpZiAoaW5kZXhlcykge1xuICAgICAgICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbChqLCB7XG4gICAgICAgICAgbmFtZTogXCJpbmRleFwiXG4gICAgICAgIH0pIDtcbiAgICAgICAgaW5kZXhlc1tqXSA9IHNldDtcbiAgICAgICAgcmV0dXJuIG1hcEZuKG5ld0l0ZW1zW2pdLCBzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXBGbihuZXdJdGVtc1tqXSk7XG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gaW5kZXhBcnJheShsaXN0LCBtYXBGbiwgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCBpdGVtcyA9IFtdLFxuICAgIG1hcHBlZCA9IFtdLFxuICAgIGRpc3Bvc2VycyA9IFtdLFxuICAgIHNpZ25hbHMgPSBbXSxcbiAgICBsZW4gPSAwLFxuICAgIGk7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlKGRpc3Bvc2VycykpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGNvbnN0IG5ld0l0ZW1zID0gbGlzdCgpIHx8IFtdLFxuICAgICAgbmV3TGVuID0gbmV3SXRlbXMubGVuZ3RoO1xuICAgIG5ld0l0ZW1zWyRUUkFDS107XG4gICAgcmV0dXJuIHVudHJhY2soKCkgPT4ge1xuICAgICAgaWYgKG5ld0xlbiA9PT0gMCkge1xuICAgICAgICBpZiAobGVuICE9PSAwKSB7XG4gICAgICAgICAgZGlzcG9zZShkaXNwb3NlcnMpO1xuICAgICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgICAgbWFwcGVkID0gW107XG4gICAgICAgICAgbGVuID0gMDtcbiAgICAgICAgICBzaWduYWxzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZmFsbGJhY2spIHtcbiAgICAgICAgICBpdGVtcyA9IFtGQUxMQkFDS107XG4gICAgICAgICAgbWFwcGVkWzBdID0gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgICAgICBkaXNwb3NlcnNbMF0gPSBkaXNwb3NlcjtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb25zLmZhbGxiYWNrKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGVuID0gMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWFwcGVkO1xuICAgICAgfVxuICAgICAgaWYgKGl0ZW1zWzBdID09PSBGQUxMQkFDSykge1xuICAgICAgICBkaXNwb3NlcnNbMF0oKTtcbiAgICAgICAgZGlzcG9zZXJzID0gW107XG4gICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICBsZW4gPSAwO1xuICAgICAgfVxuICAgICAgZm9yIChpID0gMDsgaSA8IG5ld0xlbjsgaSsrKSB7XG4gICAgICAgIGlmIChpIDwgaXRlbXMubGVuZ3RoICYmIGl0ZW1zW2ldICE9PSBuZXdJdGVtc1tpXSkge1xuICAgICAgICAgIHNpZ25hbHNbaV0oKCkgPT4gbmV3SXRlbXNbaV0pO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPj0gaXRlbXMubGVuZ3RoKSB7XG4gICAgICAgICAgbWFwcGVkW2ldID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKDsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGRpc3Bvc2Vyc1tpXSgpO1xuICAgICAgfVxuICAgICAgbGVuID0gc2lnbmFscy5sZW5ndGggPSBkaXNwb3NlcnMubGVuZ3RoID0gbmV3TGVuO1xuICAgICAgaXRlbXMgPSBuZXdJdGVtcy5zbGljZSgwKTtcbiAgICAgIHJldHVybiBtYXBwZWQgPSBtYXBwZWQuc2xpY2UoMCwgbGVuKTtcbiAgICB9KTtcbiAgICBmdW5jdGlvbiBtYXBwZXIoZGlzcG9zZXIpIHtcbiAgICAgIGRpc3Bvc2Vyc1tpXSA9IGRpc3Bvc2VyO1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwobmV3SXRlbXNbaV0sIHtcbiAgICAgICAgbmFtZTogXCJ2YWx1ZVwiXG4gICAgICB9KSA7XG4gICAgICBzaWduYWxzW2ldID0gc2V0O1xuICAgICAgcmV0dXJuIG1hcEZuKHMsIGkpO1xuICAgIH1cbiAgfTtcbn1cblxubGV0IGh5ZHJhdGlvbkVuYWJsZWQgPSBmYWxzZTtcbmZ1bmN0aW9uIGVuYWJsZUh5ZHJhdGlvbigpIHtcbiAgaHlkcmF0aW9uRW5hYmxlZCA9IHRydWU7XG59XG5mdW5jdGlvbiBjcmVhdGVDb21wb25lbnQoQ29tcCwgcHJvcHMpIHtcbiAgaWYgKGh5ZHJhdGlvbkVuYWJsZWQpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQpIHtcbiAgICAgIGNvbnN0IGMgPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KG5leHRIeWRyYXRlQ29udGV4dCgpKTtcbiAgICAgIGNvbnN0IHIgPSBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMgfHwge30pIDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGMpO1xuICAgICAgcmV0dXJuIHI7XG4gICAgfVxuICB9XG4gIHJldHVybiBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMgfHwge30pO1xufVxuZnVuY3Rpb24gdHJ1ZUZuKCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cbmNvbnN0IHByb3BUcmFwcyA9IHtcbiAgZ2V0KF8sIHByb3BlcnR5LCByZWNlaXZlcikge1xuICAgIGlmIChwcm9wZXJ0eSA9PT0gJFBST1hZKSByZXR1cm4gcmVjZWl2ZXI7XG4gICAgcmV0dXJuIF8uZ2V0KHByb3BlcnR5KTtcbiAgfSxcbiAgaGFzKF8sIHByb3BlcnR5KSB7XG4gICAgaWYgKHByb3BlcnR5ID09PSAkUFJPWFkpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBfLmhhcyhwcm9wZXJ0eSk7XG4gIH0sXG4gIHNldDogdHJ1ZUZuLFxuICBkZWxldGVQcm9wZXJ0eTogdHJ1ZUZuLFxuICBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoXywgcHJvcGVydHkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGdldCgpIHtcbiAgICAgICAgcmV0dXJuIF8uZ2V0KHByb3BlcnR5KTtcbiAgICAgIH0sXG4gICAgICBzZXQ6IHRydWVGbixcbiAgICAgIGRlbGV0ZVByb3BlcnR5OiB0cnVlRm5cbiAgICB9O1xuICB9LFxuICBvd25LZXlzKF8pIHtcbiAgICByZXR1cm4gXy5rZXlzKCk7XG4gIH1cbn07XG5mdW5jdGlvbiByZXNvbHZlU291cmNlKHMpIHtcbiAgcmV0dXJuICEocyA9IHR5cGVvZiBzID09PSBcImZ1bmN0aW9uXCIgPyBzKCkgOiBzKSA/IHt9IDogcztcbn1cbmZ1bmN0aW9uIHJlc29sdmVTb3VyY2VzKCkge1xuICBmb3IgKGxldCBpID0gMCwgbGVuZ3RoID0gdGhpcy5sZW5ndGg7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGNvbnN0IHYgPSB0aGlzW2ldKCk7XG4gICAgaWYgKHYgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHY7XG4gIH1cbn1cbmZ1bmN0aW9uIG1lcmdlUHJvcHMoLi4uc291cmNlcykge1xuICBsZXQgcHJveHkgPSBmYWxzZTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgcyA9IHNvdXJjZXNbaV07XG4gICAgcHJveHkgPSBwcm94eSB8fCAhIXMgJiYgJFBST1hZIGluIHM7XG4gICAgc291cmNlc1tpXSA9IHR5cGVvZiBzID09PSBcImZ1bmN0aW9uXCIgPyAocHJveHkgPSB0cnVlLCBjcmVhdGVNZW1vKHMpKSA6IHM7XG4gIH1cbiAgaWYgKFNVUFBPUlRTX1BST1hZICYmIHByb3h5KSB7XG4gICAgcmV0dXJuIG5ldyBQcm94eSh7XG4gICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICBjb25zdCB2ID0gcmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKVtwcm9wZXJ0eV07XG4gICAgICAgICAgaWYgKHYgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHY7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICBpZiAocHJvcGVydHkgaW4gcmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKSkgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIGtleXMoKSB7XG4gICAgICAgIGNvbnN0IGtleXMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VzLmxlbmd0aDsgaSsrKSBrZXlzLnB1c2goLi4uT2JqZWN0LmtleXMocmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKSkpO1xuICAgICAgICByZXR1cm4gWy4uLm5ldyBTZXQoa2V5cyldO1xuICAgICAgfVxuICAgIH0sIHByb3BUcmFwcyk7XG4gIH1cbiAgY29uc3Qgc291cmNlc01hcCA9IHt9O1xuICBjb25zdCBkZWZpbmVkID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBjb25zdCBzb3VyY2UgPSBzb3VyY2VzW2ldO1xuICAgIGlmICghc291cmNlKSBjb250aW51ZTtcbiAgICBjb25zdCBzb3VyY2VLZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoc291cmNlKTtcbiAgICBmb3IgKGxldCBpID0gc291cmNlS2V5cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3Qga2V5ID0gc291cmNlS2V5c1tpXTtcbiAgICAgIGlmIChrZXkgPT09IFwiX19wcm90b19fXCIgfHwga2V5ID09PSBcImNvbnN0cnVjdG9yXCIpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Ioc291cmNlLCBrZXkpO1xuICAgICAgaWYgKCFkZWZpbmVkW2tleV0pIHtcbiAgICAgICAgZGVmaW5lZFtrZXldID0gZGVzYy5nZXQgPyB7XG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgZ2V0OiByZXNvbHZlU291cmNlcy5iaW5kKHNvdXJjZXNNYXBba2V5XSA9IFtkZXNjLmdldC5iaW5kKHNvdXJjZSldKVxuICAgICAgICB9IDogZGVzYy52YWx1ZSAhPT0gdW5kZWZpbmVkID8gZGVzYyA6IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZXMgPSBzb3VyY2VzTWFwW2tleV07XG4gICAgICAgIGlmIChzb3VyY2VzKSB7XG4gICAgICAgICAgaWYgKGRlc2MuZ2V0KSBzb3VyY2VzLnB1c2goZGVzYy5nZXQuYmluZChzb3VyY2UpKTtlbHNlIGlmIChkZXNjLnZhbHVlICE9PSB1bmRlZmluZWQpIHNvdXJjZXMucHVzaCgoKSA9PiBkZXNjLnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBjb25zdCB0YXJnZXQgPSB7fTtcbiAgY29uc3QgZGVmaW5lZEtleXMgPSBPYmplY3Qua2V5cyhkZWZpbmVkKTtcbiAgZm9yIChsZXQgaSA9IGRlZmluZWRLZXlzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3Qga2V5ID0gZGVmaW5lZEtleXNbaV0sXG4gICAgICBkZXNjID0gZGVmaW5lZFtrZXldO1xuICAgIGlmIChkZXNjICYmIGRlc2MuZ2V0KSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIGRlc2MpO2Vsc2UgdGFyZ2V0W2tleV0gPSBkZXNjID8gZGVzYy52YWx1ZSA6IHVuZGVmaW5lZDtcbiAgfVxuICByZXR1cm4gdGFyZ2V0O1xufVxuZnVuY3Rpb24gc3BsaXRQcm9wcyhwcm9wcywgLi4ua2V5cykge1xuICBpZiAoU1VQUE9SVFNfUFJPWFkgJiYgJFBST1hZIGluIHByb3BzKSB7XG4gICAgY29uc3QgYmxvY2tlZCA9IG5ldyBTZXQoa2V5cy5sZW5ndGggPiAxID8ga2V5cy5mbGF0KCkgOiBrZXlzWzBdKTtcbiAgICBjb25zdCByZXMgPSBrZXlzLm1hcChrID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJveHkoe1xuICAgICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gay5pbmNsdWRlcyhwcm9wZXJ0eSkgPyBwcm9wc1twcm9wZXJ0eV0gOiB1bmRlZmluZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIGhhcyhwcm9wZXJ0eSkge1xuICAgICAgICAgIHJldHVybiBrLmluY2x1ZGVzKHByb3BlcnR5KSAmJiBwcm9wZXJ0eSBpbiBwcm9wcztcbiAgICAgICAgfSxcbiAgICAgICAga2V5cygpIHtcbiAgICAgICAgICByZXR1cm4gay5maWx0ZXIocHJvcGVydHkgPT4gcHJvcGVydHkgaW4gcHJvcHMpO1xuICAgICAgICB9XG4gICAgICB9LCBwcm9wVHJhcHMpO1xuICAgIH0pO1xuICAgIHJlcy5wdXNoKG5ldyBQcm94eSh7XG4gICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIGJsb2NrZWQuaGFzKHByb3BlcnR5KSA/IHVuZGVmaW5lZCA6IHByb3BzW3Byb3BlcnR5XTtcbiAgICAgIH0sXG4gICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIGJsb2NrZWQuaGFzKHByb3BlcnR5KSA/IGZhbHNlIDogcHJvcGVydHkgaW4gcHJvcHM7XG4gICAgICB9LFxuICAgICAga2V5cygpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHByb3BzKS5maWx0ZXIoayA9PiAhYmxvY2tlZC5oYXMoaykpO1xuICAgICAgfVxuICAgIH0sIHByb3BUcmFwcykpO1xuICAgIHJldHVybiByZXM7XG4gIH1cbiAgY29uc3Qgb3RoZXJPYmplY3QgPSB7fTtcbiAgY29uc3Qgb2JqZWN0cyA9IGtleXMubWFwKCgpID0+ICh7fSkpO1xuICBmb3IgKGNvbnN0IHByb3BOYW1lIG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHByb3BzKSkge1xuICAgIGNvbnN0IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHByb3BzLCBwcm9wTmFtZSk7XG4gICAgY29uc3QgaXNEZWZhdWx0RGVzYyA9ICFkZXNjLmdldCAmJiAhZGVzYy5zZXQgJiYgZGVzYy5lbnVtZXJhYmxlICYmIGRlc2Mud3JpdGFibGUgJiYgZGVzYy5jb25maWd1cmFibGU7XG4gICAgbGV0IGJsb2NrZWQgPSBmYWxzZTtcbiAgICBsZXQgb2JqZWN0SW5kZXggPSAwO1xuICAgIGZvciAoY29uc3QgayBvZiBrZXlzKSB7XG4gICAgICBpZiAoay5pbmNsdWRlcyhwcm9wTmFtZSkpIHtcbiAgICAgICAgYmxvY2tlZCA9IHRydWU7XG4gICAgICAgIGlzRGVmYXVsdERlc2MgPyBvYmplY3RzW29iamVjdEluZGV4XVtwcm9wTmFtZV0gPSBkZXNjLnZhbHVlIDogT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iamVjdHNbb2JqZWN0SW5kZXhdLCBwcm9wTmFtZSwgZGVzYyk7XG4gICAgICB9XG4gICAgICArK29iamVjdEluZGV4O1xuICAgIH1cbiAgICBpZiAoIWJsb2NrZWQpIHtcbiAgICAgIGlzRGVmYXVsdERlc2MgPyBvdGhlck9iamVjdFtwcm9wTmFtZV0gPSBkZXNjLnZhbHVlIDogT2JqZWN0LmRlZmluZVByb3BlcnR5KG90aGVyT2JqZWN0LCBwcm9wTmFtZSwgZGVzYyk7XG4gICAgfVxuICB9XG4gIHJldHVybiBbLi4ub2JqZWN0cywgb3RoZXJPYmplY3RdO1xufVxuZnVuY3Rpb24gbGF6eShmbikge1xuICBsZXQgY29tcDtcbiAgbGV0IHA7XG4gIGNvbnN0IHdyYXAgPSBwcm9wcyA9PiB7XG4gICAgY29uc3QgY3R4ID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgaWYgKGN0eCkge1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoKTtcbiAgICAgIHNoYXJlZENvbmZpZy5jb3VudCB8fCAoc2hhcmVkQ29uZmlnLmNvdW50ID0gMCk7XG4gICAgICBzaGFyZWRDb25maWcuY291bnQrKztcbiAgICAgIChwIHx8IChwID0gZm4oKSkpLnRoZW4obW9kID0+IHtcbiAgICAgICAgIXNoYXJlZENvbmZpZy5kb25lICYmIHNldEh5ZHJhdGVDb250ZXh0KGN0eCk7XG4gICAgICAgIHNoYXJlZENvbmZpZy5jb3VudC0tO1xuICAgICAgICBzZXQoKCkgPT4gbW9kLmRlZmF1bHQpO1xuICAgICAgICBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICAgICAgfSk7XG4gICAgICBjb21wID0gcztcbiAgICB9IGVsc2UgaWYgKCFjb21wKSB7XG4gICAgICBjb25zdCBbc10gPSBjcmVhdGVSZXNvdXJjZSgoKSA9PiAocCB8fCAocCA9IGZuKCkpKS50aGVuKG1vZCA9PiBtb2QuZGVmYXVsdCkpO1xuICAgICAgY29tcCA9IHM7XG4gICAgfVxuICAgIGxldCBDb21wO1xuICAgIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IChDb21wID0gY29tcCgpKSA/IHVudHJhY2soKCkgPT4ge1xuICAgICAgaWYgKElTX0RFVikgT2JqZWN0LmFzc2lnbihDb21wLCB7XG4gICAgICAgIFskREVWQ09NUF06IHRydWVcbiAgICAgIH0pO1xuICAgICAgaWYgKCFjdHggfHwgc2hhcmVkQ29uZmlnLmRvbmUpIHJldHVybiBDb21wKHByb3BzKTtcbiAgICAgIGNvbnN0IGMgPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGN0eCk7XG4gICAgICBjb25zdCByID0gQ29tcChwcm9wcyk7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjKTtcbiAgICAgIHJldHVybiByO1xuICAgIH0pIDogXCJcIik7XG4gIH07XG4gIHdyYXAucHJlbG9hZCA9ICgpID0+IHAgfHwgKChwID0gZm4oKSkudGhlbihtb2QgPT4gY29tcCA9ICgpID0+IG1vZC5kZWZhdWx0KSwgcCk7XG4gIHJldHVybiB3cmFwO1xufVxubGV0IGNvdW50ZXIgPSAwO1xuZnVuY3Rpb24gY3JlYXRlVW5pcXVlSWQoKSB7XG4gIGNvbnN0IGN0eCA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICByZXR1cm4gY3R4ID8gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKSA6IGBjbC0ke2NvdW50ZXIrK31gO1xufVxuXG5jb25zdCBuYXJyb3dlZEVycm9yID0gbmFtZSA9PiBgQXR0ZW1wdGluZyB0byBhY2Nlc3MgYSBzdGFsZSB2YWx1ZSBmcm9tIDwke25hbWV9PiB0aGF0IGNvdWxkIHBvc3NpYmx5IGJlIHVuZGVmaW5lZC4gVGhpcyBtYXkgb2NjdXIgYmVjYXVzZSB5b3UgYXJlIHJlYWRpbmcgdGhlIGFjY2Vzc29yIHJldHVybmVkIGZyb20gdGhlIGNvbXBvbmVudCBhdCBhIHRpbWUgd2hlcmUgaXQgaGFzIGFscmVhZHkgYmVlbiB1bm1vdW50ZWQuIFdlIHJlY29tbWVuZCBjbGVhbmluZyB1cCBhbnkgc3RhbGUgdGltZXJzIG9yIGFzeW5jLCBvciByZWFkaW5nIGZyb20gdGhlIGluaXRpYWwgY29uZGl0aW9uLmAgO1xuZnVuY3Rpb24gRm9yKHByb3BzKSB7XG4gIGNvbnN0IGZhbGxiYWNrID0gXCJmYWxsYmFja1wiIGluIHByb3BzICYmIHtcbiAgICBmYWxsYmFjazogKCkgPT4gcHJvcHMuZmFsbGJhY2tcbiAgfTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8obWFwQXJyYXkoKCkgPT4gcHJvcHMuZWFjaCwgcHJvcHMuY2hpbGRyZW4sIGZhbGxiYWNrIHx8IHVuZGVmaW5lZCksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9KSA7XG59XG5mdW5jdGlvbiBJbmRleChwcm9wcykge1xuICBjb25zdCBmYWxsYmFjayA9IFwiZmFsbGJhY2tcIiBpbiBwcm9wcyAmJiB7XG4gICAgZmFsbGJhY2s6ICgpID0+IHByb3BzLmZhbGxiYWNrXG4gIH07XG4gIHJldHVybiBjcmVhdGVNZW1vKGluZGV4QXJyYXkoKCkgPT4gcHJvcHMuZWFjaCwgcHJvcHMuY2hpbGRyZW4sIGZhbGxiYWNrIHx8IHVuZGVmaW5lZCksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9KSA7XG59XG5mdW5jdGlvbiBTaG93KHByb3BzKSB7XG4gIGNvbnN0IGtleWVkID0gcHJvcHMua2V5ZWQ7XG4gIGNvbnN0IGNvbmRpdGlvblZhbHVlID0gY3JlYXRlTWVtbygoKSA9PiBwcm9wcy53aGVuLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImNvbmRpdGlvbiB2YWx1ZVwiXG4gIH0gKTtcbiAgY29uc3QgY29uZGl0aW9uID0ga2V5ZWQgPyBjb25kaXRpb25WYWx1ZSA6IGNyZWF0ZU1lbW8oY29uZGl0aW9uVmFsdWUsIHVuZGVmaW5lZCwge1xuICAgIGVxdWFsczogKGEsIGIpID0+ICFhID09PSAhYixcbiAgICBuYW1lOiBcImNvbmRpdGlvblwiXG4gIH0gKTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGMgPSBjb25kaXRpb24oKTtcbiAgICBpZiAoYykge1xuICAgICAgY29uc3QgY2hpbGQgPSBwcm9wcy5jaGlsZHJlbjtcbiAgICAgIGNvbnN0IGZuID0gdHlwZW9mIGNoaWxkID09PSBcImZ1bmN0aW9uXCIgJiYgY2hpbGQubGVuZ3RoID4gMDtcbiAgICAgIHJldHVybiBmbiA/IHVudHJhY2soKCkgPT4gY2hpbGQoa2V5ZWQgPyBjIDogKCkgPT4ge1xuICAgICAgICBpZiAoIXVudHJhY2soY29uZGl0aW9uKSkgdGhyb3cgbmFycm93ZWRFcnJvcihcIlNob3dcIik7XG4gICAgICAgIHJldHVybiBjb25kaXRpb25WYWx1ZSgpO1xuICAgICAgfSkpIDogY2hpbGQ7XG4gICAgfVxuICAgIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJ2YWx1ZVwiXG4gIH0gKTtcbn1cbmZ1bmN0aW9uIFN3aXRjaChwcm9wcykge1xuICBjb25zdCBjaHMgPSBjaGlsZHJlbigoKSA9PiBwcm9wcy5jaGlsZHJlbik7XG4gIGNvbnN0IHN3aXRjaEZ1bmMgPSBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBjaCA9IGNocygpO1xuICAgIGNvbnN0IG1wcyA9IEFycmF5LmlzQXJyYXkoY2gpID8gY2ggOiBbY2hdO1xuICAgIGxldCBmdW5jID0gKCkgPT4gdW5kZWZpbmVkO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbmRleCA9IGk7XG4gICAgICBjb25zdCBtcCA9IG1wc1tpXTtcbiAgICAgIGNvbnN0IHByZXZGdW5jID0gZnVuYztcbiAgICAgIGNvbnN0IGNvbmRpdGlvblZhbHVlID0gY3JlYXRlTWVtbygoKSA9PiBwcmV2RnVuYygpID8gdW5kZWZpbmVkIDogbXAud2hlbiwgdW5kZWZpbmVkLCB7XG4gICAgICAgIG5hbWU6IFwiY29uZGl0aW9uIHZhbHVlXCJcbiAgICAgIH0gKTtcbiAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IG1wLmtleWVkID8gY29uZGl0aW9uVmFsdWUgOiBjcmVhdGVNZW1vKGNvbmRpdGlvblZhbHVlLCB1bmRlZmluZWQsIHtcbiAgICAgICAgZXF1YWxzOiAoYSwgYikgPT4gIWEgPT09ICFiLFxuICAgICAgICBuYW1lOiBcImNvbmRpdGlvblwiXG4gICAgICB9ICk7XG4gICAgICBmdW5jID0gKCkgPT4gcHJldkZ1bmMoKSB8fCAoY29uZGl0aW9uKCkgPyBbaW5kZXgsIGNvbmRpdGlvblZhbHVlLCBtcF0gOiB1bmRlZmluZWQpO1xuICAgIH1cbiAgICByZXR1cm4gZnVuYztcbiAgfSk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBzZWwgPSBzd2l0Y2hGdW5jKCkoKTtcbiAgICBpZiAoIXNlbCkgcmV0dXJuIHByb3BzLmZhbGxiYWNrO1xuICAgIGNvbnN0IFtpbmRleCwgY29uZGl0aW9uVmFsdWUsIG1wXSA9IHNlbDtcbiAgICBjb25zdCBjaGlsZCA9IG1wLmNoaWxkcmVuO1xuICAgIGNvbnN0IGZuID0gdHlwZW9mIGNoaWxkID09PSBcImZ1bmN0aW9uXCIgJiYgY2hpbGQubGVuZ3RoID4gMDtcbiAgICByZXR1cm4gZm4gPyB1bnRyYWNrKCgpID0+IGNoaWxkKG1wLmtleWVkID8gY29uZGl0aW9uVmFsdWUoKSA6ICgpID0+IHtcbiAgICAgIGlmICh1bnRyYWNrKHN3aXRjaEZ1bmMpKCk/LlswXSAhPT0gaW5kZXgpIHRocm93IG5hcnJvd2VkRXJyb3IoXCJNYXRjaFwiKTtcbiAgICAgIHJldHVybiBjb25kaXRpb25WYWx1ZSgpO1xuICAgIH0pKSA6IGNoaWxkO1xuICB9LCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImV2YWwgY29uZGl0aW9uc1wiXG4gIH0gKTtcbn1cbmZ1bmN0aW9uIE1hdGNoKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcztcbn1cbmxldCBFcnJvcnM7XG5mdW5jdGlvbiByZXNldEVycm9yQm91bmRhcmllcygpIHtcbiAgRXJyb3JzICYmIFsuLi5FcnJvcnNdLmZvckVhY2goZm4gPT4gZm4oKSk7XG59XG5mdW5jdGlvbiBFcnJvckJvdW5kYXJ5KHByb3BzKSB7XG4gIGxldCBlcnI7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCAmJiBzaGFyZWRDb25maWcubG9hZCkgZXJyID0gc2hhcmVkQ29uZmlnLmxvYWQoc2hhcmVkQ29uZmlnLmdldENvbnRleHRJZCgpKTtcbiAgY29uc3QgW2Vycm9yZWQsIHNldEVycm9yZWRdID0gY3JlYXRlU2lnbmFsKGVyciwge1xuICAgIG5hbWU6IFwiZXJyb3JlZFwiXG4gIH0gKTtcbiAgRXJyb3JzIHx8IChFcnJvcnMgPSBuZXcgU2V0KCkpO1xuICBFcnJvcnMuYWRkKHNldEVycm9yZWQpO1xuICBvbkNsZWFudXAoKCkgPT4gRXJyb3JzLmRlbGV0ZShzZXRFcnJvcmVkKSk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBsZXQgZTtcbiAgICBpZiAoZSA9IGVycm9yZWQoKSkge1xuICAgICAgY29uc3QgZiA9IHByb3BzLmZhbGxiYWNrO1xuICAgICAgaWYgKCh0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiIHx8IGYubGVuZ3RoID09IDApKSBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgcmV0dXJuIHR5cGVvZiBmID09PSBcImZ1bmN0aW9uXCIgJiYgZi5sZW5ndGggPyB1bnRyYWNrKCgpID0+IGYoZSwgKCkgPT4gc2V0RXJyb3JlZCgpKSkgOiBmO1xuICAgIH1cbiAgICByZXR1cm4gY2F0Y2hFcnJvcigoKSA9PiBwcm9wcy5jaGlsZHJlbiwgc2V0RXJyb3JlZCk7XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9ICk7XG59XG5cbmNvbnN0IHN1c3BlbnNlTGlzdEVxdWFscyA9IChhLCBiKSA9PiBhLnNob3dDb250ZW50ID09PSBiLnNob3dDb250ZW50ICYmIGEuc2hvd0ZhbGxiYWNrID09PSBiLnNob3dGYWxsYmFjaztcbmNvbnN0IFN1c3BlbnNlTGlzdENvbnRleHQgPSAvKiAjX19QVVJFX18gKi9jcmVhdGVDb250ZXh0KCk7XG5mdW5jdGlvbiBTdXNwZW5zZUxpc3QocHJvcHMpIHtcbiAgbGV0IFt3cmFwcGVyLCBzZXRXcmFwcGVyXSA9IGNyZWF0ZVNpZ25hbCgoKSA9PiAoe1xuICAgICAgaW5GYWxsYmFjazogZmFsc2VcbiAgICB9KSksXG4gICAgc2hvdztcbiAgY29uc3QgbGlzdENvbnRleHQgPSB1c2VDb250ZXh0KFN1c3BlbnNlTGlzdENvbnRleHQpO1xuICBjb25zdCBbcmVnaXN0cnksIHNldFJlZ2lzdHJ5XSA9IGNyZWF0ZVNpZ25hbChbXSk7XG4gIGlmIChsaXN0Q29udGV4dCkge1xuICAgIHNob3cgPSBsaXN0Q29udGV4dC5yZWdpc3RlcihjcmVhdGVNZW1vKCgpID0+IHdyYXBwZXIoKSgpLmluRmFsbGJhY2spKTtcbiAgfVxuICBjb25zdCByZXNvbHZlZCA9IGNyZWF0ZU1lbW8ocHJldiA9PiB7XG4gICAgY29uc3QgcmV2ZWFsID0gcHJvcHMucmV2ZWFsT3JkZXIsXG4gICAgICB0YWlsID0gcHJvcHMudGFpbCxcbiAgICAgIHtcbiAgICAgICAgc2hvd0NvbnRlbnQgPSB0cnVlLFxuICAgICAgICBzaG93RmFsbGJhY2sgPSB0cnVlXG4gICAgICB9ID0gc2hvdyA/IHNob3coKSA6IHt9LFxuICAgICAgcmVnID0gcmVnaXN0cnkoKSxcbiAgICAgIHJldmVyc2UgPSByZXZlYWwgPT09IFwiYmFja3dhcmRzXCI7XG4gICAgaWYgKHJldmVhbCA9PT0gXCJ0b2dldGhlclwiKSB7XG4gICAgICBjb25zdCBhbGwgPSByZWcuZXZlcnkoaW5GYWxsYmFjayA9PiAhaW5GYWxsYmFjaygpKTtcbiAgICAgIGNvbnN0IHJlcyA9IHJlZy5tYXAoKCkgPT4gKHtcbiAgICAgICAgc2hvd0NvbnRlbnQ6IGFsbCAmJiBzaG93Q29udGVudCxcbiAgICAgICAgc2hvd0ZhbGxiYWNrXG4gICAgICB9KSk7XG4gICAgICByZXMuaW5GYWxsYmFjayA9ICFhbGw7XG4gICAgICByZXR1cm4gcmVzO1xuICAgIH1cbiAgICBsZXQgc3RvcCA9IGZhbHNlO1xuICAgIGxldCBpbkZhbGxiYWNrID0gcHJldi5pbkZhbGxiYWNrO1xuICAgIGNvbnN0IHJlcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSByZWcubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGNvbnN0IG4gPSByZXZlcnNlID8gbGVuIC0gaSAtIDEgOiBpLFxuICAgICAgICBzID0gcmVnW25dKCk7XG4gICAgICBpZiAoIXN0b3AgJiYgIXMpIHtcbiAgICAgICAgcmVzW25dID0ge1xuICAgICAgICAgIHNob3dDb250ZW50LFxuICAgICAgICAgIHNob3dGYWxsYmFja1xuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV4dCA9ICFzdG9wO1xuICAgICAgICBpZiAobmV4dCkgaW5GYWxsYmFjayA9IHRydWU7XG4gICAgICAgIHJlc1tuXSA9IHtcbiAgICAgICAgICBzaG93Q29udGVudDogbmV4dCxcbiAgICAgICAgICBzaG93RmFsbGJhY2s6ICF0YWlsIHx8IG5leHQgJiYgdGFpbCA9PT0gXCJjb2xsYXBzZWRcIiA/IHNob3dGYWxsYmFjayA6IGZhbHNlXG4gICAgICAgIH07XG4gICAgICAgIHN0b3AgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXN0b3ApIGluRmFsbGJhY2sgPSBmYWxzZTtcbiAgICByZXMuaW5GYWxsYmFjayA9IGluRmFsbGJhY2s7XG4gICAgcmV0dXJuIHJlcztcbiAgfSwge1xuICAgIGluRmFsbGJhY2s6IGZhbHNlXG4gIH0pO1xuICBzZXRXcmFwcGVyKCgpID0+IHJlc29sdmVkKTtcbiAgcmV0dXJuIGNyZWF0ZUNvbXBvbmVudChTdXNwZW5zZUxpc3RDb250ZXh0LlByb3ZpZGVyLCB7XG4gICAgdmFsdWU6IHtcbiAgICAgIHJlZ2lzdGVyOiBpbkZhbGxiYWNrID0+IHtcbiAgICAgICAgbGV0IGluZGV4O1xuICAgICAgICBzZXRSZWdpc3RyeShyZWdpc3RyeSA9PiB7XG4gICAgICAgICAgaW5kZXggPSByZWdpc3RyeS5sZW5ndGg7XG4gICAgICAgICAgcmV0dXJuIFsuLi5yZWdpc3RyeSwgaW5GYWxsYmFja107XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiByZXNvbHZlZCgpW2luZGV4XSwgdW5kZWZpbmVkLCB7XG4gICAgICAgICAgZXF1YWxzOiBzdXNwZW5zZUxpc3RFcXVhbHNcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgICBnZXQgY2hpbGRyZW4oKSB7XG4gICAgICByZXR1cm4gcHJvcHMuY2hpbGRyZW47XG4gICAgfVxuICB9KTtcbn1cbmZ1bmN0aW9uIFN1c3BlbnNlKHByb3BzKSB7XG4gIGxldCBjb3VudGVyID0gMCxcbiAgICBzaG93LFxuICAgIGN0eCxcbiAgICBwLFxuICAgIGZsaWNrZXIsXG4gICAgZXJyb3I7XG4gIGNvbnN0IFtpbkZhbGxiYWNrLCBzZXRGYWxsYmFja10gPSBjcmVhdGVTaWduYWwoZmFsc2UpLFxuICAgIFN1c3BlbnNlQ29udGV4dCA9IGdldFN1c3BlbnNlQ29udGV4dCgpLFxuICAgIHN0b3JlID0ge1xuICAgICAgaW5jcmVtZW50OiAoKSA9PiB7XG4gICAgICAgIGlmICgrK2NvdW50ZXIgPT09IDEpIHNldEZhbGxiYWNrKHRydWUpO1xuICAgICAgfSxcbiAgICAgIGRlY3JlbWVudDogKCkgPT4ge1xuICAgICAgICBpZiAoLS1jb3VudGVyID09PSAwKSBzZXRGYWxsYmFjayhmYWxzZSk7XG4gICAgICB9LFxuICAgICAgaW5GYWxsYmFjayxcbiAgICAgIGVmZmVjdHM6IFtdLFxuICAgICAgcmVzb2x2ZWQ6IGZhbHNlXG4gICAgfSxcbiAgICBvd25lciA9IGdldE93bmVyKCk7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCAmJiBzaGFyZWRDb25maWcubG9hZCkge1xuICAgIGNvbnN0IGtleSA9IHNoYXJlZENvbmZpZy5nZXRDb250ZXh0SWQoKTtcbiAgICBsZXQgcmVmID0gc2hhcmVkQ29uZmlnLmxvYWQoa2V5KTtcbiAgICBpZiAocmVmKSB7XG4gICAgICBpZiAodHlwZW9mIHJlZiAhPT0gXCJvYmplY3RcIiB8fCByZWYucyAhPT0gMSkgcCA9IHJlZjtlbHNlIHNoYXJlZENvbmZpZy5nYXRoZXIoa2V5KTtcbiAgICB9XG4gICAgaWYgKHAgJiYgcCAhPT0gXCIkJGZcIikge1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICAgIGVxdWFsczogZmFsc2VcbiAgICAgIH0pO1xuICAgICAgZmxpY2tlciA9IHM7XG4gICAgICBwLnRoZW4oKCkgPT4ge1xuICAgICAgICBpZiAoc2hhcmVkQ29uZmlnLmRvbmUpIHJldHVybiBzZXQoKTtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmdhdGhlcihrZXkpO1xuICAgICAgICBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgICBzZXQoKTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgIH0sIGVyciA9PiB7XG4gICAgICAgIGVycm9yID0gZXJyO1xuICAgICAgICBzZXQoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBjb25zdCBsaXN0Q29udGV4dCA9IHVzZUNvbnRleHQoU3VzcGVuc2VMaXN0Q29udGV4dCk7XG4gIGlmIChsaXN0Q29udGV4dCkgc2hvdyA9IGxpc3RDb250ZXh0LnJlZ2lzdGVyKHN0b3JlLmluRmFsbGJhY2spO1xuICBsZXQgZGlzcG9zZTtcbiAgb25DbGVhbnVwKCgpID0+IGRpc3Bvc2UgJiYgZGlzcG9zZSgpKTtcbiAgcmV0dXJuIGNyZWF0ZUNvbXBvbmVudChTdXNwZW5zZUNvbnRleHQuUHJvdmlkZXIsIHtcbiAgICB2YWx1ZTogc3RvcmUsXG4gICAgZ2V0IGNoaWxkcmVuKCkge1xuICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHRocm93IGVycm9yO1xuICAgICAgICBjdHggPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgICAgaWYgKGZsaWNrZXIpIHtcbiAgICAgICAgICBmbGlja2VyKCk7XG4gICAgICAgICAgcmV0dXJuIGZsaWNrZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN0eCAmJiBwID09PSBcIiQkZlwiKSBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICAgICAgICBjb25zdCByZW5kZXJlZCA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICAgICAgICByZXR1cm4gY3JlYXRlTWVtbyhwcmV2ID0+IHtcbiAgICAgICAgICBjb25zdCBpbkZhbGxiYWNrID0gc3RvcmUuaW5GYWxsYmFjaygpLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzaG93Q29udGVudCA9IHRydWUsXG4gICAgICAgICAgICAgIHNob3dGYWxsYmFjayA9IHRydWVcbiAgICAgICAgICAgIH0gPSBzaG93ID8gc2hvdygpIDoge307XG4gICAgICAgICAgaWYgKCghaW5GYWxsYmFjayB8fCBwICYmIHAgIT09IFwiJCRmXCIpICYmIHNob3dDb250ZW50KSB7XG4gICAgICAgICAgICBzdG9yZS5yZXNvbHZlZCA9IHRydWU7XG4gICAgICAgICAgICBkaXNwb3NlICYmIGRpc3Bvc2UoKTtcbiAgICAgICAgICAgIGRpc3Bvc2UgPSBjdHggPSBwID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgcmVzdW1lRWZmZWN0cyhzdG9yZS5lZmZlY3RzKTtcbiAgICAgICAgICAgIHJldHVybiByZW5kZXJlZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXNob3dGYWxsYmFjaykgcmV0dXJuO1xuICAgICAgICAgIGlmIChkaXNwb3NlKSByZXR1cm4gcHJldjtcbiAgICAgICAgICByZXR1cm4gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgICAgICBkaXNwb3NlID0gZGlzcG9zZXI7XG4gICAgICAgICAgICBpZiAoY3R4KSB7XG4gICAgICAgICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KHtcbiAgICAgICAgICAgICAgICBpZDogY3R4LmlkICsgXCJGXCIsXG4gICAgICAgICAgICAgICAgY291bnQ6IDBcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGN0eCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgICAgICAgICB9LCBvd25lcik7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcbn1cblxuY29uc3QgREVWID0ge1xuICBob29rczogRGV2SG9va3MsXG4gIHdyaXRlU2lnbmFsLFxuICByZWdpc3RlckdyYXBoXG59IDtcbmlmIChnbG9iYWxUaGlzKSB7XG4gIGlmICghZ2xvYmFsVGhpcy5Tb2xpZCQkKSBnbG9iYWxUaGlzLlNvbGlkJCQgPSB0cnVlO2Vsc2UgY29uc29sZS53YXJuKFwiWW91IGFwcGVhciB0byBoYXZlIG11bHRpcGxlIGluc3RhbmNlcyBvZiBTb2xpZC4gVGhpcyBjYW4gbGVhZCB0byB1bmV4cGVjdGVkIGJlaGF2aW9yLlwiKTtcbn1cblxuZXhwb3J0IHsgJERFVkNPTVAsICRQUk9YWSwgJFRSQUNLLCBERVYsIEVycm9yQm91bmRhcnksIEZvciwgSW5kZXgsIE1hdGNoLCBTaG93LCBTdXNwZW5zZSwgU3VzcGVuc2VMaXN0LCBTd2l0Y2gsIGJhdGNoLCBjYW5jZWxDYWxsYmFjaywgY2F0Y2hFcnJvciwgY2hpbGRyZW4sIGNyZWF0ZUNvbXBvbmVudCwgY3JlYXRlQ29tcHV0ZWQsIGNyZWF0ZUNvbnRleHQsIGNyZWF0ZURlZmVycmVkLCBjcmVhdGVFZmZlY3QsIGNyZWF0ZU1lbW8sIGNyZWF0ZVJlYWN0aW9uLCBjcmVhdGVSZW5kZXJFZmZlY3QsIGNyZWF0ZVJlc291cmNlLCBjcmVhdGVSb290LCBjcmVhdGVTZWxlY3RvciwgY3JlYXRlU2lnbmFsLCBjcmVhdGVVbmlxdWVJZCwgZW5hYmxlRXh0ZXJuYWxTb3VyY2UsIGVuYWJsZUh5ZHJhdGlvbiwgZW5hYmxlU2NoZWR1bGluZywgZXF1YWxGbiwgZnJvbSwgZ2V0TGlzdGVuZXIsIGdldE93bmVyLCBpbmRleEFycmF5LCBsYXp5LCBtYXBBcnJheSwgbWVyZ2VQcm9wcywgb2JzZXJ2YWJsZSwgb24sIG9uQ2xlYW51cCwgb25FcnJvciwgb25Nb3VudCwgcmVxdWVzdENhbGxiYWNrLCByZXNldEVycm9yQm91bmRhcmllcywgcnVuV2l0aE93bmVyLCBzaGFyZWRDb25maWcsIHNwbGl0UHJvcHMsIHN0YXJ0VHJhbnNpdGlvbiwgdW50cmFjaywgdXNlQ29udGV4dCwgdXNlVHJhbnNpdGlvbiB9O1xuIiwiaW1wb3J0IHsgY3JlYXRlTWVtbywgY3JlYXRlUm9vdCwgY3JlYXRlUmVuZGVyRWZmZWN0LCB1bnRyYWNrLCBzaGFyZWRDb25maWcsIGVuYWJsZUh5ZHJhdGlvbiwgZ2V0T3duZXIsIGNyZWF0ZUVmZmVjdCwgcnVuV2l0aE93bmVyLCBjcmVhdGVTaWduYWwsIG9uQ2xlYW51cCwgJERFVkNPTVAsIHNwbGl0UHJvcHMgfSBmcm9tICdzb2xpZC1qcyc7XG5leHBvcnQgeyBFcnJvckJvdW5kYXJ5LCBGb3IsIEluZGV4LCBNYXRjaCwgU2hvdywgU3VzcGVuc2UsIFN1c3BlbnNlTGlzdCwgU3dpdGNoLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZVJlbmRlckVmZmVjdCBhcyBlZmZlY3QsIGdldE93bmVyLCBtZXJnZVByb3BzLCB1bnRyYWNrIH0gZnJvbSAnc29saWQtanMnO1xuXG5jb25zdCBib29sZWFucyA9IFtcImFsbG93ZnVsbHNjcmVlblwiLCBcImFzeW5jXCIsIFwiYXV0b2ZvY3VzXCIsIFwiYXV0b3BsYXlcIiwgXCJjaGVja2VkXCIsIFwiY29udHJvbHNcIiwgXCJkZWZhdWx0XCIsIFwiZGlzYWJsZWRcIiwgXCJmb3Jtbm92YWxpZGF0ZVwiLCBcImhpZGRlblwiLCBcImluZGV0ZXJtaW5hdGVcIiwgXCJpbmVydFwiLCBcImlzbWFwXCIsIFwibG9vcFwiLCBcIm11bHRpcGxlXCIsIFwibXV0ZWRcIiwgXCJub21vZHVsZVwiLCBcIm5vdmFsaWRhdGVcIiwgXCJvcGVuXCIsIFwicGxheXNpbmxpbmVcIiwgXCJyZWFkb25seVwiLCBcInJlcXVpcmVkXCIsIFwicmV2ZXJzZWRcIiwgXCJzZWFtbGVzc1wiLCBcInNlbGVjdGVkXCJdO1xuY29uc3QgUHJvcGVydGllcyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImNsYXNzTmFtZVwiLCBcInZhbHVlXCIsIFwicmVhZE9ubHlcIiwgXCJub1ZhbGlkYXRlXCIsIFwiZm9ybU5vVmFsaWRhdGVcIiwgXCJpc01hcFwiLCBcIm5vTW9kdWxlXCIsIFwicGxheXNJbmxpbmVcIiwgLi4uYm9vbGVhbnNdKTtcbmNvbnN0IENoaWxkUHJvcGVydGllcyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImlubmVySFRNTFwiLCBcInRleHRDb250ZW50XCIsIFwiaW5uZXJUZXh0XCIsIFwiY2hpbGRyZW5cIl0pO1xuY29uc3QgQWxpYXNlcyA9IC8qI19fUFVSRV9fKi9PYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUobnVsbCksIHtcbiAgY2xhc3NOYW1lOiBcImNsYXNzXCIsXG4gIGh0bWxGb3I6IFwiZm9yXCJcbn0pO1xuY29uc3QgUHJvcEFsaWFzZXMgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmFzc2lnbihPYmplY3QuY3JlYXRlKG51bGwpLCB7XG4gIGNsYXNzOiBcImNsYXNzTmFtZVwiLFxuICBub3ZhbGlkYXRlOiB7XG4gICAgJDogXCJub1ZhbGlkYXRlXCIsXG4gICAgRk9STTogMVxuICB9LFxuICBmb3Jtbm92YWxpZGF0ZToge1xuICAgICQ6IFwiZm9ybU5vVmFsaWRhdGVcIixcbiAgICBCVVRUT046IDEsXG4gICAgSU5QVVQ6IDFcbiAgfSxcbiAgaXNtYXA6IHtcbiAgICAkOiBcImlzTWFwXCIsXG4gICAgSU1HOiAxXG4gIH0sXG4gIG5vbW9kdWxlOiB7XG4gICAgJDogXCJub01vZHVsZVwiLFxuICAgIFNDUklQVDogMVxuICB9LFxuICBwbGF5c2lubGluZToge1xuICAgICQ6IFwicGxheXNJbmxpbmVcIixcbiAgICBWSURFTzogMVxuICB9LFxuICByZWFkb25seToge1xuICAgICQ6IFwicmVhZE9ubHlcIixcbiAgICBJTlBVVDogMSxcbiAgICBURVhUQVJFQTogMVxuICB9XG59KTtcbmZ1bmN0aW9uIGdldFByb3BBbGlhcyhwcm9wLCB0YWdOYW1lKSB7XG4gIGNvbnN0IGEgPSBQcm9wQWxpYXNlc1twcm9wXTtcbiAgcmV0dXJuIHR5cGVvZiBhID09PSBcIm9iamVjdFwiID8gYVt0YWdOYW1lXSA/IGFbXCIkXCJdIDogdW5kZWZpbmVkIDogYTtcbn1cbmNvbnN0IERlbGVnYXRlZEV2ZW50cyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImJlZm9yZWlucHV0XCIsIFwiY2xpY2tcIiwgXCJkYmxjbGlja1wiLCBcImNvbnRleHRtZW51XCIsIFwiZm9jdXNpblwiLCBcImZvY3Vzb3V0XCIsIFwiaW5wdXRcIiwgXCJrZXlkb3duXCIsIFwia2V5dXBcIiwgXCJtb3VzZWRvd25cIiwgXCJtb3VzZW1vdmVcIiwgXCJtb3VzZW91dFwiLCBcIm1vdXNlb3ZlclwiLCBcIm1vdXNldXBcIiwgXCJwb2ludGVyZG93blwiLCBcInBvaW50ZXJtb3ZlXCIsIFwicG9pbnRlcm91dFwiLCBcInBvaW50ZXJvdmVyXCIsIFwicG9pbnRlcnVwXCIsIFwidG91Y2hlbmRcIiwgXCJ0b3VjaG1vdmVcIiwgXCJ0b3VjaHN0YXJ0XCJdKTtcbmNvbnN0IFNWR0VsZW1lbnRzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1xuXCJhbHRHbHlwaFwiLCBcImFsdEdseXBoRGVmXCIsIFwiYWx0R2x5cGhJdGVtXCIsIFwiYW5pbWF0ZVwiLCBcImFuaW1hdGVDb2xvclwiLCBcImFuaW1hdGVNb3Rpb25cIiwgXCJhbmltYXRlVHJhbnNmb3JtXCIsIFwiY2lyY2xlXCIsIFwiY2xpcFBhdGhcIiwgXCJjb2xvci1wcm9maWxlXCIsIFwiY3Vyc29yXCIsIFwiZGVmc1wiLCBcImRlc2NcIiwgXCJlbGxpcHNlXCIsIFwiZmVCbGVuZFwiLCBcImZlQ29sb3JNYXRyaXhcIiwgXCJmZUNvbXBvbmVudFRyYW5zZmVyXCIsIFwiZmVDb21wb3NpdGVcIiwgXCJmZUNvbnZvbHZlTWF0cml4XCIsIFwiZmVEaWZmdXNlTGlnaHRpbmdcIiwgXCJmZURpc3BsYWNlbWVudE1hcFwiLCBcImZlRGlzdGFudExpZ2h0XCIsIFwiZmVEcm9wU2hhZG93XCIsIFwiZmVGbG9vZFwiLCBcImZlRnVuY0FcIiwgXCJmZUZ1bmNCXCIsIFwiZmVGdW5jR1wiLCBcImZlRnVuY1JcIiwgXCJmZUdhdXNzaWFuQmx1clwiLCBcImZlSW1hZ2VcIiwgXCJmZU1lcmdlXCIsIFwiZmVNZXJnZU5vZGVcIiwgXCJmZU1vcnBob2xvZ3lcIiwgXCJmZU9mZnNldFwiLCBcImZlUG9pbnRMaWdodFwiLCBcImZlU3BlY3VsYXJMaWdodGluZ1wiLCBcImZlU3BvdExpZ2h0XCIsIFwiZmVUaWxlXCIsIFwiZmVUdXJidWxlbmNlXCIsIFwiZmlsdGVyXCIsIFwiZm9udFwiLCBcImZvbnQtZmFjZVwiLCBcImZvbnQtZmFjZS1mb3JtYXRcIiwgXCJmb250LWZhY2UtbmFtZVwiLCBcImZvbnQtZmFjZS1zcmNcIiwgXCJmb250LWZhY2UtdXJpXCIsIFwiZm9yZWlnbk9iamVjdFwiLCBcImdcIiwgXCJnbHlwaFwiLCBcImdseXBoUmVmXCIsIFwiaGtlcm5cIiwgXCJpbWFnZVwiLCBcImxpbmVcIiwgXCJsaW5lYXJHcmFkaWVudFwiLCBcIm1hcmtlclwiLCBcIm1hc2tcIiwgXCJtZXRhZGF0YVwiLCBcIm1pc3NpbmctZ2x5cGhcIiwgXCJtcGF0aFwiLCBcInBhdGhcIiwgXCJwYXR0ZXJuXCIsIFwicG9seWdvblwiLCBcInBvbHlsaW5lXCIsIFwicmFkaWFsR3JhZGllbnRcIiwgXCJyZWN0XCIsXG5cInNldFwiLCBcInN0b3BcIixcblwic3ZnXCIsIFwic3dpdGNoXCIsIFwic3ltYm9sXCIsIFwidGV4dFwiLCBcInRleHRQYXRoXCIsXG5cInRyZWZcIiwgXCJ0c3BhblwiLCBcInVzZVwiLCBcInZpZXdcIiwgXCJ2a2VyblwiXSk7XG5jb25zdCBTVkdOYW1lc3BhY2UgPSB7XG4gIHhsaW5rOiBcImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIixcbiAgeG1sOiBcImh0dHA6Ly93d3cudzMub3JnL1hNTC8xOTk4L25hbWVzcGFjZVwiXG59O1xuY29uc3QgRE9NRWxlbWVudHMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJodG1sXCIsIFwiYmFzZVwiLCBcImhlYWRcIiwgXCJsaW5rXCIsIFwibWV0YVwiLCBcInN0eWxlXCIsIFwidGl0bGVcIiwgXCJib2R5XCIsIFwiYWRkcmVzc1wiLCBcImFydGljbGVcIiwgXCJhc2lkZVwiLCBcImZvb3RlclwiLCBcImhlYWRlclwiLCBcIm1haW5cIiwgXCJuYXZcIiwgXCJzZWN0aW9uXCIsIFwiYm9keVwiLCBcImJsb2NrcXVvdGVcIiwgXCJkZFwiLCBcImRpdlwiLCBcImRsXCIsIFwiZHRcIiwgXCJmaWdjYXB0aW9uXCIsIFwiZmlndXJlXCIsIFwiaHJcIiwgXCJsaVwiLCBcIm9sXCIsIFwicFwiLCBcInByZVwiLCBcInVsXCIsIFwiYVwiLCBcImFiYnJcIiwgXCJiXCIsIFwiYmRpXCIsIFwiYmRvXCIsIFwiYnJcIiwgXCJjaXRlXCIsIFwiY29kZVwiLCBcImRhdGFcIiwgXCJkZm5cIiwgXCJlbVwiLCBcImlcIiwgXCJrYmRcIiwgXCJtYXJrXCIsIFwicVwiLCBcInJwXCIsIFwicnRcIiwgXCJydWJ5XCIsIFwic1wiLCBcInNhbXBcIiwgXCJzbWFsbFwiLCBcInNwYW5cIiwgXCJzdHJvbmdcIiwgXCJzdWJcIiwgXCJzdXBcIiwgXCJ0aW1lXCIsIFwidVwiLCBcInZhclwiLCBcIndiclwiLCBcImFyZWFcIiwgXCJhdWRpb1wiLCBcImltZ1wiLCBcIm1hcFwiLCBcInRyYWNrXCIsIFwidmlkZW9cIiwgXCJlbWJlZFwiLCBcImlmcmFtZVwiLCBcIm9iamVjdFwiLCBcInBhcmFtXCIsIFwicGljdHVyZVwiLCBcInBvcnRhbFwiLCBcInNvdXJjZVwiLCBcInN2Z1wiLCBcIm1hdGhcIiwgXCJjYW52YXNcIiwgXCJub3NjcmlwdFwiLCBcInNjcmlwdFwiLCBcImRlbFwiLCBcImluc1wiLCBcImNhcHRpb25cIiwgXCJjb2xcIiwgXCJjb2xncm91cFwiLCBcInRhYmxlXCIsIFwidGJvZHlcIiwgXCJ0ZFwiLCBcInRmb290XCIsIFwidGhcIiwgXCJ0aGVhZFwiLCBcInRyXCIsIFwiYnV0dG9uXCIsIFwiZGF0YWxpc3RcIiwgXCJmaWVsZHNldFwiLCBcImZvcm1cIiwgXCJpbnB1dFwiLCBcImxhYmVsXCIsIFwibGVnZW5kXCIsIFwibWV0ZXJcIiwgXCJvcHRncm91cFwiLCBcIm9wdGlvblwiLCBcIm91dHB1dFwiLCBcInByb2dyZXNzXCIsIFwic2VsZWN0XCIsIFwidGV4dGFyZWFcIiwgXCJkZXRhaWxzXCIsIFwiZGlhbG9nXCIsIFwibWVudVwiLCBcInN1bW1hcnlcIiwgXCJkZXRhaWxzXCIsIFwic2xvdFwiLCBcInRlbXBsYXRlXCIsIFwiYWNyb255bVwiLCBcImFwcGxldFwiLCBcImJhc2Vmb250XCIsIFwiYmdzb3VuZFwiLCBcImJpZ1wiLCBcImJsaW5rXCIsIFwiY2VudGVyXCIsIFwiY29udGVudFwiLCBcImRpclwiLCBcImZvbnRcIiwgXCJmcmFtZVwiLCBcImZyYW1lc2V0XCIsIFwiaGdyb3VwXCIsIFwiaW1hZ2VcIiwgXCJrZXlnZW5cIiwgXCJtYXJxdWVlXCIsIFwibWVudWl0ZW1cIiwgXCJub2JyXCIsIFwibm9lbWJlZFwiLCBcIm5vZnJhbWVzXCIsIFwicGxhaW50ZXh0XCIsIFwicmJcIiwgXCJydGNcIiwgXCJzaGFkb3dcIiwgXCJzcGFjZXJcIiwgXCJzdHJpa2VcIiwgXCJ0dFwiLCBcInhtcFwiLCBcImFcIiwgXCJhYmJyXCIsIFwiYWNyb255bVwiLCBcImFkZHJlc3NcIiwgXCJhcHBsZXRcIiwgXCJhcmVhXCIsIFwiYXJ0aWNsZVwiLCBcImFzaWRlXCIsIFwiYXVkaW9cIiwgXCJiXCIsIFwiYmFzZVwiLCBcImJhc2Vmb250XCIsIFwiYmRpXCIsIFwiYmRvXCIsIFwiYmdzb3VuZFwiLCBcImJpZ1wiLCBcImJsaW5rXCIsIFwiYmxvY2txdW90ZVwiLCBcImJvZHlcIiwgXCJiclwiLCBcImJ1dHRvblwiLCBcImNhbnZhc1wiLCBcImNhcHRpb25cIiwgXCJjZW50ZXJcIiwgXCJjaXRlXCIsIFwiY29kZVwiLCBcImNvbFwiLCBcImNvbGdyb3VwXCIsIFwiY29udGVudFwiLCBcImRhdGFcIiwgXCJkYXRhbGlzdFwiLCBcImRkXCIsIFwiZGVsXCIsIFwiZGV0YWlsc1wiLCBcImRmblwiLCBcImRpYWxvZ1wiLCBcImRpclwiLCBcImRpdlwiLCBcImRsXCIsIFwiZHRcIiwgXCJlbVwiLCBcImVtYmVkXCIsIFwiZmllbGRzZXRcIiwgXCJmaWdjYXB0aW9uXCIsIFwiZmlndXJlXCIsIFwiZm9udFwiLCBcImZvb3RlclwiLCBcImZvcm1cIiwgXCJmcmFtZVwiLCBcImZyYW1lc2V0XCIsIFwiaGVhZFwiLCBcImhlYWRlclwiLCBcImhncm91cFwiLCBcImhyXCIsIFwiaHRtbFwiLCBcImlcIiwgXCJpZnJhbWVcIiwgXCJpbWFnZVwiLCBcImltZ1wiLCBcImlucHV0XCIsIFwiaW5zXCIsIFwia2JkXCIsIFwia2V5Z2VuXCIsIFwibGFiZWxcIiwgXCJsZWdlbmRcIiwgXCJsaVwiLCBcImxpbmtcIiwgXCJtYWluXCIsIFwibWFwXCIsIFwibWFya1wiLCBcIm1hcnF1ZWVcIiwgXCJtZW51XCIsIFwibWVudWl0ZW1cIiwgXCJtZXRhXCIsIFwibWV0ZXJcIiwgXCJuYXZcIiwgXCJub2JyXCIsIFwibm9lbWJlZFwiLCBcIm5vZnJhbWVzXCIsIFwibm9zY3JpcHRcIiwgXCJvYmplY3RcIiwgXCJvbFwiLCBcIm9wdGdyb3VwXCIsIFwib3B0aW9uXCIsIFwib3V0cHV0XCIsIFwicFwiLCBcInBhcmFtXCIsIFwicGljdHVyZVwiLCBcInBsYWludGV4dFwiLCBcInBvcnRhbFwiLCBcInByZVwiLCBcInByb2dyZXNzXCIsIFwicVwiLCBcInJiXCIsIFwicnBcIiwgXCJydFwiLCBcInJ0Y1wiLCBcInJ1YnlcIiwgXCJzXCIsIFwic2FtcFwiLCBcInNjcmlwdFwiLCBcInNlY3Rpb25cIiwgXCJzZWxlY3RcIiwgXCJzaGFkb3dcIiwgXCJzbG90XCIsIFwic21hbGxcIiwgXCJzb3VyY2VcIiwgXCJzcGFjZXJcIiwgXCJzcGFuXCIsIFwic3RyaWtlXCIsIFwic3Ryb25nXCIsIFwic3R5bGVcIiwgXCJzdWJcIiwgXCJzdW1tYXJ5XCIsIFwic3VwXCIsIFwidGFibGVcIiwgXCJ0Ym9keVwiLCBcInRkXCIsIFwidGVtcGxhdGVcIiwgXCJ0ZXh0YXJlYVwiLCBcInRmb290XCIsIFwidGhcIiwgXCJ0aGVhZFwiLCBcInRpbWVcIiwgXCJ0aXRsZVwiLCBcInRyXCIsIFwidHJhY2tcIiwgXCJ0dFwiLCBcInVcIiwgXCJ1bFwiLCBcInZhclwiLCBcInZpZGVvXCIsIFwid2JyXCIsIFwieG1wXCIsIFwiaW5wdXRcIiwgXCJoMVwiLCBcImgyXCIsIFwiaDNcIiwgXCJoNFwiLCBcImg1XCIsIFwiaDZcIl0pO1xuXG5jb25zdCBtZW1vID0gZm4gPT4gY3JlYXRlTWVtbygoKSA9PiBmbigpKTtcblxuZnVuY3Rpb24gcmVjb25jaWxlQXJyYXlzKHBhcmVudE5vZGUsIGEsIGIpIHtcbiAgbGV0IGJMZW5ndGggPSBiLmxlbmd0aCxcbiAgICBhRW5kID0gYS5sZW5ndGgsXG4gICAgYkVuZCA9IGJMZW5ndGgsXG4gICAgYVN0YXJ0ID0gMCxcbiAgICBiU3RhcnQgPSAwLFxuICAgIGFmdGVyID0gYVthRW5kIC0gMV0ubmV4dFNpYmxpbmcsXG4gICAgbWFwID0gbnVsbDtcbiAgd2hpbGUgKGFTdGFydCA8IGFFbmQgfHwgYlN0YXJ0IDwgYkVuZCkge1xuICAgIGlmIChhW2FTdGFydF0gPT09IGJbYlN0YXJ0XSkge1xuICAgICAgYVN0YXJ0Kys7XG4gICAgICBiU3RhcnQrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICB3aGlsZSAoYVthRW5kIC0gMV0gPT09IGJbYkVuZCAtIDFdKSB7XG4gICAgICBhRW5kLS07XG4gICAgICBiRW5kLS07XG4gICAgfVxuICAgIGlmIChhRW5kID09PSBhU3RhcnQpIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBiRW5kIDwgYkxlbmd0aCA/IGJTdGFydCA/IGJbYlN0YXJ0IC0gMV0ubmV4dFNpYmxpbmcgOiBiW2JFbmQgLSBiU3RhcnRdIDogYWZ0ZXI7XG4gICAgICB3aGlsZSAoYlN0YXJ0IDwgYkVuZCkgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAoYkVuZCA9PT0gYlN0YXJ0KSB7XG4gICAgICB3aGlsZSAoYVN0YXJ0IDwgYUVuZCkge1xuICAgICAgICBpZiAoIW1hcCB8fCAhbWFwLmhhcyhhW2FTdGFydF0pKSBhW2FTdGFydF0ucmVtb3ZlKCk7XG4gICAgICAgIGFTdGFydCsrO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYVthU3RhcnRdID09PSBiW2JFbmQgLSAxXSAmJiBiW2JTdGFydF0gPT09IGFbYUVuZCAtIDFdKSB7XG4gICAgICBjb25zdCBub2RlID0gYVstLWFFbmRdLm5leHRTaWJsaW5nO1xuICAgICAgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIGFbYVN0YXJ0KytdLm5leHRTaWJsaW5nKTtcbiAgICAgIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbLS1iRW5kXSwgbm9kZSk7XG4gICAgICBhW2FFbmRdID0gYltiRW5kXTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFtYXApIHtcbiAgICAgICAgbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICBsZXQgaSA9IGJTdGFydDtcbiAgICAgICAgd2hpbGUgKGkgPCBiRW5kKSBtYXAuc2V0KGJbaV0sIGkrKyk7XG4gICAgICB9XG4gICAgICBjb25zdCBpbmRleCA9IG1hcC5nZXQoYVthU3RhcnRdKTtcbiAgICAgIGlmIChpbmRleCAhPSBudWxsKSB7XG4gICAgICAgIGlmIChiU3RhcnQgPCBpbmRleCAmJiBpbmRleCA8IGJFbmQpIHtcbiAgICAgICAgICBsZXQgaSA9IGFTdGFydCxcbiAgICAgICAgICAgIHNlcXVlbmNlID0gMSxcbiAgICAgICAgICAgIHQ7XG4gICAgICAgICAgd2hpbGUgKCsraSA8IGFFbmQgJiYgaSA8IGJFbmQpIHtcbiAgICAgICAgICAgIGlmICgodCA9IG1hcC5nZXQoYVtpXSkpID09IG51bGwgfHwgdCAhPT0gaW5kZXggKyBzZXF1ZW5jZSkgYnJlYWs7XG4gICAgICAgICAgICBzZXF1ZW5jZSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc2VxdWVuY2UgPiBpbmRleCAtIGJTdGFydCkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGFbYVN0YXJ0XTtcbiAgICAgICAgICAgIHdoaWxlIChiU3RhcnQgPCBpbmRleCkgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIG5vZGUpO1xuICAgICAgICAgIH0gZWxzZSBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChiW2JTdGFydCsrXSwgYVthU3RhcnQrK10pO1xuICAgICAgICB9IGVsc2UgYVN0YXJ0Kys7XG4gICAgICB9IGVsc2UgYVthU3RhcnQrK10ucmVtb3ZlKCk7XG4gICAgfVxuICB9XG59XG5cbmNvbnN0ICQkRVZFTlRTID0gXCJfJERYX0RFTEVHQVRFXCI7XG5mdW5jdGlvbiByZW5kZXIoY29kZSwgZWxlbWVudCwgaW5pdCwgb3B0aW9ucyA9IHt9KSB7XG4gIGlmICghZWxlbWVudCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBgZWxlbWVudGAgcGFzc2VkIHRvIGByZW5kZXIoLi4uLCBlbGVtZW50KWAgZG9lc24ndCBleGlzdC4gTWFrZSBzdXJlIGBlbGVtZW50YCBleGlzdHMgaW4gdGhlIGRvY3VtZW50LlwiKTtcbiAgfVxuICBsZXQgZGlzcG9zZXI7XG4gIGNyZWF0ZVJvb3QoZGlzcG9zZSA9PiB7XG4gICAgZGlzcG9zZXIgPSBkaXNwb3NlO1xuICAgIGVsZW1lbnQgPT09IGRvY3VtZW50ID8gY29kZSgpIDogaW5zZXJ0KGVsZW1lbnQsIGNvZGUoKSwgZWxlbWVudC5maXJzdENoaWxkID8gbnVsbCA6IHVuZGVmaW5lZCwgaW5pdCk7XG4gIH0sIG9wdGlvbnMub3duZXIpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGRpc3Bvc2VyKCk7XG4gICAgZWxlbWVudC50ZXh0Q29udGVudCA9IFwiXCI7XG4gIH07XG59XG5mdW5jdGlvbiB0ZW1wbGF0ZShodG1sLCBpc0ltcG9ydE5vZGUsIGlzU1ZHLCBpc01hdGhNTCkge1xuICBsZXQgbm9kZTtcbiAgY29uc3QgY3JlYXRlID0gKCkgPT4ge1xuICAgIGlmIChpc0h5ZHJhdGluZygpKSB0aHJvdyBuZXcgRXJyb3IoXCJGYWlsZWQgYXR0ZW1wdCB0byBjcmVhdGUgbmV3IERPTSBlbGVtZW50cyBkdXJpbmcgaHlkcmF0aW9uLiBDaGVjayB0aGF0IHRoZSBsaWJyYXJpZXMgeW91IGFyZSB1c2luZyBzdXBwb3J0IGh5ZHJhdGlvbi5cIik7XG4gICAgY29uc3QgdCA9IGlzTWF0aE1MID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMTk5OC9NYXRoL01hdGhNTFwiLCBcInRlbXBsYXRlXCIpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIpO1xuICAgIHQuaW5uZXJIVE1MID0gaHRtbDtcbiAgICByZXR1cm4gaXNTVkcgPyB0LmNvbnRlbnQuZmlyc3RDaGlsZC5maXJzdENoaWxkIDogaXNNYXRoTUwgPyB0LmZpcnN0Q2hpbGQgOiB0LmNvbnRlbnQuZmlyc3RDaGlsZDtcbiAgfTtcbiAgY29uc3QgZm4gPSBpc0ltcG9ydE5vZGUgPyAoKSA9PiB1bnRyYWNrKCgpID0+IGRvY3VtZW50LmltcG9ydE5vZGUobm9kZSB8fCAobm9kZSA9IGNyZWF0ZSgpKSwgdHJ1ZSkpIDogKCkgPT4gKG5vZGUgfHwgKG5vZGUgPSBjcmVhdGUoKSkpLmNsb25lTm9kZSh0cnVlKTtcbiAgZm4uY2xvbmVOb2RlID0gZm47XG4gIHJldHVybiBmbjtcbn1cbmZ1bmN0aW9uIGRlbGVnYXRlRXZlbnRzKGV2ZW50TmFtZXMsIGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50KSB7XG4gIGNvbnN0IGUgPSBkb2N1bWVudFskJEVWRU5UU10gfHwgKGRvY3VtZW50WyQkRVZFTlRTXSA9IG5ldyBTZXQoKSk7XG4gIGZvciAobGV0IGkgPSAwLCBsID0gZXZlbnROYW1lcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBjb25zdCBuYW1lID0gZXZlbnROYW1lc1tpXTtcbiAgICBpZiAoIWUuaGFzKG5hbWUpKSB7XG4gICAgICBlLmFkZChuYW1lKTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZXZlbnRIYW5kbGVyKTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIGNsZWFyRGVsZWdhdGVkRXZlbnRzKGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50KSB7XG4gIGlmIChkb2N1bWVudFskJEVWRU5UU10pIHtcbiAgICBmb3IgKGxldCBuYW1lIG9mIGRvY3VtZW50WyQkRVZFTlRTXS5rZXlzKCkpIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgZXZlbnRIYW5kbGVyKTtcbiAgICBkZWxldGUgZG9jdW1lbnRbJCRFVkVOVFNdO1xuICB9XG59XG5mdW5jdGlvbiBzZXRQcm9wZXJ0eShub2RlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgbm9kZVtuYW1lXSA9IHZhbHVlO1xufVxuZnVuY3Rpb24gc2V0QXR0cmlidXRlKG5vZGUsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBpZiAodmFsdWUgPT0gbnVsbCkgbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7ZWxzZSBub2RlLnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBzZXRBdHRyaWJ1dGVOUyhub2RlLCBuYW1lc3BhY2UsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBpZiAodmFsdWUgPT0gbnVsbCkgbm9kZS5yZW1vdmVBdHRyaWJ1dGVOUyhuYW1lc3BhY2UsIG5hbWUpO2Vsc2Ugbm9kZS5zZXRBdHRyaWJ1dGVOUyhuYW1lc3BhY2UsIG5hbWUsIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIHNldEJvb2xBdHRyaWJ1dGUobm9kZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIHZhbHVlID8gbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgXCJcIikgOiBub2RlLnJlbW92ZUF0dHJpYnV0ZShuYW1lKTtcbn1cbmZ1bmN0aW9uIGNsYXNzTmFtZShub2RlLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlKFwiY2xhc3NcIik7ZWxzZSBub2RlLmNsYXNzTmFtZSA9IHZhbHVlO1xufVxuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcihub2RlLCBuYW1lLCBoYW5kbGVyLCBkZWxlZ2F0ZSkge1xuICBpZiAoZGVsZWdhdGUpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShoYW5kbGVyKSkge1xuICAgICAgbm9kZVtgJCQke25hbWV9YF0gPSBoYW5kbGVyWzBdO1xuICAgICAgbm9kZVtgJCQke25hbWV9RGF0YWBdID0gaGFuZGxlclsxXTtcbiAgICB9IGVsc2Ugbm9kZVtgJCQke25hbWV9YF0gPSBoYW5kbGVyO1xuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaGFuZGxlcikpIHtcbiAgICBjb25zdCBoYW5kbGVyRm4gPSBoYW5kbGVyWzBdO1xuICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBoYW5kbGVyWzBdID0gZSA9PiBoYW5kbGVyRm4uY2FsbChub2RlLCBoYW5kbGVyWzFdLCBlKSk7XG4gIH0gZWxzZSBub2RlLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgaGFuZGxlciwgdHlwZW9mIGhhbmRsZXIgIT09IFwiZnVuY3Rpb25cIiAmJiBoYW5kbGVyKTtcbn1cbmZ1bmN0aW9uIGNsYXNzTGlzdChub2RlLCB2YWx1ZSwgcHJldiA9IHt9KSB7XG4gIGNvbnN0IGNsYXNzS2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlIHx8IHt9KSxcbiAgICBwcmV2S2V5cyA9IE9iamVjdC5rZXlzKHByZXYpO1xuICBsZXQgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBwcmV2S2V5cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNvbnN0IGtleSA9IHByZXZLZXlzW2ldO1xuICAgIGlmICgha2V5IHx8IGtleSA9PT0gXCJ1bmRlZmluZWRcIiB8fCB2YWx1ZVtrZXldKSBjb250aW51ZTtcbiAgICB0b2dnbGVDbGFzc0tleShub2RlLCBrZXksIGZhbHNlKTtcbiAgICBkZWxldGUgcHJldltrZXldO1xuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IGNsYXNzS2V5cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNvbnN0IGtleSA9IGNsYXNzS2V5c1tpXSxcbiAgICAgIGNsYXNzVmFsdWUgPSAhIXZhbHVlW2tleV07XG4gICAgaWYgKCFrZXkgfHwga2V5ID09PSBcInVuZGVmaW5lZFwiIHx8IHByZXZba2V5XSA9PT0gY2xhc3NWYWx1ZSB8fCAhY2xhc3NWYWx1ZSkgY29udGludWU7XG4gICAgdG9nZ2xlQ2xhc3NLZXkobm9kZSwga2V5LCB0cnVlKTtcbiAgICBwcmV2W2tleV0gPSBjbGFzc1ZhbHVlO1xuICB9XG4gIHJldHVybiBwcmV2O1xufVxuZnVuY3Rpb24gc3R5bGUobm9kZSwgdmFsdWUsIHByZXYpIHtcbiAgaWYgKCF2YWx1ZSkgcmV0dXJuIHByZXYgPyBzZXRBdHRyaWJ1dGUobm9kZSwgXCJzdHlsZVwiKSA6IHZhbHVlO1xuICBjb25zdCBub2RlU3R5bGUgPSBub2RlLnN0eWxlO1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSByZXR1cm4gbm9kZVN0eWxlLmNzc1RleHQgPSB2YWx1ZTtcbiAgdHlwZW9mIHByZXYgPT09IFwic3RyaW5nXCIgJiYgKG5vZGVTdHlsZS5jc3NUZXh0ID0gcHJldiA9IHVuZGVmaW5lZCk7XG4gIHByZXYgfHwgKHByZXYgPSB7fSk7XG4gIHZhbHVlIHx8ICh2YWx1ZSA9IHt9KTtcbiAgbGV0IHYsIHM7XG4gIGZvciAocyBpbiBwcmV2KSB7XG4gICAgdmFsdWVbc10gPT0gbnVsbCAmJiBub2RlU3R5bGUucmVtb3ZlUHJvcGVydHkocyk7XG4gICAgZGVsZXRlIHByZXZbc107XG4gIH1cbiAgZm9yIChzIGluIHZhbHVlKSB7XG4gICAgdiA9IHZhbHVlW3NdO1xuICAgIGlmICh2ICE9PSBwcmV2W3NdKSB7XG4gICAgICBub2RlU3R5bGUuc2V0UHJvcGVydHkocywgdik7XG4gICAgICBwcmV2W3NdID0gdjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHByZXY7XG59XG5mdW5jdGlvbiBzcHJlYWQobm9kZSwgcHJvcHMgPSB7fSwgaXNTVkcsIHNraXBDaGlsZHJlbikge1xuICBjb25zdCBwcmV2UHJvcHMgPSB7fTtcbiAgaWYgKCFza2lwQ2hpbGRyZW4pIHtcbiAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gcHJldlByb3BzLmNoaWxkcmVuID0gaW5zZXJ0RXhwcmVzc2lvbihub2RlLCBwcm9wcy5jaGlsZHJlbiwgcHJldlByb3BzLmNoaWxkcmVuKSk7XG4gIH1cbiAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHR5cGVvZiBwcm9wcy5yZWYgPT09IFwiZnVuY3Rpb25cIiAmJiB1c2UocHJvcHMucmVmLCBub2RlKSk7XG4gIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiBhc3NpZ24obm9kZSwgcHJvcHMsIGlzU1ZHLCB0cnVlLCBwcmV2UHJvcHMsIHRydWUpKTtcbiAgcmV0dXJuIHByZXZQcm9wcztcbn1cbmZ1bmN0aW9uIGR5bmFtaWNQcm9wZXJ0eShwcm9wcywga2V5KSB7XG4gIGNvbnN0IHNyYyA9IHByb3BzW2tleV07XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm9wcywga2V5LCB7XG4gICAgZ2V0KCkge1xuICAgICAgcmV0dXJuIHNyYygpO1xuICAgIH0sXG4gICAgZW51bWVyYWJsZTogdHJ1ZVxuICB9KTtcbiAgcmV0dXJuIHByb3BzO1xufVxuZnVuY3Rpb24gdXNlKGZuLCBlbGVtZW50LCBhcmcpIHtcbiAgcmV0dXJuIHVudHJhY2soKCkgPT4gZm4oZWxlbWVudCwgYXJnKSk7XG59XG5mdW5jdGlvbiBpbnNlcnQocGFyZW50LCBhY2Nlc3NvciwgbWFya2VyLCBpbml0aWFsKSB7XG4gIGlmIChtYXJrZXIgIT09IHVuZGVmaW5lZCAmJiAhaW5pdGlhbCkgaW5pdGlhbCA9IFtdO1xuICBpZiAodHlwZW9mIGFjY2Vzc29yICE9PSBcImZ1bmN0aW9uXCIpIHJldHVybiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgYWNjZXNzb3IsIGluaXRpYWwsIG1hcmtlcik7XG4gIGNyZWF0ZVJlbmRlckVmZmVjdChjdXJyZW50ID0+IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCBhY2Nlc3NvcigpLCBjdXJyZW50LCBtYXJrZXIpLCBpbml0aWFsKTtcbn1cbmZ1bmN0aW9uIGFzc2lnbihub2RlLCBwcm9wcywgaXNTVkcsIHNraXBDaGlsZHJlbiwgcHJldlByb3BzID0ge30sIHNraXBSZWYgPSBmYWxzZSkge1xuICBwcm9wcyB8fCAocHJvcHMgPSB7fSk7XG4gIGZvciAoY29uc3QgcHJvcCBpbiBwcmV2UHJvcHMpIHtcbiAgICBpZiAoIShwcm9wIGluIHByb3BzKSkge1xuICAgICAgaWYgKHByb3AgPT09IFwiY2hpbGRyZW5cIikgY29udGludWU7XG4gICAgICBwcmV2UHJvcHNbcHJvcF0gPSBhc3NpZ25Qcm9wKG5vZGUsIHByb3AsIG51bGwsIHByZXZQcm9wc1twcm9wXSwgaXNTVkcsIHNraXBSZWYsIHByb3BzKTtcbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBwcm9wIGluIHByb3BzKSB7XG4gICAgaWYgKHByb3AgPT09IFwiY2hpbGRyZW5cIikge1xuICAgICAgaWYgKCFza2lwQ2hpbGRyZW4pIGluc2VydEV4cHJlc3Npb24obm9kZSwgcHJvcHMuY2hpbGRyZW4pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gcHJvcHNbcHJvcF07XG4gICAgcHJldlByb3BzW3Byb3BdID0gYXNzaWduUHJvcChub2RlLCBwcm9wLCB2YWx1ZSwgcHJldlByb3BzW3Byb3BdLCBpc1NWRywgc2tpcFJlZiwgcHJvcHMpO1xuICB9XG59XG5mdW5jdGlvbiBoeWRyYXRlJDEoY29kZSwgZWxlbWVudCwgb3B0aW9ucyA9IHt9KSB7XG4gIGlmIChnbG9iYWxUaGlzLl8kSFkuZG9uZSkgcmV0dXJuIHJlbmRlcihjb2RlLCBlbGVtZW50LCBbLi4uZWxlbWVudC5jaGlsZE5vZGVzXSwgb3B0aW9ucyk7XG4gIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQgPSBnbG9iYWxUaGlzLl8kSFkuY29tcGxldGVkO1xuICBzaGFyZWRDb25maWcuZXZlbnRzID0gZ2xvYmFsVGhpcy5fJEhZLmV2ZW50cztcbiAgc2hhcmVkQ29uZmlnLmxvYWQgPSBpZCA9PiBnbG9iYWxUaGlzLl8kSFkucltpZF07XG4gIHNoYXJlZENvbmZpZy5oYXMgPSBpZCA9PiBpZCBpbiBnbG9iYWxUaGlzLl8kSFkucjtcbiAgc2hhcmVkQ29uZmlnLmdhdGhlciA9IHJvb3QgPT4gZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCByb290KTtcbiAgc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ID0gbmV3IE1hcCgpO1xuICBzaGFyZWRDb25maWcuY29udGV4dCA9IHtcbiAgICBpZDogb3B0aW9ucy5yZW5kZXJJZCB8fCBcIlwiLFxuICAgIGNvdW50OiAwXG4gIH07XG4gIHRyeSB7XG4gICAgZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCBvcHRpb25zLnJlbmRlcklkKTtcbiAgICByZXR1cm4gcmVuZGVyKGNvZGUsIGVsZW1lbnQsIFsuLi5lbGVtZW50LmNoaWxkTm9kZXNdLCBvcHRpb25zKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBzaGFyZWRDb25maWcuY29udGV4dCA9IG51bGw7XG4gIH1cbn1cbmZ1bmN0aW9uIGdldE5leHRFbGVtZW50KHRlbXBsYXRlKSB7XG4gIGxldCBub2RlLFxuICAgIGtleSxcbiAgICBoeWRyYXRpbmcgPSBpc0h5ZHJhdGluZygpO1xuICBpZiAoIWh5ZHJhdGluZyB8fCAhKG5vZGUgPSBzaGFyZWRDb25maWcucmVnaXN0cnkuZ2V0KGtleSA9IGdldEh5ZHJhdGlvbktleSgpKSkpIHtcbiAgICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgICBzaGFyZWRDb25maWcuZG9uZSA9IHRydWU7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEh5ZHJhdGlvbiBNaXNtYXRjaC4gVW5hYmxlIHRvIGZpbmQgRE9NIG5vZGVzIGZvciBoeWRyYXRpb24ga2V5OiAke2tleX1cXG4ke3RlbXBsYXRlID8gdGVtcGxhdGUoKS5vdXRlckhUTUwgOiBcIlwifWApO1xuICAgIH1cbiAgICByZXR1cm4gdGVtcGxhdGUoKTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmNvbXBsZXRlZCkgc2hhcmVkQ29uZmlnLmNvbXBsZXRlZC5hZGQobm9kZSk7XG4gIHNoYXJlZENvbmZpZy5yZWdpc3RyeS5kZWxldGUoa2V5KTtcbiAgcmV0dXJuIG5vZGU7XG59XG5mdW5jdGlvbiBnZXROZXh0TWF0Y2goZWwsIG5vZGVOYW1lKSB7XG4gIHdoaWxlIChlbCAmJiBlbC5sb2NhbE5hbWUgIT09IG5vZGVOYW1lKSBlbCA9IGVsLm5leHRTaWJsaW5nO1xuICByZXR1cm4gZWw7XG59XG5mdW5jdGlvbiBnZXROZXh0TWFya2VyKHN0YXJ0KSB7XG4gIGxldCBlbmQgPSBzdGFydCxcbiAgICBjb3VudCA9IDAsXG4gICAgY3VycmVudCA9IFtdO1xuICBpZiAoaXNIeWRyYXRpbmcoc3RhcnQpKSB7XG4gICAgd2hpbGUgKGVuZCkge1xuICAgICAgaWYgKGVuZC5ub2RlVHlwZSA9PT0gOCkge1xuICAgICAgICBjb25zdCB2ID0gZW5kLm5vZGVWYWx1ZTtcbiAgICAgICAgaWYgKHYgPT09IFwiJFwiKSBjb3VudCsrO2Vsc2UgaWYgKHYgPT09IFwiL1wiKSB7XG4gICAgICAgICAgaWYgKGNvdW50ID09PSAwKSByZXR1cm4gW2VuZCwgY3VycmVudF07XG4gICAgICAgICAgY291bnQtLTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY3VycmVudC5wdXNoKGVuZCk7XG4gICAgICBlbmQgPSBlbmQubmV4dFNpYmxpbmc7XG4gICAgfVxuICB9XG4gIHJldHVybiBbZW5kLCBjdXJyZW50XTtcbn1cbmZ1bmN0aW9uIHJ1bkh5ZHJhdGlvbkV2ZW50cygpIHtcbiAgaWYgKHNoYXJlZENvbmZpZy5ldmVudHMgJiYgIXNoYXJlZENvbmZpZy5ldmVudHMucXVldWVkKSB7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuICAgICAgY29uc3Qge1xuICAgICAgICBjb21wbGV0ZWQsXG4gICAgICAgIGV2ZW50c1xuICAgICAgfSA9IHNoYXJlZENvbmZpZztcbiAgICAgIGlmICghZXZlbnRzKSByZXR1cm47XG4gICAgICBldmVudHMucXVldWVkID0gZmFsc2U7XG4gICAgICB3aGlsZSAoZXZlbnRzLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBbZWwsIGVdID0gZXZlbnRzWzBdO1xuICAgICAgICBpZiAoIWNvbXBsZXRlZC5oYXMoZWwpKSByZXR1cm47XG4gICAgICAgIGV2ZW50cy5zaGlmdCgpO1xuICAgICAgICBldmVudEhhbmRsZXIoZSk7XG4gICAgICB9XG4gICAgICBpZiAoc2hhcmVkQ29uZmlnLmRvbmUpIHtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmV2ZW50cyA9IF8kSFkuZXZlbnRzID0gbnVsbDtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmNvbXBsZXRlZCA9IF8kSFkuY29tcGxldGVkID0gbnVsbDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBzaGFyZWRDb25maWcuZXZlbnRzLnF1ZXVlZCA9IHRydWU7XG4gIH1cbn1cbmZ1bmN0aW9uIGlzSHlkcmF0aW5nKG5vZGUpIHtcbiAgcmV0dXJuICEhc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgIXNoYXJlZENvbmZpZy5kb25lICYmICghbm9kZSB8fCBub2RlLmlzQ29ubmVjdGVkKTtcbn1cbmZ1bmN0aW9uIHRvUHJvcGVydHlOYW1lKG5hbWUpIHtcbiAgcmV0dXJuIG5hbWUudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC8tKFthLXpdKS9nLCAoXywgdykgPT4gdy50b1VwcGVyQ2FzZSgpKTtcbn1cbmZ1bmN0aW9uIHRvZ2dsZUNsYXNzS2V5KG5vZGUsIGtleSwgdmFsdWUpIHtcbiAgY29uc3QgY2xhc3NOYW1lcyA9IGtleS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgZm9yIChsZXQgaSA9IDAsIG5hbWVMZW4gPSBjbGFzc05hbWVzLmxlbmd0aDsgaSA8IG5hbWVMZW47IGkrKykgbm9kZS5jbGFzc0xpc3QudG9nZ2xlKGNsYXNzTmFtZXNbaV0sIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIGFzc2lnblByb3Aobm9kZSwgcHJvcCwgdmFsdWUsIHByZXYsIGlzU1ZHLCBza2lwUmVmLCBwcm9wcykge1xuICBsZXQgaXNDRSwgaXNQcm9wLCBpc0NoaWxkUHJvcCwgcHJvcEFsaWFzLCBmb3JjZVByb3A7XG4gIGlmIChwcm9wID09PSBcInN0eWxlXCIpIHJldHVybiBzdHlsZShub2RlLCB2YWx1ZSwgcHJldik7XG4gIGlmIChwcm9wID09PSBcImNsYXNzTGlzdFwiKSByZXR1cm4gY2xhc3NMaXN0KG5vZGUsIHZhbHVlLCBwcmV2KTtcbiAgaWYgKHZhbHVlID09PSBwcmV2KSByZXR1cm4gcHJldjtcbiAgaWYgKHByb3AgPT09IFwicmVmXCIpIHtcbiAgICBpZiAoIXNraXBSZWYpIHZhbHVlKG5vZGUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMykgPT09IFwib246XCIpIHtcbiAgICBjb25zdCBlID0gcHJvcC5zbGljZSgzKTtcbiAgICBwcmV2ICYmIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihlLCBwcmV2LCB0eXBlb2YgcHJldiAhPT0gXCJmdW5jdGlvblwiICYmIHByZXYpO1xuICAgIHZhbHVlICYmIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihlLCB2YWx1ZSwgdHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIgJiYgdmFsdWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMTApID09PSBcIm9uY2FwdHVyZTpcIikge1xuICAgIGNvbnN0IGUgPSBwcm9wLnNsaWNlKDEwKTtcbiAgICBwcmV2ICYmIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihlLCBwcmV2LCB0cnVlKTtcbiAgICB2YWx1ZSAmJiBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZSwgdmFsdWUsIHRydWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMikgPT09IFwib25cIikge1xuICAgIGNvbnN0IG5hbWUgPSBwcm9wLnNsaWNlKDIpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgZGVsZWdhdGUgPSBEZWxlZ2F0ZWRFdmVudHMuaGFzKG5hbWUpO1xuICAgIGlmICghZGVsZWdhdGUgJiYgcHJldikge1xuICAgICAgY29uc3QgaCA9IEFycmF5LmlzQXJyYXkocHJldikgPyBwcmV2WzBdIDogcHJldjtcbiAgICAgIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBoKTtcbiAgICB9XG4gICAgaWYgKGRlbGVnYXRlIHx8IHZhbHVlKSB7XG4gICAgICBhZGRFdmVudExpc3RlbmVyKG5vZGUsIG5hbWUsIHZhbHVlLCBkZWxlZ2F0ZSk7XG4gICAgICBkZWxlZ2F0ZSAmJiBkZWxlZ2F0ZUV2ZW50cyhbbmFtZV0pO1xuICAgIH1cbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDUpID09PSBcImF0dHI6XCIpIHtcbiAgICBzZXRBdHRyaWJ1dGUobm9kZSwgcHJvcC5zbGljZSg1KSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgNSkgPT09IFwiYm9vbDpcIikge1xuICAgIHNldEJvb2xBdHRyaWJ1dGUobm9kZSwgcHJvcC5zbGljZSg1KSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKChmb3JjZVByb3AgPSBwcm9wLnNsaWNlKDAsIDUpID09PSBcInByb3A6XCIpIHx8IChpc0NoaWxkUHJvcCA9IENoaWxkUHJvcGVydGllcy5oYXMocHJvcCkpIHx8ICFpc1NWRyAmJiAoKHByb3BBbGlhcyA9IGdldFByb3BBbGlhcyhwcm9wLCBub2RlLnRhZ05hbWUpKSB8fCAoaXNQcm9wID0gUHJvcGVydGllcy5oYXMocHJvcCkpKSB8fCAoaXNDRSA9IG5vZGUubm9kZU5hbWUuaW5jbHVkZXMoXCItXCIpIHx8IFwiaXNcIiBpbiBwcm9wcykpIHtcbiAgICBpZiAoZm9yY2VQcm9wKSB7XG4gICAgICBwcm9wID0gcHJvcC5zbGljZSg1KTtcbiAgICAgIGlzUHJvcCA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuIHZhbHVlO1xuICAgIGlmIChwcm9wID09PSBcImNsYXNzXCIgfHwgcHJvcCA9PT0gXCJjbGFzc05hbWVcIikgY2xhc3NOYW1lKG5vZGUsIHZhbHVlKTtlbHNlIGlmIChpc0NFICYmICFpc1Byb3AgJiYgIWlzQ2hpbGRQcm9wKSBub2RlW3RvUHJvcGVydHlOYW1lKHByb3ApXSA9IHZhbHVlO2Vsc2Ugbm9kZVtwcm9wQWxpYXMgfHwgcHJvcF0gPSB2YWx1ZTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBucyA9IGlzU1ZHICYmIHByb3AuaW5kZXhPZihcIjpcIikgPiAtMSAmJiBTVkdOYW1lc3BhY2VbcHJvcC5zcGxpdChcIjpcIilbMF1dO1xuICAgIGlmIChucykgc2V0QXR0cmlidXRlTlMobm9kZSwgbnMsIHByb3AsIHZhbHVlKTtlbHNlIHNldEF0dHJpYnV0ZShub2RlLCBBbGlhc2VzW3Byb3BdIHx8IHByb3AsIHZhbHVlKTtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5mdW5jdGlvbiBldmVudEhhbmRsZXIoZSkge1xuICBpZiAoc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ICYmIHNoYXJlZENvbmZpZy5ldmVudHMpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmV2ZW50cy5maW5kKChbZWwsIGV2XSkgPT4gZXYgPT09IGUpKSByZXR1cm47XG4gIH1cbiAgbGV0IG5vZGUgPSBlLnRhcmdldDtcbiAgY29uc3Qga2V5ID0gYCQkJHtlLnR5cGV9YDtcbiAgY29uc3Qgb3JpVGFyZ2V0ID0gZS50YXJnZXQ7XG4gIGNvbnN0IG9yaUN1cnJlbnRUYXJnZXQgPSBlLmN1cnJlbnRUYXJnZXQ7XG4gIGNvbnN0IHJldGFyZ2V0ID0gdmFsdWUgPT4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGUsIFwidGFyZ2V0XCIsIHtcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgdmFsdWVcbiAgfSk7XG4gIGNvbnN0IGhhbmRsZU5vZGUgPSAoKSA9PiB7XG4gICAgY29uc3QgaGFuZGxlciA9IG5vZGVba2V5XTtcbiAgICBpZiAoaGFuZGxlciAmJiAhbm9kZS5kaXNhYmxlZCkge1xuICAgICAgY29uc3QgZGF0YSA9IG5vZGVbYCR7a2V5fURhdGFgXTtcbiAgICAgIGRhdGEgIT09IHVuZGVmaW5lZCA/IGhhbmRsZXIuY2FsbChub2RlLCBkYXRhLCBlKSA6IGhhbmRsZXIuY2FsbChub2RlLCBlKTtcbiAgICAgIGlmIChlLmNhbmNlbEJ1YmJsZSkgcmV0dXJuO1xuICAgIH1cbiAgICBub2RlLmhvc3QgJiYgdHlwZW9mIG5vZGUuaG9zdCAhPT0gXCJzdHJpbmdcIiAmJiAhbm9kZS5ob3N0Ll8kaG9zdCAmJiBub2RlLmNvbnRhaW5zKGUudGFyZ2V0KSAmJiByZXRhcmdldChub2RlLmhvc3QpO1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xuICBjb25zdCB3YWxrVXBUcmVlID0gKCkgPT4ge1xuICAgIHdoaWxlIChoYW5kbGVOb2RlKCkgJiYgKG5vZGUgPSBub2RlLl8kaG9zdCB8fCBub2RlLnBhcmVudE5vZGUgfHwgbm9kZS5ob3N0KSk7XG4gIH07XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlLCBcImN1cnJlbnRUYXJnZXRcIiwge1xuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBnZXQoKSB7XG4gICAgICByZXR1cm4gbm9kZSB8fCBkb2N1bWVudDtcbiAgICB9XG4gIH0pO1xuICBpZiAoc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ICYmICFzaGFyZWRDb25maWcuZG9uZSkgc2hhcmVkQ29uZmlnLmRvbmUgPSBfJEhZLmRvbmUgPSB0cnVlO1xuICBpZiAoZS5jb21wb3NlZFBhdGgpIHtcbiAgICBjb25zdCBwYXRoID0gZS5jb21wb3NlZFBhdGgoKTtcbiAgICByZXRhcmdldChwYXRoWzBdKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdGgubGVuZ3RoIC0gMjsgaSsrKSB7XG4gICAgICBub2RlID0gcGF0aFtpXTtcbiAgICAgIGlmICghaGFuZGxlTm9kZSgpKSBicmVhaztcbiAgICAgIGlmIChub2RlLl8kaG9zdCkge1xuICAgICAgICBub2RlID0gbm9kZS5fJGhvc3Q7XG4gICAgICAgIHdhbGtVcFRyZWUoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAobm9kZS5wYXJlbnROb2RlID09PSBvcmlDdXJyZW50VGFyZ2V0KSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBlbHNlIHdhbGtVcFRyZWUoKTtcbiAgcmV0YXJnZXQob3JpVGFyZ2V0KTtcbn1cbmZ1bmN0aW9uIGluc2VydEV4cHJlc3Npb24ocGFyZW50LCB2YWx1ZSwgY3VycmVudCwgbWFya2VyLCB1bndyYXBBcnJheSkge1xuICBjb25zdCBoeWRyYXRpbmcgPSBpc0h5ZHJhdGluZyhwYXJlbnQpO1xuICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgIWN1cnJlbnQgJiYgKGN1cnJlbnQgPSBbLi4ucGFyZW50LmNoaWxkTm9kZXNdKTtcbiAgICBsZXQgY2xlYW5lZCA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY3VycmVudC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgbm9kZSA9IGN1cnJlbnRbaV07XG4gICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gOCAmJiBub2RlLmRhdGEuc2xpY2UoMCwgMikgPT09IFwiISRcIikgbm9kZS5yZW1vdmUoKTtlbHNlIGNsZWFuZWQucHVzaChub2RlKTtcbiAgICB9XG4gICAgY3VycmVudCA9IGNsZWFuZWQ7XG4gIH1cbiAgd2hpbGUgKHR5cGVvZiBjdXJyZW50ID09PSBcImZ1bmN0aW9uXCIpIGN1cnJlbnQgPSBjdXJyZW50KCk7XG4gIGlmICh2YWx1ZSA9PT0gY3VycmVudCkgcmV0dXJuIGN1cnJlbnQ7XG4gIGNvbnN0IHQgPSB0eXBlb2YgdmFsdWUsXG4gICAgbXVsdGkgPSBtYXJrZXIgIT09IHVuZGVmaW5lZDtcbiAgcGFyZW50ID0gbXVsdGkgJiYgY3VycmVudFswXSAmJiBjdXJyZW50WzBdLnBhcmVudE5vZGUgfHwgcGFyZW50O1xuICBpZiAodCA9PT0gXCJzdHJpbmdcIiB8fCB0ID09PSBcIm51bWJlclwiKSB7XG4gICAgaWYgKGh5ZHJhdGluZykgcmV0dXJuIGN1cnJlbnQ7XG4gICAgaWYgKHQgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIHZhbHVlID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gY3VycmVudCkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgfVxuICAgIGlmIChtdWx0aSkge1xuICAgICAgbGV0IG5vZGUgPSBjdXJyZW50WzBdO1xuICAgICAgaWYgKG5vZGUgJiYgbm9kZS5ub2RlVHlwZSA9PT0gMykge1xuICAgICAgICBub2RlLmRhdGEgIT09IHZhbHVlICYmIChub2RlLmRhdGEgPSB2YWx1ZSk7XG4gICAgICB9IGVsc2Ugbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZhbHVlKTtcbiAgICAgIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCBub2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGN1cnJlbnQgIT09IFwiXCIgJiYgdHlwZW9mIGN1cnJlbnQgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgY3VycmVudCA9IHBhcmVudC5maXJzdENoaWxkLmRhdGEgPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSBjdXJyZW50ID0gcGFyZW50LnRleHRDb250ZW50ID0gdmFsdWU7XG4gICAgfVxuICB9IGVsc2UgaWYgKHZhbHVlID09IG51bGwgfHwgdCA9PT0gXCJib29sZWFuXCIpIHtcbiAgICBpZiAoaHlkcmF0aW5nKSByZXR1cm4gY3VycmVudDtcbiAgICBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlcik7XG4gIH0gZWxzZSBpZiAodCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHtcbiAgICAgIGxldCB2ID0gdmFsdWUoKTtcbiAgICAgIHdoaWxlICh0eXBlb2YgdiA9PT0gXCJmdW5jdGlvblwiKSB2ID0gdigpO1xuICAgICAgY3VycmVudCA9IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCB2LCBjdXJyZW50LCBtYXJrZXIpO1xuICAgIH0pO1xuICAgIHJldHVybiAoKSA9PiBjdXJyZW50O1xuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgY29uc3QgYXJyYXkgPSBbXTtcbiAgICBjb25zdCBjdXJyZW50QXJyYXkgPSBjdXJyZW50ICYmIEFycmF5LmlzQXJyYXkoY3VycmVudCk7XG4gICAgaWYgKG5vcm1hbGl6ZUluY29taW5nQXJyYXkoYXJyYXksIHZhbHVlLCBjdXJyZW50LCB1bndyYXBBcnJheSkpIHtcbiAgICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiBjdXJyZW50ID0gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIGFycmF5LCBjdXJyZW50LCBtYXJrZXIsIHRydWUpKTtcbiAgICAgIHJldHVybiAoKSA9PiBjdXJyZW50O1xuICAgIH1cbiAgICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgICBpZiAoIWFycmF5Lmxlbmd0aCkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgICBpZiAobWFya2VyID09PSB1bmRlZmluZWQpIHJldHVybiBjdXJyZW50ID0gWy4uLnBhcmVudC5jaGlsZE5vZGVzXTtcbiAgICAgIGxldCBub2RlID0gYXJyYXlbMF07XG4gICAgICBpZiAobm9kZS5wYXJlbnROb2RlICE9PSBwYXJlbnQpIHJldHVybiBjdXJyZW50O1xuICAgICAgY29uc3Qgbm9kZXMgPSBbbm9kZV07XG4gICAgICB3aGlsZSAoKG5vZGUgPSBub2RlLm5leHRTaWJsaW5nKSAhPT0gbWFya2VyKSBub2Rlcy5wdXNoKG5vZGUpO1xuICAgICAgcmV0dXJuIGN1cnJlbnQgPSBub2RlcztcbiAgICB9XG4gICAgaWYgKGFycmF5Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIpO1xuICAgICAgaWYgKG11bHRpKSByZXR1cm4gY3VycmVudDtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnRBcnJheSkge1xuICAgICAgaWYgKGN1cnJlbnQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXksIG1hcmtlcik7XG4gICAgICB9IGVsc2UgcmVjb25jaWxlQXJyYXlzKHBhcmVudCwgY3VycmVudCwgYXJyYXkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdXJyZW50ICYmIGNsZWFuQ2hpbGRyZW4ocGFyZW50KTtcbiAgICAgIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXkpO1xuICAgIH1cbiAgICBjdXJyZW50ID0gYXJyYXk7XG4gIH0gZWxzZSBpZiAodmFsdWUubm9kZVR5cGUpIHtcbiAgICBpZiAoaHlkcmF0aW5nICYmIHZhbHVlLnBhcmVudE5vZGUpIHJldHVybiBjdXJyZW50ID0gbXVsdGkgPyBbdmFsdWVdIDogdmFsdWU7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoY3VycmVudCkpIHtcbiAgICAgIGlmIChtdWx0aSkgcmV0dXJuIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCB2YWx1ZSk7XG4gICAgICBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbnVsbCwgdmFsdWUpO1xuICAgIH0gZWxzZSBpZiAoY3VycmVudCA9PSBudWxsIHx8IGN1cnJlbnQgPT09IFwiXCIgfHwgIXBhcmVudC5maXJzdENoaWxkKSB7XG4gICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQodmFsdWUpO1xuICAgIH0gZWxzZSBwYXJlbnQucmVwbGFjZUNoaWxkKHZhbHVlLCBwYXJlbnQuZmlyc3RDaGlsZCk7XG4gICAgY3VycmVudCA9IHZhbHVlO1xuICB9IGVsc2UgY29uc29sZS53YXJuKGBVbnJlY29nbml6ZWQgdmFsdWUuIFNraXBwZWQgaW5zZXJ0aW5nYCwgdmFsdWUpO1xuICByZXR1cm4gY3VycmVudDtcbn1cbmZ1bmN0aW9uIG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgYXJyYXksIGN1cnJlbnQsIHVud3JhcCkge1xuICBsZXQgZHluYW1pYyA9IGZhbHNlO1xuICBmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBsZXQgaXRlbSA9IGFycmF5W2ldLFxuICAgICAgcHJldiA9IGN1cnJlbnQgJiYgY3VycmVudFtub3JtYWxpemVkLmxlbmd0aF0sXG4gICAgICB0O1xuICAgIGlmIChpdGVtID09IG51bGwgfHwgaXRlbSA9PT0gdHJ1ZSB8fCBpdGVtID09PSBmYWxzZSkgOyBlbHNlIGlmICgodCA9IHR5cGVvZiBpdGVtKSA9PT0gXCJvYmplY3RcIiAmJiBpdGVtLm5vZGVUeXBlKSB7XG4gICAgICBub3JtYWxpemVkLnB1c2goaXRlbSk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGl0ZW0pKSB7XG4gICAgICBkeW5hbWljID0gbm9ybWFsaXplSW5jb21pbmdBcnJheShub3JtYWxpemVkLCBpdGVtLCBwcmV2KSB8fCBkeW5hbWljO1xuICAgIH0gZWxzZSBpZiAodCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBpZiAodW53cmFwKSB7XG4gICAgICAgIHdoaWxlICh0eXBlb2YgaXRlbSA9PT0gXCJmdW5jdGlvblwiKSBpdGVtID0gaXRlbSgpO1xuICAgICAgICBkeW5hbWljID0gbm9ybWFsaXplSW5jb21pbmdBcnJheShub3JtYWxpemVkLCBBcnJheS5pc0FycmF5KGl0ZW0pID8gaXRlbSA6IFtpdGVtXSwgQXJyYXkuaXNBcnJheShwcmV2KSA/IHByZXYgOiBbcHJldl0pIHx8IGR5bmFtaWM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBub3JtYWxpemVkLnB1c2goaXRlbSk7XG4gICAgICAgIGR5bmFtaWMgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IFN0cmluZyhpdGVtKTtcbiAgICAgIGlmIChwcmV2ICYmIHByZXYubm9kZVR5cGUgPT09IDMgJiYgcHJldi5kYXRhID09PSB2YWx1ZSkgbm9ybWFsaXplZC5wdXNoKHByZXYpO2Vsc2Ugbm9ybWFsaXplZC5wdXNoKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZhbHVlKSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBkeW5hbWljO1xufVxuZnVuY3Rpb24gYXBwZW5kTm9kZXMocGFyZW50LCBhcnJheSwgbWFya2VyID0gbnVsbCkge1xuICBmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHBhcmVudC5pbnNlcnRCZWZvcmUoYXJyYXlbaV0sIG1hcmtlcik7XG59XG5mdW5jdGlvbiBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCByZXBsYWNlbWVudCkge1xuICBpZiAobWFya2VyID09PSB1bmRlZmluZWQpIHJldHVybiBwYXJlbnQudGV4dENvbnRlbnQgPSBcIlwiO1xuICBjb25zdCBub2RlID0gcmVwbGFjZW1lbnQgfHwgZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcIik7XG4gIGlmIChjdXJyZW50Lmxlbmd0aCkge1xuICAgIGxldCBpbnNlcnRlZCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSBjdXJyZW50Lmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBlbCA9IGN1cnJlbnRbaV07XG4gICAgICBpZiAobm9kZSAhPT0gZWwpIHtcbiAgICAgICAgY29uc3QgaXNQYXJlbnQgPSBlbC5wYXJlbnROb2RlID09PSBwYXJlbnQ7XG4gICAgICAgIGlmICghaW5zZXJ0ZWQgJiYgIWkpIGlzUGFyZW50ID8gcGFyZW50LnJlcGxhY2VDaGlsZChub2RlLCBlbCkgOiBwYXJlbnQuaW5zZXJ0QmVmb3JlKG5vZGUsIG1hcmtlcik7ZWxzZSBpc1BhcmVudCAmJiBlbC5yZW1vdmUoKTtcbiAgICAgIH0gZWxzZSBpbnNlcnRlZCA9IHRydWU7XG4gICAgfVxuICB9IGVsc2UgcGFyZW50Lmluc2VydEJlZm9yZShub2RlLCBtYXJrZXIpO1xuICByZXR1cm4gW25vZGVdO1xufVxuZnVuY3Rpb24gZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCByb290KSB7XG4gIGNvbnN0IHRlbXBsYXRlcyA9IGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChgKltkYXRhLWhrXWApO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHRlbXBsYXRlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IG5vZGUgPSB0ZW1wbGF0ZXNbaV07XG4gICAgY29uc3Qga2V5ID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCJkYXRhLWhrXCIpO1xuICAgIGlmICgoIXJvb3QgfHwga2V5LnN0YXJ0c1dpdGgocm9vdCkpICYmICFzaGFyZWRDb25maWcucmVnaXN0cnkuaGFzKGtleSkpIHNoYXJlZENvbmZpZy5yZWdpc3RyeS5zZXQoa2V5LCBub2RlKTtcbiAgfVxufVxuZnVuY3Rpb24gZ2V0SHlkcmF0aW9uS2V5KCkge1xuICByZXR1cm4gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKTtcbn1cbmZ1bmN0aW9uIE5vSHlkcmF0aW9uKHByb3BzKSB7XG4gIHJldHVybiBzaGFyZWRDb25maWcuY29udGV4dCA/IHVuZGVmaW5lZCA6IHByb3BzLmNoaWxkcmVuO1xufVxuZnVuY3Rpb24gSHlkcmF0aW9uKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcy5jaGlsZHJlbjtcbn1cbmNvbnN0IHZvaWRGbiA9ICgpID0+IHVuZGVmaW5lZDtcbmNvbnN0IFJlcXVlc3RDb250ZXh0ID0gU3ltYm9sKCk7XG5mdW5jdGlvbiBpbm5lckhUTUwocGFyZW50LCBjb250ZW50KSB7XG4gICFzaGFyZWRDb25maWcuY29udGV4dCAmJiAocGFyZW50LmlubmVySFRNTCA9IGNvbnRlbnQpO1xufVxuXG5mdW5jdGlvbiB0aHJvd0luQnJvd3NlcihmdW5jKSB7XG4gIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgJHtmdW5jLm5hbWV9IGlzIG5vdCBzdXBwb3J0ZWQgaW4gdGhlIGJyb3dzZXIsIHJldHVybmluZyB1bmRlZmluZWRgKTtcbiAgY29uc29sZS5lcnJvcihlcnIpO1xufVxuZnVuY3Rpb24gcmVuZGVyVG9TdHJpbmcoZm4sIG9wdGlvbnMpIHtcbiAgdGhyb3dJbkJyb3dzZXIocmVuZGVyVG9TdHJpbmcpO1xufVxuZnVuY3Rpb24gcmVuZGVyVG9TdHJpbmdBc3luYyhmbiwgb3B0aW9ucykge1xuICB0aHJvd0luQnJvd3NlcihyZW5kZXJUb1N0cmluZ0FzeW5jKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyZWFtKGZuLCBvcHRpb25zKSB7XG4gIHRocm93SW5Ccm93c2VyKHJlbmRlclRvU3RyZWFtKTtcbn1cbmZ1bmN0aW9uIHNzcih0ZW1wbGF0ZSwgLi4ubm9kZXMpIHt9XG5mdW5jdGlvbiBzc3JFbGVtZW50KG5hbWUsIHByb3BzLCBjaGlsZHJlbiwgbmVlZHNJZCkge31cbmZ1bmN0aW9uIHNzckNsYXNzTGlzdCh2YWx1ZSkge31cbmZ1bmN0aW9uIHNzclN0eWxlKHZhbHVlKSB7fVxuZnVuY3Rpb24gc3NyQXR0cmlidXRlKGtleSwgdmFsdWUpIHt9XG5mdW5jdGlvbiBzc3JIeWRyYXRpb25LZXkoKSB7fVxuZnVuY3Rpb24gcmVzb2x2ZVNTUk5vZGUobm9kZSkge31cbmZ1bmN0aW9uIGVzY2FwZShodG1sKSB7fVxuZnVuY3Rpb24gc3NyU3ByZWFkKHByb3BzLCBpc1NWRywgc2tpcENoaWxkcmVuKSB7fVxuXG5jb25zdCBpc1NlcnZlciA9IGZhbHNlO1xuY29uc3QgaXNEZXYgPSB0cnVlO1xuY29uc3QgU1ZHX05BTUVTUEFDRSA9IFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIjtcbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQodGFnTmFtZSwgaXNTVkcgPSBmYWxzZSkge1xuICByZXR1cm4gaXNTVkcgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoU1ZHX05BTUVTUEFDRSwgdGFnTmFtZSkgOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xufVxuY29uc3QgaHlkcmF0ZSA9ICguLi5hcmdzKSA9PiB7XG4gIGVuYWJsZUh5ZHJhdGlvbigpO1xuICByZXR1cm4gaHlkcmF0ZSQxKC4uLmFyZ3MpO1xufTtcbmZ1bmN0aW9uIFBvcnRhbChwcm9wcykge1xuICBjb25zdCB7XG4gICAgICB1c2VTaGFkb3dcbiAgICB9ID0gcHJvcHMsXG4gICAgbWFya2VyID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcIiksXG4gICAgbW91bnQgPSAoKSA9PiBwcm9wcy5tb3VudCB8fCBkb2N1bWVudC5ib2R5LFxuICAgIG93bmVyID0gZ2V0T3duZXIoKTtcbiAgbGV0IGNvbnRlbnQ7XG4gIGxldCBoeWRyYXRpbmcgPSAhIXNoYXJlZENvbmZpZy5jb250ZXh0O1xuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChoeWRyYXRpbmcpIGdldE93bmVyKCkudXNlciA9IGh5ZHJhdGluZyA9IGZhbHNlO1xuICAgIGNvbnRlbnQgfHwgKGNvbnRlbnQgPSBydW5XaXRoT3duZXIob3duZXIsICgpID0+IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMuY2hpbGRyZW4pKSk7XG4gICAgY29uc3QgZWwgPSBtb3VudCgpO1xuICAgIGlmIChlbCBpbnN0YW5jZW9mIEhUTUxIZWFkRWxlbWVudCkge1xuICAgICAgY29uc3QgW2NsZWFuLCBzZXRDbGVhbl0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICAgICAgY29uc3QgY2xlYW51cCA9ICgpID0+IHNldENsZWFuKHRydWUpO1xuICAgICAgY3JlYXRlUm9vdChkaXNwb3NlID0+IGluc2VydChlbCwgKCkgPT4gIWNsZWFuKCkgPyBjb250ZW50KCkgOiBkaXNwb3NlKCksIG51bGwpKTtcbiAgICAgIG9uQ2xlYW51cChjbGVhbnVwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgY29udGFpbmVyID0gY3JlYXRlRWxlbWVudChwcm9wcy5pc1NWRyA/IFwiZ1wiIDogXCJkaXZcIiwgcHJvcHMuaXNTVkcpLFxuICAgICAgICByZW5kZXJSb290ID0gdXNlU2hhZG93ICYmIGNvbnRhaW5lci5hdHRhY2hTaGFkb3cgPyBjb250YWluZXIuYXR0YWNoU2hhZG93KHtcbiAgICAgICAgICBtb2RlOiBcIm9wZW5cIlxuICAgICAgICB9KSA6IGNvbnRhaW5lcjtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb250YWluZXIsIFwiXyRob3N0XCIsIHtcbiAgICAgICAgZ2V0KCkge1xuICAgICAgICAgIHJldHVybiBtYXJrZXIucGFyZW50Tm9kZTtcbiAgICAgICAgfSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIGluc2VydChyZW5kZXJSb290LCBjb250ZW50KTtcbiAgICAgIGVsLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG4gICAgICBwcm9wcy5yZWYgJiYgcHJvcHMucmVmKGNvbnRhaW5lcik7XG4gICAgICBvbkNsZWFudXAoKCkgPT4gZWwucmVtb3ZlQ2hpbGQoY29udGFpbmVyKSk7XG4gICAgfVxuICB9LCB1bmRlZmluZWQsIHtcbiAgICByZW5kZXI6ICFoeWRyYXRpbmdcbiAgfSk7XG4gIHJldHVybiBtYXJrZXI7XG59XG5mdW5jdGlvbiBjcmVhdGVEeW5hbWljKGNvbXBvbmVudCwgcHJvcHMpIHtcbiAgY29uc3QgY2FjaGVkID0gY3JlYXRlTWVtbyhjb21wb25lbnQpO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgY29tcG9uZW50ID0gY2FjaGVkKCk7XG4gICAgc3dpdGNoICh0eXBlb2YgY29tcG9uZW50KSB7XG4gICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgICAgT2JqZWN0LmFzc2lnbihjb21wb25lbnQsIHtcbiAgICAgICAgICBbJERFVkNPTVBdOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdW50cmFjaygoKSA9PiBjb21wb25lbnQocHJvcHMpKTtcbiAgICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgICAgY29uc3QgaXNTdmcgPSBTVkdFbGVtZW50cy5oYXMoY29tcG9uZW50KTtcbiAgICAgICAgY29uc3QgZWwgPSBzaGFyZWRDb25maWcuY29udGV4dCA/IGdldE5leHRFbGVtZW50KCkgOiBjcmVhdGVFbGVtZW50KGNvbXBvbmVudCwgaXNTdmcpO1xuICAgICAgICBzcHJlYWQoZWwsIHByb3BzLCBpc1N2Zyk7XG4gICAgICAgIHJldHVybiBlbDtcbiAgICB9XG4gIH0pO1xufVxuZnVuY3Rpb24gRHluYW1pYyhwcm9wcykge1xuICBjb25zdCBbLCBvdGhlcnNdID0gc3BsaXRQcm9wcyhwcm9wcywgW1wiY29tcG9uZW50XCJdKTtcbiAgcmV0dXJuIGNyZWF0ZUR5bmFtaWMoKCkgPT4gcHJvcHMuY29tcG9uZW50LCBvdGhlcnMpO1xufVxuXG5leHBvcnQgeyBBbGlhc2VzLCB2b2lkRm4gYXMgQXNzZXRzLCBDaGlsZFByb3BlcnRpZXMsIERPTUVsZW1lbnRzLCBEZWxlZ2F0ZWRFdmVudHMsIER5bmFtaWMsIEh5ZHJhdGlvbiwgdm9pZEZuIGFzIEh5ZHJhdGlvblNjcmlwdCwgTm9IeWRyYXRpb24sIFBvcnRhbCwgUHJvcGVydGllcywgUmVxdWVzdENvbnRleHQsIFNWR0VsZW1lbnRzLCBTVkdOYW1lc3BhY2UsIGFkZEV2ZW50TGlzdGVuZXIsIGFzc2lnbiwgY2xhc3NMaXN0LCBjbGFzc05hbWUsIGNsZWFyRGVsZWdhdGVkRXZlbnRzLCBjcmVhdGVEeW5hbWljLCBkZWxlZ2F0ZUV2ZW50cywgZHluYW1pY1Byb3BlcnR5LCBlc2NhcGUsIHZvaWRGbiBhcyBnZW5lcmF0ZUh5ZHJhdGlvblNjcmlwdCwgdm9pZEZuIGFzIGdldEFzc2V0cywgZ2V0SHlkcmF0aW9uS2V5LCBnZXROZXh0RWxlbWVudCwgZ2V0TmV4dE1hcmtlciwgZ2V0TmV4dE1hdGNoLCBnZXRQcm9wQWxpYXMsIHZvaWRGbiBhcyBnZXRSZXF1ZXN0RXZlbnQsIGh5ZHJhdGUsIGlubmVySFRNTCwgaW5zZXJ0LCBpc0RldiwgaXNTZXJ2ZXIsIG1lbW8sIHJlbmRlciwgcmVuZGVyVG9TdHJlYW0sIHJlbmRlclRvU3RyaW5nLCByZW5kZXJUb1N0cmluZ0FzeW5jLCByZXNvbHZlU1NSTm9kZSwgcnVuSHlkcmF0aW9uRXZlbnRzLCBzZXRBdHRyaWJ1dGUsIHNldEF0dHJpYnV0ZU5TLCBzZXRCb29sQXR0cmlidXRlLCBzZXRQcm9wZXJ0eSwgc3ByZWFkLCBzc3IsIHNzckF0dHJpYnV0ZSwgc3NyQ2xhc3NMaXN0LCBzc3JFbGVtZW50LCBzc3JIeWRyYXRpb25LZXksIHNzclNwcmVhZCwgc3NyU3R5bGUsIHN0eWxlLCB0ZW1wbGF0ZSwgdXNlLCB2b2lkRm4gYXMgdXNlQXNzZXRzIH07XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCIvLyBHZW5lcmF0ZWQgdXNpbmcgYG5wbSBydW4gYnVpbGRgLiBEbyBub3QgZWRpdC5cblxudmFyIHJlZ2V4ID0gL15bYS16XSg/OltcXC4wLTlfYS16XFx4QjdcXHhDMC1cXHhENlxceEQ4LVxceEY2XFx4RjgtXFx1MDM3RFxcdTAzN0YtXFx1MUZGRlxcdTIwMENcXHUyMDBEXFx1MjAzRlxcdTIwNDBcXHUyMDcwLVxcdTIxOEZcXHUyQzAwLVxcdTJGRUZcXHUzMDAxLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRkRdfFtcXHVEODAwLVxcdURCN0ZdW1xcdURDMDAtXFx1REZGRl0pKi0oPzpbXFx4MkRcXC4wLTlfYS16XFx4QjdcXHhDMC1cXHhENlxceEQ4LVxceEY2XFx4RjgtXFx1MDM3RFxcdTAzN0YtXFx1MUZGRlxcdTIwMENcXHUyMDBEXFx1MjAzRlxcdTIwNDBcXHUyMDcwLVxcdTIxOEZcXHUyQzAwLVxcdTJGRUZcXHUzMDAxLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRkRdfFtcXHVEODAwLVxcdURCN0ZdW1xcdURDMDAtXFx1REZGRl0pKiQvO1xuXG52YXIgaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSA9IGZ1bmN0aW9uKHN0cmluZykge1xuXHRyZXR1cm4gcmVnZXgudGVzdChzdHJpbmcpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lO1xuIiwidmFyIF9fYXN5bmMgPSAoX190aGlzLCBfX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSA9PiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgdmFyIGZ1bGZpbGxlZCA9ICh2YWx1ZSkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZWplY3QoZSk7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgcmVqZWN0ZWQgPSAodmFsdWUpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHN0ZXAoZ2VuZXJhdG9yLnRocm93KHZhbHVlKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciBzdGVwID0gKHgpID0+IHguZG9uZSA/IHJlc29sdmUoeC52YWx1ZSkgOiBQcm9taXNlLnJlc29sdmUoeC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTtcbiAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkoX190aGlzLCBfX2FyZ3VtZW50cykpLm5leHQoKSk7XG4gIH0pO1xufTtcblxuLy8gc3JjL2luZGV4LnRzXG5pbXBvcnQgaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSBmcm9tIFwiaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWVcIjtcbmZ1bmN0aW9uIGNyZWF0ZUlzb2xhdGVkRWxlbWVudChvcHRpb25zKSB7XG4gIHJldHVybiBfX2FzeW5jKHRoaXMsIG51bGwsIGZ1bmN0aW9uKiAoKSB7XG4gICAgY29uc3QgeyBuYW1lLCBtb2RlID0gXCJjbG9zZWRcIiwgY3NzLCBpc29sYXRlRXZlbnRzID0gZmFsc2UgfSA9IG9wdGlvbnM7XG4gICAgaWYgKCFpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lKG5hbWUpKSB7XG4gICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgYFwiJHtuYW1lfVwiIGlzIG5vdCBhIHZhbGlkIGN1c3RvbSBlbGVtZW50IG5hbWUuIEl0IG11c3QgYmUgdHdvIHdvcmRzIGFuZCBrZWJhYi1jYXNlLCB3aXRoIGEgZmV3IGV4Y2VwdGlvbnMuIFNlZSBzcGVjIGZvciBtb3JlIGRldGFpbHM6IGh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL2N1c3RvbS1lbGVtZW50cy5odG1sI3ZhbGlkLWN1c3RvbS1lbGVtZW50LW5hbWVgXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCBwYXJlbnRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChuYW1lKTtcbiAgICBjb25zdCBzaGFkb3cgPSBwYXJlbnRFbGVtZW50LmF0dGFjaFNoYWRvdyh7IG1vZGUgfSk7XG4gICAgY29uc3QgaXNvbGF0ZWRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImh0bWxcIik7XG4gICAgY29uc3QgYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJib2R5XCIpO1xuICAgIGNvbnN0IGhlYWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaGVhZFwiKTtcbiAgICBpZiAoY3NzKSB7XG4gICAgICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcbiAgICAgIGlmIChcInVybFwiIGluIGNzcykge1xuICAgICAgICBzdHlsZS50ZXh0Q29udGVudCA9IHlpZWxkIGZldGNoKGNzcy51cmwpLnRoZW4oKHJlcykgPT4gcmVzLnRleHQoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHlsZS50ZXh0Q29udGVudCA9IGNzcy50ZXh0Q29udGVudDtcbiAgICAgIH1cbiAgICAgIGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICAgIH1cbiAgICBpc29sYXRlZEVsZW1lbnQuYXBwZW5kQ2hpbGQoaGVhZCk7XG4gICAgaXNvbGF0ZWRFbGVtZW50LmFwcGVuZENoaWxkKGJvZHkpO1xuICAgIHNoYWRvdy5hcHBlbmRDaGlsZChpc29sYXRlZEVsZW1lbnQpO1xuICAgIGlmIChpc29sYXRlRXZlbnRzKSB7XG4gICAgICBjb25zdCBldmVudFR5cGVzID0gQXJyYXkuaXNBcnJheShpc29sYXRlRXZlbnRzKSA/IGlzb2xhdGVFdmVudHMgOiBbXCJrZXlkb3duXCIsIFwia2V5dXBcIiwgXCJrZXlwcmVzc1wiXTtcbiAgICAgIGV2ZW50VHlwZXMuZm9yRWFjaCgoZXZlbnRUeXBlKSA9PiB7XG4gICAgICAgIGJvZHkuYWRkRXZlbnRMaXN0ZW5lcihldmVudFR5cGUsIChlKSA9PiBlLnN0b3BQcm9wYWdhdGlvbigpKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgcGFyZW50RWxlbWVudCxcbiAgICAgIHNoYWRvdyxcbiAgICAgIGlzb2xhdGVkRWxlbWVudDogYm9keVxuICAgIH07XG4gIH0pO1xufVxuZXhwb3J0IHtcbiAgY3JlYXRlSXNvbGF0ZWRFbGVtZW50XG59O1xuIiwiY29uc3QgbnVsbEtleSA9IFN5bWJvbCgnbnVsbCcpOyAvLyBgb2JqZWN0SGFzaGVzYCBrZXkgZm9yIG51bGxcblxubGV0IGtleUNvdW50ZXIgPSAwO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNYW55S2V5c01hcCBleHRlbmRzIE1hcCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9vYmplY3RIYXNoZXMgPSBuZXcgV2Vha01hcCgpO1xuXHRcdHRoaXMuX3N5bWJvbEhhc2hlcyA9IG5ldyBNYXAoKTsgLy8gaHR0cHM6Ly9naXRodWIuY29tL3RjMzkvZWNtYTI2Mi9pc3N1ZXMvMTE5NFxuXHRcdHRoaXMuX3B1YmxpY0tleXMgPSBuZXcgTWFwKCk7XG5cblx0XHRjb25zdCBbcGFpcnNdID0gYXJndW1lbnRzOyAvLyBNYXAgY29tcGF0XG5cdFx0aWYgKHBhaXJzID09PSBudWxsIHx8IHBhaXJzID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHBhaXJzW1N5bWJvbC5pdGVyYXRvcl0gIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IodHlwZW9mIHBhaXJzICsgJyBpcyBub3QgaXRlcmFibGUgKGNhbm5vdCByZWFkIHByb3BlcnR5IFN5bWJvbChTeW1ib2wuaXRlcmF0b3IpKScpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgW2tleXMsIHZhbHVlXSBvZiBwYWlycykge1xuXHRcdFx0dGhpcy5zZXQoa2V5cywgdmFsdWUpO1xuXHRcdH1cblx0fVxuXG5cdF9nZXRQdWJsaWNLZXlzKGtleXMsIGNyZWF0ZSA9IGZhbHNlKSB7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGtleXMpKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUga2V5cyBwYXJhbWV0ZXIgbXVzdCBiZSBhbiBhcnJheScpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByaXZhdGVLZXkgPSB0aGlzLl9nZXRQcml2YXRlS2V5KGtleXMsIGNyZWF0ZSk7XG5cblx0XHRsZXQgcHVibGljS2V5O1xuXHRcdGlmIChwcml2YXRlS2V5ICYmIHRoaXMuX3B1YmxpY0tleXMuaGFzKHByaXZhdGVLZXkpKSB7XG5cdFx0XHRwdWJsaWNLZXkgPSB0aGlzLl9wdWJsaWNLZXlzLmdldChwcml2YXRlS2V5KTtcblx0XHR9IGVsc2UgaWYgKGNyZWF0ZSkge1xuXHRcdFx0cHVibGljS2V5ID0gWy4uLmtleXNdOyAvLyBSZWdlbmVyYXRlIGtleXMgYXJyYXkgdG8gYXZvaWQgZXh0ZXJuYWwgaW50ZXJhY3Rpb25cblx0XHRcdHRoaXMuX3B1YmxpY0tleXMuc2V0KHByaXZhdGVLZXksIHB1YmxpY0tleSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtwcml2YXRlS2V5LCBwdWJsaWNLZXl9O1xuXHR9XG5cblx0X2dldFByaXZhdGVLZXkoa2V5cywgY3JlYXRlID0gZmFsc2UpIHtcblx0XHRjb25zdCBwcml2YXRlS2V5cyA9IFtdO1xuXHRcdGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG5cdFx0XHRpZiAoa2V5ID09PSBudWxsKSB7XG5cdFx0XHRcdGtleSA9IG51bGxLZXk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGhhc2hlcyA9IHR5cGVvZiBrZXkgPT09ICdvYmplY3QnIHx8IHR5cGVvZiBrZXkgPT09ICdmdW5jdGlvbicgPyAnX29iamVjdEhhc2hlcycgOiAodHlwZW9mIGtleSA9PT0gJ3N5bWJvbCcgPyAnX3N5bWJvbEhhc2hlcycgOiBmYWxzZSk7XG5cblx0XHRcdGlmICghaGFzaGVzKSB7XG5cdFx0XHRcdHByaXZhdGVLZXlzLnB1c2goa2V5KTtcblx0XHRcdH0gZWxzZSBpZiAodGhpc1toYXNoZXNdLmhhcyhrZXkpKSB7XG5cdFx0XHRcdHByaXZhdGVLZXlzLnB1c2godGhpc1toYXNoZXNdLmdldChrZXkpKTtcblx0XHRcdH0gZWxzZSBpZiAoY3JlYXRlKSB7XG5cdFx0XHRcdGNvbnN0IHByaXZhdGVLZXkgPSBgQEBta20tcmVmLSR7a2V5Q291bnRlcisrfUBAYDtcblx0XHRcdFx0dGhpc1toYXNoZXNdLnNldChrZXksIHByaXZhdGVLZXkpO1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKHByaXZhdGVLZXkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeShwcml2YXRlS2V5cyk7XG5cdH1cblxuXHRzZXQoa2V5cywgdmFsdWUpIHtcblx0XHRjb25zdCB7cHVibGljS2V5fSA9IHRoaXMuX2dldFB1YmxpY0tleXMoa2V5cywgdHJ1ZSk7XG5cdFx0cmV0dXJuIHN1cGVyLnNldChwdWJsaWNLZXksIHZhbHVlKTtcblx0fVxuXG5cdGdldChrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBzdXBlci5nZXQocHVibGljS2V5KTtcblx0fVxuXG5cdGhhcyhrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBzdXBlci5oYXMocHVibGljS2V5KTtcblx0fVxuXG5cdGRlbGV0ZShrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleSwgcHJpdmF0ZUtleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBCb29sZWFuKHB1YmxpY0tleSAmJiBzdXBlci5kZWxldGUocHVibGljS2V5KSAmJiB0aGlzLl9wdWJsaWNLZXlzLmRlbGV0ZShwcml2YXRlS2V5KSk7XG5cdH1cblxuXHRjbGVhcigpIHtcblx0XHRzdXBlci5jbGVhcigpO1xuXHRcdHRoaXMuX3N5bWJvbEhhc2hlcy5jbGVhcigpO1xuXHRcdHRoaXMuX3B1YmxpY0tleXMuY2xlYXIoKTtcblx0fVxuXG5cdGdldCBbU3ltYm9sLnRvU3RyaW5nVGFnXSgpIHtcblx0XHRyZXR1cm4gJ01hbnlLZXlzTWFwJztcblx0fVxuXG5cdGdldCBzaXplKCkge1xuXHRcdHJldHVybiBzdXBlci5zaXplO1xuXHR9XG59XG4iLCJmdW5jdGlvbiBpc1BsYWluT2JqZWN0KHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgcHJvdG90eXBlID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKTtcbiAgaWYgKHByb3RvdHlwZSAhPT0gbnVsbCAmJiBwcm90b3R5cGUgIT09IE9iamVjdC5wcm90b3R5cGUgJiYgT2JqZWN0LmdldFByb3RvdHlwZU9mKHByb3RvdHlwZSkgIT09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKFN5bWJvbC5pdGVyYXRvciBpbiB2YWx1ZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoU3ltYm9sLnRvU3RyaW5nVGFnIGluIHZhbHVlKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT09IFwiW29iamVjdCBNb2R1bGVdXCI7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIF9kZWZ1KGJhc2VPYmplY3QsIGRlZmF1bHRzLCBuYW1lc3BhY2UgPSBcIi5cIiwgbWVyZ2VyKSB7XG4gIGlmICghaXNQbGFpbk9iamVjdChkZWZhdWx0cykpIHtcbiAgICByZXR1cm4gX2RlZnUoYmFzZU9iamVjdCwge30sIG5hbWVzcGFjZSwgbWVyZ2VyKTtcbiAgfVxuICBjb25zdCBvYmplY3QgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0cyk7XG4gIGZvciAoY29uc3Qga2V5IGluIGJhc2VPYmplY3QpIHtcbiAgICBpZiAoa2V5ID09PSBcIl9fcHJvdG9fX1wiIHx8IGtleSA9PT0gXCJjb25zdHJ1Y3RvclwiKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSBiYXNlT2JqZWN0W2tleV07XG4gICAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB2b2lkIDApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAobWVyZ2VyICYmIG1lcmdlcihvYmplY3QsIGtleSwgdmFsdWUsIG5hbWVzcGFjZSkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgQXJyYXkuaXNBcnJheShvYmplY3Rba2V5XSkpIHtcbiAgICAgIG9iamVjdFtrZXldID0gWy4uLnZhbHVlLCAuLi5vYmplY3Rba2V5XV07XG4gICAgfSBlbHNlIGlmIChpc1BsYWluT2JqZWN0KHZhbHVlKSAmJiBpc1BsYWluT2JqZWN0KG9iamVjdFtrZXldKSkge1xuICAgICAgb2JqZWN0W2tleV0gPSBfZGVmdShcbiAgICAgICAgdmFsdWUsXG4gICAgICAgIG9iamVjdFtrZXldLFxuICAgICAgICAobmFtZXNwYWNlID8gYCR7bmFtZXNwYWNlfS5gIDogXCJcIikgKyBrZXkudG9TdHJpbmcoKSxcbiAgICAgICAgbWVyZ2VyXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBvYmplY3Rba2V5XSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gb2JqZWN0O1xufVxuZnVuY3Rpb24gY3JlYXRlRGVmdShtZXJnZXIpIHtcbiAgcmV0dXJuICguLi5hcmd1bWVudHNfKSA9PiAoXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHVuaWNvcm4vbm8tYXJyYXktcmVkdWNlXG4gICAgYXJndW1lbnRzXy5yZWR1Y2UoKHAsIGMpID0+IF9kZWZ1KHAsIGMsIFwiXCIsIG1lcmdlciksIHt9KVxuICApO1xufVxuY29uc3QgZGVmdSA9IGNyZWF0ZURlZnUoKTtcbmNvbnN0IGRlZnVGbiA9IGNyZWF0ZURlZnUoKG9iamVjdCwga2V5LCBjdXJyZW50VmFsdWUpID0+IHtcbiAgaWYgKG9iamVjdFtrZXldICE9PSB2b2lkIDAgJiYgdHlwZW9mIGN1cnJlbnRWYWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgb2JqZWN0W2tleV0gPSBjdXJyZW50VmFsdWUob2JqZWN0W2tleV0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59KTtcbmNvbnN0IGRlZnVBcnJheUZuID0gY3JlYXRlRGVmdSgob2JqZWN0LCBrZXksIGN1cnJlbnRWYWx1ZSkgPT4ge1xuICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3Rba2V5XSkgJiYgdHlwZW9mIGN1cnJlbnRWYWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgb2JqZWN0W2tleV0gPSBjdXJyZW50VmFsdWUob2JqZWN0W2tleV0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59KTtcblxuZXhwb3J0IHsgY3JlYXRlRGVmdSwgZGVmdSBhcyBkZWZhdWx0LCBkZWZ1LCBkZWZ1QXJyYXlGbiwgZGVmdUZuIH07XG4iLCJjb25zdCBpc0V4aXN0ID0gKGVsZW1lbnQpID0+IHtcbiAgcmV0dXJuIGVsZW1lbnQgIT09IG51bGwgPyB7IGlzRGV0ZWN0ZWQ6IHRydWUsIHJlc3VsdDogZWxlbWVudCB9IDogeyBpc0RldGVjdGVkOiBmYWxzZSB9O1xufTtcbmNvbnN0IGlzTm90RXhpc3QgPSAoZWxlbWVudCkgPT4ge1xuICByZXR1cm4gZWxlbWVudCA9PT0gbnVsbCA/IHsgaXNEZXRlY3RlZDogdHJ1ZSwgcmVzdWx0OiBudWxsIH0gOiB7IGlzRGV0ZWN0ZWQ6IGZhbHNlIH07XG59O1xuXG5leHBvcnQgeyBpc0V4aXN0LCBpc05vdEV4aXN0IH07XG4iLCJpbXBvcnQgTWFueUtleXNNYXAgZnJvbSAnbWFueS1rZXlzLW1hcCc7XG5pbXBvcnQgeyBkZWZ1IH0gZnJvbSAnZGVmdSc7XG5pbXBvcnQgeyBpc0V4aXN0IH0gZnJvbSAnLi9kZXRlY3RvcnMubWpzJztcblxuY29uc3QgZ2V0RGVmYXVsdE9wdGlvbnMgPSAoKSA9PiAoe1xuICB0YXJnZXQ6IGdsb2JhbFRoaXMuZG9jdW1lbnQsXG4gIHVuaWZ5UHJvY2VzczogdHJ1ZSxcbiAgZGV0ZWN0b3I6IGlzRXhpc3QsXG4gIG9ic2VydmVDb25maWdzOiB7XG4gICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgIHN1YnRyZWU6IHRydWUsXG4gICAgYXR0cmlidXRlczogdHJ1ZVxuICB9LFxuICBzaWduYWw6IHZvaWQgMCxcbiAgY3VzdG9tTWF0Y2hlcjogdm9pZCAwXG59KTtcbmNvbnN0IG1lcmdlT3B0aW9ucyA9ICh1c2VyU2lkZU9wdGlvbnMsIGRlZmF1bHRPcHRpb25zKSA9PiB7XG4gIHJldHVybiBkZWZ1KHVzZXJTaWRlT3B0aW9ucywgZGVmYXVsdE9wdGlvbnMpO1xufTtcblxuY29uc3QgdW5pZnlDYWNoZSA9IG5ldyBNYW55S2V5c01hcCgpO1xuZnVuY3Rpb24gY3JlYXRlV2FpdEVsZW1lbnQoaW5zdGFuY2VPcHRpb25zKSB7XG4gIGNvbnN0IHsgZGVmYXVsdE9wdGlvbnMgfSA9IGluc3RhbmNlT3B0aW9ucztcbiAgcmV0dXJuIChzZWxlY3Rvciwgb3B0aW9ucykgPT4ge1xuICAgIGNvbnN0IHtcbiAgICAgIHRhcmdldCxcbiAgICAgIHVuaWZ5UHJvY2VzcyxcbiAgICAgIG9ic2VydmVDb25maWdzLFxuICAgICAgZGV0ZWN0b3IsXG4gICAgICBzaWduYWwsXG4gICAgICBjdXN0b21NYXRjaGVyXG4gICAgfSA9IG1lcmdlT3B0aW9ucyhvcHRpb25zLCBkZWZhdWx0T3B0aW9ucyk7XG4gICAgY29uc3QgdW5pZnlQcm9taXNlS2V5ID0gW1xuICAgICAgc2VsZWN0b3IsXG4gICAgICB0YXJnZXQsXG4gICAgICB1bmlmeVByb2Nlc3MsXG4gICAgICBvYnNlcnZlQ29uZmlncyxcbiAgICAgIGRldGVjdG9yLFxuICAgICAgc2lnbmFsLFxuICAgICAgY3VzdG9tTWF0Y2hlclxuICAgIF07XG4gICAgY29uc3QgY2FjaGVkUHJvbWlzZSA9IHVuaWZ5Q2FjaGUuZ2V0KHVuaWZ5UHJvbWlzZUtleSk7XG4gICAgaWYgKHVuaWZ5UHJvY2VzcyAmJiBjYWNoZWRQcm9taXNlKSB7XG4gICAgICByZXR1cm4gY2FjaGVkUHJvbWlzZTtcbiAgICB9XG4gICAgY29uc3QgZGV0ZWN0UHJvbWlzZSA9IG5ldyBQcm9taXNlKFxuICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0FzeW5jUHJvbWlzZUV4ZWN1dG9yOiBhdm9pZCBuZXN0aW5nIHByb21pc2VcbiAgICAgIGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgIHJldHVybiByZWplY3Qoc2lnbmFsLnJlYXNvbik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihcbiAgICAgICAgICBhc3luYyAobXV0YXRpb25zKSA9PiB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IF8gb2YgbXV0YXRpb25zKSB7XG4gICAgICAgICAgICAgIGlmIChzaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29uc3QgZGV0ZWN0UmVzdWx0MiA9IGF3YWl0IGRldGVjdEVsZW1lbnQoe1xuICAgICAgICAgICAgICAgIHNlbGVjdG9yLFxuICAgICAgICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICAgICAgICBkZXRlY3RvcixcbiAgICAgICAgICAgICAgICBjdXN0b21NYXRjaGVyXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBpZiAoZGV0ZWN0UmVzdWx0Mi5pc0RldGVjdGVkKSB7XG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZGV0ZWN0UmVzdWx0Mi5yZXN1bHQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgICBzaWduYWw/LmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgXCJhYm9ydFwiLFxuICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHJldHVybiByZWplY3Qoc2lnbmFsLnJlYXNvbik7XG4gICAgICAgICAgfSxcbiAgICAgICAgICB7IG9uY2U6IHRydWUgfVxuICAgICAgICApO1xuICAgICAgICBjb25zdCBkZXRlY3RSZXN1bHQgPSBhd2FpdCBkZXRlY3RFbGVtZW50KHtcbiAgICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgZGV0ZWN0b3IsXG4gICAgICAgICAgY3VzdG9tTWF0Y2hlclxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGRldGVjdFJlc3VsdC5pc0RldGVjdGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoZGV0ZWN0UmVzdWx0LnJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZSh0YXJnZXQsIG9ic2VydmVDb25maWdzKTtcbiAgICAgIH1cbiAgICApLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgdW5pZnlDYWNoZS5kZWxldGUodW5pZnlQcm9taXNlS2V5KTtcbiAgICB9KTtcbiAgICB1bmlmeUNhY2hlLnNldCh1bmlmeVByb21pc2VLZXksIGRldGVjdFByb21pc2UpO1xuICAgIHJldHVybiBkZXRlY3RQcm9taXNlO1xuICB9O1xufVxuYXN5bmMgZnVuY3Rpb24gZGV0ZWN0RWxlbWVudCh7XG4gIHRhcmdldCxcbiAgc2VsZWN0b3IsXG4gIGRldGVjdG9yLFxuICBjdXN0b21NYXRjaGVyXG59KSB7XG4gIGNvbnN0IGVsZW1lbnQgPSBjdXN0b21NYXRjaGVyID8gY3VzdG9tTWF0Y2hlcihzZWxlY3RvcikgOiB0YXJnZXQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gIHJldHVybiBhd2FpdCBkZXRlY3RvcihlbGVtZW50KTtcbn1cbmNvbnN0IHdhaXRFbGVtZW50ID0gY3JlYXRlV2FpdEVsZW1lbnQoe1xuICBkZWZhdWx0T3B0aW9uczogZ2V0RGVmYXVsdE9wdGlvbnMoKVxufSk7XG5cbmV4cG9ydCB7IGNyZWF0ZVdhaXRFbGVtZW50LCBnZXREZWZhdWx0T3B0aW9ucywgd2FpdEVsZW1lbnQgfTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyB3YWl0RWxlbWVudCB9IGZyb20gXCJAMW5hdHN1L3dhaXQtZWxlbWVudFwiO1xuaW1wb3J0IHtcbiAgaXNFeGlzdCBhcyBtb3VudERldGVjdG9yLFxuICBpc05vdEV4aXN0IGFzIHJlbW92ZURldGVjdG9yXG59IGZyb20gXCJAMW5hdHN1L3dhaXQtZWxlbWVudC9kZXRlY3RvcnNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi8uLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gYXBwbHlQb3NpdGlvbihyb290LCBwb3NpdGlvbmVkRWxlbWVudCwgb3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5wb3NpdGlvbiA9PT0gXCJpbmxpbmVcIikgcmV0dXJuO1xuICBpZiAob3B0aW9ucy56SW5kZXggIT0gbnVsbCkgcm9vdC5zdHlsZS56SW5kZXggPSBTdHJpbmcob3B0aW9ucy56SW5kZXgpO1xuICByb290LnN0eWxlLm92ZXJmbG93ID0gXCJ2aXNpYmxlXCI7XG4gIHJvb3Quc3R5bGUucG9zaXRpb24gPSBcInJlbGF0aXZlXCI7XG4gIHJvb3Quc3R5bGUud2lkdGggPSBcIjBcIjtcbiAgcm9vdC5zdHlsZS5oZWlnaHQgPSBcIjBcIjtcbiAgcm9vdC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICBpZiAocG9zaXRpb25lZEVsZW1lbnQpIHtcbiAgICBpZiAob3B0aW9ucy5wb3NpdGlvbiA9PT0gXCJvdmVybGF5XCIpIHtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xuICAgICAgaWYgKG9wdGlvbnMuYWxpZ25tZW50Py5zdGFydHNXaXRoKFwiYm90dG9tLVwiKSlcbiAgICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUuYm90dG9tID0gXCIwXCI7XG4gICAgICBlbHNlIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiO1xuICAgICAgaWYgKG9wdGlvbnMuYWxpZ25tZW50Py5lbmRzV2l0aChcIi1yaWdodFwiKSlcbiAgICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIjtcbiAgICAgIGVsc2UgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUubGVmdCA9IFwiMFwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUuYm90dG9tID0gXCIwXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5sZWZ0ID0gXCIwXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMFwiO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIGdldEFuY2hvcihvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zLmFuY2hvciA9PSBudWxsKSByZXR1cm4gZG9jdW1lbnQuYm9keTtcbiAgbGV0IHJlc29sdmVkID0gdHlwZW9mIG9wdGlvbnMuYW5jaG9yID09PSBcImZ1bmN0aW9uXCIgPyBvcHRpb25zLmFuY2hvcigpIDogb3B0aW9ucy5hbmNob3I7XG4gIGlmICh0eXBlb2YgcmVzb2x2ZWQgPT09IFwic3RyaW5nXCIpIHtcbiAgICBpZiAocmVzb2x2ZWQuc3RhcnRzV2l0aChcIi9cIikpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGRvY3VtZW50LmV2YWx1YXRlKFxuICAgICAgICByZXNvbHZlZCxcbiAgICAgICAgZG9jdW1lbnQsXG4gICAgICAgIG51bGwsXG4gICAgICAgIFhQYXRoUmVzdWx0LkZJUlNUX09SREVSRURfTk9ERV9UWVBFLFxuICAgICAgICBudWxsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlc3VsdC5zaW5nbGVOb2RlVmFsdWUgPz8gdm9pZCAwO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihyZXNvbHZlZCkgPz8gdm9pZCAwO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzb2x2ZWQgPz8gdm9pZCAwO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG1vdW50VWkocm9vdCwgb3B0aW9ucykge1xuICBjb25zdCBhbmNob3IgPSBnZXRBbmNob3Iob3B0aW9ucyk7XG4gIGlmIChhbmNob3IgPT0gbnVsbClcbiAgICB0aHJvdyBFcnJvcihcbiAgICAgIFwiRmFpbGVkIHRvIG1vdW50IGNvbnRlbnQgc2NyaXB0IFVJOiBjb3VsZCBub3QgZmluZCBhbmNob3IgZWxlbWVudFwiXG4gICAgKTtcbiAgc3dpdGNoIChvcHRpb25zLmFwcGVuZCkge1xuICAgIGNhc2Ugdm9pZCAwOlxuICAgIGNhc2UgXCJsYXN0XCI6XG4gICAgICBhbmNob3IuYXBwZW5kKHJvb3QpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImZpcnN0XCI6XG4gICAgICBhbmNob3IucHJlcGVuZChyb290KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJyZXBsYWNlXCI6XG4gICAgICBhbmNob3IucmVwbGFjZVdpdGgocm9vdCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiYWZ0ZXJcIjpcbiAgICAgIGFuY2hvci5wYXJlbnRFbGVtZW50Py5pbnNlcnRCZWZvcmUocm9vdCwgYW5jaG9yLm5leHRFbGVtZW50U2libGluZyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiYmVmb3JlXCI6XG4gICAgICBhbmNob3IucGFyZW50RWxlbWVudD8uaW5zZXJ0QmVmb3JlKHJvb3QsIGFuY2hvcik7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgb3B0aW9ucy5hcHBlbmQoYW5jaG9yLCByb290KTtcbiAgICAgIGJyZWFrO1xuICB9XG59XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTW91bnRGdW5jdGlvbnMoYmFzZUZ1bmN0aW9ucywgb3B0aW9ucykge1xuICBsZXQgYXV0b01vdW50SW5zdGFuY2UgPSB2b2lkIDA7XG4gIGNvbnN0IHN0b3BBdXRvTW91bnQgPSAoKSA9PiB7XG4gICAgYXV0b01vdW50SW5zdGFuY2U/LnN0b3BBdXRvTW91bnQoKTtcbiAgICBhdXRvTW91bnRJbnN0YW5jZSA9IHZvaWQgMDtcbiAgfTtcbiAgY29uc3QgbW91bnQgPSAoKSA9PiB7XG4gICAgYmFzZUZ1bmN0aW9ucy5tb3VudCgpO1xuICB9O1xuICBjb25zdCB1bm1vdW50ID0gYmFzZUZ1bmN0aW9ucy5yZW1vdmU7XG4gIGNvbnN0IHJlbW92ZSA9ICgpID0+IHtcbiAgICBzdG9wQXV0b01vdW50KCk7XG4gICAgYmFzZUZ1bmN0aW9ucy5yZW1vdmUoKTtcbiAgfTtcbiAgY29uc3QgYXV0b01vdW50ID0gKGF1dG9Nb3VudE9wdGlvbnMpID0+IHtcbiAgICBpZiAoYXV0b01vdW50SW5zdGFuY2UpIHtcbiAgICAgIGxvZ2dlci53YXJuKFwiYXV0b01vdW50IGlzIGFscmVhZHkgc2V0LlwiKTtcbiAgICB9XG4gICAgYXV0b01vdW50SW5zdGFuY2UgPSBhdXRvTW91bnRVaShcbiAgICAgIHsgbW91bnQsIHVubW91bnQsIHN0b3BBdXRvTW91bnQgfSxcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgLi4uYXV0b01vdW50T3B0aW9uc1xuICAgICAgfVxuICAgICk7XG4gIH07XG4gIHJldHVybiB7XG4gICAgbW91bnQsXG4gICAgcmVtb3ZlLFxuICAgIGF1dG9Nb3VudFxuICB9O1xufVxuZnVuY3Rpb24gYXV0b01vdW50VWkodWlDYWxsYmFja3MsIG9wdGlvbnMpIHtcbiAgY29uc3QgYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBjb25zdCBFWFBMSUNJVF9TVE9QX1JFQVNPTiA9IFwiZXhwbGljaXRfc3RvcF9hdXRvX21vdW50XCI7XG4gIGNvbnN0IF9zdG9wQXV0b01vdW50ID0gKCkgPT4ge1xuICAgIGFib3J0Q29udHJvbGxlci5hYm9ydChFWFBMSUNJVF9TVE9QX1JFQVNPTik7XG4gICAgb3B0aW9ucy5vblN0b3A/LigpO1xuICB9O1xuICBsZXQgcmVzb2x2ZWRBbmNob3IgPSB0eXBlb2Ygb3B0aW9ucy5hbmNob3IgPT09IFwiZnVuY3Rpb25cIiA/IG9wdGlvbnMuYW5jaG9yKCkgOiBvcHRpb25zLmFuY2hvcjtcbiAgaWYgKHJlc29sdmVkQW5jaG9yIGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgIHRocm93IEVycm9yKFxuICAgICAgXCJhdXRvTW91bnQgYW5kIEVsZW1lbnQgYW5jaG9yIG9wdGlvbiBjYW5ub3QgYmUgY29tYmluZWQuIEF2b2lkIHBhc3NpbmcgYEVsZW1lbnRgIGRpcmVjdGx5IG9yIGAoKSA9PiBFbGVtZW50YCB0byB0aGUgYW5jaG9yLlwiXG4gICAgKTtcbiAgfVxuICBhc3luYyBmdW5jdGlvbiBvYnNlcnZlRWxlbWVudChzZWxlY3Rvcikge1xuICAgIGxldCBpc0FuY2hvckV4aXN0ID0gISFnZXRBbmNob3Iob3B0aW9ucyk7XG4gICAgaWYgKGlzQW5jaG9yRXhpc3QpIHtcbiAgICAgIHVpQ2FsbGJhY2tzLm1vdW50KCk7XG4gICAgfVxuICAgIHdoaWxlICghYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjaGFuZ2VkQW5jaG9yID0gYXdhaXQgd2FpdEVsZW1lbnQoc2VsZWN0b3IgPz8gXCJib2R5XCIsIHtcbiAgICAgICAgICBjdXN0b21NYXRjaGVyOiAoKSA9PiBnZXRBbmNob3Iob3B0aW9ucykgPz8gbnVsbCxcbiAgICAgICAgICBkZXRlY3RvcjogaXNBbmNob3JFeGlzdCA/IHJlbW92ZURldGVjdG9yIDogbW91bnREZXRlY3RvcixcbiAgICAgICAgICBzaWduYWw6IGFib3J0Q29udHJvbGxlci5zaWduYWxcbiAgICAgICAgfSk7XG4gICAgICAgIGlzQW5jaG9yRXhpc3QgPSAhIWNoYW5nZWRBbmNob3I7XG4gICAgICAgIGlmIChpc0FuY2hvckV4aXN0KSB7XG4gICAgICAgICAgdWlDYWxsYmFja3MubW91bnQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB1aUNhbGxiYWNrcy51bm1vdW50KCk7XG4gICAgICAgICAgaWYgKG9wdGlvbnMub25jZSkge1xuICAgICAgICAgICAgdWlDYWxsYmFja3Muc3RvcEF1dG9Nb3VudCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgaWYgKGFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCAmJiBhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlYXNvbiA9PT0gRVhQTElDSVRfU1RPUF9SRUFTT04pIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBvYnNlcnZlRWxlbWVudChyZXNvbHZlZEFuY2hvcik7XG4gIHJldHVybiB7IHN0b3BBdXRvTW91bnQ6IF9zdG9wQXV0b01vdW50IH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gc3BsaXRTaGFkb3dSb290Q3NzKGNzcykge1xuICBsZXQgc2hhZG93Q3NzID0gY3NzO1xuICBsZXQgZG9jdW1lbnRDc3MgPSBcIlwiO1xuICBjb25zdCBydWxlc1JlZ2V4ID0gLyhcXHMqQChwcm9wZXJ0eXxmb250LWZhY2UpW1xcc1xcU10qP3tbXFxzXFxTXSo/fSkvZ207XG4gIGxldCBtYXRjaDtcbiAgd2hpbGUgKChtYXRjaCA9IHJ1bGVzUmVnZXguZXhlYyhjc3MpKSAhPT0gbnVsbCkge1xuICAgIGRvY3VtZW50Q3NzICs9IG1hdGNoWzFdO1xuICAgIHNoYWRvd0NzcyA9IHNoYWRvd0Nzcy5yZXBsYWNlKG1hdGNoWzFdLCBcIlwiKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIGRvY3VtZW50Q3NzOiBkb2N1bWVudENzcy50cmltKCksXG4gICAgc2hhZG93Q3NzOiBzaGFkb3dDc3MudHJpbSgpXG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBjcmVhdGVJc29sYXRlZEVsZW1lbnQgfSBmcm9tIFwiQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnRcIjtcbmltcG9ydCB7IGFwcGx5UG9zaXRpb24sIGNyZWF0ZU1vdW50RnVuY3Rpb25zLCBtb3VudFVpIH0gZnJvbSBcIi4vc2hhcmVkLm1qc1wiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7IHNwbGl0U2hhZG93Um9vdENzcyB9IGZyb20gXCIuLi9zcGxpdC1zaGFkb3ctcm9vdC1jc3MubWpzXCI7XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlU2hhZG93Um9vdFVpKGN0eCwgb3B0aW9ucykge1xuICBjb25zdCBpbnN0YW5jZUlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDIsIDE1KTtcbiAgY29uc3QgY3NzID0gW107XG4gIGlmICghb3B0aW9ucy5pbmhlcml0U3R5bGVzKSB7XG4gICAgY3NzLnB1c2goYC8qIFdYVCBTaGFkb3cgUm9vdCBSZXNldCAqLyA6aG9zdHthbGw6aW5pdGlhbCAhaW1wb3J0YW50O31gKTtcbiAgfVxuICBpZiAob3B0aW9ucy5jc3MpIHtcbiAgICBjc3MucHVzaChvcHRpb25zLmNzcyk7XG4gIH1cbiAgaWYgKGN0eC5vcHRpb25zPy5jc3NJbmplY3Rpb25Nb2RlID09PSBcInVpXCIpIHtcbiAgICBjb25zdCBlbnRyeUNzcyA9IGF3YWl0IGxvYWRDc3MoKTtcbiAgICBjc3MucHVzaChlbnRyeUNzcy5yZXBsYWNlQWxsKFwiOnJvb3RcIiwgXCI6aG9zdFwiKSk7XG4gIH1cbiAgY29uc3QgeyBzaGFkb3dDc3MsIGRvY3VtZW50Q3NzIH0gPSBzcGxpdFNoYWRvd1Jvb3RDc3MoY3NzLmpvaW4oXCJcXG5cIikudHJpbSgpKTtcbiAgY29uc3Qge1xuICAgIGlzb2xhdGVkRWxlbWVudDogdWlDb250YWluZXIsXG4gICAgcGFyZW50RWxlbWVudDogc2hhZG93SG9zdCxcbiAgICBzaGFkb3dcbiAgfSA9IGF3YWl0IGNyZWF0ZUlzb2xhdGVkRWxlbWVudCh7XG4gICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgIGNzczoge1xuICAgICAgdGV4dENvbnRlbnQ6IHNoYWRvd0Nzc1xuICAgIH0sXG4gICAgbW9kZTogb3B0aW9ucy5tb2RlID8/IFwib3BlblwiLFxuICAgIGlzb2xhdGVFdmVudHM6IG9wdGlvbnMuaXNvbGF0ZUV2ZW50c1xuICB9KTtcbiAgc2hhZG93SG9zdC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXd4dC1zaGFkb3ctcm9vdFwiLCBcIlwiKTtcbiAgbGV0IG1vdW50ZWQ7XG4gIGNvbnN0IG1vdW50ID0gKCkgPT4ge1xuICAgIG1vdW50VWkoc2hhZG93SG9zdCwgb3B0aW9ucyk7XG4gICAgYXBwbHlQb3NpdGlvbihzaGFkb3dIb3N0LCBzaGFkb3cucXVlcnlTZWxlY3RvcihcImh0bWxcIiksIG9wdGlvbnMpO1xuICAgIGlmIChkb2N1bWVudENzcyAmJiAhZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgIGBzdHlsZVt3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzPVwiJHtpbnN0YW5jZUlkfVwiXWBcbiAgICApKSB7XG4gICAgICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcbiAgICAgIHN0eWxlLnRleHRDb250ZW50ID0gZG9jdW1lbnRDc3M7XG4gICAgICBzdHlsZS5zZXRBdHRyaWJ1dGUoXCJ3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzXCIsIGluc3RhbmNlSWQpO1xuICAgICAgKGRvY3VtZW50LmhlYWQgPz8gZG9jdW1lbnQuYm9keSkuYXBwZW5kKHN0eWxlKTtcbiAgICB9XG4gICAgbW91bnRlZCA9IG9wdGlvbnMub25Nb3VudCh1aUNvbnRhaW5lciwgc2hhZG93LCBzaGFkb3dIb3N0KTtcbiAgfTtcbiAgY29uc3QgcmVtb3ZlID0gKCkgPT4ge1xuICAgIG9wdGlvbnMub25SZW1vdmU/Lihtb3VudGVkKTtcbiAgICBzaGFkb3dIb3N0LnJlbW92ZSgpO1xuICAgIGNvbnN0IGRvY3VtZW50U3R5bGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFxuICAgICAgYHN0eWxlW3d4dC1zaGFkb3ctcm9vdC1kb2N1bWVudC1zdHlsZXM9XCIke2luc3RhbmNlSWR9XCJdYFxuICAgICk7XG4gICAgZG9jdW1lbnRTdHlsZT8ucmVtb3ZlKCk7XG4gICAgd2hpbGUgKHVpQ29udGFpbmVyLmxhc3RDaGlsZClcbiAgICAgIHVpQ29udGFpbmVyLnJlbW92ZUNoaWxkKHVpQ29udGFpbmVyLmxhc3RDaGlsZCk7XG4gICAgbW91bnRlZCA9IHZvaWQgMDtcbiAgfTtcbiAgY29uc3QgbW91bnRGdW5jdGlvbnMgPSBjcmVhdGVNb3VudEZ1bmN0aW9ucyhcbiAgICB7XG4gICAgICBtb3VudCxcbiAgICAgIHJlbW92ZVxuICAgIH0sXG4gICAgb3B0aW9uc1xuICApO1xuICBjdHgub25JbnZhbGlkYXRlZChyZW1vdmUpO1xuICByZXR1cm4ge1xuICAgIHNoYWRvdyxcbiAgICBzaGFkb3dIb3N0LFxuICAgIHVpQ29udGFpbmVyLFxuICAgIC4uLm1vdW50RnVuY3Rpb25zLFxuICAgIGdldCBtb3VudGVkKCkge1xuICAgICAgcmV0dXJuIG1vdW50ZWQ7XG4gICAgfVxuICB9O1xufVxuYXN5bmMgZnVuY3Rpb24gbG9hZENzcygpIHtcbiAgY29uc3QgdXJsID0gYnJvd3Nlci5ydW50aW1lLmdldFVSTChgL2NvbnRlbnQtc2NyaXB0cy8ke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfS5jc3NgKTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwpO1xuICAgIHJldHVybiBhd2FpdCByZXMudGV4dCgpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBsb2dnZXIud2FybihcbiAgICAgIGBGYWlsZWQgdG8gbG9hZCBzdHlsZXMgQCAke3VybH0uIERpZCB5b3UgZm9yZ2V0IHRvIGltcG9ydCB0aGUgc3R5bGVzaGVldCBpbiB5b3VyIGVudHJ5cG9pbnQ/YCxcbiAgICAgIGVyclxuICAgICk7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVDb250ZW50U2NyaXB0KGRlZmluaXRpb24pIHtcbiAgcmV0dXJuIGRlZmluaXRpb247XG59XG4iLCJmdW5jdGlvbiByKGUpe3ZhciB0LGYsbj1cIlwiO2lmKFwic3RyaW5nXCI9PXR5cGVvZiBlfHxcIm51bWJlclwiPT10eXBlb2YgZSluKz1lO2Vsc2UgaWYoXCJvYmplY3RcIj09dHlwZW9mIGUpaWYoQXJyYXkuaXNBcnJheShlKSl7dmFyIG89ZS5sZW5ndGg7Zm9yKHQ9MDt0PG87dCsrKWVbdF0mJihmPXIoZVt0XSkpJiYobiYmKG4rPVwiIFwiKSxuKz1mKX1lbHNlIGZvcihmIGluIGUpZVtmXSYmKG4mJihuKz1cIiBcIiksbis9Zik7cmV0dXJuIG59ZXhwb3J0IGZ1bmN0aW9uIGNsc3goKXtmb3IodmFyIGUsdCxmPTAsbj1cIlwiLG89YXJndW1lbnRzLmxlbmd0aDtmPG87ZisrKShlPWFyZ3VtZW50c1tmXSkmJih0PXIoZSkpJiYobiYmKG4rPVwiIFwiKSxuKz10KTtyZXR1cm4gbn1leHBvcnQgZGVmYXVsdCBjbHN4OyIsImltcG9ydCB7IGNsc3gsIHR5cGUgQ2xhc3NWYWx1ZSB9IGZyb20gJ2Nsc3gnXG5cbmV4cG9ydCBmdW5jdGlvbiBjbiguLi5pbnB1dHM6IENsYXNzVmFsdWVbXSkge1xuICByZXR1cm4gY2xzeChpbnB1dHMpXG59IiwiaW1wb3J0IHsgU2hvdywgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQsIEpTWCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEhlYWRlclByb3BzIHtcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIGxvZ28/OiBKU1guRWxlbWVudDtcbiAgYWN0aW9ucz86IEpTWC5FbGVtZW50O1xuICB2YXJpYW50PzogJ2RlZmF1bHQnIHwgJ21pbmltYWwnIHwgJ3RyYW5zcGFyZW50JztcbiAgc3RpY2t5PzogYm9vbGVhbjtcbiAgc2hvd01lbnVCdXR0b24/OiBib29sZWFuO1xuICBvbk1lbnVDbGljaz86ICgpID0+IHZvaWQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgSGVhZGVyOiBDb21wb25lbnQ8SGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtpc1Njcm9sbGVkLCBzZXRJc1Njcm9sbGVkXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG5cbiAgLy8gVHJhY2sgc2Nyb2xsIHBvc2l0aW9uIGZvciBzdGlja3kgaGVhZGVyIGVmZmVjdHNcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHByb3BzLnN0aWNreSkge1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdzY3JvbGwnLCAoKSA9PiB7XG4gICAgICBzZXRJc1Njcm9sbGVkKHdpbmRvdy5zY3JvbGxZID4gMTApO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgdmFyaWFudCA9ICgpID0+IHByb3BzLnZhcmlhbnQgfHwgJ2RlZmF1bHQnO1xuXG4gIHJldHVybiAoXG4gICAgPGhlYWRlclxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAndy1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMCcsXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBWYXJpYW50c1xuICAgICAgICAgICdiZy1zdXJmYWNlIGJvcmRlci1iIGJvcmRlci1zdWJ0bGUnOiB2YXJpYW50KCkgPT09ICdkZWZhdWx0JyxcbiAgICAgICAgICAnYmctdHJhbnNwYXJlbnQnOiB2YXJpYW50KCkgPT09ICdtaW5pbWFsJyB8fCB2YXJpYW50KCkgPT09ICd0cmFuc3BhcmVudCcsXG4gICAgICAgICAgJ2JhY2tkcm9wLWJsdXItbWQgYmctc3VyZmFjZS84MCc6IHZhcmlhbnQoKSA9PT0gJ3RyYW5zcGFyZW50JyAmJiBpc1Njcm9sbGVkKCksXG4gICAgICAgICAgLy8gU3RpY2t5IGJlaGF2aW9yXG4gICAgICAgICAgJ3N0aWNreSB0b3AtMCB6LTUwJzogcHJvcHMuc3RpY2t5LFxuICAgICAgICAgICdzaGFkb3ctbGcnOiBwcm9wcy5zdGlja3kgJiYgaXNTY3JvbGxlZCgpLFxuICAgICAgICB9LFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICA8ZGl2IGNsYXNzPVwibWF4LXctc2NyZWVuLXhsIG14LWF1dG8gcHgtNCBzbTpweC02IGxnOnB4LThcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBoLTE2XCI+XG4gICAgICAgICAgey8qIExlZnQgc2VjdGlvbiAqL31cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTRcIj5cbiAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnNob3dNZW51QnV0dG9ufT5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uTWVudUNsaWNrfVxuICAgICAgICAgICAgICAgIGNsYXNzPVwicC0yIHJvdW5kZWQtbGcgaG92ZXI6YmctaGlnaGxpZ2h0IHRyYW5zaXRpb24tY29sb3JzIGxnOmhpZGRlblwiXG4gICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIk1lbnVcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPHN2ZyBjbGFzcz1cInctNiBoLTZcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIj5cbiAgICAgICAgICAgICAgICAgIDxwYXRoIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiIHN0cm9rZS13aWR0aD1cIjJcIiBkPVwiTTQgNmgxNk00IDEyaDE2TTQgMThoMTZcIiAvPlxuICAgICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMubG9nb30gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy50aXRsZX0+XG4gICAgICAgICAgICAgICAgPGgxIGNsYXNzPVwidGV4dC14bCBmb250LWJvbGQgdGV4dC1wcmltYXJ5XCI+e3Byb3BzLnRpdGxlfTwvaDE+XG4gICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgIHtwcm9wcy5sb2dvfVxuICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgey8qIFJpZ2h0IHNlY3Rpb24gKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuYWN0aW9uc30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAge3Byb3BzLmFjdGlvbnN9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9oZWFkZXI+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2NvcmVQYW5lbFByb3BzIHtcbiAgc2NvcmU6IG51bWJlciB8IG51bGw7XG4gIHJhbms6IG51bWJlciB8IG51bGw7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgU2NvcmVQYW5lbDogQ29tcG9uZW50PFNjb3JlUGFuZWxQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZ3JpZCBncmlkLWNvbHMtWzFmcl8xZnJdIGdhcC0yIHAtNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogU2NvcmUgQm94ICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2Ugcm91bmRlZC1sZyBwLTQgZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgbWluLWgtWzgwcHhdXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTJ4bCBmb250LW1vbm8gZm9udC1ib2xkIHRleHQtcHVycGxlLTUwMFwiPlxuICAgICAgICAgIHtwcm9wcy5zY29yZSAhPT0gbnVsbCA/IHByb3BzLnNjb3JlIDogJ+KAlCd9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+XG4gICAgICAgICAgU2NvcmVcbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgey8qIFJhbmsgQm94ICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2Ugcm91bmRlZC1sZyBwLTQgZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgbWluLWgtWzgwcHhdXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTJ4bCBmb250LW1vbm8gZm9udC1ib2xkIHRleHQtcGluay01MDBcIj5cbiAgICAgICAgICB7cHJvcHMucmFuayAhPT0gbnVsbCA/IHByb3BzLnJhbmsgOiAn4oCUJ31cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtc2Vjb25kYXJ5IG10LTFcIj5cbiAgICAgICAgICBSYW5rXG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3csIHNwbGl0UHJvcHMgfSBmcm9tICdzb2xpZC1qcydcbmltcG9ydCB0eXBlIHsgSlNYIH0gZnJvbSAnc29saWQtanMnXG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJ1xuXG5leHBvcnQgaW50ZXJmYWNlIEJ1dHRvblByb3BzIGV4dGVuZHMgSlNYLkJ1dHRvbkhUTUxBdHRyaWJ1dGVzPEhUTUxCdXR0b25FbGVtZW50PiB7XG4gIHZhcmlhbnQ/OiAncHJpbWFyeScgfCAnc2Vjb25kYXJ5JyB8ICdnaG9zdCcgfCAnZGFuZ2VyJ1xuICBzaXplPzogJ3NtJyB8ICdtZCcgfCAnbGcnXG4gIGZ1bGxXaWR0aD86IGJvb2xlYW5cbiAgbG9hZGluZz86IGJvb2xlYW5cbiAgbGVmdEljb24/OiBKU1guRWxlbWVudFxuICByaWdodEljb24/OiBKU1guRWxlbWVudFxufVxuXG5leHBvcnQgY29uc3QgQnV0dG9uID0gKHByb3BzOiBCdXR0b25Qcm9wcykgPT4ge1xuICBjb25zdCBbbG9jYWwsIG90aGVyc10gPSBzcGxpdFByb3BzKHByb3BzLCBbXG4gICAgJ3ZhcmlhbnQnLFxuICAgICdzaXplJyxcbiAgICAnZnVsbFdpZHRoJyxcbiAgICAnbG9hZGluZycsXG4gICAgJ2xlZnRJY29uJyxcbiAgICAncmlnaHRJY29uJyxcbiAgICAnY2hpbGRyZW4nLFxuICAgICdjbGFzcycsXG4gICAgJ2Rpc2FibGVkJyxcbiAgXSlcblxuICBjb25zdCB2YXJpYW50ID0gKCkgPT4gbG9jYWwudmFyaWFudCB8fCAncHJpbWFyeSdcbiAgY29uc3Qgc2l6ZSA9ICgpID0+IGxvY2FsLnNpemUgfHwgJ21kJ1xuXG4gIHJldHVybiAoXG4gICAgPGJ1dHRvblxuICAgICAgZGlzYWJsZWQ9e2xvY2FsLmRpc2FibGVkIHx8IGxvY2FsLmxvYWRpbmd9XG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZm9udC1tZWRpdW0gdHJhbnNpdGlvbi1hbGwgY3Vyc29yLXBvaW50ZXIgb3V0bGluZS1ub25lIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAge1xuICAgICAgICAgIC8vIFZhcmlhbnRzXG4gICAgICAgICAgJ2JnLWdyYWRpZW50LXByaW1hcnkgdGV4dC13aGl0ZSBob3ZlcjpzaGFkb3ctbGcgaG92ZXI6YnJpZ2h0bmVzcy0xMTAgZ2xvdy1wcmltYXJ5JzpcbiAgICAgICAgICAgIHZhcmlhbnQoKSA9PT0gJ3ByaW1hcnknLFxuICAgICAgICAgICdiZy1zdXJmYWNlIHRleHQtcHJpbWFyeSBib3JkZXIgYm9yZGVyLWRlZmF1bHQgaG92ZXI6YmctZWxldmF0ZWQgaG92ZXI6Ym9yZGVyLXN0cm9uZyc6XG4gICAgICAgICAgICB2YXJpYW50KCkgPT09ICdzZWNvbmRhcnknLFxuICAgICAgICAgICd0ZXh0LXNlY29uZGFyeSBob3Zlcjp0ZXh0LXByaW1hcnkgaG92ZXI6Ymctc3VyZmFjZSc6XG4gICAgICAgICAgICB2YXJpYW50KCkgPT09ICdnaG9zdCcsXG4gICAgICAgICAgJ2JnLXJlZC02MDAgdGV4dC13aGl0ZSBob3ZlcjpiZy1yZWQtNzAwIGhvdmVyOnNoYWRvdy1sZyc6XG4gICAgICAgICAgICB2YXJpYW50KCkgPT09ICdkYW5nZXInLFxuICAgICAgICAgIC8vIFNpemVzXG4gICAgICAgICAgJ2gtOCBweC0zIHRleHQtc20gcm91bmRlZC1tZCBnYXAtMS41Jzogc2l6ZSgpID09PSAnc20nLFxuICAgICAgICAgICdoLTEwIHB4LTQgdGV4dC1iYXNlIHJvdW5kZWQtbGcgZ2FwLTInOiBzaXplKCkgPT09ICdtZCcsXG4gICAgICAgICAgJ2gtMTIgcHgtNiB0ZXh0LWxnIHJvdW5kZWQtbGcgZ2FwLTIuNSc6IHNpemUoKSA9PT0gJ2xnJyxcbiAgICAgICAgICAvLyBGdWxsIHdpZHRoXG4gICAgICAgICAgJ3ctZnVsbCc6IGxvY2FsLmZ1bGxXaWR0aCxcbiAgICAgICAgICAvLyBMb2FkaW5nIHN0YXRlXG4gICAgICAgICAgJ2N1cnNvci13YWl0JzogbG9jYWwubG9hZGluZyxcbiAgICAgICAgfSxcbiAgICAgICAgbG9jYWwuY2xhc3NcbiAgICAgICl9XG4gICAgICB7Li4ub3RoZXJzfVxuICAgID5cbiAgICAgIDxTaG93IHdoZW49e2xvY2FsLmxvYWRpbmd9PlxuICAgICAgICA8c3ZnXG4gICAgICAgICAgY2xhc3M9XCJhbmltYXRlLXNwaW4gaC00IHctNFwiXG4gICAgICAgICAgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiXG4gICAgICAgICAgZmlsbD1cIm5vbmVcIlxuICAgICAgICAgIHZpZXdCb3g9XCIwIDAgMjQgMjRcIlxuICAgICAgICA+XG4gICAgICAgICAgPGNpcmNsZVxuICAgICAgICAgICAgY2xhc3M9XCJvcGFjaXR5LTI1XCJcbiAgICAgICAgICAgIGN4PVwiMTJcIlxuICAgICAgICAgICAgY3k9XCIxMlwiXG4gICAgICAgICAgICByPVwiMTBcIlxuICAgICAgICAgICAgc3Ryb2tlPVwiY3VycmVudENvbG9yXCJcbiAgICAgICAgICAgIHN0cm9rZS13aWR0aD1cIjRcIlxuICAgICAgICAgIC8+XG4gICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgIGNsYXNzPVwib3BhY2l0eS03NVwiXG4gICAgICAgICAgICBmaWxsPVwiY3VycmVudENvbG9yXCJcbiAgICAgICAgICAgIGQ9XCJNNCAxMmE4IDggMCAwMTgtOFYwQzUuMzczIDAgMCA1LjM3MyAwIDEyaDR6bTIgNS4yOTFBNy45NjIgNy45NjIgMCAwMTQgMTJIMGMwIDMuMDQyIDEuMTM1IDUuODI0IDMgNy45MzhsMy0yLjY0N3pcIlxuICAgICAgICAgIC8+XG4gICAgICAgIDwvc3ZnPlxuICAgICAgPC9TaG93PlxuXG4gICAgICA8U2hvdyB3aGVuPXtsb2NhbC5sZWZ0SWNvbiAmJiAhbG9jYWwubG9hZGluZ30+XG4gICAgICAgIHtsb2NhbC5sZWZ0SWNvbn1cbiAgICAgIDwvU2hvdz5cblxuICAgICAgPFNob3cgd2hlbj17bG9jYWwuY2hpbGRyZW59PlxuICAgICAgICA8c3Bhbj57bG9jYWwuY2hpbGRyZW59PC9zcGFuPlxuICAgICAgPC9TaG93PlxuXG4gICAgICA8U2hvdyB3aGVuPXtsb2NhbC5yaWdodEljb259PlxuICAgICAgICB7bG9jYWwucmlnaHRJY29ufVxuICAgICAgPC9TaG93PlxuICAgIDwvYnV0dG9uPlxuICApXG59IiwiaW1wb3J0IHsgU2hvdywgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9CdXR0b24nO1xuXG5leHBvcnQgdHlwZSBPbmJvYXJkaW5nU3RlcCA9ICdjb25uZWN0LXdhbGxldCcgfCAnZ2VuZXJhdGluZy10b2tlbicgfCAnY29tcGxldGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE9uYm9hcmRpbmdGbG93UHJvcHMge1xuICBzdGVwOiBPbmJvYXJkaW5nU3RlcDtcbiAgZXJyb3I/OiBzdHJpbmcgfCBudWxsO1xuICB3YWxsZXRBZGRyZXNzPzogc3RyaW5nIHwgbnVsbDtcbiAgdG9rZW4/OiBzdHJpbmcgfCBudWxsO1xuICBvbkNvbm5lY3RXYWxsZXQ6ICgpID0+IHZvaWQ7XG4gIG9uVXNlVGVzdE1vZGU6ICgpID0+IHZvaWQ7XG4gIG9uVXNlUHJpdmF0ZUtleTogKHByaXZhdGVLZXk6IHN0cmluZykgPT4gdm9pZDtcbiAgb25Db21wbGV0ZTogKCkgPT4gdm9pZDtcbiAgaXNDb25uZWN0aW5nPzogYm9vbGVhbjtcbiAgaXNHZW5lcmF0aW5nPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBPbmJvYXJkaW5nRmxvdzogQ29tcG9uZW50PE9uYm9hcmRpbmdGbG93UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtzaG93VGVzdE9wdGlvbiwgc2V0U2hvd1Rlc3RPcHRpb25dID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3Nob3dQcml2YXRlS2V5SW5wdXQsIHNldFNob3dQcml2YXRlS2V5SW5wdXRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3ByaXZhdGVLZXksIHNldFByaXZhdGVLZXldID0gY3JlYXRlU2lnbmFsKCcnKTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgJ21pbi1oLXNjcmVlbiBiZy1ncmFkaWVudC10by1iciBmcm9tLWdyYXktOTAwIHRvLWJsYWNrIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyJyxcbiAgICAgIHByb3BzLmNsYXNzXG4gICAgKX0+XG4gICAgICA8ZGl2IGNsYXNzPVwibWF4LXctMnhsIHctZnVsbCBwLTEyXCI+XG4gICAgICAgIHsvKiBMb2dvL0hlYWRlciAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIG1iLTEyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtOHhsIG1iLTZcIj7wn46kPC9kaXY+XG4gICAgICAgICAgPGgxIGNsYXNzPVwidGV4dC02eGwgZm9udC1ib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgU2NhcmxldHQgS2FyYW9rZVxuICAgICAgICAgIDwvaDE+XG4gICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXhsIHRleHQtZ3JheS00MDBcIj5cbiAgICAgICAgICAgIEFJLXBvd2VyZWQga2FyYW9rZSBmb3IgU291bmRDbG91ZFxuICAgICAgICAgIDwvcD5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgey8qIFByb2dyZXNzIERvdHMgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGp1c3RpZnktY2VudGVyIG1iLTEyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZ2FwLTNcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAndy0zIGgtMyByb3VuZGVkLWZ1bGwgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgICAgICAgcHJvcHMuc3RlcCA9PT0gJ2Nvbm5lY3Qtd2FsbGV0JyBcbiAgICAgICAgICAgICAgICA/ICdiZy1wdXJwbGUtNTAwIHctMTInIFxuICAgICAgICAgICAgICAgIDogcHJvcHMud2FsbGV0QWRkcmVzcyBcbiAgICAgICAgICAgICAgICAgID8gJ2JnLWdyZWVuLTUwMCcgXG4gICAgICAgICAgICAgICAgICA6ICdiZy1ncmF5LTYwMCdcbiAgICAgICAgICAgICl9IC8+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3ctMyBoLTMgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgICAgICAgIHByb3BzLnN0ZXAgPT09ICdnZW5lcmF0aW5nLXRva2VuJyBcbiAgICAgICAgICAgICAgICA/ICdiZy1wdXJwbGUtNTAwIHctMTInIFxuICAgICAgICAgICAgICAgIDogcHJvcHMudG9rZW4gXG4gICAgICAgICAgICAgICAgICA/ICdiZy1ncmVlbi01MDAnIFxuICAgICAgICAgICAgICAgICAgOiAnYmctZ3JheS02MDAnXG4gICAgICAgICAgICApfSAvPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICd3LTMgaC0zIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICAgICAgICBwcm9wcy5zdGVwID09PSAnY29tcGxldGUnIFxuICAgICAgICAgICAgICAgID8gJ2JnLWdyZWVuLTUwMCB3LTEyJyBcbiAgICAgICAgICAgICAgICA6ICdiZy1ncmF5LTYwMCdcbiAgICAgICAgICAgICl9IC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHsvKiBFcnJvciBEaXNwbGF5ICovfVxuICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5lcnJvcn0+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm1iLTggcC02IGJnLXJlZC05MDAvMjAgYm9yZGVyIGJvcmRlci1yZWQtODAwIHJvdW5kZWQteGxcIj5cbiAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1yZWQtNDAwIHRleHQtY2VudGVyIHRleHQtbGdcIj57cHJvcHMuZXJyb3J9PC9wPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgey8qIENvbnRlbnQgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LTZcIj5cbiAgICAgICAgICB7LyogQ29ubmVjdCBXYWxsZXQgU3RlcCAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zdGVwID09PSAnY29ubmVjdC13YWxsZXQnfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBzcGFjZS15LThcIj5cbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTR4bCBmb250LXNlbWlib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgICAgICAgQ29ubmVjdCBZb3VyIFdhbGxldFxuICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQtbGcgbWF4LXctbWQgbXgtYXV0b1wiPlxuICAgICAgICAgICAgICAgICAgQ29ubmVjdCB5b3VyIHdhbGxldCB0byBnZXQgc3RhcnRlZFxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNCBtYXgtdy1tZCBteC1hdXRvXCI+XG4gICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25Db25uZWN0V2FsbGV0fVxuICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmlzQ29ubmVjdGluZ31cbiAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE2IHRleHQtbGdcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIHtwcm9wcy5pc0Nvbm5lY3RpbmcgPyAoXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInctNCBoLTQgYm9yZGVyLTIgYm9yZGVyLWN1cnJlbnQgYm9yZGVyLXItdHJhbnNwYXJlbnQgcm91bmRlZC1mdWxsIGFuaW1hdGUtc3BpblwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgQ29ubmVjdGluZy4uLlxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4+8J+mijwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICBDb25uZWN0IHdpdGggTWV0YU1hc2tcbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L0J1dHRvbj5cblxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49eyFzaG93VGVzdE9wdGlvbigpICYmICFzaG93UHJpdmF0ZUtleUlucHV0KCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZ2FwLTQganVzdGlmeS1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dUZXN0T3B0aW9uKHRydWUpfVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIFVzZSBkZW1vIG1vZGVcbiAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidGV4dC1ncmF5LTYwMFwiPnw8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93UHJpdmF0ZUtleUlucHV0KHRydWUpfVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIFVzZSBwcml2YXRlIGtleVxuICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Nob3dUZXN0T3B0aW9uKCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB0LTYgc3BhY2UteS00XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib3JkZXItdCBib3JkZXItZ3JheS04MDAgcHQtNlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uVXNlVGVzdE1vZGV9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwic2Vjb25kYXJ5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0XCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICBDb250aW51ZSB3aXRoIERlbW8gTW9kZVxuICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dUZXN0T3B0aW9uKGZhbHNlKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzIG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIEJhY2tcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtzaG93UHJpdmF0ZUtleUlucHV0KCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB0LTYgc3BhY2UteS00XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib3JkZXItdCBib3JkZXItZ3JheS04MDAgcHQtNlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cInBhc3N3b3JkXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtwcml2YXRlS2V5KCl9XG4gICAgICAgICAgICAgICAgICAgICAgICBvbklucHV0PXsoZSkgPT4gc2V0UHJpdmF0ZUtleShlLmN1cnJlbnRUYXJnZXQudmFsdWUpfVxuICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJFbnRlciBwcml2YXRlIGtleVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0IHB4LTQgYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLWxnIHRleHQtd2hpdGUgcGxhY2Vob2xkZXItZ3JheS01MDAgZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1wdXJwbGUtNTAwXCJcbiAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHByb3BzLm9uVXNlUHJpdmF0ZUtleShwcml2YXRlS2V5KCkpfVxuICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFwcml2YXRlS2V5KCkgfHwgcHJpdmF0ZUtleSgpLmxlbmd0aCAhPT0gNjR9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwic2Vjb25kYXJ5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0IG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIENvbm5lY3Qgd2l0aCBQcml2YXRlIEtleVxuICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd1ByaXZhdGVLZXlJbnB1dChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldFByaXZhdGVLZXkoJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzIG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIEJhY2tcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICB7LyogR2VuZXJhdGluZyBUb2tlbiBTdGVwICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnN0ZXAgPT09ICdnZW5lcmF0aW5nLXRva2VuJ30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgc3BhY2UteS04XCI+XG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC00eGwgZm9udC1zZW1pYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj5cbiAgICAgICAgICAgICAgICAgIFNldHRpbmcgVXAgWW91ciBBY2NvdW50XG4gICAgICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy53YWxsZXRBZGRyZXNzfT5cbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTQwMCB0ZXh0LWxnIG1iLTNcIj5cbiAgICAgICAgICAgICAgICAgICAgQ29ubmVjdGVkIHdhbGxldDpcbiAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgIDxjb2RlIGNsYXNzPVwidGV4dC1sZyB0ZXh0LXB1cnBsZS00MDAgYmctZ3JheS04MDAgcHgtNCBweS0yIHJvdW5kZWQtbGcgZm9udC1tb25vIGlubGluZS1ibG9ja1wiPlxuICAgICAgICAgICAgICAgICAgICB7cHJvcHMud2FsbGV0QWRkcmVzcz8uc2xpY2UoMCwgNil9Li4ue3Byb3BzLndhbGxldEFkZHJlc3M/LnNsaWNlKC00KX1cbiAgICAgICAgICAgICAgICAgIDwvY29kZT5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJweS0xMlwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ3LTIwIGgtMjAgYm9yZGVyLTQgYm9yZGVyLXB1cnBsZS01MDAgYm9yZGVyLXQtdHJhbnNwYXJlbnQgcm91bmRlZC1mdWxsIGFuaW1hdGUtc3BpbiBteC1hdXRvXCIgLz5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQteGxcIj5cbiAgICAgICAgICAgICAgICB7cHJvcHMuaXNHZW5lcmF0aW5nIFxuICAgICAgICAgICAgICAgICAgPyAnR2VuZXJhdGluZyB5b3VyIGFjY2VzcyB0b2tlbi4uLicgXG4gICAgICAgICAgICAgICAgICA6ICdWZXJpZnlpbmcgeW91ciBhY2NvdW50Li4uJ31cbiAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgey8qIENvbXBsZXRlIFN0ZXAgKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuc3RlcCA9PT0gJ2NvbXBsZXRlJ30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgc3BhY2UteS04XCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTh4bCBtYi02XCI+8J+OiTwvZGl2PlxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTR4bCBmb250LXNlbWlib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgICAgICAgWW91J3JlIEFsbCBTZXQhXG4gICAgICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS00MDAgdGV4dC14bCBtYXgtdy1tZCBteC1hdXRvIG1iLThcIj5cbiAgICAgICAgICAgICAgICAgIFlvdXIgYWNjb3VudCBpcyByZWFkeS4gVGltZSB0byBzaW5nIVxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1heC13LW1kIG14LWF1dG9cIj5cbiAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNvbXBsZXRlfVxuICAgICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTYgdGV4dC1sZ1wiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgU3RhcnQgU2luZ2luZyEg8J+agFxuICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS01MDAgbXQtNlwiPlxuICAgICAgICAgICAgICAgIExvb2sgZm9yIHRoZSBrYXJhb2tlIHdpZGdldCBvbiBhbnkgU291bmRDbG91ZCB0cmFja1xuICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IEZvciwgY3JlYXRlRWZmZWN0LCBjcmVhdGVTaWduYWwsIFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEx5cmljTGluZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRleHQ6IHN0cmluZztcbiAgc3RhcnRUaW1lOiBudW1iZXI7IC8vIGluIHNlY29uZHNcbiAgZHVyYXRpb246IG51bWJlcjsgLy8gaW4gbWlsbGlzZWNvbmRzXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTHlyaWNzRGlzcGxheVByb3BzIHtcbiAgbHlyaWNzOiBMeXJpY0xpbmVbXTtcbiAgY3VycmVudFRpbWU/OiBudW1iZXI7IC8vIGluIG1pbGxpc2Vjb25kc1xuICBpc1BsYXlpbmc/OiBib29sZWFuO1xuICBsaW5lU2NvcmVzPzogQXJyYXk8eyBsaW5lSW5kZXg6IG51bWJlcjsgc2NvcmU6IG51bWJlcjsgdHJhbnNjcmlwdGlvbjogc3RyaW5nOyBmZWVkYmFjaz86IHN0cmluZyB9PjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBMeXJpY3NEaXNwbGF5OiBDb21wb25lbnQ8THlyaWNzRGlzcGxheVByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbY3VycmVudExpbmVJbmRleCwgc2V0Q3VycmVudExpbmVJbmRleF0gPSBjcmVhdGVTaWduYWwoLTEpO1xuICBsZXQgY29udGFpbmVyUmVmOiBIVE1MRGl2RWxlbWVudCB8IHVuZGVmaW5lZDtcbiAgXG4gIC8vIEhlbHBlciB0byBnZXQgc2NvcmUgZm9yIGEgbGluZVxuICBjb25zdCBnZXRMaW5lU2NvcmUgPSAobGluZUluZGV4OiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gcHJvcHMubGluZVNjb3Jlcz8uZmluZChzID0+IHMubGluZUluZGV4ID09PSBsaW5lSW5kZXgpPy5zY29yZSB8fCBudWxsO1xuICB9O1xuICBcbiAgLy8gSGVscGVyIHRvIGdldCBjb2xvciBiYXNlZCBvbiBzY29yZVxuICBjb25zdCBnZXRTY29yZVN0eWxlID0gKHNjb3JlOiBudW1iZXIgfCBudWxsKSA9PiB7XG4gICAgaWYgKHNjb3JlID09PSBudWxsKSByZXR1cm4ge307XG4gICAgXG4gICAgLy8gU2ltcGxlIGNvbG9yIGNoYW5nZXMgb25seSAtIG5vIGFuaW1hdGlvbnMgb3IgZWZmZWN0c1xuICAgIGlmIChzY29yZSA+PSA5NSkge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmYzODM4JyB9O1xuICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gOTApIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmNmI2YicgfTtcbiAgICB9IGVsc2UgaWYgKHNjb3JlID49IDgwKSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZjg3ODcnIH07XG4gICAgfSBlbHNlIGlmIChzY29yZSA+PSA3MCkge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmZhOGE4JyB9O1xuICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gNjApIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmY2VjZScgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmZlMGUwJyB9O1xuICAgIH1cbiAgfTtcbiAgXG4gIC8vIFJlbW92ZWQgZW1vamkgZnVuY3Rpb24gLSB1c2luZyBjb2xvcnMgb25seVxuXG4gIC8vIEZpbmQgY3VycmVudCBsaW5lIGJhc2VkIG9uIHRpbWVcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIXByb3BzLmN1cnJlbnRUaW1lIHx8ICFwcm9wcy5seXJpY3MubGVuZ3RoKSB7XG4gICAgICBzZXRDdXJyZW50TGluZUluZGV4KC0xKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0aW1lID0gcHJvcHMuY3VycmVudFRpbWUgLyAxMDAwOyAvLyBDb252ZXJ0IGZyb20gbWlsbGlzZWNvbmRzIHRvIHNlY29uZHNcbiAgICBjb25zdCBUSU1JTkdfT0ZGU0VUID0gMC4zOyAvLyBPZmZzZXQgdG8gbWFrZSBseXJpY3MgYXBwZWFyIDAuM3MgZWFybGllclxuICAgIGNvbnN0IGFkanVzdGVkVGltZSA9IHRpbWUgKyBUSU1JTkdfT0ZGU0VUO1xuICAgIFxuICAgIC8vIEZpbmQgdGhlIGxpbmUgdGhhdCBjb250YWlucyB0aGUgY3VycmVudCB0aW1lXG4gICAgbGV0IGZvdW5kSW5kZXggPSAtMTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByb3BzLmx5cmljcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgbGluZSA9IHByb3BzLmx5cmljc1tpXTtcbiAgICAgIGlmICghbGluZSkgY29udGludWU7XG4gICAgICBjb25zdCBlbmRUaW1lID0gbGluZS5zdGFydFRpbWUgKyBsaW5lLmR1cmF0aW9uIC8gMTAwMDsgLy8gQ29udmVydCBkdXJhdGlvbiBmcm9tIG1zIHRvIHNlY29uZHNcbiAgICAgIFxuICAgICAgaWYgKGFkanVzdGVkVGltZSA+PSBsaW5lLnN0YXJ0VGltZSAmJiBhZGp1c3RlZFRpbWUgPCBlbmRUaW1lKSB7XG4gICAgICAgIGZvdW5kSW5kZXggPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gSWYgbm8gbGluZSBjb250YWlucyBjdXJyZW50IHRpbWUsIGZpbmQgdGhlIG1vc3QgcmVjZW50IHBhc3QgbGluZVxuICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSAmJiB0aW1lID4gMCkge1xuICAgICAgZm9yIChsZXQgaSA9IHByb3BzLmx5cmljcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBjb25zdCBsaW5lID0gcHJvcHMubHlyaWNzW2ldO1xuICAgICAgICBpZiAoIWxpbmUpIGNvbnRpbnVlO1xuICAgICAgICBpZiAodGltZSA+PSBsaW5lLnN0YXJ0VGltZSkge1xuICAgICAgICAgIGZvdW5kSW5kZXggPSBpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIE9ubHkgdXBkYXRlIGlmIHRoZSBpbmRleCBoYXMgY2hhbmdlZCB0byBhdm9pZCB1bm5lY2Vzc2FyeSBzY3JvbGxpbmdcbiAgICBpZiAoZm91bmRJbmRleCAhPT0gY3VycmVudExpbmVJbmRleCgpKSB7XG4gICAgICBjb25zdCBwcmV2SW5kZXggPSBjdXJyZW50TGluZUluZGV4KCk7XG4gICAgICAvLyBPbmx5IGxvZyBsYXJnZSBqdW1wcyB0byByZWR1Y2UgY29uc29sZSBzcGFtXG4gICAgICBpZiAoTWF0aC5hYnMoZm91bmRJbmRleCAtIHByZXZJbmRleCkgPiA1KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbTHlyaWNzRGlzcGxheV0gQ3VycmVudCBsaW5lIGNoYW5nZWQ6Jywge1xuICAgICAgICAgIGZyb206IHByZXZJbmRleCxcbiAgICAgICAgICB0bzogZm91bmRJbmRleCxcbiAgICAgICAgICB0aW1lOiBwcm9wcy5jdXJyZW50VGltZSxcbiAgICAgICAgICB0aW1lSW5TZWNvbmRzOiB0aW1lLFxuICAgICAgICAgIGp1bXA6IE1hdGguYWJzKGZvdW5kSW5kZXggLSBwcmV2SW5kZXgpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBMb2cgd2FybmluZyBmb3IgbGFyZ2UganVtcHNcbiAgICAgIGlmIChwcmV2SW5kZXggIT09IC0xICYmIE1hdGguYWJzKGZvdW5kSW5kZXggLSBwcmV2SW5kZXgpID4gMTApIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdbTHlyaWNzRGlzcGxheV0gTGFyZ2UgbGluZSBqdW1wIGRldGVjdGVkIScsIHtcbiAgICAgICAgICBmcm9tOiBwcmV2SW5kZXgsXG4gICAgICAgICAgdG86IGZvdW5kSW5kZXgsXG4gICAgICAgICAgZnJvbUxpbmU6IHByb3BzLmx5cmljc1twcmV2SW5kZXhdLFxuICAgICAgICAgIHRvTGluZTogcHJvcHMubHlyaWNzW2ZvdW5kSW5kZXhdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBzZXRDdXJyZW50TGluZUluZGV4KGZvdW5kSW5kZXgpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gQXV0by1zY3JvbGwgdG8gY3VycmVudCBsaW5lXG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgaW5kZXggPSBjdXJyZW50TGluZUluZGV4KCk7XG4gICAgaWYgKGluZGV4ID09PSAtMSB8fCAhY29udGFpbmVyUmVmIHx8ICFwcm9wcy5pc1BsYXlpbmcpIHJldHVybjtcblxuICAgIGNvbnN0IGxpbmVFbGVtZW50cyA9IGNvbnRhaW5lclJlZi5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1saW5lLWluZGV4XScpO1xuICAgIGNvbnN0IGN1cnJlbnRFbGVtZW50ID0gbGluZUVsZW1lbnRzW2luZGV4XSBhcyBIVE1MRWxlbWVudDtcblxuICAgIGlmIChjdXJyZW50RWxlbWVudCkge1xuICAgICAgY29uc3QgY29udGFpbmVySGVpZ2h0ID0gY29udGFpbmVyUmVmLmNsaWVudEhlaWdodDtcbiAgICAgIGNvbnN0IGxpbmVUb3AgPSBjdXJyZW50RWxlbWVudC5vZmZzZXRUb3A7XG4gICAgICBjb25zdCBsaW5lSGVpZ2h0ID0gY3VycmVudEVsZW1lbnQub2Zmc2V0SGVpZ2h0O1xuICAgICAgXG4gICAgICAvLyBDZW50ZXIgdGhlIGN1cnJlbnQgbGluZVxuICAgICAgY29uc3QgdGFyZ2V0U2Nyb2xsVG9wID0gbGluZVRvcCAtIGNvbnRhaW5lckhlaWdodCAvIDIgKyBsaW5lSGVpZ2h0IC8gMjtcbiAgICAgIFxuICAgICAgY29udGFpbmVyUmVmLnNjcm9sbFRvKHtcbiAgICAgICAgdG9wOiB0YXJnZXRTY3JvbGxUb3AsXG4gICAgICAgIGJlaGF2aW9yOiAnc21vb3RoJyxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICByZWY9e2NvbnRhaW5lclJlZn1cbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2x5cmljcy1kaXNwbGF5IG92ZXJmbG93LXktYXV0byBzY3JvbGwtc21vb3RoJyxcbiAgICAgICAgJ2gtZnVsbCBweC02IHB5LTEyJyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktOFwiPlxuICAgICAgICA8Rm9yIGVhY2g9e3Byb3BzLmx5cmljc30+XG4gICAgICAgICAgeyhsaW5lLCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbGluZVNjb3JlID0gKCkgPT4gZ2V0TGluZVNjb3JlKGluZGV4KCkpO1xuICAgICAgICAgICAgY29uc3Qgc2NvcmVTdHlsZSA9ICgpID0+IGdldFNjb3JlU3R5bGUobGluZVNjb3JlKCkpO1xuICAgICAgICAgICAgLy8gVXNpbmcgY29sb3IgZ3JhZGllbnRzIGluc3RlYWQgb2YgZW1vamlzXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICBkYXRhLWxpbmUtaW5kZXg9e2luZGV4KCl9XG4gICAgICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICAgJ3RleHQtY2VudGVyJyxcbiAgICAgICAgICAgICAgICAgICd0ZXh0LTJ4bCBsZWFkaW5nLXJlbGF4ZWQnLFxuICAgICAgICAgICAgICAgICAgaW5kZXgoKSA9PT0gY3VycmVudExpbmVJbmRleCgpXG4gICAgICAgICAgICAgICAgICAgID8gJ29wYWNpdHktMTAwJ1xuICAgICAgICAgICAgICAgICAgICA6ICdvcGFjaXR5LTYwJ1xuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgIGNvbG9yOiBpbmRleCgpID09PSBjdXJyZW50TGluZUluZGV4KCkgJiYgIWxpbmVTY29yZSgpIFxuICAgICAgICAgICAgICAgICAgICA/ICcjZmZmZmZmJyAvLyBXaGl0ZSBmb3IgY3VycmVudCBsaW5lIHdpdGhvdXQgc2NvcmVcbiAgICAgICAgICAgICAgICAgICAgOiBzY29yZVN0eWxlKCkuY29sb3IgfHwgJyNmZmZmZmYnXG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIHtsaW5lLnRleHR9XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9fVxuICAgICAgICA8L0Zvcj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEthcmFva2VIZWFkZXJQcm9wcyB7XG4gIHNvbmdUaXRsZTogc3RyaW5nO1xuICBhcnRpc3Q6IHN0cmluZztcbiAgb25CYWNrPzogKCkgPT4gdm9pZDtcbiAgaXNQbGF5aW5nPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmNvbnN0IENoZXZyb25MZWZ0ID0gKCkgPT4gKFxuICA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBjbGFzcz1cInctNiBoLTZcIj5cbiAgICA8cGF0aCBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBkPVwiTTE1IDE5bC03LTcgNy03XCIgLz5cbiAgPC9zdmc+XG4pO1xuXG5jb25zdCBQYXVzZUljb24gPSAoKSA9PiAoXG4gIDxzdmcgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIGNsYXNzPVwidy02IGgtNlwiPlxuICAgIDxwYXRoIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiIGQ9XCJNMTAgOXY2bTQtNnY2bTctM2E5IDkgMCAxMS0xOCAwIDkgOSAwIDAxMTggMHpcIiAvPlxuICA8L3N2Zz5cbik7XG5cbmV4cG9ydCBjb25zdCBLYXJhb2tlSGVhZGVyOiBDb21wb25lbnQ8S2FyYW9rZUhlYWRlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdyZWxhdGl2ZSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLTQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgey8qIEJhY2svUGF1c2UgYnV0dG9uIC0gYWJzb2x1dGUgcG9zaXRpb25lZCAqL31cbiAgICAgIDxidXR0b25cbiAgICAgICAgb25DbGljaz17cHJvcHMub25CYWNrfVxuICAgICAgICBjbGFzcz1cImFic29sdXRlIGxlZnQtNCBwLTIgLW0tMiB0ZXh0LXNlY29uZGFyeSBob3Zlcjp0ZXh0LXByaW1hcnkgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICBhcmlhLWxhYmVsPXtwcm9wcy5pc1BsYXlpbmcgPyBcIlBhdXNlXCIgOiBcIkdvIGJhY2tcIn1cbiAgICAgID5cbiAgICAgICAge3Byb3BzLmlzUGxheWluZyA/IDxQYXVzZUljb24gLz4gOiA8Q2hldnJvbkxlZnQgLz59XG4gICAgICA8L2J1dHRvbj5cbiAgICAgIFxuICAgICAgey8qIFNvbmcgaW5mbyAtIGNlbnRlcmVkICovfVxuICAgICAgPGgxIGNsYXNzPVwidGV4dC1iYXNlIGZvbnQtbWVkaXVtIHRleHQtcHJpbWFyeSB0ZXh0LWNlbnRlciBweC0xMiB0cnVuY2F0ZSBtYXgtdy1mdWxsXCI+XG4gICAgICAgIHtwcm9wcy5zb25nVGl0bGV9IC0ge3Byb3BzLmFydGlzdH1cbiAgICAgIDwvaDE+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IEZvciwgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGVhZGVyYm9hcmRFbnRyeSB7XG4gIHJhbms6IG51bWJlcjtcbiAgdXNlcm5hbWU6IHN0cmluZztcbiAgc2NvcmU6IG51bWJlcjtcbiAgaXNDdXJyZW50VXNlcj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGVhZGVyYm9hcmRQYW5lbFByb3BzIHtcbiAgZW50cmllczogTGVhZGVyYm9hcmRFbnRyeVtdO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IExlYWRlcmJvYXJkUGFuZWw6IENvbXBvbmVudDxMZWFkZXJib2FyZFBhbmVsUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgZ2FwLTIgcC00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxTaG93IFxuICAgICAgICB3aGVuPXtwcm9wcy5lbnRyaWVzLmxlbmd0aCA+IDB9XG4gICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcHktMTIgcHgtNiB0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtNnhsIG1iLTQgb3BhY2l0eS0zMFwiPvCfjqQ8L2Rpdj5cbiAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0yXCI+Tm9ib2R5IGhhcyBjb21wbGV0ZWQgdGhpcyBzb25nIHlldCE8L3A+XG4gICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc20gdGV4dC10ZXJ0aWFyeVwiPkJlIHRoZSBmaXJzdCB0byBzZXQgYSBoaWdoIHNjb3JlPC9wPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICB9XG4gICAgICA+XG4gICAgICAgIDxGb3IgZWFjaD17cHJvcHMuZW50cmllc30+XG4gICAgICAgICAgeyhlbnRyeSkgPT4gKFxuICAgICAgICAgICAgPGRpdiBcbiAgICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICdmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBweC0zIHB5LTIgcm91bmRlZC1sZyB0cmFuc2l0aW9uLWNvbG9ycycsXG4gICAgICAgICAgICAgICAgZW50cnkuaXNDdXJyZW50VXNlciBcbiAgICAgICAgICAgICAgICAgID8gJ2JnLWFjY2VudC1wcmltYXJ5LzEwIGJvcmRlciBib3JkZXItYWNjZW50LXByaW1hcnkvMjAnIFxuICAgICAgICAgICAgICAgICAgOiAnYmctc3VyZmFjZSBob3ZlcjpiZy1zdXJmYWNlLWhvdmVyJ1xuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8c3BhbiBcbiAgICAgICAgICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICAgICAndy04IHRleHQtY2VudGVyIGZvbnQtbW9ubyBmb250LWJvbGQnLFxuICAgICAgICAgICAgICAgICAgZW50cnkucmFuayA8PSAzID8gJ3RleHQtYWNjZW50LXByaW1hcnknIDogJ3RleHQtc2Vjb25kYXJ5J1xuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAje2VudHJ5LnJhbmt9XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICdmbGV4LTEgdHJ1bmNhdGUnLFxuICAgICAgICAgICAgICAgIGVudHJ5LmlzQ3VycmVudFVzZXIgPyAndGV4dC1hY2NlbnQtcHJpbWFyeSBmb250LW1lZGl1bScgOiAndGV4dC1wcmltYXJ5J1xuICAgICAgICAgICAgICApfT5cbiAgICAgICAgICAgICAgICB7ZW50cnkudXNlcm5hbWV9XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICdmb250LW1vbm8gZm9udC1ib2xkJyxcbiAgICAgICAgICAgICAgICBlbnRyeS5pc0N1cnJlbnRVc2VyID8gJ3RleHQtYWNjZW50LXByaW1hcnknIDogJ3RleHQtcHJpbWFyeSdcbiAgICAgICAgICAgICAgKX0+XG4gICAgICAgICAgICAgICAge2VudHJ5LnNjb3JlLnRvTG9jYWxlU3RyaW5nKCl9XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvRm9yPlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgdHlwZSBQbGF5YmFja1NwZWVkID0gJzF4JyB8ICcwLjc1eCcgfCAnMC41eCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3BsaXRCdXR0b25Qcm9wcyB7XG4gIG9uU3RhcnQ/OiAoKSA9PiB2b2lkO1xuICBvblNwZWVkQ2hhbmdlPzogKHNwZWVkOiBQbGF5YmFja1NwZWVkKSA9PiB2b2lkO1xuICBkaXNhYmxlZD86IGJvb2xlYW47XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5jb25zdCBzcGVlZHM6IFBsYXliYWNrU3BlZWRbXSA9IFsnMXgnLCAnMC43NXgnLCAnMC41eCddO1xuXG5leHBvcnQgY29uc3QgU3BsaXRCdXR0b246IENvbXBvbmVudDxTcGxpdEJ1dHRvblByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbY3VycmVudFNwZWVkSW5kZXgsIHNldEN1cnJlbnRTcGVlZEluZGV4XSA9IGNyZWF0ZVNpZ25hbCgwKTtcbiAgXG4gIGNvbnN0IGN1cnJlbnRTcGVlZCA9ICgpID0+IHNwZWVkc1tjdXJyZW50U3BlZWRJbmRleCgpXTtcbiAgXG4gIGNvbnN0IGN5Y2xlU3BlZWQgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgY29uc3QgbmV4dEluZGV4ID0gKGN1cnJlbnRTcGVlZEluZGV4KCkgKyAxKSAlIHNwZWVkcy5sZW5ndGg7XG4gICAgc2V0Q3VycmVudFNwZWVkSW5kZXgobmV4dEluZGV4KTtcbiAgICBjb25zdCBuZXdTcGVlZCA9IHNwZWVkc1tuZXh0SW5kZXhdO1xuICAgIGlmIChuZXdTcGVlZCkge1xuICAgICAgcHJvcHMub25TcGVlZENoYW5nZT8uKG5ld1NwZWVkKTtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IFxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAncmVsYXRpdmUgaW5saW5lLWZsZXggdy1mdWxsIHJvdW5kZWQtbGcgb3ZlcmZsb3ctaGlkZGVuJyxcbiAgICAgICAgJ2JnLWdyYWRpZW50LXByaW1hcnkgdGV4dC13aGl0ZSBzaGFkb3ctbGcnLFxuICAgICAgICAndHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgey8qIE1haW4gYnV0dG9uICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblN0YXJ0fVxuICAgICAgICBkaXNhYmxlZD17cHJvcHMuZGlzYWJsZWR9XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnZmxleC0xIGlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByZWxhdGl2ZSBvdmVyZmxvdy1oaWRkZW4nLFxuICAgICAgICAgICdoLTEyIHB4LTYgdGV4dC1sZyBmb250LW1lZGl1bScsXG4gICAgICAgICAgJ2N1cnNvci1wb2ludGVyIGJvcmRlci1ub25lIG91dGxpbmUtbm9uZScsXG4gICAgICAgICAgJ2Rpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAgICAnaG92ZXI6Ymctd2hpdGUvMTAgYWN0aXZlOmJnLXdoaXRlLzIwJ1xuICAgICAgICApfVxuICAgICAgPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInJlbGF0aXZlIHotMTBcIj5TdGFydDwvc3Bhbj5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgXG4gICAgICB7LyogRGl2aWRlciAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJ3LXB4IGJnLWJsYWNrLzIwXCIgLz5cbiAgICAgIFxuICAgICAgey8qIFNwZWVkIGJ1dHRvbiAqL31cbiAgICAgIDxidXR0b25cbiAgICAgICAgb25DbGljaz17Y3ljbGVTcGVlZH1cbiAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmRpc2FibGVkfVxuICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgJ2lubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByZWxhdGl2ZScsXG4gICAgICAgICAgJ3ctMjAgdGV4dC1sZyBmb250LW1lZGl1bScsXG4gICAgICAgICAgJ2N1cnNvci1wb2ludGVyIGJvcmRlci1ub25lIG91dGxpbmUtbm9uZScsXG4gICAgICAgICAgJ2Rpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAgICAnaG92ZXI6Ymctd2hpdGUvMTAgYWN0aXZlOmJnLXdoaXRlLzIwJyxcbiAgICAgICAgICAnYWZ0ZXI6Y29udGVudC1bXCJcIl0gYWZ0ZXI6YWJzb2x1dGUgYWZ0ZXI6aW5zZXQtMCcsXG4gICAgICAgICAgJ2FmdGVyOmJnLWdyYWRpZW50LXRvLXIgYWZ0ZXI6ZnJvbS10cmFuc3BhcmVudCBhZnRlcjp2aWEtd2hpdGUvMjAgYWZ0ZXI6dG8tdHJhbnNwYXJlbnQnLFxuICAgICAgICAgICdhZnRlcjp0cmFuc2xhdGUteC1bLTIwMCVdIGhvdmVyOmFmdGVyOnRyYW5zbGF0ZS14LVsyMDAlXScsXG4gICAgICAgICAgJ2FmdGVyOnRyYW5zaXRpb24tdHJhbnNmb3JtIGFmdGVyOmR1cmF0aW9uLTcwMCdcbiAgICAgICAgKX1cbiAgICAgICAgYXJpYS1sYWJlbD1cIkNoYW5nZSBwbGF5YmFjayBzcGVlZFwiXG4gICAgICA+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwicmVsYXRpdmUgei0xMFwiPntjdXJyZW50U3BlZWQoKX08L3NwYW4+XG4gICAgICA8L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsLCBTaG93LCBjcmVhdGVDb250ZXh0LCB1c2VDb250ZXh0IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQsIEpTWCwgUGFyZW50Q29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFiIHtcbiAgaWQ6IHN0cmluZztcbiAgbGFiZWw6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzUHJvcHMge1xuICB0YWJzOiBUYWJbXTtcbiAgZGVmYXVsdFRhYj86IHN0cmluZztcbiAgb25UYWJDaGFuZ2U/OiAodGFiSWQ6IHN0cmluZykgPT4gdm9pZDtcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzTGlzdFByb3BzIHtcbiAgY2xhc3M/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzVHJpZ2dlclByb3BzIHtcbiAgdmFsdWU6IHN0cmluZztcbiAgY2xhc3M/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzQ29udGVudFByb3BzIHtcbiAgdmFsdWU6IHN0cmluZztcbiAgY2xhc3M/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbn1cblxuLy8gQ29udGV4dCBmb3IgdGFicyBzdGF0ZVxuaW50ZXJmYWNlIFRhYnNDb250ZXh0VmFsdWUge1xuICBhY3RpdmVUYWI6ICgpID0+IHN0cmluZztcbiAgc2V0QWN0aXZlVGFiOiAoaWQ6IHN0cmluZykgPT4gdm9pZDtcbn1cblxuY29uc3QgVGFic0NvbnRleHQgPSBjcmVhdGVDb250ZXh0PFRhYnNDb250ZXh0VmFsdWU+KCk7XG5cbmV4cG9ydCBjb25zdCBUYWJzOiBQYXJlbnRDb21wb25lbnQ8VGFic1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbYWN0aXZlVGFiLCBzZXRBY3RpdmVUYWJdID0gY3JlYXRlU2lnbmFsKHByb3BzLmRlZmF1bHRUYWIgfHwgcHJvcHMudGFic1swXT8uaWQgfHwgJycpO1xuICBcbiAgY29uc29sZS5sb2coJ1tUYWJzXSBJbml0aWFsaXppbmcgd2l0aDonLCB7XG4gICAgZGVmYXVsdFRhYjogcHJvcHMuZGVmYXVsdFRhYixcbiAgICBmaXJzdFRhYklkOiBwcm9wcy50YWJzWzBdPy5pZCxcbiAgICBhY3RpdmVUYWI6IGFjdGl2ZVRhYigpXG4gIH0pO1xuICBcbiAgY29uc3QgaGFuZGxlVGFiQ2hhbmdlID0gKGlkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW1RhYnNdIFRhYiBjaGFuZ2VkIHRvOicsIGlkKTtcbiAgICBzZXRBY3RpdmVUYWIoaWQpO1xuICAgIHByb3BzLm9uVGFiQ2hhbmdlPy4oaWQpO1xuICB9O1xuXG4gIGNvbnN0IGNvbnRleHRWYWx1ZTogVGFic0NvbnRleHRWYWx1ZSA9IHtcbiAgICBhY3RpdmVUYWIsXG4gICAgc2V0QWN0aXZlVGFiOiBoYW5kbGVUYWJDaGFuZ2VcbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxUYWJzQ29udGV4dC5Qcm92aWRlciB2YWx1ZT17Y29udGV4dFZhbHVlfT5cbiAgICAgIDxkaXYgY2xhc3M9e2NuKCd3LWZ1bGwnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgICA8L2Rpdj5cbiAgICA8L1RhYnNDb250ZXh0LlByb3ZpZGVyPlxuICApO1xufTtcblxuZXhwb3J0IGNvbnN0IFRhYnNMaXN0OiBDb21wb25lbnQ8VGFic0xpc3RQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IFxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAnaW5saW5lLWZsZXggaC0xMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1tZCBiZy1zdXJmYWNlIHAtMSB0ZXh0LXNlY29uZGFyeScsXG4gICAgICAgICd3LWZ1bGwnLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgPC9kaXY+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgVGFic1RyaWdnZXI6IENvbXBvbmVudDxUYWJzVHJpZ2dlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBjb250ZXh0ID0gdXNlQ29udGV4dChUYWJzQ29udGV4dCk7XG4gIGlmICghY29udGV4dCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1tUYWJzVHJpZ2dlcl0gTm8gVGFic0NvbnRleHQgZm91bmQuIFRhYnNUcmlnZ2VyIG11c3QgYmUgdXNlZCB3aXRoaW4gVGFicyBjb21wb25lbnQuJyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgXG4gIGNvbnN0IGlzQWN0aXZlID0gKCkgPT4gY29udGV4dC5hY3RpdmVUYWIoKSA9PT0gcHJvcHMudmFsdWU7XG5cbiAgcmV0dXJuIChcbiAgICA8YnV0dG9uXG4gICAgICBvbkNsaWNrPXsoKSA9PiBjb250ZXh0LnNldEFjdGl2ZVRhYihwcm9wcy52YWx1ZSl9XG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgd2hpdGVzcGFjZS1ub3dyYXAgcm91bmRlZC1zbSBweC0zIHB5LTEuNScsXG4gICAgICAgICd0ZXh0LXNtIGZvbnQtbWVkaXVtIHJpbmctb2Zmc2V0LWJhc2UgdHJhbnNpdGlvbi1hbGwnLFxuICAgICAgICAnZm9jdXMtdmlzaWJsZTpvdXRsaW5lLW5vbmUgZm9jdXMtdmlzaWJsZTpyaW5nLTIgZm9jdXMtdmlzaWJsZTpyaW5nLXB1cnBsZS01MDAgZm9jdXMtdmlzaWJsZTpyaW5nLW9mZnNldC0yJyxcbiAgICAgICAgJ2Rpc2FibGVkOnBvaW50ZXItZXZlbnRzLW5vbmUgZGlzYWJsZWQ6b3BhY2l0eS01MCcsXG4gICAgICAgICdmbGV4LTEnLFxuICAgICAgICBpc0FjdGl2ZSgpXG4gICAgICAgICAgPyAnYmctYmFzZSB0ZXh0LXByaW1hcnkgc2hhZG93LXNtJ1xuICAgICAgICAgIDogJ3RleHQtc2Vjb25kYXJ5IGhvdmVyOnRleHQtcHJpbWFyeScsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICA8L2J1dHRvbj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBUYWJzQ29udGVudDogQ29tcG9uZW50PFRhYnNDb250ZW50UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IGNvbnRleHQgPSB1c2VDb250ZXh0KFRhYnNDb250ZXh0KTtcbiAgaWYgKCFjb250ZXh0KSB7XG4gICAgY29uc29sZS5lcnJvcignW1RhYnNDb250ZW50XSBObyBUYWJzQ29udGV4dCBmb3VuZC4gVGFic0NvbnRlbnQgbXVzdCBiZSB1c2VkIHdpdGhpbiBUYWJzIGNvbXBvbmVudC4nKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBcbiAgY29uc3QgaXNBY3RpdmUgPSAoKSA9PiBjb250ZXh0LmFjdGl2ZVRhYigpID09PSBwcm9wcy52YWx1ZTtcbiAgXG4gIHJldHVybiAoXG4gICAgPFNob3cgd2hlbj17aXNBY3RpdmUoKX0+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnbXQtMiByaW5nLW9mZnNldC1iYXNlJyxcbiAgICAgICAgICAnZm9jdXMtdmlzaWJsZTpvdXRsaW5lLW5vbmUgZm9jdXMtdmlzaWJsZTpyaW5nLTIgZm9jdXMtdmlzaWJsZTpyaW5nLXB1cnBsZS01MDAgZm9jdXMtdmlzaWJsZTpyaW5nLW9mZnNldC0yJyxcbiAgICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgICApfVxuICAgICAgPlxuICAgICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgICA8L2Rpdj5cbiAgICA8L1Nob3c+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCwgY3JlYXRlRWZmZWN0LCBTaG93LCBvbkNsZWFudXAgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuaW1wb3J0IHN0eWxlcyBmcm9tICcuL0ZpcmVFbW9qaUFuaW1hdGlvbi5tb2R1bGUuY3NzJztcblxuZXhwb3J0IGludGVyZmFjZSBGaXJlRW1vamlBbmltYXRpb25Qcm9wcyB7XG4gIHNjb3JlOiBudW1iZXI7XG4gIGxpbmVJbmRleDogbnVtYmVyOyAvLyBVc2UgbGluZSBpbmRleCBpbnN0ZWFkIG9mIHRyaWdnZXJcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBGaXJlRW1vamlBbmltYXRpb246IENvbXBvbmVudDxGaXJlRW1vamlBbmltYXRpb25Qcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW3Nob3dGaXJlLCBzZXRTaG93RmlyZV0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbZmlyZVgsIHNldEZpcmVYXSA9IGNyZWF0ZVNpZ25hbCg1MCk7XG4gIGxldCBsYXN0TGluZUluZGV4ID0gLTE7XG4gIGxldCBoaWRlVGltZXI6IG51bWJlciB8IHVuZGVmaW5lZDtcbiAgXG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgLy8gQ2hlY2sgaWYgd2UgaGF2ZSBhIG5ldyBsaW5lIHdpdGggaGlnaCBzY29yZVxuICAgIGlmIChwcm9wcy5saW5lSW5kZXggPiBsYXN0TGluZUluZGV4ICYmIHByb3BzLnNjb3JlID49IDgwKSB7XG4gICAgICAvLyBSYW5kb20gWCBwb3NpdGlvbiBiZXR3ZWVuIDIwJSBhbmQgODAlXG4gICAgICBzZXRGaXJlWCgyMCArIE1hdGgucmFuZG9tKCkgKiA2MCk7XG4gICAgICBzZXRTaG93RmlyZSh0cnVlKTtcbiAgICAgIFxuICAgICAgLy8gQ2xlYXIgZXhpc3RpbmcgdGltZXJcbiAgICAgIGlmIChoaWRlVGltZXIpIGNsZWFyVGltZW91dChoaWRlVGltZXIpO1xuICAgICAgXG4gICAgICAvLyBIaWRlIGFmdGVyIGFuaW1hdGlvbiBjb21wbGV0ZXNcbiAgICAgIGhpZGVUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBzZXRTaG93RmlyZShmYWxzZSk7XG4gICAgICB9LCAyMDAwKTtcbiAgICAgIFxuICAgICAgbGFzdExpbmVJbmRleCA9IHByb3BzLmxpbmVJbmRleDtcbiAgICB9XG4gIH0pO1xuICBcbiAgb25DbGVhbnVwKCgpID0+IHtcbiAgICBpZiAoaGlkZVRpbWVyKSBjbGVhclRpbWVvdXQoaGlkZVRpbWVyKTtcbiAgfSk7XG5cbiAgcmV0dXJuIChcbiAgICA8U2hvdyB3aGVuPXtzaG93RmlyZSgpfT5cbiAgICAgIDxkaXYgY2xhc3M9e2NuKHN0eWxlcy5maXJlQ29udGFpbmVyLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgY2xhc3M9e3N0eWxlcy5maXJlRW1vaml9XG4gICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgIGxlZnQ6IGAke2ZpcmVYKCl9JWAsXG4gICAgICAgICAgICAnZm9udC1zaXplJzogJzMycHgnXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIPCflKVcbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L1Nob3c+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3csIHR5cGUgQ29tcG9uZW50LCBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuaW1wb3J0IHsgU2NvcmVQYW5lbCB9IGZyb20gJy4uLy4uL2Rpc3BsYXkvU2NvcmVQYW5lbCc7XG5pbXBvcnQgeyBMeXJpY3NEaXNwbGF5LCB0eXBlIEx5cmljTGluZSB9IGZyb20gJy4uL0x5cmljc0Rpc3BsYXknO1xuaW1wb3J0IHsgTGVhZGVyYm9hcmRQYW5lbCwgdHlwZSBMZWFkZXJib2FyZEVudHJ5IH0gZnJvbSAnLi4vTGVhZGVyYm9hcmRQYW5lbCc7XG5pbXBvcnQgeyBTcGxpdEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5pbXBvcnQgdHlwZSB7IFBsYXliYWNrU3BlZWQgfSBmcm9tICcuLi8uLi9jb21tb24vU3BsaXRCdXR0b24nO1xuaW1wb3J0IHsgVGFicywgVGFic0xpc3QsIFRhYnNUcmlnZ2VyLCBUYWJzQ29udGVudCB9IGZyb20gJy4uLy4uL2NvbW1vbi9UYWJzJztcbmltcG9ydCB7IEZpcmVFbW9qaUFuaW1hdGlvbiB9IGZyb20gJy4uLy4uL2VmZmVjdHMvRmlyZUVtb2ppQW5pbWF0aW9uJztcblxuZXhwb3J0IGludGVyZmFjZSBFeHRlbnNpb25LYXJhb2tlVmlld1Byb3BzIHtcbiAgLy8gU2NvcmVzXG4gIHNjb3JlOiBudW1iZXI7XG4gIHJhbms6IG51bWJlcjtcbiAgXG4gIC8vIEx5cmljc1xuICBseXJpY3M6IEx5cmljTGluZVtdO1xuICBjdXJyZW50VGltZT86IG51bWJlcjtcbiAgXG4gIC8vIExlYWRlcmJvYXJkXG4gIGxlYWRlcmJvYXJkOiBMZWFkZXJib2FyZEVudHJ5W107XG4gIFxuICAvLyBTdGF0ZVxuICBpc1BsYXlpbmc/OiBib29sZWFuO1xuICBpc1JlY29yZGluZz86IGJvb2xlYW47XG4gIG9uU3RhcnQ/OiAoKSA9PiB2b2lkO1xuICBvblNwZWVkQ2hhbmdlPzogKHNwZWVkOiBQbGF5YmFja1NwZWVkKSA9PiB2b2lkO1xuICBcbiAgLy8gTGluZSBzY29yZXMgZm9yIHZpc3VhbCBmZWVkYmFja1xuICBsaW5lU2NvcmVzPzogQXJyYXk8eyBsaW5lSW5kZXg6IG51bWJlcjsgc2NvcmU6IG51bWJlcjsgdHJhbnNjcmlwdGlvbjogc3RyaW5nOyBmZWVkYmFjaz86IHN0cmluZyB9PjtcbiAgXG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgRXh0ZW5zaW9uS2FyYW9rZVZpZXc6IENvbXBvbmVudDxFeHRlbnNpb25LYXJhb2tlVmlld1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICAvLyBHZXQgdGhlIGxhdGVzdCBoaWdoIHNjb3JlIGxpbmUgaW5kZXhcbiAgY29uc3QgZ2V0TGF0ZXN0SGlnaFNjb3JlTGluZSA9ICgpID0+IHtcbiAgICBjb25zdCBzY29yZXMgPSBwcm9wcy5saW5lU2NvcmVzIHx8IFtdO1xuICAgIGlmIChzY29yZXMubGVuZ3RoID09PSAwKSByZXR1cm4geyBzY29yZTogMCwgbGluZUluZGV4OiAtMSB9O1xuICAgIFxuICAgIGNvbnN0IGxhdGVzdCA9IHNjb3Jlc1tzY29yZXMubGVuZ3RoIC0gMV07XG4gICAgcmV0dXJuIHtcbiAgICAgIHNjb3JlOiBsYXRlc3Q/LnNjb3JlIHx8IDAsXG4gICAgICBsaW5lSW5kZXg6IGxhdGVzdD8ubGluZUluZGV4IHx8IC0xXG4gICAgfTtcbiAgfTtcbiAgXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgaC1mdWxsIGJnLWJhc2UgcmVsYXRpdmUnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgey8qIFNjb3JlIFBhbmVsIC0gb25seSBzaG93IHdoZW4gbm90IHBsYXlpbmcgKi99XG4gICAgICA8U2hvdyB3aGVuPXshcHJvcHMuaXNQbGF5aW5nfT5cbiAgICAgICAgPFNjb3JlUGFuZWxcbiAgICAgICAgICBzY29yZT17cHJvcHMuc2NvcmV9XG4gICAgICAgICAgcmFuaz17cHJvcHMucmFua31cbiAgICAgICAgLz5cbiAgICAgIDwvU2hvdz5cblxuICAgICAgey8qIFNob3cgdGFicyBvbmx5IHdoZW4gbm90IHBsYXlpbmcgKi99XG4gICAgICA8U2hvdyB3aGVuPXshcHJvcHMuaXNQbGF5aW5nfSBmYWxsYmFjaz17XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgZmxleCBmbGV4LWNvbCBtaW4taC0wXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBtaW4taC0wIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgPEx5cmljc0Rpc3BsYXlcbiAgICAgICAgICAgICAgbHlyaWNzPXtwcm9wcy5seXJpY3N9XG4gICAgICAgICAgICAgIGN1cnJlbnRUaW1lPXtwcm9wcy5jdXJyZW50VGltZX1cbiAgICAgICAgICAgICAgaXNQbGF5aW5nPXtwcm9wcy5pc1BsYXlpbmd9XG4gICAgICAgICAgICAgIGxpbmVTY29yZXM9e3Byb3BzLmxpbmVTY29yZXN9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIH0+XG4gICAgICAgIHsvKiBUYWJzIGFuZCBjb250ZW50ICovfVxuICAgICAgICA8VGFicyBcbiAgICAgICAgICB0YWJzPXtbXG4gICAgICAgICAgICB7IGlkOiAnbHlyaWNzJywgbGFiZWw6ICdMeXJpY3MnIH0sXG4gICAgICAgICAgICB7IGlkOiAnbGVhZGVyYm9hcmQnLCBsYWJlbDogJ0xlYWRlcmJvYXJkJyB9XG4gICAgICAgICAgXX1cbiAgICAgICAgICBkZWZhdWx0VGFiPVwibHlyaWNzXCJcbiAgICAgICAgICBjbGFzcz1cImZsZXgtMSBmbGV4IGZsZXgtY29sIG1pbi1oLTBcIlxuICAgICAgICA+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInB4LTRcIj5cbiAgICAgICAgICAgIDxUYWJzTGlzdD5cbiAgICAgICAgICAgICAgPFRhYnNUcmlnZ2VyIHZhbHVlPVwibHlyaWNzXCI+THlyaWNzPC9UYWJzVHJpZ2dlcj5cbiAgICAgICAgICAgICAgPFRhYnNUcmlnZ2VyIHZhbHVlPVwibGVhZGVyYm9hcmRcIj5MZWFkZXJib2FyZDwvVGFic1RyaWdnZXI+XG4gICAgICAgICAgICA8L1RhYnNMaXN0PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIFxuICAgICAgICAgIDxUYWJzQ29udGVudCB2YWx1ZT1cImx5cmljc1wiIGNsYXNzPVwiZmxleC0xIG1pbi1oLTBcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGZsZXgtY29sIGgtZnVsbFwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIG1pbi1oLTAgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICAgICAgPEx5cmljc0Rpc3BsYXlcbiAgICAgICAgICAgICAgICAgIGx5cmljcz17cHJvcHMubHlyaWNzfVxuICAgICAgICAgICAgICAgICAgY3VycmVudFRpbWU9e3Byb3BzLmN1cnJlbnRUaW1lfVxuICAgICAgICAgICAgICAgICAgaXNQbGF5aW5nPXtwcm9wcy5pc1BsYXlpbmd9XG4gICAgICAgICAgICAgICAgICBsaW5lU2NvcmVzPXtwcm9wcy5saW5lU2NvcmVzfVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgey8qIEZvb3RlciB3aXRoIHN0YXJ0IGJ1dHRvbiAqL31cbiAgICAgICAgICAgICAgPFNob3cgd2hlbj17IXByb3BzLmlzUGxheWluZyAmJiBwcm9wcy5vblN0YXJ0fT5cbiAgICAgICAgICAgICAgICA8ZGl2IFxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJwLTQgYmctc3VyZmFjZSBib3JkZXItdCBib3JkZXItc3VidGxlXCJcbiAgICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICAgICdmbGV4LXNocmluayc6ICcwJ1xuICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8U3BsaXRCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgb25TdGFydD17cHJvcHMub25TdGFydH1cbiAgICAgICAgICAgICAgICAgICAgb25TcGVlZENoYW5nZT17cHJvcHMub25TcGVlZENoYW5nZX1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvVGFic0NvbnRlbnQ+XG4gICAgICAgICAgXG4gICAgICAgICAgPFRhYnNDb250ZW50IHZhbHVlPVwibGVhZGVyYm9hcmRcIiBjbGFzcz1cImZsZXgtMSBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJvdmVyZmxvdy15LWF1dG8gaC1mdWxsXCI+XG4gICAgICAgICAgICAgIDxMZWFkZXJib2FyZFBhbmVsIGVudHJpZXM9e3Byb3BzLmxlYWRlcmJvYXJkfSAvPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9UYWJzQ29udGVudD5cbiAgICAgICAgPC9UYWJzPlxuICAgICAgPC9TaG93PlxuICAgICAgXG4gICAgICB7LyogRmlyZSBlbW9qaSBlZmZlY3QgKi99XG4gICAgICA8U2hvdyB3aGVuPXtwcm9wcy5pc1BsYXlpbmd9PlxuICAgICAgICA8RmlyZUVtb2ppQW5pbWF0aW9uIFxuICAgICAgICAgIHNjb3JlPXtnZXRMYXRlc3RIaWdoU2NvcmVMaW5lKCkuc2NvcmV9IFxuICAgICAgICAgIGxpbmVJbmRleD17Z2V0TGF0ZXN0SGlnaFNjb3JlTGluZSgpLmxpbmVJbmRleH1cbiAgICAgICAgLz5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlQ29udGV4dCwgdXNlQ29udGV4dCwgY3JlYXRlU2lnbmFsLCBjcmVhdGVFZmZlY3QsIGNyZWF0ZU1lbW8gfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IFBhcmVudENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgVHJhbnNsYXRpb25zLCBMb2NhbGVDb2RlIH0gZnJvbSAnLi90eXBlcyc7XG5cbmludGVyZmFjZSBJMThuQ29udGV4dFZhbHVlIHtcbiAgbG9jYWxlOiAoKSA9PiBMb2NhbGVDb2RlO1xuICBzZXRMb2NhbGU6IChsb2NhbGU6IExvY2FsZUNvZGUpID0+IHZvaWQ7XG4gIHQ6IChrZXk6IHN0cmluZywgcGFyYW1zPzogUmVjb3JkPHN0cmluZywgYW55PikgPT4gc3RyaW5nO1xuICBkaXI6ICgpID0+ICdsdHInIHwgJ3J0bCc7XG4gIGZvcm1hdE51bWJlcjogKG51bTogbnVtYmVyKSA9PiBzdHJpbmc7XG4gIGZvcm1hdERhdGU6IChkYXRlOiBEYXRlLCBvcHRpb25zPzogSW50bC5EYXRlVGltZUZvcm1hdE9wdGlvbnMpID0+IHN0cmluZztcbn1cblxuY29uc3QgSTE4bkNvbnRleHQgPSBjcmVhdGVDb250ZXh0PEkxOG5Db250ZXh0VmFsdWU+KCk7XG5cbmV4cG9ydCBjb25zdCBJMThuUHJvdmlkZXI6IFBhcmVudENvbXBvbmVudDx7IGRlZmF1bHRMb2NhbGU/OiBMb2NhbGVDb2RlIH0+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtsb2NhbGUsIHNldExvY2FsZV0gPSBjcmVhdGVTaWduYWw8TG9jYWxlQ29kZT4ocHJvcHMuZGVmYXVsdExvY2FsZSB8fCAnZW4nKTtcbiAgY29uc3QgW3RyYW5zbGF0aW9ucywgc2V0VHJhbnNsYXRpb25zXSA9IGNyZWF0ZVNpZ25hbDxUcmFuc2xhdGlvbnM+KCk7XG4gIFxuICAvLyBMb2FkIHRyYW5zbGF0aW9ucyBkeW5hbWljYWxseVxuICBjcmVhdGVFZmZlY3QoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IGN1cnJlbnRMb2NhbGUgPSBsb2NhbGUoKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgbW9kdWxlID0gYXdhaXQgaW1wb3J0KGAuL2xvY2FsZXMvJHtjdXJyZW50TG9jYWxlfS9pbmRleC50c2ApO1xuICAgICAgc2V0VHJhbnNsYXRpb25zKG1vZHVsZS5kZWZhdWx0KTtcbiAgICB9IGNhdGNoIChfZSkge1xuICAgICAgY29uc29sZS53YXJuKGBGYWlsZWQgdG8gbG9hZCBsb2NhbGUgJHtjdXJyZW50TG9jYWxlfSwgZmFsbGluZyBiYWNrIHRvIEVuZ2xpc2hgKTtcbiAgICAgIGNvbnN0IG1vZHVsZSA9IGF3YWl0IGltcG9ydCgnLi9sb2NhbGVzL2VuL2luZGV4LnRzJyk7XG4gICAgICBzZXRUcmFuc2xhdGlvbnMobW9kdWxlLmRlZmF1bHQpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gRGVlcCBrZXkgYWNjZXNzIHdpdGggZG90IG5vdGF0aW9uXG4gIGNvbnN0IHQgPSAoa2V5OiBzdHJpbmcsIHBhcmFtcz86IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IHtcbiAgICBjb25zdCBrZXlzID0ga2V5LnNwbGl0KCcuJyk7XG4gICAgbGV0IHZhbHVlOiBhbnkgPSB0cmFuc2xhdGlvbnMoKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGsgb2Yga2V5cykge1xuICAgICAgdmFsdWUgPSB2YWx1ZT8uW2tdO1xuICAgIH1cbiAgICBcbiAgICAvLyBIYW5kbGUgcGFyYW1ldGVyIHJlcGxhY2VtZW50XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgcGFyYW1zKSB7XG4gICAgICByZXR1cm4gdmFsdWUucmVwbGFjZSgvXFx7XFx7KFxcdyspXFx9XFx9L2csIChfLCBrKSA9PiBTdHJpbmcocGFyYW1zW2tdIHx8ICcnKSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB2YWx1ZSB8fCBrZXk7XG4gIH07XG5cbiAgLy8gRGlyZWN0aW9uIChmb3IgUlRMIGxhbmd1YWdlcyBpbiBmdXR1cmUpXG4gIGNvbnN0IGRpciA9ICgpOiAnbHRyJyB8ICdydGwnID0+ICdsdHInOyAvLyBPbmx5IExUUiBsYW5ndWFnZXMgc3VwcG9ydGVkIGN1cnJlbnRseVxuXG4gIC8vIE51bWJlciBmb3JtYXR0aW5nXG4gIGNvbnN0IG51bWJlckZvcm1hdHRlciA9IGNyZWF0ZU1lbW8oKCkgPT4gXG4gICAgbmV3IEludGwuTnVtYmVyRm9ybWF0KGxvY2FsZSgpKVxuICApO1xuXG4gIGNvbnN0IGZvcm1hdE51bWJlciA9IChudW06IG51bWJlcikgPT4gbnVtYmVyRm9ybWF0dGVyKCkuZm9ybWF0KG51bSk7XG5cbiAgLy8gRGF0ZSBmb3JtYXR0aW5nXG4gIGNvbnN0IGZvcm1hdERhdGUgPSAoZGF0ZTogRGF0ZSwgb3B0aW9ucz86IEludGwuRGF0ZVRpbWVGb3JtYXRPcHRpb25zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBJbnRsLkRhdGVUaW1lRm9ybWF0KGxvY2FsZSgpLCBvcHRpb25zKS5mb3JtYXQoZGF0ZSk7XG4gIH07XG5cbiAgY29uc3QgdmFsdWU6IEkxOG5Db250ZXh0VmFsdWUgPSB7XG4gICAgbG9jYWxlLFxuICAgIHNldExvY2FsZSxcbiAgICB0LFxuICAgIGRpcixcbiAgICBmb3JtYXROdW1iZXIsXG4gICAgZm9ybWF0RGF0ZSxcbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxJMThuQ29udGV4dC5Qcm92aWRlciB2YWx1ZT17dmFsdWV9PlxuICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgIDwvSTE4bkNvbnRleHQuUHJvdmlkZXI+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgdXNlSTE4biA9ICgpID0+IHtcbiAgY29uc3QgY29udGV4dCA9IHVzZUNvbnRleHQoSTE4bkNvbnRleHQpO1xuICBpZiAoIWNvbnRleHQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3VzZUkxOG4gbXVzdCBiZSB1c2VkIHdpdGhpbiBJMThuUHJvdmlkZXInKTtcbiAgfVxuICByZXR1cm4gY29udGV4dDtcbn07IiwiaW1wb3J0IHsgU2hvdywgY3JlYXRlTWVtbyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5pbXBvcnQgdHlwZSB7IFBsYXliYWNrU3BlZWQgfSBmcm9tICcuLi8uLi9jb21tb24vU3BsaXRCdXR0b24nO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL0J1dHRvbic7XG5pbXBvcnQgeyB1c2VJMThuIH0gZnJvbSAnLi4vLi4vLi4vaTE4bic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGxldGlvblZpZXdQcm9wcyB7XG4gIHNjb3JlOiBudW1iZXI7XG4gIHJhbms6IG51bWJlcjtcbiAgc3BlZWQ6IFBsYXliYWNrU3BlZWQ7XG4gIGZlZWRiYWNrVGV4dD86IHN0cmluZztcbiAgb25QcmFjdGljZT86ICgpID0+IHZvaWQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgQ29tcGxldGlvblZpZXc6IENvbXBvbmVudDxDb21wbGV0aW9uVmlld1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCB7IHQsIGZvcm1hdE51bWJlciB9ID0gdXNlSTE4bigpO1xuICBcbiAgLy8gR2V0IGZlZWRiYWNrIHRleHQgYmFzZWQgb24gc2NvcmVcbiAgY29uc3QgZ2V0RmVlZGJhY2tUZXh0ID0gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgaWYgKHByb3BzLmZlZWRiYWNrVGV4dCkgcmV0dXJuIHByb3BzLmZlZWRiYWNrVGV4dDtcbiAgICBcbiAgICBpZiAocHJvcHMuc2NvcmUgPj0gOTUpIHJldHVybiB0KCdrYXJhb2tlLnNjb3JpbmcucGVyZmVjdCcpO1xuICAgIGlmIChwcm9wcy5zY29yZSA+PSA4NSkgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5leGNlbGxlbnQnKTtcbiAgICBpZiAocHJvcHMuc2NvcmUgPj0gNzApIHJldHVybiB0KCdrYXJhb2tlLnNjb3JpbmcuZ3JlYXQnKTtcbiAgICBpZiAocHJvcHMuc2NvcmUgPj0gNTApIHJldHVybiB0KCdrYXJhb2tlLnNjb3JpbmcuZ29vZCcpO1xuICAgIHJldHVybiB0KCdrYXJhb2tlLnNjb3Jpbmcua2VlcFByYWN0aWNpbmcnKTtcbiAgfSk7XG4gIFxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sIGgtZnVsbCBiZy1iYXNlJywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBNYWluIGNvbnRlbnQgYXJlYSAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcC02XCI+XG4gICAgICAgIHsvKiBTY29yZSAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIGZsZXggZmxleC1jb2wgbWItMTBcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0zIG9yZGVyLTFcIj57dCgna2FyYW9rZS5zY29yaW5nLnNjb3JlJyl9PC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtN3hsIGZvbnQtbW9ubyBmb250LWJvbGQgdGV4dC1hY2NlbnQtcHJpbWFyeSBvcmRlci0yXCI+XG4gICAgICAgICAgICB7Zm9ybWF0TnVtYmVyKHByb3BzLnNjb3JlKX1cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIFxuICAgICAgICB7LyogU3RhdHMgcm93ICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBnYXAtMTIgbWItMTJcIj5cbiAgICAgICAgICB7LyogUmFuayAqL31cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgZmxleCBmbGV4LWNvbFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtbGcgdGV4dC1zZWNvbmRhcnkgbWItMiBvcmRlci0xXCI+UmFuazwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtM3hsIGZvbnQtYm9sZCB0ZXh0LXByaW1hcnkgb3JkZXItMlwiPiN7Zm9ybWF0TnVtYmVyKHByb3BzLnJhbmspfTwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIFxuICAgICAgICAgIHsvKiBTcGVlZCAqL31cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgZmxleCBmbGV4LWNvbFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtbGcgdGV4dC1zZWNvbmRhcnkgbWItMiBvcmRlci0xXCI+e3QoJ2NvbW1vbi5zcGVlZC5sYWJlbCcpfTwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtM3hsIGZvbnQtYm9sZCB0ZXh0LXByaW1hcnkgb3JkZXItMlwiPntwcm9wcy5zcGVlZH08L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIFxuICAgICAgICB7LyogRmVlZGJhY2sgdGV4dCAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cIm1heC13LW1kIHRleHQtY2VudGVyXCI+XG4gICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXhsIHRleHQtcHJpbWFyeSBsZWFkaW5nLXJlbGF4ZWRcIj5cbiAgICAgICAgICAgIHtnZXRGZWVkYmFja1RleHQoKX1cbiAgICAgICAgICA8L3A+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICBcbiAgICAgIHsvKiBGb290ZXIgd2l0aCBwcmFjdGljZSBidXR0b24gLSBwb3NpdGlvbmVkIGF0IGJvdHRvbSBvZiB3aWRnZXQgKi99XG4gICAgICA8U2hvdyB3aGVuPXtwcm9wcy5vblByYWN0aWNlfT5cbiAgICAgICAgPGRpdiBjbGFzcz1cInAtNCBiZy1zdXJmYWNlIGJvcmRlci10IGJvcmRlci1zdWJ0bGVcIj5cbiAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgZnVsbFdpZHRoXG4gICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblByYWN0aWNlfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIFByYWN0aWNlIEVycm9yc1xuICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsLCBvbkNsZWFudXAgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IEF1ZGlvUHJvY2Vzc29yT3B0aW9ucyB9IGZyb20gJ0BzY2FybGV0dC9jb3JlJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUthcmFva2VBdWRpb1Byb2Nlc3NvcihvcHRpb25zPzogQXVkaW9Qcm9jZXNzb3JPcHRpb25zKSB7XG4gIGNvbnN0IFthdWRpb0NvbnRleHQsIHNldEF1ZGlvQ29udGV4dF0gPSBjcmVhdGVTaWduYWw8QXVkaW9Db250ZXh0IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFttZWRpYVN0cmVhbSwgc2V0TWVkaWFTdHJlYW1dID0gY3JlYXRlU2lnbmFsPE1lZGlhU3RyZWFtIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFssIHNldEF1ZGlvV29ya2xldE5vZGVdID0gY3JlYXRlU2lnbmFsPEF1ZGlvV29ya2xldE5vZGUgfCBudWxsPihudWxsKTtcbiAgXG4gIGNvbnN0IFtpc1JlYWR5LCBzZXRJc1JlYWR5XSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtlcnJvciwgc2V0RXJyb3JdID0gY3JlYXRlU2lnbmFsPEVycm9yIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtpc0xpc3RlbmluZywgc2V0SXNMaXN0ZW5pbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgXG4gIGNvbnN0IFtjdXJyZW50UmVjb3JkaW5nTGluZSwgc2V0Q3VycmVudFJlY29yZGluZ0xpbmVdID0gY3JlYXRlU2lnbmFsPG51bWJlciB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbcmVjb3JkZWRBdWRpb0J1ZmZlciwgc2V0UmVjb3JkZWRBdWRpb0J1ZmZlcl0gPSBjcmVhdGVTaWduYWw8RmxvYXQzMkFycmF5W10+KFtdKTtcbiAgXG4gIGNvbnN0IFtpc1Nlc3Npb25BY3RpdmUsIHNldElzU2Vzc2lvbkFjdGl2ZV0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbZnVsbFNlc3Npb25CdWZmZXIsIHNldEZ1bGxTZXNzaW9uQnVmZmVyXSA9IGNyZWF0ZVNpZ25hbDxGbG9hdDMyQXJyYXlbXT4oW10pO1xuICBcbiAgY29uc3Qgc2FtcGxlUmF0ZSA9IG9wdGlvbnM/LnNhbXBsZVJhdGUgfHwgMTYwMDA7XG4gIFxuICBjb25zdCBpbml0aWFsaXplID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmIChhdWRpb0NvbnRleHQoKSkgcmV0dXJuO1xuICAgIHNldEVycm9yKG51bGwpO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBcbiAgICAgIGNvbnN0IGN0eCA9IG5ldyBBdWRpb0NvbnRleHQoeyBzYW1wbGVSYXRlIH0pO1xuICAgICAgc2V0QXVkaW9Db250ZXh0KGN0eCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHN0cmVhbSA9IGF3YWl0IG5hdmlnYXRvci5tZWRpYURldmljZXMuZ2V0VXNlck1lZGlhKHtcbiAgICAgICAgYXVkaW86IHtcbiAgICAgICAgICBzYW1wbGVSYXRlLFxuICAgICAgICAgIGNoYW5uZWxDb3VudDogMSxcbiAgICAgICAgICBlY2hvQ2FuY2VsbGF0aW9uOiBmYWxzZSxcbiAgICAgICAgICBub2lzZVN1cHByZXNzaW9uOiBmYWxzZSxcbiAgICAgICAgICBhdXRvR2FpbkNvbnRyb2w6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBzZXRNZWRpYVN0cmVhbShzdHJlYW0pO1xuICAgICAgXG4gICAgICBhd2FpdCBjdHguYXVkaW9Xb3JrbGV0LmFkZE1vZHVsZShjcmVhdGVBdWRpb1dvcmtsZXRQcm9jZXNzb3IoKSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHdvcmtsZXROb2RlID0gbmV3IEF1ZGlvV29ya2xldE5vZGUoY3R4LCAna2FyYW9rZS1hdWRpby1wcm9jZXNzb3InLCB7XG4gICAgICAgIG51bWJlck9mSW5wdXRzOiAxLFxuICAgICAgICBudW1iZXJPZk91dHB1dHM6IDAsXG4gICAgICAgIGNoYW5uZWxDb3VudDogMSxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICB3b3JrbGV0Tm9kZS5wb3J0Lm9ubWVzc2FnZSA9IChldmVudCkgPT4ge1xuICAgICAgICBpZiAoZXZlbnQuZGF0YS50eXBlID09PSAnYXVkaW9EYXRhJykge1xuICAgICAgICAgIGNvbnN0IGF1ZGlvRGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoZXZlbnQuZGF0YS5hdWRpb0RhdGEpO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChjdXJyZW50UmVjb3JkaW5nTGluZSgpICE9PSBudWxsKSB7XG4gICAgICAgICAgICBzZXRSZWNvcmRlZEF1ZGlvQnVmZmVyKChwcmV2KSA9PiBbLi4ucHJldiwgYXVkaW9EYXRhXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGlmIChpc1Nlc3Npb25BY3RpdmUoKSkge1xuICAgICAgICAgICAgc2V0RnVsbFNlc3Npb25CdWZmZXIoKHByZXYpID0+IFsuLi5wcmV2LCBhdWRpb0RhdGFdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBcbiAgICAgIHNldEF1ZGlvV29ya2xldE5vZGUod29ya2xldE5vZGUpO1xuICAgICAgXG4gICAgICBjb25zdCBzb3VyY2UgPSBjdHguY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2Uoc3RyZWFtKTtcbiAgICAgIGNvbnN0IGdhaW5Ob2RlID0gY3R4LmNyZWF0ZUdhaW4oKTtcbiAgICAgIGdhaW5Ob2RlLmdhaW4udmFsdWUgPSAxLjI7XG4gICAgICBcbiAgICAgIHNvdXJjZS5jb25uZWN0KGdhaW5Ob2RlKTtcbiAgICAgIGdhaW5Ob2RlLmNvbm5lY3Qod29ya2xldE5vZGUpO1xuICAgICAgXG4gICAgICBzZXRJc1JlYWR5KHRydWUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIEZhaWxlZCB0byBpbml0aWFsaXplOicsIGUpO1xuICAgICAgc2V0RXJyb3IoZSBpbnN0YW5jZW9mIEVycm9yID8gZSA6IG5ldyBFcnJvcignVW5rbm93biBhdWRpbyBpbml0aWFsaXphdGlvbiBlcnJvcicpKTtcbiAgICAgIHNldElzUmVhZHkoZmFsc2UpO1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGNyZWF0ZUF1ZGlvV29ya2xldFByb2Nlc3NvciA9ICgpID0+IHtcbiAgICBjb25zdCBwcm9jZXNzb3JDb2RlID0gYFxuICAgICAgY2xhc3MgS2FyYW9rZUF1ZGlvUHJvY2Vzc29yIGV4dGVuZHMgQXVkaW9Xb3JrbGV0UHJvY2Vzc29yIHtcbiAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgICB0aGlzLmJ1ZmZlclNpemUgPSAxMDI0O1xuICAgICAgICAgIHRoaXMucm1zSGlzdG9yeSA9IFtdO1xuICAgICAgICAgIHRoaXMubWF4SGlzdG9yeUxlbmd0aCA9IDEwO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvY2VzcyhpbnB1dHMsIG91dHB1dHMsIHBhcmFtZXRlcnMpIHtcbiAgICAgICAgICBjb25zdCBpbnB1dCA9IGlucHV0c1swXTtcbiAgICAgICAgICBpZiAoaW5wdXQgJiYgaW5wdXRbMF0pIHtcbiAgICAgICAgICAgIGNvbnN0IGlucHV0RGF0YSA9IGlucHV0WzBdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgc3VtID0gMDtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXREYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIHN1bSArPSBpbnB1dERhdGFbaV0gKiBpbnB1dERhdGFbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBybXMgPSBNYXRoLnNxcnQoc3VtIC8gaW5wdXREYXRhLmxlbmd0aCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMucm1zSGlzdG9yeS5wdXNoKHJtcyk7XG4gICAgICAgICAgICBpZiAodGhpcy5ybXNIaXN0b3J5Lmxlbmd0aCA+IHRoaXMubWF4SGlzdG9yeUxlbmd0aCkge1xuICAgICAgICAgICAgICB0aGlzLnJtc0hpc3Rvcnkuc2hpZnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgYXZnUm1zID0gdGhpcy5ybXNIaXN0b3J5LnJlZHVjZSgoYSwgYikgPT4gYSArIGIsIDApIC8gdGhpcy5ybXNIaXN0b3J5Lmxlbmd0aDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5wb3J0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgICAgdHlwZTogJ2F1ZGlvRGF0YScsXG4gICAgICAgICAgICAgIGF1ZGlvRGF0YTogaW5wdXREYXRhLFxuICAgICAgICAgICAgICBybXNMZXZlbDogcm1zLFxuICAgICAgICAgICAgICBhdmdSbXNMZXZlbDogYXZnUm1zLFxuICAgICAgICAgICAgICBpc1Rvb1F1aWV0OiBhdmdSbXMgPCAwLjAxLFxuICAgICAgICAgICAgICBpc1Rvb0xvdWQ6IGF2Z1JtcyA+IDAuM1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZWdpc3RlclByb2Nlc3Nvcigna2FyYW9rZS1hdWRpby1wcm9jZXNzb3InLCBLYXJhb2tlQXVkaW9Qcm9jZXNzb3IpO1xuICAgIGA7XG4gICAgXG4gICAgY29uc3QgYmxvYiA9IG5ldyBCbG9iKFtwcm9jZXNzb3JDb2RlXSwgeyB0eXBlOiAnYXBwbGljYXRpb24vamF2YXNjcmlwdCcgfSk7XG4gICAgcmV0dXJuIFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG4gIH07XG4gIFxuICBjb25zdCBzdGFydExpc3RlbmluZyA9ICgpID0+IHtcbiAgICBjb25zdCBjdHggPSBhdWRpb0NvbnRleHQoKTtcbiAgICBpZiAoY3R4ICYmIGN0eC5zdGF0ZSA9PT0gJ3N1c3BlbmRlZCcpIHtcbiAgICAgIGN0eC5yZXN1bWUoKTtcbiAgICB9XG4gICAgc2V0SXNMaXN0ZW5pbmcodHJ1ZSk7XG4gIH07XG4gIFxuICBjb25zdCBwYXVzZUxpc3RlbmluZyA9ICgpID0+IHtcbiAgICBjb25zdCBjdHggPSBhdWRpb0NvbnRleHQoKTtcbiAgICBpZiAoY3R4ICYmIGN0eC5zdGF0ZSA9PT0gJ3J1bm5pbmcnKSB7XG4gICAgICBjdHguc3VzcGVuZCgpO1xuICAgIH1cbiAgICBzZXRJc0xpc3RlbmluZyhmYWxzZSk7XG4gIH07XG4gIFxuICBjb25zdCBjbGVhbnVwID0gKCkgPT4ge1xuICAgIFxuICAgIGNvbnN0IHN0cmVhbSA9IG1lZGlhU3RyZWFtKCk7XG4gICAgaWYgKHN0cmVhbSkge1xuICAgICAgc3RyZWFtLmdldFRyYWNrcygpLmZvckVhY2goKHRyYWNrKSA9PiB0cmFjay5zdG9wKCkpO1xuICAgICAgc2V0TWVkaWFTdHJlYW0obnVsbCk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGN0eCA9IGF1ZGlvQ29udGV4dCgpO1xuICAgIGlmIChjdHggJiYgY3R4LnN0YXRlICE9PSAnY2xvc2VkJykge1xuICAgICAgY3R4LmNsb3NlKCk7XG4gICAgICBzZXRBdWRpb0NvbnRleHQobnVsbCk7XG4gICAgfVxuICAgIFxuICAgIHNldEF1ZGlvV29ya2xldE5vZGUobnVsbCk7XG4gICAgc2V0SXNSZWFkeShmYWxzZSk7XG4gICAgc2V0SXNMaXN0ZW5pbmcoZmFsc2UpO1xuICB9O1xuICBcbiAgb25DbGVhbnVwKGNsZWFudXApO1xuICBcbiAgY29uc3Qgc3RhcnRSZWNvcmRpbmdMaW5lID0gKGxpbmVJbmRleDogbnVtYmVyKSA9PiB7XG4gICAgXG4gICAgc2V0Q3VycmVudFJlY29yZGluZ0xpbmUobGluZUluZGV4KTtcbiAgICBzZXRSZWNvcmRlZEF1ZGlvQnVmZmVyKFtdKTtcbiAgICBcbiAgICBpZiAoaXNSZWFkeSgpICYmICFpc0xpc3RlbmluZygpKSB7XG4gICAgICBzdGFydExpc3RlbmluZygpO1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IHN0b3BSZWNvcmRpbmdMaW5lQW5kR2V0UmF3QXVkaW8gPSAoKTogRmxvYXQzMkFycmF5W10gPT4ge1xuICAgIGNvbnN0IGxpbmVJbmRleCA9IGN1cnJlbnRSZWNvcmRpbmdMaW5lKCk7XG4gICAgaWYgKGxpbmVJbmRleCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBhdWRpb0J1ZmZlciA9IHJlY29yZGVkQXVkaW9CdWZmZXIoKTtcbiAgICBcbiAgICBzZXRDdXJyZW50UmVjb3JkaW5nTGluZShudWxsKTtcbiAgICBcbiAgICBjb25zdCByZXN1bHQgPSBbLi4uYXVkaW9CdWZmZXJdO1xuICAgIHNldFJlY29yZGVkQXVkaW9CdWZmZXIoW10pO1xuICAgIFxuICAgIGlmIChyZXN1bHQubGVuZ3RoID09PSAwKSB7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG4gIFxuICBjb25zdCBjb252ZXJ0QXVkaW9Ub1dhdkJsb2IgPSAoYXVkaW9DaHVua3M6IEZsb2F0MzJBcnJheVtdKTogQmxvYiB8IG51bGwgPT4ge1xuICAgIGlmIChhdWRpb0NodW5rcy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuICAgIFxuICAgIGNvbnN0IHRvdGFsTGVuZ3RoID0gYXVkaW9DaHVua3MucmVkdWNlKChzdW0sIGNodW5rKSA9PiBzdW0gKyBjaHVuay5sZW5ndGgsIDApO1xuICAgIGNvbnN0IGNvbmNhdGVuYXRlZCA9IG5ldyBGbG9hdDMyQXJyYXkodG90YWxMZW5ndGgpO1xuICAgIGxldCBvZmZzZXQgPSAwO1xuICAgIGZvciAoY29uc3QgY2h1bmsgb2YgYXVkaW9DaHVua3MpIHtcbiAgICAgIGNvbmNhdGVuYXRlZC5zZXQoY2h1bmssIG9mZnNldCk7XG4gICAgICBvZmZzZXQgKz0gY2h1bmsubGVuZ3RoO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gYXVkaW9CdWZmZXJUb1dhdihjb25jYXRlbmF0ZWQsIHNhbXBsZVJhdGUpO1xuICB9O1xuICBcbiAgY29uc3QgYXVkaW9CdWZmZXJUb1dhdiA9IChidWZmZXI6IEZsb2F0MzJBcnJheSwgc2FtcGxlUmF0ZTogbnVtYmVyKTogQmxvYiA9PiB7XG4gICAgY29uc3QgbGVuZ3RoID0gYnVmZmVyLmxlbmd0aDtcbiAgICBjb25zdCBhcnJheUJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig0NCArIGxlbmd0aCAqIDIpO1xuICAgIGNvbnN0IHZpZXcgPSBuZXcgRGF0YVZpZXcoYXJyYXlCdWZmZXIpO1xuICAgIFxuICAgIGNvbnN0IHdyaXRlU3RyaW5nID0gKG9mZnNldDogbnVtYmVyLCBzdHJpbmc6IHN0cmluZykgPT4ge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHJpbmcubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmlldy5zZXRVaW50OChvZmZzZXQgKyBpLCBzdHJpbmcuY2hhckNvZGVBdChpKSk7XG4gICAgICB9XG4gICAgfTtcbiAgICBcbiAgICB3cml0ZVN0cmluZygwLCAnUklGRicpO1xuICAgIHZpZXcuc2V0VWludDMyKDQsIDM2ICsgbGVuZ3RoICogMiwgdHJ1ZSk7XG4gICAgd3JpdGVTdHJpbmcoOCwgJ1dBVkUnKTtcbiAgICB3cml0ZVN0cmluZygxMiwgJ2ZtdCAnKTtcbiAgICB2aWV3LnNldFVpbnQzMigxNiwgMTYsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDIwLCAxLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigyMiwgMSwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MzIoMjQsIHNhbXBsZVJhdGUsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDMyKDI4LCBzYW1wbGVSYXRlICogMiwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMzIsIDIsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDM0LCAxNiwgdHJ1ZSk7XG4gICAgd3JpdGVTdHJpbmcoMzYsICdkYXRhJyk7XG4gICAgdmlldy5zZXRVaW50MzIoNDAsIGxlbmd0aCAqIDIsIHRydWUpO1xuICAgIFxuICAgIGNvbnN0IG9mZnNldCA9IDQ0O1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHNhbXBsZSA9IE1hdGgubWF4KC0xLCBNYXRoLm1pbigxLCBidWZmZXJbaV0gfHwgMCkpO1xuICAgICAgdmlldy5zZXRJbnQxNihvZmZzZXQgKyBpICogMiwgc2FtcGxlICogMHg3ZmZmLCB0cnVlKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG5ldyBCbG9iKFthcnJheUJ1ZmZlcl0sIHsgdHlwZTogJ2F1ZGlvL3dhdicgfSk7XG4gIH07XG4gIFxuICBjb25zdCBzdGFydEZ1bGxTZXNzaW9uID0gKCkgPT4ge1xuICAgIHNldEZ1bGxTZXNzaW9uQnVmZmVyKFtdKTtcbiAgICBzZXRJc1Nlc3Npb25BY3RpdmUodHJ1ZSk7XG4gIH07XG4gIFxuICBjb25zdCBzdG9wRnVsbFNlc3Npb25BbmRHZXRXYXYgPSAoKTogQmxvYiB8IG51bGwgPT4ge1xuICAgIHNldElzU2Vzc2lvbkFjdGl2ZShmYWxzZSk7XG4gICAgXG4gICAgY29uc3Qgc2Vzc2lvbkNodW5rcyA9IGZ1bGxTZXNzaW9uQnVmZmVyKCk7XG4gICAgY29uc3Qgd2F2QmxvYiA9IGNvbnZlcnRBdWRpb1RvV2F2QmxvYihzZXNzaW9uQ2h1bmtzKTtcbiAgICBcbiAgICBcbiAgICBzZXRGdWxsU2Vzc2lvbkJ1ZmZlcihbXSk7XG4gICAgXG4gICAgcmV0dXJuIHdhdkJsb2I7XG4gIH07XG4gIFxuICByZXR1cm4ge1xuICAgIGlzUmVhZHksXG4gICAgZXJyb3IsXG4gICAgaXNMaXN0ZW5pbmcsXG4gICAgaXNTZXNzaW9uQWN0aXZlLFxuICAgIFxuICAgIGluaXRpYWxpemUsXG4gICAgc3RhcnRMaXN0ZW5pbmcsXG4gICAgcGF1c2VMaXN0ZW5pbmcsXG4gICAgY2xlYW51cCxcbiAgICBzdGFydFJlY29yZGluZ0xpbmUsXG4gICAgc3RvcFJlY29yZGluZ0xpbmVBbmRHZXRSYXdBdWRpbyxcbiAgICBjb252ZXJ0QXVkaW9Ub1dhdkJsb2IsXG4gICAgXG4gICAgc3RhcnRGdWxsU2Vzc2lvbixcbiAgICBzdG9wRnVsbFNlc3Npb25BbmRHZXRXYXYsXG4gIH07XG59IiwiaW1wb3J0IHR5cGUge1xuICBBcGlSZXNwb25zZSxcbiAgU3RhcnRTZXNzaW9uUmVxdWVzdCxcbiAgR3JhZGVMaW5lUmVxdWVzdCxcbiAgQ29tcGxldGVTZXNzaW9uUmVxdWVzdCxcbiAgVHJhbnNjcmliZVJlcXVlc3QsXG4gIFRyYW5zY3JpYmVSZXNwb25zZSxcbiAgS2FyYW9rZURhdGEsXG4gIEthcmFva2VTZXNzaW9uLFxuICBMaW5lU2NvcmUsXG4gIFNlc3Npb25SZXN1bHRzLFxuICBEZW1vVG9rZW5SZXNwb25zZSxcbiAgVXNlckNyZWRpdHNSZXNwb25zZSxcbiAgUHVyY2hhc2VDcmVkaXRzUmVxdWVzdCxcbiAgUHVyY2hhc2VDcmVkaXRzUmVzcG9uc2UsXG4gIEV4ZXJjaXNlLFxuICBQcmFjdGljZUNhcmQsXG59IGZyb20gJ0BzY2FybGV0dC9jb3JlJztcblxuZXhwb3J0IGludGVyZmFjZSBBcGlDbGllbnRDb25maWcge1xuICBiYXNlVXJsOiBzdHJpbmc7XG4gIGdldEF1dGhUb2tlbj86ICgpID0+IFByb21pc2U8c3RyaW5nIHwgbnVsbD47XG4gIG9uRXJyb3I/OiAoZXJyb3I6IEVycm9yKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgQXBpQ2xpZW50IHtcbiAgcHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmc7XG4gIHByaXZhdGUgZ2V0QXV0aFRva2VuPzogKCkgPT4gUHJvbWlzZTxzdHJpbmcgfCBudWxsPjtcbiAgcHJpdmF0ZSBvbkVycm9yPzogKGVycm9yOiBFcnJvcikgPT4gdm9pZDtcblxuICBjb25zdHJ1Y3Rvcihjb25maWc6IEFwaUNsaWVudENvbmZpZykge1xuICAgIHRoaXMuYmFzZVVybCA9IGNvbmZpZy5iYXNlVXJsLnJlcGxhY2UoL1xcLyQvLCAnJyk7IC8vIFJlbW92ZSB0cmFpbGluZyBzbGFzaFxuICAgIHRoaXMuZ2V0QXV0aFRva2VuID0gY29uZmlnLmdldEF1dGhUb2tlbjtcbiAgICB0aGlzLm9uRXJyb3IgPSBjb25maWcub25FcnJvcjtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVxdWVzdDxUPihcbiAgICBwYXRoOiBzdHJpbmcsXG4gICAgb3B0aW9uczogUmVxdWVzdEluaXQgPSB7fVxuICApOiBQcm9taXNlPFQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgaGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgLi4uKG9wdGlvbnMuaGVhZGVycyBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHx8IHt9KSxcbiAgICAgIH07XG5cbiAgICAgIC8vIEFkZCBhdXRoIHRva2VuIGlmIGF2YWlsYWJsZVxuICAgICAgaWYgKHRoaXMuZ2V0QXV0aFRva2VuKSB7XG4gICAgICAgIGNvbnN0IHRva2VuID0gYXdhaXQgdGhpcy5nZXRBdXRoVG9rZW4oKTtcbiAgICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgICAgaGVhZGVyc1snQXV0aG9yaXphdGlvbiddID0gYEJlYXJlciAke3Rva2VufWA7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHt0aGlzLmJhc2VVcmx9JHtwYXRofWAsIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgaGVhZGVycyxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFQSSBFcnJvciAke3Jlc3BvbnNlLnN0YXR1c306ICR7ZXJyb3J9YCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBhd2FpdCByZXNwb25zZS5qc29uKCkgYXMgVDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKHRoaXMub25FcnJvcikge1xuICAgICAgICB0aGlzLm9uRXJyb3IoZXJyb3IgYXMgRXJyb3IpO1xuICAgICAgfVxuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLy8gSGVhbHRoIGNoZWNrXG4gIGFzeW5jIGhlYWx0aENoZWNrKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJy9oZWFsdGgnKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8vIEF1dGggZW5kcG9pbnRzXG4gIGFzeW5jIGdldERlbW9Ub2tlbigpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5yZXF1ZXN0PERlbW9Ub2tlblJlc3BvbnNlPignL2F1dGgvZGVtbycsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgIH0pO1xuICAgIHJldHVybiByZXNwb25zZS50b2tlbjtcbiAgfVxuXG4gIGFzeW5jIGdldFVzZXJDcmVkaXRzKCk6IFByb21pc2U8VXNlckNyZWRpdHNSZXNwb25zZT4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8VXNlckNyZWRpdHNSZXNwb25zZT4oJy9hcGkvdXNlci9jcmVkaXRzJyk7XG4gIH1cblxuICBhc3luYyBwdXJjaGFzZUNyZWRpdHMoXG4gICAgcmVxdWVzdDogUHVyY2hhc2VDcmVkaXRzUmVxdWVzdFxuICApOiBQcm9taXNlPFB1cmNoYXNlQ3JlZGl0c1Jlc3BvbnNlPiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxQdXJjaGFzZUNyZWRpdHNSZXNwb25zZT4oJy9hcGkvdXNlci9jcmVkaXRzL3B1cmNoYXNlJywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEthcmFva2UgZW5kcG9pbnRzXG4gIGFzeW5jIGdldEthcmFva2VEYXRhKHRyYWNrSWQ6IHN0cmluZyk6IFByb21pc2U8S2FyYW9rZURhdGE+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEthcmFva2VEYXRhPihgL2FwaS9rYXJhb2tlLyR7ZW5jb2RlVVJJQ29tcG9uZW50KHRyYWNrSWQpfWApO1xuICB9XG5cbiAgYXN5bmMgc3RhcnRLYXJhb2tlU2Vzc2lvbihcbiAgICByZXF1ZXN0OiBTdGFydFNlc3Npb25SZXF1ZXN0XG4gICk6IFByb21pc2U8QXBpUmVzcG9uc2U8S2FyYW9rZVNlc3Npb24+PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBcGlSZXNwb25zZTxLYXJhb2tlU2Vzc2lvbj4+KCcvYXBpL2thcmFva2Uvc3RhcnQnLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpLFxuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgZ3JhZGVLYXJhb2tlTGluZShcbiAgICByZXF1ZXN0OiBHcmFkZUxpbmVSZXF1ZXN0XG4gICk6IFByb21pc2U8QXBpUmVzcG9uc2U8TGluZVNjb3JlPj4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QXBpUmVzcG9uc2U8TGluZVNjb3JlPj4oJy9hcGkva2FyYW9rZS9ncmFkZScsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVxdWVzdCksXG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBjb21wbGV0ZUthcmFva2VTZXNzaW9uKFxuICAgIHJlcXVlc3Q6IENvbXBsZXRlU2Vzc2lvblJlcXVlc3RcbiAgKTogUHJvbWlzZTxBcGlSZXNwb25zZTxTZXNzaW9uUmVzdWx0cz4+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFwaVJlc3BvbnNlPFNlc3Npb25SZXN1bHRzPj4oJy9hcGkva2FyYW9rZS9jb21wbGV0ZScsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVxdWVzdCksXG4gICAgfSk7XG4gIH1cblxuICAvLyBTcGVlY2gtdG8tdGV4dCBlbmRwb2ludHNcbiAgYXN5bmMgdHJhbnNjcmliZUF1ZGlvKFxuICAgIHJlcXVlc3Q6IFRyYW5zY3JpYmVSZXF1ZXN0XG4gICk6IFByb21pc2U8VHJhbnNjcmliZVJlc3BvbnNlPiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxUcmFuc2NyaWJlUmVzcG9uc2U+KCcvYXBpL3NwZWVjaC10by10ZXh0L3RyYW5zY3JpYmUnLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gUHJhY3RpY2UgZW5kcG9pbnRzXG4gIGFzeW5jIGdldFByYWN0aWNlRXhlcmNpc2VzKFxuICAgIHNlc3Npb25JZD86IHN0cmluZyxcbiAgICBsaW1pdCA9IDEwXG4gICk6IFByb21pc2U8QXBpUmVzcG9uc2U8eyBleGVyY2lzZXM6IEV4ZXJjaXNlW107IGNhcmRzOiBQcmFjdGljZUNhcmRbXSB9Pj4ge1xuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoKTtcbiAgICBpZiAoc2Vzc2lvbklkKSBwYXJhbXMuYXBwZW5kKCdzZXNzaW9uSWQnLCBzZXNzaW9uSWQpO1xuICAgIHBhcmFtcy5hcHBlbmQoJ2xpbWl0JywgbGltaXQudG9TdHJpbmcoKSk7XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFwaVJlc3BvbnNlPHsgZXhlcmNpc2VzOiBFeGVyY2lzZVtdOyBjYXJkczogUHJhY3RpY2VDYXJkW10gfT4+KFxuICAgICAgYC9hcGkvcHJhY3RpY2UvZXhlcmNpc2VzPyR7cGFyYW1zfWBcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgc3VibWl0UHJhY3RpY2VSZXZpZXcoXG4gICAgY2FyZElkOiBzdHJpbmcsXG4gICAgc2NvcmU6IG51bWJlcixcbiAgICByZXZpZXdUaW1lOiBzdHJpbmdcbiAgKTogUHJvbWlzZTxBcGlSZXNwb25zZT4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QXBpUmVzcG9uc2U+KCcvYXBpL3ByYWN0aWNlL3JldmlldycsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBjYXJkSWQsIHNjb3JlLCByZXZpZXdUaW1lIH0pLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gVXNlciBlbmRwb2ludHNcbiAgYXN5bmMgZ2V0VXNlckJlc3RTY29yZShzb25nSWQ6IHN0cmluZyk6IFByb21pc2U8QXBpUmVzcG9uc2U8eyBzY29yZTogbnVtYmVyIH0+PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBcGlSZXNwb25zZTx7IHNjb3JlOiBudW1iZXIgfT4+KFxuICAgICAgYC9hcGkvdXNlcnMvbWUvc29uZ3MvJHtzb25nSWR9L2Jlc3Qtc2NvcmVgXG4gICAgKTtcbiAgfVxuXG4gIC8vIExlYWRlcmJvYXJkIGVuZHBvaW50c1xuICBhc3luYyBnZXRTb25nTGVhZGVyYm9hcmQoXG4gICAgc29uZ0lkOiBzdHJpbmcsXG4gICAgbGltaXQgPSAxMFxuICApOiBQcm9taXNlPEFwaVJlc3BvbnNlPEFycmF5PHsgdXNlcklkOiBzdHJpbmc7IHNjb3JlOiBudW1iZXI7IHJhbms6IG51bWJlciB9Pj4+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFwaVJlc3BvbnNlPEFycmF5PHsgdXNlcklkOiBzdHJpbmc7IHNjb3JlOiBudW1iZXI7IHJhbms6IG51bWJlciB9Pj4+KFxuICAgICAgYC9hcGkvc29uZ3MvJHtzb25nSWR9L2xlYWRlcmJvYXJkP2xpbWl0PSR7bGltaXR9YFxuICAgICk7XG4gIH1cbn0iLCJpbXBvcnQgdHlwZSB7IEFwaUNsaWVudCB9IGZyb20gJy4uL2NsaWVudCc7XG5pbXBvcnQgdHlwZSB7XG4gIEthcmFva2VEYXRhLFxuICBLYXJhb2tlU2Vzc2lvbixcbiAgTGluZVNjb3JlLFxuICBTZXNzaW9uUmVzdWx0cyxcbiAgQXBpUmVzcG9uc2UsXG59IGZyb20gJ0BzY2FybGV0dC9jb3JlJztcblxuZXhwb3J0IGNsYXNzIEthcmFva2VFbmRwb2ludCB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY2xpZW50OiBBcGlDbGllbnQpIHt9XG5cbiAgLyoqXG4gICAqIEZldGNoIGthcmFva2UgZGF0YSBmb3IgYSB0cmFja1xuICAgKi9cbiAgYXN5bmMgZ2V0RGF0YSh0cmFja0lkOiBzdHJpbmcpOiBQcm9taXNlPEthcmFva2VEYXRhPiB7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LmdldEthcmFva2VEYXRhKHRyYWNrSWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IGEgbmV3IGthcmFva2Ugc2Vzc2lvblxuICAgKi9cbiAgYXN5bmMgc3RhcnRTZXNzaW9uKFxuICAgIHRyYWNrSWQ6IHN0cmluZyxcbiAgICBzb25nRGF0YToge1xuICAgICAgdGl0bGU6IHN0cmluZztcbiAgICAgIGFydGlzdDogc3RyaW5nO1xuICAgICAgZ2VuaXVzSWQ/OiBzdHJpbmc7XG4gICAgICBkdXJhdGlvbj86IG51bWJlcjtcbiAgICAgIGRpZmZpY3VsdHk/OiBzdHJpbmc7XG4gICAgfSxcbiAgICBzb25nQ2F0YWxvZ0lkPzogc3RyaW5nXG4gICk6IFByb21pc2U8S2FyYW9rZVNlc3Npb24+IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LnN0YXJ0S2FyYW9rZVNlc3Npb24oe1xuICAgICAgdHJhY2tJZCxcbiAgICAgIHNvbmdEYXRhLFxuICAgICAgc29uZ0NhdGFsb2dJZCxcbiAgICB9KTtcblxuICAgIGlmICghcmVzcG9uc2Uuc3VjY2VzcyB8fCAhcmVzcG9uc2UuZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHJlc3BvbnNlLmVycm9yIHx8ICdGYWlsZWQgdG8gc3RhcnQgc2Vzc2lvbicpO1xuICAgIH1cblxuICAgIHJldHVybiByZXNwb25zZS5kYXRhO1xuICB9XG5cbiAgLyoqXG4gICAqIEdyYWRlIGEga2FyYW9rZSBsaW5lIHJlY29yZGluZ1xuICAgKi9cbiAgYXN5bmMgZ3JhZGVMaW5lKFxuICAgIHNlc3Npb25JZDogc3RyaW5nLFxuICAgIGxpbmVJbmRleDogbnVtYmVyLFxuICAgIGF1ZGlvQmFzZTY0OiBzdHJpbmcsXG4gICAgZXhwZWN0ZWRUZXh0OiBzdHJpbmcsXG4gICAgc3RhcnRUaW1lOiBudW1iZXIsXG4gICAgZW5kVGltZTogbnVtYmVyXG4gICk6IFByb21pc2U8TGluZVNjb3JlPiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNsaWVudC5ncmFkZUthcmFva2VMaW5lKHtcbiAgICAgIHNlc3Npb25JZCxcbiAgICAgIGxpbmVJbmRleCxcbiAgICAgIGF1ZGlvQnVmZmVyOiBhdWRpb0Jhc2U2NCxcbiAgICAgIGV4cGVjdGVkVGV4dCxcbiAgICAgIHN0YXJ0VGltZSxcbiAgICAgIGVuZFRpbWUsXG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLnN1Y2Nlc3MgfHwgIXJlc3BvbnNlLmRhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihyZXNwb25zZS5lcnJvciB8fCAnRmFpbGVkIHRvIGdyYWRlIGxpbmUnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21wbGV0ZSBhIGthcmFva2Ugc2Vzc2lvblxuICAgKi9cbiAgYXN5bmMgY29tcGxldGVTZXNzaW9uKFxuICAgIHNlc3Npb25JZDogc3RyaW5nLFxuICAgIGZ1bGxBdWRpb0Jhc2U2ND86IHN0cmluZ1xuICApOiBQcm9taXNlPFNlc3Npb25SZXN1bHRzPiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNsaWVudC5jb21wbGV0ZUthcmFva2VTZXNzaW9uKHtcbiAgICAgIHNlc3Npb25JZCxcbiAgICAgIGZ1bGxBdWRpb0J1ZmZlcjogZnVsbEF1ZGlvQmFzZTY0LFxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXNwb25zZS5zdWNjZXNzIHx8ICFyZXNwb25zZS5kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IocmVzcG9uc2UuZXJyb3IgfHwgJ0ZhaWxlZCB0byBjb21wbGV0ZSBzZXNzaW9uJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gIH1cbn0iLCJpbXBvcnQgdHlwZSB7IEFwaUNsaWVudCB9IGZyb20gJy4uL2NsaWVudCc7XG5pbXBvcnQgdHlwZSB7IEV4ZXJjaXNlLCBQcmFjdGljZUNhcmQgfSBmcm9tICdAc2NhcmxldHQvY29yZSc7XG5cbmV4cG9ydCBjbGFzcyBQcmFjdGljZUVuZHBvaW50IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBjbGllbnQ6IEFwaUNsaWVudCkge31cblxuICAvKipcbiAgICogR2V0IHByYWN0aWNlIGV4ZXJjaXNlcyBmb3IgYSB1c2VyXG4gICAqL1xuICBhc3luYyBnZXRFeGVyY2lzZXMoXG4gICAgc2Vzc2lvbklkPzogc3RyaW5nLFxuICAgIGxpbWl0ID0gMTBcbiAgKTogUHJvbWlzZTx7IGV4ZXJjaXNlczogRXhlcmNpc2VbXTsgY2FyZHM6IFByYWN0aWNlQ2FyZFtdIH0+IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LmdldFByYWN0aWNlRXhlcmNpc2VzKHNlc3Npb25JZCwgbGltaXQpO1xuXG4gICAgaWYgKCFyZXNwb25zZS5zdWNjZXNzIHx8ICFyZXNwb25zZS5kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IocmVzcG9uc2UuZXJyb3IgfHwgJ0ZhaWxlZCB0byBmZXRjaCBleGVyY2lzZXMnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdWJtaXQgYSBwcmFjdGljZSByZXZpZXdcbiAgICovXG4gIGFzeW5jIHN1Ym1pdFJldmlldyhcbiAgICBjYXJkSWQ6IHN0cmluZyxcbiAgICBzY29yZTogbnVtYmVyLFxuICAgIHJldmlld1RpbWU6IHN0cmluZyA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LnN1Ym1pdFByYWN0aWNlUmV2aWV3KFxuICAgICAgY2FyZElkLFxuICAgICAgc2NvcmUsXG4gICAgICByZXZpZXdUaW1lXG4gICAgKTtcblxuICAgIGlmICghcmVzcG9uc2Uuc3VjY2Vzcykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHJlc3BvbnNlLmVycm9yIHx8ICdGYWlsZWQgdG8gc3VibWl0IHJldmlldycpO1xuICAgIH1cbiAgfVxufSIsImltcG9ydCB0eXBlIHsgQXBpQ2xpZW50IH0gZnJvbSAnLi4vY2xpZW50JztcblxuZXhwb3J0IGludGVyZmFjZSBUcmFuc2NyaXB0aW9uUmVzdWx0IHtcbiAgdHJhbnNjcmlwdDogc3RyaW5nO1xuICBjb25maWRlbmNlOiBudW1iZXI7XG4gIHByb3ZpZGVyPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgU1RURW5kcG9pbnQge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGNsaWVudDogQXBpQ2xpZW50KSB7fVxuXG4gIC8qKlxuICAgKiBUcmFuc2NyaWJlIGF1ZGlvIHVzaW5nIHNwZWVjaC10by10ZXh0XG4gICAqL1xuICBhc3luYyB0cmFuc2NyaWJlKFxuICAgIGF1ZGlvQmFzZTY0OiBzdHJpbmcsXG4gICAgZXhwZWN0ZWRUZXh0Pzogc3RyaW5nLFxuICAgIHByZWZlckRlZXBncmFtID0gZmFsc2VcbiAgKTogUHJvbWlzZTxUcmFuc2NyaXB0aW9uUmVzdWx0PiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNsaWVudC50cmFuc2NyaWJlQXVkaW8oe1xuICAgICAgYXVkaW9CYXNlNjQsXG4gICAgICBleHBlY3RlZFRleHQsXG4gICAgICBwcmVmZXJEZWVwZ3JhbSxcbiAgICB9KTtcblxuICAgIGlmICghcmVzcG9uc2Uuc3VjY2VzcyB8fCAhcmVzcG9uc2UuZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHJlc3BvbnNlLmVycm9yIHx8ICdGYWlsZWQgdG8gdHJhbnNjcmliZSBhdWRpbycpO1xuICAgIH1cblxuICAgIHJldHVybiByZXNwb25zZS5kYXRhO1xuICB9XG5cbiAgLyoqXG4gICAqIFRyYW5zY3JpYmUgd2l0aCByZXRyeSBsb2dpY1xuICAgKi9cbiAgYXN5bmMgdHJhbnNjcmliZVdpdGhSZXRyeShcbiAgICBhdWRpb0Jhc2U2NDogc3RyaW5nLFxuICAgIGV4cGVjdGVkVGV4dD86IHN0cmluZyxcbiAgICBtYXhSZXRyaWVzID0gMlxuICApOiBQcm9taXNlPFRyYW5zY3JpcHRpb25SZXN1bHQ+IHtcbiAgICBsZXQgbGFzdEVycm9yOiBFcnJvciB8IG51bGwgPSBudWxsO1xuXG4gICAgZm9yIChsZXQgYXR0ZW1wdCA9IDE7IGF0dGVtcHQgPD0gbWF4UmV0cmllczsgYXR0ZW1wdCsrKSB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyBUcnkgRWxldmVuTGFicyBmaXJzdFxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnRyYW5zY3JpYmUoXG4gICAgICAgICAgYXVkaW9CYXNlNjQsXG4gICAgICAgICAgZXhwZWN0ZWRUZXh0LFxuICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsYXN0RXJyb3IgPSBlcnJvciBhcyBFcnJvcjtcbiAgICAgICAgY29uc29sZS5sb2coYFtTVFRdIEF0dGVtcHQgJHthdHRlbXB0fS8ke21heFJldHJpZXN9IGZhaWxlZDpgLCBlcnJvcik7XG5cbiAgICAgICAgLy8gSWYgZmlyc3QgYXR0ZW1wdCBmYWlsZWQsIHRyeSB3aXRoIERlZXBncmFtXG4gICAgICAgIGlmIChhdHRlbXB0ID09PSAxKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbU1RUXSBSZXRyeWluZyB3aXRoIERlZXBncmFtLi4uJyk7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnRyYW5zY3JpYmUoXG4gICAgICAgICAgICAgIGF1ZGlvQmFzZTY0LFxuICAgICAgICAgICAgICBleHBlY3RlZFRleHQsXG4gICAgICAgICAgICAgIHRydWVcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgIH0gY2F0Y2ggKGRlZXBncmFtRXJyb3IpIHtcbiAgICAgICAgICAgIGxhc3RFcnJvciA9IGRlZXBncmFtRXJyb3IgYXMgRXJyb3I7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbU1RUXSBEZWVwZ3JhbSBhbHNvIGZhaWxlZDonLCBkZWVwZ3JhbUVycm9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aHJvdyBsYXN0RXJyb3IgfHwgbmV3IEVycm9yKCdTVFQgZmFpbGVkIGFmdGVyIHJldHJpZXMnKTtcbiAgfVxufSIsImltcG9ydCB0eXBlIHsgQXBpQ2xpZW50IH0gZnJvbSAnLi4vY2xpZW50JztcbmltcG9ydCB0eXBlIHtcbiAgVXNlckNyZWRpdHNSZXNwb25zZSxcbiAgUHVyY2hhc2VDcmVkaXRzUmVxdWVzdCxcbiAgUHVyY2hhc2VDcmVkaXRzUmVzcG9uc2UsXG59IGZyb20gJ0BzY2FybGV0dC9jb3JlJztcblxuZXhwb3J0IGNsYXNzIEF1dGhFbmRwb2ludCB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY2xpZW50OiBBcGlDbGllbnQpIHt9XG5cbiAgLyoqXG4gICAqIEdldCBhIGRlbW8gYXV0aGVudGljYXRpb24gdG9rZW5cbiAgICovXG4gIGFzeW5jIGdldERlbW9Ub2tlbigpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5nZXREZW1vVG9rZW4oKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgY3VycmVudCB1c2VyIGNyZWRpdHNcbiAgICovXG4gIGFzeW5jIGdldFVzZXJDcmVkaXRzKCk6IFByb21pc2U8VXNlckNyZWRpdHNSZXNwb25zZT4ge1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5nZXRVc2VyQ3JlZGl0cygpO1xuICB9XG5cbiAgLyoqXG4gICAqIFB1cmNoYXNlIGNyZWRpdHNcbiAgICovXG4gIGFzeW5jIHB1cmNoYXNlQ3JlZGl0cyhcbiAgICBmaWQ6IG51bWJlcixcbiAgICBjcmVkaXRzOiBudW1iZXIsXG4gICAgY2hhaW46ICdCYXNlJyB8ICdTb2xhbmEnID0gJ0Jhc2UnLFxuICAgIHRyYW5zYWN0aW9uSGFzaD86IHN0cmluZ1xuICApOiBQcm9taXNlPFB1cmNoYXNlQ3JlZGl0c1Jlc3BvbnNlPiB7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LnB1cmNoYXNlQ3JlZGl0cyh7XG4gICAgICBmaWQsXG4gICAgICBjcmVkaXRzLFxuICAgICAgY2hhaW4sXG4gICAgICB0cmFuc2FjdGlvbkhhc2gsXG4gICAgfSk7XG4gIH1cbn0iLCJpbXBvcnQgeyBBcGlDbGllbnQsIHR5cGUgQXBpQ2xpZW50Q29uZmlnIH0gZnJvbSAnLi9jbGllbnQnO1xuaW1wb3J0IHtcbiAgS2FyYW9rZUVuZHBvaW50LFxuICBQcmFjdGljZUVuZHBvaW50LFxuICBTVFRFbmRwb2ludCxcbiAgQXV0aEVuZHBvaW50LFxufSBmcm9tICcuL2VuZHBvaW50cyc7XG5cbmV4cG9ydCB7IEFwaUNsaWVudCwgdHlwZSBBcGlDbGllbnRDb25maWcgfTtcbmV4cG9ydCAqIGZyb20gJy4vZW5kcG9pbnRzJztcblxuLyoqXG4gKiBDcmVhdGUgYSBjb25maWd1cmVkIEFQSSBjbGllbnQgd2l0aCBhbGwgZW5kcG9pbnRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBcGlDbGllbnQoY29uZmlnOiBBcGlDbGllbnRDb25maWcpIHtcbiAgY29uc3QgY2xpZW50ID0gbmV3IEFwaUNsaWVudChjb25maWcpO1xuXG4gIHJldHVybiB7XG4gICAgY2xpZW50LFxuICAgIGthcmFva2U6IG5ldyBLYXJhb2tlRW5kcG9pbnQoY2xpZW50KSxcbiAgICBwcmFjdGljZTogbmV3IFByYWN0aWNlRW5kcG9pbnQoY2xpZW50KSxcbiAgICBzdHQ6IG5ldyBTVFRFbmRwb2ludChjbGllbnQpLFxuICAgIGF1dGg6IG5ldyBBdXRoRW5kcG9pbnQoY2xpZW50KSxcbiAgICBcbiAgICAvLyBEaXJlY3QgYWNjZXNzIHRvIGJhc2UgbWV0aG9kc1xuICAgIGhlYWx0aENoZWNrOiAoKSA9PiBjbGllbnQuaGVhbHRoQ2hlY2soKSxcbiAgfTtcbn1cblxuZXhwb3J0IHR5cGUgU2NhcmxldHRBcGlDbGllbnQgPSBSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVBcGlDbGllbnQ+OyIsImltcG9ydCB7IGNyZWF0ZUFwaUNsaWVudCwgdHlwZSBTY2FybGV0dEFwaUNsaWVudCB9IGZyb20gJ0BzY2FybGV0dC9hcGktY2xpZW50JztcbmltcG9ydCB0eXBlIHsgS2FyYW9rZURhdGEsIEthcmFva2VTZXNzaW9uLCBMaW5lU2NvcmUsIFNlc3Npb25SZXN1bHRzIH0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuXG4vKipcbiAqIEFkYXB0ZXIgY2xhc3MgdGhhdCBwcm92aWRlcyB0aGUgc2FtZSBpbnRlcmZhY2UgYXMgdGhlIG9sZCBLYXJhb2tlQXBpU2VydmljZVxuICogYnV0IHVzZXMgdGhlIG5ldyBAc2NhcmxldHQvYXBpLWNsaWVudCB1bmRlciB0aGUgaG9vZFxuICovXG5leHBvcnQgY2xhc3MgS2FyYW9rZUFwaVNlcnZpY2Uge1xuICBwcml2YXRlIGNsaWVudDogU2NhcmxldHRBcGlDbGllbnQ7XG5cbiAgY29uc3RydWN0b3IoYmFzZVVybDogc3RyaW5nID0gaW1wb3J0Lm1ldGEuZW52LlZJVEVfQVBJX1VSTCB8fCAnaHR0cDovL2xvY2FsaG9zdDo4Nzg3Jykge1xuICAgIHRoaXMuY2xpZW50ID0gY3JlYXRlQXBpQ2xpZW50KHsgYmFzZVVybCB9KTtcbiAgfVxuXG4gIGFzeW5jIGZldGNoS2FyYW9rZURhdGEodHJhY2tJZDogc3RyaW5nKTogUHJvbWlzZTxLYXJhb2tlRGF0YSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY2xpZW50LmthcmFva2UuZ2V0RGF0YSh0cmFja0lkKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBmZXRjaCBrYXJhb2tlIGRhdGE6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgc3RhcnRTZXNzaW9uKFxuICAgIHRyYWNrSWQ6IHN0cmluZyxcbiAgICBzb25nRGF0YTogeyB0aXRsZTogc3RyaW5nOyBhcnRpc3Q6IHN0cmluZzsgZ2VuaXVzSWQ/OiBzdHJpbmc7IGR1cmF0aW9uPzogbnVtYmVyOyBkaWZmaWN1bHR5Pzogc3RyaW5nIH0sXG4gICAgYXV0aFRva2VuPzogc3RyaW5nLFxuICAgIHNvbmdDYXRhbG9nSWQ/OiBzdHJpbmcsXG4gICAgcGxheWJhY2tTcGVlZD86IHN0cmluZ1xuICApOiBQcm9taXNlPEthcmFva2VTZXNzaW9uIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICAvLyBOb3RlOiBwbGF5YmFja1NwZWVkIGlzIHN0b3JlZCBidXQgbm90IHVzZWQgYnkgdGhlIGN1cnJlbnQgYXBpLWNsaWVudFxuICAgICAgLy8gVGhpcyBtYWludGFpbnMgY29tcGF0aWJpbGl0eSB3aXRoIHRoZSBleGlzdGluZyBpbnRlcmZhY2VcbiAgICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCB0aGlzLmNsaWVudC5rYXJhb2tlLnN0YXJ0U2Vzc2lvbihcbiAgICAgICAgdHJhY2tJZCxcbiAgICAgICAgc29uZ0RhdGEsXG4gICAgICAgIHNvbmdDYXRhbG9nSWRcbiAgICAgICk7XG4gICAgICByZXR1cm4gc2Vzc2lvbjtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBzdGFydCBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdyYWRlUmVjb3JkaW5nKFxuICAgIHNlc3Npb25JZDogc3RyaW5nLFxuICAgIGxpbmVJbmRleDogbnVtYmVyLFxuICAgIGF1ZGlvQnVmZmVyOiBzdHJpbmcsXG4gICAgZXhwZWN0ZWRUZXh0OiBzdHJpbmcsXG4gICAgc3RhcnRUaW1lOiBudW1iZXIsXG4gICAgZW5kVGltZTogbnVtYmVyLFxuICAgIGF1dGhUb2tlbj86IHN0cmluZyxcbiAgICBwbGF5YmFja1NwZWVkPzogc3RyaW5nXG4gICk6IFByb21pc2U8TGluZVNjb3JlIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICAvLyBOb3RlOiBwbGF5YmFja1NwZWVkIGlzIHBhc3NlZCBidXQgbm90IHVzZWQgYnkgdGhlIGN1cnJlbnQgYXBpLWNsaWVudFxuICAgICAgY29uc3QgbGluZVNjb3JlID0gYXdhaXQgdGhpcy5jbGllbnQua2FyYW9rZS5ncmFkZUxpbmUoXG4gICAgICAgIHNlc3Npb25JZCxcbiAgICAgICAgbGluZUluZGV4LFxuICAgICAgICBhdWRpb0J1ZmZlcixcbiAgICAgICAgZXhwZWN0ZWRUZXh0LFxuICAgICAgICBzdGFydFRpbWUsXG4gICAgICAgIGVuZFRpbWVcbiAgICAgICk7XG4gICAgICByZXR1cm4gbGluZVNjb3JlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGdyYWRlIHJlY29yZGluZzonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBjb21wbGV0ZVNlc3Npb24oXG4gICAgc2Vzc2lvbklkOiBzdHJpbmcsXG4gICAgZnVsbEF1ZGlvQnVmZmVyPzogc3RyaW5nXG4gICk6IFByb21pc2U8U2Vzc2lvblJlc3VsdHMgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCB0aGlzLmNsaWVudC5rYXJhb2tlLmNvbXBsZXRlU2Vzc2lvbihcbiAgICAgICAgc2Vzc2lvbklkLFxuICAgICAgICBmdWxsQXVkaW9CdWZmZXJcbiAgICAgICk7XG4gICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBjb21wbGV0ZSBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldFVzZXJCZXN0U2NvcmUoc29uZ0lkOiBzdHJpbmcpOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNsaWVudC5jbGllbnQuZ2V0VXNlckJlc3RTY29yZShzb25nSWQpO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE/LnNjb3JlID8/IG51bGw7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZ2V0IHVzZXIgYmVzdCBzY29yZTonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBnZXRTb25nTGVhZGVyYm9hcmQoc29uZ0lkOiBzdHJpbmcsIGxpbWl0ID0gMTApOiBQcm9taXNlPEFycmF5PHsgdXNlcklkOiBzdHJpbmc7IHNjb3JlOiBudW1iZXI7IHJhbms6IG51bWJlciB9Pj4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LmNsaWVudC5nZXRTb25nTGVhZGVyYm9hcmQoc29uZ0lkLCBsaW1pdCk7XG4gICAgICByZXR1cm4gcmVzcG9uc2UuZGF0YSA/PyBbXTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBnZXQgc29uZyBsZWFkZXJib2FyZDonLCBlcnJvcik7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICB9XG59IiwiaW1wb3J0IHR5cGUgeyBDaHVua0luZm8gfSBmcm9tICdAc2NhcmxldHQvY29yZSc7XG5pbXBvcnQgdHlwZSB7IEx5cmljTGluZSB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMva2FyYW9rZS9MeXJpY3NEaXNwbGF5JztcblxuZXhwb3J0IGZ1bmN0aW9uIGNvdW50V29yZHModGV4dDogc3RyaW5nKTogbnVtYmVyIHtcbiAgaWYgKCF0ZXh0KSByZXR1cm4gMDtcbiAgcmV0dXJuIHRleHRcbiAgICAudHJpbSgpXG4gICAgLnNwbGl0KC9cXHMrLylcbiAgICAuZmlsdGVyKCh3b3JkKSA9PiB3b3JkLmxlbmd0aCA+IDApLmxlbmd0aDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZENodW5rTGluZXMoXG4gIGxpbmVzOiBMeXJpY0xpbmVbXSxcbiAgc3RhcnRJbmRleDogbnVtYmVyXG4pOiBDaHVua0luZm8ge1xuICAvLyBQcm9jZXNzIGluZGl2aWR1YWwgbGluZXMgaW5zdGVhZCBvZiBncm91cGluZ1xuICBjb25zdCBsaW5lID0gbGluZXNbc3RhcnRJbmRleF07XG4gIGlmICghbGluZSkge1xuICAgIHJldHVybiB7XG4gICAgICBzdGFydEluZGV4LFxuICAgICAgZW5kSW5kZXg6IHN0YXJ0SW5kZXgsXG4gICAgICBleHBlY3RlZFRleHQ6ICcnLFxuICAgICAgd29yZENvdW50OiAwLFxuICAgIH07XG4gIH1cblxuICBjb25zdCB3b3JkQ291bnQgPSBjb3VudFdvcmRzKGxpbmUudGV4dCB8fCAnJyk7XG4gIFxuICByZXR1cm4ge1xuICAgIHN0YXJ0SW5kZXgsXG4gICAgZW5kSW5kZXg6IHN0YXJ0SW5kZXgsIC8vIFNpbmdsZSBsaW5lLCBzbyBzdGFydCBhbmQgZW5kIGFyZSB0aGUgc2FtZVxuICAgIGV4cGVjdGVkVGV4dDogbGluZS50ZXh0IHx8ICcnLFxuICAgIHdvcmRDb3VudCxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNhbGN1bGF0ZVJlY29yZGluZ0R1cmF0aW9uKFxuICBsaW5lczogTHlyaWNMaW5lW10sXG4gIGNodW5rSW5mbzogQ2h1bmtJbmZvXG4pOiBudW1iZXIge1xuICBjb25zdCB7IHN0YXJ0SW5kZXgsIGVuZEluZGV4IH0gPSBjaHVua0luZm87XG4gIGNvbnN0IGxpbmUgPSBsaW5lc1tzdGFydEluZGV4XTtcbiAgXG4gIGlmICghbGluZSkgcmV0dXJuIDMwMDA7XG5cbiAgaWYgKGVuZEluZGV4ID4gc3RhcnRJbmRleCkge1xuICAgIGlmIChlbmRJbmRleCArIDEgPCBsaW5lcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IG5leHRMaW5lID0gbGluZXNbZW5kSW5kZXggKyAxXTtcbiAgICAgIGlmIChuZXh0TGluZSkge1xuICAgICAgICAvLyBDb252ZXJ0IHNlY29uZHMgdG8gbWlsbGlzZWNvbmRzXG4gICAgICAgIHJldHVybiAobmV4dExpbmUuc3RhcnRUaW1lIC0gbGluZS5zdGFydFRpbWUpICogMTAwMDtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgbGV0IGR1cmF0aW9uID0gMDtcbiAgICBmb3IgKGxldCBpID0gc3RhcnRJbmRleDsgaSA8PSBlbmRJbmRleDsgaSsrKSB7XG4gICAgICAvLyBkdXJhdGlvbiBpcyBhbHJlYWR5IGluIG1pbGxpc2Vjb25kc1xuICAgICAgZHVyYXRpb24gKz0gbGluZXNbaV0/LmR1cmF0aW9uIHx8IDMwMDA7XG4gICAgfVxuICAgIHJldHVybiBNYXRoLm1pbihkdXJhdGlvbiwgODAwMCk7XG4gIH0gZWxzZSB7XG4gICAgaWYgKHN0YXJ0SW5kZXggKyAxIDwgbGluZXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBuZXh0TGluZSA9IGxpbmVzW3N0YXJ0SW5kZXggKyAxXTtcbiAgICAgIGlmIChuZXh0TGluZSkge1xuICAgICAgICAvLyBDb252ZXJ0IHNlY29uZHMgdG8gbWlsbGlzZWNvbmRzXG4gICAgICAgIGNvbnN0IGNhbGN1bGF0ZWREdXJhdGlvbiA9IChuZXh0TGluZS5zdGFydFRpbWUgLSBsaW5lLnN0YXJ0VGltZSkgKiAxMDAwO1xuICAgICAgICByZXR1cm4gTWF0aC5taW4oTWF0aC5tYXgoY2FsY3VsYXRlZER1cmF0aW9uLCAxMDAwKSwgNTAwMCk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBNYXRoLm1pbihsaW5lLmR1cmF0aW9uIHx8IDMwMDAsIDUwMDApO1xuICB9XG59IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBQcm9ncmVzc0JhclByb3BzIHtcbiAgY3VycmVudDogbnVtYmVyO1xuICB0b3RhbDogbnVtYmVyO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFByb2dyZXNzQmFyOiBDb21wb25lbnQ8UHJvZ3Jlc3NCYXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgcGVyY2VudGFnZSA9ICgpID0+IE1hdGgubWluKDEwMCwgTWF0aC5tYXgoMCwgKHByb3BzLmN1cnJlbnQgLyBwcm9wcy50b3RhbCkgKiAxMDApKTtcbiAgXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ3ctZnVsbCBoLTEuNSBiZy1oaWdobGlnaHQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgPGRpdlxuICAgICAgICBjbGFzcz1cImgtZnVsbCBiZy1hY2NlbnQgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwIGVhc2Utb3V0IHJvdW5kZWQtci1zbVwiXG4gICAgICAgIHN0eWxlPXt7IHdpZHRoOiBgJHtwZXJjZW50YWdlKCl9JWAgfX1cbiAgICAgIC8+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1pbmltaXplZEthcmFva2VQcm9wcyB7XG4gIG9uQ2xpY2s6ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBNaW5pbWl6ZWRLYXJhb2tlOiBDb21wb25lbnQ8TWluaW1pemVkS2FyYW9rZVByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ2xpY2t9XG4gICAgICBzdHlsZT17e1xuICAgICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgICAgYm90dG9tOiAnMjRweCcsXG4gICAgICAgIHJpZ2h0OiAnMjRweCcsXG4gICAgICAgIHdpZHRoOiAnODBweCcsXG4gICAgICAgIGhlaWdodDogJzgwcHgnLFxuICAgICAgICAnYm9yZGVyLXJhZGl1cyc6ICc1MCUnLFxuICAgICAgICBiYWNrZ3JvdW5kOiAnbGluZWFyLWdyYWRpZW50KDEzNWRlZywgI0ZGMDA2RSAwJSwgI0MxMzU4NCAxMDAlKScsXG4gICAgICAgICdib3gtc2hhZG93JzogJzAgOHB4IDMycHggcmdiYSgwLCAwLCAwLCAwLjMpJyxcbiAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxuICAgICAgICAnYWxpZ24taXRlbXMnOiAnY2VudGVyJyxcbiAgICAgICAgJ2p1c3RpZnktY29udGVudCc6ICdjZW50ZXInLFxuICAgICAgICBvdmVyZmxvdzogJ2hpZGRlbicsXG4gICAgICAgIGN1cnNvcjogJ3BvaW50ZXInLFxuICAgICAgICAnei1pbmRleCc6ICc5OTk5OScsXG4gICAgICAgIGJvcmRlcjogJ25vbmUnLFxuICAgICAgICB0cmFuc2l0aW9uOiAndHJhbnNmb3JtIDAuMnMgZWFzZScsXG4gICAgICB9fVxuICAgICAgb25Nb3VzZUVudGVyPXsoZSkgPT4ge1xuICAgICAgICBlLmN1cnJlbnRUYXJnZXQuc3R5bGUudHJhbnNmb3JtID0gJ3NjYWxlKDEuMSknO1xuICAgICAgfX1cbiAgICAgIG9uTW91c2VMZWF2ZT17KGUpID0+IHtcbiAgICAgICAgZS5jdXJyZW50VGFyZ2V0LnN0eWxlLnRyYW5zZm9ybSA9ICdzY2FsZSgxKSc7XG4gICAgICB9fVxuICAgICAgYXJpYS1sYWJlbD1cIk9wZW4gS2FyYW9rZVwiXG4gICAgPlxuICAgICAgey8qIFBsYWNlIHlvdXIgMjAweDIwMCBpbWFnZSBoZXJlIGFzOiAqL31cbiAgICAgIHsvKiA8aW1nIHNyYz1cIi9wYXRoL3RvL3lvdXIvaW1hZ2UucG5nXCIgYWx0PVwiS2FyYW9rZVwiIHN0eWxlPVwid2lkdGg6IDEwMCU7IGhlaWdodDogMTAwJTsgb2JqZWN0LWZpdDogY292ZXI7XCIgLz4gKi99XG4gICAgICBcbiAgICAgIHsvKiBGb3Igbm93LCB1c2luZyBhIHBsYWNlaG9sZGVyIGljb24gKi99XG4gICAgICA8c3BhbiBzdHlsZT17eyAnZm9udC1zaXplJzogJzM2cHgnIH19PvCfjqQ8L3NwYW4+XG4gICAgPC9idXR0b24+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCBJY29uWFJlZ3VsYXIgZnJvbSAncGhvc3Bob3ItaWNvbnMtc29saWQvSWNvblhSZWd1bGFyJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByYWN0aWNlSGVhZGVyUHJvcHMge1xuICB0aXRsZT86IHN0cmluZztcbiAgb25FeGl0OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFByYWN0aWNlSGVhZGVyOiBDb21wb25lbnQ8UHJhY3RpY2VIZWFkZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8U2hvdyB3aGVuPXtwcm9wcy50aXRsZX0+XG4gICAgICA8aGVhZGVyIGNsYXNzPXtjbignZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgaC0xNCBweC00IGJnLXRyYW5zcGFyZW50JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgICAgPGgxIGNsYXNzPVwidGV4dC1sZyBmb250LXNlbWlib2xkIHRleHQtcHJpbWFyeVwiPlxuICAgICAgICAgIHtwcm9wcy50aXRsZX1cbiAgICAgICAgPC9oMT5cbiAgICAgIDwvaGVhZGVyPlxuICAgIDwvU2hvdz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL0J1dHRvbic7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBFeGVyY2lzZUZvb3RlclByb3BzIHtcbiAgaXNSZWNvcmRpbmc/OiBib29sZWFuO1xuICBpc1Byb2Nlc3Npbmc/OiBib29sZWFuO1xuICBjYW5TdWJtaXQ/OiBib29sZWFuO1xuICBvblJlY29yZD86ICgpID0+IHZvaWQ7XG4gIG9uU3RvcD86ICgpID0+IHZvaWQ7XG4gIG9uU3VibWl0PzogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBFeGVyY2lzZUZvb3RlcjogQ29tcG9uZW50PEV4ZXJjaXNlRm9vdGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGZvb3RlciBjbGFzcz17Y24oJ2JvcmRlci10IGJvcmRlci1ncmF5LTcwMCBiZy1zdXJmYWNlIHAtNicsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8ZGl2IGNsYXNzPVwibWF4LXctMnhsIG14LWF1dG9cIj5cbiAgICAgICAgPFNob3dcbiAgICAgICAgICB3aGVuPXshcHJvcHMuaXNSZWNvcmRpbmd9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgIGZ1bGxXaWR0aFxuICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblN0b3B9XG4gICAgICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5pc1Byb2Nlc3Npbmd9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIFN0b3BcbiAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIH1cbiAgICAgICAgPlxuICAgICAgICAgIDxTaG93XG4gICAgICAgICAgICB3aGVuPXtwcm9wcy5jYW5TdWJtaXR9XG4gICAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblJlY29yZH1cbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17cHJvcHMuaXNQcm9jZXNzaW5nfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgUmVjb3JkXG4gICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgdmFyaWFudD1cInByaW1hcnlcIlxuICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25TdWJtaXR9XG4gICAgICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5pc1Byb2Nlc3Npbmd9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtwcm9wcy5pc1Byb2Nlc3NpbmcgPyAnUHJvY2Vzc2luZy4uLicgOiAnU3VibWl0J31cbiAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgPC9TaG93PlxuICAgICAgPC9kaXY+XG4gICAgPC9mb290ZXI+XG4gICk7XG59OyIsImV4cG9ydCBkZWZhdWx0IChwKSA9PiAoPHN2ZyBjbGFzcz17cC5jbGFzc30gZGF0YS1waG9zcGhvci1pY29uPVwiY2hlY2stY2lyY2xlXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCIgd2lkdGg9XCIxZW1cIiBoZWlnaHQ9XCIxZW1cIiBwb2ludGVyLWV2ZW50cz1cIm5vbmVcIiBkaXNwbGF5PVwiaW5saW5lLWJsb2NrXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiB2aWV3Qm94PVwiMCAwIDI1NiAyNTZcIj48cGF0aCBkPVwiTTEyOCAyNGExMDQgMTA0IDAgMSAwIDEwNCAxMDRBMTA0LjExIDEwNC4xMSAwIDAgMCAxMjggMjRtNDUuNjYgODUuNjYtNTYgNTZhOCA4IDAgMCAxLTExLjMyIDBsLTI0LTI0YTggOCAwIDAgMSAxMS4zMi0xMS4zMkwxMTIgMTQ4LjY5bDUwLjM0LTUwLjM1YTggOCAwIDAgMSAxMS4zMiAxMS4zMlwiLz48L3N2Zz4pO1xuIiwiZXhwb3J0IGRlZmF1bHQgKHApID0+ICg8c3ZnIGNsYXNzPXtwLmNsYXNzfSBkYXRhLXBob3NwaG9yLWljb249XCJ4LWNpcmNsZVwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiIHdpZHRoPVwiMWVtXCIgaGVpZ2h0PVwiMWVtXCIgcG9pbnRlci1ldmVudHM9XCJub25lXCIgZGlzcGxheT1cImlubGluZS1ibG9ja1wiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBmaWxsPVwiY3VycmVudENvbG9yXCIgdmlld0JveD1cIjAgMCAyNTYgMjU2XCI+PHBhdGggZD1cIk0xMjggMjRhMTA0IDEwNCAwIDEgMCAxMDQgMTA0QTEwNC4xMSAxMDQuMTEgMCAwIDAgMTI4IDI0bTM3LjY2IDEzMC4zNGE4IDggMCAwIDEtMTEuMzIgMTEuMzJMMTI4IDEzOS4zMWwtMjYuMzQgMjYuMzVhOCA4IDAgMCAxLTExLjMyLTExLjMyTDExNi42OSAxMjhsLTI2LjM1LTI2LjM0YTggOCAwIDAgMSAxMS4zMi0xMS4zMkwxMjggMTE2LjY5bDI2LjM0LTI2LjM1YTggOCAwIDAgMSAxMS4zMiAxMS4zMkwxMzkuMzEgMTI4WlwiLz48L3N2Zz4pO1xuIiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL0J1dHRvbic7XG5pbXBvcnQgSWNvbkNoZWNrQ2lyY2xlRmlsbCBmcm9tICdwaG9zcGhvci1pY29ucy1zb2xpZC9JY29uQ2hlY2tDaXJjbGVGaWxsJztcbmltcG9ydCBJY29uWENpcmNsZUZpbGwgZnJvbSAncGhvc3Bob3ItaWNvbnMtc29saWQvSWNvblhDaXJjbGVGaWxsJztcblxuZXhwb3J0IGludGVyZmFjZSBSZXNwb25zZUZvb3RlclByb3BzIHtcbiAgbW9kZTogJ2NoZWNrJyB8ICdmZWVkYmFjayc7XG4gIGlzQ29ycmVjdD86IGJvb2xlYW47XG4gIGZlZWRiYWNrVGV4dD86IHN0cmluZztcbiAgY29udGludWVMYWJlbD86IHN0cmluZztcbiAgb25DaGVjaz86ICgpID0+IHZvaWQ7XG4gIG9uQ29udGludWU/OiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgUmVzcG9uc2VGb290ZXI6IENvbXBvbmVudDxSZXNwb25zZUZvb3RlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9XCJib3JkZXItdCBib3JkZXItZ3JheS03MDAgYmctc3VyZmFjZSBwLTZcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy0yeGwgbXgtYXV0b1wiPlxuICAgICAgICA8U2hvd1xuICAgICAgICAgIHdoZW49e3Byb3BzLm1vZGUgPT09ICdjaGVjayd9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtNlwiPlxuICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuaXNDb3JyZWN0ICE9PSB1bmRlZmluZWR9PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTRcIj5cbiAgICAgICAgICAgICAgICA8U2hvd1xuICAgICAgICAgICAgICAgICAgd2hlbj17cHJvcHMuaXNDb3JyZWN0fVxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9ezxJY29uWENpcmNsZUZpbGwgc3R5bGU9XCJjb2xvcjogI2VmNDQ0NDtcIiBjbGFzcz1cInctMTYgaC0xNiBmbGV4LXNocmluay0wXCIgLz59XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPEljb25DaGVja0NpcmNsZUZpbGwgc3R5bGU9XCJjb2xvcjogIzIyYzU1ZTtcIiBjbGFzcz1cInctMTYgaC0xNiBmbGV4LXNocmluay0wXCIgLz5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC0yeGwgZm9udC1ib2xkXCIgc3R5bGU9e2Bjb2xvcjogJHtwcm9wcy5pc0NvcnJlY3QgPyAnIzIyYzU1ZScgOiAnI2VmNDQ0NCd9O2B9PlxuICAgICAgICAgICAgICAgICAgICB7cHJvcHMuaXNDb3JyZWN0ID8gJ0NvcnJlY3QhJyA6ICdJbmNvcnJlY3QnfVxuICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuZmVlZGJhY2tUZXh0ICYmICFwcm9wcy5pc0NvcnJlY3R9PlxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtYmFzZSB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+e3Byb3BzLmZlZWRiYWNrVGV4dH08L3A+XG4gICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ29udGludWV9XG4gICAgICAgICAgICAgIGNsYXNzPVwibWluLXctWzE4MHB4XVwiXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtwcm9wcy5jb250aW51ZUxhYmVsIHx8ICdOZXh0J31cbiAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICB9XG4gICAgICA+XG4gICAgICAgIDxCdXR0b25cbiAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNoZWNrfVxuICAgICAgICA+XG4gICAgICAgICAgQ2hlY2tcbiAgICAgICAgPC9CdXR0b24+XG4gICAgICA8L1Nob3c+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQsIEpTWCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4ZXJjaXNlVGVtcGxhdGVQcm9wcyB7XG4gIGluc3RydWN0aW9uVGV4dD86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEV4ZXJjaXNlVGVtcGxhdGU6IENvbXBvbmVudDxFeGVyY2lzZVRlbXBsYXRlUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgaC1mdWxsIGJnLWJhc2UgdGV4dC1wcmltYXJ5JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LWdyb3cgb3ZlcmZsb3cteS1hdXRvIGZsZXggZmxleC1jb2wgcGItMjRcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInctZnVsbCBtYXgtdy0yeGwgbXgtYXV0byBweC00IHB5LThcIj5cbiAgICAgICAgICB7cHJvcHMuaW5zdHJ1Y3Rpb25UZXh0ICYmIChcbiAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1sZyB0ZXh0LW11dGVkLWZvcmVncm91bmQgbWItNCB0ZXh0LWxlZnRcIj5cbiAgICAgICAgICAgICAge3Byb3BzLmluc3RydWN0aW9uVGV4dH1cbiAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICApfVxuICAgICAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVhZEFsb3VkUHJvcHMge1xuICBwcm9tcHQ6IHN0cmluZztcbiAgdXNlclRyYW5zY3JpcHQ/OiBzdHJpbmc7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgUmVhZEFsb3VkOiBDb21wb25lbnQ8UmVhZEFsb3VkUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ3NwYWNlLXktNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8cCBjbGFzcz1cInRleHQtMnhsIHRleHQtbGVmdCBsZWFkaW5nLXJlbGF4ZWRcIj5cbiAgICAgICAge3Byb3BzLnByb21wdH1cbiAgICAgIDwvcD5cbiAgICAgIFxuICAgICAgPFNob3cgd2hlbj17cHJvcHMudXNlclRyYW5zY3JpcHR9PlxuICAgICAgICA8ZGl2IGNsYXNzPVwibXQtOFwiPlxuICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1sZyB0ZXh0LW11dGVkLWZvcmVncm91bmQgbWItNFwiPllvdSBzYWlkOjwvcD5cbiAgICAgICAgICA8cCBjbGFzcz1cInRleHQtMnhsIHRleHQtbGVmdCBsZWFkaW5nLXJlbGF4ZWRcIj5cbiAgICAgICAgICAgIHtwcm9wcy51c2VyVHJhbnNjcmlwdH1cbiAgICAgICAgICA8L3A+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNyZWF0ZVJlc291cmNlLCBTaG93LCBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IFJlYWRBbG91ZCB9IGZyb20gJy4uL1JlYWRBbG91ZCc7XG5pbXBvcnQgeyBQcm9ncmVzc0JhciB9IGZyb20gJy4uLy4uL2NvbW1vbi9Qcm9ncmVzc0Jhcic7XG5pbXBvcnQgeyBQcmFjdGljZUhlYWRlciB9IGZyb20gJy4uL1ByYWN0aWNlSGVhZGVyJztcbmltcG9ydCB7IEV4ZXJjaXNlVGVtcGxhdGUgfSBmcm9tICcuLi9FeGVyY2lzZVRlbXBsYXRlJztcbmltcG9ydCB7IEV4ZXJjaXNlRm9vdGVyIH0gZnJvbSAnLi4vRXhlcmNpc2VGb290ZXInO1xuaW1wb3J0IHsgUmVzcG9uc2VGb290ZXIgfSBmcm9tICcuLi9SZXNwb25zZUZvb3Rlcic7XG5pbXBvcnQgdHlwZSB7IFJlYWRBbG91ZEV4ZXJjaXNlIGFzIEV4ZXJjaXNlIH0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByYWN0aWNlRXhlcmNpc2VWaWV3UHJvcHMge1xuICBzZXNzaW9uSWQ/OiBzdHJpbmc7XG4gIG9uQmFjazogKCkgPT4gdm9pZDtcbiAgYXBpQmFzZVVybD86IHN0cmluZztcbiAgYXV0aFRva2VuPzogc3RyaW5nO1xuICBoZWFkZXJUaXRsZT86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFByYWN0aWNlRXhlcmNpc2VWaWV3OiBDb21wb25lbnQ8UHJhY3RpY2VFeGVyY2lzZVZpZXdQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2N1cnJlbnRFeGVyY2lzZUluZGV4LCBzZXRDdXJyZW50RXhlcmNpc2VJbmRleF0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFtpc1JlY29yZGluZywgc2V0SXNSZWNvcmRpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2lzUHJvY2Vzc2luZywgc2V0SXNQcm9jZXNzaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFt1c2VyVHJhbnNjcmlwdCwgc2V0VXNlclRyYW5zY3JpcHRdID0gY3JlYXRlU2lnbmFsKCcnKTtcbiAgY29uc3QgW2N1cnJlbnRTY29yZSwgc2V0Q3VycmVudFNjb3JlXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW21lZGlhUmVjb3JkZXIsIHNldE1lZGlhUmVjb3JkZXJdID0gY3JlYXRlU2lnbmFsPE1lZGlhUmVjb3JkZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2F1ZGlvQ2h1bmtzLCBzZXRBdWRpb0NodW5rc10gPSBjcmVhdGVTaWduYWw8QmxvYltdPihbXSk7XG4gIGNvbnN0IFtzaG93RmVlZGJhY2ssIHNldFNob3dGZWVkYmFja10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbaXNDb3JyZWN0LCBzZXRJc0NvcnJlY3RdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgXG4gIGNvbnN0IGFwaUJhc2VVcmwgPSAoKSA9PiBwcm9wcy5hcGlCYXNlVXJsIHx8ICdodHRwOi8vbG9jYWxob3N0Ojg3ODcnO1xuICBcbiAgLy8gRmV0Y2ggZXhlcmNpc2VzIGZyb20gdGhlIEFQSVxuICBjb25zdCBbZXhlcmNpc2VzXSA9IGNyZWF0ZVJlc291cmNlKGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgLy8gSW5jbHVkZSBzZXNzaW9uSWQgaWYgcHJvdmlkZWQgdG8gZ2V0IGV4ZXJjaXNlcyBmcm9tIHRoaXMgc2Vzc2lvbiBvbmx5XG4gICAgICBjb25zdCB1cmwgPSBwcm9wcy5zZXNzaW9uSWQgXG4gICAgICAgID8gYCR7YXBpQmFzZVVybCgpfS9hcGkvcHJhY3RpY2UvZXhlcmNpc2VzP2xpbWl0PTEwJnNlc3Npb25JZD0ke3Byb3BzLnNlc3Npb25JZH1gXG4gICAgICAgIDogYCR7YXBpQmFzZVVybCgpfS9hcGkvcHJhY3RpY2UvZXhlcmNpc2VzP2xpbWl0PTEwYDtcbiAgICAgIFxuICAgICAgY29uc3QgaGVhZGVyczogSGVhZGVyc0luaXQgPSB7fTtcbiAgICAgIGlmIChwcm9wcy5hdXRoVG9rZW4pIHtcbiAgICAgICAgaGVhZGVyc1snQXV0aG9yaXphdGlvbiddID0gYEJlYXJlciAke3Byb3BzLmF1dGhUb2tlbn1gO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwgeyBoZWFkZXJzIH0pO1xuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCBlcnJvclRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQcmFjdGljZUV4ZXJjaXNlVmlld10gQVBJIGVycm9yOicsIHJlc3BvbnNlLnN0YXR1cywgZXJyb3JUZXh0KTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gZmV0Y2ggZXhlcmNpc2VzJyk7XG4gICAgICB9XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgXG4gICAgICBpZiAoZGF0YS5kYXRhICYmIGRhdGEuZGF0YS5leGVyY2lzZXMpIHtcbiAgICAgICAgcmV0dXJuIGRhdGEuZGF0YS5leGVyY2lzZXMgYXMgRXhlcmNpc2VbXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBbXTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW1ByYWN0aWNlRXhlcmNpc2VWaWV3XSBGYWlsZWQgdG8gZmV0Y2g6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gTG9nIHdoZW4gZXhlcmNpc2VzIGxvYWRcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBleGVyY2lzZUxpc3QgPSBleGVyY2lzZXMoKTtcbiAgfSk7XG5cbiAgY29uc3QgaGFuZGxlU3RhcnRSZWNvcmRpbmcgPSBhc3luYyAoKSA9PiB7XG4gICAgc2V0VXNlclRyYW5zY3JpcHQoJycpO1xuICAgIHNldEN1cnJlbnRTY29yZShudWxsKTtcbiAgICBzZXRBdWRpb0NodW5rcyhbXSk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN0cmVhbSA9IGF3YWl0IG5hdmlnYXRvci5tZWRpYURldmljZXMuZ2V0VXNlck1lZGlhKHsgXG4gICAgICAgIGF1ZGlvOiB7XG4gICAgICAgICAgZWNob0NhbmNlbGxhdGlvbjogdHJ1ZSxcbiAgICAgICAgICBub2lzZVN1cHByZXNzaW9uOiB0cnVlLFxuICAgICAgICAgIGF1dG9HYWluQ29udHJvbDogdHJ1ZVxuICAgICAgICB9IFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IG1pbWVUeXBlID0gTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQoJ2F1ZGlvL3dlYm07Y29kZWNzPW9wdXMnKSBcbiAgICAgICAgPyAnYXVkaW8vd2VibTtjb2RlY3M9b3B1cycgXG4gICAgICAgIDogJ2F1ZGlvL3dlYm0nO1xuICAgICAgICBcbiAgICAgIGNvbnN0IHJlY29yZGVyID0gbmV3IE1lZGlhUmVjb3JkZXIoc3RyZWFtLCB7IG1pbWVUeXBlIH0pO1xuICAgICAgY29uc3QgY2h1bmtzOiBCbG9iW10gPSBbXTtcbiAgICAgIFxuICAgICAgcmVjb3JkZXIub25kYXRhYXZhaWxhYmxlID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIGlmIChldmVudC5kYXRhLnNpemUgPiAwKSB7XG4gICAgICAgICAgY2h1bmtzLnB1c2goZXZlbnQuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBcbiAgICAgIHJlY29yZGVyLm9uc3RvcCA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgYXVkaW9CbG9iID0gbmV3IEJsb2IoY2h1bmtzLCB7IHR5cGU6IG1pbWVUeXBlIH0pO1xuICAgICAgICBhd2FpdCBwcm9jZXNzUmVjb3JkaW5nKGF1ZGlvQmxvYik7XG4gICAgICAgIFxuICAgICAgICAvLyBTdG9wIGFsbCB0cmFja3NcbiAgICAgICAgc3RyZWFtLmdldFRyYWNrcygpLmZvckVhY2godHJhY2sgPT4gdHJhY2suc3RvcCgpKTtcbiAgICAgIH07XG4gICAgICBcbiAgICAgIHJlY29yZGVyLnN0YXJ0KCk7XG4gICAgICBzZXRNZWRpYVJlY29yZGVyKHJlY29yZGVyKTtcbiAgICAgIHNldElzUmVjb3JkaW5nKHRydWUpO1xuICAgICAgXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQcmFjdGljZUV4ZXJjaXNlVmlld10gRmFpbGVkIHRvIHN0YXJ0IHJlY29yZGluZzonLCBlcnJvcik7XG4gICAgICBzZXRJc1JlY29yZGluZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IHByb2Nlc3NSZWNvcmRpbmcgPSBhc3luYyAoYmxvYjogQmxvYikgPT4ge1xuICAgIHRyeSB7XG4gICAgICBzZXRJc1Byb2Nlc3NpbmcodHJ1ZSk7XG4gICAgICBcbiAgICAgIC8vIENvbnZlcnQgdG8gYmFzZTY0IGZvciBBUElcbiAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICBjb25zdCBiYXNlNjQgPSBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgYmFzZTY0U3RyaW5nID0gcmVhZGVyLnJlc3VsdCBhcyBzdHJpbmc7XG4gICAgICAgICAgcmVzb2x2ZShiYXNlNjRTdHJpbmcuc3BsaXQoJywnKVsxXSk7XG4gICAgICAgIH07XG4gICAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKGJsb2IpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIFNlbmQgdG8gU1RUIEFQSSB3aXRoIHJldHJ5IGxvZ2ljXG4gICAgICBsZXQgcmVzcG9uc2U7XG4gICAgICBsZXQgYXR0ZW1wdHMgPSAwO1xuICAgICAgY29uc3QgbWF4QXR0ZW1wdHMgPSAyO1xuICAgICAgXG4gICAgICBjb25zdCBoZWFkZXJzOiBIZWFkZXJzSW5pdCA9IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9O1xuICAgICAgaWYgKHByb3BzLmF1dGhUb2tlbikge1xuICAgICAgICBoZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSBgQmVhcmVyICR7cHJvcHMuYXV0aFRva2VufWA7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHdoaWxlIChhdHRlbXB0cyA8IG1heEF0dGVtcHRzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHthcGlCYXNlVXJsKCl9L2FwaS9zcGVlY2gtdG8tdGV4dC90cmFuc2NyaWJlYCwge1xuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICBoZWFkZXJzLFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBcbiAgICAgICAgICAgICAgYXVkaW9CYXNlNjQ6IGJhc2U2NCxcbiAgICAgICAgICAgICAgZXhwZWN0ZWRUZXh0OiBjdXJyZW50RXhlcmNpc2UoKT8uZnVsbF9saW5lLFxuICAgICAgICAgICAgICAvLyBVc2UgRGVlcGdyYW0gb24gcmV0cnlcbiAgICAgICAgICAgICAgcHJlZmVyRGVlcGdyYW06IGF0dGVtcHRzID4gMFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZmV0Y2hFcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtQcmFjdGljZUV4ZXJjaXNlVmlld10gU1RUIGF0dGVtcHQgJHthdHRlbXB0cyArIDF9IGZhaWxlZDpgLCBmZXRjaEVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXR0ZW1wdHMrKztcbiAgICAgICAgaWYgKGF0dGVtcHRzIDwgbWF4QXR0ZW1wdHMpIHtcbiAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgNTAwKSk7IC8vIFNtYWxsIGRlbGF5IGJlZm9yZSByZXRyeVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIHNldFVzZXJUcmFuc2NyaXB0KHJlc3VsdC5kYXRhLnRyYW5zY3JpcHQpO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2FsY3VsYXRlIGEgc2ltcGxlIHNjb3JlIGJhc2VkIG9uIG1hdGNoaW5nIHdvcmRzXG4gICAgICAgIGNvbnN0IHNjb3JlID0gY2FsY3VsYXRlU2NvcmUoY3VycmVudEV4ZXJjaXNlKCk/LmZ1bGxfbGluZSB8fCAnJywgcmVzdWx0LmRhdGEudHJhbnNjcmlwdCk7XG4gICAgICAgIHNldEN1cnJlbnRTY29yZShzY29yZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBBdXRvbWF0aWNhbGx5IHN1Ym1pdCBhZnRlciB0cmFuc2NyaXB0aW9uXG4gICAgICAgIGF3YWl0IGhhbmRsZUF1dG9TdWJtaXQoc2NvcmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTVFQgZmFpbGVkIGFmdGVyIHJldHJpZXMnKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW1ByYWN0aWNlRXhlcmNpc2VWaWV3XSBGYWlsZWQgdG8gcHJvY2VzcyByZWNvcmRpbmc6JywgZXJyb3IpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRJc1Byb2Nlc3NpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVTdG9wUmVjb3JkaW5nID0gKCkgPT4ge1xuICAgIGNvbnN0IHJlY29yZGVyID0gbWVkaWFSZWNvcmRlcigpO1xuICAgIGlmIChyZWNvcmRlciAmJiByZWNvcmRlci5zdGF0ZSAhPT0gJ2luYWN0aXZlJykge1xuICAgICAgcmVjb3JkZXIuc3RvcCgpO1xuICAgICAgc2V0SXNSZWNvcmRpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBjYWxjdWxhdGVTY29yZSA9IChleHBlY3RlZDogc3RyaW5nLCBhY3R1YWw6IHN0cmluZyk6IG51bWJlciA9PiB7XG4gICAgY29uc3QgZXhwZWN0ZWRXb3JkcyA9IGV4cGVjdGVkLnRvTG93ZXJDYXNlKCkuc3BsaXQoL1xccysvKTtcbiAgICBjb25zdCBhY3R1YWxXb3JkcyA9IGFjdHVhbC50b0xvd2VyQ2FzZSgpLnNwbGl0KC9cXHMrLyk7XG4gICAgbGV0IG1hdGNoZXMgPSAwO1xuICAgIFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwZWN0ZWRXb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFjdHVhbFdvcmRzW2ldID09PSBleHBlY3RlZFdvcmRzW2ldKSB7XG4gICAgICAgIG1hdGNoZXMrKztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIE1hdGgucm91bmQoKG1hdGNoZXMgLyBleHBlY3RlZFdvcmRzLmxlbmd0aCkgKiAxMDApO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUF1dG9TdWJtaXQgPSBhc3luYyAoc2NvcmU6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IGN1cnJlbnRFeGVyY2lzZSA9IGV4ZXJjaXNlcygpPy5bY3VycmVudEV4ZXJjaXNlSW5kZXgoKV07XG4gICAgY29uc3QgY2h1bmtzID0gYXVkaW9DaHVua3MoKTtcbiAgICBjb25zdCBibG9iID0gY2h1bmtzLmxlbmd0aCA+IDAgPyBuZXcgQmxvYihjaHVua3MsIHsgdHlwZTogJ2F1ZGlvL3dlYm0nIH0pIDogbnVsbDtcbiAgICBcbiAgICAvLyBEZXRlcm1pbmUgaWYgY29ycmVjdCAoODAlIG9yIGhpZ2hlcilcbiAgICBzZXRJc0NvcnJlY3Qoc2NvcmUgPj0gODApO1xuICAgIHNldFNob3dGZWVkYmFjayh0cnVlKTtcbiAgICBcbiAgICBpZiAoY3VycmVudEV4ZXJjaXNlICYmIGN1cnJlbnRFeGVyY2lzZS5jYXJkX2lkcy5sZW5ndGggPiAwICYmIGJsb2IpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIENvbnZlcnQgYXVkaW8gdG8gYmFzZTY0XG4gICAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICAgIGNvbnN0IGJhc2U2NCA9IGF3YWl0IG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICByZWFkZXIub25sb2FkZW5kID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYmFzZTY0U3RyaW5nID0gcmVhZGVyLnJlc3VsdCBhcyBzdHJpbmc7XG4gICAgICAgICAgICByZXNvbHZlKGJhc2U2NFN0cmluZy5zcGxpdCgnLCcpWzFdKTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKGJsb2IpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBoZWFkZXJzOiBIZWFkZXJzSW5pdCA9IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9O1xuICAgICAgICBpZiAocHJvcHMuYXV0aFRva2VuKSB7XG4gICAgICAgICAgaGVhZGVyc1snQXV0aG9yaXphdGlvbiddID0gYEJlYXJlciAke3Byb3BzLmF1dGhUb2tlbn1gO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3VibWl0IHJldmlld1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke2FwaUJhc2VVcmwoKX0vYXBpL3ByYWN0aWNlL3Jldmlld2AsIHtcbiAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICBoZWFkZXJzLFxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGV4ZXJjaXNlSWQ6IGN1cnJlbnRFeGVyY2lzZS5pZCxcbiAgICAgICAgICAgIGF1ZGlvQmFzZTY0OiBiYXNlNjQsXG4gICAgICAgICAgICBjYXJkU2NvcmVzOiBjdXJyZW50RXhlcmNpc2UuY2FyZF9pZHMubWFwKGNhcmRJZCA9PiAoe1xuICAgICAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgICAgIHNjb3JlXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgICB9KVxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW1ByYWN0aWNlRXhlcmNpc2VWaWV3XSBGYWlsZWQgdG8gc3VibWl0IHJldmlldzonLCBlcnJvcik7XG4gICAgICB9XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgaGFuZGxlU3VibWl0ID0gYXN5bmMgKCkgPT4ge1xuICAgIC8vIFRoaXMgaXMgbm93IG9ubHkgdXNlZCBhcyBmYWxsYmFjayBpZiBuZWVkZWRcbiAgICBjb25zdCBzY29yZSA9IGN1cnJlbnRTY29yZSgpO1xuICAgIGlmIChzY29yZSAhPT0gbnVsbCkge1xuICAgICAgYXdhaXQgaGFuZGxlQXV0b1N1Ym1pdChzY29yZSk7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgaGFuZGxlQ29udGludWUgPSAoKSA9PiB7XG4gICAgLy8gTW92ZSB0byBuZXh0IGV4ZXJjaXNlXG4gICAgaWYgKGN1cnJlbnRFeGVyY2lzZUluZGV4KCkgPCAoZXhlcmNpc2VzKCk/Lmxlbmd0aCB8fCAwKSAtIDEpIHtcbiAgICAgIHNldEN1cnJlbnRFeGVyY2lzZUluZGV4KGN1cnJlbnRFeGVyY2lzZUluZGV4KCkgKyAxKTtcbiAgICAgIHNldFVzZXJUcmFuc2NyaXB0KCcnKTtcbiAgICAgIHNldEN1cnJlbnRTY29yZShudWxsKTtcbiAgICAgIHNldEF1ZGlvQ2h1bmtzKFtdKTtcbiAgICAgIHNldFNob3dGZWVkYmFjayhmYWxzZSk7XG4gICAgICBzZXRJc0NvcnJlY3QoZmFsc2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBBbGwgZXhlcmNpc2VzIGNvbXBsZXRlZFxuICAgICAgcHJvcHMub25CYWNrKCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVNraXAgPSAoKSA9PiB7XG4gICAgXG4gICAgLy8gTW92ZSB0byBuZXh0IGV4ZXJjaXNlXG4gICAgaWYgKGN1cnJlbnRFeGVyY2lzZUluZGV4KCkgPCAoZXhlcmNpc2VzKCk/Lmxlbmd0aCB8fCAwKSAtIDEpIHtcbiAgICAgIHNldEN1cnJlbnRFeGVyY2lzZUluZGV4KGN1cnJlbnRFeGVyY2lzZUluZGV4KCkgKyAxKTtcbiAgICAgIHNldFVzZXJUcmFuc2NyaXB0KCcnKTtcbiAgICAgIHNldEN1cnJlbnRTY29yZShudWxsKTtcbiAgICAgIHNldEF1ZGlvQ2h1bmtzKFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQWxsIGV4ZXJjaXNlcyBjb21wbGV0ZWRcbiAgICAgIHByb3BzLm9uQmFjaygpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBjdXJyZW50RXhlcmNpc2UgPSAoKSA9PiBleGVyY2lzZXMoKT8uW2N1cnJlbnRFeGVyY2lzZUluZGV4KCldO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz1cImgtZnVsbCBiZy1iYXNlIGZsZXggZmxleC1jb2xcIj5cbiAgICAgIDxTaG93XG4gICAgICAgIHdoZW49eyFleGVyY2lzZXMubG9hZGluZ31cbiAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXJcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYW5pbWF0ZS1zcGluIHJvdW5kZWQtZnVsbCBoLTEyIHctMTIgYm9yZGVyLWItMiBib3JkZXItYWNjZW50LXByaW1hcnkgbXgtYXV0byBtYi00XCI+PC9kaXY+XG4gICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1tdXRlZC1mb3JlZ3JvdW5kXCI+TG9hZGluZyBleGVyY2lzZXMuLi48L3A+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgfVxuICAgICAgPlxuICAgICAgICA8U2hvd1xuICAgICAgICAgIHdoZW49eyhleGVyY2lzZXMoKSB8fCBbXSkubGVuZ3RoID4gMH1cbiAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHAtOFwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgbWF4LXctbWRcIj5cbiAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1tdXRlZC1mb3JlZ3JvdW5kIG1iLTRcIj5ObyBwcmFjdGljZSBleGVyY2lzZXMgYXZhaWxhYmxlIHlldC48L3A+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtbXV0ZWQtZm9yZWdyb3VuZFwiPkNvbXBsZXRlIGthcmFva2Ugc2Vzc2lvbnMgd2l0aCBlcnJvcnMgdG8gZ2VuZXJhdGUgcGVyc29uYWxpemVkIGV4ZXJjaXNlcyE8L3A+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgfVxuICAgICAgICA+XG4gICAgICAgICAgPFNob3cgd2hlbj17Y3VycmVudEV4ZXJjaXNlKCl9PlxuICAgICAgICAgICAgeyhleGVyY2lzZSkgPT4gKFxuICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgIDxQcm9ncmVzc0JhciBcbiAgICAgICAgICAgICAgICAgIGN1cnJlbnQ9e2N1cnJlbnRFeGVyY2lzZUluZGV4KCkgKyAxfSBcbiAgICAgICAgICAgICAgICAgIHRvdGFsPXtleGVyY2lzZXMoKT8ubGVuZ3RoIHx8IDB9IFxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgPFByYWN0aWNlSGVhZGVyIFxuICAgICAgICAgICAgICAgICAgdGl0bGU9e3Byb3BzLmhlYWRlclRpdGxlIHx8IFwiXCJ9IFxuICAgICAgICAgICAgICAgICAgb25FeGl0PXtwcm9wcy5vbkJhY2t9IFxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgPG1haW4gY2xhc3M9XCJmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgIDxFeGVyY2lzZVRlbXBsYXRlIGluc3RydWN0aW9uVGV4dD1cIlJlYWQgYWxvdWQ6XCI+XG4gICAgICAgICAgICAgICAgICAgIDxSZWFkQWxvdWRcbiAgICAgICAgICAgICAgICAgICAgICBwcm9tcHQ9e2V4ZXJjaXNlKCkuZnVsbF9saW5lfVxuICAgICAgICAgICAgICAgICAgICAgIHVzZXJUcmFuc2NyaXB0PXt1c2VyVHJhbnNjcmlwdCgpfVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgPC9FeGVyY2lzZVRlbXBsYXRlPlxuICAgICAgICAgICAgICAgIDwvbWFpbj5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICA8U2hvd1xuICAgICAgICAgICAgICAgICAgd2hlbj17c2hvd0ZlZWRiYWNrKCl9XG4gICAgICAgICAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICAgIDxFeGVyY2lzZUZvb3RlclxuICAgICAgICAgICAgICAgICAgICAgIGlzUmVjb3JkaW5nPXtpc1JlY29yZGluZygpfVxuICAgICAgICAgICAgICAgICAgICAgIGlzUHJvY2Vzc2luZz17aXNQcm9jZXNzaW5nKCl9XG4gICAgICAgICAgICAgICAgICAgICAgY2FuU3VibWl0PXt1c2VyVHJhbnNjcmlwdCgpLnRyaW0oKS5sZW5ndGggPiAwfVxuICAgICAgICAgICAgICAgICAgICAgIG9uUmVjb3JkPXtoYW5kbGVTdGFydFJlY29yZGluZ31cbiAgICAgICAgICAgICAgICAgICAgICBvblN0b3A9e2hhbmRsZVN0b3BSZWNvcmRpbmd9XG4gICAgICAgICAgICAgICAgICAgICAgb25TdWJtaXQ9e2hhbmRsZVN1Ym1pdH1cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8UmVzcG9uc2VGb290ZXJcbiAgICAgICAgICAgICAgICAgICAgbW9kZT1cImZlZWRiYWNrXCJcbiAgICAgICAgICAgICAgICAgICAgaXNDb3JyZWN0PXtpc0NvcnJlY3QoKX1cbiAgICAgICAgICAgICAgICAgICAgb25Db250aW51ZT17aGFuZGxlQ29udGludWV9XG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgPC9TaG93PlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IFNob3csIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuaW1wb3J0IHsgVXNlclByb2ZpbGUgfSBmcm9tICcuLi9Vc2VyUHJvZmlsZSc7XG5pbXBvcnQgeyBDcmVkaXRQYWNrIH0gZnJvbSAnLi4vQ3JlZGl0UGFjayc7XG5pbXBvcnQgeyBXYWxsZXRDb25uZWN0IH0gZnJvbSAnLi4vV2FsbGV0Q29ubmVjdCc7XG5pbXBvcnQgeyBGYXJjYXN0ZXJLYXJhb2tlVmlldyB9IGZyb20gJy4uLy4uL2thcmFva2UvRmFyY2FzdGVyS2FyYW9rZVZpZXcnO1xuaW1wb3J0IHR5cGUgeyBMeXJpY0xpbmUgfSBmcm9tICcuLi8uLi9rYXJhb2tlL0x5cmljc0Rpc3BsYXknO1xuaW1wb3J0IHR5cGUgeyBMZWFkZXJib2FyZEVudHJ5IH0gZnJvbSAnLi4vLi4va2FyYW9rZS9MZWFkZXJib2FyZFBhbmVsJztcblxuZXhwb3J0IGludGVyZmFjZSBGYXJjYXN0ZXJNaW5pQXBwUHJvcHMge1xuICAvLyBVc2VyIGluZm9cbiAgdXNlcj86IHtcbiAgICBmaWQ/OiBudW1iZXI7XG4gICAgdXNlcm5hbWU/OiBzdHJpbmc7XG4gICAgZGlzcGxheU5hbWU/OiBzdHJpbmc7XG4gICAgcGZwVXJsPzogc3RyaW5nO1xuICB9O1xuICBcbiAgLy8gV2FsbGV0XG4gIHdhbGxldEFkZHJlc3M/OiBzdHJpbmc7XG4gIHdhbGxldENoYWluPzogJ0Jhc2UnIHwgJ1NvbGFuYSc7XG4gIGlzV2FsbGV0Q29ubmVjdGVkPzogYm9vbGVhbjtcbiAgXG4gIC8vIENyZWRpdHNcbiAgdXNlckNyZWRpdHM/OiBudW1iZXI7XG4gIFxuICAvLyBDYWxsYmFja3NcbiAgb25Db25uZWN0V2FsbGV0PzogKCkgPT4gdm9pZDtcbiAgb25EaXNjb25uZWN0V2FsbGV0PzogKCkgPT4gdm9pZDtcbiAgb25QdXJjaGFzZUNyZWRpdHM/OiAocGFjazogeyBjcmVkaXRzOiBudW1iZXI7IHByaWNlOiBzdHJpbmc7IGN1cnJlbmN5OiBzdHJpbmcgfSkgPT4gdm9pZDtcbiAgb25TZWxlY3RTb25nPzogKCkgPT4gdm9pZDtcbiAgXG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgRmFyY2FzdGVyTWluaUFwcDogQ29tcG9uZW50PEZhcmNhc3Rlck1pbmlBcHBQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW3Nob3dLYXJhb2tlLCBzZXRTaG93S2FyYW9rZV0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBcbiAgLy8gTW9jayBkYXRhIGZvciBkZW1vXG4gIGNvbnN0IG1vY2tMeXJpY3M6IEx5cmljTGluZVtdID0gW1xuICAgIHsgaWQ6ICcxJywgdGV4dDogXCJJcyB0aGlzIHRoZSByZWFsIGxpZmU/XCIsIHN0YXJ0VGltZTogMCwgZHVyYXRpb246IDIwMDAgfSxcbiAgICB7IGlkOiAnMicsIHRleHQ6IFwiSXMgdGhpcyBqdXN0IGZhbnRhc3k/XCIsIHN0YXJ0VGltZTogMjAwMCwgZHVyYXRpb246IDIwMDAgfSxcbiAgICB7IGlkOiAnMycsIHRleHQ6IFwiQ2F1Z2h0IGluIGEgbGFuZHNsaWRlXCIsIHN0YXJ0VGltZTogNDAwMCwgZHVyYXRpb246IDIwMDAgfSxcbiAgICB7IGlkOiAnNCcsIHRleHQ6IFwiTm8gZXNjYXBlIGZyb20gcmVhbGl0eVwiLCBzdGFydFRpbWU6IDYwMDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gIF07XG4gIFxuICBjb25zdCBtb2NrTGVhZGVyYm9hcmQ6IExlYWRlcmJvYXJkRW50cnlbXSA9IFtcbiAgICB7IHJhbms6IDEsIHVzZXJuYW1lOiBcImFsaWNlXCIsIHNjb3JlOiA5ODAgfSxcbiAgICB7IHJhbms6IDIsIHVzZXJuYW1lOiBcImJvYlwiLCBzY29yZTogOTQ1IH0sXG4gICAgeyByYW5rOiAzLCB1c2VybmFtZTogXCJjYXJvbFwiLCBzY29yZTogOTIwIH0sXG4gIF07XG5cbiAgY29uc3QgY3JlZGl0UGFja3MgPSBbXG4gICAgeyBjcmVkaXRzOiAyNTAsIHByaWNlOiAnMi41MCcsIGN1cnJlbmN5OiAnVVNEQycgYXMgY29uc3QgfSxcbiAgICB7IGNyZWRpdHM6IDUwMCwgcHJpY2U6ICc0Ljc1JywgY3VycmVuY3k6ICdVU0RDJyBhcyBjb25zdCwgZGlzY291bnQ6IDUsIHJlY29tbWVuZGVkOiB0cnVlIH0sXG4gICAgeyBjcmVkaXRzOiAxMjAwLCBwcmljZTogJzEwLjAwJywgY3VycmVuY3k6ICdVU0RDJyBhcyBjb25zdCwgZGlzY291bnQ6IDE2IH0sXG4gIF07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZmxleCBmbGV4LWNvbCBoLXNjcmVlbiBiZy1iYXNlJywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBIZWFkZXIgd2l0aCB1c2VyIHByb2ZpbGUgKi99XG4gICAgICA8ZGl2IGNsYXNzPVwiYmctc3VyZmFjZSBib3JkZXItYiBib3JkZXItc3VidGxlXCI+XG4gICAgICAgIDxVc2VyUHJvZmlsZVxuICAgICAgICAgIGZpZD17cHJvcHMudXNlcj8uZmlkfVxuICAgICAgICAgIHVzZXJuYW1lPXtwcm9wcy51c2VyPy51c2VybmFtZX1cbiAgICAgICAgICBkaXNwbGF5TmFtZT17cHJvcHMudXNlcj8uZGlzcGxheU5hbWV9XG4gICAgICAgICAgcGZwVXJsPXtwcm9wcy51c2VyPy5wZnBVcmx9XG4gICAgICAgICAgY3JlZGl0cz17cHJvcHMudXNlckNyZWRpdHMgfHwgMH1cbiAgICAgICAgLz5cbiAgICAgIDwvZGl2PlxuICAgICAgXG4gICAgICB7LyogTWFpbiBjb250ZW50ICovfVxuICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBvdmVyZmxvdy1hdXRvXCI+XG4gICAgICAgIDxTaG93XG4gICAgICAgICAgd2hlbj17c2hvd0thcmFva2UoKX1cbiAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwicC00IHNwYWNlLXktNlwiPlxuICAgICAgICAgICAgICB7LyogSGVybyBzZWN0aW9uICovfVxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgcHktOFwiPlxuICAgICAgICAgICAgICAgIDxoMSBjbGFzcz1cInRleHQtM3hsIGZvbnQtYm9sZCBtYi0yXCI+U2NhcmxldHQgS2FyYW9rZTwvaDE+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNlY29uZGFyeVwiPlxuICAgICAgICAgICAgICAgICAgU2luZyB5b3VyIGZhdm9yaXRlIHNvbmdzIGFuZCBjb21wZXRlIHdpdGggZnJpZW5kcyFcbiAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgey8qIENyZWRpdHMgY2hlY2sgKi99XG4gICAgICAgICAgICAgIDxTaG93XG4gICAgICAgICAgICAgICAgd2hlbj17cHJvcHMudXNlckNyZWRpdHMgJiYgcHJvcHMudXNlckNyZWRpdHMgPiAwfVxuICAgICAgICAgICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LTZcIj5cbiAgICAgICAgICAgICAgICAgICAgey8qIFdhbGxldCBjb25uZWN0aW9uICovfVxuICAgICAgICAgICAgICAgICAgICA8V2FsbGV0Q29ubmVjdFxuICAgICAgICAgICAgICAgICAgICAgIGFkZHJlc3M9e3Byb3BzLndhbGxldEFkZHJlc3N9XG4gICAgICAgICAgICAgICAgICAgICAgY2hhaW49e3Byb3BzLndhbGxldENoYWlufVxuICAgICAgICAgICAgICAgICAgICAgIGlzQ29ubmVjdGVkPXtwcm9wcy5pc1dhbGxldENvbm5lY3RlZH1cbiAgICAgICAgICAgICAgICAgICAgICBvbkNvbm5lY3Q9e3Byb3BzLm9uQ29ubmVjdFdhbGxldH1cbiAgICAgICAgICAgICAgICAgICAgICBvbkRpc2Nvbm5lY3Q9e3Byb3BzLm9uRGlzY29ubmVjdFdhbGxldH1cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHsvKiBDcmVkaXQgcGFja3MgKi99XG4gICAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmlzV2FsbGV0Q29ubmVjdGVkfT5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC14bCBmb250LXNlbWlib2xkIG1iLTRcIj5QdXJjaGFzZSBDcmVkaXRzPC9oMj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJncmlkIGdyaWQtY29scy0xIG1kOmdyaWQtY29scy0zIGdhcC00XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtjcmVkaXRQYWNrcy5tYXAoKHBhY2spID0+IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Q3JlZGl0UGFja1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgey4uLnBhY2t9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvblB1cmNoYXNlPXsoKSA9PiBwcm9wcy5vblB1cmNoYXNlQ3JlZGl0cz8uKHBhY2spfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIHsvKiBTb25nIHNlbGVjdGlvbiAqL31cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS00XCI+XG4gICAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LXhsIGZvbnQtc2VtaWJvbGRcIj5TZWxlY3QgYSBTb25nPC9oMj5cbiAgICAgICAgICAgICAgICAgIDxidXR0b24gXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIHAtNCBiZy1zdXJmYWNlIHJvdW5kZWQtbGcgYm9yZGVyIGJvcmRlci1zdWJ0bGUgaG92ZXI6Ym9yZGVyLWFjY2VudC1wcmltYXJ5IHRyYW5zaXRpb24tY29sb3JzIHRleHQtbGVmdFwiXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dLYXJhb2tlKHRydWUpfVxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZm9udC1zZW1pYm9sZFwiPkJvaGVtaWFuIFJoYXBzb2R5PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtc2Vjb25kYXJ5XCI+UXVlZW48L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQteHMgdGV4dC10ZXJ0aWFyeSBtdC0xXCI+Q29zdDogNTAgY3JlZGl0czwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIH1cbiAgICAgICAgPlxuICAgICAgICAgIDxGYXJjYXN0ZXJLYXJhb2tlVmlld1xuICAgICAgICAgICAgc29uZ1RpdGxlPVwiQm9oZW1pYW4gUmhhcHNvZHlcIlxuICAgICAgICAgICAgYXJ0aXN0PVwiUXVlZW5cIlxuICAgICAgICAgICAgc2NvcmU9ezB9XG4gICAgICAgICAgICByYW5rPXsxfVxuICAgICAgICAgICAgbHlyaWNzPXttb2NrTHlyaWNzfVxuICAgICAgICAgICAgY3VycmVudFRpbWU9ezB9XG4gICAgICAgICAgICBsZWFkZXJib2FyZD17bW9ja0xlYWRlcmJvYXJkfVxuICAgICAgICAgICAgaXNQbGF5aW5nPXtmYWxzZX1cbiAgICAgICAgICAgIG9uU3RhcnQ9eygpID0+IGNvbnNvbGUubG9nKCdTdGFydCBrYXJhb2tlJyl9XG4gICAgICAgICAgICBvblNwZWVkQ2hhbmdlPXsoc3BlZWQpID0+IGNvbnNvbGUubG9nKCdTcGVlZDonLCBzcGVlZCl9XG4gICAgICAgICAgICBvbkJhY2s9eygpID0+IHNldFNob3dLYXJhb2tlKGZhbHNlKX1cbiAgICAgICAgICAvPlxuICAgICAgICA8L1Nob3c+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBGb3IgfSBmcm9tICdzb2xpZC1qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU29uZyB7XG4gIGlkOiBzdHJpbmc7XG4gIHRyYWNrSWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgYXJ0aXN0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSG9tZVBhZ2VQcm9wcyB7XG4gIHNvbmdzOiBTb25nW107XG4gIG9uU29uZ1NlbGVjdD86IChzb25nOiBTb25nKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgSG9tZVBhZ2U6IENvbXBvbmVudDxIb21lUGFnZVByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBzb25nSXRlbVN0eWxlID0ge1xuICAgIHBhZGRpbmc6ICcxNnB4JyxcbiAgICAnbWFyZ2luLWJvdHRvbSc6ICc4cHgnLFxuICAgICdiYWNrZ3JvdW5kLWNvbG9yJzogJyMxYTFhMWEnLFxuICAgICdib3JkZXItcmFkaXVzJzogJzhweCcsXG4gICAgY3Vyc29yOiAncG9pbnRlcidcbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXY+XG4gICAgICA8ZGl2IHN0eWxlPXt7IHBhZGRpbmc6ICcxNnB4JywgJ2JhY2tncm91bmQtY29sb3InOiAnIzFhMWExYScgfX0+XG4gICAgICAgIDxoMSBzdHlsZT17eyBtYXJnaW46ICcwIDAgOHB4IDAnLCAnZm9udC1zaXplJzogJzI0cHgnIH19PlBvcHVsYXIgU29uZ3M8L2gxPlxuICAgICAgICA8cCBzdHlsZT17eyBtYXJnaW46ICcwJywgY29sb3I6ICcjODg4JyB9fT5DaG9vc2UgYSBzb25nIHRvIHN0YXJ0IHNpbmdpbmc8L3A+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAnMTZweCcgfX0+XG4gICAgICAgIDxGb3IgZWFjaD17cHJvcHMuc29uZ3N9PlxuICAgICAgICAgIHsoc29uZywgaW5kZXgpID0+IChcbiAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgIHN0eWxlPXtzb25nSXRlbVN0eWxlfVxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBwcm9wcy5vblNvbmdTZWxlY3Q/Lihzb25nKX1cbiAgICAgICAgICAgICAgb25Nb3VzZUVudGVyPXsoZSkgPT4gZS5jdXJyZW50VGFyZ2V0LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcjMmEyYTJhJ31cbiAgICAgICAgICAgICAgb25Nb3VzZUxlYXZlPXsoZSkgPT4gZS5jdXJyZW50VGFyZ2V0LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcjMWExYTFhJ31cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnZmxleCcsIGdhcDogJzE2cHgnIH19PlxuICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IGNvbG9yOiAnIzY2NicgfX0+e2luZGV4KCkgKyAxfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyAnZm9udC13ZWlnaHQnOiAnYm9sZCcgfX0+e3NvbmcudGl0bGV9PC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGNvbG9yOiAnIzg4OCcgfX0+e3NvbmcuYXJ0aXN0fTwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvRm9yPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCwgb25DbGVhbnVwIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBMeXJpY0xpbmUgfSBmcm9tICcuLi9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheSc7XG5pbXBvcnQgeyBjcmVhdGVLYXJhb2tlQXVkaW9Qcm9jZXNzb3IgfSBmcm9tICcuLi9zZXJ2aWNlcy9hdWRpby9rYXJhb2tlQXVkaW9Qcm9jZXNzb3InO1xuaW1wb3J0IHsgc2hvdWxkQ2h1bmtMaW5lcywgY2FsY3VsYXRlUmVjb3JkaW5nRHVyYXRpb24gfSBmcm9tICcuLi9zZXJ2aWNlcy9rYXJhb2tlL2NodW5raW5nVXRpbHMnO1xuaW1wb3J0IHsgS2FyYW9rZUFwaVNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9rYXJhb2tlL2thcmFva2VBcGknO1xuaW1wb3J0IHR5cGUgeyBDaHVua0luZm8gfSBmcm9tICdAc2NhcmxldHQvY29yZSc7XG5pbXBvcnQgdHlwZSB7IFBsYXliYWNrU3BlZWQgfSBmcm9tICcuLi9jb21wb25lbnRzL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVXNlS2FyYW9rZVNlc3Npb25PcHRpb25zIHtcbiAgbHlyaWNzOiBMeXJpY0xpbmVbXTtcbiAgb25Db21wbGV0ZT86IChyZXN1bHRzOiBLYXJhb2tlUmVzdWx0cykgPT4gdm9pZDtcbiAgYXVkaW9FbGVtZW50PzogSFRNTEF1ZGlvRWxlbWVudDtcbiAgdHJhY2tJZD86IHN0cmluZztcbiAgc29uZ0RhdGE/OiB7XG4gICAgdGl0bGU6IHN0cmluZztcbiAgICBhcnRpc3Q6IHN0cmluZztcbiAgICBhbGJ1bT86IHN0cmluZztcbiAgICBkdXJhdGlvbj86IG51bWJlcjtcbiAgfTtcbiAgc29uZ0NhdGFsb2dJZD86IHN0cmluZztcbiAgYXBpVXJsPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEthcmFva2VSZXN1bHRzIHtcbiAgc2NvcmU6IG51bWJlcjtcbiAgYWNjdXJhY3k6IG51bWJlcjtcbiAgdG90YWxMaW5lczogbnVtYmVyO1xuICBwZXJmZWN0TGluZXM6IG51bWJlcjtcbiAgZ29vZExpbmVzOiBudW1iZXI7XG4gIG5lZWRzV29ya0xpbmVzOiBudW1iZXI7XG4gIHNlc3Npb25JZD86IHN0cmluZztcbiAgaXNMb2FkaW5nPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMaW5lU2NvcmUge1xuICBsaW5lSW5kZXg6IG51bWJlcjtcbiAgc2NvcmU6IG51bWJlcjtcbiAgdHJhbnNjcmlwdGlvbjogc3RyaW5nO1xuICBmZWVkYmFjaz86IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUthcmFva2VTZXNzaW9uKG9wdGlvbnM6IFVzZUthcmFva2VTZXNzaW9uT3B0aW9ucykge1xuICBjb25zdCBbaXNQbGF5aW5nLCBzZXRJc1BsYXlpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2N1cnJlbnRUaW1lLCBzZXRDdXJyZW50VGltZV0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFtzY29yZSwgc2V0U2NvcmVdID0gY3JlYXRlU2lnbmFsKDApO1xuICBjb25zdCBbY291bnRkb3duLCBzZXRDb3VudGRvd25dID0gY3JlYXRlU2lnbmFsPG51bWJlciB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbc2Vzc2lvbklkLCBzZXRTZXNzaW9uSWRdID0gY3JlYXRlU2lnbmFsPHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbbGluZVNjb3Jlcywgc2V0TGluZVNjb3Jlc10gPSBjcmVhdGVTaWduYWw8TGluZVNjb3JlW10+KFtdKTtcbiAgY29uc3QgW2N1cnJlbnRDaHVuaywgc2V0Q3VycmVudENodW5rXSA9IGNyZWF0ZVNpZ25hbDxDaHVua0luZm8gfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2lzUmVjb3JkaW5nLCBzZXRJc1JlY29yZGluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbYXVkaW9FbGVtZW50LCBzZXRBdWRpb0VsZW1lbnRdID0gY3JlYXRlU2lnbmFsPEhUTUxBdWRpb0VsZW1lbnQgfCB1bmRlZmluZWQ+KG9wdGlvbnMuYXVkaW9FbGVtZW50KTtcbiAgY29uc3QgW3JlY29yZGVkQ2h1bmtzLCBzZXRSZWNvcmRlZENodW5rc10gPSBjcmVhdGVTaWduYWw8U2V0PG51bWJlcj4+KG5ldyBTZXQoKSk7XG4gIGNvbnN0IFtwbGF5YmFja1NwZWVkLCBzZXRQbGF5YmFja1NwZWVkXSA9IGNyZWF0ZVNpZ25hbDxQbGF5YmFja1NwZWVkPignMXgnKTtcbiAgXG4gIGxldCBhdWRpb1VwZGF0ZUludGVydmFsOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgbGV0IHJlY29yZGluZ1RpbWVvdXQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBcbiAgY29uc3QgYXVkaW9Qcm9jZXNzb3IgPSBjcmVhdGVLYXJhb2tlQXVkaW9Qcm9jZXNzb3Ioe1xuICAgIHNhbXBsZVJhdGU6IDE2MDAwXG4gIH0pO1xuICBcbiAgY29uc3Qga2FyYW9rZUFwaSA9IG5ldyBLYXJhb2tlQXBpU2VydmljZShvcHRpb25zLmFwaVVybCk7XG5cbiAgLy8gSGVscGVyIHRvIGNvbnZlcnQgc3BlZWQgdG8gcGxheWJhY2sgcmF0ZVxuICBjb25zdCBnZXRQbGF5YmFja1JhdGUgPSAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpOiBudW1iZXIgPT4ge1xuICAgIHN3aXRjaCAoc3BlZWQpIHtcbiAgICAgIGNhc2UgJzAuNXgnOiByZXR1cm4gMC41O1xuICAgICAgY2FzZSAnMC43NXgnOiByZXR1cm4gMC43NTtcbiAgICAgIGNhc2UgJzF4JzogcmV0dXJuIDEuMDtcbiAgICAgIGRlZmF1bHQ6IHJldHVybiAxLjA7XG4gICAgfVxuICB9O1xuXG4gIC8vIEhlbHBlciB0byBnZXQgc3BlZWQgbXVsdGlwbGllciBmb3Igc2NvcmluZ1xuICBjb25zdCBnZXRTcGVlZE11bHRpcGxpZXIgPSAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpOiBudW1iZXIgPT4ge1xuICAgIHN3aXRjaCAoc3BlZWQpIHtcbiAgICAgIGNhc2UgJzAuNXgnOiByZXR1cm4gMS4yOyAgLy8gMjAlIHNjb3JlIGJvb3N0IGZvciBzbG93ZXN0IHNwZWVkXG4gICAgICBjYXNlICcwLjc1eCc6IHJldHVybiAxLjE7IC8vIDEwJSBzY29yZSBib29zdCBmb3IgbWVkaXVtIHNwZWVkXG4gICAgICBjYXNlICcxeCc6IHJldHVybiAxLjA7ICAgIC8vIE5vIGFkanVzdG1lbnQgZm9yIG5vcm1hbCBzcGVlZFxuICAgICAgZGVmYXVsdDogcmV0dXJuIDEuMDtcbiAgICB9XG4gIH07XG5cbiAgLy8gSGFuZGxlIHNwZWVkIGNoYW5nZVxuICBjb25zdCBoYW5kbGVTcGVlZENoYW5nZSA9IChzcGVlZDogUGxheWJhY2tTcGVlZCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIGhhbmRsZVNwZWVkQ2hhbmdlIGNhbGxlZCB3aXRoOicsIHNwZWVkKTtcbiAgICBzZXRQbGF5YmFja1NwZWVkKHNwZWVkKTtcbiAgICBjb25zdCBhdWRpbyA9IGF1ZGlvRWxlbWVudCgpO1xuICAgIGlmIChhdWRpbykge1xuICAgICAgY29uc3QgcmF0ZSA9IGdldFBsYXliYWNrUmF0ZShzcGVlZCk7XG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBTZXR0aW5nIGF1ZGlvIHBsYXliYWNrIHJhdGUgdG86JywgcmF0ZSwgJ2F1ZGlvIHBhdXNlZDonLCBhdWRpby5wYXVzZWQpO1xuICAgICAgYXVkaW8ucGxheWJhY2tSYXRlID0gcmF0ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlU2Vzc2lvbl0gTm8gYXVkaW8gZWxlbWVudCBhdmFpbGFibGUgeWV0Jyk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IHN0YXJ0U2Vzc2lvbiA9IGFzeW5jICgpID0+IHtcbiAgICAvLyBJbml0aWFsaXplIGF1ZGlvIGNhcHR1cmVcbiAgICB0cnkge1xuICAgICAgYXdhaXQgYXVkaW9Qcm9jZXNzb3IuaW5pdGlhbGl6ZSgpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBpbml0aWFsaXplIGF1ZGlvOicsIGVycm9yKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ3JlYXRlIHNlc3Npb24gb24gc2VydmVyIGlmIHRyYWNrSWQgcHJvdmlkZWRcbiAgICBcbiAgICBpZiAob3B0aW9ucy50cmFja0lkICYmIG9wdGlvbnMuc29uZ0RhdGEpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBrYXJhb2tlQXBpLnN0YXJ0U2Vzc2lvbihcbiAgICAgICAgICBvcHRpb25zLnRyYWNrSWQsXG4gICAgICAgICAge1xuICAgICAgICAgICAgdGl0bGU6IG9wdGlvbnMuc29uZ0RhdGEudGl0bGUsXG4gICAgICAgICAgICBhcnRpc3Q6IG9wdGlvbnMuc29uZ0RhdGEuYXJ0aXN0LFxuICAgICAgICAgICAgZHVyYXRpb246IG9wdGlvbnMuc29uZ0RhdGEuZHVyYXRpb24sXG4gICAgICAgICAgICBkaWZmaWN1bHR5OiAnaW50ZXJtZWRpYXRlJywgLy8gRGVmYXVsdCBkaWZmaWN1bHR5XG4gICAgICAgICAgfSxcbiAgICAgICAgICB1bmRlZmluZWQsIC8vIGF1dGhUb2tlblxuICAgICAgICAgIG9wdGlvbnMuc29uZ0NhdGFsb2dJZCxcbiAgICAgICAgICBwbGF5YmFja1NwZWVkKClcbiAgICAgICAgKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChzZXNzaW9uKSB7XG4gICAgICAgICAgc2V0U2Vzc2lvbklkKHNlc3Npb24uaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIGNyZWF0ZSBzZXNzaW9uJyk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIGNyZWF0ZSBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgIH1cbiAgICBcbiAgICAvLyBTdGFydCBjb3VudGRvd25cbiAgICBzZXRDb3VudGRvd24oMyk7XG4gICAgXG4gICAgY29uc3QgY291bnRkb3duSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBjb25zdCBjdXJyZW50ID0gY291bnRkb3duKCk7XG4gICAgICBpZiAoY3VycmVudCAhPT0gbnVsbCAmJiBjdXJyZW50ID4gMSkge1xuICAgICAgICBzZXRDb3VudGRvd24oY3VycmVudCAtIDEpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2xlYXJJbnRlcnZhbChjb3VudGRvd25JbnRlcnZhbCk7XG4gICAgICAgIHNldENvdW50ZG93bihudWxsKTtcbiAgICAgICAgc3RhcnRQbGF5YmFjaygpO1xuICAgICAgfVxuICAgIH0sIDEwMDApO1xuICB9O1xuXG4gIGNvbnN0IHN0YXJ0UGxheWJhY2sgPSAoKSA9PiB7XG4gICAgc2V0SXNQbGF5aW5nKHRydWUpO1xuICAgIFxuICAgIC8vIFN0YXJ0IGZ1bGwgc2Vzc2lvbiBhdWRpbyBjYXB0dXJlXG4gICAgYXVkaW9Qcm9jZXNzb3Iuc3RhcnRGdWxsU2Vzc2lvbigpO1xuICAgIFxuICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9FbGVtZW50KCkgfHwgb3B0aW9ucy5hdWRpb0VsZW1lbnQ7XG4gICAgaWYgKGF1ZGlvKSB7XG4gICAgICAvLyBTZXQgcGxheWJhY2sgcmF0ZSBiYXNlZCBvbiBjdXJyZW50IHNwZWVkXG4gICAgICBjb25zdCByYXRlID0gZ2V0UGxheWJhY2tSYXRlKHBsYXliYWNrU3BlZWQoKSk7XG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBTdGFydGluZyBwbGF5YmFjayB3aXRoIHNwZWVkOicsIHBsYXliYWNrU3BlZWQoKSwgJ3JhdGU6JywgcmF0ZSk7XG4gICAgICBhdWRpby5wbGF5YmFja1JhdGUgPSByYXRlO1xuICAgICAgLy8gSWYgYXVkaW8gZWxlbWVudCBpcyBwcm92aWRlZCwgdXNlIGl0XG4gICAgICBhdWRpby5wbGF5KCkuY2F0Y2goY29uc29sZS5lcnJvcik7XG4gICAgICBcbiAgICAgIGNvbnN0IHVwZGF0ZVRpbWUgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHRpbWUgPSBhdWRpby5jdXJyZW50VGltZSAqIDEwMDA7XG4gICAgICAgIHNldEN1cnJlbnRUaW1lKHRpbWUpO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgd2UgbmVlZCB0byBzdGFydCByZWNvcmRpbmcgZm9yIHVwY29taW5nIGxpbmVzXG4gICAgICAgIGNoZWNrRm9yVXBjb21pbmdMaW5lcyh0aW1lKTtcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGF1ZGlvVXBkYXRlSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCh1cGRhdGVUaW1lLCAxMDApIGFzIHVua25vd24gYXMgbnVtYmVyO1xuICAgICAgXG4gICAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsIGhhbmRsZUVuZCk7XG4gICAgfSBlbHNlIHtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBjaGVja0ZvclVwY29taW5nTGluZXMgPSAoY3VycmVudFRpbWVNczogbnVtYmVyKSA9PiB7XG4gICAgaWYgKGlzUmVjb3JkaW5nKCkgfHwgIW9wdGlvbnMubHlyaWNzLmxlbmd0aCkgcmV0dXJuO1xuICAgIFxuICAgIGNvbnN0IHJlY29yZGVkID0gcmVjb3JkZWRDaHVua3MoKTtcbiAgICBcbiAgICAvLyBMb29rIGZvciBjaHVua3MgdGhhdCBzaG91bGQgc3RhcnQgcmVjb3JkaW5nIHNvb25cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9wdGlvbnMubHlyaWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBTa2lwIGlmIHdlJ3ZlIGFscmVhZHkgcmVjb3JkZWQgYSBjaHVuayBzdGFydGluZyBhdCB0aGlzIGluZGV4XG4gICAgICBpZiAocmVjb3JkZWQuaGFzKGkpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjaHVuayA9IHNob3VsZENodW5rTGluZXMob3B0aW9ucy5seXJpY3MsIGkpO1xuICAgICAgY29uc3QgZmlyc3RMaW5lID0gb3B0aW9ucy5seXJpY3NbY2h1bmsuc3RhcnRJbmRleF07XG4gICAgICBcbiAgICAgIGlmIChmaXJzdExpbmUgJiYgZmlyc3RMaW5lLnN0YXJ0VGltZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IHJlY29yZGluZ1N0YXJ0VGltZSA9IGZpcnN0TGluZS5zdGFydFRpbWUgKiAxMDAwIC0gMTAwMDsgLy8gU3RhcnQgMXMgZWFybHlcbiAgICAgICAgY29uc3QgbGluZVN0YXJ0VGltZSA9IGZpcnN0TGluZS5zdGFydFRpbWUgKiAxMDAwO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgd2UncmUgaW4gdGhlIHJlY29yZGluZyB3aW5kb3cgYW5kIGhhdmVuJ3QgcGFzc2VkIHRoZSBsaW5lIHN0YXJ0XG4gICAgICAgIGlmIChjdXJyZW50VGltZU1zID49IHJlY29yZGluZ1N0YXJ0VGltZSAmJiBjdXJyZW50VGltZU1zIDwgbGluZVN0YXJ0VGltZSArIDUwMCkgeyAvLyBBbGxvdyA1MDBtcyBidWZmZXIgYWZ0ZXIgbGluZSBzdGFydFxuICAgICAgICAgIC8vIE1hcmsgdGhpcyBjaHVuayBhcyByZWNvcmRlZFxuICAgICAgICAgIHNldFJlY29yZGVkQ2h1bmtzKHByZXYgPT4gbmV3IFNldChwcmV2KS5hZGQoY2h1bmsuc3RhcnRJbmRleCkpO1xuICAgICAgICAgIC8vIFN0YXJ0IHJlY29yZGluZyB0aGlzIGNodW5rXG4gICAgICAgICAgc3RhcnRSZWNvcmRpbmdDaHVuayhjaHVuayk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gU2tpcCBhaGVhZCB0byBhdm9pZCBjaGVja2luZyBsaW5lcyB3ZSd2ZSBhbHJlYWR5IHBhc3NlZFxuICAgICAgaSA9IGNodW5rLmVuZEluZGV4O1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IHN0YXJ0UmVjb3JkaW5nQ2h1bmsgPSBhc3luYyAoY2h1bms6IENodW5rSW5mbykgPT4ge1xuICAgIC8vIFRFU1RJTkcgTU9ERTogQXV0by1jb21wbGV0ZSBhZnRlciA1IGxpbmVzXG4gICAgaWYgKGNodW5rLnN0YXJ0SW5kZXggPj0gNSkge1xuICAgICAgaGFuZGxlRW5kKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIHNldEN1cnJlbnRDaHVuayhjaHVuayk7XG4gICAgc2V0SXNSZWNvcmRpbmcodHJ1ZSk7XG4gICAgXG4gICAgLy8gU3RhcnQgYXVkaW8gY2FwdHVyZSBmb3IgdGhpcyBjaHVua1xuICAgIGF1ZGlvUHJvY2Vzc29yLnN0YXJ0UmVjb3JkaW5nTGluZShjaHVuay5zdGFydEluZGV4KTtcbiAgICBcbiAgICAvLyBDYWxjdWxhdGUgcmVjb3JkaW5nIGR1cmF0aW9uIGFkanVzdGVkIGZvciBwbGF5YmFjayBzcGVlZFxuICAgIGNvbnN0IGJhc2VEdXJhdGlvbiA9IGNhbGN1bGF0ZVJlY29yZGluZ0R1cmF0aW9uKG9wdGlvbnMubHlyaWNzLCBjaHVuayk7XG4gICAgY29uc3Qgc3BlZWRGYWN0b3IgPSAxIC8gZ2V0UGxheWJhY2tSYXRlKHBsYXliYWNrU3BlZWQoKSk7IC8vIEludmVyc2Ugb2YgcGxheWJhY2sgcmF0ZVxuICAgIGNvbnN0IGR1cmF0aW9uID0gYmFzZUR1cmF0aW9uICogc3BlZWRGYWN0b3I7XG4gICAgXG4gICAgLy8gU3RvcCByZWNvcmRpbmcgYWZ0ZXIgZHVyYXRpb25cbiAgICByZWNvcmRpbmdUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBzdG9wUmVjb3JkaW5nQ2h1bmsoKTtcbiAgICB9LCBkdXJhdGlvbikgYXMgdW5rbm93biBhcyBudW1iZXI7XG4gIH07XG4gIFxuICBjb25zdCBzdG9wUmVjb3JkaW5nQ2h1bmsgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgY2h1bmsgPSBjdXJyZW50Q2h1bmsoKTtcbiAgICBpZiAoIWNodW5rKSByZXR1cm47XG4gICAgXG4gICAgc2V0SXNSZWNvcmRpbmcoZmFsc2UpO1xuICAgIFxuICAgIC8vIEdldCB0aGUgcmVjb3JkZWQgYXVkaW9cbiAgICBjb25zdCBhdWRpb0NodW5rcyA9IGF1ZGlvUHJvY2Vzc29yLnN0b3BSZWNvcmRpbmdMaW5lQW5kR2V0UmF3QXVkaW8oKTtcbiAgICBjb25zdCB3YXZCbG9iID0gYXVkaW9Qcm9jZXNzb3IuY29udmVydEF1ZGlvVG9XYXZCbG9iKGF1ZGlvQ2h1bmtzKTtcbiAgICBcbiAgICBcbiAgICAvLyBDaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBhdWRpbyBkYXRhXG4gICAgaWYgKHdhdkJsb2IgJiYgd2F2QmxvYi5zaXplID4gMTAwMCAmJiBzZXNzaW9uSWQoKSkgeyAvLyBNaW5pbXVtIDFLQiBvZiBhdWRpbyBkYXRhXG4gICAgICAvLyBDb252ZXJ0IHRvIGJhc2U2NCBmb3IgQVBJXG4gICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZGVuZCA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgYmFzZTY0QXVkaW8gPSByZWFkZXIucmVzdWx0Py50b1N0cmluZygpLnNwbGl0KCcsJylbMV07XG4gICAgICAgIGlmIChiYXNlNjRBdWRpbyAmJiBiYXNlNjRBdWRpby5sZW5ndGggPiAxMDApIHsgLy8gRW5zdXJlIHdlIGhhdmUgbWVhbmluZ2Z1bCBiYXNlNjQgZGF0YVxuICAgICAgICAgIGF3YWl0IGdyYWRlQ2h1bmsoY2h1bmssIGJhc2U2NEF1ZGlvKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIH1cbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzRGF0YVVSTCh3YXZCbG9iKTtcbiAgICB9IGVsc2UgaWYgKHdhdkJsb2IgJiYgd2F2QmxvYi5zaXplIDw9IDEwMDApIHtcbiAgICAgIC8vIEFkZCBhIG5ldXRyYWwgc2NvcmUgZm9yIFVJIGZlZWRiYWNrXG4gICAgICBzZXRMaW5lU2NvcmVzKHByZXYgPT4gWy4uLnByZXYsIHtcbiAgICAgICAgbGluZUluZGV4OiBjaHVuay5zdGFydEluZGV4LFxuICAgICAgICBzY29yZTogNTAsXG4gICAgICAgIHRyYW5zY3JpcHRpb246ICcnLFxuICAgICAgICBmZWVkYmFjazogJ1JlY29yZGluZyB0b28gc2hvcnQnXG4gICAgICB9XSk7XG4gICAgfSBlbHNlIGlmICh3YXZCbG9iICYmICFzZXNzaW9uSWQoKSkge1xuICAgIH1cbiAgICBcbiAgICBzZXRDdXJyZW50Q2h1bmsobnVsbCk7XG4gICAgXG4gICAgaWYgKHJlY29yZGluZ1RpbWVvdXQpIHtcbiAgICAgIGNsZWFyVGltZW91dChyZWNvcmRpbmdUaW1lb3V0KTtcbiAgICAgIHJlY29yZGluZ1RpbWVvdXQgPSBudWxsO1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGdyYWRlQ2h1bmsgPSBhc3luYyAoY2h1bms6IENodW5rSW5mbywgYXVkaW9CYXNlNjQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGN1cnJlbnRTZXNzaW9uSWQgPSBzZXNzaW9uSWQoKTtcbiAgICBcbiAgICBpZiAoIWN1cnJlbnRTZXNzaW9uSWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGxpbmVTY29yZSA9IGF3YWl0IGthcmFva2VBcGkuZ3JhZGVSZWNvcmRpbmcoXG4gICAgICAgIGN1cnJlbnRTZXNzaW9uSWQsXG4gICAgICAgIGNodW5rLnN0YXJ0SW5kZXgsXG4gICAgICAgIGF1ZGlvQmFzZTY0LFxuICAgICAgICBjaHVuay5leHBlY3RlZFRleHQsXG4gICAgICAgIG9wdGlvbnMubHlyaWNzW2NodW5rLnN0YXJ0SW5kZXhdPy5zdGFydFRpbWUgfHwgMCxcbiAgICAgICAgKG9wdGlvbnMubHlyaWNzW2NodW5rLmVuZEluZGV4XT8uc3RhcnRUaW1lIHx8IDApICsgKG9wdGlvbnMubHlyaWNzW2NodW5rLmVuZEluZGV4XT8uZHVyYXRpb24gfHwgMCkgLyAxMDAwLFxuICAgICAgICB1bmRlZmluZWQsIC8vIGF1dGhUb2tlblxuICAgICAgICBwbGF5YmFja1NwZWVkKClcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGlmIChsaW5lU2NvcmUpIHtcbiAgICAgICAgXG4gICAgICAgIC8vIEFwcGx5IHNwZWVkIG11bHRpcGxpZXIgdG8gc2NvcmUgZm9yIGxhbmd1YWdlIGxlYXJuZXJzXG4gICAgICAgIGNvbnN0IHNwZWVkTXVsdGlwbGllciA9IGdldFNwZWVkTXVsdGlwbGllcihwbGF5YmFja1NwZWVkKCkpO1xuICAgICAgICBjb25zdCBhZGp1c3RlZFNjb3JlID0gTWF0aC5taW4oMTAwLCBNYXRoLnJvdW5kKGxpbmVTY29yZS5zY29yZSAqIHNwZWVkTXVsdGlwbGllcikpO1xuICAgICAgICBcbiAgICAgICAgLy8gVXBkYXRlIGxpbmUgc2NvcmVzXG4gICAgICAgIGNvbnN0IG5ld0xpbmVTY29yZSA9IHtcbiAgICAgICAgICBsaW5lSW5kZXg6IGNodW5rLnN0YXJ0SW5kZXgsXG4gICAgICAgICAgc2NvcmU6IGFkanVzdGVkU2NvcmUsXG4gICAgICAgICAgdHJhbnNjcmlwdGlvbjogbGluZVNjb3JlLnRyYW5zY3JpcHQgfHwgJycsXG4gICAgICAgICAgZmVlZGJhY2s6IGxpbmVTY29yZS5mZWVkYmFja1xuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgc2V0TGluZVNjb3JlcyhwcmV2ID0+IFsuLi5wcmV2LCBuZXdMaW5lU2NvcmVdKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFVwZGF0ZSB0b3RhbCBzY29yZSAoc2ltcGxlIGF2ZXJhZ2UgZm9yIG5vdykgLSB1c2UgcHJldiB0byBhdm9pZCBkZXBlbmRlbmN5XG4gICAgICAgIHNldFNjb3JlKHByZXYgPT4ge1xuICAgICAgICAgIGNvbnN0IGFsbFNjb3JlcyA9IFsuLi5saW5lU2NvcmVzKCksIG5ld0xpbmVTY29yZV07XG4gICAgICAgICAgY29uc3QgYXZnU2NvcmUgPSBhbGxTY29yZXMucmVkdWNlKChzdW0sIHMpID0+IHN1bSArIHMuc2NvcmUsIDApIC8gYWxsU2NvcmVzLmxlbmd0aDtcbiAgICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChhdmdTY29yZSk7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgLy8gUmVtb3ZlZCB0ZXN0IG1vZGUgbGltaXRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIFxuICAgICAgICAvLyBBZGQgYSBuZXV0cmFsIHNjb3JlIGZvciBVSSBmZWVkYmFja1xuICAgICAgICBzZXRMaW5lU2NvcmVzKHByZXYgPT4gWy4uLnByZXYsIHtcbiAgICAgICAgICBsaW5lSW5kZXg6IGNodW5rLnN0YXJ0SW5kZXgsXG4gICAgICAgICAgc2NvcmU6IDUwLCAvLyBOZXV0cmFsIHNjb3JlXG4gICAgICAgICAgdHJhbnNjcmlwdGlvbjogJycsXG4gICAgICAgICAgZmVlZGJhY2s6ICdGYWlsZWQgdG8gZ3JhZGUgcmVjb3JkaW5nJ1xuICAgICAgICB9XSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIGdyYWRlIGNodW5rOicsIGVycm9yKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlRW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgaWYgKGF1ZGlvVXBkYXRlSW50ZXJ2YWwpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwoYXVkaW9VcGRhdGVJbnRlcnZhbCk7XG4gICAgfVxuICAgIFxuICAgIC8vIFBhdXNlIHRoZSBhdWRpb1xuICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9FbGVtZW50KCkgfHwgb3B0aW9ucy5hdWRpb0VsZW1lbnQ7XG4gICAgaWYgKGF1ZGlvICYmICFhdWRpby5wYXVzZWQpIHtcbiAgICAgIGF1ZGlvLnBhdXNlKCk7XG4gICAgfVxuICAgIFxuICAgIC8vIFN0b3AgYW55IG9uZ29pbmcgcmVjb3JkaW5nXG4gICAgaWYgKGlzUmVjb3JkaW5nKCkpIHtcbiAgICAgIGF3YWl0IHN0b3BSZWNvcmRpbmdDaHVuaygpO1xuICAgIH1cbiAgICBcbiAgICAvLyBTaG93IGxvYWRpbmcgc3RhdGUgaW1tZWRpYXRlbHlcbiAgICBjb25zdCBsb2FkaW5nUmVzdWx0czogS2FyYW9rZVJlc3VsdHMgPSB7XG4gICAgICBzY29yZTogLTEsIC8vIFNwZWNpYWwgdmFsdWUgdG8gaW5kaWNhdGUgbG9hZGluZ1xuICAgICAgYWNjdXJhY3k6IDAsXG4gICAgICB0b3RhbExpbmVzOiBsaW5lU2NvcmVzKCkubGVuZ3RoLFxuICAgICAgcGVyZmVjdExpbmVzOiAwLFxuICAgICAgZ29vZExpbmVzOiAwLFxuICAgICAgbmVlZHNXb3JrTGluZXM6IDAsXG4gICAgICBzZXNzaW9uSWQ6IHNlc3Npb25JZCgpIHx8IHVuZGVmaW5lZCxcbiAgICAgIGlzTG9hZGluZzogdHJ1ZVxuICAgIH07XG4gICAgb3B0aW9ucy5vbkNvbXBsZXRlPy4obG9hZGluZ1Jlc3VsdHMpO1xuICAgIFxuICAgIC8vIEdldCBmdWxsIHNlc3Npb24gYXVkaW9cbiAgICBjb25zdCBmdWxsQXVkaW9CbG9iID0gYXVkaW9Qcm9jZXNzb3Iuc3RvcEZ1bGxTZXNzaW9uQW5kR2V0V2F2KCk7XG4gICAgXG4gICAgLy8gQ29tcGxldGUgc2Vzc2lvbiBvbiBzZXJ2ZXJcbiAgICBjb25zdCBjdXJyZW50U2Vzc2lvbklkID0gc2Vzc2lvbklkKCk7XG4gICAgaWYgKGN1cnJlbnRTZXNzaW9uSWQgJiYgZnVsbEF1ZGlvQmxvYiAmJiBmdWxsQXVkaW9CbG9iLnNpemUgPiAxMDAwKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgICByZWFkZXIub25sb2FkZW5kID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGJhc2U2NEF1ZGlvID0gcmVhZGVyLnJlc3VsdD8udG9TdHJpbmcoKS5zcGxpdCgnLCcpWzFdO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IHNlc3Npb25SZXN1bHRzID0gYXdhaXQga2FyYW9rZUFwaS5jb21wbGV0ZVNlc3Npb24oXG4gICAgICAgICAgICBjdXJyZW50U2Vzc2lvbklkLFxuICAgICAgICAgICAgYmFzZTY0QXVkaW9cbiAgICAgICAgICApO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChzZXNzaW9uUmVzdWx0cykge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCByZXN1bHRzOiBLYXJhb2tlUmVzdWx0cyA9IHtcbiAgICAgICAgICAgICAgc2NvcmU6IHNlc3Npb25SZXN1bHRzLmZpbmFsU2NvcmUsXG4gICAgICAgICAgICAgIGFjY3VyYWN5OiBzZXNzaW9uUmVzdWx0cy5hY2N1cmFjeSxcbiAgICAgICAgICAgICAgdG90YWxMaW5lczogc2Vzc2lvblJlc3VsdHMudG90YWxMaW5lcyxcbiAgICAgICAgICAgICAgcGVyZmVjdExpbmVzOiBzZXNzaW9uUmVzdWx0cy5wZXJmZWN0TGluZXMsXG4gICAgICAgICAgICAgIGdvb2RMaW5lczogc2Vzc2lvblJlc3VsdHMuZ29vZExpbmVzLFxuICAgICAgICAgICAgICBuZWVkc1dvcmtMaW5lczogc2Vzc2lvblJlc3VsdHMubmVlZHNXb3JrTGluZXMsXG4gICAgICAgICAgICAgIHNlc3Npb25JZDogY3VycmVudFNlc3Npb25JZFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgb3B0aW9ucy5vbkNvbXBsZXRlPy4ocmVzdWx0cyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIGxvY2FsIGNhbGN1bGF0aW9uXG4gICAgICAgICAgICBjYWxjdWxhdGVMb2NhbFJlc3VsdHMoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKGZ1bGxBdWRpb0Jsb2IpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VTZXNzaW9uXSBGYWlsZWQgdG8gY29tcGxldGUgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICAgIGNhbGN1bGF0ZUxvY2FsUmVzdWx0cygpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBObyBzZXNzaW9uLCBqdXN0IHJldHVybiBsb2NhbCByZXN1bHRzXG4gICAgICBjYWxjdWxhdGVMb2NhbFJlc3VsdHMoKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBjYWxjdWxhdGVMb2NhbFJlc3VsdHMgPSAoKSA9PiB7XG4gICAgY29uc3Qgc2NvcmVzID0gbGluZVNjb3JlcygpO1xuICAgIGNvbnN0IGF2Z1Njb3JlID0gc2NvcmVzLmxlbmd0aCA+IDAgXG4gICAgICA/IHNjb3Jlcy5yZWR1Y2UoKHN1bSwgcykgPT4gc3VtICsgcy5zY29yZSwgMCkgLyBzY29yZXMubGVuZ3RoXG4gICAgICA6IDA7XG4gICAgXG4gICAgY29uc3QgcmVzdWx0czogS2FyYW9rZVJlc3VsdHMgPSB7XG4gICAgICBzY29yZTogTWF0aC5yb3VuZChhdmdTY29yZSksXG4gICAgICBhY2N1cmFjeTogTWF0aC5yb3VuZChhdmdTY29yZSksXG4gICAgICB0b3RhbExpbmVzOiBzY29yZXMubGVuZ3RoLCAvLyBVc2UgYWN0dWFsIGNvbXBsZXRlZCBsaW5lcyBmb3IgdGVzdCBtb2RlXG4gICAgICBwZXJmZWN0TGluZXM6IHNjb3Jlcy5maWx0ZXIocyA9PiBzLnNjb3JlID49IDkwKS5sZW5ndGgsXG4gICAgICBnb29kTGluZXM6IHNjb3Jlcy5maWx0ZXIocyA9PiBzLnNjb3JlID49IDcwICYmIHMuc2NvcmUgPCA5MCkubGVuZ3RoLFxuICAgICAgbmVlZHNXb3JrTGluZXM6IHNjb3Jlcy5maWx0ZXIocyA9PiBzLnNjb3JlIDwgNzApLmxlbmd0aCxcbiAgICAgIHNlc3Npb25JZDogc2Vzc2lvbklkKCkgfHwgdW5kZWZpbmVkXG4gICAgfTtcbiAgICBcbiAgICBvcHRpb25zLm9uQ29tcGxldGU/LihyZXN1bHRzKTtcbiAgfTtcblxuICBjb25zdCBzdG9wU2Vzc2lvbiA9ICgpID0+IHtcbiAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgIHNldENvdW50ZG93bihudWxsKTtcbiAgICBzZXRJc1JlY29yZGluZyhmYWxzZSk7XG4gICAgc2V0Q3VycmVudENodW5rKG51bGwpO1xuICAgIHNldFJlY29yZGVkQ2h1bmtzKG5ldyBTZXQ8bnVtYmVyPigpKTtcbiAgICBcbiAgICBpZiAoYXVkaW9VcGRhdGVJbnRlcnZhbCkge1xuICAgICAgY2xlYXJJbnRlcnZhbChhdWRpb1VwZGF0ZUludGVydmFsKTtcbiAgICAgIGF1ZGlvVXBkYXRlSW50ZXJ2YWwgPSBudWxsO1xuICAgIH1cbiAgICBcbiAgICBpZiAocmVjb3JkaW5nVGltZW91dCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHJlY29yZGluZ1RpbWVvdXQpO1xuICAgICAgcmVjb3JkaW5nVGltZW91dCA9IG51bGw7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9FbGVtZW50KCkgfHwgb3B0aW9ucy5hdWRpb0VsZW1lbnQ7XG4gICAgaWYgKGF1ZGlvKSB7XG4gICAgICBhdWRpby5wYXVzZSgpO1xuICAgICAgYXVkaW8uY3VycmVudFRpbWUgPSAwO1xuICAgICAgYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZW5kZWQnLCBoYW5kbGVFbmQpO1xuICAgIH1cbiAgICBcbiAgICAvLyBDbGVhbnVwIGF1ZGlvIHByb2Nlc3NvclxuICAgIGF1ZGlvUHJvY2Vzc29yLmNsZWFudXAoKTtcbiAgfTtcblxuICBvbkNsZWFudXAoKCkgPT4ge1xuICAgIHN0b3BTZXNzaW9uKCk7XG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgLy8gU3RhdGVcbiAgICBpc1BsYXlpbmcsXG4gICAgY3VycmVudFRpbWUsXG4gICAgc2NvcmUsXG4gICAgY291bnRkb3duLFxuICAgIHNlc3Npb25JZCxcbiAgICBsaW5lU2NvcmVzLFxuICAgIGlzUmVjb3JkaW5nLFxuICAgIGN1cnJlbnRDaHVuayxcbiAgICBwbGF5YmFja1NwZWVkLFxuICAgIFxuICAgIC8vIEFjdGlvbnNcbiAgICBzdGFydFNlc3Npb24sXG4gICAgc3RvcFNlc3Npb24sXG4gICAgaGFuZGxlU3BlZWRDaGFuZ2UsXG4gICAgXG4gICAgLy8gQXVkaW8gcHJvY2Vzc29yIChmb3IgZGlyZWN0IGFjY2VzcyBpZiBuZWVkZWQpXG4gICAgYXVkaW9Qcm9jZXNzb3IsXG4gICAgXG4gICAgLy8gTWV0aG9kIHRvIHVwZGF0ZSBhdWRpbyBlbGVtZW50IGFmdGVyIGluaXRpYWxpemF0aW9uXG4gICAgc2V0QXVkaW9FbGVtZW50OiAoZWxlbWVudDogSFRNTEF1ZGlvRWxlbWVudCB8IHVuZGVmaW5lZCkgPT4ge1xuICAgICAgc2V0QXVkaW9FbGVtZW50KGVsZW1lbnQpO1xuICAgICAgLy8gQXBwbHkgY3VycmVudCBwbGF5YmFjayByYXRlIHRvIG5ldyBhdWRpbyBlbGVtZW50XG4gICAgICBpZiAoZWxlbWVudCkge1xuICAgICAgICBlbGVtZW50LnBsYXliYWNrUmF0ZSA9IGdldFBsYXliYWNrUmF0ZShwbGF5YmFja1NwZWVkKCkpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn0iLCJleHBvcnQgaW50ZXJmYWNlIFRyYWNrSW5mbyB7XG4gIHRyYWNrSWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgYXJ0aXN0OiBzdHJpbmc7XG4gIHBsYXRmb3JtOiAnc291bmRjbG91ZCc7XG4gIHVybDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgVHJhY2tEZXRlY3RvciB7XG4gIC8qKlxuICAgKiBEZXRlY3QgY3VycmVudCB0cmFjayBmcm9tIHRoZSBwYWdlIChTb3VuZENsb3VkIG9ubHkpXG4gICAqL1xuICBkZXRlY3RDdXJyZW50VHJhY2soKTogVHJhY2tJbmZvIHwgbnVsbCB7XG4gICAgY29uc3QgdXJsID0gd2luZG93LmxvY2F0aW9uLmhyZWY7XG4gICAgXG4gICAgLy8gT25seSB3b3JrIG9uIHNjLm1haWQuem9uZSAoU291bmRDbG91ZCBwcm94eSlcbiAgICBpZiAodXJsLmluY2x1ZGVzKCdzYy5tYWlkLnpvbmUnKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZGV0ZWN0U291bmRDbG91ZFRyYWNrKCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBudWxsO1xuICB9XG5cblxuICAvKipcbiAgICogRXh0cmFjdCB0cmFjayBpbmZvIGZyb20gU291bmRDbG91ZCAoc2MubWFpZC56b25lKVxuICAgKi9cbiAgcHJpdmF0ZSBkZXRlY3RTb3VuZENsb3VkVHJhY2soKTogVHJhY2tJbmZvIHwgbnVsbCB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIFNvdW5kQ2xvdWQgVVJMczogc2MubWFpZC56b25lL3VzZXIvdHJhY2stbmFtZVxuICAgICAgY29uc3QgcGF0aFBhcnRzID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLnNwbGl0KCcvJykuZmlsdGVyKEJvb2xlYW4pO1xuICAgICAgaWYgKHBhdGhQYXJ0cy5sZW5ndGggPCAyKSByZXR1cm4gbnVsbDtcblxuICAgICAgY29uc3QgYXJ0aXN0UGF0aCA9IHBhdGhQYXJ0c1swXTtcbiAgICAgIGNvbnN0IHRyYWNrU2x1ZyA9IHBhdGhQYXJ0c1sxXTtcbiAgICAgIFxuICAgICAgLy8gVHJ5IHRvIGdldCBhY3R1YWwgdGl0bGUgZnJvbSBwYWdlXG4gICAgICBsZXQgdGl0bGUgPSAnJztcbiAgICAgIFxuICAgICAgLy8gRm9yIHNvdW5kY2xvYWssIGxvb2sgZm9yIGgxIGFmdGVyIHRoZSBpbWFnZVxuICAgICAgY29uc3QgaDFFbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2gxJyk7XG4gICAgICBmb3IgKGNvbnN0IGgxIG9mIGgxRWxlbWVudHMpIHtcbiAgICAgICAgLy8gU2tpcCB0aGUgXCJzb3VuZGNsb2FrXCIgaGVhZGVyXG4gICAgICAgIGlmIChoMS50ZXh0Q29udGVudD8udG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnc291bmRjbG9haycpKSBjb250aW51ZTtcbiAgICAgICAgdGl0bGUgPSBoMS50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgICBpZiAodGl0bGUpIGJyZWFrO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBGYWxsYmFjayB0byBzbHVnXG4gICAgICBpZiAoIXRpdGxlKSB7XG4gICAgICAgIHRpdGxlID0gdHJhY2tTbHVnLnJlcGxhY2UoLy0vZywgJyAnKTtcbiAgICAgIH1cblxuICAgICAgLy8gVHJ5IHRvIGdldCBhY3R1YWwgYXJ0aXN0IG5hbWUgZnJvbSBwYWdlXG4gICAgICBsZXQgYXJ0aXN0ID0gJyc7XG4gICAgICBcbiAgICAgIC8vIExvb2sgZm9yIGFydGlzdCBsaW5rIHdpdGggbWV0YSBjbGFzc1xuICAgICAgY29uc3QgYXJ0aXN0TGluayA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2EubGlzdGluZyAubWV0YSBoMycpO1xuICAgICAgaWYgKGFydGlzdExpbmsgJiYgYXJ0aXN0TGluay50ZXh0Q29udGVudCkge1xuICAgICAgICBhcnRpc3QgPSBhcnRpc3RMaW5rLnRleHRDb250ZW50LnRyaW0oKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gRmFsbGJhY2s6IHRyeSBwYWdlIHRpdGxlXG4gICAgICBpZiAoIWFydGlzdCkge1xuICAgICAgICBjb25zdCBwYWdlVGl0bGUgPSBkb2N1bWVudC50aXRsZTtcbiAgICAgICAgLy8gVGl0bGUgZm9ybWF0OiBcIlNvbmcgYnkgQXJ0aXN0IH4gc291bmRjbG9ha1wiXG4gICAgICAgIGNvbnN0IG1hdGNoID0gcGFnZVRpdGxlLm1hdGNoKC9ieVxccysoLis/KVxccyp+Lyk7XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgIGFydGlzdCA9IG1hdGNoWzFdLnRyaW0oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBGaW5hbCBmYWxsYmFjayB0byBVUkxcbiAgICAgIGlmICghYXJ0aXN0KSB7XG4gICAgICAgIGFydGlzdCA9IGFydGlzdFBhdGgucmVwbGFjZSgvLS9nLCAnICcpLnJlcGxhY2UoL18vZywgJyAnKTtcbiAgICAgIH1cblxuICAgICAgY29uc29sZS5sb2coJ1tUcmFja0RldGVjdG9yXSBEZXRlY3RlZCB0cmFjazonLCB7IHRpdGxlLCBhcnRpc3QsIGFydGlzdFBhdGgsIHRyYWNrU2x1ZyB9KTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHJhY2tJZDogYCR7YXJ0aXN0UGF0aH0vJHt0cmFja1NsdWd9YCxcbiAgICAgICAgdGl0bGU6IHRpdGxlLFxuICAgICAgICBhcnRpc3Q6IGFydGlzdCxcbiAgICAgICAgcGxhdGZvcm06ICdzb3VuZGNsb3VkJyxcbiAgICAgICAgdXJsOiB3aW5kb3cubG9jYXRpb24uaHJlZixcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tUcmFja0RldGVjdG9yXSBFcnJvciBkZXRlY3RpbmcgU291bmRDbG91ZCB0cmFjazonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuXG4gIC8qKlxuICAgKiBXYXRjaCBmb3IgcGFnZSBjaGFuZ2VzIChTb3VuZENsb3VkIGlzIGEgU1BBKVxuICAgKi9cbiAgd2F0Y2hGb3JDaGFuZ2VzKGNhbGxiYWNrOiAodHJhY2s6IFRyYWNrSW5mbyB8IG51bGwpID0+IHZvaWQpOiAoKSA9PiB2b2lkIHtcbiAgICBsZXQgY3VycmVudFVybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICAgIGxldCBjdXJyZW50VHJhY2sgPSB0aGlzLmRldGVjdEN1cnJlbnRUcmFjaygpO1xuICAgIFxuICAgIC8vIEluaXRpYWwgZGV0ZWN0aW9uXG4gICAgY2FsbGJhY2soY3VycmVudFRyYWNrKTtcblxuICAgIC8vIFdhdGNoIGZvciBVUkwgY2hhbmdlc1xuICAgIGNvbnN0IGNoZWNrRm9yQ2hhbmdlcyA9ICgpID0+IHtcbiAgICAgIGNvbnN0IG5ld1VybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICAgICAgaWYgKG5ld1VybCAhPT0gY3VycmVudFVybCkge1xuICAgICAgICBjdXJyZW50VXJsID0gbmV3VXJsO1xuICAgICAgICBjb25zdCBuZXdUcmFjayA9IHRoaXMuZGV0ZWN0Q3VycmVudFRyYWNrKCk7XG4gICAgICAgIFxuICAgICAgICAvLyBPbmx5IHRyaWdnZXIgY2FsbGJhY2sgaWYgdHJhY2sgYWN0dWFsbHkgY2hhbmdlZFxuICAgICAgICBjb25zdCB0cmFja0NoYW5nZWQgPSAhY3VycmVudFRyYWNrIHx8ICFuZXdUcmFjayB8fCBcbiAgICAgICAgICBjdXJyZW50VHJhY2sudHJhY2tJZCAhPT0gbmV3VHJhY2sudHJhY2tJZDtcbiAgICAgICAgICBcbiAgICAgICAgaWYgKHRyYWNrQ2hhbmdlZCkge1xuICAgICAgICAgIGN1cnJlbnRUcmFjayA9IG5ld1RyYWNrO1xuICAgICAgICAgIGNhbGxiYWNrKG5ld1RyYWNrKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBQb2xsIGZvciBjaGFuZ2VzIChTUEFzIGRvbid0IGFsd2F5cyB0cmlnZ2VyIHByb3BlciBuYXZpZ2F0aW9uIGV2ZW50cylcbiAgICBjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKGNoZWNrRm9yQ2hhbmdlcywgMTAwMCk7XG5cbiAgICAvLyBBbHNvIGxpc3RlbiBmb3IgbmF2aWdhdGlvbiBldmVudHNcbiAgICBjb25zdCBoYW5kbGVOYXZpZ2F0aW9uID0gKCkgPT4ge1xuICAgICAgc2V0VGltZW91dChjaGVja0ZvckNoYW5nZXMsIDEwMCk7IC8vIFNtYWxsIGRlbGF5IGZvciBET00gdXBkYXRlc1xuICAgIH07XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCBoYW5kbGVOYXZpZ2F0aW9uKTtcbiAgICBcbiAgICAvLyBMaXN0ZW4gZm9yIHB1c2hzdGF0ZS9yZXBsYWNlc3RhdGUgKFNvdW5kQ2xvdWQgdXNlcyB0aGVzZSlcbiAgICBjb25zdCBvcmlnaW5hbFB1c2hTdGF0ZSA9IGhpc3RvcnkucHVzaFN0YXRlO1xuICAgIGNvbnN0IG9yaWdpbmFsUmVwbGFjZVN0YXRlID0gaGlzdG9yeS5yZXBsYWNlU3RhdGU7XG4gICAgXG4gICAgaGlzdG9yeS5wdXNoU3RhdGUgPSBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgICBvcmlnaW5hbFB1c2hTdGF0ZS5hcHBseShoaXN0b3J5LCBhcmdzKTtcbiAgICAgIGhhbmRsZU5hdmlnYXRpb24oKTtcbiAgICB9O1xuICAgIFxuICAgIGhpc3RvcnkucmVwbGFjZVN0YXRlID0gZnVuY3Rpb24oLi4uYXJncykge1xuICAgICAgb3JpZ2luYWxSZXBsYWNlU3RhdGUuYXBwbHkoaGlzdG9yeSwgYXJncyk7XG4gICAgICBoYW5kbGVOYXZpZ2F0aW9uKCk7XG4gICAgfTtcblxuICAgIC8vIFJldHVybiBjbGVhbnVwIGZ1bmN0aW9uXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgaGFuZGxlTmF2aWdhdGlvbik7XG4gICAgICBoaXN0b3J5LnB1c2hTdGF0ZSA9IG9yaWdpbmFsUHVzaFN0YXRlO1xuICAgICAgaGlzdG9yeS5yZXBsYWNlU3RhdGUgPSBvcmlnaW5hbFJlcGxhY2VTdGF0ZTtcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCB0cmFja0RldGVjdG9yID0gbmV3IFRyYWNrRGV0ZWN0b3IoKTsiLCIvLyBVc2luZyBicm93c2VyLnN0b3JhZ2UgQVBJIGRpcmVjdGx5IGZvciBzaW1wbGljaXR5XG5pbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xuXG4vLyBIZWxwZXIgdG8gZ2V0IGF1dGggdG9rZW5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRBdXRoVG9rZW4oKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5nZXQoJ2F1dGhUb2tlbicpO1xuICByZXR1cm4gcmVzdWx0LmF1dGhUb2tlbiB8fCBudWxsO1xufVxuXG4vLyBIZWxwZXIgdG8gc2V0IGF1dGggdG9rZW5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXRBdXRoVG9rZW4odG9rZW46IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuc2V0KHsgYXV0aFRva2VuOiB0b2tlbiB9KTtcbn1cblxuLy8gSGVscGVyIHRvIGdldCBpbnN0YWxsYXRpb24gc3RhdGVcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRJbnN0YWxsYXRpb25TdGF0ZSgpOiBQcm9taXNlPHtcbiAgY29tcGxldGVkOiBib29sZWFuO1xuICBqd3RWZXJpZmllZDogYm9vbGVhbjtcbiAgdGltZXN0YW1wPzogbnVtYmVyO1xufT4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuZ2V0KCdpbnN0YWxsYXRpb25TdGF0ZScpO1xuICByZXR1cm4gcmVzdWx0Lmluc3RhbGxhdGlvblN0YXRlIHx8IHtcbiAgICBjb21wbGV0ZWQ6IGZhbHNlLFxuICAgIGp3dFZlcmlmaWVkOiBmYWxzZSxcbiAgfTtcbn1cblxuLy8gSGVscGVyIHRvIHNldCBpbnN0YWxsYXRpb24gc3RhdGVcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXRJbnN0YWxsYXRpb25TdGF0ZShzdGF0ZToge1xuICBjb21wbGV0ZWQ6IGJvb2xlYW47XG4gIGp3dFZlcmlmaWVkOiBib29sZWFuO1xuICB0aW1lc3RhbXA/OiBudW1iZXI7XG59KTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5zZXQoeyBpbnN0YWxsYXRpb25TdGF0ZTogc3RhdGUgfSk7XG59XG5cbi8vIEhlbHBlciB0byBjaGVjayBpZiB1c2VyIGlzIGF1dGhlbnRpY2F0ZWRcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpc0F1dGhlbnRpY2F0ZWQoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGNvbnN0IHRva2VuID0gYXdhaXQgZ2V0QXV0aFRva2VuKCk7XG4gIHJldHVybiAhIXRva2VuICYmIHRva2VuLnN0YXJ0c1dpdGgoJ3NjYXJsZXR0XycpO1xufVxuXG4vLyBIZWxwZXIgdG8gY2xlYXIgYXV0aCBkYXRhXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2xlYXJBdXRoKCk6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwucmVtb3ZlKFsnYXV0aFRva2VuJywgJ2luc3RhbGxhdGlvblN0YXRlJ10pO1xufSIsImV4cG9ydCBpbnRlcmZhY2UgS2FyYW9rZURhdGEge1xuICBzdWNjZXNzOiBib29sZWFuO1xuICB0cmFja19pZD86IHN0cmluZztcbiAgdHJhY2tJZD86IHN0cmluZztcbiAgaGFzX2thcmFva2U/OiBib29sZWFuO1xuICBoYXNLYXJhb2tlPzogYm9vbGVhbjtcbiAgc29uZz86IHtcbiAgICBpZDogc3RyaW5nO1xuICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgYXJ0aXN0OiBzdHJpbmc7XG4gICAgYWxidW0/OiBzdHJpbmc7XG4gICAgYXJ0d29ya1VybD86IHN0cmluZztcbiAgICBkdXJhdGlvbj86IG51bWJlcjtcbiAgICBkaWZmaWN1bHR5OiAnYmVnaW5uZXInIHwgJ2ludGVybWVkaWF0ZScgfCAnYWR2YW5jZWQnO1xuICB9O1xuICBseXJpY3M/OiB7XG4gICAgc291cmNlOiBzdHJpbmc7XG4gICAgdHlwZTogJ3N5bmNlZCc7XG4gICAgbGluZXM6IEx5cmljTGluZVtdO1xuICAgIHRvdGFsTGluZXM6IG51bWJlcjtcbiAgfTtcbiAgbWVzc2FnZT86IHN0cmluZztcbiAgZXJyb3I/OiBzdHJpbmc7XG4gIGFwaV9jb25uZWN0ZWQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEx5cmljTGluZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRleHQ6IHN0cmluZztcbiAgc3RhcnRUaW1lOiBudW1iZXI7XG4gIGR1cmF0aW9uOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgS2FyYW9rZVNlc3Npb24ge1xuICBpZDogc3RyaW5nO1xuICB0cmFja0lkOiBzdHJpbmc7XG4gIHNvbmdUaXRsZTogc3RyaW5nO1xuICBzb25nQXJ0aXN0OiBzdHJpbmc7XG4gIHN0YXR1czogc3RyaW5nO1xuICBjcmVhdGVkQXQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEthcmFva2VBcGlTZXJ2aWNlIHtcbiAgcHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgLy8gVXNlIHRoZSBsb2NhbCBzZXJ2ZXIgZW5kcG9pbnRcbiAgICB0aGlzLmJhc2VVcmwgPSAnaHR0cDovL2xvY2FsaG9zdDo4Nzg3L2FwaSc7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGthcmFva2UgZGF0YSBmb3IgYSB0cmFjayBJRCAoWW91VHViZS9Tb3VuZENsb3VkKVxuICAgKi9cbiAgYXN5bmMgZ2V0S2FyYW9rZURhdGEoXG4gICAgdHJhY2tJZDogc3RyaW5nLCBcbiAgICB0aXRsZT86IHN0cmluZywgXG4gICAgYXJ0aXN0Pzogc3RyaW5nXG4gICk6IFByb21pc2U8S2FyYW9rZURhdGEgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoKTtcbiAgICAgIGlmICh0aXRsZSkgcGFyYW1zLnNldCgndGl0bGUnLCB0aXRsZSk7XG4gICAgICBpZiAoYXJ0aXN0KSBwYXJhbXMuc2V0KCdhcnRpc3QnLCBhcnRpc3QpO1xuICAgICAgXG4gICAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2thcmFva2UvJHtlbmNvZGVVUklDb21wb25lbnQodHJhY2tJZCl9JHtwYXJhbXMudG9TdHJpbmcoKSA/ICc/JyArIHBhcmFtcy50b1N0cmluZygpIDogJyd9YDtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXBpXSBGZXRjaGluZyBrYXJhb2tlIGRhdGE6JywgdXJsKTtcbiAgICAgIFxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgLy8gUmVtb3ZlIENvbnRlbnQtVHlwZSBoZWFkZXIgdG8gYXZvaWQgQ09SUyBwcmVmbGlnaHRcbiAgICAgICAgLy8gaGVhZGVyczoge1xuICAgICAgICAvLyAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIC8vIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGZldGNoIGthcmFva2UgZGF0YTonLCByZXNwb25zZS5zdGF0dXMpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUFwaV0gUmVjZWl2ZWQga2FyYW9rZSBkYXRhOicsIGRhdGEpO1xuICAgICAgXG4gICAgICAvLyBJZiB0aGVyZSdzIGFuIGVycm9yIGJ1dCB3ZSBnb3QgYSByZXNwb25zZSwgaXQgbWVhbnMgQVBJIGlzIGNvbm5lY3RlZFxuICAgICAgaWYgKGRhdGEuZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXBpXSBTZXJ2ZXIgZXJyb3IgKGJ1dCBBUEkgaXMgcmVhY2hhYmxlKTonLCBkYXRhLmVycm9yKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBoYXNfa2FyYW9rZTogZmFsc2UsXG4gICAgICAgICAgZXJyb3I6IGRhdGEuZXJyb3IsXG4gICAgICAgICAgdHJhY2tfaWQ6IHRyYWNrSWQsXG4gICAgICAgICAgYXBpX2Nvbm5lY3RlZDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEVycm9yIGZldGNoaW5nIGthcmFva2UgZGF0YTonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgYSBrYXJhb2tlIHNlc3Npb25cbiAgICovXG4gIGFzeW5jIHN0YXJ0U2Vzc2lvbihcbiAgICB0cmFja0lkOiBzdHJpbmcsXG4gICAgc29uZ0RhdGE6IHtcbiAgICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgICBhcnRpc3Q6IHN0cmluZztcbiAgICAgIGFsYnVtPzogc3RyaW5nO1xuICAgICAgZHVyYXRpb24/OiBudW1iZXI7XG4gICAgfVxuICApOiBQcm9taXNlPEthcmFva2VTZXNzaW9uIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuYmFzZVVybH0va2FyYW9rZS9zdGFydGAsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgIC8vIFRPRE86IEFkZCBhdXRoIHRva2VuIHdoZW4gYXZhaWxhYmxlXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICB0cmFja0lkLFxuICAgICAgICAgIHNvbmdEYXRhLFxuICAgICAgICB9KSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gc3RhcnQgc2Vzc2lvbjonLCByZXNwb25zZS5zdGF0dXMpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgcmV0dXJuIHJlc3VsdC5zZXNzaW9uO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRXJyb3Igc3RhcnRpbmcgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGVzdCBjb25uZWN0aW9uIHRvIHRoZSBBUElcbiAgICovXG4gIGFzeW5jIHRlc3RDb25uZWN0aW9uKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuYmFzZVVybC5yZXBsYWNlKCcvYXBpJywgJycpfS9oZWFsdGhgKTtcbiAgICAgIHJldHVybiByZXNwb25zZS5vaztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIENvbm5lY3Rpb24gdGVzdCBmYWlsZWQ6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY29uc3Qga2FyYW9rZUFwaSA9IG5ldyBLYXJhb2tlQXBpU2VydmljZSgpOyIsImltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IFByYWN0aWNlRXhlcmNpc2VWaWV3IH0gZnJvbSAnQHNjYXJsZXR0L3VpJztcblxuaW50ZXJmYWNlIFByYWN0aWNlVmlld1Byb3BzIHtcbiAgc2Vzc2lvbklkPzogc3RyaW5nO1xuICBvbkJhY2s6ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBQcmFjdGljZVZpZXc6IENvbXBvbmVudDxQcmFjdGljZVZpZXdQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8UHJhY3RpY2VFeGVyY2lzZVZpZXcgXG4gICAgICBzZXNzaW9uSWQ9e3Byb3BzLnNlc3Npb25JZH1cbiAgICAgIG9uQmFjaz17cHJvcHMub25CYWNrfVxuICAgICAgLy8gRXh0ZW5zaW9uIGRvZXNuJ3QgdXNlIGF1dGggeWV0XG4gICAgICAvLyBhcGlCYXNlVXJsIGlzIGRlZmF1bHQgbG9jYWxob3N0Ojg3ODdcbiAgICAvPlxuICApO1xufTsiLCJpbXBvcnQgeyBDb21wb25lbnQsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlRWZmZWN0LCBvbk1vdW50LCBvbkNsZWFudXAsIFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25LYXJhb2tlVmlldywgTWluaW1pemVkS2FyYW9rZSwgQ291bnRkb3duLCBDb21wbGV0aW9uVmlldywgdXNlS2FyYW9rZVNlc3Npb24sIEV4dGVuc2lvbkF1ZGlvU2VydmljZSwgSTE4blByb3ZpZGVyLCB0eXBlIFBsYXliYWNrU3BlZWQgfSBmcm9tICdAc2NhcmxldHQvdWknO1xuaW1wb3J0IHsgdHJhY2tEZXRlY3RvciwgdHlwZSBUcmFja0luZm8gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy90cmFjay1kZXRlY3Rvcic7XG5pbXBvcnQgeyBnZXRBdXRoVG9rZW4gfSBmcm9tICcuLi8uLi91dGlscy9zdG9yYWdlJztcbmltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG5pbXBvcnQgeyBrYXJhb2tlQXBpIH0gZnJvbSAnLi4vLi4vc2VydmljZXMva2FyYW9rZS1hcGknO1xuaW1wb3J0IHsgUHJhY3RpY2VWaWV3IH0gZnJvbSAnLi9QcmFjdGljZVZpZXcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbnRlbnRBcHBQcm9wcyB7fVxuXG5leHBvcnQgY29uc3QgQ29udGVudEFwcDogQ29tcG9uZW50PENvbnRlbnRBcHBQcm9wcz4gPSAoKSA9PiB7XG4gIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUmVuZGVyaW5nIENvbnRlbnRBcHAgY29tcG9uZW50Jyk7XG4gIFxuICAvLyBTdGF0ZVxuICBjb25zdCBbY3VycmVudFRyYWNrLCBzZXRDdXJyZW50VHJhY2tdID0gY3JlYXRlU2lnbmFsPFRyYWNrSW5mbyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbYXV0aFRva2VuLCBzZXRBdXRoVG9rZW5dID0gY3JlYXRlU2lnbmFsPHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbc2hvd0thcmFva2UsIHNldFNob3dLYXJhb2tlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtrYXJhb2tlRGF0YSwgc2V0S2FyYW9rZURhdGFdID0gY3JlYXRlU2lnbmFsPGFueT4obnVsbCk7XG4gIGNvbnN0IFtsb2FkaW5nLCBzZXRMb2FkaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtzZXNzaW9uU3RhcnRlZCwgc2V0U2Vzc2lvblN0YXJ0ZWRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2lzTWluaW1pemVkLCBzZXRJc01pbmltaXplZF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbY291bnRkb3duLCBzZXRDb3VudGRvd25dID0gY3JlYXRlU2lnbmFsPG51bWJlciB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbaXNQbGF5aW5nLCBzZXRJc1BsYXlpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2N1cnJlbnRUaW1lLCBzZXRDdXJyZW50VGltZV0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFthdWRpb1JlZiwgc2V0QXVkaW9SZWZdID0gY3JlYXRlU2lnbmFsPEhUTUxBdWRpb0VsZW1lbnQgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2thcmFva2VTZXNzaW9uLCBzZXRLYXJhb2tlU2Vzc2lvbl0gPSBjcmVhdGVTaWduYWw8UmV0dXJuVHlwZTx0eXBlb2YgdXNlS2FyYW9rZVNlc3Npb24+IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtjb21wbGV0aW9uRGF0YSwgc2V0Q29tcGxldGlvbkRhdGFdID0gY3JlYXRlU2lnbmFsPGFueT4obnVsbCk7XG4gIGNvbnN0IFtzaG93UHJhY3RpY2UsIHNldFNob3dQcmFjdGljZV0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbc2VsZWN0ZWRTcGVlZCwgc2V0U2VsZWN0ZWRTcGVlZF0gPSBjcmVhdGVTaWduYWw8UGxheWJhY2tTcGVlZD4oJzF4Jyk7XG4gIFxuICAvLyBMb2FkIGF1dGggdG9rZW4gb24gbW91bnRcbiAgb25Nb3VudChhc3luYyAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBMb2FkaW5nIGF1dGggdG9rZW4nKTtcbiAgICBjb25zdCB0b2tlbiA9IGF3YWl0IGdldEF1dGhUb2tlbigpO1xuICAgIGlmICh0b2tlbikge1xuICAgICAgc2V0QXV0aFRva2VuKHRva2VuKTtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXV0aCB0b2tlbiBsb2FkZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVXNlIGRlbW8gdG9rZW4gZm9yIGRldmVsb3BtZW50XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE5vIGF1dGggdG9rZW4gZm91bmQsIHVzaW5nIGRlbW8gdG9rZW4nKTtcbiAgICAgIHNldEF1dGhUb2tlbignc2NhcmxldHRfZGVtb190b2tlbl8xMjMnKTtcbiAgICB9XG4gICAgXG4gICAgLy8gU3RhcnQgd2F0Y2hpbmcgZm9yIHRyYWNrIGNoYW5nZXNcbiAgICBjb25zdCBjbGVhbnVwID0gdHJhY2tEZXRlY3Rvci53YXRjaEZvckNoYW5nZXMoKHRyYWNrKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFRyYWNrIGNoYW5nZWQ6JywgdHJhY2spO1xuICAgICAgc2V0Q3VycmVudFRyYWNrKHRyYWNrKTtcbiAgICAgIC8vIFNob3cga2FyYW9rZSB3aGVuIHRyYWNrIGlzIGRldGVjdGVkIGFuZCBmZXRjaCBkYXRhXG4gICAgICBpZiAodHJhY2spIHtcbiAgICAgICAgc2V0U2hvd0thcmFva2UodHJ1ZSk7XG4gICAgICAgIGZldGNoS2FyYW9rZURhdGEodHJhY2spO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgb25DbGVhbnVwKGNsZWFudXApO1xuICB9KTtcblxuICBjb25zdCBmZXRjaEthcmFva2VEYXRhID0gYXN5bmMgKHRyYWNrOiBUcmFja0luZm8pID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZldGNoaW5nIGthcmFva2UgZGF0YSBmb3IgdHJhY2s6JywgdHJhY2spO1xuICAgIHNldExvYWRpbmcodHJ1ZSk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBrYXJhb2tlQXBpLmdldEthcmFva2VEYXRhKFxuICAgICAgICB0cmFjay50cmFja0lkLFxuICAgICAgICB0cmFjay50aXRsZSxcbiAgICAgICAgdHJhY2suYXJ0aXN0XG4gICAgICApO1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBLYXJhb2tlIGRhdGEgbG9hZGVkOicsIGRhdGEpO1xuICAgICAgc2V0S2FyYW9rZURhdGEoZGF0YSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tDb250ZW50QXBwXSBGYWlsZWQgdG8gZmV0Y2gga2FyYW9rZSBkYXRhOicsIGVycm9yKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0TG9hZGluZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVN0YXJ0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU3RhcnQga2FyYW9rZSBzZXNzaW9uJyk7XG4gICAgc2V0U2Vzc2lvblN0YXJ0ZWQodHJ1ZSk7XG4gICAgXG4gICAgY29uc3QgZGF0YSA9IGthcmFva2VEYXRhKCk7XG4gICAgY29uc3QgYXVkaW8gPSBhdWRpb1JlZigpO1xuICAgIGNvbnN0IHRyYWNrID0gY3VycmVudFRyYWNrKCk7XG4gICAgXG4gICAgaWYgKGRhdGEgJiYgdHJhY2sgJiYgZGF0YS5seXJpY3M/LmxpbmVzKSB7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIENyZWF0aW5nIGthcmFva2Ugc2Vzc2lvbiB3aXRoIGF1ZGlvIGNhcHR1cmUnLCB7XG4gICAgICAgIHRyYWNrSWQ6IHRyYWNrLmlkLFxuICAgICAgICB0cmFja1RpdGxlOiB0cmFjay50aXRsZSxcbiAgICAgICAgc29uZ0RhdGE6IGRhdGEuc29uZyxcbiAgICAgICAgaGFzTHlyaWNzOiAhIWRhdGEubHlyaWNzPy5saW5lc1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIENyZWF0ZSBhbmQgc3RhcnQgc2Vzc2lvblxuICAgICAgY29uc3QgbmV3U2Vzc2lvbiA9IHVzZUthcmFva2VTZXNzaW9uKHtcbiAgICAgICAgbHlyaWNzOiBkYXRhLmx5cmljcy5saW5lcyxcbiAgICAgICAgdHJhY2tJZDogdHJhY2sudHJhY2tJZCxcbiAgICAgICAgc29uZ0RhdGE6IGRhdGEuc29uZyA/IHtcbiAgICAgICAgICB0aXRsZTogZGF0YS5zb25nLnRpdGxlLFxuICAgICAgICAgIGFydGlzdDogZGF0YS5zb25nLmFydGlzdCxcbiAgICAgICAgICBhbGJ1bTogZGF0YS5zb25nLmFsYnVtLFxuICAgICAgICAgIGR1cmF0aW9uOiBkYXRhLnNvbmcuZHVyYXRpb25cbiAgICAgICAgfSA6IHtcbiAgICAgICAgICB0aXRsZTogdHJhY2sudGl0bGUsXG4gICAgICAgICAgYXJ0aXN0OiB0cmFjay5hcnRpc3RcbiAgICAgICAgfSxcbiAgICAgICAgc29uZ0NhdGFsb2dJZDogZGF0YS5zb25nX2NhdGFsb2dfaWQsXG4gICAgICAgIGF1ZGlvRWxlbWVudDogdW5kZWZpbmVkLCAvLyBXaWxsIGJlIHNldCB3aGVuIGF1ZGlvIHN0YXJ0cyBwbGF5aW5nXG4gICAgICAgIGFwaVVybDogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODc4Ny9hcGknLFxuICAgICAgICBvbkNvbXBsZXRlOiAocmVzdWx0cykgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gS2FyYW9rZSBzZXNzaW9uIGNvbXBsZXRlZDonLCByZXN1bHRzKTtcbiAgICAgICAgICBzZXRTZXNzaW9uU3RhcnRlZChmYWxzZSk7XG4gICAgICAgICAgc2V0SXNQbGF5aW5nKGZhbHNlKTtcbiAgICAgICAgICBzZXRDb21wbGV0aW9uRGF0YShyZXN1bHRzKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBTdG9wIGF1ZGlvIHBsYXliYWNrXG4gICAgICAgICAgY29uc3QgYXVkaW8gPSBhdWRpb1JlZigpO1xuICAgICAgICAgIGlmIChhdWRpbykge1xuICAgICAgICAgICAgYXVkaW8ucGF1c2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyBBcHBseSB0aGUgc2VsZWN0ZWQgc3BlZWQgdG8gdGhlIG5ldyBzZXNzaW9uXG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEFwcGx5aW5nIHNlbGVjdGVkIHNwZWVkIHRvIG5ldyBzZXNzaW9uOicsIHNlbGVjdGVkU3BlZWQoKSk7XG4gICAgICBuZXdTZXNzaW9uLmhhbmRsZVNwZWVkQ2hhbmdlKHNlbGVjdGVkU3BlZWQoKSk7XG4gICAgICBcbiAgICAgIHNldEthcmFva2VTZXNzaW9uKG5ld1Nlc3Npb24pO1xuICAgICAgXG4gICAgICAvLyBTdGFydCB0aGUgc2Vzc2lvbiAoaW5jbHVkZXMgY291bnRkb3duIGFuZCBhdWRpbyBpbml0aWFsaXphdGlvbilcbiAgICAgIGF3YWl0IG5ld1Nlc3Npb24uc3RhcnRTZXNzaW9uKCk7XG4gICAgICBcbiAgICAgIC8vIFdhdGNoIGZvciBjb3VudGRvd24gdG8gZmluaXNoIGFuZCBzdGFydCBhdWRpb1xuICAgICAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKG5ld1Nlc3Npb24uY291bnRkb3duKCkgPT09IG51bGwgJiYgbmV3U2Vzc2lvbi5pc1BsYXlpbmcoKSAmJiAhaXNQbGF5aW5nKCkpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIENvdW50ZG93biBmaW5pc2hlZCwgc3RhcnRpbmcgYXVkaW8gcGxheWJhY2snKTtcbiAgICAgICAgICBzdGFydEF1ZGlvUGxheWJhY2soKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gVXBkYXRlIHNlc3Npb24gd2l0aCBhdWRpbyBlbGVtZW50IHdoZW4gYXZhaWxhYmxlXG4gICAgICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9SZWYoKTtcbiAgICAgICAgaWYgKGF1ZGlvICYmIG5ld1Nlc3Npb24pIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFNldHRpbmcgYXVkaW8gZWxlbWVudCBvbiBuZXcgc2Vzc2lvbicpO1xuICAgICAgICAgIG5ld1Nlc3Npb24uc2V0QXVkaW9FbGVtZW50KGF1ZGlvKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRmFsbGJhY2sgdG8gc2ltcGxlIGNvdW50ZG93bicpO1xuICAgICAgLy8gRmFsbGJhY2sgdG8gb2xkIGJlaGF2aW9yXG4gICAgICBzZXRDb3VudGRvd24oMyk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNvdW50ZG93bkludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gY291bnRkb3duKCk7XG4gICAgICAgIGlmIChjdXJyZW50ICE9PSBudWxsICYmIGN1cnJlbnQgPiAxKSB7XG4gICAgICAgICAgc2V0Q291bnRkb3duKGN1cnJlbnQgLSAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjbGVhckludGVydmFsKGNvdW50ZG93bkludGVydmFsKTtcbiAgICAgICAgICBzZXRDb3VudGRvd24obnVsbCk7XG4gICAgICAgICAgc3RhcnRBdWRpb1BsYXliYWNrKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIDEwMDApO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBzdGFydEF1ZGlvUGxheWJhY2sgPSAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTdGFydGluZyBhdWRpbyBwbGF5YmFjaycpO1xuICAgIHNldElzUGxheWluZyh0cnVlKTtcbiAgICBcbiAgICAvLyBUcnkgbXVsdGlwbGUgbWV0aG9kcyB0byBmaW5kIGFuZCBwbGF5IGF1ZGlvXG4gICAgLy8gTWV0aG9kIDE6IExvb2sgZm9yIGF1ZGlvIGVsZW1lbnRzXG4gICAgY29uc3QgYXVkaW9FbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2F1ZGlvJyk7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGb3VuZCBhdWRpbyBlbGVtZW50czonLCBhdWRpb0VsZW1lbnRzLmxlbmd0aCk7XG4gICAgXG4gICAgaWYgKGF1ZGlvRWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgYXVkaW8gPSBhdWRpb0VsZW1lbnRzWzBdIGFzIEhUTUxBdWRpb0VsZW1lbnQ7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEF1ZGlvIGVsZW1lbnQ6Jywge1xuICAgICAgICBzcmM6IGF1ZGlvLnNyYyxcbiAgICAgICAgcGF1c2VkOiBhdWRpby5wYXVzZWQsXG4gICAgICAgIGR1cmF0aW9uOiBhdWRpby5kdXJhdGlvbixcbiAgICAgICAgY3VycmVudFRpbWU6IGF1ZGlvLmN1cnJlbnRUaW1lXG4gICAgICB9KTtcbiAgICAgIHNldEF1ZGlvUmVmKGF1ZGlvKTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIGthcmFva2Ugc2Vzc2lvbiB3aXRoIGF1ZGlvIGVsZW1lbnQgaWYgaXQgZXhpc3RzXG4gICAgICBjb25zdCBzZXNzaW9uID0ga2FyYW9rZVNlc3Npb24oKTtcbiAgICAgIGlmIChzZXNzaW9uKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU2V0dGluZyBhdWRpbyBlbGVtZW50IG9uIGthcmFva2Ugc2Vzc2lvbicpO1xuICAgICAgICBzZXNzaW9uLnNldEF1ZGlvRWxlbWVudChhdWRpbyk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlc3Npb24uYXVkaW9Qcm9jZXNzb3IuaXNSZWFkeSgpKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBJbml0aWFsaXppbmcgYXVkaW8gcHJvY2Vzc29yIGZvciBzZXNzaW9uJyk7XG4gICAgICAgICAgc2Vzc2lvbi5hdWRpb1Byb2Nlc3Nvci5pbml0aWFsaXplKCkuY2F0Y2goY29uc29sZS5lcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gVHJ5IHRvIHBsYXkgdGhlIGF1ZGlvXG4gICAgICBhdWRpby5wbGF5KCkudGhlbigoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXVkaW8gc3RhcnRlZCBwbGF5aW5nIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgfSkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0NvbnRlbnRBcHBdIEZhaWxlZCB0byBwbGF5IGF1ZGlvOicsIGVycik7XG4gICAgICAgIFxuICAgICAgICAvLyBNZXRob2QgMjogVHJ5IGNsaWNraW5nIHRoZSBwbGF5IGJ1dHRvbiBvbiB0aGUgcGFnZVxuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEF0dGVtcHRpbmcgdG8gY2xpY2sgcGxheSBidXR0b24uLi4nKTtcbiAgICAgICAgY29uc3QgcGxheUJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvblt0aXRsZSo9XCJQbGF5XCJdLCBidXR0b25bYXJpYS1sYWJlbCo9XCJQbGF5XCJdLCAucGxheUNvbnRyb2wsIC5wbGF5QnV0dG9uLCBbY2xhc3MqPVwicGxheS1idXR0b25cIl0nKTtcbiAgICAgICAgaWYgKHBsYXlCdXR0b24pIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZvdW5kIHBsYXkgYnV0dG9uLCBjbGlja2luZyBpdCcpO1xuICAgICAgICAgIChwbGF5QnV0dG9uIGFzIEhUTUxFbGVtZW50KS5jbGljaygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIGN1cnJlbnQgdGltZVxuICAgICAgY29uc3QgdXBkYXRlVGltZSA9ICgpID0+IHtcbiAgICAgICAgc2V0Q3VycmVudFRpbWUoYXVkaW8uY3VycmVudFRpbWUpO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIHVwZGF0ZVRpbWUpO1xuICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCAoKSA9PiB7XG4gICAgICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgICAgIGF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB1cGRhdGVUaW1lKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBNZXRob2QgMzogVHJ5IFNvdW5kQ2xvdWQgc3BlY2lmaWMgc2VsZWN0b3JzXG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE5vIGF1ZGlvIGVsZW1lbnRzIGZvdW5kLCB0cnlpbmcgU291bmRDbG91ZC1zcGVjaWZpYyBhcHByb2FjaCcpO1xuICAgICAgY29uc3QgcGxheUJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5wbGF5Q29udHJvbCwgLnNjLWJ1dHRvbi1wbGF5LCBidXR0b25bdGl0bGUqPVwiUGxheVwiXScpO1xuICAgICAgaWYgKHBsYXlCdXR0b24pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGb3VuZCBTb3VuZENsb3VkIHBsYXkgYnV0dG9uLCBjbGlja2luZyBpdCcpO1xuICAgICAgICAocGxheUJ1dHRvbiBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFdhaXQgYSBiaXQgYW5kIHRoZW4gbG9vayBmb3IgYXVkaW8gZWxlbWVudCBhZ2FpblxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICBjb25zdCBuZXdBdWRpb0VsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnYXVkaW8nKTtcbiAgICAgICAgICBpZiAobmV3QXVkaW9FbGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZvdW5kIGF1ZGlvIGVsZW1lbnQgYWZ0ZXIgY2xpY2tpbmcgcGxheScpO1xuICAgICAgICAgICAgY29uc3QgYXVkaW8gPSBuZXdBdWRpb0VsZW1lbnRzWzBdIGFzIEhUTUxBdWRpb0VsZW1lbnQ7XG4gICAgICAgICAgICBzZXRBdWRpb1JlZihhdWRpbyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFVwZGF0ZSBjdXJyZW50IHRpbWVcbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZVRpbWUgPSAoKSA9PiB7XG4gICAgICAgICAgICAgIHNldEN1cnJlbnRUaW1lKGF1ZGlvLmN1cnJlbnRUaW1lKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB1cGRhdGVUaW1lKTtcbiAgICAgICAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgKCkgPT4ge1xuICAgICAgICAgICAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgICAgICAgICAgICBhdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdXBkYXRlVGltZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIDUwMCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUNsb3NlID0gKCkgPT4ge1xuICAgIC8vIFN0b3Agc2Vzc2lvbiBpZiBhY3RpdmVcbiAgICBjb25zdCBzZXNzaW9uID0ga2FyYW9rZVNlc3Npb24oKTtcbiAgICBpZiAoc2Vzc2lvbikge1xuICAgICAgc2Vzc2lvbi5zdG9wU2Vzc2lvbigpO1xuICAgIH1cbiAgICBcbiAgICBzZXRTaG93S2FyYW9rZShmYWxzZSk7XG4gICAgc2V0S2FyYW9rZURhdGEobnVsbCk7XG4gICAgc2V0U2Vzc2lvblN0YXJ0ZWQoZmFsc2UpO1xuICAgIHNldEthcmFva2VTZXNzaW9uKG51bGwpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZU1pbmltaXplID0gKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTWluaW1pemUga2FyYW9rZSB3aWRnZXQnKTtcbiAgICBzZXRJc01pbmltaXplZCh0cnVlKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVSZXN0b3JlID0gKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUmVzdG9yZSBrYXJhb2tlIHdpZGdldCcpO1xuICAgIHNldElzTWluaW1pemVkKGZhbHNlKTtcbiAgfTtcblxuICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlbmRlciBzdGF0ZTonLCB7XG4gICAgc2hvd0thcmFva2U6IHNob3dLYXJhb2tlKCksXG4gICAgY3VycmVudFRyYWNrOiBjdXJyZW50VHJhY2soKSxcbiAgICBrYXJhb2tlRGF0YToga2FyYW9rZURhdGEoKSxcbiAgICBsb2FkaW5nOiBsb2FkaW5nKClcbiAgfSk7XG5cblxuICByZXR1cm4gKFxuICAgIDw+XG4gICAgICB7LyogTWluaW1pemVkIHN0YXRlICovfVxuICAgICAgPFNob3cgd2hlbj17c2hvd0thcmFva2UoKSAmJiBjdXJyZW50VHJhY2soKSAmJiBpc01pbmltaXplZCgpfT5cbiAgICAgICAgPE1pbmltaXplZEthcmFva2Ugb25DbGljaz17aGFuZGxlUmVzdG9yZX0gLz5cbiAgICAgIDwvU2hvdz5cblxuICAgICAgey8qIEZ1bGwgd2lkZ2V0IHN0YXRlICovfVxuICAgICAgPFNob3cgd2hlbj17c2hvd0thcmFva2UoKSAmJiBjdXJyZW50VHJhY2soKSAmJiAhaXNNaW5pbWl6ZWQoKX0gZmFsbGJhY2s9e1xuICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdub25lJyB9fT5cbiAgICAgICAgICB7Y29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBOb3Qgc2hvd2luZyAtIHNob3dLYXJhb2tlOicsIHNob3dLYXJhb2tlKCksICdjdXJyZW50VHJhY2s6JywgY3VycmVudFRyYWNrKCkpfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIH0+XG4gICAgICAgIDxkaXYgc3R5bGU9e3tcbiAgICAgICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgICAgICB0b3A6ICcyMHB4JyxcbiAgICAgICAgICByaWdodDogJzIwcHgnLFxuICAgICAgICAgIGJvdHRvbTogJzIwcHgnLFxuICAgICAgICAgIHdpZHRoOiAnNDgwcHgnLFxuICAgICAgICAgICd6LWluZGV4JzogJzk5OTk5JyxcbiAgICAgICAgICBvdmVyZmxvdzogJ2hpZGRlbicsXG4gICAgICAgICAgJ2JvcmRlci1yYWRpdXMnOiAnMTZweCcsXG4gICAgICAgICAgJ2JveC1zaGFkb3cnOiAnMCAyNXB4IDUwcHggLTEycHggcmdiYSgwLCAwLCAwLCAwLjYpJyxcbiAgICAgICAgICBkaXNwbGF5OiAnZmxleCcsXG4gICAgICAgICAgJ2ZsZXgtZGlyZWN0aW9uJzogJ2NvbHVtbidcbiAgICAgICAgfX0+XG4gICAgICAgICAge2NvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUmVuZGVyaW5nIHdpdGggY29tcGxldGlvbiBkYXRhOicsIGNvbXBsZXRpb25EYXRhKCkpfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJoLWZ1bGwgYmctc3VyZmFjZSByb3VuZGVkLTJ4bCBvdmVyZmxvdy1oaWRkZW4gZmxleCBmbGV4LWNvbFwiPlxuICAgICAgICAgICAgey8qIEhlYWRlciB3aXRoIG1pbmltaXplIGFuZCBjbG9zZSBidXR0b25zICovfVxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktZW5kIHAtMiBiZy1zdXJmYWNlIGJvcmRlci1iIGJvcmRlci1zdWJ0bGVcIiBzdHlsZT17eyBoZWlnaHQ6ICc0OHB4JyB9fT5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17c2hvd1ByYWN0aWNlKCl9PlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93UHJhY3RpY2UoZmFsc2UpfVxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctMTAgaC0xMCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzIGhvdmVyOmJnLXdoaXRlLzEwXCJcbiAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgY29sb3I6ICcjYThhOGE4JyB9fVxuICAgICAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiQ2xvc2UgUHJhY3RpY2VcIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICA8c3ZnIHdpZHRoPVwiMjBcIiBoZWlnaHQ9XCIyMFwiIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPVwiTTE1IDVMNSAxNU01IDVMMTUgMTVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIvPlxuICAgICAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVNaW5pbWl6ZX1cbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy0xMCBoLTEwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbGcgdHJhbnNpdGlvbi1jb2xvcnMgaG92ZXI6Ymctd2hpdGUvMTBcIlxuICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgY29sb3I6ICcjYThhOGE4JyB9fVxuICAgICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIk1pbmltaXplXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8c3ZnIHdpZHRoPVwiMjRcIiBoZWlnaHQ9XCIyNFwiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj5cbiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD1cIk02IDEyaDEyXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiM1wiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIi8+XG4gICAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgey8qIE1haW4gY29udGVudCBhcmVhICovfVxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBtaW4taC0wIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtjb21wbGV0aW9uRGF0YSgpfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17IWxvYWRpbmcoKX0gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGgtZnVsbCBiZy1iYXNlXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhbmltYXRlLXNwaW4gcm91bmRlZC1mdWxsIGgtMTIgdy0xMiBib3JkZXItYi0yIGJvcmRlci1hY2NlbnQtcHJpbWFyeSBteC1hdXRvIG1iLTRcIj48L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc2Vjb25kYXJ5XCI+TG9hZGluZyBseXJpY3MuLi48L3A+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e2thcmFva2VEYXRhKCk/Lmx5cmljcz8ubGluZXN9IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGgtZnVsbCBwLThcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0yXCI+Tm8gbHlyaWNzIGF2YWlsYWJsZTwvcD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zbSB0ZXh0LXRlcnRpYXJ5XCI+VHJ5IGEgZGlmZmVyZW50IHNvbmc8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImgtZnVsbCBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBtaW4taC0wIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPEV4dGVuc2lvbkthcmFva2VWaWV3XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3JlPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuc2NvcmUoKSA6IDB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJhbms9ezF9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGx5cmljcz17a2FyYW9rZURhdGEoKT8ubHlyaWNzPy5saW5lcyB8fCBbXX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudFRpbWU9e2thcmFva2VTZXNzaW9uKCkgPyBrYXJhb2tlU2Vzc2lvbigpIS5jdXJyZW50VGltZSgpIDogY3VycmVudFRpbWUoKSAqIDEwMDB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxlYWRlcmJvYXJkPXtbXX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgaXNQbGF5aW5nPXtrYXJhb2tlU2Vzc2lvbigpID8gKGthcmFva2VTZXNzaW9uKCkhLmlzUGxheWluZygpIHx8IGthcmFva2VTZXNzaW9uKCkhLmNvdW50ZG93bigpICE9PSBudWxsKSA6IChpc1BsYXlpbmcoKSB8fCBjb3VudGRvd24oKSAhPT0gbnVsbCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uU3RhcnQ9e2hhbmRsZVN0YXJ0fVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvblNwZWVkQ2hhbmdlPXsoc3BlZWQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFNwZWVkIGNoYW5nZWQ6Jywgc3BlZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFNlbGVjdGVkU3BlZWQoc3BlZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb24gPSBrYXJhb2tlU2Vzc2lvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZXNzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEFwcGx5aW5nIHNwZWVkIGNoYW5nZSB0byBzZXNzaW9uJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXNzaW9uLmhhbmRsZVNwZWVkQ2hhbmdlKHNwZWVkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBObyBzZXNzaW9uIHlldCwgc3BlZWQgd2lsbCBiZSBhcHBsaWVkIHdoZW4gc2Vzc2lvbiBzdGFydHMnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQWxzbyBhcHBseSB0byBhdWRpbyBlbGVtZW50IGRpcmVjdGx5IGlmIGl0IGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9SZWYoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXVkaW8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJhdGUgPSBzcGVlZCA9PT0gJzAuNXgnID8gMC41IDogc3BlZWQgPT09ICcwLjc1eCcgPyAwLjc1IDogMS4wO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTZXR0aW5nIGF1ZGlvIHBsYXliYWNrIHJhdGUgZGlyZWN0bHkgdG86JywgcmF0ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdWRpby5wbGF5YmFja1JhdGUgPSByYXRlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgaXNSZWNvcmRpbmc9e2thcmFva2VTZXNzaW9uKCkgPyBrYXJhb2tlU2Vzc2lvbigpIS5pc1JlY29yZGluZygpIDogZmFsc2V9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVTY29yZXM9e2thcmFva2VTZXNzaW9uKCkgPyBrYXJhb2tlU2Vzc2lvbigpIS5saW5lU2NvcmVzKCkgOiBbXX1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgey8qIENvdW50ZG93biBvdmVybGF5ICovfVxuICAgICAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e2thcmFva2VTZXNzaW9uKCkgPyBrYXJhb2tlU2Vzc2lvbigpIS5jb3VudGRvd24oKSAhPT0gbnVsbCA6IGNvdW50ZG93bigpICE9PSBudWxsfT5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhYnNvbHV0ZSBpbnNldC0wIGJnLWJsYWNrLzgwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHotNTBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtOHhsIGZvbnQtYm9sZCB0ZXh0LXdoaXRlIGFuaW1hdGUtcHVsc2VcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuY291bnRkb3duKCkgOiBjb3VudGRvd24oKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQteGwgdGV4dC13aGl0ZS84MCBtdC00XCI+R2V0IHJlYWR5ITwvcD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICB7LyogQ29tcGxldGlvbiBWaWV3IG9yIFByYWN0aWNlIFZpZXcgKi99XG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17c2hvd1ByYWN0aWNlKCl9IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICAgIDxJMThuUHJvdmlkZXI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoLWZ1bGwgZmxleCBmbGV4LWNvbFwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49eyFjb21wbGV0aW9uRGF0YSgpLmlzTG9hZGluZ30gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGgtZnVsbCBiZy1iYXNlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhbmltYXRlLXNwaW4gcm91bmRlZC1mdWxsIGgtMTYgdy0xNiBib3JkZXItYi0yIGJvcmRlci1hY2NlbnQtcHJpbWFyeSBteC1hdXRvIG1iLTRcIj48L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1zZWNvbmRhcnlcIj5DYWxjdWxhdGluZyB5b3VyIGZpbmFsIHNjb3JlLi4uPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zbSB0ZXh0LXRlcnRpYXJ5IG10LTJcIj5BbmFseXppbmcgZnVsbCBwZXJmb3JtYW5jZTwvcD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICB9PlxuICAgICAgICAgICAgICAgICAgICAgICAgPENvbXBsZXRpb25WaWV3XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiaC1mdWxsXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcmU9e2NvbXBsZXRpb25EYXRhKCkuc2NvcmV9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJhbms9ezF9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNwZWVkPXtzZWxlY3RlZFNwZWVkKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGZlZWRiYWNrVGV4dD17XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGlvbkRhdGEoKS5zY29yZSA+PSA5NSA/IFwiUGVyZmVjdCEgWW91IG5haWxlZCBpdCFcIiA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGlvbkRhdGEoKS5zY29yZSA+PSA4NSA/IFwiRXhjZWxsZW50IHBlcmZvcm1hbmNlIVwiIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0aW9uRGF0YSgpLnNjb3JlID49IDcwID8gXCJHcmVhdCBqb2IhXCIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRpb25EYXRhKCkuc2NvcmUgPj0gNTAgPyBcIkdvb2QgZWZmb3J0IVwiIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIktlZXAgcHJhY3RpY2luZyFcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uUHJhY3RpY2U9eygpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFByYWN0aWNlIGVycm9ycyBjbGlja2VkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd1ByYWN0aWNlKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9JMThuUHJvdmlkZXI+XG4gICAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICAgIHsvKiBQcmFjdGljZSBWaWV3ICovfVxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImgtZnVsbCBvdmVyZmxvdy15LWF1dG9cIj5cbiAgICAgICAgICAgICAgICAgICAgPFByYWN0aWNlVmlld1xuICAgICAgICAgICAgICAgICAgICAgIHNlc3Npb25JZD17Y29tcGxldGlvbkRhdGEoKT8uc2Vzc2lvbklkfVxuICAgICAgICAgICAgICAgICAgICAgIG9uQmFjaz17KCkgPT4gc2V0U2hvd1ByYWN0aWNlKGZhbHNlKX1cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9TaG93PlxuICAgIDwvPlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaGFkb3dSb290VWkgfSBmcm9tICd3eHQvdXRpbHMvY29udGVudC1zY3JpcHQtdWkvc2hhZG93LXJvb3QnO1xuaW1wb3J0IHsgZGVmaW5lQ29udGVudFNjcmlwdCB9IGZyb20gJ3d4dC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQnO1xuaW1wb3J0IHR5cGUgeyBDb250ZW50U2NyaXB0Q29udGV4dCB9IGZyb20gJ3d4dC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0JztcbmltcG9ydCB7IHJlbmRlciB9IGZyb20gJ3NvbGlkLWpzL3dlYic7XG5pbXBvcnQgeyBDb250ZW50QXBwIH0gZnJvbSAnLi4vc3JjL3ZpZXdzL2NvbnRlbnQvQ29udGVudEFwcCc7XG5pbXBvcnQgJy4uL3NyYy9zdHlsZXMvZXh0ZW5zaW9uLmNzcyc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbnRlbnRTY3JpcHQoe1xuICBtYXRjaGVzOiBbJyo6Ly9zb3VuZGNsb3VkLmNvbS8qJywgJyo6Ly9zb3VuZGNsb2FrLmNvbS8qJywgJyo6Ly9zYy5tYWlkLnpvbmUvKicsICcqOi8vKi5tYWlkLnpvbmUvKiddLFxuICBydW5BdDogJ2RvY3VtZW50X2lkbGUnLFxuICBjc3NJbmplY3Rpb25Nb2RlOiAndWknLFxuXG4gIGFzeW5jIG1haW4oY3R4OiBDb250ZW50U2NyaXB0Q29udGV4dCkge1xuICAgIC8vIE9ubHkgcnVuIGluIHRvcC1sZXZlbCBmcmFtZSB0byBhdm9pZCBkdXBsaWNhdGUgcHJvY2Vzc2luZyBpbiBpZnJhbWVzXG4gICAgaWYgKHdpbmRvdy50b3AgIT09IHdpbmRvdy5zZWxmKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHNoYWRvdyBET00gYW5kIG1vdW50IGthcmFva2Ugd2lkZ2V0XG4gICAgY29uc3QgdWkgPSBhd2FpdCBjcmVhdGVTaGFkb3dSb290VWkoY3R4LCB7XG4gICAgICBuYW1lOiAnc2NhcmxldHQta2FyYW9rZS11aScsXG4gICAgICBwb3NpdGlvbjogJ292ZXJsYXknLFxuICAgICAgYW5jaG9yOiAnYm9keScsXG4gICAgICBvbk1vdW50OiBhc3luYyAoY29udGFpbmVyOiBIVE1MRWxlbWVudCkgPT4ge1xuICAgICAgICAvLyBDcmVhdGUgd3JhcHBlciBkaXYgKENvbnRlbnRBcHAgd2lsbCBoYW5kbGUgcG9zaXRpb25pbmcgYmFzZWQgb24gc3RhdGUpXG4gICAgICAgIGNvbnN0IHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgd3JhcHBlci5jbGFzc05hbWUgPSAna2FyYW9rZS13aWRnZXQtY29udGFpbmVyJztcbiAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKHdyYXBwZXIpO1xuXG4gICAgICAgIC8vIFJlbmRlciBDb250ZW50QXBwIGNvbXBvbmVudCAod2hpY2ggdXNlcyBFeHRlbnNpb25LYXJhb2tlVmlldylcbiAgICAgICAgY29uc3QgZGlzcG9zZSA9IHJlbmRlcigoKSA9PiA8Q29udGVudEFwcCAvPiwgd3JhcHBlcik7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gZGlzcG9zZTtcbiAgICAgIH0sXG4gICAgICBvblJlbW92ZTogKGNsZWFudXA/OiAoKSA9PiB2b2lkKSA9PiB7XG4gICAgICAgIGNsZWFudXA/LigpO1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIE1vdW50IHRoZSBVSVxuICAgIHVpLm1vdW50KCk7XG4gIH0sXG59KTsiLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKi9cbiAgc2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqL1xuICBzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKi9cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0pO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKi9cbiAgcmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9LCBvcHRpb25zKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuICAgIH1cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKFxuICAgICAgdHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsXG4gICAgICBoYW5kbGVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBzaWduYWw6IHRoaXMuc2lnbmFsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuICAgKi9cbiAgbm90aWZ5SW52YWxpZGF0ZWQoKSB7XG4gICAgdGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG4gICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgXG4gICAgKTtcbiAgfVxuICBzdG9wT2xkU2NyaXB0cygpIHtcbiAgICB3aW5kb3cucG9zdE1lc3NhZ2UoXG4gICAgICB7XG4gICAgICAgIHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcbiAgICAgICAgY29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG4gICAgICAgIG1lc3NhZ2VJZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMilcbiAgICAgIH0sXG4gICAgICBcIipcIlxuICAgICk7XG4gIH1cbiAgdmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG4gICAgY29uc3QgaXNTY3JpcHRTdGFydGVkRXZlbnQgPSBldmVudC5kYXRhPy50eXBlID09PSBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEU7XG4gICAgY29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRhdGE/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuICAgIGNvbnN0IGlzTm90RHVwbGljYXRlID0gIXRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmhhcyhldmVudC5kYXRhPy5tZXNzYWdlSWQpO1xuICAgIHJldHVybiBpc1NjcmlwdFN0YXJ0ZWRFdmVudCAmJiBpc1NhbWVDb250ZW50U2NyaXB0ICYmIGlzTm90RHVwbGljYXRlO1xuICB9XG4gIGxpc3RlbkZvck5ld2VyU2NyaXB0cyhvcHRpb25zKSB7XG4gICAgbGV0IGlzRmlyc3QgPSB0cnVlO1xuICAgIGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG4gICAgICBpZiAodGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmFkZChldmVudC5kYXRhLm1lc3NhZ2VJZCk7XG4gICAgICAgIGNvbnN0IHdhc0ZpcnN0ID0gaXNGaXJzdDtcbiAgICAgICAgaXNGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzRmlyc3QgJiYgb3B0aW9ucz8uaWdub3JlRmlyc3RFdmVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYik7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKSk7XG4gIH1cbn1cbiIsImltcG9ydCBjb21tb24gZnJvbSAnLi9jb21tb24uanNvbic7XG5pbXBvcnQga2FyYW9rZSBmcm9tICcuL2thcmFva2UuanNvbic7XG5pbXBvcnQgZGlzcGxheSBmcm9tICcuL2Rpc3BsYXkuanNvbic7XG5pbXBvcnQgdHlwZSB7IFRyYW5zbGF0aW9ucyB9IGZyb20gJy4uLy4uL3R5cGVzJztcblxuY29uc3QgdHJhbnNsYXRpb25zOiBUcmFuc2xhdGlvbnMgPSB7XG4gIGNvbW1vbixcbiAga2FyYW9rZSxcbiAgZGlzcGxheSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHRyYW5zbGF0aW9uczsiLCJpbXBvcnQgY29tbW9uIGZyb20gJy4vY29tbW9uLmpzb24nO1xuaW1wb3J0IGthcmFva2UgZnJvbSAnLi9rYXJhb2tlLmpzb24nO1xuaW1wb3J0IGRpc3BsYXkgZnJvbSAnLi9kaXNwbGF5Lmpzb24nO1xuaW1wb3J0IHR5cGUgeyBUcmFuc2xhdGlvbnMgfSBmcm9tICcuLi8uLi90eXBlcyc7XG5cbmNvbnN0IHRyYW5zbGF0aW9uczogVHJhbnNsYXRpb25zID0ge1xuICBjb21tb24sXG4gIGthcmFva2UsXG4gIGRpc3BsYXksXG59O1xuXG5leHBvcnQgZGVmYXVsdCB0cmFuc2xhdGlvbnM7Il0sIm5hbWVzIjpbInZhbHVlIiwiZXJyb3IiLCJjaGlsZHJlbiIsIm1lbW8iLCJpbmRleCIsInJlc3VsdCIsImkiLCJzb3VyY2VzIiwiZGlzcG9zZSIsImRvY3VtZW50IiwiYWRkRXZlbnRMaXN0ZW5lciIsImJyb3dzZXIiLCJfYnJvd3NlciIsImlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUiLCJzdHlsZSIsInByaW50IiwibG9nZ2VyIiwiX2EiLCJfYiIsInJlbW92ZURldGVjdG9yIiwibW91bnREZXRlY3RvciIsImRlZmluaXRpb24iLCJfJGRlbGVnYXRlRXZlbnRzIiwiU2NvcmVQYW5lbCIsInByb3BzIiwiX2VsJCIsIl90bXBsJCIsIl9lbCQyIiwiZmlyc3RDaGlsZCIsIl9lbCQzIiwiX2VsJDQiLCJuZXh0U2libGluZyIsIl9lbCQ1IiwiXyRpbnNlcnQiLCJzY29yZSIsInJhbmsiLCJfJGNsYXNzTmFtZSIsImNuIiwiY2xhc3MiLCJCdXR0b24iLCJsb2NhbCIsIm90aGVycyIsInNwbGl0UHJvcHMiLCJ2YXJpYW50Iiwic2l6ZSIsIl90bXBsJDMiLCJfJHNwcmVhZCIsIl8kbWVyZ2VQcm9wcyIsImRpc2FibGVkIiwibG9hZGluZyIsImZ1bGxXaWR0aCIsIl8kY3JlYXRlQ29tcG9uZW50IiwiU2hvdyIsIndoZW4iLCJsZWZ0SWNvbiIsIl90bXBsJDIiLCJyaWdodEljb24iLCJMeXJpY3NEaXNwbGF5IiwiY3VycmVudExpbmVJbmRleCIsInNldEN1cnJlbnRMaW5lSW5kZXgiLCJjcmVhdGVTaWduYWwiLCJjb250YWluZXJSZWYiLCJnZXRMaW5lU2NvcmUiLCJsaW5lSW5kZXgiLCJsaW5lU2NvcmVzIiwiZmluZCIsInMiLCJnZXRTY29yZVN0eWxlIiwiY29sb3IiLCJjcmVhdGVFZmZlY3QiLCJjdXJyZW50VGltZSIsImx5cmljcyIsImxlbmd0aCIsInRpbWUiLCJUSU1JTkdfT0ZGU0VUIiwiYWRqdXN0ZWRUaW1lIiwiZm91bmRJbmRleCIsImxpbmUiLCJlbmRUaW1lIiwic3RhcnRUaW1lIiwiZHVyYXRpb24iLCJwcmV2SW5kZXgiLCJNYXRoIiwiYWJzIiwiY29uc29sZSIsImxvZyIsImZyb20iLCJ0byIsInRpbWVJblNlY29uZHMiLCJqdW1wIiwid2FybiIsImZyb21MaW5lIiwidG9MaW5lIiwiaXNQbGF5aW5nIiwibGluZUVsZW1lbnRzIiwicXVlcnlTZWxlY3RvckFsbCIsImN1cnJlbnRFbGVtZW50IiwiY29udGFpbmVySGVpZ2h0IiwiY2xpZW50SGVpZ2h0IiwibGluZVRvcCIsIm9mZnNldFRvcCIsImxpbmVIZWlnaHQiLCJvZmZzZXRIZWlnaHQiLCJ0YXJnZXRTY3JvbGxUb3AiLCJzY3JvbGxUbyIsInRvcCIsImJlaGF2aW9yIiwiX3JlZiQiLCJfJHVzZSIsIkZvciIsImVhY2giLCJsaW5lU2NvcmUiLCJzY29yZVN0eWxlIiwidGV4dCIsIl8kZWZmZWN0IiwiX3AkIiwiX3YkIiwiX3YkMiIsIl92JDMiLCJlIiwiXyRzZXRBdHRyaWJ1dGUiLCJ0IiwiYSIsInNldFByb3BlcnR5IiwicmVtb3ZlUHJvcGVydHkiLCJ1bmRlZmluZWQiLCJMZWFkZXJib2FyZFBhbmVsIiwiZW50cmllcyIsImZhbGxiYWNrIiwiZW50cnkiLCJfZWwkNiIsIl9lbCQ3IiwidXNlcm5hbWUiLCJ0b0xvY2FsZVN0cmluZyIsImlzQ3VycmVudFVzZXIiLCJfdiQ0IiwibyIsInNwZWVkcyIsIlNwbGl0QnV0dG9uIiwiY3VycmVudFNwZWVkSW5kZXgiLCJzZXRDdXJyZW50U3BlZWRJbmRleCIsImN1cnJlbnRTcGVlZCIsImN5Y2xlU3BlZWQiLCJzdG9wUHJvcGFnYXRpb24iLCJuZXh0SW5kZXgiLCJuZXdTcGVlZCIsIm9uU3BlZWRDaGFuZ2UiLCJfJGFkZEV2ZW50TGlzdGVuZXIiLCJvblN0YXJ0IiwiJCRjbGljayIsIl92JDUiLCJUYWJzQ29udGV4dCIsImNyZWF0ZUNvbnRleHQiLCJUYWJzIiwiYWN0aXZlVGFiIiwic2V0QWN0aXZlVGFiIiwiZGVmYXVsdFRhYiIsInRhYnMiLCJpZCIsImZpcnN0VGFiSWQiLCJoYW5kbGVUYWJDaGFuZ2UiLCJvblRhYkNoYW5nZSIsImNvbnRleHRWYWx1ZSIsIlByb3ZpZGVyIiwiVGFic0xpc3QiLCJUYWJzVHJpZ2dlciIsImNvbnRleHQiLCJ1c2VDb250ZXh0IiwiaXNBY3RpdmUiLCJUYWJzQ29udGVudCIsIkZpcmVFbW9qaUFuaW1hdGlvbiIsInNob3dGaXJlIiwic2V0U2hvd0ZpcmUiLCJmaXJlWCIsInNldEZpcmVYIiwibGFzdExpbmVJbmRleCIsImhpZGVUaW1lciIsInJhbmRvbSIsInNldFRpbWVvdXQiLCJvbkNsZWFudXAiLCJzdHlsZXMiLCJmaXJlQ29udGFpbmVyIiwiZmlyZUVtb2ppIiwiRXh0ZW5zaW9uS2FyYW9rZVZpZXciLCJnZXRMYXRlc3RIaWdoU2NvcmVMaW5lIiwic2NvcmVzIiwibGF0ZXN0IiwiX3RtcGwkNSIsIl90bXBsJDYiLCJfZWwkOCIsImxhYmVsIiwiX3RtcGwkNCIsImxlYWRlcmJvYXJkIiwiSTE4bkNvbnRleHQiLCJJMThuUHJvdmlkZXIiLCJsb2NhbGUiLCJzZXRMb2NhbGUiLCJkZWZhdWx0TG9jYWxlIiwidHJhbnNsYXRpb25zIiwic2V0VHJhbnNsYXRpb25zIiwiY3VycmVudExvY2FsZSIsIm1vZHVsZSIsImRlZmF1bHQiLCJfZSIsImtleSIsInBhcmFtcyIsImtleXMiLCJzcGxpdCIsImsiLCJyZXBsYWNlIiwiXyIsIlN0cmluZyIsImRpciIsIm51bWJlckZvcm1hdHRlciIsImNyZWF0ZU1lbW8iLCJJbnRsIiwiTnVtYmVyRm9ybWF0IiwiZm9ybWF0TnVtYmVyIiwibnVtIiwiZm9ybWF0IiwiZm9ybWF0RGF0ZSIsImRhdGUiLCJvcHRpb25zIiwiRGF0ZVRpbWVGb3JtYXQiLCJ1c2VJMThuIiwiRXJyb3IiLCJDb21wbGV0aW9uVmlldyIsImdldEZlZWRiYWNrVGV4dCIsImZlZWRiYWNrVGV4dCIsIl9lbCQ5IiwiX2VsJDEiLCJfZWwkMTAiLCJfZWwkMTEiLCJfZWwkMTIiLCJfZWwkMTMiLCJzcGVlZCIsIm9uUHJhY3RpY2UiLCJfZWwkMTQiLCJvbkNsaWNrIiwic2FtcGxlUmF0ZSIsIm9mZnNldCIsIlByb2dyZXNzQmFyIiwicGVyY2VudGFnZSIsIm1pbiIsIm1heCIsImN1cnJlbnQiLCJ0b3RhbCIsIk1pbmltaXplZEthcmFva2UiLCJjdXJyZW50VGFyZ2V0IiwidHJhbnNmb3JtIiwiUHJhY3RpY2VIZWFkZXIiLCJ0aXRsZSIsIkV4ZXJjaXNlRm9vdGVyIiwiaXNSZWNvcmRpbmciLCJvblN0b3AiLCJpc1Byb2Nlc3NpbmciLCJjYW5TdWJtaXQiLCJvblJlY29yZCIsIm9uU3VibWl0IiwicCIsIlJlc3BvbnNlRm9vdGVyIiwibW9kZSIsImlzQ29ycmVjdCIsIkljb25YQ2lyY2xlRmlsbCIsIkljb25DaGVja0NpcmNsZUZpbGwiLCJfJHAiLCJfJHN0eWxlIiwib25Db250aW51ZSIsImNvbnRpbnVlTGFiZWwiLCJvbkNoZWNrIiwiRXhlcmNpc2VUZW1wbGF0ZSIsIl9jJCIsIl8kbWVtbyIsImluc3RydWN0aW9uVGV4dCIsIlJlYWRBbG91ZCIsInByb21wdCIsInVzZXJUcmFuc2NyaXB0IiwiUHJhY3RpY2VFeGVyY2lzZVZpZXciLCJjdXJyZW50RXhlcmNpc2VJbmRleCIsInNldEN1cnJlbnRFeGVyY2lzZUluZGV4Iiwic2V0SXNSZWNvcmRpbmciLCJzZXRJc1Byb2Nlc3NpbmciLCJzZXRVc2VyVHJhbnNjcmlwdCIsImN1cnJlbnRTY29yZSIsInNldEN1cnJlbnRTY29yZSIsIm1lZGlhUmVjb3JkZXIiLCJzZXRNZWRpYVJlY29yZGVyIiwiYXVkaW9DaHVua3MiLCJzZXRBdWRpb0NodW5rcyIsInNob3dGZWVkYmFjayIsInNldFNob3dGZWVkYmFjayIsInNldElzQ29ycmVjdCIsImFwaUJhc2VVcmwiLCJleGVyY2lzZXMiLCJjcmVhdGVSZXNvdXJjZSIsInVybCIsInNlc3Npb25JZCIsImhlYWRlcnMiLCJhdXRoVG9rZW4iLCJyZXNwb25zZSIsImZldGNoIiwib2siLCJlcnJvclRleHQiLCJzdGF0dXMiLCJkYXRhIiwianNvbiIsImhhbmRsZVN0YXJ0UmVjb3JkaW5nIiwic3RyZWFtIiwibmF2aWdhdG9yIiwibWVkaWFEZXZpY2VzIiwiZ2V0VXNlck1lZGlhIiwiYXVkaW8iLCJlY2hvQ2FuY2VsbGF0aW9uIiwibm9pc2VTdXBwcmVzc2lvbiIsImF1dG9HYWluQ29udHJvbCIsIm1pbWVUeXBlIiwiTWVkaWFSZWNvcmRlciIsImlzVHlwZVN1cHBvcnRlZCIsInJlY29yZGVyIiwiY2h1bmtzIiwib25kYXRhYXZhaWxhYmxlIiwiZXZlbnQiLCJwdXNoIiwib25zdG9wIiwiYXVkaW9CbG9iIiwiQmxvYiIsInR5cGUiLCJwcm9jZXNzUmVjb3JkaW5nIiwiZ2V0VHJhY2tzIiwiZm9yRWFjaCIsInRyYWNrIiwic3RvcCIsInN0YXJ0IiwiYmxvYiIsInJlYWRlciIsIkZpbGVSZWFkZXIiLCJiYXNlNjQiLCJQcm9taXNlIiwicmVzb2x2ZSIsIm9ubG9hZGVuZCIsImJhc2U2NFN0cmluZyIsInJlYWRBc0RhdGFVUkwiLCJhdHRlbXB0cyIsIm1heEF0dGVtcHRzIiwibWV0aG9kIiwiYm9keSIsIkpTT04iLCJzdHJpbmdpZnkiLCJhdWRpb0Jhc2U2NCIsImV4cGVjdGVkVGV4dCIsImN1cnJlbnRFeGVyY2lzZSIsImZ1bGxfbGluZSIsInByZWZlckRlZXBncmFtIiwiZmV0Y2hFcnJvciIsInRyYW5zY3JpcHQiLCJjYWxjdWxhdGVTY29yZSIsImhhbmRsZUF1dG9TdWJtaXQiLCJoYW5kbGVTdG9wUmVjb3JkaW5nIiwic3RhdGUiLCJleHBlY3RlZCIsImFjdHVhbCIsImV4cGVjdGVkV29yZHMiLCJ0b0xvd2VyQ2FzZSIsImFjdHVhbFdvcmRzIiwibWF0Y2hlcyIsInJvdW5kIiwiY2FyZF9pZHMiLCJleGVyY2lzZUlkIiwiY2FyZFNjb3JlcyIsIm1hcCIsImNhcmRJZCIsImhhbmRsZVN1Ym1pdCIsImhhbmRsZUNvbnRpbnVlIiwib25CYWNrIiwiZXhlcmNpc2UiLCJoZWFkZXJUaXRsZSIsIm9uRXhpdCIsInRyaW0iLCJrYXJhb2tlQXBpIiwiS2FyYW9rZUFwaVNlcnZpY2UiLCJQcmFjdGljZVZpZXciLCJDb250ZW50QXBwIiwiY3VycmVudFRyYWNrIiwic2V0Q3VycmVudFRyYWNrIiwic2V0QXV0aFRva2VuIiwic2hvd0thcmFva2UiLCJzZXRTaG93S2FyYW9rZSIsImthcmFva2VEYXRhIiwic2V0S2FyYW9rZURhdGEiLCJzZXRMb2FkaW5nIiwic2Vzc2lvblN0YXJ0ZWQiLCJzZXRTZXNzaW9uU3RhcnRlZCIsImlzTWluaW1pemVkIiwic2V0SXNNaW5pbWl6ZWQiLCJjb3VudGRvd24iLCJzZXRDb3VudGRvd24iLCJzZXRJc1BsYXlpbmciLCJzZXRDdXJyZW50VGltZSIsImF1ZGlvUmVmIiwic2V0QXVkaW9SZWYiLCJrYXJhb2tlU2Vzc2lvbiIsInNldEthcmFva2VTZXNzaW9uIiwiY29tcGxldGlvbkRhdGEiLCJzZXRDb21wbGV0aW9uRGF0YSIsInNob3dQcmFjdGljZSIsInNldFNob3dQcmFjdGljZSIsInNlbGVjdGVkU3BlZWQiLCJzZXRTZWxlY3RlZFNwZWVkIiwib25Nb3VudCIsInRva2VuIiwiZ2V0QXV0aFRva2VuIiwiY2xlYW51cCIsInRyYWNrRGV0ZWN0b3IiLCJ3YXRjaEZvckNoYW5nZXMiLCJmZXRjaEthcmFva2VEYXRhIiwiZ2V0S2FyYW9rZURhdGEiLCJ0cmFja0lkIiwiYXJ0aXN0IiwiaGFuZGxlU3RhcnQiLCJsaW5lcyIsInRyYWNrVGl0bGUiLCJzb25nRGF0YSIsInNvbmciLCJoYXNMeXJpY3MiLCJuZXdTZXNzaW9uIiwidXNlS2FyYW9rZVNlc3Npb24iLCJhbGJ1bSIsInNvbmdDYXRhbG9nSWQiLCJzb25nX2NhdGFsb2dfaWQiLCJhdWRpb0VsZW1lbnQiLCJhcGlVcmwiLCJvbkNvbXBsZXRlIiwicmVzdWx0cyIsInBhdXNlIiwiaGFuZGxlU3BlZWRDaGFuZ2UiLCJzdGFydFNlc3Npb24iLCJzZXRBdWRpb0VsZW1lbnQiLCJjb3VudGRvd25JbnRlcnZhbCIsInNldEludGVydmFsIiwiY2xlYXJJbnRlcnZhbCIsInN0YXJ0QXVkaW9QbGF5YmFjayIsImF1ZGlvRWxlbWVudHMiLCJzcmMiLCJwYXVzZWQiLCJzZXNzaW9uIiwiYXVkaW9Qcm9jZXNzb3IiLCJpc1JlYWR5IiwiaW5pdGlhbGl6ZSIsImNhdGNoIiwicGxheSIsInRoZW4iLCJlcnIiLCJwbGF5QnV0dG9uIiwicXVlcnlTZWxlY3RvciIsImNsaWNrIiwidXBkYXRlVGltZSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJuZXdBdWRpb0VsZW1lbnRzIiwiaGFuZGxlTWluaW1pemUiLCJoYW5kbGVSZXN0b3JlIiwiX3RtcGwkNyIsIl90bXBsJDgiLCJfZWwkMCIsInJhdGUiLCJwbGF5YmFja1JhdGUiLCJfZWwkMTUiLCJfdG1wbCQ5IiwiaXNMb2FkaW5nIiwiX3RtcGwkMCIsImRlZmluZUNvbnRlbnRTY3JpcHQiLCJydW5BdCIsImNzc0luamVjdGlvbk1vZGUiLCJtYWluIiwiY3R4Iiwid2luZG93Iiwic2VsZiIsInVpIiwiY3JlYXRlU2hhZG93Um9vdFVpIiwibmFtZSIsInBvc2l0aW9uIiwiYW5jaG9yIiwiY29udGFpbmVyIiwid3JhcHBlciIsImNyZWF0ZUVsZW1lbnQiLCJjbGFzc05hbWUiLCJhcHBlbmRDaGlsZCIsInJlbmRlciIsIm9uUmVtb3ZlIiwibW91bnQiLCJjb21tb24iLCJrYXJhb2tlIiwiZGlzcGxheSJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBZ0pBLFFBQU0sU0FBUztBQUNmLFFBQU0sVUFBVSxDQUFDLEdBQUcsTUFBTSxNQUFNO0FBQ2hDLFFBQU0sU0FBUyxPQUFPLGFBQWE7QUFDbkMsUUFBTSxpQkFBaUIsT0FBTyxVQUFVO0FBQ3hDLFFBQU0sU0FBUyxPQUFPLGFBQWE7QUFDbkMsUUFBTSxXQUFXLE9BQU8scUJBQXFCO0FBQzdDLFFBQU0sZ0JBQWdCO0FBQUEsSUFDcEIsUUFBUTtBQUFBLEVBQ1Y7QUFFQSxNQUFJLGFBQWE7QUFDakIsUUFBTSxRQUFR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a0JBQWtCO0FBQzNDLGVBQUssa0JBQW1CO0FBQUEsUUFDaEM7QUFBQSxNQUNLO0FBQ0QsdUJBQWlCLFdBQVcsRUFBRTtBQUM5QixXQUFLLGNBQWMsTUFBTSxvQkFBb0IsV0FBVyxFQUFFLENBQUM7QUFBQSxJQUMvRDtBQUFBLEVBQ0E7QUFySkUsZ0JBWlcsdUJBWUosK0JBQThCO0FBQUEsSUFDbkM7QUFBQSxFQUNEO0FBZEksTUFBTSx1QkFBTjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDRFAsUUFBTW9MLGlCQUE2QjtBQUFBLElBQUEsUUFDakNtUztBQUFBQSxJQUFBLFNBQ0FDO0FBQUFBLElBQ0FDLFNBQUFBO0FBQUFBLEVBQ0Y7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDSkEsUUFBTSxlQUE2QjtBQUFBLElBQ2pDO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGOzs7Ozs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCwxLDIsMyw0LDUsNiw3LDgsOSwxMCwxMSwxMiwxMywxNCwxNSw0Myw0NCw1OCw1OSw2MF19

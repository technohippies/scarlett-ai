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
                      "class": "w-16 h-16 flex-shrink-0 text-red-500",
                      style: "color: #ef4444;"
                    });
                  },
                  get children() {
                    return createComponent(IconCheckCircleFill, {
                      "class": "w-16 h-16 flex-shrink-0 text-green-500",
                      style: "color: #22c55e;"
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
  const _SoundManager = class _SoundManager {
    constructor() {
      __publicField(this, "sounds", /* @__PURE__ */ new Map());
      __publicField(this, "enabled", true);
      this.loadSound("correct", "/sounds/correct.mp3");
      this.loadSound("incorrect", "/sounds/incorrect.mp3");
    }
    static getInstance() {
      if (!_SoundManager.instance) {
        _SoundManager.instance = new _SoundManager();
      }
      return _SoundManager.instance;
    }
    loadSound(name, path) {
      if (typeof window === "undefined") return;
      const audio = new Audio(path);
      audio.preload = "auto";
      audio.volume = 0.5;
      this.sounds.set(name, audio);
    }
    play(soundName) {
      if (!this.enabled) return;
      const audio = this.sounds.get(soundName);
      if (audio) {
        const clone = audio.cloneNode();
        clone.volume = audio.volume;
        clone.play().catch((err) => {
          console.warn("Failed to play sound:", err);
        });
      }
    }
    setVolume(volume) {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      this.sounds.forEach((audio) => {
        audio.volume = clampedVolume;
      });
    }
    setEnabled(enabled) {
      this.enabled = enabled;
    }
    isEnabled() {
      return this.enabled;
    }
  };
  __publicField(_SoundManager, "instance");
  let SoundManager = _SoundManager;
  const soundManager = SoundManager.getInstance();
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
      soundManager.play(score === 100 ? "correct" : "incorrect");
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL2Rpc3QvZGV2LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL3dlYi9kaXN0L2Rldi5qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWUvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnQvbGliL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbnkta2V5cy1tYXAvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvZGVmdS9kaXN0L2RlZnUubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0AxbmF0c3Uvd2FpdC1lbGVtZW50L2Rpc3QvZGV0ZWN0b3JzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AMW5hdHN1L3dhaXQtZWxlbWVudC9kaXN0L2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYXJlZC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9jbHN4L2Rpc3QvY2xzeC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvY24udHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9sYXlvdXQvSGVhZGVyL0hlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9kaXNwbGF5L1Njb3JlUGFuZWwvU2NvcmVQYW5lbC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vQnV0dG9uL0J1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9vbmJvYXJkaW5nL09uYm9hcmRpbmdGbG93L09uYm9hcmRpbmdGbG93LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheS9MeXJpY3NEaXNwbGF5LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvS2FyYW9rZUhlYWRlci9LYXJhb2tlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbC9MZWFkZXJib2FyZFBhbmVsLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9TcGxpdEJ1dHRvbi9TcGxpdEJ1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vVGFicy9UYWJzLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2VmZmVjdHMvRmlyZUVtb2ppQW5pbWF0aW9uL0ZpcmVFbW9qaUFuaW1hdGlvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9rYXJhb2tlL0V4dGVuc2lvbkthcmFva2VWaWV3L0V4dGVuc2lvbkthcmFva2VWaWV3LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9pMThuL3Byb3ZpZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvQ29tcGxldGlvblZpZXcvQ29tcGxldGlvblZpZXcudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL3NlcnZpY2VzL2F1ZGlvL2thcmFva2VBdWRpb1Byb2Nlc3Nvci50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2NsaWVudC50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2VuZHBvaW50cy9rYXJhb2tlLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvZW5kcG9pbnRzL3ByYWN0aWNlLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvZW5kcG9pbnRzL3N0dC50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2VuZHBvaW50cy9hdXRoLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvaW5kZXgudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvc2VydmljZXMva2FyYW9rZS9rYXJhb2tlQXBpLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL3NlcnZpY2VzL2thcmFva2UvY2h1bmtpbmdVdGlscy50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9Qcm9ncmVzc0Jhci9Qcm9ncmVzc0Jhci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vTW9kYWwvTW9kYWwudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvTWluaW1pemVkS2FyYW9rZS50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9QcmFjdGljZUhlYWRlci9QcmFjdGljZUhlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9FeGVyY2lzZUZvb3Rlci9FeGVyY2lzZUZvb3Rlci50c3giLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvcGhvc3Bob3ItaWNvbnMtc29saWQvZGlzdC9JY29uQ2hlY2tDaXJjbGVGaWxsLmpzeCIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9waG9zcGhvci1pY29ucy1zb2xpZC9kaXN0L0ljb25YQ2lyY2xlRmlsbC5qc3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9SZXNwb25zZUZvb3Rlci9SZXNwb25zZUZvb3Rlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9FeGVyY2lzZVRlbXBsYXRlL0V4ZXJjaXNlVGVtcGxhdGUudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcHJhY3RpY2UvUmVhZEFsb3VkL1JlYWRBbG91ZC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvc291bmQudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9QcmFjdGljZUV4ZXJjaXNlVmlldy9QcmFjdGljZUV4ZXJjaXNlVmlldy50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy93ZWIvRmFyY2FzdGVyTWluaUFwcC9GYXJjYXN0ZXJNaW5pQXBwLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3dlYi9BdXRoQnV0dG9uL0F1dGhCdXR0b24udHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcGFnZXMvSG9tZVBhZ2UvSG9tZVBhZ2UudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2hvb2tzL3VzZUthcmFva2VTZXNzaW9uLnRzIiwiLi4vLi4vLi4vc3JjL3NlcnZpY2VzL3RyYWNrLWRldGVjdG9yLnRzIiwiLi4vLi4vLi4vc3JjL3V0aWxzL3N0b3JhZ2UudHMiLCIuLi8uLi8uLi9zcmMvc2VydmljZXMva2FyYW9rZS1hcGkudHMiLCIuLi8uLi8uLi9zcmMvdmlld3MvY29udGVudC9QcmFjdGljZVZpZXcudHN4IiwiLi4vLi4vLi4vc3JjL3ZpZXdzL2NvbnRlbnQvQ29udGVudEFwcC50c3giLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50LnRzeCIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9pMThuL2xvY2FsZXMvZW4vaW5kZXgudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvaTE4bi9sb2NhbGVzL3poLUNOL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImxldCB0YXNrSWRDb3VudGVyID0gMSxcbiAgaXNDYWxsYmFja1NjaGVkdWxlZCA9IGZhbHNlLFxuICBpc1BlcmZvcm1pbmdXb3JrID0gZmFsc2UsXG4gIHRhc2tRdWV1ZSA9IFtdLFxuICBjdXJyZW50VGFzayA9IG51bGwsXG4gIHNob3VsZFlpZWxkVG9Ib3N0ID0gbnVsbCxcbiAgeWllbGRJbnRlcnZhbCA9IDUsXG4gIGRlYWRsaW5lID0gMCxcbiAgbWF4WWllbGRJbnRlcnZhbCA9IDMwMCxcbiAgc2NoZWR1bGVDYWxsYmFjayA9IG51bGwsXG4gIHNjaGVkdWxlZENhbGxiYWNrID0gbnVsbDtcbmNvbnN0IG1heFNpZ25lZDMxQml0SW50ID0gMTA3Mzc0MTgyMztcbmZ1bmN0aW9uIHNldHVwU2NoZWR1bGVyKCkge1xuICBjb25zdCBjaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsKCksXG4gICAgcG9ydCA9IGNoYW5uZWwucG9ydDI7XG4gIHNjaGVkdWxlQ2FsbGJhY2sgPSAoKSA9PiBwb3J0LnBvc3RNZXNzYWdlKG51bGwpO1xuICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9ICgpID0+IHtcbiAgICBpZiAoc2NoZWR1bGVkQ2FsbGJhY2sgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBkZWFkbGluZSA9IGN1cnJlbnRUaW1lICsgeWllbGRJbnRlcnZhbDtcbiAgICAgIGNvbnN0IGhhc1RpbWVSZW1haW5pbmcgPSB0cnVlO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgaGFzTW9yZVdvcmsgPSBzY2hlZHVsZWRDYWxsYmFjayhoYXNUaW1lUmVtYWluaW5nLCBjdXJyZW50VGltZSk7XG4gICAgICAgIGlmICghaGFzTW9yZVdvcmspIHtcbiAgICAgICAgICBzY2hlZHVsZWRDYWxsYmFjayA9IG51bGw7XG4gICAgICAgIH0gZWxzZSBwb3J0LnBvc3RNZXNzYWdlKG51bGwpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9XG4gICAgfVxuICB9O1xuICBpZiAobmF2aWdhdG9yICYmIG5hdmlnYXRvci5zY2hlZHVsaW5nICYmIG5hdmlnYXRvci5zY2hlZHVsaW5nLmlzSW5wdXRQZW5kaW5nKSB7XG4gICAgY29uc3Qgc2NoZWR1bGluZyA9IG5hdmlnYXRvci5zY2hlZHVsaW5nO1xuICAgIHNob3VsZFlpZWxkVG9Ib3N0ID0gKCkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGlmIChjdXJyZW50VGltZSA+PSBkZWFkbGluZSkge1xuICAgICAgICBpZiAoc2NoZWR1bGluZy5pc0lucHV0UGVuZGluZygpKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGN1cnJlbnRUaW1lID49IG1heFlpZWxkSW50ZXJ2YWw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBzaG91bGRZaWVsZFRvSG9zdCA9ICgpID0+IHBlcmZvcm1hbmNlLm5vdygpID49IGRlYWRsaW5lO1xuICB9XG59XG5mdW5jdGlvbiBlbnF1ZXVlKHRhc2tRdWV1ZSwgdGFzaykge1xuICBmdW5jdGlvbiBmaW5kSW5kZXgoKSB7XG4gICAgbGV0IG0gPSAwO1xuICAgIGxldCBuID0gdGFza1F1ZXVlLmxlbmd0aCAtIDE7XG4gICAgd2hpbGUgKG0gPD0gbikge1xuICAgICAgY29uc3QgayA9IG4gKyBtID4+IDE7XG4gICAgICBjb25zdCBjbXAgPSB0YXNrLmV4cGlyYXRpb25UaW1lIC0gdGFza1F1ZXVlW2tdLmV4cGlyYXRpb25UaW1lO1xuICAgICAgaWYgKGNtcCA+IDApIG0gPSBrICsgMTtlbHNlIGlmIChjbXAgPCAwKSBuID0gayAtIDE7ZWxzZSByZXR1cm4gaztcbiAgICB9XG4gICAgcmV0dXJuIG07XG4gIH1cbiAgdGFza1F1ZXVlLnNwbGljZShmaW5kSW5kZXgoKSwgMCwgdGFzayk7XG59XG5mdW5jdGlvbiByZXF1ZXN0Q2FsbGJhY2soZm4sIG9wdGlvbnMpIHtcbiAgaWYgKCFzY2hlZHVsZUNhbGxiYWNrKSBzZXR1cFNjaGVkdWxlcigpO1xuICBsZXQgc3RhcnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCksXG4gICAgdGltZW91dCA9IG1heFNpZ25lZDMxQml0SW50O1xuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnRpbWVvdXQpIHRpbWVvdXQgPSBvcHRpb25zLnRpbWVvdXQ7XG4gIGNvbnN0IG5ld1Rhc2sgPSB7XG4gICAgaWQ6IHRhc2tJZENvdW50ZXIrKyxcbiAgICBmbixcbiAgICBzdGFydFRpbWUsXG4gICAgZXhwaXJhdGlvblRpbWU6IHN0YXJ0VGltZSArIHRpbWVvdXRcbiAgfTtcbiAgZW5xdWV1ZSh0YXNrUXVldWUsIG5ld1Rhc2spO1xuICBpZiAoIWlzQ2FsbGJhY2tTY2hlZHVsZWQgJiYgIWlzUGVyZm9ybWluZ1dvcmspIHtcbiAgICBpc0NhbGxiYWNrU2NoZWR1bGVkID0gdHJ1ZTtcbiAgICBzY2hlZHVsZWRDYWxsYmFjayA9IGZsdXNoV29yaztcbiAgICBzY2hlZHVsZUNhbGxiYWNrKCk7XG4gIH1cbiAgcmV0dXJuIG5ld1Rhc2s7XG59XG5mdW5jdGlvbiBjYW5jZWxDYWxsYmFjayh0YXNrKSB7XG4gIHRhc2suZm4gPSBudWxsO1xufVxuZnVuY3Rpb24gZmx1c2hXb3JrKGhhc1RpbWVSZW1haW5pbmcsIGluaXRpYWxUaW1lKSB7XG4gIGlzQ2FsbGJhY2tTY2hlZHVsZWQgPSBmYWxzZTtcbiAgaXNQZXJmb3JtaW5nV29yayA9IHRydWU7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHdvcmtMb29wKGhhc1RpbWVSZW1haW5pbmcsIGluaXRpYWxUaW1lKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBjdXJyZW50VGFzayA9IG51bGw7XG4gICAgaXNQZXJmb3JtaW5nV29yayA9IGZhbHNlO1xuICB9XG59XG5mdW5jdGlvbiB3b3JrTG9vcChoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSkge1xuICBsZXQgY3VycmVudFRpbWUgPSBpbml0aWFsVGltZTtcbiAgY3VycmVudFRhc2sgPSB0YXNrUXVldWVbMF0gfHwgbnVsbDtcbiAgd2hpbGUgKGN1cnJlbnRUYXNrICE9PSBudWxsKSB7XG4gICAgaWYgKGN1cnJlbnRUYXNrLmV4cGlyYXRpb25UaW1lID4gY3VycmVudFRpbWUgJiYgKCFoYXNUaW1lUmVtYWluaW5nIHx8IHNob3VsZFlpZWxkVG9Ib3N0KCkpKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY29uc3QgY2FsbGJhY2sgPSBjdXJyZW50VGFzay5mbjtcbiAgICBpZiAoY2FsbGJhY2sgIT09IG51bGwpIHtcbiAgICAgIGN1cnJlbnRUYXNrLmZuID0gbnVsbDtcbiAgICAgIGNvbnN0IGRpZFVzZXJDYWxsYmFja1RpbWVvdXQgPSBjdXJyZW50VGFzay5leHBpcmF0aW9uVGltZSA8PSBjdXJyZW50VGltZTtcbiAgICAgIGNhbGxiYWNrKGRpZFVzZXJDYWxsYmFja1RpbWVvdXQpO1xuICAgICAgY3VycmVudFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGlmIChjdXJyZW50VGFzayA9PT0gdGFza1F1ZXVlWzBdKSB7XG4gICAgICAgIHRhc2tRdWV1ZS5zaGlmdCgpO1xuICAgICAgfVxuICAgIH0gZWxzZSB0YXNrUXVldWUuc2hpZnQoKTtcbiAgICBjdXJyZW50VGFzayA9IHRhc2tRdWV1ZVswXSB8fCBudWxsO1xuICB9XG4gIHJldHVybiBjdXJyZW50VGFzayAhPT0gbnVsbDtcbn1cblxuY29uc3Qgc2hhcmVkQ29uZmlnID0ge1xuICBjb250ZXh0OiB1bmRlZmluZWQsXG4gIHJlZ2lzdHJ5OiB1bmRlZmluZWQsXG4gIGVmZmVjdHM6IHVuZGVmaW5lZCxcbiAgZG9uZTogZmFsc2UsXG4gIGdldENvbnRleHRJZCgpIHtcbiAgICByZXR1cm4gZ2V0Q29udGV4dElkKHRoaXMuY29udGV4dC5jb3VudCk7XG4gIH0sXG4gIGdldE5leHRDb250ZXh0SWQoKSB7XG4gICAgcmV0dXJuIGdldENvbnRleHRJZCh0aGlzLmNvbnRleHQuY291bnQrKyk7XG4gIH1cbn07XG5mdW5jdGlvbiBnZXRDb250ZXh0SWQoY291bnQpIHtcbiAgY29uc3QgbnVtID0gU3RyaW5nKGNvdW50KSxcbiAgICBsZW4gPSBudW0ubGVuZ3RoIC0gMTtcbiAgcmV0dXJuIHNoYXJlZENvbmZpZy5jb250ZXh0LmlkICsgKGxlbiA/IFN0cmluZy5mcm9tQ2hhckNvZGUoOTYgKyBsZW4pIDogXCJcIikgKyBudW07XG59XG5mdW5jdGlvbiBzZXRIeWRyYXRlQ29udGV4dChjb250ZXh0KSB7XG4gIHNoYXJlZENvbmZpZy5jb250ZXh0ID0gY29udGV4dDtcbn1cbmZ1bmN0aW9uIG5leHRIeWRyYXRlQ29udGV4dCgpIHtcbiAgcmV0dXJuIHtcbiAgICAuLi5zaGFyZWRDb25maWcuY29udGV4dCxcbiAgICBpZDogc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKSxcbiAgICBjb3VudDogMFxuICB9O1xufVxuXG5jb25zdCBJU19ERVYgPSB0cnVlO1xuY29uc3QgZXF1YWxGbiA9IChhLCBiKSA9PiBhID09PSBiO1xuY29uc3QgJFBST1hZID0gU3ltYm9sKFwic29saWQtcHJveHlcIik7XG5jb25zdCBTVVBQT1JUU19QUk9YWSA9IHR5cGVvZiBQcm94eSA9PT0gXCJmdW5jdGlvblwiO1xuY29uc3QgJFRSQUNLID0gU3ltYm9sKFwic29saWQtdHJhY2tcIik7XG5jb25zdCAkREVWQ09NUCA9IFN5bWJvbChcInNvbGlkLWRldi1jb21wb25lbnRcIik7XG5jb25zdCBzaWduYWxPcHRpb25zID0ge1xuICBlcXVhbHM6IGVxdWFsRm5cbn07XG5sZXQgRVJST1IgPSBudWxsO1xubGV0IHJ1bkVmZmVjdHMgPSBydW5RdWV1ZTtcbmNvbnN0IFNUQUxFID0gMTtcbmNvbnN0IFBFTkRJTkcgPSAyO1xuY29uc3QgVU5PV05FRCA9IHtcbiAgb3duZWQ6IG51bGwsXG4gIGNsZWFudXBzOiBudWxsLFxuICBjb250ZXh0OiBudWxsLFxuICBvd25lcjogbnVsbFxufTtcbmNvbnN0IE5PX0lOSVQgPSB7fTtcbnZhciBPd25lciA9IG51bGw7XG5sZXQgVHJhbnNpdGlvbiA9IG51bGw7XG5sZXQgU2NoZWR1bGVyID0gbnVsbDtcbmxldCBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IG51bGw7XG5sZXQgTGlzdGVuZXIgPSBudWxsO1xubGV0IFVwZGF0ZXMgPSBudWxsO1xubGV0IEVmZmVjdHMgPSBudWxsO1xubGV0IEV4ZWNDb3VudCA9IDA7XG5jb25zdCBEZXZIb29rcyA9IHtcbiAgYWZ0ZXJVcGRhdGU6IG51bGwsXG4gIGFmdGVyQ3JlYXRlT3duZXI6IG51bGwsXG4gIGFmdGVyQ3JlYXRlU2lnbmFsOiBudWxsLFxuICBhZnRlclJlZ2lzdGVyR3JhcGg6IG51bGxcbn07XG5mdW5jdGlvbiBjcmVhdGVSb290KGZuLCBkZXRhY2hlZE93bmVyKSB7XG4gIGNvbnN0IGxpc3RlbmVyID0gTGlzdGVuZXIsXG4gICAgb3duZXIgPSBPd25lcixcbiAgICB1bm93bmVkID0gZm4ubGVuZ3RoID09PSAwLFxuICAgIGN1cnJlbnQgPSBkZXRhY2hlZE93bmVyID09PSB1bmRlZmluZWQgPyBvd25lciA6IGRldGFjaGVkT3duZXIsXG4gICAgcm9vdCA9IHVub3duZWQgPyB7XG4gICAgICBvd25lZDogbnVsbCxcbiAgICAgIGNsZWFudXBzOiBudWxsLFxuICAgICAgY29udGV4dDogbnVsbCxcbiAgICAgIG93bmVyOiBudWxsXG4gICAgfSAgOiB7XG4gICAgICBvd25lZDogbnVsbCxcbiAgICAgIGNsZWFudXBzOiBudWxsLFxuICAgICAgY29udGV4dDogY3VycmVudCA/IGN1cnJlbnQuY29udGV4dCA6IG51bGwsXG4gICAgICBvd25lcjogY3VycmVudFxuICAgIH0sXG4gICAgdXBkYXRlRm4gPSB1bm93bmVkID8gKCkgPT4gZm4oKCkgPT4ge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRGlzcG9zZSBtZXRob2QgbXVzdCBiZSBhbiBleHBsaWNpdCBhcmd1bWVudCB0byBjcmVhdGVSb290IGZ1bmN0aW9uXCIpO1xuICAgIH0pICA6ICgpID0+IGZuKCgpID0+IHVudHJhY2soKCkgPT4gY2xlYW5Ob2RlKHJvb3QpKSk7XG4gIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIgJiYgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lcihyb290KTtcbiAgT3duZXIgPSByb290O1xuICBMaXN0ZW5lciA9IG51bGw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJ1blVwZGF0ZXModXBkYXRlRm4sIHRydWUpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gICAgT3duZXIgPSBvd25lcjtcbiAgfVxufVxuZnVuY3Rpb24gY3JlYXRlU2lnbmFsKHZhbHVlLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zID8gT2JqZWN0LmFzc2lnbih7fSwgc2lnbmFsT3B0aW9ucywgb3B0aW9ucykgOiBzaWduYWxPcHRpb25zO1xuICBjb25zdCBzID0ge1xuICAgIHZhbHVlLFxuICAgIG9ic2VydmVyczogbnVsbCxcbiAgICBvYnNlcnZlclNsb3RzOiBudWxsLFxuICAgIGNvbXBhcmF0b3I6IG9wdGlvbnMuZXF1YWxzIHx8IHVuZGVmaW5lZFxuICB9O1xuICB7XG4gICAgaWYgKG9wdGlvbnMubmFtZSkgcy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIGlmIChvcHRpb25zLmludGVybmFsKSB7XG4gICAgICBzLmludGVybmFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVnaXN0ZXJHcmFwaChzKTtcbiAgICAgIGlmIChEZXZIb29rcy5hZnRlckNyZWF0ZVNpZ25hbCkgRGV2SG9va3MuYWZ0ZXJDcmVhdGVTaWduYWwocyk7XG4gICAgfVxuICB9XG4gIGNvbnN0IHNldHRlciA9IHZhbHVlID0+IHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKHMpKSB2YWx1ZSA9IHZhbHVlKHMudFZhbHVlKTtlbHNlIHZhbHVlID0gdmFsdWUocy52YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiB3cml0ZVNpZ25hbChzLCB2YWx1ZSk7XG4gIH07XG4gIHJldHVybiBbcmVhZFNpZ25hbC5iaW5kKHMpLCBzZXR0ZXJdO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29tcHV0ZWQoZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIHRydWUsIFNUQUxFLCBvcHRpb25zICk7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIFVwZGF0ZXMucHVzaChjKTtlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlUmVuZGVyRWZmZWN0KGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCBmYWxzZSwgU1RBTEUsIG9wdGlvbnMgKTtcbiAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgVXBkYXRlcy5wdXNoKGMpO2Vsc2UgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG59XG5mdW5jdGlvbiBjcmVhdGVFZmZlY3QoZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIHJ1bkVmZmVjdHMgPSBydW5Vc2VyRWZmZWN0cztcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgZmFsc2UsIFNUQUxFLCBvcHRpb25zICksXG4gICAgcyA9IFN1c3BlbnNlQ29udGV4dCAmJiB1c2VDb250ZXh0KFN1c3BlbnNlQ29udGV4dCk7XG4gIGlmIChzKSBjLnN1c3BlbnNlID0gcztcbiAgaWYgKCFvcHRpb25zIHx8ICFvcHRpb25zLnJlbmRlcikgYy51c2VyID0gdHJ1ZTtcbiAgRWZmZWN0cyA/IEVmZmVjdHMucHVzaChjKSA6IHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlUmVhY3Rpb24ob25JbnZhbGlkYXRlLCBvcHRpb25zKSB7XG4gIGxldCBmbjtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKCgpID0+IHtcbiAgICAgIGZuID8gZm4oKSA6IHVudHJhY2sob25JbnZhbGlkYXRlKTtcbiAgICAgIGZuID0gdW5kZWZpbmVkO1xuICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UsIDAsIG9wdGlvbnMgKSxcbiAgICBzID0gU3VzcGVuc2VDb250ZXh0ICYmIHVzZUNvbnRleHQoU3VzcGVuc2VDb250ZXh0KTtcbiAgaWYgKHMpIGMuc3VzcGVuc2UgPSBzO1xuICBjLnVzZXIgPSB0cnVlO1xuICByZXR1cm4gdHJhY2tpbmcgPT4ge1xuICAgIGZuID0gdHJhY2tpbmc7XG4gICAgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIH07XG59XG5mdW5jdGlvbiBjcmVhdGVNZW1vKGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyA/IE9iamVjdC5hc3NpZ24oe30sIHNpZ25hbE9wdGlvbnMsIG9wdGlvbnMpIDogc2lnbmFsT3B0aW9ucztcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgdHJ1ZSwgMCwgb3B0aW9ucyApO1xuICBjLm9ic2VydmVycyA9IG51bGw7XG4gIGMub2JzZXJ2ZXJTbG90cyA9IG51bGw7XG4gIGMuY29tcGFyYXRvciA9IG9wdGlvbnMuZXF1YWxzIHx8IHVuZGVmaW5lZDtcbiAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGMudFN0YXRlID0gU1RBTEU7XG4gICAgVXBkYXRlcy5wdXNoKGMpO1xuICB9IGVsc2UgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIHJldHVybiByZWFkU2lnbmFsLmJpbmQoYyk7XG59XG5mdW5jdGlvbiBpc1Byb21pc2Uodikge1xuICByZXR1cm4gdiAmJiB0eXBlb2YgdiA9PT0gXCJvYmplY3RcIiAmJiBcInRoZW5cIiBpbiB2O1xufVxuZnVuY3Rpb24gY3JlYXRlUmVzb3VyY2UocFNvdXJjZSwgcEZldGNoZXIsIHBPcHRpb25zKSB7XG4gIGxldCBzb3VyY2U7XG4gIGxldCBmZXRjaGVyO1xuICBsZXQgb3B0aW9ucztcbiAgaWYgKHR5cGVvZiBwRmV0Y2hlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgc291cmNlID0gcFNvdXJjZTtcbiAgICBmZXRjaGVyID0gcEZldGNoZXI7XG4gICAgb3B0aW9ucyA9IHBPcHRpb25zIHx8IHt9O1xuICB9IGVsc2Uge1xuICAgIHNvdXJjZSA9IHRydWU7XG4gICAgZmV0Y2hlciA9IHBTb3VyY2U7XG4gICAgb3B0aW9ucyA9IHBGZXRjaGVyIHx8IHt9O1xuICB9XG4gIGxldCBwciA9IG51bGwsXG4gICAgaW5pdFAgPSBOT19JTklULFxuICAgIGlkID0gbnVsbCxcbiAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBmYWxzZSxcbiAgICBzY2hlZHVsZWQgPSBmYWxzZSxcbiAgICByZXNvbHZlZCA9IFwiaW5pdGlhbFZhbHVlXCIgaW4gb3B0aW9ucyxcbiAgICBkeW5hbWljID0gdHlwZW9mIHNvdXJjZSA9PT0gXCJmdW5jdGlvblwiICYmIGNyZWF0ZU1lbW8oc291cmNlKTtcbiAgY29uc3QgY29udGV4dHMgPSBuZXcgU2V0KCksXG4gICAgW3ZhbHVlLCBzZXRWYWx1ZV0gPSAob3B0aW9ucy5zdG9yYWdlIHx8IGNyZWF0ZVNpZ25hbCkob3B0aW9ucy5pbml0aWFsVmFsdWUpLFxuICAgIFtlcnJvciwgc2V0RXJyb3JdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCksXG4gICAgW3RyYWNrLCB0cmlnZ2VyXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQsIHtcbiAgICAgIGVxdWFsczogZmFsc2VcbiAgICB9KSxcbiAgICBbc3RhdGUsIHNldFN0YXRlXSA9IGNyZWF0ZVNpZ25hbChyZXNvbHZlZCA/IFwicmVhZHlcIiA6IFwidW5yZXNvbHZlZFwiKTtcbiAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0KSB7XG4gICAgaWQgPSBzaGFyZWRDb25maWcuZ2V0TmV4dENvbnRleHRJZCgpO1xuICAgIGlmIChvcHRpb25zLnNzckxvYWRGcm9tID09PSBcImluaXRpYWxcIikgaW5pdFAgPSBvcHRpb25zLmluaXRpYWxWYWx1ZTtlbHNlIGlmIChzaGFyZWRDb25maWcubG9hZCAmJiBzaGFyZWRDb25maWcuaGFzKGlkKSkgaW5pdFAgPSBzaGFyZWRDb25maWcubG9hZChpZCk7XG4gIH1cbiAgZnVuY3Rpb24gbG9hZEVuZChwLCB2LCBlcnJvciwga2V5KSB7XG4gICAgaWYgKHByID09PSBwKSB7XG4gICAgICBwciA9IG51bGw7XG4gICAgICBrZXkgIT09IHVuZGVmaW5lZCAmJiAocmVzb2x2ZWQgPSB0cnVlKTtcbiAgICAgIGlmICgocCA9PT0gaW5pdFAgfHwgdiA9PT0gaW5pdFApICYmIG9wdGlvbnMub25IeWRyYXRlZCkgcXVldWVNaWNyb3Rhc2soKCkgPT4gb3B0aW9ucy5vbkh5ZHJhdGVkKGtleSwge1xuICAgICAgICB2YWx1ZTogdlxuICAgICAgfSkpO1xuICAgICAgaW5pdFAgPSBOT19JTklUO1xuICAgICAgaWYgKFRyYW5zaXRpb24gJiYgcCAmJiBsb2FkZWRVbmRlclRyYW5zaXRpb24pIHtcbiAgICAgICAgVHJhbnNpdGlvbi5wcm9taXNlcy5kZWxldGUocCk7XG4gICAgICAgIGxvYWRlZFVuZGVyVHJhbnNpdGlvbiA9IGZhbHNlO1xuICAgICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgIGNvbXBsZXRlTG9hZCh2LCBlcnJvcik7XG4gICAgICAgIH0sIGZhbHNlKTtcbiAgICAgIH0gZWxzZSBjb21wbGV0ZUxvYWQodiwgZXJyb3IpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuICBmdW5jdGlvbiBjb21wbGV0ZUxvYWQodiwgZXJyKSB7XG4gICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICBpZiAoZXJyID09PSB1bmRlZmluZWQpIHNldFZhbHVlKCgpID0+IHYpO1xuICAgICAgc2V0U3RhdGUoZXJyICE9PSB1bmRlZmluZWQgPyBcImVycm9yZWRcIiA6IHJlc29sdmVkID8gXCJyZWFkeVwiIDogXCJ1bnJlc29sdmVkXCIpO1xuICAgICAgc2V0RXJyb3IoZXJyKTtcbiAgICAgIGZvciAoY29uc3QgYyBvZiBjb250ZXh0cy5rZXlzKCkpIGMuZGVjcmVtZW50KCk7XG4gICAgICBjb250ZXh0cy5jbGVhcigpO1xuICAgIH0sIGZhbHNlKTtcbiAgfVxuICBmdW5jdGlvbiByZWFkKCkge1xuICAgIGNvbnN0IGMgPSBTdXNwZW5zZUNvbnRleHQgJiYgdXNlQ29udGV4dChTdXNwZW5zZUNvbnRleHQpLFxuICAgICAgdiA9IHZhbHVlKCksXG4gICAgICBlcnIgPSBlcnJvcigpO1xuICAgIGlmIChlcnIgIT09IHVuZGVmaW5lZCAmJiAhcHIpIHRocm93IGVycjtcbiAgICBpZiAoTGlzdGVuZXIgJiYgIUxpc3RlbmVyLnVzZXIgJiYgYykge1xuICAgICAgY3JlYXRlQ29tcHV0ZWQoKCkgPT4ge1xuICAgICAgICB0cmFjaygpO1xuICAgICAgICBpZiAocHIpIHtcbiAgICAgICAgICBpZiAoYy5yZXNvbHZlZCAmJiBUcmFuc2l0aW9uICYmIGxvYWRlZFVuZGVyVHJhbnNpdGlvbikgVHJhbnNpdGlvbi5wcm9taXNlcy5hZGQocHIpO2Vsc2UgaWYgKCFjb250ZXh0cy5oYXMoYykpIHtcbiAgICAgICAgICAgIGMuaW5jcmVtZW50KCk7XG4gICAgICAgICAgICBjb250ZXh0cy5hZGQoYyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cbiAgZnVuY3Rpb24gbG9hZChyZWZldGNoaW5nID0gdHJ1ZSkge1xuICAgIGlmIChyZWZldGNoaW5nICE9PSBmYWxzZSAmJiBzY2hlZHVsZWQpIHJldHVybjtcbiAgICBzY2hlZHVsZWQgPSBmYWxzZTtcbiAgICBjb25zdCBsb29rdXAgPSBkeW5hbWljID8gZHluYW1pYygpIDogc291cmNlO1xuICAgIGxvYWRlZFVuZGVyVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgIGlmIChsb29rdXAgPT0gbnVsbCB8fCBsb29rdXAgPT09IGZhbHNlKSB7XG4gICAgICBsb2FkRW5kKHByLCB1bnRyYWNrKHZhbHVlKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChUcmFuc2l0aW9uICYmIHByKSBUcmFuc2l0aW9uLnByb21pc2VzLmRlbGV0ZShwcik7XG4gICAgbGV0IGVycm9yO1xuICAgIGNvbnN0IHAgPSBpbml0UCAhPT0gTk9fSU5JVCA/IGluaXRQIDogdW50cmFjaygoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gZmV0Y2hlcihsb29rdXAsIHtcbiAgICAgICAgICB2YWx1ZTogdmFsdWUoKSxcbiAgICAgICAgICByZWZldGNoaW5nXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZmV0Y2hlckVycm9yKSB7XG4gICAgICAgIGVycm9yID0gZmV0Y2hlckVycm9yO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChlcnJvciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsb2FkRW5kKHByLCB1bmRlZmluZWQsIGNhc3RFcnJvcihlcnJvciksIGxvb2t1cCk7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmICghaXNQcm9taXNlKHApKSB7XG4gICAgICBsb2FkRW5kKHByLCBwLCB1bmRlZmluZWQsIGxvb2t1cCk7XG4gICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgcHIgPSBwO1xuICAgIGlmIChcInZcIiBpbiBwKSB7XG4gICAgICBpZiAocC5zID09PSAxKSBsb2FkRW5kKHByLCBwLnYsIHVuZGVmaW5lZCwgbG9va3VwKTtlbHNlIGxvYWRFbmQocHIsIHVuZGVmaW5lZCwgY2FzdEVycm9yKHAudiksIGxvb2t1cCk7XG4gICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgc2NoZWR1bGVkID0gdHJ1ZTtcbiAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiBzY2hlZHVsZWQgPSBmYWxzZSk7XG4gICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICBzZXRTdGF0ZShyZXNvbHZlZCA/IFwicmVmcmVzaGluZ1wiIDogXCJwZW5kaW5nXCIpO1xuICAgICAgdHJpZ2dlcigpO1xuICAgIH0sIGZhbHNlKTtcbiAgICByZXR1cm4gcC50aGVuKHYgPT4gbG9hZEVuZChwLCB2LCB1bmRlZmluZWQsIGxvb2t1cCksIGUgPT4gbG9hZEVuZChwLCB1bmRlZmluZWQsIGNhc3RFcnJvcihlKSwgbG9va3VwKSk7XG4gIH1cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMocmVhZCwge1xuICAgIHN0YXRlOiB7XG4gICAgICBnZXQ6ICgpID0+IHN0YXRlKClcbiAgICB9LFxuICAgIGVycm9yOiB7XG4gICAgICBnZXQ6ICgpID0+IGVycm9yKClcbiAgICB9LFxuICAgIGxvYWRpbmc6IHtcbiAgICAgIGdldCgpIHtcbiAgICAgICAgY29uc3QgcyA9IHN0YXRlKCk7XG4gICAgICAgIHJldHVybiBzID09PSBcInBlbmRpbmdcIiB8fCBzID09PSBcInJlZnJlc2hpbmdcIjtcbiAgICAgIH1cbiAgICB9LFxuICAgIGxhdGVzdDoge1xuICAgICAgZ2V0KCkge1xuICAgICAgICBpZiAoIXJlc29sdmVkKSByZXR1cm4gcmVhZCgpO1xuICAgICAgICBjb25zdCBlcnIgPSBlcnJvcigpO1xuICAgICAgICBpZiAoZXJyICYmICFwcikgdGhyb3cgZXJyO1xuICAgICAgICByZXR1cm4gdmFsdWUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuICBsZXQgb3duZXIgPSBPd25lcjtcbiAgaWYgKGR5bmFtaWMpIGNyZWF0ZUNvbXB1dGVkKCgpID0+IChvd25lciA9IE93bmVyLCBsb2FkKGZhbHNlKSkpO2Vsc2UgbG9hZChmYWxzZSk7XG4gIHJldHVybiBbcmVhZCwge1xuICAgIHJlZmV0Y2g6IGluZm8gPT4gcnVuV2l0aE93bmVyKG93bmVyLCAoKSA9PiBsb2FkKGluZm8pKSxcbiAgICBtdXRhdGU6IHNldFZhbHVlXG4gIH1dO1xufVxuZnVuY3Rpb24gY3JlYXRlRGVmZXJyZWQoc291cmNlLCBvcHRpb25zKSB7XG4gIGxldCB0LFxuICAgIHRpbWVvdXQgPSBvcHRpb25zID8gb3B0aW9ucy50aW1lb3V0TXMgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IG5vZGUgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB7XG4gICAgaWYgKCF0IHx8ICF0LmZuKSB0ID0gcmVxdWVzdENhbGxiYWNrKCgpID0+IHNldERlZmVycmVkKCgpID0+IG5vZGUudmFsdWUpLCB0aW1lb3V0ICE9PSB1bmRlZmluZWQgPyB7XG4gICAgICB0aW1lb3V0XG4gICAgfSA6IHVuZGVmaW5lZCk7XG4gICAgcmV0dXJuIHNvdXJjZSgpO1xuICB9LCB1bmRlZmluZWQsIHRydWUpO1xuICBjb25zdCBbZGVmZXJyZWQsIHNldERlZmVycmVkXSA9IGNyZWF0ZVNpZ25hbChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlLCBvcHRpb25zKTtcbiAgdXBkYXRlQ29tcHV0YXRpb24obm9kZSk7XG4gIHNldERlZmVycmVkKCgpID0+IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUpO1xuICByZXR1cm4gZGVmZXJyZWQ7XG59XG5mdW5jdGlvbiBjcmVhdGVTZWxlY3Rvcihzb3VyY2UsIGZuID0gZXF1YWxGbiwgb3B0aW9ucykge1xuICBjb25zdCBzdWJzID0gbmV3IE1hcCgpO1xuICBjb25zdCBub2RlID0gY3JlYXRlQ29tcHV0YXRpb24ocCA9PiB7XG4gICAgY29uc3QgdiA9IHNvdXJjZSgpO1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsXSBvZiBzdWJzLmVudHJpZXMoKSkgaWYgKGZuKGtleSwgdikgIT09IGZuKGtleSwgcCkpIHtcbiAgICAgIGZvciAoY29uc3QgYyBvZiB2YWwudmFsdWVzKCkpIHtcbiAgICAgICAgYy5zdGF0ZSA9IFNUQUxFO1xuICAgICAgICBpZiAoYy5wdXJlKSBVcGRhdGVzLnB1c2goYyk7ZWxzZSBFZmZlY3RzLnB1c2goYyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9LCB1bmRlZmluZWQsIHRydWUsIFNUQUxFLCBvcHRpb25zICk7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICByZXR1cm4ga2V5ID0+IHtcbiAgICBjb25zdCBsaXN0ZW5lciA9IExpc3RlbmVyO1xuICAgIGlmIChsaXN0ZW5lcikge1xuICAgICAgbGV0IGw7XG4gICAgICBpZiAobCA9IHN1YnMuZ2V0KGtleSkpIGwuYWRkKGxpc3RlbmVyKTtlbHNlIHN1YnMuc2V0KGtleSwgbCA9IG5ldyBTZXQoW2xpc3RlbmVyXSkpO1xuICAgICAgb25DbGVhbnVwKCgpID0+IHtcbiAgICAgICAgbC5kZWxldGUobGlzdGVuZXIpO1xuICAgICAgICAhbC5zaXplICYmIHN1YnMuZGVsZXRlKGtleSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGZuKGtleSwgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSk7XG4gIH07XG59XG5mdW5jdGlvbiBiYXRjaChmbikge1xuICByZXR1cm4gcnVuVXBkYXRlcyhmbiwgZmFsc2UpO1xufVxuZnVuY3Rpb24gdW50cmFjayhmbikge1xuICBpZiAoIUV4dGVybmFsU291cmNlQ29uZmlnICYmIExpc3RlbmVyID09PSBudWxsKSByZXR1cm4gZm4oKTtcbiAgY29uc3QgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgTGlzdGVuZXIgPSBudWxsO1xuICB0cnkge1xuICAgIGlmIChFeHRlcm5hbFNvdXJjZUNvbmZpZykgcmV0dXJuIEV4dGVybmFsU291cmNlQ29uZmlnLnVudHJhY2soZm4pO1xuICAgIHJldHVybiBmbigpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIG9uKGRlcHMsIGZuLCBvcHRpb25zKSB7XG4gIGNvbnN0IGlzQXJyYXkgPSBBcnJheS5pc0FycmF5KGRlcHMpO1xuICBsZXQgcHJldklucHV0O1xuICBsZXQgZGVmZXIgPSBvcHRpb25zICYmIG9wdGlvbnMuZGVmZXI7XG4gIHJldHVybiBwcmV2VmFsdWUgPT4ge1xuICAgIGxldCBpbnB1dDtcbiAgICBpZiAoaXNBcnJheSkge1xuICAgICAgaW5wdXQgPSBBcnJheShkZXBzLmxlbmd0aCk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRlcHMubGVuZ3RoOyBpKyspIGlucHV0W2ldID0gZGVwc1tpXSgpO1xuICAgIH0gZWxzZSBpbnB1dCA9IGRlcHMoKTtcbiAgICBpZiAoZGVmZXIpIHtcbiAgICAgIGRlZmVyID0gZmFsc2U7XG4gICAgICByZXR1cm4gcHJldlZhbHVlO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSB1bnRyYWNrKCgpID0+IGZuKGlucHV0LCBwcmV2SW5wdXQsIHByZXZWYWx1ZSkpO1xuICAgIHByZXZJbnB1dCA9IGlucHV0O1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG59XG5mdW5jdGlvbiBvbk1vdW50KGZuKSB7XG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB1bnRyYWNrKGZuKSk7XG59XG5mdW5jdGlvbiBvbkNsZWFudXAoZm4pIHtcbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJjbGVhbnVwcyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBydW5cIik7ZWxzZSBpZiAoT3duZXIuY2xlYW51cHMgPT09IG51bGwpIE93bmVyLmNsZWFudXBzID0gW2ZuXTtlbHNlIE93bmVyLmNsZWFudXBzLnB1c2goZm4pO1xuICByZXR1cm4gZm47XG59XG5mdW5jdGlvbiBjYXRjaEVycm9yKGZuLCBoYW5kbGVyKSB7XG4gIEVSUk9SIHx8IChFUlJPUiA9IFN5bWJvbChcImVycm9yXCIpKTtcbiAgT3duZXIgPSBjcmVhdGVDb21wdXRhdGlvbih1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIE93bmVyLmNvbnRleHQgPSB7XG4gICAgLi4uT3duZXIuY29udGV4dCxcbiAgICBbRVJST1JdOiBbaGFuZGxlcl1cbiAgfTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKE93bmVyKTtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZm4oKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaGFuZGxlRXJyb3IoZXJyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBPd25lciA9IE93bmVyLm93bmVyO1xuICB9XG59XG5mdW5jdGlvbiBnZXRMaXN0ZW5lcigpIHtcbiAgcmV0dXJuIExpc3RlbmVyO1xufVxuZnVuY3Rpb24gZ2V0T3duZXIoKSB7XG4gIHJldHVybiBPd25lcjtcbn1cbmZ1bmN0aW9uIHJ1bldpdGhPd25lcihvLCBmbikge1xuICBjb25zdCBwcmV2ID0gT3duZXI7XG4gIGNvbnN0IHByZXZMaXN0ZW5lciA9IExpc3RlbmVyO1xuICBPd25lciA9IG87XG4gIExpc3RlbmVyID0gbnVsbDtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcnVuVXBkYXRlcyhmbiwgdHJ1ZSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGhhbmRsZUVycm9yKGVycik7XG4gIH0gZmluYWxseSB7XG4gICAgT3duZXIgPSBwcmV2O1xuICAgIExpc3RlbmVyID0gcHJldkxpc3RlbmVyO1xuICB9XG59XG5mdW5jdGlvbiBlbmFibGVTY2hlZHVsaW5nKHNjaGVkdWxlciA9IHJlcXVlc3RDYWxsYmFjaykge1xuICBTY2hlZHVsZXIgPSBzY2hlZHVsZXI7XG59XG5mdW5jdGlvbiBzdGFydFRyYW5zaXRpb24oZm4pIHtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgZm4oKTtcbiAgICByZXR1cm4gVHJhbnNpdGlvbi5kb25lO1xuICB9XG4gIGNvbnN0IGwgPSBMaXN0ZW5lcjtcbiAgY29uc3QgbyA9IE93bmVyO1xuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbigoKSA9PiB7XG4gICAgTGlzdGVuZXIgPSBsO1xuICAgIE93bmVyID0gbztcbiAgICBsZXQgdDtcbiAgICBpZiAoU2NoZWR1bGVyIHx8IFN1c3BlbnNlQ29udGV4dCkge1xuICAgICAgdCA9IFRyYW5zaXRpb24gfHwgKFRyYW5zaXRpb24gPSB7XG4gICAgICAgIHNvdXJjZXM6IG5ldyBTZXQoKSxcbiAgICAgICAgZWZmZWN0czogW10sXG4gICAgICAgIHByb21pc2VzOiBuZXcgU2V0KCksXG4gICAgICAgIGRpc3Bvc2VkOiBuZXcgU2V0KCksXG4gICAgICAgIHF1ZXVlOiBuZXcgU2V0KCksXG4gICAgICAgIHJ1bm5pbmc6IHRydWVcbiAgICAgIH0pO1xuICAgICAgdC5kb25lIHx8ICh0LmRvbmUgPSBuZXcgUHJvbWlzZShyZXMgPT4gdC5yZXNvbHZlID0gcmVzKSk7XG4gICAgICB0LnJ1bm5pbmcgPSB0cnVlO1xuICAgIH1cbiAgICBydW5VcGRhdGVzKGZuLCBmYWxzZSk7XG4gICAgTGlzdGVuZXIgPSBPd25lciA9IG51bGw7XG4gICAgcmV0dXJuIHQgPyB0LmRvbmUgOiB1bmRlZmluZWQ7XG4gIH0pO1xufVxuY29uc3QgW3RyYW5zUGVuZGluZywgc2V0VHJhbnNQZW5kaW5nXSA9IC8qQF9fUFVSRV9fKi9jcmVhdGVTaWduYWwoZmFsc2UpO1xuZnVuY3Rpb24gdXNlVHJhbnNpdGlvbigpIHtcbiAgcmV0dXJuIFt0cmFuc1BlbmRpbmcsIHN0YXJ0VHJhbnNpdGlvbl07XG59XG5mdW5jdGlvbiByZXN1bWVFZmZlY3RzKGUpIHtcbiAgRWZmZWN0cy5wdXNoLmFwcGx5KEVmZmVjdHMsIGUpO1xuICBlLmxlbmd0aCA9IDA7XG59XG5mdW5jdGlvbiBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMpIHtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKCgpID0+IHVudHJhY2soKCkgPT4ge1xuICAgIE9iamVjdC5hc3NpZ24oQ29tcCwge1xuICAgICAgWyRERVZDT01QXTogdHJ1ZVxuICAgIH0pO1xuICAgIHJldHVybiBDb21wKHByb3BzKTtcbiAgfSksIHVuZGVmaW5lZCwgdHJ1ZSwgMCk7XG4gIGMucHJvcHMgPSBwcm9wcztcbiAgYy5vYnNlcnZlcnMgPSBudWxsO1xuICBjLm9ic2VydmVyU2xvdHMgPSBudWxsO1xuICBjLm5hbWUgPSBDb21wLm5hbWU7XG4gIGMuY29tcG9uZW50ID0gQ29tcDtcbiAgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIHJldHVybiBjLnRWYWx1ZSAhPT0gdW5kZWZpbmVkID8gYy50VmFsdWUgOiBjLnZhbHVlO1xufVxuZnVuY3Rpb24gcmVnaXN0ZXJHcmFwaCh2YWx1ZSkge1xuICBpZiAoT3duZXIpIHtcbiAgICBpZiAoT3duZXIuc291cmNlTWFwKSBPd25lci5zb3VyY2VNYXAucHVzaCh2YWx1ZSk7ZWxzZSBPd25lci5zb3VyY2VNYXAgPSBbdmFsdWVdO1xuICAgIHZhbHVlLmdyYXBoID0gT3duZXI7XG4gIH1cbiAgaWYgKERldkhvb2tzLmFmdGVyUmVnaXN0ZXJHcmFwaCkgRGV2SG9va3MuYWZ0ZXJSZWdpc3RlckdyYXBoKHZhbHVlKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbnRleHQoZGVmYXVsdFZhbHVlLCBvcHRpb25zKSB7XG4gIGNvbnN0IGlkID0gU3ltYm9sKFwiY29udGV4dFwiKTtcbiAgcmV0dXJuIHtcbiAgICBpZCxcbiAgICBQcm92aWRlcjogY3JlYXRlUHJvdmlkZXIoaWQsIG9wdGlvbnMpLFxuICAgIGRlZmF1bHRWYWx1ZVxuICB9O1xufVxuZnVuY3Rpb24gdXNlQ29udGV4dChjb250ZXh0KSB7XG4gIGxldCB2YWx1ZTtcbiAgcmV0dXJuIE93bmVyICYmIE93bmVyLmNvbnRleHQgJiYgKHZhbHVlID0gT3duZXIuY29udGV4dFtjb250ZXh0LmlkXSkgIT09IHVuZGVmaW5lZCA/IHZhbHVlIDogY29udGV4dC5kZWZhdWx0VmFsdWU7XG59XG5mdW5jdGlvbiBjaGlsZHJlbihmbikge1xuICBjb25zdCBjaGlsZHJlbiA9IGNyZWF0ZU1lbW8oZm4pO1xuICBjb25zdCBtZW1vID0gY3JlYXRlTWVtbygoKSA9PiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4oKSksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwiY2hpbGRyZW5cIlxuICB9KSA7XG4gIG1lbW8udG9BcnJheSA9ICgpID0+IHtcbiAgICBjb25zdCBjID0gbWVtbygpO1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KGMpID8gYyA6IGMgIT0gbnVsbCA/IFtjXSA6IFtdO1xuICB9O1xuICByZXR1cm4gbWVtbztcbn1cbmxldCBTdXNwZW5zZUNvbnRleHQ7XG5mdW5jdGlvbiBnZXRTdXNwZW5zZUNvbnRleHQoKSB7XG4gIHJldHVybiBTdXNwZW5zZUNvbnRleHQgfHwgKFN1c3BlbnNlQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQoKSk7XG59XG5mdW5jdGlvbiBlbmFibGVFeHRlcm5hbFNvdXJjZShmYWN0b3J5LCB1bnRyYWNrID0gZm4gPT4gZm4oKSkge1xuICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcpIHtcbiAgICBjb25zdCB7XG4gICAgICBmYWN0b3J5OiBvbGRGYWN0b3J5LFxuICAgICAgdW50cmFjazogb2xkVW50cmFja1xuICAgIH0gPSBFeHRlcm5hbFNvdXJjZUNvbmZpZztcbiAgICBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IHtcbiAgICAgIGZhY3Rvcnk6IChmbiwgdHJpZ2dlcikgPT4ge1xuICAgICAgICBjb25zdCBvbGRTb3VyY2UgPSBvbGRGYWN0b3J5KGZuLCB0cmlnZ2VyKTtcbiAgICAgICAgY29uc3Qgc291cmNlID0gZmFjdG9yeSh4ID0+IG9sZFNvdXJjZS50cmFjayh4KSwgdHJpZ2dlcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHJhY2s6IHggPT4gc291cmNlLnRyYWNrKHgpLFxuICAgICAgICAgIGRpc3Bvc2UoKSB7XG4gICAgICAgICAgICBzb3VyY2UuZGlzcG9zZSgpO1xuICAgICAgICAgICAgb2xkU291cmNlLmRpc3Bvc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgdW50cmFjazogZm4gPT4gb2xkVW50cmFjaygoKSA9PiB1bnRyYWNrKGZuKSlcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIEV4dGVybmFsU291cmNlQ29uZmlnID0ge1xuICAgICAgZmFjdG9yeSxcbiAgICAgIHVudHJhY2tcbiAgICB9O1xuICB9XG59XG5mdW5jdGlvbiByZWFkU2lnbmFsKCkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAodGhpcy5zb3VyY2VzICYmIChydW5uaW5nVHJhbnNpdGlvbiA/IHRoaXMudFN0YXRlIDogdGhpcy5zdGF0ZSkpIHtcbiAgICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gdGhpcy50U3RhdGUgOiB0aGlzLnN0YXRlKSA9PT0gU1RBTEUpIHVwZGF0ZUNvbXB1dGF0aW9uKHRoaXMpO2Vsc2Uge1xuICAgICAgY29uc3QgdXBkYXRlcyA9IFVwZGF0ZXM7XG4gICAgICBVcGRhdGVzID0gbnVsbDtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4gbG9va1Vwc3RyZWFtKHRoaXMpLCBmYWxzZSk7XG4gICAgICBVcGRhdGVzID0gdXBkYXRlcztcbiAgICB9XG4gIH1cbiAgaWYgKExpc3RlbmVyKSB7XG4gICAgY29uc3Qgc1Nsb3QgPSB0aGlzLm9ic2VydmVycyA/IHRoaXMub2JzZXJ2ZXJzLmxlbmd0aCA6IDA7XG4gICAgaWYgKCFMaXN0ZW5lci5zb3VyY2VzKSB7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VzID0gW3RoaXNdO1xuICAgICAgTGlzdGVuZXIuc291cmNlU2xvdHMgPSBbc1Nsb3RdO1xuICAgIH0gZWxzZSB7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VzLnB1c2godGhpcyk7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VTbG90cy5wdXNoKHNTbG90KTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLm9ic2VydmVycykge1xuICAgICAgdGhpcy5vYnNlcnZlcnMgPSBbTGlzdGVuZXJdO1xuICAgICAgdGhpcy5vYnNlcnZlclNsb3RzID0gW0xpc3RlbmVyLnNvdXJjZXMubGVuZ3RoIC0gMV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub2JzZXJ2ZXJzLnB1c2goTGlzdGVuZXIpO1xuICAgICAgdGhpcy5vYnNlcnZlclNsb3RzLnB1c2goTGlzdGVuZXIuc291cmNlcy5sZW5ndGggLSAxKTtcbiAgICB9XG4gIH1cbiAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXModGhpcykpIHJldHVybiB0aGlzLnRWYWx1ZTtcbiAgcmV0dXJuIHRoaXMudmFsdWU7XG59XG5mdW5jdGlvbiB3cml0ZVNpZ25hbChub2RlLCB2YWx1ZSwgaXNDb21wKSB7XG4gIGxldCBjdXJyZW50ID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZTtcbiAgaWYgKCFub2RlLmNvbXBhcmF0b3IgfHwgIW5vZGUuY29tcGFyYXRvcihjdXJyZW50LCB2YWx1ZSkpIHtcbiAgICBpZiAoVHJhbnNpdGlvbikge1xuICAgICAgY29uc3QgVHJhbnNpdGlvblJ1bm5pbmcgPSBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gICAgICBpZiAoVHJhbnNpdGlvblJ1bm5pbmcgfHwgIWlzQ29tcCAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpKSB7XG4gICAgICAgIFRyYW5zaXRpb24uc291cmNlcy5hZGQobm9kZSk7XG4gICAgICAgIG5vZGUudFZhbHVlID0gdmFsdWU7XG4gICAgICB9XG4gICAgICBpZiAoIVRyYW5zaXRpb25SdW5uaW5nKSBub2RlLnZhbHVlID0gdmFsdWU7XG4gICAgfSBlbHNlIG5vZGUudmFsdWUgPSB2YWx1ZTtcbiAgICBpZiAobm9kZS5vYnNlcnZlcnMgJiYgbm9kZS5vYnNlcnZlcnMubGVuZ3RoKSB7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLm9ic2VydmVycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgIGNvbnN0IG8gPSBub2RlLm9ic2VydmVyc1tpXTtcbiAgICAgICAgICBjb25zdCBUcmFuc2l0aW9uUnVubmluZyA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgICAgICAgIGlmIChUcmFuc2l0aW9uUnVubmluZyAmJiBUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyhvKSkgY29udGludWU7XG4gICAgICAgICAgaWYgKFRyYW5zaXRpb25SdW5uaW5nID8gIW8udFN0YXRlIDogIW8uc3RhdGUpIHtcbiAgICAgICAgICAgIGlmIChvLnB1cmUpIFVwZGF0ZXMucHVzaChvKTtlbHNlIEVmZmVjdHMucHVzaChvKTtcbiAgICAgICAgICAgIGlmIChvLm9ic2VydmVycykgbWFya0Rvd25zdHJlYW0obyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghVHJhbnNpdGlvblJ1bm5pbmcpIG8uc3RhdGUgPSBTVEFMRTtlbHNlIG8udFN0YXRlID0gU1RBTEU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFVwZGF0ZXMubGVuZ3RoID4gMTBlNSkge1xuICAgICAgICAgIFVwZGF0ZXMgPSBbXTtcbiAgICAgICAgICBpZiAoSVNfREVWKSB0aHJvdyBuZXcgRXJyb3IoXCJQb3RlbnRpYWwgSW5maW5pdGUgTG9vcCBEZXRlY3RlZC5cIik7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gdXBkYXRlQ29tcHV0YXRpb24obm9kZSkge1xuICBpZiAoIW5vZGUuZm4pIHJldHVybjtcbiAgY2xlYW5Ob2RlKG5vZGUpO1xuICBjb25zdCB0aW1lID0gRXhlY0NvdW50O1xuICBydW5Db21wdXRhdGlvbihub2RlLCBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlLCB0aW1lKTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgIVRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpKSB7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIFRyYW5zaXRpb24gJiYgKFRyYW5zaXRpb24ucnVubmluZyA9IHRydWUpO1xuICAgICAgICBMaXN0ZW5lciA9IE93bmVyID0gbm9kZTtcbiAgICAgICAgcnVuQ29tcHV0YXRpb24obm9kZSwgbm9kZS50VmFsdWUsIHRpbWUpO1xuICAgICAgICBMaXN0ZW5lciA9IE93bmVyID0gbnVsbDtcbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9KTtcbiAgfVxufVxuZnVuY3Rpb24gcnVuQ29tcHV0YXRpb24obm9kZSwgdmFsdWUsIHRpbWUpIHtcbiAgbGV0IG5leHRWYWx1ZTtcbiAgY29uc3Qgb3duZXIgPSBPd25lcixcbiAgICBsaXN0ZW5lciA9IExpc3RlbmVyO1xuICBMaXN0ZW5lciA9IE93bmVyID0gbm9kZTtcbiAgdHJ5IHtcbiAgICBuZXh0VmFsdWUgPSBub2RlLmZuKHZhbHVlKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKG5vZGUucHVyZSkge1xuICAgICAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgICAgIG5vZGUudFN0YXRlID0gU1RBTEU7XG4gICAgICAgIG5vZGUudE93bmVkICYmIG5vZGUudE93bmVkLmZvckVhY2goY2xlYW5Ob2RlKTtcbiAgICAgICAgbm9kZS50T3duZWQgPSB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBub2RlLnN0YXRlID0gU1RBTEU7XG4gICAgICAgIG5vZGUub3duZWQgJiYgbm9kZS5vd25lZC5mb3JFYWNoKGNsZWFuTm9kZSk7XG4gICAgICAgIG5vZGUub3duZWQgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBub2RlLnVwZGF0ZWRBdCA9IHRpbWUgKyAxO1xuICAgIHJldHVybiBoYW5kbGVFcnJvcihlcnIpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gICAgT3duZXIgPSBvd25lcjtcbiAgfVxuICBpZiAoIW5vZGUudXBkYXRlZEF0IHx8IG5vZGUudXBkYXRlZEF0IDw9IHRpbWUpIHtcbiAgICBpZiAobm9kZS51cGRhdGVkQXQgIT0gbnVsbCAmJiBcIm9ic2VydmVyc1wiIGluIG5vZGUpIHtcbiAgICAgIHdyaXRlU2lnbmFsKG5vZGUsIG5leHRWYWx1ZSwgdHJ1ZSk7XG4gICAgfSBlbHNlIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBub2RlLnB1cmUpIHtcbiAgICAgIFRyYW5zaXRpb24uc291cmNlcy5hZGQobm9kZSk7XG4gICAgICBub2RlLnRWYWx1ZSA9IG5leHRWYWx1ZTtcbiAgICB9IGVsc2Ugbm9kZS52YWx1ZSA9IG5leHRWYWx1ZTtcbiAgICBub2RlLnVwZGF0ZWRBdCA9IHRpbWU7XG4gIH1cbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCBpbml0LCBwdXJlLCBzdGF0ZSA9IFNUQUxFLCBvcHRpb25zKSB7XG4gIGNvbnN0IGMgPSB7XG4gICAgZm4sXG4gICAgc3RhdGU6IHN0YXRlLFxuICAgIHVwZGF0ZWRBdDogbnVsbCxcbiAgICBvd25lZDogbnVsbCxcbiAgICBzb3VyY2VzOiBudWxsLFxuICAgIHNvdXJjZVNsb3RzOiBudWxsLFxuICAgIGNsZWFudXBzOiBudWxsLFxuICAgIHZhbHVlOiBpbml0LFxuICAgIG93bmVyOiBPd25lcixcbiAgICBjb250ZXh0OiBPd25lciA/IE93bmVyLmNvbnRleHQgOiBudWxsLFxuICAgIHB1cmVcbiAgfTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgYy5zdGF0ZSA9IDA7XG4gICAgYy50U3RhdGUgPSBzdGF0ZTtcbiAgfVxuICBpZiAoT3duZXIgPT09IG51bGwpIGNvbnNvbGUud2FybihcImNvbXB1dGF0aW9ucyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBkaXNwb3NlZFwiKTtlbHNlIGlmIChPd25lciAhPT0gVU5PV05FRCkge1xuICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBPd25lci5wdXJlKSB7XG4gICAgICBpZiAoIU93bmVyLnRPd25lZCkgT3duZXIudE93bmVkID0gW2NdO2Vsc2UgT3duZXIudE93bmVkLnB1c2goYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghT3duZXIub3duZWQpIE93bmVyLm93bmVkID0gW2NdO2Vsc2UgT3duZXIub3duZWQucHVzaChjKTtcbiAgICB9XG4gIH1cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5uYW1lKSBjLm5hbWUgPSBvcHRpb25zLm5hbWU7XG4gIGlmIChFeHRlcm5hbFNvdXJjZUNvbmZpZyAmJiBjLmZuKSB7XG4gICAgY29uc3QgW3RyYWNrLCB0cmlnZ2VyXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQsIHtcbiAgICAgIGVxdWFsczogZmFsc2VcbiAgICB9KTtcbiAgICBjb25zdCBvcmRpbmFyeSA9IEV4dGVybmFsU291cmNlQ29uZmlnLmZhY3RvcnkoYy5mbiwgdHJpZ2dlcik7XG4gICAgb25DbGVhbnVwKCgpID0+IG9yZGluYXJ5LmRpc3Bvc2UoKSk7XG4gICAgY29uc3QgdHJpZ2dlckluVHJhbnNpdGlvbiA9ICgpID0+IHN0YXJ0VHJhbnNpdGlvbih0cmlnZ2VyKS50aGVuKCgpID0+IGluVHJhbnNpdGlvbi5kaXNwb3NlKCkpO1xuICAgIGNvbnN0IGluVHJhbnNpdGlvbiA9IEV4dGVybmFsU291cmNlQ29uZmlnLmZhY3RvcnkoYy5mbiwgdHJpZ2dlckluVHJhbnNpdGlvbik7XG4gICAgYy5mbiA9IHggPT4ge1xuICAgICAgdHJhY2soKTtcbiAgICAgIHJldHVybiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyA/IGluVHJhbnNpdGlvbi50cmFjayh4KSA6IG9yZGluYXJ5LnRyYWNrKHgpO1xuICAgIH07XG4gIH1cbiAgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lciAmJiBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyKGMpO1xuICByZXR1cm4gYztcbn1cbmZ1bmN0aW9uIHJ1blRvcChub2RlKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSAwKSByZXR1cm47XG4gIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBQRU5ESU5HKSByZXR1cm4gbG9va1Vwc3RyZWFtKG5vZGUpO1xuICBpZiAobm9kZS5zdXNwZW5zZSAmJiB1bnRyYWNrKG5vZGUuc3VzcGVuc2UuaW5GYWxsYmFjaykpIHJldHVybiBub2RlLnN1c3BlbnNlLmVmZmVjdHMucHVzaChub2RlKTtcbiAgY29uc3QgYW5jZXN0b3JzID0gW25vZGVdO1xuICB3aGlsZSAoKG5vZGUgPSBub2RlLm93bmVyKSAmJiAoIW5vZGUudXBkYXRlZEF0IHx8IG5vZGUudXBkYXRlZEF0IDwgRXhlY0NvdW50KSkge1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyhub2RlKSkgcmV0dXJuO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgYW5jZXN0b3JzLnB1c2gobm9kZSk7XG4gIH1cbiAgZm9yIChsZXQgaSA9IGFuY2VzdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIG5vZGUgPSBhbmNlc3RvcnNbaV07XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uKSB7XG4gICAgICBsZXQgdG9wID0gbm9kZSxcbiAgICAgICAgcHJldiA9IGFuY2VzdG9yc1tpICsgMV07XG4gICAgICB3aGlsZSAoKHRvcCA9IHRvcC5vd25lcikgJiYgdG9wICE9PSBwcmV2KSB7XG4gICAgICAgIGlmIChUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyh0b3ApKSByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBTVEFMRSkge1xuICAgICAgdXBkYXRlQ29tcHV0YXRpb24obm9kZSk7XG4gICAgfSBlbHNlIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBQRU5ESU5HKSB7XG4gICAgICBjb25zdCB1cGRhdGVzID0gVXBkYXRlcztcbiAgICAgIFVwZGF0ZXMgPSBudWxsO1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiBsb29rVXBzdHJlYW0obm9kZSwgYW5jZXN0b3JzWzBdKSwgZmFsc2UpO1xuICAgICAgVXBkYXRlcyA9IHVwZGF0ZXM7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBydW5VcGRhdGVzKGZuLCBpbml0KSB7XG4gIGlmIChVcGRhdGVzKSByZXR1cm4gZm4oKTtcbiAgbGV0IHdhaXQgPSBmYWxzZTtcbiAgaWYgKCFpbml0KSBVcGRhdGVzID0gW107XG4gIGlmIChFZmZlY3RzKSB3YWl0ID0gdHJ1ZTtlbHNlIEVmZmVjdHMgPSBbXTtcbiAgRXhlY0NvdW50Kys7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gZm4oKTtcbiAgICBjb21wbGV0ZVVwZGF0ZXMod2FpdCk7XG4gICAgcmV0dXJuIHJlcztcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKCF3YWl0KSBFZmZlY3RzID0gbnVsbDtcbiAgICBVcGRhdGVzID0gbnVsbDtcbiAgICBoYW5kbGVFcnJvcihlcnIpO1xuICB9XG59XG5mdW5jdGlvbiBjb21wbGV0ZVVwZGF0ZXMod2FpdCkge1xuICBpZiAoVXBkYXRlcykge1xuICAgIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHNjaGVkdWxlUXVldWUoVXBkYXRlcyk7ZWxzZSBydW5RdWV1ZShVcGRhdGVzKTtcbiAgICBVcGRhdGVzID0gbnVsbDtcbiAgfVxuICBpZiAod2FpdCkgcmV0dXJuO1xuICBsZXQgcmVzO1xuICBpZiAoVHJhbnNpdGlvbikge1xuICAgIGlmICghVHJhbnNpdGlvbi5wcm9taXNlcy5zaXplICYmICFUcmFuc2l0aW9uLnF1ZXVlLnNpemUpIHtcbiAgICAgIGNvbnN0IHNvdXJjZXMgPSBUcmFuc2l0aW9uLnNvdXJjZXM7XG4gICAgICBjb25zdCBkaXNwb3NlZCA9IFRyYW5zaXRpb24uZGlzcG9zZWQ7XG4gICAgICBFZmZlY3RzLnB1c2guYXBwbHkoRWZmZWN0cywgVHJhbnNpdGlvbi5lZmZlY3RzKTtcbiAgICAgIHJlcyA9IFRyYW5zaXRpb24ucmVzb2x2ZTtcbiAgICAgIGZvciAoY29uc3QgZSBvZiBFZmZlY3RzKSB7XG4gICAgICAgIFwidFN0YXRlXCIgaW4gZSAmJiAoZS5zdGF0ZSA9IGUudFN0YXRlKTtcbiAgICAgICAgZGVsZXRlIGUudFN0YXRlO1xuICAgICAgfVxuICAgICAgVHJhbnNpdGlvbiA9IG51bGw7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBkIG9mIGRpc3Bvc2VkKSBjbGVhbk5vZGUoZCk7XG4gICAgICAgIGZvciAoY29uc3QgdiBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgdi52YWx1ZSA9IHYudFZhbHVlO1xuICAgICAgICAgIGlmICh2Lm93bmVkKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdi5vd25lZC5sZW5ndGg7IGkgPCBsZW47IGkrKykgY2xlYW5Ob2RlKHYub3duZWRbaV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodi50T3duZWQpIHYub3duZWQgPSB2LnRPd25lZDtcbiAgICAgICAgICBkZWxldGUgdi50VmFsdWU7XG4gICAgICAgICAgZGVsZXRlIHYudE93bmVkO1xuICAgICAgICAgIHYudFN0YXRlID0gMDtcbiAgICAgICAgfVxuICAgICAgICBzZXRUcmFuc1BlbmRpbmcoZmFsc2UpO1xuICAgICAgfSwgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgIFRyYW5zaXRpb24uZWZmZWN0cy5wdXNoLmFwcGx5KFRyYW5zaXRpb24uZWZmZWN0cywgRWZmZWN0cyk7XG4gICAgICBFZmZlY3RzID0gbnVsbDtcbiAgICAgIHNldFRyYW5zUGVuZGluZyh0cnVlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cbiAgY29uc3QgZSA9IEVmZmVjdHM7XG4gIEVmZmVjdHMgPSBudWxsO1xuICBpZiAoZS5sZW5ndGgpIHJ1blVwZGF0ZXMoKCkgPT4gcnVuRWZmZWN0cyhlKSwgZmFsc2UpO2Vsc2UgRGV2SG9va3MuYWZ0ZXJVcGRhdGUgJiYgRGV2SG9va3MuYWZ0ZXJVcGRhdGUoKTtcbiAgaWYgKHJlcykgcmVzKCk7XG59XG5mdW5jdGlvbiBydW5RdWV1ZShxdWV1ZSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSBydW5Ub3AocXVldWVbaV0pO1xufVxuZnVuY3Rpb24gc2NoZWR1bGVRdWV1ZShxdWV1ZSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgaXRlbSA9IHF1ZXVlW2ldO1xuICAgIGNvbnN0IHRhc2tzID0gVHJhbnNpdGlvbi5xdWV1ZTtcbiAgICBpZiAoIXRhc2tzLmhhcyhpdGVtKSkge1xuICAgICAgdGFza3MuYWRkKGl0ZW0pO1xuICAgICAgU2NoZWR1bGVyKCgpID0+IHtcbiAgICAgICAgdGFza3MuZGVsZXRlKGl0ZW0pO1xuICAgICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgIHJ1blRvcChpdGVtKTtcbiAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICBUcmFuc2l0aW9uICYmIChUcmFuc2l0aW9uLnJ1bm5pbmcgPSBmYWxzZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIHJ1blVzZXJFZmZlY3RzKHF1ZXVlKSB7XG4gIGxldCBpLFxuICAgIHVzZXJMZW5ndGggPSAwO1xuICBmb3IgKGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBlID0gcXVldWVbaV07XG4gICAgaWYgKCFlLnVzZXIpIHJ1blRvcChlKTtlbHNlIHF1ZXVlW3VzZXJMZW5ndGgrK10gPSBlO1xuICB9XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCkge1xuICAgIGlmIChzaGFyZWRDb25maWcuY291bnQpIHtcbiAgICAgIHNoYXJlZENvbmZpZy5lZmZlY3RzIHx8IChzaGFyZWRDb25maWcuZWZmZWN0cyA9IFtdKTtcbiAgICAgIHNoYXJlZENvbmZpZy5lZmZlY3RzLnB1c2goLi4ucXVldWUuc2xpY2UoMCwgdXNlckxlbmd0aCkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICB9XG4gIGlmIChzaGFyZWRDb25maWcuZWZmZWN0cyAmJiAoc2hhcmVkQ29uZmlnLmRvbmUgfHwgIXNoYXJlZENvbmZpZy5jb3VudCkpIHtcbiAgICBxdWV1ZSA9IFsuLi5zaGFyZWRDb25maWcuZWZmZWN0cywgLi4ucXVldWVdO1xuICAgIHVzZXJMZW5ndGggKz0gc2hhcmVkQ29uZmlnLmVmZmVjdHMubGVuZ3RoO1xuICAgIGRlbGV0ZSBzaGFyZWRDb25maWcuZWZmZWN0cztcbiAgfVxuICBmb3IgKGkgPSAwOyBpIDwgdXNlckxlbmd0aDsgaSsrKSBydW5Ub3AocXVldWVbaV0pO1xufVxuZnVuY3Rpb24gbG9va1Vwc3RyZWFtKG5vZGUsIGlnbm9yZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAocnVubmluZ1RyYW5zaXRpb24pIG5vZGUudFN0YXRlID0gMDtlbHNlIG5vZGUuc3RhdGUgPSAwO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuc291cmNlcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGNvbnN0IHNvdXJjZSA9IG5vZGUuc291cmNlc1tpXTtcbiAgICBpZiAoc291cmNlLnNvdXJjZXMpIHtcbiAgICAgIGNvbnN0IHN0YXRlID0gcnVubmluZ1RyYW5zaXRpb24gPyBzb3VyY2UudFN0YXRlIDogc291cmNlLnN0YXRlO1xuICAgICAgaWYgKHN0YXRlID09PSBTVEFMRSkge1xuICAgICAgICBpZiAoc291cmNlICE9PSBpZ25vcmUgJiYgKCFzb3VyY2UudXBkYXRlZEF0IHx8IHNvdXJjZS51cGRhdGVkQXQgPCBFeGVjQ291bnQpKSBydW5Ub3Aoc291cmNlKTtcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IFBFTkRJTkcpIGxvb2tVcHN0cmVhbShzb3VyY2UsIGlnbm9yZSk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBtYXJrRG93bnN0cmVhbShub2RlKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vYnNlcnZlcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBjb25zdCBvID0gbm9kZS5vYnNlcnZlcnNbaV07XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uID8gIW8udFN0YXRlIDogIW8uc3RhdGUpIHtcbiAgICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbikgby50U3RhdGUgPSBQRU5ESU5HO2Vsc2Ugby5zdGF0ZSA9IFBFTkRJTkc7XG4gICAgICBpZiAoby5wdXJlKSBVcGRhdGVzLnB1c2gobyk7ZWxzZSBFZmZlY3RzLnB1c2gobyk7XG4gICAgICBvLm9ic2VydmVycyAmJiBtYXJrRG93bnN0cmVhbShvKTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIGNsZWFuTm9kZShub2RlKSB7XG4gIGxldCBpO1xuICBpZiAobm9kZS5zb3VyY2VzKSB7XG4gICAgd2hpbGUgKG5vZGUuc291cmNlcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHNvdXJjZSA9IG5vZGUuc291cmNlcy5wb3AoKSxcbiAgICAgICAgaW5kZXggPSBub2RlLnNvdXJjZVNsb3RzLnBvcCgpLFxuICAgICAgICBvYnMgPSBzb3VyY2Uub2JzZXJ2ZXJzO1xuICAgICAgaWYgKG9icyAmJiBvYnMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IG4gPSBvYnMucG9wKCksXG4gICAgICAgICAgcyA9IHNvdXJjZS5vYnNlcnZlclNsb3RzLnBvcCgpO1xuICAgICAgICBpZiAoaW5kZXggPCBvYnMubGVuZ3RoKSB7XG4gICAgICAgICAgbi5zb3VyY2VTbG90c1tzXSA9IGluZGV4O1xuICAgICAgICAgIG9ic1tpbmRleF0gPSBuO1xuICAgICAgICAgIHNvdXJjZS5vYnNlcnZlclNsb3RzW2luZGV4XSA9IHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKG5vZGUudE93bmVkKSB7XG4gICAgZm9yIChpID0gbm9kZS50T3duZWQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGNsZWFuTm9kZShub2RlLnRPd25lZFtpXSk7XG4gICAgZGVsZXRlIG5vZGUudE93bmVkO1xuICB9XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBub2RlLnB1cmUpIHtcbiAgICByZXNldChub2RlLCB0cnVlKTtcbiAgfSBlbHNlIGlmIChub2RlLm93bmVkKSB7XG4gICAgZm9yIChpID0gbm9kZS5vd25lZC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgY2xlYW5Ob2RlKG5vZGUub3duZWRbaV0pO1xuICAgIG5vZGUub3duZWQgPSBudWxsO1xuICB9XG4gIGlmIChub2RlLmNsZWFudXBzKSB7XG4gICAgZm9yIChpID0gbm9kZS5jbGVhbnVwcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgbm9kZS5jbGVhbnVwc1tpXSgpO1xuICAgIG5vZGUuY2xlYW51cHMgPSBudWxsO1xuICB9XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgbm9kZS50U3RhdGUgPSAwO2Vsc2Ugbm9kZS5zdGF0ZSA9IDA7XG4gIGRlbGV0ZSBub2RlLnNvdXJjZU1hcDtcbn1cbmZ1bmN0aW9uIHJlc2V0KG5vZGUsIHRvcCkge1xuICBpZiAoIXRvcCkge1xuICAgIG5vZGUudFN0YXRlID0gMDtcbiAgICBUcmFuc2l0aW9uLmRpc3Bvc2VkLmFkZChub2RlKTtcbiAgfVxuICBpZiAobm9kZS5vd25lZCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vd25lZC5sZW5ndGg7IGkrKykgcmVzZXQobm9kZS5vd25lZFtpXSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGNhc3RFcnJvcihlcnIpIHtcbiAgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gZXJyO1xuICByZXR1cm4gbmV3IEVycm9yKHR5cGVvZiBlcnIgPT09IFwic3RyaW5nXCIgPyBlcnIgOiBcIlVua25vd24gZXJyb3JcIiwge1xuICAgIGNhdXNlOiBlcnJcbiAgfSk7XG59XG5mdW5jdGlvbiBydW5FcnJvcnMoZXJyLCBmbnMsIG93bmVyKSB7XG4gIHRyeSB7XG4gICAgZm9yIChjb25zdCBmIG9mIGZucykgZihlcnIpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaGFuZGxlRXJyb3IoZSwgb3duZXIgJiYgb3duZXIub3duZXIgfHwgbnVsbCk7XG4gIH1cbn1cbmZ1bmN0aW9uIGhhbmRsZUVycm9yKGVyciwgb3duZXIgPSBPd25lcikge1xuICBjb25zdCBmbnMgPSBFUlJPUiAmJiBvd25lciAmJiBvd25lci5jb250ZXh0ICYmIG93bmVyLmNvbnRleHRbRVJST1JdO1xuICBjb25zdCBlcnJvciA9IGNhc3RFcnJvcihlcnIpO1xuICBpZiAoIWZucykgdGhyb3cgZXJyb3I7XG4gIGlmIChFZmZlY3RzKSBFZmZlY3RzLnB1c2goe1xuICAgIGZuKCkge1xuICAgICAgcnVuRXJyb3JzKGVycm9yLCBmbnMsIG93bmVyKTtcbiAgICB9LFxuICAgIHN0YXRlOiBTVEFMRVxuICB9KTtlbHNlIHJ1bkVycm9ycyhlcnJvciwgZm5zLCBvd25lcik7XG59XG5mdW5jdGlvbiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4pIHtcbiAgaWYgKHR5cGVvZiBjaGlsZHJlbiA9PT0gXCJmdW5jdGlvblwiICYmICFjaGlsZHJlbi5sZW5ndGgpIHJldHVybiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4oKSk7XG4gIGlmIChBcnJheS5pc0FycmF5KGNoaWxkcmVuKSkge1xuICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW5baV0pO1xuICAgICAgQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0cy5wdXNoLmFwcGx5KHJlc3VsdHMsIHJlc3VsdCkgOiByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cbiAgcmV0dXJuIGNoaWxkcmVuO1xufVxuZnVuY3Rpb24gY3JlYXRlUHJvdmlkZXIoaWQsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHByb3ZpZGVyKHByb3BzKSB7XG4gICAgbGV0IHJlcztcbiAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gcmVzID0gdW50cmFjaygoKSA9PiB7XG4gICAgICBPd25lci5jb250ZXh0ID0ge1xuICAgICAgICAuLi5Pd25lci5jb250ZXh0LFxuICAgICAgICBbaWRdOiBwcm9wcy52YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiBjaGlsZHJlbigoKSA9PiBwcm9wcy5jaGlsZHJlbik7XG4gICAgfSksIHVuZGVmaW5lZCwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcbn1cbmZ1bmN0aW9uIG9uRXJyb3IoZm4pIHtcbiAgRVJST1IgfHwgKEVSUk9SID0gU3ltYm9sKFwiZXJyb3JcIikpO1xuICBpZiAoT3duZXIgPT09IG51bGwpIGNvbnNvbGUud2FybihcImVycm9yIGhhbmRsZXJzIGNyZWF0ZWQgb3V0c2lkZSBhIGBjcmVhdGVSb290YCBvciBgcmVuZGVyYCB3aWxsIG5ldmVyIGJlIHJ1blwiKTtlbHNlIGlmIChPd25lci5jb250ZXh0ID09PSBudWxsIHx8ICFPd25lci5jb250ZXh0W0VSUk9SXSkge1xuICAgIE93bmVyLmNvbnRleHQgPSB7XG4gICAgICAuLi5Pd25lci5jb250ZXh0LFxuICAgICAgW0VSUk9SXTogW2ZuXVxuICAgIH07XG4gICAgbXV0YXRlQ29udGV4dChPd25lciwgRVJST1IsIFtmbl0pO1xuICB9IGVsc2UgT3duZXIuY29udGV4dFtFUlJPUl0ucHVzaChmbik7XG59XG5mdW5jdGlvbiBtdXRhdGVDb250ZXh0KG8sIGtleSwgdmFsdWUpIHtcbiAgaWYgKG8ub3duZWQpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG8ub3duZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChvLm93bmVkW2ldLmNvbnRleHQgPT09IG8uY29udGV4dCkgbXV0YXRlQ29udGV4dChvLm93bmVkW2ldLCBrZXksIHZhbHVlKTtcbiAgICAgIGlmICghby5vd25lZFtpXS5jb250ZXh0KSB7XG4gICAgICAgIG8ub3duZWRbaV0uY29udGV4dCA9IG8uY29udGV4dDtcbiAgICAgICAgbXV0YXRlQ29udGV4dChvLm93bmVkW2ldLCBrZXksIHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoIW8ub3duZWRbaV0uY29udGV4dFtrZXldKSB7XG4gICAgICAgIG8ub3duZWRbaV0uY29udGV4dFtrZXldID0gdmFsdWU7XG4gICAgICAgIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIG9ic2VydmFibGUoaW5wdXQpIHtcbiAgcmV0dXJuIHtcbiAgICBzdWJzY3JpYmUob2JzZXJ2ZXIpIHtcbiAgICAgIGlmICghKG9ic2VydmVyIGluc3RhbmNlb2YgT2JqZWN0KSB8fCBvYnNlcnZlciA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJFeHBlY3RlZCB0aGUgb2JzZXJ2ZXIgdG8gYmUgYW4gb2JqZWN0LlwiKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGhhbmRsZXIgPSB0eXBlb2Ygb2JzZXJ2ZXIgPT09IFwiZnVuY3Rpb25cIiA/IG9ic2VydmVyIDogb2JzZXJ2ZXIubmV4dCAmJiBvYnNlcnZlci5uZXh0LmJpbmQob2JzZXJ2ZXIpO1xuICAgICAgaWYgKCFoYW5kbGVyKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdW5zdWJzY3JpYmUoKSB7fVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgY29uc3QgZGlzcG9zZSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHYgPSBpbnB1dCgpO1xuICAgICAgICAgIHVudHJhY2soKCkgPT4gaGFuZGxlcih2KSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGlzcG9zZXI7XG4gICAgICB9KTtcbiAgICAgIGlmIChnZXRPd25lcigpKSBvbkNsZWFudXAoZGlzcG9zZSk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpIHtcbiAgICAgICAgICBkaXNwb3NlKCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSxcbiAgICBbU3ltYm9sLm9ic2VydmFibGUgfHwgXCJAQG9ic2VydmFibGVcIl0oKSB7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiBmcm9tKHByb2R1Y2VyLCBpbml0YWxWYWx1ZSA9IHVuZGVmaW5lZCkge1xuICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbChpbml0YWxWYWx1ZSwge1xuICAgIGVxdWFsczogZmFsc2VcbiAgfSk7XG4gIGlmIChcInN1YnNjcmliZVwiIGluIHByb2R1Y2VyKSB7XG4gICAgY29uc3QgdW5zdWIgPSBwcm9kdWNlci5zdWJzY3JpYmUodiA9PiBzZXQoKCkgPT4gdikpO1xuICAgIG9uQ2xlYW51cCgoKSA9PiBcInVuc3Vic2NyaWJlXCIgaW4gdW5zdWIgPyB1bnN1Yi51bnN1YnNjcmliZSgpIDogdW5zdWIoKSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgY2xlYW4gPSBwcm9kdWNlcihzZXQpO1xuICAgIG9uQ2xlYW51cChjbGVhbik7XG4gIH1cbiAgcmV0dXJuIHM7XG59XG5cbmNvbnN0IEZBTExCQUNLID0gU3ltYm9sKFwiZmFsbGJhY2tcIik7XG5mdW5jdGlvbiBkaXNwb3NlKGQpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBkLmxlbmd0aDsgaSsrKSBkW2ldKCk7XG59XG5mdW5jdGlvbiBtYXBBcnJheShsaXN0LCBtYXBGbiwgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCBpdGVtcyA9IFtdLFxuICAgIG1hcHBlZCA9IFtdLFxuICAgIGRpc3Bvc2VycyA9IFtdLFxuICAgIGxlbiA9IDAsXG4gICAgaW5kZXhlcyA9IG1hcEZuLmxlbmd0aCA+IDEgPyBbXSA6IG51bGw7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlKGRpc3Bvc2VycykpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGxldCBuZXdJdGVtcyA9IGxpc3QoKSB8fCBbXSxcbiAgICAgIG5ld0xlbiA9IG5ld0l0ZW1zLmxlbmd0aCxcbiAgICAgIGksXG4gICAgICBqO1xuICAgIG5ld0l0ZW1zWyRUUkFDS107XG4gICAgcmV0dXJuIHVudHJhY2soKCkgPT4ge1xuICAgICAgbGV0IG5ld0luZGljZXMsIG5ld0luZGljZXNOZXh0LCB0ZW1wLCB0ZW1wZGlzcG9zZXJzLCB0ZW1wSW5kZXhlcywgc3RhcnQsIGVuZCwgbmV3RW5kLCBpdGVtO1xuICAgICAgaWYgKG5ld0xlbiA9PT0gMCkge1xuICAgICAgICBpZiAobGVuICE9PSAwKSB7XG4gICAgICAgICAgZGlzcG9zZShkaXNwb3NlcnMpO1xuICAgICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgICAgbWFwcGVkID0gW107XG4gICAgICAgICAgbGVuID0gMDtcbiAgICAgICAgICBpbmRleGVzICYmIChpbmRleGVzID0gW10pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLmZhbGxiYWNrKSB7XG4gICAgICAgICAgaXRlbXMgPSBbRkFMTEJBQ0tdO1xuICAgICAgICAgIG1hcHBlZFswXSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZXJzWzBdID0gZGlzcG9zZXI7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9ucy5mYWxsYmFjaygpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxlbiA9IDE7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGxlbiA9PT0gMCkge1xuICAgICAgICBtYXBwZWQgPSBuZXcgQXJyYXkobmV3TGVuKTtcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IG5ld0xlbjsgaisrKSB7XG4gICAgICAgICAgaXRlbXNbal0gPSBuZXdJdGVtc1tqXTtcbiAgICAgICAgICBtYXBwZWRbal0gPSBjcmVhdGVSb290KG1hcHBlcik7XG4gICAgICAgIH1cbiAgICAgICAgbGVuID0gbmV3TGVuO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGVtcCA9IG5ldyBBcnJheShuZXdMZW4pO1xuICAgICAgICB0ZW1wZGlzcG9zZXJzID0gbmV3IEFycmF5KG5ld0xlbik7XG4gICAgICAgIGluZGV4ZXMgJiYgKHRlbXBJbmRleGVzID0gbmV3IEFycmF5KG5ld0xlbikpO1xuICAgICAgICBmb3IgKHN0YXJ0ID0gMCwgZW5kID0gTWF0aC5taW4obGVuLCBuZXdMZW4pOyBzdGFydCA8IGVuZCAmJiBpdGVtc1tzdGFydF0gPT09IG5ld0l0ZW1zW3N0YXJ0XTsgc3RhcnQrKyk7XG4gICAgICAgIGZvciAoZW5kID0gbGVuIC0gMSwgbmV3RW5kID0gbmV3TGVuIC0gMTsgZW5kID49IHN0YXJ0ICYmIG5ld0VuZCA+PSBzdGFydCAmJiBpdGVtc1tlbmRdID09PSBuZXdJdGVtc1tuZXdFbmRdOyBlbmQtLSwgbmV3RW5kLS0pIHtcbiAgICAgICAgICB0ZW1wW25ld0VuZF0gPSBtYXBwZWRbZW5kXTtcbiAgICAgICAgICB0ZW1wZGlzcG9zZXJzW25ld0VuZF0gPSBkaXNwb3NlcnNbZW5kXTtcbiAgICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlc1tuZXdFbmRdID0gaW5kZXhlc1tlbmRdKTtcbiAgICAgICAgfVxuICAgICAgICBuZXdJbmRpY2VzID0gbmV3IE1hcCgpO1xuICAgICAgICBuZXdJbmRpY2VzTmV4dCA9IG5ldyBBcnJheShuZXdFbmQgKyAxKTtcbiAgICAgICAgZm9yIChqID0gbmV3RW5kOyBqID49IHN0YXJ0OyBqLS0pIHtcbiAgICAgICAgICBpdGVtID0gbmV3SXRlbXNbal07XG4gICAgICAgICAgaSA9IG5ld0luZGljZXMuZ2V0KGl0ZW0pO1xuICAgICAgICAgIG5ld0luZGljZXNOZXh0W2pdID0gaSA9PT0gdW5kZWZpbmVkID8gLTEgOiBpO1xuICAgICAgICAgIG5ld0luZGljZXMuc2V0KGl0ZW0sIGopO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IHN0YXJ0OyBpIDw9IGVuZDsgaSsrKSB7XG4gICAgICAgICAgaXRlbSA9IGl0ZW1zW2ldO1xuICAgICAgICAgIGogPSBuZXdJbmRpY2VzLmdldChpdGVtKTtcbiAgICAgICAgICBpZiAoaiAhPT0gdW5kZWZpbmVkICYmIGogIT09IC0xKSB7XG4gICAgICAgICAgICB0ZW1wW2pdID0gbWFwcGVkW2ldO1xuICAgICAgICAgICAgdGVtcGRpc3Bvc2Vyc1tqXSA9IGRpc3Bvc2Vyc1tpXTtcbiAgICAgICAgICAgIGluZGV4ZXMgJiYgKHRlbXBJbmRleGVzW2pdID0gaW5kZXhlc1tpXSk7XG4gICAgICAgICAgICBqID0gbmV3SW5kaWNlc05leHRbal07XG4gICAgICAgICAgICBuZXdJbmRpY2VzLnNldChpdGVtLCBqKTtcbiAgICAgICAgICB9IGVsc2UgZGlzcG9zZXJzW2ldKCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChqID0gc3RhcnQ7IGogPCBuZXdMZW47IGorKykge1xuICAgICAgICAgIGlmIChqIGluIHRlbXApIHtcbiAgICAgICAgICAgIG1hcHBlZFtqXSA9IHRlbXBbal07XG4gICAgICAgICAgICBkaXNwb3NlcnNbal0gPSB0ZW1wZGlzcG9zZXJzW2pdO1xuICAgICAgICAgICAgaWYgKGluZGV4ZXMpIHtcbiAgICAgICAgICAgICAgaW5kZXhlc1tqXSA9IHRlbXBJbmRleGVzW2pdO1xuICAgICAgICAgICAgICBpbmRleGVzW2pdKGopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBtYXBwZWRbal0gPSBjcmVhdGVSb290KG1hcHBlcik7XG4gICAgICAgIH1cbiAgICAgICAgbWFwcGVkID0gbWFwcGVkLnNsaWNlKDAsIGxlbiA9IG5ld0xlbik7XG4gICAgICAgIGl0ZW1zID0gbmV3SXRlbXMuc2xpY2UoMCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWFwcGVkO1xuICAgIH0pO1xuICAgIGZ1bmN0aW9uIG1hcHBlcihkaXNwb3Nlcikge1xuICAgICAgZGlzcG9zZXJzW2pdID0gZGlzcG9zZXI7XG4gICAgICBpZiAoaW5kZXhlcykge1xuICAgICAgICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbChqLCB7XG4gICAgICAgICAgbmFtZTogXCJpbmRleFwiXG4gICAgICAgIH0pIDtcbiAgICAgICAgaW5kZXhlc1tqXSA9IHNldDtcbiAgICAgICAgcmV0dXJuIG1hcEZuKG5ld0l0ZW1zW2pdLCBzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXBGbihuZXdJdGVtc1tqXSk7XG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gaW5kZXhBcnJheShsaXN0LCBtYXBGbiwgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCBpdGVtcyA9IFtdLFxuICAgIG1hcHBlZCA9IFtdLFxuICAgIGRpc3Bvc2VycyA9IFtdLFxuICAgIHNpZ25hbHMgPSBbXSxcbiAgICBsZW4gPSAwLFxuICAgIGk7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlKGRpc3Bvc2VycykpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGNvbnN0IG5ld0l0ZW1zID0gbGlzdCgpIHx8IFtdLFxuICAgICAgbmV3TGVuID0gbmV3SXRlbXMubGVuZ3RoO1xuICAgIG5ld0l0ZW1zWyRUUkFDS107XG4gICAgcmV0dXJuIHVudHJhY2soKCkgPT4ge1xuICAgICAgaWYgKG5ld0xlbiA9PT0gMCkge1xuICAgICAgICBpZiAobGVuICE9PSAwKSB7XG4gICAgICAgICAgZGlzcG9zZShkaXNwb3NlcnMpO1xuICAgICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgICAgbWFwcGVkID0gW107XG4gICAgICAgICAgbGVuID0gMDtcbiAgICAgICAgICBzaWduYWxzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZmFsbGJhY2spIHtcbiAgICAgICAgICBpdGVtcyA9IFtGQUxMQkFDS107XG4gICAgICAgICAgbWFwcGVkWzBdID0gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgICAgICBkaXNwb3NlcnNbMF0gPSBkaXNwb3NlcjtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb25zLmZhbGxiYWNrKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGVuID0gMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWFwcGVkO1xuICAgICAgfVxuICAgICAgaWYgKGl0ZW1zWzBdID09PSBGQUxMQkFDSykge1xuICAgICAgICBkaXNwb3NlcnNbMF0oKTtcbiAgICAgICAgZGlzcG9zZXJzID0gW107XG4gICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICBsZW4gPSAwO1xuICAgICAgfVxuICAgICAgZm9yIChpID0gMDsgaSA8IG5ld0xlbjsgaSsrKSB7XG4gICAgICAgIGlmIChpIDwgaXRlbXMubGVuZ3RoICYmIGl0ZW1zW2ldICE9PSBuZXdJdGVtc1tpXSkge1xuICAgICAgICAgIHNpZ25hbHNbaV0oKCkgPT4gbmV3SXRlbXNbaV0pO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPj0gaXRlbXMubGVuZ3RoKSB7XG4gICAgICAgICAgbWFwcGVkW2ldID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKDsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGRpc3Bvc2Vyc1tpXSgpO1xuICAgICAgfVxuICAgICAgbGVuID0gc2lnbmFscy5sZW5ndGggPSBkaXNwb3NlcnMubGVuZ3RoID0gbmV3TGVuO1xuICAgICAgaXRlbXMgPSBuZXdJdGVtcy5zbGljZSgwKTtcbiAgICAgIHJldHVybiBtYXBwZWQgPSBtYXBwZWQuc2xpY2UoMCwgbGVuKTtcbiAgICB9KTtcbiAgICBmdW5jdGlvbiBtYXBwZXIoZGlzcG9zZXIpIHtcbiAgICAgIGRpc3Bvc2Vyc1tpXSA9IGRpc3Bvc2VyO1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwobmV3SXRlbXNbaV0sIHtcbiAgICAgICAgbmFtZTogXCJ2YWx1ZVwiXG4gICAgICB9KSA7XG4gICAgICBzaWduYWxzW2ldID0gc2V0O1xuICAgICAgcmV0dXJuIG1hcEZuKHMsIGkpO1xuICAgIH1cbiAgfTtcbn1cblxubGV0IGh5ZHJhdGlvbkVuYWJsZWQgPSBmYWxzZTtcbmZ1bmN0aW9uIGVuYWJsZUh5ZHJhdGlvbigpIHtcbiAgaHlkcmF0aW9uRW5hYmxlZCA9IHRydWU7XG59XG5mdW5jdGlvbiBjcmVhdGVDb21wb25lbnQoQ29tcCwgcHJvcHMpIHtcbiAgaWYgKGh5ZHJhdGlvbkVuYWJsZWQpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQpIHtcbiAgICAgIGNvbnN0IGMgPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KG5leHRIeWRyYXRlQ29udGV4dCgpKTtcbiAgICAgIGNvbnN0IHIgPSBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMgfHwge30pIDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGMpO1xuICAgICAgcmV0dXJuIHI7XG4gICAgfVxuICB9XG4gIHJldHVybiBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMgfHwge30pO1xufVxuZnVuY3Rpb24gdHJ1ZUZuKCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cbmNvbnN0IHByb3BUcmFwcyA9IHtcbiAgZ2V0KF8sIHByb3BlcnR5LCByZWNlaXZlcikge1xuICAgIGlmIChwcm9wZXJ0eSA9PT0gJFBST1hZKSByZXR1cm4gcmVjZWl2ZXI7XG4gICAgcmV0dXJuIF8uZ2V0KHByb3BlcnR5KTtcbiAgfSxcbiAgaGFzKF8sIHByb3BlcnR5KSB7XG4gICAgaWYgKHByb3BlcnR5ID09PSAkUFJPWFkpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBfLmhhcyhwcm9wZXJ0eSk7XG4gIH0sXG4gIHNldDogdHJ1ZUZuLFxuICBkZWxldGVQcm9wZXJ0eTogdHJ1ZUZuLFxuICBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoXywgcHJvcGVydHkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGdldCgpIHtcbiAgICAgICAgcmV0dXJuIF8uZ2V0KHByb3BlcnR5KTtcbiAgICAgIH0sXG4gICAgICBzZXQ6IHRydWVGbixcbiAgICAgIGRlbGV0ZVByb3BlcnR5OiB0cnVlRm5cbiAgICB9O1xuICB9LFxuICBvd25LZXlzKF8pIHtcbiAgICByZXR1cm4gXy5rZXlzKCk7XG4gIH1cbn07XG5mdW5jdGlvbiByZXNvbHZlU291cmNlKHMpIHtcbiAgcmV0dXJuICEocyA9IHR5cGVvZiBzID09PSBcImZ1bmN0aW9uXCIgPyBzKCkgOiBzKSA/IHt9IDogcztcbn1cbmZ1bmN0aW9uIHJlc29sdmVTb3VyY2VzKCkge1xuICBmb3IgKGxldCBpID0gMCwgbGVuZ3RoID0gdGhpcy5sZW5ndGg7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGNvbnN0IHYgPSB0aGlzW2ldKCk7XG4gICAgaWYgKHYgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHY7XG4gIH1cbn1cbmZ1bmN0aW9uIG1lcmdlUHJvcHMoLi4uc291cmNlcykge1xuICBsZXQgcHJveHkgPSBmYWxzZTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgcyA9IHNvdXJjZXNbaV07XG4gICAgcHJveHkgPSBwcm94eSB8fCAhIXMgJiYgJFBST1hZIGluIHM7XG4gICAgc291cmNlc1tpXSA9IHR5cGVvZiBzID09PSBcImZ1bmN0aW9uXCIgPyAocHJveHkgPSB0cnVlLCBjcmVhdGVNZW1vKHMpKSA6IHM7XG4gIH1cbiAgaWYgKFNVUFBPUlRTX1BST1hZICYmIHByb3h5KSB7XG4gICAgcmV0dXJuIG5ldyBQcm94eSh7XG4gICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICBjb25zdCB2ID0gcmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKVtwcm9wZXJ0eV07XG4gICAgICAgICAgaWYgKHYgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHY7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICBpZiAocHJvcGVydHkgaW4gcmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKSkgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIGtleXMoKSB7XG4gICAgICAgIGNvbnN0IGtleXMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VzLmxlbmd0aDsgaSsrKSBrZXlzLnB1c2goLi4uT2JqZWN0LmtleXMocmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKSkpO1xuICAgICAgICByZXR1cm4gWy4uLm5ldyBTZXQoa2V5cyldO1xuICAgICAgfVxuICAgIH0sIHByb3BUcmFwcyk7XG4gIH1cbiAgY29uc3Qgc291cmNlc01hcCA9IHt9O1xuICBjb25zdCBkZWZpbmVkID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBjb25zdCBzb3VyY2UgPSBzb3VyY2VzW2ldO1xuICAgIGlmICghc291cmNlKSBjb250aW51ZTtcbiAgICBjb25zdCBzb3VyY2VLZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoc291cmNlKTtcbiAgICBmb3IgKGxldCBpID0gc291cmNlS2V5cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3Qga2V5ID0gc291cmNlS2V5c1tpXTtcbiAgICAgIGlmIChrZXkgPT09IFwiX19wcm90b19fXCIgfHwga2V5ID09PSBcImNvbnN0cnVjdG9yXCIpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Ioc291cmNlLCBrZXkpO1xuICAgICAgaWYgKCFkZWZpbmVkW2tleV0pIHtcbiAgICAgICAgZGVmaW5lZFtrZXldID0gZGVzYy5nZXQgPyB7XG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgZ2V0OiByZXNvbHZlU291cmNlcy5iaW5kKHNvdXJjZXNNYXBba2V5XSA9IFtkZXNjLmdldC5iaW5kKHNvdXJjZSldKVxuICAgICAgICB9IDogZGVzYy52YWx1ZSAhPT0gdW5kZWZpbmVkID8gZGVzYyA6IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZXMgPSBzb3VyY2VzTWFwW2tleV07XG4gICAgICAgIGlmIChzb3VyY2VzKSB7XG4gICAgICAgICAgaWYgKGRlc2MuZ2V0KSBzb3VyY2VzLnB1c2goZGVzYy5nZXQuYmluZChzb3VyY2UpKTtlbHNlIGlmIChkZXNjLnZhbHVlICE9PSB1bmRlZmluZWQpIHNvdXJjZXMucHVzaCgoKSA9PiBkZXNjLnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBjb25zdCB0YXJnZXQgPSB7fTtcbiAgY29uc3QgZGVmaW5lZEtleXMgPSBPYmplY3Qua2V5cyhkZWZpbmVkKTtcbiAgZm9yIChsZXQgaSA9IGRlZmluZWRLZXlzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3Qga2V5ID0gZGVmaW5lZEtleXNbaV0sXG4gICAgICBkZXNjID0gZGVmaW5lZFtrZXldO1xuICAgIGlmIChkZXNjICYmIGRlc2MuZ2V0KSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIGRlc2MpO2Vsc2UgdGFyZ2V0W2tleV0gPSBkZXNjID8gZGVzYy52YWx1ZSA6IHVuZGVmaW5lZDtcbiAgfVxuICByZXR1cm4gdGFyZ2V0O1xufVxuZnVuY3Rpb24gc3BsaXRQcm9wcyhwcm9wcywgLi4ua2V5cykge1xuICBpZiAoU1VQUE9SVFNfUFJPWFkgJiYgJFBST1hZIGluIHByb3BzKSB7XG4gICAgY29uc3QgYmxvY2tlZCA9IG5ldyBTZXQoa2V5cy5sZW5ndGggPiAxID8ga2V5cy5mbGF0KCkgOiBrZXlzWzBdKTtcbiAgICBjb25zdCByZXMgPSBrZXlzLm1hcChrID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJveHkoe1xuICAgICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gay5pbmNsdWRlcyhwcm9wZXJ0eSkgPyBwcm9wc1twcm9wZXJ0eV0gOiB1bmRlZmluZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIGhhcyhwcm9wZXJ0eSkge1xuICAgICAgICAgIHJldHVybiBrLmluY2x1ZGVzKHByb3BlcnR5KSAmJiBwcm9wZXJ0eSBpbiBwcm9wcztcbiAgICAgICAgfSxcbiAgICAgICAga2V5cygpIHtcbiAgICAgICAgICByZXR1cm4gay5maWx0ZXIocHJvcGVydHkgPT4gcHJvcGVydHkgaW4gcHJvcHMpO1xuICAgICAgICB9XG4gICAgICB9LCBwcm9wVHJhcHMpO1xuICAgIH0pO1xuICAgIHJlcy5wdXNoKG5ldyBQcm94eSh7XG4gICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIGJsb2NrZWQuaGFzKHByb3BlcnR5KSA/IHVuZGVmaW5lZCA6IHByb3BzW3Byb3BlcnR5XTtcbiAgICAgIH0sXG4gICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIGJsb2NrZWQuaGFzKHByb3BlcnR5KSA/IGZhbHNlIDogcHJvcGVydHkgaW4gcHJvcHM7XG4gICAgICB9LFxuICAgICAga2V5cygpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHByb3BzKS5maWx0ZXIoayA9PiAhYmxvY2tlZC5oYXMoaykpO1xuICAgICAgfVxuICAgIH0sIHByb3BUcmFwcykpO1xuICAgIHJldHVybiByZXM7XG4gIH1cbiAgY29uc3Qgb3RoZXJPYmplY3QgPSB7fTtcbiAgY29uc3Qgb2JqZWN0cyA9IGtleXMubWFwKCgpID0+ICh7fSkpO1xuICBmb3IgKGNvbnN0IHByb3BOYW1lIG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHByb3BzKSkge1xuICAgIGNvbnN0IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHByb3BzLCBwcm9wTmFtZSk7XG4gICAgY29uc3QgaXNEZWZhdWx0RGVzYyA9ICFkZXNjLmdldCAmJiAhZGVzYy5zZXQgJiYgZGVzYy5lbnVtZXJhYmxlICYmIGRlc2Mud3JpdGFibGUgJiYgZGVzYy5jb25maWd1cmFibGU7XG4gICAgbGV0IGJsb2NrZWQgPSBmYWxzZTtcbiAgICBsZXQgb2JqZWN0SW5kZXggPSAwO1xuICAgIGZvciAoY29uc3QgayBvZiBrZXlzKSB7XG4gICAgICBpZiAoay5pbmNsdWRlcyhwcm9wTmFtZSkpIHtcbiAgICAgICAgYmxvY2tlZCA9IHRydWU7XG4gICAgICAgIGlzRGVmYXVsdERlc2MgPyBvYmplY3RzW29iamVjdEluZGV4XVtwcm9wTmFtZV0gPSBkZXNjLnZhbHVlIDogT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iamVjdHNbb2JqZWN0SW5kZXhdLCBwcm9wTmFtZSwgZGVzYyk7XG4gICAgICB9XG4gICAgICArK29iamVjdEluZGV4O1xuICAgIH1cbiAgICBpZiAoIWJsb2NrZWQpIHtcbiAgICAgIGlzRGVmYXVsdERlc2MgPyBvdGhlck9iamVjdFtwcm9wTmFtZV0gPSBkZXNjLnZhbHVlIDogT2JqZWN0LmRlZmluZVByb3BlcnR5KG90aGVyT2JqZWN0LCBwcm9wTmFtZSwgZGVzYyk7XG4gICAgfVxuICB9XG4gIHJldHVybiBbLi4ub2JqZWN0cywgb3RoZXJPYmplY3RdO1xufVxuZnVuY3Rpb24gbGF6eShmbikge1xuICBsZXQgY29tcDtcbiAgbGV0IHA7XG4gIGNvbnN0IHdyYXAgPSBwcm9wcyA9PiB7XG4gICAgY29uc3QgY3R4ID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgaWYgKGN0eCkge1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoKTtcbiAgICAgIHNoYXJlZENvbmZpZy5jb3VudCB8fCAoc2hhcmVkQ29uZmlnLmNvdW50ID0gMCk7XG4gICAgICBzaGFyZWRDb25maWcuY291bnQrKztcbiAgICAgIChwIHx8IChwID0gZm4oKSkpLnRoZW4obW9kID0+IHtcbiAgICAgICAgIXNoYXJlZENvbmZpZy5kb25lICYmIHNldEh5ZHJhdGVDb250ZXh0KGN0eCk7XG4gICAgICAgIHNoYXJlZENvbmZpZy5jb3VudC0tO1xuICAgICAgICBzZXQoKCkgPT4gbW9kLmRlZmF1bHQpO1xuICAgICAgICBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICAgICAgfSk7XG4gICAgICBjb21wID0gcztcbiAgICB9IGVsc2UgaWYgKCFjb21wKSB7XG4gICAgICBjb25zdCBbc10gPSBjcmVhdGVSZXNvdXJjZSgoKSA9PiAocCB8fCAocCA9IGZuKCkpKS50aGVuKG1vZCA9PiBtb2QuZGVmYXVsdCkpO1xuICAgICAgY29tcCA9IHM7XG4gICAgfVxuICAgIGxldCBDb21wO1xuICAgIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IChDb21wID0gY29tcCgpKSA/IHVudHJhY2soKCkgPT4ge1xuICAgICAgaWYgKElTX0RFVikgT2JqZWN0LmFzc2lnbihDb21wLCB7XG4gICAgICAgIFskREVWQ09NUF06IHRydWVcbiAgICAgIH0pO1xuICAgICAgaWYgKCFjdHggfHwgc2hhcmVkQ29uZmlnLmRvbmUpIHJldHVybiBDb21wKHByb3BzKTtcbiAgICAgIGNvbnN0IGMgPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGN0eCk7XG4gICAgICBjb25zdCByID0gQ29tcChwcm9wcyk7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjKTtcbiAgICAgIHJldHVybiByO1xuICAgIH0pIDogXCJcIik7XG4gIH07XG4gIHdyYXAucHJlbG9hZCA9ICgpID0+IHAgfHwgKChwID0gZm4oKSkudGhlbihtb2QgPT4gY29tcCA9ICgpID0+IG1vZC5kZWZhdWx0KSwgcCk7XG4gIHJldHVybiB3cmFwO1xufVxubGV0IGNvdW50ZXIgPSAwO1xuZnVuY3Rpb24gY3JlYXRlVW5pcXVlSWQoKSB7XG4gIGNvbnN0IGN0eCA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICByZXR1cm4gY3R4ID8gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKSA6IGBjbC0ke2NvdW50ZXIrK31gO1xufVxuXG5jb25zdCBuYXJyb3dlZEVycm9yID0gbmFtZSA9PiBgQXR0ZW1wdGluZyB0byBhY2Nlc3MgYSBzdGFsZSB2YWx1ZSBmcm9tIDwke25hbWV9PiB0aGF0IGNvdWxkIHBvc3NpYmx5IGJlIHVuZGVmaW5lZC4gVGhpcyBtYXkgb2NjdXIgYmVjYXVzZSB5b3UgYXJlIHJlYWRpbmcgdGhlIGFjY2Vzc29yIHJldHVybmVkIGZyb20gdGhlIGNvbXBvbmVudCBhdCBhIHRpbWUgd2hlcmUgaXQgaGFzIGFscmVhZHkgYmVlbiB1bm1vdW50ZWQuIFdlIHJlY29tbWVuZCBjbGVhbmluZyB1cCBhbnkgc3RhbGUgdGltZXJzIG9yIGFzeW5jLCBvciByZWFkaW5nIGZyb20gdGhlIGluaXRpYWwgY29uZGl0aW9uLmAgO1xuZnVuY3Rpb24gRm9yKHByb3BzKSB7XG4gIGNvbnN0IGZhbGxiYWNrID0gXCJmYWxsYmFja1wiIGluIHByb3BzICYmIHtcbiAgICBmYWxsYmFjazogKCkgPT4gcHJvcHMuZmFsbGJhY2tcbiAgfTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8obWFwQXJyYXkoKCkgPT4gcHJvcHMuZWFjaCwgcHJvcHMuY2hpbGRyZW4sIGZhbGxiYWNrIHx8IHVuZGVmaW5lZCksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9KSA7XG59XG5mdW5jdGlvbiBJbmRleChwcm9wcykge1xuICBjb25zdCBmYWxsYmFjayA9IFwiZmFsbGJhY2tcIiBpbiBwcm9wcyAmJiB7XG4gICAgZmFsbGJhY2s6ICgpID0+IHByb3BzLmZhbGxiYWNrXG4gIH07XG4gIHJldHVybiBjcmVhdGVNZW1vKGluZGV4QXJyYXkoKCkgPT4gcHJvcHMuZWFjaCwgcHJvcHMuY2hpbGRyZW4sIGZhbGxiYWNrIHx8IHVuZGVmaW5lZCksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9KSA7XG59XG5mdW5jdGlvbiBTaG93KHByb3BzKSB7XG4gIGNvbnN0IGtleWVkID0gcHJvcHMua2V5ZWQ7XG4gIGNvbnN0IGNvbmRpdGlvblZhbHVlID0gY3JlYXRlTWVtbygoKSA9PiBwcm9wcy53aGVuLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImNvbmRpdGlvbiB2YWx1ZVwiXG4gIH0gKTtcbiAgY29uc3QgY29uZGl0aW9uID0ga2V5ZWQgPyBjb25kaXRpb25WYWx1ZSA6IGNyZWF0ZU1lbW8oY29uZGl0aW9uVmFsdWUsIHVuZGVmaW5lZCwge1xuICAgIGVxdWFsczogKGEsIGIpID0+ICFhID09PSAhYixcbiAgICBuYW1lOiBcImNvbmRpdGlvblwiXG4gIH0gKTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGMgPSBjb25kaXRpb24oKTtcbiAgICBpZiAoYykge1xuICAgICAgY29uc3QgY2hpbGQgPSBwcm9wcy5jaGlsZHJlbjtcbiAgICAgIGNvbnN0IGZuID0gdHlwZW9mIGNoaWxkID09PSBcImZ1bmN0aW9uXCIgJiYgY2hpbGQubGVuZ3RoID4gMDtcbiAgICAgIHJldHVybiBmbiA/IHVudHJhY2soKCkgPT4gY2hpbGQoa2V5ZWQgPyBjIDogKCkgPT4ge1xuICAgICAgICBpZiAoIXVudHJhY2soY29uZGl0aW9uKSkgdGhyb3cgbmFycm93ZWRFcnJvcihcIlNob3dcIik7XG4gICAgICAgIHJldHVybiBjb25kaXRpb25WYWx1ZSgpO1xuICAgICAgfSkpIDogY2hpbGQ7XG4gICAgfVxuICAgIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJ2YWx1ZVwiXG4gIH0gKTtcbn1cbmZ1bmN0aW9uIFN3aXRjaChwcm9wcykge1xuICBjb25zdCBjaHMgPSBjaGlsZHJlbigoKSA9PiBwcm9wcy5jaGlsZHJlbik7XG4gIGNvbnN0IHN3aXRjaEZ1bmMgPSBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBjaCA9IGNocygpO1xuICAgIGNvbnN0IG1wcyA9IEFycmF5LmlzQXJyYXkoY2gpID8gY2ggOiBbY2hdO1xuICAgIGxldCBmdW5jID0gKCkgPT4gdW5kZWZpbmVkO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbmRleCA9IGk7XG4gICAgICBjb25zdCBtcCA9IG1wc1tpXTtcbiAgICAgIGNvbnN0IHByZXZGdW5jID0gZnVuYztcbiAgICAgIGNvbnN0IGNvbmRpdGlvblZhbHVlID0gY3JlYXRlTWVtbygoKSA9PiBwcmV2RnVuYygpID8gdW5kZWZpbmVkIDogbXAud2hlbiwgdW5kZWZpbmVkLCB7XG4gICAgICAgIG5hbWU6IFwiY29uZGl0aW9uIHZhbHVlXCJcbiAgICAgIH0gKTtcbiAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IG1wLmtleWVkID8gY29uZGl0aW9uVmFsdWUgOiBjcmVhdGVNZW1vKGNvbmRpdGlvblZhbHVlLCB1bmRlZmluZWQsIHtcbiAgICAgICAgZXF1YWxzOiAoYSwgYikgPT4gIWEgPT09ICFiLFxuICAgICAgICBuYW1lOiBcImNvbmRpdGlvblwiXG4gICAgICB9ICk7XG4gICAgICBmdW5jID0gKCkgPT4gcHJldkZ1bmMoKSB8fCAoY29uZGl0aW9uKCkgPyBbaW5kZXgsIGNvbmRpdGlvblZhbHVlLCBtcF0gOiB1bmRlZmluZWQpO1xuICAgIH1cbiAgICByZXR1cm4gZnVuYztcbiAgfSk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBzZWwgPSBzd2l0Y2hGdW5jKCkoKTtcbiAgICBpZiAoIXNlbCkgcmV0dXJuIHByb3BzLmZhbGxiYWNrO1xuICAgIGNvbnN0IFtpbmRleCwgY29uZGl0aW9uVmFsdWUsIG1wXSA9IHNlbDtcbiAgICBjb25zdCBjaGlsZCA9IG1wLmNoaWxkcmVuO1xuICAgIGNvbnN0IGZuID0gdHlwZW9mIGNoaWxkID09PSBcImZ1bmN0aW9uXCIgJiYgY2hpbGQubGVuZ3RoID4gMDtcbiAgICByZXR1cm4gZm4gPyB1bnRyYWNrKCgpID0+IGNoaWxkKG1wLmtleWVkID8gY29uZGl0aW9uVmFsdWUoKSA6ICgpID0+IHtcbiAgICAgIGlmICh1bnRyYWNrKHN3aXRjaEZ1bmMpKCk/LlswXSAhPT0gaW5kZXgpIHRocm93IG5hcnJvd2VkRXJyb3IoXCJNYXRjaFwiKTtcbiAgICAgIHJldHVybiBjb25kaXRpb25WYWx1ZSgpO1xuICAgIH0pKSA6IGNoaWxkO1xuICB9LCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImV2YWwgY29uZGl0aW9uc1wiXG4gIH0gKTtcbn1cbmZ1bmN0aW9uIE1hdGNoKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcztcbn1cbmxldCBFcnJvcnM7XG5mdW5jdGlvbiByZXNldEVycm9yQm91bmRhcmllcygpIHtcbiAgRXJyb3JzICYmIFsuLi5FcnJvcnNdLmZvckVhY2goZm4gPT4gZm4oKSk7XG59XG5mdW5jdGlvbiBFcnJvckJvdW5kYXJ5KHByb3BzKSB7XG4gIGxldCBlcnI7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCAmJiBzaGFyZWRDb25maWcubG9hZCkgZXJyID0gc2hhcmVkQ29uZmlnLmxvYWQoc2hhcmVkQ29uZmlnLmdldENvbnRleHRJZCgpKTtcbiAgY29uc3QgW2Vycm9yZWQsIHNldEVycm9yZWRdID0gY3JlYXRlU2lnbmFsKGVyciwge1xuICAgIG5hbWU6IFwiZXJyb3JlZFwiXG4gIH0gKTtcbiAgRXJyb3JzIHx8IChFcnJvcnMgPSBuZXcgU2V0KCkpO1xuICBFcnJvcnMuYWRkKHNldEVycm9yZWQpO1xuICBvbkNsZWFudXAoKCkgPT4gRXJyb3JzLmRlbGV0ZShzZXRFcnJvcmVkKSk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBsZXQgZTtcbiAgICBpZiAoZSA9IGVycm9yZWQoKSkge1xuICAgICAgY29uc3QgZiA9IHByb3BzLmZhbGxiYWNrO1xuICAgICAgaWYgKCh0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiIHx8IGYubGVuZ3RoID09IDApKSBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgcmV0dXJuIHR5cGVvZiBmID09PSBcImZ1bmN0aW9uXCIgJiYgZi5sZW5ndGggPyB1bnRyYWNrKCgpID0+IGYoZSwgKCkgPT4gc2V0RXJyb3JlZCgpKSkgOiBmO1xuICAgIH1cbiAgICByZXR1cm4gY2F0Y2hFcnJvcigoKSA9PiBwcm9wcy5jaGlsZHJlbiwgc2V0RXJyb3JlZCk7XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9ICk7XG59XG5cbmNvbnN0IHN1c3BlbnNlTGlzdEVxdWFscyA9IChhLCBiKSA9PiBhLnNob3dDb250ZW50ID09PSBiLnNob3dDb250ZW50ICYmIGEuc2hvd0ZhbGxiYWNrID09PSBiLnNob3dGYWxsYmFjaztcbmNvbnN0IFN1c3BlbnNlTGlzdENvbnRleHQgPSAvKiAjX19QVVJFX18gKi9jcmVhdGVDb250ZXh0KCk7XG5mdW5jdGlvbiBTdXNwZW5zZUxpc3QocHJvcHMpIHtcbiAgbGV0IFt3cmFwcGVyLCBzZXRXcmFwcGVyXSA9IGNyZWF0ZVNpZ25hbCgoKSA9PiAoe1xuICAgICAgaW5GYWxsYmFjazogZmFsc2VcbiAgICB9KSksXG4gICAgc2hvdztcbiAgY29uc3QgbGlzdENvbnRleHQgPSB1c2VDb250ZXh0KFN1c3BlbnNlTGlzdENvbnRleHQpO1xuICBjb25zdCBbcmVnaXN0cnksIHNldFJlZ2lzdHJ5XSA9IGNyZWF0ZVNpZ25hbChbXSk7XG4gIGlmIChsaXN0Q29udGV4dCkge1xuICAgIHNob3cgPSBsaXN0Q29udGV4dC5yZWdpc3RlcihjcmVhdGVNZW1vKCgpID0+IHdyYXBwZXIoKSgpLmluRmFsbGJhY2spKTtcbiAgfVxuICBjb25zdCByZXNvbHZlZCA9IGNyZWF0ZU1lbW8ocHJldiA9PiB7XG4gICAgY29uc3QgcmV2ZWFsID0gcHJvcHMucmV2ZWFsT3JkZXIsXG4gICAgICB0YWlsID0gcHJvcHMudGFpbCxcbiAgICAgIHtcbiAgICAgICAgc2hvd0NvbnRlbnQgPSB0cnVlLFxuICAgICAgICBzaG93RmFsbGJhY2sgPSB0cnVlXG4gICAgICB9ID0gc2hvdyA/IHNob3coKSA6IHt9LFxuICAgICAgcmVnID0gcmVnaXN0cnkoKSxcbiAgICAgIHJldmVyc2UgPSByZXZlYWwgPT09IFwiYmFja3dhcmRzXCI7XG4gICAgaWYgKHJldmVhbCA9PT0gXCJ0b2dldGhlclwiKSB7XG4gICAgICBjb25zdCBhbGwgPSByZWcuZXZlcnkoaW5GYWxsYmFjayA9PiAhaW5GYWxsYmFjaygpKTtcbiAgICAgIGNvbnN0IHJlcyA9IHJlZy5tYXAoKCkgPT4gKHtcbiAgICAgICAgc2hvd0NvbnRlbnQ6IGFsbCAmJiBzaG93Q29udGVudCxcbiAgICAgICAgc2hvd0ZhbGxiYWNrXG4gICAgICB9KSk7XG4gICAgICByZXMuaW5GYWxsYmFjayA9ICFhbGw7XG4gICAgICByZXR1cm4gcmVzO1xuICAgIH1cbiAgICBsZXQgc3RvcCA9IGZhbHNlO1xuICAgIGxldCBpbkZhbGxiYWNrID0gcHJldi5pbkZhbGxiYWNrO1xuICAgIGNvbnN0IHJlcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSByZWcubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGNvbnN0IG4gPSByZXZlcnNlID8gbGVuIC0gaSAtIDEgOiBpLFxuICAgICAgICBzID0gcmVnW25dKCk7XG4gICAgICBpZiAoIXN0b3AgJiYgIXMpIHtcbiAgICAgICAgcmVzW25dID0ge1xuICAgICAgICAgIHNob3dDb250ZW50LFxuICAgICAgICAgIHNob3dGYWxsYmFja1xuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV4dCA9ICFzdG9wO1xuICAgICAgICBpZiAobmV4dCkgaW5GYWxsYmFjayA9IHRydWU7XG4gICAgICAgIHJlc1tuXSA9IHtcbiAgICAgICAgICBzaG93Q29udGVudDogbmV4dCxcbiAgICAgICAgICBzaG93RmFsbGJhY2s6ICF0YWlsIHx8IG5leHQgJiYgdGFpbCA9PT0gXCJjb2xsYXBzZWRcIiA/IHNob3dGYWxsYmFjayA6IGZhbHNlXG4gICAgICAgIH07XG4gICAgICAgIHN0b3AgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXN0b3ApIGluRmFsbGJhY2sgPSBmYWxzZTtcbiAgICByZXMuaW5GYWxsYmFjayA9IGluRmFsbGJhY2s7XG4gICAgcmV0dXJuIHJlcztcbiAgfSwge1xuICAgIGluRmFsbGJhY2s6IGZhbHNlXG4gIH0pO1xuICBzZXRXcmFwcGVyKCgpID0+IHJlc29sdmVkKTtcbiAgcmV0dXJuIGNyZWF0ZUNvbXBvbmVudChTdXNwZW5zZUxpc3RDb250ZXh0LlByb3ZpZGVyLCB7XG4gICAgdmFsdWU6IHtcbiAgICAgIHJlZ2lzdGVyOiBpbkZhbGxiYWNrID0+IHtcbiAgICAgICAgbGV0IGluZGV4O1xuICAgICAgICBzZXRSZWdpc3RyeShyZWdpc3RyeSA9PiB7XG4gICAgICAgICAgaW5kZXggPSByZWdpc3RyeS5sZW5ndGg7XG4gICAgICAgICAgcmV0dXJuIFsuLi5yZWdpc3RyeSwgaW5GYWxsYmFja107XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiByZXNvbHZlZCgpW2luZGV4XSwgdW5kZWZpbmVkLCB7XG4gICAgICAgICAgZXF1YWxzOiBzdXNwZW5zZUxpc3RFcXVhbHNcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgICBnZXQgY2hpbGRyZW4oKSB7XG4gICAgICByZXR1cm4gcHJvcHMuY2hpbGRyZW47XG4gICAgfVxuICB9KTtcbn1cbmZ1bmN0aW9uIFN1c3BlbnNlKHByb3BzKSB7XG4gIGxldCBjb3VudGVyID0gMCxcbiAgICBzaG93LFxuICAgIGN0eCxcbiAgICBwLFxuICAgIGZsaWNrZXIsXG4gICAgZXJyb3I7XG4gIGNvbnN0IFtpbkZhbGxiYWNrLCBzZXRGYWxsYmFja10gPSBjcmVhdGVTaWduYWwoZmFsc2UpLFxuICAgIFN1c3BlbnNlQ29udGV4dCA9IGdldFN1c3BlbnNlQ29udGV4dCgpLFxuICAgIHN0b3JlID0ge1xuICAgICAgaW5jcmVtZW50OiAoKSA9PiB7XG4gICAgICAgIGlmICgrK2NvdW50ZXIgPT09IDEpIHNldEZhbGxiYWNrKHRydWUpO1xuICAgICAgfSxcbiAgICAgIGRlY3JlbWVudDogKCkgPT4ge1xuICAgICAgICBpZiAoLS1jb3VudGVyID09PSAwKSBzZXRGYWxsYmFjayhmYWxzZSk7XG4gICAgICB9LFxuICAgICAgaW5GYWxsYmFjayxcbiAgICAgIGVmZmVjdHM6IFtdLFxuICAgICAgcmVzb2x2ZWQ6IGZhbHNlXG4gICAgfSxcbiAgICBvd25lciA9IGdldE93bmVyKCk7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCAmJiBzaGFyZWRDb25maWcubG9hZCkge1xuICAgIGNvbnN0IGtleSA9IHNoYXJlZENvbmZpZy5nZXRDb250ZXh0SWQoKTtcbiAgICBsZXQgcmVmID0gc2hhcmVkQ29uZmlnLmxvYWQoa2V5KTtcbiAgICBpZiAocmVmKSB7XG4gICAgICBpZiAodHlwZW9mIHJlZiAhPT0gXCJvYmplY3RcIiB8fCByZWYucyAhPT0gMSkgcCA9IHJlZjtlbHNlIHNoYXJlZENvbmZpZy5nYXRoZXIoa2V5KTtcbiAgICB9XG4gICAgaWYgKHAgJiYgcCAhPT0gXCIkJGZcIikge1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICAgIGVxdWFsczogZmFsc2VcbiAgICAgIH0pO1xuICAgICAgZmxpY2tlciA9IHM7XG4gICAgICBwLnRoZW4oKCkgPT4ge1xuICAgICAgICBpZiAoc2hhcmVkQ29uZmlnLmRvbmUpIHJldHVybiBzZXQoKTtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmdhdGhlcihrZXkpO1xuICAgICAgICBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgICBzZXQoKTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgIH0sIGVyciA9PiB7XG4gICAgICAgIGVycm9yID0gZXJyO1xuICAgICAgICBzZXQoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBjb25zdCBsaXN0Q29udGV4dCA9IHVzZUNvbnRleHQoU3VzcGVuc2VMaXN0Q29udGV4dCk7XG4gIGlmIChsaXN0Q29udGV4dCkgc2hvdyA9IGxpc3RDb250ZXh0LnJlZ2lzdGVyKHN0b3JlLmluRmFsbGJhY2spO1xuICBsZXQgZGlzcG9zZTtcbiAgb25DbGVhbnVwKCgpID0+IGRpc3Bvc2UgJiYgZGlzcG9zZSgpKTtcbiAgcmV0dXJuIGNyZWF0ZUNvbXBvbmVudChTdXNwZW5zZUNvbnRleHQuUHJvdmlkZXIsIHtcbiAgICB2YWx1ZTogc3RvcmUsXG4gICAgZ2V0IGNoaWxkcmVuKCkge1xuICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHRocm93IGVycm9yO1xuICAgICAgICBjdHggPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgICAgaWYgKGZsaWNrZXIpIHtcbiAgICAgICAgICBmbGlja2VyKCk7XG4gICAgICAgICAgcmV0dXJuIGZsaWNrZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN0eCAmJiBwID09PSBcIiQkZlwiKSBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICAgICAgICBjb25zdCByZW5kZXJlZCA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICAgICAgICByZXR1cm4gY3JlYXRlTWVtbyhwcmV2ID0+IHtcbiAgICAgICAgICBjb25zdCBpbkZhbGxiYWNrID0gc3RvcmUuaW5GYWxsYmFjaygpLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzaG93Q29udGVudCA9IHRydWUsXG4gICAgICAgICAgICAgIHNob3dGYWxsYmFjayA9IHRydWVcbiAgICAgICAgICAgIH0gPSBzaG93ID8gc2hvdygpIDoge307XG4gICAgICAgICAgaWYgKCghaW5GYWxsYmFjayB8fCBwICYmIHAgIT09IFwiJCRmXCIpICYmIHNob3dDb250ZW50KSB7XG4gICAgICAgICAgICBzdG9yZS5yZXNvbHZlZCA9IHRydWU7XG4gICAgICAgICAgICBkaXNwb3NlICYmIGRpc3Bvc2UoKTtcbiAgICAgICAgICAgIGRpc3Bvc2UgPSBjdHggPSBwID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgcmVzdW1lRWZmZWN0cyhzdG9yZS5lZmZlY3RzKTtcbiAgICAgICAgICAgIHJldHVybiByZW5kZXJlZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXNob3dGYWxsYmFjaykgcmV0dXJuO1xuICAgICAgICAgIGlmIChkaXNwb3NlKSByZXR1cm4gcHJldjtcbiAgICAgICAgICByZXR1cm4gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgICAgICBkaXNwb3NlID0gZGlzcG9zZXI7XG4gICAgICAgICAgICBpZiAoY3R4KSB7XG4gICAgICAgICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KHtcbiAgICAgICAgICAgICAgICBpZDogY3R4LmlkICsgXCJGXCIsXG4gICAgICAgICAgICAgICAgY291bnQ6IDBcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGN0eCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgICAgICAgICB9LCBvd25lcik7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcbn1cblxuY29uc3QgREVWID0ge1xuICBob29rczogRGV2SG9va3MsXG4gIHdyaXRlU2lnbmFsLFxuICByZWdpc3RlckdyYXBoXG59IDtcbmlmIChnbG9iYWxUaGlzKSB7XG4gIGlmICghZ2xvYmFsVGhpcy5Tb2xpZCQkKSBnbG9iYWxUaGlzLlNvbGlkJCQgPSB0cnVlO2Vsc2UgY29uc29sZS53YXJuKFwiWW91IGFwcGVhciB0byBoYXZlIG11bHRpcGxlIGluc3RhbmNlcyBvZiBTb2xpZC4gVGhpcyBjYW4gbGVhZCB0byB1bmV4cGVjdGVkIGJlaGF2aW9yLlwiKTtcbn1cblxuZXhwb3J0IHsgJERFVkNPTVAsICRQUk9YWSwgJFRSQUNLLCBERVYsIEVycm9yQm91bmRhcnksIEZvciwgSW5kZXgsIE1hdGNoLCBTaG93LCBTdXNwZW5zZSwgU3VzcGVuc2VMaXN0LCBTd2l0Y2gsIGJhdGNoLCBjYW5jZWxDYWxsYmFjaywgY2F0Y2hFcnJvciwgY2hpbGRyZW4sIGNyZWF0ZUNvbXBvbmVudCwgY3JlYXRlQ29tcHV0ZWQsIGNyZWF0ZUNvbnRleHQsIGNyZWF0ZURlZmVycmVkLCBjcmVhdGVFZmZlY3QsIGNyZWF0ZU1lbW8sIGNyZWF0ZVJlYWN0aW9uLCBjcmVhdGVSZW5kZXJFZmZlY3QsIGNyZWF0ZVJlc291cmNlLCBjcmVhdGVSb290LCBjcmVhdGVTZWxlY3RvciwgY3JlYXRlU2lnbmFsLCBjcmVhdGVVbmlxdWVJZCwgZW5hYmxlRXh0ZXJuYWxTb3VyY2UsIGVuYWJsZUh5ZHJhdGlvbiwgZW5hYmxlU2NoZWR1bGluZywgZXF1YWxGbiwgZnJvbSwgZ2V0TGlzdGVuZXIsIGdldE93bmVyLCBpbmRleEFycmF5LCBsYXp5LCBtYXBBcnJheSwgbWVyZ2VQcm9wcywgb2JzZXJ2YWJsZSwgb24sIG9uQ2xlYW51cCwgb25FcnJvciwgb25Nb3VudCwgcmVxdWVzdENhbGxiYWNrLCByZXNldEVycm9yQm91bmRhcmllcywgcnVuV2l0aE93bmVyLCBzaGFyZWRDb25maWcsIHNwbGl0UHJvcHMsIHN0YXJ0VHJhbnNpdGlvbiwgdW50cmFjaywgdXNlQ29udGV4dCwgdXNlVHJhbnNpdGlvbiB9O1xuIiwiaW1wb3J0IHsgY3JlYXRlTWVtbywgY3JlYXRlUm9vdCwgY3JlYXRlUmVuZGVyRWZmZWN0LCB1bnRyYWNrLCBzaGFyZWRDb25maWcsIGVuYWJsZUh5ZHJhdGlvbiwgZ2V0T3duZXIsIGNyZWF0ZUVmZmVjdCwgcnVuV2l0aE93bmVyLCBjcmVhdGVTaWduYWwsIG9uQ2xlYW51cCwgJERFVkNPTVAsIHNwbGl0UHJvcHMgfSBmcm9tICdzb2xpZC1qcyc7XG5leHBvcnQgeyBFcnJvckJvdW5kYXJ5LCBGb3IsIEluZGV4LCBNYXRjaCwgU2hvdywgU3VzcGVuc2UsIFN1c3BlbnNlTGlzdCwgU3dpdGNoLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZVJlbmRlckVmZmVjdCBhcyBlZmZlY3QsIGdldE93bmVyLCBtZXJnZVByb3BzLCB1bnRyYWNrIH0gZnJvbSAnc29saWQtanMnO1xuXG5jb25zdCBib29sZWFucyA9IFtcImFsbG93ZnVsbHNjcmVlblwiLCBcImFzeW5jXCIsIFwiYXV0b2ZvY3VzXCIsIFwiYXV0b3BsYXlcIiwgXCJjaGVja2VkXCIsIFwiY29udHJvbHNcIiwgXCJkZWZhdWx0XCIsIFwiZGlzYWJsZWRcIiwgXCJmb3Jtbm92YWxpZGF0ZVwiLCBcImhpZGRlblwiLCBcImluZGV0ZXJtaW5hdGVcIiwgXCJpbmVydFwiLCBcImlzbWFwXCIsIFwibG9vcFwiLCBcIm11bHRpcGxlXCIsIFwibXV0ZWRcIiwgXCJub21vZHVsZVwiLCBcIm5vdmFsaWRhdGVcIiwgXCJvcGVuXCIsIFwicGxheXNpbmxpbmVcIiwgXCJyZWFkb25seVwiLCBcInJlcXVpcmVkXCIsIFwicmV2ZXJzZWRcIiwgXCJzZWFtbGVzc1wiLCBcInNlbGVjdGVkXCJdO1xuY29uc3QgUHJvcGVydGllcyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImNsYXNzTmFtZVwiLCBcInZhbHVlXCIsIFwicmVhZE9ubHlcIiwgXCJub1ZhbGlkYXRlXCIsIFwiZm9ybU5vVmFsaWRhdGVcIiwgXCJpc01hcFwiLCBcIm5vTW9kdWxlXCIsIFwicGxheXNJbmxpbmVcIiwgLi4uYm9vbGVhbnNdKTtcbmNvbnN0IENoaWxkUHJvcGVydGllcyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImlubmVySFRNTFwiLCBcInRleHRDb250ZW50XCIsIFwiaW5uZXJUZXh0XCIsIFwiY2hpbGRyZW5cIl0pO1xuY29uc3QgQWxpYXNlcyA9IC8qI19fUFVSRV9fKi9PYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUobnVsbCksIHtcbiAgY2xhc3NOYW1lOiBcImNsYXNzXCIsXG4gIGh0bWxGb3I6IFwiZm9yXCJcbn0pO1xuY29uc3QgUHJvcEFsaWFzZXMgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmFzc2lnbihPYmplY3QuY3JlYXRlKG51bGwpLCB7XG4gIGNsYXNzOiBcImNsYXNzTmFtZVwiLFxuICBub3ZhbGlkYXRlOiB7XG4gICAgJDogXCJub1ZhbGlkYXRlXCIsXG4gICAgRk9STTogMVxuICB9LFxuICBmb3Jtbm92YWxpZGF0ZToge1xuICAgICQ6IFwiZm9ybU5vVmFsaWRhdGVcIixcbiAgICBCVVRUT046IDEsXG4gICAgSU5QVVQ6IDFcbiAgfSxcbiAgaXNtYXA6IHtcbiAgICAkOiBcImlzTWFwXCIsXG4gICAgSU1HOiAxXG4gIH0sXG4gIG5vbW9kdWxlOiB7XG4gICAgJDogXCJub01vZHVsZVwiLFxuICAgIFNDUklQVDogMVxuICB9LFxuICBwbGF5c2lubGluZToge1xuICAgICQ6IFwicGxheXNJbmxpbmVcIixcbiAgICBWSURFTzogMVxuICB9LFxuICByZWFkb25seToge1xuICAgICQ6IFwicmVhZE9ubHlcIixcbiAgICBJTlBVVDogMSxcbiAgICBURVhUQVJFQTogMVxuICB9XG59KTtcbmZ1bmN0aW9uIGdldFByb3BBbGlhcyhwcm9wLCB0YWdOYW1lKSB7XG4gIGNvbnN0IGEgPSBQcm9wQWxpYXNlc1twcm9wXTtcbiAgcmV0dXJuIHR5cGVvZiBhID09PSBcIm9iamVjdFwiID8gYVt0YWdOYW1lXSA/IGFbXCIkXCJdIDogdW5kZWZpbmVkIDogYTtcbn1cbmNvbnN0IERlbGVnYXRlZEV2ZW50cyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImJlZm9yZWlucHV0XCIsIFwiY2xpY2tcIiwgXCJkYmxjbGlja1wiLCBcImNvbnRleHRtZW51XCIsIFwiZm9jdXNpblwiLCBcImZvY3Vzb3V0XCIsIFwiaW5wdXRcIiwgXCJrZXlkb3duXCIsIFwia2V5dXBcIiwgXCJtb3VzZWRvd25cIiwgXCJtb3VzZW1vdmVcIiwgXCJtb3VzZW91dFwiLCBcIm1vdXNlb3ZlclwiLCBcIm1vdXNldXBcIiwgXCJwb2ludGVyZG93blwiLCBcInBvaW50ZXJtb3ZlXCIsIFwicG9pbnRlcm91dFwiLCBcInBvaW50ZXJvdmVyXCIsIFwicG9pbnRlcnVwXCIsIFwidG91Y2hlbmRcIiwgXCJ0b3VjaG1vdmVcIiwgXCJ0b3VjaHN0YXJ0XCJdKTtcbmNvbnN0IFNWR0VsZW1lbnRzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1xuXCJhbHRHbHlwaFwiLCBcImFsdEdseXBoRGVmXCIsIFwiYWx0R2x5cGhJdGVtXCIsIFwiYW5pbWF0ZVwiLCBcImFuaW1hdGVDb2xvclwiLCBcImFuaW1hdGVNb3Rpb25cIiwgXCJhbmltYXRlVHJhbnNmb3JtXCIsIFwiY2lyY2xlXCIsIFwiY2xpcFBhdGhcIiwgXCJjb2xvci1wcm9maWxlXCIsIFwiY3Vyc29yXCIsIFwiZGVmc1wiLCBcImRlc2NcIiwgXCJlbGxpcHNlXCIsIFwiZmVCbGVuZFwiLCBcImZlQ29sb3JNYXRyaXhcIiwgXCJmZUNvbXBvbmVudFRyYW5zZmVyXCIsIFwiZmVDb21wb3NpdGVcIiwgXCJmZUNvbnZvbHZlTWF0cml4XCIsIFwiZmVEaWZmdXNlTGlnaHRpbmdcIiwgXCJmZURpc3BsYWNlbWVudE1hcFwiLCBcImZlRGlzdGFudExpZ2h0XCIsIFwiZmVEcm9wU2hhZG93XCIsIFwiZmVGbG9vZFwiLCBcImZlRnVuY0FcIiwgXCJmZUZ1bmNCXCIsIFwiZmVGdW5jR1wiLCBcImZlRnVuY1JcIiwgXCJmZUdhdXNzaWFuQmx1clwiLCBcImZlSW1hZ2VcIiwgXCJmZU1lcmdlXCIsIFwiZmVNZXJnZU5vZGVcIiwgXCJmZU1vcnBob2xvZ3lcIiwgXCJmZU9mZnNldFwiLCBcImZlUG9pbnRMaWdodFwiLCBcImZlU3BlY3VsYXJMaWdodGluZ1wiLCBcImZlU3BvdExpZ2h0XCIsIFwiZmVUaWxlXCIsIFwiZmVUdXJidWxlbmNlXCIsIFwiZmlsdGVyXCIsIFwiZm9udFwiLCBcImZvbnQtZmFjZVwiLCBcImZvbnQtZmFjZS1mb3JtYXRcIiwgXCJmb250LWZhY2UtbmFtZVwiLCBcImZvbnQtZmFjZS1zcmNcIiwgXCJmb250LWZhY2UtdXJpXCIsIFwiZm9yZWlnbk9iamVjdFwiLCBcImdcIiwgXCJnbHlwaFwiLCBcImdseXBoUmVmXCIsIFwiaGtlcm5cIiwgXCJpbWFnZVwiLCBcImxpbmVcIiwgXCJsaW5lYXJHcmFkaWVudFwiLCBcIm1hcmtlclwiLCBcIm1hc2tcIiwgXCJtZXRhZGF0YVwiLCBcIm1pc3NpbmctZ2x5cGhcIiwgXCJtcGF0aFwiLCBcInBhdGhcIiwgXCJwYXR0ZXJuXCIsIFwicG9seWdvblwiLCBcInBvbHlsaW5lXCIsIFwicmFkaWFsR3JhZGllbnRcIiwgXCJyZWN0XCIsXG5cInNldFwiLCBcInN0b3BcIixcblwic3ZnXCIsIFwic3dpdGNoXCIsIFwic3ltYm9sXCIsIFwidGV4dFwiLCBcInRleHRQYXRoXCIsXG5cInRyZWZcIiwgXCJ0c3BhblwiLCBcInVzZVwiLCBcInZpZXdcIiwgXCJ2a2VyblwiXSk7XG5jb25zdCBTVkdOYW1lc3BhY2UgPSB7XG4gIHhsaW5rOiBcImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIixcbiAgeG1sOiBcImh0dHA6Ly93d3cudzMub3JnL1hNTC8xOTk4L25hbWVzcGFjZVwiXG59O1xuY29uc3QgRE9NRWxlbWVudHMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJodG1sXCIsIFwiYmFzZVwiLCBcImhlYWRcIiwgXCJsaW5rXCIsIFwibWV0YVwiLCBcInN0eWxlXCIsIFwidGl0bGVcIiwgXCJib2R5XCIsIFwiYWRkcmVzc1wiLCBcImFydGljbGVcIiwgXCJhc2lkZVwiLCBcImZvb3RlclwiLCBcImhlYWRlclwiLCBcIm1haW5cIiwgXCJuYXZcIiwgXCJzZWN0aW9uXCIsIFwiYm9keVwiLCBcImJsb2NrcXVvdGVcIiwgXCJkZFwiLCBcImRpdlwiLCBcImRsXCIsIFwiZHRcIiwgXCJmaWdjYXB0aW9uXCIsIFwiZmlndXJlXCIsIFwiaHJcIiwgXCJsaVwiLCBcIm9sXCIsIFwicFwiLCBcInByZVwiLCBcInVsXCIsIFwiYVwiLCBcImFiYnJcIiwgXCJiXCIsIFwiYmRpXCIsIFwiYmRvXCIsIFwiYnJcIiwgXCJjaXRlXCIsIFwiY29kZVwiLCBcImRhdGFcIiwgXCJkZm5cIiwgXCJlbVwiLCBcImlcIiwgXCJrYmRcIiwgXCJtYXJrXCIsIFwicVwiLCBcInJwXCIsIFwicnRcIiwgXCJydWJ5XCIsIFwic1wiLCBcInNhbXBcIiwgXCJzbWFsbFwiLCBcInNwYW5cIiwgXCJzdHJvbmdcIiwgXCJzdWJcIiwgXCJzdXBcIiwgXCJ0aW1lXCIsIFwidVwiLCBcInZhclwiLCBcIndiclwiLCBcImFyZWFcIiwgXCJhdWRpb1wiLCBcImltZ1wiLCBcIm1hcFwiLCBcInRyYWNrXCIsIFwidmlkZW9cIiwgXCJlbWJlZFwiLCBcImlmcmFtZVwiLCBcIm9iamVjdFwiLCBcInBhcmFtXCIsIFwicGljdHVyZVwiLCBcInBvcnRhbFwiLCBcInNvdXJjZVwiLCBcInN2Z1wiLCBcIm1hdGhcIiwgXCJjYW52YXNcIiwgXCJub3NjcmlwdFwiLCBcInNjcmlwdFwiLCBcImRlbFwiLCBcImluc1wiLCBcImNhcHRpb25cIiwgXCJjb2xcIiwgXCJjb2xncm91cFwiLCBcInRhYmxlXCIsIFwidGJvZHlcIiwgXCJ0ZFwiLCBcInRmb290XCIsIFwidGhcIiwgXCJ0aGVhZFwiLCBcInRyXCIsIFwiYnV0dG9uXCIsIFwiZGF0YWxpc3RcIiwgXCJmaWVsZHNldFwiLCBcImZvcm1cIiwgXCJpbnB1dFwiLCBcImxhYmVsXCIsIFwibGVnZW5kXCIsIFwibWV0ZXJcIiwgXCJvcHRncm91cFwiLCBcIm9wdGlvblwiLCBcIm91dHB1dFwiLCBcInByb2dyZXNzXCIsIFwic2VsZWN0XCIsIFwidGV4dGFyZWFcIiwgXCJkZXRhaWxzXCIsIFwiZGlhbG9nXCIsIFwibWVudVwiLCBcInN1bW1hcnlcIiwgXCJkZXRhaWxzXCIsIFwic2xvdFwiLCBcInRlbXBsYXRlXCIsIFwiYWNyb255bVwiLCBcImFwcGxldFwiLCBcImJhc2Vmb250XCIsIFwiYmdzb3VuZFwiLCBcImJpZ1wiLCBcImJsaW5rXCIsIFwiY2VudGVyXCIsIFwiY29udGVudFwiLCBcImRpclwiLCBcImZvbnRcIiwgXCJmcmFtZVwiLCBcImZyYW1lc2V0XCIsIFwiaGdyb3VwXCIsIFwiaW1hZ2VcIiwgXCJrZXlnZW5cIiwgXCJtYXJxdWVlXCIsIFwibWVudWl0ZW1cIiwgXCJub2JyXCIsIFwibm9lbWJlZFwiLCBcIm5vZnJhbWVzXCIsIFwicGxhaW50ZXh0XCIsIFwicmJcIiwgXCJydGNcIiwgXCJzaGFkb3dcIiwgXCJzcGFjZXJcIiwgXCJzdHJpa2VcIiwgXCJ0dFwiLCBcInhtcFwiLCBcImFcIiwgXCJhYmJyXCIsIFwiYWNyb255bVwiLCBcImFkZHJlc3NcIiwgXCJhcHBsZXRcIiwgXCJhcmVhXCIsIFwiYXJ0aWNsZVwiLCBcImFzaWRlXCIsIFwiYXVkaW9cIiwgXCJiXCIsIFwiYmFzZVwiLCBcImJhc2Vmb250XCIsIFwiYmRpXCIsIFwiYmRvXCIsIFwiYmdzb3VuZFwiLCBcImJpZ1wiLCBcImJsaW5rXCIsIFwiYmxvY2txdW90ZVwiLCBcImJvZHlcIiwgXCJiclwiLCBcImJ1dHRvblwiLCBcImNhbnZhc1wiLCBcImNhcHRpb25cIiwgXCJjZW50ZXJcIiwgXCJjaXRlXCIsIFwiY29kZVwiLCBcImNvbFwiLCBcImNvbGdyb3VwXCIsIFwiY29udGVudFwiLCBcImRhdGFcIiwgXCJkYXRhbGlzdFwiLCBcImRkXCIsIFwiZGVsXCIsIFwiZGV0YWlsc1wiLCBcImRmblwiLCBcImRpYWxvZ1wiLCBcImRpclwiLCBcImRpdlwiLCBcImRsXCIsIFwiZHRcIiwgXCJlbVwiLCBcImVtYmVkXCIsIFwiZmllbGRzZXRcIiwgXCJmaWdjYXB0aW9uXCIsIFwiZmlndXJlXCIsIFwiZm9udFwiLCBcImZvb3RlclwiLCBcImZvcm1cIiwgXCJmcmFtZVwiLCBcImZyYW1lc2V0XCIsIFwiaGVhZFwiLCBcImhlYWRlclwiLCBcImhncm91cFwiLCBcImhyXCIsIFwiaHRtbFwiLCBcImlcIiwgXCJpZnJhbWVcIiwgXCJpbWFnZVwiLCBcImltZ1wiLCBcImlucHV0XCIsIFwiaW5zXCIsIFwia2JkXCIsIFwia2V5Z2VuXCIsIFwibGFiZWxcIiwgXCJsZWdlbmRcIiwgXCJsaVwiLCBcImxpbmtcIiwgXCJtYWluXCIsIFwibWFwXCIsIFwibWFya1wiLCBcIm1hcnF1ZWVcIiwgXCJtZW51XCIsIFwibWVudWl0ZW1cIiwgXCJtZXRhXCIsIFwibWV0ZXJcIiwgXCJuYXZcIiwgXCJub2JyXCIsIFwibm9lbWJlZFwiLCBcIm5vZnJhbWVzXCIsIFwibm9zY3JpcHRcIiwgXCJvYmplY3RcIiwgXCJvbFwiLCBcIm9wdGdyb3VwXCIsIFwib3B0aW9uXCIsIFwib3V0cHV0XCIsIFwicFwiLCBcInBhcmFtXCIsIFwicGljdHVyZVwiLCBcInBsYWludGV4dFwiLCBcInBvcnRhbFwiLCBcInByZVwiLCBcInByb2dyZXNzXCIsIFwicVwiLCBcInJiXCIsIFwicnBcIiwgXCJydFwiLCBcInJ0Y1wiLCBcInJ1YnlcIiwgXCJzXCIsIFwic2FtcFwiLCBcInNjcmlwdFwiLCBcInNlY3Rpb25cIiwgXCJzZWxlY3RcIiwgXCJzaGFkb3dcIiwgXCJzbG90XCIsIFwic21hbGxcIiwgXCJzb3VyY2VcIiwgXCJzcGFjZXJcIiwgXCJzcGFuXCIsIFwic3RyaWtlXCIsIFwic3Ryb25nXCIsIFwic3R5bGVcIiwgXCJzdWJcIiwgXCJzdW1tYXJ5XCIsIFwic3VwXCIsIFwidGFibGVcIiwgXCJ0Ym9keVwiLCBcInRkXCIsIFwidGVtcGxhdGVcIiwgXCJ0ZXh0YXJlYVwiLCBcInRmb290XCIsIFwidGhcIiwgXCJ0aGVhZFwiLCBcInRpbWVcIiwgXCJ0aXRsZVwiLCBcInRyXCIsIFwidHJhY2tcIiwgXCJ0dFwiLCBcInVcIiwgXCJ1bFwiLCBcInZhclwiLCBcInZpZGVvXCIsIFwid2JyXCIsIFwieG1wXCIsIFwiaW5wdXRcIiwgXCJoMVwiLCBcImgyXCIsIFwiaDNcIiwgXCJoNFwiLCBcImg1XCIsIFwiaDZcIl0pO1xuXG5jb25zdCBtZW1vID0gZm4gPT4gY3JlYXRlTWVtbygoKSA9PiBmbigpKTtcblxuZnVuY3Rpb24gcmVjb25jaWxlQXJyYXlzKHBhcmVudE5vZGUsIGEsIGIpIHtcbiAgbGV0IGJMZW5ndGggPSBiLmxlbmd0aCxcbiAgICBhRW5kID0gYS5sZW5ndGgsXG4gICAgYkVuZCA9IGJMZW5ndGgsXG4gICAgYVN0YXJ0ID0gMCxcbiAgICBiU3RhcnQgPSAwLFxuICAgIGFmdGVyID0gYVthRW5kIC0gMV0ubmV4dFNpYmxpbmcsXG4gICAgbWFwID0gbnVsbDtcbiAgd2hpbGUgKGFTdGFydCA8IGFFbmQgfHwgYlN0YXJ0IDwgYkVuZCkge1xuICAgIGlmIChhW2FTdGFydF0gPT09IGJbYlN0YXJ0XSkge1xuICAgICAgYVN0YXJ0Kys7XG4gICAgICBiU3RhcnQrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICB3aGlsZSAoYVthRW5kIC0gMV0gPT09IGJbYkVuZCAtIDFdKSB7XG4gICAgICBhRW5kLS07XG4gICAgICBiRW5kLS07XG4gICAgfVxuICAgIGlmIChhRW5kID09PSBhU3RhcnQpIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBiRW5kIDwgYkxlbmd0aCA/IGJTdGFydCA/IGJbYlN0YXJ0IC0gMV0ubmV4dFNpYmxpbmcgOiBiW2JFbmQgLSBiU3RhcnRdIDogYWZ0ZXI7XG4gICAgICB3aGlsZSAoYlN0YXJ0IDwgYkVuZCkgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAoYkVuZCA9PT0gYlN0YXJ0KSB7XG4gICAgICB3aGlsZSAoYVN0YXJ0IDwgYUVuZCkge1xuICAgICAgICBpZiAoIW1hcCB8fCAhbWFwLmhhcyhhW2FTdGFydF0pKSBhW2FTdGFydF0ucmVtb3ZlKCk7XG4gICAgICAgIGFTdGFydCsrO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYVthU3RhcnRdID09PSBiW2JFbmQgLSAxXSAmJiBiW2JTdGFydF0gPT09IGFbYUVuZCAtIDFdKSB7XG4gICAgICBjb25zdCBub2RlID0gYVstLWFFbmRdLm5leHRTaWJsaW5nO1xuICAgICAgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIGFbYVN0YXJ0KytdLm5leHRTaWJsaW5nKTtcbiAgICAgIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbLS1iRW5kXSwgbm9kZSk7XG4gICAgICBhW2FFbmRdID0gYltiRW5kXTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFtYXApIHtcbiAgICAgICAgbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICBsZXQgaSA9IGJTdGFydDtcbiAgICAgICAgd2hpbGUgKGkgPCBiRW5kKSBtYXAuc2V0KGJbaV0sIGkrKyk7XG4gICAgICB9XG4gICAgICBjb25zdCBpbmRleCA9IG1hcC5nZXQoYVthU3RhcnRdKTtcbiAgICAgIGlmIChpbmRleCAhPSBudWxsKSB7XG4gICAgICAgIGlmIChiU3RhcnQgPCBpbmRleCAmJiBpbmRleCA8IGJFbmQpIHtcbiAgICAgICAgICBsZXQgaSA9IGFTdGFydCxcbiAgICAgICAgICAgIHNlcXVlbmNlID0gMSxcbiAgICAgICAgICAgIHQ7XG4gICAgICAgICAgd2hpbGUgKCsraSA8IGFFbmQgJiYgaSA8IGJFbmQpIHtcbiAgICAgICAgICAgIGlmICgodCA9IG1hcC5nZXQoYVtpXSkpID09IG51bGwgfHwgdCAhPT0gaW5kZXggKyBzZXF1ZW5jZSkgYnJlYWs7XG4gICAgICAgICAgICBzZXF1ZW5jZSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc2VxdWVuY2UgPiBpbmRleCAtIGJTdGFydCkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGFbYVN0YXJ0XTtcbiAgICAgICAgICAgIHdoaWxlIChiU3RhcnQgPCBpbmRleCkgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIG5vZGUpO1xuICAgICAgICAgIH0gZWxzZSBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChiW2JTdGFydCsrXSwgYVthU3RhcnQrK10pO1xuICAgICAgICB9IGVsc2UgYVN0YXJ0Kys7XG4gICAgICB9IGVsc2UgYVthU3RhcnQrK10ucmVtb3ZlKCk7XG4gICAgfVxuICB9XG59XG5cbmNvbnN0ICQkRVZFTlRTID0gXCJfJERYX0RFTEVHQVRFXCI7XG5mdW5jdGlvbiByZW5kZXIoY29kZSwgZWxlbWVudCwgaW5pdCwgb3B0aW9ucyA9IHt9KSB7XG4gIGlmICghZWxlbWVudCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBgZWxlbWVudGAgcGFzc2VkIHRvIGByZW5kZXIoLi4uLCBlbGVtZW50KWAgZG9lc24ndCBleGlzdC4gTWFrZSBzdXJlIGBlbGVtZW50YCBleGlzdHMgaW4gdGhlIGRvY3VtZW50LlwiKTtcbiAgfVxuICBsZXQgZGlzcG9zZXI7XG4gIGNyZWF0ZVJvb3QoZGlzcG9zZSA9PiB7XG4gICAgZGlzcG9zZXIgPSBkaXNwb3NlO1xuICAgIGVsZW1lbnQgPT09IGRvY3VtZW50ID8gY29kZSgpIDogaW5zZXJ0KGVsZW1lbnQsIGNvZGUoKSwgZWxlbWVudC5maXJzdENoaWxkID8gbnVsbCA6IHVuZGVmaW5lZCwgaW5pdCk7XG4gIH0sIG9wdGlvbnMub3duZXIpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGRpc3Bvc2VyKCk7XG4gICAgZWxlbWVudC50ZXh0Q29udGVudCA9IFwiXCI7XG4gIH07XG59XG5mdW5jdGlvbiB0ZW1wbGF0ZShodG1sLCBpc0ltcG9ydE5vZGUsIGlzU1ZHLCBpc01hdGhNTCkge1xuICBsZXQgbm9kZTtcbiAgY29uc3QgY3JlYXRlID0gKCkgPT4ge1xuICAgIGlmIChpc0h5ZHJhdGluZygpKSB0aHJvdyBuZXcgRXJyb3IoXCJGYWlsZWQgYXR0ZW1wdCB0byBjcmVhdGUgbmV3IERPTSBlbGVtZW50cyBkdXJpbmcgaHlkcmF0aW9uLiBDaGVjayB0aGF0IHRoZSBsaWJyYXJpZXMgeW91IGFyZSB1c2luZyBzdXBwb3J0IGh5ZHJhdGlvbi5cIik7XG4gICAgY29uc3QgdCA9IGlzTWF0aE1MID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMTk5OC9NYXRoL01hdGhNTFwiLCBcInRlbXBsYXRlXCIpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIpO1xuICAgIHQuaW5uZXJIVE1MID0gaHRtbDtcbiAgICByZXR1cm4gaXNTVkcgPyB0LmNvbnRlbnQuZmlyc3RDaGlsZC5maXJzdENoaWxkIDogaXNNYXRoTUwgPyB0LmZpcnN0Q2hpbGQgOiB0LmNvbnRlbnQuZmlyc3RDaGlsZDtcbiAgfTtcbiAgY29uc3QgZm4gPSBpc0ltcG9ydE5vZGUgPyAoKSA9PiB1bnRyYWNrKCgpID0+IGRvY3VtZW50LmltcG9ydE5vZGUobm9kZSB8fCAobm9kZSA9IGNyZWF0ZSgpKSwgdHJ1ZSkpIDogKCkgPT4gKG5vZGUgfHwgKG5vZGUgPSBjcmVhdGUoKSkpLmNsb25lTm9kZSh0cnVlKTtcbiAgZm4uY2xvbmVOb2RlID0gZm47XG4gIHJldHVybiBmbjtcbn1cbmZ1bmN0aW9uIGRlbGVnYXRlRXZlbnRzKGV2ZW50TmFtZXMsIGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50KSB7XG4gIGNvbnN0IGUgPSBkb2N1bWVudFskJEVWRU5UU10gfHwgKGRvY3VtZW50WyQkRVZFTlRTXSA9IG5ldyBTZXQoKSk7XG4gIGZvciAobGV0IGkgPSAwLCBsID0gZXZlbnROYW1lcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBjb25zdCBuYW1lID0gZXZlbnROYW1lc1tpXTtcbiAgICBpZiAoIWUuaGFzKG5hbWUpKSB7XG4gICAgICBlLmFkZChuYW1lKTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZXZlbnRIYW5kbGVyKTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIGNsZWFyRGVsZWdhdGVkRXZlbnRzKGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50KSB7XG4gIGlmIChkb2N1bWVudFskJEVWRU5UU10pIHtcbiAgICBmb3IgKGxldCBuYW1lIG9mIGRvY3VtZW50WyQkRVZFTlRTXS5rZXlzKCkpIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgZXZlbnRIYW5kbGVyKTtcbiAgICBkZWxldGUgZG9jdW1lbnRbJCRFVkVOVFNdO1xuICB9XG59XG5mdW5jdGlvbiBzZXRQcm9wZXJ0eShub2RlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgbm9kZVtuYW1lXSA9IHZhbHVlO1xufVxuZnVuY3Rpb24gc2V0QXR0cmlidXRlKG5vZGUsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBpZiAodmFsdWUgPT0gbnVsbCkgbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7ZWxzZSBub2RlLnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBzZXRBdHRyaWJ1dGVOUyhub2RlLCBuYW1lc3BhY2UsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBpZiAodmFsdWUgPT0gbnVsbCkgbm9kZS5yZW1vdmVBdHRyaWJ1dGVOUyhuYW1lc3BhY2UsIG5hbWUpO2Vsc2Ugbm9kZS5zZXRBdHRyaWJ1dGVOUyhuYW1lc3BhY2UsIG5hbWUsIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIHNldEJvb2xBdHRyaWJ1dGUobm9kZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIHZhbHVlID8gbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgXCJcIikgOiBub2RlLnJlbW92ZUF0dHJpYnV0ZShuYW1lKTtcbn1cbmZ1bmN0aW9uIGNsYXNzTmFtZShub2RlLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlKFwiY2xhc3NcIik7ZWxzZSBub2RlLmNsYXNzTmFtZSA9IHZhbHVlO1xufVxuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcihub2RlLCBuYW1lLCBoYW5kbGVyLCBkZWxlZ2F0ZSkge1xuICBpZiAoZGVsZWdhdGUpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShoYW5kbGVyKSkge1xuICAgICAgbm9kZVtgJCQke25hbWV9YF0gPSBoYW5kbGVyWzBdO1xuICAgICAgbm9kZVtgJCQke25hbWV9RGF0YWBdID0gaGFuZGxlclsxXTtcbiAgICB9IGVsc2Ugbm9kZVtgJCQke25hbWV9YF0gPSBoYW5kbGVyO1xuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaGFuZGxlcikpIHtcbiAgICBjb25zdCBoYW5kbGVyRm4gPSBoYW5kbGVyWzBdO1xuICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBoYW5kbGVyWzBdID0gZSA9PiBoYW5kbGVyRm4uY2FsbChub2RlLCBoYW5kbGVyWzFdLCBlKSk7XG4gIH0gZWxzZSBub2RlLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgaGFuZGxlciwgdHlwZW9mIGhhbmRsZXIgIT09IFwiZnVuY3Rpb25cIiAmJiBoYW5kbGVyKTtcbn1cbmZ1bmN0aW9uIGNsYXNzTGlzdChub2RlLCB2YWx1ZSwgcHJldiA9IHt9KSB7XG4gIGNvbnN0IGNsYXNzS2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlIHx8IHt9KSxcbiAgICBwcmV2S2V5cyA9IE9iamVjdC5rZXlzKHByZXYpO1xuICBsZXQgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBwcmV2S2V5cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNvbnN0IGtleSA9IHByZXZLZXlzW2ldO1xuICAgIGlmICgha2V5IHx8IGtleSA9PT0gXCJ1bmRlZmluZWRcIiB8fCB2YWx1ZVtrZXldKSBjb250aW51ZTtcbiAgICB0b2dnbGVDbGFzc0tleShub2RlLCBrZXksIGZhbHNlKTtcbiAgICBkZWxldGUgcHJldltrZXldO1xuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IGNsYXNzS2V5cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNvbnN0IGtleSA9IGNsYXNzS2V5c1tpXSxcbiAgICAgIGNsYXNzVmFsdWUgPSAhIXZhbHVlW2tleV07XG4gICAgaWYgKCFrZXkgfHwga2V5ID09PSBcInVuZGVmaW5lZFwiIHx8IHByZXZba2V5XSA9PT0gY2xhc3NWYWx1ZSB8fCAhY2xhc3NWYWx1ZSkgY29udGludWU7XG4gICAgdG9nZ2xlQ2xhc3NLZXkobm9kZSwga2V5LCB0cnVlKTtcbiAgICBwcmV2W2tleV0gPSBjbGFzc1ZhbHVlO1xuICB9XG4gIHJldHVybiBwcmV2O1xufVxuZnVuY3Rpb24gc3R5bGUobm9kZSwgdmFsdWUsIHByZXYpIHtcbiAgaWYgKCF2YWx1ZSkgcmV0dXJuIHByZXYgPyBzZXRBdHRyaWJ1dGUobm9kZSwgXCJzdHlsZVwiKSA6IHZhbHVlO1xuICBjb25zdCBub2RlU3R5bGUgPSBub2RlLnN0eWxlO1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSByZXR1cm4gbm9kZVN0eWxlLmNzc1RleHQgPSB2YWx1ZTtcbiAgdHlwZW9mIHByZXYgPT09IFwic3RyaW5nXCIgJiYgKG5vZGVTdHlsZS5jc3NUZXh0ID0gcHJldiA9IHVuZGVmaW5lZCk7XG4gIHByZXYgfHwgKHByZXYgPSB7fSk7XG4gIHZhbHVlIHx8ICh2YWx1ZSA9IHt9KTtcbiAgbGV0IHYsIHM7XG4gIGZvciAocyBpbiBwcmV2KSB7XG4gICAgdmFsdWVbc10gPT0gbnVsbCAmJiBub2RlU3R5bGUucmVtb3ZlUHJvcGVydHkocyk7XG4gICAgZGVsZXRlIHByZXZbc107XG4gIH1cbiAgZm9yIChzIGluIHZhbHVlKSB7XG4gICAgdiA9IHZhbHVlW3NdO1xuICAgIGlmICh2ICE9PSBwcmV2W3NdKSB7XG4gICAgICBub2RlU3R5bGUuc2V0UHJvcGVydHkocywgdik7XG4gICAgICBwcmV2W3NdID0gdjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHByZXY7XG59XG5mdW5jdGlvbiBzcHJlYWQobm9kZSwgcHJvcHMgPSB7fSwgaXNTVkcsIHNraXBDaGlsZHJlbikge1xuICBjb25zdCBwcmV2UHJvcHMgPSB7fTtcbiAgaWYgKCFza2lwQ2hpbGRyZW4pIHtcbiAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gcHJldlByb3BzLmNoaWxkcmVuID0gaW5zZXJ0RXhwcmVzc2lvbihub2RlLCBwcm9wcy5jaGlsZHJlbiwgcHJldlByb3BzLmNoaWxkcmVuKSk7XG4gIH1cbiAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHR5cGVvZiBwcm9wcy5yZWYgPT09IFwiZnVuY3Rpb25cIiAmJiB1c2UocHJvcHMucmVmLCBub2RlKSk7XG4gIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiBhc3NpZ24obm9kZSwgcHJvcHMsIGlzU1ZHLCB0cnVlLCBwcmV2UHJvcHMsIHRydWUpKTtcbiAgcmV0dXJuIHByZXZQcm9wcztcbn1cbmZ1bmN0aW9uIGR5bmFtaWNQcm9wZXJ0eShwcm9wcywga2V5KSB7XG4gIGNvbnN0IHNyYyA9IHByb3BzW2tleV07XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm9wcywga2V5LCB7XG4gICAgZ2V0KCkge1xuICAgICAgcmV0dXJuIHNyYygpO1xuICAgIH0sXG4gICAgZW51bWVyYWJsZTogdHJ1ZVxuICB9KTtcbiAgcmV0dXJuIHByb3BzO1xufVxuZnVuY3Rpb24gdXNlKGZuLCBlbGVtZW50LCBhcmcpIHtcbiAgcmV0dXJuIHVudHJhY2soKCkgPT4gZm4oZWxlbWVudCwgYXJnKSk7XG59XG5mdW5jdGlvbiBpbnNlcnQocGFyZW50LCBhY2Nlc3NvciwgbWFya2VyLCBpbml0aWFsKSB7XG4gIGlmIChtYXJrZXIgIT09IHVuZGVmaW5lZCAmJiAhaW5pdGlhbCkgaW5pdGlhbCA9IFtdO1xuICBpZiAodHlwZW9mIGFjY2Vzc29yICE9PSBcImZ1bmN0aW9uXCIpIHJldHVybiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgYWNjZXNzb3IsIGluaXRpYWwsIG1hcmtlcik7XG4gIGNyZWF0ZVJlbmRlckVmZmVjdChjdXJyZW50ID0+IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCBhY2Nlc3NvcigpLCBjdXJyZW50LCBtYXJrZXIpLCBpbml0aWFsKTtcbn1cbmZ1bmN0aW9uIGFzc2lnbihub2RlLCBwcm9wcywgaXNTVkcsIHNraXBDaGlsZHJlbiwgcHJldlByb3BzID0ge30sIHNraXBSZWYgPSBmYWxzZSkge1xuICBwcm9wcyB8fCAocHJvcHMgPSB7fSk7XG4gIGZvciAoY29uc3QgcHJvcCBpbiBwcmV2UHJvcHMpIHtcbiAgICBpZiAoIShwcm9wIGluIHByb3BzKSkge1xuICAgICAgaWYgKHByb3AgPT09IFwiY2hpbGRyZW5cIikgY29udGludWU7XG4gICAgICBwcmV2UHJvcHNbcHJvcF0gPSBhc3NpZ25Qcm9wKG5vZGUsIHByb3AsIG51bGwsIHByZXZQcm9wc1twcm9wXSwgaXNTVkcsIHNraXBSZWYsIHByb3BzKTtcbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBwcm9wIGluIHByb3BzKSB7XG4gICAgaWYgKHByb3AgPT09IFwiY2hpbGRyZW5cIikge1xuICAgICAgaWYgKCFza2lwQ2hpbGRyZW4pIGluc2VydEV4cHJlc3Npb24obm9kZSwgcHJvcHMuY2hpbGRyZW4pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gcHJvcHNbcHJvcF07XG4gICAgcHJldlByb3BzW3Byb3BdID0gYXNzaWduUHJvcChub2RlLCBwcm9wLCB2YWx1ZSwgcHJldlByb3BzW3Byb3BdLCBpc1NWRywgc2tpcFJlZiwgcHJvcHMpO1xuICB9XG59XG5mdW5jdGlvbiBoeWRyYXRlJDEoY29kZSwgZWxlbWVudCwgb3B0aW9ucyA9IHt9KSB7XG4gIGlmIChnbG9iYWxUaGlzLl8kSFkuZG9uZSkgcmV0dXJuIHJlbmRlcihjb2RlLCBlbGVtZW50LCBbLi4uZWxlbWVudC5jaGlsZE5vZGVzXSwgb3B0aW9ucyk7XG4gIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQgPSBnbG9iYWxUaGlzLl8kSFkuY29tcGxldGVkO1xuICBzaGFyZWRDb25maWcuZXZlbnRzID0gZ2xvYmFsVGhpcy5fJEhZLmV2ZW50cztcbiAgc2hhcmVkQ29uZmlnLmxvYWQgPSBpZCA9PiBnbG9iYWxUaGlzLl8kSFkucltpZF07XG4gIHNoYXJlZENvbmZpZy5oYXMgPSBpZCA9PiBpZCBpbiBnbG9iYWxUaGlzLl8kSFkucjtcbiAgc2hhcmVkQ29uZmlnLmdhdGhlciA9IHJvb3QgPT4gZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCByb290KTtcbiAgc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ID0gbmV3IE1hcCgpO1xuICBzaGFyZWRDb25maWcuY29udGV4dCA9IHtcbiAgICBpZDogb3B0aW9ucy5yZW5kZXJJZCB8fCBcIlwiLFxuICAgIGNvdW50OiAwXG4gIH07XG4gIHRyeSB7XG4gICAgZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCBvcHRpb25zLnJlbmRlcklkKTtcbiAgICByZXR1cm4gcmVuZGVyKGNvZGUsIGVsZW1lbnQsIFsuLi5lbGVtZW50LmNoaWxkTm9kZXNdLCBvcHRpb25zKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBzaGFyZWRDb25maWcuY29udGV4dCA9IG51bGw7XG4gIH1cbn1cbmZ1bmN0aW9uIGdldE5leHRFbGVtZW50KHRlbXBsYXRlKSB7XG4gIGxldCBub2RlLFxuICAgIGtleSxcbiAgICBoeWRyYXRpbmcgPSBpc0h5ZHJhdGluZygpO1xuICBpZiAoIWh5ZHJhdGluZyB8fCAhKG5vZGUgPSBzaGFyZWRDb25maWcucmVnaXN0cnkuZ2V0KGtleSA9IGdldEh5ZHJhdGlvbktleSgpKSkpIHtcbiAgICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgICBzaGFyZWRDb25maWcuZG9uZSA9IHRydWU7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEh5ZHJhdGlvbiBNaXNtYXRjaC4gVW5hYmxlIHRvIGZpbmQgRE9NIG5vZGVzIGZvciBoeWRyYXRpb24ga2V5OiAke2tleX1cXG4ke3RlbXBsYXRlID8gdGVtcGxhdGUoKS5vdXRlckhUTUwgOiBcIlwifWApO1xuICAgIH1cbiAgICByZXR1cm4gdGVtcGxhdGUoKTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmNvbXBsZXRlZCkgc2hhcmVkQ29uZmlnLmNvbXBsZXRlZC5hZGQobm9kZSk7XG4gIHNoYXJlZENvbmZpZy5yZWdpc3RyeS5kZWxldGUoa2V5KTtcbiAgcmV0dXJuIG5vZGU7XG59XG5mdW5jdGlvbiBnZXROZXh0TWF0Y2goZWwsIG5vZGVOYW1lKSB7XG4gIHdoaWxlIChlbCAmJiBlbC5sb2NhbE5hbWUgIT09IG5vZGVOYW1lKSBlbCA9IGVsLm5leHRTaWJsaW5nO1xuICByZXR1cm4gZWw7XG59XG5mdW5jdGlvbiBnZXROZXh0TWFya2VyKHN0YXJ0KSB7XG4gIGxldCBlbmQgPSBzdGFydCxcbiAgICBjb3VudCA9IDAsXG4gICAgY3VycmVudCA9IFtdO1xuICBpZiAoaXNIeWRyYXRpbmcoc3RhcnQpKSB7XG4gICAgd2hpbGUgKGVuZCkge1xuICAgICAgaWYgKGVuZC5ub2RlVHlwZSA9PT0gOCkge1xuICAgICAgICBjb25zdCB2ID0gZW5kLm5vZGVWYWx1ZTtcbiAgICAgICAgaWYgKHYgPT09IFwiJFwiKSBjb3VudCsrO2Vsc2UgaWYgKHYgPT09IFwiL1wiKSB7XG4gICAgICAgICAgaWYgKGNvdW50ID09PSAwKSByZXR1cm4gW2VuZCwgY3VycmVudF07XG4gICAgICAgICAgY291bnQtLTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY3VycmVudC5wdXNoKGVuZCk7XG4gICAgICBlbmQgPSBlbmQubmV4dFNpYmxpbmc7XG4gICAgfVxuICB9XG4gIHJldHVybiBbZW5kLCBjdXJyZW50XTtcbn1cbmZ1bmN0aW9uIHJ1bkh5ZHJhdGlvbkV2ZW50cygpIHtcbiAgaWYgKHNoYXJlZENvbmZpZy5ldmVudHMgJiYgIXNoYXJlZENvbmZpZy5ldmVudHMucXVldWVkKSB7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuICAgICAgY29uc3Qge1xuICAgICAgICBjb21wbGV0ZWQsXG4gICAgICAgIGV2ZW50c1xuICAgICAgfSA9IHNoYXJlZENvbmZpZztcbiAgICAgIGlmICghZXZlbnRzKSByZXR1cm47XG4gICAgICBldmVudHMucXVldWVkID0gZmFsc2U7XG4gICAgICB3aGlsZSAoZXZlbnRzLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBbZWwsIGVdID0gZXZlbnRzWzBdO1xuICAgICAgICBpZiAoIWNvbXBsZXRlZC5oYXMoZWwpKSByZXR1cm47XG4gICAgICAgIGV2ZW50cy5zaGlmdCgpO1xuICAgICAgICBldmVudEhhbmRsZXIoZSk7XG4gICAgICB9XG4gICAgICBpZiAoc2hhcmVkQ29uZmlnLmRvbmUpIHtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmV2ZW50cyA9IF8kSFkuZXZlbnRzID0gbnVsbDtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmNvbXBsZXRlZCA9IF8kSFkuY29tcGxldGVkID0gbnVsbDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBzaGFyZWRDb25maWcuZXZlbnRzLnF1ZXVlZCA9IHRydWU7XG4gIH1cbn1cbmZ1bmN0aW9uIGlzSHlkcmF0aW5nKG5vZGUpIHtcbiAgcmV0dXJuICEhc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgIXNoYXJlZENvbmZpZy5kb25lICYmICghbm9kZSB8fCBub2RlLmlzQ29ubmVjdGVkKTtcbn1cbmZ1bmN0aW9uIHRvUHJvcGVydHlOYW1lKG5hbWUpIHtcbiAgcmV0dXJuIG5hbWUudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC8tKFthLXpdKS9nLCAoXywgdykgPT4gdy50b1VwcGVyQ2FzZSgpKTtcbn1cbmZ1bmN0aW9uIHRvZ2dsZUNsYXNzS2V5KG5vZGUsIGtleSwgdmFsdWUpIHtcbiAgY29uc3QgY2xhc3NOYW1lcyA9IGtleS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgZm9yIChsZXQgaSA9IDAsIG5hbWVMZW4gPSBjbGFzc05hbWVzLmxlbmd0aDsgaSA8IG5hbWVMZW47IGkrKykgbm9kZS5jbGFzc0xpc3QudG9nZ2xlKGNsYXNzTmFtZXNbaV0sIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIGFzc2lnblByb3Aobm9kZSwgcHJvcCwgdmFsdWUsIHByZXYsIGlzU1ZHLCBza2lwUmVmLCBwcm9wcykge1xuICBsZXQgaXNDRSwgaXNQcm9wLCBpc0NoaWxkUHJvcCwgcHJvcEFsaWFzLCBmb3JjZVByb3A7XG4gIGlmIChwcm9wID09PSBcInN0eWxlXCIpIHJldHVybiBzdHlsZShub2RlLCB2YWx1ZSwgcHJldik7XG4gIGlmIChwcm9wID09PSBcImNsYXNzTGlzdFwiKSByZXR1cm4gY2xhc3NMaXN0KG5vZGUsIHZhbHVlLCBwcmV2KTtcbiAgaWYgKHZhbHVlID09PSBwcmV2KSByZXR1cm4gcHJldjtcbiAgaWYgKHByb3AgPT09IFwicmVmXCIpIHtcbiAgICBpZiAoIXNraXBSZWYpIHZhbHVlKG5vZGUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMykgPT09IFwib246XCIpIHtcbiAgICBjb25zdCBlID0gcHJvcC5zbGljZSgzKTtcbiAgICBwcmV2ICYmIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihlLCBwcmV2LCB0eXBlb2YgcHJldiAhPT0gXCJmdW5jdGlvblwiICYmIHByZXYpO1xuICAgIHZhbHVlICYmIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihlLCB2YWx1ZSwgdHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIgJiYgdmFsdWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMTApID09PSBcIm9uY2FwdHVyZTpcIikge1xuICAgIGNvbnN0IGUgPSBwcm9wLnNsaWNlKDEwKTtcbiAgICBwcmV2ICYmIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihlLCBwcmV2LCB0cnVlKTtcbiAgICB2YWx1ZSAmJiBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZSwgdmFsdWUsIHRydWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMikgPT09IFwib25cIikge1xuICAgIGNvbnN0IG5hbWUgPSBwcm9wLnNsaWNlKDIpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgZGVsZWdhdGUgPSBEZWxlZ2F0ZWRFdmVudHMuaGFzKG5hbWUpO1xuICAgIGlmICghZGVsZWdhdGUgJiYgcHJldikge1xuICAgICAgY29uc3QgaCA9IEFycmF5LmlzQXJyYXkocHJldikgPyBwcmV2WzBdIDogcHJldjtcbiAgICAgIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBoKTtcbiAgICB9XG4gICAgaWYgKGRlbGVnYXRlIHx8IHZhbHVlKSB7XG4gICAgICBhZGRFdmVudExpc3RlbmVyKG5vZGUsIG5hbWUsIHZhbHVlLCBkZWxlZ2F0ZSk7XG4gICAgICBkZWxlZ2F0ZSAmJiBkZWxlZ2F0ZUV2ZW50cyhbbmFtZV0pO1xuICAgIH1cbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDUpID09PSBcImF0dHI6XCIpIHtcbiAgICBzZXRBdHRyaWJ1dGUobm9kZSwgcHJvcC5zbGljZSg1KSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgNSkgPT09IFwiYm9vbDpcIikge1xuICAgIHNldEJvb2xBdHRyaWJ1dGUobm9kZSwgcHJvcC5zbGljZSg1KSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKChmb3JjZVByb3AgPSBwcm9wLnNsaWNlKDAsIDUpID09PSBcInByb3A6XCIpIHx8IChpc0NoaWxkUHJvcCA9IENoaWxkUHJvcGVydGllcy5oYXMocHJvcCkpIHx8ICFpc1NWRyAmJiAoKHByb3BBbGlhcyA9IGdldFByb3BBbGlhcyhwcm9wLCBub2RlLnRhZ05hbWUpKSB8fCAoaXNQcm9wID0gUHJvcGVydGllcy5oYXMocHJvcCkpKSB8fCAoaXNDRSA9IG5vZGUubm9kZU5hbWUuaW5jbHVkZXMoXCItXCIpIHx8IFwiaXNcIiBpbiBwcm9wcykpIHtcbiAgICBpZiAoZm9yY2VQcm9wKSB7XG4gICAgICBwcm9wID0gcHJvcC5zbGljZSg1KTtcbiAgICAgIGlzUHJvcCA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuIHZhbHVlO1xuICAgIGlmIChwcm9wID09PSBcImNsYXNzXCIgfHwgcHJvcCA9PT0gXCJjbGFzc05hbWVcIikgY2xhc3NOYW1lKG5vZGUsIHZhbHVlKTtlbHNlIGlmIChpc0NFICYmICFpc1Byb3AgJiYgIWlzQ2hpbGRQcm9wKSBub2RlW3RvUHJvcGVydHlOYW1lKHByb3ApXSA9IHZhbHVlO2Vsc2Ugbm9kZVtwcm9wQWxpYXMgfHwgcHJvcF0gPSB2YWx1ZTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBucyA9IGlzU1ZHICYmIHByb3AuaW5kZXhPZihcIjpcIikgPiAtMSAmJiBTVkdOYW1lc3BhY2VbcHJvcC5zcGxpdChcIjpcIilbMF1dO1xuICAgIGlmIChucykgc2V0QXR0cmlidXRlTlMobm9kZSwgbnMsIHByb3AsIHZhbHVlKTtlbHNlIHNldEF0dHJpYnV0ZShub2RlLCBBbGlhc2VzW3Byb3BdIHx8IHByb3AsIHZhbHVlKTtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5mdW5jdGlvbiBldmVudEhhbmRsZXIoZSkge1xuICBpZiAoc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ICYmIHNoYXJlZENvbmZpZy5ldmVudHMpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmV2ZW50cy5maW5kKChbZWwsIGV2XSkgPT4gZXYgPT09IGUpKSByZXR1cm47XG4gIH1cbiAgbGV0IG5vZGUgPSBlLnRhcmdldDtcbiAgY29uc3Qga2V5ID0gYCQkJHtlLnR5cGV9YDtcbiAgY29uc3Qgb3JpVGFyZ2V0ID0gZS50YXJnZXQ7XG4gIGNvbnN0IG9yaUN1cnJlbnRUYXJnZXQgPSBlLmN1cnJlbnRUYXJnZXQ7XG4gIGNvbnN0IHJldGFyZ2V0ID0gdmFsdWUgPT4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGUsIFwidGFyZ2V0XCIsIHtcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgdmFsdWVcbiAgfSk7XG4gIGNvbnN0IGhhbmRsZU5vZGUgPSAoKSA9PiB7XG4gICAgY29uc3QgaGFuZGxlciA9IG5vZGVba2V5XTtcbiAgICBpZiAoaGFuZGxlciAmJiAhbm9kZS5kaXNhYmxlZCkge1xuICAgICAgY29uc3QgZGF0YSA9IG5vZGVbYCR7a2V5fURhdGFgXTtcbiAgICAgIGRhdGEgIT09IHVuZGVmaW5lZCA/IGhhbmRsZXIuY2FsbChub2RlLCBkYXRhLCBlKSA6IGhhbmRsZXIuY2FsbChub2RlLCBlKTtcbiAgICAgIGlmIChlLmNhbmNlbEJ1YmJsZSkgcmV0dXJuO1xuICAgIH1cbiAgICBub2RlLmhvc3QgJiYgdHlwZW9mIG5vZGUuaG9zdCAhPT0gXCJzdHJpbmdcIiAmJiAhbm9kZS5ob3N0Ll8kaG9zdCAmJiBub2RlLmNvbnRhaW5zKGUudGFyZ2V0KSAmJiByZXRhcmdldChub2RlLmhvc3QpO1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xuICBjb25zdCB3YWxrVXBUcmVlID0gKCkgPT4ge1xuICAgIHdoaWxlIChoYW5kbGVOb2RlKCkgJiYgKG5vZGUgPSBub2RlLl8kaG9zdCB8fCBub2RlLnBhcmVudE5vZGUgfHwgbm9kZS5ob3N0KSk7XG4gIH07XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlLCBcImN1cnJlbnRUYXJnZXRcIiwge1xuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBnZXQoKSB7XG4gICAgICByZXR1cm4gbm9kZSB8fCBkb2N1bWVudDtcbiAgICB9XG4gIH0pO1xuICBpZiAoc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ICYmICFzaGFyZWRDb25maWcuZG9uZSkgc2hhcmVkQ29uZmlnLmRvbmUgPSBfJEhZLmRvbmUgPSB0cnVlO1xuICBpZiAoZS5jb21wb3NlZFBhdGgpIHtcbiAgICBjb25zdCBwYXRoID0gZS5jb21wb3NlZFBhdGgoKTtcbiAgICByZXRhcmdldChwYXRoWzBdKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdGgubGVuZ3RoIC0gMjsgaSsrKSB7XG4gICAgICBub2RlID0gcGF0aFtpXTtcbiAgICAgIGlmICghaGFuZGxlTm9kZSgpKSBicmVhaztcbiAgICAgIGlmIChub2RlLl8kaG9zdCkge1xuICAgICAgICBub2RlID0gbm9kZS5fJGhvc3Q7XG4gICAgICAgIHdhbGtVcFRyZWUoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAobm9kZS5wYXJlbnROb2RlID09PSBvcmlDdXJyZW50VGFyZ2V0KSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBlbHNlIHdhbGtVcFRyZWUoKTtcbiAgcmV0YXJnZXQob3JpVGFyZ2V0KTtcbn1cbmZ1bmN0aW9uIGluc2VydEV4cHJlc3Npb24ocGFyZW50LCB2YWx1ZSwgY3VycmVudCwgbWFya2VyLCB1bndyYXBBcnJheSkge1xuICBjb25zdCBoeWRyYXRpbmcgPSBpc0h5ZHJhdGluZyhwYXJlbnQpO1xuICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgIWN1cnJlbnQgJiYgKGN1cnJlbnQgPSBbLi4ucGFyZW50LmNoaWxkTm9kZXNdKTtcbiAgICBsZXQgY2xlYW5lZCA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY3VycmVudC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgbm9kZSA9IGN1cnJlbnRbaV07XG4gICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gOCAmJiBub2RlLmRhdGEuc2xpY2UoMCwgMikgPT09IFwiISRcIikgbm9kZS5yZW1vdmUoKTtlbHNlIGNsZWFuZWQucHVzaChub2RlKTtcbiAgICB9XG4gICAgY3VycmVudCA9IGNsZWFuZWQ7XG4gIH1cbiAgd2hpbGUgKHR5cGVvZiBjdXJyZW50ID09PSBcImZ1bmN0aW9uXCIpIGN1cnJlbnQgPSBjdXJyZW50KCk7XG4gIGlmICh2YWx1ZSA9PT0gY3VycmVudCkgcmV0dXJuIGN1cnJlbnQ7XG4gIGNvbnN0IHQgPSB0eXBlb2YgdmFsdWUsXG4gICAgbXVsdGkgPSBtYXJrZXIgIT09IHVuZGVmaW5lZDtcbiAgcGFyZW50ID0gbXVsdGkgJiYgY3VycmVudFswXSAmJiBjdXJyZW50WzBdLnBhcmVudE5vZGUgfHwgcGFyZW50O1xuICBpZiAodCA9PT0gXCJzdHJpbmdcIiB8fCB0ID09PSBcIm51bWJlclwiKSB7XG4gICAgaWYgKGh5ZHJhdGluZykgcmV0dXJuIGN1cnJlbnQ7XG4gICAgaWYgKHQgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIHZhbHVlID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gY3VycmVudCkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgfVxuICAgIGlmIChtdWx0aSkge1xuICAgICAgbGV0IG5vZGUgPSBjdXJyZW50WzBdO1xuICAgICAgaWYgKG5vZGUgJiYgbm9kZS5ub2RlVHlwZSA9PT0gMykge1xuICAgICAgICBub2RlLmRhdGEgIT09IHZhbHVlICYmIChub2RlLmRhdGEgPSB2YWx1ZSk7XG4gICAgICB9IGVsc2Ugbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZhbHVlKTtcbiAgICAgIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCBub2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGN1cnJlbnQgIT09IFwiXCIgJiYgdHlwZW9mIGN1cnJlbnQgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgY3VycmVudCA9IHBhcmVudC5maXJzdENoaWxkLmRhdGEgPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSBjdXJyZW50ID0gcGFyZW50LnRleHRDb250ZW50ID0gdmFsdWU7XG4gICAgfVxuICB9IGVsc2UgaWYgKHZhbHVlID09IG51bGwgfHwgdCA9PT0gXCJib29sZWFuXCIpIHtcbiAgICBpZiAoaHlkcmF0aW5nKSByZXR1cm4gY3VycmVudDtcbiAgICBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlcik7XG4gIH0gZWxzZSBpZiAodCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHtcbiAgICAgIGxldCB2ID0gdmFsdWUoKTtcbiAgICAgIHdoaWxlICh0eXBlb2YgdiA9PT0gXCJmdW5jdGlvblwiKSB2ID0gdigpO1xuICAgICAgY3VycmVudCA9IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCB2LCBjdXJyZW50LCBtYXJrZXIpO1xuICAgIH0pO1xuICAgIHJldHVybiAoKSA9PiBjdXJyZW50O1xuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgY29uc3QgYXJyYXkgPSBbXTtcbiAgICBjb25zdCBjdXJyZW50QXJyYXkgPSBjdXJyZW50ICYmIEFycmF5LmlzQXJyYXkoY3VycmVudCk7XG4gICAgaWYgKG5vcm1hbGl6ZUluY29taW5nQXJyYXkoYXJyYXksIHZhbHVlLCBjdXJyZW50LCB1bndyYXBBcnJheSkpIHtcbiAgICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiBjdXJyZW50ID0gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIGFycmF5LCBjdXJyZW50LCBtYXJrZXIsIHRydWUpKTtcbiAgICAgIHJldHVybiAoKSA9PiBjdXJyZW50O1xuICAgIH1cbiAgICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgICBpZiAoIWFycmF5Lmxlbmd0aCkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgICBpZiAobWFya2VyID09PSB1bmRlZmluZWQpIHJldHVybiBjdXJyZW50ID0gWy4uLnBhcmVudC5jaGlsZE5vZGVzXTtcbiAgICAgIGxldCBub2RlID0gYXJyYXlbMF07XG4gICAgICBpZiAobm9kZS5wYXJlbnROb2RlICE9PSBwYXJlbnQpIHJldHVybiBjdXJyZW50O1xuICAgICAgY29uc3Qgbm9kZXMgPSBbbm9kZV07XG4gICAgICB3aGlsZSAoKG5vZGUgPSBub2RlLm5leHRTaWJsaW5nKSAhPT0gbWFya2VyKSBub2Rlcy5wdXNoKG5vZGUpO1xuICAgICAgcmV0dXJuIGN1cnJlbnQgPSBub2RlcztcbiAgICB9XG4gICAgaWYgKGFycmF5Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIpO1xuICAgICAgaWYgKG11bHRpKSByZXR1cm4gY3VycmVudDtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnRBcnJheSkge1xuICAgICAgaWYgKGN1cnJlbnQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXksIG1hcmtlcik7XG4gICAgICB9IGVsc2UgcmVjb25jaWxlQXJyYXlzKHBhcmVudCwgY3VycmVudCwgYXJyYXkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdXJyZW50ICYmIGNsZWFuQ2hpbGRyZW4ocGFyZW50KTtcbiAgICAgIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXkpO1xuICAgIH1cbiAgICBjdXJyZW50ID0gYXJyYXk7XG4gIH0gZWxzZSBpZiAodmFsdWUubm9kZVR5cGUpIHtcbiAgICBpZiAoaHlkcmF0aW5nICYmIHZhbHVlLnBhcmVudE5vZGUpIHJldHVybiBjdXJyZW50ID0gbXVsdGkgPyBbdmFsdWVdIDogdmFsdWU7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoY3VycmVudCkpIHtcbiAgICAgIGlmIChtdWx0aSkgcmV0dXJuIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCB2YWx1ZSk7XG4gICAgICBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbnVsbCwgdmFsdWUpO1xuICAgIH0gZWxzZSBpZiAoY3VycmVudCA9PSBudWxsIHx8IGN1cnJlbnQgPT09IFwiXCIgfHwgIXBhcmVudC5maXJzdENoaWxkKSB7XG4gICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQodmFsdWUpO1xuICAgIH0gZWxzZSBwYXJlbnQucmVwbGFjZUNoaWxkKHZhbHVlLCBwYXJlbnQuZmlyc3RDaGlsZCk7XG4gICAgY3VycmVudCA9IHZhbHVlO1xuICB9IGVsc2UgY29uc29sZS53YXJuKGBVbnJlY29nbml6ZWQgdmFsdWUuIFNraXBwZWQgaW5zZXJ0aW5nYCwgdmFsdWUpO1xuICByZXR1cm4gY3VycmVudDtcbn1cbmZ1bmN0aW9uIG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgYXJyYXksIGN1cnJlbnQsIHVud3JhcCkge1xuICBsZXQgZHluYW1pYyA9IGZhbHNlO1xuICBmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBsZXQgaXRlbSA9IGFycmF5W2ldLFxuICAgICAgcHJldiA9IGN1cnJlbnQgJiYgY3VycmVudFtub3JtYWxpemVkLmxlbmd0aF0sXG4gICAgICB0O1xuICAgIGlmIChpdGVtID09IG51bGwgfHwgaXRlbSA9PT0gdHJ1ZSB8fCBpdGVtID09PSBmYWxzZSkgOyBlbHNlIGlmICgodCA9IHR5cGVvZiBpdGVtKSA9PT0gXCJvYmplY3RcIiAmJiBpdGVtLm5vZGVUeXBlKSB7XG4gICAgICBub3JtYWxpemVkLnB1c2goaXRlbSk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGl0ZW0pKSB7XG4gICAgICBkeW5hbWljID0gbm9ybWFsaXplSW5jb21pbmdBcnJheShub3JtYWxpemVkLCBpdGVtLCBwcmV2KSB8fCBkeW5hbWljO1xuICAgIH0gZWxzZSBpZiAodCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBpZiAodW53cmFwKSB7XG4gICAgICAgIHdoaWxlICh0eXBlb2YgaXRlbSA9PT0gXCJmdW5jdGlvblwiKSBpdGVtID0gaXRlbSgpO1xuICAgICAgICBkeW5hbWljID0gbm9ybWFsaXplSW5jb21pbmdBcnJheShub3JtYWxpemVkLCBBcnJheS5pc0FycmF5KGl0ZW0pID8gaXRlbSA6IFtpdGVtXSwgQXJyYXkuaXNBcnJheShwcmV2KSA/IHByZXYgOiBbcHJldl0pIHx8IGR5bmFtaWM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBub3JtYWxpemVkLnB1c2goaXRlbSk7XG4gICAgICAgIGR5bmFtaWMgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IFN0cmluZyhpdGVtKTtcbiAgICAgIGlmIChwcmV2ICYmIHByZXYubm9kZVR5cGUgPT09IDMgJiYgcHJldi5kYXRhID09PSB2YWx1ZSkgbm9ybWFsaXplZC5wdXNoKHByZXYpO2Vsc2Ugbm9ybWFsaXplZC5wdXNoKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZhbHVlKSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBkeW5hbWljO1xufVxuZnVuY3Rpb24gYXBwZW5kTm9kZXMocGFyZW50LCBhcnJheSwgbWFya2VyID0gbnVsbCkge1xuICBmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHBhcmVudC5pbnNlcnRCZWZvcmUoYXJyYXlbaV0sIG1hcmtlcik7XG59XG5mdW5jdGlvbiBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCByZXBsYWNlbWVudCkge1xuICBpZiAobWFya2VyID09PSB1bmRlZmluZWQpIHJldHVybiBwYXJlbnQudGV4dENvbnRlbnQgPSBcIlwiO1xuICBjb25zdCBub2RlID0gcmVwbGFjZW1lbnQgfHwgZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcIik7XG4gIGlmIChjdXJyZW50Lmxlbmd0aCkge1xuICAgIGxldCBpbnNlcnRlZCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSBjdXJyZW50Lmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBlbCA9IGN1cnJlbnRbaV07XG4gICAgICBpZiAobm9kZSAhPT0gZWwpIHtcbiAgICAgICAgY29uc3QgaXNQYXJlbnQgPSBlbC5wYXJlbnROb2RlID09PSBwYXJlbnQ7XG4gICAgICAgIGlmICghaW5zZXJ0ZWQgJiYgIWkpIGlzUGFyZW50ID8gcGFyZW50LnJlcGxhY2VDaGlsZChub2RlLCBlbCkgOiBwYXJlbnQuaW5zZXJ0QmVmb3JlKG5vZGUsIG1hcmtlcik7ZWxzZSBpc1BhcmVudCAmJiBlbC5yZW1vdmUoKTtcbiAgICAgIH0gZWxzZSBpbnNlcnRlZCA9IHRydWU7XG4gICAgfVxuICB9IGVsc2UgcGFyZW50Lmluc2VydEJlZm9yZShub2RlLCBtYXJrZXIpO1xuICByZXR1cm4gW25vZGVdO1xufVxuZnVuY3Rpb24gZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCByb290KSB7XG4gIGNvbnN0IHRlbXBsYXRlcyA9IGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChgKltkYXRhLWhrXWApO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHRlbXBsYXRlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IG5vZGUgPSB0ZW1wbGF0ZXNbaV07XG4gICAgY29uc3Qga2V5ID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCJkYXRhLWhrXCIpO1xuICAgIGlmICgoIXJvb3QgfHwga2V5LnN0YXJ0c1dpdGgocm9vdCkpICYmICFzaGFyZWRDb25maWcucmVnaXN0cnkuaGFzKGtleSkpIHNoYXJlZENvbmZpZy5yZWdpc3RyeS5zZXQoa2V5LCBub2RlKTtcbiAgfVxufVxuZnVuY3Rpb24gZ2V0SHlkcmF0aW9uS2V5KCkge1xuICByZXR1cm4gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKTtcbn1cbmZ1bmN0aW9uIE5vSHlkcmF0aW9uKHByb3BzKSB7XG4gIHJldHVybiBzaGFyZWRDb25maWcuY29udGV4dCA/IHVuZGVmaW5lZCA6IHByb3BzLmNoaWxkcmVuO1xufVxuZnVuY3Rpb24gSHlkcmF0aW9uKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcy5jaGlsZHJlbjtcbn1cbmNvbnN0IHZvaWRGbiA9ICgpID0+IHVuZGVmaW5lZDtcbmNvbnN0IFJlcXVlc3RDb250ZXh0ID0gU3ltYm9sKCk7XG5mdW5jdGlvbiBpbm5lckhUTUwocGFyZW50LCBjb250ZW50KSB7XG4gICFzaGFyZWRDb25maWcuY29udGV4dCAmJiAocGFyZW50LmlubmVySFRNTCA9IGNvbnRlbnQpO1xufVxuXG5mdW5jdGlvbiB0aHJvd0luQnJvd3NlcihmdW5jKSB7XG4gIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgJHtmdW5jLm5hbWV9IGlzIG5vdCBzdXBwb3J0ZWQgaW4gdGhlIGJyb3dzZXIsIHJldHVybmluZyB1bmRlZmluZWRgKTtcbiAgY29uc29sZS5lcnJvcihlcnIpO1xufVxuZnVuY3Rpb24gcmVuZGVyVG9TdHJpbmcoZm4sIG9wdGlvbnMpIHtcbiAgdGhyb3dJbkJyb3dzZXIocmVuZGVyVG9TdHJpbmcpO1xufVxuZnVuY3Rpb24gcmVuZGVyVG9TdHJpbmdBc3luYyhmbiwgb3B0aW9ucykge1xuICB0aHJvd0luQnJvd3NlcihyZW5kZXJUb1N0cmluZ0FzeW5jKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyZWFtKGZuLCBvcHRpb25zKSB7XG4gIHRocm93SW5Ccm93c2VyKHJlbmRlclRvU3RyZWFtKTtcbn1cbmZ1bmN0aW9uIHNzcih0ZW1wbGF0ZSwgLi4ubm9kZXMpIHt9XG5mdW5jdGlvbiBzc3JFbGVtZW50KG5hbWUsIHByb3BzLCBjaGlsZHJlbiwgbmVlZHNJZCkge31cbmZ1bmN0aW9uIHNzckNsYXNzTGlzdCh2YWx1ZSkge31cbmZ1bmN0aW9uIHNzclN0eWxlKHZhbHVlKSB7fVxuZnVuY3Rpb24gc3NyQXR0cmlidXRlKGtleSwgdmFsdWUpIHt9XG5mdW5jdGlvbiBzc3JIeWRyYXRpb25LZXkoKSB7fVxuZnVuY3Rpb24gcmVzb2x2ZVNTUk5vZGUobm9kZSkge31cbmZ1bmN0aW9uIGVzY2FwZShodG1sKSB7fVxuZnVuY3Rpb24gc3NyU3ByZWFkKHByb3BzLCBpc1NWRywgc2tpcENoaWxkcmVuKSB7fVxuXG5jb25zdCBpc1NlcnZlciA9IGZhbHNlO1xuY29uc3QgaXNEZXYgPSB0cnVlO1xuY29uc3QgU1ZHX05BTUVTUEFDRSA9IFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIjtcbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQodGFnTmFtZSwgaXNTVkcgPSBmYWxzZSkge1xuICByZXR1cm4gaXNTVkcgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoU1ZHX05BTUVTUEFDRSwgdGFnTmFtZSkgOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xufVxuY29uc3QgaHlkcmF0ZSA9ICguLi5hcmdzKSA9PiB7XG4gIGVuYWJsZUh5ZHJhdGlvbigpO1xuICByZXR1cm4gaHlkcmF0ZSQxKC4uLmFyZ3MpO1xufTtcbmZ1bmN0aW9uIFBvcnRhbChwcm9wcykge1xuICBjb25zdCB7XG4gICAgICB1c2VTaGFkb3dcbiAgICB9ID0gcHJvcHMsXG4gICAgbWFya2VyID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcIiksXG4gICAgbW91bnQgPSAoKSA9PiBwcm9wcy5tb3VudCB8fCBkb2N1bWVudC5ib2R5LFxuICAgIG93bmVyID0gZ2V0T3duZXIoKTtcbiAgbGV0IGNvbnRlbnQ7XG4gIGxldCBoeWRyYXRpbmcgPSAhIXNoYXJlZENvbmZpZy5jb250ZXh0O1xuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChoeWRyYXRpbmcpIGdldE93bmVyKCkudXNlciA9IGh5ZHJhdGluZyA9IGZhbHNlO1xuICAgIGNvbnRlbnQgfHwgKGNvbnRlbnQgPSBydW5XaXRoT3duZXIob3duZXIsICgpID0+IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMuY2hpbGRyZW4pKSk7XG4gICAgY29uc3QgZWwgPSBtb3VudCgpO1xuICAgIGlmIChlbCBpbnN0YW5jZW9mIEhUTUxIZWFkRWxlbWVudCkge1xuICAgICAgY29uc3QgW2NsZWFuLCBzZXRDbGVhbl0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICAgICAgY29uc3QgY2xlYW51cCA9ICgpID0+IHNldENsZWFuKHRydWUpO1xuICAgICAgY3JlYXRlUm9vdChkaXNwb3NlID0+IGluc2VydChlbCwgKCkgPT4gIWNsZWFuKCkgPyBjb250ZW50KCkgOiBkaXNwb3NlKCksIG51bGwpKTtcbiAgICAgIG9uQ2xlYW51cChjbGVhbnVwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgY29udGFpbmVyID0gY3JlYXRlRWxlbWVudChwcm9wcy5pc1NWRyA/IFwiZ1wiIDogXCJkaXZcIiwgcHJvcHMuaXNTVkcpLFxuICAgICAgICByZW5kZXJSb290ID0gdXNlU2hhZG93ICYmIGNvbnRhaW5lci5hdHRhY2hTaGFkb3cgPyBjb250YWluZXIuYXR0YWNoU2hhZG93KHtcbiAgICAgICAgICBtb2RlOiBcIm9wZW5cIlxuICAgICAgICB9KSA6IGNvbnRhaW5lcjtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb250YWluZXIsIFwiXyRob3N0XCIsIHtcbiAgICAgICAgZ2V0KCkge1xuICAgICAgICAgIHJldHVybiBtYXJrZXIucGFyZW50Tm9kZTtcbiAgICAgICAgfSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIGluc2VydChyZW5kZXJSb290LCBjb250ZW50KTtcbiAgICAgIGVsLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG4gICAgICBwcm9wcy5yZWYgJiYgcHJvcHMucmVmKGNvbnRhaW5lcik7XG4gICAgICBvbkNsZWFudXAoKCkgPT4gZWwucmVtb3ZlQ2hpbGQoY29udGFpbmVyKSk7XG4gICAgfVxuICB9LCB1bmRlZmluZWQsIHtcbiAgICByZW5kZXI6ICFoeWRyYXRpbmdcbiAgfSk7XG4gIHJldHVybiBtYXJrZXI7XG59XG5mdW5jdGlvbiBjcmVhdGVEeW5hbWljKGNvbXBvbmVudCwgcHJvcHMpIHtcbiAgY29uc3QgY2FjaGVkID0gY3JlYXRlTWVtbyhjb21wb25lbnQpO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgY29tcG9uZW50ID0gY2FjaGVkKCk7XG4gICAgc3dpdGNoICh0eXBlb2YgY29tcG9uZW50KSB7XG4gICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgICAgT2JqZWN0LmFzc2lnbihjb21wb25lbnQsIHtcbiAgICAgICAgICBbJERFVkNPTVBdOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdW50cmFjaygoKSA9PiBjb21wb25lbnQocHJvcHMpKTtcbiAgICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgICAgY29uc3QgaXNTdmcgPSBTVkdFbGVtZW50cy5oYXMoY29tcG9uZW50KTtcbiAgICAgICAgY29uc3QgZWwgPSBzaGFyZWRDb25maWcuY29udGV4dCA/IGdldE5leHRFbGVtZW50KCkgOiBjcmVhdGVFbGVtZW50KGNvbXBvbmVudCwgaXNTdmcpO1xuICAgICAgICBzcHJlYWQoZWwsIHByb3BzLCBpc1N2Zyk7XG4gICAgICAgIHJldHVybiBlbDtcbiAgICB9XG4gIH0pO1xufVxuZnVuY3Rpb24gRHluYW1pYyhwcm9wcykge1xuICBjb25zdCBbLCBvdGhlcnNdID0gc3BsaXRQcm9wcyhwcm9wcywgW1wiY29tcG9uZW50XCJdKTtcbiAgcmV0dXJuIGNyZWF0ZUR5bmFtaWMoKCkgPT4gcHJvcHMuY29tcG9uZW50LCBvdGhlcnMpO1xufVxuXG5leHBvcnQgeyBBbGlhc2VzLCB2b2lkRm4gYXMgQXNzZXRzLCBDaGlsZFByb3BlcnRpZXMsIERPTUVsZW1lbnRzLCBEZWxlZ2F0ZWRFdmVudHMsIER5bmFtaWMsIEh5ZHJhdGlvbiwgdm9pZEZuIGFzIEh5ZHJhdGlvblNjcmlwdCwgTm9IeWRyYXRpb24sIFBvcnRhbCwgUHJvcGVydGllcywgUmVxdWVzdENvbnRleHQsIFNWR0VsZW1lbnRzLCBTVkdOYW1lc3BhY2UsIGFkZEV2ZW50TGlzdGVuZXIsIGFzc2lnbiwgY2xhc3NMaXN0LCBjbGFzc05hbWUsIGNsZWFyRGVsZWdhdGVkRXZlbnRzLCBjcmVhdGVEeW5hbWljLCBkZWxlZ2F0ZUV2ZW50cywgZHluYW1pY1Byb3BlcnR5LCBlc2NhcGUsIHZvaWRGbiBhcyBnZW5lcmF0ZUh5ZHJhdGlvblNjcmlwdCwgdm9pZEZuIGFzIGdldEFzc2V0cywgZ2V0SHlkcmF0aW9uS2V5LCBnZXROZXh0RWxlbWVudCwgZ2V0TmV4dE1hcmtlciwgZ2V0TmV4dE1hdGNoLCBnZXRQcm9wQWxpYXMsIHZvaWRGbiBhcyBnZXRSZXF1ZXN0RXZlbnQsIGh5ZHJhdGUsIGlubmVySFRNTCwgaW5zZXJ0LCBpc0RldiwgaXNTZXJ2ZXIsIG1lbW8sIHJlbmRlciwgcmVuZGVyVG9TdHJlYW0sIHJlbmRlclRvU3RyaW5nLCByZW5kZXJUb1N0cmluZ0FzeW5jLCByZXNvbHZlU1NSTm9kZSwgcnVuSHlkcmF0aW9uRXZlbnRzLCBzZXRBdHRyaWJ1dGUsIHNldEF0dHJpYnV0ZU5TLCBzZXRCb29sQXR0cmlidXRlLCBzZXRQcm9wZXJ0eSwgc3ByZWFkLCBzc3IsIHNzckF0dHJpYnV0ZSwgc3NyQ2xhc3NMaXN0LCBzc3JFbGVtZW50LCBzc3JIeWRyYXRpb25LZXksIHNzclNwcmVhZCwgc3NyU3R5bGUsIHN0eWxlLCB0ZW1wbGF0ZSwgdXNlLCB2b2lkRm4gYXMgdXNlQXNzZXRzIH07XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCIvLyBHZW5lcmF0ZWQgdXNpbmcgYG5wbSBydW4gYnVpbGRgLiBEbyBub3QgZWRpdC5cblxudmFyIHJlZ2V4ID0gL15bYS16XSg/OltcXC4wLTlfYS16XFx4QjdcXHhDMC1cXHhENlxceEQ4LVxceEY2XFx4RjgtXFx1MDM3RFxcdTAzN0YtXFx1MUZGRlxcdTIwMENcXHUyMDBEXFx1MjAzRlxcdTIwNDBcXHUyMDcwLVxcdTIxOEZcXHUyQzAwLVxcdTJGRUZcXHUzMDAxLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRkRdfFtcXHVEODAwLVxcdURCN0ZdW1xcdURDMDAtXFx1REZGRl0pKi0oPzpbXFx4MkRcXC4wLTlfYS16XFx4QjdcXHhDMC1cXHhENlxceEQ4LVxceEY2XFx4RjgtXFx1MDM3RFxcdTAzN0YtXFx1MUZGRlxcdTIwMENcXHUyMDBEXFx1MjAzRlxcdTIwNDBcXHUyMDcwLVxcdTIxOEZcXHUyQzAwLVxcdTJGRUZcXHUzMDAxLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRkRdfFtcXHVEODAwLVxcdURCN0ZdW1xcdURDMDAtXFx1REZGRl0pKiQvO1xuXG52YXIgaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSA9IGZ1bmN0aW9uKHN0cmluZykge1xuXHRyZXR1cm4gcmVnZXgudGVzdChzdHJpbmcpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lO1xuIiwidmFyIF9fYXN5bmMgPSAoX190aGlzLCBfX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSA9PiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgdmFyIGZ1bGZpbGxlZCA9ICh2YWx1ZSkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZWplY3QoZSk7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgcmVqZWN0ZWQgPSAodmFsdWUpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHN0ZXAoZ2VuZXJhdG9yLnRocm93KHZhbHVlKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciBzdGVwID0gKHgpID0+IHguZG9uZSA/IHJlc29sdmUoeC52YWx1ZSkgOiBQcm9taXNlLnJlc29sdmUoeC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTtcbiAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkoX190aGlzLCBfX2FyZ3VtZW50cykpLm5leHQoKSk7XG4gIH0pO1xufTtcblxuLy8gc3JjL2luZGV4LnRzXG5pbXBvcnQgaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSBmcm9tIFwiaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWVcIjtcbmZ1bmN0aW9uIGNyZWF0ZUlzb2xhdGVkRWxlbWVudChvcHRpb25zKSB7XG4gIHJldHVybiBfX2FzeW5jKHRoaXMsIG51bGwsIGZ1bmN0aW9uKiAoKSB7XG4gICAgY29uc3QgeyBuYW1lLCBtb2RlID0gXCJjbG9zZWRcIiwgY3NzLCBpc29sYXRlRXZlbnRzID0gZmFsc2UgfSA9IG9wdGlvbnM7XG4gICAgaWYgKCFpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lKG5hbWUpKSB7XG4gICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgYFwiJHtuYW1lfVwiIGlzIG5vdCBhIHZhbGlkIGN1c3RvbSBlbGVtZW50IG5hbWUuIEl0IG11c3QgYmUgdHdvIHdvcmRzIGFuZCBrZWJhYi1jYXNlLCB3aXRoIGEgZmV3IGV4Y2VwdGlvbnMuIFNlZSBzcGVjIGZvciBtb3JlIGRldGFpbHM6IGh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL2N1c3RvbS1lbGVtZW50cy5odG1sI3ZhbGlkLWN1c3RvbS1lbGVtZW50LW5hbWVgXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCBwYXJlbnRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChuYW1lKTtcbiAgICBjb25zdCBzaGFkb3cgPSBwYXJlbnRFbGVtZW50LmF0dGFjaFNoYWRvdyh7IG1vZGUgfSk7XG4gICAgY29uc3QgaXNvbGF0ZWRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImh0bWxcIik7XG4gICAgY29uc3QgYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJib2R5XCIpO1xuICAgIGNvbnN0IGhlYWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaGVhZFwiKTtcbiAgICBpZiAoY3NzKSB7XG4gICAgICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcbiAgICAgIGlmIChcInVybFwiIGluIGNzcykge1xuICAgICAgICBzdHlsZS50ZXh0Q29udGVudCA9IHlpZWxkIGZldGNoKGNzcy51cmwpLnRoZW4oKHJlcykgPT4gcmVzLnRleHQoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHlsZS50ZXh0Q29udGVudCA9IGNzcy50ZXh0Q29udGVudDtcbiAgICAgIH1cbiAgICAgIGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICAgIH1cbiAgICBpc29sYXRlZEVsZW1lbnQuYXBwZW5kQ2hpbGQoaGVhZCk7XG4gICAgaXNvbGF0ZWRFbGVtZW50LmFwcGVuZENoaWxkKGJvZHkpO1xuICAgIHNoYWRvdy5hcHBlbmRDaGlsZChpc29sYXRlZEVsZW1lbnQpO1xuICAgIGlmIChpc29sYXRlRXZlbnRzKSB7XG4gICAgICBjb25zdCBldmVudFR5cGVzID0gQXJyYXkuaXNBcnJheShpc29sYXRlRXZlbnRzKSA/IGlzb2xhdGVFdmVudHMgOiBbXCJrZXlkb3duXCIsIFwia2V5dXBcIiwgXCJrZXlwcmVzc1wiXTtcbiAgICAgIGV2ZW50VHlwZXMuZm9yRWFjaCgoZXZlbnRUeXBlKSA9PiB7XG4gICAgICAgIGJvZHkuYWRkRXZlbnRMaXN0ZW5lcihldmVudFR5cGUsIChlKSA9PiBlLnN0b3BQcm9wYWdhdGlvbigpKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgcGFyZW50RWxlbWVudCxcbiAgICAgIHNoYWRvdyxcbiAgICAgIGlzb2xhdGVkRWxlbWVudDogYm9keVxuICAgIH07XG4gIH0pO1xufVxuZXhwb3J0IHtcbiAgY3JlYXRlSXNvbGF0ZWRFbGVtZW50XG59O1xuIiwiY29uc3QgbnVsbEtleSA9IFN5bWJvbCgnbnVsbCcpOyAvLyBgb2JqZWN0SGFzaGVzYCBrZXkgZm9yIG51bGxcblxubGV0IGtleUNvdW50ZXIgPSAwO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNYW55S2V5c01hcCBleHRlbmRzIE1hcCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9vYmplY3RIYXNoZXMgPSBuZXcgV2Vha01hcCgpO1xuXHRcdHRoaXMuX3N5bWJvbEhhc2hlcyA9IG5ldyBNYXAoKTsgLy8gaHR0cHM6Ly9naXRodWIuY29tL3RjMzkvZWNtYTI2Mi9pc3N1ZXMvMTE5NFxuXHRcdHRoaXMuX3B1YmxpY0tleXMgPSBuZXcgTWFwKCk7XG5cblx0XHRjb25zdCBbcGFpcnNdID0gYXJndW1lbnRzOyAvLyBNYXAgY29tcGF0XG5cdFx0aWYgKHBhaXJzID09PSBudWxsIHx8IHBhaXJzID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHBhaXJzW1N5bWJvbC5pdGVyYXRvcl0gIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IodHlwZW9mIHBhaXJzICsgJyBpcyBub3QgaXRlcmFibGUgKGNhbm5vdCByZWFkIHByb3BlcnR5IFN5bWJvbChTeW1ib2wuaXRlcmF0b3IpKScpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgW2tleXMsIHZhbHVlXSBvZiBwYWlycykge1xuXHRcdFx0dGhpcy5zZXQoa2V5cywgdmFsdWUpO1xuXHRcdH1cblx0fVxuXG5cdF9nZXRQdWJsaWNLZXlzKGtleXMsIGNyZWF0ZSA9IGZhbHNlKSB7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGtleXMpKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUga2V5cyBwYXJhbWV0ZXIgbXVzdCBiZSBhbiBhcnJheScpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByaXZhdGVLZXkgPSB0aGlzLl9nZXRQcml2YXRlS2V5KGtleXMsIGNyZWF0ZSk7XG5cblx0XHRsZXQgcHVibGljS2V5O1xuXHRcdGlmIChwcml2YXRlS2V5ICYmIHRoaXMuX3B1YmxpY0tleXMuaGFzKHByaXZhdGVLZXkpKSB7XG5cdFx0XHRwdWJsaWNLZXkgPSB0aGlzLl9wdWJsaWNLZXlzLmdldChwcml2YXRlS2V5KTtcblx0XHR9IGVsc2UgaWYgKGNyZWF0ZSkge1xuXHRcdFx0cHVibGljS2V5ID0gWy4uLmtleXNdOyAvLyBSZWdlbmVyYXRlIGtleXMgYXJyYXkgdG8gYXZvaWQgZXh0ZXJuYWwgaW50ZXJhY3Rpb25cblx0XHRcdHRoaXMuX3B1YmxpY0tleXMuc2V0KHByaXZhdGVLZXksIHB1YmxpY0tleSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtwcml2YXRlS2V5LCBwdWJsaWNLZXl9O1xuXHR9XG5cblx0X2dldFByaXZhdGVLZXkoa2V5cywgY3JlYXRlID0gZmFsc2UpIHtcblx0XHRjb25zdCBwcml2YXRlS2V5cyA9IFtdO1xuXHRcdGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG5cdFx0XHRpZiAoa2V5ID09PSBudWxsKSB7XG5cdFx0XHRcdGtleSA9IG51bGxLZXk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGhhc2hlcyA9IHR5cGVvZiBrZXkgPT09ICdvYmplY3QnIHx8IHR5cGVvZiBrZXkgPT09ICdmdW5jdGlvbicgPyAnX29iamVjdEhhc2hlcycgOiAodHlwZW9mIGtleSA9PT0gJ3N5bWJvbCcgPyAnX3N5bWJvbEhhc2hlcycgOiBmYWxzZSk7XG5cblx0XHRcdGlmICghaGFzaGVzKSB7XG5cdFx0XHRcdHByaXZhdGVLZXlzLnB1c2goa2V5KTtcblx0XHRcdH0gZWxzZSBpZiAodGhpc1toYXNoZXNdLmhhcyhrZXkpKSB7XG5cdFx0XHRcdHByaXZhdGVLZXlzLnB1c2godGhpc1toYXNoZXNdLmdldChrZXkpKTtcblx0XHRcdH0gZWxzZSBpZiAoY3JlYXRlKSB7XG5cdFx0XHRcdGNvbnN0IHByaXZhdGVLZXkgPSBgQEBta20tcmVmLSR7a2V5Q291bnRlcisrfUBAYDtcblx0XHRcdFx0dGhpc1toYXNoZXNdLnNldChrZXksIHByaXZhdGVLZXkpO1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKHByaXZhdGVLZXkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeShwcml2YXRlS2V5cyk7XG5cdH1cblxuXHRzZXQoa2V5cywgdmFsdWUpIHtcblx0XHRjb25zdCB7cHVibGljS2V5fSA9IHRoaXMuX2dldFB1YmxpY0tleXMoa2V5cywgdHJ1ZSk7XG5cdFx0cmV0dXJuIHN1cGVyLnNldChwdWJsaWNLZXksIHZhbHVlKTtcblx0fVxuXG5cdGdldChrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBzdXBlci5nZXQocHVibGljS2V5KTtcblx0fVxuXG5cdGhhcyhrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBzdXBlci5oYXMocHVibGljS2V5KTtcblx0fVxuXG5cdGRlbGV0ZShrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleSwgcHJpdmF0ZUtleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBCb29sZWFuKHB1YmxpY0tleSAmJiBzdXBlci5kZWxldGUocHVibGljS2V5KSAmJiB0aGlzLl9wdWJsaWNLZXlzLmRlbGV0ZShwcml2YXRlS2V5KSk7XG5cdH1cblxuXHRjbGVhcigpIHtcblx0XHRzdXBlci5jbGVhcigpO1xuXHRcdHRoaXMuX3N5bWJvbEhhc2hlcy5jbGVhcigpO1xuXHRcdHRoaXMuX3B1YmxpY0tleXMuY2xlYXIoKTtcblx0fVxuXG5cdGdldCBbU3ltYm9sLnRvU3RyaW5nVGFnXSgpIHtcblx0XHRyZXR1cm4gJ01hbnlLZXlzTWFwJztcblx0fVxuXG5cdGdldCBzaXplKCkge1xuXHRcdHJldHVybiBzdXBlci5zaXplO1xuXHR9XG59XG4iLCJmdW5jdGlvbiBpc1BsYWluT2JqZWN0KHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgcHJvdG90eXBlID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKTtcbiAgaWYgKHByb3RvdHlwZSAhPT0gbnVsbCAmJiBwcm90b3R5cGUgIT09IE9iamVjdC5wcm90b3R5cGUgJiYgT2JqZWN0LmdldFByb3RvdHlwZU9mKHByb3RvdHlwZSkgIT09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKFN5bWJvbC5pdGVyYXRvciBpbiB2YWx1ZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoU3ltYm9sLnRvU3RyaW5nVGFnIGluIHZhbHVlKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT09IFwiW29iamVjdCBNb2R1bGVdXCI7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIF9kZWZ1KGJhc2VPYmplY3QsIGRlZmF1bHRzLCBuYW1lc3BhY2UgPSBcIi5cIiwgbWVyZ2VyKSB7XG4gIGlmICghaXNQbGFpbk9iamVjdChkZWZhdWx0cykpIHtcbiAgICByZXR1cm4gX2RlZnUoYmFzZU9iamVjdCwge30sIG5hbWVzcGFjZSwgbWVyZ2VyKTtcbiAgfVxuICBjb25zdCBvYmplY3QgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0cyk7XG4gIGZvciAoY29uc3Qga2V5IGluIGJhc2VPYmplY3QpIHtcbiAgICBpZiAoa2V5ID09PSBcIl9fcHJvdG9fX1wiIHx8IGtleSA9PT0gXCJjb25zdHJ1Y3RvclwiKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSBiYXNlT2JqZWN0W2tleV07XG4gICAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB2b2lkIDApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAobWVyZ2VyICYmIG1lcmdlcihvYmplY3QsIGtleSwgdmFsdWUsIG5hbWVzcGFjZSkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgQXJyYXkuaXNBcnJheShvYmplY3Rba2V5XSkpIHtcbiAgICAgIG9iamVjdFtrZXldID0gWy4uLnZhbHVlLCAuLi5vYmplY3Rba2V5XV07XG4gICAgfSBlbHNlIGlmIChpc1BsYWluT2JqZWN0KHZhbHVlKSAmJiBpc1BsYWluT2JqZWN0KG9iamVjdFtrZXldKSkge1xuICAgICAgb2JqZWN0W2tleV0gPSBfZGVmdShcbiAgICAgICAgdmFsdWUsXG4gICAgICAgIG9iamVjdFtrZXldLFxuICAgICAgICAobmFtZXNwYWNlID8gYCR7bmFtZXNwYWNlfS5gIDogXCJcIikgKyBrZXkudG9TdHJpbmcoKSxcbiAgICAgICAgbWVyZ2VyXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBvYmplY3Rba2V5XSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gb2JqZWN0O1xufVxuZnVuY3Rpb24gY3JlYXRlRGVmdShtZXJnZXIpIHtcbiAgcmV0dXJuICguLi5hcmd1bWVudHNfKSA9PiAoXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHVuaWNvcm4vbm8tYXJyYXktcmVkdWNlXG4gICAgYXJndW1lbnRzXy5yZWR1Y2UoKHAsIGMpID0+IF9kZWZ1KHAsIGMsIFwiXCIsIG1lcmdlciksIHt9KVxuICApO1xufVxuY29uc3QgZGVmdSA9IGNyZWF0ZURlZnUoKTtcbmNvbnN0IGRlZnVGbiA9IGNyZWF0ZURlZnUoKG9iamVjdCwga2V5LCBjdXJyZW50VmFsdWUpID0+IHtcbiAgaWYgKG9iamVjdFtrZXldICE9PSB2b2lkIDAgJiYgdHlwZW9mIGN1cnJlbnRWYWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgb2JqZWN0W2tleV0gPSBjdXJyZW50VmFsdWUob2JqZWN0W2tleV0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59KTtcbmNvbnN0IGRlZnVBcnJheUZuID0gY3JlYXRlRGVmdSgob2JqZWN0LCBrZXksIGN1cnJlbnRWYWx1ZSkgPT4ge1xuICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3Rba2V5XSkgJiYgdHlwZW9mIGN1cnJlbnRWYWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgb2JqZWN0W2tleV0gPSBjdXJyZW50VmFsdWUob2JqZWN0W2tleV0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59KTtcblxuZXhwb3J0IHsgY3JlYXRlRGVmdSwgZGVmdSBhcyBkZWZhdWx0LCBkZWZ1LCBkZWZ1QXJyYXlGbiwgZGVmdUZuIH07XG4iLCJjb25zdCBpc0V4aXN0ID0gKGVsZW1lbnQpID0+IHtcbiAgcmV0dXJuIGVsZW1lbnQgIT09IG51bGwgPyB7IGlzRGV0ZWN0ZWQ6IHRydWUsIHJlc3VsdDogZWxlbWVudCB9IDogeyBpc0RldGVjdGVkOiBmYWxzZSB9O1xufTtcbmNvbnN0IGlzTm90RXhpc3QgPSAoZWxlbWVudCkgPT4ge1xuICByZXR1cm4gZWxlbWVudCA9PT0gbnVsbCA/IHsgaXNEZXRlY3RlZDogdHJ1ZSwgcmVzdWx0OiBudWxsIH0gOiB7IGlzRGV0ZWN0ZWQ6IGZhbHNlIH07XG59O1xuXG5leHBvcnQgeyBpc0V4aXN0LCBpc05vdEV4aXN0IH07XG4iLCJpbXBvcnQgTWFueUtleXNNYXAgZnJvbSAnbWFueS1rZXlzLW1hcCc7XG5pbXBvcnQgeyBkZWZ1IH0gZnJvbSAnZGVmdSc7XG5pbXBvcnQgeyBpc0V4aXN0IH0gZnJvbSAnLi9kZXRlY3RvcnMubWpzJztcblxuY29uc3QgZ2V0RGVmYXVsdE9wdGlvbnMgPSAoKSA9PiAoe1xuICB0YXJnZXQ6IGdsb2JhbFRoaXMuZG9jdW1lbnQsXG4gIHVuaWZ5UHJvY2VzczogdHJ1ZSxcbiAgZGV0ZWN0b3I6IGlzRXhpc3QsXG4gIG9ic2VydmVDb25maWdzOiB7XG4gICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgIHN1YnRyZWU6IHRydWUsXG4gICAgYXR0cmlidXRlczogdHJ1ZVxuICB9LFxuICBzaWduYWw6IHZvaWQgMCxcbiAgY3VzdG9tTWF0Y2hlcjogdm9pZCAwXG59KTtcbmNvbnN0IG1lcmdlT3B0aW9ucyA9ICh1c2VyU2lkZU9wdGlvbnMsIGRlZmF1bHRPcHRpb25zKSA9PiB7XG4gIHJldHVybiBkZWZ1KHVzZXJTaWRlT3B0aW9ucywgZGVmYXVsdE9wdGlvbnMpO1xufTtcblxuY29uc3QgdW5pZnlDYWNoZSA9IG5ldyBNYW55S2V5c01hcCgpO1xuZnVuY3Rpb24gY3JlYXRlV2FpdEVsZW1lbnQoaW5zdGFuY2VPcHRpb25zKSB7XG4gIGNvbnN0IHsgZGVmYXVsdE9wdGlvbnMgfSA9IGluc3RhbmNlT3B0aW9ucztcbiAgcmV0dXJuIChzZWxlY3Rvciwgb3B0aW9ucykgPT4ge1xuICAgIGNvbnN0IHtcbiAgICAgIHRhcmdldCxcbiAgICAgIHVuaWZ5UHJvY2VzcyxcbiAgICAgIG9ic2VydmVDb25maWdzLFxuICAgICAgZGV0ZWN0b3IsXG4gICAgICBzaWduYWwsXG4gICAgICBjdXN0b21NYXRjaGVyXG4gICAgfSA9IG1lcmdlT3B0aW9ucyhvcHRpb25zLCBkZWZhdWx0T3B0aW9ucyk7XG4gICAgY29uc3QgdW5pZnlQcm9taXNlS2V5ID0gW1xuICAgICAgc2VsZWN0b3IsXG4gICAgICB0YXJnZXQsXG4gICAgICB1bmlmeVByb2Nlc3MsXG4gICAgICBvYnNlcnZlQ29uZmlncyxcbiAgICAgIGRldGVjdG9yLFxuICAgICAgc2lnbmFsLFxuICAgICAgY3VzdG9tTWF0Y2hlclxuICAgIF07XG4gICAgY29uc3QgY2FjaGVkUHJvbWlzZSA9IHVuaWZ5Q2FjaGUuZ2V0KHVuaWZ5UHJvbWlzZUtleSk7XG4gICAgaWYgKHVuaWZ5UHJvY2VzcyAmJiBjYWNoZWRQcm9taXNlKSB7XG4gICAgICByZXR1cm4gY2FjaGVkUHJvbWlzZTtcbiAgICB9XG4gICAgY29uc3QgZGV0ZWN0UHJvbWlzZSA9IG5ldyBQcm9taXNlKFxuICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0FzeW5jUHJvbWlzZUV4ZWN1dG9yOiBhdm9pZCBuZXN0aW5nIHByb21pc2VcbiAgICAgIGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgIHJldHVybiByZWplY3Qoc2lnbmFsLnJlYXNvbik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihcbiAgICAgICAgICBhc3luYyAobXV0YXRpb25zKSA9PiB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IF8gb2YgbXV0YXRpb25zKSB7XG4gICAgICAgICAgICAgIGlmIChzaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29uc3QgZGV0ZWN0UmVzdWx0MiA9IGF3YWl0IGRldGVjdEVsZW1lbnQoe1xuICAgICAgICAgICAgICAgIHNlbGVjdG9yLFxuICAgICAgICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICAgICAgICBkZXRlY3RvcixcbiAgICAgICAgICAgICAgICBjdXN0b21NYXRjaGVyXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBpZiAoZGV0ZWN0UmVzdWx0Mi5pc0RldGVjdGVkKSB7XG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZGV0ZWN0UmVzdWx0Mi5yZXN1bHQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgICBzaWduYWw/LmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgXCJhYm9ydFwiLFxuICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHJldHVybiByZWplY3Qoc2lnbmFsLnJlYXNvbik7XG4gICAgICAgICAgfSxcbiAgICAgICAgICB7IG9uY2U6IHRydWUgfVxuICAgICAgICApO1xuICAgICAgICBjb25zdCBkZXRlY3RSZXN1bHQgPSBhd2FpdCBkZXRlY3RFbGVtZW50KHtcbiAgICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgZGV0ZWN0b3IsXG4gICAgICAgICAgY3VzdG9tTWF0Y2hlclxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGRldGVjdFJlc3VsdC5pc0RldGVjdGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoZGV0ZWN0UmVzdWx0LnJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZSh0YXJnZXQsIG9ic2VydmVDb25maWdzKTtcbiAgICAgIH1cbiAgICApLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgdW5pZnlDYWNoZS5kZWxldGUodW5pZnlQcm9taXNlS2V5KTtcbiAgICB9KTtcbiAgICB1bmlmeUNhY2hlLnNldCh1bmlmeVByb21pc2VLZXksIGRldGVjdFByb21pc2UpO1xuICAgIHJldHVybiBkZXRlY3RQcm9taXNlO1xuICB9O1xufVxuYXN5bmMgZnVuY3Rpb24gZGV0ZWN0RWxlbWVudCh7XG4gIHRhcmdldCxcbiAgc2VsZWN0b3IsXG4gIGRldGVjdG9yLFxuICBjdXN0b21NYXRjaGVyXG59KSB7XG4gIGNvbnN0IGVsZW1lbnQgPSBjdXN0b21NYXRjaGVyID8gY3VzdG9tTWF0Y2hlcihzZWxlY3RvcikgOiB0YXJnZXQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gIHJldHVybiBhd2FpdCBkZXRlY3RvcihlbGVtZW50KTtcbn1cbmNvbnN0IHdhaXRFbGVtZW50ID0gY3JlYXRlV2FpdEVsZW1lbnQoe1xuICBkZWZhdWx0T3B0aW9uczogZ2V0RGVmYXVsdE9wdGlvbnMoKVxufSk7XG5cbmV4cG9ydCB7IGNyZWF0ZVdhaXRFbGVtZW50LCBnZXREZWZhdWx0T3B0aW9ucywgd2FpdEVsZW1lbnQgfTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyB3YWl0RWxlbWVudCB9IGZyb20gXCJAMW5hdHN1L3dhaXQtZWxlbWVudFwiO1xuaW1wb3J0IHtcbiAgaXNFeGlzdCBhcyBtb3VudERldGVjdG9yLFxuICBpc05vdEV4aXN0IGFzIHJlbW92ZURldGVjdG9yXG59IGZyb20gXCJAMW5hdHN1L3dhaXQtZWxlbWVudC9kZXRlY3RvcnNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi8uLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gYXBwbHlQb3NpdGlvbihyb290LCBwb3NpdGlvbmVkRWxlbWVudCwgb3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5wb3NpdGlvbiA9PT0gXCJpbmxpbmVcIikgcmV0dXJuO1xuICBpZiAob3B0aW9ucy56SW5kZXggIT0gbnVsbCkgcm9vdC5zdHlsZS56SW5kZXggPSBTdHJpbmcob3B0aW9ucy56SW5kZXgpO1xuICByb290LnN0eWxlLm92ZXJmbG93ID0gXCJ2aXNpYmxlXCI7XG4gIHJvb3Quc3R5bGUucG9zaXRpb24gPSBcInJlbGF0aXZlXCI7XG4gIHJvb3Quc3R5bGUud2lkdGggPSBcIjBcIjtcbiAgcm9vdC5zdHlsZS5oZWlnaHQgPSBcIjBcIjtcbiAgcm9vdC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICBpZiAocG9zaXRpb25lZEVsZW1lbnQpIHtcbiAgICBpZiAob3B0aW9ucy5wb3NpdGlvbiA9PT0gXCJvdmVybGF5XCIpIHtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xuICAgICAgaWYgKG9wdGlvbnMuYWxpZ25tZW50Py5zdGFydHNXaXRoKFwiYm90dG9tLVwiKSlcbiAgICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUuYm90dG9tID0gXCIwXCI7XG4gICAgICBlbHNlIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiO1xuICAgICAgaWYgKG9wdGlvbnMuYWxpZ25tZW50Py5lbmRzV2l0aChcIi1yaWdodFwiKSlcbiAgICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIjtcbiAgICAgIGVsc2UgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUubGVmdCA9IFwiMFwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUuYm90dG9tID0gXCIwXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5sZWZ0ID0gXCIwXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMFwiO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIGdldEFuY2hvcihvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zLmFuY2hvciA9PSBudWxsKSByZXR1cm4gZG9jdW1lbnQuYm9keTtcbiAgbGV0IHJlc29sdmVkID0gdHlwZW9mIG9wdGlvbnMuYW5jaG9yID09PSBcImZ1bmN0aW9uXCIgPyBvcHRpb25zLmFuY2hvcigpIDogb3B0aW9ucy5hbmNob3I7XG4gIGlmICh0eXBlb2YgcmVzb2x2ZWQgPT09IFwic3RyaW5nXCIpIHtcbiAgICBpZiAocmVzb2x2ZWQuc3RhcnRzV2l0aChcIi9cIikpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGRvY3VtZW50LmV2YWx1YXRlKFxuICAgICAgICByZXNvbHZlZCxcbiAgICAgICAgZG9jdW1lbnQsXG4gICAgICAgIG51bGwsXG4gICAgICAgIFhQYXRoUmVzdWx0LkZJUlNUX09SREVSRURfTk9ERV9UWVBFLFxuICAgICAgICBudWxsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlc3VsdC5zaW5nbGVOb2RlVmFsdWUgPz8gdm9pZCAwO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihyZXNvbHZlZCkgPz8gdm9pZCAwO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzb2x2ZWQgPz8gdm9pZCAwO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG1vdW50VWkocm9vdCwgb3B0aW9ucykge1xuICBjb25zdCBhbmNob3IgPSBnZXRBbmNob3Iob3B0aW9ucyk7XG4gIGlmIChhbmNob3IgPT0gbnVsbClcbiAgICB0aHJvdyBFcnJvcihcbiAgICAgIFwiRmFpbGVkIHRvIG1vdW50IGNvbnRlbnQgc2NyaXB0IFVJOiBjb3VsZCBub3QgZmluZCBhbmNob3IgZWxlbWVudFwiXG4gICAgKTtcbiAgc3dpdGNoIChvcHRpb25zLmFwcGVuZCkge1xuICAgIGNhc2Ugdm9pZCAwOlxuICAgIGNhc2UgXCJsYXN0XCI6XG4gICAgICBhbmNob3IuYXBwZW5kKHJvb3QpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImZpcnN0XCI6XG4gICAgICBhbmNob3IucHJlcGVuZChyb290KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJyZXBsYWNlXCI6XG4gICAgICBhbmNob3IucmVwbGFjZVdpdGgocm9vdCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiYWZ0ZXJcIjpcbiAgICAgIGFuY2hvci5wYXJlbnRFbGVtZW50Py5pbnNlcnRCZWZvcmUocm9vdCwgYW5jaG9yLm5leHRFbGVtZW50U2libGluZyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiYmVmb3JlXCI6XG4gICAgICBhbmNob3IucGFyZW50RWxlbWVudD8uaW5zZXJ0QmVmb3JlKHJvb3QsIGFuY2hvcik7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgb3B0aW9ucy5hcHBlbmQoYW5jaG9yLCByb290KTtcbiAgICAgIGJyZWFrO1xuICB9XG59XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTW91bnRGdW5jdGlvbnMoYmFzZUZ1bmN0aW9ucywgb3B0aW9ucykge1xuICBsZXQgYXV0b01vdW50SW5zdGFuY2UgPSB2b2lkIDA7XG4gIGNvbnN0IHN0b3BBdXRvTW91bnQgPSAoKSA9PiB7XG4gICAgYXV0b01vdW50SW5zdGFuY2U/LnN0b3BBdXRvTW91bnQoKTtcbiAgICBhdXRvTW91bnRJbnN0YW5jZSA9IHZvaWQgMDtcbiAgfTtcbiAgY29uc3QgbW91bnQgPSAoKSA9PiB7XG4gICAgYmFzZUZ1bmN0aW9ucy5tb3VudCgpO1xuICB9O1xuICBjb25zdCB1bm1vdW50ID0gYmFzZUZ1bmN0aW9ucy5yZW1vdmU7XG4gIGNvbnN0IHJlbW92ZSA9ICgpID0+IHtcbiAgICBzdG9wQXV0b01vdW50KCk7XG4gICAgYmFzZUZ1bmN0aW9ucy5yZW1vdmUoKTtcbiAgfTtcbiAgY29uc3QgYXV0b01vdW50ID0gKGF1dG9Nb3VudE9wdGlvbnMpID0+IHtcbiAgICBpZiAoYXV0b01vdW50SW5zdGFuY2UpIHtcbiAgICAgIGxvZ2dlci53YXJuKFwiYXV0b01vdW50IGlzIGFscmVhZHkgc2V0LlwiKTtcbiAgICB9XG4gICAgYXV0b01vdW50SW5zdGFuY2UgPSBhdXRvTW91bnRVaShcbiAgICAgIHsgbW91bnQsIHVubW91bnQsIHN0b3BBdXRvTW91bnQgfSxcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgLi4uYXV0b01vdW50T3B0aW9uc1xuICAgICAgfVxuICAgICk7XG4gIH07XG4gIHJldHVybiB7XG4gICAgbW91bnQsXG4gICAgcmVtb3ZlLFxuICAgIGF1dG9Nb3VudFxuICB9O1xufVxuZnVuY3Rpb24gYXV0b01vdW50VWkodWlDYWxsYmFja3MsIG9wdGlvbnMpIHtcbiAgY29uc3QgYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBjb25zdCBFWFBMSUNJVF9TVE9QX1JFQVNPTiA9IFwiZXhwbGljaXRfc3RvcF9hdXRvX21vdW50XCI7XG4gIGNvbnN0IF9zdG9wQXV0b01vdW50ID0gKCkgPT4ge1xuICAgIGFib3J0Q29udHJvbGxlci5hYm9ydChFWFBMSUNJVF9TVE9QX1JFQVNPTik7XG4gICAgb3B0aW9ucy5vblN0b3A/LigpO1xuICB9O1xuICBsZXQgcmVzb2x2ZWRBbmNob3IgPSB0eXBlb2Ygb3B0aW9ucy5hbmNob3IgPT09IFwiZnVuY3Rpb25cIiA/IG9wdGlvbnMuYW5jaG9yKCkgOiBvcHRpb25zLmFuY2hvcjtcbiAgaWYgKHJlc29sdmVkQW5jaG9yIGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgIHRocm93IEVycm9yKFxuICAgICAgXCJhdXRvTW91bnQgYW5kIEVsZW1lbnQgYW5jaG9yIG9wdGlvbiBjYW5ub3QgYmUgY29tYmluZWQuIEF2b2lkIHBhc3NpbmcgYEVsZW1lbnRgIGRpcmVjdGx5IG9yIGAoKSA9PiBFbGVtZW50YCB0byB0aGUgYW5jaG9yLlwiXG4gICAgKTtcbiAgfVxuICBhc3luYyBmdW5jdGlvbiBvYnNlcnZlRWxlbWVudChzZWxlY3Rvcikge1xuICAgIGxldCBpc0FuY2hvckV4aXN0ID0gISFnZXRBbmNob3Iob3B0aW9ucyk7XG4gICAgaWYgKGlzQW5jaG9yRXhpc3QpIHtcbiAgICAgIHVpQ2FsbGJhY2tzLm1vdW50KCk7XG4gICAgfVxuICAgIHdoaWxlICghYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjaGFuZ2VkQW5jaG9yID0gYXdhaXQgd2FpdEVsZW1lbnQoc2VsZWN0b3IgPz8gXCJib2R5XCIsIHtcbiAgICAgICAgICBjdXN0b21NYXRjaGVyOiAoKSA9PiBnZXRBbmNob3Iob3B0aW9ucykgPz8gbnVsbCxcbiAgICAgICAgICBkZXRlY3RvcjogaXNBbmNob3JFeGlzdCA/IHJlbW92ZURldGVjdG9yIDogbW91bnREZXRlY3RvcixcbiAgICAgICAgICBzaWduYWw6IGFib3J0Q29udHJvbGxlci5zaWduYWxcbiAgICAgICAgfSk7XG4gICAgICAgIGlzQW5jaG9yRXhpc3QgPSAhIWNoYW5nZWRBbmNob3I7XG4gICAgICAgIGlmIChpc0FuY2hvckV4aXN0KSB7XG4gICAgICAgICAgdWlDYWxsYmFja3MubW91bnQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB1aUNhbGxiYWNrcy51bm1vdW50KCk7XG4gICAgICAgICAgaWYgKG9wdGlvbnMub25jZSkge1xuICAgICAgICAgICAgdWlDYWxsYmFja3Muc3RvcEF1dG9Nb3VudCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgaWYgKGFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCAmJiBhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlYXNvbiA9PT0gRVhQTElDSVRfU1RPUF9SRUFTT04pIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBvYnNlcnZlRWxlbWVudChyZXNvbHZlZEFuY2hvcik7XG4gIHJldHVybiB7IHN0b3BBdXRvTW91bnQ6IF9zdG9wQXV0b01vdW50IH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gc3BsaXRTaGFkb3dSb290Q3NzKGNzcykge1xuICBsZXQgc2hhZG93Q3NzID0gY3NzO1xuICBsZXQgZG9jdW1lbnRDc3MgPSBcIlwiO1xuICBjb25zdCBydWxlc1JlZ2V4ID0gLyhcXHMqQChwcm9wZXJ0eXxmb250LWZhY2UpW1xcc1xcU10qP3tbXFxzXFxTXSo/fSkvZ207XG4gIGxldCBtYXRjaDtcbiAgd2hpbGUgKChtYXRjaCA9IHJ1bGVzUmVnZXguZXhlYyhjc3MpKSAhPT0gbnVsbCkge1xuICAgIGRvY3VtZW50Q3NzICs9IG1hdGNoWzFdO1xuICAgIHNoYWRvd0NzcyA9IHNoYWRvd0Nzcy5yZXBsYWNlKG1hdGNoWzFdLCBcIlwiKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIGRvY3VtZW50Q3NzOiBkb2N1bWVudENzcy50cmltKCksXG4gICAgc2hhZG93Q3NzOiBzaGFkb3dDc3MudHJpbSgpXG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBjcmVhdGVJc29sYXRlZEVsZW1lbnQgfSBmcm9tIFwiQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnRcIjtcbmltcG9ydCB7IGFwcGx5UG9zaXRpb24sIGNyZWF0ZU1vdW50RnVuY3Rpb25zLCBtb3VudFVpIH0gZnJvbSBcIi4vc2hhcmVkLm1qc1wiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7IHNwbGl0U2hhZG93Um9vdENzcyB9IGZyb20gXCIuLi9zcGxpdC1zaGFkb3ctcm9vdC1jc3MubWpzXCI7XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlU2hhZG93Um9vdFVpKGN0eCwgb3B0aW9ucykge1xuICBjb25zdCBpbnN0YW5jZUlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDIsIDE1KTtcbiAgY29uc3QgY3NzID0gW107XG4gIGlmICghb3B0aW9ucy5pbmhlcml0U3R5bGVzKSB7XG4gICAgY3NzLnB1c2goYC8qIFdYVCBTaGFkb3cgUm9vdCBSZXNldCAqLyA6aG9zdHthbGw6aW5pdGlhbCAhaW1wb3J0YW50O31gKTtcbiAgfVxuICBpZiAob3B0aW9ucy5jc3MpIHtcbiAgICBjc3MucHVzaChvcHRpb25zLmNzcyk7XG4gIH1cbiAgaWYgKGN0eC5vcHRpb25zPy5jc3NJbmplY3Rpb25Nb2RlID09PSBcInVpXCIpIHtcbiAgICBjb25zdCBlbnRyeUNzcyA9IGF3YWl0IGxvYWRDc3MoKTtcbiAgICBjc3MucHVzaChlbnRyeUNzcy5yZXBsYWNlQWxsKFwiOnJvb3RcIiwgXCI6aG9zdFwiKSk7XG4gIH1cbiAgY29uc3QgeyBzaGFkb3dDc3MsIGRvY3VtZW50Q3NzIH0gPSBzcGxpdFNoYWRvd1Jvb3RDc3MoY3NzLmpvaW4oXCJcXG5cIikudHJpbSgpKTtcbiAgY29uc3Qge1xuICAgIGlzb2xhdGVkRWxlbWVudDogdWlDb250YWluZXIsXG4gICAgcGFyZW50RWxlbWVudDogc2hhZG93SG9zdCxcbiAgICBzaGFkb3dcbiAgfSA9IGF3YWl0IGNyZWF0ZUlzb2xhdGVkRWxlbWVudCh7XG4gICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgIGNzczoge1xuICAgICAgdGV4dENvbnRlbnQ6IHNoYWRvd0Nzc1xuICAgIH0sXG4gICAgbW9kZTogb3B0aW9ucy5tb2RlID8/IFwib3BlblwiLFxuICAgIGlzb2xhdGVFdmVudHM6IG9wdGlvbnMuaXNvbGF0ZUV2ZW50c1xuICB9KTtcbiAgc2hhZG93SG9zdC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXd4dC1zaGFkb3ctcm9vdFwiLCBcIlwiKTtcbiAgbGV0IG1vdW50ZWQ7XG4gIGNvbnN0IG1vdW50ID0gKCkgPT4ge1xuICAgIG1vdW50VWkoc2hhZG93SG9zdCwgb3B0aW9ucyk7XG4gICAgYXBwbHlQb3NpdGlvbihzaGFkb3dIb3N0LCBzaGFkb3cucXVlcnlTZWxlY3RvcihcImh0bWxcIiksIG9wdGlvbnMpO1xuICAgIGlmIChkb2N1bWVudENzcyAmJiAhZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgIGBzdHlsZVt3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzPVwiJHtpbnN0YW5jZUlkfVwiXWBcbiAgICApKSB7XG4gICAgICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcbiAgICAgIHN0eWxlLnRleHRDb250ZW50ID0gZG9jdW1lbnRDc3M7XG4gICAgICBzdHlsZS5zZXRBdHRyaWJ1dGUoXCJ3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzXCIsIGluc3RhbmNlSWQpO1xuICAgICAgKGRvY3VtZW50LmhlYWQgPz8gZG9jdW1lbnQuYm9keSkuYXBwZW5kKHN0eWxlKTtcbiAgICB9XG4gICAgbW91bnRlZCA9IG9wdGlvbnMub25Nb3VudCh1aUNvbnRhaW5lciwgc2hhZG93LCBzaGFkb3dIb3N0KTtcbiAgfTtcbiAgY29uc3QgcmVtb3ZlID0gKCkgPT4ge1xuICAgIG9wdGlvbnMub25SZW1vdmU/Lihtb3VudGVkKTtcbiAgICBzaGFkb3dIb3N0LnJlbW92ZSgpO1xuICAgIGNvbnN0IGRvY3VtZW50U3R5bGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFxuICAgICAgYHN0eWxlW3d4dC1zaGFkb3ctcm9vdC1kb2N1bWVudC1zdHlsZXM9XCIke2luc3RhbmNlSWR9XCJdYFxuICAgICk7XG4gICAgZG9jdW1lbnRTdHlsZT8ucmVtb3ZlKCk7XG4gICAgd2hpbGUgKHVpQ29udGFpbmVyLmxhc3RDaGlsZClcbiAgICAgIHVpQ29udGFpbmVyLnJlbW92ZUNoaWxkKHVpQ29udGFpbmVyLmxhc3RDaGlsZCk7XG4gICAgbW91bnRlZCA9IHZvaWQgMDtcbiAgfTtcbiAgY29uc3QgbW91bnRGdW5jdGlvbnMgPSBjcmVhdGVNb3VudEZ1bmN0aW9ucyhcbiAgICB7XG4gICAgICBtb3VudCxcbiAgICAgIHJlbW92ZVxuICAgIH0sXG4gICAgb3B0aW9uc1xuICApO1xuICBjdHgub25JbnZhbGlkYXRlZChyZW1vdmUpO1xuICByZXR1cm4ge1xuICAgIHNoYWRvdyxcbiAgICBzaGFkb3dIb3N0LFxuICAgIHVpQ29udGFpbmVyLFxuICAgIC4uLm1vdW50RnVuY3Rpb25zLFxuICAgIGdldCBtb3VudGVkKCkge1xuICAgICAgcmV0dXJuIG1vdW50ZWQ7XG4gICAgfVxuICB9O1xufVxuYXN5bmMgZnVuY3Rpb24gbG9hZENzcygpIHtcbiAgY29uc3QgdXJsID0gYnJvd3Nlci5ydW50aW1lLmdldFVSTChgL2NvbnRlbnQtc2NyaXB0cy8ke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfS5jc3NgKTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwpO1xuICAgIHJldHVybiBhd2FpdCByZXMudGV4dCgpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBsb2dnZXIud2FybihcbiAgICAgIGBGYWlsZWQgdG8gbG9hZCBzdHlsZXMgQCAke3VybH0uIERpZCB5b3UgZm9yZ2V0IHRvIGltcG9ydCB0aGUgc3R5bGVzaGVldCBpbiB5b3VyIGVudHJ5cG9pbnQ/YCxcbiAgICAgIGVyclxuICAgICk7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVDb250ZW50U2NyaXB0KGRlZmluaXRpb24pIHtcbiAgcmV0dXJuIGRlZmluaXRpb247XG59XG4iLCJmdW5jdGlvbiByKGUpe3ZhciB0LGYsbj1cIlwiO2lmKFwic3RyaW5nXCI9PXR5cGVvZiBlfHxcIm51bWJlclwiPT10eXBlb2YgZSluKz1lO2Vsc2UgaWYoXCJvYmplY3RcIj09dHlwZW9mIGUpaWYoQXJyYXkuaXNBcnJheShlKSl7dmFyIG89ZS5sZW5ndGg7Zm9yKHQ9MDt0PG87dCsrKWVbdF0mJihmPXIoZVt0XSkpJiYobiYmKG4rPVwiIFwiKSxuKz1mKX1lbHNlIGZvcihmIGluIGUpZVtmXSYmKG4mJihuKz1cIiBcIiksbis9Zik7cmV0dXJuIG59ZXhwb3J0IGZ1bmN0aW9uIGNsc3goKXtmb3IodmFyIGUsdCxmPTAsbj1cIlwiLG89YXJndW1lbnRzLmxlbmd0aDtmPG87ZisrKShlPWFyZ3VtZW50c1tmXSkmJih0PXIoZSkpJiYobiYmKG4rPVwiIFwiKSxuKz10KTtyZXR1cm4gbn1leHBvcnQgZGVmYXVsdCBjbHN4OyIsImltcG9ydCB7IGNsc3gsIHR5cGUgQ2xhc3NWYWx1ZSB9IGZyb20gJ2Nsc3gnXG5cbmV4cG9ydCBmdW5jdGlvbiBjbiguLi5pbnB1dHM6IENsYXNzVmFsdWVbXSkge1xuICByZXR1cm4gY2xzeChpbnB1dHMpXG59IiwiaW1wb3J0IHsgU2hvdywgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQsIEpTWCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEhlYWRlclByb3BzIHtcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIGxvZ28/OiBKU1guRWxlbWVudDtcbiAgYWN0aW9ucz86IEpTWC5FbGVtZW50O1xuICB2YXJpYW50PzogJ2RlZmF1bHQnIHwgJ21pbmltYWwnIHwgJ3RyYW5zcGFyZW50JztcbiAgc3RpY2t5PzogYm9vbGVhbjtcbiAgc2hvd01lbnVCdXR0b24/OiBib29sZWFuO1xuICBvbk1lbnVDbGljaz86ICgpID0+IHZvaWQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgSGVhZGVyOiBDb21wb25lbnQ8SGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtpc1Njcm9sbGVkLCBzZXRJc1Njcm9sbGVkXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG5cbiAgLy8gVHJhY2sgc2Nyb2xsIHBvc2l0aW9uIGZvciBzdGlja3kgaGVhZGVyIGVmZmVjdHNcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHByb3BzLnN0aWNreSkge1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdzY3JvbGwnLCAoKSA9PiB7XG4gICAgICBzZXRJc1Njcm9sbGVkKHdpbmRvdy5zY3JvbGxZID4gMTApO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgdmFyaWFudCA9ICgpID0+IHByb3BzLnZhcmlhbnQgfHwgJ2RlZmF1bHQnO1xuXG4gIHJldHVybiAoXG4gICAgPGhlYWRlclxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAndy1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMCcsXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBWYXJpYW50c1xuICAgICAgICAgICdiZy1zdXJmYWNlIGJvcmRlci1iIGJvcmRlci1zdWJ0bGUnOiB2YXJpYW50KCkgPT09ICdkZWZhdWx0JyxcbiAgICAgICAgICAnYmctdHJhbnNwYXJlbnQnOiB2YXJpYW50KCkgPT09ICdtaW5pbWFsJyB8fCB2YXJpYW50KCkgPT09ICd0cmFuc3BhcmVudCcsXG4gICAgICAgICAgJ2JhY2tkcm9wLWJsdXItbWQgYmctc3VyZmFjZS84MCc6IHZhcmlhbnQoKSA9PT0gJ3RyYW5zcGFyZW50JyAmJiBpc1Njcm9sbGVkKCksXG4gICAgICAgICAgLy8gU3RpY2t5IGJlaGF2aW9yXG4gICAgICAgICAgJ3N0aWNreSB0b3AtMCB6LTUwJzogcHJvcHMuc3RpY2t5LFxuICAgICAgICAgICdzaGFkb3ctbGcnOiBwcm9wcy5zdGlja3kgJiYgaXNTY3JvbGxlZCgpLFxuICAgICAgICB9LFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICA8ZGl2IGNsYXNzPVwibWF4LXctc2NyZWVuLXhsIG14LWF1dG8gcHgtNCBzbTpweC02IGxnOnB4LThcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBoLTE2XCI+XG4gICAgICAgICAgey8qIExlZnQgc2VjdGlvbiAqL31cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTRcIj5cbiAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnNob3dNZW51QnV0dG9ufT5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uTWVudUNsaWNrfVxuICAgICAgICAgICAgICAgIGNsYXNzPVwicC0yIHJvdW5kZWQtbGcgaG92ZXI6YmctaGlnaGxpZ2h0IHRyYW5zaXRpb24tY29sb3JzIGxnOmhpZGRlblwiXG4gICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIk1lbnVcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPHN2ZyBjbGFzcz1cInctNiBoLTZcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIj5cbiAgICAgICAgICAgICAgICAgIDxwYXRoIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiIHN0cm9rZS13aWR0aD1cIjJcIiBkPVwiTTQgNmgxNk00IDEyaDE2TTQgMThoMTZcIiAvPlxuICAgICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMubG9nb30gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy50aXRsZX0+XG4gICAgICAgICAgICAgICAgPGgxIGNsYXNzPVwidGV4dC14bCBmb250LWJvbGQgdGV4dC1wcmltYXJ5XCI+e3Byb3BzLnRpdGxlfTwvaDE+XG4gICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgIHtwcm9wcy5sb2dvfVxuICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgey8qIFJpZ2h0IHNlY3Rpb24gKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuYWN0aW9uc30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAge3Byb3BzLmFjdGlvbnN9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9oZWFkZXI+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2NvcmVQYW5lbFByb3BzIHtcbiAgc2NvcmU6IG51bWJlciB8IG51bGw7XG4gIHJhbms6IG51bWJlciB8IG51bGw7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgU2NvcmVQYW5lbDogQ29tcG9uZW50PFNjb3JlUGFuZWxQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZ3JpZCBncmlkLWNvbHMtWzFmcl8xZnJdIGdhcC0yIHAtNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogU2NvcmUgQm94ICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2Ugcm91bmRlZC1sZyBwLTQgZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgbWluLWgtWzgwcHhdXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTJ4bCBmb250LW1vbm8gZm9udC1ib2xkIHRleHQtcHVycGxlLTUwMFwiPlxuICAgICAgICAgIHtwcm9wcy5zY29yZSAhPT0gbnVsbCA/IHByb3BzLnNjb3JlIDogJ+KAlCd9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+XG4gICAgICAgICAgU2NvcmVcbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgey8qIFJhbmsgQm94ICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2Ugcm91bmRlZC1sZyBwLTQgZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgbWluLWgtWzgwcHhdXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTJ4bCBmb250LW1vbm8gZm9udC1ib2xkIHRleHQtcGluay01MDBcIj5cbiAgICAgICAgICB7cHJvcHMucmFuayAhPT0gbnVsbCA/IHByb3BzLnJhbmsgOiAn4oCUJ31cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtc2Vjb25kYXJ5IG10LTFcIj5cbiAgICAgICAgICBSYW5rXG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3csIHNwbGl0UHJvcHMgfSBmcm9tICdzb2xpZC1qcydcbmltcG9ydCB0eXBlIHsgSlNYIH0gZnJvbSAnc29saWQtanMnXG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJ1xuXG5leHBvcnQgaW50ZXJmYWNlIEJ1dHRvblByb3BzIGV4dGVuZHMgSlNYLkJ1dHRvbkhUTUxBdHRyaWJ1dGVzPEhUTUxCdXR0b25FbGVtZW50PiB7XG4gIHZhcmlhbnQ/OiAncHJpbWFyeScgfCAnc2Vjb25kYXJ5JyB8ICdnaG9zdCcgfCAnZGFuZ2VyJ1xuICBzaXplPzogJ3NtJyB8ICdtZCcgfCAnbGcnXG4gIGZ1bGxXaWR0aD86IGJvb2xlYW5cbiAgbG9hZGluZz86IGJvb2xlYW5cbiAgbGVmdEljb24/OiBKU1guRWxlbWVudFxuICByaWdodEljb24/OiBKU1guRWxlbWVudFxufVxuXG5leHBvcnQgY29uc3QgQnV0dG9uID0gKHByb3BzOiBCdXR0b25Qcm9wcykgPT4ge1xuICBjb25zdCBbbG9jYWwsIG90aGVyc10gPSBzcGxpdFByb3BzKHByb3BzLCBbXG4gICAgJ3ZhcmlhbnQnLFxuICAgICdzaXplJyxcbiAgICAnZnVsbFdpZHRoJyxcbiAgICAnbG9hZGluZycsXG4gICAgJ2xlZnRJY29uJyxcbiAgICAncmlnaHRJY29uJyxcbiAgICAnY2hpbGRyZW4nLFxuICAgICdjbGFzcycsXG4gICAgJ2Rpc2FibGVkJyxcbiAgXSlcblxuICBjb25zdCB2YXJpYW50ID0gKCkgPT4gbG9jYWwudmFyaWFudCB8fCAncHJpbWFyeSdcbiAgY29uc3Qgc2l6ZSA9ICgpID0+IGxvY2FsLnNpemUgfHwgJ21kJ1xuXG4gIHJldHVybiAoXG4gICAgPGJ1dHRvblxuICAgICAgZGlzYWJsZWQ9e2xvY2FsLmRpc2FibGVkIHx8IGxvY2FsLmxvYWRpbmd9XG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZm9udC1tZWRpdW0gdHJhbnNpdGlvbi1hbGwgY3Vyc29yLXBvaW50ZXIgb3V0bGluZS1ub25lIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAge1xuICAgICAgICAgIC8vIFZhcmlhbnRzXG4gICAgICAgICAgJ2JnLWdyYWRpZW50LXByaW1hcnkgdGV4dC13aGl0ZSBob3ZlcjpzaGFkb3ctbGcgaG92ZXI6YnJpZ2h0bmVzcy0xMTAgZ2xvdy1wcmltYXJ5JzpcbiAgICAgICAgICAgIHZhcmlhbnQoKSA9PT0gJ3ByaW1hcnknLFxuICAgICAgICAgICdiZy1zdXJmYWNlIHRleHQtcHJpbWFyeSBib3JkZXIgYm9yZGVyLWRlZmF1bHQgaG92ZXI6YmctZWxldmF0ZWQgaG92ZXI6Ym9yZGVyLXN0cm9uZyc6XG4gICAgICAgICAgICB2YXJpYW50KCkgPT09ICdzZWNvbmRhcnknLFxuICAgICAgICAgICd0ZXh0LXNlY29uZGFyeSBob3Zlcjp0ZXh0LXByaW1hcnkgaG92ZXI6Ymctc3VyZmFjZSc6XG4gICAgICAgICAgICB2YXJpYW50KCkgPT09ICdnaG9zdCcsXG4gICAgICAgICAgJ2JnLXJlZC02MDAgdGV4dC13aGl0ZSBob3ZlcjpiZy1yZWQtNzAwIGhvdmVyOnNoYWRvdy1sZyc6XG4gICAgICAgICAgICB2YXJpYW50KCkgPT09ICdkYW5nZXInLFxuICAgICAgICAgIC8vIFNpemVzXG4gICAgICAgICAgJ2gtOCBweC0zIHRleHQtc20gcm91bmRlZC1tZCBnYXAtMS41Jzogc2l6ZSgpID09PSAnc20nLFxuICAgICAgICAgICdoLTEwIHB4LTQgdGV4dC1iYXNlIHJvdW5kZWQtbGcgZ2FwLTInOiBzaXplKCkgPT09ICdtZCcsXG4gICAgICAgICAgJ2gtMTIgcHgtNiB0ZXh0LWxnIHJvdW5kZWQtbGcgZ2FwLTIuNSc6IHNpemUoKSA9PT0gJ2xnJyxcbiAgICAgICAgICAvLyBGdWxsIHdpZHRoXG4gICAgICAgICAgJ3ctZnVsbCc6IGxvY2FsLmZ1bGxXaWR0aCxcbiAgICAgICAgICAvLyBMb2FkaW5nIHN0YXRlXG4gICAgICAgICAgJ2N1cnNvci13YWl0JzogbG9jYWwubG9hZGluZyxcbiAgICAgICAgfSxcbiAgICAgICAgbG9jYWwuY2xhc3NcbiAgICAgICl9XG4gICAgICB7Li4ub3RoZXJzfVxuICAgID5cbiAgICAgIDxTaG93IHdoZW49e2xvY2FsLmxvYWRpbmd9PlxuICAgICAgICA8c3ZnXG4gICAgICAgICAgY2xhc3M9XCJhbmltYXRlLXNwaW4gaC00IHctNFwiXG4gICAgICAgICAgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiXG4gICAgICAgICAgZmlsbD1cIm5vbmVcIlxuICAgICAgICAgIHZpZXdCb3g9XCIwIDAgMjQgMjRcIlxuICAgICAgICA+XG4gICAgICAgICAgPGNpcmNsZVxuICAgICAgICAgICAgY2xhc3M9XCJvcGFjaXR5LTI1XCJcbiAgICAgICAgICAgIGN4PVwiMTJcIlxuICAgICAgICAgICAgY3k9XCIxMlwiXG4gICAgICAgICAgICByPVwiMTBcIlxuICAgICAgICAgICAgc3Ryb2tlPVwiY3VycmVudENvbG9yXCJcbiAgICAgICAgICAgIHN0cm9rZS13aWR0aD1cIjRcIlxuICAgICAgICAgIC8+XG4gICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgIGNsYXNzPVwib3BhY2l0eS03NVwiXG4gICAgICAgICAgICBmaWxsPVwiY3VycmVudENvbG9yXCJcbiAgICAgICAgICAgIGQ9XCJNNCAxMmE4IDggMCAwMTgtOFYwQzUuMzczIDAgMCA1LjM3MyAwIDEyaDR6bTIgNS4yOTFBNy45NjIgNy45NjIgMCAwMTQgMTJIMGMwIDMuMDQyIDEuMTM1IDUuODI0IDMgNy45MzhsMy0yLjY0N3pcIlxuICAgICAgICAgIC8+XG4gICAgICAgIDwvc3ZnPlxuICAgICAgPC9TaG93PlxuXG4gICAgICA8U2hvdyB3aGVuPXtsb2NhbC5sZWZ0SWNvbiAmJiAhbG9jYWwubG9hZGluZ30+XG4gICAgICAgIHtsb2NhbC5sZWZ0SWNvbn1cbiAgICAgIDwvU2hvdz5cblxuICAgICAgPFNob3cgd2hlbj17bG9jYWwuY2hpbGRyZW59PlxuICAgICAgICA8c3Bhbj57bG9jYWwuY2hpbGRyZW59PC9zcGFuPlxuICAgICAgPC9TaG93PlxuXG4gICAgICA8U2hvdyB3aGVuPXtsb2NhbC5yaWdodEljb259PlxuICAgICAgICB7bG9jYWwucmlnaHRJY29ufVxuICAgICAgPC9TaG93PlxuICAgIDwvYnV0dG9uPlxuICApXG59IiwiaW1wb3J0IHsgU2hvdywgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9CdXR0b24nO1xuXG5leHBvcnQgdHlwZSBPbmJvYXJkaW5nU3RlcCA9ICdjb25uZWN0LXdhbGxldCcgfCAnZ2VuZXJhdGluZy10b2tlbicgfCAnY29tcGxldGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE9uYm9hcmRpbmdGbG93UHJvcHMge1xuICBzdGVwOiBPbmJvYXJkaW5nU3RlcDtcbiAgZXJyb3I/OiBzdHJpbmcgfCBudWxsO1xuICB3YWxsZXRBZGRyZXNzPzogc3RyaW5nIHwgbnVsbDtcbiAgdG9rZW4/OiBzdHJpbmcgfCBudWxsO1xuICBvbkNvbm5lY3RXYWxsZXQ6ICgpID0+IHZvaWQ7XG4gIG9uVXNlVGVzdE1vZGU6ICgpID0+IHZvaWQ7XG4gIG9uVXNlUHJpdmF0ZUtleTogKHByaXZhdGVLZXk6IHN0cmluZykgPT4gdm9pZDtcbiAgb25Db21wbGV0ZTogKCkgPT4gdm9pZDtcbiAgaXNDb25uZWN0aW5nPzogYm9vbGVhbjtcbiAgaXNHZW5lcmF0aW5nPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBPbmJvYXJkaW5nRmxvdzogQ29tcG9uZW50PE9uYm9hcmRpbmdGbG93UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtzaG93VGVzdE9wdGlvbiwgc2V0U2hvd1Rlc3RPcHRpb25dID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3Nob3dQcml2YXRlS2V5SW5wdXQsIHNldFNob3dQcml2YXRlS2V5SW5wdXRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3ByaXZhdGVLZXksIHNldFByaXZhdGVLZXldID0gY3JlYXRlU2lnbmFsKCcnKTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgJ21pbi1oLXNjcmVlbiBiZy1ncmFkaWVudC10by1iciBmcm9tLWdyYXktOTAwIHRvLWJsYWNrIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyJyxcbiAgICAgIHByb3BzLmNsYXNzXG4gICAgKX0+XG4gICAgICA8ZGl2IGNsYXNzPVwibWF4LXctMnhsIHctZnVsbCBwLTEyXCI+XG4gICAgICAgIHsvKiBMb2dvL0hlYWRlciAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIG1iLTEyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtOHhsIG1iLTZcIj7wn46kPC9kaXY+XG4gICAgICAgICAgPGgxIGNsYXNzPVwidGV4dC02eGwgZm9udC1ib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgU2NhcmxldHQgS2FyYW9rZVxuICAgICAgICAgIDwvaDE+XG4gICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXhsIHRleHQtZ3JheS00MDBcIj5cbiAgICAgICAgICAgIEFJLXBvd2VyZWQga2FyYW9rZSBmb3IgU291bmRDbG91ZFxuICAgICAgICAgIDwvcD5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgey8qIFByb2dyZXNzIERvdHMgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGp1c3RpZnktY2VudGVyIG1iLTEyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZ2FwLTNcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAndy0zIGgtMyByb3VuZGVkLWZ1bGwgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgICAgICAgcHJvcHMuc3RlcCA9PT0gJ2Nvbm5lY3Qtd2FsbGV0JyBcbiAgICAgICAgICAgICAgICA/ICdiZy1wdXJwbGUtNTAwIHctMTInIFxuICAgICAgICAgICAgICAgIDogcHJvcHMud2FsbGV0QWRkcmVzcyBcbiAgICAgICAgICAgICAgICAgID8gJ2JnLWdyZWVuLTUwMCcgXG4gICAgICAgICAgICAgICAgICA6ICdiZy1ncmF5LTYwMCdcbiAgICAgICAgICAgICl9IC8+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3ctMyBoLTMgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgICAgICAgIHByb3BzLnN0ZXAgPT09ICdnZW5lcmF0aW5nLXRva2VuJyBcbiAgICAgICAgICAgICAgICA/ICdiZy1wdXJwbGUtNTAwIHctMTInIFxuICAgICAgICAgICAgICAgIDogcHJvcHMudG9rZW4gXG4gICAgICAgICAgICAgICAgICA/ICdiZy1ncmVlbi01MDAnIFxuICAgICAgICAgICAgICAgICAgOiAnYmctZ3JheS02MDAnXG4gICAgICAgICAgICApfSAvPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICd3LTMgaC0zIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICAgICAgICBwcm9wcy5zdGVwID09PSAnY29tcGxldGUnIFxuICAgICAgICAgICAgICAgID8gJ2JnLWdyZWVuLTUwMCB3LTEyJyBcbiAgICAgICAgICAgICAgICA6ICdiZy1ncmF5LTYwMCdcbiAgICAgICAgICAgICl9IC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHsvKiBFcnJvciBEaXNwbGF5ICovfVxuICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5lcnJvcn0+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm1iLTggcC02IGJnLXJlZC05MDAvMjAgYm9yZGVyIGJvcmRlci1yZWQtODAwIHJvdW5kZWQteGxcIj5cbiAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1yZWQtNDAwIHRleHQtY2VudGVyIHRleHQtbGdcIj57cHJvcHMuZXJyb3J9PC9wPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgey8qIENvbnRlbnQgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LTZcIj5cbiAgICAgICAgICB7LyogQ29ubmVjdCBXYWxsZXQgU3RlcCAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zdGVwID09PSAnY29ubmVjdC13YWxsZXQnfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBzcGFjZS15LThcIj5cbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTR4bCBmb250LXNlbWlib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgICAgICAgQ29ubmVjdCBZb3VyIFdhbGxldFxuICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQtbGcgbWF4LXctbWQgbXgtYXV0b1wiPlxuICAgICAgICAgICAgICAgICAgQ29ubmVjdCB5b3VyIHdhbGxldCB0byBnZXQgc3RhcnRlZFxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNCBtYXgtdy1tZCBteC1hdXRvXCI+XG4gICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25Db25uZWN0V2FsbGV0fVxuICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmlzQ29ubmVjdGluZ31cbiAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE2IHRleHQtbGdcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIHtwcm9wcy5pc0Nvbm5lY3RpbmcgPyAoXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInctNCBoLTQgYm9yZGVyLTIgYm9yZGVyLWN1cnJlbnQgYm9yZGVyLXItdHJhbnNwYXJlbnQgcm91bmRlZC1mdWxsIGFuaW1hdGUtc3BpblwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgQ29ubmVjdGluZy4uLlxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4+8J+mijwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICBDb25uZWN0IHdpdGggTWV0YU1hc2tcbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L0J1dHRvbj5cblxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49eyFzaG93VGVzdE9wdGlvbigpICYmICFzaG93UHJpdmF0ZUtleUlucHV0KCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZ2FwLTQganVzdGlmeS1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dUZXN0T3B0aW9uKHRydWUpfVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIFVzZSBkZW1vIG1vZGVcbiAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidGV4dC1ncmF5LTYwMFwiPnw8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93UHJpdmF0ZUtleUlucHV0KHRydWUpfVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIFVzZSBwcml2YXRlIGtleVxuICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Nob3dUZXN0T3B0aW9uKCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB0LTYgc3BhY2UteS00XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib3JkZXItdCBib3JkZXItZ3JheS04MDAgcHQtNlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uVXNlVGVzdE1vZGV9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwic2Vjb25kYXJ5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0XCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICBDb250aW51ZSB3aXRoIERlbW8gTW9kZVxuICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dUZXN0T3B0aW9uKGZhbHNlKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzIG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIEJhY2tcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtzaG93UHJpdmF0ZUtleUlucHV0KCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB0LTYgc3BhY2UteS00XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib3JkZXItdCBib3JkZXItZ3JheS04MDAgcHQtNlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cInBhc3N3b3JkXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtwcml2YXRlS2V5KCl9XG4gICAgICAgICAgICAgICAgICAgICAgICBvbklucHV0PXsoZSkgPT4gc2V0UHJpdmF0ZUtleShlLmN1cnJlbnRUYXJnZXQudmFsdWUpfVxuICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJFbnRlciBwcml2YXRlIGtleVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0IHB4LTQgYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLWxnIHRleHQtd2hpdGUgcGxhY2Vob2xkZXItZ3JheS01MDAgZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1wdXJwbGUtNTAwXCJcbiAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHByb3BzLm9uVXNlUHJpdmF0ZUtleShwcml2YXRlS2V5KCkpfVxuICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFwcml2YXRlS2V5KCkgfHwgcHJpdmF0ZUtleSgpLmxlbmd0aCAhPT0gNjR9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwic2Vjb25kYXJ5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0IG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIENvbm5lY3Qgd2l0aCBQcml2YXRlIEtleVxuICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd1ByaXZhdGVLZXlJbnB1dChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldFByaXZhdGVLZXkoJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzIG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIEJhY2tcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICB7LyogR2VuZXJhdGluZyBUb2tlbiBTdGVwICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnN0ZXAgPT09ICdnZW5lcmF0aW5nLXRva2VuJ30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgc3BhY2UteS04XCI+XG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC00eGwgZm9udC1zZW1pYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj5cbiAgICAgICAgICAgICAgICAgIFNldHRpbmcgVXAgWW91ciBBY2NvdW50XG4gICAgICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy53YWxsZXRBZGRyZXNzfT5cbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTQwMCB0ZXh0LWxnIG1iLTNcIj5cbiAgICAgICAgICAgICAgICAgICAgQ29ubmVjdGVkIHdhbGxldDpcbiAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgIDxjb2RlIGNsYXNzPVwidGV4dC1sZyB0ZXh0LXB1cnBsZS00MDAgYmctZ3JheS04MDAgcHgtNCBweS0yIHJvdW5kZWQtbGcgZm9udC1tb25vIGlubGluZS1ibG9ja1wiPlxuICAgICAgICAgICAgICAgICAgICB7cHJvcHMud2FsbGV0QWRkcmVzcz8uc2xpY2UoMCwgNil9Li4ue3Byb3BzLndhbGxldEFkZHJlc3M/LnNsaWNlKC00KX1cbiAgICAgICAgICAgICAgICAgIDwvY29kZT5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJweS0xMlwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ3LTIwIGgtMjAgYm9yZGVyLTQgYm9yZGVyLXB1cnBsZS01MDAgYm9yZGVyLXQtdHJhbnNwYXJlbnQgcm91bmRlZC1mdWxsIGFuaW1hdGUtc3BpbiBteC1hdXRvXCIgLz5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQteGxcIj5cbiAgICAgICAgICAgICAgICB7cHJvcHMuaXNHZW5lcmF0aW5nIFxuICAgICAgICAgICAgICAgICAgPyAnR2VuZXJhdGluZyB5b3VyIGFjY2VzcyB0b2tlbi4uLicgXG4gICAgICAgICAgICAgICAgICA6ICdWZXJpZnlpbmcgeW91ciBhY2NvdW50Li4uJ31cbiAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgey8qIENvbXBsZXRlIFN0ZXAgKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuc3RlcCA9PT0gJ2NvbXBsZXRlJ30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgc3BhY2UteS04XCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTh4bCBtYi02XCI+8J+OiTwvZGl2PlxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTR4bCBmb250LXNlbWlib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgICAgICAgWW91J3JlIEFsbCBTZXQhXG4gICAgICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS00MDAgdGV4dC14bCBtYXgtdy1tZCBteC1hdXRvIG1iLThcIj5cbiAgICAgICAgICAgICAgICAgIFlvdXIgYWNjb3VudCBpcyByZWFkeS4gVGltZSB0byBzaW5nIVxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1heC13LW1kIG14LWF1dG9cIj5cbiAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNvbXBsZXRlfVxuICAgICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTYgdGV4dC1sZ1wiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgU3RhcnQgU2luZ2luZyEg8J+agFxuICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS01MDAgbXQtNlwiPlxuICAgICAgICAgICAgICAgIExvb2sgZm9yIHRoZSBrYXJhb2tlIHdpZGdldCBvbiBhbnkgU291bmRDbG91ZCB0cmFja1xuICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IEZvciwgY3JlYXRlRWZmZWN0LCBjcmVhdGVTaWduYWwsIFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEx5cmljTGluZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRleHQ6IHN0cmluZztcbiAgc3RhcnRUaW1lOiBudW1iZXI7IC8vIGluIHNlY29uZHNcbiAgZHVyYXRpb246IG51bWJlcjsgLy8gaW4gbWlsbGlzZWNvbmRzXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTHlyaWNzRGlzcGxheVByb3BzIHtcbiAgbHlyaWNzOiBMeXJpY0xpbmVbXTtcbiAgY3VycmVudFRpbWU/OiBudW1iZXI7IC8vIGluIG1pbGxpc2Vjb25kc1xuICBpc1BsYXlpbmc/OiBib29sZWFuO1xuICBsaW5lU2NvcmVzPzogQXJyYXk8eyBsaW5lSW5kZXg6IG51bWJlcjsgc2NvcmU6IG51bWJlcjsgdHJhbnNjcmlwdGlvbjogc3RyaW5nOyBmZWVkYmFjaz86IHN0cmluZyB9PjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBMeXJpY3NEaXNwbGF5OiBDb21wb25lbnQ8THlyaWNzRGlzcGxheVByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbY3VycmVudExpbmVJbmRleCwgc2V0Q3VycmVudExpbmVJbmRleF0gPSBjcmVhdGVTaWduYWwoLTEpO1xuICBsZXQgY29udGFpbmVyUmVmOiBIVE1MRGl2RWxlbWVudCB8IHVuZGVmaW5lZDtcbiAgXG4gIC8vIEhlbHBlciB0byBnZXQgc2NvcmUgZm9yIGEgbGluZVxuICBjb25zdCBnZXRMaW5lU2NvcmUgPSAobGluZUluZGV4OiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gcHJvcHMubGluZVNjb3Jlcz8uZmluZChzID0+IHMubGluZUluZGV4ID09PSBsaW5lSW5kZXgpPy5zY29yZSB8fCBudWxsO1xuICB9O1xuICBcbiAgLy8gSGVscGVyIHRvIGdldCBjb2xvciBiYXNlZCBvbiBzY29yZVxuICBjb25zdCBnZXRTY29yZVN0eWxlID0gKHNjb3JlOiBudW1iZXIgfCBudWxsKSA9PiB7XG4gICAgaWYgKHNjb3JlID09PSBudWxsKSByZXR1cm4ge307XG4gICAgXG4gICAgLy8gU2ltcGxlIGNvbG9yIGNoYW5nZXMgb25seSAtIG5vIGFuaW1hdGlvbnMgb3IgZWZmZWN0c1xuICAgIGlmIChzY29yZSA+PSA5NSkge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmYzODM4JyB9O1xuICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gOTApIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmNmI2YicgfTtcbiAgICB9IGVsc2UgaWYgKHNjb3JlID49IDgwKSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZjg3ODcnIH07XG4gICAgfSBlbHNlIGlmIChzY29yZSA+PSA3MCkge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmZhOGE4JyB9O1xuICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gNjApIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmY2VjZScgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmZlMGUwJyB9O1xuICAgIH1cbiAgfTtcbiAgXG4gIC8vIFJlbW92ZWQgZW1vamkgZnVuY3Rpb24gLSB1c2luZyBjb2xvcnMgb25seVxuXG4gIC8vIEZpbmQgY3VycmVudCBsaW5lIGJhc2VkIG9uIHRpbWVcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIXByb3BzLmN1cnJlbnRUaW1lIHx8ICFwcm9wcy5seXJpY3MubGVuZ3RoKSB7XG4gICAgICBzZXRDdXJyZW50TGluZUluZGV4KC0xKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0aW1lID0gcHJvcHMuY3VycmVudFRpbWUgLyAxMDAwOyAvLyBDb252ZXJ0IGZyb20gbWlsbGlzZWNvbmRzIHRvIHNlY29uZHNcbiAgICBjb25zdCBUSU1JTkdfT0ZGU0VUID0gMC4zOyAvLyBPZmZzZXQgdG8gbWFrZSBseXJpY3MgYXBwZWFyIDAuM3MgZWFybGllclxuICAgIGNvbnN0IGFkanVzdGVkVGltZSA9IHRpbWUgKyBUSU1JTkdfT0ZGU0VUO1xuICAgIFxuICAgIC8vIEZpbmQgdGhlIGxpbmUgdGhhdCBjb250YWlucyB0aGUgY3VycmVudCB0aW1lXG4gICAgbGV0IGZvdW5kSW5kZXggPSAtMTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByb3BzLmx5cmljcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgbGluZSA9IHByb3BzLmx5cmljc1tpXTtcbiAgICAgIGlmICghbGluZSkgY29udGludWU7XG4gICAgICBjb25zdCBlbmRUaW1lID0gbGluZS5zdGFydFRpbWUgKyBsaW5lLmR1cmF0aW9uIC8gMTAwMDsgLy8gQ29udmVydCBkdXJhdGlvbiBmcm9tIG1zIHRvIHNlY29uZHNcbiAgICAgIFxuICAgICAgaWYgKGFkanVzdGVkVGltZSA+PSBsaW5lLnN0YXJ0VGltZSAmJiBhZGp1c3RlZFRpbWUgPCBlbmRUaW1lKSB7XG4gICAgICAgIGZvdW5kSW5kZXggPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gSWYgbm8gbGluZSBjb250YWlucyBjdXJyZW50IHRpbWUsIGZpbmQgdGhlIG1vc3QgcmVjZW50IHBhc3QgbGluZVxuICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSAmJiB0aW1lID4gMCkge1xuICAgICAgZm9yIChsZXQgaSA9IHByb3BzLmx5cmljcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBjb25zdCBsaW5lID0gcHJvcHMubHlyaWNzW2ldO1xuICAgICAgICBpZiAoIWxpbmUpIGNvbnRpbnVlO1xuICAgICAgICBpZiAodGltZSA+PSBsaW5lLnN0YXJ0VGltZSkge1xuICAgICAgICAgIGZvdW5kSW5kZXggPSBpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIE9ubHkgdXBkYXRlIGlmIHRoZSBpbmRleCBoYXMgY2hhbmdlZCB0byBhdm9pZCB1bm5lY2Vzc2FyeSBzY3JvbGxpbmdcbiAgICBpZiAoZm91bmRJbmRleCAhPT0gY3VycmVudExpbmVJbmRleCgpKSB7XG4gICAgICBjb25zdCBwcmV2SW5kZXggPSBjdXJyZW50TGluZUluZGV4KCk7XG4gICAgICAvLyBPbmx5IGxvZyBsYXJnZSBqdW1wcyB0byByZWR1Y2UgY29uc29sZSBzcGFtXG4gICAgICBpZiAoTWF0aC5hYnMoZm91bmRJbmRleCAtIHByZXZJbmRleCkgPiA1KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbTHlyaWNzRGlzcGxheV0gQ3VycmVudCBsaW5lIGNoYW5nZWQ6Jywge1xuICAgICAgICAgIGZyb206IHByZXZJbmRleCxcbiAgICAgICAgICB0bzogZm91bmRJbmRleCxcbiAgICAgICAgICB0aW1lOiBwcm9wcy5jdXJyZW50VGltZSxcbiAgICAgICAgICB0aW1lSW5TZWNvbmRzOiB0aW1lLFxuICAgICAgICAgIGp1bXA6IE1hdGguYWJzKGZvdW5kSW5kZXggLSBwcmV2SW5kZXgpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBMb2cgd2FybmluZyBmb3IgbGFyZ2UganVtcHNcbiAgICAgIGlmIChwcmV2SW5kZXggIT09IC0xICYmIE1hdGguYWJzKGZvdW5kSW5kZXggLSBwcmV2SW5kZXgpID4gMTApIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdbTHlyaWNzRGlzcGxheV0gTGFyZ2UgbGluZSBqdW1wIGRldGVjdGVkIScsIHtcbiAgICAgICAgICBmcm9tOiBwcmV2SW5kZXgsXG4gICAgICAgICAgdG86IGZvdW5kSW5kZXgsXG4gICAgICAgICAgZnJvbUxpbmU6IHByb3BzLmx5cmljc1twcmV2SW5kZXhdLFxuICAgICAgICAgIHRvTGluZTogcHJvcHMubHlyaWNzW2ZvdW5kSW5kZXhdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBzZXRDdXJyZW50TGluZUluZGV4KGZvdW5kSW5kZXgpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gQXV0by1zY3JvbGwgdG8gY3VycmVudCBsaW5lXG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgaW5kZXggPSBjdXJyZW50TGluZUluZGV4KCk7XG4gICAgaWYgKGluZGV4ID09PSAtMSB8fCAhY29udGFpbmVyUmVmIHx8ICFwcm9wcy5pc1BsYXlpbmcpIHJldHVybjtcblxuICAgIGNvbnN0IGxpbmVFbGVtZW50cyA9IGNvbnRhaW5lclJlZi5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1saW5lLWluZGV4XScpO1xuICAgIGNvbnN0IGN1cnJlbnRFbGVtZW50ID0gbGluZUVsZW1lbnRzW2luZGV4XSBhcyBIVE1MRWxlbWVudDtcblxuICAgIGlmIChjdXJyZW50RWxlbWVudCkge1xuICAgICAgY29uc3QgY29udGFpbmVySGVpZ2h0ID0gY29udGFpbmVyUmVmLmNsaWVudEhlaWdodDtcbiAgICAgIGNvbnN0IGxpbmVUb3AgPSBjdXJyZW50RWxlbWVudC5vZmZzZXRUb3A7XG4gICAgICBjb25zdCBsaW5lSGVpZ2h0ID0gY3VycmVudEVsZW1lbnQub2Zmc2V0SGVpZ2h0O1xuICAgICAgXG4gICAgICAvLyBDZW50ZXIgdGhlIGN1cnJlbnQgbGluZVxuICAgICAgY29uc3QgdGFyZ2V0U2Nyb2xsVG9wID0gbGluZVRvcCAtIGNvbnRhaW5lckhlaWdodCAvIDIgKyBsaW5lSGVpZ2h0IC8gMjtcbiAgICAgIFxuICAgICAgY29udGFpbmVyUmVmLnNjcm9sbFRvKHtcbiAgICAgICAgdG9wOiB0YXJnZXRTY3JvbGxUb3AsXG4gICAgICAgIGJlaGF2aW9yOiAnc21vb3RoJyxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICByZWY9e2NvbnRhaW5lclJlZn1cbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2x5cmljcy1kaXNwbGF5IG92ZXJmbG93LXktYXV0byBzY3JvbGwtc21vb3RoJyxcbiAgICAgICAgJ2gtZnVsbCBweC02IHB5LTEyJyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktOFwiPlxuICAgICAgICA8Rm9yIGVhY2g9e3Byb3BzLmx5cmljc30+XG4gICAgICAgICAgeyhsaW5lLCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbGluZVNjb3JlID0gKCkgPT4gZ2V0TGluZVNjb3JlKGluZGV4KCkpO1xuICAgICAgICAgICAgY29uc3Qgc2NvcmVTdHlsZSA9ICgpID0+IGdldFNjb3JlU3R5bGUobGluZVNjb3JlKCkpO1xuICAgICAgICAgICAgLy8gVXNpbmcgY29sb3IgZ3JhZGllbnRzIGluc3RlYWQgb2YgZW1vamlzXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICBkYXRhLWxpbmUtaW5kZXg9e2luZGV4KCl9XG4gICAgICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICAgJ3RleHQtY2VudGVyJyxcbiAgICAgICAgICAgICAgICAgICd0ZXh0LTJ4bCBsZWFkaW5nLXJlbGF4ZWQnLFxuICAgICAgICAgICAgICAgICAgaW5kZXgoKSA9PT0gY3VycmVudExpbmVJbmRleCgpXG4gICAgICAgICAgICAgICAgICAgID8gJ29wYWNpdHktMTAwJ1xuICAgICAgICAgICAgICAgICAgICA6ICdvcGFjaXR5LTYwJ1xuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgIGNvbG9yOiBpbmRleCgpID09PSBjdXJyZW50TGluZUluZGV4KCkgJiYgIWxpbmVTY29yZSgpIFxuICAgICAgICAgICAgICAgICAgICA/ICcjZmZmZmZmJyAvLyBXaGl0ZSBmb3IgY3VycmVudCBsaW5lIHdpdGhvdXQgc2NvcmVcbiAgICAgICAgICAgICAgICAgICAgOiBzY29yZVN0eWxlKCkuY29sb3IgfHwgJyNmZmZmZmYnXG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIHtsaW5lLnRleHR9XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9fVxuICAgICAgICA8L0Zvcj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEthcmFva2VIZWFkZXJQcm9wcyB7XG4gIHNvbmdUaXRsZTogc3RyaW5nO1xuICBhcnRpc3Q6IHN0cmluZztcbiAgb25CYWNrPzogKCkgPT4gdm9pZDtcbiAgaXNQbGF5aW5nPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmNvbnN0IENoZXZyb25MZWZ0ID0gKCkgPT4gKFxuICA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBjbGFzcz1cInctNiBoLTZcIj5cbiAgICA8cGF0aCBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBkPVwiTTE1IDE5bC03LTcgNy03XCIgLz5cbiAgPC9zdmc+XG4pO1xuXG5jb25zdCBQYXVzZUljb24gPSAoKSA9PiAoXG4gIDxzdmcgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIGNsYXNzPVwidy02IGgtNlwiPlxuICAgIDxwYXRoIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiIGQ9XCJNMTAgOXY2bTQtNnY2bTctM2E5IDkgMCAxMS0xOCAwIDkgOSAwIDAxMTggMHpcIiAvPlxuICA8L3N2Zz5cbik7XG5cbmV4cG9ydCBjb25zdCBLYXJhb2tlSGVhZGVyOiBDb21wb25lbnQ8S2FyYW9rZUhlYWRlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdyZWxhdGl2ZSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLTQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgey8qIEJhY2svUGF1c2UgYnV0dG9uIC0gYWJzb2x1dGUgcG9zaXRpb25lZCAqL31cbiAgICAgIDxidXR0b25cbiAgICAgICAgb25DbGljaz17cHJvcHMub25CYWNrfVxuICAgICAgICBjbGFzcz1cImFic29sdXRlIGxlZnQtNCBwLTIgLW0tMiB0ZXh0LXNlY29uZGFyeSBob3Zlcjp0ZXh0LXByaW1hcnkgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICBhcmlhLWxhYmVsPXtwcm9wcy5pc1BsYXlpbmcgPyBcIlBhdXNlXCIgOiBcIkdvIGJhY2tcIn1cbiAgICAgID5cbiAgICAgICAge3Byb3BzLmlzUGxheWluZyA/IDxQYXVzZUljb24gLz4gOiA8Q2hldnJvbkxlZnQgLz59XG4gICAgICA8L2J1dHRvbj5cbiAgICAgIFxuICAgICAgey8qIFNvbmcgaW5mbyAtIGNlbnRlcmVkICovfVxuICAgICAgPGgxIGNsYXNzPVwidGV4dC1iYXNlIGZvbnQtbWVkaXVtIHRleHQtcHJpbWFyeSB0ZXh0LWNlbnRlciBweC0xMiB0cnVuY2F0ZSBtYXgtdy1mdWxsXCI+XG4gICAgICAgIHtwcm9wcy5zb25nVGl0bGV9IC0ge3Byb3BzLmFydGlzdH1cbiAgICAgIDwvaDE+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IEZvciwgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGVhZGVyYm9hcmRFbnRyeSB7XG4gIHJhbms6IG51bWJlcjtcbiAgdXNlcm5hbWU6IHN0cmluZztcbiAgc2NvcmU6IG51bWJlcjtcbiAgaXNDdXJyZW50VXNlcj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGVhZGVyYm9hcmRQYW5lbFByb3BzIHtcbiAgZW50cmllczogTGVhZGVyYm9hcmRFbnRyeVtdO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IExlYWRlcmJvYXJkUGFuZWw6IENvbXBvbmVudDxMZWFkZXJib2FyZFBhbmVsUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgZ2FwLTIgcC00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxTaG93IFxuICAgICAgICB3aGVuPXtwcm9wcy5lbnRyaWVzLmxlbmd0aCA+IDB9XG4gICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcHktMTIgcHgtNiB0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtNnhsIG1iLTQgb3BhY2l0eS0zMFwiPvCfjqQ8L2Rpdj5cbiAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0yXCI+Tm9ib2R5IGhhcyBjb21wbGV0ZWQgdGhpcyBzb25nIHlldCE8L3A+XG4gICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc20gdGV4dC10ZXJ0aWFyeVwiPkJlIHRoZSBmaXJzdCB0byBzZXQgYSBoaWdoIHNjb3JlPC9wPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICB9XG4gICAgICA+XG4gICAgICAgIDxGb3IgZWFjaD17cHJvcHMuZW50cmllc30+XG4gICAgICAgICAgeyhlbnRyeSkgPT4gKFxuICAgICAgICAgICAgPGRpdiBcbiAgICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICdmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBweC0zIHB5LTIgcm91bmRlZC1sZyB0cmFuc2l0aW9uLWNvbG9ycycsXG4gICAgICAgICAgICAgICAgZW50cnkuaXNDdXJyZW50VXNlciBcbiAgICAgICAgICAgICAgICAgID8gJ2JnLWFjY2VudC1wcmltYXJ5LzEwIGJvcmRlciBib3JkZXItYWNjZW50LXByaW1hcnkvMjAnIFxuICAgICAgICAgICAgICAgICAgOiAnYmctc3VyZmFjZSBob3ZlcjpiZy1zdXJmYWNlLWhvdmVyJ1xuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8c3BhbiBcbiAgICAgICAgICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICAgICAndy04IHRleHQtY2VudGVyIGZvbnQtbW9ubyBmb250LWJvbGQnLFxuICAgICAgICAgICAgICAgICAgZW50cnkucmFuayA8PSAzID8gJ3RleHQtYWNjZW50LXByaW1hcnknIDogJ3RleHQtc2Vjb25kYXJ5J1xuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAje2VudHJ5LnJhbmt9XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICdmbGV4LTEgdHJ1bmNhdGUnLFxuICAgICAgICAgICAgICAgIGVudHJ5LmlzQ3VycmVudFVzZXIgPyAndGV4dC1hY2NlbnQtcHJpbWFyeSBmb250LW1lZGl1bScgOiAndGV4dC1wcmltYXJ5J1xuICAgICAgICAgICAgICApfT5cbiAgICAgICAgICAgICAgICB7ZW50cnkudXNlcm5hbWV9XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICdmb250LW1vbm8gZm9udC1ib2xkJyxcbiAgICAgICAgICAgICAgICBlbnRyeS5pc0N1cnJlbnRVc2VyID8gJ3RleHQtYWNjZW50LXByaW1hcnknIDogJ3RleHQtcHJpbWFyeSdcbiAgICAgICAgICAgICAgKX0+XG4gICAgICAgICAgICAgICAge2VudHJ5LnNjb3JlLnRvTG9jYWxlU3RyaW5nKCl9XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvRm9yPlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgdHlwZSBQbGF5YmFja1NwZWVkID0gJzF4JyB8ICcwLjc1eCcgfCAnMC41eCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3BsaXRCdXR0b25Qcm9wcyB7XG4gIG9uU3RhcnQ/OiAoKSA9PiB2b2lkO1xuICBvblNwZWVkQ2hhbmdlPzogKHNwZWVkOiBQbGF5YmFja1NwZWVkKSA9PiB2b2lkO1xuICBkaXNhYmxlZD86IGJvb2xlYW47XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5jb25zdCBzcGVlZHM6IFBsYXliYWNrU3BlZWRbXSA9IFsnMXgnLCAnMC43NXgnLCAnMC41eCddO1xuXG5leHBvcnQgY29uc3QgU3BsaXRCdXR0b246IENvbXBvbmVudDxTcGxpdEJ1dHRvblByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbY3VycmVudFNwZWVkSW5kZXgsIHNldEN1cnJlbnRTcGVlZEluZGV4XSA9IGNyZWF0ZVNpZ25hbCgwKTtcbiAgXG4gIGNvbnN0IGN1cnJlbnRTcGVlZCA9ICgpID0+IHNwZWVkc1tjdXJyZW50U3BlZWRJbmRleCgpXTtcbiAgXG4gIGNvbnN0IGN5Y2xlU3BlZWQgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgY29uc3QgbmV4dEluZGV4ID0gKGN1cnJlbnRTcGVlZEluZGV4KCkgKyAxKSAlIHNwZWVkcy5sZW5ndGg7XG4gICAgc2V0Q3VycmVudFNwZWVkSW5kZXgobmV4dEluZGV4KTtcbiAgICBjb25zdCBuZXdTcGVlZCA9IHNwZWVkc1tuZXh0SW5kZXhdO1xuICAgIGlmIChuZXdTcGVlZCkge1xuICAgICAgcHJvcHMub25TcGVlZENoYW5nZT8uKG5ld1NwZWVkKTtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IFxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAncmVsYXRpdmUgaW5saW5lLWZsZXggdy1mdWxsIHJvdW5kZWQtbGcgb3ZlcmZsb3ctaGlkZGVuJyxcbiAgICAgICAgJ2JnLWdyYWRpZW50LXByaW1hcnkgdGV4dC13aGl0ZSBzaGFkb3ctbGcnLFxuICAgICAgICAndHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgey8qIE1haW4gYnV0dG9uICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblN0YXJ0fVxuICAgICAgICBkaXNhYmxlZD17cHJvcHMuZGlzYWJsZWR9XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnZmxleC0xIGlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByZWxhdGl2ZSBvdmVyZmxvdy1oaWRkZW4nLFxuICAgICAgICAgICdoLTEyIHB4LTYgdGV4dC1sZyBmb250LW1lZGl1bScsXG4gICAgICAgICAgJ2N1cnNvci1wb2ludGVyIGJvcmRlci1ub25lIG91dGxpbmUtbm9uZScsXG4gICAgICAgICAgJ2Rpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAgICAnaG92ZXI6Ymctd2hpdGUvMTAgYWN0aXZlOmJnLXdoaXRlLzIwJ1xuICAgICAgICApfVxuICAgICAgPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInJlbGF0aXZlIHotMTBcIj5TdGFydDwvc3Bhbj5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgXG4gICAgICB7LyogRGl2aWRlciAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJ3LXB4IGJnLWJsYWNrLzIwXCIgLz5cbiAgICAgIFxuICAgICAgey8qIFNwZWVkIGJ1dHRvbiAqL31cbiAgICAgIDxidXR0b25cbiAgICAgICAgb25DbGljaz17Y3ljbGVTcGVlZH1cbiAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmRpc2FibGVkfVxuICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgJ2lubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByZWxhdGl2ZScsXG4gICAgICAgICAgJ3ctMjAgdGV4dC1sZyBmb250LW1lZGl1bScsXG4gICAgICAgICAgJ2N1cnNvci1wb2ludGVyIGJvcmRlci1ub25lIG91dGxpbmUtbm9uZScsXG4gICAgICAgICAgJ2Rpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAgICAnaG92ZXI6Ymctd2hpdGUvMTAgYWN0aXZlOmJnLXdoaXRlLzIwJyxcbiAgICAgICAgICAnYWZ0ZXI6Y29udGVudC1bXCJcIl0gYWZ0ZXI6YWJzb2x1dGUgYWZ0ZXI6aW5zZXQtMCcsXG4gICAgICAgICAgJ2FmdGVyOmJnLWdyYWRpZW50LXRvLXIgYWZ0ZXI6ZnJvbS10cmFuc3BhcmVudCBhZnRlcjp2aWEtd2hpdGUvMjAgYWZ0ZXI6dG8tdHJhbnNwYXJlbnQnLFxuICAgICAgICAgICdhZnRlcjp0cmFuc2xhdGUteC1bLTIwMCVdIGhvdmVyOmFmdGVyOnRyYW5zbGF0ZS14LVsyMDAlXScsXG4gICAgICAgICAgJ2FmdGVyOnRyYW5zaXRpb24tdHJhbnNmb3JtIGFmdGVyOmR1cmF0aW9uLTcwMCdcbiAgICAgICAgKX1cbiAgICAgICAgYXJpYS1sYWJlbD1cIkNoYW5nZSBwbGF5YmFjayBzcGVlZFwiXG4gICAgICA+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwicmVsYXRpdmUgei0xMFwiPntjdXJyZW50U3BlZWQoKX08L3NwYW4+XG4gICAgICA8L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsLCBTaG93LCBjcmVhdGVDb250ZXh0LCB1c2VDb250ZXh0IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQsIEpTWCwgUGFyZW50Q29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFiIHtcbiAgaWQ6IHN0cmluZztcbiAgbGFiZWw6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzUHJvcHMge1xuICB0YWJzOiBUYWJbXTtcbiAgZGVmYXVsdFRhYj86IHN0cmluZztcbiAgb25UYWJDaGFuZ2U/OiAodGFiSWQ6IHN0cmluZykgPT4gdm9pZDtcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzTGlzdFByb3BzIHtcbiAgY2xhc3M/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzVHJpZ2dlclByb3BzIHtcbiAgdmFsdWU6IHN0cmluZztcbiAgY2xhc3M/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzQ29udGVudFByb3BzIHtcbiAgdmFsdWU6IHN0cmluZztcbiAgY2xhc3M/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbn1cblxuLy8gQ29udGV4dCBmb3IgdGFicyBzdGF0ZVxuaW50ZXJmYWNlIFRhYnNDb250ZXh0VmFsdWUge1xuICBhY3RpdmVUYWI6ICgpID0+IHN0cmluZztcbiAgc2V0QWN0aXZlVGFiOiAoaWQ6IHN0cmluZykgPT4gdm9pZDtcbn1cblxuY29uc3QgVGFic0NvbnRleHQgPSBjcmVhdGVDb250ZXh0PFRhYnNDb250ZXh0VmFsdWU+KCk7XG5cbmV4cG9ydCBjb25zdCBUYWJzOiBQYXJlbnRDb21wb25lbnQ8VGFic1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbYWN0aXZlVGFiLCBzZXRBY3RpdmVUYWJdID0gY3JlYXRlU2lnbmFsKHByb3BzLmRlZmF1bHRUYWIgfHwgcHJvcHMudGFic1swXT8uaWQgfHwgJycpO1xuICBcbiAgXG4gIGNvbnN0IGhhbmRsZVRhYkNoYW5nZSA9IChpZDogc3RyaW5nKSA9PiB7XG4gICAgc2V0QWN0aXZlVGFiKGlkKTtcbiAgICBwcm9wcy5vblRhYkNoYW5nZT8uKGlkKTtcbiAgfTtcblxuICBjb25zdCBjb250ZXh0VmFsdWU6IFRhYnNDb250ZXh0VmFsdWUgPSB7XG4gICAgYWN0aXZlVGFiLFxuICAgIHNldEFjdGl2ZVRhYjogaGFuZGxlVGFiQ2hhbmdlXG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8VGFic0NvbnRleHQuUHJvdmlkZXIgdmFsdWU9e2NvbnRleHRWYWx1ZX0+XG4gICAgICA8ZGl2IGNsYXNzPXtjbigndy1mdWxsJywgcHJvcHMuY2xhc3MpfT5cbiAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgPC9kaXY+XG4gICAgPC9UYWJzQ29udGV4dC5Qcm92aWRlcj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBUYWJzTGlzdDogQ29tcG9uZW50PFRhYnNMaXN0UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBcbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2lubGluZS1mbGV4IGgtMTAgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbWQgYmctc3VyZmFjZSBwLTEgdGV4dC1zZWNvbmRhcnknLFxuICAgICAgICAndy1mdWxsJyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgIDwvZGl2PlxuICApO1xufTtcblxuZXhwb3J0IGNvbnN0IFRhYnNUcmlnZ2VyOiBDb21wb25lbnQ8VGFic1RyaWdnZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgY29udGV4dCA9IHVzZUNvbnRleHQoVGFic0NvbnRleHQpO1xuICBpZiAoIWNvbnRleHQpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbVGFic1RyaWdnZXJdIE5vIFRhYnNDb250ZXh0IGZvdW5kLiBUYWJzVHJpZ2dlciBtdXN0IGJlIHVzZWQgd2l0aGluIFRhYnMgY29tcG9uZW50LicpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIFxuICBjb25zdCBpc0FjdGl2ZSA9ICgpID0+IGNvbnRleHQuYWN0aXZlVGFiKCkgPT09IHByb3BzLnZhbHVlO1xuXG4gIHJldHVybiAoXG4gICAgPGJ1dHRvblxuICAgICAgb25DbGljaz17KCkgPT4gY29udGV4dC5zZXRBY3RpdmVUYWIocHJvcHMudmFsdWUpfVxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAnaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHdoaXRlc3BhY2Utbm93cmFwIHJvdW5kZWQtc20gcHgtMyBweS0xLjUnLFxuICAgICAgICAndGV4dC1zbSBmb250LW1lZGl1bSByaW5nLW9mZnNldC1iYXNlIHRyYW5zaXRpb24tYWxsJyxcbiAgICAgICAgJ2ZvY3VzLXZpc2libGU6b3V0bGluZS1ub25lIGZvY3VzLXZpc2libGU6cmluZy0yIGZvY3VzLXZpc2libGU6cmluZy1wdXJwbGUtNTAwIGZvY3VzLXZpc2libGU6cmluZy1vZmZzZXQtMicsXG4gICAgICAgICdkaXNhYmxlZDpwb2ludGVyLWV2ZW50cy1ub25lIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICAnZmxleC0xJyxcbiAgICAgICAgaXNBY3RpdmUoKVxuICAgICAgICAgID8gJ2JnLWJhc2UgdGV4dC1wcmltYXJ5IHNoYWRvdy1zbSdcbiAgICAgICAgICA6ICd0ZXh0LXNlY29uZGFyeSBob3Zlcjp0ZXh0LXByaW1hcnknLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgPC9idXR0b24+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgVGFic0NvbnRlbnQ6IENvbXBvbmVudDxUYWJzQ29udGVudFByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBjb250ZXh0ID0gdXNlQ29udGV4dChUYWJzQ29udGV4dCk7XG4gIGlmICghY29udGV4dCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1tUYWJzQ29udGVudF0gTm8gVGFic0NvbnRleHQgZm91bmQuIFRhYnNDb250ZW50IG11c3QgYmUgdXNlZCB3aXRoaW4gVGFicyBjb21wb25lbnQuJyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgXG4gIGNvbnN0IGlzQWN0aXZlID0gKCkgPT4gY29udGV4dC5hY3RpdmVUYWIoKSA9PT0gcHJvcHMudmFsdWU7XG4gIFxuICByZXR1cm4gKFxuICAgIDxTaG93IHdoZW49e2lzQWN0aXZlKCl9PlxuICAgICAgPGRpdlxuICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgJ210LTIgcmluZy1vZmZzZXQtYmFzZScsXG4gICAgICAgICAgJ2ZvY3VzLXZpc2libGU6b3V0bGluZS1ub25lIGZvY3VzLXZpc2libGU6cmluZy0yIGZvY3VzLXZpc2libGU6cmluZy1wdXJwbGUtNTAwIGZvY3VzLXZpc2libGU6cmluZy1vZmZzZXQtMicsXG4gICAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICAgKX1cbiAgICAgID5cbiAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgPC9kaXY+XG4gICAgPC9TaG93PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCwgU2hvdywgb25DbGVhbnVwIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCBzdHlsZXMgZnJvbSAnLi9GaXJlRW1vamlBbmltYXRpb24ubW9kdWxlLmNzcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmlyZUVtb2ppQW5pbWF0aW9uUHJvcHMge1xuICBzY29yZTogbnVtYmVyO1xuICBsaW5lSW5kZXg6IG51bWJlcjsgLy8gVXNlIGxpbmUgaW5kZXggaW5zdGVhZCBvZiB0cmlnZ2VyXG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgRmlyZUVtb2ppQW5pbWF0aW9uOiBDb21wb25lbnQ8RmlyZUVtb2ppQW5pbWF0aW9uUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtzaG93RmlyZSwgc2V0U2hvd0ZpcmVdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2ZpcmVYLCBzZXRGaXJlWF0gPSBjcmVhdGVTaWduYWwoNTApO1xuICBsZXQgbGFzdExpbmVJbmRleCA9IC0xO1xuICBsZXQgaGlkZVRpbWVyOiBudW1iZXIgfCB1bmRlZmluZWQ7XG4gIFxuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIC8vIENoZWNrIGlmIHdlIGhhdmUgYSBuZXcgbGluZSB3aXRoIGhpZ2ggc2NvcmVcbiAgICBpZiAocHJvcHMubGluZUluZGV4ID4gbGFzdExpbmVJbmRleCAmJiBwcm9wcy5zY29yZSA+PSA4MCkge1xuICAgICAgLy8gUmFuZG9tIFggcG9zaXRpb24gYmV0d2VlbiAyMCUgYW5kIDgwJVxuICAgICAgc2V0RmlyZVgoMjAgKyBNYXRoLnJhbmRvbSgpICogNjApO1xuICAgICAgc2V0U2hvd0ZpcmUodHJ1ZSk7XG4gICAgICBcbiAgICAgIC8vIENsZWFyIGV4aXN0aW5nIHRpbWVyXG4gICAgICBpZiAoaGlkZVRpbWVyKSBjbGVhclRpbWVvdXQoaGlkZVRpbWVyKTtcbiAgICAgIFxuICAgICAgLy8gSGlkZSBhZnRlciBhbmltYXRpb24gY29tcGxldGVzXG4gICAgICBoaWRlVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgc2V0U2hvd0ZpcmUoZmFsc2UpO1xuICAgICAgfSwgMjAwMCk7XG4gICAgICBcbiAgICAgIGxhc3RMaW5lSW5kZXggPSBwcm9wcy5saW5lSW5kZXg7XG4gICAgfVxuICB9KTtcbiAgXG4gIG9uQ2xlYW51cCgoKSA9PiB7XG4gICAgaWYgKGhpZGVUaW1lcikgY2xlYXJUaW1lb3V0KGhpZGVUaW1lcik7XG4gIH0pO1xuXG4gIHJldHVybiAoXG4gICAgPFNob3cgd2hlbj17c2hvd0ZpcmUoKX0+XG4gICAgICA8ZGl2IGNsYXNzPXtjbihzdHlsZXMuZmlyZUNvbnRhaW5lciwgcHJvcHMuY2xhc3MpfT5cbiAgICAgICAgPGRpdlxuICAgICAgICAgIGNsYXNzPXtzdHlsZXMuZmlyZUVtb2ppfVxuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBsZWZ0OiBgJHtmaXJlWCgpfSVgLFxuICAgICAgICAgICAgJ2ZvbnQtc2l6ZSc6ICczMnB4J1xuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICDwn5SlXG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9TaG93PlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93LCB0eXBlIENvbXBvbmVudCwgY3JlYXRlU2lnbmFsLCBjcmVhdGVFZmZlY3QgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB7IFNjb3JlUGFuZWwgfSBmcm9tICcuLi8uLi9kaXNwbGF5L1Njb3JlUGFuZWwnO1xuaW1wb3J0IHsgTHlyaWNzRGlzcGxheSwgdHlwZSBMeXJpY0xpbmUgfSBmcm9tICcuLi9MeXJpY3NEaXNwbGF5JztcbmltcG9ydCB7IExlYWRlcmJvYXJkUGFuZWwsIHR5cGUgTGVhZGVyYm9hcmRFbnRyeSB9IGZyb20gJy4uL0xlYWRlcmJvYXJkUGFuZWwnO1xuaW1wb3J0IHsgU3BsaXRCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vU3BsaXRCdXR0b24nO1xuaW1wb3J0IHR5cGUgeyBQbGF5YmFja1NwZWVkIH0gZnJvbSAnLi4vLi4vY29tbW9uL1NwbGl0QnV0dG9uJztcbmltcG9ydCB7IFRhYnMsIFRhYnNMaXN0LCBUYWJzVHJpZ2dlciwgVGFic0NvbnRlbnQgfSBmcm9tICcuLi8uLi9jb21tb24vVGFicyc7XG5pbXBvcnQgeyBGaXJlRW1vamlBbmltYXRpb24gfSBmcm9tICcuLi8uLi9lZmZlY3RzL0ZpcmVFbW9qaUFuaW1hdGlvbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXh0ZW5zaW9uS2FyYW9rZVZpZXdQcm9wcyB7XG4gIC8vIFNjb3Jlc1xuICBzY29yZTogbnVtYmVyO1xuICByYW5rOiBudW1iZXI7XG4gIFxuICAvLyBMeXJpY3NcbiAgbHlyaWNzOiBMeXJpY0xpbmVbXTtcbiAgY3VycmVudFRpbWU/OiBudW1iZXI7XG4gIFxuICAvLyBMZWFkZXJib2FyZFxuICBsZWFkZXJib2FyZDogTGVhZGVyYm9hcmRFbnRyeVtdO1xuICBcbiAgLy8gU3RhdGVcbiAgaXNQbGF5aW5nPzogYm9vbGVhbjtcbiAgaXNSZWNvcmRpbmc/OiBib29sZWFuO1xuICBvblN0YXJ0PzogKCkgPT4gdm9pZDtcbiAgb25TcGVlZENoYW5nZT86IChzcGVlZDogUGxheWJhY2tTcGVlZCkgPT4gdm9pZDtcbiAgXG4gIC8vIExpbmUgc2NvcmVzIGZvciB2aXN1YWwgZmVlZGJhY2tcbiAgbGluZVNjb3Jlcz86IEFycmF5PHsgbGluZUluZGV4OiBudW1iZXI7IHNjb3JlOiBudW1iZXI7IHRyYW5zY3JpcHRpb246IHN0cmluZzsgZmVlZGJhY2s/OiBzdHJpbmcgfT47XG4gIFxuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEV4dGVuc2lvbkthcmFva2VWaWV3OiBDb21wb25lbnQ8RXh0ZW5zaW9uS2FyYW9rZVZpZXdQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgLy8gR2V0IHRoZSBsYXRlc3QgaGlnaCBzY29yZSBsaW5lIGluZGV4XG4gIGNvbnN0IGdldExhdGVzdEhpZ2hTY29yZUxpbmUgPSAoKSA9PiB7XG4gICAgY29uc3Qgc2NvcmVzID0gcHJvcHMubGluZVNjb3JlcyB8fCBbXTtcbiAgICBpZiAoc2NvcmVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHsgc2NvcmU6IDAsIGxpbmVJbmRleDogLTEgfTtcbiAgICBcbiAgICBjb25zdCBsYXRlc3QgPSBzY29yZXNbc2NvcmVzLmxlbmd0aCAtIDFdO1xuICAgIHJldHVybiB7XG4gICAgICBzY29yZTogbGF0ZXN0Py5zY29yZSB8fCAwLFxuICAgICAgbGluZUluZGV4OiBsYXRlc3Q/LmxpbmVJbmRleCB8fCAtMVxuICAgIH07XG4gIH07XG4gIFxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sIGgtZnVsbCBiZy1iYXNlIHJlbGF0aXZlJywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBTY29yZSBQYW5lbCAtIG9ubHkgc2hvdyB3aGVuIG5vdCBwbGF5aW5nICovfVxuICAgICAgPFNob3cgd2hlbj17IXByb3BzLmlzUGxheWluZ30+XG4gICAgICAgIDxTY29yZVBhbmVsXG4gICAgICAgICAgc2NvcmU9e3Byb3BzLnNjb3JlfVxuICAgICAgICAgIHJhbms9e3Byb3BzLnJhbmt9XG4gICAgICAgIC8+XG4gICAgICA8L1Nob3c+XG5cbiAgICAgIHsvKiBTaG93IHRhYnMgb25seSB3aGVuIG5vdCBwbGF5aW5nICovfVxuICAgICAgPFNob3cgd2hlbj17IXByb3BzLmlzUGxheWluZ30gZmFsbGJhY2s9e1xuICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIGZsZXggZmxleC1jb2wgbWluLWgtMFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgbWluLWgtMCBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgIDxMeXJpY3NEaXNwbGF5XG4gICAgICAgICAgICAgIGx5cmljcz17cHJvcHMubHlyaWNzfVxuICAgICAgICAgICAgICBjdXJyZW50VGltZT17cHJvcHMuY3VycmVudFRpbWV9XG4gICAgICAgICAgICAgIGlzUGxheWluZz17cHJvcHMuaXNQbGF5aW5nfVxuICAgICAgICAgICAgICBsaW5lU2NvcmVzPXtwcm9wcy5saW5lU2NvcmVzfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICB9PlxuICAgICAgICB7LyogVGFicyBhbmQgY29udGVudCAqL31cbiAgICAgICAgPFRhYnMgXG4gICAgICAgICAgdGFicz17W1xuICAgICAgICAgICAgeyBpZDogJ2x5cmljcycsIGxhYmVsOiAnTHlyaWNzJyB9LFxuICAgICAgICAgICAgeyBpZDogJ2xlYWRlcmJvYXJkJywgbGFiZWw6ICdMZWFkZXJib2FyZCcgfVxuICAgICAgICAgIF19XG4gICAgICAgICAgZGVmYXVsdFRhYj1cImx5cmljc1wiXG4gICAgICAgICAgY2xhc3M9XCJmbGV4LTEgZmxleCBmbGV4LWNvbCBtaW4taC0wXCJcbiAgICAgICAgPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJweC00XCI+XG4gICAgICAgICAgICA8VGFic0xpc3Q+XG4gICAgICAgICAgICAgIDxUYWJzVHJpZ2dlciB2YWx1ZT1cImx5cmljc1wiPkx5cmljczwvVGFic1RyaWdnZXI+XG4gICAgICAgICAgICAgIDxUYWJzVHJpZ2dlciB2YWx1ZT1cImxlYWRlcmJvYXJkXCI+TGVhZGVyYm9hcmQ8L1RhYnNUcmlnZ2VyPlxuICAgICAgICAgICAgPC9UYWJzTGlzdD5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICBcbiAgICAgICAgICA8VGFic0NvbnRlbnQgdmFsdWU9XCJseXJpY3NcIiBjbGFzcz1cImZsZXgtMSBtaW4taC0wXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBmbGV4LWNvbCBoLWZ1bGxcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBtaW4taC0wIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgICAgIDxMeXJpY3NEaXNwbGF5XG4gICAgICAgICAgICAgICAgICBseXJpY3M9e3Byb3BzLmx5cmljc31cbiAgICAgICAgICAgICAgICAgIGN1cnJlbnRUaW1lPXtwcm9wcy5jdXJyZW50VGltZX1cbiAgICAgICAgICAgICAgICAgIGlzUGxheWluZz17cHJvcHMuaXNQbGF5aW5nfVxuICAgICAgICAgICAgICAgICAgbGluZVNjb3Jlcz17cHJvcHMubGluZVNjb3Jlc31cbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIHsvKiBGb290ZXIgd2l0aCBzdGFydCBidXR0b24gKi99XG4gICAgICAgICAgICAgIDxTaG93IHdoZW49eyFwcm9wcy5pc1BsYXlpbmcgJiYgcHJvcHMub25TdGFydH0+XG4gICAgICAgICAgICAgICAgPGRpdiBcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwicC00IGJnLXN1cmZhY2UgYm9yZGVyLXQgYm9yZGVyLXN1YnRsZVwiXG4gICAgICAgICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAgICAgICAnZmxleC1zaHJpbmsnOiAnMCdcbiAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPFNwbGl0QnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIG9uU3RhcnQ9e3Byb3BzLm9uU3RhcnR9XG4gICAgICAgICAgICAgICAgICAgIG9uU3BlZWRDaGFuZ2U9e3Byb3BzLm9uU3BlZWRDaGFuZ2V9XG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1RhYnNDb250ZW50PlxuICAgICAgICAgIFxuICAgICAgICAgIDxUYWJzQ29udGVudCB2YWx1ZT1cImxlYWRlcmJvYXJkXCIgY2xhc3M9XCJmbGV4LTEgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwib3ZlcmZsb3cteS1hdXRvIGgtZnVsbFwiPlxuICAgICAgICAgICAgICA8TGVhZGVyYm9hcmRQYW5lbCBlbnRyaWVzPXtwcm9wcy5sZWFkZXJib2FyZH0gLz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvVGFic0NvbnRlbnQ+XG4gICAgICAgIDwvVGFicz5cbiAgICAgIDwvU2hvdz5cbiAgICAgIFxuICAgICAgey8qIEZpcmUgZW1vamkgZWZmZWN0ICovfVxuICAgICAgPFNob3cgd2hlbj17cHJvcHMuaXNQbGF5aW5nfT5cbiAgICAgICAgPEZpcmVFbW9qaUFuaW1hdGlvbiBcbiAgICAgICAgICBzY29yZT17Z2V0TGF0ZXN0SGlnaFNjb3JlTGluZSgpLnNjb3JlfSBcbiAgICAgICAgICBsaW5lSW5kZXg9e2dldExhdGVzdEhpZ2hTY29yZUxpbmUoKS5saW5lSW5kZXh9XG4gICAgICAgIC8+XG4gICAgICA8L1Nob3c+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZUNvbnRleHQsIHVzZUNvbnRleHQsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlRWZmZWN0LCBjcmVhdGVNZW1vIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBQYXJlbnRDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IFRyYW5zbGF0aW9ucywgTG9jYWxlQ29kZSB9IGZyb20gJy4vdHlwZXMnO1xuXG5pbnRlcmZhY2UgSTE4bkNvbnRleHRWYWx1ZSB7XG4gIGxvY2FsZTogKCkgPT4gTG9jYWxlQ29kZTtcbiAgc2V0TG9jYWxlOiAobG9jYWxlOiBMb2NhbGVDb2RlKSA9PiB2b2lkO1xuICB0OiAoa2V5OiBzdHJpbmcsIHBhcmFtcz86IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IHN0cmluZztcbiAgZGlyOiAoKSA9PiAnbHRyJyB8ICdydGwnO1xuICBmb3JtYXROdW1iZXI6IChudW06IG51bWJlcikgPT4gc3RyaW5nO1xuICBmb3JtYXREYXRlOiAoZGF0ZTogRGF0ZSwgb3B0aW9ucz86IEludGwuRGF0ZVRpbWVGb3JtYXRPcHRpb25zKSA9PiBzdHJpbmc7XG59XG5cbmNvbnN0IEkxOG5Db250ZXh0ID0gY3JlYXRlQ29udGV4dDxJMThuQ29udGV4dFZhbHVlPigpO1xuXG5leHBvcnQgY29uc3QgSTE4blByb3ZpZGVyOiBQYXJlbnRDb21wb25lbnQ8eyBkZWZhdWx0TG9jYWxlPzogTG9jYWxlQ29kZSB9PiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbbG9jYWxlLCBzZXRMb2NhbGVdID0gY3JlYXRlU2lnbmFsPExvY2FsZUNvZGU+KHByb3BzLmRlZmF1bHRMb2NhbGUgfHwgJ2VuJyk7XG4gIGNvbnN0IFt0cmFuc2xhdGlvbnMsIHNldFRyYW5zbGF0aW9uc10gPSBjcmVhdGVTaWduYWw8VHJhbnNsYXRpb25zPigpO1xuICBcbiAgLy8gTG9hZCB0cmFuc2xhdGlvbnMgZHluYW1pY2FsbHlcbiAgY3JlYXRlRWZmZWN0KGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBjdXJyZW50TG9jYWxlID0gbG9jYWxlKCk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1vZHVsZSA9IGF3YWl0IGltcG9ydChgLi9sb2NhbGVzLyR7Y3VycmVudExvY2FsZX0vaW5kZXgudHNgKTtcbiAgICAgIHNldFRyYW5zbGF0aW9ucyhtb2R1bGUuZGVmYXVsdCk7XG4gICAgfSBjYXRjaCAoX2UpIHtcbiAgICAgIGNvbnNvbGUud2FybihgRmFpbGVkIHRvIGxvYWQgbG9jYWxlICR7Y3VycmVudExvY2FsZX0sIGZhbGxpbmcgYmFjayB0byBFbmdsaXNoYCk7XG4gICAgICBjb25zdCBtb2R1bGUgPSBhd2FpdCBpbXBvcnQoJy4vbG9jYWxlcy9lbi9pbmRleC50cycpO1xuICAgICAgc2V0VHJhbnNsYXRpb25zKG1vZHVsZS5kZWZhdWx0KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIERlZXAga2V5IGFjY2VzcyB3aXRoIGRvdCBub3RhdGlvblxuICBjb25zdCB0ID0gKGtleTogc3RyaW5nLCBwYXJhbXM/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiB7XG4gICAgY29uc3Qga2V5cyA9IGtleS5zcGxpdCgnLicpO1xuICAgIGxldCB2YWx1ZTogYW55ID0gdHJhbnNsYXRpb25zKCk7XG4gICAgXG4gICAgZm9yIChjb25zdCBrIG9mIGtleXMpIHtcbiAgICAgIHZhbHVlID0gdmFsdWU/LltrXTtcbiAgICB9XG4gICAgXG4gICAgLy8gSGFuZGxlIHBhcmFtZXRlciByZXBsYWNlbWVudFxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHBhcmFtcykge1xuICAgICAgcmV0dXJuIHZhbHVlLnJlcGxhY2UoL1xce1xceyhcXHcrKVxcfVxcfS9nLCAoXywgaykgPT4gU3RyaW5nKHBhcmFtc1trXSB8fCAnJykpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gdmFsdWUgfHwga2V5O1xuICB9O1xuXG4gIC8vIERpcmVjdGlvbiAoZm9yIFJUTCBsYW5ndWFnZXMgaW4gZnV0dXJlKVxuICBjb25zdCBkaXIgPSAoKTogJ2x0cicgfCAncnRsJyA9PiAnbHRyJzsgLy8gT25seSBMVFIgbGFuZ3VhZ2VzIHN1cHBvcnRlZCBjdXJyZW50bHlcblxuICAvLyBOdW1iZXIgZm9ybWF0dGluZ1xuICBjb25zdCBudW1iZXJGb3JtYXR0ZXIgPSBjcmVhdGVNZW1vKCgpID0+IFxuICAgIG5ldyBJbnRsLk51bWJlckZvcm1hdChsb2NhbGUoKSlcbiAgKTtcblxuICBjb25zdCBmb3JtYXROdW1iZXIgPSAobnVtOiBudW1iZXIpID0+IG51bWJlckZvcm1hdHRlcigpLmZvcm1hdChudW0pO1xuXG4gIC8vIERhdGUgZm9ybWF0dGluZ1xuICBjb25zdCBmb3JtYXREYXRlID0gKGRhdGU6IERhdGUsIG9wdGlvbnM/OiBJbnRsLkRhdGVUaW1lRm9ybWF0T3B0aW9ucykgPT4ge1xuICAgIHJldHVybiBuZXcgSW50bC5EYXRlVGltZUZvcm1hdChsb2NhbGUoKSwgb3B0aW9ucykuZm9ybWF0KGRhdGUpO1xuICB9O1xuXG4gIGNvbnN0IHZhbHVlOiBJMThuQ29udGV4dFZhbHVlID0ge1xuICAgIGxvY2FsZSxcbiAgICBzZXRMb2NhbGUsXG4gICAgdCxcbiAgICBkaXIsXG4gICAgZm9ybWF0TnVtYmVyLFxuICAgIGZvcm1hdERhdGUsXG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8STE4bkNvbnRleHQuUHJvdmlkZXIgdmFsdWU9e3ZhbHVlfT5cbiAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICA8L0kxOG5Db250ZXh0LlByb3ZpZGVyPlxuICApO1xufTtcblxuZXhwb3J0IGNvbnN0IHVzZUkxOG4gPSAoKSA9PiB7XG4gIGNvbnN0IGNvbnRleHQgPSB1c2VDb250ZXh0KEkxOG5Db250ZXh0KTtcbiAgaWYgKCFjb250ZXh0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd1c2VJMThuIG11c3QgYmUgdXNlZCB3aXRoaW4gSTE4blByb3ZpZGVyJyk7XG4gIH1cbiAgcmV0dXJuIGNvbnRleHQ7XG59OyIsImltcG9ydCB7IFNob3csIGNyZWF0ZU1lbW8gfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuaW1wb3J0IHR5cGUgeyBQbGF5YmFja1NwZWVkIH0gZnJvbSAnLi4vLi4vY29tbW9uL1NwbGl0QnV0dG9uJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9CdXR0b24nO1xuaW1wb3J0IHsgdXNlSTE4biB9IGZyb20gJy4uLy4uLy4uL2kxOG4nO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbXBsZXRpb25WaWV3UHJvcHMge1xuICBzY29yZTogbnVtYmVyO1xuICByYW5rOiBudW1iZXI7XG4gIHNwZWVkOiBQbGF5YmFja1NwZWVkO1xuICBmZWVkYmFja1RleHQ/OiBzdHJpbmc7XG4gIG9uUHJhY3RpY2U/OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IENvbXBsZXRpb25WaWV3OiBDb21wb25lbnQ8Q29tcGxldGlvblZpZXdQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgeyB0LCBmb3JtYXROdW1iZXIgfSA9IHVzZUkxOG4oKTtcbiAgXG4gIC8vIEdldCBmZWVkYmFjayB0ZXh0IGJhc2VkIG9uIHNjb3JlXG4gIGNvbnN0IGdldEZlZWRiYWNrVGV4dCA9IGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGlmIChwcm9wcy5mZWVkYmFja1RleHQpIHJldHVybiBwcm9wcy5mZWVkYmFja1RleHQ7XG4gICAgXG4gICAgaWYgKHByb3BzLnNjb3JlID49IDk1KSByZXR1cm4gdCgna2FyYW9rZS5zY29yaW5nLnBlcmZlY3QnKTtcbiAgICBpZiAocHJvcHMuc2NvcmUgPj0gODUpIHJldHVybiB0KCdrYXJhb2tlLnNjb3JpbmcuZXhjZWxsZW50Jyk7XG4gICAgaWYgKHByb3BzLnNjb3JlID49IDcwKSByZXR1cm4gdCgna2FyYW9rZS5zY29yaW5nLmdyZWF0Jyk7XG4gICAgaWYgKHByb3BzLnNjb3JlID49IDUwKSByZXR1cm4gdCgna2FyYW9rZS5zY29yaW5nLmdvb2QnKTtcbiAgICByZXR1cm4gdCgna2FyYW9rZS5zY29yaW5nLmtlZXBQcmFjdGljaW5nJyk7XG4gIH0pO1xuICBcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZmxleCBmbGV4LWNvbCBoLWZ1bGwgYmctYmFzZScsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogTWFpbiBjb250ZW50IGFyZWEgKi99XG4gICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHAtNlwiPlxuICAgICAgICB7LyogU2NvcmUgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBmbGV4IGZsZXgtY29sIG1iLTEwXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtbGcgdGV4dC1zZWNvbmRhcnkgbWItMyBvcmRlci0xXCI+e3QoJ2thcmFva2Uuc2NvcmluZy5zY29yZScpfTwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTd4bCBmb250LW1vbm8gZm9udC1ib2xkIHRleHQtYWNjZW50LXByaW1hcnkgb3JkZXItMlwiPlxuICAgICAgICAgICAge2Zvcm1hdE51bWJlcihwcm9wcy5zY29yZSl9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICBcbiAgICAgICAgey8qIFN0YXRzIHJvdyAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZ2FwLTEyIG1iLTEyXCI+XG4gICAgICAgICAgey8qIFJhbmsgKi99XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIGZsZXggZmxleC1jb2xcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5IG1iLTIgb3JkZXItMVwiPlJhbms8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTN4bCBmb250LWJvbGQgdGV4dC1wcmltYXJ5IG9yZGVyLTJcIj4je2Zvcm1hdE51bWJlcihwcm9wcy5yYW5rKX08L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICBcbiAgICAgICAgICB7LyogU3BlZWQgKi99XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIGZsZXggZmxleC1jb2xcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5IG1iLTIgb3JkZXItMVwiPnt0KCdjb21tb24uc3BlZWQubGFiZWwnKX08L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTN4bCBmb250LWJvbGQgdGV4dC1wcmltYXJ5IG9yZGVyLTJcIj57cHJvcHMuc3BlZWR9PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICBcbiAgICAgICAgey8qIEZlZWRiYWNrIHRleHQgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy1tZCB0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC14bCB0ZXh0LXByaW1hcnkgbGVhZGluZy1yZWxheGVkXCI+XG4gICAgICAgICAgICB7Z2V0RmVlZGJhY2tUZXh0KCl9XG4gICAgICAgICAgPC9wPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgXG4gICAgICB7LyogRm9vdGVyIHdpdGggcHJhY3RpY2UgYnV0dG9uIC0gcG9zaXRpb25lZCBhdCBib3R0b20gb2Ygd2lkZ2V0ICovfVxuICAgICAgPFNob3cgd2hlbj17cHJvcHMub25QcmFjdGljZX0+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJwLTQgYmctc3VyZmFjZSBib3JkZXItdCBib3JkZXItc3VidGxlXCI+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgdmFyaWFudD1cInByaW1hcnlcIlxuICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgIGZ1bGxXaWR0aFxuICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25QcmFjdGljZX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICBQcmFjdGljZSBFcnJvcnNcbiAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L1Nob3c+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCwgb25DbGVhbnVwIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBBdWRpb1Byb2Nlc3Nvck9wdGlvbnMgfSBmcm9tICdAc2NhcmxldHQvY29yZSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVLYXJhb2tlQXVkaW9Qcm9jZXNzb3Iob3B0aW9ucz86IEF1ZGlvUHJvY2Vzc29yT3B0aW9ucykge1xuICBjb25zdCBbYXVkaW9Db250ZXh0LCBzZXRBdWRpb0NvbnRleHRdID0gY3JlYXRlU2lnbmFsPEF1ZGlvQ29udGV4dCB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbbWVkaWFTdHJlYW0sIHNldE1lZGlhU3RyZWFtXSA9IGNyZWF0ZVNpZ25hbDxNZWRpYVN0cmVhbSB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbLCBzZXRBdWRpb1dvcmtsZXROb2RlXSA9IGNyZWF0ZVNpZ25hbDxBdWRpb1dvcmtsZXROb2RlIHwgbnVsbD4obnVsbCk7XG4gIFxuICBjb25zdCBbaXNSZWFkeSwgc2V0SXNSZWFkeV0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IGNyZWF0ZVNpZ25hbDxFcnJvciB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbaXNMaXN0ZW5pbmcsIHNldElzTGlzdGVuaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIFxuICBjb25zdCBbY3VycmVudFJlY29yZGluZ0xpbmUsIHNldEN1cnJlbnRSZWNvcmRpbmdMaW5lXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW3JlY29yZGVkQXVkaW9CdWZmZXIsIHNldFJlY29yZGVkQXVkaW9CdWZmZXJdID0gY3JlYXRlU2lnbmFsPEZsb2F0MzJBcnJheVtdPihbXSk7XG4gIFxuICBjb25zdCBbaXNTZXNzaW9uQWN0aXZlLCBzZXRJc1Nlc3Npb25BY3RpdmVdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2Z1bGxTZXNzaW9uQnVmZmVyLCBzZXRGdWxsU2Vzc2lvbkJ1ZmZlcl0gPSBjcmVhdGVTaWduYWw8RmxvYXQzMkFycmF5W10+KFtdKTtcbiAgXG4gIGNvbnN0IHNhbXBsZVJhdGUgPSBvcHRpb25zPy5zYW1wbGVSYXRlIHx8IDE2MDAwO1xuICBcbiAgY29uc3QgaW5pdGlhbGl6ZSA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoYXVkaW9Db250ZXh0KCkpIHJldHVybjtcbiAgICBzZXRFcnJvcihudWxsKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgXG4gICAgICBjb25zdCBjdHggPSBuZXcgQXVkaW9Db250ZXh0KHsgc2FtcGxlUmF0ZSB9KTtcbiAgICAgIHNldEF1ZGlvQ29udGV4dChjdHgpO1xuICAgICAgXG4gICAgICBjb25zdCBzdHJlYW0gPSBhd2FpdCBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSh7XG4gICAgICAgIGF1ZGlvOiB7XG4gICAgICAgICAgc2FtcGxlUmF0ZSxcbiAgICAgICAgICBjaGFubmVsQ291bnQ6IDEsXG4gICAgICAgICAgZWNob0NhbmNlbGxhdGlvbjogZmFsc2UsXG4gICAgICAgICAgbm9pc2VTdXBwcmVzc2lvbjogZmFsc2UsXG4gICAgICAgICAgYXV0b0dhaW5Db250cm9sOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0TWVkaWFTdHJlYW0oc3RyZWFtKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY3R4LmF1ZGlvV29ya2xldC5hZGRNb2R1bGUoY3JlYXRlQXVkaW9Xb3JrbGV0UHJvY2Vzc29yKCkpO1xuICAgICAgXG4gICAgICBjb25zdCB3b3JrbGV0Tm9kZSA9IG5ldyBBdWRpb1dvcmtsZXROb2RlKGN0eCwgJ2thcmFva2UtYXVkaW8tcHJvY2Vzc29yJywge1xuICAgICAgICBudW1iZXJPZklucHV0czogMSxcbiAgICAgICAgbnVtYmVyT2ZPdXRwdXRzOiAwLFxuICAgICAgICBjaGFubmVsQ291bnQ6IDEsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgd29ya2xldE5vZGUucG9ydC5vbm1lc3NhZ2UgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgaWYgKGV2ZW50LmRhdGEudHlwZSA9PT0gJ2F1ZGlvRGF0YScpIHtcbiAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KGV2ZW50LmRhdGEuYXVkaW9EYXRhKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoY3VycmVudFJlY29yZGluZ0xpbmUoKSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgc2V0UmVjb3JkZWRBdWRpb0J1ZmZlcigocHJldikgPT4gWy4uLnByZXYsIGF1ZGlvRGF0YV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoaXNTZXNzaW9uQWN0aXZlKCkpIHtcbiAgICAgICAgICAgIHNldEZ1bGxTZXNzaW9uQnVmZmVyKChwcmV2KSA9PiBbLi4ucHJldiwgYXVkaW9EYXRhXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgXG4gICAgICBzZXRBdWRpb1dvcmtsZXROb2RlKHdvcmtsZXROb2RlKTtcbiAgICAgIFxuICAgICAgY29uc3Qgc291cmNlID0gY3R4LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG4gICAgICBjb25zdCBnYWluTm9kZSA9IGN0eC5jcmVhdGVHYWluKCk7XG4gICAgICBnYWluTm9kZS5nYWluLnZhbHVlID0gMS4yO1xuICAgICAgXG4gICAgICBzb3VyY2UuY29ubmVjdChnYWluTm9kZSk7XG4gICAgICBnYWluTm9kZS5jb25uZWN0KHdvcmtsZXROb2RlKTtcbiAgICAgIFxuICAgICAgc2V0SXNSZWFkeSh0cnVlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBGYWlsZWQgdG8gaW5pdGlhbGl6ZTonLCBlKTtcbiAgICAgIHNldEVycm9yKGUgaW5zdGFuY2VvZiBFcnJvciA/IGUgOiBuZXcgRXJyb3IoJ1Vua25vd24gYXVkaW8gaW5pdGlhbGl6YXRpb24gZXJyb3InKSk7XG4gICAgICBzZXRJc1JlYWR5KGZhbHNlKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBjcmVhdGVBdWRpb1dvcmtsZXRQcm9jZXNzb3IgPSAoKSA9PiB7XG4gICAgY29uc3QgcHJvY2Vzc29yQ29kZSA9IGBcbiAgICAgIGNsYXNzIEthcmFva2VBdWRpb1Byb2Nlc3NvciBleHRlbmRzIEF1ZGlvV29ya2xldFByb2Nlc3NvciB7XG4gICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgIHN1cGVyKCk7XG4gICAgICAgICAgdGhpcy5idWZmZXJTaXplID0gMTAyNDtcbiAgICAgICAgICB0aGlzLnJtc0hpc3RvcnkgPSBbXTtcbiAgICAgICAgICB0aGlzLm1heEhpc3RvcnlMZW5ndGggPSAxMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3MoaW5wdXRzLCBvdXRwdXRzLCBwYXJhbWV0ZXJzKSB7XG4gICAgICAgICAgY29uc3QgaW5wdXQgPSBpbnB1dHNbMF07XG4gICAgICAgICAgaWYgKGlucHV0ICYmIGlucHV0WzBdKSB7XG4gICAgICAgICAgICBjb25zdCBpbnB1dERhdGEgPSBpbnB1dFswXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHN1bSA9IDA7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0RGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBzdW0gKz0gaW5wdXREYXRhW2ldICogaW5wdXREYXRhW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgcm1zID0gTWF0aC5zcXJ0KHN1bSAvIGlucHV0RGF0YS5sZW5ndGgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLnJtc0hpc3RvcnkucHVzaChybXMpO1xuICAgICAgICAgICAgaWYgKHRoaXMucm1zSGlzdG9yeS5sZW5ndGggPiB0aGlzLm1heEhpc3RvcnlMZW5ndGgpIHtcbiAgICAgICAgICAgICAgdGhpcy5ybXNIaXN0b3J5LnNoaWZ0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGF2Z1JtcyA9IHRoaXMucm1zSGlzdG9yeS5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLCAwKSAvIHRoaXMucm1zSGlzdG9yeS5sZW5ndGg7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMucG9ydC5wb3N0TWVzc2FnZSh7XG4gICAgICAgICAgICAgIHR5cGU6ICdhdWRpb0RhdGEnLFxuICAgICAgICAgICAgICBhdWRpb0RhdGE6IGlucHV0RGF0YSxcbiAgICAgICAgICAgICAgcm1zTGV2ZWw6IHJtcyxcbiAgICAgICAgICAgICAgYXZnUm1zTGV2ZWw6IGF2Z1JtcyxcbiAgICAgICAgICAgICAgaXNUb29RdWlldDogYXZnUm1zIDwgMC4wMSxcbiAgICAgICAgICAgICAgaXNUb29Mb3VkOiBhdmdSbXMgPiAwLjNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmVnaXN0ZXJQcm9jZXNzb3IoJ2thcmFva2UtYXVkaW8tcHJvY2Vzc29yJywgS2FyYW9rZUF1ZGlvUHJvY2Vzc29yKTtcbiAgICBgO1xuICAgIFxuICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbcHJvY2Vzc29yQ29kZV0sIHsgdHlwZTogJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnIH0pO1xuICAgIHJldHVybiBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuICB9O1xuICBcbiAgY29uc3Qgc3RhcnRMaXN0ZW5pbmcgPSAoKSA9PiB7XG4gICAgY29uc3QgY3R4ID0gYXVkaW9Db250ZXh0KCk7XG4gICAgaWYgKGN0eCAmJiBjdHguc3RhdGUgPT09ICdzdXNwZW5kZWQnKSB7XG4gICAgICBjdHgucmVzdW1lKCk7XG4gICAgfVxuICAgIHNldElzTGlzdGVuaW5nKHRydWUpO1xuICB9O1xuICBcbiAgY29uc3QgcGF1c2VMaXN0ZW5pbmcgPSAoKSA9PiB7XG4gICAgY29uc3QgY3R4ID0gYXVkaW9Db250ZXh0KCk7XG4gICAgaWYgKGN0eCAmJiBjdHguc3RhdGUgPT09ICdydW5uaW5nJykge1xuICAgICAgY3R4LnN1c3BlbmQoKTtcbiAgICB9XG4gICAgc2V0SXNMaXN0ZW5pbmcoZmFsc2UpO1xuICB9O1xuICBcbiAgY29uc3QgY2xlYW51cCA9ICgpID0+IHtcbiAgICBcbiAgICBjb25zdCBzdHJlYW0gPSBtZWRpYVN0cmVhbSgpO1xuICAgIGlmIChzdHJlYW0pIHtcbiAgICAgIHN0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKCh0cmFjaykgPT4gdHJhY2suc3RvcCgpKTtcbiAgICAgIHNldE1lZGlhU3RyZWFtKG51bGwpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBjdHggPSBhdWRpb0NvbnRleHQoKTtcbiAgICBpZiAoY3R4ICYmIGN0eC5zdGF0ZSAhPT0gJ2Nsb3NlZCcpIHtcbiAgICAgIGN0eC5jbG9zZSgpO1xuICAgICAgc2V0QXVkaW9Db250ZXh0KG51bGwpO1xuICAgIH1cbiAgICBcbiAgICBzZXRBdWRpb1dvcmtsZXROb2RlKG51bGwpO1xuICAgIHNldElzUmVhZHkoZmFsc2UpO1xuICAgIHNldElzTGlzdGVuaW5nKGZhbHNlKTtcbiAgfTtcbiAgXG4gIG9uQ2xlYW51cChjbGVhbnVwKTtcbiAgXG4gIGNvbnN0IHN0YXJ0UmVjb3JkaW5nTGluZSA9IChsaW5lSW5kZXg6IG51bWJlcikgPT4ge1xuICAgIFxuICAgIHNldEN1cnJlbnRSZWNvcmRpbmdMaW5lKGxpbmVJbmRleCk7XG4gICAgc2V0UmVjb3JkZWRBdWRpb0J1ZmZlcihbXSk7XG4gICAgXG4gICAgaWYgKGlzUmVhZHkoKSAmJiAhaXNMaXN0ZW5pbmcoKSkge1xuICAgICAgc3RhcnRMaXN0ZW5pbmcoKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBzdG9wUmVjb3JkaW5nTGluZUFuZEdldFJhd0F1ZGlvID0gKCk6IEZsb2F0MzJBcnJheVtdID0+IHtcbiAgICBjb25zdCBsaW5lSW5kZXggPSBjdXJyZW50UmVjb3JkaW5nTGluZSgpO1xuICAgIGlmIChsaW5lSW5kZXggPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYXVkaW9CdWZmZXIgPSByZWNvcmRlZEF1ZGlvQnVmZmVyKCk7XG4gICAgXG4gICAgc2V0Q3VycmVudFJlY29yZGluZ0xpbmUobnVsbCk7XG4gICAgXG4gICAgY29uc3QgcmVzdWx0ID0gWy4uLmF1ZGlvQnVmZmVyXTtcbiAgICBzZXRSZWNvcmRlZEF1ZGlvQnVmZmVyKFtdKTtcbiAgICBcbiAgICBpZiAocmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuICBcbiAgY29uc3QgY29udmVydEF1ZGlvVG9XYXZCbG9iID0gKGF1ZGlvQ2h1bmtzOiBGbG9hdDMyQXJyYXlbXSk6IEJsb2IgfCBudWxsID0+IHtcbiAgICBpZiAoYXVkaW9DaHVua3MubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcbiAgICBcbiAgICBjb25zdCB0b3RhbExlbmd0aCA9IGF1ZGlvQ2h1bmtzLnJlZHVjZSgoc3VtLCBjaHVuaykgPT4gc3VtICsgY2h1bmsubGVuZ3RoLCAwKTtcbiAgICBjb25zdCBjb25jYXRlbmF0ZWQgPSBuZXcgRmxvYXQzMkFycmF5KHRvdGFsTGVuZ3RoKTtcbiAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICBmb3IgKGNvbnN0IGNodW5rIG9mIGF1ZGlvQ2h1bmtzKSB7XG4gICAgICBjb25jYXRlbmF0ZWQuc2V0KGNodW5rLCBvZmZzZXQpO1xuICAgICAgb2Zmc2V0ICs9IGNodW5rLmxlbmd0aDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGF1ZGlvQnVmZmVyVG9XYXYoY29uY2F0ZW5hdGVkLCBzYW1wbGVSYXRlKTtcbiAgfTtcbiAgXG4gIGNvbnN0IGF1ZGlvQnVmZmVyVG9XYXYgPSAoYnVmZmVyOiBGbG9hdDMyQXJyYXksIHNhbXBsZVJhdGU6IG51bWJlcik6IEJsb2IgPT4ge1xuICAgIGNvbnN0IGxlbmd0aCA9IGJ1ZmZlci5sZW5ndGg7XG4gICAgY29uc3QgYXJyYXlCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoNDQgKyBsZW5ndGggKiAyKTtcbiAgICBjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGFycmF5QnVmZmVyKTtcbiAgICBcbiAgICBjb25zdCB3cml0ZVN0cmluZyA9IChvZmZzZXQ6IG51bWJlciwgc3RyaW5nOiBzdHJpbmcpID0+IHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyaW5nLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZpZXcuc2V0VWludDgob2Zmc2V0ICsgaSwgc3RyaW5nLmNoYXJDb2RlQXQoaSkpO1xuICAgICAgfVxuICAgIH07XG4gICAgXG4gICAgd3JpdGVTdHJpbmcoMCwgJ1JJRkYnKTtcbiAgICB2aWV3LnNldFVpbnQzMig0LCAzNiArIGxlbmd0aCAqIDIsIHRydWUpO1xuICAgIHdyaXRlU3RyaW5nKDgsICdXQVZFJyk7XG4gICAgd3JpdGVTdHJpbmcoMTIsICdmbXQgJyk7XG4gICAgdmlldy5zZXRVaW50MzIoMTYsIDE2LCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigyMCwgMSwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMjIsIDEsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDMyKDI0LCBzYW1wbGVSYXRlLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQzMigyOCwgc2FtcGxlUmF0ZSAqIDIsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDMyLCAyLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigzNCwgMTYsIHRydWUpO1xuICAgIHdyaXRlU3RyaW5nKDM2LCAnZGF0YScpO1xuICAgIHZpZXcuc2V0VWludDMyKDQwLCBsZW5ndGggKiAyLCB0cnVlKTtcbiAgICBcbiAgICBjb25zdCBvZmZzZXQgPSA0NDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBzYW1wbGUgPSBNYXRoLm1heCgtMSwgTWF0aC5taW4oMSwgYnVmZmVyW2ldIHx8IDApKTtcbiAgICAgIHZpZXcuc2V0SW50MTYob2Zmc2V0ICsgaSAqIDIsIHNhbXBsZSAqIDB4N2ZmZiwgdHJ1ZSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBuZXcgQmxvYihbYXJyYXlCdWZmZXJdLCB7IHR5cGU6ICdhdWRpby93YXYnIH0pO1xuICB9O1xuICBcbiAgY29uc3Qgc3RhcnRGdWxsU2Vzc2lvbiA9ICgpID0+IHtcbiAgICBzZXRGdWxsU2Vzc2lvbkJ1ZmZlcihbXSk7XG4gICAgc2V0SXNTZXNzaW9uQWN0aXZlKHRydWUpO1xuICB9O1xuICBcbiAgY29uc3Qgc3RvcEZ1bGxTZXNzaW9uQW5kR2V0V2F2ID0gKCk6IEJsb2IgfCBudWxsID0+IHtcbiAgICBzZXRJc1Nlc3Npb25BY3RpdmUoZmFsc2UpO1xuICAgIFxuICAgIGNvbnN0IHNlc3Npb25DaHVua3MgPSBmdWxsU2Vzc2lvbkJ1ZmZlcigpO1xuICAgIGNvbnN0IHdhdkJsb2IgPSBjb252ZXJ0QXVkaW9Ub1dhdkJsb2Ioc2Vzc2lvbkNodW5rcyk7XG4gICAgXG4gICAgXG4gICAgc2V0RnVsbFNlc3Npb25CdWZmZXIoW10pO1xuICAgIFxuICAgIHJldHVybiB3YXZCbG9iO1xuICB9O1xuICBcbiAgcmV0dXJuIHtcbiAgICBpc1JlYWR5LFxuICAgIGVycm9yLFxuICAgIGlzTGlzdGVuaW5nLFxuICAgIGlzU2Vzc2lvbkFjdGl2ZSxcbiAgICBcbiAgICBpbml0aWFsaXplLFxuICAgIHN0YXJ0TGlzdGVuaW5nLFxuICAgIHBhdXNlTGlzdGVuaW5nLFxuICAgIGNsZWFudXAsXG4gICAgc3RhcnRSZWNvcmRpbmdMaW5lLFxuICAgIHN0b3BSZWNvcmRpbmdMaW5lQW5kR2V0UmF3QXVkaW8sXG4gICAgY29udmVydEF1ZGlvVG9XYXZCbG9iLFxuICAgIFxuICAgIHN0YXJ0RnVsbFNlc3Npb24sXG4gICAgc3RvcEZ1bGxTZXNzaW9uQW5kR2V0V2F2LFxuICB9O1xufSIsImltcG9ydCB0eXBlIHtcbiAgQXBpUmVzcG9uc2UsXG4gIFN0YXJ0U2Vzc2lvblJlcXVlc3QsXG4gIEdyYWRlTGluZVJlcXVlc3QsXG4gIENvbXBsZXRlU2Vzc2lvblJlcXVlc3QsXG4gIFRyYW5zY3JpYmVSZXF1ZXN0LFxuICBUcmFuc2NyaWJlUmVzcG9uc2UsXG4gIEthcmFva2VEYXRhLFxuICBLYXJhb2tlU2Vzc2lvbixcbiAgTGluZVNjb3JlLFxuICBTZXNzaW9uUmVzdWx0cyxcbiAgRGVtb1Rva2VuUmVzcG9uc2UsXG4gIFVzZXJDcmVkaXRzUmVzcG9uc2UsXG4gIFB1cmNoYXNlQ3JlZGl0c1JlcXVlc3QsXG4gIFB1cmNoYXNlQ3JlZGl0c1Jlc3BvbnNlLFxuICBFeGVyY2lzZSxcbiAgUHJhY3RpY2VDYXJkLFxufSBmcm9tICdAc2NhcmxldHQvY29yZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXBpQ2xpZW50Q29uZmlnIHtcbiAgYmFzZVVybDogc3RyaW5nO1xuICBnZXRBdXRoVG9rZW4/OiAoKSA9PiBQcm9taXNlPHN0cmluZyB8IG51bGw+O1xuICBvbkVycm9yPzogKGVycm9yOiBFcnJvcikgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIEFwaUNsaWVudCB7XG4gIHByaXZhdGUgYmFzZVVybDogc3RyaW5nO1xuICBwcml2YXRlIGdldEF1dGhUb2tlbj86ICgpID0+IFByb21pc2U8c3RyaW5nIHwgbnVsbD47XG4gIHByaXZhdGUgb25FcnJvcj86IChlcnJvcjogRXJyb3IpID0+IHZvaWQ7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnOiBBcGlDbGllbnRDb25maWcpIHtcbiAgICB0aGlzLmJhc2VVcmwgPSBjb25maWcuYmFzZVVybC5yZXBsYWNlKC9cXC8kLywgJycpOyAvLyBSZW1vdmUgdHJhaWxpbmcgc2xhc2hcbiAgICB0aGlzLmdldEF1dGhUb2tlbiA9IGNvbmZpZy5nZXRBdXRoVG9rZW47XG4gICAgdGhpcy5vbkVycm9yID0gY29uZmlnLm9uRXJyb3I7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlcXVlc3Q8VD4oXG4gICAgcGF0aDogc3RyaW5nLFxuICAgIG9wdGlvbnM6IFJlcXVlc3RJbml0ID0ge31cbiAgKTogUHJvbWlzZTxUPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIC4uLihvcHRpb25zLmhlYWRlcnMgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPiB8fCB7fSksXG4gICAgICB9O1xuXG4gICAgICAvLyBBZGQgYXV0aCB0b2tlbiBpZiBhdmFpbGFibGVcbiAgICAgIGlmICh0aGlzLmdldEF1dGhUb2tlbikge1xuICAgICAgICBjb25zdCB0b2tlbiA9IGF3YWl0IHRoaXMuZ2V0QXV0aFRva2VuKCk7XG4gICAgICAgIGlmICh0b2tlbikge1xuICAgICAgICAgIGhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9IGBCZWFyZXIgJHt0b2tlbn1gO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7dGhpcy5iYXNlVXJsfSR7cGF0aH1gLCB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIGhlYWRlcnMsXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCBlcnJvciA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBUEkgRXJyb3IgJHtyZXNwb25zZS5zdGF0dXN9OiAke2Vycm9yfWApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYXdhaXQgcmVzcG9uc2UuanNvbigpIGFzIFQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGlmICh0aGlzLm9uRXJyb3IpIHtcbiAgICAgICAgdGhpcy5vbkVycm9yKGVycm9yIGFzIEVycm9yKTtcbiAgICAgIH1cbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8vIEhlYWx0aCBjaGVja1xuICBhc3luYyBoZWFsdGhDaGVjaygpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCcvaGVhbHRoJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvLyBBdXRoIGVuZHBvaW50c1xuICBhc3luYyBnZXREZW1vVG9rZW4oKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMucmVxdWVzdDxEZW1vVG9rZW5SZXNwb25zZT4oJy9hdXRoL2RlbW8nLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzcG9uc2UudG9rZW47XG4gIH1cblxuICBhc3luYyBnZXRVc2VyQ3JlZGl0cygpOiBQcm9taXNlPFVzZXJDcmVkaXRzUmVzcG9uc2U+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFVzZXJDcmVkaXRzUmVzcG9uc2U+KCcvYXBpL3VzZXIvY3JlZGl0cycpO1xuICB9XG5cbiAgYXN5bmMgcHVyY2hhc2VDcmVkaXRzKFxuICAgIHJlcXVlc3Q6IFB1cmNoYXNlQ3JlZGl0c1JlcXVlc3RcbiAgKTogUHJvbWlzZTxQdXJjaGFzZUNyZWRpdHNSZXNwb25zZT4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8UHVyY2hhc2VDcmVkaXRzUmVzcG9uc2U+KCcvYXBpL3VzZXIvY3JlZGl0cy9wdXJjaGFzZScsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVxdWVzdCksXG4gICAgfSk7XG4gIH1cblxuICAvLyBLYXJhb2tlIGVuZHBvaW50c1xuICBhc3luYyBnZXRLYXJhb2tlRGF0YSh0cmFja0lkOiBzdHJpbmcpOiBQcm9taXNlPEthcmFva2VEYXRhPiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxLYXJhb2tlRGF0YT4oYC9hcGkva2FyYW9rZS8ke2VuY29kZVVSSUNvbXBvbmVudCh0cmFja0lkKX1gKTtcbiAgfVxuXG4gIGFzeW5jIHN0YXJ0S2FyYW9rZVNlc3Npb24oXG4gICAgcmVxdWVzdDogU3RhcnRTZXNzaW9uUmVxdWVzdFxuICApOiBQcm9taXNlPEFwaVJlc3BvbnNlPEthcmFva2VTZXNzaW9uPj4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QXBpUmVzcG9uc2U8S2FyYW9rZVNlc3Npb24+PignL2FwaS9rYXJhb2tlL3N0YXJ0Jywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSxcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIGdyYWRlS2FyYW9rZUxpbmUoXG4gICAgcmVxdWVzdDogR3JhZGVMaW5lUmVxdWVzdFxuICApOiBQcm9taXNlPEFwaVJlc3BvbnNlPExpbmVTY29yZT4+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFwaVJlc3BvbnNlPExpbmVTY29yZT4+KCcvYXBpL2thcmFva2UvZ3JhZGUnLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpLFxuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgY29tcGxldGVLYXJhb2tlU2Vzc2lvbihcbiAgICByZXF1ZXN0OiBDb21wbGV0ZVNlc3Npb25SZXF1ZXN0XG4gICk6IFByb21pc2U8QXBpUmVzcG9uc2U8U2Vzc2lvblJlc3VsdHM+PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBcGlSZXNwb25zZTxTZXNzaW9uUmVzdWx0cz4+KCcvYXBpL2thcmFva2UvY29tcGxldGUnLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gU3BlZWNoLXRvLXRleHQgZW5kcG9pbnRzXG4gIGFzeW5jIHRyYW5zY3JpYmVBdWRpbyhcbiAgICByZXF1ZXN0OiBUcmFuc2NyaWJlUmVxdWVzdFxuICApOiBQcm9taXNlPFRyYW5zY3JpYmVSZXNwb25zZT4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8VHJhbnNjcmliZVJlc3BvbnNlPignL2FwaS9zcGVlY2gtdG8tdGV4dC90cmFuc2NyaWJlJywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFByYWN0aWNlIGVuZHBvaW50c1xuICBhc3luYyBnZXRQcmFjdGljZUV4ZXJjaXNlcyhcbiAgICBzZXNzaW9uSWQ/OiBzdHJpbmcsXG4gICAgbGltaXQgPSAxMFxuICApOiBQcm9taXNlPEFwaVJlc3BvbnNlPHsgZXhlcmNpc2VzOiBFeGVyY2lzZVtdOyBjYXJkczogUHJhY3RpY2VDYXJkW10gfT4+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCk7XG4gICAgaWYgKHNlc3Npb25JZCkgcGFyYW1zLmFwcGVuZCgnc2Vzc2lvbklkJywgc2Vzc2lvbklkKTtcbiAgICBwYXJhbXMuYXBwZW5kKCdsaW1pdCcsIGxpbWl0LnRvU3RyaW5nKCkpO1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBcGlSZXNwb25zZTx7IGV4ZXJjaXNlczogRXhlcmNpc2VbXTsgY2FyZHM6IFByYWN0aWNlQ2FyZFtdIH0+PihcbiAgICAgIGAvYXBpL3ByYWN0aWNlL2V4ZXJjaXNlcz8ke3BhcmFtc31gXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHN1Ym1pdFByYWN0aWNlUmV2aWV3KFxuICAgIGNhcmRJZDogc3RyaW5nLFxuICAgIHNjb3JlOiBudW1iZXIsXG4gICAgcmV2aWV3VGltZTogc3RyaW5nXG4gICk6IFByb21pc2U8QXBpUmVzcG9uc2U+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFwaVJlc3BvbnNlPignL2FwaS9wcmFjdGljZS9yZXZpZXcnLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgY2FyZElkLCBzY29yZSwgcmV2aWV3VGltZSB9KSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFVzZXIgZW5kcG9pbnRzXG4gIGFzeW5jIGdldFVzZXJCZXN0U2NvcmUoc29uZ0lkOiBzdHJpbmcpOiBQcm9taXNlPEFwaVJlc3BvbnNlPHsgc2NvcmU6IG51bWJlciB9Pj4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QXBpUmVzcG9uc2U8eyBzY29yZTogbnVtYmVyIH0+PihcbiAgICAgIGAvYXBpL3VzZXJzL21lL3NvbmdzLyR7c29uZ0lkfS9iZXN0LXNjb3JlYFxuICAgICk7XG4gIH1cblxuICAvLyBMZWFkZXJib2FyZCBlbmRwb2ludHNcbiAgYXN5bmMgZ2V0U29uZ0xlYWRlcmJvYXJkKFxuICAgIHNvbmdJZDogc3RyaW5nLFxuICAgIGxpbWl0ID0gMTBcbiAgKTogUHJvbWlzZTxBcGlSZXNwb25zZTxBcnJheTx7IHVzZXJJZDogc3RyaW5nOyBzY29yZTogbnVtYmVyOyByYW5rOiBudW1iZXIgfT4+PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBcGlSZXNwb25zZTxBcnJheTx7IHVzZXJJZDogc3RyaW5nOyBzY29yZTogbnVtYmVyOyByYW5rOiBudW1iZXIgfT4+PihcbiAgICAgIGAvYXBpL3NvbmdzLyR7c29uZ0lkfS9sZWFkZXJib2FyZD9saW1pdD0ke2xpbWl0fWBcbiAgICApO1xuICB9XG59IiwiaW1wb3J0IHR5cGUgeyBBcGlDbGllbnQgfSBmcm9tICcuLi9jbGllbnQnO1xuaW1wb3J0IHR5cGUge1xuICBLYXJhb2tlRGF0YSxcbiAgS2FyYW9rZVNlc3Npb24sXG4gIExpbmVTY29yZSxcbiAgU2Vzc2lvblJlc3VsdHMsXG4gIEFwaVJlc3BvbnNlLFxufSBmcm9tICdAc2NhcmxldHQvY29yZSc7XG5cbmV4cG9ydCBjbGFzcyBLYXJhb2tlRW5kcG9pbnQge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGNsaWVudDogQXBpQ2xpZW50KSB7fVxuXG4gIC8qKlxuICAgKiBGZXRjaCBrYXJhb2tlIGRhdGEgZm9yIGEgdHJhY2tcbiAgICovXG4gIGFzeW5jIGdldERhdGEodHJhY2tJZDogc3RyaW5nKTogUHJvbWlzZTxLYXJhb2tlRGF0YT4ge1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5nZXRLYXJhb2tlRGF0YSh0cmFja0lkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFydCBhIG5ldyBrYXJhb2tlIHNlc3Npb25cbiAgICovXG4gIGFzeW5jIHN0YXJ0U2Vzc2lvbihcbiAgICB0cmFja0lkOiBzdHJpbmcsXG4gICAgc29uZ0RhdGE6IHtcbiAgICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgICBhcnRpc3Q6IHN0cmluZztcbiAgICAgIGdlbml1c0lkPzogc3RyaW5nO1xuICAgICAgZHVyYXRpb24/OiBudW1iZXI7XG4gICAgICBkaWZmaWN1bHR5Pzogc3RyaW5nO1xuICAgIH0sXG4gICAgc29uZ0NhdGFsb2dJZD86IHN0cmluZ1xuICApOiBQcm9taXNlPEthcmFva2VTZXNzaW9uPiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNsaWVudC5zdGFydEthcmFva2VTZXNzaW9uKHtcbiAgICAgIHRyYWNrSWQsXG4gICAgICBzb25nRGF0YSxcbiAgICAgIHNvbmdDYXRhbG9nSWQsXG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLnN1Y2Nlc3MgfHwgIXJlc3BvbnNlLmRhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihyZXNwb25zZS5lcnJvciB8fCAnRmFpbGVkIHRvIHN0YXJ0IHNlc3Npb24nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHcmFkZSBhIGthcmFva2UgbGluZSByZWNvcmRpbmdcbiAgICovXG4gIGFzeW5jIGdyYWRlTGluZShcbiAgICBzZXNzaW9uSWQ6IHN0cmluZyxcbiAgICBsaW5lSW5kZXg6IG51bWJlcixcbiAgICBhdWRpb0Jhc2U2NDogc3RyaW5nLFxuICAgIGV4cGVjdGVkVGV4dDogc3RyaW5nLFxuICAgIHN0YXJ0VGltZTogbnVtYmVyLFxuICAgIGVuZFRpbWU6IG51bWJlclxuICApOiBQcm9taXNlPExpbmVTY29yZT4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuZ3JhZGVLYXJhb2tlTGluZSh7XG4gICAgICBzZXNzaW9uSWQsXG4gICAgICBsaW5lSW5kZXgsXG4gICAgICBhdWRpb0J1ZmZlcjogYXVkaW9CYXNlNjQsXG4gICAgICBleHBlY3RlZFRleHQsXG4gICAgICBzdGFydFRpbWUsXG4gICAgICBlbmRUaW1lLFxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXNwb25zZS5zdWNjZXNzIHx8ICFyZXNwb25zZS5kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IocmVzcG9uc2UuZXJyb3IgfHwgJ0ZhaWxlZCB0byBncmFkZSBsaW5lJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gIH1cblxuICAvKipcbiAgICogQ29tcGxldGUgYSBrYXJhb2tlIHNlc3Npb25cbiAgICovXG4gIGFzeW5jIGNvbXBsZXRlU2Vzc2lvbihcbiAgICBzZXNzaW9uSWQ6IHN0cmluZyxcbiAgICBmdWxsQXVkaW9CYXNlNjQ/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxTZXNzaW9uUmVzdWx0cz4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuY29tcGxldGVLYXJhb2tlU2Vzc2lvbih7XG4gICAgICBzZXNzaW9uSWQsXG4gICAgICBmdWxsQXVkaW9CdWZmZXI6IGZ1bGxBdWRpb0Jhc2U2NCxcbiAgICB9KTtcblxuICAgIGlmICghcmVzcG9uc2Uuc3VjY2VzcyB8fCAhcmVzcG9uc2UuZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHJlc3BvbnNlLmVycm9yIHx8ICdGYWlsZWQgdG8gY29tcGxldGUgc2Vzc2lvbicpO1xuICAgIH1cblxuICAgIHJldHVybiByZXNwb25zZS5kYXRhO1xuICB9XG59IiwiaW1wb3J0IHR5cGUgeyBBcGlDbGllbnQgfSBmcm9tICcuLi9jbGllbnQnO1xuaW1wb3J0IHR5cGUgeyBFeGVyY2lzZSwgUHJhY3RpY2VDYXJkIH0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuXG5leHBvcnQgY2xhc3MgUHJhY3RpY2VFbmRwb2ludCB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY2xpZW50OiBBcGlDbGllbnQpIHt9XG5cbiAgLyoqXG4gICAqIEdldCBwcmFjdGljZSBleGVyY2lzZXMgZm9yIGEgdXNlclxuICAgKi9cbiAgYXN5bmMgZ2V0RXhlcmNpc2VzKFxuICAgIHNlc3Npb25JZD86IHN0cmluZyxcbiAgICBsaW1pdCA9IDEwXG4gICk6IFByb21pc2U8eyBleGVyY2lzZXM6IEV4ZXJjaXNlW107IGNhcmRzOiBQcmFjdGljZUNhcmRbXSB9PiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNsaWVudC5nZXRQcmFjdGljZUV4ZXJjaXNlcyhzZXNzaW9uSWQsIGxpbWl0KTtcblxuICAgIGlmICghcmVzcG9uc2Uuc3VjY2VzcyB8fCAhcmVzcG9uc2UuZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHJlc3BvbnNlLmVycm9yIHx8ICdGYWlsZWQgdG8gZmV0Y2ggZXhlcmNpc2VzJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gIH1cblxuICAvKipcbiAgICogU3VibWl0IGEgcHJhY3RpY2UgcmV2aWV3XG4gICAqL1xuICBhc3luYyBzdWJtaXRSZXZpZXcoXG4gICAgY2FyZElkOiBzdHJpbmcsXG4gICAgc2NvcmU6IG51bWJlcixcbiAgICByZXZpZXdUaW1lOiBzdHJpbmcgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNsaWVudC5zdWJtaXRQcmFjdGljZVJldmlldyhcbiAgICAgIGNhcmRJZCxcbiAgICAgIHNjb3JlLFxuICAgICAgcmV2aWV3VGltZVxuICAgICk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLnN1Y2Nlc3MpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihyZXNwb25zZS5lcnJvciB8fCAnRmFpbGVkIHRvIHN1Ym1pdCByZXZpZXcnKTtcbiAgICB9XG4gIH1cbn0iLCJpbXBvcnQgdHlwZSB7IEFwaUNsaWVudCB9IGZyb20gJy4uL2NsaWVudCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHJhbnNjcmlwdGlvblJlc3VsdCB7XG4gIHRyYW5zY3JpcHQ6IHN0cmluZztcbiAgY29uZmlkZW5jZTogbnVtYmVyO1xuICBwcm92aWRlcj86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFNUVEVuZHBvaW50IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBjbGllbnQ6IEFwaUNsaWVudCkge31cblxuICAvKipcbiAgICogVHJhbnNjcmliZSBhdWRpbyB1c2luZyBzcGVlY2gtdG8tdGV4dFxuICAgKi9cbiAgYXN5bmMgdHJhbnNjcmliZShcbiAgICBhdWRpb0Jhc2U2NDogc3RyaW5nLFxuICAgIGV4cGVjdGVkVGV4dD86IHN0cmluZyxcbiAgICBwcmVmZXJEZWVwZ3JhbSA9IGZhbHNlXG4gICk6IFByb21pc2U8VHJhbnNjcmlwdGlvblJlc3VsdD4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQudHJhbnNjcmliZUF1ZGlvKHtcbiAgICAgIGF1ZGlvQmFzZTY0LFxuICAgICAgZXhwZWN0ZWRUZXh0LFxuICAgICAgcHJlZmVyRGVlcGdyYW0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLnN1Y2Nlc3MgfHwgIXJlc3BvbnNlLmRhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihyZXNwb25zZS5lcnJvciB8fCAnRmFpbGVkIHRvIHRyYW5zY3JpYmUgYXVkaW8nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmFuc2NyaWJlIHdpdGggcmV0cnkgbG9naWNcbiAgICovXG4gIGFzeW5jIHRyYW5zY3JpYmVXaXRoUmV0cnkoXG4gICAgYXVkaW9CYXNlNjQ6IHN0cmluZyxcbiAgICBleHBlY3RlZFRleHQ/OiBzdHJpbmcsXG4gICAgbWF4UmV0cmllcyA9IDJcbiAgKTogUHJvbWlzZTxUcmFuc2NyaXB0aW9uUmVzdWx0PiB7XG4gICAgbGV0IGxhc3RFcnJvcjogRXJyb3IgfCBudWxsID0gbnVsbDtcblxuICAgIGZvciAobGV0IGF0dGVtcHQgPSAxOyBhdHRlbXB0IDw9IG1heFJldHJpZXM7IGF0dGVtcHQrKykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gVHJ5IEVsZXZlbkxhYnMgZmlyc3RcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy50cmFuc2NyaWJlKFxuICAgICAgICAgIGF1ZGlvQmFzZTY0LFxuICAgICAgICAgIGV4cGVjdGVkVGV4dCxcbiAgICAgICAgICBmYWxzZVxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbGFzdEVycm9yID0gZXJyb3IgYXMgRXJyb3I7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbU1RUXSBBdHRlbXB0ICR7YXR0ZW1wdH0vJHttYXhSZXRyaWVzfSBmYWlsZWQ6YCwgZXJyb3IpO1xuXG4gICAgICAgIC8vIElmIGZpcnN0IGF0dGVtcHQgZmFpbGVkLCB0cnkgd2l0aCBEZWVwZ3JhbVxuICAgICAgICBpZiAoYXR0ZW1wdCA9PT0gMSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW1NUVF0gUmV0cnlpbmcgd2l0aCBEZWVwZ3JhbS4uLicpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy50cmFuc2NyaWJlKFxuICAgICAgICAgICAgICBhdWRpb0Jhc2U2NCxcbiAgICAgICAgICAgICAgZXhwZWN0ZWRUZXh0LFxuICAgICAgICAgICAgICB0cnVlXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICB9IGNhdGNoIChkZWVwZ3JhbUVycm9yKSB7XG4gICAgICAgICAgICBsYXN0RXJyb3IgPSBkZWVwZ3JhbUVycm9yIGFzIEVycm9yO1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1NUVF0gRGVlcGdyYW0gYWxzbyBmYWlsZWQ6JywgZGVlcGdyYW1FcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhyb3cgbGFzdEVycm9yIHx8IG5ldyBFcnJvcignU1RUIGZhaWxlZCBhZnRlciByZXRyaWVzJyk7XG4gIH1cbn0iLCJpbXBvcnQgdHlwZSB7IEFwaUNsaWVudCB9IGZyb20gJy4uL2NsaWVudCc7XG5pbXBvcnQgdHlwZSB7XG4gIFVzZXJDcmVkaXRzUmVzcG9uc2UsXG4gIFB1cmNoYXNlQ3JlZGl0c1JlcXVlc3QsXG4gIFB1cmNoYXNlQ3JlZGl0c1Jlc3BvbnNlLFxufSBmcm9tICdAc2NhcmxldHQvY29yZSc7XG5cbmV4cG9ydCBjbGFzcyBBdXRoRW5kcG9pbnQge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGNsaWVudDogQXBpQ2xpZW50KSB7fVxuXG4gIC8qKlxuICAgKiBHZXQgYSBkZW1vIGF1dGhlbnRpY2F0aW9uIHRva2VuXG4gICAqL1xuICBhc3luYyBnZXREZW1vVG9rZW4oKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZ2V0RGVtb1Rva2VuKCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGN1cnJlbnQgdXNlciBjcmVkaXRzXG4gICAqL1xuICBhc3luYyBnZXRVc2VyQ3JlZGl0cygpOiBQcm9taXNlPFVzZXJDcmVkaXRzUmVzcG9uc2U+IHtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZ2V0VXNlckNyZWRpdHMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQdXJjaGFzZSBjcmVkaXRzXG4gICAqL1xuICBhc3luYyBwdXJjaGFzZUNyZWRpdHMoXG4gICAgZmlkOiBudW1iZXIsXG4gICAgY3JlZGl0czogbnVtYmVyLFxuICAgIGNoYWluOiAnQmFzZScgfCAnU29sYW5hJyA9ICdCYXNlJyxcbiAgICB0cmFuc2FjdGlvbkhhc2g/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxQdXJjaGFzZUNyZWRpdHNSZXNwb25zZT4ge1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5wdXJjaGFzZUNyZWRpdHMoe1xuICAgICAgZmlkLFxuICAgICAgY3JlZGl0cyxcbiAgICAgIGNoYWluLFxuICAgICAgdHJhbnNhY3Rpb25IYXNoLFxuICAgIH0pO1xuICB9XG59IiwiaW1wb3J0IHsgQXBpQ2xpZW50LCB0eXBlIEFwaUNsaWVudENvbmZpZyB9IGZyb20gJy4vY2xpZW50JztcbmltcG9ydCB7XG4gIEthcmFva2VFbmRwb2ludCxcbiAgUHJhY3RpY2VFbmRwb2ludCxcbiAgU1RURW5kcG9pbnQsXG4gIEF1dGhFbmRwb2ludCxcbn0gZnJvbSAnLi9lbmRwb2ludHMnO1xuXG5leHBvcnQgeyBBcGlDbGllbnQsIHR5cGUgQXBpQ2xpZW50Q29uZmlnIH07XG5leHBvcnQgKiBmcm9tICcuL2VuZHBvaW50cyc7XG5cbi8qKlxuICogQ3JlYXRlIGEgY29uZmlndXJlZCBBUEkgY2xpZW50IHdpdGggYWxsIGVuZHBvaW50c1xuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQXBpQ2xpZW50KGNvbmZpZzogQXBpQ2xpZW50Q29uZmlnKSB7XG4gIGNvbnN0IGNsaWVudCA9IG5ldyBBcGlDbGllbnQoY29uZmlnKTtcblxuICByZXR1cm4ge1xuICAgIGNsaWVudCxcbiAgICBrYXJhb2tlOiBuZXcgS2FyYW9rZUVuZHBvaW50KGNsaWVudCksXG4gICAgcHJhY3RpY2U6IG5ldyBQcmFjdGljZUVuZHBvaW50KGNsaWVudCksXG4gICAgc3R0OiBuZXcgU1RURW5kcG9pbnQoY2xpZW50KSxcbiAgICBhdXRoOiBuZXcgQXV0aEVuZHBvaW50KGNsaWVudCksXG4gICAgXG4gICAgLy8gRGlyZWN0IGFjY2VzcyB0byBiYXNlIG1ldGhvZHNcbiAgICBoZWFsdGhDaGVjazogKCkgPT4gY2xpZW50LmhlYWx0aENoZWNrKCksXG4gIH07XG59XG5cbmV4cG9ydCB0eXBlIFNjYXJsZXR0QXBpQ2xpZW50ID0gUmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlQXBpQ2xpZW50PjsiLCJpbXBvcnQgeyBjcmVhdGVBcGlDbGllbnQsIHR5cGUgU2NhcmxldHRBcGlDbGllbnQgfSBmcm9tICdAc2NhcmxldHQvYXBpLWNsaWVudCc7XG5pbXBvcnQgdHlwZSB7IEthcmFva2VEYXRhLCBLYXJhb2tlU2Vzc2lvbiwgTGluZVNjb3JlLCBTZXNzaW9uUmVzdWx0cyB9IGZyb20gJ0BzY2FybGV0dC9jb3JlJztcblxuLyoqXG4gKiBBZGFwdGVyIGNsYXNzIHRoYXQgcHJvdmlkZXMgdGhlIHNhbWUgaW50ZXJmYWNlIGFzIHRoZSBvbGQgS2FyYW9rZUFwaVNlcnZpY2VcbiAqIGJ1dCB1c2VzIHRoZSBuZXcgQHNjYXJsZXR0L2FwaS1jbGllbnQgdW5kZXIgdGhlIGhvb2RcbiAqL1xuZXhwb3J0IGNsYXNzIEthcmFva2VBcGlTZXJ2aWNlIHtcbiAgcHJpdmF0ZSBjbGllbnQ6IFNjYXJsZXR0QXBpQ2xpZW50O1xuXG4gIGNvbnN0cnVjdG9yKGJhc2VVcmw6IHN0cmluZyA9IGltcG9ydC5tZXRhLmVudi5WSVRFX0FQSV9VUkwgfHwgJ2h0dHA6Ly9sb2NhbGhvc3Q6ODc4NycpIHtcbiAgICB0aGlzLmNsaWVudCA9IGNyZWF0ZUFwaUNsaWVudCh7IGJhc2VVcmwgfSk7XG4gIH1cblxuICBhc3luYyBmZXRjaEthcmFva2VEYXRhKHRyYWNrSWQ6IHN0cmluZyk6IFByb21pc2U8S2FyYW9rZURhdGEgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNsaWVudC5rYXJhb2tlLmdldERhdGEodHJhY2tJZCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZmV0Y2gga2FyYW9rZSBkYXRhOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHN0YXJ0U2Vzc2lvbihcbiAgICB0cmFja0lkOiBzdHJpbmcsXG4gICAgc29uZ0RhdGE6IHsgdGl0bGU6IHN0cmluZzsgYXJ0aXN0OiBzdHJpbmc7IGdlbml1c0lkPzogc3RyaW5nOyBkdXJhdGlvbj86IG51bWJlcjsgZGlmZmljdWx0eT86IHN0cmluZyB9LFxuICAgIGF1dGhUb2tlbj86IHN0cmluZyxcbiAgICBzb25nQ2F0YWxvZ0lkPzogc3RyaW5nLFxuICAgIHBsYXliYWNrU3BlZWQ/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxLYXJhb2tlU2Vzc2lvbiB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgLy8gTm90ZTogcGxheWJhY2tTcGVlZCBpcyBzdG9yZWQgYnV0IG5vdCB1c2VkIGJ5IHRoZSBjdXJyZW50IGFwaS1jbGllbnRcbiAgICAgIC8vIFRoaXMgbWFpbnRhaW5zIGNvbXBhdGliaWxpdHkgd2l0aCB0aGUgZXhpc3RpbmcgaW50ZXJmYWNlXG4gICAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgdGhpcy5jbGllbnQua2FyYW9rZS5zdGFydFNlc3Npb24oXG4gICAgICAgIHRyYWNrSWQsXG4gICAgICAgIHNvbmdEYXRhLFxuICAgICAgICBzb25nQ2F0YWxvZ0lkXG4gICAgICApO1xuICAgICAgcmV0dXJuIHNlc3Npb247XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gc3RhcnQgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBncmFkZVJlY29yZGluZyhcbiAgICBzZXNzaW9uSWQ6IHN0cmluZyxcbiAgICBsaW5lSW5kZXg6IG51bWJlcixcbiAgICBhdWRpb0J1ZmZlcjogc3RyaW5nLFxuICAgIGV4cGVjdGVkVGV4dDogc3RyaW5nLFxuICAgIHN0YXJ0VGltZTogbnVtYmVyLFxuICAgIGVuZFRpbWU6IG51bWJlcixcbiAgICBhdXRoVG9rZW4/OiBzdHJpbmcsXG4gICAgcGxheWJhY2tTcGVlZD86IHN0cmluZ1xuICApOiBQcm9taXNlPExpbmVTY29yZSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgLy8gTm90ZTogcGxheWJhY2tTcGVlZCBpcyBwYXNzZWQgYnV0IG5vdCB1c2VkIGJ5IHRoZSBjdXJyZW50IGFwaS1jbGllbnRcbiAgICAgIGNvbnN0IGxpbmVTY29yZSA9IGF3YWl0IHRoaXMuY2xpZW50LmthcmFva2UuZ3JhZGVMaW5lKFxuICAgICAgICBzZXNzaW9uSWQsXG4gICAgICAgIGxpbmVJbmRleCxcbiAgICAgICAgYXVkaW9CdWZmZXIsXG4gICAgICAgIGV4cGVjdGVkVGV4dCxcbiAgICAgICAgc3RhcnRUaW1lLFxuICAgICAgICBlbmRUaW1lXG4gICAgICApO1xuICAgICAgcmV0dXJuIGxpbmVTY29yZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBncmFkZSByZWNvcmRpbmc6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgY29tcGxldGVTZXNzaW9uKFxuICAgIHNlc3Npb25JZDogc3RyaW5nLFxuICAgIGZ1bGxBdWRpb0J1ZmZlcj86IHN0cmluZ1xuICApOiBQcm9taXNlPFNlc3Npb25SZXN1bHRzIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgdGhpcy5jbGllbnQua2FyYW9rZS5jb21wbGV0ZVNlc3Npb24oXG4gICAgICAgIHNlc3Npb25JZCxcbiAgICAgICAgZnVsbEF1ZGlvQnVmZmVyXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gY29tcGxldGUgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBnZXRVc2VyQmVzdFNjb3JlKHNvbmdJZDogc3RyaW5nKTogUHJvbWlzZTxudW1iZXIgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuY2xpZW50LmdldFVzZXJCZXN0U2NvcmUoc29uZ0lkKTtcbiAgICAgIHJldHVybiByZXNwb25zZS5kYXRhPy5zY29yZSA/PyBudWxsO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGdldCB1c2VyIGJlc3Qgc2NvcmU6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ2V0U29uZ0xlYWRlcmJvYXJkKHNvbmdJZDogc3RyaW5nLCBsaW1pdCA9IDEwKTogUHJvbWlzZTxBcnJheTx7IHVzZXJJZDogc3RyaW5nOyBzY29yZTogbnVtYmVyOyByYW5rOiBudW1iZXIgfT4+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNsaWVudC5jbGllbnQuZ2V0U29uZ0xlYWRlcmJvYXJkKHNvbmdJZCwgbGltaXQpO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmRhdGEgPz8gW107XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZ2V0IHNvbmcgbGVhZGVyYm9hcmQ6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxufSIsImltcG9ydCB0eXBlIHsgQ2h1bmtJbmZvIH0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuaW1wb3J0IHR5cGUgeyBMeXJpY0xpbmUgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb3VudFdvcmRzKHRleHQ6IHN0cmluZyk6IG51bWJlciB7XG4gIGlmICghdGV4dCkgcmV0dXJuIDA7XG4gIHJldHVybiB0ZXh0XG4gICAgLnRyaW0oKVxuICAgIC5zcGxpdCgvXFxzKy8pXG4gICAgLmZpbHRlcigod29yZCkgPT4gd29yZC5sZW5ndGggPiAwKS5sZW5ndGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRDaHVua0xpbmVzKFxuICBsaW5lczogTHlyaWNMaW5lW10sXG4gIHN0YXJ0SW5kZXg6IG51bWJlclxuKTogQ2h1bmtJbmZvIHtcbiAgLy8gUHJvY2VzcyBpbmRpdmlkdWFsIGxpbmVzIGluc3RlYWQgb2YgZ3JvdXBpbmdcbiAgY29uc3QgbGluZSA9IGxpbmVzW3N0YXJ0SW5kZXhdO1xuICBpZiAoIWxpbmUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhcnRJbmRleCxcbiAgICAgIGVuZEluZGV4OiBzdGFydEluZGV4LFxuICAgICAgZXhwZWN0ZWRUZXh0OiAnJyxcbiAgICAgIHdvcmRDb3VudDogMCxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgd29yZENvdW50ID0gY291bnRXb3JkcyhsaW5lLnRleHQgfHwgJycpO1xuICBcbiAgcmV0dXJuIHtcbiAgICBzdGFydEluZGV4LFxuICAgIGVuZEluZGV4OiBzdGFydEluZGV4LCAvLyBTaW5nbGUgbGluZSwgc28gc3RhcnQgYW5kIGVuZCBhcmUgdGhlIHNhbWVcbiAgICBleHBlY3RlZFRleHQ6IGxpbmUudGV4dCB8fCAnJyxcbiAgICB3b3JkQ291bnQsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYWxjdWxhdGVSZWNvcmRpbmdEdXJhdGlvbihcbiAgbGluZXM6IEx5cmljTGluZVtdLFxuICBjaHVua0luZm86IENodW5rSW5mb1xuKTogbnVtYmVyIHtcbiAgY29uc3QgeyBzdGFydEluZGV4LCBlbmRJbmRleCB9ID0gY2h1bmtJbmZvO1xuICBjb25zdCBsaW5lID0gbGluZXNbc3RhcnRJbmRleF07XG4gIFxuICBpZiAoIWxpbmUpIHJldHVybiAzMDAwO1xuXG4gIGlmIChlbmRJbmRleCA+IHN0YXJ0SW5kZXgpIHtcbiAgICBpZiAoZW5kSW5kZXggKyAxIDwgbGluZXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBuZXh0TGluZSA9IGxpbmVzW2VuZEluZGV4ICsgMV07XG4gICAgICBpZiAobmV4dExpbmUpIHtcbiAgICAgICAgLy8gQ29udmVydCBzZWNvbmRzIHRvIG1pbGxpc2Vjb25kc1xuICAgICAgICByZXR1cm4gKG5leHRMaW5lLnN0YXJ0VGltZSAtIGxpbmUuc3RhcnRUaW1lKSAqIDEwMDA7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGxldCBkdXJhdGlvbiA9IDA7XG4gICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPD0gZW5kSW5kZXg7IGkrKykge1xuICAgICAgLy8gZHVyYXRpb24gaXMgYWxyZWFkeSBpbiBtaWxsaXNlY29uZHNcbiAgICAgIGR1cmF0aW9uICs9IGxpbmVzW2ldPy5kdXJhdGlvbiB8fCAzMDAwO1xuICAgIH1cbiAgICByZXR1cm4gTWF0aC5taW4oZHVyYXRpb24sIDgwMDApO1xuICB9IGVsc2Uge1xuICAgIGlmIChzdGFydEluZGV4ICsgMSA8IGxpbmVzLmxlbmd0aCkge1xuICAgICAgY29uc3QgbmV4dExpbmUgPSBsaW5lc1tzdGFydEluZGV4ICsgMV07XG4gICAgICBpZiAobmV4dExpbmUpIHtcbiAgICAgICAgLy8gQ29udmVydCBzZWNvbmRzIHRvIG1pbGxpc2Vjb25kc1xuICAgICAgICBjb25zdCBjYWxjdWxhdGVkRHVyYXRpb24gPSAobmV4dExpbmUuc3RhcnRUaW1lIC0gbGluZS5zdGFydFRpbWUpICogMTAwMDtcbiAgICAgICAgcmV0dXJuIE1hdGgubWluKE1hdGgubWF4KGNhbGN1bGF0ZWREdXJhdGlvbiwgMTAwMCksIDUwMDApO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gTWF0aC5taW4obGluZS5kdXJhdGlvbiB8fCAzMDAwLCA1MDAwKTtcbiAgfVxufSIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJvZ3Jlc3NCYXJQcm9wcyB7XG4gIGN1cnJlbnQ6IG51bWJlcjtcbiAgdG90YWw6IG51bWJlcjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBQcm9ncmVzc0JhcjogQ29tcG9uZW50PFByb2dyZXNzQmFyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHBlcmNlbnRhZ2UgPSAoKSA9PiBNYXRoLm1pbigxMDAsIE1hdGgubWF4KDAsIChwcm9wcy5jdXJyZW50IC8gcHJvcHMudG90YWwpICogMTAwKSk7XG4gIFxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCd3LWZ1bGwgaC0xLjUgYmctaGlnaGxpZ2h0JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxkaXZcbiAgICAgICAgY2xhc3M9XCJoLWZ1bGwgYmctYWNjZW50IHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCBlYXNlLW91dCByb3VuZGVkLXItc21cIlxuICAgICAgICBzdHlsZT17eyB3aWR0aDogYCR7cGVyY2VudGFnZSgpfSVgIH19XG4gICAgICAvPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93LCBzcGxpdFByb3BzLCBjcmVhdGVFZmZlY3QsIG9uQ2xlYW51cCB9IGZyb20gJ3NvbGlkLWpzJ1xuaW1wb3J0IHR5cGUgeyBKU1gsIENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJ1xuaW1wb3J0IHsgUG9ydGFsIH0gZnJvbSAnc29saWQtanMvd2ViJ1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbidcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uL0J1dHRvbidcblxuZXhwb3J0IGludGVyZmFjZSBNb2RhbFByb3BzIHtcbiAgb3BlbjogYm9vbGVhblxuICBvbkNsb3NlPzogKCkgPT4gdm9pZFxuICB0aXRsZT86IHN0cmluZ1xuICBkZXNjcmlwdGlvbj86IHN0cmluZ1xuICBzaXplPzogJ3NtJyB8ICdtZCcgfCAnbGcnIHwgJ3hsJ1xuICB2YXJpYW50PzogJ2RlZmF1bHQnIHwgJ2RhbmdlcicgfCAnc3VjY2VzcydcbiAgaGlkZUNsb3NlQnV0dG9uPzogYm9vbGVhblxuICBjbG9zZU9uQmFja2Ryb3BDbGljaz86IGJvb2xlYW5cbiAgY2xvc2VPbkVzY2FwZT86IGJvb2xlYW5cbiAgY2hpbGRyZW4/OiBKU1guRWxlbWVudFxuICBmb290ZXI/OiBKU1guRWxlbWVudFxufVxuXG5leHBvcnQgY29uc3QgTW9kYWw6IENvbXBvbmVudDxNb2RhbFByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbbG9jYWwsIG90aGVyc10gPSBzcGxpdFByb3BzKHByb3BzLCBbXG4gICAgJ29wZW4nLFxuICAgICdvbkNsb3NlJyxcbiAgICAndGl0bGUnLFxuICAgICdkZXNjcmlwdGlvbicsXG4gICAgJ3NpemUnLFxuICAgICd2YXJpYW50JyxcbiAgICAnaGlkZUNsb3NlQnV0dG9uJyxcbiAgICAnY2xvc2VPbkJhY2tkcm9wQ2xpY2snLFxuICAgICdjbG9zZU9uRXNjYXBlJyxcbiAgICAnY2hpbGRyZW4nLFxuICAgICdmb290ZXInLFxuICBdKVxuXG4gIGNvbnN0IHNpemUgPSAoKSA9PiBsb2NhbC5zaXplIHx8ICdtZCdcbiAgY29uc3QgdmFyaWFudCA9ICgpID0+IGxvY2FsLnZhcmlhbnQgfHwgJ2RlZmF1bHQnXG4gIGNvbnN0IGNsb3NlT25CYWNrZHJvcENsaWNrID0gKCkgPT4gbG9jYWwuY2xvc2VPbkJhY2tkcm9wQ2xpY2sgPz8gdHJ1ZVxuICBjb25zdCBjbG9zZU9uRXNjYXBlID0gKCkgPT4gbG9jYWwuY2xvc2VPbkVzY2FwZSA/PyB0cnVlXG5cbiAgLy8gSGFuZGxlIGVzY2FwZSBrZXlcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAobG9jYWwub3BlbiAmJiBjbG9zZU9uRXNjYXBlKCkpIHtcbiAgICAgIGNvbnN0IGhhbmRsZUVzY2FwZSA9IChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gICAgICAgIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHtcbiAgICAgICAgICBsb2NhbC5vbkNsb3NlPy4oKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgaGFuZGxlRXNjYXBlKVxuICAgICAgb25DbGVhbnVwKCgpID0+IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBoYW5kbGVFc2NhcGUpKVxuICAgIH1cbiAgfSlcblxuICAvLyBMb2NrIGJvZHkgc2Nyb2xsIHdoZW4gbW9kYWwgaXMgb3BlblxuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChsb2NhbC5vcGVuKSB7XG4gICAgICBjb25zdCBvcmlnaW5hbE92ZXJmbG93ID0gZG9jdW1lbnQuYm9keS5zdHlsZS5vdmVyZmxvd1xuICAgICAgZG9jdW1lbnQuYm9keS5zdHlsZS5vdmVyZmxvdyA9ICdoaWRkZW4nXG4gICAgICBvbkNsZWFudXAoKCkgPT4ge1xuICAgICAgICBkb2N1bWVudC5ib2R5LnN0eWxlLm92ZXJmbG93ID0gb3JpZ2luYWxPdmVyZmxvd1xuICAgICAgfSlcbiAgICB9XG4gIH0pXG5cbiAgY29uc3QgaGFuZGxlQmFja2Ryb3BDbGljayA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgaWYgKGNsb3NlT25CYWNrZHJvcENsaWNrKCkgJiYgZS50YXJnZXQgPT09IGUuY3VycmVudFRhcmdldCkge1xuICAgICAgbG9jYWwub25DbG9zZT8uKClcbiAgICB9XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxTaG93IHdoZW49e2xvY2FsLm9wZW59PlxuICAgICAgPFBvcnRhbD5cbiAgICAgICAgPGRpdlxuICAgICAgICAgIGNsYXNzPVwiZml4ZWQgaW5zZXQtMCB6LTUwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHAtNFwiXG4gICAgICAgICAgb25DbGljaz17aGFuZGxlQmFja2Ryb3BDbGlja31cbiAgICAgICAgICB7Li4ub3RoZXJzfVxuICAgICAgICA+XG4gICAgICAgICAgey8qIEJhY2tkcm9wICovfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJhYnNvbHV0ZSBpbnNldC0wIGJnLWJsYWNrLzgwIGJhY2tkcm9wLWJsdXItc20gdHJhbnNpdGlvbi1vcGFjaXR5IGR1cmF0aW9uLTIwMFwiIC8+XG4gICAgICAgICAgXG4gICAgICAgICAgey8qIE1vZGFsICovfVxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3JlbGF0aXZlIGJnLWVsZXZhdGVkIHJvdW5kZWQteGwgc2hhZG93LTJ4bCBib3JkZXIgYm9yZGVyLXN1YnRsZScsXG4gICAgICAgICAgICAgICd0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0yMDAgc2NhbGUtMTAwIG9wYWNpdHktMTAwJyxcbiAgICAgICAgICAgICAgJ21heC1oLVs5MHZoXSBvdmVyZmxvdy1oaWRkZW4gZmxleCBmbGV4LWNvbCcsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvLyBTaXplc1xuICAgICAgICAgICAgICAgICd3LWZ1bGwgbWF4LXctc20nOiBzaXplKCkgPT09ICdzbScsXG4gICAgICAgICAgICAgICAgJ3ctZnVsbCBtYXgtdy1tZCc6IHNpemUoKSA9PT0gJ21kJyxcbiAgICAgICAgICAgICAgICAndy1mdWxsIG1heC13LWxnJzogc2l6ZSgpID09PSAnbGcnLFxuICAgICAgICAgICAgICAgICd3LWZ1bGwgbWF4LXcteGwnOiBzaXplKCkgPT09ICd4bCcsXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICB7LyogSGVhZGVyICovfVxuICAgICAgICAgICAgPFNob3cgd2hlbj17bG9jYWwudGl0bGUgfHwgIWxvY2FsLmhpZGVDbG9zZUJ1dHRvbn0+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLXN0YXJ0IGp1c3RpZnktYmV0d2VlbiBwLTYgcGItMFwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e2xvY2FsLnRpdGxlfT5cbiAgICAgICAgICAgICAgICAgICAgPGgyXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RleHQteGwgZm9udC1zZW1pYm9sZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICd0ZXh0LXByaW1hcnknOiB2YXJpYW50KCkgPT09ICdkZWZhdWx0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RleHQtcmVkLTUwMCc6IHZhcmlhbnQoKSA9PT0gJ2RhbmdlcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICd0ZXh0LWdyZWVuLTUwMCc6IHZhcmlhbnQoKSA9PT0gJ3N1Y2Nlc3MnLFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICB7bG9jYWwudGl0bGV9XG4gICAgICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtsb2NhbC5kZXNjcmlwdGlvbn0+XG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAge2xvY2FsLmRlc2NyaXB0aW9ufVxuICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17IWxvY2FsLmhpZGVDbG9zZUJ1dHRvbn0+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2xvY2FsLm9uQ2xvc2V9XG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwibWwtNCBwLTEgcm91bmRlZC1sZyB0ZXh0LXNlY29uZGFyeSBob3Zlcjp0ZXh0LXByaW1hcnkgaG92ZXI6Ymctc3VyZmFjZSB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCJDbG9zZSBtb2RhbFwiXG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIDxzdmdcbiAgICAgICAgICAgICAgICAgICAgICB3aWR0aD1cIjIwXCJcbiAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ9XCIyMFwiXG4gICAgICAgICAgICAgICAgICAgICAgdmlld0JveD1cIjAgMCAyMCAyMFwiXG4gICAgICAgICAgICAgICAgICAgICAgZmlsbD1cIm5vbmVcIlxuICAgICAgICAgICAgICAgICAgICAgIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIlxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgIGQ9XCJNMTUgNUw1IDE1TTUgNWwxMCAxMFwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJva2U9XCJjdXJyZW50Q29sb3JcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc3Ryb2tlLXdpZHRoPVwiMlwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJva2UtbGluZWNhcD1cInJvdW5kXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCJcbiAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgIHsvKiBDb250ZW50ICovfVxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBvdmVyZmxvdy15LWF1dG8gcC02XCI+XG4gICAgICAgICAgICAgIHtsb2NhbC5jaGlsZHJlbn1cbiAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICB7LyogRm9vdGVyICovfVxuICAgICAgICAgICAgPFNob3cgd2hlbj17bG9jYWwuZm9vdGVyfT5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInAtNiBwdC0wIG10LWF1dG9cIj5cbiAgICAgICAgICAgICAgICB7bG9jYWwuZm9vdGVyfVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L1BvcnRhbD5cbiAgICA8L1Nob3c+XG4gIClcbn1cblxuLy8gUHJlLWJ1aWx0IG1vZGFsIGZvb3RlciBjb21wb25lbnRzXG5leHBvcnQgaW50ZXJmYWNlIE1vZGFsRm9vdGVyUHJvcHMge1xuICBvbkNvbmZpcm0/OiAoKSA9PiB2b2lkXG4gIG9uQ2FuY2VsPzogKCkgPT4gdm9pZFxuICBjb25maXJtVGV4dD86IHN0cmluZ1xuICBjYW5jZWxUZXh0Pzogc3RyaW5nXG4gIGNvbmZpcm1WYXJpYW50PzogJ3ByaW1hcnknIHwgJ2RhbmdlcicgfCAnc2Vjb25kYXJ5J1xuICBjb25maXJtTG9hZGluZz86IGJvb2xlYW5cbiAgY29uZmlybURpc2FibGVkPzogYm9vbGVhblxufVxuXG5leHBvcnQgY29uc3QgTW9kYWxGb290ZXI6IENvbXBvbmVudDxNb2RhbEZvb3RlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBjb25maXJtVGV4dCA9ICgpID0+IHByb3BzLmNvbmZpcm1UZXh0IHx8ICdDb25maXJtJ1xuICBjb25zdCBjYW5jZWxUZXh0ID0gKCkgPT4gcHJvcHMuY2FuY2VsVGV4dCB8fCAnQ2FuY2VsJ1xuICBjb25zdCBjb25maXJtVmFyaWFudCA9ICgpID0+IHByb3BzLmNvbmZpcm1WYXJpYW50IHx8ICdwcmltYXJ5J1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktZW5kIGdhcC0zXCI+XG4gICAgICA8U2hvdyB3aGVuPXtwcm9wcy5vbkNhbmNlbH0+XG4gICAgICAgIDxCdXR0b25cbiAgICAgICAgICB2YXJpYW50PVwiZ2hvc3RcIlxuICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ2FuY2VsfVxuICAgICAgICA+XG4gICAgICAgICAge2NhbmNlbFRleHQoKX1cbiAgICAgICAgPC9CdXR0b24+XG4gICAgICA8L1Nob3c+XG4gICAgICA8U2hvdyB3aGVuPXtwcm9wcy5vbkNvbmZpcm19PlxuICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgdmFyaWFudD17Y29uZmlybVZhcmlhbnQoKX1cbiAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNvbmZpcm19XG4gICAgICAgICAgbG9hZGluZz17cHJvcHMuY29uZmlybUxvYWRpbmd9XG4gICAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmNvbmZpcm1EaXNhYmxlZH1cbiAgICAgICAgPlxuICAgICAgICAgIHtjb25maXJtVGV4dCgpfVxuICAgICAgICA8L0J1dHRvbj5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKVxufVxuXG4vLyBVdGlsaXR5IGZ1bmN0aW9uIGZvciBjb21tb24gbW9kYWwgcGF0dGVybnNcbmV4cG9ydCBpbnRlcmZhY2UgQ29uZmlybU1vZGFsUHJvcHMge1xuICBvcGVuOiBib29sZWFuXG4gIG9uQ2xvc2U6ICgpID0+IHZvaWRcbiAgb25Db25maXJtOiAoKSA9PiB2b2lkXG4gIHRpdGxlOiBzdHJpbmdcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmdcbiAgY29uZmlybVRleHQ/OiBzdHJpbmdcbiAgY2FuY2VsVGV4dD86IHN0cmluZ1xuICB2YXJpYW50PzogJ2RlZmF1bHQnIHwgJ2RhbmdlcidcbiAgY29uZmlybUxvYWRpbmc/OiBib29sZWFuXG59XG5cbmV4cG9ydCBjb25zdCBDb25maXJtTW9kYWw6IENvbXBvbmVudDxDb25maXJtTW9kYWxQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8TW9kYWxcbiAgICAgIG9wZW49e3Byb3BzLm9wZW59XG4gICAgICBvbkNsb3NlPXtwcm9wcy5vbkNsb3NlfVxuICAgICAgdGl0bGU9e3Byb3BzLnRpdGxlfVxuICAgICAgZGVzY3JpcHRpb249e3Byb3BzLmRlc2NyaXB0aW9ufVxuICAgICAgdmFyaWFudD17cHJvcHMudmFyaWFudH1cbiAgICAgIHNpemU9XCJzbVwiXG4gICAgICBmb290ZXI9e1xuICAgICAgICA8TW9kYWxGb290ZXJcbiAgICAgICAgICBvbkNvbmZpcm09e3Byb3BzLm9uQ29uZmlybX1cbiAgICAgICAgICBvbkNhbmNlbD17cHJvcHMub25DbG9zZX1cbiAgICAgICAgICBjb25maXJtVGV4dD17cHJvcHMuY29uZmlybVRleHR9XG4gICAgICAgICAgY2FuY2VsVGV4dD17cHJvcHMuY2FuY2VsVGV4dH1cbiAgICAgICAgICBjb25maXJtVmFyaWFudD17cHJvcHMudmFyaWFudCA9PT0gJ2RhbmdlcicgPyAnZGFuZ2VyJyA6ICdwcmltYXJ5J31cbiAgICAgICAgICBjb25maXJtTG9hZGluZz17cHJvcHMuY29uZmlybUxvYWRpbmd9XG4gICAgICAgIC8+XG4gICAgICB9XG4gICAgLz5cbiAgKVxufSIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1pbmltaXplZEthcmFva2VQcm9wcyB7XG4gIG9uQ2xpY2s6ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBNaW5pbWl6ZWRLYXJhb2tlOiBDb21wb25lbnQ8TWluaW1pemVkS2FyYW9rZVByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ2xpY2t9XG4gICAgICBzdHlsZT17e1xuICAgICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgICAgYm90dG9tOiAnMjRweCcsXG4gICAgICAgIHJpZ2h0OiAnMjRweCcsXG4gICAgICAgIHdpZHRoOiAnODBweCcsXG4gICAgICAgIGhlaWdodDogJzgwcHgnLFxuICAgICAgICAnYm9yZGVyLXJhZGl1cyc6ICc1MCUnLFxuICAgICAgICBiYWNrZ3JvdW5kOiAnbGluZWFyLWdyYWRpZW50KDEzNWRlZywgI0ZGMDA2RSAwJSwgI0MxMzU4NCAxMDAlKScsXG4gICAgICAgICdib3gtc2hhZG93JzogJzAgOHB4IDMycHggcmdiYSgwLCAwLCAwLCAwLjMpJyxcbiAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxuICAgICAgICAnYWxpZ24taXRlbXMnOiAnY2VudGVyJyxcbiAgICAgICAgJ2p1c3RpZnktY29udGVudCc6ICdjZW50ZXInLFxuICAgICAgICBvdmVyZmxvdzogJ2hpZGRlbicsXG4gICAgICAgIGN1cnNvcjogJ3BvaW50ZXInLFxuICAgICAgICAnei1pbmRleCc6ICc5OTk5OScsXG4gICAgICAgIGJvcmRlcjogJ25vbmUnLFxuICAgICAgICB0cmFuc2l0aW9uOiAndHJhbnNmb3JtIDAuMnMgZWFzZScsXG4gICAgICB9fVxuICAgICAgb25Nb3VzZUVudGVyPXsoZSkgPT4ge1xuICAgICAgICBlLmN1cnJlbnRUYXJnZXQuc3R5bGUudHJhbnNmb3JtID0gJ3NjYWxlKDEuMSknO1xuICAgICAgfX1cbiAgICAgIG9uTW91c2VMZWF2ZT17KGUpID0+IHtcbiAgICAgICAgZS5jdXJyZW50VGFyZ2V0LnN0eWxlLnRyYW5zZm9ybSA9ICdzY2FsZSgxKSc7XG4gICAgICB9fVxuICAgICAgYXJpYS1sYWJlbD1cIk9wZW4gS2FyYW9rZVwiXG4gICAgPlxuICAgICAgey8qIFBsYWNlIHlvdXIgMjAweDIwMCBpbWFnZSBoZXJlIGFzOiAqL31cbiAgICAgIHsvKiA8aW1nIHNyYz1cIi9wYXRoL3RvL3lvdXIvaW1hZ2UucG5nXCIgYWx0PVwiS2FyYW9rZVwiIHN0eWxlPVwid2lkdGg6IDEwMCU7IGhlaWdodDogMTAwJTsgb2JqZWN0LWZpdDogY292ZXI7XCIgLz4gKi99XG4gICAgICBcbiAgICAgIHsvKiBGb3Igbm93LCB1c2luZyBhIHBsYWNlaG9sZGVyIGljb24gKi99XG4gICAgICA8c3BhbiBzdHlsZT17eyAnZm9udC1zaXplJzogJzM2cHgnIH19PvCfjqQ8L3NwYW4+XG4gICAgPC9idXR0b24+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCBJY29uWFJlZ3VsYXIgZnJvbSAncGhvc3Bob3ItaWNvbnMtc29saWQvSWNvblhSZWd1bGFyJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByYWN0aWNlSGVhZGVyUHJvcHMge1xuICB0aXRsZT86IHN0cmluZztcbiAgb25FeGl0OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFByYWN0aWNlSGVhZGVyOiBDb21wb25lbnQ8UHJhY3RpY2VIZWFkZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8U2hvdyB3aGVuPXtwcm9wcy50aXRsZX0+XG4gICAgICA8aGVhZGVyIGNsYXNzPXtjbignZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgaC0xNCBweC00IGJnLXRyYW5zcGFyZW50JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgICAgPGgxIGNsYXNzPVwidGV4dC1sZyBmb250LXNlbWlib2xkIHRleHQtcHJpbWFyeVwiPlxuICAgICAgICAgIHtwcm9wcy50aXRsZX1cbiAgICAgICAgPC9oMT5cbiAgICAgIDwvaGVhZGVyPlxuICAgIDwvU2hvdz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL0J1dHRvbic7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBFeGVyY2lzZUZvb3RlclByb3BzIHtcbiAgaXNSZWNvcmRpbmc/OiBib29sZWFuO1xuICBpc1Byb2Nlc3Npbmc/OiBib29sZWFuO1xuICBjYW5TdWJtaXQ/OiBib29sZWFuO1xuICBvblJlY29yZD86ICgpID0+IHZvaWQ7XG4gIG9uU3RvcD86ICgpID0+IHZvaWQ7XG4gIG9uU3VibWl0PzogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBFeGVyY2lzZUZvb3RlcjogQ29tcG9uZW50PEV4ZXJjaXNlRm9vdGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGZvb3RlciBjbGFzcz17Y24oJ2JvcmRlci10IGJvcmRlci1ncmF5LTcwMCBiZy1zdXJmYWNlIHAtNicsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8ZGl2IGNsYXNzPVwibWF4LXctMnhsIG14LWF1dG9cIj5cbiAgICAgICAgPFNob3dcbiAgICAgICAgICB3aGVuPXshcHJvcHMuaXNSZWNvcmRpbmd9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgIGZ1bGxXaWR0aFxuICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblN0b3B9XG4gICAgICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5pc1Byb2Nlc3Npbmd9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIFN0b3BcbiAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIH1cbiAgICAgICAgPlxuICAgICAgICAgIDxTaG93XG4gICAgICAgICAgICB3aGVuPXtwcm9wcy5jYW5TdWJtaXR9XG4gICAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblJlY29yZH1cbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17cHJvcHMuaXNQcm9jZXNzaW5nfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgUmVjb3JkXG4gICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgdmFyaWFudD1cInByaW1hcnlcIlxuICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25TdWJtaXR9XG4gICAgICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5pc1Byb2Nlc3Npbmd9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtwcm9wcy5pc1Byb2Nlc3NpbmcgPyAnUHJvY2Vzc2luZy4uLicgOiAnU3VibWl0J31cbiAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgPC9TaG93PlxuICAgICAgPC9kaXY+XG4gICAgPC9mb290ZXI+XG4gICk7XG59OyIsImV4cG9ydCBkZWZhdWx0IChwKSA9PiAoPHN2ZyBjbGFzcz17cC5jbGFzc30gZGF0YS1waG9zcGhvci1pY29uPVwiY2hlY2stY2lyY2xlXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCIgd2lkdGg9XCIxZW1cIiBoZWlnaHQ9XCIxZW1cIiBwb2ludGVyLWV2ZW50cz1cIm5vbmVcIiBkaXNwbGF5PVwiaW5saW5lLWJsb2NrXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiB2aWV3Qm94PVwiMCAwIDI1NiAyNTZcIj48cGF0aCBkPVwiTTEyOCAyNGExMDQgMTA0IDAgMSAwIDEwNCAxMDRBMTA0LjExIDEwNC4xMSAwIDAgMCAxMjggMjRtNDUuNjYgODUuNjYtNTYgNTZhOCA4IDAgMCAxLTExLjMyIDBsLTI0LTI0YTggOCAwIDAgMSAxMS4zMi0xMS4zMkwxMTIgMTQ4LjY5bDUwLjM0LTUwLjM1YTggOCAwIDAgMSAxMS4zMiAxMS4zMlwiLz48L3N2Zz4pO1xuIiwiZXhwb3J0IGRlZmF1bHQgKHApID0+ICg8c3ZnIGNsYXNzPXtwLmNsYXNzfSBkYXRhLXBob3NwaG9yLWljb249XCJ4LWNpcmNsZVwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiIHdpZHRoPVwiMWVtXCIgaGVpZ2h0PVwiMWVtXCIgcG9pbnRlci1ldmVudHM9XCJub25lXCIgZGlzcGxheT1cImlubGluZS1ibG9ja1wiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBmaWxsPVwiY3VycmVudENvbG9yXCIgdmlld0JveD1cIjAgMCAyNTYgMjU2XCI+PHBhdGggZD1cIk0xMjggMjRhMTA0IDEwNCAwIDEgMCAxMDQgMTA0QTEwNC4xMSAxMDQuMTEgMCAwIDAgMTI4IDI0bTM3LjY2IDEzMC4zNGE4IDggMCAwIDEtMTEuMzIgMTEuMzJMMTI4IDEzOS4zMWwtMjYuMzQgMjYuMzVhOCA4IDAgMCAxLTExLjMyLTExLjMyTDExNi42OSAxMjhsLTI2LjM1LTI2LjM0YTggOCAwIDAgMSAxMS4zMi0xMS4zMkwxMjggMTE2LjY5bDI2LjM0LTI2LjM1YTggOCAwIDAgMSAxMS4zMiAxMS4zMkwxMzkuMzEgMTI4WlwiLz48L3N2Zz4pO1xuIiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL0J1dHRvbic7XG5pbXBvcnQgSWNvbkNoZWNrQ2lyY2xlRmlsbCBmcm9tICdwaG9zcGhvci1pY29ucy1zb2xpZC9JY29uQ2hlY2tDaXJjbGVGaWxsJztcbmltcG9ydCBJY29uWENpcmNsZUZpbGwgZnJvbSAncGhvc3Bob3ItaWNvbnMtc29saWQvSWNvblhDaXJjbGVGaWxsJztcblxuZXhwb3J0IGludGVyZmFjZSBSZXNwb25zZUZvb3RlclByb3BzIHtcbiAgbW9kZTogJ2NoZWNrJyB8ICdmZWVkYmFjayc7XG4gIGlzQ29ycmVjdD86IGJvb2xlYW47XG4gIGZlZWRiYWNrVGV4dD86IHN0cmluZztcbiAgY29udGludWVMYWJlbD86IHN0cmluZztcbiAgb25DaGVjaz86ICgpID0+IHZvaWQ7XG4gIG9uQ29udGludWU/OiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgUmVzcG9uc2VGb290ZXI6IENvbXBvbmVudDxSZXNwb25zZUZvb3RlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9XCJib3JkZXItdCBib3JkZXItZ3JheS03MDAgYmctc3VyZmFjZSBwLTZcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy0yeGwgbXgtYXV0b1wiPlxuICAgICAgICA8U2hvd1xuICAgICAgICAgIHdoZW49e3Byb3BzLm1vZGUgPT09ICdjaGVjayd9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtNlwiPlxuICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuaXNDb3JyZWN0ICE9PSB1bmRlZmluZWR9PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTRcIj5cbiAgICAgICAgICAgICAgICA8U2hvd1xuICAgICAgICAgICAgICAgICAgd2hlbj17cHJvcHMuaXNDb3JyZWN0fVxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9ezxJY29uWENpcmNsZUZpbGwgY2xhc3M9XCJ3LTE2IGgtMTYgZmxleC1zaHJpbmstMCB0ZXh0LXJlZC01MDBcIiBzdHlsZT1cImNvbG9yOiAjZWY0NDQ0O1wiIC8+fVxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxJY29uQ2hlY2tDaXJjbGVGaWxsIGNsYXNzPVwidy0xNiBoLTE2IGZsZXgtc2hyaW5rLTAgdGV4dC1ncmVlbi01MDBcIiBzdHlsZT1cImNvbG9yOiAjMjJjNTVlO1wiIC8+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtMnhsIGZvbnQtYm9sZFwiIHN0eWxlPXtgY29sb3I6ICR7cHJvcHMuaXNDb3JyZWN0ID8gJyMyMmM1NWUnIDogJyNlZjQ0NDQnfTtgfT5cbiAgICAgICAgICAgICAgICAgICAge3Byb3BzLmlzQ29ycmVjdCA/ICdDb3JyZWN0IScgOiAnSW5jb3JyZWN0J31cbiAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmZlZWRiYWNrVGV4dCAmJiAhcHJvcHMuaXNDb3JyZWN0fT5cbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWJhc2UgdGV4dC1zZWNvbmRhcnkgbXQtMVwiPntwcm9wcy5mZWVkYmFja1RleHR9PC9wPlxuICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgdmFyaWFudD1cInByaW1hcnlcIlxuICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNvbnRpbnVlfVxuICAgICAgICAgICAgICBjbGFzcz1cIm1pbi13LVsxODBweF1cIlxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7cHJvcHMuY29udGludWVMYWJlbCB8fCAnTmV4dCd9XG4gICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgfVxuICAgICAgPlxuICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgdmFyaWFudD1cInByaW1hcnlcIlxuICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgZnVsbFdpZHRoXG4gICAgICAgICAgb25DbGljaz17cHJvcHMub25DaGVja31cbiAgICAgICAgPlxuICAgICAgICAgIENoZWNrXG4gICAgICAgIDwvQnV0dG9uPlxuICAgICAgPC9TaG93PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50LCBKU1ggfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBFeGVyY2lzZVRlbXBsYXRlUHJvcHMge1xuICBpbnN0cnVjdGlvblRleHQ/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBFeGVyY2lzZVRlbXBsYXRlOiBDb21wb25lbnQ8RXhlcmNpc2VUZW1wbGF0ZVByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sIGgtZnVsbCBiZy1iYXNlIHRleHQtcHJpbWFyeScsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8ZGl2IGNsYXNzPVwiZmxleC1ncm93IG92ZXJmbG93LXktYXV0byBmbGV4IGZsZXgtY29sIHBiLTI0XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ3LWZ1bGwgbWF4LXctMnhsIG14LWF1dG8gcHgtNCBweS04XCI+XG4gICAgICAgICAge3Byb3BzLmluc3RydWN0aW9uVGV4dCAmJiAoXG4gICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1tdXRlZC1mb3JlZ3JvdW5kIG1iLTQgdGV4dC1sZWZ0XCI+XG4gICAgICAgICAgICAgIHtwcm9wcy5pbnN0cnVjdGlvblRleHR9XG4gICAgICAgICAgICA8L3A+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlYWRBbG91ZFByb3BzIHtcbiAgcHJvbXB0OiBzdHJpbmc7XG4gIHVzZXJUcmFuc2NyaXB0Pzogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFJlYWRBbG91ZDogQ29tcG9uZW50PFJlYWRBbG91ZFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdzcGFjZS15LTQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgPHAgY2xhc3M9XCJ0ZXh0LTJ4bCB0ZXh0LWxlZnQgbGVhZGluZy1yZWxheGVkXCI+XG4gICAgICAgIHtwcm9wcy5wcm9tcHR9XG4gICAgICA8L3A+XG4gICAgICBcbiAgICAgIDxTaG93IHdoZW49e3Byb3BzLnVzZXJUcmFuc2NyaXB0fT5cbiAgICAgICAgPGRpdiBjbGFzcz1cIm10LThcIj5cbiAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1tdXRlZC1mb3JlZ3JvdW5kIG1iLTRcIj5Zb3Ugc2FpZDo8L3A+XG4gICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LTJ4bCB0ZXh0LWxlZnQgbGVhZGluZy1yZWxheGVkXCI+XG4gICAgICAgICAgICB7cHJvcHMudXNlclRyYW5zY3JpcHR9XG4gICAgICAgICAgPC9wPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiLy8gU291bmQgdXRpbGl0eSBmb3IgcGxheWluZyBmZWVkYmFjayBzb3VuZHNcbmV4cG9ydCBjbGFzcyBTb3VuZE1hbmFnZXIge1xuICBwcml2YXRlIHN0YXRpYyBpbnN0YW5jZTogU291bmRNYW5hZ2VyO1xuICBwcml2YXRlIHNvdW5kczogTWFwPHN0cmluZywgSFRNTEF1ZGlvRWxlbWVudD4gPSBuZXcgTWFwKCk7XG4gIHByaXZhdGUgZW5hYmxlZDogYm9vbGVhbiA9IHRydWU7XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcigpIHtcbiAgICAvLyBQcmVsb2FkIHNvdW5kc1xuICAgIHRoaXMubG9hZFNvdW5kKCdjb3JyZWN0JywgJy9zb3VuZHMvY29ycmVjdC5tcDMnKTtcbiAgICB0aGlzLmxvYWRTb3VuZCgnaW5jb3JyZWN0JywgJy9zb3VuZHMvaW5jb3JyZWN0Lm1wMycpO1xuICB9XG5cbiAgc3RhdGljIGdldEluc3RhbmNlKCk6IFNvdW5kTWFuYWdlciB7XG4gICAgaWYgKCFTb3VuZE1hbmFnZXIuaW5zdGFuY2UpIHtcbiAgICAgIFNvdW5kTWFuYWdlci5pbnN0YW5jZSA9IG5ldyBTb3VuZE1hbmFnZXIoKTtcbiAgICB9XG4gICAgcmV0dXJuIFNvdW5kTWFuYWdlci5pbnN0YW5jZTtcbiAgfVxuXG4gIHByaXZhdGUgbG9hZFNvdW5kKG5hbWU6IHN0cmluZywgcGF0aDogc3RyaW5nKSB7XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgXG4gICAgY29uc3QgYXVkaW8gPSBuZXcgQXVkaW8ocGF0aCk7XG4gICAgYXVkaW8ucHJlbG9hZCA9ICdhdXRvJztcbiAgICBhdWRpby52b2x1bWUgPSAwLjU7IC8vIERlZmF1bHQgdm9sdW1lXG4gICAgdGhpcy5zb3VuZHMuc2V0KG5hbWUsIGF1ZGlvKTtcbiAgfVxuXG4gIHBsYXkoc291bmROYW1lOiAnY29ycmVjdCcgfCAnaW5jb3JyZWN0Jykge1xuICAgIGlmICghdGhpcy5lbmFibGVkKSByZXR1cm47XG4gICAgXG4gICAgY29uc3QgYXVkaW8gPSB0aGlzLnNvdW5kcy5nZXQoc291bmROYW1lKTtcbiAgICBpZiAoYXVkaW8pIHtcbiAgICAgIC8vIENsb25lIHRoZSBhdWRpbyB0byBhbGxvdyBvdmVybGFwcGluZyBzb3VuZHNcbiAgICAgIGNvbnN0IGNsb25lID0gYXVkaW8uY2xvbmVOb2RlKCkgYXMgSFRNTEF1ZGlvRWxlbWVudDtcbiAgICAgIGNsb25lLnZvbHVtZSA9IGF1ZGlvLnZvbHVtZTtcbiAgICAgIGNsb25lLnBsYXkoKS5jYXRjaChlcnIgPT4ge1xuICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byBwbGF5IHNvdW5kOicsIGVycik7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBzZXRWb2x1bWUodm9sdW1lOiBudW1iZXIpIHtcbiAgICBjb25zdCBjbGFtcGVkVm9sdW1lID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oMSwgdm9sdW1lKSk7XG4gICAgdGhpcy5zb3VuZHMuZm9yRWFjaChhdWRpbyA9PiB7XG4gICAgICBhdWRpby52b2x1bWUgPSBjbGFtcGVkVm9sdW1lO1xuICAgIH0pO1xuICB9XG5cbiAgc2V0RW5hYmxlZChlbmFibGVkOiBib29sZWFuKSB7XG4gICAgdGhpcy5lbmFibGVkID0gZW5hYmxlZDtcbiAgfVxuXG4gIGlzRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5lbmFibGVkO1xuICB9XG59XG5cbi8vIEV4cG9ydCBzaW5nbGV0b24gaW5zdGFuY2VcbmV4cG9ydCBjb25zdCBzb3VuZE1hbmFnZXIgPSBTb3VuZE1hbmFnZXIuZ2V0SW5zdGFuY2UoKTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNyZWF0ZVJlc291cmNlLCBTaG93LCBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IFJlYWRBbG91ZCB9IGZyb20gJy4uL1JlYWRBbG91ZCc7XG5pbXBvcnQgeyBQcm9ncmVzc0JhciB9IGZyb20gJy4uLy4uL2NvbW1vbi9Qcm9ncmVzc0Jhcic7XG5pbXBvcnQgeyBQcmFjdGljZUhlYWRlciB9IGZyb20gJy4uL1ByYWN0aWNlSGVhZGVyJztcbmltcG9ydCB7IEV4ZXJjaXNlVGVtcGxhdGUgfSBmcm9tICcuLi9FeGVyY2lzZVRlbXBsYXRlJztcbmltcG9ydCB7IEV4ZXJjaXNlRm9vdGVyIH0gZnJvbSAnLi4vRXhlcmNpc2VGb290ZXInO1xuaW1wb3J0IHsgUmVzcG9uc2VGb290ZXIgfSBmcm9tICcuLi9SZXNwb25zZUZvb3Rlcic7XG5pbXBvcnQgdHlwZSB7IFJlYWRBbG91ZEV4ZXJjaXNlIGFzIEV4ZXJjaXNlIH0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuaW1wb3J0IHsgc291bmRNYW5hZ2VyIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvc291bmQnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByYWN0aWNlRXhlcmNpc2VWaWV3UHJvcHMge1xuICBzZXNzaW9uSWQ/OiBzdHJpbmc7XG4gIG9uQmFjazogKCkgPT4gdm9pZDtcbiAgYXBpQmFzZVVybD86IHN0cmluZztcbiAgYXV0aFRva2VuPzogc3RyaW5nO1xuICBoZWFkZXJUaXRsZT86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFByYWN0aWNlRXhlcmNpc2VWaWV3OiBDb21wb25lbnQ8UHJhY3RpY2VFeGVyY2lzZVZpZXdQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2N1cnJlbnRFeGVyY2lzZUluZGV4LCBzZXRDdXJyZW50RXhlcmNpc2VJbmRleF0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFtpc1JlY29yZGluZywgc2V0SXNSZWNvcmRpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2lzUHJvY2Vzc2luZywgc2V0SXNQcm9jZXNzaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFt1c2VyVHJhbnNjcmlwdCwgc2V0VXNlclRyYW5zY3JpcHRdID0gY3JlYXRlU2lnbmFsKCcnKTtcbiAgY29uc3QgW2N1cnJlbnRTY29yZSwgc2V0Q3VycmVudFNjb3JlXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW21lZGlhUmVjb3JkZXIsIHNldE1lZGlhUmVjb3JkZXJdID0gY3JlYXRlU2lnbmFsPE1lZGlhUmVjb3JkZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2F1ZGlvQ2h1bmtzLCBzZXRBdWRpb0NodW5rc10gPSBjcmVhdGVTaWduYWw8QmxvYltdPihbXSk7XG4gIGNvbnN0IFtzaG93RmVlZGJhY2ssIHNldFNob3dGZWVkYmFja10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbaXNDb3JyZWN0LCBzZXRJc0NvcnJlY3RdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgXG4gIGNvbnN0IGFwaUJhc2VVcmwgPSAoKSA9PiBwcm9wcy5hcGlCYXNlVXJsIHx8ICdodHRwOi8vbG9jYWxob3N0Ojg3ODcnO1xuICBcbiAgLy8gRmV0Y2ggZXhlcmNpc2VzIGZyb20gdGhlIEFQSVxuICBjb25zdCBbZXhlcmNpc2VzXSA9IGNyZWF0ZVJlc291cmNlKGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgLy8gSW5jbHVkZSBzZXNzaW9uSWQgaWYgcHJvdmlkZWQgdG8gZ2V0IGV4ZXJjaXNlcyBmcm9tIHRoaXMgc2Vzc2lvbiBvbmx5XG4gICAgICBjb25zdCB1cmwgPSBwcm9wcy5zZXNzaW9uSWQgXG4gICAgICAgID8gYCR7YXBpQmFzZVVybCgpfS9hcGkvcHJhY3RpY2UvZXhlcmNpc2VzP2xpbWl0PTEwJnNlc3Npb25JZD0ke3Byb3BzLnNlc3Npb25JZH1gXG4gICAgICAgIDogYCR7YXBpQmFzZVVybCgpfS9hcGkvcHJhY3RpY2UvZXhlcmNpc2VzP2xpbWl0PTEwYDtcbiAgICAgIFxuICAgICAgY29uc3QgaGVhZGVyczogSGVhZGVyc0luaXQgPSB7fTtcbiAgICAgIGlmIChwcm9wcy5hdXRoVG9rZW4pIHtcbiAgICAgICAgaGVhZGVyc1snQXV0aG9yaXphdGlvbiddID0gYEJlYXJlciAke3Byb3BzLmF1dGhUb2tlbn1gO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwgeyBoZWFkZXJzIH0pO1xuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCBlcnJvclRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQcmFjdGljZUV4ZXJjaXNlVmlld10gQVBJIGVycm9yOicsIHJlc3BvbnNlLnN0YXR1cywgZXJyb3JUZXh0KTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gZmV0Y2ggZXhlcmNpc2VzJyk7XG4gICAgICB9XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgXG4gICAgICBpZiAoZGF0YS5kYXRhICYmIGRhdGEuZGF0YS5leGVyY2lzZXMpIHtcbiAgICAgICAgcmV0dXJuIGRhdGEuZGF0YS5leGVyY2lzZXMgYXMgRXhlcmNpc2VbXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBbXTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW1ByYWN0aWNlRXhlcmNpc2VWaWV3XSBGYWlsZWQgdG8gZmV0Y2g6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gTG9nIHdoZW4gZXhlcmNpc2VzIGxvYWRcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBleGVyY2lzZUxpc3QgPSBleGVyY2lzZXMoKTtcbiAgfSk7XG5cbiAgY29uc3QgaGFuZGxlU3RhcnRSZWNvcmRpbmcgPSBhc3luYyAoKSA9PiB7XG4gICAgc2V0VXNlclRyYW5zY3JpcHQoJycpO1xuICAgIHNldEN1cnJlbnRTY29yZShudWxsKTtcbiAgICBzZXRBdWRpb0NodW5rcyhbXSk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN0cmVhbSA9IGF3YWl0IG5hdmlnYXRvci5tZWRpYURldmljZXMuZ2V0VXNlck1lZGlhKHsgXG4gICAgICAgIGF1ZGlvOiB7XG4gICAgICAgICAgZWNob0NhbmNlbGxhdGlvbjogdHJ1ZSxcbiAgICAgICAgICBub2lzZVN1cHByZXNzaW9uOiB0cnVlLFxuICAgICAgICAgIGF1dG9HYWluQ29udHJvbDogdHJ1ZVxuICAgICAgICB9IFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IG1pbWVUeXBlID0gTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQoJ2F1ZGlvL3dlYm07Y29kZWNzPW9wdXMnKSBcbiAgICAgICAgPyAnYXVkaW8vd2VibTtjb2RlY3M9b3B1cycgXG4gICAgICAgIDogJ2F1ZGlvL3dlYm0nO1xuICAgICAgICBcbiAgICAgIGNvbnN0IHJlY29yZGVyID0gbmV3IE1lZGlhUmVjb3JkZXIoc3RyZWFtLCB7IG1pbWVUeXBlIH0pO1xuICAgICAgY29uc3QgY2h1bmtzOiBCbG9iW10gPSBbXTtcbiAgICAgIFxuICAgICAgcmVjb3JkZXIub25kYXRhYXZhaWxhYmxlID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIGlmIChldmVudC5kYXRhLnNpemUgPiAwKSB7XG4gICAgICAgICAgY2h1bmtzLnB1c2goZXZlbnQuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBcbiAgICAgIHJlY29yZGVyLm9uc3RvcCA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgYXVkaW9CbG9iID0gbmV3IEJsb2IoY2h1bmtzLCB7IHR5cGU6IG1pbWVUeXBlIH0pO1xuICAgICAgICBhd2FpdCBwcm9jZXNzUmVjb3JkaW5nKGF1ZGlvQmxvYik7XG4gICAgICAgIFxuICAgICAgICAvLyBTdG9wIGFsbCB0cmFja3NcbiAgICAgICAgc3RyZWFtLmdldFRyYWNrcygpLmZvckVhY2godHJhY2sgPT4gdHJhY2suc3RvcCgpKTtcbiAgICAgIH07XG4gICAgICBcbiAgICAgIHJlY29yZGVyLnN0YXJ0KCk7XG4gICAgICBzZXRNZWRpYVJlY29yZGVyKHJlY29yZGVyKTtcbiAgICAgIHNldElzUmVjb3JkaW5nKHRydWUpO1xuICAgICAgXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQcmFjdGljZUV4ZXJjaXNlVmlld10gRmFpbGVkIHRvIHN0YXJ0IHJlY29yZGluZzonLCBlcnJvcik7XG4gICAgICBzZXRJc1JlY29yZGluZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IHByb2Nlc3NSZWNvcmRpbmcgPSBhc3luYyAoYmxvYjogQmxvYikgPT4ge1xuICAgIHRyeSB7XG4gICAgICBzZXRJc1Byb2Nlc3NpbmcodHJ1ZSk7XG4gICAgICBcbiAgICAgIC8vIENvbnZlcnQgdG8gYmFzZTY0IGZvciBBUElcbiAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICBjb25zdCBiYXNlNjQgPSBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgYmFzZTY0U3RyaW5nID0gcmVhZGVyLnJlc3VsdCBhcyBzdHJpbmc7XG4gICAgICAgICAgcmVzb2x2ZShiYXNlNjRTdHJpbmcuc3BsaXQoJywnKVsxXSk7XG4gICAgICAgIH07XG4gICAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKGJsb2IpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIFNlbmQgdG8gU1RUIEFQSSB3aXRoIHJldHJ5IGxvZ2ljXG4gICAgICBsZXQgcmVzcG9uc2U7XG4gICAgICBsZXQgYXR0ZW1wdHMgPSAwO1xuICAgICAgY29uc3QgbWF4QXR0ZW1wdHMgPSAyO1xuICAgICAgXG4gICAgICBjb25zdCBoZWFkZXJzOiBIZWFkZXJzSW5pdCA9IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9O1xuICAgICAgaWYgKHByb3BzLmF1dGhUb2tlbikge1xuICAgICAgICBoZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSBgQmVhcmVyICR7cHJvcHMuYXV0aFRva2VufWA7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHdoaWxlIChhdHRlbXB0cyA8IG1heEF0dGVtcHRzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHthcGlCYXNlVXJsKCl9L2FwaS9zcGVlY2gtdG8tdGV4dC90cmFuc2NyaWJlYCwge1xuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICBoZWFkZXJzLFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBcbiAgICAgICAgICAgICAgYXVkaW9CYXNlNjQ6IGJhc2U2NCxcbiAgICAgICAgICAgICAgZXhwZWN0ZWRUZXh0OiBjdXJyZW50RXhlcmNpc2UoKT8uZnVsbF9saW5lLFxuICAgICAgICAgICAgICAvLyBVc2UgRGVlcGdyYW0gb24gcmV0cnlcbiAgICAgICAgICAgICAgcHJlZmVyRGVlcGdyYW06IGF0dGVtcHRzID4gMFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZmV0Y2hFcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtQcmFjdGljZUV4ZXJjaXNlVmlld10gU1RUIGF0dGVtcHQgJHthdHRlbXB0cyArIDF9IGZhaWxlZDpgLCBmZXRjaEVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXR0ZW1wdHMrKztcbiAgICAgICAgaWYgKGF0dGVtcHRzIDwgbWF4QXR0ZW1wdHMpIHtcbiAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgNTAwKSk7IC8vIFNtYWxsIGRlbGF5IGJlZm9yZSByZXRyeVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIHNldFVzZXJUcmFuc2NyaXB0KHJlc3VsdC5kYXRhLnRyYW5zY3JpcHQpO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2FsY3VsYXRlIGEgc2ltcGxlIHNjb3JlIGJhc2VkIG9uIG1hdGNoaW5nIHdvcmRzXG4gICAgICAgIGNvbnN0IHNjb3JlID0gY2FsY3VsYXRlU2NvcmUoY3VycmVudEV4ZXJjaXNlKCk/LmZ1bGxfbGluZSB8fCAnJywgcmVzdWx0LmRhdGEudHJhbnNjcmlwdCk7XG4gICAgICAgIHNldEN1cnJlbnRTY29yZShzY29yZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBBdXRvbWF0aWNhbGx5IHN1Ym1pdCBhZnRlciB0cmFuc2NyaXB0aW9uXG4gICAgICAgIGF3YWl0IGhhbmRsZUF1dG9TdWJtaXQoc2NvcmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTVFQgZmFpbGVkIGFmdGVyIHJldHJpZXMnKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW1ByYWN0aWNlRXhlcmNpc2VWaWV3XSBGYWlsZWQgdG8gcHJvY2VzcyByZWNvcmRpbmc6JywgZXJyb3IpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRJc1Byb2Nlc3NpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVTdG9wUmVjb3JkaW5nID0gKCkgPT4ge1xuICAgIGNvbnN0IHJlY29yZGVyID0gbWVkaWFSZWNvcmRlcigpO1xuICAgIGlmIChyZWNvcmRlciAmJiByZWNvcmRlci5zdGF0ZSAhPT0gJ2luYWN0aXZlJykge1xuICAgICAgcmVjb3JkZXIuc3RvcCgpO1xuICAgICAgc2V0SXNSZWNvcmRpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICAvLyBOb3JtYWxpemUgdGV4dCBmb3IgY29tcGFyaXNvbiAoc2FtZSBhcyBzZXJ2ZXItc2lkZSlcbiAgY29uc3Qgbm9ybWFsaXplVGV4dCA9ICh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICAgIHJldHVybiB0ZXh0XG4gICAgICAudG9Mb3dlckNhc2UoKVxuICAgICAgLnJlcGxhY2UoL1teXFx3XFxzJy1dL2csICcnKSAvLyBSZW1vdmUgcHVuY3R1YXRpb24gZXhjZXB0IGFwb3N0cm9waGVzIGFuZCBoeXBoZW5zXG4gICAgICAucmVwbGFjZSgvXFxzKy9nLCAnICcpXG4gICAgICAudHJpbSgpO1xuICB9O1xuICBcbiAgY29uc3QgY2FsY3VsYXRlU2NvcmUgPSAoZXhwZWN0ZWQ6IHN0cmluZywgYWN0dWFsOiBzdHJpbmcpOiBudW1iZXIgPT4ge1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRFeHBlY3RlZCA9IG5vcm1hbGl6ZVRleHQoZXhwZWN0ZWQpO1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRBY3R1YWwgPSBub3JtYWxpemVUZXh0KGFjdHVhbCk7XG4gICAgXG4gICAgLy8gSWYgdGhleSdyZSBleGFjdGx5IHRoZSBzYW1lIGFmdGVyIG5vcm1hbGl6YXRpb24sIGl0J3MgMTAwJVxuICAgIGlmIChub3JtYWxpemVkRXhwZWN0ZWQgPT09IG5vcm1hbGl6ZWRBY3R1YWwpIHtcbiAgICAgIHJldHVybiAxMDA7XG4gICAgfVxuICAgIFxuICAgIC8vIE90aGVyd2lzZSwgZG8gd29yZC1ieS13b3JkIGNvbXBhcmlzb25cbiAgICBjb25zdCBleHBlY3RlZFdvcmRzID0gbm9ybWFsaXplZEV4cGVjdGVkLnNwbGl0KC9cXHMrLyk7XG4gICAgY29uc3QgYWN0dWFsV29yZHMgPSBub3JtYWxpemVkQWN0dWFsLnNwbGl0KC9cXHMrLyk7XG4gICAgbGV0IG1hdGNoZXMgPSAwO1xuICAgIFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwZWN0ZWRXb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFjdHVhbFdvcmRzW2ldID09PSBleHBlY3RlZFdvcmRzW2ldKSB7XG4gICAgICAgIG1hdGNoZXMrKztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIE1hdGgucm91bmQoKG1hdGNoZXMgLyBleHBlY3RlZFdvcmRzLmxlbmd0aCkgKiAxMDApO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUF1dG9TdWJtaXQgPSBhc3luYyAoc2NvcmU6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IGN1cnJlbnRFeGVyY2lzZSA9IGV4ZXJjaXNlcygpPy5bY3VycmVudEV4ZXJjaXNlSW5kZXgoKV07XG4gICAgY29uc3QgY2h1bmtzID0gYXVkaW9DaHVua3MoKTtcbiAgICBjb25zdCBibG9iID0gY2h1bmtzLmxlbmd0aCA+IDAgPyBuZXcgQmxvYihjaHVua3MsIHsgdHlwZTogJ2F1ZGlvL3dlYm0nIH0pIDogbnVsbDtcbiAgICBcbiAgICAvLyBEZXRlcm1pbmUgaWYgY29ycmVjdCAoMTAwJSBhZnRlciBub3JtYWxpemF0aW9uKVxuICAgIHNldElzQ29ycmVjdChzY29yZSA9PT0gMTAwKTtcbiAgICBzZXRTaG93RmVlZGJhY2sodHJ1ZSk7XG4gICAgXG4gICAgLy8gUGxheSBhcHByb3ByaWF0ZSBzb3VuZFxuICAgIHNvdW5kTWFuYWdlci5wbGF5KHNjb3JlID09PSAxMDAgPyAnY29ycmVjdCcgOiAnaW5jb3JyZWN0Jyk7XG4gICAgXG4gICAgaWYgKGN1cnJlbnRFeGVyY2lzZSAmJiBjdXJyZW50RXhlcmNpc2UuY2FyZF9pZHMubGVuZ3RoID4gMCAmJiBibG9iKSB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyBDb252ZXJ0IGF1ZGlvIHRvIGJhc2U2NFxuICAgICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgICBjb25zdCBiYXNlNjQgPSBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgcmVhZGVyLm9ubG9hZGVuZCA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGJhc2U2NFN0cmluZyA9IHJlYWRlci5yZXN1bHQgYXMgc3RyaW5nO1xuICAgICAgICAgICAgcmVzb2x2ZShiYXNlNjRTdHJpbmcuc3BsaXQoJywnKVsxXSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgICByZWFkZXIucmVhZEFzRGF0YVVSTChibG9iKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgaGVhZGVyczogSGVhZGVyc0luaXQgPSB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfTtcbiAgICAgICAgaWYgKHByb3BzLmF1dGhUb2tlbikge1xuICAgICAgICAgIGhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9IGBCZWFyZXIgJHtwcm9wcy5hdXRoVG9rZW59YDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN1Ym1pdCByZXZpZXdcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHthcGlCYXNlVXJsKCl9L2FwaS9wcmFjdGljZS9yZXZpZXdgLCB7XG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgaGVhZGVycyxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBleGVyY2lzZUlkOiBjdXJyZW50RXhlcmNpc2UuaWQsXG4gICAgICAgICAgICBhdWRpb0Jhc2U2NDogYmFzZTY0LFxuICAgICAgICAgICAgY2FyZFNjb3JlczogY3VycmVudEV4ZXJjaXNlLmNhcmRfaWRzLm1hcChjYXJkSWQgPT4gKHtcbiAgICAgICAgICAgICAgY2FyZElkLFxuICAgICAgICAgICAgICBzY29yZVxuICAgICAgICAgICAgfSkpXG4gICAgICAgICAgfSlcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQcmFjdGljZUV4ZXJjaXNlVmlld10gRmFpbGVkIHRvIHN1Ym1pdCByZXZpZXc6JywgZXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGhhbmRsZVN1Ym1pdCA9IGFzeW5jICgpID0+IHtcbiAgICAvLyBUaGlzIGlzIG5vdyBvbmx5IHVzZWQgYXMgZmFsbGJhY2sgaWYgbmVlZGVkXG4gICAgY29uc3Qgc2NvcmUgPSBjdXJyZW50U2NvcmUoKTtcbiAgICBpZiAoc2NvcmUgIT09IG51bGwpIHtcbiAgICAgIGF3YWl0IGhhbmRsZUF1dG9TdWJtaXQoc2NvcmUpO1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGhhbmRsZUNvbnRpbnVlID0gKCkgPT4ge1xuICAgIC8vIE1vdmUgdG8gbmV4dCBleGVyY2lzZVxuICAgIGlmIChjdXJyZW50RXhlcmNpc2VJbmRleCgpIDwgKGV4ZXJjaXNlcygpPy5sZW5ndGggfHwgMCkgLSAxKSB7XG4gICAgICBzZXRDdXJyZW50RXhlcmNpc2VJbmRleChjdXJyZW50RXhlcmNpc2VJbmRleCgpICsgMSk7XG4gICAgICBzZXRVc2VyVHJhbnNjcmlwdCgnJyk7XG4gICAgICBzZXRDdXJyZW50U2NvcmUobnVsbCk7XG4gICAgICBzZXRBdWRpb0NodW5rcyhbXSk7XG4gICAgICBzZXRTaG93RmVlZGJhY2soZmFsc2UpO1xuICAgICAgc2V0SXNDb3JyZWN0KGZhbHNlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQWxsIGV4ZXJjaXNlcyBjb21wbGV0ZWRcbiAgICAgIHByb3BzLm9uQmFjaygpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVTa2lwID0gKCkgPT4ge1xuICAgIFxuICAgIC8vIE1vdmUgdG8gbmV4dCBleGVyY2lzZVxuICAgIGlmIChjdXJyZW50RXhlcmNpc2VJbmRleCgpIDwgKGV4ZXJjaXNlcygpPy5sZW5ndGggfHwgMCkgLSAxKSB7XG4gICAgICBzZXRDdXJyZW50RXhlcmNpc2VJbmRleChjdXJyZW50RXhlcmNpc2VJbmRleCgpICsgMSk7XG4gICAgICBzZXRVc2VyVHJhbnNjcmlwdCgnJyk7XG4gICAgICBzZXRDdXJyZW50U2NvcmUobnVsbCk7XG4gICAgICBzZXRBdWRpb0NodW5rcyhbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEFsbCBleGVyY2lzZXMgY29tcGxldGVkXG4gICAgICBwcm9wcy5vbkJhY2soKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgY3VycmVudEV4ZXJjaXNlID0gKCkgPT4gZXhlcmNpc2VzKCk/LltjdXJyZW50RXhlcmNpc2VJbmRleCgpXTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9XCJoLWZ1bGwgYmctYmFzZSBmbGV4IGZsZXgtY29sXCI+XG4gICAgICA8U2hvd1xuICAgICAgICB3aGVuPXshZXhlcmNpc2VzLmxvYWRpbmd9XG4gICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFuaW1hdGUtc3BpbiByb3VuZGVkLWZ1bGwgaC0xMiB3LTEyIGJvcmRlci1iLTIgYm9yZGVyLWFjY2VudC1wcmltYXJ5IG14LWF1dG8gbWItNFwiPjwvZGl2PlxuICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbXV0ZWQtZm9yZWdyb3VuZFwiPkxvYWRpbmcgZXhlcmNpc2VzLi4uPC9wPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIH1cbiAgICAgID5cbiAgICAgICAgPFNob3dcbiAgICAgICAgICB3aGVuPXsoZXhlcmNpc2VzKCkgfHwgW10pLmxlbmd0aCA+IDB9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLThcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIG1heC13LW1kXCI+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtbXV0ZWQtZm9yZWdyb3VuZCBtYi00XCI+Tm8gcHJhY3RpY2UgZXhlcmNpc2VzIGF2YWlsYWJsZSB5ZXQuPC9wPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zbSB0ZXh0LW11dGVkLWZvcmVncm91bmRcIj5Db21wbGV0ZSBrYXJhb2tlIHNlc3Npb25zIHdpdGggZXJyb3JzIHRvIGdlbmVyYXRlIHBlcnNvbmFsaXplZCBleGVyY2lzZXMhPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIH1cbiAgICAgICAgPlxuICAgICAgICAgIDxTaG93IHdoZW49e2N1cnJlbnRFeGVyY2lzZSgpfT5cbiAgICAgICAgICAgIHsoZXhlcmNpc2UpID0+IChcbiAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICA8UHJvZ3Jlc3NCYXIgXG4gICAgICAgICAgICAgICAgICBjdXJyZW50PXtjdXJyZW50RXhlcmNpc2VJbmRleCgpICsgMX0gXG4gICAgICAgICAgICAgICAgICB0b3RhbD17ZXhlcmNpc2VzKCk/Lmxlbmd0aCB8fCAwfSBcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxQcmFjdGljZUhlYWRlciBcbiAgICAgICAgICAgICAgICAgIHRpdGxlPXtwcm9wcy5oZWFkZXJUaXRsZSB8fCBcIlwifSBcbiAgICAgICAgICAgICAgICAgIG9uRXhpdD17cHJvcHMub25CYWNrfSBcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxtYWluIGNsYXNzPVwiZmxleC0xXCI+XG4gICAgICAgICAgICAgICAgICA8RXhlcmNpc2VUZW1wbGF0ZSBpbnN0cnVjdGlvblRleHQ9XCJSZWFkIGFsb3VkOlwiPlxuICAgICAgICAgICAgICAgICAgICA8UmVhZEFsb3VkXG4gICAgICAgICAgICAgICAgICAgICAgcHJvbXB0PXtleGVyY2lzZSgpLmZ1bGxfbGluZX1cbiAgICAgICAgICAgICAgICAgICAgICB1c2VyVHJhbnNjcmlwdD17dXNlclRyYW5zY3JpcHQoKX1cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgIDwvRXhlcmNpc2VUZW1wbGF0ZT5cbiAgICAgICAgICAgICAgICA8L21haW4+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgPFNob3dcbiAgICAgICAgICAgICAgICAgIHdoZW49e3Nob3dGZWVkYmFjaygpfVxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgICAgICA8RXhlcmNpc2VGb290ZXJcbiAgICAgICAgICAgICAgICAgICAgICBpc1JlY29yZGluZz17aXNSZWNvcmRpbmcoKX1cbiAgICAgICAgICAgICAgICAgICAgICBpc1Byb2Nlc3Npbmc9e2lzUHJvY2Vzc2luZygpfVxuICAgICAgICAgICAgICAgICAgICAgIGNhblN1Ym1pdD17dXNlclRyYW5zY3JpcHQoKS50cmltKCkubGVuZ3RoID4gMH1cbiAgICAgICAgICAgICAgICAgICAgICBvblJlY29yZD17aGFuZGxlU3RhcnRSZWNvcmRpbmd9XG4gICAgICAgICAgICAgICAgICAgICAgb25TdG9wPXtoYW5kbGVTdG9wUmVjb3JkaW5nfVxuICAgICAgICAgICAgICAgICAgICAgIG9uU3VibWl0PXtoYW5kbGVTdWJtaXR9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPFJlc3BvbnNlRm9vdGVyXG4gICAgICAgICAgICAgICAgICAgIG1vZGU9XCJmZWVkYmFja1wiXG4gICAgICAgICAgICAgICAgICAgIGlzQ29ycmVjdD17aXNDb3JyZWN0KCl9XG4gICAgICAgICAgICAgICAgICAgIG9uQ29udGludWU9e2hhbmRsZUNvbnRpbnVlfVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvU2hvdz5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBTaG93LCBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB7IFVzZXJQcm9maWxlIH0gZnJvbSAnLi4vVXNlclByb2ZpbGUnO1xuaW1wb3J0IHsgQ3JlZGl0UGFjayB9IGZyb20gJy4uL0NyZWRpdFBhY2snO1xuaW1wb3J0IHsgV2FsbGV0Q29ubmVjdCB9IGZyb20gJy4uL1dhbGxldENvbm5lY3QnO1xuaW1wb3J0IHsgRmFyY2FzdGVyS2FyYW9rZVZpZXcgfSBmcm9tICcuLi8uLi9rYXJhb2tlL0ZhcmNhc3RlckthcmFva2VWaWV3JztcbmltcG9ydCB0eXBlIHsgTHlyaWNMaW5lIH0gZnJvbSAnLi4vLi4va2FyYW9rZS9MeXJpY3NEaXNwbGF5JztcbmltcG9ydCB0eXBlIHsgTGVhZGVyYm9hcmRFbnRyeSB9IGZyb20gJy4uLy4uL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmFyY2FzdGVyTWluaUFwcFByb3BzIHtcbiAgLy8gVXNlciBpbmZvXG4gIHVzZXI/OiB7XG4gICAgZmlkPzogbnVtYmVyO1xuICAgIHVzZXJuYW1lPzogc3RyaW5nO1xuICAgIGRpc3BsYXlOYW1lPzogc3RyaW5nO1xuICAgIHBmcFVybD86IHN0cmluZztcbiAgfTtcbiAgXG4gIC8vIFdhbGxldFxuICB3YWxsZXRBZGRyZXNzPzogc3RyaW5nO1xuICB3YWxsZXRDaGFpbj86ICdCYXNlJyB8ICdTb2xhbmEnO1xuICBpc1dhbGxldENvbm5lY3RlZD86IGJvb2xlYW47XG4gIFxuICAvLyBDcmVkaXRzXG4gIHVzZXJDcmVkaXRzPzogbnVtYmVyO1xuICBcbiAgLy8gQ2FsbGJhY2tzXG4gIG9uQ29ubmVjdFdhbGxldD86ICgpID0+IHZvaWQ7XG4gIG9uRGlzY29ubmVjdFdhbGxldD86ICgpID0+IHZvaWQ7XG4gIG9uUHVyY2hhc2VDcmVkaXRzPzogKHBhY2s6IHsgY3JlZGl0czogbnVtYmVyOyBwcmljZTogc3RyaW5nOyBjdXJyZW5jeTogc3RyaW5nIH0pID0+IHZvaWQ7XG4gIG9uU2VsZWN0U29uZz86ICgpID0+IHZvaWQ7XG4gIFxuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEZhcmNhc3Rlck1pbmlBcHA6IENvbXBvbmVudDxGYXJjYXN0ZXJNaW5pQXBwUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtzaG93S2FyYW9rZSwgc2V0U2hvd0thcmFva2VdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgXG4gIC8vIE1vY2sgZGF0YSBmb3IgZGVtb1xuICBjb25zdCBtb2NrTHlyaWNzOiBMeXJpY0xpbmVbXSA9IFtcbiAgICB7IGlkOiAnMScsIHRleHQ6IFwiSXMgdGhpcyB0aGUgcmVhbCBsaWZlP1wiLCBzdGFydFRpbWU6IDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzInLCB0ZXh0OiBcIklzIHRoaXMganVzdCBmYW50YXN5P1wiLCBzdGFydFRpbWU6IDIwMDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzMnLCB0ZXh0OiBcIkNhdWdodCBpbiBhIGxhbmRzbGlkZVwiLCBzdGFydFRpbWU6IDQwMDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzQnLCB0ZXh0OiBcIk5vIGVzY2FwZSBmcm9tIHJlYWxpdHlcIiwgc3RhcnRUaW1lOiA2MDAwLCBkdXJhdGlvbjogMjAwMCB9LFxuICBdO1xuICBcbiAgY29uc3QgbW9ja0xlYWRlcmJvYXJkOiBMZWFkZXJib2FyZEVudHJ5W10gPSBbXG4gICAgeyByYW5rOiAxLCB1c2VybmFtZTogXCJhbGljZVwiLCBzY29yZTogOTgwIH0sXG4gICAgeyByYW5rOiAyLCB1c2VybmFtZTogXCJib2JcIiwgc2NvcmU6IDk0NSB9LFxuICAgIHsgcmFuazogMywgdXNlcm5hbWU6IFwiY2Fyb2xcIiwgc2NvcmU6IDkyMCB9LFxuICBdO1xuXG4gIGNvbnN0IGNyZWRpdFBhY2tzID0gW1xuICAgIHsgY3JlZGl0czogMjUwLCBwcmljZTogJzIuNTAnLCBjdXJyZW5jeTogJ1VTREMnIGFzIGNvbnN0IH0sXG4gICAgeyBjcmVkaXRzOiA1MDAsIHByaWNlOiAnNC43NScsIGN1cnJlbmN5OiAnVVNEQycgYXMgY29uc3QsIGRpc2NvdW50OiA1LCByZWNvbW1lbmRlZDogdHJ1ZSB9LFxuICAgIHsgY3JlZGl0czogMTIwMCwgcHJpY2U6ICcxMC4wMCcsIGN1cnJlbmN5OiAnVVNEQycgYXMgY29uc3QsIGRpc2NvdW50OiAxNiB9LFxuICBdO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgaC1zY3JlZW4gYmctYmFzZScsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogSGVhZGVyIHdpdGggdXNlciBwcm9maWxlICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2UgYm9yZGVyLWIgYm9yZGVyLXN1YnRsZVwiPlxuICAgICAgICA8VXNlclByb2ZpbGVcbiAgICAgICAgICBmaWQ9e3Byb3BzLnVzZXI/LmZpZH1cbiAgICAgICAgICB1c2VybmFtZT17cHJvcHMudXNlcj8udXNlcm5hbWV9XG4gICAgICAgICAgZGlzcGxheU5hbWU9e3Byb3BzLnVzZXI/LmRpc3BsYXlOYW1lfVxuICAgICAgICAgIHBmcFVybD17cHJvcHMudXNlcj8ucGZwVXJsfVxuICAgICAgICAgIGNyZWRpdHM9e3Byb3BzLnVzZXJDcmVkaXRzIHx8IDB9XG4gICAgICAgIC8+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgey8qIE1haW4gY29udGVudCAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgb3ZlcmZsb3ctYXV0b1wiPlxuICAgICAgICA8U2hvd1xuICAgICAgICAgIHdoZW49e3Nob3dLYXJhb2tlKCl9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInAtNCBzcGFjZS15LTZcIj5cbiAgICAgICAgICAgICAgey8qIEhlcm8gc2VjdGlvbiAqL31cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIHB5LThcIj5cbiAgICAgICAgICAgICAgICA8aDEgY2xhc3M9XCJ0ZXh0LTN4bCBmb250LWJvbGQgbWItMlwiPlNjYXJsZXR0IEthcmFva2U8L2gxPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zZWNvbmRhcnlcIj5cbiAgICAgICAgICAgICAgICAgIFNpbmcgeW91ciBmYXZvcml0ZSBzb25ncyBhbmQgY29tcGV0ZSB3aXRoIGZyaWVuZHMhXG4gICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIHsvKiBDcmVkaXRzIGNoZWNrICovfVxuICAgICAgICAgICAgICA8U2hvd1xuICAgICAgICAgICAgICAgIHdoZW49e3Byb3BzLnVzZXJDcmVkaXRzICYmIHByb3BzLnVzZXJDcmVkaXRzID4gMH1cbiAgICAgICAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS02XCI+XG4gICAgICAgICAgICAgICAgICAgIHsvKiBXYWxsZXQgY29ubmVjdGlvbiAqL31cbiAgICAgICAgICAgICAgICAgICAgPFdhbGxldENvbm5lY3RcbiAgICAgICAgICAgICAgICAgICAgICBhZGRyZXNzPXtwcm9wcy53YWxsZXRBZGRyZXNzfVxuICAgICAgICAgICAgICAgICAgICAgIGNoYWluPXtwcm9wcy53YWxsZXRDaGFpbn1cbiAgICAgICAgICAgICAgICAgICAgICBpc0Nvbm5lY3RlZD17cHJvcHMuaXNXYWxsZXRDb25uZWN0ZWR9XG4gICAgICAgICAgICAgICAgICAgICAgb25Db25uZWN0PXtwcm9wcy5vbkNvbm5lY3RXYWxsZXR9XG4gICAgICAgICAgICAgICAgICAgICAgb25EaXNjb25uZWN0PXtwcm9wcy5vbkRpc2Nvbm5lY3RXYWxsZXR9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB7LyogQ3JlZGl0IHBhY2tzICovfVxuICAgICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5pc1dhbGxldENvbm5lY3RlZH0+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQteGwgZm9udC1zZW1pYm9sZCBtYi00XCI+UHVyY2hhc2UgQ3JlZGl0czwvaDI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtMyBnYXAtNFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7Y3JlZGl0UGFja3MubWFwKChwYWNrKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPENyZWRpdFBhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsuLi5wYWNrfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25QdXJjaGFzZT17KCkgPT4gcHJvcHMub25QdXJjaGFzZUNyZWRpdHM/LihwYWNrKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICB7LyogU29uZyBzZWxlY3Rpb24gKi99XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNFwiPlxuICAgICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC14bCBmb250LXNlbWlib2xkXCI+U2VsZWN0IGEgU29uZzwvaDI+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uIFxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBwLTQgYmctc3VyZmFjZSByb3VuZGVkLWxnIGJvcmRlciBib3JkZXItc3VidGxlIGhvdmVyOmJvcmRlci1hY2NlbnQtcHJpbWFyeSB0cmFuc2l0aW9uLWNvbG9ycyB0ZXh0LWxlZnRcIlxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93S2FyYW9rZSh0cnVlKX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZvbnQtc2VtaWJvbGRcIj5Cb2hlbWlhbiBSaGFwc29keTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeVwiPlF1ZWVuPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXhzIHRleHQtdGVydGlhcnkgbXQtMVwiPkNvc3Q6IDUwIGNyZWRpdHM8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICB9XG4gICAgICAgID5cbiAgICAgICAgICA8RmFyY2FzdGVyS2FyYW9rZVZpZXdcbiAgICAgICAgICAgIHNvbmdUaXRsZT1cIkJvaGVtaWFuIFJoYXBzb2R5XCJcbiAgICAgICAgICAgIGFydGlzdD1cIlF1ZWVuXCJcbiAgICAgICAgICAgIHNjb3JlPXswfVxuICAgICAgICAgICAgcmFuaz17MX1cbiAgICAgICAgICAgIGx5cmljcz17bW9ja0x5cmljc31cbiAgICAgICAgICAgIGN1cnJlbnRUaW1lPXswfVxuICAgICAgICAgICAgbGVhZGVyYm9hcmQ9e21vY2tMZWFkZXJib2FyZH1cbiAgICAgICAgICAgIGlzUGxheWluZz17ZmFsc2V9XG4gICAgICAgICAgICBvblN0YXJ0PXsoKSA9PiBjb25zb2xlLmxvZygnU3RhcnQga2FyYW9rZScpfVxuICAgICAgICAgICAgb25TcGVlZENoYW5nZT17KHNwZWVkKSA9PiBjb25zb2xlLmxvZygnU3BlZWQ6Jywgc3BlZWQpfVxuICAgICAgICAgICAgb25CYWNrPXsoKSA9PiBzZXRTaG93S2FyYW9rZShmYWxzZSl9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9TaG93PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3csIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgSlNYIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL0J1dHRvbic7XG5pbXBvcnQgSWNvblVzZXJGaWxsIGZyb20gJ3Bob3NwaG9yLWljb25zLXNvbGlkL0ljb25Vc2VyRmlsbCc7XG5pbXBvcnQgSWNvbkNhcmV0RG93bkZpbGwgZnJvbSAncGhvc3Bob3ItaWNvbnMtc29saWQvSWNvbkNhcmV0RG93bkZpbGwnO1xuaW1wb3J0IEljb25TaWduT3V0RmlsbCBmcm9tICdwaG9zcGhvci1pY29ucy1zb2xpZC9JY29uU2lnbk91dEZpbGwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEF1dGhCdXR0b25Qcm9wcyB7XG4gIHVzZXI/OiB7XG4gICAgdXNlcm5hbWU/OiBzdHJpbmc7XG4gICAgYWRkcmVzcz86IHN0cmluZztcbiAgICBhdmF0YXJVcmw/OiBzdHJpbmc7XG4gICAgY3JlZGl0cz86IG51bWJlcjtcbiAgfTtcbiAgaXNMb2FkaW5nPzogYm9vbGVhbjtcbiAgb25TaWduSW5DbGljaz86ICgpID0+IHZvaWQ7XG4gIG9uU2lnbk91dENsaWNrPzogKCkgPT4gdm9pZDtcbiAgdmFyaWFudD86ICdwcmltYXJ5JyB8ICdzZWNvbmRhcnknIHwgJ2dob3N0JztcbiAgc2l6ZT86ICdzbScgfCAnbWQnIHwgJ2xnJztcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBBdXRoQnV0dG9uKHByb3BzOiBBdXRoQnV0dG9uUHJvcHMpIHtcbiAgY29uc3QgW3Nob3dEcm9wZG93biwgc2V0U2hvd0Ryb3Bkb3duXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG5cbiAgY29uc3QgZm9ybWF0QWRkcmVzcyA9IChhZGRyZXNzOiBzdHJpbmcpID0+IHtcbiAgICByZXR1cm4gYCR7YWRkcmVzcy5zbGljZSgwLCA2KX0uLi4ke2FkZHJlc3Muc2xpY2UoLTQpfWA7XG4gIH07XG5cbiAgY29uc3QgZGlzcGxheU5hbWUgPSAoKSA9PiB7XG4gICAgY29uc3QgdXNlciA9IHByb3BzLnVzZXI7XG4gICAgaWYgKCF1c2VyKSByZXR1cm4gJyc7XG4gICAgXG4gICAgaWYgKHVzZXIudXNlcm5hbWUpIHtcbiAgICAgIHJldHVybiBgQCR7dXNlci51c2VybmFtZX1gO1xuICAgIH0gZWxzZSBpZiAodXNlci5hZGRyZXNzKSB7XG4gICAgICByZXR1cm4gZm9ybWF0QWRkcmVzcyh1c2VyLmFkZHJlc3MpO1xuICAgIH1cbiAgICByZXR1cm4gJ1VzZXInO1xuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz1cInJlbGF0aXZlXCI+XG4gICAgICA8U2hvd1xuICAgICAgICB3aGVuPXtwcm9wcy51c2VyfVxuICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgdmFyaWFudD17cHJvcHMudmFyaWFudCB8fCAncHJpbWFyeSd9XG4gICAgICAgICAgICBzaXplPXtwcm9wcy5zaXplIHx8ICdtZCd9XG4gICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblNpZ25JbkNsaWNrfVxuICAgICAgICAgICAgbG9hZGluZz17cHJvcHMuaXNMb2FkaW5nfVxuICAgICAgICAgICAgbGVmdEljb249ezxJY29uVXNlckZpbGwgLz59XG4gICAgICAgICAgICBjbGFzcz17cHJvcHMuY2xhc3N9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgU2lnbiBJblxuICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICB9XG4gICAgICA+XG4gICAgICAgIDxidXR0b25cbiAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93RHJvcGRvd24oIXNob3dEcm9wZG93bigpKX1cbiAgICAgICAgICBjbGFzcz17YFxuICAgICAgICAgICAgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgcHgtNCBweS0yIHJvdW5kZWQtbGdcbiAgICAgICAgICAgIGJnLWVsZXZhdGVkIGJvcmRlciBib3JkZXItc3VidGxlXG4gICAgICAgICAgICBob3ZlcjpiZy1oaWdobGlnaHQgaG92ZXI6Ym9yZGVyLWRlZmF1bHRcbiAgICAgICAgICAgIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMFxuICAgICAgICAgICAgJHtwcm9wcy5jbGFzcyB8fCAnJ31cbiAgICAgICAgICBgfVxuICAgICAgICA+XG4gICAgICAgICAgPFNob3dcbiAgICAgICAgICAgIHdoZW49e3Byb3BzLnVzZXI/LmF2YXRhclVybH1cbiAgICAgICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInctOCBoLTggcm91bmRlZC1mdWxsIGJnLXN1cmZhY2UgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICA8SWNvblVzZXJGaWxsIGNsYXNzPVwidy01IGgtNSB0ZXh0LXNlY29uZGFyeVwiIC8+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxpbWdcbiAgICAgICAgICAgICAgc3JjPXtwcm9wcy51c2VyIS5hdmF0YXJVcmx9XG4gICAgICAgICAgICAgIGFsdD17ZGlzcGxheU5hbWUoKX1cbiAgICAgICAgICAgICAgY2xhc3M9XCJ3LTggaC04IHJvdW5kZWQtZnVsbCBvYmplY3QtY292ZXJcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgXG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtcHJpbWFyeVwiPlxuICAgICAgICAgICAge2Rpc3BsYXlOYW1lKCl9XG4gICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgIFxuICAgICAgICAgIDxJY29uQ2FyZXREb3duRmlsbFxuICAgICAgICAgICAgY2xhc3M9e2B3LTQgaC00IHRleHQtc2Vjb25kYXJ5IHRyYW5zaXRpb24tdHJhbnNmb3JtIGR1cmF0aW9uLTIwMCAke1xuICAgICAgICAgICAgICBzaG93RHJvcGRvd24oKSA/ICdyb3RhdGUtMTgwJyA6ICcnXG4gICAgICAgICAgICB9YH1cbiAgICAgICAgICAvPlxuICAgICAgICA8L2J1dHRvbj5cblxuICAgICAgICA8U2hvdyB3aGVuPXtzaG93RHJvcGRvd24oKX0+XG4gICAgICAgICAgPGRpdlxuICAgICAgICAgICAgY2xhc3M9XCJhYnNvbHV0ZSByaWdodC0wIG10LTIgdy01NiByb3VuZGVkLWxnIGJnLWVsZXZhdGVkIGJvcmRlciBib3JkZXItc3VidGxlIHNoYWRvdy1sZyBvdmVyZmxvdy1oaWRkZW4gei01MFwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicC0yXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB4LTMgcHktMlwiPlxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtcHJpbWFyeVwiPlxuICAgICAgICAgICAgICAgICAgICB7ZGlzcGxheU5hbWUoKX1cbiAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnVzZXI/LmNyZWRpdHMgIT09IHVuZGVmaW5lZH0+XG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC14cyB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAg8J+SsCB7cHJvcHMudXNlciEuY3JlZGl0c30gY3JlZGl0c1xuICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImgtcHggYmctc3VidGxlIG15LTJcIiAvPlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uU2lnbk91dENsaWNrfVxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgcHgtMyBweS0yIHRleHQtc20gdGV4dC1wcmltYXJ5IGhvdmVyOmJnLWhpZ2hsaWdodCByb3VuZGVkLW1kIHRyYW5zaXRpb24tY29sb3JzIGR1cmF0aW9uLTIwMFwiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPEljb25TaWduT3V0RmlsbCBjbGFzcz1cInctNCBoLTRcIiAvPlxuICAgICAgICAgICAgICAgICAgU2lnbiBPdXRcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICA8L1Nob3c+XG4gICAgPC9kaXY+XG4gICk7XG59IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBGb3IgfSBmcm9tICdzb2xpZC1qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU29uZyB7XG4gIGlkOiBzdHJpbmc7XG4gIHRyYWNrSWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgYXJ0aXN0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSG9tZVBhZ2VQcm9wcyB7XG4gIHNvbmdzOiBTb25nW107XG4gIG9uU29uZ1NlbGVjdD86IChzb25nOiBTb25nKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgSG9tZVBhZ2U6IENvbXBvbmVudDxIb21lUGFnZVByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBzb25nSXRlbVN0eWxlID0ge1xuICAgIHBhZGRpbmc6ICcxNnB4JyxcbiAgICAnbWFyZ2luLWJvdHRvbSc6ICc4cHgnLFxuICAgICdiYWNrZ3JvdW5kLWNvbG9yJzogJyMxYTFhMWEnLFxuICAgICdib3JkZXItcmFkaXVzJzogJzhweCcsXG4gICAgY3Vyc29yOiAncG9pbnRlcidcbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXY+XG4gICAgICA8ZGl2IHN0eWxlPXt7IHBhZGRpbmc6ICcxNnB4JywgJ2JhY2tncm91bmQtY29sb3InOiAnIzFhMWExYScgfX0+XG4gICAgICAgIDxoMSBzdHlsZT17eyBtYXJnaW46ICcwIDAgOHB4IDAnLCAnZm9udC1zaXplJzogJzI0cHgnIH19PlBvcHVsYXIgU29uZ3M8L2gxPlxuICAgICAgICA8cCBzdHlsZT17eyBtYXJnaW46ICcwJywgY29sb3I6ICcjODg4JyB9fT5DaG9vc2UgYSBzb25nIHRvIHN0YXJ0IHNpbmdpbmc8L3A+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAnMTZweCcgfX0+XG4gICAgICAgIDxGb3IgZWFjaD17cHJvcHMuc29uZ3N9PlxuICAgICAgICAgIHsoc29uZywgaW5kZXgpID0+IChcbiAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgIHN0eWxlPXtzb25nSXRlbVN0eWxlfVxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBwcm9wcy5vblNvbmdTZWxlY3Q/Lihzb25nKX1cbiAgICAgICAgICAgICAgb25Nb3VzZUVudGVyPXsoZSkgPT4gZS5jdXJyZW50VGFyZ2V0LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcjMmEyYTJhJ31cbiAgICAgICAgICAgICAgb25Nb3VzZUxlYXZlPXsoZSkgPT4gZS5jdXJyZW50VGFyZ2V0LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcjMWExYTFhJ31cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnZmxleCcsIGdhcDogJzE2cHgnIH19PlxuICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IGNvbG9yOiAnIzY2NicgfX0+e2luZGV4KCkgKyAxfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyAnZm9udC13ZWlnaHQnOiAnYm9sZCcgfX0+e3NvbmcudGl0bGV9PC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGNvbG9yOiAnIzg4OCcgfX0+e3NvbmcuYXJ0aXN0fTwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvRm9yPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCwgb25DbGVhbnVwIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBMeXJpY0xpbmUgfSBmcm9tICcuLi9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheSc7XG5pbXBvcnQgeyBjcmVhdGVLYXJhb2tlQXVkaW9Qcm9jZXNzb3IgfSBmcm9tICcuLi9zZXJ2aWNlcy9hdWRpby9rYXJhb2tlQXVkaW9Qcm9jZXNzb3InO1xuaW1wb3J0IHsgc2hvdWxkQ2h1bmtMaW5lcywgY2FsY3VsYXRlUmVjb3JkaW5nRHVyYXRpb24gfSBmcm9tICcuLi9zZXJ2aWNlcy9rYXJhb2tlL2NodW5raW5nVXRpbHMnO1xuaW1wb3J0IHsgS2FyYW9rZUFwaVNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9rYXJhb2tlL2thcmFva2VBcGknO1xuaW1wb3J0IHR5cGUgeyBDaHVua0luZm8gfSBmcm9tICdAc2NhcmxldHQvY29yZSc7XG5pbXBvcnQgdHlwZSB7IFBsYXliYWNrU3BlZWQgfSBmcm9tICcuLi9jb21wb25lbnRzL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVXNlS2FyYW9rZVNlc3Npb25PcHRpb25zIHtcbiAgbHlyaWNzOiBMeXJpY0xpbmVbXTtcbiAgb25Db21wbGV0ZT86IChyZXN1bHRzOiBLYXJhb2tlUmVzdWx0cykgPT4gdm9pZDtcbiAgYXVkaW9FbGVtZW50PzogSFRNTEF1ZGlvRWxlbWVudDtcbiAgdHJhY2tJZD86IHN0cmluZztcbiAgc29uZ0RhdGE/OiB7XG4gICAgdGl0bGU6IHN0cmluZztcbiAgICBhcnRpc3Q6IHN0cmluZztcbiAgICBhbGJ1bT86IHN0cmluZztcbiAgICBkdXJhdGlvbj86IG51bWJlcjtcbiAgfTtcbiAgc29uZ0NhdGFsb2dJZD86IHN0cmluZztcbiAgYXBpVXJsPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEthcmFva2VSZXN1bHRzIHtcbiAgc2NvcmU6IG51bWJlcjtcbiAgYWNjdXJhY3k6IG51bWJlcjtcbiAgdG90YWxMaW5lczogbnVtYmVyO1xuICBwZXJmZWN0TGluZXM6IG51bWJlcjtcbiAgZ29vZExpbmVzOiBudW1iZXI7XG4gIG5lZWRzV29ya0xpbmVzOiBudW1iZXI7XG4gIHNlc3Npb25JZD86IHN0cmluZztcbiAgaXNMb2FkaW5nPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMaW5lU2NvcmUge1xuICBsaW5lSW5kZXg6IG51bWJlcjtcbiAgc2NvcmU6IG51bWJlcjtcbiAgdHJhbnNjcmlwdGlvbjogc3RyaW5nO1xuICBmZWVkYmFjaz86IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUthcmFva2VTZXNzaW9uKG9wdGlvbnM6IFVzZUthcmFva2VTZXNzaW9uT3B0aW9ucykge1xuICBjb25zdCBbaXNQbGF5aW5nLCBzZXRJc1BsYXlpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2N1cnJlbnRUaW1lLCBzZXRDdXJyZW50VGltZV0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFtzY29yZSwgc2V0U2NvcmVdID0gY3JlYXRlU2lnbmFsKDApO1xuICBjb25zdCBbY291bnRkb3duLCBzZXRDb3VudGRvd25dID0gY3JlYXRlU2lnbmFsPG51bWJlciB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbc2Vzc2lvbklkLCBzZXRTZXNzaW9uSWRdID0gY3JlYXRlU2lnbmFsPHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbbGluZVNjb3Jlcywgc2V0TGluZVNjb3Jlc10gPSBjcmVhdGVTaWduYWw8TGluZVNjb3JlW10+KFtdKTtcbiAgY29uc3QgW2N1cnJlbnRDaHVuaywgc2V0Q3VycmVudENodW5rXSA9IGNyZWF0ZVNpZ25hbDxDaHVua0luZm8gfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2lzUmVjb3JkaW5nLCBzZXRJc1JlY29yZGluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbYXVkaW9FbGVtZW50LCBzZXRBdWRpb0VsZW1lbnRdID0gY3JlYXRlU2lnbmFsPEhUTUxBdWRpb0VsZW1lbnQgfCB1bmRlZmluZWQ+KG9wdGlvbnMuYXVkaW9FbGVtZW50KTtcbiAgY29uc3QgW3JlY29yZGVkQ2h1bmtzLCBzZXRSZWNvcmRlZENodW5rc10gPSBjcmVhdGVTaWduYWw8U2V0PG51bWJlcj4+KG5ldyBTZXQoKSk7XG4gIGNvbnN0IFtwbGF5YmFja1NwZWVkLCBzZXRQbGF5YmFja1NwZWVkXSA9IGNyZWF0ZVNpZ25hbDxQbGF5YmFja1NwZWVkPignMXgnKTtcbiAgXG4gIGxldCBhdWRpb1VwZGF0ZUludGVydmFsOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgbGV0IHJlY29yZGluZ1RpbWVvdXQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBcbiAgY29uc3QgYXVkaW9Qcm9jZXNzb3IgPSBjcmVhdGVLYXJhb2tlQXVkaW9Qcm9jZXNzb3Ioe1xuICAgIHNhbXBsZVJhdGU6IDE2MDAwXG4gIH0pO1xuICBcbiAgY29uc3Qga2FyYW9rZUFwaSA9IG5ldyBLYXJhb2tlQXBpU2VydmljZShvcHRpb25zLmFwaVVybCk7XG5cbiAgLy8gSGVscGVyIHRvIGNvbnZlcnQgc3BlZWQgdG8gcGxheWJhY2sgcmF0ZVxuICBjb25zdCBnZXRQbGF5YmFja1JhdGUgPSAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpOiBudW1iZXIgPT4ge1xuICAgIHN3aXRjaCAoc3BlZWQpIHtcbiAgICAgIGNhc2UgJzAuNXgnOiByZXR1cm4gMC41O1xuICAgICAgY2FzZSAnMC43NXgnOiByZXR1cm4gMC43NTtcbiAgICAgIGNhc2UgJzF4JzogcmV0dXJuIDEuMDtcbiAgICAgIGRlZmF1bHQ6IHJldHVybiAxLjA7XG4gICAgfVxuICB9O1xuXG4gIC8vIEhlbHBlciB0byBnZXQgc3BlZWQgbXVsdGlwbGllciBmb3Igc2NvcmluZ1xuICBjb25zdCBnZXRTcGVlZE11bHRpcGxpZXIgPSAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpOiBudW1iZXIgPT4ge1xuICAgIHN3aXRjaCAoc3BlZWQpIHtcbiAgICAgIGNhc2UgJzAuNXgnOiByZXR1cm4gMS4yOyAgLy8gMjAlIHNjb3JlIGJvb3N0IGZvciBzbG93ZXN0IHNwZWVkXG4gICAgICBjYXNlICcwLjc1eCc6IHJldHVybiAxLjE7IC8vIDEwJSBzY29yZSBib29zdCBmb3IgbWVkaXVtIHNwZWVkXG4gICAgICBjYXNlICcxeCc6IHJldHVybiAxLjA7ICAgIC8vIE5vIGFkanVzdG1lbnQgZm9yIG5vcm1hbCBzcGVlZFxuICAgICAgZGVmYXVsdDogcmV0dXJuIDEuMDtcbiAgICB9XG4gIH07XG5cbiAgLy8gSGFuZGxlIHNwZWVkIGNoYW5nZVxuICBjb25zdCBoYW5kbGVTcGVlZENoYW5nZSA9IChzcGVlZDogUGxheWJhY2tTcGVlZCkgPT4ge1xuICAgIHNldFBsYXliYWNrU3BlZWQoc3BlZWQpO1xuICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9FbGVtZW50KCk7XG4gICAgaWYgKGF1ZGlvKSB7XG4gICAgICBjb25zdCByYXRlID0gZ2V0UGxheWJhY2tSYXRlKHNwZWVkKTtcbiAgICAgIGF1ZGlvLnBsYXliYWNrUmF0ZSA9IHJhdGU7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IHN0YXJ0U2Vzc2lvbiA9IGFzeW5jICgpID0+IHtcbiAgICAvLyBJbml0aWFsaXplIGF1ZGlvIGNhcHR1cmVcbiAgICB0cnkge1xuICAgICAgYXdhaXQgYXVkaW9Qcm9jZXNzb3IuaW5pdGlhbGl6ZSgpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBpbml0aWFsaXplIGF1ZGlvOicsIGVycm9yKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ3JlYXRlIHNlc3Npb24gb24gc2VydmVyIGlmIHRyYWNrSWQgcHJvdmlkZWRcbiAgICBcbiAgICBpZiAob3B0aW9ucy50cmFja0lkICYmIG9wdGlvbnMuc29uZ0RhdGEpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBrYXJhb2tlQXBpLnN0YXJ0U2Vzc2lvbihcbiAgICAgICAgICBvcHRpb25zLnRyYWNrSWQsXG4gICAgICAgICAge1xuICAgICAgICAgICAgdGl0bGU6IG9wdGlvbnMuc29uZ0RhdGEudGl0bGUsXG4gICAgICAgICAgICBhcnRpc3Q6IG9wdGlvbnMuc29uZ0RhdGEuYXJ0aXN0LFxuICAgICAgICAgICAgZHVyYXRpb246IG9wdGlvbnMuc29uZ0RhdGEuZHVyYXRpb24sXG4gICAgICAgICAgICBkaWZmaWN1bHR5OiAnaW50ZXJtZWRpYXRlJywgLy8gRGVmYXVsdCBkaWZmaWN1bHR5XG4gICAgICAgICAgfSxcbiAgICAgICAgICB1bmRlZmluZWQsIC8vIGF1dGhUb2tlblxuICAgICAgICAgIG9wdGlvbnMuc29uZ0NhdGFsb2dJZCxcbiAgICAgICAgICBwbGF5YmFja1NwZWVkKClcbiAgICAgICAgKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChzZXNzaW9uKSB7XG4gICAgICAgICAgc2V0U2Vzc2lvbklkKHNlc3Npb24uaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIGNyZWF0ZSBzZXNzaW9uJyk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIGNyZWF0ZSBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgIH1cbiAgICBcbiAgICAvLyBTdGFydCBjb3VudGRvd25cbiAgICBzZXRDb3VudGRvd24oMyk7XG4gICAgXG4gICAgY29uc3QgY291bnRkb3duSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBjb25zdCBjdXJyZW50ID0gY291bnRkb3duKCk7XG4gICAgICBpZiAoY3VycmVudCAhPT0gbnVsbCAmJiBjdXJyZW50ID4gMSkge1xuICAgICAgICBzZXRDb3VudGRvd24oY3VycmVudCAtIDEpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2xlYXJJbnRlcnZhbChjb3VudGRvd25JbnRlcnZhbCk7XG4gICAgICAgIHNldENvdW50ZG93bihudWxsKTtcbiAgICAgICAgc3RhcnRQbGF5YmFjaygpO1xuICAgICAgfVxuICAgIH0sIDEwMDApO1xuICB9O1xuXG4gIGNvbnN0IHN0YXJ0UGxheWJhY2sgPSAoKSA9PiB7XG4gICAgc2V0SXNQbGF5aW5nKHRydWUpO1xuICAgIFxuICAgIC8vIFN0YXJ0IGZ1bGwgc2Vzc2lvbiBhdWRpbyBjYXB0dXJlXG4gICAgYXVkaW9Qcm9jZXNzb3Iuc3RhcnRGdWxsU2Vzc2lvbigpO1xuICAgIFxuICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9FbGVtZW50KCkgfHwgb3B0aW9ucy5hdWRpb0VsZW1lbnQ7XG4gICAgaWYgKGF1ZGlvKSB7XG4gICAgICAvLyBTZXQgcGxheWJhY2sgcmF0ZSBiYXNlZCBvbiBjdXJyZW50IHNwZWVkXG4gICAgICBjb25zdCByYXRlID0gZ2V0UGxheWJhY2tSYXRlKHBsYXliYWNrU3BlZWQoKSk7XG4gICAgICBhdWRpby5wbGF5YmFja1JhdGUgPSByYXRlO1xuICAgICAgLy8gSWYgYXVkaW8gZWxlbWVudCBpcyBwcm92aWRlZCwgdXNlIGl0XG4gICAgICBhdWRpby5wbGF5KCkuY2F0Y2goY29uc29sZS5lcnJvcik7XG4gICAgICBcbiAgICAgIGNvbnN0IHVwZGF0ZVRpbWUgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHRpbWUgPSBhdWRpby5jdXJyZW50VGltZSAqIDEwMDA7XG4gICAgICAgIHNldEN1cnJlbnRUaW1lKHRpbWUpO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgd2UgbmVlZCB0byBzdGFydCByZWNvcmRpbmcgZm9yIHVwY29taW5nIGxpbmVzXG4gICAgICAgIGNoZWNrRm9yVXBjb21pbmdMaW5lcyh0aW1lKTtcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGF1ZGlvVXBkYXRlSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCh1cGRhdGVUaW1lLCAxMDApIGFzIHVua25vd24gYXMgbnVtYmVyO1xuICAgICAgXG4gICAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsIGhhbmRsZUVuZCk7XG4gICAgfSBlbHNlIHtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBjaGVja0ZvclVwY29taW5nTGluZXMgPSAoY3VycmVudFRpbWVNczogbnVtYmVyKSA9PiB7XG4gICAgaWYgKGlzUmVjb3JkaW5nKCkgfHwgIW9wdGlvbnMubHlyaWNzLmxlbmd0aCkgcmV0dXJuO1xuICAgIFxuICAgIGNvbnN0IHJlY29yZGVkID0gcmVjb3JkZWRDaHVua3MoKTtcbiAgICBcbiAgICAvLyBMb29rIGZvciBjaHVua3MgdGhhdCBzaG91bGQgc3RhcnQgcmVjb3JkaW5nIHNvb25cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9wdGlvbnMubHlyaWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBTa2lwIGlmIHdlJ3ZlIGFscmVhZHkgcmVjb3JkZWQgYSBjaHVuayBzdGFydGluZyBhdCB0aGlzIGluZGV4XG4gICAgICBpZiAocmVjb3JkZWQuaGFzKGkpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjaHVuayA9IHNob3VsZENodW5rTGluZXMob3B0aW9ucy5seXJpY3MsIGkpO1xuICAgICAgY29uc3QgZmlyc3RMaW5lID0gb3B0aW9ucy5seXJpY3NbY2h1bmsuc3RhcnRJbmRleF07XG4gICAgICBcbiAgICAgIGlmIChmaXJzdExpbmUgJiYgZmlyc3RMaW5lLnN0YXJ0VGltZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IHJlY29yZGluZ1N0YXJ0VGltZSA9IGZpcnN0TGluZS5zdGFydFRpbWUgKiAxMDAwIC0gMTAwMDsgLy8gU3RhcnQgMXMgZWFybHlcbiAgICAgICAgY29uc3QgbGluZVN0YXJ0VGltZSA9IGZpcnN0TGluZS5zdGFydFRpbWUgKiAxMDAwO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgd2UncmUgaW4gdGhlIHJlY29yZGluZyB3aW5kb3cgYW5kIGhhdmVuJ3QgcGFzc2VkIHRoZSBsaW5lIHN0YXJ0XG4gICAgICAgIGlmIChjdXJyZW50VGltZU1zID49IHJlY29yZGluZ1N0YXJ0VGltZSAmJiBjdXJyZW50VGltZU1zIDwgbGluZVN0YXJ0VGltZSArIDUwMCkgeyAvLyBBbGxvdyA1MDBtcyBidWZmZXIgYWZ0ZXIgbGluZSBzdGFydFxuICAgICAgICAgIC8vIE1hcmsgdGhpcyBjaHVuayBhcyByZWNvcmRlZFxuICAgICAgICAgIHNldFJlY29yZGVkQ2h1bmtzKHByZXYgPT4gbmV3IFNldChwcmV2KS5hZGQoY2h1bmsuc3RhcnRJbmRleCkpO1xuICAgICAgICAgIC8vIFN0YXJ0IHJlY29yZGluZyB0aGlzIGNodW5rXG4gICAgICAgICAgc3RhcnRSZWNvcmRpbmdDaHVuayhjaHVuayk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gU2tpcCBhaGVhZCB0byBhdm9pZCBjaGVja2luZyBsaW5lcyB3ZSd2ZSBhbHJlYWR5IHBhc3NlZFxuICAgICAgaSA9IGNodW5rLmVuZEluZGV4O1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IHN0YXJ0UmVjb3JkaW5nQ2h1bmsgPSBhc3luYyAoY2h1bms6IENodW5rSW5mbykgPT4ge1xuICAgIC8vIFRFU1RJTkcgTU9ERTogQXV0by1jb21wbGV0ZSBhZnRlciA1IGxpbmVzXG4gICAgaWYgKGNodW5rLnN0YXJ0SW5kZXggPj0gNSkge1xuICAgICAgaGFuZGxlRW5kKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIHNldEN1cnJlbnRDaHVuayhjaHVuayk7XG4gICAgc2V0SXNSZWNvcmRpbmcodHJ1ZSk7XG4gICAgXG4gICAgLy8gU3RhcnQgYXVkaW8gY2FwdHVyZSBmb3IgdGhpcyBjaHVua1xuICAgIGF1ZGlvUHJvY2Vzc29yLnN0YXJ0UmVjb3JkaW5nTGluZShjaHVuay5zdGFydEluZGV4KTtcbiAgICBcbiAgICAvLyBDYWxjdWxhdGUgcmVjb3JkaW5nIGR1cmF0aW9uIGFkanVzdGVkIGZvciBwbGF5YmFjayBzcGVlZFxuICAgIGNvbnN0IGJhc2VEdXJhdGlvbiA9IGNhbGN1bGF0ZVJlY29yZGluZ0R1cmF0aW9uKG9wdGlvbnMubHlyaWNzLCBjaHVuayk7XG4gICAgY29uc3Qgc3BlZWRGYWN0b3IgPSAxIC8gZ2V0UGxheWJhY2tSYXRlKHBsYXliYWNrU3BlZWQoKSk7IC8vIEludmVyc2Ugb2YgcGxheWJhY2sgcmF0ZVxuICAgIGNvbnN0IGR1cmF0aW9uID0gYmFzZUR1cmF0aW9uICogc3BlZWRGYWN0b3I7XG4gICAgXG4gICAgLy8gU3RvcCByZWNvcmRpbmcgYWZ0ZXIgZHVyYXRpb25cbiAgICByZWNvcmRpbmdUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBzdG9wUmVjb3JkaW5nQ2h1bmsoKTtcbiAgICB9LCBkdXJhdGlvbikgYXMgdW5rbm93biBhcyBudW1iZXI7XG4gIH07XG4gIFxuICBjb25zdCBzdG9wUmVjb3JkaW5nQ2h1bmsgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgY2h1bmsgPSBjdXJyZW50Q2h1bmsoKTtcbiAgICBpZiAoIWNodW5rKSByZXR1cm47XG4gICAgXG4gICAgc2V0SXNSZWNvcmRpbmcoZmFsc2UpO1xuICAgIFxuICAgIC8vIEdldCB0aGUgcmVjb3JkZWQgYXVkaW9cbiAgICBjb25zdCBhdWRpb0NodW5rcyA9IGF1ZGlvUHJvY2Vzc29yLnN0b3BSZWNvcmRpbmdMaW5lQW5kR2V0UmF3QXVkaW8oKTtcbiAgICBjb25zdCB3YXZCbG9iID0gYXVkaW9Qcm9jZXNzb3IuY29udmVydEF1ZGlvVG9XYXZCbG9iKGF1ZGlvQ2h1bmtzKTtcbiAgICBcbiAgICBcbiAgICAvLyBDaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBhdWRpbyBkYXRhXG4gICAgaWYgKHdhdkJsb2IgJiYgd2F2QmxvYi5zaXplID4gMTAwMCAmJiBzZXNzaW9uSWQoKSkgeyAvLyBNaW5pbXVtIDFLQiBvZiBhdWRpbyBkYXRhXG4gICAgICAvLyBDb252ZXJ0IHRvIGJhc2U2NCBmb3IgQVBJXG4gICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZGVuZCA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgYmFzZTY0QXVkaW8gPSByZWFkZXIucmVzdWx0Py50b1N0cmluZygpLnNwbGl0KCcsJylbMV07XG4gICAgICAgIGlmIChiYXNlNjRBdWRpbyAmJiBiYXNlNjRBdWRpby5sZW5ndGggPiAxMDApIHsgLy8gRW5zdXJlIHdlIGhhdmUgbWVhbmluZ2Z1bCBiYXNlNjQgZGF0YVxuICAgICAgICAgIGF3YWl0IGdyYWRlQ2h1bmsoY2h1bmssIGJhc2U2NEF1ZGlvKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIH1cbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzRGF0YVVSTCh3YXZCbG9iKTtcbiAgICB9IGVsc2UgaWYgKHdhdkJsb2IgJiYgd2F2QmxvYi5zaXplIDw9IDEwMDApIHtcbiAgICAgIC8vIEFkZCBhIG5ldXRyYWwgc2NvcmUgZm9yIFVJIGZlZWRiYWNrXG4gICAgICBzZXRMaW5lU2NvcmVzKHByZXYgPT4gWy4uLnByZXYsIHtcbiAgICAgICAgbGluZUluZGV4OiBjaHVuay5zdGFydEluZGV4LFxuICAgICAgICBzY29yZTogNTAsXG4gICAgICAgIHRyYW5zY3JpcHRpb246ICcnLFxuICAgICAgICBmZWVkYmFjazogJ1JlY29yZGluZyB0b28gc2hvcnQnXG4gICAgICB9XSk7XG4gICAgfSBlbHNlIGlmICh3YXZCbG9iICYmICFzZXNzaW9uSWQoKSkge1xuICAgIH1cbiAgICBcbiAgICBzZXRDdXJyZW50Q2h1bmsobnVsbCk7XG4gICAgXG4gICAgaWYgKHJlY29yZGluZ1RpbWVvdXQpIHtcbiAgICAgIGNsZWFyVGltZW91dChyZWNvcmRpbmdUaW1lb3V0KTtcbiAgICAgIHJlY29yZGluZ1RpbWVvdXQgPSBudWxsO1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGdyYWRlQ2h1bmsgPSBhc3luYyAoY2h1bms6IENodW5rSW5mbywgYXVkaW9CYXNlNjQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGN1cnJlbnRTZXNzaW9uSWQgPSBzZXNzaW9uSWQoKTtcbiAgICBcbiAgICBpZiAoIWN1cnJlbnRTZXNzaW9uSWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGxpbmVTY29yZSA9IGF3YWl0IGthcmFva2VBcGkuZ3JhZGVSZWNvcmRpbmcoXG4gICAgICAgIGN1cnJlbnRTZXNzaW9uSWQsXG4gICAgICAgIGNodW5rLnN0YXJ0SW5kZXgsXG4gICAgICAgIGF1ZGlvQmFzZTY0LFxuICAgICAgICBjaHVuay5leHBlY3RlZFRleHQsXG4gICAgICAgIG9wdGlvbnMubHlyaWNzW2NodW5rLnN0YXJ0SW5kZXhdPy5zdGFydFRpbWUgfHwgMCxcbiAgICAgICAgKG9wdGlvbnMubHlyaWNzW2NodW5rLmVuZEluZGV4XT8uc3RhcnRUaW1lIHx8IDApICsgKG9wdGlvbnMubHlyaWNzW2NodW5rLmVuZEluZGV4XT8uZHVyYXRpb24gfHwgMCkgLyAxMDAwLFxuICAgICAgICB1bmRlZmluZWQsIC8vIGF1dGhUb2tlblxuICAgICAgICBwbGF5YmFja1NwZWVkKClcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGlmIChsaW5lU2NvcmUpIHtcbiAgICAgICAgXG4gICAgICAgIC8vIEFwcGx5IHNwZWVkIG11bHRpcGxpZXIgdG8gc2NvcmUgZm9yIGxhbmd1YWdlIGxlYXJuZXJzXG4gICAgICAgIGNvbnN0IHNwZWVkTXVsdGlwbGllciA9IGdldFNwZWVkTXVsdGlwbGllcihwbGF5YmFja1NwZWVkKCkpO1xuICAgICAgICBjb25zdCBhZGp1c3RlZFNjb3JlID0gTWF0aC5taW4oMTAwLCBNYXRoLnJvdW5kKGxpbmVTY29yZS5zY29yZSAqIHNwZWVkTXVsdGlwbGllcikpO1xuICAgICAgICBcbiAgICAgICAgLy8gVXBkYXRlIGxpbmUgc2NvcmVzXG4gICAgICAgIGNvbnN0IG5ld0xpbmVTY29yZSA9IHtcbiAgICAgICAgICBsaW5lSW5kZXg6IGNodW5rLnN0YXJ0SW5kZXgsXG4gICAgICAgICAgc2NvcmU6IGFkanVzdGVkU2NvcmUsXG4gICAgICAgICAgdHJhbnNjcmlwdGlvbjogbGluZVNjb3JlLnRyYW5zY3JpcHQgfHwgJycsXG4gICAgICAgICAgZmVlZGJhY2s6IGxpbmVTY29yZS5mZWVkYmFja1xuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgc2V0TGluZVNjb3JlcyhwcmV2ID0+IFsuLi5wcmV2LCBuZXdMaW5lU2NvcmVdKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFVwZGF0ZSB0b3RhbCBzY29yZSAoc2ltcGxlIGF2ZXJhZ2UgZm9yIG5vdykgLSB1c2UgcHJldiB0byBhdm9pZCBkZXBlbmRlbmN5XG4gICAgICAgIHNldFNjb3JlKHByZXYgPT4ge1xuICAgICAgICAgIGNvbnN0IGFsbFNjb3JlcyA9IFsuLi5saW5lU2NvcmVzKCksIG5ld0xpbmVTY29yZV07XG4gICAgICAgICAgY29uc3QgYXZnU2NvcmUgPSBhbGxTY29yZXMucmVkdWNlKChzdW0sIHMpID0+IHN1bSArIHMuc2NvcmUsIDApIC8gYWxsU2NvcmVzLmxlbmd0aDtcbiAgICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChhdmdTY29yZSk7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgLy8gUmVtb3ZlZCB0ZXN0IG1vZGUgbGltaXRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIFxuICAgICAgICAvLyBBZGQgYSBuZXV0cmFsIHNjb3JlIGZvciBVSSBmZWVkYmFja1xuICAgICAgICBzZXRMaW5lU2NvcmVzKHByZXYgPT4gWy4uLnByZXYsIHtcbiAgICAgICAgICBsaW5lSW5kZXg6IGNodW5rLnN0YXJ0SW5kZXgsXG4gICAgICAgICAgc2NvcmU6IDUwLCAvLyBOZXV0cmFsIHNjb3JlXG4gICAgICAgICAgdHJhbnNjcmlwdGlvbjogJycsXG4gICAgICAgICAgZmVlZGJhY2s6ICdGYWlsZWQgdG8gZ3JhZGUgcmVjb3JkaW5nJ1xuICAgICAgICB9XSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIGdyYWRlIGNodW5rOicsIGVycm9yKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlRW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgaWYgKGF1ZGlvVXBkYXRlSW50ZXJ2YWwpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwoYXVkaW9VcGRhdGVJbnRlcnZhbCk7XG4gICAgfVxuICAgIFxuICAgIC8vIFBhdXNlIHRoZSBhdWRpb1xuICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9FbGVtZW50KCkgfHwgb3B0aW9ucy5hdWRpb0VsZW1lbnQ7XG4gICAgaWYgKGF1ZGlvICYmICFhdWRpby5wYXVzZWQpIHtcbiAgICAgIGF1ZGlvLnBhdXNlKCk7XG4gICAgfVxuICAgIFxuICAgIC8vIFN0b3AgYW55IG9uZ29pbmcgcmVjb3JkaW5nXG4gICAgaWYgKGlzUmVjb3JkaW5nKCkpIHtcbiAgICAgIGF3YWl0IHN0b3BSZWNvcmRpbmdDaHVuaygpO1xuICAgIH1cbiAgICBcbiAgICAvLyBTaG93IGxvYWRpbmcgc3RhdGUgaW1tZWRpYXRlbHlcbiAgICBjb25zdCBsb2FkaW5nUmVzdWx0czogS2FyYW9rZVJlc3VsdHMgPSB7XG4gICAgICBzY29yZTogLTEsIC8vIFNwZWNpYWwgdmFsdWUgdG8gaW5kaWNhdGUgbG9hZGluZ1xuICAgICAgYWNjdXJhY3k6IDAsXG4gICAgICB0b3RhbExpbmVzOiBsaW5lU2NvcmVzKCkubGVuZ3RoLFxuICAgICAgcGVyZmVjdExpbmVzOiAwLFxuICAgICAgZ29vZExpbmVzOiAwLFxuICAgICAgbmVlZHNXb3JrTGluZXM6IDAsXG4gICAgICBzZXNzaW9uSWQ6IHNlc3Npb25JZCgpIHx8IHVuZGVmaW5lZCxcbiAgICAgIGlzTG9hZGluZzogdHJ1ZVxuICAgIH07XG4gICAgb3B0aW9ucy5vbkNvbXBsZXRlPy4obG9hZGluZ1Jlc3VsdHMpO1xuICAgIFxuICAgIC8vIEdldCBmdWxsIHNlc3Npb24gYXVkaW9cbiAgICBjb25zdCBmdWxsQXVkaW9CbG9iID0gYXVkaW9Qcm9jZXNzb3Iuc3RvcEZ1bGxTZXNzaW9uQW5kR2V0V2F2KCk7XG4gICAgXG4gICAgLy8gQ29tcGxldGUgc2Vzc2lvbiBvbiBzZXJ2ZXJcbiAgICBjb25zdCBjdXJyZW50U2Vzc2lvbklkID0gc2Vzc2lvbklkKCk7XG4gICAgaWYgKGN1cnJlbnRTZXNzaW9uSWQgJiYgZnVsbEF1ZGlvQmxvYiAmJiBmdWxsQXVkaW9CbG9iLnNpemUgPiAxMDAwKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgICByZWFkZXIub25sb2FkZW5kID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGJhc2U2NEF1ZGlvID0gcmVhZGVyLnJlc3VsdD8udG9TdHJpbmcoKS5zcGxpdCgnLCcpWzFdO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IHNlc3Npb25SZXN1bHRzID0gYXdhaXQga2FyYW9rZUFwaS5jb21wbGV0ZVNlc3Npb24oXG4gICAgICAgICAgICBjdXJyZW50U2Vzc2lvbklkLFxuICAgICAgICAgICAgYmFzZTY0QXVkaW9cbiAgICAgICAgICApO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChzZXNzaW9uUmVzdWx0cykge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCByZXN1bHRzOiBLYXJhb2tlUmVzdWx0cyA9IHtcbiAgICAgICAgICAgICAgc2NvcmU6IHNlc3Npb25SZXN1bHRzLmZpbmFsU2NvcmUsXG4gICAgICAgICAgICAgIGFjY3VyYWN5OiBzZXNzaW9uUmVzdWx0cy5hY2N1cmFjeSxcbiAgICAgICAgICAgICAgdG90YWxMaW5lczogc2Vzc2lvblJlc3VsdHMudG90YWxMaW5lcyxcbiAgICAgICAgICAgICAgcGVyZmVjdExpbmVzOiBzZXNzaW9uUmVzdWx0cy5wZXJmZWN0TGluZXMsXG4gICAgICAgICAgICAgIGdvb2RMaW5lczogc2Vzc2lvblJlc3VsdHMuZ29vZExpbmVzLFxuICAgICAgICAgICAgICBuZWVkc1dvcmtMaW5lczogc2Vzc2lvblJlc3VsdHMubmVlZHNXb3JrTGluZXMsXG4gICAgICAgICAgICAgIHNlc3Npb25JZDogY3VycmVudFNlc3Npb25JZFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgb3B0aW9ucy5vbkNvbXBsZXRlPy4ocmVzdWx0cyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIGxvY2FsIGNhbGN1bGF0aW9uXG4gICAgICAgICAgICBjYWxjdWxhdGVMb2NhbFJlc3VsdHMoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKGZ1bGxBdWRpb0Jsb2IpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VTZXNzaW9uXSBGYWlsZWQgdG8gY29tcGxldGUgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICAgIGNhbGN1bGF0ZUxvY2FsUmVzdWx0cygpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBObyBzZXNzaW9uLCBqdXN0IHJldHVybiBsb2NhbCByZXN1bHRzXG4gICAgICBjYWxjdWxhdGVMb2NhbFJlc3VsdHMoKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBjYWxjdWxhdGVMb2NhbFJlc3VsdHMgPSAoKSA9PiB7XG4gICAgY29uc3Qgc2NvcmVzID0gbGluZVNjb3JlcygpO1xuICAgIGNvbnN0IGF2Z1Njb3JlID0gc2NvcmVzLmxlbmd0aCA+IDAgXG4gICAgICA/IHNjb3Jlcy5yZWR1Y2UoKHN1bSwgcykgPT4gc3VtICsgcy5zY29yZSwgMCkgLyBzY29yZXMubGVuZ3RoXG4gICAgICA6IDA7XG4gICAgXG4gICAgY29uc3QgcmVzdWx0czogS2FyYW9rZVJlc3VsdHMgPSB7XG4gICAgICBzY29yZTogTWF0aC5yb3VuZChhdmdTY29yZSksXG4gICAgICBhY2N1cmFjeTogTWF0aC5yb3VuZChhdmdTY29yZSksXG4gICAgICB0b3RhbExpbmVzOiBzY29yZXMubGVuZ3RoLCAvLyBVc2UgYWN0dWFsIGNvbXBsZXRlZCBsaW5lcyBmb3IgdGVzdCBtb2RlXG4gICAgICBwZXJmZWN0TGluZXM6IHNjb3Jlcy5maWx0ZXIocyA9PiBzLnNjb3JlID49IDkwKS5sZW5ndGgsXG4gICAgICBnb29kTGluZXM6IHNjb3Jlcy5maWx0ZXIocyA9PiBzLnNjb3JlID49IDcwICYmIHMuc2NvcmUgPCA5MCkubGVuZ3RoLFxuICAgICAgbmVlZHNXb3JrTGluZXM6IHNjb3Jlcy5maWx0ZXIocyA9PiBzLnNjb3JlIDwgNzApLmxlbmd0aCxcbiAgICAgIHNlc3Npb25JZDogc2Vzc2lvbklkKCkgfHwgdW5kZWZpbmVkXG4gICAgfTtcbiAgICBcbiAgICBvcHRpb25zLm9uQ29tcGxldGU/LihyZXN1bHRzKTtcbiAgfTtcblxuICBjb25zdCBzdG9wU2Vzc2lvbiA9ICgpID0+IHtcbiAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgIHNldENvdW50ZG93bihudWxsKTtcbiAgICBzZXRJc1JlY29yZGluZyhmYWxzZSk7XG4gICAgc2V0Q3VycmVudENodW5rKG51bGwpO1xuICAgIHNldFJlY29yZGVkQ2h1bmtzKG5ldyBTZXQ8bnVtYmVyPigpKTtcbiAgICBcbiAgICBpZiAoYXVkaW9VcGRhdGVJbnRlcnZhbCkge1xuICAgICAgY2xlYXJJbnRlcnZhbChhdWRpb1VwZGF0ZUludGVydmFsKTtcbiAgICAgIGF1ZGlvVXBkYXRlSW50ZXJ2YWwgPSBudWxsO1xuICAgIH1cbiAgICBcbiAgICBpZiAocmVjb3JkaW5nVGltZW91dCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHJlY29yZGluZ1RpbWVvdXQpO1xuICAgICAgcmVjb3JkaW5nVGltZW91dCA9IG51bGw7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9FbGVtZW50KCkgfHwgb3B0aW9ucy5hdWRpb0VsZW1lbnQ7XG4gICAgaWYgKGF1ZGlvKSB7XG4gICAgICBhdWRpby5wYXVzZSgpO1xuICAgICAgYXVkaW8uY3VycmVudFRpbWUgPSAwO1xuICAgICAgYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZW5kZWQnLCBoYW5kbGVFbmQpO1xuICAgIH1cbiAgICBcbiAgICAvLyBDbGVhbnVwIGF1ZGlvIHByb2Nlc3NvclxuICAgIGF1ZGlvUHJvY2Vzc29yLmNsZWFudXAoKTtcbiAgfTtcblxuICBvbkNsZWFudXAoKCkgPT4ge1xuICAgIHN0b3BTZXNzaW9uKCk7XG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgLy8gU3RhdGVcbiAgICBpc1BsYXlpbmcsXG4gICAgY3VycmVudFRpbWUsXG4gICAgc2NvcmUsXG4gICAgY291bnRkb3duLFxuICAgIHNlc3Npb25JZCxcbiAgICBsaW5lU2NvcmVzLFxuICAgIGlzUmVjb3JkaW5nLFxuICAgIGN1cnJlbnRDaHVuayxcbiAgICBwbGF5YmFja1NwZWVkLFxuICAgIFxuICAgIC8vIEFjdGlvbnNcbiAgICBzdGFydFNlc3Npb24sXG4gICAgc3RvcFNlc3Npb24sXG4gICAgaGFuZGxlU3BlZWRDaGFuZ2UsXG4gICAgXG4gICAgLy8gQXVkaW8gcHJvY2Vzc29yIChmb3IgZGlyZWN0IGFjY2VzcyBpZiBuZWVkZWQpXG4gICAgYXVkaW9Qcm9jZXNzb3IsXG4gICAgXG4gICAgLy8gTWV0aG9kIHRvIHVwZGF0ZSBhdWRpbyBlbGVtZW50IGFmdGVyIGluaXRpYWxpemF0aW9uXG4gICAgc2V0QXVkaW9FbGVtZW50OiAoZWxlbWVudDogSFRNTEF1ZGlvRWxlbWVudCB8IHVuZGVmaW5lZCkgPT4ge1xuICAgICAgc2V0QXVkaW9FbGVtZW50KGVsZW1lbnQpO1xuICAgICAgLy8gQXBwbHkgY3VycmVudCBwbGF5YmFjayByYXRlIHRvIG5ldyBhdWRpbyBlbGVtZW50XG4gICAgICBpZiAoZWxlbWVudCkge1xuICAgICAgICBlbGVtZW50LnBsYXliYWNrUmF0ZSA9IGdldFBsYXliYWNrUmF0ZShwbGF5YmFja1NwZWVkKCkpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn0iLCJleHBvcnQgaW50ZXJmYWNlIFRyYWNrSW5mbyB7XG4gIHRyYWNrSWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgYXJ0aXN0OiBzdHJpbmc7XG4gIHBsYXRmb3JtOiAnc291bmRjbG91ZCc7XG4gIHVybDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgVHJhY2tEZXRlY3RvciB7XG4gIC8qKlxuICAgKiBEZXRlY3QgY3VycmVudCB0cmFjayBmcm9tIHRoZSBwYWdlIChTb3VuZENsb3VkIG9ubHkpXG4gICAqL1xuICBkZXRlY3RDdXJyZW50VHJhY2soKTogVHJhY2tJbmZvIHwgbnVsbCB7XG4gICAgY29uc3QgdXJsID0gd2luZG93LmxvY2F0aW9uLmhyZWY7XG4gICAgXG4gICAgLy8gT25seSB3b3JrIG9uIHNjLm1haWQuem9uZSAoU291bmRDbG91ZCBwcm94eSlcbiAgICBpZiAodXJsLmluY2x1ZGVzKCdzYy5tYWlkLnpvbmUnKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZGV0ZWN0U291bmRDbG91ZFRyYWNrKCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBudWxsO1xuICB9XG5cblxuICAvKipcbiAgICogRXh0cmFjdCB0cmFjayBpbmZvIGZyb20gU291bmRDbG91ZCAoc2MubWFpZC56b25lKVxuICAgKi9cbiAgcHJpdmF0ZSBkZXRlY3RTb3VuZENsb3VkVHJhY2soKTogVHJhY2tJbmZvIHwgbnVsbCB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIFNvdW5kQ2xvdWQgVVJMczogc2MubWFpZC56b25lL3VzZXIvdHJhY2stbmFtZVxuICAgICAgY29uc3QgcGF0aFBhcnRzID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLnNwbGl0KCcvJykuZmlsdGVyKEJvb2xlYW4pO1xuICAgICAgaWYgKHBhdGhQYXJ0cy5sZW5ndGggPCAyKSByZXR1cm4gbnVsbDtcblxuICAgICAgY29uc3QgYXJ0aXN0UGF0aCA9IHBhdGhQYXJ0c1swXTtcbiAgICAgIGNvbnN0IHRyYWNrU2x1ZyA9IHBhdGhQYXJ0c1sxXTtcbiAgICAgIFxuICAgICAgLy8gVHJ5IHRvIGdldCBhY3R1YWwgdGl0bGUgZnJvbSBwYWdlXG4gICAgICBsZXQgdGl0bGUgPSAnJztcbiAgICAgIFxuICAgICAgLy8gRm9yIHNvdW5kY2xvYWssIGxvb2sgZm9yIGgxIGFmdGVyIHRoZSBpbWFnZVxuICAgICAgY29uc3QgaDFFbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2gxJyk7XG4gICAgICBmb3IgKGNvbnN0IGgxIG9mIGgxRWxlbWVudHMpIHtcbiAgICAgICAgLy8gU2tpcCB0aGUgXCJzb3VuZGNsb2FrXCIgaGVhZGVyXG4gICAgICAgIGlmIChoMS50ZXh0Q29udGVudD8udG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnc291bmRjbG9haycpKSBjb250aW51ZTtcbiAgICAgICAgdGl0bGUgPSBoMS50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgICBpZiAodGl0bGUpIGJyZWFrO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBGYWxsYmFjayB0byBzbHVnXG4gICAgICBpZiAoIXRpdGxlKSB7XG4gICAgICAgIHRpdGxlID0gdHJhY2tTbHVnLnJlcGxhY2UoLy0vZywgJyAnKTtcbiAgICAgIH1cblxuICAgICAgLy8gVHJ5IHRvIGdldCBhY3R1YWwgYXJ0aXN0IG5hbWUgZnJvbSBwYWdlXG4gICAgICBsZXQgYXJ0aXN0ID0gJyc7XG4gICAgICBcbiAgICAgIC8vIExvb2sgZm9yIGFydGlzdCBsaW5rIHdpdGggbWV0YSBjbGFzc1xuICAgICAgY29uc3QgYXJ0aXN0TGluayA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2EubGlzdGluZyAubWV0YSBoMycpO1xuICAgICAgaWYgKGFydGlzdExpbmsgJiYgYXJ0aXN0TGluay50ZXh0Q29udGVudCkge1xuICAgICAgICBhcnRpc3QgPSBhcnRpc3RMaW5rLnRleHRDb250ZW50LnRyaW0oKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gRmFsbGJhY2s6IHRyeSBwYWdlIHRpdGxlXG4gICAgICBpZiAoIWFydGlzdCkge1xuICAgICAgICBjb25zdCBwYWdlVGl0bGUgPSBkb2N1bWVudC50aXRsZTtcbiAgICAgICAgLy8gVGl0bGUgZm9ybWF0OiBcIlNvbmcgYnkgQXJ0aXN0IH4gc291bmRjbG9ha1wiXG4gICAgICAgIGNvbnN0IG1hdGNoID0gcGFnZVRpdGxlLm1hdGNoKC9ieVxccysoLis/KVxccyp+Lyk7XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgIGFydGlzdCA9IG1hdGNoWzFdLnRyaW0oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBGaW5hbCBmYWxsYmFjayB0byBVUkxcbiAgICAgIGlmICghYXJ0aXN0KSB7XG4gICAgICAgIGFydGlzdCA9IGFydGlzdFBhdGgucmVwbGFjZSgvLS9nLCAnICcpLnJlcGxhY2UoL18vZywgJyAnKTtcbiAgICAgIH1cblxuICAgICAgY29uc29sZS5sb2coJ1tUcmFja0RldGVjdG9yXSBEZXRlY3RlZCB0cmFjazonLCB7IHRpdGxlLCBhcnRpc3QsIGFydGlzdFBhdGgsIHRyYWNrU2x1ZyB9KTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHJhY2tJZDogYCR7YXJ0aXN0UGF0aH0vJHt0cmFja1NsdWd9YCxcbiAgICAgICAgdGl0bGU6IHRpdGxlLFxuICAgICAgICBhcnRpc3Q6IGFydGlzdCxcbiAgICAgICAgcGxhdGZvcm06ICdzb3VuZGNsb3VkJyxcbiAgICAgICAgdXJsOiB3aW5kb3cubG9jYXRpb24uaHJlZixcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tUcmFja0RldGVjdG9yXSBFcnJvciBkZXRlY3RpbmcgU291bmRDbG91ZCB0cmFjazonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuXG4gIC8qKlxuICAgKiBXYXRjaCBmb3IgcGFnZSBjaGFuZ2VzIChTb3VuZENsb3VkIGlzIGEgU1BBKVxuICAgKi9cbiAgd2F0Y2hGb3JDaGFuZ2VzKGNhbGxiYWNrOiAodHJhY2s6IFRyYWNrSW5mbyB8IG51bGwpID0+IHZvaWQpOiAoKSA9PiB2b2lkIHtcbiAgICBsZXQgY3VycmVudFVybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICAgIGxldCBjdXJyZW50VHJhY2sgPSB0aGlzLmRldGVjdEN1cnJlbnRUcmFjaygpO1xuICAgIFxuICAgIC8vIEluaXRpYWwgZGV0ZWN0aW9uXG4gICAgY2FsbGJhY2soY3VycmVudFRyYWNrKTtcblxuICAgIC8vIFdhdGNoIGZvciBVUkwgY2hhbmdlc1xuICAgIGNvbnN0IGNoZWNrRm9yQ2hhbmdlcyA9ICgpID0+IHtcbiAgICAgIGNvbnN0IG5ld1VybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICAgICAgaWYgKG5ld1VybCAhPT0gY3VycmVudFVybCkge1xuICAgICAgICBjdXJyZW50VXJsID0gbmV3VXJsO1xuICAgICAgICBjb25zdCBuZXdUcmFjayA9IHRoaXMuZGV0ZWN0Q3VycmVudFRyYWNrKCk7XG4gICAgICAgIFxuICAgICAgICAvLyBPbmx5IHRyaWdnZXIgY2FsbGJhY2sgaWYgdHJhY2sgYWN0dWFsbHkgY2hhbmdlZFxuICAgICAgICBjb25zdCB0cmFja0NoYW5nZWQgPSAhY3VycmVudFRyYWNrIHx8ICFuZXdUcmFjayB8fCBcbiAgICAgICAgICBjdXJyZW50VHJhY2sudHJhY2tJZCAhPT0gbmV3VHJhY2sudHJhY2tJZDtcbiAgICAgICAgICBcbiAgICAgICAgaWYgKHRyYWNrQ2hhbmdlZCkge1xuICAgICAgICAgIGN1cnJlbnRUcmFjayA9IG5ld1RyYWNrO1xuICAgICAgICAgIGNhbGxiYWNrKG5ld1RyYWNrKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBQb2xsIGZvciBjaGFuZ2VzIChTUEFzIGRvbid0IGFsd2F5cyB0cmlnZ2VyIHByb3BlciBuYXZpZ2F0aW9uIGV2ZW50cylcbiAgICBjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKGNoZWNrRm9yQ2hhbmdlcywgMTAwMCk7XG5cbiAgICAvLyBBbHNvIGxpc3RlbiBmb3IgbmF2aWdhdGlvbiBldmVudHNcbiAgICBjb25zdCBoYW5kbGVOYXZpZ2F0aW9uID0gKCkgPT4ge1xuICAgICAgc2V0VGltZW91dChjaGVja0ZvckNoYW5nZXMsIDEwMCk7IC8vIFNtYWxsIGRlbGF5IGZvciBET00gdXBkYXRlc1xuICAgIH07XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCBoYW5kbGVOYXZpZ2F0aW9uKTtcbiAgICBcbiAgICAvLyBMaXN0ZW4gZm9yIHB1c2hzdGF0ZS9yZXBsYWNlc3RhdGUgKFNvdW5kQ2xvdWQgdXNlcyB0aGVzZSlcbiAgICBjb25zdCBvcmlnaW5hbFB1c2hTdGF0ZSA9IGhpc3RvcnkucHVzaFN0YXRlO1xuICAgIGNvbnN0IG9yaWdpbmFsUmVwbGFjZVN0YXRlID0gaGlzdG9yeS5yZXBsYWNlU3RhdGU7XG4gICAgXG4gICAgaGlzdG9yeS5wdXNoU3RhdGUgPSBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgICBvcmlnaW5hbFB1c2hTdGF0ZS5hcHBseShoaXN0b3J5LCBhcmdzKTtcbiAgICAgIGhhbmRsZU5hdmlnYXRpb24oKTtcbiAgICB9O1xuICAgIFxuICAgIGhpc3RvcnkucmVwbGFjZVN0YXRlID0gZnVuY3Rpb24oLi4uYXJncykge1xuICAgICAgb3JpZ2luYWxSZXBsYWNlU3RhdGUuYXBwbHkoaGlzdG9yeSwgYXJncyk7XG4gICAgICBoYW5kbGVOYXZpZ2F0aW9uKCk7XG4gICAgfTtcblxuICAgIC8vIFJldHVybiBjbGVhbnVwIGZ1bmN0aW9uXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgaGFuZGxlTmF2aWdhdGlvbik7XG4gICAgICBoaXN0b3J5LnB1c2hTdGF0ZSA9IG9yaWdpbmFsUHVzaFN0YXRlO1xuICAgICAgaGlzdG9yeS5yZXBsYWNlU3RhdGUgPSBvcmlnaW5hbFJlcGxhY2VTdGF0ZTtcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCB0cmFja0RldGVjdG9yID0gbmV3IFRyYWNrRGV0ZWN0b3IoKTsiLCIvLyBVc2luZyBicm93c2VyLnN0b3JhZ2UgQVBJIGRpcmVjdGx5IGZvciBzaW1wbGljaXR5XG5pbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xuXG4vLyBIZWxwZXIgdG8gZ2V0IGF1dGggdG9rZW5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRBdXRoVG9rZW4oKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5nZXQoJ2F1dGhUb2tlbicpO1xuICByZXR1cm4gcmVzdWx0LmF1dGhUb2tlbiB8fCBudWxsO1xufVxuXG4vLyBIZWxwZXIgdG8gc2V0IGF1dGggdG9rZW5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXRBdXRoVG9rZW4odG9rZW46IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuc2V0KHsgYXV0aFRva2VuOiB0b2tlbiB9KTtcbn1cblxuLy8gSGVscGVyIHRvIGdldCBpbnN0YWxsYXRpb24gc3RhdGVcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRJbnN0YWxsYXRpb25TdGF0ZSgpOiBQcm9taXNlPHtcbiAgY29tcGxldGVkOiBib29sZWFuO1xuICBqd3RWZXJpZmllZDogYm9vbGVhbjtcbiAgdGltZXN0YW1wPzogbnVtYmVyO1xufT4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuZ2V0KCdpbnN0YWxsYXRpb25TdGF0ZScpO1xuICByZXR1cm4gcmVzdWx0Lmluc3RhbGxhdGlvblN0YXRlIHx8IHtcbiAgICBjb21wbGV0ZWQ6IGZhbHNlLFxuICAgIGp3dFZlcmlmaWVkOiBmYWxzZSxcbiAgfTtcbn1cblxuLy8gSGVscGVyIHRvIHNldCBpbnN0YWxsYXRpb24gc3RhdGVcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXRJbnN0YWxsYXRpb25TdGF0ZShzdGF0ZToge1xuICBjb21wbGV0ZWQ6IGJvb2xlYW47XG4gIGp3dFZlcmlmaWVkOiBib29sZWFuO1xuICB0aW1lc3RhbXA/OiBudW1iZXI7XG59KTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5zZXQoeyBpbnN0YWxsYXRpb25TdGF0ZTogc3RhdGUgfSk7XG59XG5cbi8vIEhlbHBlciB0byBjaGVjayBpZiB1c2VyIGlzIGF1dGhlbnRpY2F0ZWRcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpc0F1dGhlbnRpY2F0ZWQoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGNvbnN0IHRva2VuID0gYXdhaXQgZ2V0QXV0aFRva2VuKCk7XG4gIHJldHVybiAhIXRva2VuICYmIHRva2VuLnN0YXJ0c1dpdGgoJ3NjYXJsZXR0XycpO1xufVxuXG4vLyBIZWxwZXIgdG8gY2xlYXIgYXV0aCBkYXRhXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2xlYXJBdXRoKCk6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwucmVtb3ZlKFsnYXV0aFRva2VuJywgJ2luc3RhbGxhdGlvblN0YXRlJ10pO1xufSIsImV4cG9ydCBpbnRlcmZhY2UgS2FyYW9rZURhdGEge1xuICBzdWNjZXNzOiBib29sZWFuO1xuICB0cmFja19pZD86IHN0cmluZztcbiAgdHJhY2tJZD86IHN0cmluZztcbiAgaGFzX2thcmFva2U/OiBib29sZWFuO1xuICBoYXNLYXJhb2tlPzogYm9vbGVhbjtcbiAgc29uZz86IHtcbiAgICBpZDogc3RyaW5nO1xuICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgYXJ0aXN0OiBzdHJpbmc7XG4gICAgYWxidW0/OiBzdHJpbmc7XG4gICAgYXJ0d29ya1VybD86IHN0cmluZztcbiAgICBkdXJhdGlvbj86IG51bWJlcjtcbiAgICBkaWZmaWN1bHR5OiAnYmVnaW5uZXInIHwgJ2ludGVybWVkaWF0ZScgfCAnYWR2YW5jZWQnO1xuICB9O1xuICBseXJpY3M/OiB7XG4gICAgc291cmNlOiBzdHJpbmc7XG4gICAgdHlwZTogJ3N5bmNlZCc7XG4gICAgbGluZXM6IEx5cmljTGluZVtdO1xuICAgIHRvdGFsTGluZXM6IG51bWJlcjtcbiAgfTtcbiAgbWVzc2FnZT86IHN0cmluZztcbiAgZXJyb3I/OiBzdHJpbmc7XG4gIGFwaV9jb25uZWN0ZWQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEx5cmljTGluZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRleHQ6IHN0cmluZztcbiAgc3RhcnRUaW1lOiBudW1iZXI7XG4gIGR1cmF0aW9uOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgS2FyYW9rZVNlc3Npb24ge1xuICBpZDogc3RyaW5nO1xuICB0cmFja0lkOiBzdHJpbmc7XG4gIHNvbmdUaXRsZTogc3RyaW5nO1xuICBzb25nQXJ0aXN0OiBzdHJpbmc7XG4gIHN0YXR1czogc3RyaW5nO1xuICBjcmVhdGVkQXQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEthcmFva2VBcGlTZXJ2aWNlIHtcbiAgcHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgLy8gVXNlIHRoZSBsb2NhbCBzZXJ2ZXIgZW5kcG9pbnRcbiAgICB0aGlzLmJhc2VVcmwgPSAnaHR0cDovL2xvY2FsaG9zdDo4Nzg3L2FwaSc7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGthcmFva2UgZGF0YSBmb3IgYSB0cmFjayBJRCAoWW91VHViZS9Tb3VuZENsb3VkKVxuICAgKi9cbiAgYXN5bmMgZ2V0S2FyYW9rZURhdGEoXG4gICAgdHJhY2tJZDogc3RyaW5nLCBcbiAgICB0aXRsZT86IHN0cmluZywgXG4gICAgYXJ0aXN0Pzogc3RyaW5nXG4gICk6IFByb21pc2U8S2FyYW9rZURhdGEgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoKTtcbiAgICAgIGlmICh0aXRsZSkgcGFyYW1zLnNldCgndGl0bGUnLCB0aXRsZSk7XG4gICAgICBpZiAoYXJ0aXN0KSBwYXJhbXMuc2V0KCdhcnRpc3QnLCBhcnRpc3QpO1xuICAgICAgXG4gICAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2thcmFva2UvJHtlbmNvZGVVUklDb21wb25lbnQodHJhY2tJZCl9JHtwYXJhbXMudG9TdHJpbmcoKSA/ICc/JyArIHBhcmFtcy50b1N0cmluZygpIDogJyd9YDtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXBpXSBGZXRjaGluZyBrYXJhb2tlIGRhdGE6JywgdXJsKTtcbiAgICAgIFxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgLy8gUmVtb3ZlIENvbnRlbnQtVHlwZSBoZWFkZXIgdG8gYXZvaWQgQ09SUyBwcmVmbGlnaHRcbiAgICAgICAgLy8gaGVhZGVyczoge1xuICAgICAgICAvLyAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIC8vIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGZldGNoIGthcmFva2UgZGF0YTonLCByZXNwb25zZS5zdGF0dXMpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUFwaV0gUmVjZWl2ZWQga2FyYW9rZSBkYXRhOicsIGRhdGEpO1xuICAgICAgXG4gICAgICAvLyBJZiB0aGVyZSdzIGFuIGVycm9yIGJ1dCB3ZSBnb3QgYSByZXNwb25zZSwgaXQgbWVhbnMgQVBJIGlzIGNvbm5lY3RlZFxuICAgICAgaWYgKGRhdGEuZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXBpXSBTZXJ2ZXIgZXJyb3IgKGJ1dCBBUEkgaXMgcmVhY2hhYmxlKTonLCBkYXRhLmVycm9yKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBoYXNfa2FyYW9rZTogZmFsc2UsXG4gICAgICAgICAgZXJyb3I6IGRhdGEuZXJyb3IsXG4gICAgICAgICAgdHJhY2tfaWQ6IHRyYWNrSWQsXG4gICAgICAgICAgYXBpX2Nvbm5lY3RlZDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEVycm9yIGZldGNoaW5nIGthcmFva2UgZGF0YTonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgYSBrYXJhb2tlIHNlc3Npb25cbiAgICovXG4gIGFzeW5jIHN0YXJ0U2Vzc2lvbihcbiAgICB0cmFja0lkOiBzdHJpbmcsXG4gICAgc29uZ0RhdGE6IHtcbiAgICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgICBhcnRpc3Q6IHN0cmluZztcbiAgICAgIGFsYnVtPzogc3RyaW5nO1xuICAgICAgZHVyYXRpb24/OiBudW1iZXI7XG4gICAgfVxuICApOiBQcm9taXNlPEthcmFva2VTZXNzaW9uIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuYmFzZVVybH0va2FyYW9rZS9zdGFydGAsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgIC8vIFRPRE86IEFkZCBhdXRoIHRva2VuIHdoZW4gYXZhaWxhYmxlXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICB0cmFja0lkLFxuICAgICAgICAgIHNvbmdEYXRhLFxuICAgICAgICB9KSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gc3RhcnQgc2Vzc2lvbjonLCByZXNwb25zZS5zdGF0dXMpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgcmV0dXJuIHJlc3VsdC5zZXNzaW9uO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRXJyb3Igc3RhcnRpbmcgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGVzdCBjb25uZWN0aW9uIHRvIHRoZSBBUElcbiAgICovXG4gIGFzeW5jIHRlc3RDb25uZWN0aW9uKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuYmFzZVVybC5yZXBsYWNlKCcvYXBpJywgJycpfS9oZWFsdGhgKTtcbiAgICAgIHJldHVybiByZXNwb25zZS5vaztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIENvbm5lY3Rpb24gdGVzdCBmYWlsZWQ6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY29uc3Qga2FyYW9rZUFwaSA9IG5ldyBLYXJhb2tlQXBpU2VydmljZSgpOyIsImltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IFByYWN0aWNlRXhlcmNpc2VWaWV3IH0gZnJvbSAnQHNjYXJsZXR0L3VpJztcblxuaW50ZXJmYWNlIFByYWN0aWNlVmlld1Byb3BzIHtcbiAgc2Vzc2lvbklkPzogc3RyaW5nO1xuICBvbkJhY2s6ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBQcmFjdGljZVZpZXc6IENvbXBvbmVudDxQcmFjdGljZVZpZXdQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8UHJhY3RpY2VFeGVyY2lzZVZpZXcgXG4gICAgICBzZXNzaW9uSWQ9e3Byb3BzLnNlc3Npb25JZH1cbiAgICAgIG9uQmFjaz17cHJvcHMub25CYWNrfVxuICAgICAgLy8gRXh0ZW5zaW9uIGRvZXNuJ3QgdXNlIGF1dGggeWV0XG4gICAgICAvLyBhcGlCYXNlVXJsIGlzIGRlZmF1bHQgbG9jYWxob3N0Ojg3ODdcbiAgICAvPlxuICApO1xufTsiLCJpbXBvcnQgeyBDb21wb25lbnQsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlRWZmZWN0LCBvbk1vdW50LCBvbkNsZWFudXAsIFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25LYXJhb2tlVmlldywgTWluaW1pemVkS2FyYW9rZSwgQ291bnRkb3duLCBDb21wbGV0aW9uVmlldywgdXNlS2FyYW9rZVNlc3Npb24sIEV4dGVuc2lvbkF1ZGlvU2VydmljZSwgSTE4blByb3ZpZGVyLCB0eXBlIFBsYXliYWNrU3BlZWQgfSBmcm9tICdAc2NhcmxldHQvdWknO1xuaW1wb3J0IHsgdHJhY2tEZXRlY3RvciwgdHlwZSBUcmFja0luZm8gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy90cmFjay1kZXRlY3Rvcic7XG5pbXBvcnQgeyBnZXRBdXRoVG9rZW4gfSBmcm9tICcuLi8uLi91dGlscy9zdG9yYWdlJztcbmltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG5pbXBvcnQgeyBrYXJhb2tlQXBpIH0gZnJvbSAnLi4vLi4vc2VydmljZXMva2FyYW9rZS1hcGknO1xuaW1wb3J0IHsgUHJhY3RpY2VWaWV3IH0gZnJvbSAnLi9QcmFjdGljZVZpZXcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbnRlbnRBcHBQcm9wcyB7fVxuXG5leHBvcnQgY29uc3QgQ29udGVudEFwcDogQ29tcG9uZW50PENvbnRlbnRBcHBQcm9wcz4gPSAoKSA9PiB7XG4gIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUmVuZGVyaW5nIENvbnRlbnRBcHAgY29tcG9uZW50Jyk7XG4gIFxuICAvLyBTdGF0ZVxuICBjb25zdCBbY3VycmVudFRyYWNrLCBzZXRDdXJyZW50VHJhY2tdID0gY3JlYXRlU2lnbmFsPFRyYWNrSW5mbyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbYXV0aFRva2VuLCBzZXRBdXRoVG9rZW5dID0gY3JlYXRlU2lnbmFsPHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbc2hvd0thcmFva2UsIHNldFNob3dLYXJhb2tlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtrYXJhb2tlRGF0YSwgc2V0S2FyYW9rZURhdGFdID0gY3JlYXRlU2lnbmFsPGFueT4obnVsbCk7XG4gIGNvbnN0IFtsb2FkaW5nLCBzZXRMb2FkaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtzZXNzaW9uU3RhcnRlZCwgc2V0U2Vzc2lvblN0YXJ0ZWRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2lzTWluaW1pemVkLCBzZXRJc01pbmltaXplZF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbY291bnRkb3duLCBzZXRDb3VudGRvd25dID0gY3JlYXRlU2lnbmFsPG51bWJlciB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbaXNQbGF5aW5nLCBzZXRJc1BsYXlpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2N1cnJlbnRUaW1lLCBzZXRDdXJyZW50VGltZV0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFthdWRpb1JlZiwgc2V0QXVkaW9SZWZdID0gY3JlYXRlU2lnbmFsPEhUTUxBdWRpb0VsZW1lbnQgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2thcmFva2VTZXNzaW9uLCBzZXRLYXJhb2tlU2Vzc2lvbl0gPSBjcmVhdGVTaWduYWw8UmV0dXJuVHlwZTx0eXBlb2YgdXNlS2FyYW9rZVNlc3Npb24+IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtjb21wbGV0aW9uRGF0YSwgc2V0Q29tcGxldGlvbkRhdGFdID0gY3JlYXRlU2lnbmFsPGFueT4obnVsbCk7XG4gIGNvbnN0IFtzaG93UHJhY3RpY2UsIHNldFNob3dQcmFjdGljZV0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbc2VsZWN0ZWRTcGVlZCwgc2V0U2VsZWN0ZWRTcGVlZF0gPSBjcmVhdGVTaWduYWw8UGxheWJhY2tTcGVlZD4oJzF4Jyk7XG4gIFxuICAvLyBMb2FkIGF1dGggdG9rZW4gb24gbW91bnRcbiAgb25Nb3VudChhc3luYyAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBMb2FkaW5nIGF1dGggdG9rZW4nKTtcbiAgICBjb25zdCB0b2tlbiA9IGF3YWl0IGdldEF1dGhUb2tlbigpO1xuICAgIGlmICh0b2tlbikge1xuICAgICAgc2V0QXV0aFRva2VuKHRva2VuKTtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXV0aCB0b2tlbiBsb2FkZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVXNlIGRlbW8gdG9rZW4gZm9yIGRldmVsb3BtZW50XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE5vIGF1dGggdG9rZW4gZm91bmQsIHVzaW5nIGRlbW8gdG9rZW4nKTtcbiAgICAgIHNldEF1dGhUb2tlbignc2NhcmxldHRfZGVtb190b2tlbl8xMjMnKTtcbiAgICB9XG4gICAgXG4gICAgLy8gU3RhcnQgd2F0Y2hpbmcgZm9yIHRyYWNrIGNoYW5nZXNcbiAgICBjb25zdCBjbGVhbnVwID0gdHJhY2tEZXRlY3Rvci53YXRjaEZvckNoYW5nZXMoKHRyYWNrKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFRyYWNrIGNoYW5nZWQ6JywgdHJhY2spO1xuICAgICAgc2V0Q3VycmVudFRyYWNrKHRyYWNrKTtcbiAgICAgIC8vIFNob3cga2FyYW9rZSB3aGVuIHRyYWNrIGlzIGRldGVjdGVkIGFuZCBmZXRjaCBkYXRhXG4gICAgICBpZiAodHJhY2spIHtcbiAgICAgICAgc2V0U2hvd0thcmFva2UodHJ1ZSk7XG4gICAgICAgIGZldGNoS2FyYW9rZURhdGEodHJhY2spO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgb25DbGVhbnVwKGNsZWFudXApO1xuICB9KTtcblxuICBjb25zdCBmZXRjaEthcmFva2VEYXRhID0gYXN5bmMgKHRyYWNrOiBUcmFja0luZm8pID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZldGNoaW5nIGthcmFva2UgZGF0YSBmb3IgdHJhY2s6JywgdHJhY2spO1xuICAgIHNldExvYWRpbmcodHJ1ZSk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBrYXJhb2tlQXBpLmdldEthcmFva2VEYXRhKFxuICAgICAgICB0cmFjay50cmFja0lkLFxuICAgICAgICB0cmFjay50aXRsZSxcbiAgICAgICAgdHJhY2suYXJ0aXN0XG4gICAgICApO1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBLYXJhb2tlIGRhdGEgbG9hZGVkOicsIGRhdGEpO1xuICAgICAgc2V0S2FyYW9rZURhdGEoZGF0YSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tDb250ZW50QXBwXSBGYWlsZWQgdG8gZmV0Y2gga2FyYW9rZSBkYXRhOicsIGVycm9yKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0TG9hZGluZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVN0YXJ0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU3RhcnQga2FyYW9rZSBzZXNzaW9uJyk7XG4gICAgc2V0U2Vzc2lvblN0YXJ0ZWQodHJ1ZSk7XG4gICAgXG4gICAgY29uc3QgZGF0YSA9IGthcmFva2VEYXRhKCk7XG4gICAgY29uc3QgYXVkaW8gPSBhdWRpb1JlZigpO1xuICAgIGNvbnN0IHRyYWNrID0gY3VycmVudFRyYWNrKCk7XG4gICAgXG4gICAgaWYgKGRhdGEgJiYgdHJhY2sgJiYgZGF0YS5seXJpY3M/LmxpbmVzKSB7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIENyZWF0aW5nIGthcmFva2Ugc2Vzc2lvbiB3aXRoIGF1ZGlvIGNhcHR1cmUnLCB7XG4gICAgICAgIHRyYWNrSWQ6IHRyYWNrLmlkLFxuICAgICAgICB0cmFja1RpdGxlOiB0cmFjay50aXRsZSxcbiAgICAgICAgc29uZ0RhdGE6IGRhdGEuc29uZyxcbiAgICAgICAgaGFzTHlyaWNzOiAhIWRhdGEubHlyaWNzPy5saW5lc1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIENyZWF0ZSBhbmQgc3RhcnQgc2Vzc2lvblxuICAgICAgY29uc3QgbmV3U2Vzc2lvbiA9IHVzZUthcmFva2VTZXNzaW9uKHtcbiAgICAgICAgbHlyaWNzOiBkYXRhLmx5cmljcy5saW5lcyxcbiAgICAgICAgdHJhY2tJZDogdHJhY2sudHJhY2tJZCxcbiAgICAgICAgc29uZ0RhdGE6IGRhdGEuc29uZyA/IHtcbiAgICAgICAgICB0aXRsZTogZGF0YS5zb25nLnRpdGxlLFxuICAgICAgICAgIGFydGlzdDogZGF0YS5zb25nLmFydGlzdCxcbiAgICAgICAgICBhbGJ1bTogZGF0YS5zb25nLmFsYnVtLFxuICAgICAgICAgIGR1cmF0aW9uOiBkYXRhLnNvbmcuZHVyYXRpb25cbiAgICAgICAgfSA6IHtcbiAgICAgICAgICB0aXRsZTogdHJhY2sudGl0bGUsXG4gICAgICAgICAgYXJ0aXN0OiB0cmFjay5hcnRpc3RcbiAgICAgICAgfSxcbiAgICAgICAgc29uZ0NhdGFsb2dJZDogZGF0YS5zb25nX2NhdGFsb2dfaWQsXG4gICAgICAgIGF1ZGlvRWxlbWVudDogdW5kZWZpbmVkLCAvLyBXaWxsIGJlIHNldCB3aGVuIGF1ZGlvIHN0YXJ0cyBwbGF5aW5nXG4gICAgICAgIGFwaVVybDogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODc4Ny9hcGknLFxuICAgICAgICBvbkNvbXBsZXRlOiAocmVzdWx0cykgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gS2FyYW9rZSBzZXNzaW9uIGNvbXBsZXRlZDonLCByZXN1bHRzKTtcbiAgICAgICAgICBzZXRTZXNzaW9uU3RhcnRlZChmYWxzZSk7XG4gICAgICAgICAgc2V0SXNQbGF5aW5nKGZhbHNlKTtcbiAgICAgICAgICBzZXRDb21wbGV0aW9uRGF0YShyZXN1bHRzKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBTdG9wIGF1ZGlvIHBsYXliYWNrXG4gICAgICAgICAgY29uc3QgYXVkaW8gPSBhdWRpb1JlZigpO1xuICAgICAgICAgIGlmIChhdWRpbykge1xuICAgICAgICAgICAgYXVkaW8ucGF1c2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyBBcHBseSB0aGUgc2VsZWN0ZWQgc3BlZWQgdG8gdGhlIG5ldyBzZXNzaW9uXG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEFwcGx5aW5nIHNlbGVjdGVkIHNwZWVkIHRvIG5ldyBzZXNzaW9uOicsIHNlbGVjdGVkU3BlZWQoKSk7XG4gICAgICBuZXdTZXNzaW9uLmhhbmRsZVNwZWVkQ2hhbmdlKHNlbGVjdGVkU3BlZWQoKSk7XG4gICAgICBcbiAgICAgIHNldEthcmFva2VTZXNzaW9uKG5ld1Nlc3Npb24pO1xuICAgICAgXG4gICAgICAvLyBTdGFydCB0aGUgc2Vzc2lvbiAoaW5jbHVkZXMgY291bnRkb3duIGFuZCBhdWRpbyBpbml0aWFsaXphdGlvbilcbiAgICAgIGF3YWl0IG5ld1Nlc3Npb24uc3RhcnRTZXNzaW9uKCk7XG4gICAgICBcbiAgICAgIC8vIFdhdGNoIGZvciBjb3VudGRvd24gdG8gZmluaXNoIGFuZCBzdGFydCBhdWRpb1xuICAgICAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKG5ld1Nlc3Npb24uY291bnRkb3duKCkgPT09IG51bGwgJiYgbmV3U2Vzc2lvbi5pc1BsYXlpbmcoKSAmJiAhaXNQbGF5aW5nKCkpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIENvdW50ZG93biBmaW5pc2hlZCwgc3RhcnRpbmcgYXVkaW8gcGxheWJhY2snKTtcbiAgICAgICAgICBzdGFydEF1ZGlvUGxheWJhY2soKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gVXBkYXRlIHNlc3Npb24gd2l0aCBhdWRpbyBlbGVtZW50IHdoZW4gYXZhaWxhYmxlXG4gICAgICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9SZWYoKTtcbiAgICAgICAgaWYgKGF1ZGlvICYmIG5ld1Nlc3Npb24pIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFNldHRpbmcgYXVkaW8gZWxlbWVudCBvbiBuZXcgc2Vzc2lvbicpO1xuICAgICAgICAgIG5ld1Nlc3Npb24uc2V0QXVkaW9FbGVtZW50KGF1ZGlvKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRmFsbGJhY2sgdG8gc2ltcGxlIGNvdW50ZG93bicpO1xuICAgICAgLy8gRmFsbGJhY2sgdG8gb2xkIGJlaGF2aW9yXG4gICAgICBzZXRDb3VudGRvd24oMyk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNvdW50ZG93bkludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gY291bnRkb3duKCk7XG4gICAgICAgIGlmIChjdXJyZW50ICE9PSBudWxsICYmIGN1cnJlbnQgPiAxKSB7XG4gICAgICAgICAgc2V0Q291bnRkb3duKGN1cnJlbnQgLSAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjbGVhckludGVydmFsKGNvdW50ZG93bkludGVydmFsKTtcbiAgICAgICAgICBzZXRDb3VudGRvd24obnVsbCk7XG4gICAgICAgICAgc3RhcnRBdWRpb1BsYXliYWNrKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIDEwMDApO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBzdGFydEF1ZGlvUGxheWJhY2sgPSAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTdGFydGluZyBhdWRpbyBwbGF5YmFjaycpO1xuICAgIHNldElzUGxheWluZyh0cnVlKTtcbiAgICBcbiAgICAvLyBUcnkgbXVsdGlwbGUgbWV0aG9kcyB0byBmaW5kIGFuZCBwbGF5IGF1ZGlvXG4gICAgLy8gTWV0aG9kIDE6IExvb2sgZm9yIGF1ZGlvIGVsZW1lbnRzXG4gICAgY29uc3QgYXVkaW9FbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2F1ZGlvJyk7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGb3VuZCBhdWRpbyBlbGVtZW50czonLCBhdWRpb0VsZW1lbnRzLmxlbmd0aCk7XG4gICAgXG4gICAgaWYgKGF1ZGlvRWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgYXVkaW8gPSBhdWRpb0VsZW1lbnRzWzBdIGFzIEhUTUxBdWRpb0VsZW1lbnQ7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEF1ZGlvIGVsZW1lbnQ6Jywge1xuICAgICAgICBzcmM6IGF1ZGlvLnNyYyxcbiAgICAgICAgcGF1c2VkOiBhdWRpby5wYXVzZWQsXG4gICAgICAgIGR1cmF0aW9uOiBhdWRpby5kdXJhdGlvbixcbiAgICAgICAgY3VycmVudFRpbWU6IGF1ZGlvLmN1cnJlbnRUaW1lXG4gICAgICB9KTtcbiAgICAgIHNldEF1ZGlvUmVmKGF1ZGlvKTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIGthcmFva2Ugc2Vzc2lvbiB3aXRoIGF1ZGlvIGVsZW1lbnQgaWYgaXQgZXhpc3RzXG4gICAgICBjb25zdCBzZXNzaW9uID0ga2FyYW9rZVNlc3Npb24oKTtcbiAgICAgIGlmIChzZXNzaW9uKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU2V0dGluZyBhdWRpbyBlbGVtZW50IG9uIGthcmFva2Ugc2Vzc2lvbicpO1xuICAgICAgICBzZXNzaW9uLnNldEF1ZGlvRWxlbWVudChhdWRpbyk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlc3Npb24uYXVkaW9Qcm9jZXNzb3IuaXNSZWFkeSgpKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBJbml0aWFsaXppbmcgYXVkaW8gcHJvY2Vzc29yIGZvciBzZXNzaW9uJyk7XG4gICAgICAgICAgc2Vzc2lvbi5hdWRpb1Byb2Nlc3Nvci5pbml0aWFsaXplKCkuY2F0Y2goY29uc29sZS5lcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gVHJ5IHRvIHBsYXkgdGhlIGF1ZGlvXG4gICAgICBhdWRpby5wbGF5KCkudGhlbigoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXVkaW8gc3RhcnRlZCBwbGF5aW5nIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgfSkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0NvbnRlbnRBcHBdIEZhaWxlZCB0byBwbGF5IGF1ZGlvOicsIGVycik7XG4gICAgICAgIFxuICAgICAgICAvLyBNZXRob2QgMjogVHJ5IGNsaWNraW5nIHRoZSBwbGF5IGJ1dHRvbiBvbiB0aGUgcGFnZVxuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEF0dGVtcHRpbmcgdG8gY2xpY2sgcGxheSBidXR0b24uLi4nKTtcbiAgICAgICAgY29uc3QgcGxheUJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvblt0aXRsZSo9XCJQbGF5XCJdLCBidXR0b25bYXJpYS1sYWJlbCo9XCJQbGF5XCJdLCAucGxheUNvbnRyb2wsIC5wbGF5QnV0dG9uLCBbY2xhc3MqPVwicGxheS1idXR0b25cIl0nKTtcbiAgICAgICAgaWYgKHBsYXlCdXR0b24pIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZvdW5kIHBsYXkgYnV0dG9uLCBjbGlja2luZyBpdCcpO1xuICAgICAgICAgIChwbGF5QnV0dG9uIGFzIEhUTUxFbGVtZW50KS5jbGljaygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIGN1cnJlbnQgdGltZVxuICAgICAgY29uc3QgdXBkYXRlVGltZSA9ICgpID0+IHtcbiAgICAgICAgc2V0Q3VycmVudFRpbWUoYXVkaW8uY3VycmVudFRpbWUpO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIHVwZGF0ZVRpbWUpO1xuICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCAoKSA9PiB7XG4gICAgICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgICAgIGF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB1cGRhdGVUaW1lKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBNZXRob2QgMzogVHJ5IFNvdW5kQ2xvdWQgc3BlY2lmaWMgc2VsZWN0b3JzXG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE5vIGF1ZGlvIGVsZW1lbnRzIGZvdW5kLCB0cnlpbmcgU291bmRDbG91ZC1zcGVjaWZpYyBhcHByb2FjaCcpO1xuICAgICAgY29uc3QgcGxheUJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5wbGF5Q29udHJvbCwgLnNjLWJ1dHRvbi1wbGF5LCBidXR0b25bdGl0bGUqPVwiUGxheVwiXScpO1xuICAgICAgaWYgKHBsYXlCdXR0b24pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGb3VuZCBTb3VuZENsb3VkIHBsYXkgYnV0dG9uLCBjbGlja2luZyBpdCcpO1xuICAgICAgICAocGxheUJ1dHRvbiBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFdhaXQgYSBiaXQgYW5kIHRoZW4gbG9vayBmb3IgYXVkaW8gZWxlbWVudCBhZ2FpblxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICBjb25zdCBuZXdBdWRpb0VsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnYXVkaW8nKTtcbiAgICAgICAgICBpZiAobmV3QXVkaW9FbGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZvdW5kIGF1ZGlvIGVsZW1lbnQgYWZ0ZXIgY2xpY2tpbmcgcGxheScpO1xuICAgICAgICAgICAgY29uc3QgYXVkaW8gPSBuZXdBdWRpb0VsZW1lbnRzWzBdIGFzIEhUTUxBdWRpb0VsZW1lbnQ7XG4gICAgICAgICAgICBzZXRBdWRpb1JlZihhdWRpbyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFVwZGF0ZSBjdXJyZW50IHRpbWVcbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZVRpbWUgPSAoKSA9PiB7XG4gICAgICAgICAgICAgIHNldEN1cnJlbnRUaW1lKGF1ZGlvLmN1cnJlbnRUaW1lKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB1cGRhdGVUaW1lKTtcbiAgICAgICAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgKCkgPT4ge1xuICAgICAgICAgICAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgICAgICAgICAgICBhdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdXBkYXRlVGltZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIDUwMCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUNsb3NlID0gKCkgPT4ge1xuICAgIC8vIFN0b3Agc2Vzc2lvbiBpZiBhY3RpdmVcbiAgICBjb25zdCBzZXNzaW9uID0ga2FyYW9rZVNlc3Npb24oKTtcbiAgICBpZiAoc2Vzc2lvbikge1xuICAgICAgc2Vzc2lvbi5zdG9wU2Vzc2lvbigpO1xuICAgIH1cbiAgICBcbiAgICBzZXRTaG93S2FyYW9rZShmYWxzZSk7XG4gICAgc2V0S2FyYW9rZURhdGEobnVsbCk7XG4gICAgc2V0U2Vzc2lvblN0YXJ0ZWQoZmFsc2UpO1xuICAgIHNldEthcmFva2VTZXNzaW9uKG51bGwpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZU1pbmltaXplID0gKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTWluaW1pemUga2FyYW9rZSB3aWRnZXQnKTtcbiAgICBzZXRJc01pbmltaXplZCh0cnVlKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVSZXN0b3JlID0gKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUmVzdG9yZSBrYXJhb2tlIHdpZGdldCcpO1xuICAgIHNldElzTWluaW1pemVkKGZhbHNlKTtcbiAgfTtcblxuICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlbmRlciBzdGF0ZTonLCB7XG4gICAgc2hvd0thcmFva2U6IHNob3dLYXJhb2tlKCksXG4gICAgY3VycmVudFRyYWNrOiBjdXJyZW50VHJhY2soKSxcbiAgICBrYXJhb2tlRGF0YToga2FyYW9rZURhdGEoKSxcbiAgICBsb2FkaW5nOiBsb2FkaW5nKClcbiAgfSk7XG5cblxuICByZXR1cm4gKFxuICAgIDw+XG4gICAgICB7LyogTWluaW1pemVkIHN0YXRlICovfVxuICAgICAgPFNob3cgd2hlbj17c2hvd0thcmFva2UoKSAmJiBjdXJyZW50VHJhY2soKSAmJiBpc01pbmltaXplZCgpfT5cbiAgICAgICAgPE1pbmltaXplZEthcmFva2Ugb25DbGljaz17aGFuZGxlUmVzdG9yZX0gLz5cbiAgICAgIDwvU2hvdz5cblxuICAgICAgey8qIEZ1bGwgd2lkZ2V0IHN0YXRlICovfVxuICAgICAgPFNob3cgd2hlbj17c2hvd0thcmFva2UoKSAmJiBjdXJyZW50VHJhY2soKSAmJiAhaXNNaW5pbWl6ZWQoKX0gZmFsbGJhY2s9e1xuICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdub25lJyB9fT5cbiAgICAgICAgICB7Y29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBOb3Qgc2hvd2luZyAtIHNob3dLYXJhb2tlOicsIHNob3dLYXJhb2tlKCksICdjdXJyZW50VHJhY2s6JywgY3VycmVudFRyYWNrKCkpfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIH0+XG4gICAgICAgIDxkaXYgc3R5bGU9e3tcbiAgICAgICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgICAgICB0b3A6ICcyMHB4JyxcbiAgICAgICAgICByaWdodDogJzIwcHgnLFxuICAgICAgICAgIGJvdHRvbTogJzIwcHgnLFxuICAgICAgICAgIHdpZHRoOiAnNDgwcHgnLFxuICAgICAgICAgICd6LWluZGV4JzogJzk5OTk5JyxcbiAgICAgICAgICBvdmVyZmxvdzogJ2hpZGRlbicsXG4gICAgICAgICAgJ2JvcmRlci1yYWRpdXMnOiAnMTZweCcsXG4gICAgICAgICAgJ2JveC1zaGFkb3cnOiAnMCAyNXB4IDUwcHggLTEycHggcmdiYSgwLCAwLCAwLCAwLjYpJyxcbiAgICAgICAgICBkaXNwbGF5OiAnZmxleCcsXG4gICAgICAgICAgJ2ZsZXgtZGlyZWN0aW9uJzogJ2NvbHVtbidcbiAgICAgICAgfX0+XG4gICAgICAgICAge2NvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUmVuZGVyaW5nIHdpdGggY29tcGxldGlvbiBkYXRhOicsIGNvbXBsZXRpb25EYXRhKCkpfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJoLWZ1bGwgYmctc3VyZmFjZSByb3VuZGVkLTJ4bCBvdmVyZmxvdy1oaWRkZW4gZmxleCBmbGV4LWNvbFwiPlxuICAgICAgICAgICAgey8qIEhlYWRlciB3aXRoIG1pbmltaXplIGFuZCBjbG9zZSBidXR0b25zICovfVxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktZW5kIHAtMiBiZy1zdXJmYWNlIGJvcmRlci1iIGJvcmRlci1zdWJ0bGVcIiBzdHlsZT17eyBoZWlnaHQ6ICc0OHB4JyB9fT5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17c2hvd1ByYWN0aWNlKCl9PlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93UHJhY3RpY2UoZmFsc2UpfVxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctMTAgaC0xMCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzIGhvdmVyOmJnLXdoaXRlLzEwXCJcbiAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgY29sb3I6ICcjYThhOGE4JyB9fVxuICAgICAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiQ2xvc2UgUHJhY3RpY2VcIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICA8c3ZnIHdpZHRoPVwiMjBcIiBoZWlnaHQ9XCIyMFwiIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPVwiTTE1IDVMNSAxNU01IDVMMTUgMTVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIvPlxuICAgICAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVNaW5pbWl6ZX1cbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy0xMCBoLTEwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbGcgdHJhbnNpdGlvbi1jb2xvcnMgaG92ZXI6Ymctd2hpdGUvMTBcIlxuICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgY29sb3I6ICcjYThhOGE4JyB9fVxuICAgICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIk1pbmltaXplXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8c3ZnIHdpZHRoPVwiMjRcIiBoZWlnaHQ9XCIyNFwiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj5cbiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD1cIk02IDEyaDEyXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiM1wiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIi8+XG4gICAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgey8qIE1haW4gY29udGVudCBhcmVhICovfVxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBtaW4taC0wIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtjb21wbGV0aW9uRGF0YSgpfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17IWxvYWRpbmcoKX0gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGgtZnVsbCBiZy1iYXNlXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhbmltYXRlLXNwaW4gcm91bmRlZC1mdWxsIGgtMTIgdy0xMiBib3JkZXItYi0yIGJvcmRlci1hY2NlbnQtcHJpbWFyeSBteC1hdXRvIG1iLTRcIj48L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc2Vjb25kYXJ5XCI+TG9hZGluZyBseXJpY3MuLi48L3A+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e2thcmFva2VEYXRhKCk/Lmx5cmljcz8ubGluZXN9IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGgtZnVsbCBwLThcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0yXCI+Tm8gbHlyaWNzIGF2YWlsYWJsZTwvcD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zbSB0ZXh0LXRlcnRpYXJ5XCI+VHJ5IGEgZGlmZmVyZW50IHNvbmc8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImgtZnVsbCBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBtaW4taC0wIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPEV4dGVuc2lvbkthcmFva2VWaWV3XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3JlPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuc2NvcmUoKSA6IDB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJhbms9ezF9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGx5cmljcz17a2FyYW9rZURhdGEoKT8ubHlyaWNzPy5saW5lcyB8fCBbXX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudFRpbWU9e2thcmFva2VTZXNzaW9uKCkgPyBrYXJhb2tlU2Vzc2lvbigpIS5jdXJyZW50VGltZSgpIDogY3VycmVudFRpbWUoKSAqIDEwMDB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxlYWRlcmJvYXJkPXtbXX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgaXNQbGF5aW5nPXtrYXJhb2tlU2Vzc2lvbigpID8gKGthcmFva2VTZXNzaW9uKCkhLmlzUGxheWluZygpIHx8IGthcmFva2VTZXNzaW9uKCkhLmNvdW50ZG93bigpICE9PSBudWxsKSA6IChpc1BsYXlpbmcoKSB8fCBjb3VudGRvd24oKSAhPT0gbnVsbCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uU3RhcnQ9e2hhbmRsZVN0YXJ0fVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvblNwZWVkQ2hhbmdlPXsoc3BlZWQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFNwZWVkIGNoYW5nZWQ6Jywgc3BlZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFNlbGVjdGVkU3BlZWQoc3BlZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb24gPSBrYXJhb2tlU2Vzc2lvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZXNzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEFwcGx5aW5nIHNwZWVkIGNoYW5nZSB0byBzZXNzaW9uJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXNzaW9uLmhhbmRsZVNwZWVkQ2hhbmdlKHNwZWVkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBObyBzZXNzaW9uIHlldCwgc3BlZWQgd2lsbCBiZSBhcHBsaWVkIHdoZW4gc2Vzc2lvbiBzdGFydHMnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQWxzbyBhcHBseSB0byBhdWRpbyBlbGVtZW50IGRpcmVjdGx5IGlmIGl0IGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9SZWYoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXVkaW8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJhdGUgPSBzcGVlZCA9PT0gJzAuNXgnID8gMC41IDogc3BlZWQgPT09ICcwLjc1eCcgPyAwLjc1IDogMS4wO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTZXR0aW5nIGF1ZGlvIHBsYXliYWNrIHJhdGUgZGlyZWN0bHkgdG86JywgcmF0ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdWRpby5wbGF5YmFja1JhdGUgPSByYXRlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgaXNSZWNvcmRpbmc9e2thcmFva2VTZXNzaW9uKCkgPyBrYXJhb2tlU2Vzc2lvbigpIS5pc1JlY29yZGluZygpIDogZmFsc2V9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVTY29yZXM9e2thcmFva2VTZXNzaW9uKCkgPyBrYXJhb2tlU2Vzc2lvbigpIS5saW5lU2NvcmVzKCkgOiBbXX1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgey8qIENvdW50ZG93biBvdmVybGF5ICovfVxuICAgICAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e2thcmFva2VTZXNzaW9uKCkgPyBrYXJhb2tlU2Vzc2lvbigpIS5jb3VudGRvd24oKSAhPT0gbnVsbCA6IGNvdW50ZG93bigpICE9PSBudWxsfT5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhYnNvbHV0ZSBpbnNldC0wIGJnLWJsYWNrLzgwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHotNTBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtOHhsIGZvbnQtYm9sZCB0ZXh0LXdoaXRlIGFuaW1hdGUtcHVsc2VcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuY291bnRkb3duKCkgOiBjb3VudGRvd24oKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQteGwgdGV4dC13aGl0ZS84MCBtdC00XCI+R2V0IHJlYWR5ITwvcD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICB7LyogQ29tcGxldGlvbiBWaWV3IG9yIFByYWN0aWNlIFZpZXcgKi99XG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17c2hvd1ByYWN0aWNlKCl9IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICAgIDxJMThuUHJvdmlkZXI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoLWZ1bGwgZmxleCBmbGV4LWNvbFwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49eyFjb21wbGV0aW9uRGF0YSgpLmlzTG9hZGluZ30gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGgtZnVsbCBiZy1iYXNlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhbmltYXRlLXNwaW4gcm91bmRlZC1mdWxsIGgtMTYgdy0xNiBib3JkZXItYi0yIGJvcmRlci1hY2NlbnQtcHJpbWFyeSBteC1hdXRvIG1iLTRcIj48L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1zZWNvbmRhcnlcIj5DYWxjdWxhdGluZyB5b3VyIGZpbmFsIHNjb3JlLi4uPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zbSB0ZXh0LXRlcnRpYXJ5IG10LTJcIj5BbmFseXppbmcgZnVsbCBwZXJmb3JtYW5jZTwvcD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICB9PlxuICAgICAgICAgICAgICAgICAgICAgICAgPENvbXBsZXRpb25WaWV3XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiaC1mdWxsXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcmU9e2NvbXBsZXRpb25EYXRhKCkuc2NvcmV9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJhbms9ezF9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNwZWVkPXtzZWxlY3RlZFNwZWVkKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGZlZWRiYWNrVGV4dD17XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGlvbkRhdGEoKS5zY29yZSA+PSA5NSA/IFwiUGVyZmVjdCEgWW91IG5haWxlZCBpdCFcIiA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGlvbkRhdGEoKS5zY29yZSA+PSA4NSA/IFwiRXhjZWxsZW50IHBlcmZvcm1hbmNlIVwiIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0aW9uRGF0YSgpLnNjb3JlID49IDcwID8gXCJHcmVhdCBqb2IhXCIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRpb25EYXRhKCkuc2NvcmUgPj0gNTAgPyBcIkdvb2QgZWZmb3J0IVwiIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIktlZXAgcHJhY3RpY2luZyFcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uUHJhY3RpY2U9eygpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFByYWN0aWNlIGVycm9ycyBjbGlja2VkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd1ByYWN0aWNlKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9JMThuUHJvdmlkZXI+XG4gICAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICAgIHsvKiBQcmFjdGljZSBWaWV3ICovfVxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImgtZnVsbCBvdmVyZmxvdy15LWF1dG9cIj5cbiAgICAgICAgICAgICAgICAgICAgPFByYWN0aWNlVmlld1xuICAgICAgICAgICAgICAgICAgICAgIHNlc3Npb25JZD17Y29tcGxldGlvbkRhdGEoKT8uc2Vzc2lvbklkfVxuICAgICAgICAgICAgICAgICAgICAgIG9uQmFjaz17KCkgPT4gc2V0U2hvd1ByYWN0aWNlKGZhbHNlKX1cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9TaG93PlxuICAgIDwvPlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaGFkb3dSb290VWkgfSBmcm9tICd3eHQvdXRpbHMvY29udGVudC1zY3JpcHQtdWkvc2hhZG93LXJvb3QnO1xuaW1wb3J0IHsgZGVmaW5lQ29udGVudFNjcmlwdCB9IGZyb20gJ3d4dC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQnO1xuaW1wb3J0IHR5cGUgeyBDb250ZW50U2NyaXB0Q29udGV4dCB9IGZyb20gJ3d4dC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0JztcbmltcG9ydCB7IHJlbmRlciB9IGZyb20gJ3NvbGlkLWpzL3dlYic7XG5pbXBvcnQgeyBDb250ZW50QXBwIH0gZnJvbSAnLi4vc3JjL3ZpZXdzL2NvbnRlbnQvQ29udGVudEFwcCc7XG5pbXBvcnQgJy4uL3NyYy9zdHlsZXMvZXh0ZW5zaW9uLmNzcyc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbnRlbnRTY3JpcHQoe1xuICBtYXRjaGVzOiBbJyo6Ly9zb3VuZGNsb3VkLmNvbS8qJywgJyo6Ly9zb3VuZGNsb2FrLmNvbS8qJywgJyo6Ly9zYy5tYWlkLnpvbmUvKicsICcqOi8vKi5tYWlkLnpvbmUvKiddLFxuICBydW5BdDogJ2RvY3VtZW50X2lkbGUnLFxuICBjc3NJbmplY3Rpb25Nb2RlOiAndWknLFxuXG4gIGFzeW5jIG1haW4oY3R4OiBDb250ZW50U2NyaXB0Q29udGV4dCkge1xuICAgIC8vIE9ubHkgcnVuIGluIHRvcC1sZXZlbCBmcmFtZSB0byBhdm9pZCBkdXBsaWNhdGUgcHJvY2Vzc2luZyBpbiBpZnJhbWVzXG4gICAgaWYgKHdpbmRvdy50b3AgIT09IHdpbmRvdy5zZWxmKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHNoYWRvdyBET00gYW5kIG1vdW50IGthcmFva2Ugd2lkZ2V0XG4gICAgY29uc3QgdWkgPSBhd2FpdCBjcmVhdGVTaGFkb3dSb290VWkoY3R4LCB7XG4gICAgICBuYW1lOiAnc2NhcmxldHQta2FyYW9rZS11aScsXG4gICAgICBwb3NpdGlvbjogJ292ZXJsYXknLFxuICAgICAgYW5jaG9yOiAnYm9keScsXG4gICAgICBvbk1vdW50OiBhc3luYyAoY29udGFpbmVyOiBIVE1MRWxlbWVudCkgPT4ge1xuICAgICAgICAvLyBDcmVhdGUgd3JhcHBlciBkaXYgKENvbnRlbnRBcHAgd2lsbCBoYW5kbGUgcG9zaXRpb25pbmcgYmFzZWQgb24gc3RhdGUpXG4gICAgICAgIGNvbnN0IHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgd3JhcHBlci5jbGFzc05hbWUgPSAna2FyYW9rZS13aWRnZXQtY29udGFpbmVyJztcbiAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKHdyYXBwZXIpO1xuXG4gICAgICAgIC8vIFJlbmRlciBDb250ZW50QXBwIGNvbXBvbmVudCAod2hpY2ggdXNlcyBFeHRlbnNpb25LYXJhb2tlVmlldylcbiAgICAgICAgY29uc3QgZGlzcG9zZSA9IHJlbmRlcigoKSA9PiA8Q29udGVudEFwcCAvPiwgd3JhcHBlcik7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gZGlzcG9zZTtcbiAgICAgIH0sXG4gICAgICBvblJlbW92ZTogKGNsZWFudXA/OiAoKSA9PiB2b2lkKSA9PiB7XG4gICAgICAgIGNsZWFudXA/LigpO1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIE1vdW50IHRoZSBVSVxuICAgIHVpLm1vdW50KCk7XG4gIH0sXG59KTsiLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKi9cbiAgc2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqL1xuICBzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKi9cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0pO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKi9cbiAgcmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9LCBvcHRpb25zKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuICAgIH1cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKFxuICAgICAgdHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsXG4gICAgICBoYW5kbGVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBzaWduYWw6IHRoaXMuc2lnbmFsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuICAgKi9cbiAgbm90aWZ5SW52YWxpZGF0ZWQoKSB7XG4gICAgdGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG4gICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgXG4gICAgKTtcbiAgfVxuICBzdG9wT2xkU2NyaXB0cygpIHtcbiAgICB3aW5kb3cucG9zdE1lc3NhZ2UoXG4gICAgICB7XG4gICAgICAgIHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcbiAgICAgICAgY29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG4gICAgICAgIG1lc3NhZ2VJZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMilcbiAgICAgIH0sXG4gICAgICBcIipcIlxuICAgICk7XG4gIH1cbiAgdmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG4gICAgY29uc3QgaXNTY3JpcHRTdGFydGVkRXZlbnQgPSBldmVudC5kYXRhPy50eXBlID09PSBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEU7XG4gICAgY29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRhdGE/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuICAgIGNvbnN0IGlzTm90RHVwbGljYXRlID0gIXRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmhhcyhldmVudC5kYXRhPy5tZXNzYWdlSWQpO1xuICAgIHJldHVybiBpc1NjcmlwdFN0YXJ0ZWRFdmVudCAmJiBpc1NhbWVDb250ZW50U2NyaXB0ICYmIGlzTm90RHVwbGljYXRlO1xuICB9XG4gIGxpc3RlbkZvck5ld2VyU2NyaXB0cyhvcHRpb25zKSB7XG4gICAgbGV0IGlzRmlyc3QgPSB0cnVlO1xuICAgIGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG4gICAgICBpZiAodGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmFkZChldmVudC5kYXRhLm1lc3NhZ2VJZCk7XG4gICAgICAgIGNvbnN0IHdhc0ZpcnN0ID0gaXNGaXJzdDtcbiAgICAgICAgaXNGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzRmlyc3QgJiYgb3B0aW9ucz8uaWdub3JlRmlyc3RFdmVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYik7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKSk7XG4gIH1cbn1cbiIsImltcG9ydCBjb21tb24gZnJvbSAnLi9jb21tb24uanNvbic7XG5pbXBvcnQga2FyYW9rZSBmcm9tICcuL2thcmFva2UuanNvbic7XG5pbXBvcnQgZGlzcGxheSBmcm9tICcuL2Rpc3BsYXkuanNvbic7XG5pbXBvcnQgdHlwZSB7IFRyYW5zbGF0aW9ucyB9IGZyb20gJy4uLy4uL3R5cGVzJztcblxuY29uc3QgdHJhbnNsYXRpb25zOiBUcmFuc2xhdGlvbnMgPSB7XG4gIGNvbW1vbixcbiAga2FyYW9rZSxcbiAgZGlzcGxheSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHRyYW5zbGF0aW9uczsiLCJpbXBvcnQgY29tbW9uIGZyb20gJy4vY29tbW9uLmpzb24nO1xuaW1wb3J0IGthcmFva2UgZnJvbSAnLi9rYXJhb2tlLmpzb24nO1xuaW1wb3J0IGRpc3BsYXkgZnJvbSAnLi9kaXNwbGF5Lmpzb24nO1xuaW1wb3J0IHR5cGUgeyBUcmFuc2xhdGlvbnMgfSBmcm9tICcuLi8uLi90eXBlcyc7XG5cbmNvbnN0IHRyYW5zbGF0aW9uczogVHJhbnNsYXRpb25zID0ge1xuICBjb21tb24sXG4gIGthcmFva2UsXG4gIGRpc3BsYXksXG59O1xuXG5leHBvcnQgZGVmYXVsdCB0cmFuc2xhdGlvbnM7Il0sIm5hbWVzIjpbInZhbHVlIiwiZXJyb3IiLCJjaGlsZHJlbiIsIm1lbW8iLCJpbmRleCIsInJlc3VsdCIsImkiLCJzb3VyY2VzIiwiZGlzcG9zZSIsImRvY3VtZW50IiwiYWRkRXZlbnRMaXN0ZW5lciIsImJyb3dzZXIiLCJfYnJvd3NlciIsImlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUiLCJzdHlsZSIsInByaW50IiwibG9nZ2VyIiwiX2EiLCJfYiIsInJlbW92ZURldGVjdG9yIiwibW91bnREZXRlY3RvciIsImRlZmluaXRpb24iLCJfJGRlbGVnYXRlRXZlbnRzIiwiU2NvcmVQYW5lbCIsInByb3BzIiwiX2VsJCIsIl90bXBsJCIsIl9lbCQyIiwiZmlyc3RDaGlsZCIsIl9lbCQzIiwiX2VsJDQiLCJuZXh0U2libGluZyIsIl9lbCQ1IiwiXyRpbnNlcnQiLCJzY29yZSIsInJhbmsiLCJfJGNsYXNzTmFtZSIsImNuIiwiY2xhc3MiLCJCdXR0b24iLCJsb2NhbCIsIm90aGVycyIsInNwbGl0UHJvcHMiLCJ2YXJpYW50Iiwic2l6ZSIsIl90bXBsJDMiLCJfJHNwcmVhZCIsIl8kbWVyZ2VQcm9wcyIsImRpc2FibGVkIiwibG9hZGluZyIsImZ1bGxXaWR0aCIsIl8kY3JlYXRlQ29tcG9uZW50IiwiU2hvdyIsIndoZW4iLCJsZWZ0SWNvbiIsIl90bXBsJDIiLCJyaWdodEljb24iLCJMeXJpY3NEaXNwbGF5IiwiY3VycmVudExpbmVJbmRleCIsInNldEN1cnJlbnRMaW5lSW5kZXgiLCJjcmVhdGVTaWduYWwiLCJjb250YWluZXJSZWYiLCJnZXRMaW5lU2NvcmUiLCJsaW5lSW5kZXgiLCJsaW5lU2NvcmVzIiwiZmluZCIsInMiLCJnZXRTY29yZVN0eWxlIiwiY29sb3IiLCJjcmVhdGVFZmZlY3QiLCJjdXJyZW50VGltZSIsImx5cmljcyIsImxlbmd0aCIsInRpbWUiLCJUSU1JTkdfT0ZGU0VUIiwiYWRqdXN0ZWRUaW1lIiwiZm91bmRJbmRleCIsImxpbmUiLCJlbmRUaW1lIiwic3RhcnRUaW1lIiwiZHVyYXRpb24iLCJwcmV2SW5kZXgiLCJNYXRoIiwiYWJzIiwiY29uc29sZSIsImxvZyIsImZyb20iLCJ0byIsInRpbWVJblNlY29uZHMiLCJqdW1wIiwid2FybiIsImZyb21MaW5lIiwidG9MaW5lIiwiaXNQbGF5aW5nIiwibGluZUVsZW1lbnRzIiwicXVlcnlTZWxlY3RvckFsbCIsImN1cnJlbnRFbGVtZW50IiwiY29udGFpbmVySGVpZ2h0IiwiY2xpZW50SGVpZ2h0IiwibGluZVRvcCIsIm9mZnNldFRvcCIsImxpbmVIZWlnaHQiLCJvZmZzZXRIZWlnaHQiLCJ0YXJnZXRTY3JvbGxUb3AiLCJzY3JvbGxUbyIsInRvcCIsImJlaGF2aW9yIiwiX3JlZiQiLCJfJHVzZSIsIkZvciIsImVhY2giLCJsaW5lU2NvcmUiLCJzY29yZVN0eWxlIiwidGV4dCIsIl8kZWZmZWN0IiwiX3AkIiwiX3YkIiwiX3YkMiIsIl92JDMiLCJlIiwiXyRzZXRBdHRyaWJ1dGUiLCJ0IiwiYSIsInNldFByb3BlcnR5IiwicmVtb3ZlUHJvcGVydHkiLCJ1bmRlZmluZWQiLCJMZWFkZXJib2FyZFBhbmVsIiwiZW50cmllcyIsImZhbGxiYWNrIiwiZW50cnkiLCJfZWwkNiIsIl9lbCQ3IiwidXNlcm5hbWUiLCJ0b0xvY2FsZVN0cmluZyIsImlzQ3VycmVudFVzZXIiLCJfdiQ0IiwibyIsInNwZWVkcyIsIlNwbGl0QnV0dG9uIiwiY3VycmVudFNwZWVkSW5kZXgiLCJzZXRDdXJyZW50U3BlZWRJbmRleCIsImN1cnJlbnRTcGVlZCIsImN5Y2xlU3BlZWQiLCJzdG9wUHJvcGFnYXRpb24iLCJuZXh0SW5kZXgiLCJuZXdTcGVlZCIsIm9uU3BlZWRDaGFuZ2UiLCJfJGFkZEV2ZW50TGlzdGVuZXIiLCJvblN0YXJ0IiwiJCRjbGljayIsIl92JDUiLCJUYWJzQ29udGV4dCIsImNyZWF0ZUNvbnRleHQiLCJUYWJzIiwiYWN0aXZlVGFiIiwic2V0QWN0aXZlVGFiIiwiZGVmYXVsdFRhYiIsInRhYnMiLCJpZCIsImhhbmRsZVRhYkNoYW5nZSIsIm9uVGFiQ2hhbmdlIiwiY29udGV4dFZhbHVlIiwiUHJvdmlkZXIiLCJUYWJzTGlzdCIsIlRhYnNUcmlnZ2VyIiwiY29udGV4dCIsInVzZUNvbnRleHQiLCJpc0FjdGl2ZSIsIlRhYnNDb250ZW50IiwiRmlyZUVtb2ppQW5pbWF0aW9uIiwic2hvd0ZpcmUiLCJzZXRTaG93RmlyZSIsImZpcmVYIiwic2V0RmlyZVgiLCJsYXN0TGluZUluZGV4IiwiaGlkZVRpbWVyIiwicmFuZG9tIiwic2V0VGltZW91dCIsIm9uQ2xlYW51cCIsInN0eWxlcyIsImZpcmVDb250YWluZXIiLCJmaXJlRW1vamkiLCJFeHRlbnNpb25LYXJhb2tlVmlldyIsImdldExhdGVzdEhpZ2hTY29yZUxpbmUiLCJzY29yZXMiLCJsYXRlc3QiLCJfdG1wbCQ1IiwiX3RtcGwkNiIsIl9lbCQ4IiwibGFiZWwiLCJfdG1wbCQ0IiwibGVhZGVyYm9hcmQiLCJJMThuQ29udGV4dCIsIkkxOG5Qcm92aWRlciIsImxvY2FsZSIsInNldExvY2FsZSIsImRlZmF1bHRMb2NhbGUiLCJ0cmFuc2xhdGlvbnMiLCJzZXRUcmFuc2xhdGlvbnMiLCJjdXJyZW50TG9jYWxlIiwibW9kdWxlIiwiZGVmYXVsdCIsIl9lIiwia2V5IiwicGFyYW1zIiwia2V5cyIsInNwbGl0IiwiayIsInJlcGxhY2UiLCJfIiwiU3RyaW5nIiwiZGlyIiwibnVtYmVyRm9ybWF0dGVyIiwiY3JlYXRlTWVtbyIsIkludGwiLCJOdW1iZXJGb3JtYXQiLCJmb3JtYXROdW1iZXIiLCJudW0iLCJmb3JtYXQiLCJmb3JtYXREYXRlIiwiZGF0ZSIsIm9wdGlvbnMiLCJEYXRlVGltZUZvcm1hdCIsInVzZUkxOG4iLCJFcnJvciIsIkNvbXBsZXRpb25WaWV3IiwiZ2V0RmVlZGJhY2tUZXh0IiwiZmVlZGJhY2tUZXh0IiwiX2VsJDkiLCJfZWwkMSIsIl9lbCQxMCIsIl9lbCQxMSIsIl9lbCQxMiIsIl9lbCQxMyIsInNwZWVkIiwib25QcmFjdGljZSIsIl9lbCQxNCIsIm9uQ2xpY2siLCJzYW1wbGVSYXRlIiwib2Zmc2V0IiwiUHJvZ3Jlc3NCYXIiLCJwZXJjZW50YWdlIiwibWluIiwibWF4IiwiY3VycmVudCIsInRvdGFsIiwiTWluaW1pemVkS2FyYW9rZSIsImN1cnJlbnRUYXJnZXQiLCJ0cmFuc2Zvcm0iLCJQcmFjdGljZUhlYWRlciIsInRpdGxlIiwiRXhlcmNpc2VGb290ZXIiLCJpc1JlY29yZGluZyIsIm9uU3RvcCIsImlzUHJvY2Vzc2luZyIsImNhblN1Ym1pdCIsIm9uUmVjb3JkIiwib25TdWJtaXQiLCJwIiwiUmVzcG9uc2VGb290ZXIiLCJtb2RlIiwiaXNDb3JyZWN0IiwiSWNvblhDaXJjbGVGaWxsIiwiSWNvbkNoZWNrQ2lyY2xlRmlsbCIsIl8kcCIsIl8kc3R5bGUiLCJvbkNvbnRpbnVlIiwiY29udGludWVMYWJlbCIsIm9uQ2hlY2siLCJFeGVyY2lzZVRlbXBsYXRlIiwiX2MkIiwiXyRtZW1vIiwiaW5zdHJ1Y3Rpb25UZXh0IiwiUmVhZEFsb3VkIiwicHJvbXB0IiwidXNlclRyYW5zY3JpcHQiLCJQcmFjdGljZUV4ZXJjaXNlVmlldyIsImN1cnJlbnRFeGVyY2lzZUluZGV4Iiwic2V0Q3VycmVudEV4ZXJjaXNlSW5kZXgiLCJzZXRJc1JlY29yZGluZyIsInNldElzUHJvY2Vzc2luZyIsInNldFVzZXJUcmFuc2NyaXB0IiwiY3VycmVudFNjb3JlIiwic2V0Q3VycmVudFNjb3JlIiwibWVkaWFSZWNvcmRlciIsInNldE1lZGlhUmVjb3JkZXIiLCJhdWRpb0NodW5rcyIsInNldEF1ZGlvQ2h1bmtzIiwic2hvd0ZlZWRiYWNrIiwic2V0U2hvd0ZlZWRiYWNrIiwic2V0SXNDb3JyZWN0IiwiYXBpQmFzZVVybCIsImV4ZXJjaXNlcyIsImNyZWF0ZVJlc291cmNlIiwidXJsIiwic2Vzc2lvbklkIiwiaGVhZGVycyIsImF1dGhUb2tlbiIsInJlc3BvbnNlIiwiZmV0Y2giLCJvayIsImVycm9yVGV4dCIsInN0YXR1cyIsImRhdGEiLCJqc29uIiwiaGFuZGxlU3RhcnRSZWNvcmRpbmciLCJzdHJlYW0iLCJuYXZpZ2F0b3IiLCJtZWRpYURldmljZXMiLCJnZXRVc2VyTWVkaWEiLCJhdWRpbyIsImVjaG9DYW5jZWxsYXRpb24iLCJub2lzZVN1cHByZXNzaW9uIiwiYXV0b0dhaW5Db250cm9sIiwibWltZVR5cGUiLCJNZWRpYVJlY29yZGVyIiwiaXNUeXBlU3VwcG9ydGVkIiwicmVjb3JkZXIiLCJjaHVua3MiLCJvbmRhdGFhdmFpbGFibGUiLCJldmVudCIsInB1c2giLCJvbnN0b3AiLCJhdWRpb0Jsb2IiLCJCbG9iIiwidHlwZSIsInByb2Nlc3NSZWNvcmRpbmciLCJnZXRUcmFja3MiLCJmb3JFYWNoIiwidHJhY2siLCJzdG9wIiwic3RhcnQiLCJibG9iIiwicmVhZGVyIiwiRmlsZVJlYWRlciIsImJhc2U2NCIsIlByb21pc2UiLCJyZXNvbHZlIiwib25sb2FkZW5kIiwiYmFzZTY0U3RyaW5nIiwicmVhZEFzRGF0YVVSTCIsImF0dGVtcHRzIiwibWF4QXR0ZW1wdHMiLCJtZXRob2QiLCJib2R5IiwiSlNPTiIsInN0cmluZ2lmeSIsImF1ZGlvQmFzZTY0IiwiZXhwZWN0ZWRUZXh0IiwiY3VycmVudEV4ZXJjaXNlIiwiZnVsbF9saW5lIiwicHJlZmVyRGVlcGdyYW0iLCJmZXRjaEVycm9yIiwidHJhbnNjcmlwdCIsImNhbGN1bGF0ZVNjb3JlIiwiaGFuZGxlQXV0b1N1Ym1pdCIsImhhbmRsZVN0b3BSZWNvcmRpbmciLCJzdGF0ZSIsIm5vcm1hbGl6ZVRleHQiLCJ0b0xvd2VyQ2FzZSIsInRyaW0iLCJleHBlY3RlZCIsImFjdHVhbCIsIm5vcm1hbGl6ZWRFeHBlY3RlZCIsIm5vcm1hbGl6ZWRBY3R1YWwiLCJleHBlY3RlZFdvcmRzIiwiYWN0dWFsV29yZHMiLCJtYXRjaGVzIiwicm91bmQiLCJzb3VuZE1hbmFnZXIiLCJwbGF5IiwiY2FyZF9pZHMiLCJleGVyY2lzZUlkIiwiY2FyZFNjb3JlcyIsIm1hcCIsImNhcmRJZCIsImhhbmRsZVN1Ym1pdCIsImhhbmRsZUNvbnRpbnVlIiwib25CYWNrIiwiZXhlcmNpc2UiLCJoZWFkZXJUaXRsZSIsIm9uRXhpdCIsImthcmFva2VBcGkiLCJLYXJhb2tlQXBpU2VydmljZSIsIlByYWN0aWNlVmlldyIsIkNvbnRlbnRBcHAiLCJjdXJyZW50VHJhY2siLCJzZXRDdXJyZW50VHJhY2siLCJzZXRBdXRoVG9rZW4iLCJzaG93S2FyYW9rZSIsInNldFNob3dLYXJhb2tlIiwia2FyYW9rZURhdGEiLCJzZXRLYXJhb2tlRGF0YSIsInNldExvYWRpbmciLCJzZXNzaW9uU3RhcnRlZCIsInNldFNlc3Npb25TdGFydGVkIiwiaXNNaW5pbWl6ZWQiLCJzZXRJc01pbmltaXplZCIsImNvdW50ZG93biIsInNldENvdW50ZG93biIsInNldElzUGxheWluZyIsInNldEN1cnJlbnRUaW1lIiwiYXVkaW9SZWYiLCJzZXRBdWRpb1JlZiIsImthcmFva2VTZXNzaW9uIiwic2V0S2FyYW9rZVNlc3Npb24iLCJjb21wbGV0aW9uRGF0YSIsInNldENvbXBsZXRpb25EYXRhIiwic2hvd1ByYWN0aWNlIiwic2V0U2hvd1ByYWN0aWNlIiwic2VsZWN0ZWRTcGVlZCIsInNldFNlbGVjdGVkU3BlZWQiLCJvbk1vdW50IiwidG9rZW4iLCJnZXRBdXRoVG9rZW4iLCJjbGVhbnVwIiwidHJhY2tEZXRlY3RvciIsIndhdGNoRm9yQ2hhbmdlcyIsImZldGNoS2FyYW9rZURhdGEiLCJnZXRLYXJhb2tlRGF0YSIsInRyYWNrSWQiLCJhcnRpc3QiLCJoYW5kbGVTdGFydCIsImxpbmVzIiwidHJhY2tUaXRsZSIsInNvbmdEYXRhIiwic29uZyIsImhhc0x5cmljcyIsIm5ld1Nlc3Npb24iLCJ1c2VLYXJhb2tlU2Vzc2lvbiIsImFsYnVtIiwic29uZ0NhdGFsb2dJZCIsInNvbmdfY2F0YWxvZ19pZCIsImF1ZGlvRWxlbWVudCIsImFwaVVybCIsIm9uQ29tcGxldGUiLCJyZXN1bHRzIiwicGF1c2UiLCJoYW5kbGVTcGVlZENoYW5nZSIsInN0YXJ0U2Vzc2lvbiIsInNldEF1ZGlvRWxlbWVudCIsImNvdW50ZG93bkludGVydmFsIiwic2V0SW50ZXJ2YWwiLCJjbGVhckludGVydmFsIiwic3RhcnRBdWRpb1BsYXliYWNrIiwiYXVkaW9FbGVtZW50cyIsInNyYyIsInBhdXNlZCIsInNlc3Npb24iLCJhdWRpb1Byb2Nlc3NvciIsImlzUmVhZHkiLCJpbml0aWFsaXplIiwiY2F0Y2giLCJ0aGVuIiwiZXJyIiwicGxheUJ1dHRvbiIsInF1ZXJ5U2VsZWN0b3IiLCJjbGljayIsInVwZGF0ZVRpbWUiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwibmV3QXVkaW9FbGVtZW50cyIsImhhbmRsZU1pbmltaXplIiwiaGFuZGxlUmVzdG9yZSIsIl90bXBsJDciLCJfdG1wbCQ4IiwiX2VsJDAiLCJyYXRlIiwicGxheWJhY2tSYXRlIiwiX2VsJDE1IiwiX3RtcGwkOSIsImlzTG9hZGluZyIsIl90bXBsJDAiLCJkZWZpbmVDb250ZW50U2NyaXB0IiwicnVuQXQiLCJjc3NJbmplY3Rpb25Nb2RlIiwibWFpbiIsImN0eCIsIndpbmRvdyIsInNlbGYiLCJ1aSIsImNyZWF0ZVNoYWRvd1Jvb3RVaSIsIm5hbWUiLCJwb3NpdGlvbiIsImFuY2hvciIsImNvbnRhaW5lciIsIndyYXBwZXIiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwiYXBwZW5kQ2hpbGQiLCJyZW5kZXIiLCJvblJlbW92ZSIsIm1vdW50IiwiY29tbW9uIiwia2FyYW9rZSIsImRpc3BsYXkiXSwibWFwcGluZ3MiOiI7Ozs7OztBQWdKQSxRQUFNLFNBQVM7QUFDZixRQUFNLFVBQVUsQ0FBQyxHQUFHLE1BQU0sTUFBTTtBQUNoQyxRQUFNLFNBQVMsT0FBTyxhQUFhO0FBQ25DLFFBQU0saUJBQWlCLE9BQU8sVUFBVTtBQUN4QyxRQUFNLFNBQVMsT0FBTyxhQUFhO0FBQ25DLFFBQU0sV0FBVyxPQUFPLHFCQUFxQjtBQUM3QyxRQUFNLGdCQUFnQjtBQUFBLElBQ3BCLFFBQVE7QUFBQSxFQUNWO0FBRUEsTUFBSSxhQUFhO0FBQ2pCLFFBQU0sUUFBUTtBQUNkLFFBQU0sVUFBVTtBQUNoQixRQUFNLFVBQVUsQ0FLaEI7QUFDQSxRQUFNLFVBQVUsQ0FBQztBQUNqQixNQUFJLFFBQVE7QUFDWixNQUFJLGFBQWE7QUFFakIsTUFBSSx1QkFBdUI7QUFDM0IsTUFBSSxXQUFXO0FBQ2YsTUFBSSxVQUFVO0FBQ2QsTUFBSSxVQUFVO0FBQ2QsTUFBSSxZQUFZO0FBT2hCLFdBQVMsV0FBVyxJQUFJLGVBQWU7QUFDckMsVUFBTSxXQUFXLFVBQ2YsUUFBUSxPQUNSLFVBQVUsR0FBRyxXQUFXLEdBQ3hCLFVBQVUsa0JBQWtCLFNBQVksUUFBUSxlQUNoRCxPQUFPLFVBQVU7QUFBQSxNQUNmLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLFNBQVM7QUFBQSxNQUNULE9BQU87QUFBQSxJQUFBLElBQ0o7QUFBQSxNQUNILE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLFNBQVMsVUFBVSxRQUFRLFVBQVU7QUFBQSxNQUNyQyxPQUFPO0FBQUEsSUFFVCxHQUFBLFdBQVcsVUFBVSxNQUFNLEdBQUcsTUFBTTtBQUM1QixZQUFBLElBQUksTUFBTSxvRUFBb0U7QUFBQSxJQUFBLENBQ3JGLElBQUssTUFBTSxHQUFHLE1BQU0sUUFBUSxNQUFNLFVBQVUsSUFBSSxDQUFDLENBQUM7QUFFN0MsWUFBQTtBQUNHLGVBQUE7QUFDUCxRQUFBO0FBQ0ssYUFBQSxXQUFXLFVBQVUsSUFBSTtBQUFBLElBQUEsVUFDaEM7QUFDVyxpQkFBQTtBQUNILGNBQUE7QUFBQSxJQUFBO0FBQUEsRUFFWjtBQUNBLFdBQVMsYUFBYSxPQUFPLFNBQVM7QUFDcEMsY0FBVSxVQUFVLE9BQU8sT0FBTyxDQUFBLEdBQUksZUFBZSxPQUFPLElBQUk7QUFDaEUsVUFBTSxJQUFJO0FBQUEsTUFDUjtBQUFBLE1BQ0EsV0FBVztBQUFBLE1BQ1gsZUFBZTtBQUFBLE1BQ2YsWUFBWSxRQUFRLFVBQVU7QUFBQSxJQUNoQztBQUNBO0FBQ0UsVUFBSSxRQUFRLEtBQVEsR0FBQSxPQUFPLFFBQVE7QUFDbkMsVUFBSSxRQUFRLFVBQVU7QUFDcEIsVUFBRSxXQUFXO0FBQUEsTUFBQSxPQUNSO0FBQ0wsc0JBQWMsQ0FBQztBQUFBLE1BQzZDO0FBQUEsSUFDOUQ7QUFFSSxVQUFBLFNBQVMsQ0FBQUEsV0FBUztBQUNsQixVQUFBLE9BQU9BLFdBQVUsWUFBWTtBQUNpRUEsaUJBQVFBLE9BQU0sRUFBRSxLQUFLO0FBQUEsTUFBQTtBQUVoSCxhQUFBLFlBQVksR0FBR0EsTUFBSztBQUFBLElBQzdCO0FBQ0EsV0FBTyxDQUFDLFdBQVcsS0FBSyxDQUFDLEdBQUcsTUFBTTtBQUFBLEVBQ3BDO0FBQ0EsV0FBUyxlQUFlLElBQUksT0FBTyxTQUFTO0FBQzFDLFVBQU0sSUFBSSxrQkFBa0IsSUFBSSxPQUFPLE1BQU0sT0FBTyxPQUFRO3NCQUM4QixDQUFDO0FBQUEsRUFDN0Y7QUFDQSxXQUFTLG1CQUFtQixJQUFJLE9BQU8sU0FBUztBQUM5QyxVQUFNLElBQUksa0JBQWtCLElBQUksT0FBTyxPQUFPLE9BQU8sT0FBUTtzQkFDNkIsQ0FBQztBQUFBLEVBQzdGO0FBQ0EsV0FBUyxhQUFhLElBQUksT0FBTyxTQUFTO0FBQzNCLGlCQUFBO0FBQ1AsVUFBQSxJQUFJLGtCQUFrQixJQUFJLE9BQU8sT0FBTyxPQUFPLE9BQVE7TUFHMUIsT0FBTztBQUMxQyxjQUFVLFFBQVEsS0FBSyxDQUFDLElBQUksa0JBQWtCLENBQUM7QUFBQSxFQUNqRDtBQWVBLFdBQVMsV0FBVyxJQUFJLE9BQU8sU0FBUztBQUN0QyxjQUFVLFVBQVUsT0FBTyxPQUFPLENBQUEsR0FBSSxlQUFlLE9BQU8sSUFBSTtBQUNoRSxVQUFNLElBQUksa0JBQWtCLElBQUksT0FBTyxNQUFNLEdBQUcsT0FBUTtBQUN4RCxNQUFFLFlBQVk7QUFDZCxNQUFFLGdCQUFnQjtBQUNoQixNQUFBLGFBQWEsUUFBUSxVQUFVO3NCQUlSLENBQUM7QUFDbkIsV0FBQSxXQUFXLEtBQUssQ0FBQztBQUFBLEVBQzFCO0FBQ0EsV0FBUyxVQUFVLEdBQUc7QUFDcEIsV0FBTyxLQUFLLE9BQU8sTUFBTSxZQUFZLFVBQVU7QUFBQSxFQUNqRDtBQUNBLFdBQVMsZUFBZSxTQUFTLFVBQVUsVUFBVTtBQUMvQyxRQUFBO0FBQ0EsUUFBQTtBQUNBLFFBQUE7QUFLRztBQUNJLGVBQUE7QUFDQyxnQkFBQTtBQUNWLGdCQUFzQixDQUFDO0FBQUEsSUFBQTtBQUV6QixRQUFJLEtBQUssTUFDUCxRQUFRLFNBR1IsWUFBWSxPQUNaLFdBQVcsa0JBQWtCLFNBQzdCLFVBQVUsT0FBTyxXQUFXLGNBQWMsV0FBVyxNQUFNO0FBQ3ZELFVBQUEsV0FBZSxvQkFBQSxJQUNuQixHQUFBLENBQUMsT0FBTyxRQUFRLEtBQUssUUFBUSxXQUFXLGNBQWMsUUFBUSxZQUFZLEdBQzFFLENBQUMsT0FBTyxRQUFRLElBQUksYUFBYSxNQUFTLEdBQzFDLENBQUMsT0FBTyxPQUFPLElBQUksYUFBYSxRQUFXO0FBQUEsTUFDekMsUUFBUTtBQUFBLElBQUEsQ0FDVCxHQUNELENBQUMsT0FBTyxRQUFRLElBQUksYUFBYSxXQUFXLFVBQVUsWUFBWTtBQUtwRSxhQUFTLFFBQVEsR0FBRyxHQUFHQyxRQUFPLEtBQUs7QUFDakMsVUFBSSxPQUFPLEdBQUc7QUFDUCxhQUFBO0FBQ0wsZ0JBQVEsV0FBYyxXQUFXO0FBQzVCLGFBQUEsTUFBTSxTQUFTLE1BQU0sVUFBVSxRQUFRLFdBQTJCLGdCQUFBLE1BQU0sUUFBUSxXQUFXLEtBQUs7QUFBQSxVQUNuRyxPQUFPO0FBQUEsUUFBQSxDQUNSLENBQUM7QUFDTSxnQkFBQTtBQVFZLHFCQUFBLEdBQUdBLE1BQUs7QUFBQSxNQUFBO0FBRXZCLGFBQUE7QUFBQSxJQUFBO0FBRUEsYUFBQSxhQUFhLEdBQUcsS0FBSztBQUM1QixpQkFBVyxNQUFNO0FBQ2YsWUFBSSxRQUFRLE9BQW9CLFVBQUEsTUFBTSxDQUFDO0FBQ3ZDLGlCQUFTLFFBQVEsU0FBWSxZQUFZLFdBQVcsVUFBVSxZQUFZO0FBQzFFLGlCQUFTLEdBQUc7QUFDWixtQkFBVyxLQUFLLFNBQVMsS0FBSyxLQUFLLFVBQVU7QUFDN0MsaUJBQVMsTUFBTTtBQUFBLFNBQ2QsS0FBSztBQUFBLElBQUE7QUFFVixhQUFTLE9BQU87QUFDUixZQUFBLElBQUksaUJBQ1IsSUFBSSxNQUNKLEdBQUEsTUFBTSxNQUFNO0FBQ2QsVUFBSSxRQUFRLFVBQWEsQ0FBQyxHQUFVLE9BQUE7QUFDcEMsVUFBSSxZQUFZLENBQUMsU0FBUyxRQUFRLEVBQUc7QUFXOUIsYUFBQTtBQUFBLElBQUE7QUFFQSxhQUFBLEtBQUssYUFBYSxNQUFNO0FBQzNCLFVBQUEsZUFBZSxTQUFTLFVBQVc7QUFDM0Isa0JBQUE7QUFDTixZQUFBLFNBQVMsVUFBVSxRQUFBLElBQVk7QUFFakMsVUFBQSxVQUFVLFFBQVEsV0FBVyxPQUFPO0FBQzlCLGdCQUFBLElBQUksUUFBUSxLQUFLLENBQUM7QUFDMUI7QUFBQSxNQUFBO0FBR0VBLFVBQUFBO0FBQ0osWUFBTSxJQUFJLFVBQVUsVUFBVSxRQUFRLFFBQVEsTUFBTTtBQUM5QyxZQUFBO0FBQ0YsaUJBQU8sUUFBUSxRQUFRO0FBQUEsWUFDckIsT0FBTyxNQUFNO0FBQUEsWUFDYjtBQUFBLFVBQUEsQ0FDRDtBQUFBLGlCQUNNLGNBQWM7QUFDckJBLG1CQUFRO0FBQUEsUUFBQTtBQUFBLE1BQ1YsQ0FDRDtBQUNELFVBQUlBLFdBQVUsUUFBVztBQUN2QixnQkFBUSxJQUFJLFFBQVcsVUFBVUEsTUFBSyxHQUFHLE1BQU07QUFDL0M7QUFBQSxNQUFBLFdBQ1MsQ0FBQyxVQUFVLENBQUMsR0FBRztBQUNoQixnQkFBQSxJQUFJLEdBQUcsUUFBVyxNQUFNO0FBQ3pCLGVBQUE7QUFBQSxNQUFBO0FBRUosV0FBQTtBQUNMLFVBQUksT0FBTyxHQUFHO0FBQ1IsWUFBQSxFQUFFLE1BQU0sRUFBRyxTQUFRLElBQUksRUFBRSxHQUFHLFFBQVcsTUFBTTtBQUFBLHFCQUFlLElBQUksUUFBVyxVQUFVLEVBQUUsQ0FBQyxHQUFHLE1BQU07QUFDOUYsZUFBQTtBQUFBLE1BQUE7QUFFRyxrQkFBQTtBQUNHLHFCQUFBLE1BQU0sWUFBWSxLQUFLO0FBQ3RDLGlCQUFXLE1BQU07QUFDTixpQkFBQSxXQUFXLGVBQWUsU0FBUztBQUNwQyxnQkFBQTtBQUFBLFNBQ1AsS0FBSztBQUNSLGFBQU8sRUFBRSxLQUFLLENBQUEsTUFBSyxRQUFRLEdBQUcsR0FBRyxRQUFXLE1BQU0sR0FBRyxDQUFBLE1BQUssUUFBUSxHQUFHLFFBQVcsVUFBVSxDQUFDLEdBQUcsTUFBTSxDQUFDO0FBQUEsSUFBQTtBQUV2RyxXQUFPLGlCQUFpQixNQUFNO0FBQUEsTUFDNUIsT0FBTztBQUFBLFFBQ0wsS0FBSyxNQUFNLE1BQU07QUFBQSxNQUNuQjtBQUFBLE1BQ0EsT0FBTztBQUFBLFFBQ0wsS0FBSyxNQUFNLE1BQU07QUFBQSxNQUNuQjtBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1AsTUFBTTtBQUNKLGdCQUFNLElBQUksTUFBTTtBQUNULGlCQUFBLE1BQU0sYUFBYSxNQUFNO0FBQUEsUUFBQTtBQUFBLE1BRXBDO0FBQUEsTUFDQSxRQUFRO0FBQUEsUUFDTixNQUFNO0FBQ0EsY0FBQSxDQUFDLFNBQVUsUUFBTyxLQUFLO0FBQzNCLGdCQUFNLE1BQU0sTUFBTTtBQUNkLGNBQUEsT0FBTyxDQUFDLEdBQVUsT0FBQTtBQUN0QixpQkFBTyxNQUFNO0FBQUEsUUFBQTtBQUFBLE1BQ2Y7QUFBQSxJQUNGLENBQ0Q7QUFDRCxRQUFJLFFBQVE7QUFDWixRQUFJLFFBQXdCLGdCQUFBLE9BQU8sUUFBUSxPQUFPLEtBQUssS0FBSyxFQUFFO0FBQUEsY0FBWSxLQUFLO0FBQy9FLFdBQU8sQ0FBQyxNQUFNO0FBQUEsTUFDWixTQUFTLENBQVEsU0FBQSxhQUFhLE9BQU8sTUFBTSxLQUFLLElBQUksQ0FBQztBQUFBLE1BQ3JELFFBQVE7QUFBQSxJQUFBLENBQ1Q7QUFBQSxFQUNIO0FBNENBLFdBQVMsUUFBUSxJQUFJO0FBQ25CLFFBQTZCLGFBQWEsYUFBYSxHQUFHO0FBQzFELFVBQU0sV0FBVztBQUNOLGVBQUE7QUFDUCxRQUFBO0FBQ0YsVUFBSSxxQkFBc0I7QUFDMUIsYUFBTyxHQUFHO0FBQUEsSUFBQSxVQUNWO0FBQ1csaUJBQUE7QUFBQSxJQUFBO0FBQUEsRUFFZjtBQW9CQSxXQUFTLFFBQVEsSUFBSTtBQUNOLGlCQUFBLE1BQU0sUUFBUSxFQUFFLENBQUM7QUFBQSxFQUNoQztBQUNBLFdBQVMsVUFBVSxJQUFJO0FBQ3JCLFFBQUksVUFBVSxLQUFjLFNBQUEsS0FBSyx1RUFBdUU7QUFBQSxhQUFXLE1BQU0sYUFBYSxLQUFZLE9BQUEsV0FBVyxDQUFDLEVBQUU7QUFBQSxRQUFPLE9BQU0sU0FBUyxLQUFLLEVBQUU7QUFDdEwsV0FBQTtBQUFBLEVBQ1Q7QUF1QkEsV0FBUyxhQUFhLEdBQUcsSUFBSTtBQUMzQixVQUFNLE9BQU87QUFDYixVQUFNLGVBQWU7QUFDYixZQUFBO0FBQ0csZUFBQTtBQUNQLFFBQUE7QUFDSyxhQUFBLFdBQVcsSUFBSSxJQUFJO0FBQUEsYUFDbkIsS0FBSztBQUNaLGtCQUFZLEdBQUc7QUFBQSxJQUFBLFVBQ2Y7QUFDUSxjQUFBO0FBQ0csaUJBQUE7QUFBQSxJQUFBO0FBQUEsRUFFZjtBQWdDQSxRQUFNLENBQUMsY0FBYyxlQUFlLGlDQUE4QixLQUFLO0FBUXZFLFdBQVMsYUFBYSxNQUFNLE9BQU87QUFDakMsVUFBTSxJQUFJLGtCQUFrQixNQUFNLFFBQVEsTUFBTTtBQUM5QyxhQUFPLE9BQU8sTUFBTTtBQUFBLFFBQ2xCLENBQUMsUUFBUSxHQUFHO0FBQUEsTUFBQSxDQUNiO0FBQ0QsYUFBTyxLQUFLLEtBQUs7QUFBQSxJQUFBLENBQ2xCLEdBQUcsUUFBVyxNQUFNLENBQUM7QUFDdEIsTUFBRSxRQUFRO0FBQ1YsTUFBRSxZQUFZO0FBQ2QsTUFBRSxnQkFBZ0I7QUFDbEIsTUFBRSxPQUFPLEtBQUs7QUFDZCxNQUFFLFlBQVk7QUFDZCxzQkFBa0IsQ0FBQztBQUNuQixXQUFPLEVBQUUsV0FBVyxTQUFZLEVBQUUsU0FBUyxFQUFFO0FBQUEsRUFDL0M7QUFDQSxXQUFTLGNBQWMsT0FBTztBQUM1QixRQUFJLE9BQU87QUFDVCxVQUFJLE1BQU0sVUFBaUIsT0FBQSxVQUFVLEtBQUssS0FBSztBQUFBLFVBQU8sT0FBTSxZQUFZLENBQUMsS0FBSztBQUM5RSxZQUFNLFFBQVE7QUFBQSxJQUFBO0FBQUEsRUFHbEI7QUFDQSxXQUFTLGNBQWMsY0FBYyxTQUFTO0FBQ3RDLFVBQUEsS0FBSyxPQUFPLFNBQVM7QUFDcEIsV0FBQTtBQUFBLE1BQ0w7QUFBQSxNQUNBLFVBQVUsZUFBZSxJQUFJLE9BQU87QUFBQSxNQUNwQztBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0EsV0FBUyxXQUFXLFNBQVM7QUFDdkIsUUFBQTtBQUNHLFdBQUEsU0FBUyxNQUFNLFlBQVksUUFBUSxNQUFNLFFBQVEsUUFBUSxFQUFFLE9BQU8sU0FBWSxRQUFRLFFBQVE7QUFBQSxFQUN2RztBQUNBLFdBQVMsU0FBUyxJQUFJO0FBQ2RDLFVBQUFBLFlBQVcsV0FBVyxFQUFFO0FBQzlCLFVBQU1DLFFBQU8sV0FBVyxNQUFNLGdCQUFnQkQsVUFBUyxDQUFDLEdBQUcsUUFBVztBQUFBLE1BQ3BFLE1BQU07QUFBQSxJQUFBLENBQ1A7QUFDRCxJQUFBQyxNQUFLLFVBQVUsTUFBTTtBQUNuQixZQUFNLElBQUlBLE1BQUs7QUFDUixhQUFBLE1BQU0sUUFBUSxDQUFDLElBQUksSUFBSSxLQUFLLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQztBQUFBLElBQ25EO0FBQ08sV0FBQUE7QUFBQSxFQUNUO0FBQ0EsTUFBSTtBQStCSixXQUFTLGFBQWE7QUFFcEIsUUFBSSxLQUFLLFdBQThDLEtBQUssT0FBUTtBQUNsRSxVQUF1QyxLQUFLLFVBQVcseUJBQXlCLElBQUk7QUFBQSxXQUFPO0FBQ3pGLGNBQU0sVUFBVTtBQUNOLGtCQUFBO0FBQ1YsbUJBQVcsTUFBTSxhQUFhLElBQUksR0FBRyxLQUFLO0FBQ2hDLGtCQUFBO0FBQUEsTUFBQTtBQUFBLElBQ1o7QUFFRixRQUFJLFVBQVU7QUFDWixZQUFNLFFBQVEsS0FBSyxZQUFZLEtBQUssVUFBVSxTQUFTO0FBQ25ELFVBQUEsQ0FBQyxTQUFTLFNBQVM7QUFDWixpQkFBQSxVQUFVLENBQUMsSUFBSTtBQUNmLGlCQUFBLGNBQWMsQ0FBQyxLQUFLO0FBQUEsTUFBQSxPQUN4QjtBQUNJLGlCQUFBLFFBQVEsS0FBSyxJQUFJO0FBQ2pCLGlCQUFBLFlBQVksS0FBSyxLQUFLO0FBQUEsTUFBQTtBQUU3QixVQUFBLENBQUMsS0FBSyxXQUFXO0FBQ2QsYUFBQSxZQUFZLENBQUMsUUFBUTtBQUMxQixhQUFLLGdCQUFnQixDQUFDLFNBQVMsUUFBUSxTQUFTLENBQUM7QUFBQSxNQUFBLE9BQzVDO0FBQ0EsYUFBQSxVQUFVLEtBQUssUUFBUTtBQUM1QixhQUFLLGNBQWMsS0FBSyxTQUFTLFFBQVEsU0FBUyxDQUFDO0FBQUEsTUFBQTtBQUFBLElBQ3JEO0FBR0YsV0FBTyxLQUFLO0FBQUEsRUFDZDtBQUNBLFdBQVMsWUFBWSxNQUFNLE9BQU8sUUFBUTtBQUNwQyxRQUFBLFVBQTJGLEtBQUs7QUFDaEcsUUFBQSxDQUFDLEtBQUssY0FBYyxDQUFDLEtBQUssV0FBVyxTQUFTLEtBQUssR0FBRztXQVE1QyxRQUFRO0FBQ3BCLFVBQUksS0FBSyxhQUFhLEtBQUssVUFBVSxRQUFRO0FBQzNDLG1CQUFXLE1BQU07QUFDZixtQkFBUyxJQUFJLEdBQUcsSUFBSSxLQUFLLFVBQVUsUUFBUSxLQUFLLEdBQUc7QUFDM0Msa0JBQUEsSUFBSSxLQUFLLFVBQVUsQ0FBQztBQUNwQixrQkFBQSxvQkFBb0IsY0FBYyxXQUFXO0FBQ25ELGdCQUFJLHFCQUFxQixXQUFXLFNBQVMsSUFBSSxDQUFDLEVBQUc7QUFDckQsZ0JBQUksb0JBQW9CLENBQUMsRUFBRSxTQUFTLENBQUMsRUFBRSxPQUFPO0FBQzVDLGtCQUFJLEVBQUUsS0FBYyxTQUFBLEtBQUssQ0FBQztBQUFBLGtCQUFPLFNBQVEsS0FBSyxDQUFDO0FBQzNDLGtCQUFBLEVBQUUsVUFBVyxnQkFBZSxDQUFDO0FBQUEsWUFBQTtBQUUvQixnQkFBQSxDQUFDLGtCQUFtQixHQUFFLFFBQVE7QUFBQSxVQUFzQjtBQUV0RCxjQUFBLFFBQVEsU0FBUyxLQUFNO0FBQ3pCLHNCQUFVLENBQUM7QUFDWCxnQkFBSSxPQUFRLE9BQU0sSUFBSSxNQUFNLG1DQUFtQztBQUMvRCxrQkFBTSxJQUFJLE1BQU07QUFBQSxVQUFBO0FBQUEsV0FFakIsS0FBSztBQUFBLE1BQUE7QUFBQSxJQUNWO0FBRUssV0FBQTtBQUFBLEVBQ1Q7QUFDQSxXQUFTLGtCQUFrQixNQUFNO0FBQzNCLFFBQUEsQ0FBQyxLQUFLLEdBQUk7QUFDZCxjQUFVLElBQUk7QUFDZCxVQUFNLE9BQU87QUFDYixtQkFBZSxNQUF1RixLQUFLLE9BQU8sSUFBSTtBQUFBLEVBV3hIO0FBQ0EsV0FBUyxlQUFlLE1BQU0sT0FBTyxNQUFNO0FBQ3JDLFFBQUE7QUFDRSxVQUFBLFFBQVEsT0FDWixXQUFXO0FBQ2IsZUFBVyxRQUFRO0FBQ2YsUUFBQTtBQUNVLGtCQUFBLEtBQUssR0FBRyxLQUFLO0FBQUEsYUFDbEIsS0FBSztBQUNaLFVBQUksS0FBSyxNQUFNO0FBS047QUFDTCxlQUFLLFFBQVE7QUFDYixlQUFLLFNBQVMsS0FBSyxNQUFNLFFBQVEsU0FBUztBQUMxQyxlQUFLLFFBQVE7QUFBQSxRQUFBO0FBQUEsTUFDZjtBQUVGLFdBQUssWUFBWSxPQUFPO0FBQ3hCLGFBQU8sWUFBWSxHQUFHO0FBQUEsSUFBQSxVQUN0QjtBQUNXLGlCQUFBO0FBQ0gsY0FBQTtBQUFBLElBQUE7QUFFVixRQUFJLENBQUMsS0FBSyxhQUFhLEtBQUssYUFBYSxNQUFNO0FBQzdDLFVBQUksS0FBSyxhQUFhLFFBQVEsZUFBZSxNQUFNO0FBQ3JDLG9CQUFBLE1BQU0sU0FBZTtBQUFBLE1BQUEsWUFJdkIsUUFBUTtBQUNwQixXQUFLLFlBQVk7QUFBQSxJQUFBO0FBQUEsRUFFckI7QUFDQSxXQUFTLGtCQUFrQixJQUFJLE1BQU0sTUFBTSxRQUFRLE9BQU8sU0FBUztBQUNqRSxVQUFNLElBQUk7QUFBQSxNQUNSO0FBQUEsTUFDQTtBQUFBLE1BQ0EsV0FBVztBQUFBLE1BQ1gsT0FBTztBQUFBLE1BQ1AsU0FBUztBQUFBLE1BQ1QsYUFBYTtBQUFBLE1BQ2IsVUFBVTtBQUFBLE1BQ1YsT0FBTztBQUFBLE1BQ1AsT0FBTztBQUFBLE1BQ1AsU0FBUyxRQUFRLE1BQU0sVUFBVTtBQUFBLE1BQ2pDO0FBQUEsSUFDRjtBQUtBLFFBQUksVUFBVSxLQUFjLFNBQUEsS0FBSyxnRkFBZ0Y7QUFBQSxhQUFXLFVBQVUsU0FBUztBQUd0STtBQUNMLFlBQUksQ0FBQyxNQUFNLE1BQWEsT0FBQSxRQUFRLENBQUMsQ0FBQztBQUFBLFlBQU8sT0FBTSxNQUFNLEtBQUssQ0FBQztBQUFBLE1BQUE7QUFBQSxJQUM3RDtBQUVGLFFBQUksV0FBVyxRQUFRLEtBQU0sR0FBRSxPQUFPLFFBQVE7QUFldkMsV0FBQTtBQUFBLEVBQ1Q7QUFDQSxXQUFTLE9BQU8sTUFBTTtBQUVwQixRQUF1QyxLQUFLLFVBQVcsRUFBRztBQUNyRCxRQUFrQyxLQUFLLFVBQVcsUUFBUyxRQUFPLGFBQWEsSUFBSTtBQUN4RixRQUFJLEtBQUssWUFBWSxRQUFRLEtBQUssU0FBUyxVQUFVLEVBQUcsUUFBTyxLQUFLLFNBQVMsUUFBUSxLQUFLLElBQUk7QUFDeEYsVUFBQSxZQUFZLENBQUMsSUFBSTtBQUNmLFlBQUEsT0FBTyxLQUFLLFdBQVcsQ0FBQyxLQUFLLGFBQWEsS0FBSyxZQUFZLFlBQVk7QUFFN0UsVUFBc0MsS0FBSyxNQUFPLFdBQVUsS0FBSyxJQUFJO0FBQUEsSUFBQTtBQUV2RSxhQUFTLElBQUksVUFBVSxTQUFTLEdBQUcsS0FBSyxHQUFHLEtBQUs7QUFDOUMsYUFBTyxVQUFVLENBQUM7QUFRbEIsVUFBdUMsS0FBSyxVQUFXLE9BQU87QUFDNUQsMEJBQWtCLElBQUk7QUFBQSxpQkFDc0IsS0FBSyxVQUFXLFNBQVM7QUFDckUsY0FBTSxVQUFVO0FBQ04sa0JBQUE7QUFDVixtQkFBVyxNQUFNLGFBQWEsTUFBTSxVQUFVLENBQUMsQ0FBQyxHQUFHLEtBQUs7QUFDOUMsa0JBQUE7QUFBQSxNQUFBO0FBQUEsSUFDWjtBQUFBLEVBRUo7QUFDQSxXQUFTLFdBQVcsSUFBSSxNQUFNO0FBQ3hCLFFBQUEsZ0JBQWdCLEdBQUc7QUFDdkIsUUFBSSxPQUFPO0FBQ1AsUUFBQSxDQUFDLEtBQU0sV0FBVSxDQUFDO0FBQ3RCLFFBQUksUUFBZ0IsUUFBQTtBQUFBLG1CQUFvQixDQUFDO0FBQ3pDO0FBQ0ksUUFBQTtBQUNGLFlBQU0sTUFBTSxHQUFHO0FBQ2Ysc0JBQWdCLElBQUk7QUFDYixhQUFBO0FBQUEsYUFDQSxLQUFLO0FBQ1IsVUFBQSxDQUFDLEtBQWdCLFdBQUE7QUFDWCxnQkFBQTtBQUNWLGtCQUFZLEdBQUc7QUFBQSxJQUFBO0FBQUEsRUFFbkI7QUFDQSxXQUFTLGdCQUFnQixNQUFNO0FBQzdCLFFBQUksU0FBUztlQUM2RSxPQUFPO0FBQ3JGLGdCQUFBO0FBQUEsSUFBQTtBQUVaLFFBQUksS0FBTTtBQW1DVixVQUFNLElBQUk7QUFDQSxjQUFBO0FBQ1YsUUFBSSxFQUFFLE9BQVEsWUFBVyxNQUFNLFdBQVcsQ0FBQyxHQUFHLEtBQUs7QUFBQSxFQUVyRDtBQUNBLFdBQVMsU0FBUyxPQUFPO0FBQ2QsYUFBQSxJQUFJLEdBQUcsSUFBSSxNQUFNLFFBQVEsSUFBSyxRQUFPLE1BQU0sQ0FBQyxDQUFDO0FBQUEsRUFDeEQ7QUFrQkEsV0FBUyxlQUFlLE9BQU87QUFDN0IsUUFBSSxHQUNGLGFBQWE7QUFDZixTQUFLLElBQUksR0FBRyxJQUFJLE1BQU0sUUFBUSxLQUFLO0FBQzNCLFlBQUEsSUFBSSxNQUFNLENBQUM7QUFDakIsVUFBSSxDQUFDLEVBQUUsS0FBTSxRQUFPLENBQUM7QUFBQSxVQUFPLE9BQU0sWUFBWSxJQUFJO0FBQUEsSUFBQTtBQWUvQyxTQUFBLElBQUksR0FBRyxJQUFJLFlBQVksSUFBWSxRQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQUEsRUFDbEQ7QUFDQSxXQUFTLGFBQWEsTUFBTSxRQUFRO1NBRWUsUUFBUTtBQUN6RCxhQUFTLElBQUksR0FBRyxJQUFJLEtBQUssUUFBUSxRQUFRLEtBQUssR0FBRztBQUN6QyxZQUFBLFNBQVMsS0FBSyxRQUFRLENBQUM7QUFDN0IsVUFBSSxPQUFPLFNBQVM7QUFDbEIsY0FBTSxRQUE0QyxPQUFPO0FBQ3pELFlBQUksVUFBVSxPQUFPO0FBQ2YsY0FBQSxXQUFXLFdBQVcsQ0FBQyxPQUFPLGFBQWEsT0FBTyxZQUFZLFdBQVksUUFBTyxNQUFNO0FBQUEsUUFDbEYsV0FBQSxVQUFVLFFBQVMsY0FBYSxRQUFRLE1BQU07QUFBQSxNQUFBO0FBQUEsSUFDM0Q7QUFBQSxFQUVKO0FBQ0EsV0FBUyxlQUFlLE1BQU07QUFFNUIsYUFBUyxJQUFJLEdBQUcsSUFBSSxLQUFLLFVBQVUsUUFBUSxLQUFLLEdBQUc7QUFDM0MsWUFBQSxJQUFJLEtBQUssVUFBVSxDQUFDO0FBQzFCLFVBQW9DLENBQUMsRUFBRSxPQUFPO1VBQ0ssUUFBUTtBQUN6RCxZQUFJLEVBQUUsS0FBYyxTQUFBLEtBQUssQ0FBQztBQUFBLFlBQU8sU0FBUSxLQUFLLENBQUM7QUFDN0MsVUFBQSxhQUFhLGVBQWUsQ0FBQztBQUFBLE1BQUE7QUFBQSxJQUNqQztBQUFBLEVBRUo7QUFDQSxXQUFTLFVBQVUsTUFBTTtBQUNuQixRQUFBO0FBQ0osUUFBSSxLQUFLLFNBQVM7QUFDVCxhQUFBLEtBQUssUUFBUSxRQUFRO0FBQ3BCLGNBQUEsU0FBUyxLQUFLLFFBQVEsSUFBSSxHQUM5QkMsU0FBUSxLQUFLLFlBQVksSUFBQSxHQUN6QixNQUFNLE9BQU87QUFDWCxZQUFBLE9BQU8sSUFBSSxRQUFRO0FBQ3JCLGdCQUFNLElBQUksSUFBSSxJQUFBLEdBQ1osSUFBSSxPQUFPLGNBQWMsSUFBSTtBQUMzQixjQUFBQSxTQUFRLElBQUksUUFBUTtBQUNwQixjQUFBLFlBQVksQ0FBQyxJQUFJQTtBQUNuQixnQkFBSUEsTUFBSyxJQUFJO0FBQ04sbUJBQUEsY0FBY0EsTUFBSyxJQUFJO0FBQUEsVUFBQTtBQUFBLFFBQ2hDO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFFRixRQUFJLEtBQUssUUFBUTtBQUNmLFdBQUssSUFBSSxLQUFLLE9BQU8sU0FBUyxHQUFHLEtBQUssR0FBRyxJQUFlLFdBQUEsS0FBSyxPQUFPLENBQUMsQ0FBQztBQUN0RSxhQUFPLEtBQUs7QUFBQSxJQUFBO0FBSWQsUUFBVyxLQUFLLE9BQU87QUFDckIsV0FBSyxJQUFJLEtBQUssTUFBTSxTQUFTLEdBQUcsS0FBSyxHQUFHLElBQWUsV0FBQSxLQUFLLE1BQU0sQ0FBQyxDQUFDO0FBQ3BFLFdBQUssUUFBUTtBQUFBLElBQUE7QUFFZixRQUFJLEtBQUssVUFBVTtBQUNaLFdBQUEsSUFBSSxLQUFLLFNBQVMsU0FBUyxHQUFHLEtBQUssR0FBRyxJQUFLLE1BQUssU0FBUyxDQUFDLEVBQUU7QUFDakUsV0FBSyxXQUFXO0FBQUEsSUFBQTtTQUU4QyxRQUFRO0FBQ3hFLFdBQU8sS0FBSztBQUFBLEVBQ2Q7QUFVQSxXQUFTLFVBQVUsS0FBSztBQUNsQixRQUFBLGVBQWUsTUFBYyxRQUFBO0FBQ2pDLFdBQU8sSUFBSSxNQUFNLE9BQU8sUUFBUSxXQUFXLE1BQU0saUJBQWlCO0FBQUEsTUFDaEUsT0FBTztBQUFBLElBQUEsQ0FDUjtBQUFBLEVBQ0g7QUFRQSxXQUFTLFlBQVksS0FBSyxRQUFRLE9BQU87QUFFakMsVUFBQSxRQUFRLFVBQVUsR0FBRztBQUNYLFVBQUE7QUFBQSxFQU9sQjtBQUNBLFdBQVMsZ0JBQWdCRixXQUFVO0FBQzdCLFFBQUEsT0FBT0EsY0FBYSxjQUFjLENBQUNBLFVBQVMsT0FBUSxRQUFPLGdCQUFnQkEsV0FBVTtBQUNyRixRQUFBLE1BQU0sUUFBUUEsU0FBUSxHQUFHO0FBQzNCLFlBQU0sVUFBVSxDQUFDO0FBQ2pCLGVBQVMsSUFBSSxHQUFHLElBQUlBLFVBQVMsUUFBUSxLQUFLO0FBQ3hDLGNBQU1HLFVBQVMsZ0JBQWdCSCxVQUFTLENBQUMsQ0FBQztBQUNwQyxjQUFBLFFBQVFHLE9BQU0sSUFBSSxRQUFRLEtBQUssTUFBTSxTQUFTQSxPQUFNLElBQUksUUFBUSxLQUFLQSxPQUFNO0FBQUEsTUFBQTtBQUU1RSxhQUFBO0FBQUEsSUFBQTtBQUVGSCxXQUFBQTtBQUFBQSxFQUNUO0FBQ0EsV0FBUyxlQUFlLElBQUksU0FBUztBQUM1QixXQUFBLFNBQVMsU0FBUyxPQUFPO0FBQzFCLFVBQUE7QUFDZSx5QkFBQSxNQUFNLE1BQU0sUUFBUSxNQUFNO0FBQzNDLGNBQU0sVUFBVTtBQUFBLFVBQ2QsR0FBRyxNQUFNO0FBQUEsVUFDVCxDQUFDLEVBQUUsR0FBRyxNQUFNO0FBQUEsUUFDZDtBQUNPLGVBQUEsU0FBUyxNQUFNLE1BQU0sUUFBUTtBQUFBLE1BQUEsQ0FDckMsR0FBRyxRQUFXLE9BQU87QUFDZixhQUFBO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUF1RUEsUUFBTSxXQUFXLE9BQU8sVUFBVTtBQUNsQyxXQUFTLFFBQVEsR0FBRztBQUNULGFBQUEsSUFBSSxHQUFHLElBQUksRUFBRSxRQUFRLElBQUssR0FBRSxDQUFDLEVBQUU7QUFBQSxFQUMxQztBQUNBLFdBQVMsU0FBUyxNQUFNLE9BQU8sVUFBVSxDQUFBLEdBQUk7QUFDM0MsUUFBSSxRQUFRLENBQUMsR0FDWCxTQUFTLElBQ1QsWUFBWSxDQUNaLEdBQUEsTUFBTSxHQUNOLFVBQVUsTUFBTSxTQUFTLElBQUksQ0FBSyxJQUFBO0FBQzFCLGNBQUEsTUFBTSxRQUFRLFNBQVMsQ0FBQztBQUNsQyxXQUFPLE1BQU07QUFDUCxVQUFBLFdBQVcsVUFBVSxJQUN2QixTQUFTLFNBQVMsUUFDbEIsR0FDQTtBQUNGLGVBQVMsTUFBTTtBQUNmLGFBQU8sUUFBUSxNQUFNO0FBQ25CLFlBQUksWUFBWSxnQkFBZ0IsTUFBTSxlQUFlLGFBQWEsT0FBTyxLQUFLLFFBQVE7QUFDdEYsWUFBSSxXQUFXLEdBQUc7QUFDaEIsY0FBSSxRQUFRLEdBQUc7QUFDYixvQkFBUSxTQUFTO0FBQ2pCLHdCQUFZLENBQUM7QUFDYixvQkFBUSxDQUFDO0FBQ1QscUJBQVMsQ0FBQztBQUNKLGtCQUFBO0FBQ04sd0JBQVksVUFBVTtVQUFDO0FBRXpCLGNBQUksUUFBUSxVQUFVO0FBQ3BCLG9CQUFRLENBQUMsUUFBUTtBQUNWLG1CQUFBLENBQUMsSUFBSSxXQUFXLENBQVksYUFBQTtBQUNqQyx3QkFBVSxDQUFDLElBQUk7QUFDZixxQkFBTyxRQUFRLFNBQVM7QUFBQSxZQUFBLENBQ3pCO0FBQ0ssa0JBQUE7QUFBQSxVQUFBO0FBQUEsUUFDUixXQUVPLFFBQVEsR0FBRztBQUNULG1CQUFBLElBQUksTUFBTSxNQUFNO0FBQ3pCLGVBQUssSUFBSSxHQUFHLElBQUksUUFBUSxLQUFLO0FBQ3JCLGtCQUFBLENBQUMsSUFBSSxTQUFTLENBQUM7QUFDZCxtQkFBQSxDQUFDLElBQUksV0FBVyxNQUFNO0FBQUEsVUFBQTtBQUV6QixnQkFBQTtBQUFBLFFBQUEsT0FDRDtBQUNFLGlCQUFBLElBQUksTUFBTSxNQUFNO0FBQ1AsMEJBQUEsSUFBSSxNQUFNLE1BQU07QUFDcEIsc0JBQUEsY0FBYyxJQUFJLE1BQU0sTUFBTTtBQUMxQyxlQUFLLFFBQVEsR0FBRyxNQUFNLEtBQUssSUFBSSxLQUFLLE1BQU0sR0FBRyxRQUFRLE9BQU8sTUFBTSxLQUFLLE1BQU0sU0FBUyxLQUFLLEdBQUcsUUFBUTtBQUN0RyxlQUFLLE1BQU0sTUFBTSxHQUFHLFNBQVMsU0FBUyxHQUFHLE9BQU8sU0FBUyxVQUFVLFNBQVMsTUFBTSxHQUFHLE1BQU0sU0FBUyxNQUFNLEdBQUcsT0FBTyxVQUFVO0FBQ3ZILGlCQUFBLE1BQU0sSUFBSSxPQUFPLEdBQUc7QUFDWCwwQkFBQSxNQUFNLElBQUksVUFBVSxHQUFHO0FBQ3JDLHdCQUFZLFlBQVksTUFBTSxJQUFJLFFBQVEsR0FBRztBQUFBLFVBQUE7QUFFL0MsMkNBQWlCLElBQUk7QUFDSiwyQkFBQSxJQUFJLE1BQU0sU0FBUyxDQUFDO0FBQ3JDLGVBQUssSUFBSSxRQUFRLEtBQUssT0FBTyxLQUFLO0FBQ2hDLG1CQUFPLFNBQVMsQ0FBQztBQUNiLGdCQUFBLFdBQVcsSUFBSSxJQUFJO0FBQ3ZCLDJCQUFlLENBQUMsSUFBSSxNQUFNLFNBQVksS0FBSztBQUNoQyx1QkFBQSxJQUFJLE1BQU0sQ0FBQztBQUFBLFVBQUE7QUFFeEIsZUFBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLEtBQUs7QUFDN0IsbUJBQU8sTUFBTSxDQUFDO0FBQ1YsZ0JBQUEsV0FBVyxJQUFJLElBQUk7QUFDbkIsZ0JBQUEsTUFBTSxVQUFhLE1BQU0sSUFBSTtBQUMxQixtQkFBQSxDQUFDLElBQUksT0FBTyxDQUFDO0FBQ0osNEJBQUEsQ0FBQyxJQUFJLFVBQVUsQ0FBQztBQUM5QiwwQkFBWSxZQUFZLENBQUMsSUFBSSxRQUFRLENBQUM7QUFDdEMsa0JBQUksZUFBZSxDQUFDO0FBQ1QseUJBQUEsSUFBSSxNQUFNLENBQUM7QUFBQSxZQUFBLE1BQ1AsV0FBQSxDQUFDLEVBQUU7QUFBQSxVQUFBO0FBRXRCLGVBQUssSUFBSSxPQUFPLElBQUksUUFBUSxLQUFLO0FBQy9CLGdCQUFJLEtBQUssTUFBTTtBQUNOLHFCQUFBLENBQUMsSUFBSSxLQUFLLENBQUM7QUFDUix3QkFBQSxDQUFDLElBQUksY0FBYyxDQUFDO0FBQzlCLGtCQUFJLFNBQVM7QUFDSCx3QkFBQSxDQUFDLElBQUksWUFBWSxDQUFDO0FBQ2xCLHdCQUFBLENBQUMsRUFBRSxDQUFDO0FBQUEsY0FBQTtBQUFBLFlBRVQsTUFBQSxRQUFPLENBQUMsSUFBSSxXQUFXLE1BQU07QUFBQSxVQUFBO0FBRXRDLG1CQUFTLE9BQU8sTUFBTSxHQUFHLE1BQU0sTUFBTTtBQUM3QixrQkFBQSxTQUFTLE1BQU0sQ0FBQztBQUFBLFFBQUE7QUFFbkIsZUFBQTtBQUFBLE1BQUEsQ0FDUjtBQUNELGVBQVMsT0FBTyxVQUFVO0FBQ3hCLGtCQUFVLENBQUMsSUFBSTtBQUNmLFlBQUksU0FBUztBQUNYLGdCQUFNLENBQUMsR0FBRyxHQUFHLElBQUksYUFBYSxHQUFHO0FBQUEsWUFDL0IsTUFBTTtBQUFBLFVBQUEsQ0FDUDtBQUNELGtCQUFRLENBQUMsSUFBSTtBQUNiLGlCQUFPLE1BQU0sU0FBUyxDQUFDLEdBQUcsQ0FBQztBQUFBLFFBQUE7QUFFdEIsZUFBQSxNQUFNLFNBQVMsQ0FBQyxDQUFDO0FBQUEsTUFBQTtBQUFBLElBRTVCO0FBQUEsRUFDRjtBQXFFQSxXQUFTLGdCQUFnQixNQUFNLE9BQU87QUFVcEMsV0FBTyxhQUFhLE1BQU0sU0FBUyxFQUFFO0FBQUEsRUFDdkM7QUFDQSxXQUFTLFNBQVM7QUFDVCxXQUFBO0FBQUEsRUFDVDtBQUNBLFFBQU0sWUFBWTtBQUFBLElBQ2hCLElBQUksR0FBRyxVQUFVLFVBQVU7QUFDckIsVUFBQSxhQUFhLE9BQWUsUUFBQTtBQUN6QixhQUFBLEVBQUUsSUFBSSxRQUFRO0FBQUEsSUFDdkI7QUFBQSxJQUNBLElBQUksR0FBRyxVQUFVO0FBQ1gsVUFBQSxhQUFhLE9BQWUsUUFBQTtBQUN6QixhQUFBLEVBQUUsSUFBSSxRQUFRO0FBQUEsSUFDdkI7QUFBQSxJQUNBLEtBQUs7QUFBQSxJQUNMLGdCQUFnQjtBQUFBLElBQ2hCLHlCQUF5QixHQUFHLFVBQVU7QUFDN0IsYUFBQTtBQUFBLFFBQ0wsY0FBYztBQUFBLFFBQ2QsWUFBWTtBQUFBLFFBQ1osTUFBTTtBQUNHLGlCQUFBLEVBQUUsSUFBSSxRQUFRO0FBQUEsUUFDdkI7QUFBQSxRQUNBLEtBQUs7QUFBQSxRQUNMLGdCQUFnQjtBQUFBLE1BQ2xCO0FBQUEsSUFDRjtBQUFBLElBQ0EsUUFBUSxHQUFHO0FBQ1QsYUFBTyxFQUFFLEtBQUs7QUFBQSxJQUFBO0FBQUEsRUFFbEI7QUFDQSxXQUFTLGNBQWMsR0FBRztBQUNqQixXQUFBLEVBQUUsSUFBSSxPQUFPLE1BQU0sYUFBYSxNQUFNLEtBQUssQ0FBQSxJQUFLO0FBQUEsRUFDekQ7QUFDQSxXQUFTLGlCQUFpQjtBQUNmLGFBQUEsSUFBSSxHQUFHLFNBQVMsS0FBSyxRQUFRLElBQUksUUFBUSxFQUFFLEdBQUc7QUFDL0MsWUFBQSxJQUFJLEtBQUssQ0FBQyxFQUFFO0FBQ2QsVUFBQSxNQUFNLE9BQWtCLFFBQUE7QUFBQSxJQUFBO0FBQUEsRUFFaEM7QUFDQSxXQUFTLGNBQWMsU0FBUztBQUM5QixRQUFJLFFBQVE7QUFDWixhQUFTLElBQUksR0FBRyxJQUFJLFFBQVEsUUFBUSxLQUFLO0FBQ2pDLFlBQUEsSUFBSSxRQUFRLENBQUM7QUFDbkIsY0FBUSxTQUFTLENBQUMsQ0FBQyxLQUFLLFVBQVU7QUFDMUIsY0FBQSxDQUFDLElBQUksT0FBTyxNQUFNLGNBQWMsUUFBUSxNQUFNLFdBQVcsQ0FBQyxLQUFLO0FBQUEsSUFBQTtBQUV6RSxRQUFJLGtCQUFrQixPQUFPO0FBQzNCLGFBQU8sSUFBSSxNQUFNO0FBQUEsUUFDZixJQUFJLFVBQVU7QUFDWixtQkFBUyxJQUFJLFFBQVEsU0FBUyxHQUFHLEtBQUssR0FBRyxLQUFLO0FBQzVDLGtCQUFNLElBQUksY0FBYyxRQUFRLENBQUMsQ0FBQyxFQUFFLFFBQVE7QUFDeEMsZ0JBQUEsTUFBTSxPQUFrQixRQUFBO0FBQUEsVUFBQTtBQUFBLFFBRWhDO0FBQUEsUUFDQSxJQUFJLFVBQVU7QUFDWixtQkFBUyxJQUFJLFFBQVEsU0FBUyxHQUFHLEtBQUssR0FBRyxLQUFLO0FBQzVDLGdCQUFJLFlBQVksY0FBYyxRQUFRLENBQUMsQ0FBQyxFQUFVLFFBQUE7QUFBQSxVQUFBO0FBRTdDLGlCQUFBO0FBQUEsUUFDVDtBQUFBLFFBQ0EsT0FBTztBQUNMLGdCQUFNLE9BQU8sQ0FBQztBQUNkLG1CQUFTLElBQUksR0FBRyxJQUFJLFFBQVEsUUFBUSxJQUFVLE1BQUEsS0FBSyxHQUFHLE9BQU8sS0FBSyxjQUFjLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM1RixpQkFBTyxDQUFDLEdBQUcsSUFBSSxJQUFJLElBQUksQ0FBQztBQUFBLFFBQUE7QUFBQSxTQUV6QixTQUFTO0FBQUEsSUFBQTtBQUVkLFVBQU0sYUFBYSxDQUFDO0FBQ2QsVUFBQSxVQUFpQix1QkFBQSxPQUFPLElBQUk7QUFDbEMsYUFBUyxJQUFJLFFBQVEsU0FBUyxHQUFHLEtBQUssR0FBRyxLQUFLO0FBQ3RDLFlBQUEsU0FBUyxRQUFRLENBQUM7QUFDeEIsVUFBSSxDQUFDLE9BQVE7QUFDUCxZQUFBLGFBQWEsT0FBTyxvQkFBb0IsTUFBTTtBQUNwRCxlQUFTSSxLQUFJLFdBQVcsU0FBUyxHQUFHQSxNQUFLLEdBQUdBLE1BQUs7QUFDekMsY0FBQSxNQUFNLFdBQVdBLEVBQUM7QUFDcEIsWUFBQSxRQUFRLGVBQWUsUUFBUSxjQUFlO0FBQ2xELGNBQU0sT0FBTyxPQUFPLHlCQUF5QixRQUFRLEdBQUc7QUFDcEQsWUFBQSxDQUFDLFFBQVEsR0FBRyxHQUFHO0FBQ1Qsa0JBQUEsR0FBRyxJQUFJLEtBQUssTUFBTTtBQUFBLFlBQ3hCLFlBQVk7QUFBQSxZQUNaLGNBQWM7QUFBQSxZQUNkLEtBQUssZUFBZSxLQUFLLFdBQVcsR0FBRyxJQUFJLENBQUMsS0FBSyxJQUFJLEtBQUssTUFBTSxDQUFDLENBQUM7QUFBQSxVQUNoRSxJQUFBLEtBQUssVUFBVSxTQUFZLE9BQU87QUFBQSxRQUFBLE9BQ2pDO0FBQ0NDLGdCQUFBQSxXQUFVLFdBQVcsR0FBRztBQUM5QixjQUFJQSxVQUFTO0FBQ1AsZ0JBQUEsS0FBSyxJQUFLQSxVQUFRLEtBQUssS0FBSyxJQUFJLEtBQUssTUFBTSxDQUFDO0FBQUEscUJBQVcsS0FBSyxVQUFVLE9BQVdBLFVBQVEsS0FBSyxNQUFNLEtBQUssS0FBSztBQUFBLFVBQUE7QUFBQSxRQUNwSDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBRUYsVUFBTSxTQUFTLENBQUM7QUFDVixVQUFBLGNBQWMsT0FBTyxLQUFLLE9BQU87QUFDdkMsYUFBUyxJQUFJLFlBQVksU0FBUyxHQUFHLEtBQUssR0FBRyxLQUFLO0FBQ2hELFlBQU0sTUFBTSxZQUFZLENBQUMsR0FDdkIsT0FBTyxRQUFRLEdBQUc7QUFDcEIsVUFBSSxRQUFRLEtBQUssWUFBWSxlQUFlLFFBQVEsS0FBSyxJQUFJO0FBQUEsVUFBYyxRQUFBLEdBQUcsSUFBSSxPQUFPLEtBQUssUUFBUTtBQUFBLElBQUE7QUFFakcsV0FBQTtBQUFBLEVBQ1Q7QUFDQSxXQUFTLFdBQVcsVUFBVSxNQUFNO0FBQzlCLFFBQUEsa0JBQWtCLFVBQVUsT0FBTztBQUMvQixZQUFBLFVBQVUsSUFBSSxJQUFJLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxJQUFJLEtBQUssQ0FBQyxDQUFDO0FBQ3pELFlBQUEsTUFBTSxLQUFLLElBQUksQ0FBSyxNQUFBO0FBQ3hCLGVBQU8sSUFBSSxNQUFNO0FBQUEsVUFDZixJQUFJLFVBQVU7QUFDWixtQkFBTyxFQUFFLFNBQVMsUUFBUSxJQUFJLE1BQU0sUUFBUSxJQUFJO0FBQUEsVUFDbEQ7QUFBQSxVQUNBLElBQUksVUFBVTtBQUNaLG1CQUFPLEVBQUUsU0FBUyxRQUFRLEtBQUssWUFBWTtBQUFBLFVBQzdDO0FBQUEsVUFDQSxPQUFPO0FBQ0wsbUJBQU8sRUFBRSxPQUFPLENBQVksYUFBQSxZQUFZLEtBQUs7QUFBQSxVQUFBO0FBQUEsV0FFOUMsU0FBUztBQUFBLE1BQUEsQ0FDYjtBQUNHLFVBQUEsS0FBSyxJQUFJLE1BQU07QUFBQSxRQUNqQixJQUFJLFVBQVU7QUFDWixpQkFBTyxRQUFRLElBQUksUUFBUSxJQUFJLFNBQVksTUFBTSxRQUFRO0FBQUEsUUFDM0Q7QUFBQSxRQUNBLElBQUksVUFBVTtBQUNaLGlCQUFPLFFBQVEsSUFBSSxRQUFRLElBQUksUUFBUSxZQUFZO0FBQUEsUUFDckQ7QUFBQSxRQUNBLE9BQU87QUFDRSxpQkFBQSxPQUFPLEtBQUssS0FBSyxFQUFFLE9BQU8sT0FBSyxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUM7QUFBQSxRQUFBO0FBQUEsTUFFekQsR0FBRyxTQUFTLENBQUM7QUFDTixhQUFBO0FBQUEsSUFBQTtBQUVULFVBQU0sY0FBYyxDQUFDO0FBQ3JCLFVBQU0sVUFBVSxLQUFLLElBQUksT0FBTyxDQUFHLEVBQUE7QUFDbkMsZUFBVyxZQUFZLE9BQU8sb0JBQW9CLEtBQUssR0FBRztBQUN4RCxZQUFNLE9BQU8sT0FBTyx5QkFBeUIsT0FBTyxRQUFRO0FBQ3RELFlBQUEsZ0JBQWdCLENBQUMsS0FBSyxPQUFPLENBQUMsS0FBSyxPQUFPLEtBQUssY0FBYyxLQUFLLFlBQVksS0FBSztBQUN6RixVQUFJLFVBQVU7QUFDZCxVQUFJLGNBQWM7QUFDbEIsaUJBQVcsS0FBSyxNQUFNO0FBQ2hCLFlBQUEsRUFBRSxTQUFTLFFBQVEsR0FBRztBQUNkLG9CQUFBO0FBQ1YsMEJBQWdCLFFBQVEsV0FBVyxFQUFFLFFBQVEsSUFBSSxLQUFLLFFBQVEsT0FBTyxlQUFlLFFBQVEsV0FBVyxHQUFHLFVBQVUsSUFBSTtBQUFBLFFBQUE7QUFFeEgsVUFBQTtBQUFBLE1BQUE7QUFFSixVQUFJLENBQUMsU0FBUztBQUNJLHdCQUFBLFlBQVksUUFBUSxJQUFJLEtBQUssUUFBUSxPQUFPLGVBQWUsYUFBYSxVQUFVLElBQUk7QUFBQSxNQUFBO0FBQUEsSUFDeEc7QUFFSyxXQUFBLENBQUMsR0FBRyxTQUFTLFdBQVc7QUFBQSxFQUNqQztBQTJDQSxRQUFNLGdCQUFnQixDQUFRLFNBQUEsNENBQTRDLElBQUk7QUFDOUUsV0FBUyxJQUFJLE9BQU87QUFDWixVQUFBLFdBQVcsY0FBYyxTQUFTO0FBQUEsTUFDdEMsVUFBVSxNQUFNLE1BQU07QUFBQSxJQUN4QjtBQUNPLFdBQUEsV0FBVyxTQUFTLE1BQU0sTUFBTSxNQUFNLE1BQU0sVUFBVSxZQUFZLE1BQVMsR0FBRyxRQUFXO0FBQUEsTUFDOUYsTUFBTTtBQUFBLElBQUEsQ0FDUDtBQUFBLEVBQ0g7QUFTQSxXQUFTLEtBQUssT0FBTztBQUNuQixVQUFNLFFBQVEsTUFBTTtBQUNwQixVQUFNLGlCQUFpQixXQUFXLE1BQU0sTUFBTSxNQUFNLFFBQVc7QUFBQSxNQUM3RCxNQUFNO0FBQUEsSUFBQSxDQUNOO0FBQ0YsVUFBTSxZQUFZLFFBQVEsaUJBQWlCLFdBQVcsZ0JBQWdCLFFBQVc7QUFBQSxNQUMvRSxRQUFRLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0FBQUEsTUFDMUIsTUFBTTtBQUFBLElBQUEsQ0FDTjtBQUNGLFdBQU8sV0FBVyxNQUFNO0FBQ3RCLFlBQU0sSUFBSSxVQUFVO0FBQ3BCLFVBQUksR0FBRztBQUNMLGNBQU0sUUFBUSxNQUFNO0FBQ3BCLGNBQU0sS0FBSyxPQUFPLFVBQVUsY0FBYyxNQUFNLFNBQVM7QUFDekQsZUFBTyxLQUFLLFFBQVEsTUFBTSxNQUFNLFFBQVEsSUFBSSxNQUFNO0FBQ2hELGNBQUksQ0FBQyxRQUFRLFNBQVMsRUFBRyxPQUFNLGNBQWMsTUFBTTtBQUNuRCxpQkFBTyxlQUFlO0FBQUEsUUFDdkIsQ0FBQSxDQUFDLElBQUk7QUFBQSxNQUFBO0FBRVIsYUFBTyxNQUFNO0FBQUEsT0FDWixRQUFXO0FBQUEsTUFDWixNQUFNO0FBQUEsSUFBQSxDQUNOO0FBQUEsRUFDSjtBQThPQSxNQUFJLFlBQVk7QUFDZCxRQUFJLENBQUMsV0FBVyxRQUFTLFlBQVcsVUFBVTtBQUFBLFFBQVUsU0FBUSxLQUFLLHVGQUF1RjtBQUFBLEVBQzlKO0FDbHZEQSxRQUFNLFdBQVcsQ0FBQyxtQkFBbUIsU0FBUyxhQUFhLFlBQVksV0FBVyxZQUFZLFdBQVcsWUFBWSxrQkFBa0IsVUFBVSxpQkFBaUIsU0FBUyxTQUFTLFFBQVEsWUFBWSxTQUFTLFlBQVksY0FBYyxRQUFRLGVBQWUsWUFBWSxZQUFZLFlBQVksWUFBWSxVQUFVO0FBQzVULFFBQU0sYUFBMEIsb0JBQUksSUFBSSxDQUFDLGFBQWEsU0FBUyxZQUFZLGNBQWMsa0JBQWtCLFNBQVMsWUFBWSxlQUFlLEdBQUcsUUFBUSxDQUFDO0FBQzNKLFFBQU0sc0NBQW1DLElBQUksQ0FBQyxhQUFhLGVBQWUsYUFBYSxVQUFVLENBQUM7QUFDbEcsUUFBTSxVQUE4Qix1QkFBQSxPQUFjLHVCQUFBLE9BQU8sSUFBSSxHQUFHO0FBQUEsSUFDOUQsV0FBVztBQUFBLElBQ1gsU0FBUztBQUFBLEVBQ1gsQ0FBQztBQUNELFFBQU0sY0FBa0MsdUJBQUEsT0FBYyx1QkFBQSxPQUFPLElBQUksR0FBRztBQUFBLElBQ2xFLE9BQU87QUFBQSxJQUNQLFlBQVk7QUFBQSxNQUNWLEdBQUc7QUFBQSxNQUNILE1BQU07QUFBQSxJQUNSO0FBQUEsSUFDQSxnQkFBZ0I7QUFBQSxNQUNkLEdBQUc7QUFBQSxNQUNILFFBQVE7QUFBQSxNQUNSLE9BQU87QUFBQSxJQUNUO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxHQUFHO0FBQUEsTUFDSCxLQUFLO0FBQUEsSUFDUDtBQUFBLElBQ0EsVUFBVTtBQUFBLE1BQ1IsR0FBRztBQUFBLE1BQ0gsUUFBUTtBQUFBLElBQ1Y7QUFBQSxJQUNBLGFBQWE7QUFBQSxNQUNYLEdBQUc7QUFBQSxNQUNILE9BQU87QUFBQSxJQUNUO0FBQUEsSUFDQSxVQUFVO0FBQUEsTUFDUixHQUFHO0FBQUEsTUFDSCxPQUFPO0FBQUEsTUFDUCxVQUFVO0FBQUEsSUFBQTtBQUFBLEVBRWQsQ0FBQztBQUNELFdBQVMsYUFBYSxNQUFNLFNBQVM7QUFDN0IsVUFBQSxJQUFJLFlBQVksSUFBSTtBQUNuQixXQUFBLE9BQU8sTUFBTSxXQUFXLEVBQUUsT0FBTyxJQUFJLEVBQUUsR0FBRyxJQUFJLFNBQVk7QUFBQSxFQUNuRTtBQUNBLFFBQU0sa0JBQW1DLG9CQUFBLElBQUksQ0FBQyxlQUFlLFNBQVMsWUFBWSxlQUFlLFdBQVcsWUFBWSxTQUFTLFdBQVcsU0FBUyxhQUFhLGFBQWEsWUFBWSxhQUFhLFdBQVcsZUFBZSxlQUFlLGNBQWMsZUFBZSxhQUFhLFlBQVksYUFBYSxZQUFZLENBQUM7QUFZalUsUUFBTSxPQUFPLENBQUEsT0FBTSxXQUFXLE1BQU0sSUFBSTtBQUV4QyxXQUFTLGdCQUFnQixZQUFZLEdBQUcsR0FBRztBQUN6QyxRQUFJLFVBQVUsRUFBRSxRQUNkLE9BQU8sRUFBRSxRQUNULE9BQU8sU0FDUCxTQUFTLEdBQ1QsU0FBUyxHQUNULFFBQVEsRUFBRSxPQUFPLENBQUMsRUFBRSxhQUNwQixNQUFNO0FBQ0QsV0FBQSxTQUFTLFFBQVEsU0FBUyxNQUFNO0FBQ3JDLFVBQUksRUFBRSxNQUFNLE1BQU0sRUFBRSxNQUFNLEdBQUc7QUFDM0I7QUFDQTtBQUNBO0FBQUEsTUFBQTtBQUVGLGFBQU8sRUFBRSxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHO0FBQ2xDO0FBQ0E7QUFBQSxNQUFBO0FBRUYsVUFBSSxTQUFTLFFBQVE7QUFDbkIsY0FBTSxPQUFPLE9BQU8sVUFBVSxTQUFTLEVBQUUsU0FBUyxDQUFDLEVBQUUsY0FBYyxFQUFFLE9BQU8sTUFBTSxJQUFJO0FBQ3RGLGVBQU8sU0FBUyxLQUFNLFlBQVcsYUFBYSxFQUFFLFFBQVEsR0FBRyxJQUFJO0FBQUEsTUFBQSxXQUN0RCxTQUFTLFFBQVE7QUFDMUIsZUFBTyxTQUFTLE1BQU07QUFDcEIsY0FBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRyxHQUFFLE1BQU0sRUFBRSxPQUFPO0FBQ2xEO0FBQUEsUUFBQTtBQUFBLE1BRU8sV0FBQSxFQUFFLE1BQU0sTUFBTSxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsTUFBTSxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUc7QUFDakUsY0FBTSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUU7QUFDdkIsbUJBQVcsYUFBYSxFQUFFLFFBQVEsR0FBRyxFQUFFLFFBQVEsRUFBRSxXQUFXO0FBQzVELG1CQUFXLGFBQWEsRUFBRSxFQUFFLElBQUksR0FBRyxJQUFJO0FBQ3JDLFVBQUEsSUFBSSxJQUFJLEVBQUUsSUFBSTtBQUFBLE1BQUEsT0FDWDtBQUNMLFlBQUksQ0FBQyxLQUFLO0FBQ1Isb0NBQVUsSUFBSTtBQUNkLGNBQUksSUFBSTtBQUNSLGlCQUFPLElBQUksS0FBTSxLQUFJLElBQUksRUFBRSxDQUFDLEdBQUcsR0FBRztBQUFBLFFBQUE7QUFFcEMsY0FBTUgsU0FBUSxJQUFJLElBQUksRUFBRSxNQUFNLENBQUM7QUFDL0IsWUFBSUEsVUFBUyxNQUFNO0FBQ2IsY0FBQSxTQUFTQSxVQUFTQSxTQUFRLE1BQU07QUFDOUIsZ0JBQUEsSUFBSSxRQUNOLFdBQVcsR0FDWDtBQUNGLG1CQUFPLEVBQUUsSUFBSSxRQUFRLElBQUksTUFBTTtBQUN4QixtQkFBQSxJQUFJLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQyxNQUFNLFFBQVEsTUFBTUEsU0FBUSxTQUFVO0FBQzNEO0FBQUEsWUFBQTtBQUVFLGdCQUFBLFdBQVdBLFNBQVEsUUFBUTtBQUN2QixvQkFBQSxPQUFPLEVBQUUsTUFBTTtBQUNyQixxQkFBTyxTQUFTQSxPQUFPLFlBQVcsYUFBYSxFQUFFLFFBQVEsR0FBRyxJQUFJO0FBQUEsWUFBQSxrQkFDaEQsYUFBYSxFQUFFLFFBQVEsR0FBRyxFQUFFLFFBQVEsQ0FBQztBQUFBLFVBQ2xELE1BQUE7QUFBQSxRQUNGLE1BQUEsR0FBRSxRQUFRLEVBQUUsT0FBTztBQUFBLE1BQUE7QUFBQSxJQUM1QjtBQUFBLEVBRUo7QUFFQSxRQUFNLFdBQVc7QUFDakIsV0FBUyxPQUFPLE1BQU0sU0FBUyxNQUFNLFVBQVUsQ0FBQSxHQUFJO0FBQ2pELFFBQUksQ0FBQyxTQUFTO0FBQ04sWUFBQSxJQUFJLE1BQU0sMkdBQTJHO0FBQUEsSUFBQTtBQUV6SCxRQUFBO0FBQ0osZUFBVyxDQUFXSSxhQUFBO0FBQ1QsaUJBQUFBO0FBQ0Msa0JBQUEsV0FBVyxLQUFLLElBQUksT0FBTyxTQUFTLEtBQUssR0FBRyxRQUFRLGFBQWEsT0FBTyxRQUFXLElBQUk7QUFBQSxJQUFBLEdBQ2xHLFFBQVEsS0FBSztBQUNoQixXQUFPLE1BQU07QUFDRixlQUFBO0FBQ1QsY0FBUSxjQUFjO0FBQUEsSUFDeEI7QUFBQSxFQUNGO0FBQ0EsV0FBUyxTQUFTLE1BQU0sY0FBYyxPQUFPLFVBQVU7QUFDakQsUUFBQTtBQUNKLFVBQU0sU0FBUyxNQUFNO0FBRWIsWUFBQSxJQUE0RixTQUFTLGNBQWMsVUFBVTtBQUNuSSxRQUFFLFlBQVk7QUFDUCxhQUFvRSxFQUFFLFFBQVE7QUFBQSxJQUN2RjtBQUNNLFVBQUEsS0FBZ0csT0FBTyxTQUFTLE9BQU8sV0FBVyxVQUFVLElBQUk7QUFDdEosT0FBRyxZQUFZO0FBQ1IsV0FBQTtBQUFBLEVBQ1Q7QUFDQSxXQUFTLGVBQWUsWUFBWUMsWUFBVyxPQUFPLFVBQVU7QUFDeEQsVUFBQSxJQUFJQSxVQUFTLFFBQVEsTUFBTUEsVUFBUyxRQUFRLHdCQUFRO0FBQzFELGFBQVMsSUFBSSxHQUFHLElBQUksV0FBVyxRQUFRLElBQUksR0FBRyxLQUFLO0FBQzNDLFlBQUEsT0FBTyxXQUFXLENBQUM7QUFDekIsVUFBSSxDQUFDLEVBQUUsSUFBSSxJQUFJLEdBQUc7QUFDaEIsVUFBRSxJQUFJLElBQUk7QUFDVkEsa0JBQVMsaUJBQWlCLE1BQU0sWUFBWTtBQUFBLE1BQUE7QUFBQSxJQUM5QztBQUFBLEVBRUo7QUFXQSxXQUFTLGFBQWEsTUFBTSxNQUFNLE9BQU87QUFFdkMsUUFBSSxTQUFTLEtBQVcsTUFBQSxnQkFBZ0IsSUFBSTtBQUFBLFFBQU8sTUFBSyxhQUFhLE1BQU0sS0FBSztBQUFBLEVBQ2xGO0FBS0EsV0FBUyxpQkFBaUIsTUFBTSxNQUFNLE9BQU87QUFFM0MsWUFBUSxLQUFLLGFBQWEsTUFBTSxFQUFFLElBQUksS0FBSyxnQkFBZ0IsSUFBSTtBQUFBLEVBQ2pFO0FBQ0EsV0FBUyxVQUFVLE1BQU0sT0FBTztBQUU5QixRQUFJLFNBQVMsS0FBVyxNQUFBLGdCQUFnQixPQUFPO0FBQUEsY0FBWSxZQUFZO0FBQUEsRUFDekU7QUFDQSxXQUFTQyxtQkFBaUIsTUFBTSxNQUFNLFNBQVMsVUFBVTtBQUN2RCxRQUFJLFVBQVU7QUFDUixVQUFBLE1BQU0sUUFBUSxPQUFPLEdBQUc7QUFDMUIsYUFBSyxLQUFLLElBQUksRUFBRSxJQUFJLFFBQVEsQ0FBQztBQUM3QixhQUFLLEtBQUssSUFBSSxNQUFNLElBQUksUUFBUSxDQUFDO0FBQUEsTUFDNUIsTUFBQSxNQUFLLEtBQUssSUFBSSxFQUFFLElBQUk7QUFBQSxJQUNsQixXQUFBLE1BQU0sUUFBUSxPQUFPLEdBQUc7QUFDM0IsWUFBQSxZQUFZLFFBQVEsQ0FBQztBQUMzQixXQUFLLGlCQUFpQixNQUFNLFFBQVEsQ0FBQyxJQUFJLENBQUEsTUFBSyxVQUFVLEtBQUssTUFBTSxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFBQSxJQUFBLFlBQ3ZFLGlCQUFpQixNQUFNLFNBQVMsT0FBTyxZQUFZLGNBQWMsT0FBTztBQUFBLEVBQ3RGO0FBQ0EsV0FBUyxVQUFVLE1BQU0sT0FBTyxPQUFPLENBQUEsR0FBSTtBQUNuQyxVQUFBLFlBQVksT0FBTyxLQUFLLFNBQVMsRUFBRSxHQUN2QyxXQUFXLE9BQU8sS0FBSyxJQUFJO0FBQzdCLFFBQUksR0FBRztBQUNQLFNBQUssSUFBSSxHQUFHLE1BQU0sU0FBUyxRQUFRLElBQUksS0FBSyxLQUFLO0FBQ3pDLFlBQUEsTUFBTSxTQUFTLENBQUM7QUFDdEIsVUFBSSxDQUFDLE9BQU8sUUFBUSxlQUFlLE1BQU0sR0FBRyxFQUFHO0FBQ2hDLHFCQUFBLE1BQU0sS0FBSyxLQUFLO0FBQy9CLGFBQU8sS0FBSyxHQUFHO0FBQUEsSUFBQTtBQUVqQixTQUFLLElBQUksR0FBRyxNQUFNLFVBQVUsUUFBUSxJQUFJLEtBQUssS0FBSztBQUMxQyxZQUFBLE1BQU0sVUFBVSxDQUFDLEdBQ3JCLGFBQWEsQ0FBQyxDQUFDLE1BQU0sR0FBRztBQUN0QixVQUFBLENBQUMsT0FBTyxRQUFRLGVBQWUsS0FBSyxHQUFHLE1BQU0sY0FBYyxDQUFDLFdBQVk7QUFDN0QscUJBQUEsTUFBTSxLQUFLLElBQUk7QUFDOUIsV0FBSyxHQUFHLElBQUk7QUFBQSxJQUFBO0FBRVAsV0FBQTtBQUFBLEVBQ1Q7QUFDQSxXQUFTLE1BQU0sTUFBTSxPQUFPLE1BQU07QUFDaEMsUUFBSSxDQUFDLE1BQU8sUUFBTyxPQUFPLGFBQWEsTUFBTSxPQUFPLElBQUk7QUFDeEQsVUFBTSxZQUFZLEtBQUs7QUFDdkIsUUFBSSxPQUFPLFVBQVUsU0FBVSxRQUFPLFVBQVUsVUFBVTtBQUMxRCxXQUFPLFNBQVMsYUFBYSxVQUFVLFVBQVUsT0FBTztBQUN4RCxhQUFTLE9BQU87QUFDaEIsY0FBVSxRQUFRO0FBQ2xCLFFBQUksR0FBRztBQUNQLFNBQUssS0FBSyxNQUFNO0FBQ2QsWUFBTSxDQUFDLEtBQUssUUFBUSxVQUFVLGVBQWUsQ0FBQztBQUM5QyxhQUFPLEtBQUssQ0FBQztBQUFBLElBQUE7QUFFZixTQUFLLEtBQUssT0FBTztBQUNmLFVBQUksTUFBTSxDQUFDO0FBQ1AsVUFBQSxNQUFNLEtBQUssQ0FBQyxHQUFHO0FBQ1Asa0JBQUEsWUFBWSxHQUFHLENBQUM7QUFDMUIsYUFBSyxDQUFDLElBQUk7QUFBQSxNQUFBO0FBQUEsSUFDWjtBQUVLLFdBQUE7QUFBQSxFQUNUO0FBQ0EsV0FBUyxPQUFPLE1BQU0sUUFBUSxDQUFBLEdBQUksT0FBTyxjQUFjO0FBQ3JELFVBQU0sWUFBWSxDQUFDO0FBSUEsdUJBQUEsTUFBTSxPQUFPLE1BQU0sUUFBUSxjQUFjLElBQUksTUFBTSxLQUFLLElBQUksQ0FBQztBQUM3RCx1QkFBQSxNQUFNLE9BQU8sTUFBTSxPQUFPLE9BQU8sTUFBTSxXQUFXLElBQUksQ0FBQztBQUNuRSxXQUFBO0FBQUEsRUFDVDtBQVdBLFdBQVMsSUFBSSxJQUFJLFNBQVMsS0FBSztBQUM3QixXQUFPLFFBQVEsTUFBTSxHQUFHLFNBQVMsR0FBRyxDQUFDO0FBQUEsRUFDdkM7QUFDQSxXQUFTLE9BQU8sUUFBUSxVQUFVLFFBQVEsU0FBUztBQUNqRCxRQUFJLFdBQVcsVUFBYSxDQUFDLG1CQUFtQixDQUFDO0FBQzdDLFFBQUEsT0FBTyxhQUFhLFdBQVksUUFBTyxpQkFBaUIsUUFBUSxVQUFVLFNBQVMsTUFBTTtBQUMxRSx1QkFBQSxDQUFBLFlBQVcsaUJBQWlCLFFBQVEsU0FBQSxHQUFZLFNBQVMsTUFBTSxHQUFHLE9BQU87QUFBQSxFQUM5RjtBQUNBLFdBQVMsT0FBTyxNQUFNLE9BQU8sT0FBTyxjQUFjLFlBQVksQ0FBQSxHQUFJLFVBQVUsT0FBTztBQUNqRixjQUFVLFFBQVE7QUFDbEIsZUFBVyxRQUFRLFdBQVc7QUFDeEIsVUFBQSxFQUFFLFFBQVEsUUFBUTtBQUNwQixZQUFJLFNBQVMsV0FBWTtBQUNmLGtCQUFBLElBQUksSUFBSSxXQUFXLE1BQU0sTUFBTSxNQUFNLFVBQVUsSUFBSSxHQUFHLE9BQU8sU0FBUyxLQUFLO0FBQUEsTUFBQTtBQUFBLElBQ3ZGO0FBRUYsZUFBVyxRQUFRLE9BQU87QUFDeEIsVUFBSSxTQUFTLFlBQVk7QUFFdkI7QUFBQSxNQUFBO0FBRUksWUFBQSxRQUFRLE1BQU0sSUFBSTtBQUNkLGdCQUFBLElBQUksSUFBSSxXQUFXLE1BQU0sTUFBTSxPQUFPLFVBQVUsSUFBSSxHQUFHLE9BQU8sU0FBUyxLQUFLO0FBQUEsSUFBQTtBQUFBLEVBRTFGO0FBb0ZBLFdBQVMsZUFBZSxNQUFNO0FBQ3JCLFdBQUEsS0FBSyxZQUFZLEVBQUUsUUFBUSxhQUFhLENBQUMsR0FBRyxNQUFNLEVBQUUsYUFBYTtBQUFBLEVBQzFFO0FBQ0EsV0FBUyxlQUFlLE1BQU0sS0FBSyxPQUFPO0FBQ3hDLFVBQU0sYUFBYSxJQUFJLEtBQUssRUFBRSxNQUFNLEtBQUs7QUFDekMsYUFBUyxJQUFJLEdBQUcsVUFBVSxXQUFXLFFBQVEsSUFBSSxTQUFTLElBQUssTUFBSyxVQUFVLE9BQU8sV0FBVyxDQUFDLEdBQUcsS0FBSztBQUFBLEVBQzNHO0FBQ0EsV0FBUyxXQUFXLE1BQU0sTUFBTSxPQUFPLE1BQU0sT0FBTyxTQUFTLE9BQU87QUFDOUQsUUFBQSxNQUFNLFFBQVEsYUFBYSxXQUFXO0FBQzFDLFFBQUksU0FBUyxRQUFTLFFBQU8sTUFBTSxNQUFNLE9BQU8sSUFBSTtBQUNwRCxRQUFJLFNBQVMsWUFBYSxRQUFPLFVBQVUsTUFBTSxPQUFPLElBQUk7QUFDeEQsUUFBQSxVQUFVLEtBQWEsUUFBQTtBQUMzQixRQUFJLFNBQVMsT0FBTztBQUNkLFVBQUEsQ0FBQyxRQUFTLE9BQU0sSUFBSTtBQUFBLElBQUEsV0FDZixLQUFLLE1BQU0sR0FBRyxDQUFDLE1BQU0sT0FBTztBQUMvQixZQUFBLElBQUksS0FBSyxNQUFNLENBQUM7QUFDdEIsY0FBUSxLQUFLLG9CQUFvQixHQUFHLE1BQU0sT0FBTyxTQUFTLGNBQWMsSUFBSTtBQUM1RSxlQUFTLEtBQUssaUJBQWlCLEdBQUcsT0FBTyxPQUFPLFVBQVUsY0FBYyxLQUFLO0FBQUEsSUFBQSxXQUNwRSxLQUFLLE1BQU0sR0FBRyxFQUFFLE1BQU0sY0FBYztBQUN2QyxZQUFBLElBQUksS0FBSyxNQUFNLEVBQUU7QUFDdkIsY0FBUSxLQUFLLG9CQUFvQixHQUFHLE1BQU0sSUFBSTtBQUM5QyxlQUFTLEtBQUssaUJBQWlCLEdBQUcsT0FBTyxJQUFJO0FBQUEsSUFBQSxXQUNwQyxLQUFLLE1BQU0sR0FBRyxDQUFDLE1BQU0sTUFBTTtBQUNwQyxZQUFNLE9BQU8sS0FBSyxNQUFNLENBQUMsRUFBRSxZQUFZO0FBQ2pDLFlBQUEsV0FBVyxnQkFBZ0IsSUFBSSxJQUFJO0FBQ3JDLFVBQUEsQ0FBQyxZQUFZLE1BQU07QUFDckIsY0FBTSxJQUFJLE1BQU0sUUFBUSxJQUFJLElBQUksS0FBSyxDQUFDLElBQUk7QUFDckMsYUFBQSxvQkFBb0IsTUFBTSxDQUFDO0FBQUEsTUFBQTtBQUVsQyxVQUFJLFlBQVksT0FBTztBQUNKQSwyQkFBQSxNQUFNLE1BQU0sT0FBTyxRQUFRO0FBQ2hDLG9CQUFBLGVBQWUsQ0FBQyxJQUFJLENBQUM7QUFBQSxNQUFBO0FBQUEsSUFDbkMsV0FDUyxLQUFLLE1BQU0sR0FBRyxDQUFDLE1BQU0sU0FBUztBQUN2QyxtQkFBYSxNQUFNLEtBQUssTUFBTSxDQUFDLEdBQUcsS0FBSztBQUFBLElBQUEsV0FDOUIsS0FBSyxNQUFNLEdBQUcsQ0FBQyxNQUFNLFNBQVM7QUFDdkMsdUJBQWlCLE1BQU0sS0FBSyxNQUFNLENBQUMsR0FBRyxLQUFLO0FBQUEsSUFBQSxZQUNqQyxZQUFZLEtBQUssTUFBTSxHQUFHLENBQUMsTUFBTSxhQUFhLGNBQWMsZ0JBQWdCLElBQUksSUFBSSxRQUFrQixZQUFZLGFBQWEsTUFBTSxLQUFLLE9BQU8sT0FBTyxTQUFTLFdBQVcsSUFBSSxJQUFJLFFBQVEsT0FBTyxLQUFLLFNBQVMsU0FBUyxHQUFHLEtBQUssUUFBUSxRQUFRO0FBQzVQLFVBQUksV0FBVztBQUNOLGVBQUEsS0FBSyxNQUFNLENBQUM7QUFDVixpQkFBQTtBQUFBLE1BQUE7QUFFWCxVQUFJLFNBQVMsV0FBVyxTQUFTLFlBQWEsV0FBVSxNQUFNLEtBQUs7QUFBQSxlQUFXLFFBQVEsQ0FBQyxVQUFVLENBQUMsWUFBa0IsTUFBQSxlQUFlLElBQUksQ0FBQyxJQUFJO0FBQUEsVUFBVyxNQUFLLGFBQWEsSUFBSSxJQUFJO0FBQUEsSUFBQSxPQUM1SzttQkFFMkQsTUFBTSxRQUFRLElBQUksS0FBSyxNQUFNLEtBQUs7QUFBQSxJQUFBO0FBRTdGLFdBQUE7QUFBQSxFQUNUO0FBQ0EsV0FBUyxhQUFhLEdBQUc7QUFJdkIsUUFBSSxPQUFPLEVBQUU7QUFDUCxVQUFBLE1BQU0sS0FBSyxFQUFFLElBQUk7QUFDdkIsVUFBTSxZQUFZLEVBQUU7QUFDcEIsVUFBTSxtQkFBbUIsRUFBRTtBQUMzQixVQUFNLFdBQVcsQ0FBQSxVQUFTLE9BQU8sZUFBZSxHQUFHLFVBQVU7QUFBQSxNQUMzRCxjQUFjO0FBQUEsTUFDZDtBQUFBLElBQUEsQ0FDRDtBQUNELFVBQU0sYUFBYSxNQUFNO0FBQ2pCLFlBQUEsVUFBVSxLQUFLLEdBQUc7QUFDcEIsVUFBQSxXQUFXLENBQUMsS0FBSyxVQUFVO0FBQzdCLGNBQU0sT0FBTyxLQUFLLEdBQUcsR0FBRyxNQUFNO0FBQ3JCLGlCQUFBLFNBQVksUUFBUSxLQUFLLE1BQU0sTUFBTSxDQUFDLElBQUksUUFBUSxLQUFLLE1BQU0sQ0FBQztBQUN2RSxZQUFJLEVBQUUsYUFBYztBQUFBLE1BQUE7QUFFdEIsV0FBSyxRQUFRLE9BQU8sS0FBSyxTQUFTLFlBQVksQ0FBQyxLQUFLLEtBQUssVUFBVSxLQUFLLFNBQVMsRUFBRSxNQUFNLEtBQUssU0FBUyxLQUFLLElBQUk7QUFDekcsYUFBQTtBQUFBLElBQ1Q7QUFDQSxVQUFNLGFBQWEsTUFBTTtBQUNoQixhQUFBLFdBQUEsTUFBaUIsT0FBTyxLQUFLLFVBQVUsS0FBSyxjQUFjLEtBQUssTUFBTTtBQUFBLElBQzlFO0FBQ08sV0FBQSxlQUFlLEdBQUcsaUJBQWlCO0FBQUEsTUFDeEMsY0FBYztBQUFBLE1BQ2QsTUFBTTtBQUNKLGVBQU8sUUFBUTtBQUFBLE1BQUE7QUFBQSxJQUNqQixDQUNEO0FBRUQsUUFBSSxFQUFFLGNBQWM7QUFDWixZQUFBLE9BQU8sRUFBRSxhQUFhO0FBQ25CLGVBQUEsS0FBSyxDQUFDLENBQUM7QUFDaEIsZUFBUyxJQUFJLEdBQUcsSUFBSSxLQUFLLFNBQVMsR0FBRyxLQUFLO0FBQ3hDLGVBQU8sS0FBSyxDQUFDO0FBQ1QsWUFBQSxDQUFDLGFBQWM7QUFDbkIsWUFBSSxLQUFLLFFBQVE7QUFDZixpQkFBTyxLQUFLO0FBQ0QscUJBQUE7QUFDWDtBQUFBLFFBQUE7QUFFRSxZQUFBLEtBQUssZUFBZSxrQkFBa0I7QUFDeEM7QUFBQSxRQUFBO0FBQUEsTUFDRjtBQUFBLFVBR1ksWUFBQTtBQUNoQixhQUFTLFNBQVM7QUFBQSxFQUNwQjtBQUNBLFdBQVMsaUJBQWlCLFFBQVEsT0FBTyxTQUFTLFFBQVEsYUFBYTtBQVdyRSxXQUFPLE9BQU8sWUFBWSxXQUFZLFdBQVUsUUFBUTtBQUNwRCxRQUFBLFVBQVUsUUFBZ0IsUUFBQTtBQUM5QixVQUFNLElBQUksT0FBTyxPQUNmLFFBQVEsV0FBVztBQUNyQixhQUFTLFNBQVMsUUFBUSxDQUFDLEtBQUssUUFBUSxDQUFDLEVBQUUsY0FBYztBQUNyRCxRQUFBLE1BQU0sWUFBWSxNQUFNLFVBQVU7QUFFcEMsVUFBSSxNQUFNLFVBQVU7QUFDbEIsZ0JBQVEsTUFBTSxTQUFTO0FBQ25CLFlBQUEsVUFBVSxRQUFnQixRQUFBO0FBQUEsTUFBQTtBQUVoQyxVQUFJLE9BQU87QUFDTCxZQUFBLE9BQU8sUUFBUSxDQUFDO0FBQ2hCLFlBQUEsUUFBUSxLQUFLLGFBQWEsR0FBRztBQUMxQixlQUFBLFNBQVMsVUFBVSxLQUFLLE9BQU87QUFBQSxRQUMvQixNQUFBLFFBQU8sU0FBUyxlQUFlLEtBQUs7QUFDM0Msa0JBQVUsY0FBYyxRQUFRLFNBQVMsUUFBUSxJQUFJO0FBQUEsTUFBQSxPQUNoRDtBQUNMLFlBQUksWUFBWSxNQUFNLE9BQU8sWUFBWSxVQUFVO0FBQ3ZDLG9CQUFBLE9BQU8sV0FBVyxPQUFPO0FBQUEsUUFBQSxNQUNwQixXQUFBLE9BQU8sY0FBYztBQUFBLE1BQUE7QUFBQSxJQUUvQixXQUFBLFNBQVMsUUFBUSxNQUFNLFdBQVc7QUFFakMsZ0JBQUEsY0FBYyxRQUFRLFNBQVMsTUFBTTtBQUFBLElBQUEsV0FDdEMsTUFBTSxZQUFZO0FBQzNCLHlCQUFtQixNQUFNO0FBQ3ZCLFlBQUksSUFBSSxNQUFNO0FBQ2QsZUFBTyxPQUFPLE1BQU0sV0FBWSxLQUFJLEVBQUU7QUFDdEMsa0JBQVUsaUJBQWlCLFFBQVEsR0FBRyxTQUFTLE1BQU07QUFBQSxNQUFBLENBQ3REO0FBQ0QsYUFBTyxNQUFNO0FBQUEsSUFDSixXQUFBLE1BQU0sUUFBUSxLQUFLLEdBQUc7QUFDL0IsWUFBTSxRQUFRLENBQUM7QUFDZixZQUFNLGVBQWUsV0FBVyxNQUFNLFFBQVEsT0FBTztBQUNyRCxVQUFJLHVCQUF1QixPQUFPLE9BQU8sU0FBUyxXQUFXLEdBQUc7QUFDM0MsMkJBQUEsTUFBTSxVQUFVLGlCQUFpQixRQUFRLE9BQU8sU0FBUyxRQUFRLElBQUksQ0FBQztBQUN6RixlQUFPLE1BQU07QUFBQSxNQUFBO0FBV1gsVUFBQSxNQUFNLFdBQVcsR0FBRztBQUNaLGtCQUFBLGNBQWMsUUFBUSxTQUFTLE1BQU07QUFDL0MsWUFBSSxNQUFjLFFBQUE7QUFBQSxpQkFDVCxjQUFjO0FBQ25CLFlBQUEsUUFBUSxXQUFXLEdBQUc7QUFDWixzQkFBQSxRQUFRLE9BQU8sTUFBTTtBQUFBLFFBQzVCLE1BQUEsaUJBQWdCLFFBQVEsU0FBUyxLQUFLO0FBQUEsTUFBQSxPQUN4QztBQUNMLG1CQUFXLGNBQWMsTUFBTTtBQUMvQixvQkFBWSxRQUFRLEtBQUs7QUFBQSxNQUFBO0FBRWpCLGdCQUFBO0FBQUEsSUFBQSxXQUNELE1BQU0sVUFBVTtBQUVyQixVQUFBLE1BQU0sUUFBUSxPQUFPLEdBQUc7QUFDMUIsWUFBSSxNQUFjLFFBQUEsVUFBVSxjQUFjLFFBQVEsU0FBUyxRQUFRLEtBQUs7QUFDMUQsc0JBQUEsUUFBUSxTQUFTLE1BQU0sS0FBSztBQUFBLE1BQUEsV0FDakMsV0FBVyxRQUFRLFlBQVksTUFBTSxDQUFDLE9BQU8sWUFBWTtBQUNsRSxlQUFPLFlBQVksS0FBSztBQUFBLE1BQ25CLE1BQUEsUUFBTyxhQUFhLE9BQU8sT0FBTyxVQUFVO0FBQ3pDLGdCQUFBO0FBQUEsSUFDTCxNQUFBLFNBQVEsS0FBSyx5Q0FBeUMsS0FBSztBQUMzRCxXQUFBO0FBQUEsRUFDVDtBQUNBLFdBQVMsdUJBQXVCLFlBQVksT0FBTyxTQUFTLFFBQVE7QUFDbEUsUUFBSSxVQUFVO0FBQ2QsYUFBUyxJQUFJLEdBQUcsTUFBTSxNQUFNLFFBQVEsSUFBSSxLQUFLLEtBQUs7QUFDNUMsVUFBQSxPQUFPLE1BQU0sQ0FBQyxHQUNoQixPQUFPLFdBQVcsUUFBUSxXQUFXLE1BQU0sR0FDM0M7QUFDRixVQUFJLFFBQVEsUUFBUSxTQUFTLFFBQVEsU0FBUyxNQUFPO0FBQUEsZ0JBQVksSUFBSSxPQUFPLFVBQVUsWUFBWSxLQUFLLFVBQVU7QUFDL0csbUJBQVcsS0FBSyxJQUFJO0FBQUEsTUFDWCxXQUFBLE1BQU0sUUFBUSxJQUFJLEdBQUc7QUFDOUIsa0JBQVUsdUJBQXVCLFlBQVksTUFBTSxJQUFJLEtBQUs7QUFBQSxNQUFBLFdBQ25ELE1BQU0sWUFBWTtBQUMzQixZQUFJLFFBQVE7QUFDVixpQkFBTyxPQUFPLFNBQVMsV0FBWSxRQUFPLEtBQUs7QUFDL0Msb0JBQVUsdUJBQXVCLFlBQVksTUFBTSxRQUFRLElBQUksSUFBSSxPQUFPLENBQUMsSUFBSSxHQUFHLE1BQU0sUUFBUSxJQUFJLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLO0FBQUEsUUFBQSxPQUNySDtBQUNMLHFCQUFXLEtBQUssSUFBSTtBQUNWLG9CQUFBO0FBQUEsUUFBQTtBQUFBLE1BQ1osT0FDSztBQUNDLGNBQUEsUUFBUSxPQUFPLElBQUk7QUFDckIsWUFBQSxRQUFRLEtBQUssYUFBYSxLQUFLLEtBQUssU0FBUyxNQUFrQixZQUFBLEtBQUssSUFBSTtBQUFBLFlBQWtCLFlBQUEsS0FBSyxTQUFTLGVBQWUsS0FBSyxDQUFDO0FBQUEsTUFBQTtBQUFBLElBQ25JO0FBRUssV0FBQTtBQUFBLEVBQ1Q7QUFDQSxXQUFTLFlBQVksUUFBUSxPQUFPLFNBQVMsTUFBTTtBQUNqRCxhQUFTLElBQUksR0FBRyxNQUFNLE1BQU0sUUFBUSxJQUFJLEtBQUssSUFBWSxRQUFBLGFBQWEsTUFBTSxDQUFDLEdBQUcsTUFBTTtBQUFBLEVBQ3hGO0FBQ0EsV0FBUyxjQUFjLFFBQVEsU0FBUyxRQUFRLGFBQWE7QUFDM0QsUUFBSSxXQUFXLE9BQWtCLFFBQUEsT0FBTyxjQUFjO0FBQ3RELFVBQU0sT0FBTyxlQUFlLFNBQVMsZUFBZSxFQUFFO0FBQ3RELFFBQUksUUFBUSxRQUFRO0FBQ2xCLFVBQUksV0FBVztBQUNmLGVBQVMsSUFBSSxRQUFRLFNBQVMsR0FBRyxLQUFLLEdBQUcsS0FBSztBQUN0QyxjQUFBLEtBQUssUUFBUSxDQUFDO0FBQ3BCLFlBQUksU0FBUyxJQUFJO0FBQ1QsZ0JBQUEsV0FBVyxHQUFHLGVBQWU7QUFDbkMsY0FBSSxDQUFDLFlBQVksQ0FBQyxFQUFjLFlBQUEsT0FBTyxhQUFhLE1BQU0sRUFBRSxJQUFJLE9BQU8sYUFBYSxNQUFNLE1BQU07QUFBQSxjQUFPLGFBQVksR0FBRyxPQUFPO0FBQUEsY0FDN0csWUFBQTtBQUFBLE1BQUE7QUFBQSxJQUVmLE1BQUEsUUFBTyxhQUFhLE1BQU0sTUFBTTtBQUN2QyxXQUFPLENBQUMsSUFBSTtBQUFBLEVBQ2Q7QUNua0JPLFFBQU1DLGNBQVUsc0JBQVcsWUFBWCxtQkFBb0IsWUFBcEIsbUJBQTZCLE1BQ2hELFdBQVcsVUFDWCxXQUFXO0FDRlIsUUFBTSxVQUFVQzs7Ozs7Ozs7O0FDQ3ZCLFFBQUksUUFBUTtBQUVaLFFBQUlDLGdDQUErQixTQUFTLFFBQVE7QUFDbkQsYUFBTyxNQUFNLEtBQUssTUFBTTtBQUFBLElBQ3hCO0FBRUQscUNBQWlCQTs7Ozs7QUNSakIsTUFBSSxVQUFVLENBQUMsUUFBUSxhQUFhLGNBQWM7QUFDaEQsV0FBTyxJQUFJLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFDdEMsVUFBSSxZQUFZLENBQUMsVUFBVTtBQUN6QixZQUFJO0FBQ0YsZUFBSyxVQUFVLEtBQUssS0FBSyxDQUFDO0FBQUEsUUFDM0IsU0FBUSxHQUFHO0FBQ1YsaUJBQU8sQ0FBQztBQUFBLFFBQ2hCO0FBQUEsTUFDSztBQUNELFVBQUksV0FBVyxDQUFDLFVBQVU7QUFDeEIsWUFBSTtBQUNGLGVBQUssVUFBVSxNQUFNLEtBQUssQ0FBQztBQUFBLFFBQzVCLFNBQVEsR0FBRztBQUNWLGlCQUFPLENBQUM7QUFBQSxRQUNoQjtBQUFBLE1BQ0s7QUFDRCxVQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsT0FBTyxRQUFRLEVBQUUsS0FBSyxJQUFJLFFBQVEsUUFBUSxFQUFFLEtBQUssRUFBRSxLQUFLLFdBQVcsUUFBUTtBQUMvRixZQUFNLFlBQVksVUFBVSxNQUFNLFFBQVEsV0FBVyxHQUFHLE1BQU07QUFBQSxJQUNsRSxDQUFHO0FBQUEsRUFDSDtBQUlBLFdBQVMsc0JBQXNCLFNBQVM7QUFDdEMsV0FBTyxRQUFRLE1BQU0sTUFBTSxhQUFhO0FBQ3RDLFlBQU0sRUFBRSxNQUFNLE9BQU8sVUFBVSxLQUFLLGdCQUFnQixNQUFLLElBQUs7QUFDOUQsVUFBSSxDQUFDLDZCQUE2QixJQUFJLEdBQUc7QUFDdkMsY0FBTTtBQUFBLFVBQ0osSUFBSSxJQUFJO0FBQUEsUUFDVDtBQUFBLE1BQ1A7QUFDSSxZQUFNLGdCQUFnQixTQUFTLGNBQWMsSUFBSTtBQUNqRCxZQUFNLFNBQVMsY0FBYyxhQUFhLEVBQUUsS0FBSSxDQUFFO0FBQ2xELFlBQU0sa0JBQWtCLFNBQVMsY0FBYyxNQUFNO0FBQ3JELFlBQU0sT0FBTyxTQUFTLGNBQWMsTUFBTTtBQUMxQyxZQUFNLE9BQU8sU0FBUyxjQUFjLE1BQU07QUFDMUMsVUFBSSxLQUFLO0FBQ1AsY0FBTUMsU0FBUSxTQUFTLGNBQWMsT0FBTztBQUM1QyxZQUFJLFNBQVMsS0FBSztBQUNoQixVQUFBQSxPQUFNLGNBQWMsTUFBTSxNQUFNLElBQUksR0FBRyxFQUFFLEtBQUssQ0FBQyxRQUFRLElBQUksS0FBSSxDQUFFO0FBQUEsUUFDekUsT0FBYTtBQUNMLFVBQUFBLE9BQU0sY0FBYyxJQUFJO0FBQUEsUUFDaEM7QUFDTSxhQUFLLFlBQVlBLE1BQUs7QUFBQSxNQUM1QjtBQUNJLHNCQUFnQixZQUFZLElBQUk7QUFDaEMsc0JBQWdCLFlBQVksSUFBSTtBQUNoQyxhQUFPLFlBQVksZUFBZTtBQUNsQyxVQUFJLGVBQWU7QUFDakIsY0FBTSxhQUFhLE1BQU0sUUFBUSxhQUFhLElBQUksZ0JBQWdCLENBQUMsV0FBVyxTQUFTLFVBQVU7QUFDakcsbUJBQVcsUUFBUSxDQUFDLGNBQWM7QUFDaEMsZUFBSyxpQkFBaUIsV0FBVyxDQUFDLE1BQU0sRUFBRSxpQkFBaUI7QUFBQSxRQUNuRSxDQUFPO0FBQUEsTUFDUDtBQUNJLGFBQU87QUFBQSxRQUNMO0FBQUEsUUFDQTtBQUFBLFFBQ0EsaUJBQWlCO0FBQUEsTUFDbEI7QUFBQSxJQUNMLENBQUc7QUFBQSxFQUNIO0FDNURBLFFBQU0sVUFBVSxPQUFPLE1BQU07QUFFN0IsTUFBSSxhQUFhO0FBQUEsRUFFRixNQUFNLG9CQUFvQixJQUFJO0FBQUEsSUFDNUMsY0FBYztBQUNiLFlBQU87QUFFUCxXQUFLLGdCQUFnQixvQkFBSSxRQUFTO0FBQ2xDLFdBQUssZ0JBQWdCLG9CQUFJO0FBQ3pCLFdBQUssY0FBYyxvQkFBSSxJQUFLO0FBRTVCLFlBQU0sQ0FBQyxLQUFLLElBQUk7QUFDaEIsVUFBSSxVQUFVLFFBQVEsVUFBVSxRQUFXO0FBQzFDO0FBQUEsTUFDSDtBQUVFLFVBQUksT0FBTyxNQUFNLE9BQU8sUUFBUSxNQUFNLFlBQVk7QUFDakQsY0FBTSxJQUFJLFVBQVUsT0FBTyxRQUFRLGlFQUFpRTtBQUFBLE1BQ3ZHO0FBRUUsaUJBQVcsQ0FBQyxNQUFNLEtBQUssS0FBSyxPQUFPO0FBQ2xDLGFBQUssSUFBSSxNQUFNLEtBQUs7QUFBQSxNQUN2QjtBQUFBLElBQ0E7QUFBQSxJQUVDLGVBQWUsTUFBTSxTQUFTLE9BQU87QUFDcEMsVUFBSSxDQUFDLE1BQU0sUUFBUSxJQUFJLEdBQUc7QUFDekIsY0FBTSxJQUFJLFVBQVUscUNBQXFDO0FBQUEsTUFDNUQ7QUFFRSxZQUFNLGFBQWEsS0FBSyxlQUFlLE1BQU0sTUFBTTtBQUVuRCxVQUFJO0FBQ0osVUFBSSxjQUFjLEtBQUssWUFBWSxJQUFJLFVBQVUsR0FBRztBQUNuRCxvQkFBWSxLQUFLLFlBQVksSUFBSSxVQUFVO0FBQUEsTUFDM0MsV0FBVSxRQUFRO0FBQ2xCLG9CQUFZLENBQUMsR0FBRyxJQUFJO0FBQ3BCLGFBQUssWUFBWSxJQUFJLFlBQVksU0FBUztBQUFBLE1BQzdDO0FBRUUsYUFBTyxFQUFDLFlBQVksVUFBUztBQUFBLElBQy9CO0FBQUEsSUFFQyxlQUFlLE1BQU0sU0FBUyxPQUFPO0FBQ3BDLFlBQU0sY0FBYyxDQUFFO0FBQ3RCLGVBQVMsT0FBTyxNQUFNO0FBQ3JCLFlBQUksUUFBUSxNQUFNO0FBQ2pCLGdCQUFNO0FBQUEsUUFDVjtBQUVHLGNBQU0sU0FBUyxPQUFPLFFBQVEsWUFBWSxPQUFPLFFBQVEsYUFBYSxrQkFBbUIsT0FBTyxRQUFRLFdBQVcsa0JBQWtCO0FBRXJJLFlBQUksQ0FBQyxRQUFRO0FBQ1osc0JBQVksS0FBSyxHQUFHO0FBQUEsUUFDcEIsV0FBVSxLQUFLLE1BQU0sRUFBRSxJQUFJLEdBQUcsR0FBRztBQUNqQyxzQkFBWSxLQUFLLEtBQUssTUFBTSxFQUFFLElBQUksR0FBRyxDQUFDO0FBQUEsUUFDdEMsV0FBVSxRQUFRO0FBQ2xCLGdCQUFNLGFBQWEsYUFBYSxZQUFZO0FBQzVDLGVBQUssTUFBTSxFQUFFLElBQUksS0FBSyxVQUFVO0FBQ2hDLHNCQUFZLEtBQUssVUFBVTtBQUFBLFFBQy9CLE9BQVU7QUFDTixpQkFBTztBQUFBLFFBQ1g7QUFBQSxNQUNBO0FBRUUsYUFBTyxLQUFLLFVBQVUsV0FBVztBQUFBLElBQ25DO0FBQUEsSUFFQyxJQUFJLE1BQU0sT0FBTztBQUNoQixZQUFNLEVBQUMsVUFBUyxJQUFJLEtBQUssZUFBZSxNQUFNLElBQUk7QUFDbEQsYUFBTyxNQUFNLElBQUksV0FBVyxLQUFLO0FBQUEsSUFDbkM7QUFBQSxJQUVDLElBQUksTUFBTTtBQUNULFlBQU0sRUFBQyxVQUFTLElBQUksS0FBSyxlQUFlLElBQUk7QUFDNUMsYUFBTyxNQUFNLElBQUksU0FBUztBQUFBLElBQzVCO0FBQUEsSUFFQyxJQUFJLE1BQU07QUFDVCxZQUFNLEVBQUMsVUFBUyxJQUFJLEtBQUssZUFBZSxJQUFJO0FBQzVDLGFBQU8sTUFBTSxJQUFJLFNBQVM7QUFBQSxJQUM1QjtBQUFBLElBRUMsT0FBTyxNQUFNO0FBQ1osWUFBTSxFQUFDLFdBQVcsV0FBVSxJQUFJLEtBQUssZUFBZSxJQUFJO0FBQ3hELGFBQU8sUUFBUSxhQUFhLE1BQU0sT0FBTyxTQUFTLEtBQUssS0FBSyxZQUFZLE9BQU8sVUFBVSxDQUFDO0FBQUEsSUFDNUY7QUFBQSxJQUVDLFFBQVE7QUFDUCxZQUFNLE1BQU87QUFDYixXQUFLLGNBQWMsTUFBTztBQUMxQixXQUFLLFlBQVksTUFBTztBQUFBLElBQzFCO0FBQUEsSUFFQyxLQUFLLE9BQU8sV0FBVyxJQUFJO0FBQzFCLGFBQU87QUFBQSxJQUNUO0FBQUEsSUFFQyxJQUFJLE9BQU87QUFDVixhQUFPLE1BQU07QUFBQSxJQUNmO0FBQUEsRUFDQTtBQ3RHQSxXQUFTLGNBQWMsT0FBTztBQUM1QixRQUFJLFVBQVUsUUFBUSxPQUFPLFVBQVUsVUFBVTtBQUMvQyxhQUFPO0FBQUEsSUFDWDtBQUNFLFVBQU0sWUFBWSxPQUFPLGVBQWUsS0FBSztBQUM3QyxRQUFJLGNBQWMsUUFBUSxjQUFjLE9BQU8sYUFBYSxPQUFPLGVBQWUsU0FBUyxNQUFNLE1BQU07QUFDckcsYUFBTztBQUFBLElBQ1g7QUFDRSxRQUFJLE9BQU8sWUFBWSxPQUFPO0FBQzVCLGFBQU87QUFBQSxJQUNYO0FBQ0UsUUFBSSxPQUFPLGVBQWUsT0FBTztBQUMvQixhQUFPLE9BQU8sVUFBVSxTQUFTLEtBQUssS0FBSyxNQUFNO0FBQUEsSUFDckQ7QUFDRSxXQUFPO0FBQUEsRUFDVDtBQUVBLFdBQVMsTUFBTSxZQUFZLFVBQVUsWUFBWSxLQUFLLFFBQVE7QUFDNUQsUUFBSSxDQUFDLGNBQWMsUUFBUSxHQUFHO0FBQzVCLGFBQU8sTUFBTSxZQUFZLElBQUksV0FBVyxNQUFNO0FBQUEsSUFDbEQ7QUFDRSxVQUFNLFNBQVMsT0FBTyxPQUFPLENBQUEsR0FBSSxRQUFRO0FBQ3pDLGVBQVcsT0FBTyxZQUFZO0FBQzVCLFVBQUksUUFBUSxlQUFlLFFBQVEsZUFBZTtBQUNoRDtBQUFBLE1BQ047QUFDSSxZQUFNLFFBQVEsV0FBVyxHQUFHO0FBQzVCLFVBQUksVUFBVSxRQUFRLFVBQVUsUUFBUTtBQUN0QztBQUFBLE1BQ047QUFDSSxVQUFJLFVBQVUsT0FBTyxRQUFRLEtBQUssT0FBTyxTQUFTLEdBQUc7QUFDbkQ7QUFBQSxNQUNOO0FBQ0ksVUFBSSxNQUFNLFFBQVEsS0FBSyxLQUFLLE1BQU0sUUFBUSxPQUFPLEdBQUcsQ0FBQyxHQUFHO0FBQ3RELGVBQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxPQUFPLEdBQUcsT0FBTyxHQUFHLENBQUM7QUFBQSxNQUM3QyxXQUFlLGNBQWMsS0FBSyxLQUFLLGNBQWMsT0FBTyxHQUFHLENBQUMsR0FBRztBQUM3RCxlQUFPLEdBQUcsSUFBSTtBQUFBLFVBQ1o7QUFBQSxVQUNBLE9BQU8sR0FBRztBQUFBLFdBQ1QsWUFBWSxHQUFHLFNBQVMsTUFBTSxNQUFNLElBQUksU0FBVTtBQUFBLFVBQ25EO0FBQUEsUUFDRDtBQUFBLE1BQ1AsT0FBVztBQUNMLGVBQU8sR0FBRyxJQUFJO0FBQUEsTUFDcEI7QUFBQSxJQUNBO0FBQ0UsV0FBTztBQUFBLEVBQ1Q7QUFDQSxXQUFTLFdBQVcsUUFBUTtBQUMxQixXQUFPLElBQUk7QUFBQTtBQUFBLE1BRVQsV0FBVyxPQUFPLENBQUMsR0FBRyxNQUFNLE1BQU0sR0FBRyxHQUFHLElBQUksTUFBTSxHQUFHLENBQUUsQ0FBQTtBQUFBO0FBQUEsRUFFM0Q7QUFDQSxRQUFNLE9BQU8sV0FBWTtBQ3REekIsUUFBTSxVQUFVLENBQUMsWUFBWTtBQUMzQixXQUFPLFlBQVksT0FBTyxFQUFFLFlBQVksTUFBTSxRQUFRLFFBQVMsSUFBRyxFQUFFLFlBQVksTUFBTztBQUFBLEVBQ3pGO0FBQ0EsUUFBTSxhQUFhLENBQUMsWUFBWTtBQUM5QixXQUFPLFlBQVksT0FBTyxFQUFFLFlBQVksTUFBTSxRQUFRLEtBQU0sSUFBRyxFQUFFLFlBQVksTUFBTztBQUFBLEVBQ3RGO0FDREEsUUFBTSxvQkFBb0IsT0FBTztBQUFBLElBQy9CLFFBQVEsV0FBVztBQUFBLElBQ25CLGNBQWM7QUFBQSxJQUNkLFVBQVU7QUFBQSxJQUNWLGdCQUFnQjtBQUFBLE1BQ2QsV0FBVztBQUFBLE1BQ1gsU0FBUztBQUFBLE1BQ1QsWUFBWTtBQUFBLElBQ2Q7QUFBQSxJQUNBLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxFQUNqQjtBQUNBLFFBQU0sZUFBZSxDQUFDLGlCQUFpQixtQkFBbUI7QUFDakQsV0FBQSxLQUFLLGlCQUFpQixjQUFjO0FBQUEsRUFDN0M7QUFFQSxRQUFNLGFBQWEsSUFBSSxZQUFZO0FBQ25DLFdBQVMsa0JBQWtCLGlCQUFpQjtBQUNwQyxVQUFBLEVBQUUsbUJBQW1CO0FBQ3BCLFdBQUEsQ0FBQyxVQUFVLFlBQVk7QUFDdEIsWUFBQTtBQUFBLFFBQ0o7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQUEsSUFDRSxhQUFhLFNBQVMsY0FBYztBQUN4QyxZQUFNLGtCQUFrQjtBQUFBLFFBQ3RCO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUNNLFlBQUEsZ0JBQWdCLFdBQVcsSUFBSSxlQUFlO0FBQ3BELFVBQUksZ0JBQWdCLGVBQWU7QUFDMUIsZUFBQTtBQUFBLE1BQUE7QUFFVCxZQUFNLGdCQUFnQixJQUFJO0FBQUE7QUFBQSxRQUV4QixPQUFPLFNBQVMsV0FBVztBQUN6QixjQUFJLGlDQUFRLFNBQVM7QUFDWixtQkFBQSxPQUFPLE9BQU8sTUFBTTtBQUFBLFVBQUE7QUFFN0IsZ0JBQU0sV0FBVyxJQUFJO0FBQUEsWUFDbkIsT0FBTyxjQUFjO0FBQ25CLHlCQUFXLEtBQUssV0FBVztBQUN6QixvQkFBSSxpQ0FBUSxTQUFTO0FBQ25CLDJCQUFTLFdBQVc7QUFDcEI7QUFBQSxnQkFBQTtBQUVJLHNCQUFBLGdCQUFnQixNQUFNLGNBQWM7QUFBQSxrQkFDeEM7QUFBQSxrQkFDQTtBQUFBLGtCQUNBO0FBQUEsa0JBQ0E7QUFBQSxnQkFBQSxDQUNEO0FBQ0Qsb0JBQUksY0FBYyxZQUFZO0FBQzVCLDJCQUFTLFdBQVc7QUFDcEIsMEJBQVEsY0FBYyxNQUFNO0FBQzVCO0FBQUEsZ0JBQUE7QUFBQSxjQUNGO0FBQUEsWUFDRjtBQUFBLFVBRUo7QUFDUSwyQ0FBQTtBQUFBLFlBQ047QUFBQSxZQUNBLE1BQU07QUFDSix1QkFBUyxXQUFXO0FBQ2IscUJBQUEsT0FBTyxPQUFPLE1BQU07QUFBQSxZQUM3QjtBQUFBLFlBQ0EsRUFBRSxNQUFNLEtBQUs7QUFBQTtBQUVULGdCQUFBLGVBQWUsTUFBTSxjQUFjO0FBQUEsWUFDdkM7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUFBLENBQ0Q7QUFDRCxjQUFJLGFBQWEsWUFBWTtBQUNwQixtQkFBQSxRQUFRLGFBQWEsTUFBTTtBQUFBLFVBQUE7QUFFM0IsbUJBQUEsUUFBUSxRQUFRLGNBQWM7QUFBQSxRQUFBO0FBQUEsTUFFM0MsRUFBRSxRQUFRLE1BQU07QUFDZCxtQkFBVyxPQUFPLGVBQWU7QUFBQSxNQUFBLENBQ2xDO0FBQ1UsaUJBQUEsSUFBSSxpQkFBaUIsYUFBYTtBQUN0QyxhQUFBO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFDQSxpQkFBZSxjQUFjO0FBQUEsSUFDM0I7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGLEdBQUc7QUFDRCxVQUFNLFVBQVUsZ0JBQWdCLGNBQWMsUUFBUSxJQUFJLE9BQU8sY0FBYyxRQUFRO0FBQ2hGLFdBQUEsTUFBTSxTQUFTLE9BQU87QUFBQSxFQUMvQjtBQUNBLFFBQU0sY0FBYyxrQkFBa0I7QUFBQSxJQUNwQyxnQkFBZ0Isa0JBQWtCO0FBQUEsRUFDcEMsQ0FBQztBQzdHRCxXQUFTQyxRQUFNLFdBQVcsTUFBTTtBQUU5QixRQUFJLE9BQU8sS0FBSyxDQUFDLE1BQU0sVUFBVTtBQUN6QixZQUFBLFVBQVUsS0FBSyxNQUFNO0FBQzNCLGFBQU8sU0FBUyxPQUFPLElBQUksR0FBRyxJQUFJO0FBQUEsSUFBQSxPQUM3QjtBQUNFLGFBQUEsU0FBUyxHQUFHLElBQUk7QUFBQSxJQUFBO0FBQUEsRUFFM0I7QUFDTyxRQUFNQyxXQUFTO0FBQUEsSUFDcEIsT0FBTyxJQUFJLFNBQVNELFFBQU0sUUFBUSxPQUFPLEdBQUcsSUFBSTtBQUFBLElBQ2hELEtBQUssSUFBSSxTQUFTQSxRQUFNLFFBQVEsS0FBSyxHQUFHLElBQUk7QUFBQSxJQUM1QyxNQUFNLElBQUksU0FBU0EsUUFBTSxRQUFRLE1BQU0sR0FBRyxJQUFJO0FBQUEsSUFDOUMsT0FBTyxJQUFJLFNBQVNBLFFBQU0sUUFBUSxPQUFPLEdBQUcsSUFBSTtBQUFBLEVBQ2xEO0FDUk8sV0FBUyxjQUFjLE1BQU0sbUJBQW1CLFNBQVM7O0FBQzlELFFBQUksUUFBUSxhQUFhLFNBQVU7QUFDbkMsUUFBSSxRQUFRLFVBQVUsS0FBTSxNQUFLLE1BQU0sU0FBUyxPQUFPLFFBQVEsTUFBTTtBQUNyRSxTQUFLLE1BQU0sV0FBVztBQUN0QixTQUFLLE1BQU0sV0FBVztBQUN0QixTQUFLLE1BQU0sUUFBUTtBQUNuQixTQUFLLE1BQU0sU0FBUztBQUNwQixTQUFLLE1BQU0sVUFBVTtBQUNyQixRQUFJLG1CQUFtQjtBQUNyQixVQUFJLFFBQVEsYUFBYSxXQUFXO0FBQ2xDLDBCQUFrQixNQUFNLFdBQVc7QUFDbkMsYUFBSUUsTUFBQSxRQUFRLGNBQVIsZ0JBQUFBLElBQW1CLFdBQVc7QUFDaEMsNEJBQWtCLE1BQU0sU0FBUztBQUFBLFlBQzlCLG1CQUFrQixNQUFNLE1BQU07QUFDbkMsYUFBSUMsTUFBQSxRQUFRLGNBQVIsZ0JBQUFBLElBQW1CLFNBQVM7QUFDOUIsNEJBQWtCLE1BQU0sUUFBUTtBQUFBLFlBQzdCLG1CQUFrQixNQUFNLE9BQU87QUFBQSxNQUMxQyxPQUFXO0FBQ0wsMEJBQWtCLE1BQU0sV0FBVztBQUNuQywwQkFBa0IsTUFBTSxNQUFNO0FBQzlCLDBCQUFrQixNQUFNLFNBQVM7QUFDakMsMEJBQWtCLE1BQU0sT0FBTztBQUMvQiwwQkFBa0IsTUFBTSxRQUFRO0FBQUEsTUFDdEM7QUFBQSxJQUNBO0FBQUEsRUFDQTtBQUNPLFdBQVMsVUFBVSxTQUFTO0FBQ2pDLFFBQUksUUFBUSxVQUFVLEtBQU0sUUFBTyxTQUFTO0FBQzVDLFFBQUksV0FBVyxPQUFPLFFBQVEsV0FBVyxhQUFhLFFBQVEsV0FBVyxRQUFRO0FBQ2pGLFFBQUksT0FBTyxhQUFhLFVBQVU7QUFDaEMsVUFBSSxTQUFTLFdBQVcsR0FBRyxHQUFHO0FBQzVCLGNBQU1iLFVBQVMsU0FBUztBQUFBLFVBQ3RCO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBLFlBQVk7QUFBQSxVQUNaO0FBQUEsUUFDRDtBQUNELGVBQU9BLFFBQU8sbUJBQW1CO0FBQUEsTUFDdkMsT0FBVztBQUNMLGVBQU8sU0FBUyxjQUFjLFFBQVEsS0FBSztBQUFBLE1BQ2pEO0FBQUEsSUFDQTtBQUNFLFdBQU8sWUFBWTtBQUFBLEVBQ3JCO0FBQ08sV0FBUyxRQUFRLE1BQU0sU0FBUzs7QUFDckMsVUFBTSxTQUFTLFVBQVUsT0FBTztBQUNoQyxRQUFJLFVBQVU7QUFDWixZQUFNO0FBQUEsUUFDSjtBQUFBLE1BQ0Q7QUFDSCxZQUFRLFFBQVEsUUFBTTtBQUFBLE1BQ3BCLEtBQUs7QUFBQSxNQUNMLEtBQUs7QUFDSCxlQUFPLE9BQU8sSUFBSTtBQUNsQjtBQUFBLE1BQ0YsS0FBSztBQUNILGVBQU8sUUFBUSxJQUFJO0FBQ25CO0FBQUEsTUFDRixLQUFLO0FBQ0gsZUFBTyxZQUFZLElBQUk7QUFDdkI7QUFBQSxNQUNGLEtBQUs7QUFDSCxTQUFBWSxNQUFBLE9BQU8sa0JBQVAsZ0JBQUFBLElBQXNCLGFBQWEsTUFBTSxPQUFPO0FBQ2hEO0FBQUEsTUFDRixLQUFLO0FBQ0gsU0FBQUMsTUFBQSxPQUFPLGtCQUFQLGdCQUFBQSxJQUFzQixhQUFhLE1BQU07QUFDekM7QUFBQSxNQUNGO0FBQ0UsZ0JBQVEsT0FBTyxRQUFRLElBQUk7QUFDM0I7QUFBQSxJQUNOO0FBQUEsRUFDQTtBQUNPLFdBQVMscUJBQXFCLGVBQWUsU0FBUztBQUMzRCxRQUFJLG9CQUFvQjtBQUN4QixVQUFNLGdCQUFnQixNQUFNO0FBQzFCLDZEQUFtQjtBQUNuQiwwQkFBb0I7QUFBQSxJQUNyQjtBQUNELFVBQU0sUUFBUSxNQUFNO0FBQ2xCLG9CQUFjLE1BQU87QUFBQSxJQUN0QjtBQUNELFVBQU0sVUFBVSxjQUFjO0FBQzlCLFVBQU0sU0FBUyxNQUFNO0FBQ25CLG9CQUFlO0FBQ2Ysb0JBQWMsT0FBUTtBQUFBLElBQ3ZCO0FBQ0QsVUFBTSxZQUFZLENBQUMscUJBQXFCO0FBQ3RDLFVBQUksbUJBQW1CO0FBQ3JCRixpQkFBTyxLQUFLLDJCQUEyQjtBQUFBLE1BQzdDO0FBQ0ksMEJBQW9CO0FBQUEsUUFDbEIsRUFBRSxPQUFPLFNBQVMsY0FBZTtBQUFBLFFBQ2pDO0FBQUEsVUFDRSxHQUFHO0FBQUEsVUFDSCxHQUFHO0FBQUEsUUFDWDtBQUFBLE1BQ0s7QUFBQSxJQUNGO0FBQ0QsV0FBTztBQUFBLE1BQ0w7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFBQSxFQUNIO0FBQ0EsV0FBUyxZQUFZLGFBQWEsU0FBUztBQUN6QyxVQUFNLGtCQUFrQixJQUFJLGdCQUFpQjtBQUM3QyxVQUFNLHVCQUF1QjtBQUM3QixVQUFNLGlCQUFpQixNQUFNOztBQUMzQixzQkFBZ0IsTUFBTSxvQkFBb0I7QUFDMUMsT0FBQUMsTUFBQSxRQUFRLFdBQVIsZ0JBQUFBLElBQUE7QUFBQSxJQUNEO0FBQ0QsUUFBSSxpQkFBaUIsT0FBTyxRQUFRLFdBQVcsYUFBYSxRQUFRLFdBQVcsUUFBUTtBQUN2RixRQUFJLDBCQUEwQixTQUFTO0FBQ3JDLFlBQU07QUFBQSxRQUNKO0FBQUEsTUFDRDtBQUFBLElBQ0w7QUFDRSxtQkFBZSxlQUFlLFVBQVU7QUFDdEMsVUFBSSxnQkFBZ0IsQ0FBQyxDQUFDLFVBQVUsT0FBTztBQUN2QyxVQUFJLGVBQWU7QUFDakIsb0JBQVksTUFBTztBQUFBLE1BQ3pCO0FBQ0ksYUFBTyxDQUFDLGdCQUFnQixPQUFPLFNBQVM7QUFDdEMsWUFBSTtBQUNGLGdCQUFNLGdCQUFnQixNQUFNLFlBQVksWUFBWSxRQUFRO0FBQUEsWUFDMUQsZUFBZSxNQUFNLFVBQVUsT0FBTyxLQUFLO0FBQUEsWUFDM0MsVUFBVSxnQkFBZ0JFLGFBQWlCQztBQUFBQSxZQUMzQyxRQUFRLGdCQUFnQjtBQUFBLFVBQ2xDLENBQVM7QUFDRCwwQkFBZ0IsQ0FBQyxDQUFDO0FBQ2xCLGNBQUksZUFBZTtBQUNqQix3QkFBWSxNQUFPO0FBQUEsVUFDN0IsT0FBZTtBQUNMLHdCQUFZLFFBQVM7QUFDckIsZ0JBQUksUUFBUSxNQUFNO0FBQ2hCLDBCQUFZLGNBQWU7QUFBQSxZQUN2QztBQUFBLFVBQ0E7QUFBQSxRQUNPLFNBQVEsT0FBTztBQUNkLGNBQUksZ0JBQWdCLE9BQU8sV0FBVyxnQkFBZ0IsT0FBTyxXQUFXLHNCQUFzQjtBQUM1RjtBQUFBLFVBQ1YsT0FBZTtBQUNMLGtCQUFNO0FBQUEsVUFDaEI7QUFBQSxRQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0E7QUFDRSxtQkFBZSxjQUFjO0FBQzdCLFdBQU8sRUFBRSxlQUFlLGVBQWdCO0FBQUEsRUFDMUM7QUM1Sk8sV0FBUyxtQkFBbUIsS0FBSztBQUN0QyxRQUFJLFlBQVk7QUFDaEIsUUFBSSxjQUFjO0FBQ2xCLFVBQU0sYUFBYTtBQUNuQixRQUFJO0FBQ0osWUFBUSxRQUFRLFdBQVcsS0FBSyxHQUFHLE9BQU8sTUFBTTtBQUM5QyxxQkFBZSxNQUFNLENBQUM7QUFDdEIsa0JBQVksVUFBVSxRQUFRLE1BQU0sQ0FBQyxHQUFHLEVBQUU7QUFBQSxJQUM5QztBQUNFLFdBQU87QUFBQSxNQUNMLGFBQWEsWUFBWSxLQUFNO0FBQUEsTUFDL0IsV0FBVyxVQUFVLEtBQUk7QUFBQSxJQUMxQjtBQUFBLEVBQ0g7QUNSc0IsaUJBQUEsbUJBQW1CLEtBQUssU0FBUzs7QUFDL0MsVUFBQSxhQUFhLEtBQUssU0FBUyxTQUFTLEVBQUUsRUFBRSxVQUFVLEdBQUcsRUFBRTtBQUM3RCxVQUFNLE1BQU0sQ0FBQztBQUNULFFBQUEsQ0FBQyxRQUFRLGVBQWU7QUFDMUIsVUFBSSxLQUFLLDREQUE0RDtBQUFBLElBQUE7QUFFdkUsUUFBSSxRQUFRLEtBQUs7QUFDWCxVQUFBLEtBQUssUUFBUSxHQUFHO0FBQUEsSUFBQTtBQUVsQixVQUFBSCxNQUFBLElBQUksWUFBSixnQkFBQUEsSUFBYSxzQkFBcUIsTUFBTTtBQUNwQyxZQUFBLFdBQVcsTUFBTSxRQUFRO0FBQy9CLFVBQUksS0FBSyxTQUFTLFdBQVcsU0FBUyxPQUFPLENBQUM7QUFBQSxJQUFBO0FBRTFDLFVBQUEsRUFBRSxXQUFXLFlBQUEsSUFBZ0IsbUJBQW1CLElBQUksS0FBSyxJQUFJLEVBQUUsTUFBTTtBQUNyRSxVQUFBO0FBQUEsTUFDSixpQkFBaUI7QUFBQSxNQUNqQixlQUFlO0FBQUEsTUFDZjtBQUFBLElBQ0YsSUFBSSxNQUFNLHNCQUFzQjtBQUFBLE1BQzlCLE1BQU0sUUFBUTtBQUFBLE1BQ2QsS0FBSztBQUFBLFFBQ0gsYUFBYTtBQUFBLE1BQ2Y7QUFBQSxNQUNBLE1BQU0sUUFBUSxRQUFRO0FBQUEsTUFDdEIsZUFBZSxRQUFRO0FBQUEsSUFBQSxDQUN4QjtBQUNVLGVBQUEsYUFBYSx3QkFBd0IsRUFBRTtBQUM5QyxRQUFBO0FBQ0osVUFBTSxRQUFRLE1BQU07QUFDbEIsY0FBUSxZQUFZLE9BQU87QUFDM0Isb0JBQWMsWUFBWSxPQUFPLGNBQWMsTUFBTSxHQUFHLE9BQU87QUFDM0QsVUFBQSxlQUFlLENBQUMsU0FBUztBQUFBLFFBQzNCLDBDQUEwQyxVQUFVO0FBQUEsTUFBQSxHQUNuRDtBQUNLLGNBQUFILFNBQVEsU0FBUyxjQUFjLE9BQU87QUFDNUMsUUFBQUEsT0FBTSxjQUFjO0FBQ2QsUUFBQUEsT0FBQSxhQUFhLG1DQUFtQyxVQUFVO0FBQ2hFLFNBQUMsU0FBUyxRQUFRLFNBQVMsTUFBTSxPQUFPQSxNQUFLO0FBQUEsTUFBQTtBQUUvQyxnQkFBVSxRQUFRLFFBQVEsYUFBYSxRQUFRLFVBQVU7QUFBQSxJQUMzRDtBQUNBLFVBQU0sU0FBUyxNQUFNOztBQUNuQixPQUFBRyxNQUFBLFFBQVEsYUFBUixnQkFBQUEsSUFBQSxjQUFtQjtBQUNuQixpQkFBVyxPQUFPO0FBQ2xCLFlBQU0sZ0JBQWdCLFNBQVM7QUFBQSxRQUM3QiwwQ0FBMEMsVUFBVTtBQUFBLE1BQ3REO0FBQ0EscURBQWU7QUFDZixhQUFPLFlBQVk7QUFDTCxvQkFBQSxZQUFZLFlBQVksU0FBUztBQUNyQyxnQkFBQTtBQUFBLElBQ1o7QUFDQSxVQUFNLGlCQUFpQjtBQUFBLE1BQ3JCO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFDQSxRQUFJLGNBQWMsTUFBTTtBQUNqQixXQUFBO0FBQUEsTUFDTDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxHQUFHO0FBQUEsTUFDSCxJQUFJLFVBQVU7QUFDTCxlQUFBO0FBQUEsTUFBQTtBQUFBLElBRVg7QUFBQSxFQUNGO0FBQ0EsaUJBQWUsVUFBVTtBQUN2QixVQUFNLE1BQU0sUUFBUSxRQUFRLE9BQU8sb0JBQW9CLFNBQTBCLE1BQU07QUFDbkYsUUFBQTtBQUNJLFlBQUEsTUFBTSxNQUFNLE1BQU0sR0FBRztBQUNwQixhQUFBLE1BQU0sSUFBSSxLQUFLO0FBQUEsYUFDZixLQUFLO0FBQ0xELGVBQUE7QUFBQSxRQUNMLDJCQUEyQixHQUFHO0FBQUEsUUFDOUI7QUFBQSxNQUNGO0FBQ08sYUFBQTtBQUFBLElBQUE7QUFBQSxFQUVYO0FDdkZPLFdBQVMsb0JBQW9CSyxhQUFZO0FBQzlDLFdBQU9BO0FBQUEsRUFDVDtBQ0ZBLFdBQVMsRUFBRSxHQUFFO0FBQUMsUUFBSSxHQUFFLEdBQUUsSUFBRTtBQUFHLFFBQUcsWUFBVSxPQUFPLEtBQUcsWUFBVSxPQUFPLEVBQUUsTUFBRztBQUFBLGFBQVUsWUFBVSxPQUFPLEVBQUUsS0FBRyxNQUFNLFFBQVEsQ0FBQyxHQUFFO0FBQUMsVUFBSSxJQUFFLEVBQUU7QUFBTyxXQUFJLElBQUUsR0FBRSxJQUFFLEdBQUUsSUFBSSxHQUFFLENBQUMsTUFBSSxJQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsT0FBSyxNQUFJLEtBQUcsTUFBSyxLQUFHO0FBQUEsSUFBRSxNQUFNLE1BQUksS0FBSyxFQUFFLEdBQUUsQ0FBQyxNQUFJLE1BQUksS0FBRyxNQUFLLEtBQUc7QUFBRyxXQUFPO0FBQUEsRUFBQztBQUFRLFdBQVMsT0FBTTtBQUFDLGFBQVEsR0FBRSxHQUFFLElBQUUsR0FBRSxJQUFFLElBQUcsSUFBRSxVQUFVLFFBQU8sSUFBRSxHQUFFLElBQUksRUFBQyxJQUFFLFVBQVUsQ0FBQyxPQUFLLElBQUUsRUFBRSxDQUFDLE9BQUssTUFBSSxLQUFHLE1BQUssS0FBRztBQUFHLFdBQU87QUFBQSxFQUFDO0FDRXhXLFdBQVMsTUFBTSxRQUFzQjtBQUMxQyxXQUFPLEtBQUssTUFBTTtBQUFBLEVBQ3BCOzs7Ozs7QUMwRUVDLGlCQUFBLENBQUEsT0FBQSxDQUFBOzs7O0FDckVLLFFBQU1DLGFBQTBDQyxDQUFVLFVBQUE7QUFDL0QsWUFBQSxNQUFBO0FBQUEsVUFBQUMsT0FBQUMsU0FBQUMsR0FBQUEsUUFBQUYsS0FBQUcsWUFBQUMsUUFBQUYsTUFBQUMsWUFBQUUsUUFBQUgsTUFBQUksYUFBQUMsUUFBQUYsTUFBQUY7QUFBQUssYUFBQUosT0FLU0wsTUFBQUEsTUFBTVUsVUFBVSxPQUFPVixNQUFNVSxRQUFRLEdBQUc7QUFBQUQsYUFBQUQsT0FVeENSLE1BQUFBLE1BQU1XLFNBQVMsT0FBT1gsTUFBTVcsT0FBTyxHQUFHO0FBQUFDLHlCQUFBQSxNQUFBQSxVQUFBWCxNQWRqQ1ksR0FBRyxzQ0FBc0NiLE1BQU1jLEtBQUssQ0FBQyxDQUFBO0FBQUFiLGFBQUFBO0FBQUFBLElBQUFBLEdBQUE7QUFBQSxFQXNCckU7Ozs7QUNwQmFjLFFBQUFBLFNBQVNBLENBQUNmLFVBQXVCO0FBQzVDLFVBQU0sQ0FBQ2dCLE9BQU9DLE1BQU0sSUFBSUMsV0FBV2xCLE9BQU8sQ0FDeEMsV0FDQSxRQUNBLGFBQ0EsV0FDQSxZQUNBLGFBQ0EsWUFDQSxTQUNBLFVBQVUsQ0FDWDtBQUVLbUIsVUFBQUEsVUFBVUEsTUFBTUgsTUFBTUcsV0FBVztBQUNqQ0MsVUFBQUEsT0FBT0EsTUFBTUosTUFBTUksUUFBUTtBQUVqQyxZQUFBLE1BQUE7QUFBQSxVQUFBbkIsT0FBQW9CLFVBQUE7QUFBQUMsYUFBQXJCLE1BQUFzQixXQUFBO0FBQUEsUUFBQSxJQUVJQyxXQUFRO0FBQUVSLGlCQUFBQSxNQUFNUSxZQUFZUixNQUFNUztBQUFBQSxRQUFPO0FBQUEsUUFBQSxLQUFBLE9BQUEsSUFBQTtBQUFBLGlCQUNsQ1osR0FDTCxrSkFDQTtBQUFBO0FBQUEsWUFFRSxvRkFDRU0sY0FBYztBQUFBLFlBQ2hCLHVGQUNFQSxjQUFjO0FBQUEsWUFDaEIsc0RBQ0VBLGNBQWM7QUFBQSxZQUNoQiwwREFDRUEsY0FBYztBQUFBO0FBQUEsWUFFaEIsdUNBQXVDQyxXQUFXO0FBQUEsWUFDbEQsd0NBQXdDQSxXQUFXO0FBQUEsWUFDbkQsd0NBQXdDQSxXQUFXO0FBQUE7QUFBQSxZQUVuRCxVQUFVSixNQUFNVTtBQUFBQTtBQUFBQSxZQUVoQixlQUFlVixNQUFNUztBQUFBQSxVQUFBQSxHQUV2QlQsTUFBTUYsS0FDUjtBQUFBLFFBQUE7QUFBQSxNQUFDLEdBQ0dHLE1BQU0sR0FBQSxLQUFBO0FBQUFoQixhQUFBQSxNQUFBMEIsZ0JBRVRDLE1BQUk7QUFBQSxRQUFBLElBQUNDLE9BQUk7QUFBQSxpQkFBRWIsTUFBTVM7QUFBQUEsUUFBTztBQUFBLFFBQUEsSUFBQS9DLFdBQUE7QUFBQSxpQkFBQXdCLFNBQUE7QUFBQSxRQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUEsSUFBQTtBQUFBRCxhQUFBQSxNQUFBMEIsZ0JBdUJ4QkMsTUFBSTtBQUFBLFFBQUEsSUFBQ0MsT0FBSTtBQUFFYixpQkFBQUEsTUFBTWMsWUFBWSxDQUFDZCxNQUFNUztBQUFBQSxRQUFPO0FBQUEsUUFBQSxJQUFBL0MsV0FBQTtBQUFBLGlCQUN6Q3NDLE1BQU1jO0FBQUFBLFFBQUFBO0FBQUFBLE1BQVEsQ0FBQSxHQUFBLElBQUE7QUFBQTdCLGFBQUFBLE1BQUEwQixnQkFHaEJDLE1BQUk7QUFBQSxRQUFBLElBQUNDLE9BQUk7QUFBQSxpQkFBRWIsTUFBTXRDO0FBQUFBLFFBQVE7QUFBQSxRQUFBLElBQUFBLFdBQUE7QUFBQSxjQUFBMkIsUUFBQTBCLFVBQUE7QUFBQTFCLGlCQUFBQSxPQUNqQlcsTUFBQUEsTUFBTXRDLFFBQVE7QUFBQTJCLGlCQUFBQTtBQUFBQSxRQUFBQTtBQUFBQSxNQUFBLENBQUEsR0FBQSxJQUFBO0FBQUFKLGFBQUFBLE1BQUEwQixnQkFHdEJDLE1BQUk7QUFBQSxRQUFBLElBQUNDLE9BQUk7QUFBQSxpQkFBRWIsTUFBTWdCO0FBQUFBLFFBQVM7QUFBQSxRQUFBLElBQUF0RCxXQUFBO0FBQUEsaUJBQ3hCc0MsTUFBTWdCO0FBQUFBLFFBQUFBO0FBQUFBLE1BQVMsQ0FBQSxHQUFBLElBQUE7QUFBQS9CLGFBQUFBO0FBQUFBLElBQUFBLEdBQUE7QUFBQSxFQUl4Qjs7O0FDNEpFSCxpQkFBQSxDQUFBLFNBQUEsT0FBQSxDQUFBOzs7O0FDdE9LLFFBQU1tQyxnQkFBZ0RqQyxDQUFVLFVBQUE7QUFDckUsVUFBTSxDQUFDa0Msa0JBQWtCQyxtQkFBbUIsSUFBSUMsYUFBYSxFQUFFO0FBQzNEQyxRQUFBQTtBQUdFQyxVQUFBQSxlQUFlQSxDQUFDQyxjQUFzQjs7QUFDbkN2QyxlQUFBQSxPQUFBQSxNQUFBQSxNQUFNd0MsZUFBTnhDLGdCQUFBQSxJQUFrQnlDLEtBQUtDLENBQUFBLE1BQUtBLEVBQUVILGNBQWNBLGVBQTVDdkMsZ0JBQUFBLElBQXdEVSxVQUFTO0FBQUEsSUFDMUU7QUFHTWlDLFVBQUFBLGdCQUFnQkEsQ0FBQ2pDLFVBQXlCO0FBQzFDQSxVQUFBQSxVQUFVLEtBQU0sUUFBTyxDQUFDO0FBRzVCLFVBQUlBLFNBQVMsSUFBSTtBQUNSLGVBQUE7QUFBQSxVQUFFa0MsT0FBTztBQUFBLFFBQVU7QUFBQSxNQUFBLFdBQ2pCbEMsU0FBUyxJQUFJO0FBQ2YsZUFBQTtBQUFBLFVBQUVrQyxPQUFPO0FBQUEsUUFBVTtBQUFBLE1BQUEsV0FDakJsQyxTQUFTLElBQUk7QUFDZixlQUFBO0FBQUEsVUFBRWtDLE9BQU87QUFBQSxRQUFVO0FBQUEsTUFBQSxXQUNqQmxDLFNBQVMsSUFBSTtBQUNmLGVBQUE7QUFBQSxVQUFFa0MsT0FBTztBQUFBLFFBQVU7QUFBQSxNQUFBLFdBQ2pCbEMsU0FBUyxJQUFJO0FBQ2YsZUFBQTtBQUFBLFVBQUVrQyxPQUFPO0FBQUEsUUFBVTtBQUFBLE1BQUEsT0FDckI7QUFDRSxlQUFBO0FBQUEsVUFBRUEsT0FBTztBQUFBLFFBQVU7QUFBQSxNQUFBO0FBQUEsSUFFOUI7QUFLQUMsaUJBQWEsTUFBTTtBQUNqQixVQUFJLENBQUM3QyxNQUFNOEMsZUFBZSxDQUFDOUMsTUFBTStDLE9BQU9DLFFBQVE7QUFDOUNiLDRCQUFvQixFQUFFO0FBQ3RCO0FBQUEsTUFBQTtBQUdJYyxZQUFBQSxPQUFPakQsTUFBTThDLGNBQWM7QUFDakMsWUFBTUksZ0JBQWdCO0FBQ3RCLFlBQU1DLGVBQWVGLE9BQU9DO0FBRzVCLFVBQUlFLGFBQWE7QUFDakIsZUFBU3RFLElBQUksR0FBR0EsSUFBSWtCLE1BQU0rQyxPQUFPQyxRQUFRbEUsS0FBSztBQUN0Q3VFLGNBQUFBLE9BQU9yRCxNQUFNK0MsT0FBT2pFLENBQUM7QUFDM0IsWUFBSSxDQUFDdUUsS0FBTTtBQUNYLGNBQU1DLFVBQVVELEtBQUtFLFlBQVlGLEtBQUtHLFdBQVc7QUFFakQsWUFBSUwsZ0JBQWdCRSxLQUFLRSxhQUFhSixlQUFlRyxTQUFTO0FBQy9DeEUsdUJBQUFBO0FBQ2I7QUFBQSxRQUFBO0FBQUEsTUFDRjtBQUlFc0UsVUFBQUEsZUFBZSxNQUFNSCxPQUFPLEdBQUc7QUFDakMsaUJBQVNuRSxJQUFJa0IsTUFBTStDLE9BQU9DLFNBQVMsR0FBR2xFLEtBQUssR0FBR0EsS0FBSztBQUMzQ3VFLGdCQUFBQSxPQUFPckQsTUFBTStDLE9BQU9qRSxDQUFDO0FBQzNCLGNBQUksQ0FBQ3VFLEtBQU07QUFDUEosY0FBQUEsUUFBUUksS0FBS0UsV0FBVztBQUNiekUseUJBQUFBO0FBQ2I7QUFBQSxVQUFBO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFJRXNFLFVBQUFBLGVBQWVsQixvQkFBb0I7QUFDckMsY0FBTXVCLFlBQVl2QixpQkFBaUI7QUFFbkMsWUFBSXdCLEtBQUtDLElBQUlQLGFBQWFLLFNBQVMsSUFBSSxHQUFHO0FBQ3hDRyxrQkFBUUMsSUFBSSx5Q0FBeUM7QUFBQSxZQUNuREMsTUFBTUw7QUFBQUEsWUFDTk0sSUFBSVg7QUFBQUEsWUFDSkgsTUFBTWpELE1BQU04QztBQUFBQSxZQUNaa0IsZUFBZWY7QUFBQUEsWUFDZmdCLE1BQU1QLEtBQUtDLElBQUlQLGFBQWFLLFNBQVM7QUFBQSxVQUFBLENBQ3RDO0FBQUEsUUFBQTtBQUlILFlBQUlBLGNBQWMsTUFBTUMsS0FBS0MsSUFBSVAsYUFBYUssU0FBUyxJQUFJLElBQUk7QUFDN0RHLGtCQUFRTSxLQUFLLDZDQUE2QztBQUFBLFlBQ3hESixNQUFNTDtBQUFBQSxZQUNOTSxJQUFJWDtBQUFBQSxZQUNKZSxVQUFVbkUsTUFBTStDLE9BQU9VLFNBQVM7QUFBQSxZQUNoQ1csUUFBUXBFLE1BQU0rQyxPQUFPSyxVQUFVO0FBQUEsVUFBQSxDQUNoQztBQUFBLFFBQUE7QUFHSGpCLDRCQUFvQmlCLFVBQVU7QUFBQSxNQUFBO0FBQUEsSUFDaEMsQ0FDRDtBQUdEUCxpQkFBYSxNQUFNO0FBQ2pCLFlBQU1qRSxTQUFRc0QsaUJBQWlCO0FBQy9CLFVBQUl0RCxXQUFVLE1BQU0sQ0FBQ3lELGdCQUFnQixDQUFDckMsTUFBTXFFLFVBQVc7QUFFakRDLFlBQUFBLGVBQWVqQyxhQUFha0MsaUJBQWlCLG1CQUFtQjtBQUNoRUMsWUFBQUEsaUJBQWlCRixhQUFhMUYsTUFBSztBQUV6QyxVQUFJNEYsZ0JBQWdCO0FBQ2xCLGNBQU1DLGtCQUFrQnBDLGFBQWFxQztBQUNyQyxjQUFNQyxVQUFVSCxlQUFlSTtBQUMvQixjQUFNQyxhQUFhTCxlQUFlTTtBQUdsQyxjQUFNQyxrQkFBa0JKLFVBQVVGLGtCQUFrQixJQUFJSSxhQUFhO0FBRXJFeEMscUJBQWEyQyxTQUFTO0FBQUEsVUFDcEJDLEtBQUtGO0FBQUFBLFVBQ0xHLFVBQVU7QUFBQSxRQUFBLENBQ1g7QUFBQSxNQUFBO0FBQUEsSUFDSCxDQUNEO0FBRUQsWUFBQSxNQUFBO0FBQUEsVUFBQWpGLE9BQUFDLFNBQUFBLEdBQUFDLFFBQUFGLEtBQUFHO0FBQUEsVUFBQStFLFFBRVM5QztBQUFZLGFBQUE4QyxVQUFBQyxhQUFBQSxJQUFBRCxPQUFBbEYsSUFBQSxJQUFab0MsZUFBWXBDO0FBQUFFLGFBQUFBLE9BQUF3QixnQkFRZDBELEtBQUc7QUFBQSxRQUFBLElBQUNDLE9BQUk7QUFBQSxpQkFBRXRGLE1BQU0rQztBQUFBQSxRQUFNO0FBQUEsUUFBQXJFLFVBQ3BCQSxDQUFDMkUsTUFBTXpFLFdBQVU7QUFDaEIsZ0JBQU0yRyxZQUFZQSxNQUFNakQsYUFBYTFELFFBQU87QUFDNUMsZ0JBQU00RyxhQUFhQSxNQUFNN0MsY0FBYzRDLFdBQVc7QUFHbEQsa0JBQUEsTUFBQTtBQUFBLGdCQUFBbEYsUUFBQTBCLFVBQUE7QUFBQTFCLG1CQUFBQSxPQWdCS2dELE1BQUFBLEtBQUtvQyxJQUFJO0FBQUFDLCtCQUFBQyxDQUFBLFFBQUE7QUFBQUMsa0JBQUFBLE1BZE9oSCxVQUFPaUgsT0FDakJoRixHQUNMLGVBQ0EsNEJBQ0FqQyxPQUFBQSxNQUFZc0QsaUJBQUFBLElBQ1IsZ0JBQ0EsWUFDTixHQUFDNEQsT0FFUWxILGFBQVlzRCxzQkFBc0IsQ0FBQ3FELFVBQ3RDLElBQUEsWUFDQUMsYUFBYTVDLFNBQVM7QUFBU2dELHNCQUFBRCxJQUFBSSxLQUFBQyxhQUFBM0YsT0FBQXNGLG1CQUFBQSxJQUFBSSxJQUFBSCxHQUFBO0FBQUFDLHVCQUFBRixJQUFBTSxLQUFBckYsVUFBQVAsT0FBQXNGLElBQUFNLElBQUFKLElBQUE7QUFBQUMsdUJBQUFILElBQUFPLE9BQUFQLElBQUFPLElBQUFKLFNBQUEsT0FBQXpGLE1BQUFmLE1BQUE2RyxZQUFBTCxTQUFBQSxJQUFBLElBQUF6RixNQUFBZixNQUFBOEcsZUFBQSxPQUFBO0FBQUFULHFCQUFBQTtBQUFBQSxZQUFBQSxHQUFBO0FBQUEsY0FBQUksR0FBQU07QUFBQUEsY0FBQUosR0FBQUk7QUFBQUEsY0FBQUgsR0FBQUc7QUFBQUEsWUFBQUEsQ0FBQTtBQUFBaEcsbUJBQUFBO0FBQUFBLFVBQUFBLEdBQUE7QUFBQSxRQUFBO0FBQUEsTUFNM0MsQ0FBQyxDQUFBO0FBQUFPLHlCQUFBQSxNQUFBQSxVQUFBWCxNQWhDRVksR0FDTCxnREFDQSxxQkFDQWIsTUFBTWMsS0FDUixDQUFDLENBQUE7QUFBQWIsYUFBQUE7QUFBQUEsSUFBQUEsR0FBQTtBQUFBLEVBaUNQOzs7QUN4SUVILGlCQUFBLENBQUEsT0FBQSxDQUFBOzs7O0FDekJLLFFBQU13RyxtQkFBc0R0RyxDQUFVLFVBQUE7QUFDM0UsWUFBQSxNQUFBO0FBQUEsVUFBQUMsT0FBQUMsU0FBQTtBQUFBRCxhQUFBQSxNQUFBMEIsZ0JBRUtDLE1BQUk7QUFBQSxRQUFBLElBQ0hDLE9BQUk7QUFBRTdCLGlCQUFBQSxNQUFNdUcsUUFBUXZELFNBQVM7QUFBQSxRQUFDO0FBQUEsUUFBQSxJQUM5QndELFdBQVE7QUFBQSxpQkFBQXpFLFVBQUE7QUFBQSxRQUFBO0FBQUEsUUFBQSxJQUFBckQsV0FBQTtBQUFBLGlCQUFBaUQsZ0JBUVAwRCxLQUFHO0FBQUEsWUFBQSxJQUFDQyxPQUFJO0FBQUEscUJBQUV0RixNQUFNdUc7QUFBQUEsWUFBTztBQUFBLFlBQUE3SCxVQUNwQitILFlBQUssTUFBQTtBQUFBLGtCQUFBcEcsUUFBQWdCLFVBQUFmLEdBQUFBLFFBQUFELE1BQUFEO0FBQUFFLG9CQUFBRjtBQUFBc0csa0JBQUFBLFFBQUFwRyxNQUFBQyxhQUFBb0csUUFBQUQsTUFBQW5HO0FBQUFFLHFCQUFBSCxPQWVDbUcsTUFBQUEsTUFBTTlGLE1BQUksSUFBQTtBQUFBK0YscUJBQUFBLE9BTVhELE1BQUFBLE1BQU1HLFFBQVE7QUFBQW5HLHFCQUFBa0csT0FNZEYsTUFBQUEsTUFBTS9GLE1BQU1tRyxnQkFBZ0I7QUFBQW5CLGlDQUFBQyxDQUFBLFFBQUE7QUFBQSxvQkFBQUMsTUF6QnhCL0UsR0FDTCxrRUFDQTRGLE1BQU1LLGdCQUNGLHlEQUNBLG1DQUNOLEdBQUNqQixPQUdRaEYsR0FDTCx1Q0FDQTRGLE1BQU05RixRQUFRLElBQUksd0JBQXdCLGdCQUM1QyxHQUFDbUYsT0FJVWpGLEdBQ1gsbUJBQ0E0RixNQUFNSyxnQkFBZ0Isb0NBQW9DLGNBQzVELEdBQUNDLE9BR1lsRyxHQUNYLHVCQUNBNEYsTUFBTUssZ0JBQWdCLHdCQUF3QixjQUNoRDtBQUFDbEIsd0JBQUFELElBQUFJLEtBQUFuRixVQUFBUCxPQUFBc0YsSUFBQUksSUFBQUgsR0FBQTtBQUFBQyx5QkFBQUYsSUFBQU0sS0FBQXJGLFVBQUFOLE9BQUFxRixJQUFBTSxJQUFBSixJQUFBO0FBQUFDLHlCQUFBSCxJQUFBTyxLQUFBdEYsVUFBQThGLE9BQUFmLElBQUFPLElBQUFKLElBQUE7QUFBQWlCLHlCQUFBcEIsSUFBQXFCLEtBQUFwRyxVQUFBK0YsT0FBQWhCLElBQUFxQixJQUFBRCxJQUFBO0FBQUFwQix1QkFBQUE7QUFBQUEsY0FBQUEsR0FBQTtBQUFBLGdCQUFBSSxHQUFBTTtBQUFBQSxnQkFBQUosR0FBQUk7QUFBQUEsZ0JBQUFILEdBQUFHO0FBQUFBLGdCQUFBVyxHQUFBWDtBQUFBQSxjQUFBQSxDQUFBO0FBQUFoRyxxQkFBQUE7QUFBQUEsWUFBQSxHQUFBO0FBQUEsVUFBQSxDQUlKO0FBQUEsUUFBQTtBQUFBLE1BQUEsQ0FBQSxDQUFBO0FBQUFPLHlCQUFBQSxNQUFBQSxVQUFBWCxNQTFDS1ksR0FBRywyQkFBMkJiLE1BQU1jLEtBQUssQ0FBQyxDQUFBO0FBQUFiLGFBQUFBO0FBQUFBLElBQUFBLEdBQUE7QUFBQSxFQStDMUQ7Ozs7QUNwREEsUUFBTWdILFNBQTBCLENBQUMsTUFBTSxTQUFTLE1BQU07QUFFL0MsUUFBTUMsY0FBNENsSCxDQUFVLFVBQUE7QUFDakUsVUFBTSxDQUFDbUgsbUJBQW1CQyxvQkFBb0IsSUFBSWhGLGFBQWEsQ0FBQztBQUVoRSxVQUFNaUYsZUFBZUEsTUFBTUosT0FBT0UsbUJBQW1CO0FBRS9DRyxVQUFBQSxhQUFhQSxDQUFDdkIsTUFBa0I7O0FBQ3BDQSxRQUFFd0IsZ0JBQWdCO0FBQ2xCLFlBQU1DLGFBQWFMLGtCQUFzQixJQUFBLEtBQUtGLE9BQU9qRTtBQUNyRG9FLDJCQUFxQkksU0FBUztBQUN4QkMsWUFBQUEsV0FBV1IsT0FBT08sU0FBUztBQUNqQyxVQUFJQyxVQUFVO0FBQ1p6SCxTQUFBQSxNQUFBQSxNQUFNMEgsa0JBQU4xSCxnQkFBQUEsSUFBQUEsWUFBc0J5SDtBQUFBQSxNQUFRO0FBQUEsSUFFbEM7QUFFQSxZQUFBLE1BQUE7QUFBQSxVQUFBeEgsT0FBQUMsU0FBQUMsR0FBQUEsUUFBQUYsS0FBQUcsWUFBQUMsUUFBQUYsTUFBQUksYUFBQUQsUUFBQUQsTUFBQUUsYUFBQUMsUUFBQUYsTUFBQUY7QUFBQXVILHlCQUFBeEgsT0FXZUgsU0FBQUEsTUFBTTRILFNBQU8sSUFBQTtBQUFBdEgsWUFBQXVILFVBa0JiUDtBQUFVN0csYUFBQUQsT0FlVTZHLFlBQVk7QUFBQTNCLHlCQUFBQyxDQUFBLFFBQUE7QUFBQSxZQUFBQyxNQTFDcEMvRSxHQUNMLDBEQUNBLDRDQUNBLCtCQUNBYixNQUFNYyxLQUNSLEdBQUMrRSxPQUtXN0YsTUFBTXdCLFVBQVFzRSxPQUNqQmpGLEdBQ0wsMkVBQ0EsaUNBQ0EsMkNBQ0EsbURBQ0Esc0NBQ0YsR0FBQ2tHLE9BV1MvRyxNQUFNd0IsVUFBUXNHLE9BQ2pCakgsR0FDTCxvREFDQSw0QkFDQSwyQ0FDQSxtREFDQSx3Q0FDQSxtREFDQSx5RkFDQSw0REFDQSwrQ0FDRjtBQUFDK0UsZ0JBQUFELElBQUFJLEtBQUFuRixVQUFBWCxNQUFBMEYsSUFBQUksSUFBQUgsR0FBQTtBQUFBQyxpQkFBQUYsSUFBQU0sTUFBQTlGLE1BQUFxQixXQUFBbUUsSUFBQU0sSUFBQUo7QUFBQUMsaUJBQUFILElBQUFPLEtBQUF0RixVQUFBVCxPQUFBd0YsSUFBQU8sSUFBQUosSUFBQTtBQUFBaUIsaUJBQUFwQixJQUFBcUIsTUFBQTFHLE1BQUFrQixXQUFBbUUsSUFBQXFCLElBQUFEO0FBQUFlLGlCQUFBbkMsSUFBQTdHLEtBQUE4QixVQUFBTixPQUFBcUYsSUFBQTdHLElBQUFnSixJQUFBO0FBQUFuQyxlQUFBQTtBQUFBQSxNQUFBQSxHQUFBO0FBQUEsUUFBQUksR0FBQU07QUFBQUEsUUFBQUosR0FBQUk7QUFBQUEsUUFBQUgsR0FBQUc7QUFBQUEsUUFBQVcsR0FBQVg7QUFBQUEsUUFBQXZILEdBQUF1SDtBQUFBQSxNQUFBQSxDQUFBO0FBQUFwRyxhQUFBQTtBQUFBQSxJQUFBQSxHQUFBO0FBQUEsRUFPVDtBQUFFSCxpQkFBQSxDQUFBLE9BQUEsQ0FBQTs7OztBQ3RDRixRQUFNaUksY0FBY0MsY0FBZ0M7QUFFN0MsUUFBTUMsT0FBb0NqSSxDQUFVLFVBQUE7O0FBQ3pELFVBQU0sQ0FBQ2tJLFdBQVdDLFlBQVksSUFBSS9GLGFBQWFwQyxNQUFNb0ksZ0JBQWNwSSxNQUFBQSxNQUFNcUksS0FBSyxDQUFDLE1BQVpySSxnQkFBQUEsSUFBZXNJLE9BQU0sRUFBRTtBQUdwRkMsVUFBQUEsa0JBQWtCQSxDQUFDRCxPQUFlOztBQUN0Q0gsbUJBQWFHLEVBQUU7QUFDZnRJLE9BQUFBLE1BQUFBLE1BQU13SSxnQkFBTnhJLGdCQUFBQSxJQUFBQSxZQUFvQnNJO0FBQUFBLElBQ3RCO0FBRUEsVUFBTUcsZUFBaUM7QUFBQSxNQUNyQ1A7QUFBQUEsTUFDQUMsY0FBY0k7QUFBQUEsSUFDaEI7QUFFQTVHLFdBQUFBLGdCQUNHb0csWUFBWVcsVUFBUTtBQUFBLE1BQUNsSyxPQUFPaUs7QUFBQUEsTUFBWSxJQUFBL0osV0FBQTtBQUFBLFlBQUF1QixPQUFBQyxTQUFBO0FBQUFELGVBQUFBLE1BRXBDRCxNQUFBQSxNQUFNdEIsUUFBUTtBQUFBa0MsMkJBQUFBLE1BQUFBLFVBQUFYLE1BRExZLEdBQUcsVUFBVWIsTUFBTWMsS0FBSyxDQUFDLENBQUE7QUFBQWIsZUFBQUE7QUFBQUEsTUFBQUE7QUFBQUEsSUFBQSxDQUFBO0FBQUEsRUFLM0M7QUFFTyxRQUFNMEksV0FBc0MzSSxDQUFVLFVBQUE7QUFDM0QsWUFBQSxNQUFBO0FBQUEsVUFBQUcsUUFBQUQsU0FBQTtBQUFBQyxhQUFBQSxPQVFLSCxNQUFBQSxNQUFNdEIsUUFBUTtBQUFBa0MseUJBQUFBLE1BQUFBLFVBQUFULE9BTlJVLEdBQ0wseUZBQ0EsVUFDQWIsTUFBTWMsS0FDUixDQUFDLENBQUE7QUFBQVgsYUFBQUE7QUFBQUEsSUFBQUEsR0FBQTtBQUFBLEVBS1A7QUFFTyxRQUFNeUksY0FBNEM1SSxDQUFVLFVBQUE7QUFDM0Q2SSxVQUFBQSxVQUFVQyxXQUFXZixXQUFXO0FBQ3RDLFFBQUksQ0FBQ2MsU0FBUztBQUNaakYsY0FBUW5GLE1BQU0scUZBQXFGO0FBQzVGLGFBQUE7QUFBQSxJQUFBO0FBR1QsVUFBTXNLLFdBQVdBLE1BQU1GLFFBQVFYLGdCQUFnQmxJLE1BQU14QjtBQUVyRCxZQUFBLE1BQUE7QUFBQSxVQUFBNkIsUUFBQTBCLFVBQUE7QUFBQTFCLFlBQUF3SCxVQUVhLE1BQU1nQixRQUFRVixhQUFhbkksTUFBTXhCLEtBQUs7QUFBQzZCLGFBQUFBLE9BYS9DTCxNQUFBQSxNQUFNdEIsUUFBUTtBQUFBZ0gseUJBQUE5RSxNQUFBQSxVQUFBUCxPQVpSUSxHQUNMLG9GQUNBLHVEQUNBLDZHQUNBLG9EQUNBLFVBQ0FrSSxTQUFBQSxJQUNJLG1DQUNBLHFDQUNKL0ksTUFBTWMsS0FDUixDQUFDLENBQUE7QUFBQVQsYUFBQUE7QUFBQUEsSUFBQUEsR0FBQTtBQUFBLEVBS1A7QUFFTyxRQUFNMkksY0FBNENoSixDQUFVLFVBQUE7QUFDM0Q2SSxVQUFBQSxVQUFVQyxXQUFXZixXQUFXO0FBQ3RDLFFBQUksQ0FBQ2MsU0FBUztBQUNaakYsY0FBUW5GLE1BQU0scUZBQXFGO0FBQzVGLGFBQUE7QUFBQSxJQUFBO0FBR1QsVUFBTXNLLFdBQVdBLE1BQU1GLFFBQVFYLGdCQUFnQmxJLE1BQU14QjtBQUVyRCxXQUFBbUQsZ0JBQ0dDLE1BQUk7QUFBQSxNQUFBLElBQUNDLE9BQUk7QUFBQSxlQUFFa0gsU0FBUztBQUFBLE1BQUM7QUFBQSxNQUFBLElBQUFySyxXQUFBO0FBQUEsWUFBQTRCLFFBQUFKLFNBQUE7QUFBQUksZUFBQUEsT0FRakJOLE1BQUFBLE1BQU10QixRQUFRO0FBQUFrQywyQkFBQUEsTUFBQUEsVUFBQU4sT0FOUk8sR0FDTCx5QkFDQSw2R0FDQWIsTUFBTWMsS0FDUixDQUFDLENBQUE7QUFBQVIsZUFBQUE7QUFBQUEsTUFBQUE7QUFBQUEsSUFBQSxDQUFBO0FBQUEsRUFNVDtBQUFFUixpQkFBQSxDQUFBLE9BQUEsQ0FBQTs7Ozs7Ozs7OztBQ3ZISyxRQUFNbUoscUJBQTBEakosQ0FBVSxVQUFBO0FBQy9FLFVBQU0sQ0FBQ2tKLFVBQVVDLFdBQVcsSUFBSS9HLGFBQWEsS0FBSztBQUNsRCxVQUFNLENBQUNnSCxPQUFPQyxRQUFRLElBQUlqSCxhQUFhLEVBQUU7QUFDekMsUUFBSWtILGdCQUFnQjtBQUNoQkMsUUFBQUE7QUFFSjFHLGlCQUFhLE1BQU07QUFFakIsVUFBSTdDLE1BQU11QyxZQUFZK0csaUJBQWlCdEosTUFBTVUsU0FBUyxJQUFJO0FBRXhEMkksaUJBQVMsS0FBSzNGLEtBQUs4RixPQUFPLElBQUksRUFBRTtBQUNoQ0wsb0JBQVksSUFBSTtBQUdaSSxZQUFBQSx3QkFBd0JBLFNBQVM7QUFHckNBLG9CQUFZRSxXQUFXLE1BQU07QUFDM0JOLHNCQUFZLEtBQUs7QUFBQSxXQUNoQixHQUFJO0FBRVBHLHdCQUFnQnRKLE1BQU11QztBQUFBQSxNQUFBQTtBQUFBQSxJQUN4QixDQUNEO0FBRURtSCxjQUFVLE1BQU07QUFDVkgsVUFBQUEsd0JBQXdCQSxTQUFTO0FBQUEsSUFBQSxDQUN0QztBQUVELFdBQUE1SCxnQkFDR0MsTUFBSTtBQUFBLE1BQUEsSUFBQ0MsT0FBSTtBQUFBLGVBQUVxSCxTQUFTO0FBQUEsTUFBQztBQUFBLE1BQUEsSUFBQXhLLFdBQUE7QUFBQSxZQUFBdUIsT0FBQUMsU0FBQUEsR0FBQUMsUUFBQUYsS0FBQUc7QUFBQWQsY0FBQUEsTUFBQTZHLFlBQUEsYUFBQSxNQUFBO0FBQUFULDJCQUFBQyxDQUFBLFFBQUE7QUFBQSxjQUFBQyxNQUNSL0UsR0FBRzhJLE9BQU9DLGVBQWU1SixNQUFNYyxLQUFLLEdBQUMrRSxPQUV0QzhELE9BQU9FLFdBQVMvRCxPQUVmLEdBQUdzRCxPQUFPO0FBQUd4RCxrQkFBQUQsSUFBQUksS0FBQW5GLFVBQUFYLE1BQUEwRixJQUFBSSxJQUFBSCxHQUFBO0FBQUFDLG1CQUFBRixJQUFBTSxLQUFBckYsVUFBQVQsT0FBQXdGLElBQUFNLElBQUFKLElBQUE7QUFBQUMsbUJBQUFILElBQUFPLE9BQUFQLElBQUFPLElBQUFKLFNBQUEsT0FBQTNGLE1BQUFiLE1BQUE2RyxZQUFBTCxRQUFBQSxJQUFBLElBQUEzRixNQUFBYixNQUFBOEcsZUFBQSxNQUFBO0FBQUFULGlCQUFBQTtBQUFBQSxRQUFBQSxHQUFBO0FBQUEsVUFBQUksR0FBQU07QUFBQUEsVUFBQUosR0FBQUk7QUFBQUEsVUFBQUgsR0FBQUc7QUFBQUEsUUFBQUEsQ0FBQTtBQUFBcEcsZUFBQUE7QUFBQUEsTUFBQUE7QUFBQUEsSUFBQSxDQUFBO0FBQUEsRUFTL0I7Ozs7QUNyQk8sUUFBTTZKLHVCQUE4RDlKLENBQVUsVUFBQTtBQUVuRixVQUFNK0oseUJBQXlCQSxNQUFNO0FBQzdCQyxZQUFBQSxTQUFTaEssTUFBTXdDLGNBQWMsQ0FBRTtBQUNqQ3dILFVBQUFBLE9BQU9oSCxXQUFXLEVBQVUsUUFBQTtBQUFBLFFBQUV0QyxPQUFPO0FBQUEsUUFBRzZCLFdBQVc7QUFBQSxNQUFHO0FBRTFELFlBQU0wSCxTQUFTRCxPQUFPQSxPQUFPaEgsU0FBUyxDQUFDO0FBQ2hDLGFBQUE7QUFBQSxRQUNMdEMsUUFBT3VKLGlDQUFRdkosVUFBUztBQUFBLFFBQ3hCNkIsWUFBVzBILGlDQUFRMUgsY0FBYTtBQUFBLE1BQ2xDO0FBQUEsSUFDRjtBQUVBLFlBQUEsTUFBQTtBQUFBLFVBQUF0QyxPQUFBaUssVUFBQTtBQUFBakssYUFBQUEsTUFBQTBCLGdCQUdLQyxNQUFJO0FBQUEsUUFBQSxJQUFDQyxPQUFJO0FBQUEsaUJBQUUsQ0FBQzdCLE1BQU1xRTtBQUFBQSxRQUFTO0FBQUEsUUFBQSxJQUFBM0YsV0FBQTtBQUFBLGlCQUFBaUQsZ0JBQ3pCNUIsWUFBVTtBQUFBLFlBQUEsSUFDVFcsUUFBSztBQUFBLHFCQUFFVixNQUFNVTtBQUFBQSxZQUFLO0FBQUEsWUFBQSxJQUNsQkMsT0FBSTtBQUFBLHFCQUFFWCxNQUFNVztBQUFBQSxZQUFBQTtBQUFBQSxVQUFJLENBQUE7QUFBQSxRQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUEsSUFBQTtBQUFBVixhQUFBQSxNQUFBMEIsZ0JBS25CQyxNQUFJO0FBQUEsUUFBQSxJQUFDQyxPQUFJO0FBQUEsaUJBQUUsQ0FBQzdCLE1BQU1xRTtBQUFBQSxRQUFTO0FBQUEsUUFBQSxJQUFFbUMsV0FBUTtBQUFBLGtCQUFBLE1BQUE7QUFBQSxnQkFBQUcsUUFBQXdELFVBQUFBLEdBQUFDLFFBQUF6RCxNQUFBdkc7QUFBQWdLLG1CQUFBQSxPQUFBekksZ0JBRy9CTSxlQUFhO0FBQUEsY0FBQSxJQUNaYyxTQUFNO0FBQUEsdUJBQUUvQyxNQUFNK0M7QUFBQUEsY0FBTTtBQUFBLGNBQUEsSUFDcEJELGNBQVc7QUFBQSx1QkFBRTlDLE1BQU04QztBQUFBQSxjQUFXO0FBQUEsY0FBQSxJQUM5QnVCLFlBQVM7QUFBQSx1QkFBRXJFLE1BQU1xRTtBQUFBQSxjQUFTO0FBQUEsY0FBQSxJQUMxQjdCLGFBQVU7QUFBQSx1QkFBRXhDLE1BQU13QztBQUFBQSxjQUFBQTtBQUFBQSxZQUFVLENBQUEsQ0FBQTtBQUFBbUUsbUJBQUFBO0FBQUFBLFVBQUFBLEdBQUE7QUFBQSxRQUFBO0FBQUEsUUFBQSxJQUFBakksV0FBQTtBQUFBLGlCQUFBaUQsZ0JBTWpDc0csTUFBSTtBQUFBLFlBQ0hJLE1BQU0sQ0FDSjtBQUFBLGNBQUVDLElBQUk7QUFBQSxjQUFVK0IsT0FBTztBQUFBLFlBQUEsR0FDdkI7QUFBQSxjQUFFL0IsSUFBSTtBQUFBLGNBQWUrQixPQUFPO0FBQUEsWUFBQSxDQUFlO0FBQUEsWUFFN0NqQyxZQUFVO0FBQUEsWUFBQSxTQUFBO0FBQUEsWUFBQSxJQUFBMUosV0FBQTtBQUFBLHFCQUFBLEVBQUEsTUFBQTtBQUFBLG9CQUFBeUIsUUFBQUQsU0FBQTtBQUFBQyx1QkFBQUEsT0FBQXdCLGdCQUlQZ0gsVUFBUTtBQUFBLGtCQUFBLElBQUFqSyxXQUFBO0FBQUFpRCwyQkFBQUEsQ0FBQUEsZ0JBQ05pSCxhQUFXO0FBQUEsc0JBQUNwSyxPQUFLO0FBQUEsc0JBQUFFLFVBQUE7QUFBQSxvQkFBQSxDQUFBaUQsR0FBQUEsZ0JBQ2pCaUgsYUFBVztBQUFBLHNCQUFDcEssT0FBSztBQUFBLHNCQUFBRSxVQUFBO0FBQUEsb0JBQUEsQ0FBQSxDQUFBO0FBQUEsa0JBQUE7QUFBQSxnQkFBQSxDQUFBLENBQUE7QUFBQXlCLHVCQUFBQTtBQUFBQSxjQUFBQSxHQUFBd0IsR0FBQUEsZ0JBSXJCcUgsYUFBVztBQUFBLGdCQUFDeEssT0FBSztBQUFBLGdCQUFBLFNBQUE7QUFBQSxnQkFBQSxJQUFBRSxXQUFBO0FBQUEsc0JBQUEyQixRQUFBZ0IsVUFBQUEsR0FBQWYsUUFBQUQsTUFBQUQ7QUFBQUUseUJBQUFBLE9BQUFxQixnQkFHWE0sZUFBYTtBQUFBLG9CQUFBLElBQ1pjLFNBQU07QUFBQSw2QkFBRS9DLE1BQU0rQztBQUFBQSxvQkFBTTtBQUFBLG9CQUFBLElBQ3BCRCxjQUFXO0FBQUEsNkJBQUU5QyxNQUFNOEM7QUFBQUEsb0JBQVc7QUFBQSxvQkFBQSxJQUM5QnVCLFlBQVM7QUFBQSw2QkFBRXJFLE1BQU1xRTtBQUFBQSxvQkFBUztBQUFBLG9CQUFBLElBQzFCN0IsYUFBVTtBQUFBLDZCQUFFeEMsTUFBTXdDO0FBQUFBLG9CQUFBQTtBQUFBQSxrQkFBVSxDQUFBLENBQUE7QUFBQW5DLHlCQUFBQSxPQUFBc0IsZ0JBSy9CQyxNQUFJO0FBQUEsb0JBQUEsSUFBQ0MsT0FBSTtBQUFFLDZCQUFBLENBQUM3QixNQUFNcUUsYUFBYXJFLE1BQU00SDtBQUFBQSxvQkFBTztBQUFBLG9CQUFBLElBQUFsSixXQUFBO0FBQUEsMEJBQUE4QixRQUFBdUIsVUFBQTtBQUFBekMsNEJBQUFBLE1BQUE2RyxZQUFBLGVBQUEsR0FBQTtBQUFBM0YsNkJBQUFBLE9BQUFtQixnQkFPeEN1RixhQUFXO0FBQUEsd0JBQUEsSUFDVlUsVUFBTztBQUFBLGlDQUFFNUgsTUFBTTRIO0FBQUFBLHdCQUFPO0FBQUEsd0JBQUEsSUFDdEJGLGdCQUFhO0FBQUEsaUNBQUUxSCxNQUFNMEg7QUFBQUEsd0JBQUFBO0FBQUFBLHNCQUFhLENBQUEsQ0FBQTtBQUFBbEgsNkJBQUFBO0FBQUFBLG9CQUFBQTtBQUFBQSxrQkFBQSxDQUFBLEdBQUEsSUFBQTtBQUFBSCx5QkFBQUE7QUFBQUEsZ0JBQUFBO0FBQUFBLGNBQUEsQ0FBQXNCLEdBQUFBLGdCQU8zQ3FILGFBQVc7QUFBQSxnQkFBQ3hLLE9BQUs7QUFBQSxnQkFBQSxTQUFBO0FBQUEsZ0JBQUEsSUFBQUUsV0FBQTtBQUFBLHNCQUFBZ0ksUUFBQTRELFVBQUE7QUFBQTVELHlCQUFBQSxPQUFBL0UsZ0JBRWIyRSxrQkFBZ0I7QUFBQSxvQkFBQSxJQUFDQyxVQUFPO0FBQUEsNkJBQUV2RyxNQUFNdUs7QUFBQUEsb0JBQUFBO0FBQUFBLGtCQUFXLENBQUEsQ0FBQTtBQUFBN0QseUJBQUFBO0FBQUFBLGdCQUFBQTtBQUFBQSxjQUFBLENBQUEsQ0FBQTtBQUFBLFlBQUE7QUFBQSxVQUFBLENBQUE7QUFBQSxRQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUEsSUFBQTtBQUFBekcsYUFBQUEsTUFBQTBCLGdCQU9uREMsTUFBSTtBQUFBLFFBQUEsSUFBQ0MsT0FBSTtBQUFBLGlCQUFFN0IsTUFBTXFFO0FBQUFBLFFBQVM7QUFBQSxRQUFBLElBQUEzRixXQUFBO0FBQUEsaUJBQUFpRCxnQkFDeEJzSCxvQkFBa0I7QUFBQSxZQUFBLElBQ2pCdkksUUFBSztBQUFBLHFCQUFFcUosdUJBQXlCckosRUFBQUE7QUFBQUEsWUFBSztBQUFBLFlBQUEsSUFDckM2QixZQUFTO0FBQUEscUJBQUV3SCx1QkFBeUJ4SCxFQUFBQTtBQUFBQSxZQUFBQTtBQUFBQSxVQUFTLENBQUE7QUFBQSxRQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUEsSUFBQTtBQUFBM0IseUJBQUFBLE1BQUFBLFVBQUFYLE1BOUV2Q1ksR0FBRyx5Q0FBeUNiLE1BQU1jLEtBQUssQ0FBQyxDQUFBO0FBQUFiLGFBQUFBO0FBQUFBLElBQUFBLEdBQUE7QUFBQSxFQW1GeEU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ3RIQSxRQUFNdUssY0FBY3hDLGNBQWdDO0FBRTdDLFFBQU15QyxlQUFpRXpLLENBQVUsVUFBQTtBQUN0RixVQUFNLENBQUMwSyxRQUFRQyxTQUFTLElBQUl2SSxhQUF5QnBDLE1BQU00SyxpQkFBaUIsSUFBSTtBQUNoRixVQUFNLENBQUNDLGVBQWNDLGVBQWUsSUFBSTFJLGFBQTJCO0FBR25FUyxpQkFBYSxZQUFZO0FBQ3ZCLFlBQU1rSSxnQkFBZ0JMLE9BQU87QUFDekIsVUFBQTtBQUNGLGNBQU1NLFNBQVMsTUFBTSxxQ0FBaUMsdUJBQUEsT0FBQSxFQUFBLHlCQUFBLE1BQUEsUUFBQSxRQUFBLEVBQUEsS0FBQSxNQUFBLE9BQUEsR0FBQSw0QkFBQSxNQUFBLFFBQUEsUUFBQSxFQUFBLEtBQUEsTUFBQSxLQUFBLEVBQUEsQ0FBQSxHQUFBLGFBQUEsYUFBQSxhQUFBLENBQUE7QUFDdERGLHdCQUFnQkUsT0FBT0MsT0FBTztBQUFBLGVBQ3ZCQyxJQUFJO0FBQ0hoSCxnQkFBQUEsS0FBSyx5QkFBeUI2RyxhQUFhLDJCQUEyQjtBQUN4RUMsY0FBQUEsU0FBUyxNQUFNLFFBQThCLFFBQUEsRUFBQSxLQUFBLE1BQUEsT0FBQTtBQUNuREYsd0JBQWdCRSxPQUFPQyxPQUFPO0FBQUEsTUFBQTtBQUFBLElBQ2hDLENBQ0Q7QUFHS2hGLFVBQUFBLElBQUlBLENBQUNrRixLQUFhQyxXQUFpQztBQUNqREMsWUFBQUEsT0FBT0YsSUFBSUcsTUFBTSxHQUFHO0FBQzFCLFVBQUk5TSxTQUFhcU0sY0FBYTtBQUU5QixpQkFBV1UsS0FBS0YsTUFBTTtBQUNwQjdNLGlCQUFRQSxpQ0FBUStNO0FBQUFBLE1BQUM7QUFJZixVQUFBLE9BQU8vTSxXQUFVLFlBQVk0TSxRQUFRO0FBQ2hDNU0sZUFBQUEsT0FBTWdOLFFBQVEsa0JBQWtCLENBQUNDLEdBQUdGLE1BQU1HLE9BQU9OLE9BQU9HLENBQUMsS0FBSyxFQUFFLENBQUM7QUFBQSxNQUFBO0FBRzFFLGFBQU8vTSxVQUFTMk07QUFBQUEsSUFDbEI7QUFHQSxVQUFNUSxNQUFNQSxNQUFxQjtBQUczQkMsVUFBQUEsa0JBQWtCQyxXQUFXLE1BQ2pDLElBQUlDLEtBQUtDLGFBQWFyQixPQUFBQSxDQUFRLENBQ2hDO0FBRUEsVUFBTXNCLGVBQWVBLENBQUNDLFFBQWdCTCxnQkFBZ0IsRUFBRU0sT0FBT0QsR0FBRztBQUc1REUsVUFBQUEsYUFBYUEsQ0FBQ0MsTUFBWUMsWUFBeUM7QUFDaEUsYUFBQSxJQUFJUCxLQUFLUSxlQUFlNUIsVUFBVTJCLE9BQU8sRUFBRUgsT0FBT0UsSUFBSTtBQUFBLElBQy9EO0FBRUEsVUFBTTVOLFFBQTBCO0FBQUEsTUFDOUJrTTtBQUFBQSxNQUNBQztBQUFBQSxNQUNBMUU7QUFBQUEsTUFDQTBGO0FBQUFBLE1BQ0FLO0FBQUFBLE1BQ0FHO0FBQUFBLElBQ0Y7QUFFQXhLLFdBQUFBLGdCQUNHNkksWUFBWTlCLFVBQVE7QUFBQSxNQUFDbEs7QUFBQUEsTUFBWSxJQUFBRSxXQUFBO0FBQUEsZUFDL0JzQixNQUFNdEI7QUFBQUEsTUFBQUE7QUFBQUEsSUFBUSxDQUFBO0FBQUEsRUFHckI7QUFFTyxRQUFNNk4sVUFBVUEsTUFBTTtBQUNyQjFELFVBQUFBLFVBQVVDLFdBQVcwQixXQUFXO0FBQ3RDLFFBQUksQ0FBQzNCLFNBQVM7QUFDTixZQUFBLElBQUkyRCxNQUFNLDBDQUEwQztBQUFBLElBQUE7QUFFckQzRCxXQUFBQTtBQUFBQSxFQUNUOzs7O0FDdEVPLFFBQU00RCxpQkFBa0R6TSxDQUFVLFVBQUE7QUFDakUsVUFBQTtBQUFBLE1BQUVpRztBQUFBQSxNQUFHK0Y7QUFBQUEsUUFBaUJPLFFBQVE7QUFHOUJHLFVBQUFBLGtCQUFrQmIsV0FBVyxNQUFNO0FBQ25DN0wsVUFBQUEsTUFBTTJNLGFBQWMsUUFBTzNNLE1BQU0yTTtBQUVyQyxVQUFJM00sTUFBTVUsU0FBUyxHQUFJLFFBQU91RixFQUFFLHlCQUF5QjtBQUN6RCxVQUFJakcsTUFBTVUsU0FBUyxHQUFJLFFBQU91RixFQUFFLDJCQUEyQjtBQUMzRCxVQUFJakcsTUFBTVUsU0FBUyxHQUFJLFFBQU91RixFQUFFLHVCQUF1QjtBQUN2RCxVQUFJakcsTUFBTVUsU0FBUyxHQUFJLFFBQU91RixFQUFFLHNCQUFzQjtBQUN0RCxhQUFPQSxFQUFFLGdDQUFnQztBQUFBLElBQUEsQ0FDMUM7QUFFRCxZQUFBLE1BQUE7QUFBQSxVQUFBaEcsT0FBQThCLGFBQUE1QixRQUFBRixLQUFBRyxZQUFBQyxRQUFBRixNQUFBQyxZQUFBRSxRQUFBRCxNQUFBRCxZQUFBSSxRQUFBRixNQUFBQyxhQUFBbUcsUUFBQXJHLE1BQUFFLGFBQUFvRyxRQUFBRCxNQUFBdEcsWUFBQWdLLFFBQUF6RCxNQUFBdkcsWUFBQXdNLFFBQUF4QyxNQUFBN0o7QUFBQXFNLFlBQUF4TTtBQUFBQSxVQUFBeU0sUUFBQWxHLE1BQUFwRyxhQUFBdU0sU0FBQUQsTUFBQXpNLFlBQUEyTSxTQUFBRCxPQUFBdk0sYUFBQXlNLFNBQUF0RyxNQUFBbkcsYUFBQTBNLFNBQUFELE9BQUE1TTtBQUFBSyxhQUFBSCxPQUFBLE1BTTBEMkYsRUFBRSx1QkFBdUIsQ0FBQztBQUFBeEYsYUFBQUQsT0FFekV3TCxNQUFBQSxhQUFhaE0sTUFBTVUsS0FBSyxDQUFDO0FBQUFELGFBQUFtTSxPQVM2QlosTUFBQUEsYUFBYWhNLE1BQU1XLElBQUksR0FBQyxJQUFBO0FBQUFGLGFBQUFxTSxRQUFBLE1BSzdCN0csRUFBRSxvQkFBb0IsQ0FBQztBQUFBOEcsYUFBQUEsUUFDbkIvTSxNQUFBQSxNQUFNa04sS0FBSztBQUFBek0sYUFBQXdNLFFBT2hFUCxlQUFlO0FBQUF6TSxhQUFBQSxNQUFBMEIsZ0JBTXJCQyxNQUFJO0FBQUEsUUFBQSxJQUFDQyxPQUFJO0FBQUEsaUJBQUU3QixNQUFNbU47QUFBQUEsUUFBVTtBQUFBLFFBQUEsSUFBQXpPLFdBQUE7QUFBQSxjQUFBME8sU0FBQWxOLFNBQUE7QUFBQWtOLGlCQUFBQSxRQUFBekwsZ0JBRXZCWixRQUFNO0FBQUEsWUFDTEksU0FBTztBQUFBLFlBQ1BDLE1BQUk7QUFBQSxZQUNKTSxXQUFTO0FBQUEsWUFBQSxJQUNUMkwsVUFBTztBQUFBLHFCQUFFck4sTUFBTW1OO0FBQUFBLFlBQVU7QUFBQSxZQUFBek8sVUFBQTtBQUFBLFVBQUEsQ0FBQSxDQUFBO0FBQUEwTyxpQkFBQUE7QUFBQUEsUUFBQUE7QUFBQUEsTUFBQSxDQUFBLEdBQUEsSUFBQTtBQUFBeE0seUJBQUFBLE1BQUFBLFVBQUFYLE1BekNyQlksR0FBRyxnQ0FBZ0NiLE1BQU1jLEtBQUssQ0FBQyxDQUFBO0FBQUFiLGFBQUFBO0FBQUFBLElBQUFBLEdBQUE7QUFBQSxFQWlEL0Q7OztBQzdFTyxXQUFTLDRCQUE0QixTQUFpQztBQUMzRSxVQUFNLENBQUMsY0FBYyxlQUFlLElBQUksYUFBa0MsSUFBSTtBQUM5RSxVQUFNLENBQUMsYUFBYSxjQUFjLElBQUksYUFBaUMsSUFBSTtBQUMzRSxVQUFNLEdBQUcsbUJBQW1CLElBQUksYUFBc0MsSUFBSTtBQUUxRSxVQUFNLENBQUMsU0FBUyxVQUFVLElBQUksYUFBYSxLQUFLO0FBQ2hELFVBQU0sQ0FBQyxPQUFPLFFBQVEsSUFBSSxhQUEyQixJQUFJO0FBQ3pELFVBQU0sQ0FBQyxhQUFhLGNBQWMsSUFBSSxhQUFhLEtBQUs7QUFFeEQsVUFBTSxDQUFDLHNCQUFzQix1QkFBdUIsSUFBSSxhQUE0QixJQUFJO0FBQ3hGLFVBQU0sQ0FBQyxxQkFBcUIsc0JBQXNCLElBQUksYUFBNkIsQ0FBQSxDQUFFO0FBRXJGLFVBQU0sQ0FBQyxpQkFBaUIsa0JBQWtCLElBQUksYUFBYSxLQUFLO0FBQ2hFLFVBQU0sQ0FBQyxtQkFBbUIsb0JBQW9CLElBQUksYUFBNkIsQ0FBQSxDQUFFO0FBRTNFLFVBQUEsYUFBYSxtQ0FBUztBQUU1QixVQUFNLGFBQWEsWUFBWTtBQUM3QixVQUFJLGVBQWdCO0FBQ3BCLGVBQVMsSUFBSTtBQUVULFVBQUE7QUFFRixjQUFNLE1BQU0sSUFBSSxhQUFhLEVBQUUsWUFBWTtBQUMzQyx3QkFBZ0IsR0FBRztBQUVuQixjQUFNLFNBQVMsTUFBTSxVQUFVLGFBQWEsYUFBYTtBQUFBLFVBQ3ZELE9BQU87QUFBQSxZQUNMO0FBQUEsWUFDQSxjQUFjO0FBQUEsWUFDZCxrQkFBa0I7QUFBQSxZQUNsQixrQkFBa0I7QUFBQSxZQUNsQixpQkFBaUI7QUFBQSxVQUFBO0FBQUEsUUFDbkIsQ0FDRDtBQUNELHVCQUFlLE1BQU07QUFFckIsY0FBTSxJQUFJLGFBQWEsVUFBVSw0QkFBQSxDQUE2QjtBQUU5RCxjQUFNLGNBQWMsSUFBSSxpQkFBaUIsS0FBSywyQkFBMkI7QUFBQSxVQUN2RSxnQkFBZ0I7QUFBQSxVQUNoQixpQkFBaUI7QUFBQSxVQUNqQixjQUFjO0FBQUEsUUFBQSxDQUNmO0FBRVcsb0JBQUEsS0FBSyxZQUFZLENBQUMsVUFBVTtBQUNsQyxjQUFBLE1BQU0sS0FBSyxTQUFTLGFBQWE7QUFDbkMsa0JBQU0sWUFBWSxJQUFJLGFBQWEsTUFBTSxLQUFLLFNBQVM7QUFFbkQsZ0JBQUEsMkJBQTJCLE1BQU07QUFDbkMscUNBQXVCLENBQUMsU0FBUyxDQUFDLEdBQUcsTUFBTSxTQUFTLENBQUM7QUFBQSxZQUFBO0FBR3ZELGdCQUFJLG1CQUFtQjtBQUNyQixtQ0FBcUIsQ0FBQyxTQUFTLENBQUMsR0FBRyxNQUFNLFNBQVMsQ0FBQztBQUFBLFlBQUE7QUFBQSxVQUNyRDtBQUFBLFFBRUo7QUFFQSw0QkFBb0IsV0FBVztBQUV6QixjQUFBLFNBQVMsSUFBSSx3QkFBd0IsTUFBTTtBQUMzQyxjQUFBLFdBQVcsSUFBSSxXQUFXO0FBQ2hDLGlCQUFTLEtBQUssUUFBUTtBQUV0QixlQUFPLFFBQVEsUUFBUTtBQUN2QixpQkFBUyxRQUFRLFdBQVc7QUFFNUIsbUJBQVcsSUFBSTtBQUFBLGVBQ1IsR0FBRztBQUNGLGdCQUFBLE1BQU0saURBQWlELENBQUM7QUFDaEUsaUJBQVMsYUFBYSxRQUFRLElBQUksSUFBSSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2pGLG1CQUFXLEtBQUs7QUFBQSxNQUFBO0FBQUEsSUFFcEI7QUFFQSxVQUFNLDhCQUE4QixNQUFNO0FBQ3hDLFlBQU0sZ0JBQWdCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUEwQ2hCLFlBQUEsT0FBTyxJQUFJLEtBQUssQ0FBQyxhQUFhLEdBQUcsRUFBRSxNQUFNLDBCQUEwQjtBQUNsRSxhQUFBLElBQUksZ0JBQWdCLElBQUk7QUFBQSxJQUNqQztBQUVBLFVBQU0saUJBQWlCLE1BQU07QUFDM0IsWUFBTSxNQUFNLGFBQWE7QUFDckIsVUFBQSxPQUFPLElBQUksVUFBVSxhQUFhO0FBQ3BDLFlBQUksT0FBTztBQUFBLE1BQUE7QUFFYixxQkFBZSxJQUFJO0FBQUEsSUFDckI7QUFFQSxVQUFNLGlCQUFpQixNQUFNO0FBQzNCLFlBQU0sTUFBTSxhQUFhO0FBQ3JCLFVBQUEsT0FBTyxJQUFJLFVBQVUsV0FBVztBQUNsQyxZQUFJLFFBQVE7QUFBQSxNQUFBO0FBRWQscUJBQWUsS0FBSztBQUFBLElBQ3RCO0FBRUEsVUFBTSxVQUFVLE1BQU07QUFFcEIsWUFBTSxTQUFTLFlBQVk7QUFDM0IsVUFBSSxRQUFRO0FBQ1YsZUFBTyxZQUFZLFFBQVEsQ0FBQyxVQUFVLE1BQU0sTUFBTTtBQUNsRCx1QkFBZSxJQUFJO0FBQUEsTUFBQTtBQUdyQixZQUFNLE1BQU0sYUFBYTtBQUNyQixVQUFBLE9BQU8sSUFBSSxVQUFVLFVBQVU7QUFDakMsWUFBSSxNQUFNO0FBQ1Ysd0JBQWdCLElBQUk7QUFBQSxNQUFBO0FBR3RCLDBCQUFvQixJQUFJO0FBQ3hCLGlCQUFXLEtBQUs7QUFDaEIscUJBQWUsS0FBSztBQUFBLElBQ3RCO0FBRUEsY0FBVSxPQUFPO0FBRVgsVUFBQSxxQkFBcUIsQ0FBQyxjQUFzQjtBQUVoRCw4QkFBd0IsU0FBUztBQUNqQyw2QkFBdUIsQ0FBQSxDQUFFO0FBRXpCLFVBQUksUUFBUSxLQUFLLENBQUMsZUFBZTtBQUNoQix1QkFBQTtBQUFBLE1BQUE7QUFBQSxJQUVuQjtBQUVBLFVBQU0sa0NBQWtDLE1BQXNCO0FBQzVELFlBQU0sWUFBWSxxQkFBcUI7QUFDdkMsVUFBSSxjQUFjLE1BQU07QUFDdEIsZUFBTyxDQUFDO0FBQUEsTUFBQTtBQUdWLFlBQU0sY0FBYyxvQkFBb0I7QUFFeEMsOEJBQXdCLElBQUk7QUFFdEIsWUFBQXBCLFVBQVMsQ0FBQyxHQUFHLFdBQVc7QUFDOUIsNkJBQXVCLENBQUEsQ0FBRTtBQUVyQixVQUFBQSxRQUFPLFdBQVcsRUFBRztBQUdsQixhQUFBQTtBQUFBLElBQ1Q7QUFFTSxVQUFBLHdCQUF3QixDQUFDLGdCQUE2QztBQUN0RSxVQUFBLFlBQVksV0FBVyxFQUFVLFFBQUE7QUFFL0IsWUFBQSxjQUFjLFlBQVksT0FBTyxDQUFDLEtBQUssVUFBVSxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQ3RFLFlBQUEsZUFBZSxJQUFJLGFBQWEsV0FBVztBQUNqRCxVQUFJLFNBQVM7QUFDYixpQkFBVyxTQUFTLGFBQWE7QUFDbEIscUJBQUEsSUFBSSxPQUFPLE1BQU07QUFDOUIsa0JBQVUsTUFBTTtBQUFBLE1BQUE7QUFHWCxhQUFBLGlCQUFpQixjQUFjLFVBQVU7QUFBQSxJQUNsRDtBQUVNLFVBQUEsbUJBQW1CLENBQUMsUUFBc0J5TyxnQkFBNkI7QUFDM0UsWUFBTSxTQUFTLE9BQU87QUFDdEIsWUFBTSxjQUFjLElBQUksWUFBWSxLQUFLLFNBQVMsQ0FBQztBQUM3QyxZQUFBLE9BQU8sSUFBSSxTQUFTLFdBQVc7QUFFL0IsWUFBQSxjQUFjLENBQUNDLFNBQWdCLFdBQW1CO0FBQ3RELGlCQUFTLElBQUksR0FBRyxJQUFJLE9BQU8sUUFBUSxLQUFLO0FBQ3RDLGVBQUssU0FBU0EsVUFBUyxHQUFHLE9BQU8sV0FBVyxDQUFDLENBQUM7QUFBQSxRQUFBO0FBQUEsTUFFbEQ7QUFFQSxrQkFBWSxHQUFHLE1BQU07QUFDckIsV0FBSyxVQUFVLEdBQUcsS0FBSyxTQUFTLEdBQUcsSUFBSTtBQUN2QyxrQkFBWSxHQUFHLE1BQU07QUFDckIsa0JBQVksSUFBSSxNQUFNO0FBQ2pCLFdBQUEsVUFBVSxJQUFJLElBQUksSUFBSTtBQUN0QixXQUFBLFVBQVUsSUFBSSxHQUFHLElBQUk7QUFDckIsV0FBQSxVQUFVLElBQUksR0FBRyxJQUFJO0FBQ3JCLFdBQUEsVUFBVSxJQUFJRCxhQUFZLElBQUk7QUFDbkMsV0FBSyxVQUFVLElBQUlBLGNBQWEsR0FBRyxJQUFJO0FBQ2xDLFdBQUEsVUFBVSxJQUFJLEdBQUcsSUFBSTtBQUNyQixXQUFBLFVBQVUsSUFBSSxJQUFJLElBQUk7QUFDM0Isa0JBQVksSUFBSSxNQUFNO0FBQ3RCLFdBQUssVUFBVSxJQUFJLFNBQVMsR0FBRyxJQUFJO0FBRW5DLFlBQU0sU0FBUztBQUNmLGVBQVMsSUFBSSxHQUFHLElBQUksUUFBUSxLQUFLO0FBQ3pCLGNBQUEsU0FBUyxLQUFLLElBQUksSUFBSSxLQUFLLElBQUksR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDdkQsYUFBSyxTQUFTLFNBQVMsSUFBSSxHQUFHLFNBQVMsT0FBUSxJQUFJO0FBQUEsTUFBQTtBQUc5QyxhQUFBLElBQUksS0FBSyxDQUFDLFdBQVcsR0FBRyxFQUFFLE1BQU0sYUFBYTtBQUFBLElBQ3REO0FBRUEsVUFBTSxtQkFBbUIsTUFBTTtBQUM3QiwyQkFBcUIsQ0FBQSxDQUFFO0FBQ3ZCLHlCQUFtQixJQUFJO0FBQUEsSUFDekI7QUFFQSxVQUFNLDJCQUEyQixNQUFtQjtBQUNsRCx5QkFBbUIsS0FBSztBQUV4QixZQUFNLGdCQUFnQixrQkFBa0I7QUFDbEMsWUFBQSxVQUFVLHNCQUFzQixhQUFhO0FBR25ELDJCQUFxQixDQUFBLENBQUU7QUFFaEIsYUFBQTtBQUFBLElBQ1Q7QUFFTyxXQUFBO0FBQUEsTUFDTDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGOzs7RUN6UE8sTUFBTSxVQUFVO0FBQUEsSUFLckIsWUFBWSxRQUF5QjtBQUo3QjtBQUNBO0FBQ0E7QUFHTixXQUFLLFVBQVUsT0FBTyxRQUFRLFFBQVEsT0FBTyxFQUFFO0FBQy9DLFdBQUssZUFBZSxPQUFPO0FBQzNCLFdBQUssVUFBVSxPQUFPO0FBQUEsSUFBQTtBQUFBLElBR3hCLE1BQWMsUUFDWixNQUNBLFVBQXVCLElBQ1g7QUFDUixVQUFBO0FBQ0YsY0FBTSxVQUFrQztBQUFBLFVBQ3RDLGdCQUFnQjtBQUFBLFVBQ2hCLEdBQUksUUFBUSxXQUFxQyxDQUFBO0FBQUEsUUFDbkQ7QUFHQSxZQUFJLEtBQUssY0FBYztBQUNmLGdCQUFBLFFBQVEsTUFBTSxLQUFLLGFBQWE7QUFDdEMsY0FBSSxPQUFPO0FBQ0Qsb0JBQUEsZUFBZSxJQUFJLFVBQVUsS0FBSztBQUFBLFVBQUE7QUFBQSxRQUM1QztBQUdJLGNBQUEsV0FBVyxNQUFNLE1BQU0sR0FBRyxLQUFLLE9BQU8sR0FBRyxJQUFJLElBQUk7QUFBQSxVQUNyRCxHQUFHO0FBQUEsVUFDSDtBQUFBLFFBQUEsQ0FDRDtBQUVHLFlBQUEsQ0FBQyxTQUFTLElBQUk7QUFDVixnQkFBQSxRQUFRLE1BQU0sU0FBUyxLQUFLO0FBQ2xDLGdCQUFNLElBQUksTUFBTSxhQUFhLFNBQVMsTUFBTSxLQUFLLEtBQUssRUFBRTtBQUFBLFFBQUE7QUFHbkQsZUFBQSxNQUFNLFNBQVMsS0FBSztBQUFBLGVBQ3BCLE9BQU87QUFDZCxZQUFJLEtBQUssU0FBUztBQUNoQixlQUFLLFFBQVEsS0FBYztBQUFBLFFBQUE7QUFFdkIsY0FBQTtBQUFBLE1BQUE7QUFBQSxJQUNSO0FBQUE7QUFBQSxJQUlGLE1BQU0sY0FBZ0M7QUFDaEMsVUFBQTtBQUNJLGNBQUEsS0FBSyxRQUFRLFNBQVM7QUFDckIsZUFBQTtBQUFBLE1BQUEsUUFDRDtBQUNDLGVBQUE7QUFBQSxNQUFBO0FBQUEsSUFDVDtBQUFBO0FBQUEsSUFJRixNQUFNLGVBQWdDO0FBQ3BDLFlBQU0sV0FBVyxNQUFNLEtBQUssUUFBMkIsY0FBYztBQUFBLFFBQ25FLFFBQVE7QUFBQSxNQUFBLENBQ1Q7QUFDRCxhQUFPLFNBQVM7QUFBQSxJQUFBO0FBQUEsSUFHbEIsTUFBTSxpQkFBK0M7QUFDNUMsYUFBQSxLQUFLLFFBQTZCLG1CQUFtQjtBQUFBLElBQUE7QUFBQSxJQUc5RCxNQUFNLGdCQUNKLFNBQ2tDO0FBQzNCLGFBQUEsS0FBSyxRQUFpQyw4QkFBOEI7QUFBQSxRQUN6RSxRQUFRO0FBQUEsUUFDUixNQUFNLEtBQUssVUFBVSxPQUFPO0FBQUEsTUFBQSxDQUM3QjtBQUFBLElBQUE7QUFBQTtBQUFBLElBSUgsTUFBTSxlQUFlLFNBQXVDO0FBQzFELGFBQU8sS0FBSyxRQUFxQixnQkFBZ0IsbUJBQW1CLE9BQU8sQ0FBQyxFQUFFO0FBQUEsSUFBQTtBQUFBLElBR2hGLE1BQU0sb0JBQ0osU0FDc0M7QUFDL0IsYUFBQSxLQUFLLFFBQXFDLHNCQUFzQjtBQUFBLFFBQ3JFLFFBQVE7QUFBQSxRQUNSLE1BQU0sS0FBSyxVQUFVLE9BQU87QUFBQSxNQUFBLENBQzdCO0FBQUEsSUFBQTtBQUFBLElBR0gsTUFBTSxpQkFDSixTQUNpQztBQUMxQixhQUFBLEtBQUssUUFBZ0Msc0JBQXNCO0FBQUEsUUFDaEUsUUFBUTtBQUFBLFFBQ1IsTUFBTSxLQUFLLFVBQVUsT0FBTztBQUFBLE1BQUEsQ0FDN0I7QUFBQSxJQUFBO0FBQUEsSUFHSCxNQUFNLHVCQUNKLFNBQ3NDO0FBQy9CLGFBQUEsS0FBSyxRQUFxQyx5QkFBeUI7QUFBQSxRQUN4RSxRQUFRO0FBQUEsUUFDUixNQUFNLEtBQUssVUFBVSxPQUFPO0FBQUEsTUFBQSxDQUM3QjtBQUFBLElBQUE7QUFBQTtBQUFBLElBSUgsTUFBTSxnQkFDSixTQUM2QjtBQUN0QixhQUFBLEtBQUssUUFBNEIsa0NBQWtDO0FBQUEsUUFDeEUsUUFBUTtBQUFBLFFBQ1IsTUFBTSxLQUFLLFVBQVUsT0FBTztBQUFBLE1BQUEsQ0FDN0I7QUFBQSxJQUFBO0FBQUE7QUFBQSxJQUlILE1BQU0scUJBQ0osV0FDQSxRQUFRLElBQ2dFO0FBQ2xFLFlBQUEsU0FBUyxJQUFJLGdCQUFnQjtBQUNuQyxVQUFJLFVBQVcsUUFBTyxPQUFPLGFBQWEsU0FBUztBQUNuRCxhQUFPLE9BQU8sU0FBUyxNQUFNLFNBQUEsQ0FBVTtBQUV2QyxhQUFPLEtBQUs7QUFBQSxRQUNWLDJCQUEyQixNQUFNO0FBQUEsTUFDbkM7QUFBQSxJQUFBO0FBQUEsSUFHRixNQUFNLHFCQUNKLFFBQ0EsT0FDQSxZQUNzQjtBQUNmLGFBQUEsS0FBSyxRQUFxQix3QkFBd0I7QUFBQSxRQUN2RCxRQUFRO0FBQUEsUUFDUixNQUFNLEtBQUssVUFBVSxFQUFFLFFBQVEsT0FBTyxXQUFZLENBQUE7QUFBQSxNQUFBLENBQ25EO0FBQUEsSUFBQTtBQUFBO0FBQUEsSUFJSCxNQUFNLGlCQUFpQixRQUF5RDtBQUM5RSxhQUFPLEtBQUs7QUFBQSxRQUNWLHVCQUF1QixNQUFNO0FBQUEsTUFDL0I7QUFBQSxJQUFBO0FBQUE7QUFBQSxJQUlGLE1BQU0sbUJBQ0osUUFDQSxRQUFRLElBQ3NFO0FBQzlFLGFBQU8sS0FBSztBQUFBLFFBQ1YsY0FBYyxNQUFNLHNCQUFzQixLQUFLO0FBQUEsTUFDakQ7QUFBQSxJQUFBO0FBQUEsRUFFSjs7RUNsTE8sTUFBTSxnQkFBZ0I7QUFBQSxJQUMzQixZQUFvQixRQUFtQjtBQUFuQixXQUFBLFNBQUE7QUFBQSxJQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFLcEIsTUFBTSxRQUFRLFNBQXVDO0FBQzVDLGFBQUEsS0FBSyxPQUFPLGVBQWUsT0FBTztBQUFBLElBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU0zQyxNQUFNLGFBQ0osU0FDQSxVQU9BLGVBQ3lCO0FBQ3pCLFlBQU0sV0FBVyxNQUFNLEtBQUssT0FBTyxvQkFBb0I7QUFBQSxRQUNyRDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFBQSxDQUNEO0FBRUQsVUFBSSxDQUFDLFNBQVMsV0FBVyxDQUFDLFNBQVMsTUFBTTtBQUN2QyxjQUFNLElBQUksTUFBTSxTQUFTLFNBQVMseUJBQXlCO0FBQUEsTUFBQTtBQUc3RCxhQUFPLFNBQVM7QUFBQSxJQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFNbEIsTUFBTSxVQUNKLFdBQ0EsV0FDQSxhQUNBLGNBQ0EsV0FDQSxTQUNvQjtBQUNwQixZQUFNLFdBQVcsTUFBTSxLQUFLLE9BQU8saUJBQWlCO0FBQUEsUUFDbEQ7QUFBQSxRQUNBO0FBQUEsUUFDQSxhQUFhO0FBQUEsUUFDYjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFBQSxDQUNEO0FBRUQsVUFBSSxDQUFDLFNBQVMsV0FBVyxDQUFDLFNBQVMsTUFBTTtBQUN2QyxjQUFNLElBQUksTUFBTSxTQUFTLFNBQVMsc0JBQXNCO0FBQUEsTUFBQTtBQUcxRCxhQUFPLFNBQVM7QUFBQSxJQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFNbEIsTUFBTSxnQkFDSixXQUNBLGlCQUN5QjtBQUN6QixZQUFNLFdBQVcsTUFBTSxLQUFLLE9BQU8sdUJBQXVCO0FBQUEsUUFDeEQ7QUFBQSxRQUNBLGlCQUFpQjtBQUFBLE1BQUEsQ0FDbEI7QUFFRCxVQUFJLENBQUMsU0FBUyxXQUFXLENBQUMsU0FBUyxNQUFNO0FBQ3ZDLGNBQU0sSUFBSSxNQUFNLFNBQVMsU0FBUyw0QkFBNEI7QUFBQSxNQUFBO0FBR2hFLGFBQU8sU0FBUztBQUFBLElBQUE7QUFBQSxFQUVwQjs7RUN4Rk8sTUFBTSxpQkFBaUI7QUFBQSxJQUM1QixZQUFvQixRQUFtQjtBQUFuQixXQUFBLFNBQUE7QUFBQSxJQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFLcEIsTUFBTSxhQUNKLFdBQ0EsUUFBUSxJQUNtRDtBQUMzRCxZQUFNLFdBQVcsTUFBTSxLQUFLLE9BQU8scUJBQXFCLFdBQVcsS0FBSztBQUV4RSxVQUFJLENBQUMsU0FBUyxXQUFXLENBQUMsU0FBUyxNQUFNO0FBQ3ZDLGNBQU0sSUFBSSxNQUFNLFNBQVMsU0FBUywyQkFBMkI7QUFBQSxNQUFBO0FBRy9ELGFBQU8sU0FBUztBQUFBLElBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU1sQixNQUFNLGFBQ0osUUFDQSxPQUNBLGNBQXlCLG9CQUFBLEtBQUEsR0FBTyxlQUNqQjtBQUNULFlBQUEsV0FBVyxNQUFNLEtBQUssT0FBTztBQUFBLFFBQ2pDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBRUksVUFBQSxDQUFDLFNBQVMsU0FBUztBQUNyQixjQUFNLElBQUksTUFBTSxTQUFTLFNBQVMseUJBQXlCO0FBQUEsTUFBQTtBQUFBLElBQzdEO0FBQUEsRUFFSjs7RUNoQ08sTUFBTSxZQUFZO0FBQUEsSUFDdkIsWUFBb0IsUUFBbUI7QUFBbkIsV0FBQSxTQUFBO0FBQUEsSUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBS3BCLE1BQU0sV0FDSixhQUNBLGNBQ0EsaUJBQWlCLE9BQ2E7QUFDOUIsWUFBTSxXQUFXLE1BQU0sS0FBSyxPQUFPLGdCQUFnQjtBQUFBLFFBQ2pEO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUFBLENBQ0Q7QUFFRCxVQUFJLENBQUMsU0FBUyxXQUFXLENBQUMsU0FBUyxNQUFNO0FBQ3ZDLGNBQU0sSUFBSSxNQUFNLFNBQVMsU0FBUyw0QkFBNEI7QUFBQSxNQUFBO0FBR2hFLGFBQU8sU0FBUztBQUFBLElBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU1sQixNQUFNLG9CQUNKLGFBQ0EsY0FDQSxhQUFhLEdBQ2lCO0FBQzlCLFVBQUksWUFBMEI7QUFFOUIsZUFBUyxVQUFVLEdBQUcsV0FBVyxZQUFZLFdBQVc7QUFDbEQsWUFBQTtBQUVJLGdCQUFBek8sVUFBUyxNQUFNLEtBQUs7QUFBQSxZQUN4QjtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsVUFDRjtBQUNPLGlCQUFBQTtBQUFBLGlCQUNBLE9BQU87QUFDRixzQkFBQTtBQUNaLGtCQUFRLElBQUksaUJBQWlCLE9BQU8sSUFBSSxVQUFVLFlBQVksS0FBSztBQUduRSxjQUFJLFlBQVksR0FBRztBQUNiLGdCQUFBO0FBQ0Ysc0JBQVEsSUFBSSxpQ0FBaUM7QUFDdkMsb0JBQUFBLFVBQVMsTUFBTSxLQUFLO0FBQUEsZ0JBQ3hCO0FBQUEsZ0JBQ0E7QUFBQSxnQkFDQTtBQUFBLGNBQ0Y7QUFDTyxxQkFBQUE7QUFBQSxxQkFDQSxlQUFlO0FBQ1YsMEJBQUE7QUFDSixzQkFBQSxNQUFNLCtCQUErQixhQUFhO0FBQUEsWUFBQTtBQUFBLFVBQzVEO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFHSSxZQUFBLGFBQWEsSUFBSSxNQUFNLDBCQUEwQjtBQUFBLElBQUE7QUFBQSxFQUUzRDs7RUNwRU8sTUFBTSxhQUFhO0FBQUEsSUFDeEIsWUFBb0IsUUFBbUI7QUFBbkIsV0FBQSxTQUFBO0FBQUEsSUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBS3BCLE1BQU0sZUFBZ0M7QUFDN0IsYUFBQSxLQUFLLE9BQU8sYUFBYTtBQUFBLElBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU1sQyxNQUFNLGlCQUErQztBQUM1QyxhQUFBLEtBQUssT0FBTyxlQUFlO0FBQUEsSUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBTXBDLE1BQU0sZ0JBQ0osS0FDQSxTQUNBLFFBQTJCLFFBQzNCLGlCQUNrQztBQUMzQixhQUFBLEtBQUssT0FBTyxnQkFBZ0I7QUFBQSxRQUNqQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQUEsQ0FDRDtBQUFBLElBQUE7QUFBQSxFQUVMOzs7QUMxQk8sV0FBUyxnQkFBZ0IsUUFBeUI7QUFDakQsVUFBQSxTQUFTLElBQUksVUFBVSxNQUFNO0FBRTVCLFdBQUE7QUFBQSxNQUNMO0FBQUEsTUFDQSxTQUFTLElBQUksZ0JBQWdCLE1BQU07QUFBQSxNQUNuQyxVQUFVLElBQUksaUJBQWlCLE1BQU07QUFBQSxNQUNyQyxLQUFLLElBQUksWUFBWSxNQUFNO0FBQUEsTUFDM0IsTUFBTSxJQUFJLGFBQWEsTUFBTTtBQUFBO0FBQUEsTUFHN0IsYUFBYSxNQUFNLE9BQU8sWUFBWTtBQUFBLElBQ3hDO0FBQUEsRUFDRjs7QUNwQk8sTUFBQSxzQkFBQSxNQUFNLGtCQUFrQjtBQUFBLElBRzdCLFlBQVksVUFBa0QseUJBQXlCO0FBRi9FO0FBR04sV0FBSyxTQUFTLGdCQUFnQixFQUFFLFFBQUEsQ0FBUztBQUFBLElBQUE7QUFBQSxJQUczQyxNQUFNLGlCQUFpQixTQUE4QztBQUMvRCxVQUFBO0FBQ0YsZUFBTyxNQUFNLEtBQUssT0FBTyxRQUFRLFFBQVEsT0FBTztBQUFBLGVBQ3pDLE9BQU87QUFDTixnQkFBQSxNQUFNLDhDQUE4QyxLQUFLO0FBQzFELGVBQUE7QUFBQSxNQUFBO0FBQUEsSUFDVDtBQUFBLElBR0YsTUFBTSxhQUNKLFNBQ0EsVUFDQSxXQUNBLGVBQ0EsZUFDZ0M7QUFDNUIsVUFBQTtBQUdGLGNBQU0sVUFBVSxNQUFNLEtBQUssT0FBTyxRQUFRO0FBQUEsVUFDeEM7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0Y7QUFDTyxlQUFBO0FBQUEsZUFDQSxPQUFPO0FBQ04sZ0JBQUEsTUFBTSx5Q0FBeUMsS0FBSztBQUNyRCxlQUFBO0FBQUEsTUFBQTtBQUFBLElBQ1Q7QUFBQSxJQUdGLE1BQU0sZUFDSixXQUNBLFdBQ0EsYUFDQSxjQUNBLFdBQ0EsU0FDQSxXQUNBLGVBQzJCO0FBQ3ZCLFVBQUE7QUFFRixjQUFNLFlBQVksTUFBTSxLQUFLLE9BQU8sUUFBUTtBQUFBLFVBQzFDO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNGO0FBQ08sZUFBQTtBQUFBLGVBQ0EsT0FBTztBQUNOLGdCQUFBLE1BQU0sMkNBQTJDLEtBQUs7QUFDdkQsZUFBQTtBQUFBLE1BQUE7QUFBQSxJQUNUO0FBQUEsSUFHRixNQUFNLGdCQUNKLFdBQ0EsaUJBQ2dDO0FBQzVCLFVBQUE7QUFDRixjQUFNLFVBQVUsTUFBTSxLQUFLLE9BQU8sUUFBUTtBQUFBLFVBQ3hDO0FBQUEsVUFDQTtBQUFBLFFBQ0Y7QUFDTyxlQUFBO0FBQUEsZUFDQSxPQUFPO0FBQ04sZ0JBQUEsTUFBTSw0Q0FBNEMsS0FBSztBQUN4RCxlQUFBO0FBQUEsTUFBQTtBQUFBLElBQ1Q7QUFBQSxJQUdGLE1BQU0saUJBQWlCLFFBQXdDOztBQUN6RCxVQUFBO0FBQ0YsY0FBTSxXQUFXLE1BQU0sS0FBSyxPQUFPLE9BQU8saUJBQWlCLE1BQU07QUFDMUQsaUJBQUFZLE1BQUEsU0FBUyxTQUFULGdCQUFBQSxJQUFlLFVBQVM7QUFBQSxlQUN4QixPQUFPO0FBQ04sZ0JBQUEsTUFBTSwrQ0FBK0MsS0FBSztBQUMzRCxlQUFBO0FBQUEsTUFBQTtBQUFBLElBQ1Q7QUFBQSxJQUdGLE1BQU0sbUJBQW1CLFFBQWdCLFFBQVEsSUFBcUU7QUFDaEgsVUFBQTtBQUNGLGNBQU0sV0FBVyxNQUFNLEtBQUssT0FBTyxPQUFPLG1CQUFtQixRQUFRLEtBQUs7QUFDbkUsZUFBQSxTQUFTLFFBQVEsQ0FBQztBQUFBLGVBQ2xCLE9BQU87QUFDTixnQkFBQSxNQUFNLGdEQUFnRCxLQUFLO0FBQ25FLGVBQU8sQ0FBQztBQUFBLE1BQUE7QUFBQSxJQUNWO0FBQUEsRUFFSjs7QUN4R08sV0FBUyxXQUFXLE1BQXNCO0FBQzNDLFFBQUEsQ0FBQyxLQUFhLFFBQUE7QUFDbEIsV0FBTyxLQUNKLE9BQ0EsTUFBTSxLQUFLLEVBQ1gsT0FBTyxDQUFDLFNBQVMsS0FBSyxTQUFTLENBQUMsRUFBRTtBQUFBLEVBQ3ZDO0FBRWdCLFdBQUEsaUJBQ2QsT0FDQSxZQUNXO0FBRUwsVUFBQSxPQUFPLE1BQU0sVUFBVTtBQUM3QixRQUFJLENBQUMsTUFBTTtBQUNGLGFBQUE7QUFBQSxRQUNMO0FBQUEsUUFDQSxVQUFVO0FBQUEsUUFDVixjQUFjO0FBQUEsUUFDZCxXQUFXO0FBQUEsTUFDYjtBQUFBLElBQUE7QUFHRixVQUFNLFlBQVksV0FBVyxLQUFLLFFBQVEsRUFBRTtBQUVyQyxXQUFBO0FBQUEsTUFDTDtBQUFBLE1BQ0EsVUFBVTtBQUFBO0FBQUEsTUFDVixjQUFjLEtBQUssUUFBUTtBQUFBLE1BQzNCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFFZ0IsV0FBQSwyQkFDZCxPQUNBLFdBQ1E7O0FBQ0YsVUFBQSxFQUFFLFlBQVksU0FBQSxJQUFhO0FBQzNCLFVBQUEsT0FBTyxNQUFNLFVBQVU7QUFFekIsUUFBQSxDQUFDLEtBQWEsUUFBQTtBQUVsQixRQUFJLFdBQVcsWUFBWTtBQUNyQixVQUFBLFdBQVcsSUFBSSxNQUFNLFFBQVE7QUFDekIsY0FBQSxXQUFXLE1BQU0sV0FBVyxDQUFDO0FBQ25DLFlBQUksVUFBVTtBQUVKLGtCQUFBLFNBQVMsWUFBWSxLQUFLLGFBQWE7QUFBQSxRQUFBO0FBQUEsTUFDakQ7QUFHRixVQUFJLFdBQVc7QUFDZixlQUFTLElBQUksWUFBWSxLQUFLLFVBQVUsS0FBSztBQUUvQixzQkFBQUEsTUFBQSxNQUFNLENBQUMsTUFBUCxnQkFBQUEsSUFBVSxhQUFZO0FBQUEsTUFBQTtBQUU3QixhQUFBLEtBQUssSUFBSSxVQUFVLEdBQUk7QUFBQSxJQUFBLE9BQ3pCO0FBQ0QsVUFBQSxhQUFhLElBQUksTUFBTSxRQUFRO0FBQzNCLGNBQUEsV0FBVyxNQUFNLGFBQWEsQ0FBQztBQUNyQyxZQUFJLFVBQVU7QUFFWixnQkFBTSxzQkFBc0IsU0FBUyxZQUFZLEtBQUssYUFBYTtBQUNuRSxpQkFBTyxLQUFLLElBQUksS0FBSyxJQUFJLG9CQUFvQixHQUFJLEdBQUcsR0FBSTtBQUFBLFFBQUE7QUFBQSxNQUMxRDtBQUdGLGFBQU8sS0FBSyxJQUFJLEtBQUssWUFBWSxLQUFNLEdBQUk7QUFBQSxJQUFBO0FBQUEsRUFFL0M7Ozs7Ozs7Ozs7O0FDL0RPLFFBQU0rTixjQUE0Q3hOLENBQVUsVUFBQTtBQUNqRSxVQUFNeU4sYUFBYUEsTUFBTS9KLEtBQUtnSyxJQUFJLEtBQUtoSyxLQUFLaUssSUFBSSxHQUFJM04sTUFBTTROLFVBQVU1TixNQUFNNk4sUUFBUyxHQUFHLENBQUM7QUFFdkYsWUFBQSxNQUFBO0FBQUEsVUFBQTVOLE9BQUFDLFNBQUFBLEdBQUFDLFFBQUFGLEtBQUFHO0FBQUFzRix5QkFBQUMsQ0FBQSxRQUFBO0FBQUFDLFlBQUFBLE1BQ2MvRSxHQUFHLDZCQUE2QmIsTUFBTWMsS0FBSyxHQUFDK0UsT0FHcEMsR0FBRzRILFdBQVksQ0FBQTtBQUFHN0gsZ0JBQUFELElBQUFJLEtBQUFuRixVQUFBWCxNQUFBMEYsSUFBQUksSUFBQUgsR0FBQTtBQUFBQyxpQkFBQUYsSUFBQU0sT0FBQU4sSUFBQU0sSUFBQUosU0FBQSxPQUFBMUYsTUFBQWIsTUFBQTZHLFlBQUFOLFNBQUFBLElBQUEsSUFBQTFGLE1BQUFiLE1BQUE4RyxlQUFBLE9BQUE7QUFBQVQsZUFBQUE7QUFBQUEsTUFBQUEsR0FBQTtBQUFBLFFBQUFJLEdBQUFNO0FBQUFBLFFBQUFKLEdBQUFJO0FBQUFBLE1BQUFBLENBQUE7QUFBQXBHLGFBQUFBO0FBQUFBLElBQUFBLEdBQUE7QUFBQSxFQUkxQzs7O0FDMk5DSCxpQkFBQSxDQUFBLE9BQUEsQ0FBQTs7Ozs7Ozs7Ozs7O0FDek9NLFFBQU1nTyxtQkFBc0Q5TixDQUFVLFVBQUE7QUFDM0UsWUFBQSxNQUFBO0FBQUEsVUFBQUMsT0FBQUMsU0FBQUEsR0FBQUMsUUFBQUYsS0FBQUc7QUFBQWxCLFdBQUFBLGlCQXdCbUI2RyxjQUFBQSxDQUFNLE1BQUE7QUFDakJnSSxVQUFBQSxjQUFjek8sTUFBTTBPLFlBQVk7QUFBQSxNQUFBLENBQ25DO0FBQUE5TyxXQUFBQSxpQkFMYzZHLGNBQUFBLENBQU0sTUFBQTtBQUNqQmdJLFVBQUFBLGNBQWN6TyxNQUFNME8sWUFBWTtBQUFBLE1BQUEsQ0FDbkM7QUFBQXJHLHlCQUFBMUgsTUFyQlFELFNBQUFBLE1BQU1xTixTQUFPLElBQUE7QUFBQS9OLFdBQUFBLE1BQUE2RyxZQUFBLFlBQUEsT0FBQTtBQUFBN0csV0FBQUEsTUFBQTZHLFlBQUEsVUFBQSxNQUFBO0FBQUE3RyxXQUFBQSxNQUFBNkcsWUFBQSxTQUFBLE1BQUE7QUFBQTdHLFdBQUFBLE1BQUE2RyxZQUFBLFNBQUEsTUFBQTtBQUFBN0csV0FBQUEsTUFBQTZHLFlBQUEsVUFBQSxNQUFBO0FBQUE3RyxXQUFBQSxNQUFBNkcsWUFBQSxpQkFBQSxLQUFBO0FBQUE3RyxXQUFBQSxNQUFBNkcsWUFBQSxjQUFBLG1EQUFBO0FBQUE3RyxXQUFBQSxNQUFBNkcsWUFBQSxjQUFBLCtCQUFBO0FBQUE3RyxXQUFBQSxNQUFBNkcsWUFBQSxXQUFBLE1BQUE7QUFBQTdHLFdBQUFBLE1BQUE2RyxZQUFBLGVBQUEsUUFBQTtBQUFBN0csV0FBQUEsTUFBQTZHLFlBQUEsbUJBQUEsUUFBQTtBQUFBN0csV0FBQUEsTUFBQTZHLFlBQUEsWUFBQSxRQUFBO0FBQUE3RyxXQUFBQSxNQUFBNkcsWUFBQSxVQUFBLFNBQUE7QUFBQTdHLFdBQUFBLE1BQUE2RyxZQUFBLFdBQUEsT0FBQTtBQUFBN0csV0FBQUEsTUFBQTZHLFlBQUEsVUFBQSxNQUFBO0FBQUE3RyxXQUFBQSxNQUFBNkcsWUFBQSxjQUFBLHFCQUFBO0FBQUE3RyxZQUFBQSxNQUFBNkcsWUFBQSxhQUFBLE1BQUE7QUFBQWxHLGFBQUFBO0FBQUFBLElBQUFBLEdBQUE7QUFBQSxFQWtDNUI7QUFBRUgsaUJBQUEsQ0FBQSxPQUFBLENBQUE7Ozs7QUNoQ0ssUUFBTW1PLGlCQUFrRGpPLENBQVUsVUFBQTtBQUN2RSxXQUFBMkIsZ0JBQ0dDLE1BQUk7QUFBQSxNQUFBLElBQUNDLE9BQUk7QUFBQSxlQUFFN0IsTUFBTWtPO0FBQUFBLE1BQUs7QUFBQSxNQUFBLElBQUF4UCxXQUFBO0FBQUEsWUFBQXVCLE9BQUFDLFNBQUFBLEdBQUFDLFFBQUFGLEtBQUFHO0FBQUFELGVBQUFBLE9BR2hCSCxNQUFBQSxNQUFNa08sS0FBSztBQUFBdE4sMkJBQUFBLE1BQUFBLFVBQUFYLE1BRkRZLEdBQUcsNkRBQTZEYixNQUFNYyxLQUFLLENBQUMsQ0FBQTtBQUFBYixlQUFBQTtBQUFBQSxNQUFBQTtBQUFBQSxJQUFBLENBQUE7QUFBQSxFQU9qRzs7OztBQ05PLFFBQU1rTyxpQkFBa0RuTyxDQUFVLFVBQUE7QUFDdkUsWUFBQSxNQUFBO0FBQUEsVUFBQUMsT0FBQUMsU0FBQUEsR0FBQUMsUUFBQUYsS0FBQUc7QUFBQUQsYUFBQUEsT0FBQXdCLGdCQUdPQyxNQUFJO0FBQUEsUUFBQSxJQUNIQyxPQUFJO0FBQUEsaUJBQUUsQ0FBQzdCLE1BQU1vTztBQUFBQSxRQUFXO0FBQUEsUUFBQSxJQUN4QjVILFdBQVE7QUFBQSxpQkFBQTdFLGdCQUNMWixRQUFNO0FBQUEsWUFDTEksU0FBTztBQUFBLFlBQ1BDLE1BQUk7QUFBQSxZQUNKTSxXQUFTO0FBQUEsWUFBQSxJQUNUMkwsVUFBTztBQUFBLHFCQUFFck4sTUFBTXFPO0FBQUFBLFlBQU07QUFBQSxZQUFBLElBQ3JCN00sV0FBUTtBQUFBLHFCQUFFeEIsTUFBTXNPO0FBQUFBLFlBQVk7QUFBQSxZQUFBNVAsVUFBQTtBQUFBLFVBQUEsQ0FBQTtBQUFBLFFBQUE7QUFBQSxRQUFBLElBQUFBLFdBQUE7QUFBQSxpQkFBQWlELGdCQU0vQkMsTUFBSTtBQUFBLFlBQUEsSUFDSEMsT0FBSTtBQUFBLHFCQUFFN0IsTUFBTXVPO0FBQUFBLFlBQVM7QUFBQSxZQUFBLElBQ3JCL0gsV0FBUTtBQUFBLHFCQUFBN0UsZ0JBQ0xaLFFBQU07QUFBQSxnQkFDTEksU0FBTztBQUFBLGdCQUNQQyxNQUFJO0FBQUEsZ0JBQ0pNLFdBQVM7QUFBQSxnQkFBQSxJQUNUMkwsVUFBTztBQUFBLHlCQUFFck4sTUFBTXdPO0FBQUFBLGdCQUFRO0FBQUEsZ0JBQUEsSUFDdkJoTixXQUFRO0FBQUEseUJBQUV4QixNQUFNc087QUFBQUEsZ0JBQVk7QUFBQSxnQkFBQTVQLFVBQUE7QUFBQSxjQUFBLENBQUE7QUFBQSxZQUFBO0FBQUEsWUFBQSxJQUFBQSxXQUFBO0FBQUEscUJBQUFpRCxnQkFNL0JaLFFBQU07QUFBQSxnQkFDTEksU0FBTztBQUFBLGdCQUNQQyxNQUFJO0FBQUEsZ0JBQ0pNLFdBQVM7QUFBQSxnQkFBQSxJQUNUMkwsVUFBTztBQUFBLHlCQUFFck4sTUFBTXlPO0FBQUFBLGdCQUFRO0FBQUEsZ0JBQUEsSUFDdkJqTixXQUFRO0FBQUEseUJBQUV4QixNQUFNc087QUFBQUEsZ0JBQVk7QUFBQSxnQkFBQSxJQUFBNVAsV0FBQTtBQUUzQnNCLHlCQUFBQSxNQUFNc08sZUFBZSxrQkFBa0I7QUFBQSxnQkFBQTtBQUFBLGNBQVEsQ0FBQTtBQUFBLFlBQUE7QUFBQSxVQUFBLENBQUE7QUFBQSxRQUFBO0FBQUEsTUFBQSxDQUFBLENBQUE7QUFBQTFOLHlCQUFBQSxNQUFBQSxVQUFBWCxNQXJDM0NZLEdBQUcsMkNBQTJDYixNQUFNYyxLQUFLLENBQUMsQ0FBQTtBQUFBYixhQUFBQTtBQUFBQSxJQUFBQSxHQUFBO0FBQUEsRUE0QzdFOzs7O0FDN0RBLFFBQUEsc0JBQWdCeU8sUUFBQyxNQUFBO0FBQUEsUUFBQXpPLE9BQUFDLFNBQUE7QUFBQXdGLDZCQUFBTSxhQUFBL0YsTUFBa0J5TyxTQUFBQSxFQUFFNU4sS0FBSyxDQUFBO0FBQUFiLFdBQUFBO0FBQUFBLEVBQUEsR0FBbVk7OztBQ0E3YSxRQUFBLGtCQUFnQnlPLFFBQUMsTUFBQTtBQUFBLFFBQUF6TyxPQUFBQyxTQUFBO0FBQUF3Riw2QkFBQU0sYUFBQS9GLE1BQWtCeU8sU0FBQUEsRUFBRTVOLEtBQUssQ0FBQTtBQUFBYixXQUFBQTtBQUFBQSxFQUFBLEdBQXljOzs7QUNlNWUsUUFBTTBPLGlCQUFrRDNPLENBQVUsVUFBQTtBQUN2RSxZQUFBLE1BQUE7QUFBQSxVQUFBQyxPQUFBQyxTQUFBQSxHQUFBQyxRQUFBRixLQUFBRztBQUFBRCxhQUFBQSxPQUFBd0IsZ0JBR09DLE1BQUk7QUFBQSxRQUFBLElBQ0hDLE9BQUk7QUFBQSxpQkFBRTdCLE1BQU00TyxTQUFTO0FBQUEsUUFBTztBQUFBLFFBQUEsSUFDNUJwSSxXQUFRO0FBQUEsa0JBQUEsTUFBQTtBQUFBLGdCQUFBbkcsUUFBQWlLLFVBQUE7QUFBQWpLLG1CQUFBQSxPQUFBc0IsZ0JBRUxDLE1BQUk7QUFBQSxjQUFBLElBQUNDLE9BQUk7QUFBQSx1QkFBRTdCLE1BQU02TyxjQUFjeEk7QUFBQUEsY0FBUztBQUFBLGNBQUEsSUFBQTNILFdBQUE7QUFBQSxvQkFBQTRCLFFBQUFlLFVBQUEsR0FBQWIsUUFBQUYsTUFBQUYsWUFBQXNHLFFBQUFsRyxNQUFBSjtBQUFBRSx1QkFBQUEsT0FBQXFCLGdCQUVwQ0MsTUFBSTtBQUFBLGtCQUFBLElBQ0hDLE9BQUk7QUFBQSwyQkFBRTdCLE1BQU02TztBQUFBQSxrQkFBUztBQUFBLGtCQUFBLElBQ3JCckksV0FBUTtBQUFBLDJCQUFBN0UsZ0JBQUdtTixpQkFBZTtBQUFBLHNCQUFBLFNBQUE7QUFBQSxzQkFBOEN4UCxPQUFLO0FBQUEsb0JBQUEsQ0FBQTtBQUFBLGtCQUFBO0FBQUEsa0JBQUEsSUFBQVosV0FBQTtBQUFBLDJCQUFBaUQsZ0JBRTVFb04scUJBQW1CO0FBQUEsc0JBQUEsU0FBQTtBQUFBLHNCQUFnRHpQLE9BQUs7QUFBQSxvQkFBQSxDQUFBO0FBQUEsa0JBQUE7QUFBQSxnQkFBQSxDQUFBLEdBQUFrQixLQUFBO0FBQUFDLHVCQUFBaUcsT0FJdEUxRyxNQUFBQSxNQUFNNk8sWUFBWSxhQUFhLFdBQVc7QUFBQXJPLHVCQUFBQSxPQUFBbUIsZ0JBRTVDQyxNQUFJO0FBQUEsa0JBQUEsSUFBQ0MsT0FBSTtBQUFFN0IsMkJBQUFBLE1BQU0yTSxnQkFBZ0IsQ0FBQzNNLE1BQU02TztBQUFBQSxrQkFBUztBQUFBLGtCQUFBLElBQUFuUSxXQUFBO0FBQUEsd0JBQUFpSSxRQUFBNUUsVUFBQTtBQUFBNEUsMkJBQUFBLE9BQ04zRyxNQUFBQSxNQUFNMk0sWUFBWTtBQUFBaEcsMkJBQUFBO0FBQUFBLGtCQUFBQTtBQUFBQSxnQkFBQSxDQUFBLEdBQUEsSUFBQTtBQUFBcUksbUNBQUFBLENBQUFBLFFBQUFDLE1BQUF2SSxPQUp6QixVQUFVMUcsTUFBTTZPLFlBQVksWUFBWSxTQUFTLEtBQUdHLEdBQUEsQ0FBQTtBQUFBMU8sdUJBQUFBO0FBQUFBLGNBQUFBO0FBQUFBLFlBQUEsQ0FBQSxHQUFBLElBQUE7QUFBQUQsbUJBQUFBLE9BQUFzQixnQkFTOUZaLFFBQU07QUFBQSxjQUNMSSxTQUFPO0FBQUEsY0FDUEMsTUFBSTtBQUFBLGNBQUEsSUFDSmlNLFVBQU87QUFBQSx1QkFBRXJOLE1BQU1rUDtBQUFBQSxjQUFVO0FBQUEsY0FBQSxTQUFBO0FBQUEsY0FBQSxJQUFBeFEsV0FBQTtBQUFBLHVCQUd4QnNCLE1BQU1tUCxpQkFBaUI7QUFBQSxjQUFBO0FBQUEsWUFBTSxDQUFBLEdBQUEsSUFBQTtBQUFBOU8sbUJBQUFBO0FBQUFBLFVBQUFBLEdBQUE7QUFBQSxRQUFBO0FBQUEsUUFBQSxJQUFBM0IsV0FBQTtBQUFBLGlCQUFBaUQsZ0JBS25DWixRQUFNO0FBQUEsWUFDTEksU0FBTztBQUFBLFlBQ1BDLE1BQUk7QUFBQSxZQUNKTSxXQUFTO0FBQUEsWUFBQSxJQUNUMkwsVUFBTztBQUFBLHFCQUFFck4sTUFBTW9QO0FBQUFBLFlBQU87QUFBQSxZQUFBMVEsVUFBQTtBQUFBLFVBQUEsQ0FBQTtBQUFBLFFBQUE7QUFBQSxNQUFBLENBQUEsQ0FBQTtBQUFBdUIsYUFBQUE7QUFBQUEsSUFBQUEsR0FBQTtBQUFBLEVBUWhDOzs7O0FDdkRPLFFBQU1vUCxtQkFBc0RyUCxDQUFVLFVBQUE7QUFDM0UsWUFBQSxNQUFBO0FBQUEsVUFBQUMsT0FBQUMsU0FBQSxHQUFBQyxRQUFBRixLQUFBRyxZQUFBQyxRQUFBRixNQUFBQztBQUFBSyxhQUFBSixRQUFBLE1BQUE7QUFBQSxZQUFBaVAsTUFBQUMsS0FJU3ZQLE1BQUFBLENBQUFBLENBQUFBLE1BQU13UCxlQUFlO0FBQUEsZUFBQSxNQUFyQkYsSUFBQSxNQUFBLE1BQUE7QUFBQSxjQUFBaFAsUUFBQXlCLFVBQUE7QUFBQXpCLGlCQUFBQSxPQUVJTixNQUFBQSxNQUFNd1AsZUFBZTtBQUFBbFAsaUJBQUFBO0FBQUFBLFFBQUFBLEdBRXpCO0FBQUEsTUFBQSxHQUFBLEdBQUEsSUFBQTtBQUFBRyxhQUFBSixPQUNBTCxNQUFBQSxNQUFNdEIsVUFBUSxJQUFBO0FBQUFrQyx5QkFBQUEsTUFBQUEsVUFBQVgsTUFSVFksR0FBRyw2Q0FBNkNiLE1BQU1jLEtBQUssQ0FBQyxDQUFBO0FBQUFiLGFBQUFBO0FBQUFBLElBQUFBLEdBQUE7QUFBQSxFQWE1RTs7OztBQ2RPLFFBQU13UCxZQUF3Q3pQLENBQVUsVUFBQTtBQUM3RCxZQUFBLE1BQUE7QUFBQSxVQUFBQyxPQUFBOEIsVUFBQUEsR0FBQTVCLFFBQUFGLEtBQUFHO0FBQUFELGFBQUFBLE9BR09ILE1BQUFBLE1BQU0wUCxNQUFNO0FBQUF6UCxhQUFBQSxNQUFBMEIsZ0JBR2RDLE1BQUk7QUFBQSxRQUFBLElBQUNDLE9BQUk7QUFBQSxpQkFBRTdCLE1BQU0yUDtBQUFBQSxRQUFjO0FBQUEsUUFBQSxJQUFBalIsV0FBQTtBQUFBLGNBQUEyQixRQUFBSCxTQUFBLEdBQUFJLFFBQUFELE1BQUFELFlBQUFJLFFBQUFGLE1BQUFDO0FBQUFDLGlCQUFBQSxPQUl6QlIsTUFBQUEsTUFBTTJQLGNBQWM7QUFBQXRQLGlCQUFBQTtBQUFBQSxRQUFBQTtBQUFBQSxNQUFBLENBQUEsR0FBQSxJQUFBO0FBQUFPLHlCQUFBQSxNQUFBQSxVQUFBWCxNQVRqQlksR0FBRyxhQUFhYixNQUFNYyxLQUFLLENBQUMsQ0FBQTtBQUFBYixhQUFBQTtBQUFBQSxJQUFBQSxHQUFBO0FBQUEsRUFlNUM7OztBQzFCTyxRQUFNLGdCQUFOLE1BQU0sY0FBYTtBQUFBLElBS2hCLGNBQWM7QUFIZCx3REFBNEMsSUFBSTtBQUNoRCxxQ0FBbUI7QUFJcEIsV0FBQSxVQUFVLFdBQVcscUJBQXFCO0FBQzFDLFdBQUEsVUFBVSxhQUFhLHVCQUF1QjtBQUFBLElBQUE7QUFBQSxJQUdyRCxPQUFPLGNBQTRCO0FBQzdCLFVBQUEsQ0FBQyxjQUFhLFVBQVU7QUFDYixzQkFBQSxXQUFXLElBQUksY0FBYTtBQUFBLE1BQUE7QUFFM0MsYUFBTyxjQUFhO0FBQUEsSUFBQTtBQUFBLElBR2QsVUFBVSxNQUFjLE1BQWM7QUFDeEMsVUFBQSxPQUFPLFdBQVcsWUFBYTtBQUU3QixZQUFBLFFBQVEsSUFBSSxNQUFNLElBQUk7QUFDNUIsWUFBTSxVQUFVO0FBQ2hCLFlBQU0sU0FBUztBQUNWLFdBQUEsT0FBTyxJQUFJLE1BQU0sS0FBSztBQUFBLElBQUE7QUFBQSxJQUc3QixLQUFLLFdBQW9DO0FBQ25DLFVBQUEsQ0FBQyxLQUFLLFFBQVM7QUFFbkIsWUFBTSxRQUFRLEtBQUssT0FBTyxJQUFJLFNBQVM7QUFDdkMsVUFBSSxPQUFPO0FBRUgsY0FBQSxRQUFRLE1BQU0sVUFBVTtBQUM5QixjQUFNLFNBQVMsTUFBTTtBQUNmLGNBQUEsS0FBQSxFQUFPLE1BQU0sQ0FBTyxRQUFBO0FBQ2hCLGtCQUFBLEtBQUsseUJBQXlCLEdBQUc7QUFBQSxRQUFBLENBQzFDO0FBQUEsTUFBQTtBQUFBLElBQ0g7QUFBQSxJQUdGLFVBQVUsUUFBZ0I7QUFDbEIsWUFBQSxnQkFBZ0IsS0FBSyxJQUFJLEdBQUcsS0FBSyxJQUFJLEdBQUcsTUFBTSxDQUFDO0FBQ2hELFdBQUEsT0FBTyxRQUFRLENBQVMsVUFBQTtBQUMzQixjQUFNLFNBQVM7QUFBQSxNQUFBLENBQ2hCO0FBQUEsSUFBQTtBQUFBLElBR0gsV0FBVyxTQUFrQjtBQUMzQixXQUFLLFVBQVU7QUFBQSxJQUFBO0FBQUEsSUFHakIsWUFBWTtBQUNWLGFBQU8sS0FBSztBQUFBLElBQUE7QUFBQSxFQUVoQjtBQXRERSxnQkFEVyxlQUNJO0FBRFYsTUFBTSxlQUFOO0FBMERNLFFBQUEsZUFBZSxhQUFhLFlBQVk7Ozs7Ozs7QUN4QzlDLFFBQU0yUCx1QkFBOEQ1UCxDQUFVLFVBQUE7QUFDbkYsVUFBTSxDQUFDNlAsc0JBQXNCQyx1QkFBdUIsSUFBSTFOLGFBQWEsQ0FBQztBQUN0RSxVQUFNLENBQUNnTSxhQUFhMkIsY0FBYyxJQUFJM04sYUFBYSxLQUFLO0FBQ3hELFVBQU0sQ0FBQ2tNLGNBQWMwQixlQUFlLElBQUk1TixhQUFhLEtBQUs7QUFDMUQsVUFBTSxDQUFDdU4sZ0JBQWdCTSxpQkFBaUIsSUFBSTdOLGFBQWEsRUFBRTtBQUMzRCxVQUFNLENBQUM4TixjQUFjQyxlQUFlLElBQUkvTixhQUE0QixJQUFJO0FBQ3hFLFVBQU0sQ0FBQ2dPLGVBQWVDLGdCQUFnQixJQUFJak8sYUFBbUMsSUFBSTtBQUNqRixVQUFNLENBQUNrTyxhQUFhQyxjQUFjLElBQUluTyxhQUFxQixDQUFBLENBQUU7QUFDN0QsVUFBTSxDQUFDb08sY0FBY0MsZUFBZSxJQUFJck8sYUFBYSxLQUFLO0FBQzFELFVBQU0sQ0FBQ3lNLFdBQVc2QixZQUFZLElBQUl0TyxhQUFhLEtBQUs7QUFFOUN1TyxVQUFBQSxhQUFhQSxNQUFNM1EsTUFBTTJRLGNBQWM7QUFHN0MsVUFBTSxDQUFDQyxTQUFTLElBQUlDLGVBQWUsWUFBWTtBQUN6QyxVQUFBO0FBRUYsY0FBTUMsTUFBTTlRLE1BQU0rUSxZQUNkLEdBQUdKLFdBQVcsQ0FBQyw4Q0FBOEMzUSxNQUFNK1EsU0FBUyxLQUM1RSxHQUFHSixXQUFBQSxDQUFZO0FBRW5CLGNBQU1LLFVBQXVCLENBQUM7QUFDOUIsWUFBSWhSLE1BQU1pUixXQUFXO0FBQ25CRCxrQkFBUSxlQUFlLElBQUksVUFBVWhSLE1BQU1pUixTQUFTO0FBQUEsUUFBQTtBQUdoREMsY0FBQUEsV0FBVyxNQUFNQyxNQUFNTCxLQUFLO0FBQUEsVUFBRUU7QUFBQUEsUUFBQUEsQ0FBUztBQUN6QyxZQUFBLENBQUNFLFNBQVNFLElBQUk7QUFDVkMsZ0JBQUFBLFlBQVksTUFBTUgsU0FBU3pMLEtBQUs7QUFDdEM3QixrQkFBUW5GLE1BQU0scUNBQXFDeVMsU0FBU0ksUUFBUUQsU0FBUztBQUN2RSxnQkFBQSxJQUFJN0UsTUFBTSwyQkFBMkI7QUFBQSxRQUFBO0FBRXZDK0UsY0FBQUEsT0FBTyxNQUFNTCxTQUFTTSxLQUFLO0FBRWpDLFlBQUlELEtBQUtBLFFBQVFBLEtBQUtBLEtBQUtYLFdBQVc7QUFDcEMsaUJBQU9XLEtBQUtBLEtBQUtYO0FBQUFBLFFBQUFBO0FBRW5CLGVBQU8sQ0FBRTtBQUFBLGVBQ0ZuUyxPQUFPO0FBQ05BLGdCQUFBQSxNQUFNLDJDQUEyQ0EsS0FBSztBQUM5RCxlQUFPLENBQUU7QUFBQSxNQUFBO0FBQUEsSUFDWCxDQUNEO0FBR0RvRSxpQkFBYSxNQUFNO0FBQ0krTixnQkFBVTtBQUFBLElBQUEsQ0FDaEM7QUFFRCxVQUFNYSx1QkFBdUIsWUFBWTtBQUN2Q3hCLHdCQUFrQixFQUFFO0FBQ3BCRSxzQkFBZ0IsSUFBSTtBQUNwQkkscUJBQWUsQ0FBQSxDQUFFO0FBRWIsVUFBQTtBQUNGLGNBQU1tQixTQUFTLE1BQU1DLFVBQVVDLGFBQWFDLGFBQWE7QUFBQSxVQUN2REMsT0FBTztBQUFBLFlBQ0xDLGtCQUFrQjtBQUFBLFlBQ2xCQyxrQkFBa0I7QUFBQSxZQUNsQkMsaUJBQWlCO0FBQUEsVUFBQTtBQUFBLFFBQ25CLENBQ0Q7QUFFRCxjQUFNQyxXQUFXQyxjQUFjQyxnQkFBZ0Isd0JBQXdCLElBQ25FLDJCQUNBO0FBRUVDLGNBQUFBLFdBQVcsSUFBSUYsY0FBY1QsUUFBUTtBQUFBLFVBQUVRO0FBQUFBLFFBQUFBLENBQVU7QUFDdkQsY0FBTUksU0FBaUIsQ0FBRTtBQUV6QkQsaUJBQVNFLGtCQUFtQkMsQ0FBVSxVQUFBO0FBQ2hDQSxjQUFBQSxNQUFNakIsS0FBS25RLE9BQU8sR0FBRztBQUNoQnFSLG1CQUFBQSxLQUFLRCxNQUFNakIsSUFBSTtBQUFBLFVBQUE7QUFBQSxRQUUxQjtBQUVBYyxpQkFBU0ssU0FBUyxZQUFZO0FBQ3RCQyxnQkFBQUEsWUFBWSxJQUFJQyxLQUFLTixRQUFRO0FBQUEsWUFBRU8sTUFBTVg7QUFBQUEsVUFBQUEsQ0FBVTtBQUNyRCxnQkFBTVksaUJBQWlCSCxTQUFTO0FBR2hDakIsaUJBQU9xQixZQUFZQyxRQUFRQyxDQUFTQSxVQUFBQSxNQUFNQyxNQUFNO0FBQUEsUUFDbEQ7QUFFQWIsaUJBQVNjLE1BQU07QUFDZjlDLHlCQUFpQmdDLFFBQVE7QUFDekJ0Qyx1QkFBZSxJQUFJO0FBQUEsZUFFWnRSLE9BQU87QUFDTkEsZ0JBQUFBLE1BQU0scURBQXFEQSxLQUFLO0FBQ3hFc1IsdUJBQWUsS0FBSztBQUFBLE1BQUE7QUFBQSxJQUV4QjtBQUVNK0MsVUFBQUEsbUJBQW1CLE9BQU9NLFNBQWU7O0FBQ3pDLFVBQUE7QUFDRnBELHdCQUFnQixJQUFJO0FBR2RxRCxjQUFBQSxTQUFTLElBQUlDLFdBQVc7QUFDOUIsY0FBTUMsU0FBUyxNQUFNLElBQUlDLFFBQWlCQyxDQUFZLFlBQUE7QUFDcERKLGlCQUFPSyxZQUFZLE1BQU07QUFDdkIsa0JBQU1DLGVBQWVOLE9BQU94VTtBQUM1QjRVLG9CQUFRRSxhQUFhckksTUFBTSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBQUEsVUFDcEM7QUFDQStILGlCQUFPTyxjQUFjUixJQUFJO0FBQUEsUUFBQSxDQUMxQjtBQUdHbEMsWUFBQUE7QUFDSixZQUFJMkMsV0FBVztBQUNmLGNBQU1DLGNBQWM7QUFFcEIsY0FBTTlDLFVBQXVCO0FBQUEsVUFBRSxnQkFBZ0I7QUFBQSxRQUFtQjtBQUNsRSxZQUFJaFIsTUFBTWlSLFdBQVc7QUFDbkJELGtCQUFRLGVBQWUsSUFBSSxVQUFVaFIsTUFBTWlSLFNBQVM7QUFBQSxRQUFBO0FBR3RELGVBQU80QyxXQUFXQyxhQUFhO0FBQ3pCLGNBQUE7QUFDRjVDLHVCQUFXLE1BQU1DLE1BQU0sR0FBR1IsV0FBWSxDQUFBLGtDQUFrQztBQUFBLGNBQ3RFb0QsUUFBUTtBQUFBLGNBQ1IvQztBQUFBQSxjQUNBZ0QsTUFBTUMsS0FBS0MsVUFBVTtBQUFBLGdCQUNuQkMsYUFBYVo7QUFBQUEsZ0JBQ2JhLGVBQWNDLE1BQUFBLHNCQUFBQSxnQkFBQUEsSUFBbUJDO0FBQUFBO0FBQUFBLGdCQUVqQ0MsZ0JBQWdCVixXQUFXO0FBQUEsY0FDNUIsQ0FBQTtBQUFBLFlBQUEsQ0FDRjtBQUVELGdCQUFJM0MsU0FBU0UsSUFBSTtBQUNmO0FBQUEsWUFBQTtBQUFBLG1CQUVLb0QsWUFBWTtBQUNuQjVRLG9CQUFRbkYsTUFBTSxzQ0FBc0NvVixXQUFXLENBQUMsWUFBWVcsVUFBVTtBQUFBLFVBQUE7QUFHeEZYO0FBQ0EsY0FBSUEsV0FBV0MsYUFBYTtBQUMxQixrQkFBTSxJQUFJTixRQUFRQyxDQUFBQSxZQUFXaEssV0FBV2dLLFNBQVMsR0FBRyxDQUFDO0FBQUEsVUFBQTtBQUFBLFFBQ3ZEO0FBR0V2QyxZQUFBQSxZQUFZQSxTQUFTRSxJQUFJO0FBQ3JCdlMsZ0JBQUFBLFVBQVMsTUFBTXFTLFNBQVNNLEtBQUs7QUFDakIzUyw0QkFBQUEsUUFBTzBTLEtBQUtrRCxVQUFVO0FBR2xDL1QsZ0JBQUFBLFFBQVFnVSxpQkFBZUwsTUFBQUEsZ0JBQWdCLE1BQWhCQSxnQkFBQUEsSUFBbUJDLGNBQWEsSUFBSXpWLFFBQU8wUyxLQUFLa0QsVUFBVTtBQUN2RnRFLDBCQUFnQnpQLEtBQUs7QUFHckIsZ0JBQU1pVSxpQkFBaUJqVSxLQUFLO0FBQUEsUUFBQSxPQUN2QjtBQUNDLGdCQUFBLElBQUk4TCxNQUFNLDBCQUEwQjtBQUFBLFFBQUE7QUFBQSxlQUVyQy9OLE9BQU87QUFDTkEsZ0JBQUFBLE1BQU0sdURBQXVEQSxLQUFLO0FBQUEsTUFBQSxVQUNsRTtBQUNSdVIsd0JBQWdCLEtBQUs7QUFBQSxNQUFBO0FBQUEsSUFFekI7QUFFQSxVQUFNNEUsc0JBQXNCQSxNQUFNO0FBQ2hDLFlBQU12QyxXQUFXakMsY0FBYztBQUMzQmlDLFVBQUFBLFlBQVlBLFNBQVN3QyxVQUFVLFlBQVk7QUFDN0N4QyxpQkFBU2EsS0FBSztBQUNkbkQsdUJBQWUsS0FBSztBQUFBLE1BQUE7QUFBQSxJQUV4QjtBQUdNK0UsVUFBQUEsZ0JBQWdCQSxDQUFDclAsU0FBeUI7QUFDdkNBLGFBQUFBLEtBQ0pzUCxjQUNBdkosUUFBUSxjQUFjLEVBQUUsRUFDeEJBLFFBQVEsUUFBUSxHQUFHLEVBQ25Cd0osS0FBSztBQUFBLElBQ1Y7QUFFTU4sVUFBQUEsaUJBQWlCQSxDQUFDTyxVQUFrQkMsV0FBMkI7QUFDN0RDLFlBQUFBLHFCQUFxQkwsY0FBY0csUUFBUTtBQUMzQ0csWUFBQUEsbUJBQW1CTixjQUFjSSxNQUFNO0FBRzdDLFVBQUlDLHVCQUF1QkMsa0JBQWtCO0FBQ3BDLGVBQUE7QUFBQSxNQUFBO0FBSUhDLFlBQUFBLGdCQUFnQkYsbUJBQW1CN0osTUFBTSxLQUFLO0FBQzlDZ0ssWUFBQUEsY0FBY0YsaUJBQWlCOUosTUFBTSxLQUFLO0FBQ2hELFVBQUlpSyxVQUFVO0FBRWQsZUFBU3pXLElBQUksR0FBR0EsSUFBSXVXLGNBQWNyUyxRQUFRbEUsS0FBSztBQUM3QyxZQUFJd1csWUFBWXhXLENBQUMsTUFBTXVXLGNBQWN2VyxDQUFDLEdBQUc7QUFDdkN5VztBQUFBQSxRQUFBQTtBQUFBQSxNQUNGO0FBR0YsYUFBTzdSLEtBQUs4UixNQUFPRCxVQUFVRixjQUFjclMsU0FBVSxHQUFHO0FBQUEsSUFDMUQ7QUFFTTJSLFVBQUFBLG1CQUFtQixPQUFPalUsVUFBa0I7O0FBQ2hELFlBQU0yVCxvQkFBa0J6RCxNQUFBQSxnQkFBQUEsZ0JBQUFBLElBQWNmO0FBQ3RDLFlBQU15QyxTQUFTaEMsWUFBWTtBQUMzQixZQUFNOEMsT0FBT2QsT0FBT3RQLFNBQVMsSUFBSSxJQUFJNFAsS0FBS04sUUFBUTtBQUFBLFFBQUVPLE1BQU07QUFBQSxNQUFjLENBQUEsSUFBSTtBQUc1RW5DLG1CQUFhaFEsVUFBVSxHQUFHO0FBQzFCK1Asc0JBQWdCLElBQUk7QUFHcEJnRixtQkFBYUMsS0FBS2hWLFVBQVUsTUFBTSxZQUFZLFdBQVc7QUFFekQsVUFBSTJULG9CQUFtQkEsaUJBQWdCc0IsU0FBUzNTLFNBQVMsS0FBS29RLE1BQU07QUFDOUQsWUFBQTtBQUVJQyxnQkFBQUEsU0FBUyxJQUFJQyxXQUFXO0FBQzlCLGdCQUFNQyxTQUFTLE1BQU0sSUFBSUMsUUFBaUJDLENBQVksWUFBQTtBQUNwREosbUJBQU9LLFlBQVksTUFBTTtBQUN2QixvQkFBTUMsZUFBZU4sT0FBT3hVO0FBQzVCNFUsc0JBQVFFLGFBQWFySSxNQUFNLEdBQUcsRUFBRSxDQUFDLENBQUM7QUFBQSxZQUNwQztBQUNBK0gsbUJBQU9PLGNBQWNSLElBQUk7QUFBQSxVQUFBLENBQzFCO0FBRUQsZ0JBQU1wQyxVQUF1QjtBQUFBLFlBQUUsZ0JBQWdCO0FBQUEsVUFBbUI7QUFDbEUsY0FBSWhSLE1BQU1pUixXQUFXO0FBQ25CRCxvQkFBUSxlQUFlLElBQUksVUFBVWhSLE1BQU1pUixTQUFTO0FBQUEsVUFBQTtBQUl0RCxnQkFBTUMsV0FBVyxNQUFNQyxNQUFNLEdBQUdSLFdBQUFBLENBQVksd0JBQXdCO0FBQUEsWUFDbEVvRCxRQUFRO0FBQUEsWUFDUi9DO0FBQUFBLFlBQ0FnRCxNQUFNQyxLQUFLQyxVQUFVO0FBQUEsY0FDbkIwQixZQUFZdkIsaUJBQWdCL0w7QUFBQUEsY0FDNUI2TCxhQUFhWjtBQUFBQSxjQUNic0MsWUFBWXhCLGlCQUFnQnNCLFNBQVNHLElBQUlDLENBQVcsWUFBQTtBQUFBLGdCQUNsREE7QUFBQUEsZ0JBQ0FyVjtBQUFBQSxjQUFBQSxFQUNBO0FBQUEsWUFDSCxDQUFBO0FBQUEsVUFBQSxDQUNGO0FBRUQsY0FBSXdRLFNBQVNFLElBQUk7QUFBQSxVQUFBO0FBQUEsaUJBRVYzUyxPQUFPO0FBQ05BLGtCQUFBQSxNQUFNLG1EQUFtREEsS0FBSztBQUFBLFFBQUE7QUFBQSxNQUN4RTtBQUFBLElBRUo7QUFFQSxVQUFNdVgsZUFBZSxZQUFZO0FBRS9CLFlBQU10VixRQUFRd1AsYUFBYTtBQUMzQixVQUFJeFAsVUFBVSxNQUFNO0FBQ2xCLGNBQU1pVSxpQkFBaUJqVSxLQUFLO0FBQUEsTUFBQTtBQUFBLElBRWhDO0FBRUEsVUFBTXVWLGlCQUFpQkEsTUFBTTs7QUFFM0IsVUFBSXBHLHFCQUEwQmUsT0FBQUEsTUFBQUEsVUFBYTVOLE1BQWI0TixnQkFBQUEsSUFBYTVOLFdBQVUsS0FBSyxHQUFHO0FBQ25DNk0sZ0NBQUFBLHlCQUF5QixDQUFDO0FBQ2xESSwwQkFBa0IsRUFBRTtBQUNwQkUsd0JBQWdCLElBQUk7QUFDcEJJLHVCQUFlLENBQUEsQ0FBRTtBQUNqQkUsd0JBQWdCLEtBQUs7QUFDckJDLHFCQUFhLEtBQUs7QUFBQSxNQUFBLE9BQ2I7QUFFTDFRLGNBQU1rVyxPQUFPO0FBQUEsTUFBQTtBQUFBLElBRWpCO0FBZ0JBLFVBQU03QixrQkFBa0JBLE1BQUFBOztBQUFNekQsY0FBQUEsTUFBQUEsVUFBVSxNQUFWQSxnQkFBQUEsSUFBY2Y7O0FBRTVDLFlBQUEsTUFBQTtBQUFBLFVBQUE1UCxPQUFBQyxTQUFBO0FBQUFELGFBQUFBLE1BQUEwQixnQkFFS0MsTUFBSTtBQUFBLFFBQUEsSUFDSEMsT0FBSTtBQUFBLGlCQUFFLENBQUMrTyxVQUFVblA7QUFBQUEsUUFBTztBQUFBLFFBQUEsSUFDeEIrRSxXQUFRO0FBQUEsaUJBQUF6RSxVQUFBO0FBQUEsUUFBQTtBQUFBLFFBQUEsSUFBQXJELFdBQUE7QUFBQSxpQkFBQWlELGdCQVNQQyxNQUFJO0FBQUEsWUFBQSxJQUNIQyxPQUFJO0FBQUEsc0JBQUcrTyxVQUFVLEtBQUssQ0FBRSxHQUFFNU4sU0FBUztBQUFBLFlBQUM7QUFBQSxZQUFBLElBQ3BDd0QsV0FBUTtBQUFBLHFCQUFBbkYsVUFBQTtBQUFBLFlBQUE7QUFBQSxZQUFBLElBQUEzQyxXQUFBO0FBQUEscUJBQUFpRCxnQkFTUEMsTUFBSTtBQUFBLGdCQUFBLElBQUNDLE9BQUk7QUFBQSx5QkFBRXdTLGdCQUFnQjtBQUFBLGdCQUFDO0FBQUEsZ0JBQUEzVixVQUN6QnlYLENBQUFBLGFBQVF4VSxDQUFBQSxnQkFFTDZMLGFBQVc7QUFBQSxrQkFBQSxJQUNWSSxVQUFPO0FBQUEsMkJBQUVpQyxxQkFBeUIsSUFBQTtBQUFBLGtCQUFDO0FBQUEsa0JBQUEsSUFDbkNoQyxRQUFLOztBQUFFK0MsNkJBQUFBLE1BQUFBLFVBQUFBLE1BQUFBLGdCQUFBQSxJQUFhNU4sV0FBVTtBQUFBLGtCQUFBO0FBQUEsZ0JBQUMsQ0FBQXJCLEdBQUFBLGdCQUdoQ3NNLGdCQUFjO0FBQUEsa0JBQUEsSUFDYkMsUUFBSztBQUFBLDJCQUFFbE8sTUFBTW9XLGVBQWU7QUFBQSxrQkFBRTtBQUFBLGtCQUFBLElBQzlCQyxTQUFNO0FBQUEsMkJBQUVyVyxNQUFNa1c7QUFBQUEsa0JBQUFBO0FBQUFBLGdCQUFNLENBQUEsSUFBQSxNQUFBO0FBQUEsc0JBQUE1VixRQUFBZ0ssVUFBQTtBQUFBaEsseUJBQUFBLE9BQUFxQixnQkFJbkIwTixrQkFBZ0I7QUFBQSxvQkFBQ0csaUJBQWU7QUFBQSxvQkFBQSxJQUFBOVEsV0FBQTtBQUFBLDZCQUFBaUQsZ0JBQzlCOE4sV0FBUztBQUFBLHdCQUFBLElBQ1JDLFNBQU07QUFBQSxpQ0FBRXlHLFNBQVc3QixFQUFBQTtBQUFBQSx3QkFBUztBQUFBLHdCQUFBLElBQzVCM0UsaUJBQWM7QUFBQSxpQ0FBRUEsZUFBZTtBQUFBLHdCQUFBO0FBQUEsc0JBQUMsQ0FBQTtBQUFBLG9CQUFBO0FBQUEsa0JBQUEsQ0FBQSxDQUFBO0FBQUFyUCx5QkFBQUE7QUFBQUEsZ0JBQUFBLEdBQUFxQixHQUFBQSxnQkFLckNDLE1BQUk7QUFBQSxrQkFBQSxJQUNIQyxPQUFJO0FBQUEsMkJBQUUyTyxhQUFhO0FBQUEsa0JBQUM7QUFBQSxrQkFBQSxJQUNwQmhLLFdBQVE7QUFBQSwyQkFBQTdFLGdCQUNMd00sZ0JBQWM7QUFBQSxzQkFBQSxJQUNiQyxjQUFXO0FBQUEsK0JBQUVBLFlBQVk7QUFBQSxzQkFBQztBQUFBLHNCQUFBLElBQzFCRSxlQUFZO0FBQUEsK0JBQUVBLGFBQWE7QUFBQSxzQkFBQztBQUFBLHNCQUFBLElBQzVCQyxZQUFTO0FBQUEsK0JBQUVvQixlQUFlLEVBQUVxRixLQUFLLEVBQUVoUyxTQUFTO0FBQUEsc0JBQUM7QUFBQSxzQkFDN0N3TCxVQUFVaUQ7QUFBQUEsc0JBQ1ZwRCxRQUFRdUc7QUFBQUEsc0JBQ1JuRyxVQUFVdUg7QUFBQUEsb0JBQUFBLENBQVk7QUFBQSxrQkFBQTtBQUFBLGtCQUFBLElBQUF0WCxXQUFBO0FBQUEsMkJBQUFpRCxnQkFJekJnTixnQkFBYztBQUFBLHNCQUNiQyxNQUFJO0FBQUEsc0JBQUEsSUFDSkMsWUFBUztBQUFBLCtCQUFFQSxVQUFVO0FBQUEsc0JBQUM7QUFBQSxzQkFDdEJLLFlBQVkrRztBQUFBQSxvQkFBQUEsQ0FBYztBQUFBLGtCQUFBO0FBQUEsZ0JBQUEsQ0FBQSxDQUFBO0FBQUEsY0FBQSxDQUlqQztBQUFBLFlBQUE7QUFBQSxVQUFBLENBQUE7QUFBQSxRQUFBO0FBQUEsTUFBQSxDQUFBLENBQUE7QUFBQWhXLGFBQUFBO0FBQUFBLElBQUFBLEdBQUE7QUFBQSxFQU1iOzs7Ozs7Ozs7QUMzT0VILGlCQUFBLENBQUEsT0FBQSxDQUFBOzs7Ozs7QUN6QkRBLGlCQUFBLENBQUEsT0FBQSxDQUFBOzs7QUN4RUNBLGlCQUFBLENBQUEsT0FBQSxDQUFBOzs7O0FDWkssV0FBUyxrQkFBa0IsU0FBbUM7QUFDbkUsVUFBTSxDQUFDLFdBQVcsWUFBWSxJQUFJLGFBQWEsS0FBSztBQUNwRCxVQUFNLENBQUMsYUFBYSxjQUFjLElBQUksYUFBYSxDQUFDO0FBQ3BELFVBQU0sQ0FBQyxPQUFPLFFBQVEsSUFBSSxhQUFhLENBQUM7QUFDeEMsVUFBTSxDQUFDLFdBQVcsWUFBWSxJQUFJLGFBQTRCLElBQUk7QUFDbEUsVUFBTSxDQUFDLFdBQVcsWUFBWSxJQUFJLGFBQTRCLElBQUk7QUFDbEUsVUFBTSxDQUFDLFlBQVksYUFBYSxJQUFJLGFBQTBCLENBQUEsQ0FBRTtBQUNoRSxVQUFNLENBQUMsY0FBYyxlQUFlLElBQUksYUFBK0IsSUFBSTtBQUMzRSxVQUFNLENBQUMsYUFBYSxjQUFjLElBQUksYUFBYSxLQUFLO0FBQ3hELFVBQU0sQ0FBQyxjQUFjLGVBQWUsSUFBSSxhQUEyQyxRQUFRLFlBQVk7QUFDdkcsVUFBTSxDQUFDLGdCQUFnQixpQkFBaUIsSUFBSSxhQUEwQixvQkFBSSxLQUFLO0FBQy9FLFVBQU0sQ0FBQyxlQUFlLGdCQUFnQixJQUFJLGFBQTRCLElBQUk7QUFFMUUsUUFBSSxzQkFBcUM7QUFDekMsUUFBSSxtQkFBa0M7QUFFdEMsVUFBTSxpQkFBaUIsNEJBQTRCO0FBQUEsTUFDakQsWUFBWTtBQUFBLElBQUEsQ0FDYjtBQUVELFVBQU13VyxjQUFhLElBQUlDLG9CQUFrQixRQUFRLE1BQU07QUFHakQsVUFBQSxrQkFBa0IsQ0FBQ3JKLFdBQWlDO0FBQ3hELGNBQVFBLFFBQU87QUFBQSxRQUNiLEtBQUs7QUFBZSxpQkFBQTtBQUFBLFFBQ3BCLEtBQUs7QUFBZ0IsaUJBQUE7QUFBQSxRQUNyQixLQUFLO0FBQWEsaUJBQUE7QUFBQSxRQUNsQjtBQUFnQixpQkFBQTtBQUFBLE1BQUE7QUFBQSxJQUVwQjtBQUdNLFVBQUEscUJBQXFCLENBQUNBLFdBQWlDO0FBQzNELGNBQVFBLFFBQU87QUFBQSxRQUNiLEtBQUs7QUFBZSxpQkFBQTtBQUFBO0FBQUEsUUFDcEIsS0FBSztBQUFnQixpQkFBQTtBQUFBO0FBQUEsUUFDckIsS0FBSztBQUFhLGlCQUFBO0FBQUE7QUFBQSxRQUNsQjtBQUFnQixpQkFBQTtBQUFBLE1BQUE7QUFBQSxJQUVwQjtBQUdNLFVBQUEsb0JBQW9CLENBQUNBLFdBQXlCO0FBQ2xELHVCQUFpQkEsTUFBSztBQUN0QixZQUFNLFFBQVEsYUFBYTtBQUMzQixVQUFJLE9BQU87QUFDSCxjQUFBLE9BQU8sZ0JBQWdCQSxNQUFLO0FBQ2xDLGNBQU0sZUFBZTtBQUFBLE1BQUE7QUFBQSxJQUV6QjtBQUVBLFVBQU0sZUFBZSxZQUFZO0FBRTNCLFVBQUE7QUFDRixjQUFNLGVBQWUsV0FBVztBQUFBLGVBQ3pCLE9BQU87QUFDTixnQkFBQSxNQUFNLGdEQUFnRCxLQUFLO0FBQUEsTUFBQTtBQUtqRSxVQUFBLFFBQVEsV0FBVyxRQUFRLFVBQVU7QUFDbkMsWUFBQTtBQUNJLGdCQUFBLFVBQVUsTUFBTW9KLFlBQVc7QUFBQSxZQUMvQixRQUFRO0FBQUEsWUFDUjtBQUFBLGNBQ0UsT0FBTyxRQUFRLFNBQVM7QUFBQSxjQUN4QixRQUFRLFFBQVEsU0FBUztBQUFBLGNBQ3pCLFVBQVUsUUFBUSxTQUFTO0FBQUEsY0FDM0IsWUFBWTtBQUFBO0FBQUEsWUFDZDtBQUFBLFlBQ0E7QUFBQTtBQUFBLFlBQ0EsUUFBUTtBQUFBLFlBQ1IsY0FBYztBQUFBLFVBQ2hCO0FBRUEsY0FBSSxTQUFTO0FBQ1gseUJBQWEsUUFBUSxFQUFFO0FBQUEsVUFBQSxPQUNsQjtBQUNMLG9CQUFRLE1BQU0sMkNBQTJDO0FBQUEsVUFBQTtBQUFBLGlCQUVwRCxPQUFPO0FBQ04sa0JBQUEsTUFBTSw4Q0FBOEMsS0FBSztBQUFBLFFBQUE7QUFBQSxNQUNuRTtBQUtGLG1CQUFhLENBQUM7QUFFUixZQUFBLG9CQUFvQixZQUFZLE1BQU07QUFDMUMsY0FBTSxVQUFVLFVBQVU7QUFDdEIsWUFBQSxZQUFZLFFBQVEsVUFBVSxHQUFHO0FBQ25DLHVCQUFhLFVBQVUsQ0FBQztBQUFBLFFBQUEsT0FDbkI7QUFDTCx3QkFBYyxpQkFBaUI7QUFDL0IsdUJBQWEsSUFBSTtBQUNILHdCQUFBO0FBQUEsUUFBQTtBQUFBLFNBRWYsR0FBSTtBQUFBLElBQ1Q7QUFFQSxVQUFNLGdCQUFnQixNQUFNO0FBQzFCLG1CQUFhLElBQUk7QUFHakIscUJBQWUsaUJBQWlCO0FBRTFCLFlBQUEsUUFBUSxrQkFBa0IsUUFBUTtBQUN4QyxVQUFJLE9BQU87QUFFSCxjQUFBLE9BQU8sZ0JBQWdCLGVBQWU7QUFDNUMsY0FBTSxlQUFlO0FBRXJCLGNBQU0sS0FBSyxFQUFFLE1BQU0sUUFBUSxLQUFLO0FBRWhDLGNBQU0sYUFBYSxNQUFNO0FBQ2pCLGdCQUFBLE9BQU8sTUFBTSxjQUFjO0FBQ2pDLHlCQUFlLElBQUk7QUFHbkIsZ0NBQXNCLElBQUk7QUFBQSxRQUM1QjtBQUVzQiw4QkFBQSxZQUFZLFlBQVksR0FBRztBQUUzQyxjQUFBLGlCQUFpQixTQUFTLFNBQVM7QUFBQSxNQUFBO0FBQUEsSUFHN0M7QUFFTSxVQUFBLHdCQUF3QixDQUFDLGtCQUEwQjtBQUN2RCxVQUFJLFlBQVksS0FBSyxDQUFDLFFBQVEsT0FBTyxPQUFRO0FBRTdDLFlBQU0sV0FBVyxlQUFlO0FBR2hDLGVBQVMsSUFBSSxHQUFHLElBQUksUUFBUSxPQUFPLFFBQVEsS0FBSztBQUUxQyxZQUFBLFNBQVMsSUFBSSxDQUFDLEdBQUc7QUFDbkI7QUFBQSxRQUFBO0FBR0YsY0FBTSxRQUFRLGlCQUFpQixRQUFRLFFBQVEsQ0FBQztBQUNoRCxjQUFNLFlBQVksUUFBUSxPQUFPLE1BQU0sVUFBVTtBQUU3QyxZQUFBLGFBQWEsVUFBVSxjQUFjLFFBQVc7QUFDNUMsZ0JBQUEscUJBQXFCLFVBQVUsWUFBWSxNQUFPO0FBQ2xELGdCQUFBLGdCQUFnQixVQUFVLFlBQVk7QUFHNUMsY0FBSSxpQkFBaUIsc0JBQXNCLGdCQUFnQixnQkFBZ0IsS0FBSztBQUU1RCw4QkFBQSxDQUFBLFNBQVEsSUFBSSxJQUFJLElBQUksRUFBRSxJQUFJLE1BQU0sVUFBVSxDQUFDO0FBRTdELGdDQUFvQixLQUFLO0FBQ3pCO0FBQUEsVUFBQTtBQUFBLFFBQ0Y7QUFJRixZQUFJLE1BQU07QUFBQSxNQUFBO0FBQUEsSUFFZDtBQUVNLFVBQUEsc0JBQXNCLE9BQU8sVUFBcUI7QUFFbEQsVUFBQSxNQUFNLGNBQWMsR0FBRztBQUNmLGtCQUFBO0FBQ1Y7QUFBQSxNQUFBO0FBR0Ysc0JBQWdCLEtBQUs7QUFDckIscUJBQWUsSUFBSTtBQUdKLHFCQUFBLG1CQUFtQixNQUFNLFVBQVU7QUFHbEQsWUFBTSxlQUFlLDJCQUEyQixRQUFRLFFBQVEsS0FBSztBQUNyRSxZQUFNLGNBQWMsSUFBSSxnQkFBZ0IsY0FBQSxDQUFlO0FBQ3ZELFlBQU0sV0FBVyxlQUFlO0FBR2hDLHlCQUFtQixXQUFXLE1BQU07QUFDZiwyQkFBQTtBQUFBLFNBQ2xCLFFBQVE7QUFBQSxJQUNiO0FBRUEsVUFBTSxxQkFBcUIsWUFBWTtBQUNyQyxZQUFNLFFBQVEsYUFBYTtBQUMzQixVQUFJLENBQUMsTUFBTztBQUVaLHFCQUFlLEtBQUs7QUFHZCxZQUFBLGNBQWMsZUFBZSxnQ0FBZ0M7QUFDN0QsWUFBQSxVQUFVLGVBQWUsc0JBQXNCLFdBQVc7QUFJaEUsVUFBSSxXQUFXLFFBQVEsT0FBTyxPQUFRLGFBQWE7QUFFM0MsY0FBQSxTQUFTLElBQUksV0FBVztBQUM5QixlQUFPLFlBQVksWUFBWTs7QUFDdkIsZ0JBQUEsZUFBYzdXLE1BQUEsT0FBTyxXQUFQLGdCQUFBQSxJQUFlLFdBQVcsTUFBTSxLQUFLO0FBQ3JELGNBQUEsZUFBZSxZQUFZLFNBQVMsS0FBSztBQUNyQyxrQkFBQSxXQUFXLE9BQU8sV0FBVztBQUFBLFVBQUE7QUFBQSxRQUd2QztBQUNBLGVBQU8sY0FBYyxPQUFPO0FBQUEsTUFDbkIsV0FBQSxXQUFXLFFBQVEsUUFBUSxLQUFNO0FBRTVCLHNCQUFBLENBQUEsU0FBUSxDQUFDLEdBQUcsTUFBTTtBQUFBLFVBQzlCLFdBQVcsTUFBTTtBQUFBLFVBQ2pCLE9BQU87QUFBQSxVQUNQLGVBQWU7QUFBQSxVQUNmLFVBQVU7QUFBQSxRQUFBLENBQ1gsQ0FBQztBQUFBLE1BQUEsV0FDTyxXQUFXLENBQUMsWUFBYTtBQUdwQyxzQkFBZ0IsSUFBSTtBQUVwQixVQUFJLGtCQUFrQjtBQUNwQixxQkFBYSxnQkFBZ0I7QUFDViwyQkFBQTtBQUFBLE1BQUE7QUFBQSxJQUV2QjtBQUVNLFVBQUEsYUFBYSxPQUFPLE9BQWtCLGdCQUF3Qjs7QUFDbEUsWUFBTSxtQkFBbUIsVUFBVTtBQUVuQyxVQUFJLENBQUMsa0JBQWtCO0FBQ3JCO0FBQUEsTUFBQTtBQUdFLFVBQUE7QUFDSSxjQUFBLFlBQVksTUFBTTZXLFlBQVc7QUFBQSxVQUNqQztBQUFBLFVBQ0EsTUFBTTtBQUFBLFVBQ047QUFBQSxVQUNBLE1BQU07QUFBQSxZQUNON1csTUFBQSxRQUFRLE9BQU8sTUFBTSxVQUFVLE1BQS9CLGdCQUFBQSxJQUFrQyxjQUFhO0FBQUEsYUFDOUNDLE1BQUEsUUFBUSxPQUFPLE1BQU0sUUFBUSxNQUE3QixnQkFBQUEsSUFBZ0MsY0FBYSxRQUFNLGFBQVEsT0FBTyxNQUFNLFFBQVEsTUFBN0IsbUJBQWdDLGFBQVksS0FBSztBQUFBLFVBQ3JHO0FBQUE7QUFBQSxVQUNBLGNBQWM7QUFBQSxRQUNoQjtBQUVBLFlBQUksV0FBVztBQUdQLGdCQUFBLGtCQUFrQixtQkFBbUIsZUFBZTtBQUNwRCxnQkFBQSxnQkFBZ0IsS0FBSyxJQUFJLEtBQUssS0FBSyxNQUFNLFVBQVUsUUFBUSxlQUFlLENBQUM7QUFHakYsZ0JBQU0sZUFBZTtBQUFBLFlBQ25CLFdBQVcsTUFBTTtBQUFBLFlBQ2pCLE9BQU87QUFBQSxZQUNQLGVBQWUsVUFBVSxjQUFjO0FBQUEsWUFDdkMsVUFBVSxVQUFVO0FBQUEsVUFDdEI7QUFFQSx3QkFBYyxDQUFRLFNBQUEsQ0FBQyxHQUFHLE1BQU0sWUFBWSxDQUFDO0FBRzdDLG1CQUFTLENBQVEsU0FBQTtBQUNmLGtCQUFNLFlBQVksQ0FBQyxHQUFHLFdBQUEsR0FBYyxZQUFZO0FBQzFDLGtCQUFBLFdBQVcsVUFBVSxPQUFPLENBQUMsS0FBSyxNQUFNLE1BQU0sRUFBRSxPQUFPLENBQUMsSUFBSSxVQUFVO0FBQ3JFLG1CQUFBLEtBQUssTUFBTSxRQUFRO0FBQUEsVUFBQSxDQUMzQjtBQUFBLFFBQUEsT0FHSTtBQUdTLHdCQUFBLENBQUEsU0FBUSxDQUFDLEdBQUcsTUFBTTtBQUFBLFlBQzlCLFdBQVcsTUFBTTtBQUFBLFlBQ2pCLE9BQU87QUFBQTtBQUFBLFlBQ1AsZUFBZTtBQUFBLFlBQ2YsVUFBVTtBQUFBLFVBQUEsQ0FDWCxDQUFDO0FBQUEsUUFBQTtBQUFBLGVBRUcsT0FBTztBQUNOLGdCQUFBLE1BQU0sMkNBQTJDLEtBQUs7QUFBQSxNQUFBO0FBQUEsSUFFbEU7QUFFQSxVQUFNLFlBQVksWUFBWTs7QUFDNUIsbUJBQWEsS0FBSztBQUNsQixVQUFJLHFCQUFxQjtBQUN2QixzQkFBYyxtQkFBbUI7QUFBQSxNQUFBO0FBSTdCLFlBQUEsUUFBUSxrQkFBa0IsUUFBUTtBQUNwQyxVQUFBLFNBQVMsQ0FBQyxNQUFNLFFBQVE7QUFDMUIsY0FBTSxNQUFNO0FBQUEsTUFBQTtBQUlkLFVBQUksZUFBZTtBQUNqQixjQUFNLG1CQUFtQjtBQUFBLE1BQUE7QUFJM0IsWUFBTSxpQkFBaUM7QUFBQSxRQUNyQyxPQUFPO0FBQUE7QUFBQSxRQUNQLFVBQVU7QUFBQSxRQUNWLFlBQVksYUFBYTtBQUFBLFFBQ3pCLGNBQWM7QUFBQSxRQUNkLFdBQVc7QUFBQSxRQUNYLGdCQUFnQjtBQUFBLFFBQ2hCLFdBQVcsZUFBZTtBQUFBLFFBQzFCLFdBQVc7QUFBQSxNQUNiO0FBQ0EsT0FBQUQsTUFBQSxRQUFRLGVBQVIsZ0JBQUFBLElBQUEsY0FBcUI7QUFHZixZQUFBLGdCQUFnQixlQUFlLHlCQUF5QjtBQUc5RCxZQUFNLG1CQUFtQixVQUFVO0FBQ25DLFVBQUksb0JBQW9CLGlCQUFpQixjQUFjLE9BQU8sS0FBTTtBQUM5RCxZQUFBO0FBQ0ksZ0JBQUEsU0FBUyxJQUFJLFdBQVc7QUFDOUIsaUJBQU8sWUFBWSxZQUFZOztBQUN2QixrQkFBQSxlQUFjQSxNQUFBLE9BQU8sV0FBUCxnQkFBQUEsSUFBZSxXQUFXLE1BQU0sS0FBSztBQUVuRCxrQkFBQSxpQkFBaUIsTUFBTTZXLFlBQVc7QUFBQSxjQUN0QztBQUFBLGNBQ0E7QUFBQSxZQUNGO0FBRUEsZ0JBQUksZ0JBQWdCO0FBRWxCLG9CQUFNLFVBQTBCO0FBQUEsZ0JBQzlCLE9BQU8sZUFBZTtBQUFBLGdCQUN0QixVQUFVLGVBQWU7QUFBQSxnQkFDekIsWUFBWSxlQUFlO0FBQUEsZ0JBQzNCLGNBQWMsZUFBZTtBQUFBLGdCQUM3QixXQUFXLGVBQWU7QUFBQSxnQkFDMUIsZ0JBQWdCLGVBQWU7QUFBQSxnQkFDL0IsV0FBVztBQUFBLGNBQ2I7QUFFQSxlQUFBNVcsTUFBQSxRQUFRLGVBQVIsZ0JBQUFBLElBQUEsY0FBcUI7QUFBQSxZQUFPLE9BQ3ZCO0FBRWlCLG9DQUFBO0FBQUEsWUFBQTtBQUFBLFVBRTFCO0FBQ0EsaUJBQU8sY0FBYyxhQUFhO0FBQUEsaUJBQzNCLE9BQU87QUFDTixrQkFBQSxNQUFNLGdEQUFnRCxLQUFLO0FBQzdDLGdDQUFBO0FBQUEsUUFBQTtBQUFBLE1BQ3hCLE9BQ0s7QUFFaUIsOEJBQUE7QUFBQSxNQUFBO0FBQUEsSUFFMUI7QUFFQSxVQUFNLHdCQUF3QixNQUFNOztBQUNsQyxZQUFNLFNBQVMsV0FBVztBQUMxQixZQUFNLFdBQVcsT0FBTyxTQUFTLElBQzdCLE9BQU8sT0FBTyxDQUFDLEtBQUssTUFBTSxNQUFNLEVBQUUsT0FBTyxDQUFDLElBQUksT0FBTyxTQUNyRDtBQUVKLFlBQU0sVUFBMEI7QUFBQSxRQUM5QixPQUFPLEtBQUssTUFBTSxRQUFRO0FBQUEsUUFDMUIsVUFBVSxLQUFLLE1BQU0sUUFBUTtBQUFBLFFBQzdCLFlBQVksT0FBTztBQUFBO0FBQUEsUUFDbkIsY0FBYyxPQUFPLE9BQU8sT0FBSyxFQUFFLFNBQVMsRUFBRSxFQUFFO0FBQUEsUUFDaEQsV0FBVyxPQUFPLE9BQU8sQ0FBSyxNQUFBLEVBQUUsU0FBUyxNQUFNLEVBQUUsUUFBUSxFQUFFLEVBQUU7QUFBQSxRQUM3RCxnQkFBZ0IsT0FBTyxPQUFPLE9BQUssRUFBRSxRQUFRLEVBQUUsRUFBRTtBQUFBLFFBQ2pELFdBQVcsZUFBZTtBQUFBLE1BQzVCO0FBRUEsT0FBQUQsTUFBQSxRQUFRLGVBQVIsZ0JBQUFBLElBQUEsY0FBcUI7QUFBQSxJQUN2QjtBQUVBLFVBQU0sY0FBYyxNQUFNO0FBQ3hCLG1CQUFhLEtBQUs7QUFDbEIsbUJBQWEsSUFBSTtBQUNqQixxQkFBZSxLQUFLO0FBQ3BCLHNCQUFnQixJQUFJO0FBQ0Ysd0JBQUEsb0JBQUksS0FBYTtBQUVuQyxVQUFJLHFCQUFxQjtBQUN2QixzQkFBYyxtQkFBbUI7QUFDWCw4QkFBQTtBQUFBLE1BQUE7QUFHeEIsVUFBSSxrQkFBa0I7QUFDcEIscUJBQWEsZ0JBQWdCO0FBQ1YsMkJBQUE7QUFBQSxNQUFBO0FBR2YsWUFBQSxRQUFRLGtCQUFrQixRQUFRO0FBQ3hDLFVBQUksT0FBTztBQUNULGNBQU0sTUFBTTtBQUNaLGNBQU0sY0FBYztBQUNkLGNBQUEsb0JBQW9CLFNBQVMsU0FBUztBQUFBLE1BQUE7QUFJOUMscUJBQWUsUUFBUTtBQUFBLElBQ3pCO0FBRUEsY0FBVSxNQUFNO0FBQ0Ysa0JBQUE7QUFBQSxJQUFBLENBQ2I7QUFFTSxXQUFBO0FBQUE7QUFBQSxNQUVMO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BR0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUEsTUFHQTtBQUFBO0FBQUEsTUFHQSxpQkFBaUIsQ0FBQyxZQUEwQztBQUMxRCx3QkFBZ0IsT0FBTztBQUV2QixZQUFJLFNBQVM7QUFDSCxrQkFBQSxlQUFlLGdCQUFnQixlQUFlO0FBQUEsUUFBQTtBQUFBLE1BQ3hEO0FBQUEsSUFFSjtBQUFBLEVBQ0Y7Ozs7OztFQzlkTyxNQUFNLGNBQWM7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUl6QixxQkFBdUM7QUFDL0IsWUFBQSxNQUFNLE9BQU8sU0FBUztBQUd4QixVQUFBLElBQUksU0FBUyxjQUFjLEdBQUc7QUFDaEMsZUFBTyxLQUFLLHNCQUFzQjtBQUFBLE1BQUE7QUFHN0IsYUFBQTtBQUFBLElBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU9ELHdCQUEwQzs7QUFDNUMsVUFBQTtBQUVJLGNBQUEsWUFBWSxPQUFPLFNBQVMsU0FBUyxNQUFNLEdBQUcsRUFBRSxPQUFPLE9BQU87QUFDaEUsWUFBQSxVQUFVLFNBQVMsRUFBVSxRQUFBO0FBRTNCLGNBQUEsYUFBYSxVQUFVLENBQUM7QUFDeEIsY0FBQSxZQUFZLFVBQVUsQ0FBQztBQUc3QixZQUFJLFFBQVE7QUFHTixjQUFBLGFBQWEsU0FBUyxpQkFBaUIsSUFBSTtBQUNqRCxtQkFBVyxNQUFNLFlBQVk7QUFFM0IsZUFBSUEsTUFBQSxHQUFHLGdCQUFILGdCQUFBQSxJQUFnQixjQUFjLFNBQVMsY0FBZTtBQUNsRCxvQkFBQUMsTUFBQSxHQUFHLGdCQUFILGdCQUFBQSxJQUFnQixXQUFVO0FBQ2xDLGNBQUksTUFBTztBQUFBLFFBQUE7QUFJYixZQUFJLENBQUMsT0FBTztBQUNGLGtCQUFBLFVBQVUsUUFBUSxNQUFNLEdBQUc7QUFBQSxRQUFBO0FBSXJDLFlBQUksU0FBUztBQUdQLGNBQUEsYUFBYSxTQUFTLGNBQWMsb0JBQW9CO0FBQzFELFlBQUEsY0FBYyxXQUFXLGFBQWE7QUFDL0IsbUJBQUEsV0FBVyxZQUFZLEtBQUs7QUFBQSxRQUFBO0FBSXZDLFlBQUksQ0FBQyxRQUFRO0FBQ1gsZ0JBQU0sWUFBWSxTQUFTO0FBRXJCLGdCQUFBLFFBQVEsVUFBVSxNQUFNLGdCQUFnQjtBQUM5QyxjQUFJLE9BQU87QUFDQSxxQkFBQSxNQUFNLENBQUMsRUFBRSxLQUFLO0FBQUEsVUFBQTtBQUFBLFFBQ3pCO0FBSUYsWUFBSSxDQUFDLFFBQVE7QUFDWCxtQkFBUyxXQUFXLFFBQVEsTUFBTSxHQUFHLEVBQUUsUUFBUSxNQUFNLEdBQUc7QUFBQSxRQUFBO0FBRzFELGdCQUFRLElBQUksbUNBQW1DLEVBQUUsT0FBTyxRQUFRLFlBQVksV0FBVztBQUVoRixlQUFBO0FBQUEsVUFDTCxTQUFTLEdBQUcsVUFBVSxJQUFJLFNBQVM7QUFBQSxVQUNuQztBQUFBLFVBQ0E7QUFBQSxVQUNBLFVBQVU7QUFBQSxVQUNWLEtBQUssT0FBTyxTQUFTO0FBQUEsUUFDdkI7QUFBQSxlQUNPLE9BQU87QUFDTixnQkFBQSxNQUFNLHFEQUFxRCxLQUFLO0FBQ2pFLGVBQUE7QUFBQSxNQUFBO0FBQUEsSUFDVDtBQUFBO0FBQUE7QUFBQTtBQUFBLElBT0YsZ0JBQWdCLFVBQXlEO0FBQ25FLFVBQUEsYUFBYSxPQUFPLFNBQVM7QUFDN0IsVUFBQSxlQUFlLEtBQUssbUJBQW1CO0FBRzNDLGVBQVMsWUFBWTtBQUdyQixZQUFNLGtCQUFrQixNQUFNO0FBQ3RCLGNBQUEsU0FBUyxPQUFPLFNBQVM7QUFDL0IsWUFBSSxXQUFXLFlBQVk7QUFDWix1QkFBQTtBQUNQLGdCQUFBLFdBQVcsS0FBSyxtQkFBbUI7QUFHekMsZ0JBQU0sZUFBZSxDQUFDLGdCQUFnQixDQUFDLFlBQ3JDLGFBQWEsWUFBWSxTQUFTO0FBRXBDLGNBQUksY0FBYztBQUNELDJCQUFBO0FBQ2YscUJBQVMsUUFBUTtBQUFBLFVBQUE7QUFBQSxRQUNuQjtBQUFBLE1BRUo7QUFHTSxZQUFBLFdBQVcsWUFBWSxpQkFBaUIsR0FBSTtBQUdsRCxZQUFNLG1CQUFtQixNQUFNO0FBQzdCLG1CQUFXLGlCQUFpQixHQUFHO0FBQUEsTUFDakM7QUFFTyxhQUFBLGlCQUFpQixZQUFZLGdCQUFnQjtBQUdwRCxZQUFNLG9CQUFvQixRQUFRO0FBQ2xDLFlBQU0sdUJBQXVCLFFBQVE7QUFFN0IsY0FBQSxZQUFZLFlBQVksTUFBTTtBQUNsQiwwQkFBQSxNQUFNLFNBQVMsSUFBSTtBQUNwQix5QkFBQTtBQUFBLE1BQ25CO0FBRVEsY0FBQSxlQUFlLFlBQVksTUFBTTtBQUNsQiw2QkFBQSxNQUFNLFNBQVMsSUFBSTtBQUN2Qix5QkFBQTtBQUFBLE1BQ25CO0FBR0EsYUFBTyxNQUFNO0FBQ1gsc0JBQWMsUUFBUTtBQUNmLGVBQUEsb0JBQW9CLFlBQVksZ0JBQWdCO0FBQ3ZELGdCQUFRLFlBQVk7QUFDcEIsZ0JBQVEsZUFBZTtBQUFBLE1BQ3pCO0FBQUEsSUFBQTtBQUFBLEVBRUo7QUFFYSxRQUFBLGdCQUFnQixJQUFJLGNBQWM7O0FDdkovQyxpQkFBc0IsZUFBdUM7QUFDM0QsVUFBTWIsVUFBUyxNQUFNLFFBQVEsUUFBUSxNQUFNLElBQUksV0FBVztBQUMxRCxXQUFPQSxRQUFPLGFBQWE7QUFBQSxFQUM3Qjs7RUNtQ08sTUFBTSxrQkFBa0I7QUFBQSxJQUc3QixjQUFjO0FBRk47QUFJTixXQUFLLFVBQVU7QUFBQSxJQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFNakIsTUFBTSxlQUNKLFNBQ0EsT0FDQSxRQUM2QjtBQUN6QixVQUFBO0FBQ0ksY0FBQSxTQUFTLElBQUksZ0JBQWdCO0FBQ25DLFlBQUksTUFBTyxRQUFPLElBQUksU0FBUyxLQUFLO0FBQ3BDLFlBQUksT0FBUSxRQUFPLElBQUksVUFBVSxNQUFNO0FBRXZDLGNBQU0sTUFBTSxHQUFHLEtBQUssT0FBTyxZQUFZLG1CQUFtQixPQUFPLENBQUMsR0FBRyxPQUFPLGFBQWEsTUFBTSxPQUFPLFNBQUEsSUFBYSxFQUFFO0FBRTdHLGdCQUFBLElBQUksdUNBQXVDLEdBQUc7QUFFaEQsY0FBQSxXQUFXLE1BQU0sTUFBTSxLQUFLO0FBQUEsVUFDaEMsUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFBQSxDQUtUO0FBRUcsWUFBQSxDQUFDLFNBQVMsSUFBSTtBQUNSLGtCQUFBLE1BQU0sOENBQThDLFNBQVMsTUFBTTtBQUNwRSxpQkFBQTtBQUFBLFFBQUE7QUFHSCxjQUFBLE9BQU8sTUFBTSxTQUFTLEtBQUs7QUFDekIsZ0JBQUEsSUFBSSx1Q0FBdUMsSUFBSTtBQUd2RCxZQUFJLEtBQUssT0FBTztBQUNOLGtCQUFBLElBQUkscURBQXFELEtBQUssS0FBSztBQUNwRSxpQkFBQTtBQUFBLFlBQ0wsU0FBUztBQUFBLFlBQ1QsYUFBYTtBQUFBLFlBQ2IsT0FBTyxLQUFLO0FBQUEsWUFDWixVQUFVO0FBQUEsWUFDVixlQUFlO0FBQUEsVUFDakI7QUFBQSxRQUFBO0FBR0ssZUFBQTtBQUFBLGVBQ0EsT0FBTztBQUNOLGdCQUFBLE1BQU0sNkNBQTZDLEtBQUs7QUFDekQsZUFBQTtBQUFBLE1BQUE7QUFBQSxJQUNUO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFNRixNQUFNLGFBQ0osU0FDQSxVQU1nQztBQUM1QixVQUFBO0FBQ0YsY0FBTSxXQUFXLE1BQU0sTUFBTSxHQUFHLEtBQUssT0FBTyxrQkFBa0I7QUFBQSxVQUM1RCxRQUFRO0FBQUEsVUFDUixTQUFTO0FBQUEsWUFDUCxnQkFBZ0I7QUFBQTtBQUFBLFVBRWxCO0FBQUEsVUFDQSxNQUFNLEtBQUssVUFBVTtBQUFBLFlBQ25CO0FBQUEsWUFDQTtBQUFBLFVBQ0QsQ0FBQTtBQUFBLFFBQUEsQ0FDRjtBQUVHLFlBQUEsQ0FBQyxTQUFTLElBQUk7QUFDUixrQkFBQSxNQUFNLHlDQUF5QyxTQUFTLE1BQU07QUFDL0QsaUJBQUE7QUFBQSxRQUFBO0FBR0gsY0FBQUEsVUFBUyxNQUFNLFNBQVMsS0FBSztBQUNuQyxlQUFPQSxRQUFPO0FBQUEsZUFDUCxPQUFPO0FBQ04sZ0JBQUEsTUFBTSx3Q0FBd0MsS0FBSztBQUNwRCxlQUFBO0FBQUEsTUFBQTtBQUFBLElBQ1Q7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU1GLE1BQU0saUJBQW1DO0FBQ25DLFVBQUE7QUFDSSxjQUFBLFdBQVcsTUFBTSxNQUFNLEdBQUcsS0FBSyxRQUFRLFFBQVEsUUFBUSxFQUFFLENBQUMsU0FBUztBQUN6RSxlQUFPLFNBQVM7QUFBQSxlQUNULE9BQU87QUFDTixnQkFBQSxNQUFNLHdDQUF3QyxLQUFLO0FBQ3BELGVBQUE7QUFBQSxNQUFBO0FBQUEsSUFDVDtBQUFBLEVBRUo7QUFFYSxRQUFBLGFBQWEsSUFBSSxrQkFBa0I7O0FDbEp6QyxRQUFNMlgsZUFBOEN4VyxDQUFVLFVBQUE7QUFDbkUsV0FBQTJCLGdCQUNHaU8sc0JBQW9CO0FBQUEsTUFBQSxJQUNuQm1CLFlBQVM7QUFBQSxlQUFFL1EsTUFBTStRO0FBQUFBLE1BQVM7QUFBQSxNQUFBLElBQzFCbUYsU0FBTTtBQUFBLGVBQUVsVyxNQUFNa1c7QUFBQUEsTUFBQUE7QUFBQUEsSUFBTSxDQUFBO0FBQUEsRUFLMUI7OztBQ1BPLFFBQU1PLGFBQXlDQSxNQUFNO0FBQzFEN1MsWUFBUUMsSUFBSSw2Q0FBNkM7QUFHekQsVUFBTSxDQUFDNlMsY0FBY0MsZUFBZSxJQUFJdlUsYUFBK0IsSUFBSTtBQUMzRSxVQUFNLENBQUM2TyxXQUFXMkYsWUFBWSxJQUFJeFUsYUFBNEIsSUFBSTtBQUNsRSxVQUFNLENBQUN5VSxhQUFhQyxjQUFjLElBQUkxVSxhQUFhLEtBQUs7QUFDeEQsVUFBTSxDQUFDMlUsYUFBYUMsY0FBYyxJQUFJNVUsYUFBa0IsSUFBSTtBQUM1RCxVQUFNLENBQUNYLFNBQVN3VixVQUFVLElBQUk3VSxhQUFhLEtBQUs7QUFDaEQsVUFBTSxDQUFDOFUsZ0JBQWdCQyxpQkFBaUIsSUFBSS9VLGFBQWEsS0FBSztBQUM5RCxVQUFNLENBQUNnVixhQUFhQyxjQUFjLElBQUlqVixhQUFhLEtBQUs7QUFDeEQsVUFBTSxDQUFDa1YsV0FBV0MsWUFBWSxJQUFJblYsYUFBNEIsSUFBSTtBQUNsRSxVQUFNLENBQUNpQyxXQUFXbVQsWUFBWSxJQUFJcFYsYUFBYSxLQUFLO0FBQ3BELFVBQU0sQ0FBQ1UsYUFBYTJVLGNBQWMsSUFBSXJWLGFBQWEsQ0FBQztBQUNwRCxVQUFNLENBQUNzVixVQUFVQyxXQUFXLElBQUl2VixhQUFzQyxJQUFJO0FBQzFFLFVBQU0sQ0FBQ3dWLGdCQUFnQkMsaUJBQWlCLElBQUl6VixhQUEwRCxJQUFJO0FBQzFHLFVBQU0sQ0FBQzBWLGdCQUFnQkMsaUJBQWlCLElBQUkzVixhQUFrQixJQUFJO0FBQ2xFLFVBQU0sQ0FBQzRWLGNBQWNDLGVBQWUsSUFBSTdWLGFBQWEsS0FBSztBQUMxRCxVQUFNLENBQUM4VixlQUFlQyxnQkFBZ0IsSUFBSS9WLGFBQTRCLElBQUk7QUFHMUVnVyxZQUFRLFlBQVk7QUFDbEJ4VSxjQUFRQyxJQUFJLGlDQUFpQztBQUN2Q3dVLFlBQUFBLFFBQVEsTUFBTUMsYUFBYTtBQUNqQyxVQUFJRCxPQUFPO0FBQ1R6QixxQkFBYXlCLEtBQUs7QUFDbEJ6VSxnQkFBUUMsSUFBSSxnQ0FBZ0M7QUFBQSxNQUFBLE9BQ3ZDO0FBRUxELGdCQUFRQyxJQUFJLG9EQUFvRDtBQUNoRStTLHFCQUFhLHlCQUF5QjtBQUFBLE1BQUE7QUFJbEMyQixZQUFBQSxVQUFVQyxjQUFjQyxnQkFBaUJ4RixDQUFVLFVBQUE7QUFDL0NwUCxnQkFBQUEsSUFBSSwrQkFBK0JvUCxLQUFLO0FBQ2hEMEQsd0JBQWdCMUQsS0FBSztBQUVyQixZQUFJQSxPQUFPO0FBQ1Q2RCx5QkFBZSxJQUFJO0FBQ25CNEIsMkJBQWlCekYsS0FBSztBQUFBLFFBQUE7QUFBQSxNQUN4QixDQUNEO0FBRUR2SixnQkFBVTZPLE9BQU87QUFBQSxJQUFBLENBQ2xCO0FBRUtHLFVBQUFBLG1CQUFtQixPQUFPekYsVUFBcUI7QUFDM0NwUCxjQUFBQSxJQUFJLGlEQUFpRG9QLEtBQUs7QUFDbEVnRSxpQkFBVyxJQUFJO0FBQ1gsVUFBQTtBQUNJMUYsY0FBQUEsT0FBTyxNQUFNK0UsV0FBV3FDLGVBQzVCMUYsTUFBTTJGLFNBQ04zRixNQUFNL0UsT0FDTitFLE1BQU00RixNQUNSO0FBQ1FoVixnQkFBQUEsSUFBSSxxQ0FBcUMwTixJQUFJO0FBQ3JEeUYsdUJBQWV6RixJQUFJO0FBQUEsZUFDWjlTLE9BQU87QUFDTkEsZ0JBQUFBLE1BQU0sOENBQThDQSxLQUFLO0FBQUEsTUFBQSxVQUN6RDtBQUNSd1ksbUJBQVcsS0FBSztBQUFBLE1BQUE7QUFBQSxJQUVwQjtBQUVBLFVBQU02QixjQUFjLFlBQVk7O0FBQzlCbFYsY0FBUUMsSUFBSSxvQ0FBb0M7QUFDaERzVCx3QkFBa0IsSUFBSTtBQUV0QixZQUFNNUYsT0FBT3dGLFlBQVk7QUFDWFcsZUFBUztBQUN2QixZQUFNekUsUUFBUXlELGFBQWE7QUFFM0IsVUFBSW5GLFFBQVEwQixXQUFTMUIsTUFBQUEsS0FBS3hPLFdBQUx3TyxnQkFBQUEsSUFBYXdILFFBQU87QUFDdkNuVixnQkFBUUMsSUFBSSw0REFBNEQ7QUFBQSxVQUN0RStVLFNBQVMzRixNQUFNM0s7QUFBQUEsVUFDZjBRLFlBQVkvRixNQUFNL0U7QUFBQUEsVUFDbEIrSyxVQUFVMUgsS0FBSzJIO0FBQUFBLFVBQ2ZDLFdBQVcsQ0FBQyxHQUFDNUgsTUFBQUEsS0FBS3hPLFdBQUx3TyxnQkFBQUEsSUFBYXdIO0FBQUFBLFFBQUFBLENBQzNCO0FBR0QsY0FBTUssYUFBYUMsa0JBQWtCO0FBQUEsVUFDbkN0VyxRQUFRd08sS0FBS3hPLE9BQU9nVztBQUFBQSxVQUNwQkgsU0FBUzNGLE1BQU0yRjtBQUFBQSxVQUNmSyxVQUFVMUgsS0FBSzJILE9BQU87QUFBQSxZQUNwQmhMLE9BQU9xRCxLQUFLMkgsS0FBS2hMO0FBQUFBLFlBQ2pCMkssUUFBUXRILEtBQUsySCxLQUFLTDtBQUFBQSxZQUNsQlMsT0FBTy9ILEtBQUsySCxLQUFLSTtBQUFBQSxZQUNqQjlWLFVBQVUrTixLQUFLMkgsS0FBSzFWO0FBQUFBLFVBQUFBLElBQ2xCO0FBQUEsWUFDRjBLLE9BQU8rRSxNQUFNL0U7QUFBQUEsWUFDYjJLLFFBQVE1RixNQUFNNEY7QUFBQUEsVUFDaEI7QUFBQSxVQUNBVSxlQUFlaEksS0FBS2lJO0FBQUFBLFVBQ3BCQyxjQUFjcFQ7QUFBQUE7QUFBQUEsVUFDZHFULFFBQVE7QUFBQSxVQUNSQyxZQUFhQyxDQUFZLFlBQUE7QUFDZi9WLG9CQUFBQSxJQUFJLDJDQUEyQytWLE9BQU87QUFDOUR6Qyw4QkFBa0IsS0FBSztBQUN2QksseUJBQWEsS0FBSztBQUNsQk8sOEJBQWtCNkIsT0FBTztBQUd6QixrQkFBTTlILFNBQVE0RixTQUFTO0FBQ3ZCLGdCQUFJNUYsUUFBTztBQUNUQSxxQkFBTStILE1BQU07QUFBQSxZQUFBO0FBQUEsVUFDZDtBQUFBLFFBQ0YsQ0FDRDtBQUdPaFcsZ0JBQUFBLElBQUksd0RBQXdEcVUsZUFBZTtBQUN4RTRCLG1CQUFBQSxrQkFBa0I1QixlQUFlO0FBRTVDTCwwQkFBa0J1QixVQUFVO0FBRzVCLGNBQU1BLFdBQVdXLGFBQWE7QUFHOUJsWCxxQkFBYSxNQUFNO0FBQ2J1VyxjQUFBQSxXQUFXOUIsZ0JBQWdCLFFBQVE4QixXQUFXL1UsVUFBVSxLQUFLLENBQUNBLGFBQWE7QUFDN0VULG9CQUFRQyxJQUFJLDBEQUEwRDtBQUNuRCwrQkFBQTtBQUFBLFVBQUE7QUFJckIsZ0JBQU1pTyxTQUFRNEYsU0FBUztBQUN2QixjQUFJNUYsVUFBU3NILFlBQVk7QUFDdkJ4VixvQkFBUUMsSUFBSSxtREFBbUQ7QUFDL0R1Vix1QkFBV1ksZ0JBQWdCbEksTUFBSztBQUFBLFVBQUE7QUFBQSxRQUNsQyxDQUNEO0FBQUEsTUFBQSxPQUNJO0FBQ0xsTyxnQkFBUUMsSUFBSSwyQ0FBMkM7QUFFdkQwVCxxQkFBYSxDQUFDO0FBRVIwQyxjQUFBQSxvQkFBb0JDLFlBQVksTUFBTTtBQUMxQyxnQkFBTXRNLFVBQVUwSixVQUFVO0FBQ3RCMUosY0FBQUEsWUFBWSxRQUFRQSxVQUFVLEdBQUc7QUFDbkMySix5QkFBYTNKLFVBQVUsQ0FBQztBQUFBLFVBQUEsT0FDbkI7QUFDTHVNLDBCQUFjRixpQkFBaUI7QUFDL0IxQyx5QkFBYSxJQUFJO0FBQ0UsK0JBQUE7QUFBQSxVQUFBO0FBQUEsV0FFcEIsR0FBSTtBQUFBLE1BQUE7QUFBQSxJQUVYO0FBRUEsVUFBTTZDLHFCQUFxQkEsTUFBTTtBQUMvQnhXLGNBQVFDLElBQUksc0NBQXNDO0FBQ2xEMlQsbUJBQWEsSUFBSTtBQUlYNkMsWUFBQUEsZ0JBQWdCcGIsU0FBU3NGLGlCQUFpQixPQUFPO0FBQy9DVixjQUFBQSxJQUFJLHNDQUFzQ3dXLGNBQWNyWCxNQUFNO0FBRWxFcVgsVUFBQUEsY0FBY3JYLFNBQVMsR0FBRztBQUN0QjhPLGNBQUFBLFFBQVF1SSxjQUFjLENBQUM7QUFDN0J6VyxnQkFBUUMsSUFBSSwrQkFBK0I7QUFBQSxVQUN6Q3lXLEtBQUt4SSxNQUFNd0k7QUFBQUEsVUFDWEMsUUFBUXpJLE1BQU15STtBQUFBQSxVQUNkL1csVUFBVXNPLE1BQU10TztBQUFBQSxVQUNoQlYsYUFBYWdQLE1BQU1oUDtBQUFBQSxRQUFBQSxDQUNwQjtBQUNENlUsb0JBQVk3RixLQUFLO0FBR2pCLGNBQU0wSSxVQUFVNUMsZUFBZTtBQUMvQixZQUFJNEMsU0FBUztBQUNYNVcsa0JBQVFDLElBQUksdURBQXVEO0FBQ25FMlcsa0JBQVFSLGdCQUFnQmxJLEtBQUs7QUFFN0IsY0FBSSxDQUFDMEksUUFBUUMsZUFBZUMsV0FBVztBQUNyQzlXLG9CQUFRQyxJQUFJLHVEQUF1RDtBQUNuRTJXLG9CQUFRQyxlQUFlRSxXQUFBQSxFQUFhQyxNQUFNaFgsUUFBUW5GLEtBQUs7QUFBQSxVQUFBO0FBQUEsUUFDekQ7QUFJSWlYLGNBQUFBLE9BQU9tRixLQUFLLE1BQU07QUFDdEJqWCxrQkFBUUMsSUFBSSxpREFBaUQ7QUFBQSxRQUFBLENBQzlELEVBQUUrVyxNQUFNRSxDQUFPLFFBQUE7QUFDTnJjLGtCQUFBQSxNQUFNLHNDQUFzQ3FjLEdBQUc7QUFHdkRsWCxrQkFBUUMsSUFBSSxpREFBaUQ7QUFDdkRrWCxnQkFBQUEsYUFBYTliLFNBQVMrYixjQUFjLHNHQUFzRztBQUNoSixjQUFJRCxZQUFZO0FBQ2RuWCxvQkFBUUMsSUFBSSw2Q0FBNkM7QUFDeERrWCx1QkFBMkJFLE1BQU07QUFBQSxVQUFBO0FBQUEsUUFDcEMsQ0FDRDtBQUdELGNBQU1DLGFBQWFBLE1BQU07QUFDdkJ6RCx5QkFBZTNGLE1BQU1oUCxXQUFXO0FBQUEsUUFDbEM7QUFFTTVELGNBQUFBLGlCQUFpQixjQUFjZ2MsVUFBVTtBQUN6Q2hjLGNBQUFBLGlCQUFpQixTQUFTLE1BQU07QUFDcENzWSx1QkFBYSxLQUFLO0FBQ1oyRCxnQkFBQUEsb0JBQW9CLGNBQWNELFVBQVU7QUFBQSxRQUFBLENBQ25EO0FBQUEsTUFBQSxPQUNJO0FBRUx0WCxnQkFBUUMsSUFBSSwyRUFBMkU7QUFDakZrWCxjQUFBQSxhQUFhOWIsU0FBUytiLGNBQWMsc0RBQXNEO0FBQ2hHLFlBQUlELFlBQVk7QUFDZG5YLGtCQUFRQyxJQUFJLHdEQUF3RDtBQUNuRWtYLHFCQUEyQkUsTUFBTTtBQUdsQ3hSLHFCQUFXLE1BQU07QUFDVDJSLGtCQUFBQSxtQkFBbUJuYyxTQUFTc0YsaUJBQWlCLE9BQU87QUFDdEQ2VyxnQkFBQUEsaUJBQWlCcFksU0FBUyxHQUFHO0FBQy9CWSxzQkFBUUMsSUFBSSxzREFBc0Q7QUFDNURpTyxvQkFBQUEsUUFBUXNKLGlCQUFpQixDQUFDO0FBQ2hDekQsMEJBQVk3RixLQUFLO0FBR2pCLG9CQUFNb0osYUFBYUEsTUFBTTtBQUN2QnpELCtCQUFlM0YsTUFBTWhQLFdBQVc7QUFBQSxjQUNsQztBQUVNNUQsb0JBQUFBLGlCQUFpQixjQUFjZ2MsVUFBVTtBQUN6Q2hjLG9CQUFBQSxpQkFBaUIsU0FBUyxNQUFNO0FBQ3BDc1ksNkJBQWEsS0FBSztBQUNaMkQsc0JBQUFBLG9CQUFvQixjQUFjRCxVQUFVO0FBQUEsY0FBQSxDQUNuRDtBQUFBLFlBQUE7QUFBQSxhQUVGLEdBQUc7QUFBQSxRQUFBO0FBQUEsTUFDUjtBQUFBLElBRUo7QUFlQSxVQUFNRyxpQkFBaUJBLE1BQU07QUFDM0J6WCxjQUFRQyxJQUFJLHNDQUFzQztBQUNsRHdULHFCQUFlLElBQUk7QUFBQSxJQUNyQjtBQUVBLFVBQU1pRSxnQkFBZ0JBLE1BQU07QUFDMUIxWCxjQUFRQyxJQUFJLHFDQUFxQztBQUNqRHdULHFCQUFlLEtBQUs7QUFBQSxJQUN0QjtBQUVBelQsWUFBUUMsSUFBSSw4QkFBOEI7QUFBQSxNQUN4Q2dULGFBQWFBLFlBQVk7QUFBQSxNQUN6QkgsY0FBY0EsYUFBYTtBQUFBLE1BQzNCSyxhQUFhQSxZQUFZO0FBQUEsTUFDekJ0VixTQUFTQSxRQUFRO0FBQUEsSUFBQSxDQUNsQjtBQUdERSxXQUFBQSxDQUFBQSxnQkFHS0MsTUFBSTtBQUFBLE1BQUEsSUFBQ0MsT0FBSTtBQUFFME4sZUFBQUEsS0FBQSxNQUFBLENBQUEsRUFBQXNILFlBQUFBLEtBQWlCSCxlQUFjLEVBQUEsS0FBSVUsWUFBWTtBQUFBLE1BQUM7QUFBQSxNQUFBLElBQUExWSxXQUFBO0FBQUEsZUFBQWlELGdCQUN6RG1NLGtCQUFnQjtBQUFBLFVBQUNULFNBQVNpTztBQUFBQSxRQUFBQSxDQUFhO0FBQUEsTUFBQTtBQUFBLElBQUEsQ0FBQTNaLEdBQUFBLGdCQUl6Q0MsTUFBSTtBQUFBLE1BQUEsSUFBQ0MsT0FBSTtBQUFFME4sZUFBQUEsS0FBQSxNQUFBLENBQUEsRUFBQXNILFlBQUFBLEtBQWlCSCxlQUFjLE9BQUksQ0FBQ1UsWUFBWTtBQUFBLE1BQUM7QUFBQSxNQUFBLElBQUU1USxXQUFRO0FBQUEsZ0JBQUEsTUFBQTtBQUFBLGNBQUFvRyxRQUFBdEMsUUFBQTtBQUFBaEwsZ0JBQUFBLE1BQUE2RyxZQUFBLFdBQUEsTUFBQTtBQUFBeUcsaUJBQUFBLE9BQUEsTUFFbEVoSixRQUFRQyxJQUFJLDJDQUEyQ2dULGVBQWUsaUJBQWlCSCxhQUFhLENBQUMsQ0FBQztBQUFBOUosaUJBQUFBO0FBQUFBLFFBQUFBLEdBQUE7QUFBQSxNQUFBO0FBQUEsTUFBQSxJQUFBbE8sV0FBQTtBQUFBLFlBQUF1QixPQUFBb0IsV0FBQWxCLFFBQUFGLEtBQUFHLFlBQUFDLFFBQUFGLE1BQUFDLFlBQUFFLFFBQUFELE1BQUFELFlBQUFzRyxRQUFBcEcsTUFBQUYsWUFBQXVHLFFBQUF0RyxNQUFBRTtBQUFBakIsYUFBQUEsTUFBQTZHLFlBQUEsWUFBQSxPQUFBO0FBQUE3RyxhQUFBQSxNQUFBNkcsWUFBQSxPQUFBLE1BQUE7QUFBQTdHLGFBQUFBLE1BQUE2RyxZQUFBLFNBQUEsTUFBQTtBQUFBN0csYUFBQUEsTUFBQTZHLFlBQUEsVUFBQSxNQUFBO0FBQUE3RyxhQUFBQSxNQUFBNkcsWUFBQSxTQUFBLE9BQUE7QUFBQTdHLGFBQUFBLE1BQUE2RyxZQUFBLFdBQUEsT0FBQTtBQUFBN0csYUFBQUEsTUFBQTZHLFlBQUEsWUFBQSxRQUFBO0FBQUE3RyxhQUFBQSxNQUFBNkcsWUFBQSxpQkFBQSxNQUFBO0FBQUE3RyxhQUFBQSxNQUFBNkcsWUFBQSxjQUFBLHNDQUFBO0FBQUE3RyxhQUFBQSxNQUFBNkcsWUFBQSxXQUFBLE1BQUE7QUFBQTdHLGFBQUFBLE1BQUE2RyxZQUFBLGtCQUFBLFFBQUE7QUFBQWxHLGVBQUFBLE1BZ0J0RzJELE1BQUFBLFFBQVFDLElBQUksZ0RBQWdEaVUsZUFBZSxDQUFDLEdBQUMzWCxLQUFBO0FBQUFiLGNBQUFBLE1BQUE2RyxZQUFBLFVBQUEsTUFBQTtBQUFBN0YsZUFBQUEsT0FBQXFCLGdCQUt2RUMsTUFBSTtBQUFBLFVBQUEsSUFBQ0MsT0FBSTtBQUFBLG1CQUFFbVcsYUFBYTtBQUFBLFVBQUM7QUFBQSxVQUFBLElBQUF0WixXQUFBO0FBQUEsZ0JBQUE4QixRQUFBTixPQUFBO0FBQUEySCxrQkFBQUEsVUFFYixNQUFNb1EsZ0JBQWdCLEtBQUs7QUFBQzNZLGtCQUFBQSxNQUFBNkcsWUFBQSxTQUFBLFNBQUE7QUFBQTNGLG1CQUFBQTtBQUFBQSxVQUFBQTtBQUFBQSxRQUFBLENBQUEsR0FBQWtHLEtBQUE7QUFBQUEsY0FBQW1CLFVBVzlCd1Q7QUFBYy9iLGNBQUFBLE1BQUE2RyxZQUFBLFNBQUEsU0FBQTtBQUFBUSxlQUFBQSxPQUFBaEYsZ0JBYzFCQyxNQUFJO0FBQUEsVUFBQSxJQUFDQyxPQUFJO0FBQUEsbUJBQUVpVyxlQUFlO0FBQUEsVUFBQztBQUFBLFVBQUEsSUFBRXRSLFdBQVE7QUFBQSxtQkFBQTdFLGdCQUNuQ0MsTUFBSTtBQUFBLGNBQUEsSUFBQ0MsT0FBSTtBQUFBLHVCQUFFLENBQUNKLFFBQVE7QUFBQSxjQUFDO0FBQUEsY0FBQSxJQUFFK0UsV0FBUTtBQUFBLHVCQUFBK1UsUUFBQTtBQUFBLGNBQUE7QUFBQSxjQUFBLElBQUE3YyxXQUFBO0FBQUEsdUJBQUFpRCxnQkFRN0JDLE1BQUk7QUFBQSxrQkFBQSxJQUFDQyxPQUFJOztBQUFFa1YsNEJBQUFBLE9BQUFBLE1BQUFBLFlBQUFBLE1BQUFBLGdCQUFBQSxJQUFlaFUsV0FBZmdVLGdCQUFBQSxJQUF1QmdDO0FBQUFBLGtCQUFLO0FBQUEsa0JBQUEsSUFBRXZTLFdBQVE7QUFBQSwyQkFBQWdWLFFBQUE7QUFBQSxrQkFBQTtBQUFBLGtCQUFBLElBQUE5YyxXQUFBO0FBQUEsd0JBQUErYyxRQUFBdFIsUUFBQUEsR0FBQTBDLFFBQUE0TyxNQUFBcmI7QUFBQXlNLDJCQUFBQSxPQUFBbEwsZ0JBVTNDbUksc0JBQW9CO0FBQUEsc0JBQUEsSUFDbkJwSixRQUFLO0FBQUU2TywrQkFBQUEsS0FBQSxNQUFBLENBQUEsQ0FBQXFJLGVBQUFBLENBQWdCLEVBQUEsSUFBR0EsZUFBQUEsRUFBa0JsWCxNQUFBQSxJQUFVO0FBQUEsc0JBQUM7QUFBQSxzQkFDdkRDLE1BQU07QUFBQSxzQkFBQyxJQUNQb0MsU0FBTTs7QUFBQSxpQ0FBRWdVLE9BQUFBLE1BQUFBLFlBQVksTUFBWkEsZ0JBQUFBLElBQWVoVSxXQUFmZ1UsZ0JBQUFBLElBQXVCZ0MsVUFBUyxDQUFFO0FBQUEsc0JBQUE7QUFBQSxzQkFBQSxJQUMxQ2pXLGNBQVc7QUFBQSwrQkFBRXlNLEtBQUFxSSxNQUFBQSxDQUFBQSxDQUFBQSxnQkFBZ0IsRUFBQSxJQUFHQSxlQUFlLEVBQUc5VSxZQUFZLElBQUlBLGdCQUFnQjtBQUFBLHNCQUFJO0FBQUEsc0JBQ3RGeUgsYUFBYSxDQUFFO0FBQUEsc0JBQUEsSUFDZmxHLFlBQVM7QUFBRWtMLCtCQUFBQSxLQUFBLE1BQUEsQ0FBQSxDQUFBcUksZ0JBQWdCLEVBQUEsSUFBSUEsaUJBQWtCdlQsVUFBZXVULEtBQUFBLGVBQUFBLEVBQWtCTixnQkFBZ0IsT0FBU2pULFVBQVUsS0FBS2lULGdCQUFnQjtBQUFBLHNCQUFLO0FBQUEsc0JBQy9JMVAsU0FBU2tSO0FBQUFBLHNCQUNUcFIsZUFBZ0J3RixDQUFVQSxXQUFBO0FBQ2hCckosZ0NBQUFBLElBQUksK0JBQStCcUosTUFBSztBQUNoRGlMLHlDQUFpQmpMLE1BQUs7QUFFdEIsOEJBQU1zTixVQUFVNUMsZUFBZTtBQUMvQiw0QkFBSTRDLFNBQVM7QUFDWDVXLGtDQUFRQyxJQUFJLCtDQUErQztBQUMzRDJXLGtDQUFRVixrQkFBa0I1TSxNQUFLO0FBQUEsd0JBQUEsT0FDMUI7QUFDTHRKLGtDQUFRQyxJQUFJLHdFQUF3RTtBQUFBLHdCQUFBO0FBSXRGLDhCQUFNaU8sUUFBUTRGLFNBQVM7QUFDdkIsNEJBQUk1RixPQUFPO0FBQ1QsZ0NBQU00SixPQUFPeE8sV0FBVSxTQUFTLE1BQU1BLFdBQVUsVUFBVSxPQUFPO0FBQ3pEckosa0NBQUFBLElBQUkseURBQXlENlgsSUFBSTtBQUN6RTVKLGdDQUFNNkosZUFBZUQ7QUFBQUEsd0JBQUFBO0FBQUFBLHNCQUV6QjtBQUFBLHNCQUFDLElBQ0R0TixjQUFXO0FBQUVtQiwrQkFBQUEsS0FBQSxNQUFBLENBQUEsQ0FBQXFJLGVBQUFBLENBQWdCLEVBQUEsSUFBR0EsZUFBQUEsRUFBa0J4SixZQUFBQSxJQUFnQjtBQUFBLHNCQUFLO0FBQUEsc0JBQUEsSUFDdkU1TCxhQUFVO0FBQUEsK0JBQUUrTSxLQUFBLE1BQUEsQ0FBQSxDQUFBcUksZUFBZSxDQUFDLEVBQUdBLElBQUFBLGVBQWUsRUFBR3BWLFdBQVcsSUFBSSxDQUFFO0FBQUEsc0JBQUE7QUFBQSxvQkFBQSxDQUFBLENBQUE7QUFBQWlaLDJCQUFBQSxPQUFBOVosZ0JBS3JFQyxNQUFJO0FBQUEsc0JBQUEsSUFBQ0MsT0FBSTtBQUFBLCtCQUFFME4sYUFBQXFJLGVBQWdCLENBQUEsRUFBR0EsSUFBQUEsZUFBa0JOLEVBQUFBLFVBQWdCLE1BQUEsT0FBT0EsVUFBZ0IsTUFBQTtBQUFBLHNCQUFJO0FBQUEsc0JBQUEsSUFBQTVZLFdBQUE7QUFBQSw0QkFBQW9PLFNBQUE1QyxRQUFBLEdBQUE2QyxTQUFBRCxPQUFBMU0sWUFBQTRNLFNBQUFELE9BQUEzTTtBQUFBSywrQkFBQXVNLFNBQUEsTUFBQTtBQUFBLDhCQUFBc0MsTUFBQUMsS0FJbkZxSSxNQUFBQSxDQUFBQSxDQUFBQSxnQkFBZ0I7QUFBQSxpQ0FBQSxNQUFoQnRJLElBQUEsSUFBbUJzSSxlQUFrQk4sRUFBQUEsVUFBQUEsSUFBY0EsVUFBVTtBQUFBLHdCQUFBLElBQUM7QUFBQXhLLCtCQUFBQTtBQUFBQSxzQkFBQUE7QUFBQUEsb0JBQUEsQ0FBQSxHQUFBLElBQUE7QUFBQTJPLDJCQUFBQTtBQUFBQSxrQkFBQUE7QUFBQUEsZ0JBQUEsQ0FBQTtBQUFBLGNBQUE7QUFBQSxZQUFBLENBQUE7QUFBQSxVQUFBO0FBQUEsVUFBQSxJQUFBL2MsV0FBQTtBQUFBLG1CQUFBaUQsZ0JBVzVFQyxNQUFJO0FBQUEsY0FBQSxJQUFDQyxPQUFJO0FBQUEsdUJBQUVtVyxhQUFhO0FBQUEsY0FBQztBQUFBLGNBQUEsSUFBRXhSLFdBQVE7QUFBQSx1QkFBQTdFLGdCQUNqQzhJLGNBQVk7QUFBQSxrQkFBQSxJQUFBL0wsV0FBQTtBQUFBLHdCQUFBa2QsU0FBQUMsUUFBQTtBQUFBRCwyQkFBQUEsUUFBQWphLGdCQUVSQyxNQUFJO0FBQUEsc0JBQUEsSUFBQ0MsT0FBSTtBQUFFLCtCQUFBLENBQUNpVyxpQkFBaUJnRTtBQUFBQSxzQkFBUztBQUFBLHNCQUFBLElBQUV0VixXQUFRO0FBQUEsK0JBQUF1VixRQUFBO0FBQUEsc0JBQUE7QUFBQSxzQkFBQSxJQUFBcmQsV0FBQTtBQUFBLCtCQUFBaUQsZ0JBUzlDOEssZ0JBQWM7QUFBQSwwQkFBQSxTQUFBO0FBQUEsMEJBQUEsSUFFYi9MLFFBQUs7QUFBQSxtQ0FBRW9YLGVBQWlCcFgsRUFBQUE7QUFBQUEsMEJBQUs7QUFBQSwwQkFDN0JDLE1BQU07QUFBQSwwQkFBQyxJQUNQdU0sUUFBSztBQUFBLG1DQUFFZ0wsY0FBYztBQUFBLDBCQUFDO0FBQUEsMEJBQUEsSUFDdEJ2TCxlQUFZO0FBQUEsbUNBQ1Y0QyxXQUFBdUksaUJBQWlCcFgsU0FBUyxFQUFFLEVBQUEsSUFBRyw0QkFDL0I2TyxXQUFBdUksaUJBQWlCcFgsU0FBUyxFQUFFLEVBQUcsSUFBQSwyQkFDL0I2TyxLQUFBLE1BQUF1SSxpQkFBaUJwWCxTQUFTLEVBQUUsRUFBRyxJQUFBLGVBQy9Cb1gsZUFBQUEsRUFBaUJwWCxTQUFTLEtBQUssaUJBQy9CO0FBQUEsMEJBQWtCO0FBQUEsMEJBRXBCeU0sWUFBWUEsTUFBTTtBQUNoQnZKLG9DQUFRQyxJQUFJLHNDQUFzQztBQUNsRG9VLDRDQUFnQixJQUFJO0FBQUEsMEJBQUE7QUFBQSx3QkFDdEIsQ0FBQztBQUFBLHNCQUFBO0FBQUEsb0JBQUEsQ0FBQSxDQUFBO0FBQUEyRCwyQkFBQUE7QUFBQUEsa0JBQUFBO0FBQUFBLGdCQUFBLENBQUE7QUFBQSxjQUFBO0FBQUEsY0FBQSxJQUFBbGQsV0FBQTtBQUFBLG9CQUFBMEwsUUFBQXJJLFFBQUE7QUFBQXFJLHVCQUFBQSxPQUFBekksZ0JBUU42VSxjQUFZO0FBQUEsa0JBQUEsSUFDWHpGLFlBQVM7O0FBQUEsNEJBQUUrRyxNQUFBQSxlQUFrQi9HLE1BQWxCK0csZ0JBQUFBLElBQWtCL0c7QUFBQUEsa0JBQVM7QUFBQSxrQkFDdENtRixRQUFRQSxNQUFNK0IsZ0JBQWdCLEtBQUs7QUFBQSxnQkFBQSxDQUFDLENBQUE7QUFBQTdOLHVCQUFBQTtBQUFBQSxjQUFBQTtBQUFBQSxZQUFBLENBQUE7QUFBQSxVQUFBO0FBQUEsUUFBQSxDQUFBLENBQUE7QUFBQW5LLGVBQUFBO0FBQUFBLE1BQUFBO0FBQUFBLElBQUEsQ0FBQSxDQUFBO0FBQUEsRUFXMUQ7QUFBRUgsaUJBQUEsQ0FBQSxPQUFBLENBQUE7O0FDaGNGLFFBQUEsYUFBZWtjLG9CQUFvQjtBQUFBLElBQ2pDekcsU0FBUyxDQUFDLHdCQUF3Qix3QkFBd0Isc0JBQXNCLG1CQUFtQjtBQUFBLElBQ25HMEcsT0FBTztBQUFBLElBQ1BDLGtCQUFrQjtBQUFBLElBRWxCLE1BQU1DLEtBQUtDLEtBQTJCO0FBRWhDQyxVQUFBQSxPQUFPcFgsUUFBUW9YLE9BQU9DLE1BQU07QUFDOUI7QUFBQSxNQUFBO0FBSUlDLFlBQUFBLEtBQUssTUFBTUMsbUJBQW1CSixLQUFLO0FBQUEsUUFDdkNLLE1BQU07QUFBQSxRQUNOQyxVQUFVO0FBQUEsUUFDVkMsUUFBUTtBQUFBLFFBQ1J2RSxTQUFTLE9BQU93RSxjQUEyQjtBQUVuQ0MsZ0JBQUFBLFVBQVU1ZCxTQUFTNmQsY0FBYyxLQUFLO0FBQzVDRCxrQkFBUUUsWUFBWTtBQUNwQkgsb0JBQVVJLFlBQVlILE9BQU87QUFHdkI3ZCxnQkFBQUEsV0FBVWllLE9BQU8sTUFBQXRiLGdCQUFPOFUsWUFBVSxDQUFBLENBQUEsR0FBS29HLE9BQU87QUFFN0M3ZCxpQkFBQUE7QUFBQUEsUUFDVDtBQUFBLFFBQ0FrZSxVQUFVQSxDQUFDM0UsWUFBeUI7QUFDeEI7QUFBQSxRQUFBO0FBQUEsTUFDWixDQUNEO0FBR0RnRSxTQUFHWSxNQUFNO0FBQUEsSUFBQTtBQUFBLEVBRWIsQ0FBQzs7QUN6Q00sUUFBTSwwQkFBTixNQUFNLGdDQUErQixNQUFNO0FBQUEsSUFDaEQsWUFBWSxRQUFRLFFBQVE7QUFDcEIsWUFBQSx3QkFBdUIsWUFBWSxFQUFFO0FBQzNDLFdBQUssU0FBUztBQUNkLFdBQUssU0FBUztBQUFBLElBQUE7QUFBQSxFQUdsQjtBQURFLGdCQU5XLHlCQU1KLGNBQWEsbUJBQW1CLG9CQUFvQjtBQU50RCxNQUFNLHlCQUFOO0FBUUEsV0FBUyxtQkFBbUIsV0FBVzs7QUFDNUMsV0FBTyxJQUFHMWQsTUFBQSxtQ0FBUyxZQUFULGdCQUFBQSxJQUFrQixFQUFFLElBQUksU0FBMEIsSUFBSSxTQUFTO0FBQUEsRUFDM0U7QUNWTyxXQUFTLHNCQUFzQixLQUFLO0FBQ3pDLFFBQUk7QUFDSixRQUFJO0FBQ0osV0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFLTCxNQUFNO0FBQ0osWUFBSSxZQUFZLEtBQU07QUFDdEIsaUJBQVMsSUFBSSxJQUFJLFNBQVMsSUFBSTtBQUM5QixtQkFBVyxJQUFJLFlBQVksTUFBTTtBQUMvQixjQUFJLFNBQVMsSUFBSSxJQUFJLFNBQVMsSUFBSTtBQUNsQyxjQUFJLE9BQU8sU0FBUyxPQUFPLE1BQU07QUFDL0IsbUJBQU8sY0FBYyxJQUFJLHVCQUF1QixRQUFRLE1BQU0sQ0FBQztBQUMvRCxxQkFBUztBQUFBLFVBQ25CO0FBQUEsUUFDTyxHQUFFLEdBQUc7QUFBQSxNQUNaO0FBQUEsSUFDRztBQUFBLEVBQ0g7QUNmTyxRQUFNLHdCQUFOLE1BQU0sc0JBQXFCO0FBQUEsSUFDaEMsWUFBWSxtQkFBbUIsU0FBUztBQWN4Qyx3Q0FBYSxPQUFPLFNBQVMsT0FBTztBQUNwQztBQUNBLDZDQUFrQixzQkFBc0IsSUFBSTtBQUM1QyxnREFBcUMsb0JBQUksSUFBSztBQWhCNUMsV0FBSyxvQkFBb0I7QUFDekIsV0FBSyxVQUFVO0FBQ2YsV0FBSyxrQkFBa0IsSUFBSSxnQkFBaUI7QUFDNUMsVUFBSSxLQUFLLFlBQVk7QUFDbkIsYUFBSyxzQkFBc0IsRUFBRSxrQkFBa0IsS0FBSSxDQUFFO0FBQ3JELGFBQUssZUFBZ0I7QUFBQSxNQUMzQixPQUFXO0FBQ0wsYUFBSyxzQkFBdUI7QUFBQSxNQUNsQztBQUFBLElBQ0E7QUFBQSxJQVFFLElBQUksU0FBUztBQUNYLGFBQU8sS0FBSyxnQkFBZ0I7QUFBQSxJQUNoQztBQUFBLElBQ0UsTUFBTSxRQUFRO0FBQ1osYUFBTyxLQUFLLGdCQUFnQixNQUFNLE1BQU07QUFBQSxJQUM1QztBQUFBLElBQ0UsSUFBSSxZQUFZO0FBQ2QsVUFBSSxRQUFRLFFBQVEsTUFBTSxNQUFNO0FBQzlCLGFBQUssa0JBQW1CO0FBQUEsTUFDOUI7QUFDSSxhQUFPLEtBQUssT0FBTztBQUFBLElBQ3ZCO0FBQUEsSUFDRSxJQUFJLFVBQVU7QUFDWixhQUFPLENBQUMsS0FBSztBQUFBLElBQ2pCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQWNFLGNBQWMsSUFBSTtBQUNoQixXQUFLLE9BQU8saUJBQWlCLFNBQVMsRUFBRTtBQUN4QyxhQUFPLE1BQU0sS0FBSyxPQUFPLG9CQUFvQixTQUFTLEVBQUU7QUFBQSxJQUM1RDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQVlFLFFBQVE7QUFDTixhQUFPLElBQUksUUFBUSxNQUFNO0FBQUEsTUFDN0IsQ0FBSztBQUFBLElBQ0w7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUlFLFlBQVksU0FBUyxTQUFTO0FBQzVCLFlBQU0sS0FBSyxZQUFZLE1BQU07QUFDM0IsWUFBSSxLQUFLLFFBQVMsU0FBUztBQUFBLE1BQzVCLEdBQUUsT0FBTztBQUNWLFdBQUssY0FBYyxNQUFNLGNBQWMsRUFBRSxDQUFDO0FBQzFDLGFBQU87QUFBQSxJQUNYO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFJRSxXQUFXLFNBQVMsU0FBUztBQUMzQixZQUFNLEtBQUssV0FBVyxNQUFNO0FBQzFCLFlBQUksS0FBSyxRQUFTLFNBQVM7QUFBQSxNQUM1QixHQUFFLE9BQU87QUFDVixXQUFLLGNBQWMsTUFBTSxhQUFhLEVBQUUsQ0FBQztBQUN6QyxhQUFPO0FBQUEsSUFDWDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFLRSxzQkFBc0IsVUFBVTtBQUM5QixZQUFNLEtBQUssc0JBQXNCLElBQUksU0FBUztBQUM1QyxZQUFJLEtBQUssUUFBUyxVQUFTLEdBQUcsSUFBSTtBQUFBLE1BQ3hDLENBQUs7QUFDRCxXQUFLLGNBQWMsTUFBTSxxQkFBcUIsRUFBRSxDQUFDO0FBQ2pELGFBQU87QUFBQSxJQUNYO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUtFLG9CQUFvQixVQUFVLFNBQVM7QUFDckMsWUFBTSxLQUFLLG9CQUFvQixJQUFJLFNBQVM7QUFDMUMsWUFBSSxDQUFDLEtBQUssT0FBTyxRQUFTLFVBQVMsR0FBRyxJQUFJO0FBQUEsTUFDM0MsR0FBRSxPQUFPO0FBQ1YsV0FBSyxjQUFjLE1BQU0sbUJBQW1CLEVBQUUsQ0FBQztBQUMvQyxhQUFPO0FBQUEsSUFDWDtBQUFBLElBQ0UsaUJBQWlCLFFBQVEsTUFBTSxTQUFTLFNBQVM7O0FBQy9DLFVBQUksU0FBUyxzQkFBc0I7QUFDakMsWUFBSSxLQUFLLFFBQVMsTUFBSyxnQkFBZ0IsSUFBSztBQUFBLE1BQ2xEO0FBQ0ksT0FBQUEsTUFBQSxPQUFPLHFCQUFQLGdCQUFBQSxJQUFBO0FBQUE7QUFBQSxRQUNFLEtBQUssV0FBVyxNQUFNLElBQUksbUJBQW1CLElBQUksSUFBSTtBQUFBLFFBQ3JEO0FBQUEsUUFDQTtBQUFBLFVBQ0UsR0FBRztBQUFBLFVBQ0gsUUFBUSxLQUFLO0FBQUEsUUFDckI7QUFBQTtBQUFBLElBRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBS0Usb0JBQW9CO0FBQ2xCLFdBQUssTUFBTSxvQ0FBb0M7QUFDL0NELGVBQU87QUFBQSxRQUNMLG1CQUFtQixLQUFLLGlCQUFpQjtBQUFBLE1BQzFDO0FBQUEsSUFDTDtBQUFBLElBQ0UsaUJBQWlCO0FBQ2YsYUFBTztBQUFBLFFBQ0w7QUFBQSxVQUNFLE1BQU0sc0JBQXFCO0FBQUEsVUFDM0IsbUJBQW1CLEtBQUs7QUFBQSxVQUN4QixXQUFXLEtBQUssT0FBUSxFQUFDLFNBQVMsRUFBRSxFQUFFLE1BQU0sQ0FBQztBQUFBLFFBQzlDO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNMO0FBQUEsSUFDRSx5QkFBeUIsT0FBTzs7QUFDOUIsWUFBTSx5QkFBdUJDLE1BQUEsTUFBTSxTQUFOLGdCQUFBQSxJQUFZLFVBQVMsc0JBQXFCO0FBQ3ZFLFlBQU0sd0JBQXNCQyxNQUFBLE1BQU0sU0FBTixnQkFBQUEsSUFBWSx1QkFBc0IsS0FBSztBQUNuRSxZQUFNLGlCQUFpQixDQUFDLEtBQUssbUJBQW1CLEtBQUksV0FBTSxTQUFOLG1CQUFZLFNBQVM7QUFDekUsYUFBTyx3QkFBd0IsdUJBQXVCO0FBQUEsSUFDMUQ7QUFBQSxJQUNFLHNCQUFzQixTQUFTO0FBQzdCLFVBQUksVUFBVTtBQUNkLFlBQU0sS0FBSyxDQUFDLFVBQVU7QUFDcEIsWUFBSSxLQUFLLHlCQUF5QixLQUFLLEdBQUc7QUFDeEMsZUFBSyxtQkFBbUIsSUFBSSxNQUFNLEtBQUssU0FBUztBQUNoRCxnQkFBTSxXQUFXO0FBQ2pCLG9CQUFVO0FBQ1YsY0FBSSxhQUFZLG1DQUFTLGtCQUFrQjtBQUMzQyxlQUFLLGtCQUFtQjtBQUFBLFFBQ2hDO0FBQUEsTUFDSztBQUNELHVCQUFpQixXQUFXLEVBQUU7QUFDOUIsV0FBSyxjQUFjLE1BQU0sb0JBQW9CLFdBQVcsRUFBRSxDQUFDO0FBQUEsSUFDL0Q7QUFBQSxFQUNBO0FBckpFLGdCQVpXLHVCQVlKLCtCQUE4QjtBQUFBLElBQ25DO0FBQUEsRUFDRDtBQWRJLE1BQU0sdUJBQU47Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0RQLFFBQU1tTCxpQkFBNkI7QUFBQSxJQUFBLFFBQ2pDdVM7QUFBQUEsSUFBQSxTQUNBQztBQUFBQSxJQUNBQyxTQUFBQTtBQUFBQSxFQUNGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0pBLFFBQU0sZUFBNkI7QUFBQSxJQUNqQztBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDRjs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsMSwyLDMsNCw1LDYsNyw4LDksMTAsMTEsMTIsMTMsMTQsMTUsNDQsNDUsNjEsNjIsNjNdfQ==

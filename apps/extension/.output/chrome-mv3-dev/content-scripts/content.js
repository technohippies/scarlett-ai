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
  var _tmpl$$f = /* @__PURE__ */ template(`<div><button><span class="relative z-10">Start</span></button><div class="w-px bg-black/20"></div><button aria-label="Change playback speed"title="Change playback speed"><span class="relative z-10 flex items-center gap-1"><span></span><svg width=8 height=8 viewBox="0 0 8 8"fill=none xmlns=http://www.w3.org/2000/svg class=opacity-60><path d="M2 3L4 5L6 3"stroke=currentColor stroke-width=1.5 stroke-linecap=round stroke-linejoin=round>`);
  const speeds = ["1x", "0.75x", "0.5x"];
  const SplitButton = (props) => {
    const [currentSpeedIndex, setCurrentSpeedIndex] = createSignal(0);
    const currentSpeed = () => speeds[currentSpeedIndex()];
    const cycleSpeed = (e) => {
      var _a2;
      e.stopPropagation();
      e.preventDefault();
      const nextIndex = (currentSpeedIndex() + 1) % speeds.length;
      setCurrentSpeedIndex(nextIndex);
      const newSpeed = speeds[nextIndex];
      if (newSpeed) {
        (_a2 = props.onSpeedChange) == null ? void 0 : _a2.call(props, newSpeed);
      }
    };
    const handleStart = (e) => {
      var _a2;
      e.stopPropagation();
      e.preventDefault();
      (_a2 = props.onStart) == null ? void 0 : _a2.call(props);
    };
    return (() => {
      var _el$ = _tmpl$$f(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling, _el$4 = _el$3.nextSibling, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild;
      _el$2.$$click = handleStart;
      _el$4.$$click = cycleSpeed;
      insert(_el$6, currentSpeed);
      createRenderEffect((_p$) => {
        var _v$ = cn("relative inline-flex w-full rounded-lg overflow-hidden", "bg-gradient-primary text-white shadow-lg", "transition-all duration-300", props.class), _v$2 = props.disabled, _v$3 = cn("flex-1 inline-flex items-center justify-center relative overflow-hidden", "h-12 px-6 text-lg font-medium", "cursor-pointer border-none outline-none", "disabled:cursor-not-allowed disabled:opacity-50", "hover:bg-white/10 active:bg-white/20", "transition-colors"), _v$4 = props.disabled, _v$5 = cn("inline-flex items-center justify-center relative", "w-16 text-base font-medium", "cursor-pointer border-none outline-none", "disabled:cursor-not-allowed disabled:opacity-50", "hover:bg-white/10 active:bg-white/20", "transition-colors", "border-l border-l-black/20");
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
        createRenderEffect(() => className(_el$, cn("flex flex-col", props.class)));
        return _el$;
      }
    });
  };
  const TabsList = (props) => {
    return (() => {
      var _el$2 = _tmpl$$e();
      insert(_el$2, () => props.children);
      createRenderEffect(() => className(_el$2, cn("flex h-10 items-center justify-center rounded-md bg-elevated p-1 text-secondary", "border border-subtle w-full", props.class)));
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
      createRenderEffect(() => className(_el$3, cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5", "text-sm font-medium ring-offset-base transition-all duration-200", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2", "disabled:pointer-events-none disabled:opacity-50", "flex-1 relative", isActive() ? "bg-surface text-primary shadow-sm border border-default" : "text-secondary hover:text-primary hover:bg-highlight/50", props.class)));
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
        createRenderEffect(() => className(_el$4, cn("mt-2 ring-offset-base flex-1", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2", props.class)));
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
      createRenderEffect(() => className(_el$, cn("border-t border-subtle bg-surface p-6", props.class)));
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
  var _tmpl$$4 = /* @__PURE__ */ template(`<div class="border-t border-subtle bg-surface p-6"><div class="max-w-2xl mx-auto">`), _tmpl$2$4 = /* @__PURE__ */ template(`<p class="text-base text-secondary mt-1">`), _tmpl$3$2 = /* @__PURE__ */ template(`<div class="flex items-center gap-4"><div><p class="text-2xl font-bold">`), _tmpl$4$2 = /* @__PURE__ */ template(`<div class="flex items-center justify-between gap-6">`);
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
    const apiBaseUrl = () => props.apiBaseUrl || "https://scarlett-api-dev.deletion-backup782.workers.dev";
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
  delegateEvents(["click"]);
  content;
  content;
  delegateEvents(["click"]);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL2Rpc3QvZGV2LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL3dlYi9kaXN0L2Rldi5qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWUvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnQvbGliL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbnkta2V5cy1tYXAvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvZGVmdS9kaXN0L2RlZnUubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0AxbmF0c3Uvd2FpdC1lbGVtZW50L2Rpc3QvZGV0ZWN0b3JzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AMW5hdHN1L3dhaXQtZWxlbWVudC9kaXN0L2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYXJlZC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9jbHN4L2Rpc3QvY2xzeC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvY24udHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9sYXlvdXQvSGVhZGVyL0hlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9kaXNwbGF5L1Njb3JlUGFuZWwvU2NvcmVQYW5lbC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vQnV0dG9uL0J1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9vbmJvYXJkaW5nL09uYm9hcmRpbmdGbG93L09uYm9hcmRpbmdGbG93LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheS9MeXJpY3NEaXNwbGF5LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvS2FyYW9rZUhlYWRlci9LYXJhb2tlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbC9MZWFkZXJib2FyZFBhbmVsLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9TcGxpdEJ1dHRvbi9TcGxpdEJ1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vVGFicy9UYWJzLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2VmZmVjdHMvRmlyZUVtb2ppQW5pbWF0aW9uL0ZpcmVFbW9qaUFuaW1hdGlvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9rYXJhb2tlL0V4dGVuc2lvbkthcmFva2VWaWV3L0V4dGVuc2lvbkthcmFva2VWaWV3LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9pMThuL3Byb3ZpZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvQ29tcGxldGlvblZpZXcvQ29tcGxldGlvblZpZXcudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL3NlcnZpY2VzL2F1ZGlvL2thcmFva2VBdWRpb1Byb2Nlc3Nvci50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2NsaWVudC50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2VuZHBvaW50cy9rYXJhb2tlLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvZW5kcG9pbnRzL3ByYWN0aWNlLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvZW5kcG9pbnRzL3N0dC50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2VuZHBvaW50cy9hdXRoLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvaW5kZXgudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvc2VydmljZXMva2FyYW9rZS9rYXJhb2tlQXBpLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL3NlcnZpY2VzL2thcmFva2UvY2h1bmtpbmdVdGlscy50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9Qcm9ncmVzc0Jhci9Qcm9ncmVzc0Jhci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vTW9kYWwvTW9kYWwudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvTWluaW1pemVkS2FyYW9rZS50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9QcmFjdGljZUhlYWRlci9QcmFjdGljZUhlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9FeGVyY2lzZUZvb3Rlci9FeGVyY2lzZUZvb3Rlci50c3giLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvcGhvc3Bob3ItaWNvbnMtc29saWQvZGlzdC9JY29uQ2hlY2tDaXJjbGVGaWxsLmpzeCIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9waG9zcGhvci1pY29ucy1zb2xpZC9kaXN0L0ljb25YQ2lyY2xlRmlsbC5qc3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9SZXNwb25zZUZvb3Rlci9SZXNwb25zZUZvb3Rlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9FeGVyY2lzZVRlbXBsYXRlL0V4ZXJjaXNlVGVtcGxhdGUudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcHJhY3RpY2UvUmVhZEFsb3VkL1JlYWRBbG91ZC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvc291bmQudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9QcmFjdGljZUV4ZXJjaXNlVmlldy9QcmFjdGljZUV4ZXJjaXNlVmlldy50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy93ZWIvU3Vic2NyaXB0aW9uTW9kYWwvU3Vic2NyaXB0aW9uTW9kYWwudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvd2ViL1N1YnNjcmlwdGlvblNsaWRlci9TdWJzY3JpcHRpb25TbGlkZXIudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvd2ViL0ZhcmNhc3Rlck1pbmlBcHAvRmFyY2FzdGVyTWluaUFwcC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy93ZWIvQXV0aEJ1dHRvbi9BdXRoQnV0dG9uLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3BhZ2VzL0hvbWVQYWdlL0hvbWVQYWdlLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9ob29rcy91c2VLYXJhb2tlU2Vzc2lvbi50cyIsIi4uLy4uLy4uL3NyYy9zZXJ2aWNlcy90cmFjay1kZXRlY3Rvci50cyIsIi4uLy4uLy4uL3NyYy91dGlscy9zdG9yYWdlLnRzIiwiLi4vLi4vLi4vc3JjL3NlcnZpY2VzL2thcmFva2UtYXBpLnRzIiwiLi4vLi4vLi4vc3JjL3ZpZXdzL2NvbnRlbnQvUHJhY3RpY2VWaWV3LnRzeCIsIi4uLy4uLy4uL3NyYy92aWV3cy9jb250ZW50L0NvbnRlbnRBcHAudHN4IiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC50c3giLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvaTE4bi9sb2NhbGVzL2VuL2luZGV4LnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2kxOG4vbG9jYWxlcy96aC1DTi9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgdGFza0lkQ291bnRlciA9IDEsXG4gIGlzQ2FsbGJhY2tTY2hlZHVsZWQgPSBmYWxzZSxcbiAgaXNQZXJmb3JtaW5nV29yayA9IGZhbHNlLFxuICB0YXNrUXVldWUgPSBbXSxcbiAgY3VycmVudFRhc2sgPSBudWxsLFxuICBzaG91bGRZaWVsZFRvSG9zdCA9IG51bGwsXG4gIHlpZWxkSW50ZXJ2YWwgPSA1LFxuICBkZWFkbGluZSA9IDAsXG4gIG1heFlpZWxkSW50ZXJ2YWwgPSAzMDAsXG4gIHNjaGVkdWxlQ2FsbGJhY2sgPSBudWxsLFxuICBzY2hlZHVsZWRDYWxsYmFjayA9IG51bGw7XG5jb25zdCBtYXhTaWduZWQzMUJpdEludCA9IDEwNzM3NDE4MjM7XG5mdW5jdGlvbiBzZXR1cFNjaGVkdWxlcigpIHtcbiAgY29uc3QgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpLFxuICAgIHBvcnQgPSBjaGFubmVsLnBvcnQyO1xuICBzY2hlZHVsZUNhbGxiYWNrID0gKCkgPT4gcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSAoKSA9PiB7XG4gICAgaWYgKHNjaGVkdWxlZENhbGxiYWNrICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBjdXJyZW50VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgZGVhZGxpbmUgPSBjdXJyZW50VGltZSArIHlpZWxkSW50ZXJ2YWw7XG4gICAgICBjb25zdCBoYXNUaW1lUmVtYWluaW5nID0gdHJ1ZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGhhc01vcmVXb3JrID0gc2NoZWR1bGVkQ2FsbGJhY2soaGFzVGltZVJlbWFpbmluZywgY3VycmVudFRpbWUpO1xuICAgICAgICBpZiAoIWhhc01vcmVXb3JrKSB7XG4gICAgICAgICAgc2NoZWR1bGVkQ2FsbGJhY2sgPSBudWxsO1xuICAgICAgICB9IGVsc2UgcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHBvcnQucG9zdE1lc3NhZ2UobnVsbCk7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgaWYgKG5hdmlnYXRvciAmJiBuYXZpZ2F0b3Iuc2NoZWR1bGluZyAmJiBuYXZpZ2F0b3Iuc2NoZWR1bGluZy5pc0lucHV0UGVuZGluZykge1xuICAgIGNvbnN0IHNjaGVkdWxpbmcgPSBuYXZpZ2F0b3Iuc2NoZWR1bGluZztcbiAgICBzaG91bGRZaWVsZFRvSG9zdCA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBpZiAoY3VycmVudFRpbWUgPj0gZGVhZGxpbmUpIHtcbiAgICAgICAgaWYgKHNjaGVkdWxpbmcuaXNJbnB1dFBlbmRpbmcoKSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjdXJyZW50VGltZSA+PSBtYXhZaWVsZEludGVydmFsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgc2hvdWxkWWllbGRUb0hvc3QgPSAoKSA9PiBwZXJmb3JtYW5jZS5ub3coKSA+PSBkZWFkbGluZTtcbiAgfVxufVxuZnVuY3Rpb24gZW5xdWV1ZSh0YXNrUXVldWUsIHRhc2spIHtcbiAgZnVuY3Rpb24gZmluZEluZGV4KCkge1xuICAgIGxldCBtID0gMDtcbiAgICBsZXQgbiA9IHRhc2tRdWV1ZS5sZW5ndGggLSAxO1xuICAgIHdoaWxlIChtIDw9IG4pIHtcbiAgICAgIGNvbnN0IGsgPSBuICsgbSA+PiAxO1xuICAgICAgY29uc3QgY21wID0gdGFzay5leHBpcmF0aW9uVGltZSAtIHRhc2tRdWV1ZVtrXS5leHBpcmF0aW9uVGltZTtcbiAgICAgIGlmIChjbXAgPiAwKSBtID0gayArIDE7ZWxzZSBpZiAoY21wIDwgMCkgbiA9IGsgLSAxO2Vsc2UgcmV0dXJuIGs7XG4gICAgfVxuICAgIHJldHVybiBtO1xuICB9XG4gIHRhc2tRdWV1ZS5zcGxpY2UoZmluZEluZGV4KCksIDAsIHRhc2spO1xufVxuZnVuY3Rpb24gcmVxdWVzdENhbGxiYWNrKGZuLCBvcHRpb25zKSB7XG4gIGlmICghc2NoZWR1bGVDYWxsYmFjaykgc2V0dXBTY2hlZHVsZXIoKTtcbiAgbGV0IHN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpLFxuICAgIHRpbWVvdXQgPSBtYXhTaWduZWQzMUJpdEludDtcbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy50aW1lb3V0KSB0aW1lb3V0ID0gb3B0aW9ucy50aW1lb3V0O1xuICBjb25zdCBuZXdUYXNrID0ge1xuICAgIGlkOiB0YXNrSWRDb3VudGVyKyssXG4gICAgZm4sXG4gICAgc3RhcnRUaW1lLFxuICAgIGV4cGlyYXRpb25UaW1lOiBzdGFydFRpbWUgKyB0aW1lb3V0XG4gIH07XG4gIGVucXVldWUodGFza1F1ZXVlLCBuZXdUYXNrKTtcbiAgaWYgKCFpc0NhbGxiYWNrU2NoZWR1bGVkICYmICFpc1BlcmZvcm1pbmdXb3JrKSB7XG4gICAgaXNDYWxsYmFja1NjaGVkdWxlZCA9IHRydWU7XG4gICAgc2NoZWR1bGVkQ2FsbGJhY2sgPSBmbHVzaFdvcms7XG4gICAgc2NoZWR1bGVDYWxsYmFjaygpO1xuICB9XG4gIHJldHVybiBuZXdUYXNrO1xufVxuZnVuY3Rpb24gY2FuY2VsQ2FsbGJhY2sodGFzaykge1xuICB0YXNrLmZuID0gbnVsbDtcbn1cbmZ1bmN0aW9uIGZsdXNoV29yayhoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSkge1xuICBpc0NhbGxiYWNrU2NoZWR1bGVkID0gZmFsc2U7XG4gIGlzUGVyZm9ybWluZ1dvcmsgPSB0cnVlO1xuICB0cnkge1xuICAgIHJldHVybiB3b3JrTG9vcChoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSk7XG4gIH0gZmluYWxseSB7XG4gICAgY3VycmVudFRhc2sgPSBudWxsO1xuICAgIGlzUGVyZm9ybWluZ1dvcmsgPSBmYWxzZTtcbiAgfVxufVxuZnVuY3Rpb24gd29ya0xvb3AoaGFzVGltZVJlbWFpbmluZywgaW5pdGlhbFRpbWUpIHtcbiAgbGV0IGN1cnJlbnRUaW1lID0gaW5pdGlhbFRpbWU7XG4gIGN1cnJlbnRUYXNrID0gdGFza1F1ZXVlWzBdIHx8IG51bGw7XG4gIHdoaWxlIChjdXJyZW50VGFzayAhPT0gbnVsbCkge1xuICAgIGlmIChjdXJyZW50VGFzay5leHBpcmF0aW9uVGltZSA+IGN1cnJlbnRUaW1lICYmICghaGFzVGltZVJlbWFpbmluZyB8fCBzaG91bGRZaWVsZFRvSG9zdCgpKSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNvbnN0IGNhbGxiYWNrID0gY3VycmVudFRhc2suZm47XG4gICAgaWYgKGNhbGxiYWNrICE9PSBudWxsKSB7XG4gICAgICBjdXJyZW50VGFzay5mbiA9IG51bGw7XG4gICAgICBjb25zdCBkaWRVc2VyQ2FsbGJhY2tUaW1lb3V0ID0gY3VycmVudFRhc2suZXhwaXJhdGlvblRpbWUgPD0gY3VycmVudFRpbWU7XG4gICAgICBjYWxsYmFjayhkaWRVc2VyQ2FsbGJhY2tUaW1lb3V0KTtcbiAgICAgIGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBpZiAoY3VycmVudFRhc2sgPT09IHRhc2tRdWV1ZVswXSkge1xuICAgICAgICB0YXNrUXVldWUuc2hpZnQoKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgdGFza1F1ZXVlLnNoaWZ0KCk7XG4gICAgY3VycmVudFRhc2sgPSB0YXNrUXVldWVbMF0gfHwgbnVsbDtcbiAgfVxuICByZXR1cm4gY3VycmVudFRhc2sgIT09IG51bGw7XG59XG5cbmNvbnN0IHNoYXJlZENvbmZpZyA9IHtcbiAgY29udGV4dDogdW5kZWZpbmVkLFxuICByZWdpc3RyeTogdW5kZWZpbmVkLFxuICBlZmZlY3RzOiB1bmRlZmluZWQsXG4gIGRvbmU6IGZhbHNlLFxuICBnZXRDb250ZXh0SWQoKSB7XG4gICAgcmV0dXJuIGdldENvbnRleHRJZCh0aGlzLmNvbnRleHQuY291bnQpO1xuICB9LFxuICBnZXROZXh0Q29udGV4dElkKCkge1xuICAgIHJldHVybiBnZXRDb250ZXh0SWQodGhpcy5jb250ZXh0LmNvdW50KyspO1xuICB9XG59O1xuZnVuY3Rpb24gZ2V0Q29udGV4dElkKGNvdW50KSB7XG4gIGNvbnN0IG51bSA9IFN0cmluZyhjb3VudCksXG4gICAgbGVuID0gbnVtLmxlbmd0aCAtIDE7XG4gIHJldHVybiBzaGFyZWRDb25maWcuY29udGV4dC5pZCArIChsZW4gPyBTdHJpbmcuZnJvbUNoYXJDb2RlKDk2ICsgbGVuKSA6IFwiXCIpICsgbnVtO1xufVxuZnVuY3Rpb24gc2V0SHlkcmF0ZUNvbnRleHQoY29udGV4dCkge1xuICBzaGFyZWRDb25maWcuY29udGV4dCA9IGNvbnRleHQ7XG59XG5mdW5jdGlvbiBuZXh0SHlkcmF0ZUNvbnRleHQoKSB7XG4gIHJldHVybiB7XG4gICAgLi4uc2hhcmVkQ29uZmlnLmNvbnRleHQsXG4gICAgaWQ6IHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCksXG4gICAgY291bnQ6IDBcbiAgfTtcbn1cblxuY29uc3QgSVNfREVWID0gdHJ1ZTtcbmNvbnN0IGVxdWFsRm4gPSAoYSwgYikgPT4gYSA9PT0gYjtcbmNvbnN0ICRQUk9YWSA9IFN5bWJvbChcInNvbGlkLXByb3h5XCIpO1xuY29uc3QgU1VQUE9SVFNfUFJPWFkgPSB0eXBlb2YgUHJveHkgPT09IFwiZnVuY3Rpb25cIjtcbmNvbnN0ICRUUkFDSyA9IFN5bWJvbChcInNvbGlkLXRyYWNrXCIpO1xuY29uc3QgJERFVkNPTVAgPSBTeW1ib2woXCJzb2xpZC1kZXYtY29tcG9uZW50XCIpO1xuY29uc3Qgc2lnbmFsT3B0aW9ucyA9IHtcbiAgZXF1YWxzOiBlcXVhbEZuXG59O1xubGV0IEVSUk9SID0gbnVsbDtcbmxldCBydW5FZmZlY3RzID0gcnVuUXVldWU7XG5jb25zdCBTVEFMRSA9IDE7XG5jb25zdCBQRU5ESU5HID0gMjtcbmNvbnN0IFVOT1dORUQgPSB7XG4gIG93bmVkOiBudWxsLFxuICBjbGVhbnVwczogbnVsbCxcbiAgY29udGV4dDogbnVsbCxcbiAgb3duZXI6IG51bGxcbn07XG5jb25zdCBOT19JTklUID0ge307XG52YXIgT3duZXIgPSBudWxsO1xubGV0IFRyYW5zaXRpb24gPSBudWxsO1xubGV0IFNjaGVkdWxlciA9IG51bGw7XG5sZXQgRXh0ZXJuYWxTb3VyY2VDb25maWcgPSBudWxsO1xubGV0IExpc3RlbmVyID0gbnVsbDtcbmxldCBVcGRhdGVzID0gbnVsbDtcbmxldCBFZmZlY3RzID0gbnVsbDtcbmxldCBFeGVjQ291bnQgPSAwO1xuY29uc3QgRGV2SG9va3MgPSB7XG4gIGFmdGVyVXBkYXRlOiBudWxsLFxuICBhZnRlckNyZWF0ZU93bmVyOiBudWxsLFxuICBhZnRlckNyZWF0ZVNpZ25hbDogbnVsbCxcbiAgYWZ0ZXJSZWdpc3RlckdyYXBoOiBudWxsXG59O1xuZnVuY3Rpb24gY3JlYXRlUm9vdChmbiwgZGV0YWNoZWRPd25lcikge1xuICBjb25zdCBsaXN0ZW5lciA9IExpc3RlbmVyLFxuICAgIG93bmVyID0gT3duZXIsXG4gICAgdW5vd25lZCA9IGZuLmxlbmd0aCA9PT0gMCxcbiAgICBjdXJyZW50ID0gZGV0YWNoZWRPd25lciA9PT0gdW5kZWZpbmVkID8gb3duZXIgOiBkZXRhY2hlZE93bmVyLFxuICAgIHJvb3QgPSB1bm93bmVkID8ge1xuICAgICAgb3duZWQ6IG51bGwsXG4gICAgICBjbGVhbnVwczogbnVsbCxcbiAgICAgIGNvbnRleHQ6IG51bGwsXG4gICAgICBvd25lcjogbnVsbFxuICAgIH0gIDoge1xuICAgICAgb3duZWQ6IG51bGwsXG4gICAgICBjbGVhbnVwczogbnVsbCxcbiAgICAgIGNvbnRleHQ6IGN1cnJlbnQgPyBjdXJyZW50LmNvbnRleHQgOiBudWxsLFxuICAgICAgb3duZXI6IGN1cnJlbnRcbiAgICB9LFxuICAgIHVwZGF0ZUZuID0gdW5vd25lZCA/ICgpID0+IGZuKCgpID0+IHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkRpc3Bvc2UgbWV0aG9kIG11c3QgYmUgYW4gZXhwbGljaXQgYXJndW1lbnQgdG8gY3JlYXRlUm9vdCBmdW5jdGlvblwiKTtcbiAgICB9KSAgOiAoKSA9PiBmbigoKSA9PiB1bnRyYWNrKCgpID0+IGNsZWFuTm9kZShyb290KSkpO1xuICBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyICYmIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIocm9vdCk7XG4gIE93bmVyID0gcm9vdDtcbiAgTGlzdGVuZXIgPSBudWxsO1xuICB0cnkge1xuICAgIHJldHVybiBydW5VcGRhdGVzKHVwZGF0ZUZuLCB0cnVlKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICAgIE93bmVyID0gb3duZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIGNyZWF0ZVNpZ25hbCh2YWx1ZSwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyA/IE9iamVjdC5hc3NpZ24oe30sIHNpZ25hbE9wdGlvbnMsIG9wdGlvbnMpIDogc2lnbmFsT3B0aW9ucztcbiAgY29uc3QgcyA9IHtcbiAgICB2YWx1ZSxcbiAgICBvYnNlcnZlcnM6IG51bGwsXG4gICAgb2JzZXJ2ZXJTbG90czogbnVsbCxcbiAgICBjb21wYXJhdG9yOiBvcHRpb25zLmVxdWFscyB8fCB1bmRlZmluZWRcbiAgfTtcbiAge1xuICAgIGlmIChvcHRpb25zLm5hbWUpIHMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICBpZiAob3B0aW9ucy5pbnRlcm5hbCkge1xuICAgICAgcy5pbnRlcm5hbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZ2lzdGVyR3JhcGgocyk7XG4gICAgICBpZiAoRGV2SG9va3MuYWZ0ZXJDcmVhdGVTaWduYWwpIERldkhvb2tzLmFmdGVyQ3JlYXRlU2lnbmFsKHMpO1xuICAgIH1cbiAgfVxuICBjb25zdCBzZXR0ZXIgPSB2YWx1ZSA9PiB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhzKSkgdmFsdWUgPSB2YWx1ZShzLnRWYWx1ZSk7ZWxzZSB2YWx1ZSA9IHZhbHVlKHMudmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gd3JpdGVTaWduYWwocywgdmFsdWUpO1xuICB9O1xuICByZXR1cm4gW3JlYWRTaWduYWwuYmluZChzKSwgc2V0dGVyXTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbXB1dGVkKGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCB0cnVlLCBTVEFMRSwgb3B0aW9ucyApO1xuICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBVcGRhdGVzLnB1c2goYyk7ZWxzZSB1cGRhdGVDb21wdXRhdGlvbihjKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlbmRlckVmZmVjdChmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgZmFsc2UsIFNUQUxFLCBvcHRpb25zICk7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIFVwZGF0ZXMucHVzaChjKTtlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlRWZmZWN0KGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBydW5FZmZlY3RzID0gcnVuVXNlckVmZmVjdHM7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIGZhbHNlLCBTVEFMRSwgb3B0aW9ucyApLFxuICAgIHMgPSBTdXNwZW5zZUNvbnRleHQgJiYgdXNlQ29udGV4dChTdXNwZW5zZUNvbnRleHQpO1xuICBpZiAocykgYy5zdXNwZW5zZSA9IHM7XG4gIGlmICghb3B0aW9ucyB8fCAhb3B0aW9ucy5yZW5kZXIpIGMudXNlciA9IHRydWU7XG4gIEVmZmVjdHMgPyBFZmZlY3RzLnB1c2goYykgOiB1cGRhdGVDb21wdXRhdGlvbihjKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlYWN0aW9uKG9uSW52YWxpZGF0ZSwgb3B0aW9ucykge1xuICBsZXQgZm47XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB7XG4gICAgICBmbiA/IGZuKCkgOiB1bnRyYWNrKG9uSW52YWxpZGF0ZSk7XG4gICAgICBmbiA9IHVuZGVmaW5lZDtcbiAgICB9LCB1bmRlZmluZWQsIGZhbHNlLCAwLCBvcHRpb25zICksXG4gICAgcyA9IFN1c3BlbnNlQ29udGV4dCAmJiB1c2VDb250ZXh0KFN1c3BlbnNlQ29udGV4dCk7XG4gIGlmIChzKSBjLnN1c3BlbnNlID0gcztcbiAgYy51c2VyID0gdHJ1ZTtcbiAgcmV0dXJuIHRyYWNraW5nID0+IHtcbiAgICBmbiA9IHRyYWNraW5nO1xuICAgIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICB9O1xufVxuZnVuY3Rpb24gY3JlYXRlTWVtbyhmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgPyBPYmplY3QuYXNzaWduKHt9LCBzaWduYWxPcHRpb25zLCBvcHRpb25zKSA6IHNpZ25hbE9wdGlvbnM7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIHRydWUsIDAsIG9wdGlvbnMgKTtcbiAgYy5vYnNlcnZlcnMgPSBudWxsO1xuICBjLm9ic2VydmVyU2xvdHMgPSBudWxsO1xuICBjLmNvbXBhcmF0b3IgPSBvcHRpb25zLmVxdWFscyB8fCB1bmRlZmluZWQ7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICBjLnRTdGF0ZSA9IFNUQUxFO1xuICAgIFVwZGF0ZXMucHVzaChjKTtcbiAgfSBlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICByZXR1cm4gcmVhZFNpZ25hbC5iaW5kKGMpO1xufVxuZnVuY3Rpb24gaXNQcm9taXNlKHYpIHtcbiAgcmV0dXJuIHYgJiYgdHlwZW9mIHYgPT09IFwib2JqZWN0XCIgJiYgXCJ0aGVuXCIgaW4gdjtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlc291cmNlKHBTb3VyY2UsIHBGZXRjaGVyLCBwT3B0aW9ucykge1xuICBsZXQgc291cmNlO1xuICBsZXQgZmV0Y2hlcjtcbiAgbGV0IG9wdGlvbnM7XG4gIGlmICh0eXBlb2YgcEZldGNoZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIHNvdXJjZSA9IHBTb3VyY2U7XG4gICAgZmV0Y2hlciA9IHBGZXRjaGVyO1xuICAgIG9wdGlvbnMgPSBwT3B0aW9ucyB8fCB7fTtcbiAgfSBlbHNlIHtcbiAgICBzb3VyY2UgPSB0cnVlO1xuICAgIGZldGNoZXIgPSBwU291cmNlO1xuICAgIG9wdGlvbnMgPSBwRmV0Y2hlciB8fCB7fTtcbiAgfVxuICBsZXQgcHIgPSBudWxsLFxuICAgIGluaXRQID0gTk9fSU5JVCxcbiAgICBpZCA9IG51bGwsXG4gICAgbG9hZGVkVW5kZXJUcmFuc2l0aW9uID0gZmFsc2UsXG4gICAgc2NoZWR1bGVkID0gZmFsc2UsXG4gICAgcmVzb2x2ZWQgPSBcImluaXRpYWxWYWx1ZVwiIGluIG9wdGlvbnMsXG4gICAgZHluYW1pYyA9IHR5cGVvZiBzb3VyY2UgPT09IFwiZnVuY3Rpb25cIiAmJiBjcmVhdGVNZW1vKHNvdXJjZSk7XG4gIGNvbnN0IGNvbnRleHRzID0gbmV3IFNldCgpLFxuICAgIFt2YWx1ZSwgc2V0VmFsdWVdID0gKG9wdGlvbnMuc3RvcmFnZSB8fCBjcmVhdGVTaWduYWwpKG9wdGlvbnMuaW5pdGlhbFZhbHVlKSxcbiAgICBbZXJyb3IsIHNldEVycm9yXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQpLFxuICAgIFt0cmFjaywgdHJpZ2dlcl0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICBlcXVhbHM6IGZhbHNlXG4gICAgfSksXG4gICAgW3N0YXRlLCBzZXRTdGF0ZV0gPSBjcmVhdGVTaWduYWwocmVzb2x2ZWQgPyBcInJlYWR5XCIgOiBcInVucmVzb2x2ZWRcIik7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCkge1xuICAgIGlkID0gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKTtcbiAgICBpZiAob3B0aW9ucy5zc3JMb2FkRnJvbSA9PT0gXCJpbml0aWFsXCIpIGluaXRQID0gb3B0aW9ucy5pbml0aWFsVmFsdWU7ZWxzZSBpZiAoc2hhcmVkQ29uZmlnLmxvYWQgJiYgc2hhcmVkQ29uZmlnLmhhcyhpZCkpIGluaXRQID0gc2hhcmVkQ29uZmlnLmxvYWQoaWQpO1xuICB9XG4gIGZ1bmN0aW9uIGxvYWRFbmQocCwgdiwgZXJyb3IsIGtleSkge1xuICAgIGlmIChwciA9PT0gcCkge1xuICAgICAgcHIgPSBudWxsO1xuICAgICAga2V5ICE9PSB1bmRlZmluZWQgJiYgKHJlc29sdmVkID0gdHJ1ZSk7XG4gICAgICBpZiAoKHAgPT09IGluaXRQIHx8IHYgPT09IGluaXRQKSAmJiBvcHRpb25zLm9uSHlkcmF0ZWQpIHF1ZXVlTWljcm90YXNrKCgpID0+IG9wdGlvbnMub25IeWRyYXRlZChrZXksIHtcbiAgICAgICAgdmFsdWU6IHZcbiAgICAgIH0pKTtcbiAgICAgIGluaXRQID0gTk9fSU5JVDtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIHAgJiYgbG9hZGVkVW5kZXJUcmFuc2l0aW9uKSB7XG4gICAgICAgIFRyYW5zaXRpb24ucHJvbWlzZXMuZGVsZXRlKHApO1xuICAgICAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBmYWxzZTtcbiAgICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICBjb21wbGV0ZUxvYWQodiwgZXJyb3IpO1xuICAgICAgICB9LCBmYWxzZSk7XG4gICAgICB9IGVsc2UgY29tcGxldGVMb2FkKHYsIGVycm9yKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cbiAgZnVuY3Rpb24gY29tcGxldGVMb2FkKHYsIGVycikge1xuICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgaWYgKGVyciA9PT0gdW5kZWZpbmVkKSBzZXRWYWx1ZSgoKSA9PiB2KTtcbiAgICAgIHNldFN0YXRlKGVyciAhPT0gdW5kZWZpbmVkID8gXCJlcnJvcmVkXCIgOiByZXNvbHZlZCA/IFwicmVhZHlcIiA6IFwidW5yZXNvbHZlZFwiKTtcbiAgICAgIHNldEVycm9yKGVycik7XG4gICAgICBmb3IgKGNvbnN0IGMgb2YgY29udGV4dHMua2V5cygpKSBjLmRlY3JlbWVudCgpO1xuICAgICAgY29udGV4dHMuY2xlYXIoKTtcbiAgICB9LCBmYWxzZSk7XG4gIH1cbiAgZnVuY3Rpb24gcmVhZCgpIHtcbiAgICBjb25zdCBjID0gU3VzcGVuc2VDb250ZXh0ICYmIHVzZUNvbnRleHQoU3VzcGVuc2VDb250ZXh0KSxcbiAgICAgIHYgPSB2YWx1ZSgpLFxuICAgICAgZXJyID0gZXJyb3IoKTtcbiAgICBpZiAoZXJyICE9PSB1bmRlZmluZWQgJiYgIXByKSB0aHJvdyBlcnI7XG4gICAgaWYgKExpc3RlbmVyICYmICFMaXN0ZW5lci51c2VyICYmIGMpIHtcbiAgICAgIGNyZWF0ZUNvbXB1dGVkKCgpID0+IHtcbiAgICAgICAgdHJhY2soKTtcbiAgICAgICAgaWYgKHByKSB7XG4gICAgICAgICAgaWYgKGMucmVzb2x2ZWQgJiYgVHJhbnNpdGlvbiAmJiBsb2FkZWRVbmRlclRyYW5zaXRpb24pIFRyYW5zaXRpb24ucHJvbWlzZXMuYWRkKHByKTtlbHNlIGlmICghY29udGV4dHMuaGFzKGMpKSB7XG4gICAgICAgICAgICBjLmluY3JlbWVudCgpO1xuICAgICAgICAgICAgY29udGV4dHMuYWRkKGMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG4gIGZ1bmN0aW9uIGxvYWQocmVmZXRjaGluZyA9IHRydWUpIHtcbiAgICBpZiAocmVmZXRjaGluZyAhPT0gZmFsc2UgJiYgc2NoZWR1bGVkKSByZXR1cm47XG4gICAgc2NoZWR1bGVkID0gZmFsc2U7XG4gICAgY29uc3QgbG9va3VwID0gZHluYW1pYyA/IGR5bmFtaWMoKSA6IHNvdXJjZTtcbiAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgICBpZiAobG9va3VwID09IG51bGwgfHwgbG9va3VwID09PSBmYWxzZSkge1xuICAgICAgbG9hZEVuZChwciwgdW50cmFjayh2YWx1ZSkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoVHJhbnNpdGlvbiAmJiBwcikgVHJhbnNpdGlvbi5wcm9taXNlcy5kZWxldGUocHIpO1xuICAgIGxldCBlcnJvcjtcbiAgICBjb25zdCBwID0gaW5pdFAgIT09IE5PX0lOSVQgPyBpbml0UCA6IHVudHJhY2soKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIGZldGNoZXIobG9va3VwLCB7XG4gICAgICAgICAgdmFsdWU6IHZhbHVlKCksXG4gICAgICAgICAgcmVmZXRjaGluZ1xuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2ggKGZldGNoZXJFcnJvcikge1xuICAgICAgICBlcnJvciA9IGZldGNoZXJFcnJvcjtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoZXJyb3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbG9hZEVuZChwciwgdW5kZWZpbmVkLCBjYXN0RXJyb3IoZXJyb3IpLCBsb29rdXApO1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoIWlzUHJvbWlzZShwKSkge1xuICAgICAgbG9hZEVuZChwciwgcCwgdW5kZWZpbmVkLCBsb29rdXApO1xuICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIHByID0gcDtcbiAgICBpZiAoXCJ2XCIgaW4gcCkge1xuICAgICAgaWYgKHAucyA9PT0gMSkgbG9hZEVuZChwciwgcC52LCB1bmRlZmluZWQsIGxvb2t1cCk7ZWxzZSBsb2FkRW5kKHByLCB1bmRlZmluZWQsIGNhc3RFcnJvcihwLnYpLCBsb29rdXApO1xuICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIHNjaGVkdWxlZCA9IHRydWU7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4gc2NoZWR1bGVkID0gZmFsc2UpO1xuICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgc2V0U3RhdGUocmVzb2x2ZWQgPyBcInJlZnJlc2hpbmdcIiA6IFwicGVuZGluZ1wiKTtcbiAgICAgIHRyaWdnZXIoKTtcbiAgICB9LCBmYWxzZSk7XG4gICAgcmV0dXJuIHAudGhlbih2ID0+IGxvYWRFbmQocCwgdiwgdW5kZWZpbmVkLCBsb29rdXApLCBlID0+IGxvYWRFbmQocCwgdW5kZWZpbmVkLCBjYXN0RXJyb3IoZSksIGxvb2t1cCkpO1xuICB9XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHJlYWQsIHtcbiAgICBzdGF0ZToge1xuICAgICAgZ2V0OiAoKSA9PiBzdGF0ZSgpXG4gICAgfSxcbiAgICBlcnJvcjoge1xuICAgICAgZ2V0OiAoKSA9PiBlcnJvcigpXG4gICAgfSxcbiAgICBsb2FkaW5nOiB7XG4gICAgICBnZXQoKSB7XG4gICAgICAgIGNvbnN0IHMgPSBzdGF0ZSgpO1xuICAgICAgICByZXR1cm4gcyA9PT0gXCJwZW5kaW5nXCIgfHwgcyA9PT0gXCJyZWZyZXNoaW5nXCI7XG4gICAgICB9XG4gICAgfSxcbiAgICBsYXRlc3Q6IHtcbiAgICAgIGdldCgpIHtcbiAgICAgICAgaWYgKCFyZXNvbHZlZCkgcmV0dXJuIHJlYWQoKTtcbiAgICAgICAgY29uc3QgZXJyID0gZXJyb3IoKTtcbiAgICAgICAgaWYgKGVyciAmJiAhcHIpIHRocm93IGVycjtcbiAgICAgICAgcmV0dXJuIHZhbHVlKCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbiAgbGV0IG93bmVyID0gT3duZXI7XG4gIGlmIChkeW5hbWljKSBjcmVhdGVDb21wdXRlZCgoKSA9PiAob3duZXIgPSBPd25lciwgbG9hZChmYWxzZSkpKTtlbHNlIGxvYWQoZmFsc2UpO1xuICByZXR1cm4gW3JlYWQsIHtcbiAgICByZWZldGNoOiBpbmZvID0+IHJ1bldpdGhPd25lcihvd25lciwgKCkgPT4gbG9hZChpbmZvKSksXG4gICAgbXV0YXRlOiBzZXRWYWx1ZVxuICB9XTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZURlZmVycmVkKHNvdXJjZSwgb3B0aW9ucykge1xuICBsZXQgdCxcbiAgICB0aW1lb3V0ID0gb3B0aW9ucyA/IG9wdGlvbnMudGltZW91dE1zIDogdW5kZWZpbmVkO1xuICBjb25zdCBub2RlID0gY3JlYXRlQ29tcHV0YXRpb24oKCkgPT4ge1xuICAgIGlmICghdCB8fCAhdC5mbikgdCA9IHJlcXVlc3RDYWxsYmFjaygoKSA9PiBzZXREZWZlcnJlZCgoKSA9PiBub2RlLnZhbHVlKSwgdGltZW91dCAhPT0gdW5kZWZpbmVkID8ge1xuICAgICAgdGltZW91dFxuICAgIH0gOiB1bmRlZmluZWQpO1xuICAgIHJldHVybiBzb3VyY2UoKTtcbiAgfSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgY29uc3QgW2RlZmVycmVkLCBzZXREZWZlcnJlZF0gPSBjcmVhdGVTaWduYWwoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSwgb3B0aW9ucyk7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICBzZXREZWZlcnJlZCgoKSA9PiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlKTtcbiAgcmV0dXJuIGRlZmVycmVkO1xufVxuZnVuY3Rpb24gY3JlYXRlU2VsZWN0b3Ioc291cmNlLCBmbiA9IGVxdWFsRm4sIG9wdGlvbnMpIHtcbiAgY29uc3Qgc3VicyA9IG5ldyBNYXAoKTtcbiAgY29uc3Qgbm9kZSA9IGNyZWF0ZUNvbXB1dGF0aW9uKHAgPT4ge1xuICAgIGNvbnN0IHYgPSBzb3VyY2UoKTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2Ygc3Vicy5lbnRyaWVzKCkpIGlmIChmbihrZXksIHYpICE9PSBmbihrZXksIHApKSB7XG4gICAgICBmb3IgKGNvbnN0IGMgb2YgdmFsLnZhbHVlcygpKSB7XG4gICAgICAgIGMuc3RhdGUgPSBTVEFMRTtcbiAgICAgICAgaWYgKGMucHVyZSkgVXBkYXRlcy5wdXNoKGMpO2Vsc2UgRWZmZWN0cy5wdXNoKGMpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfSwgdW5kZWZpbmVkLCB0cnVlLCBTVEFMRSwgb3B0aW9ucyApO1xuICB1cGRhdGVDb21wdXRhdGlvbihub2RlKTtcbiAgcmV0dXJuIGtleSA9PiB7XG4gICAgY29uc3QgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgICBpZiAobGlzdGVuZXIpIHtcbiAgICAgIGxldCBsO1xuICAgICAgaWYgKGwgPSBzdWJzLmdldChrZXkpKSBsLmFkZChsaXN0ZW5lcik7ZWxzZSBzdWJzLnNldChrZXksIGwgPSBuZXcgU2V0KFtsaXN0ZW5lcl0pKTtcbiAgICAgIG9uQ2xlYW51cCgoKSA9PiB7XG4gICAgICAgIGwuZGVsZXRlKGxpc3RlbmVyKTtcbiAgICAgICAgIWwuc2l6ZSAmJiBzdWJzLmRlbGV0ZShrZXkpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBmbihrZXksIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUpO1xuICB9O1xufVxuZnVuY3Rpb24gYmF0Y2goZm4pIHtcbiAgcmV0dXJuIHJ1blVwZGF0ZXMoZm4sIGZhbHNlKTtcbn1cbmZ1bmN0aW9uIHVudHJhY2soZm4pIHtcbiAgaWYgKCFFeHRlcm5hbFNvdXJjZUNvbmZpZyAmJiBMaXN0ZW5lciA9PT0gbnVsbCkgcmV0dXJuIGZuKCk7XG4gIGNvbnN0IGxpc3RlbmVyID0gTGlzdGVuZXI7XG4gIExpc3RlbmVyID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcpIHJldHVybiBFeHRlcm5hbFNvdXJjZUNvbmZpZy51bnRyYWNrKGZuKTtcbiAgICByZXR1cm4gZm4oKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICB9XG59XG5mdW5jdGlvbiBvbihkZXBzLCBmbiwgb3B0aW9ucykge1xuICBjb25zdCBpc0FycmF5ID0gQXJyYXkuaXNBcnJheShkZXBzKTtcbiAgbGV0IHByZXZJbnB1dDtcbiAgbGV0IGRlZmVyID0gb3B0aW9ucyAmJiBvcHRpb25zLmRlZmVyO1xuICByZXR1cm4gcHJldlZhbHVlID0+IHtcbiAgICBsZXQgaW5wdXQ7XG4gICAgaWYgKGlzQXJyYXkpIHtcbiAgICAgIGlucHV0ID0gQXJyYXkoZGVwcy5sZW5ndGgpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZXBzLmxlbmd0aDsgaSsrKSBpbnB1dFtpXSA9IGRlcHNbaV0oKTtcbiAgICB9IGVsc2UgaW5wdXQgPSBkZXBzKCk7XG4gICAgaWYgKGRlZmVyKSB7XG4gICAgICBkZWZlciA9IGZhbHNlO1xuICAgICAgcmV0dXJuIHByZXZWYWx1ZTtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gdW50cmFjaygoKSA9PiBmbihpbnB1dCwgcHJldklucHV0LCBwcmV2VmFsdWUpKTtcbiAgICBwcmV2SW5wdXQgPSBpbnB1dDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xufVxuZnVuY3Rpb24gb25Nb3VudChmbikge1xuICBjcmVhdGVFZmZlY3QoKCkgPT4gdW50cmFjayhmbikpO1xufVxuZnVuY3Rpb24gb25DbGVhbnVwKGZuKSB7XG4gIGlmIChPd25lciA9PT0gbnVsbCkgY29uc29sZS53YXJuKFwiY2xlYW51cHMgY3JlYXRlZCBvdXRzaWRlIGEgYGNyZWF0ZVJvb3RgIG9yIGByZW5kZXJgIHdpbGwgbmV2ZXIgYmUgcnVuXCIpO2Vsc2UgaWYgKE93bmVyLmNsZWFudXBzID09PSBudWxsKSBPd25lci5jbGVhbnVwcyA9IFtmbl07ZWxzZSBPd25lci5jbGVhbnVwcy5wdXNoKGZuKTtcbiAgcmV0dXJuIGZuO1xufVxuZnVuY3Rpb24gY2F0Y2hFcnJvcihmbiwgaGFuZGxlcikge1xuICBFUlJPUiB8fCAoRVJST1IgPSBTeW1ib2woXCJlcnJvclwiKSk7XG4gIE93bmVyID0gY3JlYXRlQ29tcHV0YXRpb24odW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuICBPd25lci5jb250ZXh0ID0ge1xuICAgIC4uLk93bmVyLmNvbnRleHQsXG4gICAgW0VSUk9SXTogW2hhbmRsZXJdXG4gIH07XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgVHJhbnNpdGlvbi5zb3VyY2VzLmFkZChPd25lcik7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGZuKCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGhhbmRsZUVycm9yKGVycik7XG4gIH0gZmluYWxseSB7XG4gICAgT3duZXIgPSBPd25lci5vd25lcjtcbiAgfVxufVxuZnVuY3Rpb24gZ2V0TGlzdGVuZXIoKSB7XG4gIHJldHVybiBMaXN0ZW5lcjtcbn1cbmZ1bmN0aW9uIGdldE93bmVyKCkge1xuICByZXR1cm4gT3duZXI7XG59XG5mdW5jdGlvbiBydW5XaXRoT3duZXIobywgZm4pIHtcbiAgY29uc3QgcHJldiA9IE93bmVyO1xuICBjb25zdCBwcmV2TGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgT3duZXIgPSBvO1xuICBMaXN0ZW5lciA9IG51bGw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJ1blVwZGF0ZXMoZm4sIHRydWUpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBoYW5kbGVFcnJvcihlcnIpO1xuICB9IGZpbmFsbHkge1xuICAgIE93bmVyID0gcHJldjtcbiAgICBMaXN0ZW5lciA9IHByZXZMaXN0ZW5lcjtcbiAgfVxufVxuZnVuY3Rpb24gZW5hYmxlU2NoZWR1bGluZyhzY2hlZHVsZXIgPSByZXF1ZXN0Q2FsbGJhY2spIHtcbiAgU2NoZWR1bGVyID0gc2NoZWR1bGVyO1xufVxuZnVuY3Rpb24gc3RhcnRUcmFuc2l0aW9uKGZuKSB7XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGZuKCk7XG4gICAgcmV0dXJuIFRyYW5zaXRpb24uZG9uZTtcbiAgfVxuICBjb25zdCBsID0gTGlzdGVuZXI7XG4gIGNvbnN0IG8gPSBPd25lcjtcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oKCkgPT4ge1xuICAgIExpc3RlbmVyID0gbDtcbiAgICBPd25lciA9IG87XG4gICAgbGV0IHQ7XG4gICAgaWYgKFNjaGVkdWxlciB8fCBTdXNwZW5zZUNvbnRleHQpIHtcbiAgICAgIHQgPSBUcmFuc2l0aW9uIHx8IChUcmFuc2l0aW9uID0ge1xuICAgICAgICBzb3VyY2VzOiBuZXcgU2V0KCksXG4gICAgICAgIGVmZmVjdHM6IFtdLFxuICAgICAgICBwcm9taXNlczogbmV3IFNldCgpLFxuICAgICAgICBkaXNwb3NlZDogbmV3IFNldCgpLFxuICAgICAgICBxdWV1ZTogbmV3IFNldCgpLFxuICAgICAgICBydW5uaW5nOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIHQuZG9uZSB8fCAodC5kb25lID0gbmV3IFByb21pc2UocmVzID0+IHQucmVzb2x2ZSA9IHJlcykpO1xuICAgICAgdC5ydW5uaW5nID0gdHJ1ZTtcbiAgICB9XG4gICAgcnVuVXBkYXRlcyhmbiwgZmFsc2UpO1xuICAgIExpc3RlbmVyID0gT3duZXIgPSBudWxsO1xuICAgIHJldHVybiB0ID8gdC5kb25lIDogdW5kZWZpbmVkO1xuICB9KTtcbn1cbmNvbnN0IFt0cmFuc1BlbmRpbmcsIHNldFRyYW5zUGVuZGluZ10gPSAvKkBfX1BVUkVfXyovY3JlYXRlU2lnbmFsKGZhbHNlKTtcbmZ1bmN0aW9uIHVzZVRyYW5zaXRpb24oKSB7XG4gIHJldHVybiBbdHJhbnNQZW5kaW5nLCBzdGFydFRyYW5zaXRpb25dO1xufVxuZnVuY3Rpb24gcmVzdW1lRWZmZWN0cyhlKSB7XG4gIEVmZmVjdHMucHVzaC5hcHBseShFZmZlY3RzLCBlKTtcbiAgZS5sZW5ndGggPSAwO1xufVxuZnVuY3Rpb24gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzKSB7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB1bnRyYWNrKCgpID0+IHtcbiAgICBPYmplY3QuYXNzaWduKENvbXAsIHtcbiAgICAgIFskREVWQ09NUF06IHRydWVcbiAgICB9KTtcbiAgICByZXR1cm4gQ29tcChwcm9wcyk7XG4gIH0pLCB1bmRlZmluZWQsIHRydWUsIDApO1xuICBjLnByb3BzID0gcHJvcHM7XG4gIGMub2JzZXJ2ZXJzID0gbnVsbDtcbiAgYy5vYnNlcnZlclNsb3RzID0gbnVsbDtcbiAgYy5uYW1lID0gQ29tcC5uYW1lO1xuICBjLmNvbXBvbmVudCA9IENvbXA7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICByZXR1cm4gYy50VmFsdWUgIT09IHVuZGVmaW5lZCA/IGMudFZhbHVlIDogYy52YWx1ZTtcbn1cbmZ1bmN0aW9uIHJlZ2lzdGVyR3JhcGgodmFsdWUpIHtcbiAgaWYgKE93bmVyKSB7XG4gICAgaWYgKE93bmVyLnNvdXJjZU1hcCkgT3duZXIuc291cmNlTWFwLnB1c2godmFsdWUpO2Vsc2UgT3duZXIuc291cmNlTWFwID0gW3ZhbHVlXTtcbiAgICB2YWx1ZS5ncmFwaCA9IE93bmVyO1xuICB9XG4gIGlmIChEZXZIb29rcy5hZnRlclJlZ2lzdGVyR3JhcGgpIERldkhvb2tzLmFmdGVyUmVnaXN0ZXJHcmFwaCh2YWx1ZSk7XG59XG5mdW5jdGlvbiBjcmVhdGVDb250ZXh0KGRlZmF1bHRWYWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBpZCA9IFN5bWJvbChcImNvbnRleHRcIik7XG4gIHJldHVybiB7XG4gICAgaWQsXG4gICAgUHJvdmlkZXI6IGNyZWF0ZVByb3ZpZGVyKGlkLCBvcHRpb25zKSxcbiAgICBkZWZhdWx0VmFsdWVcbiAgfTtcbn1cbmZ1bmN0aW9uIHVzZUNvbnRleHQoY29udGV4dCkge1xuICBsZXQgdmFsdWU7XG4gIHJldHVybiBPd25lciAmJiBPd25lci5jb250ZXh0ICYmICh2YWx1ZSA9IE93bmVyLmNvbnRleHRbY29udGV4dC5pZF0pICE9PSB1bmRlZmluZWQgPyB2YWx1ZSA6IGNvbnRleHQuZGVmYXVsdFZhbHVlO1xufVxuZnVuY3Rpb24gY2hpbGRyZW4oZm4pIHtcbiAgY29uc3QgY2hpbGRyZW4gPSBjcmVhdGVNZW1vKGZuKTtcbiAgY29uc3QgbWVtbyA9IGNyZWF0ZU1lbW8oKCkgPT4gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKCkpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImNoaWxkcmVuXCJcbiAgfSkgO1xuICBtZW1vLnRvQXJyYXkgPSAoKSA9PiB7XG4gICAgY29uc3QgYyA9IG1lbW8oKTtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShjKSA/IGMgOiBjICE9IG51bGwgPyBbY10gOiBbXTtcbiAgfTtcbiAgcmV0dXJuIG1lbW87XG59XG5sZXQgU3VzcGVuc2VDb250ZXh0O1xuZnVuY3Rpb24gZ2V0U3VzcGVuc2VDb250ZXh0KCkge1xuICByZXR1cm4gU3VzcGVuc2VDb250ZXh0IHx8IChTdXNwZW5zZUNvbnRleHQgPSBjcmVhdGVDb250ZXh0KCkpO1xufVxuZnVuY3Rpb24gZW5hYmxlRXh0ZXJuYWxTb3VyY2UoZmFjdG9yeSwgdW50cmFjayA9IGZuID0+IGZuKCkpIHtcbiAgaWYgKEV4dGVybmFsU291cmNlQ29uZmlnKSB7XG4gICAgY29uc3Qge1xuICAgICAgZmFjdG9yeTogb2xkRmFjdG9yeSxcbiAgICAgIHVudHJhY2s6IG9sZFVudHJhY2tcbiAgICB9ID0gRXh0ZXJuYWxTb3VyY2VDb25maWc7XG4gICAgRXh0ZXJuYWxTb3VyY2VDb25maWcgPSB7XG4gICAgICBmYWN0b3J5OiAoZm4sIHRyaWdnZXIpID0+IHtcbiAgICAgICAgY29uc3Qgb2xkU291cmNlID0gb2xkRmFjdG9yeShmbiwgdHJpZ2dlcik7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IGZhY3RvcnkoeCA9PiBvbGRTb3VyY2UudHJhY2soeCksIHRyaWdnZXIpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHRyYWNrOiB4ID0+IHNvdXJjZS50cmFjayh4KSxcbiAgICAgICAgICBkaXNwb3NlKCkge1xuICAgICAgICAgICAgc291cmNlLmRpc3Bvc2UoKTtcbiAgICAgICAgICAgIG9sZFNvdXJjZS5kaXNwb3NlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIHVudHJhY2s6IGZuID0+IG9sZFVudHJhY2soKCkgPT4gdW50cmFjayhmbikpXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IHtcbiAgICAgIGZhY3RvcnksXG4gICAgICB1bnRyYWNrXG4gICAgfTtcbiAgfVxufVxuZnVuY3Rpb24gcmVhZFNpZ25hbCgpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgaWYgKHRoaXMuc291cmNlcyAmJiAocnVubmluZ1RyYW5zaXRpb24gPyB0aGlzLnRTdGF0ZSA6IHRoaXMuc3RhdGUpKSB7XG4gICAgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IHRoaXMudFN0YXRlIDogdGhpcy5zdGF0ZSkgPT09IFNUQUxFKSB1cGRhdGVDb21wdXRhdGlvbih0aGlzKTtlbHNlIHtcbiAgICAgIGNvbnN0IHVwZGF0ZXMgPSBVcGRhdGVzO1xuICAgICAgVXBkYXRlcyA9IG51bGw7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IGxvb2tVcHN0cmVhbSh0aGlzKSwgZmFsc2UpO1xuICAgICAgVXBkYXRlcyA9IHVwZGF0ZXM7XG4gICAgfVxuICB9XG4gIGlmIChMaXN0ZW5lcikge1xuICAgIGNvbnN0IHNTbG90ID0gdGhpcy5vYnNlcnZlcnMgPyB0aGlzLm9ic2VydmVycy5sZW5ndGggOiAwO1xuICAgIGlmICghTGlzdGVuZXIuc291cmNlcykge1xuICAgICAgTGlzdGVuZXIuc291cmNlcyA9IFt0aGlzXTtcbiAgICAgIExpc3RlbmVyLnNvdXJjZVNsb3RzID0gW3NTbG90XTtcbiAgICB9IGVsc2Uge1xuICAgICAgTGlzdGVuZXIuc291cmNlcy5wdXNoKHRoaXMpO1xuICAgICAgTGlzdGVuZXIuc291cmNlU2xvdHMucHVzaChzU2xvdCk7XG4gICAgfVxuICAgIGlmICghdGhpcy5vYnNlcnZlcnMpIHtcbiAgICAgIHRoaXMub2JzZXJ2ZXJzID0gW0xpc3RlbmVyXTtcbiAgICAgIHRoaXMub2JzZXJ2ZXJTbG90cyA9IFtMaXN0ZW5lci5zb3VyY2VzLmxlbmd0aCAtIDFdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9ic2VydmVycy5wdXNoKExpc3RlbmVyKTtcbiAgICAgIHRoaXMub2JzZXJ2ZXJTbG90cy5wdXNoKExpc3RlbmVyLnNvdXJjZXMubGVuZ3RoIC0gMSk7XG4gICAgfVxuICB9XG4gIGlmIChydW5uaW5nVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKHRoaXMpKSByZXR1cm4gdGhpcy50VmFsdWU7XG4gIHJldHVybiB0aGlzLnZhbHVlO1xufVxuZnVuY3Rpb24gd3JpdGVTaWduYWwobm9kZSwgdmFsdWUsIGlzQ29tcCkge1xuICBsZXQgY3VycmVudCA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWU7XG4gIGlmICghbm9kZS5jb21wYXJhdG9yIHx8ICFub2RlLmNvbXBhcmF0b3IoY3VycmVudCwgdmFsdWUpKSB7XG4gICAgaWYgKFRyYW5zaXRpb24pIHtcbiAgICAgIGNvbnN0IFRyYW5zaXRpb25SdW5uaW5nID0gVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgICAgaWYgKFRyYW5zaXRpb25SdW5uaW5nIHx8ICFpc0NvbXAgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSkge1xuICAgICAgICBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKG5vZGUpO1xuICAgICAgICBub2RlLnRWYWx1ZSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgaWYgKCFUcmFuc2l0aW9uUnVubmluZykgbm9kZS52YWx1ZSA9IHZhbHVlO1xuICAgIH0gZWxzZSBub2RlLnZhbHVlID0gdmFsdWU7XG4gICAgaWYgKG5vZGUub2JzZXJ2ZXJzICYmIG5vZGUub2JzZXJ2ZXJzLmxlbmd0aCkge1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vYnNlcnZlcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICBjb25zdCBvID0gbm9kZS5vYnNlcnZlcnNbaV07XG4gICAgICAgICAgY29uc3QgVHJhbnNpdGlvblJ1bm5pbmcgPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgICAgICAgICBpZiAoVHJhbnNpdGlvblJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXMobykpIGNvbnRpbnVlO1xuICAgICAgICAgIGlmIChUcmFuc2l0aW9uUnVubmluZyA/ICFvLnRTdGF0ZSA6ICFvLnN0YXRlKSB7XG4gICAgICAgICAgICBpZiAoby5wdXJlKSBVcGRhdGVzLnB1c2gobyk7ZWxzZSBFZmZlY3RzLnB1c2gobyk7XG4gICAgICAgICAgICBpZiAoby5vYnNlcnZlcnMpIG1hcmtEb3duc3RyZWFtKG8pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIVRyYW5zaXRpb25SdW5uaW5nKSBvLnN0YXRlID0gU1RBTEU7ZWxzZSBvLnRTdGF0ZSA9IFNUQUxFO1xuICAgICAgICB9XG4gICAgICAgIGlmIChVcGRhdGVzLmxlbmd0aCA+IDEwZTUpIHtcbiAgICAgICAgICBVcGRhdGVzID0gW107XG4gICAgICAgICAgaWYgKElTX0RFVikgdGhyb3cgbmV3IEVycm9yKFwiUG90ZW50aWFsIEluZmluaXRlIExvb3AgRGV0ZWN0ZWQuXCIpO1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuICAgICAgICB9XG4gICAgICB9LCBmYWxzZSk7XG4gICAgfVxuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpIHtcbiAgaWYgKCFub2RlLmZuKSByZXR1cm47XG4gIGNsZWFuTm9kZShub2RlKTtcbiAgY29uc3QgdGltZSA9IEV4ZWNDb3VudDtcbiAgcnVuQ29tcHV0YXRpb24obm9kZSwgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSwgdGltZSk7XG4gIGlmIChUcmFuc2l0aW9uICYmICFUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSkge1xuICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICBUcmFuc2l0aW9uICYmIChUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlKTtcbiAgICAgICAgTGlzdGVuZXIgPSBPd25lciA9IG5vZGU7XG4gICAgICAgIHJ1bkNvbXB1dGF0aW9uKG5vZGUsIG5vZGUudFZhbHVlLCB0aW1lKTtcbiAgICAgICAgTGlzdGVuZXIgPSBPd25lciA9IG51bGw7XG4gICAgICB9LCBmYWxzZSk7XG4gICAgfSk7XG4gIH1cbn1cbmZ1bmN0aW9uIHJ1bkNvbXB1dGF0aW9uKG5vZGUsIHZhbHVlLCB0aW1lKSB7XG4gIGxldCBuZXh0VmFsdWU7XG4gIGNvbnN0IG93bmVyID0gT3duZXIsXG4gICAgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgTGlzdGVuZXIgPSBPd25lciA9IG5vZGU7XG4gIHRyeSB7XG4gICAgbmV4dFZhbHVlID0gbm9kZS5mbih2YWx1ZSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmIChub2RlLnB1cmUpIHtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgICAgICBub2RlLnRTdGF0ZSA9IFNUQUxFO1xuICAgICAgICBub2RlLnRPd25lZCAmJiBub2RlLnRPd25lZC5mb3JFYWNoKGNsZWFuTm9kZSk7XG4gICAgICAgIG5vZGUudE93bmVkID0gdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9kZS5zdGF0ZSA9IFNUQUxFO1xuICAgICAgICBub2RlLm93bmVkICYmIG5vZGUub3duZWQuZm9yRWFjaChjbGVhbk5vZGUpO1xuICAgICAgICBub2RlLm93bmVkID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgbm9kZS51cGRhdGVkQXQgPSB0aW1lICsgMTtcbiAgICByZXR1cm4gaGFuZGxlRXJyb3IoZXJyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICAgIE93bmVyID0gb3duZXI7XG4gIH1cbiAgaWYgKCFub2RlLnVwZGF0ZWRBdCB8fCBub2RlLnVwZGF0ZWRBdCA8PSB0aW1lKSB7XG4gICAgaWYgKG5vZGUudXBkYXRlZEF0ICE9IG51bGwgJiYgXCJvYnNlcnZlcnNcIiBpbiBub2RlKSB7XG4gICAgICB3cml0ZVNpZ25hbChub2RlLCBuZXh0VmFsdWUsIHRydWUpO1xuICAgIH0gZWxzZSBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgbm9kZS5wdXJlKSB7XG4gICAgICBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKG5vZGUpO1xuICAgICAgbm9kZS50VmFsdWUgPSBuZXh0VmFsdWU7XG4gICAgfSBlbHNlIG5vZGUudmFsdWUgPSBuZXh0VmFsdWU7XG4gICAgbm9kZS51cGRhdGVkQXQgPSB0aW1lO1xuICB9XG59XG5mdW5jdGlvbiBjcmVhdGVDb21wdXRhdGlvbihmbiwgaW5pdCwgcHVyZSwgc3RhdGUgPSBTVEFMRSwgb3B0aW9ucykge1xuICBjb25zdCBjID0ge1xuICAgIGZuLFxuICAgIHN0YXRlOiBzdGF0ZSxcbiAgICB1cGRhdGVkQXQ6IG51bGwsXG4gICAgb3duZWQ6IG51bGwsXG4gICAgc291cmNlczogbnVsbCxcbiAgICBzb3VyY2VTbG90czogbnVsbCxcbiAgICBjbGVhbnVwczogbnVsbCxcbiAgICB2YWx1ZTogaW5pdCxcbiAgICBvd25lcjogT3duZXIsXG4gICAgY29udGV4dDogT3duZXIgPyBPd25lci5jb250ZXh0IDogbnVsbCxcbiAgICBwdXJlXG4gIH07XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGMuc3RhdGUgPSAwO1xuICAgIGMudFN0YXRlID0gc3RhdGU7XG4gIH1cbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJjb21wdXRhdGlvbnMgY3JlYXRlZCBvdXRzaWRlIGEgYGNyZWF0ZVJvb3RgIG9yIGByZW5kZXJgIHdpbGwgbmV2ZXIgYmUgZGlzcG9zZWRcIik7ZWxzZSBpZiAoT3duZXIgIT09IFVOT1dORUQpIHtcbiAgICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgT3duZXIucHVyZSkge1xuICAgICAgaWYgKCFPd25lci50T3duZWQpIE93bmVyLnRPd25lZCA9IFtjXTtlbHNlIE93bmVyLnRPd25lZC5wdXNoKGMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIU93bmVyLm93bmVkKSBPd25lci5vd25lZCA9IFtjXTtlbHNlIE93bmVyLm93bmVkLnB1c2goYyk7XG4gICAgfVxuICB9XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMubmFtZSkgYy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcgJiYgYy5mbikge1xuICAgIGNvbnN0IFt0cmFjaywgdHJpZ2dlcl0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICBlcXVhbHM6IGZhbHNlXG4gICAgfSk7XG4gICAgY29uc3Qgb3JkaW5hcnkgPSBFeHRlcm5hbFNvdXJjZUNvbmZpZy5mYWN0b3J5KGMuZm4sIHRyaWdnZXIpO1xuICAgIG9uQ2xlYW51cCgoKSA9PiBvcmRpbmFyeS5kaXNwb3NlKCkpO1xuICAgIGNvbnN0IHRyaWdnZXJJblRyYW5zaXRpb24gPSAoKSA9PiBzdGFydFRyYW5zaXRpb24odHJpZ2dlcikudGhlbigoKSA9PiBpblRyYW5zaXRpb24uZGlzcG9zZSgpKTtcbiAgICBjb25zdCBpblRyYW5zaXRpb24gPSBFeHRlcm5hbFNvdXJjZUNvbmZpZy5mYWN0b3J5KGMuZm4sIHRyaWdnZXJJblRyYW5zaXRpb24pO1xuICAgIGMuZm4gPSB4ID0+IHtcbiAgICAgIHRyYWNrKCk7XG4gICAgICByZXR1cm4gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgPyBpblRyYW5zaXRpb24udHJhY2soeCkgOiBvcmRpbmFyeS50cmFjayh4KTtcbiAgICB9O1xuICB9XG4gIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIgJiYgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lcihjKTtcbiAgcmV0dXJuIGM7XG59XG5mdW5jdGlvbiBydW5Ub3Aobm9kZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gMCkgcmV0dXJuO1xuICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gUEVORElORykgcmV0dXJuIGxvb2tVcHN0cmVhbShub2RlKTtcbiAgaWYgKG5vZGUuc3VzcGVuc2UgJiYgdW50cmFjayhub2RlLnN1c3BlbnNlLmluRmFsbGJhY2spKSByZXR1cm4gbm9kZS5zdXNwZW5zZS5lZmZlY3RzLnB1c2gobm9kZSk7XG4gIGNvbnN0IGFuY2VzdG9ycyA9IFtub2RlXTtcbiAgd2hpbGUgKChub2RlID0gbm9kZS5vd25lcikgJiYgKCFub2RlLnVwZGF0ZWRBdCB8fCBub2RlLnVwZGF0ZWRBdCA8IEV4ZWNDb3VudCkpIHtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXMobm9kZSkpIHJldHVybjtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpIGFuY2VzdG9ycy5wdXNoKG5vZGUpO1xuICB9XG4gIGZvciAobGV0IGkgPSBhbmNlc3RvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBub2RlID0gYW5jZXN0b3JzW2ldO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbikge1xuICAgICAgbGV0IHRvcCA9IG5vZGUsXG4gICAgICAgIHByZXYgPSBhbmNlc3RvcnNbaSArIDFdO1xuICAgICAgd2hpbGUgKCh0b3AgPSB0b3Aub3duZXIpICYmIHRvcCAhPT0gcHJldikge1xuICAgICAgICBpZiAoVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXModG9wKSkgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gU1RBTEUpIHtcbiAgICAgIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICAgIH0gZWxzZSBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gUEVORElORykge1xuICAgICAgY29uc3QgdXBkYXRlcyA9IFVwZGF0ZXM7XG4gICAgICBVcGRhdGVzID0gbnVsbDtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4gbG9va1Vwc3RyZWFtKG5vZGUsIGFuY2VzdG9yc1swXSksIGZhbHNlKTtcbiAgICAgIFVwZGF0ZXMgPSB1cGRhdGVzO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gcnVuVXBkYXRlcyhmbiwgaW5pdCkge1xuICBpZiAoVXBkYXRlcykgcmV0dXJuIGZuKCk7XG4gIGxldCB3YWl0ID0gZmFsc2U7XG4gIGlmICghaW5pdCkgVXBkYXRlcyA9IFtdO1xuICBpZiAoRWZmZWN0cykgd2FpdCA9IHRydWU7ZWxzZSBFZmZlY3RzID0gW107XG4gIEV4ZWNDb3VudCsrO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGZuKCk7XG4gICAgY29tcGxldGVVcGRhdGVzKHdhaXQpO1xuICAgIHJldHVybiByZXM7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmICghd2FpdCkgRWZmZWN0cyA9IG51bGw7XG4gICAgVXBkYXRlcyA9IG51bGw7XG4gICAgaGFuZGxlRXJyb3IoZXJyKTtcbiAgfVxufVxuZnVuY3Rpb24gY29tcGxldGVVcGRhdGVzKHdhaXQpIHtcbiAgaWYgKFVwZGF0ZXMpIHtcbiAgICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBzY2hlZHVsZVF1ZXVlKFVwZGF0ZXMpO2Vsc2UgcnVuUXVldWUoVXBkYXRlcyk7XG4gICAgVXBkYXRlcyA9IG51bGw7XG4gIH1cbiAgaWYgKHdhaXQpIHJldHVybjtcbiAgbGV0IHJlcztcbiAgaWYgKFRyYW5zaXRpb24pIHtcbiAgICBpZiAoIVRyYW5zaXRpb24ucHJvbWlzZXMuc2l6ZSAmJiAhVHJhbnNpdGlvbi5xdWV1ZS5zaXplKSB7XG4gICAgICBjb25zdCBzb3VyY2VzID0gVHJhbnNpdGlvbi5zb3VyY2VzO1xuICAgICAgY29uc3QgZGlzcG9zZWQgPSBUcmFuc2l0aW9uLmRpc3Bvc2VkO1xuICAgICAgRWZmZWN0cy5wdXNoLmFwcGx5KEVmZmVjdHMsIFRyYW5zaXRpb24uZWZmZWN0cyk7XG4gICAgICByZXMgPSBUcmFuc2l0aW9uLnJlc29sdmU7XG4gICAgICBmb3IgKGNvbnN0IGUgb2YgRWZmZWN0cykge1xuICAgICAgICBcInRTdGF0ZVwiIGluIGUgJiYgKGUuc3RhdGUgPSBlLnRTdGF0ZSk7XG4gICAgICAgIGRlbGV0ZSBlLnRTdGF0ZTtcbiAgICAgIH1cbiAgICAgIFRyYW5zaXRpb24gPSBudWxsO1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgZCBvZiBkaXNwb3NlZCkgY2xlYW5Ob2RlKGQpO1xuICAgICAgICBmb3IgKGNvbnN0IHYgb2Ygc291cmNlcykge1xuICAgICAgICAgIHYudmFsdWUgPSB2LnRWYWx1ZTtcbiAgICAgICAgICBpZiAodi5vd25lZCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHYub3duZWQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIGNsZWFuTm9kZSh2Lm93bmVkW2ldKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHYudE93bmVkKSB2Lm93bmVkID0gdi50T3duZWQ7XG4gICAgICAgICAgZGVsZXRlIHYudFZhbHVlO1xuICAgICAgICAgIGRlbGV0ZSB2LnRPd25lZDtcbiAgICAgICAgICB2LnRTdGF0ZSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgc2V0VHJhbnNQZW5kaW5nKGZhbHNlKTtcbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKFRyYW5zaXRpb24ucnVubmluZykge1xuICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gZmFsc2U7XG4gICAgICBUcmFuc2l0aW9uLmVmZmVjdHMucHVzaC5hcHBseShUcmFuc2l0aW9uLmVmZmVjdHMsIEVmZmVjdHMpO1xuICAgICAgRWZmZWN0cyA9IG51bGw7XG4gICAgICBzZXRUcmFuc1BlbmRpbmcodHJ1ZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG4gIGNvbnN0IGUgPSBFZmZlY3RzO1xuICBFZmZlY3RzID0gbnVsbDtcbiAgaWYgKGUubGVuZ3RoKSBydW5VcGRhdGVzKCgpID0+IHJ1bkVmZmVjdHMoZSksIGZhbHNlKTtlbHNlIERldkhvb2tzLmFmdGVyVXBkYXRlICYmIERldkhvb2tzLmFmdGVyVXBkYXRlKCk7XG4gIGlmIChyZXMpIHJlcygpO1xufVxuZnVuY3Rpb24gcnVuUXVldWUocXVldWUpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykgcnVuVG9wKHF1ZXVlW2ldKTtcbn1cbmZ1bmN0aW9uIHNjaGVkdWxlUXVldWUocXVldWUpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGl0ZW0gPSBxdWV1ZVtpXTtcbiAgICBjb25zdCB0YXNrcyA9IFRyYW5zaXRpb24ucXVldWU7XG4gICAgaWYgKCF0YXNrcy5oYXMoaXRlbSkpIHtcbiAgICAgIHRhc2tzLmFkZChpdGVtKTtcbiAgICAgIFNjaGVkdWxlcigoKSA9PiB7XG4gICAgICAgIHRhc2tzLmRlbGV0ZShpdGVtKTtcbiAgICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICBydW5Ub3AoaXRlbSk7XG4gICAgICAgIH0sIGZhbHNlKTtcbiAgICAgICAgVHJhbnNpdGlvbiAmJiAoVHJhbnNpdGlvbi5ydW5uaW5nID0gZmFsc2UpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBydW5Vc2VyRWZmZWN0cyhxdWV1ZSkge1xuICBsZXQgaSxcbiAgICB1c2VyTGVuZ3RoID0gMDtcbiAgZm9yIChpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZSA9IHF1ZXVlW2ldO1xuICAgIGlmICghZS51c2VyKSBydW5Ub3AoZSk7ZWxzZSBxdWV1ZVt1c2VyTGVuZ3RoKytdID0gZTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmNvdW50KSB7XG4gICAgICBzaGFyZWRDb25maWcuZWZmZWN0cyB8fCAoc2hhcmVkQ29uZmlnLmVmZmVjdHMgPSBbXSk7XG4gICAgICBzaGFyZWRDb25maWcuZWZmZWN0cy5wdXNoKC4uLnF1ZXVlLnNsaWNlKDAsIHVzZXJMZW5ndGgpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmVmZmVjdHMgJiYgKHNoYXJlZENvbmZpZy5kb25lIHx8ICFzaGFyZWRDb25maWcuY291bnQpKSB7XG4gICAgcXVldWUgPSBbLi4uc2hhcmVkQ29uZmlnLmVmZmVjdHMsIC4uLnF1ZXVlXTtcbiAgICB1c2VyTGVuZ3RoICs9IHNoYXJlZENvbmZpZy5lZmZlY3RzLmxlbmd0aDtcbiAgICBkZWxldGUgc2hhcmVkQ29uZmlnLmVmZmVjdHM7XG4gIH1cbiAgZm9yIChpID0gMDsgaSA8IHVzZXJMZW5ndGg7IGkrKykgcnVuVG9wKHF1ZXVlW2ldKTtcbn1cbmZ1bmN0aW9uIGxvb2tVcHN0cmVhbShub2RlLCBpZ25vcmUpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uKSBub2RlLnRTdGF0ZSA9IDA7ZWxzZSBub2RlLnN0YXRlID0gMDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLnNvdXJjZXMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBjb25zdCBzb3VyY2UgPSBub2RlLnNvdXJjZXNbaV07XG4gICAgaWYgKHNvdXJjZS5zb3VyY2VzKSB7XG4gICAgICBjb25zdCBzdGF0ZSA9IHJ1bm5pbmdUcmFuc2l0aW9uID8gc291cmNlLnRTdGF0ZSA6IHNvdXJjZS5zdGF0ZTtcbiAgICAgIGlmIChzdGF0ZSA9PT0gU1RBTEUpIHtcbiAgICAgICAgaWYgKHNvdXJjZSAhPT0gaWdub3JlICYmICghc291cmNlLnVwZGF0ZWRBdCB8fCBzb3VyY2UudXBkYXRlZEF0IDwgRXhlY0NvdW50KSkgcnVuVG9wKHNvdXJjZSk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBQRU5ESU5HKSBsb29rVXBzdHJlYW0oc291cmNlLCBpZ25vcmUpO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gbWFya0Rvd25zdHJlYW0obm9kZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUub2JzZXJ2ZXJzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgY29uc3QgbyA9IG5vZGUub2JzZXJ2ZXJzW2ldO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiA/ICFvLnRTdGF0ZSA6ICFvLnN0YXRlKSB7XG4gICAgICBpZiAocnVubmluZ1RyYW5zaXRpb24pIG8udFN0YXRlID0gUEVORElORztlbHNlIG8uc3RhdGUgPSBQRU5ESU5HO1xuICAgICAgaWYgKG8ucHVyZSkgVXBkYXRlcy5wdXNoKG8pO2Vsc2UgRWZmZWN0cy5wdXNoKG8pO1xuICAgICAgby5vYnNlcnZlcnMgJiYgbWFya0Rvd25zdHJlYW0obyk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBjbGVhbk5vZGUobm9kZSkge1xuICBsZXQgaTtcbiAgaWYgKG5vZGUuc291cmNlcykge1xuICAgIHdoaWxlIChub2RlLnNvdXJjZXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBzb3VyY2UgPSBub2RlLnNvdXJjZXMucG9wKCksXG4gICAgICAgIGluZGV4ID0gbm9kZS5zb3VyY2VTbG90cy5wb3AoKSxcbiAgICAgICAgb2JzID0gc291cmNlLm9ic2VydmVycztcbiAgICAgIGlmIChvYnMgJiYgb2JzLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBuID0gb2JzLnBvcCgpLFxuICAgICAgICAgIHMgPSBzb3VyY2Uub2JzZXJ2ZXJTbG90cy5wb3AoKTtcbiAgICAgICAgaWYgKGluZGV4IDwgb2JzLmxlbmd0aCkge1xuICAgICAgICAgIG4uc291cmNlU2xvdHNbc10gPSBpbmRleDtcbiAgICAgICAgICBvYnNbaW5kZXhdID0gbjtcbiAgICAgICAgICBzb3VyY2Uub2JzZXJ2ZXJTbG90c1tpbmRleF0gPSBzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChub2RlLnRPd25lZCkge1xuICAgIGZvciAoaSA9IG5vZGUudE93bmVkLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBjbGVhbk5vZGUobm9kZS50T3duZWRbaV0pO1xuICAgIGRlbGV0ZSBub2RlLnRPd25lZDtcbiAgfVxuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgbm9kZS5wdXJlKSB7XG4gICAgcmVzZXQobm9kZSwgdHJ1ZSk7XG4gIH0gZWxzZSBpZiAobm9kZS5vd25lZCkge1xuICAgIGZvciAoaSA9IG5vZGUub3duZWQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGNsZWFuTm9kZShub2RlLm93bmVkW2ldKTtcbiAgICBub2RlLm93bmVkID0gbnVsbDtcbiAgfVxuICBpZiAobm9kZS5jbGVhbnVwcykge1xuICAgIGZvciAoaSA9IG5vZGUuY2xlYW51cHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIG5vZGUuY2xlYW51cHNbaV0oKTtcbiAgICBub2RlLmNsZWFudXBzID0gbnVsbDtcbiAgfVxuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIG5vZGUudFN0YXRlID0gMDtlbHNlIG5vZGUuc3RhdGUgPSAwO1xuICBkZWxldGUgbm9kZS5zb3VyY2VNYXA7XG59XG5mdW5jdGlvbiByZXNldChub2RlLCB0b3ApIHtcbiAgaWYgKCF0b3ApIHtcbiAgICBub2RlLnRTdGF0ZSA9IDA7XG4gICAgVHJhbnNpdGlvbi5kaXNwb3NlZC5hZGQobm9kZSk7XG4gIH1cbiAgaWYgKG5vZGUub3duZWQpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUub3duZWQubGVuZ3RoOyBpKyspIHJlc2V0KG5vZGUub3duZWRbaV0pO1xuICB9XG59XG5mdW5jdGlvbiBjYXN0RXJyb3IoZXJyKSB7XG4gIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikgcmV0dXJuIGVycjtcbiAgcmV0dXJuIG5ldyBFcnJvcih0eXBlb2YgZXJyID09PSBcInN0cmluZ1wiID8gZXJyIDogXCJVbmtub3duIGVycm9yXCIsIHtcbiAgICBjYXVzZTogZXJyXG4gIH0pO1xufVxuZnVuY3Rpb24gcnVuRXJyb3JzKGVyciwgZm5zLCBvd25lcikge1xuICB0cnkge1xuICAgIGZvciAoY29uc3QgZiBvZiBmbnMpIGYoZXJyKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGhhbmRsZUVycm9yKGUsIG93bmVyICYmIG93bmVyLm93bmVyIHx8IG51bGwpO1xuICB9XG59XG5mdW5jdGlvbiBoYW5kbGVFcnJvcihlcnIsIG93bmVyID0gT3duZXIpIHtcbiAgY29uc3QgZm5zID0gRVJST1IgJiYgb3duZXIgJiYgb3duZXIuY29udGV4dCAmJiBvd25lci5jb250ZXh0W0VSUk9SXTtcbiAgY29uc3QgZXJyb3IgPSBjYXN0RXJyb3IoZXJyKTtcbiAgaWYgKCFmbnMpIHRocm93IGVycm9yO1xuICBpZiAoRWZmZWN0cykgRWZmZWN0cy5wdXNoKHtcbiAgICBmbigpIHtcbiAgICAgIHJ1bkVycm9ycyhlcnJvciwgZm5zLCBvd25lcik7XG4gICAgfSxcbiAgICBzdGF0ZTogU1RBTEVcbiAgfSk7ZWxzZSBydW5FcnJvcnMoZXJyb3IsIGZucywgb3duZXIpO1xufVxuZnVuY3Rpb24gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKSB7XG4gIGlmICh0eXBlb2YgY2hpbGRyZW4gPT09IFwiZnVuY3Rpb25cIiAmJiAhY2hpbGRyZW4ubGVuZ3RoKSByZXR1cm4gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKCkpO1xuICBpZiAoQXJyYXkuaXNBcnJheShjaGlsZHJlbikpIHtcbiAgICBjb25zdCByZXN1bHRzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgcmVzdWx0ID0gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuW2ldKTtcbiAgICAgIEFycmF5LmlzQXJyYXkocmVzdWx0KSA/IHJlc3VsdHMucHVzaC5hcHBseShyZXN1bHRzLCByZXN1bHQpIDogcmVzdWx0cy5wdXNoKHJlc3VsdCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG4gIHJldHVybiBjaGlsZHJlbjtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVByb3ZpZGVyKGlkLCBvcHRpb25zKSB7XG4gIHJldHVybiBmdW5jdGlvbiBwcm92aWRlcihwcm9wcykge1xuICAgIGxldCByZXM7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHJlcyA9IHVudHJhY2soKCkgPT4ge1xuICAgICAgT3duZXIuY29udGV4dCA9IHtcbiAgICAgICAgLi4uT3duZXIuY29udGV4dCxcbiAgICAgICAgW2lkXTogcHJvcHMudmFsdWVcbiAgICAgIH07XG4gICAgICByZXR1cm4gY2hpbGRyZW4oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICAgIH0pLCB1bmRlZmluZWQsIG9wdGlvbnMpO1xuICAgIHJldHVybiByZXM7XG4gIH07XG59XG5mdW5jdGlvbiBvbkVycm9yKGZuKSB7XG4gIEVSUk9SIHx8IChFUlJPUiA9IFN5bWJvbChcImVycm9yXCIpKTtcbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJlcnJvciBoYW5kbGVycyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBydW5cIik7ZWxzZSBpZiAoT3duZXIuY29udGV4dCA9PT0gbnVsbCB8fCAhT3duZXIuY29udGV4dFtFUlJPUl0pIHtcbiAgICBPd25lci5jb250ZXh0ID0ge1xuICAgICAgLi4uT3duZXIuY29udGV4dCxcbiAgICAgIFtFUlJPUl06IFtmbl1cbiAgICB9O1xuICAgIG11dGF0ZUNvbnRleHQoT3duZXIsIEVSUk9SLCBbZm5dKTtcbiAgfSBlbHNlIE93bmVyLmNvbnRleHRbRVJST1JdLnB1c2goZm4pO1xufVxuZnVuY3Rpb24gbXV0YXRlQ29udGV4dChvLCBrZXksIHZhbHVlKSB7XG4gIGlmIChvLm93bmVkKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvLm93bmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoby5vd25lZFtpXS5jb250ZXh0ID09PSBvLmNvbnRleHQpIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICBpZiAoIW8ub3duZWRbaV0uY29udGV4dCkge1xuICAgICAgICBvLm93bmVkW2ldLmNvbnRleHQgPSBvLmNvbnRleHQ7XG4gICAgICAgIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKCFvLm93bmVkW2ldLmNvbnRleHRba2V5XSkge1xuICAgICAgICBvLm93bmVkW2ldLmNvbnRleHRba2V5XSA9IHZhbHVlO1xuICAgICAgICBtdXRhdGVDb250ZXh0KG8ub3duZWRbaV0sIGtleSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBvYnNlcnZhYmxlKGlucHV0KSB7XG4gIHJldHVybiB7XG4gICAgc3Vic2NyaWJlKG9ic2VydmVyKSB7XG4gICAgICBpZiAoIShvYnNlcnZlciBpbnN0YW5jZW9mIE9iamVjdCkgfHwgb2JzZXJ2ZXIgPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRXhwZWN0ZWQgdGhlIG9ic2VydmVyIHRvIGJlIGFuIG9iamVjdC5cIik7XG4gICAgICB9XG4gICAgICBjb25zdCBoYW5kbGVyID0gdHlwZW9mIG9ic2VydmVyID09PSBcImZ1bmN0aW9uXCIgPyBvYnNlcnZlciA6IG9ic2VydmVyLm5leHQgJiYgb2JzZXJ2ZXIubmV4dC5iaW5kKG9ic2VydmVyKTtcbiAgICAgIGlmICghaGFuZGxlcikge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHVuc3Vic2NyaWJlKCkge31cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRpc3Bvc2UgPSBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgICBjb25zdCB2ID0gaW5wdXQoKTtcbiAgICAgICAgICB1bnRyYWNrKCgpID0+IGhhbmRsZXIodikpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRpc3Bvc2VyO1xuICAgICAgfSk7XG4gICAgICBpZiAoZ2V0T3duZXIoKSkgb25DbGVhbnVwKGRpc3Bvc2UpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKSB7XG4gICAgICAgICAgZGlzcG9zZSgpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0sXG4gICAgW1N5bWJvbC5vYnNlcnZhYmxlIHx8IFwiQEBvYnNlcnZhYmxlXCJdKCkge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gZnJvbShwcm9kdWNlciwgaW5pdGFsVmFsdWUgPSB1bmRlZmluZWQpIHtcbiAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoaW5pdGFsVmFsdWUsIHtcbiAgICBlcXVhbHM6IGZhbHNlXG4gIH0pO1xuICBpZiAoXCJzdWJzY3JpYmVcIiBpbiBwcm9kdWNlcikge1xuICAgIGNvbnN0IHVuc3ViID0gcHJvZHVjZXIuc3Vic2NyaWJlKHYgPT4gc2V0KCgpID0+IHYpKTtcbiAgICBvbkNsZWFudXAoKCkgPT4gXCJ1bnN1YnNjcmliZVwiIGluIHVuc3ViID8gdW5zdWIudW5zdWJzY3JpYmUoKSA6IHVuc3ViKCkpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGNsZWFuID0gcHJvZHVjZXIoc2V0KTtcbiAgICBvbkNsZWFudXAoY2xlYW4pO1xuICB9XG4gIHJldHVybiBzO1xufVxuXG5jb25zdCBGQUxMQkFDSyA9IFN5bWJvbChcImZhbGxiYWNrXCIpO1xuZnVuY3Rpb24gZGlzcG9zZShkKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZC5sZW5ndGg7IGkrKykgZFtpXSgpO1xufVxuZnVuY3Rpb24gbWFwQXJyYXkobGlzdCwgbWFwRm4sIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgaXRlbXMgPSBbXSxcbiAgICBtYXBwZWQgPSBbXSxcbiAgICBkaXNwb3NlcnMgPSBbXSxcbiAgICBsZW4gPSAwLFxuICAgIGluZGV4ZXMgPSBtYXBGbi5sZW5ndGggPiAxID8gW10gOiBudWxsO1xuICBvbkNsZWFudXAoKCkgPT4gZGlzcG9zZShkaXNwb3NlcnMpKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBsZXQgbmV3SXRlbXMgPSBsaXN0KCkgfHwgW10sXG4gICAgICBuZXdMZW4gPSBuZXdJdGVtcy5sZW5ndGgsXG4gICAgICBpLFxuICAgICAgajtcbiAgICBuZXdJdGVtc1skVFJBQ0tdO1xuICAgIHJldHVybiB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGxldCBuZXdJbmRpY2VzLCBuZXdJbmRpY2VzTmV4dCwgdGVtcCwgdGVtcGRpc3Bvc2VycywgdGVtcEluZGV4ZXMsIHN0YXJ0LCBlbmQsIG5ld0VuZCwgaXRlbTtcbiAgICAgIGlmIChuZXdMZW4gPT09IDApIHtcbiAgICAgICAgaWYgKGxlbiAhPT0gMCkge1xuICAgICAgICAgIGRpc3Bvc2UoZGlzcG9zZXJzKTtcbiAgICAgICAgICBkaXNwb3NlcnMgPSBbXTtcbiAgICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICAgIGxlbiA9IDA7XG4gICAgICAgICAgaW5kZXhlcyAmJiAoaW5kZXhlcyA9IFtdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5mYWxsYmFjaykge1xuICAgICAgICAgIGl0ZW1zID0gW0ZBTExCQUNLXTtcbiAgICAgICAgICBtYXBwZWRbMF0gPSBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgICAgIGRpc3Bvc2Vyc1swXSA9IGRpc3Bvc2VyO1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMuZmFsbGJhY2soKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBsZW4gPSAxO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChsZW4gPT09IDApIHtcbiAgICAgICAgbWFwcGVkID0gbmV3IEFycmF5KG5ld0xlbik7XG4gICAgICAgIGZvciAoaiA9IDA7IGogPCBuZXdMZW47IGorKykge1xuICAgICAgICAgIGl0ZW1zW2pdID0gbmV3SXRlbXNbal07XG4gICAgICAgICAgbWFwcGVkW2pdID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICAgIGxlbiA9IG5ld0xlbjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRlbXAgPSBuZXcgQXJyYXkobmV3TGVuKTtcbiAgICAgICAgdGVtcGRpc3Bvc2VycyA9IG5ldyBBcnJheShuZXdMZW4pO1xuICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlcyA9IG5ldyBBcnJheShuZXdMZW4pKTtcbiAgICAgICAgZm9yIChzdGFydCA9IDAsIGVuZCA9IE1hdGgubWluKGxlbiwgbmV3TGVuKTsgc3RhcnQgPCBlbmQgJiYgaXRlbXNbc3RhcnRdID09PSBuZXdJdGVtc1tzdGFydF07IHN0YXJ0KyspO1xuICAgICAgICBmb3IgKGVuZCA9IGxlbiAtIDEsIG5ld0VuZCA9IG5ld0xlbiAtIDE7IGVuZCA+PSBzdGFydCAmJiBuZXdFbmQgPj0gc3RhcnQgJiYgaXRlbXNbZW5kXSA9PT0gbmV3SXRlbXNbbmV3RW5kXTsgZW5kLS0sIG5ld0VuZC0tKSB7XG4gICAgICAgICAgdGVtcFtuZXdFbmRdID0gbWFwcGVkW2VuZF07XG4gICAgICAgICAgdGVtcGRpc3Bvc2Vyc1tuZXdFbmRdID0gZGlzcG9zZXJzW2VuZF07XG4gICAgICAgICAgaW5kZXhlcyAmJiAodGVtcEluZGV4ZXNbbmV3RW5kXSA9IGluZGV4ZXNbZW5kXSk7XG4gICAgICAgIH1cbiAgICAgICAgbmV3SW5kaWNlcyA9IG5ldyBNYXAoKTtcbiAgICAgICAgbmV3SW5kaWNlc05leHQgPSBuZXcgQXJyYXkobmV3RW5kICsgMSk7XG4gICAgICAgIGZvciAoaiA9IG5ld0VuZDsgaiA+PSBzdGFydDsgai0tKSB7XG4gICAgICAgICAgaXRlbSA9IG5ld0l0ZW1zW2pdO1xuICAgICAgICAgIGkgPSBuZXdJbmRpY2VzLmdldChpdGVtKTtcbiAgICAgICAgICBuZXdJbmRpY2VzTmV4dFtqXSA9IGkgPT09IHVuZGVmaW5lZCA/IC0xIDogaTtcbiAgICAgICAgICBuZXdJbmRpY2VzLnNldChpdGVtLCBqKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGkgPSBzdGFydDsgaSA8PSBlbmQ7IGkrKykge1xuICAgICAgICAgIGl0ZW0gPSBpdGVtc1tpXTtcbiAgICAgICAgICBqID0gbmV3SW5kaWNlcy5nZXQoaXRlbSk7XG4gICAgICAgICAgaWYgKGogIT09IHVuZGVmaW5lZCAmJiBqICE9PSAtMSkge1xuICAgICAgICAgICAgdGVtcFtqXSA9IG1hcHBlZFtpXTtcbiAgICAgICAgICAgIHRlbXBkaXNwb3NlcnNbal0gPSBkaXNwb3NlcnNbaV07XG4gICAgICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlc1tqXSA9IGluZGV4ZXNbaV0pO1xuICAgICAgICAgICAgaiA9IG5ld0luZGljZXNOZXh0W2pdO1xuICAgICAgICAgICAgbmV3SW5kaWNlcy5zZXQoaXRlbSwgaik7XG4gICAgICAgICAgfSBlbHNlIGRpc3Bvc2Vyc1tpXSgpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaiA9IHN0YXJ0OyBqIDwgbmV3TGVuOyBqKyspIHtcbiAgICAgICAgICBpZiAoaiBpbiB0ZW1wKSB7XG4gICAgICAgICAgICBtYXBwZWRbal0gPSB0ZW1wW2pdO1xuICAgICAgICAgICAgZGlzcG9zZXJzW2pdID0gdGVtcGRpc3Bvc2Vyc1tqXTtcbiAgICAgICAgICAgIGlmIChpbmRleGVzKSB7XG4gICAgICAgICAgICAgIGluZGV4ZXNbal0gPSB0ZW1wSW5kZXhlc1tqXTtcbiAgICAgICAgICAgICAgaW5kZXhlc1tqXShqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgbWFwcGVkW2pdID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICAgIG1hcHBlZCA9IG1hcHBlZC5zbGljZSgwLCBsZW4gPSBuZXdMZW4pO1xuICAgICAgICBpdGVtcyA9IG5ld0l0ZW1zLnNsaWNlKDApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1hcHBlZDtcbiAgICB9KTtcbiAgICBmdW5jdGlvbiBtYXBwZXIoZGlzcG9zZXIpIHtcbiAgICAgIGRpc3Bvc2Vyc1tqXSA9IGRpc3Bvc2VyO1xuICAgICAgaWYgKGluZGV4ZXMpIHtcbiAgICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoaiwge1xuICAgICAgICAgIG5hbWU6IFwiaW5kZXhcIlxuICAgICAgICB9KSA7XG4gICAgICAgIGluZGV4ZXNbal0gPSBzZXQ7XG4gICAgICAgIHJldHVybiBtYXBGbihuZXdJdGVtc1tqXSwgcyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWFwRm4obmV3SXRlbXNbal0pO1xuICAgIH1cbiAgfTtcbn1cbmZ1bmN0aW9uIGluZGV4QXJyYXkobGlzdCwgbWFwRm4sIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgaXRlbXMgPSBbXSxcbiAgICBtYXBwZWQgPSBbXSxcbiAgICBkaXNwb3NlcnMgPSBbXSxcbiAgICBzaWduYWxzID0gW10sXG4gICAgbGVuID0gMCxcbiAgICBpO1xuICBvbkNsZWFudXAoKCkgPT4gZGlzcG9zZShkaXNwb3NlcnMpKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBjb25zdCBuZXdJdGVtcyA9IGxpc3QoKSB8fCBbXSxcbiAgICAgIG5ld0xlbiA9IG5ld0l0ZW1zLmxlbmd0aDtcbiAgICBuZXdJdGVtc1skVFJBQ0tdO1xuICAgIHJldHVybiB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGlmIChuZXdMZW4gPT09IDApIHtcbiAgICAgICAgaWYgKGxlbiAhPT0gMCkge1xuICAgICAgICAgIGRpc3Bvc2UoZGlzcG9zZXJzKTtcbiAgICAgICAgICBkaXNwb3NlcnMgPSBbXTtcbiAgICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICAgIGxlbiA9IDA7XG4gICAgICAgICAgc2lnbmFscyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLmZhbGxiYWNrKSB7XG4gICAgICAgICAgaXRlbXMgPSBbRkFMTEJBQ0tdO1xuICAgICAgICAgIG1hcHBlZFswXSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZXJzWzBdID0gZGlzcG9zZXI7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9ucy5mYWxsYmFjaygpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxlbiA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hcHBlZDtcbiAgICAgIH1cbiAgICAgIGlmIChpdGVtc1swXSA9PT0gRkFMTEJBQ0spIHtcbiAgICAgICAgZGlzcG9zZXJzWzBdKCk7XG4gICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICBtYXBwZWQgPSBbXTtcbiAgICAgICAgbGVuID0gMDtcbiAgICAgIH1cbiAgICAgIGZvciAoaSA9IDA7IGkgPCBuZXdMZW47IGkrKykge1xuICAgICAgICBpZiAoaSA8IGl0ZW1zLmxlbmd0aCAmJiBpdGVtc1tpXSAhPT0gbmV3SXRlbXNbaV0pIHtcbiAgICAgICAgICBzaWduYWxzW2ldKCgpID0+IG5ld0l0ZW1zW2ldKTtcbiAgICAgICAgfSBlbHNlIGlmIChpID49IGl0ZW1zLmxlbmd0aCkge1xuICAgICAgICAgIG1hcHBlZFtpXSA9IGNyZWF0ZVJvb3QobWFwcGVyKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yICg7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBkaXNwb3NlcnNbaV0oKTtcbiAgICAgIH1cbiAgICAgIGxlbiA9IHNpZ25hbHMubGVuZ3RoID0gZGlzcG9zZXJzLmxlbmd0aCA9IG5ld0xlbjtcbiAgICAgIGl0ZW1zID0gbmV3SXRlbXMuc2xpY2UoMCk7XG4gICAgICByZXR1cm4gbWFwcGVkID0gbWFwcGVkLnNsaWNlKDAsIGxlbik7XG4gICAgfSk7XG4gICAgZnVuY3Rpb24gbWFwcGVyKGRpc3Bvc2VyKSB7XG4gICAgICBkaXNwb3NlcnNbaV0gPSBkaXNwb3NlcjtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKG5ld0l0ZW1zW2ldLCB7XG4gICAgICAgIG5hbWU6IFwidmFsdWVcIlxuICAgICAgfSkgO1xuICAgICAgc2lnbmFsc1tpXSA9IHNldDtcbiAgICAgIHJldHVybiBtYXBGbihzLCBpKTtcbiAgICB9XG4gIH07XG59XG5cbmxldCBoeWRyYXRpb25FbmFibGVkID0gZmFsc2U7XG5mdW5jdGlvbiBlbmFibGVIeWRyYXRpb24oKSB7XG4gIGh5ZHJhdGlvbkVuYWJsZWQgPSB0cnVlO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50KENvbXAsIHByb3BzKSB7XG4gIGlmIChoeWRyYXRpb25FbmFibGVkKSB7XG4gICAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0KSB7XG4gICAgICBjb25zdCBjID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChuZXh0SHlkcmF0ZUNvbnRleHQoKSk7XG4gICAgICBjb25zdCByID0gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzIHx8IHt9KSA7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjKTtcbiAgICAgIHJldHVybiByO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzIHx8IHt9KTtcbn1cbmZ1bmN0aW9uIHRydWVGbigpIHtcbiAgcmV0dXJuIHRydWU7XG59XG5jb25zdCBwcm9wVHJhcHMgPSB7XG4gIGdldChfLCBwcm9wZXJ0eSwgcmVjZWl2ZXIpIHtcbiAgICBpZiAocHJvcGVydHkgPT09ICRQUk9YWSkgcmV0dXJuIHJlY2VpdmVyO1xuICAgIHJldHVybiBfLmdldChwcm9wZXJ0eSk7XG4gIH0sXG4gIGhhcyhfLCBwcm9wZXJ0eSkge1xuICAgIGlmIChwcm9wZXJ0eSA9PT0gJFBST1hZKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gXy5oYXMocHJvcGVydHkpO1xuICB9LFxuICBzZXQ6IHRydWVGbixcbiAgZGVsZXRlUHJvcGVydHk6IHRydWVGbixcbiAgZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKF8sIHByb3BlcnR5KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBnZXQoKSB7XG4gICAgICAgIHJldHVybiBfLmdldChwcm9wZXJ0eSk7XG4gICAgICB9LFxuICAgICAgc2V0OiB0cnVlRm4sXG4gICAgICBkZWxldGVQcm9wZXJ0eTogdHJ1ZUZuXG4gICAgfTtcbiAgfSxcbiAgb3duS2V5cyhfKSB7XG4gICAgcmV0dXJuIF8ua2V5cygpO1xuICB9XG59O1xuZnVuY3Rpb24gcmVzb2x2ZVNvdXJjZShzKSB7XG4gIHJldHVybiAhKHMgPSB0eXBlb2YgcyA9PT0gXCJmdW5jdGlvblwiID8gcygpIDogcykgPyB7fSA6IHM7XG59XG5mdW5jdGlvbiByZXNvbHZlU291cmNlcygpIHtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbmd0aCA9IHRoaXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICBjb25zdCB2ID0gdGhpc1tpXSgpO1xuICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHJldHVybiB2O1xuICB9XG59XG5mdW5jdGlvbiBtZXJnZVByb3BzKC4uLnNvdXJjZXMpIHtcbiAgbGV0IHByb3h5ID0gZmFsc2U7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHMgPSBzb3VyY2VzW2ldO1xuICAgIHByb3h5ID0gcHJveHkgfHwgISFzICYmICRQUk9YWSBpbiBzO1xuICAgIHNvdXJjZXNbaV0gPSB0eXBlb2YgcyA9PT0gXCJmdW5jdGlvblwiID8gKHByb3h5ID0gdHJ1ZSwgY3JlYXRlTWVtbyhzKSkgOiBzO1xuICB9XG4gIGlmIChTVVBQT1JUU19QUk9YWSAmJiBwcm94eSkge1xuICAgIHJldHVybiBuZXcgUHJveHkoe1xuICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgY29uc3QgdiA9IHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSlbcHJvcGVydHldO1xuICAgICAgICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHJldHVybiB2O1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFzKHByb3BlcnR5KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgaWYgKHByb3BlcnR5IGluIHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSkpIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBrZXlzKCkge1xuICAgICAgICBjb25zdCBrZXlzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc291cmNlcy5sZW5ndGg7IGkrKykga2V5cy5wdXNoKC4uLk9iamVjdC5rZXlzKHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSkpKTtcbiAgICAgICAgcmV0dXJuIFsuLi5uZXcgU2V0KGtleXMpXTtcbiAgICAgIH1cbiAgICB9LCBwcm9wVHJhcHMpO1xuICB9XG4gIGNvbnN0IHNvdXJjZXNNYXAgPSB7fTtcbiAgY29uc3QgZGVmaW5lZCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3Qgc291cmNlID0gc291cmNlc1tpXTtcbiAgICBpZiAoIXNvdXJjZSkgY29udGludWU7XG4gICAgY29uc3Qgc291cmNlS2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHNvdXJjZSk7XG4gICAgZm9yIChsZXQgaSA9IHNvdXJjZUtleXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IGtleSA9IHNvdXJjZUtleXNbaV07XG4gICAgICBpZiAoa2V5ID09PSBcIl9fcHJvdG9fX1wiIHx8IGtleSA9PT0gXCJjb25zdHJ1Y3RvclwiKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHNvdXJjZSwga2V5KTtcbiAgICAgIGlmICghZGVmaW5lZFtrZXldKSB7XG4gICAgICAgIGRlZmluZWRba2V5XSA9IGRlc2MuZ2V0ID8ge1xuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGdldDogcmVzb2x2ZVNvdXJjZXMuYmluZChzb3VyY2VzTWFwW2tleV0gPSBbZGVzYy5nZXQuYmluZChzb3VyY2UpXSlcbiAgICAgICAgfSA6IGRlc2MudmFsdWUgIT09IHVuZGVmaW5lZCA/IGRlc2MgOiB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBzb3VyY2VzID0gc291cmNlc01hcFtrZXldO1xuICAgICAgICBpZiAoc291cmNlcykge1xuICAgICAgICAgIGlmIChkZXNjLmdldCkgc291cmNlcy5wdXNoKGRlc2MuZ2V0LmJpbmQoc291cmNlKSk7ZWxzZSBpZiAoZGVzYy52YWx1ZSAhPT0gdW5kZWZpbmVkKSBzb3VyY2VzLnB1c2goKCkgPT4gZGVzYy52YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY29uc3QgdGFyZ2V0ID0ge307XG4gIGNvbnN0IGRlZmluZWRLZXlzID0gT2JqZWN0LmtleXMoZGVmaW5lZCk7XG4gIGZvciAobGV0IGkgPSBkZWZpbmVkS2V5cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGNvbnN0IGtleSA9IGRlZmluZWRLZXlzW2ldLFxuICAgICAgZGVzYyA9IGRlZmluZWRba2V5XTtcbiAgICBpZiAoZGVzYyAmJiBkZXNjLmdldCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCBkZXNjKTtlbHNlIHRhcmdldFtrZXldID0gZGVzYyA/IGRlc2MudmFsdWUgOiB1bmRlZmluZWQ7XG4gIH1cbiAgcmV0dXJuIHRhcmdldDtcbn1cbmZ1bmN0aW9uIHNwbGl0UHJvcHMocHJvcHMsIC4uLmtleXMpIHtcbiAgaWYgKFNVUFBPUlRTX1BST1hZICYmICRQUk9YWSBpbiBwcm9wcykge1xuICAgIGNvbnN0IGJsb2NrZWQgPSBuZXcgU2V0KGtleXMubGVuZ3RoID4gMSA/IGtleXMuZmxhdCgpIDoga2V5c1swXSk7XG4gICAgY29uc3QgcmVzID0ga2V5cy5tYXAoayA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb3h5KHtcbiAgICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgICAgcmV0dXJuIGsuaW5jbHVkZXMocHJvcGVydHkpID8gcHJvcHNbcHJvcGVydHldIDogdW5kZWZpbmVkO1xuICAgICAgICB9LFxuICAgICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gay5pbmNsdWRlcyhwcm9wZXJ0eSkgJiYgcHJvcGVydHkgaW4gcHJvcHM7XG4gICAgICAgIH0sXG4gICAgICAgIGtleXMoKSB7XG4gICAgICAgICAgcmV0dXJuIGsuZmlsdGVyKHByb3BlcnR5ID0+IHByb3BlcnR5IGluIHByb3BzKTtcbiAgICAgICAgfVxuICAgICAgfSwgcHJvcFRyYXBzKTtcbiAgICB9KTtcbiAgICByZXMucHVzaChuZXcgUHJveHkoe1xuICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgIHJldHVybiBibG9ja2VkLmhhcyhwcm9wZXJ0eSkgPyB1bmRlZmluZWQgOiBwcm9wc1twcm9wZXJ0eV07XG4gICAgICB9LFxuICAgICAgaGFzKHByb3BlcnR5KSB7XG4gICAgICAgIHJldHVybiBibG9ja2VkLmhhcyhwcm9wZXJ0eSkgPyBmYWxzZSA6IHByb3BlcnR5IGluIHByb3BzO1xuICAgICAgfSxcbiAgICAgIGtleXMoKSB7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhwcm9wcykuZmlsdGVyKGsgPT4gIWJsb2NrZWQuaGFzKGspKTtcbiAgICAgIH1cbiAgICB9LCBwcm9wVHJhcHMpKTtcbiAgICByZXR1cm4gcmVzO1xuICB9XG4gIGNvbnN0IG90aGVyT2JqZWN0ID0ge307XG4gIGNvbnN0IG9iamVjdHMgPSBrZXlzLm1hcCgoKSA9PiAoe30pKTtcbiAgZm9yIChjb25zdCBwcm9wTmFtZSBvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhwcm9wcykpIHtcbiAgICBjb25zdCBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwcm9wcywgcHJvcE5hbWUpO1xuICAgIGNvbnN0IGlzRGVmYXVsdERlc2MgPSAhZGVzYy5nZXQgJiYgIWRlc2Muc2V0ICYmIGRlc2MuZW51bWVyYWJsZSAmJiBkZXNjLndyaXRhYmxlICYmIGRlc2MuY29uZmlndXJhYmxlO1xuICAgIGxldCBibG9ja2VkID0gZmFsc2U7XG4gICAgbGV0IG9iamVjdEluZGV4ID0gMDtcbiAgICBmb3IgKGNvbnN0IGsgb2Yga2V5cykge1xuICAgICAgaWYgKGsuaW5jbHVkZXMocHJvcE5hbWUpKSB7XG4gICAgICAgIGJsb2NrZWQgPSB0cnVlO1xuICAgICAgICBpc0RlZmF1bHREZXNjID8gb2JqZWN0c1tvYmplY3RJbmRleF1bcHJvcE5hbWVdID0gZGVzYy52YWx1ZSA6IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmplY3RzW29iamVjdEluZGV4XSwgcHJvcE5hbWUsIGRlc2MpO1xuICAgICAgfVxuICAgICAgKytvYmplY3RJbmRleDtcbiAgICB9XG4gICAgaWYgKCFibG9ja2VkKSB7XG4gICAgICBpc0RlZmF1bHREZXNjID8gb3RoZXJPYmplY3RbcHJvcE5hbWVdID0gZGVzYy52YWx1ZSA6IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvdGhlck9iamVjdCwgcHJvcE5hbWUsIGRlc2MpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gWy4uLm9iamVjdHMsIG90aGVyT2JqZWN0XTtcbn1cbmZ1bmN0aW9uIGxhenkoZm4pIHtcbiAgbGV0IGNvbXA7XG4gIGxldCBwO1xuICBjb25zdCB3cmFwID0gcHJvcHMgPT4ge1xuICAgIGNvbnN0IGN0eCA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICAgIGlmIChjdHgpIHtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKCk7XG4gICAgICBzaGFyZWRDb25maWcuY291bnQgfHwgKHNoYXJlZENvbmZpZy5jb3VudCA9IDApO1xuICAgICAgc2hhcmVkQ29uZmlnLmNvdW50Kys7XG4gICAgICAocCB8fCAocCA9IGZuKCkpKS50aGVuKG1vZCA9PiB7XG4gICAgICAgICFzaGFyZWRDb25maWcuZG9uZSAmJiBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgICBzaGFyZWRDb25maWcuY291bnQtLTtcbiAgICAgICAgc2V0KCgpID0+IG1vZC5kZWZhdWx0KTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgIH0pO1xuICAgICAgY29tcCA9IHM7XG4gICAgfSBlbHNlIGlmICghY29tcCkge1xuICAgICAgY29uc3QgW3NdID0gY3JlYXRlUmVzb3VyY2UoKCkgPT4gKHAgfHwgKHAgPSBmbigpKSkudGhlbihtb2QgPT4gbW9kLmRlZmF1bHQpKTtcbiAgICAgIGNvbXAgPSBzO1xuICAgIH1cbiAgICBsZXQgQ29tcDtcbiAgICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiAoQ29tcCA9IGNvbXAoKSkgPyB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGlmIChJU19ERVYpIE9iamVjdC5hc3NpZ24oQ29tcCwge1xuICAgICAgICBbJERFVkNPTVBdOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIGlmICghY3R4IHx8IHNoYXJlZENvbmZpZy5kb25lKSByZXR1cm4gQ29tcChwcm9wcyk7XG4gICAgICBjb25zdCBjID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgY29uc3QgciA9IENvbXAocHJvcHMpO1xuICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoYyk7XG4gICAgICByZXR1cm4gcjtcbiAgICB9KSA6IFwiXCIpO1xuICB9O1xuICB3cmFwLnByZWxvYWQgPSAoKSA9PiBwIHx8ICgocCA9IGZuKCkpLnRoZW4obW9kID0+IGNvbXAgPSAoKSA9PiBtb2QuZGVmYXVsdCksIHApO1xuICByZXR1cm4gd3JhcDtcbn1cbmxldCBjb3VudGVyID0gMDtcbmZ1bmN0aW9uIGNyZWF0ZVVuaXF1ZUlkKCkge1xuICBjb25zdCBjdHggPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgcmV0dXJuIGN0eCA/IHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCkgOiBgY2wtJHtjb3VudGVyKyt9YDtcbn1cblxuY29uc3QgbmFycm93ZWRFcnJvciA9IG5hbWUgPT4gYEF0dGVtcHRpbmcgdG8gYWNjZXNzIGEgc3RhbGUgdmFsdWUgZnJvbSA8JHtuYW1lfT4gdGhhdCBjb3VsZCBwb3NzaWJseSBiZSB1bmRlZmluZWQuIFRoaXMgbWF5IG9jY3VyIGJlY2F1c2UgeW91IGFyZSByZWFkaW5nIHRoZSBhY2Nlc3NvciByZXR1cm5lZCBmcm9tIHRoZSBjb21wb25lbnQgYXQgYSB0aW1lIHdoZXJlIGl0IGhhcyBhbHJlYWR5IGJlZW4gdW5tb3VudGVkLiBXZSByZWNvbW1lbmQgY2xlYW5pbmcgdXAgYW55IHN0YWxlIHRpbWVycyBvciBhc3luYywgb3IgcmVhZGluZyBmcm9tIHRoZSBpbml0aWFsIGNvbmRpdGlvbi5gIDtcbmZ1bmN0aW9uIEZvcihwcm9wcykge1xuICBjb25zdCBmYWxsYmFjayA9IFwiZmFsbGJhY2tcIiBpbiBwcm9wcyAmJiB7XG4gICAgZmFsbGJhY2s6ICgpID0+IHByb3BzLmZhbGxiYWNrXG4gIH07XG4gIHJldHVybiBjcmVhdGVNZW1vKG1hcEFycmF5KCgpID0+IHByb3BzLmVhY2gsIHByb3BzLmNoaWxkcmVuLCBmYWxsYmFjayB8fCB1bmRlZmluZWQpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSkgO1xufVxuZnVuY3Rpb24gSW5kZXgocHJvcHMpIHtcbiAgY29uc3QgZmFsbGJhY2sgPSBcImZhbGxiYWNrXCIgaW4gcHJvcHMgJiYge1xuICAgIGZhbGxiYWNrOiAoKSA9PiBwcm9wcy5mYWxsYmFja1xuICB9O1xuICByZXR1cm4gY3JlYXRlTWVtbyhpbmRleEFycmF5KCgpID0+IHByb3BzLmVhY2gsIHByb3BzLmNoaWxkcmVuLCBmYWxsYmFjayB8fCB1bmRlZmluZWQpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSkgO1xufVxuZnVuY3Rpb24gU2hvdyhwcm9wcykge1xuICBjb25zdCBrZXllZCA9IHByb3BzLmtleWVkO1xuICBjb25zdCBjb25kaXRpb25WYWx1ZSA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMud2hlbiwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJjb25kaXRpb24gdmFsdWVcIlxuICB9ICk7XG4gIGNvbnN0IGNvbmRpdGlvbiA9IGtleWVkID8gY29uZGl0aW9uVmFsdWUgOiBjcmVhdGVNZW1vKGNvbmRpdGlvblZhbHVlLCB1bmRlZmluZWQsIHtcbiAgICBlcXVhbHM6IChhLCBiKSA9PiAhYSA9PT0gIWIsXG4gICAgbmFtZTogXCJjb25kaXRpb25cIlxuICB9ICk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBjID0gY29uZGl0aW9uKCk7XG4gICAgaWYgKGMpIHtcbiAgICAgIGNvbnN0IGNoaWxkID0gcHJvcHMuY2hpbGRyZW47XG4gICAgICBjb25zdCBmbiA9IHR5cGVvZiBjaGlsZCA9PT0gXCJmdW5jdGlvblwiICYmIGNoaWxkLmxlbmd0aCA+IDA7XG4gICAgICByZXR1cm4gZm4gPyB1bnRyYWNrKCgpID0+IGNoaWxkKGtleWVkID8gYyA6ICgpID0+IHtcbiAgICAgICAgaWYgKCF1bnRyYWNrKGNvbmRpdGlvbikpIHRocm93IG5hcnJvd2VkRXJyb3IoXCJTaG93XCIpO1xuICAgICAgICByZXR1cm4gY29uZGl0aW9uVmFsdWUoKTtcbiAgICAgIH0pKSA6IGNoaWxkO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcHMuZmFsbGJhY2s7XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9ICk7XG59XG5mdW5jdGlvbiBTd2l0Y2gocHJvcHMpIHtcbiAgY29uc3QgY2hzID0gY2hpbGRyZW4oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICBjb25zdCBzd2l0Y2hGdW5jID0gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgY2ggPSBjaHMoKTtcbiAgICBjb25zdCBtcHMgPSBBcnJheS5pc0FycmF5KGNoKSA/IGNoIDogW2NoXTtcbiAgICBsZXQgZnVuYyA9ICgpID0+IHVuZGVmaW5lZDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1wcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaW5kZXggPSBpO1xuICAgICAgY29uc3QgbXAgPSBtcHNbaV07XG4gICAgICBjb25zdCBwcmV2RnVuYyA9IGZ1bmM7XG4gICAgICBjb25zdCBjb25kaXRpb25WYWx1ZSA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJldkZ1bmMoKSA/IHVuZGVmaW5lZCA6IG1wLndoZW4sIHVuZGVmaW5lZCwge1xuICAgICAgICBuYW1lOiBcImNvbmRpdGlvbiB2YWx1ZVwiXG4gICAgICB9ICk7XG4gICAgICBjb25zdCBjb25kaXRpb24gPSBtcC5rZXllZCA/IGNvbmRpdGlvblZhbHVlIDogY3JlYXRlTWVtbyhjb25kaXRpb25WYWx1ZSwgdW5kZWZpbmVkLCB7XG4gICAgICAgIGVxdWFsczogKGEsIGIpID0+ICFhID09PSAhYixcbiAgICAgICAgbmFtZTogXCJjb25kaXRpb25cIlxuICAgICAgfSApO1xuICAgICAgZnVuYyA9ICgpID0+IHByZXZGdW5jKCkgfHwgKGNvbmRpdGlvbigpID8gW2luZGV4LCBjb25kaXRpb25WYWx1ZSwgbXBdIDogdW5kZWZpbmVkKTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmM7XG4gIH0pO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3Qgc2VsID0gc3dpdGNoRnVuYygpKCk7XG4gICAgaWYgKCFzZWwpIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgICBjb25zdCBbaW5kZXgsIGNvbmRpdGlvblZhbHVlLCBtcF0gPSBzZWw7XG4gICAgY29uc3QgY2hpbGQgPSBtcC5jaGlsZHJlbjtcbiAgICBjb25zdCBmbiA9IHR5cGVvZiBjaGlsZCA9PT0gXCJmdW5jdGlvblwiICYmIGNoaWxkLmxlbmd0aCA+IDA7XG4gICAgcmV0dXJuIGZuID8gdW50cmFjaygoKSA9PiBjaGlsZChtcC5rZXllZCA/IGNvbmRpdGlvblZhbHVlKCkgOiAoKSA9PiB7XG4gICAgICBpZiAodW50cmFjayhzd2l0Y2hGdW5jKSgpPy5bMF0gIT09IGluZGV4KSB0aHJvdyBuYXJyb3dlZEVycm9yKFwiTWF0Y2hcIik7XG4gICAgICByZXR1cm4gY29uZGl0aW9uVmFsdWUoKTtcbiAgICB9KSkgOiBjaGlsZDtcbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJldmFsIGNvbmRpdGlvbnNcIlxuICB9ICk7XG59XG5mdW5jdGlvbiBNYXRjaChwcm9wcykge1xuICByZXR1cm4gcHJvcHM7XG59XG5sZXQgRXJyb3JzO1xuZnVuY3Rpb24gcmVzZXRFcnJvckJvdW5kYXJpZXMoKSB7XG4gIEVycm9ycyAmJiBbLi4uRXJyb3JzXS5mb3JFYWNoKGZuID0+IGZuKCkpO1xufVxuZnVuY3Rpb24gRXJyb3JCb3VuZGFyeShwcm9wcykge1xuICBsZXQgZXJyO1xuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgc2hhcmVkQ29uZmlnLmxvYWQpIGVyciA9IHNoYXJlZENvbmZpZy5sb2FkKHNoYXJlZENvbmZpZy5nZXRDb250ZXh0SWQoKSk7XG4gIGNvbnN0IFtlcnJvcmVkLCBzZXRFcnJvcmVkXSA9IGNyZWF0ZVNpZ25hbChlcnIsIHtcbiAgICBuYW1lOiBcImVycm9yZWRcIlxuICB9ICk7XG4gIEVycm9ycyB8fCAoRXJyb3JzID0gbmV3IFNldCgpKTtcbiAgRXJyb3JzLmFkZChzZXRFcnJvcmVkKTtcbiAgb25DbGVhbnVwKCgpID0+IEVycm9ycy5kZWxldGUoc2V0RXJyb3JlZCkpO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgbGV0IGU7XG4gICAgaWYgKGUgPSBlcnJvcmVkKCkpIHtcbiAgICAgIGNvbnN0IGYgPSBwcm9wcy5mYWxsYmFjaztcbiAgICAgIGlmICgodHlwZW9mIGYgIT09IFwiZnVuY3Rpb25cIiB8fCBmLmxlbmd0aCA9PSAwKSkgY29uc29sZS5lcnJvcihlKTtcbiAgICAgIHJldHVybiB0eXBlb2YgZiA9PT0gXCJmdW5jdGlvblwiICYmIGYubGVuZ3RoID8gdW50cmFjaygoKSA9PiBmKGUsICgpID0+IHNldEVycm9yZWQoKSkpIDogZjtcbiAgICB9XG4gICAgcmV0dXJuIGNhdGNoRXJyb3IoKCkgPT4gcHJvcHMuY2hpbGRyZW4sIHNldEVycm9yZWQpO1xuICB9LCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSApO1xufVxuXG5jb25zdCBzdXNwZW5zZUxpc3RFcXVhbHMgPSAoYSwgYikgPT4gYS5zaG93Q29udGVudCA9PT0gYi5zaG93Q29udGVudCAmJiBhLnNob3dGYWxsYmFjayA9PT0gYi5zaG93RmFsbGJhY2s7XG5jb25zdCBTdXNwZW5zZUxpc3RDb250ZXh0ID0gLyogI19fUFVSRV9fICovY3JlYXRlQ29udGV4dCgpO1xuZnVuY3Rpb24gU3VzcGVuc2VMaXN0KHByb3BzKSB7XG4gIGxldCBbd3JhcHBlciwgc2V0V3JhcHBlcl0gPSBjcmVhdGVTaWduYWwoKCkgPT4gKHtcbiAgICAgIGluRmFsbGJhY2s6IGZhbHNlXG4gICAgfSkpLFxuICAgIHNob3c7XG4gIGNvbnN0IGxpc3RDb250ZXh0ID0gdXNlQ29udGV4dChTdXNwZW5zZUxpc3RDb250ZXh0KTtcbiAgY29uc3QgW3JlZ2lzdHJ5LCBzZXRSZWdpc3RyeV0gPSBjcmVhdGVTaWduYWwoW10pO1xuICBpZiAobGlzdENvbnRleHQpIHtcbiAgICBzaG93ID0gbGlzdENvbnRleHQucmVnaXN0ZXIoY3JlYXRlTWVtbygoKSA9PiB3cmFwcGVyKCkoKS5pbkZhbGxiYWNrKSk7XG4gIH1cbiAgY29uc3QgcmVzb2x2ZWQgPSBjcmVhdGVNZW1vKHByZXYgPT4ge1xuICAgIGNvbnN0IHJldmVhbCA9IHByb3BzLnJldmVhbE9yZGVyLFxuICAgICAgdGFpbCA9IHByb3BzLnRhaWwsXG4gICAgICB7XG4gICAgICAgIHNob3dDb250ZW50ID0gdHJ1ZSxcbiAgICAgICAgc2hvd0ZhbGxiYWNrID0gdHJ1ZVxuICAgICAgfSA9IHNob3cgPyBzaG93KCkgOiB7fSxcbiAgICAgIHJlZyA9IHJlZ2lzdHJ5KCksXG4gICAgICByZXZlcnNlID0gcmV2ZWFsID09PSBcImJhY2t3YXJkc1wiO1xuICAgIGlmIChyZXZlYWwgPT09IFwidG9nZXRoZXJcIikge1xuICAgICAgY29uc3QgYWxsID0gcmVnLmV2ZXJ5KGluRmFsbGJhY2sgPT4gIWluRmFsbGJhY2soKSk7XG4gICAgICBjb25zdCByZXMgPSByZWcubWFwKCgpID0+ICh7XG4gICAgICAgIHNob3dDb250ZW50OiBhbGwgJiYgc2hvd0NvbnRlbnQsXG4gICAgICAgIHNob3dGYWxsYmFja1xuICAgICAgfSkpO1xuICAgICAgcmVzLmluRmFsbGJhY2sgPSAhYWxsO1xuICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG4gICAgbGV0IHN0b3AgPSBmYWxzZTtcbiAgICBsZXQgaW5GYWxsYmFjayA9IHByZXYuaW5GYWxsYmFjaztcbiAgICBjb25zdCByZXMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcmVnLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBjb25zdCBuID0gcmV2ZXJzZSA/IGxlbiAtIGkgLSAxIDogaSxcbiAgICAgICAgcyA9IHJlZ1tuXSgpO1xuICAgICAgaWYgKCFzdG9wICYmICFzKSB7XG4gICAgICAgIHJlc1tuXSA9IHtcbiAgICAgICAgICBzaG93Q29udGVudCxcbiAgICAgICAgICBzaG93RmFsbGJhY2tcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5leHQgPSAhc3RvcDtcbiAgICAgICAgaWYgKG5leHQpIGluRmFsbGJhY2sgPSB0cnVlO1xuICAgICAgICByZXNbbl0gPSB7XG4gICAgICAgICAgc2hvd0NvbnRlbnQ6IG5leHQsXG4gICAgICAgICAgc2hvd0ZhbGxiYWNrOiAhdGFpbCB8fCBuZXh0ICYmIHRhaWwgPT09IFwiY29sbGFwc2VkXCIgPyBzaG93RmFsbGJhY2sgOiBmYWxzZVxuICAgICAgICB9O1xuICAgICAgICBzdG9wID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFzdG9wKSBpbkZhbGxiYWNrID0gZmFsc2U7XG4gICAgcmVzLmluRmFsbGJhY2sgPSBpbkZhbGxiYWNrO1xuICAgIHJldHVybiByZXM7XG4gIH0sIHtcbiAgICBpbkZhbGxiYWNrOiBmYWxzZVxuICB9KTtcbiAgc2V0V3JhcHBlcigoKSA9PiByZXNvbHZlZCk7XG4gIHJldHVybiBjcmVhdGVDb21wb25lbnQoU3VzcGVuc2VMaXN0Q29udGV4dC5Qcm92aWRlciwge1xuICAgIHZhbHVlOiB7XG4gICAgICByZWdpc3RlcjogaW5GYWxsYmFjayA9PiB7XG4gICAgICAgIGxldCBpbmRleDtcbiAgICAgICAgc2V0UmVnaXN0cnkocmVnaXN0cnkgPT4ge1xuICAgICAgICAgIGluZGV4ID0gcmVnaXN0cnkubGVuZ3RoO1xuICAgICAgICAgIHJldHVybiBbLi4ucmVnaXN0cnksIGluRmFsbGJhY2tdO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4gcmVzb2x2ZWQoKVtpbmRleF0sIHVuZGVmaW5lZCwge1xuICAgICAgICAgIGVxdWFsczogc3VzcGVuc2VMaXN0RXF1YWxzXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgZ2V0IGNoaWxkcmVuKCkge1xuICAgICAgcmV0dXJuIHByb3BzLmNoaWxkcmVuO1xuICAgIH1cbiAgfSk7XG59XG5mdW5jdGlvbiBTdXNwZW5zZShwcm9wcykge1xuICBsZXQgY291bnRlciA9IDAsXG4gICAgc2hvdyxcbiAgICBjdHgsXG4gICAgcCxcbiAgICBmbGlja2VyLFxuICAgIGVycm9yO1xuICBjb25zdCBbaW5GYWxsYmFjaywgc2V0RmFsbGJhY2tdID0gY3JlYXRlU2lnbmFsKGZhbHNlKSxcbiAgICBTdXNwZW5zZUNvbnRleHQgPSBnZXRTdXNwZW5zZUNvbnRleHQoKSxcbiAgICBzdG9yZSA9IHtcbiAgICAgIGluY3JlbWVudDogKCkgPT4ge1xuICAgICAgICBpZiAoKytjb3VudGVyID09PSAxKSBzZXRGYWxsYmFjayh0cnVlKTtcbiAgICAgIH0sXG4gICAgICBkZWNyZW1lbnQ6ICgpID0+IHtcbiAgICAgICAgaWYgKC0tY291bnRlciA9PT0gMCkgc2V0RmFsbGJhY2soZmFsc2UpO1xuICAgICAgfSxcbiAgICAgIGluRmFsbGJhY2ssXG4gICAgICBlZmZlY3RzOiBbXSxcbiAgICAgIHJlc29sdmVkOiBmYWxzZVxuICAgIH0sXG4gICAgb3duZXIgPSBnZXRPd25lcigpO1xuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgc2hhcmVkQ29uZmlnLmxvYWQpIHtcbiAgICBjb25zdCBrZXkgPSBzaGFyZWRDb25maWcuZ2V0Q29udGV4dElkKCk7XG4gICAgbGV0IHJlZiA9IHNoYXJlZENvbmZpZy5sb2FkKGtleSk7XG4gICAgaWYgKHJlZikge1xuICAgICAgaWYgKHR5cGVvZiByZWYgIT09IFwib2JqZWN0XCIgfHwgcmVmLnMgIT09IDEpIHAgPSByZWY7ZWxzZSBzaGFyZWRDb25maWcuZ2F0aGVyKGtleSk7XG4gICAgfVxuICAgIGlmIChwICYmIHAgIT09IFwiJCRmXCIpIHtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCwge1xuICAgICAgICBlcXVhbHM6IGZhbHNlXG4gICAgICB9KTtcbiAgICAgIGZsaWNrZXIgPSBzO1xuICAgICAgcC50aGVuKCgpID0+IHtcbiAgICAgICAgaWYgKHNoYXJlZENvbmZpZy5kb25lKSByZXR1cm4gc2V0KCk7XG4gICAgICAgIHNoYXJlZENvbmZpZy5nYXRoZXIoa2V5KTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoY3R4KTtcbiAgICAgICAgc2V0KCk7XG4gICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KCk7XG4gICAgICB9LCBlcnIgPT4ge1xuICAgICAgICBlcnJvciA9IGVycjtcbiAgICAgICAgc2V0KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgY29uc3QgbGlzdENvbnRleHQgPSB1c2VDb250ZXh0KFN1c3BlbnNlTGlzdENvbnRleHQpO1xuICBpZiAobGlzdENvbnRleHQpIHNob3cgPSBsaXN0Q29udGV4dC5yZWdpc3RlcihzdG9yZS5pbkZhbGxiYWNrKTtcbiAgbGV0IGRpc3Bvc2U7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlICYmIGRpc3Bvc2UoKSk7XG4gIHJldHVybiBjcmVhdGVDb21wb25lbnQoU3VzcGVuc2VDb250ZXh0LlByb3ZpZGVyLCB7XG4gICAgdmFsdWU6IHN0b3JlLFxuICAgIGdldCBjaGlsZHJlbigpIHtcbiAgICAgIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtcbiAgICAgICAgY3R4ID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICAgIGlmIChmbGlja2VyKSB7XG4gICAgICAgICAgZmxpY2tlcigpO1xuICAgICAgICAgIHJldHVybiBmbGlja2VyID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjdHggJiYgcCA9PT0gXCIkJGZcIikgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgICAgY29uc3QgcmVuZGVyZWQgPSBjcmVhdGVNZW1vKCgpID0+IHByb3BzLmNoaWxkcmVuKTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8ocHJldiA9PiB7XG4gICAgICAgICAgY29uc3QgaW5GYWxsYmFjayA9IHN0b3JlLmluRmFsbGJhY2soKSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc2hvd0NvbnRlbnQgPSB0cnVlLFxuICAgICAgICAgICAgICBzaG93RmFsbGJhY2sgPSB0cnVlXG4gICAgICAgICAgICB9ID0gc2hvdyA/IHNob3coKSA6IHt9O1xuICAgICAgICAgIGlmICgoIWluRmFsbGJhY2sgfHwgcCAmJiBwICE9PSBcIiQkZlwiKSAmJiBzaG93Q29udGVudCkge1xuICAgICAgICAgICAgc3RvcmUucmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgZGlzcG9zZSAmJiBkaXNwb3NlKCk7XG4gICAgICAgICAgICBkaXNwb3NlID0gY3R4ID0gcCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VtZUVmZmVjdHMoc3RvcmUuZWZmZWN0cyk7XG4gICAgICAgICAgICByZXR1cm4gcmVuZGVyZWQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFzaG93RmFsbGJhY2spIHJldHVybjtcbiAgICAgICAgICBpZiAoZGlzcG9zZSkgcmV0dXJuIHByZXY7XG4gICAgICAgICAgcmV0dXJuIGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZSA9IGRpc3Bvc2VyO1xuICAgICAgICAgICAgaWYgKGN0eCkge1xuICAgICAgICAgICAgICBzZXRIeWRyYXRlQ29udGV4dCh7XG4gICAgICAgICAgICAgICAgaWQ6IGN0eC5pZCArIFwiRlwiLFxuICAgICAgICAgICAgICAgIGNvdW50OiAwXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBjdHggPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcHJvcHMuZmFsbGJhY2s7XG4gICAgICAgICAgfSwgb3duZXIpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG59XG5cbmNvbnN0IERFViA9IHtcbiAgaG9va3M6IERldkhvb2tzLFxuICB3cml0ZVNpZ25hbCxcbiAgcmVnaXN0ZXJHcmFwaFxufSA7XG5pZiAoZ2xvYmFsVGhpcykge1xuICBpZiAoIWdsb2JhbFRoaXMuU29saWQkJCkgZ2xvYmFsVGhpcy5Tb2xpZCQkID0gdHJ1ZTtlbHNlIGNvbnNvbGUud2FybihcIllvdSBhcHBlYXIgdG8gaGF2ZSBtdWx0aXBsZSBpbnN0YW5jZXMgb2YgU29saWQuIFRoaXMgY2FuIGxlYWQgdG8gdW5leHBlY3RlZCBiZWhhdmlvci5cIik7XG59XG5cbmV4cG9ydCB7ICRERVZDT01QLCAkUFJPWFksICRUUkFDSywgREVWLCBFcnJvckJvdW5kYXJ5LCBGb3IsIEluZGV4LCBNYXRjaCwgU2hvdywgU3VzcGVuc2UsIFN1c3BlbnNlTGlzdCwgU3dpdGNoLCBiYXRjaCwgY2FuY2VsQ2FsbGJhY2ssIGNhdGNoRXJyb3IsIGNoaWxkcmVuLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZUNvbXB1dGVkLCBjcmVhdGVDb250ZXh0LCBjcmVhdGVEZWZlcnJlZCwgY3JlYXRlRWZmZWN0LCBjcmVhdGVNZW1vLCBjcmVhdGVSZWFjdGlvbiwgY3JlYXRlUmVuZGVyRWZmZWN0LCBjcmVhdGVSZXNvdXJjZSwgY3JlYXRlUm9vdCwgY3JlYXRlU2VsZWN0b3IsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlVW5pcXVlSWQsIGVuYWJsZUV4dGVybmFsU291cmNlLCBlbmFibGVIeWRyYXRpb24sIGVuYWJsZVNjaGVkdWxpbmcsIGVxdWFsRm4sIGZyb20sIGdldExpc3RlbmVyLCBnZXRPd25lciwgaW5kZXhBcnJheSwgbGF6eSwgbWFwQXJyYXksIG1lcmdlUHJvcHMsIG9ic2VydmFibGUsIG9uLCBvbkNsZWFudXAsIG9uRXJyb3IsIG9uTW91bnQsIHJlcXVlc3RDYWxsYmFjaywgcmVzZXRFcnJvckJvdW5kYXJpZXMsIHJ1bldpdGhPd25lciwgc2hhcmVkQ29uZmlnLCBzcGxpdFByb3BzLCBzdGFydFRyYW5zaXRpb24sIHVudHJhY2ssIHVzZUNvbnRleHQsIHVzZVRyYW5zaXRpb24gfTtcbiIsImltcG9ydCB7IGNyZWF0ZU1lbW8sIGNyZWF0ZVJvb3QsIGNyZWF0ZVJlbmRlckVmZmVjdCwgdW50cmFjaywgc2hhcmVkQ29uZmlnLCBlbmFibGVIeWRyYXRpb24sIGdldE93bmVyLCBjcmVhdGVFZmZlY3QsIHJ1bldpdGhPd25lciwgY3JlYXRlU2lnbmFsLCBvbkNsZWFudXAsICRERVZDT01QLCBzcGxpdFByb3BzIH0gZnJvbSAnc29saWQtanMnO1xuZXhwb3J0IHsgRXJyb3JCb3VuZGFyeSwgRm9yLCBJbmRleCwgTWF0Y2gsIFNob3csIFN1c3BlbnNlLCBTdXNwZW5zZUxpc3QsIFN3aXRjaCwgY3JlYXRlQ29tcG9uZW50LCBjcmVhdGVSZW5kZXJFZmZlY3QgYXMgZWZmZWN0LCBnZXRPd25lciwgbWVyZ2VQcm9wcywgdW50cmFjayB9IGZyb20gJ3NvbGlkLWpzJztcblxuY29uc3QgYm9vbGVhbnMgPSBbXCJhbGxvd2Z1bGxzY3JlZW5cIiwgXCJhc3luY1wiLCBcImF1dG9mb2N1c1wiLCBcImF1dG9wbGF5XCIsIFwiY2hlY2tlZFwiLCBcImNvbnRyb2xzXCIsIFwiZGVmYXVsdFwiLCBcImRpc2FibGVkXCIsIFwiZm9ybW5vdmFsaWRhdGVcIiwgXCJoaWRkZW5cIiwgXCJpbmRldGVybWluYXRlXCIsIFwiaW5lcnRcIiwgXCJpc21hcFwiLCBcImxvb3BcIiwgXCJtdWx0aXBsZVwiLCBcIm11dGVkXCIsIFwibm9tb2R1bGVcIiwgXCJub3ZhbGlkYXRlXCIsIFwib3BlblwiLCBcInBsYXlzaW5saW5lXCIsIFwicmVhZG9ubHlcIiwgXCJyZXF1aXJlZFwiLCBcInJldmVyc2VkXCIsIFwic2VhbWxlc3NcIiwgXCJzZWxlY3RlZFwiXTtcbmNvbnN0IFByb3BlcnRpZXMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJjbGFzc05hbWVcIiwgXCJ2YWx1ZVwiLCBcInJlYWRPbmx5XCIsIFwibm9WYWxpZGF0ZVwiLCBcImZvcm1Ob1ZhbGlkYXRlXCIsIFwiaXNNYXBcIiwgXCJub01vZHVsZVwiLCBcInBsYXlzSW5saW5lXCIsIC4uLmJvb2xlYW5zXSk7XG5jb25zdCBDaGlsZFByb3BlcnRpZXMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJpbm5lckhUTUxcIiwgXCJ0ZXh0Q29udGVudFwiLCBcImlubmVyVGV4dFwiLCBcImNoaWxkcmVuXCJdKTtcbmNvbnN0IEFsaWFzZXMgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmFzc2lnbihPYmplY3QuY3JlYXRlKG51bGwpLCB7XG4gIGNsYXNzTmFtZTogXCJjbGFzc1wiLFxuICBodG1sRm9yOiBcImZvclwiXG59KTtcbmNvbnN0IFByb3BBbGlhc2VzID0gLyojX19QVVJFX18qL09iamVjdC5hc3NpZ24oT2JqZWN0LmNyZWF0ZShudWxsKSwge1xuICBjbGFzczogXCJjbGFzc05hbWVcIixcbiAgbm92YWxpZGF0ZToge1xuICAgICQ6IFwibm9WYWxpZGF0ZVwiLFxuICAgIEZPUk06IDFcbiAgfSxcbiAgZm9ybW5vdmFsaWRhdGU6IHtcbiAgICAkOiBcImZvcm1Ob1ZhbGlkYXRlXCIsXG4gICAgQlVUVE9OOiAxLFxuICAgIElOUFVUOiAxXG4gIH0sXG4gIGlzbWFwOiB7XG4gICAgJDogXCJpc01hcFwiLFxuICAgIElNRzogMVxuICB9LFxuICBub21vZHVsZToge1xuICAgICQ6IFwibm9Nb2R1bGVcIixcbiAgICBTQ1JJUFQ6IDFcbiAgfSxcbiAgcGxheXNpbmxpbmU6IHtcbiAgICAkOiBcInBsYXlzSW5saW5lXCIsXG4gICAgVklERU86IDFcbiAgfSxcbiAgcmVhZG9ubHk6IHtcbiAgICAkOiBcInJlYWRPbmx5XCIsXG4gICAgSU5QVVQ6IDEsXG4gICAgVEVYVEFSRUE6IDFcbiAgfVxufSk7XG5mdW5jdGlvbiBnZXRQcm9wQWxpYXMocHJvcCwgdGFnTmFtZSkge1xuICBjb25zdCBhID0gUHJvcEFsaWFzZXNbcHJvcF07XG4gIHJldHVybiB0eXBlb2YgYSA9PT0gXCJvYmplY3RcIiA/IGFbdGFnTmFtZV0gPyBhW1wiJFwiXSA6IHVuZGVmaW5lZCA6IGE7XG59XG5jb25zdCBEZWxlZ2F0ZWRFdmVudHMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJiZWZvcmVpbnB1dFwiLCBcImNsaWNrXCIsIFwiZGJsY2xpY2tcIiwgXCJjb250ZXh0bWVudVwiLCBcImZvY3VzaW5cIiwgXCJmb2N1c291dFwiLCBcImlucHV0XCIsIFwia2V5ZG93blwiLCBcImtleXVwXCIsIFwibW91c2Vkb3duXCIsIFwibW91c2Vtb3ZlXCIsIFwibW91c2VvdXRcIiwgXCJtb3VzZW92ZXJcIiwgXCJtb3VzZXVwXCIsIFwicG9pbnRlcmRvd25cIiwgXCJwb2ludGVybW92ZVwiLCBcInBvaW50ZXJvdXRcIiwgXCJwb2ludGVyb3ZlclwiLCBcInBvaW50ZXJ1cFwiLCBcInRvdWNoZW5kXCIsIFwidG91Y2htb3ZlXCIsIFwidG91Y2hzdGFydFwiXSk7XG5jb25zdCBTVkdFbGVtZW50cyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcblwiYWx0R2x5cGhcIiwgXCJhbHRHbHlwaERlZlwiLCBcImFsdEdseXBoSXRlbVwiLCBcImFuaW1hdGVcIiwgXCJhbmltYXRlQ29sb3JcIiwgXCJhbmltYXRlTW90aW9uXCIsIFwiYW5pbWF0ZVRyYW5zZm9ybVwiLCBcImNpcmNsZVwiLCBcImNsaXBQYXRoXCIsIFwiY29sb3ItcHJvZmlsZVwiLCBcImN1cnNvclwiLCBcImRlZnNcIiwgXCJkZXNjXCIsIFwiZWxsaXBzZVwiLCBcImZlQmxlbmRcIiwgXCJmZUNvbG9yTWF0cml4XCIsIFwiZmVDb21wb25lbnRUcmFuc2ZlclwiLCBcImZlQ29tcG9zaXRlXCIsIFwiZmVDb252b2x2ZU1hdHJpeFwiLCBcImZlRGlmZnVzZUxpZ2h0aW5nXCIsIFwiZmVEaXNwbGFjZW1lbnRNYXBcIiwgXCJmZURpc3RhbnRMaWdodFwiLCBcImZlRHJvcFNoYWRvd1wiLCBcImZlRmxvb2RcIiwgXCJmZUZ1bmNBXCIsIFwiZmVGdW5jQlwiLCBcImZlRnVuY0dcIiwgXCJmZUZ1bmNSXCIsIFwiZmVHYXVzc2lhbkJsdXJcIiwgXCJmZUltYWdlXCIsIFwiZmVNZXJnZVwiLCBcImZlTWVyZ2VOb2RlXCIsIFwiZmVNb3JwaG9sb2d5XCIsIFwiZmVPZmZzZXRcIiwgXCJmZVBvaW50TGlnaHRcIiwgXCJmZVNwZWN1bGFyTGlnaHRpbmdcIiwgXCJmZVNwb3RMaWdodFwiLCBcImZlVGlsZVwiLCBcImZlVHVyYnVsZW5jZVwiLCBcImZpbHRlclwiLCBcImZvbnRcIiwgXCJmb250LWZhY2VcIiwgXCJmb250LWZhY2UtZm9ybWF0XCIsIFwiZm9udC1mYWNlLW5hbWVcIiwgXCJmb250LWZhY2Utc3JjXCIsIFwiZm9udC1mYWNlLXVyaVwiLCBcImZvcmVpZ25PYmplY3RcIiwgXCJnXCIsIFwiZ2x5cGhcIiwgXCJnbHlwaFJlZlwiLCBcImhrZXJuXCIsIFwiaW1hZ2VcIiwgXCJsaW5lXCIsIFwibGluZWFyR3JhZGllbnRcIiwgXCJtYXJrZXJcIiwgXCJtYXNrXCIsIFwibWV0YWRhdGFcIiwgXCJtaXNzaW5nLWdseXBoXCIsIFwibXBhdGhcIiwgXCJwYXRoXCIsIFwicGF0dGVyblwiLCBcInBvbHlnb25cIiwgXCJwb2x5bGluZVwiLCBcInJhZGlhbEdyYWRpZW50XCIsIFwicmVjdFwiLFxuXCJzZXRcIiwgXCJzdG9wXCIsXG5cInN2Z1wiLCBcInN3aXRjaFwiLCBcInN5bWJvbFwiLCBcInRleHRcIiwgXCJ0ZXh0UGF0aFwiLFxuXCJ0cmVmXCIsIFwidHNwYW5cIiwgXCJ1c2VcIiwgXCJ2aWV3XCIsIFwidmtlcm5cIl0pO1xuY29uc3QgU1ZHTmFtZXNwYWNlID0ge1xuICB4bGluazogXCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCIsXG4gIHhtbDogXCJodHRwOi8vd3d3LnczLm9yZy9YTUwvMTk5OC9uYW1lc3BhY2VcIlxufTtcbmNvbnN0IERPTUVsZW1lbnRzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1wiaHRtbFwiLCBcImJhc2VcIiwgXCJoZWFkXCIsIFwibGlua1wiLCBcIm1ldGFcIiwgXCJzdHlsZVwiLCBcInRpdGxlXCIsIFwiYm9keVwiLCBcImFkZHJlc3NcIiwgXCJhcnRpY2xlXCIsIFwiYXNpZGVcIiwgXCJmb290ZXJcIiwgXCJoZWFkZXJcIiwgXCJtYWluXCIsIFwibmF2XCIsIFwic2VjdGlvblwiLCBcImJvZHlcIiwgXCJibG9ja3F1b3RlXCIsIFwiZGRcIiwgXCJkaXZcIiwgXCJkbFwiLCBcImR0XCIsIFwiZmlnY2FwdGlvblwiLCBcImZpZ3VyZVwiLCBcImhyXCIsIFwibGlcIiwgXCJvbFwiLCBcInBcIiwgXCJwcmVcIiwgXCJ1bFwiLCBcImFcIiwgXCJhYmJyXCIsIFwiYlwiLCBcImJkaVwiLCBcImJkb1wiLCBcImJyXCIsIFwiY2l0ZVwiLCBcImNvZGVcIiwgXCJkYXRhXCIsIFwiZGZuXCIsIFwiZW1cIiwgXCJpXCIsIFwia2JkXCIsIFwibWFya1wiLCBcInFcIiwgXCJycFwiLCBcInJ0XCIsIFwicnVieVwiLCBcInNcIiwgXCJzYW1wXCIsIFwic21hbGxcIiwgXCJzcGFuXCIsIFwic3Ryb25nXCIsIFwic3ViXCIsIFwic3VwXCIsIFwidGltZVwiLCBcInVcIiwgXCJ2YXJcIiwgXCJ3YnJcIiwgXCJhcmVhXCIsIFwiYXVkaW9cIiwgXCJpbWdcIiwgXCJtYXBcIiwgXCJ0cmFja1wiLCBcInZpZGVvXCIsIFwiZW1iZWRcIiwgXCJpZnJhbWVcIiwgXCJvYmplY3RcIiwgXCJwYXJhbVwiLCBcInBpY3R1cmVcIiwgXCJwb3J0YWxcIiwgXCJzb3VyY2VcIiwgXCJzdmdcIiwgXCJtYXRoXCIsIFwiY2FudmFzXCIsIFwibm9zY3JpcHRcIiwgXCJzY3JpcHRcIiwgXCJkZWxcIiwgXCJpbnNcIiwgXCJjYXB0aW9uXCIsIFwiY29sXCIsIFwiY29sZ3JvdXBcIiwgXCJ0YWJsZVwiLCBcInRib2R5XCIsIFwidGRcIiwgXCJ0Zm9vdFwiLCBcInRoXCIsIFwidGhlYWRcIiwgXCJ0clwiLCBcImJ1dHRvblwiLCBcImRhdGFsaXN0XCIsIFwiZmllbGRzZXRcIiwgXCJmb3JtXCIsIFwiaW5wdXRcIiwgXCJsYWJlbFwiLCBcImxlZ2VuZFwiLCBcIm1ldGVyXCIsIFwib3B0Z3JvdXBcIiwgXCJvcHRpb25cIiwgXCJvdXRwdXRcIiwgXCJwcm9ncmVzc1wiLCBcInNlbGVjdFwiLCBcInRleHRhcmVhXCIsIFwiZGV0YWlsc1wiLCBcImRpYWxvZ1wiLCBcIm1lbnVcIiwgXCJzdW1tYXJ5XCIsIFwiZGV0YWlsc1wiLCBcInNsb3RcIiwgXCJ0ZW1wbGF0ZVwiLCBcImFjcm9ueW1cIiwgXCJhcHBsZXRcIiwgXCJiYXNlZm9udFwiLCBcImJnc291bmRcIiwgXCJiaWdcIiwgXCJibGlua1wiLCBcImNlbnRlclwiLCBcImNvbnRlbnRcIiwgXCJkaXJcIiwgXCJmb250XCIsIFwiZnJhbWVcIiwgXCJmcmFtZXNldFwiLCBcImhncm91cFwiLCBcImltYWdlXCIsIFwia2V5Z2VuXCIsIFwibWFycXVlZVwiLCBcIm1lbnVpdGVtXCIsIFwibm9iclwiLCBcIm5vZW1iZWRcIiwgXCJub2ZyYW1lc1wiLCBcInBsYWludGV4dFwiLCBcInJiXCIsIFwicnRjXCIsIFwic2hhZG93XCIsIFwic3BhY2VyXCIsIFwic3RyaWtlXCIsIFwidHRcIiwgXCJ4bXBcIiwgXCJhXCIsIFwiYWJiclwiLCBcImFjcm9ueW1cIiwgXCJhZGRyZXNzXCIsIFwiYXBwbGV0XCIsIFwiYXJlYVwiLCBcImFydGljbGVcIiwgXCJhc2lkZVwiLCBcImF1ZGlvXCIsIFwiYlwiLCBcImJhc2VcIiwgXCJiYXNlZm9udFwiLCBcImJkaVwiLCBcImJkb1wiLCBcImJnc291bmRcIiwgXCJiaWdcIiwgXCJibGlua1wiLCBcImJsb2NrcXVvdGVcIiwgXCJib2R5XCIsIFwiYnJcIiwgXCJidXR0b25cIiwgXCJjYW52YXNcIiwgXCJjYXB0aW9uXCIsIFwiY2VudGVyXCIsIFwiY2l0ZVwiLCBcImNvZGVcIiwgXCJjb2xcIiwgXCJjb2xncm91cFwiLCBcImNvbnRlbnRcIiwgXCJkYXRhXCIsIFwiZGF0YWxpc3RcIiwgXCJkZFwiLCBcImRlbFwiLCBcImRldGFpbHNcIiwgXCJkZm5cIiwgXCJkaWFsb2dcIiwgXCJkaXJcIiwgXCJkaXZcIiwgXCJkbFwiLCBcImR0XCIsIFwiZW1cIiwgXCJlbWJlZFwiLCBcImZpZWxkc2V0XCIsIFwiZmlnY2FwdGlvblwiLCBcImZpZ3VyZVwiLCBcImZvbnRcIiwgXCJmb290ZXJcIiwgXCJmb3JtXCIsIFwiZnJhbWVcIiwgXCJmcmFtZXNldFwiLCBcImhlYWRcIiwgXCJoZWFkZXJcIiwgXCJoZ3JvdXBcIiwgXCJoclwiLCBcImh0bWxcIiwgXCJpXCIsIFwiaWZyYW1lXCIsIFwiaW1hZ2VcIiwgXCJpbWdcIiwgXCJpbnB1dFwiLCBcImluc1wiLCBcImtiZFwiLCBcImtleWdlblwiLCBcImxhYmVsXCIsIFwibGVnZW5kXCIsIFwibGlcIiwgXCJsaW5rXCIsIFwibWFpblwiLCBcIm1hcFwiLCBcIm1hcmtcIiwgXCJtYXJxdWVlXCIsIFwibWVudVwiLCBcIm1lbnVpdGVtXCIsIFwibWV0YVwiLCBcIm1ldGVyXCIsIFwibmF2XCIsIFwibm9iclwiLCBcIm5vZW1iZWRcIiwgXCJub2ZyYW1lc1wiLCBcIm5vc2NyaXB0XCIsIFwib2JqZWN0XCIsIFwib2xcIiwgXCJvcHRncm91cFwiLCBcIm9wdGlvblwiLCBcIm91dHB1dFwiLCBcInBcIiwgXCJwYXJhbVwiLCBcInBpY3R1cmVcIiwgXCJwbGFpbnRleHRcIiwgXCJwb3J0YWxcIiwgXCJwcmVcIiwgXCJwcm9ncmVzc1wiLCBcInFcIiwgXCJyYlwiLCBcInJwXCIsIFwicnRcIiwgXCJydGNcIiwgXCJydWJ5XCIsIFwic1wiLCBcInNhbXBcIiwgXCJzY3JpcHRcIiwgXCJzZWN0aW9uXCIsIFwic2VsZWN0XCIsIFwic2hhZG93XCIsIFwic2xvdFwiLCBcInNtYWxsXCIsIFwic291cmNlXCIsIFwic3BhY2VyXCIsIFwic3BhblwiLCBcInN0cmlrZVwiLCBcInN0cm9uZ1wiLCBcInN0eWxlXCIsIFwic3ViXCIsIFwic3VtbWFyeVwiLCBcInN1cFwiLCBcInRhYmxlXCIsIFwidGJvZHlcIiwgXCJ0ZFwiLCBcInRlbXBsYXRlXCIsIFwidGV4dGFyZWFcIiwgXCJ0Zm9vdFwiLCBcInRoXCIsIFwidGhlYWRcIiwgXCJ0aW1lXCIsIFwidGl0bGVcIiwgXCJ0clwiLCBcInRyYWNrXCIsIFwidHRcIiwgXCJ1XCIsIFwidWxcIiwgXCJ2YXJcIiwgXCJ2aWRlb1wiLCBcIndiclwiLCBcInhtcFwiLCBcImlucHV0XCIsIFwiaDFcIiwgXCJoMlwiLCBcImgzXCIsIFwiaDRcIiwgXCJoNVwiLCBcImg2XCJdKTtcblxuY29uc3QgbWVtbyA9IGZuID0+IGNyZWF0ZU1lbW8oKCkgPT4gZm4oKSk7XG5cbmZ1bmN0aW9uIHJlY29uY2lsZUFycmF5cyhwYXJlbnROb2RlLCBhLCBiKSB7XG4gIGxldCBiTGVuZ3RoID0gYi5sZW5ndGgsXG4gICAgYUVuZCA9IGEubGVuZ3RoLFxuICAgIGJFbmQgPSBiTGVuZ3RoLFxuICAgIGFTdGFydCA9IDAsXG4gICAgYlN0YXJ0ID0gMCxcbiAgICBhZnRlciA9IGFbYUVuZCAtIDFdLm5leHRTaWJsaW5nLFxuICAgIG1hcCA9IG51bGw7XG4gIHdoaWxlIChhU3RhcnQgPCBhRW5kIHx8IGJTdGFydCA8IGJFbmQpIHtcbiAgICBpZiAoYVthU3RhcnRdID09PSBiW2JTdGFydF0pIHtcbiAgICAgIGFTdGFydCsrO1xuICAgICAgYlN0YXJ0Kys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgd2hpbGUgKGFbYUVuZCAtIDFdID09PSBiW2JFbmQgLSAxXSkge1xuICAgICAgYUVuZC0tO1xuICAgICAgYkVuZC0tO1xuICAgIH1cbiAgICBpZiAoYUVuZCA9PT0gYVN0YXJ0KSB7XG4gICAgICBjb25zdCBub2RlID0gYkVuZCA8IGJMZW5ndGggPyBiU3RhcnQgPyBiW2JTdGFydCAtIDFdLm5leHRTaWJsaW5nIDogYltiRW5kIC0gYlN0YXJ0XSA6IGFmdGVyO1xuICAgICAgd2hpbGUgKGJTdGFydCA8IGJFbmQpIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKGJFbmQgPT09IGJTdGFydCkge1xuICAgICAgd2hpbGUgKGFTdGFydCA8IGFFbmQpIHtcbiAgICAgICAgaWYgKCFtYXAgfHwgIW1hcC5oYXMoYVthU3RhcnRdKSkgYVthU3RhcnRdLnJlbW92ZSgpO1xuICAgICAgICBhU3RhcnQrKztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGFbYVN0YXJ0XSA9PT0gYltiRW5kIC0gMV0gJiYgYltiU3RhcnRdID09PSBhW2FFbmQgLSAxXSkge1xuICAgICAgY29uc3Qgbm9kZSA9IGFbLS1hRW5kXS5uZXh0U2libGluZztcbiAgICAgIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBhW2FTdGFydCsrXS5uZXh0U2libGluZyk7XG4gICAgICBwYXJlbnROb2RlLmluc2VydEJlZm9yZShiWy0tYkVuZF0sIG5vZGUpO1xuICAgICAgYVthRW5kXSA9IGJbYkVuZF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghbWFwKSB7XG4gICAgICAgIG1hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgbGV0IGkgPSBiU3RhcnQ7XG4gICAgICAgIHdoaWxlIChpIDwgYkVuZCkgbWFwLnNldChiW2ldLCBpKyspO1xuICAgICAgfVxuICAgICAgY29uc3QgaW5kZXggPSBtYXAuZ2V0KGFbYVN0YXJ0XSk7XG4gICAgICBpZiAoaW5kZXggIT0gbnVsbCkge1xuICAgICAgICBpZiAoYlN0YXJ0IDwgaW5kZXggJiYgaW5kZXggPCBiRW5kKSB7XG4gICAgICAgICAgbGV0IGkgPSBhU3RhcnQsXG4gICAgICAgICAgICBzZXF1ZW5jZSA9IDEsXG4gICAgICAgICAgICB0O1xuICAgICAgICAgIHdoaWxlICgrK2kgPCBhRW5kICYmIGkgPCBiRW5kKSB7XG4gICAgICAgICAgICBpZiAoKHQgPSBtYXAuZ2V0KGFbaV0pKSA9PSBudWxsIHx8IHQgIT09IGluZGV4ICsgc2VxdWVuY2UpIGJyZWFrO1xuICAgICAgICAgICAgc2VxdWVuY2UrKztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNlcXVlbmNlID4gaW5kZXggLSBiU3RhcnQpIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBhW2FTdGFydF07XG4gICAgICAgICAgICB3aGlsZSAoYlN0YXJ0IDwgaW5kZXgpIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBub2RlKTtcbiAgICAgICAgICB9IGVsc2UgcGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoYltiU3RhcnQrK10sIGFbYVN0YXJ0KytdKTtcbiAgICAgICAgfSBlbHNlIGFTdGFydCsrO1xuICAgICAgfSBlbHNlIGFbYVN0YXJ0KytdLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxufVxuXG5jb25zdCAkJEVWRU5UUyA9IFwiXyREWF9ERUxFR0FURVwiO1xuZnVuY3Rpb24gcmVuZGVyKGNvZGUsIGVsZW1lbnQsIGluaXQsIG9wdGlvbnMgPSB7fSkge1xuICBpZiAoIWVsZW1lbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYGVsZW1lbnRgIHBhc3NlZCB0byBgcmVuZGVyKC4uLiwgZWxlbWVudClgIGRvZXNuJ3QgZXhpc3QuIE1ha2Ugc3VyZSBgZWxlbWVudGAgZXhpc3RzIGluIHRoZSBkb2N1bWVudC5cIik7XG4gIH1cbiAgbGV0IGRpc3Bvc2VyO1xuICBjcmVhdGVSb290KGRpc3Bvc2UgPT4ge1xuICAgIGRpc3Bvc2VyID0gZGlzcG9zZTtcbiAgICBlbGVtZW50ID09PSBkb2N1bWVudCA/IGNvZGUoKSA6IGluc2VydChlbGVtZW50LCBjb2RlKCksIGVsZW1lbnQuZmlyc3RDaGlsZCA/IG51bGwgOiB1bmRlZmluZWQsIGluaXQpO1xuICB9LCBvcHRpb25zLm93bmVyKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBkaXNwb3NlcigpO1xuICAgIGVsZW1lbnQudGV4dENvbnRlbnQgPSBcIlwiO1xuICB9O1xufVxuZnVuY3Rpb24gdGVtcGxhdGUoaHRtbCwgaXNJbXBvcnROb2RlLCBpc1NWRywgaXNNYXRoTUwpIHtcbiAgbGV0IG5vZGU7XG4gIGNvbnN0IGNyZWF0ZSA9ICgpID0+IHtcbiAgICBpZiAoaXNIeWRyYXRpbmcoKSkgdGhyb3cgbmV3IEVycm9yKFwiRmFpbGVkIGF0dGVtcHQgdG8gY3JlYXRlIG5ldyBET00gZWxlbWVudHMgZHVyaW5nIGh5ZHJhdGlvbi4gQ2hlY2sgdGhhdCB0aGUgbGlicmFyaWVzIHlvdSBhcmUgdXNpbmcgc3VwcG9ydCBoeWRyYXRpb24uXCIpO1xuICAgIGNvbnN0IHQgPSBpc01hdGhNTCA/IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzE5OTgvTWF0aC9NYXRoTUxcIiwgXCJ0ZW1wbGF0ZVwiKSA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiKTtcbiAgICB0LmlubmVySFRNTCA9IGh0bWw7XG4gICAgcmV0dXJuIGlzU1ZHID8gdC5jb250ZW50LmZpcnN0Q2hpbGQuZmlyc3RDaGlsZCA6IGlzTWF0aE1MID8gdC5maXJzdENoaWxkIDogdC5jb250ZW50LmZpcnN0Q2hpbGQ7XG4gIH07XG4gIGNvbnN0IGZuID0gaXNJbXBvcnROb2RlID8gKCkgPT4gdW50cmFjaygoKSA9PiBkb2N1bWVudC5pbXBvcnROb2RlKG5vZGUgfHwgKG5vZGUgPSBjcmVhdGUoKSksIHRydWUpKSA6ICgpID0+IChub2RlIHx8IChub2RlID0gY3JlYXRlKCkpKS5jbG9uZU5vZGUodHJ1ZSk7XG4gIGZuLmNsb25lTm9kZSA9IGZuO1xuICByZXR1cm4gZm47XG59XG5mdW5jdGlvbiBkZWxlZ2F0ZUV2ZW50cyhldmVudE5hbWVzLCBkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudCkge1xuICBjb25zdCBlID0gZG9jdW1lbnRbJCRFVkVOVFNdIHx8IChkb2N1bWVudFskJEVWRU5UU10gPSBuZXcgU2V0KCkpO1xuICBmb3IgKGxldCBpID0gMCwgbCA9IGV2ZW50TmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgY29uc3QgbmFtZSA9IGV2ZW50TmFtZXNbaV07XG4gICAgaWYgKCFlLmhhcyhuYW1lKSkge1xuICAgICAgZS5hZGQobmFtZSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50SGFuZGxlcik7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBjbGVhckRlbGVnYXRlZEV2ZW50cyhkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudCkge1xuICBpZiAoZG9jdW1lbnRbJCRFVkVOVFNdKSB7XG4gICAgZm9yIChsZXQgbmFtZSBvZiBkb2N1bWVudFskJEVWRU5UU10ua2V5cygpKSBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50SGFuZGxlcik7XG4gICAgZGVsZXRlIGRvY3VtZW50WyQkRVZFTlRTXTtcbiAgfVxufVxuZnVuY3Rpb24gc2V0UHJvcGVydHkobm9kZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIG5vZGVbbmFtZV0gPSB2YWx1ZTtcbn1cbmZ1bmN0aW9uIHNldEF0dHJpYnV0ZShub2RlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlKG5hbWUpO2Vsc2Ugbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xufVxuZnVuY3Rpb24gc2V0QXR0cmlidXRlTlMobm9kZSwgbmFtZXNwYWNlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlTlMobmFtZXNwYWNlLCBuYW1lKTtlbHNlIG5vZGUuc2V0QXR0cmlidXRlTlMobmFtZXNwYWNlLCBuYW1lLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBzZXRCb29sQXR0cmlidXRlKG5vZGUsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICB2YWx1ZSA/IG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsIFwiXCIpIDogbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7XG59XG5mdW5jdGlvbiBjbGFzc05hbWUobm9kZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIGlmICh2YWx1ZSA9PSBudWxsKSBub2RlLnJlbW92ZUF0dHJpYnV0ZShcImNsYXNzXCIpO2Vsc2Ugbm9kZS5jbGFzc05hbWUgPSB2YWx1ZTtcbn1cbmZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXIobm9kZSwgbmFtZSwgaGFuZGxlciwgZGVsZWdhdGUpIHtcbiAgaWYgKGRlbGVnYXRlKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoaGFuZGxlcikpIHtcbiAgICAgIG5vZGVbYCQkJHtuYW1lfWBdID0gaGFuZGxlclswXTtcbiAgICAgIG5vZGVbYCQkJHtuYW1lfURhdGFgXSA9IGhhbmRsZXJbMV07XG4gICAgfSBlbHNlIG5vZGVbYCQkJHtuYW1lfWBdID0gaGFuZGxlcjtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGhhbmRsZXIpKSB7XG4gICAgY29uc3QgaGFuZGxlckZuID0gaGFuZGxlclswXTtcbiAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgaGFuZGxlclswXSA9IGUgPT4gaGFuZGxlckZuLmNhbGwobm9kZSwgaGFuZGxlclsxXSwgZSkpO1xuICB9IGVsc2Ugbm9kZS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGhhbmRsZXIsIHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIgJiYgaGFuZGxlcik7XG59XG5mdW5jdGlvbiBjbGFzc0xpc3Qobm9kZSwgdmFsdWUsIHByZXYgPSB7fSkge1xuICBjb25zdCBjbGFzc0tleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSB8fCB7fSksXG4gICAgcHJldktleXMgPSBPYmplY3Qua2V5cyhwcmV2KTtcbiAgbGV0IGksIGxlbjtcbiAgZm9yIChpID0gMCwgbGVuID0gcHJldktleXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBwcmV2S2V5c1tpXTtcbiAgICBpZiAoIWtleSB8fCBrZXkgPT09IFwidW5kZWZpbmVkXCIgfHwgdmFsdWVba2V5XSkgY29udGludWU7XG4gICAgdG9nZ2xlQ2xhc3NLZXkobm9kZSwga2V5LCBmYWxzZSk7XG4gICAgZGVsZXRlIHByZXZba2V5XTtcbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBjbGFzc0tleXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBjbGFzc0tleXNbaV0sXG4gICAgICBjbGFzc1ZhbHVlID0gISF2YWx1ZVtrZXldO1xuICAgIGlmICgha2V5IHx8IGtleSA9PT0gXCJ1bmRlZmluZWRcIiB8fCBwcmV2W2tleV0gPT09IGNsYXNzVmFsdWUgfHwgIWNsYXNzVmFsdWUpIGNvbnRpbnVlO1xuICAgIHRvZ2dsZUNsYXNzS2V5KG5vZGUsIGtleSwgdHJ1ZSk7XG4gICAgcHJldltrZXldID0gY2xhc3NWYWx1ZTtcbiAgfVxuICByZXR1cm4gcHJldjtcbn1cbmZ1bmN0aW9uIHN0eWxlKG5vZGUsIHZhbHVlLCBwcmV2KSB7XG4gIGlmICghdmFsdWUpIHJldHVybiBwcmV2ID8gc2V0QXR0cmlidXRlKG5vZGUsIFwic3R5bGVcIikgOiB2YWx1ZTtcbiAgY29uc3Qgbm9kZVN0eWxlID0gbm9kZS5zdHlsZTtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIG5vZGVTdHlsZS5jc3NUZXh0ID0gdmFsdWU7XG4gIHR5cGVvZiBwcmV2ID09PSBcInN0cmluZ1wiICYmIChub2RlU3R5bGUuY3NzVGV4dCA9IHByZXYgPSB1bmRlZmluZWQpO1xuICBwcmV2IHx8IChwcmV2ID0ge30pO1xuICB2YWx1ZSB8fCAodmFsdWUgPSB7fSk7XG4gIGxldCB2LCBzO1xuICBmb3IgKHMgaW4gcHJldikge1xuICAgIHZhbHVlW3NdID09IG51bGwgJiYgbm9kZVN0eWxlLnJlbW92ZVByb3BlcnR5KHMpO1xuICAgIGRlbGV0ZSBwcmV2W3NdO1xuICB9XG4gIGZvciAocyBpbiB2YWx1ZSkge1xuICAgIHYgPSB2YWx1ZVtzXTtcbiAgICBpZiAodiAhPT0gcHJldltzXSkge1xuICAgICAgbm9kZVN0eWxlLnNldFByb3BlcnR5KHMsIHYpO1xuICAgICAgcHJldltzXSA9IHY7XG4gICAgfVxuICB9XG4gIHJldHVybiBwcmV2O1xufVxuZnVuY3Rpb24gc3ByZWFkKG5vZGUsIHByb3BzID0ge30sIGlzU1ZHLCBza2lwQ2hpbGRyZW4pIHtcbiAgY29uc3QgcHJldlByb3BzID0ge307XG4gIGlmICghc2tpcENoaWxkcmVuKSB7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHByZXZQcm9wcy5jaGlsZHJlbiA9IGluc2VydEV4cHJlc3Npb24obm9kZSwgcHJvcHMuY2hpbGRyZW4sIHByZXZQcm9wcy5jaGlsZHJlbikpO1xuICB9XG4gIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiB0eXBlb2YgcHJvcHMucmVmID09PSBcImZ1bmN0aW9uXCIgJiYgdXNlKHByb3BzLnJlZiwgbm9kZSkpO1xuICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gYXNzaWduKG5vZGUsIHByb3BzLCBpc1NWRywgdHJ1ZSwgcHJldlByb3BzLCB0cnVlKSk7XG4gIHJldHVybiBwcmV2UHJvcHM7XG59XG5mdW5jdGlvbiBkeW5hbWljUHJvcGVydHkocHJvcHMsIGtleSkge1xuICBjb25zdCBzcmMgPSBwcm9wc1trZXldO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvcHMsIGtleSwge1xuICAgIGdldCgpIHtcbiAgICAgIHJldHVybiBzcmMoKTtcbiAgICB9LFxuICAgIGVudW1lcmFibGU6IHRydWVcbiAgfSk7XG4gIHJldHVybiBwcm9wcztcbn1cbmZ1bmN0aW9uIHVzZShmbiwgZWxlbWVudCwgYXJnKSB7XG4gIHJldHVybiB1bnRyYWNrKCgpID0+IGZuKGVsZW1lbnQsIGFyZykpO1xufVxuZnVuY3Rpb24gaW5zZXJ0KHBhcmVudCwgYWNjZXNzb3IsIG1hcmtlciwgaW5pdGlhbCkge1xuICBpZiAobWFya2VyICE9PSB1bmRlZmluZWQgJiYgIWluaXRpYWwpIGluaXRpYWwgPSBbXTtcbiAgaWYgKHR5cGVvZiBhY2Nlc3NvciAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm4gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIGFjY2Vzc29yLCBpbml0aWFsLCBtYXJrZXIpO1xuICBjcmVhdGVSZW5kZXJFZmZlY3QoY3VycmVudCA9PiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgYWNjZXNzb3IoKSwgY3VycmVudCwgbWFya2VyKSwgaW5pdGlhbCk7XG59XG5mdW5jdGlvbiBhc3NpZ24obm9kZSwgcHJvcHMsIGlzU1ZHLCBza2lwQ2hpbGRyZW4sIHByZXZQcm9wcyA9IHt9LCBza2lwUmVmID0gZmFsc2UpIHtcbiAgcHJvcHMgfHwgKHByb3BzID0ge30pO1xuICBmb3IgKGNvbnN0IHByb3AgaW4gcHJldlByb3BzKSB7XG4gICAgaWYgKCEocHJvcCBpbiBwcm9wcykpIHtcbiAgICAgIGlmIChwcm9wID09PSBcImNoaWxkcmVuXCIpIGNvbnRpbnVlO1xuICAgICAgcHJldlByb3BzW3Byb3BdID0gYXNzaWduUHJvcChub2RlLCBwcm9wLCBudWxsLCBwcmV2UHJvcHNbcHJvcF0sIGlzU1ZHLCBza2lwUmVmLCBwcm9wcyk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgcHJvcCBpbiBwcm9wcykge1xuICAgIGlmIChwcm9wID09PSBcImNoaWxkcmVuXCIpIHtcbiAgICAgIGlmICghc2tpcENoaWxkcmVuKSBpbnNlcnRFeHByZXNzaW9uKG5vZGUsIHByb3BzLmNoaWxkcmVuKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZSA9IHByb3BzW3Byb3BdO1xuICAgIHByZXZQcm9wc1twcm9wXSA9IGFzc2lnblByb3Aobm9kZSwgcHJvcCwgdmFsdWUsIHByZXZQcm9wc1twcm9wXSwgaXNTVkcsIHNraXBSZWYsIHByb3BzKTtcbiAgfVxufVxuZnVuY3Rpb24gaHlkcmF0ZSQxKGNvZGUsIGVsZW1lbnQsIG9wdGlvbnMgPSB7fSkge1xuICBpZiAoZ2xvYmFsVGhpcy5fJEhZLmRvbmUpIHJldHVybiByZW5kZXIoY29kZSwgZWxlbWVudCwgWy4uLmVsZW1lbnQuY2hpbGROb2Rlc10sIG9wdGlvbnMpO1xuICBzaGFyZWRDb25maWcuY29tcGxldGVkID0gZ2xvYmFsVGhpcy5fJEhZLmNvbXBsZXRlZDtcbiAgc2hhcmVkQ29uZmlnLmV2ZW50cyA9IGdsb2JhbFRoaXMuXyRIWS5ldmVudHM7XG4gIHNoYXJlZENvbmZpZy5sb2FkID0gaWQgPT4gZ2xvYmFsVGhpcy5fJEhZLnJbaWRdO1xuICBzaGFyZWRDb25maWcuaGFzID0gaWQgPT4gaWQgaW4gZ2xvYmFsVGhpcy5fJEhZLnI7XG4gIHNoYXJlZENvbmZpZy5nYXRoZXIgPSByb290ID0+IGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgcm9vdCk7XG4gIHNoYXJlZENvbmZpZy5yZWdpc3RyeSA9IG5ldyBNYXAoKTtcbiAgc2hhcmVkQ29uZmlnLmNvbnRleHQgPSB7XG4gICAgaWQ6IG9wdGlvbnMucmVuZGVySWQgfHwgXCJcIixcbiAgICBjb3VudDogMFxuICB9O1xuICB0cnkge1xuICAgIGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgb3B0aW9ucy5yZW5kZXJJZCk7XG4gICAgcmV0dXJuIHJlbmRlcihjb2RlLCBlbGVtZW50LCBbLi4uZWxlbWVudC5jaGlsZE5vZGVzXSwgb3B0aW9ucyk7XG4gIH0gZmluYWxseSB7XG4gICAgc2hhcmVkQ29uZmlnLmNvbnRleHQgPSBudWxsO1xuICB9XG59XG5mdW5jdGlvbiBnZXROZXh0RWxlbWVudCh0ZW1wbGF0ZSkge1xuICBsZXQgbm9kZSxcbiAgICBrZXksXG4gICAgaHlkcmF0aW5nID0gaXNIeWRyYXRpbmcoKTtcbiAgaWYgKCFoeWRyYXRpbmcgfHwgIShub2RlID0gc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LmdldChrZXkgPSBnZXRIeWRyYXRpb25LZXkoKSkpKSB7XG4gICAgaWYgKGh5ZHJhdGluZykge1xuICAgICAgc2hhcmVkQ29uZmlnLmRvbmUgPSB0cnVlO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBIeWRyYXRpb24gTWlzbWF0Y2guIFVuYWJsZSB0byBmaW5kIERPTSBub2RlcyBmb3IgaHlkcmF0aW9uIGtleTogJHtrZXl9XFxuJHt0ZW1wbGF0ZSA/IHRlbXBsYXRlKCkub3V0ZXJIVE1MIDogXCJcIn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRlbXBsYXRlKCk7XG4gIH1cbiAgaWYgKHNoYXJlZENvbmZpZy5jb21wbGV0ZWQpIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQuYWRkKG5vZGUpO1xuICBzaGFyZWRDb25maWcucmVnaXN0cnkuZGVsZXRlKGtleSk7XG4gIHJldHVybiBub2RlO1xufVxuZnVuY3Rpb24gZ2V0TmV4dE1hdGNoKGVsLCBub2RlTmFtZSkge1xuICB3aGlsZSAoZWwgJiYgZWwubG9jYWxOYW1lICE9PSBub2RlTmFtZSkgZWwgPSBlbC5uZXh0U2libGluZztcbiAgcmV0dXJuIGVsO1xufVxuZnVuY3Rpb24gZ2V0TmV4dE1hcmtlcihzdGFydCkge1xuICBsZXQgZW5kID0gc3RhcnQsXG4gICAgY291bnQgPSAwLFxuICAgIGN1cnJlbnQgPSBbXTtcbiAgaWYgKGlzSHlkcmF0aW5nKHN0YXJ0KSkge1xuICAgIHdoaWxlIChlbmQpIHtcbiAgICAgIGlmIChlbmQubm9kZVR5cGUgPT09IDgpIHtcbiAgICAgICAgY29uc3QgdiA9IGVuZC5ub2RlVmFsdWU7XG4gICAgICAgIGlmICh2ID09PSBcIiRcIikgY291bnQrKztlbHNlIGlmICh2ID09PSBcIi9cIikge1xuICAgICAgICAgIGlmIChjb3VudCA9PT0gMCkgcmV0dXJuIFtlbmQsIGN1cnJlbnRdO1xuICAgICAgICAgIGNvdW50LS07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGN1cnJlbnQucHVzaChlbmQpO1xuICAgICAgZW5kID0gZW5kLm5leHRTaWJsaW5nO1xuICAgIH1cbiAgfVxuICByZXR1cm4gW2VuZCwgY3VycmVudF07XG59XG5mdW5jdGlvbiBydW5IeWRyYXRpb25FdmVudHMoKSB7XG4gIGlmIChzaGFyZWRDb25maWcuZXZlbnRzICYmICFzaGFyZWRDb25maWcuZXZlbnRzLnF1ZXVlZCkge1xuICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgY29tcGxldGVkLFxuICAgICAgICBldmVudHNcbiAgICAgIH0gPSBzaGFyZWRDb25maWc7XG4gICAgICBpZiAoIWV2ZW50cykgcmV0dXJuO1xuICAgICAgZXZlbnRzLnF1ZXVlZCA9IGZhbHNlO1xuICAgICAgd2hpbGUgKGV2ZW50cy5sZW5ndGgpIHtcbiAgICAgICAgY29uc3QgW2VsLCBlXSA9IGV2ZW50c1swXTtcbiAgICAgICAgaWYgKCFjb21wbGV0ZWQuaGFzKGVsKSkgcmV0dXJuO1xuICAgICAgICBldmVudHMuc2hpZnQoKTtcbiAgICAgICAgZXZlbnRIYW5kbGVyKGUpO1xuICAgICAgfVxuICAgICAgaWYgKHNoYXJlZENvbmZpZy5kb25lKSB7XG4gICAgICAgIHNoYXJlZENvbmZpZy5ldmVudHMgPSBfJEhZLmV2ZW50cyA9IG51bGw7XG4gICAgICAgIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQgPSBfJEhZLmNvbXBsZXRlZCA9IG51bGw7XG4gICAgICB9XG4gICAgfSk7XG4gICAgc2hhcmVkQ29uZmlnLmV2ZW50cy5xdWV1ZWQgPSB0cnVlO1xuICB9XG59XG5mdW5jdGlvbiBpc0h5ZHJhdGluZyhub2RlKSB7XG4gIHJldHVybiAhIXNoYXJlZENvbmZpZy5jb250ZXh0ICYmICFzaGFyZWRDb25maWcuZG9uZSAmJiAoIW5vZGUgfHwgbm9kZS5pc0Nvbm5lY3RlZCk7XG59XG5mdW5jdGlvbiB0b1Byb3BlcnR5TmFtZShuYW1lKSB7XG4gIHJldHVybiBuYW1lLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvLShbYS16XSkvZywgKF8sIHcpID0+IHcudG9VcHBlckNhc2UoKSk7XG59XG5mdW5jdGlvbiB0b2dnbGVDbGFzc0tleShub2RlLCBrZXksIHZhbHVlKSB7XG4gIGNvbnN0IGNsYXNzTmFtZXMgPSBrZXkudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gIGZvciAobGV0IGkgPSAwLCBuYW1lTGVuID0gY2xhc3NOYW1lcy5sZW5ndGg7IGkgPCBuYW1lTGVuOyBpKyspIG5vZGUuY2xhc3NMaXN0LnRvZ2dsZShjbGFzc05hbWVzW2ldLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBhc3NpZ25Qcm9wKG5vZGUsIHByb3AsIHZhbHVlLCBwcmV2LCBpc1NWRywgc2tpcFJlZiwgcHJvcHMpIHtcbiAgbGV0IGlzQ0UsIGlzUHJvcCwgaXNDaGlsZFByb3AsIHByb3BBbGlhcywgZm9yY2VQcm9wO1xuICBpZiAocHJvcCA9PT0gXCJzdHlsZVwiKSByZXR1cm4gc3R5bGUobm9kZSwgdmFsdWUsIHByZXYpO1xuICBpZiAocHJvcCA9PT0gXCJjbGFzc0xpc3RcIikgcmV0dXJuIGNsYXNzTGlzdChub2RlLCB2YWx1ZSwgcHJldik7XG4gIGlmICh2YWx1ZSA9PT0gcHJldikgcmV0dXJuIHByZXY7XG4gIGlmIChwcm9wID09PSBcInJlZlwiKSB7XG4gICAgaWYgKCFza2lwUmVmKSB2YWx1ZShub2RlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDMpID09PSBcIm9uOlwiKSB7XG4gICAgY29uc3QgZSA9IHByb3Auc2xpY2UoMyk7XG4gICAgcHJldiAmJiBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoZSwgcHJldiwgdHlwZW9mIHByZXYgIT09IFwiZnVuY3Rpb25cIiAmJiBwcmV2KTtcbiAgICB2YWx1ZSAmJiBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZSwgdmFsdWUsIHR5cGVvZiB2YWx1ZSAhPT0gXCJmdW5jdGlvblwiICYmIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDEwKSA9PT0gXCJvbmNhcHR1cmU6XCIpIHtcbiAgICBjb25zdCBlID0gcHJvcC5zbGljZSgxMCk7XG4gICAgcHJldiAmJiBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoZSwgcHJldiwgdHJ1ZSk7XG4gICAgdmFsdWUgJiYgbm9kZS5hZGRFdmVudExpc3RlbmVyKGUsIHZhbHVlLCB0cnVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDIpID09PSBcIm9uXCIpIHtcbiAgICBjb25zdCBuYW1lID0gcHJvcC5zbGljZSgyKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGRlbGVnYXRlID0gRGVsZWdhdGVkRXZlbnRzLmhhcyhuYW1lKTtcbiAgICBpZiAoIWRlbGVnYXRlICYmIHByZXYpIHtcbiAgICAgIGNvbnN0IGggPSBBcnJheS5pc0FycmF5KHByZXYpID8gcHJldlswXSA6IHByZXY7XG4gICAgICBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgaCk7XG4gICAgfVxuICAgIGlmIChkZWxlZ2F0ZSB8fCB2YWx1ZSkge1xuICAgICAgYWRkRXZlbnRMaXN0ZW5lcihub2RlLCBuYW1lLCB2YWx1ZSwgZGVsZWdhdGUpO1xuICAgICAgZGVsZWdhdGUgJiYgZGVsZWdhdGVFdmVudHMoW25hbWVdKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCA1KSA9PT0gXCJhdHRyOlwiKSB7XG4gICAgc2V0QXR0cmlidXRlKG5vZGUsIHByb3Auc2xpY2UoNSksIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDUpID09PSBcImJvb2w6XCIpIHtcbiAgICBzZXRCb29sQXR0cmlidXRlKG5vZGUsIHByb3Auc2xpY2UoNSksIHZhbHVlKTtcbiAgfSBlbHNlIGlmICgoZm9yY2VQcm9wID0gcHJvcC5zbGljZSgwLCA1KSA9PT0gXCJwcm9wOlwiKSB8fCAoaXNDaGlsZFByb3AgPSBDaGlsZFByb3BlcnRpZXMuaGFzKHByb3ApKSB8fCAhaXNTVkcgJiYgKChwcm9wQWxpYXMgPSBnZXRQcm9wQWxpYXMocHJvcCwgbm9kZS50YWdOYW1lKSkgfHwgKGlzUHJvcCA9IFByb3BlcnRpZXMuaGFzKHByb3ApKSkgfHwgKGlzQ0UgPSBub2RlLm5vZGVOYW1lLmluY2x1ZGVzKFwiLVwiKSB8fCBcImlzXCIgaW4gcHJvcHMpKSB7XG4gICAgaWYgKGZvcmNlUHJvcCkge1xuICAgICAgcHJvcCA9IHByb3Auc2xpY2UoNSk7XG4gICAgICBpc1Byb3AgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybiB2YWx1ZTtcbiAgICBpZiAocHJvcCA9PT0gXCJjbGFzc1wiIHx8IHByb3AgPT09IFwiY2xhc3NOYW1lXCIpIGNsYXNzTmFtZShub2RlLCB2YWx1ZSk7ZWxzZSBpZiAoaXNDRSAmJiAhaXNQcm9wICYmICFpc0NoaWxkUHJvcCkgbm9kZVt0b1Byb3BlcnR5TmFtZShwcm9wKV0gPSB2YWx1ZTtlbHNlIG5vZGVbcHJvcEFsaWFzIHx8IHByb3BdID0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgbnMgPSBpc1NWRyAmJiBwcm9wLmluZGV4T2YoXCI6XCIpID4gLTEgJiYgU1ZHTmFtZXNwYWNlW3Byb3Auc3BsaXQoXCI6XCIpWzBdXTtcbiAgICBpZiAobnMpIHNldEF0dHJpYnV0ZU5TKG5vZGUsIG5zLCBwcm9wLCB2YWx1ZSk7ZWxzZSBzZXRBdHRyaWJ1dGUobm9kZSwgQWxpYXNlc1twcm9wXSB8fCBwcm9wLCB2YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gZXZlbnRIYW5kbGVyKGUpIHtcbiAgaWYgKHNoYXJlZENvbmZpZy5yZWdpc3RyeSAmJiBzaGFyZWRDb25maWcuZXZlbnRzKSB7XG4gICAgaWYgKHNoYXJlZENvbmZpZy5ldmVudHMuZmluZCgoW2VsLCBldl0pID0+IGV2ID09PSBlKSkgcmV0dXJuO1xuICB9XG4gIGxldCBub2RlID0gZS50YXJnZXQ7XG4gIGNvbnN0IGtleSA9IGAkJCR7ZS50eXBlfWA7XG4gIGNvbnN0IG9yaVRhcmdldCA9IGUudGFyZ2V0O1xuICBjb25zdCBvcmlDdXJyZW50VGFyZ2V0ID0gZS5jdXJyZW50VGFyZ2V0O1xuICBjb25zdCByZXRhcmdldCA9IHZhbHVlID0+IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlLCBcInRhcmdldFwiLCB7XG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHZhbHVlXG4gIH0pO1xuICBjb25zdCBoYW5kbGVOb2RlID0gKCkgPT4ge1xuICAgIGNvbnN0IGhhbmRsZXIgPSBub2RlW2tleV07XG4gICAgaWYgKGhhbmRsZXIgJiYgIW5vZGUuZGlzYWJsZWQpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSBub2RlW2Ake2tleX1EYXRhYF07XG4gICAgICBkYXRhICE9PSB1bmRlZmluZWQgPyBoYW5kbGVyLmNhbGwobm9kZSwgZGF0YSwgZSkgOiBoYW5kbGVyLmNhbGwobm9kZSwgZSk7XG4gICAgICBpZiAoZS5jYW5jZWxCdWJibGUpIHJldHVybjtcbiAgICB9XG4gICAgbm9kZS5ob3N0ICYmIHR5cGVvZiBub2RlLmhvc3QgIT09IFwic3RyaW5nXCIgJiYgIW5vZGUuaG9zdC5fJGhvc3QgJiYgbm9kZS5jb250YWlucyhlLnRhcmdldCkgJiYgcmV0YXJnZXQobm9kZS5ob3N0KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbiAgY29uc3Qgd2Fsa1VwVHJlZSA9ICgpID0+IHtcbiAgICB3aGlsZSAoaGFuZGxlTm9kZSgpICYmIChub2RlID0gbm9kZS5fJGhvc3QgfHwgbm9kZS5wYXJlbnROb2RlIHx8IG5vZGUuaG9zdCkpO1xuICB9O1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZSwgXCJjdXJyZW50VGFyZ2V0XCIsIHtcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgZ2V0KCkge1xuICAgICAgcmV0dXJuIG5vZGUgfHwgZG9jdW1lbnQ7XG4gICAgfVxuICB9KTtcbiAgaWYgKHNoYXJlZENvbmZpZy5yZWdpc3RyeSAmJiAhc2hhcmVkQ29uZmlnLmRvbmUpIHNoYXJlZENvbmZpZy5kb25lID0gXyRIWS5kb25lID0gdHJ1ZTtcbiAgaWYgKGUuY29tcG9zZWRQYXRoKSB7XG4gICAgY29uc3QgcGF0aCA9IGUuY29tcG9zZWRQYXRoKCk7XG4gICAgcmV0YXJnZXQocGF0aFswXSk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXRoLmxlbmd0aCAtIDI7IGkrKykge1xuICAgICAgbm9kZSA9IHBhdGhbaV07XG4gICAgICBpZiAoIWhhbmRsZU5vZGUoKSkgYnJlYWs7XG4gICAgICBpZiAobm9kZS5fJGhvc3QpIHtcbiAgICAgICAgbm9kZSA9IG5vZGUuXyRob3N0O1xuICAgICAgICB3YWxrVXBUcmVlKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKG5vZGUucGFyZW50Tm9kZSA9PT0gb3JpQ3VycmVudFRhcmdldCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZWxzZSB3YWxrVXBUcmVlKCk7XG4gIHJldGFyZ2V0KG9yaVRhcmdldCk7XG59XG5mdW5jdGlvbiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgdmFsdWUsIGN1cnJlbnQsIG1hcmtlciwgdW53cmFwQXJyYXkpIHtcbiAgY29uc3QgaHlkcmF0aW5nID0gaXNIeWRyYXRpbmcocGFyZW50KTtcbiAgaWYgKGh5ZHJhdGluZykge1xuICAgICFjdXJyZW50ICYmIChjdXJyZW50ID0gWy4uLnBhcmVudC5jaGlsZE5vZGVzXSk7XG4gICAgbGV0IGNsZWFuZWQgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGN1cnJlbnQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBjdXJyZW50W2ldO1xuICAgICAgaWYgKG5vZGUubm9kZVR5cGUgPT09IDggJiYgbm9kZS5kYXRhLnNsaWNlKDAsIDIpID09PSBcIiEkXCIpIG5vZGUucmVtb3ZlKCk7ZWxzZSBjbGVhbmVkLnB1c2gobm9kZSk7XG4gICAgfVxuICAgIGN1cnJlbnQgPSBjbGVhbmVkO1xuICB9XG4gIHdoaWxlICh0eXBlb2YgY3VycmVudCA9PT0gXCJmdW5jdGlvblwiKSBjdXJyZW50ID0gY3VycmVudCgpO1xuICBpZiAodmFsdWUgPT09IGN1cnJlbnQpIHJldHVybiBjdXJyZW50O1xuICBjb25zdCB0ID0gdHlwZW9mIHZhbHVlLFxuICAgIG11bHRpID0gbWFya2VyICE9PSB1bmRlZmluZWQ7XG4gIHBhcmVudCA9IG11bHRpICYmIGN1cnJlbnRbMF0gJiYgY3VycmVudFswXS5wYXJlbnROb2RlIHx8IHBhcmVudDtcbiAgaWYgKHQgPT09IFwic3RyaW5nXCIgfHwgdCA9PT0gXCJudW1iZXJcIikge1xuICAgIGlmIChoeWRyYXRpbmcpIHJldHVybiBjdXJyZW50O1xuICAgIGlmICh0ID09PSBcIm51bWJlclwiKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICBpZiAodmFsdWUgPT09IGN1cnJlbnQpIHJldHVybiBjdXJyZW50O1xuICAgIH1cbiAgICBpZiAobXVsdGkpIHtcbiAgICAgIGxldCBub2RlID0gY3VycmVudFswXTtcbiAgICAgIGlmIChub2RlICYmIG5vZGUubm9kZVR5cGUgPT09IDMpIHtcbiAgICAgICAgbm9kZS5kYXRhICE9PSB2YWx1ZSAmJiAobm9kZS5kYXRhID0gdmFsdWUpO1xuICAgICAgfSBlbHNlIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh2YWx1ZSk7XG4gICAgICBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgbm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChjdXJyZW50ICE9PSBcIlwiICYmIHR5cGVvZiBjdXJyZW50ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGN1cnJlbnQgPSBwYXJlbnQuZmlyc3RDaGlsZC5kYXRhID0gdmFsdWU7XG4gICAgICB9IGVsc2UgY3VycmVudCA9IHBhcmVudC50ZXh0Q29udGVudCA9IHZhbHVlO1xuICAgIH1cbiAgfSBlbHNlIGlmICh2YWx1ZSA9PSBudWxsIHx8IHQgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgaWYgKGh5ZHJhdGluZykgcmV0dXJuIGN1cnJlbnQ7XG4gICAgY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIpO1xuICB9IGVsc2UgaWYgKHQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiB7XG4gICAgICBsZXQgdiA9IHZhbHVlKCk7XG4gICAgICB3aGlsZSAodHlwZW9mIHYgPT09IFwiZnVuY3Rpb25cIikgdiA9IHYoKTtcbiAgICAgIGN1cnJlbnQgPSBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgdiwgY3VycmVudCwgbWFya2VyKTtcbiAgICB9KTtcbiAgICByZXR1cm4gKCkgPT4gY3VycmVudDtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIGNvbnN0IGFycmF5ID0gW107XG4gICAgY29uc3QgY3VycmVudEFycmF5ID0gY3VycmVudCAmJiBBcnJheS5pc0FycmF5KGN1cnJlbnQpO1xuICAgIGlmIChub3JtYWxpemVJbmNvbWluZ0FycmF5KGFycmF5LCB2YWx1ZSwgY3VycmVudCwgdW53cmFwQXJyYXkpKSB7XG4gICAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gY3VycmVudCA9IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCBhcnJheSwgY3VycmVudCwgbWFya2VyLCB0cnVlKSk7XG4gICAgICByZXR1cm4gKCkgPT4gY3VycmVudDtcbiAgICB9XG4gICAgaWYgKGh5ZHJhdGluZykge1xuICAgICAgaWYgKCFhcnJheS5sZW5ndGgpIHJldHVybiBjdXJyZW50O1xuICAgICAgaWYgKG1hcmtlciA9PT0gdW5kZWZpbmVkKSByZXR1cm4gY3VycmVudCA9IFsuLi5wYXJlbnQuY2hpbGROb2Rlc107XG4gICAgICBsZXQgbm9kZSA9IGFycmF5WzBdO1xuICAgICAgaWYgKG5vZGUucGFyZW50Tm9kZSAhPT0gcGFyZW50KSByZXR1cm4gY3VycmVudDtcbiAgICAgIGNvbnN0IG5vZGVzID0gW25vZGVdO1xuICAgICAgd2hpbGUgKChub2RlID0gbm9kZS5uZXh0U2libGluZykgIT09IG1hcmtlcikgbm9kZXMucHVzaChub2RlKTtcbiAgICAgIHJldHVybiBjdXJyZW50ID0gbm9kZXM7XG4gICAgfVxuICAgIGlmIChhcnJheS5sZW5ndGggPT09IDApIHtcbiAgICAgIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyKTtcbiAgICAgIGlmIChtdWx0aSkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgfSBlbHNlIGlmIChjdXJyZW50QXJyYXkpIHtcbiAgICAgIGlmIChjdXJyZW50Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBhcHBlbmROb2RlcyhwYXJlbnQsIGFycmF5LCBtYXJrZXIpO1xuICAgICAgfSBlbHNlIHJlY29uY2lsZUFycmF5cyhwYXJlbnQsIGN1cnJlbnQsIGFycmF5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY3VycmVudCAmJiBjbGVhbkNoaWxkcmVuKHBhcmVudCk7XG4gICAgICBhcHBlbmROb2RlcyhwYXJlbnQsIGFycmF5KTtcbiAgICB9XG4gICAgY3VycmVudCA9IGFycmF5O1xuICB9IGVsc2UgaWYgKHZhbHVlLm5vZGVUeXBlKSB7XG4gICAgaWYgKGh5ZHJhdGluZyAmJiB2YWx1ZS5wYXJlbnROb2RlKSByZXR1cm4gY3VycmVudCA9IG11bHRpID8gW3ZhbHVlXSA6IHZhbHVlO1xuICAgIGlmIChBcnJheS5pc0FycmF5KGN1cnJlbnQpKSB7XG4gICAgICBpZiAobXVsdGkpIHJldHVybiBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgdmFsdWUpO1xuICAgICAgY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG51bGwsIHZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnQgPT0gbnVsbCB8fCBjdXJyZW50ID09PSBcIlwiIHx8ICFwYXJlbnQuZmlyc3RDaGlsZCkge1xuICAgICAgcGFyZW50LmFwcGVuZENoaWxkKHZhbHVlKTtcbiAgICB9IGVsc2UgcGFyZW50LnJlcGxhY2VDaGlsZCh2YWx1ZSwgcGFyZW50LmZpcnN0Q2hpbGQpO1xuICAgIGN1cnJlbnQgPSB2YWx1ZTtcbiAgfSBlbHNlIGNvbnNvbGUud2FybihgVW5yZWNvZ25pemVkIHZhbHVlLiBTa2lwcGVkIGluc2VydGluZ2AsIHZhbHVlKTtcbiAgcmV0dXJuIGN1cnJlbnQ7XG59XG5mdW5jdGlvbiBub3JtYWxpemVJbmNvbWluZ0FycmF5KG5vcm1hbGl6ZWQsIGFycmF5LCBjdXJyZW50LCB1bndyYXApIHtcbiAgbGV0IGR5bmFtaWMgPSBmYWxzZTtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgbGV0IGl0ZW0gPSBhcnJheVtpXSxcbiAgICAgIHByZXYgPSBjdXJyZW50ICYmIGN1cnJlbnRbbm9ybWFsaXplZC5sZW5ndGhdLFxuICAgICAgdDtcbiAgICBpZiAoaXRlbSA9PSBudWxsIHx8IGl0ZW0gPT09IHRydWUgfHwgaXRlbSA9PT0gZmFsc2UpIDsgZWxzZSBpZiAoKHQgPSB0eXBlb2YgaXRlbSkgPT09IFwib2JqZWN0XCIgJiYgaXRlbS5ub2RlVHlwZSkge1xuICAgICAgbm9ybWFsaXplZC5wdXNoKGl0ZW0pO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShpdGVtKSkge1xuICAgICAgZHluYW1pYyA9IG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgaXRlbSwgcHJldikgfHwgZHluYW1pYztcbiAgICB9IGVsc2UgaWYgKHQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgaWYgKHVud3JhcCkge1xuICAgICAgICB3aGlsZSAodHlwZW9mIGl0ZW0gPT09IFwiZnVuY3Rpb25cIikgaXRlbSA9IGl0ZW0oKTtcbiAgICAgICAgZHluYW1pYyA9IG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgQXJyYXkuaXNBcnJheShpdGVtKSA/IGl0ZW0gOiBbaXRlbV0sIEFycmF5LmlzQXJyYXkocHJldikgPyBwcmV2IDogW3ByZXZdKSB8fCBkeW5hbWljO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9ybWFsaXplZC5wdXNoKGl0ZW0pO1xuICAgICAgICBkeW5hbWljID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdmFsdWUgPSBTdHJpbmcoaXRlbSk7XG4gICAgICBpZiAocHJldiAmJiBwcmV2Lm5vZGVUeXBlID09PSAzICYmIHByZXYuZGF0YSA9PT0gdmFsdWUpIG5vcm1hbGl6ZWQucHVzaChwcmV2KTtlbHNlIG5vcm1hbGl6ZWQucHVzaChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh2YWx1ZSkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZHluYW1pYztcbn1cbmZ1bmN0aW9uIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXksIG1hcmtlciA9IG51bGwpIHtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSBwYXJlbnQuaW5zZXJ0QmVmb3JlKGFycmF5W2ldLCBtYXJrZXIpO1xufVxuZnVuY3Rpb24gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgcmVwbGFjZW1lbnQpIHtcbiAgaWYgKG1hcmtlciA9PT0gdW5kZWZpbmVkKSByZXR1cm4gcGFyZW50LnRleHRDb250ZW50ID0gXCJcIjtcbiAgY29uc3Qgbm9kZSA9IHJlcGxhY2VtZW50IHx8IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXCIpO1xuICBpZiAoY3VycmVudC5sZW5ndGgpIHtcbiAgICBsZXQgaW5zZXJ0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gY3VycmVudC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgZWwgPSBjdXJyZW50W2ldO1xuICAgICAgaWYgKG5vZGUgIT09IGVsKSB7XG4gICAgICAgIGNvbnN0IGlzUGFyZW50ID0gZWwucGFyZW50Tm9kZSA9PT0gcGFyZW50O1xuICAgICAgICBpZiAoIWluc2VydGVkICYmICFpKSBpc1BhcmVudCA/IHBhcmVudC5yZXBsYWNlQ2hpbGQobm9kZSwgZWwpIDogcGFyZW50Lmluc2VydEJlZm9yZShub2RlLCBtYXJrZXIpO2Vsc2UgaXNQYXJlbnQgJiYgZWwucmVtb3ZlKCk7XG4gICAgICB9IGVsc2UgaW5zZXJ0ZWQgPSB0cnVlO1xuICAgIH1cbiAgfSBlbHNlIHBhcmVudC5pbnNlcnRCZWZvcmUobm9kZSwgbWFya2VyKTtcbiAgcmV0dXJuIFtub2RlXTtcbn1cbmZ1bmN0aW9uIGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgcm9vdCkge1xuICBjb25zdCB0ZW1wbGF0ZXMgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoYCpbZGF0YS1oa11gKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wbGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBub2RlID0gdGVtcGxhdGVzW2ldO1xuICAgIGNvbnN0IGtleSA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiZGF0YS1oa1wiKTtcbiAgICBpZiAoKCFyb290IHx8IGtleS5zdGFydHNXaXRoKHJvb3QpKSAmJiAhc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LmhhcyhrZXkpKSBzaGFyZWRDb25maWcucmVnaXN0cnkuc2V0KGtleSwgbm9kZSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGdldEh5ZHJhdGlvbktleSgpIHtcbiAgcmV0dXJuIHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCk7XG59XG5mdW5jdGlvbiBOb0h5ZHJhdGlvbihwcm9wcykge1xuICByZXR1cm4gc2hhcmVkQ29uZmlnLmNvbnRleHQgPyB1bmRlZmluZWQgOiBwcm9wcy5jaGlsZHJlbjtcbn1cbmZ1bmN0aW9uIEh5ZHJhdGlvbihwcm9wcykge1xuICByZXR1cm4gcHJvcHMuY2hpbGRyZW47XG59XG5jb25zdCB2b2lkRm4gPSAoKSA9PiB1bmRlZmluZWQ7XG5jb25zdCBSZXF1ZXN0Q29udGV4dCA9IFN5bWJvbCgpO1xuZnVuY3Rpb24gaW5uZXJIVE1MKHBhcmVudCwgY29udGVudCkge1xuICAhc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgKHBhcmVudC5pbm5lckhUTUwgPSBjb250ZW50KTtcbn1cblxuZnVuY3Rpb24gdGhyb3dJbkJyb3dzZXIoZnVuYykge1xuICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYCR7ZnVuYy5uYW1lfSBpcyBub3Qgc3VwcG9ydGVkIGluIHRoZSBicm93c2VyLCByZXR1cm5pbmcgdW5kZWZpbmVkYCk7XG4gIGNvbnNvbGUuZXJyb3IoZXJyKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyaW5nKGZuLCBvcHRpb25zKSB7XG4gIHRocm93SW5Ccm93c2VyKHJlbmRlclRvU3RyaW5nKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyaW5nQXN5bmMoZm4sIG9wdGlvbnMpIHtcbiAgdGhyb3dJbkJyb3dzZXIocmVuZGVyVG9TdHJpbmdBc3luYyk7XG59XG5mdW5jdGlvbiByZW5kZXJUb1N0cmVhbShmbiwgb3B0aW9ucykge1xuICB0aHJvd0luQnJvd3NlcihyZW5kZXJUb1N0cmVhbSk7XG59XG5mdW5jdGlvbiBzc3IodGVtcGxhdGUsIC4uLm5vZGVzKSB7fVxuZnVuY3Rpb24gc3NyRWxlbWVudChuYW1lLCBwcm9wcywgY2hpbGRyZW4sIG5lZWRzSWQpIHt9XG5mdW5jdGlvbiBzc3JDbGFzc0xpc3QodmFsdWUpIHt9XG5mdW5jdGlvbiBzc3JTdHlsZSh2YWx1ZSkge31cbmZ1bmN0aW9uIHNzckF0dHJpYnV0ZShrZXksIHZhbHVlKSB7fVxuZnVuY3Rpb24gc3NySHlkcmF0aW9uS2V5KCkge31cbmZ1bmN0aW9uIHJlc29sdmVTU1JOb2RlKG5vZGUpIHt9XG5mdW5jdGlvbiBlc2NhcGUoaHRtbCkge31cbmZ1bmN0aW9uIHNzclNwcmVhZChwcm9wcywgaXNTVkcsIHNraXBDaGlsZHJlbikge31cblxuY29uc3QgaXNTZXJ2ZXIgPSBmYWxzZTtcbmNvbnN0IGlzRGV2ID0gdHJ1ZTtcbmNvbnN0IFNWR19OQU1FU1BBQ0UgPSBcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI7XG5mdW5jdGlvbiBjcmVhdGVFbGVtZW50KHRhZ05hbWUsIGlzU1ZHID0gZmFsc2UpIHtcbiAgcmV0dXJuIGlzU1ZHID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR19OQU1FU1BBQ0UsIHRhZ05hbWUpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbn1cbmNvbnN0IGh5ZHJhdGUgPSAoLi4uYXJncykgPT4ge1xuICBlbmFibGVIeWRyYXRpb24oKTtcbiAgcmV0dXJuIGh5ZHJhdGUkMSguLi5hcmdzKTtcbn07XG5mdW5jdGlvbiBQb3J0YWwocHJvcHMpIHtcbiAgY29uc3Qge1xuICAgICAgdXNlU2hhZG93XG4gICAgfSA9IHByb3BzLFxuICAgIG1hcmtlciA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXCIpLFxuICAgIG1vdW50ID0gKCkgPT4gcHJvcHMubW91bnQgfHwgZG9jdW1lbnQuYm9keSxcbiAgICBvd25lciA9IGdldE93bmVyKCk7XG4gIGxldCBjb250ZW50O1xuICBsZXQgaHlkcmF0aW5nID0gISFzaGFyZWRDb25maWcuY29udGV4dDtcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoaHlkcmF0aW5nKSBnZXRPd25lcigpLnVzZXIgPSBoeWRyYXRpbmcgPSBmYWxzZTtcbiAgICBjb250ZW50IHx8IChjb250ZW50ID0gcnVuV2l0aE93bmVyKG93bmVyLCAoKSA9PiBjcmVhdGVNZW1vKCgpID0+IHByb3BzLmNoaWxkcmVuKSkpO1xuICAgIGNvbnN0IGVsID0gbW91bnQoKTtcbiAgICBpZiAoZWwgaW5zdGFuY2VvZiBIVE1MSGVhZEVsZW1lbnQpIHtcbiAgICAgIGNvbnN0IFtjbGVhbiwgc2V0Q2xlYW5dID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgICAgIGNvbnN0IGNsZWFudXAgPSAoKSA9PiBzZXRDbGVhbih0cnVlKTtcbiAgICAgIGNyZWF0ZVJvb3QoZGlzcG9zZSA9PiBpbnNlcnQoZWwsICgpID0+ICFjbGVhbigpID8gY29udGVudCgpIDogZGlzcG9zZSgpLCBudWxsKSk7XG4gICAgICBvbkNsZWFudXAoY2xlYW51cCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGNyZWF0ZUVsZW1lbnQocHJvcHMuaXNTVkcgPyBcImdcIiA6IFwiZGl2XCIsIHByb3BzLmlzU1ZHKSxcbiAgICAgICAgcmVuZGVyUm9vdCA9IHVzZVNoYWRvdyAmJiBjb250YWluZXIuYXR0YWNoU2hhZG93ID8gY29udGFpbmVyLmF0dGFjaFNoYWRvdyh7XG4gICAgICAgICAgbW9kZTogXCJvcGVuXCJcbiAgICAgICAgfSkgOiBjb250YWluZXI7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29udGFpbmVyLCBcIl8kaG9zdFwiLCB7XG4gICAgICAgIGdldCgpIHtcbiAgICAgICAgICByZXR1cm4gbWFya2VyLnBhcmVudE5vZGU7XG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gICAgICBpbnNlcnQocmVuZGVyUm9vdCwgY29udGVudCk7XG4gICAgICBlbC5hcHBlbmRDaGlsZChjb250YWluZXIpO1xuICAgICAgcHJvcHMucmVmICYmIHByb3BzLnJlZihjb250YWluZXIpO1xuICAgICAgb25DbGVhbnVwKCgpID0+IGVsLnJlbW92ZUNoaWxkKGNvbnRhaW5lcikpO1xuICAgIH1cbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgcmVuZGVyOiAhaHlkcmF0aW5nXG4gIH0pO1xuICByZXR1cm4gbWFya2VyO1xufVxuZnVuY3Rpb24gY3JlYXRlRHluYW1pYyhjb21wb25lbnQsIHByb3BzKSB7XG4gIGNvbnN0IGNhY2hlZCA9IGNyZWF0ZU1lbW8oY29tcG9uZW50KTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IGNhY2hlZCgpO1xuICAgIHN3aXRjaCAodHlwZW9mIGNvbXBvbmVudCkge1xuICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgICAgIE9iamVjdC5hc3NpZ24oY29tcG9uZW50LCB7XG4gICAgICAgICAgWyRERVZDT01QXTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHVudHJhY2soKCkgPT4gY29tcG9uZW50KHByb3BzKSk7XG4gICAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICAgIGNvbnN0IGlzU3ZnID0gU1ZHRWxlbWVudHMuaGFzKGNvbXBvbmVudCk7XG4gICAgICAgIGNvbnN0IGVsID0gc2hhcmVkQ29uZmlnLmNvbnRleHQgPyBnZXROZXh0RWxlbWVudCgpIDogY3JlYXRlRWxlbWVudChjb21wb25lbnQsIGlzU3ZnKTtcbiAgICAgICAgc3ByZWFkKGVsLCBwcm9wcywgaXNTdmcpO1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgfVxuICB9KTtcbn1cbmZ1bmN0aW9uIER5bmFtaWMocHJvcHMpIHtcbiAgY29uc3QgWywgb3RoZXJzXSA9IHNwbGl0UHJvcHMocHJvcHMsIFtcImNvbXBvbmVudFwiXSk7XG4gIHJldHVybiBjcmVhdGVEeW5hbWljKCgpID0+IHByb3BzLmNvbXBvbmVudCwgb3RoZXJzKTtcbn1cblxuZXhwb3J0IHsgQWxpYXNlcywgdm9pZEZuIGFzIEFzc2V0cywgQ2hpbGRQcm9wZXJ0aWVzLCBET01FbGVtZW50cywgRGVsZWdhdGVkRXZlbnRzLCBEeW5hbWljLCBIeWRyYXRpb24sIHZvaWRGbiBhcyBIeWRyYXRpb25TY3JpcHQsIE5vSHlkcmF0aW9uLCBQb3J0YWwsIFByb3BlcnRpZXMsIFJlcXVlc3RDb250ZXh0LCBTVkdFbGVtZW50cywgU1ZHTmFtZXNwYWNlLCBhZGRFdmVudExpc3RlbmVyLCBhc3NpZ24sIGNsYXNzTGlzdCwgY2xhc3NOYW1lLCBjbGVhckRlbGVnYXRlZEV2ZW50cywgY3JlYXRlRHluYW1pYywgZGVsZWdhdGVFdmVudHMsIGR5bmFtaWNQcm9wZXJ0eSwgZXNjYXBlLCB2b2lkRm4gYXMgZ2VuZXJhdGVIeWRyYXRpb25TY3JpcHQsIHZvaWRGbiBhcyBnZXRBc3NldHMsIGdldEh5ZHJhdGlvbktleSwgZ2V0TmV4dEVsZW1lbnQsIGdldE5leHRNYXJrZXIsIGdldE5leHRNYXRjaCwgZ2V0UHJvcEFsaWFzLCB2b2lkRm4gYXMgZ2V0UmVxdWVzdEV2ZW50LCBoeWRyYXRlLCBpbm5lckhUTUwsIGluc2VydCwgaXNEZXYsIGlzU2VydmVyLCBtZW1vLCByZW5kZXIsIHJlbmRlclRvU3RyZWFtLCByZW5kZXJUb1N0cmluZywgcmVuZGVyVG9TdHJpbmdBc3luYywgcmVzb2x2ZVNTUk5vZGUsIHJ1bkh5ZHJhdGlvbkV2ZW50cywgc2V0QXR0cmlidXRlLCBzZXRBdHRyaWJ1dGVOUywgc2V0Qm9vbEF0dHJpYnV0ZSwgc2V0UHJvcGVydHksIHNwcmVhZCwgc3NyLCBzc3JBdHRyaWJ1dGUsIHNzckNsYXNzTGlzdCwgc3NyRWxlbWVudCwgc3NySHlkcmF0aW9uS2V5LCBzc3JTcHJlYWQsIHNzclN0eWxlLCBzdHlsZSwgdGVtcGxhdGUsIHVzZSwgdm9pZEZuIGFzIHVzZUFzc2V0cyB9O1xuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiLy8gR2VuZXJhdGVkIHVzaW5nIGBucG0gcnVuIGJ1aWxkYC4gRG8gbm90IGVkaXQuXG5cbnZhciByZWdleCA9IC9eW2Etel0oPzpbXFwuMC05X2EtelxceEI3XFx4QzAtXFx4RDZcXHhEOC1cXHhGNlxceEY4LVxcdTAzN0RcXHUwMzdGLVxcdTFGRkZcXHUyMDBDXFx1MjAwRFxcdTIwM0ZcXHUyMDQwXFx1MjA3MC1cXHUyMThGXFx1MkMwMC1cXHUyRkVGXFx1MzAwMS1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkZEXXxbXFx1RDgwMC1cXHVEQjdGXVtcXHVEQzAwLVxcdURGRkZdKSotKD86W1xceDJEXFwuMC05X2EtelxceEI3XFx4QzAtXFx4RDZcXHhEOC1cXHhGNlxceEY4LVxcdTAzN0RcXHUwMzdGLVxcdTFGRkZcXHUyMDBDXFx1MjAwRFxcdTIwM0ZcXHUyMDQwXFx1MjA3MC1cXHUyMThGXFx1MkMwMC1cXHUyRkVGXFx1MzAwMS1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkZEXXxbXFx1RDgwMC1cXHVEQjdGXVtcXHVEQzAwLVxcdURGRkZdKSokLztcblxudmFyIGlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUgPSBmdW5jdGlvbihzdHJpbmcpIHtcblx0cmV0dXJuIHJlZ2V4LnRlc3Qoc3RyaW5nKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZTtcbiIsInZhciBfX2FzeW5jID0gKF9fdGhpcywgX19hcmd1bWVudHMsIGdlbmVyYXRvcikgPT4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIHZhciBmdWxmaWxsZWQgPSAodmFsdWUpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgfVxuICAgIH07XG4gICAgdmFyIHJlamVjdGVkID0gKHZhbHVlKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBzdGVwKGdlbmVyYXRvci50aHJvdyh2YWx1ZSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZWplY3QoZSk7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgc3RlcCA9ICh4KSA9PiB4LmRvbmUgPyByZXNvbHZlKHgudmFsdWUpIDogUHJvbWlzZS5yZXNvbHZlKHgudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7XG4gICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KF9fdGhpcywgX19hcmd1bWVudHMpKS5uZXh0KCkpO1xuICB9KTtcbn07XG5cbi8vIHNyYy9pbmRleC50c1xuaW1wb3J0IGlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUgZnJvbSBcImlzLXBvdGVudGlhbC1jdXN0b20tZWxlbWVudC1uYW1lXCI7XG5mdW5jdGlvbiBjcmVhdGVJc29sYXRlZEVsZW1lbnQob3B0aW9ucykge1xuICByZXR1cm4gX19hc3luYyh0aGlzLCBudWxsLCBmdW5jdGlvbiogKCkge1xuICAgIGNvbnN0IHsgbmFtZSwgbW9kZSA9IFwiY2xvc2VkXCIsIGNzcywgaXNvbGF0ZUV2ZW50cyA9IGZhbHNlIH0gPSBvcHRpb25zO1xuICAgIGlmICghaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZShuYW1lKSkge1xuICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgIGBcIiR7bmFtZX1cIiBpcyBub3QgYSB2YWxpZCBjdXN0b20gZWxlbWVudCBuYW1lLiBJdCBtdXN0IGJlIHR3byB3b3JkcyBhbmQga2ViYWItY2FzZSwgd2l0aCBhIGZldyBleGNlcHRpb25zLiBTZWUgc3BlYyBmb3IgbW9yZSBkZXRhaWxzOiBodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9jdXN0b20tZWxlbWVudHMuaHRtbCN2YWxpZC1jdXN0b20tZWxlbWVudC1uYW1lYFxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgcGFyZW50RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQobmFtZSk7XG4gICAgY29uc3Qgc2hhZG93ID0gcGFyZW50RWxlbWVudC5hdHRhY2hTaGFkb3coeyBtb2RlIH0pO1xuICAgIGNvbnN0IGlzb2xhdGVkRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJodG1sXCIpO1xuICAgIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYm9keVwiKTtcbiAgICBjb25zdCBoZWFkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImhlYWRcIik7XG4gICAgaWYgKGNzcykge1xuICAgICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XG4gICAgICBpZiAoXCJ1cmxcIiBpbiBjc3MpIHtcbiAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSB5aWVsZCBmZXRjaChjc3MudXJsKS50aGVuKChyZXMpID0+IHJlcy50ZXh0KCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSBjc3MudGV4dENvbnRlbnQ7XG4gICAgICB9XG4gICAgICBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICB9XG4gICAgaXNvbGF0ZWRFbGVtZW50LmFwcGVuZENoaWxkKGhlYWQpO1xuICAgIGlzb2xhdGVkRWxlbWVudC5hcHBlbmRDaGlsZChib2R5KTtcbiAgICBzaGFkb3cuYXBwZW5kQ2hpbGQoaXNvbGF0ZWRFbGVtZW50KTtcbiAgICBpZiAoaXNvbGF0ZUV2ZW50cykge1xuICAgICAgY29uc3QgZXZlbnRUeXBlcyA9IEFycmF5LmlzQXJyYXkoaXNvbGF0ZUV2ZW50cykgPyBpc29sYXRlRXZlbnRzIDogW1wia2V5ZG93blwiLCBcImtleXVwXCIsIFwia2V5cHJlc3NcIl07XG4gICAgICBldmVudFR5cGVzLmZvckVhY2goKGV2ZW50VHlwZSkgPT4ge1xuICAgICAgICBib2R5LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnRUeXBlLCAoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHBhcmVudEVsZW1lbnQsXG4gICAgICBzaGFkb3csXG4gICAgICBpc29sYXRlZEVsZW1lbnQ6IGJvZHlcbiAgICB9O1xuICB9KTtcbn1cbmV4cG9ydCB7XG4gIGNyZWF0ZUlzb2xhdGVkRWxlbWVudFxufTtcbiIsImNvbnN0IG51bGxLZXkgPSBTeW1ib2woJ251bGwnKTsgLy8gYG9iamVjdEhhc2hlc2Aga2V5IGZvciBudWxsXG5cbmxldCBrZXlDb3VudGVyID0gMDtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWFueUtleXNNYXAgZXh0ZW5kcyBNYXAge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fb2JqZWN0SGFzaGVzID0gbmV3IFdlYWtNYXAoKTtcblx0XHR0aGlzLl9zeW1ib2xIYXNoZXMgPSBuZXcgTWFwKCk7IC8vIGh0dHBzOi8vZ2l0aHViLmNvbS90YzM5L2VjbWEyNjIvaXNzdWVzLzExOTRcblx0XHR0aGlzLl9wdWJsaWNLZXlzID0gbmV3IE1hcCgpO1xuXG5cdFx0Y29uc3QgW3BhaXJzXSA9IGFyZ3VtZW50czsgLy8gTWFwIGNvbXBhdFxuXHRcdGlmIChwYWlycyA9PT0gbnVsbCB8fCBwYWlycyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBwYWlyc1tTeW1ib2wuaXRlcmF0b3JdICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHR5cGVvZiBwYWlycyArICcgaXMgbm90IGl0ZXJhYmxlIChjYW5ub3QgcmVhZCBwcm9wZXJ0eSBTeW1ib2woU3ltYm9sLml0ZXJhdG9yKSknKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IFtrZXlzLCB2YWx1ZV0gb2YgcGFpcnMpIHtcblx0XHRcdHRoaXMuc2V0KGtleXMsIHZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRfZ2V0UHVibGljS2V5cyhrZXlzLCBjcmVhdGUgPSBmYWxzZSkge1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShrZXlzKSkge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIGtleXMgcGFyYW1ldGVyIG11c3QgYmUgYW4gYXJyYXknKTtcblx0XHR9XG5cblx0XHRjb25zdCBwcml2YXRlS2V5ID0gdGhpcy5fZ2V0UHJpdmF0ZUtleShrZXlzLCBjcmVhdGUpO1xuXG5cdFx0bGV0IHB1YmxpY0tleTtcblx0XHRpZiAocHJpdmF0ZUtleSAmJiB0aGlzLl9wdWJsaWNLZXlzLmhhcyhwcml2YXRlS2V5KSkge1xuXHRcdFx0cHVibGljS2V5ID0gdGhpcy5fcHVibGljS2V5cy5nZXQocHJpdmF0ZUtleSk7XG5cdFx0fSBlbHNlIGlmIChjcmVhdGUpIHtcblx0XHRcdHB1YmxpY0tleSA9IFsuLi5rZXlzXTsgLy8gUmVnZW5lcmF0ZSBrZXlzIGFycmF5IHRvIGF2b2lkIGV4dGVybmFsIGludGVyYWN0aW9uXG5cdFx0XHR0aGlzLl9wdWJsaWNLZXlzLnNldChwcml2YXRlS2V5LCBwdWJsaWNLZXkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7cHJpdmF0ZUtleSwgcHVibGljS2V5fTtcblx0fVxuXG5cdF9nZXRQcml2YXRlS2V5KGtleXMsIGNyZWF0ZSA9IGZhbHNlKSB7XG5cdFx0Y29uc3QgcHJpdmF0ZUtleXMgPSBbXTtcblx0XHRmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuXHRcdFx0aWYgKGtleSA9PT0gbnVsbCkge1xuXHRcdFx0XHRrZXkgPSBudWxsS2V5O1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBoYXNoZXMgPSB0eXBlb2Yga2V5ID09PSAnb2JqZWN0JyB8fCB0eXBlb2Yga2V5ID09PSAnZnVuY3Rpb24nID8gJ19vYmplY3RIYXNoZXMnIDogKHR5cGVvZiBrZXkgPT09ICdzeW1ib2wnID8gJ19zeW1ib2xIYXNoZXMnIDogZmFsc2UpO1xuXG5cdFx0XHRpZiAoIWhhc2hlcykge1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKGtleSk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXNbaGFzaGVzXS5oYXMoa2V5KSkge1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKHRoaXNbaGFzaGVzXS5nZXQoa2V5KSk7XG5cdFx0XHR9IGVsc2UgaWYgKGNyZWF0ZSkge1xuXHRcdFx0XHRjb25zdCBwcml2YXRlS2V5ID0gYEBAbWttLXJlZi0ke2tleUNvdW50ZXIrK31AQGA7XG5cdFx0XHRcdHRoaXNbaGFzaGVzXS5zZXQoa2V5LCBwcml2YXRlS2V5KTtcblx0XHRcdFx0cHJpdmF0ZUtleXMucHVzaChwcml2YXRlS2V5KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkocHJpdmF0ZUtleXMpO1xuXHR9XG5cblx0c2V0KGtleXMsIHZhbHVlKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMsIHRydWUpO1xuXHRcdHJldHVybiBzdXBlci5zZXQocHVibGljS2V5LCB2YWx1ZSk7XG5cdH1cblxuXHRnZXQoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gc3VwZXIuZ2V0KHB1YmxpY0tleSk7XG5cdH1cblxuXHRoYXMoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gc3VwZXIuaGFzKHB1YmxpY0tleSk7XG5cdH1cblxuXHRkZWxldGUoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXksIHByaXZhdGVLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gQm9vbGVhbihwdWJsaWNLZXkgJiYgc3VwZXIuZGVsZXRlKHB1YmxpY0tleSkgJiYgdGhpcy5fcHVibGljS2V5cy5kZWxldGUocHJpdmF0ZUtleSkpO1xuXHR9XG5cblx0Y2xlYXIoKSB7XG5cdFx0c3VwZXIuY2xlYXIoKTtcblx0XHR0aGlzLl9zeW1ib2xIYXNoZXMuY2xlYXIoKTtcblx0XHR0aGlzLl9wdWJsaWNLZXlzLmNsZWFyKCk7XG5cdH1cblxuXHRnZXQgW1N5bWJvbC50b1N0cmluZ1RhZ10oKSB7XG5cdFx0cmV0dXJuICdNYW55S2V5c01hcCc7XG5cdH1cblxuXHRnZXQgc2l6ZSgpIHtcblx0XHRyZXR1cm4gc3VwZXIuc2l6ZTtcblx0fVxufVxuIiwiZnVuY3Rpb24gaXNQbGFpbk9iamVjdCh2YWx1ZSkge1xuICBpZiAodmFsdWUgPT09IG51bGwgfHwgdHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHByb3RvdHlwZSA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSk7XG4gIGlmIChwcm90b3R5cGUgIT09IG51bGwgJiYgcHJvdG90eXBlICE9PSBPYmplY3QucHJvdG90eXBlICYmIE9iamVjdC5nZXRQcm90b3R5cGVPZihwcm90b3R5cGUpICE9PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChTeW1ib2wuaXRlcmF0b3IgaW4gdmFsdWUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKFN5bWJvbC50b1N0cmluZ1RhZyBpbiB2YWx1ZSkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpID09PSBcIltvYmplY3QgTW9kdWxlXVwiO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBfZGVmdShiYXNlT2JqZWN0LCBkZWZhdWx0cywgbmFtZXNwYWNlID0gXCIuXCIsIG1lcmdlcikge1xuICBpZiAoIWlzUGxhaW5PYmplY3QoZGVmYXVsdHMpKSB7XG4gICAgcmV0dXJuIF9kZWZ1KGJhc2VPYmplY3QsIHt9LCBuYW1lc3BhY2UsIG1lcmdlcik7XG4gIH1cbiAgY29uc3Qgb2JqZWN0ID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdHMpO1xuICBmb3IgKGNvbnN0IGtleSBpbiBiYXNlT2JqZWN0KSB7XG4gICAgaWYgKGtleSA9PT0gXCJfX3Byb3RvX19cIiB8fCBrZXkgPT09IFwiY29uc3RydWN0b3JcIikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gYmFzZU9iamVjdFtrZXldO1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdm9pZCAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKG1lcmdlciAmJiBtZXJnZXIob2JqZWN0LCBrZXksIHZhbHVlLCBuYW1lc3BhY2UpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpICYmIEFycmF5LmlzQXJyYXkob2JqZWN0W2tleV0pKSB7XG4gICAgICBvYmplY3Rba2V5XSA9IFsuLi52YWx1ZSwgLi4ub2JqZWN0W2tleV1dO1xuICAgIH0gZWxzZSBpZiAoaXNQbGFpbk9iamVjdCh2YWx1ZSkgJiYgaXNQbGFpbk9iamVjdChvYmplY3Rba2V5XSkpIHtcbiAgICAgIG9iamVjdFtrZXldID0gX2RlZnUoXG4gICAgICAgIHZhbHVlLFxuICAgICAgICBvYmplY3Rba2V5XSxcbiAgICAgICAgKG5hbWVzcGFjZSA/IGAke25hbWVzcGFjZX0uYCA6IFwiXCIpICsga2V5LnRvU3RyaW5nKCksXG4gICAgICAgIG1lcmdlclxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG9iamVjdDtcbn1cbmZ1bmN0aW9uIGNyZWF0ZURlZnUobWVyZ2VyKSB7XG4gIHJldHVybiAoLi4uYXJndW1lbnRzXykgPT4gKFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSB1bmljb3JuL25vLWFycmF5LXJlZHVjZVxuICAgIGFyZ3VtZW50c18ucmVkdWNlKChwLCBjKSA9PiBfZGVmdShwLCBjLCBcIlwiLCBtZXJnZXIpLCB7fSlcbiAgKTtcbn1cbmNvbnN0IGRlZnUgPSBjcmVhdGVEZWZ1KCk7XG5jb25zdCBkZWZ1Rm4gPSBjcmVhdGVEZWZ1KChvYmplY3QsIGtleSwgY3VycmVudFZhbHVlKSA9PiB7XG4gIGlmIChvYmplY3Rba2V5XSAhPT0gdm9pZCAwICYmIHR5cGVvZiBjdXJyZW50VmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIG9iamVjdFtrZXldID0gY3VycmVudFZhbHVlKG9iamVjdFtrZXldKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufSk7XG5jb25zdCBkZWZ1QXJyYXlGbiA9IGNyZWF0ZURlZnUoKG9iamVjdCwga2V5LCBjdXJyZW50VmFsdWUpID0+IHtcbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0W2tleV0pICYmIHR5cGVvZiBjdXJyZW50VmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIG9iamVjdFtrZXldID0gY3VycmVudFZhbHVlKG9iamVjdFtrZXldKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufSk7XG5cbmV4cG9ydCB7IGNyZWF0ZURlZnUsIGRlZnUgYXMgZGVmYXVsdCwgZGVmdSwgZGVmdUFycmF5Rm4sIGRlZnVGbiB9O1xuIiwiY29uc3QgaXNFeGlzdCA9IChlbGVtZW50KSA9PiB7XG4gIHJldHVybiBlbGVtZW50ICE9PSBudWxsID8geyBpc0RldGVjdGVkOiB0cnVlLCByZXN1bHQ6IGVsZW1lbnQgfSA6IHsgaXNEZXRlY3RlZDogZmFsc2UgfTtcbn07XG5jb25zdCBpc05vdEV4aXN0ID0gKGVsZW1lbnQpID0+IHtcbiAgcmV0dXJuIGVsZW1lbnQgPT09IG51bGwgPyB7IGlzRGV0ZWN0ZWQ6IHRydWUsIHJlc3VsdDogbnVsbCB9IDogeyBpc0RldGVjdGVkOiBmYWxzZSB9O1xufTtcblxuZXhwb3J0IHsgaXNFeGlzdCwgaXNOb3RFeGlzdCB9O1xuIiwiaW1wb3J0IE1hbnlLZXlzTWFwIGZyb20gJ21hbnkta2V5cy1tYXAnO1xuaW1wb3J0IHsgZGVmdSB9IGZyb20gJ2RlZnUnO1xuaW1wb3J0IHsgaXNFeGlzdCB9IGZyb20gJy4vZGV0ZWN0b3JzLm1qcyc7XG5cbmNvbnN0IGdldERlZmF1bHRPcHRpb25zID0gKCkgPT4gKHtcbiAgdGFyZ2V0OiBnbG9iYWxUaGlzLmRvY3VtZW50LFxuICB1bmlmeVByb2Nlc3M6IHRydWUsXG4gIGRldGVjdG9yOiBpc0V4aXN0LFxuICBvYnNlcnZlQ29uZmlnczoge1xuICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICBzdWJ0cmVlOiB0cnVlLFxuICAgIGF0dHJpYnV0ZXM6IHRydWVcbiAgfSxcbiAgc2lnbmFsOiB2b2lkIDAsXG4gIGN1c3RvbU1hdGNoZXI6IHZvaWQgMFxufSk7XG5jb25zdCBtZXJnZU9wdGlvbnMgPSAodXNlclNpZGVPcHRpb25zLCBkZWZhdWx0T3B0aW9ucykgPT4ge1xuICByZXR1cm4gZGVmdSh1c2VyU2lkZU9wdGlvbnMsIGRlZmF1bHRPcHRpb25zKTtcbn07XG5cbmNvbnN0IHVuaWZ5Q2FjaGUgPSBuZXcgTWFueUtleXNNYXAoKTtcbmZ1bmN0aW9uIGNyZWF0ZVdhaXRFbGVtZW50KGluc3RhbmNlT3B0aW9ucykge1xuICBjb25zdCB7IGRlZmF1bHRPcHRpb25zIH0gPSBpbnN0YW5jZU9wdGlvbnM7XG4gIHJldHVybiAoc2VsZWN0b3IsIG9wdGlvbnMpID0+IHtcbiAgICBjb25zdCB7XG4gICAgICB0YXJnZXQsXG4gICAgICB1bmlmeVByb2Nlc3MsXG4gICAgICBvYnNlcnZlQ29uZmlncyxcbiAgICAgIGRldGVjdG9yLFxuICAgICAgc2lnbmFsLFxuICAgICAgY3VzdG9tTWF0Y2hlclxuICAgIH0gPSBtZXJnZU9wdGlvbnMob3B0aW9ucywgZGVmYXVsdE9wdGlvbnMpO1xuICAgIGNvbnN0IHVuaWZ5UHJvbWlzZUtleSA9IFtcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgdGFyZ2V0LFxuICAgICAgdW5pZnlQcm9jZXNzLFxuICAgICAgb2JzZXJ2ZUNvbmZpZ3MsXG4gICAgICBkZXRlY3RvcixcbiAgICAgIHNpZ25hbCxcbiAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICBdO1xuICAgIGNvbnN0IGNhY2hlZFByb21pc2UgPSB1bmlmeUNhY2hlLmdldCh1bmlmeVByb21pc2VLZXkpO1xuICAgIGlmICh1bmlmeVByb2Nlc3MgJiYgY2FjaGVkUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIGNhY2hlZFByb21pc2U7XG4gICAgfVxuICAgIGNvbnN0IGRldGVjdFByb21pc2UgPSBuZXcgUHJvbWlzZShcbiAgICAgIC8vIGJpb21lLWlnbm9yZSBsaW50L3N1c3BpY2lvdXMvbm9Bc3luY1Byb21pc2VFeGVjdXRvcjogYXZvaWQgbmVzdGluZyBwcm9taXNlXG4gICAgICBhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmIChzaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KHNpZ25hbC5yZWFzb24pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoXG4gICAgICAgICAgYXN5bmMgKG11dGF0aW9ucykgPT4ge1xuICAgICAgICAgICAgZm9yIChjb25zdCBfIG9mIG11dGF0aW9ucykge1xuICAgICAgICAgICAgICBpZiAoc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnN0IGRldGVjdFJlc3VsdDIgPSBhd2FpdCBkZXRlY3RFbGVtZW50KHtcbiAgICAgICAgICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgICAgICAgZGV0ZWN0b3IsXG4gICAgICAgICAgICAgICAgY3VzdG9tTWF0Y2hlclxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgaWYgKGRldGVjdFJlc3VsdDIuaXNEZXRlY3RlZCkge1xuICAgICAgICAgICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGRldGVjdFJlc3VsdDIucmVzdWx0KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgICAgc2lnbmFsPy5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgIFwiYWJvcnRcIixcbiAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KHNpZ25hbC5yZWFzb24pO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgeyBvbmNlOiB0cnVlIH1cbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgZGV0ZWN0UmVzdWx0ID0gYXdhaXQgZGV0ZWN0RWxlbWVudCh7XG4gICAgICAgICAgc2VsZWN0b3IsXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgIGRldGVjdG9yLFxuICAgICAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChkZXRlY3RSZXN1bHQuaXNEZXRlY3RlZCkge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKGRldGVjdFJlc3VsdC5yZXN1bHQpO1xuICAgICAgICB9XG4gICAgICAgIG9ic2VydmVyLm9ic2VydmUodGFyZ2V0LCBvYnNlcnZlQ29uZmlncyk7XG4gICAgICB9XG4gICAgKS5maW5hbGx5KCgpID0+IHtcbiAgICAgIHVuaWZ5Q2FjaGUuZGVsZXRlKHVuaWZ5UHJvbWlzZUtleSk7XG4gICAgfSk7XG4gICAgdW5pZnlDYWNoZS5zZXQodW5pZnlQcm9taXNlS2V5LCBkZXRlY3RQcm9taXNlKTtcbiAgICByZXR1cm4gZGV0ZWN0UHJvbWlzZTtcbiAgfTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGRldGVjdEVsZW1lbnQoe1xuICB0YXJnZXQsXG4gIHNlbGVjdG9yLFxuICBkZXRlY3RvcixcbiAgY3VzdG9tTWF0Y2hlclxufSkge1xuICBjb25zdCBlbGVtZW50ID0gY3VzdG9tTWF0Y2hlciA/IGN1c3RvbU1hdGNoZXIoc2VsZWN0b3IpIDogdGFyZ2V0LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuICByZXR1cm4gYXdhaXQgZGV0ZWN0b3IoZWxlbWVudCk7XG59XG5jb25zdCB3YWl0RWxlbWVudCA9IGNyZWF0ZVdhaXRFbGVtZW50KHtcbiAgZGVmYXVsdE9wdGlvbnM6IGdldERlZmF1bHRPcHRpb25zKClcbn0pO1xuXG5leHBvcnQgeyBjcmVhdGVXYWl0RWxlbWVudCwgZ2V0RGVmYXVsdE9wdGlvbnMsIHdhaXRFbGVtZW50IH07XG4iLCJmdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcbiAgaWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXJncy5zaGlmdCgpO1xuICAgIG1ldGhvZChgW3d4dF0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xuICB9XG59XG5leHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuICBsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG4gIHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuICBlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuIiwiaW1wb3J0IHsgd2FpdEVsZW1lbnQgfSBmcm9tIFwiQDFuYXRzdS93YWl0LWVsZW1lbnRcIjtcbmltcG9ydCB7XG4gIGlzRXhpc3QgYXMgbW91bnREZXRlY3RvcixcbiAgaXNOb3RFeGlzdCBhcyByZW1vdmVEZXRlY3RvclxufSBmcm9tIFwiQDFuYXRzdS93YWl0LWVsZW1lbnQvZGV0ZWN0b3JzXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5UG9zaXRpb24ocm9vdCwgcG9zaXRpb25lZEVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgaWYgKG9wdGlvbnMucG9zaXRpb24gPT09IFwiaW5saW5lXCIpIHJldHVybjtcbiAgaWYgKG9wdGlvbnMuekluZGV4ICE9IG51bGwpIHJvb3Quc3R5bGUuekluZGV4ID0gU3RyaW5nKG9wdGlvbnMuekluZGV4KTtcbiAgcm9vdC5zdHlsZS5vdmVyZmxvdyA9IFwidmlzaWJsZVwiO1xuICByb290LnN0eWxlLnBvc2l0aW9uID0gXCJyZWxhdGl2ZVwiO1xuICByb290LnN0eWxlLndpZHRoID0gXCIwXCI7XG4gIHJvb3Quc3R5bGUuaGVpZ2h0ID0gXCIwXCI7XG4gIHJvb3Quc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgaWYgKHBvc2l0aW9uZWRFbGVtZW50KSB7XG4gICAgaWYgKG9wdGlvbnMucG9zaXRpb24gPT09IFwib3ZlcmxheVwiKSB7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiYWJzb2x1dGVcIjtcbiAgICAgIGlmIChvcHRpb25zLmFsaWdubWVudD8uc3RhcnRzV2l0aChcImJvdHRvbS1cIikpXG4gICAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmJvdHRvbSA9IFwiMFwiO1xuICAgICAgZWxzZSBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIjtcbiAgICAgIGlmIChvcHRpb25zLmFsaWdubWVudD8uZW5kc1dpdGgoXCItcmlnaHRcIikpXG4gICAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIwXCI7XG4gICAgICBlbHNlIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmxlZnQgPSBcIjBcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmJvdHRvbSA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUubGVmdCA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIjtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRBbmNob3Iob3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5hbmNob3IgPT0gbnVsbCkgcmV0dXJuIGRvY3VtZW50LmJvZHk7XG4gIGxldCByZXNvbHZlZCA9IHR5cGVvZiBvcHRpb25zLmFuY2hvciA9PT0gXCJmdW5jdGlvblwiID8gb3B0aW9ucy5hbmNob3IoKSA6IG9wdGlvbnMuYW5jaG9yO1xuICBpZiAodHlwZW9mIHJlc29sdmVkID09PSBcInN0cmluZ1wiKSB7XG4gICAgaWYgKHJlc29sdmVkLnN0YXJ0c1dpdGgoXCIvXCIpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBkb2N1bWVudC5ldmFsdWF0ZShcbiAgICAgICAgcmVzb2x2ZWQsXG4gICAgICAgIGRvY3VtZW50LFxuICAgICAgICBudWxsLFxuICAgICAgICBYUGF0aFJlc3VsdC5GSVJTVF9PUkRFUkVEX05PREVfVFlQRSxcbiAgICAgICAgbnVsbFxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXN1bHQuc2luZ2xlTm9kZVZhbHVlID8/IHZvaWQgMDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IocmVzb2x2ZWQpID8/IHZvaWQgMDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc29sdmVkID8/IHZvaWQgMDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtb3VudFVpKHJvb3QsIG9wdGlvbnMpIHtcbiAgY29uc3QgYW5jaG9yID0gZ2V0QW5jaG9yKG9wdGlvbnMpO1xuICBpZiAoYW5jaG9yID09IG51bGwpXG4gICAgdGhyb3cgRXJyb3IoXG4gICAgICBcIkZhaWxlZCB0byBtb3VudCBjb250ZW50IHNjcmlwdCBVSTogY291bGQgbm90IGZpbmQgYW5jaG9yIGVsZW1lbnRcIlxuICAgICk7XG4gIHN3aXRjaCAob3B0aW9ucy5hcHBlbmQpIHtcbiAgICBjYXNlIHZvaWQgMDpcbiAgICBjYXNlIFwibGFzdFwiOlxuICAgICAgYW5jaG9yLmFwcGVuZChyb290KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJmaXJzdFwiOlxuICAgICAgYW5jaG9yLnByZXBlbmQocm9vdCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwicmVwbGFjZVwiOlxuICAgICAgYW5jaG9yLnJlcGxhY2VXaXRoKHJvb3QpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImFmdGVyXCI6XG4gICAgICBhbmNob3IucGFyZW50RWxlbWVudD8uaW5zZXJ0QmVmb3JlKHJvb3QsIGFuY2hvci5uZXh0RWxlbWVudFNpYmxpbmcpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImJlZm9yZVwiOlxuICAgICAgYW5jaG9yLnBhcmVudEVsZW1lbnQ/Lmluc2VydEJlZm9yZShyb290LCBhbmNob3IpO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIG9wdGlvbnMuYXBwZW5kKGFuY2hvciwgcm9vdCk7XG4gICAgICBicmVhaztcbiAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1vdW50RnVuY3Rpb25zKGJhc2VGdW5jdGlvbnMsIG9wdGlvbnMpIHtcbiAgbGV0IGF1dG9Nb3VudEluc3RhbmNlID0gdm9pZCAwO1xuICBjb25zdCBzdG9wQXV0b01vdW50ID0gKCkgPT4ge1xuICAgIGF1dG9Nb3VudEluc3RhbmNlPy5zdG9wQXV0b01vdW50KCk7XG4gICAgYXV0b01vdW50SW5zdGFuY2UgPSB2b2lkIDA7XG4gIH07XG4gIGNvbnN0IG1vdW50ID0gKCkgPT4ge1xuICAgIGJhc2VGdW5jdGlvbnMubW91bnQoKTtcbiAgfTtcbiAgY29uc3QgdW5tb3VudCA9IGJhc2VGdW5jdGlvbnMucmVtb3ZlO1xuICBjb25zdCByZW1vdmUgPSAoKSA9PiB7XG4gICAgc3RvcEF1dG9Nb3VudCgpO1xuICAgIGJhc2VGdW5jdGlvbnMucmVtb3ZlKCk7XG4gIH07XG4gIGNvbnN0IGF1dG9Nb3VudCA9IChhdXRvTW91bnRPcHRpb25zKSA9PiB7XG4gICAgaWYgKGF1dG9Nb3VudEluc3RhbmNlKSB7XG4gICAgICBsb2dnZXIud2FybihcImF1dG9Nb3VudCBpcyBhbHJlYWR5IHNldC5cIik7XG4gICAgfVxuICAgIGF1dG9Nb3VudEluc3RhbmNlID0gYXV0b01vdW50VWkoXG4gICAgICB7IG1vdW50LCB1bm1vdW50LCBzdG9wQXV0b01vdW50IH0sXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIC4uLmF1dG9Nb3VudE9wdGlvbnNcbiAgICAgIH1cbiAgICApO1xuICB9O1xuICByZXR1cm4ge1xuICAgIG1vdW50LFxuICAgIHJlbW92ZSxcbiAgICBhdXRvTW91bnRcbiAgfTtcbn1cbmZ1bmN0aW9uIGF1dG9Nb3VudFVpKHVpQ2FsbGJhY2tzLCBvcHRpb25zKSB7XG4gIGNvbnN0IGFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgY29uc3QgRVhQTElDSVRfU1RPUF9SRUFTT04gPSBcImV4cGxpY2l0X3N0b3BfYXV0b19tb3VudFwiO1xuICBjb25zdCBfc3RvcEF1dG9Nb3VudCA9ICgpID0+IHtcbiAgICBhYm9ydENvbnRyb2xsZXIuYWJvcnQoRVhQTElDSVRfU1RPUF9SRUFTT04pO1xuICAgIG9wdGlvbnMub25TdG9wPy4oKTtcbiAgfTtcbiAgbGV0IHJlc29sdmVkQW5jaG9yID0gdHlwZW9mIG9wdGlvbnMuYW5jaG9yID09PSBcImZ1bmN0aW9uXCIgPyBvcHRpb25zLmFuY2hvcigpIDogb3B0aW9ucy5hbmNob3I7XG4gIGlmIChyZXNvbHZlZEFuY2hvciBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICB0aHJvdyBFcnJvcihcbiAgICAgIFwiYXV0b01vdW50IGFuZCBFbGVtZW50IGFuY2hvciBvcHRpb24gY2Fubm90IGJlIGNvbWJpbmVkLiBBdm9pZCBwYXNzaW5nIGBFbGVtZW50YCBkaXJlY3RseSBvciBgKCkgPT4gRWxlbWVudGAgdG8gdGhlIGFuY2hvci5cIlxuICAgICk7XG4gIH1cbiAgYXN5bmMgZnVuY3Rpb24gb2JzZXJ2ZUVsZW1lbnQoc2VsZWN0b3IpIHtcbiAgICBsZXQgaXNBbmNob3JFeGlzdCA9ICEhZ2V0QW5jaG9yKG9wdGlvbnMpO1xuICAgIGlmIChpc0FuY2hvckV4aXN0KSB7XG4gICAgICB1aUNhbGxiYWNrcy5tb3VudCgpO1xuICAgIH1cbiAgICB3aGlsZSAoIWFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY2hhbmdlZEFuY2hvciA9IGF3YWl0IHdhaXRFbGVtZW50KHNlbGVjdG9yID8/IFwiYm9keVwiLCB7XG4gICAgICAgICAgY3VzdG9tTWF0Y2hlcjogKCkgPT4gZ2V0QW5jaG9yKG9wdGlvbnMpID8/IG51bGwsXG4gICAgICAgICAgZGV0ZWN0b3I6IGlzQW5jaG9yRXhpc3QgPyByZW1vdmVEZXRlY3RvciA6IG1vdW50RGV0ZWN0b3IsXG4gICAgICAgICAgc2lnbmFsOiBhYm9ydENvbnRyb2xsZXIuc2lnbmFsXG4gICAgICAgIH0pO1xuICAgICAgICBpc0FuY2hvckV4aXN0ID0gISFjaGFuZ2VkQW5jaG9yO1xuICAgICAgICBpZiAoaXNBbmNob3JFeGlzdCkge1xuICAgICAgICAgIHVpQ2FsbGJhY2tzLm1vdW50KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdWlDYWxsYmFja3MudW5tb3VudCgpO1xuICAgICAgICAgIGlmIChvcHRpb25zLm9uY2UpIHtcbiAgICAgICAgICAgIHVpQ2FsbGJhY2tzLnN0b3BBdXRvTW91bnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGlmIChhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQgJiYgYWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZWFzb24gPT09IEVYUExJQ0lUX1NUT1BfUkVBU09OKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgb2JzZXJ2ZUVsZW1lbnQocmVzb2x2ZWRBbmNob3IpO1xuICByZXR1cm4geyBzdG9wQXV0b01vdW50OiBfc3RvcEF1dG9Nb3VudCB9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIHNwbGl0U2hhZG93Um9vdENzcyhjc3MpIHtcbiAgbGV0IHNoYWRvd0NzcyA9IGNzcztcbiAgbGV0IGRvY3VtZW50Q3NzID0gXCJcIjtcbiAgY29uc3QgcnVsZXNSZWdleCA9IC8oXFxzKkAocHJvcGVydHl8Zm9udC1mYWNlKVtcXHNcXFNdKj97W1xcc1xcU10qP30pL2dtO1xuICBsZXQgbWF0Y2g7XG4gIHdoaWxlICgobWF0Y2ggPSBydWxlc1JlZ2V4LmV4ZWMoY3NzKSkgIT09IG51bGwpIHtcbiAgICBkb2N1bWVudENzcyArPSBtYXRjaFsxXTtcbiAgICBzaGFkb3dDc3MgPSBzaGFkb3dDc3MucmVwbGFjZShtYXRjaFsxXSwgXCJcIik7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBkb2N1bWVudENzczogZG9jdW1lbnRDc3MudHJpbSgpLFxuICAgIHNoYWRvd0Nzczogc2hhZG93Q3NzLnRyaW0oKVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgY3JlYXRlSXNvbGF0ZWRFbGVtZW50IH0gZnJvbSBcIkB3ZWJleHQtY29yZS9pc29sYXRlZC1lbGVtZW50XCI7XG5pbXBvcnQgeyBhcHBseVBvc2l0aW9uLCBjcmVhdGVNb3VudEZ1bmN0aW9ucywgbW91bnRVaSB9IGZyb20gXCIuL3NoYXJlZC5tanNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQgeyBzcGxpdFNoYWRvd1Jvb3RDc3MgfSBmcm9tIFwiLi4vc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qc1wiO1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVNoYWRvd1Jvb3RVaShjdHgsIG9wdGlvbnMpIHtcbiAgY29uc3QgaW5zdGFuY2VJZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZygyLCAxNSk7XG4gIGNvbnN0IGNzcyA9IFtdO1xuICBpZiAoIW9wdGlvbnMuaW5oZXJpdFN0eWxlcykge1xuICAgIGNzcy5wdXNoKGAvKiBXWFQgU2hhZG93IFJvb3QgUmVzZXQgKi8gOmhvc3R7YWxsOmluaXRpYWwgIWltcG9ydGFudDt9YCk7XG4gIH1cbiAgaWYgKG9wdGlvbnMuY3NzKSB7XG4gICAgY3NzLnB1c2gob3B0aW9ucy5jc3MpO1xuICB9XG4gIGlmIChjdHgub3B0aW9ucz8uY3NzSW5qZWN0aW9uTW9kZSA9PT0gXCJ1aVwiKSB7XG4gICAgY29uc3QgZW50cnlDc3MgPSBhd2FpdCBsb2FkQ3NzKCk7XG4gICAgY3NzLnB1c2goZW50cnlDc3MucmVwbGFjZUFsbChcIjpyb290XCIsIFwiOmhvc3RcIikpO1xuICB9XG4gIGNvbnN0IHsgc2hhZG93Q3NzLCBkb2N1bWVudENzcyB9ID0gc3BsaXRTaGFkb3dSb290Q3NzKGNzcy5qb2luKFwiXFxuXCIpLnRyaW0oKSk7XG4gIGNvbnN0IHtcbiAgICBpc29sYXRlZEVsZW1lbnQ6IHVpQ29udGFpbmVyLFxuICAgIHBhcmVudEVsZW1lbnQ6IHNoYWRvd0hvc3QsXG4gICAgc2hhZG93XG4gIH0gPSBhd2FpdCBjcmVhdGVJc29sYXRlZEVsZW1lbnQoe1xuICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICBjc3M6IHtcbiAgICAgIHRleHRDb250ZW50OiBzaGFkb3dDc3NcbiAgICB9LFxuICAgIG1vZGU6IG9wdGlvbnMubW9kZSA/PyBcIm9wZW5cIixcbiAgICBpc29sYXRlRXZlbnRzOiBvcHRpb25zLmlzb2xhdGVFdmVudHNcbiAgfSk7XG4gIHNoYWRvd0hvc3Quc2V0QXR0cmlidXRlKFwiZGF0YS13eHQtc2hhZG93LXJvb3RcIiwgXCJcIik7XG4gIGxldCBtb3VudGVkO1xuICBjb25zdCBtb3VudCA9ICgpID0+IHtcbiAgICBtb3VudFVpKHNoYWRvd0hvc3QsIG9wdGlvbnMpO1xuICAgIGFwcGx5UG9zaXRpb24oc2hhZG93SG9zdCwgc2hhZG93LnF1ZXJ5U2VsZWN0b3IoXCJodG1sXCIpLCBvcHRpb25zKTtcbiAgICBpZiAoZG9jdW1lbnRDc3MgJiYgIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXG4gICAgICBgc3R5bGVbd3h0LXNoYWRvdy1yb290LWRvY3VtZW50LXN0eWxlcz1cIiR7aW5zdGFuY2VJZH1cIl1gXG4gICAgKSkge1xuICAgICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XG4gICAgICBzdHlsZS50ZXh0Q29udGVudCA9IGRvY3VtZW50Q3NzO1xuICAgICAgc3R5bGUuc2V0QXR0cmlidXRlKFwid3h0LXNoYWRvdy1yb290LWRvY3VtZW50LXN0eWxlc1wiLCBpbnN0YW5jZUlkKTtcbiAgICAgIChkb2N1bWVudC5oZWFkID8/IGRvY3VtZW50LmJvZHkpLmFwcGVuZChzdHlsZSk7XG4gICAgfVxuICAgIG1vdW50ZWQgPSBvcHRpb25zLm9uTW91bnQodWlDb250YWluZXIsIHNoYWRvdywgc2hhZG93SG9zdCk7XG4gIH07XG4gIGNvbnN0IHJlbW92ZSA9ICgpID0+IHtcbiAgICBvcHRpb25zLm9uUmVtb3ZlPy4obW91bnRlZCk7XG4gICAgc2hhZG93SG9zdC5yZW1vdmUoKTtcbiAgICBjb25zdCBkb2N1bWVudFN0eWxlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgIGBzdHlsZVt3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzPVwiJHtpbnN0YW5jZUlkfVwiXWBcbiAgICApO1xuICAgIGRvY3VtZW50U3R5bGU/LnJlbW92ZSgpO1xuICAgIHdoaWxlICh1aUNvbnRhaW5lci5sYXN0Q2hpbGQpXG4gICAgICB1aUNvbnRhaW5lci5yZW1vdmVDaGlsZCh1aUNvbnRhaW5lci5sYXN0Q2hpbGQpO1xuICAgIG1vdW50ZWQgPSB2b2lkIDA7XG4gIH07XG4gIGNvbnN0IG1vdW50RnVuY3Rpb25zID0gY3JlYXRlTW91bnRGdW5jdGlvbnMoXG4gICAge1xuICAgICAgbW91bnQsXG4gICAgICByZW1vdmVcbiAgICB9LFxuICAgIG9wdGlvbnNcbiAgKTtcbiAgY3R4Lm9uSW52YWxpZGF0ZWQocmVtb3ZlKTtcbiAgcmV0dXJuIHtcbiAgICBzaGFkb3csXG4gICAgc2hhZG93SG9zdCxcbiAgICB1aUNvbnRhaW5lcixcbiAgICAuLi5tb3VudEZ1bmN0aW9ucyxcbiAgICBnZXQgbW91bnRlZCgpIHtcbiAgICAgIHJldHVybiBtb3VudGVkO1xuICAgIH1cbiAgfTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGxvYWRDc3MoKSB7XG4gIGNvbnN0IHVybCA9IGJyb3dzZXIucnVudGltZS5nZXRVUkwoYC9jb250ZW50LXNjcmlwdHMvJHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH0uY3NzYCk7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsKTtcbiAgICByZXR1cm4gYXdhaXQgcmVzLnRleHQoKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgbG9nZ2VyLndhcm4oXG4gICAgICBgRmFpbGVkIHRvIGxvYWQgc3R5bGVzIEAgJHt1cmx9LiBEaWQgeW91IGZvcmdldCB0byBpbXBvcnQgdGhlIHN0eWxlc2hlZXQgaW4geW91ciBlbnRyeXBvaW50P2AsXG4gICAgICBlcnJcbiAgICApO1xuICAgIHJldHVybiBcIlwiO1xuICB9XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiZnVuY3Rpb24gcihlKXt2YXIgdCxmLG49XCJcIjtpZihcInN0cmluZ1wiPT10eXBlb2YgZXx8XCJudW1iZXJcIj09dHlwZW9mIGUpbis9ZTtlbHNlIGlmKFwib2JqZWN0XCI9PXR5cGVvZiBlKWlmKEFycmF5LmlzQXJyYXkoZSkpe3ZhciBvPWUubGVuZ3RoO2Zvcih0PTA7dDxvO3QrKyllW3RdJiYoZj1yKGVbdF0pKSYmKG4mJihuKz1cIiBcIiksbis9Zil9ZWxzZSBmb3IoZiBpbiBlKWVbZl0mJihuJiYobis9XCIgXCIpLG4rPWYpO3JldHVybiBufWV4cG9ydCBmdW5jdGlvbiBjbHN4KCl7Zm9yKHZhciBlLHQsZj0wLG49XCJcIixvPWFyZ3VtZW50cy5sZW5ndGg7ZjxvO2YrKykoZT1hcmd1bWVudHNbZl0pJiYodD1yKGUpKSYmKG4mJihuKz1cIiBcIiksbis9dCk7cmV0dXJuIG59ZXhwb3J0IGRlZmF1bHQgY2xzeDsiLCJpbXBvcnQgeyBjbHN4LCB0eXBlIENsYXNzVmFsdWUgfSBmcm9tICdjbHN4J1xuXG5leHBvcnQgZnVuY3Rpb24gY24oLi4uaW5wdXRzOiBDbGFzc1ZhbHVlW10pIHtcbiAgcmV0dXJuIGNsc3goaW5wdXRzKVxufSIsImltcG9ydCB7IFNob3csIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50LCBKU1ggfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBIZWFkZXJQcm9wcyB7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBsb2dvPzogSlNYLkVsZW1lbnQ7XG4gIGFjdGlvbnM/OiBKU1guRWxlbWVudDtcbiAgdmFyaWFudD86ICdkZWZhdWx0JyB8ICdtaW5pbWFsJyB8ICd0cmFuc3BhcmVudCc7XG4gIHN0aWNreT86IGJvb2xlYW47XG4gIHNob3dNZW51QnV0dG9uPzogYm9vbGVhbjtcbiAgb25NZW51Q2xpY2s/OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEhlYWRlcjogQ29tcG9uZW50PEhlYWRlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbaXNTY3JvbGxlZCwgc2V0SXNTY3JvbGxlZF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuXG4gIC8vIFRyYWNrIHNjcm9sbCBwb3NpdGlvbiBmb3Igc3RpY2t5IGhlYWRlciBlZmZlY3RzXG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiBwcm9wcy5zdGlja3kpIHtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgKCkgPT4ge1xuICAgICAgc2V0SXNTY3JvbGxlZCh3aW5kb3cuc2Nyb2xsWSA+IDEwKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHZhcmlhbnQgPSAoKSA9PiBwcm9wcy52YXJpYW50IHx8ICdkZWZhdWx0JztcblxuICByZXR1cm4gKFxuICAgIDxoZWFkZXJcbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ3ctZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0yMDAnLFxuICAgICAgICB7XG4gICAgICAgICAgLy8gVmFyaWFudHNcbiAgICAgICAgICAnYmctc3VyZmFjZSBib3JkZXItYiBib3JkZXItc3VidGxlJzogdmFyaWFudCgpID09PSAnZGVmYXVsdCcsXG4gICAgICAgICAgJ2JnLXRyYW5zcGFyZW50JzogdmFyaWFudCgpID09PSAnbWluaW1hbCcgfHwgdmFyaWFudCgpID09PSAndHJhbnNwYXJlbnQnLFxuICAgICAgICAgICdiYWNrZHJvcC1ibHVyLW1kIGJnLXN1cmZhY2UvODAnOiB2YXJpYW50KCkgPT09ICd0cmFuc3BhcmVudCcgJiYgaXNTY3JvbGxlZCgpLFxuICAgICAgICAgIC8vIFN0aWNreSBiZWhhdmlvclxuICAgICAgICAgICdzdGlja3kgdG9wLTAgei01MCc6IHByb3BzLnN0aWNreSxcbiAgICAgICAgICAnc2hhZG93LWxnJzogcHJvcHMuc3RpY2t5ICYmIGlzU2Nyb2xsZWQoKSxcbiAgICAgICAgfSxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgPGRpdiBjbGFzcz1cIm1heC13LXNjcmVlbi14bCBteC1hdXRvIHB4LTQgc206cHgtNiBsZzpweC04XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gaC0xNlwiPlxuICAgICAgICAgIHsvKiBMZWZ0IHNlY3Rpb24gKi99XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC00XCI+XG4gICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zaG93TWVudUJ1dHRvbn0+XG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbk1lbnVDbGlja31cbiAgICAgICAgICAgICAgICBjbGFzcz1cInAtMiByb3VuZGVkLWxnIGhvdmVyOmJnLWhpZ2hsaWdodCB0cmFuc2l0aW9uLWNvbG9ycyBsZzpoaWRkZW5cIlxuICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCJNZW51XCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxzdmcgY2xhc3M9XCJ3LTYgaC02XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCI+XG4gICAgICAgICAgICAgICAgICA8cGF0aCBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBzdHJva2Utd2lkdGg9XCIyXCIgZD1cIk00IDZoMTZNNCAxMmgxNk00IDE4aDE2XCIgLz5cbiAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmxvZ299IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMudGl0bGV9PlxuICAgICAgICAgICAgICAgIDxoMSBjbGFzcz1cInRleHQteGwgZm9udC1ib2xkIHRleHQtcHJpbWFyeVwiPntwcm9wcy50aXRsZX08L2gxPlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICB9PlxuICAgICAgICAgICAgICB7cHJvcHMubG9nb31cbiAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgIHsvKiBSaWdodCBzZWN0aW9uICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmFjdGlvbnN9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgIHtwcm9wcy5hY3Rpb25zfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvaGVhZGVyPlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNjb3JlUGFuZWxQcm9wcyB7XG4gIHNjb3JlOiBudW1iZXIgfCBudWxsO1xuICByYW5rOiBudW1iZXIgfCBudWxsO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFNjb3JlUGFuZWw6IENvbXBvbmVudDxTY29yZVBhbmVsUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2dyaWQgZ3JpZC1jb2xzLVsxZnJfMWZyXSBnYXAtMiBwLTQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgey8qIFNjb3JlIEJveCAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJiZy1zdXJmYWNlIHJvdW5kZWQtbGcgcC00IGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIG1pbi1oLVs4MHB4XVwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0yeGwgZm9udC1tb25vIGZvbnQtYm9sZCB0ZXh0LXB1cnBsZS01MDBcIj5cbiAgICAgICAgICB7cHJvcHMuc2NvcmUgIT09IG51bGwgPyBwcm9wcy5zY29yZSA6ICfigJQnfVxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtc20gdGV4dC1zZWNvbmRhcnkgbXQtMVwiPlxuICAgICAgICAgIFNjb3JlXG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICBcbiAgICAgIHsvKiBSYW5rIEJveCAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJiZy1zdXJmYWNlIHJvdW5kZWQtbGcgcC00IGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIG1pbi1oLVs4MHB4XVwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0yeGwgZm9udC1tb25vIGZvbnQtYm9sZCB0ZXh0LXBpbmstNTAwXCI+XG4gICAgICAgICAge3Byb3BzLnJhbmsgIT09IG51bGwgPyBwcm9wcy5yYW5rIDogJ+KAlCd9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+XG4gICAgICAgICAgUmFua1xuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93LCBzcGxpdFByb3BzIH0gZnJvbSAnc29saWQtanMnXG5pbXBvcnQgdHlwZSB7IEpTWCB9IGZyb20gJ3NvbGlkLWpzJ1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbidcblxuZXhwb3J0IGludGVyZmFjZSBCdXR0b25Qcm9wcyBleHRlbmRzIEpTWC5CdXR0b25IVE1MQXR0cmlidXRlczxIVE1MQnV0dG9uRWxlbWVudD4ge1xuICB2YXJpYW50PzogJ3ByaW1hcnknIHwgJ3NlY29uZGFyeScgfCAnZ2hvc3QnIHwgJ2RhbmdlcidcbiAgc2l6ZT86ICdzbScgfCAnbWQnIHwgJ2xnJ1xuICBmdWxsV2lkdGg/OiBib29sZWFuXG4gIGxvYWRpbmc/OiBib29sZWFuXG4gIGxlZnRJY29uPzogSlNYLkVsZW1lbnRcbiAgcmlnaHRJY29uPzogSlNYLkVsZW1lbnRcbn1cblxuZXhwb3J0IGNvbnN0IEJ1dHRvbiA9IChwcm9wczogQnV0dG9uUHJvcHMpID0+IHtcbiAgY29uc3QgW2xvY2FsLCBvdGhlcnNdID0gc3BsaXRQcm9wcyhwcm9wcywgW1xuICAgICd2YXJpYW50JyxcbiAgICAnc2l6ZScsXG4gICAgJ2Z1bGxXaWR0aCcsXG4gICAgJ2xvYWRpbmcnLFxuICAgICdsZWZ0SWNvbicsXG4gICAgJ3JpZ2h0SWNvbicsXG4gICAgJ2NoaWxkcmVuJyxcbiAgICAnY2xhc3MnLFxuICAgICdkaXNhYmxlZCcsXG4gIF0pXG5cbiAgY29uc3QgdmFyaWFudCA9ICgpID0+IGxvY2FsLnZhcmlhbnQgfHwgJ3ByaW1hcnknXG4gIGNvbnN0IHNpemUgPSAoKSA9PiBsb2NhbC5zaXplIHx8ICdtZCdcblxuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIGRpc2FibGVkPXtsb2NhbC5kaXNhYmxlZCB8fCBsb2NhbC5sb2FkaW5nfVxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAnaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGZvbnQtbWVkaXVtIHRyYW5zaXRpb24tYWxsIGN1cnNvci1wb2ludGVyIG91dGxpbmUtbm9uZSBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS01MCcsXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBWYXJpYW50c1xuICAgICAgICAgICdiZy1ncmFkaWVudC1wcmltYXJ5IHRleHQtd2hpdGUgaG92ZXI6c2hhZG93LWxnIGhvdmVyOmJyaWdodG5lc3MtMTEwIGdsb3ctcHJpbWFyeSc6XG4gICAgICAgICAgICB2YXJpYW50KCkgPT09ICdwcmltYXJ5JyxcbiAgICAgICAgICAnYmctc3VyZmFjZSB0ZXh0LXByaW1hcnkgYm9yZGVyIGJvcmRlci1kZWZhdWx0IGhvdmVyOmJnLWVsZXZhdGVkIGhvdmVyOmJvcmRlci1zdHJvbmcnOlxuICAgICAgICAgICAgdmFyaWFudCgpID09PSAnc2Vjb25kYXJ5JyxcbiAgICAgICAgICAndGV4dC1zZWNvbmRhcnkgaG92ZXI6dGV4dC1wcmltYXJ5IGhvdmVyOmJnLXN1cmZhY2UnOlxuICAgICAgICAgICAgdmFyaWFudCgpID09PSAnZ2hvc3QnLFxuICAgICAgICAgICdiZy1yZWQtNjAwIHRleHQtd2hpdGUgaG92ZXI6YmctcmVkLTcwMCBob3ZlcjpzaGFkb3ctbGcnOlxuICAgICAgICAgICAgdmFyaWFudCgpID09PSAnZGFuZ2VyJyxcbiAgICAgICAgICAvLyBTaXplc1xuICAgICAgICAgICdoLTggcHgtMyB0ZXh0LXNtIHJvdW5kZWQtbWQgZ2FwLTEuNSc6IHNpemUoKSA9PT0gJ3NtJyxcbiAgICAgICAgICAnaC0xMCBweC00IHRleHQtYmFzZSByb3VuZGVkLWxnIGdhcC0yJzogc2l6ZSgpID09PSAnbWQnLFxuICAgICAgICAgICdoLTEyIHB4LTYgdGV4dC1sZyByb3VuZGVkLWxnIGdhcC0yLjUnOiBzaXplKCkgPT09ICdsZycsXG4gICAgICAgICAgLy8gRnVsbCB3aWR0aFxuICAgICAgICAgICd3LWZ1bGwnOiBsb2NhbC5mdWxsV2lkdGgsXG4gICAgICAgICAgLy8gTG9hZGluZyBzdGF0ZVxuICAgICAgICAgICdjdXJzb3Itd2FpdCc6IGxvY2FsLmxvYWRpbmcsXG4gICAgICAgIH0sXG4gICAgICAgIGxvY2FsLmNsYXNzXG4gICAgICApfVxuICAgICAgey4uLm90aGVyc31cbiAgICA+XG4gICAgICA8U2hvdyB3aGVuPXtsb2NhbC5sb2FkaW5nfT5cbiAgICAgICAgPHN2Z1xuICAgICAgICAgIGNsYXNzPVwiYW5pbWF0ZS1zcGluIGgtNCB3LTRcIlxuICAgICAgICAgIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIlxuICAgICAgICAgIGZpbGw9XCJub25lXCJcbiAgICAgICAgICB2aWV3Qm94PVwiMCAwIDI0IDI0XCJcbiAgICAgICAgPlxuICAgICAgICAgIDxjaXJjbGVcbiAgICAgICAgICAgIGNsYXNzPVwib3BhY2l0eS0yNVwiXG4gICAgICAgICAgICBjeD1cIjEyXCJcbiAgICAgICAgICAgIGN5PVwiMTJcIlxuICAgICAgICAgICAgcj1cIjEwXCJcbiAgICAgICAgICAgIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiXG4gICAgICAgICAgICBzdHJva2Utd2lkdGg9XCI0XCJcbiAgICAgICAgICAvPlxuICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICBjbGFzcz1cIm9wYWNpdHktNzVcIlxuICAgICAgICAgICAgZmlsbD1cImN1cnJlbnRDb2xvclwiXG4gICAgICAgICAgICBkPVwiTTQgMTJhOCA4IDAgMDE4LThWMEM1LjM3MyAwIDAgNS4zNzMgMCAxMmg0em0yIDUuMjkxQTcuOTYyIDcuOTYyIDAgMDE0IDEySDBjMCAzLjA0MiAxLjEzNSA1LjgyNCAzIDcuOTM4bDMtMi42NDd6XCJcbiAgICAgICAgICAvPlxuICAgICAgICA8L3N2Zz5cbiAgICAgIDwvU2hvdz5cblxuICAgICAgPFNob3cgd2hlbj17bG9jYWwubGVmdEljb24gJiYgIWxvY2FsLmxvYWRpbmd9PlxuICAgICAgICB7bG9jYWwubGVmdEljb259XG4gICAgICA8L1Nob3c+XG5cbiAgICAgIDxTaG93IHdoZW49e2xvY2FsLmNoaWxkcmVufT5cbiAgICAgICAgPHNwYW4+e2xvY2FsLmNoaWxkcmVufTwvc3Bhbj5cbiAgICAgIDwvU2hvdz5cblxuICAgICAgPFNob3cgd2hlbj17bG9jYWwucmlnaHRJY29ufT5cbiAgICAgICAge2xvY2FsLnJpZ2h0SWNvbn1cbiAgICAgIDwvU2hvdz5cbiAgICA8L2J1dHRvbj5cbiAgKVxufSIsImltcG9ydCB7IFNob3csIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vQnV0dG9uJztcblxuZXhwb3J0IHR5cGUgT25ib2FyZGluZ1N0ZXAgPSAnY29ubmVjdC13YWxsZXQnIHwgJ2dlbmVyYXRpbmctdG9rZW4nIHwgJ2NvbXBsZXRlJztcblxuZXhwb3J0IGludGVyZmFjZSBPbmJvYXJkaW5nRmxvd1Byb3BzIHtcbiAgc3RlcDogT25ib2FyZGluZ1N0ZXA7XG4gIGVycm9yPzogc3RyaW5nIHwgbnVsbDtcbiAgd2FsbGV0QWRkcmVzcz86IHN0cmluZyB8IG51bGw7XG4gIHRva2VuPzogc3RyaW5nIHwgbnVsbDtcbiAgb25Db25uZWN0V2FsbGV0OiAoKSA9PiB2b2lkO1xuICBvblVzZVRlc3RNb2RlOiAoKSA9PiB2b2lkO1xuICBvblVzZVByaXZhdGVLZXk6IChwcml2YXRlS2V5OiBzdHJpbmcpID0+IHZvaWQ7XG4gIG9uQ29tcGxldGU6ICgpID0+IHZvaWQ7XG4gIGlzQ29ubmVjdGluZz86IGJvb2xlYW47XG4gIGlzR2VuZXJhdGluZz86IGJvb2xlYW47XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgT25ib2FyZGluZ0Zsb3c6IENvbXBvbmVudDxPbmJvYXJkaW5nRmxvd1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbc2hvd1Rlc3RPcHRpb24sIHNldFNob3dUZXN0T3B0aW9uXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtzaG93UHJpdmF0ZUtleUlucHV0LCBzZXRTaG93UHJpdmF0ZUtleUlucHV0XSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtwcml2YXRlS2V5LCBzZXRQcml2YXRlS2V5XSA9IGNyZWF0ZVNpZ25hbCgnJyk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICdtaW4taC1zY3JlZW4gYmctZ3JhZGllbnQtdG8tYnIgZnJvbS1ncmF5LTkwMCB0by1ibGFjayBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlcicsXG4gICAgICBwcm9wcy5jbGFzc1xuICAgICl9PlxuICAgICAgPGRpdiBjbGFzcz1cIm1heC13LTJ4bCB3LWZ1bGwgcC0xMlwiPlxuICAgICAgICB7LyogTG9nby9IZWFkZXIgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBtYi0xMlwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTh4bCBtYi02XCI+8J+OpDwvZGl2PlxuICAgICAgICAgIDxoMSBjbGFzcz1cInRleHQtNnhsIGZvbnQtYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj5cbiAgICAgICAgICAgIFNjYXJsZXR0IEthcmFva2VcbiAgICAgICAgICA8L2gxPlxuICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC14bCB0ZXh0LWdyYXktNDAwXCI+XG4gICAgICAgICAgICBBSS1wb3dlcmVkIGthcmFva2UgZm9yIFNvdW5kQ2xvdWRcbiAgICAgICAgICA8L3A+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHsvKiBQcm9ncmVzcyBEb3RzICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBqdXN0aWZ5LWNlbnRlciBtYi0xMlwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGdhcC0zXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3ctMyBoLTMgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgICAgICAgIHByb3BzLnN0ZXAgPT09ICdjb25uZWN0LXdhbGxldCcgXG4gICAgICAgICAgICAgICAgPyAnYmctcHVycGxlLTUwMCB3LTEyJyBcbiAgICAgICAgICAgICAgICA6IHByb3BzLndhbGxldEFkZHJlc3MgXG4gICAgICAgICAgICAgICAgICA/ICdiZy1ncmVlbi01MDAnIFxuICAgICAgICAgICAgICAgICAgOiAnYmctZ3JheS02MDAnXG4gICAgICAgICAgICApfSAvPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICd3LTMgaC0zIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICAgICAgICBwcm9wcy5zdGVwID09PSAnZ2VuZXJhdGluZy10b2tlbicgXG4gICAgICAgICAgICAgICAgPyAnYmctcHVycGxlLTUwMCB3LTEyJyBcbiAgICAgICAgICAgICAgICA6IHByb3BzLnRva2VuIFxuICAgICAgICAgICAgICAgICAgPyAnYmctZ3JlZW4tNTAwJyBcbiAgICAgICAgICAgICAgICAgIDogJ2JnLWdyYXktNjAwJ1xuICAgICAgICAgICAgKX0gLz5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAndy0zIGgtMyByb3VuZGVkLWZ1bGwgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgICAgICAgcHJvcHMuc3RlcCA9PT0gJ2NvbXBsZXRlJyBcbiAgICAgICAgICAgICAgICA/ICdiZy1ncmVlbi01MDAgdy0xMicgXG4gICAgICAgICAgICAgICAgOiAnYmctZ3JheS02MDAnXG4gICAgICAgICAgICApfSAvPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICB7LyogRXJyb3IgRGlzcGxheSAqL31cbiAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuZXJyb3J9PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJtYi04IHAtNiBiZy1yZWQtOTAwLzIwIGJvcmRlciBib3JkZXItcmVkLTgwMCByb3VuZGVkLXhsXCI+XG4gICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtcmVkLTQwMCB0ZXh0LWNlbnRlciB0ZXh0LWxnXCI+e3Byb3BzLmVycm9yfTwvcD5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9TaG93PlxuXG4gICAgICAgIHsvKiBDb250ZW50ICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS02XCI+XG4gICAgICAgICAgey8qIENvbm5lY3QgV2FsbGV0IFN0ZXAgKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuc3RlcCA9PT0gJ2Nvbm5lY3Qtd2FsbGV0J30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgc3BhY2UteS04XCI+XG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC00eGwgZm9udC1zZW1pYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj5cbiAgICAgICAgICAgICAgICAgIENvbm5lY3QgWW91ciBXYWxsZXRcbiAgICAgICAgICAgICAgICA8L2gyPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTQwMCB0ZXh0LWxnIG1heC13LW1kIG14LWF1dG9cIj5cbiAgICAgICAgICAgICAgICAgIENvbm5lY3QgeW91ciB3YWxsZXQgdG8gZ2V0IHN0YXJ0ZWRcbiAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LTQgbWF4LXctbWQgbXgtYXV0b1wiPlxuICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ29ubmVjdFdhbGxldH1cbiAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5pc0Nvbm5lY3Rpbmd9XG4gICAgICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNiB0ZXh0LWxnXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICB7cHJvcHMuaXNDb25uZWN0aW5nID8gKFxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ3LTQgaC00IGJvcmRlci0yIGJvcmRlci1jdXJyZW50IGJvcmRlci1yLXRyYW5zcGFyZW50IHJvdW5kZWQtZnVsbCBhbmltYXRlLXNwaW5cIiAvPlxuICAgICAgICAgICAgICAgICAgICAgIENvbm5lY3RpbmcuLi5cbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuPvCfpoo8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgQ29ubmVjdCB3aXRoIE1ldGFNYXNrXG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgPC9CdXR0b24+XG5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXshc2hvd1Rlc3RPcHRpb24oKSAmJiAhc2hvd1ByaXZhdGVLZXlJbnB1dCgpfT5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGdhcC00IGp1c3RpZnktY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93VGVzdE9wdGlvbih0cnVlKX1cbiAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtZ3JheS01MDAgaG92ZXI6dGV4dC1ncmF5LTMwMCB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICBVc2UgZGVtbyBtb2RlXG4gICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInRleHQtZ3JheS02MDBcIj58PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd1ByaXZhdGVLZXlJbnB1dCh0cnVlKX1cbiAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtZ3JheS01MDAgaG92ZXI6dGV4dC1ncmF5LTMwMCB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICBVc2UgcHJpdmF0ZSBrZXlcbiAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtzaG93VGVzdE9wdGlvbigpfT5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwdC02IHNwYWNlLXktNFwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9yZGVyLXQgYm9yZGVyLWdyYXktODAwIHB0LTZcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblVzZVRlc3RNb2RlfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFudD1cInNlY29uZGFyeVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNFwiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgQ29udGludWUgd2l0aCBEZW1vIE1vZGVcbiAgICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93VGVzdE9wdGlvbihmYWxzZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtZ3JheS01MDAgaG92ZXI6dGV4dC1ncmF5LTMwMCB0cmFuc2l0aW9uLWNvbG9ycyBtdC0zXCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICBCYWNrXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17c2hvd1ByaXZhdGVLZXlJbnB1dCgpfT5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwdC02IHNwYWNlLXktNFwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9yZGVyLXQgYm9yZGVyLWdyYXktODAwIHB0LTZcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJwYXNzd29yZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17cHJpdmF0ZUtleSgpfVxuICAgICAgICAgICAgICAgICAgICAgICAgb25JbnB1dD17KGUpID0+IHNldFByaXZhdGVLZXkoZS5jdXJyZW50VGFyZ2V0LnZhbHVlKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiRW50ZXIgcHJpdmF0ZSBrZXlcIlxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNCBweC00IGJnLWdyYXktODAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC1sZyB0ZXh0LXdoaXRlIHBsYWNlaG9sZGVyLWdyYXktNTAwIGZvY3VzOm91dGxpbmUtbm9uZSBmb2N1czpib3JkZXItcHVycGxlLTUwMFwiXG4gICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBwcm9wcy5vblVzZVByaXZhdGVLZXkocHJpdmF0ZUtleSgpKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXshcHJpdmF0ZUtleSgpIHx8IHByaXZhdGVLZXkoKS5sZW5ndGggIT09IDY0fVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFudD1cInNlY29uZGFyeVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNCBtdC0zXCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICBDb25uZWN0IHdpdGggUHJpdmF0ZSBLZXlcbiAgICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldFNob3dQcml2YXRlS2V5SW5wdXQoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRQcml2YXRlS2V5KCcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtZ3JheS01MDAgaG92ZXI6dGV4dC1ncmF5LTMwMCB0cmFuc2l0aW9uLWNvbG9ycyBtdC0zXCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICBCYWNrXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgey8qIEdlbmVyYXRpbmcgVG9rZW4gU3RlcCAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zdGVwID09PSAnZ2VuZXJhdGluZy10b2tlbid9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIHNwYWNlLXktOFwiPlxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQtNHhsIGZvbnQtc2VtaWJvbGQgdGV4dC13aGl0ZSBtYi00XCI+XG4gICAgICAgICAgICAgICAgICBTZXR0aW5nIFVwIFlvdXIgQWNjb3VudFxuICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMud2FsbGV0QWRkcmVzc30+XG4gICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS00MDAgdGV4dC1sZyBtYi0zXCI+XG4gICAgICAgICAgICAgICAgICAgIENvbm5lY3RlZCB3YWxsZXQ6XG4gICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICA8Y29kZSBjbGFzcz1cInRleHQtbGcgdGV4dC1wdXJwbGUtNDAwIGJnLWdyYXktODAwIHB4LTQgcHktMiByb3VuZGVkLWxnIGZvbnQtbW9ubyBpbmxpbmUtYmxvY2tcIj5cbiAgICAgICAgICAgICAgICAgICAge3Byb3BzLndhbGxldEFkZHJlc3M/LnNsaWNlKDAsIDYpfS4uLntwcm9wcy53YWxsZXRBZGRyZXNzPy5zbGljZSgtNCl9XG4gICAgICAgICAgICAgICAgICA8L2NvZGU+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicHktMTJcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidy0yMCBoLTIwIGJvcmRlci00IGJvcmRlci1wdXJwbGUtNTAwIGJvcmRlci10LXRyYW5zcGFyZW50IHJvdW5kZWQtZnVsbCBhbmltYXRlLXNwaW4gbXgtYXV0b1wiIC8+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTQwMCB0ZXh0LXhsXCI+XG4gICAgICAgICAgICAgICAge3Byb3BzLmlzR2VuZXJhdGluZyBcbiAgICAgICAgICAgICAgICAgID8gJ0dlbmVyYXRpbmcgeW91ciBhY2Nlc3MgdG9rZW4uLi4nIFxuICAgICAgICAgICAgICAgICAgOiAnVmVyaWZ5aW5nIHlvdXIgYWNjb3VudC4uLid9XG4gICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgIHsvKiBDb21wbGV0ZSBTdGVwICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnN0ZXAgPT09ICdjb21wbGV0ZSd9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIHNwYWNlLXktOFwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC04eGwgbWItNlwiPvCfjok8L2Rpdj5cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC00eGwgZm9udC1zZW1pYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj5cbiAgICAgICAgICAgICAgICAgIFlvdSdyZSBBbGwgU2V0IVxuICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQteGwgbWF4LXctbWQgbXgtYXV0byBtYi04XCI+XG4gICAgICAgICAgICAgICAgICBZb3VyIGFjY291bnQgaXMgcmVhZHkuIFRpbWUgdG8gc2luZyFcbiAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy1tZCBteC1hdXRvXCI+XG4gICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25Db21wbGV0ZX1cbiAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE2IHRleHQtbGdcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIFN0YXJ0IFNpbmdpbmchIPCfmoBcbiAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIG10LTZcIj5cbiAgICAgICAgICAgICAgICBMb29rIGZvciB0aGUga2FyYW9rZSB3aWRnZXQgb24gYW55IFNvdW5kQ2xvdWQgdHJhY2tcbiAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBGb3IsIGNyZWF0ZUVmZmVjdCwgY3JlYXRlU2lnbmFsLCBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBMeXJpY0xpbmUge1xuICBpZDogc3RyaW5nO1xuICB0ZXh0OiBzdHJpbmc7XG4gIHN0YXJ0VGltZTogbnVtYmVyOyAvLyBpbiBzZWNvbmRzXG4gIGR1cmF0aW9uOiBudW1iZXI7IC8vIGluIG1pbGxpc2Vjb25kc1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEx5cmljc0Rpc3BsYXlQcm9wcyB7XG4gIGx5cmljczogTHlyaWNMaW5lW107XG4gIGN1cnJlbnRUaW1lPzogbnVtYmVyOyAvLyBpbiBtaWxsaXNlY29uZHNcbiAgaXNQbGF5aW5nPzogYm9vbGVhbjtcbiAgbGluZVNjb3Jlcz86IEFycmF5PHsgbGluZUluZGV4OiBudW1iZXI7IHNjb3JlOiBudW1iZXI7IHRyYW5zY3JpcHRpb246IHN0cmluZzsgZmVlZGJhY2s/OiBzdHJpbmcgfT47XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgTHlyaWNzRGlzcGxheTogQ29tcG9uZW50PEx5cmljc0Rpc3BsYXlQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2N1cnJlbnRMaW5lSW5kZXgsIHNldEN1cnJlbnRMaW5lSW5kZXhdID0gY3JlYXRlU2lnbmFsKC0xKTtcbiAgbGV0IGNvbnRhaW5lclJlZjogSFRNTERpdkVsZW1lbnQgfCB1bmRlZmluZWQ7XG4gIFxuICAvLyBIZWxwZXIgdG8gZ2V0IHNjb3JlIGZvciBhIGxpbmVcbiAgY29uc3QgZ2V0TGluZVNjb3JlID0gKGxpbmVJbmRleDogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIHByb3BzLmxpbmVTY29yZXM/LmZpbmQocyA9PiBzLmxpbmVJbmRleCA9PT0gbGluZUluZGV4KT8uc2NvcmUgfHwgbnVsbDtcbiAgfTtcbiAgXG4gIC8vIEhlbHBlciB0byBnZXQgY29sb3IgYmFzZWQgb24gc2NvcmVcbiAgY29uc3QgZ2V0U2NvcmVTdHlsZSA9IChzY29yZTogbnVtYmVyIHwgbnVsbCkgPT4ge1xuICAgIGlmIChzY29yZSA9PT0gbnVsbCkgcmV0dXJuIHt9O1xuICAgIFxuICAgIC8vIFNpbXBsZSBjb2xvciBjaGFuZ2VzIG9ubHkgLSBubyBhbmltYXRpb25zIG9yIGVmZmVjdHNcbiAgICBpZiAoc2NvcmUgPj0gOTUpIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmMzgzOCcgfTtcbiAgICB9IGVsc2UgaWYgKHNjb3JlID49IDkwKSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZjZiNmInIH07XG4gICAgfSBlbHNlIGlmIChzY29yZSA+PSA4MCkge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmY4Nzg3JyB9O1xuICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gNzApIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmYThhOCcgfTtcbiAgICB9IGVsc2UgaWYgKHNjb3JlID49IDYwKSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZmNlY2UnIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmZTBlMCcgfTtcbiAgICB9XG4gIH07XG4gIFxuICAvLyBSZW1vdmVkIGVtb2ppIGZ1bmN0aW9uIC0gdXNpbmcgY29sb3JzIG9ubHlcblxuICAvLyBGaW5kIGN1cnJlbnQgbGluZSBiYXNlZCBvbiB0aW1lXG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFwcm9wcy5jdXJyZW50VGltZSB8fCAhcHJvcHMubHlyaWNzLmxlbmd0aCkge1xuICAgICAgc2V0Q3VycmVudExpbmVJbmRleCgtMSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGltZSA9IHByb3BzLmN1cnJlbnRUaW1lIC8gMTAwMDsgLy8gQ29udmVydCBmcm9tIG1pbGxpc2Vjb25kcyB0byBzZWNvbmRzXG4gICAgY29uc3QgVElNSU5HX09GRlNFVCA9IDAuMzsgLy8gT2Zmc2V0IHRvIG1ha2UgbHlyaWNzIGFwcGVhciAwLjNzIGVhcmxpZXJcbiAgICBjb25zdCBhZGp1c3RlZFRpbWUgPSB0aW1lICsgVElNSU5HX09GRlNFVDtcbiAgICBcbiAgICAvLyBGaW5kIHRoZSBsaW5lIHRoYXQgY29udGFpbnMgdGhlIGN1cnJlbnQgdGltZVxuICAgIGxldCBmb3VuZEluZGV4ID0gLTE7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcm9wcy5seXJpY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBwcm9wcy5seXJpY3NbaV07XG4gICAgICBpZiAoIWxpbmUpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgZW5kVGltZSA9IGxpbmUuc3RhcnRUaW1lICsgbGluZS5kdXJhdGlvbiAvIDEwMDA7IC8vIENvbnZlcnQgZHVyYXRpb24gZnJvbSBtcyB0byBzZWNvbmRzXG4gICAgICBcbiAgICAgIGlmIChhZGp1c3RlZFRpbWUgPj0gbGluZS5zdGFydFRpbWUgJiYgYWRqdXN0ZWRUaW1lIDwgZW5kVGltZSkge1xuICAgICAgICBmb3VuZEluZGV4ID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIElmIG5vIGxpbmUgY29udGFpbnMgY3VycmVudCB0aW1lLCBmaW5kIHRoZSBtb3N0IHJlY2VudCBwYXN0IGxpbmVcbiAgICBpZiAoZm91bmRJbmRleCA9PT0gLTEgJiYgdGltZSA+IDApIHtcbiAgICAgIGZvciAobGV0IGkgPSBwcm9wcy5seXJpY3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgY29uc3QgbGluZSA9IHByb3BzLmx5cmljc1tpXTtcbiAgICAgICAgaWYgKCFsaW5lKSBjb250aW51ZTtcbiAgICAgICAgaWYgKHRpbWUgPj0gbGluZS5zdGFydFRpbWUpIHtcbiAgICAgICAgICBmb3VuZEluZGV4ID0gaTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBPbmx5IHVwZGF0ZSBpZiB0aGUgaW5kZXggaGFzIGNoYW5nZWQgdG8gYXZvaWQgdW5uZWNlc3Nhcnkgc2Nyb2xsaW5nXG4gICAgaWYgKGZvdW5kSW5kZXggIT09IGN1cnJlbnRMaW5lSW5kZXgoKSkge1xuICAgICAgY29uc3QgcHJldkluZGV4ID0gY3VycmVudExpbmVJbmRleCgpO1xuICAgICAgLy8gT25seSBsb2cgbGFyZ2UganVtcHMgdG8gcmVkdWNlIGNvbnNvbGUgc3BhbVxuICAgICAgaWYgKE1hdGguYWJzKGZvdW5kSW5kZXggLSBwcmV2SW5kZXgpID4gNSkge1xuICAgICAgICBjb25zb2xlLmxvZygnW0x5cmljc0Rpc3BsYXldIEN1cnJlbnQgbGluZSBjaGFuZ2VkOicsIHtcbiAgICAgICAgICBmcm9tOiBwcmV2SW5kZXgsXG4gICAgICAgICAgdG86IGZvdW5kSW5kZXgsXG4gICAgICAgICAgdGltZTogcHJvcHMuY3VycmVudFRpbWUsXG4gICAgICAgICAgdGltZUluU2Vjb25kczogdGltZSxcbiAgICAgICAgICBqdW1wOiBNYXRoLmFicyhmb3VuZEluZGV4IC0gcHJldkluZGV4KVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gTG9nIHdhcm5pbmcgZm9yIGxhcmdlIGp1bXBzXG4gICAgICBpZiAocHJldkluZGV4ICE9PSAtMSAmJiBNYXRoLmFicyhmb3VuZEluZGV4IC0gcHJldkluZGV4KSA+IDEwKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW0x5cmljc0Rpc3BsYXldIExhcmdlIGxpbmUganVtcCBkZXRlY3RlZCEnLCB7XG4gICAgICAgICAgZnJvbTogcHJldkluZGV4LFxuICAgICAgICAgIHRvOiBmb3VuZEluZGV4LFxuICAgICAgICAgIGZyb21MaW5lOiBwcm9wcy5seXJpY3NbcHJldkluZGV4XSxcbiAgICAgICAgICB0b0xpbmU6IHByb3BzLmx5cmljc1tmb3VuZEluZGV4XVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgc2V0Q3VycmVudExpbmVJbmRleChmb3VuZEluZGV4KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEF1dG8tc2Nyb2xsIHRvIGN1cnJlbnQgbGluZVxuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IGluZGV4ID0gY3VycmVudExpbmVJbmRleCgpO1xuICAgIGlmIChpbmRleCA9PT0gLTEgfHwgIWNvbnRhaW5lclJlZiB8fCAhcHJvcHMuaXNQbGF5aW5nKSByZXR1cm47XG5cbiAgICBjb25zdCBsaW5lRWxlbWVudHMgPSBjb250YWluZXJSZWYucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtbGluZS1pbmRleF0nKTtcbiAgICBjb25zdCBjdXJyZW50RWxlbWVudCA9IGxpbmVFbGVtZW50c1tpbmRleF0gYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICBpZiAoY3VycmVudEVsZW1lbnQpIHtcbiAgICAgIGNvbnN0IGNvbnRhaW5lckhlaWdodCA9IGNvbnRhaW5lclJlZi5jbGllbnRIZWlnaHQ7XG4gICAgICBjb25zdCBsaW5lVG9wID0gY3VycmVudEVsZW1lbnQub2Zmc2V0VG9wO1xuICAgICAgY29uc3QgbGluZUhlaWdodCA9IGN1cnJlbnRFbGVtZW50Lm9mZnNldEhlaWdodDtcbiAgICAgIFxuICAgICAgLy8gQ2VudGVyIHRoZSBjdXJyZW50IGxpbmVcbiAgICAgIGNvbnN0IHRhcmdldFNjcm9sbFRvcCA9IGxpbmVUb3AgLSBjb250YWluZXJIZWlnaHQgLyAyICsgbGluZUhlaWdodCAvIDI7XG4gICAgICBcbiAgICAgIGNvbnRhaW5lclJlZi5zY3JvbGxUbyh7XG4gICAgICAgIHRvcDogdGFyZ2V0U2Nyb2xsVG9wLFxuICAgICAgICBiZWhhdmlvcjogJ3Ntb290aCcsXG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgcmVmPXtjb250YWluZXJSZWZ9XG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdseXJpY3MtZGlzcGxheSBvdmVyZmxvdy15LWF1dG8gc2Nyb2xsLXNtb290aCcsXG4gICAgICAgICdoLWZ1bGwgcHgtNiBweS0xMicsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LThcIj5cbiAgICAgICAgPEZvciBlYWNoPXtwcm9wcy5seXJpY3N9PlxuICAgICAgICAgIHsobGluZSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVTY29yZSA9ICgpID0+IGdldExpbmVTY29yZShpbmRleCgpKTtcbiAgICAgICAgICAgIGNvbnN0IHNjb3JlU3R5bGUgPSAoKSA9PiBnZXRTY29yZVN0eWxlKGxpbmVTY29yZSgpKTtcbiAgICAgICAgICAgIC8vIFVzaW5nIGNvbG9yIGdyYWRpZW50cyBpbnN0ZWFkIG9mIGVtb2ppc1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgZGF0YS1saW5lLWluZGV4PXtpbmRleCgpfVxuICAgICAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAgICd0ZXh0LWNlbnRlcicsXG4gICAgICAgICAgICAgICAgICAndGV4dC0yeGwgbGVhZGluZy1yZWxheGVkJyxcbiAgICAgICAgICAgICAgICAgIGluZGV4KCkgPT09IGN1cnJlbnRMaW5lSW5kZXgoKVxuICAgICAgICAgICAgICAgICAgICA/ICdvcGFjaXR5LTEwMCdcbiAgICAgICAgICAgICAgICAgICAgOiAnb3BhY2l0eS02MCdcbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICBjb2xvcjogaW5kZXgoKSA9PT0gY3VycmVudExpbmVJbmRleCgpICYmICFsaW5lU2NvcmUoKSBcbiAgICAgICAgICAgICAgICAgICAgPyAnI2ZmZmZmZicgLy8gV2hpdGUgZm9yIGN1cnJlbnQgbGluZSB3aXRob3V0IHNjb3JlXG4gICAgICAgICAgICAgICAgICAgIDogc2NvcmVTdHlsZSgpLmNvbG9yIHx8ICcjZmZmZmZmJ1xuICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICB7bGluZS50ZXh0fVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfX1cbiAgICAgICAgPC9Gb3I+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlSGVhZGVyUHJvcHMge1xuICBzb25nVGl0bGU6IHN0cmluZztcbiAgYXJ0aXN0OiBzdHJpbmc7XG4gIG9uQmFjaz86ICgpID0+IHZvaWQ7XG4gIGlzUGxheWluZz86IGJvb2xlYW47XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5jb25zdCBDaGV2cm9uTGVmdCA9ICgpID0+IChcbiAgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgY2xhc3M9XCJ3LTYgaC02XCI+XG4gICAgPHBhdGggc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIgZD1cIk0xNSAxOWwtNy03IDctN1wiIC8+XG4gIDwvc3ZnPlxuKTtcblxuY29uc3QgUGF1c2VJY29uID0gKCkgPT4gKFxuICA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBjbGFzcz1cInctNiBoLTZcIj5cbiAgICA8cGF0aCBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBkPVwiTTEwIDl2Nm00LTZ2Nm03LTNhOSA5IDAgMTEtMTggMCA5IDkgMCAwMTE4IDB6XCIgLz5cbiAgPC9zdmc+XG4pO1xuXG5leHBvcnQgY29uc3QgS2FyYW9rZUhlYWRlcjogQ29tcG9uZW50PEthcmFva2VIZWFkZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbigncmVsYXRpdmUgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcC00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBCYWNrL1BhdXNlIGJ1dHRvbiAtIGFic29sdXRlIHBvc2l0aW9uZWQgKi99XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQmFja31cbiAgICAgICAgY2xhc3M9XCJhYnNvbHV0ZSBsZWZ0LTQgcC0yIC1tLTIgdGV4dC1zZWNvbmRhcnkgaG92ZXI6dGV4dC1wcmltYXJ5IHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgYXJpYS1sYWJlbD17cHJvcHMuaXNQbGF5aW5nID8gXCJQYXVzZVwiIDogXCJHbyBiYWNrXCJ9XG4gICAgICA+XG4gICAgICAgIHtwcm9wcy5pc1BsYXlpbmcgPyA8UGF1c2VJY29uIC8+IDogPENoZXZyb25MZWZ0IC8+fVxuICAgICAgPC9idXR0b24+XG4gICAgICBcbiAgICAgIHsvKiBTb25nIGluZm8gLSBjZW50ZXJlZCAqL31cbiAgICAgIDxoMSBjbGFzcz1cInRleHQtYmFzZSBmb250LW1lZGl1bSB0ZXh0LXByaW1hcnkgdGV4dC1jZW50ZXIgcHgtMTIgdHJ1bmNhdGUgbWF4LXctZnVsbFwiPlxuICAgICAgICB7cHJvcHMuc29uZ1RpdGxlfSAtIHtwcm9wcy5hcnRpc3R9XG4gICAgICA8L2gxPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBGb3IsIFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIExlYWRlcmJvYXJkRW50cnkge1xuICByYW5rOiBudW1iZXI7XG4gIHVzZXJuYW1lOiBzdHJpbmc7XG4gIHNjb3JlOiBudW1iZXI7XG4gIGlzQ3VycmVudFVzZXI/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIExlYWRlcmJvYXJkUGFuZWxQcm9wcyB7XG4gIGVudHJpZXM6IExlYWRlcmJvYXJkRW50cnlbXTtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBMZWFkZXJib2FyZFBhbmVsOiBDb21wb25lbnQ8TGVhZGVyYm9hcmRQYW5lbFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sIGdhcC0yIHAtNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8U2hvdyBcbiAgICAgICAgd2hlbj17cHJvcHMuZW50cmllcy5sZW5ndGggPiAwfVxuICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHB5LTEyIHB4LTYgdGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTZ4bCBtYi00IG9wYWNpdHktMzBcIj7wn46kPC9kaXY+XG4gICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1zZWNvbmRhcnkgbWItMlwiPk5vYm9keSBoYXMgY29tcGxldGVkIHRoaXMgc29uZyB5ZXQhPC9wPlxuICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtdGVydGlhcnlcIj5CZSB0aGUgZmlyc3QgdG8gc2V0IGEgaGlnaCBzY29yZTwvcD5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgfVxuICAgICAgPlxuICAgICAgICA8Rm9yIGVhY2g9e3Byb3BzLmVudHJpZXN9PlxuICAgICAgICAgIHsoZW50cnkpID0+IChcbiAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAnZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgcHgtMyBweS0yIHJvdW5kZWQtbGcgdHJhbnNpdGlvbi1jb2xvcnMnLFxuICAgICAgICAgICAgICAgIGVudHJ5LmlzQ3VycmVudFVzZXIgXG4gICAgICAgICAgICAgICAgICA/ICdiZy1hY2NlbnQtcHJpbWFyeS8xMCBib3JkZXIgYm9yZGVyLWFjY2VudC1wcmltYXJ5LzIwJyBcbiAgICAgICAgICAgICAgICAgIDogJ2JnLXN1cmZhY2UgaG92ZXI6Ymctc3VyZmFjZS1ob3ZlcidcbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPHNwYW4gXG4gICAgICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICAgJ3ctOCB0ZXh0LWNlbnRlciBmb250LW1vbm8gZm9udC1ib2xkJyxcbiAgICAgICAgICAgICAgICAgIGVudHJ5LnJhbmsgPD0gMyA/ICd0ZXh0LWFjY2VudC1wcmltYXJ5JyA6ICd0ZXh0LXNlY29uZGFyeSdcbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgI3tlbnRyeS5yYW5rfVxuICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAnZmxleC0xIHRydW5jYXRlJyxcbiAgICAgICAgICAgICAgICBlbnRyeS5pc0N1cnJlbnRVc2VyID8gJ3RleHQtYWNjZW50LXByaW1hcnkgZm9udC1tZWRpdW0nIDogJ3RleHQtcHJpbWFyeSdcbiAgICAgICAgICAgICAgKX0+XG4gICAgICAgICAgICAgICAge2VudHJ5LnVzZXJuYW1lfVxuICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAnZm9udC1tb25vIGZvbnQtYm9sZCcsXG4gICAgICAgICAgICAgICAgZW50cnkuaXNDdXJyZW50VXNlciA/ICd0ZXh0LWFjY2VudC1wcmltYXJ5JyA6ICd0ZXh0LXByaW1hcnknXG4gICAgICAgICAgICAgICl9PlxuICAgICAgICAgICAgICAgIHtlbnRyeS5zY29yZS50b0xvY2FsZVN0cmluZygpfVxuICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApfVxuICAgICAgICA8L0Zvcj5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IHR5cGUgUGxheWJhY2tTcGVlZCA9ICcxeCcgfCAnMC43NXgnIHwgJzAuNXgnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNwbGl0QnV0dG9uUHJvcHMge1xuICBvblN0YXJ0PzogKCkgPT4gdm9pZDtcbiAgb25TcGVlZENoYW5nZT86IChzcGVlZDogUGxheWJhY2tTcGVlZCkgPT4gdm9pZDtcbiAgZGlzYWJsZWQ/OiBib29sZWFuO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuY29uc3Qgc3BlZWRzOiBQbGF5YmFja1NwZWVkW10gPSBbJzF4JywgJzAuNzV4JywgJzAuNXgnXTtcblxuZXhwb3J0IGNvbnN0IFNwbGl0QnV0dG9uOiBDb21wb25lbnQ8U3BsaXRCdXR0b25Qcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2N1cnJlbnRTcGVlZEluZGV4LCBzZXRDdXJyZW50U3BlZWRJbmRleF0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIFxuICBjb25zdCBjdXJyZW50U3BlZWQgPSAoKSA9PiBzcGVlZHNbY3VycmVudFNwZWVkSW5kZXgoKV07XG4gIFxuICBjb25zdCBjeWNsZVNwZWVkID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBjb25zdCBuZXh0SW5kZXggPSAoY3VycmVudFNwZWVkSW5kZXgoKSArIDEpICUgc3BlZWRzLmxlbmd0aDtcbiAgICBzZXRDdXJyZW50U3BlZWRJbmRleChuZXh0SW5kZXgpO1xuICAgIGNvbnN0IG5ld1NwZWVkID0gc3BlZWRzW25leHRJbmRleF07XG4gICAgaWYgKG5ld1NwZWVkKSB7XG4gICAgICBwcm9wcy5vblNwZWVkQ2hhbmdlPy4obmV3U3BlZWQpO1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGhhbmRsZVN0YXJ0ID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBwcm9wcy5vblN0YXJ0Py4oKTtcbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdyZWxhdGl2ZSBpbmxpbmUtZmxleCB3LWZ1bGwgcm91bmRlZC1sZyBvdmVyZmxvdy1oaWRkZW4nLFxuICAgICAgICAnYmctZ3JhZGllbnQtcHJpbWFyeSB0ZXh0LXdoaXRlIHNoYWRvdy1sZycsXG4gICAgICAgICd0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICB7LyogTWFpbiBidXR0b24gKi99XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e2hhbmRsZVN0YXJ0fVxuICAgICAgICBkaXNhYmxlZD17cHJvcHMuZGlzYWJsZWR9XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnZmxleC0xIGlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByZWxhdGl2ZSBvdmVyZmxvdy1oaWRkZW4nLFxuICAgICAgICAgICdoLTEyIHB4LTYgdGV4dC1sZyBmb250LW1lZGl1bScsXG4gICAgICAgICAgJ2N1cnNvci1wb2ludGVyIGJvcmRlci1ub25lIG91dGxpbmUtbm9uZScsXG4gICAgICAgICAgJ2Rpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAgICAnaG92ZXI6Ymctd2hpdGUvMTAgYWN0aXZlOmJnLXdoaXRlLzIwJyxcbiAgICAgICAgICAndHJhbnNpdGlvbi1jb2xvcnMnXG4gICAgICAgICl9XG4gICAgICA+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwicmVsYXRpdmUgei0xMFwiPlN0YXJ0PC9zcGFuPlxuICAgICAgPC9idXR0b24+XG4gICAgICBcbiAgICAgIHsvKiBEaXZpZGVyICovfVxuICAgICAgPGRpdiBjbGFzcz1cInctcHggYmctYmxhY2svMjBcIiAvPlxuICAgICAgXG4gICAgICB7LyogU3BlZWQgYnV0dG9uICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtjeWNsZVNwZWVkfVxuICAgICAgICBkaXNhYmxlZD17cHJvcHMuZGlzYWJsZWR9XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJlbGF0aXZlJyxcbiAgICAgICAgICAndy0xNiB0ZXh0LWJhc2UgZm9udC1tZWRpdW0nLFxuICAgICAgICAgICdjdXJzb3ItcG9pbnRlciBib3JkZXItbm9uZSBvdXRsaW5lLW5vbmUnLFxuICAgICAgICAgICdkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS01MCcsXG4gICAgICAgICAgJ2hvdmVyOmJnLXdoaXRlLzEwIGFjdGl2ZTpiZy13aGl0ZS8yMCcsXG4gICAgICAgICAgJ3RyYW5zaXRpb24tY29sb3JzJyxcbiAgICAgICAgICAnYm9yZGVyLWwgYm9yZGVyLWwtYmxhY2svMjAnXG4gICAgICAgICl9XG4gICAgICAgIGFyaWEtbGFiZWw9XCJDaGFuZ2UgcGxheWJhY2sgc3BlZWRcIlxuICAgICAgICB0aXRsZT1cIkNoYW5nZSBwbGF5YmFjayBzcGVlZFwiXG4gICAgICA+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwicmVsYXRpdmUgei0xMCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMVwiPlxuICAgICAgICAgIDxzcGFuPntjdXJyZW50U3BlZWQoKX08L3NwYW4+XG4gICAgICAgICAgPHN2ZyB3aWR0aD1cIjhcIiBoZWlnaHQ9XCI4XCIgdmlld0JveD1cIjAgMCA4IDhcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBjbGFzcz1cIm9wYWNpdHktNjBcIj5cbiAgICAgICAgICAgIDxwYXRoIGQ9XCJNMiAzTDQgNUw2IDNcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIxLjVcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIi8+XG4gICAgICAgICAgPC9zdmc+XG4gICAgICAgIDwvc3Bhbj5cbiAgICAgIDwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIFNob3csIGNyZWF0ZUNvbnRleHQsIHVzZUNvbnRleHQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCwgSlNYLCBQYXJlbnRDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBUYWIge1xuICBpZDogc3RyaW5nO1xuICBsYWJlbDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNQcm9wcyB7XG4gIHRhYnM6IFRhYltdO1xuICBkZWZhdWx0VGFiPzogc3RyaW5nO1xuICBvblRhYkNoYW5nZT86ICh0YWJJZDogc3RyaW5nKSA9PiB2b2lkO1xuICBjaGlsZHJlbjogSlNYLkVsZW1lbnQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNMaXN0UHJvcHMge1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNUcmlnZ2VyUHJvcHMge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNDb250ZW50UHJvcHMge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG4vLyBDb250ZXh0IGZvciB0YWJzIHN0YXRlXG5pbnRlcmZhY2UgVGFic0NvbnRleHRWYWx1ZSB7XG4gIGFjdGl2ZVRhYjogKCkgPT4gc3RyaW5nO1xuICBzZXRBY3RpdmVUYWI6IChpZDogc3RyaW5nKSA9PiB2b2lkO1xufVxuXG5jb25zdCBUYWJzQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8VGFic0NvbnRleHRWYWx1ZT4oKTtcblxuZXhwb3J0IGNvbnN0IFRhYnM6IFBhcmVudENvbXBvbmVudDxUYWJzUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFthY3RpdmVUYWIsIHNldEFjdGl2ZVRhYl0gPSBjcmVhdGVTaWduYWwocHJvcHMuZGVmYXVsdFRhYiB8fCBwcm9wcy50YWJzWzBdPy5pZCB8fCAnJyk7XG4gIFxuICBcbiAgY29uc3QgaGFuZGxlVGFiQ2hhbmdlID0gKGlkOiBzdHJpbmcpID0+IHtcbiAgICBzZXRBY3RpdmVUYWIoaWQpO1xuICAgIHByb3BzLm9uVGFiQ2hhbmdlPy4oaWQpO1xuICB9O1xuXG4gIGNvbnN0IGNvbnRleHRWYWx1ZTogVGFic0NvbnRleHRWYWx1ZSA9IHtcbiAgICBhY3RpdmVUYWIsXG4gICAgc2V0QWN0aXZlVGFiOiBoYW5kbGVUYWJDaGFuZ2VcbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxUYWJzQ29udGV4dC5Qcm92aWRlciB2YWx1ZT17Y29udGV4dFZhbHVlfT5cbiAgICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sJywgcHJvcHMuY2xhc3MpfT5cbiAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgPC9kaXY+XG4gICAgPC9UYWJzQ29udGV4dC5Qcm92aWRlcj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBUYWJzTGlzdDogQ29tcG9uZW50PFRhYnNMaXN0UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBcbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2ZsZXggaC0xMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1tZCBiZy1lbGV2YXRlZCBwLTEgdGV4dC1zZWNvbmRhcnknLFxuICAgICAgICAnYm9yZGVyIGJvcmRlci1zdWJ0bGUgdy1mdWxsJyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgIDwvZGl2PlxuICApO1xufTtcblxuZXhwb3J0IGNvbnN0IFRhYnNUcmlnZ2VyOiBDb21wb25lbnQ8VGFic1RyaWdnZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgY29udGV4dCA9IHVzZUNvbnRleHQoVGFic0NvbnRleHQpO1xuICBpZiAoIWNvbnRleHQpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbVGFic1RyaWdnZXJdIE5vIFRhYnNDb250ZXh0IGZvdW5kLiBUYWJzVHJpZ2dlciBtdXN0IGJlIHVzZWQgd2l0aGluIFRhYnMgY29tcG9uZW50LicpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIFxuICBjb25zdCBpc0FjdGl2ZSA9ICgpID0+IGNvbnRleHQuYWN0aXZlVGFiKCkgPT09IHByb3BzLnZhbHVlO1xuXG4gIHJldHVybiAoXG4gICAgPGJ1dHRvblxuICAgICAgb25DbGljaz17KCkgPT4gY29udGV4dC5zZXRBY3RpdmVUYWIocHJvcHMudmFsdWUpfVxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAnaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHdoaXRlc3BhY2Utbm93cmFwIHJvdW5kZWQtc20gcHgtMyBweS0xLjUnLFxuICAgICAgICAndGV4dC1zbSBmb250LW1lZGl1bSByaW5nLW9mZnNldC1iYXNlIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMCcsXG4gICAgICAgICdmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZSBmb2N1cy12aXNpYmxlOnJpbmctMiBmb2N1cy12aXNpYmxlOnJpbmctcHVycGxlLTUwMCBmb2N1cy12aXNpYmxlOnJpbmctb2Zmc2V0LTInLFxuICAgICAgICAnZGlzYWJsZWQ6cG9pbnRlci1ldmVudHMtbm9uZSBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAgJ2ZsZXgtMSByZWxhdGl2ZScsXG4gICAgICAgIGlzQWN0aXZlKClcbiAgICAgICAgICA/ICdiZy1zdXJmYWNlIHRleHQtcHJpbWFyeSBzaGFkb3ctc20gYm9yZGVyIGJvcmRlci1kZWZhdWx0J1xuICAgICAgICAgIDogJ3RleHQtc2Vjb25kYXJ5IGhvdmVyOnRleHQtcHJpbWFyeSBob3ZlcjpiZy1oaWdobGlnaHQvNTAnLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgPC9idXR0b24+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgVGFic0NvbnRlbnQ6IENvbXBvbmVudDxUYWJzQ29udGVudFByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBjb250ZXh0ID0gdXNlQ29udGV4dChUYWJzQ29udGV4dCk7XG4gIGlmICghY29udGV4dCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1tUYWJzQ29udGVudF0gTm8gVGFic0NvbnRleHQgZm91bmQuIFRhYnNDb250ZW50IG11c3QgYmUgdXNlZCB3aXRoaW4gVGFicyBjb21wb25lbnQuJyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgXG4gIGNvbnN0IGlzQWN0aXZlID0gKCkgPT4gY29udGV4dC5hY3RpdmVUYWIoKSA9PT0gcHJvcHMudmFsdWU7XG4gIFxuICByZXR1cm4gKFxuICAgIDxTaG93IHdoZW49e2lzQWN0aXZlKCl9PlxuICAgICAgPGRpdlxuICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgJ210LTIgcmluZy1vZmZzZXQtYmFzZSBmbGV4LTEnLFxuICAgICAgICAgICdmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZSBmb2N1cy12aXNpYmxlOnJpbmctMiBmb2N1cy12aXNpYmxlOnJpbmctcHVycGxlLTUwMCBmb2N1cy12aXNpYmxlOnJpbmctb2Zmc2V0LTInLFxuICAgICAgICAgIHByb3BzLmNsYXNzXG4gICAgICAgICl9XG4gICAgICA+XG4gICAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICAgIDwvZGl2PlxuICAgIDwvU2hvdz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsLCBjcmVhdGVFZmZlY3QsIFNob3csIG9uQ2xlYW51cCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5pbXBvcnQgc3R5bGVzIGZyb20gJy4vRmlyZUVtb2ppQW5pbWF0aW9uLm1vZHVsZS5jc3MnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZpcmVFbW9qaUFuaW1hdGlvblByb3BzIHtcbiAgc2NvcmU6IG51bWJlcjtcbiAgbGluZUluZGV4OiBudW1iZXI7IC8vIFVzZSBsaW5lIGluZGV4IGluc3RlYWQgb2YgdHJpZ2dlclxuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEZpcmVFbW9qaUFuaW1hdGlvbjogQ29tcG9uZW50PEZpcmVFbW9qaUFuaW1hdGlvblByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbc2hvd0ZpcmUsIHNldFNob3dGaXJlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtmaXJlWCwgc2V0RmlyZVhdID0gY3JlYXRlU2lnbmFsKDUwKTtcbiAgbGV0IGxhc3RMaW5lSW5kZXggPSAtMTtcbiAgbGV0IGhpZGVUaW1lcjogbnVtYmVyIHwgdW5kZWZpbmVkO1xuICBcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICAvLyBDaGVjayBpZiB3ZSBoYXZlIGEgbmV3IGxpbmUgd2l0aCBoaWdoIHNjb3JlXG4gICAgaWYgKHByb3BzLmxpbmVJbmRleCA+IGxhc3RMaW5lSW5kZXggJiYgcHJvcHMuc2NvcmUgPj0gODApIHtcbiAgICAgIC8vIFJhbmRvbSBYIHBvc2l0aW9uIGJldHdlZW4gMjAlIGFuZCA4MCVcbiAgICAgIHNldEZpcmVYKDIwICsgTWF0aC5yYW5kb20oKSAqIDYwKTtcbiAgICAgIHNldFNob3dGaXJlKHRydWUpO1xuICAgICAgXG4gICAgICAvLyBDbGVhciBleGlzdGluZyB0aW1lclxuICAgICAgaWYgKGhpZGVUaW1lcikgY2xlYXJUaW1lb3V0KGhpZGVUaW1lcik7XG4gICAgICBcbiAgICAgIC8vIEhpZGUgYWZ0ZXIgYW5pbWF0aW9uIGNvbXBsZXRlc1xuICAgICAgaGlkZVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHNldFNob3dGaXJlKGZhbHNlKTtcbiAgICAgIH0sIDIwMDApO1xuICAgICAgXG4gICAgICBsYXN0TGluZUluZGV4ID0gcHJvcHMubGluZUluZGV4O1xuICAgIH1cbiAgfSk7XG4gIFxuICBvbkNsZWFudXAoKCkgPT4ge1xuICAgIGlmIChoaWRlVGltZXIpIGNsZWFyVGltZW91dChoaWRlVGltZXIpO1xuICB9KTtcblxuICByZXR1cm4gKFxuICAgIDxTaG93IHdoZW49e3Nob3dGaXJlKCl9PlxuICAgICAgPGRpdiBjbGFzcz17Y24oc3R5bGVzLmZpcmVDb250YWluZXIsIHByb3BzLmNsYXNzKX0+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICBjbGFzcz17c3R5bGVzLmZpcmVFbW9qaX1cbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgbGVmdDogYCR7ZmlyZVgoKX0lYCxcbiAgICAgICAgICAgICdmb250LXNpemUnOiAnMzJweCdcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAg8J+UpVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvU2hvdz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdywgdHlwZSBDb21wb25lbnQsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlRWZmZWN0IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5pbXBvcnQgeyBTY29yZVBhbmVsIH0gZnJvbSAnLi4vLi4vZGlzcGxheS9TY29yZVBhbmVsJztcbmltcG9ydCB7IEx5cmljc0Rpc3BsYXksIHR5cGUgTHlyaWNMaW5lIH0gZnJvbSAnLi4vTHlyaWNzRGlzcGxheSc7XG5pbXBvcnQgeyBMZWFkZXJib2FyZFBhbmVsLCB0eXBlIExlYWRlcmJvYXJkRW50cnkgfSBmcm9tICcuLi9MZWFkZXJib2FyZFBhbmVsJztcbmltcG9ydCB7IFNwbGl0QnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL1NwbGl0QnV0dG9uJztcbmltcG9ydCB0eXBlIHsgUGxheWJhY2tTcGVlZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5pbXBvcnQgeyBUYWJzLCBUYWJzTGlzdCwgVGFic1RyaWdnZXIsIFRhYnNDb250ZW50IH0gZnJvbSAnLi4vLi4vY29tbW9uL1RhYnMnO1xuaW1wb3J0IHsgRmlyZUVtb2ppQW5pbWF0aW9uIH0gZnJvbSAnLi4vLi4vZWZmZWN0cy9GaXJlRW1vamlBbmltYXRpb24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4dGVuc2lvbkthcmFva2VWaWV3UHJvcHMge1xuICAvLyBTY29yZXNcbiAgc2NvcmU6IG51bWJlcjtcbiAgcmFuazogbnVtYmVyO1xuICBcbiAgLy8gTHlyaWNzXG4gIGx5cmljczogTHlyaWNMaW5lW107XG4gIGN1cnJlbnRUaW1lPzogbnVtYmVyO1xuICBcbiAgLy8gTGVhZGVyYm9hcmRcbiAgbGVhZGVyYm9hcmQ6IExlYWRlcmJvYXJkRW50cnlbXTtcbiAgXG4gIC8vIFN0YXRlXG4gIGlzUGxheWluZz86IGJvb2xlYW47XG4gIGlzUmVjb3JkaW5nPzogYm9vbGVhbjtcbiAgb25TdGFydD86ICgpID0+IHZvaWQ7XG4gIG9uU3BlZWRDaGFuZ2U/OiAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpID0+IHZvaWQ7XG4gIFxuICAvLyBMaW5lIHNjb3JlcyBmb3IgdmlzdWFsIGZlZWRiYWNrXG4gIGxpbmVTY29yZXM/OiBBcnJheTx7IGxpbmVJbmRleDogbnVtYmVyOyBzY29yZTogbnVtYmVyOyB0cmFuc2NyaXB0aW9uOiBzdHJpbmc7IGZlZWRiYWNrPzogc3RyaW5nIH0+O1xuICBcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBFeHRlbnNpb25LYXJhb2tlVmlldzogQ29tcG9uZW50PEV4dGVuc2lvbkthcmFva2VWaWV3UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIC8vIEdldCB0aGUgbGF0ZXN0IGhpZ2ggc2NvcmUgbGluZSBpbmRleFxuICBjb25zdCBnZXRMYXRlc3RIaWdoU2NvcmVMaW5lID0gKCkgPT4ge1xuICAgIGNvbnN0IHNjb3JlcyA9IHByb3BzLmxpbmVTY29yZXMgfHwgW107XG4gICAgaWYgKHNjb3Jlcy5sZW5ndGggPT09IDApIHJldHVybiB7IHNjb3JlOiAwLCBsaW5lSW5kZXg6IC0xIH07XG4gICAgXG4gICAgY29uc3QgbGF0ZXN0ID0gc2NvcmVzW3Njb3Jlcy5sZW5ndGggLSAxXTtcbiAgICByZXR1cm4ge1xuICAgICAgc2NvcmU6IGxhdGVzdD8uc2NvcmUgfHwgMCxcbiAgICAgIGxpbmVJbmRleDogbGF0ZXN0Py5saW5lSW5kZXggfHwgLTFcbiAgICB9O1xuICB9O1xuICBcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZmxleCBmbGV4LWNvbCBoLWZ1bGwgYmctYmFzZSByZWxhdGl2ZScsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogU2NvcmUgUGFuZWwgLSBvbmx5IHNob3cgd2hlbiBub3QgcGxheWluZyAqL31cbiAgICAgIDxTaG93IHdoZW49eyFwcm9wcy5pc1BsYXlpbmd9PlxuICAgICAgICA8U2NvcmVQYW5lbFxuICAgICAgICAgIHNjb3JlPXtwcm9wcy5zY29yZX1cbiAgICAgICAgICByYW5rPXtwcm9wcy5yYW5rfVxuICAgICAgICAvPlxuICAgICAgPC9TaG93PlxuXG4gICAgICB7LyogU2hvdyB0YWJzIG9ubHkgd2hlbiBub3QgcGxheWluZyAqL31cbiAgICAgIDxTaG93IHdoZW49eyFwcm9wcy5pc1BsYXlpbmd9IGZhbGxiYWNrPXtcbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBmbGV4IGZsZXgtY29sIG1pbi1oLTBcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIG1pbi1oLTAgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICA8THlyaWNzRGlzcGxheVxuICAgICAgICAgICAgICBseXJpY3M9e3Byb3BzLmx5cmljc31cbiAgICAgICAgICAgICAgY3VycmVudFRpbWU9e3Byb3BzLmN1cnJlbnRUaW1lfVxuICAgICAgICAgICAgICBpc1BsYXlpbmc9e3Byb3BzLmlzUGxheWluZ31cbiAgICAgICAgICAgICAgbGluZVNjb3Jlcz17cHJvcHMubGluZVNjb3Jlc31cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgfT5cbiAgICAgICAgey8qIFRhYnMgYW5kIGNvbnRlbnQgKi99XG4gICAgICAgIDxUYWJzIFxuICAgICAgICAgIHRhYnM9e1tcbiAgICAgICAgICAgIHsgaWQ6ICdseXJpY3MnLCBsYWJlbDogJ0x5cmljcycgfSxcbiAgICAgICAgICAgIHsgaWQ6ICdsZWFkZXJib2FyZCcsIGxhYmVsOiAnTGVhZGVyYm9hcmQnIH1cbiAgICAgICAgICBdfVxuICAgICAgICAgIGRlZmF1bHRUYWI9XCJseXJpY3NcIlxuICAgICAgICAgIGNsYXNzPVwiZmxleC0xIGZsZXggZmxleC1jb2wgbWluLWgtMFwiXG4gICAgICAgID5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwicHgtNFwiPlxuICAgICAgICAgICAgPFRhYnNMaXN0PlxuICAgICAgICAgICAgICA8VGFic1RyaWdnZXIgdmFsdWU9XCJseXJpY3NcIj5MeXJpY3M8L1RhYnNUcmlnZ2VyPlxuICAgICAgICAgICAgICA8VGFic1RyaWdnZXIgdmFsdWU9XCJsZWFkZXJib2FyZFwiPkxlYWRlcmJvYXJkPC9UYWJzVHJpZ2dlcj5cbiAgICAgICAgICAgIDwvVGFic0xpc3Q+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgXG4gICAgICAgICAgPFRhYnNDb250ZW50IHZhbHVlPVwibHlyaWNzXCIgY2xhc3M9XCJmbGV4LTEgbWluLWgtMFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZmxleC1jb2wgaC1mdWxsXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgbWluLWgtMCBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgICAgICA8THlyaWNzRGlzcGxheVxuICAgICAgICAgICAgICAgICAgbHlyaWNzPXtwcm9wcy5seXJpY3N9XG4gICAgICAgICAgICAgICAgICBjdXJyZW50VGltZT17cHJvcHMuY3VycmVudFRpbWV9XG4gICAgICAgICAgICAgICAgICBpc1BsYXlpbmc9e3Byb3BzLmlzUGxheWluZ31cbiAgICAgICAgICAgICAgICAgIGxpbmVTY29yZXM9e3Byb3BzLmxpbmVTY29yZXN9XG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICB7LyogRm9vdGVyIHdpdGggc3RhcnQgYnV0dG9uICovfVxuICAgICAgICAgICAgICA8U2hvdyB3aGVuPXshcHJvcHMuaXNQbGF5aW5nICYmIHByb3BzLm9uU3RhcnR9PlxuICAgICAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInAtNCBiZy1zdXJmYWNlIGJvcmRlci10IGJvcmRlci1zdWJ0bGVcIlxuICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgICAgJ2ZsZXgtc2hyaW5rJzogJzAnXG4gICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxTcGxpdEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBvblN0YXJ0PXtwcm9wcy5vblN0YXJ0fVxuICAgICAgICAgICAgICAgICAgICBvblNwZWVkQ2hhbmdlPXtwcm9wcy5vblNwZWVkQ2hhbmdlfVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9UYWJzQ29udGVudD5cbiAgICAgICAgICBcbiAgICAgICAgICA8VGFic0NvbnRlbnQgdmFsdWU9XCJsZWFkZXJib2FyZFwiIGNsYXNzPVwiZmxleC0xIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm92ZXJmbG93LXktYXV0byBoLWZ1bGxcIj5cbiAgICAgICAgICAgICAgPExlYWRlcmJvYXJkUGFuZWwgZW50cmllcz17cHJvcHMubGVhZGVyYm9hcmR9IC8+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1RhYnNDb250ZW50PlxuICAgICAgICA8L1RhYnM+XG4gICAgICA8L1Nob3c+XG4gICAgICBcbiAgICAgIHsvKiBGaXJlIGVtb2ppIGVmZmVjdCAqL31cbiAgICAgIDxTaG93IHdoZW49e3Byb3BzLmlzUGxheWluZ30+XG4gICAgICAgIDxGaXJlRW1vamlBbmltYXRpb24gXG4gICAgICAgICAgc2NvcmU9e2dldExhdGVzdEhpZ2hTY29yZUxpbmUoKS5zY29yZX0gXG4gICAgICAgICAgbGluZUluZGV4PXtnZXRMYXRlc3RIaWdoU2NvcmVMaW5lKCkubGluZUluZGV4fVxuICAgICAgICAvPlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVDb250ZXh0LCB1c2VDb250ZXh0LCBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCwgY3JlYXRlTWVtbyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgUGFyZW50Q29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBUcmFuc2xhdGlvbnMsIExvY2FsZUNvZGUgfSBmcm9tICcuL3R5cGVzJztcblxuaW50ZXJmYWNlIEkxOG5Db250ZXh0VmFsdWUge1xuICBsb2NhbGU6ICgpID0+IExvY2FsZUNvZGU7XG4gIHNldExvY2FsZTogKGxvY2FsZTogTG9jYWxlQ29kZSkgPT4gdm9pZDtcbiAgdDogKGtleTogc3RyaW5nLCBwYXJhbXM/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBzdHJpbmc7XG4gIGRpcjogKCkgPT4gJ2x0cicgfCAncnRsJztcbiAgZm9ybWF0TnVtYmVyOiAobnVtOiBudW1iZXIpID0+IHN0cmluZztcbiAgZm9ybWF0RGF0ZTogKGRhdGU6IERhdGUsIG9wdGlvbnM/OiBJbnRsLkRhdGVUaW1lRm9ybWF0T3B0aW9ucykgPT4gc3RyaW5nO1xufVxuXG5jb25zdCBJMThuQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8STE4bkNvbnRleHRWYWx1ZT4oKTtcblxuZXhwb3J0IGNvbnN0IEkxOG5Qcm92aWRlcjogUGFyZW50Q29tcG9uZW50PHsgZGVmYXVsdExvY2FsZT86IExvY2FsZUNvZGUgfT4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2xvY2FsZSwgc2V0TG9jYWxlXSA9IGNyZWF0ZVNpZ25hbDxMb2NhbGVDb2RlPihwcm9wcy5kZWZhdWx0TG9jYWxlIHx8ICdlbicpO1xuICBjb25zdCBbdHJhbnNsYXRpb25zLCBzZXRUcmFuc2xhdGlvbnNdID0gY3JlYXRlU2lnbmFsPFRyYW5zbGF0aW9ucz4oKTtcbiAgXG4gIC8vIExvYWQgdHJhbnNsYXRpb25zIGR5bmFtaWNhbGx5XG4gIGNyZWF0ZUVmZmVjdChhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgY3VycmVudExvY2FsZSA9IGxvY2FsZSgpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBtb2R1bGUgPSBhd2FpdCBpbXBvcnQoYC4vbG9jYWxlcy8ke2N1cnJlbnRMb2NhbGV9L2luZGV4LnRzYCk7XG4gICAgICBzZXRUcmFuc2xhdGlvbnMobW9kdWxlLmRlZmF1bHQpO1xuICAgIH0gY2F0Y2ggKF9lKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEZhaWxlZCB0byBsb2FkIGxvY2FsZSAke2N1cnJlbnRMb2NhbGV9LCBmYWxsaW5nIGJhY2sgdG8gRW5nbGlzaGApO1xuICAgICAgY29uc3QgbW9kdWxlID0gYXdhaXQgaW1wb3J0KCcuL2xvY2FsZXMvZW4vaW5kZXgudHMnKTtcbiAgICAgIHNldFRyYW5zbGF0aW9ucyhtb2R1bGUuZGVmYXVsdCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBEZWVwIGtleSBhY2Nlc3Mgd2l0aCBkb3Qgbm90YXRpb25cbiAgY29uc3QgdCA9IChrZXk6IHN0cmluZywgcGFyYW1zPzogUmVjb3JkPHN0cmluZywgYW55PikgPT4ge1xuICAgIGNvbnN0IGtleXMgPSBrZXkuc3BsaXQoJy4nKTtcbiAgICBsZXQgdmFsdWU6IGFueSA9IHRyYW5zbGF0aW9ucygpO1xuICAgIFxuICAgIGZvciAoY29uc3QgayBvZiBrZXlzKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlPy5ba107XG4gICAgfVxuICAgIFxuICAgIC8vIEhhbmRsZSBwYXJhbWV0ZXIgcmVwbGFjZW1lbnRcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiBwYXJhbXMpIHtcbiAgICAgIHJldHVybiB2YWx1ZS5yZXBsYWNlKC9cXHtcXHsoXFx3KylcXH1cXH0vZywgKF8sIGspID0+IFN0cmluZyhwYXJhbXNba10gfHwgJycpKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHZhbHVlIHx8IGtleTtcbiAgfTtcblxuICAvLyBEaXJlY3Rpb24gKGZvciBSVEwgbGFuZ3VhZ2VzIGluIGZ1dHVyZSlcbiAgY29uc3QgZGlyID0gKCk6ICdsdHInIHwgJ3J0bCcgPT4gJ2x0cic7IC8vIE9ubHkgTFRSIGxhbmd1YWdlcyBzdXBwb3J0ZWQgY3VycmVudGx5XG5cbiAgLy8gTnVtYmVyIGZvcm1hdHRpbmdcbiAgY29uc3QgbnVtYmVyRm9ybWF0dGVyID0gY3JlYXRlTWVtbygoKSA9PiBcbiAgICBuZXcgSW50bC5OdW1iZXJGb3JtYXQobG9jYWxlKCkpXG4gICk7XG5cbiAgY29uc3QgZm9ybWF0TnVtYmVyID0gKG51bTogbnVtYmVyKSA9PiBudW1iZXJGb3JtYXR0ZXIoKS5mb3JtYXQobnVtKTtcblxuICAvLyBEYXRlIGZvcm1hdHRpbmdcbiAgY29uc3QgZm9ybWF0RGF0ZSA9IChkYXRlOiBEYXRlLCBvcHRpb25zPzogSW50bC5EYXRlVGltZUZvcm1hdE9wdGlvbnMpID0+IHtcbiAgICByZXR1cm4gbmV3IEludGwuRGF0ZVRpbWVGb3JtYXQobG9jYWxlKCksIG9wdGlvbnMpLmZvcm1hdChkYXRlKTtcbiAgfTtcblxuICBjb25zdCB2YWx1ZTogSTE4bkNvbnRleHRWYWx1ZSA9IHtcbiAgICBsb2NhbGUsXG4gICAgc2V0TG9jYWxlLFxuICAgIHQsXG4gICAgZGlyLFxuICAgIGZvcm1hdE51bWJlcixcbiAgICBmb3JtYXREYXRlLFxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPEkxOG5Db250ZXh0LlByb3ZpZGVyIHZhbHVlPXt2YWx1ZX0+XG4gICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgPC9JMThuQ29udGV4dC5Qcm92aWRlcj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCB1c2VJMThuID0gKCkgPT4ge1xuICBjb25zdCBjb250ZXh0ID0gdXNlQ29udGV4dChJMThuQ29udGV4dCk7XG4gIGlmICghY29udGV4dCkge1xuICAgIHRocm93IG5ldyBFcnJvcigndXNlSTE4biBtdXN0IGJlIHVzZWQgd2l0aGluIEkxOG5Qcm92aWRlcicpO1xuICB9XG4gIHJldHVybiBjb250ZXh0O1xufTsiLCJpbXBvcnQgeyBTaG93LCBjcmVhdGVNZW1vIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB0eXBlIHsgUGxheWJhY2tTcGVlZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vQnV0dG9uJztcbmltcG9ydCB7IHVzZUkxOG4gfSBmcm9tICcuLi8uLi8uLi9pMThuJztcblxuZXhwb3J0IGludGVyZmFjZSBDb21wbGV0aW9uVmlld1Byb3BzIHtcbiAgc2NvcmU6IG51bWJlcjtcbiAgcmFuazogbnVtYmVyO1xuICBzcGVlZDogUGxheWJhY2tTcGVlZDtcbiAgZmVlZGJhY2tUZXh0Pzogc3RyaW5nO1xuICBvblByYWN0aWNlPzogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBDb21wbGV0aW9uVmlldzogQ29tcG9uZW50PENvbXBsZXRpb25WaWV3UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHsgdCwgZm9ybWF0TnVtYmVyIH0gPSB1c2VJMThuKCk7XG4gIFxuICAvLyBHZXQgZmVlZGJhY2sgdGV4dCBiYXNlZCBvbiBzY29yZVxuICBjb25zdCBnZXRGZWVkYmFja1RleHQgPSBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBpZiAocHJvcHMuZmVlZGJhY2tUZXh0KSByZXR1cm4gcHJvcHMuZmVlZGJhY2tUZXh0O1xuICAgIFxuICAgIGlmIChwcm9wcy5zY29yZSA+PSA5NSkgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5wZXJmZWN0Jyk7XG4gICAgaWYgKHByb3BzLnNjb3JlID49IDg1KSByZXR1cm4gdCgna2FyYW9rZS5zY29yaW5nLmV4Y2VsbGVudCcpO1xuICAgIGlmIChwcm9wcy5zY29yZSA+PSA3MCkgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5ncmVhdCcpO1xuICAgIGlmIChwcm9wcy5zY29yZSA+PSA1MCkgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5nb29kJyk7XG4gICAgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5rZWVwUHJhY3RpY2luZycpO1xuICB9KTtcbiAgXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgaC1mdWxsIGJnLWJhc2UnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgey8qIE1haW4gY29udGVudCBhcmVhICovfVxuICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLTZcIj5cbiAgICAgICAgey8qIFNjb3JlICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgZmxleCBmbGV4LWNvbCBtYi0xMFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5IG1iLTMgb3JkZXItMVwiPnt0KCdrYXJhb2tlLnNjb3Jpbmcuc2NvcmUnKX08L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC03eGwgZm9udC1tb25vIGZvbnQtYm9sZCB0ZXh0LWFjY2VudC1wcmltYXJ5IG9yZGVyLTJcIj5cbiAgICAgICAgICAgIHtmb3JtYXROdW1iZXIocHJvcHMuc2NvcmUpfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgXG4gICAgICAgIHsvKiBTdGF0cyByb3cgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGdhcC0xMiBtYi0xMlwiPlxuICAgICAgICAgIHsvKiBSYW5rICovfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0yIG9yZGVyLTFcIj5SYW5rPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0zeGwgZm9udC1ib2xkIHRleHQtcHJpbWFyeSBvcmRlci0yXCI+I3tmb3JtYXROdW1iZXIocHJvcHMucmFuayl9PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgXG4gICAgICAgICAgey8qIFNwZWVkICovfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0yIG9yZGVyLTFcIj57dCgnY29tbW9uLnNwZWVkLmxhYmVsJyl9PC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0zeGwgZm9udC1ib2xkIHRleHQtcHJpbWFyeSBvcmRlci0yXCI+e3Byb3BzLnNwZWVkfTwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgXG4gICAgICAgIHsvKiBGZWVkYmFjayB0ZXh0ICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwibWF4LXctbWQgdGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICA8cCBjbGFzcz1cInRleHQteGwgdGV4dC1wcmltYXJ5IGxlYWRpbmctcmVsYXhlZFwiPlxuICAgICAgICAgICAge2dldEZlZWRiYWNrVGV4dCgpfVxuICAgICAgICAgIDwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgey8qIEZvb3RlciB3aXRoIHByYWN0aWNlIGJ1dHRvbiAtIHBvc2l0aW9uZWQgYXQgYm90dG9tIG9mIHdpZGdldCAqL31cbiAgICAgIDxTaG93IHdoZW49e3Byb3BzLm9uUHJhY3RpY2V9PlxuICAgICAgICA8ZGl2IGNsYXNzPVwicC00IGJnLXN1cmZhY2UgYm9yZGVyLXQgYm9yZGVyLXN1YnRsZVwiPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIHZhcmlhbnQ9XCJwcmltYXJ5XCJcbiAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uUHJhY3RpY2V9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgUHJhY3RpY2UgRXJyb3JzXG4gICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIG9uQ2xlYW51cCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQXVkaW9Qcm9jZXNzb3JPcHRpb25zIH0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlS2FyYW9rZUF1ZGlvUHJvY2Vzc29yKG9wdGlvbnM/OiBBdWRpb1Byb2Nlc3Nvck9wdGlvbnMpIHtcbiAgY29uc3QgW2F1ZGlvQ29udGV4dCwgc2V0QXVkaW9Db250ZXh0XSA9IGNyZWF0ZVNpZ25hbDxBdWRpb0NvbnRleHQgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW21lZGlhU3RyZWFtLCBzZXRNZWRpYVN0cmVhbV0gPSBjcmVhdGVTaWduYWw8TWVkaWFTdHJlYW0gfCBudWxsPihudWxsKTtcbiAgY29uc3QgWywgc2V0QXVkaW9Xb3JrbGV0Tm9kZV0gPSBjcmVhdGVTaWduYWw8QXVkaW9Xb3JrbGV0Tm9kZSB8IG51bGw+KG51bGwpO1xuICBcbiAgY29uc3QgW2lzUmVhZHksIHNldElzUmVhZHldID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2Vycm9yLCBzZXRFcnJvcl0gPSBjcmVhdGVTaWduYWw8RXJyb3IgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2lzTGlzdGVuaW5nLCBzZXRJc0xpc3RlbmluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBcbiAgY29uc3QgW2N1cnJlbnRSZWNvcmRpbmdMaW5lLCBzZXRDdXJyZW50UmVjb3JkaW5nTGluZV0gPSBjcmVhdGVTaWduYWw8bnVtYmVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtyZWNvcmRlZEF1ZGlvQnVmZmVyLCBzZXRSZWNvcmRlZEF1ZGlvQnVmZmVyXSA9IGNyZWF0ZVNpZ25hbDxGbG9hdDMyQXJyYXlbXT4oW10pO1xuICBcbiAgY29uc3QgW2lzU2Vzc2lvbkFjdGl2ZSwgc2V0SXNTZXNzaW9uQWN0aXZlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtmdWxsU2Vzc2lvbkJ1ZmZlciwgc2V0RnVsbFNlc3Npb25CdWZmZXJdID0gY3JlYXRlU2lnbmFsPEZsb2F0MzJBcnJheVtdPihbXSk7XG4gIFxuICBjb25zdCBzYW1wbGVSYXRlID0gb3B0aW9ucz8uc2FtcGxlUmF0ZSB8fCAxNjAwMDtcbiAgXG4gIGNvbnN0IGluaXRpYWxpemUgPSBhc3luYyAoKSA9PiB7XG4gICAgaWYgKGF1ZGlvQ29udGV4dCgpKSByZXR1cm47XG4gICAgc2V0RXJyb3IobnVsbCk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIFxuICAgICAgY29uc3QgY3R4ID0gbmV3IEF1ZGlvQ29udGV4dCh7IHNhbXBsZVJhdGUgfSk7XG4gICAgICBzZXRBdWRpb0NvbnRleHQoY3R4KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc3RyZWFtID0gYXdhaXQgbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXRVc2VyTWVkaWEoe1xuICAgICAgICBhdWRpbzoge1xuICAgICAgICAgIHNhbXBsZVJhdGUsXG4gICAgICAgICAgY2hhbm5lbENvdW50OiAxLFxuICAgICAgICAgIGVjaG9DYW5jZWxsYXRpb246IGZhbHNlLFxuICAgICAgICAgIG5vaXNlU3VwcHJlc3Npb246IGZhbHNlLFxuICAgICAgICAgIGF1dG9HYWluQ29udHJvbDogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHNldE1lZGlhU3RyZWFtKHN0cmVhbSk7XG4gICAgICBcbiAgICAgIGF3YWl0IGN0eC5hdWRpb1dvcmtsZXQuYWRkTW9kdWxlKGNyZWF0ZUF1ZGlvV29ya2xldFByb2Nlc3NvcigpKTtcbiAgICAgIFxuICAgICAgY29uc3Qgd29ya2xldE5vZGUgPSBuZXcgQXVkaW9Xb3JrbGV0Tm9kZShjdHgsICdrYXJhb2tlLWF1ZGlvLXByb2Nlc3NvcicsIHtcbiAgICAgICAgbnVtYmVyT2ZJbnB1dHM6IDEsXG4gICAgICAgIG51bWJlck9mT3V0cHV0czogMCxcbiAgICAgICAgY2hhbm5lbENvdW50OiAxLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIHdvcmtsZXROb2RlLnBvcnQub25tZXNzYWdlID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIGlmIChldmVudC5kYXRhLnR5cGUgPT09ICdhdWRpb0RhdGEnKSB7XG4gICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gbmV3IEZsb2F0MzJBcnJheShldmVudC5kYXRhLmF1ZGlvRGF0YSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGN1cnJlbnRSZWNvcmRpbmdMaW5lKCkgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHNldFJlY29yZGVkQXVkaW9CdWZmZXIoKHByZXYpID0+IFsuLi5wcmV2LCBhdWRpb0RhdGFdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGlzU2Vzc2lvbkFjdGl2ZSgpKSB7XG4gICAgICAgICAgICBzZXRGdWxsU2Vzc2lvbkJ1ZmZlcigocHJldikgPT4gWy4uLnByZXYsIGF1ZGlvRGF0YV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIFxuICAgICAgc2V0QXVkaW9Xb3JrbGV0Tm9kZSh3b3JrbGV0Tm9kZSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHNvdXJjZSA9IGN0eC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pO1xuICAgICAgY29uc3QgZ2Fpbk5vZGUgPSBjdHguY3JlYXRlR2FpbigpO1xuICAgICAgZ2Fpbk5vZGUuZ2Fpbi52YWx1ZSA9IDEuMjtcbiAgICAgIFxuICAgICAgc291cmNlLmNvbm5lY3QoZ2Fpbk5vZGUpO1xuICAgICAgZ2Fpbk5vZGUuY29ubmVjdCh3b3JrbGV0Tm9kZSk7XG4gICAgICBcbiAgICAgIHNldElzUmVhZHkodHJ1ZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBdWRpb1Byb2Nlc3Nvcl0gRmFpbGVkIHRvIGluaXRpYWxpemU6JywgZSk7XG4gICAgICBzZXRFcnJvcihlIGluc3RhbmNlb2YgRXJyb3IgPyBlIDogbmV3IEVycm9yKCdVbmtub3duIGF1ZGlvIGluaXRpYWxpemF0aW9uIGVycm9yJykpO1xuICAgICAgc2V0SXNSZWFkeShmYWxzZSk7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgY3JlYXRlQXVkaW9Xb3JrbGV0UHJvY2Vzc29yID0gKCkgPT4ge1xuICAgIGNvbnN0IHByb2Nlc3NvckNvZGUgPSBgXG4gICAgICBjbGFzcyBLYXJhb2tlQXVkaW9Qcm9jZXNzb3IgZXh0ZW5kcyBBdWRpb1dvcmtsZXRQcm9jZXNzb3Ige1xuICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICBzdXBlcigpO1xuICAgICAgICAgIHRoaXMuYnVmZmVyU2l6ZSA9IDEwMjQ7XG4gICAgICAgICAgdGhpcy5ybXNIaXN0b3J5ID0gW107XG4gICAgICAgICAgdGhpcy5tYXhIaXN0b3J5TGVuZ3RoID0gMTA7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9jZXNzKGlucHV0cywgb3V0cHV0cywgcGFyYW1ldGVycykge1xuICAgICAgICAgIGNvbnN0IGlucHV0ID0gaW5wdXRzWzBdO1xuICAgICAgICAgIGlmIChpbnB1dCAmJiBpbnB1dFswXSkge1xuICAgICAgICAgICAgY29uc3QgaW5wdXREYXRhID0gaW5wdXRbMF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBzdW0gPSAwO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dERhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgc3VtICs9IGlucHV0RGF0YVtpXSAqIGlucHV0RGF0YVtpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHJtcyA9IE1hdGguc3FydChzdW0gLyBpbnB1dERhdGEubGVuZ3RoKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5ybXNIaXN0b3J5LnB1c2gocm1zKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnJtc0hpc3RvcnkubGVuZ3RoID4gdGhpcy5tYXhIaXN0b3J5TGVuZ3RoKSB7XG4gICAgICAgICAgICAgIHRoaXMucm1zSGlzdG9yeS5zaGlmdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBhdmdSbXMgPSB0aGlzLnJtc0hpc3RvcnkucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCkgLyB0aGlzLnJtc0hpc3RvcnkubGVuZ3RoO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLnBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICB0eXBlOiAnYXVkaW9EYXRhJyxcbiAgICAgICAgICAgICAgYXVkaW9EYXRhOiBpbnB1dERhdGEsXG4gICAgICAgICAgICAgIHJtc0xldmVsOiBybXMsXG4gICAgICAgICAgICAgIGF2Z1Jtc0xldmVsOiBhdmdSbXMsXG4gICAgICAgICAgICAgIGlzVG9vUXVpZXQ6IGF2Z1JtcyA8IDAuMDEsXG4gICAgICAgICAgICAgIGlzVG9vTG91ZDogYXZnUm1zID4gMC4zXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJlZ2lzdGVyUHJvY2Vzc29yKCdrYXJhb2tlLWF1ZGlvLXByb2Nlc3NvcicsIEthcmFva2VBdWRpb1Byb2Nlc3Nvcik7XG4gICAgYDtcbiAgICBcbiAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW3Byb2Nlc3NvckNvZGVdLCB7IHR5cGU6ICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JyB9KTtcbiAgICByZXR1cm4gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgfTtcbiAgXG4gIGNvbnN0IHN0YXJ0TGlzdGVuaW5nID0gKCkgPT4ge1xuICAgIGNvbnN0IGN0eCA9IGF1ZGlvQ29udGV4dCgpO1xuICAgIGlmIChjdHggJiYgY3R4LnN0YXRlID09PSAnc3VzcGVuZGVkJykge1xuICAgICAgY3R4LnJlc3VtZSgpO1xuICAgIH1cbiAgICBzZXRJc0xpc3RlbmluZyh0cnVlKTtcbiAgfTtcbiAgXG4gIGNvbnN0IHBhdXNlTGlzdGVuaW5nID0gKCkgPT4ge1xuICAgIGNvbnN0IGN0eCA9IGF1ZGlvQ29udGV4dCgpO1xuICAgIGlmIChjdHggJiYgY3R4LnN0YXRlID09PSAncnVubmluZycpIHtcbiAgICAgIGN0eC5zdXNwZW5kKCk7XG4gICAgfVxuICAgIHNldElzTGlzdGVuaW5nKGZhbHNlKTtcbiAgfTtcbiAgXG4gIGNvbnN0IGNsZWFudXAgPSAoKSA9PiB7XG4gICAgXG4gICAgY29uc3Qgc3RyZWFtID0gbWVkaWFTdHJlYW0oKTtcbiAgICBpZiAoc3RyZWFtKSB7XG4gICAgICBzdHJlYW0uZ2V0VHJhY2tzKCkuZm9yRWFjaCgodHJhY2spID0+IHRyYWNrLnN0b3AoKSk7XG4gICAgICBzZXRNZWRpYVN0cmVhbShudWxsKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgY3R4ID0gYXVkaW9Db250ZXh0KCk7XG4gICAgaWYgKGN0eCAmJiBjdHguc3RhdGUgIT09ICdjbG9zZWQnKSB7XG4gICAgICBjdHguY2xvc2UoKTtcbiAgICAgIHNldEF1ZGlvQ29udGV4dChudWxsKTtcbiAgICB9XG4gICAgXG4gICAgc2V0QXVkaW9Xb3JrbGV0Tm9kZShudWxsKTtcbiAgICBzZXRJc1JlYWR5KGZhbHNlKTtcbiAgICBzZXRJc0xpc3RlbmluZyhmYWxzZSk7XG4gIH07XG4gIFxuICBvbkNsZWFudXAoY2xlYW51cCk7XG4gIFxuICBjb25zdCBzdGFydFJlY29yZGluZ0xpbmUgPSAobGluZUluZGV4OiBudW1iZXIpID0+IHtcbiAgICBcbiAgICBzZXRDdXJyZW50UmVjb3JkaW5nTGluZShsaW5lSW5kZXgpO1xuICAgIHNldFJlY29yZGVkQXVkaW9CdWZmZXIoW10pO1xuICAgIFxuICAgIGlmIChpc1JlYWR5KCkgJiYgIWlzTGlzdGVuaW5nKCkpIHtcbiAgICAgIHN0YXJ0TGlzdGVuaW5nKCk7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3Qgc3RvcFJlY29yZGluZ0xpbmVBbmRHZXRSYXdBdWRpbyA9ICgpOiBGbG9hdDMyQXJyYXlbXSA9PiB7XG4gICAgY29uc3QgbGluZUluZGV4ID0gY3VycmVudFJlY29yZGluZ0xpbmUoKTtcbiAgICBpZiAobGluZUluZGV4ID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGF1ZGlvQnVmZmVyID0gcmVjb3JkZWRBdWRpb0J1ZmZlcigpO1xuICAgIFxuICAgIHNldEN1cnJlbnRSZWNvcmRpbmdMaW5lKG51bGwpO1xuICAgIFxuICAgIGNvbnN0IHJlc3VsdCA9IFsuLi5hdWRpb0J1ZmZlcl07XG4gICAgc2V0UmVjb3JkZWRBdWRpb0J1ZmZlcihbXSk7XG4gICAgXG4gICAgaWYgKHJlc3VsdC5sZW5ndGggPT09IDApIHtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcbiAgXG4gIGNvbnN0IGNvbnZlcnRBdWRpb1RvV2F2QmxvYiA9IChhdWRpb0NodW5rczogRmxvYXQzMkFycmF5W10pOiBCbG9iIHwgbnVsbCA9PiB7XG4gICAgaWYgKGF1ZGlvQ2h1bmtzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG4gICAgXG4gICAgY29uc3QgdG90YWxMZW5ndGggPSBhdWRpb0NodW5rcy5yZWR1Y2UoKHN1bSwgY2h1bmspID0+IHN1bSArIGNodW5rLmxlbmd0aCwgMCk7XG4gICAgY29uc3QgY29uY2F0ZW5hdGVkID0gbmV3IEZsb2F0MzJBcnJheSh0b3RhbExlbmd0aCk7XG4gICAgbGV0IG9mZnNldCA9IDA7XG4gICAgZm9yIChjb25zdCBjaHVuayBvZiBhdWRpb0NodW5rcykge1xuICAgICAgY29uY2F0ZW5hdGVkLnNldChjaHVuaywgb2Zmc2V0KTtcbiAgICAgIG9mZnNldCArPSBjaHVuay5sZW5ndGg7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBhdWRpb0J1ZmZlclRvV2F2KGNvbmNhdGVuYXRlZCwgc2FtcGxlUmF0ZSk7XG4gIH07XG4gIFxuICBjb25zdCBhdWRpb0J1ZmZlclRvV2F2ID0gKGJ1ZmZlcjogRmxvYXQzMkFycmF5LCBzYW1wbGVSYXRlOiBudW1iZXIpOiBCbG9iID0+IHtcbiAgICBjb25zdCBsZW5ndGggPSBidWZmZXIubGVuZ3RoO1xuICAgIGNvbnN0IGFycmF5QnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKDQ0ICsgbGVuZ3RoICogMik7XG4gICAgY29uc3QgdmlldyA9IG5ldyBEYXRhVmlldyhhcnJheUJ1ZmZlcik7XG4gICAgXG4gICAgY29uc3Qgd3JpdGVTdHJpbmcgPSAob2Zmc2V0OiBudW1iZXIsIHN0cmluZzogc3RyaW5nKSA9PiB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0cmluZy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2aWV3LnNldFVpbnQ4KG9mZnNldCArIGksIHN0cmluZy5jaGFyQ29kZUF0KGkpKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIHdyaXRlU3RyaW5nKDAsICdSSUZGJyk7XG4gICAgdmlldy5zZXRVaW50MzIoNCwgMzYgKyBsZW5ndGggKiAyLCB0cnVlKTtcbiAgICB3cml0ZVN0cmluZyg4LCAnV0FWRScpO1xuICAgIHdyaXRlU3RyaW5nKDEyLCAnZm10ICcpO1xuICAgIHZpZXcuc2V0VWludDMyKDE2LCAxNiwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMjAsIDEsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDIyLCAxLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQzMigyNCwgc2FtcGxlUmF0ZSwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MzIoMjgsIHNhbXBsZVJhdGUgKiAyLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigzMiwgMiwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMzQsIDE2LCB0cnVlKTtcbiAgICB3cml0ZVN0cmluZygzNiwgJ2RhdGEnKTtcbiAgICB2aWV3LnNldFVpbnQzMig0MCwgbGVuZ3RoICogMiwgdHJ1ZSk7XG4gICAgXG4gICAgY29uc3Qgb2Zmc2V0ID0gNDQ7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgc2FtcGxlID0gTWF0aC5tYXgoLTEsIE1hdGgubWluKDEsIGJ1ZmZlcltpXSB8fCAwKSk7XG4gICAgICB2aWV3LnNldEludDE2KG9mZnNldCArIGkgKiAyLCBzYW1wbGUgKiAweDdmZmYsIHRydWUpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbmV3IEJsb2IoW2FycmF5QnVmZmVyXSwgeyB0eXBlOiAnYXVkaW8vd2F2JyB9KTtcbiAgfTtcbiAgXG4gIGNvbnN0IHN0YXJ0RnVsbFNlc3Npb24gPSAoKSA9PiB7XG4gICAgc2V0RnVsbFNlc3Npb25CdWZmZXIoW10pO1xuICAgIHNldElzU2Vzc2lvbkFjdGl2ZSh0cnVlKTtcbiAgfTtcbiAgXG4gIGNvbnN0IHN0b3BGdWxsU2Vzc2lvbkFuZEdldFdhdiA9ICgpOiBCbG9iIHwgbnVsbCA9PiB7XG4gICAgc2V0SXNTZXNzaW9uQWN0aXZlKGZhbHNlKTtcbiAgICBcbiAgICBjb25zdCBzZXNzaW9uQ2h1bmtzID0gZnVsbFNlc3Npb25CdWZmZXIoKTtcbiAgICBjb25zdCB3YXZCbG9iID0gY29udmVydEF1ZGlvVG9XYXZCbG9iKHNlc3Npb25DaHVua3MpO1xuICAgIFxuICAgIFxuICAgIHNldEZ1bGxTZXNzaW9uQnVmZmVyKFtdKTtcbiAgICBcbiAgICByZXR1cm4gd2F2QmxvYjtcbiAgfTtcbiAgXG4gIHJldHVybiB7XG4gICAgaXNSZWFkeSxcbiAgICBlcnJvcixcbiAgICBpc0xpc3RlbmluZyxcbiAgICBpc1Nlc3Npb25BY3RpdmUsXG4gICAgXG4gICAgaW5pdGlhbGl6ZSxcbiAgICBzdGFydExpc3RlbmluZyxcbiAgICBwYXVzZUxpc3RlbmluZyxcbiAgICBjbGVhbnVwLFxuICAgIHN0YXJ0UmVjb3JkaW5nTGluZSxcbiAgICBzdG9wUmVjb3JkaW5nTGluZUFuZEdldFJhd0F1ZGlvLFxuICAgIGNvbnZlcnRBdWRpb1RvV2F2QmxvYixcbiAgICBcbiAgICBzdGFydEZ1bGxTZXNzaW9uLFxuICAgIHN0b3BGdWxsU2Vzc2lvbkFuZEdldFdhdixcbiAgfTtcbn0iLCJpbXBvcnQgdHlwZSB7XG4gIEFwaVJlc3BvbnNlLFxuICBTdGFydFNlc3Npb25SZXF1ZXN0LFxuICBHcmFkZUxpbmVSZXF1ZXN0LFxuICBDb21wbGV0ZVNlc3Npb25SZXF1ZXN0LFxuICBUcmFuc2NyaWJlUmVxdWVzdCxcbiAgVHJhbnNjcmliZVJlc3BvbnNlLFxuICBLYXJhb2tlRGF0YSxcbiAgS2FyYW9rZVNlc3Npb24sXG4gIExpbmVTY29yZSxcbiAgU2Vzc2lvblJlc3VsdHMsXG4gIERlbW9Ub2tlblJlc3BvbnNlLFxuICBVc2VyQ3JlZGl0c1Jlc3BvbnNlLFxuICBQdXJjaGFzZUNyZWRpdHNSZXF1ZXN0LFxuICBQdXJjaGFzZUNyZWRpdHNSZXNwb25zZSxcbiAgRXhlcmNpc2UsXG4gIFByYWN0aWNlQ2FyZCxcbn0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEFwaUNsaWVudENvbmZpZyB7XG4gIGJhc2VVcmw6IHN0cmluZztcbiAgZ2V0QXV0aFRva2VuPzogKCkgPT4gUHJvbWlzZTxzdHJpbmcgfCBudWxsPjtcbiAgb25FcnJvcj86IChlcnJvcjogRXJyb3IpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBBcGlDbGllbnQge1xuICBwcml2YXRlIGJhc2VVcmw6IHN0cmluZztcbiAgcHJpdmF0ZSBnZXRBdXRoVG9rZW4/OiAoKSA9PiBQcm9taXNlPHN0cmluZyB8IG51bGw+O1xuICBwcml2YXRlIG9uRXJyb3I/OiAoZXJyb3I6IEVycm9yKSA9PiB2b2lkO1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogQXBpQ2xpZW50Q29uZmlnKSB7XG4gICAgdGhpcy5iYXNlVXJsID0gY29uZmlnLmJhc2VVcmwucmVwbGFjZSgvXFwvJC8sICcnKTsgLy8gUmVtb3ZlIHRyYWlsaW5nIHNsYXNoXG4gICAgdGhpcy5nZXRBdXRoVG9rZW4gPSBjb25maWcuZ2V0QXV0aFRva2VuO1xuICAgIHRoaXMub25FcnJvciA9IGNvbmZpZy5vbkVycm9yO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZXF1ZXN0PFQ+KFxuICAgIHBhdGg6IHN0cmluZyxcbiAgICBvcHRpb25zOiBSZXF1ZXN0SW5pdCA9IHt9XG4gICk6IFByb21pc2U8VD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAuLi4ob3B0aW9ucy5oZWFkZXJzIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfHwge30pLFxuICAgICAgfTtcblxuICAgICAgLy8gQWRkIGF1dGggdG9rZW4gaWYgYXZhaWxhYmxlXG4gICAgICBpZiAodGhpcy5nZXRBdXRoVG9rZW4pIHtcbiAgICAgICAgY29uc3QgdG9rZW4gPSBhd2FpdCB0aGlzLmdldEF1dGhUb2tlbigpO1xuICAgICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgICBoZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSBgQmVhcmVyICR7dG9rZW59YDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuYmFzZVVybH0ke3BhdGh9YCwge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBoZWFkZXJzLFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQVBJIEVycm9yICR7cmVzcG9uc2Uuc3RhdHVzfTogJHtlcnJvcn1gKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGF3YWl0IHJlc3BvbnNlLmpzb24oKSBhcyBUO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBpZiAodGhpcy5vbkVycm9yKSB7XG4gICAgICAgIHRoaXMub25FcnJvcihlcnJvciBhcyBFcnJvcik7XG4gICAgICB9XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvLyBIZWFsdGggY2hlY2tcbiAgYXN5bmMgaGVhbHRoQ2hlY2soKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnL2hlYWx0aCcpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLy8gQXV0aCBlbmRwb2ludHNcbiAgYXN5bmMgZ2V0RGVtb1Rva2VuKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJlcXVlc3Q8RGVtb1Rva2VuUmVzcG9uc2U+KCcvYXV0aC9kZW1vJywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3BvbnNlLnRva2VuO1xuICB9XG5cbiAgYXN5bmMgZ2V0VXNlckNyZWRpdHMoKTogUHJvbWlzZTxVc2VyQ3JlZGl0c1Jlc3BvbnNlPiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxVc2VyQ3JlZGl0c1Jlc3BvbnNlPignL2FwaS91c2VyL2NyZWRpdHMnKTtcbiAgfVxuXG4gIGFzeW5jIHB1cmNoYXNlQ3JlZGl0cyhcbiAgICByZXF1ZXN0OiBQdXJjaGFzZUNyZWRpdHNSZXF1ZXN0XG4gICk6IFByb21pc2U8UHVyY2hhc2VDcmVkaXRzUmVzcG9uc2U+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFB1cmNoYXNlQ3JlZGl0c1Jlc3BvbnNlPignL2FwaS91c2VyL2NyZWRpdHMvcHVyY2hhc2UnLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gS2FyYW9rZSBlbmRwb2ludHNcbiAgYXN5bmMgZ2V0S2FyYW9rZURhdGEodHJhY2tJZDogc3RyaW5nKTogUHJvbWlzZTxLYXJhb2tlRGF0YT4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8S2FyYW9rZURhdGE+KGAvYXBpL2thcmFva2UvJHtlbmNvZGVVUklDb21wb25lbnQodHJhY2tJZCl9YCk7XG4gIH1cblxuICBhc3luYyBzdGFydEthcmFva2VTZXNzaW9uKFxuICAgIHJlcXVlc3Q6IFN0YXJ0U2Vzc2lvblJlcXVlc3RcbiAgKTogUHJvbWlzZTxBcGlSZXNwb25zZTxLYXJhb2tlU2Vzc2lvbj4+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFwaVJlc3BvbnNlPEthcmFva2VTZXNzaW9uPj4oJy9hcGkva2FyYW9rZS9zdGFydCcsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVxdWVzdCksXG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBncmFkZUthcmFva2VMaW5lKFxuICAgIHJlcXVlc3Q6IEdyYWRlTGluZVJlcXVlc3RcbiAgKTogUHJvbWlzZTxBcGlSZXNwb25zZTxMaW5lU2NvcmU+PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBcGlSZXNwb25zZTxMaW5lU2NvcmU+PignL2FwaS9rYXJhb2tlL2dyYWRlJywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSxcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIGNvbXBsZXRlS2FyYW9rZVNlc3Npb24oXG4gICAgcmVxdWVzdDogQ29tcGxldGVTZXNzaW9uUmVxdWVzdFxuICApOiBQcm9taXNlPEFwaVJlc3BvbnNlPFNlc3Npb25SZXN1bHRzPj4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QXBpUmVzcG9uc2U8U2Vzc2lvblJlc3VsdHM+PignL2FwaS9rYXJhb2tlL2NvbXBsZXRlJywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFNwZWVjaC10by10ZXh0IGVuZHBvaW50c1xuICBhc3luYyB0cmFuc2NyaWJlQXVkaW8oXG4gICAgcmVxdWVzdDogVHJhbnNjcmliZVJlcXVlc3RcbiAgKTogUHJvbWlzZTxUcmFuc2NyaWJlUmVzcG9uc2U+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFRyYW5zY3JpYmVSZXNwb25zZT4oJy9hcGkvc3BlZWNoLXRvLXRleHQvdHJhbnNjcmliZScsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVxdWVzdCksXG4gICAgfSk7XG4gIH1cblxuICAvLyBQcmFjdGljZSBlbmRwb2ludHNcbiAgYXN5bmMgZ2V0UHJhY3RpY2VFeGVyY2lzZXMoXG4gICAgc2Vzc2lvbklkPzogc3RyaW5nLFxuICAgIGxpbWl0ID0gMTBcbiAgKTogUHJvbWlzZTxBcGlSZXNwb25zZTx7IGV4ZXJjaXNlczogRXhlcmNpc2VbXTsgY2FyZHM6IFByYWN0aWNlQ2FyZFtdIH0+PiB7XG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xuICAgIGlmIChzZXNzaW9uSWQpIHBhcmFtcy5hcHBlbmQoJ3Nlc3Npb25JZCcsIHNlc3Npb25JZCk7XG4gICAgcGFyYW1zLmFwcGVuZCgnbGltaXQnLCBsaW1pdC50b1N0cmluZygpKTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QXBpUmVzcG9uc2U8eyBleGVyY2lzZXM6IEV4ZXJjaXNlW107IGNhcmRzOiBQcmFjdGljZUNhcmRbXSB9Pj4oXG4gICAgICBgL2FwaS9wcmFjdGljZS9leGVyY2lzZXM/JHtwYXJhbXN9YFxuICAgICk7XG4gIH1cblxuICBhc3luYyBzdWJtaXRQcmFjdGljZVJldmlldyhcbiAgICBjYXJkSWQ6IHN0cmluZyxcbiAgICBzY29yZTogbnVtYmVyLFxuICAgIHJldmlld1RpbWU6IHN0cmluZ1xuICApOiBQcm9taXNlPEFwaVJlc3BvbnNlPiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBcGlSZXNwb25zZT4oJy9hcGkvcHJhY3RpY2UvcmV2aWV3Jywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGNhcmRJZCwgc2NvcmUsIHJldmlld1RpbWUgfSksXG4gICAgfSk7XG4gIH1cblxuICAvLyBVc2VyIGVuZHBvaW50c1xuICBhc3luYyBnZXRVc2VyQmVzdFNjb3JlKHNvbmdJZDogc3RyaW5nKTogUHJvbWlzZTxBcGlSZXNwb25zZTx7IHNjb3JlOiBudW1iZXIgfT4+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFwaVJlc3BvbnNlPHsgc2NvcmU6IG51bWJlciB9Pj4oXG4gICAgICBgL2FwaS91c2Vycy9tZS9zb25ncy8ke3NvbmdJZH0vYmVzdC1zY29yZWBcbiAgICApO1xuICB9XG5cbiAgLy8gTGVhZGVyYm9hcmQgZW5kcG9pbnRzXG4gIGFzeW5jIGdldFNvbmdMZWFkZXJib2FyZChcbiAgICBzb25nSWQ6IHN0cmluZyxcbiAgICBsaW1pdCA9IDEwXG4gICk6IFByb21pc2U8QXBpUmVzcG9uc2U8QXJyYXk8eyB1c2VySWQ6IHN0cmluZzsgc2NvcmU6IG51bWJlcjsgcmFuazogbnVtYmVyIH0+Pj4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QXBpUmVzcG9uc2U8QXJyYXk8eyB1c2VySWQ6IHN0cmluZzsgc2NvcmU6IG51bWJlcjsgcmFuazogbnVtYmVyIH0+Pj4oXG4gICAgICBgL2FwaS9zb25ncy8ke3NvbmdJZH0vbGVhZGVyYm9hcmQ/bGltaXQ9JHtsaW1pdH1gXG4gICAgKTtcbiAgfVxufSIsImltcG9ydCB0eXBlIHsgQXBpQ2xpZW50IH0gZnJvbSAnLi4vY2xpZW50JztcbmltcG9ydCB0eXBlIHtcbiAgS2FyYW9rZURhdGEsXG4gIEthcmFva2VTZXNzaW9uLFxuICBMaW5lU2NvcmUsXG4gIFNlc3Npb25SZXN1bHRzLFxuICBBcGlSZXNwb25zZSxcbn0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuXG5leHBvcnQgY2xhc3MgS2FyYW9rZUVuZHBvaW50IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBjbGllbnQ6IEFwaUNsaWVudCkge31cblxuICAvKipcbiAgICogRmV0Y2gga2FyYW9rZSBkYXRhIGZvciBhIHRyYWNrXG4gICAqL1xuICBhc3luYyBnZXREYXRhKHRyYWNrSWQ6IHN0cmluZyk6IFByb21pc2U8S2FyYW9rZURhdGE+IHtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZ2V0S2FyYW9rZURhdGEodHJhY2tJZCk7XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgYSBuZXcga2FyYW9rZSBzZXNzaW9uXG4gICAqL1xuICBhc3luYyBzdGFydFNlc3Npb24oXG4gICAgdHJhY2tJZDogc3RyaW5nLFxuICAgIHNvbmdEYXRhOiB7XG4gICAgICB0aXRsZTogc3RyaW5nO1xuICAgICAgYXJ0aXN0OiBzdHJpbmc7XG4gICAgICBnZW5pdXNJZD86IHN0cmluZztcbiAgICAgIGR1cmF0aW9uPzogbnVtYmVyO1xuICAgICAgZGlmZmljdWx0eT86IHN0cmluZztcbiAgICB9LFxuICAgIHNvbmdDYXRhbG9nSWQ/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxLYXJhb2tlU2Vzc2lvbj4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuc3RhcnRLYXJhb2tlU2Vzc2lvbih7XG4gICAgICB0cmFja0lkLFxuICAgICAgc29uZ0RhdGEsXG4gICAgICBzb25nQ2F0YWxvZ0lkLFxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXNwb25zZS5zdWNjZXNzIHx8ICFyZXNwb25zZS5kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IocmVzcG9uc2UuZXJyb3IgfHwgJ0ZhaWxlZCB0byBzdGFydCBzZXNzaW9uJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gIH1cblxuICAvKipcbiAgICogR3JhZGUgYSBrYXJhb2tlIGxpbmUgcmVjb3JkaW5nXG4gICAqL1xuICBhc3luYyBncmFkZUxpbmUoXG4gICAgc2Vzc2lvbklkOiBzdHJpbmcsXG4gICAgbGluZUluZGV4OiBudW1iZXIsXG4gICAgYXVkaW9CYXNlNjQ6IHN0cmluZyxcbiAgICBleHBlY3RlZFRleHQ6IHN0cmluZyxcbiAgICBzdGFydFRpbWU6IG51bWJlcixcbiAgICBlbmRUaW1lOiBudW1iZXJcbiAgKTogUHJvbWlzZTxMaW5lU2NvcmU+IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LmdyYWRlS2FyYW9rZUxpbmUoe1xuICAgICAgc2Vzc2lvbklkLFxuICAgICAgbGluZUluZGV4LFxuICAgICAgYXVkaW9CdWZmZXI6IGF1ZGlvQmFzZTY0LFxuICAgICAgZXhwZWN0ZWRUZXh0LFxuICAgICAgc3RhcnRUaW1lLFxuICAgICAgZW5kVGltZSxcbiAgICB9KTtcblxuICAgIGlmICghcmVzcG9uc2Uuc3VjY2VzcyB8fCAhcmVzcG9uc2UuZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHJlc3BvbnNlLmVycm9yIHx8ICdGYWlsZWQgdG8gZ3JhZGUgbGluZScpO1xuICAgIH1cblxuICAgIHJldHVybiByZXNwb25zZS5kYXRhO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbXBsZXRlIGEga2FyYW9rZSBzZXNzaW9uXG4gICAqL1xuICBhc3luYyBjb21wbGV0ZVNlc3Npb24oXG4gICAgc2Vzc2lvbklkOiBzdHJpbmcsXG4gICAgZnVsbEF1ZGlvQmFzZTY0Pzogc3RyaW5nXG4gICk6IFByb21pc2U8U2Vzc2lvblJlc3VsdHM+IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LmNvbXBsZXRlS2FyYW9rZVNlc3Npb24oe1xuICAgICAgc2Vzc2lvbklkLFxuICAgICAgZnVsbEF1ZGlvQnVmZmVyOiBmdWxsQXVkaW9CYXNlNjQsXG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLnN1Y2Nlc3MgfHwgIXJlc3BvbnNlLmRhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihyZXNwb25zZS5lcnJvciB8fCAnRmFpbGVkIHRvIGNvbXBsZXRlIHNlc3Npb24nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcbiAgfVxufSIsImltcG9ydCB0eXBlIHsgQXBpQ2xpZW50IH0gZnJvbSAnLi4vY2xpZW50JztcbmltcG9ydCB0eXBlIHsgRXhlcmNpc2UsIFByYWN0aWNlQ2FyZCB9IGZyb20gJ0BzY2FybGV0dC9jb3JlJztcblxuZXhwb3J0IGNsYXNzIFByYWN0aWNlRW5kcG9pbnQge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGNsaWVudDogQXBpQ2xpZW50KSB7fVxuXG4gIC8qKlxuICAgKiBHZXQgcHJhY3RpY2UgZXhlcmNpc2VzIGZvciBhIHVzZXJcbiAgICovXG4gIGFzeW5jIGdldEV4ZXJjaXNlcyhcbiAgICBzZXNzaW9uSWQ/OiBzdHJpbmcsXG4gICAgbGltaXQgPSAxMFxuICApOiBQcm9taXNlPHsgZXhlcmNpc2VzOiBFeGVyY2lzZVtdOyBjYXJkczogUHJhY3RpY2VDYXJkW10gfT4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuZ2V0UHJhY3RpY2VFeGVyY2lzZXMoc2Vzc2lvbklkLCBsaW1pdCk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLnN1Y2Nlc3MgfHwgIXJlc3BvbnNlLmRhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihyZXNwb25zZS5lcnJvciB8fCAnRmFpbGVkIHRvIGZldGNoIGV4ZXJjaXNlcycpO1xuICAgIH1cblxuICAgIHJldHVybiByZXNwb25zZS5kYXRhO1xuICB9XG5cbiAgLyoqXG4gICAqIFN1Ym1pdCBhIHByYWN0aWNlIHJldmlld1xuICAgKi9cbiAgYXN5bmMgc3VibWl0UmV2aWV3KFxuICAgIGNhcmRJZDogc3RyaW5nLFxuICAgIHNjb3JlOiBudW1iZXIsXG4gICAgcmV2aWV3VGltZTogc3RyaW5nID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuc3VibWl0UHJhY3RpY2VSZXZpZXcoXG4gICAgICBjYXJkSWQsXG4gICAgICBzY29yZSxcbiAgICAgIHJldmlld1RpbWVcbiAgICApO1xuXG4gICAgaWYgKCFyZXNwb25zZS5zdWNjZXNzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IocmVzcG9uc2UuZXJyb3IgfHwgJ0ZhaWxlZCB0byBzdWJtaXQgcmV2aWV3Jyk7XG4gICAgfVxuICB9XG59IiwiaW1wb3J0IHR5cGUgeyBBcGlDbGllbnQgfSBmcm9tICcuLi9jbGllbnQnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRyYW5zY3JpcHRpb25SZXN1bHQge1xuICB0cmFuc2NyaXB0OiBzdHJpbmc7XG4gIGNvbmZpZGVuY2U6IG51bWJlcjtcbiAgcHJvdmlkZXI/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTVFRFbmRwb2ludCB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY2xpZW50OiBBcGlDbGllbnQpIHt9XG5cbiAgLyoqXG4gICAqIFRyYW5zY3JpYmUgYXVkaW8gdXNpbmcgc3BlZWNoLXRvLXRleHRcbiAgICovXG4gIGFzeW5jIHRyYW5zY3JpYmUoXG4gICAgYXVkaW9CYXNlNjQ6IHN0cmluZyxcbiAgICBleHBlY3RlZFRleHQ/OiBzdHJpbmcsXG4gICAgcHJlZmVyRGVlcGdyYW0gPSBmYWxzZVxuICApOiBQcm9taXNlPFRyYW5zY3JpcHRpb25SZXN1bHQ+IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LnRyYW5zY3JpYmVBdWRpbyh7XG4gICAgICBhdWRpb0Jhc2U2NCxcbiAgICAgIGV4cGVjdGVkVGV4dCxcbiAgICAgIHByZWZlckRlZXBncmFtLFxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXNwb25zZS5zdWNjZXNzIHx8ICFyZXNwb25zZS5kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IocmVzcG9uc2UuZXJyb3IgfHwgJ0ZhaWxlZCB0byB0cmFuc2NyaWJlIGF1ZGlvJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gIH1cblxuICAvKipcbiAgICogVHJhbnNjcmliZSB3aXRoIHJldHJ5IGxvZ2ljXG4gICAqL1xuICBhc3luYyB0cmFuc2NyaWJlV2l0aFJldHJ5KFxuICAgIGF1ZGlvQmFzZTY0OiBzdHJpbmcsXG4gICAgZXhwZWN0ZWRUZXh0Pzogc3RyaW5nLFxuICAgIG1heFJldHJpZXMgPSAyXG4gICk6IFByb21pc2U8VHJhbnNjcmlwdGlvblJlc3VsdD4ge1xuICAgIGxldCBsYXN0RXJyb3I6IEVycm9yIHwgbnVsbCA9IG51bGw7XG5cbiAgICBmb3IgKGxldCBhdHRlbXB0ID0gMTsgYXR0ZW1wdCA8PSBtYXhSZXRyaWVzOyBhdHRlbXB0KyspIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSBFbGV2ZW5MYWJzIGZpcnN0XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMudHJhbnNjcmliZShcbiAgICAgICAgICBhdWRpb0Jhc2U2NCxcbiAgICAgICAgICBleHBlY3RlZFRleHQsXG4gICAgICAgICAgZmFsc2VcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxhc3RFcnJvciA9IGVycm9yIGFzIEVycm9yO1xuICAgICAgICBjb25zb2xlLmxvZyhgW1NUVF0gQXR0ZW1wdCAke2F0dGVtcHR9LyR7bWF4UmV0cmllc30gZmFpbGVkOmAsIGVycm9yKTtcblxuICAgICAgICAvLyBJZiBmaXJzdCBhdHRlbXB0IGZhaWxlZCwgdHJ5IHdpdGggRGVlcGdyYW1cbiAgICAgICAgaWYgKGF0dGVtcHQgPT09IDEpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tTVFRdIFJldHJ5aW5nIHdpdGggRGVlcGdyYW0uLi4nKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMudHJhbnNjcmliZShcbiAgICAgICAgICAgICAgYXVkaW9CYXNlNjQsXG4gICAgICAgICAgICAgIGV4cGVjdGVkVGV4dCxcbiAgICAgICAgICAgICAgdHJ1ZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgfSBjYXRjaCAoZGVlcGdyYW1FcnJvcikge1xuICAgICAgICAgICAgbGFzdEVycm9yID0gZGVlcGdyYW1FcnJvciBhcyBFcnJvcjtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tTVFRdIERlZXBncmFtIGFsc28gZmFpbGVkOicsIGRlZXBncmFtRXJyb3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRocm93IGxhc3RFcnJvciB8fCBuZXcgRXJyb3IoJ1NUVCBmYWlsZWQgYWZ0ZXIgcmV0cmllcycpO1xuICB9XG59IiwiaW1wb3J0IHR5cGUgeyBBcGlDbGllbnQgfSBmcm9tICcuLi9jbGllbnQnO1xuaW1wb3J0IHR5cGUge1xuICBVc2VyQ3JlZGl0c1Jlc3BvbnNlLFxuICBQdXJjaGFzZUNyZWRpdHNSZXF1ZXN0LFxuICBQdXJjaGFzZUNyZWRpdHNSZXNwb25zZSxcbn0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuXG5leHBvcnQgY2xhc3MgQXV0aEVuZHBvaW50IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBjbGllbnQ6IEFwaUNsaWVudCkge31cblxuICAvKipcbiAgICogR2V0IGEgZGVtbyBhdXRoZW50aWNhdGlvbiB0b2tlblxuICAgKi9cbiAgYXN5bmMgZ2V0RGVtb1Rva2VuKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LmdldERlbW9Ub2tlbigpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBjdXJyZW50IHVzZXIgY3JlZGl0c1xuICAgKi9cbiAgYXN5bmMgZ2V0VXNlckNyZWRpdHMoKTogUHJvbWlzZTxVc2VyQ3JlZGl0c1Jlc3BvbnNlPiB7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LmdldFVzZXJDcmVkaXRzKCk7XG4gIH1cblxuICAvKipcbiAgICogUHVyY2hhc2UgY3JlZGl0c1xuICAgKi9cbiAgYXN5bmMgcHVyY2hhc2VDcmVkaXRzKFxuICAgIGZpZDogbnVtYmVyLFxuICAgIGNyZWRpdHM6IG51bWJlcixcbiAgICBjaGFpbjogJ0Jhc2UnIHwgJ1NvbGFuYScgPSAnQmFzZScsXG4gICAgdHJhbnNhY3Rpb25IYXNoPzogc3RyaW5nXG4gICk6IFByb21pc2U8UHVyY2hhc2VDcmVkaXRzUmVzcG9uc2U+IHtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQucHVyY2hhc2VDcmVkaXRzKHtcbiAgICAgIGZpZCxcbiAgICAgIGNyZWRpdHMsXG4gICAgICBjaGFpbixcbiAgICAgIHRyYW5zYWN0aW9uSGFzaCxcbiAgICB9KTtcbiAgfVxufSIsImltcG9ydCB7IEFwaUNsaWVudCwgdHlwZSBBcGlDbGllbnRDb25maWcgfSBmcm9tICcuL2NsaWVudCc7XG5pbXBvcnQge1xuICBLYXJhb2tlRW5kcG9pbnQsXG4gIFByYWN0aWNlRW5kcG9pbnQsXG4gIFNUVEVuZHBvaW50LFxuICBBdXRoRW5kcG9pbnQsXG59IGZyb20gJy4vZW5kcG9pbnRzJztcblxuZXhwb3J0IHsgQXBpQ2xpZW50LCB0eXBlIEFwaUNsaWVudENvbmZpZyB9O1xuZXhwb3J0ICogZnJvbSAnLi9lbmRwb2ludHMnO1xuXG4vKipcbiAqIENyZWF0ZSBhIGNvbmZpZ3VyZWQgQVBJIGNsaWVudCB3aXRoIGFsbCBlbmRwb2ludHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFwaUNsaWVudChjb25maWc6IEFwaUNsaWVudENvbmZpZykge1xuICBjb25zdCBjbGllbnQgPSBuZXcgQXBpQ2xpZW50KGNvbmZpZyk7XG5cbiAgcmV0dXJuIHtcbiAgICBjbGllbnQsXG4gICAga2FyYW9rZTogbmV3IEthcmFva2VFbmRwb2ludChjbGllbnQpLFxuICAgIHByYWN0aWNlOiBuZXcgUHJhY3RpY2VFbmRwb2ludChjbGllbnQpLFxuICAgIHN0dDogbmV3IFNUVEVuZHBvaW50KGNsaWVudCksXG4gICAgYXV0aDogbmV3IEF1dGhFbmRwb2ludChjbGllbnQpLFxuICAgIFxuICAgIC8vIERpcmVjdCBhY2Nlc3MgdG8gYmFzZSBtZXRob2RzXG4gICAgaGVhbHRoQ2hlY2s6ICgpID0+IGNsaWVudC5oZWFsdGhDaGVjaygpLFxuICB9O1xufVxuXG5leHBvcnQgdHlwZSBTY2FybGV0dEFwaUNsaWVudCA9IFJldHVyblR5cGU8dHlwZW9mIGNyZWF0ZUFwaUNsaWVudD47IiwiaW1wb3J0IHsgY3JlYXRlQXBpQ2xpZW50LCB0eXBlIFNjYXJsZXR0QXBpQ2xpZW50IH0gZnJvbSAnQHNjYXJsZXR0L2FwaS1jbGllbnQnO1xuaW1wb3J0IHR5cGUgeyBLYXJhb2tlRGF0YSwgS2FyYW9rZVNlc3Npb24sIExpbmVTY29yZSwgU2Vzc2lvblJlc3VsdHMgfSBmcm9tICdAc2NhcmxldHQvY29yZSc7XG5cbi8qKlxuICogQWRhcHRlciBjbGFzcyB0aGF0IHByb3ZpZGVzIHRoZSBzYW1lIGludGVyZmFjZSBhcyB0aGUgb2xkIEthcmFva2VBcGlTZXJ2aWNlXG4gKiBidXQgdXNlcyB0aGUgbmV3IEBzY2FybGV0dC9hcGktY2xpZW50IHVuZGVyIHRoZSBob29kXG4gKi9cbmV4cG9ydCBjbGFzcyBLYXJhb2tlQXBpU2VydmljZSB7XG4gIHByaXZhdGUgY2xpZW50OiBTY2FybGV0dEFwaUNsaWVudDtcblxuICBjb25zdHJ1Y3RvcihiYXNlVXJsOiBzdHJpbmcgPSBpbXBvcnQubWV0YS5lbnYuVklURV9BUElfVVJMIHx8ICdodHRwOi8vbG9jYWxob3N0Ojg3ODcnKSB7XG4gICAgdGhpcy5jbGllbnQgPSBjcmVhdGVBcGlDbGllbnQoeyBiYXNlVXJsIH0pO1xuICB9XG5cbiAgYXN5bmMgZmV0Y2hLYXJhb2tlRGF0YSh0cmFja0lkOiBzdHJpbmcpOiBQcm9taXNlPEthcmFva2VEYXRhIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5jbGllbnQua2FyYW9rZS5nZXREYXRhKHRyYWNrSWQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGZldGNoIGthcmFva2UgZGF0YTonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBzdGFydFNlc3Npb24oXG4gICAgdHJhY2tJZDogc3RyaW5nLFxuICAgIHNvbmdEYXRhOiB7IHRpdGxlOiBzdHJpbmc7IGFydGlzdDogc3RyaW5nOyBnZW5pdXNJZD86IHN0cmluZzsgZHVyYXRpb24/OiBudW1iZXI7IGRpZmZpY3VsdHk/OiBzdHJpbmcgfSxcbiAgICBhdXRoVG9rZW4/OiBzdHJpbmcsXG4gICAgc29uZ0NhdGFsb2dJZD86IHN0cmluZyxcbiAgICBwbGF5YmFja1NwZWVkPzogc3RyaW5nXG4gICk6IFByb21pc2U8S2FyYW9rZVNlc3Npb24gfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGU6IHBsYXliYWNrU3BlZWQgaXMgc3RvcmVkIGJ1dCBub3QgdXNlZCBieSB0aGUgY3VycmVudCBhcGktY2xpZW50XG4gICAgICAvLyBUaGlzIG1haW50YWlucyBjb21wYXRpYmlsaXR5IHdpdGggdGhlIGV4aXN0aW5nIGludGVyZmFjZVxuICAgICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IHRoaXMuY2xpZW50LmthcmFva2Uuc3RhcnRTZXNzaW9uKFxuICAgICAgICB0cmFja0lkLFxuICAgICAgICBzb25nRGF0YSxcbiAgICAgICAgc29uZ0NhdGFsb2dJZFxuICAgICAgKTtcbiAgICAgIHJldHVybiBzZXNzaW9uO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIHN0YXJ0IHNlc3Npb246JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ3JhZGVSZWNvcmRpbmcoXG4gICAgc2Vzc2lvbklkOiBzdHJpbmcsXG4gICAgbGluZUluZGV4OiBudW1iZXIsXG4gICAgYXVkaW9CdWZmZXI6IHN0cmluZyxcbiAgICBleHBlY3RlZFRleHQ6IHN0cmluZyxcbiAgICBzdGFydFRpbWU6IG51bWJlcixcbiAgICBlbmRUaW1lOiBudW1iZXIsXG4gICAgYXV0aFRva2VuPzogc3RyaW5nLFxuICAgIHBsYXliYWNrU3BlZWQ/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxMaW5lU2NvcmUgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGU6IHBsYXliYWNrU3BlZWQgaXMgcGFzc2VkIGJ1dCBub3QgdXNlZCBieSB0aGUgY3VycmVudCBhcGktY2xpZW50XG4gICAgICBjb25zdCBsaW5lU2NvcmUgPSBhd2FpdCB0aGlzLmNsaWVudC5rYXJhb2tlLmdyYWRlTGluZShcbiAgICAgICAgc2Vzc2lvbklkLFxuICAgICAgICBsaW5lSW5kZXgsXG4gICAgICAgIGF1ZGlvQnVmZmVyLFxuICAgICAgICBleHBlY3RlZFRleHQsXG4gICAgICAgIHN0YXJ0VGltZSxcbiAgICAgICAgZW5kVGltZVxuICAgICAgKTtcbiAgICAgIHJldHVybiBsaW5lU2NvcmU7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZ3JhZGUgcmVjb3JkaW5nOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGNvbXBsZXRlU2Vzc2lvbihcbiAgICBzZXNzaW9uSWQ6IHN0cmluZyxcbiAgICBmdWxsQXVkaW9CdWZmZXI/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxTZXNzaW9uUmVzdWx0cyB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IHRoaXMuY2xpZW50LmthcmFva2UuY29tcGxldGVTZXNzaW9uKFxuICAgICAgICBzZXNzaW9uSWQsXG4gICAgICAgIGZ1bGxBdWRpb0J1ZmZlclxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGNvbXBsZXRlIHNlc3Npb246JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ2V0VXNlckJlc3RTY29yZShzb25nSWQ6IHN0cmluZyk6IFByb21pc2U8bnVtYmVyIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LmNsaWVudC5nZXRVc2VyQmVzdFNjb3JlKHNvbmdJZCk7XG4gICAgICByZXR1cm4gcmVzcG9uc2UuZGF0YT8uc2NvcmUgPz8gbnVsbDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBnZXQgdXNlciBiZXN0IHNjb3JlOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldFNvbmdMZWFkZXJib2FyZChzb25nSWQ6IHN0cmluZywgbGltaXQgPSAxMCk6IFByb21pc2U8QXJyYXk8eyB1c2VySWQ6IHN0cmluZzsgc2NvcmU6IG51bWJlcjsgcmFuazogbnVtYmVyIH0+PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuY2xpZW50LmdldFNvbmdMZWFkZXJib2FyZChzb25nSWQsIGxpbWl0KTtcbiAgICAgIHJldHVybiByZXNwb25zZS5kYXRhID8/IFtdO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGdldCBzb25nIGxlYWRlcmJvYXJkOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gIH1cbn0iLCJpbXBvcnQgdHlwZSB7IENodW5rSW5mbyB9IGZyb20gJ0BzY2FybGV0dC9jb3JlJztcbmltcG9ydCB0eXBlIHsgTHlyaWNMaW5lIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9rYXJhb2tlL0x5cmljc0Rpc3BsYXknO1xuXG5leHBvcnQgZnVuY3Rpb24gY291bnRXb3Jkcyh0ZXh0OiBzdHJpbmcpOiBudW1iZXIge1xuICBpZiAoIXRleHQpIHJldHVybiAwO1xuICByZXR1cm4gdGV4dFxuICAgIC50cmltKClcbiAgICAuc3BsaXQoL1xccysvKVxuICAgIC5maWx0ZXIoKHdvcmQpID0+IHdvcmQubGVuZ3RoID4gMCkubGVuZ3RoO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkQ2h1bmtMaW5lcyhcbiAgbGluZXM6IEx5cmljTGluZVtdLFxuICBzdGFydEluZGV4OiBudW1iZXJcbik6IENodW5rSW5mbyB7XG4gIC8vIFByb2Nlc3MgaW5kaXZpZHVhbCBsaW5lcyBpbnN0ZWFkIG9mIGdyb3VwaW5nXG4gIGNvbnN0IGxpbmUgPSBsaW5lc1tzdGFydEluZGV4XTtcbiAgaWYgKCFsaW5lKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXJ0SW5kZXgsXG4gICAgICBlbmRJbmRleDogc3RhcnRJbmRleCxcbiAgICAgIGV4cGVjdGVkVGV4dDogJycsXG4gICAgICB3b3JkQ291bnQ6IDAsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHdvcmRDb3VudCA9IGNvdW50V29yZHMobGluZS50ZXh0IHx8ICcnKTtcbiAgXG4gIHJldHVybiB7XG4gICAgc3RhcnRJbmRleCxcbiAgICBlbmRJbmRleDogc3RhcnRJbmRleCwgLy8gU2luZ2xlIGxpbmUsIHNvIHN0YXJ0IGFuZCBlbmQgYXJlIHRoZSBzYW1lXG4gICAgZXhwZWN0ZWRUZXh0OiBsaW5lLnRleHQgfHwgJycsXG4gICAgd29yZENvdW50LFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2FsY3VsYXRlUmVjb3JkaW5nRHVyYXRpb24oXG4gIGxpbmVzOiBMeXJpY0xpbmVbXSxcbiAgY2h1bmtJbmZvOiBDaHVua0luZm9cbik6IG51bWJlciB7XG4gIGNvbnN0IHsgc3RhcnRJbmRleCwgZW5kSW5kZXggfSA9IGNodW5rSW5mbztcbiAgY29uc3QgbGluZSA9IGxpbmVzW3N0YXJ0SW5kZXhdO1xuICBcbiAgaWYgKCFsaW5lKSByZXR1cm4gMzAwMDtcblxuICBpZiAoZW5kSW5kZXggPiBzdGFydEluZGV4KSB7XG4gICAgaWYgKGVuZEluZGV4ICsgMSA8IGxpbmVzLmxlbmd0aCkge1xuICAgICAgY29uc3QgbmV4dExpbmUgPSBsaW5lc1tlbmRJbmRleCArIDFdO1xuICAgICAgaWYgKG5leHRMaW5lKSB7XG4gICAgICAgIC8vIENvbnZlcnQgc2Vjb25kcyB0byBtaWxsaXNlY29uZHNcbiAgICAgICAgcmV0dXJuIChuZXh0TGluZS5zdGFydFRpbWUgLSBsaW5lLnN0YXJ0VGltZSkgKiAxMDAwO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBsZXQgZHVyYXRpb24gPSAwO1xuICAgIGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDw9IGVuZEluZGV4OyBpKyspIHtcbiAgICAgIC8vIGR1cmF0aW9uIGlzIGFscmVhZHkgaW4gbWlsbGlzZWNvbmRzXG4gICAgICBkdXJhdGlvbiArPSBsaW5lc1tpXT8uZHVyYXRpb24gfHwgMzAwMDtcbiAgICB9XG4gICAgcmV0dXJuIE1hdGgubWluKGR1cmF0aW9uLCA4MDAwKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoc3RhcnRJbmRleCArIDEgPCBsaW5lcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IG5leHRMaW5lID0gbGluZXNbc3RhcnRJbmRleCArIDFdO1xuICAgICAgaWYgKG5leHRMaW5lKSB7XG4gICAgICAgIC8vIENvbnZlcnQgc2Vjb25kcyB0byBtaWxsaXNlY29uZHNcbiAgICAgICAgY29uc3QgY2FsY3VsYXRlZER1cmF0aW9uID0gKG5leHRMaW5lLnN0YXJ0VGltZSAtIGxpbmUuc3RhcnRUaW1lKSAqIDEwMDA7XG4gICAgICAgIHJldHVybiBNYXRoLm1pbihNYXRoLm1heChjYWxjdWxhdGVkRHVyYXRpb24sIDEwMDApLCA1MDAwKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIE1hdGgubWluKGxpbmUuZHVyYXRpb24gfHwgMzAwMCwgNTAwMCk7XG4gIH1cbn0iLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByb2dyZXNzQmFyUHJvcHMge1xuICBjdXJyZW50OiBudW1iZXI7XG4gIHRvdGFsOiBudW1iZXI7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgUHJvZ3Jlc3NCYXI6IENvbXBvbmVudDxQcm9ncmVzc0JhclByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBwZXJjZW50YWdlID0gKCkgPT4gTWF0aC5taW4oMTAwLCBNYXRoLm1heCgwLCAocHJvcHMuY3VycmVudCAvIHByb3BzLnRvdGFsKSAqIDEwMCkpO1xuICBcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbigndy1mdWxsIGgtMS41IGJnLWhpZ2hsaWdodCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzPVwiaC1mdWxsIGJnLWFjY2VudCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAgZWFzZS1vdXQgcm91bmRlZC1yLXNtXCJcbiAgICAgICAgc3R5bGU9e3sgd2lkdGg6IGAke3BlcmNlbnRhZ2UoKX0lYCB9fVxuICAgICAgLz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdywgc3BsaXRQcm9wcywgY3JlYXRlRWZmZWN0LCBvbkNsZWFudXAgfSBmcm9tICdzb2xpZC1qcydcbmltcG9ydCB0eXBlIHsgSlNYLCBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcydcbmltcG9ydCB7IFBvcnRhbCB9IGZyb20gJ3NvbGlkLWpzL3dlYidcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nXG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi9CdXR0b24nXG5cbmV4cG9ydCBpbnRlcmZhY2UgTW9kYWxQcm9wcyB7XG4gIG9wZW46IGJvb2xlYW5cbiAgb25DbG9zZT86ICgpID0+IHZvaWRcbiAgdGl0bGU/OiBzdHJpbmdcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmdcbiAgc2l6ZT86ICdzbScgfCAnbWQnIHwgJ2xnJyB8ICd4bCdcbiAgdmFyaWFudD86ICdkZWZhdWx0JyB8ICdkYW5nZXInIHwgJ3N1Y2Nlc3MnXG4gIGhpZGVDbG9zZUJ1dHRvbj86IGJvb2xlYW5cbiAgY2xvc2VPbkJhY2tkcm9wQ2xpY2s/OiBib29sZWFuXG4gIGNsb3NlT25Fc2NhcGU/OiBib29sZWFuXG4gIGNoaWxkcmVuPzogSlNYLkVsZW1lbnRcbiAgZm9vdGVyPzogSlNYLkVsZW1lbnRcbn1cblxuZXhwb3J0IGNvbnN0IE1vZGFsOiBDb21wb25lbnQ8TW9kYWxQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2xvY2FsLCBvdGhlcnNdID0gc3BsaXRQcm9wcyhwcm9wcywgW1xuICAgICdvcGVuJyxcbiAgICAnb25DbG9zZScsXG4gICAgJ3RpdGxlJyxcbiAgICAnZGVzY3JpcHRpb24nLFxuICAgICdzaXplJyxcbiAgICAndmFyaWFudCcsXG4gICAgJ2hpZGVDbG9zZUJ1dHRvbicsXG4gICAgJ2Nsb3NlT25CYWNrZHJvcENsaWNrJyxcbiAgICAnY2xvc2VPbkVzY2FwZScsXG4gICAgJ2NoaWxkcmVuJyxcbiAgICAnZm9vdGVyJyxcbiAgXSlcblxuICBjb25zdCBzaXplID0gKCkgPT4gbG9jYWwuc2l6ZSB8fCAnbWQnXG4gIGNvbnN0IHZhcmlhbnQgPSAoKSA9PiBsb2NhbC52YXJpYW50IHx8ICdkZWZhdWx0J1xuICBjb25zdCBjbG9zZU9uQmFja2Ryb3BDbGljayA9ICgpID0+IGxvY2FsLmNsb3NlT25CYWNrZHJvcENsaWNrID8/IHRydWVcbiAgY29uc3QgY2xvc2VPbkVzY2FwZSA9ICgpID0+IGxvY2FsLmNsb3NlT25Fc2NhcGUgPz8gdHJ1ZVxuXG4gIC8vIEhhbmRsZSBlc2NhcGUga2V5XG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGxvY2FsLm9wZW4gJiYgY2xvc2VPbkVzY2FwZSgpKSB7XG4gICAgICBjb25zdCBoYW5kbGVFc2NhcGUgPSAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XG4gICAgICAgICAgbG9jYWwub25DbG9zZT8uKClcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGhhbmRsZUVzY2FwZSlcbiAgICAgIG9uQ2xlYW51cCgoKSA9PiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgaGFuZGxlRXNjYXBlKSlcbiAgICB9XG4gIH0pXG5cbiAgLy8gTG9jayBib2R5IHNjcm9sbCB3aGVuIG1vZGFsIGlzIG9wZW5cbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAobG9jYWwub3Blbikge1xuICAgICAgY29uc3Qgb3JpZ2luYWxPdmVyZmxvdyA9IGRvY3VtZW50LmJvZHkuc3R5bGUub3ZlcmZsb3dcbiAgICAgIGRvY3VtZW50LmJvZHkuc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJ1xuICAgICAgb25DbGVhbnVwKCgpID0+IHtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5zdHlsZS5vdmVyZmxvdyA9IG9yaWdpbmFsT3ZlcmZsb3dcbiAgICAgIH0pXG4gICAgfVxuICB9KVxuXG4gIGNvbnN0IGhhbmRsZUJhY2tkcm9wQ2xpY2sgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgIGlmIChjbG9zZU9uQmFja2Ryb3BDbGljaygpICYmIGUudGFyZ2V0ID09PSBlLmN1cnJlbnRUYXJnZXQpIHtcbiAgICAgIGxvY2FsLm9uQ2xvc2U/LigpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8U2hvdyB3aGVuPXtsb2NhbC5vcGVufT5cbiAgICAgIDxQb3J0YWw+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICBjbGFzcz1cImZpeGVkIGluc2V0LTAgei01MCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLTRcIlxuICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZUJhY2tkcm9wQ2xpY2t9XG4gICAgICAgICAgey4uLm90aGVyc31cbiAgICAgICAgPlxuICAgICAgICAgIHsvKiBCYWNrZHJvcCAqL31cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWJzb2x1dGUgaW5zZXQtMCBiZy1ibGFjay84MCBiYWNrZHJvcC1ibHVyLXNtIHRyYW5zaXRpb24tb3BhY2l0eSBkdXJhdGlvbi0yMDBcIiAvPlxuICAgICAgICAgIFxuICAgICAgICAgIHsvKiBNb2RhbCAqL31cbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICdyZWxhdGl2ZSBiZy1lbGV2YXRlZCByb3VuZGVkLXhsIHNoYWRvdy0yeGwgYm9yZGVyIGJvcmRlci1zdWJ0bGUnLFxuICAgICAgICAgICAgICAndHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMjAwIHNjYWxlLTEwMCBvcGFjaXR5LTEwMCcsXG4gICAgICAgICAgICAgICdtYXgtaC1bOTB2aF0gb3ZlcmZsb3ctaGlkZGVuIGZsZXggZmxleC1jb2wnLFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gU2l6ZXNcbiAgICAgICAgICAgICAgICAndy1mdWxsIG1heC13LXNtJzogc2l6ZSgpID09PSAnc20nLFxuICAgICAgICAgICAgICAgICd3LWZ1bGwgbWF4LXctbWQnOiBzaXplKCkgPT09ICdtZCcsXG4gICAgICAgICAgICAgICAgJ3ctZnVsbCBtYXgtdy1sZyc6IHNpemUoKSA9PT0gJ2xnJyxcbiAgICAgICAgICAgICAgICAndy1mdWxsIG1heC13LXhsJzogc2l6ZSgpID09PSAneGwnLFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApfVxuICAgICAgICAgICAgb25DbGljaz17KGUpID0+IGUuc3RvcFByb3BhZ2F0aW9uKCl9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgey8qIEhlYWRlciAqL31cbiAgICAgICAgICAgIDxTaG93IHdoZW49e2xvY2FsLnRpdGxlIHx8ICFsb2NhbC5oaWRlQ2xvc2VCdXR0b259PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1zdGFydCBqdXN0aWZ5LWJldHdlZW4gcC02IHBiLTBcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xXCI+XG4gICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtsb2NhbC50aXRsZX0+XG4gICAgICAgICAgICAgICAgICAgIDxoMlxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAgICAgICAgICd0ZXh0LXhsIGZvbnQtc2VtaWJvbGQnLFxuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAndGV4dC1wcmltYXJ5JzogdmFyaWFudCgpID09PSAnZGVmYXVsdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICd0ZXh0LXJlZC01MDAnOiB2YXJpYW50KCkgPT09ICdkYW5nZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAndGV4dC1ncmVlbi01MDAnOiB2YXJpYW50KCkgPT09ICdzdWNjZXNzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAge2xvY2FsLnRpdGxlfVxuICAgICAgICAgICAgICAgICAgICA8L2gyPlxuICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgICAgPFNob3cgd2hlbj17bG9jYWwuZGVzY3JpcHRpb259PlxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc20gdGV4dC1zZWNvbmRhcnkgbXQtMVwiPlxuICAgICAgICAgICAgICAgICAgICAgIHtsb2NhbC5kZXNjcmlwdGlvbn1cbiAgICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49eyFsb2NhbC5oaWRlQ2xvc2VCdXR0b259PlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtsb2NhbC5vbkNsb3NlfVxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cIm1sLTQgcC0xIHJvdW5kZWQtbGcgdGV4dC1zZWNvbmRhcnkgaG92ZXI6dGV4dC1wcmltYXJ5IGhvdmVyOmJnLXN1cmZhY2UgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiQ2xvc2UgbW9kYWxcIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICA8c3ZnXG4gICAgICAgICAgICAgICAgICAgICAgd2lkdGg9XCIyMFwiXG4gICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0PVwiMjBcIlxuICAgICAgICAgICAgICAgICAgICAgIHZpZXdCb3g9XCIwIDAgMjAgMjBcIlxuICAgICAgICAgICAgICAgICAgICAgIGZpbGw9XCJub25lXCJcbiAgICAgICAgICAgICAgICAgICAgICB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCJcbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICBkPVwiTTE1IDVMNSAxNU01IDVsMTAgMTBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc3Ryb2tlPVwiY3VycmVudENvbG9yXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZS13aWR0aD1cIjJcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiXG4gICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgICB7LyogQ29udGVudCAqL31cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgb3ZlcmZsb3cteS1hdXRvIHAtNlwiPlxuICAgICAgICAgICAgICB7bG9jYWwuY2hpbGRyZW59XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgey8qIEZvb3RlciAqL31cbiAgICAgICAgICAgIDxTaG93IHdoZW49e2xvY2FsLmZvb3Rlcn0+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwLTYgcHQtMCBtdC1hdXRvXCI+XG4gICAgICAgICAgICAgICAge2xvY2FsLmZvb3Rlcn1cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9Qb3J0YWw+XG4gICAgPC9TaG93PlxuICApXG59XG5cbi8vIFByZS1idWlsdCBtb2RhbCBmb290ZXIgY29tcG9uZW50c1xuZXhwb3J0IGludGVyZmFjZSBNb2RhbEZvb3RlclByb3BzIHtcbiAgb25Db25maXJtPzogKCkgPT4gdm9pZFxuICBvbkNhbmNlbD86ICgpID0+IHZvaWRcbiAgY29uZmlybVRleHQ/OiBzdHJpbmdcbiAgY2FuY2VsVGV4dD86IHN0cmluZ1xuICBjb25maXJtVmFyaWFudD86ICdwcmltYXJ5JyB8ICdkYW5nZXInIHwgJ3NlY29uZGFyeSdcbiAgY29uZmlybUxvYWRpbmc/OiBib29sZWFuXG4gIGNvbmZpcm1EaXNhYmxlZD86IGJvb2xlYW5cbn1cblxuZXhwb3J0IGNvbnN0IE1vZGFsRm9vdGVyOiBDb21wb25lbnQ8TW9kYWxGb290ZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgY29uZmlybVRleHQgPSAoKSA9PiBwcm9wcy5jb25maXJtVGV4dCB8fCAnQ29uZmlybSdcbiAgY29uc3QgY2FuY2VsVGV4dCA9ICgpID0+IHByb3BzLmNhbmNlbFRleHQgfHwgJ0NhbmNlbCdcbiAgY29uc3QgY29uZmlybVZhcmlhbnQgPSAoKSA9PiBwcm9wcy5jb25maXJtVmFyaWFudCB8fCAncHJpbWFyeSdcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWVuZCBnYXAtM1wiPlxuICAgICAgPFNob3cgd2hlbj17cHJvcHMub25DYW5jZWx9PlxuICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgdmFyaWFudD1cImdob3N0XCJcbiAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNhbmNlbH1cbiAgICAgICAgPlxuICAgICAgICAgIHtjYW5jZWxUZXh0KCl9XG4gICAgICAgIDwvQnV0dG9uPlxuICAgICAgPC9TaG93PlxuICAgICAgPFNob3cgd2hlbj17cHJvcHMub25Db25maXJtfT5cbiAgICAgICAgPEJ1dHRvblxuICAgICAgICAgIHZhcmlhbnQ9e2NvbmZpcm1WYXJpYW50KCl9XG4gICAgICAgICAgb25DbGljaz17cHJvcHMub25Db25maXJtfVxuICAgICAgICAgIGxvYWRpbmc9e3Byb3BzLmNvbmZpcm1Mb2FkaW5nfVxuICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5jb25maXJtRGlzYWJsZWR9XG4gICAgICAgID5cbiAgICAgICAgICB7Y29uZmlybVRleHQoKX1cbiAgICAgICAgPC9CdXR0b24+XG4gICAgICA8L1Nob3c+XG4gICAgPC9kaXY+XG4gIClcbn1cblxuLy8gVXRpbGl0eSBmdW5jdGlvbiBmb3IgY29tbW9uIG1vZGFsIHBhdHRlcm5zXG5leHBvcnQgaW50ZXJmYWNlIENvbmZpcm1Nb2RhbFByb3BzIHtcbiAgb3BlbjogYm9vbGVhblxuICBvbkNsb3NlOiAoKSA9PiB2b2lkXG4gIG9uQ29uZmlybTogKCkgPT4gdm9pZFxuICB0aXRsZTogc3RyaW5nXG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nXG4gIGNvbmZpcm1UZXh0Pzogc3RyaW5nXG4gIGNhbmNlbFRleHQ/OiBzdHJpbmdcbiAgdmFyaWFudD86ICdkZWZhdWx0JyB8ICdkYW5nZXInXG4gIGNvbmZpcm1Mb2FkaW5nPzogYm9vbGVhblxufVxuXG5leHBvcnQgY29uc3QgQ29uZmlybU1vZGFsOiBDb21wb25lbnQ8Q29uZmlybU1vZGFsUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPE1vZGFsXG4gICAgICBvcGVuPXtwcm9wcy5vcGVufVxuICAgICAgb25DbG9zZT17cHJvcHMub25DbG9zZX1cbiAgICAgIHRpdGxlPXtwcm9wcy50aXRsZX1cbiAgICAgIGRlc2NyaXB0aW9uPXtwcm9wcy5kZXNjcmlwdGlvbn1cbiAgICAgIHZhcmlhbnQ9e3Byb3BzLnZhcmlhbnR9XG4gICAgICBzaXplPVwic21cIlxuICAgICAgZm9vdGVyPXtcbiAgICAgICAgPE1vZGFsRm9vdGVyXG4gICAgICAgICAgb25Db25maXJtPXtwcm9wcy5vbkNvbmZpcm19XG4gICAgICAgICAgb25DYW5jZWw9e3Byb3BzLm9uQ2xvc2V9XG4gICAgICAgICAgY29uZmlybVRleHQ9e3Byb3BzLmNvbmZpcm1UZXh0fVxuICAgICAgICAgIGNhbmNlbFRleHQ9e3Byb3BzLmNhbmNlbFRleHR9XG4gICAgICAgICAgY29uZmlybVZhcmlhbnQ9e3Byb3BzLnZhcmlhbnQgPT09ICdkYW5nZXInID8gJ2RhbmdlcicgOiAncHJpbWFyeSd9XG4gICAgICAgICAgY29uZmlybUxvYWRpbmc9e3Byb3BzLmNvbmZpcm1Mb2FkaW5nfVxuICAgICAgICAvPlxuICAgICAgfVxuICAgIC8+XG4gIClcbn0iLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcblxuZXhwb3J0IGludGVyZmFjZSBNaW5pbWl6ZWRLYXJhb2tlUHJvcHMge1xuICBvbkNsaWNrOiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgTWluaW1pemVkS2FyYW9rZTogQ29tcG9uZW50PE1pbmltaXplZEthcmFva2VQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8YnV0dG9uXG4gICAgICBvbkNsaWNrPXtwcm9wcy5vbkNsaWNrfVxuICAgICAgc3R5bGU9e3tcbiAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICAgIGJvdHRvbTogJzI0cHgnLFxuICAgICAgICByaWdodDogJzI0cHgnLFxuICAgICAgICB3aWR0aDogJzgwcHgnLFxuICAgICAgICBoZWlnaHQ6ICc4MHB4JyxcbiAgICAgICAgJ2JvcmRlci1yYWRpdXMnOiAnNTAlJyxcbiAgICAgICAgYmFja2dyb3VuZDogJ2xpbmVhci1ncmFkaWVudCgxMzVkZWcsICNGRjAwNkUgMCUsICNDMTM1ODQgMTAwJSknLFxuICAgICAgICAnYm94LXNoYWRvdyc6ICcwIDhweCAzMnB4IHJnYmEoMCwgMCwgMCwgMC4zKScsXG4gICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcbiAgICAgICAgJ2FsaWduLWl0ZW1zJzogJ2NlbnRlcicsXG4gICAgICAgICdqdXN0aWZ5LWNvbnRlbnQnOiAnY2VudGVyJyxcbiAgICAgICAgb3ZlcmZsb3c6ICdoaWRkZW4nLFxuICAgICAgICBjdXJzb3I6ICdwb2ludGVyJyxcbiAgICAgICAgJ3otaW5kZXgnOiAnOTk5OTknLFxuICAgICAgICBib3JkZXI6ICdub25lJyxcbiAgICAgICAgdHJhbnNpdGlvbjogJ3RyYW5zZm9ybSAwLjJzIGVhc2UnLFxuICAgICAgfX1cbiAgICAgIG9uTW91c2VFbnRlcj17KGUpID0+IHtcbiAgICAgICAgZS5jdXJyZW50VGFyZ2V0LnN0eWxlLnRyYW5zZm9ybSA9ICdzY2FsZSgxLjEpJztcbiAgICAgIH19XG4gICAgICBvbk1vdXNlTGVhdmU9eyhlKSA9PiB7XG4gICAgICAgIGUuY3VycmVudFRhcmdldC5zdHlsZS50cmFuc2Zvcm0gPSAnc2NhbGUoMSknO1xuICAgICAgfX1cbiAgICAgIGFyaWEtbGFiZWw9XCJPcGVuIEthcmFva2VcIlxuICAgID5cbiAgICAgIHsvKiBQbGFjZSB5b3VyIDIwMHgyMDAgaW1hZ2UgaGVyZSBhczogKi99XG4gICAgICB7LyogPGltZyBzcmM9XCIvcGF0aC90by95b3VyL2ltYWdlLnBuZ1wiIGFsdD1cIkthcmFva2VcIiBzdHlsZT1cIndpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IG9iamVjdC1maXQ6IGNvdmVyO1wiIC8+ICovfVxuICAgICAgXG4gICAgICB7LyogRm9yIG5vdywgdXNpbmcgYSBwbGFjZWhvbGRlciBpY29uICovfVxuICAgICAgPHNwYW4gc3R5bGU9e3sgJ2ZvbnQtc2l6ZSc6ICczNnB4JyB9fT7wn46kPC9zcGFuPlxuICAgIDwvYnV0dG9uPlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgSWNvblhSZWd1bGFyIGZyb20gJ3Bob3NwaG9yLWljb25zLXNvbGlkL0ljb25YUmVndWxhcic7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBQcmFjdGljZUhlYWRlclByb3BzIHtcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIG9uRXhpdDogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBQcmFjdGljZUhlYWRlcjogQ29tcG9uZW50PFByYWN0aWNlSGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPFNob3cgd2hlbj17cHJvcHMudGl0bGV9PlxuICAgICAgPGhlYWRlciBjbGFzcz17Y24oJ2ZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGgtMTQgcHgtNCBiZy10cmFuc3BhcmVudCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICAgIDxoMSBjbGFzcz1cInRleHQtbGcgZm9udC1zZW1pYm9sZCB0ZXh0LXByaW1hcnlcIj5cbiAgICAgICAgICB7cHJvcHMudGl0bGV9XG4gICAgICAgIDwvaDE+XG4gICAgICA8L2hlYWRlcj5cbiAgICA8L1Nob3c+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9CdXR0b24nO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXhlcmNpc2VGb290ZXJQcm9wcyB7XG4gIGlzUmVjb3JkaW5nPzogYm9vbGVhbjtcbiAgaXNQcm9jZXNzaW5nPzogYm9vbGVhbjtcbiAgY2FuU3VibWl0PzogYm9vbGVhbjtcbiAgb25SZWNvcmQ/OiAoKSA9PiB2b2lkO1xuICBvblN0b3A/OiAoKSA9PiB2b2lkO1xuICBvblN1Ym1pdD86ICgpID0+IHZvaWQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgRXhlcmNpc2VGb290ZXI6IENvbXBvbmVudDxFeGVyY2lzZUZvb3RlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxmb290ZXIgY2xhc3M9e2NuKCdib3JkZXItdCBib3JkZXItc3VidGxlIGJnLXN1cmZhY2UgcC02JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy0yeGwgbXgtYXV0b1wiPlxuICAgICAgICA8U2hvd1xuICAgICAgICAgIHdoZW49eyFwcm9wcy5pc1JlY29yZGluZ31cbiAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgIHZhcmlhbnQ9XCJwcmltYXJ5XCJcbiAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgZnVsbFdpZHRoXG4gICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uU3RvcH1cbiAgICAgICAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmlzUHJvY2Vzc2luZ31cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgU3RvcFxuICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgfVxuICAgICAgICA+XG4gICAgICAgICAgPFNob3dcbiAgICAgICAgICAgIHdoZW49e3Byb3BzLmNhblN1Ym1pdH1cbiAgICAgICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJwcmltYXJ5XCJcbiAgICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICAgIGZ1bGxXaWR0aFxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uUmVjb3JkfVxuICAgICAgICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5pc1Byb2Nlc3Npbmd9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICBSZWNvcmRcbiAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICB9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICB2YXJpYW50PVwicHJpbWFyeVwiXG4gICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgIGZ1bGxXaWR0aFxuICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblN1Ym1pdH1cbiAgICAgICAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmlzUHJvY2Vzc2luZ31cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAge3Byb3BzLmlzUHJvY2Vzc2luZyA/ICdQcm9jZXNzaW5nLi4uJyA6ICdTdWJtaXQnfVxuICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgPC9TaG93PlxuICAgICAgICA8L1Nob3c+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Zvb3Rlcj5cbiAgKTtcbn07IiwiZXhwb3J0IGRlZmF1bHQgKHApID0+ICg8c3ZnIGNsYXNzPXtwLmNsYXNzfSBkYXRhLXBob3NwaG9yLWljb249XCJjaGVjay1jaXJjbGVcIiBhcmlhLWhpZGRlbj1cInRydWVcIiB3aWR0aD1cIjFlbVwiIGhlaWdodD1cIjFlbVwiIHBvaW50ZXItZXZlbnRzPVwibm9uZVwiIGRpc3BsYXk9XCJpbmxpbmUtYmxvY2tcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgZmlsbD1cImN1cnJlbnRDb2xvclwiIHZpZXdCb3g9XCIwIDAgMjU2IDI1NlwiPjxwYXRoIGQ9XCJNMTI4IDI0YTEwNCAxMDQgMCAxIDAgMTA0IDEwNEExMDQuMTEgMTA0LjExIDAgMCAwIDEyOCAyNG00NS42NiA4NS42Ni01NiA1NmE4IDggMCAwIDEtMTEuMzIgMGwtMjQtMjRhOCA4IDAgMCAxIDExLjMyLTExLjMyTDExMiAxNDguNjlsNTAuMzQtNTAuMzVhOCA4IDAgMCAxIDExLjMyIDExLjMyXCIvPjwvc3ZnPik7XG4iLCJleHBvcnQgZGVmYXVsdCAocCkgPT4gKDxzdmcgY2xhc3M9e3AuY2xhc3N9IGRhdGEtcGhvc3Bob3ItaWNvbj1cIngtY2lyY2xlXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCIgd2lkdGg9XCIxZW1cIiBoZWlnaHQ9XCIxZW1cIiBwb2ludGVyLWV2ZW50cz1cIm5vbmVcIiBkaXNwbGF5PVwiaW5saW5lLWJsb2NrXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiB2aWV3Qm94PVwiMCAwIDI1NiAyNTZcIj48cGF0aCBkPVwiTTEyOCAyNGExMDQgMTA0IDAgMSAwIDEwNCAxMDRBMTA0LjExIDEwNC4xMSAwIDAgMCAxMjggMjRtMzcuNjYgMTMwLjM0YTggOCAwIDAgMS0xMS4zMiAxMS4zMkwxMjggMTM5LjMxbC0yNi4zNCAyNi4zNWE4IDggMCAwIDEtMTEuMzItMTEuMzJMMTE2LjY5IDEyOGwtMjYuMzUtMjYuMzRhOCA4IDAgMCAxIDExLjMyLTExLjMyTDEyOCAxMTYuNjlsMjYuMzQtMjYuMzVhOCA4IDAgMCAxIDExLjMyIDExLjMyTDEzOS4zMSAxMjhaXCIvPjwvc3ZnPik7XG4iLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vQnV0dG9uJztcbmltcG9ydCBJY29uQ2hlY2tDaXJjbGVGaWxsIGZyb20gJ3Bob3NwaG9yLWljb25zLXNvbGlkL0ljb25DaGVja0NpcmNsZUZpbGwnO1xuaW1wb3J0IEljb25YQ2lyY2xlRmlsbCBmcm9tICdwaG9zcGhvci1pY29ucy1zb2xpZC9JY29uWENpcmNsZUZpbGwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlc3BvbnNlRm9vdGVyUHJvcHMge1xuICBtb2RlOiAnY2hlY2snIHwgJ2ZlZWRiYWNrJztcbiAgaXNDb3JyZWN0PzogYm9vbGVhbjtcbiAgZmVlZGJhY2tUZXh0Pzogc3RyaW5nO1xuICBjb250aW51ZUxhYmVsPzogc3RyaW5nO1xuICBvbkNoZWNrPzogKCkgPT4gdm9pZDtcbiAgb25Db250aW51ZT86ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBSZXNwb25zZUZvb3RlcjogQ29tcG9uZW50PFJlc3BvbnNlRm9vdGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz1cImJvcmRlci10IGJvcmRlci1zdWJ0bGUgYmctc3VyZmFjZSBwLTZcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy0yeGwgbXgtYXV0b1wiPlxuICAgICAgICA8U2hvd1xuICAgICAgICAgIHdoZW49e3Byb3BzLm1vZGUgPT09ICdjaGVjayd9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtNlwiPlxuICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuaXNDb3JyZWN0ICE9PSB1bmRlZmluZWR9PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTRcIj5cbiAgICAgICAgICAgICAgICA8U2hvd1xuICAgICAgICAgICAgICAgICAgd2hlbj17cHJvcHMuaXNDb3JyZWN0fVxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9ezxJY29uWENpcmNsZUZpbGwgY2xhc3M9XCJ3LTE2IGgtMTYgZmxleC1zaHJpbmstMCB0ZXh0LXJlZC01MDBcIiBzdHlsZT1cImNvbG9yOiAjZWY0NDQ0O1wiIC8+fVxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxJY29uQ2hlY2tDaXJjbGVGaWxsIGNsYXNzPVwidy0xNiBoLTE2IGZsZXgtc2hyaW5rLTAgdGV4dC1ncmVlbi01MDBcIiBzdHlsZT1cImNvbG9yOiAjMjJjNTVlO1wiIC8+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtMnhsIGZvbnQtYm9sZFwiIHN0eWxlPXtgY29sb3I6ICR7cHJvcHMuaXNDb3JyZWN0ID8gJyMyMmM1NWUnIDogJyNlZjQ0NDQnfTtgfT5cbiAgICAgICAgICAgICAgICAgICAge3Byb3BzLmlzQ29ycmVjdCA/ICdDb3JyZWN0IScgOiAnSW5jb3JyZWN0J31cbiAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmZlZWRiYWNrVGV4dCAmJiAhcHJvcHMuaXNDb3JyZWN0fT5cbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWJhc2UgdGV4dC1zZWNvbmRhcnkgbXQtMVwiPntwcm9wcy5mZWVkYmFja1RleHR9PC9wPlxuICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgdmFyaWFudD1cInByaW1hcnlcIlxuICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNvbnRpbnVlfVxuICAgICAgICAgICAgICBjbGFzcz1cIm1pbi13LVsxODBweF1cIlxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7cHJvcHMuY29udGludWVMYWJlbCB8fCAnTmV4dCd9XG4gICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgfVxuICAgICAgPlxuICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgdmFyaWFudD1cInByaW1hcnlcIlxuICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgZnVsbFdpZHRoXG4gICAgICAgICAgb25DbGljaz17cHJvcHMub25DaGVja31cbiAgICAgICAgPlxuICAgICAgICAgIENoZWNrXG4gICAgICAgIDwvQnV0dG9uPlxuICAgICAgPC9TaG93PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50LCBKU1ggfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBFeGVyY2lzZVRlbXBsYXRlUHJvcHMge1xuICBpbnN0cnVjdGlvblRleHQ/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBFeGVyY2lzZVRlbXBsYXRlOiBDb21wb25lbnQ8RXhlcmNpc2VUZW1wbGF0ZVByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sIGgtZnVsbCBiZy1iYXNlIHRleHQtcHJpbWFyeScsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8ZGl2IGNsYXNzPVwiZmxleC1ncm93IG92ZXJmbG93LXktYXV0byBmbGV4IGZsZXgtY29sIHBiLTI0XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ3LWZ1bGwgbWF4LXctMnhsIG14LWF1dG8gcHgtNCBweS04XCI+XG4gICAgICAgICAge3Byb3BzLmluc3RydWN0aW9uVGV4dCAmJiAoXG4gICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1tdXRlZC1mb3JlZ3JvdW5kIG1iLTQgdGV4dC1sZWZ0XCI+XG4gICAgICAgICAgICAgIHtwcm9wcy5pbnN0cnVjdGlvblRleHR9XG4gICAgICAgICAgICA8L3A+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlYWRBbG91ZFByb3BzIHtcbiAgcHJvbXB0OiBzdHJpbmc7XG4gIHVzZXJUcmFuc2NyaXB0Pzogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFJlYWRBbG91ZDogQ29tcG9uZW50PFJlYWRBbG91ZFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdzcGFjZS15LTQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgPHAgY2xhc3M9XCJ0ZXh0LTJ4bCB0ZXh0LWxlZnQgbGVhZGluZy1yZWxheGVkXCI+XG4gICAgICAgIHtwcm9wcy5wcm9tcHR9XG4gICAgICA8L3A+XG4gICAgICBcbiAgICAgIDxTaG93IHdoZW49e3Byb3BzLnVzZXJUcmFuc2NyaXB0fT5cbiAgICAgICAgPGRpdiBjbGFzcz1cIm10LThcIj5cbiAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1tdXRlZC1mb3JlZ3JvdW5kIG1iLTRcIj5Zb3Ugc2FpZDo8L3A+XG4gICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LTJ4bCB0ZXh0LWxlZnQgbGVhZGluZy1yZWxheGVkXCI+XG4gICAgICAgICAgICB7cHJvcHMudXNlclRyYW5zY3JpcHR9XG4gICAgICAgICAgPC9wPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiLy8gU291bmQgdXRpbGl0eSBmb3IgcGxheWluZyBmZWVkYmFjayBzb3VuZHNcbmV4cG9ydCBjbGFzcyBTb3VuZE1hbmFnZXIge1xuICBwcml2YXRlIHN0YXRpYyBpbnN0YW5jZTogU291bmRNYW5hZ2VyO1xuICBwcml2YXRlIHNvdW5kczogTWFwPHN0cmluZywgSFRNTEF1ZGlvRWxlbWVudD4gPSBuZXcgTWFwKCk7XG4gIHByaXZhdGUgZW5hYmxlZDogYm9vbGVhbiA9IHRydWU7XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcigpIHtcbiAgICAvLyBQcmVsb2FkIHNvdW5kc1xuICAgIHRoaXMubG9hZFNvdW5kKCdjb3JyZWN0JywgJy9zb3VuZHMvY29ycmVjdC5tcDMnKTtcbiAgICB0aGlzLmxvYWRTb3VuZCgnaW5jb3JyZWN0JywgJy9zb3VuZHMvaW5jb3JyZWN0Lm1wMycpO1xuICB9XG5cbiAgc3RhdGljIGdldEluc3RhbmNlKCk6IFNvdW5kTWFuYWdlciB7XG4gICAgaWYgKCFTb3VuZE1hbmFnZXIuaW5zdGFuY2UpIHtcbiAgICAgIFNvdW5kTWFuYWdlci5pbnN0YW5jZSA9IG5ldyBTb3VuZE1hbmFnZXIoKTtcbiAgICB9XG4gICAgcmV0dXJuIFNvdW5kTWFuYWdlci5pbnN0YW5jZTtcbiAgfVxuXG4gIHByaXZhdGUgbG9hZFNvdW5kKG5hbWU6IHN0cmluZywgcGF0aDogc3RyaW5nKSB7XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgXG4gICAgY29uc3QgYXVkaW8gPSBuZXcgQXVkaW8ocGF0aCk7XG4gICAgYXVkaW8ucHJlbG9hZCA9ICdhdXRvJztcbiAgICBhdWRpby52b2x1bWUgPSAwLjU7IC8vIERlZmF1bHQgdm9sdW1lXG4gICAgdGhpcy5zb3VuZHMuc2V0KG5hbWUsIGF1ZGlvKTtcbiAgfVxuXG4gIHBsYXkoc291bmROYW1lOiAnY29ycmVjdCcgfCAnaW5jb3JyZWN0Jykge1xuICAgIGlmICghdGhpcy5lbmFibGVkKSByZXR1cm47XG4gICAgXG4gICAgY29uc3QgYXVkaW8gPSB0aGlzLnNvdW5kcy5nZXQoc291bmROYW1lKTtcbiAgICBpZiAoYXVkaW8pIHtcbiAgICAgIC8vIENsb25lIHRoZSBhdWRpbyB0byBhbGxvdyBvdmVybGFwcGluZyBzb3VuZHNcbiAgICAgIGNvbnN0IGNsb25lID0gYXVkaW8uY2xvbmVOb2RlKCkgYXMgSFRNTEF1ZGlvRWxlbWVudDtcbiAgICAgIGNsb25lLnZvbHVtZSA9IGF1ZGlvLnZvbHVtZTtcbiAgICAgIGNsb25lLnBsYXkoKS5jYXRjaChlcnIgPT4ge1xuICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byBwbGF5IHNvdW5kOicsIGVycik7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBzZXRWb2x1bWUodm9sdW1lOiBudW1iZXIpIHtcbiAgICBjb25zdCBjbGFtcGVkVm9sdW1lID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oMSwgdm9sdW1lKSk7XG4gICAgdGhpcy5zb3VuZHMuZm9yRWFjaChhdWRpbyA9PiB7XG4gICAgICBhdWRpby52b2x1bWUgPSBjbGFtcGVkVm9sdW1lO1xuICAgIH0pO1xuICB9XG5cbiAgc2V0RW5hYmxlZChlbmFibGVkOiBib29sZWFuKSB7XG4gICAgdGhpcy5lbmFibGVkID0gZW5hYmxlZDtcbiAgfVxuXG4gIGlzRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5lbmFibGVkO1xuICB9XG59XG5cbi8vIEV4cG9ydCBzaW5nbGV0b24gaW5zdGFuY2VcbmV4cG9ydCBjb25zdCBzb3VuZE1hbmFnZXIgPSBTb3VuZE1hbmFnZXIuZ2V0SW5zdGFuY2UoKTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNyZWF0ZVJlc291cmNlLCBTaG93LCBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IFJlYWRBbG91ZCB9IGZyb20gJy4uL1JlYWRBbG91ZCc7XG5pbXBvcnQgeyBQcm9ncmVzc0JhciB9IGZyb20gJy4uLy4uL2NvbW1vbi9Qcm9ncmVzc0Jhcic7XG5pbXBvcnQgeyBQcmFjdGljZUhlYWRlciB9IGZyb20gJy4uL1ByYWN0aWNlSGVhZGVyJztcbmltcG9ydCB7IEV4ZXJjaXNlVGVtcGxhdGUgfSBmcm9tICcuLi9FeGVyY2lzZVRlbXBsYXRlJztcbmltcG9ydCB7IEV4ZXJjaXNlRm9vdGVyIH0gZnJvbSAnLi4vRXhlcmNpc2VGb290ZXInO1xuaW1wb3J0IHsgUmVzcG9uc2VGb290ZXIgfSBmcm9tICcuLi9SZXNwb25zZUZvb3Rlcic7XG5pbXBvcnQgdHlwZSB7IFJlYWRBbG91ZEV4ZXJjaXNlIGFzIEV4ZXJjaXNlIH0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuaW1wb3J0IHsgc291bmRNYW5hZ2VyIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvc291bmQnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByYWN0aWNlRXhlcmNpc2VWaWV3UHJvcHMge1xuICBzZXNzaW9uSWQ/OiBzdHJpbmc7XG4gIG9uQmFjazogKCkgPT4gdm9pZDtcbiAgYXBpQmFzZVVybD86IHN0cmluZztcbiAgYXV0aFRva2VuPzogc3RyaW5nO1xuICBoZWFkZXJUaXRsZT86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFByYWN0aWNlRXhlcmNpc2VWaWV3OiBDb21wb25lbnQ8UHJhY3RpY2VFeGVyY2lzZVZpZXdQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2N1cnJlbnRFeGVyY2lzZUluZGV4LCBzZXRDdXJyZW50RXhlcmNpc2VJbmRleF0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFtpc1JlY29yZGluZywgc2V0SXNSZWNvcmRpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2lzUHJvY2Vzc2luZywgc2V0SXNQcm9jZXNzaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFt1c2VyVHJhbnNjcmlwdCwgc2V0VXNlclRyYW5zY3JpcHRdID0gY3JlYXRlU2lnbmFsKCcnKTtcbiAgY29uc3QgW2N1cnJlbnRTY29yZSwgc2V0Q3VycmVudFNjb3JlXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW21lZGlhUmVjb3JkZXIsIHNldE1lZGlhUmVjb3JkZXJdID0gY3JlYXRlU2lnbmFsPE1lZGlhUmVjb3JkZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2F1ZGlvQ2h1bmtzLCBzZXRBdWRpb0NodW5rc10gPSBjcmVhdGVTaWduYWw8QmxvYltdPihbXSk7XG4gIGNvbnN0IFtzaG93RmVlZGJhY2ssIHNldFNob3dGZWVkYmFja10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbaXNDb3JyZWN0LCBzZXRJc0NvcnJlY3RdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgXG4gIGNvbnN0IGFwaUJhc2VVcmwgPSAoKSA9PiBwcm9wcy5hcGlCYXNlVXJsIHx8ICdodHRwczovL3NjYXJsZXR0LWFwaS1kZXYuZGVsZXRpb24tYmFja3VwNzgyLndvcmtlcnMuZGV2JztcbiAgXG4gIC8vIEZldGNoIGV4ZXJjaXNlcyBmcm9tIHRoZSBBUElcbiAgY29uc3QgW2V4ZXJjaXNlc10gPSBjcmVhdGVSZXNvdXJjZShhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIEluY2x1ZGUgc2Vzc2lvbklkIGlmIHByb3ZpZGVkIHRvIGdldCBleGVyY2lzZXMgZnJvbSB0aGlzIHNlc3Npb24gb25seVxuICAgICAgY29uc3QgdXJsID0gcHJvcHMuc2Vzc2lvbklkIFxuICAgICAgICA/IGAke2FwaUJhc2VVcmwoKX0vYXBpL3ByYWN0aWNlL2V4ZXJjaXNlcz9saW1pdD0xMCZzZXNzaW9uSWQ9JHtwcm9wcy5zZXNzaW9uSWR9YFxuICAgICAgICA6IGAke2FwaUJhc2VVcmwoKX0vYXBpL3ByYWN0aWNlL2V4ZXJjaXNlcz9saW1pdD0xMGA7XG4gICAgICBcbiAgICAgIGNvbnN0IGhlYWRlcnM6IEhlYWRlcnNJbml0ID0ge307XG4gICAgICBpZiAocHJvcHMuYXV0aFRva2VuKSB7XG4gICAgICAgIGhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9IGBCZWFyZXIgJHtwcm9wcy5hdXRoVG9rZW59YDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHsgaGVhZGVycyB9KTtcbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc3QgZXJyb3JUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbUHJhY3RpY2VFeGVyY2lzZVZpZXddIEFQSSBlcnJvcjonLCByZXNwb25zZS5zdGF0dXMsIGVycm9yVGV4dCk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGZldGNoIGV4ZXJjaXNlcycpO1xuICAgICAgfVxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgIFxuICAgICAgaWYgKGRhdGEuZGF0YSAmJiBkYXRhLmRhdGEuZXhlcmNpc2VzKSB7XG4gICAgICAgIHJldHVybiBkYXRhLmRhdGEuZXhlcmNpc2VzIGFzIEV4ZXJjaXNlW107XG4gICAgICB9XG4gICAgICByZXR1cm4gW107XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQcmFjdGljZUV4ZXJjaXNlVmlld10gRmFpbGVkIHRvIGZldGNoOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIExvZyB3aGVuIGV4ZXJjaXNlcyBsb2FkXG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgZXhlcmNpc2VMaXN0ID0gZXhlcmNpc2VzKCk7XG4gIH0pO1xuXG4gIGNvbnN0IGhhbmRsZVN0YXJ0UmVjb3JkaW5nID0gYXN5bmMgKCkgPT4ge1xuICAgIHNldFVzZXJUcmFuc2NyaXB0KCcnKTtcbiAgICBzZXRDdXJyZW50U2NvcmUobnVsbCk7XG4gICAgc2V0QXVkaW9DaHVua3MoW10pO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdHJlYW0gPSBhd2FpdCBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSh7IFxuICAgICAgICBhdWRpbzoge1xuICAgICAgICAgIGVjaG9DYW5jZWxsYXRpb246IHRydWUsXG4gICAgICAgICAgbm9pc2VTdXBwcmVzc2lvbjogdHJ1ZSxcbiAgICAgICAgICBhdXRvR2FpbkNvbnRyb2w6IHRydWVcbiAgICAgICAgfSBcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBtaW1lVHlwZSA9IE1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKCdhdWRpby93ZWJtO2NvZGVjcz1vcHVzJykgXG4gICAgICAgID8gJ2F1ZGlvL3dlYm07Y29kZWNzPW9wdXMnIFxuICAgICAgICA6ICdhdWRpby93ZWJtJztcbiAgICAgICAgXG4gICAgICBjb25zdCByZWNvcmRlciA9IG5ldyBNZWRpYVJlY29yZGVyKHN0cmVhbSwgeyBtaW1lVHlwZSB9KTtcbiAgICAgIGNvbnN0IGNodW5rczogQmxvYltdID0gW107XG4gICAgICBcbiAgICAgIHJlY29yZGVyLm9uZGF0YWF2YWlsYWJsZSA9IChldmVudCkgPT4ge1xuICAgICAgICBpZiAoZXZlbnQuZGF0YS5zaXplID4gMCkge1xuICAgICAgICAgIGNodW5rcy5wdXNoKGV2ZW50LmRhdGEpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgXG4gICAgICByZWNvcmRlci5vbnN0b3AgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGF1ZGlvQmxvYiA9IG5ldyBCbG9iKGNodW5rcywgeyB0eXBlOiBtaW1lVHlwZSB9KTtcbiAgICAgICAgYXdhaXQgcHJvY2Vzc1JlY29yZGluZyhhdWRpb0Jsb2IpO1xuICAgICAgICBcbiAgICAgICAgLy8gU3RvcCBhbGwgdHJhY2tzXG4gICAgICAgIHN0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKHRyYWNrID0+IHRyYWNrLnN0b3AoKSk7XG4gICAgICB9O1xuICAgICAgXG4gICAgICByZWNvcmRlci5zdGFydCgpO1xuICAgICAgc2V0TWVkaWFSZWNvcmRlcihyZWNvcmRlcik7XG4gICAgICBzZXRJc1JlY29yZGluZyh0cnVlKTtcbiAgICAgIFxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbUHJhY3RpY2VFeGVyY2lzZVZpZXddIEZhaWxlZCB0byBzdGFydCByZWNvcmRpbmc6JywgZXJyb3IpO1xuICAgICAgc2V0SXNSZWNvcmRpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBwcm9jZXNzUmVjb3JkaW5nID0gYXN5bmMgKGJsb2I6IEJsb2IpID0+IHtcbiAgICB0cnkge1xuICAgICAgc2V0SXNQcm9jZXNzaW5nKHRydWUpO1xuICAgICAgXG4gICAgICAvLyBDb252ZXJ0IHRvIGJhc2U2NCBmb3IgQVBJXG4gICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgY29uc3QgYmFzZTY0ID0gYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICByZWFkZXIub25sb2FkZW5kID0gKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGJhc2U2NFN0cmluZyA9IHJlYWRlci5yZXN1bHQgYXMgc3RyaW5nO1xuICAgICAgICAgIHJlc29sdmUoYmFzZTY0U3RyaW5nLnNwbGl0KCcsJylbMV0pO1xuICAgICAgICB9O1xuICAgICAgICByZWFkZXIucmVhZEFzRGF0YVVSTChibG9iKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBTZW5kIHRvIFNUVCBBUEkgd2l0aCByZXRyeSBsb2dpY1xuICAgICAgbGV0IHJlc3BvbnNlO1xuICAgICAgbGV0IGF0dGVtcHRzID0gMDtcbiAgICAgIGNvbnN0IG1heEF0dGVtcHRzID0gMjtcbiAgICAgIFxuICAgICAgY29uc3QgaGVhZGVyczogSGVhZGVyc0luaXQgPSB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfTtcbiAgICAgIGlmIChwcm9wcy5hdXRoVG9rZW4pIHtcbiAgICAgICAgaGVhZGVyc1snQXV0aG9yaXphdGlvbiddID0gYEJlYXJlciAke3Byb3BzLmF1dGhUb2tlbn1gO1xuICAgICAgfVxuICAgICAgXG4gICAgICB3aGlsZSAoYXR0ZW1wdHMgPCBtYXhBdHRlbXB0cykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7YXBpQmFzZVVybCgpfS9hcGkvc3BlZWNoLXRvLXRleHQvdHJhbnNjcmliZWAsIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgaGVhZGVycyxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgXG4gICAgICAgICAgICAgIGF1ZGlvQmFzZTY0OiBiYXNlNjQsXG4gICAgICAgICAgICAgIGV4cGVjdGVkVGV4dDogY3VycmVudEV4ZXJjaXNlKCk/LmZ1bGxfbGluZSxcbiAgICAgICAgICAgICAgLy8gVXNlIERlZXBncmFtIG9uIHJldHJ5XG4gICAgICAgICAgICAgIHByZWZlckRlZXBncmFtOiBhdHRlbXB0cyA+IDBcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGZldGNoRXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJhY3RpY2VFeGVyY2lzZVZpZXddIFNUVCBhdHRlbXB0ICR7YXR0ZW1wdHMgKyAxfSBmYWlsZWQ6YCwgZmV0Y2hFcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGF0dGVtcHRzKys7XG4gICAgICAgIGlmIChhdHRlbXB0cyA8IG1heEF0dGVtcHRzKSB7XG4gICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDUwMCkpOyAvLyBTbWFsbCBkZWxheSBiZWZvcmUgcmV0cnlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICBzZXRVc2VyVHJhbnNjcmlwdChyZXN1bHQuZGF0YS50cmFuc2NyaXB0KTtcbiAgICAgICAgXG4gICAgICAgIC8vIENhbGN1bGF0ZSBhIHNpbXBsZSBzY29yZSBiYXNlZCBvbiBtYXRjaGluZyB3b3Jkc1xuICAgICAgICBjb25zdCBzY29yZSA9IGNhbGN1bGF0ZVNjb3JlKGN1cnJlbnRFeGVyY2lzZSgpPy5mdWxsX2xpbmUgfHwgJycsIHJlc3VsdC5kYXRhLnRyYW5zY3JpcHQpO1xuICAgICAgICBzZXRDdXJyZW50U2NvcmUoc2NvcmUpO1xuICAgICAgICBcbiAgICAgICAgLy8gQXV0b21hdGljYWxseSBzdWJtaXQgYWZ0ZXIgdHJhbnNjcmlwdGlvblxuICAgICAgICBhd2FpdCBoYW5kbGVBdXRvU3VibWl0KHNjb3JlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU1RUIGZhaWxlZCBhZnRlciByZXRyaWVzJyk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQcmFjdGljZUV4ZXJjaXNlVmlld10gRmFpbGVkIHRvIHByb2Nlc3MgcmVjb3JkaW5nOicsIGVycm9yKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0SXNQcm9jZXNzaW5nKGZhbHNlKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlU3RvcFJlY29yZGluZyA9ICgpID0+IHtcbiAgICBjb25zdCByZWNvcmRlciA9IG1lZGlhUmVjb3JkZXIoKTtcbiAgICBpZiAocmVjb3JkZXIgJiYgcmVjb3JkZXIuc3RhdGUgIT09ICdpbmFjdGl2ZScpIHtcbiAgICAgIHJlY29yZGVyLnN0b3AoKTtcbiAgICAgIHNldElzUmVjb3JkaW5nKGZhbHNlKTtcbiAgICB9XG4gIH07XG5cbiAgLy8gTm9ybWFsaXplIHRleHQgZm9yIGNvbXBhcmlzb24gKHNhbWUgYXMgc2VydmVyLXNpZGUpXG4gIGNvbnN0IG5vcm1hbGl6ZVRleHQgPSAodGV4dDogc3RyaW5nKTogc3RyaW5nID0+IHtcbiAgICByZXR1cm4gdGV4dFxuICAgICAgLnRvTG93ZXJDYXNlKClcbiAgICAgIC5yZXBsYWNlKC9bXlxcd1xccyctXS9nLCAnJykgLy8gUmVtb3ZlIHB1bmN0dWF0aW9uIGV4Y2VwdCBhcG9zdHJvcGhlcyBhbmQgaHlwaGVuc1xuICAgICAgLnJlcGxhY2UoL1xccysvZywgJyAnKVxuICAgICAgLnRyaW0oKTtcbiAgfTtcbiAgXG4gIGNvbnN0IGNhbGN1bGF0ZVNjb3JlID0gKGV4cGVjdGVkOiBzdHJpbmcsIGFjdHVhbDogc3RyaW5nKTogbnVtYmVyID0+IHtcbiAgICBjb25zdCBub3JtYWxpemVkRXhwZWN0ZWQgPSBub3JtYWxpemVUZXh0KGV4cGVjdGVkKTtcbiAgICBjb25zdCBub3JtYWxpemVkQWN0dWFsID0gbm9ybWFsaXplVGV4dChhY3R1YWwpO1xuICAgIFxuICAgIC8vIElmIHRoZXkncmUgZXhhY3RseSB0aGUgc2FtZSBhZnRlciBub3JtYWxpemF0aW9uLCBpdCdzIDEwMCVcbiAgICBpZiAobm9ybWFsaXplZEV4cGVjdGVkID09PSBub3JtYWxpemVkQWN0dWFsKSB7XG4gICAgICByZXR1cm4gMTAwO1xuICAgIH1cbiAgICBcbiAgICAvLyBPdGhlcndpc2UsIGRvIHdvcmQtYnktd29yZCBjb21wYXJpc29uXG4gICAgY29uc3QgZXhwZWN0ZWRXb3JkcyA9IG5vcm1hbGl6ZWRFeHBlY3RlZC5zcGxpdCgvXFxzKy8pO1xuICAgIGNvbnN0IGFjdHVhbFdvcmRzID0gbm9ybWFsaXplZEFjdHVhbC5zcGxpdCgvXFxzKy8pO1xuICAgIGxldCBtYXRjaGVzID0gMDtcbiAgICBcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cGVjdGVkV29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhY3R1YWxXb3Jkc1tpXSA9PT0gZXhwZWN0ZWRXb3Jkc1tpXSkge1xuICAgICAgICBtYXRjaGVzKys7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBNYXRoLnJvdW5kKChtYXRjaGVzIC8gZXhwZWN0ZWRXb3Jkcy5sZW5ndGgpICogMTAwKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVBdXRvU3VibWl0ID0gYXN5bmMgKHNjb3JlOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBjdXJyZW50RXhlcmNpc2UgPSBleGVyY2lzZXMoKT8uW2N1cnJlbnRFeGVyY2lzZUluZGV4KCldO1xuICAgIGNvbnN0IGNodW5rcyA9IGF1ZGlvQ2h1bmtzKCk7XG4gICAgY29uc3QgYmxvYiA9IGNodW5rcy5sZW5ndGggPiAwID8gbmV3IEJsb2IoY2h1bmtzLCB7IHR5cGU6ICdhdWRpby93ZWJtJyB9KSA6IG51bGw7XG4gICAgXG4gICAgLy8gRGV0ZXJtaW5lIGlmIGNvcnJlY3QgKDEwMCUgYWZ0ZXIgbm9ybWFsaXphdGlvbilcbiAgICBzZXRJc0NvcnJlY3Qoc2NvcmUgPT09IDEwMCk7XG4gICAgc2V0U2hvd0ZlZWRiYWNrKHRydWUpO1xuICAgIFxuICAgIC8vIFBsYXkgYXBwcm9wcmlhdGUgc291bmRcbiAgICBzb3VuZE1hbmFnZXIucGxheShzY29yZSA9PT0gMTAwID8gJ2NvcnJlY3QnIDogJ2luY29ycmVjdCcpO1xuICAgIFxuICAgIGlmIChjdXJyZW50RXhlcmNpc2UgJiYgY3VycmVudEV4ZXJjaXNlLmNhcmRfaWRzLmxlbmd0aCA+IDAgJiYgYmxvYikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gQ29udmVydCBhdWRpbyB0byBiYXNlNjRcbiAgICAgICAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgICAgY29uc3QgYmFzZTY0ID0gYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBiYXNlNjRTdHJpbmcgPSByZWFkZXIucmVzdWx0IGFzIHN0cmluZztcbiAgICAgICAgICAgIHJlc29sdmUoYmFzZTY0U3RyaW5nLnNwbGl0KCcsJylbMV0pO1xuICAgICAgICAgIH07XG4gICAgICAgICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoYmxvYik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGhlYWRlcnM6IEhlYWRlcnNJbml0ID0geyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH07XG4gICAgICAgIGlmIChwcm9wcy5hdXRoVG9rZW4pIHtcbiAgICAgICAgICBoZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSBgQmVhcmVyICR7cHJvcHMuYXV0aFRva2VufWA7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTdWJtaXQgcmV2aWV3XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7YXBpQmFzZVVybCgpfS9hcGkvcHJhY3RpY2UvcmV2aWV3YCwge1xuICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgIGhlYWRlcnMsXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgZXhlcmNpc2VJZDogY3VycmVudEV4ZXJjaXNlLmlkLFxuICAgICAgICAgICAgYXVkaW9CYXNlNjQ6IGJhc2U2NCxcbiAgICAgICAgICAgIGNhcmRTY29yZXM6IGN1cnJlbnRFeGVyY2lzZS5jYXJkX2lkcy5tYXAoY2FyZElkID0+ICh7XG4gICAgICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgICAgICAgc2NvcmVcbiAgICAgICAgICAgIH0pKVxuICAgICAgICAgIH0pXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbUHJhY3RpY2VFeGVyY2lzZVZpZXddIEZhaWxlZCB0byBzdWJtaXQgcmV2aWV3OicsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBoYW5kbGVTdWJtaXQgPSBhc3luYyAoKSA9PiB7XG4gICAgLy8gVGhpcyBpcyBub3cgb25seSB1c2VkIGFzIGZhbGxiYWNrIGlmIG5lZWRlZFxuICAgIGNvbnN0IHNjb3JlID0gY3VycmVudFNjb3JlKCk7XG4gICAgaWYgKHNjb3JlICE9PSBudWxsKSB7XG4gICAgICBhd2FpdCBoYW5kbGVBdXRvU3VibWl0KHNjb3JlKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBoYW5kbGVDb250aW51ZSA9ICgpID0+IHtcbiAgICAvLyBNb3ZlIHRvIG5leHQgZXhlcmNpc2VcbiAgICBpZiAoY3VycmVudEV4ZXJjaXNlSW5kZXgoKSA8IChleGVyY2lzZXMoKT8ubGVuZ3RoIHx8IDApIC0gMSkge1xuICAgICAgc2V0Q3VycmVudEV4ZXJjaXNlSW5kZXgoY3VycmVudEV4ZXJjaXNlSW5kZXgoKSArIDEpO1xuICAgICAgc2V0VXNlclRyYW5zY3JpcHQoJycpO1xuICAgICAgc2V0Q3VycmVudFNjb3JlKG51bGwpO1xuICAgICAgc2V0QXVkaW9DaHVua3MoW10pO1xuICAgICAgc2V0U2hvd0ZlZWRiYWNrKGZhbHNlKTtcbiAgICAgIHNldElzQ29ycmVjdChmYWxzZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEFsbCBleGVyY2lzZXMgY29tcGxldGVkXG4gICAgICBwcm9wcy5vbkJhY2soKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlU2tpcCA9ICgpID0+IHtcbiAgICBcbiAgICAvLyBNb3ZlIHRvIG5leHQgZXhlcmNpc2VcbiAgICBpZiAoY3VycmVudEV4ZXJjaXNlSW5kZXgoKSA8IChleGVyY2lzZXMoKT8ubGVuZ3RoIHx8IDApIC0gMSkge1xuICAgICAgc2V0Q3VycmVudEV4ZXJjaXNlSW5kZXgoY3VycmVudEV4ZXJjaXNlSW5kZXgoKSArIDEpO1xuICAgICAgc2V0VXNlclRyYW5zY3JpcHQoJycpO1xuICAgICAgc2V0Q3VycmVudFNjb3JlKG51bGwpO1xuICAgICAgc2V0QXVkaW9DaHVua3MoW10pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBBbGwgZXhlcmNpc2VzIGNvbXBsZXRlZFxuICAgICAgcHJvcHMub25CYWNrKCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGN1cnJlbnRFeGVyY2lzZSA9ICgpID0+IGV4ZXJjaXNlcygpPy5bY3VycmVudEV4ZXJjaXNlSW5kZXgoKV07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPVwiaC1mdWxsIGJnLWJhc2UgZmxleCBmbGV4LWNvbFwiPlxuICAgICAgPFNob3dcbiAgICAgICAgd2hlbj17IWV4ZXJjaXNlcy5sb2FkaW5nfVxuICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhbmltYXRlLXNwaW4gcm91bmRlZC1mdWxsIGgtMTIgdy0xMiBib3JkZXItYi0yIGJvcmRlci1hY2NlbnQtcHJpbWFyeSBteC1hdXRvIG1iLTRcIj48L2Rpdj5cbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LW11dGVkLWZvcmVncm91bmRcIj5Mb2FkaW5nIGV4ZXJjaXNlcy4uLjwvcD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICB9XG4gICAgICA+XG4gICAgICAgIDxTaG93XG4gICAgICAgICAgd2hlbj17KGV4ZXJjaXNlcygpIHx8IFtdKS5sZW5ndGggPiAwfVxuICAgICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcC04XCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBtYXgtdy1tZFwiPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1sZyB0ZXh0LW11dGVkLWZvcmVncm91bmQgbWItNFwiPk5vIHByYWN0aWNlIGV4ZXJjaXNlcyBhdmFpbGFibGUgeWV0LjwvcD5cbiAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc20gdGV4dC1tdXRlZC1mb3JlZ3JvdW5kXCI+Q29tcGxldGUga2FyYW9rZSBzZXNzaW9ucyB3aXRoIGVycm9ycyB0byBnZW5lcmF0ZSBwZXJzb25hbGl6ZWQgZXhlcmNpc2VzITwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICB9XG4gICAgICAgID5cbiAgICAgICAgICA8U2hvdyB3aGVuPXtjdXJyZW50RXhlcmNpc2UoKX0+XG4gICAgICAgICAgICB7KGV4ZXJjaXNlKSA9PiAoXG4gICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgPFByb2dyZXNzQmFyIFxuICAgICAgICAgICAgICAgICAgY3VycmVudD17Y3VycmVudEV4ZXJjaXNlSW5kZXgoKSArIDF9IFxuICAgICAgICAgICAgICAgICAgdG90YWw9e2V4ZXJjaXNlcygpPy5sZW5ndGggfHwgMH0gXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICA8UHJhY3RpY2VIZWFkZXIgXG4gICAgICAgICAgICAgICAgICB0aXRsZT17cHJvcHMuaGVhZGVyVGl0bGUgfHwgXCJcIn0gXG4gICAgICAgICAgICAgICAgICBvbkV4aXQ9e3Byb3BzLm9uQmFja30gXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICA8bWFpbiBjbGFzcz1cImZsZXgtMVwiPlxuICAgICAgICAgICAgICAgICAgPEV4ZXJjaXNlVGVtcGxhdGUgaW5zdHJ1Y3Rpb25UZXh0PVwiUmVhZCBhbG91ZDpcIj5cbiAgICAgICAgICAgICAgICAgICAgPFJlYWRBbG91ZFxuICAgICAgICAgICAgICAgICAgICAgIHByb21wdD17ZXhlcmNpc2UoKS5mdWxsX2xpbmV9XG4gICAgICAgICAgICAgICAgICAgICAgdXNlclRyYW5zY3JpcHQ9e3VzZXJUcmFuc2NyaXB0KCl9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICA8L0V4ZXJjaXNlVGVtcGxhdGU+XG4gICAgICAgICAgICAgICAgPC9tYWluPlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxTaG93XG4gICAgICAgICAgICAgICAgICB3aGVuPXtzaG93RmVlZGJhY2soKX1cbiAgICAgICAgICAgICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICAgICAgPEV4ZXJjaXNlRm9vdGVyXG4gICAgICAgICAgICAgICAgICAgICAgaXNSZWNvcmRpbmc9e2lzUmVjb3JkaW5nKCl9XG4gICAgICAgICAgICAgICAgICAgICAgaXNQcm9jZXNzaW5nPXtpc1Byb2Nlc3NpbmcoKX1cbiAgICAgICAgICAgICAgICAgICAgICBjYW5TdWJtaXQ9e3VzZXJUcmFuc2NyaXB0KCkudHJpbSgpLmxlbmd0aCA+IDB9XG4gICAgICAgICAgICAgICAgICAgICAgb25SZWNvcmQ9e2hhbmRsZVN0YXJ0UmVjb3JkaW5nfVxuICAgICAgICAgICAgICAgICAgICAgIG9uU3RvcD17aGFuZGxlU3RvcFJlY29yZGluZ31cbiAgICAgICAgICAgICAgICAgICAgICBvblN1Ym1pdD17aGFuZGxlU3VibWl0fVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxSZXNwb25zZUZvb3RlclxuICAgICAgICAgICAgICAgICAgICBtb2RlPVwiZmVlZGJhY2tcIlxuICAgICAgICAgICAgICAgICAgICBpc0NvcnJlY3Q9e2lzQ29ycmVjdCgpfVxuICAgICAgICAgICAgICAgICAgICBvbkNvbnRpbnVlPXtoYW5kbGVDb250aW51ZX1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9TaG93PlxuICAgICAgICA8L1Nob3c+XG4gICAgICA8L1Nob3c+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IE1vZGFsIH0gZnJvbSAnLi4vLi4vY29tbW9uL01vZGFsJztcbmltcG9ydCB7IFN1YnNjcmlwdGlvblBsYW4gfSBmcm9tICcuLi9TdWJzY3JpcHRpb25QbGFuJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9CdXR0b24nO1xuaW1wb3J0IEljb25YRmlsbCBmcm9tICdwaG9zcGhvci1pY29ucy1zb2xpZC9JY29uWEZpbGwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFN1YnNjcmlwdGlvbk1vZGFsUHJvcHMge1xuICBpc09wZW46IGJvb2xlYW47XG4gIGlzQWN0aXZlPzogYm9vbGVhbjtcbiAgaGFzVHJpYWxBdmFpbGFibGU/OiBib29sZWFuO1xuICBpc1Byb2Nlc3Npbmc/OiBib29sZWFuO1xuICBpc0Nvbm5lY3RlZD86IGJvb2xlYW47XG4gIHdhbGxldEFkZHJlc3M/OiBzdHJpbmc7XG4gIG9uQ2xvc2U6ICgpID0+IHZvaWQ7XG4gIG9uU3Vic2NyaWJlOiAoKSA9PiB2b2lkO1xuICBvbk1hbmFnZT86ICgpID0+IHZvaWQ7XG4gIG9uQ29ubmVjdFdhbGxldD86ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBTdWJzY3JpcHRpb25Nb2RhbDogQ29tcG9uZW50PFN1YnNjcmlwdGlvbk1vZGFsUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPE1vZGFsIGlzT3Blbj17cHJvcHMuaXNPcGVufSBvbkNsb3NlPXtwcm9wcy5vbkNsb3NlfT5cbiAgICAgIDxkaXYgY2xhc3M9XCJyZWxhdGl2ZSBiZy1lbGV2YXRlZCByb3VuZGVkLXhsIHAtNiBtYXgtdy1tZCB3LWZ1bGwgbXgtNFwiPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgb25DbGljaz17cHJvcHMub25DbG9zZX1cbiAgICAgICAgICBjbGFzcz1cImFic29sdXRlIHRvcC00IHJpZ2h0LTQgcC0yIHJvdW5kZWQtbGcgaG92ZXI6Ymctc3VyZmFjZSB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgICAgYXJpYS1sYWJlbD1cIkNsb3NlXCJcbiAgICAgICAgPlxuICAgICAgICAgIDxJY29uWEZpbGwgY2xhc3M9XCJ3LTUgaC01IHRleHQtc2Vjb25kYXJ5XCIgLz5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICAgIFxuICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS02XCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTJ4bCBmb250LWJvbGQgdGV4dC1wcmltYXJ5IG1iLTJcIj5cbiAgICAgICAgICAgICAge3Byb3BzLmlzQWN0aXZlID8gJ0FjdGl2ZScgOiAnVW5saW1pdGVkIEthcmFva2UnfVxuICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmlzQWN0aXZlfT5cbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNlY29uZGFyeSB0ZXh0LXNtXCI+XG4gICAgICAgICAgICAgICAgTWFuYWdlIHN1YnNjcmlwdGlvblxuICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgXG4gICAgICAgICAgPFN1YnNjcmlwdGlvblBsYW5cbiAgICAgICAgICAgIGlzQWN0aXZlPXtwcm9wcy5pc0FjdGl2ZX1cbiAgICAgICAgICAgIGhhc1RyaWFsQXZhaWxhYmxlPXtwcm9wcy5oYXNUcmlhbEF2YWlsYWJsZX1cbiAgICAgICAgICAgIGlzQ29ubmVjdGVkPXtwcm9wcy5pc0Nvbm5lY3RlZH1cbiAgICAgICAgICAgIHdhbGxldEFkZHJlc3M9e3Byb3BzLndhbGxldEFkZHJlc3N9XG4gICAgICAgICAgICBvblN1YnNjcmliZT17cHJvcHMub25TdWJzY3JpYmV9XG4gICAgICAgICAgICBvbk1hbmFnZT17cHJvcHMub25NYW5hZ2V9XG4gICAgICAgICAgICBvbkNvbm5lY3RXYWxsZXQ9e3Byb3BzLm9uQ29ubmVjdFdhbGxldH1cbiAgICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5pc1Byb2Nlc3Npbmd9XG4gICAgICAgICAgLz5cbiAgICAgICAgICBcbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L01vZGFsPlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IFNob3csIGNyZWF0ZUVmZmVjdCwgb25DbGVhbnVwIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgUG9ydGFsIH0gZnJvbSAnc29saWQtanMvd2ViJztcbmltcG9ydCB7IFRyYW5zaXRpb24gfSBmcm9tICdzb2xpZC10cmFuc2l0aW9uLWdyb3VwJztcbmltcG9ydCB7IFN1YnNjcmlwdGlvblBsYW4gfSBmcm9tICcuLi9TdWJzY3JpcHRpb25QbGFuJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9CdXR0b24nO1xuaW1wb3J0IEljb25YRmlsbCBmcm9tICdwaG9zcGhvci1pY29ucy1zb2xpZC9JY29uWEZpbGwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFN1YnNjcmlwdGlvblNsaWRlclByb3BzIHtcbiAgaXNPcGVuOiBib29sZWFuO1xuICBpc0FjdGl2ZT86IGJvb2xlYW47XG4gIGhhc1RyaWFsQXZhaWxhYmxlPzogYm9vbGVhbjtcbiAgaXNQcm9jZXNzaW5nPzogYm9vbGVhbjtcbiAgaXNDb25uZWN0ZWQ/OiBib29sZWFuO1xuICB3YWxsZXRBZGRyZXNzPzogc3RyaW5nO1xuICBvbkNsb3NlOiAoKSA9PiB2b2lkO1xuICBvblN1YnNjcmliZTogKCkgPT4gdm9pZDtcbiAgb25NYW5hZ2U/OiAoKSA9PiB2b2lkO1xuICBvbkNvbm5lY3RXYWxsZXQ/OiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgU3Vic2NyaXB0aW9uU2xpZGVyOiBDb21wb25lbnQ8U3Vic2NyaXB0aW9uU2xpZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIC8vIExvY2sgYm9keSBzY3JvbGwgd2hlbiBzbGlkZXIgaXMgb3BlblxuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChwcm9wcy5pc09wZW4pIHtcbiAgICAgIGNvbnN0IG9yaWdpbmFsT3ZlcmZsb3cgPSBkb2N1bWVudC5ib2R5LnN0eWxlLm92ZXJmbG93O1xuICAgICAgZG9jdW1lbnQuYm9keS5zdHlsZS5vdmVyZmxvdyA9ICdoaWRkZW4nO1xuICAgICAgb25DbGVhbnVwKCgpID0+IHtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5zdHlsZS5vdmVyZmxvdyA9IG9yaWdpbmFsT3ZlcmZsb3c7XG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEhhbmRsZSBlc2NhcGUga2V5XG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHByb3BzLmlzT3Blbikge1xuICAgICAgY29uc3QgaGFuZGxlRXNjYXBlID0gKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcbiAgICAgICAgaWYgKGUua2V5ID09PSAnRXNjYXBlJykge1xuICAgICAgICAgIHByb3BzLm9uQ2xvc2UoKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBoYW5kbGVFc2NhcGUpO1xuICAgICAgb25DbGVhbnVwKCgpID0+IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBoYW5kbGVFc2NhcGUpKTtcbiAgICB9XG4gIH0pO1xuXG4gIGNvbnN0IGhhbmRsZUJhY2tkcm9wQ2xpY2sgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgIGlmIChlLnRhcmdldCA9PT0gZS5jdXJyZW50VGFyZ2V0KSB7XG4gICAgICBwcm9wcy5vbkNsb3NlKCk7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPFBvcnRhbD5cbiAgICAgIDxUcmFuc2l0aW9uXG4gICAgICAgIGVudGVyQWN0aXZlQ2xhc3M9XCJ0cmFuc2l0aW9uLW9wYWNpdHkgZHVyYXRpb24tMzAwXCJcbiAgICAgICAgZW50ZXJDbGFzcz1cIm9wYWNpdHktMFwiXG4gICAgICAgIGVudGVyVG9DbGFzcz1cIm9wYWNpdHktMTAwXCJcbiAgICAgICAgZXhpdEFjdGl2ZUNsYXNzPVwidHJhbnNpdGlvbi1vcGFjaXR5IGR1cmF0aW9uLTMwMFwiXG4gICAgICAgIGV4aXRDbGFzcz1cIm9wYWNpdHktMTAwXCJcbiAgICAgICAgZXhpdFRvQ2xhc3M9XCJvcGFjaXR5LTBcIlxuICAgICAgPlxuICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5pc09wZW59PlxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIGNsYXNzPVwiZml4ZWQgaW5zZXQtMCB6LTUwIGJnLWJsYWNrLzYwIGJhY2tkcm9wLWJsdXItc21cIlxuICAgICAgICAgICAgb25DbGljaz17aGFuZGxlQmFja2Ryb3BDbGlja31cbiAgICAgICAgICAvPlxuICAgICAgICA8L1Nob3c+XG4gICAgICA8L1RyYW5zaXRpb24+XG5cbiAgICAgIDxUcmFuc2l0aW9uXG4gICAgICAgIGVudGVyQWN0aXZlQ2xhc3M9XCJ0cmFuc2l0aW9uLXRyYW5zZm9ybSBkdXJhdGlvbi0zMDAgZWFzZS1vdXRcIlxuICAgICAgICBlbnRlckNsYXNzPVwidHJhbnNsYXRlLXktZnVsbFwiXG4gICAgICAgIGVudGVyVG9DbGFzcz1cInRyYW5zbGF0ZS15LTBcIlxuICAgICAgICBleGl0QWN0aXZlQ2xhc3M9XCJ0cmFuc2l0aW9uLXRyYW5zZm9ybSBkdXJhdGlvbi0zMDAgZWFzZS1pblwiXG4gICAgICAgIGV4aXRDbGFzcz1cInRyYW5zbGF0ZS15LTBcIlxuICAgICAgICBleGl0VG9DbGFzcz1cInRyYW5zbGF0ZS15LWZ1bGxcIlxuICAgICAgPlxuICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5pc09wZW59PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmaXhlZCBpbnNldC14LTAgYm90dG9tLTAgei01MFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJnLWVsZXZhdGVkIHJvdW5kZWQtdC0zeGwgc2hhZG93LTJ4bCBtYXgtaC1bOTB2aF0gb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICAgIHsvKiBIYW5kbGUgYmFyICovfVxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBqdXN0aWZ5LWNlbnRlciBwdC0zIHBiLTJcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidy0xMiBoLTEgYmctc3VyZmFjZSByb3VuZGVkLWZ1bGxcIiAvPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIHsvKiBDbG9zZSBidXR0b24gKi99XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhYnNvbHV0ZSB0b3AtNCByaWdodC00XCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25DbG9zZX1cbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwicC0yIHJvdW5kZWQtbGcgYmctc3VyZmFjZS81MCBob3ZlcjpiZy1zdXJmYWNlIHRyYW5zaXRpb24tYWxsIGhvdmVyOnNjYWxlLTExMFwiXG4gICAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiQ2xvc2VcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxJY29uWEZpbGwgY2xhc3M9XCJ3LTUgaC01IHRleHQtc2Vjb25kYXJ5IGhvdmVyOnRleHQtcHJpbWFyeVwiIC8+XG4gICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB4LTYgcGItOCBzcGFjZS15LTYgb3ZlcmZsb3cteS1hdXRvIG1heC1oLVs4MHZoXVwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC0yeGwgZm9udC1ib2xkIHRleHQtcHJpbWFyeSBtYi0yXCI+XG4gICAgICAgICAgICAgICAgICAgIHtwcm9wcy5pc0FjdGl2ZSA/ICdBY3RpdmUnIDogJ1VubGltaXRlZCBLYXJhb2tlJ31cbiAgICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5pc0FjdGl2ZX0+XG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zZWNvbmRhcnkgdGV4dC1zbVwiPlxuICAgICAgICAgICAgICAgICAgICAgIE1hbmFnZSBzdWJzY3JpcHRpb25cbiAgICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxTdWJzY3JpcHRpb25QbGFuXG4gICAgICAgICAgICAgICAgICBpc0FjdGl2ZT17cHJvcHMuaXNBY3RpdmV9XG4gICAgICAgICAgICAgICAgICBoYXNUcmlhbEF2YWlsYWJsZT17cHJvcHMuaGFzVHJpYWxBdmFpbGFibGV9XG4gICAgICAgICAgICAgICAgICBpc0Nvbm5lY3RlZD17cHJvcHMuaXNDb25uZWN0ZWR9XG4gICAgICAgICAgICAgICAgICB3YWxsZXRBZGRyZXNzPXtwcm9wcy53YWxsZXRBZGRyZXNzfVxuICAgICAgICAgICAgICAgICAgb25TdWJzY3JpYmU9e3Byb3BzLm9uU3Vic2NyaWJlfVxuICAgICAgICAgICAgICAgICAgb25NYW5hZ2U9e3Byb3BzLm9uTWFuYWdlfVxuICAgICAgICAgICAgICAgICAgb25Db25uZWN0V2FsbGV0PXtwcm9wcy5vbkNvbm5lY3RXYWxsZXR9XG4gICAgICAgICAgICAgICAgICBkaXNhYmxlZD17cHJvcHMuaXNQcm9jZXNzaW5nfVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvU2hvdz5cbiAgICAgIDwvVHJhbnNpdGlvbj5cbiAgICA8L1BvcnRhbD5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBTaG93LCBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB7IFVzZXJQcm9maWxlIH0gZnJvbSAnLi4vVXNlclByb2ZpbGUnO1xuaW1wb3J0IHsgQ3JlZGl0UGFjayB9IGZyb20gJy4uL0NyZWRpdFBhY2snO1xuaW1wb3J0IHsgV2FsbGV0Q29ubmVjdCB9IGZyb20gJy4uL1dhbGxldENvbm5lY3QnO1xuaW1wb3J0IHsgRmFyY2FzdGVyS2FyYW9rZVZpZXcgfSBmcm9tICcuLi8uLi9rYXJhb2tlL0ZhcmNhc3RlckthcmFva2VWaWV3JztcbmltcG9ydCB0eXBlIHsgTHlyaWNMaW5lIH0gZnJvbSAnLi4vLi4va2FyYW9rZS9MeXJpY3NEaXNwbGF5JztcbmltcG9ydCB0eXBlIHsgTGVhZGVyYm9hcmRFbnRyeSB9IGZyb20gJy4uLy4uL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmFyY2FzdGVyTWluaUFwcFByb3BzIHtcbiAgLy8gVXNlciBpbmZvXG4gIHVzZXI/OiB7XG4gICAgZmlkPzogbnVtYmVyO1xuICAgIHVzZXJuYW1lPzogc3RyaW5nO1xuICAgIGRpc3BsYXlOYW1lPzogc3RyaW5nO1xuICAgIHBmcFVybD86IHN0cmluZztcbiAgfTtcbiAgXG4gIC8vIFdhbGxldFxuICB3YWxsZXRBZGRyZXNzPzogc3RyaW5nO1xuICB3YWxsZXRDaGFpbj86ICdCYXNlJyB8ICdTb2xhbmEnO1xuICBpc1dhbGxldENvbm5lY3RlZD86IGJvb2xlYW47XG4gIFxuICAvLyBDcmVkaXRzXG4gIHVzZXJDcmVkaXRzPzogbnVtYmVyO1xuICBcbiAgLy8gQ2FsbGJhY2tzXG4gIG9uQ29ubmVjdFdhbGxldD86ICgpID0+IHZvaWQ7XG4gIG9uRGlzY29ubmVjdFdhbGxldD86ICgpID0+IHZvaWQ7XG4gIG9uUHVyY2hhc2VDcmVkaXRzPzogKHBhY2s6IHsgY3JlZGl0czogbnVtYmVyOyBwcmljZTogc3RyaW5nOyBjdXJyZW5jeTogc3RyaW5nIH0pID0+IHZvaWQ7XG4gIG9uU2VsZWN0U29uZz86ICgpID0+IHZvaWQ7XG4gIFxuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEZhcmNhc3Rlck1pbmlBcHA6IENvbXBvbmVudDxGYXJjYXN0ZXJNaW5pQXBwUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtzaG93S2FyYW9rZSwgc2V0U2hvd0thcmFva2VdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgXG4gIC8vIE1vY2sgZGF0YSBmb3IgZGVtb1xuICBjb25zdCBtb2NrTHlyaWNzOiBMeXJpY0xpbmVbXSA9IFtcbiAgICB7IGlkOiAnMScsIHRleHQ6IFwiSXMgdGhpcyB0aGUgcmVhbCBsaWZlP1wiLCBzdGFydFRpbWU6IDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzInLCB0ZXh0OiBcIklzIHRoaXMganVzdCBmYW50YXN5P1wiLCBzdGFydFRpbWU6IDIwMDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzMnLCB0ZXh0OiBcIkNhdWdodCBpbiBhIGxhbmRzbGlkZVwiLCBzdGFydFRpbWU6IDQwMDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzQnLCB0ZXh0OiBcIk5vIGVzY2FwZSBmcm9tIHJlYWxpdHlcIiwgc3RhcnRUaW1lOiA2MDAwLCBkdXJhdGlvbjogMjAwMCB9LFxuICBdO1xuICBcbiAgY29uc3QgbW9ja0xlYWRlcmJvYXJkOiBMZWFkZXJib2FyZEVudHJ5W10gPSBbXG4gICAgeyByYW5rOiAxLCB1c2VybmFtZTogXCJhbGljZVwiLCBzY29yZTogOTgwIH0sXG4gICAgeyByYW5rOiAyLCB1c2VybmFtZTogXCJib2JcIiwgc2NvcmU6IDk0NSB9LFxuICAgIHsgcmFuazogMywgdXNlcm5hbWU6IFwiY2Fyb2xcIiwgc2NvcmU6IDkyMCB9LFxuICBdO1xuXG4gIGNvbnN0IGNyZWRpdFBhY2tzID0gW1xuICAgIHsgY3JlZGl0czogMjUwLCBwcmljZTogJzIuNTAnLCBjdXJyZW5jeTogJ1VTREMnIGFzIGNvbnN0IH0sXG4gICAgeyBjcmVkaXRzOiA1MDAsIHByaWNlOiAnNC43NScsIGN1cnJlbmN5OiAnVVNEQycgYXMgY29uc3QsIGRpc2NvdW50OiA1LCByZWNvbW1lbmRlZDogdHJ1ZSB9LFxuICAgIHsgY3JlZGl0czogMTIwMCwgcHJpY2U6ICcxMC4wMCcsIGN1cnJlbmN5OiAnVVNEQycgYXMgY29uc3QsIGRpc2NvdW50OiAxNiB9LFxuICBdO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgaC1zY3JlZW4gYmctYmFzZScsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogSGVhZGVyIHdpdGggdXNlciBwcm9maWxlICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2UgYm9yZGVyLWIgYm9yZGVyLXN1YnRsZVwiPlxuICAgICAgICA8VXNlclByb2ZpbGVcbiAgICAgICAgICBmaWQ9e3Byb3BzLnVzZXI/LmZpZH1cbiAgICAgICAgICB1c2VybmFtZT17cHJvcHMudXNlcj8udXNlcm5hbWV9XG4gICAgICAgICAgZGlzcGxheU5hbWU9e3Byb3BzLnVzZXI/LmRpc3BsYXlOYW1lfVxuICAgICAgICAgIHBmcFVybD17cHJvcHMudXNlcj8ucGZwVXJsfVxuICAgICAgICAgIGNyZWRpdHM9e3Byb3BzLnVzZXJDcmVkaXRzIHx8IDB9XG4gICAgICAgIC8+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgey8qIE1haW4gY29udGVudCAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgb3ZlcmZsb3ctYXV0b1wiPlxuICAgICAgICA8U2hvd1xuICAgICAgICAgIHdoZW49e3Nob3dLYXJhb2tlKCl9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInAtNCBzcGFjZS15LTZcIj5cbiAgICAgICAgICAgICAgey8qIEhlcm8gc2VjdGlvbiAqL31cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIHB5LThcIj5cbiAgICAgICAgICAgICAgICA8aDEgY2xhc3M9XCJ0ZXh0LTN4bCBmb250LWJvbGQgbWItMlwiPlNjYXJsZXR0IEthcmFva2U8L2gxPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zZWNvbmRhcnlcIj5cbiAgICAgICAgICAgICAgICAgIFNpbmcgeW91ciBmYXZvcml0ZSBzb25ncyBhbmQgY29tcGV0ZSB3aXRoIGZyaWVuZHMhXG4gICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIHsvKiBDcmVkaXRzIGNoZWNrICovfVxuICAgICAgICAgICAgICA8U2hvd1xuICAgICAgICAgICAgICAgIHdoZW49e3Byb3BzLnVzZXJDcmVkaXRzICYmIHByb3BzLnVzZXJDcmVkaXRzID4gMH1cbiAgICAgICAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS02XCI+XG4gICAgICAgICAgICAgICAgICAgIHsvKiBXYWxsZXQgY29ubmVjdGlvbiAqL31cbiAgICAgICAgICAgICAgICAgICAgPFdhbGxldENvbm5lY3RcbiAgICAgICAgICAgICAgICAgICAgICBhZGRyZXNzPXtwcm9wcy53YWxsZXRBZGRyZXNzfVxuICAgICAgICAgICAgICAgICAgICAgIGNoYWluPXtwcm9wcy53YWxsZXRDaGFpbn1cbiAgICAgICAgICAgICAgICAgICAgICBpc0Nvbm5lY3RlZD17cHJvcHMuaXNXYWxsZXRDb25uZWN0ZWR9XG4gICAgICAgICAgICAgICAgICAgICAgb25Db25uZWN0PXtwcm9wcy5vbkNvbm5lY3RXYWxsZXR9XG4gICAgICAgICAgICAgICAgICAgICAgb25EaXNjb25uZWN0PXtwcm9wcy5vbkRpc2Nvbm5lY3RXYWxsZXR9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB7LyogQ3JlZGl0IHBhY2tzICovfVxuICAgICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5pc1dhbGxldENvbm5lY3RlZH0+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQteGwgZm9udC1zZW1pYm9sZCBtYi00XCI+UHVyY2hhc2UgQ3JlZGl0czwvaDI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtMyBnYXAtNFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7Y3JlZGl0UGFja3MubWFwKChwYWNrKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPENyZWRpdFBhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsuLi5wYWNrfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25QdXJjaGFzZT17KCkgPT4gcHJvcHMub25QdXJjaGFzZUNyZWRpdHM/LihwYWNrKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICB7LyogU29uZyBzZWxlY3Rpb24gKi99XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNFwiPlxuICAgICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC14bCBmb250LXNlbWlib2xkXCI+U2VsZWN0IGEgU29uZzwvaDI+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uIFxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBwLTQgYmctc3VyZmFjZSByb3VuZGVkLWxnIGJvcmRlciBib3JkZXItc3VidGxlIGhvdmVyOmJvcmRlci1hY2NlbnQtcHJpbWFyeSB0cmFuc2l0aW9uLWNvbG9ycyB0ZXh0LWxlZnRcIlxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93S2FyYW9rZSh0cnVlKX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZvbnQtc2VtaWJvbGRcIj5Cb2hlbWlhbiBSaGFwc29keTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeVwiPlF1ZWVuPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXhzIHRleHQtdGVydGlhcnkgbXQtMVwiPkNvc3Q6IDUwIGNyZWRpdHM8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICB9XG4gICAgICAgID5cbiAgICAgICAgICA8RmFyY2FzdGVyS2FyYW9rZVZpZXdcbiAgICAgICAgICAgIHNvbmdUaXRsZT1cIkJvaGVtaWFuIFJoYXBzb2R5XCJcbiAgICAgICAgICAgIGFydGlzdD1cIlF1ZWVuXCJcbiAgICAgICAgICAgIHNjb3JlPXtudWxsfVxuICAgICAgICAgICAgcmFuaz17bnVsbH1cbiAgICAgICAgICAgIGx5cmljcz17bW9ja0x5cmljc31cbiAgICAgICAgICAgIGN1cnJlbnRUaW1lPXswfVxuICAgICAgICAgICAgbGVhZGVyYm9hcmQ9e21vY2tMZWFkZXJib2FyZH1cbiAgICAgICAgICAgIGlzUGxheWluZz17ZmFsc2V9XG4gICAgICAgICAgICBvblN0YXJ0PXsoKSA9PiBjb25zb2xlLmxvZygnU3RhcnQga2FyYW9rZScpfVxuICAgICAgICAgICAgb25TcGVlZENoYW5nZT17KHNwZWVkKSA9PiBjb25zb2xlLmxvZygnU3BlZWQ6Jywgc3BlZWQpfVxuICAgICAgICAgICAgb25CYWNrPXsoKSA9PiBzZXRTaG93S2FyYW9rZShmYWxzZSl9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9TaG93PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3csIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgSlNYIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL0J1dHRvbic7XG5pbXBvcnQgSWNvblVzZXJGaWxsIGZyb20gJ3Bob3NwaG9yLWljb25zLXNvbGlkL0ljb25Vc2VyRmlsbCc7XG5pbXBvcnQgSWNvbkNhcmV0RG93bkZpbGwgZnJvbSAncGhvc3Bob3ItaWNvbnMtc29saWQvSWNvbkNhcmV0RG93bkZpbGwnO1xuaW1wb3J0IEljb25TaWduT3V0RmlsbCBmcm9tICdwaG9zcGhvci1pY29ucy1zb2xpZC9JY29uU2lnbk91dEZpbGwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEF1dGhCdXR0b25Qcm9wcyB7XG4gIHVzZXI/OiB7XG4gICAgdXNlcm5hbWU/OiBzdHJpbmc7XG4gICAgYWRkcmVzcz86IHN0cmluZztcbiAgICBhdmF0YXJVcmw/OiBzdHJpbmc7XG4gICAgY3JlZGl0cz86IG51bWJlcjtcbiAgfTtcbiAgaXNMb2FkaW5nPzogYm9vbGVhbjtcbiAgb25TaWduSW5DbGljaz86ICgpID0+IHZvaWQ7XG4gIG9uU2lnbk91dENsaWNrPzogKCkgPT4gdm9pZDtcbiAgdmFyaWFudD86ICdwcmltYXJ5JyB8ICdzZWNvbmRhcnknIHwgJ2dob3N0JztcbiAgc2l6ZT86ICdzbScgfCAnbWQnIHwgJ2xnJztcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBBdXRoQnV0dG9uKHByb3BzOiBBdXRoQnV0dG9uUHJvcHMpIHtcbiAgY29uc3QgW3Nob3dEcm9wZG93biwgc2V0U2hvd0Ryb3Bkb3duXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG5cbiAgY29uc3QgZm9ybWF0QWRkcmVzcyA9IChhZGRyZXNzOiBzdHJpbmcpID0+IHtcbiAgICByZXR1cm4gYCR7YWRkcmVzcy5zbGljZSgwLCA2KX0uLi4ke2FkZHJlc3Muc2xpY2UoLTQpfWA7XG4gIH07XG5cbiAgY29uc3QgZGlzcGxheU5hbWUgPSAoKSA9PiB7XG4gICAgY29uc3QgdXNlciA9IHByb3BzLnVzZXI7XG4gICAgaWYgKCF1c2VyKSByZXR1cm4gJyc7XG4gICAgXG4gICAgaWYgKHVzZXIudXNlcm5hbWUpIHtcbiAgICAgIHJldHVybiBgQCR7dXNlci51c2VybmFtZX1gO1xuICAgIH0gZWxzZSBpZiAodXNlci5hZGRyZXNzKSB7XG4gICAgICByZXR1cm4gZm9ybWF0QWRkcmVzcyh1c2VyLmFkZHJlc3MpO1xuICAgIH1cbiAgICByZXR1cm4gJ1VzZXInO1xuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz1cInJlbGF0aXZlXCI+XG4gICAgICA8U2hvd1xuICAgICAgICB3aGVuPXtwcm9wcy51c2VyfVxuICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgdmFyaWFudD17cHJvcHMudmFyaWFudCB8fCAncHJpbWFyeSd9XG4gICAgICAgICAgICBzaXplPXtwcm9wcy5zaXplIHx8ICdtZCd9XG4gICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblNpZ25JbkNsaWNrfVxuICAgICAgICAgICAgbG9hZGluZz17cHJvcHMuaXNMb2FkaW5nfVxuICAgICAgICAgICAgbGVmdEljb249ezxJY29uVXNlckZpbGwgLz59XG4gICAgICAgICAgICBjbGFzcz17cHJvcHMuY2xhc3N9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgU2lnbiBJblxuICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICB9XG4gICAgICA+XG4gICAgICAgIDxidXR0b25cbiAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93RHJvcGRvd24oIXNob3dEcm9wZG93bigpKX1cbiAgICAgICAgICBjbGFzcz17YFxuICAgICAgICAgICAgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgcHgtNCBweS0yIHJvdW5kZWQtbGdcbiAgICAgICAgICAgIGJnLWVsZXZhdGVkIGJvcmRlciBib3JkZXItc3VidGxlXG4gICAgICAgICAgICBob3ZlcjpiZy1oaWdobGlnaHQgaG92ZXI6Ym9yZGVyLWRlZmF1bHRcbiAgICAgICAgICAgIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMFxuICAgICAgICAgICAgJHtwcm9wcy5jbGFzcyB8fCAnJ31cbiAgICAgICAgICBgfVxuICAgICAgICA+XG4gICAgICAgICAgPFNob3dcbiAgICAgICAgICAgIHdoZW49e3Byb3BzLnVzZXI/LmF2YXRhclVybH1cbiAgICAgICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInctOCBoLTggcm91bmRlZC1mdWxsIGJnLXN1cmZhY2UgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICA8SWNvblVzZXJGaWxsIGNsYXNzPVwidy01IGgtNSB0ZXh0LXNlY29uZGFyeVwiIC8+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxpbWdcbiAgICAgICAgICAgICAgc3JjPXtwcm9wcy51c2VyIS5hdmF0YXJVcmx9XG4gICAgICAgICAgICAgIGFsdD17ZGlzcGxheU5hbWUoKX1cbiAgICAgICAgICAgICAgY2xhc3M9XCJ3LTggaC04IHJvdW5kZWQtZnVsbCBvYmplY3QtY292ZXJcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgXG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtcHJpbWFyeVwiPlxuICAgICAgICAgICAge2Rpc3BsYXlOYW1lKCl9XG4gICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgIFxuICAgICAgICAgIDxJY29uQ2FyZXREb3duRmlsbFxuICAgICAgICAgICAgY2xhc3M9e2B3LTQgaC00IHRleHQtc2Vjb25kYXJ5IHRyYW5zaXRpb24tdHJhbnNmb3JtIGR1cmF0aW9uLTIwMCAke1xuICAgICAgICAgICAgICBzaG93RHJvcGRvd24oKSA/ICdyb3RhdGUtMTgwJyA6ICcnXG4gICAgICAgICAgICB9YH1cbiAgICAgICAgICAvPlxuICAgICAgICA8L2J1dHRvbj5cblxuICAgICAgICA8U2hvdyB3aGVuPXtzaG93RHJvcGRvd24oKX0+XG4gICAgICAgICAgPGRpdlxuICAgICAgICAgICAgY2xhc3M9XCJhYnNvbHV0ZSByaWdodC0wIG10LTIgdy01NiByb3VuZGVkLWxnIGJnLWVsZXZhdGVkIGJvcmRlciBib3JkZXItc3VidGxlIHNoYWRvdy1sZyBvdmVyZmxvdy1oaWRkZW4gei01MFwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicC0yXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB4LTMgcHktMlwiPlxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtcHJpbWFyeVwiPlxuICAgICAgICAgICAgICAgICAgICB7ZGlzcGxheU5hbWUoKX1cbiAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaC1weCBiZy1zdWJ0bGUgbXktMlwiIC8+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25TaWduT3V0Q2xpY2t9XG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBweC0zIHB5LTIgdGV4dC1zbSB0ZXh0LXByaW1hcnkgaG92ZXI6YmctaGlnaGxpZ2h0IHJvdW5kZWQtbWQgdHJhbnNpdGlvbi1jb2xvcnMgZHVyYXRpb24tMjAwXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8SWNvblNpZ25PdXRGaWxsIGNsYXNzPVwidy00IGgtNFwiIC8+XG4gICAgICAgICAgICAgICAgICBTaWduIE91dFxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKTtcbn0iLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IEZvciB9IGZyb20gJ3NvbGlkLWpzJztcblxuZXhwb3J0IGludGVyZmFjZSBTb25nIHtcbiAgaWQ6IHN0cmluZztcbiAgdHJhY2tJZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBhcnRpc3Q6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIb21lUGFnZVByb3BzIHtcbiAgc29uZ3M6IFNvbmdbXTtcbiAgb25Tb25nU2VsZWN0PzogKHNvbmc6IFNvbmcpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBIb21lUGFnZTogQ29tcG9uZW50PEhvbWVQYWdlUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHNvbmdJdGVtU3R5bGUgPSB7XG4gICAgcGFkZGluZzogJzE2cHgnLFxuICAgICdtYXJnaW4tYm90dG9tJzogJzhweCcsXG4gICAgJ2JhY2tncm91bmQtY29sb3InOiAnIzFhMWExYScsXG4gICAgJ2JvcmRlci1yYWRpdXMnOiAnOHB4JyxcbiAgICBjdXJzb3I6ICdwb2ludGVyJ1xuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdj5cbiAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogJzE2cHgnLCAnYmFja2dyb3VuZC1jb2xvcic6ICcjMWExYTFhJyB9fT5cbiAgICAgICAgPGgxIHN0eWxlPXt7IG1hcmdpbjogJzAgMCA4cHggMCcsICdmb250LXNpemUnOiAnMjRweCcgfX0+UG9wdWxhciBTb25nczwvaDE+XG4gICAgICAgIDxwIHN0eWxlPXt7IG1hcmdpbjogJzAnLCBjb2xvcjogJyM4ODgnIH19PkNob29zZSBhIHNvbmcgdG8gc3RhcnQgc2luZ2luZzwvcD5cbiAgICAgIDwvZGl2PlxuICAgICAgXG4gICAgICA8ZGl2IHN0eWxlPXt7IHBhZGRpbmc6ICcxNnB4JyB9fT5cbiAgICAgICAgPEZvciBlYWNoPXtwcm9wcy5zb25nc30+XG4gICAgICAgICAgeyhzb25nLCBpbmRleCkgPT4gKFxuICAgICAgICAgICAgPGRpdiBcbiAgICAgICAgICAgICAgc3R5bGU9e3NvbmdJdGVtU3R5bGV9XG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHByb3BzLm9uU29uZ1NlbGVjdD8uKHNvbmcpfVxuICAgICAgICAgICAgICBvbk1vdXNlRW50ZXI9eyhlKSA9PiBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyMyYTJhMmEnfVxuICAgICAgICAgICAgICBvbk1vdXNlTGVhdmU9eyhlKSA9PiBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyMxYTFhMWEnfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAnMTZweCcgfX0+XG4gICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9e3sgY29sb3I6ICcjNjY2JyB9fT57aW5kZXgoKSArIDF9PC9zcGFuPlxuICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7ICdmb250LXdlaWdodCc6ICdib2xkJyB9fT57c29uZy50aXRsZX08L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgY29sb3I6ICcjODg4JyB9fT57c29uZy5hcnRpc3R9PC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9Gb3I+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsLCBvbkNsZWFudXAgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IEx5cmljTGluZSB9IGZyb20gJy4uL2NvbXBvbmVudHMva2FyYW9rZS9MeXJpY3NEaXNwbGF5JztcbmltcG9ydCB7IGNyZWF0ZUthcmFva2VBdWRpb1Byb2Nlc3NvciB9IGZyb20gJy4uL3NlcnZpY2VzL2F1ZGlvL2thcmFva2VBdWRpb1Byb2Nlc3Nvcic7XG5pbXBvcnQgeyBzaG91bGRDaHVua0xpbmVzLCBjYWxjdWxhdGVSZWNvcmRpbmdEdXJhdGlvbiB9IGZyb20gJy4uL3NlcnZpY2VzL2thcmFva2UvY2h1bmtpbmdVdGlscyc7XG5pbXBvcnQgeyBLYXJhb2tlQXBpU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2thcmFva2Uva2FyYW9rZUFwaSc7XG5pbXBvcnQgdHlwZSB7IENodW5rSW5mbyB9IGZyb20gJ0BzY2FybGV0dC9jb3JlJztcbmltcG9ydCB0eXBlIHsgUGxheWJhY2tTcGVlZCB9IGZyb20gJy4uL2NvbXBvbmVudHMvY29tbW9uL1NwbGl0QnV0dG9uJztcblxuZXhwb3J0IGludGVyZmFjZSBVc2VLYXJhb2tlU2Vzc2lvbk9wdGlvbnMge1xuICBseXJpY3M6IEx5cmljTGluZVtdO1xuICBvbkNvbXBsZXRlPzogKHJlc3VsdHM6IEthcmFva2VSZXN1bHRzKSA9PiB2b2lkO1xuICBhdWRpb0VsZW1lbnQ/OiBIVE1MQXVkaW9FbGVtZW50O1xuICB0cmFja0lkPzogc3RyaW5nO1xuICBzb25nRGF0YT86IHtcbiAgICB0aXRsZTogc3RyaW5nO1xuICAgIGFydGlzdDogc3RyaW5nO1xuICAgIGFsYnVtPzogc3RyaW5nO1xuICAgIGR1cmF0aW9uPzogbnVtYmVyO1xuICB9O1xuICBzb25nQ2F0YWxvZ0lkPzogc3RyaW5nO1xuICBhcGlVcmw/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgS2FyYW9rZVJlc3VsdHMge1xuICBzY29yZTogbnVtYmVyO1xuICBhY2N1cmFjeTogbnVtYmVyO1xuICB0b3RhbExpbmVzOiBudW1iZXI7XG4gIHBlcmZlY3RMaW5lczogbnVtYmVyO1xuICBnb29kTGluZXM6IG51bWJlcjtcbiAgbmVlZHNXb3JrTGluZXM6IG51bWJlcjtcbiAgc2Vzc2lvbklkPzogc3RyaW5nO1xuICBpc0xvYWRpbmc/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIExpbmVTY29yZSB7XG4gIGxpbmVJbmRleDogbnVtYmVyO1xuICBzY29yZTogbnVtYmVyO1xuICB0cmFuc2NyaXB0aW9uOiBzdHJpbmc7XG4gIGZlZWRiYWNrPzogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXNlS2FyYW9rZVNlc3Npb24ob3B0aW9uczogVXNlS2FyYW9rZVNlc3Npb25PcHRpb25zKSB7XG4gIGNvbnN0IFtpc1BsYXlpbmcsIHNldElzUGxheWluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbY3VycmVudFRpbWUsIHNldEN1cnJlbnRUaW1lXSA9IGNyZWF0ZVNpZ25hbCgwKTtcbiAgY29uc3QgW3Njb3JlLCBzZXRTY29yZV0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFtjb3VudGRvd24sIHNldENvdW50ZG93bl0gPSBjcmVhdGVTaWduYWw8bnVtYmVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtzZXNzaW9uSWQsIHNldFNlc3Npb25JZF0gPSBjcmVhdGVTaWduYWw8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtsaW5lU2NvcmVzLCBzZXRMaW5lU2NvcmVzXSA9IGNyZWF0ZVNpZ25hbDxMaW5lU2NvcmVbXT4oW10pO1xuICBjb25zdCBbY3VycmVudENodW5rLCBzZXRDdXJyZW50Q2h1bmtdID0gY3JlYXRlU2lnbmFsPENodW5rSW5mbyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbaXNSZWNvcmRpbmcsIHNldElzUmVjb3JkaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFthdWRpb0VsZW1lbnQsIHNldEF1ZGlvRWxlbWVudF0gPSBjcmVhdGVTaWduYWw8SFRNTEF1ZGlvRWxlbWVudCB8IHVuZGVmaW5lZD4ob3B0aW9ucy5hdWRpb0VsZW1lbnQpO1xuICBjb25zdCBbcmVjb3JkZWRDaHVua3MsIHNldFJlY29yZGVkQ2h1bmtzXSA9IGNyZWF0ZVNpZ25hbDxTZXQ8bnVtYmVyPj4obmV3IFNldCgpKTtcbiAgY29uc3QgW3BsYXliYWNrU3BlZWQsIHNldFBsYXliYWNrU3BlZWRdID0gY3JlYXRlU2lnbmFsPFBsYXliYWNrU3BlZWQ+KCcxeCcpO1xuICBcbiAgbGV0IGF1ZGlvVXBkYXRlSW50ZXJ2YWw6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBsZXQgcmVjb3JkaW5nVGltZW91dDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gIFxuICBjb25zdCBhdWRpb1Byb2Nlc3NvciA9IGNyZWF0ZUthcmFva2VBdWRpb1Byb2Nlc3Nvcih7XG4gICAgc2FtcGxlUmF0ZTogMTYwMDBcbiAgfSk7XG4gIFxuICBjb25zdCBrYXJhb2tlQXBpID0gbmV3IEthcmFva2VBcGlTZXJ2aWNlKG9wdGlvbnMuYXBpVXJsKTtcblxuICAvLyBIZWxwZXIgdG8gY29udmVydCBzcGVlZCB0byBwbGF5YmFjayByYXRlXG4gIGNvbnN0IGdldFBsYXliYWNrUmF0ZSA9IChzcGVlZDogUGxheWJhY2tTcGVlZCk6IG51bWJlciA9PiB7XG4gICAgc3dpdGNoIChzcGVlZCkge1xuICAgICAgY2FzZSAnMC41eCc6IHJldHVybiAwLjU7XG4gICAgICBjYXNlICcwLjc1eCc6IHJldHVybiAwLjc1O1xuICAgICAgY2FzZSAnMXgnOiByZXR1cm4gMS4wO1xuICAgICAgZGVmYXVsdDogcmV0dXJuIDEuMDtcbiAgICB9XG4gIH07XG5cbiAgLy8gSGVscGVyIHRvIGdldCBzcGVlZCBtdWx0aXBsaWVyIGZvciBzY29yaW5nXG4gIGNvbnN0IGdldFNwZWVkTXVsdGlwbGllciA9IChzcGVlZDogUGxheWJhY2tTcGVlZCk6IG51bWJlciA9PiB7XG4gICAgc3dpdGNoIChzcGVlZCkge1xuICAgICAgY2FzZSAnMC41eCc6IHJldHVybiAxLjI7ICAvLyAyMCUgc2NvcmUgYm9vc3QgZm9yIHNsb3dlc3Qgc3BlZWRcbiAgICAgIGNhc2UgJzAuNzV4JzogcmV0dXJuIDEuMTsgLy8gMTAlIHNjb3JlIGJvb3N0IGZvciBtZWRpdW0gc3BlZWRcbiAgICAgIGNhc2UgJzF4JzogcmV0dXJuIDEuMDsgICAgLy8gTm8gYWRqdXN0bWVudCBmb3Igbm9ybWFsIHNwZWVkXG4gICAgICBkZWZhdWx0OiByZXR1cm4gMS4wO1xuICAgIH1cbiAgfTtcblxuICAvLyBIYW5kbGUgc3BlZWQgY2hhbmdlXG4gIGNvbnN0IGhhbmRsZVNwZWVkQ2hhbmdlID0gKHNwZWVkOiBQbGF5YmFja1NwZWVkKSA9PiB7XG4gICAgc2V0UGxheWJhY2tTcGVlZChzcGVlZCk7XG4gICAgY29uc3QgYXVkaW8gPSBhdWRpb0VsZW1lbnQoKTtcbiAgICBpZiAoYXVkaW8pIHtcbiAgICAgIGNvbnN0IHJhdGUgPSBnZXRQbGF5YmFja1JhdGUoc3BlZWQpO1xuICAgICAgYXVkaW8ucGxheWJhY2tSYXRlID0gcmF0ZTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3Qgc3RhcnRTZXNzaW9uID0gYXN5bmMgKCkgPT4ge1xuICAgIC8vIEluaXRpYWxpemUgYXVkaW8gY2FwdHVyZVxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBhdWRpb1Byb2Nlc3Nvci5pbml0aWFsaXplKCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIGluaXRpYWxpemUgYXVkaW86JywgZXJyb3IpO1xuICAgIH1cbiAgICBcbiAgICAvLyBDcmVhdGUgc2Vzc2lvbiBvbiBzZXJ2ZXIgaWYgdHJhY2tJZCBwcm92aWRlZFxuICAgIFxuICAgIGlmIChvcHRpb25zLnRyYWNrSWQgJiYgb3B0aW9ucy5zb25nRGF0YSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGthcmFva2VBcGkuc3RhcnRTZXNzaW9uKFxuICAgICAgICAgIG9wdGlvbnMudHJhY2tJZCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0aXRsZTogb3B0aW9ucy5zb25nRGF0YS50aXRsZSxcbiAgICAgICAgICAgIGFydGlzdDogb3B0aW9ucy5zb25nRGF0YS5hcnRpc3QsXG4gICAgICAgICAgICBkdXJhdGlvbjogb3B0aW9ucy5zb25nRGF0YS5kdXJhdGlvbixcbiAgICAgICAgICAgIGRpZmZpY3VsdHk6ICdpbnRlcm1lZGlhdGUnLCAvLyBEZWZhdWx0IGRpZmZpY3VsdHlcbiAgICAgICAgICB9LFxuICAgICAgICAgIHVuZGVmaW5lZCwgLy8gYXV0aFRva2VuXG4gICAgICAgICAgb3B0aW9ucy5zb25nQ2F0YWxvZ0lkLFxuICAgICAgICAgIHBsYXliYWNrU3BlZWQoKVxuICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgaWYgKHNlc3Npb24pIHtcbiAgICAgICAgICBzZXRTZXNzaW9uSWQoc2Vzc2lvbi5pZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VTZXNzaW9uXSBGYWlsZWQgdG8gY3JlYXRlIHNlc3Npb24nKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VTZXNzaW9uXSBGYWlsZWQgdG8gY3JlYXRlIHNlc3Npb246JywgZXJyb3IpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgfVxuICAgIFxuICAgIC8vIFN0YXJ0IGNvdW50ZG93blxuICAgIHNldENvdW50ZG93bigzKTtcbiAgICBcbiAgICBjb25zdCBjb3VudGRvd25JbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGNvbnN0IGN1cnJlbnQgPSBjb3VudGRvd24oKTtcbiAgICAgIGlmIChjdXJyZW50ICE9PSBudWxsICYmIGN1cnJlbnQgPiAxKSB7XG4gICAgICAgIHNldENvdW50ZG93bihjdXJyZW50IC0gMSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjbGVhckludGVydmFsKGNvdW50ZG93bkludGVydmFsKTtcbiAgICAgICAgc2V0Q291bnRkb3duKG51bGwpO1xuICAgICAgICBzdGFydFBsYXliYWNrKCk7XG4gICAgICB9XG4gICAgfSwgMTAwMCk7XG4gIH07XG5cbiAgY29uc3Qgc3RhcnRQbGF5YmFjayA9ICgpID0+IHtcbiAgICBzZXRJc1BsYXlpbmcodHJ1ZSk7XG4gICAgXG4gICAgLy8gU3RhcnQgZnVsbCBzZXNzaW9uIGF1ZGlvIGNhcHR1cmVcbiAgICBhdWRpb1Byb2Nlc3Nvci5zdGFydEZ1bGxTZXNzaW9uKCk7XG4gICAgXG4gICAgY29uc3QgYXVkaW8gPSBhdWRpb0VsZW1lbnQoKSB8fCBvcHRpb25zLmF1ZGlvRWxlbWVudDtcbiAgICBpZiAoYXVkaW8pIHtcbiAgICAgIC8vIFNldCBwbGF5YmFjayByYXRlIGJhc2VkIG9uIGN1cnJlbnQgc3BlZWRcbiAgICAgIGNvbnN0IHJhdGUgPSBnZXRQbGF5YmFja1JhdGUocGxheWJhY2tTcGVlZCgpKTtcbiAgICAgIGF1ZGlvLnBsYXliYWNrUmF0ZSA9IHJhdGU7XG4gICAgICAvLyBJZiBhdWRpbyBlbGVtZW50IGlzIHByb3ZpZGVkLCB1c2UgaXRcbiAgICAgIGF1ZGlvLnBsYXkoKS5jYXRjaChjb25zb2xlLmVycm9yKTtcbiAgICAgIFxuICAgICAgY29uc3QgdXBkYXRlVGltZSA9ICgpID0+IHtcbiAgICAgICAgY29uc3QgdGltZSA9IGF1ZGlvLmN1cnJlbnRUaW1lICogMTAwMDtcbiAgICAgICAgc2V0Q3VycmVudFRpbWUodGltZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBpZiB3ZSBuZWVkIHRvIHN0YXJ0IHJlY29yZGluZyBmb3IgdXBjb21pbmcgbGluZXNcbiAgICAgICAgY2hlY2tGb3JVcGNvbWluZ0xpbmVzKHRpbWUpO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgYXVkaW9VcGRhdGVJbnRlcnZhbCA9IHNldEludGVydmFsKHVwZGF0ZVRpbWUsIDEwMCkgYXMgdW5rbm93biBhcyBudW1iZXI7XG4gICAgICBcbiAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgaGFuZGxlRW5kKTtcbiAgICB9IGVsc2Uge1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGNoZWNrRm9yVXBjb21pbmdMaW5lcyA9IChjdXJyZW50VGltZU1zOiBudW1iZXIpID0+IHtcbiAgICBpZiAoaXNSZWNvcmRpbmcoKSB8fCAhb3B0aW9ucy5seXJpY3MubGVuZ3RoKSByZXR1cm47XG4gICAgXG4gICAgY29uc3QgcmVjb3JkZWQgPSByZWNvcmRlZENodW5rcygpO1xuICAgIFxuICAgIC8vIExvb2sgZm9yIGNodW5rcyB0aGF0IHNob3VsZCBzdGFydCByZWNvcmRpbmcgc29vblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3B0aW9ucy5seXJpY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vIFNraXAgaWYgd2UndmUgYWxyZWFkeSByZWNvcmRlZCBhIGNodW5rIHN0YXJ0aW5nIGF0IHRoaXMgaW5kZXhcbiAgICAgIGlmIChyZWNvcmRlZC5oYXMoaSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNodW5rID0gc2hvdWxkQ2h1bmtMaW5lcyhvcHRpb25zLmx5cmljcywgaSk7XG4gICAgICBjb25zdCBmaXJzdExpbmUgPSBvcHRpb25zLmx5cmljc1tjaHVuay5zdGFydEluZGV4XTtcbiAgICAgIFxuICAgICAgaWYgKGZpcnN0TGluZSAmJiBmaXJzdExpbmUuc3RhcnRUaW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgcmVjb3JkaW5nU3RhcnRUaW1lID0gZmlyc3RMaW5lLnN0YXJ0VGltZSAqIDEwMDAgLSAxMDAwOyAvLyBTdGFydCAxcyBlYXJseVxuICAgICAgICBjb25zdCBsaW5lU3RhcnRUaW1lID0gZmlyc3RMaW5lLnN0YXJ0VGltZSAqIDEwMDA7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBpZiB3ZSdyZSBpbiB0aGUgcmVjb3JkaW5nIHdpbmRvdyBhbmQgaGF2ZW4ndCBwYXNzZWQgdGhlIGxpbmUgc3RhcnRcbiAgICAgICAgaWYgKGN1cnJlbnRUaW1lTXMgPj0gcmVjb3JkaW5nU3RhcnRUaW1lICYmIGN1cnJlbnRUaW1lTXMgPCBsaW5lU3RhcnRUaW1lICsgNTAwKSB7IC8vIEFsbG93IDUwMG1zIGJ1ZmZlciBhZnRlciBsaW5lIHN0YXJ0XG4gICAgICAgICAgLy8gTWFyayB0aGlzIGNodW5rIGFzIHJlY29yZGVkXG4gICAgICAgICAgc2V0UmVjb3JkZWRDaHVua3MocHJldiA9PiBuZXcgU2V0KHByZXYpLmFkZChjaHVuay5zdGFydEluZGV4KSk7XG4gICAgICAgICAgLy8gU3RhcnQgcmVjb3JkaW5nIHRoaXMgY2h1bmtcbiAgICAgICAgICBzdGFydFJlY29yZGluZ0NodW5rKGNodW5rKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBTa2lwIGFoZWFkIHRvIGF2b2lkIGNoZWNraW5nIGxpbmVzIHdlJ3ZlIGFscmVhZHkgcGFzc2VkXG4gICAgICBpID0gY2h1bmsuZW5kSW5kZXg7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3Qgc3RhcnRSZWNvcmRpbmdDaHVuayA9IGFzeW5jIChjaHVuazogQ2h1bmtJbmZvKSA9PiB7XG4gICAgLy8gVEVTVElORyBNT0RFOiBBdXRvLWNvbXBsZXRlIGFmdGVyIDUgbGluZXNcbiAgICBpZiAoY2h1bmsuc3RhcnRJbmRleCA+PSA1KSB7XG4gICAgICBoYW5kbGVFbmQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgc2V0Q3VycmVudENodW5rKGNodW5rKTtcbiAgICBzZXRJc1JlY29yZGluZyh0cnVlKTtcbiAgICBcbiAgICAvLyBTdGFydCBhdWRpbyBjYXB0dXJlIGZvciB0aGlzIGNodW5rXG4gICAgYXVkaW9Qcm9jZXNzb3Iuc3RhcnRSZWNvcmRpbmdMaW5lKGNodW5rLnN0YXJ0SW5kZXgpO1xuICAgIFxuICAgIC8vIENhbGN1bGF0ZSByZWNvcmRpbmcgZHVyYXRpb24gYWRqdXN0ZWQgZm9yIHBsYXliYWNrIHNwZWVkXG4gICAgY29uc3QgYmFzZUR1cmF0aW9uID0gY2FsY3VsYXRlUmVjb3JkaW5nRHVyYXRpb24ob3B0aW9ucy5seXJpY3MsIGNodW5rKTtcbiAgICBjb25zdCBzcGVlZEZhY3RvciA9IDEgLyBnZXRQbGF5YmFja1JhdGUocGxheWJhY2tTcGVlZCgpKTsgLy8gSW52ZXJzZSBvZiBwbGF5YmFjayByYXRlXG4gICAgY29uc3QgZHVyYXRpb24gPSBiYXNlRHVyYXRpb24gKiBzcGVlZEZhY3RvcjtcbiAgICBcbiAgICAvLyBTdG9wIHJlY29yZGluZyBhZnRlciBkdXJhdGlvblxuICAgIHJlY29yZGluZ1RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHN0b3BSZWNvcmRpbmdDaHVuaygpO1xuICAgIH0sIGR1cmF0aW9uKSBhcyB1bmtub3duIGFzIG51bWJlcjtcbiAgfTtcbiAgXG4gIGNvbnN0IHN0b3BSZWNvcmRpbmdDaHVuayA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBjaHVuayA9IGN1cnJlbnRDaHVuaygpO1xuICAgIGlmICghY2h1bmspIHJldHVybjtcbiAgICBcbiAgICBzZXRJc1JlY29yZGluZyhmYWxzZSk7XG4gICAgXG4gICAgLy8gR2V0IHRoZSByZWNvcmRlZCBhdWRpb1xuICAgIGNvbnN0IGF1ZGlvQ2h1bmtzID0gYXVkaW9Qcm9jZXNzb3Iuc3RvcFJlY29yZGluZ0xpbmVBbmRHZXRSYXdBdWRpbygpO1xuICAgIGNvbnN0IHdhdkJsb2IgPSBhdWRpb1Byb2Nlc3Nvci5jb252ZXJ0QXVkaW9Ub1dhdkJsb2IoYXVkaW9DaHVua3MpO1xuICAgIFxuICAgIFxuICAgIC8vIENoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGF1ZGlvIGRhdGFcbiAgICBpZiAod2F2QmxvYiAmJiB3YXZCbG9iLnNpemUgPiAxMDAwICYmIHNlc3Npb25JZCgpKSB7IC8vIE1pbmltdW0gMUtCIG9mIGF1ZGlvIGRhdGFcbiAgICAgIC8vIENvbnZlcnQgdG8gYmFzZTY0IGZvciBBUElcbiAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkZW5kID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBiYXNlNjRBdWRpbyA9IHJlYWRlci5yZXN1bHQ/LnRvU3RyaW5nKCkuc3BsaXQoJywnKVsxXTtcbiAgICAgICAgaWYgKGJhc2U2NEF1ZGlvICYmIGJhc2U2NEF1ZGlvLmxlbmd0aCA+IDEwMCkgeyAvLyBFbnN1cmUgd2UgaGF2ZSBtZWFuaW5nZnVsIGJhc2U2NCBkYXRhXG4gICAgICAgICAgYXdhaXQgZ3JhZGVDaHVuayhjaHVuaywgYmFzZTY0QXVkaW8pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKHdhdkJsb2IpO1xuICAgIH0gZWxzZSBpZiAod2F2QmxvYiAmJiB3YXZCbG9iLnNpemUgPD0gMTAwMCkge1xuICAgICAgLy8gQWRkIGEgbmV1dHJhbCBzY29yZSBmb3IgVUkgZmVlZGJhY2tcbiAgICAgIHNldExpbmVTY29yZXMocHJldiA9PiBbLi4ucHJldiwge1xuICAgICAgICBsaW5lSW5kZXg6IGNodW5rLnN0YXJ0SW5kZXgsXG4gICAgICAgIHNjb3JlOiA1MCxcbiAgICAgICAgdHJhbnNjcmlwdGlvbjogJycsXG4gICAgICAgIGZlZWRiYWNrOiAnUmVjb3JkaW5nIHRvbyBzaG9ydCdcbiAgICAgIH1dKTtcbiAgICB9IGVsc2UgaWYgKHdhdkJsb2IgJiYgIXNlc3Npb25JZCgpKSB7XG4gICAgfVxuICAgIFxuICAgIHNldEN1cnJlbnRDaHVuayhudWxsKTtcbiAgICBcbiAgICBpZiAocmVjb3JkaW5nVGltZW91dCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHJlY29yZGluZ1RpbWVvdXQpO1xuICAgICAgcmVjb3JkaW5nVGltZW91dCA9IG51bGw7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgZ3JhZGVDaHVuayA9IGFzeW5jIChjaHVuazogQ2h1bmtJbmZvLCBhdWRpb0Jhc2U2NDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY3VycmVudFNlc3Npb25JZCA9IHNlc3Npb25JZCgpO1xuICAgIFxuICAgIGlmICghY3VycmVudFNlc3Npb25JZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3QgbGluZVNjb3JlID0gYXdhaXQga2FyYW9rZUFwaS5ncmFkZVJlY29yZGluZyhcbiAgICAgICAgY3VycmVudFNlc3Npb25JZCxcbiAgICAgICAgY2h1bmsuc3RhcnRJbmRleCxcbiAgICAgICAgYXVkaW9CYXNlNjQsXG4gICAgICAgIGNodW5rLmV4cGVjdGVkVGV4dCxcbiAgICAgICAgb3B0aW9ucy5seXJpY3NbY2h1bmsuc3RhcnRJbmRleF0/LnN0YXJ0VGltZSB8fCAwLFxuICAgICAgICAob3B0aW9ucy5seXJpY3NbY2h1bmsuZW5kSW5kZXhdPy5zdGFydFRpbWUgfHwgMCkgKyAob3B0aW9ucy5seXJpY3NbY2h1bmsuZW5kSW5kZXhdPy5kdXJhdGlvbiB8fCAwKSAvIDEwMDAsXG4gICAgICAgIHVuZGVmaW5lZCwgLy8gYXV0aFRva2VuXG4gICAgICAgIHBsYXliYWNrU3BlZWQoKVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgaWYgKGxpbmVTY29yZSkge1xuICAgICAgICBcbiAgICAgICAgLy8gQXBwbHkgc3BlZWQgbXVsdGlwbGllciB0byBzY29yZSBmb3IgbGFuZ3VhZ2UgbGVhcm5lcnNcbiAgICAgICAgY29uc3Qgc3BlZWRNdWx0aXBsaWVyID0gZ2V0U3BlZWRNdWx0aXBsaWVyKHBsYXliYWNrU3BlZWQoKSk7XG4gICAgICAgIGNvbnN0IGFkanVzdGVkU2NvcmUgPSBNYXRoLm1pbigxMDAsIE1hdGgucm91bmQobGluZVNjb3JlLnNjb3JlICogc3BlZWRNdWx0aXBsaWVyKSk7XG4gICAgICAgIFxuICAgICAgICAvLyBVcGRhdGUgbGluZSBzY29yZXNcbiAgICAgICAgY29uc3QgbmV3TGluZVNjb3JlID0ge1xuICAgICAgICAgIGxpbmVJbmRleDogY2h1bmsuc3RhcnRJbmRleCxcbiAgICAgICAgICBzY29yZTogYWRqdXN0ZWRTY29yZSxcbiAgICAgICAgICB0cmFuc2NyaXB0aW9uOiBsaW5lU2NvcmUudHJhbnNjcmlwdCB8fCAnJyxcbiAgICAgICAgICBmZWVkYmFjazogbGluZVNjb3JlLmZlZWRiYWNrXG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBzZXRMaW5lU2NvcmVzKHByZXYgPT4gWy4uLnByZXYsIG5ld0xpbmVTY29yZV0pO1xuICAgICAgICBcbiAgICAgICAgLy8gVXBkYXRlIHRvdGFsIHNjb3JlIChzaW1wbGUgYXZlcmFnZSBmb3Igbm93KSAtIHVzZSBwcmV2IHRvIGF2b2lkIGRlcGVuZGVuY3lcbiAgICAgICAgc2V0U2NvcmUocHJldiA9PiB7XG4gICAgICAgICAgY29uc3QgYWxsU2NvcmVzID0gWy4uLmxpbmVTY29yZXMoKSwgbmV3TGluZVNjb3JlXTtcbiAgICAgICAgICBjb25zdCBhdmdTY29yZSA9IGFsbFNjb3Jlcy5yZWR1Y2UoKHN1bSwgcykgPT4gc3VtICsgcy5zY29yZSwgMCkgLyBhbGxTY29yZXMubGVuZ3RoO1xuICAgICAgICAgIHJldHVybiBNYXRoLnJvdW5kKGF2Z1Njb3JlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICAvLyBSZW1vdmVkIHRlc3QgbW9kZSBsaW1pdFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgXG4gICAgICAgIC8vIEFkZCBhIG5ldXRyYWwgc2NvcmUgZm9yIFVJIGZlZWRiYWNrXG4gICAgICAgIHNldExpbmVTY29yZXMocHJldiA9PiBbLi4ucHJldiwge1xuICAgICAgICAgIGxpbmVJbmRleDogY2h1bmsuc3RhcnRJbmRleCxcbiAgICAgICAgICBzY29yZTogNTAsIC8vIE5ldXRyYWwgc2NvcmVcbiAgICAgICAgICB0cmFuc2NyaXB0aW9uOiAnJyxcbiAgICAgICAgICBmZWVkYmFjazogJ0ZhaWxlZCB0byBncmFkZSByZWNvcmRpbmcnXG4gICAgICAgIH1dKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VTZXNzaW9uXSBGYWlsZWQgdG8gZ3JhZGUgY2h1bms6JywgZXJyb3IpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVFbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgc2V0SXNQbGF5aW5nKGZhbHNlKTtcbiAgICBpZiAoYXVkaW9VcGRhdGVJbnRlcnZhbCkge1xuICAgICAgY2xlYXJJbnRlcnZhbChhdWRpb1VwZGF0ZUludGVydmFsKTtcbiAgICB9XG4gICAgXG4gICAgLy8gUGF1c2UgdGhlIGF1ZGlvXG4gICAgY29uc3QgYXVkaW8gPSBhdWRpb0VsZW1lbnQoKSB8fCBvcHRpb25zLmF1ZGlvRWxlbWVudDtcbiAgICBpZiAoYXVkaW8gJiYgIWF1ZGlvLnBhdXNlZCkge1xuICAgICAgYXVkaW8ucGF1c2UoKTtcbiAgICB9XG4gICAgXG4gICAgLy8gU3RvcCBhbnkgb25nb2luZyByZWNvcmRpbmdcbiAgICBpZiAoaXNSZWNvcmRpbmcoKSkge1xuICAgICAgYXdhaXQgc3RvcFJlY29yZGluZ0NodW5rKCk7XG4gICAgfVxuICAgIFxuICAgIC8vIFNob3cgbG9hZGluZyBzdGF0ZSBpbW1lZGlhdGVseVxuICAgIGNvbnN0IGxvYWRpbmdSZXN1bHRzOiBLYXJhb2tlUmVzdWx0cyA9IHtcbiAgICAgIHNjb3JlOiAtMSwgLy8gU3BlY2lhbCB2YWx1ZSB0byBpbmRpY2F0ZSBsb2FkaW5nXG4gICAgICBhY2N1cmFjeTogMCxcbiAgICAgIHRvdGFsTGluZXM6IGxpbmVTY29yZXMoKS5sZW5ndGgsXG4gICAgICBwZXJmZWN0TGluZXM6IDAsXG4gICAgICBnb29kTGluZXM6IDAsXG4gICAgICBuZWVkc1dvcmtMaW5lczogMCxcbiAgICAgIHNlc3Npb25JZDogc2Vzc2lvbklkKCkgfHwgdW5kZWZpbmVkLFxuICAgICAgaXNMb2FkaW5nOiB0cnVlXG4gICAgfTtcbiAgICBvcHRpb25zLm9uQ29tcGxldGU/Lihsb2FkaW5nUmVzdWx0cyk7XG4gICAgXG4gICAgLy8gR2V0IGZ1bGwgc2Vzc2lvbiBhdWRpb1xuICAgIGNvbnN0IGZ1bGxBdWRpb0Jsb2IgPSBhdWRpb1Byb2Nlc3Nvci5zdG9wRnVsbFNlc3Npb25BbmRHZXRXYXYoKTtcbiAgICBcbiAgICAvLyBDb21wbGV0ZSBzZXNzaW9uIG9uIHNlcnZlclxuICAgIGNvbnN0IGN1cnJlbnRTZXNzaW9uSWQgPSBzZXNzaW9uSWQoKTtcbiAgICBpZiAoY3VycmVudFNlc3Npb25JZCAmJiBmdWxsQXVkaW9CbG9iICYmIGZ1bGxBdWRpb0Jsb2Iuc2l6ZSA+IDEwMDApIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgYmFzZTY0QXVkaW8gPSByZWFkZXIucmVzdWx0Py50b1N0cmluZygpLnNwbGl0KCcsJylbMV07XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3Qgc2Vzc2lvblJlc3VsdHMgPSBhd2FpdCBrYXJhb2tlQXBpLmNvbXBsZXRlU2Vzc2lvbihcbiAgICAgICAgICAgIGN1cnJlbnRTZXNzaW9uSWQsXG4gICAgICAgICAgICBiYXNlNjRBdWRpb1xuICAgICAgICAgICk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHNlc3Npb25SZXN1bHRzKSB7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IEthcmFva2VSZXN1bHRzID0ge1xuICAgICAgICAgICAgICBzY29yZTogc2Vzc2lvblJlc3VsdHMuZmluYWxTY29yZSxcbiAgICAgICAgICAgICAgYWNjdXJhY3k6IHNlc3Npb25SZXN1bHRzLmFjY3VyYWN5LFxuICAgICAgICAgICAgICB0b3RhbExpbmVzOiBzZXNzaW9uUmVzdWx0cy50b3RhbExpbmVzLFxuICAgICAgICAgICAgICBwZXJmZWN0TGluZXM6IHNlc3Npb25SZXN1bHRzLnBlcmZlY3RMaW5lcyxcbiAgICAgICAgICAgICAgZ29vZExpbmVzOiBzZXNzaW9uUmVzdWx0cy5nb29kTGluZXMsXG4gICAgICAgICAgICAgIG5lZWRzV29ya0xpbmVzOiBzZXNzaW9uUmVzdWx0cy5uZWVkc1dvcmtMaW5lcyxcbiAgICAgICAgICAgICAgc2Vzc2lvbklkOiBjdXJyZW50U2Vzc2lvbklkXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBvcHRpb25zLm9uQ29tcGxldGU/LihyZXN1bHRzKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gbG9jYWwgY2FsY3VsYXRpb25cbiAgICAgICAgICAgIGNhbGN1bGF0ZUxvY2FsUmVzdWx0cygpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoZnVsbEF1ZGlvQmxvYik7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBjb21wbGV0ZSBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgICAgY2FsY3VsYXRlTG9jYWxSZXN1bHRzKCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vIHNlc3Npb24sIGp1c3QgcmV0dXJuIGxvY2FsIHJlc3VsdHNcbiAgICAgIGNhbGN1bGF0ZUxvY2FsUmVzdWx0cygpO1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGNhbGN1bGF0ZUxvY2FsUmVzdWx0cyA9ICgpID0+IHtcbiAgICBjb25zdCBzY29yZXMgPSBsaW5lU2NvcmVzKCk7XG4gICAgY29uc3QgYXZnU2NvcmUgPSBzY29yZXMubGVuZ3RoID4gMCBcbiAgICAgID8gc2NvcmVzLnJlZHVjZSgoc3VtLCBzKSA9PiBzdW0gKyBzLnNjb3JlLCAwKSAvIHNjb3Jlcy5sZW5ndGhcbiAgICAgIDogMDtcbiAgICBcbiAgICBjb25zdCByZXN1bHRzOiBLYXJhb2tlUmVzdWx0cyA9IHtcbiAgICAgIHNjb3JlOiBNYXRoLnJvdW5kKGF2Z1Njb3JlKSxcbiAgICAgIGFjY3VyYWN5OiBNYXRoLnJvdW5kKGF2Z1Njb3JlKSxcbiAgICAgIHRvdGFsTGluZXM6IHNjb3Jlcy5sZW5ndGgsIC8vIFVzZSBhY3R1YWwgY29tcGxldGVkIGxpbmVzIGZvciB0ZXN0IG1vZGVcbiAgICAgIHBlcmZlY3RMaW5lczogc2NvcmVzLmZpbHRlcihzID0+IHMuc2NvcmUgPj0gOTApLmxlbmd0aCxcbiAgICAgIGdvb2RMaW5lczogc2NvcmVzLmZpbHRlcihzID0+IHMuc2NvcmUgPj0gNzAgJiYgcy5zY29yZSA8IDkwKS5sZW5ndGgsXG4gICAgICBuZWVkc1dvcmtMaW5lczogc2NvcmVzLmZpbHRlcihzID0+IHMuc2NvcmUgPCA3MCkubGVuZ3RoLFxuICAgICAgc2Vzc2lvbklkOiBzZXNzaW9uSWQoKSB8fCB1bmRlZmluZWRcbiAgICB9O1xuICAgIFxuICAgIG9wdGlvbnMub25Db21wbGV0ZT8uKHJlc3VsdHMpO1xuICB9O1xuXG4gIGNvbnN0IHN0b3BTZXNzaW9uID0gKCkgPT4ge1xuICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgc2V0Q291bnRkb3duKG51bGwpO1xuICAgIHNldElzUmVjb3JkaW5nKGZhbHNlKTtcbiAgICBzZXRDdXJyZW50Q2h1bmsobnVsbCk7XG4gICAgc2V0UmVjb3JkZWRDaHVua3MobmV3IFNldDxudW1iZXI+KCkpO1xuICAgIFxuICAgIGlmIChhdWRpb1VwZGF0ZUludGVydmFsKSB7XG4gICAgICBjbGVhckludGVydmFsKGF1ZGlvVXBkYXRlSW50ZXJ2YWwpO1xuICAgICAgYXVkaW9VcGRhdGVJbnRlcnZhbCA9IG51bGw7XG4gICAgfVxuICAgIFxuICAgIGlmIChyZWNvcmRpbmdUaW1lb3V0KSB7XG4gICAgICBjbGVhclRpbWVvdXQocmVjb3JkaW5nVGltZW91dCk7XG4gICAgICByZWNvcmRpbmdUaW1lb3V0ID0gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYXVkaW8gPSBhdWRpb0VsZW1lbnQoKSB8fCBvcHRpb25zLmF1ZGlvRWxlbWVudDtcbiAgICBpZiAoYXVkaW8pIHtcbiAgICAgIGF1ZGlvLnBhdXNlKCk7XG4gICAgICBhdWRpby5jdXJyZW50VGltZSA9IDA7XG4gICAgICBhdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCdlbmRlZCcsIGhhbmRsZUVuZCk7XG4gICAgfVxuICAgIFxuICAgIC8vIENsZWFudXAgYXVkaW8gcHJvY2Vzc29yXG4gICAgYXVkaW9Qcm9jZXNzb3IuY2xlYW51cCgpO1xuICB9O1xuXG4gIG9uQ2xlYW51cCgoKSA9PiB7XG4gICAgc3RvcFNlc3Npb24oKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICAvLyBTdGF0ZVxuICAgIGlzUGxheWluZyxcbiAgICBjdXJyZW50VGltZSxcbiAgICBzY29yZSxcbiAgICBjb3VudGRvd24sXG4gICAgc2Vzc2lvbklkLFxuICAgIGxpbmVTY29yZXMsXG4gICAgaXNSZWNvcmRpbmcsXG4gICAgY3VycmVudENodW5rLFxuICAgIHBsYXliYWNrU3BlZWQsXG4gICAgXG4gICAgLy8gQWN0aW9uc1xuICAgIHN0YXJ0U2Vzc2lvbixcbiAgICBzdG9wU2Vzc2lvbixcbiAgICBoYW5kbGVTcGVlZENoYW5nZSxcbiAgICBcbiAgICAvLyBBdWRpbyBwcm9jZXNzb3IgKGZvciBkaXJlY3QgYWNjZXNzIGlmIG5lZWRlZClcbiAgICBhdWRpb1Byb2Nlc3NvcixcbiAgICBcbiAgICAvLyBNZXRob2QgdG8gdXBkYXRlIGF1ZGlvIGVsZW1lbnQgYWZ0ZXIgaW5pdGlhbGl6YXRpb25cbiAgICBzZXRBdWRpb0VsZW1lbnQ6IChlbGVtZW50OiBIVE1MQXVkaW9FbGVtZW50IHwgdW5kZWZpbmVkKSA9PiB7XG4gICAgICBzZXRBdWRpb0VsZW1lbnQoZWxlbWVudCk7XG4gICAgICAvLyBBcHBseSBjdXJyZW50IHBsYXliYWNrIHJhdGUgdG8gbmV3IGF1ZGlvIGVsZW1lbnRcbiAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgIGVsZW1lbnQucGxheWJhY2tSYXRlID0gZ2V0UGxheWJhY2tSYXRlKHBsYXliYWNrU3BlZWQoKSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufSIsImV4cG9ydCBpbnRlcmZhY2UgVHJhY2tJbmZvIHtcbiAgdHJhY2tJZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBhcnRpc3Q6IHN0cmluZztcbiAgcGxhdGZvcm06ICdzb3VuZGNsb3VkJztcbiAgdXJsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFja0RldGVjdG9yIHtcbiAgLyoqXG4gICAqIERldGVjdCBjdXJyZW50IHRyYWNrIGZyb20gdGhlIHBhZ2UgKFNvdW5kQ2xvdWQgb25seSlcbiAgICovXG4gIGRldGVjdEN1cnJlbnRUcmFjaygpOiBUcmFja0luZm8gfCBudWxsIHtcbiAgICBjb25zdCB1cmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICBcbiAgICAvLyBPbmx5IHdvcmsgb24gc2MubWFpZC56b25lIChTb3VuZENsb3VkIHByb3h5KVxuICAgIGlmICh1cmwuaW5jbHVkZXMoJ3NjLm1haWQuem9uZScpKSB7XG4gICAgICByZXR1cm4gdGhpcy5kZXRlY3RTb3VuZENsb3VkVHJhY2soKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IHRyYWNrIGluZm8gZnJvbSBTb3VuZENsb3VkIChzYy5tYWlkLnpvbmUpXG4gICAqL1xuICBwcml2YXRlIGRldGVjdFNvdW5kQ2xvdWRUcmFjaygpOiBUcmFja0luZm8gfCBudWxsIHtcbiAgICB0cnkge1xuICAgICAgLy8gU291bmRDbG91ZCBVUkxzOiBzYy5tYWlkLnpvbmUvdXNlci90cmFjay1uYW1lXG4gICAgICBjb25zdCBwYXRoUGFydHMgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBpZiAocGF0aFBhcnRzLmxlbmd0aCA8IDIpIHJldHVybiBudWxsO1xuXG4gICAgICBjb25zdCBhcnRpc3RQYXRoID0gcGF0aFBhcnRzWzBdO1xuICAgICAgY29uc3QgdHJhY2tTbHVnID0gcGF0aFBhcnRzWzFdO1xuICAgICAgXG4gICAgICAvLyBUcnkgdG8gZ2V0IGFjdHVhbCB0aXRsZSBmcm9tIHBhZ2VcbiAgICAgIGxldCB0aXRsZSA9ICcnO1xuICAgICAgXG4gICAgICAvLyBGb3Igc291bmRjbG9haywgbG9vayBmb3IgaDEgYWZ0ZXIgdGhlIGltYWdlXG4gICAgICBjb25zdCBoMUVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnaDEnKTtcbiAgICAgIGZvciAoY29uc3QgaDEgb2YgaDFFbGVtZW50cykge1xuICAgICAgICAvLyBTa2lwIHRoZSBcInNvdW5kY2xvYWtcIiBoZWFkZXJcbiAgICAgICAgaWYgKGgxLnRleHRDb250ZW50Py50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzb3VuZGNsb2FrJykpIGNvbnRpbnVlO1xuICAgICAgICB0aXRsZSA9IGgxLnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgIGlmICh0aXRsZSkgYnJlYWs7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEZhbGxiYWNrIHRvIHNsdWdcbiAgICAgIGlmICghdGl0bGUpIHtcbiAgICAgICAgdGl0bGUgPSB0cmFja1NsdWcucmVwbGFjZSgvLS9nLCAnICcpO1xuICAgICAgfVxuXG4gICAgICAvLyBUcnkgdG8gZ2V0IGFjdHVhbCBhcnRpc3QgbmFtZSBmcm9tIHBhZ2VcbiAgICAgIGxldCBhcnRpc3QgPSAnJztcbiAgICAgIFxuICAgICAgLy8gTG9vayBmb3IgYXJ0aXN0IGxpbmsgd2l0aCBtZXRhIGNsYXNzXG4gICAgICBjb25zdCBhcnRpc3RMaW5rID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYS5saXN0aW5nIC5tZXRhIGgzJyk7XG4gICAgICBpZiAoYXJ0aXN0TGluayAmJiBhcnRpc3RMaW5rLnRleHRDb250ZW50KSB7XG4gICAgICAgIGFydGlzdCA9IGFydGlzdExpbmsudGV4dENvbnRlbnQudHJpbSgpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBGYWxsYmFjazogdHJ5IHBhZ2UgdGl0bGVcbiAgICAgIGlmICghYXJ0aXN0KSB7XG4gICAgICAgIGNvbnN0IHBhZ2VUaXRsZSA9IGRvY3VtZW50LnRpdGxlO1xuICAgICAgICAvLyBUaXRsZSBmb3JtYXQ6IFwiU29uZyBieSBBcnRpc3QgfiBzb3VuZGNsb2FrXCJcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBwYWdlVGl0bGUubWF0Y2goL2J5XFxzKyguKz8pXFxzKn4vKTtcbiAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgYXJ0aXN0ID0gbWF0Y2hbMV0udHJpbSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEZpbmFsIGZhbGxiYWNrIHRvIFVSTFxuICAgICAgaWYgKCFhcnRpc3QpIHtcbiAgICAgICAgYXJ0aXN0ID0gYXJ0aXN0UGF0aC5yZXBsYWNlKC8tL2csICcgJykucmVwbGFjZSgvXy9nLCAnICcpO1xuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZygnW1RyYWNrRGV0ZWN0b3JdIERldGVjdGVkIHRyYWNrOicsIHsgdGl0bGUsIGFydGlzdCwgYXJ0aXN0UGF0aCwgdHJhY2tTbHVnIH0pO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0cmFja0lkOiBgJHthcnRpc3RQYXRofS8ke3RyYWNrU2x1Z31gLFxuICAgICAgICB0aXRsZTogdGl0bGUsXG4gICAgICAgIGFydGlzdDogYXJ0aXN0LFxuICAgICAgICBwbGF0Zm9ybTogJ3NvdW5kY2xvdWQnLFxuICAgICAgICB1cmw6IHdpbmRvdy5sb2NhdGlvbi5ocmVmLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW1RyYWNrRGV0ZWN0b3JdIEVycm9yIGRldGVjdGluZyBTb3VuZENsb3VkIHRyYWNrOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG5cbiAgLyoqXG4gICAqIFdhdGNoIGZvciBwYWdlIGNoYW5nZXMgKFNvdW5kQ2xvdWQgaXMgYSBTUEEpXG4gICAqL1xuICB3YXRjaEZvckNoYW5nZXMoY2FsbGJhY2s6ICh0cmFjazogVHJhY2tJbmZvIHwgbnVsbCkgPT4gdm9pZCk6ICgpID0+IHZvaWQge1xuICAgIGxldCBjdXJyZW50VXJsID0gd2luZG93LmxvY2F0aW9uLmhyZWY7XG4gICAgbGV0IGN1cnJlbnRUcmFjayA9IHRoaXMuZGV0ZWN0Q3VycmVudFRyYWNrKCk7XG4gICAgXG4gICAgLy8gSW5pdGlhbCBkZXRlY3Rpb25cbiAgICBjYWxsYmFjayhjdXJyZW50VHJhY2spO1xuXG4gICAgLy8gV2F0Y2ggZm9yIFVSTCBjaGFuZ2VzXG4gICAgY29uc3QgY2hlY2tGb3JDaGFuZ2VzID0gKCkgPT4ge1xuICAgICAgY29uc3QgbmV3VXJsID0gd2luZG93LmxvY2F0aW9uLmhyZWY7XG4gICAgICBpZiAobmV3VXJsICE9PSBjdXJyZW50VXJsKSB7XG4gICAgICAgIGN1cnJlbnRVcmwgPSBuZXdVcmw7XG4gICAgICAgIGNvbnN0IG5ld1RyYWNrID0gdGhpcy5kZXRlY3RDdXJyZW50VHJhY2soKTtcbiAgICAgICAgXG4gICAgICAgIC8vIE9ubHkgdHJpZ2dlciBjYWxsYmFjayBpZiB0cmFjayBhY3R1YWxseSBjaGFuZ2VkXG4gICAgICAgIGNvbnN0IHRyYWNrQ2hhbmdlZCA9ICFjdXJyZW50VHJhY2sgfHwgIW5ld1RyYWNrIHx8IFxuICAgICAgICAgIGN1cnJlbnRUcmFjay50cmFja0lkICE9PSBuZXdUcmFjay50cmFja0lkO1xuICAgICAgICAgIFxuICAgICAgICBpZiAodHJhY2tDaGFuZ2VkKSB7XG4gICAgICAgICAgY3VycmVudFRyYWNrID0gbmV3VHJhY2s7XG4gICAgICAgICAgY2FsbGJhY2sobmV3VHJhY2spO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIFBvbGwgZm9yIGNoYW5nZXMgKFNQQXMgZG9uJ3QgYWx3YXlzIHRyaWdnZXIgcHJvcGVyIG5hdmlnYXRpb24gZXZlbnRzKVxuICAgIGNvbnN0IGludGVydmFsID0gc2V0SW50ZXJ2YWwoY2hlY2tGb3JDaGFuZ2VzLCAxMDAwKTtcblxuICAgIC8vIEFsc28gbGlzdGVuIGZvciBuYXZpZ2F0aW9uIGV2ZW50c1xuICAgIGNvbnN0IGhhbmRsZU5hdmlnYXRpb24gPSAoKSA9PiB7XG4gICAgICBzZXRUaW1lb3V0KGNoZWNrRm9yQ2hhbmdlcywgMTAwKTsgLy8gU21hbGwgZGVsYXkgZm9yIERPTSB1cGRhdGVzXG4gICAgfTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb3BzdGF0ZScsIGhhbmRsZU5hdmlnYXRpb24pO1xuICAgIFxuICAgIC8vIExpc3RlbiBmb3IgcHVzaHN0YXRlL3JlcGxhY2VzdGF0ZSAoU291bmRDbG91ZCB1c2VzIHRoZXNlKVxuICAgIGNvbnN0IG9yaWdpbmFsUHVzaFN0YXRlID0gaGlzdG9yeS5wdXNoU3RhdGU7XG4gICAgY29uc3Qgb3JpZ2luYWxSZXBsYWNlU3RhdGUgPSBoaXN0b3J5LnJlcGxhY2VTdGF0ZTtcbiAgICBcbiAgICBoaXN0b3J5LnB1c2hTdGF0ZSA9IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICAgIG9yaWdpbmFsUHVzaFN0YXRlLmFwcGx5KGhpc3RvcnksIGFyZ3MpO1xuICAgICAgaGFuZGxlTmF2aWdhdGlvbigpO1xuICAgIH07XG4gICAgXG4gICAgaGlzdG9yeS5yZXBsYWNlU3RhdGUgPSBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgICBvcmlnaW5hbFJlcGxhY2VTdGF0ZS5hcHBseShoaXN0b3J5LCBhcmdzKTtcbiAgICAgIGhhbmRsZU5hdmlnYXRpb24oKTtcbiAgICB9O1xuXG4gICAgLy8gUmV0dXJuIGNsZWFudXAgZnVuY3Rpb25cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCBoYW5kbGVOYXZpZ2F0aW9uKTtcbiAgICAgIGhpc3RvcnkucHVzaFN0YXRlID0gb3JpZ2luYWxQdXNoU3RhdGU7XG4gICAgICBoaXN0b3J5LnJlcGxhY2VTdGF0ZSA9IG9yaWdpbmFsUmVwbGFjZVN0YXRlO1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IHRyYWNrRGV0ZWN0b3IgPSBuZXcgVHJhY2tEZXRlY3RvcigpOyIsIi8vIFVzaW5nIGJyb3dzZXIuc3RvcmFnZSBBUEkgZGlyZWN0bHkgZm9yIHNpbXBsaWNpdHlcbmltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG5cbi8vIEhlbHBlciB0byBnZXQgYXV0aCB0b2tlblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEF1dGhUb2tlbigpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLmdldCgnYXV0aFRva2VuJyk7XG4gIHJldHVybiByZXN1bHQuYXV0aFRva2VuIHx8IG51bGw7XG59XG5cbi8vIEhlbHBlciB0byBzZXQgYXV0aCB0b2tlblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldEF1dGhUb2tlbih0b2tlbjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5zZXQoeyBhdXRoVG9rZW46IHRva2VuIH0pO1xufVxuXG4vLyBIZWxwZXIgdG8gZ2V0IGluc3RhbGxhdGlvbiBzdGF0ZVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEluc3RhbGxhdGlvblN0YXRlKCk6IFByb21pc2U8e1xuICBjb21wbGV0ZWQ6IGJvb2xlYW47XG4gIGp3dFZlcmlmaWVkOiBib29sZWFuO1xuICB0aW1lc3RhbXA/OiBudW1iZXI7XG59PiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5nZXQoJ2luc3RhbGxhdGlvblN0YXRlJyk7XG4gIHJldHVybiByZXN1bHQuaW5zdGFsbGF0aW9uU3RhdGUgfHwge1xuICAgIGNvbXBsZXRlZDogZmFsc2UsXG4gICAgand0VmVyaWZpZWQ6IGZhbHNlLFxuICB9O1xufVxuXG4vLyBIZWxwZXIgdG8gc2V0IGluc3RhbGxhdGlvbiBzdGF0ZVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldEluc3RhbGxhdGlvblN0YXRlKHN0YXRlOiB7XG4gIGNvbXBsZXRlZDogYm9vbGVhbjtcbiAgand0VmVyaWZpZWQ6IGJvb2xlYW47XG4gIHRpbWVzdGFtcD86IG51bWJlcjtcbn0pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnNldCh7IGluc3RhbGxhdGlvblN0YXRlOiBzdGF0ZSB9KTtcbn1cblxuLy8gSGVscGVyIHRvIGNoZWNrIGlmIHVzZXIgaXMgYXV0aGVudGljYXRlZFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGlzQXV0aGVudGljYXRlZCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgY29uc3QgdG9rZW4gPSBhd2FpdCBnZXRBdXRoVG9rZW4oKTtcbiAgcmV0dXJuICEhdG9rZW4gJiYgdG9rZW4uc3RhcnRzV2l0aCgnc2NhcmxldHRfJyk7XG59XG5cbi8vIEhlbHBlciB0byBjbGVhciBhdXRoIGRhdGFcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjbGVhckF1dGgoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5yZW1vdmUoWydhdXRoVG9rZW4nLCAnaW5zdGFsbGF0aW9uU3RhdGUnXSk7XG59IiwiZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlRGF0YSB7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIHRyYWNrX2lkPzogc3RyaW5nO1xuICB0cmFja0lkPzogc3RyaW5nO1xuICBoYXNfa2FyYW9rZT86IGJvb2xlYW47XG4gIGhhc0thcmFva2U/OiBib29sZWFuO1xuICBzb25nPzoge1xuICAgIGlkOiBzdHJpbmc7XG4gICAgdGl0bGU6IHN0cmluZztcbiAgICBhcnRpc3Q6IHN0cmluZztcbiAgICBhbGJ1bT86IHN0cmluZztcbiAgICBhcnR3b3JrVXJsPzogc3RyaW5nO1xuICAgIGR1cmF0aW9uPzogbnVtYmVyO1xuICAgIGRpZmZpY3VsdHk6ICdiZWdpbm5lcicgfCAnaW50ZXJtZWRpYXRlJyB8ICdhZHZhbmNlZCc7XG4gIH07XG4gIGx5cmljcz86IHtcbiAgICBzb3VyY2U6IHN0cmluZztcbiAgICB0eXBlOiAnc3luY2VkJztcbiAgICBsaW5lczogTHlyaWNMaW5lW107XG4gICAgdG90YWxMaW5lczogbnVtYmVyO1xuICB9O1xuICBtZXNzYWdlPzogc3RyaW5nO1xuICBlcnJvcj86IHN0cmluZztcbiAgYXBpX2Nvbm5lY3RlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTHlyaWNMaW5lIHtcbiAgaWQ6IHN0cmluZztcbiAgdGV4dDogc3RyaW5nO1xuICBzdGFydFRpbWU6IG51bWJlcjtcbiAgZHVyYXRpb246IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlU2Vzc2lvbiB7XG4gIGlkOiBzdHJpbmc7XG4gIHRyYWNrSWQ6IHN0cmluZztcbiAgc29uZ1RpdGxlOiBzdHJpbmc7XG4gIHNvbmdBcnRpc3Q6IHN0cmluZztcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGNyZWF0ZWRBdDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgS2FyYW9rZUFwaVNlcnZpY2Uge1xuICBwcml2YXRlIGJhc2VVcmw6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICAvLyBVc2UgdGhlIGxvY2FsIHNlcnZlciBlbmRwb2ludFxuICAgIHRoaXMuYmFzZVVybCA9ICdodHRwOi8vbG9jYWxob3N0Ojg3ODcvYXBpJztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQga2FyYW9rZSBkYXRhIGZvciBhIHRyYWNrIElEIChZb3VUdWJlL1NvdW5kQ2xvdWQpXG4gICAqL1xuICBhc3luYyBnZXRLYXJhb2tlRGF0YShcbiAgICB0cmFja0lkOiBzdHJpbmcsIFxuICAgIHRpdGxlPzogc3RyaW5nLCBcbiAgICBhcnRpc3Q/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxLYXJhb2tlRGF0YSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xuICAgICAgaWYgKHRpdGxlKSBwYXJhbXMuc2V0KCd0aXRsZScsIHRpdGxlKTtcbiAgICAgIGlmIChhcnRpc3QpIHBhcmFtcy5zZXQoJ2FydGlzdCcsIGFydGlzdCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0va2FyYW9rZS8ke2VuY29kZVVSSUNvbXBvbmVudCh0cmFja0lkKX0ke3BhcmFtcy50b1N0cmluZygpID8gJz8nICsgcGFyYW1zLnRvU3RyaW5nKCkgOiAnJ31gO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VBcGldIEZldGNoaW5nIGthcmFva2UgZGF0YTonLCB1cmwpO1xuICAgICAgXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAvLyBSZW1vdmUgQ29udGVudC1UeXBlIGhlYWRlciB0byBhdm9pZCBDT1JTIHByZWZsaWdodFxuICAgICAgICAvLyBoZWFkZXJzOiB7XG4gICAgICAgIC8vICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgLy8gfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZmV0Y2gga2FyYW9rZSBkYXRhOicsIHJlc3BvbnNlLnN0YXR1cyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXBpXSBSZWNlaXZlZCBrYXJhb2tlIGRhdGE6JywgZGF0YSk7XG4gICAgICBcbiAgICAgIC8vIElmIHRoZXJlJ3MgYW4gZXJyb3IgYnV0IHdlIGdvdCBhIHJlc3BvbnNlLCBpdCBtZWFucyBBUEkgaXMgY29ubmVjdGVkXG4gICAgICBpZiAoZGF0YS5lcnJvcikge1xuICAgICAgICBjb25zb2xlLmxvZygnW0thcmFva2VBcGldIFNlcnZlciBlcnJvciAoYnV0IEFQSSBpcyByZWFjaGFibGUpOicsIGRhdGEuZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGhhc19rYXJhb2tlOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcjogZGF0YS5lcnJvcixcbiAgICAgICAgICB0cmFja19pZDogdHJhY2tJZCxcbiAgICAgICAgICBhcGlfY29ubmVjdGVkOiB0cnVlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRXJyb3IgZmV0Y2hpbmcga2FyYW9rZSBkYXRhOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFydCBhIGthcmFva2Ugc2Vzc2lvblxuICAgKi9cbiAgYXN5bmMgc3RhcnRTZXNzaW9uKFxuICAgIHRyYWNrSWQ6IHN0cmluZyxcbiAgICBzb25nRGF0YToge1xuICAgICAgdGl0bGU6IHN0cmluZztcbiAgICAgIGFydGlzdDogc3RyaW5nO1xuICAgICAgYWxidW0/OiBzdHJpbmc7XG4gICAgICBkdXJhdGlvbj86IG51bWJlcjtcbiAgICB9XG4gICk6IFByb21pc2U8S2FyYW9rZVNlc3Npb24gfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7dGhpcy5iYXNlVXJsfS9rYXJhb2tlL3N0YXJ0YCwge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgLy8gVE9ETzogQWRkIGF1dGggdG9rZW4gd2hlbiBhdmFpbGFibGVcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHRyYWNrSWQsXG4gICAgICAgICAgc29uZ0RhdGEsXG4gICAgICAgIH0pLFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBzdGFydCBzZXNzaW9uOicsIHJlc3BvbnNlLnN0YXR1cyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICByZXR1cm4gcmVzdWx0LnNlc3Npb247XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBFcnJvciBzdGFydGluZyBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUZXN0IGNvbm5lY3Rpb24gdG8gdGhlIEFQSVxuICAgKi9cbiAgYXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7dGhpcy5iYXNlVXJsLnJlcGxhY2UoJy9hcGknLCAnJyl9L2hlYWx0aGApO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLm9rO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gQ29ubmVjdGlvbiB0ZXN0IGZhaWxlZDonLCBlcnJvcik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBrYXJhb2tlQXBpID0gbmV3IEthcmFva2VBcGlTZXJ2aWNlKCk7IiwiaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgUHJhY3RpY2VFeGVyY2lzZVZpZXcgfSBmcm9tICdAc2NhcmxldHQvdWknO1xuXG5pbnRlcmZhY2UgUHJhY3RpY2VWaWV3UHJvcHMge1xuICBzZXNzaW9uSWQ/OiBzdHJpbmc7XG4gIG9uQmFjazogKCkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IFByYWN0aWNlVmlldzogQ29tcG9uZW50PFByYWN0aWNlVmlld1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxQcmFjdGljZUV4ZXJjaXNlVmlldyBcbiAgICAgIHNlc3Npb25JZD17cHJvcHMuc2Vzc2lvbklkfVxuICAgICAgb25CYWNrPXtwcm9wcy5vbkJhY2t9XG4gICAgICAvLyBFeHRlbnNpb24gZG9lc24ndCB1c2UgYXV0aCB5ZXRcbiAgICAgIC8vIGFwaUJhc2VVcmwgaXMgZGVmYXVsdCBsb2NhbGhvc3Q6ODc4N1xuICAgIC8+XG4gICk7XG59OyIsImltcG9ydCB7IENvbXBvbmVudCwgY3JlYXRlU2lnbmFsLCBjcmVhdGVFZmZlY3QsIG9uTW91bnQsIG9uQ2xlYW51cCwgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkthcmFva2VWaWV3LCBNaW5pbWl6ZWRLYXJhb2tlLCBDb3VudGRvd24sIENvbXBsZXRpb25WaWV3LCB1c2VLYXJhb2tlU2Vzc2lvbiwgRXh0ZW5zaW9uQXVkaW9TZXJ2aWNlLCBJMThuUHJvdmlkZXIsIHR5cGUgUGxheWJhY2tTcGVlZCB9IGZyb20gJ0BzY2FybGV0dC91aSc7XG5pbXBvcnQgeyB0cmFja0RldGVjdG9yLCB0eXBlIFRyYWNrSW5mbyB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3RyYWNrLWRldGVjdG9yJztcbmltcG9ydCB7IGdldEF1dGhUb2tlbiB9IGZyb20gJy4uLy4uL3V0aWxzL3N0b3JhZ2UnO1xuaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gJ3d4dC9icm93c2VyJztcbmltcG9ydCB7IGthcmFva2VBcGkgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9rYXJhb2tlLWFwaSc7XG5pbXBvcnQgeyBQcmFjdGljZVZpZXcgfSBmcm9tICcuL1ByYWN0aWNlVmlldyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29udGVudEFwcFByb3BzIHt9XG5cbmV4cG9ydCBjb25zdCBDb250ZW50QXBwOiBDb21wb25lbnQ8Q29udGVudEFwcFByb3BzPiA9ICgpID0+IHtcbiAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBSZW5kZXJpbmcgQ29udGVudEFwcCBjb21wb25lbnQnKTtcbiAgXG4gIC8vIFN0YXRlXG4gIGNvbnN0IFtjdXJyZW50VHJhY2ssIHNldEN1cnJlbnRUcmFja10gPSBjcmVhdGVTaWduYWw8VHJhY2tJbmZvIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFthdXRoVG9rZW4sIHNldEF1dGhUb2tlbl0gPSBjcmVhdGVTaWduYWw8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtzaG93S2FyYW9rZSwgc2V0U2hvd0thcmFva2VdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2thcmFva2VEYXRhLCBzZXRLYXJhb2tlRGF0YV0gPSBjcmVhdGVTaWduYWw8YW55PihudWxsKTtcbiAgY29uc3QgW2xvYWRpbmcsIHNldExvYWRpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3Nlc3Npb25TdGFydGVkLCBzZXRTZXNzaW9uU3RhcnRlZF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbaXNNaW5pbWl6ZWQsIHNldElzTWluaW1pemVkXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtjb3VudGRvd24sIHNldENvdW50ZG93bl0gPSBjcmVhdGVTaWduYWw8bnVtYmVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtpc1BsYXlpbmcsIHNldElzUGxheWluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbY3VycmVudFRpbWUsIHNldEN1cnJlbnRUaW1lXSA9IGNyZWF0ZVNpZ25hbCgwKTtcbiAgY29uc3QgW2F1ZGlvUmVmLCBzZXRBdWRpb1JlZl0gPSBjcmVhdGVTaWduYWw8SFRNTEF1ZGlvRWxlbWVudCB8IG51bGw+KG51bGwpO1xuICBjb25zdCBba2FyYW9rZVNlc3Npb24sIHNldEthcmFva2VTZXNzaW9uXSA9IGNyZWF0ZVNpZ25hbDxSZXR1cm5UeXBlPHR5cGVvZiB1c2VLYXJhb2tlU2Vzc2lvbj4gfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2NvbXBsZXRpb25EYXRhLCBzZXRDb21wbGV0aW9uRGF0YV0gPSBjcmVhdGVTaWduYWw8YW55PihudWxsKTtcbiAgY29uc3QgW3Nob3dQcmFjdGljZSwgc2V0U2hvd1ByYWN0aWNlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtzZWxlY3RlZFNwZWVkLCBzZXRTZWxlY3RlZFNwZWVkXSA9IGNyZWF0ZVNpZ25hbDxQbGF5YmFja1NwZWVkPignMXgnKTtcbiAgXG4gIC8vIExvYWQgYXV0aCB0b2tlbiBvbiBtb3VudFxuICBvbk1vdW50KGFzeW5jICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIExvYWRpbmcgYXV0aCB0b2tlbicpO1xuICAgIGNvbnN0IHRva2VuID0gYXdhaXQgZ2V0QXV0aFRva2VuKCk7XG4gICAgaWYgKHRva2VuKSB7XG4gICAgICBzZXRBdXRoVG9rZW4odG9rZW4pO1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBBdXRoIHRva2VuIGxvYWRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgZGVtbyB0b2tlbiBmb3IgZGV2ZWxvcG1lbnRcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTm8gYXV0aCB0b2tlbiBmb3VuZCwgdXNpbmcgZGVtbyB0b2tlbicpO1xuICAgICAgc2V0QXV0aFRva2VuKCdzY2FybGV0dF9kZW1vX3Rva2VuXzEyMycpO1xuICAgIH1cbiAgICBcbiAgICAvLyBTdGFydCB3YXRjaGluZyBmb3IgdHJhY2sgY2hhbmdlc1xuICAgIGNvbnN0IGNsZWFudXAgPSB0cmFja0RldGVjdG9yLndhdGNoRm9yQ2hhbmdlcygodHJhY2spID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gVHJhY2sgY2hhbmdlZDonLCB0cmFjayk7XG4gICAgICBzZXRDdXJyZW50VHJhY2sodHJhY2spO1xuICAgICAgLy8gU2hvdyBrYXJhb2tlIHdoZW4gdHJhY2sgaXMgZGV0ZWN0ZWQgYW5kIGZldGNoIGRhdGFcbiAgICAgIGlmICh0cmFjaykge1xuICAgICAgICBzZXRTaG93S2FyYW9rZSh0cnVlKTtcbiAgICAgICAgZmV0Y2hLYXJhb2tlRGF0YSh0cmFjayk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBvbkNsZWFudXAoY2xlYW51cCk7XG4gIH0pO1xuXG4gIGNvbnN0IGZldGNoS2FyYW9rZURhdGEgPSBhc3luYyAodHJhY2s6IFRyYWNrSW5mbykgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRmV0Y2hpbmcga2FyYW9rZSBkYXRhIGZvciB0cmFjazonLCB0cmFjayk7XG4gICAgc2V0TG9hZGluZyh0cnVlKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGthcmFva2VBcGkuZ2V0S2FyYW9rZURhdGEoXG4gICAgICAgIHRyYWNrLnRyYWNrSWQsXG4gICAgICAgIHRyYWNrLnRpdGxlLFxuICAgICAgICB0cmFjay5hcnRpc3RcbiAgICAgICk7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEthcmFva2UgZGF0YSBsb2FkZWQ6JywgZGF0YSk7XG4gICAgICBzZXRLYXJhb2tlRGF0YShkYXRhKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0NvbnRlbnRBcHBdIEZhaWxlZCB0byBmZXRjaCBrYXJhb2tlIGRhdGE6JywgZXJyb3IpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRMb2FkaW5nKGZhbHNlKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlU3RhcnQgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTdGFydCBrYXJhb2tlIHNlc3Npb24nKTtcbiAgICBzZXRTZXNzaW9uU3RhcnRlZCh0cnVlKTtcbiAgICBcbiAgICBjb25zdCBkYXRhID0ga2FyYW9rZURhdGEoKTtcbiAgICBjb25zdCBhdWRpbyA9IGF1ZGlvUmVmKCk7XG4gICAgY29uc3QgdHJhY2sgPSBjdXJyZW50VHJhY2soKTtcbiAgICBcbiAgICBpZiAoZGF0YSAmJiB0cmFjayAmJiBkYXRhLmx5cmljcz8ubGluZXMpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQ3JlYXRpbmcga2FyYW9rZSBzZXNzaW9uIHdpdGggYXVkaW8gY2FwdHVyZScsIHtcbiAgICAgICAgdHJhY2tJZDogdHJhY2suaWQsXG4gICAgICAgIHRyYWNrVGl0bGU6IHRyYWNrLnRpdGxlLFxuICAgICAgICBzb25nRGF0YTogZGF0YS5zb25nLFxuICAgICAgICBoYXNMeXJpY3M6ICEhZGF0YS5seXJpY3M/LmxpbmVzXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gQ3JlYXRlIGFuZCBzdGFydCBzZXNzaW9uXG4gICAgICBjb25zdCBuZXdTZXNzaW9uID0gdXNlS2FyYW9rZVNlc3Npb24oe1xuICAgICAgICBseXJpY3M6IGRhdGEubHlyaWNzLmxpbmVzLFxuICAgICAgICB0cmFja0lkOiB0cmFjay50cmFja0lkLFxuICAgICAgICBzb25nRGF0YTogZGF0YS5zb25nID8ge1xuICAgICAgICAgIHRpdGxlOiBkYXRhLnNvbmcudGl0bGUsXG4gICAgICAgICAgYXJ0aXN0OiBkYXRhLnNvbmcuYXJ0aXN0LFxuICAgICAgICAgIGFsYnVtOiBkYXRhLnNvbmcuYWxidW0sXG4gICAgICAgICAgZHVyYXRpb246IGRhdGEuc29uZy5kdXJhdGlvblxuICAgICAgICB9IDoge1xuICAgICAgICAgIHRpdGxlOiB0cmFjay50aXRsZSxcbiAgICAgICAgICBhcnRpc3Q6IHRyYWNrLmFydGlzdFxuICAgICAgICB9LFxuICAgICAgICBzb25nQ2F0YWxvZ0lkOiBkYXRhLnNvbmdfY2F0YWxvZ19pZCxcbiAgICAgICAgYXVkaW9FbGVtZW50OiB1bmRlZmluZWQsIC8vIFdpbGwgYmUgc2V0IHdoZW4gYXVkaW8gc3RhcnRzIHBsYXlpbmdcbiAgICAgICAgYXBpVXJsOiAnaHR0cDovL2xvY2FsaG9zdDo4Nzg3L2FwaScsXG4gICAgICAgIG9uQ29tcGxldGU6IChyZXN1bHRzKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBLYXJhb2tlIHNlc3Npb24gY29tcGxldGVkOicsIHJlc3VsdHMpO1xuICAgICAgICAgIHNldFNlc3Npb25TdGFydGVkKGZhbHNlKTtcbiAgICAgICAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgICAgICAgIHNldENvbXBsZXRpb25EYXRhKHJlc3VsdHMpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIFN0b3AgYXVkaW8gcGxheWJhY2tcbiAgICAgICAgICBjb25zdCBhdWRpbyA9IGF1ZGlvUmVmKCk7XG4gICAgICAgICAgaWYgKGF1ZGlvKSB7XG4gICAgICAgICAgICBhdWRpby5wYXVzZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIEFwcGx5IHRoZSBzZWxlY3RlZCBzcGVlZCB0byB0aGUgbmV3IHNlc3Npb25cbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXBwbHlpbmcgc2VsZWN0ZWQgc3BlZWQgdG8gbmV3IHNlc3Npb246Jywgc2VsZWN0ZWRTcGVlZCgpKTtcbiAgICAgIG5ld1Nlc3Npb24uaGFuZGxlU3BlZWRDaGFuZ2Uoc2VsZWN0ZWRTcGVlZCgpKTtcbiAgICAgIFxuICAgICAgc2V0S2FyYW9rZVNlc3Npb24obmV3U2Vzc2lvbik7XG4gICAgICBcbiAgICAgIC8vIFN0YXJ0IHRoZSBzZXNzaW9uIChpbmNsdWRlcyBjb3VudGRvd24gYW5kIGF1ZGlvIGluaXRpYWxpemF0aW9uKVxuICAgICAgYXdhaXQgbmV3U2Vzc2lvbi5zdGFydFNlc3Npb24oKTtcbiAgICAgIFxuICAgICAgLy8gV2F0Y2ggZm9yIGNvdW50ZG93biB0byBmaW5pc2ggYW5kIHN0YXJ0IGF1ZGlvXG4gICAgICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgICAgICBpZiAobmV3U2Vzc2lvbi5jb3VudGRvd24oKSA9PT0gbnVsbCAmJiBuZXdTZXNzaW9uLmlzUGxheWluZygpICYmICFpc1BsYXlpbmcoKSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQ291bnRkb3duIGZpbmlzaGVkLCBzdGFydGluZyBhdWRpbyBwbGF5YmFjaycpO1xuICAgICAgICAgIHN0YXJ0QXVkaW9QbGF5YmFjaygpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBVcGRhdGUgc2Vzc2lvbiB3aXRoIGF1ZGlvIGVsZW1lbnQgd2hlbiBhdmFpbGFibGVcbiAgICAgICAgY29uc3QgYXVkaW8gPSBhdWRpb1JlZigpO1xuICAgICAgICBpZiAoYXVkaW8gJiYgbmV3U2Vzc2lvbikge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU2V0dGluZyBhdWRpbyBlbGVtZW50IG9uIG5ldyBzZXNzaW9uJyk7XG4gICAgICAgICAgbmV3U2Vzc2lvbi5zZXRBdWRpb0VsZW1lbnQoYXVkaW8pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGYWxsYmFjayB0byBzaW1wbGUgY291bnRkb3duJyk7XG4gICAgICAvLyBGYWxsYmFjayB0byBvbGQgYmVoYXZpb3JcbiAgICAgIHNldENvdW50ZG93bigzKTtcbiAgICAgIFxuICAgICAgY29uc3QgY291bnRkb3duSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSBjb3VudGRvd24oKTtcbiAgICAgICAgaWYgKGN1cnJlbnQgIT09IG51bGwgJiYgY3VycmVudCA+IDEpIHtcbiAgICAgICAgICBzZXRDb3VudGRvd24oY3VycmVudCAtIDEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNsZWFySW50ZXJ2YWwoY291bnRkb3duSW50ZXJ2YWwpO1xuICAgICAgICAgIHNldENvdW50ZG93bihudWxsKTtcbiAgICAgICAgICBzdGFydEF1ZGlvUGxheWJhY2soKTtcbiAgICAgICAgfVxuICAgICAgfSwgMTAwMCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IHN0YXJ0QXVkaW9QbGF5YmFjayA9ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFN0YXJ0aW5nIGF1ZGlvIHBsYXliYWNrJyk7XG4gICAgc2V0SXNQbGF5aW5nKHRydWUpO1xuICAgIFxuICAgIC8vIFRyeSBtdWx0aXBsZSBtZXRob2RzIHRvIGZpbmQgYW5kIHBsYXkgYXVkaW9cbiAgICAvLyBNZXRob2QgMTogTG9vayBmb3IgYXVkaW8gZWxlbWVudHNcbiAgICBjb25zdCBhdWRpb0VsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnYXVkaW8nKTtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZvdW5kIGF1ZGlvIGVsZW1lbnRzOicsIGF1ZGlvRWxlbWVudHMubGVuZ3RoKTtcbiAgICBcbiAgICBpZiAoYXVkaW9FbGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBhdWRpbyA9IGF1ZGlvRWxlbWVudHNbMF0gYXMgSFRNTEF1ZGlvRWxlbWVudDtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXVkaW8gZWxlbWVudDonLCB7XG4gICAgICAgIHNyYzogYXVkaW8uc3JjLFxuICAgICAgICBwYXVzZWQ6IGF1ZGlvLnBhdXNlZCxcbiAgICAgICAgZHVyYXRpb246IGF1ZGlvLmR1cmF0aW9uLFxuICAgICAgICBjdXJyZW50VGltZTogYXVkaW8uY3VycmVudFRpbWVcbiAgICAgIH0pO1xuICAgICAgc2V0QXVkaW9SZWYoYXVkaW8pO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUga2FyYW9rZSBzZXNzaW9uIHdpdGggYXVkaW8gZWxlbWVudCBpZiBpdCBleGlzdHNcbiAgICAgIGNvbnN0IHNlc3Npb24gPSBrYXJhb2tlU2Vzc2lvbigpO1xuICAgICAgaWYgKHNlc3Npb24pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTZXR0aW5nIGF1ZGlvIGVsZW1lbnQgb24ga2FyYW9rZSBzZXNzaW9uJyk7XG4gICAgICAgIHNlc3Npb24uc2V0QXVkaW9FbGVtZW50KGF1ZGlvKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghc2Vzc2lvbi5hdWRpb1Byb2Nlc3Nvci5pc1JlYWR5KCkpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEluaXRpYWxpemluZyBhdWRpbyBwcm9jZXNzb3IgZm9yIHNlc3Npb24nKTtcbiAgICAgICAgICBzZXNzaW9uLmF1ZGlvUHJvY2Vzc29yLmluaXRpYWxpemUoKS5jYXRjaChjb25zb2xlLmVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBUcnkgdG8gcGxheSB0aGUgYXVkaW9cbiAgICAgIGF1ZGlvLnBsYXkoKS50aGVuKCgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBBdWRpbyBzdGFydGVkIHBsYXlpbmcgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICB9KS5jYXRjaChlcnIgPT4ge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbQ29udGVudEFwcF0gRmFpbGVkIHRvIHBsYXkgYXVkaW86JywgZXJyKTtcbiAgICAgICAgXG4gICAgICAgIC8vIE1ldGhvZCAyOiBUcnkgY2xpY2tpbmcgdGhlIHBsYXkgYnV0dG9uIG9uIHRoZSBwYWdlXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXR0ZW1wdGluZyB0byBjbGljayBwbGF5IGJ1dHRvbi4uLicpO1xuICAgICAgICBjb25zdCBwbGF5QnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYnV0dG9uW3RpdGxlKj1cIlBsYXlcIl0sIGJ1dHRvblthcmlhLWxhYmVsKj1cIlBsYXlcIl0sIC5wbGF5Q29udHJvbCwgLnBsYXlCdXR0b24sIFtjbGFzcyo9XCJwbGF5LWJ1dHRvblwiXScpO1xuICAgICAgICBpZiAocGxheUJ1dHRvbikge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRm91bmQgcGxheSBidXR0b24sIGNsaWNraW5nIGl0Jyk7XG4gICAgICAgICAgKHBsYXlCdXR0b24gYXMgSFRNTEVsZW1lbnQpLmNsaWNrKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgY3VycmVudCB0aW1lXG4gICAgICBjb25zdCB1cGRhdGVUaW1lID0gKCkgPT4ge1xuICAgICAgICBzZXRDdXJyZW50VGltZShhdWRpby5jdXJyZW50VGltZSk7XG4gICAgICB9O1xuICAgICAgXG4gICAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdXBkYXRlVGltZSk7XG4gICAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsICgpID0+IHtcbiAgICAgICAgc2V0SXNQbGF5aW5nKGZhbHNlKTtcbiAgICAgICAgYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIHVwZGF0ZVRpbWUpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE1ldGhvZCAzOiBUcnkgU291bmRDbG91ZCBzcGVjaWZpYyBzZWxlY3RvcnNcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTm8gYXVkaW8gZWxlbWVudHMgZm91bmQsIHRyeWluZyBTb3VuZENsb3VkLXNwZWNpZmljIGFwcHJvYWNoJyk7XG4gICAgICBjb25zdCBwbGF5QnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnBsYXlDb250cm9sLCAuc2MtYnV0dG9uLXBsYXksIGJ1dHRvblt0aXRsZSo9XCJQbGF5XCJdJyk7XG4gICAgICBpZiAocGxheUJ1dHRvbikge1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZvdW5kIFNvdW5kQ2xvdWQgcGxheSBidXR0b24sIGNsaWNraW5nIGl0Jyk7XG4gICAgICAgIChwbGF5QnV0dG9uIGFzIEhUTUxFbGVtZW50KS5jbGljaygpO1xuICAgICAgICBcbiAgICAgICAgLy8gV2FpdCBhIGJpdCBhbmQgdGhlbiBsb29rIGZvciBhdWRpbyBlbGVtZW50IGFnYWluXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IG5ld0F1ZGlvRWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdhdWRpbycpO1xuICAgICAgICAgIGlmIChuZXdBdWRpb0VsZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRm91bmQgYXVkaW8gZWxlbWVudCBhZnRlciBjbGlja2luZyBwbGF5Jyk7XG4gICAgICAgICAgICBjb25zdCBhdWRpbyA9IG5ld0F1ZGlvRWxlbWVudHNbMF0gYXMgSFRNTEF1ZGlvRWxlbWVudDtcbiAgICAgICAgICAgIHNldEF1ZGlvUmVmKGF1ZGlvKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVXBkYXRlIGN1cnJlbnQgdGltZVxuICAgICAgICAgICAgY29uc3QgdXBkYXRlVGltZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgc2V0Q3VycmVudFRpbWUoYXVkaW8uY3VycmVudFRpbWUpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIHVwZGF0ZVRpbWUpO1xuICAgICAgICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgICAgICAgICAgIGF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB1cGRhdGVUaW1lKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgNTAwKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlQ2xvc2UgPSAoKSA9PiB7XG4gICAgLy8gU3RvcCBzZXNzaW9uIGlmIGFjdGl2ZVxuICAgIGNvbnN0IHNlc3Npb24gPSBrYXJhb2tlU2Vzc2lvbigpO1xuICAgIGlmIChzZXNzaW9uKSB7XG4gICAgICBzZXNzaW9uLnN0b3BTZXNzaW9uKCk7XG4gICAgfVxuICAgIFxuICAgIHNldFNob3dLYXJhb2tlKGZhbHNlKTtcbiAgICBzZXRLYXJhb2tlRGF0YShudWxsKTtcbiAgICBzZXRTZXNzaW9uU3RhcnRlZChmYWxzZSk7XG4gICAgc2V0S2FyYW9rZVNlc3Npb24obnVsbCk7XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlTWluaW1pemUgPSAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBNaW5pbWl6ZSBrYXJhb2tlIHdpZGdldCcpO1xuICAgIHNldElzTWluaW1pemVkKHRydWUpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVJlc3RvcmUgPSAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBSZXN0b3JlIGthcmFva2Ugd2lkZ2V0Jyk7XG4gICAgc2V0SXNNaW5pbWl6ZWQoZmFsc2UpO1xuICB9O1xuXG4gIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUmVuZGVyIHN0YXRlOicsIHtcbiAgICBzaG93S2FyYW9rZTogc2hvd0thcmFva2UoKSxcbiAgICBjdXJyZW50VHJhY2s6IGN1cnJlbnRUcmFjaygpLFxuICAgIGthcmFva2VEYXRhOiBrYXJhb2tlRGF0YSgpLFxuICAgIGxvYWRpbmc6IGxvYWRpbmcoKVxuICB9KTtcblxuXG4gIHJldHVybiAoXG4gICAgPD5cbiAgICAgIHsvKiBNaW5pbWl6ZWQgc3RhdGUgKi99XG4gICAgICA8U2hvdyB3aGVuPXtzaG93S2FyYW9rZSgpICYmIGN1cnJlbnRUcmFjaygpICYmIGlzTWluaW1pemVkKCl9PlxuICAgICAgICA8TWluaW1pemVkS2FyYW9rZSBvbkNsaWNrPXtoYW5kbGVSZXN0b3JlfSAvPlxuICAgICAgPC9TaG93PlxuXG4gICAgICB7LyogRnVsbCB3aWRnZXQgc3RhdGUgKi99XG4gICAgICA8U2hvdyB3aGVuPXtzaG93S2FyYW9rZSgpICYmIGN1cnJlbnRUcmFjaygpICYmICFpc01pbmltaXplZCgpfSBmYWxsYmFjaz17XG4gICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ25vbmUnIH19PlxuICAgICAgICAgIHtjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE5vdCBzaG93aW5nIC0gc2hvd0thcmFva2U6Jywgc2hvd0thcmFva2UoKSwgJ2N1cnJlbnRUcmFjazonLCBjdXJyZW50VHJhY2soKSl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgfT5cbiAgICAgICAgPGRpdiBzdHlsZT17e1xuICAgICAgICAgIHBvc2l0aW9uOiAnZml4ZWQnLFxuICAgICAgICAgIHRvcDogJzIwcHgnLFxuICAgICAgICAgIHJpZ2h0OiAnMjBweCcsXG4gICAgICAgICAgYm90dG9tOiAnMjBweCcsXG4gICAgICAgICAgd2lkdGg6ICc0ODBweCcsXG4gICAgICAgICAgJ3otaW5kZXgnOiAnOTk5OTknLFxuICAgICAgICAgIG92ZXJmbG93OiAnaGlkZGVuJyxcbiAgICAgICAgICAnYm9yZGVyLXJhZGl1cyc6ICcxNnB4JyxcbiAgICAgICAgICAnYm94LXNoYWRvdyc6ICcwIDI1cHggNTBweCAtMTJweCByZ2JhKDAsIDAsIDAsIDAuNiknLFxuICAgICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcbiAgICAgICAgICAnZmxleC1kaXJlY3Rpb24nOiAnY29sdW1uJ1xuICAgICAgICB9fT5cbiAgICAgICAgICB7Y29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBSZW5kZXJpbmcgd2l0aCBjb21wbGV0aW9uIGRhdGE6JywgY29tcGxldGlvbkRhdGEoKSl9XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImgtZnVsbCBiZy1zdXJmYWNlIHJvdW5kZWQtMnhsIG92ZXJmbG93LWhpZGRlbiBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICB7LyogSGVhZGVyIHdpdGggbWluaW1pemUgYW5kIGNsb3NlIGJ1dHRvbnMgKi99XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1lbmQgcC0yIGJnLXN1cmZhY2UgYm9yZGVyLWIgYm9yZGVyLXN1YnRsZVwiIHN0eWxlPXt7IGhlaWdodDogJzQ4cHgnIH19PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtzaG93UHJhY3RpY2UoKX0+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dQcmFjdGljZShmYWxzZSl9XG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy0xMCBoLTEwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbGcgdHJhbnNpdGlvbi1jb2xvcnMgaG92ZXI6Ymctd2hpdGUvMTBcIlxuICAgICAgICAgICAgICAgICAgICBzdHlsZT17eyBjb2xvcjogJyNhOGE4YTgnIH19XG4gICAgICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCJDbG9zZSBQcmFjdGljZVwiXG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIDxzdmcgd2lkdGg9XCIyMFwiIGhlaWdodD1cIjIwXCIgdmlld0JveD1cIjAgMCAyMCAyMFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPlxuICAgICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9XCJNMTUgNUw1IDE1TTUgNUwxNSAxNVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIi8+XG4gICAgICAgICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZU1pbmltaXplfVxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LTEwIGgtMTAgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1sZyB0cmFuc2l0aW9uLWNvbG9ycyBob3ZlcjpiZy13aGl0ZS8xMFwiXG4gICAgICAgICAgICAgICAgICBzdHlsZT17eyBjb2xvcjogJyNhOGE4YTgnIH19XG4gICAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiTWluaW1pemVcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxzdmcgd2lkdGg9XCIyNFwiIGhlaWdodD1cIjI0XCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPlxuICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPVwiTTYgMTJoMTJcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIzXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiLz5cbiAgICAgICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgXG4gICAgICAgICAgICB7LyogTWFpbiBjb250ZW50IGFyZWEgKi99XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIG1pbi1oLTAgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICAgIDxTaG93IHdoZW49e2NvbXBsZXRpb25EYXRhKCl9IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXshbG9hZGluZygpfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgaC1mdWxsIGJnLWJhc2VcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFuaW1hdGUtc3BpbiByb3VuZGVkLWZ1bGwgaC0xMiB3LTEyIGJvcmRlci1iLTIgYm9yZGVyLWFjY2VudC1wcmltYXJ5IG14LWF1dG8gbWItNFwiPjwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zZWNvbmRhcnlcIj5Mb2FkaW5nIGx5cmljcy4uLjwvcD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICB9PlxuICAgICAgICAgICAgICAgICAgPFNob3cgd2hlbj17a2FyYW9rZURhdGEoKT8ubHlyaWNzPy5saW5lc30gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgaC1mdWxsIHAtOFwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5IG1iLTJcIj5ObyBseXJpY3MgYXZhaWxhYmxlPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtdGVydGlhcnlcIj5UcnkgYSBkaWZmZXJlbnQgc29uZzwvcD5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICB9PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaC1mdWxsIGZsZXggZmxleC1jb2xcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIG1pbi1oLTAgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8RXh0ZW5zaW9uS2FyYW9rZVZpZXdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcmU9e2thcmFva2VTZXNzaW9uKCkgPyBrYXJhb2tlU2Vzc2lvbigpIS5zY29yZSgpIDogMH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmFuaz17MX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgbHlyaWNzPXtrYXJhb2tlRGF0YSgpPy5seXJpY3M/LmxpbmVzIHx8IFtdfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50VGltZT17a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLmN1cnJlbnRUaW1lKCkgOiBjdXJyZW50VGltZSgpICogMTAwMH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgbGVhZGVyYm9hcmQ9e1tdfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBpc1BsYXlpbmc9e2thcmFva2VTZXNzaW9uKCkgPyAoa2FyYW9rZVNlc3Npb24oKSEuaXNQbGF5aW5nKCkgfHwga2FyYW9rZVNlc3Npb24oKSEuY291bnRkb3duKCkgIT09IG51bGwpIDogKGlzUGxheWluZygpIHx8IGNvdW50ZG93bigpICE9PSBudWxsKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25TdGFydD17aGFuZGxlU3RhcnR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uU3BlZWRDaGFuZ2U9eyhzcGVlZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU3BlZWQgY2hhbmdlZDonLCBzcGVlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2VsZWN0ZWRTcGVlZChzcGVlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2Vzc2lvbiA9IGthcmFva2VTZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNlc3Npb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXBwbHlpbmcgc3BlZWQgY2hhbmdlIHRvIHNlc3Npb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlc3Npb24uaGFuZGxlU3BlZWRDaGFuZ2Uoc3BlZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE5vIHNlc3Npb24geWV0LCBzcGVlZCB3aWxsIGJlIGFwcGxpZWQgd2hlbiBzZXNzaW9uIHN0YXJ0cycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbHNvIGFwcGx5IHRvIGF1ZGlvIGVsZW1lbnQgZGlyZWN0bHkgaWYgaXQgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXVkaW8gPSBhdWRpb1JlZigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhdWRpbykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmF0ZSA9IHNwZWVkID09PSAnMC41eCcgPyAwLjUgOiBzcGVlZCA9PT0gJzAuNzV4JyA/IDAuNzUgOiAxLjA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFNldHRpbmcgYXVkaW8gcGxheWJhY2sgcmF0ZSBkaXJlY3RseSB0bzonLCByYXRlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF1ZGlvLnBsYXliYWNrUmF0ZSA9IHJhdGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICBpc1JlY29yZGluZz17a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLmlzUmVjb3JkaW5nKCkgOiBmYWxzZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgbGluZVNjb3Jlcz17a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLmxpbmVTY29yZXMoKSA6IFtdfVxuICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICB7LyogQ291bnRkb3duIG92ZXJsYXkgKi99XG4gICAgICAgICAgICAgICAgICAgICAgPFNob3cgd2hlbj17a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLmNvdW50ZG93bigpICE9PSBudWxsIDogY291bnRkb3duKCkgIT09IG51bGx9PlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFic29sdXRlIGluc2V0LTAgYmctYmxhY2svODAgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgei01MFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC04eGwgZm9udC1ib2xkIHRleHQtd2hpdGUgYW5pbWF0ZS1wdWxzZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2thcmFva2VTZXNzaW9uKCkgPyBrYXJhb2tlU2Vzc2lvbigpIS5jb3VudGRvd24oKSA6IGNvdW50ZG93bigpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC14bCB0ZXh0LXdoaXRlLzgwIG10LTRcIj5HZXQgcmVhZHkhPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICB9PlxuICAgICAgICAgICAgICAgIHsvKiBDb21wbGV0aW9uIFZpZXcgb3IgUHJhY3RpY2UgVmlldyAqL31cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtzaG93UHJhY3RpY2UoKX0gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgICAgPEkxOG5Qcm92aWRlcj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImgtZnVsbCBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPFNob3cgd2hlbj17IWNvbXBsZXRpb25EYXRhKCkuaXNMb2FkaW5nfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgaC1mdWxsIGJnLWJhc2VcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFuaW1hdGUtc3BpbiByb3VuZGVkLWZ1bGwgaC0xNiB3LTE2IGJvcmRlci1iLTIgYm9yZGVyLWFjY2VudC1wcmltYXJ5IG14LWF1dG8gbWItNFwiPjwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeVwiPkNhbGN1bGF0aW5nIHlvdXIgZmluYWwgc2NvcmUuLi48L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtdGVydGlhcnkgbXQtMlwiPkFuYWx5emluZyBmdWxsIHBlcmZvcm1hbmNlPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgICAgICAgICAgICA8Q29tcGxldGlvblZpZXdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJoLWZ1bGxcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICBzY29yZT17Y29tcGxldGlvbkRhdGEoKS5zY29yZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmFuaz17MX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgc3BlZWQ9e3NlbGVjdGVkU3BlZWQoKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmVlZGJhY2tUZXh0PXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0aW9uRGF0YSgpLnNjb3JlID49IDk1ID8gXCJQZXJmZWN0ISBZb3UgbmFpbGVkIGl0IVwiIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0aW9uRGF0YSgpLnNjb3JlID49IDg1ID8gXCJFeGNlbGxlbnQgcGVyZm9ybWFuY2UhXCIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRpb25EYXRhKCkuc2NvcmUgPj0gNzAgPyBcIkdyZWF0IGpvYiFcIiA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGlvbkRhdGEoKS5zY29yZSA+PSA1MCA/IFwiR29vZCBlZmZvcnQhXCIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiS2VlcCBwcmFjdGljaW5nIVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25QcmFjdGljZT17KCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUHJhY3RpY2UgZXJyb3JzIGNsaWNrZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTaG93UHJhY3RpY2UodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L0kxOG5Qcm92aWRlcj5cbiAgICAgICAgICAgICAgICB9PlxuICAgICAgICAgICAgICAgICAgey8qIFByYWN0aWNlIFZpZXcgKi99XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaC1mdWxsIG92ZXJmbG93LXktYXV0b1wiPlxuICAgICAgICAgICAgICAgICAgICA8UHJhY3RpY2VWaWV3XG4gICAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbklkPXtjb21wbGV0aW9uRGF0YSgpPy5zZXNzaW9uSWR9XG4gICAgICAgICAgICAgICAgICAgICAgb25CYWNrPXsoKSA9PiBzZXRTaG93UHJhY3RpY2UoZmFsc2UpfVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L1Nob3c+XG4gICAgPC8+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNoYWRvd1Jvb3RVaSB9IGZyb20gJ3d4dC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdCc7XG5pbXBvcnQgeyBkZWZpbmVDb250ZW50U2NyaXB0IH0gZnJvbSAnd3h0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdCc7XG5pbXBvcnQgdHlwZSB7IENvbnRlbnRTY3JpcHRDb250ZXh0IH0gZnJvbSAnd3h0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQnO1xuaW1wb3J0IHsgcmVuZGVyIH0gZnJvbSAnc29saWQtanMvd2ViJztcbmltcG9ydCB7IENvbnRlbnRBcHAgfSBmcm9tICcuLi9zcmMvdmlld3MvY29udGVudC9Db250ZW50QXBwJztcbmltcG9ydCAnLi4vc3JjL3N0eWxlcy9leHRlbnNpb24uY3NzJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFsnKjovL3NvdW5kY2xvdWQuY29tLyonLCAnKjovL3NvdW5kY2xvYWsuY29tLyonLCAnKjovL3NjLm1haWQuem9uZS8qJywgJyo6Ly8qLm1haWQuem9uZS8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gIGNzc0luamVjdGlvbk1vZGU6ICd1aScsXG5cbiAgYXN5bmMgbWFpbihjdHg6IENvbnRlbnRTY3JpcHRDb250ZXh0KSB7XG4gICAgLy8gT25seSBydW4gaW4gdG9wLWxldmVsIGZyYW1lIHRvIGF2b2lkIGR1cGxpY2F0ZSBwcm9jZXNzaW5nIGluIGlmcmFtZXNcbiAgICBpZiAod2luZG93LnRvcCAhPT0gd2luZG93LnNlbGYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgc2hhZG93IERPTSBhbmQgbW91bnQga2FyYW9rZSB3aWRnZXRcbiAgICBjb25zdCB1aSA9IGF3YWl0IGNyZWF0ZVNoYWRvd1Jvb3RVaShjdHgsIHtcbiAgICAgIG5hbWU6ICdzY2FybGV0dC1rYXJhb2tlLXVpJyxcbiAgICAgIHBvc2l0aW9uOiAnb3ZlcmxheScsXG4gICAgICBhbmNob3I6ICdib2R5JyxcbiAgICAgIG9uTW91bnQ6IGFzeW5jIChjb250YWluZXI6IEhUTUxFbGVtZW50KSA9PiB7XG4gICAgICAgIC8vIENyZWF0ZSB3cmFwcGVyIGRpdiAoQ29udGVudEFwcCB3aWxsIGhhbmRsZSBwb3NpdGlvbmluZyBiYXNlZCBvbiBzdGF0ZSlcbiAgICAgICAgY29uc3Qgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICB3cmFwcGVyLmNsYXNzTmFtZSA9ICdrYXJhb2tlLXdpZGdldC1jb250YWluZXInO1xuICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQod3JhcHBlcik7XG5cbiAgICAgICAgLy8gUmVuZGVyIENvbnRlbnRBcHAgY29tcG9uZW50ICh3aGljaCB1c2VzIEV4dGVuc2lvbkthcmFva2VWaWV3KVxuICAgICAgICBjb25zdCBkaXNwb3NlID0gcmVuZGVyKCgpID0+IDxDb250ZW50QXBwIC8+LCB3cmFwcGVyKTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiBkaXNwb3NlO1xuICAgICAgfSxcbiAgICAgIG9uUmVtb3ZlOiAoY2xlYW51cD86ICgpID0+IHZvaWQpID0+IHtcbiAgICAgICAgY2xlYW51cD8uKCk7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gTW91bnQgdGhlIFVJXG4gICAgdWkubW91bnQoKTtcbiAgfSxcbn0pOyIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIiwiaW1wb3J0IGNvbW1vbiBmcm9tICcuL2NvbW1vbi5qc29uJztcbmltcG9ydCBrYXJhb2tlIGZyb20gJy4va2FyYW9rZS5qc29uJztcbmltcG9ydCBkaXNwbGF5IGZyb20gJy4vZGlzcGxheS5qc29uJztcbmltcG9ydCB0eXBlIHsgVHJhbnNsYXRpb25zIH0gZnJvbSAnLi4vLi4vdHlwZXMnO1xuXG5jb25zdCB0cmFuc2xhdGlvbnM6IFRyYW5zbGF0aW9ucyA9IHtcbiAgY29tbW9uLFxuICBrYXJhb2tlLFxuICBkaXNwbGF5LFxufTtcblxuZXhwb3J0IGRlZmF1bHQgdHJhbnNsYXRpb25zOyIsImltcG9ydCBjb21tb24gZnJvbSAnLi9jb21tb24uanNvbic7XG5pbXBvcnQga2FyYW9rZSBmcm9tICcuL2thcmFva2UuanNvbic7XG5pbXBvcnQgZGlzcGxheSBmcm9tICcuL2Rpc3BsYXkuanNvbic7XG5pbXBvcnQgdHlwZSB7IFRyYW5zbGF0aW9ucyB9IGZyb20gJy4uLy4uL3R5cGVzJztcblxuY29uc3QgdHJhbnNsYXRpb25zOiBUcmFuc2xhdGlvbnMgPSB7XG4gIGNvbW1vbixcbiAga2FyYW9rZSxcbiAgZGlzcGxheSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHRyYW5zbGF0aW9uczsiXSwibmFtZXMiOlsidmFsdWUiLCJlcnJvciIsImNoaWxkcmVuIiwibWVtbyIsImluZGV4IiwicmVzdWx0IiwiaSIsInNvdXJjZXMiLCJkaXNwb3NlIiwiZG9jdW1lbnQiLCJhZGRFdmVudExpc3RlbmVyIiwiYnJvd3NlciIsIl9icm93c2VyIiwiaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSIsInN0eWxlIiwicHJpbnQiLCJsb2dnZXIiLCJfYSIsIl9iIiwicmVtb3ZlRGV0ZWN0b3IiLCJtb3VudERldGVjdG9yIiwiZGVmaW5pdGlvbiIsIl8kZGVsZWdhdGVFdmVudHMiLCJTY29yZVBhbmVsIiwicHJvcHMiLCJfZWwkIiwiX3RtcGwkIiwiX2VsJDIiLCJmaXJzdENoaWxkIiwiX2VsJDMiLCJfZWwkNCIsIm5leHRTaWJsaW5nIiwiX2VsJDUiLCJfJGluc2VydCIsInNjb3JlIiwicmFuayIsIl8kY2xhc3NOYW1lIiwiY24iLCJjbGFzcyIsIkJ1dHRvbiIsImxvY2FsIiwib3RoZXJzIiwic3BsaXRQcm9wcyIsInZhcmlhbnQiLCJzaXplIiwiX3RtcGwkMyIsIl8kc3ByZWFkIiwiXyRtZXJnZVByb3BzIiwiZGlzYWJsZWQiLCJsb2FkaW5nIiwiZnVsbFdpZHRoIiwiXyRjcmVhdGVDb21wb25lbnQiLCJTaG93Iiwid2hlbiIsImxlZnRJY29uIiwiX3RtcGwkMiIsInJpZ2h0SWNvbiIsIkx5cmljc0Rpc3BsYXkiLCJjdXJyZW50TGluZUluZGV4Iiwic2V0Q3VycmVudExpbmVJbmRleCIsImNyZWF0ZVNpZ25hbCIsImNvbnRhaW5lclJlZiIsImdldExpbmVTY29yZSIsImxpbmVJbmRleCIsImxpbmVTY29yZXMiLCJmaW5kIiwicyIsImdldFNjb3JlU3R5bGUiLCJjb2xvciIsImNyZWF0ZUVmZmVjdCIsImN1cnJlbnRUaW1lIiwibHlyaWNzIiwibGVuZ3RoIiwidGltZSIsIlRJTUlOR19PRkZTRVQiLCJhZGp1c3RlZFRpbWUiLCJmb3VuZEluZGV4IiwibGluZSIsImVuZFRpbWUiLCJzdGFydFRpbWUiLCJkdXJhdGlvbiIsInByZXZJbmRleCIsIk1hdGgiLCJhYnMiLCJjb25zb2xlIiwibG9nIiwiZnJvbSIsInRvIiwidGltZUluU2Vjb25kcyIsImp1bXAiLCJ3YXJuIiwiZnJvbUxpbmUiLCJ0b0xpbmUiLCJpc1BsYXlpbmciLCJsaW5lRWxlbWVudHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwiY3VycmVudEVsZW1lbnQiLCJjb250YWluZXJIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJsaW5lVG9wIiwib2Zmc2V0VG9wIiwibGluZUhlaWdodCIsIm9mZnNldEhlaWdodCIsInRhcmdldFNjcm9sbFRvcCIsInNjcm9sbFRvIiwidG9wIiwiYmVoYXZpb3IiLCJfcmVmJCIsIl8kdXNlIiwiRm9yIiwiZWFjaCIsImxpbmVTY29yZSIsInNjb3JlU3R5bGUiLCJ0ZXh0IiwiXyRlZmZlY3QiLCJfcCQiLCJfdiQiLCJfdiQyIiwiX3YkMyIsImUiLCJfJHNldEF0dHJpYnV0ZSIsInQiLCJhIiwic2V0UHJvcGVydHkiLCJyZW1vdmVQcm9wZXJ0eSIsInVuZGVmaW5lZCIsIkxlYWRlcmJvYXJkUGFuZWwiLCJlbnRyaWVzIiwiZmFsbGJhY2siLCJlbnRyeSIsIl9lbCQ2IiwiX2VsJDciLCJ1c2VybmFtZSIsInRvTG9jYWxlU3RyaW5nIiwiaXNDdXJyZW50VXNlciIsIl92JDQiLCJvIiwic3BlZWRzIiwiU3BsaXRCdXR0b24iLCJjdXJyZW50U3BlZWRJbmRleCIsInNldEN1cnJlbnRTcGVlZEluZGV4IiwiY3VycmVudFNwZWVkIiwiY3ljbGVTcGVlZCIsInN0b3BQcm9wYWdhdGlvbiIsInByZXZlbnREZWZhdWx0IiwibmV4dEluZGV4IiwibmV3U3BlZWQiLCJvblNwZWVkQ2hhbmdlIiwiaGFuZGxlU3RhcnQiLCJvblN0YXJ0IiwiJCRjbGljayIsIl92JDUiLCJUYWJzQ29udGV4dCIsImNyZWF0ZUNvbnRleHQiLCJUYWJzIiwiYWN0aXZlVGFiIiwic2V0QWN0aXZlVGFiIiwiZGVmYXVsdFRhYiIsInRhYnMiLCJpZCIsImhhbmRsZVRhYkNoYW5nZSIsIm9uVGFiQ2hhbmdlIiwiY29udGV4dFZhbHVlIiwiUHJvdmlkZXIiLCJUYWJzTGlzdCIsIlRhYnNUcmlnZ2VyIiwiY29udGV4dCIsInVzZUNvbnRleHQiLCJpc0FjdGl2ZSIsIlRhYnNDb250ZW50IiwiRmlyZUVtb2ppQW5pbWF0aW9uIiwic2hvd0ZpcmUiLCJzZXRTaG93RmlyZSIsImZpcmVYIiwic2V0RmlyZVgiLCJsYXN0TGluZUluZGV4IiwiaGlkZVRpbWVyIiwicmFuZG9tIiwic2V0VGltZW91dCIsIm9uQ2xlYW51cCIsInN0eWxlcyIsImZpcmVDb250YWluZXIiLCJmaXJlRW1vamkiLCJFeHRlbnNpb25LYXJhb2tlVmlldyIsImdldExhdGVzdEhpZ2hTY29yZUxpbmUiLCJzY29yZXMiLCJsYXRlc3QiLCJfdG1wbCQ1IiwiX3RtcGwkNiIsIl9lbCQ4IiwibGFiZWwiLCJfdG1wbCQ0IiwibGVhZGVyYm9hcmQiLCJJMThuQ29udGV4dCIsIkkxOG5Qcm92aWRlciIsImxvY2FsZSIsInNldExvY2FsZSIsImRlZmF1bHRMb2NhbGUiLCJ0cmFuc2xhdGlvbnMiLCJzZXRUcmFuc2xhdGlvbnMiLCJjdXJyZW50TG9jYWxlIiwibW9kdWxlIiwiZGVmYXVsdCIsIl9lIiwia2V5IiwicGFyYW1zIiwia2V5cyIsInNwbGl0IiwiayIsInJlcGxhY2UiLCJfIiwiU3RyaW5nIiwiZGlyIiwibnVtYmVyRm9ybWF0dGVyIiwiY3JlYXRlTWVtbyIsIkludGwiLCJOdW1iZXJGb3JtYXQiLCJmb3JtYXROdW1iZXIiLCJudW0iLCJmb3JtYXQiLCJmb3JtYXREYXRlIiwiZGF0ZSIsIm9wdGlvbnMiLCJEYXRlVGltZUZvcm1hdCIsInVzZUkxOG4iLCJFcnJvciIsIkNvbXBsZXRpb25WaWV3IiwiZ2V0RmVlZGJhY2tUZXh0IiwiZmVlZGJhY2tUZXh0IiwiX2VsJDkiLCJfZWwkMSIsIl9lbCQxMCIsIl9lbCQxMSIsIl9lbCQxMiIsIl9lbCQxMyIsInNwZWVkIiwib25QcmFjdGljZSIsIl9lbCQxNCIsIm9uQ2xpY2siLCJzYW1wbGVSYXRlIiwib2Zmc2V0IiwiUHJvZ3Jlc3NCYXIiLCJwZXJjZW50YWdlIiwibWluIiwibWF4IiwiY3VycmVudCIsInRvdGFsIiwiTWluaW1pemVkS2FyYW9rZSIsImN1cnJlbnRUYXJnZXQiLCJ0cmFuc2Zvcm0iLCJfJGFkZEV2ZW50TGlzdGVuZXIiLCJQcmFjdGljZUhlYWRlciIsInRpdGxlIiwiRXhlcmNpc2VGb290ZXIiLCJpc1JlY29yZGluZyIsIm9uU3RvcCIsImlzUHJvY2Vzc2luZyIsImNhblN1Ym1pdCIsIm9uUmVjb3JkIiwib25TdWJtaXQiLCJwIiwiUmVzcG9uc2VGb290ZXIiLCJtb2RlIiwiaXNDb3JyZWN0IiwiSWNvblhDaXJjbGVGaWxsIiwiSWNvbkNoZWNrQ2lyY2xlRmlsbCIsIl8kcCIsIl8kc3R5bGUiLCJvbkNvbnRpbnVlIiwiY29udGludWVMYWJlbCIsIm9uQ2hlY2siLCJFeGVyY2lzZVRlbXBsYXRlIiwiX2MkIiwiXyRtZW1vIiwiaW5zdHJ1Y3Rpb25UZXh0IiwiUmVhZEFsb3VkIiwicHJvbXB0IiwidXNlclRyYW5zY3JpcHQiLCJQcmFjdGljZUV4ZXJjaXNlVmlldyIsImN1cnJlbnRFeGVyY2lzZUluZGV4Iiwic2V0Q3VycmVudEV4ZXJjaXNlSW5kZXgiLCJzZXRJc1JlY29yZGluZyIsInNldElzUHJvY2Vzc2luZyIsInNldFVzZXJUcmFuc2NyaXB0IiwiY3VycmVudFNjb3JlIiwic2V0Q3VycmVudFNjb3JlIiwibWVkaWFSZWNvcmRlciIsInNldE1lZGlhUmVjb3JkZXIiLCJhdWRpb0NodW5rcyIsInNldEF1ZGlvQ2h1bmtzIiwic2hvd0ZlZWRiYWNrIiwic2V0U2hvd0ZlZWRiYWNrIiwic2V0SXNDb3JyZWN0IiwiYXBpQmFzZVVybCIsImV4ZXJjaXNlcyIsImNyZWF0ZVJlc291cmNlIiwidXJsIiwic2Vzc2lvbklkIiwiaGVhZGVycyIsImF1dGhUb2tlbiIsInJlc3BvbnNlIiwiZmV0Y2giLCJvayIsImVycm9yVGV4dCIsInN0YXR1cyIsImRhdGEiLCJqc29uIiwiaGFuZGxlU3RhcnRSZWNvcmRpbmciLCJzdHJlYW0iLCJuYXZpZ2F0b3IiLCJtZWRpYURldmljZXMiLCJnZXRVc2VyTWVkaWEiLCJhdWRpbyIsImVjaG9DYW5jZWxsYXRpb24iLCJub2lzZVN1cHByZXNzaW9uIiwiYXV0b0dhaW5Db250cm9sIiwibWltZVR5cGUiLCJNZWRpYVJlY29yZGVyIiwiaXNUeXBlU3VwcG9ydGVkIiwicmVjb3JkZXIiLCJjaHVua3MiLCJvbmRhdGFhdmFpbGFibGUiLCJldmVudCIsInB1c2giLCJvbnN0b3AiLCJhdWRpb0Jsb2IiLCJCbG9iIiwidHlwZSIsInByb2Nlc3NSZWNvcmRpbmciLCJnZXRUcmFja3MiLCJmb3JFYWNoIiwidHJhY2siLCJzdG9wIiwic3RhcnQiLCJibG9iIiwicmVhZGVyIiwiRmlsZVJlYWRlciIsImJhc2U2NCIsIlByb21pc2UiLCJyZXNvbHZlIiwib25sb2FkZW5kIiwiYmFzZTY0U3RyaW5nIiwicmVhZEFzRGF0YVVSTCIsImF0dGVtcHRzIiwibWF4QXR0ZW1wdHMiLCJtZXRob2QiLCJib2R5IiwiSlNPTiIsInN0cmluZ2lmeSIsImF1ZGlvQmFzZTY0IiwiZXhwZWN0ZWRUZXh0IiwiY3VycmVudEV4ZXJjaXNlIiwiZnVsbF9saW5lIiwicHJlZmVyRGVlcGdyYW0iLCJmZXRjaEVycm9yIiwidHJhbnNjcmlwdCIsImNhbGN1bGF0ZVNjb3JlIiwiaGFuZGxlQXV0b1N1Ym1pdCIsImhhbmRsZVN0b3BSZWNvcmRpbmciLCJzdGF0ZSIsIm5vcm1hbGl6ZVRleHQiLCJ0b0xvd2VyQ2FzZSIsInRyaW0iLCJleHBlY3RlZCIsImFjdHVhbCIsIm5vcm1hbGl6ZWRFeHBlY3RlZCIsIm5vcm1hbGl6ZWRBY3R1YWwiLCJleHBlY3RlZFdvcmRzIiwiYWN0dWFsV29yZHMiLCJtYXRjaGVzIiwicm91bmQiLCJzb3VuZE1hbmFnZXIiLCJwbGF5IiwiY2FyZF9pZHMiLCJleGVyY2lzZUlkIiwiY2FyZFNjb3JlcyIsIm1hcCIsImNhcmRJZCIsImhhbmRsZVN1Ym1pdCIsImhhbmRsZUNvbnRpbnVlIiwib25CYWNrIiwiZXhlcmNpc2UiLCJoZWFkZXJUaXRsZSIsIm9uRXhpdCIsImthcmFva2VBcGkiLCJLYXJhb2tlQXBpU2VydmljZSIsIlByYWN0aWNlVmlldyIsIkNvbnRlbnRBcHAiLCJjdXJyZW50VHJhY2siLCJzZXRDdXJyZW50VHJhY2siLCJzZXRBdXRoVG9rZW4iLCJzaG93S2FyYW9rZSIsInNldFNob3dLYXJhb2tlIiwia2FyYW9rZURhdGEiLCJzZXRLYXJhb2tlRGF0YSIsInNldExvYWRpbmciLCJzZXNzaW9uU3RhcnRlZCIsInNldFNlc3Npb25TdGFydGVkIiwiaXNNaW5pbWl6ZWQiLCJzZXRJc01pbmltaXplZCIsImNvdW50ZG93biIsInNldENvdW50ZG93biIsInNldElzUGxheWluZyIsInNldEN1cnJlbnRUaW1lIiwiYXVkaW9SZWYiLCJzZXRBdWRpb1JlZiIsImthcmFva2VTZXNzaW9uIiwic2V0S2FyYW9rZVNlc3Npb24iLCJjb21wbGV0aW9uRGF0YSIsInNldENvbXBsZXRpb25EYXRhIiwic2hvd1ByYWN0aWNlIiwic2V0U2hvd1ByYWN0aWNlIiwic2VsZWN0ZWRTcGVlZCIsInNldFNlbGVjdGVkU3BlZWQiLCJvbk1vdW50IiwidG9rZW4iLCJnZXRBdXRoVG9rZW4iLCJjbGVhbnVwIiwidHJhY2tEZXRlY3RvciIsIndhdGNoRm9yQ2hhbmdlcyIsImZldGNoS2FyYW9rZURhdGEiLCJnZXRLYXJhb2tlRGF0YSIsInRyYWNrSWQiLCJhcnRpc3QiLCJsaW5lcyIsInRyYWNrVGl0bGUiLCJzb25nRGF0YSIsInNvbmciLCJoYXNMeXJpY3MiLCJuZXdTZXNzaW9uIiwidXNlS2FyYW9rZVNlc3Npb24iLCJhbGJ1bSIsInNvbmdDYXRhbG9nSWQiLCJzb25nX2NhdGFsb2dfaWQiLCJhdWRpb0VsZW1lbnQiLCJhcGlVcmwiLCJvbkNvbXBsZXRlIiwicmVzdWx0cyIsInBhdXNlIiwiaGFuZGxlU3BlZWRDaGFuZ2UiLCJzdGFydFNlc3Npb24iLCJzZXRBdWRpb0VsZW1lbnQiLCJjb3VudGRvd25JbnRlcnZhbCIsInNldEludGVydmFsIiwiY2xlYXJJbnRlcnZhbCIsInN0YXJ0QXVkaW9QbGF5YmFjayIsImF1ZGlvRWxlbWVudHMiLCJzcmMiLCJwYXVzZWQiLCJzZXNzaW9uIiwiYXVkaW9Qcm9jZXNzb3IiLCJpc1JlYWR5IiwiaW5pdGlhbGl6ZSIsImNhdGNoIiwidGhlbiIsImVyciIsInBsYXlCdXR0b24iLCJxdWVyeVNlbGVjdG9yIiwiY2xpY2siLCJ1cGRhdGVUaW1lIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsIm5ld0F1ZGlvRWxlbWVudHMiLCJoYW5kbGVNaW5pbWl6ZSIsImhhbmRsZVJlc3RvcmUiLCJfdG1wbCQ3IiwiX3RtcGwkOCIsIl9lbCQwIiwicmF0ZSIsInBsYXliYWNrUmF0ZSIsIl9lbCQxNSIsIl90bXBsJDkiLCJpc0xvYWRpbmciLCJfdG1wbCQwIiwiZGVmaW5lQ29udGVudFNjcmlwdCIsInJ1bkF0IiwiY3NzSW5qZWN0aW9uTW9kZSIsIm1haW4iLCJjdHgiLCJ3aW5kb3ciLCJzZWxmIiwidWkiLCJjcmVhdGVTaGFkb3dSb290VWkiLCJuYW1lIiwicG9zaXRpb24iLCJhbmNob3IiLCJjb250YWluZXIiLCJ3cmFwcGVyIiwiY3JlYXRlRWxlbWVudCIsImNsYXNzTmFtZSIsImFwcGVuZENoaWxkIiwicmVuZGVyIiwib25SZW1vdmUiLCJtb3VudCIsImNvbW1vbiIsImthcmFva2UiLCJkaXNwbGF5Il0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFnSkEsUUFBTSxTQUFTO0FBQ2YsUUFBTSxVQUFVLENBQUMsR0FBRyxNQUFNLE1BQU07QUFDaEMsUUFBTSxTQUFTLE9BQU8sYUFBYTtBQUNuQyxRQUFNLGlCQUFpQixPQUFPLFVBQVU7QUFDeEMsUUFBTSxTQUFTLE9BQU8sYUFBYTtBQUNuQyxRQUFNLFdBQVcsT0FBTyxxQkFBcUI7QUFDN0MsUUFBTSxnQkFBZ0I7QUFBQSxJQUNwQixRQUFRO0FBQUEsRUFDVjtBQUVBLE1BQUksYUFBYTtBQUNqQixRQUFNLFFBQVE7QUFDZCxRQUFNLFVBQVU7QUFDaEIsUUFBTSxVQUFVLENBS2hCO0FBQ0EsUUFBTSxVQUFVLENBQUM7QUFDakIsTUFBSSxRQUFRO0FBQ1osTUFBSSxhQUFhO0FBRWpCLE1BQUksdUJBQXVCO0FBQzNCLE1BQUksV0FBVztBQUNmLE1BQUksVUFBVTtBQUNkLE1BQUksVUFBVTtBQUNkLE1BQUksWUFBWTtBQU9oQixXQUFTLFdBQVcsSUFBSSxlQUFlO0FBQ3JDLFVBQU0sV0FBVyxVQUNmLFFBQVEsT0FDUixVQUFVLEdBQUcsV0FBVyxHQUN4QixVQUFVLGtCQUFrQixTQUFZLFFBQVEsZUFDaEQsT0FBTyxVQUFVO0FBQUEs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LHVCQUFpQixXQUFXLEVBQUU7QUFDOUIsV0FBSyxjQUFjLE1BQU0sb0JBQW9CLFdBQVcsRUFBRSxDQUFDO0FBQUEsSUFDL0Q7QUFBQSxFQUNBO0FBckpFLGdCQVpXLHVCQVlKLCtCQUE4QjtBQUFBLElBQ25DO0FBQUEsRUFDRDtBQWRJLE1BQU0sdUJBQU47Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0RQLFFBQU1vTCxpQkFBNkI7QUFBQSxJQUFBLFFBQ2pDdVM7QUFBQUEsSUFBQSxTQUNBQztBQUFBQSxJQUNBQyxTQUFBQTtBQUFBQSxFQUNGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0pBLFFBQU0sZUFBNkI7QUFBQSxJQUNqQztBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDRjs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsMSwyLDMsNCw1LDYsNyw4LDksMTAsMTEsMTIsMTMsMTQsMTUsNDQsNDUsNjMsNjQsNjVdfQ==

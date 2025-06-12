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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL2Rpc3QvZGV2LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL3dlYi9kaXN0L2Rldi5qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWUvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnQvbGliL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbnkta2V5cy1tYXAvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvZGVmdS9kaXN0L2RlZnUubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0AxbmF0c3Uvd2FpdC1lbGVtZW50L2Rpc3QvZGV0ZWN0b3JzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AMW5hdHN1L3dhaXQtZWxlbWVudC9kaXN0L2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYXJlZC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9jbHN4L2Rpc3QvY2xzeC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvY24udHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9sYXlvdXQvSGVhZGVyL0hlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9kaXNwbGF5L1Njb3JlUGFuZWwvU2NvcmVQYW5lbC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vQnV0dG9uL0J1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9vbmJvYXJkaW5nL09uYm9hcmRpbmdGbG93L09uYm9hcmRpbmdGbG93LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheS9MeXJpY3NEaXNwbGF5LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvS2FyYW9rZUhlYWRlci9LYXJhb2tlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbC9MZWFkZXJib2FyZFBhbmVsLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9TcGxpdEJ1dHRvbi9TcGxpdEJ1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vVGFicy9UYWJzLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2VmZmVjdHMvRmlyZUVtb2ppQW5pbWF0aW9uL0ZpcmVFbW9qaUFuaW1hdGlvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9rYXJhb2tlL0V4dGVuc2lvbkthcmFva2VWaWV3L0V4dGVuc2lvbkthcmFva2VWaWV3LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9pMThuL3Byb3ZpZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvQ29tcGxldGlvblZpZXcvQ29tcGxldGlvblZpZXcudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL3NlcnZpY2VzL2F1ZGlvL2thcmFva2VBdWRpb1Byb2Nlc3Nvci50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2NsaWVudC50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2VuZHBvaW50cy9rYXJhb2tlLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvZW5kcG9pbnRzL3ByYWN0aWNlLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvZW5kcG9pbnRzL3N0dC50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FwaS1jbGllbnQvc3JjL2VuZHBvaW50cy9hdXRoLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmMvaW5kZXgudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvc2VydmljZXMva2FyYW9rZS9rYXJhb2tlQXBpLnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL3NlcnZpY2VzL2thcmFva2UvY2h1bmtpbmdVdGlscy50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9Qcm9ncmVzc0Jhci9Qcm9ncmVzc0Jhci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vTW9kYWwvTW9kYWwudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvTWluaW1pemVkS2FyYW9rZS50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9QcmFjdGljZUhlYWRlci9QcmFjdGljZUhlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9FeGVyY2lzZUZvb3Rlci9FeGVyY2lzZUZvb3Rlci50c3giLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvcGhvc3Bob3ItaWNvbnMtc29saWQvZGlzdC9JY29uQ2hlY2tDaXJjbGVGaWxsLmpzeCIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9waG9zcGhvci1pY29ucy1zb2xpZC9kaXN0L0ljb25YQ2lyY2xlRmlsbC5qc3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9SZXNwb25zZUZvb3Rlci9SZXNwb25zZUZvb3Rlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9FeGVyY2lzZVRlbXBsYXRlL0V4ZXJjaXNlVGVtcGxhdGUudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcHJhY3RpY2UvUmVhZEFsb3VkL1JlYWRBbG91ZC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9QcmFjdGljZUV4ZXJjaXNlVmlldy9QcmFjdGljZUV4ZXJjaXNlVmlldy50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy93ZWIvRmFyY2FzdGVyTWluaUFwcC9GYXJjYXN0ZXJNaW5pQXBwLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3BhZ2VzL0hvbWVQYWdlL0hvbWVQYWdlLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9ob29rcy91c2VLYXJhb2tlU2Vzc2lvbi50cyIsIi4uLy4uLy4uL3NyYy9zZXJ2aWNlcy90cmFjay1kZXRlY3Rvci50cyIsIi4uLy4uLy4uL3NyYy91dGlscy9zdG9yYWdlLnRzIiwiLi4vLi4vLi4vc3JjL3NlcnZpY2VzL2thcmFva2UtYXBpLnRzIiwiLi4vLi4vLi4vc3JjL3ZpZXdzL2NvbnRlbnQvUHJhY3RpY2VWaWV3LnRzeCIsIi4uLy4uLy4uL3NyYy92aWV3cy9jb250ZW50L0NvbnRlbnRBcHAudHN4IiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC50c3giLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvaTE4bi9sb2NhbGVzL2VuL2luZGV4LnRzIiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2kxOG4vbG9jYWxlcy96aC1DTi9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgdGFza0lkQ291bnRlciA9IDEsXG4gIGlzQ2FsbGJhY2tTY2hlZHVsZWQgPSBmYWxzZSxcbiAgaXNQZXJmb3JtaW5nV29yayA9IGZhbHNlLFxuICB0YXNrUXVldWUgPSBbXSxcbiAgY3VycmVudFRhc2sgPSBudWxsLFxuICBzaG91bGRZaWVsZFRvSG9zdCA9IG51bGwsXG4gIHlpZWxkSW50ZXJ2YWwgPSA1LFxuICBkZWFkbGluZSA9IDAsXG4gIG1heFlpZWxkSW50ZXJ2YWwgPSAzMDAsXG4gIHNjaGVkdWxlQ2FsbGJhY2sgPSBudWxsLFxuICBzY2hlZHVsZWRDYWxsYmFjayA9IG51bGw7XG5jb25zdCBtYXhTaWduZWQzMUJpdEludCA9IDEwNzM3NDE4MjM7XG5mdW5jdGlvbiBzZXR1cFNjaGVkdWxlcigpIHtcbiAgY29uc3QgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpLFxuICAgIHBvcnQgPSBjaGFubmVsLnBvcnQyO1xuICBzY2hlZHVsZUNhbGxiYWNrID0gKCkgPT4gcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSAoKSA9PiB7XG4gICAgaWYgKHNjaGVkdWxlZENhbGxiYWNrICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBjdXJyZW50VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgZGVhZGxpbmUgPSBjdXJyZW50VGltZSArIHlpZWxkSW50ZXJ2YWw7XG4gICAgICBjb25zdCBoYXNUaW1lUmVtYWluaW5nID0gdHJ1ZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGhhc01vcmVXb3JrID0gc2NoZWR1bGVkQ2FsbGJhY2soaGFzVGltZVJlbWFpbmluZywgY3VycmVudFRpbWUpO1xuICAgICAgICBpZiAoIWhhc01vcmVXb3JrKSB7XG4gICAgICAgICAgc2NoZWR1bGVkQ2FsbGJhY2sgPSBudWxsO1xuICAgICAgICB9IGVsc2UgcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHBvcnQucG9zdE1lc3NhZ2UobnVsbCk7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgaWYgKG5hdmlnYXRvciAmJiBuYXZpZ2F0b3Iuc2NoZWR1bGluZyAmJiBuYXZpZ2F0b3Iuc2NoZWR1bGluZy5pc0lucHV0UGVuZGluZykge1xuICAgIGNvbnN0IHNjaGVkdWxpbmcgPSBuYXZpZ2F0b3Iuc2NoZWR1bGluZztcbiAgICBzaG91bGRZaWVsZFRvSG9zdCA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBpZiAoY3VycmVudFRpbWUgPj0gZGVhZGxpbmUpIHtcbiAgICAgICAgaWYgKHNjaGVkdWxpbmcuaXNJbnB1dFBlbmRpbmcoKSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjdXJyZW50VGltZSA+PSBtYXhZaWVsZEludGVydmFsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgc2hvdWxkWWllbGRUb0hvc3QgPSAoKSA9PiBwZXJmb3JtYW5jZS5ub3coKSA+PSBkZWFkbGluZTtcbiAgfVxufVxuZnVuY3Rpb24gZW5xdWV1ZSh0YXNrUXVldWUsIHRhc2spIHtcbiAgZnVuY3Rpb24gZmluZEluZGV4KCkge1xuICAgIGxldCBtID0gMDtcbiAgICBsZXQgbiA9IHRhc2tRdWV1ZS5sZW5ndGggLSAxO1xuICAgIHdoaWxlIChtIDw9IG4pIHtcbiAgICAgIGNvbnN0IGsgPSBuICsgbSA+PiAxO1xuICAgICAgY29uc3QgY21wID0gdGFzay5leHBpcmF0aW9uVGltZSAtIHRhc2tRdWV1ZVtrXS5leHBpcmF0aW9uVGltZTtcbiAgICAgIGlmIChjbXAgPiAwKSBtID0gayArIDE7ZWxzZSBpZiAoY21wIDwgMCkgbiA9IGsgLSAxO2Vsc2UgcmV0dXJuIGs7XG4gICAgfVxuICAgIHJldHVybiBtO1xuICB9XG4gIHRhc2tRdWV1ZS5zcGxpY2UoZmluZEluZGV4KCksIDAsIHRhc2spO1xufVxuZnVuY3Rpb24gcmVxdWVzdENhbGxiYWNrKGZuLCBvcHRpb25zKSB7XG4gIGlmICghc2NoZWR1bGVDYWxsYmFjaykgc2V0dXBTY2hlZHVsZXIoKTtcbiAgbGV0IHN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpLFxuICAgIHRpbWVvdXQgPSBtYXhTaWduZWQzMUJpdEludDtcbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy50aW1lb3V0KSB0aW1lb3V0ID0gb3B0aW9ucy50aW1lb3V0O1xuICBjb25zdCBuZXdUYXNrID0ge1xuICAgIGlkOiB0YXNrSWRDb3VudGVyKyssXG4gICAgZm4sXG4gICAgc3RhcnRUaW1lLFxuICAgIGV4cGlyYXRpb25UaW1lOiBzdGFydFRpbWUgKyB0aW1lb3V0XG4gIH07XG4gIGVucXVldWUodGFza1F1ZXVlLCBuZXdUYXNrKTtcbiAgaWYgKCFpc0NhbGxiYWNrU2NoZWR1bGVkICYmICFpc1BlcmZvcm1pbmdXb3JrKSB7XG4gICAgaXNDYWxsYmFja1NjaGVkdWxlZCA9IHRydWU7XG4gICAgc2NoZWR1bGVkQ2FsbGJhY2sgPSBmbHVzaFdvcms7XG4gICAgc2NoZWR1bGVDYWxsYmFjaygpO1xuICB9XG4gIHJldHVybiBuZXdUYXNrO1xufVxuZnVuY3Rpb24gY2FuY2VsQ2FsbGJhY2sodGFzaykge1xuICB0YXNrLmZuID0gbnVsbDtcbn1cbmZ1bmN0aW9uIGZsdXNoV29yayhoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSkge1xuICBpc0NhbGxiYWNrU2NoZWR1bGVkID0gZmFsc2U7XG4gIGlzUGVyZm9ybWluZ1dvcmsgPSB0cnVlO1xuICB0cnkge1xuICAgIHJldHVybiB3b3JrTG9vcChoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSk7XG4gIH0gZmluYWxseSB7XG4gICAgY3VycmVudFRhc2sgPSBudWxsO1xuICAgIGlzUGVyZm9ybWluZ1dvcmsgPSBmYWxzZTtcbiAgfVxufVxuZnVuY3Rpb24gd29ya0xvb3AoaGFzVGltZVJlbWFpbmluZywgaW5pdGlhbFRpbWUpIHtcbiAgbGV0IGN1cnJlbnRUaW1lID0gaW5pdGlhbFRpbWU7XG4gIGN1cnJlbnRUYXNrID0gdGFza1F1ZXVlWzBdIHx8IG51bGw7XG4gIHdoaWxlIChjdXJyZW50VGFzayAhPT0gbnVsbCkge1xuICAgIGlmIChjdXJyZW50VGFzay5leHBpcmF0aW9uVGltZSA+IGN1cnJlbnRUaW1lICYmICghaGFzVGltZVJlbWFpbmluZyB8fCBzaG91bGRZaWVsZFRvSG9zdCgpKSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNvbnN0IGNhbGxiYWNrID0gY3VycmVudFRhc2suZm47XG4gICAgaWYgKGNhbGxiYWNrICE9PSBudWxsKSB7XG4gICAgICBjdXJyZW50VGFzay5mbiA9IG51bGw7XG4gICAgICBjb25zdCBkaWRVc2VyQ2FsbGJhY2tUaW1lb3V0ID0gY3VycmVudFRhc2suZXhwaXJhdGlvblRpbWUgPD0gY3VycmVudFRpbWU7XG4gICAgICBjYWxsYmFjayhkaWRVc2VyQ2FsbGJhY2tUaW1lb3V0KTtcbiAgICAgIGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBpZiAoY3VycmVudFRhc2sgPT09IHRhc2tRdWV1ZVswXSkge1xuICAgICAgICB0YXNrUXVldWUuc2hpZnQoKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgdGFza1F1ZXVlLnNoaWZ0KCk7XG4gICAgY3VycmVudFRhc2sgPSB0YXNrUXVldWVbMF0gfHwgbnVsbDtcbiAgfVxuICByZXR1cm4gY3VycmVudFRhc2sgIT09IG51bGw7XG59XG5cbmNvbnN0IHNoYXJlZENvbmZpZyA9IHtcbiAgY29udGV4dDogdW5kZWZpbmVkLFxuICByZWdpc3RyeTogdW5kZWZpbmVkLFxuICBlZmZlY3RzOiB1bmRlZmluZWQsXG4gIGRvbmU6IGZhbHNlLFxuICBnZXRDb250ZXh0SWQoKSB7XG4gICAgcmV0dXJuIGdldENvbnRleHRJZCh0aGlzLmNvbnRleHQuY291bnQpO1xuICB9LFxuICBnZXROZXh0Q29udGV4dElkKCkge1xuICAgIHJldHVybiBnZXRDb250ZXh0SWQodGhpcy5jb250ZXh0LmNvdW50KyspO1xuICB9XG59O1xuZnVuY3Rpb24gZ2V0Q29udGV4dElkKGNvdW50KSB7XG4gIGNvbnN0IG51bSA9IFN0cmluZyhjb3VudCksXG4gICAgbGVuID0gbnVtLmxlbmd0aCAtIDE7XG4gIHJldHVybiBzaGFyZWRDb25maWcuY29udGV4dC5pZCArIChsZW4gPyBTdHJpbmcuZnJvbUNoYXJDb2RlKDk2ICsgbGVuKSA6IFwiXCIpICsgbnVtO1xufVxuZnVuY3Rpb24gc2V0SHlkcmF0ZUNvbnRleHQoY29udGV4dCkge1xuICBzaGFyZWRDb25maWcuY29udGV4dCA9IGNvbnRleHQ7XG59XG5mdW5jdGlvbiBuZXh0SHlkcmF0ZUNvbnRleHQoKSB7XG4gIHJldHVybiB7XG4gICAgLi4uc2hhcmVkQ29uZmlnLmNvbnRleHQsXG4gICAgaWQ6IHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCksXG4gICAgY291bnQ6IDBcbiAgfTtcbn1cblxuY29uc3QgSVNfREVWID0gdHJ1ZTtcbmNvbnN0IGVxdWFsRm4gPSAoYSwgYikgPT4gYSA9PT0gYjtcbmNvbnN0ICRQUk9YWSA9IFN5bWJvbChcInNvbGlkLXByb3h5XCIpO1xuY29uc3QgU1VQUE9SVFNfUFJPWFkgPSB0eXBlb2YgUHJveHkgPT09IFwiZnVuY3Rpb25cIjtcbmNvbnN0ICRUUkFDSyA9IFN5bWJvbChcInNvbGlkLXRyYWNrXCIpO1xuY29uc3QgJERFVkNPTVAgPSBTeW1ib2woXCJzb2xpZC1kZXYtY29tcG9uZW50XCIpO1xuY29uc3Qgc2lnbmFsT3B0aW9ucyA9IHtcbiAgZXF1YWxzOiBlcXVhbEZuXG59O1xubGV0IEVSUk9SID0gbnVsbDtcbmxldCBydW5FZmZlY3RzID0gcnVuUXVldWU7XG5jb25zdCBTVEFMRSA9IDE7XG5jb25zdCBQRU5ESU5HID0gMjtcbmNvbnN0IFVOT1dORUQgPSB7XG4gIG93bmVkOiBudWxsLFxuICBjbGVhbnVwczogbnVsbCxcbiAgY29udGV4dDogbnVsbCxcbiAgb3duZXI6IG51bGxcbn07XG5jb25zdCBOT19JTklUID0ge307XG52YXIgT3duZXIgPSBudWxsO1xubGV0IFRyYW5zaXRpb24gPSBudWxsO1xubGV0IFNjaGVkdWxlciA9IG51bGw7XG5sZXQgRXh0ZXJuYWxTb3VyY2VDb25maWcgPSBudWxsO1xubGV0IExpc3RlbmVyID0gbnVsbDtcbmxldCBVcGRhdGVzID0gbnVsbDtcbmxldCBFZmZlY3RzID0gbnVsbDtcbmxldCBFeGVjQ291bnQgPSAwO1xuY29uc3QgRGV2SG9va3MgPSB7XG4gIGFmdGVyVXBkYXRlOiBudWxsLFxuICBhZnRlckNyZWF0ZU93bmVyOiBudWxsLFxuICBhZnRlckNyZWF0ZVNpZ25hbDogbnVsbCxcbiAgYWZ0ZXJSZWdpc3RlckdyYXBoOiBudWxsXG59O1xuZnVuY3Rpb24gY3JlYXRlUm9vdChmbiwgZGV0YWNoZWRPd25lcikge1xuICBjb25zdCBsaXN0ZW5lciA9IExpc3RlbmVyLFxuICAgIG93bmVyID0gT3duZXIsXG4gICAgdW5vd25lZCA9IGZuLmxlbmd0aCA9PT0gMCxcbiAgICBjdXJyZW50ID0gZGV0YWNoZWRPd25lciA9PT0gdW5kZWZpbmVkID8gb3duZXIgOiBkZXRhY2hlZE93bmVyLFxuICAgIHJvb3QgPSB1bm93bmVkID8ge1xuICAgICAgb3duZWQ6IG51bGwsXG4gICAgICBjbGVhbnVwczogbnVsbCxcbiAgICAgIGNvbnRleHQ6IG51bGwsXG4gICAgICBvd25lcjogbnVsbFxuICAgIH0gIDoge1xuICAgICAgb3duZWQ6IG51bGwsXG4gICAgICBjbGVhbnVwczogbnVsbCxcbiAgICAgIGNvbnRleHQ6IGN1cnJlbnQgPyBjdXJyZW50LmNvbnRleHQgOiBudWxsLFxuICAgICAgb3duZXI6IGN1cnJlbnRcbiAgICB9LFxuICAgIHVwZGF0ZUZuID0gdW5vd25lZCA/ICgpID0+IGZuKCgpID0+IHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkRpc3Bvc2UgbWV0aG9kIG11c3QgYmUgYW4gZXhwbGljaXQgYXJndW1lbnQgdG8gY3JlYXRlUm9vdCBmdW5jdGlvblwiKTtcbiAgICB9KSAgOiAoKSA9PiBmbigoKSA9PiB1bnRyYWNrKCgpID0+IGNsZWFuTm9kZShyb290KSkpO1xuICBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyICYmIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIocm9vdCk7XG4gIE93bmVyID0gcm9vdDtcbiAgTGlzdGVuZXIgPSBudWxsO1xuICB0cnkge1xuICAgIHJldHVybiBydW5VcGRhdGVzKHVwZGF0ZUZuLCB0cnVlKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICAgIE93bmVyID0gb3duZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIGNyZWF0ZVNpZ25hbCh2YWx1ZSwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyA/IE9iamVjdC5hc3NpZ24oe30sIHNpZ25hbE9wdGlvbnMsIG9wdGlvbnMpIDogc2lnbmFsT3B0aW9ucztcbiAgY29uc3QgcyA9IHtcbiAgICB2YWx1ZSxcbiAgICBvYnNlcnZlcnM6IG51bGwsXG4gICAgb2JzZXJ2ZXJTbG90czogbnVsbCxcbiAgICBjb21wYXJhdG9yOiBvcHRpb25zLmVxdWFscyB8fCB1bmRlZmluZWRcbiAgfTtcbiAge1xuICAgIGlmIChvcHRpb25zLm5hbWUpIHMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICBpZiAob3B0aW9ucy5pbnRlcm5hbCkge1xuICAgICAgcy5pbnRlcm5hbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZ2lzdGVyR3JhcGgocyk7XG4gICAgICBpZiAoRGV2SG9va3MuYWZ0ZXJDcmVhdGVTaWduYWwpIERldkhvb2tzLmFmdGVyQ3JlYXRlU2lnbmFsKHMpO1xuICAgIH1cbiAgfVxuICBjb25zdCBzZXR0ZXIgPSB2YWx1ZSA9PiB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhzKSkgdmFsdWUgPSB2YWx1ZShzLnRWYWx1ZSk7ZWxzZSB2YWx1ZSA9IHZhbHVlKHMudmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gd3JpdGVTaWduYWwocywgdmFsdWUpO1xuICB9O1xuICByZXR1cm4gW3JlYWRTaWduYWwuYmluZChzKSwgc2V0dGVyXTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbXB1dGVkKGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCB0cnVlLCBTVEFMRSwgb3B0aW9ucyApO1xuICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBVcGRhdGVzLnB1c2goYyk7ZWxzZSB1cGRhdGVDb21wdXRhdGlvbihjKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlbmRlckVmZmVjdChmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgZmFsc2UsIFNUQUxFLCBvcHRpb25zICk7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIFVwZGF0ZXMucHVzaChjKTtlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlRWZmZWN0KGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBydW5FZmZlY3RzID0gcnVuVXNlckVmZmVjdHM7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIGZhbHNlLCBTVEFMRSwgb3B0aW9ucyApLFxuICAgIHMgPSBTdXNwZW5zZUNvbnRleHQgJiYgdXNlQ29udGV4dChTdXNwZW5zZUNvbnRleHQpO1xuICBpZiAocykgYy5zdXNwZW5zZSA9IHM7XG4gIGlmICghb3B0aW9ucyB8fCAhb3B0aW9ucy5yZW5kZXIpIGMudXNlciA9IHRydWU7XG4gIEVmZmVjdHMgPyBFZmZlY3RzLnB1c2goYykgOiB1cGRhdGVDb21wdXRhdGlvbihjKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlYWN0aW9uKG9uSW52YWxpZGF0ZSwgb3B0aW9ucykge1xuICBsZXQgZm47XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB7XG4gICAgICBmbiA/IGZuKCkgOiB1bnRyYWNrKG9uSW52YWxpZGF0ZSk7XG4gICAgICBmbiA9IHVuZGVmaW5lZDtcbiAgICB9LCB1bmRlZmluZWQsIGZhbHNlLCAwLCBvcHRpb25zICksXG4gICAgcyA9IFN1c3BlbnNlQ29udGV4dCAmJiB1c2VDb250ZXh0KFN1c3BlbnNlQ29udGV4dCk7XG4gIGlmIChzKSBjLnN1c3BlbnNlID0gcztcbiAgYy51c2VyID0gdHJ1ZTtcbiAgcmV0dXJuIHRyYWNraW5nID0+IHtcbiAgICBmbiA9IHRyYWNraW5nO1xuICAgIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICB9O1xufVxuZnVuY3Rpb24gY3JlYXRlTWVtbyhmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgPyBPYmplY3QuYXNzaWduKHt9LCBzaWduYWxPcHRpb25zLCBvcHRpb25zKSA6IHNpZ25hbE9wdGlvbnM7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIHRydWUsIDAsIG9wdGlvbnMgKTtcbiAgYy5vYnNlcnZlcnMgPSBudWxsO1xuICBjLm9ic2VydmVyU2xvdHMgPSBudWxsO1xuICBjLmNvbXBhcmF0b3IgPSBvcHRpb25zLmVxdWFscyB8fCB1bmRlZmluZWQ7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICBjLnRTdGF0ZSA9IFNUQUxFO1xuICAgIFVwZGF0ZXMucHVzaChjKTtcbiAgfSBlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICByZXR1cm4gcmVhZFNpZ25hbC5iaW5kKGMpO1xufVxuZnVuY3Rpb24gaXNQcm9taXNlKHYpIHtcbiAgcmV0dXJuIHYgJiYgdHlwZW9mIHYgPT09IFwib2JqZWN0XCIgJiYgXCJ0aGVuXCIgaW4gdjtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlc291cmNlKHBTb3VyY2UsIHBGZXRjaGVyLCBwT3B0aW9ucykge1xuICBsZXQgc291cmNlO1xuICBsZXQgZmV0Y2hlcjtcbiAgbGV0IG9wdGlvbnM7XG4gIGlmICh0eXBlb2YgcEZldGNoZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIHNvdXJjZSA9IHBTb3VyY2U7XG4gICAgZmV0Y2hlciA9IHBGZXRjaGVyO1xuICAgIG9wdGlvbnMgPSBwT3B0aW9ucyB8fCB7fTtcbiAgfSBlbHNlIHtcbiAgICBzb3VyY2UgPSB0cnVlO1xuICAgIGZldGNoZXIgPSBwU291cmNlO1xuICAgIG9wdGlvbnMgPSBwRmV0Y2hlciB8fCB7fTtcbiAgfVxuICBsZXQgcHIgPSBudWxsLFxuICAgIGluaXRQID0gTk9fSU5JVCxcbiAgICBpZCA9IG51bGwsXG4gICAgbG9hZGVkVW5kZXJUcmFuc2l0aW9uID0gZmFsc2UsXG4gICAgc2NoZWR1bGVkID0gZmFsc2UsXG4gICAgcmVzb2x2ZWQgPSBcImluaXRpYWxWYWx1ZVwiIGluIG9wdGlvbnMsXG4gICAgZHluYW1pYyA9IHR5cGVvZiBzb3VyY2UgPT09IFwiZnVuY3Rpb25cIiAmJiBjcmVhdGVNZW1vKHNvdXJjZSk7XG4gIGNvbnN0IGNvbnRleHRzID0gbmV3IFNldCgpLFxuICAgIFt2YWx1ZSwgc2V0VmFsdWVdID0gKG9wdGlvbnMuc3RvcmFnZSB8fCBjcmVhdGVTaWduYWwpKG9wdGlvbnMuaW5pdGlhbFZhbHVlKSxcbiAgICBbZXJyb3IsIHNldEVycm9yXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQpLFxuICAgIFt0cmFjaywgdHJpZ2dlcl0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICBlcXVhbHM6IGZhbHNlXG4gICAgfSksXG4gICAgW3N0YXRlLCBzZXRTdGF0ZV0gPSBjcmVhdGVTaWduYWwocmVzb2x2ZWQgPyBcInJlYWR5XCIgOiBcInVucmVzb2x2ZWRcIik7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCkge1xuICAgIGlkID0gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKTtcbiAgICBpZiAob3B0aW9ucy5zc3JMb2FkRnJvbSA9PT0gXCJpbml0aWFsXCIpIGluaXRQID0gb3B0aW9ucy5pbml0aWFsVmFsdWU7ZWxzZSBpZiAoc2hhcmVkQ29uZmlnLmxvYWQgJiYgc2hhcmVkQ29uZmlnLmhhcyhpZCkpIGluaXRQID0gc2hhcmVkQ29uZmlnLmxvYWQoaWQpO1xuICB9XG4gIGZ1bmN0aW9uIGxvYWRFbmQocCwgdiwgZXJyb3IsIGtleSkge1xuICAgIGlmIChwciA9PT0gcCkge1xuICAgICAgcHIgPSBudWxsO1xuICAgICAga2V5ICE9PSB1bmRlZmluZWQgJiYgKHJlc29sdmVkID0gdHJ1ZSk7XG4gICAgICBpZiAoKHAgPT09IGluaXRQIHx8IHYgPT09IGluaXRQKSAmJiBvcHRpb25zLm9uSHlkcmF0ZWQpIHF1ZXVlTWljcm90YXNrKCgpID0+IG9wdGlvbnMub25IeWRyYXRlZChrZXksIHtcbiAgICAgICAgdmFsdWU6IHZcbiAgICAgIH0pKTtcbiAgICAgIGluaXRQID0gTk9fSU5JVDtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIHAgJiYgbG9hZGVkVW5kZXJUcmFuc2l0aW9uKSB7XG4gICAgICAgIFRyYW5zaXRpb24ucHJvbWlzZXMuZGVsZXRlKHApO1xuICAgICAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBmYWxzZTtcbiAgICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICBjb21wbGV0ZUxvYWQodiwgZXJyb3IpO1xuICAgICAgICB9LCBmYWxzZSk7XG4gICAgICB9IGVsc2UgY29tcGxldGVMb2FkKHYsIGVycm9yKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cbiAgZnVuY3Rpb24gY29tcGxldGVMb2FkKHYsIGVycikge1xuICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgaWYgKGVyciA9PT0gdW5kZWZpbmVkKSBzZXRWYWx1ZSgoKSA9PiB2KTtcbiAgICAgIHNldFN0YXRlKGVyciAhPT0gdW5kZWZpbmVkID8gXCJlcnJvcmVkXCIgOiByZXNvbHZlZCA/IFwicmVhZHlcIiA6IFwidW5yZXNvbHZlZFwiKTtcbiAgICAgIHNldEVycm9yKGVycik7XG4gICAgICBmb3IgKGNvbnN0IGMgb2YgY29udGV4dHMua2V5cygpKSBjLmRlY3JlbWVudCgpO1xuICAgICAgY29udGV4dHMuY2xlYXIoKTtcbiAgICB9LCBmYWxzZSk7XG4gIH1cbiAgZnVuY3Rpb24gcmVhZCgpIHtcbiAgICBjb25zdCBjID0gU3VzcGVuc2VDb250ZXh0ICYmIHVzZUNvbnRleHQoU3VzcGVuc2VDb250ZXh0KSxcbiAgICAgIHYgPSB2YWx1ZSgpLFxuICAgICAgZXJyID0gZXJyb3IoKTtcbiAgICBpZiAoZXJyICE9PSB1bmRlZmluZWQgJiYgIXByKSB0aHJvdyBlcnI7XG4gICAgaWYgKExpc3RlbmVyICYmICFMaXN0ZW5lci51c2VyICYmIGMpIHtcbiAgICAgIGNyZWF0ZUNvbXB1dGVkKCgpID0+IHtcbiAgICAgICAgdHJhY2soKTtcbiAgICAgICAgaWYgKHByKSB7XG4gICAgICAgICAgaWYgKGMucmVzb2x2ZWQgJiYgVHJhbnNpdGlvbiAmJiBsb2FkZWRVbmRlclRyYW5zaXRpb24pIFRyYW5zaXRpb24ucHJvbWlzZXMuYWRkKHByKTtlbHNlIGlmICghY29udGV4dHMuaGFzKGMpKSB7XG4gICAgICAgICAgICBjLmluY3JlbWVudCgpO1xuICAgICAgICAgICAgY29udGV4dHMuYWRkKGMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG4gIGZ1bmN0aW9uIGxvYWQocmVmZXRjaGluZyA9IHRydWUpIHtcbiAgICBpZiAocmVmZXRjaGluZyAhPT0gZmFsc2UgJiYgc2NoZWR1bGVkKSByZXR1cm47XG4gICAgc2NoZWR1bGVkID0gZmFsc2U7XG4gICAgY29uc3QgbG9va3VwID0gZHluYW1pYyA/IGR5bmFtaWMoKSA6IHNvdXJjZTtcbiAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgICBpZiAobG9va3VwID09IG51bGwgfHwgbG9va3VwID09PSBmYWxzZSkge1xuICAgICAgbG9hZEVuZChwciwgdW50cmFjayh2YWx1ZSkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoVHJhbnNpdGlvbiAmJiBwcikgVHJhbnNpdGlvbi5wcm9taXNlcy5kZWxldGUocHIpO1xuICAgIGxldCBlcnJvcjtcbiAgICBjb25zdCBwID0gaW5pdFAgIT09IE5PX0lOSVQgPyBpbml0UCA6IHVudHJhY2soKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIGZldGNoZXIobG9va3VwLCB7XG4gICAgICAgICAgdmFsdWU6IHZhbHVlKCksXG4gICAgICAgICAgcmVmZXRjaGluZ1xuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2ggKGZldGNoZXJFcnJvcikge1xuICAgICAgICBlcnJvciA9IGZldGNoZXJFcnJvcjtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoZXJyb3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbG9hZEVuZChwciwgdW5kZWZpbmVkLCBjYXN0RXJyb3IoZXJyb3IpLCBsb29rdXApO1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoIWlzUHJvbWlzZShwKSkge1xuICAgICAgbG9hZEVuZChwciwgcCwgdW5kZWZpbmVkLCBsb29rdXApO1xuICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIHByID0gcDtcbiAgICBpZiAoXCJ2XCIgaW4gcCkge1xuICAgICAgaWYgKHAucyA9PT0gMSkgbG9hZEVuZChwciwgcC52LCB1bmRlZmluZWQsIGxvb2t1cCk7ZWxzZSBsb2FkRW5kKHByLCB1bmRlZmluZWQsIGNhc3RFcnJvcihwLnYpLCBsb29rdXApO1xuICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIHNjaGVkdWxlZCA9IHRydWU7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4gc2NoZWR1bGVkID0gZmFsc2UpO1xuICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgc2V0U3RhdGUocmVzb2x2ZWQgPyBcInJlZnJlc2hpbmdcIiA6IFwicGVuZGluZ1wiKTtcbiAgICAgIHRyaWdnZXIoKTtcbiAgICB9LCBmYWxzZSk7XG4gICAgcmV0dXJuIHAudGhlbih2ID0+IGxvYWRFbmQocCwgdiwgdW5kZWZpbmVkLCBsb29rdXApLCBlID0+IGxvYWRFbmQocCwgdW5kZWZpbmVkLCBjYXN0RXJyb3IoZSksIGxvb2t1cCkpO1xuICB9XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHJlYWQsIHtcbiAgICBzdGF0ZToge1xuICAgICAgZ2V0OiAoKSA9PiBzdGF0ZSgpXG4gICAgfSxcbiAgICBlcnJvcjoge1xuICAgICAgZ2V0OiAoKSA9PiBlcnJvcigpXG4gICAgfSxcbiAgICBsb2FkaW5nOiB7XG4gICAgICBnZXQoKSB7XG4gICAgICAgIGNvbnN0IHMgPSBzdGF0ZSgpO1xuICAgICAgICByZXR1cm4gcyA9PT0gXCJwZW5kaW5nXCIgfHwgcyA9PT0gXCJyZWZyZXNoaW5nXCI7XG4gICAgICB9XG4gICAgfSxcbiAgICBsYXRlc3Q6IHtcbiAgICAgIGdldCgpIHtcbiAgICAgICAgaWYgKCFyZXNvbHZlZCkgcmV0dXJuIHJlYWQoKTtcbiAgICAgICAgY29uc3QgZXJyID0gZXJyb3IoKTtcbiAgICAgICAgaWYgKGVyciAmJiAhcHIpIHRocm93IGVycjtcbiAgICAgICAgcmV0dXJuIHZhbHVlKCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbiAgbGV0IG93bmVyID0gT3duZXI7XG4gIGlmIChkeW5hbWljKSBjcmVhdGVDb21wdXRlZCgoKSA9PiAob3duZXIgPSBPd25lciwgbG9hZChmYWxzZSkpKTtlbHNlIGxvYWQoZmFsc2UpO1xuICByZXR1cm4gW3JlYWQsIHtcbiAgICByZWZldGNoOiBpbmZvID0+IHJ1bldpdGhPd25lcihvd25lciwgKCkgPT4gbG9hZChpbmZvKSksXG4gICAgbXV0YXRlOiBzZXRWYWx1ZVxuICB9XTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZURlZmVycmVkKHNvdXJjZSwgb3B0aW9ucykge1xuICBsZXQgdCxcbiAgICB0aW1lb3V0ID0gb3B0aW9ucyA/IG9wdGlvbnMudGltZW91dE1zIDogdW5kZWZpbmVkO1xuICBjb25zdCBub2RlID0gY3JlYXRlQ29tcHV0YXRpb24oKCkgPT4ge1xuICAgIGlmICghdCB8fCAhdC5mbikgdCA9IHJlcXVlc3RDYWxsYmFjaygoKSA9PiBzZXREZWZlcnJlZCgoKSA9PiBub2RlLnZhbHVlKSwgdGltZW91dCAhPT0gdW5kZWZpbmVkID8ge1xuICAgICAgdGltZW91dFxuICAgIH0gOiB1bmRlZmluZWQpO1xuICAgIHJldHVybiBzb3VyY2UoKTtcbiAgfSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgY29uc3QgW2RlZmVycmVkLCBzZXREZWZlcnJlZF0gPSBjcmVhdGVTaWduYWwoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSwgb3B0aW9ucyk7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICBzZXREZWZlcnJlZCgoKSA9PiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlKTtcbiAgcmV0dXJuIGRlZmVycmVkO1xufVxuZnVuY3Rpb24gY3JlYXRlU2VsZWN0b3Ioc291cmNlLCBmbiA9IGVxdWFsRm4sIG9wdGlvbnMpIHtcbiAgY29uc3Qgc3VicyA9IG5ldyBNYXAoKTtcbiAgY29uc3Qgbm9kZSA9IGNyZWF0ZUNvbXB1dGF0aW9uKHAgPT4ge1xuICAgIGNvbnN0IHYgPSBzb3VyY2UoKTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2Ygc3Vicy5lbnRyaWVzKCkpIGlmIChmbihrZXksIHYpICE9PSBmbihrZXksIHApKSB7XG4gICAgICBmb3IgKGNvbnN0IGMgb2YgdmFsLnZhbHVlcygpKSB7XG4gICAgICAgIGMuc3RhdGUgPSBTVEFMRTtcbiAgICAgICAgaWYgKGMucHVyZSkgVXBkYXRlcy5wdXNoKGMpO2Vsc2UgRWZmZWN0cy5wdXNoKGMpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfSwgdW5kZWZpbmVkLCB0cnVlLCBTVEFMRSwgb3B0aW9ucyApO1xuICB1cGRhdGVDb21wdXRhdGlvbihub2RlKTtcbiAgcmV0dXJuIGtleSA9PiB7XG4gICAgY29uc3QgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgICBpZiAobGlzdGVuZXIpIHtcbiAgICAgIGxldCBsO1xuICAgICAgaWYgKGwgPSBzdWJzLmdldChrZXkpKSBsLmFkZChsaXN0ZW5lcik7ZWxzZSBzdWJzLnNldChrZXksIGwgPSBuZXcgU2V0KFtsaXN0ZW5lcl0pKTtcbiAgICAgIG9uQ2xlYW51cCgoKSA9PiB7XG4gICAgICAgIGwuZGVsZXRlKGxpc3RlbmVyKTtcbiAgICAgICAgIWwuc2l6ZSAmJiBzdWJzLmRlbGV0ZShrZXkpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBmbihrZXksIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUpO1xuICB9O1xufVxuZnVuY3Rpb24gYmF0Y2goZm4pIHtcbiAgcmV0dXJuIHJ1blVwZGF0ZXMoZm4sIGZhbHNlKTtcbn1cbmZ1bmN0aW9uIHVudHJhY2soZm4pIHtcbiAgaWYgKCFFeHRlcm5hbFNvdXJjZUNvbmZpZyAmJiBMaXN0ZW5lciA9PT0gbnVsbCkgcmV0dXJuIGZuKCk7XG4gIGNvbnN0IGxpc3RlbmVyID0gTGlzdGVuZXI7XG4gIExpc3RlbmVyID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcpIHJldHVybiBFeHRlcm5hbFNvdXJjZUNvbmZpZy51bnRyYWNrKGZuKTtcbiAgICByZXR1cm4gZm4oKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICB9XG59XG5mdW5jdGlvbiBvbihkZXBzLCBmbiwgb3B0aW9ucykge1xuICBjb25zdCBpc0FycmF5ID0gQXJyYXkuaXNBcnJheShkZXBzKTtcbiAgbGV0IHByZXZJbnB1dDtcbiAgbGV0IGRlZmVyID0gb3B0aW9ucyAmJiBvcHRpb25zLmRlZmVyO1xuICByZXR1cm4gcHJldlZhbHVlID0+IHtcbiAgICBsZXQgaW5wdXQ7XG4gICAgaWYgKGlzQXJyYXkpIHtcbiAgICAgIGlucHV0ID0gQXJyYXkoZGVwcy5sZW5ndGgpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZXBzLmxlbmd0aDsgaSsrKSBpbnB1dFtpXSA9IGRlcHNbaV0oKTtcbiAgICB9IGVsc2UgaW5wdXQgPSBkZXBzKCk7XG4gICAgaWYgKGRlZmVyKSB7XG4gICAgICBkZWZlciA9IGZhbHNlO1xuICAgICAgcmV0dXJuIHByZXZWYWx1ZTtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gdW50cmFjaygoKSA9PiBmbihpbnB1dCwgcHJldklucHV0LCBwcmV2VmFsdWUpKTtcbiAgICBwcmV2SW5wdXQgPSBpbnB1dDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xufVxuZnVuY3Rpb24gb25Nb3VudChmbikge1xuICBjcmVhdGVFZmZlY3QoKCkgPT4gdW50cmFjayhmbikpO1xufVxuZnVuY3Rpb24gb25DbGVhbnVwKGZuKSB7XG4gIGlmIChPd25lciA9PT0gbnVsbCkgY29uc29sZS53YXJuKFwiY2xlYW51cHMgY3JlYXRlZCBvdXRzaWRlIGEgYGNyZWF0ZVJvb3RgIG9yIGByZW5kZXJgIHdpbGwgbmV2ZXIgYmUgcnVuXCIpO2Vsc2UgaWYgKE93bmVyLmNsZWFudXBzID09PSBudWxsKSBPd25lci5jbGVhbnVwcyA9IFtmbl07ZWxzZSBPd25lci5jbGVhbnVwcy5wdXNoKGZuKTtcbiAgcmV0dXJuIGZuO1xufVxuZnVuY3Rpb24gY2F0Y2hFcnJvcihmbiwgaGFuZGxlcikge1xuICBFUlJPUiB8fCAoRVJST1IgPSBTeW1ib2woXCJlcnJvclwiKSk7XG4gIE93bmVyID0gY3JlYXRlQ29tcHV0YXRpb24odW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuICBPd25lci5jb250ZXh0ID0ge1xuICAgIC4uLk93bmVyLmNvbnRleHQsXG4gICAgW0VSUk9SXTogW2hhbmRsZXJdXG4gIH07XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgVHJhbnNpdGlvbi5zb3VyY2VzLmFkZChPd25lcik7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGZuKCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGhhbmRsZUVycm9yKGVycik7XG4gIH0gZmluYWxseSB7XG4gICAgT3duZXIgPSBPd25lci5vd25lcjtcbiAgfVxufVxuZnVuY3Rpb24gZ2V0TGlzdGVuZXIoKSB7XG4gIHJldHVybiBMaXN0ZW5lcjtcbn1cbmZ1bmN0aW9uIGdldE93bmVyKCkge1xuICByZXR1cm4gT3duZXI7XG59XG5mdW5jdGlvbiBydW5XaXRoT3duZXIobywgZm4pIHtcbiAgY29uc3QgcHJldiA9IE93bmVyO1xuICBjb25zdCBwcmV2TGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgT3duZXIgPSBvO1xuICBMaXN0ZW5lciA9IG51bGw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJ1blVwZGF0ZXMoZm4sIHRydWUpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBoYW5kbGVFcnJvcihlcnIpO1xuICB9IGZpbmFsbHkge1xuICAgIE93bmVyID0gcHJldjtcbiAgICBMaXN0ZW5lciA9IHByZXZMaXN0ZW5lcjtcbiAgfVxufVxuZnVuY3Rpb24gZW5hYmxlU2NoZWR1bGluZyhzY2hlZHVsZXIgPSByZXF1ZXN0Q2FsbGJhY2spIHtcbiAgU2NoZWR1bGVyID0gc2NoZWR1bGVyO1xufVxuZnVuY3Rpb24gc3RhcnRUcmFuc2l0aW9uKGZuKSB7XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGZuKCk7XG4gICAgcmV0dXJuIFRyYW5zaXRpb24uZG9uZTtcbiAgfVxuICBjb25zdCBsID0gTGlzdGVuZXI7XG4gIGNvbnN0IG8gPSBPd25lcjtcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oKCkgPT4ge1xuICAgIExpc3RlbmVyID0gbDtcbiAgICBPd25lciA9IG87XG4gICAgbGV0IHQ7XG4gICAgaWYgKFNjaGVkdWxlciB8fCBTdXNwZW5zZUNvbnRleHQpIHtcbiAgICAgIHQgPSBUcmFuc2l0aW9uIHx8IChUcmFuc2l0aW9uID0ge1xuICAgICAgICBzb3VyY2VzOiBuZXcgU2V0KCksXG4gICAgICAgIGVmZmVjdHM6IFtdLFxuICAgICAgICBwcm9taXNlczogbmV3IFNldCgpLFxuICAgICAgICBkaXNwb3NlZDogbmV3IFNldCgpLFxuICAgICAgICBxdWV1ZTogbmV3IFNldCgpLFxuICAgICAgICBydW5uaW5nOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIHQuZG9uZSB8fCAodC5kb25lID0gbmV3IFByb21pc2UocmVzID0+IHQucmVzb2x2ZSA9IHJlcykpO1xuICAgICAgdC5ydW5uaW5nID0gdHJ1ZTtcbiAgICB9XG4gICAgcnVuVXBkYXRlcyhmbiwgZmFsc2UpO1xuICAgIExpc3RlbmVyID0gT3duZXIgPSBudWxsO1xuICAgIHJldHVybiB0ID8gdC5kb25lIDogdW5kZWZpbmVkO1xuICB9KTtcbn1cbmNvbnN0IFt0cmFuc1BlbmRpbmcsIHNldFRyYW5zUGVuZGluZ10gPSAvKkBfX1BVUkVfXyovY3JlYXRlU2lnbmFsKGZhbHNlKTtcbmZ1bmN0aW9uIHVzZVRyYW5zaXRpb24oKSB7XG4gIHJldHVybiBbdHJhbnNQZW5kaW5nLCBzdGFydFRyYW5zaXRpb25dO1xufVxuZnVuY3Rpb24gcmVzdW1lRWZmZWN0cyhlKSB7XG4gIEVmZmVjdHMucHVzaC5hcHBseShFZmZlY3RzLCBlKTtcbiAgZS5sZW5ndGggPSAwO1xufVxuZnVuY3Rpb24gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzKSB7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB1bnRyYWNrKCgpID0+IHtcbiAgICBPYmplY3QuYXNzaWduKENvbXAsIHtcbiAgICAgIFskREVWQ09NUF06IHRydWVcbiAgICB9KTtcbiAgICByZXR1cm4gQ29tcChwcm9wcyk7XG4gIH0pLCB1bmRlZmluZWQsIHRydWUsIDApO1xuICBjLnByb3BzID0gcHJvcHM7XG4gIGMub2JzZXJ2ZXJzID0gbnVsbDtcbiAgYy5vYnNlcnZlclNsb3RzID0gbnVsbDtcbiAgYy5uYW1lID0gQ29tcC5uYW1lO1xuICBjLmNvbXBvbmVudCA9IENvbXA7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICByZXR1cm4gYy50VmFsdWUgIT09IHVuZGVmaW5lZCA/IGMudFZhbHVlIDogYy52YWx1ZTtcbn1cbmZ1bmN0aW9uIHJlZ2lzdGVyR3JhcGgodmFsdWUpIHtcbiAgaWYgKE93bmVyKSB7XG4gICAgaWYgKE93bmVyLnNvdXJjZU1hcCkgT3duZXIuc291cmNlTWFwLnB1c2godmFsdWUpO2Vsc2UgT3duZXIuc291cmNlTWFwID0gW3ZhbHVlXTtcbiAgICB2YWx1ZS5ncmFwaCA9IE93bmVyO1xuICB9XG4gIGlmIChEZXZIb29rcy5hZnRlclJlZ2lzdGVyR3JhcGgpIERldkhvb2tzLmFmdGVyUmVnaXN0ZXJHcmFwaCh2YWx1ZSk7XG59XG5mdW5jdGlvbiBjcmVhdGVDb250ZXh0KGRlZmF1bHRWYWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBpZCA9IFN5bWJvbChcImNvbnRleHRcIik7XG4gIHJldHVybiB7XG4gICAgaWQsXG4gICAgUHJvdmlkZXI6IGNyZWF0ZVByb3ZpZGVyKGlkLCBvcHRpb25zKSxcbiAgICBkZWZhdWx0VmFsdWVcbiAgfTtcbn1cbmZ1bmN0aW9uIHVzZUNvbnRleHQoY29udGV4dCkge1xuICBsZXQgdmFsdWU7XG4gIHJldHVybiBPd25lciAmJiBPd25lci5jb250ZXh0ICYmICh2YWx1ZSA9IE93bmVyLmNvbnRleHRbY29udGV4dC5pZF0pICE9PSB1bmRlZmluZWQgPyB2YWx1ZSA6IGNvbnRleHQuZGVmYXVsdFZhbHVlO1xufVxuZnVuY3Rpb24gY2hpbGRyZW4oZm4pIHtcbiAgY29uc3QgY2hpbGRyZW4gPSBjcmVhdGVNZW1vKGZuKTtcbiAgY29uc3QgbWVtbyA9IGNyZWF0ZU1lbW8oKCkgPT4gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKCkpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImNoaWxkcmVuXCJcbiAgfSkgO1xuICBtZW1vLnRvQXJyYXkgPSAoKSA9PiB7XG4gICAgY29uc3QgYyA9IG1lbW8oKTtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShjKSA/IGMgOiBjICE9IG51bGwgPyBbY10gOiBbXTtcbiAgfTtcbiAgcmV0dXJuIG1lbW87XG59XG5sZXQgU3VzcGVuc2VDb250ZXh0O1xuZnVuY3Rpb24gZ2V0U3VzcGVuc2VDb250ZXh0KCkge1xuICByZXR1cm4gU3VzcGVuc2VDb250ZXh0IHx8IChTdXNwZW5zZUNvbnRleHQgPSBjcmVhdGVDb250ZXh0KCkpO1xufVxuZnVuY3Rpb24gZW5hYmxlRXh0ZXJuYWxTb3VyY2UoZmFjdG9yeSwgdW50cmFjayA9IGZuID0+IGZuKCkpIHtcbiAgaWYgKEV4dGVybmFsU291cmNlQ29uZmlnKSB7XG4gICAgY29uc3Qge1xuICAgICAgZmFjdG9yeTogb2xkRmFjdG9yeSxcbiAgICAgIHVudHJhY2s6IG9sZFVudHJhY2tcbiAgICB9ID0gRXh0ZXJuYWxTb3VyY2VDb25maWc7XG4gICAgRXh0ZXJuYWxTb3VyY2VDb25maWcgPSB7XG4gICAgICBmYWN0b3J5OiAoZm4sIHRyaWdnZXIpID0+IHtcbiAgICAgICAgY29uc3Qgb2xkU291cmNlID0gb2xkRmFjdG9yeShmbiwgdHJpZ2dlcik7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IGZhY3RvcnkoeCA9PiBvbGRTb3VyY2UudHJhY2soeCksIHRyaWdnZXIpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHRyYWNrOiB4ID0+IHNvdXJjZS50cmFjayh4KSxcbiAgICAgICAgICBkaXNwb3NlKCkge1xuICAgICAgICAgICAgc291cmNlLmRpc3Bvc2UoKTtcbiAgICAgICAgICAgIG9sZFNvdXJjZS5kaXNwb3NlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIHVudHJhY2s6IGZuID0+IG9sZFVudHJhY2soKCkgPT4gdW50cmFjayhmbikpXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IHtcbiAgICAgIGZhY3RvcnksXG4gICAgICB1bnRyYWNrXG4gICAgfTtcbiAgfVxufVxuZnVuY3Rpb24gcmVhZFNpZ25hbCgpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgaWYgKHRoaXMuc291cmNlcyAmJiAocnVubmluZ1RyYW5zaXRpb24gPyB0aGlzLnRTdGF0ZSA6IHRoaXMuc3RhdGUpKSB7XG4gICAgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IHRoaXMudFN0YXRlIDogdGhpcy5zdGF0ZSkgPT09IFNUQUxFKSB1cGRhdGVDb21wdXRhdGlvbih0aGlzKTtlbHNlIHtcbiAgICAgIGNvbnN0IHVwZGF0ZXMgPSBVcGRhdGVzO1xuICAgICAgVXBkYXRlcyA9IG51bGw7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IGxvb2tVcHN0cmVhbSh0aGlzKSwgZmFsc2UpO1xuICAgICAgVXBkYXRlcyA9IHVwZGF0ZXM7XG4gICAgfVxuICB9XG4gIGlmIChMaXN0ZW5lcikge1xuICAgIGNvbnN0IHNTbG90ID0gdGhpcy5vYnNlcnZlcnMgPyB0aGlzLm9ic2VydmVycy5sZW5ndGggOiAwO1xuICAgIGlmICghTGlzdGVuZXIuc291cmNlcykge1xuICAgICAgTGlzdGVuZXIuc291cmNlcyA9IFt0aGlzXTtcbiAgICAgIExpc3RlbmVyLnNvdXJjZVNsb3RzID0gW3NTbG90XTtcbiAgICB9IGVsc2Uge1xuICAgICAgTGlzdGVuZXIuc291cmNlcy5wdXNoKHRoaXMpO1xuICAgICAgTGlzdGVuZXIuc291cmNlU2xvdHMucHVzaChzU2xvdCk7XG4gICAgfVxuICAgIGlmICghdGhpcy5vYnNlcnZlcnMpIHtcbiAgICAgIHRoaXMub2JzZXJ2ZXJzID0gW0xpc3RlbmVyXTtcbiAgICAgIHRoaXMub2JzZXJ2ZXJTbG90cyA9IFtMaXN0ZW5lci5zb3VyY2VzLmxlbmd0aCAtIDFdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9ic2VydmVycy5wdXNoKExpc3RlbmVyKTtcbiAgICAgIHRoaXMub2JzZXJ2ZXJTbG90cy5wdXNoKExpc3RlbmVyLnNvdXJjZXMubGVuZ3RoIC0gMSk7XG4gICAgfVxuICB9XG4gIGlmIChydW5uaW5nVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKHRoaXMpKSByZXR1cm4gdGhpcy50VmFsdWU7XG4gIHJldHVybiB0aGlzLnZhbHVlO1xufVxuZnVuY3Rpb24gd3JpdGVTaWduYWwobm9kZSwgdmFsdWUsIGlzQ29tcCkge1xuICBsZXQgY3VycmVudCA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWU7XG4gIGlmICghbm9kZS5jb21wYXJhdG9yIHx8ICFub2RlLmNvbXBhcmF0b3IoY3VycmVudCwgdmFsdWUpKSB7XG4gICAgaWYgKFRyYW5zaXRpb24pIHtcbiAgICAgIGNvbnN0IFRyYW5zaXRpb25SdW5uaW5nID0gVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgICAgaWYgKFRyYW5zaXRpb25SdW5uaW5nIHx8ICFpc0NvbXAgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSkge1xuICAgICAgICBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKG5vZGUpO1xuICAgICAgICBub2RlLnRWYWx1ZSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgaWYgKCFUcmFuc2l0aW9uUnVubmluZykgbm9kZS52YWx1ZSA9IHZhbHVlO1xuICAgIH0gZWxzZSBub2RlLnZhbHVlID0gdmFsdWU7XG4gICAgaWYgKG5vZGUub2JzZXJ2ZXJzICYmIG5vZGUub2JzZXJ2ZXJzLmxlbmd0aCkge1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vYnNlcnZlcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICBjb25zdCBvID0gbm9kZS5vYnNlcnZlcnNbaV07XG4gICAgICAgICAgY29uc3QgVHJhbnNpdGlvblJ1bm5pbmcgPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgICAgICAgICBpZiAoVHJhbnNpdGlvblJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXMobykpIGNvbnRpbnVlO1xuICAgICAgICAgIGlmIChUcmFuc2l0aW9uUnVubmluZyA/ICFvLnRTdGF0ZSA6ICFvLnN0YXRlKSB7XG4gICAgICAgICAgICBpZiAoby5wdXJlKSBVcGRhdGVzLnB1c2gobyk7ZWxzZSBFZmZlY3RzLnB1c2gobyk7XG4gICAgICAgICAgICBpZiAoby5vYnNlcnZlcnMpIG1hcmtEb3duc3RyZWFtKG8pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIVRyYW5zaXRpb25SdW5uaW5nKSBvLnN0YXRlID0gU1RBTEU7ZWxzZSBvLnRTdGF0ZSA9IFNUQUxFO1xuICAgICAgICB9XG4gICAgICAgIGlmIChVcGRhdGVzLmxlbmd0aCA+IDEwZTUpIHtcbiAgICAgICAgICBVcGRhdGVzID0gW107XG4gICAgICAgICAgaWYgKElTX0RFVikgdGhyb3cgbmV3IEVycm9yKFwiUG90ZW50aWFsIEluZmluaXRlIExvb3AgRGV0ZWN0ZWQuXCIpO1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuICAgICAgICB9XG4gICAgICB9LCBmYWxzZSk7XG4gICAgfVxuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpIHtcbiAgaWYgKCFub2RlLmZuKSByZXR1cm47XG4gIGNsZWFuTm9kZShub2RlKTtcbiAgY29uc3QgdGltZSA9IEV4ZWNDb3VudDtcbiAgcnVuQ29tcHV0YXRpb24obm9kZSwgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSwgdGltZSk7XG4gIGlmIChUcmFuc2l0aW9uICYmICFUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSkge1xuICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICBUcmFuc2l0aW9uICYmIChUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlKTtcbiAgICAgICAgTGlzdGVuZXIgPSBPd25lciA9IG5vZGU7XG4gICAgICAgIHJ1bkNvbXB1dGF0aW9uKG5vZGUsIG5vZGUudFZhbHVlLCB0aW1lKTtcbiAgICAgICAgTGlzdGVuZXIgPSBPd25lciA9IG51bGw7XG4gICAgICB9LCBmYWxzZSk7XG4gICAgfSk7XG4gIH1cbn1cbmZ1bmN0aW9uIHJ1bkNvbXB1dGF0aW9uKG5vZGUsIHZhbHVlLCB0aW1lKSB7XG4gIGxldCBuZXh0VmFsdWU7XG4gIGNvbnN0IG93bmVyID0gT3duZXIsXG4gICAgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgTGlzdGVuZXIgPSBPd25lciA9IG5vZGU7XG4gIHRyeSB7XG4gICAgbmV4dFZhbHVlID0gbm9kZS5mbih2YWx1ZSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmIChub2RlLnB1cmUpIHtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgICAgICBub2RlLnRTdGF0ZSA9IFNUQUxFO1xuICAgICAgICBub2RlLnRPd25lZCAmJiBub2RlLnRPd25lZC5mb3JFYWNoKGNsZWFuTm9kZSk7XG4gICAgICAgIG5vZGUudE93bmVkID0gdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9kZS5zdGF0ZSA9IFNUQUxFO1xuICAgICAgICBub2RlLm93bmVkICYmIG5vZGUub3duZWQuZm9yRWFjaChjbGVhbk5vZGUpO1xuICAgICAgICBub2RlLm93bmVkID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgbm9kZS51cGRhdGVkQXQgPSB0aW1lICsgMTtcbiAgICByZXR1cm4gaGFuZGxlRXJyb3IoZXJyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICAgIE93bmVyID0gb3duZXI7XG4gIH1cbiAgaWYgKCFub2RlLnVwZGF0ZWRBdCB8fCBub2RlLnVwZGF0ZWRBdCA8PSB0aW1lKSB7XG4gICAgaWYgKG5vZGUudXBkYXRlZEF0ICE9IG51bGwgJiYgXCJvYnNlcnZlcnNcIiBpbiBub2RlKSB7XG4gICAgICB3cml0ZVNpZ25hbChub2RlLCBuZXh0VmFsdWUsIHRydWUpO1xuICAgIH0gZWxzZSBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgbm9kZS5wdXJlKSB7XG4gICAgICBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKG5vZGUpO1xuICAgICAgbm9kZS50VmFsdWUgPSBuZXh0VmFsdWU7XG4gICAgfSBlbHNlIG5vZGUudmFsdWUgPSBuZXh0VmFsdWU7XG4gICAgbm9kZS51cGRhdGVkQXQgPSB0aW1lO1xuICB9XG59XG5mdW5jdGlvbiBjcmVhdGVDb21wdXRhdGlvbihmbiwgaW5pdCwgcHVyZSwgc3RhdGUgPSBTVEFMRSwgb3B0aW9ucykge1xuICBjb25zdCBjID0ge1xuICAgIGZuLFxuICAgIHN0YXRlOiBzdGF0ZSxcbiAgICB1cGRhdGVkQXQ6IG51bGwsXG4gICAgb3duZWQ6IG51bGwsXG4gICAgc291cmNlczogbnVsbCxcbiAgICBzb3VyY2VTbG90czogbnVsbCxcbiAgICBjbGVhbnVwczogbnVsbCxcbiAgICB2YWx1ZTogaW5pdCxcbiAgICBvd25lcjogT3duZXIsXG4gICAgY29udGV4dDogT3duZXIgPyBPd25lci5jb250ZXh0IDogbnVsbCxcbiAgICBwdXJlXG4gIH07XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGMuc3RhdGUgPSAwO1xuICAgIGMudFN0YXRlID0gc3RhdGU7XG4gIH1cbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJjb21wdXRhdGlvbnMgY3JlYXRlZCBvdXRzaWRlIGEgYGNyZWF0ZVJvb3RgIG9yIGByZW5kZXJgIHdpbGwgbmV2ZXIgYmUgZGlzcG9zZWRcIik7ZWxzZSBpZiAoT3duZXIgIT09IFVOT1dORUQpIHtcbiAgICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgT3duZXIucHVyZSkge1xuICAgICAgaWYgKCFPd25lci50T3duZWQpIE93bmVyLnRPd25lZCA9IFtjXTtlbHNlIE93bmVyLnRPd25lZC5wdXNoKGMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIU93bmVyLm93bmVkKSBPd25lci5vd25lZCA9IFtjXTtlbHNlIE93bmVyLm93bmVkLnB1c2goYyk7XG4gICAgfVxuICB9XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMubmFtZSkgYy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcgJiYgYy5mbikge1xuICAgIGNvbnN0IFt0cmFjaywgdHJpZ2dlcl0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICBlcXVhbHM6IGZhbHNlXG4gICAgfSk7XG4gICAgY29uc3Qgb3JkaW5hcnkgPSBFeHRlcm5hbFNvdXJjZUNvbmZpZy5mYWN0b3J5KGMuZm4sIHRyaWdnZXIpO1xuICAgIG9uQ2xlYW51cCgoKSA9PiBvcmRpbmFyeS5kaXNwb3NlKCkpO1xuICAgIGNvbnN0IHRyaWdnZXJJblRyYW5zaXRpb24gPSAoKSA9PiBzdGFydFRyYW5zaXRpb24odHJpZ2dlcikudGhlbigoKSA9PiBpblRyYW5zaXRpb24uZGlzcG9zZSgpKTtcbiAgICBjb25zdCBpblRyYW5zaXRpb24gPSBFeHRlcm5hbFNvdXJjZUNvbmZpZy5mYWN0b3J5KGMuZm4sIHRyaWdnZXJJblRyYW5zaXRpb24pO1xuICAgIGMuZm4gPSB4ID0+IHtcbiAgICAgIHRyYWNrKCk7XG4gICAgICByZXR1cm4gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgPyBpblRyYW5zaXRpb24udHJhY2soeCkgOiBvcmRpbmFyeS50cmFjayh4KTtcbiAgICB9O1xuICB9XG4gIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIgJiYgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lcihjKTtcbiAgcmV0dXJuIGM7XG59XG5mdW5jdGlvbiBydW5Ub3Aobm9kZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gMCkgcmV0dXJuO1xuICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gUEVORElORykgcmV0dXJuIGxvb2tVcHN0cmVhbShub2RlKTtcbiAgaWYgKG5vZGUuc3VzcGVuc2UgJiYgdW50cmFjayhub2RlLnN1c3BlbnNlLmluRmFsbGJhY2spKSByZXR1cm4gbm9kZS5zdXNwZW5zZS5lZmZlY3RzLnB1c2gobm9kZSk7XG4gIGNvbnN0IGFuY2VzdG9ycyA9IFtub2RlXTtcbiAgd2hpbGUgKChub2RlID0gbm9kZS5vd25lcikgJiYgKCFub2RlLnVwZGF0ZWRBdCB8fCBub2RlLnVwZGF0ZWRBdCA8IEV4ZWNDb3VudCkpIHtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXMobm9kZSkpIHJldHVybjtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpIGFuY2VzdG9ycy5wdXNoKG5vZGUpO1xuICB9XG4gIGZvciAobGV0IGkgPSBhbmNlc3RvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBub2RlID0gYW5jZXN0b3JzW2ldO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbikge1xuICAgICAgbGV0IHRvcCA9IG5vZGUsXG4gICAgICAgIHByZXYgPSBhbmNlc3RvcnNbaSArIDFdO1xuICAgICAgd2hpbGUgKCh0b3AgPSB0b3Aub3duZXIpICYmIHRvcCAhPT0gcHJldikge1xuICAgICAgICBpZiAoVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXModG9wKSkgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gU1RBTEUpIHtcbiAgICAgIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICAgIH0gZWxzZSBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gUEVORElORykge1xuICAgICAgY29uc3QgdXBkYXRlcyA9IFVwZGF0ZXM7XG4gICAgICBVcGRhdGVzID0gbnVsbDtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4gbG9va1Vwc3RyZWFtKG5vZGUsIGFuY2VzdG9yc1swXSksIGZhbHNlKTtcbiAgICAgIFVwZGF0ZXMgPSB1cGRhdGVzO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gcnVuVXBkYXRlcyhmbiwgaW5pdCkge1xuICBpZiAoVXBkYXRlcykgcmV0dXJuIGZuKCk7XG4gIGxldCB3YWl0ID0gZmFsc2U7XG4gIGlmICghaW5pdCkgVXBkYXRlcyA9IFtdO1xuICBpZiAoRWZmZWN0cykgd2FpdCA9IHRydWU7ZWxzZSBFZmZlY3RzID0gW107XG4gIEV4ZWNDb3VudCsrO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGZuKCk7XG4gICAgY29tcGxldGVVcGRhdGVzKHdhaXQpO1xuICAgIHJldHVybiByZXM7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmICghd2FpdCkgRWZmZWN0cyA9IG51bGw7XG4gICAgVXBkYXRlcyA9IG51bGw7XG4gICAgaGFuZGxlRXJyb3IoZXJyKTtcbiAgfVxufVxuZnVuY3Rpb24gY29tcGxldGVVcGRhdGVzKHdhaXQpIHtcbiAgaWYgKFVwZGF0ZXMpIHtcbiAgICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBzY2hlZHVsZVF1ZXVlKFVwZGF0ZXMpO2Vsc2UgcnVuUXVldWUoVXBkYXRlcyk7XG4gICAgVXBkYXRlcyA9IG51bGw7XG4gIH1cbiAgaWYgKHdhaXQpIHJldHVybjtcbiAgbGV0IHJlcztcbiAgaWYgKFRyYW5zaXRpb24pIHtcbiAgICBpZiAoIVRyYW5zaXRpb24ucHJvbWlzZXMuc2l6ZSAmJiAhVHJhbnNpdGlvbi5xdWV1ZS5zaXplKSB7XG4gICAgICBjb25zdCBzb3VyY2VzID0gVHJhbnNpdGlvbi5zb3VyY2VzO1xuICAgICAgY29uc3QgZGlzcG9zZWQgPSBUcmFuc2l0aW9uLmRpc3Bvc2VkO1xuICAgICAgRWZmZWN0cy5wdXNoLmFwcGx5KEVmZmVjdHMsIFRyYW5zaXRpb24uZWZmZWN0cyk7XG4gICAgICByZXMgPSBUcmFuc2l0aW9uLnJlc29sdmU7XG4gICAgICBmb3IgKGNvbnN0IGUgb2YgRWZmZWN0cykge1xuICAgICAgICBcInRTdGF0ZVwiIGluIGUgJiYgKGUuc3RhdGUgPSBlLnRTdGF0ZSk7XG4gICAgICAgIGRlbGV0ZSBlLnRTdGF0ZTtcbiAgICAgIH1cbiAgICAgIFRyYW5zaXRpb24gPSBudWxsO1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgZCBvZiBkaXNwb3NlZCkgY2xlYW5Ob2RlKGQpO1xuICAgICAgICBmb3IgKGNvbnN0IHYgb2Ygc291cmNlcykge1xuICAgICAgICAgIHYudmFsdWUgPSB2LnRWYWx1ZTtcbiAgICAgICAgICBpZiAodi5vd25lZCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHYub3duZWQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIGNsZWFuTm9kZSh2Lm93bmVkW2ldKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHYudE93bmVkKSB2Lm93bmVkID0gdi50T3duZWQ7XG4gICAgICAgICAgZGVsZXRlIHYudFZhbHVlO1xuICAgICAgICAgIGRlbGV0ZSB2LnRPd25lZDtcbiAgICAgICAgICB2LnRTdGF0ZSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgc2V0VHJhbnNQZW5kaW5nKGZhbHNlKTtcbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKFRyYW5zaXRpb24ucnVubmluZykge1xuICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gZmFsc2U7XG4gICAgICBUcmFuc2l0aW9uLmVmZmVjdHMucHVzaC5hcHBseShUcmFuc2l0aW9uLmVmZmVjdHMsIEVmZmVjdHMpO1xuICAgICAgRWZmZWN0cyA9IG51bGw7XG4gICAgICBzZXRUcmFuc1BlbmRpbmcodHJ1ZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG4gIGNvbnN0IGUgPSBFZmZlY3RzO1xuICBFZmZlY3RzID0gbnVsbDtcbiAgaWYgKGUubGVuZ3RoKSBydW5VcGRhdGVzKCgpID0+IHJ1bkVmZmVjdHMoZSksIGZhbHNlKTtlbHNlIERldkhvb2tzLmFmdGVyVXBkYXRlICYmIERldkhvb2tzLmFmdGVyVXBkYXRlKCk7XG4gIGlmIChyZXMpIHJlcygpO1xufVxuZnVuY3Rpb24gcnVuUXVldWUocXVldWUpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykgcnVuVG9wKHF1ZXVlW2ldKTtcbn1cbmZ1bmN0aW9uIHNjaGVkdWxlUXVldWUocXVldWUpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGl0ZW0gPSBxdWV1ZVtpXTtcbiAgICBjb25zdCB0YXNrcyA9IFRyYW5zaXRpb24ucXVldWU7XG4gICAgaWYgKCF0YXNrcy5oYXMoaXRlbSkpIHtcbiAgICAgIHRhc2tzLmFkZChpdGVtKTtcbiAgICAgIFNjaGVkdWxlcigoKSA9PiB7XG4gICAgICAgIHRhc2tzLmRlbGV0ZShpdGVtKTtcbiAgICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICBydW5Ub3AoaXRlbSk7XG4gICAgICAgIH0sIGZhbHNlKTtcbiAgICAgICAgVHJhbnNpdGlvbiAmJiAoVHJhbnNpdGlvbi5ydW5uaW5nID0gZmFsc2UpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBydW5Vc2VyRWZmZWN0cyhxdWV1ZSkge1xuICBsZXQgaSxcbiAgICB1c2VyTGVuZ3RoID0gMDtcbiAgZm9yIChpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZSA9IHF1ZXVlW2ldO1xuICAgIGlmICghZS51c2VyKSBydW5Ub3AoZSk7ZWxzZSBxdWV1ZVt1c2VyTGVuZ3RoKytdID0gZTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmNvdW50KSB7XG4gICAgICBzaGFyZWRDb25maWcuZWZmZWN0cyB8fCAoc2hhcmVkQ29uZmlnLmVmZmVjdHMgPSBbXSk7XG4gICAgICBzaGFyZWRDb25maWcuZWZmZWN0cy5wdXNoKC4uLnF1ZXVlLnNsaWNlKDAsIHVzZXJMZW5ndGgpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmVmZmVjdHMgJiYgKHNoYXJlZENvbmZpZy5kb25lIHx8ICFzaGFyZWRDb25maWcuY291bnQpKSB7XG4gICAgcXVldWUgPSBbLi4uc2hhcmVkQ29uZmlnLmVmZmVjdHMsIC4uLnF1ZXVlXTtcbiAgICB1c2VyTGVuZ3RoICs9IHNoYXJlZENvbmZpZy5lZmZlY3RzLmxlbmd0aDtcbiAgICBkZWxldGUgc2hhcmVkQ29uZmlnLmVmZmVjdHM7XG4gIH1cbiAgZm9yIChpID0gMDsgaSA8IHVzZXJMZW5ndGg7IGkrKykgcnVuVG9wKHF1ZXVlW2ldKTtcbn1cbmZ1bmN0aW9uIGxvb2tVcHN0cmVhbShub2RlLCBpZ25vcmUpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uKSBub2RlLnRTdGF0ZSA9IDA7ZWxzZSBub2RlLnN0YXRlID0gMDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLnNvdXJjZXMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBjb25zdCBzb3VyY2UgPSBub2RlLnNvdXJjZXNbaV07XG4gICAgaWYgKHNvdXJjZS5zb3VyY2VzKSB7XG4gICAgICBjb25zdCBzdGF0ZSA9IHJ1bm5pbmdUcmFuc2l0aW9uID8gc291cmNlLnRTdGF0ZSA6IHNvdXJjZS5zdGF0ZTtcbiAgICAgIGlmIChzdGF0ZSA9PT0gU1RBTEUpIHtcbiAgICAgICAgaWYgKHNvdXJjZSAhPT0gaWdub3JlICYmICghc291cmNlLnVwZGF0ZWRBdCB8fCBzb3VyY2UudXBkYXRlZEF0IDwgRXhlY0NvdW50KSkgcnVuVG9wKHNvdXJjZSk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBQRU5ESU5HKSBsb29rVXBzdHJlYW0oc291cmNlLCBpZ25vcmUpO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gbWFya0Rvd25zdHJlYW0obm9kZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUub2JzZXJ2ZXJzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgY29uc3QgbyA9IG5vZGUub2JzZXJ2ZXJzW2ldO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiA/ICFvLnRTdGF0ZSA6ICFvLnN0YXRlKSB7XG4gICAgICBpZiAocnVubmluZ1RyYW5zaXRpb24pIG8udFN0YXRlID0gUEVORElORztlbHNlIG8uc3RhdGUgPSBQRU5ESU5HO1xuICAgICAgaWYgKG8ucHVyZSkgVXBkYXRlcy5wdXNoKG8pO2Vsc2UgRWZmZWN0cy5wdXNoKG8pO1xuICAgICAgby5vYnNlcnZlcnMgJiYgbWFya0Rvd25zdHJlYW0obyk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBjbGVhbk5vZGUobm9kZSkge1xuICBsZXQgaTtcbiAgaWYgKG5vZGUuc291cmNlcykge1xuICAgIHdoaWxlIChub2RlLnNvdXJjZXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBzb3VyY2UgPSBub2RlLnNvdXJjZXMucG9wKCksXG4gICAgICAgIGluZGV4ID0gbm9kZS5zb3VyY2VTbG90cy5wb3AoKSxcbiAgICAgICAgb2JzID0gc291cmNlLm9ic2VydmVycztcbiAgICAgIGlmIChvYnMgJiYgb2JzLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBuID0gb2JzLnBvcCgpLFxuICAgICAgICAgIHMgPSBzb3VyY2Uub2JzZXJ2ZXJTbG90cy5wb3AoKTtcbiAgICAgICAgaWYgKGluZGV4IDwgb2JzLmxlbmd0aCkge1xuICAgICAgICAgIG4uc291cmNlU2xvdHNbc10gPSBpbmRleDtcbiAgICAgICAgICBvYnNbaW5kZXhdID0gbjtcbiAgICAgICAgICBzb3VyY2Uub2JzZXJ2ZXJTbG90c1tpbmRleF0gPSBzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChub2RlLnRPd25lZCkge1xuICAgIGZvciAoaSA9IG5vZGUudE93bmVkLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBjbGVhbk5vZGUobm9kZS50T3duZWRbaV0pO1xuICAgIGRlbGV0ZSBub2RlLnRPd25lZDtcbiAgfVxuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgbm9kZS5wdXJlKSB7XG4gICAgcmVzZXQobm9kZSwgdHJ1ZSk7XG4gIH0gZWxzZSBpZiAobm9kZS5vd25lZCkge1xuICAgIGZvciAoaSA9IG5vZGUub3duZWQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGNsZWFuTm9kZShub2RlLm93bmVkW2ldKTtcbiAgICBub2RlLm93bmVkID0gbnVsbDtcbiAgfVxuICBpZiAobm9kZS5jbGVhbnVwcykge1xuICAgIGZvciAoaSA9IG5vZGUuY2xlYW51cHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIG5vZGUuY2xlYW51cHNbaV0oKTtcbiAgICBub2RlLmNsZWFudXBzID0gbnVsbDtcbiAgfVxuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIG5vZGUudFN0YXRlID0gMDtlbHNlIG5vZGUuc3RhdGUgPSAwO1xuICBkZWxldGUgbm9kZS5zb3VyY2VNYXA7XG59XG5mdW5jdGlvbiByZXNldChub2RlLCB0b3ApIHtcbiAgaWYgKCF0b3ApIHtcbiAgICBub2RlLnRTdGF0ZSA9IDA7XG4gICAgVHJhbnNpdGlvbi5kaXNwb3NlZC5hZGQobm9kZSk7XG4gIH1cbiAgaWYgKG5vZGUub3duZWQpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUub3duZWQubGVuZ3RoOyBpKyspIHJlc2V0KG5vZGUub3duZWRbaV0pO1xuICB9XG59XG5mdW5jdGlvbiBjYXN0RXJyb3IoZXJyKSB7XG4gIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikgcmV0dXJuIGVycjtcbiAgcmV0dXJuIG5ldyBFcnJvcih0eXBlb2YgZXJyID09PSBcInN0cmluZ1wiID8gZXJyIDogXCJVbmtub3duIGVycm9yXCIsIHtcbiAgICBjYXVzZTogZXJyXG4gIH0pO1xufVxuZnVuY3Rpb24gcnVuRXJyb3JzKGVyciwgZm5zLCBvd25lcikge1xuICB0cnkge1xuICAgIGZvciAoY29uc3QgZiBvZiBmbnMpIGYoZXJyKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGhhbmRsZUVycm9yKGUsIG93bmVyICYmIG93bmVyLm93bmVyIHx8IG51bGwpO1xuICB9XG59XG5mdW5jdGlvbiBoYW5kbGVFcnJvcihlcnIsIG93bmVyID0gT3duZXIpIHtcbiAgY29uc3QgZm5zID0gRVJST1IgJiYgb3duZXIgJiYgb3duZXIuY29udGV4dCAmJiBvd25lci5jb250ZXh0W0VSUk9SXTtcbiAgY29uc3QgZXJyb3IgPSBjYXN0RXJyb3IoZXJyKTtcbiAgaWYgKCFmbnMpIHRocm93IGVycm9yO1xuICBpZiAoRWZmZWN0cykgRWZmZWN0cy5wdXNoKHtcbiAgICBmbigpIHtcbiAgICAgIHJ1bkVycm9ycyhlcnJvciwgZm5zLCBvd25lcik7XG4gICAgfSxcbiAgICBzdGF0ZTogU1RBTEVcbiAgfSk7ZWxzZSBydW5FcnJvcnMoZXJyb3IsIGZucywgb3duZXIpO1xufVxuZnVuY3Rpb24gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKSB7XG4gIGlmICh0eXBlb2YgY2hpbGRyZW4gPT09IFwiZnVuY3Rpb25cIiAmJiAhY2hpbGRyZW4ubGVuZ3RoKSByZXR1cm4gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKCkpO1xuICBpZiAoQXJyYXkuaXNBcnJheShjaGlsZHJlbikpIHtcbiAgICBjb25zdCByZXN1bHRzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgcmVzdWx0ID0gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuW2ldKTtcbiAgICAgIEFycmF5LmlzQXJyYXkocmVzdWx0KSA/IHJlc3VsdHMucHVzaC5hcHBseShyZXN1bHRzLCByZXN1bHQpIDogcmVzdWx0cy5wdXNoKHJlc3VsdCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG4gIHJldHVybiBjaGlsZHJlbjtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVByb3ZpZGVyKGlkLCBvcHRpb25zKSB7XG4gIHJldHVybiBmdW5jdGlvbiBwcm92aWRlcihwcm9wcykge1xuICAgIGxldCByZXM7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHJlcyA9IHVudHJhY2soKCkgPT4ge1xuICAgICAgT3duZXIuY29udGV4dCA9IHtcbiAgICAgICAgLi4uT3duZXIuY29udGV4dCxcbiAgICAgICAgW2lkXTogcHJvcHMudmFsdWVcbiAgICAgIH07XG4gICAgICByZXR1cm4gY2hpbGRyZW4oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICAgIH0pLCB1bmRlZmluZWQsIG9wdGlvbnMpO1xuICAgIHJldHVybiByZXM7XG4gIH07XG59XG5mdW5jdGlvbiBvbkVycm9yKGZuKSB7XG4gIEVSUk9SIHx8IChFUlJPUiA9IFN5bWJvbChcImVycm9yXCIpKTtcbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJlcnJvciBoYW5kbGVycyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBydW5cIik7ZWxzZSBpZiAoT3duZXIuY29udGV4dCA9PT0gbnVsbCB8fCAhT3duZXIuY29udGV4dFtFUlJPUl0pIHtcbiAgICBPd25lci5jb250ZXh0ID0ge1xuICAgICAgLi4uT3duZXIuY29udGV4dCxcbiAgICAgIFtFUlJPUl06IFtmbl1cbiAgICB9O1xuICAgIG11dGF0ZUNvbnRleHQoT3duZXIsIEVSUk9SLCBbZm5dKTtcbiAgfSBlbHNlIE93bmVyLmNvbnRleHRbRVJST1JdLnB1c2goZm4pO1xufVxuZnVuY3Rpb24gbXV0YXRlQ29udGV4dChvLCBrZXksIHZhbHVlKSB7XG4gIGlmIChvLm93bmVkKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvLm93bmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoby5vd25lZFtpXS5jb250ZXh0ID09PSBvLmNvbnRleHQpIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICBpZiAoIW8ub3duZWRbaV0uY29udGV4dCkge1xuICAgICAgICBvLm93bmVkW2ldLmNvbnRleHQgPSBvLmNvbnRleHQ7XG4gICAgICAgIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKCFvLm93bmVkW2ldLmNvbnRleHRba2V5XSkge1xuICAgICAgICBvLm93bmVkW2ldLmNvbnRleHRba2V5XSA9IHZhbHVlO1xuICAgICAgICBtdXRhdGVDb250ZXh0KG8ub3duZWRbaV0sIGtleSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBvYnNlcnZhYmxlKGlucHV0KSB7XG4gIHJldHVybiB7XG4gICAgc3Vic2NyaWJlKG9ic2VydmVyKSB7XG4gICAgICBpZiAoIShvYnNlcnZlciBpbnN0YW5jZW9mIE9iamVjdCkgfHwgb2JzZXJ2ZXIgPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRXhwZWN0ZWQgdGhlIG9ic2VydmVyIHRvIGJlIGFuIG9iamVjdC5cIik7XG4gICAgICB9XG4gICAgICBjb25zdCBoYW5kbGVyID0gdHlwZW9mIG9ic2VydmVyID09PSBcImZ1bmN0aW9uXCIgPyBvYnNlcnZlciA6IG9ic2VydmVyLm5leHQgJiYgb2JzZXJ2ZXIubmV4dC5iaW5kKG9ic2VydmVyKTtcbiAgICAgIGlmICghaGFuZGxlcikge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHVuc3Vic2NyaWJlKCkge31cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRpc3Bvc2UgPSBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgICBjb25zdCB2ID0gaW5wdXQoKTtcbiAgICAgICAgICB1bnRyYWNrKCgpID0+IGhhbmRsZXIodikpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRpc3Bvc2VyO1xuICAgICAgfSk7XG4gICAgICBpZiAoZ2V0T3duZXIoKSkgb25DbGVhbnVwKGRpc3Bvc2UpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKSB7XG4gICAgICAgICAgZGlzcG9zZSgpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0sXG4gICAgW1N5bWJvbC5vYnNlcnZhYmxlIHx8IFwiQEBvYnNlcnZhYmxlXCJdKCkge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gZnJvbShwcm9kdWNlciwgaW5pdGFsVmFsdWUgPSB1bmRlZmluZWQpIHtcbiAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoaW5pdGFsVmFsdWUsIHtcbiAgICBlcXVhbHM6IGZhbHNlXG4gIH0pO1xuICBpZiAoXCJzdWJzY3JpYmVcIiBpbiBwcm9kdWNlcikge1xuICAgIGNvbnN0IHVuc3ViID0gcHJvZHVjZXIuc3Vic2NyaWJlKHYgPT4gc2V0KCgpID0+IHYpKTtcbiAgICBvbkNsZWFudXAoKCkgPT4gXCJ1bnN1YnNjcmliZVwiIGluIHVuc3ViID8gdW5zdWIudW5zdWJzY3JpYmUoKSA6IHVuc3ViKCkpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGNsZWFuID0gcHJvZHVjZXIoc2V0KTtcbiAgICBvbkNsZWFudXAoY2xlYW4pO1xuICB9XG4gIHJldHVybiBzO1xufVxuXG5jb25zdCBGQUxMQkFDSyA9IFN5bWJvbChcImZhbGxiYWNrXCIpO1xuZnVuY3Rpb24gZGlzcG9zZShkKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZC5sZW5ndGg7IGkrKykgZFtpXSgpO1xufVxuZnVuY3Rpb24gbWFwQXJyYXkobGlzdCwgbWFwRm4sIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgaXRlbXMgPSBbXSxcbiAgICBtYXBwZWQgPSBbXSxcbiAgICBkaXNwb3NlcnMgPSBbXSxcbiAgICBsZW4gPSAwLFxuICAgIGluZGV4ZXMgPSBtYXBGbi5sZW5ndGggPiAxID8gW10gOiBudWxsO1xuICBvbkNsZWFudXAoKCkgPT4gZGlzcG9zZShkaXNwb3NlcnMpKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBsZXQgbmV3SXRlbXMgPSBsaXN0KCkgfHwgW10sXG4gICAgICBuZXdMZW4gPSBuZXdJdGVtcy5sZW5ndGgsXG4gICAgICBpLFxuICAgICAgajtcbiAgICBuZXdJdGVtc1skVFJBQ0tdO1xuICAgIHJldHVybiB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGxldCBuZXdJbmRpY2VzLCBuZXdJbmRpY2VzTmV4dCwgdGVtcCwgdGVtcGRpc3Bvc2VycywgdGVtcEluZGV4ZXMsIHN0YXJ0LCBlbmQsIG5ld0VuZCwgaXRlbTtcbiAgICAgIGlmIChuZXdMZW4gPT09IDApIHtcbiAgICAgICAgaWYgKGxlbiAhPT0gMCkge1xuICAgICAgICAgIGRpc3Bvc2UoZGlzcG9zZXJzKTtcbiAgICAgICAgICBkaXNwb3NlcnMgPSBbXTtcbiAgICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICAgIGxlbiA9IDA7XG4gICAgICAgICAgaW5kZXhlcyAmJiAoaW5kZXhlcyA9IFtdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5mYWxsYmFjaykge1xuICAgICAgICAgIGl0ZW1zID0gW0ZBTExCQUNLXTtcbiAgICAgICAgICBtYXBwZWRbMF0gPSBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgICAgIGRpc3Bvc2Vyc1swXSA9IGRpc3Bvc2VyO1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMuZmFsbGJhY2soKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBsZW4gPSAxO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChsZW4gPT09IDApIHtcbiAgICAgICAgbWFwcGVkID0gbmV3IEFycmF5KG5ld0xlbik7XG4gICAgICAgIGZvciAoaiA9IDA7IGogPCBuZXdMZW47IGorKykge1xuICAgICAgICAgIGl0ZW1zW2pdID0gbmV3SXRlbXNbal07XG4gICAgICAgICAgbWFwcGVkW2pdID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICAgIGxlbiA9IG5ld0xlbjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRlbXAgPSBuZXcgQXJyYXkobmV3TGVuKTtcbiAgICAgICAgdGVtcGRpc3Bvc2VycyA9IG5ldyBBcnJheShuZXdMZW4pO1xuICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlcyA9IG5ldyBBcnJheShuZXdMZW4pKTtcbiAgICAgICAgZm9yIChzdGFydCA9IDAsIGVuZCA9IE1hdGgubWluKGxlbiwgbmV3TGVuKTsgc3RhcnQgPCBlbmQgJiYgaXRlbXNbc3RhcnRdID09PSBuZXdJdGVtc1tzdGFydF07IHN0YXJ0KyspO1xuICAgICAgICBmb3IgKGVuZCA9IGxlbiAtIDEsIG5ld0VuZCA9IG5ld0xlbiAtIDE7IGVuZCA+PSBzdGFydCAmJiBuZXdFbmQgPj0gc3RhcnQgJiYgaXRlbXNbZW5kXSA9PT0gbmV3SXRlbXNbbmV3RW5kXTsgZW5kLS0sIG5ld0VuZC0tKSB7XG4gICAgICAgICAgdGVtcFtuZXdFbmRdID0gbWFwcGVkW2VuZF07XG4gICAgICAgICAgdGVtcGRpc3Bvc2Vyc1tuZXdFbmRdID0gZGlzcG9zZXJzW2VuZF07XG4gICAgICAgICAgaW5kZXhlcyAmJiAodGVtcEluZGV4ZXNbbmV3RW5kXSA9IGluZGV4ZXNbZW5kXSk7XG4gICAgICAgIH1cbiAgICAgICAgbmV3SW5kaWNlcyA9IG5ldyBNYXAoKTtcbiAgICAgICAgbmV3SW5kaWNlc05leHQgPSBuZXcgQXJyYXkobmV3RW5kICsgMSk7XG4gICAgICAgIGZvciAoaiA9IG5ld0VuZDsgaiA+PSBzdGFydDsgai0tKSB7XG4gICAgICAgICAgaXRlbSA9IG5ld0l0ZW1zW2pdO1xuICAgICAgICAgIGkgPSBuZXdJbmRpY2VzLmdldChpdGVtKTtcbiAgICAgICAgICBuZXdJbmRpY2VzTmV4dFtqXSA9IGkgPT09IHVuZGVmaW5lZCA/IC0xIDogaTtcbiAgICAgICAgICBuZXdJbmRpY2VzLnNldChpdGVtLCBqKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGkgPSBzdGFydDsgaSA8PSBlbmQ7IGkrKykge1xuICAgICAgICAgIGl0ZW0gPSBpdGVtc1tpXTtcbiAgICAgICAgICBqID0gbmV3SW5kaWNlcy5nZXQoaXRlbSk7XG4gICAgICAgICAgaWYgKGogIT09IHVuZGVmaW5lZCAmJiBqICE9PSAtMSkge1xuICAgICAgICAgICAgdGVtcFtqXSA9IG1hcHBlZFtpXTtcbiAgICAgICAgICAgIHRlbXBkaXNwb3NlcnNbal0gPSBkaXNwb3NlcnNbaV07XG4gICAgICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlc1tqXSA9IGluZGV4ZXNbaV0pO1xuICAgICAgICAgICAgaiA9IG5ld0luZGljZXNOZXh0W2pdO1xuICAgICAgICAgICAgbmV3SW5kaWNlcy5zZXQoaXRlbSwgaik7XG4gICAgICAgICAgfSBlbHNlIGRpc3Bvc2Vyc1tpXSgpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaiA9IHN0YXJ0OyBqIDwgbmV3TGVuOyBqKyspIHtcbiAgICAgICAgICBpZiAoaiBpbiB0ZW1wKSB7XG4gICAgICAgICAgICBtYXBwZWRbal0gPSB0ZW1wW2pdO1xuICAgICAgICAgICAgZGlzcG9zZXJzW2pdID0gdGVtcGRpc3Bvc2Vyc1tqXTtcbiAgICAgICAgICAgIGlmIChpbmRleGVzKSB7XG4gICAgICAgICAgICAgIGluZGV4ZXNbal0gPSB0ZW1wSW5kZXhlc1tqXTtcbiAgICAgICAgICAgICAgaW5kZXhlc1tqXShqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgbWFwcGVkW2pdID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICAgIG1hcHBlZCA9IG1hcHBlZC5zbGljZSgwLCBsZW4gPSBuZXdMZW4pO1xuICAgICAgICBpdGVtcyA9IG5ld0l0ZW1zLnNsaWNlKDApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1hcHBlZDtcbiAgICB9KTtcbiAgICBmdW5jdGlvbiBtYXBwZXIoZGlzcG9zZXIpIHtcbiAgICAgIGRpc3Bvc2Vyc1tqXSA9IGRpc3Bvc2VyO1xuICAgICAgaWYgKGluZGV4ZXMpIHtcbiAgICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoaiwge1xuICAgICAgICAgIG5hbWU6IFwiaW5kZXhcIlxuICAgICAgICB9KSA7XG4gICAgICAgIGluZGV4ZXNbal0gPSBzZXQ7XG4gICAgICAgIHJldHVybiBtYXBGbihuZXdJdGVtc1tqXSwgcyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWFwRm4obmV3SXRlbXNbal0pO1xuICAgIH1cbiAgfTtcbn1cbmZ1bmN0aW9uIGluZGV4QXJyYXkobGlzdCwgbWFwRm4sIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgaXRlbXMgPSBbXSxcbiAgICBtYXBwZWQgPSBbXSxcbiAgICBkaXNwb3NlcnMgPSBbXSxcbiAgICBzaWduYWxzID0gW10sXG4gICAgbGVuID0gMCxcbiAgICBpO1xuICBvbkNsZWFudXAoKCkgPT4gZGlzcG9zZShkaXNwb3NlcnMpKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBjb25zdCBuZXdJdGVtcyA9IGxpc3QoKSB8fCBbXSxcbiAgICAgIG5ld0xlbiA9IG5ld0l0ZW1zLmxlbmd0aDtcbiAgICBuZXdJdGVtc1skVFJBQ0tdO1xuICAgIHJldHVybiB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGlmIChuZXdMZW4gPT09IDApIHtcbiAgICAgICAgaWYgKGxlbiAhPT0gMCkge1xuICAgICAgICAgIGRpc3Bvc2UoZGlzcG9zZXJzKTtcbiAgICAgICAgICBkaXNwb3NlcnMgPSBbXTtcbiAgICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICAgIGxlbiA9IDA7XG4gICAgICAgICAgc2lnbmFscyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLmZhbGxiYWNrKSB7XG4gICAgICAgICAgaXRlbXMgPSBbRkFMTEJBQ0tdO1xuICAgICAgICAgIG1hcHBlZFswXSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZXJzWzBdID0gZGlzcG9zZXI7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9ucy5mYWxsYmFjaygpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxlbiA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hcHBlZDtcbiAgICAgIH1cbiAgICAgIGlmIChpdGVtc1swXSA9PT0gRkFMTEJBQ0spIHtcbiAgICAgICAgZGlzcG9zZXJzWzBdKCk7XG4gICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICBtYXBwZWQgPSBbXTtcbiAgICAgICAgbGVuID0gMDtcbiAgICAgIH1cbiAgICAgIGZvciAoaSA9IDA7IGkgPCBuZXdMZW47IGkrKykge1xuICAgICAgICBpZiAoaSA8IGl0ZW1zLmxlbmd0aCAmJiBpdGVtc1tpXSAhPT0gbmV3SXRlbXNbaV0pIHtcbiAgICAgICAgICBzaWduYWxzW2ldKCgpID0+IG5ld0l0ZW1zW2ldKTtcbiAgICAgICAgfSBlbHNlIGlmIChpID49IGl0ZW1zLmxlbmd0aCkge1xuICAgICAgICAgIG1hcHBlZFtpXSA9IGNyZWF0ZVJvb3QobWFwcGVyKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yICg7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBkaXNwb3NlcnNbaV0oKTtcbiAgICAgIH1cbiAgICAgIGxlbiA9IHNpZ25hbHMubGVuZ3RoID0gZGlzcG9zZXJzLmxlbmd0aCA9IG5ld0xlbjtcbiAgICAgIGl0ZW1zID0gbmV3SXRlbXMuc2xpY2UoMCk7XG4gICAgICByZXR1cm4gbWFwcGVkID0gbWFwcGVkLnNsaWNlKDAsIGxlbik7XG4gICAgfSk7XG4gICAgZnVuY3Rpb24gbWFwcGVyKGRpc3Bvc2VyKSB7XG4gICAgICBkaXNwb3NlcnNbaV0gPSBkaXNwb3NlcjtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKG5ld0l0ZW1zW2ldLCB7XG4gICAgICAgIG5hbWU6IFwidmFsdWVcIlxuICAgICAgfSkgO1xuICAgICAgc2lnbmFsc1tpXSA9IHNldDtcbiAgICAgIHJldHVybiBtYXBGbihzLCBpKTtcbiAgICB9XG4gIH07XG59XG5cbmxldCBoeWRyYXRpb25FbmFibGVkID0gZmFsc2U7XG5mdW5jdGlvbiBlbmFibGVIeWRyYXRpb24oKSB7XG4gIGh5ZHJhdGlvbkVuYWJsZWQgPSB0cnVlO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50KENvbXAsIHByb3BzKSB7XG4gIGlmIChoeWRyYXRpb25FbmFibGVkKSB7XG4gICAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0KSB7XG4gICAgICBjb25zdCBjID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChuZXh0SHlkcmF0ZUNvbnRleHQoKSk7XG4gICAgICBjb25zdCByID0gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzIHx8IHt9KSA7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjKTtcbiAgICAgIHJldHVybiByO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzIHx8IHt9KTtcbn1cbmZ1bmN0aW9uIHRydWVGbigpIHtcbiAgcmV0dXJuIHRydWU7XG59XG5jb25zdCBwcm9wVHJhcHMgPSB7XG4gIGdldChfLCBwcm9wZXJ0eSwgcmVjZWl2ZXIpIHtcbiAgICBpZiAocHJvcGVydHkgPT09ICRQUk9YWSkgcmV0dXJuIHJlY2VpdmVyO1xuICAgIHJldHVybiBfLmdldChwcm9wZXJ0eSk7XG4gIH0sXG4gIGhhcyhfLCBwcm9wZXJ0eSkge1xuICAgIGlmIChwcm9wZXJ0eSA9PT0gJFBST1hZKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gXy5oYXMocHJvcGVydHkpO1xuICB9LFxuICBzZXQ6IHRydWVGbixcbiAgZGVsZXRlUHJvcGVydHk6IHRydWVGbixcbiAgZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKF8sIHByb3BlcnR5KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBnZXQoKSB7XG4gICAgICAgIHJldHVybiBfLmdldChwcm9wZXJ0eSk7XG4gICAgICB9LFxuICAgICAgc2V0OiB0cnVlRm4sXG4gICAgICBkZWxldGVQcm9wZXJ0eTogdHJ1ZUZuXG4gICAgfTtcbiAgfSxcbiAgb3duS2V5cyhfKSB7XG4gICAgcmV0dXJuIF8ua2V5cygpO1xuICB9XG59O1xuZnVuY3Rpb24gcmVzb2x2ZVNvdXJjZShzKSB7XG4gIHJldHVybiAhKHMgPSB0eXBlb2YgcyA9PT0gXCJmdW5jdGlvblwiID8gcygpIDogcykgPyB7fSA6IHM7XG59XG5mdW5jdGlvbiByZXNvbHZlU291cmNlcygpIHtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbmd0aCA9IHRoaXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICBjb25zdCB2ID0gdGhpc1tpXSgpO1xuICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHJldHVybiB2O1xuICB9XG59XG5mdW5jdGlvbiBtZXJnZVByb3BzKC4uLnNvdXJjZXMpIHtcbiAgbGV0IHByb3h5ID0gZmFsc2U7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHMgPSBzb3VyY2VzW2ldO1xuICAgIHByb3h5ID0gcHJveHkgfHwgISFzICYmICRQUk9YWSBpbiBzO1xuICAgIHNvdXJjZXNbaV0gPSB0eXBlb2YgcyA9PT0gXCJmdW5jdGlvblwiID8gKHByb3h5ID0gdHJ1ZSwgY3JlYXRlTWVtbyhzKSkgOiBzO1xuICB9XG4gIGlmIChTVVBQT1JUU19QUk9YWSAmJiBwcm94eSkge1xuICAgIHJldHVybiBuZXcgUHJveHkoe1xuICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgY29uc3QgdiA9IHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSlbcHJvcGVydHldO1xuICAgICAgICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHJldHVybiB2O1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFzKHByb3BlcnR5KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgaWYgKHByb3BlcnR5IGluIHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSkpIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBrZXlzKCkge1xuICAgICAgICBjb25zdCBrZXlzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc291cmNlcy5sZW5ndGg7IGkrKykga2V5cy5wdXNoKC4uLk9iamVjdC5rZXlzKHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSkpKTtcbiAgICAgICAgcmV0dXJuIFsuLi5uZXcgU2V0KGtleXMpXTtcbiAgICAgIH1cbiAgICB9LCBwcm9wVHJhcHMpO1xuICB9XG4gIGNvbnN0IHNvdXJjZXNNYXAgPSB7fTtcbiAgY29uc3QgZGVmaW5lZCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3Qgc291cmNlID0gc291cmNlc1tpXTtcbiAgICBpZiAoIXNvdXJjZSkgY29udGludWU7XG4gICAgY29uc3Qgc291cmNlS2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHNvdXJjZSk7XG4gICAgZm9yIChsZXQgaSA9IHNvdXJjZUtleXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IGtleSA9IHNvdXJjZUtleXNbaV07XG4gICAgICBpZiAoa2V5ID09PSBcIl9fcHJvdG9fX1wiIHx8IGtleSA9PT0gXCJjb25zdHJ1Y3RvclwiKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHNvdXJjZSwga2V5KTtcbiAgICAgIGlmICghZGVmaW5lZFtrZXldKSB7XG4gICAgICAgIGRlZmluZWRba2V5XSA9IGRlc2MuZ2V0ID8ge1xuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGdldDogcmVzb2x2ZVNvdXJjZXMuYmluZChzb3VyY2VzTWFwW2tleV0gPSBbZGVzYy5nZXQuYmluZChzb3VyY2UpXSlcbiAgICAgICAgfSA6IGRlc2MudmFsdWUgIT09IHVuZGVmaW5lZCA/IGRlc2MgOiB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBzb3VyY2VzID0gc291cmNlc01hcFtrZXldO1xuICAgICAgICBpZiAoc291cmNlcykge1xuICAgICAgICAgIGlmIChkZXNjLmdldCkgc291cmNlcy5wdXNoKGRlc2MuZ2V0LmJpbmQoc291cmNlKSk7ZWxzZSBpZiAoZGVzYy52YWx1ZSAhPT0gdW5kZWZpbmVkKSBzb3VyY2VzLnB1c2goKCkgPT4gZGVzYy52YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY29uc3QgdGFyZ2V0ID0ge307XG4gIGNvbnN0IGRlZmluZWRLZXlzID0gT2JqZWN0LmtleXMoZGVmaW5lZCk7XG4gIGZvciAobGV0IGkgPSBkZWZpbmVkS2V5cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGNvbnN0IGtleSA9IGRlZmluZWRLZXlzW2ldLFxuICAgICAgZGVzYyA9IGRlZmluZWRba2V5XTtcbiAgICBpZiAoZGVzYyAmJiBkZXNjLmdldCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCBkZXNjKTtlbHNlIHRhcmdldFtrZXldID0gZGVzYyA/IGRlc2MudmFsdWUgOiB1bmRlZmluZWQ7XG4gIH1cbiAgcmV0dXJuIHRhcmdldDtcbn1cbmZ1bmN0aW9uIHNwbGl0UHJvcHMocHJvcHMsIC4uLmtleXMpIHtcbiAgaWYgKFNVUFBPUlRTX1BST1hZICYmICRQUk9YWSBpbiBwcm9wcykge1xuICAgIGNvbnN0IGJsb2NrZWQgPSBuZXcgU2V0KGtleXMubGVuZ3RoID4gMSA/IGtleXMuZmxhdCgpIDoga2V5c1swXSk7XG4gICAgY29uc3QgcmVzID0ga2V5cy5tYXAoayA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb3h5KHtcbiAgICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgICAgcmV0dXJuIGsuaW5jbHVkZXMocHJvcGVydHkpID8gcHJvcHNbcHJvcGVydHldIDogdW5kZWZpbmVkO1xuICAgICAgICB9LFxuICAgICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gay5pbmNsdWRlcyhwcm9wZXJ0eSkgJiYgcHJvcGVydHkgaW4gcHJvcHM7XG4gICAgICAgIH0sXG4gICAgICAgIGtleXMoKSB7XG4gICAgICAgICAgcmV0dXJuIGsuZmlsdGVyKHByb3BlcnR5ID0+IHByb3BlcnR5IGluIHByb3BzKTtcbiAgICAgICAgfVxuICAgICAgfSwgcHJvcFRyYXBzKTtcbiAgICB9KTtcbiAgICByZXMucHVzaChuZXcgUHJveHkoe1xuICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgIHJldHVybiBibG9ja2VkLmhhcyhwcm9wZXJ0eSkgPyB1bmRlZmluZWQgOiBwcm9wc1twcm9wZXJ0eV07XG4gICAgICB9LFxuICAgICAgaGFzKHByb3BlcnR5KSB7XG4gICAgICAgIHJldHVybiBibG9ja2VkLmhhcyhwcm9wZXJ0eSkgPyBmYWxzZSA6IHByb3BlcnR5IGluIHByb3BzO1xuICAgICAgfSxcbiAgICAgIGtleXMoKSB7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhwcm9wcykuZmlsdGVyKGsgPT4gIWJsb2NrZWQuaGFzKGspKTtcbiAgICAgIH1cbiAgICB9LCBwcm9wVHJhcHMpKTtcbiAgICByZXR1cm4gcmVzO1xuICB9XG4gIGNvbnN0IG90aGVyT2JqZWN0ID0ge307XG4gIGNvbnN0IG9iamVjdHMgPSBrZXlzLm1hcCgoKSA9PiAoe30pKTtcbiAgZm9yIChjb25zdCBwcm9wTmFtZSBvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhwcm9wcykpIHtcbiAgICBjb25zdCBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwcm9wcywgcHJvcE5hbWUpO1xuICAgIGNvbnN0IGlzRGVmYXVsdERlc2MgPSAhZGVzYy5nZXQgJiYgIWRlc2Muc2V0ICYmIGRlc2MuZW51bWVyYWJsZSAmJiBkZXNjLndyaXRhYmxlICYmIGRlc2MuY29uZmlndXJhYmxlO1xuICAgIGxldCBibG9ja2VkID0gZmFsc2U7XG4gICAgbGV0IG9iamVjdEluZGV4ID0gMDtcbiAgICBmb3IgKGNvbnN0IGsgb2Yga2V5cykge1xuICAgICAgaWYgKGsuaW5jbHVkZXMocHJvcE5hbWUpKSB7XG4gICAgICAgIGJsb2NrZWQgPSB0cnVlO1xuICAgICAgICBpc0RlZmF1bHREZXNjID8gb2JqZWN0c1tvYmplY3RJbmRleF1bcHJvcE5hbWVdID0gZGVzYy52YWx1ZSA6IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmplY3RzW29iamVjdEluZGV4XSwgcHJvcE5hbWUsIGRlc2MpO1xuICAgICAgfVxuICAgICAgKytvYmplY3RJbmRleDtcbiAgICB9XG4gICAgaWYgKCFibG9ja2VkKSB7XG4gICAgICBpc0RlZmF1bHREZXNjID8gb3RoZXJPYmplY3RbcHJvcE5hbWVdID0gZGVzYy52YWx1ZSA6IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvdGhlck9iamVjdCwgcHJvcE5hbWUsIGRlc2MpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gWy4uLm9iamVjdHMsIG90aGVyT2JqZWN0XTtcbn1cbmZ1bmN0aW9uIGxhenkoZm4pIHtcbiAgbGV0IGNvbXA7XG4gIGxldCBwO1xuICBjb25zdCB3cmFwID0gcHJvcHMgPT4ge1xuICAgIGNvbnN0IGN0eCA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICAgIGlmIChjdHgpIHtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKCk7XG4gICAgICBzaGFyZWRDb25maWcuY291bnQgfHwgKHNoYXJlZENvbmZpZy5jb3VudCA9IDApO1xuICAgICAgc2hhcmVkQ29uZmlnLmNvdW50Kys7XG4gICAgICAocCB8fCAocCA9IGZuKCkpKS50aGVuKG1vZCA9PiB7XG4gICAgICAgICFzaGFyZWRDb25maWcuZG9uZSAmJiBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgICBzaGFyZWRDb25maWcuY291bnQtLTtcbiAgICAgICAgc2V0KCgpID0+IG1vZC5kZWZhdWx0KTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgIH0pO1xuICAgICAgY29tcCA9IHM7XG4gICAgfSBlbHNlIGlmICghY29tcCkge1xuICAgICAgY29uc3QgW3NdID0gY3JlYXRlUmVzb3VyY2UoKCkgPT4gKHAgfHwgKHAgPSBmbigpKSkudGhlbihtb2QgPT4gbW9kLmRlZmF1bHQpKTtcbiAgICAgIGNvbXAgPSBzO1xuICAgIH1cbiAgICBsZXQgQ29tcDtcbiAgICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiAoQ29tcCA9IGNvbXAoKSkgPyB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGlmIChJU19ERVYpIE9iamVjdC5hc3NpZ24oQ29tcCwge1xuICAgICAgICBbJERFVkNPTVBdOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIGlmICghY3R4IHx8IHNoYXJlZENvbmZpZy5kb25lKSByZXR1cm4gQ29tcChwcm9wcyk7XG4gICAgICBjb25zdCBjID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgY29uc3QgciA9IENvbXAocHJvcHMpO1xuICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoYyk7XG4gICAgICByZXR1cm4gcjtcbiAgICB9KSA6IFwiXCIpO1xuICB9O1xuICB3cmFwLnByZWxvYWQgPSAoKSA9PiBwIHx8ICgocCA9IGZuKCkpLnRoZW4obW9kID0+IGNvbXAgPSAoKSA9PiBtb2QuZGVmYXVsdCksIHApO1xuICByZXR1cm4gd3JhcDtcbn1cbmxldCBjb3VudGVyID0gMDtcbmZ1bmN0aW9uIGNyZWF0ZVVuaXF1ZUlkKCkge1xuICBjb25zdCBjdHggPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgcmV0dXJuIGN0eCA/IHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCkgOiBgY2wtJHtjb3VudGVyKyt9YDtcbn1cblxuY29uc3QgbmFycm93ZWRFcnJvciA9IG5hbWUgPT4gYEF0dGVtcHRpbmcgdG8gYWNjZXNzIGEgc3RhbGUgdmFsdWUgZnJvbSA8JHtuYW1lfT4gdGhhdCBjb3VsZCBwb3NzaWJseSBiZSB1bmRlZmluZWQuIFRoaXMgbWF5IG9jY3VyIGJlY2F1c2UgeW91IGFyZSByZWFkaW5nIHRoZSBhY2Nlc3NvciByZXR1cm5lZCBmcm9tIHRoZSBjb21wb25lbnQgYXQgYSB0aW1lIHdoZXJlIGl0IGhhcyBhbHJlYWR5IGJlZW4gdW5tb3VudGVkLiBXZSByZWNvbW1lbmQgY2xlYW5pbmcgdXAgYW55IHN0YWxlIHRpbWVycyBvciBhc3luYywgb3IgcmVhZGluZyBmcm9tIHRoZSBpbml0aWFsIGNvbmRpdGlvbi5gIDtcbmZ1bmN0aW9uIEZvcihwcm9wcykge1xuICBjb25zdCBmYWxsYmFjayA9IFwiZmFsbGJhY2tcIiBpbiBwcm9wcyAmJiB7XG4gICAgZmFsbGJhY2s6ICgpID0+IHByb3BzLmZhbGxiYWNrXG4gIH07XG4gIHJldHVybiBjcmVhdGVNZW1vKG1hcEFycmF5KCgpID0+IHByb3BzLmVhY2gsIHByb3BzLmNoaWxkcmVuLCBmYWxsYmFjayB8fCB1bmRlZmluZWQpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSkgO1xufVxuZnVuY3Rpb24gSW5kZXgocHJvcHMpIHtcbiAgY29uc3QgZmFsbGJhY2sgPSBcImZhbGxiYWNrXCIgaW4gcHJvcHMgJiYge1xuICAgIGZhbGxiYWNrOiAoKSA9PiBwcm9wcy5mYWxsYmFja1xuICB9O1xuICByZXR1cm4gY3JlYXRlTWVtbyhpbmRleEFycmF5KCgpID0+IHByb3BzLmVhY2gsIHByb3BzLmNoaWxkcmVuLCBmYWxsYmFjayB8fCB1bmRlZmluZWQpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSkgO1xufVxuZnVuY3Rpb24gU2hvdyhwcm9wcykge1xuICBjb25zdCBrZXllZCA9IHByb3BzLmtleWVkO1xuICBjb25zdCBjb25kaXRpb25WYWx1ZSA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMud2hlbiwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJjb25kaXRpb24gdmFsdWVcIlxuICB9ICk7XG4gIGNvbnN0IGNvbmRpdGlvbiA9IGtleWVkID8gY29uZGl0aW9uVmFsdWUgOiBjcmVhdGVNZW1vKGNvbmRpdGlvblZhbHVlLCB1bmRlZmluZWQsIHtcbiAgICBlcXVhbHM6IChhLCBiKSA9PiAhYSA9PT0gIWIsXG4gICAgbmFtZTogXCJjb25kaXRpb25cIlxuICB9ICk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBjID0gY29uZGl0aW9uKCk7XG4gICAgaWYgKGMpIHtcbiAgICAgIGNvbnN0IGNoaWxkID0gcHJvcHMuY2hpbGRyZW47XG4gICAgICBjb25zdCBmbiA9IHR5cGVvZiBjaGlsZCA9PT0gXCJmdW5jdGlvblwiICYmIGNoaWxkLmxlbmd0aCA+IDA7XG4gICAgICByZXR1cm4gZm4gPyB1bnRyYWNrKCgpID0+IGNoaWxkKGtleWVkID8gYyA6ICgpID0+IHtcbiAgICAgICAgaWYgKCF1bnRyYWNrKGNvbmRpdGlvbikpIHRocm93IG5hcnJvd2VkRXJyb3IoXCJTaG93XCIpO1xuICAgICAgICByZXR1cm4gY29uZGl0aW9uVmFsdWUoKTtcbiAgICAgIH0pKSA6IGNoaWxkO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcHMuZmFsbGJhY2s7XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9ICk7XG59XG5mdW5jdGlvbiBTd2l0Y2gocHJvcHMpIHtcbiAgY29uc3QgY2hzID0gY2hpbGRyZW4oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICBjb25zdCBzd2l0Y2hGdW5jID0gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgY2ggPSBjaHMoKTtcbiAgICBjb25zdCBtcHMgPSBBcnJheS5pc0FycmF5KGNoKSA/IGNoIDogW2NoXTtcbiAgICBsZXQgZnVuYyA9ICgpID0+IHVuZGVmaW5lZDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1wcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaW5kZXggPSBpO1xuICAgICAgY29uc3QgbXAgPSBtcHNbaV07XG4gICAgICBjb25zdCBwcmV2RnVuYyA9IGZ1bmM7XG4gICAgICBjb25zdCBjb25kaXRpb25WYWx1ZSA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJldkZ1bmMoKSA/IHVuZGVmaW5lZCA6IG1wLndoZW4sIHVuZGVmaW5lZCwge1xuICAgICAgICBuYW1lOiBcImNvbmRpdGlvbiB2YWx1ZVwiXG4gICAgICB9ICk7XG4gICAgICBjb25zdCBjb25kaXRpb24gPSBtcC5rZXllZCA/IGNvbmRpdGlvblZhbHVlIDogY3JlYXRlTWVtbyhjb25kaXRpb25WYWx1ZSwgdW5kZWZpbmVkLCB7XG4gICAgICAgIGVxdWFsczogKGEsIGIpID0+ICFhID09PSAhYixcbiAgICAgICAgbmFtZTogXCJjb25kaXRpb25cIlxuICAgICAgfSApO1xuICAgICAgZnVuYyA9ICgpID0+IHByZXZGdW5jKCkgfHwgKGNvbmRpdGlvbigpID8gW2luZGV4LCBjb25kaXRpb25WYWx1ZSwgbXBdIDogdW5kZWZpbmVkKTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmM7XG4gIH0pO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3Qgc2VsID0gc3dpdGNoRnVuYygpKCk7XG4gICAgaWYgKCFzZWwpIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgICBjb25zdCBbaW5kZXgsIGNvbmRpdGlvblZhbHVlLCBtcF0gPSBzZWw7XG4gICAgY29uc3QgY2hpbGQgPSBtcC5jaGlsZHJlbjtcbiAgICBjb25zdCBmbiA9IHR5cGVvZiBjaGlsZCA9PT0gXCJmdW5jdGlvblwiICYmIGNoaWxkLmxlbmd0aCA+IDA7XG4gICAgcmV0dXJuIGZuID8gdW50cmFjaygoKSA9PiBjaGlsZChtcC5rZXllZCA/IGNvbmRpdGlvblZhbHVlKCkgOiAoKSA9PiB7XG4gICAgICBpZiAodW50cmFjayhzd2l0Y2hGdW5jKSgpPy5bMF0gIT09IGluZGV4KSB0aHJvdyBuYXJyb3dlZEVycm9yKFwiTWF0Y2hcIik7XG4gICAgICByZXR1cm4gY29uZGl0aW9uVmFsdWUoKTtcbiAgICB9KSkgOiBjaGlsZDtcbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJldmFsIGNvbmRpdGlvbnNcIlxuICB9ICk7XG59XG5mdW5jdGlvbiBNYXRjaChwcm9wcykge1xuICByZXR1cm4gcHJvcHM7XG59XG5sZXQgRXJyb3JzO1xuZnVuY3Rpb24gcmVzZXRFcnJvckJvdW5kYXJpZXMoKSB7XG4gIEVycm9ycyAmJiBbLi4uRXJyb3JzXS5mb3JFYWNoKGZuID0+IGZuKCkpO1xufVxuZnVuY3Rpb24gRXJyb3JCb3VuZGFyeShwcm9wcykge1xuICBsZXQgZXJyO1xuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgc2hhcmVkQ29uZmlnLmxvYWQpIGVyciA9IHNoYXJlZENvbmZpZy5sb2FkKHNoYXJlZENvbmZpZy5nZXRDb250ZXh0SWQoKSk7XG4gIGNvbnN0IFtlcnJvcmVkLCBzZXRFcnJvcmVkXSA9IGNyZWF0ZVNpZ25hbChlcnIsIHtcbiAgICBuYW1lOiBcImVycm9yZWRcIlxuICB9ICk7XG4gIEVycm9ycyB8fCAoRXJyb3JzID0gbmV3IFNldCgpKTtcbiAgRXJyb3JzLmFkZChzZXRFcnJvcmVkKTtcbiAgb25DbGVhbnVwKCgpID0+IEVycm9ycy5kZWxldGUoc2V0RXJyb3JlZCkpO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgbGV0IGU7XG4gICAgaWYgKGUgPSBlcnJvcmVkKCkpIHtcbiAgICAgIGNvbnN0IGYgPSBwcm9wcy5mYWxsYmFjaztcbiAgICAgIGlmICgodHlwZW9mIGYgIT09IFwiZnVuY3Rpb25cIiB8fCBmLmxlbmd0aCA9PSAwKSkgY29uc29sZS5lcnJvcihlKTtcbiAgICAgIHJldHVybiB0eXBlb2YgZiA9PT0gXCJmdW5jdGlvblwiICYmIGYubGVuZ3RoID8gdW50cmFjaygoKSA9PiBmKGUsICgpID0+IHNldEVycm9yZWQoKSkpIDogZjtcbiAgICB9XG4gICAgcmV0dXJuIGNhdGNoRXJyb3IoKCkgPT4gcHJvcHMuY2hpbGRyZW4sIHNldEVycm9yZWQpO1xuICB9LCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSApO1xufVxuXG5jb25zdCBzdXNwZW5zZUxpc3RFcXVhbHMgPSAoYSwgYikgPT4gYS5zaG93Q29udGVudCA9PT0gYi5zaG93Q29udGVudCAmJiBhLnNob3dGYWxsYmFjayA9PT0gYi5zaG93RmFsbGJhY2s7XG5jb25zdCBTdXNwZW5zZUxpc3RDb250ZXh0ID0gLyogI19fUFVSRV9fICovY3JlYXRlQ29udGV4dCgpO1xuZnVuY3Rpb24gU3VzcGVuc2VMaXN0KHByb3BzKSB7XG4gIGxldCBbd3JhcHBlciwgc2V0V3JhcHBlcl0gPSBjcmVhdGVTaWduYWwoKCkgPT4gKHtcbiAgICAgIGluRmFsbGJhY2s6IGZhbHNlXG4gICAgfSkpLFxuICAgIHNob3c7XG4gIGNvbnN0IGxpc3RDb250ZXh0ID0gdXNlQ29udGV4dChTdXNwZW5zZUxpc3RDb250ZXh0KTtcbiAgY29uc3QgW3JlZ2lzdHJ5LCBzZXRSZWdpc3RyeV0gPSBjcmVhdGVTaWduYWwoW10pO1xuICBpZiAobGlzdENvbnRleHQpIHtcbiAgICBzaG93ID0gbGlzdENvbnRleHQucmVnaXN0ZXIoY3JlYXRlTWVtbygoKSA9PiB3cmFwcGVyKCkoKS5pbkZhbGxiYWNrKSk7XG4gIH1cbiAgY29uc3QgcmVzb2x2ZWQgPSBjcmVhdGVNZW1vKHByZXYgPT4ge1xuICAgIGNvbnN0IHJldmVhbCA9IHByb3BzLnJldmVhbE9yZGVyLFxuICAgICAgdGFpbCA9IHByb3BzLnRhaWwsXG4gICAgICB7XG4gICAgICAgIHNob3dDb250ZW50ID0gdHJ1ZSxcbiAgICAgICAgc2hvd0ZhbGxiYWNrID0gdHJ1ZVxuICAgICAgfSA9IHNob3cgPyBzaG93KCkgOiB7fSxcbiAgICAgIHJlZyA9IHJlZ2lzdHJ5KCksXG4gICAgICByZXZlcnNlID0gcmV2ZWFsID09PSBcImJhY2t3YXJkc1wiO1xuICAgIGlmIChyZXZlYWwgPT09IFwidG9nZXRoZXJcIikge1xuICAgICAgY29uc3QgYWxsID0gcmVnLmV2ZXJ5KGluRmFsbGJhY2sgPT4gIWluRmFsbGJhY2soKSk7XG4gICAgICBjb25zdCByZXMgPSByZWcubWFwKCgpID0+ICh7XG4gICAgICAgIHNob3dDb250ZW50OiBhbGwgJiYgc2hvd0NvbnRlbnQsXG4gICAgICAgIHNob3dGYWxsYmFja1xuICAgICAgfSkpO1xuICAgICAgcmVzLmluRmFsbGJhY2sgPSAhYWxsO1xuICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG4gICAgbGV0IHN0b3AgPSBmYWxzZTtcbiAgICBsZXQgaW5GYWxsYmFjayA9IHByZXYuaW5GYWxsYmFjaztcbiAgICBjb25zdCByZXMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcmVnLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBjb25zdCBuID0gcmV2ZXJzZSA/IGxlbiAtIGkgLSAxIDogaSxcbiAgICAgICAgcyA9IHJlZ1tuXSgpO1xuICAgICAgaWYgKCFzdG9wICYmICFzKSB7XG4gICAgICAgIHJlc1tuXSA9IHtcbiAgICAgICAgICBzaG93Q29udGVudCxcbiAgICAgICAgICBzaG93RmFsbGJhY2tcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5leHQgPSAhc3RvcDtcbiAgICAgICAgaWYgKG5leHQpIGluRmFsbGJhY2sgPSB0cnVlO1xuICAgICAgICByZXNbbl0gPSB7XG4gICAgICAgICAgc2hvd0NvbnRlbnQ6IG5leHQsXG4gICAgICAgICAgc2hvd0ZhbGxiYWNrOiAhdGFpbCB8fCBuZXh0ICYmIHRhaWwgPT09IFwiY29sbGFwc2VkXCIgPyBzaG93RmFsbGJhY2sgOiBmYWxzZVxuICAgICAgICB9O1xuICAgICAgICBzdG9wID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFzdG9wKSBpbkZhbGxiYWNrID0gZmFsc2U7XG4gICAgcmVzLmluRmFsbGJhY2sgPSBpbkZhbGxiYWNrO1xuICAgIHJldHVybiByZXM7XG4gIH0sIHtcbiAgICBpbkZhbGxiYWNrOiBmYWxzZVxuICB9KTtcbiAgc2V0V3JhcHBlcigoKSA9PiByZXNvbHZlZCk7XG4gIHJldHVybiBjcmVhdGVDb21wb25lbnQoU3VzcGVuc2VMaXN0Q29udGV4dC5Qcm92aWRlciwge1xuICAgIHZhbHVlOiB7XG4gICAgICByZWdpc3RlcjogaW5GYWxsYmFjayA9PiB7XG4gICAgICAgIGxldCBpbmRleDtcbiAgICAgICAgc2V0UmVnaXN0cnkocmVnaXN0cnkgPT4ge1xuICAgICAgICAgIGluZGV4ID0gcmVnaXN0cnkubGVuZ3RoO1xuICAgICAgICAgIHJldHVybiBbLi4ucmVnaXN0cnksIGluRmFsbGJhY2tdO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4gcmVzb2x2ZWQoKVtpbmRleF0sIHVuZGVmaW5lZCwge1xuICAgICAgICAgIGVxdWFsczogc3VzcGVuc2VMaXN0RXF1YWxzXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgZ2V0IGNoaWxkcmVuKCkge1xuICAgICAgcmV0dXJuIHByb3BzLmNoaWxkcmVuO1xuICAgIH1cbiAgfSk7XG59XG5mdW5jdGlvbiBTdXNwZW5zZShwcm9wcykge1xuICBsZXQgY291bnRlciA9IDAsXG4gICAgc2hvdyxcbiAgICBjdHgsXG4gICAgcCxcbiAgICBmbGlja2VyLFxuICAgIGVycm9yO1xuICBjb25zdCBbaW5GYWxsYmFjaywgc2V0RmFsbGJhY2tdID0gY3JlYXRlU2lnbmFsKGZhbHNlKSxcbiAgICBTdXNwZW5zZUNvbnRleHQgPSBnZXRTdXNwZW5zZUNvbnRleHQoKSxcbiAgICBzdG9yZSA9IHtcbiAgICAgIGluY3JlbWVudDogKCkgPT4ge1xuICAgICAgICBpZiAoKytjb3VudGVyID09PSAxKSBzZXRGYWxsYmFjayh0cnVlKTtcbiAgICAgIH0sXG4gICAgICBkZWNyZW1lbnQ6ICgpID0+IHtcbiAgICAgICAgaWYgKC0tY291bnRlciA9PT0gMCkgc2V0RmFsbGJhY2soZmFsc2UpO1xuICAgICAgfSxcbiAgICAgIGluRmFsbGJhY2ssXG4gICAgICBlZmZlY3RzOiBbXSxcbiAgICAgIHJlc29sdmVkOiBmYWxzZVxuICAgIH0sXG4gICAgb3duZXIgPSBnZXRPd25lcigpO1xuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgc2hhcmVkQ29uZmlnLmxvYWQpIHtcbiAgICBjb25zdCBrZXkgPSBzaGFyZWRDb25maWcuZ2V0Q29udGV4dElkKCk7XG4gICAgbGV0IHJlZiA9IHNoYXJlZENvbmZpZy5sb2FkKGtleSk7XG4gICAgaWYgKHJlZikge1xuICAgICAgaWYgKHR5cGVvZiByZWYgIT09IFwib2JqZWN0XCIgfHwgcmVmLnMgIT09IDEpIHAgPSByZWY7ZWxzZSBzaGFyZWRDb25maWcuZ2F0aGVyKGtleSk7XG4gICAgfVxuICAgIGlmIChwICYmIHAgIT09IFwiJCRmXCIpIHtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCwge1xuICAgICAgICBlcXVhbHM6IGZhbHNlXG4gICAgICB9KTtcbiAgICAgIGZsaWNrZXIgPSBzO1xuICAgICAgcC50aGVuKCgpID0+IHtcbiAgICAgICAgaWYgKHNoYXJlZENvbmZpZy5kb25lKSByZXR1cm4gc2V0KCk7XG4gICAgICAgIHNoYXJlZENvbmZpZy5nYXRoZXIoa2V5KTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoY3R4KTtcbiAgICAgICAgc2V0KCk7XG4gICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KCk7XG4gICAgICB9LCBlcnIgPT4ge1xuICAgICAgICBlcnJvciA9IGVycjtcbiAgICAgICAgc2V0KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgY29uc3QgbGlzdENvbnRleHQgPSB1c2VDb250ZXh0KFN1c3BlbnNlTGlzdENvbnRleHQpO1xuICBpZiAobGlzdENvbnRleHQpIHNob3cgPSBsaXN0Q29udGV4dC5yZWdpc3RlcihzdG9yZS5pbkZhbGxiYWNrKTtcbiAgbGV0IGRpc3Bvc2U7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlICYmIGRpc3Bvc2UoKSk7XG4gIHJldHVybiBjcmVhdGVDb21wb25lbnQoU3VzcGVuc2VDb250ZXh0LlByb3ZpZGVyLCB7XG4gICAgdmFsdWU6IHN0b3JlLFxuICAgIGdldCBjaGlsZHJlbigpIHtcbiAgICAgIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtcbiAgICAgICAgY3R4ID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICAgIGlmIChmbGlja2VyKSB7XG4gICAgICAgICAgZmxpY2tlcigpO1xuICAgICAgICAgIHJldHVybiBmbGlja2VyID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjdHggJiYgcCA9PT0gXCIkJGZcIikgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgICAgY29uc3QgcmVuZGVyZWQgPSBjcmVhdGVNZW1vKCgpID0+IHByb3BzLmNoaWxkcmVuKTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8ocHJldiA9PiB7XG4gICAgICAgICAgY29uc3QgaW5GYWxsYmFjayA9IHN0b3JlLmluRmFsbGJhY2soKSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc2hvd0NvbnRlbnQgPSB0cnVlLFxuICAgICAgICAgICAgICBzaG93RmFsbGJhY2sgPSB0cnVlXG4gICAgICAgICAgICB9ID0gc2hvdyA/IHNob3coKSA6IHt9O1xuICAgICAgICAgIGlmICgoIWluRmFsbGJhY2sgfHwgcCAmJiBwICE9PSBcIiQkZlwiKSAmJiBzaG93Q29udGVudCkge1xuICAgICAgICAgICAgc3RvcmUucmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgZGlzcG9zZSAmJiBkaXNwb3NlKCk7XG4gICAgICAgICAgICBkaXNwb3NlID0gY3R4ID0gcCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VtZUVmZmVjdHMoc3RvcmUuZWZmZWN0cyk7XG4gICAgICAgICAgICByZXR1cm4gcmVuZGVyZWQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFzaG93RmFsbGJhY2spIHJldHVybjtcbiAgICAgICAgICBpZiAoZGlzcG9zZSkgcmV0dXJuIHByZXY7XG4gICAgICAgICAgcmV0dXJuIGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZSA9IGRpc3Bvc2VyO1xuICAgICAgICAgICAgaWYgKGN0eCkge1xuICAgICAgICAgICAgICBzZXRIeWRyYXRlQ29udGV4dCh7XG4gICAgICAgICAgICAgICAgaWQ6IGN0eC5pZCArIFwiRlwiLFxuICAgICAgICAgICAgICAgIGNvdW50OiAwXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBjdHggPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcHJvcHMuZmFsbGJhY2s7XG4gICAgICAgICAgfSwgb3duZXIpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG59XG5cbmNvbnN0IERFViA9IHtcbiAgaG9va3M6IERldkhvb2tzLFxuICB3cml0ZVNpZ25hbCxcbiAgcmVnaXN0ZXJHcmFwaFxufSA7XG5pZiAoZ2xvYmFsVGhpcykge1xuICBpZiAoIWdsb2JhbFRoaXMuU29saWQkJCkgZ2xvYmFsVGhpcy5Tb2xpZCQkID0gdHJ1ZTtlbHNlIGNvbnNvbGUud2FybihcIllvdSBhcHBlYXIgdG8gaGF2ZSBtdWx0aXBsZSBpbnN0YW5jZXMgb2YgU29saWQuIFRoaXMgY2FuIGxlYWQgdG8gdW5leHBlY3RlZCBiZWhhdmlvci5cIik7XG59XG5cbmV4cG9ydCB7ICRERVZDT01QLCAkUFJPWFksICRUUkFDSywgREVWLCBFcnJvckJvdW5kYXJ5LCBGb3IsIEluZGV4LCBNYXRjaCwgU2hvdywgU3VzcGVuc2UsIFN1c3BlbnNlTGlzdCwgU3dpdGNoLCBiYXRjaCwgY2FuY2VsQ2FsbGJhY2ssIGNhdGNoRXJyb3IsIGNoaWxkcmVuLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZUNvbXB1dGVkLCBjcmVhdGVDb250ZXh0LCBjcmVhdGVEZWZlcnJlZCwgY3JlYXRlRWZmZWN0LCBjcmVhdGVNZW1vLCBjcmVhdGVSZWFjdGlvbiwgY3JlYXRlUmVuZGVyRWZmZWN0LCBjcmVhdGVSZXNvdXJjZSwgY3JlYXRlUm9vdCwgY3JlYXRlU2VsZWN0b3IsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlVW5pcXVlSWQsIGVuYWJsZUV4dGVybmFsU291cmNlLCBlbmFibGVIeWRyYXRpb24sIGVuYWJsZVNjaGVkdWxpbmcsIGVxdWFsRm4sIGZyb20sIGdldExpc3RlbmVyLCBnZXRPd25lciwgaW5kZXhBcnJheSwgbGF6eSwgbWFwQXJyYXksIG1lcmdlUHJvcHMsIG9ic2VydmFibGUsIG9uLCBvbkNsZWFudXAsIG9uRXJyb3IsIG9uTW91bnQsIHJlcXVlc3RDYWxsYmFjaywgcmVzZXRFcnJvckJvdW5kYXJpZXMsIHJ1bldpdGhPd25lciwgc2hhcmVkQ29uZmlnLCBzcGxpdFByb3BzLCBzdGFydFRyYW5zaXRpb24sIHVudHJhY2ssIHVzZUNvbnRleHQsIHVzZVRyYW5zaXRpb24gfTtcbiIsImltcG9ydCB7IGNyZWF0ZU1lbW8sIGNyZWF0ZVJvb3QsIGNyZWF0ZVJlbmRlckVmZmVjdCwgdW50cmFjaywgc2hhcmVkQ29uZmlnLCBlbmFibGVIeWRyYXRpb24sIGdldE93bmVyLCBjcmVhdGVFZmZlY3QsIHJ1bldpdGhPd25lciwgY3JlYXRlU2lnbmFsLCBvbkNsZWFudXAsICRERVZDT01QLCBzcGxpdFByb3BzIH0gZnJvbSAnc29saWQtanMnO1xuZXhwb3J0IHsgRXJyb3JCb3VuZGFyeSwgRm9yLCBJbmRleCwgTWF0Y2gsIFNob3csIFN1c3BlbnNlLCBTdXNwZW5zZUxpc3QsIFN3aXRjaCwgY3JlYXRlQ29tcG9uZW50LCBjcmVhdGVSZW5kZXJFZmZlY3QgYXMgZWZmZWN0LCBnZXRPd25lciwgbWVyZ2VQcm9wcywgdW50cmFjayB9IGZyb20gJ3NvbGlkLWpzJztcblxuY29uc3QgYm9vbGVhbnMgPSBbXCJhbGxvd2Z1bGxzY3JlZW5cIiwgXCJhc3luY1wiLCBcImF1dG9mb2N1c1wiLCBcImF1dG9wbGF5XCIsIFwiY2hlY2tlZFwiLCBcImNvbnRyb2xzXCIsIFwiZGVmYXVsdFwiLCBcImRpc2FibGVkXCIsIFwiZm9ybW5vdmFsaWRhdGVcIiwgXCJoaWRkZW5cIiwgXCJpbmRldGVybWluYXRlXCIsIFwiaW5lcnRcIiwgXCJpc21hcFwiLCBcImxvb3BcIiwgXCJtdWx0aXBsZVwiLCBcIm11dGVkXCIsIFwibm9tb2R1bGVcIiwgXCJub3ZhbGlkYXRlXCIsIFwib3BlblwiLCBcInBsYXlzaW5saW5lXCIsIFwicmVhZG9ubHlcIiwgXCJyZXF1aXJlZFwiLCBcInJldmVyc2VkXCIsIFwic2VhbWxlc3NcIiwgXCJzZWxlY3RlZFwiXTtcbmNvbnN0IFByb3BlcnRpZXMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJjbGFzc05hbWVcIiwgXCJ2YWx1ZVwiLCBcInJlYWRPbmx5XCIsIFwibm9WYWxpZGF0ZVwiLCBcImZvcm1Ob1ZhbGlkYXRlXCIsIFwiaXNNYXBcIiwgXCJub01vZHVsZVwiLCBcInBsYXlzSW5saW5lXCIsIC4uLmJvb2xlYW5zXSk7XG5jb25zdCBDaGlsZFByb3BlcnRpZXMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJpbm5lckhUTUxcIiwgXCJ0ZXh0Q29udGVudFwiLCBcImlubmVyVGV4dFwiLCBcImNoaWxkcmVuXCJdKTtcbmNvbnN0IEFsaWFzZXMgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmFzc2lnbihPYmplY3QuY3JlYXRlKG51bGwpLCB7XG4gIGNsYXNzTmFtZTogXCJjbGFzc1wiLFxuICBodG1sRm9yOiBcImZvclwiXG59KTtcbmNvbnN0IFByb3BBbGlhc2VzID0gLyojX19QVVJFX18qL09iamVjdC5hc3NpZ24oT2JqZWN0LmNyZWF0ZShudWxsKSwge1xuICBjbGFzczogXCJjbGFzc05hbWVcIixcbiAgbm92YWxpZGF0ZToge1xuICAgICQ6IFwibm9WYWxpZGF0ZVwiLFxuICAgIEZPUk06IDFcbiAgfSxcbiAgZm9ybW5vdmFsaWRhdGU6IHtcbiAgICAkOiBcImZvcm1Ob1ZhbGlkYXRlXCIsXG4gICAgQlVUVE9OOiAxLFxuICAgIElOUFVUOiAxXG4gIH0sXG4gIGlzbWFwOiB7XG4gICAgJDogXCJpc01hcFwiLFxuICAgIElNRzogMVxuICB9LFxuICBub21vZHVsZToge1xuICAgICQ6IFwibm9Nb2R1bGVcIixcbiAgICBTQ1JJUFQ6IDFcbiAgfSxcbiAgcGxheXNpbmxpbmU6IHtcbiAgICAkOiBcInBsYXlzSW5saW5lXCIsXG4gICAgVklERU86IDFcbiAgfSxcbiAgcmVhZG9ubHk6IHtcbiAgICAkOiBcInJlYWRPbmx5XCIsXG4gICAgSU5QVVQ6IDEsXG4gICAgVEVYVEFSRUE6IDFcbiAgfVxufSk7XG5mdW5jdGlvbiBnZXRQcm9wQWxpYXMocHJvcCwgdGFnTmFtZSkge1xuICBjb25zdCBhID0gUHJvcEFsaWFzZXNbcHJvcF07XG4gIHJldHVybiB0eXBlb2YgYSA9PT0gXCJvYmplY3RcIiA/IGFbdGFnTmFtZV0gPyBhW1wiJFwiXSA6IHVuZGVmaW5lZCA6IGE7XG59XG5jb25zdCBEZWxlZ2F0ZWRFdmVudHMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJiZWZvcmVpbnB1dFwiLCBcImNsaWNrXCIsIFwiZGJsY2xpY2tcIiwgXCJjb250ZXh0bWVudVwiLCBcImZvY3VzaW5cIiwgXCJmb2N1c291dFwiLCBcImlucHV0XCIsIFwia2V5ZG93blwiLCBcImtleXVwXCIsIFwibW91c2Vkb3duXCIsIFwibW91c2Vtb3ZlXCIsIFwibW91c2VvdXRcIiwgXCJtb3VzZW92ZXJcIiwgXCJtb3VzZXVwXCIsIFwicG9pbnRlcmRvd25cIiwgXCJwb2ludGVybW92ZVwiLCBcInBvaW50ZXJvdXRcIiwgXCJwb2ludGVyb3ZlclwiLCBcInBvaW50ZXJ1cFwiLCBcInRvdWNoZW5kXCIsIFwidG91Y2htb3ZlXCIsIFwidG91Y2hzdGFydFwiXSk7XG5jb25zdCBTVkdFbGVtZW50cyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcblwiYWx0R2x5cGhcIiwgXCJhbHRHbHlwaERlZlwiLCBcImFsdEdseXBoSXRlbVwiLCBcImFuaW1hdGVcIiwgXCJhbmltYXRlQ29sb3JcIiwgXCJhbmltYXRlTW90aW9uXCIsIFwiYW5pbWF0ZVRyYW5zZm9ybVwiLCBcImNpcmNsZVwiLCBcImNsaXBQYXRoXCIsIFwiY29sb3ItcHJvZmlsZVwiLCBcImN1cnNvclwiLCBcImRlZnNcIiwgXCJkZXNjXCIsIFwiZWxsaXBzZVwiLCBcImZlQmxlbmRcIiwgXCJmZUNvbG9yTWF0cml4XCIsIFwiZmVDb21wb25lbnRUcmFuc2ZlclwiLCBcImZlQ29tcG9zaXRlXCIsIFwiZmVDb252b2x2ZU1hdHJpeFwiLCBcImZlRGlmZnVzZUxpZ2h0aW5nXCIsIFwiZmVEaXNwbGFjZW1lbnRNYXBcIiwgXCJmZURpc3RhbnRMaWdodFwiLCBcImZlRHJvcFNoYWRvd1wiLCBcImZlRmxvb2RcIiwgXCJmZUZ1bmNBXCIsIFwiZmVGdW5jQlwiLCBcImZlRnVuY0dcIiwgXCJmZUZ1bmNSXCIsIFwiZmVHYXVzc2lhbkJsdXJcIiwgXCJmZUltYWdlXCIsIFwiZmVNZXJnZVwiLCBcImZlTWVyZ2VOb2RlXCIsIFwiZmVNb3JwaG9sb2d5XCIsIFwiZmVPZmZzZXRcIiwgXCJmZVBvaW50TGlnaHRcIiwgXCJmZVNwZWN1bGFyTGlnaHRpbmdcIiwgXCJmZVNwb3RMaWdodFwiLCBcImZlVGlsZVwiLCBcImZlVHVyYnVsZW5jZVwiLCBcImZpbHRlclwiLCBcImZvbnRcIiwgXCJmb250LWZhY2VcIiwgXCJmb250LWZhY2UtZm9ybWF0XCIsIFwiZm9udC1mYWNlLW5hbWVcIiwgXCJmb250LWZhY2Utc3JjXCIsIFwiZm9udC1mYWNlLXVyaVwiLCBcImZvcmVpZ25PYmplY3RcIiwgXCJnXCIsIFwiZ2x5cGhcIiwgXCJnbHlwaFJlZlwiLCBcImhrZXJuXCIsIFwiaW1hZ2VcIiwgXCJsaW5lXCIsIFwibGluZWFyR3JhZGllbnRcIiwgXCJtYXJrZXJcIiwgXCJtYXNrXCIsIFwibWV0YWRhdGFcIiwgXCJtaXNzaW5nLWdseXBoXCIsIFwibXBhdGhcIiwgXCJwYXRoXCIsIFwicGF0dGVyblwiLCBcInBvbHlnb25cIiwgXCJwb2x5bGluZVwiLCBcInJhZGlhbEdyYWRpZW50XCIsIFwicmVjdFwiLFxuXCJzZXRcIiwgXCJzdG9wXCIsXG5cInN2Z1wiLCBcInN3aXRjaFwiLCBcInN5bWJvbFwiLCBcInRleHRcIiwgXCJ0ZXh0UGF0aFwiLFxuXCJ0cmVmXCIsIFwidHNwYW5cIiwgXCJ1c2VcIiwgXCJ2aWV3XCIsIFwidmtlcm5cIl0pO1xuY29uc3QgU1ZHTmFtZXNwYWNlID0ge1xuICB4bGluazogXCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCIsXG4gIHhtbDogXCJodHRwOi8vd3d3LnczLm9yZy9YTUwvMTk5OC9uYW1lc3BhY2VcIlxufTtcbmNvbnN0IERPTUVsZW1lbnRzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1wiaHRtbFwiLCBcImJhc2VcIiwgXCJoZWFkXCIsIFwibGlua1wiLCBcIm1ldGFcIiwgXCJzdHlsZVwiLCBcInRpdGxlXCIsIFwiYm9keVwiLCBcImFkZHJlc3NcIiwgXCJhcnRpY2xlXCIsIFwiYXNpZGVcIiwgXCJmb290ZXJcIiwgXCJoZWFkZXJcIiwgXCJtYWluXCIsIFwibmF2XCIsIFwic2VjdGlvblwiLCBcImJvZHlcIiwgXCJibG9ja3F1b3RlXCIsIFwiZGRcIiwgXCJkaXZcIiwgXCJkbFwiLCBcImR0XCIsIFwiZmlnY2FwdGlvblwiLCBcImZpZ3VyZVwiLCBcImhyXCIsIFwibGlcIiwgXCJvbFwiLCBcInBcIiwgXCJwcmVcIiwgXCJ1bFwiLCBcImFcIiwgXCJhYmJyXCIsIFwiYlwiLCBcImJkaVwiLCBcImJkb1wiLCBcImJyXCIsIFwiY2l0ZVwiLCBcImNvZGVcIiwgXCJkYXRhXCIsIFwiZGZuXCIsIFwiZW1cIiwgXCJpXCIsIFwia2JkXCIsIFwibWFya1wiLCBcInFcIiwgXCJycFwiLCBcInJ0XCIsIFwicnVieVwiLCBcInNcIiwgXCJzYW1wXCIsIFwic21hbGxcIiwgXCJzcGFuXCIsIFwic3Ryb25nXCIsIFwic3ViXCIsIFwic3VwXCIsIFwidGltZVwiLCBcInVcIiwgXCJ2YXJcIiwgXCJ3YnJcIiwgXCJhcmVhXCIsIFwiYXVkaW9cIiwgXCJpbWdcIiwgXCJtYXBcIiwgXCJ0cmFja1wiLCBcInZpZGVvXCIsIFwiZW1iZWRcIiwgXCJpZnJhbWVcIiwgXCJvYmplY3RcIiwgXCJwYXJhbVwiLCBcInBpY3R1cmVcIiwgXCJwb3J0YWxcIiwgXCJzb3VyY2VcIiwgXCJzdmdcIiwgXCJtYXRoXCIsIFwiY2FudmFzXCIsIFwibm9zY3JpcHRcIiwgXCJzY3JpcHRcIiwgXCJkZWxcIiwgXCJpbnNcIiwgXCJjYXB0aW9uXCIsIFwiY29sXCIsIFwiY29sZ3JvdXBcIiwgXCJ0YWJsZVwiLCBcInRib2R5XCIsIFwidGRcIiwgXCJ0Zm9vdFwiLCBcInRoXCIsIFwidGhlYWRcIiwgXCJ0clwiLCBcImJ1dHRvblwiLCBcImRhdGFsaXN0XCIsIFwiZmllbGRzZXRcIiwgXCJmb3JtXCIsIFwiaW5wdXRcIiwgXCJsYWJlbFwiLCBcImxlZ2VuZFwiLCBcIm1ldGVyXCIsIFwib3B0Z3JvdXBcIiwgXCJvcHRpb25cIiwgXCJvdXRwdXRcIiwgXCJwcm9ncmVzc1wiLCBcInNlbGVjdFwiLCBcInRleHRhcmVhXCIsIFwiZGV0YWlsc1wiLCBcImRpYWxvZ1wiLCBcIm1lbnVcIiwgXCJzdW1tYXJ5XCIsIFwiZGV0YWlsc1wiLCBcInNsb3RcIiwgXCJ0ZW1wbGF0ZVwiLCBcImFjcm9ueW1cIiwgXCJhcHBsZXRcIiwgXCJiYXNlZm9udFwiLCBcImJnc291bmRcIiwgXCJiaWdcIiwgXCJibGlua1wiLCBcImNlbnRlclwiLCBcImNvbnRlbnRcIiwgXCJkaXJcIiwgXCJmb250XCIsIFwiZnJhbWVcIiwgXCJmcmFtZXNldFwiLCBcImhncm91cFwiLCBcImltYWdlXCIsIFwia2V5Z2VuXCIsIFwibWFycXVlZVwiLCBcIm1lbnVpdGVtXCIsIFwibm9iclwiLCBcIm5vZW1iZWRcIiwgXCJub2ZyYW1lc1wiLCBcInBsYWludGV4dFwiLCBcInJiXCIsIFwicnRjXCIsIFwic2hhZG93XCIsIFwic3BhY2VyXCIsIFwic3RyaWtlXCIsIFwidHRcIiwgXCJ4bXBcIiwgXCJhXCIsIFwiYWJiclwiLCBcImFjcm9ueW1cIiwgXCJhZGRyZXNzXCIsIFwiYXBwbGV0XCIsIFwiYXJlYVwiLCBcImFydGljbGVcIiwgXCJhc2lkZVwiLCBcImF1ZGlvXCIsIFwiYlwiLCBcImJhc2VcIiwgXCJiYXNlZm9udFwiLCBcImJkaVwiLCBcImJkb1wiLCBcImJnc291bmRcIiwgXCJiaWdcIiwgXCJibGlua1wiLCBcImJsb2NrcXVvdGVcIiwgXCJib2R5XCIsIFwiYnJcIiwgXCJidXR0b25cIiwgXCJjYW52YXNcIiwgXCJjYXB0aW9uXCIsIFwiY2VudGVyXCIsIFwiY2l0ZVwiLCBcImNvZGVcIiwgXCJjb2xcIiwgXCJjb2xncm91cFwiLCBcImNvbnRlbnRcIiwgXCJkYXRhXCIsIFwiZGF0YWxpc3RcIiwgXCJkZFwiLCBcImRlbFwiLCBcImRldGFpbHNcIiwgXCJkZm5cIiwgXCJkaWFsb2dcIiwgXCJkaXJcIiwgXCJkaXZcIiwgXCJkbFwiLCBcImR0XCIsIFwiZW1cIiwgXCJlbWJlZFwiLCBcImZpZWxkc2V0XCIsIFwiZmlnY2FwdGlvblwiLCBcImZpZ3VyZVwiLCBcImZvbnRcIiwgXCJmb290ZXJcIiwgXCJmb3JtXCIsIFwiZnJhbWVcIiwgXCJmcmFtZXNldFwiLCBcImhlYWRcIiwgXCJoZWFkZXJcIiwgXCJoZ3JvdXBcIiwgXCJoclwiLCBcImh0bWxcIiwgXCJpXCIsIFwiaWZyYW1lXCIsIFwiaW1hZ2VcIiwgXCJpbWdcIiwgXCJpbnB1dFwiLCBcImluc1wiLCBcImtiZFwiLCBcImtleWdlblwiLCBcImxhYmVsXCIsIFwibGVnZW5kXCIsIFwibGlcIiwgXCJsaW5rXCIsIFwibWFpblwiLCBcIm1hcFwiLCBcIm1hcmtcIiwgXCJtYXJxdWVlXCIsIFwibWVudVwiLCBcIm1lbnVpdGVtXCIsIFwibWV0YVwiLCBcIm1ldGVyXCIsIFwibmF2XCIsIFwibm9iclwiLCBcIm5vZW1iZWRcIiwgXCJub2ZyYW1lc1wiLCBcIm5vc2NyaXB0XCIsIFwib2JqZWN0XCIsIFwib2xcIiwgXCJvcHRncm91cFwiLCBcIm9wdGlvblwiLCBcIm91dHB1dFwiLCBcInBcIiwgXCJwYXJhbVwiLCBcInBpY3R1cmVcIiwgXCJwbGFpbnRleHRcIiwgXCJwb3J0YWxcIiwgXCJwcmVcIiwgXCJwcm9ncmVzc1wiLCBcInFcIiwgXCJyYlwiLCBcInJwXCIsIFwicnRcIiwgXCJydGNcIiwgXCJydWJ5XCIsIFwic1wiLCBcInNhbXBcIiwgXCJzY3JpcHRcIiwgXCJzZWN0aW9uXCIsIFwic2VsZWN0XCIsIFwic2hhZG93XCIsIFwic2xvdFwiLCBcInNtYWxsXCIsIFwic291cmNlXCIsIFwic3BhY2VyXCIsIFwic3BhblwiLCBcInN0cmlrZVwiLCBcInN0cm9uZ1wiLCBcInN0eWxlXCIsIFwic3ViXCIsIFwic3VtbWFyeVwiLCBcInN1cFwiLCBcInRhYmxlXCIsIFwidGJvZHlcIiwgXCJ0ZFwiLCBcInRlbXBsYXRlXCIsIFwidGV4dGFyZWFcIiwgXCJ0Zm9vdFwiLCBcInRoXCIsIFwidGhlYWRcIiwgXCJ0aW1lXCIsIFwidGl0bGVcIiwgXCJ0clwiLCBcInRyYWNrXCIsIFwidHRcIiwgXCJ1XCIsIFwidWxcIiwgXCJ2YXJcIiwgXCJ2aWRlb1wiLCBcIndiclwiLCBcInhtcFwiLCBcImlucHV0XCIsIFwiaDFcIiwgXCJoMlwiLCBcImgzXCIsIFwiaDRcIiwgXCJoNVwiLCBcImg2XCJdKTtcblxuY29uc3QgbWVtbyA9IGZuID0+IGNyZWF0ZU1lbW8oKCkgPT4gZm4oKSk7XG5cbmZ1bmN0aW9uIHJlY29uY2lsZUFycmF5cyhwYXJlbnROb2RlLCBhLCBiKSB7XG4gIGxldCBiTGVuZ3RoID0gYi5sZW5ndGgsXG4gICAgYUVuZCA9IGEubGVuZ3RoLFxuICAgIGJFbmQgPSBiTGVuZ3RoLFxuICAgIGFTdGFydCA9IDAsXG4gICAgYlN0YXJ0ID0gMCxcbiAgICBhZnRlciA9IGFbYUVuZCAtIDFdLm5leHRTaWJsaW5nLFxuICAgIG1hcCA9IG51bGw7XG4gIHdoaWxlIChhU3RhcnQgPCBhRW5kIHx8IGJTdGFydCA8IGJFbmQpIHtcbiAgICBpZiAoYVthU3RhcnRdID09PSBiW2JTdGFydF0pIHtcbiAgICAgIGFTdGFydCsrO1xuICAgICAgYlN0YXJ0Kys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgd2hpbGUgKGFbYUVuZCAtIDFdID09PSBiW2JFbmQgLSAxXSkge1xuICAgICAgYUVuZC0tO1xuICAgICAgYkVuZC0tO1xuICAgIH1cbiAgICBpZiAoYUVuZCA9PT0gYVN0YXJ0KSB7XG4gICAgICBjb25zdCBub2RlID0gYkVuZCA8IGJMZW5ndGggPyBiU3RhcnQgPyBiW2JTdGFydCAtIDFdLm5leHRTaWJsaW5nIDogYltiRW5kIC0gYlN0YXJ0XSA6IGFmdGVyO1xuICAgICAgd2hpbGUgKGJTdGFydCA8IGJFbmQpIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKGJFbmQgPT09IGJTdGFydCkge1xuICAgICAgd2hpbGUgKGFTdGFydCA8IGFFbmQpIHtcbiAgICAgICAgaWYgKCFtYXAgfHwgIW1hcC5oYXMoYVthU3RhcnRdKSkgYVthU3RhcnRdLnJlbW92ZSgpO1xuICAgICAgICBhU3RhcnQrKztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGFbYVN0YXJ0XSA9PT0gYltiRW5kIC0gMV0gJiYgYltiU3RhcnRdID09PSBhW2FFbmQgLSAxXSkge1xuICAgICAgY29uc3Qgbm9kZSA9IGFbLS1hRW5kXS5uZXh0U2libGluZztcbiAgICAgIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBhW2FTdGFydCsrXS5uZXh0U2libGluZyk7XG4gICAgICBwYXJlbnROb2RlLmluc2VydEJlZm9yZShiWy0tYkVuZF0sIG5vZGUpO1xuICAgICAgYVthRW5kXSA9IGJbYkVuZF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghbWFwKSB7XG4gICAgICAgIG1hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgbGV0IGkgPSBiU3RhcnQ7XG4gICAgICAgIHdoaWxlIChpIDwgYkVuZCkgbWFwLnNldChiW2ldLCBpKyspO1xuICAgICAgfVxuICAgICAgY29uc3QgaW5kZXggPSBtYXAuZ2V0KGFbYVN0YXJ0XSk7XG4gICAgICBpZiAoaW5kZXggIT0gbnVsbCkge1xuICAgICAgICBpZiAoYlN0YXJ0IDwgaW5kZXggJiYgaW5kZXggPCBiRW5kKSB7XG4gICAgICAgICAgbGV0IGkgPSBhU3RhcnQsXG4gICAgICAgICAgICBzZXF1ZW5jZSA9IDEsXG4gICAgICAgICAgICB0O1xuICAgICAgICAgIHdoaWxlICgrK2kgPCBhRW5kICYmIGkgPCBiRW5kKSB7XG4gICAgICAgICAgICBpZiAoKHQgPSBtYXAuZ2V0KGFbaV0pKSA9PSBudWxsIHx8IHQgIT09IGluZGV4ICsgc2VxdWVuY2UpIGJyZWFrO1xuICAgICAgICAgICAgc2VxdWVuY2UrKztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNlcXVlbmNlID4gaW5kZXggLSBiU3RhcnQpIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBhW2FTdGFydF07XG4gICAgICAgICAgICB3aGlsZSAoYlN0YXJ0IDwgaW5kZXgpIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBub2RlKTtcbiAgICAgICAgICB9IGVsc2UgcGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoYltiU3RhcnQrK10sIGFbYVN0YXJ0KytdKTtcbiAgICAgICAgfSBlbHNlIGFTdGFydCsrO1xuICAgICAgfSBlbHNlIGFbYVN0YXJ0KytdLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxufVxuXG5jb25zdCAkJEVWRU5UUyA9IFwiXyREWF9ERUxFR0FURVwiO1xuZnVuY3Rpb24gcmVuZGVyKGNvZGUsIGVsZW1lbnQsIGluaXQsIG9wdGlvbnMgPSB7fSkge1xuICBpZiAoIWVsZW1lbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYGVsZW1lbnRgIHBhc3NlZCB0byBgcmVuZGVyKC4uLiwgZWxlbWVudClgIGRvZXNuJ3QgZXhpc3QuIE1ha2Ugc3VyZSBgZWxlbWVudGAgZXhpc3RzIGluIHRoZSBkb2N1bWVudC5cIik7XG4gIH1cbiAgbGV0IGRpc3Bvc2VyO1xuICBjcmVhdGVSb290KGRpc3Bvc2UgPT4ge1xuICAgIGRpc3Bvc2VyID0gZGlzcG9zZTtcbiAgICBlbGVtZW50ID09PSBkb2N1bWVudCA/IGNvZGUoKSA6IGluc2VydChlbGVtZW50LCBjb2RlKCksIGVsZW1lbnQuZmlyc3RDaGlsZCA/IG51bGwgOiB1bmRlZmluZWQsIGluaXQpO1xuICB9LCBvcHRpb25zLm93bmVyKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBkaXNwb3NlcigpO1xuICAgIGVsZW1lbnQudGV4dENvbnRlbnQgPSBcIlwiO1xuICB9O1xufVxuZnVuY3Rpb24gdGVtcGxhdGUoaHRtbCwgaXNJbXBvcnROb2RlLCBpc1NWRywgaXNNYXRoTUwpIHtcbiAgbGV0IG5vZGU7XG4gIGNvbnN0IGNyZWF0ZSA9ICgpID0+IHtcbiAgICBpZiAoaXNIeWRyYXRpbmcoKSkgdGhyb3cgbmV3IEVycm9yKFwiRmFpbGVkIGF0dGVtcHQgdG8gY3JlYXRlIG5ldyBET00gZWxlbWVudHMgZHVyaW5nIGh5ZHJhdGlvbi4gQ2hlY2sgdGhhdCB0aGUgbGlicmFyaWVzIHlvdSBhcmUgdXNpbmcgc3VwcG9ydCBoeWRyYXRpb24uXCIpO1xuICAgIGNvbnN0IHQgPSBpc01hdGhNTCA/IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzE5OTgvTWF0aC9NYXRoTUxcIiwgXCJ0ZW1wbGF0ZVwiKSA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiKTtcbiAgICB0LmlubmVySFRNTCA9IGh0bWw7XG4gICAgcmV0dXJuIGlzU1ZHID8gdC5jb250ZW50LmZpcnN0Q2hpbGQuZmlyc3RDaGlsZCA6IGlzTWF0aE1MID8gdC5maXJzdENoaWxkIDogdC5jb250ZW50LmZpcnN0Q2hpbGQ7XG4gIH07XG4gIGNvbnN0IGZuID0gaXNJbXBvcnROb2RlID8gKCkgPT4gdW50cmFjaygoKSA9PiBkb2N1bWVudC5pbXBvcnROb2RlKG5vZGUgfHwgKG5vZGUgPSBjcmVhdGUoKSksIHRydWUpKSA6ICgpID0+IChub2RlIHx8IChub2RlID0gY3JlYXRlKCkpKS5jbG9uZU5vZGUodHJ1ZSk7XG4gIGZuLmNsb25lTm9kZSA9IGZuO1xuICByZXR1cm4gZm47XG59XG5mdW5jdGlvbiBkZWxlZ2F0ZUV2ZW50cyhldmVudE5hbWVzLCBkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudCkge1xuICBjb25zdCBlID0gZG9jdW1lbnRbJCRFVkVOVFNdIHx8IChkb2N1bWVudFskJEVWRU5UU10gPSBuZXcgU2V0KCkpO1xuICBmb3IgKGxldCBpID0gMCwgbCA9IGV2ZW50TmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgY29uc3QgbmFtZSA9IGV2ZW50TmFtZXNbaV07XG4gICAgaWYgKCFlLmhhcyhuYW1lKSkge1xuICAgICAgZS5hZGQobmFtZSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50SGFuZGxlcik7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBjbGVhckRlbGVnYXRlZEV2ZW50cyhkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudCkge1xuICBpZiAoZG9jdW1lbnRbJCRFVkVOVFNdKSB7XG4gICAgZm9yIChsZXQgbmFtZSBvZiBkb2N1bWVudFskJEVWRU5UU10ua2V5cygpKSBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50SGFuZGxlcik7XG4gICAgZGVsZXRlIGRvY3VtZW50WyQkRVZFTlRTXTtcbiAgfVxufVxuZnVuY3Rpb24gc2V0UHJvcGVydHkobm9kZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIG5vZGVbbmFtZV0gPSB2YWx1ZTtcbn1cbmZ1bmN0aW9uIHNldEF0dHJpYnV0ZShub2RlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlKG5hbWUpO2Vsc2Ugbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xufVxuZnVuY3Rpb24gc2V0QXR0cmlidXRlTlMobm9kZSwgbmFtZXNwYWNlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlTlMobmFtZXNwYWNlLCBuYW1lKTtlbHNlIG5vZGUuc2V0QXR0cmlidXRlTlMobmFtZXNwYWNlLCBuYW1lLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBzZXRCb29sQXR0cmlidXRlKG5vZGUsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICB2YWx1ZSA/IG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsIFwiXCIpIDogbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7XG59XG5mdW5jdGlvbiBjbGFzc05hbWUobm9kZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIGlmICh2YWx1ZSA9PSBudWxsKSBub2RlLnJlbW92ZUF0dHJpYnV0ZShcImNsYXNzXCIpO2Vsc2Ugbm9kZS5jbGFzc05hbWUgPSB2YWx1ZTtcbn1cbmZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXIobm9kZSwgbmFtZSwgaGFuZGxlciwgZGVsZWdhdGUpIHtcbiAgaWYgKGRlbGVnYXRlKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoaGFuZGxlcikpIHtcbiAgICAgIG5vZGVbYCQkJHtuYW1lfWBdID0gaGFuZGxlclswXTtcbiAgICAgIG5vZGVbYCQkJHtuYW1lfURhdGFgXSA9IGhhbmRsZXJbMV07XG4gICAgfSBlbHNlIG5vZGVbYCQkJHtuYW1lfWBdID0gaGFuZGxlcjtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGhhbmRsZXIpKSB7XG4gICAgY29uc3QgaGFuZGxlckZuID0gaGFuZGxlclswXTtcbiAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgaGFuZGxlclswXSA9IGUgPT4gaGFuZGxlckZuLmNhbGwobm9kZSwgaGFuZGxlclsxXSwgZSkpO1xuICB9IGVsc2Ugbm9kZS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGhhbmRsZXIsIHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIgJiYgaGFuZGxlcik7XG59XG5mdW5jdGlvbiBjbGFzc0xpc3Qobm9kZSwgdmFsdWUsIHByZXYgPSB7fSkge1xuICBjb25zdCBjbGFzc0tleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSB8fCB7fSksXG4gICAgcHJldktleXMgPSBPYmplY3Qua2V5cyhwcmV2KTtcbiAgbGV0IGksIGxlbjtcbiAgZm9yIChpID0gMCwgbGVuID0gcHJldktleXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBwcmV2S2V5c1tpXTtcbiAgICBpZiAoIWtleSB8fCBrZXkgPT09IFwidW5kZWZpbmVkXCIgfHwgdmFsdWVba2V5XSkgY29udGludWU7XG4gICAgdG9nZ2xlQ2xhc3NLZXkobm9kZSwga2V5LCBmYWxzZSk7XG4gICAgZGVsZXRlIHByZXZba2V5XTtcbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBjbGFzc0tleXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBjbGFzc0tleXNbaV0sXG4gICAgICBjbGFzc1ZhbHVlID0gISF2YWx1ZVtrZXldO1xuICAgIGlmICgha2V5IHx8IGtleSA9PT0gXCJ1bmRlZmluZWRcIiB8fCBwcmV2W2tleV0gPT09IGNsYXNzVmFsdWUgfHwgIWNsYXNzVmFsdWUpIGNvbnRpbnVlO1xuICAgIHRvZ2dsZUNsYXNzS2V5KG5vZGUsIGtleSwgdHJ1ZSk7XG4gICAgcHJldltrZXldID0gY2xhc3NWYWx1ZTtcbiAgfVxuICByZXR1cm4gcHJldjtcbn1cbmZ1bmN0aW9uIHN0eWxlKG5vZGUsIHZhbHVlLCBwcmV2KSB7XG4gIGlmICghdmFsdWUpIHJldHVybiBwcmV2ID8gc2V0QXR0cmlidXRlKG5vZGUsIFwic3R5bGVcIikgOiB2YWx1ZTtcbiAgY29uc3Qgbm9kZVN0eWxlID0gbm9kZS5zdHlsZTtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIG5vZGVTdHlsZS5jc3NUZXh0ID0gdmFsdWU7XG4gIHR5cGVvZiBwcmV2ID09PSBcInN0cmluZ1wiICYmIChub2RlU3R5bGUuY3NzVGV4dCA9IHByZXYgPSB1bmRlZmluZWQpO1xuICBwcmV2IHx8IChwcmV2ID0ge30pO1xuICB2YWx1ZSB8fCAodmFsdWUgPSB7fSk7XG4gIGxldCB2LCBzO1xuICBmb3IgKHMgaW4gcHJldikge1xuICAgIHZhbHVlW3NdID09IG51bGwgJiYgbm9kZVN0eWxlLnJlbW92ZVByb3BlcnR5KHMpO1xuICAgIGRlbGV0ZSBwcmV2W3NdO1xuICB9XG4gIGZvciAocyBpbiB2YWx1ZSkge1xuICAgIHYgPSB2YWx1ZVtzXTtcbiAgICBpZiAodiAhPT0gcHJldltzXSkge1xuICAgICAgbm9kZVN0eWxlLnNldFByb3BlcnR5KHMsIHYpO1xuICAgICAgcHJldltzXSA9IHY7XG4gICAgfVxuICB9XG4gIHJldHVybiBwcmV2O1xufVxuZnVuY3Rpb24gc3ByZWFkKG5vZGUsIHByb3BzID0ge30sIGlzU1ZHLCBza2lwQ2hpbGRyZW4pIHtcbiAgY29uc3QgcHJldlByb3BzID0ge307XG4gIGlmICghc2tpcENoaWxkcmVuKSB7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHByZXZQcm9wcy5jaGlsZHJlbiA9IGluc2VydEV4cHJlc3Npb24obm9kZSwgcHJvcHMuY2hpbGRyZW4sIHByZXZQcm9wcy5jaGlsZHJlbikpO1xuICB9XG4gIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiB0eXBlb2YgcHJvcHMucmVmID09PSBcImZ1bmN0aW9uXCIgJiYgdXNlKHByb3BzLnJlZiwgbm9kZSkpO1xuICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gYXNzaWduKG5vZGUsIHByb3BzLCBpc1NWRywgdHJ1ZSwgcHJldlByb3BzLCB0cnVlKSk7XG4gIHJldHVybiBwcmV2UHJvcHM7XG59XG5mdW5jdGlvbiBkeW5hbWljUHJvcGVydHkocHJvcHMsIGtleSkge1xuICBjb25zdCBzcmMgPSBwcm9wc1trZXldO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvcHMsIGtleSwge1xuICAgIGdldCgpIHtcbiAgICAgIHJldHVybiBzcmMoKTtcbiAgICB9LFxuICAgIGVudW1lcmFibGU6IHRydWVcbiAgfSk7XG4gIHJldHVybiBwcm9wcztcbn1cbmZ1bmN0aW9uIHVzZShmbiwgZWxlbWVudCwgYXJnKSB7XG4gIHJldHVybiB1bnRyYWNrKCgpID0+IGZuKGVsZW1lbnQsIGFyZykpO1xufVxuZnVuY3Rpb24gaW5zZXJ0KHBhcmVudCwgYWNjZXNzb3IsIG1hcmtlciwgaW5pdGlhbCkge1xuICBpZiAobWFya2VyICE9PSB1bmRlZmluZWQgJiYgIWluaXRpYWwpIGluaXRpYWwgPSBbXTtcbiAgaWYgKHR5cGVvZiBhY2Nlc3NvciAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm4gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIGFjY2Vzc29yLCBpbml0aWFsLCBtYXJrZXIpO1xuICBjcmVhdGVSZW5kZXJFZmZlY3QoY3VycmVudCA9PiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgYWNjZXNzb3IoKSwgY3VycmVudCwgbWFya2VyKSwgaW5pdGlhbCk7XG59XG5mdW5jdGlvbiBhc3NpZ24obm9kZSwgcHJvcHMsIGlzU1ZHLCBza2lwQ2hpbGRyZW4sIHByZXZQcm9wcyA9IHt9LCBza2lwUmVmID0gZmFsc2UpIHtcbiAgcHJvcHMgfHwgKHByb3BzID0ge30pO1xuICBmb3IgKGNvbnN0IHByb3AgaW4gcHJldlByb3BzKSB7XG4gICAgaWYgKCEocHJvcCBpbiBwcm9wcykpIHtcbiAgICAgIGlmIChwcm9wID09PSBcImNoaWxkcmVuXCIpIGNvbnRpbnVlO1xuICAgICAgcHJldlByb3BzW3Byb3BdID0gYXNzaWduUHJvcChub2RlLCBwcm9wLCBudWxsLCBwcmV2UHJvcHNbcHJvcF0sIGlzU1ZHLCBza2lwUmVmLCBwcm9wcyk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgcHJvcCBpbiBwcm9wcykge1xuICAgIGlmIChwcm9wID09PSBcImNoaWxkcmVuXCIpIHtcbiAgICAgIGlmICghc2tpcENoaWxkcmVuKSBpbnNlcnRFeHByZXNzaW9uKG5vZGUsIHByb3BzLmNoaWxkcmVuKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZSA9IHByb3BzW3Byb3BdO1xuICAgIHByZXZQcm9wc1twcm9wXSA9IGFzc2lnblByb3Aobm9kZSwgcHJvcCwgdmFsdWUsIHByZXZQcm9wc1twcm9wXSwgaXNTVkcsIHNraXBSZWYsIHByb3BzKTtcbiAgfVxufVxuZnVuY3Rpb24gaHlkcmF0ZSQxKGNvZGUsIGVsZW1lbnQsIG9wdGlvbnMgPSB7fSkge1xuICBpZiAoZ2xvYmFsVGhpcy5fJEhZLmRvbmUpIHJldHVybiByZW5kZXIoY29kZSwgZWxlbWVudCwgWy4uLmVsZW1lbnQuY2hpbGROb2Rlc10sIG9wdGlvbnMpO1xuICBzaGFyZWRDb25maWcuY29tcGxldGVkID0gZ2xvYmFsVGhpcy5fJEhZLmNvbXBsZXRlZDtcbiAgc2hhcmVkQ29uZmlnLmV2ZW50cyA9IGdsb2JhbFRoaXMuXyRIWS5ldmVudHM7XG4gIHNoYXJlZENvbmZpZy5sb2FkID0gaWQgPT4gZ2xvYmFsVGhpcy5fJEhZLnJbaWRdO1xuICBzaGFyZWRDb25maWcuaGFzID0gaWQgPT4gaWQgaW4gZ2xvYmFsVGhpcy5fJEhZLnI7XG4gIHNoYXJlZENvbmZpZy5nYXRoZXIgPSByb290ID0+IGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgcm9vdCk7XG4gIHNoYXJlZENvbmZpZy5yZWdpc3RyeSA9IG5ldyBNYXAoKTtcbiAgc2hhcmVkQ29uZmlnLmNvbnRleHQgPSB7XG4gICAgaWQ6IG9wdGlvbnMucmVuZGVySWQgfHwgXCJcIixcbiAgICBjb3VudDogMFxuICB9O1xuICB0cnkge1xuICAgIGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgb3B0aW9ucy5yZW5kZXJJZCk7XG4gICAgcmV0dXJuIHJlbmRlcihjb2RlLCBlbGVtZW50LCBbLi4uZWxlbWVudC5jaGlsZE5vZGVzXSwgb3B0aW9ucyk7XG4gIH0gZmluYWxseSB7XG4gICAgc2hhcmVkQ29uZmlnLmNvbnRleHQgPSBudWxsO1xuICB9XG59XG5mdW5jdGlvbiBnZXROZXh0RWxlbWVudCh0ZW1wbGF0ZSkge1xuICBsZXQgbm9kZSxcbiAgICBrZXksXG4gICAgaHlkcmF0aW5nID0gaXNIeWRyYXRpbmcoKTtcbiAgaWYgKCFoeWRyYXRpbmcgfHwgIShub2RlID0gc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LmdldChrZXkgPSBnZXRIeWRyYXRpb25LZXkoKSkpKSB7XG4gICAgaWYgKGh5ZHJhdGluZykge1xuICAgICAgc2hhcmVkQ29uZmlnLmRvbmUgPSB0cnVlO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBIeWRyYXRpb24gTWlzbWF0Y2guIFVuYWJsZSB0byBmaW5kIERPTSBub2RlcyBmb3IgaHlkcmF0aW9uIGtleTogJHtrZXl9XFxuJHt0ZW1wbGF0ZSA/IHRlbXBsYXRlKCkub3V0ZXJIVE1MIDogXCJcIn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRlbXBsYXRlKCk7XG4gIH1cbiAgaWYgKHNoYXJlZENvbmZpZy5jb21wbGV0ZWQpIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQuYWRkKG5vZGUpO1xuICBzaGFyZWRDb25maWcucmVnaXN0cnkuZGVsZXRlKGtleSk7XG4gIHJldHVybiBub2RlO1xufVxuZnVuY3Rpb24gZ2V0TmV4dE1hdGNoKGVsLCBub2RlTmFtZSkge1xuICB3aGlsZSAoZWwgJiYgZWwubG9jYWxOYW1lICE9PSBub2RlTmFtZSkgZWwgPSBlbC5uZXh0U2libGluZztcbiAgcmV0dXJuIGVsO1xufVxuZnVuY3Rpb24gZ2V0TmV4dE1hcmtlcihzdGFydCkge1xuICBsZXQgZW5kID0gc3RhcnQsXG4gICAgY291bnQgPSAwLFxuICAgIGN1cnJlbnQgPSBbXTtcbiAgaWYgKGlzSHlkcmF0aW5nKHN0YXJ0KSkge1xuICAgIHdoaWxlIChlbmQpIHtcbiAgICAgIGlmIChlbmQubm9kZVR5cGUgPT09IDgpIHtcbiAgICAgICAgY29uc3QgdiA9IGVuZC5ub2RlVmFsdWU7XG4gICAgICAgIGlmICh2ID09PSBcIiRcIikgY291bnQrKztlbHNlIGlmICh2ID09PSBcIi9cIikge1xuICAgICAgICAgIGlmIChjb3VudCA9PT0gMCkgcmV0dXJuIFtlbmQsIGN1cnJlbnRdO1xuICAgICAgICAgIGNvdW50LS07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGN1cnJlbnQucHVzaChlbmQpO1xuICAgICAgZW5kID0gZW5kLm5leHRTaWJsaW5nO1xuICAgIH1cbiAgfVxuICByZXR1cm4gW2VuZCwgY3VycmVudF07XG59XG5mdW5jdGlvbiBydW5IeWRyYXRpb25FdmVudHMoKSB7XG4gIGlmIChzaGFyZWRDb25maWcuZXZlbnRzICYmICFzaGFyZWRDb25maWcuZXZlbnRzLnF1ZXVlZCkge1xuICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgY29tcGxldGVkLFxuICAgICAgICBldmVudHNcbiAgICAgIH0gPSBzaGFyZWRDb25maWc7XG4gICAgICBpZiAoIWV2ZW50cykgcmV0dXJuO1xuICAgICAgZXZlbnRzLnF1ZXVlZCA9IGZhbHNlO1xuICAgICAgd2hpbGUgKGV2ZW50cy5sZW5ndGgpIHtcbiAgICAgICAgY29uc3QgW2VsLCBlXSA9IGV2ZW50c1swXTtcbiAgICAgICAgaWYgKCFjb21wbGV0ZWQuaGFzKGVsKSkgcmV0dXJuO1xuICAgICAgICBldmVudHMuc2hpZnQoKTtcbiAgICAgICAgZXZlbnRIYW5kbGVyKGUpO1xuICAgICAgfVxuICAgICAgaWYgKHNoYXJlZENvbmZpZy5kb25lKSB7XG4gICAgICAgIHNoYXJlZENvbmZpZy5ldmVudHMgPSBfJEhZLmV2ZW50cyA9IG51bGw7XG4gICAgICAgIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQgPSBfJEhZLmNvbXBsZXRlZCA9IG51bGw7XG4gICAgICB9XG4gICAgfSk7XG4gICAgc2hhcmVkQ29uZmlnLmV2ZW50cy5xdWV1ZWQgPSB0cnVlO1xuICB9XG59XG5mdW5jdGlvbiBpc0h5ZHJhdGluZyhub2RlKSB7XG4gIHJldHVybiAhIXNoYXJlZENvbmZpZy5jb250ZXh0ICYmICFzaGFyZWRDb25maWcuZG9uZSAmJiAoIW5vZGUgfHwgbm9kZS5pc0Nvbm5lY3RlZCk7XG59XG5mdW5jdGlvbiB0b1Byb3BlcnR5TmFtZShuYW1lKSB7XG4gIHJldHVybiBuYW1lLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvLShbYS16XSkvZywgKF8sIHcpID0+IHcudG9VcHBlckNhc2UoKSk7XG59XG5mdW5jdGlvbiB0b2dnbGVDbGFzc0tleShub2RlLCBrZXksIHZhbHVlKSB7XG4gIGNvbnN0IGNsYXNzTmFtZXMgPSBrZXkudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gIGZvciAobGV0IGkgPSAwLCBuYW1lTGVuID0gY2xhc3NOYW1lcy5sZW5ndGg7IGkgPCBuYW1lTGVuOyBpKyspIG5vZGUuY2xhc3NMaXN0LnRvZ2dsZShjbGFzc05hbWVzW2ldLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBhc3NpZ25Qcm9wKG5vZGUsIHByb3AsIHZhbHVlLCBwcmV2LCBpc1NWRywgc2tpcFJlZiwgcHJvcHMpIHtcbiAgbGV0IGlzQ0UsIGlzUHJvcCwgaXNDaGlsZFByb3AsIHByb3BBbGlhcywgZm9yY2VQcm9wO1xuICBpZiAocHJvcCA9PT0gXCJzdHlsZVwiKSByZXR1cm4gc3R5bGUobm9kZSwgdmFsdWUsIHByZXYpO1xuICBpZiAocHJvcCA9PT0gXCJjbGFzc0xpc3RcIikgcmV0dXJuIGNsYXNzTGlzdChub2RlLCB2YWx1ZSwgcHJldik7XG4gIGlmICh2YWx1ZSA9PT0gcHJldikgcmV0dXJuIHByZXY7XG4gIGlmIChwcm9wID09PSBcInJlZlwiKSB7XG4gICAgaWYgKCFza2lwUmVmKSB2YWx1ZShub2RlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDMpID09PSBcIm9uOlwiKSB7XG4gICAgY29uc3QgZSA9IHByb3Auc2xpY2UoMyk7XG4gICAgcHJldiAmJiBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoZSwgcHJldiwgdHlwZW9mIHByZXYgIT09IFwiZnVuY3Rpb25cIiAmJiBwcmV2KTtcbiAgICB2YWx1ZSAmJiBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZSwgdmFsdWUsIHR5cGVvZiB2YWx1ZSAhPT0gXCJmdW5jdGlvblwiICYmIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDEwKSA9PT0gXCJvbmNhcHR1cmU6XCIpIHtcbiAgICBjb25zdCBlID0gcHJvcC5zbGljZSgxMCk7XG4gICAgcHJldiAmJiBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoZSwgcHJldiwgdHJ1ZSk7XG4gICAgdmFsdWUgJiYgbm9kZS5hZGRFdmVudExpc3RlbmVyKGUsIHZhbHVlLCB0cnVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDIpID09PSBcIm9uXCIpIHtcbiAgICBjb25zdCBuYW1lID0gcHJvcC5zbGljZSgyKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGRlbGVnYXRlID0gRGVsZWdhdGVkRXZlbnRzLmhhcyhuYW1lKTtcbiAgICBpZiAoIWRlbGVnYXRlICYmIHByZXYpIHtcbiAgICAgIGNvbnN0IGggPSBBcnJheS5pc0FycmF5KHByZXYpID8gcHJldlswXSA6IHByZXY7XG4gICAgICBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgaCk7XG4gICAgfVxuICAgIGlmIChkZWxlZ2F0ZSB8fCB2YWx1ZSkge1xuICAgICAgYWRkRXZlbnRMaXN0ZW5lcihub2RlLCBuYW1lLCB2YWx1ZSwgZGVsZWdhdGUpO1xuICAgICAgZGVsZWdhdGUgJiYgZGVsZWdhdGVFdmVudHMoW25hbWVdKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCA1KSA9PT0gXCJhdHRyOlwiKSB7XG4gICAgc2V0QXR0cmlidXRlKG5vZGUsIHByb3Auc2xpY2UoNSksIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDUpID09PSBcImJvb2w6XCIpIHtcbiAgICBzZXRCb29sQXR0cmlidXRlKG5vZGUsIHByb3Auc2xpY2UoNSksIHZhbHVlKTtcbiAgfSBlbHNlIGlmICgoZm9yY2VQcm9wID0gcHJvcC5zbGljZSgwLCA1KSA9PT0gXCJwcm9wOlwiKSB8fCAoaXNDaGlsZFByb3AgPSBDaGlsZFByb3BlcnRpZXMuaGFzKHByb3ApKSB8fCAhaXNTVkcgJiYgKChwcm9wQWxpYXMgPSBnZXRQcm9wQWxpYXMocHJvcCwgbm9kZS50YWdOYW1lKSkgfHwgKGlzUHJvcCA9IFByb3BlcnRpZXMuaGFzKHByb3ApKSkgfHwgKGlzQ0UgPSBub2RlLm5vZGVOYW1lLmluY2x1ZGVzKFwiLVwiKSB8fCBcImlzXCIgaW4gcHJvcHMpKSB7XG4gICAgaWYgKGZvcmNlUHJvcCkge1xuICAgICAgcHJvcCA9IHByb3Auc2xpY2UoNSk7XG4gICAgICBpc1Byb3AgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybiB2YWx1ZTtcbiAgICBpZiAocHJvcCA9PT0gXCJjbGFzc1wiIHx8IHByb3AgPT09IFwiY2xhc3NOYW1lXCIpIGNsYXNzTmFtZShub2RlLCB2YWx1ZSk7ZWxzZSBpZiAoaXNDRSAmJiAhaXNQcm9wICYmICFpc0NoaWxkUHJvcCkgbm9kZVt0b1Byb3BlcnR5TmFtZShwcm9wKV0gPSB2YWx1ZTtlbHNlIG5vZGVbcHJvcEFsaWFzIHx8IHByb3BdID0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgbnMgPSBpc1NWRyAmJiBwcm9wLmluZGV4T2YoXCI6XCIpID4gLTEgJiYgU1ZHTmFtZXNwYWNlW3Byb3Auc3BsaXQoXCI6XCIpWzBdXTtcbiAgICBpZiAobnMpIHNldEF0dHJpYnV0ZU5TKG5vZGUsIG5zLCBwcm9wLCB2YWx1ZSk7ZWxzZSBzZXRBdHRyaWJ1dGUobm9kZSwgQWxpYXNlc1twcm9wXSB8fCBwcm9wLCB2YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gZXZlbnRIYW5kbGVyKGUpIHtcbiAgaWYgKHNoYXJlZENvbmZpZy5yZWdpc3RyeSAmJiBzaGFyZWRDb25maWcuZXZlbnRzKSB7XG4gICAgaWYgKHNoYXJlZENvbmZpZy5ldmVudHMuZmluZCgoW2VsLCBldl0pID0+IGV2ID09PSBlKSkgcmV0dXJuO1xuICB9XG4gIGxldCBub2RlID0gZS50YXJnZXQ7XG4gIGNvbnN0IGtleSA9IGAkJCR7ZS50eXBlfWA7XG4gIGNvbnN0IG9yaVRhcmdldCA9IGUudGFyZ2V0O1xuICBjb25zdCBvcmlDdXJyZW50VGFyZ2V0ID0gZS5jdXJyZW50VGFyZ2V0O1xuICBjb25zdCByZXRhcmdldCA9IHZhbHVlID0+IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlLCBcInRhcmdldFwiLCB7XG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHZhbHVlXG4gIH0pO1xuICBjb25zdCBoYW5kbGVOb2RlID0gKCkgPT4ge1xuICAgIGNvbnN0IGhhbmRsZXIgPSBub2RlW2tleV07XG4gICAgaWYgKGhhbmRsZXIgJiYgIW5vZGUuZGlzYWJsZWQpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSBub2RlW2Ake2tleX1EYXRhYF07XG4gICAgICBkYXRhICE9PSB1bmRlZmluZWQgPyBoYW5kbGVyLmNhbGwobm9kZSwgZGF0YSwgZSkgOiBoYW5kbGVyLmNhbGwobm9kZSwgZSk7XG4gICAgICBpZiAoZS5jYW5jZWxCdWJibGUpIHJldHVybjtcbiAgICB9XG4gICAgbm9kZS5ob3N0ICYmIHR5cGVvZiBub2RlLmhvc3QgIT09IFwic3RyaW5nXCIgJiYgIW5vZGUuaG9zdC5fJGhvc3QgJiYgbm9kZS5jb250YWlucyhlLnRhcmdldCkgJiYgcmV0YXJnZXQobm9kZS5ob3N0KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbiAgY29uc3Qgd2Fsa1VwVHJlZSA9ICgpID0+IHtcbiAgICB3aGlsZSAoaGFuZGxlTm9kZSgpICYmIChub2RlID0gbm9kZS5fJGhvc3QgfHwgbm9kZS5wYXJlbnROb2RlIHx8IG5vZGUuaG9zdCkpO1xuICB9O1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZSwgXCJjdXJyZW50VGFyZ2V0XCIsIHtcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgZ2V0KCkge1xuICAgICAgcmV0dXJuIG5vZGUgfHwgZG9jdW1lbnQ7XG4gICAgfVxuICB9KTtcbiAgaWYgKHNoYXJlZENvbmZpZy5yZWdpc3RyeSAmJiAhc2hhcmVkQ29uZmlnLmRvbmUpIHNoYXJlZENvbmZpZy5kb25lID0gXyRIWS5kb25lID0gdHJ1ZTtcbiAgaWYgKGUuY29tcG9zZWRQYXRoKSB7XG4gICAgY29uc3QgcGF0aCA9IGUuY29tcG9zZWRQYXRoKCk7XG4gICAgcmV0YXJnZXQocGF0aFswXSk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXRoLmxlbmd0aCAtIDI7IGkrKykge1xuICAgICAgbm9kZSA9IHBhdGhbaV07XG4gICAgICBpZiAoIWhhbmRsZU5vZGUoKSkgYnJlYWs7XG4gICAgICBpZiAobm9kZS5fJGhvc3QpIHtcbiAgICAgICAgbm9kZSA9IG5vZGUuXyRob3N0O1xuICAgICAgICB3YWxrVXBUcmVlKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKG5vZGUucGFyZW50Tm9kZSA9PT0gb3JpQ3VycmVudFRhcmdldCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZWxzZSB3YWxrVXBUcmVlKCk7XG4gIHJldGFyZ2V0KG9yaVRhcmdldCk7XG59XG5mdW5jdGlvbiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgdmFsdWUsIGN1cnJlbnQsIG1hcmtlciwgdW53cmFwQXJyYXkpIHtcbiAgY29uc3QgaHlkcmF0aW5nID0gaXNIeWRyYXRpbmcocGFyZW50KTtcbiAgaWYgKGh5ZHJhdGluZykge1xuICAgICFjdXJyZW50ICYmIChjdXJyZW50ID0gWy4uLnBhcmVudC5jaGlsZE5vZGVzXSk7XG4gICAgbGV0IGNsZWFuZWQgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGN1cnJlbnQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBjdXJyZW50W2ldO1xuICAgICAgaWYgKG5vZGUubm9kZVR5cGUgPT09IDggJiYgbm9kZS5kYXRhLnNsaWNlKDAsIDIpID09PSBcIiEkXCIpIG5vZGUucmVtb3ZlKCk7ZWxzZSBjbGVhbmVkLnB1c2gobm9kZSk7XG4gICAgfVxuICAgIGN1cnJlbnQgPSBjbGVhbmVkO1xuICB9XG4gIHdoaWxlICh0eXBlb2YgY3VycmVudCA9PT0gXCJmdW5jdGlvblwiKSBjdXJyZW50ID0gY3VycmVudCgpO1xuICBpZiAodmFsdWUgPT09IGN1cnJlbnQpIHJldHVybiBjdXJyZW50O1xuICBjb25zdCB0ID0gdHlwZW9mIHZhbHVlLFxuICAgIG11bHRpID0gbWFya2VyICE9PSB1bmRlZmluZWQ7XG4gIHBhcmVudCA9IG11bHRpICYmIGN1cnJlbnRbMF0gJiYgY3VycmVudFswXS5wYXJlbnROb2RlIHx8IHBhcmVudDtcbiAgaWYgKHQgPT09IFwic3RyaW5nXCIgfHwgdCA9PT0gXCJudW1iZXJcIikge1xuICAgIGlmIChoeWRyYXRpbmcpIHJldHVybiBjdXJyZW50O1xuICAgIGlmICh0ID09PSBcIm51bWJlclwiKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICBpZiAodmFsdWUgPT09IGN1cnJlbnQpIHJldHVybiBjdXJyZW50O1xuICAgIH1cbiAgICBpZiAobXVsdGkpIHtcbiAgICAgIGxldCBub2RlID0gY3VycmVudFswXTtcbiAgICAgIGlmIChub2RlICYmIG5vZGUubm9kZVR5cGUgPT09IDMpIHtcbiAgICAgICAgbm9kZS5kYXRhICE9PSB2YWx1ZSAmJiAobm9kZS5kYXRhID0gdmFsdWUpO1xuICAgICAgfSBlbHNlIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh2YWx1ZSk7XG4gICAgICBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgbm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChjdXJyZW50ICE9PSBcIlwiICYmIHR5cGVvZiBjdXJyZW50ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGN1cnJlbnQgPSBwYXJlbnQuZmlyc3RDaGlsZC5kYXRhID0gdmFsdWU7XG4gICAgICB9IGVsc2UgY3VycmVudCA9IHBhcmVudC50ZXh0Q29udGVudCA9IHZhbHVlO1xuICAgIH1cbiAgfSBlbHNlIGlmICh2YWx1ZSA9PSBudWxsIHx8IHQgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgaWYgKGh5ZHJhdGluZykgcmV0dXJuIGN1cnJlbnQ7XG4gICAgY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIpO1xuICB9IGVsc2UgaWYgKHQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiB7XG4gICAgICBsZXQgdiA9IHZhbHVlKCk7XG4gICAgICB3aGlsZSAodHlwZW9mIHYgPT09IFwiZnVuY3Rpb25cIikgdiA9IHYoKTtcbiAgICAgIGN1cnJlbnQgPSBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgdiwgY3VycmVudCwgbWFya2VyKTtcbiAgICB9KTtcbiAgICByZXR1cm4gKCkgPT4gY3VycmVudDtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIGNvbnN0IGFycmF5ID0gW107XG4gICAgY29uc3QgY3VycmVudEFycmF5ID0gY3VycmVudCAmJiBBcnJheS5pc0FycmF5KGN1cnJlbnQpO1xuICAgIGlmIChub3JtYWxpemVJbmNvbWluZ0FycmF5KGFycmF5LCB2YWx1ZSwgY3VycmVudCwgdW53cmFwQXJyYXkpKSB7XG4gICAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gY3VycmVudCA9IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCBhcnJheSwgY3VycmVudCwgbWFya2VyLCB0cnVlKSk7XG4gICAgICByZXR1cm4gKCkgPT4gY3VycmVudDtcbiAgICB9XG4gICAgaWYgKGh5ZHJhdGluZykge1xuICAgICAgaWYgKCFhcnJheS5sZW5ndGgpIHJldHVybiBjdXJyZW50O1xuICAgICAgaWYgKG1hcmtlciA9PT0gdW5kZWZpbmVkKSByZXR1cm4gY3VycmVudCA9IFsuLi5wYXJlbnQuY2hpbGROb2Rlc107XG4gICAgICBsZXQgbm9kZSA9IGFycmF5WzBdO1xuICAgICAgaWYgKG5vZGUucGFyZW50Tm9kZSAhPT0gcGFyZW50KSByZXR1cm4gY3VycmVudDtcbiAgICAgIGNvbnN0IG5vZGVzID0gW25vZGVdO1xuICAgICAgd2hpbGUgKChub2RlID0gbm9kZS5uZXh0U2libGluZykgIT09IG1hcmtlcikgbm9kZXMucHVzaChub2RlKTtcbiAgICAgIHJldHVybiBjdXJyZW50ID0gbm9kZXM7XG4gICAgfVxuICAgIGlmIChhcnJheS5sZW5ndGggPT09IDApIHtcbiAgICAgIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyKTtcbiAgICAgIGlmIChtdWx0aSkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgfSBlbHNlIGlmIChjdXJyZW50QXJyYXkpIHtcbiAgICAgIGlmIChjdXJyZW50Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBhcHBlbmROb2RlcyhwYXJlbnQsIGFycmF5LCBtYXJrZXIpO1xuICAgICAgfSBlbHNlIHJlY29uY2lsZUFycmF5cyhwYXJlbnQsIGN1cnJlbnQsIGFycmF5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY3VycmVudCAmJiBjbGVhbkNoaWxkcmVuKHBhcmVudCk7XG4gICAgICBhcHBlbmROb2RlcyhwYXJlbnQsIGFycmF5KTtcbiAgICB9XG4gICAgY3VycmVudCA9IGFycmF5O1xuICB9IGVsc2UgaWYgKHZhbHVlLm5vZGVUeXBlKSB7XG4gICAgaWYgKGh5ZHJhdGluZyAmJiB2YWx1ZS5wYXJlbnROb2RlKSByZXR1cm4gY3VycmVudCA9IG11bHRpID8gW3ZhbHVlXSA6IHZhbHVlO1xuICAgIGlmIChBcnJheS5pc0FycmF5KGN1cnJlbnQpKSB7XG4gICAgICBpZiAobXVsdGkpIHJldHVybiBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgdmFsdWUpO1xuICAgICAgY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG51bGwsIHZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnQgPT0gbnVsbCB8fCBjdXJyZW50ID09PSBcIlwiIHx8ICFwYXJlbnQuZmlyc3RDaGlsZCkge1xuICAgICAgcGFyZW50LmFwcGVuZENoaWxkKHZhbHVlKTtcbiAgICB9IGVsc2UgcGFyZW50LnJlcGxhY2VDaGlsZCh2YWx1ZSwgcGFyZW50LmZpcnN0Q2hpbGQpO1xuICAgIGN1cnJlbnQgPSB2YWx1ZTtcbiAgfSBlbHNlIGNvbnNvbGUud2FybihgVW5yZWNvZ25pemVkIHZhbHVlLiBTa2lwcGVkIGluc2VydGluZ2AsIHZhbHVlKTtcbiAgcmV0dXJuIGN1cnJlbnQ7XG59XG5mdW5jdGlvbiBub3JtYWxpemVJbmNvbWluZ0FycmF5KG5vcm1hbGl6ZWQsIGFycmF5LCBjdXJyZW50LCB1bndyYXApIHtcbiAgbGV0IGR5bmFtaWMgPSBmYWxzZTtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgbGV0IGl0ZW0gPSBhcnJheVtpXSxcbiAgICAgIHByZXYgPSBjdXJyZW50ICYmIGN1cnJlbnRbbm9ybWFsaXplZC5sZW5ndGhdLFxuICAgICAgdDtcbiAgICBpZiAoaXRlbSA9PSBudWxsIHx8IGl0ZW0gPT09IHRydWUgfHwgaXRlbSA9PT0gZmFsc2UpIDsgZWxzZSBpZiAoKHQgPSB0eXBlb2YgaXRlbSkgPT09IFwib2JqZWN0XCIgJiYgaXRlbS5ub2RlVHlwZSkge1xuICAgICAgbm9ybWFsaXplZC5wdXNoKGl0ZW0pO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShpdGVtKSkge1xuICAgICAgZHluYW1pYyA9IG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgaXRlbSwgcHJldikgfHwgZHluYW1pYztcbiAgICB9IGVsc2UgaWYgKHQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgaWYgKHVud3JhcCkge1xuICAgICAgICB3aGlsZSAodHlwZW9mIGl0ZW0gPT09IFwiZnVuY3Rpb25cIikgaXRlbSA9IGl0ZW0oKTtcbiAgICAgICAgZHluYW1pYyA9IG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgQXJyYXkuaXNBcnJheShpdGVtKSA/IGl0ZW0gOiBbaXRlbV0sIEFycmF5LmlzQXJyYXkocHJldikgPyBwcmV2IDogW3ByZXZdKSB8fCBkeW5hbWljO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9ybWFsaXplZC5wdXNoKGl0ZW0pO1xuICAgICAgICBkeW5hbWljID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdmFsdWUgPSBTdHJpbmcoaXRlbSk7XG4gICAgICBpZiAocHJldiAmJiBwcmV2Lm5vZGVUeXBlID09PSAzICYmIHByZXYuZGF0YSA9PT0gdmFsdWUpIG5vcm1hbGl6ZWQucHVzaChwcmV2KTtlbHNlIG5vcm1hbGl6ZWQucHVzaChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh2YWx1ZSkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZHluYW1pYztcbn1cbmZ1bmN0aW9uIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXksIG1hcmtlciA9IG51bGwpIHtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSBwYXJlbnQuaW5zZXJ0QmVmb3JlKGFycmF5W2ldLCBtYXJrZXIpO1xufVxuZnVuY3Rpb24gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgcmVwbGFjZW1lbnQpIHtcbiAgaWYgKG1hcmtlciA9PT0gdW5kZWZpbmVkKSByZXR1cm4gcGFyZW50LnRleHRDb250ZW50ID0gXCJcIjtcbiAgY29uc3Qgbm9kZSA9IHJlcGxhY2VtZW50IHx8IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXCIpO1xuICBpZiAoY3VycmVudC5sZW5ndGgpIHtcbiAgICBsZXQgaW5zZXJ0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gY3VycmVudC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgZWwgPSBjdXJyZW50W2ldO1xuICAgICAgaWYgKG5vZGUgIT09IGVsKSB7XG4gICAgICAgIGNvbnN0IGlzUGFyZW50ID0gZWwucGFyZW50Tm9kZSA9PT0gcGFyZW50O1xuICAgICAgICBpZiAoIWluc2VydGVkICYmICFpKSBpc1BhcmVudCA/IHBhcmVudC5yZXBsYWNlQ2hpbGQobm9kZSwgZWwpIDogcGFyZW50Lmluc2VydEJlZm9yZShub2RlLCBtYXJrZXIpO2Vsc2UgaXNQYXJlbnQgJiYgZWwucmVtb3ZlKCk7XG4gICAgICB9IGVsc2UgaW5zZXJ0ZWQgPSB0cnVlO1xuICAgIH1cbiAgfSBlbHNlIHBhcmVudC5pbnNlcnRCZWZvcmUobm9kZSwgbWFya2VyKTtcbiAgcmV0dXJuIFtub2RlXTtcbn1cbmZ1bmN0aW9uIGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgcm9vdCkge1xuICBjb25zdCB0ZW1wbGF0ZXMgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoYCpbZGF0YS1oa11gKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wbGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBub2RlID0gdGVtcGxhdGVzW2ldO1xuICAgIGNvbnN0IGtleSA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiZGF0YS1oa1wiKTtcbiAgICBpZiAoKCFyb290IHx8IGtleS5zdGFydHNXaXRoKHJvb3QpKSAmJiAhc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LmhhcyhrZXkpKSBzaGFyZWRDb25maWcucmVnaXN0cnkuc2V0KGtleSwgbm9kZSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGdldEh5ZHJhdGlvbktleSgpIHtcbiAgcmV0dXJuIHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCk7XG59XG5mdW5jdGlvbiBOb0h5ZHJhdGlvbihwcm9wcykge1xuICByZXR1cm4gc2hhcmVkQ29uZmlnLmNvbnRleHQgPyB1bmRlZmluZWQgOiBwcm9wcy5jaGlsZHJlbjtcbn1cbmZ1bmN0aW9uIEh5ZHJhdGlvbihwcm9wcykge1xuICByZXR1cm4gcHJvcHMuY2hpbGRyZW47XG59XG5jb25zdCB2b2lkRm4gPSAoKSA9PiB1bmRlZmluZWQ7XG5jb25zdCBSZXF1ZXN0Q29udGV4dCA9IFN5bWJvbCgpO1xuZnVuY3Rpb24gaW5uZXJIVE1MKHBhcmVudCwgY29udGVudCkge1xuICAhc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgKHBhcmVudC5pbm5lckhUTUwgPSBjb250ZW50KTtcbn1cblxuZnVuY3Rpb24gdGhyb3dJbkJyb3dzZXIoZnVuYykge1xuICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYCR7ZnVuYy5uYW1lfSBpcyBub3Qgc3VwcG9ydGVkIGluIHRoZSBicm93c2VyLCByZXR1cm5pbmcgdW5kZWZpbmVkYCk7XG4gIGNvbnNvbGUuZXJyb3IoZXJyKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyaW5nKGZuLCBvcHRpb25zKSB7XG4gIHRocm93SW5Ccm93c2VyKHJlbmRlclRvU3RyaW5nKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyaW5nQXN5bmMoZm4sIG9wdGlvbnMpIHtcbiAgdGhyb3dJbkJyb3dzZXIocmVuZGVyVG9TdHJpbmdBc3luYyk7XG59XG5mdW5jdGlvbiByZW5kZXJUb1N0cmVhbShmbiwgb3B0aW9ucykge1xuICB0aHJvd0luQnJvd3NlcihyZW5kZXJUb1N0cmVhbSk7XG59XG5mdW5jdGlvbiBzc3IodGVtcGxhdGUsIC4uLm5vZGVzKSB7fVxuZnVuY3Rpb24gc3NyRWxlbWVudChuYW1lLCBwcm9wcywgY2hpbGRyZW4sIG5lZWRzSWQpIHt9XG5mdW5jdGlvbiBzc3JDbGFzc0xpc3QodmFsdWUpIHt9XG5mdW5jdGlvbiBzc3JTdHlsZSh2YWx1ZSkge31cbmZ1bmN0aW9uIHNzckF0dHJpYnV0ZShrZXksIHZhbHVlKSB7fVxuZnVuY3Rpb24gc3NySHlkcmF0aW9uS2V5KCkge31cbmZ1bmN0aW9uIHJlc29sdmVTU1JOb2RlKG5vZGUpIHt9XG5mdW5jdGlvbiBlc2NhcGUoaHRtbCkge31cbmZ1bmN0aW9uIHNzclNwcmVhZChwcm9wcywgaXNTVkcsIHNraXBDaGlsZHJlbikge31cblxuY29uc3QgaXNTZXJ2ZXIgPSBmYWxzZTtcbmNvbnN0IGlzRGV2ID0gdHJ1ZTtcbmNvbnN0IFNWR19OQU1FU1BBQ0UgPSBcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI7XG5mdW5jdGlvbiBjcmVhdGVFbGVtZW50KHRhZ05hbWUsIGlzU1ZHID0gZmFsc2UpIHtcbiAgcmV0dXJuIGlzU1ZHID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR19OQU1FU1BBQ0UsIHRhZ05hbWUpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbn1cbmNvbnN0IGh5ZHJhdGUgPSAoLi4uYXJncykgPT4ge1xuICBlbmFibGVIeWRyYXRpb24oKTtcbiAgcmV0dXJuIGh5ZHJhdGUkMSguLi5hcmdzKTtcbn07XG5mdW5jdGlvbiBQb3J0YWwocHJvcHMpIHtcbiAgY29uc3Qge1xuICAgICAgdXNlU2hhZG93XG4gICAgfSA9IHByb3BzLFxuICAgIG1hcmtlciA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXCIpLFxuICAgIG1vdW50ID0gKCkgPT4gcHJvcHMubW91bnQgfHwgZG9jdW1lbnQuYm9keSxcbiAgICBvd25lciA9IGdldE93bmVyKCk7XG4gIGxldCBjb250ZW50O1xuICBsZXQgaHlkcmF0aW5nID0gISFzaGFyZWRDb25maWcuY29udGV4dDtcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoaHlkcmF0aW5nKSBnZXRPd25lcigpLnVzZXIgPSBoeWRyYXRpbmcgPSBmYWxzZTtcbiAgICBjb250ZW50IHx8IChjb250ZW50ID0gcnVuV2l0aE93bmVyKG93bmVyLCAoKSA9PiBjcmVhdGVNZW1vKCgpID0+IHByb3BzLmNoaWxkcmVuKSkpO1xuICAgIGNvbnN0IGVsID0gbW91bnQoKTtcbiAgICBpZiAoZWwgaW5zdGFuY2VvZiBIVE1MSGVhZEVsZW1lbnQpIHtcbiAgICAgIGNvbnN0IFtjbGVhbiwgc2V0Q2xlYW5dID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgICAgIGNvbnN0IGNsZWFudXAgPSAoKSA9PiBzZXRDbGVhbih0cnVlKTtcbiAgICAgIGNyZWF0ZVJvb3QoZGlzcG9zZSA9PiBpbnNlcnQoZWwsICgpID0+ICFjbGVhbigpID8gY29udGVudCgpIDogZGlzcG9zZSgpLCBudWxsKSk7XG4gICAgICBvbkNsZWFudXAoY2xlYW51cCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGNyZWF0ZUVsZW1lbnQocHJvcHMuaXNTVkcgPyBcImdcIiA6IFwiZGl2XCIsIHByb3BzLmlzU1ZHKSxcbiAgICAgICAgcmVuZGVyUm9vdCA9IHVzZVNoYWRvdyAmJiBjb250YWluZXIuYXR0YWNoU2hhZG93ID8gY29udGFpbmVyLmF0dGFjaFNoYWRvdyh7XG4gICAgICAgICAgbW9kZTogXCJvcGVuXCJcbiAgICAgICAgfSkgOiBjb250YWluZXI7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29udGFpbmVyLCBcIl8kaG9zdFwiLCB7XG4gICAgICAgIGdldCgpIHtcbiAgICAgICAgICByZXR1cm4gbWFya2VyLnBhcmVudE5vZGU7XG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gICAgICBpbnNlcnQocmVuZGVyUm9vdCwgY29udGVudCk7XG4gICAgICBlbC5hcHBlbmRDaGlsZChjb250YWluZXIpO1xuICAgICAgcHJvcHMucmVmICYmIHByb3BzLnJlZihjb250YWluZXIpO1xuICAgICAgb25DbGVhbnVwKCgpID0+IGVsLnJlbW92ZUNoaWxkKGNvbnRhaW5lcikpO1xuICAgIH1cbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgcmVuZGVyOiAhaHlkcmF0aW5nXG4gIH0pO1xuICByZXR1cm4gbWFya2VyO1xufVxuZnVuY3Rpb24gY3JlYXRlRHluYW1pYyhjb21wb25lbnQsIHByb3BzKSB7XG4gIGNvbnN0IGNhY2hlZCA9IGNyZWF0ZU1lbW8oY29tcG9uZW50KTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IGNhY2hlZCgpO1xuICAgIHN3aXRjaCAodHlwZW9mIGNvbXBvbmVudCkge1xuICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgICAgIE9iamVjdC5hc3NpZ24oY29tcG9uZW50LCB7XG4gICAgICAgICAgWyRERVZDT01QXTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHVudHJhY2soKCkgPT4gY29tcG9uZW50KHByb3BzKSk7XG4gICAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICAgIGNvbnN0IGlzU3ZnID0gU1ZHRWxlbWVudHMuaGFzKGNvbXBvbmVudCk7XG4gICAgICAgIGNvbnN0IGVsID0gc2hhcmVkQ29uZmlnLmNvbnRleHQgPyBnZXROZXh0RWxlbWVudCgpIDogY3JlYXRlRWxlbWVudChjb21wb25lbnQsIGlzU3ZnKTtcbiAgICAgICAgc3ByZWFkKGVsLCBwcm9wcywgaXNTdmcpO1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgfVxuICB9KTtcbn1cbmZ1bmN0aW9uIER5bmFtaWMocHJvcHMpIHtcbiAgY29uc3QgWywgb3RoZXJzXSA9IHNwbGl0UHJvcHMocHJvcHMsIFtcImNvbXBvbmVudFwiXSk7XG4gIHJldHVybiBjcmVhdGVEeW5hbWljKCgpID0+IHByb3BzLmNvbXBvbmVudCwgb3RoZXJzKTtcbn1cblxuZXhwb3J0IHsgQWxpYXNlcywgdm9pZEZuIGFzIEFzc2V0cywgQ2hpbGRQcm9wZXJ0aWVzLCBET01FbGVtZW50cywgRGVsZWdhdGVkRXZlbnRzLCBEeW5hbWljLCBIeWRyYXRpb24sIHZvaWRGbiBhcyBIeWRyYXRpb25TY3JpcHQsIE5vSHlkcmF0aW9uLCBQb3J0YWwsIFByb3BlcnRpZXMsIFJlcXVlc3RDb250ZXh0LCBTVkdFbGVtZW50cywgU1ZHTmFtZXNwYWNlLCBhZGRFdmVudExpc3RlbmVyLCBhc3NpZ24sIGNsYXNzTGlzdCwgY2xhc3NOYW1lLCBjbGVhckRlbGVnYXRlZEV2ZW50cywgY3JlYXRlRHluYW1pYywgZGVsZWdhdGVFdmVudHMsIGR5bmFtaWNQcm9wZXJ0eSwgZXNjYXBlLCB2b2lkRm4gYXMgZ2VuZXJhdGVIeWRyYXRpb25TY3JpcHQsIHZvaWRGbiBhcyBnZXRBc3NldHMsIGdldEh5ZHJhdGlvbktleSwgZ2V0TmV4dEVsZW1lbnQsIGdldE5leHRNYXJrZXIsIGdldE5leHRNYXRjaCwgZ2V0UHJvcEFsaWFzLCB2b2lkRm4gYXMgZ2V0UmVxdWVzdEV2ZW50LCBoeWRyYXRlLCBpbm5lckhUTUwsIGluc2VydCwgaXNEZXYsIGlzU2VydmVyLCBtZW1vLCByZW5kZXIsIHJlbmRlclRvU3RyZWFtLCByZW5kZXJUb1N0cmluZywgcmVuZGVyVG9TdHJpbmdBc3luYywgcmVzb2x2ZVNTUk5vZGUsIHJ1bkh5ZHJhdGlvbkV2ZW50cywgc2V0QXR0cmlidXRlLCBzZXRBdHRyaWJ1dGVOUywgc2V0Qm9vbEF0dHJpYnV0ZSwgc2V0UHJvcGVydHksIHNwcmVhZCwgc3NyLCBzc3JBdHRyaWJ1dGUsIHNzckNsYXNzTGlzdCwgc3NyRWxlbWVudCwgc3NySHlkcmF0aW9uS2V5LCBzc3JTcHJlYWQsIHNzclN0eWxlLCBzdHlsZSwgdGVtcGxhdGUsIHVzZSwgdm9pZEZuIGFzIHVzZUFzc2V0cyB9O1xuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiLy8gR2VuZXJhdGVkIHVzaW5nIGBucG0gcnVuIGJ1aWxkYC4gRG8gbm90IGVkaXQuXG5cbnZhciByZWdleCA9IC9eW2Etel0oPzpbXFwuMC05X2EtelxceEI3XFx4QzAtXFx4RDZcXHhEOC1cXHhGNlxceEY4LVxcdTAzN0RcXHUwMzdGLVxcdTFGRkZcXHUyMDBDXFx1MjAwRFxcdTIwM0ZcXHUyMDQwXFx1MjA3MC1cXHUyMThGXFx1MkMwMC1cXHUyRkVGXFx1MzAwMS1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkZEXXxbXFx1RDgwMC1cXHVEQjdGXVtcXHVEQzAwLVxcdURGRkZdKSotKD86W1xceDJEXFwuMC05X2EtelxceEI3XFx4QzAtXFx4RDZcXHhEOC1cXHhGNlxceEY4LVxcdTAzN0RcXHUwMzdGLVxcdTFGRkZcXHUyMDBDXFx1MjAwRFxcdTIwM0ZcXHUyMDQwXFx1MjA3MC1cXHUyMThGXFx1MkMwMC1cXHUyRkVGXFx1MzAwMS1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkZEXXxbXFx1RDgwMC1cXHVEQjdGXVtcXHVEQzAwLVxcdURGRkZdKSokLztcblxudmFyIGlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUgPSBmdW5jdGlvbihzdHJpbmcpIHtcblx0cmV0dXJuIHJlZ2V4LnRlc3Qoc3RyaW5nKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZTtcbiIsInZhciBfX2FzeW5jID0gKF9fdGhpcywgX19hcmd1bWVudHMsIGdlbmVyYXRvcikgPT4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIHZhciBmdWxmaWxsZWQgPSAodmFsdWUpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgfVxuICAgIH07XG4gICAgdmFyIHJlamVjdGVkID0gKHZhbHVlKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBzdGVwKGdlbmVyYXRvci50aHJvdyh2YWx1ZSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZWplY3QoZSk7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgc3RlcCA9ICh4KSA9PiB4LmRvbmUgPyByZXNvbHZlKHgudmFsdWUpIDogUHJvbWlzZS5yZXNvbHZlKHgudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7XG4gICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KF9fdGhpcywgX19hcmd1bWVudHMpKS5uZXh0KCkpO1xuICB9KTtcbn07XG5cbi8vIHNyYy9pbmRleC50c1xuaW1wb3J0IGlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUgZnJvbSBcImlzLXBvdGVudGlhbC1jdXN0b20tZWxlbWVudC1uYW1lXCI7XG5mdW5jdGlvbiBjcmVhdGVJc29sYXRlZEVsZW1lbnQob3B0aW9ucykge1xuICByZXR1cm4gX19hc3luYyh0aGlzLCBudWxsLCBmdW5jdGlvbiogKCkge1xuICAgIGNvbnN0IHsgbmFtZSwgbW9kZSA9IFwiY2xvc2VkXCIsIGNzcywgaXNvbGF0ZUV2ZW50cyA9IGZhbHNlIH0gPSBvcHRpb25zO1xuICAgIGlmICghaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZShuYW1lKSkge1xuICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgIGBcIiR7bmFtZX1cIiBpcyBub3QgYSB2YWxpZCBjdXN0b20gZWxlbWVudCBuYW1lLiBJdCBtdXN0IGJlIHR3byB3b3JkcyBhbmQga2ViYWItY2FzZSwgd2l0aCBhIGZldyBleGNlcHRpb25zLiBTZWUgc3BlYyBmb3IgbW9yZSBkZXRhaWxzOiBodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9jdXN0b20tZWxlbWVudHMuaHRtbCN2YWxpZC1jdXN0b20tZWxlbWVudC1uYW1lYFxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgcGFyZW50RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQobmFtZSk7XG4gICAgY29uc3Qgc2hhZG93ID0gcGFyZW50RWxlbWVudC5hdHRhY2hTaGFkb3coeyBtb2RlIH0pO1xuICAgIGNvbnN0IGlzb2xhdGVkRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJodG1sXCIpO1xuICAgIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYm9keVwiKTtcbiAgICBjb25zdCBoZWFkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImhlYWRcIik7XG4gICAgaWYgKGNzcykge1xuICAgICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XG4gICAgICBpZiAoXCJ1cmxcIiBpbiBjc3MpIHtcbiAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSB5aWVsZCBmZXRjaChjc3MudXJsKS50aGVuKChyZXMpID0+IHJlcy50ZXh0KCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSBjc3MudGV4dENvbnRlbnQ7XG4gICAgICB9XG4gICAgICBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICB9XG4gICAgaXNvbGF0ZWRFbGVtZW50LmFwcGVuZENoaWxkKGhlYWQpO1xuICAgIGlzb2xhdGVkRWxlbWVudC5hcHBlbmRDaGlsZChib2R5KTtcbiAgICBzaGFkb3cuYXBwZW5kQ2hpbGQoaXNvbGF0ZWRFbGVtZW50KTtcbiAgICBpZiAoaXNvbGF0ZUV2ZW50cykge1xuICAgICAgY29uc3QgZXZlbnRUeXBlcyA9IEFycmF5LmlzQXJyYXkoaXNvbGF0ZUV2ZW50cykgPyBpc29sYXRlRXZlbnRzIDogW1wia2V5ZG93blwiLCBcImtleXVwXCIsIFwia2V5cHJlc3NcIl07XG4gICAgICBldmVudFR5cGVzLmZvckVhY2goKGV2ZW50VHlwZSkgPT4ge1xuICAgICAgICBib2R5LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnRUeXBlLCAoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHBhcmVudEVsZW1lbnQsXG4gICAgICBzaGFkb3csXG4gICAgICBpc29sYXRlZEVsZW1lbnQ6IGJvZHlcbiAgICB9O1xuICB9KTtcbn1cbmV4cG9ydCB7XG4gIGNyZWF0ZUlzb2xhdGVkRWxlbWVudFxufTtcbiIsImNvbnN0IG51bGxLZXkgPSBTeW1ib2woJ251bGwnKTsgLy8gYG9iamVjdEhhc2hlc2Aga2V5IGZvciBudWxsXG5cbmxldCBrZXlDb3VudGVyID0gMDtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWFueUtleXNNYXAgZXh0ZW5kcyBNYXAge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fb2JqZWN0SGFzaGVzID0gbmV3IFdlYWtNYXAoKTtcblx0XHR0aGlzLl9zeW1ib2xIYXNoZXMgPSBuZXcgTWFwKCk7IC8vIGh0dHBzOi8vZ2l0aHViLmNvbS90YzM5L2VjbWEyNjIvaXNzdWVzLzExOTRcblx0XHR0aGlzLl9wdWJsaWNLZXlzID0gbmV3IE1hcCgpO1xuXG5cdFx0Y29uc3QgW3BhaXJzXSA9IGFyZ3VtZW50czsgLy8gTWFwIGNvbXBhdFxuXHRcdGlmIChwYWlycyA9PT0gbnVsbCB8fCBwYWlycyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBwYWlyc1tTeW1ib2wuaXRlcmF0b3JdICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHR5cGVvZiBwYWlycyArICcgaXMgbm90IGl0ZXJhYmxlIChjYW5ub3QgcmVhZCBwcm9wZXJ0eSBTeW1ib2woU3ltYm9sLml0ZXJhdG9yKSknKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IFtrZXlzLCB2YWx1ZV0gb2YgcGFpcnMpIHtcblx0XHRcdHRoaXMuc2V0KGtleXMsIHZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRfZ2V0UHVibGljS2V5cyhrZXlzLCBjcmVhdGUgPSBmYWxzZSkge1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShrZXlzKSkge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIGtleXMgcGFyYW1ldGVyIG11c3QgYmUgYW4gYXJyYXknKTtcblx0XHR9XG5cblx0XHRjb25zdCBwcml2YXRlS2V5ID0gdGhpcy5fZ2V0UHJpdmF0ZUtleShrZXlzLCBjcmVhdGUpO1xuXG5cdFx0bGV0IHB1YmxpY0tleTtcblx0XHRpZiAocHJpdmF0ZUtleSAmJiB0aGlzLl9wdWJsaWNLZXlzLmhhcyhwcml2YXRlS2V5KSkge1xuXHRcdFx0cHVibGljS2V5ID0gdGhpcy5fcHVibGljS2V5cy5nZXQocHJpdmF0ZUtleSk7XG5cdFx0fSBlbHNlIGlmIChjcmVhdGUpIHtcblx0XHRcdHB1YmxpY0tleSA9IFsuLi5rZXlzXTsgLy8gUmVnZW5lcmF0ZSBrZXlzIGFycmF5IHRvIGF2b2lkIGV4dGVybmFsIGludGVyYWN0aW9uXG5cdFx0XHR0aGlzLl9wdWJsaWNLZXlzLnNldChwcml2YXRlS2V5LCBwdWJsaWNLZXkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7cHJpdmF0ZUtleSwgcHVibGljS2V5fTtcblx0fVxuXG5cdF9nZXRQcml2YXRlS2V5KGtleXMsIGNyZWF0ZSA9IGZhbHNlKSB7XG5cdFx0Y29uc3QgcHJpdmF0ZUtleXMgPSBbXTtcblx0XHRmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuXHRcdFx0aWYgKGtleSA9PT0gbnVsbCkge1xuXHRcdFx0XHRrZXkgPSBudWxsS2V5O1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBoYXNoZXMgPSB0eXBlb2Yga2V5ID09PSAnb2JqZWN0JyB8fCB0eXBlb2Yga2V5ID09PSAnZnVuY3Rpb24nID8gJ19vYmplY3RIYXNoZXMnIDogKHR5cGVvZiBrZXkgPT09ICdzeW1ib2wnID8gJ19zeW1ib2xIYXNoZXMnIDogZmFsc2UpO1xuXG5cdFx0XHRpZiAoIWhhc2hlcykge1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKGtleSk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXNbaGFzaGVzXS5oYXMoa2V5KSkge1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKHRoaXNbaGFzaGVzXS5nZXQoa2V5KSk7XG5cdFx0XHR9IGVsc2UgaWYgKGNyZWF0ZSkge1xuXHRcdFx0XHRjb25zdCBwcml2YXRlS2V5ID0gYEBAbWttLXJlZi0ke2tleUNvdW50ZXIrK31AQGA7XG5cdFx0XHRcdHRoaXNbaGFzaGVzXS5zZXQoa2V5LCBwcml2YXRlS2V5KTtcblx0XHRcdFx0cHJpdmF0ZUtleXMucHVzaChwcml2YXRlS2V5KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkocHJpdmF0ZUtleXMpO1xuXHR9XG5cblx0c2V0KGtleXMsIHZhbHVlKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMsIHRydWUpO1xuXHRcdHJldHVybiBzdXBlci5zZXQocHVibGljS2V5LCB2YWx1ZSk7XG5cdH1cblxuXHRnZXQoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gc3VwZXIuZ2V0KHB1YmxpY0tleSk7XG5cdH1cblxuXHRoYXMoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gc3VwZXIuaGFzKHB1YmxpY0tleSk7XG5cdH1cblxuXHRkZWxldGUoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXksIHByaXZhdGVLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gQm9vbGVhbihwdWJsaWNLZXkgJiYgc3VwZXIuZGVsZXRlKHB1YmxpY0tleSkgJiYgdGhpcy5fcHVibGljS2V5cy5kZWxldGUocHJpdmF0ZUtleSkpO1xuXHR9XG5cblx0Y2xlYXIoKSB7XG5cdFx0c3VwZXIuY2xlYXIoKTtcblx0XHR0aGlzLl9zeW1ib2xIYXNoZXMuY2xlYXIoKTtcblx0XHR0aGlzLl9wdWJsaWNLZXlzLmNsZWFyKCk7XG5cdH1cblxuXHRnZXQgW1N5bWJvbC50b1N0cmluZ1RhZ10oKSB7XG5cdFx0cmV0dXJuICdNYW55S2V5c01hcCc7XG5cdH1cblxuXHRnZXQgc2l6ZSgpIHtcblx0XHRyZXR1cm4gc3VwZXIuc2l6ZTtcblx0fVxufVxuIiwiZnVuY3Rpb24gaXNQbGFpbk9iamVjdCh2YWx1ZSkge1xuICBpZiAodmFsdWUgPT09IG51bGwgfHwgdHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHByb3RvdHlwZSA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSk7XG4gIGlmIChwcm90b3R5cGUgIT09IG51bGwgJiYgcHJvdG90eXBlICE9PSBPYmplY3QucHJvdG90eXBlICYmIE9iamVjdC5nZXRQcm90b3R5cGVPZihwcm90b3R5cGUpICE9PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChTeW1ib2wuaXRlcmF0b3IgaW4gdmFsdWUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKFN5bWJvbC50b1N0cmluZ1RhZyBpbiB2YWx1ZSkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpID09PSBcIltvYmplY3QgTW9kdWxlXVwiO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBfZGVmdShiYXNlT2JqZWN0LCBkZWZhdWx0cywgbmFtZXNwYWNlID0gXCIuXCIsIG1lcmdlcikge1xuICBpZiAoIWlzUGxhaW5PYmplY3QoZGVmYXVsdHMpKSB7XG4gICAgcmV0dXJuIF9kZWZ1KGJhc2VPYmplY3QsIHt9LCBuYW1lc3BhY2UsIG1lcmdlcik7XG4gIH1cbiAgY29uc3Qgb2JqZWN0ID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdHMpO1xuICBmb3IgKGNvbnN0IGtleSBpbiBiYXNlT2JqZWN0KSB7XG4gICAgaWYgKGtleSA9PT0gXCJfX3Byb3RvX19cIiB8fCBrZXkgPT09IFwiY29uc3RydWN0b3JcIikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gYmFzZU9iamVjdFtrZXldO1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdm9pZCAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKG1lcmdlciAmJiBtZXJnZXIob2JqZWN0LCBrZXksIHZhbHVlLCBuYW1lc3BhY2UpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpICYmIEFycmF5LmlzQXJyYXkob2JqZWN0W2tleV0pKSB7XG4gICAgICBvYmplY3Rba2V5XSA9IFsuLi52YWx1ZSwgLi4ub2JqZWN0W2tleV1dO1xuICAgIH0gZWxzZSBpZiAoaXNQbGFpbk9iamVjdCh2YWx1ZSkgJiYgaXNQbGFpbk9iamVjdChvYmplY3Rba2V5XSkpIHtcbiAgICAgIG9iamVjdFtrZXldID0gX2RlZnUoXG4gICAgICAgIHZhbHVlLFxuICAgICAgICBvYmplY3Rba2V5XSxcbiAgICAgICAgKG5hbWVzcGFjZSA/IGAke25hbWVzcGFjZX0uYCA6IFwiXCIpICsga2V5LnRvU3RyaW5nKCksXG4gICAgICAgIG1lcmdlclxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG9iamVjdDtcbn1cbmZ1bmN0aW9uIGNyZWF0ZURlZnUobWVyZ2VyKSB7XG4gIHJldHVybiAoLi4uYXJndW1lbnRzXykgPT4gKFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSB1bmljb3JuL25vLWFycmF5LXJlZHVjZVxuICAgIGFyZ3VtZW50c18ucmVkdWNlKChwLCBjKSA9PiBfZGVmdShwLCBjLCBcIlwiLCBtZXJnZXIpLCB7fSlcbiAgKTtcbn1cbmNvbnN0IGRlZnUgPSBjcmVhdGVEZWZ1KCk7XG5jb25zdCBkZWZ1Rm4gPSBjcmVhdGVEZWZ1KChvYmplY3QsIGtleSwgY3VycmVudFZhbHVlKSA9PiB7XG4gIGlmIChvYmplY3Rba2V5XSAhPT0gdm9pZCAwICYmIHR5cGVvZiBjdXJyZW50VmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIG9iamVjdFtrZXldID0gY3VycmVudFZhbHVlKG9iamVjdFtrZXldKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufSk7XG5jb25zdCBkZWZ1QXJyYXlGbiA9IGNyZWF0ZURlZnUoKG9iamVjdCwga2V5LCBjdXJyZW50VmFsdWUpID0+IHtcbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0W2tleV0pICYmIHR5cGVvZiBjdXJyZW50VmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIG9iamVjdFtrZXldID0gY3VycmVudFZhbHVlKG9iamVjdFtrZXldKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufSk7XG5cbmV4cG9ydCB7IGNyZWF0ZURlZnUsIGRlZnUgYXMgZGVmYXVsdCwgZGVmdSwgZGVmdUFycmF5Rm4sIGRlZnVGbiB9O1xuIiwiY29uc3QgaXNFeGlzdCA9IChlbGVtZW50KSA9PiB7XG4gIHJldHVybiBlbGVtZW50ICE9PSBudWxsID8geyBpc0RldGVjdGVkOiB0cnVlLCByZXN1bHQ6IGVsZW1lbnQgfSA6IHsgaXNEZXRlY3RlZDogZmFsc2UgfTtcbn07XG5jb25zdCBpc05vdEV4aXN0ID0gKGVsZW1lbnQpID0+IHtcbiAgcmV0dXJuIGVsZW1lbnQgPT09IG51bGwgPyB7IGlzRGV0ZWN0ZWQ6IHRydWUsIHJlc3VsdDogbnVsbCB9IDogeyBpc0RldGVjdGVkOiBmYWxzZSB9O1xufTtcblxuZXhwb3J0IHsgaXNFeGlzdCwgaXNOb3RFeGlzdCB9O1xuIiwiaW1wb3J0IE1hbnlLZXlzTWFwIGZyb20gJ21hbnkta2V5cy1tYXAnO1xuaW1wb3J0IHsgZGVmdSB9IGZyb20gJ2RlZnUnO1xuaW1wb3J0IHsgaXNFeGlzdCB9IGZyb20gJy4vZGV0ZWN0b3JzLm1qcyc7XG5cbmNvbnN0IGdldERlZmF1bHRPcHRpb25zID0gKCkgPT4gKHtcbiAgdGFyZ2V0OiBnbG9iYWxUaGlzLmRvY3VtZW50LFxuICB1bmlmeVByb2Nlc3M6IHRydWUsXG4gIGRldGVjdG9yOiBpc0V4aXN0LFxuICBvYnNlcnZlQ29uZmlnczoge1xuICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICBzdWJ0cmVlOiB0cnVlLFxuICAgIGF0dHJpYnV0ZXM6IHRydWVcbiAgfSxcbiAgc2lnbmFsOiB2b2lkIDAsXG4gIGN1c3RvbU1hdGNoZXI6IHZvaWQgMFxufSk7XG5jb25zdCBtZXJnZU9wdGlvbnMgPSAodXNlclNpZGVPcHRpb25zLCBkZWZhdWx0T3B0aW9ucykgPT4ge1xuICByZXR1cm4gZGVmdSh1c2VyU2lkZU9wdGlvbnMsIGRlZmF1bHRPcHRpb25zKTtcbn07XG5cbmNvbnN0IHVuaWZ5Q2FjaGUgPSBuZXcgTWFueUtleXNNYXAoKTtcbmZ1bmN0aW9uIGNyZWF0ZVdhaXRFbGVtZW50KGluc3RhbmNlT3B0aW9ucykge1xuICBjb25zdCB7IGRlZmF1bHRPcHRpb25zIH0gPSBpbnN0YW5jZU9wdGlvbnM7XG4gIHJldHVybiAoc2VsZWN0b3IsIG9wdGlvbnMpID0+IHtcbiAgICBjb25zdCB7XG4gICAgICB0YXJnZXQsXG4gICAgICB1bmlmeVByb2Nlc3MsXG4gICAgICBvYnNlcnZlQ29uZmlncyxcbiAgICAgIGRldGVjdG9yLFxuICAgICAgc2lnbmFsLFxuICAgICAgY3VzdG9tTWF0Y2hlclxuICAgIH0gPSBtZXJnZU9wdGlvbnMob3B0aW9ucywgZGVmYXVsdE9wdGlvbnMpO1xuICAgIGNvbnN0IHVuaWZ5UHJvbWlzZUtleSA9IFtcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgdGFyZ2V0LFxuICAgICAgdW5pZnlQcm9jZXNzLFxuICAgICAgb2JzZXJ2ZUNvbmZpZ3MsXG4gICAgICBkZXRlY3RvcixcbiAgICAgIHNpZ25hbCxcbiAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICBdO1xuICAgIGNvbnN0IGNhY2hlZFByb21pc2UgPSB1bmlmeUNhY2hlLmdldCh1bmlmeVByb21pc2VLZXkpO1xuICAgIGlmICh1bmlmeVByb2Nlc3MgJiYgY2FjaGVkUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIGNhY2hlZFByb21pc2U7XG4gICAgfVxuICAgIGNvbnN0IGRldGVjdFByb21pc2UgPSBuZXcgUHJvbWlzZShcbiAgICAgIC8vIGJpb21lLWlnbm9yZSBsaW50L3N1c3BpY2lvdXMvbm9Bc3luY1Byb21pc2VFeGVjdXRvcjogYXZvaWQgbmVzdGluZyBwcm9taXNlXG4gICAgICBhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmIChzaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KHNpZ25hbC5yZWFzb24pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoXG4gICAgICAgICAgYXN5bmMgKG11dGF0aW9ucykgPT4ge1xuICAgICAgICAgICAgZm9yIChjb25zdCBfIG9mIG11dGF0aW9ucykge1xuICAgICAgICAgICAgICBpZiAoc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnN0IGRldGVjdFJlc3VsdDIgPSBhd2FpdCBkZXRlY3RFbGVtZW50KHtcbiAgICAgICAgICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgICAgICAgZGV0ZWN0b3IsXG4gICAgICAgICAgICAgICAgY3VzdG9tTWF0Y2hlclxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgaWYgKGRldGVjdFJlc3VsdDIuaXNEZXRlY3RlZCkge1xuICAgICAgICAgICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGRldGVjdFJlc3VsdDIucmVzdWx0KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgICAgc2lnbmFsPy5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgIFwiYWJvcnRcIixcbiAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KHNpZ25hbC5yZWFzb24pO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgeyBvbmNlOiB0cnVlIH1cbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgZGV0ZWN0UmVzdWx0ID0gYXdhaXQgZGV0ZWN0RWxlbWVudCh7XG4gICAgICAgICAgc2VsZWN0b3IsXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgIGRldGVjdG9yLFxuICAgICAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChkZXRlY3RSZXN1bHQuaXNEZXRlY3RlZCkge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKGRldGVjdFJlc3VsdC5yZXN1bHQpO1xuICAgICAgICB9XG4gICAgICAgIG9ic2VydmVyLm9ic2VydmUodGFyZ2V0LCBvYnNlcnZlQ29uZmlncyk7XG4gICAgICB9XG4gICAgKS5maW5hbGx5KCgpID0+IHtcbiAgICAgIHVuaWZ5Q2FjaGUuZGVsZXRlKHVuaWZ5UHJvbWlzZUtleSk7XG4gICAgfSk7XG4gICAgdW5pZnlDYWNoZS5zZXQodW5pZnlQcm9taXNlS2V5LCBkZXRlY3RQcm9taXNlKTtcbiAgICByZXR1cm4gZGV0ZWN0UHJvbWlzZTtcbiAgfTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGRldGVjdEVsZW1lbnQoe1xuICB0YXJnZXQsXG4gIHNlbGVjdG9yLFxuICBkZXRlY3RvcixcbiAgY3VzdG9tTWF0Y2hlclxufSkge1xuICBjb25zdCBlbGVtZW50ID0gY3VzdG9tTWF0Y2hlciA/IGN1c3RvbU1hdGNoZXIoc2VsZWN0b3IpIDogdGFyZ2V0LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuICByZXR1cm4gYXdhaXQgZGV0ZWN0b3IoZWxlbWVudCk7XG59XG5jb25zdCB3YWl0RWxlbWVudCA9IGNyZWF0ZVdhaXRFbGVtZW50KHtcbiAgZGVmYXVsdE9wdGlvbnM6IGdldERlZmF1bHRPcHRpb25zKClcbn0pO1xuXG5leHBvcnQgeyBjcmVhdGVXYWl0RWxlbWVudCwgZ2V0RGVmYXVsdE9wdGlvbnMsIHdhaXRFbGVtZW50IH07XG4iLCJmdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcbiAgaWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXJncy5zaGlmdCgpO1xuICAgIG1ldGhvZChgW3d4dF0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xuICB9XG59XG5leHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuICBsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG4gIHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuICBlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuIiwiaW1wb3J0IHsgd2FpdEVsZW1lbnQgfSBmcm9tIFwiQDFuYXRzdS93YWl0LWVsZW1lbnRcIjtcbmltcG9ydCB7XG4gIGlzRXhpc3QgYXMgbW91bnREZXRlY3RvcixcbiAgaXNOb3RFeGlzdCBhcyByZW1vdmVEZXRlY3RvclxufSBmcm9tIFwiQDFuYXRzdS93YWl0LWVsZW1lbnQvZGV0ZWN0b3JzXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5UG9zaXRpb24ocm9vdCwgcG9zaXRpb25lZEVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgaWYgKG9wdGlvbnMucG9zaXRpb24gPT09IFwiaW5saW5lXCIpIHJldHVybjtcbiAgaWYgKG9wdGlvbnMuekluZGV4ICE9IG51bGwpIHJvb3Quc3R5bGUuekluZGV4ID0gU3RyaW5nKG9wdGlvbnMuekluZGV4KTtcbiAgcm9vdC5zdHlsZS5vdmVyZmxvdyA9IFwidmlzaWJsZVwiO1xuICByb290LnN0eWxlLnBvc2l0aW9uID0gXCJyZWxhdGl2ZVwiO1xuICByb290LnN0eWxlLndpZHRoID0gXCIwXCI7XG4gIHJvb3Quc3R5bGUuaGVpZ2h0ID0gXCIwXCI7XG4gIHJvb3Quc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgaWYgKHBvc2l0aW9uZWRFbGVtZW50KSB7XG4gICAgaWYgKG9wdGlvbnMucG9zaXRpb24gPT09IFwib3ZlcmxheVwiKSB7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiYWJzb2x1dGVcIjtcbiAgICAgIGlmIChvcHRpb25zLmFsaWdubWVudD8uc3RhcnRzV2l0aChcImJvdHRvbS1cIikpXG4gICAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmJvdHRvbSA9IFwiMFwiO1xuICAgICAgZWxzZSBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIjtcbiAgICAgIGlmIChvcHRpb25zLmFsaWdubWVudD8uZW5kc1dpdGgoXCItcmlnaHRcIikpXG4gICAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIwXCI7XG4gICAgICBlbHNlIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmxlZnQgPSBcIjBcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmJvdHRvbSA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUubGVmdCA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIjtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRBbmNob3Iob3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5hbmNob3IgPT0gbnVsbCkgcmV0dXJuIGRvY3VtZW50LmJvZHk7XG4gIGxldCByZXNvbHZlZCA9IHR5cGVvZiBvcHRpb25zLmFuY2hvciA9PT0gXCJmdW5jdGlvblwiID8gb3B0aW9ucy5hbmNob3IoKSA6IG9wdGlvbnMuYW5jaG9yO1xuICBpZiAodHlwZW9mIHJlc29sdmVkID09PSBcInN0cmluZ1wiKSB7XG4gICAgaWYgKHJlc29sdmVkLnN0YXJ0c1dpdGgoXCIvXCIpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBkb2N1bWVudC5ldmFsdWF0ZShcbiAgICAgICAgcmVzb2x2ZWQsXG4gICAgICAgIGRvY3VtZW50LFxuICAgICAgICBudWxsLFxuICAgICAgICBYUGF0aFJlc3VsdC5GSVJTVF9PUkRFUkVEX05PREVfVFlQRSxcbiAgICAgICAgbnVsbFxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXN1bHQuc2luZ2xlTm9kZVZhbHVlID8/IHZvaWQgMDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IocmVzb2x2ZWQpID8/IHZvaWQgMDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc29sdmVkID8/IHZvaWQgMDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtb3VudFVpKHJvb3QsIG9wdGlvbnMpIHtcbiAgY29uc3QgYW5jaG9yID0gZ2V0QW5jaG9yKG9wdGlvbnMpO1xuICBpZiAoYW5jaG9yID09IG51bGwpXG4gICAgdGhyb3cgRXJyb3IoXG4gICAgICBcIkZhaWxlZCB0byBtb3VudCBjb250ZW50IHNjcmlwdCBVSTogY291bGQgbm90IGZpbmQgYW5jaG9yIGVsZW1lbnRcIlxuICAgICk7XG4gIHN3aXRjaCAob3B0aW9ucy5hcHBlbmQpIHtcbiAgICBjYXNlIHZvaWQgMDpcbiAgICBjYXNlIFwibGFzdFwiOlxuICAgICAgYW5jaG9yLmFwcGVuZChyb290KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJmaXJzdFwiOlxuICAgICAgYW5jaG9yLnByZXBlbmQocm9vdCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwicmVwbGFjZVwiOlxuICAgICAgYW5jaG9yLnJlcGxhY2VXaXRoKHJvb3QpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImFmdGVyXCI6XG4gICAgICBhbmNob3IucGFyZW50RWxlbWVudD8uaW5zZXJ0QmVmb3JlKHJvb3QsIGFuY2hvci5uZXh0RWxlbWVudFNpYmxpbmcpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImJlZm9yZVwiOlxuICAgICAgYW5jaG9yLnBhcmVudEVsZW1lbnQ/Lmluc2VydEJlZm9yZShyb290LCBhbmNob3IpO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIG9wdGlvbnMuYXBwZW5kKGFuY2hvciwgcm9vdCk7XG4gICAgICBicmVhaztcbiAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1vdW50RnVuY3Rpb25zKGJhc2VGdW5jdGlvbnMsIG9wdGlvbnMpIHtcbiAgbGV0IGF1dG9Nb3VudEluc3RhbmNlID0gdm9pZCAwO1xuICBjb25zdCBzdG9wQXV0b01vdW50ID0gKCkgPT4ge1xuICAgIGF1dG9Nb3VudEluc3RhbmNlPy5zdG9wQXV0b01vdW50KCk7XG4gICAgYXV0b01vdW50SW5zdGFuY2UgPSB2b2lkIDA7XG4gIH07XG4gIGNvbnN0IG1vdW50ID0gKCkgPT4ge1xuICAgIGJhc2VGdW5jdGlvbnMubW91bnQoKTtcbiAgfTtcbiAgY29uc3QgdW5tb3VudCA9IGJhc2VGdW5jdGlvbnMucmVtb3ZlO1xuICBjb25zdCByZW1vdmUgPSAoKSA9PiB7XG4gICAgc3RvcEF1dG9Nb3VudCgpO1xuICAgIGJhc2VGdW5jdGlvbnMucmVtb3ZlKCk7XG4gIH07XG4gIGNvbnN0IGF1dG9Nb3VudCA9IChhdXRvTW91bnRPcHRpb25zKSA9PiB7XG4gICAgaWYgKGF1dG9Nb3VudEluc3RhbmNlKSB7XG4gICAgICBsb2dnZXIud2FybihcImF1dG9Nb3VudCBpcyBhbHJlYWR5IHNldC5cIik7XG4gICAgfVxuICAgIGF1dG9Nb3VudEluc3RhbmNlID0gYXV0b01vdW50VWkoXG4gICAgICB7IG1vdW50LCB1bm1vdW50LCBzdG9wQXV0b01vdW50IH0sXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIC4uLmF1dG9Nb3VudE9wdGlvbnNcbiAgICAgIH1cbiAgICApO1xuICB9O1xuICByZXR1cm4ge1xuICAgIG1vdW50LFxuICAgIHJlbW92ZSxcbiAgICBhdXRvTW91bnRcbiAgfTtcbn1cbmZ1bmN0aW9uIGF1dG9Nb3VudFVpKHVpQ2FsbGJhY2tzLCBvcHRpb25zKSB7XG4gIGNvbnN0IGFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgY29uc3QgRVhQTElDSVRfU1RPUF9SRUFTT04gPSBcImV4cGxpY2l0X3N0b3BfYXV0b19tb3VudFwiO1xuICBjb25zdCBfc3RvcEF1dG9Nb3VudCA9ICgpID0+IHtcbiAgICBhYm9ydENvbnRyb2xsZXIuYWJvcnQoRVhQTElDSVRfU1RPUF9SRUFTT04pO1xuICAgIG9wdGlvbnMub25TdG9wPy4oKTtcbiAgfTtcbiAgbGV0IHJlc29sdmVkQW5jaG9yID0gdHlwZW9mIG9wdGlvbnMuYW5jaG9yID09PSBcImZ1bmN0aW9uXCIgPyBvcHRpb25zLmFuY2hvcigpIDogb3B0aW9ucy5hbmNob3I7XG4gIGlmIChyZXNvbHZlZEFuY2hvciBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICB0aHJvdyBFcnJvcihcbiAgICAgIFwiYXV0b01vdW50IGFuZCBFbGVtZW50IGFuY2hvciBvcHRpb24gY2Fubm90IGJlIGNvbWJpbmVkLiBBdm9pZCBwYXNzaW5nIGBFbGVtZW50YCBkaXJlY3RseSBvciBgKCkgPT4gRWxlbWVudGAgdG8gdGhlIGFuY2hvci5cIlxuICAgICk7XG4gIH1cbiAgYXN5bmMgZnVuY3Rpb24gb2JzZXJ2ZUVsZW1lbnQoc2VsZWN0b3IpIHtcbiAgICBsZXQgaXNBbmNob3JFeGlzdCA9ICEhZ2V0QW5jaG9yKG9wdGlvbnMpO1xuICAgIGlmIChpc0FuY2hvckV4aXN0KSB7XG4gICAgICB1aUNhbGxiYWNrcy5tb3VudCgpO1xuICAgIH1cbiAgICB3aGlsZSAoIWFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY2hhbmdlZEFuY2hvciA9IGF3YWl0IHdhaXRFbGVtZW50KHNlbGVjdG9yID8/IFwiYm9keVwiLCB7XG4gICAgICAgICAgY3VzdG9tTWF0Y2hlcjogKCkgPT4gZ2V0QW5jaG9yKG9wdGlvbnMpID8/IG51bGwsXG4gICAgICAgICAgZGV0ZWN0b3I6IGlzQW5jaG9yRXhpc3QgPyByZW1vdmVEZXRlY3RvciA6IG1vdW50RGV0ZWN0b3IsXG4gICAgICAgICAgc2lnbmFsOiBhYm9ydENvbnRyb2xsZXIuc2lnbmFsXG4gICAgICAgIH0pO1xuICAgICAgICBpc0FuY2hvckV4aXN0ID0gISFjaGFuZ2VkQW5jaG9yO1xuICAgICAgICBpZiAoaXNBbmNob3JFeGlzdCkge1xuICAgICAgICAgIHVpQ2FsbGJhY2tzLm1vdW50KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdWlDYWxsYmFja3MudW5tb3VudCgpO1xuICAgICAgICAgIGlmIChvcHRpb25zLm9uY2UpIHtcbiAgICAgICAgICAgIHVpQ2FsbGJhY2tzLnN0b3BBdXRvTW91bnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGlmIChhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQgJiYgYWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZWFzb24gPT09IEVYUExJQ0lUX1NUT1BfUkVBU09OKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgb2JzZXJ2ZUVsZW1lbnQocmVzb2x2ZWRBbmNob3IpO1xuICByZXR1cm4geyBzdG9wQXV0b01vdW50OiBfc3RvcEF1dG9Nb3VudCB9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIHNwbGl0U2hhZG93Um9vdENzcyhjc3MpIHtcbiAgbGV0IHNoYWRvd0NzcyA9IGNzcztcbiAgbGV0IGRvY3VtZW50Q3NzID0gXCJcIjtcbiAgY29uc3QgcnVsZXNSZWdleCA9IC8oXFxzKkAocHJvcGVydHl8Zm9udC1mYWNlKVtcXHNcXFNdKj97W1xcc1xcU10qP30pL2dtO1xuICBsZXQgbWF0Y2g7XG4gIHdoaWxlICgobWF0Y2ggPSBydWxlc1JlZ2V4LmV4ZWMoY3NzKSkgIT09IG51bGwpIHtcbiAgICBkb2N1bWVudENzcyArPSBtYXRjaFsxXTtcbiAgICBzaGFkb3dDc3MgPSBzaGFkb3dDc3MucmVwbGFjZShtYXRjaFsxXSwgXCJcIik7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBkb2N1bWVudENzczogZG9jdW1lbnRDc3MudHJpbSgpLFxuICAgIHNoYWRvd0Nzczogc2hhZG93Q3NzLnRyaW0oKVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgY3JlYXRlSXNvbGF0ZWRFbGVtZW50IH0gZnJvbSBcIkB3ZWJleHQtY29yZS9pc29sYXRlZC1lbGVtZW50XCI7XG5pbXBvcnQgeyBhcHBseVBvc2l0aW9uLCBjcmVhdGVNb3VudEZ1bmN0aW9ucywgbW91bnRVaSB9IGZyb20gXCIuL3NoYXJlZC5tanNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQgeyBzcGxpdFNoYWRvd1Jvb3RDc3MgfSBmcm9tIFwiLi4vc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qc1wiO1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVNoYWRvd1Jvb3RVaShjdHgsIG9wdGlvbnMpIHtcbiAgY29uc3QgaW5zdGFuY2VJZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZygyLCAxNSk7XG4gIGNvbnN0IGNzcyA9IFtdO1xuICBpZiAoIW9wdGlvbnMuaW5oZXJpdFN0eWxlcykge1xuICAgIGNzcy5wdXNoKGAvKiBXWFQgU2hhZG93IFJvb3QgUmVzZXQgKi8gOmhvc3R7YWxsOmluaXRpYWwgIWltcG9ydGFudDt9YCk7XG4gIH1cbiAgaWYgKG9wdGlvbnMuY3NzKSB7XG4gICAgY3NzLnB1c2gob3B0aW9ucy5jc3MpO1xuICB9XG4gIGlmIChjdHgub3B0aW9ucz8uY3NzSW5qZWN0aW9uTW9kZSA9PT0gXCJ1aVwiKSB7XG4gICAgY29uc3QgZW50cnlDc3MgPSBhd2FpdCBsb2FkQ3NzKCk7XG4gICAgY3NzLnB1c2goZW50cnlDc3MucmVwbGFjZUFsbChcIjpyb290XCIsIFwiOmhvc3RcIikpO1xuICB9XG4gIGNvbnN0IHsgc2hhZG93Q3NzLCBkb2N1bWVudENzcyB9ID0gc3BsaXRTaGFkb3dSb290Q3NzKGNzcy5qb2luKFwiXFxuXCIpLnRyaW0oKSk7XG4gIGNvbnN0IHtcbiAgICBpc29sYXRlZEVsZW1lbnQ6IHVpQ29udGFpbmVyLFxuICAgIHBhcmVudEVsZW1lbnQ6IHNoYWRvd0hvc3QsXG4gICAgc2hhZG93XG4gIH0gPSBhd2FpdCBjcmVhdGVJc29sYXRlZEVsZW1lbnQoe1xuICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICBjc3M6IHtcbiAgICAgIHRleHRDb250ZW50OiBzaGFkb3dDc3NcbiAgICB9LFxuICAgIG1vZGU6IG9wdGlvbnMubW9kZSA/PyBcIm9wZW5cIixcbiAgICBpc29sYXRlRXZlbnRzOiBvcHRpb25zLmlzb2xhdGVFdmVudHNcbiAgfSk7XG4gIHNoYWRvd0hvc3Quc2V0QXR0cmlidXRlKFwiZGF0YS13eHQtc2hhZG93LXJvb3RcIiwgXCJcIik7XG4gIGxldCBtb3VudGVkO1xuICBjb25zdCBtb3VudCA9ICgpID0+IHtcbiAgICBtb3VudFVpKHNoYWRvd0hvc3QsIG9wdGlvbnMpO1xuICAgIGFwcGx5UG9zaXRpb24oc2hhZG93SG9zdCwgc2hhZG93LnF1ZXJ5U2VsZWN0b3IoXCJodG1sXCIpLCBvcHRpb25zKTtcbiAgICBpZiAoZG9jdW1lbnRDc3MgJiYgIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXG4gICAgICBgc3R5bGVbd3h0LXNoYWRvdy1yb290LWRvY3VtZW50LXN0eWxlcz1cIiR7aW5zdGFuY2VJZH1cIl1gXG4gICAgKSkge1xuICAgICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XG4gICAgICBzdHlsZS50ZXh0Q29udGVudCA9IGRvY3VtZW50Q3NzO1xuICAgICAgc3R5bGUuc2V0QXR0cmlidXRlKFwid3h0LXNoYWRvdy1yb290LWRvY3VtZW50LXN0eWxlc1wiLCBpbnN0YW5jZUlkKTtcbiAgICAgIChkb2N1bWVudC5oZWFkID8/IGRvY3VtZW50LmJvZHkpLmFwcGVuZChzdHlsZSk7XG4gICAgfVxuICAgIG1vdW50ZWQgPSBvcHRpb25zLm9uTW91bnQodWlDb250YWluZXIsIHNoYWRvdywgc2hhZG93SG9zdCk7XG4gIH07XG4gIGNvbnN0IHJlbW92ZSA9ICgpID0+IHtcbiAgICBvcHRpb25zLm9uUmVtb3ZlPy4obW91bnRlZCk7XG4gICAgc2hhZG93SG9zdC5yZW1vdmUoKTtcbiAgICBjb25zdCBkb2N1bWVudFN0eWxlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgIGBzdHlsZVt3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzPVwiJHtpbnN0YW5jZUlkfVwiXWBcbiAgICApO1xuICAgIGRvY3VtZW50U3R5bGU/LnJlbW92ZSgpO1xuICAgIHdoaWxlICh1aUNvbnRhaW5lci5sYXN0Q2hpbGQpXG4gICAgICB1aUNvbnRhaW5lci5yZW1vdmVDaGlsZCh1aUNvbnRhaW5lci5sYXN0Q2hpbGQpO1xuICAgIG1vdW50ZWQgPSB2b2lkIDA7XG4gIH07XG4gIGNvbnN0IG1vdW50RnVuY3Rpb25zID0gY3JlYXRlTW91bnRGdW5jdGlvbnMoXG4gICAge1xuICAgICAgbW91bnQsXG4gICAgICByZW1vdmVcbiAgICB9LFxuICAgIG9wdGlvbnNcbiAgKTtcbiAgY3R4Lm9uSW52YWxpZGF0ZWQocmVtb3ZlKTtcbiAgcmV0dXJuIHtcbiAgICBzaGFkb3csXG4gICAgc2hhZG93SG9zdCxcbiAgICB1aUNvbnRhaW5lcixcbiAgICAuLi5tb3VudEZ1bmN0aW9ucyxcbiAgICBnZXQgbW91bnRlZCgpIHtcbiAgICAgIHJldHVybiBtb3VudGVkO1xuICAgIH1cbiAgfTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGxvYWRDc3MoKSB7XG4gIGNvbnN0IHVybCA9IGJyb3dzZXIucnVudGltZS5nZXRVUkwoYC9jb250ZW50LXNjcmlwdHMvJHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH0uY3NzYCk7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsKTtcbiAgICByZXR1cm4gYXdhaXQgcmVzLnRleHQoKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgbG9nZ2VyLndhcm4oXG4gICAgICBgRmFpbGVkIHRvIGxvYWQgc3R5bGVzIEAgJHt1cmx9LiBEaWQgeW91IGZvcmdldCB0byBpbXBvcnQgdGhlIHN0eWxlc2hlZXQgaW4geW91ciBlbnRyeXBvaW50P2AsXG4gICAgICBlcnJcbiAgICApO1xuICAgIHJldHVybiBcIlwiO1xuICB9XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiZnVuY3Rpb24gcihlKXt2YXIgdCxmLG49XCJcIjtpZihcInN0cmluZ1wiPT10eXBlb2YgZXx8XCJudW1iZXJcIj09dHlwZW9mIGUpbis9ZTtlbHNlIGlmKFwib2JqZWN0XCI9PXR5cGVvZiBlKWlmKEFycmF5LmlzQXJyYXkoZSkpe3ZhciBvPWUubGVuZ3RoO2Zvcih0PTA7dDxvO3QrKyllW3RdJiYoZj1yKGVbdF0pKSYmKG4mJihuKz1cIiBcIiksbis9Zil9ZWxzZSBmb3IoZiBpbiBlKWVbZl0mJihuJiYobis9XCIgXCIpLG4rPWYpO3JldHVybiBufWV4cG9ydCBmdW5jdGlvbiBjbHN4KCl7Zm9yKHZhciBlLHQsZj0wLG49XCJcIixvPWFyZ3VtZW50cy5sZW5ndGg7ZjxvO2YrKykoZT1hcmd1bWVudHNbZl0pJiYodD1yKGUpKSYmKG4mJihuKz1cIiBcIiksbis9dCk7cmV0dXJuIG59ZXhwb3J0IGRlZmF1bHQgY2xzeDsiLCJpbXBvcnQgeyBjbHN4LCB0eXBlIENsYXNzVmFsdWUgfSBmcm9tICdjbHN4J1xuXG5leHBvcnQgZnVuY3Rpb24gY24oLi4uaW5wdXRzOiBDbGFzc1ZhbHVlW10pIHtcbiAgcmV0dXJuIGNsc3goaW5wdXRzKVxufSIsImltcG9ydCB7IFNob3csIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50LCBKU1ggfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBIZWFkZXJQcm9wcyB7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBsb2dvPzogSlNYLkVsZW1lbnQ7XG4gIGFjdGlvbnM/OiBKU1guRWxlbWVudDtcbiAgdmFyaWFudD86ICdkZWZhdWx0JyB8ICdtaW5pbWFsJyB8ICd0cmFuc3BhcmVudCc7XG4gIHN0aWNreT86IGJvb2xlYW47XG4gIHNob3dNZW51QnV0dG9uPzogYm9vbGVhbjtcbiAgb25NZW51Q2xpY2s/OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEhlYWRlcjogQ29tcG9uZW50PEhlYWRlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbaXNTY3JvbGxlZCwgc2V0SXNTY3JvbGxlZF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuXG4gIC8vIFRyYWNrIHNjcm9sbCBwb3NpdGlvbiBmb3Igc3RpY2t5IGhlYWRlciBlZmZlY3RzXG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiBwcm9wcy5zdGlja3kpIHtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgKCkgPT4ge1xuICAgICAgc2V0SXNTY3JvbGxlZCh3aW5kb3cuc2Nyb2xsWSA+IDEwKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHZhcmlhbnQgPSAoKSA9PiBwcm9wcy52YXJpYW50IHx8ICdkZWZhdWx0JztcblxuICByZXR1cm4gKFxuICAgIDxoZWFkZXJcbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ3ctZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0yMDAnLFxuICAgICAgICB7XG4gICAgICAgICAgLy8gVmFyaWFudHNcbiAgICAgICAgICAnYmctc3VyZmFjZSBib3JkZXItYiBib3JkZXItc3VidGxlJzogdmFyaWFudCgpID09PSAnZGVmYXVsdCcsXG4gICAgICAgICAgJ2JnLXRyYW5zcGFyZW50JzogdmFyaWFudCgpID09PSAnbWluaW1hbCcgfHwgdmFyaWFudCgpID09PSAndHJhbnNwYXJlbnQnLFxuICAgICAgICAgICdiYWNrZHJvcC1ibHVyLW1kIGJnLXN1cmZhY2UvODAnOiB2YXJpYW50KCkgPT09ICd0cmFuc3BhcmVudCcgJiYgaXNTY3JvbGxlZCgpLFxuICAgICAgICAgIC8vIFN0aWNreSBiZWhhdmlvclxuICAgICAgICAgICdzdGlja3kgdG9wLTAgei01MCc6IHByb3BzLnN0aWNreSxcbiAgICAgICAgICAnc2hhZG93LWxnJzogcHJvcHMuc3RpY2t5ICYmIGlzU2Nyb2xsZWQoKSxcbiAgICAgICAgfSxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgPGRpdiBjbGFzcz1cIm1heC13LXNjcmVlbi14bCBteC1hdXRvIHB4LTQgc206cHgtNiBsZzpweC04XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gaC0xNlwiPlxuICAgICAgICAgIHsvKiBMZWZ0IHNlY3Rpb24gKi99XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC00XCI+XG4gICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zaG93TWVudUJ1dHRvbn0+XG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbk1lbnVDbGlja31cbiAgICAgICAgICAgICAgICBjbGFzcz1cInAtMiByb3VuZGVkLWxnIGhvdmVyOmJnLWhpZ2hsaWdodCB0cmFuc2l0aW9uLWNvbG9ycyBsZzpoaWRkZW5cIlxuICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCJNZW51XCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxzdmcgY2xhc3M9XCJ3LTYgaC02XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCI+XG4gICAgICAgICAgICAgICAgICA8cGF0aCBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBzdHJva2Utd2lkdGg9XCIyXCIgZD1cIk00IDZoMTZNNCAxMmgxNk00IDE4aDE2XCIgLz5cbiAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmxvZ299IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMudGl0bGV9PlxuICAgICAgICAgICAgICAgIDxoMSBjbGFzcz1cInRleHQteGwgZm9udC1ib2xkIHRleHQtcHJpbWFyeVwiPntwcm9wcy50aXRsZX08L2gxPlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICB9PlxuICAgICAgICAgICAgICB7cHJvcHMubG9nb31cbiAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgIHsvKiBSaWdodCBzZWN0aW9uICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmFjdGlvbnN9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgIHtwcm9wcy5hY3Rpb25zfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvaGVhZGVyPlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNjb3JlUGFuZWxQcm9wcyB7XG4gIHNjb3JlOiBudW1iZXIgfCBudWxsO1xuICByYW5rOiBudW1iZXIgfCBudWxsO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFNjb3JlUGFuZWw6IENvbXBvbmVudDxTY29yZVBhbmVsUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2dyaWQgZ3JpZC1jb2xzLVsxZnJfMWZyXSBnYXAtMiBwLTQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgey8qIFNjb3JlIEJveCAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJiZy1zdXJmYWNlIHJvdW5kZWQtbGcgcC00IGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIG1pbi1oLVs4MHB4XVwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0yeGwgZm9udC1tb25vIGZvbnQtYm9sZCB0ZXh0LXB1cnBsZS01MDBcIj5cbiAgICAgICAgICB7cHJvcHMuc2NvcmUgIT09IG51bGwgPyBwcm9wcy5zY29yZSA6ICfigJQnfVxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtc20gdGV4dC1zZWNvbmRhcnkgbXQtMVwiPlxuICAgICAgICAgIFNjb3JlXG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICBcbiAgICAgIHsvKiBSYW5rIEJveCAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJiZy1zdXJmYWNlIHJvdW5kZWQtbGcgcC00IGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIG1pbi1oLVs4MHB4XVwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0yeGwgZm9udC1tb25vIGZvbnQtYm9sZCB0ZXh0LXBpbmstNTAwXCI+XG4gICAgICAgICAge3Byb3BzLnJhbmsgIT09IG51bGwgPyBwcm9wcy5yYW5rIDogJ+KAlCd9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+XG4gICAgICAgICAgUmFua1xuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93LCBzcGxpdFByb3BzIH0gZnJvbSAnc29saWQtanMnXG5pbXBvcnQgdHlwZSB7IEpTWCB9IGZyb20gJ3NvbGlkLWpzJ1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbidcblxuZXhwb3J0IGludGVyZmFjZSBCdXR0b25Qcm9wcyBleHRlbmRzIEpTWC5CdXR0b25IVE1MQXR0cmlidXRlczxIVE1MQnV0dG9uRWxlbWVudD4ge1xuICB2YXJpYW50PzogJ3ByaW1hcnknIHwgJ3NlY29uZGFyeScgfCAnZ2hvc3QnIHwgJ2RhbmdlcidcbiAgc2l6ZT86ICdzbScgfCAnbWQnIHwgJ2xnJ1xuICBmdWxsV2lkdGg/OiBib29sZWFuXG4gIGxvYWRpbmc/OiBib29sZWFuXG4gIGxlZnRJY29uPzogSlNYLkVsZW1lbnRcbiAgcmlnaHRJY29uPzogSlNYLkVsZW1lbnRcbn1cblxuZXhwb3J0IGNvbnN0IEJ1dHRvbiA9IChwcm9wczogQnV0dG9uUHJvcHMpID0+IHtcbiAgY29uc3QgW2xvY2FsLCBvdGhlcnNdID0gc3BsaXRQcm9wcyhwcm9wcywgW1xuICAgICd2YXJpYW50JyxcbiAgICAnc2l6ZScsXG4gICAgJ2Z1bGxXaWR0aCcsXG4gICAgJ2xvYWRpbmcnLFxuICAgICdsZWZ0SWNvbicsXG4gICAgJ3JpZ2h0SWNvbicsXG4gICAgJ2NoaWxkcmVuJyxcbiAgICAnY2xhc3MnLFxuICAgICdkaXNhYmxlZCcsXG4gIF0pXG5cbiAgY29uc3QgdmFyaWFudCA9ICgpID0+IGxvY2FsLnZhcmlhbnQgfHwgJ3ByaW1hcnknXG4gIGNvbnN0IHNpemUgPSAoKSA9PiBsb2NhbC5zaXplIHx8ICdtZCdcblxuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIGRpc2FibGVkPXtsb2NhbC5kaXNhYmxlZCB8fCBsb2NhbC5sb2FkaW5nfVxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAnaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGZvbnQtbWVkaXVtIHRyYW5zaXRpb24tYWxsIGN1cnNvci1wb2ludGVyIG91dGxpbmUtbm9uZSBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS01MCcsXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBWYXJpYW50c1xuICAgICAgICAgICdiZy1ncmFkaWVudC1wcmltYXJ5IHRleHQtd2hpdGUgaG92ZXI6c2hhZG93LWxnIGhvdmVyOmJyaWdodG5lc3MtMTEwIGdsb3ctcHJpbWFyeSc6XG4gICAgICAgICAgICB2YXJpYW50KCkgPT09ICdwcmltYXJ5JyxcbiAgICAgICAgICAnYmctc3VyZmFjZSB0ZXh0LXByaW1hcnkgYm9yZGVyIGJvcmRlci1kZWZhdWx0IGhvdmVyOmJnLWVsZXZhdGVkIGhvdmVyOmJvcmRlci1zdHJvbmcnOlxuICAgICAgICAgICAgdmFyaWFudCgpID09PSAnc2Vjb25kYXJ5JyxcbiAgICAgICAgICAndGV4dC1zZWNvbmRhcnkgaG92ZXI6dGV4dC1wcmltYXJ5IGhvdmVyOmJnLXN1cmZhY2UnOlxuICAgICAgICAgICAgdmFyaWFudCgpID09PSAnZ2hvc3QnLFxuICAgICAgICAgICdiZy1yZWQtNjAwIHRleHQtd2hpdGUgaG92ZXI6YmctcmVkLTcwMCBob3ZlcjpzaGFkb3ctbGcnOlxuICAgICAgICAgICAgdmFyaWFudCgpID09PSAnZGFuZ2VyJyxcbiAgICAgICAgICAvLyBTaXplc1xuICAgICAgICAgICdoLTggcHgtMyB0ZXh0LXNtIHJvdW5kZWQtbWQgZ2FwLTEuNSc6IHNpemUoKSA9PT0gJ3NtJyxcbiAgICAgICAgICAnaC0xMCBweC00IHRleHQtYmFzZSByb3VuZGVkLWxnIGdhcC0yJzogc2l6ZSgpID09PSAnbWQnLFxuICAgICAgICAgICdoLTEyIHB4LTYgdGV4dC1sZyByb3VuZGVkLWxnIGdhcC0yLjUnOiBzaXplKCkgPT09ICdsZycsXG4gICAgICAgICAgLy8gRnVsbCB3aWR0aFxuICAgICAgICAgICd3LWZ1bGwnOiBsb2NhbC5mdWxsV2lkdGgsXG4gICAgICAgICAgLy8gTG9hZGluZyBzdGF0ZVxuICAgICAgICAgICdjdXJzb3Itd2FpdCc6IGxvY2FsLmxvYWRpbmcsXG4gICAgICAgIH0sXG4gICAgICAgIGxvY2FsLmNsYXNzXG4gICAgICApfVxuICAgICAgey4uLm90aGVyc31cbiAgICA+XG4gICAgICA8U2hvdyB3aGVuPXtsb2NhbC5sb2FkaW5nfT5cbiAgICAgICAgPHN2Z1xuICAgICAgICAgIGNsYXNzPVwiYW5pbWF0ZS1zcGluIGgtNCB3LTRcIlxuICAgICAgICAgIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIlxuICAgICAgICAgIGZpbGw9XCJub25lXCJcbiAgICAgICAgICB2aWV3Qm94PVwiMCAwIDI0IDI0XCJcbiAgICAgICAgPlxuICAgICAgICAgIDxjaXJjbGVcbiAgICAgICAgICAgIGNsYXNzPVwib3BhY2l0eS0yNVwiXG4gICAgICAgICAgICBjeD1cIjEyXCJcbiAgICAgICAgICAgIGN5PVwiMTJcIlxuICAgICAgICAgICAgcj1cIjEwXCJcbiAgICAgICAgICAgIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiXG4gICAgICAgICAgICBzdHJva2Utd2lkdGg9XCI0XCJcbiAgICAgICAgICAvPlxuICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICBjbGFzcz1cIm9wYWNpdHktNzVcIlxuICAgICAgICAgICAgZmlsbD1cImN1cnJlbnRDb2xvclwiXG4gICAgICAgICAgICBkPVwiTTQgMTJhOCA4IDAgMDE4LThWMEM1LjM3MyAwIDAgNS4zNzMgMCAxMmg0em0yIDUuMjkxQTcuOTYyIDcuOTYyIDAgMDE0IDEySDBjMCAzLjA0MiAxLjEzNSA1LjgyNCAzIDcuOTM4bDMtMi42NDd6XCJcbiAgICAgICAgICAvPlxuICAgICAgICA8L3N2Zz5cbiAgICAgIDwvU2hvdz5cblxuICAgICAgPFNob3cgd2hlbj17bG9jYWwubGVmdEljb24gJiYgIWxvY2FsLmxvYWRpbmd9PlxuICAgICAgICB7bG9jYWwubGVmdEljb259XG4gICAgICA8L1Nob3c+XG5cbiAgICAgIDxTaG93IHdoZW49e2xvY2FsLmNoaWxkcmVufT5cbiAgICAgICAgPHNwYW4+e2xvY2FsLmNoaWxkcmVufTwvc3Bhbj5cbiAgICAgIDwvU2hvdz5cblxuICAgICAgPFNob3cgd2hlbj17bG9jYWwucmlnaHRJY29ufT5cbiAgICAgICAge2xvY2FsLnJpZ2h0SWNvbn1cbiAgICAgIDwvU2hvdz5cbiAgICA8L2J1dHRvbj5cbiAgKVxufSIsImltcG9ydCB7IFNob3csIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vQnV0dG9uJztcblxuZXhwb3J0IHR5cGUgT25ib2FyZGluZ1N0ZXAgPSAnY29ubmVjdC13YWxsZXQnIHwgJ2dlbmVyYXRpbmctdG9rZW4nIHwgJ2NvbXBsZXRlJztcblxuZXhwb3J0IGludGVyZmFjZSBPbmJvYXJkaW5nRmxvd1Byb3BzIHtcbiAgc3RlcDogT25ib2FyZGluZ1N0ZXA7XG4gIGVycm9yPzogc3RyaW5nIHwgbnVsbDtcbiAgd2FsbGV0QWRkcmVzcz86IHN0cmluZyB8IG51bGw7XG4gIHRva2VuPzogc3RyaW5nIHwgbnVsbDtcbiAgb25Db25uZWN0V2FsbGV0OiAoKSA9PiB2b2lkO1xuICBvblVzZVRlc3RNb2RlOiAoKSA9PiB2b2lkO1xuICBvblVzZVByaXZhdGVLZXk6IChwcml2YXRlS2V5OiBzdHJpbmcpID0+IHZvaWQ7XG4gIG9uQ29tcGxldGU6ICgpID0+IHZvaWQ7XG4gIGlzQ29ubmVjdGluZz86IGJvb2xlYW47XG4gIGlzR2VuZXJhdGluZz86IGJvb2xlYW47XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgT25ib2FyZGluZ0Zsb3c6IENvbXBvbmVudDxPbmJvYXJkaW5nRmxvd1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbc2hvd1Rlc3RPcHRpb24sIHNldFNob3dUZXN0T3B0aW9uXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtzaG93UHJpdmF0ZUtleUlucHV0LCBzZXRTaG93UHJpdmF0ZUtleUlucHV0XSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtwcml2YXRlS2V5LCBzZXRQcml2YXRlS2V5XSA9IGNyZWF0ZVNpZ25hbCgnJyk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICdtaW4taC1zY3JlZW4gYmctZ3JhZGllbnQtdG8tYnIgZnJvbS1ncmF5LTkwMCB0by1ibGFjayBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlcicsXG4gICAgICBwcm9wcy5jbGFzc1xuICAgICl9PlxuICAgICAgPGRpdiBjbGFzcz1cIm1heC13LTJ4bCB3LWZ1bGwgcC0xMlwiPlxuICAgICAgICB7LyogTG9nby9IZWFkZXIgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBtYi0xMlwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTh4bCBtYi02XCI+8J+OpDwvZGl2PlxuICAgICAgICAgIDxoMSBjbGFzcz1cInRleHQtNnhsIGZvbnQtYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj5cbiAgICAgICAgICAgIFNjYXJsZXR0IEthcmFva2VcbiAgICAgICAgICA8L2gxPlxuICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC14bCB0ZXh0LWdyYXktNDAwXCI+XG4gICAgICAgICAgICBBSS1wb3dlcmVkIGthcmFva2UgZm9yIFNvdW5kQ2xvdWRcbiAgICAgICAgICA8L3A+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHsvKiBQcm9ncmVzcyBEb3RzICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBqdXN0aWZ5LWNlbnRlciBtYi0xMlwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGdhcC0zXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3ctMyBoLTMgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgICAgICAgIHByb3BzLnN0ZXAgPT09ICdjb25uZWN0LXdhbGxldCcgXG4gICAgICAgICAgICAgICAgPyAnYmctcHVycGxlLTUwMCB3LTEyJyBcbiAgICAgICAgICAgICAgICA6IHByb3BzLndhbGxldEFkZHJlc3MgXG4gICAgICAgICAgICAgICAgICA/ICdiZy1ncmVlbi01MDAnIFxuICAgICAgICAgICAgICAgICAgOiAnYmctZ3JheS02MDAnXG4gICAgICAgICAgICApfSAvPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICd3LTMgaC0zIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICAgICAgICBwcm9wcy5zdGVwID09PSAnZ2VuZXJhdGluZy10b2tlbicgXG4gICAgICAgICAgICAgICAgPyAnYmctcHVycGxlLTUwMCB3LTEyJyBcbiAgICAgICAgICAgICAgICA6IHByb3BzLnRva2VuIFxuICAgICAgICAgICAgICAgICAgPyAnYmctZ3JlZW4tNTAwJyBcbiAgICAgICAgICAgICAgICAgIDogJ2JnLWdyYXktNjAwJ1xuICAgICAgICAgICAgKX0gLz5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAndy0zIGgtMyByb3VuZGVkLWZ1bGwgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgICAgICAgcHJvcHMuc3RlcCA9PT0gJ2NvbXBsZXRlJyBcbiAgICAgICAgICAgICAgICA/ICdiZy1ncmVlbi01MDAgdy0xMicgXG4gICAgICAgICAgICAgICAgOiAnYmctZ3JheS02MDAnXG4gICAgICAgICAgICApfSAvPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICB7LyogRXJyb3IgRGlzcGxheSAqL31cbiAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuZXJyb3J9PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJtYi04IHAtNiBiZy1yZWQtOTAwLzIwIGJvcmRlciBib3JkZXItcmVkLTgwMCByb3VuZGVkLXhsXCI+XG4gICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtcmVkLTQwMCB0ZXh0LWNlbnRlciB0ZXh0LWxnXCI+e3Byb3BzLmVycm9yfTwvcD5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9TaG93PlxuXG4gICAgICAgIHsvKiBDb250ZW50ICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS02XCI+XG4gICAgICAgICAgey8qIENvbm5lY3QgV2FsbGV0IFN0ZXAgKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuc3RlcCA9PT0gJ2Nvbm5lY3Qtd2FsbGV0J30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgc3BhY2UteS04XCI+XG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC00eGwgZm9udC1zZW1pYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj5cbiAgICAgICAgICAgICAgICAgIENvbm5lY3QgWW91ciBXYWxsZXRcbiAgICAgICAgICAgICAgICA8L2gyPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTQwMCB0ZXh0LWxnIG1heC13LW1kIG14LWF1dG9cIj5cbiAgICAgICAgICAgICAgICAgIENvbm5lY3QgeW91ciB3YWxsZXQgdG8gZ2V0IHN0YXJ0ZWRcbiAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LTQgbWF4LXctbWQgbXgtYXV0b1wiPlxuICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ29ubmVjdFdhbGxldH1cbiAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5pc0Nvbm5lY3Rpbmd9XG4gICAgICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNiB0ZXh0LWxnXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICB7cHJvcHMuaXNDb25uZWN0aW5nID8gKFxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ3LTQgaC00IGJvcmRlci0yIGJvcmRlci1jdXJyZW50IGJvcmRlci1yLXRyYW5zcGFyZW50IHJvdW5kZWQtZnVsbCBhbmltYXRlLXNwaW5cIiAvPlxuICAgICAgICAgICAgICAgICAgICAgIENvbm5lY3RpbmcuLi5cbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuPvCfpoo8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgQ29ubmVjdCB3aXRoIE1ldGFNYXNrXG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgPC9CdXR0b24+XG5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXshc2hvd1Rlc3RPcHRpb24oKSAmJiAhc2hvd1ByaXZhdGVLZXlJbnB1dCgpfT5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGdhcC00IGp1c3RpZnktY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93VGVzdE9wdGlvbih0cnVlKX1cbiAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtZ3JheS01MDAgaG92ZXI6dGV4dC1ncmF5LTMwMCB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICBVc2UgZGVtbyBtb2RlXG4gICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInRleHQtZ3JheS02MDBcIj58PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd1ByaXZhdGVLZXlJbnB1dCh0cnVlKX1cbiAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtZ3JheS01MDAgaG92ZXI6dGV4dC1ncmF5LTMwMCB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICBVc2UgcHJpdmF0ZSBrZXlcbiAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtzaG93VGVzdE9wdGlvbigpfT5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwdC02IHNwYWNlLXktNFwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9yZGVyLXQgYm9yZGVyLWdyYXktODAwIHB0LTZcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblVzZVRlc3RNb2RlfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFudD1cInNlY29uZGFyeVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNFwiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgQ29udGludWUgd2l0aCBEZW1vIE1vZGVcbiAgICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93VGVzdE9wdGlvbihmYWxzZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtZ3JheS01MDAgaG92ZXI6dGV4dC1ncmF5LTMwMCB0cmFuc2l0aW9uLWNvbG9ycyBtdC0zXCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICBCYWNrXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17c2hvd1ByaXZhdGVLZXlJbnB1dCgpfT5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwdC02IHNwYWNlLXktNFwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9yZGVyLXQgYm9yZGVyLWdyYXktODAwIHB0LTZcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJwYXNzd29yZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17cHJpdmF0ZUtleSgpfVxuICAgICAgICAgICAgICAgICAgICAgICAgb25JbnB1dD17KGUpID0+IHNldFByaXZhdGVLZXkoZS5jdXJyZW50VGFyZ2V0LnZhbHVlKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiRW50ZXIgcHJpdmF0ZSBrZXlcIlxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNCBweC00IGJnLWdyYXktODAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC1sZyB0ZXh0LXdoaXRlIHBsYWNlaG9sZGVyLWdyYXktNTAwIGZvY3VzOm91dGxpbmUtbm9uZSBmb2N1czpib3JkZXItcHVycGxlLTUwMFwiXG4gICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBwcm9wcy5vblVzZVByaXZhdGVLZXkocHJpdmF0ZUtleSgpKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXshcHJpdmF0ZUtleSgpIHx8IHByaXZhdGVLZXkoKS5sZW5ndGggIT09IDY0fVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFudD1cInNlY29uZGFyeVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNCBtdC0zXCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICBDb25uZWN0IHdpdGggUHJpdmF0ZSBLZXlcbiAgICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldFNob3dQcml2YXRlS2V5SW5wdXQoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRQcml2YXRlS2V5KCcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtZ3JheS01MDAgaG92ZXI6dGV4dC1ncmF5LTMwMCB0cmFuc2l0aW9uLWNvbG9ycyBtdC0zXCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICBCYWNrXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgey8qIEdlbmVyYXRpbmcgVG9rZW4gU3RlcCAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zdGVwID09PSAnZ2VuZXJhdGluZy10b2tlbid9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIHNwYWNlLXktOFwiPlxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQtNHhsIGZvbnQtc2VtaWJvbGQgdGV4dC13aGl0ZSBtYi00XCI+XG4gICAgICAgICAgICAgICAgICBTZXR0aW5nIFVwIFlvdXIgQWNjb3VudFxuICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMud2FsbGV0QWRkcmVzc30+XG4gICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS00MDAgdGV4dC1sZyBtYi0zXCI+XG4gICAgICAgICAgICAgICAgICAgIENvbm5lY3RlZCB3YWxsZXQ6XG4gICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICA8Y29kZSBjbGFzcz1cInRleHQtbGcgdGV4dC1wdXJwbGUtNDAwIGJnLWdyYXktODAwIHB4LTQgcHktMiByb3VuZGVkLWxnIGZvbnQtbW9ubyBpbmxpbmUtYmxvY2tcIj5cbiAgICAgICAgICAgICAgICAgICAge3Byb3BzLndhbGxldEFkZHJlc3M/LnNsaWNlKDAsIDYpfS4uLntwcm9wcy53YWxsZXRBZGRyZXNzPy5zbGljZSgtNCl9XG4gICAgICAgICAgICAgICAgICA8L2NvZGU+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicHktMTJcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidy0yMCBoLTIwIGJvcmRlci00IGJvcmRlci1wdXJwbGUtNTAwIGJvcmRlci10LXRyYW5zcGFyZW50IHJvdW5kZWQtZnVsbCBhbmltYXRlLXNwaW4gbXgtYXV0b1wiIC8+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTQwMCB0ZXh0LXhsXCI+XG4gICAgICAgICAgICAgICAge3Byb3BzLmlzR2VuZXJhdGluZyBcbiAgICAgICAgICAgICAgICAgID8gJ0dlbmVyYXRpbmcgeW91ciBhY2Nlc3MgdG9rZW4uLi4nIFxuICAgICAgICAgICAgICAgICAgOiAnVmVyaWZ5aW5nIHlvdXIgYWNjb3VudC4uLid9XG4gICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgIHsvKiBDb21wbGV0ZSBTdGVwICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnN0ZXAgPT09ICdjb21wbGV0ZSd9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIHNwYWNlLXktOFwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC04eGwgbWItNlwiPvCfjok8L2Rpdj5cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC00eGwgZm9udC1zZW1pYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj5cbiAgICAgICAgICAgICAgICAgIFlvdSdyZSBBbGwgU2V0IVxuICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQteGwgbWF4LXctbWQgbXgtYXV0byBtYi04XCI+XG4gICAgICAgICAgICAgICAgICBZb3VyIGFjY291bnQgaXMgcmVhZHkuIFRpbWUgdG8gc2luZyFcbiAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy1tZCBteC1hdXRvXCI+XG4gICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25Db21wbGV0ZX1cbiAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE2IHRleHQtbGdcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIFN0YXJ0IFNpbmdpbmchIPCfmoBcbiAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIG10LTZcIj5cbiAgICAgICAgICAgICAgICBMb29rIGZvciB0aGUga2FyYW9rZSB3aWRnZXQgb24gYW55IFNvdW5kQ2xvdWQgdHJhY2tcbiAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBGb3IsIGNyZWF0ZUVmZmVjdCwgY3JlYXRlU2lnbmFsLCBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBMeXJpY0xpbmUge1xuICBpZDogc3RyaW5nO1xuICB0ZXh0OiBzdHJpbmc7XG4gIHN0YXJ0VGltZTogbnVtYmVyOyAvLyBpbiBzZWNvbmRzXG4gIGR1cmF0aW9uOiBudW1iZXI7IC8vIGluIG1pbGxpc2Vjb25kc1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEx5cmljc0Rpc3BsYXlQcm9wcyB7XG4gIGx5cmljczogTHlyaWNMaW5lW107XG4gIGN1cnJlbnRUaW1lPzogbnVtYmVyOyAvLyBpbiBtaWxsaXNlY29uZHNcbiAgaXNQbGF5aW5nPzogYm9vbGVhbjtcbiAgbGluZVNjb3Jlcz86IEFycmF5PHsgbGluZUluZGV4OiBudW1iZXI7IHNjb3JlOiBudW1iZXI7IHRyYW5zY3JpcHRpb246IHN0cmluZzsgZmVlZGJhY2s/OiBzdHJpbmcgfT47XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgTHlyaWNzRGlzcGxheTogQ29tcG9uZW50PEx5cmljc0Rpc3BsYXlQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2N1cnJlbnRMaW5lSW5kZXgsIHNldEN1cnJlbnRMaW5lSW5kZXhdID0gY3JlYXRlU2lnbmFsKC0xKTtcbiAgbGV0IGNvbnRhaW5lclJlZjogSFRNTERpdkVsZW1lbnQgfCB1bmRlZmluZWQ7XG4gIFxuICAvLyBIZWxwZXIgdG8gZ2V0IHNjb3JlIGZvciBhIGxpbmVcbiAgY29uc3QgZ2V0TGluZVNjb3JlID0gKGxpbmVJbmRleDogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIHByb3BzLmxpbmVTY29yZXM/LmZpbmQocyA9PiBzLmxpbmVJbmRleCA9PT0gbGluZUluZGV4KT8uc2NvcmUgfHwgbnVsbDtcbiAgfTtcbiAgXG4gIC8vIEhlbHBlciB0byBnZXQgY29sb3IgYmFzZWQgb24gc2NvcmVcbiAgY29uc3QgZ2V0U2NvcmVTdHlsZSA9IChzY29yZTogbnVtYmVyIHwgbnVsbCkgPT4ge1xuICAgIGlmIChzY29yZSA9PT0gbnVsbCkgcmV0dXJuIHt9O1xuICAgIFxuICAgIC8vIFNpbXBsZSBjb2xvciBjaGFuZ2VzIG9ubHkgLSBubyBhbmltYXRpb25zIG9yIGVmZmVjdHNcbiAgICBpZiAoc2NvcmUgPj0gOTUpIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmMzgzOCcgfTtcbiAgICB9IGVsc2UgaWYgKHNjb3JlID49IDkwKSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZjZiNmInIH07XG4gICAgfSBlbHNlIGlmIChzY29yZSA+PSA4MCkge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmY4Nzg3JyB9O1xuICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gNzApIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmYThhOCcgfTtcbiAgICB9IGVsc2UgaWYgKHNjb3JlID49IDYwKSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZmNlY2UnIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmZTBlMCcgfTtcbiAgICB9XG4gIH07XG4gIFxuICAvLyBSZW1vdmVkIGVtb2ppIGZ1bmN0aW9uIC0gdXNpbmcgY29sb3JzIG9ubHlcblxuICAvLyBGaW5kIGN1cnJlbnQgbGluZSBiYXNlZCBvbiB0aW1lXG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFwcm9wcy5jdXJyZW50VGltZSB8fCAhcHJvcHMubHlyaWNzLmxlbmd0aCkge1xuICAgICAgc2V0Q3VycmVudExpbmVJbmRleCgtMSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGltZSA9IHByb3BzLmN1cnJlbnRUaW1lIC8gMTAwMDsgLy8gQ29udmVydCBmcm9tIG1pbGxpc2Vjb25kcyB0byBzZWNvbmRzXG4gICAgY29uc3QgVElNSU5HX09GRlNFVCA9IDAuMzsgLy8gT2Zmc2V0IHRvIG1ha2UgbHlyaWNzIGFwcGVhciAwLjNzIGVhcmxpZXJcbiAgICBjb25zdCBhZGp1c3RlZFRpbWUgPSB0aW1lICsgVElNSU5HX09GRlNFVDtcbiAgICBcbiAgICAvLyBGaW5kIHRoZSBsaW5lIHRoYXQgY29udGFpbnMgdGhlIGN1cnJlbnQgdGltZVxuICAgIGxldCBmb3VuZEluZGV4ID0gLTE7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcm9wcy5seXJpY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBwcm9wcy5seXJpY3NbaV07XG4gICAgICBpZiAoIWxpbmUpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgZW5kVGltZSA9IGxpbmUuc3RhcnRUaW1lICsgbGluZS5kdXJhdGlvbiAvIDEwMDA7IC8vIENvbnZlcnQgZHVyYXRpb24gZnJvbSBtcyB0byBzZWNvbmRzXG4gICAgICBcbiAgICAgIGlmIChhZGp1c3RlZFRpbWUgPj0gbGluZS5zdGFydFRpbWUgJiYgYWRqdXN0ZWRUaW1lIDwgZW5kVGltZSkge1xuICAgICAgICBmb3VuZEluZGV4ID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIElmIG5vIGxpbmUgY29udGFpbnMgY3VycmVudCB0aW1lLCBmaW5kIHRoZSBtb3N0IHJlY2VudCBwYXN0IGxpbmVcbiAgICBpZiAoZm91bmRJbmRleCA9PT0gLTEgJiYgdGltZSA+IDApIHtcbiAgICAgIGZvciAobGV0IGkgPSBwcm9wcy5seXJpY3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgY29uc3QgbGluZSA9IHByb3BzLmx5cmljc1tpXTtcbiAgICAgICAgaWYgKCFsaW5lKSBjb250aW51ZTtcbiAgICAgICAgaWYgKHRpbWUgPj0gbGluZS5zdGFydFRpbWUpIHtcbiAgICAgICAgICBmb3VuZEluZGV4ID0gaTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBPbmx5IHVwZGF0ZSBpZiB0aGUgaW5kZXggaGFzIGNoYW5nZWQgdG8gYXZvaWQgdW5uZWNlc3Nhcnkgc2Nyb2xsaW5nXG4gICAgaWYgKGZvdW5kSW5kZXggIT09IGN1cnJlbnRMaW5lSW5kZXgoKSkge1xuICAgICAgY29uc3QgcHJldkluZGV4ID0gY3VycmVudExpbmVJbmRleCgpO1xuICAgICAgLy8gT25seSBsb2cgbGFyZ2UganVtcHMgdG8gcmVkdWNlIGNvbnNvbGUgc3BhbVxuICAgICAgaWYgKE1hdGguYWJzKGZvdW5kSW5kZXggLSBwcmV2SW5kZXgpID4gNSkge1xuICAgICAgICBjb25zb2xlLmxvZygnW0x5cmljc0Rpc3BsYXldIEN1cnJlbnQgbGluZSBjaGFuZ2VkOicsIHtcbiAgICAgICAgICBmcm9tOiBwcmV2SW5kZXgsXG4gICAgICAgICAgdG86IGZvdW5kSW5kZXgsXG4gICAgICAgICAgdGltZTogcHJvcHMuY3VycmVudFRpbWUsXG4gICAgICAgICAgdGltZUluU2Vjb25kczogdGltZSxcbiAgICAgICAgICBqdW1wOiBNYXRoLmFicyhmb3VuZEluZGV4IC0gcHJldkluZGV4KVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gTG9nIHdhcm5pbmcgZm9yIGxhcmdlIGp1bXBzXG4gICAgICBpZiAocHJldkluZGV4ICE9PSAtMSAmJiBNYXRoLmFicyhmb3VuZEluZGV4IC0gcHJldkluZGV4KSA+IDEwKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW0x5cmljc0Rpc3BsYXldIExhcmdlIGxpbmUganVtcCBkZXRlY3RlZCEnLCB7XG4gICAgICAgICAgZnJvbTogcHJldkluZGV4LFxuICAgICAgICAgIHRvOiBmb3VuZEluZGV4LFxuICAgICAgICAgIGZyb21MaW5lOiBwcm9wcy5seXJpY3NbcHJldkluZGV4XSxcbiAgICAgICAgICB0b0xpbmU6IHByb3BzLmx5cmljc1tmb3VuZEluZGV4XVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgc2V0Q3VycmVudExpbmVJbmRleChmb3VuZEluZGV4KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEF1dG8tc2Nyb2xsIHRvIGN1cnJlbnQgbGluZVxuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IGluZGV4ID0gY3VycmVudExpbmVJbmRleCgpO1xuICAgIGlmIChpbmRleCA9PT0gLTEgfHwgIWNvbnRhaW5lclJlZiB8fCAhcHJvcHMuaXNQbGF5aW5nKSByZXR1cm47XG5cbiAgICBjb25zdCBsaW5lRWxlbWVudHMgPSBjb250YWluZXJSZWYucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtbGluZS1pbmRleF0nKTtcbiAgICBjb25zdCBjdXJyZW50RWxlbWVudCA9IGxpbmVFbGVtZW50c1tpbmRleF0gYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICBpZiAoY3VycmVudEVsZW1lbnQpIHtcbiAgICAgIGNvbnN0IGNvbnRhaW5lckhlaWdodCA9IGNvbnRhaW5lclJlZi5jbGllbnRIZWlnaHQ7XG4gICAgICBjb25zdCBsaW5lVG9wID0gY3VycmVudEVsZW1lbnQub2Zmc2V0VG9wO1xuICAgICAgY29uc3QgbGluZUhlaWdodCA9IGN1cnJlbnRFbGVtZW50Lm9mZnNldEhlaWdodDtcbiAgICAgIFxuICAgICAgLy8gQ2VudGVyIHRoZSBjdXJyZW50IGxpbmVcbiAgICAgIGNvbnN0IHRhcmdldFNjcm9sbFRvcCA9IGxpbmVUb3AgLSBjb250YWluZXJIZWlnaHQgLyAyICsgbGluZUhlaWdodCAvIDI7XG4gICAgICBcbiAgICAgIGNvbnRhaW5lclJlZi5zY3JvbGxUbyh7XG4gICAgICAgIHRvcDogdGFyZ2V0U2Nyb2xsVG9wLFxuICAgICAgICBiZWhhdmlvcjogJ3Ntb290aCcsXG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgcmVmPXtjb250YWluZXJSZWZ9XG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdseXJpY3MtZGlzcGxheSBvdmVyZmxvdy15LWF1dG8gc2Nyb2xsLXNtb290aCcsXG4gICAgICAgICdoLWZ1bGwgcHgtNiBweS0xMicsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LThcIj5cbiAgICAgICAgPEZvciBlYWNoPXtwcm9wcy5seXJpY3N9PlxuICAgICAgICAgIHsobGluZSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVTY29yZSA9ICgpID0+IGdldExpbmVTY29yZShpbmRleCgpKTtcbiAgICAgICAgICAgIGNvbnN0IHNjb3JlU3R5bGUgPSAoKSA9PiBnZXRTY29yZVN0eWxlKGxpbmVTY29yZSgpKTtcbiAgICAgICAgICAgIC8vIFVzaW5nIGNvbG9yIGdyYWRpZW50cyBpbnN0ZWFkIG9mIGVtb2ppc1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgZGF0YS1saW5lLWluZGV4PXtpbmRleCgpfVxuICAgICAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAgICd0ZXh0LWNlbnRlcicsXG4gICAgICAgICAgICAgICAgICAndGV4dC0yeGwgbGVhZGluZy1yZWxheGVkJyxcbiAgICAgICAgICAgICAgICAgIGluZGV4KCkgPT09IGN1cnJlbnRMaW5lSW5kZXgoKVxuICAgICAgICAgICAgICAgICAgICA/ICdvcGFjaXR5LTEwMCdcbiAgICAgICAgICAgICAgICAgICAgOiAnb3BhY2l0eS02MCdcbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICBjb2xvcjogaW5kZXgoKSA9PT0gY3VycmVudExpbmVJbmRleCgpICYmICFsaW5lU2NvcmUoKSBcbiAgICAgICAgICAgICAgICAgICAgPyAnI2ZmZmZmZicgLy8gV2hpdGUgZm9yIGN1cnJlbnQgbGluZSB3aXRob3V0IHNjb3JlXG4gICAgICAgICAgICAgICAgICAgIDogc2NvcmVTdHlsZSgpLmNvbG9yIHx8ICcjZmZmZmZmJ1xuICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICB7bGluZS50ZXh0fVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfX1cbiAgICAgICAgPC9Gb3I+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlSGVhZGVyUHJvcHMge1xuICBzb25nVGl0bGU6IHN0cmluZztcbiAgYXJ0aXN0OiBzdHJpbmc7XG4gIG9uQmFjaz86ICgpID0+IHZvaWQ7XG4gIGlzUGxheWluZz86IGJvb2xlYW47XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5jb25zdCBDaGV2cm9uTGVmdCA9ICgpID0+IChcbiAgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgY2xhc3M9XCJ3LTYgaC02XCI+XG4gICAgPHBhdGggc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIgZD1cIk0xNSAxOWwtNy03IDctN1wiIC8+XG4gIDwvc3ZnPlxuKTtcblxuY29uc3QgUGF1c2VJY29uID0gKCkgPT4gKFxuICA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBjbGFzcz1cInctNiBoLTZcIj5cbiAgICA8cGF0aCBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBkPVwiTTEwIDl2Nm00LTZ2Nm03LTNhOSA5IDAgMTEtMTggMCA5IDkgMCAwMTE4IDB6XCIgLz5cbiAgPC9zdmc+XG4pO1xuXG5leHBvcnQgY29uc3QgS2FyYW9rZUhlYWRlcjogQ29tcG9uZW50PEthcmFva2VIZWFkZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbigncmVsYXRpdmUgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcC00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBCYWNrL1BhdXNlIGJ1dHRvbiAtIGFic29sdXRlIHBvc2l0aW9uZWQgKi99XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQmFja31cbiAgICAgICAgY2xhc3M9XCJhYnNvbHV0ZSBsZWZ0LTQgcC0yIC1tLTIgdGV4dC1zZWNvbmRhcnkgaG92ZXI6dGV4dC1wcmltYXJ5IHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgYXJpYS1sYWJlbD17cHJvcHMuaXNQbGF5aW5nID8gXCJQYXVzZVwiIDogXCJHbyBiYWNrXCJ9XG4gICAgICA+XG4gICAgICAgIHtwcm9wcy5pc1BsYXlpbmcgPyA8UGF1c2VJY29uIC8+IDogPENoZXZyb25MZWZ0IC8+fVxuICAgICAgPC9idXR0b24+XG4gICAgICBcbiAgICAgIHsvKiBTb25nIGluZm8gLSBjZW50ZXJlZCAqL31cbiAgICAgIDxoMSBjbGFzcz1cInRleHQtYmFzZSBmb250LW1lZGl1bSB0ZXh0LXByaW1hcnkgdGV4dC1jZW50ZXIgcHgtMTIgdHJ1bmNhdGUgbWF4LXctZnVsbFwiPlxuICAgICAgICB7cHJvcHMuc29uZ1RpdGxlfSAtIHtwcm9wcy5hcnRpc3R9XG4gICAgICA8L2gxPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBGb3IsIFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIExlYWRlcmJvYXJkRW50cnkge1xuICByYW5rOiBudW1iZXI7XG4gIHVzZXJuYW1lOiBzdHJpbmc7XG4gIHNjb3JlOiBudW1iZXI7XG4gIGlzQ3VycmVudFVzZXI/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIExlYWRlcmJvYXJkUGFuZWxQcm9wcyB7XG4gIGVudHJpZXM6IExlYWRlcmJvYXJkRW50cnlbXTtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBMZWFkZXJib2FyZFBhbmVsOiBDb21wb25lbnQ8TGVhZGVyYm9hcmRQYW5lbFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sIGdhcC0yIHAtNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8U2hvdyBcbiAgICAgICAgd2hlbj17cHJvcHMuZW50cmllcy5sZW5ndGggPiAwfVxuICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHB5LTEyIHB4LTYgdGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTZ4bCBtYi00IG9wYWNpdHktMzBcIj7wn46kPC9kaXY+XG4gICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1zZWNvbmRhcnkgbWItMlwiPk5vYm9keSBoYXMgY29tcGxldGVkIHRoaXMgc29uZyB5ZXQhPC9wPlxuICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtdGVydGlhcnlcIj5CZSB0aGUgZmlyc3QgdG8gc2V0IGEgaGlnaCBzY29yZTwvcD5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgfVxuICAgICAgPlxuICAgICAgICA8Rm9yIGVhY2g9e3Byb3BzLmVudHJpZXN9PlxuICAgICAgICAgIHsoZW50cnkpID0+IChcbiAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAnZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgcHgtMyBweS0yIHJvdW5kZWQtbGcgdHJhbnNpdGlvbi1jb2xvcnMnLFxuICAgICAgICAgICAgICAgIGVudHJ5LmlzQ3VycmVudFVzZXIgXG4gICAgICAgICAgICAgICAgICA/ICdiZy1hY2NlbnQtcHJpbWFyeS8xMCBib3JkZXIgYm9yZGVyLWFjY2VudC1wcmltYXJ5LzIwJyBcbiAgICAgICAgICAgICAgICAgIDogJ2JnLXN1cmZhY2UgaG92ZXI6Ymctc3VyZmFjZS1ob3ZlcidcbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPHNwYW4gXG4gICAgICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICAgJ3ctOCB0ZXh0LWNlbnRlciBmb250LW1vbm8gZm9udC1ib2xkJyxcbiAgICAgICAgICAgICAgICAgIGVudHJ5LnJhbmsgPD0gMyA/ICd0ZXh0LWFjY2VudC1wcmltYXJ5JyA6ICd0ZXh0LXNlY29uZGFyeSdcbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgI3tlbnRyeS5yYW5rfVxuICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAnZmxleC0xIHRydW5jYXRlJyxcbiAgICAgICAgICAgICAgICBlbnRyeS5pc0N1cnJlbnRVc2VyID8gJ3RleHQtYWNjZW50LXByaW1hcnkgZm9udC1tZWRpdW0nIDogJ3RleHQtcHJpbWFyeSdcbiAgICAgICAgICAgICAgKX0+XG4gICAgICAgICAgICAgICAge2VudHJ5LnVzZXJuYW1lfVxuICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAnZm9udC1tb25vIGZvbnQtYm9sZCcsXG4gICAgICAgICAgICAgICAgZW50cnkuaXNDdXJyZW50VXNlciA/ICd0ZXh0LWFjY2VudC1wcmltYXJ5JyA6ICd0ZXh0LXByaW1hcnknXG4gICAgICAgICAgICAgICl9PlxuICAgICAgICAgICAgICAgIHtlbnRyeS5zY29yZS50b0xvY2FsZVN0cmluZygpfVxuICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApfVxuICAgICAgICA8L0Zvcj5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IHR5cGUgUGxheWJhY2tTcGVlZCA9ICcxeCcgfCAnMC43NXgnIHwgJzAuNXgnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNwbGl0QnV0dG9uUHJvcHMge1xuICBvblN0YXJ0PzogKCkgPT4gdm9pZDtcbiAgb25TcGVlZENoYW5nZT86IChzcGVlZDogUGxheWJhY2tTcGVlZCkgPT4gdm9pZDtcbiAgZGlzYWJsZWQ/OiBib29sZWFuO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuY29uc3Qgc3BlZWRzOiBQbGF5YmFja1NwZWVkW10gPSBbJzF4JywgJzAuNzV4JywgJzAuNXgnXTtcblxuZXhwb3J0IGNvbnN0IFNwbGl0QnV0dG9uOiBDb21wb25lbnQ8U3BsaXRCdXR0b25Qcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2N1cnJlbnRTcGVlZEluZGV4LCBzZXRDdXJyZW50U3BlZWRJbmRleF0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIFxuICBjb25zdCBjdXJyZW50U3BlZWQgPSAoKSA9PiBzcGVlZHNbY3VycmVudFNwZWVkSW5kZXgoKV07XG4gIFxuICBjb25zdCBjeWNsZVNwZWVkID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGNvbnN0IG5leHRJbmRleCA9IChjdXJyZW50U3BlZWRJbmRleCgpICsgMSkgJSBzcGVlZHMubGVuZ3RoO1xuICAgIHNldEN1cnJlbnRTcGVlZEluZGV4KG5leHRJbmRleCk7XG4gICAgY29uc3QgbmV3U3BlZWQgPSBzcGVlZHNbbmV4dEluZGV4XTtcbiAgICBpZiAobmV3U3BlZWQpIHtcbiAgICAgIHByb3BzLm9uU3BlZWRDaGFuZ2U/LihuZXdTcGVlZCk7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBcbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ3JlbGF0aXZlIGlubGluZS1mbGV4IHctZnVsbCByb3VuZGVkLWxnIG92ZXJmbG93LWhpZGRlbicsXG4gICAgICAgICdiZy1ncmFkaWVudC1wcmltYXJ5IHRleHQtd2hpdGUgc2hhZG93LWxnJyxcbiAgICAgICAgJ3RyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIHsvKiBNYWluIGJ1dHRvbiAqL31cbiAgICAgIDxidXR0b25cbiAgICAgICAgb25DbGljaz17cHJvcHMub25TdGFydH1cbiAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmRpc2FibGVkfVxuICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgJ2ZsZXgtMSBpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcmVsYXRpdmUgb3ZlcmZsb3ctaGlkZGVuJyxcbiAgICAgICAgICAnaC0xMiBweC02IHRleHQtbGcgZm9udC1tZWRpdW0nLFxuICAgICAgICAgICdjdXJzb3ItcG9pbnRlciBib3JkZXItbm9uZSBvdXRsaW5lLW5vbmUnLFxuICAgICAgICAgICdkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS01MCcsXG4gICAgICAgICAgJ2hvdmVyOmJnLXdoaXRlLzEwIGFjdGl2ZTpiZy13aGl0ZS8yMCdcbiAgICAgICAgKX1cbiAgICAgID5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJyZWxhdGl2ZSB6LTEwXCI+U3RhcnQ8L3NwYW4+XG4gICAgICA8L2J1dHRvbj5cbiAgICAgIFxuICAgICAgey8qIERpdmlkZXIgKi99XG4gICAgICA8ZGl2IGNsYXNzPVwidy1weCBiZy1ibGFjay8yMFwiIC8+XG4gICAgICBcbiAgICAgIHsvKiBTcGVlZCBidXR0b24gKi99XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e2N5Y2xlU3BlZWR9XG4gICAgICAgIGRpc2FibGVkPXtwcm9wcy5kaXNhYmxlZH1cbiAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICdpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcmVsYXRpdmUnLFxuICAgICAgICAgICd3LTIwIHRleHQtbGcgZm9udC1tZWRpdW0nLFxuICAgICAgICAgICdjdXJzb3ItcG9pbnRlciBib3JkZXItbm9uZSBvdXRsaW5lLW5vbmUnLFxuICAgICAgICAgICdkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS01MCcsXG4gICAgICAgICAgJ2hvdmVyOmJnLXdoaXRlLzEwIGFjdGl2ZTpiZy13aGl0ZS8yMCcsXG4gICAgICAgICAgJ2FmdGVyOmNvbnRlbnQtW1wiXCJdIGFmdGVyOmFic29sdXRlIGFmdGVyOmluc2V0LTAnLFxuICAgICAgICAgICdhZnRlcjpiZy1ncmFkaWVudC10by1yIGFmdGVyOmZyb20tdHJhbnNwYXJlbnQgYWZ0ZXI6dmlhLXdoaXRlLzIwIGFmdGVyOnRvLXRyYW5zcGFyZW50JyxcbiAgICAgICAgICAnYWZ0ZXI6dHJhbnNsYXRlLXgtWy0yMDAlXSBob3ZlcjphZnRlcjp0cmFuc2xhdGUteC1bMjAwJV0nLFxuICAgICAgICAgICdhZnRlcjp0cmFuc2l0aW9uLXRyYW5zZm9ybSBhZnRlcjpkdXJhdGlvbi03MDAnXG4gICAgICAgICl9XG4gICAgICAgIGFyaWEtbGFiZWw9XCJDaGFuZ2UgcGxheWJhY2sgc3BlZWRcIlxuICAgICAgPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInJlbGF0aXZlIHotMTBcIj57Y3VycmVudFNwZWVkKCl9PC9zcGFuPlxuICAgICAgPC9idXR0b24+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCwgU2hvdywgY3JlYXRlQ29udGV4dCwgdXNlQ29udGV4dCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50LCBKU1gsIFBhcmVudENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRhYiB7XG4gIGlkOiBzdHJpbmc7XG4gIGxhYmVsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFic1Byb3BzIHtcbiAgdGFiczogVGFiW107XG4gIGRlZmF1bHRUYWI/OiBzdHJpbmc7XG4gIG9uVGFiQ2hhbmdlPzogKHRhYklkOiBzdHJpbmcpID0+IHZvaWQ7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFic0xpc3RQcm9wcyB7XG4gIGNsYXNzPzogc3RyaW5nO1xuICBjaGlsZHJlbjogSlNYLkVsZW1lbnQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFic1RyaWdnZXJQcm9wcyB7XG4gIHZhbHVlOiBzdHJpbmc7XG4gIGNsYXNzPzogc3RyaW5nO1xuICBjaGlsZHJlbjogSlNYLkVsZW1lbnQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFic0NvbnRlbnRQcm9wcyB7XG4gIHZhbHVlOiBzdHJpbmc7XG4gIGNsYXNzPzogc3RyaW5nO1xuICBjaGlsZHJlbjogSlNYLkVsZW1lbnQ7XG59XG5cbi8vIENvbnRleHQgZm9yIHRhYnMgc3RhdGVcbmludGVyZmFjZSBUYWJzQ29udGV4dFZhbHVlIHtcbiAgYWN0aXZlVGFiOiAoKSA9PiBzdHJpbmc7XG4gIHNldEFjdGl2ZVRhYjogKGlkOiBzdHJpbmcpID0+IHZvaWQ7XG59XG5cbmNvbnN0IFRhYnNDb250ZXh0ID0gY3JlYXRlQ29udGV4dDxUYWJzQ29udGV4dFZhbHVlPigpO1xuXG5leHBvcnQgY29uc3QgVGFiczogUGFyZW50Q29tcG9uZW50PFRhYnNQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2FjdGl2ZVRhYiwgc2V0QWN0aXZlVGFiXSA9IGNyZWF0ZVNpZ25hbChwcm9wcy5kZWZhdWx0VGFiIHx8IHByb3BzLnRhYnNbMF0/LmlkIHx8ICcnKTtcbiAgXG4gIFxuICBjb25zdCBoYW5kbGVUYWJDaGFuZ2UgPSAoaWQ6IHN0cmluZykgPT4ge1xuICAgIHNldEFjdGl2ZVRhYihpZCk7XG4gICAgcHJvcHMub25UYWJDaGFuZ2U/LihpZCk7XG4gIH07XG5cbiAgY29uc3QgY29udGV4dFZhbHVlOiBUYWJzQ29udGV4dFZhbHVlID0ge1xuICAgIGFjdGl2ZVRhYixcbiAgICBzZXRBY3RpdmVUYWI6IGhhbmRsZVRhYkNoYW5nZVxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPFRhYnNDb250ZXh0LlByb3ZpZGVyIHZhbHVlPXtjb250ZXh0VmFsdWV9PlxuICAgICAgPGRpdiBjbGFzcz17Y24oJ3ctZnVsbCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICAgIDwvZGl2PlxuICAgIDwvVGFic0NvbnRleHQuUHJvdmlkZXI+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgVGFic0xpc3Q6IENvbXBvbmVudDxUYWJzTGlzdFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdpbmxpbmUtZmxleCBoLTEwIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLW1kIGJnLXN1cmZhY2UgcC0xIHRleHQtc2Vjb25kYXJ5JyxcbiAgICAgICAgJ3ctZnVsbCcsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICA8L2Rpdj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBUYWJzVHJpZ2dlcjogQ29tcG9uZW50PFRhYnNUcmlnZ2VyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IGNvbnRleHQgPSB1c2VDb250ZXh0KFRhYnNDb250ZXh0KTtcbiAgaWYgKCFjb250ZXh0KSB7XG4gICAgY29uc29sZS5lcnJvcignW1RhYnNUcmlnZ2VyXSBObyBUYWJzQ29udGV4dCBmb3VuZC4gVGFic1RyaWdnZXIgbXVzdCBiZSB1c2VkIHdpdGhpbiBUYWJzIGNvbXBvbmVudC4nKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBcbiAgY29uc3QgaXNBY3RpdmUgPSAoKSA9PiBjb250ZXh0LmFjdGl2ZVRhYigpID09PSBwcm9wcy52YWx1ZTtcblxuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIG9uQ2xpY2s9eygpID0+IGNvbnRleHQuc2V0QWN0aXZlVGFiKHByb3BzLnZhbHVlKX1cbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2lubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB3aGl0ZXNwYWNlLW5vd3JhcCByb3VuZGVkLXNtIHB4LTMgcHktMS41JyxcbiAgICAgICAgJ3RleHQtc20gZm9udC1tZWRpdW0gcmluZy1vZmZzZXQtYmFzZSB0cmFuc2l0aW9uLWFsbCcsXG4gICAgICAgICdmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZSBmb2N1cy12aXNpYmxlOnJpbmctMiBmb2N1cy12aXNpYmxlOnJpbmctcHVycGxlLTUwMCBmb2N1cy12aXNpYmxlOnJpbmctb2Zmc2V0LTInLFxuICAgICAgICAnZGlzYWJsZWQ6cG9pbnRlci1ldmVudHMtbm9uZSBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAgJ2ZsZXgtMScsXG4gICAgICAgIGlzQWN0aXZlKClcbiAgICAgICAgICA/ICdiZy1iYXNlIHRleHQtcHJpbWFyeSBzaGFkb3ctc20nXG4gICAgICAgICAgOiAndGV4dC1zZWNvbmRhcnkgaG92ZXI6dGV4dC1wcmltYXJ5JyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgIDwvYnV0dG9uPlxuICApO1xufTtcblxuZXhwb3J0IGNvbnN0IFRhYnNDb250ZW50OiBDb21wb25lbnQ8VGFic0NvbnRlbnRQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgY29udGV4dCA9IHVzZUNvbnRleHQoVGFic0NvbnRleHQpO1xuICBpZiAoIWNvbnRleHQpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbVGFic0NvbnRlbnRdIE5vIFRhYnNDb250ZXh0IGZvdW5kLiBUYWJzQ29udGVudCBtdXN0IGJlIHVzZWQgd2l0aGluIFRhYnMgY29tcG9uZW50LicpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIFxuICBjb25zdCBpc0FjdGl2ZSA9ICgpID0+IGNvbnRleHQuYWN0aXZlVGFiKCkgPT09IHByb3BzLnZhbHVlO1xuICBcbiAgcmV0dXJuIChcbiAgICA8U2hvdyB3aGVuPXtpc0FjdGl2ZSgpfT5cbiAgICAgIDxkaXZcbiAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICdtdC0yIHJpbmctb2Zmc2V0LWJhc2UnLFxuICAgICAgICAgICdmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZSBmb2N1cy12aXNpYmxlOnJpbmctMiBmb2N1cy12aXNpYmxlOnJpbmctcHVycGxlLTUwMCBmb2N1cy12aXNpYmxlOnJpbmctb2Zmc2V0LTInLFxuICAgICAgICAgIHByb3BzLmNsYXNzXG4gICAgICAgICl9XG4gICAgICA+XG4gICAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICAgIDwvZGl2PlxuICAgIDwvU2hvdz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsLCBjcmVhdGVFZmZlY3QsIFNob3csIG9uQ2xlYW51cCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5pbXBvcnQgc3R5bGVzIGZyb20gJy4vRmlyZUVtb2ppQW5pbWF0aW9uLm1vZHVsZS5jc3MnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZpcmVFbW9qaUFuaW1hdGlvblByb3BzIHtcbiAgc2NvcmU6IG51bWJlcjtcbiAgbGluZUluZGV4OiBudW1iZXI7IC8vIFVzZSBsaW5lIGluZGV4IGluc3RlYWQgb2YgdHJpZ2dlclxuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEZpcmVFbW9qaUFuaW1hdGlvbjogQ29tcG9uZW50PEZpcmVFbW9qaUFuaW1hdGlvblByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbc2hvd0ZpcmUsIHNldFNob3dGaXJlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtmaXJlWCwgc2V0RmlyZVhdID0gY3JlYXRlU2lnbmFsKDUwKTtcbiAgbGV0IGxhc3RMaW5lSW5kZXggPSAtMTtcbiAgbGV0IGhpZGVUaW1lcjogbnVtYmVyIHwgdW5kZWZpbmVkO1xuICBcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICAvLyBDaGVjayBpZiB3ZSBoYXZlIGEgbmV3IGxpbmUgd2l0aCBoaWdoIHNjb3JlXG4gICAgaWYgKHByb3BzLmxpbmVJbmRleCA+IGxhc3RMaW5lSW5kZXggJiYgcHJvcHMuc2NvcmUgPj0gODApIHtcbiAgICAgIC8vIFJhbmRvbSBYIHBvc2l0aW9uIGJldHdlZW4gMjAlIGFuZCA4MCVcbiAgICAgIHNldEZpcmVYKDIwICsgTWF0aC5yYW5kb20oKSAqIDYwKTtcbiAgICAgIHNldFNob3dGaXJlKHRydWUpO1xuICAgICAgXG4gICAgICAvLyBDbGVhciBleGlzdGluZyB0aW1lclxuICAgICAgaWYgKGhpZGVUaW1lcikgY2xlYXJUaW1lb3V0KGhpZGVUaW1lcik7XG4gICAgICBcbiAgICAgIC8vIEhpZGUgYWZ0ZXIgYW5pbWF0aW9uIGNvbXBsZXRlc1xuICAgICAgaGlkZVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHNldFNob3dGaXJlKGZhbHNlKTtcbiAgICAgIH0sIDIwMDApO1xuICAgICAgXG4gICAgICBsYXN0TGluZUluZGV4ID0gcHJvcHMubGluZUluZGV4O1xuICAgIH1cbiAgfSk7XG4gIFxuICBvbkNsZWFudXAoKCkgPT4ge1xuICAgIGlmIChoaWRlVGltZXIpIGNsZWFyVGltZW91dChoaWRlVGltZXIpO1xuICB9KTtcblxuICByZXR1cm4gKFxuICAgIDxTaG93IHdoZW49e3Nob3dGaXJlKCl9PlxuICAgICAgPGRpdiBjbGFzcz17Y24oc3R5bGVzLmZpcmVDb250YWluZXIsIHByb3BzLmNsYXNzKX0+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICBjbGFzcz17c3R5bGVzLmZpcmVFbW9qaX1cbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgbGVmdDogYCR7ZmlyZVgoKX0lYCxcbiAgICAgICAgICAgICdmb250LXNpemUnOiAnMzJweCdcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAg8J+UpVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvU2hvdz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdywgdHlwZSBDb21wb25lbnQsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlRWZmZWN0IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5pbXBvcnQgeyBTY29yZVBhbmVsIH0gZnJvbSAnLi4vLi4vZGlzcGxheS9TY29yZVBhbmVsJztcbmltcG9ydCB7IEx5cmljc0Rpc3BsYXksIHR5cGUgTHlyaWNMaW5lIH0gZnJvbSAnLi4vTHlyaWNzRGlzcGxheSc7XG5pbXBvcnQgeyBMZWFkZXJib2FyZFBhbmVsLCB0eXBlIExlYWRlcmJvYXJkRW50cnkgfSBmcm9tICcuLi9MZWFkZXJib2FyZFBhbmVsJztcbmltcG9ydCB7IFNwbGl0QnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL1NwbGl0QnV0dG9uJztcbmltcG9ydCB0eXBlIHsgUGxheWJhY2tTcGVlZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5pbXBvcnQgeyBUYWJzLCBUYWJzTGlzdCwgVGFic1RyaWdnZXIsIFRhYnNDb250ZW50IH0gZnJvbSAnLi4vLi4vY29tbW9uL1RhYnMnO1xuaW1wb3J0IHsgRmlyZUVtb2ppQW5pbWF0aW9uIH0gZnJvbSAnLi4vLi4vZWZmZWN0cy9GaXJlRW1vamlBbmltYXRpb24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4dGVuc2lvbkthcmFva2VWaWV3UHJvcHMge1xuICAvLyBTY29yZXNcbiAgc2NvcmU6IG51bWJlcjtcbiAgcmFuazogbnVtYmVyO1xuICBcbiAgLy8gTHlyaWNzXG4gIGx5cmljczogTHlyaWNMaW5lW107XG4gIGN1cnJlbnRUaW1lPzogbnVtYmVyO1xuICBcbiAgLy8gTGVhZGVyYm9hcmRcbiAgbGVhZGVyYm9hcmQ6IExlYWRlcmJvYXJkRW50cnlbXTtcbiAgXG4gIC8vIFN0YXRlXG4gIGlzUGxheWluZz86IGJvb2xlYW47XG4gIGlzUmVjb3JkaW5nPzogYm9vbGVhbjtcbiAgb25TdGFydD86ICgpID0+IHZvaWQ7XG4gIG9uU3BlZWRDaGFuZ2U/OiAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpID0+IHZvaWQ7XG4gIFxuICAvLyBMaW5lIHNjb3JlcyBmb3IgdmlzdWFsIGZlZWRiYWNrXG4gIGxpbmVTY29yZXM/OiBBcnJheTx7IGxpbmVJbmRleDogbnVtYmVyOyBzY29yZTogbnVtYmVyOyB0cmFuc2NyaXB0aW9uOiBzdHJpbmc7IGZlZWRiYWNrPzogc3RyaW5nIH0+O1xuICBcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBFeHRlbnNpb25LYXJhb2tlVmlldzogQ29tcG9uZW50PEV4dGVuc2lvbkthcmFva2VWaWV3UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIC8vIEdldCB0aGUgbGF0ZXN0IGhpZ2ggc2NvcmUgbGluZSBpbmRleFxuICBjb25zdCBnZXRMYXRlc3RIaWdoU2NvcmVMaW5lID0gKCkgPT4ge1xuICAgIGNvbnN0IHNjb3JlcyA9IHByb3BzLmxpbmVTY29yZXMgfHwgW107XG4gICAgaWYgKHNjb3Jlcy5sZW5ndGggPT09IDApIHJldHVybiB7IHNjb3JlOiAwLCBsaW5lSW5kZXg6IC0xIH07XG4gICAgXG4gICAgY29uc3QgbGF0ZXN0ID0gc2NvcmVzW3Njb3Jlcy5sZW5ndGggLSAxXTtcbiAgICByZXR1cm4ge1xuICAgICAgc2NvcmU6IGxhdGVzdD8uc2NvcmUgfHwgMCxcbiAgICAgIGxpbmVJbmRleDogbGF0ZXN0Py5saW5lSW5kZXggfHwgLTFcbiAgICB9O1xuICB9O1xuICBcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZmxleCBmbGV4LWNvbCBoLWZ1bGwgYmctYmFzZSByZWxhdGl2ZScsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogU2NvcmUgUGFuZWwgLSBvbmx5IHNob3cgd2hlbiBub3QgcGxheWluZyAqL31cbiAgICAgIDxTaG93IHdoZW49eyFwcm9wcy5pc1BsYXlpbmd9PlxuICAgICAgICA8U2NvcmVQYW5lbFxuICAgICAgICAgIHNjb3JlPXtwcm9wcy5zY29yZX1cbiAgICAgICAgICByYW5rPXtwcm9wcy5yYW5rfVxuICAgICAgICAvPlxuICAgICAgPC9TaG93PlxuXG4gICAgICB7LyogU2hvdyB0YWJzIG9ubHkgd2hlbiBub3QgcGxheWluZyAqL31cbiAgICAgIDxTaG93IHdoZW49eyFwcm9wcy5pc1BsYXlpbmd9IGZhbGxiYWNrPXtcbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBmbGV4IGZsZXgtY29sIG1pbi1oLTBcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIG1pbi1oLTAgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICA8THlyaWNzRGlzcGxheVxuICAgICAgICAgICAgICBseXJpY3M9e3Byb3BzLmx5cmljc31cbiAgICAgICAgICAgICAgY3VycmVudFRpbWU9e3Byb3BzLmN1cnJlbnRUaW1lfVxuICAgICAgICAgICAgICBpc1BsYXlpbmc9e3Byb3BzLmlzUGxheWluZ31cbiAgICAgICAgICAgICAgbGluZVNjb3Jlcz17cHJvcHMubGluZVNjb3Jlc31cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgfT5cbiAgICAgICAgey8qIFRhYnMgYW5kIGNvbnRlbnQgKi99XG4gICAgICAgIDxUYWJzIFxuICAgICAgICAgIHRhYnM9e1tcbiAgICAgICAgICAgIHsgaWQ6ICdseXJpY3MnLCBsYWJlbDogJ0x5cmljcycgfSxcbiAgICAgICAgICAgIHsgaWQ6ICdsZWFkZXJib2FyZCcsIGxhYmVsOiAnTGVhZGVyYm9hcmQnIH1cbiAgICAgICAgICBdfVxuICAgICAgICAgIGRlZmF1bHRUYWI9XCJseXJpY3NcIlxuICAgICAgICAgIGNsYXNzPVwiZmxleC0xIGZsZXggZmxleC1jb2wgbWluLWgtMFwiXG4gICAgICAgID5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwicHgtNFwiPlxuICAgICAgICAgICAgPFRhYnNMaXN0PlxuICAgICAgICAgICAgICA8VGFic1RyaWdnZXIgdmFsdWU9XCJseXJpY3NcIj5MeXJpY3M8L1RhYnNUcmlnZ2VyPlxuICAgICAgICAgICAgICA8VGFic1RyaWdnZXIgdmFsdWU9XCJsZWFkZXJib2FyZFwiPkxlYWRlcmJvYXJkPC9UYWJzVHJpZ2dlcj5cbiAgICAgICAgICAgIDwvVGFic0xpc3Q+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgXG4gICAgICAgICAgPFRhYnNDb250ZW50IHZhbHVlPVwibHlyaWNzXCIgY2xhc3M9XCJmbGV4LTEgbWluLWgtMFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZmxleC1jb2wgaC1mdWxsXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgbWluLWgtMCBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgICAgICA8THlyaWNzRGlzcGxheVxuICAgICAgICAgICAgICAgICAgbHlyaWNzPXtwcm9wcy5seXJpY3N9XG4gICAgICAgICAgICAgICAgICBjdXJyZW50VGltZT17cHJvcHMuY3VycmVudFRpbWV9XG4gICAgICAgICAgICAgICAgICBpc1BsYXlpbmc9e3Byb3BzLmlzUGxheWluZ31cbiAgICAgICAgICAgICAgICAgIGxpbmVTY29yZXM9e3Byb3BzLmxpbmVTY29yZXN9XG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICB7LyogRm9vdGVyIHdpdGggc3RhcnQgYnV0dG9uICovfVxuICAgICAgICAgICAgICA8U2hvdyB3aGVuPXshcHJvcHMuaXNQbGF5aW5nICYmIHByb3BzLm9uU3RhcnR9PlxuICAgICAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInAtNCBiZy1zdXJmYWNlIGJvcmRlci10IGJvcmRlci1zdWJ0bGVcIlxuICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgICAgJ2ZsZXgtc2hyaW5rJzogJzAnXG4gICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxTcGxpdEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBvblN0YXJ0PXtwcm9wcy5vblN0YXJ0fVxuICAgICAgICAgICAgICAgICAgICBvblNwZWVkQ2hhbmdlPXtwcm9wcy5vblNwZWVkQ2hhbmdlfVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9UYWJzQ29udGVudD5cbiAgICAgICAgICBcbiAgICAgICAgICA8VGFic0NvbnRlbnQgdmFsdWU9XCJsZWFkZXJib2FyZFwiIGNsYXNzPVwiZmxleC0xIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm92ZXJmbG93LXktYXV0byBoLWZ1bGxcIj5cbiAgICAgICAgICAgICAgPExlYWRlcmJvYXJkUGFuZWwgZW50cmllcz17cHJvcHMubGVhZGVyYm9hcmR9IC8+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1RhYnNDb250ZW50PlxuICAgICAgICA8L1RhYnM+XG4gICAgICA8L1Nob3c+XG4gICAgICBcbiAgICAgIHsvKiBGaXJlIGVtb2ppIGVmZmVjdCAqL31cbiAgICAgIDxTaG93IHdoZW49e3Byb3BzLmlzUGxheWluZ30+XG4gICAgICAgIDxGaXJlRW1vamlBbmltYXRpb24gXG4gICAgICAgICAgc2NvcmU9e2dldExhdGVzdEhpZ2hTY29yZUxpbmUoKS5zY29yZX0gXG4gICAgICAgICAgbGluZUluZGV4PXtnZXRMYXRlc3RIaWdoU2NvcmVMaW5lKCkubGluZUluZGV4fVxuICAgICAgICAvPlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVDb250ZXh0LCB1c2VDb250ZXh0LCBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCwgY3JlYXRlTWVtbyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgUGFyZW50Q29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBUcmFuc2xhdGlvbnMsIExvY2FsZUNvZGUgfSBmcm9tICcuL3R5cGVzJztcblxuaW50ZXJmYWNlIEkxOG5Db250ZXh0VmFsdWUge1xuICBsb2NhbGU6ICgpID0+IExvY2FsZUNvZGU7XG4gIHNldExvY2FsZTogKGxvY2FsZTogTG9jYWxlQ29kZSkgPT4gdm9pZDtcbiAgdDogKGtleTogc3RyaW5nLCBwYXJhbXM/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBzdHJpbmc7XG4gIGRpcjogKCkgPT4gJ2x0cicgfCAncnRsJztcbiAgZm9ybWF0TnVtYmVyOiAobnVtOiBudW1iZXIpID0+IHN0cmluZztcbiAgZm9ybWF0RGF0ZTogKGRhdGU6IERhdGUsIG9wdGlvbnM/OiBJbnRsLkRhdGVUaW1lRm9ybWF0T3B0aW9ucykgPT4gc3RyaW5nO1xufVxuXG5jb25zdCBJMThuQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8STE4bkNvbnRleHRWYWx1ZT4oKTtcblxuZXhwb3J0IGNvbnN0IEkxOG5Qcm92aWRlcjogUGFyZW50Q29tcG9uZW50PHsgZGVmYXVsdExvY2FsZT86IExvY2FsZUNvZGUgfT4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2xvY2FsZSwgc2V0TG9jYWxlXSA9IGNyZWF0ZVNpZ25hbDxMb2NhbGVDb2RlPihwcm9wcy5kZWZhdWx0TG9jYWxlIHx8ICdlbicpO1xuICBjb25zdCBbdHJhbnNsYXRpb25zLCBzZXRUcmFuc2xhdGlvbnNdID0gY3JlYXRlU2lnbmFsPFRyYW5zbGF0aW9ucz4oKTtcbiAgXG4gIC8vIExvYWQgdHJhbnNsYXRpb25zIGR5bmFtaWNhbGx5XG4gIGNyZWF0ZUVmZmVjdChhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgY3VycmVudExvY2FsZSA9IGxvY2FsZSgpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBtb2R1bGUgPSBhd2FpdCBpbXBvcnQoYC4vbG9jYWxlcy8ke2N1cnJlbnRMb2NhbGV9L2luZGV4LnRzYCk7XG4gICAgICBzZXRUcmFuc2xhdGlvbnMobW9kdWxlLmRlZmF1bHQpO1xuICAgIH0gY2F0Y2ggKF9lKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEZhaWxlZCB0byBsb2FkIGxvY2FsZSAke2N1cnJlbnRMb2NhbGV9LCBmYWxsaW5nIGJhY2sgdG8gRW5nbGlzaGApO1xuICAgICAgY29uc3QgbW9kdWxlID0gYXdhaXQgaW1wb3J0KCcuL2xvY2FsZXMvZW4vaW5kZXgudHMnKTtcbiAgICAgIHNldFRyYW5zbGF0aW9ucyhtb2R1bGUuZGVmYXVsdCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBEZWVwIGtleSBhY2Nlc3Mgd2l0aCBkb3Qgbm90YXRpb25cbiAgY29uc3QgdCA9IChrZXk6IHN0cmluZywgcGFyYW1zPzogUmVjb3JkPHN0cmluZywgYW55PikgPT4ge1xuICAgIGNvbnN0IGtleXMgPSBrZXkuc3BsaXQoJy4nKTtcbiAgICBsZXQgdmFsdWU6IGFueSA9IHRyYW5zbGF0aW9ucygpO1xuICAgIFxuICAgIGZvciAoY29uc3QgayBvZiBrZXlzKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlPy5ba107XG4gICAgfVxuICAgIFxuICAgIC8vIEhhbmRsZSBwYXJhbWV0ZXIgcmVwbGFjZW1lbnRcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiBwYXJhbXMpIHtcbiAgICAgIHJldHVybiB2YWx1ZS5yZXBsYWNlKC9cXHtcXHsoXFx3KylcXH1cXH0vZywgKF8sIGspID0+IFN0cmluZyhwYXJhbXNba10gfHwgJycpKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHZhbHVlIHx8IGtleTtcbiAgfTtcblxuICAvLyBEaXJlY3Rpb24gKGZvciBSVEwgbGFuZ3VhZ2VzIGluIGZ1dHVyZSlcbiAgY29uc3QgZGlyID0gKCk6ICdsdHInIHwgJ3J0bCcgPT4gJ2x0cic7IC8vIE9ubHkgTFRSIGxhbmd1YWdlcyBzdXBwb3J0ZWQgY3VycmVudGx5XG5cbiAgLy8gTnVtYmVyIGZvcm1hdHRpbmdcbiAgY29uc3QgbnVtYmVyRm9ybWF0dGVyID0gY3JlYXRlTWVtbygoKSA9PiBcbiAgICBuZXcgSW50bC5OdW1iZXJGb3JtYXQobG9jYWxlKCkpXG4gICk7XG5cbiAgY29uc3QgZm9ybWF0TnVtYmVyID0gKG51bTogbnVtYmVyKSA9PiBudW1iZXJGb3JtYXR0ZXIoKS5mb3JtYXQobnVtKTtcblxuICAvLyBEYXRlIGZvcm1hdHRpbmdcbiAgY29uc3QgZm9ybWF0RGF0ZSA9IChkYXRlOiBEYXRlLCBvcHRpb25zPzogSW50bC5EYXRlVGltZUZvcm1hdE9wdGlvbnMpID0+IHtcbiAgICByZXR1cm4gbmV3IEludGwuRGF0ZVRpbWVGb3JtYXQobG9jYWxlKCksIG9wdGlvbnMpLmZvcm1hdChkYXRlKTtcbiAgfTtcblxuICBjb25zdCB2YWx1ZTogSTE4bkNvbnRleHRWYWx1ZSA9IHtcbiAgICBsb2NhbGUsXG4gICAgc2V0TG9jYWxlLFxuICAgIHQsXG4gICAgZGlyLFxuICAgIGZvcm1hdE51bWJlcixcbiAgICBmb3JtYXREYXRlLFxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPEkxOG5Db250ZXh0LlByb3ZpZGVyIHZhbHVlPXt2YWx1ZX0+XG4gICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgPC9JMThuQ29udGV4dC5Qcm92aWRlcj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCB1c2VJMThuID0gKCkgPT4ge1xuICBjb25zdCBjb250ZXh0ID0gdXNlQ29udGV4dChJMThuQ29udGV4dCk7XG4gIGlmICghY29udGV4dCkge1xuICAgIHRocm93IG5ldyBFcnJvcigndXNlSTE4biBtdXN0IGJlIHVzZWQgd2l0aGluIEkxOG5Qcm92aWRlcicpO1xuICB9XG4gIHJldHVybiBjb250ZXh0O1xufTsiLCJpbXBvcnQgeyBTaG93LCBjcmVhdGVNZW1vIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB0eXBlIHsgUGxheWJhY2tTcGVlZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vQnV0dG9uJztcbmltcG9ydCB7IHVzZUkxOG4gfSBmcm9tICcuLi8uLi8uLi9pMThuJztcblxuZXhwb3J0IGludGVyZmFjZSBDb21wbGV0aW9uVmlld1Byb3BzIHtcbiAgc2NvcmU6IG51bWJlcjtcbiAgcmFuazogbnVtYmVyO1xuICBzcGVlZDogUGxheWJhY2tTcGVlZDtcbiAgZmVlZGJhY2tUZXh0Pzogc3RyaW5nO1xuICBvblByYWN0aWNlPzogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBDb21wbGV0aW9uVmlldzogQ29tcG9uZW50PENvbXBsZXRpb25WaWV3UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHsgdCwgZm9ybWF0TnVtYmVyIH0gPSB1c2VJMThuKCk7XG4gIFxuICAvLyBHZXQgZmVlZGJhY2sgdGV4dCBiYXNlZCBvbiBzY29yZVxuICBjb25zdCBnZXRGZWVkYmFja1RleHQgPSBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBpZiAocHJvcHMuZmVlZGJhY2tUZXh0KSByZXR1cm4gcHJvcHMuZmVlZGJhY2tUZXh0O1xuICAgIFxuICAgIGlmIChwcm9wcy5zY29yZSA+PSA5NSkgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5wZXJmZWN0Jyk7XG4gICAgaWYgKHByb3BzLnNjb3JlID49IDg1KSByZXR1cm4gdCgna2FyYW9rZS5zY29yaW5nLmV4Y2VsbGVudCcpO1xuICAgIGlmIChwcm9wcy5zY29yZSA+PSA3MCkgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5ncmVhdCcpO1xuICAgIGlmIChwcm9wcy5zY29yZSA+PSA1MCkgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5nb29kJyk7XG4gICAgcmV0dXJuIHQoJ2thcmFva2Uuc2NvcmluZy5rZWVwUHJhY3RpY2luZycpO1xuICB9KTtcbiAgXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgaC1mdWxsIGJnLWJhc2UnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgey8qIE1haW4gY29udGVudCBhcmVhICovfVxuICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLTZcIj5cbiAgICAgICAgey8qIFNjb3JlICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgZmxleCBmbGV4LWNvbCBtYi0xMFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5IG1iLTMgb3JkZXItMVwiPnt0KCdrYXJhb2tlLnNjb3Jpbmcuc2NvcmUnKX08L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC03eGwgZm9udC1tb25vIGZvbnQtYm9sZCB0ZXh0LWFjY2VudC1wcmltYXJ5IG9yZGVyLTJcIj5cbiAgICAgICAgICAgIHtmb3JtYXROdW1iZXIocHJvcHMuc2NvcmUpfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgXG4gICAgICAgIHsvKiBTdGF0cyByb3cgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGdhcC0xMiBtYi0xMlwiPlxuICAgICAgICAgIHsvKiBSYW5rICovfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0yIG9yZGVyLTFcIj5SYW5rPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0zeGwgZm9udC1ib2xkIHRleHQtcHJpbWFyeSBvcmRlci0yXCI+I3tmb3JtYXROdW1iZXIocHJvcHMucmFuayl9PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgXG4gICAgICAgICAgey8qIFNwZWVkICovfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1sZyB0ZXh0LXNlY29uZGFyeSBtYi0yIG9yZGVyLTFcIj57dCgnY29tbW9uLnNwZWVkLmxhYmVsJyl9PC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0zeGwgZm9udC1ib2xkIHRleHQtcHJpbWFyeSBvcmRlci0yXCI+e3Byb3BzLnNwZWVkfTwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgXG4gICAgICAgIHsvKiBGZWVkYmFjayB0ZXh0ICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwibWF4LXctbWQgdGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICA8cCBjbGFzcz1cInRleHQteGwgdGV4dC1wcmltYXJ5IGxlYWRpbmctcmVsYXhlZFwiPlxuICAgICAgICAgICAge2dldEZlZWRiYWNrVGV4dCgpfVxuICAgICAgICAgIDwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgey8qIEZvb3RlciB3aXRoIHByYWN0aWNlIGJ1dHRvbiAtIHBvc2l0aW9uZWQgYXQgYm90dG9tIG9mIHdpZGdldCAqL31cbiAgICAgIDxTaG93IHdoZW49e3Byb3BzLm9uUHJhY3RpY2V9PlxuICAgICAgICA8ZGl2IGNsYXNzPVwicC00IGJnLXN1cmZhY2UgYm9yZGVyLXQgYm9yZGVyLXN1YnRsZVwiPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIHZhcmlhbnQ9XCJwcmltYXJ5XCJcbiAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uUHJhY3RpY2V9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgUHJhY3RpY2UgRXJyb3JzXG4gICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9TaG93PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIG9uQ2xlYW51cCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQXVkaW9Qcm9jZXNzb3JPcHRpb25zIH0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlS2FyYW9rZUF1ZGlvUHJvY2Vzc29yKG9wdGlvbnM/OiBBdWRpb1Byb2Nlc3Nvck9wdGlvbnMpIHtcbiAgY29uc3QgW2F1ZGlvQ29udGV4dCwgc2V0QXVkaW9Db250ZXh0XSA9IGNyZWF0ZVNpZ25hbDxBdWRpb0NvbnRleHQgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW21lZGlhU3RyZWFtLCBzZXRNZWRpYVN0cmVhbV0gPSBjcmVhdGVTaWduYWw8TWVkaWFTdHJlYW0gfCBudWxsPihudWxsKTtcbiAgY29uc3QgWywgc2V0QXVkaW9Xb3JrbGV0Tm9kZV0gPSBjcmVhdGVTaWduYWw8QXVkaW9Xb3JrbGV0Tm9kZSB8IG51bGw+KG51bGwpO1xuICBcbiAgY29uc3QgW2lzUmVhZHksIHNldElzUmVhZHldID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2Vycm9yLCBzZXRFcnJvcl0gPSBjcmVhdGVTaWduYWw8RXJyb3IgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2lzTGlzdGVuaW5nLCBzZXRJc0xpc3RlbmluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBcbiAgY29uc3QgW2N1cnJlbnRSZWNvcmRpbmdMaW5lLCBzZXRDdXJyZW50UmVjb3JkaW5nTGluZV0gPSBjcmVhdGVTaWduYWw8bnVtYmVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtyZWNvcmRlZEF1ZGlvQnVmZmVyLCBzZXRSZWNvcmRlZEF1ZGlvQnVmZmVyXSA9IGNyZWF0ZVNpZ25hbDxGbG9hdDMyQXJyYXlbXT4oW10pO1xuICBcbiAgY29uc3QgW2lzU2Vzc2lvbkFjdGl2ZSwgc2V0SXNTZXNzaW9uQWN0aXZlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtmdWxsU2Vzc2lvbkJ1ZmZlciwgc2V0RnVsbFNlc3Npb25CdWZmZXJdID0gY3JlYXRlU2lnbmFsPEZsb2F0MzJBcnJheVtdPihbXSk7XG4gIFxuICBjb25zdCBzYW1wbGVSYXRlID0gb3B0aW9ucz8uc2FtcGxlUmF0ZSB8fCAxNjAwMDtcbiAgXG4gIGNvbnN0IGluaXRpYWxpemUgPSBhc3luYyAoKSA9PiB7XG4gICAgaWYgKGF1ZGlvQ29udGV4dCgpKSByZXR1cm47XG4gICAgc2V0RXJyb3IobnVsbCk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIFxuICAgICAgY29uc3QgY3R4ID0gbmV3IEF1ZGlvQ29udGV4dCh7IHNhbXBsZVJhdGUgfSk7XG4gICAgICBzZXRBdWRpb0NvbnRleHQoY3R4KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc3RyZWFtID0gYXdhaXQgbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXRVc2VyTWVkaWEoe1xuICAgICAgICBhdWRpbzoge1xuICAgICAgICAgIHNhbXBsZVJhdGUsXG4gICAgICAgICAgY2hhbm5lbENvdW50OiAxLFxuICAgICAgICAgIGVjaG9DYW5jZWxsYXRpb246IGZhbHNlLFxuICAgICAgICAgIG5vaXNlU3VwcHJlc3Npb246IGZhbHNlLFxuICAgICAgICAgIGF1dG9HYWluQ29udHJvbDogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHNldE1lZGlhU3RyZWFtKHN0cmVhbSk7XG4gICAgICBcbiAgICAgIGF3YWl0IGN0eC5hdWRpb1dvcmtsZXQuYWRkTW9kdWxlKGNyZWF0ZUF1ZGlvV29ya2xldFByb2Nlc3NvcigpKTtcbiAgICAgIFxuICAgICAgY29uc3Qgd29ya2xldE5vZGUgPSBuZXcgQXVkaW9Xb3JrbGV0Tm9kZShjdHgsICdrYXJhb2tlLWF1ZGlvLXByb2Nlc3NvcicsIHtcbiAgICAgICAgbnVtYmVyT2ZJbnB1dHM6IDEsXG4gICAgICAgIG51bWJlck9mT3V0cHV0czogMCxcbiAgICAgICAgY2hhbm5lbENvdW50OiAxLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIHdvcmtsZXROb2RlLnBvcnQub25tZXNzYWdlID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIGlmIChldmVudC5kYXRhLnR5cGUgPT09ICdhdWRpb0RhdGEnKSB7XG4gICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gbmV3IEZsb2F0MzJBcnJheShldmVudC5kYXRhLmF1ZGlvRGF0YSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGN1cnJlbnRSZWNvcmRpbmdMaW5lKCkgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHNldFJlY29yZGVkQXVkaW9CdWZmZXIoKHByZXYpID0+IFsuLi5wcmV2LCBhdWRpb0RhdGFdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGlzU2Vzc2lvbkFjdGl2ZSgpKSB7XG4gICAgICAgICAgICBzZXRGdWxsU2Vzc2lvbkJ1ZmZlcigocHJldikgPT4gWy4uLnByZXYsIGF1ZGlvRGF0YV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIFxuICAgICAgc2V0QXVkaW9Xb3JrbGV0Tm9kZSh3b3JrbGV0Tm9kZSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHNvdXJjZSA9IGN0eC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pO1xuICAgICAgY29uc3QgZ2Fpbk5vZGUgPSBjdHguY3JlYXRlR2FpbigpO1xuICAgICAgZ2Fpbk5vZGUuZ2Fpbi52YWx1ZSA9IDEuMjtcbiAgICAgIFxuICAgICAgc291cmNlLmNvbm5lY3QoZ2Fpbk5vZGUpO1xuICAgICAgZ2Fpbk5vZGUuY29ubmVjdCh3b3JrbGV0Tm9kZSk7XG4gICAgICBcbiAgICAgIHNldElzUmVhZHkodHJ1ZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBdWRpb1Byb2Nlc3Nvcl0gRmFpbGVkIHRvIGluaXRpYWxpemU6JywgZSk7XG4gICAgICBzZXRFcnJvcihlIGluc3RhbmNlb2YgRXJyb3IgPyBlIDogbmV3IEVycm9yKCdVbmtub3duIGF1ZGlvIGluaXRpYWxpemF0aW9uIGVycm9yJykpO1xuICAgICAgc2V0SXNSZWFkeShmYWxzZSk7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgY3JlYXRlQXVkaW9Xb3JrbGV0UHJvY2Vzc29yID0gKCkgPT4ge1xuICAgIGNvbnN0IHByb2Nlc3NvckNvZGUgPSBgXG4gICAgICBjbGFzcyBLYXJhb2tlQXVkaW9Qcm9jZXNzb3IgZXh0ZW5kcyBBdWRpb1dvcmtsZXRQcm9jZXNzb3Ige1xuICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICBzdXBlcigpO1xuICAgICAgICAgIHRoaXMuYnVmZmVyU2l6ZSA9IDEwMjQ7XG4gICAgICAgICAgdGhpcy5ybXNIaXN0b3J5ID0gW107XG4gICAgICAgICAgdGhpcy5tYXhIaXN0b3J5TGVuZ3RoID0gMTA7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9jZXNzKGlucHV0cywgb3V0cHV0cywgcGFyYW1ldGVycykge1xuICAgICAgICAgIGNvbnN0IGlucHV0ID0gaW5wdXRzWzBdO1xuICAgICAgICAgIGlmIChpbnB1dCAmJiBpbnB1dFswXSkge1xuICAgICAgICAgICAgY29uc3QgaW5wdXREYXRhID0gaW5wdXRbMF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBzdW0gPSAwO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dERhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgc3VtICs9IGlucHV0RGF0YVtpXSAqIGlucHV0RGF0YVtpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHJtcyA9IE1hdGguc3FydChzdW0gLyBpbnB1dERhdGEubGVuZ3RoKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5ybXNIaXN0b3J5LnB1c2gocm1zKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnJtc0hpc3RvcnkubGVuZ3RoID4gdGhpcy5tYXhIaXN0b3J5TGVuZ3RoKSB7XG4gICAgICAgICAgICAgIHRoaXMucm1zSGlzdG9yeS5zaGlmdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBhdmdSbXMgPSB0aGlzLnJtc0hpc3RvcnkucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCkgLyB0aGlzLnJtc0hpc3RvcnkubGVuZ3RoO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLnBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICB0eXBlOiAnYXVkaW9EYXRhJyxcbiAgICAgICAgICAgICAgYXVkaW9EYXRhOiBpbnB1dERhdGEsXG4gICAgICAgICAgICAgIHJtc0xldmVsOiBybXMsXG4gICAgICAgICAgICAgIGF2Z1Jtc0xldmVsOiBhdmdSbXMsXG4gICAgICAgICAgICAgIGlzVG9vUXVpZXQ6IGF2Z1JtcyA8IDAuMDEsXG4gICAgICAgICAgICAgIGlzVG9vTG91ZDogYXZnUm1zID4gMC4zXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJlZ2lzdGVyUHJvY2Vzc29yKCdrYXJhb2tlLWF1ZGlvLXByb2Nlc3NvcicsIEthcmFva2VBdWRpb1Byb2Nlc3Nvcik7XG4gICAgYDtcbiAgICBcbiAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW3Byb2Nlc3NvckNvZGVdLCB7IHR5cGU6ICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JyB9KTtcbiAgICByZXR1cm4gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgfTtcbiAgXG4gIGNvbnN0IHN0YXJ0TGlzdGVuaW5nID0gKCkgPT4ge1xuICAgIGNvbnN0IGN0eCA9IGF1ZGlvQ29udGV4dCgpO1xuICAgIGlmIChjdHggJiYgY3R4LnN0YXRlID09PSAnc3VzcGVuZGVkJykge1xuICAgICAgY3R4LnJlc3VtZSgpO1xuICAgIH1cbiAgICBzZXRJc0xpc3RlbmluZyh0cnVlKTtcbiAgfTtcbiAgXG4gIGNvbnN0IHBhdXNlTGlzdGVuaW5nID0gKCkgPT4ge1xuICAgIGNvbnN0IGN0eCA9IGF1ZGlvQ29udGV4dCgpO1xuICAgIGlmIChjdHggJiYgY3R4LnN0YXRlID09PSAncnVubmluZycpIHtcbiAgICAgIGN0eC5zdXNwZW5kKCk7XG4gICAgfVxuICAgIHNldElzTGlzdGVuaW5nKGZhbHNlKTtcbiAgfTtcbiAgXG4gIGNvbnN0IGNsZWFudXAgPSAoKSA9PiB7XG4gICAgXG4gICAgY29uc3Qgc3RyZWFtID0gbWVkaWFTdHJlYW0oKTtcbiAgICBpZiAoc3RyZWFtKSB7XG4gICAgICBzdHJlYW0uZ2V0VHJhY2tzKCkuZm9yRWFjaCgodHJhY2spID0+IHRyYWNrLnN0b3AoKSk7XG4gICAgICBzZXRNZWRpYVN0cmVhbShudWxsKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgY3R4ID0gYXVkaW9Db250ZXh0KCk7XG4gICAgaWYgKGN0eCAmJiBjdHguc3RhdGUgIT09ICdjbG9zZWQnKSB7XG4gICAgICBjdHguY2xvc2UoKTtcbiAgICAgIHNldEF1ZGlvQ29udGV4dChudWxsKTtcbiAgICB9XG4gICAgXG4gICAgc2V0QXVkaW9Xb3JrbGV0Tm9kZShudWxsKTtcbiAgICBzZXRJc1JlYWR5KGZhbHNlKTtcbiAgICBzZXRJc0xpc3RlbmluZyhmYWxzZSk7XG4gIH07XG4gIFxuICBvbkNsZWFudXAoY2xlYW51cCk7XG4gIFxuICBjb25zdCBzdGFydFJlY29yZGluZ0xpbmUgPSAobGluZUluZGV4OiBudW1iZXIpID0+IHtcbiAgICBcbiAgICBzZXRDdXJyZW50UmVjb3JkaW5nTGluZShsaW5lSW5kZXgpO1xuICAgIHNldFJlY29yZGVkQXVkaW9CdWZmZXIoW10pO1xuICAgIFxuICAgIGlmIChpc1JlYWR5KCkgJiYgIWlzTGlzdGVuaW5nKCkpIHtcbiAgICAgIHN0YXJ0TGlzdGVuaW5nKCk7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3Qgc3RvcFJlY29yZGluZ0xpbmVBbmRHZXRSYXdBdWRpbyA9ICgpOiBGbG9hdDMyQXJyYXlbXSA9PiB7XG4gICAgY29uc3QgbGluZUluZGV4ID0gY3VycmVudFJlY29yZGluZ0xpbmUoKTtcbiAgICBpZiAobGluZUluZGV4ID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGF1ZGlvQnVmZmVyID0gcmVjb3JkZWRBdWRpb0J1ZmZlcigpO1xuICAgIFxuICAgIHNldEN1cnJlbnRSZWNvcmRpbmdMaW5lKG51bGwpO1xuICAgIFxuICAgIGNvbnN0IHJlc3VsdCA9IFsuLi5hdWRpb0J1ZmZlcl07XG4gICAgc2V0UmVjb3JkZWRBdWRpb0J1ZmZlcihbXSk7XG4gICAgXG4gICAgaWYgKHJlc3VsdC5sZW5ndGggPT09IDApIHtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcbiAgXG4gIGNvbnN0IGNvbnZlcnRBdWRpb1RvV2F2QmxvYiA9IChhdWRpb0NodW5rczogRmxvYXQzMkFycmF5W10pOiBCbG9iIHwgbnVsbCA9PiB7XG4gICAgaWYgKGF1ZGlvQ2h1bmtzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG4gICAgXG4gICAgY29uc3QgdG90YWxMZW5ndGggPSBhdWRpb0NodW5rcy5yZWR1Y2UoKHN1bSwgY2h1bmspID0+IHN1bSArIGNodW5rLmxlbmd0aCwgMCk7XG4gICAgY29uc3QgY29uY2F0ZW5hdGVkID0gbmV3IEZsb2F0MzJBcnJheSh0b3RhbExlbmd0aCk7XG4gICAgbGV0IG9mZnNldCA9IDA7XG4gICAgZm9yIChjb25zdCBjaHVuayBvZiBhdWRpb0NodW5rcykge1xuICAgICAgY29uY2F0ZW5hdGVkLnNldChjaHVuaywgb2Zmc2V0KTtcbiAgICAgIG9mZnNldCArPSBjaHVuay5sZW5ndGg7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBhdWRpb0J1ZmZlclRvV2F2KGNvbmNhdGVuYXRlZCwgc2FtcGxlUmF0ZSk7XG4gIH07XG4gIFxuICBjb25zdCBhdWRpb0J1ZmZlclRvV2F2ID0gKGJ1ZmZlcjogRmxvYXQzMkFycmF5LCBzYW1wbGVSYXRlOiBudW1iZXIpOiBCbG9iID0+IHtcbiAgICBjb25zdCBsZW5ndGggPSBidWZmZXIubGVuZ3RoO1xuICAgIGNvbnN0IGFycmF5QnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKDQ0ICsgbGVuZ3RoICogMik7XG4gICAgY29uc3QgdmlldyA9IG5ldyBEYXRhVmlldyhhcnJheUJ1ZmZlcik7XG4gICAgXG4gICAgY29uc3Qgd3JpdGVTdHJpbmcgPSAob2Zmc2V0OiBudW1iZXIsIHN0cmluZzogc3RyaW5nKSA9PiB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0cmluZy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2aWV3LnNldFVpbnQ4KG9mZnNldCArIGksIHN0cmluZy5jaGFyQ29kZUF0KGkpKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIHdyaXRlU3RyaW5nKDAsICdSSUZGJyk7XG4gICAgdmlldy5zZXRVaW50MzIoNCwgMzYgKyBsZW5ndGggKiAyLCB0cnVlKTtcbiAgICB3cml0ZVN0cmluZyg4LCAnV0FWRScpO1xuICAgIHdyaXRlU3RyaW5nKDEyLCAnZm10ICcpO1xuICAgIHZpZXcuc2V0VWludDMyKDE2LCAxNiwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMjAsIDEsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDIyLCAxLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQzMigyNCwgc2FtcGxlUmF0ZSwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MzIoMjgsIHNhbXBsZVJhdGUgKiAyLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigzMiwgMiwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMzQsIDE2LCB0cnVlKTtcbiAgICB3cml0ZVN0cmluZygzNiwgJ2RhdGEnKTtcbiAgICB2aWV3LnNldFVpbnQzMig0MCwgbGVuZ3RoICogMiwgdHJ1ZSk7XG4gICAgXG4gICAgY29uc3Qgb2Zmc2V0ID0gNDQ7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgc2FtcGxlID0gTWF0aC5tYXgoLTEsIE1hdGgubWluKDEsIGJ1ZmZlcltpXSB8fCAwKSk7XG4gICAgICB2aWV3LnNldEludDE2KG9mZnNldCArIGkgKiAyLCBzYW1wbGUgKiAweDdmZmYsIHRydWUpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbmV3IEJsb2IoW2FycmF5QnVmZmVyXSwgeyB0eXBlOiAnYXVkaW8vd2F2JyB9KTtcbiAgfTtcbiAgXG4gIGNvbnN0IHN0YXJ0RnVsbFNlc3Npb24gPSAoKSA9PiB7XG4gICAgc2V0RnVsbFNlc3Npb25CdWZmZXIoW10pO1xuICAgIHNldElzU2Vzc2lvbkFjdGl2ZSh0cnVlKTtcbiAgfTtcbiAgXG4gIGNvbnN0IHN0b3BGdWxsU2Vzc2lvbkFuZEdldFdhdiA9ICgpOiBCbG9iIHwgbnVsbCA9PiB7XG4gICAgc2V0SXNTZXNzaW9uQWN0aXZlKGZhbHNlKTtcbiAgICBcbiAgICBjb25zdCBzZXNzaW9uQ2h1bmtzID0gZnVsbFNlc3Npb25CdWZmZXIoKTtcbiAgICBjb25zdCB3YXZCbG9iID0gY29udmVydEF1ZGlvVG9XYXZCbG9iKHNlc3Npb25DaHVua3MpO1xuICAgIFxuICAgIFxuICAgIHNldEZ1bGxTZXNzaW9uQnVmZmVyKFtdKTtcbiAgICBcbiAgICByZXR1cm4gd2F2QmxvYjtcbiAgfTtcbiAgXG4gIHJldHVybiB7XG4gICAgaXNSZWFkeSxcbiAgICBlcnJvcixcbiAgICBpc0xpc3RlbmluZyxcbiAgICBpc1Nlc3Npb25BY3RpdmUsXG4gICAgXG4gICAgaW5pdGlhbGl6ZSxcbiAgICBzdGFydExpc3RlbmluZyxcbiAgICBwYXVzZUxpc3RlbmluZyxcbiAgICBjbGVhbnVwLFxuICAgIHN0YXJ0UmVjb3JkaW5nTGluZSxcbiAgICBzdG9wUmVjb3JkaW5nTGluZUFuZEdldFJhd0F1ZGlvLFxuICAgIGNvbnZlcnRBdWRpb1RvV2F2QmxvYixcbiAgICBcbiAgICBzdGFydEZ1bGxTZXNzaW9uLFxuICAgIHN0b3BGdWxsU2Vzc2lvbkFuZEdldFdhdixcbiAgfTtcbn0iLCJpbXBvcnQgdHlwZSB7XG4gIEFwaVJlc3BvbnNlLFxuICBTdGFydFNlc3Npb25SZXF1ZXN0LFxuICBHcmFkZUxpbmVSZXF1ZXN0LFxuICBDb21wbGV0ZVNlc3Npb25SZXF1ZXN0LFxuICBUcmFuc2NyaWJlUmVxdWVzdCxcbiAgVHJhbnNjcmliZVJlc3BvbnNlLFxuICBLYXJhb2tlRGF0YSxcbiAgS2FyYW9rZVNlc3Npb24sXG4gIExpbmVTY29yZSxcbiAgU2Vzc2lvblJlc3VsdHMsXG4gIERlbW9Ub2tlblJlc3BvbnNlLFxuICBVc2VyQ3JlZGl0c1Jlc3BvbnNlLFxuICBQdXJjaGFzZUNyZWRpdHNSZXF1ZXN0LFxuICBQdXJjaGFzZUNyZWRpdHNSZXNwb25zZSxcbiAgRXhlcmNpc2UsXG4gIFByYWN0aWNlQ2FyZCxcbn0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEFwaUNsaWVudENvbmZpZyB7XG4gIGJhc2VVcmw6IHN0cmluZztcbiAgZ2V0QXV0aFRva2VuPzogKCkgPT4gUHJvbWlzZTxzdHJpbmcgfCBudWxsPjtcbiAgb25FcnJvcj86IChlcnJvcjogRXJyb3IpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBBcGlDbGllbnQge1xuICBwcml2YXRlIGJhc2VVcmw6IHN0cmluZztcbiAgcHJpdmF0ZSBnZXRBdXRoVG9rZW4/OiAoKSA9PiBQcm9taXNlPHN0cmluZyB8IG51bGw+O1xuICBwcml2YXRlIG9uRXJyb3I/OiAoZXJyb3I6IEVycm9yKSA9PiB2b2lkO1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogQXBpQ2xpZW50Q29uZmlnKSB7XG4gICAgdGhpcy5iYXNlVXJsID0gY29uZmlnLmJhc2VVcmwucmVwbGFjZSgvXFwvJC8sICcnKTsgLy8gUmVtb3ZlIHRyYWlsaW5nIHNsYXNoXG4gICAgdGhpcy5nZXRBdXRoVG9rZW4gPSBjb25maWcuZ2V0QXV0aFRva2VuO1xuICAgIHRoaXMub25FcnJvciA9IGNvbmZpZy5vbkVycm9yO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZXF1ZXN0PFQ+KFxuICAgIHBhdGg6IHN0cmluZyxcbiAgICBvcHRpb25zOiBSZXF1ZXN0SW5pdCA9IHt9XG4gICk6IFByb21pc2U8VD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAuLi4ob3B0aW9ucy5oZWFkZXJzIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfHwge30pLFxuICAgICAgfTtcblxuICAgICAgLy8gQWRkIGF1dGggdG9rZW4gaWYgYXZhaWxhYmxlXG4gICAgICBpZiAodGhpcy5nZXRBdXRoVG9rZW4pIHtcbiAgICAgICAgY29uc3QgdG9rZW4gPSBhd2FpdCB0aGlzLmdldEF1dGhUb2tlbigpO1xuICAgICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgICBoZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSBgQmVhcmVyICR7dG9rZW59YDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuYmFzZVVybH0ke3BhdGh9YCwge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBoZWFkZXJzLFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQVBJIEVycm9yICR7cmVzcG9uc2Uuc3RhdHVzfTogJHtlcnJvcn1gKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGF3YWl0IHJlc3BvbnNlLmpzb24oKSBhcyBUO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBpZiAodGhpcy5vbkVycm9yKSB7XG4gICAgICAgIHRoaXMub25FcnJvcihlcnJvciBhcyBFcnJvcik7XG4gICAgICB9XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvLyBIZWFsdGggY2hlY2tcbiAgYXN5bmMgaGVhbHRoQ2hlY2soKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnL2hlYWx0aCcpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLy8gQXV0aCBlbmRwb2ludHNcbiAgYXN5bmMgZ2V0RGVtb1Rva2VuKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJlcXVlc3Q8RGVtb1Rva2VuUmVzcG9uc2U+KCcvYXV0aC9kZW1vJywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3BvbnNlLnRva2VuO1xuICB9XG5cbiAgYXN5bmMgZ2V0VXNlckNyZWRpdHMoKTogUHJvbWlzZTxVc2VyQ3JlZGl0c1Jlc3BvbnNlPiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxVc2VyQ3JlZGl0c1Jlc3BvbnNlPignL2FwaS91c2VyL2NyZWRpdHMnKTtcbiAgfVxuXG4gIGFzeW5jIHB1cmNoYXNlQ3JlZGl0cyhcbiAgICByZXF1ZXN0OiBQdXJjaGFzZUNyZWRpdHNSZXF1ZXN0XG4gICk6IFByb21pc2U8UHVyY2hhc2VDcmVkaXRzUmVzcG9uc2U+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFB1cmNoYXNlQ3JlZGl0c1Jlc3BvbnNlPignL2FwaS91c2VyL2NyZWRpdHMvcHVyY2hhc2UnLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gS2FyYW9rZSBlbmRwb2ludHNcbiAgYXN5bmMgZ2V0S2FyYW9rZURhdGEodHJhY2tJZDogc3RyaW5nKTogUHJvbWlzZTxLYXJhb2tlRGF0YT4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8S2FyYW9rZURhdGE+KGAvYXBpL2thcmFva2UvJHtlbmNvZGVVUklDb21wb25lbnQodHJhY2tJZCl9YCk7XG4gIH1cblxuICBhc3luYyBzdGFydEthcmFva2VTZXNzaW9uKFxuICAgIHJlcXVlc3Q6IFN0YXJ0U2Vzc2lvblJlcXVlc3RcbiAgKTogUHJvbWlzZTxBcGlSZXNwb25zZTxLYXJhb2tlU2Vzc2lvbj4+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFwaVJlc3BvbnNlPEthcmFva2VTZXNzaW9uPj4oJy9hcGkva2FyYW9rZS9zdGFydCcsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVxdWVzdCksXG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBncmFkZUthcmFva2VMaW5lKFxuICAgIHJlcXVlc3Q6IEdyYWRlTGluZVJlcXVlc3RcbiAgKTogUHJvbWlzZTxBcGlSZXNwb25zZTxMaW5lU2NvcmU+PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBcGlSZXNwb25zZTxMaW5lU2NvcmU+PignL2FwaS9rYXJhb2tlL2dyYWRlJywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSxcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIGNvbXBsZXRlS2FyYW9rZVNlc3Npb24oXG4gICAgcmVxdWVzdDogQ29tcGxldGVTZXNzaW9uUmVxdWVzdFxuICApOiBQcm9taXNlPEFwaVJlc3BvbnNlPFNlc3Npb25SZXN1bHRzPj4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QXBpUmVzcG9uc2U8U2Vzc2lvblJlc3VsdHM+PignL2FwaS9rYXJhb2tlL2NvbXBsZXRlJywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFNwZWVjaC10by10ZXh0IGVuZHBvaW50c1xuICBhc3luYyB0cmFuc2NyaWJlQXVkaW8oXG4gICAgcmVxdWVzdDogVHJhbnNjcmliZVJlcXVlc3RcbiAgKTogUHJvbWlzZTxUcmFuc2NyaWJlUmVzcG9uc2U+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFRyYW5zY3JpYmVSZXNwb25zZT4oJy9hcGkvc3BlZWNoLXRvLXRleHQvdHJhbnNjcmliZScsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVxdWVzdCksXG4gICAgfSk7XG4gIH1cblxuICAvLyBQcmFjdGljZSBlbmRwb2ludHNcbiAgYXN5bmMgZ2V0UHJhY3RpY2VFeGVyY2lzZXMoXG4gICAgc2Vzc2lvbklkPzogc3RyaW5nLFxuICAgIGxpbWl0ID0gMTBcbiAgKTogUHJvbWlzZTxBcGlSZXNwb25zZTx7IGV4ZXJjaXNlczogRXhlcmNpc2VbXTsgY2FyZHM6IFByYWN0aWNlQ2FyZFtdIH0+PiB7XG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xuICAgIGlmIChzZXNzaW9uSWQpIHBhcmFtcy5hcHBlbmQoJ3Nlc3Npb25JZCcsIHNlc3Npb25JZCk7XG4gICAgcGFyYW1zLmFwcGVuZCgnbGltaXQnLCBsaW1pdC50b1N0cmluZygpKTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QXBpUmVzcG9uc2U8eyBleGVyY2lzZXM6IEV4ZXJjaXNlW107IGNhcmRzOiBQcmFjdGljZUNhcmRbXSB9Pj4oXG4gICAgICBgL2FwaS9wcmFjdGljZS9leGVyY2lzZXM/JHtwYXJhbXN9YFxuICAgICk7XG4gIH1cblxuICBhc3luYyBzdWJtaXRQcmFjdGljZVJldmlldyhcbiAgICBjYXJkSWQ6IHN0cmluZyxcbiAgICBzY29yZTogbnVtYmVyLFxuICAgIHJldmlld1RpbWU6IHN0cmluZ1xuICApOiBQcm9taXNlPEFwaVJlc3BvbnNlPiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBcGlSZXNwb25zZT4oJy9hcGkvcHJhY3RpY2UvcmV2aWV3Jywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGNhcmRJZCwgc2NvcmUsIHJldmlld1RpbWUgfSksXG4gICAgfSk7XG4gIH1cblxuICAvLyBVc2VyIGVuZHBvaW50c1xuICBhc3luYyBnZXRVc2VyQmVzdFNjb3JlKHNvbmdJZDogc3RyaW5nKTogUHJvbWlzZTxBcGlSZXNwb25zZTx7IHNjb3JlOiBudW1iZXIgfT4+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFwaVJlc3BvbnNlPHsgc2NvcmU6IG51bWJlciB9Pj4oXG4gICAgICBgL2FwaS91c2Vycy9tZS9zb25ncy8ke3NvbmdJZH0vYmVzdC1zY29yZWBcbiAgICApO1xuICB9XG5cbiAgLy8gTGVhZGVyYm9hcmQgZW5kcG9pbnRzXG4gIGFzeW5jIGdldFNvbmdMZWFkZXJib2FyZChcbiAgICBzb25nSWQ6IHN0cmluZyxcbiAgICBsaW1pdCA9IDEwXG4gICk6IFByb21pc2U8QXBpUmVzcG9uc2U8QXJyYXk8eyB1c2VySWQ6IHN0cmluZzsgc2NvcmU6IG51bWJlcjsgcmFuazogbnVtYmVyIH0+Pj4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QXBpUmVzcG9uc2U8QXJyYXk8eyB1c2VySWQ6IHN0cmluZzsgc2NvcmU6IG51bWJlcjsgcmFuazogbnVtYmVyIH0+Pj4oXG4gICAgICBgL2FwaS9zb25ncy8ke3NvbmdJZH0vbGVhZGVyYm9hcmQ/bGltaXQ9JHtsaW1pdH1gXG4gICAgKTtcbiAgfVxufSIsImltcG9ydCB0eXBlIHsgQXBpQ2xpZW50IH0gZnJvbSAnLi4vY2xpZW50JztcbmltcG9ydCB0eXBlIHtcbiAgS2FyYW9rZURhdGEsXG4gIEthcmFva2VTZXNzaW9uLFxuICBMaW5lU2NvcmUsXG4gIFNlc3Npb25SZXN1bHRzLFxuICBBcGlSZXNwb25zZSxcbn0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuXG5leHBvcnQgY2xhc3MgS2FyYW9rZUVuZHBvaW50IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBjbGllbnQ6IEFwaUNsaWVudCkge31cblxuICAvKipcbiAgICogRmV0Y2gga2FyYW9rZSBkYXRhIGZvciBhIHRyYWNrXG4gICAqL1xuICBhc3luYyBnZXREYXRhKHRyYWNrSWQ6IHN0cmluZyk6IFByb21pc2U8S2FyYW9rZURhdGE+IHtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZ2V0S2FyYW9rZURhdGEodHJhY2tJZCk7XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgYSBuZXcga2FyYW9rZSBzZXNzaW9uXG4gICAqL1xuICBhc3luYyBzdGFydFNlc3Npb24oXG4gICAgdHJhY2tJZDogc3RyaW5nLFxuICAgIHNvbmdEYXRhOiB7XG4gICAgICB0aXRsZTogc3RyaW5nO1xuICAgICAgYXJ0aXN0OiBzdHJpbmc7XG4gICAgICBnZW5pdXNJZD86IHN0cmluZztcbiAgICAgIGR1cmF0aW9uPzogbnVtYmVyO1xuICAgICAgZGlmZmljdWx0eT86IHN0cmluZztcbiAgICB9LFxuICAgIHNvbmdDYXRhbG9nSWQ/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxLYXJhb2tlU2Vzc2lvbj4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuc3RhcnRLYXJhb2tlU2Vzc2lvbih7XG4gICAgICB0cmFja0lkLFxuICAgICAgc29uZ0RhdGEsXG4gICAgICBzb25nQ2F0YWxvZ0lkLFxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXNwb25zZS5zdWNjZXNzIHx8ICFyZXNwb25zZS5kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IocmVzcG9uc2UuZXJyb3IgfHwgJ0ZhaWxlZCB0byBzdGFydCBzZXNzaW9uJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gIH1cblxuICAvKipcbiAgICogR3JhZGUgYSBrYXJhb2tlIGxpbmUgcmVjb3JkaW5nXG4gICAqL1xuICBhc3luYyBncmFkZUxpbmUoXG4gICAgc2Vzc2lvbklkOiBzdHJpbmcsXG4gICAgbGluZUluZGV4OiBudW1iZXIsXG4gICAgYXVkaW9CYXNlNjQ6IHN0cmluZyxcbiAgICBleHBlY3RlZFRleHQ6IHN0cmluZyxcbiAgICBzdGFydFRpbWU6IG51bWJlcixcbiAgICBlbmRUaW1lOiBudW1iZXJcbiAgKTogUHJvbWlzZTxMaW5lU2NvcmU+IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LmdyYWRlS2FyYW9rZUxpbmUoe1xuICAgICAgc2Vzc2lvbklkLFxuICAgICAgbGluZUluZGV4LFxuICAgICAgYXVkaW9CdWZmZXI6IGF1ZGlvQmFzZTY0LFxuICAgICAgZXhwZWN0ZWRUZXh0LFxuICAgICAgc3RhcnRUaW1lLFxuICAgICAgZW5kVGltZSxcbiAgICB9KTtcblxuICAgIGlmICghcmVzcG9uc2Uuc3VjY2VzcyB8fCAhcmVzcG9uc2UuZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHJlc3BvbnNlLmVycm9yIHx8ICdGYWlsZWQgdG8gZ3JhZGUgbGluZScpO1xuICAgIH1cblxuICAgIHJldHVybiByZXNwb25zZS5kYXRhO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbXBsZXRlIGEga2FyYW9rZSBzZXNzaW9uXG4gICAqL1xuICBhc3luYyBjb21wbGV0ZVNlc3Npb24oXG4gICAgc2Vzc2lvbklkOiBzdHJpbmcsXG4gICAgZnVsbEF1ZGlvQmFzZTY0Pzogc3RyaW5nXG4gICk6IFByb21pc2U8U2Vzc2lvblJlc3VsdHM+IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LmNvbXBsZXRlS2FyYW9rZVNlc3Npb24oe1xuICAgICAgc2Vzc2lvbklkLFxuICAgICAgZnVsbEF1ZGlvQnVmZmVyOiBmdWxsQXVkaW9CYXNlNjQsXG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLnN1Y2Nlc3MgfHwgIXJlc3BvbnNlLmRhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihyZXNwb25zZS5lcnJvciB8fCAnRmFpbGVkIHRvIGNvbXBsZXRlIHNlc3Npb24nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcbiAgfVxufSIsImltcG9ydCB0eXBlIHsgQXBpQ2xpZW50IH0gZnJvbSAnLi4vY2xpZW50JztcbmltcG9ydCB0eXBlIHsgRXhlcmNpc2UsIFByYWN0aWNlQ2FyZCB9IGZyb20gJ0BzY2FybGV0dC9jb3JlJztcblxuZXhwb3J0IGNsYXNzIFByYWN0aWNlRW5kcG9pbnQge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGNsaWVudDogQXBpQ2xpZW50KSB7fVxuXG4gIC8qKlxuICAgKiBHZXQgcHJhY3RpY2UgZXhlcmNpc2VzIGZvciBhIHVzZXJcbiAgICovXG4gIGFzeW5jIGdldEV4ZXJjaXNlcyhcbiAgICBzZXNzaW9uSWQ/OiBzdHJpbmcsXG4gICAgbGltaXQgPSAxMFxuICApOiBQcm9taXNlPHsgZXhlcmNpc2VzOiBFeGVyY2lzZVtdOyBjYXJkczogUHJhY3RpY2VDYXJkW10gfT4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuZ2V0UHJhY3RpY2VFeGVyY2lzZXMoc2Vzc2lvbklkLCBsaW1pdCk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLnN1Y2Nlc3MgfHwgIXJlc3BvbnNlLmRhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihyZXNwb25zZS5lcnJvciB8fCAnRmFpbGVkIHRvIGZldGNoIGV4ZXJjaXNlcycpO1xuICAgIH1cblxuICAgIHJldHVybiByZXNwb25zZS5kYXRhO1xuICB9XG5cbiAgLyoqXG4gICAqIFN1Ym1pdCBhIHByYWN0aWNlIHJldmlld1xuICAgKi9cbiAgYXN5bmMgc3VibWl0UmV2aWV3KFxuICAgIGNhcmRJZDogc3RyaW5nLFxuICAgIHNjb3JlOiBudW1iZXIsXG4gICAgcmV2aWV3VGltZTogc3RyaW5nID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuc3VibWl0UHJhY3RpY2VSZXZpZXcoXG4gICAgICBjYXJkSWQsXG4gICAgICBzY29yZSxcbiAgICAgIHJldmlld1RpbWVcbiAgICApO1xuXG4gICAgaWYgKCFyZXNwb25zZS5zdWNjZXNzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IocmVzcG9uc2UuZXJyb3IgfHwgJ0ZhaWxlZCB0byBzdWJtaXQgcmV2aWV3Jyk7XG4gICAgfVxuICB9XG59IiwiaW1wb3J0IHR5cGUgeyBBcGlDbGllbnQgfSBmcm9tICcuLi9jbGllbnQnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRyYW5zY3JpcHRpb25SZXN1bHQge1xuICB0cmFuc2NyaXB0OiBzdHJpbmc7XG4gIGNvbmZpZGVuY2U6IG51bWJlcjtcbiAgcHJvdmlkZXI/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTVFRFbmRwb2ludCB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY2xpZW50OiBBcGlDbGllbnQpIHt9XG5cbiAgLyoqXG4gICAqIFRyYW5zY3JpYmUgYXVkaW8gdXNpbmcgc3BlZWNoLXRvLXRleHRcbiAgICovXG4gIGFzeW5jIHRyYW5zY3JpYmUoXG4gICAgYXVkaW9CYXNlNjQ6IHN0cmluZyxcbiAgICBleHBlY3RlZFRleHQ/OiBzdHJpbmcsXG4gICAgcHJlZmVyRGVlcGdyYW0gPSBmYWxzZVxuICApOiBQcm9taXNlPFRyYW5zY3JpcHRpb25SZXN1bHQ+IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LnRyYW5zY3JpYmVBdWRpbyh7XG4gICAgICBhdWRpb0Jhc2U2NCxcbiAgICAgIGV4cGVjdGVkVGV4dCxcbiAgICAgIHByZWZlckRlZXBncmFtLFxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXNwb25zZS5zdWNjZXNzIHx8ICFyZXNwb25zZS5kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IocmVzcG9uc2UuZXJyb3IgfHwgJ0ZhaWxlZCB0byB0cmFuc2NyaWJlIGF1ZGlvJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gIH1cblxuICAvKipcbiAgICogVHJhbnNjcmliZSB3aXRoIHJldHJ5IGxvZ2ljXG4gICAqL1xuICBhc3luYyB0cmFuc2NyaWJlV2l0aFJldHJ5KFxuICAgIGF1ZGlvQmFzZTY0OiBzdHJpbmcsXG4gICAgZXhwZWN0ZWRUZXh0Pzogc3RyaW5nLFxuICAgIG1heFJldHJpZXMgPSAyXG4gICk6IFByb21pc2U8VHJhbnNjcmlwdGlvblJlc3VsdD4ge1xuICAgIGxldCBsYXN0RXJyb3I6IEVycm9yIHwgbnVsbCA9IG51bGw7XG5cbiAgICBmb3IgKGxldCBhdHRlbXB0ID0gMTsgYXR0ZW1wdCA8PSBtYXhSZXRyaWVzOyBhdHRlbXB0KyspIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSBFbGV2ZW5MYWJzIGZpcnN0XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMudHJhbnNjcmliZShcbiAgICAgICAgICBhdWRpb0Jhc2U2NCxcbiAgICAgICAgICBleHBlY3RlZFRleHQsXG4gICAgICAgICAgZmFsc2VcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxhc3RFcnJvciA9IGVycm9yIGFzIEVycm9yO1xuICAgICAgICBjb25zb2xlLmxvZyhgW1NUVF0gQXR0ZW1wdCAke2F0dGVtcHR9LyR7bWF4UmV0cmllc30gZmFpbGVkOmAsIGVycm9yKTtcblxuICAgICAgICAvLyBJZiBmaXJzdCBhdHRlbXB0IGZhaWxlZCwgdHJ5IHdpdGggRGVlcGdyYW1cbiAgICAgICAgaWYgKGF0dGVtcHQgPT09IDEpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tTVFRdIFJldHJ5aW5nIHdpdGggRGVlcGdyYW0uLi4nKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMudHJhbnNjcmliZShcbiAgICAgICAgICAgICAgYXVkaW9CYXNlNjQsXG4gICAgICAgICAgICAgIGV4cGVjdGVkVGV4dCxcbiAgICAgICAgICAgICAgdHJ1ZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgfSBjYXRjaCAoZGVlcGdyYW1FcnJvcikge1xuICAgICAgICAgICAgbGFzdEVycm9yID0gZGVlcGdyYW1FcnJvciBhcyBFcnJvcjtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tTVFRdIERlZXBncmFtIGFsc28gZmFpbGVkOicsIGRlZXBncmFtRXJyb3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRocm93IGxhc3RFcnJvciB8fCBuZXcgRXJyb3IoJ1NUVCBmYWlsZWQgYWZ0ZXIgcmV0cmllcycpO1xuICB9XG59IiwiaW1wb3J0IHR5cGUgeyBBcGlDbGllbnQgfSBmcm9tICcuLi9jbGllbnQnO1xuaW1wb3J0IHR5cGUge1xuICBVc2VyQ3JlZGl0c1Jlc3BvbnNlLFxuICBQdXJjaGFzZUNyZWRpdHNSZXF1ZXN0LFxuICBQdXJjaGFzZUNyZWRpdHNSZXNwb25zZSxcbn0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuXG5leHBvcnQgY2xhc3MgQXV0aEVuZHBvaW50IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBjbGllbnQ6IEFwaUNsaWVudCkge31cblxuICAvKipcbiAgICogR2V0IGEgZGVtbyBhdXRoZW50aWNhdGlvbiB0b2tlblxuICAgKi9cbiAgYXN5bmMgZ2V0RGVtb1Rva2VuKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LmdldERlbW9Ub2tlbigpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBjdXJyZW50IHVzZXIgY3JlZGl0c1xuICAgKi9cbiAgYXN5bmMgZ2V0VXNlckNyZWRpdHMoKTogUHJvbWlzZTxVc2VyQ3JlZGl0c1Jlc3BvbnNlPiB7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LmdldFVzZXJDcmVkaXRzKCk7XG4gIH1cblxuICAvKipcbiAgICogUHVyY2hhc2UgY3JlZGl0c1xuICAgKi9cbiAgYXN5bmMgcHVyY2hhc2VDcmVkaXRzKFxuICAgIGZpZDogbnVtYmVyLFxuICAgIGNyZWRpdHM6IG51bWJlcixcbiAgICBjaGFpbjogJ0Jhc2UnIHwgJ1NvbGFuYScgPSAnQmFzZScsXG4gICAgdHJhbnNhY3Rpb25IYXNoPzogc3RyaW5nXG4gICk6IFByb21pc2U8UHVyY2hhc2VDcmVkaXRzUmVzcG9uc2U+IHtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQucHVyY2hhc2VDcmVkaXRzKHtcbiAgICAgIGZpZCxcbiAgICAgIGNyZWRpdHMsXG4gICAgICBjaGFpbixcbiAgICAgIHRyYW5zYWN0aW9uSGFzaCxcbiAgICB9KTtcbiAgfVxufSIsImltcG9ydCB7IEFwaUNsaWVudCwgdHlwZSBBcGlDbGllbnRDb25maWcgfSBmcm9tICcuL2NsaWVudCc7XG5pbXBvcnQge1xuICBLYXJhb2tlRW5kcG9pbnQsXG4gIFByYWN0aWNlRW5kcG9pbnQsXG4gIFNUVEVuZHBvaW50LFxuICBBdXRoRW5kcG9pbnQsXG59IGZyb20gJy4vZW5kcG9pbnRzJztcblxuZXhwb3J0IHsgQXBpQ2xpZW50LCB0eXBlIEFwaUNsaWVudENvbmZpZyB9O1xuZXhwb3J0ICogZnJvbSAnLi9lbmRwb2ludHMnO1xuXG4vKipcbiAqIENyZWF0ZSBhIGNvbmZpZ3VyZWQgQVBJIGNsaWVudCB3aXRoIGFsbCBlbmRwb2ludHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFwaUNsaWVudChjb25maWc6IEFwaUNsaWVudENvbmZpZykge1xuICBjb25zdCBjbGllbnQgPSBuZXcgQXBpQ2xpZW50KGNvbmZpZyk7XG5cbiAgcmV0dXJuIHtcbiAgICBjbGllbnQsXG4gICAga2FyYW9rZTogbmV3IEthcmFva2VFbmRwb2ludChjbGllbnQpLFxuICAgIHByYWN0aWNlOiBuZXcgUHJhY3RpY2VFbmRwb2ludChjbGllbnQpLFxuICAgIHN0dDogbmV3IFNUVEVuZHBvaW50KGNsaWVudCksXG4gICAgYXV0aDogbmV3IEF1dGhFbmRwb2ludChjbGllbnQpLFxuICAgIFxuICAgIC8vIERpcmVjdCBhY2Nlc3MgdG8gYmFzZSBtZXRob2RzXG4gICAgaGVhbHRoQ2hlY2s6ICgpID0+IGNsaWVudC5oZWFsdGhDaGVjaygpLFxuICB9O1xufVxuXG5leHBvcnQgdHlwZSBTY2FybGV0dEFwaUNsaWVudCA9IFJldHVyblR5cGU8dHlwZW9mIGNyZWF0ZUFwaUNsaWVudD47IiwiaW1wb3J0IHsgY3JlYXRlQXBpQ2xpZW50LCB0eXBlIFNjYXJsZXR0QXBpQ2xpZW50IH0gZnJvbSAnQHNjYXJsZXR0L2FwaS1jbGllbnQnO1xuaW1wb3J0IHR5cGUgeyBLYXJhb2tlRGF0YSwgS2FyYW9rZVNlc3Npb24sIExpbmVTY29yZSwgU2Vzc2lvblJlc3VsdHMgfSBmcm9tICdAc2NhcmxldHQvY29yZSc7XG5cbi8qKlxuICogQWRhcHRlciBjbGFzcyB0aGF0IHByb3ZpZGVzIHRoZSBzYW1lIGludGVyZmFjZSBhcyB0aGUgb2xkIEthcmFva2VBcGlTZXJ2aWNlXG4gKiBidXQgdXNlcyB0aGUgbmV3IEBzY2FybGV0dC9hcGktY2xpZW50IHVuZGVyIHRoZSBob29kXG4gKi9cbmV4cG9ydCBjbGFzcyBLYXJhb2tlQXBpU2VydmljZSB7XG4gIHByaXZhdGUgY2xpZW50OiBTY2FybGV0dEFwaUNsaWVudDtcblxuICBjb25zdHJ1Y3RvcihiYXNlVXJsOiBzdHJpbmcgPSBpbXBvcnQubWV0YS5lbnYuVklURV9BUElfVVJMIHx8ICdodHRwOi8vbG9jYWxob3N0Ojg3ODcnKSB7XG4gICAgdGhpcy5jbGllbnQgPSBjcmVhdGVBcGlDbGllbnQoeyBiYXNlVXJsIH0pO1xuICB9XG5cbiAgYXN5bmMgZmV0Y2hLYXJhb2tlRGF0YSh0cmFja0lkOiBzdHJpbmcpOiBQcm9taXNlPEthcmFva2VEYXRhIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5jbGllbnQua2FyYW9rZS5nZXREYXRhKHRyYWNrSWQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGZldGNoIGthcmFva2UgZGF0YTonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBzdGFydFNlc3Npb24oXG4gICAgdHJhY2tJZDogc3RyaW5nLFxuICAgIHNvbmdEYXRhOiB7IHRpdGxlOiBzdHJpbmc7IGFydGlzdDogc3RyaW5nOyBnZW5pdXNJZD86IHN0cmluZzsgZHVyYXRpb24/OiBudW1iZXI7IGRpZmZpY3VsdHk/OiBzdHJpbmcgfSxcbiAgICBhdXRoVG9rZW4/OiBzdHJpbmcsXG4gICAgc29uZ0NhdGFsb2dJZD86IHN0cmluZyxcbiAgICBwbGF5YmFja1NwZWVkPzogc3RyaW5nXG4gICk6IFByb21pc2U8S2FyYW9rZVNlc3Npb24gfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGU6IHBsYXliYWNrU3BlZWQgaXMgc3RvcmVkIGJ1dCBub3QgdXNlZCBieSB0aGUgY3VycmVudCBhcGktY2xpZW50XG4gICAgICAvLyBUaGlzIG1haW50YWlucyBjb21wYXRpYmlsaXR5IHdpdGggdGhlIGV4aXN0aW5nIGludGVyZmFjZVxuICAgICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IHRoaXMuY2xpZW50LmthcmFva2Uuc3RhcnRTZXNzaW9uKFxuICAgICAgICB0cmFja0lkLFxuICAgICAgICBzb25nRGF0YSxcbiAgICAgICAgc29uZ0NhdGFsb2dJZFxuICAgICAgKTtcbiAgICAgIHJldHVybiBzZXNzaW9uO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIHN0YXJ0IHNlc3Npb246JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ3JhZGVSZWNvcmRpbmcoXG4gICAgc2Vzc2lvbklkOiBzdHJpbmcsXG4gICAgbGluZUluZGV4OiBudW1iZXIsXG4gICAgYXVkaW9CdWZmZXI6IHN0cmluZyxcbiAgICBleHBlY3RlZFRleHQ6IHN0cmluZyxcbiAgICBzdGFydFRpbWU6IG51bWJlcixcbiAgICBlbmRUaW1lOiBudW1iZXIsXG4gICAgYXV0aFRva2VuPzogc3RyaW5nLFxuICAgIHBsYXliYWNrU3BlZWQ/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxMaW5lU2NvcmUgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGU6IHBsYXliYWNrU3BlZWQgaXMgcGFzc2VkIGJ1dCBub3QgdXNlZCBieSB0aGUgY3VycmVudCBhcGktY2xpZW50XG4gICAgICBjb25zdCBsaW5lU2NvcmUgPSBhd2FpdCB0aGlzLmNsaWVudC5rYXJhb2tlLmdyYWRlTGluZShcbiAgICAgICAgc2Vzc2lvbklkLFxuICAgICAgICBsaW5lSW5kZXgsXG4gICAgICAgIGF1ZGlvQnVmZmVyLFxuICAgICAgICBleHBlY3RlZFRleHQsXG4gICAgICAgIHN0YXJ0VGltZSxcbiAgICAgICAgZW5kVGltZVxuICAgICAgKTtcbiAgICAgIHJldHVybiBsaW5lU2NvcmU7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZ3JhZGUgcmVjb3JkaW5nOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGNvbXBsZXRlU2Vzc2lvbihcbiAgICBzZXNzaW9uSWQ6IHN0cmluZyxcbiAgICBmdWxsQXVkaW9CdWZmZXI/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxTZXNzaW9uUmVzdWx0cyB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IHRoaXMuY2xpZW50LmthcmFva2UuY29tcGxldGVTZXNzaW9uKFxuICAgICAgICBzZXNzaW9uSWQsXG4gICAgICAgIGZ1bGxBdWRpb0J1ZmZlclxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGNvbXBsZXRlIHNlc3Npb246JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ2V0VXNlckJlc3RTY29yZShzb25nSWQ6IHN0cmluZyk6IFByb21pc2U8bnVtYmVyIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LmNsaWVudC5nZXRVc2VyQmVzdFNjb3JlKHNvbmdJZCk7XG4gICAgICByZXR1cm4gcmVzcG9uc2UuZGF0YT8uc2NvcmUgPz8gbnVsbDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBnZXQgdXNlciBiZXN0IHNjb3JlOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldFNvbmdMZWFkZXJib2FyZChzb25nSWQ6IHN0cmluZywgbGltaXQgPSAxMCk6IFByb21pc2U8QXJyYXk8eyB1c2VySWQ6IHN0cmluZzsgc2NvcmU6IG51bWJlcjsgcmFuazogbnVtYmVyIH0+PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuY2xpZW50LmdldFNvbmdMZWFkZXJib2FyZChzb25nSWQsIGxpbWl0KTtcbiAgICAgIHJldHVybiByZXNwb25zZS5kYXRhID8/IFtdO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGdldCBzb25nIGxlYWRlcmJvYXJkOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gIH1cbn0iLCJpbXBvcnQgdHlwZSB7IENodW5rSW5mbyB9IGZyb20gJ0BzY2FybGV0dC9jb3JlJztcbmltcG9ydCB0eXBlIHsgTHlyaWNMaW5lIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9rYXJhb2tlL0x5cmljc0Rpc3BsYXknO1xuXG5leHBvcnQgZnVuY3Rpb24gY291bnRXb3Jkcyh0ZXh0OiBzdHJpbmcpOiBudW1iZXIge1xuICBpZiAoIXRleHQpIHJldHVybiAwO1xuICByZXR1cm4gdGV4dFxuICAgIC50cmltKClcbiAgICAuc3BsaXQoL1xccysvKVxuICAgIC5maWx0ZXIoKHdvcmQpID0+IHdvcmQubGVuZ3RoID4gMCkubGVuZ3RoO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkQ2h1bmtMaW5lcyhcbiAgbGluZXM6IEx5cmljTGluZVtdLFxuICBzdGFydEluZGV4OiBudW1iZXJcbik6IENodW5rSW5mbyB7XG4gIC8vIFByb2Nlc3MgaW5kaXZpZHVhbCBsaW5lcyBpbnN0ZWFkIG9mIGdyb3VwaW5nXG4gIGNvbnN0IGxpbmUgPSBsaW5lc1tzdGFydEluZGV4XTtcbiAgaWYgKCFsaW5lKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXJ0SW5kZXgsXG4gICAgICBlbmRJbmRleDogc3RhcnRJbmRleCxcbiAgICAgIGV4cGVjdGVkVGV4dDogJycsXG4gICAgICB3b3JkQ291bnQ6IDAsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHdvcmRDb3VudCA9IGNvdW50V29yZHMobGluZS50ZXh0IHx8ICcnKTtcbiAgXG4gIHJldHVybiB7XG4gICAgc3RhcnRJbmRleCxcbiAgICBlbmRJbmRleDogc3RhcnRJbmRleCwgLy8gU2luZ2xlIGxpbmUsIHNvIHN0YXJ0IGFuZCBlbmQgYXJlIHRoZSBzYW1lXG4gICAgZXhwZWN0ZWRUZXh0OiBsaW5lLnRleHQgfHwgJycsXG4gICAgd29yZENvdW50LFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2FsY3VsYXRlUmVjb3JkaW5nRHVyYXRpb24oXG4gIGxpbmVzOiBMeXJpY0xpbmVbXSxcbiAgY2h1bmtJbmZvOiBDaHVua0luZm9cbik6IG51bWJlciB7XG4gIGNvbnN0IHsgc3RhcnRJbmRleCwgZW5kSW5kZXggfSA9IGNodW5rSW5mbztcbiAgY29uc3QgbGluZSA9IGxpbmVzW3N0YXJ0SW5kZXhdO1xuICBcbiAgaWYgKCFsaW5lKSByZXR1cm4gMzAwMDtcblxuICBpZiAoZW5kSW5kZXggPiBzdGFydEluZGV4KSB7XG4gICAgaWYgKGVuZEluZGV4ICsgMSA8IGxpbmVzLmxlbmd0aCkge1xuICAgICAgY29uc3QgbmV4dExpbmUgPSBsaW5lc1tlbmRJbmRleCArIDFdO1xuICAgICAgaWYgKG5leHRMaW5lKSB7XG4gICAgICAgIC8vIENvbnZlcnQgc2Vjb25kcyB0byBtaWxsaXNlY29uZHNcbiAgICAgICAgcmV0dXJuIChuZXh0TGluZS5zdGFydFRpbWUgLSBsaW5lLnN0YXJ0VGltZSkgKiAxMDAwO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBsZXQgZHVyYXRpb24gPSAwO1xuICAgIGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDw9IGVuZEluZGV4OyBpKyspIHtcbiAgICAgIC8vIGR1cmF0aW9uIGlzIGFscmVhZHkgaW4gbWlsbGlzZWNvbmRzXG4gICAgICBkdXJhdGlvbiArPSBsaW5lc1tpXT8uZHVyYXRpb24gfHwgMzAwMDtcbiAgICB9XG4gICAgcmV0dXJuIE1hdGgubWluKGR1cmF0aW9uLCA4MDAwKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoc3RhcnRJbmRleCArIDEgPCBsaW5lcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IG5leHRMaW5lID0gbGluZXNbc3RhcnRJbmRleCArIDFdO1xuICAgICAgaWYgKG5leHRMaW5lKSB7XG4gICAgICAgIC8vIENvbnZlcnQgc2Vjb25kcyB0byBtaWxsaXNlY29uZHNcbiAgICAgICAgY29uc3QgY2FsY3VsYXRlZER1cmF0aW9uID0gKG5leHRMaW5lLnN0YXJ0VGltZSAtIGxpbmUuc3RhcnRUaW1lKSAqIDEwMDA7XG4gICAgICAgIHJldHVybiBNYXRoLm1pbihNYXRoLm1heChjYWxjdWxhdGVkRHVyYXRpb24sIDEwMDApLCA1MDAwKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIE1hdGgubWluKGxpbmUuZHVyYXRpb24gfHwgMzAwMCwgNTAwMCk7XG4gIH1cbn0iLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByb2dyZXNzQmFyUHJvcHMge1xuICBjdXJyZW50OiBudW1iZXI7XG4gIHRvdGFsOiBudW1iZXI7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgUHJvZ3Jlc3NCYXI6IENvbXBvbmVudDxQcm9ncmVzc0JhclByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBwZXJjZW50YWdlID0gKCkgPT4gTWF0aC5taW4oMTAwLCBNYXRoLm1heCgwLCAocHJvcHMuY3VycmVudCAvIHByb3BzLnRvdGFsKSAqIDEwMCkpO1xuICBcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbigndy1mdWxsIGgtMS41IGJnLWhpZ2hsaWdodCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzPVwiaC1mdWxsIGJnLWFjY2VudCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAgZWFzZS1vdXQgcm91bmRlZC1yLXNtXCJcbiAgICAgICAgc3R5bGU9e3sgd2lkdGg6IGAke3BlcmNlbnRhZ2UoKX0lYCB9fVxuICAgICAgLz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdywgc3BsaXRQcm9wcywgY3JlYXRlRWZmZWN0LCBvbkNsZWFudXAgfSBmcm9tICdzb2xpZC1qcydcbmltcG9ydCB0eXBlIHsgSlNYLCBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcydcbmltcG9ydCB7IFBvcnRhbCB9IGZyb20gJ3NvbGlkLWpzL3dlYidcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nXG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi9CdXR0b24nXG5cbmV4cG9ydCBpbnRlcmZhY2UgTW9kYWxQcm9wcyB7XG4gIG9wZW46IGJvb2xlYW5cbiAgb25DbG9zZT86ICgpID0+IHZvaWRcbiAgdGl0bGU/OiBzdHJpbmdcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmdcbiAgc2l6ZT86ICdzbScgfCAnbWQnIHwgJ2xnJyB8ICd4bCdcbiAgdmFyaWFudD86ICdkZWZhdWx0JyB8ICdkYW5nZXInIHwgJ3N1Y2Nlc3MnXG4gIGhpZGVDbG9zZUJ1dHRvbj86IGJvb2xlYW5cbiAgY2xvc2VPbkJhY2tkcm9wQ2xpY2s/OiBib29sZWFuXG4gIGNsb3NlT25Fc2NhcGU/OiBib29sZWFuXG4gIGNoaWxkcmVuPzogSlNYLkVsZW1lbnRcbiAgZm9vdGVyPzogSlNYLkVsZW1lbnRcbn1cblxuZXhwb3J0IGNvbnN0IE1vZGFsOiBDb21wb25lbnQ8TW9kYWxQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2xvY2FsLCBvdGhlcnNdID0gc3BsaXRQcm9wcyhwcm9wcywgW1xuICAgICdvcGVuJyxcbiAgICAnb25DbG9zZScsXG4gICAgJ3RpdGxlJyxcbiAgICAnZGVzY3JpcHRpb24nLFxuICAgICdzaXplJyxcbiAgICAndmFyaWFudCcsXG4gICAgJ2hpZGVDbG9zZUJ1dHRvbicsXG4gICAgJ2Nsb3NlT25CYWNrZHJvcENsaWNrJyxcbiAgICAnY2xvc2VPbkVzY2FwZScsXG4gICAgJ2NoaWxkcmVuJyxcbiAgICAnZm9vdGVyJyxcbiAgXSlcblxuICBjb25zdCBzaXplID0gKCkgPT4gbG9jYWwuc2l6ZSB8fCAnbWQnXG4gIGNvbnN0IHZhcmlhbnQgPSAoKSA9PiBsb2NhbC52YXJpYW50IHx8ICdkZWZhdWx0J1xuICBjb25zdCBjbG9zZU9uQmFja2Ryb3BDbGljayA9ICgpID0+IGxvY2FsLmNsb3NlT25CYWNrZHJvcENsaWNrID8/IHRydWVcbiAgY29uc3QgY2xvc2VPbkVzY2FwZSA9ICgpID0+IGxvY2FsLmNsb3NlT25Fc2NhcGUgPz8gdHJ1ZVxuXG4gIC8vIEhhbmRsZSBlc2NhcGUga2V5XG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGxvY2FsLm9wZW4gJiYgY2xvc2VPbkVzY2FwZSgpKSB7XG4gICAgICBjb25zdCBoYW5kbGVFc2NhcGUgPSAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XG4gICAgICAgICAgbG9jYWwub25DbG9zZT8uKClcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGhhbmRsZUVzY2FwZSlcbiAgICAgIG9uQ2xlYW51cCgoKSA9PiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgaGFuZGxlRXNjYXBlKSlcbiAgICB9XG4gIH0pXG5cbiAgLy8gTG9jayBib2R5IHNjcm9sbCB3aGVuIG1vZGFsIGlzIG9wZW5cbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAobG9jYWwub3Blbikge1xuICAgICAgY29uc3Qgb3JpZ2luYWxPdmVyZmxvdyA9IGRvY3VtZW50LmJvZHkuc3R5bGUub3ZlcmZsb3dcbiAgICAgIGRvY3VtZW50LmJvZHkuc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJ1xuICAgICAgb25DbGVhbnVwKCgpID0+IHtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5zdHlsZS5vdmVyZmxvdyA9IG9yaWdpbmFsT3ZlcmZsb3dcbiAgICAgIH0pXG4gICAgfVxuICB9KVxuXG4gIGNvbnN0IGhhbmRsZUJhY2tkcm9wQ2xpY2sgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgIGlmIChjbG9zZU9uQmFja2Ryb3BDbGljaygpICYmIGUudGFyZ2V0ID09PSBlLmN1cnJlbnRUYXJnZXQpIHtcbiAgICAgIGxvY2FsLm9uQ2xvc2U/LigpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8U2hvdyB3aGVuPXtsb2NhbC5vcGVufT5cbiAgICAgIDxQb3J0YWw+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICBjbGFzcz1cImZpeGVkIGluc2V0LTAgei01MCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLTRcIlxuICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZUJhY2tkcm9wQ2xpY2t9XG4gICAgICAgICAgey4uLm90aGVyc31cbiAgICAgICAgPlxuICAgICAgICAgIHsvKiBCYWNrZHJvcCAqL31cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWJzb2x1dGUgaW5zZXQtMCBiZy1ibGFjay84MCBiYWNrZHJvcC1ibHVyLXNtIHRyYW5zaXRpb24tb3BhY2l0eSBkdXJhdGlvbi0yMDBcIiAvPlxuICAgICAgICAgIFxuICAgICAgICAgIHsvKiBNb2RhbCAqL31cbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICdyZWxhdGl2ZSBiZy1lbGV2YXRlZCByb3VuZGVkLXhsIHNoYWRvdy0yeGwgYm9yZGVyIGJvcmRlci1zdWJ0bGUnLFxuICAgICAgICAgICAgICAndHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMjAwIHNjYWxlLTEwMCBvcGFjaXR5LTEwMCcsXG4gICAgICAgICAgICAgICdtYXgtaC1bOTB2aF0gb3ZlcmZsb3ctaGlkZGVuIGZsZXggZmxleC1jb2wnLFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gU2l6ZXNcbiAgICAgICAgICAgICAgICAndy1mdWxsIG1heC13LXNtJzogc2l6ZSgpID09PSAnc20nLFxuICAgICAgICAgICAgICAgICd3LWZ1bGwgbWF4LXctbWQnOiBzaXplKCkgPT09ICdtZCcsXG4gICAgICAgICAgICAgICAgJ3ctZnVsbCBtYXgtdy1sZyc6IHNpemUoKSA9PT0gJ2xnJyxcbiAgICAgICAgICAgICAgICAndy1mdWxsIG1heC13LXhsJzogc2l6ZSgpID09PSAneGwnLFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApfVxuICAgICAgICAgICAgb25DbGljaz17KGUpID0+IGUuc3RvcFByb3BhZ2F0aW9uKCl9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgey8qIEhlYWRlciAqL31cbiAgICAgICAgICAgIDxTaG93IHdoZW49e2xvY2FsLnRpdGxlIHx8ICFsb2NhbC5oaWRlQ2xvc2VCdXR0b259PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1zdGFydCBqdXN0aWZ5LWJldHdlZW4gcC02IHBiLTBcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xXCI+XG4gICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtsb2NhbC50aXRsZX0+XG4gICAgICAgICAgICAgICAgICAgIDxoMlxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAgICAgICAgICd0ZXh0LXhsIGZvbnQtc2VtaWJvbGQnLFxuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAndGV4dC1wcmltYXJ5JzogdmFyaWFudCgpID09PSAnZGVmYXVsdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICd0ZXh0LXJlZC01MDAnOiB2YXJpYW50KCkgPT09ICdkYW5nZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAndGV4dC1ncmVlbi01MDAnOiB2YXJpYW50KCkgPT09ICdzdWNjZXNzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAge2xvY2FsLnRpdGxlfVxuICAgICAgICAgICAgICAgICAgICA8L2gyPlxuICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgICAgPFNob3cgd2hlbj17bG9jYWwuZGVzY3JpcHRpb259PlxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc20gdGV4dC1zZWNvbmRhcnkgbXQtMVwiPlxuICAgICAgICAgICAgICAgICAgICAgIHtsb2NhbC5kZXNjcmlwdGlvbn1cbiAgICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49eyFsb2NhbC5oaWRlQ2xvc2VCdXR0b259PlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtsb2NhbC5vbkNsb3NlfVxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cIm1sLTQgcC0xIHJvdW5kZWQtbGcgdGV4dC1zZWNvbmRhcnkgaG92ZXI6dGV4dC1wcmltYXJ5IGhvdmVyOmJnLXN1cmZhY2UgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiQ2xvc2UgbW9kYWxcIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICA8c3ZnXG4gICAgICAgICAgICAgICAgICAgICAgd2lkdGg9XCIyMFwiXG4gICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0PVwiMjBcIlxuICAgICAgICAgICAgICAgICAgICAgIHZpZXdCb3g9XCIwIDAgMjAgMjBcIlxuICAgICAgICAgICAgICAgICAgICAgIGZpbGw9XCJub25lXCJcbiAgICAgICAgICAgICAgICAgICAgICB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCJcbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICBkPVwiTTE1IDVMNSAxNU01IDVsMTAgMTBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc3Ryb2tlPVwiY3VycmVudENvbG9yXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZS13aWR0aD1cIjJcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiXG4gICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgICB7LyogQ29udGVudCAqL31cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgb3ZlcmZsb3cteS1hdXRvIHAtNlwiPlxuICAgICAgICAgICAgICB7bG9jYWwuY2hpbGRyZW59XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgey8qIEZvb3RlciAqL31cbiAgICAgICAgICAgIDxTaG93IHdoZW49e2xvY2FsLmZvb3Rlcn0+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwLTYgcHQtMCBtdC1hdXRvXCI+XG4gICAgICAgICAgICAgICAge2xvY2FsLmZvb3Rlcn1cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9Qb3J0YWw+XG4gICAgPC9TaG93PlxuICApXG59XG5cbi8vIFByZS1idWlsdCBtb2RhbCBmb290ZXIgY29tcG9uZW50c1xuZXhwb3J0IGludGVyZmFjZSBNb2RhbEZvb3RlclByb3BzIHtcbiAgb25Db25maXJtPzogKCkgPT4gdm9pZFxuICBvbkNhbmNlbD86ICgpID0+IHZvaWRcbiAgY29uZmlybVRleHQ/OiBzdHJpbmdcbiAgY2FuY2VsVGV4dD86IHN0cmluZ1xuICBjb25maXJtVmFyaWFudD86ICdwcmltYXJ5JyB8ICdkYW5nZXInIHwgJ3NlY29uZGFyeSdcbiAgY29uZmlybUxvYWRpbmc/OiBib29sZWFuXG4gIGNvbmZpcm1EaXNhYmxlZD86IGJvb2xlYW5cbn1cblxuZXhwb3J0IGNvbnN0IE1vZGFsRm9vdGVyOiBDb21wb25lbnQ8TW9kYWxGb290ZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgY29uZmlybVRleHQgPSAoKSA9PiBwcm9wcy5jb25maXJtVGV4dCB8fCAnQ29uZmlybSdcbiAgY29uc3QgY2FuY2VsVGV4dCA9ICgpID0+IHByb3BzLmNhbmNlbFRleHQgfHwgJ0NhbmNlbCdcbiAgY29uc3QgY29uZmlybVZhcmlhbnQgPSAoKSA9PiBwcm9wcy5jb25maXJtVmFyaWFudCB8fCAncHJpbWFyeSdcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWVuZCBnYXAtM1wiPlxuICAgICAgPFNob3cgd2hlbj17cHJvcHMub25DYW5jZWx9PlxuICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgdmFyaWFudD1cImdob3N0XCJcbiAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNhbmNlbH1cbiAgICAgICAgPlxuICAgICAgICAgIHtjYW5jZWxUZXh0KCl9XG4gICAgICAgIDwvQnV0dG9uPlxuICAgICAgPC9TaG93PlxuICAgICAgPFNob3cgd2hlbj17cHJvcHMub25Db25maXJtfT5cbiAgICAgICAgPEJ1dHRvblxuICAgICAgICAgIHZhcmlhbnQ9e2NvbmZpcm1WYXJpYW50KCl9XG4gICAgICAgICAgb25DbGljaz17cHJvcHMub25Db25maXJtfVxuICAgICAgICAgIGxvYWRpbmc9e3Byb3BzLmNvbmZpcm1Mb2FkaW5nfVxuICAgICAgICAgIGRpc2FibGVkPXtwcm9wcy5jb25maXJtRGlzYWJsZWR9XG4gICAgICAgID5cbiAgICAgICAgICB7Y29uZmlybVRleHQoKX1cbiAgICAgICAgPC9CdXR0b24+XG4gICAgICA8L1Nob3c+XG4gICAgPC9kaXY+XG4gIClcbn1cblxuLy8gVXRpbGl0eSBmdW5jdGlvbiBmb3IgY29tbW9uIG1vZGFsIHBhdHRlcm5zXG5leHBvcnQgaW50ZXJmYWNlIENvbmZpcm1Nb2RhbFByb3BzIHtcbiAgb3BlbjogYm9vbGVhblxuICBvbkNsb3NlOiAoKSA9PiB2b2lkXG4gIG9uQ29uZmlybTogKCkgPT4gdm9pZFxuICB0aXRsZTogc3RyaW5nXG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nXG4gIGNvbmZpcm1UZXh0Pzogc3RyaW5nXG4gIGNhbmNlbFRleHQ/OiBzdHJpbmdcbiAgdmFyaWFudD86ICdkZWZhdWx0JyB8ICdkYW5nZXInXG4gIGNvbmZpcm1Mb2FkaW5nPzogYm9vbGVhblxufVxuXG5leHBvcnQgY29uc3QgQ29uZmlybU1vZGFsOiBDb21wb25lbnQ8Q29uZmlybU1vZGFsUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPE1vZGFsXG4gICAgICBvcGVuPXtwcm9wcy5vcGVufVxuICAgICAgb25DbG9zZT17cHJvcHMub25DbG9zZX1cbiAgICAgIHRpdGxlPXtwcm9wcy50aXRsZX1cbiAgICAgIGRlc2NyaXB0aW9uPXtwcm9wcy5kZXNjcmlwdGlvbn1cbiAgICAgIHZhcmlhbnQ9e3Byb3BzLnZhcmlhbnR9XG4gICAgICBzaXplPVwic21cIlxuICAgICAgZm9vdGVyPXtcbiAgICAgICAgPE1vZGFsRm9vdGVyXG4gICAgICAgICAgb25Db25maXJtPXtwcm9wcy5vbkNvbmZpcm19XG4gICAgICAgICAgb25DYW5jZWw9e3Byb3BzLm9uQ2xvc2V9XG4gICAgICAgICAgY29uZmlybVRleHQ9e3Byb3BzLmNvbmZpcm1UZXh0fVxuICAgICAgICAgIGNhbmNlbFRleHQ9e3Byb3BzLmNhbmNlbFRleHR9XG4gICAgICAgICAgY29uZmlybVZhcmlhbnQ9e3Byb3BzLnZhcmlhbnQgPT09ICdkYW5nZXInID8gJ2RhbmdlcicgOiAncHJpbWFyeSd9XG4gICAgICAgICAgY29uZmlybUxvYWRpbmc9e3Byb3BzLmNvbmZpcm1Mb2FkaW5nfVxuICAgICAgICAvPlxuICAgICAgfVxuICAgIC8+XG4gIClcbn0iLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcblxuZXhwb3J0IGludGVyZmFjZSBNaW5pbWl6ZWRLYXJhb2tlUHJvcHMge1xuICBvbkNsaWNrOiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgTWluaW1pemVkS2FyYW9rZTogQ29tcG9uZW50PE1pbmltaXplZEthcmFva2VQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8YnV0dG9uXG4gICAgICBvbkNsaWNrPXtwcm9wcy5vbkNsaWNrfVxuICAgICAgc3R5bGU9e3tcbiAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICAgIGJvdHRvbTogJzI0cHgnLFxuICAgICAgICByaWdodDogJzI0cHgnLFxuICAgICAgICB3aWR0aDogJzgwcHgnLFxuICAgICAgICBoZWlnaHQ6ICc4MHB4JyxcbiAgICAgICAgJ2JvcmRlci1yYWRpdXMnOiAnNTAlJyxcbiAgICAgICAgYmFja2dyb3VuZDogJ2xpbmVhci1ncmFkaWVudCgxMzVkZWcsICNGRjAwNkUgMCUsICNDMTM1ODQgMTAwJSknLFxuICAgICAgICAnYm94LXNoYWRvdyc6ICcwIDhweCAzMnB4IHJnYmEoMCwgMCwgMCwgMC4zKScsXG4gICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcbiAgICAgICAgJ2FsaWduLWl0ZW1zJzogJ2NlbnRlcicsXG4gICAgICAgICdqdXN0aWZ5LWNvbnRlbnQnOiAnY2VudGVyJyxcbiAgICAgICAgb3ZlcmZsb3c6ICdoaWRkZW4nLFxuICAgICAgICBjdXJzb3I6ICdwb2ludGVyJyxcbiAgICAgICAgJ3otaW5kZXgnOiAnOTk5OTknLFxuICAgICAgICBib3JkZXI6ICdub25lJyxcbiAgICAgICAgdHJhbnNpdGlvbjogJ3RyYW5zZm9ybSAwLjJzIGVhc2UnLFxuICAgICAgfX1cbiAgICAgIG9uTW91c2VFbnRlcj17KGUpID0+IHtcbiAgICAgICAgZS5jdXJyZW50VGFyZ2V0LnN0eWxlLnRyYW5zZm9ybSA9ICdzY2FsZSgxLjEpJztcbiAgICAgIH19XG4gICAgICBvbk1vdXNlTGVhdmU9eyhlKSA9PiB7XG4gICAgICAgIGUuY3VycmVudFRhcmdldC5zdHlsZS50cmFuc2Zvcm0gPSAnc2NhbGUoMSknO1xuICAgICAgfX1cbiAgICAgIGFyaWEtbGFiZWw9XCJPcGVuIEthcmFva2VcIlxuICAgID5cbiAgICAgIHsvKiBQbGFjZSB5b3VyIDIwMHgyMDAgaW1hZ2UgaGVyZSBhczogKi99XG4gICAgICB7LyogPGltZyBzcmM9XCIvcGF0aC90by95b3VyL2ltYWdlLnBuZ1wiIGFsdD1cIkthcmFva2VcIiBzdHlsZT1cIndpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IG9iamVjdC1maXQ6IGNvdmVyO1wiIC8+ICovfVxuICAgICAgXG4gICAgICB7LyogRm9yIG5vdywgdXNpbmcgYSBwbGFjZWhvbGRlciBpY29uICovfVxuICAgICAgPHNwYW4gc3R5bGU9e3sgJ2ZvbnQtc2l6ZSc6ICczNnB4JyB9fT7wn46kPC9zcGFuPlxuICAgIDwvYnV0dG9uPlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgSWNvblhSZWd1bGFyIGZyb20gJ3Bob3NwaG9yLWljb25zLXNvbGlkL0ljb25YUmVndWxhcic7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBQcmFjdGljZUhlYWRlclByb3BzIHtcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIG9uRXhpdDogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBQcmFjdGljZUhlYWRlcjogQ29tcG9uZW50PFByYWN0aWNlSGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPFNob3cgd2hlbj17cHJvcHMudGl0bGV9PlxuICAgICAgPGhlYWRlciBjbGFzcz17Y24oJ2ZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGgtMTQgcHgtNCBiZy10cmFuc3BhcmVudCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICAgIDxoMSBjbGFzcz1cInRleHQtbGcgZm9udC1zZW1pYm9sZCB0ZXh0LXByaW1hcnlcIj5cbiAgICAgICAgICB7cHJvcHMudGl0bGV9XG4gICAgICAgIDwvaDE+XG4gICAgICA8L2hlYWRlcj5cbiAgICA8L1Nob3c+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9CdXR0b24nO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXhlcmNpc2VGb290ZXJQcm9wcyB7XG4gIGlzUmVjb3JkaW5nPzogYm9vbGVhbjtcbiAgaXNQcm9jZXNzaW5nPzogYm9vbGVhbjtcbiAgY2FuU3VibWl0PzogYm9vbGVhbjtcbiAgb25SZWNvcmQ/OiAoKSA9PiB2b2lkO1xuICBvblN0b3A/OiAoKSA9PiB2b2lkO1xuICBvblN1Ym1pdD86ICgpID0+IHZvaWQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgRXhlcmNpc2VGb290ZXI6IENvbXBvbmVudDxFeGVyY2lzZUZvb3RlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxmb290ZXIgY2xhc3M9e2NuKCdib3JkZXItdCBib3JkZXItZ3JheS03MDAgYmctc3VyZmFjZSBwLTYnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgPGRpdiBjbGFzcz1cIm1heC13LTJ4bCBteC1hdXRvXCI+XG4gICAgICAgIDxTaG93XG4gICAgICAgICAgd2hlbj17IXByb3BzLmlzUmVjb3JkaW5nfVxuICAgICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgdmFyaWFudD1cInByaW1hcnlcIlxuICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICBmdWxsV2lkdGhcbiAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25TdG9wfVxuICAgICAgICAgICAgICBkaXNhYmxlZD17cHJvcHMuaXNQcm9jZXNzaW5nfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICBTdG9wXG4gICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICB9XG4gICAgICAgID5cbiAgICAgICAgICA8U2hvd1xuICAgICAgICAgICAgd2hlbj17cHJvcHMuY2FuU3VibWl0fVxuICAgICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgdmFyaWFudD1cInByaW1hcnlcIlxuICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgZnVsbFdpZHRoXG4gICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25SZWNvcmR9XG4gICAgICAgICAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmlzUHJvY2Vzc2luZ31cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIFJlY29yZFxuICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgIHZhcmlhbnQ9XCJwcmltYXJ5XCJcbiAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgZnVsbFdpZHRoXG4gICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uU3VibWl0fVxuICAgICAgICAgICAgICBkaXNhYmxlZD17cHJvcHMuaXNQcm9jZXNzaW5nfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7cHJvcHMuaXNQcm9jZXNzaW5nID8gJ1Byb2Nlc3NpbmcuLi4nIDogJ1N1Ym1pdCd9XG4gICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvU2hvdz5cbiAgICAgIDwvZGl2PlxuICAgIDwvZm9vdGVyPlxuICApO1xufTsiLCJleHBvcnQgZGVmYXVsdCAocCkgPT4gKDxzdmcgY2xhc3M9e3AuY2xhc3N9IGRhdGEtcGhvc3Bob3ItaWNvbj1cImNoZWNrLWNpcmNsZVwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiIHdpZHRoPVwiMWVtXCIgaGVpZ2h0PVwiMWVtXCIgcG9pbnRlci1ldmVudHM9XCJub25lXCIgZGlzcGxheT1cImlubGluZS1ibG9ja1wiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBmaWxsPVwiY3VycmVudENvbG9yXCIgdmlld0JveD1cIjAgMCAyNTYgMjU2XCI+PHBhdGggZD1cIk0xMjggMjRhMTA0IDEwNCAwIDEgMCAxMDQgMTA0QTEwNC4xMSAxMDQuMTEgMCAwIDAgMTI4IDI0bTQ1LjY2IDg1LjY2LTU2IDU2YTggOCAwIDAgMS0xMS4zMiAwbC0yNC0yNGE4IDggMCAwIDEgMTEuMzItMTEuMzJMMTEyIDE0OC42OWw1MC4zNC01MC4zNWE4IDggMCAwIDEgMTEuMzIgMTEuMzJcIi8+PC9zdmc+KTtcbiIsImV4cG9ydCBkZWZhdWx0IChwKSA9PiAoPHN2ZyBjbGFzcz17cC5jbGFzc30gZGF0YS1waG9zcGhvci1pY29uPVwieC1jaXJjbGVcIiBhcmlhLWhpZGRlbj1cInRydWVcIiB3aWR0aD1cIjFlbVwiIGhlaWdodD1cIjFlbVwiIHBvaW50ZXItZXZlbnRzPVwibm9uZVwiIGRpc3BsYXk9XCJpbmxpbmUtYmxvY2tcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgZmlsbD1cImN1cnJlbnRDb2xvclwiIHZpZXdCb3g9XCIwIDAgMjU2IDI1NlwiPjxwYXRoIGQ9XCJNMTI4IDI0YTEwNCAxMDQgMCAxIDAgMTA0IDEwNEExMDQuMTEgMTA0LjExIDAgMCAwIDEyOCAyNG0zNy42NiAxMzAuMzRhOCA4IDAgMCAxLTExLjMyIDExLjMyTDEyOCAxMzkuMzFsLTI2LjM0IDI2LjM1YTggOCAwIDAgMS0xMS4zMi0xMS4zMkwxMTYuNjkgMTI4bC0yNi4zNS0yNi4zNGE4IDggMCAwIDEgMTEuMzItMTEuMzJMMTI4IDExNi42OWwyNi4zNC0yNi4zNWE4IDggMCAwIDEgMTEuMzIgMTEuMzJMMTM5LjMxIDEyOFpcIi8+PC9zdmc+KTtcbiIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9CdXR0b24nO1xuaW1wb3J0IEljb25DaGVja0NpcmNsZUZpbGwgZnJvbSAncGhvc3Bob3ItaWNvbnMtc29saWQvSWNvbkNoZWNrQ2lyY2xlRmlsbCc7XG5pbXBvcnQgSWNvblhDaXJjbGVGaWxsIGZyb20gJ3Bob3NwaG9yLWljb25zLXNvbGlkL0ljb25YQ2lyY2xlRmlsbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVzcG9uc2VGb290ZXJQcm9wcyB7XG4gIG1vZGU6ICdjaGVjaycgfCAnZmVlZGJhY2snO1xuICBpc0NvcnJlY3Q/OiBib29sZWFuO1xuICBmZWVkYmFja1RleHQ/OiBzdHJpbmc7XG4gIGNvbnRpbnVlTGFiZWw/OiBzdHJpbmc7XG4gIG9uQ2hlY2s/OiAoKSA9PiB2b2lkO1xuICBvbkNvbnRpbnVlPzogKCkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IFJlc3BvbnNlRm9vdGVyOiBDb21wb25lbnQ8UmVzcG9uc2VGb290ZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPVwiYm9yZGVyLXQgYm9yZGVyLWdyYXktNzAwIGJnLXN1cmZhY2UgcC02XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwibWF4LXctMnhsIG14LWF1dG9cIj5cbiAgICAgICAgPFNob3dcbiAgICAgICAgICB3aGVuPXtwcm9wcy5tb2RlID09PSAnY2hlY2snfVxuICAgICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTZcIj5cbiAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmlzQ29ycmVjdCAhPT0gdW5kZWZpbmVkfT5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC00XCI+XG4gICAgICAgICAgICAgICAgPFNob3dcbiAgICAgICAgICAgICAgICAgIHdoZW49e3Byb3BzLmlzQ29ycmVjdH1cbiAgICAgICAgICAgICAgICAgIGZhbGxiYWNrPXs8SWNvblhDaXJjbGVGaWxsIHN0eWxlPVwiY29sb3I6ICNlZjQ0NDQ7XCIgY2xhc3M9XCJ3LTE2IGgtMTYgZmxleC1zaHJpbmstMFwiIC8+fVxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxJY29uQ2hlY2tDaXJjbGVGaWxsIHN0eWxlPVwiY29sb3I6ICMyMmM1NWU7XCIgY2xhc3M9XCJ3LTE2IGgtMTYgZmxleC1zaHJpbmstMFwiIC8+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtMnhsIGZvbnQtYm9sZFwiIHN0eWxlPXtgY29sb3I6ICR7cHJvcHMuaXNDb3JyZWN0ID8gJyMyMmM1NWUnIDogJyNlZjQ0NDQnfTtgfT5cbiAgICAgICAgICAgICAgICAgICAge3Byb3BzLmlzQ29ycmVjdCA/ICdDb3JyZWN0IScgOiAnSW5jb3JyZWN0J31cbiAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmZlZWRiYWNrVGV4dCAmJiAhcHJvcHMuaXNDb3JyZWN0fT5cbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWJhc2UgdGV4dC1zZWNvbmRhcnkgbXQtMVwiPntwcm9wcy5mZWVkYmFja1RleHR9PC9wPlxuICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgdmFyaWFudD1cInByaW1hcnlcIlxuICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNvbnRpbnVlfVxuICAgICAgICAgICAgICBjbGFzcz1cIm1pbi13LVsxODBweF1cIlxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7cHJvcHMuY29udGludWVMYWJlbCB8fCAnTmV4dCd9XG4gICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgfVxuICAgICAgPlxuICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgdmFyaWFudD1cInByaW1hcnlcIlxuICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgZnVsbFdpZHRoXG4gICAgICAgICAgb25DbGljaz17cHJvcHMub25DaGVja31cbiAgICAgICAgPlxuICAgICAgICAgIENoZWNrXG4gICAgICAgIDwvQnV0dG9uPlxuICAgICAgPC9TaG93PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50LCBKU1ggfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBFeGVyY2lzZVRlbXBsYXRlUHJvcHMge1xuICBpbnN0cnVjdGlvblRleHQ/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBFeGVyY2lzZVRlbXBsYXRlOiBDb21wb25lbnQ8RXhlcmNpc2VUZW1wbGF0ZVByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sIGgtZnVsbCBiZy1iYXNlIHRleHQtcHJpbWFyeScsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8ZGl2IGNsYXNzPVwiZmxleC1ncm93IG92ZXJmbG93LXktYXV0byBmbGV4IGZsZXgtY29sIHBiLTI0XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ3LWZ1bGwgbWF4LXctMnhsIG14LWF1dG8gcHgtNCBweS04XCI+XG4gICAgICAgICAge3Byb3BzLmluc3RydWN0aW9uVGV4dCAmJiAoXG4gICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1tdXRlZC1mb3JlZ3JvdW5kIG1iLTQgdGV4dC1sZWZ0XCI+XG4gICAgICAgICAgICAgIHtwcm9wcy5pbnN0cnVjdGlvblRleHR9XG4gICAgICAgICAgICA8L3A+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlYWRBbG91ZFByb3BzIHtcbiAgcHJvbXB0OiBzdHJpbmc7XG4gIHVzZXJUcmFuc2NyaXB0Pzogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFJlYWRBbG91ZDogQ29tcG9uZW50PFJlYWRBbG91ZFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdzcGFjZS15LTQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgPHAgY2xhc3M9XCJ0ZXh0LTJ4bCB0ZXh0LWxlZnQgbGVhZGluZy1yZWxheGVkXCI+XG4gICAgICAgIHtwcm9wcy5wcm9tcHR9XG4gICAgICA8L3A+XG4gICAgICBcbiAgICAgIDxTaG93IHdoZW49e3Byb3BzLnVzZXJUcmFuc2NyaXB0fT5cbiAgICAgICAgPGRpdiBjbGFzcz1cIm10LThcIj5cbiAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1tdXRlZC1mb3JlZ3JvdW5kIG1iLTRcIj5Zb3Ugc2FpZDo8L3A+XG4gICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LTJ4bCB0ZXh0LWxlZnQgbGVhZGluZy1yZWxheGVkXCI+XG4gICAgICAgICAgICB7cHJvcHMudXNlclRyYW5zY3JpcHR9XG4gICAgICAgICAgPC9wPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjcmVhdGVSZXNvdXJjZSwgU2hvdywgY3JlYXRlU2lnbmFsLCBjcmVhdGVFZmZlY3QgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBSZWFkQWxvdWQgfSBmcm9tICcuLi9SZWFkQWxvdWQnO1xuaW1wb3J0IHsgUHJvZ3Jlc3NCYXIgfSBmcm9tICcuLi8uLi9jb21tb24vUHJvZ3Jlc3NCYXInO1xuaW1wb3J0IHsgUHJhY3RpY2VIZWFkZXIgfSBmcm9tICcuLi9QcmFjdGljZUhlYWRlcic7XG5pbXBvcnQgeyBFeGVyY2lzZVRlbXBsYXRlIH0gZnJvbSAnLi4vRXhlcmNpc2VUZW1wbGF0ZSc7XG5pbXBvcnQgeyBFeGVyY2lzZUZvb3RlciB9IGZyb20gJy4uL0V4ZXJjaXNlRm9vdGVyJztcbmltcG9ydCB7IFJlc3BvbnNlRm9vdGVyIH0gZnJvbSAnLi4vUmVzcG9uc2VGb290ZXInO1xuaW1wb3J0IHR5cGUgeyBSZWFkQWxvdWRFeGVyY2lzZSBhcyBFeGVyY2lzZSB9IGZyb20gJ0BzY2FybGV0dC9jb3JlJztcblxuZXhwb3J0IGludGVyZmFjZSBQcmFjdGljZUV4ZXJjaXNlVmlld1Byb3BzIHtcbiAgc2Vzc2lvbklkPzogc3RyaW5nO1xuICBvbkJhY2s6ICgpID0+IHZvaWQ7XG4gIGFwaUJhc2VVcmw/OiBzdHJpbmc7XG4gIGF1dGhUb2tlbj86IHN0cmluZztcbiAgaGVhZGVyVGl0bGU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBQcmFjdGljZUV4ZXJjaXNlVmlldzogQ29tcG9uZW50PFByYWN0aWNlRXhlcmNpc2VWaWV3UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtjdXJyZW50RXhlcmNpc2VJbmRleCwgc2V0Q3VycmVudEV4ZXJjaXNlSW5kZXhdID0gY3JlYXRlU2lnbmFsKDApO1xuICBjb25zdCBbaXNSZWNvcmRpbmcsIHNldElzUmVjb3JkaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtpc1Byb2Nlc3NpbmcsIHNldElzUHJvY2Vzc2luZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbdXNlclRyYW5zY3JpcHQsIHNldFVzZXJUcmFuc2NyaXB0XSA9IGNyZWF0ZVNpZ25hbCgnJyk7XG4gIGNvbnN0IFtjdXJyZW50U2NvcmUsIHNldEN1cnJlbnRTY29yZV0gPSBjcmVhdGVTaWduYWw8bnVtYmVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFttZWRpYVJlY29yZGVyLCBzZXRNZWRpYVJlY29yZGVyXSA9IGNyZWF0ZVNpZ25hbDxNZWRpYVJlY29yZGVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFthdWRpb0NodW5rcywgc2V0QXVkaW9DaHVua3NdID0gY3JlYXRlU2lnbmFsPEJsb2JbXT4oW10pO1xuICBjb25zdCBbc2hvd0ZlZWRiYWNrLCBzZXRTaG93RmVlZGJhY2tdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2lzQ29ycmVjdCwgc2V0SXNDb3JyZWN0XSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIFxuICBjb25zdCBhcGlCYXNlVXJsID0gKCkgPT4gcHJvcHMuYXBpQmFzZVVybCB8fCAnaHR0cDovL2xvY2FsaG9zdDo4Nzg3JztcbiAgXG4gIC8vIEZldGNoIGV4ZXJjaXNlcyBmcm9tIHRoZSBBUElcbiAgY29uc3QgW2V4ZXJjaXNlc10gPSBjcmVhdGVSZXNvdXJjZShhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIEluY2x1ZGUgc2Vzc2lvbklkIGlmIHByb3ZpZGVkIHRvIGdldCBleGVyY2lzZXMgZnJvbSB0aGlzIHNlc3Npb24gb25seVxuICAgICAgY29uc3QgdXJsID0gcHJvcHMuc2Vzc2lvbklkIFxuICAgICAgICA/IGAke2FwaUJhc2VVcmwoKX0vYXBpL3ByYWN0aWNlL2V4ZXJjaXNlcz9saW1pdD0xMCZzZXNzaW9uSWQ9JHtwcm9wcy5zZXNzaW9uSWR9YFxuICAgICAgICA6IGAke2FwaUJhc2VVcmwoKX0vYXBpL3ByYWN0aWNlL2V4ZXJjaXNlcz9saW1pdD0xMGA7XG4gICAgICBcbiAgICAgIGNvbnN0IGhlYWRlcnM6IEhlYWRlcnNJbml0ID0ge307XG4gICAgICBpZiAocHJvcHMuYXV0aFRva2VuKSB7XG4gICAgICAgIGhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9IGBCZWFyZXIgJHtwcm9wcy5hdXRoVG9rZW59YDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHsgaGVhZGVycyB9KTtcbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc3QgZXJyb3JUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbUHJhY3RpY2VFeGVyY2lzZVZpZXddIEFQSSBlcnJvcjonLCByZXNwb25zZS5zdGF0dXMsIGVycm9yVGV4dCk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGZldGNoIGV4ZXJjaXNlcycpO1xuICAgICAgfVxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgIFxuICAgICAgaWYgKGRhdGEuZGF0YSAmJiBkYXRhLmRhdGEuZXhlcmNpc2VzKSB7XG4gICAgICAgIHJldHVybiBkYXRhLmRhdGEuZXhlcmNpc2VzIGFzIEV4ZXJjaXNlW107XG4gICAgICB9XG4gICAgICByZXR1cm4gW107XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQcmFjdGljZUV4ZXJjaXNlVmlld10gRmFpbGVkIHRvIGZldGNoOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIExvZyB3aGVuIGV4ZXJjaXNlcyBsb2FkXG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgZXhlcmNpc2VMaXN0ID0gZXhlcmNpc2VzKCk7XG4gIH0pO1xuXG4gIGNvbnN0IGhhbmRsZVN0YXJ0UmVjb3JkaW5nID0gYXN5bmMgKCkgPT4ge1xuICAgIHNldFVzZXJUcmFuc2NyaXB0KCcnKTtcbiAgICBzZXRDdXJyZW50U2NvcmUobnVsbCk7XG4gICAgc2V0QXVkaW9DaHVua3MoW10pO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdHJlYW0gPSBhd2FpdCBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSh7IFxuICAgICAgICBhdWRpbzoge1xuICAgICAgICAgIGVjaG9DYW5jZWxsYXRpb246IHRydWUsXG4gICAgICAgICAgbm9pc2VTdXBwcmVzc2lvbjogdHJ1ZSxcbiAgICAgICAgICBhdXRvR2FpbkNvbnRyb2w6IHRydWVcbiAgICAgICAgfSBcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBtaW1lVHlwZSA9IE1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKCdhdWRpby93ZWJtO2NvZGVjcz1vcHVzJykgXG4gICAgICAgID8gJ2F1ZGlvL3dlYm07Y29kZWNzPW9wdXMnIFxuICAgICAgICA6ICdhdWRpby93ZWJtJztcbiAgICAgICAgXG4gICAgICBjb25zdCByZWNvcmRlciA9IG5ldyBNZWRpYVJlY29yZGVyKHN0cmVhbSwgeyBtaW1lVHlwZSB9KTtcbiAgICAgIGNvbnN0IGNodW5rczogQmxvYltdID0gW107XG4gICAgICBcbiAgICAgIHJlY29yZGVyLm9uZGF0YWF2YWlsYWJsZSA9IChldmVudCkgPT4ge1xuICAgICAgICBpZiAoZXZlbnQuZGF0YS5zaXplID4gMCkge1xuICAgICAgICAgIGNodW5rcy5wdXNoKGV2ZW50LmRhdGEpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgXG4gICAgICByZWNvcmRlci5vbnN0b3AgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGF1ZGlvQmxvYiA9IG5ldyBCbG9iKGNodW5rcywgeyB0eXBlOiBtaW1lVHlwZSB9KTtcbiAgICAgICAgYXdhaXQgcHJvY2Vzc1JlY29yZGluZyhhdWRpb0Jsb2IpO1xuICAgICAgICBcbiAgICAgICAgLy8gU3RvcCBhbGwgdHJhY2tzXG4gICAgICAgIHN0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKHRyYWNrID0+IHRyYWNrLnN0b3AoKSk7XG4gICAgICB9O1xuICAgICAgXG4gICAgICByZWNvcmRlci5zdGFydCgpO1xuICAgICAgc2V0TWVkaWFSZWNvcmRlcihyZWNvcmRlcik7XG4gICAgICBzZXRJc1JlY29yZGluZyh0cnVlKTtcbiAgICAgIFxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbUHJhY3RpY2VFeGVyY2lzZVZpZXddIEZhaWxlZCB0byBzdGFydCByZWNvcmRpbmc6JywgZXJyb3IpO1xuICAgICAgc2V0SXNSZWNvcmRpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBwcm9jZXNzUmVjb3JkaW5nID0gYXN5bmMgKGJsb2I6IEJsb2IpID0+IHtcbiAgICB0cnkge1xuICAgICAgc2V0SXNQcm9jZXNzaW5nKHRydWUpO1xuICAgICAgXG4gICAgICAvLyBDb252ZXJ0IHRvIGJhc2U2NCBmb3IgQVBJXG4gICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgY29uc3QgYmFzZTY0ID0gYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICByZWFkZXIub25sb2FkZW5kID0gKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGJhc2U2NFN0cmluZyA9IHJlYWRlci5yZXN1bHQgYXMgc3RyaW5nO1xuICAgICAgICAgIHJlc29sdmUoYmFzZTY0U3RyaW5nLnNwbGl0KCcsJylbMV0pO1xuICAgICAgICB9O1xuICAgICAgICByZWFkZXIucmVhZEFzRGF0YVVSTChibG9iKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBTZW5kIHRvIFNUVCBBUEkgd2l0aCByZXRyeSBsb2dpY1xuICAgICAgbGV0IHJlc3BvbnNlO1xuICAgICAgbGV0IGF0dGVtcHRzID0gMDtcbiAgICAgIGNvbnN0IG1heEF0dGVtcHRzID0gMjtcbiAgICAgIFxuICAgICAgY29uc3QgaGVhZGVyczogSGVhZGVyc0luaXQgPSB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfTtcbiAgICAgIGlmIChwcm9wcy5hdXRoVG9rZW4pIHtcbiAgICAgICAgaGVhZGVyc1snQXV0aG9yaXphdGlvbiddID0gYEJlYXJlciAke3Byb3BzLmF1dGhUb2tlbn1gO1xuICAgICAgfVxuICAgICAgXG4gICAgICB3aGlsZSAoYXR0ZW1wdHMgPCBtYXhBdHRlbXB0cykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7YXBpQmFzZVVybCgpfS9hcGkvc3BlZWNoLXRvLXRleHQvdHJhbnNjcmliZWAsIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgaGVhZGVycyxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgXG4gICAgICAgICAgICAgIGF1ZGlvQmFzZTY0OiBiYXNlNjQsXG4gICAgICAgICAgICAgIGV4cGVjdGVkVGV4dDogY3VycmVudEV4ZXJjaXNlKCk/LmZ1bGxfbGluZSxcbiAgICAgICAgICAgICAgLy8gVXNlIERlZXBncmFtIG9uIHJldHJ5XG4gICAgICAgICAgICAgIHByZWZlckRlZXBncmFtOiBhdHRlbXB0cyA+IDBcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGZldGNoRXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJhY3RpY2VFeGVyY2lzZVZpZXddIFNUVCBhdHRlbXB0ICR7YXR0ZW1wdHMgKyAxfSBmYWlsZWQ6YCwgZmV0Y2hFcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGF0dGVtcHRzKys7XG4gICAgICAgIGlmIChhdHRlbXB0cyA8IG1heEF0dGVtcHRzKSB7XG4gICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDUwMCkpOyAvLyBTbWFsbCBkZWxheSBiZWZvcmUgcmV0cnlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICBzZXRVc2VyVHJhbnNjcmlwdChyZXN1bHQuZGF0YS50cmFuc2NyaXB0KTtcbiAgICAgICAgXG4gICAgICAgIC8vIENhbGN1bGF0ZSBhIHNpbXBsZSBzY29yZSBiYXNlZCBvbiBtYXRjaGluZyB3b3Jkc1xuICAgICAgICBjb25zdCBzY29yZSA9IGNhbGN1bGF0ZVNjb3JlKGN1cnJlbnRFeGVyY2lzZSgpPy5mdWxsX2xpbmUgfHwgJycsIHJlc3VsdC5kYXRhLnRyYW5zY3JpcHQpO1xuICAgICAgICBzZXRDdXJyZW50U2NvcmUoc2NvcmUpO1xuICAgICAgICBcbiAgICAgICAgLy8gQXV0b21hdGljYWxseSBzdWJtaXQgYWZ0ZXIgdHJhbnNjcmlwdGlvblxuICAgICAgICBhd2FpdCBoYW5kbGVBdXRvU3VibWl0KHNjb3JlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU1RUIGZhaWxlZCBhZnRlciByZXRyaWVzJyk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQcmFjdGljZUV4ZXJjaXNlVmlld10gRmFpbGVkIHRvIHByb2Nlc3MgcmVjb3JkaW5nOicsIGVycm9yKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0SXNQcm9jZXNzaW5nKGZhbHNlKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlU3RvcFJlY29yZGluZyA9ICgpID0+IHtcbiAgICBjb25zdCByZWNvcmRlciA9IG1lZGlhUmVjb3JkZXIoKTtcbiAgICBpZiAocmVjb3JkZXIgJiYgcmVjb3JkZXIuc3RhdGUgIT09ICdpbmFjdGl2ZScpIHtcbiAgICAgIHJlY29yZGVyLnN0b3AoKTtcbiAgICAgIHNldElzUmVjb3JkaW5nKGZhbHNlKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgY2FsY3VsYXRlU2NvcmUgPSAoZXhwZWN0ZWQ6IHN0cmluZywgYWN0dWFsOiBzdHJpbmcpOiBudW1iZXIgPT4ge1xuICAgIGNvbnN0IGV4cGVjdGVkV29yZHMgPSBleHBlY3RlZC50b0xvd2VyQ2FzZSgpLnNwbGl0KC9cXHMrLyk7XG4gICAgY29uc3QgYWN0dWFsV29yZHMgPSBhY3R1YWwudG9Mb3dlckNhc2UoKS5zcGxpdCgvXFxzKy8pO1xuICAgIGxldCBtYXRjaGVzID0gMDtcbiAgICBcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cGVjdGVkV29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhY3R1YWxXb3Jkc1tpXSA9PT0gZXhwZWN0ZWRXb3Jkc1tpXSkge1xuICAgICAgICBtYXRjaGVzKys7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBNYXRoLnJvdW5kKChtYXRjaGVzIC8gZXhwZWN0ZWRXb3Jkcy5sZW5ndGgpICogMTAwKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVBdXRvU3VibWl0ID0gYXN5bmMgKHNjb3JlOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBjdXJyZW50RXhlcmNpc2UgPSBleGVyY2lzZXMoKT8uW2N1cnJlbnRFeGVyY2lzZUluZGV4KCldO1xuICAgIGNvbnN0IGNodW5rcyA9IGF1ZGlvQ2h1bmtzKCk7XG4gICAgY29uc3QgYmxvYiA9IGNodW5rcy5sZW5ndGggPiAwID8gbmV3IEJsb2IoY2h1bmtzLCB7IHR5cGU6ICdhdWRpby93ZWJtJyB9KSA6IG51bGw7XG4gICAgXG4gICAgLy8gRGV0ZXJtaW5lIGlmIGNvcnJlY3QgKDgwJSBvciBoaWdoZXIpXG4gICAgc2V0SXNDb3JyZWN0KHNjb3JlID49IDgwKTtcbiAgICBzZXRTaG93RmVlZGJhY2sodHJ1ZSk7XG4gICAgXG4gICAgaWYgKGN1cnJlbnRFeGVyY2lzZSAmJiBjdXJyZW50RXhlcmNpc2UuY2FyZF9pZHMubGVuZ3RoID4gMCAmJiBibG9iKSB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyBDb252ZXJ0IGF1ZGlvIHRvIGJhc2U2NFxuICAgICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgICBjb25zdCBiYXNlNjQgPSBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgcmVhZGVyLm9ubG9hZGVuZCA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGJhc2U2NFN0cmluZyA9IHJlYWRlci5yZXN1bHQgYXMgc3RyaW5nO1xuICAgICAgICAgICAgcmVzb2x2ZShiYXNlNjRTdHJpbmcuc3BsaXQoJywnKVsxXSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgICByZWFkZXIucmVhZEFzRGF0YVVSTChibG9iKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgaGVhZGVyczogSGVhZGVyc0luaXQgPSB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfTtcbiAgICAgICAgaWYgKHByb3BzLmF1dGhUb2tlbikge1xuICAgICAgICAgIGhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9IGBCZWFyZXIgJHtwcm9wcy5hdXRoVG9rZW59YDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN1Ym1pdCByZXZpZXdcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHthcGlCYXNlVXJsKCl9L2FwaS9wcmFjdGljZS9yZXZpZXdgLCB7XG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgaGVhZGVycyxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBleGVyY2lzZUlkOiBjdXJyZW50RXhlcmNpc2UuaWQsXG4gICAgICAgICAgICBhdWRpb0Jhc2U2NDogYmFzZTY0LFxuICAgICAgICAgICAgY2FyZFNjb3JlczogY3VycmVudEV4ZXJjaXNlLmNhcmRfaWRzLm1hcChjYXJkSWQgPT4gKHtcbiAgICAgICAgICAgICAgY2FyZElkLFxuICAgICAgICAgICAgICBzY29yZVxuICAgICAgICAgICAgfSkpXG4gICAgICAgICAgfSlcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQcmFjdGljZUV4ZXJjaXNlVmlld10gRmFpbGVkIHRvIHN1Ym1pdCByZXZpZXc6JywgZXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGhhbmRsZVN1Ym1pdCA9IGFzeW5jICgpID0+IHtcbiAgICAvLyBUaGlzIGlzIG5vdyBvbmx5IHVzZWQgYXMgZmFsbGJhY2sgaWYgbmVlZGVkXG4gICAgY29uc3Qgc2NvcmUgPSBjdXJyZW50U2NvcmUoKTtcbiAgICBpZiAoc2NvcmUgIT09IG51bGwpIHtcbiAgICAgIGF3YWl0IGhhbmRsZUF1dG9TdWJtaXQoc2NvcmUpO1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGhhbmRsZUNvbnRpbnVlID0gKCkgPT4ge1xuICAgIC8vIE1vdmUgdG8gbmV4dCBleGVyY2lzZVxuICAgIGlmIChjdXJyZW50RXhlcmNpc2VJbmRleCgpIDwgKGV4ZXJjaXNlcygpPy5sZW5ndGggfHwgMCkgLSAxKSB7XG4gICAgICBzZXRDdXJyZW50RXhlcmNpc2VJbmRleChjdXJyZW50RXhlcmNpc2VJbmRleCgpICsgMSk7XG4gICAgICBzZXRVc2VyVHJhbnNjcmlwdCgnJyk7XG4gICAgICBzZXRDdXJyZW50U2NvcmUobnVsbCk7XG4gICAgICBzZXRBdWRpb0NodW5rcyhbXSk7XG4gICAgICBzZXRTaG93RmVlZGJhY2soZmFsc2UpO1xuICAgICAgc2V0SXNDb3JyZWN0KGZhbHNlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQWxsIGV4ZXJjaXNlcyBjb21wbGV0ZWRcbiAgICAgIHByb3BzLm9uQmFjaygpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVTa2lwID0gKCkgPT4ge1xuICAgIFxuICAgIC8vIE1vdmUgdG8gbmV4dCBleGVyY2lzZVxuICAgIGlmIChjdXJyZW50RXhlcmNpc2VJbmRleCgpIDwgKGV4ZXJjaXNlcygpPy5sZW5ndGggfHwgMCkgLSAxKSB7XG4gICAgICBzZXRDdXJyZW50RXhlcmNpc2VJbmRleChjdXJyZW50RXhlcmNpc2VJbmRleCgpICsgMSk7XG4gICAgICBzZXRVc2VyVHJhbnNjcmlwdCgnJyk7XG4gICAgICBzZXRDdXJyZW50U2NvcmUobnVsbCk7XG4gICAgICBzZXRBdWRpb0NodW5rcyhbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEFsbCBleGVyY2lzZXMgY29tcGxldGVkXG4gICAgICBwcm9wcy5vbkJhY2soKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgY3VycmVudEV4ZXJjaXNlID0gKCkgPT4gZXhlcmNpc2VzKCk/LltjdXJyZW50RXhlcmNpc2VJbmRleCgpXTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9XCJoLWZ1bGwgYmctYmFzZSBmbGV4IGZsZXgtY29sXCI+XG4gICAgICA8U2hvd1xuICAgICAgICB3aGVuPXshZXhlcmNpc2VzLmxvYWRpbmd9XG4gICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFuaW1hdGUtc3BpbiByb3VuZGVkLWZ1bGwgaC0xMiB3LTEyIGJvcmRlci1iLTIgYm9yZGVyLWFjY2VudC1wcmltYXJ5IG14LWF1dG8gbWItNFwiPjwvZGl2PlxuICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbXV0ZWQtZm9yZWdyb3VuZFwiPkxvYWRpbmcgZXhlcmNpc2VzLi4uPC9wPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIH1cbiAgICAgID5cbiAgICAgICAgPFNob3dcbiAgICAgICAgICB3aGVuPXsoZXhlcmNpc2VzKCkgfHwgW10pLmxlbmd0aCA+IDB9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLThcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIG1heC13LW1kXCI+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtbXV0ZWQtZm9yZWdyb3VuZCBtYi00XCI+Tm8gcHJhY3RpY2UgZXhlcmNpc2VzIGF2YWlsYWJsZSB5ZXQuPC9wPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zbSB0ZXh0LW11dGVkLWZvcmVncm91bmRcIj5Db21wbGV0ZSBrYXJhb2tlIHNlc3Npb25zIHdpdGggZXJyb3JzIHRvIGdlbmVyYXRlIHBlcnNvbmFsaXplZCBleGVyY2lzZXMhPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIH1cbiAgICAgICAgPlxuICAgICAgICAgIDxTaG93IHdoZW49e2N1cnJlbnRFeGVyY2lzZSgpfT5cbiAgICAgICAgICAgIHsoZXhlcmNpc2UpID0+IChcbiAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICA8UHJvZ3Jlc3NCYXIgXG4gICAgICAgICAgICAgICAgICBjdXJyZW50PXtjdXJyZW50RXhlcmNpc2VJbmRleCgpICsgMX0gXG4gICAgICAgICAgICAgICAgICB0b3RhbD17ZXhlcmNpc2VzKCk/Lmxlbmd0aCB8fCAwfSBcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxQcmFjdGljZUhlYWRlciBcbiAgICAgICAgICAgICAgICAgIHRpdGxlPXtwcm9wcy5oZWFkZXJUaXRsZSB8fCBcIlwifSBcbiAgICAgICAgICAgICAgICAgIG9uRXhpdD17cHJvcHMub25CYWNrfSBcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIDxtYWluIGNsYXNzPVwiZmxleC0xXCI+XG4gICAgICAgICAgICAgICAgICA8RXhlcmNpc2VUZW1wbGF0ZSBpbnN0cnVjdGlvblRleHQ9XCJSZWFkIGFsb3VkOlwiPlxuICAgICAgICAgICAgICAgICAgICA8UmVhZEFsb3VkXG4gICAgICAgICAgICAgICAgICAgICAgcHJvbXB0PXtleGVyY2lzZSgpLmZ1bGxfbGluZX1cbiAgICAgICAgICAgICAgICAgICAgICB1c2VyVHJhbnNjcmlwdD17dXNlclRyYW5zY3JpcHQoKX1cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgIDwvRXhlcmNpc2VUZW1wbGF0ZT5cbiAgICAgICAgICAgICAgICA8L21haW4+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgPFNob3dcbiAgICAgICAgICAgICAgICAgIHdoZW49e3Nob3dGZWVkYmFjaygpfVxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgICAgICA8RXhlcmNpc2VGb290ZXJcbiAgICAgICAgICAgICAgICAgICAgICBpc1JlY29yZGluZz17aXNSZWNvcmRpbmcoKX1cbiAgICAgICAgICAgICAgICAgICAgICBpc1Byb2Nlc3Npbmc9e2lzUHJvY2Vzc2luZygpfVxuICAgICAgICAgICAgICAgICAgICAgIGNhblN1Ym1pdD17dXNlclRyYW5zY3JpcHQoKS50cmltKCkubGVuZ3RoID4gMH1cbiAgICAgICAgICAgICAgICAgICAgICBvblJlY29yZD17aGFuZGxlU3RhcnRSZWNvcmRpbmd9XG4gICAgICAgICAgICAgICAgICAgICAgb25TdG9wPXtoYW5kbGVTdG9wUmVjb3JkaW5nfVxuICAgICAgICAgICAgICAgICAgICAgIG9uU3VibWl0PXtoYW5kbGVTdWJtaXR9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPFJlc3BvbnNlRm9vdGVyXG4gICAgICAgICAgICAgICAgICAgIG1vZGU9XCJmZWVkYmFja1wiXG4gICAgICAgICAgICAgICAgICAgIGlzQ29ycmVjdD17aXNDb3JyZWN0KCl9XG4gICAgICAgICAgICAgICAgICAgIG9uQ29udGludWU9e2hhbmRsZUNvbnRpbnVlfVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvU2hvdz5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBTaG93LCBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB7IFVzZXJQcm9maWxlIH0gZnJvbSAnLi4vVXNlclByb2ZpbGUnO1xuaW1wb3J0IHsgQ3JlZGl0UGFjayB9IGZyb20gJy4uL0NyZWRpdFBhY2snO1xuaW1wb3J0IHsgV2FsbGV0Q29ubmVjdCB9IGZyb20gJy4uL1dhbGxldENvbm5lY3QnO1xuaW1wb3J0IHsgRmFyY2FzdGVyS2FyYW9rZVZpZXcgfSBmcm9tICcuLi8uLi9rYXJhb2tlL0ZhcmNhc3RlckthcmFva2VWaWV3JztcbmltcG9ydCB0eXBlIHsgTHlyaWNMaW5lIH0gZnJvbSAnLi4vLi4va2FyYW9rZS9MeXJpY3NEaXNwbGF5JztcbmltcG9ydCB0eXBlIHsgTGVhZGVyYm9hcmRFbnRyeSB9IGZyb20gJy4uLy4uL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmFyY2FzdGVyTWluaUFwcFByb3BzIHtcbiAgLy8gVXNlciBpbmZvXG4gIHVzZXI/OiB7XG4gICAgZmlkPzogbnVtYmVyO1xuICAgIHVzZXJuYW1lPzogc3RyaW5nO1xuICAgIGRpc3BsYXlOYW1lPzogc3RyaW5nO1xuICAgIHBmcFVybD86IHN0cmluZztcbiAgfTtcbiAgXG4gIC8vIFdhbGxldFxuICB3YWxsZXRBZGRyZXNzPzogc3RyaW5nO1xuICB3YWxsZXRDaGFpbj86ICdCYXNlJyB8ICdTb2xhbmEnO1xuICBpc1dhbGxldENvbm5lY3RlZD86IGJvb2xlYW47XG4gIFxuICAvLyBDcmVkaXRzXG4gIHVzZXJDcmVkaXRzPzogbnVtYmVyO1xuICBcbiAgLy8gQ2FsbGJhY2tzXG4gIG9uQ29ubmVjdFdhbGxldD86ICgpID0+IHZvaWQ7XG4gIG9uRGlzY29ubmVjdFdhbGxldD86ICgpID0+IHZvaWQ7XG4gIG9uUHVyY2hhc2VDcmVkaXRzPzogKHBhY2s6IHsgY3JlZGl0czogbnVtYmVyOyBwcmljZTogc3RyaW5nOyBjdXJyZW5jeTogc3RyaW5nIH0pID0+IHZvaWQ7XG4gIG9uU2VsZWN0U29uZz86ICgpID0+IHZvaWQ7XG4gIFxuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEZhcmNhc3Rlck1pbmlBcHA6IENvbXBvbmVudDxGYXJjYXN0ZXJNaW5pQXBwUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtzaG93S2FyYW9rZSwgc2V0U2hvd0thcmFva2VdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgXG4gIC8vIE1vY2sgZGF0YSBmb3IgZGVtb1xuICBjb25zdCBtb2NrTHlyaWNzOiBMeXJpY0xpbmVbXSA9IFtcbiAgICB7IGlkOiAnMScsIHRleHQ6IFwiSXMgdGhpcyB0aGUgcmVhbCBsaWZlP1wiLCBzdGFydFRpbWU6IDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzInLCB0ZXh0OiBcIklzIHRoaXMganVzdCBmYW50YXN5P1wiLCBzdGFydFRpbWU6IDIwMDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzMnLCB0ZXh0OiBcIkNhdWdodCBpbiBhIGxhbmRzbGlkZVwiLCBzdGFydFRpbWU6IDQwMDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gICAgeyBpZDogJzQnLCB0ZXh0OiBcIk5vIGVzY2FwZSBmcm9tIHJlYWxpdHlcIiwgc3RhcnRUaW1lOiA2MDAwLCBkdXJhdGlvbjogMjAwMCB9LFxuICBdO1xuICBcbiAgY29uc3QgbW9ja0xlYWRlcmJvYXJkOiBMZWFkZXJib2FyZEVudHJ5W10gPSBbXG4gICAgeyByYW5rOiAxLCB1c2VybmFtZTogXCJhbGljZVwiLCBzY29yZTogOTgwIH0sXG4gICAgeyByYW5rOiAyLCB1c2VybmFtZTogXCJib2JcIiwgc2NvcmU6IDk0NSB9LFxuICAgIHsgcmFuazogMywgdXNlcm5hbWU6IFwiY2Fyb2xcIiwgc2NvcmU6IDkyMCB9LFxuICBdO1xuXG4gIGNvbnN0IGNyZWRpdFBhY2tzID0gW1xuICAgIHsgY3JlZGl0czogMjUwLCBwcmljZTogJzIuNTAnLCBjdXJyZW5jeTogJ1VTREMnIGFzIGNvbnN0IH0sXG4gICAgeyBjcmVkaXRzOiA1MDAsIHByaWNlOiAnNC43NScsIGN1cnJlbmN5OiAnVVNEQycgYXMgY29uc3QsIGRpc2NvdW50OiA1LCByZWNvbW1lbmRlZDogdHJ1ZSB9LFxuICAgIHsgY3JlZGl0czogMTIwMCwgcHJpY2U6ICcxMC4wMCcsIGN1cnJlbmN5OiAnVVNEQycgYXMgY29uc3QsIGRpc2NvdW50OiAxNiB9LFxuICBdO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgaC1zY3JlZW4gYmctYmFzZScsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogSGVhZGVyIHdpdGggdXNlciBwcm9maWxlICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2UgYm9yZGVyLWIgYm9yZGVyLXN1YnRsZVwiPlxuICAgICAgICA8VXNlclByb2ZpbGVcbiAgICAgICAgICBmaWQ9e3Byb3BzLnVzZXI/LmZpZH1cbiAgICAgICAgICB1c2VybmFtZT17cHJvcHMudXNlcj8udXNlcm5hbWV9XG4gICAgICAgICAgZGlzcGxheU5hbWU9e3Byb3BzLnVzZXI/LmRpc3BsYXlOYW1lfVxuICAgICAgICAgIHBmcFVybD17cHJvcHMudXNlcj8ucGZwVXJsfVxuICAgICAgICAgIGNyZWRpdHM9e3Byb3BzLnVzZXJDcmVkaXRzIHx8IDB9XG4gICAgICAgIC8+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgey8qIE1haW4gY29udGVudCAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgb3ZlcmZsb3ctYXV0b1wiPlxuICAgICAgICA8U2hvd1xuICAgICAgICAgIHdoZW49e3Nob3dLYXJhb2tlKCl9XG4gICAgICAgICAgZmFsbGJhY2s9e1xuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInAtNCBzcGFjZS15LTZcIj5cbiAgICAgICAgICAgICAgey8qIEhlcm8gc2VjdGlvbiAqL31cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIHB5LThcIj5cbiAgICAgICAgICAgICAgICA8aDEgY2xhc3M9XCJ0ZXh0LTN4bCBmb250LWJvbGQgbWItMlwiPlNjYXJsZXR0IEthcmFva2U8L2gxPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zZWNvbmRhcnlcIj5cbiAgICAgICAgICAgICAgICAgIFNpbmcgeW91ciBmYXZvcml0ZSBzb25ncyBhbmQgY29tcGV0ZSB3aXRoIGZyaWVuZHMhXG4gICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIHsvKiBDcmVkaXRzIGNoZWNrICovfVxuICAgICAgICAgICAgICA8U2hvd1xuICAgICAgICAgICAgICAgIHdoZW49e3Byb3BzLnVzZXJDcmVkaXRzICYmIHByb3BzLnVzZXJDcmVkaXRzID4gMH1cbiAgICAgICAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS02XCI+XG4gICAgICAgICAgICAgICAgICAgIHsvKiBXYWxsZXQgY29ubmVjdGlvbiAqL31cbiAgICAgICAgICAgICAgICAgICAgPFdhbGxldENvbm5lY3RcbiAgICAgICAgICAgICAgICAgICAgICBhZGRyZXNzPXtwcm9wcy53YWxsZXRBZGRyZXNzfVxuICAgICAgICAgICAgICAgICAgICAgIGNoYWluPXtwcm9wcy53YWxsZXRDaGFpbn1cbiAgICAgICAgICAgICAgICAgICAgICBpc0Nvbm5lY3RlZD17cHJvcHMuaXNXYWxsZXRDb25uZWN0ZWR9XG4gICAgICAgICAgICAgICAgICAgICAgb25Db25uZWN0PXtwcm9wcy5vbkNvbm5lY3RXYWxsZXR9XG4gICAgICAgICAgICAgICAgICAgICAgb25EaXNjb25uZWN0PXtwcm9wcy5vbkRpc2Nvbm5lY3RXYWxsZXR9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB7LyogQ3JlZGl0IHBhY2tzICovfVxuICAgICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5pc1dhbGxldENvbm5lY3RlZH0+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQteGwgZm9udC1zZW1pYm9sZCBtYi00XCI+UHVyY2hhc2UgQ3JlZGl0czwvaDI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtMyBnYXAtNFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7Y3JlZGl0UGFja3MubWFwKChwYWNrKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPENyZWRpdFBhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsuLi5wYWNrfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25QdXJjaGFzZT17KCkgPT4gcHJvcHMub25QdXJjaGFzZUNyZWRpdHM/LihwYWNrKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICB7LyogU29uZyBzZWxlY3Rpb24gKi99XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNFwiPlxuICAgICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC14bCBmb250LXNlbWlib2xkXCI+U2VsZWN0IGEgU29uZzwvaDI+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uIFxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBwLTQgYmctc3VyZmFjZSByb3VuZGVkLWxnIGJvcmRlciBib3JkZXItc3VidGxlIGhvdmVyOmJvcmRlci1hY2NlbnQtcHJpbWFyeSB0cmFuc2l0aW9uLWNvbG9ycyB0ZXh0LWxlZnRcIlxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93S2FyYW9rZSh0cnVlKX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZvbnQtc2VtaWJvbGRcIj5Cb2hlbWlhbiBSaGFwc29keTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeVwiPlF1ZWVuPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXhzIHRleHQtdGVydGlhcnkgbXQtMVwiPkNvc3Q6IDUwIGNyZWRpdHM8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICB9XG4gICAgICAgID5cbiAgICAgICAgICA8RmFyY2FzdGVyS2FyYW9rZVZpZXdcbiAgICAgICAgICAgIHNvbmdUaXRsZT1cIkJvaGVtaWFuIFJoYXBzb2R5XCJcbiAgICAgICAgICAgIGFydGlzdD1cIlF1ZWVuXCJcbiAgICAgICAgICAgIHNjb3JlPXswfVxuICAgICAgICAgICAgcmFuaz17MX1cbiAgICAgICAgICAgIGx5cmljcz17bW9ja0x5cmljc31cbiAgICAgICAgICAgIGN1cnJlbnRUaW1lPXswfVxuICAgICAgICAgICAgbGVhZGVyYm9hcmQ9e21vY2tMZWFkZXJib2FyZH1cbiAgICAgICAgICAgIGlzUGxheWluZz17ZmFsc2V9XG4gICAgICAgICAgICBvblN0YXJ0PXsoKSA9PiBjb25zb2xlLmxvZygnU3RhcnQga2FyYW9rZScpfVxuICAgICAgICAgICAgb25TcGVlZENoYW5nZT17KHNwZWVkKSA9PiBjb25zb2xlLmxvZygnU3BlZWQ6Jywgc3BlZWQpfVxuICAgICAgICAgICAgb25CYWNrPXsoKSA9PiBzZXRTaG93S2FyYW9rZShmYWxzZSl9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9TaG93PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgRm9yIH0gZnJvbSAnc29saWQtanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNvbmcge1xuICBpZDogc3RyaW5nO1xuICB0cmFja0lkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGFydGlzdDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhvbWVQYWdlUHJvcHMge1xuICBzb25nczogU29uZ1tdO1xuICBvblNvbmdTZWxlY3Q/OiAoc29uZzogU29uZykgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IEhvbWVQYWdlOiBDb21wb25lbnQ8SG9tZVBhZ2VQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3Qgc29uZ0l0ZW1TdHlsZSA9IHtcbiAgICBwYWRkaW5nOiAnMTZweCcsXG4gICAgJ21hcmdpbi1ib3R0b20nOiAnOHB4JyxcbiAgICAnYmFja2dyb3VuZC1jb2xvcic6ICcjMWExYTFhJyxcbiAgICAnYm9yZGVyLXJhZGl1cyc6ICc4cHgnLFxuICAgIGN1cnNvcjogJ3BvaW50ZXInXG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2PlxuICAgICAgPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAnMTZweCcsICdiYWNrZ3JvdW5kLWNvbG9yJzogJyMxYTFhMWEnIH19PlxuICAgICAgICA8aDEgc3R5bGU9e3sgbWFyZ2luOiAnMCAwIDhweCAwJywgJ2ZvbnQtc2l6ZSc6ICcyNHB4JyB9fT5Qb3B1bGFyIFNvbmdzPC9oMT5cbiAgICAgICAgPHAgc3R5bGU9e3sgbWFyZ2luOiAnMCcsIGNvbG9yOiAnIzg4OCcgfX0+Q2hvb3NlIGEgc29uZyB0byBzdGFydCBzaW5naW5nPC9wPlxuICAgICAgPC9kaXY+XG4gICAgICBcbiAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogJzE2cHgnIH19PlxuICAgICAgICA8Rm9yIGVhY2g9e3Byb3BzLnNvbmdzfT5cbiAgICAgICAgICB7KHNvbmcsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICA8ZGl2IFxuICAgICAgICAgICAgICBzdHlsZT17c29uZ0l0ZW1TdHlsZX1cbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gcHJvcHMub25Tb25nU2VsZWN0Py4oc29uZyl9XG4gICAgICAgICAgICAgIG9uTW91c2VFbnRlcj17KGUpID0+IGUuY3VycmVudFRhcmdldC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnIzJhMmEyYSd9XG4gICAgICAgICAgICAgIG9uTW91c2VMZWF2ZT17KGUpID0+IGUuY3VycmVudFRhcmdldC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnIzFhMWExYSd9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBnYXA6ICcxNnB4JyB9fT5cbiAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17eyBjb2xvcjogJyM2NjYnIH19PntpbmRleCgpICsgMX08L3NwYW4+XG4gICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgJ2ZvbnQtd2VpZ2h0JzogJ2JvbGQnIH19Pntzb25nLnRpdGxlfTwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBjb2xvcjogJyM4ODgnIH19Pntzb25nLmFydGlzdH08L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApfVxuICAgICAgICA8L0Zvcj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIG9uQ2xlYW51cCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgTHlyaWNMaW5lIH0gZnJvbSAnLi4vY29tcG9uZW50cy9rYXJhb2tlL0x5cmljc0Rpc3BsYXknO1xuaW1wb3J0IHsgY3JlYXRlS2FyYW9rZUF1ZGlvUHJvY2Vzc29yIH0gZnJvbSAnLi4vc2VydmljZXMvYXVkaW8va2FyYW9rZUF1ZGlvUHJvY2Vzc29yJztcbmltcG9ydCB7IHNob3VsZENodW5rTGluZXMsIGNhbGN1bGF0ZVJlY29yZGluZ0R1cmF0aW9uIH0gZnJvbSAnLi4vc2VydmljZXMva2FyYW9rZS9jaHVua2luZ1V0aWxzJztcbmltcG9ydCB7IEthcmFva2VBcGlTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMva2FyYW9rZS9rYXJhb2tlQXBpJztcbmltcG9ydCB0eXBlIHsgQ2h1bmtJbmZvIH0gZnJvbSAnQHNjYXJsZXR0L2NvcmUnO1xuaW1wb3J0IHR5cGUgeyBQbGF5YmFja1NwZWVkIH0gZnJvbSAnLi4vY29tcG9uZW50cy9jb21tb24vU3BsaXRCdXR0b24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFVzZUthcmFva2VTZXNzaW9uT3B0aW9ucyB7XG4gIGx5cmljczogTHlyaWNMaW5lW107XG4gIG9uQ29tcGxldGU/OiAocmVzdWx0czogS2FyYW9rZVJlc3VsdHMpID0+IHZvaWQ7XG4gIGF1ZGlvRWxlbWVudD86IEhUTUxBdWRpb0VsZW1lbnQ7XG4gIHRyYWNrSWQ/OiBzdHJpbmc7XG4gIHNvbmdEYXRhPzoge1xuICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgYXJ0aXN0OiBzdHJpbmc7XG4gICAgYWxidW0/OiBzdHJpbmc7XG4gICAgZHVyYXRpb24/OiBudW1iZXI7XG4gIH07XG4gIHNvbmdDYXRhbG9nSWQ/OiBzdHJpbmc7XG4gIGFwaVVybD86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlUmVzdWx0cyB7XG4gIHNjb3JlOiBudW1iZXI7XG4gIGFjY3VyYWN5OiBudW1iZXI7XG4gIHRvdGFsTGluZXM6IG51bWJlcjtcbiAgcGVyZmVjdExpbmVzOiBudW1iZXI7XG4gIGdvb2RMaW5lczogbnVtYmVyO1xuICBuZWVkc1dvcmtMaW5lczogbnVtYmVyO1xuICBzZXNzaW9uSWQ/OiBzdHJpbmc7XG4gIGlzTG9hZGluZz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGluZVNjb3JlIHtcbiAgbGluZUluZGV4OiBudW1iZXI7XG4gIHNjb3JlOiBudW1iZXI7XG4gIHRyYW5zY3JpcHRpb246IHN0cmluZztcbiAgZmVlZGJhY2s/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VLYXJhb2tlU2Vzc2lvbihvcHRpb25zOiBVc2VLYXJhb2tlU2Vzc2lvbk9wdGlvbnMpIHtcbiAgY29uc3QgW2lzUGxheWluZywgc2V0SXNQbGF5aW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtjdXJyZW50VGltZSwgc2V0Q3VycmVudFRpbWVdID0gY3JlYXRlU2lnbmFsKDApO1xuICBjb25zdCBbc2NvcmUsIHNldFNjb3JlXSA9IGNyZWF0ZVNpZ25hbCgwKTtcbiAgY29uc3QgW2NvdW50ZG93biwgc2V0Q291bnRkb3duXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW3Nlc3Npb25JZCwgc2V0U2Vzc2lvbklkXSA9IGNyZWF0ZVNpZ25hbDxzdHJpbmcgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2xpbmVTY29yZXMsIHNldExpbmVTY29yZXNdID0gY3JlYXRlU2lnbmFsPExpbmVTY29yZVtdPihbXSk7XG4gIGNvbnN0IFtjdXJyZW50Q2h1bmssIHNldEN1cnJlbnRDaHVua10gPSBjcmVhdGVTaWduYWw8Q2h1bmtJbmZvIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtpc1JlY29yZGluZywgc2V0SXNSZWNvcmRpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2F1ZGlvRWxlbWVudCwgc2V0QXVkaW9FbGVtZW50XSA9IGNyZWF0ZVNpZ25hbDxIVE1MQXVkaW9FbGVtZW50IHwgdW5kZWZpbmVkPihvcHRpb25zLmF1ZGlvRWxlbWVudCk7XG4gIGNvbnN0IFtyZWNvcmRlZENodW5rcywgc2V0UmVjb3JkZWRDaHVua3NdID0gY3JlYXRlU2lnbmFsPFNldDxudW1iZXI+PihuZXcgU2V0KCkpO1xuICBjb25zdCBbcGxheWJhY2tTcGVlZCwgc2V0UGxheWJhY2tTcGVlZF0gPSBjcmVhdGVTaWduYWw8UGxheWJhY2tTcGVlZD4oJzF4Jyk7XG4gIFxuICBsZXQgYXVkaW9VcGRhdGVJbnRlcnZhbDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gIGxldCByZWNvcmRpbmdUaW1lb3V0OiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgXG4gIGNvbnN0IGF1ZGlvUHJvY2Vzc29yID0gY3JlYXRlS2FyYW9rZUF1ZGlvUHJvY2Vzc29yKHtcbiAgICBzYW1wbGVSYXRlOiAxNjAwMFxuICB9KTtcbiAgXG4gIGNvbnN0IGthcmFva2VBcGkgPSBuZXcgS2FyYW9rZUFwaVNlcnZpY2Uob3B0aW9ucy5hcGlVcmwpO1xuXG4gIC8vIEhlbHBlciB0byBjb252ZXJ0IHNwZWVkIHRvIHBsYXliYWNrIHJhdGVcbiAgY29uc3QgZ2V0UGxheWJhY2tSYXRlID0gKHNwZWVkOiBQbGF5YmFja1NwZWVkKTogbnVtYmVyID0+IHtcbiAgICBzd2l0Y2ggKHNwZWVkKSB7XG4gICAgICBjYXNlICcwLjV4JzogcmV0dXJuIDAuNTtcbiAgICAgIGNhc2UgJzAuNzV4JzogcmV0dXJuIDAuNzU7XG4gICAgICBjYXNlICcxeCc6IHJldHVybiAxLjA7XG4gICAgICBkZWZhdWx0OiByZXR1cm4gMS4wO1xuICAgIH1cbiAgfTtcblxuICAvLyBIZWxwZXIgdG8gZ2V0IHNwZWVkIG11bHRpcGxpZXIgZm9yIHNjb3JpbmdcbiAgY29uc3QgZ2V0U3BlZWRNdWx0aXBsaWVyID0gKHNwZWVkOiBQbGF5YmFja1NwZWVkKTogbnVtYmVyID0+IHtcbiAgICBzd2l0Y2ggKHNwZWVkKSB7XG4gICAgICBjYXNlICcwLjV4JzogcmV0dXJuIDEuMjsgIC8vIDIwJSBzY29yZSBib29zdCBmb3Igc2xvd2VzdCBzcGVlZFxuICAgICAgY2FzZSAnMC43NXgnOiByZXR1cm4gMS4xOyAvLyAxMCUgc2NvcmUgYm9vc3QgZm9yIG1lZGl1bSBzcGVlZFxuICAgICAgY2FzZSAnMXgnOiByZXR1cm4gMS4wOyAgICAvLyBObyBhZGp1c3RtZW50IGZvciBub3JtYWwgc3BlZWRcbiAgICAgIGRlZmF1bHQ6IHJldHVybiAxLjA7XG4gICAgfVxuICB9O1xuXG4gIC8vIEhhbmRsZSBzcGVlZCBjaGFuZ2VcbiAgY29uc3QgaGFuZGxlU3BlZWRDaGFuZ2UgPSAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpID0+IHtcbiAgICBzZXRQbGF5YmFja1NwZWVkKHNwZWVkKTtcbiAgICBjb25zdCBhdWRpbyA9IGF1ZGlvRWxlbWVudCgpO1xuICAgIGlmIChhdWRpbykge1xuICAgICAgY29uc3QgcmF0ZSA9IGdldFBsYXliYWNrUmF0ZShzcGVlZCk7XG4gICAgICBhdWRpby5wbGF5YmFja1JhdGUgPSByYXRlO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBzdGFydFNlc3Npb24gPSBhc3luYyAoKSA9PiB7XG4gICAgLy8gSW5pdGlhbGl6ZSBhdWRpbyBjYXB0dXJlXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGF1ZGlvUHJvY2Vzc29yLmluaXRpYWxpemUoKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VTZXNzaW9uXSBGYWlsZWQgdG8gaW5pdGlhbGl6ZSBhdWRpbzonLCBlcnJvcik7XG4gICAgfVxuICAgIFxuICAgIC8vIENyZWF0ZSBzZXNzaW9uIG9uIHNlcnZlciBpZiB0cmFja0lkIHByb3ZpZGVkXG4gICAgXG4gICAgaWYgKG9wdGlvbnMudHJhY2tJZCAmJiBvcHRpb25zLnNvbmdEYXRhKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQga2FyYW9rZUFwaS5zdGFydFNlc3Npb24oXG4gICAgICAgICAgb3B0aW9ucy50cmFja0lkLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRpdGxlOiBvcHRpb25zLnNvbmdEYXRhLnRpdGxlLFxuICAgICAgICAgICAgYXJ0aXN0OiBvcHRpb25zLnNvbmdEYXRhLmFydGlzdCxcbiAgICAgICAgICAgIGR1cmF0aW9uOiBvcHRpb25zLnNvbmdEYXRhLmR1cmF0aW9uLFxuICAgICAgICAgICAgZGlmZmljdWx0eTogJ2ludGVybWVkaWF0ZScsIC8vIERlZmF1bHQgZGlmZmljdWx0eVxuICAgICAgICAgIH0sXG4gICAgICAgICAgdW5kZWZpbmVkLCAvLyBhdXRoVG9rZW5cbiAgICAgICAgICBvcHRpb25zLnNvbmdDYXRhbG9nSWQsXG4gICAgICAgICAgcGxheWJhY2tTcGVlZCgpXG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICBpZiAoc2Vzc2lvbikge1xuICAgICAgICAgIHNldFNlc3Npb25JZChzZXNzaW9uLmlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBjcmVhdGUgc2Vzc2lvbicpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBjcmVhdGUgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICB9XG4gICAgXG4gICAgLy8gU3RhcnQgY291bnRkb3duXG4gICAgc2V0Q291bnRkb3duKDMpO1xuICAgIFxuICAgIGNvbnN0IGNvdW50ZG93bkludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudCA9IGNvdW50ZG93bigpO1xuICAgICAgaWYgKGN1cnJlbnQgIT09IG51bGwgJiYgY3VycmVudCA+IDEpIHtcbiAgICAgICAgc2V0Q291bnRkb3duKGN1cnJlbnQgLSAxKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwoY291bnRkb3duSW50ZXJ2YWwpO1xuICAgICAgICBzZXRDb3VudGRvd24obnVsbCk7XG4gICAgICAgIHN0YXJ0UGxheWJhY2soKTtcbiAgICAgIH1cbiAgICB9LCAxMDAwKTtcbiAgfTtcblxuICBjb25zdCBzdGFydFBsYXliYWNrID0gKCkgPT4ge1xuICAgIHNldElzUGxheWluZyh0cnVlKTtcbiAgICBcbiAgICAvLyBTdGFydCBmdWxsIHNlc3Npb24gYXVkaW8gY2FwdHVyZVxuICAgIGF1ZGlvUHJvY2Vzc29yLnN0YXJ0RnVsbFNlc3Npb24oKTtcbiAgICBcbiAgICBjb25zdCBhdWRpbyA9IGF1ZGlvRWxlbWVudCgpIHx8IG9wdGlvbnMuYXVkaW9FbGVtZW50O1xuICAgIGlmIChhdWRpbykge1xuICAgICAgLy8gU2V0IHBsYXliYWNrIHJhdGUgYmFzZWQgb24gY3VycmVudCBzcGVlZFxuICAgICAgY29uc3QgcmF0ZSA9IGdldFBsYXliYWNrUmF0ZShwbGF5YmFja1NwZWVkKCkpO1xuICAgICAgYXVkaW8ucGxheWJhY2tSYXRlID0gcmF0ZTtcbiAgICAgIC8vIElmIGF1ZGlvIGVsZW1lbnQgaXMgcHJvdmlkZWQsIHVzZSBpdFxuICAgICAgYXVkaW8ucGxheSgpLmNhdGNoKGNvbnNvbGUuZXJyb3IpO1xuICAgICAgXG4gICAgICBjb25zdCB1cGRhdGVUaW1lID0gKCkgPT4ge1xuICAgICAgICBjb25zdCB0aW1lID0gYXVkaW8uY3VycmVudFRpbWUgKiAxMDAwO1xuICAgICAgICBzZXRDdXJyZW50VGltZSh0aW1lKTtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIHdlIG5lZWQgdG8gc3RhcnQgcmVjb3JkaW5nIGZvciB1cGNvbWluZyBsaW5lc1xuICAgICAgICBjaGVja0ZvclVwY29taW5nTGluZXModGltZSk7XG4gICAgICB9O1xuICAgICAgXG4gICAgICBhdWRpb1VwZGF0ZUludGVydmFsID0gc2V0SW50ZXJ2YWwodXBkYXRlVGltZSwgMTAwKSBhcyB1bmtub3duIGFzIG51bWJlcjtcbiAgICAgIFxuICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCBoYW5kbGVFbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgY2hlY2tGb3JVcGNvbWluZ0xpbmVzID0gKGN1cnJlbnRUaW1lTXM6IG51bWJlcikgPT4ge1xuICAgIGlmIChpc1JlY29yZGluZygpIHx8ICFvcHRpb25zLmx5cmljcy5sZW5ndGgpIHJldHVybjtcbiAgICBcbiAgICBjb25zdCByZWNvcmRlZCA9IHJlY29yZGVkQ2h1bmtzKCk7XG4gICAgXG4gICAgLy8gTG9vayBmb3IgY2h1bmtzIHRoYXQgc2hvdWxkIHN0YXJ0IHJlY29yZGluZyBzb29uXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmx5cmljcy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gU2tpcCBpZiB3ZSd2ZSBhbHJlYWR5IHJlY29yZGVkIGEgY2h1bmsgc3RhcnRpbmcgYXQgdGhpcyBpbmRleFxuICAgICAgaWYgKHJlY29yZGVkLmhhcyhpKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgY2h1bmsgPSBzaG91bGRDaHVua0xpbmVzKG9wdGlvbnMubHlyaWNzLCBpKTtcbiAgICAgIGNvbnN0IGZpcnN0TGluZSA9IG9wdGlvbnMubHlyaWNzW2NodW5rLnN0YXJ0SW5kZXhdO1xuICAgICAgXG4gICAgICBpZiAoZmlyc3RMaW5lICYmIGZpcnN0TGluZS5zdGFydFRpbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCByZWNvcmRpbmdTdGFydFRpbWUgPSBmaXJzdExpbmUuc3RhcnRUaW1lICogMTAwMCAtIDEwMDA7IC8vIFN0YXJ0IDFzIGVhcmx5XG4gICAgICAgIGNvbnN0IGxpbmVTdGFydFRpbWUgPSBmaXJzdExpbmUuc3RhcnRUaW1lICogMTAwMDtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIHdlJ3JlIGluIHRoZSByZWNvcmRpbmcgd2luZG93IGFuZCBoYXZlbid0IHBhc3NlZCB0aGUgbGluZSBzdGFydFxuICAgICAgICBpZiAoY3VycmVudFRpbWVNcyA+PSByZWNvcmRpbmdTdGFydFRpbWUgJiYgY3VycmVudFRpbWVNcyA8IGxpbmVTdGFydFRpbWUgKyA1MDApIHsgLy8gQWxsb3cgNTAwbXMgYnVmZmVyIGFmdGVyIGxpbmUgc3RhcnRcbiAgICAgICAgICAvLyBNYXJrIHRoaXMgY2h1bmsgYXMgcmVjb3JkZWRcbiAgICAgICAgICBzZXRSZWNvcmRlZENodW5rcyhwcmV2ID0+IG5ldyBTZXQocHJldikuYWRkKGNodW5rLnN0YXJ0SW5kZXgpKTtcbiAgICAgICAgICAvLyBTdGFydCByZWNvcmRpbmcgdGhpcyBjaHVua1xuICAgICAgICAgIHN0YXJ0UmVjb3JkaW5nQ2h1bmsoY2h1bmspO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFNraXAgYWhlYWQgdG8gYXZvaWQgY2hlY2tpbmcgbGluZXMgd2UndmUgYWxyZWFkeSBwYXNzZWRcbiAgICAgIGkgPSBjaHVuay5lbmRJbmRleDtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBzdGFydFJlY29yZGluZ0NodW5rID0gYXN5bmMgKGNodW5rOiBDaHVua0luZm8pID0+IHtcbiAgICAvLyBURVNUSU5HIE1PREU6IEF1dG8tY29tcGxldGUgYWZ0ZXIgNSBsaW5lc1xuICAgIGlmIChjaHVuay5zdGFydEluZGV4ID49IDUpIHtcbiAgICAgIGhhbmRsZUVuZCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICBzZXRDdXJyZW50Q2h1bmsoY2h1bmspO1xuICAgIHNldElzUmVjb3JkaW5nKHRydWUpO1xuICAgIFxuICAgIC8vIFN0YXJ0IGF1ZGlvIGNhcHR1cmUgZm9yIHRoaXMgY2h1bmtcbiAgICBhdWRpb1Byb2Nlc3Nvci5zdGFydFJlY29yZGluZ0xpbmUoY2h1bmsuc3RhcnRJbmRleCk7XG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlIHJlY29yZGluZyBkdXJhdGlvbiBhZGp1c3RlZCBmb3IgcGxheWJhY2sgc3BlZWRcbiAgICBjb25zdCBiYXNlRHVyYXRpb24gPSBjYWxjdWxhdGVSZWNvcmRpbmdEdXJhdGlvbihvcHRpb25zLmx5cmljcywgY2h1bmspO1xuICAgIGNvbnN0IHNwZWVkRmFjdG9yID0gMSAvIGdldFBsYXliYWNrUmF0ZShwbGF5YmFja1NwZWVkKCkpOyAvLyBJbnZlcnNlIG9mIHBsYXliYWNrIHJhdGVcbiAgICBjb25zdCBkdXJhdGlvbiA9IGJhc2VEdXJhdGlvbiAqIHNwZWVkRmFjdG9yO1xuICAgIFxuICAgIC8vIFN0b3AgcmVjb3JkaW5nIGFmdGVyIGR1cmF0aW9uXG4gICAgcmVjb3JkaW5nVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgc3RvcFJlY29yZGluZ0NodW5rKCk7XG4gICAgfSwgZHVyYXRpb24pIGFzIHVua25vd24gYXMgbnVtYmVyO1xuICB9O1xuICBcbiAgY29uc3Qgc3RvcFJlY29yZGluZ0NodW5rID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IGNodW5rID0gY3VycmVudENodW5rKCk7XG4gICAgaWYgKCFjaHVuaykgcmV0dXJuO1xuICAgIFxuICAgIHNldElzUmVjb3JkaW5nKGZhbHNlKTtcbiAgICBcbiAgICAvLyBHZXQgdGhlIHJlY29yZGVkIGF1ZGlvXG4gICAgY29uc3QgYXVkaW9DaHVua3MgPSBhdWRpb1Byb2Nlc3Nvci5zdG9wUmVjb3JkaW5nTGluZUFuZEdldFJhd0F1ZGlvKCk7XG4gICAgY29uc3Qgd2F2QmxvYiA9IGF1ZGlvUHJvY2Vzc29yLmNvbnZlcnRBdWRpb1RvV2F2QmxvYihhdWRpb0NodW5rcyk7XG4gICAgXG4gICAgXG4gICAgLy8gQ2hlY2sgaWYgd2UgaGF2ZSBlbm91Z2ggYXVkaW8gZGF0YVxuICAgIGlmICh3YXZCbG9iICYmIHdhdkJsb2Iuc2l6ZSA+IDEwMDAgJiYgc2Vzc2lvbklkKCkpIHsgLy8gTWluaW11bSAxS0Igb2YgYXVkaW8gZGF0YVxuICAgICAgLy8gQ29udmVydCB0byBiYXNlNjQgZm9yIEFQSVxuICAgICAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGJhc2U2NEF1ZGlvID0gcmVhZGVyLnJlc3VsdD8udG9TdHJpbmcoKS5zcGxpdCgnLCcpWzFdO1xuICAgICAgICBpZiAoYmFzZTY0QXVkaW8gJiYgYmFzZTY0QXVkaW8ubGVuZ3RoID4gMTAwKSB7IC8vIEVuc3VyZSB3ZSBoYXZlIG1lYW5pbmdmdWwgYmFzZTY0IGRhdGFcbiAgICAgICAgICBhd2FpdCBncmFkZUNodW5rKGNodW5rLCBiYXNlNjRBdWRpbyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB9XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwod2F2QmxvYik7XG4gICAgfSBlbHNlIGlmICh3YXZCbG9iICYmIHdhdkJsb2Iuc2l6ZSA8PSAxMDAwKSB7XG4gICAgICAvLyBBZGQgYSBuZXV0cmFsIHNjb3JlIGZvciBVSSBmZWVkYmFja1xuICAgICAgc2V0TGluZVNjb3JlcyhwcmV2ID0+IFsuLi5wcmV2LCB7XG4gICAgICAgIGxpbmVJbmRleDogY2h1bmsuc3RhcnRJbmRleCxcbiAgICAgICAgc2NvcmU6IDUwLFxuICAgICAgICB0cmFuc2NyaXB0aW9uOiAnJyxcbiAgICAgICAgZmVlZGJhY2s6ICdSZWNvcmRpbmcgdG9vIHNob3J0J1xuICAgICAgfV0pO1xuICAgIH0gZWxzZSBpZiAod2F2QmxvYiAmJiAhc2Vzc2lvbklkKCkpIHtcbiAgICB9XG4gICAgXG4gICAgc2V0Q3VycmVudENodW5rKG51bGwpO1xuICAgIFxuICAgIGlmIChyZWNvcmRpbmdUaW1lb3V0KSB7XG4gICAgICBjbGVhclRpbWVvdXQocmVjb3JkaW5nVGltZW91dCk7XG4gICAgICByZWNvcmRpbmdUaW1lb3V0ID0gbnVsbDtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBncmFkZUNodW5rID0gYXN5bmMgKGNodW5rOiBDaHVua0luZm8sIGF1ZGlvQmFzZTY0OiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjdXJyZW50U2Vzc2lvbklkID0gc2Vzc2lvbklkKCk7XG4gICAgXG4gICAgaWYgKCFjdXJyZW50U2Vzc2lvbklkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBsaW5lU2NvcmUgPSBhd2FpdCBrYXJhb2tlQXBpLmdyYWRlUmVjb3JkaW5nKFxuICAgICAgICBjdXJyZW50U2Vzc2lvbklkLFxuICAgICAgICBjaHVuay5zdGFydEluZGV4LFxuICAgICAgICBhdWRpb0Jhc2U2NCxcbiAgICAgICAgY2h1bmsuZXhwZWN0ZWRUZXh0LFxuICAgICAgICBvcHRpb25zLmx5cmljc1tjaHVuay5zdGFydEluZGV4XT8uc3RhcnRUaW1lIHx8IDAsXG4gICAgICAgIChvcHRpb25zLmx5cmljc1tjaHVuay5lbmRJbmRleF0/LnN0YXJ0VGltZSB8fCAwKSArIChvcHRpb25zLmx5cmljc1tjaHVuay5lbmRJbmRleF0/LmR1cmF0aW9uIHx8IDApIC8gMTAwMCxcbiAgICAgICAgdW5kZWZpbmVkLCAvLyBhdXRoVG9rZW5cbiAgICAgICAgcGxheWJhY2tTcGVlZCgpXG4gICAgICApO1xuICAgICAgXG4gICAgICBpZiAobGluZVNjb3JlKSB7XG4gICAgICAgIFxuICAgICAgICAvLyBBcHBseSBzcGVlZCBtdWx0aXBsaWVyIHRvIHNjb3JlIGZvciBsYW5ndWFnZSBsZWFybmVyc1xuICAgICAgICBjb25zdCBzcGVlZE11bHRpcGxpZXIgPSBnZXRTcGVlZE11bHRpcGxpZXIocGxheWJhY2tTcGVlZCgpKTtcbiAgICAgICAgY29uc3QgYWRqdXN0ZWRTY29yZSA9IE1hdGgubWluKDEwMCwgTWF0aC5yb3VuZChsaW5lU2NvcmUuc2NvcmUgKiBzcGVlZE11bHRpcGxpZXIpKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFVwZGF0ZSBsaW5lIHNjb3Jlc1xuICAgICAgICBjb25zdCBuZXdMaW5lU2NvcmUgPSB7XG4gICAgICAgICAgbGluZUluZGV4OiBjaHVuay5zdGFydEluZGV4LFxuICAgICAgICAgIHNjb3JlOiBhZGp1c3RlZFNjb3JlLFxuICAgICAgICAgIHRyYW5zY3JpcHRpb246IGxpbmVTY29yZS50cmFuc2NyaXB0IHx8ICcnLFxuICAgICAgICAgIGZlZWRiYWNrOiBsaW5lU2NvcmUuZmVlZGJhY2tcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIHNldExpbmVTY29yZXMocHJldiA9PiBbLi4ucHJldiwgbmV3TGluZVNjb3JlXSk7XG4gICAgICAgIFxuICAgICAgICAvLyBVcGRhdGUgdG90YWwgc2NvcmUgKHNpbXBsZSBhdmVyYWdlIGZvciBub3cpIC0gdXNlIHByZXYgdG8gYXZvaWQgZGVwZW5kZW5jeVxuICAgICAgICBzZXRTY29yZShwcmV2ID0+IHtcbiAgICAgICAgICBjb25zdCBhbGxTY29yZXMgPSBbLi4ubGluZVNjb3JlcygpLCBuZXdMaW5lU2NvcmVdO1xuICAgICAgICAgIGNvbnN0IGF2Z1Njb3JlID0gYWxsU2NvcmVzLnJlZHVjZSgoc3VtLCBzKSA9PiBzdW0gKyBzLnNjb3JlLCAwKSAvIGFsbFNjb3Jlcy5sZW5ndGg7XG4gICAgICAgICAgcmV0dXJuIE1hdGgucm91bmQoYXZnU2NvcmUpO1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIC8vIFJlbW92ZWQgdGVzdCBtb2RlIGxpbWl0XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBcbiAgICAgICAgLy8gQWRkIGEgbmV1dHJhbCBzY29yZSBmb3IgVUkgZmVlZGJhY2tcbiAgICAgICAgc2V0TGluZVNjb3JlcyhwcmV2ID0+IFsuLi5wcmV2LCB7XG4gICAgICAgICAgbGluZUluZGV4OiBjaHVuay5zdGFydEluZGV4LFxuICAgICAgICAgIHNjb3JlOiA1MCwgLy8gTmV1dHJhbCBzY29yZVxuICAgICAgICAgIHRyYW5zY3JpcHRpb246ICcnLFxuICAgICAgICAgIGZlZWRiYWNrOiAnRmFpbGVkIHRvIGdyYWRlIHJlY29yZGluZydcbiAgICAgICAgfV0pO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBncmFkZSBjaHVuazonLCBlcnJvcik7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUVuZCA9IGFzeW5jICgpID0+IHtcbiAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgIGlmIChhdWRpb1VwZGF0ZUludGVydmFsKSB7XG4gICAgICBjbGVhckludGVydmFsKGF1ZGlvVXBkYXRlSW50ZXJ2YWwpO1xuICAgIH1cbiAgICBcbiAgICAvLyBQYXVzZSB0aGUgYXVkaW9cbiAgICBjb25zdCBhdWRpbyA9IGF1ZGlvRWxlbWVudCgpIHx8IG9wdGlvbnMuYXVkaW9FbGVtZW50O1xuICAgIGlmIChhdWRpbyAmJiAhYXVkaW8ucGF1c2VkKSB7XG4gICAgICBhdWRpby5wYXVzZSgpO1xuICAgIH1cbiAgICBcbiAgICAvLyBTdG9wIGFueSBvbmdvaW5nIHJlY29yZGluZ1xuICAgIGlmIChpc1JlY29yZGluZygpKSB7XG4gICAgICBhd2FpdCBzdG9wUmVjb3JkaW5nQ2h1bmsoKTtcbiAgICB9XG4gICAgXG4gICAgLy8gU2hvdyBsb2FkaW5nIHN0YXRlIGltbWVkaWF0ZWx5XG4gICAgY29uc3QgbG9hZGluZ1Jlc3VsdHM6IEthcmFva2VSZXN1bHRzID0ge1xuICAgICAgc2NvcmU6IC0xLCAvLyBTcGVjaWFsIHZhbHVlIHRvIGluZGljYXRlIGxvYWRpbmdcbiAgICAgIGFjY3VyYWN5OiAwLFxuICAgICAgdG90YWxMaW5lczogbGluZVNjb3JlcygpLmxlbmd0aCxcbiAgICAgIHBlcmZlY3RMaW5lczogMCxcbiAgICAgIGdvb2RMaW5lczogMCxcbiAgICAgIG5lZWRzV29ya0xpbmVzOiAwLFxuICAgICAgc2Vzc2lvbklkOiBzZXNzaW9uSWQoKSB8fCB1bmRlZmluZWQsXG4gICAgICBpc0xvYWRpbmc6IHRydWVcbiAgICB9O1xuICAgIG9wdGlvbnMub25Db21wbGV0ZT8uKGxvYWRpbmdSZXN1bHRzKTtcbiAgICBcbiAgICAvLyBHZXQgZnVsbCBzZXNzaW9uIGF1ZGlvXG4gICAgY29uc3QgZnVsbEF1ZGlvQmxvYiA9IGF1ZGlvUHJvY2Vzc29yLnN0b3BGdWxsU2Vzc2lvbkFuZEdldFdhdigpO1xuICAgIFxuICAgIC8vIENvbXBsZXRlIHNlc3Npb24gb24gc2VydmVyXG4gICAgY29uc3QgY3VycmVudFNlc3Npb25JZCA9IHNlc3Npb25JZCgpO1xuICAgIGlmIChjdXJyZW50U2Vzc2lvbklkICYmIGZ1bGxBdWRpb0Jsb2IgJiYgZnVsbEF1ZGlvQmxvYi5zaXplID4gMTAwMCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgICAgcmVhZGVyLm9ubG9hZGVuZCA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zdCBiYXNlNjRBdWRpbyA9IHJlYWRlci5yZXN1bHQ/LnRvU3RyaW5nKCkuc3BsaXQoJywnKVsxXTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBzZXNzaW9uUmVzdWx0cyA9IGF3YWl0IGthcmFva2VBcGkuY29tcGxldGVTZXNzaW9uKFxuICAgICAgICAgICAgY3VycmVudFNlc3Npb25JZCxcbiAgICAgICAgICAgIGJhc2U2NEF1ZGlvXG4gICAgICAgICAgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoc2Vzc2lvblJlc3VsdHMpIHtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgcmVzdWx0czogS2FyYW9rZVJlc3VsdHMgPSB7XG4gICAgICAgICAgICAgIHNjb3JlOiBzZXNzaW9uUmVzdWx0cy5maW5hbFNjb3JlLFxuICAgICAgICAgICAgICBhY2N1cmFjeTogc2Vzc2lvblJlc3VsdHMuYWNjdXJhY3ksXG4gICAgICAgICAgICAgIHRvdGFsTGluZXM6IHNlc3Npb25SZXN1bHRzLnRvdGFsTGluZXMsXG4gICAgICAgICAgICAgIHBlcmZlY3RMaW5lczogc2Vzc2lvblJlc3VsdHMucGVyZmVjdExpbmVzLFxuICAgICAgICAgICAgICBnb29kTGluZXM6IHNlc3Npb25SZXN1bHRzLmdvb2RMaW5lcyxcbiAgICAgICAgICAgICAgbmVlZHNXb3JrTGluZXM6IHNlc3Npb25SZXN1bHRzLm5lZWRzV29ya0xpbmVzLFxuICAgICAgICAgICAgICBzZXNzaW9uSWQ6IGN1cnJlbnRTZXNzaW9uSWRcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIG9wdGlvbnMub25Db21wbGV0ZT8uKHJlc3VsdHMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBsb2NhbCBjYWxjdWxhdGlvblxuICAgICAgICAgICAgY2FsY3VsYXRlTG9jYWxSZXN1bHRzKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICByZWFkZXIucmVhZEFzRGF0YVVSTChmdWxsQXVkaW9CbG9iKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIGNvbXBsZXRlIHNlc3Npb246JywgZXJyb3IpO1xuICAgICAgICBjYWxjdWxhdGVMb2NhbFJlc3VsdHMoKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm8gc2Vzc2lvbiwganVzdCByZXR1cm4gbG9jYWwgcmVzdWx0c1xuICAgICAgY2FsY3VsYXRlTG9jYWxSZXN1bHRzKCk7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgY2FsY3VsYXRlTG9jYWxSZXN1bHRzID0gKCkgPT4ge1xuICAgIGNvbnN0IHNjb3JlcyA9IGxpbmVTY29yZXMoKTtcbiAgICBjb25zdCBhdmdTY29yZSA9IHNjb3Jlcy5sZW5ndGggPiAwIFxuICAgICAgPyBzY29yZXMucmVkdWNlKChzdW0sIHMpID0+IHN1bSArIHMuc2NvcmUsIDApIC8gc2NvcmVzLmxlbmd0aFxuICAgICAgOiAwO1xuICAgIFxuICAgIGNvbnN0IHJlc3VsdHM6IEthcmFva2VSZXN1bHRzID0ge1xuICAgICAgc2NvcmU6IE1hdGgucm91bmQoYXZnU2NvcmUpLFxuICAgICAgYWNjdXJhY3k6IE1hdGgucm91bmQoYXZnU2NvcmUpLFxuICAgICAgdG90YWxMaW5lczogc2NvcmVzLmxlbmd0aCwgLy8gVXNlIGFjdHVhbCBjb21wbGV0ZWQgbGluZXMgZm9yIHRlc3QgbW9kZVxuICAgICAgcGVyZmVjdExpbmVzOiBzY29yZXMuZmlsdGVyKHMgPT4gcy5zY29yZSA+PSA5MCkubGVuZ3RoLFxuICAgICAgZ29vZExpbmVzOiBzY29yZXMuZmlsdGVyKHMgPT4gcy5zY29yZSA+PSA3MCAmJiBzLnNjb3JlIDwgOTApLmxlbmd0aCxcbiAgICAgIG5lZWRzV29ya0xpbmVzOiBzY29yZXMuZmlsdGVyKHMgPT4gcy5zY29yZSA8IDcwKS5sZW5ndGgsXG4gICAgICBzZXNzaW9uSWQ6IHNlc3Npb25JZCgpIHx8IHVuZGVmaW5lZFxuICAgIH07XG4gICAgXG4gICAgb3B0aW9ucy5vbkNvbXBsZXRlPy4ocmVzdWx0cyk7XG4gIH07XG5cbiAgY29uc3Qgc3RvcFNlc3Npb24gPSAoKSA9PiB7XG4gICAgc2V0SXNQbGF5aW5nKGZhbHNlKTtcbiAgICBzZXRDb3VudGRvd24obnVsbCk7XG4gICAgc2V0SXNSZWNvcmRpbmcoZmFsc2UpO1xuICAgIHNldEN1cnJlbnRDaHVuayhudWxsKTtcbiAgICBzZXRSZWNvcmRlZENodW5rcyhuZXcgU2V0PG51bWJlcj4oKSk7XG4gICAgXG4gICAgaWYgKGF1ZGlvVXBkYXRlSW50ZXJ2YWwpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwoYXVkaW9VcGRhdGVJbnRlcnZhbCk7XG4gICAgICBhdWRpb1VwZGF0ZUludGVydmFsID0gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgaWYgKHJlY29yZGluZ1RpbWVvdXQpIHtcbiAgICAgIGNsZWFyVGltZW91dChyZWNvcmRpbmdUaW1lb3V0KTtcbiAgICAgIHJlY29yZGluZ1RpbWVvdXQgPSBudWxsO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBhdWRpbyA9IGF1ZGlvRWxlbWVudCgpIHx8IG9wdGlvbnMuYXVkaW9FbGVtZW50O1xuICAgIGlmIChhdWRpbykge1xuICAgICAgYXVkaW8ucGF1c2UoKTtcbiAgICAgIGF1ZGlvLmN1cnJlbnRUaW1lID0gMDtcbiAgICAgIGF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgaGFuZGxlRW5kKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ2xlYW51cCBhdWRpbyBwcm9jZXNzb3JcbiAgICBhdWRpb1Byb2Nlc3Nvci5jbGVhbnVwKCk7XG4gIH07XG5cbiAgb25DbGVhbnVwKCgpID0+IHtcbiAgICBzdG9wU2Vzc2lvbigpO1xuICB9KTtcblxuICByZXR1cm4ge1xuICAgIC8vIFN0YXRlXG4gICAgaXNQbGF5aW5nLFxuICAgIGN1cnJlbnRUaW1lLFxuICAgIHNjb3JlLFxuICAgIGNvdW50ZG93bixcbiAgICBzZXNzaW9uSWQsXG4gICAgbGluZVNjb3JlcyxcbiAgICBpc1JlY29yZGluZyxcbiAgICBjdXJyZW50Q2h1bmssXG4gICAgcGxheWJhY2tTcGVlZCxcbiAgICBcbiAgICAvLyBBY3Rpb25zXG4gICAgc3RhcnRTZXNzaW9uLFxuICAgIHN0b3BTZXNzaW9uLFxuICAgIGhhbmRsZVNwZWVkQ2hhbmdlLFxuICAgIFxuICAgIC8vIEF1ZGlvIHByb2Nlc3NvciAoZm9yIGRpcmVjdCBhY2Nlc3MgaWYgbmVlZGVkKVxuICAgIGF1ZGlvUHJvY2Vzc29yLFxuICAgIFxuICAgIC8vIE1ldGhvZCB0byB1cGRhdGUgYXVkaW8gZWxlbWVudCBhZnRlciBpbml0aWFsaXphdGlvblxuICAgIHNldEF1ZGlvRWxlbWVudDogKGVsZW1lbnQ6IEhUTUxBdWRpb0VsZW1lbnQgfCB1bmRlZmluZWQpID0+IHtcbiAgICAgIHNldEF1ZGlvRWxlbWVudChlbGVtZW50KTtcbiAgICAgIC8vIEFwcGx5IGN1cnJlbnQgcGxheWJhY2sgcmF0ZSB0byBuZXcgYXVkaW8gZWxlbWVudFxuICAgICAgaWYgKGVsZW1lbnQpIHtcbiAgICAgICAgZWxlbWVudC5wbGF5YmFja1JhdGUgPSBnZXRQbGF5YmFja1JhdGUocGxheWJhY2tTcGVlZCgpKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59IiwiZXhwb3J0IGludGVyZmFjZSBUcmFja0luZm8ge1xuICB0cmFja0lkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGFydGlzdDogc3RyaW5nO1xuICBwbGF0Zm9ybTogJ3NvdW5kY2xvdWQnO1xuICB1cmw6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFRyYWNrRGV0ZWN0b3Ige1xuICAvKipcbiAgICogRGV0ZWN0IGN1cnJlbnQgdHJhY2sgZnJvbSB0aGUgcGFnZSAoU291bmRDbG91ZCBvbmx5KVxuICAgKi9cbiAgZGV0ZWN0Q3VycmVudFRyYWNrKCk6IFRyYWNrSW5mbyB8IG51bGwge1xuICAgIGNvbnN0IHVybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICAgIFxuICAgIC8vIE9ubHkgd29yayBvbiBzYy5tYWlkLnpvbmUgKFNvdW5kQ2xvdWQgcHJveHkpXG4gICAgaWYgKHVybC5pbmNsdWRlcygnc2MubWFpZC56b25lJykpIHtcbiAgICAgIHJldHVybiB0aGlzLmRldGVjdFNvdW5kQ2xvdWRUcmFjaygpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIEV4dHJhY3QgdHJhY2sgaW5mbyBmcm9tIFNvdW5kQ2xvdWQgKHNjLm1haWQuem9uZSlcbiAgICovXG4gIHByaXZhdGUgZGV0ZWN0U291bmRDbG91ZFRyYWNrKCk6IFRyYWNrSW5mbyB8IG51bGwge1xuICAgIHRyeSB7XG4gICAgICAvLyBTb3VuZENsb3VkIFVSTHM6IHNjLm1haWQuem9uZS91c2VyL3RyYWNrLW5hbWVcbiAgICAgIGNvbnN0IHBhdGhQYXJ0cyA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5zcGxpdCgnLycpLmZpbHRlcihCb29sZWFuKTtcbiAgICAgIGlmIChwYXRoUGFydHMubGVuZ3RoIDwgMikgcmV0dXJuIG51bGw7XG5cbiAgICAgIGNvbnN0IGFydGlzdFBhdGggPSBwYXRoUGFydHNbMF07XG4gICAgICBjb25zdCB0cmFja1NsdWcgPSBwYXRoUGFydHNbMV07XG4gICAgICBcbiAgICAgIC8vIFRyeSB0byBnZXQgYWN0dWFsIHRpdGxlIGZyb20gcGFnZVxuICAgICAgbGV0IHRpdGxlID0gJyc7XG4gICAgICBcbiAgICAgIC8vIEZvciBzb3VuZGNsb2FrLCBsb29rIGZvciBoMSBhZnRlciB0aGUgaW1hZ2VcbiAgICAgIGNvbnN0IGgxRWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdoMScpO1xuICAgICAgZm9yIChjb25zdCBoMSBvZiBoMUVsZW1lbnRzKSB7XG4gICAgICAgIC8vIFNraXAgdGhlIFwic291bmRjbG9ha1wiIGhlYWRlclxuICAgICAgICBpZiAoaDEudGV4dENvbnRlbnQ/LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3NvdW5kY2xvYWsnKSkgY29udGludWU7XG4gICAgICAgIHRpdGxlID0gaDEudGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJztcbiAgICAgICAgaWYgKHRpdGxlKSBicmVhaztcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gRmFsbGJhY2sgdG8gc2x1Z1xuICAgICAgaWYgKCF0aXRsZSkge1xuICAgICAgICB0aXRsZSA9IHRyYWNrU2x1Zy5yZXBsYWNlKC8tL2csICcgJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFRyeSB0byBnZXQgYWN0dWFsIGFydGlzdCBuYW1lIGZyb20gcGFnZVxuICAgICAgbGV0IGFydGlzdCA9ICcnO1xuICAgICAgXG4gICAgICAvLyBMb29rIGZvciBhcnRpc3QgbGluayB3aXRoIG1ldGEgY2xhc3NcbiAgICAgIGNvbnN0IGFydGlzdExpbmsgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdhLmxpc3RpbmcgLm1ldGEgaDMnKTtcbiAgICAgIGlmIChhcnRpc3RMaW5rICYmIGFydGlzdExpbmsudGV4dENvbnRlbnQpIHtcbiAgICAgICAgYXJ0aXN0ID0gYXJ0aXN0TGluay50ZXh0Q29udGVudC50cmltKCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEZhbGxiYWNrOiB0cnkgcGFnZSB0aXRsZVxuICAgICAgaWYgKCFhcnRpc3QpIHtcbiAgICAgICAgY29uc3QgcGFnZVRpdGxlID0gZG9jdW1lbnQudGl0bGU7XG4gICAgICAgIC8vIFRpdGxlIGZvcm1hdDogXCJTb25nIGJ5IEFydGlzdCB+IHNvdW5kY2xvYWtcIlxuICAgICAgICBjb25zdCBtYXRjaCA9IHBhZ2VUaXRsZS5tYXRjaCgvYnlcXHMrKC4rPylcXHMqfi8pO1xuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICBhcnRpc3QgPSBtYXRjaFsxXS50cmltKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gRmluYWwgZmFsbGJhY2sgdG8gVVJMXG4gICAgICBpZiAoIWFydGlzdCkge1xuICAgICAgICBhcnRpc3QgPSBhcnRpc3RQYXRoLnJlcGxhY2UoLy0vZywgJyAnKS5yZXBsYWNlKC9fL2csICcgJyk7XG4gICAgICB9XG5cbiAgICAgIGNvbnNvbGUubG9nKCdbVHJhY2tEZXRlY3Rvcl0gRGV0ZWN0ZWQgdHJhY2s6JywgeyB0aXRsZSwgYXJ0aXN0LCBhcnRpc3RQYXRoLCB0cmFja1NsdWcgfSk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRyYWNrSWQ6IGAke2FydGlzdFBhdGh9LyR7dHJhY2tTbHVnfWAsXG4gICAgICAgIHRpdGxlOiB0aXRsZSxcbiAgICAgICAgYXJ0aXN0OiBhcnRpc3QsXG4gICAgICAgIHBsYXRmb3JtOiAnc291bmRjbG91ZCcsXG4gICAgICAgIHVybDogd2luZG93LmxvY2F0aW9uLmhyZWYsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbVHJhY2tEZXRlY3Rvcl0gRXJyb3IgZGV0ZWN0aW5nIFNvdW5kQ2xvdWQgdHJhY2s6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cblxuICAvKipcbiAgICogV2F0Y2ggZm9yIHBhZ2UgY2hhbmdlcyAoU291bmRDbG91ZCBpcyBhIFNQQSlcbiAgICovXG4gIHdhdGNoRm9yQ2hhbmdlcyhjYWxsYmFjazogKHRyYWNrOiBUcmFja0luZm8gfCBudWxsKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XG4gICAgbGV0IGN1cnJlbnRVcmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICBsZXQgY3VycmVudFRyYWNrID0gdGhpcy5kZXRlY3RDdXJyZW50VHJhY2soKTtcbiAgICBcbiAgICAvLyBJbml0aWFsIGRldGVjdGlvblxuICAgIGNhbGxiYWNrKGN1cnJlbnRUcmFjayk7XG5cbiAgICAvLyBXYXRjaCBmb3IgVVJMIGNoYW5nZXNcbiAgICBjb25zdCBjaGVja0ZvckNoYW5nZXMgPSAoKSA9PiB7XG4gICAgICBjb25zdCBuZXdVcmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICAgIGlmIChuZXdVcmwgIT09IGN1cnJlbnRVcmwpIHtcbiAgICAgICAgY3VycmVudFVybCA9IG5ld1VybDtcbiAgICAgICAgY29uc3QgbmV3VHJhY2sgPSB0aGlzLmRldGVjdEN1cnJlbnRUcmFjaygpO1xuICAgICAgICBcbiAgICAgICAgLy8gT25seSB0cmlnZ2VyIGNhbGxiYWNrIGlmIHRyYWNrIGFjdHVhbGx5IGNoYW5nZWRcbiAgICAgICAgY29uc3QgdHJhY2tDaGFuZ2VkID0gIWN1cnJlbnRUcmFjayB8fCAhbmV3VHJhY2sgfHwgXG4gICAgICAgICAgY3VycmVudFRyYWNrLnRyYWNrSWQgIT09IG5ld1RyYWNrLnRyYWNrSWQ7XG4gICAgICAgICAgXG4gICAgICAgIGlmICh0cmFja0NoYW5nZWQpIHtcbiAgICAgICAgICBjdXJyZW50VHJhY2sgPSBuZXdUcmFjaztcbiAgICAgICAgICBjYWxsYmFjayhuZXdUcmFjayk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gUG9sbCBmb3IgY2hhbmdlcyAoU1BBcyBkb24ndCBhbHdheXMgdHJpZ2dlciBwcm9wZXIgbmF2aWdhdGlvbiBldmVudHMpXG4gICAgY29uc3QgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChjaGVja0ZvckNoYW5nZXMsIDEwMDApO1xuXG4gICAgLy8gQWxzbyBsaXN0ZW4gZm9yIG5hdmlnYXRpb24gZXZlbnRzXG4gICAgY29uc3QgaGFuZGxlTmF2aWdhdGlvbiA9ICgpID0+IHtcbiAgICAgIHNldFRpbWVvdXQoY2hlY2tGb3JDaGFuZ2VzLCAxMDApOyAvLyBTbWFsbCBkZWxheSBmb3IgRE9NIHVwZGF0ZXNcbiAgICB9O1xuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgaGFuZGxlTmF2aWdhdGlvbik7XG4gICAgXG4gICAgLy8gTGlzdGVuIGZvciBwdXNoc3RhdGUvcmVwbGFjZXN0YXRlIChTb3VuZENsb3VkIHVzZXMgdGhlc2UpXG4gICAgY29uc3Qgb3JpZ2luYWxQdXNoU3RhdGUgPSBoaXN0b3J5LnB1c2hTdGF0ZTtcbiAgICBjb25zdCBvcmlnaW5hbFJlcGxhY2VTdGF0ZSA9IGhpc3RvcnkucmVwbGFjZVN0YXRlO1xuICAgIFxuICAgIGhpc3RvcnkucHVzaFN0YXRlID0gZnVuY3Rpb24oLi4uYXJncykge1xuICAgICAgb3JpZ2luYWxQdXNoU3RhdGUuYXBwbHkoaGlzdG9yeSwgYXJncyk7XG4gICAgICBoYW5kbGVOYXZpZ2F0aW9uKCk7XG4gICAgfTtcbiAgICBcbiAgICBoaXN0b3J5LnJlcGxhY2VTdGF0ZSA9IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICAgIG9yaWdpbmFsUmVwbGFjZVN0YXRlLmFwcGx5KGhpc3RvcnksIGFyZ3MpO1xuICAgICAgaGFuZGxlTmF2aWdhdGlvbigpO1xuICAgIH07XG5cbiAgICAvLyBSZXR1cm4gY2xlYW51cCBmdW5jdGlvblxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb3BzdGF0ZScsIGhhbmRsZU5hdmlnYXRpb24pO1xuICAgICAgaGlzdG9yeS5wdXNoU3RhdGUgPSBvcmlnaW5hbFB1c2hTdGF0ZTtcbiAgICAgIGhpc3RvcnkucmVwbGFjZVN0YXRlID0gb3JpZ2luYWxSZXBsYWNlU3RhdGU7XG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgdHJhY2tEZXRlY3RvciA9IG5ldyBUcmFja0RldGVjdG9yKCk7IiwiLy8gVXNpbmcgYnJvd3Nlci5zdG9yYWdlIEFQSSBkaXJlY3RseSBmb3Igc2ltcGxpY2l0eVxuaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gJ3d4dC9icm93c2VyJztcblxuLy8gSGVscGVyIHRvIGdldCBhdXRoIHRva2VuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0QXV0aFRva2VuKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuZ2V0KCdhdXRoVG9rZW4nKTtcbiAgcmV0dXJuIHJlc3VsdC5hdXRoVG9rZW4gfHwgbnVsbDtcbn1cblxuLy8gSGVscGVyIHRvIHNldCBhdXRoIHRva2VuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0QXV0aFRva2VuKHRva2VuOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnNldCh7IGF1dGhUb2tlbjogdG9rZW4gfSk7XG59XG5cbi8vIEhlbHBlciB0byBnZXQgaW5zdGFsbGF0aW9uIHN0YXRlXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0SW5zdGFsbGF0aW9uU3RhdGUoKTogUHJvbWlzZTx7XG4gIGNvbXBsZXRlZDogYm9vbGVhbjtcbiAgand0VmVyaWZpZWQ6IGJvb2xlYW47XG4gIHRpbWVzdGFtcD86IG51bWJlcjtcbn0+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLmdldCgnaW5zdGFsbGF0aW9uU3RhdGUnKTtcbiAgcmV0dXJuIHJlc3VsdC5pbnN0YWxsYXRpb25TdGF0ZSB8fCB7XG4gICAgY29tcGxldGVkOiBmYWxzZSxcbiAgICBqd3RWZXJpZmllZDogZmFsc2UsXG4gIH07XG59XG5cbi8vIEhlbHBlciB0byBzZXQgaW5zdGFsbGF0aW9uIHN0YXRlXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0SW5zdGFsbGF0aW9uU3RhdGUoc3RhdGU6IHtcbiAgY29tcGxldGVkOiBib29sZWFuO1xuICBqd3RWZXJpZmllZDogYm9vbGVhbjtcbiAgdGltZXN0YW1wPzogbnVtYmVyO1xufSk6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuc2V0KHsgaW5zdGFsbGF0aW9uU3RhdGU6IHN0YXRlIH0pO1xufVxuXG4vLyBIZWxwZXIgdG8gY2hlY2sgaWYgdXNlciBpcyBhdXRoZW50aWNhdGVkXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaXNBdXRoZW50aWNhdGVkKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBjb25zdCB0b2tlbiA9IGF3YWl0IGdldEF1dGhUb2tlbigpO1xuICByZXR1cm4gISF0b2tlbiAmJiB0b2tlbi5zdGFydHNXaXRoKCdzY2FybGV0dF8nKTtcbn1cblxuLy8gSGVscGVyIHRvIGNsZWFyIGF1dGggZGF0YVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNsZWFyQXV0aCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnJlbW92ZShbJ2F1dGhUb2tlbicsICdpbnN0YWxsYXRpb25TdGF0ZSddKTtcbn0iLCJleHBvcnQgaW50ZXJmYWNlIEthcmFva2VEYXRhIHtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgdHJhY2tfaWQ/OiBzdHJpbmc7XG4gIHRyYWNrSWQ/OiBzdHJpbmc7XG4gIGhhc19rYXJhb2tlPzogYm9vbGVhbjtcbiAgaGFzS2FyYW9rZT86IGJvb2xlYW47XG4gIHNvbmc/OiB7XG4gICAgaWQ6IHN0cmluZztcbiAgICB0aXRsZTogc3RyaW5nO1xuICAgIGFydGlzdDogc3RyaW5nO1xuICAgIGFsYnVtPzogc3RyaW5nO1xuICAgIGFydHdvcmtVcmw/OiBzdHJpbmc7XG4gICAgZHVyYXRpb24/OiBudW1iZXI7XG4gICAgZGlmZmljdWx0eTogJ2JlZ2lubmVyJyB8ICdpbnRlcm1lZGlhdGUnIHwgJ2FkdmFuY2VkJztcbiAgfTtcbiAgbHlyaWNzPzoge1xuICAgIHNvdXJjZTogc3RyaW5nO1xuICAgIHR5cGU6ICdzeW5jZWQnO1xuICAgIGxpbmVzOiBMeXJpY0xpbmVbXTtcbiAgICB0b3RhbExpbmVzOiBudW1iZXI7XG4gIH07XG4gIG1lc3NhZ2U/OiBzdHJpbmc7XG4gIGVycm9yPzogc3RyaW5nO1xuICBhcGlfY29ubmVjdGVkPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMeXJpY0xpbmUge1xuICBpZDogc3RyaW5nO1xuICB0ZXh0OiBzdHJpbmc7XG4gIHN0YXJ0VGltZTogbnVtYmVyO1xuICBkdXJhdGlvbjogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEthcmFva2VTZXNzaW9uIHtcbiAgaWQ6IHN0cmluZztcbiAgdHJhY2tJZDogc3RyaW5nO1xuICBzb25nVGl0bGU6IHN0cmluZztcbiAgc29uZ0FydGlzdDogc3RyaW5nO1xuICBzdGF0dXM6IHN0cmluZztcbiAgY3JlYXRlZEF0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBLYXJhb2tlQXBpU2VydmljZSB7XG4gIHByaXZhdGUgYmFzZVVybDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIC8vIFVzZSB0aGUgbG9jYWwgc2VydmVyIGVuZHBvaW50XG4gICAgdGhpcy5iYXNlVXJsID0gJ2h0dHA6Ly9sb2NhbGhvc3Q6ODc4Ny9hcGknO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBrYXJhb2tlIGRhdGEgZm9yIGEgdHJhY2sgSUQgKFlvdVR1YmUvU291bmRDbG91ZClcbiAgICovXG4gIGFzeW5jIGdldEthcmFva2VEYXRhKFxuICAgIHRyYWNrSWQ6IHN0cmluZywgXG4gICAgdGl0bGU/OiBzdHJpbmcsIFxuICAgIGFydGlzdD86IHN0cmluZ1xuICApOiBQcm9taXNlPEthcmFva2VEYXRhIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCk7XG4gICAgICBpZiAodGl0bGUpIHBhcmFtcy5zZXQoJ3RpdGxlJywgdGl0bGUpO1xuICAgICAgaWYgKGFydGlzdCkgcGFyYW1zLnNldCgnYXJ0aXN0JywgYXJ0aXN0KTtcbiAgICAgIFxuICAgICAgY29uc3QgdXJsID0gYCR7dGhpcy5iYXNlVXJsfS9rYXJhb2tlLyR7ZW5jb2RlVVJJQ29tcG9uZW50KHRyYWNrSWQpfSR7cGFyYW1zLnRvU3RyaW5nKCkgPyAnPycgKyBwYXJhbXMudG9TdHJpbmcoKSA6ICcnfWA7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUFwaV0gRmV0Y2hpbmcga2FyYW9rZSBkYXRhOicsIHVybCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIC8vIFJlbW92ZSBDb250ZW50LVR5cGUgaGVhZGVyIHRvIGF2b2lkIENPUlMgcHJlZmxpZ2h0XG4gICAgICAgIC8vIGhlYWRlcnM6IHtcbiAgICAgICAgLy8gICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAvLyB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBmZXRjaCBrYXJhb2tlIGRhdGE6JywgcmVzcG9uc2Uuc3RhdHVzKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VBcGldIFJlY2VpdmVkIGthcmFva2UgZGF0YTonLCBkYXRhKTtcbiAgICAgIFxuICAgICAgLy8gSWYgdGhlcmUncyBhbiBlcnJvciBidXQgd2UgZ290IGEgcmVzcG9uc2UsIGl0IG1lYW5zIEFQSSBpcyBjb25uZWN0ZWRcbiAgICAgIGlmIChkYXRhLmVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUFwaV0gU2VydmVyIGVycm9yIChidXQgQVBJIGlzIHJlYWNoYWJsZSk6JywgZGF0YS5lcnJvcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgaGFzX2thcmFva2U6IGZhbHNlLFxuICAgICAgICAgIGVycm9yOiBkYXRhLmVycm9yLFxuICAgICAgICAgIHRyYWNrX2lkOiB0cmFja0lkLFxuICAgICAgICAgIGFwaV9jb25uZWN0ZWQ6IHRydWVcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBFcnJvciBmZXRjaGluZyBrYXJhb2tlIGRhdGE6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IGEga2FyYW9rZSBzZXNzaW9uXG4gICAqL1xuICBhc3luYyBzdGFydFNlc3Npb24oXG4gICAgdHJhY2tJZDogc3RyaW5nLFxuICAgIHNvbmdEYXRhOiB7XG4gICAgICB0aXRsZTogc3RyaW5nO1xuICAgICAgYXJ0aXN0OiBzdHJpbmc7XG4gICAgICBhbGJ1bT86IHN0cmluZztcbiAgICAgIGR1cmF0aW9uPzogbnVtYmVyO1xuICAgIH1cbiAgKTogUHJvbWlzZTxLYXJhb2tlU2Vzc2lvbiB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHt0aGlzLmJhc2VVcmx9L2thcmFva2Uvc3RhcnRgLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAvLyBUT0RPOiBBZGQgYXV0aCB0b2tlbiB3aGVuIGF2YWlsYWJsZVxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgdHJhY2tJZCxcbiAgICAgICAgICBzb25nRGF0YSxcbiAgICAgICAgfSksXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIHN0YXJ0IHNlc3Npb246JywgcmVzcG9uc2Uuc3RhdHVzKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgIHJldHVybiByZXN1bHQuc2Vzc2lvbjtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEVycm9yIHN0YXJ0aW5nIHNlc3Npb246JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRlc3QgY29ubmVjdGlvbiB0byB0aGUgQVBJXG4gICAqL1xuICBhc3luYyB0ZXN0Q29ubmVjdGlvbigpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHt0aGlzLmJhc2VVcmwucmVwbGFjZSgnL2FwaScsICcnKX0vaGVhbHRoYCk7XG4gICAgICByZXR1cm4gcmVzcG9uc2Uub2s7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBDb25uZWN0aW9uIHRlc3QgZmFpbGVkOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGthcmFva2VBcGkgPSBuZXcgS2FyYW9rZUFwaVNlcnZpY2UoKTsiLCJpbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBQcmFjdGljZUV4ZXJjaXNlVmlldyB9IGZyb20gJ0BzY2FybGV0dC91aSc7XG5cbmludGVyZmFjZSBQcmFjdGljZVZpZXdQcm9wcyB7XG4gIHNlc3Npb25JZD86IHN0cmluZztcbiAgb25CYWNrOiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgUHJhY3RpY2VWaWV3OiBDb21wb25lbnQ8UHJhY3RpY2VWaWV3UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPFByYWN0aWNlRXhlcmNpc2VWaWV3IFxuICAgICAgc2Vzc2lvbklkPXtwcm9wcy5zZXNzaW9uSWR9XG4gICAgICBvbkJhY2s9e3Byb3BzLm9uQmFja31cbiAgICAgIC8vIEV4dGVuc2lvbiBkb2Vzbid0IHVzZSBhdXRoIHlldFxuICAgICAgLy8gYXBpQmFzZVVybCBpcyBkZWZhdWx0IGxvY2FsaG9zdDo4Nzg3XG4gICAgLz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgQ29tcG9uZW50LCBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCwgb25Nb3VudCwgb25DbGVhbnVwLCBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uS2FyYW9rZVZpZXcsIE1pbmltaXplZEthcmFva2UsIENvdW50ZG93biwgQ29tcGxldGlvblZpZXcsIHVzZUthcmFva2VTZXNzaW9uLCBFeHRlbnNpb25BdWRpb1NlcnZpY2UsIEkxOG5Qcm92aWRlciwgdHlwZSBQbGF5YmFja1NwZWVkIH0gZnJvbSAnQHNjYXJsZXR0L3VpJztcbmltcG9ydCB7IHRyYWNrRGV0ZWN0b3IsIHR5cGUgVHJhY2tJbmZvIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvdHJhY2stZGV0ZWN0b3InO1xuaW1wb3J0IHsgZ2V0QXV0aFRva2VuIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3RvcmFnZSc7XG5pbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xuaW1wb3J0IHsga2FyYW9rZUFwaSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2thcmFva2UtYXBpJztcbmltcG9ydCB7IFByYWN0aWNlVmlldyB9IGZyb20gJy4vUHJhY3RpY2VWaWV3JztcblxuZXhwb3J0IGludGVyZmFjZSBDb250ZW50QXBwUHJvcHMge31cblxuZXhwb3J0IGNvbnN0IENvbnRlbnRBcHA6IENvbXBvbmVudDxDb250ZW50QXBwUHJvcHM+ID0gKCkgPT4ge1xuICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlbmRlcmluZyBDb250ZW50QXBwIGNvbXBvbmVudCcpO1xuICBcbiAgLy8gU3RhdGVcbiAgY29uc3QgW2N1cnJlbnRUcmFjaywgc2V0Q3VycmVudFRyYWNrXSA9IGNyZWF0ZVNpZ25hbDxUcmFja0luZm8gfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2F1dGhUb2tlbiwgc2V0QXV0aFRva2VuXSA9IGNyZWF0ZVNpZ25hbDxzdHJpbmcgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW3Nob3dLYXJhb2tlLCBzZXRTaG93S2FyYW9rZV0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBba2FyYW9rZURhdGEsIHNldEthcmFva2VEYXRhXSA9IGNyZWF0ZVNpZ25hbDxhbnk+KG51bGwpO1xuICBjb25zdCBbbG9hZGluZywgc2V0TG9hZGluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbc2Vzc2lvblN0YXJ0ZWQsIHNldFNlc3Npb25TdGFydGVkXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtpc01pbmltaXplZCwgc2V0SXNNaW5pbWl6ZWRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2NvdW50ZG93biwgc2V0Q291bnRkb3duXSA9IGNyZWF0ZVNpZ25hbDxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2lzUGxheWluZywgc2V0SXNQbGF5aW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtjdXJyZW50VGltZSwgc2V0Q3VycmVudFRpbWVdID0gY3JlYXRlU2lnbmFsKDApO1xuICBjb25zdCBbYXVkaW9SZWYsIHNldEF1ZGlvUmVmXSA9IGNyZWF0ZVNpZ25hbDxIVE1MQXVkaW9FbGVtZW50IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtrYXJhb2tlU2Vzc2lvbiwgc2V0S2FyYW9rZVNlc3Npb25dID0gY3JlYXRlU2lnbmFsPFJldHVyblR5cGU8dHlwZW9mIHVzZUthcmFva2VTZXNzaW9uPiB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbY29tcGxldGlvbkRhdGEsIHNldENvbXBsZXRpb25EYXRhXSA9IGNyZWF0ZVNpZ25hbDxhbnk+KG51bGwpO1xuICBjb25zdCBbc2hvd1ByYWN0aWNlLCBzZXRTaG93UHJhY3RpY2VdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3NlbGVjdGVkU3BlZWQsIHNldFNlbGVjdGVkU3BlZWRdID0gY3JlYXRlU2lnbmFsPFBsYXliYWNrU3BlZWQ+KCcxeCcpO1xuICBcbiAgLy8gTG9hZCBhdXRoIHRva2VuIG9uIG1vdW50XG4gIG9uTW91bnQoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTG9hZGluZyBhdXRoIHRva2VuJyk7XG4gICAgY29uc3QgdG9rZW4gPSBhd2FpdCBnZXRBdXRoVG9rZW4oKTtcbiAgICBpZiAodG9rZW4pIHtcbiAgICAgIHNldEF1dGhUb2tlbih0b2tlbik7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEF1dGggdG9rZW4gbG9hZGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBkZW1vIHRva2VuIGZvciBkZXZlbG9wbWVudFxuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBObyBhdXRoIHRva2VuIGZvdW5kLCB1c2luZyBkZW1vIHRva2VuJyk7XG4gICAgICBzZXRBdXRoVG9rZW4oJ3NjYXJsZXR0X2RlbW9fdG9rZW5fMTIzJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIFN0YXJ0IHdhdGNoaW5nIGZvciB0cmFjayBjaGFuZ2VzXG4gICAgY29uc3QgY2xlYW51cCA9IHRyYWNrRGV0ZWN0b3Iud2F0Y2hGb3JDaGFuZ2VzKCh0cmFjaykgPT4ge1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBUcmFjayBjaGFuZ2VkOicsIHRyYWNrKTtcbiAgICAgIHNldEN1cnJlbnRUcmFjayh0cmFjayk7XG4gICAgICAvLyBTaG93IGthcmFva2Ugd2hlbiB0cmFjayBpcyBkZXRlY3RlZCBhbmQgZmV0Y2ggZGF0YVxuICAgICAgaWYgKHRyYWNrKSB7XG4gICAgICAgIHNldFNob3dLYXJhb2tlKHRydWUpO1xuICAgICAgICBmZXRjaEthcmFva2VEYXRhKHRyYWNrKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIG9uQ2xlYW51cChjbGVhbnVwKTtcbiAgfSk7XG5cbiAgY29uc3QgZmV0Y2hLYXJhb2tlRGF0YSA9IGFzeW5jICh0cmFjazogVHJhY2tJbmZvKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGZXRjaGluZyBrYXJhb2tlIGRhdGEgZm9yIHRyYWNrOicsIHRyYWNrKTtcbiAgICBzZXRMb2FkaW5nKHRydWUpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQga2FyYW9rZUFwaS5nZXRLYXJhb2tlRGF0YShcbiAgICAgICAgdHJhY2sudHJhY2tJZCxcbiAgICAgICAgdHJhY2sudGl0bGUsXG4gICAgICAgIHRyYWNrLmFydGlzdFxuICAgICAgKTtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gS2FyYW9rZSBkYXRhIGxvYWRlZDonLCBkYXRhKTtcbiAgICAgIHNldEthcmFva2VEYXRhKGRhdGEpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQ29udGVudEFwcF0gRmFpbGVkIHRvIGZldGNoIGthcmFva2UgZGF0YTonLCBlcnJvcik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldExvYWRpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVTdGFydCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFN0YXJ0IGthcmFva2Ugc2Vzc2lvbicpO1xuICAgIHNldFNlc3Npb25TdGFydGVkKHRydWUpO1xuICAgIFxuICAgIGNvbnN0IGRhdGEgPSBrYXJhb2tlRGF0YSgpO1xuICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9SZWYoKTtcbiAgICBjb25zdCB0cmFjayA9IGN1cnJlbnRUcmFjaygpO1xuICAgIFxuICAgIGlmIChkYXRhICYmIHRyYWNrICYmIGRhdGEubHlyaWNzPy5saW5lcykge1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBDcmVhdGluZyBrYXJhb2tlIHNlc3Npb24gd2l0aCBhdWRpbyBjYXB0dXJlJywge1xuICAgICAgICB0cmFja0lkOiB0cmFjay5pZCxcbiAgICAgICAgdHJhY2tUaXRsZTogdHJhY2sudGl0bGUsXG4gICAgICAgIHNvbmdEYXRhOiBkYXRhLnNvbmcsXG4gICAgICAgIGhhc0x5cmljczogISFkYXRhLmx5cmljcz8ubGluZXNcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyBDcmVhdGUgYW5kIHN0YXJ0IHNlc3Npb25cbiAgICAgIGNvbnN0IG5ld1Nlc3Npb24gPSB1c2VLYXJhb2tlU2Vzc2lvbih7XG4gICAgICAgIGx5cmljczogZGF0YS5seXJpY3MubGluZXMsXG4gICAgICAgIHRyYWNrSWQ6IHRyYWNrLnRyYWNrSWQsXG4gICAgICAgIHNvbmdEYXRhOiBkYXRhLnNvbmcgPyB7XG4gICAgICAgICAgdGl0bGU6IGRhdGEuc29uZy50aXRsZSxcbiAgICAgICAgICBhcnRpc3Q6IGRhdGEuc29uZy5hcnRpc3QsXG4gICAgICAgICAgYWxidW06IGRhdGEuc29uZy5hbGJ1bSxcbiAgICAgICAgICBkdXJhdGlvbjogZGF0YS5zb25nLmR1cmF0aW9uXG4gICAgICAgIH0gOiB7XG4gICAgICAgICAgdGl0bGU6IHRyYWNrLnRpdGxlLFxuICAgICAgICAgIGFydGlzdDogdHJhY2suYXJ0aXN0XG4gICAgICAgIH0sXG4gICAgICAgIHNvbmdDYXRhbG9nSWQ6IGRhdGEuc29uZ19jYXRhbG9nX2lkLFxuICAgICAgICBhdWRpb0VsZW1lbnQ6IHVuZGVmaW5lZCwgLy8gV2lsbCBiZSBzZXQgd2hlbiBhdWRpbyBzdGFydHMgcGxheWluZ1xuICAgICAgICBhcGlVcmw6ICdodHRwOi8vbG9jYWxob3N0Ojg3ODcvYXBpJyxcbiAgICAgICAgb25Db21wbGV0ZTogKHJlc3VsdHMpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEthcmFva2Ugc2Vzc2lvbiBjb21wbGV0ZWQ6JywgcmVzdWx0cyk7XG4gICAgICAgICAgc2V0U2Vzc2lvblN0YXJ0ZWQoZmFsc2UpO1xuICAgICAgICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgICAgICAgc2V0Q29tcGxldGlvbkRhdGEocmVzdWx0cyk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gU3RvcCBhdWRpbyBwbGF5YmFja1xuICAgICAgICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9SZWYoKTtcbiAgICAgICAgICBpZiAoYXVkaW8pIHtcbiAgICAgICAgICAgIGF1ZGlvLnBhdXNlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gQXBwbHkgdGhlIHNlbGVjdGVkIHNwZWVkIHRvIHRoZSBuZXcgc2Vzc2lvblxuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBBcHBseWluZyBzZWxlY3RlZCBzcGVlZCB0byBuZXcgc2Vzc2lvbjonLCBzZWxlY3RlZFNwZWVkKCkpO1xuICAgICAgbmV3U2Vzc2lvbi5oYW5kbGVTcGVlZENoYW5nZShzZWxlY3RlZFNwZWVkKCkpO1xuICAgICAgXG4gICAgICBzZXRLYXJhb2tlU2Vzc2lvbihuZXdTZXNzaW9uKTtcbiAgICAgIFxuICAgICAgLy8gU3RhcnQgdGhlIHNlc3Npb24gKGluY2x1ZGVzIGNvdW50ZG93biBhbmQgYXVkaW8gaW5pdGlhbGl6YXRpb24pXG4gICAgICBhd2FpdCBuZXdTZXNzaW9uLnN0YXJ0U2Vzc2lvbigpO1xuICAgICAgXG4gICAgICAvLyBXYXRjaCBmb3IgY291bnRkb3duIHRvIGZpbmlzaCBhbmQgc3RhcnQgYXVkaW9cbiAgICAgIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgICAgIGlmIChuZXdTZXNzaW9uLmNvdW50ZG93bigpID09PSBudWxsICYmIG5ld1Nlc3Npb24uaXNQbGF5aW5nKCkgJiYgIWlzUGxheWluZygpKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBDb3VudGRvd24gZmluaXNoZWQsIHN0YXJ0aW5nIGF1ZGlvIHBsYXliYWNrJyk7XG4gICAgICAgICAgc3RhcnRBdWRpb1BsYXliYWNrKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFVwZGF0ZSBzZXNzaW9uIHdpdGggYXVkaW8gZWxlbWVudCB3aGVuIGF2YWlsYWJsZVxuICAgICAgICBjb25zdCBhdWRpbyA9IGF1ZGlvUmVmKCk7XG4gICAgICAgIGlmIChhdWRpbyAmJiBuZXdTZXNzaW9uKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTZXR0aW5nIGF1ZGlvIGVsZW1lbnQgb24gbmV3IHNlc3Npb24nKTtcbiAgICAgICAgICBuZXdTZXNzaW9uLnNldEF1ZGlvRWxlbWVudChhdWRpbyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZhbGxiYWNrIHRvIHNpbXBsZSBjb3VudGRvd24nKTtcbiAgICAgIC8vIEZhbGxiYWNrIHRvIG9sZCBiZWhhdmlvclxuICAgICAgc2V0Q291bnRkb3duKDMpO1xuICAgICAgXG4gICAgICBjb25zdCBjb3VudGRvd25JbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgY29uc3QgY3VycmVudCA9IGNvdW50ZG93bigpO1xuICAgICAgICBpZiAoY3VycmVudCAhPT0gbnVsbCAmJiBjdXJyZW50ID4gMSkge1xuICAgICAgICAgIHNldENvdW50ZG93bihjdXJyZW50IC0gMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2xlYXJJbnRlcnZhbChjb3VudGRvd25JbnRlcnZhbCk7XG4gICAgICAgICAgc2V0Q291bnRkb3duKG51bGwpO1xuICAgICAgICAgIHN0YXJ0QXVkaW9QbGF5YmFjaygpO1xuICAgICAgICB9XG4gICAgICB9LCAxMDAwKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3Qgc3RhcnRBdWRpb1BsYXliYWNrID0gKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU3RhcnRpbmcgYXVkaW8gcGxheWJhY2snKTtcbiAgICBzZXRJc1BsYXlpbmcodHJ1ZSk7XG4gICAgXG4gICAgLy8gVHJ5IG11bHRpcGxlIG1ldGhvZHMgdG8gZmluZCBhbmQgcGxheSBhdWRpb1xuICAgIC8vIE1ldGhvZCAxOiBMb29rIGZvciBhdWRpbyBlbGVtZW50c1xuICAgIGNvbnN0IGF1ZGlvRWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdhdWRpbycpO1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRm91bmQgYXVkaW8gZWxlbWVudHM6JywgYXVkaW9FbGVtZW50cy5sZW5ndGgpO1xuICAgIFxuICAgIGlmIChhdWRpb0VsZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9FbGVtZW50c1swXSBhcyBIVE1MQXVkaW9FbGVtZW50O1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBBdWRpbyBlbGVtZW50OicsIHtcbiAgICAgICAgc3JjOiBhdWRpby5zcmMsXG4gICAgICAgIHBhdXNlZDogYXVkaW8ucGF1c2VkLFxuICAgICAgICBkdXJhdGlvbjogYXVkaW8uZHVyYXRpb24sXG4gICAgICAgIGN1cnJlbnRUaW1lOiBhdWRpby5jdXJyZW50VGltZVxuICAgICAgfSk7XG4gICAgICBzZXRBdWRpb1JlZihhdWRpbyk7XG4gICAgICBcbiAgICAgIC8vIFVwZGF0ZSBrYXJhb2tlIHNlc3Npb24gd2l0aCBhdWRpbyBlbGVtZW50IGlmIGl0IGV4aXN0c1xuICAgICAgY29uc3Qgc2Vzc2lvbiA9IGthcmFva2VTZXNzaW9uKCk7XG4gICAgICBpZiAoc2Vzc2lvbikge1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFNldHRpbmcgYXVkaW8gZWxlbWVudCBvbiBrYXJhb2tlIHNlc3Npb24nKTtcbiAgICAgICAgc2Vzc2lvbi5zZXRBdWRpb0VsZW1lbnQoYXVkaW8pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzZXNzaW9uLmF1ZGlvUHJvY2Vzc29yLmlzUmVhZHkoKSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gSW5pdGlhbGl6aW5nIGF1ZGlvIHByb2Nlc3NvciBmb3Igc2Vzc2lvbicpO1xuICAgICAgICAgIHNlc3Npb24uYXVkaW9Qcm9jZXNzb3IuaW5pdGlhbGl6ZSgpLmNhdGNoKGNvbnNvbGUuZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFRyeSB0byBwbGF5IHRoZSBhdWRpb1xuICAgICAgYXVkaW8ucGxheSgpLnRoZW4oKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEF1ZGlvIHN0YXJ0ZWQgcGxheWluZyBzdWNjZXNzZnVsbHknKTtcbiAgICAgIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tDb250ZW50QXBwXSBGYWlsZWQgdG8gcGxheSBhdWRpbzonLCBlcnIpO1xuICAgICAgICBcbiAgICAgICAgLy8gTWV0aG9kIDI6IFRyeSBjbGlja2luZyB0aGUgcGxheSBidXR0b24gb24gdGhlIHBhZ2VcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBBdHRlbXB0aW5nIHRvIGNsaWNrIHBsYXkgYnV0dG9uLi4uJyk7XG4gICAgICAgIGNvbnN0IHBsYXlCdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdidXR0b25bdGl0bGUqPVwiUGxheVwiXSwgYnV0dG9uW2FyaWEtbGFiZWwqPVwiUGxheVwiXSwgLnBsYXlDb250cm9sLCAucGxheUJ1dHRvbiwgW2NsYXNzKj1cInBsYXktYnV0dG9uXCJdJyk7XG4gICAgICAgIGlmIChwbGF5QnV0dG9uKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGb3VuZCBwbGF5IGJ1dHRvbiwgY2xpY2tpbmcgaXQnKTtcbiAgICAgICAgICAocGxheUJ1dHRvbiBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIFVwZGF0ZSBjdXJyZW50IHRpbWVcbiAgICAgIGNvbnN0IHVwZGF0ZVRpbWUgPSAoKSA9PiB7XG4gICAgICAgIHNldEN1cnJlbnRUaW1lKGF1ZGlvLmN1cnJlbnRUaW1lKTtcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB1cGRhdGVUaW1lKTtcbiAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgKCkgPT4ge1xuICAgICAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgICAgICBhdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdXBkYXRlVGltZSk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTWV0aG9kIDM6IFRyeSBTb3VuZENsb3VkIHNwZWNpZmljIHNlbGVjdG9yc1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBObyBhdWRpbyBlbGVtZW50cyBmb3VuZCwgdHJ5aW5nIFNvdW5kQ2xvdWQtc3BlY2lmaWMgYXBwcm9hY2gnKTtcbiAgICAgIGNvbnN0IHBsYXlCdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcucGxheUNvbnRyb2wsIC5zYy1idXR0b24tcGxheSwgYnV0dG9uW3RpdGxlKj1cIlBsYXlcIl0nKTtcbiAgICAgIGlmIChwbGF5QnV0dG9uKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRm91bmQgU291bmRDbG91ZCBwbGF5IGJ1dHRvbiwgY2xpY2tpbmcgaXQnKTtcbiAgICAgICAgKHBsYXlCdXR0b24gYXMgSFRNTEVsZW1lbnQpLmNsaWNrKCk7XG4gICAgICAgIFxuICAgICAgICAvLyBXYWl0IGEgYml0IGFuZCB0aGVuIGxvb2sgZm9yIGF1ZGlvIGVsZW1lbnQgYWdhaW5cbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgY29uc3QgbmV3QXVkaW9FbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2F1ZGlvJyk7XG4gICAgICAgICAgaWYgKG5ld0F1ZGlvRWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGb3VuZCBhdWRpbyBlbGVtZW50IGFmdGVyIGNsaWNraW5nIHBsYXknKTtcbiAgICAgICAgICAgIGNvbnN0IGF1ZGlvID0gbmV3QXVkaW9FbGVtZW50c1swXSBhcyBIVE1MQXVkaW9FbGVtZW50O1xuICAgICAgICAgICAgc2V0QXVkaW9SZWYoYXVkaW8pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBVcGRhdGUgY3VycmVudCB0aW1lXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVUaW1lID0gKCkgPT4ge1xuICAgICAgICAgICAgICBzZXRDdXJyZW50VGltZShhdWRpby5jdXJyZW50VGltZSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdXBkYXRlVGltZSk7XG4gICAgICAgICAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsICgpID0+IHtcbiAgICAgICAgICAgICAgc2V0SXNQbGF5aW5nKGZhbHNlKTtcbiAgICAgICAgICAgICAgYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIHVwZGF0ZVRpbWUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCA1MDApO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVDbG9zZSA9ICgpID0+IHtcbiAgICAvLyBTdG9wIHNlc3Npb24gaWYgYWN0aXZlXG4gICAgY29uc3Qgc2Vzc2lvbiA9IGthcmFva2VTZXNzaW9uKCk7XG4gICAgaWYgKHNlc3Npb24pIHtcbiAgICAgIHNlc3Npb24uc3RvcFNlc3Npb24oKTtcbiAgICB9XG4gICAgXG4gICAgc2V0U2hvd0thcmFva2UoZmFsc2UpO1xuICAgIHNldEthcmFva2VEYXRhKG51bGwpO1xuICAgIHNldFNlc3Npb25TdGFydGVkKGZhbHNlKTtcbiAgICBzZXRLYXJhb2tlU2Vzc2lvbihudWxsKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVNaW5pbWl6ZSA9ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE1pbmltaXplIGthcmFva2Ugd2lkZ2V0Jyk7XG4gICAgc2V0SXNNaW5pbWl6ZWQodHJ1ZSk7XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlUmVzdG9yZSA9ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlc3RvcmUga2FyYW9rZSB3aWRnZXQnKTtcbiAgICBzZXRJc01pbmltaXplZChmYWxzZSk7XG4gIH07XG5cbiAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBSZW5kZXIgc3RhdGU6Jywge1xuICAgIHNob3dLYXJhb2tlOiBzaG93S2FyYW9rZSgpLFxuICAgIGN1cnJlbnRUcmFjazogY3VycmVudFRyYWNrKCksXG4gICAga2FyYW9rZURhdGE6IGthcmFva2VEYXRhKCksXG4gICAgbG9hZGluZzogbG9hZGluZygpXG4gIH0pO1xuXG5cbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAgey8qIE1pbmltaXplZCBzdGF0ZSAqL31cbiAgICAgIDxTaG93IHdoZW49e3Nob3dLYXJhb2tlKCkgJiYgY3VycmVudFRyYWNrKCkgJiYgaXNNaW5pbWl6ZWQoKX0+XG4gICAgICAgIDxNaW5pbWl6ZWRLYXJhb2tlIG9uQ2xpY2s9e2hhbmRsZVJlc3RvcmV9IC8+XG4gICAgICA8L1Nob3c+XG5cbiAgICAgIHsvKiBGdWxsIHdpZGdldCBzdGF0ZSAqL31cbiAgICAgIDxTaG93IHdoZW49e3Nob3dLYXJhb2tlKCkgJiYgY3VycmVudFRyYWNrKCkgJiYgIWlzTWluaW1pemVkKCl9IGZhbGxiYWNrPXtcbiAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnbm9uZScgfX0+XG4gICAgICAgICAge2NvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTm90IHNob3dpbmcgLSBzaG93S2FyYW9rZTonLCBzaG93S2FyYW9rZSgpLCAnY3VycmVudFRyYWNrOicsIGN1cnJlbnRUcmFjaygpKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICB9PlxuICAgICAgICA8ZGl2IHN0eWxlPXt7XG4gICAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICAgICAgdG9wOiAnMjBweCcsXG4gICAgICAgICAgcmlnaHQ6ICcyMHB4JyxcbiAgICAgICAgICBib3R0b206ICcyMHB4JyxcbiAgICAgICAgICB3aWR0aDogJzQ4MHB4JyxcbiAgICAgICAgICAnei1pbmRleCc6ICc5OTk5OScsXG4gICAgICAgICAgb3ZlcmZsb3c6ICdoaWRkZW4nLFxuICAgICAgICAgICdib3JkZXItcmFkaXVzJzogJzE2cHgnLFxuICAgICAgICAgICdib3gtc2hhZG93JzogJzAgMjVweCA1MHB4IC0xMnB4IHJnYmEoMCwgMCwgMCwgMC42KScsXG4gICAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxuICAgICAgICAgICdmbGV4LWRpcmVjdGlvbic6ICdjb2x1bW4nXG4gICAgICAgIH19PlxuICAgICAgICAgIHtjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlbmRlcmluZyB3aXRoIGNvbXBsZXRpb24gZGF0YTonLCBjb21wbGV0aW9uRGF0YSgpKX1cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiaC1mdWxsIGJnLXN1cmZhY2Ugcm91bmRlZC0yeGwgb3ZlcmZsb3ctaGlkZGVuIGZsZXggZmxleC1jb2xcIj5cbiAgICAgICAgICAgIHsvKiBIZWFkZXIgd2l0aCBtaW5pbWl6ZSBhbmQgY2xvc2UgYnV0dG9ucyAqL31cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWVuZCBwLTIgYmctc3VyZmFjZSBib3JkZXItYiBib3JkZXItc3VidGxlXCIgc3R5bGU9e3sgaGVpZ2h0OiAnNDhweCcgfX0+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Nob3dQcmFjdGljZSgpfT5cbiAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd1ByYWN0aWNlKGZhbHNlKX1cbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LTEwIGgtMTAgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1sZyB0cmFuc2l0aW9uLWNvbG9ycyBob3ZlcjpiZy13aGl0ZS8xMFwiXG4gICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IGNvbG9yOiAnI2E4YThhOCcgfX1cbiAgICAgICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIkNsb3NlIFByYWN0aWNlXCJcbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgPHN2ZyB3aWR0aD1cIjIwXCIgaGVpZ2h0PVwiMjBcIiB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHBhdGggZD1cIk0xNSA1TDUgMTVNNSA1TDE1IDE1XCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiLz5cbiAgICAgICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlTWluaW1pemV9XG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInctMTAgaC0xMCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzIGhvdmVyOmJnLXdoaXRlLzEwXCJcbiAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IGNvbG9yOiAnI2E4YThhOCcgfX1cbiAgICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCJNaW5pbWl6ZVwiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPHN2ZyB3aWR0aD1cIjI0XCIgaGVpZ2h0PVwiMjRcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+XG4gICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9XCJNNiAxMmgxMlwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjNcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIvPlxuICAgICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHsvKiBNYWluIGNvbnRlbnQgYXJlYSAqL31cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgbWluLWgtMCBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgICAgPFNob3cgd2hlbj17Y29tcGxldGlvbkRhdGEoKX0gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49eyFsb2FkaW5nKCl9IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBoLWZ1bGwgYmctYmFzZVwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYW5pbWF0ZS1zcGluIHJvdW5kZWQtZnVsbCBoLTEyIHctMTIgYm9yZGVyLWItMiBib3JkZXItYWNjZW50LXByaW1hcnkgbXgtYXV0byBtYi00XCI+PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNlY29uZGFyeVwiPkxvYWRpbmcgbHlyaWNzLi4uPC9wPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtrYXJhb2tlRGF0YSgpPy5seXJpY3M/LmxpbmVzfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBoLWZ1bGwgcC04XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1zZWNvbmRhcnkgbWItMlwiPk5vIGx5cmljcyBhdmFpbGFibGU8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc20gdGV4dC10ZXJ0aWFyeVwiPlRyeSBhIGRpZmZlcmVudCBzb25nPC9wPlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoLWZ1bGwgZmxleCBmbGV4LWNvbFwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgbWluLWgtMCBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxFeHRlbnNpb25LYXJhb2tlVmlld1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzY29yZT17a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLnNjb3JlKCkgOiAwfVxuICAgICAgICAgICAgICAgICAgICAgICAgICByYW5rPXsxfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBseXJpY3M9e2thcmFva2VEYXRhKCk/Lmx5cmljcz8ubGluZXMgfHwgW119XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnRUaW1lPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuY3VycmVudFRpbWUoKSA6IGN1cnJlbnRUaW1lKCkgKiAxMDAwfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBsZWFkZXJib2FyZD17W119XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlzUGxheWluZz17a2FyYW9rZVNlc3Npb24oKSA/IChrYXJhb2tlU2Vzc2lvbigpIS5pc1BsYXlpbmcoKSB8fCBrYXJhb2tlU2Vzc2lvbigpIS5jb3VudGRvd24oKSAhPT0gbnVsbCkgOiAoaXNQbGF5aW5nKCkgfHwgY291bnRkb3duKCkgIT09IG51bGwpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvblN0YXJ0PXtoYW5kbGVTdGFydH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25TcGVlZENoYW5nZT17KHNwZWVkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTcGVlZCBjaGFuZ2VkOicsIHNwZWVkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTZWxlY3RlZFNwZWVkKHNwZWVkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXNzaW9uID0ga2FyYW9rZVNlc3Npb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2Vzc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBBcHBseWluZyBzcGVlZCBjaGFuZ2UgdG8gc2Vzc2lvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbi5oYW5kbGVTcGVlZENoYW5nZShzcGVlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTm8gc2Vzc2lvbiB5ZXQsIHNwZWVkIHdpbGwgYmUgYXBwbGllZCB3aGVuIHNlc3Npb24gc3RhcnRzJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFsc28gYXBwbHkgdG8gYXVkaW8gZWxlbWVudCBkaXJlY3RseSBpZiBpdCBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhdWRpbyA9IGF1ZGlvUmVmKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF1ZGlvKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByYXRlID0gc3BlZWQgPT09ICcwLjV4JyA/IDAuNSA6IHNwZWVkID09PSAnMC43NXgnID8gMC43NSA6IDEuMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU2V0dGluZyBhdWRpbyBwbGF5YmFjayByYXRlIGRpcmVjdGx5IHRvOicsIHJhdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXVkaW8ucGxheWJhY2tSYXRlID0gcmF0ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlzUmVjb3JkaW5nPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuaXNSZWNvcmRpbmcoKSA6IGZhbHNlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBsaW5lU2NvcmVzPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEubGluZVNjb3JlcygpIDogW119XG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgIHsvKiBDb3VudGRvd24gb3ZlcmxheSAqL31cbiAgICAgICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuY291bnRkb3duKCkgIT09IG51bGwgOiBjb3VudGRvd24oKSAhPT0gbnVsbH0+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWJzb2x1dGUgaW5zZXQtMCBiZy1ibGFjay84MCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB6LTUwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTh4bCBmb250LWJvbGQgdGV4dC13aGl0ZSBhbmltYXRlLXB1bHNlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLmNvdW50ZG93bigpIDogY291bnRkb3duKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXhsIHRleHQtd2hpdGUvODAgbXQtNFwiPkdldCByZWFkeSE8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgICAgey8qIENvbXBsZXRpb24gVmlldyBvciBQcmFjdGljZSBWaWV3ICovfVxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Nob3dQcmFjdGljZSgpfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICA8STE4blByb3ZpZGVyPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaC1mdWxsIGZsZXggZmxleC1jb2xcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXshY29tcGxldGlvbkRhdGEoKS5pc0xvYWRpbmd9IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBoLWZ1bGwgYmctYmFzZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYW5pbWF0ZS1zcGluIHJvdW5kZWQtZnVsbCBoLTE2IHctMTYgYm9yZGVyLWItMiBib3JkZXItYWNjZW50LXByaW1hcnkgbXgtYXV0byBtYi00XCI+PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5XCI+Q2FsY3VsYXRpbmcgeW91ciBmaW5hbCBzY29yZS4uLjwvcD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc20gdGV4dC10ZXJ0aWFyeSBtdC0yXCI+QW5hbHl6aW5nIGZ1bGwgcGVyZm9ybWFuY2U8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxDb21wbGV0aW9uVmlld1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImgtZnVsbFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3JlPXtjb21wbGV0aW9uRGF0YSgpLnNjb3JlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICByYW5rPXsxfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBzcGVlZD17c2VsZWN0ZWRTcGVlZCgpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBmZWVkYmFja1RleHQ9e1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRpb25EYXRhKCkuc2NvcmUgPj0gOTUgPyBcIlBlcmZlY3QhIFlvdSBuYWlsZWQgaXQhXCIgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRpb25EYXRhKCkuc2NvcmUgPj0gODUgPyBcIkV4Y2VsbGVudCBwZXJmb3JtYW5jZSFcIiA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGlvbkRhdGEoKS5zY29yZSA+PSA3MCA/IFwiR3JlYXQgam9iIVwiIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0aW9uRGF0YSgpLnNjb3JlID49IDUwID8gXCJHb29kIGVmZm9ydCFcIiA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJLZWVwIHByYWN0aWNpbmchXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvblByYWN0aWNlPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBQcmFjdGljZSBlcnJvcnMgY2xpY2tlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFNob3dQcmFjdGljZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvSTE4blByb3ZpZGVyPlxuICAgICAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgICAgICB7LyogUHJhY3RpY2UgVmlldyAqL31cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoLWZ1bGwgb3ZlcmZsb3cteS1hdXRvXCI+XG4gICAgICAgICAgICAgICAgICAgIDxQcmFjdGljZVZpZXdcbiAgICAgICAgICAgICAgICAgICAgICBzZXNzaW9uSWQ9e2NvbXBsZXRpb25EYXRhKCk/LnNlc3Npb25JZH1cbiAgICAgICAgICAgICAgICAgICAgICBvbkJhY2s9eygpID0+IHNldFNob3dQcmFjdGljZShmYWxzZSl9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvU2hvdz5cbiAgICA8Lz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2hhZG93Um9vdFVpIH0gZnJvbSAnd3h0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYWRvdy1yb290JztcbmltcG9ydCB7IGRlZmluZUNvbnRlbnRTY3JpcHQgfSBmcm9tICd3eHQvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0JztcbmltcG9ydCB0eXBlIHsgQ29udGVudFNjcmlwdENvbnRleHQgfSBmcm9tICd3eHQvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dCc7XG5pbXBvcnQgeyByZW5kZXIgfSBmcm9tICdzb2xpZC1qcy93ZWInO1xuaW1wb3J0IHsgQ29udGVudEFwcCB9IGZyb20gJy4uL3NyYy92aWV3cy9jb250ZW50L0NvbnRlbnRBcHAnO1xuaW1wb3J0ICcuLi9zcmMvc3R5bGVzL2V4dGVuc2lvbi5jc3MnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWycqOi8vc291bmRjbG91ZC5jb20vKicsICcqOi8vc291bmRjbG9hay5jb20vKicsICcqOi8vc2MubWFpZC56b25lLyonLCAnKjovLyoubWFpZC56b25lLyonXSxcbiAgcnVuQXQ6ICdkb2N1bWVudF9pZGxlJyxcbiAgY3NzSW5qZWN0aW9uTW9kZTogJ3VpJyxcblxuICBhc3luYyBtYWluKGN0eDogQ29udGVudFNjcmlwdENvbnRleHQpIHtcbiAgICAvLyBPbmx5IHJ1biBpbiB0b3AtbGV2ZWwgZnJhbWUgdG8gYXZvaWQgZHVwbGljYXRlIHByb2Nlc3NpbmcgaW4gaWZyYW1lc1xuICAgIGlmICh3aW5kb3cudG9wICE9PSB3aW5kb3cuc2VsZikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBzaGFkb3cgRE9NIGFuZCBtb3VudCBrYXJhb2tlIHdpZGdldFxuICAgIGNvbnN0IHVpID0gYXdhaXQgY3JlYXRlU2hhZG93Um9vdFVpKGN0eCwge1xuICAgICAgbmFtZTogJ3NjYXJsZXR0LWthcmFva2UtdWknLFxuICAgICAgcG9zaXRpb246ICdvdmVybGF5JyxcbiAgICAgIGFuY2hvcjogJ2JvZHknLFxuICAgICAgb25Nb3VudDogYXN5bmMgKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpID0+IHtcbiAgICAgICAgLy8gQ3JlYXRlIHdyYXBwZXIgZGl2IChDb250ZW50QXBwIHdpbGwgaGFuZGxlIHBvc2l0aW9uaW5nIGJhc2VkIG9uIHN0YXRlKVxuICAgICAgICBjb25zdCB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gJ2thcmFva2Utd2lkZ2V0LWNvbnRhaW5lcic7XG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh3cmFwcGVyKTtcblxuICAgICAgICAvLyBSZW5kZXIgQ29udGVudEFwcCBjb21wb25lbnQgKHdoaWNoIHVzZXMgRXh0ZW5zaW9uS2FyYW9rZVZpZXcpXG4gICAgICAgIGNvbnN0IGRpc3Bvc2UgPSByZW5kZXIoKCkgPT4gPENvbnRlbnRBcHAgLz4sIHdyYXBwZXIpO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIGRpc3Bvc2U7XG4gICAgICB9LFxuICAgICAgb25SZW1vdmU6IChjbGVhbnVwPzogKCkgPT4gdm9pZCkgPT4ge1xuICAgICAgICBjbGVhbnVwPy4oKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBNb3VudCB0aGUgVUlcbiAgICB1aS5tb3VudCgpO1xuICB9LFxufSk7IiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuZXhwb3J0IGNsYXNzIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG4gIGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG4gICAgc3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG4gICAgdGhpcy5uZXdVcmwgPSBuZXdVcmw7XG4gICAgdGhpcy5vbGRVcmwgPSBvbGRVcmw7XG4gIH1cbiAgc3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0VW5pcXVlRXZlbnROYW1lKGV2ZW50TmFtZSkge1xuICByZXR1cm4gYCR7YnJvd3Nlcj8ucnVudGltZT8uaWR9OiR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9OiR7ZXZlbnROYW1lfWA7XG59XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMb2NhdGlvbldhdGNoZXIoY3R4KSB7XG4gIGxldCBpbnRlcnZhbDtcbiAgbGV0IG9sZFVybDtcbiAgcmV0dXJuIHtcbiAgICAvKipcbiAgICAgKiBFbnN1cmUgdGhlIGxvY2F0aW9uIHdhdGNoZXIgaXMgYWN0aXZlbHkgbG9va2luZyBmb3IgVVJMIGNoYW5nZXMuIElmIGl0J3MgYWxyZWFkeSB3YXRjaGluZyxcbiAgICAgKiB0aGlzIGlzIGEgbm9vcC5cbiAgICAgKi9cbiAgICBydW4oKSB7XG4gICAgICBpZiAoaW50ZXJ2YWwgIT0gbnVsbCkgcmV0dXJuO1xuICAgICAgb2xkVXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgIGludGVydmFsID0gY3R4LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgbGV0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICAgIGlmIChuZXdVcmwuaHJlZiAhPT0gb2xkVXJsLmhyZWYpIHtcbiAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIG9sZFVybCkpO1xuICAgICAgICAgIG9sZFVybCA9IG5ld1VybDtcbiAgICAgICAgfVxuICAgICAgfSwgMWUzKTtcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHtcbiAgZ2V0VW5pcXVlRXZlbnROYW1lXG59IGZyb20gXCIuL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzXCI7XG5pbXBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENvbnRlbnRTY3JpcHRDb250ZXh0IHtcbiAgY29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcbiAgICB0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLmFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBpZiAodGhpcy5pc1RvcEZyYW1lKSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cyh7IGlnbm9yZUZpcnN0RXZlbnQ6IHRydWUgfSk7XG4gICAgICB0aGlzLnN0b3BPbGRTY3JpcHRzKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG4gICAgfVxuICB9XG4gIHN0YXRpYyBTQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXG4gICAgXCJ3eHQ6Y29udGVudC1zY3JpcHQtc3RhcnRlZFwiXG4gICk7XG4gIGlzVG9wRnJhbWUgPSB3aW5kb3cuc2VsZiA9PT0gd2luZG93LnRvcDtcbiAgYWJvcnRDb250cm9sbGVyO1xuICBsb2NhdGlvbldhdGNoZXIgPSBjcmVhdGVMb2NhdGlvbldhdGNoZXIodGhpcyk7XG4gIHJlY2VpdmVkTWVzc2FnZUlkcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIGdldCBzaWduYWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcbiAgfVxuICBhYm9ydChyZWFzb24pIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuYWJvcnQocmVhc29uKTtcbiAgfVxuICBnZXQgaXNJbnZhbGlkKCkge1xuICAgIGlmIChicm93c2VyLnJ1bnRpbWUuaWQgPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zaWduYWwuYWJvcnRlZDtcbiAgfVxuICBnZXQgaXNWYWxpZCgpIHtcbiAgICByZXR1cm4gIXRoaXMuaXNJbnZhbGlkO1xuICB9XG4gIC8qKlxuICAgKiBBZGQgYSBsaXN0ZW5lciB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBjb250ZW50IHNjcmlwdCdzIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lci5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG4gICAqIGNvbnN0IHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIgPSBjdHgub25JbnZhbGlkYXRlZCgoKSA9PiB7XG4gICAqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihjYik7XG4gICAqIH0pXG4gICAqIC8vIC4uLlxuICAgKiByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG4gICAqL1xuICBvbkludmFsaWRhdGVkKGNiKSB7XG4gICAgdGhpcy5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgICByZXR1cm4gKCkgPT4gdGhpcy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgfVxuICAvKipcbiAgICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IG5ldmVyIHJlc29sdmVzLiBVc2VmdWwgaWYgeW91IGhhdmUgYW4gYXN5bmMgZnVuY3Rpb24gdGhhdCBzaG91bGRuJ3QgcnVuXG4gICAqIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IGdldFZhbHVlRnJvbVN0b3JhZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAqICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcbiAgICpcbiAgICogICAvLyAuLi5cbiAgICogfVxuICAgKi9cbiAgYmxvY2soKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICovXG4gIHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKi9cbiAgc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICovXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICovXG4gIHJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RJZGxlQ2FsbGJhY2soKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICghdGhpcy5zaWduYWwuYWJvcnRlZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSwgb3B0aW9ucyk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbElkbGVDYWxsYmFjayhpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICBhZGRFdmVudExpc3RlbmVyKHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0aW9ucykge1xuICAgIGlmICh0eXBlID09PSBcInd4dDpsb2NhdGlvbmNoYW5nZVwiKSB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSB0aGlzLmxvY2F0aW9uV2F0Y2hlci5ydW4oKTtcbiAgICB9XG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXI/LihcbiAgICAgIHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLFxuICAgICAgaGFuZGxlcixcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgc2lnbmFsOiB0aGlzLnNpZ25hbFxuICAgICAgfVxuICAgICk7XG4gIH1cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKiBBYm9ydCB0aGUgYWJvcnQgY29udHJvbGxlciBhbmQgZXhlY3V0ZSBhbGwgYG9uSW52YWxpZGF0ZWRgIGxpc3RlbmVycy5cbiAgICovXG4gIG5vdGlmeUludmFsaWRhdGVkKCkge1xuICAgIHRoaXMuYWJvcnQoXCJDb250ZW50IHNjcmlwdCBjb250ZXh0IGludmFsaWRhdGVkXCIpO1xuICAgIGxvZ2dlci5kZWJ1ZyhcbiAgICAgIGBDb250ZW50IHNjcmlwdCBcIiR7dGhpcy5jb250ZW50U2NyaXB0TmFtZX1cIiBjb250ZXh0IGludmFsaWRhdGVkYFxuICAgICk7XG4gIH1cbiAgc3RvcE9sZFNjcmlwdHMoKSB7XG4gICAgd2luZG93LnBvc3RNZXNzYWdlKFxuICAgICAge1xuICAgICAgICB0eXBlOiBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsXG4gICAgICAgIGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuICAgICAgICBtZXNzYWdlSWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpXG4gICAgICB9LFxuICAgICAgXCIqXCJcbiAgICApO1xuICB9XG4gIHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuICAgIGNvbnN0IGlzU2NyaXB0U3RhcnRlZEV2ZW50ID0gZXZlbnQuZGF0YT8udHlwZSA9PT0gQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFO1xuICAgIGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kYXRhPy5jb250ZW50U2NyaXB0TmFtZSA9PT0gdGhpcy5jb250ZW50U2NyaXB0TmFtZTtcbiAgICBjb25zdCBpc05vdER1cGxpY2F0ZSA9ICF0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5oYXMoZXZlbnQuZGF0YT8ubWVzc2FnZUlkKTtcbiAgICByZXR1cm4gaXNTY3JpcHRTdGFydGVkRXZlbnQgJiYgaXNTYW1lQ29udGVudFNjcmlwdCAmJiBpc05vdER1cGxpY2F0ZTtcbiAgfVxuICBsaXN0ZW5Gb3JOZXdlclNjcmlwdHMob3B0aW9ucykge1xuICAgIGxldCBpc0ZpcnN0ID0gdHJ1ZTtcbiAgICBjb25zdCBjYiA9IChldmVudCkgPT4ge1xuICAgICAgaWYgKHRoaXMudmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSkge1xuICAgICAgICB0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5hZGQoZXZlbnQuZGF0YS5tZXNzYWdlSWQpO1xuICAgICAgICBjb25zdCB3YXNGaXJzdCA9IGlzRmlyc3Q7XG4gICAgICAgIGlzRmlyc3QgPSBmYWxzZTtcbiAgICAgICAgaWYgKHdhc0ZpcnN0ICYmIG9wdGlvbnM/Lmlnbm9yZUZpcnN0RXZlbnQpIHJldHVybjtcbiAgICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgICAgfVxuICAgIH07XG4gICAgYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiByZW1vdmVFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYikpO1xuICB9XG59XG4iLCJpbXBvcnQgY29tbW9uIGZyb20gJy4vY29tbW9uLmpzb24nO1xuaW1wb3J0IGthcmFva2UgZnJvbSAnLi9rYXJhb2tlLmpzb24nO1xuaW1wb3J0IGRpc3BsYXkgZnJvbSAnLi9kaXNwbGF5Lmpzb24nO1xuaW1wb3J0IHR5cGUgeyBUcmFuc2xhdGlvbnMgfSBmcm9tICcuLi8uLi90eXBlcyc7XG5cbmNvbnN0IHRyYW5zbGF0aW9uczogVHJhbnNsYXRpb25zID0ge1xuICBjb21tb24sXG4gIGthcmFva2UsXG4gIGRpc3BsYXksXG59O1xuXG5leHBvcnQgZGVmYXVsdCB0cmFuc2xhdGlvbnM7IiwiaW1wb3J0IGNvbW1vbiBmcm9tICcuL2NvbW1vbi5qc29uJztcbmltcG9ydCBrYXJhb2tlIGZyb20gJy4va2FyYW9rZS5qc29uJztcbmltcG9ydCBkaXNwbGF5IGZyb20gJy4vZGlzcGxheS5qc29uJztcbmltcG9ydCB0eXBlIHsgVHJhbnNsYXRpb25zIH0gZnJvbSAnLi4vLi4vdHlwZXMnO1xuXG5jb25zdCB0cmFuc2xhdGlvbnM6IFRyYW5zbGF0aW9ucyA9IHtcbiAgY29tbW9uLFxuICBrYXJhb2tlLFxuICBkaXNwbGF5LFxufTtcblxuZXhwb3J0IGRlZmF1bHQgdHJhbnNsYXRpb25zOyJdLCJuYW1lcyI6WyJ2YWx1ZSIsImVycm9yIiwiY2hpbGRyZW4iLCJtZW1vIiwiaW5kZXgiLCJyZXN1bHQiLCJpIiwic291cmNlcyIsImRpc3Bvc2UiLCJkb2N1bWVudCIsImFkZEV2ZW50TGlzdGVuZXIiLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lIiwic3R5bGUiLCJwcmludCIsImxvZ2dlciIsIl9hIiwiX2IiLCJyZW1vdmVEZXRlY3RvciIsIm1vdW50RGV0ZWN0b3IiLCJkZWZpbml0aW9uIiwiXyRkZWxlZ2F0ZUV2ZW50cyIsIlNjb3JlUGFuZWwiLCJwcm9wcyIsIl9lbCQiLCJfdG1wbCQiLCJfZWwkMiIsImZpcnN0Q2hpbGQiLCJfZWwkMyIsIl9lbCQ0IiwibmV4dFNpYmxpbmciLCJfZWwkNSIsIl8kaW5zZXJ0Iiwic2NvcmUiLCJyYW5rIiwiXyRjbGFzc05hbWUiLCJjbiIsImNsYXNzIiwiQnV0dG9uIiwibG9jYWwiLCJvdGhlcnMiLCJzcGxpdFByb3BzIiwidmFyaWFudCIsInNpemUiLCJfdG1wbCQzIiwiXyRzcHJlYWQiLCJfJG1lcmdlUHJvcHMiLCJkaXNhYmxlZCIsImxvYWRpbmciLCJmdWxsV2lkdGgiLCJfJGNyZWF0ZUNvbXBvbmVudCIsIlNob3ciLCJ3aGVuIiwibGVmdEljb24iLCJfdG1wbCQyIiwicmlnaHRJY29uIiwiTHlyaWNzRGlzcGxheSIsImN1cnJlbnRMaW5lSW5kZXgiLCJzZXRDdXJyZW50TGluZUluZGV4IiwiY3JlYXRlU2lnbmFsIiwiY29udGFpbmVyUmVmIiwiZ2V0TGluZVNjb3JlIiwibGluZUluZGV4IiwibGluZVNjb3JlcyIsImZpbmQiLCJzIiwiZ2V0U2NvcmVTdHlsZSIsImNvbG9yIiwiY3JlYXRlRWZmZWN0IiwiY3VycmVudFRpbWUiLCJseXJpY3MiLCJsZW5ndGgiLCJ0aW1lIiwiVElNSU5HX09GRlNFVCIsImFkanVzdGVkVGltZSIsImZvdW5kSW5kZXgiLCJsaW5lIiwiZW5kVGltZSIsInN0YXJ0VGltZSIsImR1cmF0aW9uIiwicHJldkluZGV4IiwiTWF0aCIsImFicyIsImNvbnNvbGUiLCJsb2ciLCJmcm9tIiwidG8iLCJ0aW1lSW5TZWNvbmRzIiwianVtcCIsIndhcm4iLCJmcm9tTGluZSIsInRvTGluZSIsImlzUGxheWluZyIsImxpbmVFbGVtZW50cyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJjdXJyZW50RWxlbWVudCIsImNvbnRhaW5lckhlaWdodCIsImNsaWVudEhlaWdodCIsImxpbmVUb3AiLCJvZmZzZXRUb3AiLCJsaW5lSGVpZ2h0Iiwib2Zmc2V0SGVpZ2h0IiwidGFyZ2V0U2Nyb2xsVG9wIiwic2Nyb2xsVG8iLCJ0b3AiLCJiZWhhdmlvciIsIl9yZWYkIiwiXyR1c2UiLCJGb3IiLCJlYWNoIiwibGluZVNjb3JlIiwic2NvcmVTdHlsZSIsInRleHQiLCJfJGVmZmVjdCIsIl9wJCIsIl92JCIsIl92JDIiLCJfdiQzIiwiZSIsIl8kc2V0QXR0cmlidXRlIiwidCIsImEiLCJzZXRQcm9wZXJ0eSIsInJlbW92ZVByb3BlcnR5IiwidW5kZWZpbmVkIiwiTGVhZGVyYm9hcmRQYW5lbCIsImVudHJpZXMiLCJmYWxsYmFjayIsImVudHJ5IiwiX2VsJDYiLCJfZWwkNyIsInVzZXJuYW1lIiwidG9Mb2NhbGVTdHJpbmciLCJpc0N1cnJlbnRVc2VyIiwiX3YkNCIsIm8iLCJzcGVlZHMiLCJTcGxpdEJ1dHRvbiIsImN1cnJlbnRTcGVlZEluZGV4Iiwic2V0Q3VycmVudFNwZWVkSW5kZXgiLCJjdXJyZW50U3BlZWQiLCJjeWNsZVNwZWVkIiwic3RvcFByb3BhZ2F0aW9uIiwibmV4dEluZGV4IiwibmV3U3BlZWQiLCJvblNwZWVkQ2hhbmdlIiwiXyRhZGRFdmVudExpc3RlbmVyIiwib25TdGFydCIsIiQkY2xpY2siLCJfdiQ1IiwiVGFic0NvbnRleHQiLCJjcmVhdGVDb250ZXh0IiwiVGFicyIsImFjdGl2ZVRhYiIsInNldEFjdGl2ZVRhYiIsImRlZmF1bHRUYWIiLCJ0YWJzIiwiaWQiLCJoYW5kbGVUYWJDaGFuZ2UiLCJvblRhYkNoYW5nZSIsImNvbnRleHRWYWx1ZSIsIlByb3ZpZGVyIiwiVGFic0xpc3QiLCJUYWJzVHJpZ2dlciIsImNvbnRleHQiLCJ1c2VDb250ZXh0IiwiaXNBY3RpdmUiLCJUYWJzQ29udGVudCIsIkZpcmVFbW9qaUFuaW1hdGlvbiIsInNob3dGaXJlIiwic2V0U2hvd0ZpcmUiLCJmaXJlWCIsInNldEZpcmVYIiwibGFzdExpbmVJbmRleCIsImhpZGVUaW1lciIsInJhbmRvbSIsInNldFRpbWVvdXQiLCJvbkNsZWFudXAiLCJzdHlsZXMiLCJmaXJlQ29udGFpbmVyIiwiZmlyZUVtb2ppIiwiRXh0ZW5zaW9uS2FyYW9rZVZpZXciLCJnZXRMYXRlc3RIaWdoU2NvcmVMaW5lIiwic2NvcmVzIiwibGF0ZXN0IiwiX3RtcGwkNSIsIl90bXBsJDYiLCJfZWwkOCIsImxhYmVsIiwiX3RtcGwkNCIsImxlYWRlcmJvYXJkIiwiSTE4bkNvbnRleHQiLCJJMThuUHJvdmlkZXIiLCJsb2NhbGUiLCJzZXRMb2NhbGUiLCJkZWZhdWx0TG9jYWxlIiwidHJhbnNsYXRpb25zIiwic2V0VHJhbnNsYXRpb25zIiwiY3VycmVudExvY2FsZSIsIm1vZHVsZSIsImRlZmF1bHQiLCJfZSIsImtleSIsInBhcmFtcyIsImtleXMiLCJzcGxpdCIsImsiLCJyZXBsYWNlIiwiXyIsIlN0cmluZyIsImRpciIsIm51bWJlckZvcm1hdHRlciIsImNyZWF0ZU1lbW8iLCJJbnRsIiwiTnVtYmVyRm9ybWF0IiwiZm9ybWF0TnVtYmVyIiwibnVtIiwiZm9ybWF0IiwiZm9ybWF0RGF0ZSIsImRhdGUiLCJvcHRpb25zIiwiRGF0ZVRpbWVGb3JtYXQiLCJ1c2VJMThuIiwiRXJyb3IiLCJDb21wbGV0aW9uVmlldyIsImdldEZlZWRiYWNrVGV4dCIsImZlZWRiYWNrVGV4dCIsIl9lbCQ5IiwiX2VsJDEiLCJfZWwkMTAiLCJfZWwkMTEiLCJfZWwkMTIiLCJfZWwkMTMiLCJzcGVlZCIsIm9uUHJhY3RpY2UiLCJfZWwkMTQiLCJvbkNsaWNrIiwic2FtcGxlUmF0ZSIsIm9mZnNldCIsIlByb2dyZXNzQmFyIiwicGVyY2VudGFnZSIsIm1pbiIsIm1heCIsImN1cnJlbnQiLCJ0b3RhbCIsIk1pbmltaXplZEthcmFva2UiLCJjdXJyZW50VGFyZ2V0IiwidHJhbnNmb3JtIiwiUHJhY3RpY2VIZWFkZXIiLCJ0aXRsZSIsIkV4ZXJjaXNlRm9vdGVyIiwiaXNSZWNvcmRpbmciLCJvblN0b3AiLCJpc1Byb2Nlc3NpbmciLCJjYW5TdWJtaXQiLCJvblJlY29yZCIsIm9uU3VibWl0IiwicCIsIlJlc3BvbnNlRm9vdGVyIiwibW9kZSIsImlzQ29ycmVjdCIsIkljb25YQ2lyY2xlRmlsbCIsIkljb25DaGVja0NpcmNsZUZpbGwiLCJfJHAiLCJfJHN0eWxlIiwib25Db250aW51ZSIsImNvbnRpbnVlTGFiZWwiLCJvbkNoZWNrIiwiRXhlcmNpc2VUZW1wbGF0ZSIsIl9jJCIsIl8kbWVtbyIsImluc3RydWN0aW9uVGV4dCIsIlJlYWRBbG91ZCIsInByb21wdCIsInVzZXJUcmFuc2NyaXB0IiwiUHJhY3RpY2VFeGVyY2lzZVZpZXciLCJjdXJyZW50RXhlcmNpc2VJbmRleCIsInNldEN1cnJlbnRFeGVyY2lzZUluZGV4Iiwic2V0SXNSZWNvcmRpbmciLCJzZXRJc1Byb2Nlc3NpbmciLCJzZXRVc2VyVHJhbnNjcmlwdCIsImN1cnJlbnRTY29yZSIsInNldEN1cnJlbnRTY29yZSIsIm1lZGlhUmVjb3JkZXIiLCJzZXRNZWRpYVJlY29yZGVyIiwiYXVkaW9DaHVua3MiLCJzZXRBdWRpb0NodW5rcyIsInNob3dGZWVkYmFjayIsInNldFNob3dGZWVkYmFjayIsInNldElzQ29ycmVjdCIsImFwaUJhc2VVcmwiLCJleGVyY2lzZXMiLCJjcmVhdGVSZXNvdXJjZSIsInVybCIsInNlc3Npb25JZCIsImhlYWRlcnMiLCJhdXRoVG9rZW4iLCJyZXNwb25zZSIsImZldGNoIiwib2siLCJlcnJvclRleHQiLCJzdGF0dXMiLCJkYXRhIiwianNvbiIsImhhbmRsZVN0YXJ0UmVjb3JkaW5nIiwic3RyZWFtIiwibmF2aWdhdG9yIiwibWVkaWFEZXZpY2VzIiwiZ2V0VXNlck1lZGlhIiwiYXVkaW8iLCJlY2hvQ2FuY2VsbGF0aW9uIiwibm9pc2VTdXBwcmVzc2lvbiIsImF1dG9HYWluQ29udHJvbCIsIm1pbWVUeXBlIiwiTWVkaWFSZWNvcmRlciIsImlzVHlwZVN1cHBvcnRlZCIsInJlY29yZGVyIiwiY2h1bmtzIiwib25kYXRhYXZhaWxhYmxlIiwiZXZlbnQiLCJwdXNoIiwib25zdG9wIiwiYXVkaW9CbG9iIiwiQmxvYiIsInR5cGUiLCJwcm9jZXNzUmVjb3JkaW5nIiwiZ2V0VHJhY2tzIiwiZm9yRWFjaCIsInRyYWNrIiwic3RvcCIsInN0YXJ0IiwiYmxvYiIsInJlYWRlciIsIkZpbGVSZWFkZXIiLCJiYXNlNjQiLCJQcm9taXNlIiwicmVzb2x2ZSIsIm9ubG9hZGVuZCIsImJhc2U2NFN0cmluZyIsInJlYWRBc0RhdGFVUkwiLCJhdHRlbXB0cyIsIm1heEF0dGVtcHRzIiwibWV0aG9kIiwiYm9keSIsIkpTT04iLCJzdHJpbmdpZnkiLCJhdWRpb0Jhc2U2NCIsImV4cGVjdGVkVGV4dCIsImN1cnJlbnRFeGVyY2lzZSIsImZ1bGxfbGluZSIsInByZWZlckRlZXBncmFtIiwiZmV0Y2hFcnJvciIsInRyYW5zY3JpcHQiLCJjYWxjdWxhdGVTY29yZSIsImhhbmRsZUF1dG9TdWJtaXQiLCJoYW5kbGVTdG9wUmVjb3JkaW5nIiwic3RhdGUiLCJleHBlY3RlZCIsImFjdHVhbCIsImV4cGVjdGVkV29yZHMiLCJ0b0xvd2VyQ2FzZSIsImFjdHVhbFdvcmRzIiwibWF0Y2hlcyIsInJvdW5kIiwiY2FyZF9pZHMiLCJleGVyY2lzZUlkIiwiY2FyZFNjb3JlcyIsIm1hcCIsImNhcmRJZCIsImhhbmRsZVN1Ym1pdCIsImhhbmRsZUNvbnRpbnVlIiwib25CYWNrIiwiZXhlcmNpc2UiLCJoZWFkZXJUaXRsZSIsIm9uRXhpdCIsInRyaW0iLCJrYXJhb2tlQXBpIiwiS2FyYW9rZUFwaVNlcnZpY2UiLCJQcmFjdGljZVZpZXciLCJDb250ZW50QXBwIiwiY3VycmVudFRyYWNrIiwic2V0Q3VycmVudFRyYWNrIiwic2V0QXV0aFRva2VuIiwic2hvd0thcmFva2UiLCJzZXRTaG93S2FyYW9rZSIsImthcmFva2VEYXRhIiwic2V0S2FyYW9rZURhdGEiLCJzZXRMb2FkaW5nIiwic2Vzc2lvblN0YXJ0ZWQiLCJzZXRTZXNzaW9uU3RhcnRlZCIsImlzTWluaW1pemVkIiwic2V0SXNNaW5pbWl6ZWQiLCJjb3VudGRvd24iLCJzZXRDb3VudGRvd24iLCJzZXRJc1BsYXlpbmciLCJzZXRDdXJyZW50VGltZSIsImF1ZGlvUmVmIiwic2V0QXVkaW9SZWYiLCJrYXJhb2tlU2Vzc2lvbiIsInNldEthcmFva2VTZXNzaW9uIiwiY29tcGxldGlvbkRhdGEiLCJzZXRDb21wbGV0aW9uRGF0YSIsInNob3dQcmFjdGljZSIsInNldFNob3dQcmFjdGljZSIsInNlbGVjdGVkU3BlZWQiLCJzZXRTZWxlY3RlZFNwZWVkIiwib25Nb3VudCIsInRva2VuIiwiZ2V0QXV0aFRva2VuIiwiY2xlYW51cCIsInRyYWNrRGV0ZWN0b3IiLCJ3YXRjaEZvckNoYW5nZXMiLCJmZXRjaEthcmFva2VEYXRhIiwiZ2V0S2FyYW9rZURhdGEiLCJ0cmFja0lkIiwiYXJ0aXN0IiwiaGFuZGxlU3RhcnQiLCJsaW5lcyIsInRyYWNrVGl0bGUiLCJzb25nRGF0YSIsInNvbmciLCJoYXNMeXJpY3MiLCJuZXdTZXNzaW9uIiwidXNlS2FyYW9rZVNlc3Npb24iLCJhbGJ1bSIsInNvbmdDYXRhbG9nSWQiLCJzb25nX2NhdGFsb2dfaWQiLCJhdWRpb0VsZW1lbnQiLCJhcGlVcmwiLCJvbkNvbXBsZXRlIiwicmVzdWx0cyIsInBhdXNlIiwiaGFuZGxlU3BlZWRDaGFuZ2UiLCJzdGFydFNlc3Npb24iLCJzZXRBdWRpb0VsZW1lbnQiLCJjb3VudGRvd25JbnRlcnZhbCIsInNldEludGVydmFsIiwiY2xlYXJJbnRlcnZhbCIsInN0YXJ0QXVkaW9QbGF5YmFjayIsImF1ZGlvRWxlbWVudHMiLCJzcmMiLCJwYXVzZWQiLCJzZXNzaW9uIiwiYXVkaW9Qcm9jZXNzb3IiLCJpc1JlYWR5IiwiaW5pdGlhbGl6ZSIsImNhdGNoIiwicGxheSIsInRoZW4iLCJlcnIiLCJwbGF5QnV0dG9uIiwicXVlcnlTZWxlY3RvciIsImNsaWNrIiwidXBkYXRlVGltZSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJuZXdBdWRpb0VsZW1lbnRzIiwiaGFuZGxlTWluaW1pemUiLCJoYW5kbGVSZXN0b3JlIiwiX3RtcGwkNyIsIl90bXBsJDgiLCJfZWwkMCIsInJhdGUiLCJwbGF5YmFja1JhdGUiLCJfZWwkMTUiLCJfdG1wbCQ5IiwiaXNMb2FkaW5nIiwiX3RtcGwkMCIsImRlZmluZUNvbnRlbnRTY3JpcHQiLCJydW5BdCIsImNzc0luamVjdGlvbk1vZGUiLCJtYWluIiwiY3R4Iiwid2luZG93Iiwic2VsZiIsInVpIiwiY3JlYXRlU2hhZG93Um9vdFVpIiwibmFtZSIsInBvc2l0aW9uIiwiYW5jaG9yIiwiY29udGFpbmVyIiwid3JhcHBlciIsImNyZWF0ZUVsZW1lbnQiLCJjbGFzc05hbWUiLCJhcHBlbmRDaGlsZCIsInJlbmRlciIsIm9uUmVtb3ZlIiwibW91bnQiLCJjb21tb24iLCJrYXJhb2tlIiwiZGlzcGxheSJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBZ0pBLFFBQU0sU0FBUztBQUNmLFFBQU0sVUFBVSxDQUFDLEdBQUcsTUFBTSxNQUFNO0FBQ2hDLFFBQU0sU0FBUyxPQUFPLGFBQWE7QUFDbkMsUUFBTSxpQkFBaUIsT0FBTyxVQUFVO0FBQ3hDLFFBQU0sU0FBUyxPQUFPLGFBQWE7QUFDbkMsUUFBTSxXQUFXLE9BQU8scUJBQXFCO0FBQzdDLFFBQU0sZ0JBQWdCO0FBQUEsSUFDcEIsUUFBUTtBQUFBLEVBQ1Y7QUFFQSxNQUFJLGFBQWE7QUFDakIsUUFBTSxRQUFRO0FBQ2QsUUFBTSxVQUFVO0FBQ2hCLFFBQU0sVUFBVSxDQUtoQjtBQUNBLFFBQU0sVUFBVSxDQUFDO0FBQ2pCLE1BQUksUUFBUTtBQUNaLE1BQUksYUFBYTtBQUVqQixNQUFJLHVCQUF1QjtBQUMzQixNQUFJLFdBQVc7QUFDZixNQUFJLFVBQVU7QUFDZCxNQUFJLFVBQVU7QUFDZCxNQUFJLFlBQVk7QUFPaEIsV0FBUyxXQUFXLElBQUksZUFBZTtBQUNyQyxVQUFNLFdBQVcsVUFDZixRQUFRLE9BQ1IsVUFBVSxHQUFHLFdBQVcsR0FDeEIsVUFBVSxrQkFBa0IsU0FBWSxRQUFRLGVBQ2hELE9BQU8sVUFBVTtBQUFBLE1BQ2YsT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1B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QUMsS0FBSyxtQkFBbUIsS0FBSSxXQUFNLFNBQU4sbUJBQVksU0FBUztBQUN6RSxhQUFPLHdCQUF3Qix1QkFBdUI7QUFBQSxJQUMxRDtBQUFBLElBQ0Usc0JBQXNCLFNBQVM7QUFDN0IsVUFBSSxVQUFVO0FBQ2QsWUFBTSxLQUFLLENBQUMsVUFBVTtBQUNwQixZQUFJLEtBQUsseUJBQXlCLEtBQUssR0FBRztBQUN4QyxlQUFLLG1CQUFtQixJQUFJLE1BQU0sS0FBSyxTQUFTO0FBQ2hELGdCQUFNLFdBQVc7QUFDakIsb0JBQVU7QUFDVixjQUFJLGFBQVksbUNBQVMsa0JBQWtCO0FBQzNDLGVBQUssa0JBQW1CO0FBQUEsUUFDaEM7QUFBQSxNQUNLO0FBQ0QsdUJBQWlCLFdBQVcsRUFBRTtBQUM5QixXQUFLLGNBQWMsTUFBTSxvQkFBb0IsV0FBVyxFQUFFLENBQUM7QUFBQSxJQUMvRDtBQUFBLEVBQ0E7QUFySkUsZ0JBWlcsdUJBWUosK0JBQThCO0FBQUEsSUFDbkM7QUFBQSxFQUNEO0FBZEksTUFBTSx1QkFBTjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDRFAsUUFBTW1MLGlCQUE2QjtBQUFBLElBQUEsUUFDakNtUztBQUFBQSxJQUFBLFNBQ0FDO0FBQUFBLElBQ0FDLFNBQUFBO0FBQUFBLEVBQ0Y7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDSkEsUUFBTSxlQUE2QjtBQUFBLElBQ2pDO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGOzs7Ozs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCwxLDIsMyw0LDUsNiw3LDgsOSwxMCwxMSwxMiwxMywxNCwxNSw0NCw0NSw1OSw2MCw2MV19

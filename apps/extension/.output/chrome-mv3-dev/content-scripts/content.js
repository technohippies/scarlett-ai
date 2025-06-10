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
        const source = node.sources.pop(), index = node.sourceSlots.pop(), obs = source.observers;
        if (obs && obs.length) {
          const n = obs.pop(), s = source.observerSlots.pop();
          if (index < obs.length) {
            n.sourceSlots[s] = index;
            obs[index] = n;
            source.observerSlots[index] = s;
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
        const index = map.get(a[aStart]);
        if (index != null) {
          if (bStart < index && index < bEnd) {
            let i = aStart, sequence = 1, t;
            while (++i < aEnd && i < bEnd) {
              if ((t = map.get(a[i])) == null || t !== index + sequence) break;
              sequence++;
            }
            if (sequence > index - bStart) {
              const node = a[aStart];
              while (bStart < index) parentNode.insertBefore(b[bStart++], node);
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
  function className(node, value) {
    if (value == null) node.removeAttribute("class");
    else node.className = value;
  }
  function addEventListener$1(node, name, handler, delegate) {
    {
      if (Array.isArray(handler)) {
        node[`$$${name}`] = handler[0];
        node[`$$${name}Data`] = handler[1];
      } else node[`$$${name}`] = handler;
    }
  }
  function use(fn, element, arg) {
    return untrack(() => fn(element, arg));
  }
  function insert(parent, accessor, marker, initial) {
    if (marker !== void 0 && !initial) initial = [];
    if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
    createRenderEffect((current) => insertExpression(parent, accessor(), current, marker), initial);
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
        const style = document.createElement("style");
        if ("url" in css) {
          style.textContent = yield fetch(css.url).then((res) => res.text());
        } else {
          style.textContent = css.textContent;
        }
        head.appendChild(style);
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
        const style = document.createElement("style");
        style.textContent = documentCss;
        style.setAttribute("wxt-shadow-root-document-styles", instanceId);
        (document.head ?? document.body).append(style);
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
  var _tmpl$$6 = /* @__PURE__ */ template(`<div><div class="bg-surface rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px]"><div class="text-2xl font-mono font-bold text-accent-primary"></div><div class="text-sm text-secondary mt-1">Score</div></div><div class="bg-surface rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px]"><div class="text-2xl font-mono font-bold text-accent-secondary"></div><div class="text-sm text-secondary mt-1">Rank`);
  const ScorePanel = (props) => {
    return (() => {
      var _el$ = _tmpl$$6(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$2.nextSibling, _el$5 = _el$4.firstChild;
      insert(_el$3, () => props.score);
      insert(_el$5, () => props.rank);
      createRenderEffect(() => className(_el$, cn("grid grid-cols-[1fr_1fr] gap-2 p-4", props.class)));
      return _el$;
    })();
  };
  content;
  content;
  delegateEvents(["keydown", "click"]);
  content;
  content;
  var _tmpl$$5 = /* @__PURE__ */ template(`<div><div class=space-y-8>`), _tmpl$2$3 = /* @__PURE__ */ template(`<div>`);
  const LyricsDisplay = (props) => {
    const [currentLineIndex, setCurrentLineIndex] = createSignal(-1);
    let containerRef;
    createEffect(() => {
      if (!props.currentTime) {
        setCurrentLineIndex(-1);
        return;
      }
      const time = props.currentTime;
      const index = props.lyrics.findIndex((line) => {
        const endTime = line.startTime + line.duration;
        return time >= line.startTime && time < endTime;
      });
      setCurrentLineIndex(index);
    });
    createEffect(() => {
      const index = currentLineIndex();
      if (index === -1 || !containerRef || !props.isPlaying) return;
      const lineElements = containerRef.querySelectorAll("[data-line-index]");
      const currentElement = lineElements[index];
      if (currentElement) {
        const containerHeight = containerRef.clientHeight;
        const lineTop = currentElement.offsetTop;
        const lineHeight = currentElement.offsetHeight;
        const scrollTop = lineTop - containerHeight / 2 + lineHeight / 2;
        containerRef.scrollTo({
          top: scrollTop,
          behavior: "smooth"
        });
      }
    });
    return (() => {
      var _el$ = _tmpl$$5(), _el$2 = _el$.firstChild;
      var _ref$ = containerRef;
      typeof _ref$ === "function" ? use(_ref$, _el$) : containerRef = _el$;
      insert(_el$2, createComponent(For, {
        get each() {
          return props.lyrics;
        },
        children: (line, index) => (() => {
          var _el$3 = _tmpl$2$3();
          insert(_el$3, () => line.text);
          createRenderEffect((_p$) => {
            var _v$ = index(), _v$2 = cn("text-center transition-all duration-300", "text-2xl leading-relaxed", index() === currentLineIndex() ? "text-primary font-semibold scale-110" : "text-secondary opacity-60");
            _v$ !== _p$.e && setAttribute(_el$3, "data-line-index", _p$.e = _v$);
            _v$2 !== _p$.t && className(_el$3, _p$.t = _v$2);
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$3;
        })()
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
  var _tmpl$$4 = /* @__PURE__ */ template(`<div>`), _tmpl$2$2 = /* @__PURE__ */ template(`<div><span>#</span><span></span><span>`);
  const LeaderboardPanel = (props) => {
    return (() => {
      var _el$ = _tmpl$$4();
      insert(_el$, createComponent(For, {
        get each() {
          return props.entries;
        },
        children: (entry) => (() => {
          var _el$2 = _tmpl$2$2(), _el$3 = _el$2.firstChild;
          _el$3.firstChild;
          var _el$5 = _el$3.nextSibling, _el$6 = _el$5.nextSibling;
          insert(_el$3, () => entry.rank, null);
          insert(_el$5, () => entry.username);
          insert(_el$6, () => entry.score.toLocaleString());
          createRenderEffect((_p$) => {
            var _v$ = cn("flex items-center gap-3 px-3 py-2 rounded-lg transition-colors", entry.isCurrentUser ? "bg-accent-primary/10 border border-accent-primary/20" : "bg-surface hover:bg-surface-hover"), _v$2 = cn("w-8 text-center font-mono font-bold", entry.rank <= 3 ? "text-accent-primary" : "text-secondary"), _v$3 = cn("flex-1 truncate", entry.isCurrentUser ? "text-accent-primary font-medium" : "text-primary"), _v$4 = cn("font-mono font-bold", entry.isCurrentUser ? "text-accent-primary" : "text-primary");
            _v$ !== _p$.e && className(_el$2, _p$.e = _v$);
            _v$2 !== _p$.t && className(_el$3, _p$.t = _v$2);
            _v$3 !== _p$.a && className(_el$5, _p$.a = _v$3);
            _v$4 !== _p$.o && className(_el$6, _p$.o = _v$4);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0,
            o: void 0
          });
          return _el$2;
        })()
      }));
      createRenderEffect(() => className(_el$, cn("flex flex-col gap-2 p-4", props.class)));
      return _el$;
    })();
  };
  content;
  content;
  var _tmpl$$3 = /* @__PURE__ */ template(`<div><button><span class="relative z-10">Start</span></button><div class="w-px bg-black/20"></div><button aria-label="Change playback speed"><span class="relative z-10">`);
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
      var _el$ = _tmpl$$3(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling, _el$4 = _el$3.nextSibling, _el$5 = _el$4.firstChild;
      addEventListener$1(_el$2, "click", props.onStart);
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
  var _tmpl$$2 = /* @__PURE__ */ template(`<div>`), _tmpl$2$1 = /* @__PURE__ */ template(`<button>`);
  let currentTabsState = null;
  const Tabs = (props) => {
    var _a2;
    const [activeTab, setActiveTab] = createSignal(props.defaultTab || ((_a2 = props.tabs[0]) == null ? void 0 : _a2.id) || "");
    const handleTabChange = (id) => {
      var _a3;
      setActiveTab(id);
      (_a3 = props.onTabChange) == null ? void 0 : _a3.call(props, id);
    };
    currentTabsState = {
      activeTab,
      setActiveTab: handleTabChange
    };
    return (() => {
      var _el$ = _tmpl$$2();
      insert(_el$, () => props.children);
      createRenderEffect(() => className(_el$, cn("w-full", props.class)));
      return _el$;
    })();
  };
  const TabsList = (props) => {
    return (() => {
      var _el$2 = _tmpl$$2();
      insert(_el$2, () => props.children);
      createRenderEffect(() => className(_el$2, cn("inline-flex h-10 items-center justify-center rounded-md bg-surface p-1 text-secondary", "w-full", props.class)));
      return _el$2;
    })();
  };
  const TabsTrigger = (props) => {
    const isActive = () => (currentTabsState == null ? void 0 : currentTabsState.activeTab()) === props.value;
    return (() => {
      var _el$3 = _tmpl$2$1();
      _el$3.$$click = () => currentTabsState == null ? void 0 : currentTabsState.setActiveTab(props.value);
      insert(_el$3, () => props.children);
      createRenderEffect(() => className(_el$3, cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5", "text-sm font-medium ring-offset-base transition-all", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2", "disabled:pointer-events-none disabled:opacity-50", "flex-1", isActive() ? "bg-base text-primary shadow-sm" : "text-secondary hover:text-primary", props.class)));
      return _el$3;
    })();
  };
  const TabsContent = (props) => {
    return createComponent(Show, {
      get when() {
        return (currentTabsState == null ? void 0 : currentTabsState.activeTab()) === props.value;
      },
      get children() {
        var _el$4 = _tmpl$$2();
        insert(_el$4, () => props.children);
        createRenderEffect(() => className(_el$4, cn("mt-2 ring-offset-base", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2", props.class)));
        return _el$4;
      }
    });
  };
  delegateEvents(["click"]);
  content;
  content;
  var _tmpl$$1 = /* @__PURE__ */ template(`<div class=px-4>`), _tmpl$2 = /* @__PURE__ */ template(`<div class="flex-1 overflow-hidden">`), _tmpl$3 = /* @__PURE__ */ template(`<div class="overflow-y-auto h-full">`), _tmpl$4 = /* @__PURE__ */ template(`<div>`), _tmpl$5 = /* @__PURE__ */ template(`<div class="p-4 bg-surface border-t border-subtle">`);
  const ExtensionKaraokeView = (props) => {
    return (() => {
      var _el$ = _tmpl$4();
      insert(_el$, createComponent(ScorePanel, {
        get score() {
          return props.score;
        },
        get rank() {
          return props.rank;
        }
      }), null);
      insert(_el$, createComponent(Tabs, {
        tabs: [{
          id: "lyrics",
          label: "Lyrics"
        }, {
          id: "leaderboard",
          label: "Leaderboard"
        }],
        defaultTab: "lyrics",
        "class": "flex-1 flex flex-col overflow-hidden",
        get children() {
          return [(() => {
            var _el$2 = _tmpl$$1();
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
            "class": "flex-1 flex flex-col overflow-hidden",
            get children() {
              return [(() => {
                var _el$3 = _tmpl$2();
                insert(_el$3, createComponent(LyricsDisplay, {
                  get lyrics() {
                    return props.lyrics;
                  },
                  get currentTime() {
                    return props.currentTime;
                  },
                  get isPlaying() {
                    return props.isPlaying;
                  }
                }));
                return _el$3;
              })(), memo(() => memo(() => !!(!props.isPlaying && props.onStart))() && (() => {
                var _el$5 = _tmpl$5();
                insert(_el$5, createComponent(SplitButton, {
                  get onStart() {
                    return props.onStart;
                  },
                  get onSpeedChange() {
                    return props.onSpeedChange;
                  }
                }));
                return _el$5;
              })())];
            }
          }), createComponent(TabsContent, {
            value: "leaderboard",
            "class": "flex-1 overflow-hidden",
            get children() {
              var _el$4 = _tmpl$3();
              insert(_el$4, createComponent(LeaderboardPanel, {
                get entries() {
                  return props.leaderboard;
                }
              }));
              return _el$4;
            }
          })];
        }
      }), null);
      createRenderEffect(() => className(_el$, cn("flex flex-col h-full bg-base", props.class)));
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
  content;
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
  content;
  content;
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
      try {
        const pathParts = window.location.pathname.split("/").filter(Boolean);
        if (pathParts.length < 2) return null;
        const artist = pathParts[0];
        const trackSlug = pathParts[1];
        const titleSelectors = [
          ".soundTitle__title",
          ".trackItem__trackTitle",
          'h1[itemprop="name"]',
          ".sound__header h1",
          ".sc-text-h4",
          ".sc-text-primary"
        ];
        let title = "";
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            title = element.textContent.trim();
            break;
          }
        }
        if (!title) {
          title = trackSlug.replace(/-/g, " ");
        }
        const cleanArtist = artist.replace(/-/g, " ").replace(/_/g, " ");
        return {
          trackId: `${artist}/${trackSlug}`,
          title,
          artist: cleanArtist,
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
  var _tmpl$ = /* @__PURE__ */ template(`<div class="karaoke-widget bg-base h-full overflow-hidden rounded-lg">`);
  const ContentApp = () => {
    console.log("[ContentApp] Rendering ContentApp component");
    const [currentTrack, setCurrentTrack] = createSignal(null);
    const [karaokeData, setKaraokeData] = createSignal(null);
    const [isLoading, setIsLoading] = createSignal(false);
    const [error, setError] = createSignal(null);
    const mockLeaderboard = [{
      rank: 1,
      username: "KaraokeKing",
      score: 12500
    }, {
      rank: 2,
      username: "SongBird92",
      score: 11200
    }, {
      rank: 3,
      username: "MelodyMaster",
      score: 10800
    }, {
      rank: 4,
      username: "CurrentUser",
      score: 8750,
      isCurrentUser: true
    }, {
      rank: 5,
      username: "VocalVirtuoso",
      score: 8200
    }];
    createEffect(async () => {
      const track = currentTrack();
      if (!track) {
        setKaraokeData(null);
        return;
      }
      console.log("[ContentApp] Fetching karaoke data for track:", track);
      setIsLoading(true);
      setError(null);
      try {
        const data = await karaokeApi.getKaraokeData(track.trackId, track.title, track.artist);
        if (data && (data.hasKaraoke || data.has_karaoke)) {
          setKaraokeData(data);
          console.log("[ContentApp] Karaoke data loaded:", data);
        } else if (data == null ? void 0 : data.api_connected) {
          setError(`API Connected! ${data.error || "Database setup needed"}`);
          setKaraokeData(data);
        } else {
          setError((data == null ? void 0 : data.message) || (data == null ? void 0 : data.error) || "No karaoke data available for this track");
          setKaraokeData(null);
        }
      } catch (err) {
        console.error("[ContentApp] Error fetching karaoke data:", err);
        setError("Failed to load karaoke data");
        setKaraokeData(null);
      } finally {
        setIsLoading(false);
      }
    });
    onMount(() => {
      console.log("[ContentApp] Setting up track detection");
      const cleanup = trackDetector.watchForChanges((track) => {
        console.log("[ContentApp] Track changed:", track);
        setCurrentTrack(track);
      });
      onCleanup(cleanup);
    });
    const getLyrics = () => {
      var _a2;
      const data = karaokeData();
      if (!((_a2 = data == null ? void 0 : data.lyrics) == null ? void 0 : _a2.lines)) return [];
      return data.lyrics.lines.map((line, index) => ({
        id: line.id || `line-${index}`,
        text: line.text,
        startTime: line.startTime,
        duration: line.duration
      }));
    };
    const getViewProps = () => {
      const data = karaokeData();
      const track = currentTrack();
      if (isLoading()) {
        return {
          score: 0,
          rank: 0,
          lyrics: [{
            id: "loading",
            text: "Loading lyrics...",
            startTime: 0,
            duration: 3
          }],
          leaderboard: [],
          currentTime: 0,
          isPlaying: false,
          onStart: () => console.log("Loading..."),
          onSpeedChange: () => {
          }
        };
      }
      if (error() || !((data == null ? void 0 : data.hasKaraoke) || (data == null ? void 0 : data.has_karaoke))) {
        const errorMessage = error() || "No karaoke available for this track";
        const isApiConnected = errorMessage.includes("Cannot read properties") || errorMessage.includes("prepare");
        return {
          score: 0,
          rank: 0,
          lyrics: [{
            id: "error",
            text: isApiConnected ? `✅ API Connected! Server needs database setup. Track: ${track == null ? void 0 : track.title}` : errorMessage,
            startTime: 0,
            duration: 8
          }],
          leaderboard: [],
          currentTime: 0,
          isPlaying: false,
          onStart: () => console.log("API connection test successful"),
          onSpeedChange: () => {
          }
        };
      }
      return {
        score: 8750,
        // TODO: Get real user score
        rank: 4,
        // TODO: Get real user rank
        lyrics: getLyrics(),
        leaderboard: mockLeaderboard,
        currentTime: 0,
        // TODO: Sync with video/audio playback
        isPlaying: false,
        // Always show start button for now
        onStart: () => {
          console.log("Start karaoke for:", track == null ? void 0 : track.title);
        },
        onSpeedChange: (speed) => {
          console.log("Speed changed to:", speed);
        }
      };
    };
    return (() => {
      var _el$ = _tmpl$();
      insert(_el$, createComponent(ExtensionKaraokeView, mergeProps(getViewProps)));
      return _el$;
    })();
  };
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
          wrapper.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          bottom: 20px;
          width: 500px;
          z-index: 99999;
          overflow: hidden;
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
        `;
          wrapper.className = "karaoke-widget";
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
  return result;
}();
content;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL2Rpc3QvZGV2LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL3dlYi9kaXN0L2Rldi5qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWUvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnQvbGliL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbnkta2V5cy1tYXAvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvZGVmdS9kaXN0L2RlZnUubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0AxbmF0c3Uvd2FpdC1lbGVtZW50L2Rpc3QvZGV0ZWN0b3JzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AMW5hdHN1L3dhaXQtZWxlbWVudC9kaXN0L2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYXJlZC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9jbHN4L2Rpc3QvY2xzeC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvY24udHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9sYXlvdXQvSGVhZGVyL0hlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9kaXNwbGF5L1Njb3JlUGFuZWwvU2NvcmVQYW5lbC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9vbmJvYXJkaW5nL09uYm9hcmRpbmdGbG93L09uYm9hcmRpbmdGbG93LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheS9MeXJpY3NEaXNwbGF5LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvS2FyYW9rZUhlYWRlci9LYXJhb2tlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbC9MZWFkZXJib2FyZFBhbmVsLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9TcGxpdEJ1dHRvbi9TcGxpdEJ1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vVGFicy9UYWJzLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvRXh0ZW5zaW9uS2FyYW9rZVZpZXcvRXh0ZW5zaW9uS2FyYW9rZVZpZXcudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcHJhY3RpY2UvUHJhY3RpY2VIZWFkZXIvUHJhY3RpY2VIZWFkZXIudHN4IiwiLi4vLi4vLi4vc3JjL3NlcnZpY2VzL2thcmFva2UtYXBpLnRzIiwiLi4vLi4vLi4vc3JjL3NlcnZpY2VzL3RyYWNrLWRldGVjdG9yLnRzIiwiLi4vLi4vLi4vc3JjL2FwcHMvY29udGVudC9Db250ZW50QXBwLnRzeCIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQudHN4IiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQubWpzIl0sInNvdXJjZXNDb250ZW50IjpbImxldCB0YXNrSWRDb3VudGVyID0gMSxcbiAgaXNDYWxsYmFja1NjaGVkdWxlZCA9IGZhbHNlLFxuICBpc1BlcmZvcm1pbmdXb3JrID0gZmFsc2UsXG4gIHRhc2tRdWV1ZSA9IFtdLFxuICBjdXJyZW50VGFzayA9IG51bGwsXG4gIHNob3VsZFlpZWxkVG9Ib3N0ID0gbnVsbCxcbiAgeWllbGRJbnRlcnZhbCA9IDUsXG4gIGRlYWRsaW5lID0gMCxcbiAgbWF4WWllbGRJbnRlcnZhbCA9IDMwMCxcbiAgc2NoZWR1bGVDYWxsYmFjayA9IG51bGwsXG4gIHNjaGVkdWxlZENhbGxiYWNrID0gbnVsbDtcbmNvbnN0IG1heFNpZ25lZDMxQml0SW50ID0gMTA3Mzc0MTgyMztcbmZ1bmN0aW9uIHNldHVwU2NoZWR1bGVyKCkge1xuICBjb25zdCBjaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsKCksXG4gICAgcG9ydCA9IGNoYW5uZWwucG9ydDI7XG4gIHNjaGVkdWxlQ2FsbGJhY2sgPSAoKSA9PiBwb3J0LnBvc3RNZXNzYWdlKG51bGwpO1xuICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9ICgpID0+IHtcbiAgICBpZiAoc2NoZWR1bGVkQ2FsbGJhY2sgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBkZWFkbGluZSA9IGN1cnJlbnRUaW1lICsgeWllbGRJbnRlcnZhbDtcbiAgICAgIGNvbnN0IGhhc1RpbWVSZW1haW5pbmcgPSB0cnVlO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgaGFzTW9yZVdvcmsgPSBzY2hlZHVsZWRDYWxsYmFjayhoYXNUaW1lUmVtYWluaW5nLCBjdXJyZW50VGltZSk7XG4gICAgICAgIGlmICghaGFzTW9yZVdvcmspIHtcbiAgICAgICAgICBzY2hlZHVsZWRDYWxsYmFjayA9IG51bGw7XG4gICAgICAgIH0gZWxzZSBwb3J0LnBvc3RNZXNzYWdlKG51bGwpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9XG4gICAgfVxuICB9O1xuICBpZiAobmF2aWdhdG9yICYmIG5hdmlnYXRvci5zY2hlZHVsaW5nICYmIG5hdmlnYXRvci5zY2hlZHVsaW5nLmlzSW5wdXRQZW5kaW5nKSB7XG4gICAgY29uc3Qgc2NoZWR1bGluZyA9IG5hdmlnYXRvci5zY2hlZHVsaW5nO1xuICAgIHNob3VsZFlpZWxkVG9Ib3N0ID0gKCkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGlmIChjdXJyZW50VGltZSA+PSBkZWFkbGluZSkge1xuICAgICAgICBpZiAoc2NoZWR1bGluZy5pc0lucHV0UGVuZGluZygpKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGN1cnJlbnRUaW1lID49IG1heFlpZWxkSW50ZXJ2YWw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBzaG91bGRZaWVsZFRvSG9zdCA9ICgpID0+IHBlcmZvcm1hbmNlLm5vdygpID49IGRlYWRsaW5lO1xuICB9XG59XG5mdW5jdGlvbiBlbnF1ZXVlKHRhc2tRdWV1ZSwgdGFzaykge1xuICBmdW5jdGlvbiBmaW5kSW5kZXgoKSB7XG4gICAgbGV0IG0gPSAwO1xuICAgIGxldCBuID0gdGFza1F1ZXVlLmxlbmd0aCAtIDE7XG4gICAgd2hpbGUgKG0gPD0gbikge1xuICAgICAgY29uc3QgayA9IG4gKyBtID4+IDE7XG4gICAgICBjb25zdCBjbXAgPSB0YXNrLmV4cGlyYXRpb25UaW1lIC0gdGFza1F1ZXVlW2tdLmV4cGlyYXRpb25UaW1lO1xuICAgICAgaWYgKGNtcCA+IDApIG0gPSBrICsgMTtlbHNlIGlmIChjbXAgPCAwKSBuID0gayAtIDE7ZWxzZSByZXR1cm4gaztcbiAgICB9XG4gICAgcmV0dXJuIG07XG4gIH1cbiAgdGFza1F1ZXVlLnNwbGljZShmaW5kSW5kZXgoKSwgMCwgdGFzayk7XG59XG5mdW5jdGlvbiByZXF1ZXN0Q2FsbGJhY2soZm4sIG9wdGlvbnMpIHtcbiAgaWYgKCFzY2hlZHVsZUNhbGxiYWNrKSBzZXR1cFNjaGVkdWxlcigpO1xuICBsZXQgc3RhcnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCksXG4gICAgdGltZW91dCA9IG1heFNpZ25lZDMxQml0SW50O1xuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnRpbWVvdXQpIHRpbWVvdXQgPSBvcHRpb25zLnRpbWVvdXQ7XG4gIGNvbnN0IG5ld1Rhc2sgPSB7XG4gICAgaWQ6IHRhc2tJZENvdW50ZXIrKyxcbiAgICBmbixcbiAgICBzdGFydFRpbWUsXG4gICAgZXhwaXJhdGlvblRpbWU6IHN0YXJ0VGltZSArIHRpbWVvdXRcbiAgfTtcbiAgZW5xdWV1ZSh0YXNrUXVldWUsIG5ld1Rhc2spO1xuICBpZiAoIWlzQ2FsbGJhY2tTY2hlZHVsZWQgJiYgIWlzUGVyZm9ybWluZ1dvcmspIHtcbiAgICBpc0NhbGxiYWNrU2NoZWR1bGVkID0gdHJ1ZTtcbiAgICBzY2hlZHVsZWRDYWxsYmFjayA9IGZsdXNoV29yaztcbiAgICBzY2hlZHVsZUNhbGxiYWNrKCk7XG4gIH1cbiAgcmV0dXJuIG5ld1Rhc2s7XG59XG5mdW5jdGlvbiBjYW5jZWxDYWxsYmFjayh0YXNrKSB7XG4gIHRhc2suZm4gPSBudWxsO1xufVxuZnVuY3Rpb24gZmx1c2hXb3JrKGhhc1RpbWVSZW1haW5pbmcsIGluaXRpYWxUaW1lKSB7XG4gIGlzQ2FsbGJhY2tTY2hlZHVsZWQgPSBmYWxzZTtcbiAgaXNQZXJmb3JtaW5nV29yayA9IHRydWU7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHdvcmtMb29wKGhhc1RpbWVSZW1haW5pbmcsIGluaXRpYWxUaW1lKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBjdXJyZW50VGFzayA9IG51bGw7XG4gICAgaXNQZXJmb3JtaW5nV29yayA9IGZhbHNlO1xuICB9XG59XG5mdW5jdGlvbiB3b3JrTG9vcChoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSkge1xuICBsZXQgY3VycmVudFRpbWUgPSBpbml0aWFsVGltZTtcbiAgY3VycmVudFRhc2sgPSB0YXNrUXVldWVbMF0gfHwgbnVsbDtcbiAgd2hpbGUgKGN1cnJlbnRUYXNrICE9PSBudWxsKSB7XG4gICAgaWYgKGN1cnJlbnRUYXNrLmV4cGlyYXRpb25UaW1lID4gY3VycmVudFRpbWUgJiYgKCFoYXNUaW1lUmVtYWluaW5nIHx8IHNob3VsZFlpZWxkVG9Ib3N0KCkpKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY29uc3QgY2FsbGJhY2sgPSBjdXJyZW50VGFzay5mbjtcbiAgICBpZiAoY2FsbGJhY2sgIT09IG51bGwpIHtcbiAgICAgIGN1cnJlbnRUYXNrLmZuID0gbnVsbDtcbiAgICAgIGNvbnN0IGRpZFVzZXJDYWxsYmFja1RpbWVvdXQgPSBjdXJyZW50VGFzay5leHBpcmF0aW9uVGltZSA8PSBjdXJyZW50VGltZTtcbiAgICAgIGNhbGxiYWNrKGRpZFVzZXJDYWxsYmFja1RpbWVvdXQpO1xuICAgICAgY3VycmVudFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGlmIChjdXJyZW50VGFzayA9PT0gdGFza1F1ZXVlWzBdKSB7XG4gICAgICAgIHRhc2tRdWV1ZS5zaGlmdCgpO1xuICAgICAgfVxuICAgIH0gZWxzZSB0YXNrUXVldWUuc2hpZnQoKTtcbiAgICBjdXJyZW50VGFzayA9IHRhc2tRdWV1ZVswXSB8fCBudWxsO1xuICB9XG4gIHJldHVybiBjdXJyZW50VGFzayAhPT0gbnVsbDtcbn1cblxuY29uc3Qgc2hhcmVkQ29uZmlnID0ge1xuICBjb250ZXh0OiB1bmRlZmluZWQsXG4gIHJlZ2lzdHJ5OiB1bmRlZmluZWQsXG4gIGVmZmVjdHM6IHVuZGVmaW5lZCxcbiAgZG9uZTogZmFsc2UsXG4gIGdldENvbnRleHRJZCgpIHtcbiAgICByZXR1cm4gZ2V0Q29udGV4dElkKHRoaXMuY29udGV4dC5jb3VudCk7XG4gIH0sXG4gIGdldE5leHRDb250ZXh0SWQoKSB7XG4gICAgcmV0dXJuIGdldENvbnRleHRJZCh0aGlzLmNvbnRleHQuY291bnQrKyk7XG4gIH1cbn07XG5mdW5jdGlvbiBnZXRDb250ZXh0SWQoY291bnQpIHtcbiAgY29uc3QgbnVtID0gU3RyaW5nKGNvdW50KSxcbiAgICBsZW4gPSBudW0ubGVuZ3RoIC0gMTtcbiAgcmV0dXJuIHNoYXJlZENvbmZpZy5jb250ZXh0LmlkICsgKGxlbiA/IFN0cmluZy5mcm9tQ2hhckNvZGUoOTYgKyBsZW4pIDogXCJcIikgKyBudW07XG59XG5mdW5jdGlvbiBzZXRIeWRyYXRlQ29udGV4dChjb250ZXh0KSB7XG4gIHNoYXJlZENvbmZpZy5jb250ZXh0ID0gY29udGV4dDtcbn1cbmZ1bmN0aW9uIG5leHRIeWRyYXRlQ29udGV4dCgpIHtcbiAgcmV0dXJuIHtcbiAgICAuLi5zaGFyZWRDb25maWcuY29udGV4dCxcbiAgICBpZDogc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKSxcbiAgICBjb3VudDogMFxuICB9O1xufVxuXG5jb25zdCBJU19ERVYgPSB0cnVlO1xuY29uc3QgZXF1YWxGbiA9IChhLCBiKSA9PiBhID09PSBiO1xuY29uc3QgJFBST1hZID0gU3ltYm9sKFwic29saWQtcHJveHlcIik7XG5jb25zdCBTVVBQT1JUU19QUk9YWSA9IHR5cGVvZiBQcm94eSA9PT0gXCJmdW5jdGlvblwiO1xuY29uc3QgJFRSQUNLID0gU3ltYm9sKFwic29saWQtdHJhY2tcIik7XG5jb25zdCAkREVWQ09NUCA9IFN5bWJvbChcInNvbGlkLWRldi1jb21wb25lbnRcIik7XG5jb25zdCBzaWduYWxPcHRpb25zID0ge1xuICBlcXVhbHM6IGVxdWFsRm5cbn07XG5sZXQgRVJST1IgPSBudWxsO1xubGV0IHJ1bkVmZmVjdHMgPSBydW5RdWV1ZTtcbmNvbnN0IFNUQUxFID0gMTtcbmNvbnN0IFBFTkRJTkcgPSAyO1xuY29uc3QgVU5PV05FRCA9IHtcbiAgb3duZWQ6IG51bGwsXG4gIGNsZWFudXBzOiBudWxsLFxuICBjb250ZXh0OiBudWxsLFxuICBvd25lcjogbnVsbFxufTtcbmNvbnN0IE5PX0lOSVQgPSB7fTtcbnZhciBPd25lciA9IG51bGw7XG5sZXQgVHJhbnNpdGlvbiA9IG51bGw7XG5sZXQgU2NoZWR1bGVyID0gbnVsbDtcbmxldCBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IG51bGw7XG5sZXQgTGlzdGVuZXIgPSBudWxsO1xubGV0IFVwZGF0ZXMgPSBudWxsO1xubGV0IEVmZmVjdHMgPSBudWxsO1xubGV0IEV4ZWNDb3VudCA9IDA7XG5jb25zdCBEZXZIb29rcyA9IHtcbiAgYWZ0ZXJVcGRhdGU6IG51bGwsXG4gIGFmdGVyQ3JlYXRlT3duZXI6IG51bGwsXG4gIGFmdGVyQ3JlYXRlU2lnbmFsOiBudWxsLFxuICBhZnRlclJlZ2lzdGVyR3JhcGg6IG51bGxcbn07XG5mdW5jdGlvbiBjcmVhdGVSb290KGZuLCBkZXRhY2hlZE93bmVyKSB7XG4gIGNvbnN0IGxpc3RlbmVyID0gTGlzdGVuZXIsXG4gICAgb3duZXIgPSBPd25lcixcbiAgICB1bm93bmVkID0gZm4ubGVuZ3RoID09PSAwLFxuICAgIGN1cnJlbnQgPSBkZXRhY2hlZE93bmVyID09PSB1bmRlZmluZWQgPyBvd25lciA6IGRldGFjaGVkT3duZXIsXG4gICAgcm9vdCA9IHVub3duZWQgPyB7XG4gICAgICBvd25lZDogbnVsbCxcbiAgICAgIGNsZWFudXBzOiBudWxsLFxuICAgICAgY29udGV4dDogbnVsbCxcbiAgICAgIG93bmVyOiBudWxsXG4gICAgfSAgOiB7XG4gICAgICBvd25lZDogbnVsbCxcbiAgICAgIGNsZWFudXBzOiBudWxsLFxuICAgICAgY29udGV4dDogY3VycmVudCA/IGN1cnJlbnQuY29udGV4dCA6IG51bGwsXG4gICAgICBvd25lcjogY3VycmVudFxuICAgIH0sXG4gICAgdXBkYXRlRm4gPSB1bm93bmVkID8gKCkgPT4gZm4oKCkgPT4ge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRGlzcG9zZSBtZXRob2QgbXVzdCBiZSBhbiBleHBsaWNpdCBhcmd1bWVudCB0byBjcmVhdGVSb290IGZ1bmN0aW9uXCIpO1xuICAgIH0pICA6ICgpID0+IGZuKCgpID0+IHVudHJhY2soKCkgPT4gY2xlYW5Ob2RlKHJvb3QpKSk7XG4gIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIgJiYgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lcihyb290KTtcbiAgT3duZXIgPSByb290O1xuICBMaXN0ZW5lciA9IG51bGw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJ1blVwZGF0ZXModXBkYXRlRm4sIHRydWUpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gICAgT3duZXIgPSBvd25lcjtcbiAgfVxufVxuZnVuY3Rpb24gY3JlYXRlU2lnbmFsKHZhbHVlLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zID8gT2JqZWN0LmFzc2lnbih7fSwgc2lnbmFsT3B0aW9ucywgb3B0aW9ucykgOiBzaWduYWxPcHRpb25zO1xuICBjb25zdCBzID0ge1xuICAgIHZhbHVlLFxuICAgIG9ic2VydmVyczogbnVsbCxcbiAgICBvYnNlcnZlclNsb3RzOiBudWxsLFxuICAgIGNvbXBhcmF0b3I6IG9wdGlvbnMuZXF1YWxzIHx8IHVuZGVmaW5lZFxuICB9O1xuICB7XG4gICAgaWYgKG9wdGlvbnMubmFtZSkgcy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIGlmIChvcHRpb25zLmludGVybmFsKSB7XG4gICAgICBzLmludGVybmFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVnaXN0ZXJHcmFwaChzKTtcbiAgICAgIGlmIChEZXZIb29rcy5hZnRlckNyZWF0ZVNpZ25hbCkgRGV2SG9va3MuYWZ0ZXJDcmVhdGVTaWduYWwocyk7XG4gICAgfVxuICB9XG4gIGNvbnN0IHNldHRlciA9IHZhbHVlID0+IHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKHMpKSB2YWx1ZSA9IHZhbHVlKHMudFZhbHVlKTtlbHNlIHZhbHVlID0gdmFsdWUocy52YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiB3cml0ZVNpZ25hbChzLCB2YWx1ZSk7XG4gIH07XG4gIHJldHVybiBbcmVhZFNpZ25hbC5iaW5kKHMpLCBzZXR0ZXJdO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29tcHV0ZWQoZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIHRydWUsIFNUQUxFLCBvcHRpb25zICk7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIFVwZGF0ZXMucHVzaChjKTtlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlUmVuZGVyRWZmZWN0KGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCBmYWxzZSwgU1RBTEUsIG9wdGlvbnMgKTtcbiAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgVXBkYXRlcy5wdXNoKGMpO2Vsc2UgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG59XG5mdW5jdGlvbiBjcmVhdGVFZmZlY3QoZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIHJ1bkVmZmVjdHMgPSBydW5Vc2VyRWZmZWN0cztcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgZmFsc2UsIFNUQUxFLCBvcHRpb25zICksXG4gICAgcyA9IFN1c3BlbnNlQ29udGV4dCAmJiB1c2VDb250ZXh0KFN1c3BlbnNlQ29udGV4dCk7XG4gIGlmIChzKSBjLnN1c3BlbnNlID0gcztcbiAgaWYgKCFvcHRpb25zIHx8ICFvcHRpb25zLnJlbmRlcikgYy51c2VyID0gdHJ1ZTtcbiAgRWZmZWN0cyA/IEVmZmVjdHMucHVzaChjKSA6IHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlUmVhY3Rpb24ob25JbnZhbGlkYXRlLCBvcHRpb25zKSB7XG4gIGxldCBmbjtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKCgpID0+IHtcbiAgICAgIGZuID8gZm4oKSA6IHVudHJhY2sob25JbnZhbGlkYXRlKTtcbiAgICAgIGZuID0gdW5kZWZpbmVkO1xuICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UsIDAsIG9wdGlvbnMgKSxcbiAgICBzID0gU3VzcGVuc2VDb250ZXh0ICYmIHVzZUNvbnRleHQoU3VzcGVuc2VDb250ZXh0KTtcbiAgaWYgKHMpIGMuc3VzcGVuc2UgPSBzO1xuICBjLnVzZXIgPSB0cnVlO1xuICByZXR1cm4gdHJhY2tpbmcgPT4ge1xuICAgIGZuID0gdHJhY2tpbmc7XG4gICAgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIH07XG59XG5mdW5jdGlvbiBjcmVhdGVNZW1vKGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyA/IE9iamVjdC5hc3NpZ24oe30sIHNpZ25hbE9wdGlvbnMsIG9wdGlvbnMpIDogc2lnbmFsT3B0aW9ucztcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgdHJ1ZSwgMCwgb3B0aW9ucyApO1xuICBjLm9ic2VydmVycyA9IG51bGw7XG4gIGMub2JzZXJ2ZXJTbG90cyA9IG51bGw7XG4gIGMuY29tcGFyYXRvciA9IG9wdGlvbnMuZXF1YWxzIHx8IHVuZGVmaW5lZDtcbiAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGMudFN0YXRlID0gU1RBTEU7XG4gICAgVXBkYXRlcy5wdXNoKGMpO1xuICB9IGVsc2UgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIHJldHVybiByZWFkU2lnbmFsLmJpbmQoYyk7XG59XG5mdW5jdGlvbiBpc1Byb21pc2Uodikge1xuICByZXR1cm4gdiAmJiB0eXBlb2YgdiA9PT0gXCJvYmplY3RcIiAmJiBcInRoZW5cIiBpbiB2O1xufVxuZnVuY3Rpb24gY3JlYXRlUmVzb3VyY2UocFNvdXJjZSwgcEZldGNoZXIsIHBPcHRpb25zKSB7XG4gIGxldCBzb3VyY2U7XG4gIGxldCBmZXRjaGVyO1xuICBsZXQgb3B0aW9ucztcbiAgaWYgKHR5cGVvZiBwRmV0Y2hlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgc291cmNlID0gcFNvdXJjZTtcbiAgICBmZXRjaGVyID0gcEZldGNoZXI7XG4gICAgb3B0aW9ucyA9IHBPcHRpb25zIHx8IHt9O1xuICB9IGVsc2Uge1xuICAgIHNvdXJjZSA9IHRydWU7XG4gICAgZmV0Y2hlciA9IHBTb3VyY2U7XG4gICAgb3B0aW9ucyA9IHBGZXRjaGVyIHx8IHt9O1xuICB9XG4gIGxldCBwciA9IG51bGwsXG4gICAgaW5pdFAgPSBOT19JTklULFxuICAgIGlkID0gbnVsbCxcbiAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBmYWxzZSxcbiAgICBzY2hlZHVsZWQgPSBmYWxzZSxcbiAgICByZXNvbHZlZCA9IFwiaW5pdGlhbFZhbHVlXCIgaW4gb3B0aW9ucyxcbiAgICBkeW5hbWljID0gdHlwZW9mIHNvdXJjZSA9PT0gXCJmdW5jdGlvblwiICYmIGNyZWF0ZU1lbW8oc291cmNlKTtcbiAgY29uc3QgY29udGV4dHMgPSBuZXcgU2V0KCksXG4gICAgW3ZhbHVlLCBzZXRWYWx1ZV0gPSAob3B0aW9ucy5zdG9yYWdlIHx8IGNyZWF0ZVNpZ25hbCkob3B0aW9ucy5pbml0aWFsVmFsdWUpLFxuICAgIFtlcnJvciwgc2V0RXJyb3JdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCksXG4gICAgW3RyYWNrLCB0cmlnZ2VyXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQsIHtcbiAgICAgIGVxdWFsczogZmFsc2VcbiAgICB9KSxcbiAgICBbc3RhdGUsIHNldFN0YXRlXSA9IGNyZWF0ZVNpZ25hbChyZXNvbHZlZCA/IFwicmVhZHlcIiA6IFwidW5yZXNvbHZlZFwiKTtcbiAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0KSB7XG4gICAgaWQgPSBzaGFyZWRDb25maWcuZ2V0TmV4dENvbnRleHRJZCgpO1xuICAgIGlmIChvcHRpb25zLnNzckxvYWRGcm9tID09PSBcImluaXRpYWxcIikgaW5pdFAgPSBvcHRpb25zLmluaXRpYWxWYWx1ZTtlbHNlIGlmIChzaGFyZWRDb25maWcubG9hZCAmJiBzaGFyZWRDb25maWcuaGFzKGlkKSkgaW5pdFAgPSBzaGFyZWRDb25maWcubG9hZChpZCk7XG4gIH1cbiAgZnVuY3Rpb24gbG9hZEVuZChwLCB2LCBlcnJvciwga2V5KSB7XG4gICAgaWYgKHByID09PSBwKSB7XG4gICAgICBwciA9IG51bGw7XG4gICAgICBrZXkgIT09IHVuZGVmaW5lZCAmJiAocmVzb2x2ZWQgPSB0cnVlKTtcbiAgICAgIGlmICgocCA9PT0gaW5pdFAgfHwgdiA9PT0gaW5pdFApICYmIG9wdGlvbnMub25IeWRyYXRlZCkgcXVldWVNaWNyb3Rhc2soKCkgPT4gb3B0aW9ucy5vbkh5ZHJhdGVkKGtleSwge1xuICAgICAgICB2YWx1ZTogdlxuICAgICAgfSkpO1xuICAgICAgaW5pdFAgPSBOT19JTklUO1xuICAgICAgaWYgKFRyYW5zaXRpb24gJiYgcCAmJiBsb2FkZWRVbmRlclRyYW5zaXRpb24pIHtcbiAgICAgICAgVHJhbnNpdGlvbi5wcm9taXNlcy5kZWxldGUocCk7XG4gICAgICAgIGxvYWRlZFVuZGVyVHJhbnNpdGlvbiA9IGZhbHNlO1xuICAgICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgIGNvbXBsZXRlTG9hZCh2LCBlcnJvcik7XG4gICAgICAgIH0sIGZhbHNlKTtcbiAgICAgIH0gZWxzZSBjb21wbGV0ZUxvYWQodiwgZXJyb3IpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuICBmdW5jdGlvbiBjb21wbGV0ZUxvYWQodiwgZXJyKSB7XG4gICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICBpZiAoZXJyID09PSB1bmRlZmluZWQpIHNldFZhbHVlKCgpID0+IHYpO1xuICAgICAgc2V0U3RhdGUoZXJyICE9PSB1bmRlZmluZWQgPyBcImVycm9yZWRcIiA6IHJlc29sdmVkID8gXCJyZWFkeVwiIDogXCJ1bnJlc29sdmVkXCIpO1xuICAgICAgc2V0RXJyb3IoZXJyKTtcbiAgICAgIGZvciAoY29uc3QgYyBvZiBjb250ZXh0cy5rZXlzKCkpIGMuZGVjcmVtZW50KCk7XG4gICAgICBjb250ZXh0cy5jbGVhcigpO1xuICAgIH0sIGZhbHNlKTtcbiAgfVxuICBmdW5jdGlvbiByZWFkKCkge1xuICAgIGNvbnN0IGMgPSBTdXNwZW5zZUNvbnRleHQgJiYgdXNlQ29udGV4dChTdXNwZW5zZUNvbnRleHQpLFxuICAgICAgdiA9IHZhbHVlKCksXG4gICAgICBlcnIgPSBlcnJvcigpO1xuICAgIGlmIChlcnIgIT09IHVuZGVmaW5lZCAmJiAhcHIpIHRocm93IGVycjtcbiAgICBpZiAoTGlzdGVuZXIgJiYgIUxpc3RlbmVyLnVzZXIgJiYgYykge1xuICAgICAgY3JlYXRlQ29tcHV0ZWQoKCkgPT4ge1xuICAgICAgICB0cmFjaygpO1xuICAgICAgICBpZiAocHIpIHtcbiAgICAgICAgICBpZiAoYy5yZXNvbHZlZCAmJiBUcmFuc2l0aW9uICYmIGxvYWRlZFVuZGVyVHJhbnNpdGlvbikgVHJhbnNpdGlvbi5wcm9taXNlcy5hZGQocHIpO2Vsc2UgaWYgKCFjb250ZXh0cy5oYXMoYykpIHtcbiAgICAgICAgICAgIGMuaW5jcmVtZW50KCk7XG4gICAgICAgICAgICBjb250ZXh0cy5hZGQoYyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cbiAgZnVuY3Rpb24gbG9hZChyZWZldGNoaW5nID0gdHJ1ZSkge1xuICAgIGlmIChyZWZldGNoaW5nICE9PSBmYWxzZSAmJiBzY2hlZHVsZWQpIHJldHVybjtcbiAgICBzY2hlZHVsZWQgPSBmYWxzZTtcbiAgICBjb25zdCBsb29rdXAgPSBkeW5hbWljID8gZHluYW1pYygpIDogc291cmNlO1xuICAgIGxvYWRlZFVuZGVyVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgIGlmIChsb29rdXAgPT0gbnVsbCB8fCBsb29rdXAgPT09IGZhbHNlKSB7XG4gICAgICBsb2FkRW5kKHByLCB1bnRyYWNrKHZhbHVlKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChUcmFuc2l0aW9uICYmIHByKSBUcmFuc2l0aW9uLnByb21pc2VzLmRlbGV0ZShwcik7XG4gICAgbGV0IGVycm9yO1xuICAgIGNvbnN0IHAgPSBpbml0UCAhPT0gTk9fSU5JVCA/IGluaXRQIDogdW50cmFjaygoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gZmV0Y2hlcihsb29rdXAsIHtcbiAgICAgICAgICB2YWx1ZTogdmFsdWUoKSxcbiAgICAgICAgICByZWZldGNoaW5nXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZmV0Y2hlckVycm9yKSB7XG4gICAgICAgIGVycm9yID0gZmV0Y2hlckVycm9yO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChlcnJvciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsb2FkRW5kKHByLCB1bmRlZmluZWQsIGNhc3RFcnJvcihlcnJvciksIGxvb2t1cCk7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmICghaXNQcm9taXNlKHApKSB7XG4gICAgICBsb2FkRW5kKHByLCBwLCB1bmRlZmluZWQsIGxvb2t1cCk7XG4gICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgcHIgPSBwO1xuICAgIGlmIChcInZcIiBpbiBwKSB7XG4gICAgICBpZiAocC5zID09PSAxKSBsb2FkRW5kKHByLCBwLnYsIHVuZGVmaW5lZCwgbG9va3VwKTtlbHNlIGxvYWRFbmQocHIsIHVuZGVmaW5lZCwgY2FzdEVycm9yKHAudiksIGxvb2t1cCk7XG4gICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgc2NoZWR1bGVkID0gdHJ1ZTtcbiAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiBzY2hlZHVsZWQgPSBmYWxzZSk7XG4gICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICBzZXRTdGF0ZShyZXNvbHZlZCA/IFwicmVmcmVzaGluZ1wiIDogXCJwZW5kaW5nXCIpO1xuICAgICAgdHJpZ2dlcigpO1xuICAgIH0sIGZhbHNlKTtcbiAgICByZXR1cm4gcC50aGVuKHYgPT4gbG9hZEVuZChwLCB2LCB1bmRlZmluZWQsIGxvb2t1cCksIGUgPT4gbG9hZEVuZChwLCB1bmRlZmluZWQsIGNhc3RFcnJvcihlKSwgbG9va3VwKSk7XG4gIH1cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMocmVhZCwge1xuICAgIHN0YXRlOiB7XG4gICAgICBnZXQ6ICgpID0+IHN0YXRlKClcbiAgICB9LFxuICAgIGVycm9yOiB7XG4gICAgICBnZXQ6ICgpID0+IGVycm9yKClcbiAgICB9LFxuICAgIGxvYWRpbmc6IHtcbiAgICAgIGdldCgpIHtcbiAgICAgICAgY29uc3QgcyA9IHN0YXRlKCk7XG4gICAgICAgIHJldHVybiBzID09PSBcInBlbmRpbmdcIiB8fCBzID09PSBcInJlZnJlc2hpbmdcIjtcbiAgICAgIH1cbiAgICB9LFxuICAgIGxhdGVzdDoge1xuICAgICAgZ2V0KCkge1xuICAgICAgICBpZiAoIXJlc29sdmVkKSByZXR1cm4gcmVhZCgpO1xuICAgICAgICBjb25zdCBlcnIgPSBlcnJvcigpO1xuICAgICAgICBpZiAoZXJyICYmICFwcikgdGhyb3cgZXJyO1xuICAgICAgICByZXR1cm4gdmFsdWUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuICBsZXQgb3duZXIgPSBPd25lcjtcbiAgaWYgKGR5bmFtaWMpIGNyZWF0ZUNvbXB1dGVkKCgpID0+IChvd25lciA9IE93bmVyLCBsb2FkKGZhbHNlKSkpO2Vsc2UgbG9hZChmYWxzZSk7XG4gIHJldHVybiBbcmVhZCwge1xuICAgIHJlZmV0Y2g6IGluZm8gPT4gcnVuV2l0aE93bmVyKG93bmVyLCAoKSA9PiBsb2FkKGluZm8pKSxcbiAgICBtdXRhdGU6IHNldFZhbHVlXG4gIH1dO1xufVxuZnVuY3Rpb24gY3JlYXRlRGVmZXJyZWQoc291cmNlLCBvcHRpb25zKSB7XG4gIGxldCB0LFxuICAgIHRpbWVvdXQgPSBvcHRpb25zID8gb3B0aW9ucy50aW1lb3V0TXMgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IG5vZGUgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB7XG4gICAgaWYgKCF0IHx8ICF0LmZuKSB0ID0gcmVxdWVzdENhbGxiYWNrKCgpID0+IHNldERlZmVycmVkKCgpID0+IG5vZGUudmFsdWUpLCB0aW1lb3V0ICE9PSB1bmRlZmluZWQgPyB7XG4gICAgICB0aW1lb3V0XG4gICAgfSA6IHVuZGVmaW5lZCk7XG4gICAgcmV0dXJuIHNvdXJjZSgpO1xuICB9LCB1bmRlZmluZWQsIHRydWUpO1xuICBjb25zdCBbZGVmZXJyZWQsIHNldERlZmVycmVkXSA9IGNyZWF0ZVNpZ25hbChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlLCBvcHRpb25zKTtcbiAgdXBkYXRlQ29tcHV0YXRpb24obm9kZSk7XG4gIHNldERlZmVycmVkKCgpID0+IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUpO1xuICByZXR1cm4gZGVmZXJyZWQ7XG59XG5mdW5jdGlvbiBjcmVhdGVTZWxlY3Rvcihzb3VyY2UsIGZuID0gZXF1YWxGbiwgb3B0aW9ucykge1xuICBjb25zdCBzdWJzID0gbmV3IE1hcCgpO1xuICBjb25zdCBub2RlID0gY3JlYXRlQ29tcHV0YXRpb24ocCA9PiB7XG4gICAgY29uc3QgdiA9IHNvdXJjZSgpO1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsXSBvZiBzdWJzLmVudHJpZXMoKSkgaWYgKGZuKGtleSwgdikgIT09IGZuKGtleSwgcCkpIHtcbiAgICAgIGZvciAoY29uc3QgYyBvZiB2YWwudmFsdWVzKCkpIHtcbiAgICAgICAgYy5zdGF0ZSA9IFNUQUxFO1xuICAgICAgICBpZiAoYy5wdXJlKSBVcGRhdGVzLnB1c2goYyk7ZWxzZSBFZmZlY3RzLnB1c2goYyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9LCB1bmRlZmluZWQsIHRydWUsIFNUQUxFLCBvcHRpb25zICk7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICByZXR1cm4ga2V5ID0+IHtcbiAgICBjb25zdCBsaXN0ZW5lciA9IExpc3RlbmVyO1xuICAgIGlmIChsaXN0ZW5lcikge1xuICAgICAgbGV0IGw7XG4gICAgICBpZiAobCA9IHN1YnMuZ2V0KGtleSkpIGwuYWRkKGxpc3RlbmVyKTtlbHNlIHN1YnMuc2V0KGtleSwgbCA9IG5ldyBTZXQoW2xpc3RlbmVyXSkpO1xuICAgICAgb25DbGVhbnVwKCgpID0+IHtcbiAgICAgICAgbC5kZWxldGUobGlzdGVuZXIpO1xuICAgICAgICAhbC5zaXplICYmIHN1YnMuZGVsZXRlKGtleSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGZuKGtleSwgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSk7XG4gIH07XG59XG5mdW5jdGlvbiBiYXRjaChmbikge1xuICByZXR1cm4gcnVuVXBkYXRlcyhmbiwgZmFsc2UpO1xufVxuZnVuY3Rpb24gdW50cmFjayhmbikge1xuICBpZiAoIUV4dGVybmFsU291cmNlQ29uZmlnICYmIExpc3RlbmVyID09PSBudWxsKSByZXR1cm4gZm4oKTtcbiAgY29uc3QgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgTGlzdGVuZXIgPSBudWxsO1xuICB0cnkge1xuICAgIGlmIChFeHRlcm5hbFNvdXJjZUNvbmZpZykgcmV0dXJuIEV4dGVybmFsU291cmNlQ29uZmlnLnVudHJhY2soZm4pO1xuICAgIHJldHVybiBmbigpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIG9uKGRlcHMsIGZuLCBvcHRpb25zKSB7XG4gIGNvbnN0IGlzQXJyYXkgPSBBcnJheS5pc0FycmF5KGRlcHMpO1xuICBsZXQgcHJldklucHV0O1xuICBsZXQgZGVmZXIgPSBvcHRpb25zICYmIG9wdGlvbnMuZGVmZXI7XG4gIHJldHVybiBwcmV2VmFsdWUgPT4ge1xuICAgIGxldCBpbnB1dDtcbiAgICBpZiAoaXNBcnJheSkge1xuICAgICAgaW5wdXQgPSBBcnJheShkZXBzLmxlbmd0aCk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRlcHMubGVuZ3RoOyBpKyspIGlucHV0W2ldID0gZGVwc1tpXSgpO1xuICAgIH0gZWxzZSBpbnB1dCA9IGRlcHMoKTtcbiAgICBpZiAoZGVmZXIpIHtcbiAgICAgIGRlZmVyID0gZmFsc2U7XG4gICAgICByZXR1cm4gcHJldlZhbHVlO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSB1bnRyYWNrKCgpID0+IGZuKGlucHV0LCBwcmV2SW5wdXQsIHByZXZWYWx1ZSkpO1xuICAgIHByZXZJbnB1dCA9IGlucHV0O1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG59XG5mdW5jdGlvbiBvbk1vdW50KGZuKSB7XG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB1bnRyYWNrKGZuKSk7XG59XG5mdW5jdGlvbiBvbkNsZWFudXAoZm4pIHtcbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJjbGVhbnVwcyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBydW5cIik7ZWxzZSBpZiAoT3duZXIuY2xlYW51cHMgPT09IG51bGwpIE93bmVyLmNsZWFudXBzID0gW2ZuXTtlbHNlIE93bmVyLmNsZWFudXBzLnB1c2goZm4pO1xuICByZXR1cm4gZm47XG59XG5mdW5jdGlvbiBjYXRjaEVycm9yKGZuLCBoYW5kbGVyKSB7XG4gIEVSUk9SIHx8IChFUlJPUiA9IFN5bWJvbChcImVycm9yXCIpKTtcbiAgT3duZXIgPSBjcmVhdGVDb21wdXRhdGlvbih1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIE93bmVyLmNvbnRleHQgPSB7XG4gICAgLi4uT3duZXIuY29udGV4dCxcbiAgICBbRVJST1JdOiBbaGFuZGxlcl1cbiAgfTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKE93bmVyKTtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZm4oKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaGFuZGxlRXJyb3IoZXJyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBPd25lciA9IE93bmVyLm93bmVyO1xuICB9XG59XG5mdW5jdGlvbiBnZXRMaXN0ZW5lcigpIHtcbiAgcmV0dXJuIExpc3RlbmVyO1xufVxuZnVuY3Rpb24gZ2V0T3duZXIoKSB7XG4gIHJldHVybiBPd25lcjtcbn1cbmZ1bmN0aW9uIHJ1bldpdGhPd25lcihvLCBmbikge1xuICBjb25zdCBwcmV2ID0gT3duZXI7XG4gIGNvbnN0IHByZXZMaXN0ZW5lciA9IExpc3RlbmVyO1xuICBPd25lciA9IG87XG4gIExpc3RlbmVyID0gbnVsbDtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcnVuVXBkYXRlcyhmbiwgdHJ1ZSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGhhbmRsZUVycm9yKGVycik7XG4gIH0gZmluYWxseSB7XG4gICAgT3duZXIgPSBwcmV2O1xuICAgIExpc3RlbmVyID0gcHJldkxpc3RlbmVyO1xuICB9XG59XG5mdW5jdGlvbiBlbmFibGVTY2hlZHVsaW5nKHNjaGVkdWxlciA9IHJlcXVlc3RDYWxsYmFjaykge1xuICBTY2hlZHVsZXIgPSBzY2hlZHVsZXI7XG59XG5mdW5jdGlvbiBzdGFydFRyYW5zaXRpb24oZm4pIHtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgZm4oKTtcbiAgICByZXR1cm4gVHJhbnNpdGlvbi5kb25lO1xuICB9XG4gIGNvbnN0IGwgPSBMaXN0ZW5lcjtcbiAgY29uc3QgbyA9IE93bmVyO1xuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbigoKSA9PiB7XG4gICAgTGlzdGVuZXIgPSBsO1xuICAgIE93bmVyID0gbztcbiAgICBsZXQgdDtcbiAgICBpZiAoU2NoZWR1bGVyIHx8IFN1c3BlbnNlQ29udGV4dCkge1xuICAgICAgdCA9IFRyYW5zaXRpb24gfHwgKFRyYW5zaXRpb24gPSB7XG4gICAgICAgIHNvdXJjZXM6IG5ldyBTZXQoKSxcbiAgICAgICAgZWZmZWN0czogW10sXG4gICAgICAgIHByb21pc2VzOiBuZXcgU2V0KCksXG4gICAgICAgIGRpc3Bvc2VkOiBuZXcgU2V0KCksXG4gICAgICAgIHF1ZXVlOiBuZXcgU2V0KCksXG4gICAgICAgIHJ1bm5pbmc6IHRydWVcbiAgICAgIH0pO1xuICAgICAgdC5kb25lIHx8ICh0LmRvbmUgPSBuZXcgUHJvbWlzZShyZXMgPT4gdC5yZXNvbHZlID0gcmVzKSk7XG4gICAgICB0LnJ1bm5pbmcgPSB0cnVlO1xuICAgIH1cbiAgICBydW5VcGRhdGVzKGZuLCBmYWxzZSk7XG4gICAgTGlzdGVuZXIgPSBPd25lciA9IG51bGw7XG4gICAgcmV0dXJuIHQgPyB0LmRvbmUgOiB1bmRlZmluZWQ7XG4gIH0pO1xufVxuY29uc3QgW3RyYW5zUGVuZGluZywgc2V0VHJhbnNQZW5kaW5nXSA9IC8qQF9fUFVSRV9fKi9jcmVhdGVTaWduYWwoZmFsc2UpO1xuZnVuY3Rpb24gdXNlVHJhbnNpdGlvbigpIHtcbiAgcmV0dXJuIFt0cmFuc1BlbmRpbmcsIHN0YXJ0VHJhbnNpdGlvbl07XG59XG5mdW5jdGlvbiByZXN1bWVFZmZlY3RzKGUpIHtcbiAgRWZmZWN0cy5wdXNoLmFwcGx5KEVmZmVjdHMsIGUpO1xuICBlLmxlbmd0aCA9IDA7XG59XG5mdW5jdGlvbiBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMpIHtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKCgpID0+IHVudHJhY2soKCkgPT4ge1xuICAgIE9iamVjdC5hc3NpZ24oQ29tcCwge1xuICAgICAgWyRERVZDT01QXTogdHJ1ZVxuICAgIH0pO1xuICAgIHJldHVybiBDb21wKHByb3BzKTtcbiAgfSksIHVuZGVmaW5lZCwgdHJ1ZSwgMCk7XG4gIGMucHJvcHMgPSBwcm9wcztcbiAgYy5vYnNlcnZlcnMgPSBudWxsO1xuICBjLm9ic2VydmVyU2xvdHMgPSBudWxsO1xuICBjLm5hbWUgPSBDb21wLm5hbWU7XG4gIGMuY29tcG9uZW50ID0gQ29tcDtcbiAgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG4gIHJldHVybiBjLnRWYWx1ZSAhPT0gdW5kZWZpbmVkID8gYy50VmFsdWUgOiBjLnZhbHVlO1xufVxuZnVuY3Rpb24gcmVnaXN0ZXJHcmFwaCh2YWx1ZSkge1xuICBpZiAoT3duZXIpIHtcbiAgICBpZiAoT3duZXIuc291cmNlTWFwKSBPd25lci5zb3VyY2VNYXAucHVzaCh2YWx1ZSk7ZWxzZSBPd25lci5zb3VyY2VNYXAgPSBbdmFsdWVdO1xuICAgIHZhbHVlLmdyYXBoID0gT3duZXI7XG4gIH1cbiAgaWYgKERldkhvb2tzLmFmdGVyUmVnaXN0ZXJHcmFwaCkgRGV2SG9va3MuYWZ0ZXJSZWdpc3RlckdyYXBoKHZhbHVlKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbnRleHQoZGVmYXVsdFZhbHVlLCBvcHRpb25zKSB7XG4gIGNvbnN0IGlkID0gU3ltYm9sKFwiY29udGV4dFwiKTtcbiAgcmV0dXJuIHtcbiAgICBpZCxcbiAgICBQcm92aWRlcjogY3JlYXRlUHJvdmlkZXIoaWQsIG9wdGlvbnMpLFxuICAgIGRlZmF1bHRWYWx1ZVxuICB9O1xufVxuZnVuY3Rpb24gdXNlQ29udGV4dChjb250ZXh0KSB7XG4gIGxldCB2YWx1ZTtcbiAgcmV0dXJuIE93bmVyICYmIE93bmVyLmNvbnRleHQgJiYgKHZhbHVlID0gT3duZXIuY29udGV4dFtjb250ZXh0LmlkXSkgIT09IHVuZGVmaW5lZCA/IHZhbHVlIDogY29udGV4dC5kZWZhdWx0VmFsdWU7XG59XG5mdW5jdGlvbiBjaGlsZHJlbihmbikge1xuICBjb25zdCBjaGlsZHJlbiA9IGNyZWF0ZU1lbW8oZm4pO1xuICBjb25zdCBtZW1vID0gY3JlYXRlTWVtbygoKSA9PiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4oKSksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwiY2hpbGRyZW5cIlxuICB9KSA7XG4gIG1lbW8udG9BcnJheSA9ICgpID0+IHtcbiAgICBjb25zdCBjID0gbWVtbygpO1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KGMpID8gYyA6IGMgIT0gbnVsbCA/IFtjXSA6IFtdO1xuICB9O1xuICByZXR1cm4gbWVtbztcbn1cbmxldCBTdXNwZW5zZUNvbnRleHQ7XG5mdW5jdGlvbiBnZXRTdXNwZW5zZUNvbnRleHQoKSB7XG4gIHJldHVybiBTdXNwZW5zZUNvbnRleHQgfHwgKFN1c3BlbnNlQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQoKSk7XG59XG5mdW5jdGlvbiBlbmFibGVFeHRlcm5hbFNvdXJjZShmYWN0b3J5LCB1bnRyYWNrID0gZm4gPT4gZm4oKSkge1xuICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcpIHtcbiAgICBjb25zdCB7XG4gICAgICBmYWN0b3J5OiBvbGRGYWN0b3J5LFxuICAgICAgdW50cmFjazogb2xkVW50cmFja1xuICAgIH0gPSBFeHRlcm5hbFNvdXJjZUNvbmZpZztcbiAgICBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IHtcbiAgICAgIGZhY3Rvcnk6IChmbiwgdHJpZ2dlcikgPT4ge1xuICAgICAgICBjb25zdCBvbGRTb3VyY2UgPSBvbGRGYWN0b3J5KGZuLCB0cmlnZ2VyKTtcbiAgICAgICAgY29uc3Qgc291cmNlID0gZmFjdG9yeSh4ID0+IG9sZFNvdXJjZS50cmFjayh4KSwgdHJpZ2dlcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHJhY2s6IHggPT4gc291cmNlLnRyYWNrKHgpLFxuICAgICAgICAgIGRpc3Bvc2UoKSB7XG4gICAgICAgICAgICBzb3VyY2UuZGlzcG9zZSgpO1xuICAgICAgICAgICAgb2xkU291cmNlLmRpc3Bvc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgdW50cmFjazogZm4gPT4gb2xkVW50cmFjaygoKSA9PiB1bnRyYWNrKGZuKSlcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIEV4dGVybmFsU291cmNlQ29uZmlnID0ge1xuICAgICAgZmFjdG9yeSxcbiAgICAgIHVudHJhY2tcbiAgICB9O1xuICB9XG59XG5mdW5jdGlvbiByZWFkU2lnbmFsKCkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAodGhpcy5zb3VyY2VzICYmIChydW5uaW5nVHJhbnNpdGlvbiA/IHRoaXMudFN0YXRlIDogdGhpcy5zdGF0ZSkpIHtcbiAgICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gdGhpcy50U3RhdGUgOiB0aGlzLnN0YXRlKSA9PT0gU1RBTEUpIHVwZGF0ZUNvbXB1dGF0aW9uKHRoaXMpO2Vsc2Uge1xuICAgICAgY29uc3QgdXBkYXRlcyA9IFVwZGF0ZXM7XG4gICAgICBVcGRhdGVzID0gbnVsbDtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4gbG9va1Vwc3RyZWFtKHRoaXMpLCBmYWxzZSk7XG4gICAgICBVcGRhdGVzID0gdXBkYXRlcztcbiAgICB9XG4gIH1cbiAgaWYgKExpc3RlbmVyKSB7XG4gICAgY29uc3Qgc1Nsb3QgPSB0aGlzLm9ic2VydmVycyA/IHRoaXMub2JzZXJ2ZXJzLmxlbmd0aCA6IDA7XG4gICAgaWYgKCFMaXN0ZW5lci5zb3VyY2VzKSB7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VzID0gW3RoaXNdO1xuICAgICAgTGlzdGVuZXIuc291cmNlU2xvdHMgPSBbc1Nsb3RdO1xuICAgIH0gZWxzZSB7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VzLnB1c2godGhpcyk7XG4gICAgICBMaXN0ZW5lci5zb3VyY2VTbG90cy5wdXNoKHNTbG90KTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLm9ic2VydmVycykge1xuICAgICAgdGhpcy5vYnNlcnZlcnMgPSBbTGlzdGVuZXJdO1xuICAgICAgdGhpcy5vYnNlcnZlclNsb3RzID0gW0xpc3RlbmVyLnNvdXJjZXMubGVuZ3RoIC0gMV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub2JzZXJ2ZXJzLnB1c2goTGlzdGVuZXIpO1xuICAgICAgdGhpcy5vYnNlcnZlclNsb3RzLnB1c2goTGlzdGVuZXIuc291cmNlcy5sZW5ndGggLSAxKTtcbiAgICB9XG4gIH1cbiAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXModGhpcykpIHJldHVybiB0aGlzLnRWYWx1ZTtcbiAgcmV0dXJuIHRoaXMudmFsdWU7XG59XG5mdW5jdGlvbiB3cml0ZVNpZ25hbChub2RlLCB2YWx1ZSwgaXNDb21wKSB7XG4gIGxldCBjdXJyZW50ID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZTtcbiAgaWYgKCFub2RlLmNvbXBhcmF0b3IgfHwgIW5vZGUuY29tcGFyYXRvcihjdXJyZW50LCB2YWx1ZSkpIHtcbiAgICBpZiAoVHJhbnNpdGlvbikge1xuICAgICAgY29uc3QgVHJhbnNpdGlvblJ1bm5pbmcgPSBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gICAgICBpZiAoVHJhbnNpdGlvblJ1bm5pbmcgfHwgIWlzQ29tcCAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpKSB7XG4gICAgICAgIFRyYW5zaXRpb24uc291cmNlcy5hZGQobm9kZSk7XG4gICAgICAgIG5vZGUudFZhbHVlID0gdmFsdWU7XG4gICAgICB9XG4gICAgICBpZiAoIVRyYW5zaXRpb25SdW5uaW5nKSBub2RlLnZhbHVlID0gdmFsdWU7XG4gICAgfSBlbHNlIG5vZGUudmFsdWUgPSB2YWx1ZTtcbiAgICBpZiAobm9kZS5vYnNlcnZlcnMgJiYgbm9kZS5vYnNlcnZlcnMubGVuZ3RoKSB7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLm9ic2VydmVycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgIGNvbnN0IG8gPSBub2RlLm9ic2VydmVyc1tpXTtcbiAgICAgICAgICBjb25zdCBUcmFuc2l0aW9uUnVubmluZyA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgICAgICAgIGlmIChUcmFuc2l0aW9uUnVubmluZyAmJiBUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyhvKSkgY29udGludWU7XG4gICAgICAgICAgaWYgKFRyYW5zaXRpb25SdW5uaW5nID8gIW8udFN0YXRlIDogIW8uc3RhdGUpIHtcbiAgICAgICAgICAgIGlmIChvLnB1cmUpIFVwZGF0ZXMucHVzaChvKTtlbHNlIEVmZmVjdHMucHVzaChvKTtcbiAgICAgICAgICAgIGlmIChvLm9ic2VydmVycykgbWFya0Rvd25zdHJlYW0obyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghVHJhbnNpdGlvblJ1bm5pbmcpIG8uc3RhdGUgPSBTVEFMRTtlbHNlIG8udFN0YXRlID0gU1RBTEU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFVwZGF0ZXMubGVuZ3RoID4gMTBlNSkge1xuICAgICAgICAgIFVwZGF0ZXMgPSBbXTtcbiAgICAgICAgICBpZiAoSVNfREVWKSB0aHJvdyBuZXcgRXJyb3IoXCJQb3RlbnRpYWwgSW5maW5pdGUgTG9vcCBEZXRlY3RlZC5cIik7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gdXBkYXRlQ29tcHV0YXRpb24obm9kZSkge1xuICBpZiAoIW5vZGUuZm4pIHJldHVybjtcbiAgY2xlYW5Ob2RlKG5vZGUpO1xuICBjb25zdCB0aW1lID0gRXhlY0NvdW50O1xuICBydW5Db21wdXRhdGlvbihub2RlLCBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlLCB0aW1lKTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgIVRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpKSB7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIFRyYW5zaXRpb24gJiYgKFRyYW5zaXRpb24ucnVubmluZyA9IHRydWUpO1xuICAgICAgICBMaXN0ZW5lciA9IE93bmVyID0gbm9kZTtcbiAgICAgICAgcnVuQ29tcHV0YXRpb24obm9kZSwgbm9kZS50VmFsdWUsIHRpbWUpO1xuICAgICAgICBMaXN0ZW5lciA9IE93bmVyID0gbnVsbDtcbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9KTtcbiAgfVxufVxuZnVuY3Rpb24gcnVuQ29tcHV0YXRpb24obm9kZSwgdmFsdWUsIHRpbWUpIHtcbiAgbGV0IG5leHRWYWx1ZTtcbiAgY29uc3Qgb3duZXIgPSBPd25lcixcbiAgICBsaXN0ZW5lciA9IExpc3RlbmVyO1xuICBMaXN0ZW5lciA9IE93bmVyID0gbm9kZTtcbiAgdHJ5IHtcbiAgICBuZXh0VmFsdWUgPSBub2RlLmZuKHZhbHVlKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKG5vZGUucHVyZSkge1xuICAgICAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgICAgIG5vZGUudFN0YXRlID0gU1RBTEU7XG4gICAgICAgIG5vZGUudE93bmVkICYmIG5vZGUudE93bmVkLmZvckVhY2goY2xlYW5Ob2RlKTtcbiAgICAgICAgbm9kZS50T3duZWQgPSB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBub2RlLnN0YXRlID0gU1RBTEU7XG4gICAgICAgIG5vZGUub3duZWQgJiYgbm9kZS5vd25lZC5mb3JFYWNoKGNsZWFuTm9kZSk7XG4gICAgICAgIG5vZGUub3duZWQgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBub2RlLnVwZGF0ZWRBdCA9IHRpbWUgKyAxO1xuICAgIHJldHVybiBoYW5kbGVFcnJvcihlcnIpO1xuICB9IGZpbmFsbHkge1xuICAgIExpc3RlbmVyID0gbGlzdGVuZXI7XG4gICAgT3duZXIgPSBvd25lcjtcbiAgfVxuICBpZiAoIW5vZGUudXBkYXRlZEF0IHx8IG5vZGUudXBkYXRlZEF0IDw9IHRpbWUpIHtcbiAgICBpZiAobm9kZS51cGRhdGVkQXQgIT0gbnVsbCAmJiBcIm9ic2VydmVyc1wiIGluIG5vZGUpIHtcbiAgICAgIHdyaXRlU2lnbmFsKG5vZGUsIG5leHRWYWx1ZSwgdHJ1ZSk7XG4gICAgfSBlbHNlIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBub2RlLnB1cmUpIHtcbiAgICAgIFRyYW5zaXRpb24uc291cmNlcy5hZGQobm9kZSk7XG4gICAgICBub2RlLnRWYWx1ZSA9IG5leHRWYWx1ZTtcbiAgICB9IGVsc2Ugbm9kZS52YWx1ZSA9IG5leHRWYWx1ZTtcbiAgICBub2RlLnVwZGF0ZWRBdCA9IHRpbWU7XG4gIH1cbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCBpbml0LCBwdXJlLCBzdGF0ZSA9IFNUQUxFLCBvcHRpb25zKSB7XG4gIGNvbnN0IGMgPSB7XG4gICAgZm4sXG4gICAgc3RhdGU6IHN0YXRlLFxuICAgIHVwZGF0ZWRBdDogbnVsbCxcbiAgICBvd25lZDogbnVsbCxcbiAgICBzb3VyY2VzOiBudWxsLFxuICAgIHNvdXJjZVNsb3RzOiBudWxsLFxuICAgIGNsZWFudXBzOiBudWxsLFxuICAgIHZhbHVlOiBpbml0LFxuICAgIG93bmVyOiBPd25lcixcbiAgICBjb250ZXh0OiBPd25lciA/IE93bmVyLmNvbnRleHQgOiBudWxsLFxuICAgIHB1cmVcbiAgfTtcbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgYy5zdGF0ZSA9IDA7XG4gICAgYy50U3RhdGUgPSBzdGF0ZTtcbiAgfVxuICBpZiAoT3duZXIgPT09IG51bGwpIGNvbnNvbGUud2FybihcImNvbXB1dGF0aW9ucyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBkaXNwb3NlZFwiKTtlbHNlIGlmIChPd25lciAhPT0gVU5PV05FRCkge1xuICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBPd25lci5wdXJlKSB7XG4gICAgICBpZiAoIU93bmVyLnRPd25lZCkgT3duZXIudE93bmVkID0gW2NdO2Vsc2UgT3duZXIudE93bmVkLnB1c2goYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghT3duZXIub3duZWQpIE93bmVyLm93bmVkID0gW2NdO2Vsc2UgT3duZXIub3duZWQucHVzaChjKTtcbiAgICB9XG4gIH1cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5uYW1lKSBjLm5hbWUgPSBvcHRpb25zLm5hbWU7XG4gIGlmIChFeHRlcm5hbFNvdXJjZUNvbmZpZyAmJiBjLmZuKSB7XG4gICAgY29uc3QgW3RyYWNrLCB0cmlnZ2VyXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQsIHtcbiAgICAgIGVxdWFsczogZmFsc2VcbiAgICB9KTtcbiAgICBjb25zdCBvcmRpbmFyeSA9IEV4dGVybmFsU291cmNlQ29uZmlnLmZhY3RvcnkoYy5mbiwgdHJpZ2dlcik7XG4gICAgb25DbGVhbnVwKCgpID0+IG9yZGluYXJ5LmRpc3Bvc2UoKSk7XG4gICAgY29uc3QgdHJpZ2dlckluVHJhbnNpdGlvbiA9ICgpID0+IHN0YXJ0VHJhbnNpdGlvbih0cmlnZ2VyKS50aGVuKCgpID0+IGluVHJhbnNpdGlvbi5kaXNwb3NlKCkpO1xuICAgIGNvbnN0IGluVHJhbnNpdGlvbiA9IEV4dGVybmFsU291cmNlQ29uZmlnLmZhY3RvcnkoYy5mbiwgdHJpZ2dlckluVHJhbnNpdGlvbik7XG4gICAgYy5mbiA9IHggPT4ge1xuICAgICAgdHJhY2soKTtcbiAgICAgIHJldHVybiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyA/IGluVHJhbnNpdGlvbi50cmFjayh4KSA6IG9yZGluYXJ5LnRyYWNrKHgpO1xuICAgIH07XG4gIH1cbiAgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lciAmJiBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyKGMpO1xuICByZXR1cm4gYztcbn1cbmZ1bmN0aW9uIHJ1blRvcChub2RlKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSAwKSByZXR1cm47XG4gIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBQRU5ESU5HKSByZXR1cm4gbG9va1Vwc3RyZWFtKG5vZGUpO1xuICBpZiAobm9kZS5zdXNwZW5zZSAmJiB1bnRyYWNrKG5vZGUuc3VzcGVuc2UuaW5GYWxsYmFjaykpIHJldHVybiBub2RlLnN1c3BlbnNlLmVmZmVjdHMucHVzaChub2RlKTtcbiAgY29uc3QgYW5jZXN0b3JzID0gW25vZGVdO1xuICB3aGlsZSAoKG5vZGUgPSBub2RlLm93bmVyKSAmJiAoIW5vZGUudXBkYXRlZEF0IHx8IG5vZGUudXBkYXRlZEF0IDwgRXhlY0NvdW50KSkge1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyhub2RlKSkgcmV0dXJuO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgYW5jZXN0b3JzLnB1c2gobm9kZSk7XG4gIH1cbiAgZm9yIChsZXQgaSA9IGFuY2VzdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIG5vZGUgPSBhbmNlc3RvcnNbaV07XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uKSB7XG4gICAgICBsZXQgdG9wID0gbm9kZSxcbiAgICAgICAgcHJldiA9IGFuY2VzdG9yc1tpICsgMV07XG4gICAgICB3aGlsZSAoKHRvcCA9IHRvcC5vd25lcikgJiYgdG9wICE9PSBwcmV2KSB7XG4gICAgICAgIGlmIChUcmFuc2l0aW9uLmRpc3Bvc2VkLmhhcyh0b3ApKSByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBTVEFMRSkge1xuICAgICAgdXBkYXRlQ29tcHV0YXRpb24obm9kZSk7XG4gICAgfSBlbHNlIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpID09PSBQRU5ESU5HKSB7XG4gICAgICBjb25zdCB1cGRhdGVzID0gVXBkYXRlcztcbiAgICAgIFVwZGF0ZXMgPSBudWxsO1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiBsb29rVXBzdHJlYW0obm9kZSwgYW5jZXN0b3JzWzBdKSwgZmFsc2UpO1xuICAgICAgVXBkYXRlcyA9IHVwZGF0ZXM7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBydW5VcGRhdGVzKGZuLCBpbml0KSB7XG4gIGlmIChVcGRhdGVzKSByZXR1cm4gZm4oKTtcbiAgbGV0IHdhaXQgPSBmYWxzZTtcbiAgaWYgKCFpbml0KSBVcGRhdGVzID0gW107XG4gIGlmIChFZmZlY3RzKSB3YWl0ID0gdHJ1ZTtlbHNlIEVmZmVjdHMgPSBbXTtcbiAgRXhlY0NvdW50Kys7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gZm4oKTtcbiAgICBjb21wbGV0ZVVwZGF0ZXMod2FpdCk7XG4gICAgcmV0dXJuIHJlcztcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKCF3YWl0KSBFZmZlY3RzID0gbnVsbDtcbiAgICBVcGRhdGVzID0gbnVsbDtcbiAgICBoYW5kbGVFcnJvcihlcnIpO1xuICB9XG59XG5mdW5jdGlvbiBjb21wbGV0ZVVwZGF0ZXMod2FpdCkge1xuICBpZiAoVXBkYXRlcykge1xuICAgIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHNjaGVkdWxlUXVldWUoVXBkYXRlcyk7ZWxzZSBydW5RdWV1ZShVcGRhdGVzKTtcbiAgICBVcGRhdGVzID0gbnVsbDtcbiAgfVxuICBpZiAod2FpdCkgcmV0dXJuO1xuICBsZXQgcmVzO1xuICBpZiAoVHJhbnNpdGlvbikge1xuICAgIGlmICghVHJhbnNpdGlvbi5wcm9taXNlcy5zaXplICYmICFUcmFuc2l0aW9uLnF1ZXVlLnNpemUpIHtcbiAgICAgIGNvbnN0IHNvdXJjZXMgPSBUcmFuc2l0aW9uLnNvdXJjZXM7XG4gICAgICBjb25zdCBkaXNwb3NlZCA9IFRyYW5zaXRpb24uZGlzcG9zZWQ7XG4gICAgICBFZmZlY3RzLnB1c2guYXBwbHkoRWZmZWN0cywgVHJhbnNpdGlvbi5lZmZlY3RzKTtcbiAgICAgIHJlcyA9IFRyYW5zaXRpb24ucmVzb2x2ZTtcbiAgICAgIGZvciAoY29uc3QgZSBvZiBFZmZlY3RzKSB7XG4gICAgICAgIFwidFN0YXRlXCIgaW4gZSAmJiAoZS5zdGF0ZSA9IGUudFN0YXRlKTtcbiAgICAgICAgZGVsZXRlIGUudFN0YXRlO1xuICAgICAgfVxuICAgICAgVHJhbnNpdGlvbiA9IG51bGw7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBkIG9mIGRpc3Bvc2VkKSBjbGVhbk5vZGUoZCk7XG4gICAgICAgIGZvciAoY29uc3QgdiBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgdi52YWx1ZSA9IHYudFZhbHVlO1xuICAgICAgICAgIGlmICh2Lm93bmVkKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdi5vd25lZC5sZW5ndGg7IGkgPCBsZW47IGkrKykgY2xlYW5Ob2RlKHYub3duZWRbaV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodi50T3duZWQpIHYub3duZWQgPSB2LnRPd25lZDtcbiAgICAgICAgICBkZWxldGUgdi50VmFsdWU7XG4gICAgICAgICAgZGVsZXRlIHYudE93bmVkO1xuICAgICAgICAgIHYudFN0YXRlID0gMDtcbiAgICAgICAgfVxuICAgICAgICBzZXRUcmFuc1BlbmRpbmcoZmFsc2UpO1xuICAgICAgfSwgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgIFRyYW5zaXRpb24uZWZmZWN0cy5wdXNoLmFwcGx5KFRyYW5zaXRpb24uZWZmZWN0cywgRWZmZWN0cyk7XG4gICAgICBFZmZlY3RzID0gbnVsbDtcbiAgICAgIHNldFRyYW5zUGVuZGluZyh0cnVlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cbiAgY29uc3QgZSA9IEVmZmVjdHM7XG4gIEVmZmVjdHMgPSBudWxsO1xuICBpZiAoZS5sZW5ndGgpIHJ1blVwZGF0ZXMoKCkgPT4gcnVuRWZmZWN0cyhlKSwgZmFsc2UpO2Vsc2UgRGV2SG9va3MuYWZ0ZXJVcGRhdGUgJiYgRGV2SG9va3MuYWZ0ZXJVcGRhdGUoKTtcbiAgaWYgKHJlcykgcmVzKCk7XG59XG5mdW5jdGlvbiBydW5RdWV1ZShxdWV1ZSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSBydW5Ub3AocXVldWVbaV0pO1xufVxuZnVuY3Rpb24gc2NoZWR1bGVRdWV1ZShxdWV1ZSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgaXRlbSA9IHF1ZXVlW2ldO1xuICAgIGNvbnN0IHRhc2tzID0gVHJhbnNpdGlvbi5xdWV1ZTtcbiAgICBpZiAoIXRhc2tzLmhhcyhpdGVtKSkge1xuICAgICAgdGFza3MuYWRkKGl0ZW0pO1xuICAgICAgU2NoZWR1bGVyKCgpID0+IHtcbiAgICAgICAgdGFza3MuZGVsZXRlKGl0ZW0pO1xuICAgICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgICBUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgIHJ1blRvcChpdGVtKTtcbiAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICBUcmFuc2l0aW9uICYmIChUcmFuc2l0aW9uLnJ1bm5pbmcgPSBmYWxzZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIHJ1blVzZXJFZmZlY3RzKHF1ZXVlKSB7XG4gIGxldCBpLFxuICAgIHVzZXJMZW5ndGggPSAwO1xuICBmb3IgKGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBlID0gcXVldWVbaV07XG4gICAgaWYgKCFlLnVzZXIpIHJ1blRvcChlKTtlbHNlIHF1ZXVlW3VzZXJMZW5ndGgrK10gPSBlO1xuICB9XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCkge1xuICAgIGlmIChzaGFyZWRDb25maWcuY291bnQpIHtcbiAgICAgIHNoYXJlZENvbmZpZy5lZmZlY3RzIHx8IChzaGFyZWRDb25maWcuZWZmZWN0cyA9IFtdKTtcbiAgICAgIHNoYXJlZENvbmZpZy5lZmZlY3RzLnB1c2goLi4ucXVldWUuc2xpY2UoMCwgdXNlckxlbmd0aCkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICB9XG4gIGlmIChzaGFyZWRDb25maWcuZWZmZWN0cyAmJiAoc2hhcmVkQ29uZmlnLmRvbmUgfHwgIXNoYXJlZENvbmZpZy5jb3VudCkpIHtcbiAgICBxdWV1ZSA9IFsuLi5zaGFyZWRDb25maWcuZWZmZWN0cywgLi4ucXVldWVdO1xuICAgIHVzZXJMZW5ndGggKz0gc2hhcmVkQ29uZmlnLmVmZmVjdHMubGVuZ3RoO1xuICAgIGRlbGV0ZSBzaGFyZWRDb25maWcuZWZmZWN0cztcbiAgfVxuICBmb3IgKGkgPSAwOyBpIDwgdXNlckxlbmd0aDsgaSsrKSBydW5Ub3AocXVldWVbaV0pO1xufVxuZnVuY3Rpb24gbG9va1Vwc3RyZWFtKG5vZGUsIGlnbm9yZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAocnVubmluZ1RyYW5zaXRpb24pIG5vZGUudFN0YXRlID0gMDtlbHNlIG5vZGUuc3RhdGUgPSAwO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuc291cmNlcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGNvbnN0IHNvdXJjZSA9IG5vZGUuc291cmNlc1tpXTtcbiAgICBpZiAoc291cmNlLnNvdXJjZXMpIHtcbiAgICAgIGNvbnN0IHN0YXRlID0gcnVubmluZ1RyYW5zaXRpb24gPyBzb3VyY2UudFN0YXRlIDogc291cmNlLnN0YXRlO1xuICAgICAgaWYgKHN0YXRlID09PSBTVEFMRSkge1xuICAgICAgICBpZiAoc291cmNlICE9PSBpZ25vcmUgJiYgKCFzb3VyY2UudXBkYXRlZEF0IHx8IHNvdXJjZS51cGRhdGVkQXQgPCBFeGVjQ291bnQpKSBydW5Ub3Aoc291cmNlKTtcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IFBFTkRJTkcpIGxvb2tVcHN0cmVhbShzb3VyY2UsIGlnbm9yZSk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBtYXJrRG93bnN0cmVhbShub2RlKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vYnNlcnZlcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBjb25zdCBvID0gbm9kZS5vYnNlcnZlcnNbaV07XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uID8gIW8udFN0YXRlIDogIW8uc3RhdGUpIHtcbiAgICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbikgby50U3RhdGUgPSBQRU5ESU5HO2Vsc2Ugby5zdGF0ZSA9IFBFTkRJTkc7XG4gICAgICBpZiAoby5wdXJlKSBVcGRhdGVzLnB1c2gobyk7ZWxzZSBFZmZlY3RzLnB1c2gobyk7XG4gICAgICBvLm9ic2VydmVycyAmJiBtYXJrRG93bnN0cmVhbShvKTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIGNsZWFuTm9kZShub2RlKSB7XG4gIGxldCBpO1xuICBpZiAobm9kZS5zb3VyY2VzKSB7XG4gICAgd2hpbGUgKG5vZGUuc291cmNlcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHNvdXJjZSA9IG5vZGUuc291cmNlcy5wb3AoKSxcbiAgICAgICAgaW5kZXggPSBub2RlLnNvdXJjZVNsb3RzLnBvcCgpLFxuICAgICAgICBvYnMgPSBzb3VyY2Uub2JzZXJ2ZXJzO1xuICAgICAgaWYgKG9icyAmJiBvYnMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IG4gPSBvYnMucG9wKCksXG4gICAgICAgICAgcyA9IHNvdXJjZS5vYnNlcnZlclNsb3RzLnBvcCgpO1xuICAgICAgICBpZiAoaW5kZXggPCBvYnMubGVuZ3RoKSB7XG4gICAgICAgICAgbi5zb3VyY2VTbG90c1tzXSA9IGluZGV4O1xuICAgICAgICAgIG9ic1tpbmRleF0gPSBuO1xuICAgICAgICAgIHNvdXJjZS5vYnNlcnZlclNsb3RzW2luZGV4XSA9IHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKG5vZGUudE93bmVkKSB7XG4gICAgZm9yIChpID0gbm9kZS50T3duZWQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGNsZWFuTm9kZShub2RlLnRPd25lZFtpXSk7XG4gICAgZGVsZXRlIG5vZGUudE93bmVkO1xuICB9XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBub2RlLnB1cmUpIHtcbiAgICByZXNldChub2RlLCB0cnVlKTtcbiAgfSBlbHNlIGlmIChub2RlLm93bmVkKSB7XG4gICAgZm9yIChpID0gbm9kZS5vd25lZC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgY2xlYW5Ob2RlKG5vZGUub3duZWRbaV0pO1xuICAgIG5vZGUub3duZWQgPSBudWxsO1xuICB9XG4gIGlmIChub2RlLmNsZWFudXBzKSB7XG4gICAgZm9yIChpID0gbm9kZS5jbGVhbnVwcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgbm9kZS5jbGVhbnVwc1tpXSgpO1xuICAgIG5vZGUuY2xlYW51cHMgPSBudWxsO1xuICB9XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgbm9kZS50U3RhdGUgPSAwO2Vsc2Ugbm9kZS5zdGF0ZSA9IDA7XG4gIGRlbGV0ZSBub2RlLnNvdXJjZU1hcDtcbn1cbmZ1bmN0aW9uIHJlc2V0KG5vZGUsIHRvcCkge1xuICBpZiAoIXRvcCkge1xuICAgIG5vZGUudFN0YXRlID0gMDtcbiAgICBUcmFuc2l0aW9uLmRpc3Bvc2VkLmFkZChub2RlKTtcbiAgfVxuICBpZiAobm9kZS5vd25lZCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vd25lZC5sZW5ndGg7IGkrKykgcmVzZXQobm9kZS5vd25lZFtpXSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGNhc3RFcnJvcihlcnIpIHtcbiAgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gZXJyO1xuICByZXR1cm4gbmV3IEVycm9yKHR5cGVvZiBlcnIgPT09IFwic3RyaW5nXCIgPyBlcnIgOiBcIlVua25vd24gZXJyb3JcIiwge1xuICAgIGNhdXNlOiBlcnJcbiAgfSk7XG59XG5mdW5jdGlvbiBydW5FcnJvcnMoZXJyLCBmbnMsIG93bmVyKSB7XG4gIHRyeSB7XG4gICAgZm9yIChjb25zdCBmIG9mIGZucykgZihlcnIpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaGFuZGxlRXJyb3IoZSwgb3duZXIgJiYgb3duZXIub3duZXIgfHwgbnVsbCk7XG4gIH1cbn1cbmZ1bmN0aW9uIGhhbmRsZUVycm9yKGVyciwgb3duZXIgPSBPd25lcikge1xuICBjb25zdCBmbnMgPSBFUlJPUiAmJiBvd25lciAmJiBvd25lci5jb250ZXh0ICYmIG93bmVyLmNvbnRleHRbRVJST1JdO1xuICBjb25zdCBlcnJvciA9IGNhc3RFcnJvcihlcnIpO1xuICBpZiAoIWZucykgdGhyb3cgZXJyb3I7XG4gIGlmIChFZmZlY3RzKSBFZmZlY3RzLnB1c2goe1xuICAgIGZuKCkge1xuICAgICAgcnVuRXJyb3JzKGVycm9yLCBmbnMsIG93bmVyKTtcbiAgICB9LFxuICAgIHN0YXRlOiBTVEFMRVxuICB9KTtlbHNlIHJ1bkVycm9ycyhlcnJvciwgZm5zLCBvd25lcik7XG59XG5mdW5jdGlvbiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4pIHtcbiAgaWYgKHR5cGVvZiBjaGlsZHJlbiA9PT0gXCJmdW5jdGlvblwiICYmICFjaGlsZHJlbi5sZW5ndGgpIHJldHVybiByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW4oKSk7XG4gIGlmIChBcnJheS5pc0FycmF5KGNoaWxkcmVuKSkge1xuICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSByZXNvbHZlQ2hpbGRyZW4oY2hpbGRyZW5baV0pO1xuICAgICAgQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0cy5wdXNoLmFwcGx5KHJlc3VsdHMsIHJlc3VsdCkgOiByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cbiAgcmV0dXJuIGNoaWxkcmVuO1xufVxuZnVuY3Rpb24gY3JlYXRlUHJvdmlkZXIoaWQsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHByb3ZpZGVyKHByb3BzKSB7XG4gICAgbGV0IHJlcztcbiAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gcmVzID0gdW50cmFjaygoKSA9PiB7XG4gICAgICBPd25lci5jb250ZXh0ID0ge1xuICAgICAgICAuLi5Pd25lci5jb250ZXh0LFxuICAgICAgICBbaWRdOiBwcm9wcy52YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiBjaGlsZHJlbigoKSA9PiBwcm9wcy5jaGlsZHJlbik7XG4gICAgfSksIHVuZGVmaW5lZCwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcbn1cbmZ1bmN0aW9uIG9uRXJyb3IoZm4pIHtcbiAgRVJST1IgfHwgKEVSUk9SID0gU3ltYm9sKFwiZXJyb3JcIikpO1xuICBpZiAoT3duZXIgPT09IG51bGwpIGNvbnNvbGUud2FybihcImVycm9yIGhhbmRsZXJzIGNyZWF0ZWQgb3V0c2lkZSBhIGBjcmVhdGVSb290YCBvciBgcmVuZGVyYCB3aWxsIG5ldmVyIGJlIHJ1blwiKTtlbHNlIGlmIChPd25lci5jb250ZXh0ID09PSBudWxsIHx8ICFPd25lci5jb250ZXh0W0VSUk9SXSkge1xuICAgIE93bmVyLmNvbnRleHQgPSB7XG4gICAgICAuLi5Pd25lci5jb250ZXh0LFxuICAgICAgW0VSUk9SXTogW2ZuXVxuICAgIH07XG4gICAgbXV0YXRlQ29udGV4dChPd25lciwgRVJST1IsIFtmbl0pO1xuICB9IGVsc2UgT3duZXIuY29udGV4dFtFUlJPUl0ucHVzaChmbik7XG59XG5mdW5jdGlvbiBtdXRhdGVDb250ZXh0KG8sIGtleSwgdmFsdWUpIHtcbiAgaWYgKG8ub3duZWQpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG8ub3duZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChvLm93bmVkW2ldLmNvbnRleHQgPT09IG8uY29udGV4dCkgbXV0YXRlQ29udGV4dChvLm93bmVkW2ldLCBrZXksIHZhbHVlKTtcbiAgICAgIGlmICghby5vd25lZFtpXS5jb250ZXh0KSB7XG4gICAgICAgIG8ub3duZWRbaV0uY29udGV4dCA9IG8uY29udGV4dDtcbiAgICAgICAgbXV0YXRlQ29udGV4dChvLm93bmVkW2ldLCBrZXksIHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoIW8ub3duZWRbaV0uY29udGV4dFtrZXldKSB7XG4gICAgICAgIG8ub3duZWRbaV0uY29udGV4dFtrZXldID0gdmFsdWU7XG4gICAgICAgIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIG9ic2VydmFibGUoaW5wdXQpIHtcbiAgcmV0dXJuIHtcbiAgICBzdWJzY3JpYmUob2JzZXJ2ZXIpIHtcbiAgICAgIGlmICghKG9ic2VydmVyIGluc3RhbmNlb2YgT2JqZWN0KSB8fCBvYnNlcnZlciA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJFeHBlY3RlZCB0aGUgb2JzZXJ2ZXIgdG8gYmUgYW4gb2JqZWN0LlwiKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGhhbmRsZXIgPSB0eXBlb2Ygb2JzZXJ2ZXIgPT09IFwiZnVuY3Rpb25cIiA/IG9ic2VydmVyIDogb2JzZXJ2ZXIubmV4dCAmJiBvYnNlcnZlci5uZXh0LmJpbmQob2JzZXJ2ZXIpO1xuICAgICAgaWYgKCFoYW5kbGVyKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdW5zdWJzY3JpYmUoKSB7fVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgY29uc3QgZGlzcG9zZSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHYgPSBpbnB1dCgpO1xuICAgICAgICAgIHVudHJhY2soKCkgPT4gaGFuZGxlcih2KSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGlzcG9zZXI7XG4gICAgICB9KTtcbiAgICAgIGlmIChnZXRPd25lcigpKSBvbkNsZWFudXAoZGlzcG9zZSk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpIHtcbiAgICAgICAgICBkaXNwb3NlKCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSxcbiAgICBbU3ltYm9sLm9ic2VydmFibGUgfHwgXCJAQG9ic2VydmFibGVcIl0oKSB7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiBmcm9tKHByb2R1Y2VyLCBpbml0YWxWYWx1ZSA9IHVuZGVmaW5lZCkge1xuICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbChpbml0YWxWYWx1ZSwge1xuICAgIGVxdWFsczogZmFsc2VcbiAgfSk7XG4gIGlmIChcInN1YnNjcmliZVwiIGluIHByb2R1Y2VyKSB7XG4gICAgY29uc3QgdW5zdWIgPSBwcm9kdWNlci5zdWJzY3JpYmUodiA9PiBzZXQoKCkgPT4gdikpO1xuICAgIG9uQ2xlYW51cCgoKSA9PiBcInVuc3Vic2NyaWJlXCIgaW4gdW5zdWIgPyB1bnN1Yi51bnN1YnNjcmliZSgpIDogdW5zdWIoKSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgY2xlYW4gPSBwcm9kdWNlcihzZXQpO1xuICAgIG9uQ2xlYW51cChjbGVhbik7XG4gIH1cbiAgcmV0dXJuIHM7XG59XG5cbmNvbnN0IEZBTExCQUNLID0gU3ltYm9sKFwiZmFsbGJhY2tcIik7XG5mdW5jdGlvbiBkaXNwb3NlKGQpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBkLmxlbmd0aDsgaSsrKSBkW2ldKCk7XG59XG5mdW5jdGlvbiBtYXBBcnJheShsaXN0LCBtYXBGbiwgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCBpdGVtcyA9IFtdLFxuICAgIG1hcHBlZCA9IFtdLFxuICAgIGRpc3Bvc2VycyA9IFtdLFxuICAgIGxlbiA9IDAsXG4gICAgaW5kZXhlcyA9IG1hcEZuLmxlbmd0aCA+IDEgPyBbXSA6IG51bGw7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlKGRpc3Bvc2VycykpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGxldCBuZXdJdGVtcyA9IGxpc3QoKSB8fCBbXSxcbiAgICAgIG5ld0xlbiA9IG5ld0l0ZW1zLmxlbmd0aCxcbiAgICAgIGksXG4gICAgICBqO1xuICAgIG5ld0l0ZW1zWyRUUkFDS107XG4gICAgcmV0dXJuIHVudHJhY2soKCkgPT4ge1xuICAgICAgbGV0IG5ld0luZGljZXMsIG5ld0luZGljZXNOZXh0LCB0ZW1wLCB0ZW1wZGlzcG9zZXJzLCB0ZW1wSW5kZXhlcywgc3RhcnQsIGVuZCwgbmV3RW5kLCBpdGVtO1xuICAgICAgaWYgKG5ld0xlbiA9PT0gMCkge1xuICAgICAgICBpZiAobGVuICE9PSAwKSB7XG4gICAgICAgICAgZGlzcG9zZShkaXNwb3NlcnMpO1xuICAgICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgICAgbWFwcGVkID0gW107XG4gICAgICAgICAgbGVuID0gMDtcbiAgICAgICAgICBpbmRleGVzICYmIChpbmRleGVzID0gW10pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLmZhbGxiYWNrKSB7XG4gICAgICAgICAgaXRlbXMgPSBbRkFMTEJBQ0tdO1xuICAgICAgICAgIG1hcHBlZFswXSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZXJzWzBdID0gZGlzcG9zZXI7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9ucy5mYWxsYmFjaygpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxlbiA9IDE7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGxlbiA9PT0gMCkge1xuICAgICAgICBtYXBwZWQgPSBuZXcgQXJyYXkobmV3TGVuKTtcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IG5ld0xlbjsgaisrKSB7XG4gICAgICAgICAgaXRlbXNbal0gPSBuZXdJdGVtc1tqXTtcbiAgICAgICAgICBtYXBwZWRbal0gPSBjcmVhdGVSb290KG1hcHBlcik7XG4gICAgICAgIH1cbiAgICAgICAgbGVuID0gbmV3TGVuO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGVtcCA9IG5ldyBBcnJheShuZXdMZW4pO1xuICAgICAgICB0ZW1wZGlzcG9zZXJzID0gbmV3IEFycmF5KG5ld0xlbik7XG4gICAgICAgIGluZGV4ZXMgJiYgKHRlbXBJbmRleGVzID0gbmV3IEFycmF5KG5ld0xlbikpO1xuICAgICAgICBmb3IgKHN0YXJ0ID0gMCwgZW5kID0gTWF0aC5taW4obGVuLCBuZXdMZW4pOyBzdGFydCA8IGVuZCAmJiBpdGVtc1tzdGFydF0gPT09IG5ld0l0ZW1zW3N0YXJ0XTsgc3RhcnQrKyk7XG4gICAgICAgIGZvciAoZW5kID0gbGVuIC0gMSwgbmV3RW5kID0gbmV3TGVuIC0gMTsgZW5kID49IHN0YXJ0ICYmIG5ld0VuZCA+PSBzdGFydCAmJiBpdGVtc1tlbmRdID09PSBuZXdJdGVtc1tuZXdFbmRdOyBlbmQtLSwgbmV3RW5kLS0pIHtcbiAgICAgICAgICB0ZW1wW25ld0VuZF0gPSBtYXBwZWRbZW5kXTtcbiAgICAgICAgICB0ZW1wZGlzcG9zZXJzW25ld0VuZF0gPSBkaXNwb3NlcnNbZW5kXTtcbiAgICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlc1tuZXdFbmRdID0gaW5kZXhlc1tlbmRdKTtcbiAgICAgICAgfVxuICAgICAgICBuZXdJbmRpY2VzID0gbmV3IE1hcCgpO1xuICAgICAgICBuZXdJbmRpY2VzTmV4dCA9IG5ldyBBcnJheShuZXdFbmQgKyAxKTtcbiAgICAgICAgZm9yIChqID0gbmV3RW5kOyBqID49IHN0YXJ0OyBqLS0pIHtcbiAgICAgICAgICBpdGVtID0gbmV3SXRlbXNbal07XG4gICAgICAgICAgaSA9IG5ld0luZGljZXMuZ2V0KGl0ZW0pO1xuICAgICAgICAgIG5ld0luZGljZXNOZXh0W2pdID0gaSA9PT0gdW5kZWZpbmVkID8gLTEgOiBpO1xuICAgICAgICAgIG5ld0luZGljZXMuc2V0KGl0ZW0sIGopO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IHN0YXJ0OyBpIDw9IGVuZDsgaSsrKSB7XG4gICAgICAgICAgaXRlbSA9IGl0ZW1zW2ldO1xuICAgICAgICAgIGogPSBuZXdJbmRpY2VzLmdldChpdGVtKTtcbiAgICAgICAgICBpZiAoaiAhPT0gdW5kZWZpbmVkICYmIGogIT09IC0xKSB7XG4gICAgICAgICAgICB0ZW1wW2pdID0gbWFwcGVkW2ldO1xuICAgICAgICAgICAgdGVtcGRpc3Bvc2Vyc1tqXSA9IGRpc3Bvc2Vyc1tpXTtcbiAgICAgICAgICAgIGluZGV4ZXMgJiYgKHRlbXBJbmRleGVzW2pdID0gaW5kZXhlc1tpXSk7XG4gICAgICAgICAgICBqID0gbmV3SW5kaWNlc05leHRbal07XG4gICAgICAgICAgICBuZXdJbmRpY2VzLnNldChpdGVtLCBqKTtcbiAgICAgICAgICB9IGVsc2UgZGlzcG9zZXJzW2ldKCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChqID0gc3RhcnQ7IGogPCBuZXdMZW47IGorKykge1xuICAgICAgICAgIGlmIChqIGluIHRlbXApIHtcbiAgICAgICAgICAgIG1hcHBlZFtqXSA9IHRlbXBbal07XG4gICAgICAgICAgICBkaXNwb3NlcnNbal0gPSB0ZW1wZGlzcG9zZXJzW2pdO1xuICAgICAgICAgICAgaWYgKGluZGV4ZXMpIHtcbiAgICAgICAgICAgICAgaW5kZXhlc1tqXSA9IHRlbXBJbmRleGVzW2pdO1xuICAgICAgICAgICAgICBpbmRleGVzW2pdKGopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBtYXBwZWRbal0gPSBjcmVhdGVSb290KG1hcHBlcik7XG4gICAgICAgIH1cbiAgICAgICAgbWFwcGVkID0gbWFwcGVkLnNsaWNlKDAsIGxlbiA9IG5ld0xlbik7XG4gICAgICAgIGl0ZW1zID0gbmV3SXRlbXMuc2xpY2UoMCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWFwcGVkO1xuICAgIH0pO1xuICAgIGZ1bmN0aW9uIG1hcHBlcihkaXNwb3Nlcikge1xuICAgICAgZGlzcG9zZXJzW2pdID0gZGlzcG9zZXI7XG4gICAgICBpZiAoaW5kZXhlcykge1xuICAgICAgICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbChqLCB7XG4gICAgICAgICAgbmFtZTogXCJpbmRleFwiXG4gICAgICAgIH0pIDtcbiAgICAgICAgaW5kZXhlc1tqXSA9IHNldDtcbiAgICAgICAgcmV0dXJuIG1hcEZuKG5ld0l0ZW1zW2pdLCBzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXBGbihuZXdJdGVtc1tqXSk7XG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gaW5kZXhBcnJheShsaXN0LCBtYXBGbiwgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCBpdGVtcyA9IFtdLFxuICAgIG1hcHBlZCA9IFtdLFxuICAgIGRpc3Bvc2VycyA9IFtdLFxuICAgIHNpZ25hbHMgPSBbXSxcbiAgICBsZW4gPSAwLFxuICAgIGk7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlKGRpc3Bvc2VycykpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGNvbnN0IG5ld0l0ZW1zID0gbGlzdCgpIHx8IFtdLFxuICAgICAgbmV3TGVuID0gbmV3SXRlbXMubGVuZ3RoO1xuICAgIG5ld0l0ZW1zWyRUUkFDS107XG4gICAgcmV0dXJuIHVudHJhY2soKCkgPT4ge1xuICAgICAgaWYgKG5ld0xlbiA9PT0gMCkge1xuICAgICAgICBpZiAobGVuICE9PSAwKSB7XG4gICAgICAgICAgZGlzcG9zZShkaXNwb3NlcnMpO1xuICAgICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgICAgbWFwcGVkID0gW107XG4gICAgICAgICAgbGVuID0gMDtcbiAgICAgICAgICBzaWduYWxzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZmFsbGJhY2spIHtcbiAgICAgICAgICBpdGVtcyA9IFtGQUxMQkFDS107XG4gICAgICAgICAgbWFwcGVkWzBdID0gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgICAgICBkaXNwb3NlcnNbMF0gPSBkaXNwb3NlcjtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb25zLmZhbGxiYWNrKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGVuID0gMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWFwcGVkO1xuICAgICAgfVxuICAgICAgaWYgKGl0ZW1zWzBdID09PSBGQUxMQkFDSykge1xuICAgICAgICBkaXNwb3NlcnNbMF0oKTtcbiAgICAgICAgZGlzcG9zZXJzID0gW107XG4gICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICBsZW4gPSAwO1xuICAgICAgfVxuICAgICAgZm9yIChpID0gMDsgaSA8IG5ld0xlbjsgaSsrKSB7XG4gICAgICAgIGlmIChpIDwgaXRlbXMubGVuZ3RoICYmIGl0ZW1zW2ldICE9PSBuZXdJdGVtc1tpXSkge1xuICAgICAgICAgIHNpZ25hbHNbaV0oKCkgPT4gbmV3SXRlbXNbaV0pO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPj0gaXRlbXMubGVuZ3RoKSB7XG4gICAgICAgICAgbWFwcGVkW2ldID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKDsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGRpc3Bvc2Vyc1tpXSgpO1xuICAgICAgfVxuICAgICAgbGVuID0gc2lnbmFscy5sZW5ndGggPSBkaXNwb3NlcnMubGVuZ3RoID0gbmV3TGVuO1xuICAgICAgaXRlbXMgPSBuZXdJdGVtcy5zbGljZSgwKTtcbiAgICAgIHJldHVybiBtYXBwZWQgPSBtYXBwZWQuc2xpY2UoMCwgbGVuKTtcbiAgICB9KTtcbiAgICBmdW5jdGlvbiBtYXBwZXIoZGlzcG9zZXIpIHtcbiAgICAgIGRpc3Bvc2Vyc1tpXSA9IGRpc3Bvc2VyO1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwobmV3SXRlbXNbaV0sIHtcbiAgICAgICAgbmFtZTogXCJ2YWx1ZVwiXG4gICAgICB9KSA7XG4gICAgICBzaWduYWxzW2ldID0gc2V0O1xuICAgICAgcmV0dXJuIG1hcEZuKHMsIGkpO1xuICAgIH1cbiAgfTtcbn1cblxubGV0IGh5ZHJhdGlvbkVuYWJsZWQgPSBmYWxzZTtcbmZ1bmN0aW9uIGVuYWJsZUh5ZHJhdGlvbigpIHtcbiAgaHlkcmF0aW9uRW5hYmxlZCA9IHRydWU7XG59XG5mdW5jdGlvbiBjcmVhdGVDb21wb25lbnQoQ29tcCwgcHJvcHMpIHtcbiAgaWYgKGh5ZHJhdGlvbkVuYWJsZWQpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQpIHtcbiAgICAgIGNvbnN0IGMgPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KG5leHRIeWRyYXRlQ29udGV4dCgpKTtcbiAgICAgIGNvbnN0IHIgPSBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMgfHwge30pIDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGMpO1xuICAgICAgcmV0dXJuIHI7XG4gICAgfVxuICB9XG4gIHJldHVybiBkZXZDb21wb25lbnQoQ29tcCwgcHJvcHMgfHwge30pO1xufVxuZnVuY3Rpb24gdHJ1ZUZuKCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cbmNvbnN0IHByb3BUcmFwcyA9IHtcbiAgZ2V0KF8sIHByb3BlcnR5LCByZWNlaXZlcikge1xuICAgIGlmIChwcm9wZXJ0eSA9PT0gJFBST1hZKSByZXR1cm4gcmVjZWl2ZXI7XG4gICAgcmV0dXJuIF8uZ2V0KHByb3BlcnR5KTtcbiAgfSxcbiAgaGFzKF8sIHByb3BlcnR5KSB7XG4gICAgaWYgKHByb3BlcnR5ID09PSAkUFJPWFkpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBfLmhhcyhwcm9wZXJ0eSk7XG4gIH0sXG4gIHNldDogdHJ1ZUZuLFxuICBkZWxldGVQcm9wZXJ0eTogdHJ1ZUZuLFxuICBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoXywgcHJvcGVydHkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGdldCgpIHtcbiAgICAgICAgcmV0dXJuIF8uZ2V0KHByb3BlcnR5KTtcbiAgICAgIH0sXG4gICAgICBzZXQ6IHRydWVGbixcbiAgICAgIGRlbGV0ZVByb3BlcnR5OiB0cnVlRm5cbiAgICB9O1xuICB9LFxuICBvd25LZXlzKF8pIHtcbiAgICByZXR1cm4gXy5rZXlzKCk7XG4gIH1cbn07XG5mdW5jdGlvbiByZXNvbHZlU291cmNlKHMpIHtcbiAgcmV0dXJuICEocyA9IHR5cGVvZiBzID09PSBcImZ1bmN0aW9uXCIgPyBzKCkgOiBzKSA/IHt9IDogcztcbn1cbmZ1bmN0aW9uIHJlc29sdmVTb3VyY2VzKCkge1xuICBmb3IgKGxldCBpID0gMCwgbGVuZ3RoID0gdGhpcy5sZW5ndGg7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGNvbnN0IHYgPSB0aGlzW2ldKCk7XG4gICAgaWYgKHYgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHY7XG4gIH1cbn1cbmZ1bmN0aW9uIG1lcmdlUHJvcHMoLi4uc291cmNlcykge1xuICBsZXQgcHJveHkgPSBmYWxzZTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgcyA9IHNvdXJjZXNbaV07XG4gICAgcHJveHkgPSBwcm94eSB8fCAhIXMgJiYgJFBST1hZIGluIHM7XG4gICAgc291cmNlc1tpXSA9IHR5cGVvZiBzID09PSBcImZ1bmN0aW9uXCIgPyAocHJveHkgPSB0cnVlLCBjcmVhdGVNZW1vKHMpKSA6IHM7XG4gIH1cbiAgaWYgKFNVUFBPUlRTX1BST1hZICYmIHByb3h5KSB7XG4gICAgcmV0dXJuIG5ldyBQcm94eSh7XG4gICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICBjb25zdCB2ID0gcmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKVtwcm9wZXJ0eV07XG4gICAgICAgICAgaWYgKHYgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHY7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICBpZiAocHJvcGVydHkgaW4gcmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKSkgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICAgIGtleXMoKSB7XG4gICAgICAgIGNvbnN0IGtleXMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VzLmxlbmd0aDsgaSsrKSBrZXlzLnB1c2goLi4uT2JqZWN0LmtleXMocmVzb2x2ZVNvdXJjZShzb3VyY2VzW2ldKSkpO1xuICAgICAgICByZXR1cm4gWy4uLm5ldyBTZXQoa2V5cyldO1xuICAgICAgfVxuICAgIH0sIHByb3BUcmFwcyk7XG4gIH1cbiAgY29uc3Qgc291cmNlc01hcCA9IHt9O1xuICBjb25zdCBkZWZpbmVkID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgZm9yIChsZXQgaSA9IHNvdXJjZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBjb25zdCBzb3VyY2UgPSBzb3VyY2VzW2ldO1xuICAgIGlmICghc291cmNlKSBjb250aW51ZTtcbiAgICBjb25zdCBzb3VyY2VLZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoc291cmNlKTtcbiAgICBmb3IgKGxldCBpID0gc291cmNlS2V5cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3Qga2V5ID0gc291cmNlS2V5c1tpXTtcbiAgICAgIGlmIChrZXkgPT09IFwiX19wcm90b19fXCIgfHwga2V5ID09PSBcImNvbnN0cnVjdG9yXCIpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Ioc291cmNlLCBrZXkpO1xuICAgICAgaWYgKCFkZWZpbmVkW2tleV0pIHtcbiAgICAgICAgZGVmaW5lZFtrZXldID0gZGVzYy5nZXQgPyB7XG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgZ2V0OiByZXNvbHZlU291cmNlcy5iaW5kKHNvdXJjZXNNYXBba2V5XSA9IFtkZXNjLmdldC5iaW5kKHNvdXJjZSldKVxuICAgICAgICB9IDogZGVzYy52YWx1ZSAhPT0gdW5kZWZpbmVkID8gZGVzYyA6IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZXMgPSBzb3VyY2VzTWFwW2tleV07XG4gICAgICAgIGlmIChzb3VyY2VzKSB7XG4gICAgICAgICAgaWYgKGRlc2MuZ2V0KSBzb3VyY2VzLnB1c2goZGVzYy5nZXQuYmluZChzb3VyY2UpKTtlbHNlIGlmIChkZXNjLnZhbHVlICE9PSB1bmRlZmluZWQpIHNvdXJjZXMucHVzaCgoKSA9PiBkZXNjLnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBjb25zdCB0YXJnZXQgPSB7fTtcbiAgY29uc3QgZGVmaW5lZEtleXMgPSBPYmplY3Qua2V5cyhkZWZpbmVkKTtcbiAgZm9yIChsZXQgaSA9IGRlZmluZWRLZXlzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3Qga2V5ID0gZGVmaW5lZEtleXNbaV0sXG4gICAgICBkZXNjID0gZGVmaW5lZFtrZXldO1xuICAgIGlmIChkZXNjICYmIGRlc2MuZ2V0KSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIGRlc2MpO2Vsc2UgdGFyZ2V0W2tleV0gPSBkZXNjID8gZGVzYy52YWx1ZSA6IHVuZGVmaW5lZDtcbiAgfVxuICByZXR1cm4gdGFyZ2V0O1xufVxuZnVuY3Rpb24gc3BsaXRQcm9wcyhwcm9wcywgLi4ua2V5cykge1xuICBpZiAoU1VQUE9SVFNfUFJPWFkgJiYgJFBST1hZIGluIHByb3BzKSB7XG4gICAgY29uc3QgYmxvY2tlZCA9IG5ldyBTZXQoa2V5cy5sZW5ndGggPiAxID8ga2V5cy5mbGF0KCkgOiBrZXlzWzBdKTtcbiAgICBjb25zdCByZXMgPSBrZXlzLm1hcChrID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJveHkoe1xuICAgICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gay5pbmNsdWRlcyhwcm9wZXJ0eSkgPyBwcm9wc1twcm9wZXJ0eV0gOiB1bmRlZmluZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIGhhcyhwcm9wZXJ0eSkge1xuICAgICAgICAgIHJldHVybiBrLmluY2x1ZGVzKHByb3BlcnR5KSAmJiBwcm9wZXJ0eSBpbiBwcm9wcztcbiAgICAgICAgfSxcbiAgICAgICAga2V5cygpIHtcbiAgICAgICAgICByZXR1cm4gay5maWx0ZXIocHJvcGVydHkgPT4gcHJvcGVydHkgaW4gcHJvcHMpO1xuICAgICAgICB9XG4gICAgICB9LCBwcm9wVHJhcHMpO1xuICAgIH0pO1xuICAgIHJlcy5wdXNoKG5ldyBQcm94eSh7XG4gICAgICBnZXQocHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIGJsb2NrZWQuaGFzKHByb3BlcnR5KSA/IHVuZGVmaW5lZCA6IHByb3BzW3Byb3BlcnR5XTtcbiAgICAgIH0sXG4gICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgcmV0dXJuIGJsb2NrZWQuaGFzKHByb3BlcnR5KSA/IGZhbHNlIDogcHJvcGVydHkgaW4gcHJvcHM7XG4gICAgICB9LFxuICAgICAga2V5cygpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHByb3BzKS5maWx0ZXIoayA9PiAhYmxvY2tlZC5oYXMoaykpO1xuICAgICAgfVxuICAgIH0sIHByb3BUcmFwcykpO1xuICAgIHJldHVybiByZXM7XG4gIH1cbiAgY29uc3Qgb3RoZXJPYmplY3QgPSB7fTtcbiAgY29uc3Qgb2JqZWN0cyA9IGtleXMubWFwKCgpID0+ICh7fSkpO1xuICBmb3IgKGNvbnN0IHByb3BOYW1lIG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHByb3BzKSkge1xuICAgIGNvbnN0IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHByb3BzLCBwcm9wTmFtZSk7XG4gICAgY29uc3QgaXNEZWZhdWx0RGVzYyA9ICFkZXNjLmdldCAmJiAhZGVzYy5zZXQgJiYgZGVzYy5lbnVtZXJhYmxlICYmIGRlc2Mud3JpdGFibGUgJiYgZGVzYy5jb25maWd1cmFibGU7XG4gICAgbGV0IGJsb2NrZWQgPSBmYWxzZTtcbiAgICBsZXQgb2JqZWN0SW5kZXggPSAwO1xuICAgIGZvciAoY29uc3QgayBvZiBrZXlzKSB7XG4gICAgICBpZiAoay5pbmNsdWRlcyhwcm9wTmFtZSkpIHtcbiAgICAgICAgYmxvY2tlZCA9IHRydWU7XG4gICAgICAgIGlzRGVmYXVsdERlc2MgPyBvYmplY3RzW29iamVjdEluZGV4XVtwcm9wTmFtZV0gPSBkZXNjLnZhbHVlIDogT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iamVjdHNbb2JqZWN0SW5kZXhdLCBwcm9wTmFtZSwgZGVzYyk7XG4gICAgICB9XG4gICAgICArK29iamVjdEluZGV4O1xuICAgIH1cbiAgICBpZiAoIWJsb2NrZWQpIHtcbiAgICAgIGlzRGVmYXVsdERlc2MgPyBvdGhlck9iamVjdFtwcm9wTmFtZV0gPSBkZXNjLnZhbHVlIDogT2JqZWN0LmRlZmluZVByb3BlcnR5KG90aGVyT2JqZWN0LCBwcm9wTmFtZSwgZGVzYyk7XG4gICAgfVxuICB9XG4gIHJldHVybiBbLi4ub2JqZWN0cywgb3RoZXJPYmplY3RdO1xufVxuZnVuY3Rpb24gbGF6eShmbikge1xuICBsZXQgY29tcDtcbiAgbGV0IHA7XG4gIGNvbnN0IHdyYXAgPSBwcm9wcyA9PiB7XG4gICAgY29uc3QgY3R4ID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgaWYgKGN0eCkge1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoKTtcbiAgICAgIHNoYXJlZENvbmZpZy5jb3VudCB8fCAoc2hhcmVkQ29uZmlnLmNvdW50ID0gMCk7XG4gICAgICBzaGFyZWRDb25maWcuY291bnQrKztcbiAgICAgIChwIHx8IChwID0gZm4oKSkpLnRoZW4obW9kID0+IHtcbiAgICAgICAgIXNoYXJlZENvbmZpZy5kb25lICYmIHNldEh5ZHJhdGVDb250ZXh0KGN0eCk7XG4gICAgICAgIHNoYXJlZENvbmZpZy5jb3VudC0tO1xuICAgICAgICBzZXQoKCkgPT4gbW9kLmRlZmF1bHQpO1xuICAgICAgICBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICAgICAgfSk7XG4gICAgICBjb21wID0gcztcbiAgICB9IGVsc2UgaWYgKCFjb21wKSB7XG4gICAgICBjb25zdCBbc10gPSBjcmVhdGVSZXNvdXJjZSgoKSA9PiAocCB8fCAocCA9IGZuKCkpKS50aGVuKG1vZCA9PiBtb2QuZGVmYXVsdCkpO1xuICAgICAgY29tcCA9IHM7XG4gICAgfVxuICAgIGxldCBDb21wO1xuICAgIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IChDb21wID0gY29tcCgpKSA/IHVudHJhY2soKCkgPT4ge1xuICAgICAgaWYgKElTX0RFVikgT2JqZWN0LmFzc2lnbihDb21wLCB7XG4gICAgICAgIFskREVWQ09NUF06IHRydWVcbiAgICAgIH0pO1xuICAgICAgaWYgKCFjdHggfHwgc2hhcmVkQ29uZmlnLmRvbmUpIHJldHVybiBDb21wKHByb3BzKTtcbiAgICAgIGNvbnN0IGMgPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGN0eCk7XG4gICAgICBjb25zdCByID0gQ29tcChwcm9wcyk7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjKTtcbiAgICAgIHJldHVybiByO1xuICAgIH0pIDogXCJcIik7XG4gIH07XG4gIHdyYXAucHJlbG9hZCA9ICgpID0+IHAgfHwgKChwID0gZm4oKSkudGhlbihtb2QgPT4gY29tcCA9ICgpID0+IG1vZC5kZWZhdWx0KSwgcCk7XG4gIHJldHVybiB3cmFwO1xufVxubGV0IGNvdW50ZXIgPSAwO1xuZnVuY3Rpb24gY3JlYXRlVW5pcXVlSWQoKSB7XG4gIGNvbnN0IGN0eCA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICByZXR1cm4gY3R4ID8gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKSA6IGBjbC0ke2NvdW50ZXIrK31gO1xufVxuXG5jb25zdCBuYXJyb3dlZEVycm9yID0gbmFtZSA9PiBgQXR0ZW1wdGluZyB0byBhY2Nlc3MgYSBzdGFsZSB2YWx1ZSBmcm9tIDwke25hbWV9PiB0aGF0IGNvdWxkIHBvc3NpYmx5IGJlIHVuZGVmaW5lZC4gVGhpcyBtYXkgb2NjdXIgYmVjYXVzZSB5b3UgYXJlIHJlYWRpbmcgdGhlIGFjY2Vzc29yIHJldHVybmVkIGZyb20gdGhlIGNvbXBvbmVudCBhdCBhIHRpbWUgd2hlcmUgaXQgaGFzIGFscmVhZHkgYmVlbiB1bm1vdW50ZWQuIFdlIHJlY29tbWVuZCBjbGVhbmluZyB1cCBhbnkgc3RhbGUgdGltZXJzIG9yIGFzeW5jLCBvciByZWFkaW5nIGZyb20gdGhlIGluaXRpYWwgY29uZGl0aW9uLmAgO1xuZnVuY3Rpb24gRm9yKHByb3BzKSB7XG4gIGNvbnN0IGZhbGxiYWNrID0gXCJmYWxsYmFja1wiIGluIHByb3BzICYmIHtcbiAgICBmYWxsYmFjazogKCkgPT4gcHJvcHMuZmFsbGJhY2tcbiAgfTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8obWFwQXJyYXkoKCkgPT4gcHJvcHMuZWFjaCwgcHJvcHMuY2hpbGRyZW4sIGZhbGxiYWNrIHx8IHVuZGVmaW5lZCksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9KSA7XG59XG5mdW5jdGlvbiBJbmRleChwcm9wcykge1xuICBjb25zdCBmYWxsYmFjayA9IFwiZmFsbGJhY2tcIiBpbiBwcm9wcyAmJiB7XG4gICAgZmFsbGJhY2s6ICgpID0+IHByb3BzLmZhbGxiYWNrXG4gIH07XG4gIHJldHVybiBjcmVhdGVNZW1vKGluZGV4QXJyYXkoKCkgPT4gcHJvcHMuZWFjaCwgcHJvcHMuY2hpbGRyZW4sIGZhbGxiYWNrIHx8IHVuZGVmaW5lZCksIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9KSA7XG59XG5mdW5jdGlvbiBTaG93KHByb3BzKSB7XG4gIGNvbnN0IGtleWVkID0gcHJvcHMua2V5ZWQ7XG4gIGNvbnN0IGNvbmRpdGlvblZhbHVlID0gY3JlYXRlTWVtbygoKSA9PiBwcm9wcy53aGVuLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImNvbmRpdGlvbiB2YWx1ZVwiXG4gIH0gKTtcbiAgY29uc3QgY29uZGl0aW9uID0ga2V5ZWQgPyBjb25kaXRpb25WYWx1ZSA6IGNyZWF0ZU1lbW8oY29uZGl0aW9uVmFsdWUsIHVuZGVmaW5lZCwge1xuICAgIGVxdWFsczogKGEsIGIpID0+ICFhID09PSAhYixcbiAgICBuYW1lOiBcImNvbmRpdGlvblwiXG4gIH0gKTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGMgPSBjb25kaXRpb24oKTtcbiAgICBpZiAoYykge1xuICAgICAgY29uc3QgY2hpbGQgPSBwcm9wcy5jaGlsZHJlbjtcbiAgICAgIGNvbnN0IGZuID0gdHlwZW9mIGNoaWxkID09PSBcImZ1bmN0aW9uXCIgJiYgY2hpbGQubGVuZ3RoID4gMDtcbiAgICAgIHJldHVybiBmbiA/IHVudHJhY2soKCkgPT4gY2hpbGQoa2V5ZWQgPyBjIDogKCkgPT4ge1xuICAgICAgICBpZiAoIXVudHJhY2soY29uZGl0aW9uKSkgdGhyb3cgbmFycm93ZWRFcnJvcihcIlNob3dcIik7XG4gICAgICAgIHJldHVybiBjb25kaXRpb25WYWx1ZSgpO1xuICAgICAgfSkpIDogY2hpbGQ7XG4gICAgfVxuICAgIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJ2YWx1ZVwiXG4gIH0gKTtcbn1cbmZ1bmN0aW9uIFN3aXRjaChwcm9wcykge1xuICBjb25zdCBjaHMgPSBjaGlsZHJlbigoKSA9PiBwcm9wcy5jaGlsZHJlbik7XG4gIGNvbnN0IHN3aXRjaEZ1bmMgPSBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBjaCA9IGNocygpO1xuICAgIGNvbnN0IG1wcyA9IEFycmF5LmlzQXJyYXkoY2gpID8gY2ggOiBbY2hdO1xuICAgIGxldCBmdW5jID0gKCkgPT4gdW5kZWZpbmVkO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbmRleCA9IGk7XG4gICAgICBjb25zdCBtcCA9IG1wc1tpXTtcbiAgICAgIGNvbnN0IHByZXZGdW5jID0gZnVuYztcbiAgICAgIGNvbnN0IGNvbmRpdGlvblZhbHVlID0gY3JlYXRlTWVtbygoKSA9PiBwcmV2RnVuYygpID8gdW5kZWZpbmVkIDogbXAud2hlbiwgdW5kZWZpbmVkLCB7XG4gICAgICAgIG5hbWU6IFwiY29uZGl0aW9uIHZhbHVlXCJcbiAgICAgIH0gKTtcbiAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IG1wLmtleWVkID8gY29uZGl0aW9uVmFsdWUgOiBjcmVhdGVNZW1vKGNvbmRpdGlvblZhbHVlLCB1bmRlZmluZWQsIHtcbiAgICAgICAgZXF1YWxzOiAoYSwgYikgPT4gIWEgPT09ICFiLFxuICAgICAgICBuYW1lOiBcImNvbmRpdGlvblwiXG4gICAgICB9ICk7XG4gICAgICBmdW5jID0gKCkgPT4gcHJldkZ1bmMoKSB8fCAoY29uZGl0aW9uKCkgPyBbaW5kZXgsIGNvbmRpdGlvblZhbHVlLCBtcF0gOiB1bmRlZmluZWQpO1xuICAgIH1cbiAgICByZXR1cm4gZnVuYztcbiAgfSk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBzZWwgPSBzd2l0Y2hGdW5jKCkoKTtcbiAgICBpZiAoIXNlbCkgcmV0dXJuIHByb3BzLmZhbGxiYWNrO1xuICAgIGNvbnN0IFtpbmRleCwgY29uZGl0aW9uVmFsdWUsIG1wXSA9IHNlbDtcbiAgICBjb25zdCBjaGlsZCA9IG1wLmNoaWxkcmVuO1xuICAgIGNvbnN0IGZuID0gdHlwZW9mIGNoaWxkID09PSBcImZ1bmN0aW9uXCIgJiYgY2hpbGQubGVuZ3RoID4gMDtcbiAgICByZXR1cm4gZm4gPyB1bnRyYWNrKCgpID0+IGNoaWxkKG1wLmtleWVkID8gY29uZGl0aW9uVmFsdWUoKSA6ICgpID0+IHtcbiAgICAgIGlmICh1bnRyYWNrKHN3aXRjaEZ1bmMpKCk/LlswXSAhPT0gaW5kZXgpIHRocm93IG5hcnJvd2VkRXJyb3IoXCJNYXRjaFwiKTtcbiAgICAgIHJldHVybiBjb25kaXRpb25WYWx1ZSgpO1xuICAgIH0pKSA6IGNoaWxkO1xuICB9LCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImV2YWwgY29uZGl0aW9uc1wiXG4gIH0gKTtcbn1cbmZ1bmN0aW9uIE1hdGNoKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcztcbn1cbmxldCBFcnJvcnM7XG5mdW5jdGlvbiByZXNldEVycm9yQm91bmRhcmllcygpIHtcbiAgRXJyb3JzICYmIFsuLi5FcnJvcnNdLmZvckVhY2goZm4gPT4gZm4oKSk7XG59XG5mdW5jdGlvbiBFcnJvckJvdW5kYXJ5KHByb3BzKSB7XG4gIGxldCBlcnI7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCAmJiBzaGFyZWRDb25maWcubG9hZCkgZXJyID0gc2hhcmVkQ29uZmlnLmxvYWQoc2hhcmVkQ29uZmlnLmdldENvbnRleHRJZCgpKTtcbiAgY29uc3QgW2Vycm9yZWQsIHNldEVycm9yZWRdID0gY3JlYXRlU2lnbmFsKGVyciwge1xuICAgIG5hbWU6IFwiZXJyb3JlZFwiXG4gIH0gKTtcbiAgRXJyb3JzIHx8IChFcnJvcnMgPSBuZXcgU2V0KCkpO1xuICBFcnJvcnMuYWRkKHNldEVycm9yZWQpO1xuICBvbkNsZWFudXAoKCkgPT4gRXJyb3JzLmRlbGV0ZShzZXRFcnJvcmVkKSk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBsZXQgZTtcbiAgICBpZiAoZSA9IGVycm9yZWQoKSkge1xuICAgICAgY29uc3QgZiA9IHByb3BzLmZhbGxiYWNrO1xuICAgICAgaWYgKCh0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiIHx8IGYubGVuZ3RoID09IDApKSBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgcmV0dXJuIHR5cGVvZiBmID09PSBcImZ1bmN0aW9uXCIgJiYgZi5sZW5ndGggPyB1bnRyYWNrKCgpID0+IGYoZSwgKCkgPT4gc2V0RXJyb3JlZCgpKSkgOiBmO1xuICAgIH1cbiAgICByZXR1cm4gY2F0Y2hFcnJvcigoKSA9PiBwcm9wcy5jaGlsZHJlbiwgc2V0RXJyb3JlZCk7XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9ICk7XG59XG5cbmNvbnN0IHN1c3BlbnNlTGlzdEVxdWFscyA9IChhLCBiKSA9PiBhLnNob3dDb250ZW50ID09PSBiLnNob3dDb250ZW50ICYmIGEuc2hvd0ZhbGxiYWNrID09PSBiLnNob3dGYWxsYmFjaztcbmNvbnN0IFN1c3BlbnNlTGlzdENvbnRleHQgPSAvKiAjX19QVVJFX18gKi9jcmVhdGVDb250ZXh0KCk7XG5mdW5jdGlvbiBTdXNwZW5zZUxpc3QocHJvcHMpIHtcbiAgbGV0IFt3cmFwcGVyLCBzZXRXcmFwcGVyXSA9IGNyZWF0ZVNpZ25hbCgoKSA9PiAoe1xuICAgICAgaW5GYWxsYmFjazogZmFsc2VcbiAgICB9KSksXG4gICAgc2hvdztcbiAgY29uc3QgbGlzdENvbnRleHQgPSB1c2VDb250ZXh0KFN1c3BlbnNlTGlzdENvbnRleHQpO1xuICBjb25zdCBbcmVnaXN0cnksIHNldFJlZ2lzdHJ5XSA9IGNyZWF0ZVNpZ25hbChbXSk7XG4gIGlmIChsaXN0Q29udGV4dCkge1xuICAgIHNob3cgPSBsaXN0Q29udGV4dC5yZWdpc3RlcihjcmVhdGVNZW1vKCgpID0+IHdyYXBwZXIoKSgpLmluRmFsbGJhY2spKTtcbiAgfVxuICBjb25zdCByZXNvbHZlZCA9IGNyZWF0ZU1lbW8ocHJldiA9PiB7XG4gICAgY29uc3QgcmV2ZWFsID0gcHJvcHMucmV2ZWFsT3JkZXIsXG4gICAgICB0YWlsID0gcHJvcHMudGFpbCxcbiAgICAgIHtcbiAgICAgICAgc2hvd0NvbnRlbnQgPSB0cnVlLFxuICAgICAgICBzaG93RmFsbGJhY2sgPSB0cnVlXG4gICAgICB9ID0gc2hvdyA/IHNob3coKSA6IHt9LFxuICAgICAgcmVnID0gcmVnaXN0cnkoKSxcbiAgICAgIHJldmVyc2UgPSByZXZlYWwgPT09IFwiYmFja3dhcmRzXCI7XG4gICAgaWYgKHJldmVhbCA9PT0gXCJ0b2dldGhlclwiKSB7XG4gICAgICBjb25zdCBhbGwgPSByZWcuZXZlcnkoaW5GYWxsYmFjayA9PiAhaW5GYWxsYmFjaygpKTtcbiAgICAgIGNvbnN0IHJlcyA9IHJlZy5tYXAoKCkgPT4gKHtcbiAgICAgICAgc2hvd0NvbnRlbnQ6IGFsbCAmJiBzaG93Q29udGVudCxcbiAgICAgICAgc2hvd0ZhbGxiYWNrXG4gICAgICB9KSk7XG4gICAgICByZXMuaW5GYWxsYmFjayA9ICFhbGw7XG4gICAgICByZXR1cm4gcmVzO1xuICAgIH1cbiAgICBsZXQgc3RvcCA9IGZhbHNlO1xuICAgIGxldCBpbkZhbGxiYWNrID0gcHJldi5pbkZhbGxiYWNrO1xuICAgIGNvbnN0IHJlcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSByZWcubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGNvbnN0IG4gPSByZXZlcnNlID8gbGVuIC0gaSAtIDEgOiBpLFxuICAgICAgICBzID0gcmVnW25dKCk7XG4gICAgICBpZiAoIXN0b3AgJiYgIXMpIHtcbiAgICAgICAgcmVzW25dID0ge1xuICAgICAgICAgIHNob3dDb250ZW50LFxuICAgICAgICAgIHNob3dGYWxsYmFja1xuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV4dCA9ICFzdG9wO1xuICAgICAgICBpZiAobmV4dCkgaW5GYWxsYmFjayA9IHRydWU7XG4gICAgICAgIHJlc1tuXSA9IHtcbiAgICAgICAgICBzaG93Q29udGVudDogbmV4dCxcbiAgICAgICAgICBzaG93RmFsbGJhY2s6ICF0YWlsIHx8IG5leHQgJiYgdGFpbCA9PT0gXCJjb2xsYXBzZWRcIiA/IHNob3dGYWxsYmFjayA6IGZhbHNlXG4gICAgICAgIH07XG4gICAgICAgIHN0b3AgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXN0b3ApIGluRmFsbGJhY2sgPSBmYWxzZTtcbiAgICByZXMuaW5GYWxsYmFjayA9IGluRmFsbGJhY2s7XG4gICAgcmV0dXJuIHJlcztcbiAgfSwge1xuICAgIGluRmFsbGJhY2s6IGZhbHNlXG4gIH0pO1xuICBzZXRXcmFwcGVyKCgpID0+IHJlc29sdmVkKTtcbiAgcmV0dXJuIGNyZWF0ZUNvbXBvbmVudChTdXNwZW5zZUxpc3RDb250ZXh0LlByb3ZpZGVyLCB7XG4gICAgdmFsdWU6IHtcbiAgICAgIHJlZ2lzdGVyOiBpbkZhbGxiYWNrID0+IHtcbiAgICAgICAgbGV0IGluZGV4O1xuICAgICAgICBzZXRSZWdpc3RyeShyZWdpc3RyeSA9PiB7XG4gICAgICAgICAgaW5kZXggPSByZWdpc3RyeS5sZW5ndGg7XG4gICAgICAgICAgcmV0dXJuIFsuLi5yZWdpc3RyeSwgaW5GYWxsYmFja107XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiByZXNvbHZlZCgpW2luZGV4XSwgdW5kZWZpbmVkLCB7XG4gICAgICAgICAgZXF1YWxzOiBzdXNwZW5zZUxpc3RFcXVhbHNcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgICBnZXQgY2hpbGRyZW4oKSB7XG4gICAgICByZXR1cm4gcHJvcHMuY2hpbGRyZW47XG4gICAgfVxuICB9KTtcbn1cbmZ1bmN0aW9uIFN1c3BlbnNlKHByb3BzKSB7XG4gIGxldCBjb3VudGVyID0gMCxcbiAgICBzaG93LFxuICAgIGN0eCxcbiAgICBwLFxuICAgIGZsaWNrZXIsXG4gICAgZXJyb3I7XG4gIGNvbnN0IFtpbkZhbGxiYWNrLCBzZXRGYWxsYmFja10gPSBjcmVhdGVTaWduYWwoZmFsc2UpLFxuICAgIFN1c3BlbnNlQ29udGV4dCA9IGdldFN1c3BlbnNlQ29udGV4dCgpLFxuICAgIHN0b3JlID0ge1xuICAgICAgaW5jcmVtZW50OiAoKSA9PiB7XG4gICAgICAgIGlmICgrK2NvdW50ZXIgPT09IDEpIHNldEZhbGxiYWNrKHRydWUpO1xuICAgICAgfSxcbiAgICAgIGRlY3JlbWVudDogKCkgPT4ge1xuICAgICAgICBpZiAoLS1jb3VudGVyID09PSAwKSBzZXRGYWxsYmFjayhmYWxzZSk7XG4gICAgICB9LFxuICAgICAgaW5GYWxsYmFjayxcbiAgICAgIGVmZmVjdHM6IFtdLFxuICAgICAgcmVzb2x2ZWQ6IGZhbHNlXG4gICAgfSxcbiAgICBvd25lciA9IGdldE93bmVyKCk7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCAmJiBzaGFyZWRDb25maWcubG9hZCkge1xuICAgIGNvbnN0IGtleSA9IHNoYXJlZENvbmZpZy5nZXRDb250ZXh0SWQoKTtcbiAgICBsZXQgcmVmID0gc2hhcmVkQ29uZmlnLmxvYWQoa2V5KTtcbiAgICBpZiAocmVmKSB7XG4gICAgICBpZiAodHlwZW9mIHJlZiAhPT0gXCJvYmplY3RcIiB8fCByZWYucyAhPT0gMSkgcCA9IHJlZjtlbHNlIHNoYXJlZENvbmZpZy5nYXRoZXIoa2V5KTtcbiAgICB9XG4gICAgaWYgKHAgJiYgcCAhPT0gXCIkJGZcIikge1xuICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICAgIGVxdWFsczogZmFsc2VcbiAgICAgIH0pO1xuICAgICAgZmxpY2tlciA9IHM7XG4gICAgICBwLnRoZW4oKCkgPT4ge1xuICAgICAgICBpZiAoc2hhcmVkQ29uZmlnLmRvbmUpIHJldHVybiBzZXQoKTtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmdhdGhlcihrZXkpO1xuICAgICAgICBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgICBzZXQoKTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgIH0sIGVyciA9PiB7XG4gICAgICAgIGVycm9yID0gZXJyO1xuICAgICAgICBzZXQoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBjb25zdCBsaXN0Q29udGV4dCA9IHVzZUNvbnRleHQoU3VzcGVuc2VMaXN0Q29udGV4dCk7XG4gIGlmIChsaXN0Q29udGV4dCkgc2hvdyA9IGxpc3RDb250ZXh0LnJlZ2lzdGVyKHN0b3JlLmluRmFsbGJhY2spO1xuICBsZXQgZGlzcG9zZTtcbiAgb25DbGVhbnVwKCgpID0+IGRpc3Bvc2UgJiYgZGlzcG9zZSgpKTtcbiAgcmV0dXJuIGNyZWF0ZUNvbXBvbmVudChTdXNwZW5zZUNvbnRleHQuUHJvdmlkZXIsIHtcbiAgICB2YWx1ZTogc3RvcmUsXG4gICAgZ2V0IGNoaWxkcmVuKCkge1xuICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHRocm93IGVycm9yO1xuICAgICAgICBjdHggPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICAgICAgaWYgKGZsaWNrZXIpIHtcbiAgICAgICAgICBmbGlja2VyKCk7XG4gICAgICAgICAgcmV0dXJuIGZsaWNrZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN0eCAmJiBwID09PSBcIiQkZlwiKSBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICAgICAgICBjb25zdCByZW5kZXJlZCA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICAgICAgICByZXR1cm4gY3JlYXRlTWVtbyhwcmV2ID0+IHtcbiAgICAgICAgICBjb25zdCBpbkZhbGxiYWNrID0gc3RvcmUuaW5GYWxsYmFjaygpLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzaG93Q29udGVudCA9IHRydWUsXG4gICAgICAgICAgICAgIHNob3dGYWxsYmFjayA9IHRydWVcbiAgICAgICAgICAgIH0gPSBzaG93ID8gc2hvdygpIDoge307XG4gICAgICAgICAgaWYgKCghaW5GYWxsYmFjayB8fCBwICYmIHAgIT09IFwiJCRmXCIpICYmIHNob3dDb250ZW50KSB7XG4gICAgICAgICAgICBzdG9yZS5yZXNvbHZlZCA9IHRydWU7XG4gICAgICAgICAgICBkaXNwb3NlICYmIGRpc3Bvc2UoKTtcbiAgICAgICAgICAgIGRpc3Bvc2UgPSBjdHggPSBwID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgcmVzdW1lRWZmZWN0cyhzdG9yZS5lZmZlY3RzKTtcbiAgICAgICAgICAgIHJldHVybiByZW5kZXJlZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXNob3dGYWxsYmFjaykgcmV0dXJuO1xuICAgICAgICAgIGlmIChkaXNwb3NlKSByZXR1cm4gcHJldjtcbiAgICAgICAgICByZXR1cm4gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgICAgICBkaXNwb3NlID0gZGlzcG9zZXI7XG4gICAgICAgICAgICBpZiAoY3R4KSB7XG4gICAgICAgICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KHtcbiAgICAgICAgICAgICAgICBpZDogY3R4LmlkICsgXCJGXCIsXG4gICAgICAgICAgICAgICAgY291bnQ6IDBcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGN0eCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgICAgICAgICB9LCBvd25lcik7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcbn1cblxuY29uc3QgREVWID0ge1xuICBob29rczogRGV2SG9va3MsXG4gIHdyaXRlU2lnbmFsLFxuICByZWdpc3RlckdyYXBoXG59IDtcbmlmIChnbG9iYWxUaGlzKSB7XG4gIGlmICghZ2xvYmFsVGhpcy5Tb2xpZCQkKSBnbG9iYWxUaGlzLlNvbGlkJCQgPSB0cnVlO2Vsc2UgY29uc29sZS53YXJuKFwiWW91IGFwcGVhciB0byBoYXZlIG11bHRpcGxlIGluc3RhbmNlcyBvZiBTb2xpZC4gVGhpcyBjYW4gbGVhZCB0byB1bmV4cGVjdGVkIGJlaGF2aW9yLlwiKTtcbn1cblxuZXhwb3J0IHsgJERFVkNPTVAsICRQUk9YWSwgJFRSQUNLLCBERVYsIEVycm9yQm91bmRhcnksIEZvciwgSW5kZXgsIE1hdGNoLCBTaG93LCBTdXNwZW5zZSwgU3VzcGVuc2VMaXN0LCBTd2l0Y2gsIGJhdGNoLCBjYW5jZWxDYWxsYmFjaywgY2F0Y2hFcnJvciwgY2hpbGRyZW4sIGNyZWF0ZUNvbXBvbmVudCwgY3JlYXRlQ29tcHV0ZWQsIGNyZWF0ZUNvbnRleHQsIGNyZWF0ZURlZmVycmVkLCBjcmVhdGVFZmZlY3QsIGNyZWF0ZU1lbW8sIGNyZWF0ZVJlYWN0aW9uLCBjcmVhdGVSZW5kZXJFZmZlY3QsIGNyZWF0ZVJlc291cmNlLCBjcmVhdGVSb290LCBjcmVhdGVTZWxlY3RvciwgY3JlYXRlU2lnbmFsLCBjcmVhdGVVbmlxdWVJZCwgZW5hYmxlRXh0ZXJuYWxTb3VyY2UsIGVuYWJsZUh5ZHJhdGlvbiwgZW5hYmxlU2NoZWR1bGluZywgZXF1YWxGbiwgZnJvbSwgZ2V0TGlzdGVuZXIsIGdldE93bmVyLCBpbmRleEFycmF5LCBsYXp5LCBtYXBBcnJheSwgbWVyZ2VQcm9wcywgb2JzZXJ2YWJsZSwgb24sIG9uQ2xlYW51cCwgb25FcnJvciwgb25Nb3VudCwgcmVxdWVzdENhbGxiYWNrLCByZXNldEVycm9yQm91bmRhcmllcywgcnVuV2l0aE93bmVyLCBzaGFyZWRDb25maWcsIHNwbGl0UHJvcHMsIHN0YXJ0VHJhbnNpdGlvbiwgdW50cmFjaywgdXNlQ29udGV4dCwgdXNlVHJhbnNpdGlvbiB9O1xuIiwiaW1wb3J0IHsgY3JlYXRlTWVtbywgY3JlYXRlUm9vdCwgY3JlYXRlUmVuZGVyRWZmZWN0LCB1bnRyYWNrLCBzaGFyZWRDb25maWcsIGVuYWJsZUh5ZHJhdGlvbiwgZ2V0T3duZXIsIGNyZWF0ZUVmZmVjdCwgcnVuV2l0aE93bmVyLCBjcmVhdGVTaWduYWwsIG9uQ2xlYW51cCwgJERFVkNPTVAsIHNwbGl0UHJvcHMgfSBmcm9tICdzb2xpZC1qcyc7XG5leHBvcnQgeyBFcnJvckJvdW5kYXJ5LCBGb3IsIEluZGV4LCBNYXRjaCwgU2hvdywgU3VzcGVuc2UsIFN1c3BlbnNlTGlzdCwgU3dpdGNoLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZVJlbmRlckVmZmVjdCBhcyBlZmZlY3QsIGdldE93bmVyLCBtZXJnZVByb3BzLCB1bnRyYWNrIH0gZnJvbSAnc29saWQtanMnO1xuXG5jb25zdCBib29sZWFucyA9IFtcImFsbG93ZnVsbHNjcmVlblwiLCBcImFzeW5jXCIsIFwiYXV0b2ZvY3VzXCIsIFwiYXV0b3BsYXlcIiwgXCJjaGVja2VkXCIsIFwiY29udHJvbHNcIiwgXCJkZWZhdWx0XCIsIFwiZGlzYWJsZWRcIiwgXCJmb3Jtbm92YWxpZGF0ZVwiLCBcImhpZGRlblwiLCBcImluZGV0ZXJtaW5hdGVcIiwgXCJpbmVydFwiLCBcImlzbWFwXCIsIFwibG9vcFwiLCBcIm11bHRpcGxlXCIsIFwibXV0ZWRcIiwgXCJub21vZHVsZVwiLCBcIm5vdmFsaWRhdGVcIiwgXCJvcGVuXCIsIFwicGxheXNpbmxpbmVcIiwgXCJyZWFkb25seVwiLCBcInJlcXVpcmVkXCIsIFwicmV2ZXJzZWRcIiwgXCJzZWFtbGVzc1wiLCBcInNlbGVjdGVkXCJdO1xuY29uc3QgUHJvcGVydGllcyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImNsYXNzTmFtZVwiLCBcInZhbHVlXCIsIFwicmVhZE9ubHlcIiwgXCJub1ZhbGlkYXRlXCIsIFwiZm9ybU5vVmFsaWRhdGVcIiwgXCJpc01hcFwiLCBcIm5vTW9kdWxlXCIsIFwicGxheXNJbmxpbmVcIiwgLi4uYm9vbGVhbnNdKTtcbmNvbnN0IENoaWxkUHJvcGVydGllcyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImlubmVySFRNTFwiLCBcInRleHRDb250ZW50XCIsIFwiaW5uZXJUZXh0XCIsIFwiY2hpbGRyZW5cIl0pO1xuY29uc3QgQWxpYXNlcyA9IC8qI19fUFVSRV9fKi9PYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUobnVsbCksIHtcbiAgY2xhc3NOYW1lOiBcImNsYXNzXCIsXG4gIGh0bWxGb3I6IFwiZm9yXCJcbn0pO1xuY29uc3QgUHJvcEFsaWFzZXMgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmFzc2lnbihPYmplY3QuY3JlYXRlKG51bGwpLCB7XG4gIGNsYXNzOiBcImNsYXNzTmFtZVwiLFxuICBub3ZhbGlkYXRlOiB7XG4gICAgJDogXCJub1ZhbGlkYXRlXCIsXG4gICAgRk9STTogMVxuICB9LFxuICBmb3Jtbm92YWxpZGF0ZToge1xuICAgICQ6IFwiZm9ybU5vVmFsaWRhdGVcIixcbiAgICBCVVRUT046IDEsXG4gICAgSU5QVVQ6IDFcbiAgfSxcbiAgaXNtYXA6IHtcbiAgICAkOiBcImlzTWFwXCIsXG4gICAgSU1HOiAxXG4gIH0sXG4gIG5vbW9kdWxlOiB7XG4gICAgJDogXCJub01vZHVsZVwiLFxuICAgIFNDUklQVDogMVxuICB9LFxuICBwbGF5c2lubGluZToge1xuICAgICQ6IFwicGxheXNJbmxpbmVcIixcbiAgICBWSURFTzogMVxuICB9LFxuICByZWFkb25seToge1xuICAgICQ6IFwicmVhZE9ubHlcIixcbiAgICBJTlBVVDogMSxcbiAgICBURVhUQVJFQTogMVxuICB9XG59KTtcbmZ1bmN0aW9uIGdldFByb3BBbGlhcyhwcm9wLCB0YWdOYW1lKSB7XG4gIGNvbnN0IGEgPSBQcm9wQWxpYXNlc1twcm9wXTtcbiAgcmV0dXJuIHR5cGVvZiBhID09PSBcIm9iamVjdFwiID8gYVt0YWdOYW1lXSA/IGFbXCIkXCJdIDogdW5kZWZpbmVkIDogYTtcbn1cbmNvbnN0IERlbGVnYXRlZEV2ZW50cyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImJlZm9yZWlucHV0XCIsIFwiY2xpY2tcIiwgXCJkYmxjbGlja1wiLCBcImNvbnRleHRtZW51XCIsIFwiZm9jdXNpblwiLCBcImZvY3Vzb3V0XCIsIFwiaW5wdXRcIiwgXCJrZXlkb3duXCIsIFwia2V5dXBcIiwgXCJtb3VzZWRvd25cIiwgXCJtb3VzZW1vdmVcIiwgXCJtb3VzZW91dFwiLCBcIm1vdXNlb3ZlclwiLCBcIm1vdXNldXBcIiwgXCJwb2ludGVyZG93blwiLCBcInBvaW50ZXJtb3ZlXCIsIFwicG9pbnRlcm91dFwiLCBcInBvaW50ZXJvdmVyXCIsIFwicG9pbnRlcnVwXCIsIFwidG91Y2hlbmRcIiwgXCJ0b3VjaG1vdmVcIiwgXCJ0b3VjaHN0YXJ0XCJdKTtcbmNvbnN0IFNWR0VsZW1lbnRzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1xuXCJhbHRHbHlwaFwiLCBcImFsdEdseXBoRGVmXCIsIFwiYWx0R2x5cGhJdGVtXCIsIFwiYW5pbWF0ZVwiLCBcImFuaW1hdGVDb2xvclwiLCBcImFuaW1hdGVNb3Rpb25cIiwgXCJhbmltYXRlVHJhbnNmb3JtXCIsIFwiY2lyY2xlXCIsIFwiY2xpcFBhdGhcIiwgXCJjb2xvci1wcm9maWxlXCIsIFwiY3Vyc29yXCIsIFwiZGVmc1wiLCBcImRlc2NcIiwgXCJlbGxpcHNlXCIsIFwiZmVCbGVuZFwiLCBcImZlQ29sb3JNYXRyaXhcIiwgXCJmZUNvbXBvbmVudFRyYW5zZmVyXCIsIFwiZmVDb21wb3NpdGVcIiwgXCJmZUNvbnZvbHZlTWF0cml4XCIsIFwiZmVEaWZmdXNlTGlnaHRpbmdcIiwgXCJmZURpc3BsYWNlbWVudE1hcFwiLCBcImZlRGlzdGFudExpZ2h0XCIsIFwiZmVEcm9wU2hhZG93XCIsIFwiZmVGbG9vZFwiLCBcImZlRnVuY0FcIiwgXCJmZUZ1bmNCXCIsIFwiZmVGdW5jR1wiLCBcImZlRnVuY1JcIiwgXCJmZUdhdXNzaWFuQmx1clwiLCBcImZlSW1hZ2VcIiwgXCJmZU1lcmdlXCIsIFwiZmVNZXJnZU5vZGVcIiwgXCJmZU1vcnBob2xvZ3lcIiwgXCJmZU9mZnNldFwiLCBcImZlUG9pbnRMaWdodFwiLCBcImZlU3BlY3VsYXJMaWdodGluZ1wiLCBcImZlU3BvdExpZ2h0XCIsIFwiZmVUaWxlXCIsIFwiZmVUdXJidWxlbmNlXCIsIFwiZmlsdGVyXCIsIFwiZm9udFwiLCBcImZvbnQtZmFjZVwiLCBcImZvbnQtZmFjZS1mb3JtYXRcIiwgXCJmb250LWZhY2UtbmFtZVwiLCBcImZvbnQtZmFjZS1zcmNcIiwgXCJmb250LWZhY2UtdXJpXCIsIFwiZm9yZWlnbk9iamVjdFwiLCBcImdcIiwgXCJnbHlwaFwiLCBcImdseXBoUmVmXCIsIFwiaGtlcm5cIiwgXCJpbWFnZVwiLCBcImxpbmVcIiwgXCJsaW5lYXJHcmFkaWVudFwiLCBcIm1hcmtlclwiLCBcIm1hc2tcIiwgXCJtZXRhZGF0YVwiLCBcIm1pc3NpbmctZ2x5cGhcIiwgXCJtcGF0aFwiLCBcInBhdGhcIiwgXCJwYXR0ZXJuXCIsIFwicG9seWdvblwiLCBcInBvbHlsaW5lXCIsIFwicmFkaWFsR3JhZGllbnRcIiwgXCJyZWN0XCIsXG5cInNldFwiLCBcInN0b3BcIixcblwic3ZnXCIsIFwic3dpdGNoXCIsIFwic3ltYm9sXCIsIFwidGV4dFwiLCBcInRleHRQYXRoXCIsXG5cInRyZWZcIiwgXCJ0c3BhblwiLCBcInVzZVwiLCBcInZpZXdcIiwgXCJ2a2VyblwiXSk7XG5jb25zdCBTVkdOYW1lc3BhY2UgPSB7XG4gIHhsaW5rOiBcImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIixcbiAgeG1sOiBcImh0dHA6Ly93d3cudzMub3JnL1hNTC8xOTk4L25hbWVzcGFjZVwiXG59O1xuY29uc3QgRE9NRWxlbWVudHMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJodG1sXCIsIFwiYmFzZVwiLCBcImhlYWRcIiwgXCJsaW5rXCIsIFwibWV0YVwiLCBcInN0eWxlXCIsIFwidGl0bGVcIiwgXCJib2R5XCIsIFwiYWRkcmVzc1wiLCBcImFydGljbGVcIiwgXCJhc2lkZVwiLCBcImZvb3RlclwiLCBcImhlYWRlclwiLCBcIm1haW5cIiwgXCJuYXZcIiwgXCJzZWN0aW9uXCIsIFwiYm9keVwiLCBcImJsb2NrcXVvdGVcIiwgXCJkZFwiLCBcImRpdlwiLCBcImRsXCIsIFwiZHRcIiwgXCJmaWdjYXB0aW9uXCIsIFwiZmlndXJlXCIsIFwiaHJcIiwgXCJsaVwiLCBcIm9sXCIsIFwicFwiLCBcInByZVwiLCBcInVsXCIsIFwiYVwiLCBcImFiYnJcIiwgXCJiXCIsIFwiYmRpXCIsIFwiYmRvXCIsIFwiYnJcIiwgXCJjaXRlXCIsIFwiY29kZVwiLCBcImRhdGFcIiwgXCJkZm5cIiwgXCJlbVwiLCBcImlcIiwgXCJrYmRcIiwgXCJtYXJrXCIsIFwicVwiLCBcInJwXCIsIFwicnRcIiwgXCJydWJ5XCIsIFwic1wiLCBcInNhbXBcIiwgXCJzbWFsbFwiLCBcInNwYW5cIiwgXCJzdHJvbmdcIiwgXCJzdWJcIiwgXCJzdXBcIiwgXCJ0aW1lXCIsIFwidVwiLCBcInZhclwiLCBcIndiclwiLCBcImFyZWFcIiwgXCJhdWRpb1wiLCBcImltZ1wiLCBcIm1hcFwiLCBcInRyYWNrXCIsIFwidmlkZW9cIiwgXCJlbWJlZFwiLCBcImlmcmFtZVwiLCBcIm9iamVjdFwiLCBcInBhcmFtXCIsIFwicGljdHVyZVwiLCBcInBvcnRhbFwiLCBcInNvdXJjZVwiLCBcInN2Z1wiLCBcIm1hdGhcIiwgXCJjYW52YXNcIiwgXCJub3NjcmlwdFwiLCBcInNjcmlwdFwiLCBcImRlbFwiLCBcImluc1wiLCBcImNhcHRpb25cIiwgXCJjb2xcIiwgXCJjb2xncm91cFwiLCBcInRhYmxlXCIsIFwidGJvZHlcIiwgXCJ0ZFwiLCBcInRmb290XCIsIFwidGhcIiwgXCJ0aGVhZFwiLCBcInRyXCIsIFwiYnV0dG9uXCIsIFwiZGF0YWxpc3RcIiwgXCJmaWVsZHNldFwiLCBcImZvcm1cIiwgXCJpbnB1dFwiLCBcImxhYmVsXCIsIFwibGVnZW5kXCIsIFwibWV0ZXJcIiwgXCJvcHRncm91cFwiLCBcIm9wdGlvblwiLCBcIm91dHB1dFwiLCBcInByb2dyZXNzXCIsIFwic2VsZWN0XCIsIFwidGV4dGFyZWFcIiwgXCJkZXRhaWxzXCIsIFwiZGlhbG9nXCIsIFwibWVudVwiLCBcInN1bW1hcnlcIiwgXCJkZXRhaWxzXCIsIFwic2xvdFwiLCBcInRlbXBsYXRlXCIsIFwiYWNyb255bVwiLCBcImFwcGxldFwiLCBcImJhc2Vmb250XCIsIFwiYmdzb3VuZFwiLCBcImJpZ1wiLCBcImJsaW5rXCIsIFwiY2VudGVyXCIsIFwiY29udGVudFwiLCBcImRpclwiLCBcImZvbnRcIiwgXCJmcmFtZVwiLCBcImZyYW1lc2V0XCIsIFwiaGdyb3VwXCIsIFwiaW1hZ2VcIiwgXCJrZXlnZW5cIiwgXCJtYXJxdWVlXCIsIFwibWVudWl0ZW1cIiwgXCJub2JyXCIsIFwibm9lbWJlZFwiLCBcIm5vZnJhbWVzXCIsIFwicGxhaW50ZXh0XCIsIFwicmJcIiwgXCJydGNcIiwgXCJzaGFkb3dcIiwgXCJzcGFjZXJcIiwgXCJzdHJpa2VcIiwgXCJ0dFwiLCBcInhtcFwiLCBcImFcIiwgXCJhYmJyXCIsIFwiYWNyb255bVwiLCBcImFkZHJlc3NcIiwgXCJhcHBsZXRcIiwgXCJhcmVhXCIsIFwiYXJ0aWNsZVwiLCBcImFzaWRlXCIsIFwiYXVkaW9cIiwgXCJiXCIsIFwiYmFzZVwiLCBcImJhc2Vmb250XCIsIFwiYmRpXCIsIFwiYmRvXCIsIFwiYmdzb3VuZFwiLCBcImJpZ1wiLCBcImJsaW5rXCIsIFwiYmxvY2txdW90ZVwiLCBcImJvZHlcIiwgXCJiclwiLCBcImJ1dHRvblwiLCBcImNhbnZhc1wiLCBcImNhcHRpb25cIiwgXCJjZW50ZXJcIiwgXCJjaXRlXCIsIFwiY29kZVwiLCBcImNvbFwiLCBcImNvbGdyb3VwXCIsIFwiY29udGVudFwiLCBcImRhdGFcIiwgXCJkYXRhbGlzdFwiLCBcImRkXCIsIFwiZGVsXCIsIFwiZGV0YWlsc1wiLCBcImRmblwiLCBcImRpYWxvZ1wiLCBcImRpclwiLCBcImRpdlwiLCBcImRsXCIsIFwiZHRcIiwgXCJlbVwiLCBcImVtYmVkXCIsIFwiZmllbGRzZXRcIiwgXCJmaWdjYXB0aW9uXCIsIFwiZmlndXJlXCIsIFwiZm9udFwiLCBcImZvb3RlclwiLCBcImZvcm1cIiwgXCJmcmFtZVwiLCBcImZyYW1lc2V0XCIsIFwiaGVhZFwiLCBcImhlYWRlclwiLCBcImhncm91cFwiLCBcImhyXCIsIFwiaHRtbFwiLCBcImlcIiwgXCJpZnJhbWVcIiwgXCJpbWFnZVwiLCBcImltZ1wiLCBcImlucHV0XCIsIFwiaW5zXCIsIFwia2JkXCIsIFwia2V5Z2VuXCIsIFwibGFiZWxcIiwgXCJsZWdlbmRcIiwgXCJsaVwiLCBcImxpbmtcIiwgXCJtYWluXCIsIFwibWFwXCIsIFwibWFya1wiLCBcIm1hcnF1ZWVcIiwgXCJtZW51XCIsIFwibWVudWl0ZW1cIiwgXCJtZXRhXCIsIFwibWV0ZXJcIiwgXCJuYXZcIiwgXCJub2JyXCIsIFwibm9lbWJlZFwiLCBcIm5vZnJhbWVzXCIsIFwibm9zY3JpcHRcIiwgXCJvYmplY3RcIiwgXCJvbFwiLCBcIm9wdGdyb3VwXCIsIFwib3B0aW9uXCIsIFwib3V0cHV0XCIsIFwicFwiLCBcInBhcmFtXCIsIFwicGljdHVyZVwiLCBcInBsYWludGV4dFwiLCBcInBvcnRhbFwiLCBcInByZVwiLCBcInByb2dyZXNzXCIsIFwicVwiLCBcInJiXCIsIFwicnBcIiwgXCJydFwiLCBcInJ0Y1wiLCBcInJ1YnlcIiwgXCJzXCIsIFwic2FtcFwiLCBcInNjcmlwdFwiLCBcInNlY3Rpb25cIiwgXCJzZWxlY3RcIiwgXCJzaGFkb3dcIiwgXCJzbG90XCIsIFwic21hbGxcIiwgXCJzb3VyY2VcIiwgXCJzcGFjZXJcIiwgXCJzcGFuXCIsIFwic3RyaWtlXCIsIFwic3Ryb25nXCIsIFwic3R5bGVcIiwgXCJzdWJcIiwgXCJzdW1tYXJ5XCIsIFwic3VwXCIsIFwidGFibGVcIiwgXCJ0Ym9keVwiLCBcInRkXCIsIFwidGVtcGxhdGVcIiwgXCJ0ZXh0YXJlYVwiLCBcInRmb290XCIsIFwidGhcIiwgXCJ0aGVhZFwiLCBcInRpbWVcIiwgXCJ0aXRsZVwiLCBcInRyXCIsIFwidHJhY2tcIiwgXCJ0dFwiLCBcInVcIiwgXCJ1bFwiLCBcInZhclwiLCBcInZpZGVvXCIsIFwid2JyXCIsIFwieG1wXCIsIFwiaW5wdXRcIiwgXCJoMVwiLCBcImgyXCIsIFwiaDNcIiwgXCJoNFwiLCBcImg1XCIsIFwiaDZcIl0pO1xuXG5jb25zdCBtZW1vID0gZm4gPT4gY3JlYXRlTWVtbygoKSA9PiBmbigpKTtcblxuZnVuY3Rpb24gcmVjb25jaWxlQXJyYXlzKHBhcmVudE5vZGUsIGEsIGIpIHtcbiAgbGV0IGJMZW5ndGggPSBiLmxlbmd0aCxcbiAgICBhRW5kID0gYS5sZW5ndGgsXG4gICAgYkVuZCA9IGJMZW5ndGgsXG4gICAgYVN0YXJ0ID0gMCxcbiAgICBiU3RhcnQgPSAwLFxuICAgIGFmdGVyID0gYVthRW5kIC0gMV0ubmV4dFNpYmxpbmcsXG4gICAgbWFwID0gbnVsbDtcbiAgd2hpbGUgKGFTdGFydCA8IGFFbmQgfHwgYlN0YXJ0IDwgYkVuZCkge1xuICAgIGlmIChhW2FTdGFydF0gPT09IGJbYlN0YXJ0XSkge1xuICAgICAgYVN0YXJ0Kys7XG4gICAgICBiU3RhcnQrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICB3aGlsZSAoYVthRW5kIC0gMV0gPT09IGJbYkVuZCAtIDFdKSB7XG4gICAgICBhRW5kLS07XG4gICAgICBiRW5kLS07XG4gICAgfVxuICAgIGlmIChhRW5kID09PSBhU3RhcnQpIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBiRW5kIDwgYkxlbmd0aCA/IGJTdGFydCA/IGJbYlN0YXJ0IC0gMV0ubmV4dFNpYmxpbmcgOiBiW2JFbmQgLSBiU3RhcnRdIDogYWZ0ZXI7XG4gICAgICB3aGlsZSAoYlN0YXJ0IDwgYkVuZCkgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIG5vZGUpO1xuICAgIH0gZWxzZSBpZiAoYkVuZCA9PT0gYlN0YXJ0KSB7XG4gICAgICB3aGlsZSAoYVN0YXJ0IDwgYUVuZCkge1xuICAgICAgICBpZiAoIW1hcCB8fCAhbWFwLmhhcyhhW2FTdGFydF0pKSBhW2FTdGFydF0ucmVtb3ZlKCk7XG4gICAgICAgIGFTdGFydCsrO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYVthU3RhcnRdID09PSBiW2JFbmQgLSAxXSAmJiBiW2JTdGFydF0gPT09IGFbYUVuZCAtIDFdKSB7XG4gICAgICBjb25zdCBub2RlID0gYVstLWFFbmRdLm5leHRTaWJsaW5nO1xuICAgICAgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIGFbYVN0YXJ0KytdLm5leHRTaWJsaW5nKTtcbiAgICAgIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbLS1iRW5kXSwgbm9kZSk7XG4gICAgICBhW2FFbmRdID0gYltiRW5kXTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFtYXApIHtcbiAgICAgICAgbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICBsZXQgaSA9IGJTdGFydDtcbiAgICAgICAgd2hpbGUgKGkgPCBiRW5kKSBtYXAuc2V0KGJbaV0sIGkrKyk7XG4gICAgICB9XG4gICAgICBjb25zdCBpbmRleCA9IG1hcC5nZXQoYVthU3RhcnRdKTtcbiAgICAgIGlmIChpbmRleCAhPSBudWxsKSB7XG4gICAgICAgIGlmIChiU3RhcnQgPCBpbmRleCAmJiBpbmRleCA8IGJFbmQpIHtcbiAgICAgICAgICBsZXQgaSA9IGFTdGFydCxcbiAgICAgICAgICAgIHNlcXVlbmNlID0gMSxcbiAgICAgICAgICAgIHQ7XG4gICAgICAgICAgd2hpbGUgKCsraSA8IGFFbmQgJiYgaSA8IGJFbmQpIHtcbiAgICAgICAgICAgIGlmICgodCA9IG1hcC5nZXQoYVtpXSkpID09IG51bGwgfHwgdCAhPT0gaW5kZXggKyBzZXF1ZW5jZSkgYnJlYWs7XG4gICAgICAgICAgICBzZXF1ZW5jZSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc2VxdWVuY2UgPiBpbmRleCAtIGJTdGFydCkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGFbYVN0YXJ0XTtcbiAgICAgICAgICAgIHdoaWxlIChiU3RhcnQgPCBpbmRleCkgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYltiU3RhcnQrK10sIG5vZGUpO1xuICAgICAgICAgIH0gZWxzZSBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChiW2JTdGFydCsrXSwgYVthU3RhcnQrK10pO1xuICAgICAgICB9IGVsc2UgYVN0YXJ0Kys7XG4gICAgICB9IGVsc2UgYVthU3RhcnQrK10ucmVtb3ZlKCk7XG4gICAgfVxuICB9XG59XG5cbmNvbnN0ICQkRVZFTlRTID0gXCJfJERYX0RFTEVHQVRFXCI7XG5mdW5jdGlvbiByZW5kZXIoY29kZSwgZWxlbWVudCwgaW5pdCwgb3B0aW9ucyA9IHt9KSB7XG4gIGlmICghZWxlbWVudCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBgZWxlbWVudGAgcGFzc2VkIHRvIGByZW5kZXIoLi4uLCBlbGVtZW50KWAgZG9lc24ndCBleGlzdC4gTWFrZSBzdXJlIGBlbGVtZW50YCBleGlzdHMgaW4gdGhlIGRvY3VtZW50LlwiKTtcbiAgfVxuICBsZXQgZGlzcG9zZXI7XG4gIGNyZWF0ZVJvb3QoZGlzcG9zZSA9PiB7XG4gICAgZGlzcG9zZXIgPSBkaXNwb3NlO1xuICAgIGVsZW1lbnQgPT09IGRvY3VtZW50ID8gY29kZSgpIDogaW5zZXJ0KGVsZW1lbnQsIGNvZGUoKSwgZWxlbWVudC5maXJzdENoaWxkID8gbnVsbCA6IHVuZGVmaW5lZCwgaW5pdCk7XG4gIH0sIG9wdGlvbnMub3duZXIpO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGRpc3Bvc2VyKCk7XG4gICAgZWxlbWVudC50ZXh0Q29udGVudCA9IFwiXCI7XG4gIH07XG59XG5mdW5jdGlvbiB0ZW1wbGF0ZShodG1sLCBpc0ltcG9ydE5vZGUsIGlzU1ZHLCBpc01hdGhNTCkge1xuICBsZXQgbm9kZTtcbiAgY29uc3QgY3JlYXRlID0gKCkgPT4ge1xuICAgIGlmIChpc0h5ZHJhdGluZygpKSB0aHJvdyBuZXcgRXJyb3IoXCJGYWlsZWQgYXR0ZW1wdCB0byBjcmVhdGUgbmV3IERPTSBlbGVtZW50cyBkdXJpbmcgaHlkcmF0aW9uLiBDaGVjayB0aGF0IHRoZSBsaWJyYXJpZXMgeW91IGFyZSB1c2luZyBzdXBwb3J0IGh5ZHJhdGlvbi5cIik7XG4gICAgY29uc3QgdCA9IGlzTWF0aE1MID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMTk5OC9NYXRoL01hdGhNTFwiLCBcInRlbXBsYXRlXCIpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIpO1xuICAgIHQuaW5uZXJIVE1MID0gaHRtbDtcbiAgICByZXR1cm4gaXNTVkcgPyB0LmNvbnRlbnQuZmlyc3RDaGlsZC5maXJzdENoaWxkIDogaXNNYXRoTUwgPyB0LmZpcnN0Q2hpbGQgOiB0LmNvbnRlbnQuZmlyc3RDaGlsZDtcbiAgfTtcbiAgY29uc3QgZm4gPSBpc0ltcG9ydE5vZGUgPyAoKSA9PiB1bnRyYWNrKCgpID0+IGRvY3VtZW50LmltcG9ydE5vZGUobm9kZSB8fCAobm9kZSA9IGNyZWF0ZSgpKSwgdHJ1ZSkpIDogKCkgPT4gKG5vZGUgfHwgKG5vZGUgPSBjcmVhdGUoKSkpLmNsb25lTm9kZSh0cnVlKTtcbiAgZm4uY2xvbmVOb2RlID0gZm47XG4gIHJldHVybiBmbjtcbn1cbmZ1bmN0aW9uIGRlbGVnYXRlRXZlbnRzKGV2ZW50TmFtZXMsIGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50KSB7XG4gIGNvbnN0IGUgPSBkb2N1bWVudFskJEVWRU5UU10gfHwgKGRvY3VtZW50WyQkRVZFTlRTXSA9IG5ldyBTZXQoKSk7XG4gIGZvciAobGV0IGkgPSAwLCBsID0gZXZlbnROYW1lcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBjb25zdCBuYW1lID0gZXZlbnROYW1lc1tpXTtcbiAgICBpZiAoIWUuaGFzKG5hbWUpKSB7XG4gICAgICBlLmFkZChuYW1lKTtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZXZlbnRIYW5kbGVyKTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIGNsZWFyRGVsZWdhdGVkRXZlbnRzKGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50KSB7XG4gIGlmIChkb2N1bWVudFskJEVWRU5UU10pIHtcbiAgICBmb3IgKGxldCBuYW1lIG9mIGRvY3VtZW50WyQkRVZFTlRTXS5rZXlzKCkpIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgZXZlbnRIYW5kbGVyKTtcbiAgICBkZWxldGUgZG9jdW1lbnRbJCRFVkVOVFNdO1xuICB9XG59XG5mdW5jdGlvbiBzZXRQcm9wZXJ0eShub2RlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgbm9kZVtuYW1lXSA9IHZhbHVlO1xufVxuZnVuY3Rpb24gc2V0QXR0cmlidXRlKG5vZGUsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBpZiAodmFsdWUgPT0gbnVsbCkgbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7ZWxzZSBub2RlLnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBzZXRBdHRyaWJ1dGVOUyhub2RlLCBuYW1lc3BhY2UsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBpZiAodmFsdWUgPT0gbnVsbCkgbm9kZS5yZW1vdmVBdHRyaWJ1dGVOUyhuYW1lc3BhY2UsIG5hbWUpO2Vsc2Ugbm9kZS5zZXRBdHRyaWJ1dGVOUyhuYW1lc3BhY2UsIG5hbWUsIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIHNldEJvb2xBdHRyaWJ1dGUobm9kZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIHZhbHVlID8gbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgXCJcIikgOiBub2RlLnJlbW92ZUF0dHJpYnV0ZShuYW1lKTtcbn1cbmZ1bmN0aW9uIGNsYXNzTmFtZShub2RlLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlKFwiY2xhc3NcIik7ZWxzZSBub2RlLmNsYXNzTmFtZSA9IHZhbHVlO1xufVxuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcihub2RlLCBuYW1lLCBoYW5kbGVyLCBkZWxlZ2F0ZSkge1xuICBpZiAoZGVsZWdhdGUpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShoYW5kbGVyKSkge1xuICAgICAgbm9kZVtgJCQke25hbWV9YF0gPSBoYW5kbGVyWzBdO1xuICAgICAgbm9kZVtgJCQke25hbWV9RGF0YWBdID0gaGFuZGxlclsxXTtcbiAgICB9IGVsc2Ugbm9kZVtgJCQke25hbWV9YF0gPSBoYW5kbGVyO1xuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaGFuZGxlcikpIHtcbiAgICBjb25zdCBoYW5kbGVyRm4gPSBoYW5kbGVyWzBdO1xuICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBoYW5kbGVyWzBdID0gZSA9PiBoYW5kbGVyRm4uY2FsbChub2RlLCBoYW5kbGVyWzFdLCBlKSk7XG4gIH0gZWxzZSBub2RlLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgaGFuZGxlciwgdHlwZW9mIGhhbmRsZXIgIT09IFwiZnVuY3Rpb25cIiAmJiBoYW5kbGVyKTtcbn1cbmZ1bmN0aW9uIGNsYXNzTGlzdChub2RlLCB2YWx1ZSwgcHJldiA9IHt9KSB7XG4gIGNvbnN0IGNsYXNzS2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlIHx8IHt9KSxcbiAgICBwcmV2S2V5cyA9IE9iamVjdC5rZXlzKHByZXYpO1xuICBsZXQgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBwcmV2S2V5cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNvbnN0IGtleSA9IHByZXZLZXlzW2ldO1xuICAgIGlmICgha2V5IHx8IGtleSA9PT0gXCJ1bmRlZmluZWRcIiB8fCB2YWx1ZVtrZXldKSBjb250aW51ZTtcbiAgICB0b2dnbGVDbGFzc0tleShub2RlLCBrZXksIGZhbHNlKTtcbiAgICBkZWxldGUgcHJldltrZXldO1xuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IGNsYXNzS2V5cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNvbnN0IGtleSA9IGNsYXNzS2V5c1tpXSxcbiAgICAgIGNsYXNzVmFsdWUgPSAhIXZhbHVlW2tleV07XG4gICAgaWYgKCFrZXkgfHwga2V5ID09PSBcInVuZGVmaW5lZFwiIHx8IHByZXZba2V5XSA9PT0gY2xhc3NWYWx1ZSB8fCAhY2xhc3NWYWx1ZSkgY29udGludWU7XG4gICAgdG9nZ2xlQ2xhc3NLZXkobm9kZSwga2V5LCB0cnVlKTtcbiAgICBwcmV2W2tleV0gPSBjbGFzc1ZhbHVlO1xuICB9XG4gIHJldHVybiBwcmV2O1xufVxuZnVuY3Rpb24gc3R5bGUobm9kZSwgdmFsdWUsIHByZXYpIHtcbiAgaWYgKCF2YWx1ZSkgcmV0dXJuIHByZXYgPyBzZXRBdHRyaWJ1dGUobm9kZSwgXCJzdHlsZVwiKSA6IHZhbHVlO1xuICBjb25zdCBub2RlU3R5bGUgPSBub2RlLnN0eWxlO1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSByZXR1cm4gbm9kZVN0eWxlLmNzc1RleHQgPSB2YWx1ZTtcbiAgdHlwZW9mIHByZXYgPT09IFwic3RyaW5nXCIgJiYgKG5vZGVTdHlsZS5jc3NUZXh0ID0gcHJldiA9IHVuZGVmaW5lZCk7XG4gIHByZXYgfHwgKHByZXYgPSB7fSk7XG4gIHZhbHVlIHx8ICh2YWx1ZSA9IHt9KTtcbiAgbGV0IHYsIHM7XG4gIGZvciAocyBpbiBwcmV2KSB7XG4gICAgdmFsdWVbc10gPT0gbnVsbCAmJiBub2RlU3R5bGUucmVtb3ZlUHJvcGVydHkocyk7XG4gICAgZGVsZXRlIHByZXZbc107XG4gIH1cbiAgZm9yIChzIGluIHZhbHVlKSB7XG4gICAgdiA9IHZhbHVlW3NdO1xuICAgIGlmICh2ICE9PSBwcmV2W3NdKSB7XG4gICAgICBub2RlU3R5bGUuc2V0UHJvcGVydHkocywgdik7XG4gICAgICBwcmV2W3NdID0gdjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHByZXY7XG59XG5mdW5jdGlvbiBzcHJlYWQobm9kZSwgcHJvcHMgPSB7fSwgaXNTVkcsIHNraXBDaGlsZHJlbikge1xuICBjb25zdCBwcmV2UHJvcHMgPSB7fTtcbiAgaWYgKCFza2lwQ2hpbGRyZW4pIHtcbiAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gcHJldlByb3BzLmNoaWxkcmVuID0gaW5zZXJ0RXhwcmVzc2lvbihub2RlLCBwcm9wcy5jaGlsZHJlbiwgcHJldlByb3BzLmNoaWxkcmVuKSk7XG4gIH1cbiAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHR5cGVvZiBwcm9wcy5yZWYgPT09IFwiZnVuY3Rpb25cIiAmJiB1c2UocHJvcHMucmVmLCBub2RlKSk7XG4gIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiBhc3NpZ24obm9kZSwgcHJvcHMsIGlzU1ZHLCB0cnVlLCBwcmV2UHJvcHMsIHRydWUpKTtcbiAgcmV0dXJuIHByZXZQcm9wcztcbn1cbmZ1bmN0aW9uIGR5bmFtaWNQcm9wZXJ0eShwcm9wcywga2V5KSB7XG4gIGNvbnN0IHNyYyA9IHByb3BzW2tleV07XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm9wcywga2V5LCB7XG4gICAgZ2V0KCkge1xuICAgICAgcmV0dXJuIHNyYygpO1xuICAgIH0sXG4gICAgZW51bWVyYWJsZTogdHJ1ZVxuICB9KTtcbiAgcmV0dXJuIHByb3BzO1xufVxuZnVuY3Rpb24gdXNlKGZuLCBlbGVtZW50LCBhcmcpIHtcbiAgcmV0dXJuIHVudHJhY2soKCkgPT4gZm4oZWxlbWVudCwgYXJnKSk7XG59XG5mdW5jdGlvbiBpbnNlcnQocGFyZW50LCBhY2Nlc3NvciwgbWFya2VyLCBpbml0aWFsKSB7XG4gIGlmIChtYXJrZXIgIT09IHVuZGVmaW5lZCAmJiAhaW5pdGlhbCkgaW5pdGlhbCA9IFtdO1xuICBpZiAodHlwZW9mIGFjY2Vzc29yICE9PSBcImZ1bmN0aW9uXCIpIHJldHVybiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgYWNjZXNzb3IsIGluaXRpYWwsIG1hcmtlcik7XG4gIGNyZWF0ZVJlbmRlckVmZmVjdChjdXJyZW50ID0+IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCBhY2Nlc3NvcigpLCBjdXJyZW50LCBtYXJrZXIpLCBpbml0aWFsKTtcbn1cbmZ1bmN0aW9uIGFzc2lnbihub2RlLCBwcm9wcywgaXNTVkcsIHNraXBDaGlsZHJlbiwgcHJldlByb3BzID0ge30sIHNraXBSZWYgPSBmYWxzZSkge1xuICBwcm9wcyB8fCAocHJvcHMgPSB7fSk7XG4gIGZvciAoY29uc3QgcHJvcCBpbiBwcmV2UHJvcHMpIHtcbiAgICBpZiAoIShwcm9wIGluIHByb3BzKSkge1xuICAgICAgaWYgKHByb3AgPT09IFwiY2hpbGRyZW5cIikgY29udGludWU7XG4gICAgICBwcmV2UHJvcHNbcHJvcF0gPSBhc3NpZ25Qcm9wKG5vZGUsIHByb3AsIG51bGwsIHByZXZQcm9wc1twcm9wXSwgaXNTVkcsIHNraXBSZWYsIHByb3BzKTtcbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBwcm9wIGluIHByb3BzKSB7XG4gICAgaWYgKHByb3AgPT09IFwiY2hpbGRyZW5cIikge1xuICAgICAgaWYgKCFza2lwQ2hpbGRyZW4pIGluc2VydEV4cHJlc3Npb24obm9kZSwgcHJvcHMuY2hpbGRyZW4pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gcHJvcHNbcHJvcF07XG4gICAgcHJldlByb3BzW3Byb3BdID0gYXNzaWduUHJvcChub2RlLCBwcm9wLCB2YWx1ZSwgcHJldlByb3BzW3Byb3BdLCBpc1NWRywgc2tpcFJlZiwgcHJvcHMpO1xuICB9XG59XG5mdW5jdGlvbiBoeWRyYXRlJDEoY29kZSwgZWxlbWVudCwgb3B0aW9ucyA9IHt9KSB7XG4gIGlmIChnbG9iYWxUaGlzLl8kSFkuZG9uZSkgcmV0dXJuIHJlbmRlcihjb2RlLCBlbGVtZW50LCBbLi4uZWxlbWVudC5jaGlsZE5vZGVzXSwgb3B0aW9ucyk7XG4gIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQgPSBnbG9iYWxUaGlzLl8kSFkuY29tcGxldGVkO1xuICBzaGFyZWRDb25maWcuZXZlbnRzID0gZ2xvYmFsVGhpcy5fJEhZLmV2ZW50cztcbiAgc2hhcmVkQ29uZmlnLmxvYWQgPSBpZCA9PiBnbG9iYWxUaGlzLl8kSFkucltpZF07XG4gIHNoYXJlZENvbmZpZy5oYXMgPSBpZCA9PiBpZCBpbiBnbG9iYWxUaGlzLl8kSFkucjtcbiAgc2hhcmVkQ29uZmlnLmdhdGhlciA9IHJvb3QgPT4gZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCByb290KTtcbiAgc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ID0gbmV3IE1hcCgpO1xuICBzaGFyZWRDb25maWcuY29udGV4dCA9IHtcbiAgICBpZDogb3B0aW9ucy5yZW5kZXJJZCB8fCBcIlwiLFxuICAgIGNvdW50OiAwXG4gIH07XG4gIHRyeSB7XG4gICAgZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCBvcHRpb25zLnJlbmRlcklkKTtcbiAgICByZXR1cm4gcmVuZGVyKGNvZGUsIGVsZW1lbnQsIFsuLi5lbGVtZW50LmNoaWxkTm9kZXNdLCBvcHRpb25zKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBzaGFyZWRDb25maWcuY29udGV4dCA9IG51bGw7XG4gIH1cbn1cbmZ1bmN0aW9uIGdldE5leHRFbGVtZW50KHRlbXBsYXRlKSB7XG4gIGxldCBub2RlLFxuICAgIGtleSxcbiAgICBoeWRyYXRpbmcgPSBpc0h5ZHJhdGluZygpO1xuICBpZiAoIWh5ZHJhdGluZyB8fCAhKG5vZGUgPSBzaGFyZWRDb25maWcucmVnaXN0cnkuZ2V0KGtleSA9IGdldEh5ZHJhdGlvbktleSgpKSkpIHtcbiAgICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgICBzaGFyZWRDb25maWcuZG9uZSA9IHRydWU7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEh5ZHJhdGlvbiBNaXNtYXRjaC4gVW5hYmxlIHRvIGZpbmQgRE9NIG5vZGVzIGZvciBoeWRyYXRpb24ga2V5OiAke2tleX1cXG4ke3RlbXBsYXRlID8gdGVtcGxhdGUoKS5vdXRlckhUTUwgOiBcIlwifWApO1xuICAgIH1cbiAgICByZXR1cm4gdGVtcGxhdGUoKTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmNvbXBsZXRlZCkgc2hhcmVkQ29uZmlnLmNvbXBsZXRlZC5hZGQobm9kZSk7XG4gIHNoYXJlZENvbmZpZy5yZWdpc3RyeS5kZWxldGUoa2V5KTtcbiAgcmV0dXJuIG5vZGU7XG59XG5mdW5jdGlvbiBnZXROZXh0TWF0Y2goZWwsIG5vZGVOYW1lKSB7XG4gIHdoaWxlIChlbCAmJiBlbC5sb2NhbE5hbWUgIT09IG5vZGVOYW1lKSBlbCA9IGVsLm5leHRTaWJsaW5nO1xuICByZXR1cm4gZWw7XG59XG5mdW5jdGlvbiBnZXROZXh0TWFya2VyKHN0YXJ0KSB7XG4gIGxldCBlbmQgPSBzdGFydCxcbiAgICBjb3VudCA9IDAsXG4gICAgY3VycmVudCA9IFtdO1xuICBpZiAoaXNIeWRyYXRpbmcoc3RhcnQpKSB7XG4gICAgd2hpbGUgKGVuZCkge1xuICAgICAgaWYgKGVuZC5ub2RlVHlwZSA9PT0gOCkge1xuICAgICAgICBjb25zdCB2ID0gZW5kLm5vZGVWYWx1ZTtcbiAgICAgICAgaWYgKHYgPT09IFwiJFwiKSBjb3VudCsrO2Vsc2UgaWYgKHYgPT09IFwiL1wiKSB7XG4gICAgICAgICAgaWYgKGNvdW50ID09PSAwKSByZXR1cm4gW2VuZCwgY3VycmVudF07XG4gICAgICAgICAgY291bnQtLTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY3VycmVudC5wdXNoKGVuZCk7XG4gICAgICBlbmQgPSBlbmQubmV4dFNpYmxpbmc7XG4gICAgfVxuICB9XG4gIHJldHVybiBbZW5kLCBjdXJyZW50XTtcbn1cbmZ1bmN0aW9uIHJ1bkh5ZHJhdGlvbkV2ZW50cygpIHtcbiAgaWYgKHNoYXJlZENvbmZpZy5ldmVudHMgJiYgIXNoYXJlZENvbmZpZy5ldmVudHMucXVldWVkKSB7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuICAgICAgY29uc3Qge1xuICAgICAgICBjb21wbGV0ZWQsXG4gICAgICAgIGV2ZW50c1xuICAgICAgfSA9IHNoYXJlZENvbmZpZztcbiAgICAgIGlmICghZXZlbnRzKSByZXR1cm47XG4gICAgICBldmVudHMucXVldWVkID0gZmFsc2U7XG4gICAgICB3aGlsZSAoZXZlbnRzLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBbZWwsIGVdID0gZXZlbnRzWzBdO1xuICAgICAgICBpZiAoIWNvbXBsZXRlZC5oYXMoZWwpKSByZXR1cm47XG4gICAgICAgIGV2ZW50cy5zaGlmdCgpO1xuICAgICAgICBldmVudEhhbmRsZXIoZSk7XG4gICAgICB9XG4gICAgICBpZiAoc2hhcmVkQ29uZmlnLmRvbmUpIHtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmV2ZW50cyA9IF8kSFkuZXZlbnRzID0gbnVsbDtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmNvbXBsZXRlZCA9IF8kSFkuY29tcGxldGVkID0gbnVsbDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBzaGFyZWRDb25maWcuZXZlbnRzLnF1ZXVlZCA9IHRydWU7XG4gIH1cbn1cbmZ1bmN0aW9uIGlzSHlkcmF0aW5nKG5vZGUpIHtcbiAgcmV0dXJuICEhc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgIXNoYXJlZENvbmZpZy5kb25lICYmICghbm9kZSB8fCBub2RlLmlzQ29ubmVjdGVkKTtcbn1cbmZ1bmN0aW9uIHRvUHJvcGVydHlOYW1lKG5hbWUpIHtcbiAgcmV0dXJuIG5hbWUudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC8tKFthLXpdKS9nLCAoXywgdykgPT4gdy50b1VwcGVyQ2FzZSgpKTtcbn1cbmZ1bmN0aW9uIHRvZ2dsZUNsYXNzS2V5KG5vZGUsIGtleSwgdmFsdWUpIHtcbiAgY29uc3QgY2xhc3NOYW1lcyA9IGtleS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgZm9yIChsZXQgaSA9IDAsIG5hbWVMZW4gPSBjbGFzc05hbWVzLmxlbmd0aDsgaSA8IG5hbWVMZW47IGkrKykgbm9kZS5jbGFzc0xpc3QudG9nZ2xlKGNsYXNzTmFtZXNbaV0sIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIGFzc2lnblByb3Aobm9kZSwgcHJvcCwgdmFsdWUsIHByZXYsIGlzU1ZHLCBza2lwUmVmLCBwcm9wcykge1xuICBsZXQgaXNDRSwgaXNQcm9wLCBpc0NoaWxkUHJvcCwgcHJvcEFsaWFzLCBmb3JjZVByb3A7XG4gIGlmIChwcm9wID09PSBcInN0eWxlXCIpIHJldHVybiBzdHlsZShub2RlLCB2YWx1ZSwgcHJldik7XG4gIGlmIChwcm9wID09PSBcImNsYXNzTGlzdFwiKSByZXR1cm4gY2xhc3NMaXN0KG5vZGUsIHZhbHVlLCBwcmV2KTtcbiAgaWYgKHZhbHVlID09PSBwcmV2KSByZXR1cm4gcHJldjtcbiAgaWYgKHByb3AgPT09IFwicmVmXCIpIHtcbiAgICBpZiAoIXNraXBSZWYpIHZhbHVlKG5vZGUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMykgPT09IFwib246XCIpIHtcbiAgICBjb25zdCBlID0gcHJvcC5zbGljZSgzKTtcbiAgICBwcmV2ICYmIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihlLCBwcmV2LCB0eXBlb2YgcHJldiAhPT0gXCJmdW5jdGlvblwiICYmIHByZXYpO1xuICAgIHZhbHVlICYmIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihlLCB2YWx1ZSwgdHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIgJiYgdmFsdWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMTApID09PSBcIm9uY2FwdHVyZTpcIikge1xuICAgIGNvbnN0IGUgPSBwcm9wLnNsaWNlKDEwKTtcbiAgICBwcmV2ICYmIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihlLCBwcmV2LCB0cnVlKTtcbiAgICB2YWx1ZSAmJiBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZSwgdmFsdWUsIHRydWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgMikgPT09IFwib25cIikge1xuICAgIGNvbnN0IG5hbWUgPSBwcm9wLnNsaWNlKDIpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgZGVsZWdhdGUgPSBEZWxlZ2F0ZWRFdmVudHMuaGFzKG5hbWUpO1xuICAgIGlmICghZGVsZWdhdGUgJiYgcHJldikge1xuICAgICAgY29uc3QgaCA9IEFycmF5LmlzQXJyYXkocHJldikgPyBwcmV2WzBdIDogcHJldjtcbiAgICAgIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBoKTtcbiAgICB9XG4gICAgaWYgKGRlbGVnYXRlIHx8IHZhbHVlKSB7XG4gICAgICBhZGRFdmVudExpc3RlbmVyKG5vZGUsIG5hbWUsIHZhbHVlLCBkZWxlZ2F0ZSk7XG4gICAgICBkZWxlZ2F0ZSAmJiBkZWxlZ2F0ZUV2ZW50cyhbbmFtZV0pO1xuICAgIH1cbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDUpID09PSBcImF0dHI6XCIpIHtcbiAgICBzZXRBdHRyaWJ1dGUobm9kZSwgcHJvcC5zbGljZSg1KSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgNSkgPT09IFwiYm9vbDpcIikge1xuICAgIHNldEJvb2xBdHRyaWJ1dGUobm9kZSwgcHJvcC5zbGljZSg1KSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKChmb3JjZVByb3AgPSBwcm9wLnNsaWNlKDAsIDUpID09PSBcInByb3A6XCIpIHx8IChpc0NoaWxkUHJvcCA9IENoaWxkUHJvcGVydGllcy5oYXMocHJvcCkpIHx8ICFpc1NWRyAmJiAoKHByb3BBbGlhcyA9IGdldFByb3BBbGlhcyhwcm9wLCBub2RlLnRhZ05hbWUpKSB8fCAoaXNQcm9wID0gUHJvcGVydGllcy5oYXMocHJvcCkpKSB8fCAoaXNDRSA9IG5vZGUubm9kZU5hbWUuaW5jbHVkZXMoXCItXCIpIHx8IFwiaXNcIiBpbiBwcm9wcykpIHtcbiAgICBpZiAoZm9yY2VQcm9wKSB7XG4gICAgICBwcm9wID0gcHJvcC5zbGljZSg1KTtcbiAgICAgIGlzUHJvcCA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuIHZhbHVlO1xuICAgIGlmIChwcm9wID09PSBcImNsYXNzXCIgfHwgcHJvcCA9PT0gXCJjbGFzc05hbWVcIikgY2xhc3NOYW1lKG5vZGUsIHZhbHVlKTtlbHNlIGlmIChpc0NFICYmICFpc1Byb3AgJiYgIWlzQ2hpbGRQcm9wKSBub2RlW3RvUHJvcGVydHlOYW1lKHByb3ApXSA9IHZhbHVlO2Vsc2Ugbm9kZVtwcm9wQWxpYXMgfHwgcHJvcF0gPSB2YWx1ZTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBucyA9IGlzU1ZHICYmIHByb3AuaW5kZXhPZihcIjpcIikgPiAtMSAmJiBTVkdOYW1lc3BhY2VbcHJvcC5zcGxpdChcIjpcIilbMF1dO1xuICAgIGlmIChucykgc2V0QXR0cmlidXRlTlMobm9kZSwgbnMsIHByb3AsIHZhbHVlKTtlbHNlIHNldEF0dHJpYnV0ZShub2RlLCBBbGlhc2VzW3Byb3BdIHx8IHByb3AsIHZhbHVlKTtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5mdW5jdGlvbiBldmVudEhhbmRsZXIoZSkge1xuICBpZiAoc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ICYmIHNoYXJlZENvbmZpZy5ldmVudHMpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmV2ZW50cy5maW5kKChbZWwsIGV2XSkgPT4gZXYgPT09IGUpKSByZXR1cm47XG4gIH1cbiAgbGV0IG5vZGUgPSBlLnRhcmdldDtcbiAgY29uc3Qga2V5ID0gYCQkJHtlLnR5cGV9YDtcbiAgY29uc3Qgb3JpVGFyZ2V0ID0gZS50YXJnZXQ7XG4gIGNvbnN0IG9yaUN1cnJlbnRUYXJnZXQgPSBlLmN1cnJlbnRUYXJnZXQ7XG4gIGNvbnN0IHJldGFyZ2V0ID0gdmFsdWUgPT4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGUsIFwidGFyZ2V0XCIsIHtcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgdmFsdWVcbiAgfSk7XG4gIGNvbnN0IGhhbmRsZU5vZGUgPSAoKSA9PiB7XG4gICAgY29uc3QgaGFuZGxlciA9IG5vZGVba2V5XTtcbiAgICBpZiAoaGFuZGxlciAmJiAhbm9kZS5kaXNhYmxlZCkge1xuICAgICAgY29uc3QgZGF0YSA9IG5vZGVbYCR7a2V5fURhdGFgXTtcbiAgICAgIGRhdGEgIT09IHVuZGVmaW5lZCA/IGhhbmRsZXIuY2FsbChub2RlLCBkYXRhLCBlKSA6IGhhbmRsZXIuY2FsbChub2RlLCBlKTtcbiAgICAgIGlmIChlLmNhbmNlbEJ1YmJsZSkgcmV0dXJuO1xuICAgIH1cbiAgICBub2RlLmhvc3QgJiYgdHlwZW9mIG5vZGUuaG9zdCAhPT0gXCJzdHJpbmdcIiAmJiAhbm9kZS5ob3N0Ll8kaG9zdCAmJiBub2RlLmNvbnRhaW5zKGUudGFyZ2V0KSAmJiByZXRhcmdldChub2RlLmhvc3QpO1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xuICBjb25zdCB3YWxrVXBUcmVlID0gKCkgPT4ge1xuICAgIHdoaWxlIChoYW5kbGVOb2RlKCkgJiYgKG5vZGUgPSBub2RlLl8kaG9zdCB8fCBub2RlLnBhcmVudE5vZGUgfHwgbm9kZS5ob3N0KSk7XG4gIH07XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlLCBcImN1cnJlbnRUYXJnZXRcIiwge1xuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBnZXQoKSB7XG4gICAgICByZXR1cm4gbm9kZSB8fCBkb2N1bWVudDtcbiAgICB9XG4gIH0pO1xuICBpZiAoc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5ICYmICFzaGFyZWRDb25maWcuZG9uZSkgc2hhcmVkQ29uZmlnLmRvbmUgPSBfJEhZLmRvbmUgPSB0cnVlO1xuICBpZiAoZS5jb21wb3NlZFBhdGgpIHtcbiAgICBjb25zdCBwYXRoID0gZS5jb21wb3NlZFBhdGgoKTtcbiAgICByZXRhcmdldChwYXRoWzBdKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdGgubGVuZ3RoIC0gMjsgaSsrKSB7XG4gICAgICBub2RlID0gcGF0aFtpXTtcbiAgICAgIGlmICghaGFuZGxlTm9kZSgpKSBicmVhaztcbiAgICAgIGlmIChub2RlLl8kaG9zdCkge1xuICAgICAgICBub2RlID0gbm9kZS5fJGhvc3Q7XG4gICAgICAgIHdhbGtVcFRyZWUoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAobm9kZS5wYXJlbnROb2RlID09PSBvcmlDdXJyZW50VGFyZ2V0KSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBlbHNlIHdhbGtVcFRyZWUoKTtcbiAgcmV0YXJnZXQob3JpVGFyZ2V0KTtcbn1cbmZ1bmN0aW9uIGluc2VydEV4cHJlc3Npb24ocGFyZW50LCB2YWx1ZSwgY3VycmVudCwgbWFya2VyLCB1bndyYXBBcnJheSkge1xuICBjb25zdCBoeWRyYXRpbmcgPSBpc0h5ZHJhdGluZyhwYXJlbnQpO1xuICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgIWN1cnJlbnQgJiYgKGN1cnJlbnQgPSBbLi4ucGFyZW50LmNoaWxkTm9kZXNdKTtcbiAgICBsZXQgY2xlYW5lZCA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY3VycmVudC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgbm9kZSA9IGN1cnJlbnRbaV07XG4gICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gOCAmJiBub2RlLmRhdGEuc2xpY2UoMCwgMikgPT09IFwiISRcIikgbm9kZS5yZW1vdmUoKTtlbHNlIGNsZWFuZWQucHVzaChub2RlKTtcbiAgICB9XG4gICAgY3VycmVudCA9IGNsZWFuZWQ7XG4gIH1cbiAgd2hpbGUgKHR5cGVvZiBjdXJyZW50ID09PSBcImZ1bmN0aW9uXCIpIGN1cnJlbnQgPSBjdXJyZW50KCk7XG4gIGlmICh2YWx1ZSA9PT0gY3VycmVudCkgcmV0dXJuIGN1cnJlbnQ7XG4gIGNvbnN0IHQgPSB0eXBlb2YgdmFsdWUsXG4gICAgbXVsdGkgPSBtYXJrZXIgIT09IHVuZGVmaW5lZDtcbiAgcGFyZW50ID0gbXVsdGkgJiYgY3VycmVudFswXSAmJiBjdXJyZW50WzBdLnBhcmVudE5vZGUgfHwgcGFyZW50O1xuICBpZiAodCA9PT0gXCJzdHJpbmdcIiB8fCB0ID09PSBcIm51bWJlclwiKSB7XG4gICAgaWYgKGh5ZHJhdGluZykgcmV0dXJuIGN1cnJlbnQ7XG4gICAgaWYgKHQgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIHZhbHVlID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gY3VycmVudCkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgfVxuICAgIGlmIChtdWx0aSkge1xuICAgICAgbGV0IG5vZGUgPSBjdXJyZW50WzBdO1xuICAgICAgaWYgKG5vZGUgJiYgbm9kZS5ub2RlVHlwZSA9PT0gMykge1xuICAgICAgICBub2RlLmRhdGEgIT09IHZhbHVlICYmIChub2RlLmRhdGEgPSB2YWx1ZSk7XG4gICAgICB9IGVsc2Ugbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZhbHVlKTtcbiAgICAgIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCBub2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGN1cnJlbnQgIT09IFwiXCIgJiYgdHlwZW9mIGN1cnJlbnQgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgY3VycmVudCA9IHBhcmVudC5maXJzdENoaWxkLmRhdGEgPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSBjdXJyZW50ID0gcGFyZW50LnRleHRDb250ZW50ID0gdmFsdWU7XG4gICAgfVxuICB9IGVsc2UgaWYgKHZhbHVlID09IG51bGwgfHwgdCA9PT0gXCJib29sZWFuXCIpIHtcbiAgICBpZiAoaHlkcmF0aW5nKSByZXR1cm4gY3VycmVudDtcbiAgICBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlcik7XG4gIH0gZWxzZSBpZiAodCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHtcbiAgICAgIGxldCB2ID0gdmFsdWUoKTtcbiAgICAgIHdoaWxlICh0eXBlb2YgdiA9PT0gXCJmdW5jdGlvblwiKSB2ID0gdigpO1xuICAgICAgY3VycmVudCA9IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCB2LCBjdXJyZW50LCBtYXJrZXIpO1xuICAgIH0pO1xuICAgIHJldHVybiAoKSA9PiBjdXJyZW50O1xuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgY29uc3QgYXJyYXkgPSBbXTtcbiAgICBjb25zdCBjdXJyZW50QXJyYXkgPSBjdXJyZW50ICYmIEFycmF5LmlzQXJyYXkoY3VycmVudCk7XG4gICAgaWYgKG5vcm1hbGl6ZUluY29taW5nQXJyYXkoYXJyYXksIHZhbHVlLCBjdXJyZW50LCB1bndyYXBBcnJheSkpIHtcbiAgICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiBjdXJyZW50ID0gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIGFycmF5LCBjdXJyZW50LCBtYXJrZXIsIHRydWUpKTtcbiAgICAgIHJldHVybiAoKSA9PiBjdXJyZW50O1xuICAgIH1cbiAgICBpZiAoaHlkcmF0aW5nKSB7XG4gICAgICBpZiAoIWFycmF5Lmxlbmd0aCkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgICBpZiAobWFya2VyID09PSB1bmRlZmluZWQpIHJldHVybiBjdXJyZW50ID0gWy4uLnBhcmVudC5jaGlsZE5vZGVzXTtcbiAgICAgIGxldCBub2RlID0gYXJyYXlbMF07XG4gICAgICBpZiAobm9kZS5wYXJlbnROb2RlICE9PSBwYXJlbnQpIHJldHVybiBjdXJyZW50O1xuICAgICAgY29uc3Qgbm9kZXMgPSBbbm9kZV07XG4gICAgICB3aGlsZSAoKG5vZGUgPSBub2RlLm5leHRTaWJsaW5nKSAhPT0gbWFya2VyKSBub2Rlcy5wdXNoKG5vZGUpO1xuICAgICAgcmV0dXJuIGN1cnJlbnQgPSBub2RlcztcbiAgICB9XG4gICAgaWYgKGFycmF5Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIpO1xuICAgICAgaWYgKG11bHRpKSByZXR1cm4gY3VycmVudDtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnRBcnJheSkge1xuICAgICAgaWYgKGN1cnJlbnQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXksIG1hcmtlcik7XG4gICAgICB9IGVsc2UgcmVjb25jaWxlQXJyYXlzKHBhcmVudCwgY3VycmVudCwgYXJyYXkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdXJyZW50ICYmIGNsZWFuQ2hpbGRyZW4ocGFyZW50KTtcbiAgICAgIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXkpO1xuICAgIH1cbiAgICBjdXJyZW50ID0gYXJyYXk7XG4gIH0gZWxzZSBpZiAodmFsdWUubm9kZVR5cGUpIHtcbiAgICBpZiAoaHlkcmF0aW5nICYmIHZhbHVlLnBhcmVudE5vZGUpIHJldHVybiBjdXJyZW50ID0gbXVsdGkgPyBbdmFsdWVdIDogdmFsdWU7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoY3VycmVudCkpIHtcbiAgICAgIGlmIChtdWx0aSkgcmV0dXJuIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCB2YWx1ZSk7XG4gICAgICBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbnVsbCwgdmFsdWUpO1xuICAgIH0gZWxzZSBpZiAoY3VycmVudCA9PSBudWxsIHx8IGN1cnJlbnQgPT09IFwiXCIgfHwgIXBhcmVudC5maXJzdENoaWxkKSB7XG4gICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQodmFsdWUpO1xuICAgIH0gZWxzZSBwYXJlbnQucmVwbGFjZUNoaWxkKHZhbHVlLCBwYXJlbnQuZmlyc3RDaGlsZCk7XG4gICAgY3VycmVudCA9IHZhbHVlO1xuICB9IGVsc2UgY29uc29sZS53YXJuKGBVbnJlY29nbml6ZWQgdmFsdWUuIFNraXBwZWQgaW5zZXJ0aW5nYCwgdmFsdWUpO1xuICByZXR1cm4gY3VycmVudDtcbn1cbmZ1bmN0aW9uIG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgYXJyYXksIGN1cnJlbnQsIHVud3JhcCkge1xuICBsZXQgZHluYW1pYyA9IGZhbHNlO1xuICBmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBsZXQgaXRlbSA9IGFycmF5W2ldLFxuICAgICAgcHJldiA9IGN1cnJlbnQgJiYgY3VycmVudFtub3JtYWxpemVkLmxlbmd0aF0sXG4gICAgICB0O1xuICAgIGlmIChpdGVtID09IG51bGwgfHwgaXRlbSA9PT0gdHJ1ZSB8fCBpdGVtID09PSBmYWxzZSkgOyBlbHNlIGlmICgodCA9IHR5cGVvZiBpdGVtKSA9PT0gXCJvYmplY3RcIiAmJiBpdGVtLm5vZGVUeXBlKSB7XG4gICAgICBub3JtYWxpemVkLnB1c2goaXRlbSk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGl0ZW0pKSB7XG4gICAgICBkeW5hbWljID0gbm9ybWFsaXplSW5jb21pbmdBcnJheShub3JtYWxpemVkLCBpdGVtLCBwcmV2KSB8fCBkeW5hbWljO1xuICAgIH0gZWxzZSBpZiAodCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBpZiAodW53cmFwKSB7XG4gICAgICAgIHdoaWxlICh0eXBlb2YgaXRlbSA9PT0gXCJmdW5jdGlvblwiKSBpdGVtID0gaXRlbSgpO1xuICAgICAgICBkeW5hbWljID0gbm9ybWFsaXplSW5jb21pbmdBcnJheShub3JtYWxpemVkLCBBcnJheS5pc0FycmF5KGl0ZW0pID8gaXRlbSA6IFtpdGVtXSwgQXJyYXkuaXNBcnJheShwcmV2KSA/IHByZXYgOiBbcHJldl0pIHx8IGR5bmFtaWM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBub3JtYWxpemVkLnB1c2goaXRlbSk7XG4gICAgICAgIGR5bmFtaWMgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IFN0cmluZyhpdGVtKTtcbiAgICAgIGlmIChwcmV2ICYmIHByZXYubm9kZVR5cGUgPT09IDMgJiYgcHJldi5kYXRhID09PSB2YWx1ZSkgbm9ybWFsaXplZC5wdXNoKHByZXYpO2Vsc2Ugbm9ybWFsaXplZC5wdXNoKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZhbHVlKSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBkeW5hbWljO1xufVxuZnVuY3Rpb24gYXBwZW5kTm9kZXMocGFyZW50LCBhcnJheSwgbWFya2VyID0gbnVsbCkge1xuICBmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHBhcmVudC5pbnNlcnRCZWZvcmUoYXJyYXlbaV0sIG1hcmtlcik7XG59XG5mdW5jdGlvbiBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyLCByZXBsYWNlbWVudCkge1xuICBpZiAobWFya2VyID09PSB1bmRlZmluZWQpIHJldHVybiBwYXJlbnQudGV4dENvbnRlbnQgPSBcIlwiO1xuICBjb25zdCBub2RlID0gcmVwbGFjZW1lbnQgfHwgZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcIik7XG4gIGlmIChjdXJyZW50Lmxlbmd0aCkge1xuICAgIGxldCBpbnNlcnRlZCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSBjdXJyZW50Lmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBlbCA9IGN1cnJlbnRbaV07XG4gICAgICBpZiAobm9kZSAhPT0gZWwpIHtcbiAgICAgICAgY29uc3QgaXNQYXJlbnQgPSBlbC5wYXJlbnROb2RlID09PSBwYXJlbnQ7XG4gICAgICAgIGlmICghaW5zZXJ0ZWQgJiYgIWkpIGlzUGFyZW50ID8gcGFyZW50LnJlcGxhY2VDaGlsZChub2RlLCBlbCkgOiBwYXJlbnQuaW5zZXJ0QmVmb3JlKG5vZGUsIG1hcmtlcik7ZWxzZSBpc1BhcmVudCAmJiBlbC5yZW1vdmUoKTtcbiAgICAgIH0gZWxzZSBpbnNlcnRlZCA9IHRydWU7XG4gICAgfVxuICB9IGVsc2UgcGFyZW50Lmluc2VydEJlZm9yZShub2RlLCBtYXJrZXIpO1xuICByZXR1cm4gW25vZGVdO1xufVxuZnVuY3Rpb24gZ2F0aGVySHlkcmF0YWJsZShlbGVtZW50LCByb290KSB7XG4gIGNvbnN0IHRlbXBsYXRlcyA9IGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChgKltkYXRhLWhrXWApO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHRlbXBsYXRlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IG5vZGUgPSB0ZW1wbGF0ZXNbaV07XG4gICAgY29uc3Qga2V5ID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCJkYXRhLWhrXCIpO1xuICAgIGlmICgoIXJvb3QgfHwga2V5LnN0YXJ0c1dpdGgocm9vdCkpICYmICFzaGFyZWRDb25maWcucmVnaXN0cnkuaGFzKGtleSkpIHNoYXJlZENvbmZpZy5yZWdpc3RyeS5zZXQoa2V5LCBub2RlKTtcbiAgfVxufVxuZnVuY3Rpb24gZ2V0SHlkcmF0aW9uS2V5KCkge1xuICByZXR1cm4gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKTtcbn1cbmZ1bmN0aW9uIE5vSHlkcmF0aW9uKHByb3BzKSB7XG4gIHJldHVybiBzaGFyZWRDb25maWcuY29udGV4dCA/IHVuZGVmaW5lZCA6IHByb3BzLmNoaWxkcmVuO1xufVxuZnVuY3Rpb24gSHlkcmF0aW9uKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcy5jaGlsZHJlbjtcbn1cbmNvbnN0IHZvaWRGbiA9ICgpID0+IHVuZGVmaW5lZDtcbmNvbnN0IFJlcXVlc3RDb250ZXh0ID0gU3ltYm9sKCk7XG5mdW5jdGlvbiBpbm5lckhUTUwocGFyZW50LCBjb250ZW50KSB7XG4gICFzaGFyZWRDb25maWcuY29udGV4dCAmJiAocGFyZW50LmlubmVySFRNTCA9IGNvbnRlbnQpO1xufVxuXG5mdW5jdGlvbiB0aHJvd0luQnJvd3NlcihmdW5jKSB7XG4gIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgJHtmdW5jLm5hbWV9IGlzIG5vdCBzdXBwb3J0ZWQgaW4gdGhlIGJyb3dzZXIsIHJldHVybmluZyB1bmRlZmluZWRgKTtcbiAgY29uc29sZS5lcnJvcihlcnIpO1xufVxuZnVuY3Rpb24gcmVuZGVyVG9TdHJpbmcoZm4sIG9wdGlvbnMpIHtcbiAgdGhyb3dJbkJyb3dzZXIocmVuZGVyVG9TdHJpbmcpO1xufVxuZnVuY3Rpb24gcmVuZGVyVG9TdHJpbmdBc3luYyhmbiwgb3B0aW9ucykge1xuICB0aHJvd0luQnJvd3NlcihyZW5kZXJUb1N0cmluZ0FzeW5jKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyZWFtKGZuLCBvcHRpb25zKSB7XG4gIHRocm93SW5Ccm93c2VyKHJlbmRlclRvU3RyZWFtKTtcbn1cbmZ1bmN0aW9uIHNzcih0ZW1wbGF0ZSwgLi4ubm9kZXMpIHt9XG5mdW5jdGlvbiBzc3JFbGVtZW50KG5hbWUsIHByb3BzLCBjaGlsZHJlbiwgbmVlZHNJZCkge31cbmZ1bmN0aW9uIHNzckNsYXNzTGlzdCh2YWx1ZSkge31cbmZ1bmN0aW9uIHNzclN0eWxlKHZhbHVlKSB7fVxuZnVuY3Rpb24gc3NyQXR0cmlidXRlKGtleSwgdmFsdWUpIHt9XG5mdW5jdGlvbiBzc3JIeWRyYXRpb25LZXkoKSB7fVxuZnVuY3Rpb24gcmVzb2x2ZVNTUk5vZGUobm9kZSkge31cbmZ1bmN0aW9uIGVzY2FwZShodG1sKSB7fVxuZnVuY3Rpb24gc3NyU3ByZWFkKHByb3BzLCBpc1NWRywgc2tpcENoaWxkcmVuKSB7fVxuXG5jb25zdCBpc1NlcnZlciA9IGZhbHNlO1xuY29uc3QgaXNEZXYgPSB0cnVlO1xuY29uc3QgU1ZHX05BTUVTUEFDRSA9IFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIjtcbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQodGFnTmFtZSwgaXNTVkcgPSBmYWxzZSkge1xuICByZXR1cm4gaXNTVkcgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoU1ZHX05BTUVTUEFDRSwgdGFnTmFtZSkgOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xufVxuY29uc3QgaHlkcmF0ZSA9ICguLi5hcmdzKSA9PiB7XG4gIGVuYWJsZUh5ZHJhdGlvbigpO1xuICByZXR1cm4gaHlkcmF0ZSQxKC4uLmFyZ3MpO1xufTtcbmZ1bmN0aW9uIFBvcnRhbChwcm9wcykge1xuICBjb25zdCB7XG4gICAgICB1c2VTaGFkb3dcbiAgICB9ID0gcHJvcHMsXG4gICAgbWFya2VyID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcIiksXG4gICAgbW91bnQgPSAoKSA9PiBwcm9wcy5tb3VudCB8fCBkb2N1bWVudC5ib2R5LFxuICAgIG93bmVyID0gZ2V0T3duZXIoKTtcbiAgbGV0IGNvbnRlbnQ7XG4gIGxldCBoeWRyYXRpbmcgPSAhIXNoYXJlZENvbmZpZy5jb250ZXh0O1xuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChoeWRyYXRpbmcpIGdldE93bmVyKCkudXNlciA9IGh5ZHJhdGluZyA9IGZhbHNlO1xuICAgIGNvbnRlbnQgfHwgKGNvbnRlbnQgPSBydW5XaXRoT3duZXIob3duZXIsICgpID0+IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMuY2hpbGRyZW4pKSk7XG4gICAgY29uc3QgZWwgPSBtb3VudCgpO1xuICAgIGlmIChlbCBpbnN0YW5jZW9mIEhUTUxIZWFkRWxlbWVudCkge1xuICAgICAgY29uc3QgW2NsZWFuLCBzZXRDbGVhbl0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICAgICAgY29uc3QgY2xlYW51cCA9ICgpID0+IHNldENsZWFuKHRydWUpO1xuICAgICAgY3JlYXRlUm9vdChkaXNwb3NlID0+IGluc2VydChlbCwgKCkgPT4gIWNsZWFuKCkgPyBjb250ZW50KCkgOiBkaXNwb3NlKCksIG51bGwpKTtcbiAgICAgIG9uQ2xlYW51cChjbGVhbnVwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgY29udGFpbmVyID0gY3JlYXRlRWxlbWVudChwcm9wcy5pc1NWRyA/IFwiZ1wiIDogXCJkaXZcIiwgcHJvcHMuaXNTVkcpLFxuICAgICAgICByZW5kZXJSb290ID0gdXNlU2hhZG93ICYmIGNvbnRhaW5lci5hdHRhY2hTaGFkb3cgPyBjb250YWluZXIuYXR0YWNoU2hhZG93KHtcbiAgICAgICAgICBtb2RlOiBcIm9wZW5cIlxuICAgICAgICB9KSA6IGNvbnRhaW5lcjtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb250YWluZXIsIFwiXyRob3N0XCIsIHtcbiAgICAgICAgZ2V0KCkge1xuICAgICAgICAgIHJldHVybiBtYXJrZXIucGFyZW50Tm9kZTtcbiAgICAgICAgfSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIGluc2VydChyZW5kZXJSb290LCBjb250ZW50KTtcbiAgICAgIGVsLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG4gICAgICBwcm9wcy5yZWYgJiYgcHJvcHMucmVmKGNvbnRhaW5lcik7XG4gICAgICBvbkNsZWFudXAoKCkgPT4gZWwucmVtb3ZlQ2hpbGQoY29udGFpbmVyKSk7XG4gICAgfVxuICB9LCB1bmRlZmluZWQsIHtcbiAgICByZW5kZXI6ICFoeWRyYXRpbmdcbiAgfSk7XG4gIHJldHVybiBtYXJrZXI7XG59XG5mdW5jdGlvbiBjcmVhdGVEeW5hbWljKGNvbXBvbmVudCwgcHJvcHMpIHtcbiAgY29uc3QgY2FjaGVkID0gY3JlYXRlTWVtbyhjb21wb25lbnQpO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgY29tcG9uZW50ID0gY2FjaGVkKCk7XG4gICAgc3dpdGNoICh0eXBlb2YgY29tcG9uZW50KSB7XG4gICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgICAgT2JqZWN0LmFzc2lnbihjb21wb25lbnQsIHtcbiAgICAgICAgICBbJERFVkNPTVBdOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdW50cmFjaygoKSA9PiBjb21wb25lbnQocHJvcHMpKTtcbiAgICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgICAgY29uc3QgaXNTdmcgPSBTVkdFbGVtZW50cy5oYXMoY29tcG9uZW50KTtcbiAgICAgICAgY29uc3QgZWwgPSBzaGFyZWRDb25maWcuY29udGV4dCA/IGdldE5leHRFbGVtZW50KCkgOiBjcmVhdGVFbGVtZW50KGNvbXBvbmVudCwgaXNTdmcpO1xuICAgICAgICBzcHJlYWQoZWwsIHByb3BzLCBpc1N2Zyk7XG4gICAgICAgIHJldHVybiBlbDtcbiAgICB9XG4gIH0pO1xufVxuZnVuY3Rpb24gRHluYW1pYyhwcm9wcykge1xuICBjb25zdCBbLCBvdGhlcnNdID0gc3BsaXRQcm9wcyhwcm9wcywgW1wiY29tcG9uZW50XCJdKTtcbiAgcmV0dXJuIGNyZWF0ZUR5bmFtaWMoKCkgPT4gcHJvcHMuY29tcG9uZW50LCBvdGhlcnMpO1xufVxuXG5leHBvcnQgeyBBbGlhc2VzLCB2b2lkRm4gYXMgQXNzZXRzLCBDaGlsZFByb3BlcnRpZXMsIERPTUVsZW1lbnRzLCBEZWxlZ2F0ZWRFdmVudHMsIER5bmFtaWMsIEh5ZHJhdGlvbiwgdm9pZEZuIGFzIEh5ZHJhdGlvblNjcmlwdCwgTm9IeWRyYXRpb24sIFBvcnRhbCwgUHJvcGVydGllcywgUmVxdWVzdENvbnRleHQsIFNWR0VsZW1lbnRzLCBTVkdOYW1lc3BhY2UsIGFkZEV2ZW50TGlzdGVuZXIsIGFzc2lnbiwgY2xhc3NMaXN0LCBjbGFzc05hbWUsIGNsZWFyRGVsZWdhdGVkRXZlbnRzLCBjcmVhdGVEeW5hbWljLCBkZWxlZ2F0ZUV2ZW50cywgZHluYW1pY1Byb3BlcnR5LCBlc2NhcGUsIHZvaWRGbiBhcyBnZW5lcmF0ZUh5ZHJhdGlvblNjcmlwdCwgdm9pZEZuIGFzIGdldEFzc2V0cywgZ2V0SHlkcmF0aW9uS2V5LCBnZXROZXh0RWxlbWVudCwgZ2V0TmV4dE1hcmtlciwgZ2V0TmV4dE1hdGNoLCBnZXRQcm9wQWxpYXMsIHZvaWRGbiBhcyBnZXRSZXF1ZXN0RXZlbnQsIGh5ZHJhdGUsIGlubmVySFRNTCwgaW5zZXJ0LCBpc0RldiwgaXNTZXJ2ZXIsIG1lbW8sIHJlbmRlciwgcmVuZGVyVG9TdHJlYW0sIHJlbmRlclRvU3RyaW5nLCByZW5kZXJUb1N0cmluZ0FzeW5jLCByZXNvbHZlU1NSTm9kZSwgcnVuSHlkcmF0aW9uRXZlbnRzLCBzZXRBdHRyaWJ1dGUsIHNldEF0dHJpYnV0ZU5TLCBzZXRCb29sQXR0cmlidXRlLCBzZXRQcm9wZXJ0eSwgc3ByZWFkLCBzc3IsIHNzckF0dHJpYnV0ZSwgc3NyQ2xhc3NMaXN0LCBzc3JFbGVtZW50LCBzc3JIeWRyYXRpb25LZXksIHNzclNwcmVhZCwgc3NyU3R5bGUsIHN0eWxlLCB0ZW1wbGF0ZSwgdXNlLCB2b2lkRm4gYXMgdXNlQXNzZXRzIH07XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCIvLyBHZW5lcmF0ZWQgdXNpbmcgYG5wbSBydW4gYnVpbGRgLiBEbyBub3QgZWRpdC5cblxudmFyIHJlZ2V4ID0gL15bYS16XSg/OltcXC4wLTlfYS16XFx4QjdcXHhDMC1cXHhENlxceEQ4LVxceEY2XFx4RjgtXFx1MDM3RFxcdTAzN0YtXFx1MUZGRlxcdTIwMENcXHUyMDBEXFx1MjAzRlxcdTIwNDBcXHUyMDcwLVxcdTIxOEZcXHUyQzAwLVxcdTJGRUZcXHUzMDAxLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRkRdfFtcXHVEODAwLVxcdURCN0ZdW1xcdURDMDAtXFx1REZGRl0pKi0oPzpbXFx4MkRcXC4wLTlfYS16XFx4QjdcXHhDMC1cXHhENlxceEQ4LVxceEY2XFx4RjgtXFx1MDM3RFxcdTAzN0YtXFx1MUZGRlxcdTIwMENcXHUyMDBEXFx1MjAzRlxcdTIwNDBcXHUyMDcwLVxcdTIxOEZcXHUyQzAwLVxcdTJGRUZcXHUzMDAxLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRkRdfFtcXHVEODAwLVxcdURCN0ZdW1xcdURDMDAtXFx1REZGRl0pKiQvO1xuXG52YXIgaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSA9IGZ1bmN0aW9uKHN0cmluZykge1xuXHRyZXR1cm4gcmVnZXgudGVzdChzdHJpbmcpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lO1xuIiwidmFyIF9fYXN5bmMgPSAoX190aGlzLCBfX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSA9PiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgdmFyIGZ1bGZpbGxlZCA9ICh2YWx1ZSkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZWplY3QoZSk7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgcmVqZWN0ZWQgPSAodmFsdWUpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHN0ZXAoZ2VuZXJhdG9yLnRocm93KHZhbHVlKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciBzdGVwID0gKHgpID0+IHguZG9uZSA/IHJlc29sdmUoeC52YWx1ZSkgOiBQcm9taXNlLnJlc29sdmUoeC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTtcbiAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkoX190aGlzLCBfX2FyZ3VtZW50cykpLm5leHQoKSk7XG4gIH0pO1xufTtcblxuLy8gc3JjL2luZGV4LnRzXG5pbXBvcnQgaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSBmcm9tIFwiaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWVcIjtcbmZ1bmN0aW9uIGNyZWF0ZUlzb2xhdGVkRWxlbWVudChvcHRpb25zKSB7XG4gIHJldHVybiBfX2FzeW5jKHRoaXMsIG51bGwsIGZ1bmN0aW9uKiAoKSB7XG4gICAgY29uc3QgeyBuYW1lLCBtb2RlID0gXCJjbG9zZWRcIiwgY3NzLCBpc29sYXRlRXZlbnRzID0gZmFsc2UgfSA9IG9wdGlvbnM7XG4gICAgaWYgKCFpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lKG5hbWUpKSB7XG4gICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgYFwiJHtuYW1lfVwiIGlzIG5vdCBhIHZhbGlkIGN1c3RvbSBlbGVtZW50IG5hbWUuIEl0IG11c3QgYmUgdHdvIHdvcmRzIGFuZCBrZWJhYi1jYXNlLCB3aXRoIGEgZmV3IGV4Y2VwdGlvbnMuIFNlZSBzcGVjIGZvciBtb3JlIGRldGFpbHM6IGh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL2N1c3RvbS1lbGVtZW50cy5odG1sI3ZhbGlkLWN1c3RvbS1lbGVtZW50LW5hbWVgXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCBwYXJlbnRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChuYW1lKTtcbiAgICBjb25zdCBzaGFkb3cgPSBwYXJlbnRFbGVtZW50LmF0dGFjaFNoYWRvdyh7IG1vZGUgfSk7XG4gICAgY29uc3QgaXNvbGF0ZWRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImh0bWxcIik7XG4gICAgY29uc3QgYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJib2R5XCIpO1xuICAgIGNvbnN0IGhlYWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaGVhZFwiKTtcbiAgICBpZiAoY3NzKSB7XG4gICAgICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcbiAgICAgIGlmIChcInVybFwiIGluIGNzcykge1xuICAgICAgICBzdHlsZS50ZXh0Q29udGVudCA9IHlpZWxkIGZldGNoKGNzcy51cmwpLnRoZW4oKHJlcykgPT4gcmVzLnRleHQoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHlsZS50ZXh0Q29udGVudCA9IGNzcy50ZXh0Q29udGVudDtcbiAgICAgIH1cbiAgICAgIGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICAgIH1cbiAgICBpc29sYXRlZEVsZW1lbnQuYXBwZW5kQ2hpbGQoaGVhZCk7XG4gICAgaXNvbGF0ZWRFbGVtZW50LmFwcGVuZENoaWxkKGJvZHkpO1xuICAgIHNoYWRvdy5hcHBlbmRDaGlsZChpc29sYXRlZEVsZW1lbnQpO1xuICAgIGlmIChpc29sYXRlRXZlbnRzKSB7XG4gICAgICBjb25zdCBldmVudFR5cGVzID0gQXJyYXkuaXNBcnJheShpc29sYXRlRXZlbnRzKSA/IGlzb2xhdGVFdmVudHMgOiBbXCJrZXlkb3duXCIsIFwia2V5dXBcIiwgXCJrZXlwcmVzc1wiXTtcbiAgICAgIGV2ZW50VHlwZXMuZm9yRWFjaCgoZXZlbnRUeXBlKSA9PiB7XG4gICAgICAgIGJvZHkuYWRkRXZlbnRMaXN0ZW5lcihldmVudFR5cGUsIChlKSA9PiBlLnN0b3BQcm9wYWdhdGlvbigpKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgcGFyZW50RWxlbWVudCxcbiAgICAgIHNoYWRvdyxcbiAgICAgIGlzb2xhdGVkRWxlbWVudDogYm9keVxuICAgIH07XG4gIH0pO1xufVxuZXhwb3J0IHtcbiAgY3JlYXRlSXNvbGF0ZWRFbGVtZW50XG59O1xuIiwiY29uc3QgbnVsbEtleSA9IFN5bWJvbCgnbnVsbCcpOyAvLyBgb2JqZWN0SGFzaGVzYCBrZXkgZm9yIG51bGxcblxubGV0IGtleUNvdW50ZXIgPSAwO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNYW55S2V5c01hcCBleHRlbmRzIE1hcCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9vYmplY3RIYXNoZXMgPSBuZXcgV2Vha01hcCgpO1xuXHRcdHRoaXMuX3N5bWJvbEhhc2hlcyA9IG5ldyBNYXAoKTsgLy8gaHR0cHM6Ly9naXRodWIuY29tL3RjMzkvZWNtYTI2Mi9pc3N1ZXMvMTE5NFxuXHRcdHRoaXMuX3B1YmxpY0tleXMgPSBuZXcgTWFwKCk7XG5cblx0XHRjb25zdCBbcGFpcnNdID0gYXJndW1lbnRzOyAvLyBNYXAgY29tcGF0XG5cdFx0aWYgKHBhaXJzID09PSBudWxsIHx8IHBhaXJzID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHBhaXJzW1N5bWJvbC5pdGVyYXRvcl0gIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IodHlwZW9mIHBhaXJzICsgJyBpcyBub3QgaXRlcmFibGUgKGNhbm5vdCByZWFkIHByb3BlcnR5IFN5bWJvbChTeW1ib2wuaXRlcmF0b3IpKScpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgW2tleXMsIHZhbHVlXSBvZiBwYWlycykge1xuXHRcdFx0dGhpcy5zZXQoa2V5cywgdmFsdWUpO1xuXHRcdH1cblx0fVxuXG5cdF9nZXRQdWJsaWNLZXlzKGtleXMsIGNyZWF0ZSA9IGZhbHNlKSB7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGtleXMpKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUga2V5cyBwYXJhbWV0ZXIgbXVzdCBiZSBhbiBhcnJheScpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByaXZhdGVLZXkgPSB0aGlzLl9nZXRQcml2YXRlS2V5KGtleXMsIGNyZWF0ZSk7XG5cblx0XHRsZXQgcHVibGljS2V5O1xuXHRcdGlmIChwcml2YXRlS2V5ICYmIHRoaXMuX3B1YmxpY0tleXMuaGFzKHByaXZhdGVLZXkpKSB7XG5cdFx0XHRwdWJsaWNLZXkgPSB0aGlzLl9wdWJsaWNLZXlzLmdldChwcml2YXRlS2V5KTtcblx0XHR9IGVsc2UgaWYgKGNyZWF0ZSkge1xuXHRcdFx0cHVibGljS2V5ID0gWy4uLmtleXNdOyAvLyBSZWdlbmVyYXRlIGtleXMgYXJyYXkgdG8gYXZvaWQgZXh0ZXJuYWwgaW50ZXJhY3Rpb25cblx0XHRcdHRoaXMuX3B1YmxpY0tleXMuc2V0KHByaXZhdGVLZXksIHB1YmxpY0tleSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtwcml2YXRlS2V5LCBwdWJsaWNLZXl9O1xuXHR9XG5cblx0X2dldFByaXZhdGVLZXkoa2V5cywgY3JlYXRlID0gZmFsc2UpIHtcblx0XHRjb25zdCBwcml2YXRlS2V5cyA9IFtdO1xuXHRcdGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG5cdFx0XHRpZiAoa2V5ID09PSBudWxsKSB7XG5cdFx0XHRcdGtleSA9IG51bGxLZXk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGhhc2hlcyA9IHR5cGVvZiBrZXkgPT09ICdvYmplY3QnIHx8IHR5cGVvZiBrZXkgPT09ICdmdW5jdGlvbicgPyAnX29iamVjdEhhc2hlcycgOiAodHlwZW9mIGtleSA9PT0gJ3N5bWJvbCcgPyAnX3N5bWJvbEhhc2hlcycgOiBmYWxzZSk7XG5cblx0XHRcdGlmICghaGFzaGVzKSB7XG5cdFx0XHRcdHByaXZhdGVLZXlzLnB1c2goa2V5KTtcblx0XHRcdH0gZWxzZSBpZiAodGhpc1toYXNoZXNdLmhhcyhrZXkpKSB7XG5cdFx0XHRcdHByaXZhdGVLZXlzLnB1c2godGhpc1toYXNoZXNdLmdldChrZXkpKTtcblx0XHRcdH0gZWxzZSBpZiAoY3JlYXRlKSB7XG5cdFx0XHRcdGNvbnN0IHByaXZhdGVLZXkgPSBgQEBta20tcmVmLSR7a2V5Q291bnRlcisrfUBAYDtcblx0XHRcdFx0dGhpc1toYXNoZXNdLnNldChrZXksIHByaXZhdGVLZXkpO1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKHByaXZhdGVLZXkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeShwcml2YXRlS2V5cyk7XG5cdH1cblxuXHRzZXQoa2V5cywgdmFsdWUpIHtcblx0XHRjb25zdCB7cHVibGljS2V5fSA9IHRoaXMuX2dldFB1YmxpY0tleXMoa2V5cywgdHJ1ZSk7XG5cdFx0cmV0dXJuIHN1cGVyLnNldChwdWJsaWNLZXksIHZhbHVlKTtcblx0fVxuXG5cdGdldChrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBzdXBlci5nZXQocHVibGljS2V5KTtcblx0fVxuXG5cdGhhcyhrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBzdXBlci5oYXMocHVibGljS2V5KTtcblx0fVxuXG5cdGRlbGV0ZShrZXlzKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleSwgcHJpdmF0ZUtleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMpO1xuXHRcdHJldHVybiBCb29sZWFuKHB1YmxpY0tleSAmJiBzdXBlci5kZWxldGUocHVibGljS2V5KSAmJiB0aGlzLl9wdWJsaWNLZXlzLmRlbGV0ZShwcml2YXRlS2V5KSk7XG5cdH1cblxuXHRjbGVhcigpIHtcblx0XHRzdXBlci5jbGVhcigpO1xuXHRcdHRoaXMuX3N5bWJvbEhhc2hlcy5jbGVhcigpO1xuXHRcdHRoaXMuX3B1YmxpY0tleXMuY2xlYXIoKTtcblx0fVxuXG5cdGdldCBbU3ltYm9sLnRvU3RyaW5nVGFnXSgpIHtcblx0XHRyZXR1cm4gJ01hbnlLZXlzTWFwJztcblx0fVxuXG5cdGdldCBzaXplKCkge1xuXHRcdHJldHVybiBzdXBlci5zaXplO1xuXHR9XG59XG4iLCJmdW5jdGlvbiBpc1BsYWluT2JqZWN0KHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgcHJvdG90eXBlID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKTtcbiAgaWYgKHByb3RvdHlwZSAhPT0gbnVsbCAmJiBwcm90b3R5cGUgIT09IE9iamVjdC5wcm90b3R5cGUgJiYgT2JqZWN0LmdldFByb3RvdHlwZU9mKHByb3RvdHlwZSkgIT09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKFN5bWJvbC5pdGVyYXRvciBpbiB2YWx1ZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoU3ltYm9sLnRvU3RyaW5nVGFnIGluIHZhbHVlKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT09IFwiW29iamVjdCBNb2R1bGVdXCI7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIF9kZWZ1KGJhc2VPYmplY3QsIGRlZmF1bHRzLCBuYW1lc3BhY2UgPSBcIi5cIiwgbWVyZ2VyKSB7XG4gIGlmICghaXNQbGFpbk9iamVjdChkZWZhdWx0cykpIHtcbiAgICByZXR1cm4gX2RlZnUoYmFzZU9iamVjdCwge30sIG5hbWVzcGFjZSwgbWVyZ2VyKTtcbiAgfVxuICBjb25zdCBvYmplY3QgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0cyk7XG4gIGZvciAoY29uc3Qga2V5IGluIGJhc2VPYmplY3QpIHtcbiAgICBpZiAoa2V5ID09PSBcIl9fcHJvdG9fX1wiIHx8IGtleSA9PT0gXCJjb25zdHJ1Y3RvclwiKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSBiYXNlT2JqZWN0W2tleV07XG4gICAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB2b2lkIDApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAobWVyZ2VyICYmIG1lcmdlcihvYmplY3QsIGtleSwgdmFsdWUsIG5hbWVzcGFjZSkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgQXJyYXkuaXNBcnJheShvYmplY3Rba2V5XSkpIHtcbiAgICAgIG9iamVjdFtrZXldID0gWy4uLnZhbHVlLCAuLi5vYmplY3Rba2V5XV07XG4gICAgfSBlbHNlIGlmIChpc1BsYWluT2JqZWN0KHZhbHVlKSAmJiBpc1BsYWluT2JqZWN0KG9iamVjdFtrZXldKSkge1xuICAgICAgb2JqZWN0W2tleV0gPSBfZGVmdShcbiAgICAgICAgdmFsdWUsXG4gICAgICAgIG9iamVjdFtrZXldLFxuICAgICAgICAobmFtZXNwYWNlID8gYCR7bmFtZXNwYWNlfS5gIDogXCJcIikgKyBrZXkudG9TdHJpbmcoKSxcbiAgICAgICAgbWVyZ2VyXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBvYmplY3Rba2V5XSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gb2JqZWN0O1xufVxuZnVuY3Rpb24gY3JlYXRlRGVmdShtZXJnZXIpIHtcbiAgcmV0dXJuICguLi5hcmd1bWVudHNfKSA9PiAoXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHVuaWNvcm4vbm8tYXJyYXktcmVkdWNlXG4gICAgYXJndW1lbnRzXy5yZWR1Y2UoKHAsIGMpID0+IF9kZWZ1KHAsIGMsIFwiXCIsIG1lcmdlciksIHt9KVxuICApO1xufVxuY29uc3QgZGVmdSA9IGNyZWF0ZURlZnUoKTtcbmNvbnN0IGRlZnVGbiA9IGNyZWF0ZURlZnUoKG9iamVjdCwga2V5LCBjdXJyZW50VmFsdWUpID0+IHtcbiAgaWYgKG9iamVjdFtrZXldICE9PSB2b2lkIDAgJiYgdHlwZW9mIGN1cnJlbnRWYWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgb2JqZWN0W2tleV0gPSBjdXJyZW50VmFsdWUob2JqZWN0W2tleV0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59KTtcbmNvbnN0IGRlZnVBcnJheUZuID0gY3JlYXRlRGVmdSgob2JqZWN0LCBrZXksIGN1cnJlbnRWYWx1ZSkgPT4ge1xuICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3Rba2V5XSkgJiYgdHlwZW9mIGN1cnJlbnRWYWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgb2JqZWN0W2tleV0gPSBjdXJyZW50VmFsdWUob2JqZWN0W2tleV0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59KTtcblxuZXhwb3J0IHsgY3JlYXRlRGVmdSwgZGVmdSBhcyBkZWZhdWx0LCBkZWZ1LCBkZWZ1QXJyYXlGbiwgZGVmdUZuIH07XG4iLCJjb25zdCBpc0V4aXN0ID0gKGVsZW1lbnQpID0+IHtcbiAgcmV0dXJuIGVsZW1lbnQgIT09IG51bGwgPyB7IGlzRGV0ZWN0ZWQ6IHRydWUsIHJlc3VsdDogZWxlbWVudCB9IDogeyBpc0RldGVjdGVkOiBmYWxzZSB9O1xufTtcbmNvbnN0IGlzTm90RXhpc3QgPSAoZWxlbWVudCkgPT4ge1xuICByZXR1cm4gZWxlbWVudCA9PT0gbnVsbCA/IHsgaXNEZXRlY3RlZDogdHJ1ZSwgcmVzdWx0OiBudWxsIH0gOiB7IGlzRGV0ZWN0ZWQ6IGZhbHNlIH07XG59O1xuXG5leHBvcnQgeyBpc0V4aXN0LCBpc05vdEV4aXN0IH07XG4iLCJpbXBvcnQgTWFueUtleXNNYXAgZnJvbSAnbWFueS1rZXlzLW1hcCc7XG5pbXBvcnQgeyBkZWZ1IH0gZnJvbSAnZGVmdSc7XG5pbXBvcnQgeyBpc0V4aXN0IH0gZnJvbSAnLi9kZXRlY3RvcnMubWpzJztcblxuY29uc3QgZ2V0RGVmYXVsdE9wdGlvbnMgPSAoKSA9PiAoe1xuICB0YXJnZXQ6IGdsb2JhbFRoaXMuZG9jdW1lbnQsXG4gIHVuaWZ5UHJvY2VzczogdHJ1ZSxcbiAgZGV0ZWN0b3I6IGlzRXhpc3QsXG4gIG9ic2VydmVDb25maWdzOiB7XG4gICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgIHN1YnRyZWU6IHRydWUsXG4gICAgYXR0cmlidXRlczogdHJ1ZVxuICB9LFxuICBzaWduYWw6IHZvaWQgMCxcbiAgY3VzdG9tTWF0Y2hlcjogdm9pZCAwXG59KTtcbmNvbnN0IG1lcmdlT3B0aW9ucyA9ICh1c2VyU2lkZU9wdGlvbnMsIGRlZmF1bHRPcHRpb25zKSA9PiB7XG4gIHJldHVybiBkZWZ1KHVzZXJTaWRlT3B0aW9ucywgZGVmYXVsdE9wdGlvbnMpO1xufTtcblxuY29uc3QgdW5pZnlDYWNoZSA9IG5ldyBNYW55S2V5c01hcCgpO1xuZnVuY3Rpb24gY3JlYXRlV2FpdEVsZW1lbnQoaW5zdGFuY2VPcHRpb25zKSB7XG4gIGNvbnN0IHsgZGVmYXVsdE9wdGlvbnMgfSA9IGluc3RhbmNlT3B0aW9ucztcbiAgcmV0dXJuIChzZWxlY3Rvciwgb3B0aW9ucykgPT4ge1xuICAgIGNvbnN0IHtcbiAgICAgIHRhcmdldCxcbiAgICAgIHVuaWZ5UHJvY2VzcyxcbiAgICAgIG9ic2VydmVDb25maWdzLFxuICAgICAgZGV0ZWN0b3IsXG4gICAgICBzaWduYWwsXG4gICAgICBjdXN0b21NYXRjaGVyXG4gICAgfSA9IG1lcmdlT3B0aW9ucyhvcHRpb25zLCBkZWZhdWx0T3B0aW9ucyk7XG4gICAgY29uc3QgdW5pZnlQcm9taXNlS2V5ID0gW1xuICAgICAgc2VsZWN0b3IsXG4gICAgICB0YXJnZXQsXG4gICAgICB1bmlmeVByb2Nlc3MsXG4gICAgICBvYnNlcnZlQ29uZmlncyxcbiAgICAgIGRldGVjdG9yLFxuICAgICAgc2lnbmFsLFxuICAgICAgY3VzdG9tTWF0Y2hlclxuICAgIF07XG4gICAgY29uc3QgY2FjaGVkUHJvbWlzZSA9IHVuaWZ5Q2FjaGUuZ2V0KHVuaWZ5UHJvbWlzZUtleSk7XG4gICAgaWYgKHVuaWZ5UHJvY2VzcyAmJiBjYWNoZWRQcm9taXNlKSB7XG4gICAgICByZXR1cm4gY2FjaGVkUHJvbWlzZTtcbiAgICB9XG4gICAgY29uc3QgZGV0ZWN0UHJvbWlzZSA9IG5ldyBQcm9taXNlKFxuICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0FzeW5jUHJvbWlzZUV4ZWN1dG9yOiBhdm9pZCBuZXN0aW5nIHByb21pc2VcbiAgICAgIGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgIHJldHVybiByZWplY3Qoc2lnbmFsLnJlYXNvbik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihcbiAgICAgICAgICBhc3luYyAobXV0YXRpb25zKSA9PiB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IF8gb2YgbXV0YXRpb25zKSB7XG4gICAgICAgICAgICAgIGlmIChzaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29uc3QgZGV0ZWN0UmVzdWx0MiA9IGF3YWl0IGRldGVjdEVsZW1lbnQoe1xuICAgICAgICAgICAgICAgIHNlbGVjdG9yLFxuICAgICAgICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICAgICAgICBkZXRlY3RvcixcbiAgICAgICAgICAgICAgICBjdXN0b21NYXRjaGVyXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBpZiAoZGV0ZWN0UmVzdWx0Mi5pc0RldGVjdGVkKSB7XG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZGV0ZWN0UmVzdWx0Mi5yZXN1bHQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgICBzaWduYWw/LmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgXCJhYm9ydFwiLFxuICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIHJldHVybiByZWplY3Qoc2lnbmFsLnJlYXNvbik7XG4gICAgICAgICAgfSxcbiAgICAgICAgICB7IG9uY2U6IHRydWUgfVxuICAgICAgICApO1xuICAgICAgICBjb25zdCBkZXRlY3RSZXN1bHQgPSBhd2FpdCBkZXRlY3RFbGVtZW50KHtcbiAgICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgZGV0ZWN0b3IsXG4gICAgICAgICAgY3VzdG9tTWF0Y2hlclxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGRldGVjdFJlc3VsdC5pc0RldGVjdGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoZGV0ZWN0UmVzdWx0LnJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZSh0YXJnZXQsIG9ic2VydmVDb25maWdzKTtcbiAgICAgIH1cbiAgICApLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgdW5pZnlDYWNoZS5kZWxldGUodW5pZnlQcm9taXNlS2V5KTtcbiAgICB9KTtcbiAgICB1bmlmeUNhY2hlLnNldCh1bmlmeVByb21pc2VLZXksIGRldGVjdFByb21pc2UpO1xuICAgIHJldHVybiBkZXRlY3RQcm9taXNlO1xuICB9O1xufVxuYXN5bmMgZnVuY3Rpb24gZGV0ZWN0RWxlbWVudCh7XG4gIHRhcmdldCxcbiAgc2VsZWN0b3IsXG4gIGRldGVjdG9yLFxuICBjdXN0b21NYXRjaGVyXG59KSB7XG4gIGNvbnN0IGVsZW1lbnQgPSBjdXN0b21NYXRjaGVyID8gY3VzdG9tTWF0Y2hlcihzZWxlY3RvcikgOiB0YXJnZXQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gIHJldHVybiBhd2FpdCBkZXRlY3RvcihlbGVtZW50KTtcbn1cbmNvbnN0IHdhaXRFbGVtZW50ID0gY3JlYXRlV2FpdEVsZW1lbnQoe1xuICBkZWZhdWx0T3B0aW9uczogZ2V0RGVmYXVsdE9wdGlvbnMoKVxufSk7XG5cbmV4cG9ydCB7IGNyZWF0ZVdhaXRFbGVtZW50LCBnZXREZWZhdWx0T3B0aW9ucywgd2FpdEVsZW1lbnQgfTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyB3YWl0RWxlbWVudCB9IGZyb20gXCJAMW5hdHN1L3dhaXQtZWxlbWVudFwiO1xuaW1wb3J0IHtcbiAgaXNFeGlzdCBhcyBtb3VudERldGVjdG9yLFxuICBpc05vdEV4aXN0IGFzIHJlbW92ZURldGVjdG9yXG59IGZyb20gXCJAMW5hdHN1L3dhaXQtZWxlbWVudC9kZXRlY3RvcnNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi8uLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gYXBwbHlQb3NpdGlvbihyb290LCBwb3NpdGlvbmVkRWxlbWVudCwgb3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5wb3NpdGlvbiA9PT0gXCJpbmxpbmVcIikgcmV0dXJuO1xuICBpZiAob3B0aW9ucy56SW5kZXggIT0gbnVsbCkgcm9vdC5zdHlsZS56SW5kZXggPSBTdHJpbmcob3B0aW9ucy56SW5kZXgpO1xuICByb290LnN0eWxlLm92ZXJmbG93ID0gXCJ2aXNpYmxlXCI7XG4gIHJvb3Quc3R5bGUucG9zaXRpb24gPSBcInJlbGF0aXZlXCI7XG4gIHJvb3Quc3R5bGUud2lkdGggPSBcIjBcIjtcbiAgcm9vdC5zdHlsZS5oZWlnaHQgPSBcIjBcIjtcbiAgcm9vdC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICBpZiAocG9zaXRpb25lZEVsZW1lbnQpIHtcbiAgICBpZiAob3B0aW9ucy5wb3NpdGlvbiA9PT0gXCJvdmVybGF5XCIpIHtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xuICAgICAgaWYgKG9wdGlvbnMuYWxpZ25tZW50Py5zdGFydHNXaXRoKFwiYm90dG9tLVwiKSlcbiAgICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUuYm90dG9tID0gXCIwXCI7XG4gICAgICBlbHNlIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiO1xuICAgICAgaWYgKG9wdGlvbnMuYWxpZ25tZW50Py5lbmRzV2l0aChcIi1yaWdodFwiKSlcbiAgICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIjtcbiAgICAgIGVsc2UgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUubGVmdCA9IFwiMFwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUuYm90dG9tID0gXCIwXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5sZWZ0ID0gXCIwXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMFwiO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIGdldEFuY2hvcihvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zLmFuY2hvciA9PSBudWxsKSByZXR1cm4gZG9jdW1lbnQuYm9keTtcbiAgbGV0IHJlc29sdmVkID0gdHlwZW9mIG9wdGlvbnMuYW5jaG9yID09PSBcImZ1bmN0aW9uXCIgPyBvcHRpb25zLmFuY2hvcigpIDogb3B0aW9ucy5hbmNob3I7XG4gIGlmICh0eXBlb2YgcmVzb2x2ZWQgPT09IFwic3RyaW5nXCIpIHtcbiAgICBpZiAocmVzb2x2ZWQuc3RhcnRzV2l0aChcIi9cIikpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGRvY3VtZW50LmV2YWx1YXRlKFxuICAgICAgICByZXNvbHZlZCxcbiAgICAgICAgZG9jdW1lbnQsXG4gICAgICAgIG51bGwsXG4gICAgICAgIFhQYXRoUmVzdWx0LkZJUlNUX09SREVSRURfTk9ERV9UWVBFLFxuICAgICAgICBudWxsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlc3VsdC5zaW5nbGVOb2RlVmFsdWUgPz8gdm9pZCAwO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihyZXNvbHZlZCkgPz8gdm9pZCAwO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzb2x2ZWQgPz8gdm9pZCAwO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG1vdW50VWkocm9vdCwgb3B0aW9ucykge1xuICBjb25zdCBhbmNob3IgPSBnZXRBbmNob3Iob3B0aW9ucyk7XG4gIGlmIChhbmNob3IgPT0gbnVsbClcbiAgICB0aHJvdyBFcnJvcihcbiAgICAgIFwiRmFpbGVkIHRvIG1vdW50IGNvbnRlbnQgc2NyaXB0IFVJOiBjb3VsZCBub3QgZmluZCBhbmNob3IgZWxlbWVudFwiXG4gICAgKTtcbiAgc3dpdGNoIChvcHRpb25zLmFwcGVuZCkge1xuICAgIGNhc2Ugdm9pZCAwOlxuICAgIGNhc2UgXCJsYXN0XCI6XG4gICAgICBhbmNob3IuYXBwZW5kKHJvb3QpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImZpcnN0XCI6XG4gICAgICBhbmNob3IucHJlcGVuZChyb290KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJyZXBsYWNlXCI6XG4gICAgICBhbmNob3IucmVwbGFjZVdpdGgocm9vdCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiYWZ0ZXJcIjpcbiAgICAgIGFuY2hvci5wYXJlbnRFbGVtZW50Py5pbnNlcnRCZWZvcmUocm9vdCwgYW5jaG9yLm5leHRFbGVtZW50U2libGluZyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiYmVmb3JlXCI6XG4gICAgICBhbmNob3IucGFyZW50RWxlbWVudD8uaW5zZXJ0QmVmb3JlKHJvb3QsIGFuY2hvcik7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgb3B0aW9ucy5hcHBlbmQoYW5jaG9yLCByb290KTtcbiAgICAgIGJyZWFrO1xuICB9XG59XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTW91bnRGdW5jdGlvbnMoYmFzZUZ1bmN0aW9ucywgb3B0aW9ucykge1xuICBsZXQgYXV0b01vdW50SW5zdGFuY2UgPSB2b2lkIDA7XG4gIGNvbnN0IHN0b3BBdXRvTW91bnQgPSAoKSA9PiB7XG4gICAgYXV0b01vdW50SW5zdGFuY2U/LnN0b3BBdXRvTW91bnQoKTtcbiAgICBhdXRvTW91bnRJbnN0YW5jZSA9IHZvaWQgMDtcbiAgfTtcbiAgY29uc3QgbW91bnQgPSAoKSA9PiB7XG4gICAgYmFzZUZ1bmN0aW9ucy5tb3VudCgpO1xuICB9O1xuICBjb25zdCB1bm1vdW50ID0gYmFzZUZ1bmN0aW9ucy5yZW1vdmU7XG4gIGNvbnN0IHJlbW92ZSA9ICgpID0+IHtcbiAgICBzdG9wQXV0b01vdW50KCk7XG4gICAgYmFzZUZ1bmN0aW9ucy5yZW1vdmUoKTtcbiAgfTtcbiAgY29uc3QgYXV0b01vdW50ID0gKGF1dG9Nb3VudE9wdGlvbnMpID0+IHtcbiAgICBpZiAoYXV0b01vdW50SW5zdGFuY2UpIHtcbiAgICAgIGxvZ2dlci53YXJuKFwiYXV0b01vdW50IGlzIGFscmVhZHkgc2V0LlwiKTtcbiAgICB9XG4gICAgYXV0b01vdW50SW5zdGFuY2UgPSBhdXRvTW91bnRVaShcbiAgICAgIHsgbW91bnQsIHVubW91bnQsIHN0b3BBdXRvTW91bnQgfSxcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgLi4uYXV0b01vdW50T3B0aW9uc1xuICAgICAgfVxuICAgICk7XG4gIH07XG4gIHJldHVybiB7XG4gICAgbW91bnQsXG4gICAgcmVtb3ZlLFxuICAgIGF1dG9Nb3VudFxuICB9O1xufVxuZnVuY3Rpb24gYXV0b01vdW50VWkodWlDYWxsYmFja3MsIG9wdGlvbnMpIHtcbiAgY29uc3QgYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBjb25zdCBFWFBMSUNJVF9TVE9QX1JFQVNPTiA9IFwiZXhwbGljaXRfc3RvcF9hdXRvX21vdW50XCI7XG4gIGNvbnN0IF9zdG9wQXV0b01vdW50ID0gKCkgPT4ge1xuICAgIGFib3J0Q29udHJvbGxlci5hYm9ydChFWFBMSUNJVF9TVE9QX1JFQVNPTik7XG4gICAgb3B0aW9ucy5vblN0b3A/LigpO1xuICB9O1xuICBsZXQgcmVzb2x2ZWRBbmNob3IgPSB0eXBlb2Ygb3B0aW9ucy5hbmNob3IgPT09IFwiZnVuY3Rpb25cIiA/IG9wdGlvbnMuYW5jaG9yKCkgOiBvcHRpb25zLmFuY2hvcjtcbiAgaWYgKHJlc29sdmVkQW5jaG9yIGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgIHRocm93IEVycm9yKFxuICAgICAgXCJhdXRvTW91bnQgYW5kIEVsZW1lbnQgYW5jaG9yIG9wdGlvbiBjYW5ub3QgYmUgY29tYmluZWQuIEF2b2lkIHBhc3NpbmcgYEVsZW1lbnRgIGRpcmVjdGx5IG9yIGAoKSA9PiBFbGVtZW50YCB0byB0aGUgYW5jaG9yLlwiXG4gICAgKTtcbiAgfVxuICBhc3luYyBmdW5jdGlvbiBvYnNlcnZlRWxlbWVudChzZWxlY3Rvcikge1xuICAgIGxldCBpc0FuY2hvckV4aXN0ID0gISFnZXRBbmNob3Iob3B0aW9ucyk7XG4gICAgaWYgKGlzQW5jaG9yRXhpc3QpIHtcbiAgICAgIHVpQ2FsbGJhY2tzLm1vdW50KCk7XG4gICAgfVxuICAgIHdoaWxlICghYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjaGFuZ2VkQW5jaG9yID0gYXdhaXQgd2FpdEVsZW1lbnQoc2VsZWN0b3IgPz8gXCJib2R5XCIsIHtcbiAgICAgICAgICBjdXN0b21NYXRjaGVyOiAoKSA9PiBnZXRBbmNob3Iob3B0aW9ucykgPz8gbnVsbCxcbiAgICAgICAgICBkZXRlY3RvcjogaXNBbmNob3JFeGlzdCA/IHJlbW92ZURldGVjdG9yIDogbW91bnREZXRlY3RvcixcbiAgICAgICAgICBzaWduYWw6IGFib3J0Q29udHJvbGxlci5zaWduYWxcbiAgICAgICAgfSk7XG4gICAgICAgIGlzQW5jaG9yRXhpc3QgPSAhIWNoYW5nZWRBbmNob3I7XG4gICAgICAgIGlmIChpc0FuY2hvckV4aXN0KSB7XG4gICAgICAgICAgdWlDYWxsYmFja3MubW91bnQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB1aUNhbGxiYWNrcy51bm1vdW50KCk7XG4gICAgICAgICAgaWYgKG9wdGlvbnMub25jZSkge1xuICAgICAgICAgICAgdWlDYWxsYmFja3Muc3RvcEF1dG9Nb3VudCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgaWYgKGFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCAmJiBhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlYXNvbiA9PT0gRVhQTElDSVRfU1RPUF9SRUFTT04pIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBvYnNlcnZlRWxlbWVudChyZXNvbHZlZEFuY2hvcik7XG4gIHJldHVybiB7IHN0b3BBdXRvTW91bnQ6IF9zdG9wQXV0b01vdW50IH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gc3BsaXRTaGFkb3dSb290Q3NzKGNzcykge1xuICBsZXQgc2hhZG93Q3NzID0gY3NzO1xuICBsZXQgZG9jdW1lbnRDc3MgPSBcIlwiO1xuICBjb25zdCBydWxlc1JlZ2V4ID0gLyhcXHMqQChwcm9wZXJ0eXxmb250LWZhY2UpW1xcc1xcU10qP3tbXFxzXFxTXSo/fSkvZ207XG4gIGxldCBtYXRjaDtcbiAgd2hpbGUgKChtYXRjaCA9IHJ1bGVzUmVnZXguZXhlYyhjc3MpKSAhPT0gbnVsbCkge1xuICAgIGRvY3VtZW50Q3NzICs9IG1hdGNoWzFdO1xuICAgIHNoYWRvd0NzcyA9IHNoYWRvd0Nzcy5yZXBsYWNlKG1hdGNoWzFdLCBcIlwiKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIGRvY3VtZW50Q3NzOiBkb2N1bWVudENzcy50cmltKCksXG4gICAgc2hhZG93Q3NzOiBzaGFkb3dDc3MudHJpbSgpXG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBjcmVhdGVJc29sYXRlZEVsZW1lbnQgfSBmcm9tIFwiQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnRcIjtcbmltcG9ydCB7IGFwcGx5UG9zaXRpb24sIGNyZWF0ZU1vdW50RnVuY3Rpb25zLCBtb3VudFVpIH0gZnJvbSBcIi4vc2hhcmVkLm1qc1wiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7IHNwbGl0U2hhZG93Um9vdENzcyB9IGZyb20gXCIuLi9zcGxpdC1zaGFkb3ctcm9vdC1jc3MubWpzXCI7XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlU2hhZG93Um9vdFVpKGN0eCwgb3B0aW9ucykge1xuICBjb25zdCBpbnN0YW5jZUlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDIsIDE1KTtcbiAgY29uc3QgY3NzID0gW107XG4gIGlmICghb3B0aW9ucy5pbmhlcml0U3R5bGVzKSB7XG4gICAgY3NzLnB1c2goYC8qIFdYVCBTaGFkb3cgUm9vdCBSZXNldCAqLyA6aG9zdHthbGw6aW5pdGlhbCAhaW1wb3J0YW50O31gKTtcbiAgfVxuICBpZiAob3B0aW9ucy5jc3MpIHtcbiAgICBjc3MucHVzaChvcHRpb25zLmNzcyk7XG4gIH1cbiAgaWYgKGN0eC5vcHRpb25zPy5jc3NJbmplY3Rpb25Nb2RlID09PSBcInVpXCIpIHtcbiAgICBjb25zdCBlbnRyeUNzcyA9IGF3YWl0IGxvYWRDc3MoKTtcbiAgICBjc3MucHVzaChlbnRyeUNzcy5yZXBsYWNlQWxsKFwiOnJvb3RcIiwgXCI6aG9zdFwiKSk7XG4gIH1cbiAgY29uc3QgeyBzaGFkb3dDc3MsIGRvY3VtZW50Q3NzIH0gPSBzcGxpdFNoYWRvd1Jvb3RDc3MoY3NzLmpvaW4oXCJcXG5cIikudHJpbSgpKTtcbiAgY29uc3Qge1xuICAgIGlzb2xhdGVkRWxlbWVudDogdWlDb250YWluZXIsXG4gICAgcGFyZW50RWxlbWVudDogc2hhZG93SG9zdCxcbiAgICBzaGFkb3dcbiAgfSA9IGF3YWl0IGNyZWF0ZUlzb2xhdGVkRWxlbWVudCh7XG4gICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgIGNzczoge1xuICAgICAgdGV4dENvbnRlbnQ6IHNoYWRvd0Nzc1xuICAgIH0sXG4gICAgbW9kZTogb3B0aW9ucy5tb2RlID8/IFwib3BlblwiLFxuICAgIGlzb2xhdGVFdmVudHM6IG9wdGlvbnMuaXNvbGF0ZUV2ZW50c1xuICB9KTtcbiAgc2hhZG93SG9zdC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXd4dC1zaGFkb3ctcm9vdFwiLCBcIlwiKTtcbiAgbGV0IG1vdW50ZWQ7XG4gIGNvbnN0IG1vdW50ID0gKCkgPT4ge1xuICAgIG1vdW50VWkoc2hhZG93SG9zdCwgb3B0aW9ucyk7XG4gICAgYXBwbHlQb3NpdGlvbihzaGFkb3dIb3N0LCBzaGFkb3cucXVlcnlTZWxlY3RvcihcImh0bWxcIiksIG9wdGlvbnMpO1xuICAgIGlmIChkb2N1bWVudENzcyAmJiAhZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgIGBzdHlsZVt3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzPVwiJHtpbnN0YW5jZUlkfVwiXWBcbiAgICApKSB7XG4gICAgICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcbiAgICAgIHN0eWxlLnRleHRDb250ZW50ID0gZG9jdW1lbnRDc3M7XG4gICAgICBzdHlsZS5zZXRBdHRyaWJ1dGUoXCJ3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzXCIsIGluc3RhbmNlSWQpO1xuICAgICAgKGRvY3VtZW50LmhlYWQgPz8gZG9jdW1lbnQuYm9keSkuYXBwZW5kKHN0eWxlKTtcbiAgICB9XG4gICAgbW91bnRlZCA9IG9wdGlvbnMub25Nb3VudCh1aUNvbnRhaW5lciwgc2hhZG93LCBzaGFkb3dIb3N0KTtcbiAgfTtcbiAgY29uc3QgcmVtb3ZlID0gKCkgPT4ge1xuICAgIG9wdGlvbnMub25SZW1vdmU/Lihtb3VudGVkKTtcbiAgICBzaGFkb3dIb3N0LnJlbW92ZSgpO1xuICAgIGNvbnN0IGRvY3VtZW50U3R5bGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFxuICAgICAgYHN0eWxlW3d4dC1zaGFkb3ctcm9vdC1kb2N1bWVudC1zdHlsZXM9XCIke2luc3RhbmNlSWR9XCJdYFxuICAgICk7XG4gICAgZG9jdW1lbnRTdHlsZT8ucmVtb3ZlKCk7XG4gICAgd2hpbGUgKHVpQ29udGFpbmVyLmxhc3RDaGlsZClcbiAgICAgIHVpQ29udGFpbmVyLnJlbW92ZUNoaWxkKHVpQ29udGFpbmVyLmxhc3RDaGlsZCk7XG4gICAgbW91bnRlZCA9IHZvaWQgMDtcbiAgfTtcbiAgY29uc3QgbW91bnRGdW5jdGlvbnMgPSBjcmVhdGVNb3VudEZ1bmN0aW9ucyhcbiAgICB7XG4gICAgICBtb3VudCxcbiAgICAgIHJlbW92ZVxuICAgIH0sXG4gICAgb3B0aW9uc1xuICApO1xuICBjdHgub25JbnZhbGlkYXRlZChyZW1vdmUpO1xuICByZXR1cm4ge1xuICAgIHNoYWRvdyxcbiAgICBzaGFkb3dIb3N0LFxuICAgIHVpQ29udGFpbmVyLFxuICAgIC4uLm1vdW50RnVuY3Rpb25zLFxuICAgIGdldCBtb3VudGVkKCkge1xuICAgICAgcmV0dXJuIG1vdW50ZWQ7XG4gICAgfVxuICB9O1xufVxuYXN5bmMgZnVuY3Rpb24gbG9hZENzcygpIHtcbiAgY29uc3QgdXJsID0gYnJvd3Nlci5ydW50aW1lLmdldFVSTChgL2NvbnRlbnQtc2NyaXB0cy8ke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfS5jc3NgKTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwpO1xuICAgIHJldHVybiBhd2FpdCByZXMudGV4dCgpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBsb2dnZXIud2FybihcbiAgICAgIGBGYWlsZWQgdG8gbG9hZCBzdHlsZXMgQCAke3VybH0uIERpZCB5b3UgZm9yZ2V0IHRvIGltcG9ydCB0aGUgc3R5bGVzaGVldCBpbiB5b3VyIGVudHJ5cG9pbnQ/YCxcbiAgICAgIGVyclxuICAgICk7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVDb250ZW50U2NyaXB0KGRlZmluaXRpb24pIHtcbiAgcmV0dXJuIGRlZmluaXRpb247XG59XG4iLCJmdW5jdGlvbiByKGUpe3ZhciB0LGYsbj1cIlwiO2lmKFwic3RyaW5nXCI9PXR5cGVvZiBlfHxcIm51bWJlclwiPT10eXBlb2YgZSluKz1lO2Vsc2UgaWYoXCJvYmplY3RcIj09dHlwZW9mIGUpaWYoQXJyYXkuaXNBcnJheShlKSl7dmFyIG89ZS5sZW5ndGg7Zm9yKHQ9MDt0PG87dCsrKWVbdF0mJihmPXIoZVt0XSkpJiYobiYmKG4rPVwiIFwiKSxuKz1mKX1lbHNlIGZvcihmIGluIGUpZVtmXSYmKG4mJihuKz1cIiBcIiksbis9Zik7cmV0dXJuIG59ZXhwb3J0IGZ1bmN0aW9uIGNsc3goKXtmb3IodmFyIGUsdCxmPTAsbj1cIlwiLG89YXJndW1lbnRzLmxlbmd0aDtmPG87ZisrKShlPWFyZ3VtZW50c1tmXSkmJih0PXIoZSkpJiYobiYmKG4rPVwiIFwiKSxuKz10KTtyZXR1cm4gbn1leHBvcnQgZGVmYXVsdCBjbHN4OyIsImltcG9ydCB7IGNsc3gsIHR5cGUgQ2xhc3NWYWx1ZSB9IGZyb20gJ2Nsc3gnXG5cbmV4cG9ydCBmdW5jdGlvbiBjbiguLi5pbnB1dHM6IENsYXNzVmFsdWVbXSkge1xuICByZXR1cm4gY2xzeChpbnB1dHMpXG59IiwiaW1wb3J0IHsgU2hvdywgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQsIEpTWCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEhlYWRlclByb3BzIHtcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIGxvZ28/OiBKU1guRWxlbWVudDtcbiAgYWN0aW9ucz86IEpTWC5FbGVtZW50O1xuICB2YXJpYW50PzogJ2RlZmF1bHQnIHwgJ21pbmltYWwnIHwgJ3RyYW5zcGFyZW50JztcbiAgc3RpY2t5PzogYm9vbGVhbjtcbiAgc2hvd01lbnVCdXR0b24/OiBib29sZWFuO1xuICBvbk1lbnVDbGljaz86ICgpID0+IHZvaWQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgSGVhZGVyOiBDb21wb25lbnQ8SGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtpc1Njcm9sbGVkLCBzZXRJc1Njcm9sbGVkXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG5cbiAgLy8gVHJhY2sgc2Nyb2xsIHBvc2l0aW9uIGZvciBzdGlja3kgaGVhZGVyIGVmZmVjdHNcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHByb3BzLnN0aWNreSkge1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdzY3JvbGwnLCAoKSA9PiB7XG4gICAgICBzZXRJc1Njcm9sbGVkKHdpbmRvdy5zY3JvbGxZID4gMTApO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgdmFyaWFudCA9ICgpID0+IHByb3BzLnZhcmlhbnQgfHwgJ2RlZmF1bHQnO1xuXG4gIHJldHVybiAoXG4gICAgPGhlYWRlclxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAndy1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMCcsXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBWYXJpYW50c1xuICAgICAgICAgICdiZy1zdXJmYWNlIGJvcmRlci1iIGJvcmRlci1zdWJ0bGUnOiB2YXJpYW50KCkgPT09ICdkZWZhdWx0JyxcbiAgICAgICAgICAnYmctdHJhbnNwYXJlbnQnOiB2YXJpYW50KCkgPT09ICdtaW5pbWFsJyB8fCB2YXJpYW50KCkgPT09ICd0cmFuc3BhcmVudCcsXG4gICAgICAgICAgJ2JhY2tkcm9wLWJsdXItbWQgYmctc3VyZmFjZS84MCc6IHZhcmlhbnQoKSA9PT0gJ3RyYW5zcGFyZW50JyAmJiBpc1Njcm9sbGVkKCksXG4gICAgICAgICAgLy8gU3RpY2t5IGJlaGF2aW9yXG4gICAgICAgICAgJ3N0aWNreSB0b3AtMCB6LTUwJzogcHJvcHMuc3RpY2t5LFxuICAgICAgICAgICdzaGFkb3ctbGcnOiBwcm9wcy5zdGlja3kgJiYgaXNTY3JvbGxlZCgpLFxuICAgICAgICB9LFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICA8ZGl2IGNsYXNzPVwibWF4LXctc2NyZWVuLXhsIG14LWF1dG8gcHgtNCBzbTpweC02IGxnOnB4LThcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBoLTE2XCI+XG4gICAgICAgICAgey8qIExlZnQgc2VjdGlvbiAqL31cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTRcIj5cbiAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnNob3dNZW51QnV0dG9ufT5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uTWVudUNsaWNrfVxuICAgICAgICAgICAgICAgIGNsYXNzPVwicC0yIHJvdW5kZWQtbGcgaG92ZXI6YmctaGlnaGxpZ2h0IHRyYW5zaXRpb24tY29sb3JzIGxnOmhpZGRlblwiXG4gICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIk1lbnVcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPHN2ZyBjbGFzcz1cInctNiBoLTZcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIj5cbiAgICAgICAgICAgICAgICAgIDxwYXRoIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiIHN0cm9rZS13aWR0aD1cIjJcIiBkPVwiTTQgNmgxNk00IDEyaDE2TTQgMThoMTZcIiAvPlxuICAgICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMubG9nb30gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy50aXRsZX0+XG4gICAgICAgICAgICAgICAgPGgxIGNsYXNzPVwidGV4dC14bCBmb250LWJvbGQgdGV4dC1wcmltYXJ5XCI+e3Byb3BzLnRpdGxlfTwvaDE+XG4gICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgIHtwcm9wcy5sb2dvfVxuICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgey8qIFJpZ2h0IHNlY3Rpb24gKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuYWN0aW9uc30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAge3Byb3BzLmFjdGlvbnN9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9oZWFkZXI+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2NvcmVQYW5lbFByb3BzIHtcbiAgc2NvcmU6IG51bWJlcjtcbiAgcmFuazogbnVtYmVyO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFNjb3JlUGFuZWw6IENvbXBvbmVudDxTY29yZVBhbmVsUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2dyaWQgZ3JpZC1jb2xzLVsxZnJfMWZyXSBnYXAtMiBwLTQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgey8qIFNjb3JlIEJveCAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJiZy1zdXJmYWNlIHJvdW5kZWQtbGcgcC00IGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIG1pbi1oLVs4MHB4XVwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0yeGwgZm9udC1tb25vIGZvbnQtYm9sZCB0ZXh0LWFjY2VudC1wcmltYXJ5XCI+XG4gICAgICAgICAge3Byb3BzLnNjb3JlfVxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtc20gdGV4dC1zZWNvbmRhcnkgbXQtMVwiPlxuICAgICAgICAgIFNjb3JlXG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICBcbiAgICAgIHsvKiBSYW5rIEJveCAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJiZy1zdXJmYWNlIHJvdW5kZWQtbGcgcC00IGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIG1pbi1oLVs4MHB4XVwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC0yeGwgZm9udC1tb25vIGZvbnQtYm9sZCB0ZXh0LWFjY2VudC1zZWNvbmRhcnlcIj5cbiAgICAgICAgICB7cHJvcHMucmFua31cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtc2Vjb25kYXJ5IG10LTFcIj5cbiAgICAgICAgICBSYW5rXG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IENvbXBvbmVudCwgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgdHlwZSBPbmJvYXJkaW5nU3RlcCA9ICd0b2tlbi1pbnB1dCcgfCAnd2VsY29tZScgfCAnY29tcGxldGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE9uYm9hcmRpbmdGbG93UHJvcHMge1xuICBzdGVwOiBPbmJvYXJkaW5nU3RlcDtcbiAgZXJyb3I/OiBzdHJpbmcgfCBudWxsO1xuICB0b2tlblZlcmlmaWVkPzogYm9vbGVhbjtcbiAgb25Ub2tlblN1Ym1pdDogKHRva2VuOiBzdHJpbmcpID0+IHZvaWQ7XG4gIG9uR2V0U3RhcnRlZDogKCkgPT4gdm9pZDtcbiAgb25Db21wbGV0ZTogKCkgPT4gdm9pZDtcbiAgZGVmYXVsdFRva2VuPzogc3RyaW5nO1xuICB0b2tlblBsYWNlaG9sZGVyPzogc3RyaW5nO1xuICBnZXRUb2tlblVybD86IHN0cmluZztcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBPbmJvYXJkaW5nRmxvdzogQ29tcG9uZW50PE9uYm9hcmRpbmdGbG93UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGxldCB0b2tlbklucHV0UmVmOiBIVE1MSW5wdXRFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG4gIGNvbnN0IGhhbmRsZVRva2VuU3VibWl0ID0gKCkgPT4ge1xuICAgIGNvbnN0IHRva2VuID0gdG9rZW5JbnB1dFJlZj8udmFsdWUudHJpbSgpO1xuICAgIGlmICh0b2tlbikge1xuICAgICAgcHJvcHMub25Ub2tlblN1Ym1pdCh0b2tlbik7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUtleURvd24gPSAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgIGlmIChlLmtleSA9PT0gJ0VudGVyJykge1xuICAgICAgaGFuZGxlVG9rZW5TdWJtaXQoKTtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICdtaW4taC1zY3JlZW4gYmctZ3JhZGllbnQtdG8tYnIgZnJvbS1hY2NlbnQtcHJpbWFyeSB0by1hY2NlbnQtc2Vjb25kYXJ5JyxcbiAgICAgICdmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLTQnLFxuICAgICAgcHJvcHMuY2xhc3NcbiAgICApfT5cbiAgICAgIDxkaXYgY2xhc3M9XCJiZy13aGl0ZSByb3VuZGVkLTJ4bCBzaGFkb3ctMnhsIG1heC13LTJ4bCB3LWZ1bGwgcC04IG1kOnAtMTJcIj5cbiAgICAgICAgey8qIEhlYWRlciAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIG1iLThcIj5cbiAgICAgICAgICA8aDEgY2xhc3M9XCJ0ZXh0LTR4bCBtZDp0ZXh0LTV4bCBmb250LWJvbGQgYmctZ3JhZGllbnQtdG8tciBmcm9tLWFjY2VudC1wcmltYXJ5IHRvLWFjY2VudC1zZWNvbmRhcnkgYmctY2xpcC10ZXh0IHRleHQtdHJhbnNwYXJlbnQgbWItMlwiPlxuICAgICAgICAgICAg8J+OpCBTY2FybGV0dCBLYXJhb2tlXG4gICAgICAgICAgPC9oMT5cbiAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1zZWNvbmRhcnlcIj5cbiAgICAgICAgICAgIEFJLXBvd2VyZWQga2FyYW9rZSBsZWFybmluZyBmb3IgU291bmRDbG91ZFxuICAgICAgICAgIDwvcD5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgey8qIFByb2dyZXNzIEluZGljYXRvciAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgganVzdGlmeS1jZW50ZXIgbWItOFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGdhcC0yXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3ctMyBoLTMgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tY29sb3JzJyxcbiAgICAgICAgICAgICAgcHJvcHMuc3RlcCA9PT0gJ3Rva2VuLWlucHV0JyBcbiAgICAgICAgICAgICAgICA/ICdiZy1hY2NlbnQtcHJpbWFyeScgXG4gICAgICAgICAgICAgICAgOiBwcm9wcy50b2tlblZlcmlmaWVkIFxuICAgICAgICAgICAgICAgICAgPyAnYmctYWNjZW50LXN1Y2Nlc3MnIFxuICAgICAgICAgICAgICAgICAgOiAnYmctbXV0ZWQnXG4gICAgICAgICAgICApfSAvPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICd3LTMgaC0zIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWNvbG9ycycsXG4gICAgICAgICAgICAgIFsnd2VsY29tZScsICdjb21wbGV0ZSddLmluY2x1ZGVzKHByb3BzLnN0ZXApIFxuICAgICAgICAgICAgICAgID8gJ2JnLWFjY2VudC1wcmltYXJ5JyBcbiAgICAgICAgICAgICAgICA6ICdiZy1tdXRlZCdcbiAgICAgICAgICAgICl9IC8+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3ctMyBoLTMgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tY29sb3JzJyxcbiAgICAgICAgICAgICAgcHJvcHMuc3RlcCA9PT0gJ2NvbXBsZXRlJyBcbiAgICAgICAgICAgICAgICA/ICdiZy1hY2NlbnQtc3VjY2VzcycgXG4gICAgICAgICAgICAgICAgOiAnYmctbXV0ZWQnXG4gICAgICAgICAgICApfSAvPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICB7LyogRXJyb3IgRGlzcGxheSAqL31cbiAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuZXJyb3J9PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJtYi02IHAtNCBiZy1yZWQtNTAgYm9yZGVyIGJvcmRlci1yZWQtMjAwIHJvdW5kZWQtbGdcIj5cbiAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1yZWQtNzAwIHRleHQtY2VudGVyXCI+e3Byb3BzLmVycm9yfTwvcD5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9TaG93PlxuXG4gICAgICAgIHsvKiBDb250ZW50ICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICB7LyogVG9rZW4gSW5wdXQgU3RlcCAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zdGVwID09PSAndG9rZW4taW5wdXQnfT5cbiAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTZ4bCBtYi00XCI+8J+UkTwvZGl2PlxuICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTJ4bCBtZDp0ZXh0LTN4bCBmb250LXNlbWlib2xkIHRleHQtcHJpbWFyeSBtYi00XCI+XG4gICAgICAgICAgICAgICAgRW50ZXIgWW91ciBBY2Nlc3MgVG9rZW5cbiAgICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNlY29uZGFyeSBtYi04IG1heC13LXNtIG14LWF1dG9cIj5cbiAgICAgICAgICAgICAgICBQYXN0ZSB5b3VyIGFjY2VzcyB0b2tlbiB0byB1bmxvY2sgdW5saW1pdGVkIGthcmFva2Ugc2Vzc2lvbnNcbiAgICAgICAgICAgICAgPC9wPlxuXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJteS04IHNwYWNlLXktNFwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJiZy1zdXJmYWNlIGJvcmRlci0yIGJvcmRlci1zdWJ0bGUgcm91bmRlZC1sZyBwLTQgdHJhbnNpdGlvbi1jb2xvcnMgaG92ZXI6Ym9yZGVyLWRlZmF1bHRcIj5cbiAgICAgICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgICAgICByZWY9e3Rva2VuSW5wdXRSZWYhfVxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwidGV4dFwiXG4gICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPXtwcm9wcy50b2tlblBsYWNlaG9sZGVyIHx8IFwic2NhcmxldHRfLi4uXCJ9XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlPXtwcm9wcy5kZWZhdWx0VG9rZW4gfHwgXCJcIn1cbiAgICAgICAgICAgICAgICAgICAgb25LZXlEb3duPXtoYW5kbGVLZXlEb3dufVxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBib3JkZXItbm9uZSBiZy10cmFuc3BhcmVudCBvdXRsaW5lLW5vbmUgZm9udC1tb25vIHRleHQtc20gdGV4dC1wcmltYXJ5IHBsYWNlaG9sZGVyOnRleHQtbXV0ZWRcIlxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBnYXAtMyBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVUb2tlblN1Ym1pdH1cbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJiZy1ncmFkaWVudC10by1yIGZyb20tYWNjZW50LXByaW1hcnkgdG8tYWNjZW50LXNlY29uZGFyeSB0ZXh0LXdoaXRlIHB4LTggcHktMyByb3VuZGVkLWxnIGZvbnQtc2VtaWJvbGQgaG92ZXI6c2NhbGUtMTA1IHRyYW5zaXRpb24tdHJhbnNmb3JtIHNoYWRvdy1sZ1wiXG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIFZlcmlmeSBUb2tlblxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHdpbmRvdy5vcGVuKHByb3BzLmdldFRva2VuVXJsIHx8ICdodHRwczovL3NjYXJsZXR0eC54eXonLCAnX2JsYW5rJyl9XG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYmctc3VyZmFjZSB0ZXh0LXByaW1hcnkgcHgtNiBweS0zIHJvdW5kZWQtbGcgZm9udC1zZW1pYm9sZCBob3ZlcjpiZy1oaWdobGlnaHQgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICBHZXQgVG9rZW5cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYmctZ3JhZGllbnQtdG8tciBmcm9tLXB1cnBsZS0xMDAgdG8tcGluay0xMDAgYm9yZGVyIGJvcmRlci1wdXJwbGUtMjAwIHJvdW5kZWQtbGcgcC00IG1heC13LXNtIG14LWF1dG9cIj5cbiAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc20gdGV4dC1wdXJwbGUtNzAwIGZvbnQtbWVkaXVtXCI+XG4gICAgICAgICAgICAgICAgICDwn5KhIDxzdHJvbmc+RGVtbyBNb2RlOjwvc3Ryb25nPiBVc2UgdGhlIHByZWZpbGxlZCB0b2tlbiB0byB0cnkgU2NhcmxldHQgZnJlZVxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICB7LyogV2VsY29tZSBTdGVwICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnN0ZXAgPT09ICd3ZWxjb21lJ30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS02XCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTZ4bCBtYi00XCI+8J+OiTwvZGl2PlxuICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTJ4bCBtZDp0ZXh0LTN4bCBmb250LXNlbWlib2xkIHRleHQtcHJpbWFyeVwiPlxuICAgICAgICAgICAgICAgIFdlbGNvbWUgdG8gU2NhcmxldHQhXG4gICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zZWNvbmRhcnkgbWF4LXctc20gbXgtYXV0b1wiPlxuICAgICAgICAgICAgICAgIFlvdXIgdG9rZW4gaGFzIGJlZW4gdmVyaWZpZWQuIFlvdSdyZSBhbGwgc2V0IHRvIHN0YXJ0IHlvdXIga2FyYW9rZSBqb3VybmV5IG9uIFNvdW5kQ2xvdWQhXG4gICAgICAgICAgICAgIDwvcD5cblxuICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy50b2tlblZlcmlmaWVkfT5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYmctZ3JlZW4tNTAgYm9yZGVyIGJvcmRlci1ncmVlbi0yMDAgcm91bmRlZC1sZyBwLTQgbWF4LXctc20gbXgtYXV0b1wiPlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtZ3JlZW4tNzAwIGZvbnQtc2VtaWJvbGQgbWItMlwiPlxuICAgICAgICAgICAgICAgICAgICDinIUgQWNjZXNzIEdyYW50ZWRcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtc20gdGV4dC1ncmF5LTYwMFwiPlxuICAgICAgICAgICAgICAgICAgICBSZWFkeSB0byBzaW5nIGFsb25nIHRvIHlvdXIgZmF2b3JpdGUgdHJhY2tzIVxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25HZXRTdGFydGVkfVxuICAgICAgICAgICAgICAgIGNsYXNzPVwiYmctZ3JhZGllbnQtdG8tciBmcm9tLWFjY2VudC1wcmltYXJ5IHRvLWFjY2VudC1zZWNvbmRhcnkgdGV4dC13aGl0ZSBweC0xMiBweS00IHJvdW5kZWQtbGcgZm9udC1zZW1pYm9sZCB0ZXh0LWxnIGhvdmVyOnNjYWxlLTEwNSB0cmFuc2l0aW9uLXRyYW5zZm9ybSBzaGFkb3ctbGdcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgR2V0IFN0YXJ0ZWRcbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICB7LyogQ29tcGxldGUgU3RlcCAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zdGVwID09PSAnY29tcGxldGUnfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LTZcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtNnhsIG1iLTRcIj7wn5qAPC9kaXY+XG4gICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQtMnhsIG1kOnRleHQtM3hsIGZvbnQtc2VtaWJvbGQgdGV4dC1wcmltYXJ5XCI+XG4gICAgICAgICAgICAgICAgWW91J3JlIEFsbCBTZXQhXG4gICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zZWNvbmRhcnkgbWF4LXctc20gbXgtYXV0b1wiPlxuICAgICAgICAgICAgICAgIEhlYWQgdG8gU291bmRDbG91ZCBhbmQgc3RhcnQgc2luZ2luZyEgTG9vayBmb3IgdGhlIGthcmFva2Ugd2lkZ2V0IG9uIGFueSBzdXBwb3J0ZWQgdHJhY2suXG4gICAgICAgICAgICAgIDwvcD5cblxuICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25Db21wbGV0ZX1cbiAgICAgICAgICAgICAgICBjbGFzcz1cImJnLWdyYWRpZW50LXRvLXIgZnJvbS1ncmVlbi01MDAgdG8tY3lhbi01MDAgdGV4dC13aGl0ZSBweC0xMiBweS00IHJvdW5kZWQtbGcgZm9udC1zZW1pYm9sZCB0ZXh0LWxnIGhvdmVyOnNjYWxlLTEwNSB0cmFuc2l0aW9uLXRyYW5zZm9ybSBzaGFkb3ctbGdcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgU3RhcnQgS2FyYW9rZVxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgRm9yLCBjcmVhdGVFZmZlY3QsIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTHlyaWNMaW5lIHtcbiAgaWQ6IHN0cmluZztcbiAgdGV4dDogc3RyaW5nO1xuICBzdGFydFRpbWU6IG51bWJlcjtcbiAgZHVyYXRpb246IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMeXJpY3NEaXNwbGF5UHJvcHMge1xuICBseXJpY3M6IEx5cmljTGluZVtdO1xuICBjdXJyZW50VGltZT86IG51bWJlcjtcbiAgaXNQbGF5aW5nPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBMeXJpY3NEaXNwbGF5OiBDb21wb25lbnQ8THlyaWNzRGlzcGxheVByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbY3VycmVudExpbmVJbmRleCwgc2V0Q3VycmVudExpbmVJbmRleF0gPSBjcmVhdGVTaWduYWwoLTEpO1xuICBsZXQgY29udGFpbmVyUmVmOiBIVE1MRGl2RWxlbWVudCB8IHVuZGVmaW5lZDtcblxuICAvLyBGaW5kIGN1cnJlbnQgbGluZSBiYXNlZCBvbiB0aW1lXG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFwcm9wcy5jdXJyZW50VGltZSkge1xuICAgICAgc2V0Q3VycmVudExpbmVJbmRleCgtMSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGltZSA9IHByb3BzLmN1cnJlbnRUaW1lO1xuICAgIGNvbnN0IGluZGV4ID0gcHJvcHMubHlyaWNzLmZpbmRJbmRleCgobGluZSkgPT4ge1xuICAgICAgY29uc3QgZW5kVGltZSA9IGxpbmUuc3RhcnRUaW1lICsgbGluZS5kdXJhdGlvbjtcbiAgICAgIHJldHVybiB0aW1lID49IGxpbmUuc3RhcnRUaW1lICYmIHRpbWUgPCBlbmRUaW1lO1xuICAgIH0pO1xuXG4gICAgc2V0Q3VycmVudExpbmVJbmRleChpbmRleCk7XG4gIH0pO1xuXG4gIC8vIEF1dG8tc2Nyb2xsIHRvIGN1cnJlbnQgbGluZVxuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IGluZGV4ID0gY3VycmVudExpbmVJbmRleCgpO1xuICAgIGlmIChpbmRleCA9PT0gLTEgfHwgIWNvbnRhaW5lclJlZiB8fCAhcHJvcHMuaXNQbGF5aW5nKSByZXR1cm47XG5cbiAgICBjb25zdCBsaW5lRWxlbWVudHMgPSBjb250YWluZXJSZWYucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtbGluZS1pbmRleF0nKTtcbiAgICBjb25zdCBjdXJyZW50RWxlbWVudCA9IGxpbmVFbGVtZW50c1tpbmRleF0gYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICBpZiAoY3VycmVudEVsZW1lbnQpIHtcbiAgICAgIGNvbnN0IGNvbnRhaW5lckhlaWdodCA9IGNvbnRhaW5lclJlZi5jbGllbnRIZWlnaHQ7XG4gICAgICBjb25zdCBsaW5lVG9wID0gY3VycmVudEVsZW1lbnQub2Zmc2V0VG9wO1xuICAgICAgY29uc3QgbGluZUhlaWdodCA9IGN1cnJlbnRFbGVtZW50Lm9mZnNldEhlaWdodDtcblxuICAgICAgLy8gQ2VudGVyIHRoZSBjdXJyZW50IGxpbmVcbiAgICAgIGNvbnN0IHNjcm9sbFRvcCA9IGxpbmVUb3AgLSBjb250YWluZXJIZWlnaHQgLyAyICsgbGluZUhlaWdodCAvIDI7XG5cbiAgICAgIGNvbnRhaW5lclJlZi5zY3JvbGxUbyh7XG4gICAgICAgIHRvcDogc2Nyb2xsVG9wLFxuICAgICAgICBiZWhhdmlvcjogJ3Ntb290aCcsXG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgcmVmPXtjb250YWluZXJSZWZ9XG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdseXJpY3MtZGlzcGxheSBvdmVyZmxvdy15LWF1dG8gc2Nyb2xsLXNtb290aCcsXG4gICAgICAgICdoLWZ1bGwgcHgtNiBweS0xMicsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LThcIj5cbiAgICAgICAgPEZvciBlYWNoPXtwcm9wcy5seXJpY3N9PlxuICAgICAgICAgIHsobGluZSwgaW5kZXgpID0+IChcbiAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgZGF0YS1saW5lLWluZGV4PXtpbmRleCgpfVxuICAgICAgICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICAgJ3RleHQtY2VudGVyIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgICAgICAgICAgJ3RleHQtMnhsIGxlYWRpbmctcmVsYXhlZCcsXG4gICAgICAgICAgICAgICAgaW5kZXgoKSA9PT0gY3VycmVudExpbmVJbmRleCgpXG4gICAgICAgICAgICAgICAgICA/ICd0ZXh0LXByaW1hcnkgZm9udC1zZW1pYm9sZCBzY2FsZS0xMTAnXG4gICAgICAgICAgICAgICAgICA6ICd0ZXh0LXNlY29uZGFyeSBvcGFjaXR5LTYwJ1xuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7bGluZS50ZXh0fVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9Gb3I+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlSGVhZGVyUHJvcHMge1xuICBzb25nVGl0bGU6IHN0cmluZztcbiAgYXJ0aXN0OiBzdHJpbmc7XG4gIG9uQmFjaz86ICgpID0+IHZvaWQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5jb25zdCBDaGV2cm9uTGVmdCA9ICgpID0+IChcbiAgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgY2xhc3M9XCJ3LTYgaC02XCI+XG4gICAgPHBhdGggc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIgZD1cIk0xNSAxOWwtNy03IDctN1wiIC8+XG4gIDwvc3ZnPlxuKTtcblxuZXhwb3J0IGNvbnN0IEthcmFva2VIZWFkZXI6IENvbXBvbmVudDxLYXJhb2tlSGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ3JlbGF0aXZlIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHAtNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogQmFjayBidXR0b24gLSBhYnNvbHV0ZSBwb3NpdGlvbmVkICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkJhY2t9XG4gICAgICAgIGNsYXNzPVwiYWJzb2x1dGUgbGVmdC00IHAtMiAtbS0yIHRleHQtc2Vjb25kYXJ5IGhvdmVyOnRleHQtcHJpbWFyeSB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgIGFyaWEtbGFiZWw9XCJHbyBiYWNrXCJcbiAgICAgID5cbiAgICAgICAgPENoZXZyb25MZWZ0IC8+XG4gICAgICA8L2J1dHRvbj5cbiAgICAgIFxuICAgICAgey8qIFNvbmcgaW5mbyAtIGNlbnRlcmVkICovfVxuICAgICAgPGgxIGNsYXNzPVwidGV4dC1iYXNlIGZvbnQtbWVkaXVtIHRleHQtcHJpbWFyeSB0ZXh0LWNlbnRlciBweC0xMiB0cnVuY2F0ZSBtYXgtdy1mdWxsXCI+XG4gICAgICAgIHtwcm9wcy5zb25nVGl0bGV9IC0ge3Byb3BzLmFydGlzdH1cbiAgICAgIDwvaDE+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IEZvciB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGVhZGVyYm9hcmRFbnRyeSB7XG4gIHJhbms6IG51bWJlcjtcbiAgdXNlcm5hbWU6IHN0cmluZztcbiAgc2NvcmU6IG51bWJlcjtcbiAgaXNDdXJyZW50VXNlcj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGVhZGVyYm9hcmRQYW5lbFByb3BzIHtcbiAgZW50cmllczogTGVhZGVyYm9hcmRFbnRyeVtdO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IExlYWRlcmJvYXJkUGFuZWw6IENvbXBvbmVudDxMZWFkZXJib2FyZFBhbmVsUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgZ2FwLTIgcC00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxGb3IgZWFjaD17cHJvcHMuZW50cmllc30+XG4gICAgICAgIHsoZW50cnkpID0+IChcbiAgICAgICAgICA8ZGl2IFxuICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAnZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgcHgtMyBweS0yIHJvdW5kZWQtbGcgdHJhbnNpdGlvbi1jb2xvcnMnLFxuICAgICAgICAgICAgICBlbnRyeS5pc0N1cnJlbnRVc2VyIFxuICAgICAgICAgICAgICAgID8gJ2JnLWFjY2VudC1wcmltYXJ5LzEwIGJvcmRlciBib3JkZXItYWNjZW50LXByaW1hcnkvMjAnIFxuICAgICAgICAgICAgICAgIDogJ2JnLXN1cmZhY2UgaG92ZXI6Ymctc3VyZmFjZS1ob3ZlcidcbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgPHNwYW4gXG4gICAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAndy04IHRleHQtY2VudGVyIGZvbnQtbW9ubyBmb250LWJvbGQnLFxuICAgICAgICAgICAgICAgIGVudHJ5LnJhbmsgPD0gMyA/ICd0ZXh0LWFjY2VudC1wcmltYXJ5JyA6ICd0ZXh0LXNlY29uZGFyeSdcbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgI3tlbnRyeS5yYW5rfVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAnZmxleC0xIHRydW5jYXRlJyxcbiAgICAgICAgICAgICAgZW50cnkuaXNDdXJyZW50VXNlciA/ICd0ZXh0LWFjY2VudC1wcmltYXJ5IGZvbnQtbWVkaXVtJyA6ICd0ZXh0LXByaW1hcnknXG4gICAgICAgICAgICApfT5cbiAgICAgICAgICAgICAge2VudHJ5LnVzZXJuYW1lfVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAnZm9udC1tb25vIGZvbnQtYm9sZCcsXG4gICAgICAgICAgICAgIGVudHJ5LmlzQ3VycmVudFVzZXIgPyAndGV4dC1hY2NlbnQtcHJpbWFyeScgOiAndGV4dC1wcmltYXJ5J1xuICAgICAgICAgICAgKX0+XG4gICAgICAgICAgICAgIHtlbnRyeS5zY29yZS50b0xvY2FsZVN0cmluZygpfVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApfVxuICAgICAgPC9Gb3I+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCB0eXBlIFBsYXliYWNrU3BlZWQgPSAnMXgnIHwgJzAuNzV4JyB8ICcwLjV4JztcblxuZXhwb3J0IGludGVyZmFjZSBTcGxpdEJ1dHRvblByb3BzIHtcbiAgb25TdGFydD86ICgpID0+IHZvaWQ7XG4gIG9uU3BlZWRDaGFuZ2U/OiAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpID0+IHZvaWQ7XG4gIGRpc2FibGVkPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmNvbnN0IHNwZWVkczogUGxheWJhY2tTcGVlZFtdID0gWycxeCcsICcwLjc1eCcsICcwLjV4J107XG5cbmV4cG9ydCBjb25zdCBTcGxpdEJ1dHRvbjogQ29tcG9uZW50PFNwbGl0QnV0dG9uUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtjdXJyZW50U3BlZWRJbmRleCwgc2V0Q3VycmVudFNwZWVkSW5kZXhdID0gY3JlYXRlU2lnbmFsKDApO1xuICBcbiAgY29uc3QgY3VycmVudFNwZWVkID0gKCkgPT4gc3BlZWRzW2N1cnJlbnRTcGVlZEluZGV4KCldO1xuICBcbiAgY29uc3QgY3ljbGVTcGVlZCA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBjb25zdCBuZXh0SW5kZXggPSAoY3VycmVudFNwZWVkSW5kZXgoKSArIDEpICUgc3BlZWRzLmxlbmd0aDtcbiAgICBzZXRDdXJyZW50U3BlZWRJbmRleChuZXh0SW5kZXgpO1xuICAgIGNvbnN0IG5ld1NwZWVkID0gc3BlZWRzW25leHRJbmRleF07XG4gICAgaWYgKG5ld1NwZWVkKSB7XG4gICAgICBwcm9wcy5vblNwZWVkQ2hhbmdlPy4obmV3U3BlZWQpO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdyZWxhdGl2ZSBpbmxpbmUtZmxleCB3LWZ1bGwgcm91bmRlZC1sZyBvdmVyZmxvdy1oaWRkZW4nLFxuICAgICAgICAnYmctZ3JhZGllbnQtcHJpbWFyeSB0ZXh0LXdoaXRlIHNoYWRvdy1sZycsXG4gICAgICAgICd0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICB7LyogTWFpbiBidXR0b24gKi99XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uU3RhcnR9XG4gICAgICAgIGRpc2FibGVkPXtwcm9wcy5kaXNhYmxlZH1cbiAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICdmbGV4LTEgaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJlbGF0aXZlIG92ZXJmbG93LWhpZGRlbicsXG4gICAgICAgICAgJ2gtMTIgcHgtNiB0ZXh0LWxnIGZvbnQtbWVkaXVtJyxcbiAgICAgICAgICAnY3Vyc29yLXBvaW50ZXIgYm9yZGVyLW5vbmUgb3V0bGluZS1ub25lJyxcbiAgICAgICAgICAnZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICAgICdob3ZlcjpiZy13aGl0ZS8xMCBhY3RpdmU6Ymctd2hpdGUvMjAnXG4gICAgICAgICl9XG4gICAgICA+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwicmVsYXRpdmUgei0xMFwiPlN0YXJ0PC9zcGFuPlxuICAgICAgPC9idXR0b24+XG4gICAgICBcbiAgICAgIHsvKiBEaXZpZGVyICovfVxuICAgICAgPGRpdiBjbGFzcz1cInctcHggYmctYmxhY2svMjBcIiAvPlxuICAgICAgXG4gICAgICB7LyogU3BlZWQgYnV0dG9uICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtjeWNsZVNwZWVkfVxuICAgICAgICBkaXNhYmxlZD17cHJvcHMuZGlzYWJsZWR9XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJlbGF0aXZlJyxcbiAgICAgICAgICAndy0yMCB0ZXh0LWxnIGZvbnQtbWVkaXVtJyxcbiAgICAgICAgICAnY3Vyc29yLXBvaW50ZXIgYm9yZGVyLW5vbmUgb3V0bGluZS1ub25lJyxcbiAgICAgICAgICAnZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICAgICdob3ZlcjpiZy13aGl0ZS8xMCBhY3RpdmU6Ymctd2hpdGUvMjAnLFxuICAgICAgICAgICdhZnRlcjpjb250ZW50LVtcIlwiXSBhZnRlcjphYnNvbHV0ZSBhZnRlcjppbnNldC0wJyxcbiAgICAgICAgICAnYWZ0ZXI6YmctZ3JhZGllbnQtdG8tciBhZnRlcjpmcm9tLXRyYW5zcGFyZW50IGFmdGVyOnZpYS13aGl0ZS8yMCBhZnRlcjp0by10cmFuc3BhcmVudCcsXG4gICAgICAgICAgJ2FmdGVyOnRyYW5zbGF0ZS14LVstMjAwJV0gaG92ZXI6YWZ0ZXI6dHJhbnNsYXRlLXgtWzIwMCVdJyxcbiAgICAgICAgICAnYWZ0ZXI6dHJhbnNpdGlvbi10cmFuc2Zvcm0gYWZ0ZXI6ZHVyYXRpb24tNzAwJ1xuICAgICAgICApfVxuICAgICAgICBhcmlhLWxhYmVsPVwiQ2hhbmdlIHBsYXliYWNrIHNwZWVkXCJcbiAgICAgID5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJyZWxhdGl2ZSB6LTEwXCI+e2N1cnJlbnRTcGVlZCgpfTwvc3Bhbj5cbiAgICAgIDwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCwgSlNYIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFiIHtcbiAgaWQ6IHN0cmluZztcbiAgbGFiZWw6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzUHJvcHMge1xuICB0YWJzOiBUYWJbXTtcbiAgZGVmYXVsdFRhYj86IHN0cmluZztcbiAgb25UYWJDaGFuZ2U/OiAodGFiSWQ6IHN0cmluZykgPT4gdm9pZDtcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzTGlzdFByb3BzIHtcbiAgY2xhc3M/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzVHJpZ2dlclByb3BzIHtcbiAgdmFsdWU6IHN0cmluZztcbiAgY2xhc3M/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJzQ29udGVudFByb3BzIHtcbiAgdmFsdWU6IHN0cmluZztcbiAgY2xhc3M/OiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbn1cblxuLy8gR2xvYmFsIHN0YXRlIGZvciB0aGUgY3VycmVudCB0YWJzIGluc3RhbmNlXG5sZXQgY3VycmVudFRhYnNTdGF0ZToge1xuICBhY3RpdmVUYWI6ICgpID0+IHN0cmluZztcbiAgc2V0QWN0aXZlVGFiOiAoaWQ6IHN0cmluZykgPT4gdm9pZDtcbn0gfCBudWxsID0gbnVsbDtcblxuZXhwb3J0IGNvbnN0IFRhYnM6IENvbXBvbmVudDxUYWJzUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFthY3RpdmVUYWIsIHNldEFjdGl2ZVRhYl0gPSBjcmVhdGVTaWduYWwocHJvcHMuZGVmYXVsdFRhYiB8fCBwcm9wcy50YWJzWzBdPy5pZCB8fCAnJyk7XG4gIFxuICBjb25zdCBoYW5kbGVUYWJDaGFuZ2UgPSAoaWQ6IHN0cmluZykgPT4ge1xuICAgIHNldEFjdGl2ZVRhYihpZCk7XG4gICAgcHJvcHMub25UYWJDaGFuZ2U/LihpZCk7XG4gIH07XG5cbiAgLy8gU2V0IHRoZSBnbG9iYWwgc3RhdGUgZm9yIGNoaWxkIGNvbXBvbmVudHMgdG8gYWNjZXNzXG4gIGN1cnJlbnRUYWJzU3RhdGUgPSB7XG4gICAgYWN0aXZlVGFiLFxuICAgIHNldEFjdGl2ZVRhYjogaGFuZGxlVGFiQ2hhbmdlXG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbigndy1mdWxsJywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICA8L2Rpdj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBUYWJzTGlzdDogQ29tcG9uZW50PFRhYnNMaXN0UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBcbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2lubGluZS1mbGV4IGgtMTAgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbWQgYmctc3VyZmFjZSBwLTEgdGV4dC1zZWNvbmRhcnknLFxuICAgICAgICAndy1mdWxsJyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgIDwvZGl2PlxuICApO1xufTtcblxuZXhwb3J0IGNvbnN0IFRhYnNUcmlnZ2VyOiBDb21wb25lbnQ8VGFic1RyaWdnZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgaXNBY3RpdmUgPSAoKSA9PiBjdXJyZW50VGFic1N0YXRlPy5hY3RpdmVUYWIoKSA9PT0gcHJvcHMudmFsdWU7XG5cbiAgcmV0dXJuIChcbiAgICA8YnV0dG9uXG4gICAgICBvbkNsaWNrPXsoKSA9PiBjdXJyZW50VGFic1N0YXRlPy5zZXRBY3RpdmVUYWIocHJvcHMudmFsdWUpfVxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAnaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHdoaXRlc3BhY2Utbm93cmFwIHJvdW5kZWQtc20gcHgtMyBweS0xLjUnLFxuICAgICAgICAndGV4dC1zbSBmb250LW1lZGl1bSByaW5nLW9mZnNldC1iYXNlIHRyYW5zaXRpb24tYWxsJyxcbiAgICAgICAgJ2ZvY3VzLXZpc2libGU6b3V0bGluZS1ub25lIGZvY3VzLXZpc2libGU6cmluZy0yIGZvY3VzLXZpc2libGU6cmluZy1hY2NlbnQtcHJpbWFyeSBmb2N1cy12aXNpYmxlOnJpbmctb2Zmc2V0LTInLFxuICAgICAgICAnZGlzYWJsZWQ6cG9pbnRlci1ldmVudHMtbm9uZSBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAgJ2ZsZXgtMScsXG4gICAgICAgIGlzQWN0aXZlKClcbiAgICAgICAgICA/ICdiZy1iYXNlIHRleHQtcHJpbWFyeSBzaGFkb3ctc20nXG4gICAgICAgICAgOiAndGV4dC1zZWNvbmRhcnkgaG92ZXI6dGV4dC1wcmltYXJ5JyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgIDwvYnV0dG9uPlxuICApO1xufTtcblxuZXhwb3J0IGNvbnN0IFRhYnNDb250ZW50OiBDb21wb25lbnQ8VGFic0NvbnRlbnRQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8U2hvdyB3aGVuPXtjdXJyZW50VGFic1N0YXRlPy5hY3RpdmVUYWIoKSA9PT0gcHJvcHMudmFsdWV9PlxuICAgICAgPGRpdlxuICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgJ210LTIgcmluZy1vZmZzZXQtYmFzZScsXG4gICAgICAgICAgJ2ZvY3VzLXZpc2libGU6b3V0bGluZS1ub25lIGZvY3VzLXZpc2libGU6cmluZy0yIGZvY3VzLXZpc2libGU6cmluZy1hY2NlbnQtcHJpbWFyeSBmb2N1cy12aXNpYmxlOnJpbmctb2Zmc2V0LTInLFxuICAgICAgICAgIHByb3BzLmNsYXNzXG4gICAgICAgICl9XG4gICAgICA+XG4gICAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICAgIDwvZGl2PlxuICAgIDwvU2hvdz5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB7IFNjb3JlUGFuZWwgfSBmcm9tICcuLi8uLi9kaXNwbGF5L1Njb3JlUGFuZWwnO1xuaW1wb3J0IHsgTHlyaWNzRGlzcGxheSwgdHlwZSBMeXJpY0xpbmUgfSBmcm9tICcuLi9MeXJpY3NEaXNwbGF5JztcbmltcG9ydCB7IExlYWRlcmJvYXJkUGFuZWwsIHR5cGUgTGVhZGVyYm9hcmRFbnRyeSB9IGZyb20gJy4uL0xlYWRlcmJvYXJkUGFuZWwnO1xuaW1wb3J0IHsgU3BsaXRCdXR0b24gfSBmcm9tICcuLi8uLi9jb21tb24vU3BsaXRCdXR0b24nO1xuaW1wb3J0IHR5cGUgeyBQbGF5YmFja1NwZWVkIH0gZnJvbSAnLi4vLi4vY29tbW9uL1NwbGl0QnV0dG9uJztcbmltcG9ydCB7IFRhYnMsIFRhYnNMaXN0LCBUYWJzVHJpZ2dlciwgVGFic0NvbnRlbnQgfSBmcm9tICcuLi8uLi9jb21tb24vVGFicyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXh0ZW5zaW9uS2FyYW9rZVZpZXdQcm9wcyB7XG4gIC8vIFNjb3Jlc1xuICBzY29yZTogbnVtYmVyO1xuICByYW5rOiBudW1iZXI7XG4gIFxuICAvLyBMeXJpY3NcbiAgbHlyaWNzOiBMeXJpY0xpbmVbXTtcbiAgY3VycmVudFRpbWU/OiBudW1iZXI7XG4gIFxuICAvLyBMZWFkZXJib2FyZFxuICBsZWFkZXJib2FyZDogTGVhZGVyYm9hcmRFbnRyeVtdO1xuICBcbiAgLy8gU3RhdGVcbiAgaXNQbGF5aW5nPzogYm9vbGVhbjtcbiAgb25TdGFydD86ICgpID0+IHZvaWQ7XG4gIG9uU3BlZWRDaGFuZ2U/OiAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpID0+IHZvaWQ7XG4gIFxuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEV4dGVuc2lvbkthcmFva2VWaWV3OiBDb21wb25lbnQ8RXh0ZW5zaW9uS2FyYW9rZVZpZXdQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZmxleCBmbGV4LWNvbCBoLWZ1bGwgYmctYmFzZScsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogU2NvcmUgUGFuZWwgKi99XG4gICAgICA8U2NvcmVQYW5lbFxuICAgICAgICBzY29yZT17cHJvcHMuc2NvcmV9XG4gICAgICAgIHJhbms9e3Byb3BzLnJhbmt9XG4gICAgICAvPlxuXG4gICAgICB7LyogVGFicyBhbmQgY29udGVudCAqL31cbiAgICAgIDxUYWJzIFxuICAgICAgICB0YWJzPXtbXG4gICAgICAgICAgeyBpZDogJ2x5cmljcycsIGxhYmVsOiAnTHlyaWNzJyB9LFxuICAgICAgICAgIHsgaWQ6ICdsZWFkZXJib2FyZCcsIGxhYmVsOiAnTGVhZGVyYm9hcmQnIH1cbiAgICAgICAgXX1cbiAgICAgICAgZGVmYXVsdFRhYj1cImx5cmljc1wiXG4gICAgICAgIGNsYXNzPVwiZmxleC0xIGZsZXggZmxleC1jb2wgb3ZlcmZsb3ctaGlkZGVuXCJcbiAgICAgID5cbiAgICAgICAgPGRpdiBjbGFzcz1cInB4LTRcIj5cbiAgICAgICAgICA8VGFic0xpc3Q+XG4gICAgICAgICAgICA8VGFic1RyaWdnZXIgdmFsdWU9XCJseXJpY3NcIj5MeXJpY3M8L1RhYnNUcmlnZ2VyPlxuICAgICAgICAgICAgPFRhYnNUcmlnZ2VyIHZhbHVlPVwibGVhZGVyYm9hcmRcIj5MZWFkZXJib2FyZDwvVGFic1RyaWdnZXI+XG4gICAgICAgICAgPC9UYWJzTGlzdD5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIFxuICAgICAgICA8VGFic0NvbnRlbnQgdmFsdWU9XCJseXJpY3NcIiBjbGFzcz1cImZsZXgtMSBmbGV4IGZsZXgtY29sIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICA8THlyaWNzRGlzcGxheVxuICAgICAgICAgICAgICBseXJpY3M9e3Byb3BzLmx5cmljc31cbiAgICAgICAgICAgICAgY3VycmVudFRpbWU9e3Byb3BzLmN1cnJlbnRUaW1lfVxuICAgICAgICAgICAgICBpc1BsYXlpbmc9e3Byb3BzLmlzUGxheWluZ31cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgXG4gICAgICAgICAgey8qIEZvb3RlciB3aXRoIHN0YXJ0IGJ1dHRvbiAqL31cbiAgICAgICAgICB7IXByb3BzLmlzUGxheWluZyAmJiBwcm9wcy5vblN0YXJ0ICYmIChcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwLTQgYmctc3VyZmFjZSBib3JkZXItdCBib3JkZXItc3VidGxlXCI+XG4gICAgICAgICAgICAgIDxTcGxpdEJ1dHRvblxuICAgICAgICAgICAgICAgIG9uU3RhcnQ9e3Byb3BzLm9uU3RhcnR9XG4gICAgICAgICAgICAgICAgb25TcGVlZENoYW5nZT17cHJvcHMub25TcGVlZENoYW5nZX1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvVGFic0NvbnRlbnQ+XG4gICAgICAgIFxuICAgICAgICA8VGFic0NvbnRlbnQgdmFsdWU9XCJsZWFkZXJib2FyZFwiIGNsYXNzPVwiZmxleC0xIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJvdmVyZmxvdy15LWF1dG8gaC1mdWxsXCI+XG4gICAgICAgICAgICA8TGVhZGVyYm9hcmRQYW5lbCBlbnRyaWVzPXtwcm9wcy5sZWFkZXJib2FyZH0gLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9UYWJzQ29udGVudD5cbiAgICAgIDwvVGFicz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IEljb25YUmVndWxhciBmcm9tICdwaG9zcGhvci1pY29ucy1zb2xpZC9JY29uWFJlZ3VsYXInO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJhY3RpY2VIZWFkZXJQcm9wcyB7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBvbkV4aXQ6ICgpID0+IHZvaWQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgUHJhY3RpY2VIZWFkZXI6IENvbXBvbmVudDxQcmFjdGljZUhlYWRlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxoZWFkZXIgY2xhc3M9e2NuKCdmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gaC0xNCBweC00IGJnLXRyYW5zcGFyZW50JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxidXR0b25cbiAgICAgICAgb25DbGljaz17cHJvcHMub25FeGl0fVxuICAgICAgICBjbGFzcz1cInAtMiAtbWwtMiByb3VuZGVkLWZ1bGwgaG92ZXI6YmctaGlnaGxpZ2h0IHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgYXJpYS1sYWJlbD1cIkV4aXQgcHJhY3RpY2VcIlxuICAgICAgPlxuICAgICAgICA8SWNvblhSZWd1bGFyIGNsYXNzPVwidGV4dC1zZWNvbmRhcnkgdy02IGgtNlwiIC8+XG4gICAgICA8L2J1dHRvbj5cbiAgICAgIFxuICAgICAgPFNob3cgd2hlbj17cHJvcHMudGl0bGV9PlxuICAgICAgICA8aDEgY2xhc3M9XCJ0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgdGV4dC1wcmltYXJ5IGFic29sdXRlIGxlZnQtMS8yIHRyYW5zZm9ybSAtdHJhbnNsYXRlLXgtMS8yXCI+XG4gICAgICAgICAge3Byb3BzLnRpdGxlfVxuICAgICAgICA8L2gxPlxuICAgICAgPC9TaG93PlxuICAgICAgXG4gICAgICB7LyogU3BhY2VyIHRvIGJhbGFuY2UgdGhlIGxheW91dCAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJ3LTEwXCIgLz5cbiAgICA8L2hlYWRlcj5cbiAgKTtcbn07IiwiZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlRGF0YSB7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIHRyYWNrX2lkPzogc3RyaW5nO1xuICB0cmFja0lkPzogc3RyaW5nO1xuICBoYXNfa2FyYW9rZT86IGJvb2xlYW47XG4gIGhhc0thcmFva2U/OiBib29sZWFuO1xuICBzb25nPzoge1xuICAgIGlkOiBzdHJpbmc7XG4gICAgdGl0bGU6IHN0cmluZztcbiAgICBhcnRpc3Q6IHN0cmluZztcbiAgICBhbGJ1bT86IHN0cmluZztcbiAgICBhcnR3b3JrVXJsPzogc3RyaW5nO1xuICAgIGR1cmF0aW9uPzogbnVtYmVyO1xuICAgIGRpZmZpY3VsdHk6ICdiZWdpbm5lcicgfCAnaW50ZXJtZWRpYXRlJyB8ICdhZHZhbmNlZCc7XG4gIH07XG4gIGx5cmljcz86IHtcbiAgICBzb3VyY2U6IHN0cmluZztcbiAgICB0eXBlOiAnc3luY2VkJztcbiAgICBsaW5lczogTHlyaWNMaW5lW107XG4gICAgdG90YWxMaW5lczogbnVtYmVyO1xuICB9O1xuICBtZXNzYWdlPzogc3RyaW5nO1xuICBlcnJvcj86IHN0cmluZztcbiAgYXBpX2Nvbm5lY3RlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTHlyaWNMaW5lIHtcbiAgaWQ6IHN0cmluZztcbiAgdGV4dDogc3RyaW5nO1xuICBzdGFydFRpbWU6IG51bWJlcjtcbiAgZHVyYXRpb246IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlU2Vzc2lvbiB7XG4gIGlkOiBzdHJpbmc7XG4gIHRyYWNrSWQ6IHN0cmluZztcbiAgc29uZ1RpdGxlOiBzdHJpbmc7XG4gIHNvbmdBcnRpc3Q6IHN0cmluZztcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGNyZWF0ZWRBdDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgS2FyYW9rZUFwaVNlcnZpY2Uge1xuICBwcml2YXRlIGJhc2VVcmw6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICAvLyBVc2UgdGhlIGxvY2FsIHNlcnZlciBlbmRwb2ludFxuICAgIHRoaXMuYmFzZVVybCA9ICdodHRwOi8vbG9jYWxob3N0Ojg3ODcvYXBpJztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQga2FyYW9rZSBkYXRhIGZvciBhIHRyYWNrIElEIChZb3VUdWJlL1NvdW5kQ2xvdWQpXG4gICAqL1xuICBhc3luYyBnZXRLYXJhb2tlRGF0YShcbiAgICB0cmFja0lkOiBzdHJpbmcsIFxuICAgIHRpdGxlPzogc3RyaW5nLCBcbiAgICBhcnRpc3Q/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxLYXJhb2tlRGF0YSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xuICAgICAgaWYgKHRpdGxlKSBwYXJhbXMuc2V0KCd0aXRsZScsIHRpdGxlKTtcbiAgICAgIGlmIChhcnRpc3QpIHBhcmFtcy5zZXQoJ2FydGlzdCcsIGFydGlzdCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0va2FyYW9rZS8ke2VuY29kZVVSSUNvbXBvbmVudCh0cmFja0lkKX0ke3BhcmFtcy50b1N0cmluZygpID8gJz8nICsgcGFyYW1zLnRvU3RyaW5nKCkgOiAnJ31gO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VBcGldIEZldGNoaW5nIGthcmFva2UgZGF0YTonLCB1cmwpO1xuICAgICAgXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAvLyBSZW1vdmUgQ29udGVudC1UeXBlIGhlYWRlciB0byBhdm9pZCBDT1JTIHByZWZsaWdodFxuICAgICAgICAvLyBoZWFkZXJzOiB7XG4gICAgICAgIC8vICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgLy8gfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZmV0Y2gga2FyYW9rZSBkYXRhOicsIHJlc3BvbnNlLnN0YXR1cyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXBpXSBSZWNlaXZlZCBrYXJhb2tlIGRhdGE6JywgZGF0YSk7XG4gICAgICBcbiAgICAgIC8vIElmIHRoZXJlJ3MgYW4gZXJyb3IgYnV0IHdlIGdvdCBhIHJlc3BvbnNlLCBpdCBtZWFucyBBUEkgaXMgY29ubmVjdGVkXG4gICAgICBpZiAoZGF0YS5lcnJvcikge1xuICAgICAgICBjb25zb2xlLmxvZygnW0thcmFva2VBcGldIFNlcnZlciBlcnJvciAoYnV0IEFQSSBpcyByZWFjaGFibGUpOicsIGRhdGEuZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGhhc19rYXJhb2tlOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcjogZGF0YS5lcnJvcixcbiAgICAgICAgICB0cmFja19pZDogdHJhY2tJZCxcbiAgICAgICAgICBhcGlfY29ubmVjdGVkOiB0cnVlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRXJyb3IgZmV0Y2hpbmcga2FyYW9rZSBkYXRhOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFydCBhIGthcmFva2Ugc2Vzc2lvblxuICAgKi9cbiAgYXN5bmMgc3RhcnRTZXNzaW9uKFxuICAgIHRyYWNrSWQ6IHN0cmluZyxcbiAgICBzb25nRGF0YToge1xuICAgICAgdGl0bGU6IHN0cmluZztcbiAgICAgIGFydGlzdDogc3RyaW5nO1xuICAgICAgYWxidW0/OiBzdHJpbmc7XG4gICAgICBkdXJhdGlvbj86IG51bWJlcjtcbiAgICB9XG4gICk6IFByb21pc2U8S2FyYW9rZVNlc3Npb24gfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7dGhpcy5iYXNlVXJsfS9rYXJhb2tlL3N0YXJ0YCwge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgLy8gVE9ETzogQWRkIGF1dGggdG9rZW4gd2hlbiBhdmFpbGFibGVcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHRyYWNrSWQsXG4gICAgICAgICAgc29uZ0RhdGEsXG4gICAgICAgIH0pLFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBzdGFydCBzZXNzaW9uOicsIHJlc3BvbnNlLnN0YXR1cyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICByZXR1cm4gcmVzdWx0LnNlc3Npb247XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBFcnJvciBzdGFydGluZyBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUZXN0IGNvbm5lY3Rpb24gdG8gdGhlIEFQSVxuICAgKi9cbiAgYXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7dGhpcy5iYXNlVXJsLnJlcGxhY2UoJy9hcGknLCAnJyl9L2hlYWx0aGApO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLm9rO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gQ29ubmVjdGlvbiB0ZXN0IGZhaWxlZDonLCBlcnJvcik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBrYXJhb2tlQXBpID0gbmV3IEthcmFva2VBcGlTZXJ2aWNlKCk7IiwiZXhwb3J0IGludGVyZmFjZSBUcmFja0luZm8ge1xuICB0cmFja0lkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGFydGlzdDogc3RyaW5nO1xuICBwbGF0Zm9ybTogJ3NvdW5kY2xvdWQnO1xuICB1cmw6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFRyYWNrRGV0ZWN0b3Ige1xuICAvKipcbiAgICogRGV0ZWN0IGN1cnJlbnQgdHJhY2sgZnJvbSB0aGUgcGFnZSAoU291bmRDbG91ZCBvbmx5KVxuICAgKi9cbiAgZGV0ZWN0Q3VycmVudFRyYWNrKCk6IFRyYWNrSW5mbyB8IG51bGwge1xuICAgIGNvbnN0IHVybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICAgIFxuICAgIC8vIE9ubHkgd29yayBvbiBzYy5tYWlkLnpvbmUgKFNvdW5kQ2xvdWQgcHJveHkpXG4gICAgaWYgKHVybC5pbmNsdWRlcygnc2MubWFpZC56b25lJykpIHtcbiAgICAgIHJldHVybiB0aGlzLmRldGVjdFNvdW5kQ2xvdWRUcmFjaygpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIEV4dHJhY3QgdHJhY2sgaW5mbyBmcm9tIFNvdW5kQ2xvdWQgKHNjLm1haWQuem9uZSlcbiAgICovXG4gIHByaXZhdGUgZGV0ZWN0U291bmRDbG91ZFRyYWNrKCk6IFRyYWNrSW5mbyB8IG51bGwge1xuICAgIHRyeSB7XG4gICAgICAvLyBTb3VuZENsb3VkIFVSTHM6IHNjLm1haWQuem9uZS91c2VyL3RyYWNrLW5hbWVcbiAgICAgIGNvbnN0IHBhdGhQYXJ0cyA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5zcGxpdCgnLycpLmZpbHRlcihCb29sZWFuKTtcbiAgICAgIGlmIChwYXRoUGFydHMubGVuZ3RoIDwgMikgcmV0dXJuIG51bGw7XG5cbiAgICAgIGNvbnN0IGFydGlzdCA9IHBhdGhQYXJ0c1swXTtcbiAgICAgIGNvbnN0IHRyYWNrU2x1ZyA9IHBhdGhQYXJ0c1sxXTtcbiAgICAgIFxuICAgICAgLy8gVHJ5IHRvIGdldCBhY3R1YWwgdGl0bGUgZnJvbSBwYWdlIChTb3VuZENsb3VkIHNlbGVjdG9ycylcbiAgICAgIGNvbnN0IHRpdGxlU2VsZWN0b3JzID0gW1xuICAgICAgICAnLnNvdW5kVGl0bGVfX3RpdGxlJyxcbiAgICAgICAgJy50cmFja0l0ZW1fX3RyYWNrVGl0bGUnLCBcbiAgICAgICAgJ2gxW2l0ZW1wcm9wPVwibmFtZVwiXScsXG4gICAgICAgICcuc291bmRfX2hlYWRlciBoMScsXG4gICAgICAgICcuc2MtdGV4dC1oNCcsXG4gICAgICAgICcuc2MtdGV4dC1wcmltYXJ5J1xuICAgICAgXTtcblxuICAgICAgbGV0IHRpdGxlID0gJyc7XG4gICAgICBmb3IgKGNvbnN0IHNlbGVjdG9yIG9mIHRpdGxlU2VsZWN0b3JzKSB7XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgICAgICAgaWYgKGVsZW1lbnQgJiYgZWxlbWVudC50ZXh0Q29udGVudCkge1xuICAgICAgICAgIHRpdGxlID0gZWxlbWVudC50ZXh0Q29udGVudC50cmltKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gRmFsbGJhY2sgdG8gc2x1Z1xuICAgICAgaWYgKCF0aXRsZSkge1xuICAgICAgICB0aXRsZSA9IHRyYWNrU2x1Zy5yZXBsYWNlKC8tL2csICcgJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIENsZWFuIHVwIGFydGlzdCBuYW1lXG4gICAgICBjb25zdCBjbGVhbkFydGlzdCA9IGFydGlzdC5yZXBsYWNlKC8tL2csICcgJykucmVwbGFjZSgvXy9nLCAnICcpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0cmFja0lkOiBgJHthcnRpc3R9LyR7dHJhY2tTbHVnfWAsXG4gICAgICAgIHRpdGxlOiB0aXRsZSxcbiAgICAgICAgYXJ0aXN0OiBjbGVhbkFydGlzdCxcbiAgICAgICAgcGxhdGZvcm06ICdzb3VuZGNsb3VkJyxcbiAgICAgICAgdXJsOiB3aW5kb3cubG9jYXRpb24uaHJlZixcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tUcmFja0RldGVjdG9yXSBFcnJvciBkZXRlY3RpbmcgU291bmRDbG91ZCB0cmFjazonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuXG4gIC8qKlxuICAgKiBXYXRjaCBmb3IgcGFnZSBjaGFuZ2VzIChTb3VuZENsb3VkIGlzIGEgU1BBKVxuICAgKi9cbiAgd2F0Y2hGb3JDaGFuZ2VzKGNhbGxiYWNrOiAodHJhY2s6IFRyYWNrSW5mbyB8IG51bGwpID0+IHZvaWQpOiAoKSA9PiB2b2lkIHtcbiAgICBsZXQgY3VycmVudFVybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICAgIGxldCBjdXJyZW50VHJhY2sgPSB0aGlzLmRldGVjdEN1cnJlbnRUcmFjaygpO1xuICAgIFxuICAgIC8vIEluaXRpYWwgZGV0ZWN0aW9uXG4gICAgY2FsbGJhY2soY3VycmVudFRyYWNrKTtcblxuICAgIC8vIFdhdGNoIGZvciBVUkwgY2hhbmdlc1xuICAgIGNvbnN0IGNoZWNrRm9yQ2hhbmdlcyA9ICgpID0+IHtcbiAgICAgIGNvbnN0IG5ld1VybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICAgICAgaWYgKG5ld1VybCAhPT0gY3VycmVudFVybCkge1xuICAgICAgICBjdXJyZW50VXJsID0gbmV3VXJsO1xuICAgICAgICBjb25zdCBuZXdUcmFjayA9IHRoaXMuZGV0ZWN0Q3VycmVudFRyYWNrKCk7XG4gICAgICAgIFxuICAgICAgICAvLyBPbmx5IHRyaWdnZXIgY2FsbGJhY2sgaWYgdHJhY2sgYWN0dWFsbHkgY2hhbmdlZFxuICAgICAgICBjb25zdCB0cmFja0NoYW5nZWQgPSAhY3VycmVudFRyYWNrIHx8ICFuZXdUcmFjayB8fCBcbiAgICAgICAgICBjdXJyZW50VHJhY2sudHJhY2tJZCAhPT0gbmV3VHJhY2sudHJhY2tJZDtcbiAgICAgICAgICBcbiAgICAgICAgaWYgKHRyYWNrQ2hhbmdlZCkge1xuICAgICAgICAgIGN1cnJlbnRUcmFjayA9IG5ld1RyYWNrO1xuICAgICAgICAgIGNhbGxiYWNrKG5ld1RyYWNrKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBQb2xsIGZvciBjaGFuZ2VzIChTUEFzIGRvbid0IGFsd2F5cyB0cmlnZ2VyIHByb3BlciBuYXZpZ2F0aW9uIGV2ZW50cylcbiAgICBjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKGNoZWNrRm9yQ2hhbmdlcywgMTAwMCk7XG5cbiAgICAvLyBBbHNvIGxpc3RlbiBmb3IgbmF2aWdhdGlvbiBldmVudHNcbiAgICBjb25zdCBoYW5kbGVOYXZpZ2F0aW9uID0gKCkgPT4ge1xuICAgICAgc2V0VGltZW91dChjaGVja0ZvckNoYW5nZXMsIDEwMCk7IC8vIFNtYWxsIGRlbGF5IGZvciBET00gdXBkYXRlc1xuICAgIH07XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCBoYW5kbGVOYXZpZ2F0aW9uKTtcbiAgICBcbiAgICAvLyBMaXN0ZW4gZm9yIHB1c2hzdGF0ZS9yZXBsYWNlc3RhdGUgKFNvdW5kQ2xvdWQgdXNlcyB0aGVzZSlcbiAgICBjb25zdCBvcmlnaW5hbFB1c2hTdGF0ZSA9IGhpc3RvcnkucHVzaFN0YXRlO1xuICAgIGNvbnN0IG9yaWdpbmFsUmVwbGFjZVN0YXRlID0gaGlzdG9yeS5yZXBsYWNlU3RhdGU7XG4gICAgXG4gICAgaGlzdG9yeS5wdXNoU3RhdGUgPSBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgICBvcmlnaW5hbFB1c2hTdGF0ZS5hcHBseShoaXN0b3J5LCBhcmdzKTtcbiAgICAgIGhhbmRsZU5hdmlnYXRpb24oKTtcbiAgICB9O1xuICAgIFxuICAgIGhpc3RvcnkucmVwbGFjZVN0YXRlID0gZnVuY3Rpb24oLi4uYXJncykge1xuICAgICAgb3JpZ2luYWxSZXBsYWNlU3RhdGUuYXBwbHkoaGlzdG9yeSwgYXJncyk7XG4gICAgICBoYW5kbGVOYXZpZ2F0aW9uKCk7XG4gICAgfTtcblxuICAgIC8vIFJldHVybiBjbGVhbnVwIGZ1bmN0aW9uXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgaGFuZGxlTmF2aWdhdGlvbik7XG4gICAgICBoaXN0b3J5LnB1c2hTdGF0ZSA9IG9yaWdpbmFsUHVzaFN0YXRlO1xuICAgICAgaGlzdG9yeS5yZXBsYWNlU3RhdGUgPSBvcmlnaW5hbFJlcGxhY2VTdGF0ZTtcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCB0cmFja0RldGVjdG9yID0gbmV3IFRyYWNrRGV0ZWN0b3IoKTsiLCJpbXBvcnQgeyBDb21wb25lbnQsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlRWZmZWN0LCBvbk1vdW50LCBvbkNsZWFudXAgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25LYXJhb2tlVmlldyB9IGZyb20gJ0BzY2FybGV0dC91aSc7XG5pbXBvcnQgeyBrYXJhb2tlQXBpLCB0eXBlIEthcmFva2VEYXRhLCB0eXBlIEx5cmljTGluZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2thcmFva2UtYXBpJztcbmltcG9ydCB7IHRyYWNrRGV0ZWN0b3IsIHR5cGUgVHJhY2tJbmZvIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvdHJhY2stZGV0ZWN0b3InO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbnRlbnRBcHBQcm9wcyB7XG4gIC8vIEFkZCBhbnkgcHJvcHMgbmVlZGVkIGZvciBjb21tdW5pY2F0aW9uIHdpdGggdGhlIHBhZ2Vcbn1cblxuZXhwb3J0IGNvbnN0IENvbnRlbnRBcHA6IENvbXBvbmVudDxDb250ZW50QXBwUHJvcHM+ID0gKCkgPT4ge1xuICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlbmRlcmluZyBDb250ZW50QXBwIGNvbXBvbmVudCcpO1xuICBcbiAgLy8gU3RhdGVcbiAgY29uc3QgW2N1cnJlbnRUcmFjaywgc2V0Q3VycmVudFRyYWNrXSA9IGNyZWF0ZVNpZ25hbDxUcmFja0luZm8gfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2thcmFva2VEYXRhLCBzZXRLYXJhb2tlRGF0YV0gPSBjcmVhdGVTaWduYWw8S2FyYW9rZURhdGEgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2lzTG9hZGluZywgc2V0SXNMb2FkaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtlcnJvciwgc2V0RXJyb3JdID0gY3JlYXRlU2lnbmFsPHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBcbiAgLy8gTW9jayBsZWFkZXJib2FyZCBkYXRhIChUT0RPOiBmZXRjaCByZWFsIGxlYWRlcmJvYXJkKVxuICBjb25zdCBtb2NrTGVhZGVyYm9hcmQgPSBbXG4gICAgeyByYW5rOiAxLCB1c2VybmFtZTogJ0thcmFva2VLaW5nJywgc2NvcmU6IDEyNTAwIH0sXG4gICAgeyByYW5rOiAyLCB1c2VybmFtZTogJ1NvbmdCaXJkOTInLCBzY29yZTogMTEyMDAgfSxcbiAgICB7IHJhbms6IDMsIHVzZXJuYW1lOiAnTWVsb2R5TWFzdGVyJywgc2NvcmU6IDEwODAwIH0sXG4gICAgeyByYW5rOiA0LCB1c2VybmFtZTogJ0N1cnJlbnRVc2VyJywgc2NvcmU6IDg3NTAsIGlzQ3VycmVudFVzZXI6IHRydWUgfSxcbiAgICB7IHJhbms6IDUsIHVzZXJuYW1lOiAnVm9jYWxWaXJ0dW9zbycsIHNjb3JlOiA4MjAwIH0sXG4gIF07XG5cbiAgLy8gRmV0Y2gga2FyYW9rZSBkYXRhIHdoZW4gdHJhY2sgY2hhbmdlc1xuICBjcmVhdGVFZmZlY3QoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHRyYWNrID0gY3VycmVudFRyYWNrKCk7XG4gICAgaWYgKCF0cmFjaykge1xuICAgICAgc2V0S2FyYW9rZURhdGEobnVsbCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGZXRjaGluZyBrYXJhb2tlIGRhdGEgZm9yIHRyYWNrOicsIHRyYWNrKTtcbiAgICBzZXRJc0xvYWRpbmcodHJ1ZSk7XG4gICAgc2V0RXJyb3IobnVsbCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGthcmFva2VBcGkuZ2V0S2FyYW9rZURhdGEoXG4gICAgICAgIHRyYWNrLnRyYWNrSWQsXG4gICAgICAgIHRyYWNrLnRpdGxlLFxuICAgICAgICB0cmFjay5hcnRpc3RcbiAgICAgICk7XG5cbiAgICAgIGlmIChkYXRhICYmIChkYXRhLmhhc0thcmFva2UgfHwgZGF0YS5oYXNfa2FyYW9rZSkpIHtcbiAgICAgICAgc2V0S2FyYW9rZURhdGEoZGF0YSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gS2FyYW9rZSBkYXRhIGxvYWRlZDonLCBkYXRhKTtcbiAgICAgIH0gZWxzZSBpZiAoZGF0YT8uYXBpX2Nvbm5lY3RlZCkge1xuICAgICAgICBzZXRFcnJvcihgQVBJIENvbm5lY3RlZCEgJHtkYXRhLmVycm9yIHx8ICdEYXRhYmFzZSBzZXR1cCBuZWVkZWQnfWApO1xuICAgICAgICBzZXRLYXJhb2tlRGF0YShkYXRhKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldEVycm9yKGRhdGE/Lm1lc3NhZ2UgfHwgZGF0YT8uZXJyb3IgfHwgJ05vIGthcmFva2UgZGF0YSBhdmFpbGFibGUgZm9yIHRoaXMgdHJhY2snKTtcbiAgICAgICAgc2V0S2FyYW9rZURhdGEobnVsbCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQ29udGVudEFwcF0gRXJyb3IgZmV0Y2hpbmcga2FyYW9rZSBkYXRhOicsIGVycik7XG4gICAgICBzZXRFcnJvcignRmFpbGVkIHRvIGxvYWQga2FyYW9rZSBkYXRhJyk7XG4gICAgICBzZXRLYXJhb2tlRGF0YShudWxsKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0SXNMb2FkaW5nKGZhbHNlKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIFNldCB1cCB0cmFjayBkZXRlY3Rpb25cbiAgb25Nb3VudCgoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTZXR0aW5nIHVwIHRyYWNrIGRldGVjdGlvbicpO1xuICAgIFxuICAgIC8vIFN0YXJ0IHdhdGNoaW5nIGZvciB0cmFjayBjaGFuZ2VzXG4gICAgY29uc3QgY2xlYW51cCA9IHRyYWNrRGV0ZWN0b3Iud2F0Y2hGb3JDaGFuZ2VzKCh0cmFjaykgPT4ge1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBUcmFjayBjaGFuZ2VkOicsIHRyYWNrKTtcbiAgICAgIHNldEN1cnJlbnRUcmFjayh0cmFjayk7XG4gICAgfSk7XG5cbiAgICBvbkNsZWFudXAoY2xlYW51cCk7XG4gIH0pO1xuXG4gIC8vIENvbnZlcnQgc2VydmVyIGx5cmljcyBmb3JtYXQgdG8gY29tcG9uZW50IGZvcm1hdFxuICBjb25zdCBnZXRMeXJpY3MgPSAoKTogTHlyaWNMaW5lW10gPT4ge1xuICAgIGNvbnN0IGRhdGEgPSBrYXJhb2tlRGF0YSgpO1xuICAgIGlmICghZGF0YT8ubHlyaWNzPy5saW5lcykgcmV0dXJuIFtdO1xuXG4gICAgcmV0dXJuIGRhdGEubHlyaWNzLmxpbmVzLm1hcCgobGluZSwgaW5kZXgpID0+ICh7XG4gICAgICBpZDogbGluZS5pZCB8fCBgbGluZS0ke2luZGV4fWAsXG4gICAgICB0ZXh0OiBsaW5lLnRleHQsXG4gICAgICBzdGFydFRpbWU6IGxpbmUuc3RhcnRUaW1lLFxuICAgICAgZHVyYXRpb246IGxpbmUuZHVyYXRpb24sXG4gICAgfSkpO1xuICB9O1xuXG4gIC8vIFByZXBhcmUgcHJvcHMgZm9yIEV4dGVuc2lvbkthcmFva2VWaWV3XG4gIGNvbnN0IGdldFZpZXdQcm9wcyA9ICgpID0+IHtcbiAgICBjb25zdCBkYXRhID0ga2FyYW9rZURhdGEoKTtcbiAgICBjb25zdCB0cmFjayA9IGN1cnJlbnRUcmFjaygpO1xuICAgIFxuICAgIGlmIChpc0xvYWRpbmcoKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc2NvcmU6IDAsXG4gICAgICAgIHJhbms6IDAsXG4gICAgICAgIGx5cmljczogW3sgaWQ6ICdsb2FkaW5nJywgdGV4dDogJ0xvYWRpbmcgbHlyaWNzLi4uJywgc3RhcnRUaW1lOiAwLCBkdXJhdGlvbjogMyB9XSxcbiAgICAgICAgbGVhZGVyYm9hcmQ6IFtdLFxuICAgICAgICBjdXJyZW50VGltZTogMCxcbiAgICAgICAgaXNQbGF5aW5nOiBmYWxzZSxcbiAgICAgICAgb25TdGFydDogKCkgPT4gY29uc29sZS5sb2coJ0xvYWRpbmcuLi4nKSxcbiAgICAgICAgb25TcGVlZENoYW5nZTogKCkgPT4ge30sXG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmIChlcnJvcigpIHx8ICEoZGF0YT8uaGFzS2FyYW9rZSB8fCBkYXRhPy5oYXNfa2FyYW9rZSkpIHtcbiAgICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9IGVycm9yKCkgfHwgJ05vIGthcmFva2UgYXZhaWxhYmxlIGZvciB0aGlzIHRyYWNrJztcbiAgICAgIGNvbnN0IGlzQXBpQ29ubmVjdGVkID0gZXJyb3JNZXNzYWdlLmluY2x1ZGVzKCdDYW5ub3QgcmVhZCBwcm9wZXJ0aWVzJykgfHwgZXJyb3JNZXNzYWdlLmluY2x1ZGVzKCdwcmVwYXJlJyk7XG4gICAgICBcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNjb3JlOiAwLFxuICAgICAgICByYW5rOiAwLFxuICAgICAgICBseXJpY3M6IFt7IFxuICAgICAgICAgIGlkOiAnZXJyb3InLCBcbiAgICAgICAgICB0ZXh0OiBpc0FwaUNvbm5lY3RlZCBcbiAgICAgICAgICAgID8gYOKchSBBUEkgQ29ubmVjdGVkISBTZXJ2ZXIgbmVlZHMgZGF0YWJhc2Ugc2V0dXAuIFRyYWNrOiAke3RyYWNrPy50aXRsZX1gIFxuICAgICAgICAgICAgOiBlcnJvck1lc3NhZ2UsIFxuICAgICAgICAgIHN0YXJ0VGltZTogMCwgXG4gICAgICAgICAgZHVyYXRpb246IDggXG4gICAgICAgIH1dLFxuICAgICAgICBsZWFkZXJib2FyZDogW10sXG4gICAgICAgIGN1cnJlbnRUaW1lOiAwLFxuICAgICAgICBpc1BsYXlpbmc6IGZhbHNlLFxuICAgICAgICBvblN0YXJ0OiAoKSA9PiBjb25zb2xlLmxvZygnQVBJIGNvbm5lY3Rpb24gdGVzdCBzdWNjZXNzZnVsJyksXG4gICAgICAgIG9uU3BlZWRDaGFuZ2U6ICgpID0+IHt9LFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgc2NvcmU6IDg3NTAsIC8vIFRPRE86IEdldCByZWFsIHVzZXIgc2NvcmVcbiAgICAgIHJhbms6IDQsIC8vIFRPRE86IEdldCByZWFsIHVzZXIgcmFua1xuICAgICAgbHlyaWNzOiBnZXRMeXJpY3MoKSxcbiAgICAgIGxlYWRlcmJvYXJkOiBtb2NrTGVhZGVyYm9hcmQsXG4gICAgICBjdXJyZW50VGltZTogMCwgLy8gVE9ETzogU3luYyB3aXRoIHZpZGVvL2F1ZGlvIHBsYXliYWNrXG4gICAgICBpc1BsYXlpbmc6IGZhbHNlLCAvLyBBbHdheXMgc2hvdyBzdGFydCBidXR0b24gZm9yIG5vd1xuICAgICAgb25TdGFydDogKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnU3RhcnQga2FyYW9rZSBmb3I6JywgdHJhY2s/LnRpdGxlKTtcbiAgICAgICAgLy8gVE9ETzogU3RhcnQga2FyYW9rZSBzZXNzaW9uXG4gICAgICB9LFxuICAgICAgb25TcGVlZENoYW5nZTogKHNwZWVkOiBudW1iZXIpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ1NwZWVkIGNoYW5nZWQgdG86Jywgc3BlZWQpO1xuICAgICAgICAvLyBUT0RPOiBJbXBsZW1lbnQgcGxheWJhY2sgc3BlZWQgY29udHJvbFxuICAgICAgfSxcbiAgICB9O1xuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz1cImthcmFva2Utd2lkZ2V0IGJnLWJhc2UgaC1mdWxsIG92ZXJmbG93LWhpZGRlbiByb3VuZGVkLWxnXCI+XG4gICAgICA8RXh0ZW5zaW9uS2FyYW9rZVZpZXcgey4uLmdldFZpZXdQcm9wcygpfSAvPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaGFkb3dSb290VWkgfSBmcm9tICd3eHQvdXRpbHMvY29udGVudC1zY3JpcHQtdWkvc2hhZG93LXJvb3QnO1xuaW1wb3J0IHsgZGVmaW5lQ29udGVudFNjcmlwdCB9IGZyb20gJ3d4dC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQnO1xuaW1wb3J0IHR5cGUgeyBDb250ZW50U2NyaXB0Q29udGV4dCB9IGZyb20gJ3d4dC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0JztcbmltcG9ydCB7IHJlbmRlciB9IGZyb20gJ3NvbGlkLWpzL3dlYic7XG5pbXBvcnQgeyBDb250ZW50QXBwIH0gZnJvbSAnLi4vc3JjL2FwcHMvY29udGVudC9Db250ZW50QXBwJztcbmltcG9ydCAnLi4vc3JjL3N0eWxlcy9leHRlbnNpb24uY3NzJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFsnKjovL3NvdW5kY2xvdWQuY29tLyonLCAnKjovL3NvdW5kY2xvYWsuY29tLyonLCAnKjovL3NjLm1haWQuem9uZS8qJywgJyo6Ly8qLm1haWQuem9uZS8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gIGNzc0luamVjdGlvbk1vZGU6ICd1aScsXG5cbiAgYXN5bmMgbWFpbihjdHg6IENvbnRlbnRTY3JpcHRDb250ZXh0KSB7XG4gICAgLy8gT25seSBydW4gaW4gdG9wLWxldmVsIGZyYW1lIHRvIGF2b2lkIGR1cGxpY2F0ZSBwcm9jZXNzaW5nIGluIGlmcmFtZXNcbiAgICBpZiAod2luZG93LnRvcCAhPT0gd2luZG93LnNlbGYpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbU2NhcmxldHQgQ1NdIE5vdCB0b3AtbGV2ZWwgZnJhbWUsIHNraXBwaW5nIGNvbnRlbnQgc2NyaXB0LicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCdbU2NhcmxldHQgQ1NdIFNjYXJsZXR0IEthcmFva2UgY29udGVudCBzY3JpcHQgbG9hZGVkJyk7XG5cbiAgICAvLyBDcmVhdGUgc2hhZG93IERPTSBhbmQgbW91bnQga2FyYW9rZSB3aWRnZXRcbiAgICBjb25zdCB1aSA9IGF3YWl0IGNyZWF0ZVNoYWRvd1Jvb3RVaShjdHgsIHtcbiAgICAgIG5hbWU6ICdzY2FybGV0dC1rYXJhb2tlLXVpJyxcbiAgICAgIHBvc2l0aW9uOiAnb3ZlcmxheScsXG4gICAgICBhbmNob3I6ICdib2R5JyxcbiAgICAgIG9uTW91bnQ6IGFzeW5jIChjb250YWluZXI6IEhUTUxFbGVtZW50KSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIG9uTW91bnQgY2FsbGVkLCBjb250YWluZXI6JywgY29udGFpbmVyKTtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gU2hhZG93IHJvb3Q6JywgY29udGFpbmVyLmdldFJvb3ROb2RlKCkpO1xuICAgICAgICBcbiAgICAgICAgLy8gTG9nIHdoYXQgc3R5bGVzaGVldHMgYXJlIGF2YWlsYWJsZVxuICAgICAgICBjb25zdCBzaGFkb3dSb290ID0gY29udGFpbmVyLmdldFJvb3ROb2RlKCkgYXMgU2hhZG93Um9vdDtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gU2hhZG93IHJvb3Qgc3R5bGVzaGVldHM6Jywgc2hhZG93Um9vdC5zdHlsZVNoZWV0cz8ubGVuZ3RoKTtcbiAgICAgICAgXG4gICAgICAgIC8vIENyZWF0ZSB3cmFwcGVyIHdpdGggcG9zaXRpb25pbmdcbiAgICAgICAgY29uc3Qgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICB3cmFwcGVyLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgICAgIHRvcDogMjBweDtcbiAgICAgICAgICByaWdodDogMjBweDtcbiAgICAgICAgICBib3R0b206IDIwcHg7XG4gICAgICAgICAgd2lkdGg6IDUwMHB4O1xuICAgICAgICAgIHotaW5kZXg6IDk5OTk5O1xuICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogMTZweDtcbiAgICAgICAgICBib3gtc2hhZG93OiAwIDI1cHggNTBweCAtMTJweCByZ2JhKDAsIDAsIDAsIDAuNik7XG4gICAgICAgIGA7XG4gICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gJ2thcmFva2Utd2lkZ2V0JztcbiAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKHdyYXBwZXIpO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIFdyYXBwZXIgY3JlYXRlZCBhbmQgYXBwZW5kZWQ6Jywgd3JhcHBlcik7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIFdyYXBwZXIgY29tcHV0ZWQgc3R5bGVzOicsIHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHdyYXBwZXIpKTtcblxuICAgICAgICAvLyBSZW5kZXIgQ29udGVudEFwcCBjb21wb25lbnQgKHdoaWNoIHVzZXMgRXh0ZW5zaW9uS2FyYW9rZVZpZXcpXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIEFib3V0IHRvIHJlbmRlciBDb250ZW50QXBwJyk7XG4gICAgICAgIGNvbnN0IGRpc3Bvc2UgPSByZW5kZXIoKCkgPT4gPENvbnRlbnRBcHAgLz4sIHdyYXBwZXIpO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gQ29udGVudEFwcCByZW5kZXJlZCwgZGlzcG9zZSBmdW5jdGlvbjonLCBkaXNwb3NlKTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiBkaXNwb3NlO1xuICAgICAgfSxcbiAgICAgIG9uUmVtb3ZlOiAoY2xlYW51cD86ICgpID0+IHZvaWQpID0+IHtcbiAgICAgICAgY2xlYW51cD8uKCk7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gTW91bnQgdGhlIFVJXG4gICAgdWkubW91bnQoKTtcbiAgICBjb25zb2xlLmxvZygnW1NjYXJsZXR0IENTXSBLYXJhb2tlIG92ZXJsYXkgbW91bnRlZCcpO1xuICB9LFxufSk7IiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuZXhwb3J0IGNsYXNzIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG4gIGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG4gICAgc3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG4gICAgdGhpcy5uZXdVcmwgPSBuZXdVcmw7XG4gICAgdGhpcy5vbGRVcmwgPSBvbGRVcmw7XG4gIH1cbiAgc3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0VW5pcXVlRXZlbnROYW1lKGV2ZW50TmFtZSkge1xuICByZXR1cm4gYCR7YnJvd3Nlcj8ucnVudGltZT8uaWR9OiR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9OiR7ZXZlbnROYW1lfWA7XG59XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMb2NhdGlvbldhdGNoZXIoY3R4KSB7XG4gIGxldCBpbnRlcnZhbDtcbiAgbGV0IG9sZFVybDtcbiAgcmV0dXJuIHtcbiAgICAvKipcbiAgICAgKiBFbnN1cmUgdGhlIGxvY2F0aW9uIHdhdGNoZXIgaXMgYWN0aXZlbHkgbG9va2luZyBmb3IgVVJMIGNoYW5nZXMuIElmIGl0J3MgYWxyZWFkeSB3YXRjaGluZyxcbiAgICAgKiB0aGlzIGlzIGEgbm9vcC5cbiAgICAgKi9cbiAgICBydW4oKSB7XG4gICAgICBpZiAoaW50ZXJ2YWwgIT0gbnVsbCkgcmV0dXJuO1xuICAgICAgb2xkVXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgIGludGVydmFsID0gY3R4LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgbGV0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICAgIGlmIChuZXdVcmwuaHJlZiAhPT0gb2xkVXJsLmhyZWYpIHtcbiAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIG9sZFVybCkpO1xuICAgICAgICAgIG9sZFVybCA9IG5ld1VybDtcbiAgICAgICAgfVxuICAgICAgfSwgMWUzKTtcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHtcbiAgZ2V0VW5pcXVlRXZlbnROYW1lXG59IGZyb20gXCIuL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzXCI7XG5pbXBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENvbnRlbnRTY3JpcHRDb250ZXh0IHtcbiAgY29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcbiAgICB0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLmFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBpZiAodGhpcy5pc1RvcEZyYW1lKSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cyh7IGlnbm9yZUZpcnN0RXZlbnQ6IHRydWUgfSk7XG4gICAgICB0aGlzLnN0b3BPbGRTY3JpcHRzKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG4gICAgfVxuICB9XG4gIHN0YXRpYyBTQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXG4gICAgXCJ3eHQ6Y29udGVudC1zY3JpcHQtc3RhcnRlZFwiXG4gICk7XG4gIGlzVG9wRnJhbWUgPSB3aW5kb3cuc2VsZiA9PT0gd2luZG93LnRvcDtcbiAgYWJvcnRDb250cm9sbGVyO1xuICBsb2NhdGlvbldhdGNoZXIgPSBjcmVhdGVMb2NhdGlvbldhdGNoZXIodGhpcyk7XG4gIHJlY2VpdmVkTWVzc2FnZUlkcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIGdldCBzaWduYWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcbiAgfVxuICBhYm9ydChyZWFzb24pIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuYWJvcnQocmVhc29uKTtcbiAgfVxuICBnZXQgaXNJbnZhbGlkKCkge1xuICAgIGlmIChicm93c2VyLnJ1bnRpbWUuaWQgPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zaWduYWwuYWJvcnRlZDtcbiAgfVxuICBnZXQgaXNWYWxpZCgpIHtcbiAgICByZXR1cm4gIXRoaXMuaXNJbnZhbGlkO1xuICB9XG4gIC8qKlxuICAgKiBBZGQgYSBsaXN0ZW5lciB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBjb250ZW50IHNjcmlwdCdzIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lci5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG4gICAqIGNvbnN0IHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIgPSBjdHgub25JbnZhbGlkYXRlZCgoKSA9PiB7XG4gICAqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihjYik7XG4gICAqIH0pXG4gICAqIC8vIC4uLlxuICAgKiByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG4gICAqL1xuICBvbkludmFsaWRhdGVkKGNiKSB7XG4gICAgdGhpcy5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgICByZXR1cm4gKCkgPT4gdGhpcy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgfVxuICAvKipcbiAgICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IG5ldmVyIHJlc29sdmVzLiBVc2VmdWwgaWYgeW91IGhhdmUgYW4gYXN5bmMgZnVuY3Rpb24gdGhhdCBzaG91bGRuJ3QgcnVuXG4gICAqIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IGdldFZhbHVlRnJvbVN0b3JhZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAqICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcbiAgICpcbiAgICogICAvLyAuLi5cbiAgICogfVxuICAgKi9cbiAgYmxvY2soKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICovXG4gIHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKi9cbiAgc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICovXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICovXG4gIHJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RJZGxlQ2FsbGJhY2soKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICghdGhpcy5zaWduYWwuYWJvcnRlZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSwgb3B0aW9ucyk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbElkbGVDYWxsYmFjayhpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICBhZGRFdmVudExpc3RlbmVyKHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0aW9ucykge1xuICAgIGlmICh0eXBlID09PSBcInd4dDpsb2NhdGlvbmNoYW5nZVwiKSB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSB0aGlzLmxvY2F0aW9uV2F0Y2hlci5ydW4oKTtcbiAgICB9XG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXI/LihcbiAgICAgIHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLFxuICAgICAgaGFuZGxlcixcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgc2lnbmFsOiB0aGlzLnNpZ25hbFxuICAgICAgfVxuICAgICk7XG4gIH1cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKiBBYm9ydCB0aGUgYWJvcnQgY29udHJvbGxlciBhbmQgZXhlY3V0ZSBhbGwgYG9uSW52YWxpZGF0ZWRgIGxpc3RlbmVycy5cbiAgICovXG4gIG5vdGlmeUludmFsaWRhdGVkKCkge1xuICAgIHRoaXMuYWJvcnQoXCJDb250ZW50IHNjcmlwdCBjb250ZXh0IGludmFsaWRhdGVkXCIpO1xuICAgIGxvZ2dlci5kZWJ1ZyhcbiAgICAgIGBDb250ZW50IHNjcmlwdCBcIiR7dGhpcy5jb250ZW50U2NyaXB0TmFtZX1cIiBjb250ZXh0IGludmFsaWRhdGVkYFxuICAgICk7XG4gIH1cbiAgc3RvcE9sZFNjcmlwdHMoKSB7XG4gICAgd2luZG93LnBvc3RNZXNzYWdlKFxuICAgICAge1xuICAgICAgICB0eXBlOiBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsXG4gICAgICAgIGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuICAgICAgICBtZXNzYWdlSWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpXG4gICAgICB9LFxuICAgICAgXCIqXCJcbiAgICApO1xuICB9XG4gIHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuICAgIGNvbnN0IGlzU2NyaXB0U3RhcnRlZEV2ZW50ID0gZXZlbnQuZGF0YT8udHlwZSA9PT0gQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFO1xuICAgIGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kYXRhPy5jb250ZW50U2NyaXB0TmFtZSA9PT0gdGhpcy5jb250ZW50U2NyaXB0TmFtZTtcbiAgICBjb25zdCBpc05vdER1cGxpY2F0ZSA9ICF0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5oYXMoZXZlbnQuZGF0YT8ubWVzc2FnZUlkKTtcbiAgICByZXR1cm4gaXNTY3JpcHRTdGFydGVkRXZlbnQgJiYgaXNTYW1lQ29udGVudFNjcmlwdCAmJiBpc05vdER1cGxpY2F0ZTtcbiAgfVxuICBsaXN0ZW5Gb3JOZXdlclNjcmlwdHMob3B0aW9ucykge1xuICAgIGxldCBpc0ZpcnN0ID0gdHJ1ZTtcbiAgICBjb25zdCBjYiA9IChldmVudCkgPT4ge1xuICAgICAgaWYgKHRoaXMudmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSkge1xuICAgICAgICB0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5hZGQoZXZlbnQuZGF0YS5tZXNzYWdlSWQpO1xuICAgICAgICBjb25zdCB3YXNGaXJzdCA9IGlzRmlyc3Q7XG4gICAgICAgIGlzRmlyc3QgPSBmYWxzZTtcbiAgICAgICAgaWYgKHdhc0ZpcnN0ICYmIG9wdGlvbnM/Lmlnbm9yZUZpcnN0RXZlbnQpIHJldHVybjtcbiAgICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgICAgfVxuICAgIH07XG4gICAgYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiByZW1vdmVFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYikpO1xuICB9XG59XG4iXSwibmFtZXMiOlsidmFsdWUiLCJpIiwic291cmNlcyIsImRpc3Bvc2UiLCJkb2N1bWVudCIsImFkZEV2ZW50TGlzdGVuZXIiLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lIiwicHJpbnQiLCJsb2dnZXIiLCJfYSIsIl9iIiwicmVzdWx0IiwicmVtb3ZlRGV0ZWN0b3IiLCJtb3VudERldGVjdG9yIiwiZGVmaW5pdGlvbiIsIl8kZGVsZWdhdGVFdmVudHMiLCJTY29yZVBhbmVsIiwicHJvcHMiLCJfZWwkIiwiX3RtcGwkIiwiX2VsJDIiLCJmaXJzdENoaWxkIiwiX2VsJDMiLCJfZWwkNCIsIm5leHRTaWJsaW5nIiwiX2VsJDUiLCJzY29yZSIsInJhbmsiLCJfJGNsYXNzTmFtZSIsImNuIiwiY2xhc3MiLCJMeXJpY3NEaXNwbGF5IiwiY3VycmVudExpbmVJbmRleCIsInNldEN1cnJlbnRMaW5lSW5kZXgiLCJjcmVhdGVTaWduYWwiLCJjb250YWluZXJSZWYiLCJjcmVhdGVFZmZlY3QiLCJjdXJyZW50VGltZSIsInRpbWUiLCJpbmRleCIsImx5cmljcyIsImZpbmRJbmRleCIsImxpbmUiLCJlbmRUaW1lIiwic3RhcnRUaW1lIiwiZHVyYXRpb24iLCJpc1BsYXlpbmciLCJsaW5lRWxlbWVudHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwiY3VycmVudEVsZW1lbnQiLCJjb250YWluZXJIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJsaW5lVG9wIiwib2Zmc2V0VG9wIiwibGluZUhlaWdodCIsIm9mZnNldEhlaWdodCIsInNjcm9sbFRvcCIsInNjcm9sbFRvIiwidG9wIiwiYmVoYXZpb3IiLCJfcmVmJCIsIl8kdXNlIiwiXyRjcmVhdGVDb21wb25lbnQiLCJGb3IiLCJlYWNoIiwiY2hpbGRyZW4iLCJfdG1wbCQyIiwidGV4dCIsIl8kZWZmZWN0IiwiX3AkIiwiX3YkIiwiX3YkMiIsImUiLCJfJHNldEF0dHJpYnV0ZSIsInQiLCJ1bmRlZmluZWQiLCJMZWFkZXJib2FyZFBhbmVsIiwiZW50cmllcyIsImVudHJ5IiwiX2VsJDYiLCJfJGluc2VydCIsInVzZXJuYW1lIiwidG9Mb2NhbGVTdHJpbmciLCJpc0N1cnJlbnRVc2VyIiwiX3YkMyIsIl92JDQiLCJhIiwibyIsInNwZWVkcyIsIlNwbGl0QnV0dG9uIiwiY3VycmVudFNwZWVkSW5kZXgiLCJzZXRDdXJyZW50U3BlZWRJbmRleCIsImN1cnJlbnRTcGVlZCIsImN5Y2xlU3BlZWQiLCJzdG9wUHJvcGFnYXRpb24iLCJuZXh0SW5kZXgiLCJsZW5ndGgiLCJuZXdTcGVlZCIsIm9uU3BlZWRDaGFuZ2UiLCJfJGFkZEV2ZW50TGlzdGVuZXIiLCJvblN0YXJ0IiwiJCRjbGljayIsImRpc2FibGVkIiwiX3YkNSIsImN1cnJlbnRUYWJzU3RhdGUiLCJUYWJzIiwiYWN0aXZlVGFiIiwic2V0QWN0aXZlVGFiIiwiZGVmYXVsdFRhYiIsInRhYnMiLCJpZCIsImhhbmRsZVRhYkNoYW5nZSIsIm9uVGFiQ2hhbmdlIiwiVGFic0xpc3QiLCJUYWJzVHJpZ2dlciIsImlzQWN0aXZlIiwiVGFic0NvbnRlbnQiLCJTaG93Iiwid2hlbiIsIkV4dGVuc2lvbkthcmFva2VWaWV3IiwiX3RtcGwkNCIsImxhYmVsIiwiXyRtZW1vIiwiX3RtcGwkNSIsIl90bXBsJDMiLCJsZWFkZXJib2FyZCIsIkNvbnRlbnRBcHAiLCJjb25zb2xlIiwibG9nIiwiY3VycmVudFRyYWNrIiwic2V0Q3VycmVudFRyYWNrIiwia2FyYW9rZURhdGEiLCJzZXRLYXJhb2tlRGF0YSIsImlzTG9hZGluZyIsInNldElzTG9hZGluZyIsImVycm9yIiwic2V0RXJyb3IiLCJtb2NrTGVhZGVyYm9hcmQiLCJ0cmFjayIsImRhdGEiLCJrYXJhb2tlQXBpIiwiZ2V0S2FyYW9rZURhdGEiLCJ0cmFja0lkIiwidGl0bGUiLCJhcnRpc3QiLCJoYXNLYXJhb2tlIiwiaGFzX2thcmFva2UiLCJhcGlfY29ubmVjdGVkIiwibWVzc2FnZSIsImVyciIsIm9uTW91bnQiLCJjbGVhbnVwIiwidHJhY2tEZXRlY3RvciIsIndhdGNoRm9yQ2hhbmdlcyIsIm9uQ2xlYW51cCIsImdldEx5cmljcyIsImxpbmVzIiwibWFwIiwiZ2V0Vmlld1Byb3BzIiwiZXJyb3JNZXNzYWdlIiwiaXNBcGlDb25uZWN0ZWQiLCJpbmNsdWRlcyIsInNwZWVkIiwiXyRtZXJnZVByb3BzIiwiZGVmaW5lQ29udGVudFNjcmlwdCIsIm1hdGNoZXMiLCJydW5BdCIsImNzc0luamVjdGlvbk1vZGUiLCJtYWluIiwiY3R4Iiwid2luZG93Iiwic2VsZiIsInVpIiwiY3JlYXRlU2hhZG93Um9vdFVpIiwibmFtZSIsInBvc2l0aW9uIiwiYW5jaG9yIiwiY29udGFpbmVyIiwiZ2V0Um9vdE5vZGUiLCJzaGFkb3dSb290Iiwic3R5bGVTaGVldHMiLCJ3cmFwcGVyIiwiY3JlYXRlRWxlbWVudCIsInN0eWxlIiwiY3NzVGV4dCIsImNsYXNzTmFtZSIsImFwcGVuZENoaWxkIiwiZ2V0Q29tcHV0ZWRTdHlsZSIsInJlbmRlciIsIm9uUmVtb3ZlIiwibW91bnQiXSwibWFwcGluZ3MiOiI7Ozs7OztBQWdKQSxRQUFNLFNBQVM7QUFDZixRQUFNLFVBQVUsQ0FBQyxHQUFHLE1BQU0sTUFBTTtBQUNoQyxRQUFNLFNBQVMsT0FBTyxhQUFhO0FBQ25DLFFBQU0saUJBQWlCLE9BQU8sVUFBVTtBQUN4QyxRQUFNLFNBQVMsT0FBTyxhQUFhO0FBQ25DLFFBQU0sV0FBVyxPQUFPLHFCQUFxQjtBQUM3QyxRQUFNLGdCQUFnQjtBQUFBLElBQ3BCLFFBQVE7QUFBQSxFQUNWO0FBRUEsTUFBSSxhQUFhO0FBQ2pCLFFBQU0sUUFBUTtBQUNkLFFBQU0sVUFBVTtBQUNoQixRQUFNLFVBQVUsQ0FL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WSxVQUFTLHNCQUFxQjtBQUN2RSxZQUFNLHdCQUFzQkMsTUFBQSxNQUFNLFNBQU4sZ0JBQUFBLElBQVksdUJBQXNCLEtBQUs7QUFDbkUsWUFBTSxpQkFBaUIsQ0FBQyxLQUFLLG1CQUFtQixLQUFJLFdBQU0sU0FBTixtQkFBWSxTQUFTO0FBQ3pFLGFBQU8sd0JBQXdCLHVCQUF1QjtBQUFBLElBQzFEO0FBQUEsSUFDRSxzQkFBc0IsU0FBUztBQUM3QixVQUFJLFVBQVU7QUFDZCxZQUFNLEtBQUssQ0FBQyxVQUFVO0FBQ3BCLFlBQUksS0FBSyx5QkFBeUIsS0FBSyxHQUFHO0FBQ3hDLGVBQUssbUJBQW1CLElBQUksTUFBTSxLQUFLLFNBQVM7QUFDaEQsZ0JBQU0sV0FBVztBQUNqQixvQkFBVTtBQUNWLGNBQUksYUFBWSxtQ0FBUyxrQkFBa0I7QUFDM0MsZUFBSyxrQkFBbUI7QUFBQSxRQUNoQztBQUFBLE1BQ0s7QUFDRCx1QkFBaUIsV0FBVyxFQUFFO0FBQzlCLFdBQUssY0FBYyxNQUFNLG9CQUFvQixXQUFXLEVBQUUsQ0FBQztBQUFBLElBQy9EO0FBQUEsRUFDQTtBQXJKRSxnQkFaVyx1QkFZSiwrQkFBOEI7QUFBQSxJQUNuQztBQUFBLEVBQ0Q7QUFkSSxNQUFNLHVCQUFOOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsMSwyLDMsNCw1LDYsNyw4LDksMTAsMTEsMTIsMTMsMTQsMTUsMzEsMzIsMzNdfQ==

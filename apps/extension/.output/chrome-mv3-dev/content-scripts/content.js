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
          method: "GET",
          headers: {
            "Content-Type": "application/json"
          }
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
            hasKaraoke: false,
            error: data.error,
            trackId,
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
        if (data && data.hasKaraoke) {
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
      if (error() || !(data == null ? void 0 : data.hasKaraoke)) {
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
        // TODO: Detect if video/audio is playing
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL2Rpc3QvZGV2LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL3dlYi9kaXN0L2Rldi5qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWUvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnQvbGliL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbnkta2V5cy1tYXAvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvZGVmdS9kaXN0L2RlZnUubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0AxbmF0c3Uvd2FpdC1lbGVtZW50L2Rpc3QvZGV0ZWN0b3JzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AMW5hdHN1L3dhaXQtZWxlbWVudC9kaXN0L2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYXJlZC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9jbHN4L2Rpc3QvY2xzeC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvY24udHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9sYXlvdXQvSGVhZGVyL0hlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9kaXNwbGF5L1Njb3JlUGFuZWwvU2NvcmVQYW5lbC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9rYXJhb2tlL0x5cmljc0Rpc3BsYXkvTHlyaWNzRGlzcGxheS50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9rYXJhb2tlL0thcmFva2VIZWFkZXIvS2FyYW9rZUhlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9rYXJhb2tlL0xlYWRlcmJvYXJkUGFuZWwvTGVhZGVyYm9hcmRQYW5lbC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vU3BsaXRCdXR0b24vU3BsaXRCdXR0b24udHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvY29tbW9uL1RhYnMvVGFicy50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9rYXJhb2tlL0V4dGVuc2lvbkthcmFva2VWaWV3L0V4dGVuc2lvbkthcmFva2VWaWV3LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3ByYWN0aWNlL1ByYWN0aWNlSGVhZGVyL1ByYWN0aWNlSGVhZGVyLnRzeCIsIi4uLy4uLy4uL3NyYy9zZXJ2aWNlcy9rYXJhb2tlLWFwaS50cyIsIi4uLy4uLy4uL3NyYy9zZXJ2aWNlcy90cmFjay1kZXRlY3Rvci50cyIsIi4uLy4uLy4uL3NyYy9hcHBzL2NvbnRlbnQvQ29udGVudEFwcC50c3giLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50LnRzeCIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgdGFza0lkQ291bnRlciA9IDEsXG4gIGlzQ2FsbGJhY2tTY2hlZHVsZWQgPSBmYWxzZSxcbiAgaXNQZXJmb3JtaW5nV29yayA9IGZhbHNlLFxuICB0YXNrUXVldWUgPSBbXSxcbiAgY3VycmVudFRhc2sgPSBudWxsLFxuICBzaG91bGRZaWVsZFRvSG9zdCA9IG51bGwsXG4gIHlpZWxkSW50ZXJ2YWwgPSA1LFxuICBkZWFkbGluZSA9IDAsXG4gIG1heFlpZWxkSW50ZXJ2YWwgPSAzMDAsXG4gIHNjaGVkdWxlQ2FsbGJhY2sgPSBudWxsLFxuICBzY2hlZHVsZWRDYWxsYmFjayA9IG51bGw7XG5jb25zdCBtYXhTaWduZWQzMUJpdEludCA9IDEwNzM3NDE4MjM7XG5mdW5jdGlvbiBzZXR1cFNjaGVkdWxlcigpIHtcbiAgY29uc3QgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpLFxuICAgIHBvcnQgPSBjaGFubmVsLnBvcnQyO1xuICBzY2hlZHVsZUNhbGxiYWNrID0gKCkgPT4gcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSAoKSA9PiB7XG4gICAgaWYgKHNjaGVkdWxlZENhbGxiYWNrICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBjdXJyZW50VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgZGVhZGxpbmUgPSBjdXJyZW50VGltZSArIHlpZWxkSW50ZXJ2YWw7XG4gICAgICBjb25zdCBoYXNUaW1lUmVtYWluaW5nID0gdHJ1ZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGhhc01vcmVXb3JrID0gc2NoZWR1bGVkQ2FsbGJhY2soaGFzVGltZVJlbWFpbmluZywgY3VycmVudFRpbWUpO1xuICAgICAgICBpZiAoIWhhc01vcmVXb3JrKSB7XG4gICAgICAgICAgc2NoZWR1bGVkQ2FsbGJhY2sgPSBudWxsO1xuICAgICAgICB9IGVsc2UgcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHBvcnQucG9zdE1lc3NhZ2UobnVsbCk7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgaWYgKG5hdmlnYXRvciAmJiBuYXZpZ2F0b3Iuc2NoZWR1bGluZyAmJiBuYXZpZ2F0b3Iuc2NoZWR1bGluZy5pc0lucHV0UGVuZGluZykge1xuICAgIGNvbnN0IHNjaGVkdWxpbmcgPSBuYXZpZ2F0b3Iuc2NoZWR1bGluZztcbiAgICBzaG91bGRZaWVsZFRvSG9zdCA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBpZiAoY3VycmVudFRpbWUgPj0gZGVhZGxpbmUpIHtcbiAgICAgICAgaWYgKHNjaGVkdWxpbmcuaXNJbnB1dFBlbmRpbmcoKSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjdXJyZW50VGltZSA+PSBtYXhZaWVsZEludGVydmFsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgc2hvdWxkWWllbGRUb0hvc3QgPSAoKSA9PiBwZXJmb3JtYW5jZS5ub3coKSA+PSBkZWFkbGluZTtcbiAgfVxufVxuZnVuY3Rpb24gZW5xdWV1ZSh0YXNrUXVldWUsIHRhc2spIHtcbiAgZnVuY3Rpb24gZmluZEluZGV4KCkge1xuICAgIGxldCBtID0gMDtcbiAgICBsZXQgbiA9IHRhc2tRdWV1ZS5sZW5ndGggLSAxO1xuICAgIHdoaWxlIChtIDw9IG4pIHtcbiAgICAgIGNvbnN0IGsgPSBuICsgbSA+PiAxO1xuICAgICAgY29uc3QgY21wID0gdGFzay5leHBpcmF0aW9uVGltZSAtIHRhc2tRdWV1ZVtrXS5leHBpcmF0aW9uVGltZTtcbiAgICAgIGlmIChjbXAgPiAwKSBtID0gayArIDE7ZWxzZSBpZiAoY21wIDwgMCkgbiA9IGsgLSAxO2Vsc2UgcmV0dXJuIGs7XG4gICAgfVxuICAgIHJldHVybiBtO1xuICB9XG4gIHRhc2tRdWV1ZS5zcGxpY2UoZmluZEluZGV4KCksIDAsIHRhc2spO1xufVxuZnVuY3Rpb24gcmVxdWVzdENhbGxiYWNrKGZuLCBvcHRpb25zKSB7XG4gIGlmICghc2NoZWR1bGVDYWxsYmFjaykgc2V0dXBTY2hlZHVsZXIoKTtcbiAgbGV0IHN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpLFxuICAgIHRpbWVvdXQgPSBtYXhTaWduZWQzMUJpdEludDtcbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy50aW1lb3V0KSB0aW1lb3V0ID0gb3B0aW9ucy50aW1lb3V0O1xuICBjb25zdCBuZXdUYXNrID0ge1xuICAgIGlkOiB0YXNrSWRDb3VudGVyKyssXG4gICAgZm4sXG4gICAgc3RhcnRUaW1lLFxuICAgIGV4cGlyYXRpb25UaW1lOiBzdGFydFRpbWUgKyB0aW1lb3V0XG4gIH07XG4gIGVucXVldWUodGFza1F1ZXVlLCBuZXdUYXNrKTtcbiAgaWYgKCFpc0NhbGxiYWNrU2NoZWR1bGVkICYmICFpc1BlcmZvcm1pbmdXb3JrKSB7XG4gICAgaXNDYWxsYmFja1NjaGVkdWxlZCA9IHRydWU7XG4gICAgc2NoZWR1bGVkQ2FsbGJhY2sgPSBmbHVzaFdvcms7XG4gICAgc2NoZWR1bGVDYWxsYmFjaygpO1xuICB9XG4gIHJldHVybiBuZXdUYXNrO1xufVxuZnVuY3Rpb24gY2FuY2VsQ2FsbGJhY2sodGFzaykge1xuICB0YXNrLmZuID0gbnVsbDtcbn1cbmZ1bmN0aW9uIGZsdXNoV29yayhoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSkge1xuICBpc0NhbGxiYWNrU2NoZWR1bGVkID0gZmFsc2U7XG4gIGlzUGVyZm9ybWluZ1dvcmsgPSB0cnVlO1xuICB0cnkge1xuICAgIHJldHVybiB3b3JrTG9vcChoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSk7XG4gIH0gZmluYWxseSB7XG4gICAgY3VycmVudFRhc2sgPSBudWxsO1xuICAgIGlzUGVyZm9ybWluZ1dvcmsgPSBmYWxzZTtcbiAgfVxufVxuZnVuY3Rpb24gd29ya0xvb3AoaGFzVGltZVJlbWFpbmluZywgaW5pdGlhbFRpbWUpIHtcbiAgbGV0IGN1cnJlbnRUaW1lID0gaW5pdGlhbFRpbWU7XG4gIGN1cnJlbnRUYXNrID0gdGFza1F1ZXVlWzBdIHx8IG51bGw7XG4gIHdoaWxlIChjdXJyZW50VGFzayAhPT0gbnVsbCkge1xuICAgIGlmIChjdXJyZW50VGFzay5leHBpcmF0aW9uVGltZSA+IGN1cnJlbnRUaW1lICYmICghaGFzVGltZVJlbWFpbmluZyB8fCBzaG91bGRZaWVsZFRvSG9zdCgpKSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNvbnN0IGNhbGxiYWNrID0gY3VycmVudFRhc2suZm47XG4gICAgaWYgKGNhbGxiYWNrICE9PSBudWxsKSB7XG4gICAgICBjdXJyZW50VGFzay5mbiA9IG51bGw7XG4gICAgICBjb25zdCBkaWRVc2VyQ2FsbGJhY2tUaW1lb3V0ID0gY3VycmVudFRhc2suZXhwaXJhdGlvblRpbWUgPD0gY3VycmVudFRpbWU7XG4gICAgICBjYWxsYmFjayhkaWRVc2VyQ2FsbGJhY2tUaW1lb3V0KTtcbiAgICAgIGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBpZiAoY3VycmVudFRhc2sgPT09IHRhc2tRdWV1ZVswXSkge1xuICAgICAgICB0YXNrUXVldWUuc2hpZnQoKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgdGFza1F1ZXVlLnNoaWZ0KCk7XG4gICAgY3VycmVudFRhc2sgPSB0YXNrUXVldWVbMF0gfHwgbnVsbDtcbiAgfVxuICByZXR1cm4gY3VycmVudFRhc2sgIT09IG51bGw7XG59XG5cbmNvbnN0IHNoYXJlZENvbmZpZyA9IHtcbiAgY29udGV4dDogdW5kZWZpbmVkLFxuICByZWdpc3RyeTogdW5kZWZpbmVkLFxuICBlZmZlY3RzOiB1bmRlZmluZWQsXG4gIGRvbmU6IGZhbHNlLFxuICBnZXRDb250ZXh0SWQoKSB7XG4gICAgcmV0dXJuIGdldENvbnRleHRJZCh0aGlzLmNvbnRleHQuY291bnQpO1xuICB9LFxuICBnZXROZXh0Q29udGV4dElkKCkge1xuICAgIHJldHVybiBnZXRDb250ZXh0SWQodGhpcy5jb250ZXh0LmNvdW50KyspO1xuICB9XG59O1xuZnVuY3Rpb24gZ2V0Q29udGV4dElkKGNvdW50KSB7XG4gIGNvbnN0IG51bSA9IFN0cmluZyhjb3VudCksXG4gICAgbGVuID0gbnVtLmxlbmd0aCAtIDE7XG4gIHJldHVybiBzaGFyZWRDb25maWcuY29udGV4dC5pZCArIChsZW4gPyBTdHJpbmcuZnJvbUNoYXJDb2RlKDk2ICsgbGVuKSA6IFwiXCIpICsgbnVtO1xufVxuZnVuY3Rpb24gc2V0SHlkcmF0ZUNvbnRleHQoY29udGV4dCkge1xuICBzaGFyZWRDb25maWcuY29udGV4dCA9IGNvbnRleHQ7XG59XG5mdW5jdGlvbiBuZXh0SHlkcmF0ZUNvbnRleHQoKSB7XG4gIHJldHVybiB7XG4gICAgLi4uc2hhcmVkQ29uZmlnLmNvbnRleHQsXG4gICAgaWQ6IHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCksXG4gICAgY291bnQ6IDBcbiAgfTtcbn1cblxuY29uc3QgSVNfREVWID0gdHJ1ZTtcbmNvbnN0IGVxdWFsRm4gPSAoYSwgYikgPT4gYSA9PT0gYjtcbmNvbnN0ICRQUk9YWSA9IFN5bWJvbChcInNvbGlkLXByb3h5XCIpO1xuY29uc3QgU1VQUE9SVFNfUFJPWFkgPSB0eXBlb2YgUHJveHkgPT09IFwiZnVuY3Rpb25cIjtcbmNvbnN0ICRUUkFDSyA9IFN5bWJvbChcInNvbGlkLXRyYWNrXCIpO1xuY29uc3QgJERFVkNPTVAgPSBTeW1ib2woXCJzb2xpZC1kZXYtY29tcG9uZW50XCIpO1xuY29uc3Qgc2lnbmFsT3B0aW9ucyA9IHtcbiAgZXF1YWxzOiBlcXVhbEZuXG59O1xubGV0IEVSUk9SID0gbnVsbDtcbmxldCBydW5FZmZlY3RzID0gcnVuUXVldWU7XG5jb25zdCBTVEFMRSA9IDE7XG5jb25zdCBQRU5ESU5HID0gMjtcbmNvbnN0IFVOT1dORUQgPSB7XG4gIG93bmVkOiBudWxsLFxuICBjbGVhbnVwczogbnVsbCxcbiAgY29udGV4dDogbnVsbCxcbiAgb3duZXI6IG51bGxcbn07XG5jb25zdCBOT19JTklUID0ge307XG52YXIgT3duZXIgPSBudWxsO1xubGV0IFRyYW5zaXRpb24gPSBudWxsO1xubGV0IFNjaGVkdWxlciA9IG51bGw7XG5sZXQgRXh0ZXJuYWxTb3VyY2VDb25maWcgPSBudWxsO1xubGV0IExpc3RlbmVyID0gbnVsbDtcbmxldCBVcGRhdGVzID0gbnVsbDtcbmxldCBFZmZlY3RzID0gbnVsbDtcbmxldCBFeGVjQ291bnQgPSAwO1xuY29uc3QgRGV2SG9va3MgPSB7XG4gIGFmdGVyVXBkYXRlOiBudWxsLFxuICBhZnRlckNyZWF0ZU93bmVyOiBudWxsLFxuICBhZnRlckNyZWF0ZVNpZ25hbDogbnVsbCxcbiAgYWZ0ZXJSZWdpc3RlckdyYXBoOiBudWxsXG59O1xuZnVuY3Rpb24gY3JlYXRlUm9vdChmbiwgZGV0YWNoZWRPd25lcikge1xuICBjb25zdCBsaXN0ZW5lciA9IExpc3RlbmVyLFxuICAgIG93bmVyID0gT3duZXIsXG4gICAgdW5vd25lZCA9IGZuLmxlbmd0aCA9PT0gMCxcbiAgICBjdXJyZW50ID0gZGV0YWNoZWRPd25lciA9PT0gdW5kZWZpbmVkID8gb3duZXIgOiBkZXRhY2hlZE93bmVyLFxuICAgIHJvb3QgPSB1bm93bmVkID8ge1xuICAgICAgb3duZWQ6IG51bGwsXG4gICAgICBjbGVhbnVwczogbnVsbCxcbiAgICAgIGNvbnRleHQ6IG51bGwsXG4gICAgICBvd25lcjogbnVsbFxuICAgIH0gIDoge1xuICAgICAgb3duZWQ6IG51bGwsXG4gICAgICBjbGVhbnVwczogbnVsbCxcbiAgICAgIGNvbnRleHQ6IGN1cnJlbnQgPyBjdXJyZW50LmNvbnRleHQgOiBudWxsLFxuICAgICAgb3duZXI6IGN1cnJlbnRcbiAgICB9LFxuICAgIHVwZGF0ZUZuID0gdW5vd25lZCA/ICgpID0+IGZuKCgpID0+IHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkRpc3Bvc2UgbWV0aG9kIG11c3QgYmUgYW4gZXhwbGljaXQgYXJndW1lbnQgdG8gY3JlYXRlUm9vdCBmdW5jdGlvblwiKTtcbiAgICB9KSAgOiAoKSA9PiBmbigoKSA9PiB1bnRyYWNrKCgpID0+IGNsZWFuTm9kZShyb290KSkpO1xuICBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyICYmIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIocm9vdCk7XG4gIE93bmVyID0gcm9vdDtcbiAgTGlzdGVuZXIgPSBudWxsO1xuICB0cnkge1xuICAgIHJldHVybiBydW5VcGRhdGVzKHVwZGF0ZUZuLCB0cnVlKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICAgIE93bmVyID0gb3duZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIGNyZWF0ZVNpZ25hbCh2YWx1ZSwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyA/IE9iamVjdC5hc3NpZ24oe30sIHNpZ25hbE9wdGlvbnMsIG9wdGlvbnMpIDogc2lnbmFsT3B0aW9ucztcbiAgY29uc3QgcyA9IHtcbiAgICB2YWx1ZSxcbiAgICBvYnNlcnZlcnM6IG51bGwsXG4gICAgb2JzZXJ2ZXJTbG90czogbnVsbCxcbiAgICBjb21wYXJhdG9yOiBvcHRpb25zLmVxdWFscyB8fCB1bmRlZmluZWRcbiAgfTtcbiAge1xuICAgIGlmIChvcHRpb25zLm5hbWUpIHMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICBpZiAob3B0aW9ucy5pbnRlcm5hbCkge1xuICAgICAgcy5pbnRlcm5hbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZ2lzdGVyR3JhcGgocyk7XG4gICAgICBpZiAoRGV2SG9va3MuYWZ0ZXJDcmVhdGVTaWduYWwpIERldkhvb2tzLmFmdGVyQ3JlYXRlU2lnbmFsKHMpO1xuICAgIH1cbiAgfVxuICBjb25zdCBzZXR0ZXIgPSB2YWx1ZSA9PiB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhzKSkgdmFsdWUgPSB2YWx1ZShzLnRWYWx1ZSk7ZWxzZSB2YWx1ZSA9IHZhbHVlKHMudmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gd3JpdGVTaWduYWwocywgdmFsdWUpO1xuICB9O1xuICByZXR1cm4gW3JlYWRTaWduYWwuYmluZChzKSwgc2V0dGVyXTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbXB1dGVkKGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCB0cnVlLCBTVEFMRSwgb3B0aW9ucyApO1xuICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBVcGRhdGVzLnB1c2goYyk7ZWxzZSB1cGRhdGVDb21wdXRhdGlvbihjKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlbmRlckVmZmVjdChmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgZmFsc2UsIFNUQUxFLCBvcHRpb25zICk7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIFVwZGF0ZXMucHVzaChjKTtlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlRWZmZWN0KGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBydW5FZmZlY3RzID0gcnVuVXNlckVmZmVjdHM7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIGZhbHNlLCBTVEFMRSwgb3B0aW9ucyApLFxuICAgIHMgPSBTdXNwZW5zZUNvbnRleHQgJiYgdXNlQ29udGV4dChTdXNwZW5zZUNvbnRleHQpO1xuICBpZiAocykgYy5zdXNwZW5zZSA9IHM7XG4gIGlmICghb3B0aW9ucyB8fCAhb3B0aW9ucy5yZW5kZXIpIGMudXNlciA9IHRydWU7XG4gIEVmZmVjdHMgPyBFZmZlY3RzLnB1c2goYykgOiB1cGRhdGVDb21wdXRhdGlvbihjKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlYWN0aW9uKG9uSW52YWxpZGF0ZSwgb3B0aW9ucykge1xuICBsZXQgZm47XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB7XG4gICAgICBmbiA/IGZuKCkgOiB1bnRyYWNrKG9uSW52YWxpZGF0ZSk7XG4gICAgICBmbiA9IHVuZGVmaW5lZDtcbiAgICB9LCB1bmRlZmluZWQsIGZhbHNlLCAwLCBvcHRpb25zICksXG4gICAgcyA9IFN1c3BlbnNlQ29udGV4dCAmJiB1c2VDb250ZXh0KFN1c3BlbnNlQ29udGV4dCk7XG4gIGlmIChzKSBjLnN1c3BlbnNlID0gcztcbiAgYy51c2VyID0gdHJ1ZTtcbiAgcmV0dXJuIHRyYWNraW5nID0+IHtcbiAgICBmbiA9IHRyYWNraW5nO1xuICAgIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICB9O1xufVxuZnVuY3Rpb24gY3JlYXRlTWVtbyhmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgPyBPYmplY3QuYXNzaWduKHt9LCBzaWduYWxPcHRpb25zLCBvcHRpb25zKSA6IHNpZ25hbE9wdGlvbnM7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIHRydWUsIDAsIG9wdGlvbnMgKTtcbiAgYy5vYnNlcnZlcnMgPSBudWxsO1xuICBjLm9ic2VydmVyU2xvdHMgPSBudWxsO1xuICBjLmNvbXBhcmF0b3IgPSBvcHRpb25zLmVxdWFscyB8fCB1bmRlZmluZWQ7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICBjLnRTdGF0ZSA9IFNUQUxFO1xuICAgIFVwZGF0ZXMucHVzaChjKTtcbiAgfSBlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICByZXR1cm4gcmVhZFNpZ25hbC5iaW5kKGMpO1xufVxuZnVuY3Rpb24gaXNQcm9taXNlKHYpIHtcbiAgcmV0dXJuIHYgJiYgdHlwZW9mIHYgPT09IFwib2JqZWN0XCIgJiYgXCJ0aGVuXCIgaW4gdjtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlc291cmNlKHBTb3VyY2UsIHBGZXRjaGVyLCBwT3B0aW9ucykge1xuICBsZXQgc291cmNlO1xuICBsZXQgZmV0Y2hlcjtcbiAgbGV0IG9wdGlvbnM7XG4gIGlmICh0eXBlb2YgcEZldGNoZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIHNvdXJjZSA9IHBTb3VyY2U7XG4gICAgZmV0Y2hlciA9IHBGZXRjaGVyO1xuICAgIG9wdGlvbnMgPSBwT3B0aW9ucyB8fCB7fTtcbiAgfSBlbHNlIHtcbiAgICBzb3VyY2UgPSB0cnVlO1xuICAgIGZldGNoZXIgPSBwU291cmNlO1xuICAgIG9wdGlvbnMgPSBwRmV0Y2hlciB8fCB7fTtcbiAgfVxuICBsZXQgcHIgPSBudWxsLFxuICAgIGluaXRQID0gTk9fSU5JVCxcbiAgICBpZCA9IG51bGwsXG4gICAgbG9hZGVkVW5kZXJUcmFuc2l0aW9uID0gZmFsc2UsXG4gICAgc2NoZWR1bGVkID0gZmFsc2UsXG4gICAgcmVzb2x2ZWQgPSBcImluaXRpYWxWYWx1ZVwiIGluIG9wdGlvbnMsXG4gICAgZHluYW1pYyA9IHR5cGVvZiBzb3VyY2UgPT09IFwiZnVuY3Rpb25cIiAmJiBjcmVhdGVNZW1vKHNvdXJjZSk7XG4gIGNvbnN0IGNvbnRleHRzID0gbmV3IFNldCgpLFxuICAgIFt2YWx1ZSwgc2V0VmFsdWVdID0gKG9wdGlvbnMuc3RvcmFnZSB8fCBjcmVhdGVTaWduYWwpKG9wdGlvbnMuaW5pdGlhbFZhbHVlKSxcbiAgICBbZXJyb3IsIHNldEVycm9yXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQpLFxuICAgIFt0cmFjaywgdHJpZ2dlcl0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICBlcXVhbHM6IGZhbHNlXG4gICAgfSksXG4gICAgW3N0YXRlLCBzZXRTdGF0ZV0gPSBjcmVhdGVTaWduYWwocmVzb2x2ZWQgPyBcInJlYWR5XCIgOiBcInVucmVzb2x2ZWRcIik7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCkge1xuICAgIGlkID0gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKTtcbiAgICBpZiAob3B0aW9ucy5zc3JMb2FkRnJvbSA9PT0gXCJpbml0aWFsXCIpIGluaXRQID0gb3B0aW9ucy5pbml0aWFsVmFsdWU7ZWxzZSBpZiAoc2hhcmVkQ29uZmlnLmxvYWQgJiYgc2hhcmVkQ29uZmlnLmhhcyhpZCkpIGluaXRQID0gc2hhcmVkQ29uZmlnLmxvYWQoaWQpO1xuICB9XG4gIGZ1bmN0aW9uIGxvYWRFbmQocCwgdiwgZXJyb3IsIGtleSkge1xuICAgIGlmIChwciA9PT0gcCkge1xuICAgICAgcHIgPSBudWxsO1xuICAgICAga2V5ICE9PSB1bmRlZmluZWQgJiYgKHJlc29sdmVkID0gdHJ1ZSk7XG4gICAgICBpZiAoKHAgPT09IGluaXRQIHx8IHYgPT09IGluaXRQKSAmJiBvcHRpb25zLm9uSHlkcmF0ZWQpIHF1ZXVlTWljcm90YXNrKCgpID0+IG9wdGlvbnMub25IeWRyYXRlZChrZXksIHtcbiAgICAgICAgdmFsdWU6IHZcbiAgICAgIH0pKTtcbiAgICAgIGluaXRQID0gTk9fSU5JVDtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIHAgJiYgbG9hZGVkVW5kZXJUcmFuc2l0aW9uKSB7XG4gICAgICAgIFRyYW5zaXRpb24ucHJvbWlzZXMuZGVsZXRlKHApO1xuICAgICAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBmYWxzZTtcbiAgICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICBjb21wbGV0ZUxvYWQodiwgZXJyb3IpO1xuICAgICAgICB9LCBmYWxzZSk7XG4gICAgICB9IGVsc2UgY29tcGxldGVMb2FkKHYsIGVycm9yKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cbiAgZnVuY3Rpb24gY29tcGxldGVMb2FkKHYsIGVycikge1xuICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgaWYgKGVyciA9PT0gdW5kZWZpbmVkKSBzZXRWYWx1ZSgoKSA9PiB2KTtcbiAgICAgIHNldFN0YXRlKGVyciAhPT0gdW5kZWZpbmVkID8gXCJlcnJvcmVkXCIgOiByZXNvbHZlZCA/IFwicmVhZHlcIiA6IFwidW5yZXNvbHZlZFwiKTtcbiAgICAgIHNldEVycm9yKGVycik7XG4gICAgICBmb3IgKGNvbnN0IGMgb2YgY29udGV4dHMua2V5cygpKSBjLmRlY3JlbWVudCgpO1xuICAgICAgY29udGV4dHMuY2xlYXIoKTtcbiAgICB9LCBmYWxzZSk7XG4gIH1cbiAgZnVuY3Rpb24gcmVhZCgpIHtcbiAgICBjb25zdCBjID0gU3VzcGVuc2VDb250ZXh0ICYmIHVzZUNvbnRleHQoU3VzcGVuc2VDb250ZXh0KSxcbiAgICAgIHYgPSB2YWx1ZSgpLFxuICAgICAgZXJyID0gZXJyb3IoKTtcbiAgICBpZiAoZXJyICE9PSB1bmRlZmluZWQgJiYgIXByKSB0aHJvdyBlcnI7XG4gICAgaWYgKExpc3RlbmVyICYmICFMaXN0ZW5lci51c2VyICYmIGMpIHtcbiAgICAgIGNyZWF0ZUNvbXB1dGVkKCgpID0+IHtcbiAgICAgICAgdHJhY2soKTtcbiAgICAgICAgaWYgKHByKSB7XG4gICAgICAgICAgaWYgKGMucmVzb2x2ZWQgJiYgVHJhbnNpdGlvbiAmJiBsb2FkZWRVbmRlclRyYW5zaXRpb24pIFRyYW5zaXRpb24ucHJvbWlzZXMuYWRkKHByKTtlbHNlIGlmICghY29udGV4dHMuaGFzKGMpKSB7XG4gICAgICAgICAgICBjLmluY3JlbWVudCgpO1xuICAgICAgICAgICAgY29udGV4dHMuYWRkKGMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG4gIGZ1bmN0aW9uIGxvYWQocmVmZXRjaGluZyA9IHRydWUpIHtcbiAgICBpZiAocmVmZXRjaGluZyAhPT0gZmFsc2UgJiYgc2NoZWR1bGVkKSByZXR1cm47XG4gICAgc2NoZWR1bGVkID0gZmFsc2U7XG4gICAgY29uc3QgbG9va3VwID0gZHluYW1pYyA/IGR5bmFtaWMoKSA6IHNvdXJjZTtcbiAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgICBpZiAobG9va3VwID09IG51bGwgfHwgbG9va3VwID09PSBmYWxzZSkge1xuICAgICAgbG9hZEVuZChwciwgdW50cmFjayh2YWx1ZSkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoVHJhbnNpdGlvbiAmJiBwcikgVHJhbnNpdGlvbi5wcm9taXNlcy5kZWxldGUocHIpO1xuICAgIGxldCBlcnJvcjtcbiAgICBjb25zdCBwID0gaW5pdFAgIT09IE5PX0lOSVQgPyBpbml0UCA6IHVudHJhY2soKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIGZldGNoZXIobG9va3VwLCB7XG4gICAgICAgICAgdmFsdWU6IHZhbHVlKCksXG4gICAgICAgICAgcmVmZXRjaGluZ1xuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2ggKGZldGNoZXJFcnJvcikge1xuICAgICAgICBlcnJvciA9IGZldGNoZXJFcnJvcjtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoZXJyb3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbG9hZEVuZChwciwgdW5kZWZpbmVkLCBjYXN0RXJyb3IoZXJyb3IpLCBsb29rdXApO1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoIWlzUHJvbWlzZShwKSkge1xuICAgICAgbG9hZEVuZChwciwgcCwgdW5kZWZpbmVkLCBsb29rdXApO1xuICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIHByID0gcDtcbiAgICBpZiAoXCJ2XCIgaW4gcCkge1xuICAgICAgaWYgKHAucyA9PT0gMSkgbG9hZEVuZChwciwgcC52LCB1bmRlZmluZWQsIGxvb2t1cCk7ZWxzZSBsb2FkRW5kKHByLCB1bmRlZmluZWQsIGNhc3RFcnJvcihwLnYpLCBsb29rdXApO1xuICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIHNjaGVkdWxlZCA9IHRydWU7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4gc2NoZWR1bGVkID0gZmFsc2UpO1xuICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgc2V0U3RhdGUocmVzb2x2ZWQgPyBcInJlZnJlc2hpbmdcIiA6IFwicGVuZGluZ1wiKTtcbiAgICAgIHRyaWdnZXIoKTtcbiAgICB9LCBmYWxzZSk7XG4gICAgcmV0dXJuIHAudGhlbih2ID0+IGxvYWRFbmQocCwgdiwgdW5kZWZpbmVkLCBsb29rdXApLCBlID0+IGxvYWRFbmQocCwgdW5kZWZpbmVkLCBjYXN0RXJyb3IoZSksIGxvb2t1cCkpO1xuICB9XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHJlYWQsIHtcbiAgICBzdGF0ZToge1xuICAgICAgZ2V0OiAoKSA9PiBzdGF0ZSgpXG4gICAgfSxcbiAgICBlcnJvcjoge1xuICAgICAgZ2V0OiAoKSA9PiBlcnJvcigpXG4gICAgfSxcbiAgICBsb2FkaW5nOiB7XG4gICAgICBnZXQoKSB7XG4gICAgICAgIGNvbnN0IHMgPSBzdGF0ZSgpO1xuICAgICAgICByZXR1cm4gcyA9PT0gXCJwZW5kaW5nXCIgfHwgcyA9PT0gXCJyZWZyZXNoaW5nXCI7XG4gICAgICB9XG4gICAgfSxcbiAgICBsYXRlc3Q6IHtcbiAgICAgIGdldCgpIHtcbiAgICAgICAgaWYgKCFyZXNvbHZlZCkgcmV0dXJuIHJlYWQoKTtcbiAgICAgICAgY29uc3QgZXJyID0gZXJyb3IoKTtcbiAgICAgICAgaWYgKGVyciAmJiAhcHIpIHRocm93IGVycjtcbiAgICAgICAgcmV0dXJuIHZhbHVlKCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbiAgbGV0IG93bmVyID0gT3duZXI7XG4gIGlmIChkeW5hbWljKSBjcmVhdGVDb21wdXRlZCgoKSA9PiAob3duZXIgPSBPd25lciwgbG9hZChmYWxzZSkpKTtlbHNlIGxvYWQoZmFsc2UpO1xuICByZXR1cm4gW3JlYWQsIHtcbiAgICByZWZldGNoOiBpbmZvID0+IHJ1bldpdGhPd25lcihvd25lciwgKCkgPT4gbG9hZChpbmZvKSksXG4gICAgbXV0YXRlOiBzZXRWYWx1ZVxuICB9XTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZURlZmVycmVkKHNvdXJjZSwgb3B0aW9ucykge1xuICBsZXQgdCxcbiAgICB0aW1lb3V0ID0gb3B0aW9ucyA/IG9wdGlvbnMudGltZW91dE1zIDogdW5kZWZpbmVkO1xuICBjb25zdCBub2RlID0gY3JlYXRlQ29tcHV0YXRpb24oKCkgPT4ge1xuICAgIGlmICghdCB8fCAhdC5mbikgdCA9IHJlcXVlc3RDYWxsYmFjaygoKSA9PiBzZXREZWZlcnJlZCgoKSA9PiBub2RlLnZhbHVlKSwgdGltZW91dCAhPT0gdW5kZWZpbmVkID8ge1xuICAgICAgdGltZW91dFxuICAgIH0gOiB1bmRlZmluZWQpO1xuICAgIHJldHVybiBzb3VyY2UoKTtcbiAgfSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgY29uc3QgW2RlZmVycmVkLCBzZXREZWZlcnJlZF0gPSBjcmVhdGVTaWduYWwoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSwgb3B0aW9ucyk7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICBzZXREZWZlcnJlZCgoKSA9PiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlKTtcbiAgcmV0dXJuIGRlZmVycmVkO1xufVxuZnVuY3Rpb24gY3JlYXRlU2VsZWN0b3Ioc291cmNlLCBmbiA9IGVxdWFsRm4sIG9wdGlvbnMpIHtcbiAgY29uc3Qgc3VicyA9IG5ldyBNYXAoKTtcbiAgY29uc3Qgbm9kZSA9IGNyZWF0ZUNvbXB1dGF0aW9uKHAgPT4ge1xuICAgIGNvbnN0IHYgPSBzb3VyY2UoKTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2Ygc3Vicy5lbnRyaWVzKCkpIGlmIChmbihrZXksIHYpICE9PSBmbihrZXksIHApKSB7XG4gICAgICBmb3IgKGNvbnN0IGMgb2YgdmFsLnZhbHVlcygpKSB7XG4gICAgICAgIGMuc3RhdGUgPSBTVEFMRTtcbiAgICAgICAgaWYgKGMucHVyZSkgVXBkYXRlcy5wdXNoKGMpO2Vsc2UgRWZmZWN0cy5wdXNoKGMpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfSwgdW5kZWZpbmVkLCB0cnVlLCBTVEFMRSwgb3B0aW9ucyApO1xuICB1cGRhdGVDb21wdXRhdGlvbihub2RlKTtcbiAgcmV0dXJuIGtleSA9PiB7XG4gICAgY29uc3QgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgICBpZiAobGlzdGVuZXIpIHtcbiAgICAgIGxldCBsO1xuICAgICAgaWYgKGwgPSBzdWJzLmdldChrZXkpKSBsLmFkZChsaXN0ZW5lcik7ZWxzZSBzdWJzLnNldChrZXksIGwgPSBuZXcgU2V0KFtsaXN0ZW5lcl0pKTtcbiAgICAgIG9uQ2xlYW51cCgoKSA9PiB7XG4gICAgICAgIGwuZGVsZXRlKGxpc3RlbmVyKTtcbiAgICAgICAgIWwuc2l6ZSAmJiBzdWJzLmRlbGV0ZShrZXkpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBmbihrZXksIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUpO1xuICB9O1xufVxuZnVuY3Rpb24gYmF0Y2goZm4pIHtcbiAgcmV0dXJuIHJ1blVwZGF0ZXMoZm4sIGZhbHNlKTtcbn1cbmZ1bmN0aW9uIHVudHJhY2soZm4pIHtcbiAgaWYgKCFFeHRlcm5hbFNvdXJjZUNvbmZpZyAmJiBMaXN0ZW5lciA9PT0gbnVsbCkgcmV0dXJuIGZuKCk7XG4gIGNvbnN0IGxpc3RlbmVyID0gTGlzdGVuZXI7XG4gIExpc3RlbmVyID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcpIHJldHVybiBFeHRlcm5hbFNvdXJjZUNvbmZpZy51bnRyYWNrKGZuKTtcbiAgICByZXR1cm4gZm4oKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICB9XG59XG5mdW5jdGlvbiBvbihkZXBzLCBmbiwgb3B0aW9ucykge1xuICBjb25zdCBpc0FycmF5ID0gQXJyYXkuaXNBcnJheShkZXBzKTtcbiAgbGV0IHByZXZJbnB1dDtcbiAgbGV0IGRlZmVyID0gb3B0aW9ucyAmJiBvcHRpb25zLmRlZmVyO1xuICByZXR1cm4gcHJldlZhbHVlID0+IHtcbiAgICBsZXQgaW5wdXQ7XG4gICAgaWYgKGlzQXJyYXkpIHtcbiAgICAgIGlucHV0ID0gQXJyYXkoZGVwcy5sZW5ndGgpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZXBzLmxlbmd0aDsgaSsrKSBpbnB1dFtpXSA9IGRlcHNbaV0oKTtcbiAgICB9IGVsc2UgaW5wdXQgPSBkZXBzKCk7XG4gICAgaWYgKGRlZmVyKSB7XG4gICAgICBkZWZlciA9IGZhbHNlO1xuICAgICAgcmV0dXJuIHByZXZWYWx1ZTtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gdW50cmFjaygoKSA9PiBmbihpbnB1dCwgcHJldklucHV0LCBwcmV2VmFsdWUpKTtcbiAgICBwcmV2SW5wdXQgPSBpbnB1dDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xufVxuZnVuY3Rpb24gb25Nb3VudChmbikge1xuICBjcmVhdGVFZmZlY3QoKCkgPT4gdW50cmFjayhmbikpO1xufVxuZnVuY3Rpb24gb25DbGVhbnVwKGZuKSB7XG4gIGlmIChPd25lciA9PT0gbnVsbCkgY29uc29sZS53YXJuKFwiY2xlYW51cHMgY3JlYXRlZCBvdXRzaWRlIGEgYGNyZWF0ZVJvb3RgIG9yIGByZW5kZXJgIHdpbGwgbmV2ZXIgYmUgcnVuXCIpO2Vsc2UgaWYgKE93bmVyLmNsZWFudXBzID09PSBudWxsKSBPd25lci5jbGVhbnVwcyA9IFtmbl07ZWxzZSBPd25lci5jbGVhbnVwcy5wdXNoKGZuKTtcbiAgcmV0dXJuIGZuO1xufVxuZnVuY3Rpb24gY2F0Y2hFcnJvcihmbiwgaGFuZGxlcikge1xuICBFUlJPUiB8fCAoRVJST1IgPSBTeW1ib2woXCJlcnJvclwiKSk7XG4gIE93bmVyID0gY3JlYXRlQ29tcHV0YXRpb24odW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuICBPd25lci5jb250ZXh0ID0ge1xuICAgIC4uLk93bmVyLmNvbnRleHQsXG4gICAgW0VSUk9SXTogW2hhbmRsZXJdXG4gIH07XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgVHJhbnNpdGlvbi5zb3VyY2VzLmFkZChPd25lcik7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGZuKCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGhhbmRsZUVycm9yKGVycik7XG4gIH0gZmluYWxseSB7XG4gICAgT3duZXIgPSBPd25lci5vd25lcjtcbiAgfVxufVxuZnVuY3Rpb24gZ2V0TGlzdGVuZXIoKSB7XG4gIHJldHVybiBMaXN0ZW5lcjtcbn1cbmZ1bmN0aW9uIGdldE93bmVyKCkge1xuICByZXR1cm4gT3duZXI7XG59XG5mdW5jdGlvbiBydW5XaXRoT3duZXIobywgZm4pIHtcbiAgY29uc3QgcHJldiA9IE93bmVyO1xuICBjb25zdCBwcmV2TGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgT3duZXIgPSBvO1xuICBMaXN0ZW5lciA9IG51bGw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJ1blVwZGF0ZXMoZm4sIHRydWUpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBoYW5kbGVFcnJvcihlcnIpO1xuICB9IGZpbmFsbHkge1xuICAgIE93bmVyID0gcHJldjtcbiAgICBMaXN0ZW5lciA9IHByZXZMaXN0ZW5lcjtcbiAgfVxufVxuZnVuY3Rpb24gZW5hYmxlU2NoZWR1bGluZyhzY2hlZHVsZXIgPSByZXF1ZXN0Q2FsbGJhY2spIHtcbiAgU2NoZWR1bGVyID0gc2NoZWR1bGVyO1xufVxuZnVuY3Rpb24gc3RhcnRUcmFuc2l0aW9uKGZuKSB7XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGZuKCk7XG4gICAgcmV0dXJuIFRyYW5zaXRpb24uZG9uZTtcbiAgfVxuICBjb25zdCBsID0gTGlzdGVuZXI7XG4gIGNvbnN0IG8gPSBPd25lcjtcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oKCkgPT4ge1xuICAgIExpc3RlbmVyID0gbDtcbiAgICBPd25lciA9IG87XG4gICAgbGV0IHQ7XG4gICAgaWYgKFNjaGVkdWxlciB8fCBTdXNwZW5zZUNvbnRleHQpIHtcbiAgICAgIHQgPSBUcmFuc2l0aW9uIHx8IChUcmFuc2l0aW9uID0ge1xuICAgICAgICBzb3VyY2VzOiBuZXcgU2V0KCksXG4gICAgICAgIGVmZmVjdHM6IFtdLFxuICAgICAgICBwcm9taXNlczogbmV3IFNldCgpLFxuICAgICAgICBkaXNwb3NlZDogbmV3IFNldCgpLFxuICAgICAgICBxdWV1ZTogbmV3IFNldCgpLFxuICAgICAgICBydW5uaW5nOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIHQuZG9uZSB8fCAodC5kb25lID0gbmV3IFByb21pc2UocmVzID0+IHQucmVzb2x2ZSA9IHJlcykpO1xuICAgICAgdC5ydW5uaW5nID0gdHJ1ZTtcbiAgICB9XG4gICAgcnVuVXBkYXRlcyhmbiwgZmFsc2UpO1xuICAgIExpc3RlbmVyID0gT3duZXIgPSBudWxsO1xuICAgIHJldHVybiB0ID8gdC5kb25lIDogdW5kZWZpbmVkO1xuICB9KTtcbn1cbmNvbnN0IFt0cmFuc1BlbmRpbmcsIHNldFRyYW5zUGVuZGluZ10gPSAvKkBfX1BVUkVfXyovY3JlYXRlU2lnbmFsKGZhbHNlKTtcbmZ1bmN0aW9uIHVzZVRyYW5zaXRpb24oKSB7XG4gIHJldHVybiBbdHJhbnNQZW5kaW5nLCBzdGFydFRyYW5zaXRpb25dO1xufVxuZnVuY3Rpb24gcmVzdW1lRWZmZWN0cyhlKSB7XG4gIEVmZmVjdHMucHVzaC5hcHBseShFZmZlY3RzLCBlKTtcbiAgZS5sZW5ndGggPSAwO1xufVxuZnVuY3Rpb24gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzKSB7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB1bnRyYWNrKCgpID0+IHtcbiAgICBPYmplY3QuYXNzaWduKENvbXAsIHtcbiAgICAgIFskREVWQ09NUF06IHRydWVcbiAgICB9KTtcbiAgICByZXR1cm4gQ29tcChwcm9wcyk7XG4gIH0pLCB1bmRlZmluZWQsIHRydWUsIDApO1xuICBjLnByb3BzID0gcHJvcHM7XG4gIGMub2JzZXJ2ZXJzID0gbnVsbDtcbiAgYy5vYnNlcnZlclNsb3RzID0gbnVsbDtcbiAgYy5uYW1lID0gQ29tcC5uYW1lO1xuICBjLmNvbXBvbmVudCA9IENvbXA7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICByZXR1cm4gYy50VmFsdWUgIT09IHVuZGVmaW5lZCA/IGMudFZhbHVlIDogYy52YWx1ZTtcbn1cbmZ1bmN0aW9uIHJlZ2lzdGVyR3JhcGgodmFsdWUpIHtcbiAgaWYgKE93bmVyKSB7XG4gICAgaWYgKE93bmVyLnNvdXJjZU1hcCkgT3duZXIuc291cmNlTWFwLnB1c2godmFsdWUpO2Vsc2UgT3duZXIuc291cmNlTWFwID0gW3ZhbHVlXTtcbiAgICB2YWx1ZS5ncmFwaCA9IE93bmVyO1xuICB9XG4gIGlmIChEZXZIb29rcy5hZnRlclJlZ2lzdGVyR3JhcGgpIERldkhvb2tzLmFmdGVyUmVnaXN0ZXJHcmFwaCh2YWx1ZSk7XG59XG5mdW5jdGlvbiBjcmVhdGVDb250ZXh0KGRlZmF1bHRWYWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBpZCA9IFN5bWJvbChcImNvbnRleHRcIik7XG4gIHJldHVybiB7XG4gICAgaWQsXG4gICAgUHJvdmlkZXI6IGNyZWF0ZVByb3ZpZGVyKGlkLCBvcHRpb25zKSxcbiAgICBkZWZhdWx0VmFsdWVcbiAgfTtcbn1cbmZ1bmN0aW9uIHVzZUNvbnRleHQoY29udGV4dCkge1xuICBsZXQgdmFsdWU7XG4gIHJldHVybiBPd25lciAmJiBPd25lci5jb250ZXh0ICYmICh2YWx1ZSA9IE93bmVyLmNvbnRleHRbY29udGV4dC5pZF0pICE9PSB1bmRlZmluZWQgPyB2YWx1ZSA6IGNvbnRleHQuZGVmYXVsdFZhbHVlO1xufVxuZnVuY3Rpb24gY2hpbGRyZW4oZm4pIHtcbiAgY29uc3QgY2hpbGRyZW4gPSBjcmVhdGVNZW1vKGZuKTtcbiAgY29uc3QgbWVtbyA9IGNyZWF0ZU1lbW8oKCkgPT4gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKCkpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImNoaWxkcmVuXCJcbiAgfSkgO1xuICBtZW1vLnRvQXJyYXkgPSAoKSA9PiB7XG4gICAgY29uc3QgYyA9IG1lbW8oKTtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShjKSA/IGMgOiBjICE9IG51bGwgPyBbY10gOiBbXTtcbiAgfTtcbiAgcmV0dXJuIG1lbW87XG59XG5sZXQgU3VzcGVuc2VDb250ZXh0O1xuZnVuY3Rpb24gZ2V0U3VzcGVuc2VDb250ZXh0KCkge1xuICByZXR1cm4gU3VzcGVuc2VDb250ZXh0IHx8IChTdXNwZW5zZUNvbnRleHQgPSBjcmVhdGVDb250ZXh0KCkpO1xufVxuZnVuY3Rpb24gZW5hYmxlRXh0ZXJuYWxTb3VyY2UoZmFjdG9yeSwgdW50cmFjayA9IGZuID0+IGZuKCkpIHtcbiAgaWYgKEV4dGVybmFsU291cmNlQ29uZmlnKSB7XG4gICAgY29uc3Qge1xuICAgICAgZmFjdG9yeTogb2xkRmFjdG9yeSxcbiAgICAgIHVudHJhY2s6IG9sZFVudHJhY2tcbiAgICB9ID0gRXh0ZXJuYWxTb3VyY2VDb25maWc7XG4gICAgRXh0ZXJuYWxTb3VyY2VDb25maWcgPSB7XG4gICAgICBmYWN0b3J5OiAoZm4sIHRyaWdnZXIpID0+IHtcbiAgICAgICAgY29uc3Qgb2xkU291cmNlID0gb2xkRmFjdG9yeShmbiwgdHJpZ2dlcik7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IGZhY3RvcnkoeCA9PiBvbGRTb3VyY2UudHJhY2soeCksIHRyaWdnZXIpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHRyYWNrOiB4ID0+IHNvdXJjZS50cmFjayh4KSxcbiAgICAgICAgICBkaXNwb3NlKCkge1xuICAgICAgICAgICAgc291cmNlLmRpc3Bvc2UoKTtcbiAgICAgICAgICAgIG9sZFNvdXJjZS5kaXNwb3NlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIHVudHJhY2s6IGZuID0+IG9sZFVudHJhY2soKCkgPT4gdW50cmFjayhmbikpXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IHtcbiAgICAgIGZhY3RvcnksXG4gICAgICB1bnRyYWNrXG4gICAgfTtcbiAgfVxufVxuZnVuY3Rpb24gcmVhZFNpZ25hbCgpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgaWYgKHRoaXMuc291cmNlcyAmJiAocnVubmluZ1RyYW5zaXRpb24gPyB0aGlzLnRTdGF0ZSA6IHRoaXMuc3RhdGUpKSB7XG4gICAgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IHRoaXMudFN0YXRlIDogdGhpcy5zdGF0ZSkgPT09IFNUQUxFKSB1cGRhdGVDb21wdXRhdGlvbih0aGlzKTtlbHNlIHtcbiAgICAgIGNvbnN0IHVwZGF0ZXMgPSBVcGRhdGVzO1xuICAgICAgVXBkYXRlcyA9IG51bGw7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IGxvb2tVcHN0cmVhbSh0aGlzKSwgZmFsc2UpO1xuICAgICAgVXBkYXRlcyA9IHVwZGF0ZXM7XG4gICAgfVxuICB9XG4gIGlmIChMaXN0ZW5lcikge1xuICAgIGNvbnN0IHNTbG90ID0gdGhpcy5vYnNlcnZlcnMgPyB0aGlzLm9ic2VydmVycy5sZW5ndGggOiAwO1xuICAgIGlmICghTGlzdGVuZXIuc291cmNlcykge1xuICAgICAgTGlzdGVuZXIuc291cmNlcyA9IFt0aGlzXTtcbiAgICAgIExpc3RlbmVyLnNvdXJjZVNsb3RzID0gW3NTbG90XTtcbiAgICB9IGVsc2Uge1xuICAgICAgTGlzdGVuZXIuc291cmNlcy5wdXNoKHRoaXMpO1xuICAgICAgTGlzdGVuZXIuc291cmNlU2xvdHMucHVzaChzU2xvdCk7XG4gICAgfVxuICAgIGlmICghdGhpcy5vYnNlcnZlcnMpIHtcbiAgICAgIHRoaXMub2JzZXJ2ZXJzID0gW0xpc3RlbmVyXTtcbiAgICAgIHRoaXMub2JzZXJ2ZXJTbG90cyA9IFtMaXN0ZW5lci5zb3VyY2VzLmxlbmd0aCAtIDFdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9ic2VydmVycy5wdXNoKExpc3RlbmVyKTtcbiAgICAgIHRoaXMub2JzZXJ2ZXJTbG90cy5wdXNoKExpc3RlbmVyLnNvdXJjZXMubGVuZ3RoIC0gMSk7XG4gICAgfVxuICB9XG4gIGlmIChydW5uaW5nVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKHRoaXMpKSByZXR1cm4gdGhpcy50VmFsdWU7XG4gIHJldHVybiB0aGlzLnZhbHVlO1xufVxuZnVuY3Rpb24gd3JpdGVTaWduYWwobm9kZSwgdmFsdWUsIGlzQ29tcCkge1xuICBsZXQgY3VycmVudCA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWU7XG4gIGlmICghbm9kZS5jb21wYXJhdG9yIHx8ICFub2RlLmNvbXBhcmF0b3IoY3VycmVudCwgdmFsdWUpKSB7XG4gICAgaWYgKFRyYW5zaXRpb24pIHtcbiAgICAgIGNvbnN0IFRyYW5zaXRpb25SdW5uaW5nID0gVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgICAgaWYgKFRyYW5zaXRpb25SdW5uaW5nIHx8ICFpc0NvbXAgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSkge1xuICAgICAgICBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKG5vZGUpO1xuICAgICAgICBub2RlLnRWYWx1ZSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgaWYgKCFUcmFuc2l0aW9uUnVubmluZykgbm9kZS52YWx1ZSA9IHZhbHVlO1xuICAgIH0gZWxzZSBub2RlLnZhbHVlID0gdmFsdWU7XG4gICAgaWYgKG5vZGUub2JzZXJ2ZXJzICYmIG5vZGUub2JzZXJ2ZXJzLmxlbmd0aCkge1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vYnNlcnZlcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICBjb25zdCBvID0gbm9kZS5vYnNlcnZlcnNbaV07XG4gICAgICAgICAgY29uc3QgVHJhbnNpdGlvblJ1bm5pbmcgPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgICAgICAgICBpZiAoVHJhbnNpdGlvblJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXMobykpIGNvbnRpbnVlO1xuICAgICAgICAgIGlmIChUcmFuc2l0aW9uUnVubmluZyA/ICFvLnRTdGF0ZSA6ICFvLnN0YXRlKSB7XG4gICAgICAgICAgICBpZiAoby5wdXJlKSBVcGRhdGVzLnB1c2gobyk7ZWxzZSBFZmZlY3RzLnB1c2gobyk7XG4gICAgICAgICAgICBpZiAoby5vYnNlcnZlcnMpIG1hcmtEb3duc3RyZWFtKG8pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIVRyYW5zaXRpb25SdW5uaW5nKSBvLnN0YXRlID0gU1RBTEU7ZWxzZSBvLnRTdGF0ZSA9IFNUQUxFO1xuICAgICAgICB9XG4gICAgICAgIGlmIChVcGRhdGVzLmxlbmd0aCA+IDEwZTUpIHtcbiAgICAgICAgICBVcGRhdGVzID0gW107XG4gICAgICAgICAgaWYgKElTX0RFVikgdGhyb3cgbmV3IEVycm9yKFwiUG90ZW50aWFsIEluZmluaXRlIExvb3AgRGV0ZWN0ZWQuXCIpO1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuICAgICAgICB9XG4gICAgICB9LCBmYWxzZSk7XG4gICAgfVxuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpIHtcbiAgaWYgKCFub2RlLmZuKSByZXR1cm47XG4gIGNsZWFuTm9kZShub2RlKTtcbiAgY29uc3QgdGltZSA9IEV4ZWNDb3VudDtcbiAgcnVuQ29tcHV0YXRpb24obm9kZSwgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSwgdGltZSk7XG4gIGlmIChUcmFuc2l0aW9uICYmICFUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSkge1xuICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICBUcmFuc2l0aW9uICYmIChUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlKTtcbiAgICAgICAgTGlzdGVuZXIgPSBPd25lciA9IG5vZGU7XG4gICAgICAgIHJ1bkNvbXB1dGF0aW9uKG5vZGUsIG5vZGUudFZhbHVlLCB0aW1lKTtcbiAgICAgICAgTGlzdGVuZXIgPSBPd25lciA9IG51bGw7XG4gICAgICB9LCBmYWxzZSk7XG4gICAgfSk7XG4gIH1cbn1cbmZ1bmN0aW9uIHJ1bkNvbXB1dGF0aW9uKG5vZGUsIHZhbHVlLCB0aW1lKSB7XG4gIGxldCBuZXh0VmFsdWU7XG4gIGNvbnN0IG93bmVyID0gT3duZXIsXG4gICAgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgTGlzdGVuZXIgPSBPd25lciA9IG5vZGU7XG4gIHRyeSB7XG4gICAgbmV4dFZhbHVlID0gbm9kZS5mbih2YWx1ZSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmIChub2RlLnB1cmUpIHtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgICAgICBub2RlLnRTdGF0ZSA9IFNUQUxFO1xuICAgICAgICBub2RlLnRPd25lZCAmJiBub2RlLnRPd25lZC5mb3JFYWNoKGNsZWFuTm9kZSk7XG4gICAgICAgIG5vZGUudE93bmVkID0gdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9kZS5zdGF0ZSA9IFNUQUxFO1xuICAgICAgICBub2RlLm93bmVkICYmIG5vZGUub3duZWQuZm9yRWFjaChjbGVhbk5vZGUpO1xuICAgICAgICBub2RlLm93bmVkID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgbm9kZS51cGRhdGVkQXQgPSB0aW1lICsgMTtcbiAgICByZXR1cm4gaGFuZGxlRXJyb3IoZXJyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICAgIE93bmVyID0gb3duZXI7XG4gIH1cbiAgaWYgKCFub2RlLnVwZGF0ZWRBdCB8fCBub2RlLnVwZGF0ZWRBdCA8PSB0aW1lKSB7XG4gICAgaWYgKG5vZGUudXBkYXRlZEF0ICE9IG51bGwgJiYgXCJvYnNlcnZlcnNcIiBpbiBub2RlKSB7XG4gICAgICB3cml0ZVNpZ25hbChub2RlLCBuZXh0VmFsdWUsIHRydWUpO1xuICAgIH0gZWxzZSBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgbm9kZS5wdXJlKSB7XG4gICAgICBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKG5vZGUpO1xuICAgICAgbm9kZS50VmFsdWUgPSBuZXh0VmFsdWU7XG4gICAgfSBlbHNlIG5vZGUudmFsdWUgPSBuZXh0VmFsdWU7XG4gICAgbm9kZS51cGRhdGVkQXQgPSB0aW1lO1xuICB9XG59XG5mdW5jdGlvbiBjcmVhdGVDb21wdXRhdGlvbihmbiwgaW5pdCwgcHVyZSwgc3RhdGUgPSBTVEFMRSwgb3B0aW9ucykge1xuICBjb25zdCBjID0ge1xuICAgIGZuLFxuICAgIHN0YXRlOiBzdGF0ZSxcbiAgICB1cGRhdGVkQXQ6IG51bGwsXG4gICAgb3duZWQ6IG51bGwsXG4gICAgc291cmNlczogbnVsbCxcbiAgICBzb3VyY2VTbG90czogbnVsbCxcbiAgICBjbGVhbnVwczogbnVsbCxcbiAgICB2YWx1ZTogaW5pdCxcbiAgICBvd25lcjogT3duZXIsXG4gICAgY29udGV4dDogT3duZXIgPyBPd25lci5jb250ZXh0IDogbnVsbCxcbiAgICBwdXJlXG4gIH07XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGMuc3RhdGUgPSAwO1xuICAgIGMudFN0YXRlID0gc3RhdGU7XG4gIH1cbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJjb21wdXRhdGlvbnMgY3JlYXRlZCBvdXRzaWRlIGEgYGNyZWF0ZVJvb3RgIG9yIGByZW5kZXJgIHdpbGwgbmV2ZXIgYmUgZGlzcG9zZWRcIik7ZWxzZSBpZiAoT3duZXIgIT09IFVOT1dORUQpIHtcbiAgICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgT3duZXIucHVyZSkge1xuICAgICAgaWYgKCFPd25lci50T3duZWQpIE93bmVyLnRPd25lZCA9IFtjXTtlbHNlIE93bmVyLnRPd25lZC5wdXNoKGMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIU93bmVyLm93bmVkKSBPd25lci5vd25lZCA9IFtjXTtlbHNlIE93bmVyLm93bmVkLnB1c2goYyk7XG4gICAgfVxuICB9XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMubmFtZSkgYy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcgJiYgYy5mbikge1xuICAgIGNvbnN0IFt0cmFjaywgdHJpZ2dlcl0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICBlcXVhbHM6IGZhbHNlXG4gICAgfSk7XG4gICAgY29uc3Qgb3JkaW5hcnkgPSBFeHRlcm5hbFNvdXJjZUNvbmZpZy5mYWN0b3J5KGMuZm4sIHRyaWdnZXIpO1xuICAgIG9uQ2xlYW51cCgoKSA9PiBvcmRpbmFyeS5kaXNwb3NlKCkpO1xuICAgIGNvbnN0IHRyaWdnZXJJblRyYW5zaXRpb24gPSAoKSA9PiBzdGFydFRyYW5zaXRpb24odHJpZ2dlcikudGhlbigoKSA9PiBpblRyYW5zaXRpb24uZGlzcG9zZSgpKTtcbiAgICBjb25zdCBpblRyYW5zaXRpb24gPSBFeHRlcm5hbFNvdXJjZUNvbmZpZy5mYWN0b3J5KGMuZm4sIHRyaWdnZXJJblRyYW5zaXRpb24pO1xuICAgIGMuZm4gPSB4ID0+IHtcbiAgICAgIHRyYWNrKCk7XG4gICAgICByZXR1cm4gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgPyBpblRyYW5zaXRpb24udHJhY2soeCkgOiBvcmRpbmFyeS50cmFjayh4KTtcbiAgICB9O1xuICB9XG4gIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIgJiYgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lcihjKTtcbiAgcmV0dXJuIGM7XG59XG5mdW5jdGlvbiBydW5Ub3Aobm9kZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gMCkgcmV0dXJuO1xuICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gUEVORElORykgcmV0dXJuIGxvb2tVcHN0cmVhbShub2RlKTtcbiAgaWYgKG5vZGUuc3VzcGVuc2UgJiYgdW50cmFjayhub2RlLnN1c3BlbnNlLmluRmFsbGJhY2spKSByZXR1cm4gbm9kZS5zdXNwZW5zZS5lZmZlY3RzLnB1c2gobm9kZSk7XG4gIGNvbnN0IGFuY2VzdG9ycyA9IFtub2RlXTtcbiAgd2hpbGUgKChub2RlID0gbm9kZS5vd25lcikgJiYgKCFub2RlLnVwZGF0ZWRBdCB8fCBub2RlLnVwZGF0ZWRBdCA8IEV4ZWNDb3VudCkpIHtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXMobm9kZSkpIHJldHVybjtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpIGFuY2VzdG9ycy5wdXNoKG5vZGUpO1xuICB9XG4gIGZvciAobGV0IGkgPSBhbmNlc3RvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBub2RlID0gYW5jZXN0b3JzW2ldO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbikge1xuICAgICAgbGV0IHRvcCA9IG5vZGUsXG4gICAgICAgIHByZXYgPSBhbmNlc3RvcnNbaSArIDFdO1xuICAgICAgd2hpbGUgKCh0b3AgPSB0b3Aub3duZXIpICYmIHRvcCAhPT0gcHJldikge1xuICAgICAgICBpZiAoVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXModG9wKSkgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gU1RBTEUpIHtcbiAgICAgIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICAgIH0gZWxzZSBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gUEVORElORykge1xuICAgICAgY29uc3QgdXBkYXRlcyA9IFVwZGF0ZXM7XG4gICAgICBVcGRhdGVzID0gbnVsbDtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4gbG9va1Vwc3RyZWFtKG5vZGUsIGFuY2VzdG9yc1swXSksIGZhbHNlKTtcbiAgICAgIFVwZGF0ZXMgPSB1cGRhdGVzO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gcnVuVXBkYXRlcyhmbiwgaW5pdCkge1xuICBpZiAoVXBkYXRlcykgcmV0dXJuIGZuKCk7XG4gIGxldCB3YWl0ID0gZmFsc2U7XG4gIGlmICghaW5pdCkgVXBkYXRlcyA9IFtdO1xuICBpZiAoRWZmZWN0cykgd2FpdCA9IHRydWU7ZWxzZSBFZmZlY3RzID0gW107XG4gIEV4ZWNDb3VudCsrO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGZuKCk7XG4gICAgY29tcGxldGVVcGRhdGVzKHdhaXQpO1xuICAgIHJldHVybiByZXM7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmICghd2FpdCkgRWZmZWN0cyA9IG51bGw7XG4gICAgVXBkYXRlcyA9IG51bGw7XG4gICAgaGFuZGxlRXJyb3IoZXJyKTtcbiAgfVxufVxuZnVuY3Rpb24gY29tcGxldGVVcGRhdGVzKHdhaXQpIHtcbiAgaWYgKFVwZGF0ZXMpIHtcbiAgICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBzY2hlZHVsZVF1ZXVlKFVwZGF0ZXMpO2Vsc2UgcnVuUXVldWUoVXBkYXRlcyk7XG4gICAgVXBkYXRlcyA9IG51bGw7XG4gIH1cbiAgaWYgKHdhaXQpIHJldHVybjtcbiAgbGV0IHJlcztcbiAgaWYgKFRyYW5zaXRpb24pIHtcbiAgICBpZiAoIVRyYW5zaXRpb24ucHJvbWlzZXMuc2l6ZSAmJiAhVHJhbnNpdGlvbi5xdWV1ZS5zaXplKSB7XG4gICAgICBjb25zdCBzb3VyY2VzID0gVHJhbnNpdGlvbi5zb3VyY2VzO1xuICAgICAgY29uc3QgZGlzcG9zZWQgPSBUcmFuc2l0aW9uLmRpc3Bvc2VkO1xuICAgICAgRWZmZWN0cy5wdXNoLmFwcGx5KEVmZmVjdHMsIFRyYW5zaXRpb24uZWZmZWN0cyk7XG4gICAgICByZXMgPSBUcmFuc2l0aW9uLnJlc29sdmU7XG4gICAgICBmb3IgKGNvbnN0IGUgb2YgRWZmZWN0cykge1xuICAgICAgICBcInRTdGF0ZVwiIGluIGUgJiYgKGUuc3RhdGUgPSBlLnRTdGF0ZSk7XG4gICAgICAgIGRlbGV0ZSBlLnRTdGF0ZTtcbiAgICAgIH1cbiAgICAgIFRyYW5zaXRpb24gPSBudWxsO1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgZCBvZiBkaXNwb3NlZCkgY2xlYW5Ob2RlKGQpO1xuICAgICAgICBmb3IgKGNvbnN0IHYgb2Ygc291cmNlcykge1xuICAgICAgICAgIHYudmFsdWUgPSB2LnRWYWx1ZTtcbiAgICAgICAgICBpZiAodi5vd25lZCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHYub3duZWQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIGNsZWFuTm9kZSh2Lm93bmVkW2ldKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHYudE93bmVkKSB2Lm93bmVkID0gdi50T3duZWQ7XG4gICAgICAgICAgZGVsZXRlIHYudFZhbHVlO1xuICAgICAgICAgIGRlbGV0ZSB2LnRPd25lZDtcbiAgICAgICAgICB2LnRTdGF0ZSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgc2V0VHJhbnNQZW5kaW5nKGZhbHNlKTtcbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKFRyYW5zaXRpb24ucnVubmluZykge1xuICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gZmFsc2U7XG4gICAgICBUcmFuc2l0aW9uLmVmZmVjdHMucHVzaC5hcHBseShUcmFuc2l0aW9uLmVmZmVjdHMsIEVmZmVjdHMpO1xuICAgICAgRWZmZWN0cyA9IG51bGw7XG4gICAgICBzZXRUcmFuc1BlbmRpbmcodHJ1ZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG4gIGNvbnN0IGUgPSBFZmZlY3RzO1xuICBFZmZlY3RzID0gbnVsbDtcbiAgaWYgKGUubGVuZ3RoKSBydW5VcGRhdGVzKCgpID0+IHJ1bkVmZmVjdHMoZSksIGZhbHNlKTtlbHNlIERldkhvb2tzLmFmdGVyVXBkYXRlICYmIERldkhvb2tzLmFmdGVyVXBkYXRlKCk7XG4gIGlmIChyZXMpIHJlcygpO1xufVxuZnVuY3Rpb24gcnVuUXVldWUocXVldWUpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykgcnVuVG9wKHF1ZXVlW2ldKTtcbn1cbmZ1bmN0aW9uIHNjaGVkdWxlUXVldWUocXVldWUpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGl0ZW0gPSBxdWV1ZVtpXTtcbiAgICBjb25zdCB0YXNrcyA9IFRyYW5zaXRpb24ucXVldWU7XG4gICAgaWYgKCF0YXNrcy5oYXMoaXRlbSkpIHtcbiAgICAgIHRhc2tzLmFkZChpdGVtKTtcbiAgICAgIFNjaGVkdWxlcigoKSA9PiB7XG4gICAgICAgIHRhc2tzLmRlbGV0ZShpdGVtKTtcbiAgICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICBydW5Ub3AoaXRlbSk7XG4gICAgICAgIH0sIGZhbHNlKTtcbiAgICAgICAgVHJhbnNpdGlvbiAmJiAoVHJhbnNpdGlvbi5ydW5uaW5nID0gZmFsc2UpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBydW5Vc2VyRWZmZWN0cyhxdWV1ZSkge1xuICBsZXQgaSxcbiAgICB1c2VyTGVuZ3RoID0gMDtcbiAgZm9yIChpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZSA9IHF1ZXVlW2ldO1xuICAgIGlmICghZS51c2VyKSBydW5Ub3AoZSk7ZWxzZSBxdWV1ZVt1c2VyTGVuZ3RoKytdID0gZTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmNvdW50KSB7XG4gICAgICBzaGFyZWRDb25maWcuZWZmZWN0cyB8fCAoc2hhcmVkQ29uZmlnLmVmZmVjdHMgPSBbXSk7XG4gICAgICBzaGFyZWRDb25maWcuZWZmZWN0cy5wdXNoKC4uLnF1ZXVlLnNsaWNlKDAsIHVzZXJMZW5ndGgpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmVmZmVjdHMgJiYgKHNoYXJlZENvbmZpZy5kb25lIHx8ICFzaGFyZWRDb25maWcuY291bnQpKSB7XG4gICAgcXVldWUgPSBbLi4uc2hhcmVkQ29uZmlnLmVmZmVjdHMsIC4uLnF1ZXVlXTtcbiAgICB1c2VyTGVuZ3RoICs9IHNoYXJlZENvbmZpZy5lZmZlY3RzLmxlbmd0aDtcbiAgICBkZWxldGUgc2hhcmVkQ29uZmlnLmVmZmVjdHM7XG4gIH1cbiAgZm9yIChpID0gMDsgaSA8IHVzZXJMZW5ndGg7IGkrKykgcnVuVG9wKHF1ZXVlW2ldKTtcbn1cbmZ1bmN0aW9uIGxvb2tVcHN0cmVhbShub2RlLCBpZ25vcmUpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uKSBub2RlLnRTdGF0ZSA9IDA7ZWxzZSBub2RlLnN0YXRlID0gMDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLnNvdXJjZXMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBjb25zdCBzb3VyY2UgPSBub2RlLnNvdXJjZXNbaV07XG4gICAgaWYgKHNvdXJjZS5zb3VyY2VzKSB7XG4gICAgICBjb25zdCBzdGF0ZSA9IHJ1bm5pbmdUcmFuc2l0aW9uID8gc291cmNlLnRTdGF0ZSA6IHNvdXJjZS5zdGF0ZTtcbiAgICAgIGlmIChzdGF0ZSA9PT0gU1RBTEUpIHtcbiAgICAgICAgaWYgKHNvdXJjZSAhPT0gaWdub3JlICYmICghc291cmNlLnVwZGF0ZWRBdCB8fCBzb3VyY2UudXBkYXRlZEF0IDwgRXhlY0NvdW50KSkgcnVuVG9wKHNvdXJjZSk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBQRU5ESU5HKSBsb29rVXBzdHJlYW0oc291cmNlLCBpZ25vcmUpO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gbWFya0Rvd25zdHJlYW0obm9kZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUub2JzZXJ2ZXJzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgY29uc3QgbyA9IG5vZGUub2JzZXJ2ZXJzW2ldO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiA/ICFvLnRTdGF0ZSA6ICFvLnN0YXRlKSB7XG4gICAgICBpZiAocnVubmluZ1RyYW5zaXRpb24pIG8udFN0YXRlID0gUEVORElORztlbHNlIG8uc3RhdGUgPSBQRU5ESU5HO1xuICAgICAgaWYgKG8ucHVyZSkgVXBkYXRlcy5wdXNoKG8pO2Vsc2UgRWZmZWN0cy5wdXNoKG8pO1xuICAgICAgby5vYnNlcnZlcnMgJiYgbWFya0Rvd25zdHJlYW0obyk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBjbGVhbk5vZGUobm9kZSkge1xuICBsZXQgaTtcbiAgaWYgKG5vZGUuc291cmNlcykge1xuICAgIHdoaWxlIChub2RlLnNvdXJjZXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBzb3VyY2UgPSBub2RlLnNvdXJjZXMucG9wKCksXG4gICAgICAgIGluZGV4ID0gbm9kZS5zb3VyY2VTbG90cy5wb3AoKSxcbiAgICAgICAgb2JzID0gc291cmNlLm9ic2VydmVycztcbiAgICAgIGlmIChvYnMgJiYgb2JzLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBuID0gb2JzLnBvcCgpLFxuICAgICAgICAgIHMgPSBzb3VyY2Uub2JzZXJ2ZXJTbG90cy5wb3AoKTtcbiAgICAgICAgaWYgKGluZGV4IDwgb2JzLmxlbmd0aCkge1xuICAgICAgICAgIG4uc291cmNlU2xvdHNbc10gPSBpbmRleDtcbiAgICAgICAgICBvYnNbaW5kZXhdID0gbjtcbiAgICAgICAgICBzb3VyY2Uub2JzZXJ2ZXJTbG90c1tpbmRleF0gPSBzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChub2RlLnRPd25lZCkge1xuICAgIGZvciAoaSA9IG5vZGUudE93bmVkLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBjbGVhbk5vZGUobm9kZS50T3duZWRbaV0pO1xuICAgIGRlbGV0ZSBub2RlLnRPd25lZDtcbiAgfVxuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgbm9kZS5wdXJlKSB7XG4gICAgcmVzZXQobm9kZSwgdHJ1ZSk7XG4gIH0gZWxzZSBpZiAobm9kZS5vd25lZCkge1xuICAgIGZvciAoaSA9IG5vZGUub3duZWQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGNsZWFuTm9kZShub2RlLm93bmVkW2ldKTtcbiAgICBub2RlLm93bmVkID0gbnVsbDtcbiAgfVxuICBpZiAobm9kZS5jbGVhbnVwcykge1xuICAgIGZvciAoaSA9IG5vZGUuY2xlYW51cHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIG5vZGUuY2xlYW51cHNbaV0oKTtcbiAgICBub2RlLmNsZWFudXBzID0gbnVsbDtcbiAgfVxuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIG5vZGUudFN0YXRlID0gMDtlbHNlIG5vZGUuc3RhdGUgPSAwO1xuICBkZWxldGUgbm9kZS5zb3VyY2VNYXA7XG59XG5mdW5jdGlvbiByZXNldChub2RlLCB0b3ApIHtcbiAgaWYgKCF0b3ApIHtcbiAgICBub2RlLnRTdGF0ZSA9IDA7XG4gICAgVHJhbnNpdGlvbi5kaXNwb3NlZC5hZGQobm9kZSk7XG4gIH1cbiAgaWYgKG5vZGUub3duZWQpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUub3duZWQubGVuZ3RoOyBpKyspIHJlc2V0KG5vZGUub3duZWRbaV0pO1xuICB9XG59XG5mdW5jdGlvbiBjYXN0RXJyb3IoZXJyKSB7XG4gIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikgcmV0dXJuIGVycjtcbiAgcmV0dXJuIG5ldyBFcnJvcih0eXBlb2YgZXJyID09PSBcInN0cmluZ1wiID8gZXJyIDogXCJVbmtub3duIGVycm9yXCIsIHtcbiAgICBjYXVzZTogZXJyXG4gIH0pO1xufVxuZnVuY3Rpb24gcnVuRXJyb3JzKGVyciwgZm5zLCBvd25lcikge1xuICB0cnkge1xuICAgIGZvciAoY29uc3QgZiBvZiBmbnMpIGYoZXJyKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGhhbmRsZUVycm9yKGUsIG93bmVyICYmIG93bmVyLm93bmVyIHx8IG51bGwpO1xuICB9XG59XG5mdW5jdGlvbiBoYW5kbGVFcnJvcihlcnIsIG93bmVyID0gT3duZXIpIHtcbiAgY29uc3QgZm5zID0gRVJST1IgJiYgb3duZXIgJiYgb3duZXIuY29udGV4dCAmJiBvd25lci5jb250ZXh0W0VSUk9SXTtcbiAgY29uc3QgZXJyb3IgPSBjYXN0RXJyb3IoZXJyKTtcbiAgaWYgKCFmbnMpIHRocm93IGVycm9yO1xuICBpZiAoRWZmZWN0cykgRWZmZWN0cy5wdXNoKHtcbiAgICBmbigpIHtcbiAgICAgIHJ1bkVycm9ycyhlcnJvciwgZm5zLCBvd25lcik7XG4gICAgfSxcbiAgICBzdGF0ZTogU1RBTEVcbiAgfSk7ZWxzZSBydW5FcnJvcnMoZXJyb3IsIGZucywgb3duZXIpO1xufVxuZnVuY3Rpb24gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKSB7XG4gIGlmICh0eXBlb2YgY2hpbGRyZW4gPT09IFwiZnVuY3Rpb25cIiAmJiAhY2hpbGRyZW4ubGVuZ3RoKSByZXR1cm4gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKCkpO1xuICBpZiAoQXJyYXkuaXNBcnJheShjaGlsZHJlbikpIHtcbiAgICBjb25zdCByZXN1bHRzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgcmVzdWx0ID0gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuW2ldKTtcbiAgICAgIEFycmF5LmlzQXJyYXkocmVzdWx0KSA/IHJlc3VsdHMucHVzaC5hcHBseShyZXN1bHRzLCByZXN1bHQpIDogcmVzdWx0cy5wdXNoKHJlc3VsdCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG4gIHJldHVybiBjaGlsZHJlbjtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVByb3ZpZGVyKGlkLCBvcHRpb25zKSB7XG4gIHJldHVybiBmdW5jdGlvbiBwcm92aWRlcihwcm9wcykge1xuICAgIGxldCByZXM7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHJlcyA9IHVudHJhY2soKCkgPT4ge1xuICAgICAgT3duZXIuY29udGV4dCA9IHtcbiAgICAgICAgLi4uT3duZXIuY29udGV4dCxcbiAgICAgICAgW2lkXTogcHJvcHMudmFsdWVcbiAgICAgIH07XG4gICAgICByZXR1cm4gY2hpbGRyZW4oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICAgIH0pLCB1bmRlZmluZWQsIG9wdGlvbnMpO1xuICAgIHJldHVybiByZXM7XG4gIH07XG59XG5mdW5jdGlvbiBvbkVycm9yKGZuKSB7XG4gIEVSUk9SIHx8IChFUlJPUiA9IFN5bWJvbChcImVycm9yXCIpKTtcbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJlcnJvciBoYW5kbGVycyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBydW5cIik7ZWxzZSBpZiAoT3duZXIuY29udGV4dCA9PT0gbnVsbCB8fCAhT3duZXIuY29udGV4dFtFUlJPUl0pIHtcbiAgICBPd25lci5jb250ZXh0ID0ge1xuICAgICAgLi4uT3duZXIuY29udGV4dCxcbiAgICAgIFtFUlJPUl06IFtmbl1cbiAgICB9O1xuICAgIG11dGF0ZUNvbnRleHQoT3duZXIsIEVSUk9SLCBbZm5dKTtcbiAgfSBlbHNlIE93bmVyLmNvbnRleHRbRVJST1JdLnB1c2goZm4pO1xufVxuZnVuY3Rpb24gbXV0YXRlQ29udGV4dChvLCBrZXksIHZhbHVlKSB7XG4gIGlmIChvLm93bmVkKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvLm93bmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoby5vd25lZFtpXS5jb250ZXh0ID09PSBvLmNvbnRleHQpIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICBpZiAoIW8ub3duZWRbaV0uY29udGV4dCkge1xuICAgICAgICBvLm93bmVkW2ldLmNvbnRleHQgPSBvLmNvbnRleHQ7XG4gICAgICAgIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKCFvLm93bmVkW2ldLmNvbnRleHRba2V5XSkge1xuICAgICAgICBvLm93bmVkW2ldLmNvbnRleHRba2V5XSA9IHZhbHVlO1xuICAgICAgICBtdXRhdGVDb250ZXh0KG8ub3duZWRbaV0sIGtleSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBvYnNlcnZhYmxlKGlucHV0KSB7XG4gIHJldHVybiB7XG4gICAgc3Vic2NyaWJlKG9ic2VydmVyKSB7XG4gICAgICBpZiAoIShvYnNlcnZlciBpbnN0YW5jZW9mIE9iamVjdCkgfHwgb2JzZXJ2ZXIgPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRXhwZWN0ZWQgdGhlIG9ic2VydmVyIHRvIGJlIGFuIG9iamVjdC5cIik7XG4gICAgICB9XG4gICAgICBjb25zdCBoYW5kbGVyID0gdHlwZW9mIG9ic2VydmVyID09PSBcImZ1bmN0aW9uXCIgPyBvYnNlcnZlciA6IG9ic2VydmVyLm5leHQgJiYgb2JzZXJ2ZXIubmV4dC5iaW5kKG9ic2VydmVyKTtcbiAgICAgIGlmICghaGFuZGxlcikge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHVuc3Vic2NyaWJlKCkge31cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRpc3Bvc2UgPSBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgICBjb25zdCB2ID0gaW5wdXQoKTtcbiAgICAgICAgICB1bnRyYWNrKCgpID0+IGhhbmRsZXIodikpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRpc3Bvc2VyO1xuICAgICAgfSk7XG4gICAgICBpZiAoZ2V0T3duZXIoKSkgb25DbGVhbnVwKGRpc3Bvc2UpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKSB7XG4gICAgICAgICAgZGlzcG9zZSgpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0sXG4gICAgW1N5bWJvbC5vYnNlcnZhYmxlIHx8IFwiQEBvYnNlcnZhYmxlXCJdKCkge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gZnJvbShwcm9kdWNlciwgaW5pdGFsVmFsdWUgPSB1bmRlZmluZWQpIHtcbiAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoaW5pdGFsVmFsdWUsIHtcbiAgICBlcXVhbHM6IGZhbHNlXG4gIH0pO1xuICBpZiAoXCJzdWJzY3JpYmVcIiBpbiBwcm9kdWNlcikge1xuICAgIGNvbnN0IHVuc3ViID0gcHJvZHVjZXIuc3Vic2NyaWJlKHYgPT4gc2V0KCgpID0+IHYpKTtcbiAgICBvbkNsZWFudXAoKCkgPT4gXCJ1bnN1YnNjcmliZVwiIGluIHVuc3ViID8gdW5zdWIudW5zdWJzY3JpYmUoKSA6IHVuc3ViKCkpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGNsZWFuID0gcHJvZHVjZXIoc2V0KTtcbiAgICBvbkNsZWFudXAoY2xlYW4pO1xuICB9XG4gIHJldHVybiBzO1xufVxuXG5jb25zdCBGQUxMQkFDSyA9IFN5bWJvbChcImZhbGxiYWNrXCIpO1xuZnVuY3Rpb24gZGlzcG9zZShkKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZC5sZW5ndGg7IGkrKykgZFtpXSgpO1xufVxuZnVuY3Rpb24gbWFwQXJyYXkobGlzdCwgbWFwRm4sIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgaXRlbXMgPSBbXSxcbiAgICBtYXBwZWQgPSBbXSxcbiAgICBkaXNwb3NlcnMgPSBbXSxcbiAgICBsZW4gPSAwLFxuICAgIGluZGV4ZXMgPSBtYXBGbi5sZW5ndGggPiAxID8gW10gOiBudWxsO1xuICBvbkNsZWFudXAoKCkgPT4gZGlzcG9zZShkaXNwb3NlcnMpKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBsZXQgbmV3SXRlbXMgPSBsaXN0KCkgfHwgW10sXG4gICAgICBuZXdMZW4gPSBuZXdJdGVtcy5sZW5ndGgsXG4gICAgICBpLFxuICAgICAgajtcbiAgICBuZXdJdGVtc1skVFJBQ0tdO1xuICAgIHJldHVybiB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGxldCBuZXdJbmRpY2VzLCBuZXdJbmRpY2VzTmV4dCwgdGVtcCwgdGVtcGRpc3Bvc2VycywgdGVtcEluZGV4ZXMsIHN0YXJ0LCBlbmQsIG5ld0VuZCwgaXRlbTtcbiAgICAgIGlmIChuZXdMZW4gPT09IDApIHtcbiAgICAgICAgaWYgKGxlbiAhPT0gMCkge1xuICAgICAgICAgIGRpc3Bvc2UoZGlzcG9zZXJzKTtcbiAgICAgICAgICBkaXNwb3NlcnMgPSBbXTtcbiAgICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICAgIGxlbiA9IDA7XG4gICAgICAgICAgaW5kZXhlcyAmJiAoaW5kZXhlcyA9IFtdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5mYWxsYmFjaykge1xuICAgICAgICAgIGl0ZW1zID0gW0ZBTExCQUNLXTtcbiAgICAgICAgICBtYXBwZWRbMF0gPSBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgICAgIGRpc3Bvc2Vyc1swXSA9IGRpc3Bvc2VyO1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMuZmFsbGJhY2soKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBsZW4gPSAxO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChsZW4gPT09IDApIHtcbiAgICAgICAgbWFwcGVkID0gbmV3IEFycmF5KG5ld0xlbik7XG4gICAgICAgIGZvciAoaiA9IDA7IGogPCBuZXdMZW47IGorKykge1xuICAgICAgICAgIGl0ZW1zW2pdID0gbmV3SXRlbXNbal07XG4gICAgICAgICAgbWFwcGVkW2pdID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICAgIGxlbiA9IG5ld0xlbjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRlbXAgPSBuZXcgQXJyYXkobmV3TGVuKTtcbiAgICAgICAgdGVtcGRpc3Bvc2VycyA9IG5ldyBBcnJheShuZXdMZW4pO1xuICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlcyA9IG5ldyBBcnJheShuZXdMZW4pKTtcbiAgICAgICAgZm9yIChzdGFydCA9IDAsIGVuZCA9IE1hdGgubWluKGxlbiwgbmV3TGVuKTsgc3RhcnQgPCBlbmQgJiYgaXRlbXNbc3RhcnRdID09PSBuZXdJdGVtc1tzdGFydF07IHN0YXJ0KyspO1xuICAgICAgICBmb3IgKGVuZCA9IGxlbiAtIDEsIG5ld0VuZCA9IG5ld0xlbiAtIDE7IGVuZCA+PSBzdGFydCAmJiBuZXdFbmQgPj0gc3RhcnQgJiYgaXRlbXNbZW5kXSA9PT0gbmV3SXRlbXNbbmV3RW5kXTsgZW5kLS0sIG5ld0VuZC0tKSB7XG4gICAgICAgICAgdGVtcFtuZXdFbmRdID0gbWFwcGVkW2VuZF07XG4gICAgICAgICAgdGVtcGRpc3Bvc2Vyc1tuZXdFbmRdID0gZGlzcG9zZXJzW2VuZF07XG4gICAgICAgICAgaW5kZXhlcyAmJiAodGVtcEluZGV4ZXNbbmV3RW5kXSA9IGluZGV4ZXNbZW5kXSk7XG4gICAgICAgIH1cbiAgICAgICAgbmV3SW5kaWNlcyA9IG5ldyBNYXAoKTtcbiAgICAgICAgbmV3SW5kaWNlc05leHQgPSBuZXcgQXJyYXkobmV3RW5kICsgMSk7XG4gICAgICAgIGZvciAoaiA9IG5ld0VuZDsgaiA+PSBzdGFydDsgai0tKSB7XG4gICAgICAgICAgaXRlbSA9IG5ld0l0ZW1zW2pdO1xuICAgICAgICAgIGkgPSBuZXdJbmRpY2VzLmdldChpdGVtKTtcbiAgICAgICAgICBuZXdJbmRpY2VzTmV4dFtqXSA9IGkgPT09IHVuZGVmaW5lZCA/IC0xIDogaTtcbiAgICAgICAgICBuZXdJbmRpY2VzLnNldChpdGVtLCBqKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGkgPSBzdGFydDsgaSA8PSBlbmQ7IGkrKykge1xuICAgICAgICAgIGl0ZW0gPSBpdGVtc1tpXTtcbiAgICAgICAgICBqID0gbmV3SW5kaWNlcy5nZXQoaXRlbSk7XG4gICAgICAgICAgaWYgKGogIT09IHVuZGVmaW5lZCAmJiBqICE9PSAtMSkge1xuICAgICAgICAgICAgdGVtcFtqXSA9IG1hcHBlZFtpXTtcbiAgICAgICAgICAgIHRlbXBkaXNwb3NlcnNbal0gPSBkaXNwb3NlcnNbaV07XG4gICAgICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlc1tqXSA9IGluZGV4ZXNbaV0pO1xuICAgICAgICAgICAgaiA9IG5ld0luZGljZXNOZXh0W2pdO1xuICAgICAgICAgICAgbmV3SW5kaWNlcy5zZXQoaXRlbSwgaik7XG4gICAgICAgICAgfSBlbHNlIGRpc3Bvc2Vyc1tpXSgpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaiA9IHN0YXJ0OyBqIDwgbmV3TGVuOyBqKyspIHtcbiAgICAgICAgICBpZiAoaiBpbiB0ZW1wKSB7XG4gICAgICAgICAgICBtYXBwZWRbal0gPSB0ZW1wW2pdO1xuICAgICAgICAgICAgZGlzcG9zZXJzW2pdID0gdGVtcGRpc3Bvc2Vyc1tqXTtcbiAgICAgICAgICAgIGlmIChpbmRleGVzKSB7XG4gICAgICAgICAgICAgIGluZGV4ZXNbal0gPSB0ZW1wSW5kZXhlc1tqXTtcbiAgICAgICAgICAgICAgaW5kZXhlc1tqXShqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgbWFwcGVkW2pdID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICAgIG1hcHBlZCA9IG1hcHBlZC5zbGljZSgwLCBsZW4gPSBuZXdMZW4pO1xuICAgICAgICBpdGVtcyA9IG5ld0l0ZW1zLnNsaWNlKDApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1hcHBlZDtcbiAgICB9KTtcbiAgICBmdW5jdGlvbiBtYXBwZXIoZGlzcG9zZXIpIHtcbiAgICAgIGRpc3Bvc2Vyc1tqXSA9IGRpc3Bvc2VyO1xuICAgICAgaWYgKGluZGV4ZXMpIHtcbiAgICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoaiwge1xuICAgICAgICAgIG5hbWU6IFwiaW5kZXhcIlxuICAgICAgICB9KSA7XG4gICAgICAgIGluZGV4ZXNbal0gPSBzZXQ7XG4gICAgICAgIHJldHVybiBtYXBGbihuZXdJdGVtc1tqXSwgcyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWFwRm4obmV3SXRlbXNbal0pO1xuICAgIH1cbiAgfTtcbn1cbmZ1bmN0aW9uIGluZGV4QXJyYXkobGlzdCwgbWFwRm4sIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgaXRlbXMgPSBbXSxcbiAgICBtYXBwZWQgPSBbXSxcbiAgICBkaXNwb3NlcnMgPSBbXSxcbiAgICBzaWduYWxzID0gW10sXG4gICAgbGVuID0gMCxcbiAgICBpO1xuICBvbkNsZWFudXAoKCkgPT4gZGlzcG9zZShkaXNwb3NlcnMpKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBjb25zdCBuZXdJdGVtcyA9IGxpc3QoKSB8fCBbXSxcbiAgICAgIG5ld0xlbiA9IG5ld0l0ZW1zLmxlbmd0aDtcbiAgICBuZXdJdGVtc1skVFJBQ0tdO1xuICAgIHJldHVybiB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGlmIChuZXdMZW4gPT09IDApIHtcbiAgICAgICAgaWYgKGxlbiAhPT0gMCkge1xuICAgICAgICAgIGRpc3Bvc2UoZGlzcG9zZXJzKTtcbiAgICAgICAgICBkaXNwb3NlcnMgPSBbXTtcbiAgICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICAgIGxlbiA9IDA7XG4gICAgICAgICAgc2lnbmFscyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLmZhbGxiYWNrKSB7XG4gICAgICAgICAgaXRlbXMgPSBbRkFMTEJBQ0tdO1xuICAgICAgICAgIG1hcHBlZFswXSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZXJzWzBdID0gZGlzcG9zZXI7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9ucy5mYWxsYmFjaygpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxlbiA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hcHBlZDtcbiAgICAgIH1cbiAgICAgIGlmIChpdGVtc1swXSA9PT0gRkFMTEJBQ0spIHtcbiAgICAgICAgZGlzcG9zZXJzWzBdKCk7XG4gICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICBtYXBwZWQgPSBbXTtcbiAgICAgICAgbGVuID0gMDtcbiAgICAgIH1cbiAgICAgIGZvciAoaSA9IDA7IGkgPCBuZXdMZW47IGkrKykge1xuICAgICAgICBpZiAoaSA8IGl0ZW1zLmxlbmd0aCAmJiBpdGVtc1tpXSAhPT0gbmV3SXRlbXNbaV0pIHtcbiAgICAgICAgICBzaWduYWxzW2ldKCgpID0+IG5ld0l0ZW1zW2ldKTtcbiAgICAgICAgfSBlbHNlIGlmIChpID49IGl0ZW1zLmxlbmd0aCkge1xuICAgICAgICAgIG1hcHBlZFtpXSA9IGNyZWF0ZVJvb3QobWFwcGVyKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yICg7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBkaXNwb3NlcnNbaV0oKTtcbiAgICAgIH1cbiAgICAgIGxlbiA9IHNpZ25hbHMubGVuZ3RoID0gZGlzcG9zZXJzLmxlbmd0aCA9IG5ld0xlbjtcbiAgICAgIGl0ZW1zID0gbmV3SXRlbXMuc2xpY2UoMCk7XG4gICAgICByZXR1cm4gbWFwcGVkID0gbWFwcGVkLnNsaWNlKDAsIGxlbik7XG4gICAgfSk7XG4gICAgZnVuY3Rpb24gbWFwcGVyKGRpc3Bvc2VyKSB7XG4gICAgICBkaXNwb3NlcnNbaV0gPSBkaXNwb3NlcjtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKG5ld0l0ZW1zW2ldLCB7XG4gICAgICAgIG5hbWU6IFwidmFsdWVcIlxuICAgICAgfSkgO1xuICAgICAgc2lnbmFsc1tpXSA9IHNldDtcbiAgICAgIHJldHVybiBtYXBGbihzLCBpKTtcbiAgICB9XG4gIH07XG59XG5cbmxldCBoeWRyYXRpb25FbmFibGVkID0gZmFsc2U7XG5mdW5jdGlvbiBlbmFibGVIeWRyYXRpb24oKSB7XG4gIGh5ZHJhdGlvbkVuYWJsZWQgPSB0cnVlO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50KENvbXAsIHByb3BzKSB7XG4gIGlmIChoeWRyYXRpb25FbmFibGVkKSB7XG4gICAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0KSB7XG4gICAgICBjb25zdCBjID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChuZXh0SHlkcmF0ZUNvbnRleHQoKSk7XG4gICAgICBjb25zdCByID0gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzIHx8IHt9KSA7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjKTtcbiAgICAgIHJldHVybiByO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzIHx8IHt9KTtcbn1cbmZ1bmN0aW9uIHRydWVGbigpIHtcbiAgcmV0dXJuIHRydWU7XG59XG5jb25zdCBwcm9wVHJhcHMgPSB7XG4gIGdldChfLCBwcm9wZXJ0eSwgcmVjZWl2ZXIpIHtcbiAgICBpZiAocHJvcGVydHkgPT09ICRQUk9YWSkgcmV0dXJuIHJlY2VpdmVyO1xuICAgIHJldHVybiBfLmdldChwcm9wZXJ0eSk7XG4gIH0sXG4gIGhhcyhfLCBwcm9wZXJ0eSkge1xuICAgIGlmIChwcm9wZXJ0eSA9PT0gJFBST1hZKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gXy5oYXMocHJvcGVydHkpO1xuICB9LFxuICBzZXQ6IHRydWVGbixcbiAgZGVsZXRlUHJvcGVydHk6IHRydWVGbixcbiAgZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKF8sIHByb3BlcnR5KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBnZXQoKSB7XG4gICAgICAgIHJldHVybiBfLmdldChwcm9wZXJ0eSk7XG4gICAgICB9LFxuICAgICAgc2V0OiB0cnVlRm4sXG4gICAgICBkZWxldGVQcm9wZXJ0eTogdHJ1ZUZuXG4gICAgfTtcbiAgfSxcbiAgb3duS2V5cyhfKSB7XG4gICAgcmV0dXJuIF8ua2V5cygpO1xuICB9XG59O1xuZnVuY3Rpb24gcmVzb2x2ZVNvdXJjZShzKSB7XG4gIHJldHVybiAhKHMgPSB0eXBlb2YgcyA9PT0gXCJmdW5jdGlvblwiID8gcygpIDogcykgPyB7fSA6IHM7XG59XG5mdW5jdGlvbiByZXNvbHZlU291cmNlcygpIHtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbmd0aCA9IHRoaXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICBjb25zdCB2ID0gdGhpc1tpXSgpO1xuICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHJldHVybiB2O1xuICB9XG59XG5mdW5jdGlvbiBtZXJnZVByb3BzKC4uLnNvdXJjZXMpIHtcbiAgbGV0IHByb3h5ID0gZmFsc2U7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHMgPSBzb3VyY2VzW2ldO1xuICAgIHByb3h5ID0gcHJveHkgfHwgISFzICYmICRQUk9YWSBpbiBzO1xuICAgIHNvdXJjZXNbaV0gPSB0eXBlb2YgcyA9PT0gXCJmdW5jdGlvblwiID8gKHByb3h5ID0gdHJ1ZSwgY3JlYXRlTWVtbyhzKSkgOiBzO1xuICB9XG4gIGlmIChTVVBQT1JUU19QUk9YWSAmJiBwcm94eSkge1xuICAgIHJldHVybiBuZXcgUHJveHkoe1xuICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgY29uc3QgdiA9IHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSlbcHJvcGVydHldO1xuICAgICAgICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHJldHVybiB2O1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFzKHByb3BlcnR5KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgaWYgKHByb3BlcnR5IGluIHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSkpIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBrZXlzKCkge1xuICAgICAgICBjb25zdCBrZXlzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc291cmNlcy5sZW5ndGg7IGkrKykga2V5cy5wdXNoKC4uLk9iamVjdC5rZXlzKHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSkpKTtcbiAgICAgICAgcmV0dXJuIFsuLi5uZXcgU2V0KGtleXMpXTtcbiAgICAgIH1cbiAgICB9LCBwcm9wVHJhcHMpO1xuICB9XG4gIGNvbnN0IHNvdXJjZXNNYXAgPSB7fTtcbiAgY29uc3QgZGVmaW5lZCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3Qgc291cmNlID0gc291cmNlc1tpXTtcbiAgICBpZiAoIXNvdXJjZSkgY29udGludWU7XG4gICAgY29uc3Qgc291cmNlS2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHNvdXJjZSk7XG4gICAgZm9yIChsZXQgaSA9IHNvdXJjZUtleXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IGtleSA9IHNvdXJjZUtleXNbaV07XG4gICAgICBpZiAoa2V5ID09PSBcIl9fcHJvdG9fX1wiIHx8IGtleSA9PT0gXCJjb25zdHJ1Y3RvclwiKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHNvdXJjZSwga2V5KTtcbiAgICAgIGlmICghZGVmaW5lZFtrZXldKSB7XG4gICAgICAgIGRlZmluZWRba2V5XSA9IGRlc2MuZ2V0ID8ge1xuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGdldDogcmVzb2x2ZVNvdXJjZXMuYmluZChzb3VyY2VzTWFwW2tleV0gPSBbZGVzYy5nZXQuYmluZChzb3VyY2UpXSlcbiAgICAgICAgfSA6IGRlc2MudmFsdWUgIT09IHVuZGVmaW5lZCA/IGRlc2MgOiB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBzb3VyY2VzID0gc291cmNlc01hcFtrZXldO1xuICAgICAgICBpZiAoc291cmNlcykge1xuICAgICAgICAgIGlmIChkZXNjLmdldCkgc291cmNlcy5wdXNoKGRlc2MuZ2V0LmJpbmQoc291cmNlKSk7ZWxzZSBpZiAoZGVzYy52YWx1ZSAhPT0gdW5kZWZpbmVkKSBzb3VyY2VzLnB1c2goKCkgPT4gZGVzYy52YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY29uc3QgdGFyZ2V0ID0ge307XG4gIGNvbnN0IGRlZmluZWRLZXlzID0gT2JqZWN0LmtleXMoZGVmaW5lZCk7XG4gIGZvciAobGV0IGkgPSBkZWZpbmVkS2V5cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGNvbnN0IGtleSA9IGRlZmluZWRLZXlzW2ldLFxuICAgICAgZGVzYyA9IGRlZmluZWRba2V5XTtcbiAgICBpZiAoZGVzYyAmJiBkZXNjLmdldCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCBkZXNjKTtlbHNlIHRhcmdldFtrZXldID0gZGVzYyA/IGRlc2MudmFsdWUgOiB1bmRlZmluZWQ7XG4gIH1cbiAgcmV0dXJuIHRhcmdldDtcbn1cbmZ1bmN0aW9uIHNwbGl0UHJvcHMocHJvcHMsIC4uLmtleXMpIHtcbiAgaWYgKFNVUFBPUlRTX1BST1hZICYmICRQUk9YWSBpbiBwcm9wcykge1xuICAgIGNvbnN0IGJsb2NrZWQgPSBuZXcgU2V0KGtleXMubGVuZ3RoID4gMSA/IGtleXMuZmxhdCgpIDoga2V5c1swXSk7XG4gICAgY29uc3QgcmVzID0ga2V5cy5tYXAoayA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb3h5KHtcbiAgICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgICAgcmV0dXJuIGsuaW5jbHVkZXMocHJvcGVydHkpID8gcHJvcHNbcHJvcGVydHldIDogdW5kZWZpbmVkO1xuICAgICAgICB9LFxuICAgICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gay5pbmNsdWRlcyhwcm9wZXJ0eSkgJiYgcHJvcGVydHkgaW4gcHJvcHM7XG4gICAgICAgIH0sXG4gICAgICAgIGtleXMoKSB7XG4gICAgICAgICAgcmV0dXJuIGsuZmlsdGVyKHByb3BlcnR5ID0+IHByb3BlcnR5IGluIHByb3BzKTtcbiAgICAgICAgfVxuICAgICAgfSwgcHJvcFRyYXBzKTtcbiAgICB9KTtcbiAgICByZXMucHVzaChuZXcgUHJveHkoe1xuICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgIHJldHVybiBibG9ja2VkLmhhcyhwcm9wZXJ0eSkgPyB1bmRlZmluZWQgOiBwcm9wc1twcm9wZXJ0eV07XG4gICAgICB9LFxuICAgICAgaGFzKHByb3BlcnR5KSB7XG4gICAgICAgIHJldHVybiBibG9ja2VkLmhhcyhwcm9wZXJ0eSkgPyBmYWxzZSA6IHByb3BlcnR5IGluIHByb3BzO1xuICAgICAgfSxcbiAgICAgIGtleXMoKSB7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhwcm9wcykuZmlsdGVyKGsgPT4gIWJsb2NrZWQuaGFzKGspKTtcbiAgICAgIH1cbiAgICB9LCBwcm9wVHJhcHMpKTtcbiAgICByZXR1cm4gcmVzO1xuICB9XG4gIGNvbnN0IG90aGVyT2JqZWN0ID0ge307XG4gIGNvbnN0IG9iamVjdHMgPSBrZXlzLm1hcCgoKSA9PiAoe30pKTtcbiAgZm9yIChjb25zdCBwcm9wTmFtZSBvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhwcm9wcykpIHtcbiAgICBjb25zdCBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwcm9wcywgcHJvcE5hbWUpO1xuICAgIGNvbnN0IGlzRGVmYXVsdERlc2MgPSAhZGVzYy5nZXQgJiYgIWRlc2Muc2V0ICYmIGRlc2MuZW51bWVyYWJsZSAmJiBkZXNjLndyaXRhYmxlICYmIGRlc2MuY29uZmlndXJhYmxlO1xuICAgIGxldCBibG9ja2VkID0gZmFsc2U7XG4gICAgbGV0IG9iamVjdEluZGV4ID0gMDtcbiAgICBmb3IgKGNvbnN0IGsgb2Yga2V5cykge1xuICAgICAgaWYgKGsuaW5jbHVkZXMocHJvcE5hbWUpKSB7XG4gICAgICAgIGJsb2NrZWQgPSB0cnVlO1xuICAgICAgICBpc0RlZmF1bHREZXNjID8gb2JqZWN0c1tvYmplY3RJbmRleF1bcHJvcE5hbWVdID0gZGVzYy52YWx1ZSA6IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmplY3RzW29iamVjdEluZGV4XSwgcHJvcE5hbWUsIGRlc2MpO1xuICAgICAgfVxuICAgICAgKytvYmplY3RJbmRleDtcbiAgICB9XG4gICAgaWYgKCFibG9ja2VkKSB7XG4gICAgICBpc0RlZmF1bHREZXNjID8gb3RoZXJPYmplY3RbcHJvcE5hbWVdID0gZGVzYy52YWx1ZSA6IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvdGhlck9iamVjdCwgcHJvcE5hbWUsIGRlc2MpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gWy4uLm9iamVjdHMsIG90aGVyT2JqZWN0XTtcbn1cbmZ1bmN0aW9uIGxhenkoZm4pIHtcbiAgbGV0IGNvbXA7XG4gIGxldCBwO1xuICBjb25zdCB3cmFwID0gcHJvcHMgPT4ge1xuICAgIGNvbnN0IGN0eCA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICAgIGlmIChjdHgpIHtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKCk7XG4gICAgICBzaGFyZWRDb25maWcuY291bnQgfHwgKHNoYXJlZENvbmZpZy5jb3VudCA9IDApO1xuICAgICAgc2hhcmVkQ29uZmlnLmNvdW50Kys7XG4gICAgICAocCB8fCAocCA9IGZuKCkpKS50aGVuKG1vZCA9PiB7XG4gICAgICAgICFzaGFyZWRDb25maWcuZG9uZSAmJiBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgICBzaGFyZWRDb25maWcuY291bnQtLTtcbiAgICAgICAgc2V0KCgpID0+IG1vZC5kZWZhdWx0KTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgIH0pO1xuICAgICAgY29tcCA9IHM7XG4gICAgfSBlbHNlIGlmICghY29tcCkge1xuICAgICAgY29uc3QgW3NdID0gY3JlYXRlUmVzb3VyY2UoKCkgPT4gKHAgfHwgKHAgPSBmbigpKSkudGhlbihtb2QgPT4gbW9kLmRlZmF1bHQpKTtcbiAgICAgIGNvbXAgPSBzO1xuICAgIH1cbiAgICBsZXQgQ29tcDtcbiAgICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiAoQ29tcCA9IGNvbXAoKSkgPyB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGlmIChJU19ERVYpIE9iamVjdC5hc3NpZ24oQ29tcCwge1xuICAgICAgICBbJERFVkNPTVBdOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIGlmICghY3R4IHx8IHNoYXJlZENvbmZpZy5kb25lKSByZXR1cm4gQ29tcChwcm9wcyk7XG4gICAgICBjb25zdCBjID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgY29uc3QgciA9IENvbXAocHJvcHMpO1xuICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoYyk7XG4gICAgICByZXR1cm4gcjtcbiAgICB9KSA6IFwiXCIpO1xuICB9O1xuICB3cmFwLnByZWxvYWQgPSAoKSA9PiBwIHx8ICgocCA9IGZuKCkpLnRoZW4obW9kID0+IGNvbXAgPSAoKSA9PiBtb2QuZGVmYXVsdCksIHApO1xuICByZXR1cm4gd3JhcDtcbn1cbmxldCBjb3VudGVyID0gMDtcbmZ1bmN0aW9uIGNyZWF0ZVVuaXF1ZUlkKCkge1xuICBjb25zdCBjdHggPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgcmV0dXJuIGN0eCA/IHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCkgOiBgY2wtJHtjb3VudGVyKyt9YDtcbn1cblxuY29uc3QgbmFycm93ZWRFcnJvciA9IG5hbWUgPT4gYEF0dGVtcHRpbmcgdG8gYWNjZXNzIGEgc3RhbGUgdmFsdWUgZnJvbSA8JHtuYW1lfT4gdGhhdCBjb3VsZCBwb3NzaWJseSBiZSB1bmRlZmluZWQuIFRoaXMgbWF5IG9jY3VyIGJlY2F1c2UgeW91IGFyZSByZWFkaW5nIHRoZSBhY2Nlc3NvciByZXR1cm5lZCBmcm9tIHRoZSBjb21wb25lbnQgYXQgYSB0aW1lIHdoZXJlIGl0IGhhcyBhbHJlYWR5IGJlZW4gdW5tb3VudGVkLiBXZSByZWNvbW1lbmQgY2xlYW5pbmcgdXAgYW55IHN0YWxlIHRpbWVycyBvciBhc3luYywgb3IgcmVhZGluZyBmcm9tIHRoZSBpbml0aWFsIGNvbmRpdGlvbi5gIDtcbmZ1bmN0aW9uIEZvcihwcm9wcykge1xuICBjb25zdCBmYWxsYmFjayA9IFwiZmFsbGJhY2tcIiBpbiBwcm9wcyAmJiB7XG4gICAgZmFsbGJhY2s6ICgpID0+IHByb3BzLmZhbGxiYWNrXG4gIH07XG4gIHJldHVybiBjcmVhdGVNZW1vKG1hcEFycmF5KCgpID0+IHByb3BzLmVhY2gsIHByb3BzLmNoaWxkcmVuLCBmYWxsYmFjayB8fCB1bmRlZmluZWQpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSkgO1xufVxuZnVuY3Rpb24gSW5kZXgocHJvcHMpIHtcbiAgY29uc3QgZmFsbGJhY2sgPSBcImZhbGxiYWNrXCIgaW4gcHJvcHMgJiYge1xuICAgIGZhbGxiYWNrOiAoKSA9PiBwcm9wcy5mYWxsYmFja1xuICB9O1xuICByZXR1cm4gY3JlYXRlTWVtbyhpbmRleEFycmF5KCgpID0+IHByb3BzLmVhY2gsIHByb3BzLmNoaWxkcmVuLCBmYWxsYmFjayB8fCB1bmRlZmluZWQpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSkgO1xufVxuZnVuY3Rpb24gU2hvdyhwcm9wcykge1xuICBjb25zdCBrZXllZCA9IHByb3BzLmtleWVkO1xuICBjb25zdCBjb25kaXRpb25WYWx1ZSA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMud2hlbiwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJjb25kaXRpb24gdmFsdWVcIlxuICB9ICk7XG4gIGNvbnN0IGNvbmRpdGlvbiA9IGtleWVkID8gY29uZGl0aW9uVmFsdWUgOiBjcmVhdGVNZW1vKGNvbmRpdGlvblZhbHVlLCB1bmRlZmluZWQsIHtcbiAgICBlcXVhbHM6IChhLCBiKSA9PiAhYSA9PT0gIWIsXG4gICAgbmFtZTogXCJjb25kaXRpb25cIlxuICB9ICk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBjID0gY29uZGl0aW9uKCk7XG4gICAgaWYgKGMpIHtcbiAgICAgIGNvbnN0IGNoaWxkID0gcHJvcHMuY2hpbGRyZW47XG4gICAgICBjb25zdCBmbiA9IHR5cGVvZiBjaGlsZCA9PT0gXCJmdW5jdGlvblwiICYmIGNoaWxkLmxlbmd0aCA+IDA7XG4gICAgICByZXR1cm4gZm4gPyB1bnRyYWNrKCgpID0+IGNoaWxkKGtleWVkID8gYyA6ICgpID0+IHtcbiAgICAgICAgaWYgKCF1bnRyYWNrKGNvbmRpdGlvbikpIHRocm93IG5hcnJvd2VkRXJyb3IoXCJTaG93XCIpO1xuICAgICAgICByZXR1cm4gY29uZGl0aW9uVmFsdWUoKTtcbiAgICAgIH0pKSA6IGNoaWxkO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcHMuZmFsbGJhY2s7XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9ICk7XG59XG5mdW5jdGlvbiBTd2l0Y2gocHJvcHMpIHtcbiAgY29uc3QgY2hzID0gY2hpbGRyZW4oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICBjb25zdCBzd2l0Y2hGdW5jID0gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgY2ggPSBjaHMoKTtcbiAgICBjb25zdCBtcHMgPSBBcnJheS5pc0FycmF5KGNoKSA/IGNoIDogW2NoXTtcbiAgICBsZXQgZnVuYyA9ICgpID0+IHVuZGVmaW5lZDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1wcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaW5kZXggPSBpO1xuICAgICAgY29uc3QgbXAgPSBtcHNbaV07XG4gICAgICBjb25zdCBwcmV2RnVuYyA9IGZ1bmM7XG4gICAgICBjb25zdCBjb25kaXRpb25WYWx1ZSA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJldkZ1bmMoKSA/IHVuZGVmaW5lZCA6IG1wLndoZW4sIHVuZGVmaW5lZCwge1xuICAgICAgICBuYW1lOiBcImNvbmRpdGlvbiB2YWx1ZVwiXG4gICAgICB9ICk7XG4gICAgICBjb25zdCBjb25kaXRpb24gPSBtcC5rZXllZCA/IGNvbmRpdGlvblZhbHVlIDogY3JlYXRlTWVtbyhjb25kaXRpb25WYWx1ZSwgdW5kZWZpbmVkLCB7XG4gICAgICAgIGVxdWFsczogKGEsIGIpID0+ICFhID09PSAhYixcbiAgICAgICAgbmFtZTogXCJjb25kaXRpb25cIlxuICAgICAgfSApO1xuICAgICAgZnVuYyA9ICgpID0+IHByZXZGdW5jKCkgfHwgKGNvbmRpdGlvbigpID8gW2luZGV4LCBjb25kaXRpb25WYWx1ZSwgbXBdIDogdW5kZWZpbmVkKTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmM7XG4gIH0pO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3Qgc2VsID0gc3dpdGNoRnVuYygpKCk7XG4gICAgaWYgKCFzZWwpIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgICBjb25zdCBbaW5kZXgsIGNvbmRpdGlvblZhbHVlLCBtcF0gPSBzZWw7XG4gICAgY29uc3QgY2hpbGQgPSBtcC5jaGlsZHJlbjtcbiAgICBjb25zdCBmbiA9IHR5cGVvZiBjaGlsZCA9PT0gXCJmdW5jdGlvblwiICYmIGNoaWxkLmxlbmd0aCA+IDA7XG4gICAgcmV0dXJuIGZuID8gdW50cmFjaygoKSA9PiBjaGlsZChtcC5rZXllZCA/IGNvbmRpdGlvblZhbHVlKCkgOiAoKSA9PiB7XG4gICAgICBpZiAodW50cmFjayhzd2l0Y2hGdW5jKSgpPy5bMF0gIT09IGluZGV4KSB0aHJvdyBuYXJyb3dlZEVycm9yKFwiTWF0Y2hcIik7XG4gICAgICByZXR1cm4gY29uZGl0aW9uVmFsdWUoKTtcbiAgICB9KSkgOiBjaGlsZDtcbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJldmFsIGNvbmRpdGlvbnNcIlxuICB9ICk7XG59XG5mdW5jdGlvbiBNYXRjaChwcm9wcykge1xuICByZXR1cm4gcHJvcHM7XG59XG5sZXQgRXJyb3JzO1xuZnVuY3Rpb24gcmVzZXRFcnJvckJvdW5kYXJpZXMoKSB7XG4gIEVycm9ycyAmJiBbLi4uRXJyb3JzXS5mb3JFYWNoKGZuID0+IGZuKCkpO1xufVxuZnVuY3Rpb24gRXJyb3JCb3VuZGFyeShwcm9wcykge1xuICBsZXQgZXJyO1xuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgc2hhcmVkQ29uZmlnLmxvYWQpIGVyciA9IHNoYXJlZENvbmZpZy5sb2FkKHNoYXJlZENvbmZpZy5nZXRDb250ZXh0SWQoKSk7XG4gIGNvbnN0IFtlcnJvcmVkLCBzZXRFcnJvcmVkXSA9IGNyZWF0ZVNpZ25hbChlcnIsIHtcbiAgICBuYW1lOiBcImVycm9yZWRcIlxuICB9ICk7XG4gIEVycm9ycyB8fCAoRXJyb3JzID0gbmV3IFNldCgpKTtcbiAgRXJyb3JzLmFkZChzZXRFcnJvcmVkKTtcbiAgb25DbGVhbnVwKCgpID0+IEVycm9ycy5kZWxldGUoc2V0RXJyb3JlZCkpO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgbGV0IGU7XG4gICAgaWYgKGUgPSBlcnJvcmVkKCkpIHtcbiAgICAgIGNvbnN0IGYgPSBwcm9wcy5mYWxsYmFjaztcbiAgICAgIGlmICgodHlwZW9mIGYgIT09IFwiZnVuY3Rpb25cIiB8fCBmLmxlbmd0aCA9PSAwKSkgY29uc29sZS5lcnJvcihlKTtcbiAgICAgIHJldHVybiB0eXBlb2YgZiA9PT0gXCJmdW5jdGlvblwiICYmIGYubGVuZ3RoID8gdW50cmFjaygoKSA9PiBmKGUsICgpID0+IHNldEVycm9yZWQoKSkpIDogZjtcbiAgICB9XG4gICAgcmV0dXJuIGNhdGNoRXJyb3IoKCkgPT4gcHJvcHMuY2hpbGRyZW4sIHNldEVycm9yZWQpO1xuICB9LCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSApO1xufVxuXG5jb25zdCBzdXNwZW5zZUxpc3RFcXVhbHMgPSAoYSwgYikgPT4gYS5zaG93Q29udGVudCA9PT0gYi5zaG93Q29udGVudCAmJiBhLnNob3dGYWxsYmFjayA9PT0gYi5zaG93RmFsbGJhY2s7XG5jb25zdCBTdXNwZW5zZUxpc3RDb250ZXh0ID0gLyogI19fUFVSRV9fICovY3JlYXRlQ29udGV4dCgpO1xuZnVuY3Rpb24gU3VzcGVuc2VMaXN0KHByb3BzKSB7XG4gIGxldCBbd3JhcHBlciwgc2V0V3JhcHBlcl0gPSBjcmVhdGVTaWduYWwoKCkgPT4gKHtcbiAgICAgIGluRmFsbGJhY2s6IGZhbHNlXG4gICAgfSkpLFxuICAgIHNob3c7XG4gIGNvbnN0IGxpc3RDb250ZXh0ID0gdXNlQ29udGV4dChTdXNwZW5zZUxpc3RDb250ZXh0KTtcbiAgY29uc3QgW3JlZ2lzdHJ5LCBzZXRSZWdpc3RyeV0gPSBjcmVhdGVTaWduYWwoW10pO1xuICBpZiAobGlzdENvbnRleHQpIHtcbiAgICBzaG93ID0gbGlzdENvbnRleHQucmVnaXN0ZXIoY3JlYXRlTWVtbygoKSA9PiB3cmFwcGVyKCkoKS5pbkZhbGxiYWNrKSk7XG4gIH1cbiAgY29uc3QgcmVzb2x2ZWQgPSBjcmVhdGVNZW1vKHByZXYgPT4ge1xuICAgIGNvbnN0IHJldmVhbCA9IHByb3BzLnJldmVhbE9yZGVyLFxuICAgICAgdGFpbCA9IHByb3BzLnRhaWwsXG4gICAgICB7XG4gICAgICAgIHNob3dDb250ZW50ID0gdHJ1ZSxcbiAgICAgICAgc2hvd0ZhbGxiYWNrID0gdHJ1ZVxuICAgICAgfSA9IHNob3cgPyBzaG93KCkgOiB7fSxcbiAgICAgIHJlZyA9IHJlZ2lzdHJ5KCksXG4gICAgICByZXZlcnNlID0gcmV2ZWFsID09PSBcImJhY2t3YXJkc1wiO1xuICAgIGlmIChyZXZlYWwgPT09IFwidG9nZXRoZXJcIikge1xuICAgICAgY29uc3QgYWxsID0gcmVnLmV2ZXJ5KGluRmFsbGJhY2sgPT4gIWluRmFsbGJhY2soKSk7XG4gICAgICBjb25zdCByZXMgPSByZWcubWFwKCgpID0+ICh7XG4gICAgICAgIHNob3dDb250ZW50OiBhbGwgJiYgc2hvd0NvbnRlbnQsXG4gICAgICAgIHNob3dGYWxsYmFja1xuICAgICAgfSkpO1xuICAgICAgcmVzLmluRmFsbGJhY2sgPSAhYWxsO1xuICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG4gICAgbGV0IHN0b3AgPSBmYWxzZTtcbiAgICBsZXQgaW5GYWxsYmFjayA9IHByZXYuaW5GYWxsYmFjaztcbiAgICBjb25zdCByZXMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcmVnLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBjb25zdCBuID0gcmV2ZXJzZSA/IGxlbiAtIGkgLSAxIDogaSxcbiAgICAgICAgcyA9IHJlZ1tuXSgpO1xuICAgICAgaWYgKCFzdG9wICYmICFzKSB7XG4gICAgICAgIHJlc1tuXSA9IHtcbiAgICAgICAgICBzaG93Q29udGVudCxcbiAgICAgICAgICBzaG93RmFsbGJhY2tcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5leHQgPSAhc3RvcDtcbiAgICAgICAgaWYgKG5leHQpIGluRmFsbGJhY2sgPSB0cnVlO1xuICAgICAgICByZXNbbl0gPSB7XG4gICAgICAgICAgc2hvd0NvbnRlbnQ6IG5leHQsXG4gICAgICAgICAgc2hvd0ZhbGxiYWNrOiAhdGFpbCB8fCBuZXh0ICYmIHRhaWwgPT09IFwiY29sbGFwc2VkXCIgPyBzaG93RmFsbGJhY2sgOiBmYWxzZVxuICAgICAgICB9O1xuICAgICAgICBzdG9wID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFzdG9wKSBpbkZhbGxiYWNrID0gZmFsc2U7XG4gICAgcmVzLmluRmFsbGJhY2sgPSBpbkZhbGxiYWNrO1xuICAgIHJldHVybiByZXM7XG4gIH0sIHtcbiAgICBpbkZhbGxiYWNrOiBmYWxzZVxuICB9KTtcbiAgc2V0V3JhcHBlcigoKSA9PiByZXNvbHZlZCk7XG4gIHJldHVybiBjcmVhdGVDb21wb25lbnQoU3VzcGVuc2VMaXN0Q29udGV4dC5Qcm92aWRlciwge1xuICAgIHZhbHVlOiB7XG4gICAgICByZWdpc3RlcjogaW5GYWxsYmFjayA9PiB7XG4gICAgICAgIGxldCBpbmRleDtcbiAgICAgICAgc2V0UmVnaXN0cnkocmVnaXN0cnkgPT4ge1xuICAgICAgICAgIGluZGV4ID0gcmVnaXN0cnkubGVuZ3RoO1xuICAgICAgICAgIHJldHVybiBbLi4ucmVnaXN0cnksIGluRmFsbGJhY2tdO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4gcmVzb2x2ZWQoKVtpbmRleF0sIHVuZGVmaW5lZCwge1xuICAgICAgICAgIGVxdWFsczogc3VzcGVuc2VMaXN0RXF1YWxzXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgZ2V0IGNoaWxkcmVuKCkge1xuICAgICAgcmV0dXJuIHByb3BzLmNoaWxkcmVuO1xuICAgIH1cbiAgfSk7XG59XG5mdW5jdGlvbiBTdXNwZW5zZShwcm9wcykge1xuICBsZXQgY291bnRlciA9IDAsXG4gICAgc2hvdyxcbiAgICBjdHgsXG4gICAgcCxcbiAgICBmbGlja2VyLFxuICAgIGVycm9yO1xuICBjb25zdCBbaW5GYWxsYmFjaywgc2V0RmFsbGJhY2tdID0gY3JlYXRlU2lnbmFsKGZhbHNlKSxcbiAgICBTdXNwZW5zZUNvbnRleHQgPSBnZXRTdXNwZW5zZUNvbnRleHQoKSxcbiAgICBzdG9yZSA9IHtcbiAgICAgIGluY3JlbWVudDogKCkgPT4ge1xuICAgICAgICBpZiAoKytjb3VudGVyID09PSAxKSBzZXRGYWxsYmFjayh0cnVlKTtcbiAgICAgIH0sXG4gICAgICBkZWNyZW1lbnQ6ICgpID0+IHtcbiAgICAgICAgaWYgKC0tY291bnRlciA9PT0gMCkgc2V0RmFsbGJhY2soZmFsc2UpO1xuICAgICAgfSxcbiAgICAgIGluRmFsbGJhY2ssXG4gICAgICBlZmZlY3RzOiBbXSxcbiAgICAgIHJlc29sdmVkOiBmYWxzZVxuICAgIH0sXG4gICAgb3duZXIgPSBnZXRPd25lcigpO1xuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgc2hhcmVkQ29uZmlnLmxvYWQpIHtcbiAgICBjb25zdCBrZXkgPSBzaGFyZWRDb25maWcuZ2V0Q29udGV4dElkKCk7XG4gICAgbGV0IHJlZiA9IHNoYXJlZENvbmZpZy5sb2FkKGtleSk7XG4gICAgaWYgKHJlZikge1xuICAgICAgaWYgKHR5cGVvZiByZWYgIT09IFwib2JqZWN0XCIgfHwgcmVmLnMgIT09IDEpIHAgPSByZWY7ZWxzZSBzaGFyZWRDb25maWcuZ2F0aGVyKGtleSk7XG4gICAgfVxuICAgIGlmIChwICYmIHAgIT09IFwiJCRmXCIpIHtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCwge1xuICAgICAgICBlcXVhbHM6IGZhbHNlXG4gICAgICB9KTtcbiAgICAgIGZsaWNrZXIgPSBzO1xuICAgICAgcC50aGVuKCgpID0+IHtcbiAgICAgICAgaWYgKHNoYXJlZENvbmZpZy5kb25lKSByZXR1cm4gc2V0KCk7XG4gICAgICAgIHNoYXJlZENvbmZpZy5nYXRoZXIoa2V5KTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoY3R4KTtcbiAgICAgICAgc2V0KCk7XG4gICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KCk7XG4gICAgICB9LCBlcnIgPT4ge1xuICAgICAgICBlcnJvciA9IGVycjtcbiAgICAgICAgc2V0KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgY29uc3QgbGlzdENvbnRleHQgPSB1c2VDb250ZXh0KFN1c3BlbnNlTGlzdENvbnRleHQpO1xuICBpZiAobGlzdENvbnRleHQpIHNob3cgPSBsaXN0Q29udGV4dC5yZWdpc3RlcihzdG9yZS5pbkZhbGxiYWNrKTtcbiAgbGV0IGRpc3Bvc2U7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlICYmIGRpc3Bvc2UoKSk7XG4gIHJldHVybiBjcmVhdGVDb21wb25lbnQoU3VzcGVuc2VDb250ZXh0LlByb3ZpZGVyLCB7XG4gICAgdmFsdWU6IHN0b3JlLFxuICAgIGdldCBjaGlsZHJlbigpIHtcbiAgICAgIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtcbiAgICAgICAgY3R4ID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICAgIGlmIChmbGlja2VyKSB7XG4gICAgICAgICAgZmxpY2tlcigpO1xuICAgICAgICAgIHJldHVybiBmbGlja2VyID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjdHggJiYgcCA9PT0gXCIkJGZcIikgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgICAgY29uc3QgcmVuZGVyZWQgPSBjcmVhdGVNZW1vKCgpID0+IHByb3BzLmNoaWxkcmVuKTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8ocHJldiA9PiB7XG4gICAgICAgICAgY29uc3QgaW5GYWxsYmFjayA9IHN0b3JlLmluRmFsbGJhY2soKSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc2hvd0NvbnRlbnQgPSB0cnVlLFxuICAgICAgICAgICAgICBzaG93RmFsbGJhY2sgPSB0cnVlXG4gICAgICAgICAgICB9ID0gc2hvdyA/IHNob3coKSA6IHt9O1xuICAgICAgICAgIGlmICgoIWluRmFsbGJhY2sgfHwgcCAmJiBwICE9PSBcIiQkZlwiKSAmJiBzaG93Q29udGVudCkge1xuICAgICAgICAgICAgc3RvcmUucmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgZGlzcG9zZSAmJiBkaXNwb3NlKCk7XG4gICAgICAgICAgICBkaXNwb3NlID0gY3R4ID0gcCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VtZUVmZmVjdHMoc3RvcmUuZWZmZWN0cyk7XG4gICAgICAgICAgICByZXR1cm4gcmVuZGVyZWQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFzaG93RmFsbGJhY2spIHJldHVybjtcbiAgICAgICAgICBpZiAoZGlzcG9zZSkgcmV0dXJuIHByZXY7XG4gICAgICAgICAgcmV0dXJuIGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZSA9IGRpc3Bvc2VyO1xuICAgICAgICAgICAgaWYgKGN0eCkge1xuICAgICAgICAgICAgICBzZXRIeWRyYXRlQ29udGV4dCh7XG4gICAgICAgICAgICAgICAgaWQ6IGN0eC5pZCArIFwiRlwiLFxuICAgICAgICAgICAgICAgIGNvdW50OiAwXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBjdHggPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcHJvcHMuZmFsbGJhY2s7XG4gICAgICAgICAgfSwgb3duZXIpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG59XG5cbmNvbnN0IERFViA9IHtcbiAgaG9va3M6IERldkhvb2tzLFxuICB3cml0ZVNpZ25hbCxcbiAgcmVnaXN0ZXJHcmFwaFxufSA7XG5pZiAoZ2xvYmFsVGhpcykge1xuICBpZiAoIWdsb2JhbFRoaXMuU29saWQkJCkgZ2xvYmFsVGhpcy5Tb2xpZCQkID0gdHJ1ZTtlbHNlIGNvbnNvbGUud2FybihcIllvdSBhcHBlYXIgdG8gaGF2ZSBtdWx0aXBsZSBpbnN0YW5jZXMgb2YgU29saWQuIFRoaXMgY2FuIGxlYWQgdG8gdW5leHBlY3RlZCBiZWhhdmlvci5cIik7XG59XG5cbmV4cG9ydCB7ICRERVZDT01QLCAkUFJPWFksICRUUkFDSywgREVWLCBFcnJvckJvdW5kYXJ5LCBGb3IsIEluZGV4LCBNYXRjaCwgU2hvdywgU3VzcGVuc2UsIFN1c3BlbnNlTGlzdCwgU3dpdGNoLCBiYXRjaCwgY2FuY2VsQ2FsbGJhY2ssIGNhdGNoRXJyb3IsIGNoaWxkcmVuLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZUNvbXB1dGVkLCBjcmVhdGVDb250ZXh0LCBjcmVhdGVEZWZlcnJlZCwgY3JlYXRlRWZmZWN0LCBjcmVhdGVNZW1vLCBjcmVhdGVSZWFjdGlvbiwgY3JlYXRlUmVuZGVyRWZmZWN0LCBjcmVhdGVSZXNvdXJjZSwgY3JlYXRlUm9vdCwgY3JlYXRlU2VsZWN0b3IsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlVW5pcXVlSWQsIGVuYWJsZUV4dGVybmFsU291cmNlLCBlbmFibGVIeWRyYXRpb24sIGVuYWJsZVNjaGVkdWxpbmcsIGVxdWFsRm4sIGZyb20sIGdldExpc3RlbmVyLCBnZXRPd25lciwgaW5kZXhBcnJheSwgbGF6eSwgbWFwQXJyYXksIG1lcmdlUHJvcHMsIG9ic2VydmFibGUsIG9uLCBvbkNsZWFudXAsIG9uRXJyb3IsIG9uTW91bnQsIHJlcXVlc3RDYWxsYmFjaywgcmVzZXRFcnJvckJvdW5kYXJpZXMsIHJ1bldpdGhPd25lciwgc2hhcmVkQ29uZmlnLCBzcGxpdFByb3BzLCBzdGFydFRyYW5zaXRpb24sIHVudHJhY2ssIHVzZUNvbnRleHQsIHVzZVRyYW5zaXRpb24gfTtcbiIsImltcG9ydCB7IGNyZWF0ZU1lbW8sIGNyZWF0ZVJvb3QsIGNyZWF0ZVJlbmRlckVmZmVjdCwgdW50cmFjaywgc2hhcmVkQ29uZmlnLCBlbmFibGVIeWRyYXRpb24sIGdldE93bmVyLCBjcmVhdGVFZmZlY3QsIHJ1bldpdGhPd25lciwgY3JlYXRlU2lnbmFsLCBvbkNsZWFudXAsICRERVZDT01QLCBzcGxpdFByb3BzIH0gZnJvbSAnc29saWQtanMnO1xuZXhwb3J0IHsgRXJyb3JCb3VuZGFyeSwgRm9yLCBJbmRleCwgTWF0Y2gsIFNob3csIFN1c3BlbnNlLCBTdXNwZW5zZUxpc3QsIFN3aXRjaCwgY3JlYXRlQ29tcG9uZW50LCBjcmVhdGVSZW5kZXJFZmZlY3QgYXMgZWZmZWN0LCBnZXRPd25lciwgbWVyZ2VQcm9wcywgdW50cmFjayB9IGZyb20gJ3NvbGlkLWpzJztcblxuY29uc3QgYm9vbGVhbnMgPSBbXCJhbGxvd2Z1bGxzY3JlZW5cIiwgXCJhc3luY1wiLCBcImF1dG9mb2N1c1wiLCBcImF1dG9wbGF5XCIsIFwiY2hlY2tlZFwiLCBcImNvbnRyb2xzXCIsIFwiZGVmYXVsdFwiLCBcImRpc2FibGVkXCIsIFwiZm9ybW5vdmFsaWRhdGVcIiwgXCJoaWRkZW5cIiwgXCJpbmRldGVybWluYXRlXCIsIFwiaW5lcnRcIiwgXCJpc21hcFwiLCBcImxvb3BcIiwgXCJtdWx0aXBsZVwiLCBcIm11dGVkXCIsIFwibm9tb2R1bGVcIiwgXCJub3ZhbGlkYXRlXCIsIFwib3BlblwiLCBcInBsYXlzaW5saW5lXCIsIFwicmVhZG9ubHlcIiwgXCJyZXF1aXJlZFwiLCBcInJldmVyc2VkXCIsIFwic2VhbWxlc3NcIiwgXCJzZWxlY3RlZFwiXTtcbmNvbnN0IFByb3BlcnRpZXMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJjbGFzc05hbWVcIiwgXCJ2YWx1ZVwiLCBcInJlYWRPbmx5XCIsIFwibm9WYWxpZGF0ZVwiLCBcImZvcm1Ob1ZhbGlkYXRlXCIsIFwiaXNNYXBcIiwgXCJub01vZHVsZVwiLCBcInBsYXlzSW5saW5lXCIsIC4uLmJvb2xlYW5zXSk7XG5jb25zdCBDaGlsZFByb3BlcnRpZXMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJpbm5lckhUTUxcIiwgXCJ0ZXh0Q29udGVudFwiLCBcImlubmVyVGV4dFwiLCBcImNoaWxkcmVuXCJdKTtcbmNvbnN0IEFsaWFzZXMgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmFzc2lnbihPYmplY3QuY3JlYXRlKG51bGwpLCB7XG4gIGNsYXNzTmFtZTogXCJjbGFzc1wiLFxuICBodG1sRm9yOiBcImZvclwiXG59KTtcbmNvbnN0IFByb3BBbGlhc2VzID0gLyojX19QVVJFX18qL09iamVjdC5hc3NpZ24oT2JqZWN0LmNyZWF0ZShudWxsKSwge1xuICBjbGFzczogXCJjbGFzc05hbWVcIixcbiAgbm92YWxpZGF0ZToge1xuICAgICQ6IFwibm9WYWxpZGF0ZVwiLFxuICAgIEZPUk06IDFcbiAgfSxcbiAgZm9ybW5vdmFsaWRhdGU6IHtcbiAgICAkOiBcImZvcm1Ob1ZhbGlkYXRlXCIsXG4gICAgQlVUVE9OOiAxLFxuICAgIElOUFVUOiAxXG4gIH0sXG4gIGlzbWFwOiB7XG4gICAgJDogXCJpc01hcFwiLFxuICAgIElNRzogMVxuICB9LFxuICBub21vZHVsZToge1xuICAgICQ6IFwibm9Nb2R1bGVcIixcbiAgICBTQ1JJUFQ6IDFcbiAgfSxcbiAgcGxheXNpbmxpbmU6IHtcbiAgICAkOiBcInBsYXlzSW5saW5lXCIsXG4gICAgVklERU86IDFcbiAgfSxcbiAgcmVhZG9ubHk6IHtcbiAgICAkOiBcInJlYWRPbmx5XCIsXG4gICAgSU5QVVQ6IDEsXG4gICAgVEVYVEFSRUE6IDFcbiAgfVxufSk7XG5mdW5jdGlvbiBnZXRQcm9wQWxpYXMocHJvcCwgdGFnTmFtZSkge1xuICBjb25zdCBhID0gUHJvcEFsaWFzZXNbcHJvcF07XG4gIHJldHVybiB0eXBlb2YgYSA9PT0gXCJvYmplY3RcIiA/IGFbdGFnTmFtZV0gPyBhW1wiJFwiXSA6IHVuZGVmaW5lZCA6IGE7XG59XG5jb25zdCBEZWxlZ2F0ZWRFdmVudHMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJiZWZvcmVpbnB1dFwiLCBcImNsaWNrXCIsIFwiZGJsY2xpY2tcIiwgXCJjb250ZXh0bWVudVwiLCBcImZvY3VzaW5cIiwgXCJmb2N1c291dFwiLCBcImlucHV0XCIsIFwia2V5ZG93blwiLCBcImtleXVwXCIsIFwibW91c2Vkb3duXCIsIFwibW91c2Vtb3ZlXCIsIFwibW91c2VvdXRcIiwgXCJtb3VzZW92ZXJcIiwgXCJtb3VzZXVwXCIsIFwicG9pbnRlcmRvd25cIiwgXCJwb2ludGVybW92ZVwiLCBcInBvaW50ZXJvdXRcIiwgXCJwb2ludGVyb3ZlclwiLCBcInBvaW50ZXJ1cFwiLCBcInRvdWNoZW5kXCIsIFwidG91Y2htb3ZlXCIsIFwidG91Y2hzdGFydFwiXSk7XG5jb25zdCBTVkdFbGVtZW50cyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcblwiYWx0R2x5cGhcIiwgXCJhbHRHbHlwaERlZlwiLCBcImFsdEdseXBoSXRlbVwiLCBcImFuaW1hdGVcIiwgXCJhbmltYXRlQ29sb3JcIiwgXCJhbmltYXRlTW90aW9uXCIsIFwiYW5pbWF0ZVRyYW5zZm9ybVwiLCBcImNpcmNsZVwiLCBcImNsaXBQYXRoXCIsIFwiY29sb3ItcHJvZmlsZVwiLCBcImN1cnNvclwiLCBcImRlZnNcIiwgXCJkZXNjXCIsIFwiZWxsaXBzZVwiLCBcImZlQmxlbmRcIiwgXCJmZUNvbG9yTWF0cml4XCIsIFwiZmVDb21wb25lbnRUcmFuc2ZlclwiLCBcImZlQ29tcG9zaXRlXCIsIFwiZmVDb252b2x2ZU1hdHJpeFwiLCBcImZlRGlmZnVzZUxpZ2h0aW5nXCIsIFwiZmVEaXNwbGFjZW1lbnRNYXBcIiwgXCJmZURpc3RhbnRMaWdodFwiLCBcImZlRHJvcFNoYWRvd1wiLCBcImZlRmxvb2RcIiwgXCJmZUZ1bmNBXCIsIFwiZmVGdW5jQlwiLCBcImZlRnVuY0dcIiwgXCJmZUZ1bmNSXCIsIFwiZmVHYXVzc2lhbkJsdXJcIiwgXCJmZUltYWdlXCIsIFwiZmVNZXJnZVwiLCBcImZlTWVyZ2VOb2RlXCIsIFwiZmVNb3JwaG9sb2d5XCIsIFwiZmVPZmZzZXRcIiwgXCJmZVBvaW50TGlnaHRcIiwgXCJmZVNwZWN1bGFyTGlnaHRpbmdcIiwgXCJmZVNwb3RMaWdodFwiLCBcImZlVGlsZVwiLCBcImZlVHVyYnVsZW5jZVwiLCBcImZpbHRlclwiLCBcImZvbnRcIiwgXCJmb250LWZhY2VcIiwgXCJmb250LWZhY2UtZm9ybWF0XCIsIFwiZm9udC1mYWNlLW5hbWVcIiwgXCJmb250LWZhY2Utc3JjXCIsIFwiZm9udC1mYWNlLXVyaVwiLCBcImZvcmVpZ25PYmplY3RcIiwgXCJnXCIsIFwiZ2x5cGhcIiwgXCJnbHlwaFJlZlwiLCBcImhrZXJuXCIsIFwiaW1hZ2VcIiwgXCJsaW5lXCIsIFwibGluZWFyR3JhZGllbnRcIiwgXCJtYXJrZXJcIiwgXCJtYXNrXCIsIFwibWV0YWRhdGFcIiwgXCJtaXNzaW5nLWdseXBoXCIsIFwibXBhdGhcIiwgXCJwYXRoXCIsIFwicGF0dGVyblwiLCBcInBvbHlnb25cIiwgXCJwb2x5bGluZVwiLCBcInJhZGlhbEdyYWRpZW50XCIsIFwicmVjdFwiLFxuXCJzZXRcIiwgXCJzdG9wXCIsXG5cInN2Z1wiLCBcInN3aXRjaFwiLCBcInN5bWJvbFwiLCBcInRleHRcIiwgXCJ0ZXh0UGF0aFwiLFxuXCJ0cmVmXCIsIFwidHNwYW5cIiwgXCJ1c2VcIiwgXCJ2aWV3XCIsIFwidmtlcm5cIl0pO1xuY29uc3QgU1ZHTmFtZXNwYWNlID0ge1xuICB4bGluazogXCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCIsXG4gIHhtbDogXCJodHRwOi8vd3d3LnczLm9yZy9YTUwvMTk5OC9uYW1lc3BhY2VcIlxufTtcbmNvbnN0IERPTUVsZW1lbnRzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1wiaHRtbFwiLCBcImJhc2VcIiwgXCJoZWFkXCIsIFwibGlua1wiLCBcIm1ldGFcIiwgXCJzdHlsZVwiLCBcInRpdGxlXCIsIFwiYm9keVwiLCBcImFkZHJlc3NcIiwgXCJhcnRpY2xlXCIsIFwiYXNpZGVcIiwgXCJmb290ZXJcIiwgXCJoZWFkZXJcIiwgXCJtYWluXCIsIFwibmF2XCIsIFwic2VjdGlvblwiLCBcImJvZHlcIiwgXCJibG9ja3F1b3RlXCIsIFwiZGRcIiwgXCJkaXZcIiwgXCJkbFwiLCBcImR0XCIsIFwiZmlnY2FwdGlvblwiLCBcImZpZ3VyZVwiLCBcImhyXCIsIFwibGlcIiwgXCJvbFwiLCBcInBcIiwgXCJwcmVcIiwgXCJ1bFwiLCBcImFcIiwgXCJhYmJyXCIsIFwiYlwiLCBcImJkaVwiLCBcImJkb1wiLCBcImJyXCIsIFwiY2l0ZVwiLCBcImNvZGVcIiwgXCJkYXRhXCIsIFwiZGZuXCIsIFwiZW1cIiwgXCJpXCIsIFwia2JkXCIsIFwibWFya1wiLCBcInFcIiwgXCJycFwiLCBcInJ0XCIsIFwicnVieVwiLCBcInNcIiwgXCJzYW1wXCIsIFwic21hbGxcIiwgXCJzcGFuXCIsIFwic3Ryb25nXCIsIFwic3ViXCIsIFwic3VwXCIsIFwidGltZVwiLCBcInVcIiwgXCJ2YXJcIiwgXCJ3YnJcIiwgXCJhcmVhXCIsIFwiYXVkaW9cIiwgXCJpbWdcIiwgXCJtYXBcIiwgXCJ0cmFja1wiLCBcInZpZGVvXCIsIFwiZW1iZWRcIiwgXCJpZnJhbWVcIiwgXCJvYmplY3RcIiwgXCJwYXJhbVwiLCBcInBpY3R1cmVcIiwgXCJwb3J0YWxcIiwgXCJzb3VyY2VcIiwgXCJzdmdcIiwgXCJtYXRoXCIsIFwiY2FudmFzXCIsIFwibm9zY3JpcHRcIiwgXCJzY3JpcHRcIiwgXCJkZWxcIiwgXCJpbnNcIiwgXCJjYXB0aW9uXCIsIFwiY29sXCIsIFwiY29sZ3JvdXBcIiwgXCJ0YWJsZVwiLCBcInRib2R5XCIsIFwidGRcIiwgXCJ0Zm9vdFwiLCBcInRoXCIsIFwidGhlYWRcIiwgXCJ0clwiLCBcImJ1dHRvblwiLCBcImRhdGFsaXN0XCIsIFwiZmllbGRzZXRcIiwgXCJmb3JtXCIsIFwiaW5wdXRcIiwgXCJsYWJlbFwiLCBcImxlZ2VuZFwiLCBcIm1ldGVyXCIsIFwib3B0Z3JvdXBcIiwgXCJvcHRpb25cIiwgXCJvdXRwdXRcIiwgXCJwcm9ncmVzc1wiLCBcInNlbGVjdFwiLCBcInRleHRhcmVhXCIsIFwiZGV0YWlsc1wiLCBcImRpYWxvZ1wiLCBcIm1lbnVcIiwgXCJzdW1tYXJ5XCIsIFwiZGV0YWlsc1wiLCBcInNsb3RcIiwgXCJ0ZW1wbGF0ZVwiLCBcImFjcm9ueW1cIiwgXCJhcHBsZXRcIiwgXCJiYXNlZm9udFwiLCBcImJnc291bmRcIiwgXCJiaWdcIiwgXCJibGlua1wiLCBcImNlbnRlclwiLCBcImNvbnRlbnRcIiwgXCJkaXJcIiwgXCJmb250XCIsIFwiZnJhbWVcIiwgXCJmcmFtZXNldFwiLCBcImhncm91cFwiLCBcImltYWdlXCIsIFwia2V5Z2VuXCIsIFwibWFycXVlZVwiLCBcIm1lbnVpdGVtXCIsIFwibm9iclwiLCBcIm5vZW1iZWRcIiwgXCJub2ZyYW1lc1wiLCBcInBsYWludGV4dFwiLCBcInJiXCIsIFwicnRjXCIsIFwic2hhZG93XCIsIFwic3BhY2VyXCIsIFwic3RyaWtlXCIsIFwidHRcIiwgXCJ4bXBcIiwgXCJhXCIsIFwiYWJiclwiLCBcImFjcm9ueW1cIiwgXCJhZGRyZXNzXCIsIFwiYXBwbGV0XCIsIFwiYXJlYVwiLCBcImFydGljbGVcIiwgXCJhc2lkZVwiLCBcImF1ZGlvXCIsIFwiYlwiLCBcImJhc2VcIiwgXCJiYXNlZm9udFwiLCBcImJkaVwiLCBcImJkb1wiLCBcImJnc291bmRcIiwgXCJiaWdcIiwgXCJibGlua1wiLCBcImJsb2NrcXVvdGVcIiwgXCJib2R5XCIsIFwiYnJcIiwgXCJidXR0b25cIiwgXCJjYW52YXNcIiwgXCJjYXB0aW9uXCIsIFwiY2VudGVyXCIsIFwiY2l0ZVwiLCBcImNvZGVcIiwgXCJjb2xcIiwgXCJjb2xncm91cFwiLCBcImNvbnRlbnRcIiwgXCJkYXRhXCIsIFwiZGF0YWxpc3RcIiwgXCJkZFwiLCBcImRlbFwiLCBcImRldGFpbHNcIiwgXCJkZm5cIiwgXCJkaWFsb2dcIiwgXCJkaXJcIiwgXCJkaXZcIiwgXCJkbFwiLCBcImR0XCIsIFwiZW1cIiwgXCJlbWJlZFwiLCBcImZpZWxkc2V0XCIsIFwiZmlnY2FwdGlvblwiLCBcImZpZ3VyZVwiLCBcImZvbnRcIiwgXCJmb290ZXJcIiwgXCJmb3JtXCIsIFwiZnJhbWVcIiwgXCJmcmFtZXNldFwiLCBcImhlYWRcIiwgXCJoZWFkZXJcIiwgXCJoZ3JvdXBcIiwgXCJoclwiLCBcImh0bWxcIiwgXCJpXCIsIFwiaWZyYW1lXCIsIFwiaW1hZ2VcIiwgXCJpbWdcIiwgXCJpbnB1dFwiLCBcImluc1wiLCBcImtiZFwiLCBcImtleWdlblwiLCBcImxhYmVsXCIsIFwibGVnZW5kXCIsIFwibGlcIiwgXCJsaW5rXCIsIFwibWFpblwiLCBcIm1hcFwiLCBcIm1hcmtcIiwgXCJtYXJxdWVlXCIsIFwibWVudVwiLCBcIm1lbnVpdGVtXCIsIFwibWV0YVwiLCBcIm1ldGVyXCIsIFwibmF2XCIsIFwibm9iclwiLCBcIm5vZW1iZWRcIiwgXCJub2ZyYW1lc1wiLCBcIm5vc2NyaXB0XCIsIFwib2JqZWN0XCIsIFwib2xcIiwgXCJvcHRncm91cFwiLCBcIm9wdGlvblwiLCBcIm91dHB1dFwiLCBcInBcIiwgXCJwYXJhbVwiLCBcInBpY3R1cmVcIiwgXCJwbGFpbnRleHRcIiwgXCJwb3J0YWxcIiwgXCJwcmVcIiwgXCJwcm9ncmVzc1wiLCBcInFcIiwgXCJyYlwiLCBcInJwXCIsIFwicnRcIiwgXCJydGNcIiwgXCJydWJ5XCIsIFwic1wiLCBcInNhbXBcIiwgXCJzY3JpcHRcIiwgXCJzZWN0aW9uXCIsIFwic2VsZWN0XCIsIFwic2hhZG93XCIsIFwic2xvdFwiLCBcInNtYWxsXCIsIFwic291cmNlXCIsIFwic3BhY2VyXCIsIFwic3BhblwiLCBcInN0cmlrZVwiLCBcInN0cm9uZ1wiLCBcInN0eWxlXCIsIFwic3ViXCIsIFwic3VtbWFyeVwiLCBcInN1cFwiLCBcInRhYmxlXCIsIFwidGJvZHlcIiwgXCJ0ZFwiLCBcInRlbXBsYXRlXCIsIFwidGV4dGFyZWFcIiwgXCJ0Zm9vdFwiLCBcInRoXCIsIFwidGhlYWRcIiwgXCJ0aW1lXCIsIFwidGl0bGVcIiwgXCJ0clwiLCBcInRyYWNrXCIsIFwidHRcIiwgXCJ1XCIsIFwidWxcIiwgXCJ2YXJcIiwgXCJ2aWRlb1wiLCBcIndiclwiLCBcInhtcFwiLCBcImlucHV0XCIsIFwiaDFcIiwgXCJoMlwiLCBcImgzXCIsIFwiaDRcIiwgXCJoNVwiLCBcImg2XCJdKTtcblxuY29uc3QgbWVtbyA9IGZuID0+IGNyZWF0ZU1lbW8oKCkgPT4gZm4oKSk7XG5cbmZ1bmN0aW9uIHJlY29uY2lsZUFycmF5cyhwYXJlbnROb2RlLCBhLCBiKSB7XG4gIGxldCBiTGVuZ3RoID0gYi5sZW5ndGgsXG4gICAgYUVuZCA9IGEubGVuZ3RoLFxuICAgIGJFbmQgPSBiTGVuZ3RoLFxuICAgIGFTdGFydCA9IDAsXG4gICAgYlN0YXJ0ID0gMCxcbiAgICBhZnRlciA9IGFbYUVuZCAtIDFdLm5leHRTaWJsaW5nLFxuICAgIG1hcCA9IG51bGw7XG4gIHdoaWxlIChhU3RhcnQgPCBhRW5kIHx8IGJTdGFydCA8IGJFbmQpIHtcbiAgICBpZiAoYVthU3RhcnRdID09PSBiW2JTdGFydF0pIHtcbiAgICAgIGFTdGFydCsrO1xuICAgICAgYlN0YXJ0Kys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgd2hpbGUgKGFbYUVuZCAtIDFdID09PSBiW2JFbmQgLSAxXSkge1xuICAgICAgYUVuZC0tO1xuICAgICAgYkVuZC0tO1xuICAgIH1cbiAgICBpZiAoYUVuZCA9PT0gYVN0YXJ0KSB7XG4gICAgICBjb25zdCBub2RlID0gYkVuZCA8IGJMZW5ndGggPyBiU3RhcnQgPyBiW2JTdGFydCAtIDFdLm5leHRTaWJsaW5nIDogYltiRW5kIC0gYlN0YXJ0XSA6IGFmdGVyO1xuICAgICAgd2hpbGUgKGJTdGFydCA8IGJFbmQpIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKGJFbmQgPT09IGJTdGFydCkge1xuICAgICAgd2hpbGUgKGFTdGFydCA8IGFFbmQpIHtcbiAgICAgICAgaWYgKCFtYXAgfHwgIW1hcC5oYXMoYVthU3RhcnRdKSkgYVthU3RhcnRdLnJlbW92ZSgpO1xuICAgICAgICBhU3RhcnQrKztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGFbYVN0YXJ0XSA9PT0gYltiRW5kIC0gMV0gJiYgYltiU3RhcnRdID09PSBhW2FFbmQgLSAxXSkge1xuICAgICAgY29uc3Qgbm9kZSA9IGFbLS1hRW5kXS5uZXh0U2libGluZztcbiAgICAgIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBhW2FTdGFydCsrXS5uZXh0U2libGluZyk7XG4gICAgICBwYXJlbnROb2RlLmluc2VydEJlZm9yZShiWy0tYkVuZF0sIG5vZGUpO1xuICAgICAgYVthRW5kXSA9IGJbYkVuZF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghbWFwKSB7XG4gICAgICAgIG1hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgbGV0IGkgPSBiU3RhcnQ7XG4gICAgICAgIHdoaWxlIChpIDwgYkVuZCkgbWFwLnNldChiW2ldLCBpKyspO1xuICAgICAgfVxuICAgICAgY29uc3QgaW5kZXggPSBtYXAuZ2V0KGFbYVN0YXJ0XSk7XG4gICAgICBpZiAoaW5kZXggIT0gbnVsbCkge1xuICAgICAgICBpZiAoYlN0YXJ0IDwgaW5kZXggJiYgaW5kZXggPCBiRW5kKSB7XG4gICAgICAgICAgbGV0IGkgPSBhU3RhcnQsXG4gICAgICAgICAgICBzZXF1ZW5jZSA9IDEsXG4gICAgICAgICAgICB0O1xuICAgICAgICAgIHdoaWxlICgrK2kgPCBhRW5kICYmIGkgPCBiRW5kKSB7XG4gICAgICAgICAgICBpZiAoKHQgPSBtYXAuZ2V0KGFbaV0pKSA9PSBudWxsIHx8IHQgIT09IGluZGV4ICsgc2VxdWVuY2UpIGJyZWFrO1xuICAgICAgICAgICAgc2VxdWVuY2UrKztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNlcXVlbmNlID4gaW5kZXggLSBiU3RhcnQpIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBhW2FTdGFydF07XG4gICAgICAgICAgICB3aGlsZSAoYlN0YXJ0IDwgaW5kZXgpIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBub2RlKTtcbiAgICAgICAgICB9IGVsc2UgcGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoYltiU3RhcnQrK10sIGFbYVN0YXJ0KytdKTtcbiAgICAgICAgfSBlbHNlIGFTdGFydCsrO1xuICAgICAgfSBlbHNlIGFbYVN0YXJ0KytdLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxufVxuXG5jb25zdCAkJEVWRU5UUyA9IFwiXyREWF9ERUxFR0FURVwiO1xuZnVuY3Rpb24gcmVuZGVyKGNvZGUsIGVsZW1lbnQsIGluaXQsIG9wdGlvbnMgPSB7fSkge1xuICBpZiAoIWVsZW1lbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYGVsZW1lbnRgIHBhc3NlZCB0byBgcmVuZGVyKC4uLiwgZWxlbWVudClgIGRvZXNuJ3QgZXhpc3QuIE1ha2Ugc3VyZSBgZWxlbWVudGAgZXhpc3RzIGluIHRoZSBkb2N1bWVudC5cIik7XG4gIH1cbiAgbGV0IGRpc3Bvc2VyO1xuICBjcmVhdGVSb290KGRpc3Bvc2UgPT4ge1xuICAgIGRpc3Bvc2VyID0gZGlzcG9zZTtcbiAgICBlbGVtZW50ID09PSBkb2N1bWVudCA/IGNvZGUoKSA6IGluc2VydChlbGVtZW50LCBjb2RlKCksIGVsZW1lbnQuZmlyc3RDaGlsZCA/IG51bGwgOiB1bmRlZmluZWQsIGluaXQpO1xuICB9LCBvcHRpb25zLm93bmVyKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBkaXNwb3NlcigpO1xuICAgIGVsZW1lbnQudGV4dENvbnRlbnQgPSBcIlwiO1xuICB9O1xufVxuZnVuY3Rpb24gdGVtcGxhdGUoaHRtbCwgaXNJbXBvcnROb2RlLCBpc1NWRywgaXNNYXRoTUwpIHtcbiAgbGV0IG5vZGU7XG4gIGNvbnN0IGNyZWF0ZSA9ICgpID0+IHtcbiAgICBpZiAoaXNIeWRyYXRpbmcoKSkgdGhyb3cgbmV3IEVycm9yKFwiRmFpbGVkIGF0dGVtcHQgdG8gY3JlYXRlIG5ldyBET00gZWxlbWVudHMgZHVyaW5nIGh5ZHJhdGlvbi4gQ2hlY2sgdGhhdCB0aGUgbGlicmFyaWVzIHlvdSBhcmUgdXNpbmcgc3VwcG9ydCBoeWRyYXRpb24uXCIpO1xuICAgIGNvbnN0IHQgPSBpc01hdGhNTCA/IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzE5OTgvTWF0aC9NYXRoTUxcIiwgXCJ0ZW1wbGF0ZVwiKSA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiKTtcbiAgICB0LmlubmVySFRNTCA9IGh0bWw7XG4gICAgcmV0dXJuIGlzU1ZHID8gdC5jb250ZW50LmZpcnN0Q2hpbGQuZmlyc3RDaGlsZCA6IGlzTWF0aE1MID8gdC5maXJzdENoaWxkIDogdC5jb250ZW50LmZpcnN0Q2hpbGQ7XG4gIH07XG4gIGNvbnN0IGZuID0gaXNJbXBvcnROb2RlID8gKCkgPT4gdW50cmFjaygoKSA9PiBkb2N1bWVudC5pbXBvcnROb2RlKG5vZGUgfHwgKG5vZGUgPSBjcmVhdGUoKSksIHRydWUpKSA6ICgpID0+IChub2RlIHx8IChub2RlID0gY3JlYXRlKCkpKS5jbG9uZU5vZGUodHJ1ZSk7XG4gIGZuLmNsb25lTm9kZSA9IGZuO1xuICByZXR1cm4gZm47XG59XG5mdW5jdGlvbiBkZWxlZ2F0ZUV2ZW50cyhldmVudE5hbWVzLCBkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudCkge1xuICBjb25zdCBlID0gZG9jdW1lbnRbJCRFVkVOVFNdIHx8IChkb2N1bWVudFskJEVWRU5UU10gPSBuZXcgU2V0KCkpO1xuICBmb3IgKGxldCBpID0gMCwgbCA9IGV2ZW50TmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgY29uc3QgbmFtZSA9IGV2ZW50TmFtZXNbaV07XG4gICAgaWYgKCFlLmhhcyhuYW1lKSkge1xuICAgICAgZS5hZGQobmFtZSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50SGFuZGxlcik7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBjbGVhckRlbGVnYXRlZEV2ZW50cyhkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudCkge1xuICBpZiAoZG9jdW1lbnRbJCRFVkVOVFNdKSB7XG4gICAgZm9yIChsZXQgbmFtZSBvZiBkb2N1bWVudFskJEVWRU5UU10ua2V5cygpKSBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50SGFuZGxlcik7XG4gICAgZGVsZXRlIGRvY3VtZW50WyQkRVZFTlRTXTtcbiAgfVxufVxuZnVuY3Rpb24gc2V0UHJvcGVydHkobm9kZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIG5vZGVbbmFtZV0gPSB2YWx1ZTtcbn1cbmZ1bmN0aW9uIHNldEF0dHJpYnV0ZShub2RlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlKG5hbWUpO2Vsc2Ugbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xufVxuZnVuY3Rpb24gc2V0QXR0cmlidXRlTlMobm9kZSwgbmFtZXNwYWNlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlTlMobmFtZXNwYWNlLCBuYW1lKTtlbHNlIG5vZGUuc2V0QXR0cmlidXRlTlMobmFtZXNwYWNlLCBuYW1lLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBzZXRCb29sQXR0cmlidXRlKG5vZGUsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICB2YWx1ZSA/IG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsIFwiXCIpIDogbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7XG59XG5mdW5jdGlvbiBjbGFzc05hbWUobm9kZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIGlmICh2YWx1ZSA9PSBudWxsKSBub2RlLnJlbW92ZUF0dHJpYnV0ZShcImNsYXNzXCIpO2Vsc2Ugbm9kZS5jbGFzc05hbWUgPSB2YWx1ZTtcbn1cbmZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXIobm9kZSwgbmFtZSwgaGFuZGxlciwgZGVsZWdhdGUpIHtcbiAgaWYgKGRlbGVnYXRlKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoaGFuZGxlcikpIHtcbiAgICAgIG5vZGVbYCQkJHtuYW1lfWBdID0gaGFuZGxlclswXTtcbiAgICAgIG5vZGVbYCQkJHtuYW1lfURhdGFgXSA9IGhhbmRsZXJbMV07XG4gICAgfSBlbHNlIG5vZGVbYCQkJHtuYW1lfWBdID0gaGFuZGxlcjtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGhhbmRsZXIpKSB7XG4gICAgY29uc3QgaGFuZGxlckZuID0gaGFuZGxlclswXTtcbiAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgaGFuZGxlclswXSA9IGUgPT4gaGFuZGxlckZuLmNhbGwobm9kZSwgaGFuZGxlclsxXSwgZSkpO1xuICB9IGVsc2Ugbm9kZS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGhhbmRsZXIsIHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIgJiYgaGFuZGxlcik7XG59XG5mdW5jdGlvbiBjbGFzc0xpc3Qobm9kZSwgdmFsdWUsIHByZXYgPSB7fSkge1xuICBjb25zdCBjbGFzc0tleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSB8fCB7fSksXG4gICAgcHJldktleXMgPSBPYmplY3Qua2V5cyhwcmV2KTtcbiAgbGV0IGksIGxlbjtcbiAgZm9yIChpID0gMCwgbGVuID0gcHJldktleXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBwcmV2S2V5c1tpXTtcbiAgICBpZiAoIWtleSB8fCBrZXkgPT09IFwidW5kZWZpbmVkXCIgfHwgdmFsdWVba2V5XSkgY29udGludWU7XG4gICAgdG9nZ2xlQ2xhc3NLZXkobm9kZSwga2V5LCBmYWxzZSk7XG4gICAgZGVsZXRlIHByZXZba2V5XTtcbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBjbGFzc0tleXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBjbGFzc0tleXNbaV0sXG4gICAgICBjbGFzc1ZhbHVlID0gISF2YWx1ZVtrZXldO1xuICAgIGlmICgha2V5IHx8IGtleSA9PT0gXCJ1bmRlZmluZWRcIiB8fCBwcmV2W2tleV0gPT09IGNsYXNzVmFsdWUgfHwgIWNsYXNzVmFsdWUpIGNvbnRpbnVlO1xuICAgIHRvZ2dsZUNsYXNzS2V5KG5vZGUsIGtleSwgdHJ1ZSk7XG4gICAgcHJldltrZXldID0gY2xhc3NWYWx1ZTtcbiAgfVxuICByZXR1cm4gcHJldjtcbn1cbmZ1bmN0aW9uIHN0eWxlKG5vZGUsIHZhbHVlLCBwcmV2KSB7XG4gIGlmICghdmFsdWUpIHJldHVybiBwcmV2ID8gc2V0QXR0cmlidXRlKG5vZGUsIFwic3R5bGVcIikgOiB2YWx1ZTtcbiAgY29uc3Qgbm9kZVN0eWxlID0gbm9kZS5zdHlsZTtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIG5vZGVTdHlsZS5jc3NUZXh0ID0gdmFsdWU7XG4gIHR5cGVvZiBwcmV2ID09PSBcInN0cmluZ1wiICYmIChub2RlU3R5bGUuY3NzVGV4dCA9IHByZXYgPSB1bmRlZmluZWQpO1xuICBwcmV2IHx8IChwcmV2ID0ge30pO1xuICB2YWx1ZSB8fCAodmFsdWUgPSB7fSk7XG4gIGxldCB2LCBzO1xuICBmb3IgKHMgaW4gcHJldikge1xuICAgIHZhbHVlW3NdID09IG51bGwgJiYgbm9kZVN0eWxlLnJlbW92ZVByb3BlcnR5KHMpO1xuICAgIGRlbGV0ZSBwcmV2W3NdO1xuICB9XG4gIGZvciAocyBpbiB2YWx1ZSkge1xuICAgIHYgPSB2YWx1ZVtzXTtcbiAgICBpZiAodiAhPT0gcHJldltzXSkge1xuICAgICAgbm9kZVN0eWxlLnNldFByb3BlcnR5KHMsIHYpO1xuICAgICAgcHJldltzXSA9IHY7XG4gICAgfVxuICB9XG4gIHJldHVybiBwcmV2O1xufVxuZnVuY3Rpb24gc3ByZWFkKG5vZGUsIHByb3BzID0ge30sIGlzU1ZHLCBza2lwQ2hpbGRyZW4pIHtcbiAgY29uc3QgcHJldlByb3BzID0ge307XG4gIGlmICghc2tpcENoaWxkcmVuKSB7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHByZXZQcm9wcy5jaGlsZHJlbiA9IGluc2VydEV4cHJlc3Npb24obm9kZSwgcHJvcHMuY2hpbGRyZW4sIHByZXZQcm9wcy5jaGlsZHJlbikpO1xuICB9XG4gIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiB0eXBlb2YgcHJvcHMucmVmID09PSBcImZ1bmN0aW9uXCIgJiYgdXNlKHByb3BzLnJlZiwgbm9kZSkpO1xuICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gYXNzaWduKG5vZGUsIHByb3BzLCBpc1NWRywgdHJ1ZSwgcHJldlByb3BzLCB0cnVlKSk7XG4gIHJldHVybiBwcmV2UHJvcHM7XG59XG5mdW5jdGlvbiBkeW5hbWljUHJvcGVydHkocHJvcHMsIGtleSkge1xuICBjb25zdCBzcmMgPSBwcm9wc1trZXldO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvcHMsIGtleSwge1xuICAgIGdldCgpIHtcbiAgICAgIHJldHVybiBzcmMoKTtcbiAgICB9LFxuICAgIGVudW1lcmFibGU6IHRydWVcbiAgfSk7XG4gIHJldHVybiBwcm9wcztcbn1cbmZ1bmN0aW9uIHVzZShmbiwgZWxlbWVudCwgYXJnKSB7XG4gIHJldHVybiB1bnRyYWNrKCgpID0+IGZuKGVsZW1lbnQsIGFyZykpO1xufVxuZnVuY3Rpb24gaW5zZXJ0KHBhcmVudCwgYWNjZXNzb3IsIG1hcmtlciwgaW5pdGlhbCkge1xuICBpZiAobWFya2VyICE9PSB1bmRlZmluZWQgJiYgIWluaXRpYWwpIGluaXRpYWwgPSBbXTtcbiAgaWYgKHR5cGVvZiBhY2Nlc3NvciAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm4gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIGFjY2Vzc29yLCBpbml0aWFsLCBtYXJrZXIpO1xuICBjcmVhdGVSZW5kZXJFZmZlY3QoY3VycmVudCA9PiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgYWNjZXNzb3IoKSwgY3VycmVudCwgbWFya2VyKSwgaW5pdGlhbCk7XG59XG5mdW5jdGlvbiBhc3NpZ24obm9kZSwgcHJvcHMsIGlzU1ZHLCBza2lwQ2hpbGRyZW4sIHByZXZQcm9wcyA9IHt9LCBza2lwUmVmID0gZmFsc2UpIHtcbiAgcHJvcHMgfHwgKHByb3BzID0ge30pO1xuICBmb3IgKGNvbnN0IHByb3AgaW4gcHJldlByb3BzKSB7XG4gICAgaWYgKCEocHJvcCBpbiBwcm9wcykpIHtcbiAgICAgIGlmIChwcm9wID09PSBcImNoaWxkcmVuXCIpIGNvbnRpbnVlO1xuICAgICAgcHJldlByb3BzW3Byb3BdID0gYXNzaWduUHJvcChub2RlLCBwcm9wLCBudWxsLCBwcmV2UHJvcHNbcHJvcF0sIGlzU1ZHLCBza2lwUmVmLCBwcm9wcyk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgcHJvcCBpbiBwcm9wcykge1xuICAgIGlmIChwcm9wID09PSBcImNoaWxkcmVuXCIpIHtcbiAgICAgIGlmICghc2tpcENoaWxkcmVuKSBpbnNlcnRFeHByZXNzaW9uKG5vZGUsIHByb3BzLmNoaWxkcmVuKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZSA9IHByb3BzW3Byb3BdO1xuICAgIHByZXZQcm9wc1twcm9wXSA9IGFzc2lnblByb3Aobm9kZSwgcHJvcCwgdmFsdWUsIHByZXZQcm9wc1twcm9wXSwgaXNTVkcsIHNraXBSZWYsIHByb3BzKTtcbiAgfVxufVxuZnVuY3Rpb24gaHlkcmF0ZSQxKGNvZGUsIGVsZW1lbnQsIG9wdGlvbnMgPSB7fSkge1xuICBpZiAoZ2xvYmFsVGhpcy5fJEhZLmRvbmUpIHJldHVybiByZW5kZXIoY29kZSwgZWxlbWVudCwgWy4uLmVsZW1lbnQuY2hpbGROb2Rlc10sIG9wdGlvbnMpO1xuICBzaGFyZWRDb25maWcuY29tcGxldGVkID0gZ2xvYmFsVGhpcy5fJEhZLmNvbXBsZXRlZDtcbiAgc2hhcmVkQ29uZmlnLmV2ZW50cyA9IGdsb2JhbFRoaXMuXyRIWS5ldmVudHM7XG4gIHNoYXJlZENvbmZpZy5sb2FkID0gaWQgPT4gZ2xvYmFsVGhpcy5fJEhZLnJbaWRdO1xuICBzaGFyZWRDb25maWcuaGFzID0gaWQgPT4gaWQgaW4gZ2xvYmFsVGhpcy5fJEhZLnI7XG4gIHNoYXJlZENvbmZpZy5nYXRoZXIgPSByb290ID0+IGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgcm9vdCk7XG4gIHNoYXJlZENvbmZpZy5yZWdpc3RyeSA9IG5ldyBNYXAoKTtcbiAgc2hhcmVkQ29uZmlnLmNvbnRleHQgPSB7XG4gICAgaWQ6IG9wdGlvbnMucmVuZGVySWQgfHwgXCJcIixcbiAgICBjb3VudDogMFxuICB9O1xuICB0cnkge1xuICAgIGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgb3B0aW9ucy5yZW5kZXJJZCk7XG4gICAgcmV0dXJuIHJlbmRlcihjb2RlLCBlbGVtZW50LCBbLi4uZWxlbWVudC5jaGlsZE5vZGVzXSwgb3B0aW9ucyk7XG4gIH0gZmluYWxseSB7XG4gICAgc2hhcmVkQ29uZmlnLmNvbnRleHQgPSBudWxsO1xuICB9XG59XG5mdW5jdGlvbiBnZXROZXh0RWxlbWVudCh0ZW1wbGF0ZSkge1xuICBsZXQgbm9kZSxcbiAgICBrZXksXG4gICAgaHlkcmF0aW5nID0gaXNIeWRyYXRpbmcoKTtcbiAgaWYgKCFoeWRyYXRpbmcgfHwgIShub2RlID0gc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LmdldChrZXkgPSBnZXRIeWRyYXRpb25LZXkoKSkpKSB7XG4gICAgaWYgKGh5ZHJhdGluZykge1xuICAgICAgc2hhcmVkQ29uZmlnLmRvbmUgPSB0cnVlO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBIeWRyYXRpb24gTWlzbWF0Y2guIFVuYWJsZSB0byBmaW5kIERPTSBub2RlcyBmb3IgaHlkcmF0aW9uIGtleTogJHtrZXl9XFxuJHt0ZW1wbGF0ZSA/IHRlbXBsYXRlKCkub3V0ZXJIVE1MIDogXCJcIn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRlbXBsYXRlKCk7XG4gIH1cbiAgaWYgKHNoYXJlZENvbmZpZy5jb21wbGV0ZWQpIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQuYWRkKG5vZGUpO1xuICBzaGFyZWRDb25maWcucmVnaXN0cnkuZGVsZXRlKGtleSk7XG4gIHJldHVybiBub2RlO1xufVxuZnVuY3Rpb24gZ2V0TmV4dE1hdGNoKGVsLCBub2RlTmFtZSkge1xuICB3aGlsZSAoZWwgJiYgZWwubG9jYWxOYW1lICE9PSBub2RlTmFtZSkgZWwgPSBlbC5uZXh0U2libGluZztcbiAgcmV0dXJuIGVsO1xufVxuZnVuY3Rpb24gZ2V0TmV4dE1hcmtlcihzdGFydCkge1xuICBsZXQgZW5kID0gc3RhcnQsXG4gICAgY291bnQgPSAwLFxuICAgIGN1cnJlbnQgPSBbXTtcbiAgaWYgKGlzSHlkcmF0aW5nKHN0YXJ0KSkge1xuICAgIHdoaWxlIChlbmQpIHtcbiAgICAgIGlmIChlbmQubm9kZVR5cGUgPT09IDgpIHtcbiAgICAgICAgY29uc3QgdiA9IGVuZC5ub2RlVmFsdWU7XG4gICAgICAgIGlmICh2ID09PSBcIiRcIikgY291bnQrKztlbHNlIGlmICh2ID09PSBcIi9cIikge1xuICAgICAgICAgIGlmIChjb3VudCA9PT0gMCkgcmV0dXJuIFtlbmQsIGN1cnJlbnRdO1xuICAgICAgICAgIGNvdW50LS07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGN1cnJlbnQucHVzaChlbmQpO1xuICAgICAgZW5kID0gZW5kLm5leHRTaWJsaW5nO1xuICAgIH1cbiAgfVxuICByZXR1cm4gW2VuZCwgY3VycmVudF07XG59XG5mdW5jdGlvbiBydW5IeWRyYXRpb25FdmVudHMoKSB7XG4gIGlmIChzaGFyZWRDb25maWcuZXZlbnRzICYmICFzaGFyZWRDb25maWcuZXZlbnRzLnF1ZXVlZCkge1xuICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgY29tcGxldGVkLFxuICAgICAgICBldmVudHNcbiAgICAgIH0gPSBzaGFyZWRDb25maWc7XG4gICAgICBpZiAoIWV2ZW50cykgcmV0dXJuO1xuICAgICAgZXZlbnRzLnF1ZXVlZCA9IGZhbHNlO1xuICAgICAgd2hpbGUgKGV2ZW50cy5sZW5ndGgpIHtcbiAgICAgICAgY29uc3QgW2VsLCBlXSA9IGV2ZW50c1swXTtcbiAgICAgICAgaWYgKCFjb21wbGV0ZWQuaGFzKGVsKSkgcmV0dXJuO1xuICAgICAgICBldmVudHMuc2hpZnQoKTtcbiAgICAgICAgZXZlbnRIYW5kbGVyKGUpO1xuICAgICAgfVxuICAgICAgaWYgKHNoYXJlZENvbmZpZy5kb25lKSB7XG4gICAgICAgIHNoYXJlZENvbmZpZy5ldmVudHMgPSBfJEhZLmV2ZW50cyA9IG51bGw7XG4gICAgICAgIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQgPSBfJEhZLmNvbXBsZXRlZCA9IG51bGw7XG4gICAgICB9XG4gICAgfSk7XG4gICAgc2hhcmVkQ29uZmlnLmV2ZW50cy5xdWV1ZWQgPSB0cnVlO1xuICB9XG59XG5mdW5jdGlvbiBpc0h5ZHJhdGluZyhub2RlKSB7XG4gIHJldHVybiAhIXNoYXJlZENvbmZpZy5jb250ZXh0ICYmICFzaGFyZWRDb25maWcuZG9uZSAmJiAoIW5vZGUgfHwgbm9kZS5pc0Nvbm5lY3RlZCk7XG59XG5mdW5jdGlvbiB0b1Byb3BlcnR5TmFtZShuYW1lKSB7XG4gIHJldHVybiBuYW1lLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvLShbYS16XSkvZywgKF8sIHcpID0+IHcudG9VcHBlckNhc2UoKSk7XG59XG5mdW5jdGlvbiB0b2dnbGVDbGFzc0tleShub2RlLCBrZXksIHZhbHVlKSB7XG4gIGNvbnN0IGNsYXNzTmFtZXMgPSBrZXkudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gIGZvciAobGV0IGkgPSAwLCBuYW1lTGVuID0gY2xhc3NOYW1lcy5sZW5ndGg7IGkgPCBuYW1lTGVuOyBpKyspIG5vZGUuY2xhc3NMaXN0LnRvZ2dsZShjbGFzc05hbWVzW2ldLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBhc3NpZ25Qcm9wKG5vZGUsIHByb3AsIHZhbHVlLCBwcmV2LCBpc1NWRywgc2tpcFJlZiwgcHJvcHMpIHtcbiAgbGV0IGlzQ0UsIGlzUHJvcCwgaXNDaGlsZFByb3AsIHByb3BBbGlhcywgZm9yY2VQcm9wO1xuICBpZiAocHJvcCA9PT0gXCJzdHlsZVwiKSByZXR1cm4gc3R5bGUobm9kZSwgdmFsdWUsIHByZXYpO1xuICBpZiAocHJvcCA9PT0gXCJjbGFzc0xpc3RcIikgcmV0dXJuIGNsYXNzTGlzdChub2RlLCB2YWx1ZSwgcHJldik7XG4gIGlmICh2YWx1ZSA9PT0gcHJldikgcmV0dXJuIHByZXY7XG4gIGlmIChwcm9wID09PSBcInJlZlwiKSB7XG4gICAgaWYgKCFza2lwUmVmKSB2YWx1ZShub2RlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDMpID09PSBcIm9uOlwiKSB7XG4gICAgY29uc3QgZSA9IHByb3Auc2xpY2UoMyk7XG4gICAgcHJldiAmJiBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoZSwgcHJldiwgdHlwZW9mIHByZXYgIT09IFwiZnVuY3Rpb25cIiAmJiBwcmV2KTtcbiAgICB2YWx1ZSAmJiBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZSwgdmFsdWUsIHR5cGVvZiB2YWx1ZSAhPT0gXCJmdW5jdGlvblwiICYmIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDEwKSA9PT0gXCJvbmNhcHR1cmU6XCIpIHtcbiAgICBjb25zdCBlID0gcHJvcC5zbGljZSgxMCk7XG4gICAgcHJldiAmJiBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoZSwgcHJldiwgdHJ1ZSk7XG4gICAgdmFsdWUgJiYgbm9kZS5hZGRFdmVudExpc3RlbmVyKGUsIHZhbHVlLCB0cnVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDIpID09PSBcIm9uXCIpIHtcbiAgICBjb25zdCBuYW1lID0gcHJvcC5zbGljZSgyKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGRlbGVnYXRlID0gRGVsZWdhdGVkRXZlbnRzLmhhcyhuYW1lKTtcbiAgICBpZiAoIWRlbGVnYXRlICYmIHByZXYpIHtcbiAgICAgIGNvbnN0IGggPSBBcnJheS5pc0FycmF5KHByZXYpID8gcHJldlswXSA6IHByZXY7XG4gICAgICBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgaCk7XG4gICAgfVxuICAgIGlmIChkZWxlZ2F0ZSB8fCB2YWx1ZSkge1xuICAgICAgYWRkRXZlbnRMaXN0ZW5lcihub2RlLCBuYW1lLCB2YWx1ZSwgZGVsZWdhdGUpO1xuICAgICAgZGVsZWdhdGUgJiYgZGVsZWdhdGVFdmVudHMoW25hbWVdKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCA1KSA9PT0gXCJhdHRyOlwiKSB7XG4gICAgc2V0QXR0cmlidXRlKG5vZGUsIHByb3Auc2xpY2UoNSksIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDUpID09PSBcImJvb2w6XCIpIHtcbiAgICBzZXRCb29sQXR0cmlidXRlKG5vZGUsIHByb3Auc2xpY2UoNSksIHZhbHVlKTtcbiAgfSBlbHNlIGlmICgoZm9yY2VQcm9wID0gcHJvcC5zbGljZSgwLCA1KSA9PT0gXCJwcm9wOlwiKSB8fCAoaXNDaGlsZFByb3AgPSBDaGlsZFByb3BlcnRpZXMuaGFzKHByb3ApKSB8fCAhaXNTVkcgJiYgKChwcm9wQWxpYXMgPSBnZXRQcm9wQWxpYXMocHJvcCwgbm9kZS50YWdOYW1lKSkgfHwgKGlzUHJvcCA9IFByb3BlcnRpZXMuaGFzKHByb3ApKSkgfHwgKGlzQ0UgPSBub2RlLm5vZGVOYW1lLmluY2x1ZGVzKFwiLVwiKSB8fCBcImlzXCIgaW4gcHJvcHMpKSB7XG4gICAgaWYgKGZvcmNlUHJvcCkge1xuICAgICAgcHJvcCA9IHByb3Auc2xpY2UoNSk7XG4gICAgICBpc1Byb3AgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybiB2YWx1ZTtcbiAgICBpZiAocHJvcCA9PT0gXCJjbGFzc1wiIHx8IHByb3AgPT09IFwiY2xhc3NOYW1lXCIpIGNsYXNzTmFtZShub2RlLCB2YWx1ZSk7ZWxzZSBpZiAoaXNDRSAmJiAhaXNQcm9wICYmICFpc0NoaWxkUHJvcCkgbm9kZVt0b1Byb3BlcnR5TmFtZShwcm9wKV0gPSB2YWx1ZTtlbHNlIG5vZGVbcHJvcEFsaWFzIHx8IHByb3BdID0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgbnMgPSBpc1NWRyAmJiBwcm9wLmluZGV4T2YoXCI6XCIpID4gLTEgJiYgU1ZHTmFtZXNwYWNlW3Byb3Auc3BsaXQoXCI6XCIpWzBdXTtcbiAgICBpZiAobnMpIHNldEF0dHJpYnV0ZU5TKG5vZGUsIG5zLCBwcm9wLCB2YWx1ZSk7ZWxzZSBzZXRBdHRyaWJ1dGUobm9kZSwgQWxpYXNlc1twcm9wXSB8fCBwcm9wLCB2YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gZXZlbnRIYW5kbGVyKGUpIHtcbiAgaWYgKHNoYXJlZENvbmZpZy5yZWdpc3RyeSAmJiBzaGFyZWRDb25maWcuZXZlbnRzKSB7XG4gICAgaWYgKHNoYXJlZENvbmZpZy5ldmVudHMuZmluZCgoW2VsLCBldl0pID0+IGV2ID09PSBlKSkgcmV0dXJuO1xuICB9XG4gIGxldCBub2RlID0gZS50YXJnZXQ7XG4gIGNvbnN0IGtleSA9IGAkJCR7ZS50eXBlfWA7XG4gIGNvbnN0IG9yaVRhcmdldCA9IGUudGFyZ2V0O1xuICBjb25zdCBvcmlDdXJyZW50VGFyZ2V0ID0gZS5jdXJyZW50VGFyZ2V0O1xuICBjb25zdCByZXRhcmdldCA9IHZhbHVlID0+IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlLCBcInRhcmdldFwiLCB7XG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHZhbHVlXG4gIH0pO1xuICBjb25zdCBoYW5kbGVOb2RlID0gKCkgPT4ge1xuICAgIGNvbnN0IGhhbmRsZXIgPSBub2RlW2tleV07XG4gICAgaWYgKGhhbmRsZXIgJiYgIW5vZGUuZGlzYWJsZWQpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSBub2RlW2Ake2tleX1EYXRhYF07XG4gICAgICBkYXRhICE9PSB1bmRlZmluZWQgPyBoYW5kbGVyLmNhbGwobm9kZSwgZGF0YSwgZSkgOiBoYW5kbGVyLmNhbGwobm9kZSwgZSk7XG4gICAgICBpZiAoZS5jYW5jZWxCdWJibGUpIHJldHVybjtcbiAgICB9XG4gICAgbm9kZS5ob3N0ICYmIHR5cGVvZiBub2RlLmhvc3QgIT09IFwic3RyaW5nXCIgJiYgIW5vZGUuaG9zdC5fJGhvc3QgJiYgbm9kZS5jb250YWlucyhlLnRhcmdldCkgJiYgcmV0YXJnZXQobm9kZS5ob3N0KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbiAgY29uc3Qgd2Fsa1VwVHJlZSA9ICgpID0+IHtcbiAgICB3aGlsZSAoaGFuZGxlTm9kZSgpICYmIChub2RlID0gbm9kZS5fJGhvc3QgfHwgbm9kZS5wYXJlbnROb2RlIHx8IG5vZGUuaG9zdCkpO1xuICB9O1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZSwgXCJjdXJyZW50VGFyZ2V0XCIsIHtcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgZ2V0KCkge1xuICAgICAgcmV0dXJuIG5vZGUgfHwgZG9jdW1lbnQ7XG4gICAgfVxuICB9KTtcbiAgaWYgKHNoYXJlZENvbmZpZy5yZWdpc3RyeSAmJiAhc2hhcmVkQ29uZmlnLmRvbmUpIHNoYXJlZENvbmZpZy5kb25lID0gXyRIWS5kb25lID0gdHJ1ZTtcbiAgaWYgKGUuY29tcG9zZWRQYXRoKSB7XG4gICAgY29uc3QgcGF0aCA9IGUuY29tcG9zZWRQYXRoKCk7XG4gICAgcmV0YXJnZXQocGF0aFswXSk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXRoLmxlbmd0aCAtIDI7IGkrKykge1xuICAgICAgbm9kZSA9IHBhdGhbaV07XG4gICAgICBpZiAoIWhhbmRsZU5vZGUoKSkgYnJlYWs7XG4gICAgICBpZiAobm9kZS5fJGhvc3QpIHtcbiAgICAgICAgbm9kZSA9IG5vZGUuXyRob3N0O1xuICAgICAgICB3YWxrVXBUcmVlKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKG5vZGUucGFyZW50Tm9kZSA9PT0gb3JpQ3VycmVudFRhcmdldCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZWxzZSB3YWxrVXBUcmVlKCk7XG4gIHJldGFyZ2V0KG9yaVRhcmdldCk7XG59XG5mdW5jdGlvbiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgdmFsdWUsIGN1cnJlbnQsIG1hcmtlciwgdW53cmFwQXJyYXkpIHtcbiAgY29uc3QgaHlkcmF0aW5nID0gaXNIeWRyYXRpbmcocGFyZW50KTtcbiAgaWYgKGh5ZHJhdGluZykge1xuICAgICFjdXJyZW50ICYmIChjdXJyZW50ID0gWy4uLnBhcmVudC5jaGlsZE5vZGVzXSk7XG4gICAgbGV0IGNsZWFuZWQgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGN1cnJlbnQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBjdXJyZW50W2ldO1xuICAgICAgaWYgKG5vZGUubm9kZVR5cGUgPT09IDggJiYgbm9kZS5kYXRhLnNsaWNlKDAsIDIpID09PSBcIiEkXCIpIG5vZGUucmVtb3ZlKCk7ZWxzZSBjbGVhbmVkLnB1c2gobm9kZSk7XG4gICAgfVxuICAgIGN1cnJlbnQgPSBjbGVhbmVkO1xuICB9XG4gIHdoaWxlICh0eXBlb2YgY3VycmVudCA9PT0gXCJmdW5jdGlvblwiKSBjdXJyZW50ID0gY3VycmVudCgpO1xuICBpZiAodmFsdWUgPT09IGN1cnJlbnQpIHJldHVybiBjdXJyZW50O1xuICBjb25zdCB0ID0gdHlwZW9mIHZhbHVlLFxuICAgIG11bHRpID0gbWFya2VyICE9PSB1bmRlZmluZWQ7XG4gIHBhcmVudCA9IG11bHRpICYmIGN1cnJlbnRbMF0gJiYgY3VycmVudFswXS5wYXJlbnROb2RlIHx8IHBhcmVudDtcbiAgaWYgKHQgPT09IFwic3RyaW5nXCIgfHwgdCA9PT0gXCJudW1iZXJcIikge1xuICAgIGlmIChoeWRyYXRpbmcpIHJldHVybiBjdXJyZW50O1xuICAgIGlmICh0ID09PSBcIm51bWJlclwiKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICBpZiAodmFsdWUgPT09IGN1cnJlbnQpIHJldHVybiBjdXJyZW50O1xuICAgIH1cbiAgICBpZiAobXVsdGkpIHtcbiAgICAgIGxldCBub2RlID0gY3VycmVudFswXTtcbiAgICAgIGlmIChub2RlICYmIG5vZGUubm9kZVR5cGUgPT09IDMpIHtcbiAgICAgICAgbm9kZS5kYXRhICE9PSB2YWx1ZSAmJiAobm9kZS5kYXRhID0gdmFsdWUpO1xuICAgICAgfSBlbHNlIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh2YWx1ZSk7XG4gICAgICBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgbm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChjdXJyZW50ICE9PSBcIlwiICYmIHR5cGVvZiBjdXJyZW50ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGN1cnJlbnQgPSBwYXJlbnQuZmlyc3RDaGlsZC5kYXRhID0gdmFsdWU7XG4gICAgICB9IGVsc2UgY3VycmVudCA9IHBhcmVudC50ZXh0Q29udGVudCA9IHZhbHVlO1xuICAgIH1cbiAgfSBlbHNlIGlmICh2YWx1ZSA9PSBudWxsIHx8IHQgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgaWYgKGh5ZHJhdGluZykgcmV0dXJuIGN1cnJlbnQ7XG4gICAgY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIpO1xuICB9IGVsc2UgaWYgKHQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiB7XG4gICAgICBsZXQgdiA9IHZhbHVlKCk7XG4gICAgICB3aGlsZSAodHlwZW9mIHYgPT09IFwiZnVuY3Rpb25cIikgdiA9IHYoKTtcbiAgICAgIGN1cnJlbnQgPSBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgdiwgY3VycmVudCwgbWFya2VyKTtcbiAgICB9KTtcbiAgICByZXR1cm4gKCkgPT4gY3VycmVudDtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIGNvbnN0IGFycmF5ID0gW107XG4gICAgY29uc3QgY3VycmVudEFycmF5ID0gY3VycmVudCAmJiBBcnJheS5pc0FycmF5KGN1cnJlbnQpO1xuICAgIGlmIChub3JtYWxpemVJbmNvbWluZ0FycmF5KGFycmF5LCB2YWx1ZSwgY3VycmVudCwgdW53cmFwQXJyYXkpKSB7XG4gICAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gY3VycmVudCA9IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCBhcnJheSwgY3VycmVudCwgbWFya2VyLCB0cnVlKSk7XG4gICAgICByZXR1cm4gKCkgPT4gY3VycmVudDtcbiAgICB9XG4gICAgaWYgKGh5ZHJhdGluZykge1xuICAgICAgaWYgKCFhcnJheS5sZW5ndGgpIHJldHVybiBjdXJyZW50O1xuICAgICAgaWYgKG1hcmtlciA9PT0gdW5kZWZpbmVkKSByZXR1cm4gY3VycmVudCA9IFsuLi5wYXJlbnQuY2hpbGROb2Rlc107XG4gICAgICBsZXQgbm9kZSA9IGFycmF5WzBdO1xuICAgICAgaWYgKG5vZGUucGFyZW50Tm9kZSAhPT0gcGFyZW50KSByZXR1cm4gY3VycmVudDtcbiAgICAgIGNvbnN0IG5vZGVzID0gW25vZGVdO1xuICAgICAgd2hpbGUgKChub2RlID0gbm9kZS5uZXh0U2libGluZykgIT09IG1hcmtlcikgbm9kZXMucHVzaChub2RlKTtcbiAgICAgIHJldHVybiBjdXJyZW50ID0gbm9kZXM7XG4gICAgfVxuICAgIGlmIChhcnJheS5sZW5ndGggPT09IDApIHtcbiAgICAgIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyKTtcbiAgICAgIGlmIChtdWx0aSkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgfSBlbHNlIGlmIChjdXJyZW50QXJyYXkpIHtcbiAgICAgIGlmIChjdXJyZW50Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBhcHBlbmROb2RlcyhwYXJlbnQsIGFycmF5LCBtYXJrZXIpO1xuICAgICAgfSBlbHNlIHJlY29uY2lsZUFycmF5cyhwYXJlbnQsIGN1cnJlbnQsIGFycmF5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY3VycmVudCAmJiBjbGVhbkNoaWxkcmVuKHBhcmVudCk7XG4gICAgICBhcHBlbmROb2RlcyhwYXJlbnQsIGFycmF5KTtcbiAgICB9XG4gICAgY3VycmVudCA9IGFycmF5O1xuICB9IGVsc2UgaWYgKHZhbHVlLm5vZGVUeXBlKSB7XG4gICAgaWYgKGh5ZHJhdGluZyAmJiB2YWx1ZS5wYXJlbnROb2RlKSByZXR1cm4gY3VycmVudCA9IG11bHRpID8gW3ZhbHVlXSA6IHZhbHVlO1xuICAgIGlmIChBcnJheS5pc0FycmF5KGN1cnJlbnQpKSB7XG4gICAgICBpZiAobXVsdGkpIHJldHVybiBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgdmFsdWUpO1xuICAgICAgY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG51bGwsIHZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnQgPT0gbnVsbCB8fCBjdXJyZW50ID09PSBcIlwiIHx8ICFwYXJlbnQuZmlyc3RDaGlsZCkge1xuICAgICAgcGFyZW50LmFwcGVuZENoaWxkKHZhbHVlKTtcbiAgICB9IGVsc2UgcGFyZW50LnJlcGxhY2VDaGlsZCh2YWx1ZSwgcGFyZW50LmZpcnN0Q2hpbGQpO1xuICAgIGN1cnJlbnQgPSB2YWx1ZTtcbiAgfSBlbHNlIGNvbnNvbGUud2FybihgVW5yZWNvZ25pemVkIHZhbHVlLiBTa2lwcGVkIGluc2VydGluZ2AsIHZhbHVlKTtcbiAgcmV0dXJuIGN1cnJlbnQ7XG59XG5mdW5jdGlvbiBub3JtYWxpemVJbmNvbWluZ0FycmF5KG5vcm1hbGl6ZWQsIGFycmF5LCBjdXJyZW50LCB1bndyYXApIHtcbiAgbGV0IGR5bmFtaWMgPSBmYWxzZTtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgbGV0IGl0ZW0gPSBhcnJheVtpXSxcbiAgICAgIHByZXYgPSBjdXJyZW50ICYmIGN1cnJlbnRbbm9ybWFsaXplZC5sZW5ndGhdLFxuICAgICAgdDtcbiAgICBpZiAoaXRlbSA9PSBudWxsIHx8IGl0ZW0gPT09IHRydWUgfHwgaXRlbSA9PT0gZmFsc2UpIDsgZWxzZSBpZiAoKHQgPSB0eXBlb2YgaXRlbSkgPT09IFwib2JqZWN0XCIgJiYgaXRlbS5ub2RlVHlwZSkge1xuICAgICAgbm9ybWFsaXplZC5wdXNoKGl0ZW0pO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShpdGVtKSkge1xuICAgICAgZHluYW1pYyA9IG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgaXRlbSwgcHJldikgfHwgZHluYW1pYztcbiAgICB9IGVsc2UgaWYgKHQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgaWYgKHVud3JhcCkge1xuICAgICAgICB3aGlsZSAodHlwZW9mIGl0ZW0gPT09IFwiZnVuY3Rpb25cIikgaXRlbSA9IGl0ZW0oKTtcbiAgICAgICAgZHluYW1pYyA9IG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgQXJyYXkuaXNBcnJheShpdGVtKSA/IGl0ZW0gOiBbaXRlbV0sIEFycmF5LmlzQXJyYXkocHJldikgPyBwcmV2IDogW3ByZXZdKSB8fCBkeW5hbWljO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9ybWFsaXplZC5wdXNoKGl0ZW0pO1xuICAgICAgICBkeW5hbWljID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdmFsdWUgPSBTdHJpbmcoaXRlbSk7XG4gICAgICBpZiAocHJldiAmJiBwcmV2Lm5vZGVUeXBlID09PSAzICYmIHByZXYuZGF0YSA9PT0gdmFsdWUpIG5vcm1hbGl6ZWQucHVzaChwcmV2KTtlbHNlIG5vcm1hbGl6ZWQucHVzaChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh2YWx1ZSkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZHluYW1pYztcbn1cbmZ1bmN0aW9uIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXksIG1hcmtlciA9IG51bGwpIHtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSBwYXJlbnQuaW5zZXJ0QmVmb3JlKGFycmF5W2ldLCBtYXJrZXIpO1xufVxuZnVuY3Rpb24gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgcmVwbGFjZW1lbnQpIHtcbiAgaWYgKG1hcmtlciA9PT0gdW5kZWZpbmVkKSByZXR1cm4gcGFyZW50LnRleHRDb250ZW50ID0gXCJcIjtcbiAgY29uc3Qgbm9kZSA9IHJlcGxhY2VtZW50IHx8IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXCIpO1xuICBpZiAoY3VycmVudC5sZW5ndGgpIHtcbiAgICBsZXQgaW5zZXJ0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gY3VycmVudC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgZWwgPSBjdXJyZW50W2ldO1xuICAgICAgaWYgKG5vZGUgIT09IGVsKSB7XG4gICAgICAgIGNvbnN0IGlzUGFyZW50ID0gZWwucGFyZW50Tm9kZSA9PT0gcGFyZW50O1xuICAgICAgICBpZiAoIWluc2VydGVkICYmICFpKSBpc1BhcmVudCA/IHBhcmVudC5yZXBsYWNlQ2hpbGQobm9kZSwgZWwpIDogcGFyZW50Lmluc2VydEJlZm9yZShub2RlLCBtYXJrZXIpO2Vsc2UgaXNQYXJlbnQgJiYgZWwucmVtb3ZlKCk7XG4gICAgICB9IGVsc2UgaW5zZXJ0ZWQgPSB0cnVlO1xuICAgIH1cbiAgfSBlbHNlIHBhcmVudC5pbnNlcnRCZWZvcmUobm9kZSwgbWFya2VyKTtcbiAgcmV0dXJuIFtub2RlXTtcbn1cbmZ1bmN0aW9uIGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgcm9vdCkge1xuICBjb25zdCB0ZW1wbGF0ZXMgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoYCpbZGF0YS1oa11gKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wbGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBub2RlID0gdGVtcGxhdGVzW2ldO1xuICAgIGNvbnN0IGtleSA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiZGF0YS1oa1wiKTtcbiAgICBpZiAoKCFyb290IHx8IGtleS5zdGFydHNXaXRoKHJvb3QpKSAmJiAhc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LmhhcyhrZXkpKSBzaGFyZWRDb25maWcucmVnaXN0cnkuc2V0KGtleSwgbm9kZSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGdldEh5ZHJhdGlvbktleSgpIHtcbiAgcmV0dXJuIHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCk7XG59XG5mdW5jdGlvbiBOb0h5ZHJhdGlvbihwcm9wcykge1xuICByZXR1cm4gc2hhcmVkQ29uZmlnLmNvbnRleHQgPyB1bmRlZmluZWQgOiBwcm9wcy5jaGlsZHJlbjtcbn1cbmZ1bmN0aW9uIEh5ZHJhdGlvbihwcm9wcykge1xuICByZXR1cm4gcHJvcHMuY2hpbGRyZW47XG59XG5jb25zdCB2b2lkRm4gPSAoKSA9PiB1bmRlZmluZWQ7XG5jb25zdCBSZXF1ZXN0Q29udGV4dCA9IFN5bWJvbCgpO1xuZnVuY3Rpb24gaW5uZXJIVE1MKHBhcmVudCwgY29udGVudCkge1xuICAhc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgKHBhcmVudC5pbm5lckhUTUwgPSBjb250ZW50KTtcbn1cblxuZnVuY3Rpb24gdGhyb3dJbkJyb3dzZXIoZnVuYykge1xuICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYCR7ZnVuYy5uYW1lfSBpcyBub3Qgc3VwcG9ydGVkIGluIHRoZSBicm93c2VyLCByZXR1cm5pbmcgdW5kZWZpbmVkYCk7XG4gIGNvbnNvbGUuZXJyb3IoZXJyKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyaW5nKGZuLCBvcHRpb25zKSB7XG4gIHRocm93SW5Ccm93c2VyKHJlbmRlclRvU3RyaW5nKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyaW5nQXN5bmMoZm4sIG9wdGlvbnMpIHtcbiAgdGhyb3dJbkJyb3dzZXIocmVuZGVyVG9TdHJpbmdBc3luYyk7XG59XG5mdW5jdGlvbiByZW5kZXJUb1N0cmVhbShmbiwgb3B0aW9ucykge1xuICB0aHJvd0luQnJvd3NlcihyZW5kZXJUb1N0cmVhbSk7XG59XG5mdW5jdGlvbiBzc3IodGVtcGxhdGUsIC4uLm5vZGVzKSB7fVxuZnVuY3Rpb24gc3NyRWxlbWVudChuYW1lLCBwcm9wcywgY2hpbGRyZW4sIG5lZWRzSWQpIHt9XG5mdW5jdGlvbiBzc3JDbGFzc0xpc3QodmFsdWUpIHt9XG5mdW5jdGlvbiBzc3JTdHlsZSh2YWx1ZSkge31cbmZ1bmN0aW9uIHNzckF0dHJpYnV0ZShrZXksIHZhbHVlKSB7fVxuZnVuY3Rpb24gc3NySHlkcmF0aW9uS2V5KCkge31cbmZ1bmN0aW9uIHJlc29sdmVTU1JOb2RlKG5vZGUpIHt9XG5mdW5jdGlvbiBlc2NhcGUoaHRtbCkge31cbmZ1bmN0aW9uIHNzclNwcmVhZChwcm9wcywgaXNTVkcsIHNraXBDaGlsZHJlbikge31cblxuY29uc3QgaXNTZXJ2ZXIgPSBmYWxzZTtcbmNvbnN0IGlzRGV2ID0gdHJ1ZTtcbmNvbnN0IFNWR19OQU1FU1BBQ0UgPSBcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI7XG5mdW5jdGlvbiBjcmVhdGVFbGVtZW50KHRhZ05hbWUsIGlzU1ZHID0gZmFsc2UpIHtcbiAgcmV0dXJuIGlzU1ZHID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR19OQU1FU1BBQ0UsIHRhZ05hbWUpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbn1cbmNvbnN0IGh5ZHJhdGUgPSAoLi4uYXJncykgPT4ge1xuICBlbmFibGVIeWRyYXRpb24oKTtcbiAgcmV0dXJuIGh5ZHJhdGUkMSguLi5hcmdzKTtcbn07XG5mdW5jdGlvbiBQb3J0YWwocHJvcHMpIHtcbiAgY29uc3Qge1xuICAgICAgdXNlU2hhZG93XG4gICAgfSA9IHByb3BzLFxuICAgIG1hcmtlciA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXCIpLFxuICAgIG1vdW50ID0gKCkgPT4gcHJvcHMubW91bnQgfHwgZG9jdW1lbnQuYm9keSxcbiAgICBvd25lciA9IGdldE93bmVyKCk7XG4gIGxldCBjb250ZW50O1xuICBsZXQgaHlkcmF0aW5nID0gISFzaGFyZWRDb25maWcuY29udGV4dDtcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoaHlkcmF0aW5nKSBnZXRPd25lcigpLnVzZXIgPSBoeWRyYXRpbmcgPSBmYWxzZTtcbiAgICBjb250ZW50IHx8IChjb250ZW50ID0gcnVuV2l0aE93bmVyKG93bmVyLCAoKSA9PiBjcmVhdGVNZW1vKCgpID0+IHByb3BzLmNoaWxkcmVuKSkpO1xuICAgIGNvbnN0IGVsID0gbW91bnQoKTtcbiAgICBpZiAoZWwgaW5zdGFuY2VvZiBIVE1MSGVhZEVsZW1lbnQpIHtcbiAgICAgIGNvbnN0IFtjbGVhbiwgc2V0Q2xlYW5dID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgICAgIGNvbnN0IGNsZWFudXAgPSAoKSA9PiBzZXRDbGVhbih0cnVlKTtcbiAgICAgIGNyZWF0ZVJvb3QoZGlzcG9zZSA9PiBpbnNlcnQoZWwsICgpID0+ICFjbGVhbigpID8gY29udGVudCgpIDogZGlzcG9zZSgpLCBudWxsKSk7XG4gICAgICBvbkNsZWFudXAoY2xlYW51cCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGNyZWF0ZUVsZW1lbnQocHJvcHMuaXNTVkcgPyBcImdcIiA6IFwiZGl2XCIsIHByb3BzLmlzU1ZHKSxcbiAgICAgICAgcmVuZGVyUm9vdCA9IHVzZVNoYWRvdyAmJiBjb250YWluZXIuYXR0YWNoU2hhZG93ID8gY29udGFpbmVyLmF0dGFjaFNoYWRvdyh7XG4gICAgICAgICAgbW9kZTogXCJvcGVuXCJcbiAgICAgICAgfSkgOiBjb250YWluZXI7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29udGFpbmVyLCBcIl8kaG9zdFwiLCB7XG4gICAgICAgIGdldCgpIHtcbiAgICAgICAgICByZXR1cm4gbWFya2VyLnBhcmVudE5vZGU7XG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gICAgICBpbnNlcnQocmVuZGVyUm9vdCwgY29udGVudCk7XG4gICAgICBlbC5hcHBlbmRDaGlsZChjb250YWluZXIpO1xuICAgICAgcHJvcHMucmVmICYmIHByb3BzLnJlZihjb250YWluZXIpO1xuICAgICAgb25DbGVhbnVwKCgpID0+IGVsLnJlbW92ZUNoaWxkKGNvbnRhaW5lcikpO1xuICAgIH1cbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgcmVuZGVyOiAhaHlkcmF0aW5nXG4gIH0pO1xuICByZXR1cm4gbWFya2VyO1xufVxuZnVuY3Rpb24gY3JlYXRlRHluYW1pYyhjb21wb25lbnQsIHByb3BzKSB7XG4gIGNvbnN0IGNhY2hlZCA9IGNyZWF0ZU1lbW8oY29tcG9uZW50KTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IGNhY2hlZCgpO1xuICAgIHN3aXRjaCAodHlwZW9mIGNvbXBvbmVudCkge1xuICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgICAgIE9iamVjdC5hc3NpZ24oY29tcG9uZW50LCB7XG4gICAgICAgICAgWyRERVZDT01QXTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHVudHJhY2soKCkgPT4gY29tcG9uZW50KHByb3BzKSk7XG4gICAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICAgIGNvbnN0IGlzU3ZnID0gU1ZHRWxlbWVudHMuaGFzKGNvbXBvbmVudCk7XG4gICAgICAgIGNvbnN0IGVsID0gc2hhcmVkQ29uZmlnLmNvbnRleHQgPyBnZXROZXh0RWxlbWVudCgpIDogY3JlYXRlRWxlbWVudChjb21wb25lbnQsIGlzU3ZnKTtcbiAgICAgICAgc3ByZWFkKGVsLCBwcm9wcywgaXNTdmcpO1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgfVxuICB9KTtcbn1cbmZ1bmN0aW9uIER5bmFtaWMocHJvcHMpIHtcbiAgY29uc3QgWywgb3RoZXJzXSA9IHNwbGl0UHJvcHMocHJvcHMsIFtcImNvbXBvbmVudFwiXSk7XG4gIHJldHVybiBjcmVhdGVEeW5hbWljKCgpID0+IHByb3BzLmNvbXBvbmVudCwgb3RoZXJzKTtcbn1cblxuZXhwb3J0IHsgQWxpYXNlcywgdm9pZEZuIGFzIEFzc2V0cywgQ2hpbGRQcm9wZXJ0aWVzLCBET01FbGVtZW50cywgRGVsZWdhdGVkRXZlbnRzLCBEeW5hbWljLCBIeWRyYXRpb24sIHZvaWRGbiBhcyBIeWRyYXRpb25TY3JpcHQsIE5vSHlkcmF0aW9uLCBQb3J0YWwsIFByb3BlcnRpZXMsIFJlcXVlc3RDb250ZXh0LCBTVkdFbGVtZW50cywgU1ZHTmFtZXNwYWNlLCBhZGRFdmVudExpc3RlbmVyLCBhc3NpZ24sIGNsYXNzTGlzdCwgY2xhc3NOYW1lLCBjbGVhckRlbGVnYXRlZEV2ZW50cywgY3JlYXRlRHluYW1pYywgZGVsZWdhdGVFdmVudHMsIGR5bmFtaWNQcm9wZXJ0eSwgZXNjYXBlLCB2b2lkRm4gYXMgZ2VuZXJhdGVIeWRyYXRpb25TY3JpcHQsIHZvaWRGbiBhcyBnZXRBc3NldHMsIGdldEh5ZHJhdGlvbktleSwgZ2V0TmV4dEVsZW1lbnQsIGdldE5leHRNYXJrZXIsIGdldE5leHRNYXRjaCwgZ2V0UHJvcEFsaWFzLCB2b2lkRm4gYXMgZ2V0UmVxdWVzdEV2ZW50LCBoeWRyYXRlLCBpbm5lckhUTUwsIGluc2VydCwgaXNEZXYsIGlzU2VydmVyLCBtZW1vLCByZW5kZXIsIHJlbmRlclRvU3RyZWFtLCByZW5kZXJUb1N0cmluZywgcmVuZGVyVG9TdHJpbmdBc3luYywgcmVzb2x2ZVNTUk5vZGUsIHJ1bkh5ZHJhdGlvbkV2ZW50cywgc2V0QXR0cmlidXRlLCBzZXRBdHRyaWJ1dGVOUywgc2V0Qm9vbEF0dHJpYnV0ZSwgc2V0UHJvcGVydHksIHNwcmVhZCwgc3NyLCBzc3JBdHRyaWJ1dGUsIHNzckNsYXNzTGlzdCwgc3NyRWxlbWVudCwgc3NySHlkcmF0aW9uS2V5LCBzc3JTcHJlYWQsIHNzclN0eWxlLCBzdHlsZSwgdGVtcGxhdGUsIHVzZSwgdm9pZEZuIGFzIHVzZUFzc2V0cyB9O1xuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiLy8gR2VuZXJhdGVkIHVzaW5nIGBucG0gcnVuIGJ1aWxkYC4gRG8gbm90IGVkaXQuXG5cbnZhciByZWdleCA9IC9eW2Etel0oPzpbXFwuMC05X2EtelxceEI3XFx4QzAtXFx4RDZcXHhEOC1cXHhGNlxceEY4LVxcdTAzN0RcXHUwMzdGLVxcdTFGRkZcXHUyMDBDXFx1MjAwRFxcdTIwM0ZcXHUyMDQwXFx1MjA3MC1cXHUyMThGXFx1MkMwMC1cXHUyRkVGXFx1MzAwMS1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkZEXXxbXFx1RDgwMC1cXHVEQjdGXVtcXHVEQzAwLVxcdURGRkZdKSotKD86W1xceDJEXFwuMC05X2EtelxceEI3XFx4QzAtXFx4RDZcXHhEOC1cXHhGNlxceEY4LVxcdTAzN0RcXHUwMzdGLVxcdTFGRkZcXHUyMDBDXFx1MjAwRFxcdTIwM0ZcXHUyMDQwXFx1MjA3MC1cXHUyMThGXFx1MkMwMC1cXHUyRkVGXFx1MzAwMS1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkZEXXxbXFx1RDgwMC1cXHVEQjdGXVtcXHVEQzAwLVxcdURGRkZdKSokLztcblxudmFyIGlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUgPSBmdW5jdGlvbihzdHJpbmcpIHtcblx0cmV0dXJuIHJlZ2V4LnRlc3Qoc3RyaW5nKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZTtcbiIsInZhciBfX2FzeW5jID0gKF9fdGhpcywgX19hcmd1bWVudHMsIGdlbmVyYXRvcikgPT4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIHZhciBmdWxmaWxsZWQgPSAodmFsdWUpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgfVxuICAgIH07XG4gICAgdmFyIHJlamVjdGVkID0gKHZhbHVlKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBzdGVwKGdlbmVyYXRvci50aHJvdyh2YWx1ZSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZWplY3QoZSk7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgc3RlcCA9ICh4KSA9PiB4LmRvbmUgPyByZXNvbHZlKHgudmFsdWUpIDogUHJvbWlzZS5yZXNvbHZlKHgudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7XG4gICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KF9fdGhpcywgX19hcmd1bWVudHMpKS5uZXh0KCkpO1xuICB9KTtcbn07XG5cbi8vIHNyYy9pbmRleC50c1xuaW1wb3J0IGlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUgZnJvbSBcImlzLXBvdGVudGlhbC1jdXN0b20tZWxlbWVudC1uYW1lXCI7XG5mdW5jdGlvbiBjcmVhdGVJc29sYXRlZEVsZW1lbnQob3B0aW9ucykge1xuICByZXR1cm4gX19hc3luYyh0aGlzLCBudWxsLCBmdW5jdGlvbiogKCkge1xuICAgIGNvbnN0IHsgbmFtZSwgbW9kZSA9IFwiY2xvc2VkXCIsIGNzcywgaXNvbGF0ZUV2ZW50cyA9IGZhbHNlIH0gPSBvcHRpb25zO1xuICAgIGlmICghaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZShuYW1lKSkge1xuICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgIGBcIiR7bmFtZX1cIiBpcyBub3QgYSB2YWxpZCBjdXN0b20gZWxlbWVudCBuYW1lLiBJdCBtdXN0IGJlIHR3byB3b3JkcyBhbmQga2ViYWItY2FzZSwgd2l0aCBhIGZldyBleGNlcHRpb25zLiBTZWUgc3BlYyBmb3IgbW9yZSBkZXRhaWxzOiBodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9jdXN0b20tZWxlbWVudHMuaHRtbCN2YWxpZC1jdXN0b20tZWxlbWVudC1uYW1lYFxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgcGFyZW50RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQobmFtZSk7XG4gICAgY29uc3Qgc2hhZG93ID0gcGFyZW50RWxlbWVudC5hdHRhY2hTaGFkb3coeyBtb2RlIH0pO1xuICAgIGNvbnN0IGlzb2xhdGVkRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJodG1sXCIpO1xuICAgIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYm9keVwiKTtcbiAgICBjb25zdCBoZWFkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImhlYWRcIik7XG4gICAgaWYgKGNzcykge1xuICAgICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XG4gICAgICBpZiAoXCJ1cmxcIiBpbiBjc3MpIHtcbiAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSB5aWVsZCBmZXRjaChjc3MudXJsKS50aGVuKChyZXMpID0+IHJlcy50ZXh0KCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSBjc3MudGV4dENvbnRlbnQ7XG4gICAgICB9XG4gICAgICBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICB9XG4gICAgaXNvbGF0ZWRFbGVtZW50LmFwcGVuZENoaWxkKGhlYWQpO1xuICAgIGlzb2xhdGVkRWxlbWVudC5hcHBlbmRDaGlsZChib2R5KTtcbiAgICBzaGFkb3cuYXBwZW5kQ2hpbGQoaXNvbGF0ZWRFbGVtZW50KTtcbiAgICBpZiAoaXNvbGF0ZUV2ZW50cykge1xuICAgICAgY29uc3QgZXZlbnRUeXBlcyA9IEFycmF5LmlzQXJyYXkoaXNvbGF0ZUV2ZW50cykgPyBpc29sYXRlRXZlbnRzIDogW1wia2V5ZG93blwiLCBcImtleXVwXCIsIFwia2V5cHJlc3NcIl07XG4gICAgICBldmVudFR5cGVzLmZvckVhY2goKGV2ZW50VHlwZSkgPT4ge1xuICAgICAgICBib2R5LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnRUeXBlLCAoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHBhcmVudEVsZW1lbnQsXG4gICAgICBzaGFkb3csXG4gICAgICBpc29sYXRlZEVsZW1lbnQ6IGJvZHlcbiAgICB9O1xuICB9KTtcbn1cbmV4cG9ydCB7XG4gIGNyZWF0ZUlzb2xhdGVkRWxlbWVudFxufTtcbiIsImNvbnN0IG51bGxLZXkgPSBTeW1ib2woJ251bGwnKTsgLy8gYG9iamVjdEhhc2hlc2Aga2V5IGZvciBudWxsXG5cbmxldCBrZXlDb3VudGVyID0gMDtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWFueUtleXNNYXAgZXh0ZW5kcyBNYXAge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fb2JqZWN0SGFzaGVzID0gbmV3IFdlYWtNYXAoKTtcblx0XHR0aGlzLl9zeW1ib2xIYXNoZXMgPSBuZXcgTWFwKCk7IC8vIGh0dHBzOi8vZ2l0aHViLmNvbS90YzM5L2VjbWEyNjIvaXNzdWVzLzExOTRcblx0XHR0aGlzLl9wdWJsaWNLZXlzID0gbmV3IE1hcCgpO1xuXG5cdFx0Y29uc3QgW3BhaXJzXSA9IGFyZ3VtZW50czsgLy8gTWFwIGNvbXBhdFxuXHRcdGlmIChwYWlycyA9PT0gbnVsbCB8fCBwYWlycyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBwYWlyc1tTeW1ib2wuaXRlcmF0b3JdICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHR5cGVvZiBwYWlycyArICcgaXMgbm90IGl0ZXJhYmxlIChjYW5ub3QgcmVhZCBwcm9wZXJ0eSBTeW1ib2woU3ltYm9sLml0ZXJhdG9yKSknKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IFtrZXlzLCB2YWx1ZV0gb2YgcGFpcnMpIHtcblx0XHRcdHRoaXMuc2V0KGtleXMsIHZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRfZ2V0UHVibGljS2V5cyhrZXlzLCBjcmVhdGUgPSBmYWxzZSkge1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShrZXlzKSkge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIGtleXMgcGFyYW1ldGVyIG11c3QgYmUgYW4gYXJyYXknKTtcblx0XHR9XG5cblx0XHRjb25zdCBwcml2YXRlS2V5ID0gdGhpcy5fZ2V0UHJpdmF0ZUtleShrZXlzLCBjcmVhdGUpO1xuXG5cdFx0bGV0IHB1YmxpY0tleTtcblx0XHRpZiAocHJpdmF0ZUtleSAmJiB0aGlzLl9wdWJsaWNLZXlzLmhhcyhwcml2YXRlS2V5KSkge1xuXHRcdFx0cHVibGljS2V5ID0gdGhpcy5fcHVibGljS2V5cy5nZXQocHJpdmF0ZUtleSk7XG5cdFx0fSBlbHNlIGlmIChjcmVhdGUpIHtcblx0XHRcdHB1YmxpY0tleSA9IFsuLi5rZXlzXTsgLy8gUmVnZW5lcmF0ZSBrZXlzIGFycmF5IHRvIGF2b2lkIGV4dGVybmFsIGludGVyYWN0aW9uXG5cdFx0XHR0aGlzLl9wdWJsaWNLZXlzLnNldChwcml2YXRlS2V5LCBwdWJsaWNLZXkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7cHJpdmF0ZUtleSwgcHVibGljS2V5fTtcblx0fVxuXG5cdF9nZXRQcml2YXRlS2V5KGtleXMsIGNyZWF0ZSA9IGZhbHNlKSB7XG5cdFx0Y29uc3QgcHJpdmF0ZUtleXMgPSBbXTtcblx0XHRmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuXHRcdFx0aWYgKGtleSA9PT0gbnVsbCkge1xuXHRcdFx0XHRrZXkgPSBudWxsS2V5O1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBoYXNoZXMgPSB0eXBlb2Yga2V5ID09PSAnb2JqZWN0JyB8fCB0eXBlb2Yga2V5ID09PSAnZnVuY3Rpb24nID8gJ19vYmplY3RIYXNoZXMnIDogKHR5cGVvZiBrZXkgPT09ICdzeW1ib2wnID8gJ19zeW1ib2xIYXNoZXMnIDogZmFsc2UpO1xuXG5cdFx0XHRpZiAoIWhhc2hlcykge1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKGtleSk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXNbaGFzaGVzXS5oYXMoa2V5KSkge1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKHRoaXNbaGFzaGVzXS5nZXQoa2V5KSk7XG5cdFx0XHR9IGVsc2UgaWYgKGNyZWF0ZSkge1xuXHRcdFx0XHRjb25zdCBwcml2YXRlS2V5ID0gYEBAbWttLXJlZi0ke2tleUNvdW50ZXIrK31AQGA7XG5cdFx0XHRcdHRoaXNbaGFzaGVzXS5zZXQoa2V5LCBwcml2YXRlS2V5KTtcblx0XHRcdFx0cHJpdmF0ZUtleXMucHVzaChwcml2YXRlS2V5KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkocHJpdmF0ZUtleXMpO1xuXHR9XG5cblx0c2V0KGtleXMsIHZhbHVlKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMsIHRydWUpO1xuXHRcdHJldHVybiBzdXBlci5zZXQocHVibGljS2V5LCB2YWx1ZSk7XG5cdH1cblxuXHRnZXQoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gc3VwZXIuZ2V0KHB1YmxpY0tleSk7XG5cdH1cblxuXHRoYXMoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gc3VwZXIuaGFzKHB1YmxpY0tleSk7XG5cdH1cblxuXHRkZWxldGUoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXksIHByaXZhdGVLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gQm9vbGVhbihwdWJsaWNLZXkgJiYgc3VwZXIuZGVsZXRlKHB1YmxpY0tleSkgJiYgdGhpcy5fcHVibGljS2V5cy5kZWxldGUocHJpdmF0ZUtleSkpO1xuXHR9XG5cblx0Y2xlYXIoKSB7XG5cdFx0c3VwZXIuY2xlYXIoKTtcblx0XHR0aGlzLl9zeW1ib2xIYXNoZXMuY2xlYXIoKTtcblx0XHR0aGlzLl9wdWJsaWNLZXlzLmNsZWFyKCk7XG5cdH1cblxuXHRnZXQgW1N5bWJvbC50b1N0cmluZ1RhZ10oKSB7XG5cdFx0cmV0dXJuICdNYW55S2V5c01hcCc7XG5cdH1cblxuXHRnZXQgc2l6ZSgpIHtcblx0XHRyZXR1cm4gc3VwZXIuc2l6ZTtcblx0fVxufVxuIiwiZnVuY3Rpb24gaXNQbGFpbk9iamVjdCh2YWx1ZSkge1xuICBpZiAodmFsdWUgPT09IG51bGwgfHwgdHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHByb3RvdHlwZSA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSk7XG4gIGlmIChwcm90b3R5cGUgIT09IG51bGwgJiYgcHJvdG90eXBlICE9PSBPYmplY3QucHJvdG90eXBlICYmIE9iamVjdC5nZXRQcm90b3R5cGVPZihwcm90b3R5cGUpICE9PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChTeW1ib2wuaXRlcmF0b3IgaW4gdmFsdWUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKFN5bWJvbC50b1N0cmluZ1RhZyBpbiB2YWx1ZSkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpID09PSBcIltvYmplY3QgTW9kdWxlXVwiO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBfZGVmdShiYXNlT2JqZWN0LCBkZWZhdWx0cywgbmFtZXNwYWNlID0gXCIuXCIsIG1lcmdlcikge1xuICBpZiAoIWlzUGxhaW5PYmplY3QoZGVmYXVsdHMpKSB7XG4gICAgcmV0dXJuIF9kZWZ1KGJhc2VPYmplY3QsIHt9LCBuYW1lc3BhY2UsIG1lcmdlcik7XG4gIH1cbiAgY29uc3Qgb2JqZWN0ID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdHMpO1xuICBmb3IgKGNvbnN0IGtleSBpbiBiYXNlT2JqZWN0KSB7XG4gICAgaWYgKGtleSA9PT0gXCJfX3Byb3RvX19cIiB8fCBrZXkgPT09IFwiY29uc3RydWN0b3JcIikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gYmFzZU9iamVjdFtrZXldO1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdm9pZCAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKG1lcmdlciAmJiBtZXJnZXIob2JqZWN0LCBrZXksIHZhbHVlLCBuYW1lc3BhY2UpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpICYmIEFycmF5LmlzQXJyYXkob2JqZWN0W2tleV0pKSB7XG4gICAgICBvYmplY3Rba2V5XSA9IFsuLi52YWx1ZSwgLi4ub2JqZWN0W2tleV1dO1xuICAgIH0gZWxzZSBpZiAoaXNQbGFpbk9iamVjdCh2YWx1ZSkgJiYgaXNQbGFpbk9iamVjdChvYmplY3Rba2V5XSkpIHtcbiAgICAgIG9iamVjdFtrZXldID0gX2RlZnUoXG4gICAgICAgIHZhbHVlLFxuICAgICAgICBvYmplY3Rba2V5XSxcbiAgICAgICAgKG5hbWVzcGFjZSA/IGAke25hbWVzcGFjZX0uYCA6IFwiXCIpICsga2V5LnRvU3RyaW5nKCksXG4gICAgICAgIG1lcmdlclxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG9iamVjdDtcbn1cbmZ1bmN0aW9uIGNyZWF0ZURlZnUobWVyZ2VyKSB7XG4gIHJldHVybiAoLi4uYXJndW1lbnRzXykgPT4gKFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSB1bmljb3JuL25vLWFycmF5LXJlZHVjZVxuICAgIGFyZ3VtZW50c18ucmVkdWNlKChwLCBjKSA9PiBfZGVmdShwLCBjLCBcIlwiLCBtZXJnZXIpLCB7fSlcbiAgKTtcbn1cbmNvbnN0IGRlZnUgPSBjcmVhdGVEZWZ1KCk7XG5jb25zdCBkZWZ1Rm4gPSBjcmVhdGVEZWZ1KChvYmplY3QsIGtleSwgY3VycmVudFZhbHVlKSA9PiB7XG4gIGlmIChvYmplY3Rba2V5XSAhPT0gdm9pZCAwICYmIHR5cGVvZiBjdXJyZW50VmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIG9iamVjdFtrZXldID0gY3VycmVudFZhbHVlKG9iamVjdFtrZXldKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufSk7XG5jb25zdCBkZWZ1QXJyYXlGbiA9IGNyZWF0ZURlZnUoKG9iamVjdCwga2V5LCBjdXJyZW50VmFsdWUpID0+IHtcbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0W2tleV0pICYmIHR5cGVvZiBjdXJyZW50VmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIG9iamVjdFtrZXldID0gY3VycmVudFZhbHVlKG9iamVjdFtrZXldKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufSk7XG5cbmV4cG9ydCB7IGNyZWF0ZURlZnUsIGRlZnUgYXMgZGVmYXVsdCwgZGVmdSwgZGVmdUFycmF5Rm4sIGRlZnVGbiB9O1xuIiwiY29uc3QgaXNFeGlzdCA9IChlbGVtZW50KSA9PiB7XG4gIHJldHVybiBlbGVtZW50ICE9PSBudWxsID8geyBpc0RldGVjdGVkOiB0cnVlLCByZXN1bHQ6IGVsZW1lbnQgfSA6IHsgaXNEZXRlY3RlZDogZmFsc2UgfTtcbn07XG5jb25zdCBpc05vdEV4aXN0ID0gKGVsZW1lbnQpID0+IHtcbiAgcmV0dXJuIGVsZW1lbnQgPT09IG51bGwgPyB7IGlzRGV0ZWN0ZWQ6IHRydWUsIHJlc3VsdDogbnVsbCB9IDogeyBpc0RldGVjdGVkOiBmYWxzZSB9O1xufTtcblxuZXhwb3J0IHsgaXNFeGlzdCwgaXNOb3RFeGlzdCB9O1xuIiwiaW1wb3J0IE1hbnlLZXlzTWFwIGZyb20gJ21hbnkta2V5cy1tYXAnO1xuaW1wb3J0IHsgZGVmdSB9IGZyb20gJ2RlZnUnO1xuaW1wb3J0IHsgaXNFeGlzdCB9IGZyb20gJy4vZGV0ZWN0b3JzLm1qcyc7XG5cbmNvbnN0IGdldERlZmF1bHRPcHRpb25zID0gKCkgPT4gKHtcbiAgdGFyZ2V0OiBnbG9iYWxUaGlzLmRvY3VtZW50LFxuICB1bmlmeVByb2Nlc3M6IHRydWUsXG4gIGRldGVjdG9yOiBpc0V4aXN0LFxuICBvYnNlcnZlQ29uZmlnczoge1xuICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICBzdWJ0cmVlOiB0cnVlLFxuICAgIGF0dHJpYnV0ZXM6IHRydWVcbiAgfSxcbiAgc2lnbmFsOiB2b2lkIDAsXG4gIGN1c3RvbU1hdGNoZXI6IHZvaWQgMFxufSk7XG5jb25zdCBtZXJnZU9wdGlvbnMgPSAodXNlclNpZGVPcHRpb25zLCBkZWZhdWx0T3B0aW9ucykgPT4ge1xuICByZXR1cm4gZGVmdSh1c2VyU2lkZU9wdGlvbnMsIGRlZmF1bHRPcHRpb25zKTtcbn07XG5cbmNvbnN0IHVuaWZ5Q2FjaGUgPSBuZXcgTWFueUtleXNNYXAoKTtcbmZ1bmN0aW9uIGNyZWF0ZVdhaXRFbGVtZW50KGluc3RhbmNlT3B0aW9ucykge1xuICBjb25zdCB7IGRlZmF1bHRPcHRpb25zIH0gPSBpbnN0YW5jZU9wdGlvbnM7XG4gIHJldHVybiAoc2VsZWN0b3IsIG9wdGlvbnMpID0+IHtcbiAgICBjb25zdCB7XG4gICAgICB0YXJnZXQsXG4gICAgICB1bmlmeVByb2Nlc3MsXG4gICAgICBvYnNlcnZlQ29uZmlncyxcbiAgICAgIGRldGVjdG9yLFxuICAgICAgc2lnbmFsLFxuICAgICAgY3VzdG9tTWF0Y2hlclxuICAgIH0gPSBtZXJnZU9wdGlvbnMob3B0aW9ucywgZGVmYXVsdE9wdGlvbnMpO1xuICAgIGNvbnN0IHVuaWZ5UHJvbWlzZUtleSA9IFtcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgdGFyZ2V0LFxuICAgICAgdW5pZnlQcm9jZXNzLFxuICAgICAgb2JzZXJ2ZUNvbmZpZ3MsXG4gICAgICBkZXRlY3RvcixcbiAgICAgIHNpZ25hbCxcbiAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICBdO1xuICAgIGNvbnN0IGNhY2hlZFByb21pc2UgPSB1bmlmeUNhY2hlLmdldCh1bmlmeVByb21pc2VLZXkpO1xuICAgIGlmICh1bmlmeVByb2Nlc3MgJiYgY2FjaGVkUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIGNhY2hlZFByb21pc2U7XG4gICAgfVxuICAgIGNvbnN0IGRldGVjdFByb21pc2UgPSBuZXcgUHJvbWlzZShcbiAgICAgIC8vIGJpb21lLWlnbm9yZSBsaW50L3N1c3BpY2lvdXMvbm9Bc3luY1Byb21pc2VFeGVjdXRvcjogYXZvaWQgbmVzdGluZyBwcm9taXNlXG4gICAgICBhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmIChzaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KHNpZ25hbC5yZWFzb24pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoXG4gICAgICAgICAgYXN5bmMgKG11dGF0aW9ucykgPT4ge1xuICAgICAgICAgICAgZm9yIChjb25zdCBfIG9mIG11dGF0aW9ucykge1xuICAgICAgICAgICAgICBpZiAoc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnN0IGRldGVjdFJlc3VsdDIgPSBhd2FpdCBkZXRlY3RFbGVtZW50KHtcbiAgICAgICAgICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgICAgICAgZGV0ZWN0b3IsXG4gICAgICAgICAgICAgICAgY3VzdG9tTWF0Y2hlclxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgaWYgKGRldGVjdFJlc3VsdDIuaXNEZXRlY3RlZCkge1xuICAgICAgICAgICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGRldGVjdFJlc3VsdDIucmVzdWx0KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgICAgc2lnbmFsPy5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgIFwiYWJvcnRcIixcbiAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KHNpZ25hbC5yZWFzb24pO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgeyBvbmNlOiB0cnVlIH1cbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgZGV0ZWN0UmVzdWx0ID0gYXdhaXQgZGV0ZWN0RWxlbWVudCh7XG4gICAgICAgICAgc2VsZWN0b3IsXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgIGRldGVjdG9yLFxuICAgICAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChkZXRlY3RSZXN1bHQuaXNEZXRlY3RlZCkge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKGRldGVjdFJlc3VsdC5yZXN1bHQpO1xuICAgICAgICB9XG4gICAgICAgIG9ic2VydmVyLm9ic2VydmUodGFyZ2V0LCBvYnNlcnZlQ29uZmlncyk7XG4gICAgICB9XG4gICAgKS5maW5hbGx5KCgpID0+IHtcbiAgICAgIHVuaWZ5Q2FjaGUuZGVsZXRlKHVuaWZ5UHJvbWlzZUtleSk7XG4gICAgfSk7XG4gICAgdW5pZnlDYWNoZS5zZXQodW5pZnlQcm9taXNlS2V5LCBkZXRlY3RQcm9taXNlKTtcbiAgICByZXR1cm4gZGV0ZWN0UHJvbWlzZTtcbiAgfTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGRldGVjdEVsZW1lbnQoe1xuICB0YXJnZXQsXG4gIHNlbGVjdG9yLFxuICBkZXRlY3RvcixcbiAgY3VzdG9tTWF0Y2hlclxufSkge1xuICBjb25zdCBlbGVtZW50ID0gY3VzdG9tTWF0Y2hlciA/IGN1c3RvbU1hdGNoZXIoc2VsZWN0b3IpIDogdGFyZ2V0LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuICByZXR1cm4gYXdhaXQgZGV0ZWN0b3IoZWxlbWVudCk7XG59XG5jb25zdCB3YWl0RWxlbWVudCA9IGNyZWF0ZVdhaXRFbGVtZW50KHtcbiAgZGVmYXVsdE9wdGlvbnM6IGdldERlZmF1bHRPcHRpb25zKClcbn0pO1xuXG5leHBvcnQgeyBjcmVhdGVXYWl0RWxlbWVudCwgZ2V0RGVmYXVsdE9wdGlvbnMsIHdhaXRFbGVtZW50IH07XG4iLCJmdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcbiAgaWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXJncy5zaGlmdCgpO1xuICAgIG1ldGhvZChgW3d4dF0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xuICB9XG59XG5leHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuICBsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG4gIHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuICBlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuIiwiaW1wb3J0IHsgd2FpdEVsZW1lbnQgfSBmcm9tIFwiQDFuYXRzdS93YWl0LWVsZW1lbnRcIjtcbmltcG9ydCB7XG4gIGlzRXhpc3QgYXMgbW91bnREZXRlY3RvcixcbiAgaXNOb3RFeGlzdCBhcyByZW1vdmVEZXRlY3RvclxufSBmcm9tIFwiQDFuYXRzdS93YWl0LWVsZW1lbnQvZGV0ZWN0b3JzXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5UG9zaXRpb24ocm9vdCwgcG9zaXRpb25lZEVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgaWYgKG9wdGlvbnMucG9zaXRpb24gPT09IFwiaW5saW5lXCIpIHJldHVybjtcbiAgaWYgKG9wdGlvbnMuekluZGV4ICE9IG51bGwpIHJvb3Quc3R5bGUuekluZGV4ID0gU3RyaW5nKG9wdGlvbnMuekluZGV4KTtcbiAgcm9vdC5zdHlsZS5vdmVyZmxvdyA9IFwidmlzaWJsZVwiO1xuICByb290LnN0eWxlLnBvc2l0aW9uID0gXCJyZWxhdGl2ZVwiO1xuICByb290LnN0eWxlLndpZHRoID0gXCIwXCI7XG4gIHJvb3Quc3R5bGUuaGVpZ2h0ID0gXCIwXCI7XG4gIHJvb3Quc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgaWYgKHBvc2l0aW9uZWRFbGVtZW50KSB7XG4gICAgaWYgKG9wdGlvbnMucG9zaXRpb24gPT09IFwib3ZlcmxheVwiKSB7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiYWJzb2x1dGVcIjtcbiAgICAgIGlmIChvcHRpb25zLmFsaWdubWVudD8uc3RhcnRzV2l0aChcImJvdHRvbS1cIikpXG4gICAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmJvdHRvbSA9IFwiMFwiO1xuICAgICAgZWxzZSBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIjtcbiAgICAgIGlmIChvcHRpb25zLmFsaWdubWVudD8uZW5kc1dpdGgoXCItcmlnaHRcIikpXG4gICAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIwXCI7XG4gICAgICBlbHNlIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmxlZnQgPSBcIjBcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmJvdHRvbSA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUubGVmdCA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIjtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRBbmNob3Iob3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5hbmNob3IgPT0gbnVsbCkgcmV0dXJuIGRvY3VtZW50LmJvZHk7XG4gIGxldCByZXNvbHZlZCA9IHR5cGVvZiBvcHRpb25zLmFuY2hvciA9PT0gXCJmdW5jdGlvblwiID8gb3B0aW9ucy5hbmNob3IoKSA6IG9wdGlvbnMuYW5jaG9yO1xuICBpZiAodHlwZW9mIHJlc29sdmVkID09PSBcInN0cmluZ1wiKSB7XG4gICAgaWYgKHJlc29sdmVkLnN0YXJ0c1dpdGgoXCIvXCIpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBkb2N1bWVudC5ldmFsdWF0ZShcbiAgICAgICAgcmVzb2x2ZWQsXG4gICAgICAgIGRvY3VtZW50LFxuICAgICAgICBudWxsLFxuICAgICAgICBYUGF0aFJlc3VsdC5GSVJTVF9PUkRFUkVEX05PREVfVFlQRSxcbiAgICAgICAgbnVsbFxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXN1bHQuc2luZ2xlTm9kZVZhbHVlID8/IHZvaWQgMDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IocmVzb2x2ZWQpID8/IHZvaWQgMDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc29sdmVkID8/IHZvaWQgMDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtb3VudFVpKHJvb3QsIG9wdGlvbnMpIHtcbiAgY29uc3QgYW5jaG9yID0gZ2V0QW5jaG9yKG9wdGlvbnMpO1xuICBpZiAoYW5jaG9yID09IG51bGwpXG4gICAgdGhyb3cgRXJyb3IoXG4gICAgICBcIkZhaWxlZCB0byBtb3VudCBjb250ZW50IHNjcmlwdCBVSTogY291bGQgbm90IGZpbmQgYW5jaG9yIGVsZW1lbnRcIlxuICAgICk7XG4gIHN3aXRjaCAob3B0aW9ucy5hcHBlbmQpIHtcbiAgICBjYXNlIHZvaWQgMDpcbiAgICBjYXNlIFwibGFzdFwiOlxuICAgICAgYW5jaG9yLmFwcGVuZChyb290KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJmaXJzdFwiOlxuICAgICAgYW5jaG9yLnByZXBlbmQocm9vdCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwicmVwbGFjZVwiOlxuICAgICAgYW5jaG9yLnJlcGxhY2VXaXRoKHJvb3QpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImFmdGVyXCI6XG4gICAgICBhbmNob3IucGFyZW50RWxlbWVudD8uaW5zZXJ0QmVmb3JlKHJvb3QsIGFuY2hvci5uZXh0RWxlbWVudFNpYmxpbmcpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImJlZm9yZVwiOlxuICAgICAgYW5jaG9yLnBhcmVudEVsZW1lbnQ/Lmluc2VydEJlZm9yZShyb290LCBhbmNob3IpO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIG9wdGlvbnMuYXBwZW5kKGFuY2hvciwgcm9vdCk7XG4gICAgICBicmVhaztcbiAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1vdW50RnVuY3Rpb25zKGJhc2VGdW5jdGlvbnMsIG9wdGlvbnMpIHtcbiAgbGV0IGF1dG9Nb3VudEluc3RhbmNlID0gdm9pZCAwO1xuICBjb25zdCBzdG9wQXV0b01vdW50ID0gKCkgPT4ge1xuICAgIGF1dG9Nb3VudEluc3RhbmNlPy5zdG9wQXV0b01vdW50KCk7XG4gICAgYXV0b01vdW50SW5zdGFuY2UgPSB2b2lkIDA7XG4gIH07XG4gIGNvbnN0IG1vdW50ID0gKCkgPT4ge1xuICAgIGJhc2VGdW5jdGlvbnMubW91bnQoKTtcbiAgfTtcbiAgY29uc3QgdW5tb3VudCA9IGJhc2VGdW5jdGlvbnMucmVtb3ZlO1xuICBjb25zdCByZW1vdmUgPSAoKSA9PiB7XG4gICAgc3RvcEF1dG9Nb3VudCgpO1xuICAgIGJhc2VGdW5jdGlvbnMucmVtb3ZlKCk7XG4gIH07XG4gIGNvbnN0IGF1dG9Nb3VudCA9IChhdXRvTW91bnRPcHRpb25zKSA9PiB7XG4gICAgaWYgKGF1dG9Nb3VudEluc3RhbmNlKSB7XG4gICAgICBsb2dnZXIud2FybihcImF1dG9Nb3VudCBpcyBhbHJlYWR5IHNldC5cIik7XG4gICAgfVxuICAgIGF1dG9Nb3VudEluc3RhbmNlID0gYXV0b01vdW50VWkoXG4gICAgICB7IG1vdW50LCB1bm1vdW50LCBzdG9wQXV0b01vdW50IH0sXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIC4uLmF1dG9Nb3VudE9wdGlvbnNcbiAgICAgIH1cbiAgICApO1xuICB9O1xuICByZXR1cm4ge1xuICAgIG1vdW50LFxuICAgIHJlbW92ZSxcbiAgICBhdXRvTW91bnRcbiAgfTtcbn1cbmZ1bmN0aW9uIGF1dG9Nb3VudFVpKHVpQ2FsbGJhY2tzLCBvcHRpb25zKSB7XG4gIGNvbnN0IGFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgY29uc3QgRVhQTElDSVRfU1RPUF9SRUFTT04gPSBcImV4cGxpY2l0X3N0b3BfYXV0b19tb3VudFwiO1xuICBjb25zdCBfc3RvcEF1dG9Nb3VudCA9ICgpID0+IHtcbiAgICBhYm9ydENvbnRyb2xsZXIuYWJvcnQoRVhQTElDSVRfU1RPUF9SRUFTT04pO1xuICAgIG9wdGlvbnMub25TdG9wPy4oKTtcbiAgfTtcbiAgbGV0IHJlc29sdmVkQW5jaG9yID0gdHlwZW9mIG9wdGlvbnMuYW5jaG9yID09PSBcImZ1bmN0aW9uXCIgPyBvcHRpb25zLmFuY2hvcigpIDogb3B0aW9ucy5hbmNob3I7XG4gIGlmIChyZXNvbHZlZEFuY2hvciBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICB0aHJvdyBFcnJvcihcbiAgICAgIFwiYXV0b01vdW50IGFuZCBFbGVtZW50IGFuY2hvciBvcHRpb24gY2Fubm90IGJlIGNvbWJpbmVkLiBBdm9pZCBwYXNzaW5nIGBFbGVtZW50YCBkaXJlY3RseSBvciBgKCkgPT4gRWxlbWVudGAgdG8gdGhlIGFuY2hvci5cIlxuICAgICk7XG4gIH1cbiAgYXN5bmMgZnVuY3Rpb24gb2JzZXJ2ZUVsZW1lbnQoc2VsZWN0b3IpIHtcbiAgICBsZXQgaXNBbmNob3JFeGlzdCA9ICEhZ2V0QW5jaG9yKG9wdGlvbnMpO1xuICAgIGlmIChpc0FuY2hvckV4aXN0KSB7XG4gICAgICB1aUNhbGxiYWNrcy5tb3VudCgpO1xuICAgIH1cbiAgICB3aGlsZSAoIWFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY2hhbmdlZEFuY2hvciA9IGF3YWl0IHdhaXRFbGVtZW50KHNlbGVjdG9yID8/IFwiYm9keVwiLCB7XG4gICAgICAgICAgY3VzdG9tTWF0Y2hlcjogKCkgPT4gZ2V0QW5jaG9yKG9wdGlvbnMpID8/IG51bGwsXG4gICAgICAgICAgZGV0ZWN0b3I6IGlzQW5jaG9yRXhpc3QgPyByZW1vdmVEZXRlY3RvciA6IG1vdW50RGV0ZWN0b3IsXG4gICAgICAgICAgc2lnbmFsOiBhYm9ydENvbnRyb2xsZXIuc2lnbmFsXG4gICAgICAgIH0pO1xuICAgICAgICBpc0FuY2hvckV4aXN0ID0gISFjaGFuZ2VkQW5jaG9yO1xuICAgICAgICBpZiAoaXNBbmNob3JFeGlzdCkge1xuICAgICAgICAgIHVpQ2FsbGJhY2tzLm1vdW50KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdWlDYWxsYmFja3MudW5tb3VudCgpO1xuICAgICAgICAgIGlmIChvcHRpb25zLm9uY2UpIHtcbiAgICAgICAgICAgIHVpQ2FsbGJhY2tzLnN0b3BBdXRvTW91bnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGlmIChhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQgJiYgYWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZWFzb24gPT09IEVYUExJQ0lUX1NUT1BfUkVBU09OKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgb2JzZXJ2ZUVsZW1lbnQocmVzb2x2ZWRBbmNob3IpO1xuICByZXR1cm4geyBzdG9wQXV0b01vdW50OiBfc3RvcEF1dG9Nb3VudCB9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIHNwbGl0U2hhZG93Um9vdENzcyhjc3MpIHtcbiAgbGV0IHNoYWRvd0NzcyA9IGNzcztcbiAgbGV0IGRvY3VtZW50Q3NzID0gXCJcIjtcbiAgY29uc3QgcnVsZXNSZWdleCA9IC8oXFxzKkAocHJvcGVydHl8Zm9udC1mYWNlKVtcXHNcXFNdKj97W1xcc1xcU10qP30pL2dtO1xuICBsZXQgbWF0Y2g7XG4gIHdoaWxlICgobWF0Y2ggPSBydWxlc1JlZ2V4LmV4ZWMoY3NzKSkgIT09IG51bGwpIHtcbiAgICBkb2N1bWVudENzcyArPSBtYXRjaFsxXTtcbiAgICBzaGFkb3dDc3MgPSBzaGFkb3dDc3MucmVwbGFjZShtYXRjaFsxXSwgXCJcIik7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBkb2N1bWVudENzczogZG9jdW1lbnRDc3MudHJpbSgpLFxuICAgIHNoYWRvd0Nzczogc2hhZG93Q3NzLnRyaW0oKVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgY3JlYXRlSXNvbGF0ZWRFbGVtZW50IH0gZnJvbSBcIkB3ZWJleHQtY29yZS9pc29sYXRlZC1lbGVtZW50XCI7XG5pbXBvcnQgeyBhcHBseVBvc2l0aW9uLCBjcmVhdGVNb3VudEZ1bmN0aW9ucywgbW91bnRVaSB9IGZyb20gXCIuL3NoYXJlZC5tanNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQgeyBzcGxpdFNoYWRvd1Jvb3RDc3MgfSBmcm9tIFwiLi4vc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qc1wiO1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVNoYWRvd1Jvb3RVaShjdHgsIG9wdGlvbnMpIHtcbiAgY29uc3QgaW5zdGFuY2VJZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZygyLCAxNSk7XG4gIGNvbnN0IGNzcyA9IFtdO1xuICBpZiAoIW9wdGlvbnMuaW5oZXJpdFN0eWxlcykge1xuICAgIGNzcy5wdXNoKGAvKiBXWFQgU2hhZG93IFJvb3QgUmVzZXQgKi8gOmhvc3R7YWxsOmluaXRpYWwgIWltcG9ydGFudDt9YCk7XG4gIH1cbiAgaWYgKG9wdGlvbnMuY3NzKSB7XG4gICAgY3NzLnB1c2gob3B0aW9ucy5jc3MpO1xuICB9XG4gIGlmIChjdHgub3B0aW9ucz8uY3NzSW5qZWN0aW9uTW9kZSA9PT0gXCJ1aVwiKSB7XG4gICAgY29uc3QgZW50cnlDc3MgPSBhd2FpdCBsb2FkQ3NzKCk7XG4gICAgY3NzLnB1c2goZW50cnlDc3MucmVwbGFjZUFsbChcIjpyb290XCIsIFwiOmhvc3RcIikpO1xuICB9XG4gIGNvbnN0IHsgc2hhZG93Q3NzLCBkb2N1bWVudENzcyB9ID0gc3BsaXRTaGFkb3dSb290Q3NzKGNzcy5qb2luKFwiXFxuXCIpLnRyaW0oKSk7XG4gIGNvbnN0IHtcbiAgICBpc29sYXRlZEVsZW1lbnQ6IHVpQ29udGFpbmVyLFxuICAgIHBhcmVudEVsZW1lbnQ6IHNoYWRvd0hvc3QsXG4gICAgc2hhZG93XG4gIH0gPSBhd2FpdCBjcmVhdGVJc29sYXRlZEVsZW1lbnQoe1xuICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICBjc3M6IHtcbiAgICAgIHRleHRDb250ZW50OiBzaGFkb3dDc3NcbiAgICB9LFxuICAgIG1vZGU6IG9wdGlvbnMubW9kZSA/PyBcIm9wZW5cIixcbiAgICBpc29sYXRlRXZlbnRzOiBvcHRpb25zLmlzb2xhdGVFdmVudHNcbiAgfSk7XG4gIHNoYWRvd0hvc3Quc2V0QXR0cmlidXRlKFwiZGF0YS13eHQtc2hhZG93LXJvb3RcIiwgXCJcIik7XG4gIGxldCBtb3VudGVkO1xuICBjb25zdCBtb3VudCA9ICgpID0+IHtcbiAgICBtb3VudFVpKHNoYWRvd0hvc3QsIG9wdGlvbnMpO1xuICAgIGFwcGx5UG9zaXRpb24oc2hhZG93SG9zdCwgc2hhZG93LnF1ZXJ5U2VsZWN0b3IoXCJodG1sXCIpLCBvcHRpb25zKTtcbiAgICBpZiAoZG9jdW1lbnRDc3MgJiYgIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXG4gICAgICBgc3R5bGVbd3h0LXNoYWRvdy1yb290LWRvY3VtZW50LXN0eWxlcz1cIiR7aW5zdGFuY2VJZH1cIl1gXG4gICAgKSkge1xuICAgICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XG4gICAgICBzdHlsZS50ZXh0Q29udGVudCA9IGRvY3VtZW50Q3NzO1xuICAgICAgc3R5bGUuc2V0QXR0cmlidXRlKFwid3h0LXNoYWRvdy1yb290LWRvY3VtZW50LXN0eWxlc1wiLCBpbnN0YW5jZUlkKTtcbiAgICAgIChkb2N1bWVudC5oZWFkID8/IGRvY3VtZW50LmJvZHkpLmFwcGVuZChzdHlsZSk7XG4gICAgfVxuICAgIG1vdW50ZWQgPSBvcHRpb25zLm9uTW91bnQodWlDb250YWluZXIsIHNoYWRvdywgc2hhZG93SG9zdCk7XG4gIH07XG4gIGNvbnN0IHJlbW92ZSA9ICgpID0+IHtcbiAgICBvcHRpb25zLm9uUmVtb3ZlPy4obW91bnRlZCk7XG4gICAgc2hhZG93SG9zdC5yZW1vdmUoKTtcbiAgICBjb25zdCBkb2N1bWVudFN0eWxlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgIGBzdHlsZVt3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzPVwiJHtpbnN0YW5jZUlkfVwiXWBcbiAgICApO1xuICAgIGRvY3VtZW50U3R5bGU/LnJlbW92ZSgpO1xuICAgIHdoaWxlICh1aUNvbnRhaW5lci5sYXN0Q2hpbGQpXG4gICAgICB1aUNvbnRhaW5lci5yZW1vdmVDaGlsZCh1aUNvbnRhaW5lci5sYXN0Q2hpbGQpO1xuICAgIG1vdW50ZWQgPSB2b2lkIDA7XG4gIH07XG4gIGNvbnN0IG1vdW50RnVuY3Rpb25zID0gY3JlYXRlTW91bnRGdW5jdGlvbnMoXG4gICAge1xuICAgICAgbW91bnQsXG4gICAgICByZW1vdmVcbiAgICB9LFxuICAgIG9wdGlvbnNcbiAgKTtcbiAgY3R4Lm9uSW52YWxpZGF0ZWQocmVtb3ZlKTtcbiAgcmV0dXJuIHtcbiAgICBzaGFkb3csXG4gICAgc2hhZG93SG9zdCxcbiAgICB1aUNvbnRhaW5lcixcbiAgICAuLi5tb3VudEZ1bmN0aW9ucyxcbiAgICBnZXQgbW91bnRlZCgpIHtcbiAgICAgIHJldHVybiBtb3VudGVkO1xuICAgIH1cbiAgfTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGxvYWRDc3MoKSB7XG4gIGNvbnN0IHVybCA9IGJyb3dzZXIucnVudGltZS5nZXRVUkwoYC9jb250ZW50LXNjcmlwdHMvJHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH0uY3NzYCk7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsKTtcbiAgICByZXR1cm4gYXdhaXQgcmVzLnRleHQoKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgbG9nZ2VyLndhcm4oXG4gICAgICBgRmFpbGVkIHRvIGxvYWQgc3R5bGVzIEAgJHt1cmx9LiBEaWQgeW91IGZvcmdldCB0byBpbXBvcnQgdGhlIHN0eWxlc2hlZXQgaW4geW91ciBlbnRyeXBvaW50P2AsXG4gICAgICBlcnJcbiAgICApO1xuICAgIHJldHVybiBcIlwiO1xuICB9XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiZnVuY3Rpb24gcihlKXt2YXIgdCxmLG49XCJcIjtpZihcInN0cmluZ1wiPT10eXBlb2YgZXx8XCJudW1iZXJcIj09dHlwZW9mIGUpbis9ZTtlbHNlIGlmKFwib2JqZWN0XCI9PXR5cGVvZiBlKWlmKEFycmF5LmlzQXJyYXkoZSkpe3ZhciBvPWUubGVuZ3RoO2Zvcih0PTA7dDxvO3QrKyllW3RdJiYoZj1yKGVbdF0pKSYmKG4mJihuKz1cIiBcIiksbis9Zil9ZWxzZSBmb3IoZiBpbiBlKWVbZl0mJihuJiYobis9XCIgXCIpLG4rPWYpO3JldHVybiBufWV4cG9ydCBmdW5jdGlvbiBjbHN4KCl7Zm9yKHZhciBlLHQsZj0wLG49XCJcIixvPWFyZ3VtZW50cy5sZW5ndGg7ZjxvO2YrKykoZT1hcmd1bWVudHNbZl0pJiYodD1yKGUpKSYmKG4mJihuKz1cIiBcIiksbis9dCk7cmV0dXJuIG59ZXhwb3J0IGRlZmF1bHQgY2xzeDsiLCJpbXBvcnQgeyBjbHN4LCB0eXBlIENsYXNzVmFsdWUgfSBmcm9tICdjbHN4J1xuXG5leHBvcnQgZnVuY3Rpb24gY24oLi4uaW5wdXRzOiBDbGFzc1ZhbHVlW10pIHtcbiAgcmV0dXJuIGNsc3goaW5wdXRzKVxufSIsImltcG9ydCB7IFNob3csIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50LCBKU1ggfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBIZWFkZXJQcm9wcyB7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBsb2dvPzogSlNYLkVsZW1lbnQ7XG4gIGFjdGlvbnM/OiBKU1guRWxlbWVudDtcbiAgdmFyaWFudD86ICdkZWZhdWx0JyB8ICdtaW5pbWFsJyB8ICd0cmFuc3BhcmVudCc7XG4gIHN0aWNreT86IGJvb2xlYW47XG4gIHNob3dNZW51QnV0dG9uPzogYm9vbGVhbjtcbiAgb25NZW51Q2xpY2s/OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEhlYWRlcjogQ29tcG9uZW50PEhlYWRlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbaXNTY3JvbGxlZCwgc2V0SXNTY3JvbGxlZF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuXG4gIC8vIFRyYWNrIHNjcm9sbCBwb3NpdGlvbiBmb3Igc3RpY2t5IGhlYWRlciBlZmZlY3RzXG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiBwcm9wcy5zdGlja3kpIHtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgKCkgPT4ge1xuICAgICAgc2V0SXNTY3JvbGxlZCh3aW5kb3cuc2Nyb2xsWSA+IDEwKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHZhcmlhbnQgPSAoKSA9PiBwcm9wcy52YXJpYW50IHx8ICdkZWZhdWx0JztcblxuICByZXR1cm4gKFxuICAgIDxoZWFkZXJcbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ3ctZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0yMDAnLFxuICAgICAgICB7XG4gICAgICAgICAgLy8gVmFyaWFudHNcbiAgICAgICAgICAnYmctc3VyZmFjZSBib3JkZXItYiBib3JkZXItc3VidGxlJzogdmFyaWFudCgpID09PSAnZGVmYXVsdCcsXG4gICAgICAgICAgJ2JnLXRyYW5zcGFyZW50JzogdmFyaWFudCgpID09PSAnbWluaW1hbCcgfHwgdmFyaWFudCgpID09PSAndHJhbnNwYXJlbnQnLFxuICAgICAgICAgICdiYWNrZHJvcC1ibHVyLW1kIGJnLXN1cmZhY2UvODAnOiB2YXJpYW50KCkgPT09ICd0cmFuc3BhcmVudCcgJiYgaXNTY3JvbGxlZCgpLFxuICAgICAgICAgIC8vIFN0aWNreSBiZWhhdmlvclxuICAgICAgICAgICdzdGlja3kgdG9wLTAgei01MCc6IHByb3BzLnN0aWNreSxcbiAgICAgICAgICAnc2hhZG93LWxnJzogcHJvcHMuc3RpY2t5ICYmIGlzU2Nyb2xsZWQoKSxcbiAgICAgICAgfSxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgPGRpdiBjbGFzcz1cIm1heC13LXNjcmVlbi14bCBteC1hdXRvIHB4LTQgc206cHgtNiBsZzpweC04XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gaC0xNlwiPlxuICAgICAgICAgIHsvKiBMZWZ0IHNlY3Rpb24gKi99XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC00XCI+XG4gICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zaG93TWVudUJ1dHRvbn0+XG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbk1lbnVDbGlja31cbiAgICAgICAgICAgICAgICBjbGFzcz1cInAtMiByb3VuZGVkLWxnIGhvdmVyOmJnLWhpZ2hsaWdodCB0cmFuc2l0aW9uLWNvbG9ycyBsZzpoaWRkZW5cIlxuICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCJNZW51XCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxzdmcgY2xhc3M9XCJ3LTYgaC02XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCI+XG4gICAgICAgICAgICAgICAgICA8cGF0aCBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBzdHJva2Utd2lkdGg9XCIyXCIgZD1cIk00IDZoMTZNNCAxMmgxNk00IDE4aDE2XCIgLz5cbiAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmxvZ299IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMudGl0bGV9PlxuICAgICAgICAgICAgICAgIDxoMSBjbGFzcz1cInRleHQteGwgZm9udC1ib2xkIHRleHQtcHJpbWFyeVwiPntwcm9wcy50aXRsZX08L2gxPlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICB9PlxuICAgICAgICAgICAgICB7cHJvcHMubG9nb31cbiAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgIHsvKiBSaWdodCBzZWN0aW9uICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmFjdGlvbnN9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgIHtwcm9wcy5hY3Rpb25zfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvaGVhZGVyPlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNjb3JlUGFuZWxQcm9wcyB7XG4gIHNjb3JlOiBudW1iZXI7XG4gIHJhbms6IG51bWJlcjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBTY29yZVBhbmVsOiBDb21wb25lbnQ8U2NvcmVQYW5lbFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdncmlkIGdyaWQtY29scy1bMWZyXzFmcl0gZ2FwLTIgcC00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBTY29yZSBCb3ggKi99XG4gICAgICA8ZGl2IGNsYXNzPVwiYmctc3VyZmFjZSByb3VuZGVkLWxnIHAtNCBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBtaW4taC1bODBweF1cIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtMnhsIGZvbnQtbW9ubyBmb250LWJvbGQgdGV4dC1hY2NlbnQtcHJpbWFyeVwiPlxuICAgICAgICAgIHtwcm9wcy5zY29yZX1cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtc2Vjb25kYXJ5IG10LTFcIj5cbiAgICAgICAgICBTY29yZVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgXG4gICAgICB7LyogUmFuayBCb3ggKi99XG4gICAgICA8ZGl2IGNsYXNzPVwiYmctc3VyZmFjZSByb3VuZGVkLWxnIHAtNCBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBtaW4taC1bODBweF1cIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtMnhsIGZvbnQtbW9ubyBmb250LWJvbGQgdGV4dC1hY2NlbnQtc2Vjb25kYXJ5XCI+XG4gICAgICAgICAge3Byb3BzLnJhbmt9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+XG4gICAgICAgICAgUmFua1xuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBGb3IsIGNyZWF0ZUVmZmVjdCwgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBMeXJpY0xpbmUge1xuICBpZDogc3RyaW5nO1xuICB0ZXh0OiBzdHJpbmc7XG4gIHN0YXJ0VGltZTogbnVtYmVyO1xuICBkdXJhdGlvbjogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEx5cmljc0Rpc3BsYXlQcm9wcyB7XG4gIGx5cmljczogTHlyaWNMaW5lW107XG4gIGN1cnJlbnRUaW1lPzogbnVtYmVyO1xuICBpc1BsYXlpbmc/OiBib29sZWFuO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEx5cmljc0Rpc3BsYXk6IENvbXBvbmVudDxMeXJpY3NEaXNwbGF5UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtjdXJyZW50TGluZUluZGV4LCBzZXRDdXJyZW50TGluZUluZGV4XSA9IGNyZWF0ZVNpZ25hbCgtMSk7XG4gIGxldCBjb250YWluZXJSZWY6IEhUTUxEaXZFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG4gIC8vIEZpbmQgY3VycmVudCBsaW5lIGJhc2VkIG9uIHRpbWVcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIXByb3BzLmN1cnJlbnRUaW1lKSB7XG4gICAgICBzZXRDdXJyZW50TGluZUluZGV4KC0xKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0aW1lID0gcHJvcHMuY3VycmVudFRpbWU7XG4gICAgY29uc3QgaW5kZXggPSBwcm9wcy5seXJpY3MuZmluZEluZGV4KChsaW5lKSA9PiB7XG4gICAgICBjb25zdCBlbmRUaW1lID0gbGluZS5zdGFydFRpbWUgKyBsaW5lLmR1cmF0aW9uO1xuICAgICAgcmV0dXJuIHRpbWUgPj0gbGluZS5zdGFydFRpbWUgJiYgdGltZSA8IGVuZFRpbWU7XG4gICAgfSk7XG5cbiAgICBzZXRDdXJyZW50TGluZUluZGV4KGluZGV4KTtcbiAgfSk7XG5cbiAgLy8gQXV0by1zY3JvbGwgdG8gY3VycmVudCBsaW5lXG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgaW5kZXggPSBjdXJyZW50TGluZUluZGV4KCk7XG4gICAgaWYgKGluZGV4ID09PSAtMSB8fCAhY29udGFpbmVyUmVmIHx8ICFwcm9wcy5pc1BsYXlpbmcpIHJldHVybjtcblxuICAgIGNvbnN0IGxpbmVFbGVtZW50cyA9IGNvbnRhaW5lclJlZi5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1saW5lLWluZGV4XScpO1xuICAgIGNvbnN0IGN1cnJlbnRFbGVtZW50ID0gbGluZUVsZW1lbnRzW2luZGV4XSBhcyBIVE1MRWxlbWVudDtcblxuICAgIGlmIChjdXJyZW50RWxlbWVudCkge1xuICAgICAgY29uc3QgY29udGFpbmVySGVpZ2h0ID0gY29udGFpbmVyUmVmLmNsaWVudEhlaWdodDtcbiAgICAgIGNvbnN0IGxpbmVUb3AgPSBjdXJyZW50RWxlbWVudC5vZmZzZXRUb3A7XG4gICAgICBjb25zdCBsaW5lSGVpZ2h0ID0gY3VycmVudEVsZW1lbnQub2Zmc2V0SGVpZ2h0O1xuXG4gICAgICAvLyBDZW50ZXIgdGhlIGN1cnJlbnQgbGluZVxuICAgICAgY29uc3Qgc2Nyb2xsVG9wID0gbGluZVRvcCAtIGNvbnRhaW5lckhlaWdodCAvIDIgKyBsaW5lSGVpZ2h0IC8gMjtcblxuICAgICAgY29udGFpbmVyUmVmLnNjcm9sbFRvKHtcbiAgICAgICAgdG9wOiBzY3JvbGxUb3AsXG4gICAgICAgIGJlaGF2aW9yOiAnc21vb3RoJyxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICByZWY9e2NvbnRhaW5lclJlZn1cbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2x5cmljcy1kaXNwbGF5IG92ZXJmbG93LXktYXV0byBzY3JvbGwtc21vb3RoJyxcbiAgICAgICAgJ2gtZnVsbCBweC02IHB5LTEyJyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktOFwiPlxuICAgICAgICA8Rm9yIGVhY2g9e3Byb3BzLmx5cmljc30+XG4gICAgICAgICAgeyhsaW5lLCBpbmRleCkgPT4gKFxuICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICBkYXRhLWxpbmUtaW5kZXg9e2luZGV4KCl9XG4gICAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAndGV4dC1jZW50ZXIgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgICAgICAgICAndGV4dC0yeGwgbGVhZGluZy1yZWxheGVkJyxcbiAgICAgICAgICAgICAgICBpbmRleCgpID09PSBjdXJyZW50TGluZUluZGV4KClcbiAgICAgICAgICAgICAgICAgID8gJ3RleHQtcHJpbWFyeSBmb250LXNlbWlib2xkIHNjYWxlLTExMCdcbiAgICAgICAgICAgICAgICAgIDogJ3RleHQtc2Vjb25kYXJ5IG9wYWNpdHktNjAnXG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtsaW5lLnRleHR9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApfVxuICAgICAgICA8L0Zvcj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEthcmFva2VIZWFkZXJQcm9wcyB7XG4gIHNvbmdUaXRsZTogc3RyaW5nO1xuICBhcnRpc3Q6IHN0cmluZztcbiAgb25CYWNrPzogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmNvbnN0IENoZXZyb25MZWZ0ID0gKCkgPT4gKFxuICA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBjbGFzcz1cInctNiBoLTZcIj5cbiAgICA8cGF0aCBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBkPVwiTTE1IDE5bC03LTcgNy03XCIgLz5cbiAgPC9zdmc+XG4pO1xuXG5leHBvcnQgY29uc3QgS2FyYW9rZUhlYWRlcjogQ29tcG9uZW50PEthcmFva2VIZWFkZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbigncmVsYXRpdmUgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcC00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBCYWNrIGJ1dHRvbiAtIGFic29sdXRlIHBvc2l0aW9uZWQgKi99XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQmFja31cbiAgICAgICAgY2xhc3M9XCJhYnNvbHV0ZSBsZWZ0LTQgcC0yIC1tLTIgdGV4dC1zZWNvbmRhcnkgaG92ZXI6dGV4dC1wcmltYXJ5IHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgYXJpYS1sYWJlbD1cIkdvIGJhY2tcIlxuICAgICAgPlxuICAgICAgICA8Q2hldnJvbkxlZnQgLz5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgXG4gICAgICB7LyogU29uZyBpbmZvIC0gY2VudGVyZWQgKi99XG4gICAgICA8aDEgY2xhc3M9XCJ0ZXh0LWJhc2UgZm9udC1tZWRpdW0gdGV4dC1wcmltYXJ5IHRleHQtY2VudGVyIHB4LTEyIHRydW5jYXRlIG1heC13LWZ1bGxcIj5cbiAgICAgICAge3Byb3BzLnNvbmdUaXRsZX0gLSB7cHJvcHMuYXJ0aXN0fVxuICAgICAgPC9oMT5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgRm9yIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBMZWFkZXJib2FyZEVudHJ5IHtcbiAgcmFuazogbnVtYmVyO1xuICB1c2VybmFtZTogc3RyaW5nO1xuICBzY29yZTogbnVtYmVyO1xuICBpc0N1cnJlbnRVc2VyPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMZWFkZXJib2FyZFBhbmVsUHJvcHMge1xuICBlbnRyaWVzOiBMZWFkZXJib2FyZEVudHJ5W107XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgTGVhZGVyYm9hcmRQYW5lbDogQ29tcG9uZW50PExlYWRlcmJvYXJkUGFuZWxQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZmxleCBmbGV4LWNvbCBnYXAtMiBwLTQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgPEZvciBlYWNoPXtwcm9wcy5lbnRyaWVzfT5cbiAgICAgICAgeyhlbnRyeSkgPT4gKFxuICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICdmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBweC0zIHB5LTIgcm91bmRlZC1sZyB0cmFuc2l0aW9uLWNvbG9ycycsXG4gICAgICAgICAgICAgIGVudHJ5LmlzQ3VycmVudFVzZXIgXG4gICAgICAgICAgICAgICAgPyAnYmctYWNjZW50LXByaW1hcnkvMTAgYm9yZGVyIGJvcmRlci1hY2NlbnQtcHJpbWFyeS8yMCcgXG4gICAgICAgICAgICAgICAgOiAnYmctc3VyZmFjZSBob3ZlcjpiZy1zdXJmYWNlLWhvdmVyJ1xuICAgICAgICAgICAgKX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8c3BhbiBcbiAgICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICd3LTggdGV4dC1jZW50ZXIgZm9udC1tb25vIGZvbnQtYm9sZCcsXG4gICAgICAgICAgICAgICAgZW50cnkucmFuayA8PSAzID8gJ3RleHQtYWNjZW50LXByaW1hcnknIDogJ3RleHQtc2Vjb25kYXJ5J1xuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAje2VudHJ5LnJhbmt9XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICA8c3BhbiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICdmbGV4LTEgdHJ1bmNhdGUnLFxuICAgICAgICAgICAgICBlbnRyeS5pc0N1cnJlbnRVc2VyID8gJ3RleHQtYWNjZW50LXByaW1hcnkgZm9udC1tZWRpdW0nIDogJ3RleHQtcHJpbWFyeSdcbiAgICAgICAgICAgICl9PlxuICAgICAgICAgICAgICB7ZW50cnkudXNlcm5hbWV9XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICA8c3BhbiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICdmb250LW1vbm8gZm9udC1ib2xkJyxcbiAgICAgICAgICAgICAgZW50cnkuaXNDdXJyZW50VXNlciA/ICd0ZXh0LWFjY2VudC1wcmltYXJ5JyA6ICd0ZXh0LXByaW1hcnknXG4gICAgICAgICAgICApfT5cbiAgICAgICAgICAgICAge2VudHJ5LnNjb3JlLnRvTG9jYWxlU3RyaW5nKCl9XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICl9XG4gICAgICA8L0Zvcj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IHR5cGUgUGxheWJhY2tTcGVlZCA9ICcxeCcgfCAnMC43NXgnIHwgJzAuNXgnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNwbGl0QnV0dG9uUHJvcHMge1xuICBvblN0YXJ0PzogKCkgPT4gdm9pZDtcbiAgb25TcGVlZENoYW5nZT86IChzcGVlZDogUGxheWJhY2tTcGVlZCkgPT4gdm9pZDtcbiAgZGlzYWJsZWQ/OiBib29sZWFuO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuY29uc3Qgc3BlZWRzOiBQbGF5YmFja1NwZWVkW10gPSBbJzF4JywgJzAuNzV4JywgJzAuNXgnXTtcblxuZXhwb3J0IGNvbnN0IFNwbGl0QnV0dG9uOiBDb21wb25lbnQ8U3BsaXRCdXR0b25Qcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2N1cnJlbnRTcGVlZEluZGV4LCBzZXRDdXJyZW50U3BlZWRJbmRleF0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIFxuICBjb25zdCBjdXJyZW50U3BlZWQgPSAoKSA9PiBzcGVlZHNbY3VycmVudFNwZWVkSW5kZXgoKV07XG4gIFxuICBjb25zdCBjeWNsZVNwZWVkID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGNvbnN0IG5leHRJbmRleCA9IChjdXJyZW50U3BlZWRJbmRleCgpICsgMSkgJSBzcGVlZHMubGVuZ3RoO1xuICAgIHNldEN1cnJlbnRTcGVlZEluZGV4KG5leHRJbmRleCk7XG4gICAgY29uc3QgbmV3U3BlZWQgPSBzcGVlZHNbbmV4dEluZGV4XTtcbiAgICBpZiAobmV3U3BlZWQpIHtcbiAgICAgIHByb3BzLm9uU3BlZWRDaGFuZ2U/LihuZXdTcGVlZCk7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBcbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ3JlbGF0aXZlIGlubGluZS1mbGV4IHctZnVsbCByb3VuZGVkLWxnIG92ZXJmbG93LWhpZGRlbicsXG4gICAgICAgICdiZy1ncmFkaWVudC1wcmltYXJ5IHRleHQtd2hpdGUgc2hhZG93LWxnJyxcbiAgICAgICAgJ3RyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIHsvKiBNYWluIGJ1dHRvbiAqL31cbiAgICAgIDxidXR0b25cbiAgICAgICAgb25DbGljaz17cHJvcHMub25TdGFydH1cbiAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmRpc2FibGVkfVxuICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgJ2ZsZXgtMSBpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcmVsYXRpdmUgb3ZlcmZsb3ctaGlkZGVuJyxcbiAgICAgICAgICAnaC0xMiBweC02IHRleHQtbGcgZm9udC1tZWRpdW0nLFxuICAgICAgICAgICdjdXJzb3ItcG9pbnRlciBib3JkZXItbm9uZSBvdXRsaW5lLW5vbmUnLFxuICAgICAgICAgICdkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS01MCcsXG4gICAgICAgICAgJ2hvdmVyOmJnLXdoaXRlLzEwIGFjdGl2ZTpiZy13aGl0ZS8yMCdcbiAgICAgICAgKX1cbiAgICAgID5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJyZWxhdGl2ZSB6LTEwXCI+U3RhcnQ8L3NwYW4+XG4gICAgICA8L2J1dHRvbj5cbiAgICAgIFxuICAgICAgey8qIERpdmlkZXIgKi99XG4gICAgICA8ZGl2IGNsYXNzPVwidy1weCBiZy1ibGFjay8yMFwiIC8+XG4gICAgICBcbiAgICAgIHsvKiBTcGVlZCBidXR0b24gKi99XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e2N5Y2xlU3BlZWR9XG4gICAgICAgIGRpc2FibGVkPXtwcm9wcy5kaXNhYmxlZH1cbiAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICdpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcmVsYXRpdmUnLFxuICAgICAgICAgICd3LTIwIHRleHQtbGcgZm9udC1tZWRpdW0nLFxuICAgICAgICAgICdjdXJzb3ItcG9pbnRlciBib3JkZXItbm9uZSBvdXRsaW5lLW5vbmUnLFxuICAgICAgICAgICdkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS01MCcsXG4gICAgICAgICAgJ2hvdmVyOmJnLXdoaXRlLzEwIGFjdGl2ZTpiZy13aGl0ZS8yMCcsXG4gICAgICAgICAgJ2FmdGVyOmNvbnRlbnQtW1wiXCJdIGFmdGVyOmFic29sdXRlIGFmdGVyOmluc2V0LTAnLFxuICAgICAgICAgICdhZnRlcjpiZy1ncmFkaWVudC10by1yIGFmdGVyOmZyb20tdHJhbnNwYXJlbnQgYWZ0ZXI6dmlhLXdoaXRlLzIwIGFmdGVyOnRvLXRyYW5zcGFyZW50JyxcbiAgICAgICAgICAnYWZ0ZXI6dHJhbnNsYXRlLXgtWy0yMDAlXSBob3ZlcjphZnRlcjp0cmFuc2xhdGUteC1bMjAwJV0nLFxuICAgICAgICAgICdhZnRlcjp0cmFuc2l0aW9uLXRyYW5zZm9ybSBhZnRlcjpkdXJhdGlvbi03MDAnXG4gICAgICAgICl9XG4gICAgICAgIGFyaWEtbGFiZWw9XCJDaGFuZ2UgcGxheWJhY2sgc3BlZWRcIlxuICAgICAgPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInJlbGF0aXZlIHotMTBcIj57Y3VycmVudFNwZWVkKCl9PC9zcGFuPlxuICAgICAgPC9idXR0b24+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCwgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50LCBKU1ggfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBUYWIge1xuICBpZDogc3RyaW5nO1xuICBsYWJlbDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNQcm9wcyB7XG4gIHRhYnM6IFRhYltdO1xuICBkZWZhdWx0VGFiPzogc3RyaW5nO1xuICBvblRhYkNoYW5nZT86ICh0YWJJZDogc3RyaW5nKSA9PiB2b2lkO1xuICBjaGlsZHJlbjogSlNYLkVsZW1lbnQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNMaXN0UHJvcHMge1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNUcmlnZ2VyUHJvcHMge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNDb250ZW50UHJvcHMge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG4vLyBHbG9iYWwgc3RhdGUgZm9yIHRoZSBjdXJyZW50IHRhYnMgaW5zdGFuY2VcbmxldCBjdXJyZW50VGFic1N0YXRlOiB7XG4gIGFjdGl2ZVRhYjogKCkgPT4gc3RyaW5nO1xuICBzZXRBY3RpdmVUYWI6IChpZDogc3RyaW5nKSA9PiB2b2lkO1xufSB8IG51bGwgPSBudWxsO1xuXG5leHBvcnQgY29uc3QgVGFiczogQ29tcG9uZW50PFRhYnNQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2FjdGl2ZVRhYiwgc2V0QWN0aXZlVGFiXSA9IGNyZWF0ZVNpZ25hbChwcm9wcy5kZWZhdWx0VGFiIHx8IHByb3BzLnRhYnNbMF0/LmlkIHx8ICcnKTtcbiAgXG4gIGNvbnN0IGhhbmRsZVRhYkNoYW5nZSA9IChpZDogc3RyaW5nKSA9PiB7XG4gICAgc2V0QWN0aXZlVGFiKGlkKTtcbiAgICBwcm9wcy5vblRhYkNoYW5nZT8uKGlkKTtcbiAgfTtcblxuICAvLyBTZXQgdGhlIGdsb2JhbCBzdGF0ZSBmb3IgY2hpbGQgY29tcG9uZW50cyB0byBhY2Nlc3NcbiAgY3VycmVudFRhYnNTdGF0ZSA9IHtcbiAgICBhY3RpdmVUYWIsXG4gICAgc2V0QWN0aXZlVGFiOiBoYW5kbGVUYWJDaGFuZ2VcbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCd3LWZ1bGwnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgIDwvZGl2PlxuICApO1xufTtcblxuZXhwb3J0IGNvbnN0IFRhYnNMaXN0OiBDb21wb25lbnQ8VGFic0xpc3RQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IFxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAnaW5saW5lLWZsZXggaC0xMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1tZCBiZy1zdXJmYWNlIHAtMSB0ZXh0LXNlY29uZGFyeScsXG4gICAgICAgICd3LWZ1bGwnLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgPC9kaXY+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgVGFic1RyaWdnZXI6IENvbXBvbmVudDxUYWJzVHJpZ2dlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBpc0FjdGl2ZSA9ICgpID0+IGN1cnJlbnRUYWJzU3RhdGU/LmFjdGl2ZVRhYigpID09PSBwcm9wcy52YWx1ZTtcblxuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIG9uQ2xpY2s9eygpID0+IGN1cnJlbnRUYWJzU3RhdGU/LnNldEFjdGl2ZVRhYihwcm9wcy52YWx1ZSl9XG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgd2hpdGVzcGFjZS1ub3dyYXAgcm91bmRlZC1zbSBweC0zIHB5LTEuNScsXG4gICAgICAgICd0ZXh0LXNtIGZvbnQtbWVkaXVtIHJpbmctb2Zmc2V0LWJhc2UgdHJhbnNpdGlvbi1hbGwnLFxuICAgICAgICAnZm9jdXMtdmlzaWJsZTpvdXRsaW5lLW5vbmUgZm9jdXMtdmlzaWJsZTpyaW5nLTIgZm9jdXMtdmlzaWJsZTpyaW5nLWFjY2VudC1wcmltYXJ5IGZvY3VzLXZpc2libGU6cmluZy1vZmZzZXQtMicsXG4gICAgICAgICdkaXNhYmxlZDpwb2ludGVyLWV2ZW50cy1ub25lIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICAnZmxleC0xJyxcbiAgICAgICAgaXNBY3RpdmUoKVxuICAgICAgICAgID8gJ2JnLWJhc2UgdGV4dC1wcmltYXJ5IHNoYWRvdy1zbSdcbiAgICAgICAgICA6ICd0ZXh0LXNlY29uZGFyeSBob3Zlcjp0ZXh0LXByaW1hcnknLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgPC9idXR0b24+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgVGFic0NvbnRlbnQ6IENvbXBvbmVudDxUYWJzQ29udGVudFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxTaG93IHdoZW49e2N1cnJlbnRUYWJzU3RhdGU/LmFjdGl2ZVRhYigpID09PSBwcm9wcy52YWx1ZX0+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnbXQtMiByaW5nLW9mZnNldC1iYXNlJyxcbiAgICAgICAgICAnZm9jdXMtdmlzaWJsZTpvdXRsaW5lLW5vbmUgZm9jdXMtdmlzaWJsZTpyaW5nLTIgZm9jdXMtdmlzaWJsZTpyaW5nLWFjY2VudC1wcmltYXJ5IGZvY3VzLXZpc2libGU6cmluZy1vZmZzZXQtMicsXG4gICAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICAgKX1cbiAgICAgID5cbiAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgPC9kaXY+XG4gICAgPC9TaG93PlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuaW1wb3J0IHsgU2NvcmVQYW5lbCB9IGZyb20gJy4uLy4uL2Rpc3BsYXkvU2NvcmVQYW5lbCc7XG5pbXBvcnQgeyBMeXJpY3NEaXNwbGF5LCB0eXBlIEx5cmljTGluZSB9IGZyb20gJy4uL0x5cmljc0Rpc3BsYXknO1xuaW1wb3J0IHsgTGVhZGVyYm9hcmRQYW5lbCwgdHlwZSBMZWFkZXJib2FyZEVudHJ5IH0gZnJvbSAnLi4vTGVhZGVyYm9hcmRQYW5lbCc7XG5pbXBvcnQgeyBTcGxpdEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5pbXBvcnQgdHlwZSB7IFBsYXliYWNrU3BlZWQgfSBmcm9tICcuLi8uLi9jb21tb24vU3BsaXRCdXR0b24nO1xuaW1wb3J0IHsgVGFicywgVGFic0xpc3QsIFRhYnNUcmlnZ2VyLCBUYWJzQ29udGVudCB9IGZyb20gJy4uLy4uL2NvbW1vbi9UYWJzJztcblxuZXhwb3J0IGludGVyZmFjZSBFeHRlbnNpb25LYXJhb2tlVmlld1Byb3BzIHtcbiAgLy8gU2NvcmVzXG4gIHNjb3JlOiBudW1iZXI7XG4gIHJhbms6IG51bWJlcjtcbiAgXG4gIC8vIEx5cmljc1xuICBseXJpY3M6IEx5cmljTGluZVtdO1xuICBjdXJyZW50VGltZT86IG51bWJlcjtcbiAgXG4gIC8vIExlYWRlcmJvYXJkXG4gIGxlYWRlcmJvYXJkOiBMZWFkZXJib2FyZEVudHJ5W107XG4gIFxuICAvLyBTdGF0ZVxuICBpc1BsYXlpbmc/OiBib29sZWFuO1xuICBvblN0YXJ0PzogKCkgPT4gdm9pZDtcbiAgb25TcGVlZENoYW5nZT86IChzcGVlZDogUGxheWJhY2tTcGVlZCkgPT4gdm9pZDtcbiAgXG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgRXh0ZW5zaW9uS2FyYW9rZVZpZXc6IENvbXBvbmVudDxFeHRlbnNpb25LYXJhb2tlVmlld1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sIGgtZnVsbCBiZy1iYXNlJywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBTY29yZSBQYW5lbCAqL31cbiAgICAgIDxTY29yZVBhbmVsXG4gICAgICAgIHNjb3JlPXtwcm9wcy5zY29yZX1cbiAgICAgICAgcmFuaz17cHJvcHMucmFua31cbiAgICAgIC8+XG5cbiAgICAgIHsvKiBUYWJzIGFuZCBjb250ZW50ICovfVxuICAgICAgPFRhYnMgXG4gICAgICAgIHRhYnM9e1tcbiAgICAgICAgICB7IGlkOiAnbHlyaWNzJywgbGFiZWw6ICdMeXJpY3MnIH0sXG4gICAgICAgICAgeyBpZDogJ2xlYWRlcmJvYXJkJywgbGFiZWw6ICdMZWFkZXJib2FyZCcgfVxuICAgICAgICBdfVxuICAgICAgICBkZWZhdWx0VGFiPVwibHlyaWNzXCJcbiAgICAgICAgY2xhc3M9XCJmbGV4LTEgZmxleCBmbGV4LWNvbCBvdmVyZmxvdy1oaWRkZW5cIlxuICAgICAgPlxuICAgICAgICA8ZGl2IGNsYXNzPVwicHgtNFwiPlxuICAgICAgICAgIDxUYWJzTGlzdD5cbiAgICAgICAgICAgIDxUYWJzVHJpZ2dlciB2YWx1ZT1cImx5cmljc1wiPkx5cmljczwvVGFic1RyaWdnZXI+XG4gICAgICAgICAgICA8VGFic1RyaWdnZXIgdmFsdWU9XCJsZWFkZXJib2FyZFwiPkxlYWRlcmJvYXJkPC9UYWJzVHJpZ2dlcj5cbiAgICAgICAgICA8L1RhYnNMaXN0PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgXG4gICAgICAgIDxUYWJzQ29udGVudCB2YWx1ZT1cImx5cmljc1wiIGNsYXNzPVwiZmxleC0xIGZsZXggZmxleC1jb2wgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgIDxMeXJpY3NEaXNwbGF5XG4gICAgICAgICAgICAgIGx5cmljcz17cHJvcHMubHlyaWNzfVxuICAgICAgICAgICAgICBjdXJyZW50VGltZT17cHJvcHMuY3VycmVudFRpbWV9XG4gICAgICAgICAgICAgIGlzUGxheWluZz17cHJvcHMuaXNQbGF5aW5nfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICBcbiAgICAgICAgICB7LyogRm9vdGVyIHdpdGggc3RhcnQgYnV0dG9uICovfVxuICAgICAgICAgIHshcHJvcHMuaXNQbGF5aW5nICYmIHByb3BzLm9uU3RhcnQgJiYgKFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInAtNCBiZy1zdXJmYWNlIGJvcmRlci10IGJvcmRlci1zdWJ0bGVcIj5cbiAgICAgICAgICAgICAgPFNwbGl0QnV0dG9uXG4gICAgICAgICAgICAgICAgb25TdGFydD17cHJvcHMub25TdGFydH1cbiAgICAgICAgICAgICAgICBvblNwZWVkQ2hhbmdlPXtwcm9wcy5vblNwZWVkQ2hhbmdlfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9UYWJzQ29udGVudD5cbiAgICAgICAgXG4gICAgICAgIDxUYWJzQ29udGVudCB2YWx1ZT1cImxlYWRlcmJvYXJkXCIgY2xhc3M9XCJmbGV4LTEgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm92ZXJmbG93LXktYXV0byBoLWZ1bGxcIj5cbiAgICAgICAgICAgIDxMZWFkZXJib2FyZFBhbmVsIGVudHJpZXM9e3Byb3BzLmxlYWRlcmJvYXJkfSAvPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L1RhYnNDb250ZW50PlxuICAgICAgPC9UYWJzPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgSWNvblhSZWd1bGFyIGZyb20gJ3Bob3NwaG9yLWljb25zLXNvbGlkL0ljb25YUmVndWxhcic7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBQcmFjdGljZUhlYWRlclByb3BzIHtcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIG9uRXhpdDogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBQcmFjdGljZUhlYWRlcjogQ29tcG9uZW50PFByYWN0aWNlSGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGhlYWRlciBjbGFzcz17Y24oJ2ZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBoLTE0IHB4LTQgYmctdHJhbnNwYXJlbnQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkV4aXR9XG4gICAgICAgIGNsYXNzPVwicC0yIC1tbC0yIHJvdW5kZWQtZnVsbCBob3ZlcjpiZy1oaWdobGlnaHQgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICBhcmlhLWxhYmVsPVwiRXhpdCBwcmFjdGljZVwiXG4gICAgICA+XG4gICAgICAgIDxJY29uWFJlZ3VsYXIgY2xhc3M9XCJ0ZXh0LXNlY29uZGFyeSB3LTYgaC02XCIgLz5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgXG4gICAgICA8U2hvdyB3aGVuPXtwcm9wcy50aXRsZX0+XG4gICAgICAgIDxoMSBjbGFzcz1cInRleHQtbGcgZm9udC1zZW1pYm9sZCB0ZXh0LXByaW1hcnkgYWJzb2x1dGUgbGVmdC0xLzIgdHJhbnNmb3JtIC10cmFuc2xhdGUteC0xLzJcIj5cbiAgICAgICAgICB7cHJvcHMudGl0bGV9XG4gICAgICAgIDwvaDE+XG4gICAgICA8L1Nob3c+XG4gICAgICBcbiAgICAgIHsvKiBTcGFjZXIgdG8gYmFsYW5jZSB0aGUgbGF5b3V0ICovfVxuICAgICAgPGRpdiBjbGFzcz1cInctMTBcIiAvPlxuICAgIDwvaGVhZGVyPlxuICApO1xufTsiLCJleHBvcnQgaW50ZXJmYWNlIEthcmFva2VEYXRhIHtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgdHJhY2tJZDogc3RyaW5nO1xuICBoYXNLYXJhb2tlOiBib29sZWFuO1xuICBzb25nPzoge1xuICAgIGlkOiBzdHJpbmc7XG4gICAgdGl0bGU6IHN0cmluZztcbiAgICBhcnRpc3Q6IHN0cmluZztcbiAgICBhbGJ1bT86IHN0cmluZztcbiAgICBhcnR3b3JrVXJsPzogc3RyaW5nO1xuICAgIGR1cmF0aW9uPzogbnVtYmVyO1xuICAgIGRpZmZpY3VsdHk6ICdiZWdpbm5lcicgfCAnaW50ZXJtZWRpYXRlJyB8ICdhZHZhbmNlZCc7XG4gIH07XG4gIGx5cmljcz86IHtcbiAgICBzb3VyY2U6IHN0cmluZztcbiAgICB0eXBlOiAnc3luY2VkJztcbiAgICBsaW5lczogTHlyaWNMaW5lW107XG4gICAgdG90YWxMaW5lczogbnVtYmVyO1xuICB9O1xuICBtZXNzYWdlPzogc3RyaW5nO1xuICBlcnJvcj86IHN0cmluZztcbiAgYXBpX2Nvbm5lY3RlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTHlyaWNMaW5lIHtcbiAgaWQ6IHN0cmluZztcbiAgdGV4dDogc3RyaW5nO1xuICBzdGFydFRpbWU6IG51bWJlcjtcbiAgZHVyYXRpb246IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlU2Vzc2lvbiB7XG4gIGlkOiBzdHJpbmc7XG4gIHRyYWNrSWQ6IHN0cmluZztcbiAgc29uZ1RpdGxlOiBzdHJpbmc7XG4gIHNvbmdBcnRpc3Q6IHN0cmluZztcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGNyZWF0ZWRBdDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgS2FyYW9rZUFwaVNlcnZpY2Uge1xuICBwcml2YXRlIGJhc2VVcmw6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICAvLyBVc2UgdGhlIGxvY2FsIHNlcnZlciBlbmRwb2ludFxuICAgIHRoaXMuYmFzZVVybCA9ICdodHRwOi8vbG9jYWxob3N0Ojg3ODcvYXBpJztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQga2FyYW9rZSBkYXRhIGZvciBhIHRyYWNrIElEIChZb3VUdWJlL1NvdW5kQ2xvdWQpXG4gICAqL1xuICBhc3luYyBnZXRLYXJhb2tlRGF0YShcbiAgICB0cmFja0lkOiBzdHJpbmcsIFxuICAgIHRpdGxlPzogc3RyaW5nLCBcbiAgICBhcnRpc3Q/OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxLYXJhb2tlRGF0YSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xuICAgICAgaWYgKHRpdGxlKSBwYXJhbXMuc2V0KCd0aXRsZScsIHRpdGxlKTtcbiAgICAgIGlmIChhcnRpc3QpIHBhcmFtcy5zZXQoJ2FydGlzdCcsIGFydGlzdCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0va2FyYW9rZS8ke2VuY29kZVVSSUNvbXBvbmVudCh0cmFja0lkKX0ke3BhcmFtcy50b1N0cmluZygpID8gJz8nICsgcGFyYW1zLnRvU3RyaW5nKCkgOiAnJ31gO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VBcGldIEZldGNoaW5nIGthcmFva2UgZGF0YTonLCB1cmwpO1xuICAgICAgXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gZmV0Y2gga2FyYW9rZSBkYXRhOicsIHJlc3BvbnNlLnN0YXR1cyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXBpXSBSZWNlaXZlZCBrYXJhb2tlIGRhdGE6JywgZGF0YSk7XG4gICAgICBcbiAgICAgIC8vIElmIHRoZXJlJ3MgYW4gZXJyb3IgYnV0IHdlIGdvdCBhIHJlc3BvbnNlLCBpdCBtZWFucyBBUEkgaXMgY29ubmVjdGVkXG4gICAgICBpZiAoZGF0YS5lcnJvcikge1xuICAgICAgICBjb25zb2xlLmxvZygnW0thcmFva2VBcGldIFNlcnZlciBlcnJvciAoYnV0IEFQSSBpcyByZWFjaGFibGUpOicsIGRhdGEuZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGhhc0thcmFva2U6IGZhbHNlLFxuICAgICAgICAgIGVycm9yOiBkYXRhLmVycm9yLFxuICAgICAgICAgIHRyYWNrSWQ6IHRyYWNrSWQsXG4gICAgICAgICAgYXBpX2Nvbm5lY3RlZDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEVycm9yIGZldGNoaW5nIGthcmFva2UgZGF0YTonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgYSBrYXJhb2tlIHNlc3Npb25cbiAgICovXG4gIGFzeW5jIHN0YXJ0U2Vzc2lvbihcbiAgICB0cmFja0lkOiBzdHJpbmcsXG4gICAgc29uZ0RhdGE6IHtcbiAgICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgICBhcnRpc3Q6IHN0cmluZztcbiAgICAgIGFsYnVtPzogc3RyaW5nO1xuICAgICAgZHVyYXRpb24/OiBudW1iZXI7XG4gICAgfVxuICApOiBQcm9taXNlPEthcmFva2VTZXNzaW9uIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuYmFzZVVybH0va2FyYW9rZS9zdGFydGAsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgIC8vIFRPRE86IEFkZCBhdXRoIHRva2VuIHdoZW4gYXZhaWxhYmxlXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICB0cmFja0lkLFxuICAgICAgICAgIHNvbmdEYXRhLFxuICAgICAgICB9KSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gc3RhcnQgc2Vzc2lvbjonLCByZXNwb25zZS5zdGF0dXMpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgcmV0dXJuIHJlc3VsdC5zZXNzaW9uO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRXJyb3Igc3RhcnRpbmcgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGVzdCBjb25uZWN0aW9uIHRvIHRoZSBBUElcbiAgICovXG4gIGFzeW5jIHRlc3RDb25uZWN0aW9uKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuYmFzZVVybC5yZXBsYWNlKCcvYXBpJywgJycpfS9oZWFsdGhgKTtcbiAgICAgIHJldHVybiByZXNwb25zZS5vaztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIENvbm5lY3Rpb24gdGVzdCBmYWlsZWQ6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY29uc3Qga2FyYW9rZUFwaSA9IG5ldyBLYXJhb2tlQXBpU2VydmljZSgpOyIsImV4cG9ydCBpbnRlcmZhY2UgVHJhY2tJbmZvIHtcbiAgdHJhY2tJZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBhcnRpc3Q6IHN0cmluZztcbiAgcGxhdGZvcm06ICdzb3VuZGNsb3VkJztcbiAgdXJsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFja0RldGVjdG9yIHtcbiAgLyoqXG4gICAqIERldGVjdCBjdXJyZW50IHRyYWNrIGZyb20gdGhlIHBhZ2UgKFNvdW5kQ2xvdWQgb25seSlcbiAgICovXG4gIGRldGVjdEN1cnJlbnRUcmFjaygpOiBUcmFja0luZm8gfCBudWxsIHtcbiAgICBjb25zdCB1cmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICBcbiAgICAvLyBPbmx5IHdvcmsgb24gc2MubWFpZC56b25lIChTb3VuZENsb3VkIHByb3h5KVxuICAgIGlmICh1cmwuaW5jbHVkZXMoJ3NjLm1haWQuem9uZScpKSB7XG4gICAgICByZXR1cm4gdGhpcy5kZXRlY3RTb3VuZENsb3VkVHJhY2soKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IHRyYWNrIGluZm8gZnJvbSBTb3VuZENsb3VkIChzYy5tYWlkLnpvbmUpXG4gICAqL1xuICBwcml2YXRlIGRldGVjdFNvdW5kQ2xvdWRUcmFjaygpOiBUcmFja0luZm8gfCBudWxsIHtcbiAgICB0cnkge1xuICAgICAgLy8gU291bmRDbG91ZCBVUkxzOiBzYy5tYWlkLnpvbmUvdXNlci90cmFjay1uYW1lXG4gICAgICBjb25zdCBwYXRoUGFydHMgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBpZiAocGF0aFBhcnRzLmxlbmd0aCA8IDIpIHJldHVybiBudWxsO1xuXG4gICAgICBjb25zdCBhcnRpc3QgPSBwYXRoUGFydHNbMF07XG4gICAgICBjb25zdCB0cmFja1NsdWcgPSBwYXRoUGFydHNbMV07XG4gICAgICBcbiAgICAgIC8vIFRyeSB0byBnZXQgYWN0dWFsIHRpdGxlIGZyb20gcGFnZSAoU291bmRDbG91ZCBzZWxlY3RvcnMpXG4gICAgICBjb25zdCB0aXRsZVNlbGVjdG9ycyA9IFtcbiAgICAgICAgJy5zb3VuZFRpdGxlX190aXRsZScsXG4gICAgICAgICcudHJhY2tJdGVtX190cmFja1RpdGxlJywgXG4gICAgICAgICdoMVtpdGVtcHJvcD1cIm5hbWVcIl0nLFxuICAgICAgICAnLnNvdW5kX19oZWFkZXIgaDEnLFxuICAgICAgICAnLnNjLXRleHQtaDQnLFxuICAgICAgICAnLnNjLXRleHQtcHJpbWFyeSdcbiAgICAgIF07XG5cbiAgICAgIGxldCB0aXRsZSA9ICcnO1xuICAgICAgZm9yIChjb25zdCBzZWxlY3RvciBvZiB0aXRsZVNlbGVjdG9ycykge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gICAgICAgIGlmIChlbGVtZW50ICYmIGVsZW1lbnQudGV4dENvbnRlbnQpIHtcbiAgICAgICAgICB0aXRsZSA9IGVsZW1lbnQudGV4dENvbnRlbnQudHJpbSgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEZhbGxiYWNrIHRvIHNsdWdcbiAgICAgIGlmICghdGl0bGUpIHtcbiAgICAgICAgdGl0bGUgPSB0cmFja1NsdWcucmVwbGFjZSgvLS9nLCAnICcpO1xuICAgICAgfVxuXG4gICAgICAvLyBDbGVhbiB1cCBhcnRpc3QgbmFtZVxuICAgICAgY29uc3QgY2xlYW5BcnRpc3QgPSBhcnRpc3QucmVwbGFjZSgvLS9nLCAnICcpLnJlcGxhY2UoL18vZywgJyAnKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHJhY2tJZDogYCR7YXJ0aXN0fS8ke3RyYWNrU2x1Z31gLFxuICAgICAgICB0aXRsZTogdGl0bGUsXG4gICAgICAgIGFydGlzdDogY2xlYW5BcnRpc3QsXG4gICAgICAgIHBsYXRmb3JtOiAnc291bmRjbG91ZCcsXG4gICAgICAgIHVybDogd2luZG93LmxvY2F0aW9uLmhyZWYsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbVHJhY2tEZXRlY3Rvcl0gRXJyb3IgZGV0ZWN0aW5nIFNvdW5kQ2xvdWQgdHJhY2s6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cblxuICAvKipcbiAgICogV2F0Y2ggZm9yIHBhZ2UgY2hhbmdlcyAoU291bmRDbG91ZCBpcyBhIFNQQSlcbiAgICovXG4gIHdhdGNoRm9yQ2hhbmdlcyhjYWxsYmFjazogKHRyYWNrOiBUcmFja0luZm8gfCBudWxsKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XG4gICAgbGV0IGN1cnJlbnRVcmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICBsZXQgY3VycmVudFRyYWNrID0gdGhpcy5kZXRlY3RDdXJyZW50VHJhY2soKTtcbiAgICBcbiAgICAvLyBJbml0aWFsIGRldGVjdGlvblxuICAgIGNhbGxiYWNrKGN1cnJlbnRUcmFjayk7XG5cbiAgICAvLyBXYXRjaCBmb3IgVVJMIGNoYW5nZXNcbiAgICBjb25zdCBjaGVja0ZvckNoYW5nZXMgPSAoKSA9PiB7XG4gICAgICBjb25zdCBuZXdVcmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICAgIGlmIChuZXdVcmwgIT09IGN1cnJlbnRVcmwpIHtcbiAgICAgICAgY3VycmVudFVybCA9IG5ld1VybDtcbiAgICAgICAgY29uc3QgbmV3VHJhY2sgPSB0aGlzLmRldGVjdEN1cnJlbnRUcmFjaygpO1xuICAgICAgICBcbiAgICAgICAgLy8gT25seSB0cmlnZ2VyIGNhbGxiYWNrIGlmIHRyYWNrIGFjdHVhbGx5IGNoYW5nZWRcbiAgICAgICAgY29uc3QgdHJhY2tDaGFuZ2VkID0gIWN1cnJlbnRUcmFjayB8fCAhbmV3VHJhY2sgfHwgXG4gICAgICAgICAgY3VycmVudFRyYWNrLnRyYWNrSWQgIT09IG5ld1RyYWNrLnRyYWNrSWQ7XG4gICAgICAgICAgXG4gICAgICAgIGlmICh0cmFja0NoYW5nZWQpIHtcbiAgICAgICAgICBjdXJyZW50VHJhY2sgPSBuZXdUcmFjaztcbiAgICAgICAgICBjYWxsYmFjayhuZXdUcmFjayk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gUG9sbCBmb3IgY2hhbmdlcyAoU1BBcyBkb24ndCBhbHdheXMgdHJpZ2dlciBwcm9wZXIgbmF2aWdhdGlvbiBldmVudHMpXG4gICAgY29uc3QgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChjaGVja0ZvckNoYW5nZXMsIDEwMDApO1xuXG4gICAgLy8gQWxzbyBsaXN0ZW4gZm9yIG5hdmlnYXRpb24gZXZlbnRzXG4gICAgY29uc3QgaGFuZGxlTmF2aWdhdGlvbiA9ICgpID0+IHtcbiAgICAgIHNldFRpbWVvdXQoY2hlY2tGb3JDaGFuZ2VzLCAxMDApOyAvLyBTbWFsbCBkZWxheSBmb3IgRE9NIHVwZGF0ZXNcbiAgICB9O1xuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgaGFuZGxlTmF2aWdhdGlvbik7XG4gICAgXG4gICAgLy8gTGlzdGVuIGZvciBwdXNoc3RhdGUvcmVwbGFjZXN0YXRlIChTb3VuZENsb3VkIHVzZXMgdGhlc2UpXG4gICAgY29uc3Qgb3JpZ2luYWxQdXNoU3RhdGUgPSBoaXN0b3J5LnB1c2hTdGF0ZTtcbiAgICBjb25zdCBvcmlnaW5hbFJlcGxhY2VTdGF0ZSA9IGhpc3RvcnkucmVwbGFjZVN0YXRlO1xuICAgIFxuICAgIGhpc3RvcnkucHVzaFN0YXRlID0gZnVuY3Rpb24oLi4uYXJncykge1xuICAgICAgb3JpZ2luYWxQdXNoU3RhdGUuYXBwbHkoaGlzdG9yeSwgYXJncyk7XG4gICAgICBoYW5kbGVOYXZpZ2F0aW9uKCk7XG4gICAgfTtcbiAgICBcbiAgICBoaXN0b3J5LnJlcGxhY2VTdGF0ZSA9IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICAgIG9yaWdpbmFsUmVwbGFjZVN0YXRlLmFwcGx5KGhpc3RvcnksIGFyZ3MpO1xuICAgICAgaGFuZGxlTmF2aWdhdGlvbigpO1xuICAgIH07XG5cbiAgICAvLyBSZXR1cm4gY2xlYW51cCBmdW5jdGlvblxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb3BzdGF0ZScsIGhhbmRsZU5hdmlnYXRpb24pO1xuICAgICAgaGlzdG9yeS5wdXNoU3RhdGUgPSBvcmlnaW5hbFB1c2hTdGF0ZTtcbiAgICAgIGhpc3RvcnkucmVwbGFjZVN0YXRlID0gb3JpZ2luYWxSZXBsYWNlU3RhdGU7XG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgdHJhY2tEZXRlY3RvciA9IG5ldyBUcmFja0RldGVjdG9yKCk7IiwiaW1wb3J0IHsgQ29tcG9uZW50LCBjcmVhdGVTaWduYWwsIGNyZWF0ZUVmZmVjdCwgb25Nb3VudCwgb25DbGVhbnVwIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uS2FyYW9rZVZpZXcgfSBmcm9tICdAc2NhcmxldHQvdWknO1xuaW1wb3J0IHsga2FyYW9rZUFwaSwgdHlwZSBLYXJhb2tlRGF0YSwgdHlwZSBMeXJpY0xpbmUgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9rYXJhb2tlLWFwaSc7XG5pbXBvcnQgeyB0cmFja0RldGVjdG9yLCB0eXBlIFRyYWNrSW5mbyB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3RyYWNrLWRldGVjdG9yJztcblxuZXhwb3J0IGludGVyZmFjZSBDb250ZW50QXBwUHJvcHMge1xuICAvLyBBZGQgYW55IHByb3BzIG5lZWRlZCBmb3IgY29tbXVuaWNhdGlvbiB3aXRoIHRoZSBwYWdlXG59XG5cbmV4cG9ydCBjb25zdCBDb250ZW50QXBwOiBDb21wb25lbnQ8Q29udGVudEFwcFByb3BzPiA9ICgpID0+IHtcbiAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBSZW5kZXJpbmcgQ29udGVudEFwcCBjb21wb25lbnQnKTtcbiAgXG4gIC8vIFN0YXRlXG4gIGNvbnN0IFtjdXJyZW50VHJhY2ssIHNldEN1cnJlbnRUcmFja10gPSBjcmVhdGVTaWduYWw8VHJhY2tJbmZvIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtrYXJhb2tlRGF0YSwgc2V0S2FyYW9rZURhdGFdID0gY3JlYXRlU2lnbmFsPEthcmFva2VEYXRhIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtpc0xvYWRpbmcsIHNldElzTG9hZGluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IGNyZWF0ZVNpZ25hbDxzdHJpbmcgfCBudWxsPihudWxsKTtcbiAgXG4gIC8vIE1vY2sgbGVhZGVyYm9hcmQgZGF0YSAoVE9ETzogZmV0Y2ggcmVhbCBsZWFkZXJib2FyZClcbiAgY29uc3QgbW9ja0xlYWRlcmJvYXJkID0gW1xuICAgIHsgcmFuazogMSwgdXNlcm5hbWU6ICdLYXJhb2tlS2luZycsIHNjb3JlOiAxMjUwMCB9LFxuICAgIHsgcmFuazogMiwgdXNlcm5hbWU6ICdTb25nQmlyZDkyJywgc2NvcmU6IDExMjAwIH0sXG4gICAgeyByYW5rOiAzLCB1c2VybmFtZTogJ01lbG9keU1hc3RlcicsIHNjb3JlOiAxMDgwMCB9LFxuICAgIHsgcmFuazogNCwgdXNlcm5hbWU6ICdDdXJyZW50VXNlcicsIHNjb3JlOiA4NzUwLCBpc0N1cnJlbnRVc2VyOiB0cnVlIH0sXG4gICAgeyByYW5rOiA1LCB1c2VybmFtZTogJ1ZvY2FsVmlydHVvc28nLCBzY29yZTogODIwMCB9LFxuICBdO1xuXG4gIC8vIEZldGNoIGthcmFva2UgZGF0YSB3aGVuIHRyYWNrIGNoYW5nZXNcbiAgY3JlYXRlRWZmZWN0KGFzeW5jICgpID0+IHtcbiAgICBjb25zdCB0cmFjayA9IGN1cnJlbnRUcmFjaygpO1xuICAgIGlmICghdHJhY2spIHtcbiAgICAgIHNldEthcmFva2VEYXRhKG51bGwpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRmV0Y2hpbmcga2FyYW9rZSBkYXRhIGZvciB0cmFjazonLCB0cmFjayk7XG4gICAgc2V0SXNMb2FkaW5nKHRydWUpO1xuICAgIHNldEVycm9yKG51bGwpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBrYXJhb2tlQXBpLmdldEthcmFva2VEYXRhKFxuICAgICAgICB0cmFjay50cmFja0lkLFxuICAgICAgICB0cmFjay50aXRsZSxcbiAgICAgICAgdHJhY2suYXJ0aXN0XG4gICAgICApO1xuXG4gICAgICBpZiAoZGF0YSAmJiBkYXRhLmhhc0thcmFva2UpIHtcbiAgICAgICAgc2V0S2FyYW9rZURhdGEoZGF0YSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gS2FyYW9rZSBkYXRhIGxvYWRlZDonLCBkYXRhKTtcbiAgICAgIH0gZWxzZSBpZiAoZGF0YT8uYXBpX2Nvbm5lY3RlZCkge1xuICAgICAgICBzZXRFcnJvcihgQVBJIENvbm5lY3RlZCEgJHtkYXRhLmVycm9yIHx8ICdEYXRhYmFzZSBzZXR1cCBuZWVkZWQnfWApO1xuICAgICAgICBzZXRLYXJhb2tlRGF0YShkYXRhKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldEVycm9yKGRhdGE/Lm1lc3NhZ2UgfHwgZGF0YT8uZXJyb3IgfHwgJ05vIGthcmFva2UgZGF0YSBhdmFpbGFibGUgZm9yIHRoaXMgdHJhY2snKTtcbiAgICAgICAgc2V0S2FyYW9rZURhdGEobnVsbCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQ29udGVudEFwcF0gRXJyb3IgZmV0Y2hpbmcga2FyYW9rZSBkYXRhOicsIGVycik7XG4gICAgICBzZXRFcnJvcignRmFpbGVkIHRvIGxvYWQga2FyYW9rZSBkYXRhJyk7XG4gICAgICBzZXRLYXJhb2tlRGF0YShudWxsKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0SXNMb2FkaW5nKGZhbHNlKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIFNldCB1cCB0cmFjayBkZXRlY3Rpb25cbiAgb25Nb3VudCgoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTZXR0aW5nIHVwIHRyYWNrIGRldGVjdGlvbicpO1xuICAgIFxuICAgIC8vIFN0YXJ0IHdhdGNoaW5nIGZvciB0cmFjayBjaGFuZ2VzXG4gICAgY29uc3QgY2xlYW51cCA9IHRyYWNrRGV0ZWN0b3Iud2F0Y2hGb3JDaGFuZ2VzKCh0cmFjaykgPT4ge1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBUcmFjayBjaGFuZ2VkOicsIHRyYWNrKTtcbiAgICAgIHNldEN1cnJlbnRUcmFjayh0cmFjayk7XG4gICAgfSk7XG5cbiAgICBvbkNsZWFudXAoY2xlYW51cCk7XG4gIH0pO1xuXG4gIC8vIENvbnZlcnQgc2VydmVyIGx5cmljcyBmb3JtYXQgdG8gY29tcG9uZW50IGZvcm1hdFxuICBjb25zdCBnZXRMeXJpY3MgPSAoKTogTHlyaWNMaW5lW10gPT4ge1xuICAgIGNvbnN0IGRhdGEgPSBrYXJhb2tlRGF0YSgpO1xuICAgIGlmICghZGF0YT8ubHlyaWNzPy5saW5lcykgcmV0dXJuIFtdO1xuXG4gICAgcmV0dXJuIGRhdGEubHlyaWNzLmxpbmVzLm1hcCgobGluZSwgaW5kZXgpID0+ICh7XG4gICAgICBpZDogbGluZS5pZCB8fCBgbGluZS0ke2luZGV4fWAsXG4gICAgICB0ZXh0OiBsaW5lLnRleHQsXG4gICAgICBzdGFydFRpbWU6IGxpbmUuc3RhcnRUaW1lLFxuICAgICAgZHVyYXRpb246IGxpbmUuZHVyYXRpb24sXG4gICAgfSkpO1xuICB9O1xuXG4gIC8vIFByZXBhcmUgcHJvcHMgZm9yIEV4dGVuc2lvbkthcmFva2VWaWV3XG4gIGNvbnN0IGdldFZpZXdQcm9wcyA9ICgpID0+IHtcbiAgICBjb25zdCBkYXRhID0ga2FyYW9rZURhdGEoKTtcbiAgICBjb25zdCB0cmFjayA9IGN1cnJlbnRUcmFjaygpO1xuICAgIFxuICAgIGlmIChpc0xvYWRpbmcoKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc2NvcmU6IDAsXG4gICAgICAgIHJhbms6IDAsXG4gICAgICAgIGx5cmljczogW3sgaWQ6ICdsb2FkaW5nJywgdGV4dDogJ0xvYWRpbmcgbHlyaWNzLi4uJywgc3RhcnRUaW1lOiAwLCBkdXJhdGlvbjogMyB9XSxcbiAgICAgICAgbGVhZGVyYm9hcmQ6IFtdLFxuICAgICAgICBjdXJyZW50VGltZTogMCxcbiAgICAgICAgaXNQbGF5aW5nOiBmYWxzZSxcbiAgICAgICAgb25TdGFydDogKCkgPT4gY29uc29sZS5sb2coJ0xvYWRpbmcuLi4nKSxcbiAgICAgICAgb25TcGVlZENoYW5nZTogKCkgPT4ge30sXG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmIChlcnJvcigpIHx8ICFkYXRhPy5oYXNLYXJhb2tlKSB7XG4gICAgICBjb25zdCBlcnJvck1lc3NhZ2UgPSBlcnJvcigpIHx8ICdObyBrYXJhb2tlIGF2YWlsYWJsZSBmb3IgdGhpcyB0cmFjayc7XG4gICAgICBjb25zdCBpc0FwaUNvbm5lY3RlZCA9IGVycm9yTWVzc2FnZS5pbmNsdWRlcygnQ2Fubm90IHJlYWQgcHJvcGVydGllcycpIHx8IGVycm9yTWVzc2FnZS5pbmNsdWRlcygncHJlcGFyZScpO1xuICAgICAgXG4gICAgICByZXR1cm4ge1xuICAgICAgICBzY29yZTogMCxcbiAgICAgICAgcmFuazogMCxcbiAgICAgICAgbHlyaWNzOiBbeyBcbiAgICAgICAgICBpZDogJ2Vycm9yJywgXG4gICAgICAgICAgdGV4dDogaXNBcGlDb25uZWN0ZWQgXG4gICAgICAgICAgICA/IGDinIUgQVBJIENvbm5lY3RlZCEgU2VydmVyIG5lZWRzIGRhdGFiYXNlIHNldHVwLiBUcmFjazogJHt0cmFjaz8udGl0bGV9YCBcbiAgICAgICAgICAgIDogZXJyb3JNZXNzYWdlLCBcbiAgICAgICAgICBzdGFydFRpbWU6IDAsIFxuICAgICAgICAgIGR1cmF0aW9uOiA4IFxuICAgICAgICB9XSxcbiAgICAgICAgbGVhZGVyYm9hcmQ6IFtdLFxuICAgICAgICBjdXJyZW50VGltZTogMCxcbiAgICAgICAgaXNQbGF5aW5nOiBmYWxzZSxcbiAgICAgICAgb25TdGFydDogKCkgPT4gY29uc29sZS5sb2coJ0FQSSBjb25uZWN0aW9uIHRlc3Qgc3VjY2Vzc2Z1bCcpLFxuICAgICAgICBvblNwZWVkQ2hhbmdlOiAoKSA9PiB7fSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHNjb3JlOiA4NzUwLCAvLyBUT0RPOiBHZXQgcmVhbCB1c2VyIHNjb3JlXG4gICAgICByYW5rOiA0LCAvLyBUT0RPOiBHZXQgcmVhbCB1c2VyIHJhbmtcbiAgICAgIGx5cmljczogZ2V0THlyaWNzKCksXG4gICAgICBsZWFkZXJib2FyZDogbW9ja0xlYWRlcmJvYXJkLFxuICAgICAgY3VycmVudFRpbWU6IDAsIC8vIFRPRE86IFN5bmMgd2l0aCB2aWRlby9hdWRpbyBwbGF5YmFja1xuICAgICAgaXNQbGF5aW5nOiBmYWxzZSwgLy8gVE9ETzogRGV0ZWN0IGlmIHZpZGVvL2F1ZGlvIGlzIHBsYXlpbmdcbiAgICAgIG9uU3RhcnQ6ICgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ1N0YXJ0IGthcmFva2UgZm9yOicsIHRyYWNrPy50aXRsZSk7XG4gICAgICAgIC8vIFRPRE86IFN0YXJ0IGthcmFva2Ugc2Vzc2lvblxuICAgICAgfSxcbiAgICAgIG9uU3BlZWRDaGFuZ2U6IChzcGVlZDogbnVtYmVyKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdTcGVlZCBjaGFuZ2VkIHRvOicsIHNwZWVkKTtcbiAgICAgICAgLy8gVE9ETzogSW1wbGVtZW50IHBsYXliYWNrIHNwZWVkIGNvbnRyb2xcbiAgICAgIH0sXG4gICAgfTtcbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9XCJrYXJhb2tlLXdpZGdldCBiZy1iYXNlIGgtZnVsbCBvdmVyZmxvdy1oaWRkZW4gcm91bmRlZC1sZ1wiPlxuICAgICAgPEV4dGVuc2lvbkthcmFva2VWaWV3IHsuLi5nZXRWaWV3UHJvcHMoKX0gLz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2hhZG93Um9vdFVpIH0gZnJvbSAnd3h0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYWRvdy1yb290JztcbmltcG9ydCB7IGRlZmluZUNvbnRlbnRTY3JpcHQgfSBmcm9tICd3eHQvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0JztcbmltcG9ydCB0eXBlIHsgQ29udGVudFNjcmlwdENvbnRleHQgfSBmcm9tICd3eHQvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dCc7XG5pbXBvcnQgeyByZW5kZXIgfSBmcm9tICdzb2xpZC1qcy93ZWInO1xuaW1wb3J0IHsgQ29udGVudEFwcCB9IGZyb20gJy4uL3NyYy9hcHBzL2NvbnRlbnQvQ29udGVudEFwcCc7XG5pbXBvcnQgJy4uL3NyYy9zdHlsZXMvZXh0ZW5zaW9uLmNzcyc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbnRlbnRTY3JpcHQoe1xuICBtYXRjaGVzOiBbJyo6Ly9zb3VuZGNsb3VkLmNvbS8qJywgJyo6Ly9zb3VuZGNsb2FrLmNvbS8qJywgJyo6Ly9zYy5tYWlkLnpvbmUvKicsICcqOi8vKi5tYWlkLnpvbmUvKiddLFxuICBydW5BdDogJ2RvY3VtZW50X2lkbGUnLFxuICBjc3NJbmplY3Rpb25Nb2RlOiAndWknLFxuXG4gIGFzeW5jIG1haW4oY3R4OiBDb250ZW50U2NyaXB0Q29udGV4dCkge1xuICAgIC8vIE9ubHkgcnVuIGluIHRvcC1sZXZlbCBmcmFtZSB0byBhdm9pZCBkdXBsaWNhdGUgcHJvY2Vzc2luZyBpbiBpZnJhbWVzXG4gICAgaWYgKHdpbmRvdy50b3AgIT09IHdpbmRvdy5zZWxmKSB7XG4gICAgICBjb25zb2xlLmxvZygnW1NjYXJsZXR0IENTXSBOb3QgdG9wLWxldmVsIGZyYW1lLCBza2lwcGluZyBjb250ZW50IHNjcmlwdC4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygnW1NjYXJsZXR0IENTXSBTY2FybGV0dCBLYXJhb2tlIGNvbnRlbnQgc2NyaXB0IGxvYWRlZCcpO1xuXG4gICAgLy8gQ3JlYXRlIHNoYWRvdyBET00gYW5kIG1vdW50IGthcmFva2Ugd2lkZ2V0XG4gICAgY29uc3QgdWkgPSBhd2FpdCBjcmVhdGVTaGFkb3dSb290VWkoY3R4LCB7XG4gICAgICBuYW1lOiAnc2NhcmxldHQta2FyYW9rZS11aScsXG4gICAgICBwb3NpdGlvbjogJ292ZXJsYXknLFxuICAgICAgYW5jaG9yOiAnYm9keScsXG4gICAgICBvbk1vdW50OiBhc3luYyAoY29udGFpbmVyOiBIVE1MRWxlbWVudCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBvbk1vdW50IGNhbGxlZCwgY29udGFpbmVyOicsIGNvbnRhaW5lcik7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIFNoYWRvdyByb290OicsIGNvbnRhaW5lci5nZXRSb290Tm9kZSgpKTtcbiAgICAgICAgXG4gICAgICAgIC8vIExvZyB3aGF0IHN0eWxlc2hlZXRzIGFyZSBhdmFpbGFibGVcbiAgICAgICAgY29uc3Qgc2hhZG93Um9vdCA9IGNvbnRhaW5lci5nZXRSb290Tm9kZSgpIGFzIFNoYWRvd1Jvb3Q7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIFNoYWRvdyByb290IHN0eWxlc2hlZXRzOicsIHNoYWRvd1Jvb3Quc3R5bGVTaGVldHM/Lmxlbmd0aCk7XG4gICAgICAgIFxuICAgICAgICAvLyBDcmVhdGUgd3JhcHBlciB3aXRoIHBvc2l0aW9uaW5nXG4gICAgICAgIGNvbnN0IHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgd3JhcHBlci5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgICB0b3A6IDIwcHg7XG4gICAgICAgICAgcmlnaHQ6IDIwcHg7XG4gICAgICAgICAgYm90dG9tOiAyMHB4O1xuICAgICAgICAgIHdpZHRoOiA1MDBweDtcbiAgICAgICAgICB6LWluZGV4OiA5OTk5OTtcbiAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDE2cHg7XG4gICAgICAgICAgYm94LXNoYWRvdzogMCAyNXB4IDUwcHggLTEycHggcmdiYSgwLCAwLCAwLCAwLjYpO1xuICAgICAgICBgO1xuICAgICAgICB3cmFwcGVyLmNsYXNzTmFtZSA9ICdrYXJhb2tlLXdpZGdldCc7XG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh3cmFwcGVyKTtcblxuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBXcmFwcGVyIGNyZWF0ZWQgYW5kIGFwcGVuZGVkOicsIHdyYXBwZXIpO1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBXcmFwcGVyIGNvbXB1dGVkIHN0eWxlczonLCB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh3cmFwcGVyKSk7XG5cbiAgICAgICAgLy8gUmVuZGVyIENvbnRlbnRBcHAgY29tcG9uZW50ICh3aGljaCB1c2VzIEV4dGVuc2lvbkthcmFva2VWaWV3KVxuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBBYm91dCB0byByZW5kZXIgQ29udGVudEFwcCcpO1xuICAgICAgICBjb25zdCBkaXNwb3NlID0gcmVuZGVyKCgpID0+IDxDb250ZW50QXBwIC8+LCB3cmFwcGVyKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIENvbnRlbnRBcHAgcmVuZGVyZWQsIGRpc3Bvc2UgZnVuY3Rpb246JywgZGlzcG9zZSk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gZGlzcG9zZTtcbiAgICAgIH0sXG4gICAgICBvblJlbW92ZTogKGNsZWFudXA/OiAoKSA9PiB2b2lkKSA9PiB7XG4gICAgICAgIGNsZWFudXA/LigpO1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIE1vdW50IHRoZSBVSVxuICAgIHVpLm1vdW50KCk7XG4gICAgY29uc29sZS5sb2coJ1tTY2FybGV0dCBDU10gS2FyYW9rZSBvdmVybGF5IG1vdW50ZWQnKTtcbiAgfSxcbn0pOyIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbInZhbHVlIiwiaSIsInNvdXJjZXMiLCJkaXNwb3NlIiwiZG9jdW1lbnQiLCJhZGRFdmVudExpc3RlbmVyIiwiYnJvd3NlciIsIl9icm93c2VyIiwiaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZSIsInByaW50IiwibG9nZ2VyIiwiX2EiLCJfYiIsInJlc3VsdCIsInJlbW92ZURldGVjdG9yIiwibW91bnREZXRlY3RvciIsImRlZmluaXRpb24iLCJfJGRlbGVnYXRlRXZlbnRzIiwiU2NvcmVQYW5lbCIsInByb3BzIiwiX2VsJCIsIl90bXBsJCIsIl9lbCQyIiwiZmlyc3RDaGlsZCIsIl9lbCQzIiwiX2VsJDQiLCJuZXh0U2libGluZyIsIl9lbCQ1Iiwic2NvcmUiLCJyYW5rIiwiXyRjbGFzc05hbWUiLCJjbiIsImNsYXNzIiwiTHlyaWNzRGlzcGxheSIsImN1cnJlbnRMaW5lSW5kZXgiLCJzZXRDdXJyZW50TGluZUluZGV4IiwiY3JlYXRlU2lnbmFsIiwiY29udGFpbmVyUmVmIiwiY3JlYXRlRWZmZWN0IiwiY3VycmVudFRpbWUiLCJ0aW1lIiwiaW5kZXgiLCJseXJpY3MiLCJmaW5kSW5kZXgiLCJsaW5lIiwiZW5kVGltZSIsInN0YXJ0VGltZSIsImR1cmF0aW9uIiwiaXNQbGF5aW5nIiwibGluZUVsZW1lbnRzIiwicXVlcnlTZWxlY3RvckFsbCIsImN1cnJlbnRFbGVtZW50IiwiY29udGFpbmVySGVpZ2h0IiwiY2xpZW50SGVpZ2h0IiwibGluZVRvcCIsIm9mZnNldFRvcCIsImxpbmVIZWlnaHQiLCJvZmZzZXRIZWlnaHQiLCJzY3JvbGxUb3AiLCJzY3JvbGxUbyIsInRvcCIsImJlaGF2aW9yIiwiX3JlZiQiLCJfJHVzZSIsIl8kY3JlYXRlQ29tcG9uZW50IiwiRm9yIiwiZWFjaCIsImNoaWxkcmVuIiwiX3RtcGwkMiIsInRleHQiLCJfJGVmZmVjdCIsIl9wJCIsIl92JCIsIl92JDIiLCJlIiwiXyRzZXRBdHRyaWJ1dGUiLCJ0IiwidW5kZWZpbmVkIiwiTGVhZGVyYm9hcmRQYW5lbCIsImVudHJpZXMiLCJlbnRyeSIsIl9lbCQ2IiwiXyRpbnNlcnQiLCJ1c2VybmFtZSIsInRvTG9jYWxlU3RyaW5nIiwiaXNDdXJyZW50VXNlciIsIl92JDMiLCJfdiQ0IiwiYSIsIm8iLCJzcGVlZHMiLCJTcGxpdEJ1dHRvbiIsImN1cnJlbnRTcGVlZEluZGV4Iiwic2V0Q3VycmVudFNwZWVkSW5kZXgiLCJjdXJyZW50U3BlZWQiLCJjeWNsZVNwZWVkIiwic3RvcFByb3BhZ2F0aW9uIiwibmV4dEluZGV4IiwibGVuZ3RoIiwibmV3U3BlZWQiLCJvblNwZWVkQ2hhbmdlIiwiXyRhZGRFdmVudExpc3RlbmVyIiwib25TdGFydCIsIiQkY2xpY2siLCJkaXNhYmxlZCIsIl92JDUiLCJjdXJyZW50VGFic1N0YXRlIiwiVGFicyIsImFjdGl2ZVRhYiIsInNldEFjdGl2ZVRhYiIsImRlZmF1bHRUYWIiLCJ0YWJzIiwiaWQiLCJoYW5kbGVUYWJDaGFuZ2UiLCJvblRhYkNoYW5nZSIsIlRhYnNMaXN0IiwiVGFic1RyaWdnZXIiLCJpc0FjdGl2ZSIsIlRhYnNDb250ZW50IiwiU2hvdyIsIndoZW4iLCJFeHRlbnNpb25LYXJhb2tlVmlldyIsIl90bXBsJDQiLCJsYWJlbCIsIl8kbWVtbyIsIl90bXBsJDUiLCJfdG1wbCQzIiwibGVhZGVyYm9hcmQiLCJDb250ZW50QXBwIiwiY29uc29sZSIsImxvZyIsImN1cnJlbnRUcmFjayIsInNldEN1cnJlbnRUcmFjayIsImthcmFva2VEYXRhIiwic2V0S2FyYW9rZURhdGEiLCJpc0xvYWRpbmciLCJzZXRJc0xvYWRpbmciLCJlcnJvciIsInNldEVycm9yIiwibW9ja0xlYWRlcmJvYXJkIiwidHJhY2siLCJkYXRhIiwia2FyYW9rZUFwaSIsImdldEthcmFva2VEYXRhIiwidHJhY2tJZCIsInRpdGxlIiwiYXJ0aXN0IiwiaGFzS2FyYW9rZSIsImFwaV9jb25uZWN0ZWQiLCJtZXNzYWdlIiwiZXJyIiwib25Nb3VudCIsImNsZWFudXAiLCJ0cmFja0RldGVjdG9yIiwid2F0Y2hGb3JDaGFuZ2VzIiwib25DbGVhbnVwIiwiZ2V0THlyaWNzIiwibGluZXMiLCJtYXAiLCJnZXRWaWV3UHJvcHMiLCJlcnJvck1lc3NhZ2UiLCJpc0FwaUNvbm5lY3RlZCIsImluY2x1ZGVzIiwic3BlZWQiLCJfJG1lcmdlUHJvcHMiLCJkZWZpbmVDb250ZW50U2NyaXB0IiwibWF0Y2hlcyIsInJ1bkF0IiwiY3NzSW5qZWN0aW9uTW9kZSIsIm1haW4iLCJjdHgiLCJ3aW5kb3ciLCJzZWxmIiwidWkiLCJjcmVhdGVTaGFkb3dSb290VWkiLCJuYW1lIiwicG9zaXRpb24iLCJhbmNob3IiLCJjb250YWluZXIiLCJnZXRSb290Tm9kZSIsInNoYWRvd1Jvb3QiLCJzdHlsZVNoZWV0cyIsIndyYXBwZXIiLCJjcmVhdGVFbGVtZW50Iiwic3R5bGUiLCJjc3NUZXh0IiwiY2xhc3NOYW1lIiwiYXBwZW5kQ2hpbGQiLCJnZXRDb21wdXRlZFN0eWxlIiwicmVuZGVyIiwib25SZW1vdmUiLCJtb3VudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBZ0pBLFFBQU0sU0FBUztBQUNmLFFBQU0sVUFBVSxDQUFDLEdBQUcsTUFBTSxNQUFNO0FBQ2hDLFFBQU0sU0FBUyxPQUFPLGFBQWE7QUFDbkMsUUFBTSxpQkFBaUIsT0FBTyxVQUFVO0FBQ3hDLFFBQU0sU0FBUyxPQUFPLGFBQWE7QUFDbkMsUUFBTSxXQUFXLE9BQU8scUJBQXFCO0FBQzdDLFFBQU0sZ0JBQWdCO0FBQUEsSUFDcEIsUUFBUTtBQUFBLEVBQ1Y7QUFFQSxNQUFJLGFBQWE7QUFDakIsUUFBTSxRQUFRO0FBQ2QsUUFBTSxVQUFVO0FBQ2hCLFFBQU0sVUFBVSxDQUtoQjtBQUVBLE1BQUksUUFBUTtBQUNaLE1BQUksYUFBYTtBQUVqQixNQUFJLHVCQUF1QjtBQUMzQixNQUFJLFdBQVc7QUFDZixNQUFJLFVBQVU7QUFDZCxNQUFJLFVBQVU7QUFDZCxNQUFJLFlBQVk7QUFPaEIsV0FBUyxXQUFXLElBQUksZUFBZTtBQUNyQyxVQUFNLFdBQVcsVUFDZixRQUFRLE9BQ1IsVUFBVSxHQUFHLFdBQVcsR0FDeEIsVUFBVSxrQkFBa0IsU0FBWSxRQUFRLGVBQ2hELE9BQU8sVUFBVTtBQUFBLE1BQ2YsT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsU0FBUztBQUFBLE1BQ1QsT0FBTztBQUFBLElBQUEsSUFDSjtBQUFBLE1BQ0gsT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsU0FBUyxVQUFVLFFBQVEsVUFBVTtBQUFBLE1BQ3JDLE9BQU87QUFBQSxJQUVULEdBQUEsV0FBVyxVQUFVLE1BQU0sR0FB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O0FBQUEsUUFDQTtBQUFBLFVBQ0UsR0FBRztBQUFBLFVBQ0gsUUFBUSxLQUFLO0FBQUEsUUFDckI7QUFBQTtBQUFBLElBRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBS0Usb0JBQW9CO0FBQ2xCLFdBQUssTUFBTSxvQ0FBb0M7QUFDL0NELGVBQU87QUFBQSxRQUNMLG1CQUFtQixLQUFLLGlCQUFpQjtBQUFBLE1BQzFDO0FBQUEsSUFDTDtBQUFBLElBQ0UsaUJBQWlCO0FBQ2YsYUFBTztBQUFBLFFBQ0w7QUFBQSxVQUNFLE1BQU0sc0JBQXFCO0FBQUEsVUFDM0IsbUJBQW1CLEtBQUs7QUFBQSxVQUN4QixXQUFXLEtBQUssT0FBUSxFQUFDLFNBQVMsRUFBRSxFQUFFLE1BQU0sQ0FBQztBQUFBLFFBQzlDO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNMO0FBQUEsSUFDRSx5QkFBeUIsT0FBTzs7QUFDOUIsWUFBTSx5QkFBdUJDLE1BQUEsTUFBTSxTQUFOLGdCQUFBQSxJQUFZLFVBQVMsc0JBQXFCO0FBQ3ZFLFlBQU0sd0JBQXNCQyxNQUFBLE1BQU0sU0FBTixnQkFBQUEsSUFBWSx1QkFBc0IsS0FBSztBQUNuRSxZQUFNLGlCQUFpQixDQUFDLEtBQUssbUJBQW1CLEtBQUksV0FBTSxTQUFOLG1CQUFZLFNBQVM7QUFDekUsYUFBTyx3QkFBd0IsdUJBQXVCO0FBQUEsSUFDMUQ7QUFBQSxJQUNFLHNCQUFzQixTQUFTO0FBQzdCLFVBQUksVUFBVTtBQUNkLFlBQU0sS0FBSyxDQUFDLFVBQVU7QUFDcEIsWUFBSSxLQUFLLHlCQUF5QixLQUFLLEdBQUc7QUFDeEMsZUFBSyxtQkFBbUIsSUFBSSxNQUFNLEtBQUssU0FBUztBQUNoRCxnQkFBTSxXQUFXO0FBQ2pCLG9CQUFVO0FBQ1YsY0FBSSxhQUFZLG1DQUFTLGtCQUFrQjtBQUMzQyxlQUFLLGtCQUFtQjtBQUFBLFFBQ2hDO0FBQUEsTUFDSztBQUNELHVCQUFpQixXQUFXLEVBQUU7QUFDOUIsV0FBSyxjQUFjLE1BQU0sb0JBQW9CLFdBQVcsRUFBRSxDQUFDO0FBQUEsSUFDL0Q7QUFBQSxFQUNBO0FBckpFLGdCQVpXLHVCQVlKLCtCQUE4QjtBQUFBLElBQ25DO0FBQUEsRUFDRDtBQWRJLE1BQU0sdUJBQU47Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCwxLDIsMyw0LDUsNiw3LDgsOSwxMCwxMSwxMiwxMywxNCwxNSwzMCwzMSwzMl19

var content = function() {
  "use strict";var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  var _a, _b;
  const IS_DEV = true;
  const equalFn = (a, b) => a === b;
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
  var _tmpl$$7 = /* @__PURE__ */ template(`<div><div class="bg-surface rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px]"><div class="text-2xl font-mono font-bold text-accent-primary"></div><div class="text-sm text-secondary mt-1">Score</div></div><div class="bg-surface rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px]"><div class="text-2xl font-mono font-bold text-accent-secondary"></div><div class="text-sm text-secondary mt-1">Rank`);
  const ScorePanel = (props) => {
    return (() => {
      var _el$ = _tmpl$$7(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$2.nextSibling, _el$5 = _el$4.firstChild;
      insert(_el$3, () => props.score);
      insert(_el$5, () => props.rank);
      createRenderEffect(() => className(_el$, cn("grid grid-cols-[1fr_1fr] gap-2 p-4", props.class)));
      return _el$;
    })();
  };
  content;
  content;
  content;
  content;
  delegateEvents(["click", "input"]);
  content;
  content;
  var _tmpl$$6 = /* @__PURE__ */ template(`<div><div class=space-y-8>`), _tmpl$2$4 = /* @__PURE__ */ template(`<div>`);
  const LyricsDisplay = (props) => {
    const [currentLineIndex, setCurrentLineIndex] = createSignal(-1);
    let containerRef;
    const getLineScore = (lineIndex) => {
      var _a2, _b2;
      return ((_b2 = (_a2 = props.lineScores) == null ? void 0 : _a2.find((s) => s.lineIndex === lineIndex)) == null ? void 0 : _b2.score) || null;
    };
    const getScoreStyle = (score) => {
      if (score === null) return {};
      if (score >= 90) {
        return {
          color: "#ff6b6b",
          textShadow: "0 0 20px rgba(255, 107, 107, 0.6)"
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
      let foundIndex = -1;
      for (let i = 0; i < props.lyrics.length; i++) {
        const line = props.lyrics[i];
        if (!line) continue;
        const endTime = line.startTime + line.duration / 1e3;
        if (time >= line.startTime && time < endTime) {
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
        console.log("[LyricsDisplay] Current line changed:", {
          from: prevIndex,
          to: foundIndex,
          time: props.currentTime,
          timeInSeconds: time,
          jump: Math.abs(foundIndex - prevIndex)
        });
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
      const index = currentLineIndex();
      if (index === -1 || !containerRef || !props.isPlaying) return;
      requestAnimationFrame(() => {
        const lineElements = containerRef.querySelectorAll("[data-line-index]");
        const currentElement = lineElements[index];
        if (currentElement) {
          const containerHeight = containerRef.clientHeight;
          const lineTop = currentElement.offsetTop;
          const lineHeight = currentElement.offsetHeight;
          const currentScrollTop = containerRef.scrollTop;
          const targetScrollTop = lineTop - containerHeight / 2 + lineHeight / 2 - 50;
          const isLineVisible = lineTop >= currentScrollTop && lineTop + lineHeight <= currentScrollTop + containerHeight;
          const isLineCentered = Math.abs(currentScrollTop - targetScrollTop) < 100;
          if (!isLineVisible || !isLineCentered) {
            console.log("[LyricsDisplay] Scrolling to line:", index, "targetScrollTop:", targetScrollTop);
            containerRef.scrollTo({
              top: targetScrollTop,
              behavior: "smooth"
            });
          }
        }
      });
    });
    return (() => {
      var _el$ = _tmpl$$6(), _el$2 = _el$.firstChild;
      var _ref$ = containerRef;
      typeof _ref$ === "function" ? use(_ref$, _el$) : containerRef = _el$;
      insert(_el$2, createComponent(For, {
        get each() {
          return props.lyrics;
        },
        children: (line, index) => {
          const lineScore = () => getLineScore(index());
          const scoreStyle = () => getScoreStyle(lineScore());
          return (() => {
            var _el$3 = _tmpl$2$4();
            insert(_el$3, () => line.text);
            createRenderEffect((_p$) => {
              var _v$ = index(), _v$2 = cn("text-center transition-all duration-300", "text-2xl leading-relaxed", index() === currentLineIndex() ? "font-semibold scale-110" : "opacity-60"), _v$3 = {
                color: index() === currentLineIndex() && !lineScore() ? "#ffffff" : scoreStyle().color,
                ...index() === currentLineIndex() && lineScore() ? scoreStyle() : {}
              };
              _v$ !== _p$.e && setAttribute(_el$3, "data-line-index", _p$.e = _v$);
              _v$2 !== _p$.t && className(_el$3, _p$.t = _v$2);
              _p$.a = style(_el$3, _v$3, _p$.a);
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
  var _tmpl$$5 = /* @__PURE__ */ template(`<div>`), _tmpl$2$3 = /* @__PURE__ */ template(`<div><span>#</span><span></span><span>`);
  const LeaderboardPanel = (props) => {
    return (() => {
      var _el$ = _tmpl$$5();
      insert(_el$, createComponent(For, {
        get each() {
          return props.entries;
        },
        children: (entry) => (() => {
          var _el$2 = _tmpl$2$3(), _el$3 = _el$2.firstChild;
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
  var _tmpl$$4 = /* @__PURE__ */ template(`<div><button><span class="relative z-10">Start</span></button><div class="w-px bg-black/20"></div><button aria-label="Change playback speed"><span class="relative z-10">`);
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
      var _el$ = _tmpl$$4(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling, _el$4 = _el$3.nextSibling, _el$5 = _el$4.firstChild;
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
  var _tmpl$$3 = /* @__PURE__ */ template(`<div>`), _tmpl$2$2 = /* @__PURE__ */ template(`<button>`);
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
        var _el$ = _tmpl$$3();
        insert(_el$, () => props.children);
        createRenderEffect(() => className(_el$, cn("w-full", props.class)));
        return _el$;
      }
    });
  };
  const TabsList = (props) => {
    return (() => {
      var _el$2 = _tmpl$$3();
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
      var _el$3 = _tmpl$2$2();
      _el$3.$$click = () => context.setActiveTab(props.value);
      insert(_el$3, () => props.children);
      createRenderEffect(() => className(_el$3, cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5", "text-sm font-medium ring-offset-base transition-all", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2", "disabled:pointer-events-none disabled:opacity-50", "flex-1", isActive() ? "bg-base text-primary shadow-sm" : "text-secondary hover:text-primary", props.class)));
      return _el$3;
    })();
  };
  const TabsContent = (props) => {
    const context = useContext(TabsContext);
    if (!context) {
      console.error("[TabsContent] No TabsContext found. TabsContent must be used within Tabs component.");
      return null;
    }
    const isActive = context.activeTab() === props.value;
    console.log("[TabsContent] Rendering:", {
      value: props.value,
      activeTab: context.activeTab(),
      isActive
    });
    return createComponent(Show, {
      when: isActive,
      get children() {
        var _el$4 = _tmpl$$3();
        insert(_el$4, () => props.children);
        createRenderEffect(() => className(_el$4, cn("mt-2 ring-offset-base", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2", props.class)));
        return _el$4;
      }
    });
  };
  delegateEvents(["click"]);
  content;
  content;
  var _tmpl$$2 = /* @__PURE__ */ template(`<div class=px-4>`), _tmpl$2$1 = /* @__PURE__ */ template(`<div class="p-4 bg-surface border-t border-subtle">`), _tmpl$3$1 = /* @__PURE__ */ template(`<div class="flex flex-col h-full"><div class="flex-1 min-h-0 overflow-hidden">`), _tmpl$4$1 = /* @__PURE__ */ template(`<div class="overflow-y-auto h-full">`), _tmpl$5$1 = /* @__PURE__ */ template(`<div>`), _tmpl$6$1 = /* @__PURE__ */ template(`<div class="flex-1 flex flex-col min-h-0"><div class="flex-1 min-h-0 overflow-hidden">`);
  const ExtensionKaraokeView = (props) => {
    var _a2;
    console.log("[ExtensionKaraokeView] Rendering with props:", {
      isPlaying: props.isPlaying,
      hasOnStart: !!props.onStart,
      lyricsLength: (_a2 = props.lyrics) == null ? void 0 : _a2.length
    });
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
                var _el$2 = _tmpl$$2();
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
                  var _el$3 = _tmpl$3$1(), _el$4 = _el$3.firstChild;
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
                      var _el$5 = _tmpl$2$1();
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
                  var _el$6 = _tmpl$4$1();
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
  content;
  const MIN_WORDS = 8;
  const MAX_WORDS = 15;
  const MAX_LINES_PER_CHUNK = 3;
  function countWords(text) {
    return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
  }
  function shouldChunkLines(lines, startIndex) {
    let totalWords = 0;
    let endIndex = startIndex;
    const expectedTexts = [];
    while (endIndex < lines.length && totalWords < MIN_WORDS) {
      const line = lines[endIndex];
      if (!line) break;
      const words = countWords(line.text);
      if (totalWords + words > MAX_WORDS && totalWords >= 5) {
        break;
      }
      expectedTexts.push(line.text);
      totalWords += words;
      endIndex++;
      if (endIndex - startIndex >= MAX_LINES_PER_CHUNK) break;
    }
    return {
      startIndex,
      endIndex: endIndex - 1,
      expectedText: expectedTexts.join(" "),
      wordCount: totalWords
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
  content;
  content;
  var _tmpl$$1 = /* @__PURE__ */ template(`<button aria-label="Open Karaoke"><span>🎤`);
  const MinimizedKaraoke = (props) => {
    return (() => {
      var _el$ = _tmpl$$1(), _el$2 = _el$.firstChild;
      _el$.addEventListener("mouseleave", (e) => {
        e.currentTarget.style.transform = "scale(1)";
      });
      _el$.addEventListener("mouseenter", (e) => {
        e.currentTarget.style.transform = "scale(1.1)";
      });
      addEventListener$1(_el$, "click", props.onClick);
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
    const apiUrl = options.apiUrl || "http://localhost:3000/api";
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
        apiUrl
      });
      if (options.trackId && options.songData) {
        try {
          console.log("[KaraokeSession] Creating session on server...");
          const response = await fetch(`${apiUrl}/karaoke/start`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            mode: "cors",
            body: JSON.stringify({
              trackId: options.trackId,
              songData: options.songData
            })
          });
          console.log("[KaraokeSession] Session response:", response.status, response.statusText);
          if (response.ok) {
            const data = await response.json();
            setSessionId(data.session.id);
            console.log("[KaraokeSession] Session created:", data.session.id);
          } else {
            const errorText = await response.text();
            console.error("[KaraokeSession] Failed to create session:", response.status, errorText);
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
        const response = await fetch(`${apiUrl}/karaoke/grade`, {
          mode: "cors",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionId(),
            lineIndex: chunk.startIndex,
            audioBuffer: audioBase64,
            expectedText: chunk.expectedText,
            startTime: ((_a2 = options.lyrics[chunk.startIndex]) == null ? void 0 : _a2.startTime) || 0,
            endTime: (((_b2 = options.lyrics[chunk.endIndex]) == null ? void 0 : _b2.startTime) || 0) + (((_c = options.lyrics[chunk.endIndex]) == null ? void 0 : _c.duration) || 0)
          })
        });
        if (response.ok) {
          const data = await response.json();
          console.log(`[KaraokeSession] Chunk graded:`, data);
          setLineScores((prev) => [...prev, {
            lineIndex: chunk.startIndex,
            score: data.score,
            transcription: data.transcription,
            feedback: data.feedback
          }]);
          const scores = [...lineScores(), { lineIndex: chunk.startIndex, score: data.score, transcription: data.transcription }];
          const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
          setScore(Math.round(avgScore));
        } else {
          const errorText = await response.text();
          console.warn(`[KaraokeSession] Failed to grade chunk:`, response.status, errorText);
          if (errorText.includes("Audio too short") || errorText.includes("audio too short")) {
            console.log("[KaraokeSession] Audio was too short, skipping this chunk");
            setLineScores((prev) => [...prev, {
              lineIndex: chunk.startIndex,
              score: 50,
              // Neutral score
              transcription: "",
              feedback: "Audio recording was too short"
            }]);
          }
        }
      } catch (error) {
        console.error("[KaraokeSession] Failed to grade chunk:", error);
      }
    };
    const handleEnd = async () => {
      var _a2, _b2;
      setIsPlaying(false);
      if (audioUpdateInterval) {
        clearInterval(audioUpdateInterval);
      }
      if (isRecording()) {
        stopRecordingChunk();
      }
      const fullAudioBlob = audioProcessor.stopFullSessionAndGetWav();
      if (sessionId() && fullAudioBlob) {
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            var _a3, _b3;
            const base64Audio = (_a3 = reader.result) == null ? void 0 : _a3.toString().split(",")[1];
            const response = await fetch(`${apiUrl}/karaoke/complete`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: sessionId(),
                fullAudioBuffer: base64Audio
              })
            });
            if (response.ok) {
              const data = await response.json();
              console.log("[KaraokeSession] Session completed:", data);
              const results = {
                score: data.finalScore,
                accuracy: data.accuracy,
                totalLines: data.totalLines,
                perfectLines: data.perfectLines,
                goodLines: data.goodLines,
                needsWorkLines: data.needsWorkLines,
                sessionId: sessionId() || void 0
              };
              (_b3 = options.onComplete) == null ? void 0 : _b3.call(options, results);
            }
          };
          reader.readAsDataURL(fullAudioBlob);
        } catch (error) {
          console.error("[KaraokeSession] Failed to complete session:", error);
          const scores = lineScores();
          const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length : 0;
          const results = {
            score: Math.round(avgScore),
            accuracy: Math.round(avgScore),
            totalLines: options.lyrics.length,
            perfectLines: scores.filter((s) => s.score >= 90).length,
            goodLines: scores.filter((s) => s.score >= 70 && s.score < 90).length,
            needsWorkLines: scores.filter((s) => s.score < 70).length,
            sessionId: sessionId() || void 0
          };
          (_a2 = options.onComplete) == null ? void 0 : _a2.call(options, results);
        }
      } else {
        const scores = lineScores();
        const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length : 0;
        const results = {
          score: Math.round(avgScore),
          accuracy: Math.round(avgScore),
          totalLines: options.lyrics.length,
          perfectLines: scores.filter((s) => s.score >= 90).length,
          goodLines: scores.filter((s) => s.score >= 70 && s.score < 90).length,
          needsWorkLines: scores.filter((s) => s.score < 70).length
        };
        (_b2 = options.onComplete) == null ? void 0 : _b2.call(options, results);
      }
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
  var _tmpl$ = /* @__PURE__ */ template(`<div class="absolute inset-0 bg-black/80 flex items-center justify-center z-50"><div class=text-center><div class="text-8xl font-bold text-white animate-pulse"></div><p class="text-xl text-white/80 mt-4">Get ready!`), _tmpl$2 = /* @__PURE__ */ template(`<div class="h-full flex flex-col"><div class="flex-1 min-h-0 overflow-hidden">`), _tmpl$3 = /* @__PURE__ */ template(`<div><div class="h-full bg-surface rounded-2xl overflow-hidden flex flex-col"><div class="flex items-center justify-end p-2 bg-surface border-b border-subtle"><button class="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"aria-label=Minimize><svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M6 12h12"stroke=currentColor stroke-width=3 stroke-linecap=round></path></svg></button></div><div class="flex-1 min-h-0 overflow-hidden">`), _tmpl$4 = /* @__PURE__ */ template(`<div>`), _tmpl$5 = /* @__PURE__ */ template(`<div class="flex items-center justify-center h-full bg-base"><div class=text-center><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div><p class=text-secondary>Loading lyrics...`), _tmpl$6 = /* @__PURE__ */ template(`<div class="flex items-center justify-center h-full p-8"><div class=text-center><p class="text-lg text-secondary mb-2">No lyrics available</p><p class="text-sm text-tertiary">Try a different song`);
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
          audioElement: void 0,
          // Will be set when audio starts playing
          apiUrl: "http://localhost:8787/api",
          onComplete: (results) => {
            console.log("[ContentApp] Karaoke session completed:", results);
            setSessionStarted(false);
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
          var _el$1 = _tmpl$4();
          _el$1.style.setProperty("display", "none");
          insert(_el$1, () => console.log("[ContentApp] Not showing - showKaraoke:", showKaraoke(), "currentTrack:", currentTrack()));
          return _el$1;
        })();
      },
      get children() {
        var _el$ = _tmpl$3(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$3.nextSibling;
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
        insert(_el$, () => console.log("[ContentApp] Rendering ExtensionKaraokeView with data:", karaokeData(), "session:", karaokeSession()), _el$2);
        _el$3.style.setProperty("height", "48px");
        _el$4.$$click = handleMinimize;
        _el$4.style.setProperty("color", "#a8a8a8");
        insert(_el$5, createComponent(Show, {
          get when() {
            return !loading();
          },
          get fallback() {
            return _tmpl$5();
          },
          get children() {
            return createComponent(Show, {
              get when() {
                var _a2, _b2;
                return (_b2 = (_a2 = karaokeData()) == null ? void 0 : _a2.lyrics) == null ? void 0 : _b2.lines;
              },
              get fallback() {
                return _tmpl$6();
              },
              get children() {
                var _el$6 = _tmpl$2(), _el$7 = _el$6.firstChild;
                insert(_el$7, createComponent(ExtensionKaraokeView, {
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
                  onSpeedChange: (speed) => console.log("[ContentApp] Speed changed:", speed),
                  get isRecording() {
                    return memo(() => !!karaokeSession())() ? karaokeSession().isRecording() : false;
                  },
                  get lineScores() {
                    return memo(() => !!karaokeSession())() ? karaokeSession().lineScores() : [];
                  }
                }));
                insert(_el$6, createComponent(Show, {
                  get when() {
                    return memo(() => !!karaokeSession())() ? karaokeSession().countdown() !== null : countdown() !== null;
                  },
                  get children() {
                    var _el$8 = _tmpl$(), _el$9 = _el$8.firstChild, _el$0 = _el$9.firstChild;
                    insert(_el$0, (() => {
                      var _c$ = memo(() => !!karaokeSession());
                      return () => _c$() ? karaokeSession().countdown() : countdown();
                    })());
                    return _el$8;
                  }
                }), null);
                return _el$6;
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
  return result;
}();
content;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL2Rpc3QvZGV2LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL3dlYi9kaXN0L2Rldi5qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWUvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnQvbGliL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbnkta2V5cy1tYXAvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvZGVmdS9kaXN0L2RlZnUubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0AxbmF0c3Uvd2FpdC1lbGVtZW50L2Rpc3QvZGV0ZWN0b3JzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AMW5hdHN1L3dhaXQtZWxlbWVudC9kaXN0L2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYXJlZC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9jbHN4L2Rpc3QvY2xzeC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvY24udHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9sYXlvdXQvSGVhZGVyL0hlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9kaXNwbGF5L1Njb3JlUGFuZWwvU2NvcmVQYW5lbC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9vbmJvYXJkaW5nL09uYm9hcmRpbmdGbG93L09uYm9hcmRpbmdGbG93LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheS9MeXJpY3NEaXNwbGF5LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvS2FyYW9rZUhlYWRlci9LYXJhb2tlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbC9MZWFkZXJib2FyZFBhbmVsLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9TcGxpdEJ1dHRvbi9TcGxpdEJ1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vVGFicy9UYWJzLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvRXh0ZW5zaW9uS2FyYW9rZVZpZXcvRXh0ZW5zaW9uS2FyYW9rZVZpZXcudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL3NlcnZpY2VzL2F1ZGlvL2thcmFva2VBdWRpb1Byb2Nlc3Nvci50cyIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9zZXJ2aWNlcy9rYXJhb2tlL2NodW5raW5nVXRpbHMudHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9NaW5pbWl6ZWRLYXJhb2tlLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL3ByYWN0aWNlL1ByYWN0aWNlSGVhZGVyL1ByYWN0aWNlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2ZhcmNhc3Rlci9GYXJjYXN0ZXJNaW5pQXBwL0ZhcmNhc3Rlck1pbmlBcHAudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcGFnZXMvSG9tZVBhZ2UvSG9tZVBhZ2UudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2hvb2tzL3VzZUthcmFva2VTZXNzaW9uLnRzIiwiLi4vLi4vLi4vc3JjL3NlcnZpY2VzL3RyYWNrLWRldGVjdG9yLnRzIiwiLi4vLi4vLi4vc3JjL3V0aWxzL3N0b3JhZ2UudHMiLCIuLi8uLi8uLi9zcmMvc2VydmljZXMva2FyYW9rZS1hcGkudHMiLCIuLi8uLi8uLi9zcmMvYXBwcy9jb250ZW50L0NvbnRlbnRBcHAudHN4IiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC50c3giLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dC5tanMiXSwic291cmNlc0NvbnRlbnQiOlsibGV0IHRhc2tJZENvdW50ZXIgPSAxLFxuICBpc0NhbGxiYWNrU2NoZWR1bGVkID0gZmFsc2UsXG4gIGlzUGVyZm9ybWluZ1dvcmsgPSBmYWxzZSxcbiAgdGFza1F1ZXVlID0gW10sXG4gIGN1cnJlbnRUYXNrID0gbnVsbCxcbiAgc2hvdWxkWWllbGRUb0hvc3QgPSBudWxsLFxuICB5aWVsZEludGVydmFsID0gNSxcbiAgZGVhZGxpbmUgPSAwLFxuICBtYXhZaWVsZEludGVydmFsID0gMzAwLFxuICBzY2hlZHVsZUNhbGxiYWNrID0gbnVsbCxcbiAgc2NoZWR1bGVkQ2FsbGJhY2sgPSBudWxsO1xuY29uc3QgbWF4U2lnbmVkMzFCaXRJbnQgPSAxMDczNzQxODIzO1xuZnVuY3Rpb24gc2V0dXBTY2hlZHVsZXIoKSB7XG4gIGNvbnN0IGNoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKSxcbiAgICBwb3J0ID0gY2hhbm5lbC5wb3J0MjtcbiAgc2NoZWR1bGVDYWxsYmFjayA9ICgpID0+IHBvcnQucG9zdE1lc3NhZ2UobnVsbCk7XG4gIGNoYW5uZWwucG9ydDEub25tZXNzYWdlID0gKCkgPT4ge1xuICAgIGlmIChzY2hlZHVsZWRDYWxsYmFjayAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgY3VycmVudFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGRlYWRsaW5lID0gY3VycmVudFRpbWUgKyB5aWVsZEludGVydmFsO1xuICAgICAgY29uc3QgaGFzVGltZVJlbWFpbmluZyA9IHRydWU7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBoYXNNb3JlV29yayA9IHNjaGVkdWxlZENhbGxiYWNrKGhhc1RpbWVSZW1haW5pbmcsIGN1cnJlbnRUaW1lKTtcbiAgICAgICAgaWYgKCFoYXNNb3JlV29yaykge1xuICAgICAgICAgIHNjaGVkdWxlZENhbGxiYWNrID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHBvcnQucG9zdE1lc3NhZ2UobnVsbCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBwb3J0LnBvc3RNZXNzYWdlKG51bGwpO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH1cbiAgICB9XG4gIH07XG4gIGlmIChuYXZpZ2F0b3IgJiYgbmF2aWdhdG9yLnNjaGVkdWxpbmcgJiYgbmF2aWdhdG9yLnNjaGVkdWxpbmcuaXNJbnB1dFBlbmRpbmcpIHtcbiAgICBjb25zdCBzY2hlZHVsaW5nID0gbmF2aWdhdG9yLnNjaGVkdWxpbmc7XG4gICAgc2hvdWxkWWllbGRUb0hvc3QgPSAoKSA9PiB7XG4gICAgICBjb25zdCBjdXJyZW50VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgaWYgKGN1cnJlbnRUaW1lID49IGRlYWRsaW5lKSB7XG4gICAgICAgIGlmIChzY2hlZHVsaW5nLmlzSW5wdXRQZW5kaW5nKCkpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY3VycmVudFRpbWUgPj0gbWF4WWllbGRJbnRlcnZhbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHNob3VsZFlpZWxkVG9Ib3N0ID0gKCkgPT4gcGVyZm9ybWFuY2Uubm93KCkgPj0gZGVhZGxpbmU7XG4gIH1cbn1cbmZ1bmN0aW9uIGVucXVldWUodGFza1F1ZXVlLCB0YXNrKSB7XG4gIGZ1bmN0aW9uIGZpbmRJbmRleCgpIHtcbiAgICBsZXQgbSA9IDA7XG4gICAgbGV0IG4gPSB0YXNrUXVldWUubGVuZ3RoIC0gMTtcbiAgICB3aGlsZSAobSA8PSBuKSB7XG4gICAgICBjb25zdCBrID0gbiArIG0gPj4gMTtcbiAgICAgIGNvbnN0IGNtcCA9IHRhc2suZXhwaXJhdGlvblRpbWUgLSB0YXNrUXVldWVba10uZXhwaXJhdGlvblRpbWU7XG4gICAgICBpZiAoY21wID4gMCkgbSA9IGsgKyAxO2Vsc2UgaWYgKGNtcCA8IDApIG4gPSBrIC0gMTtlbHNlIHJldHVybiBrO1xuICAgIH1cbiAgICByZXR1cm4gbTtcbiAgfVxuICB0YXNrUXVldWUuc3BsaWNlKGZpbmRJbmRleCgpLCAwLCB0YXNrKTtcbn1cbmZ1bmN0aW9uIHJlcXVlc3RDYWxsYmFjayhmbiwgb3B0aW9ucykge1xuICBpZiAoIXNjaGVkdWxlQ2FsbGJhY2spIHNldHVwU2NoZWR1bGVyKCk7XG4gIGxldCBzdGFydFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKSxcbiAgICB0aW1lb3V0ID0gbWF4U2lnbmVkMzFCaXRJbnQ7XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMudGltZW91dCkgdGltZW91dCA9IG9wdGlvbnMudGltZW91dDtcbiAgY29uc3QgbmV3VGFzayA9IHtcbiAgICBpZDogdGFza0lkQ291bnRlcisrLFxuICAgIGZuLFxuICAgIHN0YXJ0VGltZSxcbiAgICBleHBpcmF0aW9uVGltZTogc3RhcnRUaW1lICsgdGltZW91dFxuICB9O1xuICBlbnF1ZXVlKHRhc2tRdWV1ZSwgbmV3VGFzayk7XG4gIGlmICghaXNDYWxsYmFja1NjaGVkdWxlZCAmJiAhaXNQZXJmb3JtaW5nV29yaykge1xuICAgIGlzQ2FsbGJhY2tTY2hlZHVsZWQgPSB0cnVlO1xuICAgIHNjaGVkdWxlZENhbGxiYWNrID0gZmx1c2hXb3JrO1xuICAgIHNjaGVkdWxlQ2FsbGJhY2soKTtcbiAgfVxuICByZXR1cm4gbmV3VGFzaztcbn1cbmZ1bmN0aW9uIGNhbmNlbENhbGxiYWNrKHRhc2spIHtcbiAgdGFzay5mbiA9IG51bGw7XG59XG5mdW5jdGlvbiBmbHVzaFdvcmsoaGFzVGltZVJlbWFpbmluZywgaW5pdGlhbFRpbWUpIHtcbiAgaXNDYWxsYmFja1NjaGVkdWxlZCA9IGZhbHNlO1xuICBpc1BlcmZvcm1pbmdXb3JrID0gdHJ1ZTtcbiAgdHJ5IHtcbiAgICByZXR1cm4gd29ya0xvb3AoaGFzVGltZVJlbWFpbmluZywgaW5pdGlhbFRpbWUpO1xuICB9IGZpbmFsbHkge1xuICAgIGN1cnJlbnRUYXNrID0gbnVsbDtcbiAgICBpc1BlcmZvcm1pbmdXb3JrID0gZmFsc2U7XG4gIH1cbn1cbmZ1bmN0aW9uIHdvcmtMb29wKGhhc1RpbWVSZW1haW5pbmcsIGluaXRpYWxUaW1lKSB7XG4gIGxldCBjdXJyZW50VGltZSA9IGluaXRpYWxUaW1lO1xuICBjdXJyZW50VGFzayA9IHRhc2tRdWV1ZVswXSB8fCBudWxsO1xuICB3aGlsZSAoY3VycmVudFRhc2sgIT09IG51bGwpIHtcbiAgICBpZiAoY3VycmVudFRhc2suZXhwaXJhdGlvblRpbWUgPiBjdXJyZW50VGltZSAmJiAoIWhhc1RpbWVSZW1haW5pbmcgfHwgc2hvdWxkWWllbGRUb0hvc3QoKSkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjb25zdCBjYWxsYmFjayA9IGN1cnJlbnRUYXNrLmZuO1xuICAgIGlmIChjYWxsYmFjayAhPT0gbnVsbCkge1xuICAgICAgY3VycmVudFRhc2suZm4gPSBudWxsO1xuICAgICAgY29uc3QgZGlkVXNlckNhbGxiYWNrVGltZW91dCA9IGN1cnJlbnRUYXNrLmV4cGlyYXRpb25UaW1lIDw9IGN1cnJlbnRUaW1lO1xuICAgICAgY2FsbGJhY2soZGlkVXNlckNhbGxiYWNrVGltZW91dCk7XG4gICAgICBjdXJyZW50VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgaWYgKGN1cnJlbnRUYXNrID09PSB0YXNrUXVldWVbMF0pIHtcbiAgICAgICAgdGFza1F1ZXVlLnNoaWZ0KCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHRhc2tRdWV1ZS5zaGlmdCgpO1xuICAgIGN1cnJlbnRUYXNrID0gdGFza1F1ZXVlWzBdIHx8IG51bGw7XG4gIH1cbiAgcmV0dXJuIGN1cnJlbnRUYXNrICE9PSBudWxsO1xufVxuXG5jb25zdCBzaGFyZWRDb25maWcgPSB7XG4gIGNvbnRleHQ6IHVuZGVmaW5lZCxcbiAgcmVnaXN0cnk6IHVuZGVmaW5lZCxcbiAgZWZmZWN0czogdW5kZWZpbmVkLFxuICBkb25lOiBmYWxzZSxcbiAgZ2V0Q29udGV4dElkKCkge1xuICAgIHJldHVybiBnZXRDb250ZXh0SWQodGhpcy5jb250ZXh0LmNvdW50KTtcbiAgfSxcbiAgZ2V0TmV4dENvbnRleHRJZCgpIHtcbiAgICByZXR1cm4gZ2V0Q29udGV4dElkKHRoaXMuY29udGV4dC5jb3VudCsrKTtcbiAgfVxufTtcbmZ1bmN0aW9uIGdldENvbnRleHRJZChjb3VudCkge1xuICBjb25zdCBudW0gPSBTdHJpbmcoY291bnQpLFxuICAgIGxlbiA9IG51bS5sZW5ndGggLSAxO1xuICByZXR1cm4gc2hhcmVkQ29uZmlnLmNvbnRleHQuaWQgKyAobGVuID8gU3RyaW5nLmZyb21DaGFyQ29kZSg5NiArIGxlbikgOiBcIlwiKSArIG51bTtcbn1cbmZ1bmN0aW9uIHNldEh5ZHJhdGVDb250ZXh0KGNvbnRleHQpIHtcbiAgc2hhcmVkQ29uZmlnLmNvbnRleHQgPSBjb250ZXh0O1xufVxuZnVuY3Rpb24gbmV4dEh5ZHJhdGVDb250ZXh0KCkge1xuICByZXR1cm4ge1xuICAgIC4uLnNoYXJlZENvbmZpZy5jb250ZXh0LFxuICAgIGlkOiBzaGFyZWRDb25maWcuZ2V0TmV4dENvbnRleHRJZCgpLFxuICAgIGNvdW50OiAwXG4gIH07XG59XG5cbmNvbnN0IElTX0RFViA9IHRydWU7XG5jb25zdCBlcXVhbEZuID0gKGEsIGIpID0+IGEgPT09IGI7XG5jb25zdCAkUFJPWFkgPSBTeW1ib2woXCJzb2xpZC1wcm94eVwiKTtcbmNvbnN0IFNVUFBPUlRTX1BST1hZID0gdHlwZW9mIFByb3h5ID09PSBcImZ1bmN0aW9uXCI7XG5jb25zdCAkVFJBQ0sgPSBTeW1ib2woXCJzb2xpZC10cmFja1wiKTtcbmNvbnN0ICRERVZDT01QID0gU3ltYm9sKFwic29saWQtZGV2LWNvbXBvbmVudFwiKTtcbmNvbnN0IHNpZ25hbE9wdGlvbnMgPSB7XG4gIGVxdWFsczogZXF1YWxGblxufTtcbmxldCBFUlJPUiA9IG51bGw7XG5sZXQgcnVuRWZmZWN0cyA9IHJ1blF1ZXVlO1xuY29uc3QgU1RBTEUgPSAxO1xuY29uc3QgUEVORElORyA9IDI7XG5jb25zdCBVTk9XTkVEID0ge1xuICBvd25lZDogbnVsbCxcbiAgY2xlYW51cHM6IG51bGwsXG4gIGNvbnRleHQ6IG51bGwsXG4gIG93bmVyOiBudWxsXG59O1xuY29uc3QgTk9fSU5JVCA9IHt9O1xudmFyIE93bmVyID0gbnVsbDtcbmxldCBUcmFuc2l0aW9uID0gbnVsbDtcbmxldCBTY2hlZHVsZXIgPSBudWxsO1xubGV0IEV4dGVybmFsU291cmNlQ29uZmlnID0gbnVsbDtcbmxldCBMaXN0ZW5lciA9IG51bGw7XG5sZXQgVXBkYXRlcyA9IG51bGw7XG5sZXQgRWZmZWN0cyA9IG51bGw7XG5sZXQgRXhlY0NvdW50ID0gMDtcbmNvbnN0IERldkhvb2tzID0ge1xuICBhZnRlclVwZGF0ZTogbnVsbCxcbiAgYWZ0ZXJDcmVhdGVPd25lcjogbnVsbCxcbiAgYWZ0ZXJDcmVhdGVTaWduYWw6IG51bGwsXG4gIGFmdGVyUmVnaXN0ZXJHcmFwaDogbnVsbFxufTtcbmZ1bmN0aW9uIGNyZWF0ZVJvb3QoZm4sIGRldGFjaGVkT3duZXIpIHtcbiAgY29uc3QgbGlzdGVuZXIgPSBMaXN0ZW5lcixcbiAgICBvd25lciA9IE93bmVyLFxuICAgIHVub3duZWQgPSBmbi5sZW5ndGggPT09IDAsXG4gICAgY3VycmVudCA9IGRldGFjaGVkT3duZXIgPT09IHVuZGVmaW5lZCA/IG93bmVyIDogZGV0YWNoZWRPd25lcixcbiAgICByb290ID0gdW5vd25lZCA/IHtcbiAgICAgIG93bmVkOiBudWxsLFxuICAgICAgY2xlYW51cHM6IG51bGwsXG4gICAgICBjb250ZXh0OiBudWxsLFxuICAgICAgb3duZXI6IG51bGxcbiAgICB9ICA6IHtcbiAgICAgIG93bmVkOiBudWxsLFxuICAgICAgY2xlYW51cHM6IG51bGwsXG4gICAgICBjb250ZXh0OiBjdXJyZW50ID8gY3VycmVudC5jb250ZXh0IDogbnVsbCxcbiAgICAgIG93bmVyOiBjdXJyZW50XG4gICAgfSxcbiAgICB1cGRhdGVGbiA9IHVub3duZWQgPyAoKSA9PiBmbigoKSA9PiB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJEaXNwb3NlIG1ldGhvZCBtdXN0IGJlIGFuIGV4cGxpY2l0IGFyZ3VtZW50IHRvIGNyZWF0ZVJvb3QgZnVuY3Rpb25cIik7XG4gICAgfSkgIDogKCkgPT4gZm4oKCkgPT4gdW50cmFjaygoKSA9PiBjbGVhbk5vZGUocm9vdCkpKTtcbiAgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lciAmJiBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyKHJvb3QpO1xuICBPd25lciA9IHJvb3Q7XG4gIExpc3RlbmVyID0gbnVsbDtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcnVuVXBkYXRlcyh1cGRhdGVGbiwgdHJ1ZSk7XG4gIH0gZmluYWxseSB7XG4gICAgTGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgICBPd25lciA9IG93bmVyO1xuICB9XG59XG5mdW5jdGlvbiBjcmVhdGVTaWduYWwodmFsdWUsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgPyBPYmplY3QuYXNzaWduKHt9LCBzaWduYWxPcHRpb25zLCBvcHRpb25zKSA6IHNpZ25hbE9wdGlvbnM7XG4gIGNvbnN0IHMgPSB7XG4gICAgdmFsdWUsXG4gICAgb2JzZXJ2ZXJzOiBudWxsLFxuICAgIG9ic2VydmVyU2xvdHM6IG51bGwsXG4gICAgY29tcGFyYXRvcjogb3B0aW9ucy5lcXVhbHMgfHwgdW5kZWZpbmVkXG4gIH07XG4gIHtcbiAgICBpZiAob3B0aW9ucy5uYW1lKSBzLm5hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgaWYgKG9wdGlvbnMuaW50ZXJuYWwpIHtcbiAgICAgIHMuaW50ZXJuYWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWdpc3RlckdyYXBoKHMpO1xuICAgICAgaWYgKERldkhvb2tzLmFmdGVyQ3JlYXRlU2lnbmFsKSBEZXZIb29rcy5hZnRlckNyZWF0ZVNpZ25hbChzKTtcbiAgICB9XG4gIH1cbiAgY29uc3Qgc2V0dGVyID0gdmFsdWUgPT4ge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMocykpIHZhbHVlID0gdmFsdWUocy50VmFsdWUpO2Vsc2UgdmFsdWUgPSB2YWx1ZShzLnZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyaXRlU2lnbmFsKHMsIHZhbHVlKTtcbiAgfTtcbiAgcmV0dXJuIFtyZWFkU2lnbmFsLmJpbmQocyksIHNldHRlcl07XG59XG5mdW5jdGlvbiBjcmVhdGVDb21wdXRlZChmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgdHJ1ZSwgU1RBTEUsIG9wdGlvbnMgKTtcbiAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgVXBkYXRlcy5wdXNoKGMpO2Vsc2UgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG59XG5mdW5jdGlvbiBjcmVhdGVSZW5kZXJFZmZlY3QoZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIGZhbHNlLCBTVEFMRSwgb3B0aW9ucyApO1xuICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBVcGRhdGVzLnB1c2goYyk7ZWxzZSB1cGRhdGVDb21wdXRhdGlvbihjKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUVmZmVjdChmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgcnVuRWZmZWN0cyA9IHJ1blVzZXJFZmZlY3RzO1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCBmYWxzZSwgU1RBTEUsIG9wdGlvbnMgKSxcbiAgICBzID0gU3VzcGVuc2VDb250ZXh0ICYmIHVzZUNvbnRleHQoU3VzcGVuc2VDb250ZXh0KTtcbiAgaWYgKHMpIGMuc3VzcGVuc2UgPSBzO1xuICBpZiAoIW9wdGlvbnMgfHwgIW9wdGlvbnMucmVuZGVyKSBjLnVzZXIgPSB0cnVlO1xuICBFZmZlY3RzID8gRWZmZWN0cy5wdXNoKGMpIDogdXBkYXRlQ29tcHV0YXRpb24oYyk7XG59XG5mdW5jdGlvbiBjcmVhdGVSZWFjdGlvbihvbkludmFsaWRhdGUsIG9wdGlvbnMpIHtcbiAgbGV0IGZuO1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oKCkgPT4ge1xuICAgICAgZm4gPyBmbigpIDogdW50cmFjayhvbkludmFsaWRhdGUpO1xuICAgICAgZm4gPSB1bmRlZmluZWQ7XG4gICAgfSwgdW5kZWZpbmVkLCBmYWxzZSwgMCwgb3B0aW9ucyApLFxuICAgIHMgPSBTdXNwZW5zZUNvbnRleHQgJiYgdXNlQ29udGV4dChTdXNwZW5zZUNvbnRleHQpO1xuICBpZiAocykgYy5zdXNwZW5zZSA9IHM7XG4gIGMudXNlciA9IHRydWU7XG4gIHJldHVybiB0cmFja2luZyA9PiB7XG4gICAgZm4gPSB0cmFja2luZztcbiAgICB1cGRhdGVDb21wdXRhdGlvbihjKTtcbiAgfTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZU1lbW8oZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zID8gT2JqZWN0LmFzc2lnbih7fSwgc2lnbmFsT3B0aW9ucywgb3B0aW9ucykgOiBzaWduYWxPcHRpb25zO1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCB0cnVlLCAwLCBvcHRpb25zICk7XG4gIGMub2JzZXJ2ZXJzID0gbnVsbDtcbiAgYy5vYnNlcnZlclNsb3RzID0gbnVsbDtcbiAgYy5jb21wYXJhdG9yID0gb3B0aW9ucy5lcXVhbHMgfHwgdW5kZWZpbmVkO1xuICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgYy50U3RhdGUgPSBTVEFMRTtcbiAgICBVcGRhdGVzLnB1c2goYyk7XG4gIH0gZWxzZSB1cGRhdGVDb21wdXRhdGlvbihjKTtcbiAgcmV0dXJuIHJlYWRTaWduYWwuYmluZChjKTtcbn1cbmZ1bmN0aW9uIGlzUHJvbWlzZSh2KSB7XG4gIHJldHVybiB2ICYmIHR5cGVvZiB2ID09PSBcIm9iamVjdFwiICYmIFwidGhlblwiIGluIHY7XG59XG5mdW5jdGlvbiBjcmVhdGVSZXNvdXJjZShwU291cmNlLCBwRmV0Y2hlciwgcE9wdGlvbnMpIHtcbiAgbGV0IHNvdXJjZTtcbiAgbGV0IGZldGNoZXI7XG4gIGxldCBvcHRpb25zO1xuICBpZiAodHlwZW9mIHBGZXRjaGVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBzb3VyY2UgPSBwU291cmNlO1xuICAgIGZldGNoZXIgPSBwRmV0Y2hlcjtcbiAgICBvcHRpb25zID0gcE9wdGlvbnMgfHwge307XG4gIH0gZWxzZSB7XG4gICAgc291cmNlID0gdHJ1ZTtcbiAgICBmZXRjaGVyID0gcFNvdXJjZTtcbiAgICBvcHRpb25zID0gcEZldGNoZXIgfHwge307XG4gIH1cbiAgbGV0IHByID0gbnVsbCxcbiAgICBpbml0UCA9IE5PX0lOSVQsXG4gICAgaWQgPSBudWxsLFxuICAgIGxvYWRlZFVuZGVyVHJhbnNpdGlvbiA9IGZhbHNlLFxuICAgIHNjaGVkdWxlZCA9IGZhbHNlLFxuICAgIHJlc29sdmVkID0gXCJpbml0aWFsVmFsdWVcIiBpbiBvcHRpb25zLFxuICAgIGR5bmFtaWMgPSB0eXBlb2Ygc291cmNlID09PSBcImZ1bmN0aW9uXCIgJiYgY3JlYXRlTWVtbyhzb3VyY2UpO1xuICBjb25zdCBjb250ZXh0cyA9IG5ldyBTZXQoKSxcbiAgICBbdmFsdWUsIHNldFZhbHVlXSA9IChvcHRpb25zLnN0b3JhZ2UgfHwgY3JlYXRlU2lnbmFsKShvcHRpb25zLmluaXRpYWxWYWx1ZSksXG4gICAgW2Vycm9yLCBzZXRFcnJvcl0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkKSxcbiAgICBbdHJhY2ssIHRyaWdnZXJdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCwge1xuICAgICAgZXF1YWxzOiBmYWxzZVxuICAgIH0pLFxuICAgIFtzdGF0ZSwgc2V0U3RhdGVdID0gY3JlYXRlU2lnbmFsKHJlc29sdmVkID8gXCJyZWFkeVwiIDogXCJ1bnJlc29sdmVkXCIpO1xuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQpIHtcbiAgICBpZCA9IHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCk7XG4gICAgaWYgKG9wdGlvbnMuc3NyTG9hZEZyb20gPT09IFwiaW5pdGlhbFwiKSBpbml0UCA9IG9wdGlvbnMuaW5pdGlhbFZhbHVlO2Vsc2UgaWYgKHNoYXJlZENvbmZpZy5sb2FkICYmIHNoYXJlZENvbmZpZy5oYXMoaWQpKSBpbml0UCA9IHNoYXJlZENvbmZpZy5sb2FkKGlkKTtcbiAgfVxuICBmdW5jdGlvbiBsb2FkRW5kKHAsIHYsIGVycm9yLCBrZXkpIHtcbiAgICBpZiAocHIgPT09IHApIHtcbiAgICAgIHByID0gbnVsbDtcbiAgICAgIGtleSAhPT0gdW5kZWZpbmVkICYmIChyZXNvbHZlZCA9IHRydWUpO1xuICAgICAgaWYgKChwID09PSBpbml0UCB8fCB2ID09PSBpbml0UCkgJiYgb3B0aW9ucy5vbkh5ZHJhdGVkKSBxdWV1ZU1pY3JvdGFzaygoKSA9PiBvcHRpb25zLm9uSHlkcmF0ZWQoa2V5LCB7XG4gICAgICAgIHZhbHVlOiB2XG4gICAgICB9KSk7XG4gICAgICBpbml0UCA9IE5PX0lOSVQ7XG4gICAgICBpZiAoVHJhbnNpdGlvbiAmJiBwICYmIGxvYWRlZFVuZGVyVHJhbnNpdGlvbikge1xuICAgICAgICBUcmFuc2l0aW9uLnByb21pc2VzLmRlbGV0ZShwKTtcbiAgICAgICAgbG9hZGVkVW5kZXJUcmFuc2l0aW9uID0gZmFsc2U7XG4gICAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICAgIFRyYW5zaXRpb24ucnVubmluZyA9IHRydWU7XG4gICAgICAgICAgY29tcGxldGVMb2FkKHYsIGVycm9yKTtcbiAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgfSBlbHNlIGNvbXBsZXRlTG9hZCh2LCBlcnJvcik7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG4gIGZ1bmN0aW9uIGNvbXBsZXRlTG9hZCh2LCBlcnIpIHtcbiAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgIGlmIChlcnIgPT09IHVuZGVmaW5lZCkgc2V0VmFsdWUoKCkgPT4gdik7XG4gICAgICBzZXRTdGF0ZShlcnIgIT09IHVuZGVmaW5lZCA/IFwiZXJyb3JlZFwiIDogcmVzb2x2ZWQgPyBcInJlYWR5XCIgOiBcInVucmVzb2x2ZWRcIik7XG4gICAgICBzZXRFcnJvcihlcnIpO1xuICAgICAgZm9yIChjb25zdCBjIG9mIGNvbnRleHRzLmtleXMoKSkgYy5kZWNyZW1lbnQoKTtcbiAgICAgIGNvbnRleHRzLmNsZWFyKCk7XG4gICAgfSwgZmFsc2UpO1xuICB9XG4gIGZ1bmN0aW9uIHJlYWQoKSB7XG4gICAgY29uc3QgYyA9IFN1c3BlbnNlQ29udGV4dCAmJiB1c2VDb250ZXh0KFN1c3BlbnNlQ29udGV4dCksXG4gICAgICB2ID0gdmFsdWUoKSxcbiAgICAgIGVyciA9IGVycm9yKCk7XG4gICAgaWYgKGVyciAhPT0gdW5kZWZpbmVkICYmICFwcikgdGhyb3cgZXJyO1xuICAgIGlmIChMaXN0ZW5lciAmJiAhTGlzdGVuZXIudXNlciAmJiBjKSB7XG4gICAgICBjcmVhdGVDb21wdXRlZCgoKSA9PiB7XG4gICAgICAgIHRyYWNrKCk7XG4gICAgICAgIGlmIChwcikge1xuICAgICAgICAgIGlmIChjLnJlc29sdmVkICYmIFRyYW5zaXRpb24gJiYgbG9hZGVkVW5kZXJUcmFuc2l0aW9uKSBUcmFuc2l0aW9uLnByb21pc2VzLmFkZChwcik7ZWxzZSBpZiAoIWNvbnRleHRzLmhhcyhjKSkge1xuICAgICAgICAgICAgYy5pbmNyZW1lbnQoKTtcbiAgICAgICAgICAgIGNvbnRleHRzLmFkZChjKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuICBmdW5jdGlvbiBsb2FkKHJlZmV0Y2hpbmcgPSB0cnVlKSB7XG4gICAgaWYgKHJlZmV0Y2hpbmcgIT09IGZhbHNlICYmIHNjaGVkdWxlZCkgcmV0dXJuO1xuICAgIHNjaGVkdWxlZCA9IGZhbHNlO1xuICAgIGNvbnN0IGxvb2t1cCA9IGR5bmFtaWMgPyBkeW5hbWljKCkgOiBzb3VyY2U7XG4gICAgbG9hZGVkVW5kZXJUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gICAgaWYgKGxvb2t1cCA9PSBudWxsIHx8IGxvb2t1cCA9PT0gZmFsc2UpIHtcbiAgICAgIGxvYWRFbmQocHIsIHVudHJhY2sodmFsdWUpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKFRyYW5zaXRpb24gJiYgcHIpIFRyYW5zaXRpb24ucHJvbWlzZXMuZGVsZXRlKHByKTtcbiAgICBsZXQgZXJyb3I7XG4gICAgY29uc3QgcCA9IGluaXRQICE9PSBOT19JTklUID8gaW5pdFAgOiB1bnRyYWNrKCgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBmZXRjaGVyKGxvb2t1cCwge1xuICAgICAgICAgIHZhbHVlOiB2YWx1ZSgpLFxuICAgICAgICAgIHJlZmV0Y2hpbmdcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoIChmZXRjaGVyRXJyb3IpIHtcbiAgICAgICAgZXJyb3IgPSBmZXRjaGVyRXJyb3I7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKGVycm9yICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxvYWRFbmQocHIsIHVuZGVmaW5lZCwgY2FzdEVycm9yKGVycm9yKSwgbG9va3VwKTtcbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKCFpc1Byb21pc2UocCkpIHtcbiAgICAgIGxvYWRFbmQocHIsIHAsIHVuZGVmaW5lZCwgbG9va3VwKTtcbiAgICAgIHJldHVybiBwO1xuICAgIH1cbiAgICBwciA9IHA7XG4gICAgaWYgKFwidlwiIGluIHApIHtcbiAgICAgIGlmIChwLnMgPT09IDEpIGxvYWRFbmQocHIsIHAudiwgdW5kZWZpbmVkLCBsb29rdXApO2Vsc2UgbG9hZEVuZChwciwgdW5kZWZpbmVkLCBjYXN0RXJyb3IocC52KSwgbG9va3VwKTtcbiAgICAgIHJldHVybiBwO1xuICAgIH1cbiAgICBzY2hlZHVsZWQgPSB0cnVlO1xuICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHNjaGVkdWxlZCA9IGZhbHNlKTtcbiAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgIHNldFN0YXRlKHJlc29sdmVkID8gXCJyZWZyZXNoaW5nXCIgOiBcInBlbmRpbmdcIik7XG4gICAgICB0cmlnZ2VyKCk7XG4gICAgfSwgZmFsc2UpO1xuICAgIHJldHVybiBwLnRoZW4odiA9PiBsb2FkRW5kKHAsIHYsIHVuZGVmaW5lZCwgbG9va3VwKSwgZSA9PiBsb2FkRW5kKHAsIHVuZGVmaW5lZCwgY2FzdEVycm9yKGUpLCBsb29rdXApKTtcbiAgfVxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhyZWFkLCB7XG4gICAgc3RhdGU6IHtcbiAgICAgIGdldDogKCkgPT4gc3RhdGUoKVxuICAgIH0sXG4gICAgZXJyb3I6IHtcbiAgICAgIGdldDogKCkgPT4gZXJyb3IoKVxuICAgIH0sXG4gICAgbG9hZGluZzoge1xuICAgICAgZ2V0KCkge1xuICAgICAgICBjb25zdCBzID0gc3RhdGUoKTtcbiAgICAgICAgcmV0dXJuIHMgPT09IFwicGVuZGluZ1wiIHx8IHMgPT09IFwicmVmcmVzaGluZ1wiO1xuICAgICAgfVxuICAgIH0sXG4gICAgbGF0ZXN0OiB7XG4gICAgICBnZXQoKSB7XG4gICAgICAgIGlmICghcmVzb2x2ZWQpIHJldHVybiByZWFkKCk7XG4gICAgICAgIGNvbnN0IGVyciA9IGVycm9yKCk7XG4gICAgICAgIGlmIChlcnIgJiYgIXByKSB0aHJvdyBlcnI7XG4gICAgICAgIHJldHVybiB2YWx1ZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG4gIGxldCBvd25lciA9IE93bmVyO1xuICBpZiAoZHluYW1pYykgY3JlYXRlQ29tcHV0ZWQoKCkgPT4gKG93bmVyID0gT3duZXIsIGxvYWQoZmFsc2UpKSk7ZWxzZSBsb2FkKGZhbHNlKTtcbiAgcmV0dXJuIFtyZWFkLCB7XG4gICAgcmVmZXRjaDogaW5mbyA9PiBydW5XaXRoT3duZXIob3duZXIsICgpID0+IGxvYWQoaW5mbykpLFxuICAgIG11dGF0ZTogc2V0VmFsdWVcbiAgfV07XG59XG5mdW5jdGlvbiBjcmVhdGVEZWZlcnJlZChzb3VyY2UsIG9wdGlvbnMpIHtcbiAgbGV0IHQsXG4gICAgdGltZW91dCA9IG9wdGlvbnMgPyBvcHRpb25zLnRpbWVvdXRNcyA6IHVuZGVmaW5lZDtcbiAgY29uc3Qgbm9kZSA9IGNyZWF0ZUNvbXB1dGF0aW9uKCgpID0+IHtcbiAgICBpZiAoIXQgfHwgIXQuZm4pIHQgPSByZXF1ZXN0Q2FsbGJhY2soKCkgPT4gc2V0RGVmZXJyZWQoKCkgPT4gbm9kZS52YWx1ZSksIHRpbWVvdXQgIT09IHVuZGVmaW5lZCA/IHtcbiAgICAgIHRpbWVvdXRcbiAgICB9IDogdW5kZWZpbmVkKTtcbiAgICByZXR1cm4gc291cmNlKCk7XG4gIH0sIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIGNvbnN0IFtkZWZlcnJlZCwgc2V0RGVmZXJyZWRdID0gY3JlYXRlU2lnbmFsKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUsIG9wdGlvbnMpO1xuICB1cGRhdGVDb21wdXRhdGlvbihub2RlKTtcbiAgc2V0RGVmZXJyZWQoKCkgPT4gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSk7XG4gIHJldHVybiBkZWZlcnJlZDtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVNlbGVjdG9yKHNvdXJjZSwgZm4gPSBlcXVhbEZuLCBvcHRpb25zKSB7XG4gIGNvbnN0IHN1YnMgPSBuZXcgTWFwKCk7XG4gIGNvbnN0IG5vZGUgPSBjcmVhdGVDb21wdXRhdGlvbihwID0+IHtcbiAgICBjb25zdCB2ID0gc291cmNlKCk7XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWxdIG9mIHN1YnMuZW50cmllcygpKSBpZiAoZm4oa2V5LCB2KSAhPT0gZm4oa2V5LCBwKSkge1xuICAgICAgZm9yIChjb25zdCBjIG9mIHZhbC52YWx1ZXMoKSkge1xuICAgICAgICBjLnN0YXRlID0gU1RBTEU7XG4gICAgICAgIGlmIChjLnB1cmUpIFVwZGF0ZXMucHVzaChjKTtlbHNlIEVmZmVjdHMucHVzaChjKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH0sIHVuZGVmaW5lZCwgdHJ1ZSwgU1RBTEUsIG9wdGlvbnMgKTtcbiAgdXBkYXRlQ29tcHV0YXRpb24obm9kZSk7XG4gIHJldHVybiBrZXkgPT4ge1xuICAgIGNvbnN0IGxpc3RlbmVyID0gTGlzdGVuZXI7XG4gICAgaWYgKGxpc3RlbmVyKSB7XG4gICAgICBsZXQgbDtcbiAgICAgIGlmIChsID0gc3Vicy5nZXQoa2V5KSkgbC5hZGQobGlzdGVuZXIpO2Vsc2Ugc3Vicy5zZXQoa2V5LCBsID0gbmV3IFNldChbbGlzdGVuZXJdKSk7XG4gICAgICBvbkNsZWFudXAoKCkgPT4ge1xuICAgICAgICBsLmRlbGV0ZShsaXN0ZW5lcik7XG4gICAgICAgICFsLnNpemUgJiYgc3Vicy5kZWxldGUoa2V5KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gZm4oa2V5LCBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlKTtcbiAgfTtcbn1cbmZ1bmN0aW9uIGJhdGNoKGZuKSB7XG4gIHJldHVybiBydW5VcGRhdGVzKGZuLCBmYWxzZSk7XG59XG5mdW5jdGlvbiB1bnRyYWNrKGZuKSB7XG4gIGlmICghRXh0ZXJuYWxTb3VyY2VDb25maWcgJiYgTGlzdGVuZXIgPT09IG51bGwpIHJldHVybiBmbigpO1xuICBjb25zdCBsaXN0ZW5lciA9IExpc3RlbmVyO1xuICBMaXN0ZW5lciA9IG51bGw7XG4gIHRyeSB7XG4gICAgaWYgKEV4dGVybmFsU291cmNlQ29uZmlnKSByZXR1cm4gRXh0ZXJuYWxTb3VyY2VDb25maWcudW50cmFjayhmbik7XG4gICAgcmV0dXJuIGZuKCk7XG4gIH0gZmluYWxseSB7XG4gICAgTGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgfVxufVxuZnVuY3Rpb24gb24oZGVwcywgZm4sIG9wdGlvbnMpIHtcbiAgY29uc3QgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkoZGVwcyk7XG4gIGxldCBwcmV2SW5wdXQ7XG4gIGxldCBkZWZlciA9IG9wdGlvbnMgJiYgb3B0aW9ucy5kZWZlcjtcbiAgcmV0dXJuIHByZXZWYWx1ZSA9PiB7XG4gICAgbGV0IGlucHV0O1xuICAgIGlmIChpc0FycmF5KSB7XG4gICAgICBpbnB1dCA9IEFycmF5KGRlcHMubGVuZ3RoKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGVwcy5sZW5ndGg7IGkrKykgaW5wdXRbaV0gPSBkZXBzW2ldKCk7XG4gICAgfSBlbHNlIGlucHV0ID0gZGVwcygpO1xuICAgIGlmIChkZWZlcikge1xuICAgICAgZGVmZXIgPSBmYWxzZTtcbiAgICAgIHJldHVybiBwcmV2VmFsdWU7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IHVudHJhY2soKCkgPT4gZm4oaW5wdXQsIHByZXZJbnB1dCwgcHJldlZhbHVlKSk7XG4gICAgcHJldklucHV0ID0gaW5wdXQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcbn1cbmZ1bmN0aW9uIG9uTW91bnQoZm4pIHtcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHVudHJhY2soZm4pKTtcbn1cbmZ1bmN0aW9uIG9uQ2xlYW51cChmbikge1xuICBpZiAoT3duZXIgPT09IG51bGwpIGNvbnNvbGUud2FybihcImNsZWFudXBzIGNyZWF0ZWQgb3V0c2lkZSBhIGBjcmVhdGVSb290YCBvciBgcmVuZGVyYCB3aWxsIG5ldmVyIGJlIHJ1blwiKTtlbHNlIGlmIChPd25lci5jbGVhbnVwcyA9PT0gbnVsbCkgT3duZXIuY2xlYW51cHMgPSBbZm5dO2Vsc2UgT3duZXIuY2xlYW51cHMucHVzaChmbik7XG4gIHJldHVybiBmbjtcbn1cbmZ1bmN0aW9uIGNhdGNoRXJyb3IoZm4sIGhhbmRsZXIpIHtcbiAgRVJST1IgfHwgKEVSUk9SID0gU3ltYm9sKFwiZXJyb3JcIikpO1xuICBPd25lciA9IGNyZWF0ZUNvbXB1dGF0aW9uKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgT3duZXIuY29udGV4dCA9IHtcbiAgICAuLi5Pd25lci5jb250ZXh0LFxuICAgIFtFUlJPUl06IFtoYW5kbGVyXVxuICB9O1xuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIFRyYW5zaXRpb24uc291cmNlcy5hZGQoT3duZXIpO1xuICB0cnkge1xuICAgIHJldHVybiBmbigpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBoYW5kbGVFcnJvcihlcnIpO1xuICB9IGZpbmFsbHkge1xuICAgIE93bmVyID0gT3duZXIub3duZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIGdldExpc3RlbmVyKCkge1xuICByZXR1cm4gTGlzdGVuZXI7XG59XG5mdW5jdGlvbiBnZXRPd25lcigpIHtcbiAgcmV0dXJuIE93bmVyO1xufVxuZnVuY3Rpb24gcnVuV2l0aE93bmVyKG8sIGZuKSB7XG4gIGNvbnN0IHByZXYgPSBPd25lcjtcbiAgY29uc3QgcHJldkxpc3RlbmVyID0gTGlzdGVuZXI7XG4gIE93bmVyID0gbztcbiAgTGlzdGVuZXIgPSBudWxsO1xuICB0cnkge1xuICAgIHJldHVybiBydW5VcGRhdGVzKGZuLCB0cnVlKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaGFuZGxlRXJyb3IoZXJyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBPd25lciA9IHByZXY7XG4gICAgTGlzdGVuZXIgPSBwcmV2TGlzdGVuZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIGVuYWJsZVNjaGVkdWxpbmcoc2NoZWR1bGVyID0gcmVxdWVzdENhbGxiYWNrKSB7XG4gIFNjaGVkdWxlciA9IHNjaGVkdWxlcjtcbn1cbmZ1bmN0aW9uIHN0YXJ0VHJhbnNpdGlvbihmbikge1xuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICBmbigpO1xuICAgIHJldHVybiBUcmFuc2l0aW9uLmRvbmU7XG4gIH1cbiAgY29uc3QgbCA9IExpc3RlbmVyO1xuICBjb25zdCBvID0gT3duZXI7XG4gIHJldHVybiBQcm9taXNlLnJlc29sdmUoKS50aGVuKCgpID0+IHtcbiAgICBMaXN0ZW5lciA9IGw7XG4gICAgT3duZXIgPSBvO1xuICAgIGxldCB0O1xuICAgIGlmIChTY2hlZHVsZXIgfHwgU3VzcGVuc2VDb250ZXh0KSB7XG4gICAgICB0ID0gVHJhbnNpdGlvbiB8fCAoVHJhbnNpdGlvbiA9IHtcbiAgICAgICAgc291cmNlczogbmV3IFNldCgpLFxuICAgICAgICBlZmZlY3RzOiBbXSxcbiAgICAgICAgcHJvbWlzZXM6IG5ldyBTZXQoKSxcbiAgICAgICAgZGlzcG9zZWQ6IG5ldyBTZXQoKSxcbiAgICAgICAgcXVldWU6IG5ldyBTZXQoKSxcbiAgICAgICAgcnVubmluZzogdHJ1ZVxuICAgICAgfSk7XG4gICAgICB0LmRvbmUgfHwgKHQuZG9uZSA9IG5ldyBQcm9taXNlKHJlcyA9PiB0LnJlc29sdmUgPSByZXMpKTtcbiAgICAgIHQucnVubmluZyA9IHRydWU7XG4gICAgfVxuICAgIHJ1blVwZGF0ZXMoZm4sIGZhbHNlKTtcbiAgICBMaXN0ZW5lciA9IE93bmVyID0gbnVsbDtcbiAgICByZXR1cm4gdCA/IHQuZG9uZSA6IHVuZGVmaW5lZDtcbiAgfSk7XG59XG5jb25zdCBbdHJhbnNQZW5kaW5nLCBzZXRUcmFuc1BlbmRpbmddID0gLypAX19QVVJFX18qL2NyZWF0ZVNpZ25hbChmYWxzZSk7XG5mdW5jdGlvbiB1c2VUcmFuc2l0aW9uKCkge1xuICByZXR1cm4gW3RyYW5zUGVuZGluZywgc3RhcnRUcmFuc2l0aW9uXTtcbn1cbmZ1bmN0aW9uIHJlc3VtZUVmZmVjdHMoZSkge1xuICBFZmZlY3RzLnB1c2guYXBwbHkoRWZmZWN0cywgZSk7XG4gIGUubGVuZ3RoID0gMDtcbn1cbmZ1bmN0aW9uIGRldkNvbXBvbmVudChDb21wLCBwcm9wcykge1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oKCkgPT4gdW50cmFjaygoKSA9PiB7XG4gICAgT2JqZWN0LmFzc2lnbihDb21wLCB7XG4gICAgICBbJERFVkNPTVBdOiB0cnVlXG4gICAgfSk7XG4gICAgcmV0dXJuIENvbXAocHJvcHMpO1xuICB9KSwgdW5kZWZpbmVkLCB0cnVlLCAwKTtcbiAgYy5wcm9wcyA9IHByb3BzO1xuICBjLm9ic2VydmVycyA9IG51bGw7XG4gIGMub2JzZXJ2ZXJTbG90cyA9IG51bGw7XG4gIGMubmFtZSA9IENvbXAubmFtZTtcbiAgYy5jb21wb25lbnQgPSBDb21wO1xuICB1cGRhdGVDb21wdXRhdGlvbihjKTtcbiAgcmV0dXJuIGMudFZhbHVlICE9PSB1bmRlZmluZWQgPyBjLnRWYWx1ZSA6IGMudmFsdWU7XG59XG5mdW5jdGlvbiByZWdpc3RlckdyYXBoKHZhbHVlKSB7XG4gIGlmIChPd25lcikge1xuICAgIGlmIChPd25lci5zb3VyY2VNYXApIE93bmVyLnNvdXJjZU1hcC5wdXNoKHZhbHVlKTtlbHNlIE93bmVyLnNvdXJjZU1hcCA9IFt2YWx1ZV07XG4gICAgdmFsdWUuZ3JhcGggPSBPd25lcjtcbiAgfVxuICBpZiAoRGV2SG9va3MuYWZ0ZXJSZWdpc3RlckdyYXBoKSBEZXZIb29rcy5hZnRlclJlZ2lzdGVyR3JhcGgodmFsdWUpO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29udGV4dChkZWZhdWx0VmFsdWUsIG9wdGlvbnMpIHtcbiAgY29uc3QgaWQgPSBTeW1ib2woXCJjb250ZXh0XCIpO1xuICByZXR1cm4ge1xuICAgIGlkLFxuICAgIFByb3ZpZGVyOiBjcmVhdGVQcm92aWRlcihpZCwgb3B0aW9ucyksXG4gICAgZGVmYXVsdFZhbHVlXG4gIH07XG59XG5mdW5jdGlvbiB1c2VDb250ZXh0KGNvbnRleHQpIHtcbiAgbGV0IHZhbHVlO1xuICByZXR1cm4gT3duZXIgJiYgT3duZXIuY29udGV4dCAmJiAodmFsdWUgPSBPd25lci5jb250ZXh0W2NvbnRleHQuaWRdKSAhPT0gdW5kZWZpbmVkID8gdmFsdWUgOiBjb250ZXh0LmRlZmF1bHRWYWx1ZTtcbn1cbmZ1bmN0aW9uIGNoaWxkcmVuKGZuKSB7XG4gIGNvbnN0IGNoaWxkcmVuID0gY3JlYXRlTWVtbyhmbik7XG4gIGNvbnN0IG1lbW8gPSBjcmVhdGVNZW1vKCgpID0+IHJlc29sdmVDaGlsZHJlbihjaGlsZHJlbigpKSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJjaGlsZHJlblwiXG4gIH0pIDtcbiAgbWVtby50b0FycmF5ID0gKCkgPT4ge1xuICAgIGNvbnN0IGMgPSBtZW1vKCk7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYykgPyBjIDogYyAhPSBudWxsID8gW2NdIDogW107XG4gIH07XG4gIHJldHVybiBtZW1vO1xufVxubGV0IFN1c3BlbnNlQ29udGV4dDtcbmZ1bmN0aW9uIGdldFN1c3BlbnNlQ29udGV4dCgpIHtcbiAgcmV0dXJuIFN1c3BlbnNlQ29udGV4dCB8fCAoU3VzcGVuc2VDb250ZXh0ID0gY3JlYXRlQ29udGV4dCgpKTtcbn1cbmZ1bmN0aW9uIGVuYWJsZUV4dGVybmFsU291cmNlKGZhY3RvcnksIHVudHJhY2sgPSBmbiA9PiBmbigpKSB7XG4gIGlmIChFeHRlcm5hbFNvdXJjZUNvbmZpZykge1xuICAgIGNvbnN0IHtcbiAgICAgIGZhY3Rvcnk6IG9sZEZhY3RvcnksXG4gICAgICB1bnRyYWNrOiBvbGRVbnRyYWNrXG4gICAgfSA9IEV4dGVybmFsU291cmNlQ29uZmlnO1xuICAgIEV4dGVybmFsU291cmNlQ29uZmlnID0ge1xuICAgICAgZmFjdG9yeTogKGZuLCB0cmlnZ2VyKSA9PiB7XG4gICAgICAgIGNvbnN0IG9sZFNvdXJjZSA9IG9sZEZhY3RvcnkoZm4sIHRyaWdnZXIpO1xuICAgICAgICBjb25zdCBzb3VyY2UgPSBmYWN0b3J5KHggPT4gb2xkU291cmNlLnRyYWNrKHgpLCB0cmlnZ2VyKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0cmFjazogeCA9PiBzb3VyY2UudHJhY2soeCksXG4gICAgICAgICAgZGlzcG9zZSgpIHtcbiAgICAgICAgICAgIHNvdXJjZS5kaXNwb3NlKCk7XG4gICAgICAgICAgICBvbGRTb3VyY2UuZGlzcG9zZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICB1bnRyYWNrOiBmbiA9PiBvbGRVbnRyYWNrKCgpID0+IHVudHJhY2soZm4pKVxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgRXh0ZXJuYWxTb3VyY2VDb25maWcgPSB7XG4gICAgICBmYWN0b3J5LFxuICAgICAgdW50cmFja1xuICAgIH07XG4gIH1cbn1cbmZ1bmN0aW9uIHJlYWRTaWduYWwoKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGlmICh0aGlzLnNvdXJjZXMgJiYgKHJ1bm5pbmdUcmFuc2l0aW9uID8gdGhpcy50U3RhdGUgOiB0aGlzLnN0YXRlKSkge1xuICAgIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyB0aGlzLnRTdGF0ZSA6IHRoaXMuc3RhdGUpID09PSBTVEFMRSkgdXBkYXRlQ29tcHV0YXRpb24odGhpcyk7ZWxzZSB7XG4gICAgICBjb25zdCB1cGRhdGVzID0gVXBkYXRlcztcbiAgICAgIFVwZGF0ZXMgPSBudWxsO1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiBsb29rVXBzdHJlYW0odGhpcyksIGZhbHNlKTtcbiAgICAgIFVwZGF0ZXMgPSB1cGRhdGVzO1xuICAgIH1cbiAgfVxuICBpZiAoTGlzdGVuZXIpIHtcbiAgICBjb25zdCBzU2xvdCA9IHRoaXMub2JzZXJ2ZXJzID8gdGhpcy5vYnNlcnZlcnMubGVuZ3RoIDogMDtcbiAgICBpZiAoIUxpc3RlbmVyLnNvdXJjZXMpIHtcbiAgICAgIExpc3RlbmVyLnNvdXJjZXMgPSBbdGhpc107XG4gICAgICBMaXN0ZW5lci5zb3VyY2VTbG90cyA9IFtzU2xvdF07XG4gICAgfSBlbHNlIHtcbiAgICAgIExpc3RlbmVyLnNvdXJjZXMucHVzaCh0aGlzKTtcbiAgICAgIExpc3RlbmVyLnNvdXJjZVNsb3RzLnB1c2goc1Nsb3QpO1xuICAgIH1cbiAgICBpZiAoIXRoaXMub2JzZXJ2ZXJzKSB7XG4gICAgICB0aGlzLm9ic2VydmVycyA9IFtMaXN0ZW5lcl07XG4gICAgICB0aGlzLm9ic2VydmVyU2xvdHMgPSBbTGlzdGVuZXIuc291cmNlcy5sZW5ndGggLSAxXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vYnNlcnZlcnMucHVzaChMaXN0ZW5lcik7XG4gICAgICB0aGlzLm9ic2VydmVyU2xvdHMucHVzaChMaXN0ZW5lci5zb3VyY2VzLmxlbmd0aCAtIDEpO1xuICAgIH1cbiAgfVxuICBpZiAocnVubmluZ1RyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyh0aGlzKSkgcmV0dXJuIHRoaXMudFZhbHVlO1xuICByZXR1cm4gdGhpcy52YWx1ZTtcbn1cbmZ1bmN0aW9uIHdyaXRlU2lnbmFsKG5vZGUsIHZhbHVlLCBpc0NvbXApIHtcbiAgbGV0IGN1cnJlbnQgPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlO1xuICBpZiAoIW5vZGUuY29tcGFyYXRvciB8fCAhbm9kZS5jb21wYXJhdG9yKGN1cnJlbnQsIHZhbHVlKSkge1xuICAgIGlmIChUcmFuc2l0aW9uKSB7XG4gICAgICBjb25zdCBUcmFuc2l0aW9uUnVubmluZyA9IFRyYW5zaXRpb24ucnVubmluZztcbiAgICAgIGlmIChUcmFuc2l0aW9uUnVubmluZyB8fCAhaXNDb21wICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkpIHtcbiAgICAgICAgVHJhbnNpdGlvbi5zb3VyY2VzLmFkZChub2RlKTtcbiAgICAgICAgbm9kZS50VmFsdWUgPSB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIGlmICghVHJhbnNpdGlvblJ1bm5pbmcpIG5vZGUudmFsdWUgPSB2YWx1ZTtcbiAgICB9IGVsc2Ugbm9kZS52YWx1ZSA9IHZhbHVlO1xuICAgIGlmIChub2RlLm9ic2VydmVycyAmJiBub2RlLm9ic2VydmVycy5sZW5ndGgpIHtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUub2JzZXJ2ZXJzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgY29uc3QgbyA9IG5vZGUub2JzZXJ2ZXJzW2ldO1xuICAgICAgICAgIGNvbnN0IFRyYW5zaXRpb25SdW5uaW5nID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gICAgICAgICAgaWYgKFRyYW5zaXRpb25SdW5uaW5nICYmIFRyYW5zaXRpb24uZGlzcG9zZWQuaGFzKG8pKSBjb250aW51ZTtcbiAgICAgICAgICBpZiAoVHJhbnNpdGlvblJ1bm5pbmcgPyAhby50U3RhdGUgOiAhby5zdGF0ZSkge1xuICAgICAgICAgICAgaWYgKG8ucHVyZSkgVXBkYXRlcy5wdXNoKG8pO2Vsc2UgRWZmZWN0cy5wdXNoKG8pO1xuICAgICAgICAgICAgaWYgKG8ub2JzZXJ2ZXJzKSBtYXJrRG93bnN0cmVhbShvKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFUcmFuc2l0aW9uUnVubmluZykgby5zdGF0ZSA9IFNUQUxFO2Vsc2Ugby50U3RhdGUgPSBTVEFMRTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoVXBkYXRlcy5sZW5ndGggPiAxMGU1KSB7XG4gICAgICAgICAgVXBkYXRlcyA9IFtdO1xuICAgICAgICAgIGlmIChJU19ERVYpIHRocm93IG5ldyBFcnJvcihcIlBvdGVudGlhbCBJbmZpbml0ZSBMb29wIERldGVjdGVkLlwiKTtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgfSwgZmFsc2UpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5mdW5jdGlvbiB1cGRhdGVDb21wdXRhdGlvbihub2RlKSB7XG4gIGlmICghbm9kZS5mbikgcmV0dXJuO1xuICBjbGVhbk5vZGUobm9kZSk7XG4gIGNvbnN0IHRpbWUgPSBFeGVjQ291bnQ7XG4gIHJ1bkNvbXB1dGF0aW9uKG5vZGUsIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUsIHRpbWUpO1xuICBpZiAoVHJhbnNpdGlvbiAmJiAhVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkpIHtcbiAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgVHJhbnNpdGlvbiAmJiAoVHJhbnNpdGlvbi5ydW5uaW5nID0gdHJ1ZSk7XG4gICAgICAgIExpc3RlbmVyID0gT3duZXIgPSBub2RlO1xuICAgICAgICBydW5Db21wdXRhdGlvbihub2RlLCBub2RlLnRWYWx1ZSwgdGltZSk7XG4gICAgICAgIExpc3RlbmVyID0gT3duZXIgPSBudWxsO1xuICAgICAgfSwgZmFsc2UpO1xuICAgIH0pO1xuICB9XG59XG5mdW5jdGlvbiBydW5Db21wdXRhdGlvbihub2RlLCB2YWx1ZSwgdGltZSkge1xuICBsZXQgbmV4dFZhbHVlO1xuICBjb25zdCBvd25lciA9IE93bmVyLFxuICAgIGxpc3RlbmVyID0gTGlzdGVuZXI7XG4gIExpc3RlbmVyID0gT3duZXIgPSBub2RlO1xuICB0cnkge1xuICAgIG5leHRWYWx1ZSA9IG5vZGUuZm4odmFsdWUpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAobm9kZS5wdXJlKSB7XG4gICAgICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICAgICAgbm9kZS50U3RhdGUgPSBTVEFMRTtcbiAgICAgICAgbm9kZS50T3duZWQgJiYgbm9kZS50T3duZWQuZm9yRWFjaChjbGVhbk5vZGUpO1xuICAgICAgICBub2RlLnRPd25lZCA9IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5vZGUuc3RhdGUgPSBTVEFMRTtcbiAgICAgICAgbm9kZS5vd25lZCAmJiBub2RlLm93bmVkLmZvckVhY2goY2xlYW5Ob2RlKTtcbiAgICAgICAgbm9kZS5vd25lZCA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIG5vZGUudXBkYXRlZEF0ID0gdGltZSArIDE7XG4gICAgcmV0dXJuIGhhbmRsZUVycm9yKGVycik7XG4gIH0gZmluYWxseSB7XG4gICAgTGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgICBPd25lciA9IG93bmVyO1xuICB9XG4gIGlmICghbm9kZS51cGRhdGVkQXQgfHwgbm9kZS51cGRhdGVkQXQgPD0gdGltZSkge1xuICAgIGlmIChub2RlLnVwZGF0ZWRBdCAhPSBudWxsICYmIFwib2JzZXJ2ZXJzXCIgaW4gbm9kZSkge1xuICAgICAgd3JpdGVTaWduYWwobm9kZSwgbmV4dFZhbHVlLCB0cnVlKTtcbiAgICB9IGVsc2UgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIG5vZGUucHVyZSkge1xuICAgICAgVHJhbnNpdGlvbi5zb3VyY2VzLmFkZChub2RlKTtcbiAgICAgIG5vZGUudFZhbHVlID0gbmV4dFZhbHVlO1xuICAgIH0gZWxzZSBub2RlLnZhbHVlID0gbmV4dFZhbHVlO1xuICAgIG5vZGUudXBkYXRlZEF0ID0gdGltZTtcbiAgfVxufVxuZnVuY3Rpb24gY3JlYXRlQ29tcHV0YXRpb24oZm4sIGluaXQsIHB1cmUsIHN0YXRlID0gU1RBTEUsIG9wdGlvbnMpIHtcbiAgY29uc3QgYyA9IHtcbiAgICBmbixcbiAgICBzdGF0ZTogc3RhdGUsXG4gICAgdXBkYXRlZEF0OiBudWxsLFxuICAgIG93bmVkOiBudWxsLFxuICAgIHNvdXJjZXM6IG51bGwsXG4gICAgc291cmNlU2xvdHM6IG51bGwsXG4gICAgY2xlYW51cHM6IG51bGwsXG4gICAgdmFsdWU6IGluaXQsXG4gICAgb3duZXI6IE93bmVyLFxuICAgIGNvbnRleHQ6IE93bmVyID8gT3duZXIuY29udGV4dCA6IG51bGwsXG4gICAgcHVyZVxuICB9O1xuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICBjLnN0YXRlID0gMDtcbiAgICBjLnRTdGF0ZSA9IHN0YXRlO1xuICB9XG4gIGlmIChPd25lciA9PT0gbnVsbCkgY29uc29sZS53YXJuKFwiY29tcHV0YXRpb25zIGNyZWF0ZWQgb3V0c2lkZSBhIGBjcmVhdGVSb290YCBvciBgcmVuZGVyYCB3aWxsIG5ldmVyIGJlIGRpc3Bvc2VkXCIpO2Vsc2UgaWYgKE93bmVyICE9PSBVTk9XTkVEKSB7XG4gICAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIE93bmVyLnB1cmUpIHtcbiAgICAgIGlmICghT3duZXIudE93bmVkKSBPd25lci50T3duZWQgPSBbY107ZWxzZSBPd25lci50T3duZWQucHVzaChjKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFPd25lci5vd25lZCkgT3duZXIub3duZWQgPSBbY107ZWxzZSBPd25lci5vd25lZC5wdXNoKGMpO1xuICAgIH1cbiAgfVxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLm5hbWUpIGMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgaWYgKEV4dGVybmFsU291cmNlQ29uZmlnICYmIGMuZm4pIHtcbiAgICBjb25zdCBbdHJhY2ssIHRyaWdnZXJdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCwge1xuICAgICAgZXF1YWxzOiBmYWxzZVxuICAgIH0pO1xuICAgIGNvbnN0IG9yZGluYXJ5ID0gRXh0ZXJuYWxTb3VyY2VDb25maWcuZmFjdG9yeShjLmZuLCB0cmlnZ2VyKTtcbiAgICBvbkNsZWFudXAoKCkgPT4gb3JkaW5hcnkuZGlzcG9zZSgpKTtcbiAgICBjb25zdCB0cmlnZ2VySW5UcmFuc2l0aW9uID0gKCkgPT4gc3RhcnRUcmFuc2l0aW9uKHRyaWdnZXIpLnRoZW4oKCkgPT4gaW5UcmFuc2l0aW9uLmRpc3Bvc2UoKSk7XG4gICAgY29uc3QgaW5UcmFuc2l0aW9uID0gRXh0ZXJuYWxTb3VyY2VDb25maWcuZmFjdG9yeShjLmZuLCB0cmlnZ2VySW5UcmFuc2l0aW9uKTtcbiAgICBjLmZuID0geCA9PiB7XG4gICAgICB0cmFjaygpO1xuICAgICAgcmV0dXJuIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nID8gaW5UcmFuc2l0aW9uLnRyYWNrKHgpIDogb3JkaW5hcnkudHJhY2soeCk7XG4gICAgfTtcbiAgfVxuICBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyICYmIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIoYyk7XG4gIHJldHVybiBjO1xufVxuZnVuY3Rpb24gcnVuVG9wKG5vZGUpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgPT09IDApIHJldHVybjtcbiAgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgPT09IFBFTkRJTkcpIHJldHVybiBsb29rVXBzdHJlYW0obm9kZSk7XG4gIGlmIChub2RlLnN1c3BlbnNlICYmIHVudHJhY2sobm9kZS5zdXNwZW5zZS5pbkZhbGxiYWNrKSkgcmV0dXJuIG5vZGUuc3VzcGVuc2UuZWZmZWN0cy5wdXNoKG5vZGUpO1xuICBjb25zdCBhbmNlc3RvcnMgPSBbbm9kZV07XG4gIHdoaWxlICgobm9kZSA9IG5vZGUub3duZXIpICYmICghbm9kZS51cGRhdGVkQXQgfHwgbm9kZS51cGRhdGVkQXQgPCBFeGVjQ291bnQpKSB7XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24uZGlzcG9zZWQuaGFzKG5vZGUpKSByZXR1cm47XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSBhbmNlc3RvcnMucHVzaChub2RlKTtcbiAgfVxuICBmb3IgKGxldCBpID0gYW5jZXN0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgbm9kZSA9IGFuY2VzdG9yc1tpXTtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24pIHtcbiAgICAgIGxldCB0b3AgPSBub2RlLFxuICAgICAgICBwcmV2ID0gYW5jZXN0b3JzW2kgKyAxXTtcbiAgICAgIHdoaWxlICgodG9wID0gdG9wLm93bmVyKSAmJiB0b3AgIT09IHByZXYpIHtcbiAgICAgICAgaWYgKFRyYW5zaXRpb24uZGlzcG9zZWQuaGFzKHRvcCkpIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgPT09IFNUQUxFKSB7XG4gICAgICB1cGRhdGVDb21wdXRhdGlvbihub2RlKTtcbiAgICB9IGVsc2UgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgPT09IFBFTkRJTkcpIHtcbiAgICAgIGNvbnN0IHVwZGF0ZXMgPSBVcGRhdGVzO1xuICAgICAgVXBkYXRlcyA9IG51bGw7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IGxvb2tVcHN0cmVhbShub2RlLCBhbmNlc3RvcnNbMF0pLCBmYWxzZSk7XG4gICAgICBVcGRhdGVzID0gdXBkYXRlcztcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIHJ1blVwZGF0ZXMoZm4sIGluaXQpIHtcbiAgaWYgKFVwZGF0ZXMpIHJldHVybiBmbigpO1xuICBsZXQgd2FpdCA9IGZhbHNlO1xuICBpZiAoIWluaXQpIFVwZGF0ZXMgPSBbXTtcbiAgaWYgKEVmZmVjdHMpIHdhaXQgPSB0cnVlO2Vsc2UgRWZmZWN0cyA9IFtdO1xuICBFeGVjQ291bnQrKztcbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBmbigpO1xuICAgIGNvbXBsZXRlVXBkYXRlcyh3YWl0KTtcbiAgICByZXR1cm4gcmVzO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoIXdhaXQpIEVmZmVjdHMgPSBudWxsO1xuICAgIFVwZGF0ZXMgPSBudWxsO1xuICAgIGhhbmRsZUVycm9yKGVycik7XG4gIH1cbn1cbmZ1bmN0aW9uIGNvbXBsZXRlVXBkYXRlcyh3YWl0KSB7XG4gIGlmIChVcGRhdGVzKSB7XG4gICAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgc2NoZWR1bGVRdWV1ZShVcGRhdGVzKTtlbHNlIHJ1blF1ZXVlKFVwZGF0ZXMpO1xuICAgIFVwZGF0ZXMgPSBudWxsO1xuICB9XG4gIGlmICh3YWl0KSByZXR1cm47XG4gIGxldCByZXM7XG4gIGlmIChUcmFuc2l0aW9uKSB7XG4gICAgaWYgKCFUcmFuc2l0aW9uLnByb21pc2VzLnNpemUgJiYgIVRyYW5zaXRpb24ucXVldWUuc2l6ZSkge1xuICAgICAgY29uc3Qgc291cmNlcyA9IFRyYW5zaXRpb24uc291cmNlcztcbiAgICAgIGNvbnN0IGRpc3Bvc2VkID0gVHJhbnNpdGlvbi5kaXNwb3NlZDtcbiAgICAgIEVmZmVjdHMucHVzaC5hcHBseShFZmZlY3RzLCBUcmFuc2l0aW9uLmVmZmVjdHMpO1xuICAgICAgcmVzID0gVHJhbnNpdGlvbi5yZXNvbHZlO1xuICAgICAgZm9yIChjb25zdCBlIG9mIEVmZmVjdHMpIHtcbiAgICAgICAgXCJ0U3RhdGVcIiBpbiBlICYmIChlLnN0YXRlID0gZS50U3RhdGUpO1xuICAgICAgICBkZWxldGUgZS50U3RhdGU7XG4gICAgICB9XG4gICAgICBUcmFuc2l0aW9uID0gbnVsbDtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICBmb3IgKGNvbnN0IGQgb2YgZGlzcG9zZWQpIGNsZWFuTm9kZShkKTtcbiAgICAgICAgZm9yIChjb25zdCB2IG9mIHNvdXJjZXMpIHtcbiAgICAgICAgICB2LnZhbHVlID0gdi50VmFsdWU7XG4gICAgICAgICAgaWYgKHYub3duZWQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB2Lm93bmVkLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSBjbGVhbk5vZGUodi5vd25lZFtpXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh2LnRPd25lZCkgdi5vd25lZCA9IHYudE93bmVkO1xuICAgICAgICAgIGRlbGV0ZSB2LnRWYWx1ZTtcbiAgICAgICAgICBkZWxldGUgdi50T3duZWQ7XG4gICAgICAgICAgdi50U3RhdGUgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHNldFRyYW5zUGVuZGluZyhmYWxzZSk7XG4gICAgICB9LCBmYWxzZSk7XG4gICAgfSBlbHNlIGlmIChUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICAgIFRyYW5zaXRpb24ucnVubmluZyA9IGZhbHNlO1xuICAgICAgVHJhbnNpdGlvbi5lZmZlY3RzLnB1c2guYXBwbHkoVHJhbnNpdGlvbi5lZmZlY3RzLCBFZmZlY3RzKTtcbiAgICAgIEVmZmVjdHMgPSBudWxsO1xuICAgICAgc2V0VHJhbnNQZW5kaW5nKHRydWUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuICBjb25zdCBlID0gRWZmZWN0cztcbiAgRWZmZWN0cyA9IG51bGw7XG4gIGlmIChlLmxlbmd0aCkgcnVuVXBkYXRlcygoKSA9PiBydW5FZmZlY3RzKGUpLCBmYWxzZSk7ZWxzZSBEZXZIb29rcy5hZnRlclVwZGF0ZSAmJiBEZXZIb29rcy5hZnRlclVwZGF0ZSgpO1xuICBpZiAocmVzKSByZXMoKTtcbn1cbmZ1bmN0aW9uIHJ1blF1ZXVlKHF1ZXVlKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHJ1blRvcChxdWV1ZVtpXSk7XG59XG5mdW5jdGlvbiBzY2hlZHVsZVF1ZXVlKHF1ZXVlKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBpdGVtID0gcXVldWVbaV07XG4gICAgY29uc3QgdGFza3MgPSBUcmFuc2l0aW9uLnF1ZXVlO1xuICAgIGlmICghdGFza3MuaGFzKGl0ZW0pKSB7XG4gICAgICB0YXNrcy5hZGQoaXRlbSk7XG4gICAgICBTY2hlZHVsZXIoKCkgPT4ge1xuICAgICAgICB0YXNrcy5kZWxldGUoaXRlbSk7XG4gICAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICAgIFRyYW5zaXRpb24ucnVubmluZyA9IHRydWU7XG4gICAgICAgICAgcnVuVG9wKGl0ZW0pO1xuICAgICAgICB9LCBmYWxzZSk7XG4gICAgICAgIFRyYW5zaXRpb24gJiYgKFRyYW5zaXRpb24ucnVubmluZyA9IGZhbHNlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gcnVuVXNlckVmZmVjdHMocXVldWUpIHtcbiAgbGV0IGksXG4gICAgdXNlckxlbmd0aCA9IDA7XG4gIGZvciAoaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGUgPSBxdWV1ZVtpXTtcbiAgICBpZiAoIWUudXNlcikgcnVuVG9wKGUpO2Vsc2UgcXVldWVbdXNlckxlbmd0aCsrXSA9IGU7XG4gIH1cbiAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0KSB7XG4gICAgaWYgKHNoYXJlZENvbmZpZy5jb3VudCkge1xuICAgICAgc2hhcmVkQ29uZmlnLmVmZmVjdHMgfHwgKHNoYXJlZENvbmZpZy5lZmZlY3RzID0gW10pO1xuICAgICAgc2hhcmVkQ29uZmlnLmVmZmVjdHMucHVzaCguLi5xdWV1ZS5zbGljZSgwLCB1c2VyTGVuZ3RoKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHNldEh5ZHJhdGVDb250ZXh0KCk7XG4gIH1cbiAgaWYgKHNoYXJlZENvbmZpZy5lZmZlY3RzICYmIChzaGFyZWRDb25maWcuZG9uZSB8fCAhc2hhcmVkQ29uZmlnLmNvdW50KSkge1xuICAgIHF1ZXVlID0gWy4uLnNoYXJlZENvbmZpZy5lZmZlY3RzLCAuLi5xdWV1ZV07XG4gICAgdXNlckxlbmd0aCArPSBzaGFyZWRDb25maWcuZWZmZWN0cy5sZW5ndGg7XG4gICAgZGVsZXRlIHNoYXJlZENvbmZpZy5lZmZlY3RzO1xuICB9XG4gIGZvciAoaSA9IDA7IGkgPCB1c2VyTGVuZ3RoOyBpKyspIHJ1blRvcChxdWV1ZVtpXSk7XG59XG5mdW5jdGlvbiBsb29rVXBzdHJlYW0obm9kZSwgaWdub3JlKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGlmIChydW5uaW5nVHJhbnNpdGlvbikgbm9kZS50U3RhdGUgPSAwO2Vsc2Ugbm9kZS5zdGF0ZSA9IDA7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5zb3VyY2VzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgY29uc3Qgc291cmNlID0gbm9kZS5zb3VyY2VzW2ldO1xuICAgIGlmIChzb3VyY2Uuc291cmNlcykge1xuICAgICAgY29uc3Qgc3RhdGUgPSBydW5uaW5nVHJhbnNpdGlvbiA/IHNvdXJjZS50U3RhdGUgOiBzb3VyY2Uuc3RhdGU7XG4gICAgICBpZiAoc3RhdGUgPT09IFNUQUxFKSB7XG4gICAgICAgIGlmIChzb3VyY2UgIT09IGlnbm9yZSAmJiAoIXNvdXJjZS51cGRhdGVkQXQgfHwgc291cmNlLnVwZGF0ZWRBdCA8IEV4ZWNDb3VudCkpIHJ1blRvcChzb3VyY2UpO1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gUEVORElORykgbG9va1Vwc3RyZWFtKHNvdXJjZSwgaWdub3JlKTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIG1hcmtEb3duc3RyZWFtKG5vZGUpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLm9ic2VydmVycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGNvbnN0IG8gPSBub2RlLm9ic2VydmVyc1tpXTtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24gPyAhby50U3RhdGUgOiAhby5zdGF0ZSkge1xuICAgICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uKSBvLnRTdGF0ZSA9IFBFTkRJTkc7ZWxzZSBvLnN0YXRlID0gUEVORElORztcbiAgICAgIGlmIChvLnB1cmUpIFVwZGF0ZXMucHVzaChvKTtlbHNlIEVmZmVjdHMucHVzaChvKTtcbiAgICAgIG8ub2JzZXJ2ZXJzICYmIG1hcmtEb3duc3RyZWFtKG8pO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gY2xlYW5Ob2RlKG5vZGUpIHtcbiAgbGV0IGk7XG4gIGlmIChub2RlLnNvdXJjZXMpIHtcbiAgICB3aGlsZSAobm9kZS5zb3VyY2VzLmxlbmd0aCkge1xuICAgICAgY29uc3Qgc291cmNlID0gbm9kZS5zb3VyY2VzLnBvcCgpLFxuICAgICAgICBpbmRleCA9IG5vZGUuc291cmNlU2xvdHMucG9wKCksXG4gICAgICAgIG9icyA9IHNvdXJjZS5vYnNlcnZlcnM7XG4gICAgICBpZiAob2JzICYmIG9icy5sZW5ndGgpIHtcbiAgICAgICAgY29uc3QgbiA9IG9icy5wb3AoKSxcbiAgICAgICAgICBzID0gc291cmNlLm9ic2VydmVyU2xvdHMucG9wKCk7XG4gICAgICAgIGlmIChpbmRleCA8IG9icy5sZW5ndGgpIHtcbiAgICAgICAgICBuLnNvdXJjZVNsb3RzW3NdID0gaW5kZXg7XG4gICAgICAgICAgb2JzW2luZGV4XSA9IG47XG4gICAgICAgICAgc291cmNlLm9ic2VydmVyU2xvdHNbaW5kZXhdID0gcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAobm9kZS50T3duZWQpIHtcbiAgICBmb3IgKGkgPSBub2RlLnRPd25lZC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgY2xlYW5Ob2RlKG5vZGUudE93bmVkW2ldKTtcbiAgICBkZWxldGUgbm9kZS50T3duZWQ7XG4gIH1cbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIG5vZGUucHVyZSkge1xuICAgIHJlc2V0KG5vZGUsIHRydWUpO1xuICB9IGVsc2UgaWYgKG5vZGUub3duZWQpIHtcbiAgICBmb3IgKGkgPSBub2RlLm93bmVkLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBjbGVhbk5vZGUobm9kZS5vd25lZFtpXSk7XG4gICAgbm9kZS5vd25lZCA9IG51bGw7XG4gIH1cbiAgaWYgKG5vZGUuY2xlYW51cHMpIHtcbiAgICBmb3IgKGkgPSBub2RlLmNsZWFudXBzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBub2RlLmNsZWFudXBzW2ldKCk7XG4gICAgbm9kZS5jbGVhbnVwcyA9IG51bGw7XG4gIH1cbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBub2RlLnRTdGF0ZSA9IDA7ZWxzZSBub2RlLnN0YXRlID0gMDtcbiAgZGVsZXRlIG5vZGUuc291cmNlTWFwO1xufVxuZnVuY3Rpb24gcmVzZXQobm9kZSwgdG9wKSB7XG4gIGlmICghdG9wKSB7XG4gICAgbm9kZS50U3RhdGUgPSAwO1xuICAgIFRyYW5zaXRpb24uZGlzcG9zZWQuYWRkKG5vZGUpO1xuICB9XG4gIGlmIChub2RlLm93bmVkKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLm93bmVkLmxlbmd0aDsgaSsrKSByZXNldChub2RlLm93bmVkW2ldKTtcbiAgfVxufVxuZnVuY3Rpb24gY2FzdEVycm9yKGVycikge1xuICBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHJldHVybiBlcnI7XG4gIHJldHVybiBuZXcgRXJyb3IodHlwZW9mIGVyciA9PT0gXCJzdHJpbmdcIiA/IGVyciA6IFwiVW5rbm93biBlcnJvclwiLCB7XG4gICAgY2F1c2U6IGVyclxuICB9KTtcbn1cbmZ1bmN0aW9uIHJ1bkVycm9ycyhlcnIsIGZucywgb3duZXIpIHtcbiAgdHJ5IHtcbiAgICBmb3IgKGNvbnN0IGYgb2YgZm5zKSBmKGVycik7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBoYW5kbGVFcnJvcihlLCBvd25lciAmJiBvd25lci5vd25lciB8fCBudWxsKTtcbiAgfVxufVxuZnVuY3Rpb24gaGFuZGxlRXJyb3IoZXJyLCBvd25lciA9IE93bmVyKSB7XG4gIGNvbnN0IGZucyA9IEVSUk9SICYmIG93bmVyICYmIG93bmVyLmNvbnRleHQgJiYgb3duZXIuY29udGV4dFtFUlJPUl07XG4gIGNvbnN0IGVycm9yID0gY2FzdEVycm9yKGVycik7XG4gIGlmICghZm5zKSB0aHJvdyBlcnJvcjtcbiAgaWYgKEVmZmVjdHMpIEVmZmVjdHMucHVzaCh7XG4gICAgZm4oKSB7XG4gICAgICBydW5FcnJvcnMoZXJyb3IsIGZucywgb3duZXIpO1xuICAgIH0sXG4gICAgc3RhdGU6IFNUQUxFXG4gIH0pO2Vsc2UgcnVuRXJyb3JzKGVycm9yLCBmbnMsIG93bmVyKTtcbn1cbmZ1bmN0aW9uIHJlc29sdmVDaGlsZHJlbihjaGlsZHJlbikge1xuICBpZiAodHlwZW9mIGNoaWxkcmVuID09PSBcImZ1bmN0aW9uXCIgJiYgIWNoaWxkcmVuLmxlbmd0aCkgcmV0dXJuIHJlc29sdmVDaGlsZHJlbihjaGlsZHJlbigpKTtcbiAgaWYgKEFycmF5LmlzQXJyYXkoY2hpbGRyZW4pKSB7XG4gICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHJlc29sdmVDaGlsZHJlbihjaGlsZHJlbltpXSk7XG4gICAgICBBcnJheS5pc0FycmF5KHJlc3VsdCkgPyByZXN1bHRzLnB1c2guYXBwbHkocmVzdWx0cywgcmVzdWx0KSA6IHJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxuICByZXR1cm4gY2hpbGRyZW47XG59XG5mdW5jdGlvbiBjcmVhdGVQcm92aWRlcihpZCwgb3B0aW9ucykge1xuICByZXR1cm4gZnVuY3Rpb24gcHJvdmlkZXIocHJvcHMpIHtcbiAgICBsZXQgcmVzO1xuICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiByZXMgPSB1bnRyYWNrKCgpID0+IHtcbiAgICAgIE93bmVyLmNvbnRleHQgPSB7XG4gICAgICAgIC4uLk93bmVyLmNvbnRleHQsXG4gICAgICAgIFtpZF06IHByb3BzLnZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIGNoaWxkcmVuKCgpID0+IHByb3BzLmNoaWxkcmVuKTtcbiAgICB9KSwgdW5kZWZpbmVkLCBvcHRpb25zKTtcbiAgICByZXR1cm4gcmVzO1xuICB9O1xufVxuZnVuY3Rpb24gb25FcnJvcihmbikge1xuICBFUlJPUiB8fCAoRVJST1IgPSBTeW1ib2woXCJlcnJvclwiKSk7XG4gIGlmIChPd25lciA9PT0gbnVsbCkgY29uc29sZS53YXJuKFwiZXJyb3IgaGFuZGxlcnMgY3JlYXRlZCBvdXRzaWRlIGEgYGNyZWF0ZVJvb3RgIG9yIGByZW5kZXJgIHdpbGwgbmV2ZXIgYmUgcnVuXCIpO2Vsc2UgaWYgKE93bmVyLmNvbnRleHQgPT09IG51bGwgfHwgIU93bmVyLmNvbnRleHRbRVJST1JdKSB7XG4gICAgT3duZXIuY29udGV4dCA9IHtcbiAgICAgIC4uLk93bmVyLmNvbnRleHQsXG4gICAgICBbRVJST1JdOiBbZm5dXG4gICAgfTtcbiAgICBtdXRhdGVDb250ZXh0KE93bmVyLCBFUlJPUiwgW2ZuXSk7XG4gIH0gZWxzZSBPd25lci5jb250ZXh0W0VSUk9SXS5wdXNoKGZuKTtcbn1cbmZ1bmN0aW9uIG11dGF0ZUNvbnRleHQobywga2V5LCB2YWx1ZSkge1xuICBpZiAoby5vd25lZCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgby5vd25lZC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKG8ub3duZWRbaV0uY29udGV4dCA9PT0gby5jb250ZXh0KSBtdXRhdGVDb250ZXh0KG8ub3duZWRbaV0sIGtleSwgdmFsdWUpO1xuICAgICAgaWYgKCFvLm93bmVkW2ldLmNvbnRleHQpIHtcbiAgICAgICAgby5vd25lZFtpXS5jb250ZXh0ID0gby5jb250ZXh0O1xuICAgICAgICBtdXRhdGVDb250ZXh0KG8ub3duZWRbaV0sIGtleSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIGlmICghby5vd25lZFtpXS5jb250ZXh0W2tleV0pIHtcbiAgICAgICAgby5vd25lZFtpXS5jb250ZXh0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgbXV0YXRlQ29udGV4dChvLm93bmVkW2ldLCBrZXksIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gb2JzZXJ2YWJsZShpbnB1dCkge1xuICByZXR1cm4ge1xuICAgIHN1YnNjcmliZShvYnNlcnZlcikge1xuICAgICAgaWYgKCEob2JzZXJ2ZXIgaW5zdGFuY2VvZiBPYmplY3QpIHx8IG9ic2VydmVyID09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkV4cGVjdGVkIHRoZSBvYnNlcnZlciB0byBiZSBhbiBvYmplY3QuXCIpO1xuICAgICAgfVxuICAgICAgY29uc3QgaGFuZGxlciA9IHR5cGVvZiBvYnNlcnZlciA9PT0gXCJmdW5jdGlvblwiID8gb2JzZXJ2ZXIgOiBvYnNlcnZlci5uZXh0ICYmIG9ic2VydmVyLm5leHQuYmluZChvYnNlcnZlcik7XG4gICAgICBpZiAoIWhhbmRsZXIpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1bnN1YnNjcmliZSgpIHt9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBjb25zdCBkaXNwb3NlID0gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgICAgICAgY29uc3QgdiA9IGlucHV0KCk7XG4gICAgICAgICAgdW50cmFjaygoKSA9PiBoYW5kbGVyKHYpKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkaXNwb3NlcjtcbiAgICAgIH0pO1xuICAgICAgaWYgKGdldE93bmVyKCkpIG9uQ2xlYW51cChkaXNwb3NlKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCkge1xuICAgICAgICAgIGRpc3Bvc2UoKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9LFxuICAgIFtTeW1ib2wub2JzZXJ2YWJsZSB8fCBcIkBAb2JzZXJ2YWJsZVwiXSgpIHtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfTtcbn1cbmZ1bmN0aW9uIGZyb20ocHJvZHVjZXIsIGluaXRhbFZhbHVlID0gdW5kZWZpbmVkKSB7XG4gIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKGluaXRhbFZhbHVlLCB7XG4gICAgZXF1YWxzOiBmYWxzZVxuICB9KTtcbiAgaWYgKFwic3Vic2NyaWJlXCIgaW4gcHJvZHVjZXIpIHtcbiAgICBjb25zdCB1bnN1YiA9IHByb2R1Y2VyLnN1YnNjcmliZSh2ID0+IHNldCgoKSA9PiB2KSk7XG4gICAgb25DbGVhbnVwKCgpID0+IFwidW5zdWJzY3JpYmVcIiBpbiB1bnN1YiA/IHVuc3ViLnVuc3Vic2NyaWJlKCkgOiB1bnN1YigpKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBjbGVhbiA9IHByb2R1Y2VyKHNldCk7XG4gICAgb25DbGVhbnVwKGNsZWFuKTtcbiAgfVxuICByZXR1cm4gcztcbn1cblxuY29uc3QgRkFMTEJBQ0sgPSBTeW1ib2woXCJmYWxsYmFja1wiKTtcbmZ1bmN0aW9uIGRpc3Bvc2UoZCkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGQubGVuZ3RoOyBpKyspIGRbaV0oKTtcbn1cbmZ1bmN0aW9uIG1hcEFycmF5KGxpc3QsIG1hcEZuLCBvcHRpb25zID0ge30pIHtcbiAgbGV0IGl0ZW1zID0gW10sXG4gICAgbWFwcGVkID0gW10sXG4gICAgZGlzcG9zZXJzID0gW10sXG4gICAgbGVuID0gMCxcbiAgICBpbmRleGVzID0gbWFwRm4ubGVuZ3RoID4gMSA/IFtdIDogbnVsbDtcbiAgb25DbGVhbnVwKCgpID0+IGRpc3Bvc2UoZGlzcG9zZXJzKSk7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgbGV0IG5ld0l0ZW1zID0gbGlzdCgpIHx8IFtdLFxuICAgICAgbmV3TGVuID0gbmV3SXRlbXMubGVuZ3RoLFxuICAgICAgaSxcbiAgICAgIGo7XG4gICAgbmV3SXRlbXNbJFRSQUNLXTtcbiAgICByZXR1cm4gdW50cmFjaygoKSA9PiB7XG4gICAgICBsZXQgbmV3SW5kaWNlcywgbmV3SW5kaWNlc05leHQsIHRlbXAsIHRlbXBkaXNwb3NlcnMsIHRlbXBJbmRleGVzLCBzdGFydCwgZW5kLCBuZXdFbmQsIGl0ZW07XG4gICAgICBpZiAobmV3TGVuID09PSAwKSB7XG4gICAgICAgIGlmIChsZW4gIT09IDApIHtcbiAgICAgICAgICBkaXNwb3NlKGRpc3Bvc2Vycyk7XG4gICAgICAgICAgZGlzcG9zZXJzID0gW107XG4gICAgICAgICAgaXRlbXMgPSBbXTtcbiAgICAgICAgICBtYXBwZWQgPSBbXTtcbiAgICAgICAgICBsZW4gPSAwO1xuICAgICAgICAgIGluZGV4ZXMgJiYgKGluZGV4ZXMgPSBbXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZmFsbGJhY2spIHtcbiAgICAgICAgICBpdGVtcyA9IFtGQUxMQkFDS107XG4gICAgICAgICAgbWFwcGVkWzBdID0gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgICAgICBkaXNwb3NlcnNbMF0gPSBkaXNwb3NlcjtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb25zLmZhbGxiYWNrKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGVuID0gMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAobGVuID09PSAwKSB7XG4gICAgICAgIG1hcHBlZCA9IG5ldyBBcnJheShuZXdMZW4pO1xuICAgICAgICBmb3IgKGogPSAwOyBqIDwgbmV3TGVuOyBqKyspIHtcbiAgICAgICAgICBpdGVtc1tqXSA9IG5ld0l0ZW1zW2pdO1xuICAgICAgICAgIG1hcHBlZFtqXSA9IGNyZWF0ZVJvb3QobWFwcGVyKTtcbiAgICAgICAgfVxuICAgICAgICBsZW4gPSBuZXdMZW47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZW1wID0gbmV3IEFycmF5KG5ld0xlbik7XG4gICAgICAgIHRlbXBkaXNwb3NlcnMgPSBuZXcgQXJyYXkobmV3TGVuKTtcbiAgICAgICAgaW5kZXhlcyAmJiAodGVtcEluZGV4ZXMgPSBuZXcgQXJyYXkobmV3TGVuKSk7XG4gICAgICAgIGZvciAoc3RhcnQgPSAwLCBlbmQgPSBNYXRoLm1pbihsZW4sIG5ld0xlbik7IHN0YXJ0IDwgZW5kICYmIGl0ZW1zW3N0YXJ0XSA9PT0gbmV3SXRlbXNbc3RhcnRdOyBzdGFydCsrKTtcbiAgICAgICAgZm9yIChlbmQgPSBsZW4gLSAxLCBuZXdFbmQgPSBuZXdMZW4gLSAxOyBlbmQgPj0gc3RhcnQgJiYgbmV3RW5kID49IHN0YXJ0ICYmIGl0ZW1zW2VuZF0gPT09IG5ld0l0ZW1zW25ld0VuZF07IGVuZC0tLCBuZXdFbmQtLSkge1xuICAgICAgICAgIHRlbXBbbmV3RW5kXSA9IG1hcHBlZFtlbmRdO1xuICAgICAgICAgIHRlbXBkaXNwb3NlcnNbbmV3RW5kXSA9IGRpc3Bvc2Vyc1tlbmRdO1xuICAgICAgICAgIGluZGV4ZXMgJiYgKHRlbXBJbmRleGVzW25ld0VuZF0gPSBpbmRleGVzW2VuZF0pO1xuICAgICAgICB9XG4gICAgICAgIG5ld0luZGljZXMgPSBuZXcgTWFwKCk7XG4gICAgICAgIG5ld0luZGljZXNOZXh0ID0gbmV3IEFycmF5KG5ld0VuZCArIDEpO1xuICAgICAgICBmb3IgKGogPSBuZXdFbmQ7IGogPj0gc3RhcnQ7IGotLSkge1xuICAgICAgICAgIGl0ZW0gPSBuZXdJdGVtc1tqXTtcbiAgICAgICAgICBpID0gbmV3SW5kaWNlcy5nZXQoaXRlbSk7XG4gICAgICAgICAgbmV3SW5kaWNlc05leHRbal0gPSBpID09PSB1bmRlZmluZWQgPyAtMSA6IGk7XG4gICAgICAgICAgbmV3SW5kaWNlcy5zZXQoaXRlbSwgaik7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChpID0gc3RhcnQ7IGkgPD0gZW5kOyBpKyspIHtcbiAgICAgICAgICBpdGVtID0gaXRlbXNbaV07XG4gICAgICAgICAgaiA9IG5ld0luZGljZXMuZ2V0KGl0ZW0pO1xuICAgICAgICAgIGlmIChqICE9PSB1bmRlZmluZWQgJiYgaiAhPT0gLTEpIHtcbiAgICAgICAgICAgIHRlbXBbal0gPSBtYXBwZWRbaV07XG4gICAgICAgICAgICB0ZW1wZGlzcG9zZXJzW2pdID0gZGlzcG9zZXJzW2ldO1xuICAgICAgICAgICAgaW5kZXhlcyAmJiAodGVtcEluZGV4ZXNbal0gPSBpbmRleGVzW2ldKTtcbiAgICAgICAgICAgIGogPSBuZXdJbmRpY2VzTmV4dFtqXTtcbiAgICAgICAgICAgIG5ld0luZGljZXMuc2V0KGl0ZW0sIGopO1xuICAgICAgICAgIH0gZWxzZSBkaXNwb3NlcnNbaV0oKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGogPSBzdGFydDsgaiA8IG5ld0xlbjsgaisrKSB7XG4gICAgICAgICAgaWYgKGogaW4gdGVtcCkge1xuICAgICAgICAgICAgbWFwcGVkW2pdID0gdGVtcFtqXTtcbiAgICAgICAgICAgIGRpc3Bvc2Vyc1tqXSA9IHRlbXBkaXNwb3NlcnNbal07XG4gICAgICAgICAgICBpZiAoaW5kZXhlcykge1xuICAgICAgICAgICAgICBpbmRleGVzW2pdID0gdGVtcEluZGV4ZXNbal07XG4gICAgICAgICAgICAgIGluZGV4ZXNbal0oaik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIG1hcHBlZFtqXSA9IGNyZWF0ZVJvb3QobWFwcGVyKTtcbiAgICAgICAgfVxuICAgICAgICBtYXBwZWQgPSBtYXBwZWQuc2xpY2UoMCwgbGVuID0gbmV3TGVuKTtcbiAgICAgICAgaXRlbXMgPSBuZXdJdGVtcy5zbGljZSgwKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXBwZWQ7XG4gICAgfSk7XG4gICAgZnVuY3Rpb24gbWFwcGVyKGRpc3Bvc2VyKSB7XG4gICAgICBkaXNwb3NlcnNbal0gPSBkaXNwb3NlcjtcbiAgICAgIGlmIChpbmRleGVzKSB7XG4gICAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKGosIHtcbiAgICAgICAgICBuYW1lOiBcImluZGV4XCJcbiAgICAgICAgfSkgO1xuICAgICAgICBpbmRleGVzW2pdID0gc2V0O1xuICAgICAgICByZXR1cm4gbWFwRm4obmV3SXRlbXNbal0sIHMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1hcEZuKG5ld0l0ZW1zW2pdKTtcbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiBpbmRleEFycmF5KGxpc3QsIG1hcEZuLCBvcHRpb25zID0ge30pIHtcbiAgbGV0IGl0ZW1zID0gW10sXG4gICAgbWFwcGVkID0gW10sXG4gICAgZGlzcG9zZXJzID0gW10sXG4gICAgc2lnbmFscyA9IFtdLFxuICAgIGxlbiA9IDAsXG4gICAgaTtcbiAgb25DbGVhbnVwKCgpID0+IGRpc3Bvc2UoZGlzcG9zZXJzKSk7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgY29uc3QgbmV3SXRlbXMgPSBsaXN0KCkgfHwgW10sXG4gICAgICBuZXdMZW4gPSBuZXdJdGVtcy5sZW5ndGg7XG4gICAgbmV3SXRlbXNbJFRSQUNLXTtcbiAgICByZXR1cm4gdW50cmFjaygoKSA9PiB7XG4gICAgICBpZiAobmV3TGVuID09PSAwKSB7XG4gICAgICAgIGlmIChsZW4gIT09IDApIHtcbiAgICAgICAgICBkaXNwb3NlKGRpc3Bvc2Vycyk7XG4gICAgICAgICAgZGlzcG9zZXJzID0gW107XG4gICAgICAgICAgaXRlbXMgPSBbXTtcbiAgICAgICAgICBtYXBwZWQgPSBbXTtcbiAgICAgICAgICBsZW4gPSAwO1xuICAgICAgICAgIHNpZ25hbHMgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5mYWxsYmFjaykge1xuICAgICAgICAgIGl0ZW1zID0gW0ZBTExCQUNLXTtcbiAgICAgICAgICBtYXBwZWRbMF0gPSBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgICAgIGRpc3Bvc2Vyc1swXSA9IGRpc3Bvc2VyO1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMuZmFsbGJhY2soKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBsZW4gPSAxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXBwZWQ7XG4gICAgICB9XG4gICAgICBpZiAoaXRlbXNbMF0gPT09IEZBTExCQUNLKSB7XG4gICAgICAgIGRpc3Bvc2Vyc1swXSgpO1xuICAgICAgICBkaXNwb3NlcnMgPSBbXTtcbiAgICAgICAgaXRlbXMgPSBbXTtcbiAgICAgICAgbWFwcGVkID0gW107XG4gICAgICAgIGxlbiA9IDA7XG4gICAgICB9XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbmV3TGVuOyBpKyspIHtcbiAgICAgICAgaWYgKGkgPCBpdGVtcy5sZW5ndGggJiYgaXRlbXNbaV0gIT09IG5ld0l0ZW1zW2ldKSB7XG4gICAgICAgICAgc2lnbmFsc1tpXSgoKSA9PiBuZXdJdGVtc1tpXSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaSA+PSBpdGVtcy5sZW5ndGgpIHtcbiAgICAgICAgICBtYXBwZWRbaV0gPSBjcmVhdGVSb290KG1hcHBlcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZvciAoOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZGlzcG9zZXJzW2ldKCk7XG4gICAgICB9XG4gICAgICBsZW4gPSBzaWduYWxzLmxlbmd0aCA9IGRpc3Bvc2Vycy5sZW5ndGggPSBuZXdMZW47XG4gICAgICBpdGVtcyA9IG5ld0l0ZW1zLnNsaWNlKDApO1xuICAgICAgcmV0dXJuIG1hcHBlZCA9IG1hcHBlZC5zbGljZSgwLCBsZW4pO1xuICAgIH0pO1xuICAgIGZ1bmN0aW9uIG1hcHBlcihkaXNwb3Nlcikge1xuICAgICAgZGlzcG9zZXJzW2ldID0gZGlzcG9zZXI7XG4gICAgICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbChuZXdJdGVtc1tpXSwge1xuICAgICAgICBuYW1lOiBcInZhbHVlXCJcbiAgICAgIH0pIDtcbiAgICAgIHNpZ25hbHNbaV0gPSBzZXQ7XG4gICAgICByZXR1cm4gbWFwRm4ocywgaSk7XG4gICAgfVxuICB9O1xufVxuXG5sZXQgaHlkcmF0aW9uRW5hYmxlZCA9IGZhbHNlO1xuZnVuY3Rpb24gZW5hYmxlSHlkcmF0aW9uKCkge1xuICBoeWRyYXRpb25FbmFibGVkID0gdHJ1ZTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudChDb21wLCBwcm9wcykge1xuICBpZiAoaHlkcmF0aW9uRW5hYmxlZCkge1xuICAgIGlmIChzaGFyZWRDb25maWcuY29udGV4dCkge1xuICAgICAgY29uc3QgYyA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICAgICAgc2V0SHlkcmF0ZUNvbnRleHQobmV4dEh5ZHJhdGVDb250ZXh0KCkpO1xuICAgICAgY29uc3QgciA9IGRldkNvbXBvbmVudChDb21wLCBwcm9wcyB8fCB7fSkgO1xuICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoYyk7XG4gICAgICByZXR1cm4gcjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRldkNvbXBvbmVudChDb21wLCBwcm9wcyB8fCB7fSk7XG59XG5mdW5jdGlvbiB0cnVlRm4oKSB7XG4gIHJldHVybiB0cnVlO1xufVxuY29uc3QgcHJvcFRyYXBzID0ge1xuICBnZXQoXywgcHJvcGVydHksIHJlY2VpdmVyKSB7XG4gICAgaWYgKHByb3BlcnR5ID09PSAkUFJPWFkpIHJldHVybiByZWNlaXZlcjtcbiAgICByZXR1cm4gXy5nZXQocHJvcGVydHkpO1xuICB9LFxuICBoYXMoXywgcHJvcGVydHkpIHtcbiAgICBpZiAocHJvcGVydHkgPT09ICRQUk9YWSkgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIF8uaGFzKHByb3BlcnR5KTtcbiAgfSxcbiAgc2V0OiB0cnVlRm4sXG4gIGRlbGV0ZVByb3BlcnR5OiB0cnVlRm4sXG4gIGdldE93blByb3BlcnR5RGVzY3JpcHRvcihfLCBwcm9wZXJ0eSkge1xuICAgIHJldHVybiB7XG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgZ2V0KCkge1xuICAgICAgICByZXR1cm4gXy5nZXQocHJvcGVydHkpO1xuICAgICAgfSxcbiAgICAgIHNldDogdHJ1ZUZuLFxuICAgICAgZGVsZXRlUHJvcGVydHk6IHRydWVGblxuICAgIH07XG4gIH0sXG4gIG93bktleXMoXykge1xuICAgIHJldHVybiBfLmtleXMoKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHJlc29sdmVTb3VyY2Uocykge1xuICByZXR1cm4gIShzID0gdHlwZW9mIHMgPT09IFwiZnVuY3Rpb25cIiA/IHMoKSA6IHMpID8ge30gOiBzO1xufVxuZnVuY3Rpb24gcmVzb2x2ZVNvdXJjZXMoKSB7XG4gIGZvciAobGV0IGkgPSAwLCBsZW5ndGggPSB0aGlzLmxlbmd0aDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgY29uc3QgdiA9IHRoaXNbaV0oKTtcbiAgICBpZiAodiAhPT0gdW5kZWZpbmVkKSByZXR1cm4gdjtcbiAgfVxufVxuZnVuY3Rpb24gbWVyZ2VQcm9wcyguLi5zb3VyY2VzKSB7XG4gIGxldCBwcm94eSA9IGZhbHNlO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHNvdXJjZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBzID0gc291cmNlc1tpXTtcbiAgICBwcm94eSA9IHByb3h5IHx8ICEhcyAmJiAkUFJPWFkgaW4gcztcbiAgICBzb3VyY2VzW2ldID0gdHlwZW9mIHMgPT09IFwiZnVuY3Rpb25cIiA/IChwcm94eSA9IHRydWUsIGNyZWF0ZU1lbW8ocykpIDogcztcbiAgfVxuICBpZiAoU1VQUE9SVFNfUFJPWFkgJiYgcHJveHkpIHtcbiAgICByZXR1cm4gbmV3IFByb3h5KHtcbiAgICAgIGdldChwcm9wZXJ0eSkge1xuICAgICAgICBmb3IgKGxldCBpID0gc291cmNlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgIGNvbnN0IHYgPSByZXNvbHZlU291cmNlKHNvdXJjZXNbaV0pW3Byb3BlcnR5XTtcbiAgICAgICAgICBpZiAodiAhPT0gdW5kZWZpbmVkKSByZXR1cm4gdjtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGhhcyhwcm9wZXJ0eSkge1xuICAgICAgICBmb3IgKGxldCBpID0gc291cmNlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgIGlmIChwcm9wZXJ0eSBpbiByZXNvbHZlU291cmNlKHNvdXJjZXNbaV0pKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAga2V5cygpIHtcbiAgICAgICAgY29uc3Qga2V5cyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvdXJjZXMubGVuZ3RoOyBpKyspIGtleXMucHVzaCguLi5PYmplY3Qua2V5cyhyZXNvbHZlU291cmNlKHNvdXJjZXNbaV0pKSk7XG4gICAgICAgIHJldHVybiBbLi4ubmV3IFNldChrZXlzKV07XG4gICAgICB9XG4gICAgfSwgcHJvcFRyYXBzKTtcbiAgfVxuICBjb25zdCBzb3VyY2VzTWFwID0ge307XG4gIGNvbnN0IGRlZmluZWQgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICBmb3IgKGxldCBpID0gc291cmNlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGNvbnN0IHNvdXJjZSA9IHNvdXJjZXNbaV07XG4gICAgaWYgKCFzb3VyY2UpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHNvdXJjZUtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhzb3VyY2UpO1xuICAgIGZvciAobGV0IGkgPSBzb3VyY2VLZXlzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBrZXkgPSBzb3VyY2VLZXlzW2ldO1xuICAgICAgaWYgKGtleSA9PT0gXCJfX3Byb3RvX19cIiB8fCBrZXkgPT09IFwiY29uc3RydWN0b3JcIikgY29udGludWU7XG4gICAgICBjb25zdCBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihzb3VyY2UsIGtleSk7XG4gICAgICBpZiAoIWRlZmluZWRba2V5XSkge1xuICAgICAgICBkZWZpbmVkW2tleV0gPSBkZXNjLmdldCA/IHtcbiAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBnZXQ6IHJlc29sdmVTb3VyY2VzLmJpbmQoc291cmNlc01hcFtrZXldID0gW2Rlc2MuZ2V0LmJpbmQoc291cmNlKV0pXG4gICAgICAgIH0gOiBkZXNjLnZhbHVlICE9PSB1bmRlZmluZWQgPyBkZXNjIDogdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3Qgc291cmNlcyA9IHNvdXJjZXNNYXBba2V5XTtcbiAgICAgICAgaWYgKHNvdXJjZXMpIHtcbiAgICAgICAgICBpZiAoZGVzYy5nZXQpIHNvdXJjZXMucHVzaChkZXNjLmdldC5iaW5kKHNvdXJjZSkpO2Vsc2UgaWYgKGRlc2MudmFsdWUgIT09IHVuZGVmaW5lZCkgc291cmNlcy5wdXNoKCgpID0+IGRlc2MudmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNvbnN0IHRhcmdldCA9IHt9O1xuICBjb25zdCBkZWZpbmVkS2V5cyA9IE9iamVjdC5rZXlzKGRlZmluZWQpO1xuICBmb3IgKGxldCBpID0gZGVmaW5lZEtleXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBjb25zdCBrZXkgPSBkZWZpbmVkS2V5c1tpXSxcbiAgICAgIGRlc2MgPSBkZWZpbmVkW2tleV07XG4gICAgaWYgKGRlc2MgJiYgZGVzYy5nZXQpIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgZGVzYyk7ZWxzZSB0YXJnZXRba2V5XSA9IGRlc2MgPyBkZXNjLnZhbHVlIDogdW5kZWZpbmVkO1xuICB9XG4gIHJldHVybiB0YXJnZXQ7XG59XG5mdW5jdGlvbiBzcGxpdFByb3BzKHByb3BzLCAuLi5rZXlzKSB7XG4gIGlmIChTVVBQT1JUU19QUk9YWSAmJiAkUFJPWFkgaW4gcHJvcHMpIHtcbiAgICBjb25zdCBibG9ja2VkID0gbmV3IFNldChrZXlzLmxlbmd0aCA+IDEgPyBrZXlzLmZsYXQoKSA6IGtleXNbMF0pO1xuICAgIGNvbnN0IHJlcyA9IGtleXMubWFwKGsgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm94eSh7XG4gICAgICAgIGdldChwcm9wZXJ0eSkge1xuICAgICAgICAgIHJldHVybiBrLmluY2x1ZGVzKHByb3BlcnR5KSA/IHByb3BzW3Byb3BlcnR5XSA6IHVuZGVmaW5lZDtcbiAgICAgICAgfSxcbiAgICAgICAgaGFzKHByb3BlcnR5KSB7XG4gICAgICAgICAgcmV0dXJuIGsuaW5jbHVkZXMocHJvcGVydHkpICYmIHByb3BlcnR5IGluIHByb3BzO1xuICAgICAgICB9LFxuICAgICAgICBrZXlzKCkge1xuICAgICAgICAgIHJldHVybiBrLmZpbHRlcihwcm9wZXJ0eSA9PiBwcm9wZXJ0eSBpbiBwcm9wcyk7XG4gICAgICAgIH1cbiAgICAgIH0sIHByb3BUcmFwcyk7XG4gICAgfSk7XG4gICAgcmVzLnB1c2gobmV3IFByb3h5KHtcbiAgICAgIGdldChwcm9wZXJ0eSkge1xuICAgICAgICByZXR1cm4gYmxvY2tlZC5oYXMocHJvcGVydHkpID8gdW5kZWZpbmVkIDogcHJvcHNbcHJvcGVydHldO1xuICAgICAgfSxcbiAgICAgIGhhcyhwcm9wZXJ0eSkge1xuICAgICAgICByZXR1cm4gYmxvY2tlZC5oYXMocHJvcGVydHkpID8gZmFsc2UgOiBwcm9wZXJ0eSBpbiBwcm9wcztcbiAgICAgIH0sXG4gICAgICBrZXlzKCkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMocHJvcHMpLmZpbHRlcihrID0+ICFibG9ja2VkLmhhcyhrKSk7XG4gICAgICB9XG4gICAgfSwgcHJvcFRyYXBzKSk7XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuICBjb25zdCBvdGhlck9iamVjdCA9IHt9O1xuICBjb25zdCBvYmplY3RzID0ga2V5cy5tYXAoKCkgPT4gKHt9KSk7XG4gIGZvciAoY29uc3QgcHJvcE5hbWUgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMocHJvcHMpKSB7XG4gICAgY29uc3QgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IocHJvcHMsIHByb3BOYW1lKTtcbiAgICBjb25zdCBpc0RlZmF1bHREZXNjID0gIWRlc2MuZ2V0ICYmICFkZXNjLnNldCAmJiBkZXNjLmVudW1lcmFibGUgJiYgZGVzYy53cml0YWJsZSAmJiBkZXNjLmNvbmZpZ3VyYWJsZTtcbiAgICBsZXQgYmxvY2tlZCA9IGZhbHNlO1xuICAgIGxldCBvYmplY3RJbmRleCA9IDA7XG4gICAgZm9yIChjb25zdCBrIG9mIGtleXMpIHtcbiAgICAgIGlmIChrLmluY2x1ZGVzKHByb3BOYW1lKSkge1xuICAgICAgICBibG9ja2VkID0gdHJ1ZTtcbiAgICAgICAgaXNEZWZhdWx0RGVzYyA/IG9iamVjdHNbb2JqZWN0SW5kZXhdW3Byb3BOYW1lXSA9IGRlc2MudmFsdWUgOiBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqZWN0c1tvYmplY3RJbmRleF0sIHByb3BOYW1lLCBkZXNjKTtcbiAgICAgIH1cbiAgICAgICsrb2JqZWN0SW5kZXg7XG4gICAgfVxuICAgIGlmICghYmxvY2tlZCkge1xuICAgICAgaXNEZWZhdWx0RGVzYyA/IG90aGVyT2JqZWN0W3Byb3BOYW1lXSA9IGRlc2MudmFsdWUgOiBPYmplY3QuZGVmaW5lUHJvcGVydHkob3RoZXJPYmplY3QsIHByb3BOYW1lLCBkZXNjKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIFsuLi5vYmplY3RzLCBvdGhlck9iamVjdF07XG59XG5mdW5jdGlvbiBsYXp5KGZuKSB7XG4gIGxldCBjb21wO1xuICBsZXQgcDtcbiAgY29uc3Qgd3JhcCA9IHByb3BzID0+IHtcbiAgICBjb25zdCBjdHggPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICBpZiAoY3R4KSB7XG4gICAgICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbCgpO1xuICAgICAgc2hhcmVkQ29uZmlnLmNvdW50IHx8IChzaGFyZWRDb25maWcuY291bnQgPSAwKTtcbiAgICAgIHNoYXJlZENvbmZpZy5jb3VudCsrO1xuICAgICAgKHAgfHwgKHAgPSBmbigpKSkudGhlbihtb2QgPT4ge1xuICAgICAgICAhc2hhcmVkQ29uZmlnLmRvbmUgJiYgc2V0SHlkcmF0ZUNvbnRleHQoY3R4KTtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmNvdW50LS07XG4gICAgICAgIHNldCgoKSA9PiBtb2QuZGVmYXVsdCk7XG4gICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KCk7XG4gICAgICB9KTtcbiAgICAgIGNvbXAgPSBzO1xuICAgIH0gZWxzZSBpZiAoIWNvbXApIHtcbiAgICAgIGNvbnN0IFtzXSA9IGNyZWF0ZVJlc291cmNlKCgpID0+IChwIHx8IChwID0gZm4oKSkpLnRoZW4obW9kID0+IG1vZC5kZWZhdWx0KSk7XG4gICAgICBjb21wID0gcztcbiAgICB9XG4gICAgbGV0IENvbXA7XG4gICAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4gKENvbXAgPSBjb21wKCkpID8gdW50cmFjaygoKSA9PiB7XG4gICAgICBpZiAoSVNfREVWKSBPYmplY3QuYXNzaWduKENvbXAsIHtcbiAgICAgICAgWyRERVZDT01QXTogdHJ1ZVxuICAgICAgfSk7XG4gICAgICBpZiAoIWN0eCB8fCBzaGFyZWRDb25maWcuZG9uZSkgcmV0dXJuIENvbXAocHJvcHMpO1xuICAgICAgY29uc3QgYyA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoY3R4KTtcbiAgICAgIGNvbnN0IHIgPSBDb21wKHByb3BzKTtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGMpO1xuICAgICAgcmV0dXJuIHI7XG4gICAgfSkgOiBcIlwiKTtcbiAgfTtcbiAgd3JhcC5wcmVsb2FkID0gKCkgPT4gcCB8fCAoKHAgPSBmbigpKS50aGVuKG1vZCA9PiBjb21wID0gKCkgPT4gbW9kLmRlZmF1bHQpLCBwKTtcbiAgcmV0dXJuIHdyYXA7XG59XG5sZXQgY291bnRlciA9IDA7XG5mdW5jdGlvbiBjcmVhdGVVbmlxdWVJZCgpIHtcbiAgY29uc3QgY3R4ID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gIHJldHVybiBjdHggPyBzaGFyZWRDb25maWcuZ2V0TmV4dENvbnRleHRJZCgpIDogYGNsLSR7Y291bnRlcisrfWA7XG59XG5cbmNvbnN0IG5hcnJvd2VkRXJyb3IgPSBuYW1lID0+IGBBdHRlbXB0aW5nIHRvIGFjY2VzcyBhIHN0YWxlIHZhbHVlIGZyb20gPCR7bmFtZX0+IHRoYXQgY291bGQgcG9zc2libHkgYmUgdW5kZWZpbmVkLiBUaGlzIG1heSBvY2N1ciBiZWNhdXNlIHlvdSBhcmUgcmVhZGluZyB0aGUgYWNjZXNzb3IgcmV0dXJuZWQgZnJvbSB0aGUgY29tcG9uZW50IGF0IGEgdGltZSB3aGVyZSBpdCBoYXMgYWxyZWFkeSBiZWVuIHVubW91bnRlZC4gV2UgcmVjb21tZW5kIGNsZWFuaW5nIHVwIGFueSBzdGFsZSB0aW1lcnMgb3IgYXN5bmMsIG9yIHJlYWRpbmcgZnJvbSB0aGUgaW5pdGlhbCBjb25kaXRpb24uYCA7XG5mdW5jdGlvbiBGb3IocHJvcHMpIHtcbiAgY29uc3QgZmFsbGJhY2sgPSBcImZhbGxiYWNrXCIgaW4gcHJvcHMgJiYge1xuICAgIGZhbGxiYWNrOiAoKSA9PiBwcm9wcy5mYWxsYmFja1xuICB9O1xuICByZXR1cm4gY3JlYXRlTWVtbyhtYXBBcnJheSgoKSA9PiBwcm9wcy5lYWNoLCBwcm9wcy5jaGlsZHJlbiwgZmFsbGJhY2sgfHwgdW5kZWZpbmVkKSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJ2YWx1ZVwiXG4gIH0pIDtcbn1cbmZ1bmN0aW9uIEluZGV4KHByb3BzKSB7XG4gIGNvbnN0IGZhbGxiYWNrID0gXCJmYWxsYmFja1wiIGluIHByb3BzICYmIHtcbiAgICBmYWxsYmFjazogKCkgPT4gcHJvcHMuZmFsbGJhY2tcbiAgfTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oaW5kZXhBcnJheSgoKSA9PiBwcm9wcy5lYWNoLCBwcm9wcy5jaGlsZHJlbiwgZmFsbGJhY2sgfHwgdW5kZWZpbmVkKSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJ2YWx1ZVwiXG4gIH0pIDtcbn1cbmZ1bmN0aW9uIFNob3cocHJvcHMpIHtcbiAgY29uc3Qga2V5ZWQgPSBwcm9wcy5rZXllZDtcbiAgY29uc3QgY29uZGl0aW9uVmFsdWUgPSBjcmVhdGVNZW1vKCgpID0+IHByb3BzLndoZW4sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwiY29uZGl0aW9uIHZhbHVlXCJcbiAgfSApO1xuICBjb25zdCBjb25kaXRpb24gPSBrZXllZCA/IGNvbmRpdGlvblZhbHVlIDogY3JlYXRlTWVtbyhjb25kaXRpb25WYWx1ZSwgdW5kZWZpbmVkLCB7XG4gICAgZXF1YWxzOiAoYSwgYikgPT4gIWEgPT09ICFiLFxuICAgIG5hbWU6IFwiY29uZGl0aW9uXCJcbiAgfSApO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgYyA9IGNvbmRpdGlvbigpO1xuICAgIGlmIChjKSB7XG4gICAgICBjb25zdCBjaGlsZCA9IHByb3BzLmNoaWxkcmVuO1xuICAgICAgY29uc3QgZm4gPSB0eXBlb2YgY2hpbGQgPT09IFwiZnVuY3Rpb25cIiAmJiBjaGlsZC5sZW5ndGggPiAwO1xuICAgICAgcmV0dXJuIGZuID8gdW50cmFjaygoKSA9PiBjaGlsZChrZXllZCA/IGMgOiAoKSA9PiB7XG4gICAgICAgIGlmICghdW50cmFjayhjb25kaXRpb24pKSB0aHJvdyBuYXJyb3dlZEVycm9yKFwiU2hvd1wiKTtcbiAgICAgICAgcmV0dXJuIGNvbmRpdGlvblZhbHVlKCk7XG4gICAgICB9KSkgOiBjaGlsZDtcbiAgICB9XG4gICAgcmV0dXJuIHByb3BzLmZhbGxiYWNrO1xuICB9LCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSApO1xufVxuZnVuY3Rpb24gU3dpdGNoKHByb3BzKSB7XG4gIGNvbnN0IGNocyA9IGNoaWxkcmVuKCgpID0+IHByb3BzLmNoaWxkcmVuKTtcbiAgY29uc3Qgc3dpdGNoRnVuYyA9IGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGNoID0gY2hzKCk7XG4gICAgY29uc3QgbXBzID0gQXJyYXkuaXNBcnJheShjaCkgPyBjaCA6IFtjaF07XG4gICAgbGV0IGZ1bmMgPSAoKSA9PiB1bmRlZmluZWQ7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gaTtcbiAgICAgIGNvbnN0IG1wID0gbXBzW2ldO1xuICAgICAgY29uc3QgcHJldkZ1bmMgPSBmdW5jO1xuICAgICAgY29uc3QgY29uZGl0aW9uVmFsdWUgPSBjcmVhdGVNZW1vKCgpID0+IHByZXZGdW5jKCkgPyB1bmRlZmluZWQgOiBtcC53aGVuLCB1bmRlZmluZWQsIHtcbiAgICAgICAgbmFtZTogXCJjb25kaXRpb24gdmFsdWVcIlxuICAgICAgfSApO1xuICAgICAgY29uc3QgY29uZGl0aW9uID0gbXAua2V5ZWQgPyBjb25kaXRpb25WYWx1ZSA6IGNyZWF0ZU1lbW8oY29uZGl0aW9uVmFsdWUsIHVuZGVmaW5lZCwge1xuICAgICAgICBlcXVhbHM6IChhLCBiKSA9PiAhYSA9PT0gIWIsXG4gICAgICAgIG5hbWU6IFwiY29uZGl0aW9uXCJcbiAgICAgIH0gKTtcbiAgICAgIGZ1bmMgPSAoKSA9PiBwcmV2RnVuYygpIHx8IChjb25kaXRpb24oKSA/IFtpbmRleCwgY29uZGl0aW9uVmFsdWUsIG1wXSA6IHVuZGVmaW5lZCk7XG4gICAgfVxuICAgIHJldHVybiBmdW5jO1xuICB9KTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IHNlbCA9IHN3aXRjaEZ1bmMoKSgpO1xuICAgIGlmICghc2VsKSByZXR1cm4gcHJvcHMuZmFsbGJhY2s7XG4gICAgY29uc3QgW2luZGV4LCBjb25kaXRpb25WYWx1ZSwgbXBdID0gc2VsO1xuICAgIGNvbnN0IGNoaWxkID0gbXAuY2hpbGRyZW47XG4gICAgY29uc3QgZm4gPSB0eXBlb2YgY2hpbGQgPT09IFwiZnVuY3Rpb25cIiAmJiBjaGlsZC5sZW5ndGggPiAwO1xuICAgIHJldHVybiBmbiA/IHVudHJhY2soKCkgPT4gY2hpbGQobXAua2V5ZWQgPyBjb25kaXRpb25WYWx1ZSgpIDogKCkgPT4ge1xuICAgICAgaWYgKHVudHJhY2soc3dpdGNoRnVuYykoKT8uWzBdICE9PSBpbmRleCkgdGhyb3cgbmFycm93ZWRFcnJvcihcIk1hdGNoXCIpO1xuICAgICAgcmV0dXJuIGNvbmRpdGlvblZhbHVlKCk7XG4gICAgfSkpIDogY2hpbGQ7XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwiZXZhbCBjb25kaXRpb25zXCJcbiAgfSApO1xufVxuZnVuY3Rpb24gTWF0Y2gocHJvcHMpIHtcbiAgcmV0dXJuIHByb3BzO1xufVxubGV0IEVycm9ycztcbmZ1bmN0aW9uIHJlc2V0RXJyb3JCb3VuZGFyaWVzKCkge1xuICBFcnJvcnMgJiYgWy4uLkVycm9yc10uZm9yRWFjaChmbiA9PiBmbigpKTtcbn1cbmZ1bmN0aW9uIEVycm9yQm91bmRhcnkocHJvcHMpIHtcbiAgbGV0IGVycjtcbiAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0ICYmIHNoYXJlZENvbmZpZy5sb2FkKSBlcnIgPSBzaGFyZWRDb25maWcubG9hZChzaGFyZWRDb25maWcuZ2V0Q29udGV4dElkKCkpO1xuICBjb25zdCBbZXJyb3JlZCwgc2V0RXJyb3JlZF0gPSBjcmVhdGVTaWduYWwoZXJyLCB7XG4gICAgbmFtZTogXCJlcnJvcmVkXCJcbiAgfSApO1xuICBFcnJvcnMgfHwgKEVycm9ycyA9IG5ldyBTZXQoKSk7XG4gIEVycm9ycy5hZGQoc2V0RXJyb3JlZCk7XG4gIG9uQ2xlYW51cCgoKSA9PiBFcnJvcnMuZGVsZXRlKHNldEVycm9yZWQpKTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGxldCBlO1xuICAgIGlmIChlID0gZXJyb3JlZCgpKSB7XG4gICAgICBjb25zdCBmID0gcHJvcHMuZmFsbGJhY2s7XG4gICAgICBpZiAoKHR5cGVvZiBmICE9PSBcImZ1bmN0aW9uXCIgfHwgZi5sZW5ndGggPT0gMCkpIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICByZXR1cm4gdHlwZW9mIGYgPT09IFwiZnVuY3Rpb25cIiAmJiBmLmxlbmd0aCA/IHVudHJhY2soKCkgPT4gZihlLCAoKSA9PiBzZXRFcnJvcmVkKCkpKSA6IGY7XG4gICAgfVxuICAgIHJldHVybiBjYXRjaEVycm9yKCgpID0+IHByb3BzLmNoaWxkcmVuLCBzZXRFcnJvcmVkKTtcbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJ2YWx1ZVwiXG4gIH0gKTtcbn1cblxuY29uc3Qgc3VzcGVuc2VMaXN0RXF1YWxzID0gKGEsIGIpID0+IGEuc2hvd0NvbnRlbnQgPT09IGIuc2hvd0NvbnRlbnQgJiYgYS5zaG93RmFsbGJhY2sgPT09IGIuc2hvd0ZhbGxiYWNrO1xuY29uc3QgU3VzcGVuc2VMaXN0Q29udGV4dCA9IC8qICNfX1BVUkVfXyAqL2NyZWF0ZUNvbnRleHQoKTtcbmZ1bmN0aW9uIFN1c3BlbnNlTGlzdChwcm9wcykge1xuICBsZXQgW3dyYXBwZXIsIHNldFdyYXBwZXJdID0gY3JlYXRlU2lnbmFsKCgpID0+ICh7XG4gICAgICBpbkZhbGxiYWNrOiBmYWxzZVxuICAgIH0pKSxcbiAgICBzaG93O1xuICBjb25zdCBsaXN0Q29udGV4dCA9IHVzZUNvbnRleHQoU3VzcGVuc2VMaXN0Q29udGV4dCk7XG4gIGNvbnN0IFtyZWdpc3RyeSwgc2V0UmVnaXN0cnldID0gY3JlYXRlU2lnbmFsKFtdKTtcbiAgaWYgKGxpc3RDb250ZXh0KSB7XG4gICAgc2hvdyA9IGxpc3RDb250ZXh0LnJlZ2lzdGVyKGNyZWF0ZU1lbW8oKCkgPT4gd3JhcHBlcigpKCkuaW5GYWxsYmFjaykpO1xuICB9XG4gIGNvbnN0IHJlc29sdmVkID0gY3JlYXRlTWVtbyhwcmV2ID0+IHtcbiAgICBjb25zdCByZXZlYWwgPSBwcm9wcy5yZXZlYWxPcmRlcixcbiAgICAgIHRhaWwgPSBwcm9wcy50YWlsLFxuICAgICAge1xuICAgICAgICBzaG93Q29udGVudCA9IHRydWUsXG4gICAgICAgIHNob3dGYWxsYmFjayA9IHRydWVcbiAgICAgIH0gPSBzaG93ID8gc2hvdygpIDoge30sXG4gICAgICByZWcgPSByZWdpc3RyeSgpLFxuICAgICAgcmV2ZXJzZSA9IHJldmVhbCA9PT0gXCJiYWNrd2FyZHNcIjtcbiAgICBpZiAocmV2ZWFsID09PSBcInRvZ2V0aGVyXCIpIHtcbiAgICAgIGNvbnN0IGFsbCA9IHJlZy5ldmVyeShpbkZhbGxiYWNrID0+ICFpbkZhbGxiYWNrKCkpO1xuICAgICAgY29uc3QgcmVzID0gcmVnLm1hcCgoKSA9PiAoe1xuICAgICAgICBzaG93Q29udGVudDogYWxsICYmIHNob3dDb250ZW50LFxuICAgICAgICBzaG93RmFsbGJhY2tcbiAgICAgIH0pKTtcbiAgICAgIHJlcy5pbkZhbGxiYWNrID0gIWFsbDtcbiAgICAgIHJldHVybiByZXM7XG4gICAgfVxuICAgIGxldCBzdG9wID0gZmFsc2U7XG4gICAgbGV0IGluRmFsbGJhY2sgPSBwcmV2LmluRmFsbGJhY2s7XG4gICAgY29uc3QgcmVzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHJlZy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgY29uc3QgbiA9IHJldmVyc2UgPyBsZW4gLSBpIC0gMSA6IGksXG4gICAgICAgIHMgPSByZWdbbl0oKTtcbiAgICAgIGlmICghc3RvcCAmJiAhcykge1xuICAgICAgICByZXNbbl0gPSB7XG4gICAgICAgICAgc2hvd0NvbnRlbnQsXG4gICAgICAgICAgc2hvd0ZhbGxiYWNrXG4gICAgICAgIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXh0ID0gIXN0b3A7XG4gICAgICAgIGlmIChuZXh0KSBpbkZhbGxiYWNrID0gdHJ1ZTtcbiAgICAgICAgcmVzW25dID0ge1xuICAgICAgICAgIHNob3dDb250ZW50OiBuZXh0LFxuICAgICAgICAgIHNob3dGYWxsYmFjazogIXRhaWwgfHwgbmV4dCAmJiB0YWlsID09PSBcImNvbGxhcHNlZFwiID8gc2hvd0ZhbGxiYWNrIDogZmFsc2VcbiAgICAgICAgfTtcbiAgICAgICAgc3RvcCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghc3RvcCkgaW5GYWxsYmFjayA9IGZhbHNlO1xuICAgIHJlcy5pbkZhbGxiYWNrID0gaW5GYWxsYmFjaztcbiAgICByZXR1cm4gcmVzO1xuICB9LCB7XG4gICAgaW5GYWxsYmFjazogZmFsc2VcbiAgfSk7XG4gIHNldFdyYXBwZXIoKCkgPT4gcmVzb2x2ZWQpO1xuICByZXR1cm4gY3JlYXRlQ29tcG9uZW50KFN1c3BlbnNlTGlzdENvbnRleHQuUHJvdmlkZXIsIHtcbiAgICB2YWx1ZToge1xuICAgICAgcmVnaXN0ZXI6IGluRmFsbGJhY2sgPT4ge1xuICAgICAgICBsZXQgaW5kZXg7XG4gICAgICAgIHNldFJlZ2lzdHJ5KHJlZ2lzdHJ5ID0+IHtcbiAgICAgICAgICBpbmRleCA9IHJlZ2lzdHJ5Lmxlbmd0aDtcbiAgICAgICAgICByZXR1cm4gWy4uLnJlZ2lzdHJ5LCBpbkZhbGxiYWNrXTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHJlc29sdmVkKClbaW5kZXhdLCB1bmRlZmluZWQsIHtcbiAgICAgICAgICBlcXVhbHM6IHN1c3BlbnNlTGlzdEVxdWFsc1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGdldCBjaGlsZHJlbigpIHtcbiAgICAgIHJldHVybiBwcm9wcy5jaGlsZHJlbjtcbiAgICB9XG4gIH0pO1xufVxuZnVuY3Rpb24gU3VzcGVuc2UocHJvcHMpIHtcbiAgbGV0IGNvdW50ZXIgPSAwLFxuICAgIHNob3csXG4gICAgY3R4LFxuICAgIHAsXG4gICAgZmxpY2tlcixcbiAgICBlcnJvcjtcbiAgY29uc3QgW2luRmFsbGJhY2ssIHNldEZhbGxiYWNrXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSksXG4gICAgU3VzcGVuc2VDb250ZXh0ID0gZ2V0U3VzcGVuc2VDb250ZXh0KCksXG4gICAgc3RvcmUgPSB7XG4gICAgICBpbmNyZW1lbnQ6ICgpID0+IHtcbiAgICAgICAgaWYgKCsrY291bnRlciA9PT0gMSkgc2V0RmFsbGJhY2sodHJ1ZSk7XG4gICAgICB9LFxuICAgICAgZGVjcmVtZW50OiAoKSA9PiB7XG4gICAgICAgIGlmICgtLWNvdW50ZXIgPT09IDApIHNldEZhbGxiYWNrKGZhbHNlKTtcbiAgICAgIH0sXG4gICAgICBpbkZhbGxiYWNrLFxuICAgICAgZWZmZWN0czogW10sXG4gICAgICByZXNvbHZlZDogZmFsc2VcbiAgICB9LFxuICAgIG93bmVyID0gZ2V0T3duZXIoKTtcbiAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0ICYmIHNoYXJlZENvbmZpZy5sb2FkKSB7XG4gICAgY29uc3Qga2V5ID0gc2hhcmVkQ29uZmlnLmdldENvbnRleHRJZCgpO1xuICAgIGxldCByZWYgPSBzaGFyZWRDb25maWcubG9hZChrZXkpO1xuICAgIGlmIChyZWYpIHtcbiAgICAgIGlmICh0eXBlb2YgcmVmICE9PSBcIm9iamVjdFwiIHx8IHJlZi5zICE9PSAxKSBwID0gcmVmO2Vsc2Ugc2hhcmVkQ29uZmlnLmdhdGhlcihrZXkpO1xuICAgIH1cbiAgICBpZiAocCAmJiBwICE9PSBcIiQkZlwiKSB7XG4gICAgICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQsIHtcbiAgICAgICAgZXF1YWxzOiBmYWxzZVxuICAgICAgfSk7XG4gICAgICBmbGlja2VyID0gcztcbiAgICAgIHAudGhlbigoKSA9PiB7XG4gICAgICAgIGlmIChzaGFyZWRDb25maWcuZG9uZSkgcmV0dXJuIHNldCgpO1xuICAgICAgICBzaGFyZWRDb25maWcuZ2F0aGVyKGtleSk7XG4gICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGN0eCk7XG4gICAgICAgIHNldCgpO1xuICAgICAgICBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICAgICAgfSwgZXJyID0+IHtcbiAgICAgICAgZXJyb3IgPSBlcnI7XG4gICAgICAgIHNldCgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGNvbnN0IGxpc3RDb250ZXh0ID0gdXNlQ29udGV4dChTdXNwZW5zZUxpc3RDb250ZXh0KTtcbiAgaWYgKGxpc3RDb250ZXh0KSBzaG93ID0gbGlzdENvbnRleHQucmVnaXN0ZXIoc3RvcmUuaW5GYWxsYmFjayk7XG4gIGxldCBkaXNwb3NlO1xuICBvbkNsZWFudXAoKCkgPT4gZGlzcG9zZSAmJiBkaXNwb3NlKCkpO1xuICByZXR1cm4gY3JlYXRlQ29tcG9uZW50KFN1c3BlbnNlQ29udGV4dC5Qcm92aWRlciwge1xuICAgIHZhbHVlOiBzdG9yZSxcbiAgICBnZXQgY2hpbGRyZW4oKSB7XG4gICAgICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikgdGhyb3cgZXJyb3I7XG4gICAgICAgIGN0eCA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICAgICAgICBpZiAoZmxpY2tlcikge1xuICAgICAgICAgIGZsaWNrZXIoKTtcbiAgICAgICAgICByZXR1cm4gZmxpY2tlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY3R4ICYmIHAgPT09IFwiJCRmXCIpIHNldEh5ZHJhdGVDb250ZXh0KCk7XG4gICAgICAgIGNvbnN0IHJlbmRlcmVkID0gY3JlYXRlTWVtbygoKSA9PiBwcm9wcy5jaGlsZHJlbik7XG4gICAgICAgIHJldHVybiBjcmVhdGVNZW1vKHByZXYgPT4ge1xuICAgICAgICAgIGNvbnN0IGluRmFsbGJhY2sgPSBzdG9yZS5pbkZhbGxiYWNrKCksXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHNob3dDb250ZW50ID0gdHJ1ZSxcbiAgICAgICAgICAgICAgc2hvd0ZhbGxiYWNrID0gdHJ1ZVxuICAgICAgICAgICAgfSA9IHNob3cgPyBzaG93KCkgOiB7fTtcbiAgICAgICAgICBpZiAoKCFpbkZhbGxiYWNrIHx8IHAgJiYgcCAhPT0gXCIkJGZcIikgJiYgc2hvd0NvbnRlbnQpIHtcbiAgICAgICAgICAgIHN0b3JlLnJlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGRpc3Bvc2UgJiYgZGlzcG9zZSgpO1xuICAgICAgICAgICAgZGlzcG9zZSA9IGN0eCA9IHAgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICByZXN1bWVFZmZlY3RzKHN0b3JlLmVmZmVjdHMpO1xuICAgICAgICAgICAgcmV0dXJuIHJlbmRlcmVkKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghc2hvd0ZhbGxiYWNrKSByZXR1cm47XG4gICAgICAgICAgaWYgKGRpc3Bvc2UpIHJldHVybiBwcmV2O1xuICAgICAgICAgIHJldHVybiBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgICAgIGRpc3Bvc2UgPSBkaXNwb3NlcjtcbiAgICAgICAgICAgIGlmIChjdHgpIHtcbiAgICAgICAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoe1xuICAgICAgICAgICAgICAgIGlkOiBjdHguaWQgKyBcIkZcIixcbiAgICAgICAgICAgICAgICBjb3VudDogMFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgY3R4ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHByb3BzLmZhbGxiYWNrO1xuICAgICAgICAgIH0sIG93bmVyKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xufVxuXG5jb25zdCBERVYgPSB7XG4gIGhvb2tzOiBEZXZIb29rcyxcbiAgd3JpdGVTaWduYWwsXG4gIHJlZ2lzdGVyR3JhcGhcbn0gO1xuaWYgKGdsb2JhbFRoaXMpIHtcbiAgaWYgKCFnbG9iYWxUaGlzLlNvbGlkJCQpIGdsb2JhbFRoaXMuU29saWQkJCA9IHRydWU7ZWxzZSBjb25zb2xlLndhcm4oXCJZb3UgYXBwZWFyIHRvIGhhdmUgbXVsdGlwbGUgaW5zdGFuY2VzIG9mIFNvbGlkLiBUaGlzIGNhbiBsZWFkIHRvIHVuZXhwZWN0ZWQgYmVoYXZpb3IuXCIpO1xufVxuXG5leHBvcnQgeyAkREVWQ09NUCwgJFBST1hZLCAkVFJBQ0ssIERFViwgRXJyb3JCb3VuZGFyeSwgRm9yLCBJbmRleCwgTWF0Y2gsIFNob3csIFN1c3BlbnNlLCBTdXNwZW5zZUxpc3QsIFN3aXRjaCwgYmF0Y2gsIGNhbmNlbENhbGxiYWNrLCBjYXRjaEVycm9yLCBjaGlsZHJlbiwgY3JlYXRlQ29tcG9uZW50LCBjcmVhdGVDb21wdXRlZCwgY3JlYXRlQ29udGV4dCwgY3JlYXRlRGVmZXJyZWQsIGNyZWF0ZUVmZmVjdCwgY3JlYXRlTWVtbywgY3JlYXRlUmVhY3Rpb24sIGNyZWF0ZVJlbmRlckVmZmVjdCwgY3JlYXRlUmVzb3VyY2UsIGNyZWF0ZVJvb3QsIGNyZWF0ZVNlbGVjdG9yLCBjcmVhdGVTaWduYWwsIGNyZWF0ZVVuaXF1ZUlkLCBlbmFibGVFeHRlcm5hbFNvdXJjZSwgZW5hYmxlSHlkcmF0aW9uLCBlbmFibGVTY2hlZHVsaW5nLCBlcXVhbEZuLCBmcm9tLCBnZXRMaXN0ZW5lciwgZ2V0T3duZXIsIGluZGV4QXJyYXksIGxhenksIG1hcEFycmF5LCBtZXJnZVByb3BzLCBvYnNlcnZhYmxlLCBvbiwgb25DbGVhbnVwLCBvbkVycm9yLCBvbk1vdW50LCByZXF1ZXN0Q2FsbGJhY2ssIHJlc2V0RXJyb3JCb3VuZGFyaWVzLCBydW5XaXRoT3duZXIsIHNoYXJlZENvbmZpZywgc3BsaXRQcm9wcywgc3RhcnRUcmFuc2l0aW9uLCB1bnRyYWNrLCB1c2VDb250ZXh0LCB1c2VUcmFuc2l0aW9uIH07XG4iLCJpbXBvcnQgeyBjcmVhdGVNZW1vLCBjcmVhdGVSb290LCBjcmVhdGVSZW5kZXJFZmZlY3QsIHVudHJhY2ssIHNoYXJlZENvbmZpZywgZW5hYmxlSHlkcmF0aW9uLCBnZXRPd25lciwgY3JlYXRlRWZmZWN0LCBydW5XaXRoT3duZXIsIGNyZWF0ZVNpZ25hbCwgb25DbGVhbnVwLCAkREVWQ09NUCwgc3BsaXRQcm9wcyB9IGZyb20gJ3NvbGlkLWpzJztcbmV4cG9ydCB7IEVycm9yQm91bmRhcnksIEZvciwgSW5kZXgsIE1hdGNoLCBTaG93LCBTdXNwZW5zZSwgU3VzcGVuc2VMaXN0LCBTd2l0Y2gsIGNyZWF0ZUNvbXBvbmVudCwgY3JlYXRlUmVuZGVyRWZmZWN0IGFzIGVmZmVjdCwgZ2V0T3duZXIsIG1lcmdlUHJvcHMsIHVudHJhY2sgfSBmcm9tICdzb2xpZC1qcyc7XG5cbmNvbnN0IGJvb2xlYW5zID0gW1wiYWxsb3dmdWxsc2NyZWVuXCIsIFwiYXN5bmNcIiwgXCJhdXRvZm9jdXNcIiwgXCJhdXRvcGxheVwiLCBcImNoZWNrZWRcIiwgXCJjb250cm9sc1wiLCBcImRlZmF1bHRcIiwgXCJkaXNhYmxlZFwiLCBcImZvcm1ub3ZhbGlkYXRlXCIsIFwiaGlkZGVuXCIsIFwiaW5kZXRlcm1pbmF0ZVwiLCBcImluZXJ0XCIsIFwiaXNtYXBcIiwgXCJsb29wXCIsIFwibXVsdGlwbGVcIiwgXCJtdXRlZFwiLCBcIm5vbW9kdWxlXCIsIFwibm92YWxpZGF0ZVwiLCBcIm9wZW5cIiwgXCJwbGF5c2lubGluZVwiLCBcInJlYWRvbmx5XCIsIFwicmVxdWlyZWRcIiwgXCJyZXZlcnNlZFwiLCBcInNlYW1sZXNzXCIsIFwic2VsZWN0ZWRcIl07XG5jb25zdCBQcm9wZXJ0aWVzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1wiY2xhc3NOYW1lXCIsIFwidmFsdWVcIiwgXCJyZWFkT25seVwiLCBcIm5vVmFsaWRhdGVcIiwgXCJmb3JtTm9WYWxpZGF0ZVwiLCBcImlzTWFwXCIsIFwibm9Nb2R1bGVcIiwgXCJwbGF5c0lubGluZVwiLCAuLi5ib29sZWFuc10pO1xuY29uc3QgQ2hpbGRQcm9wZXJ0aWVzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1wiaW5uZXJIVE1MXCIsIFwidGV4dENvbnRlbnRcIiwgXCJpbm5lclRleHRcIiwgXCJjaGlsZHJlblwiXSk7XG5jb25zdCBBbGlhc2VzID0gLyojX19QVVJFX18qL09iamVjdC5hc3NpZ24oT2JqZWN0LmNyZWF0ZShudWxsKSwge1xuICBjbGFzc05hbWU6IFwiY2xhc3NcIixcbiAgaHRtbEZvcjogXCJmb3JcIlxufSk7XG5jb25zdCBQcm9wQWxpYXNlcyA9IC8qI19fUFVSRV9fKi9PYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUobnVsbCksIHtcbiAgY2xhc3M6IFwiY2xhc3NOYW1lXCIsXG4gIG5vdmFsaWRhdGU6IHtcbiAgICAkOiBcIm5vVmFsaWRhdGVcIixcbiAgICBGT1JNOiAxXG4gIH0sXG4gIGZvcm1ub3ZhbGlkYXRlOiB7XG4gICAgJDogXCJmb3JtTm9WYWxpZGF0ZVwiLFxuICAgIEJVVFRPTjogMSxcbiAgICBJTlBVVDogMVxuICB9LFxuICBpc21hcDoge1xuICAgICQ6IFwiaXNNYXBcIixcbiAgICBJTUc6IDFcbiAgfSxcbiAgbm9tb2R1bGU6IHtcbiAgICAkOiBcIm5vTW9kdWxlXCIsXG4gICAgU0NSSVBUOiAxXG4gIH0sXG4gIHBsYXlzaW5saW5lOiB7XG4gICAgJDogXCJwbGF5c0lubGluZVwiLFxuICAgIFZJREVPOiAxXG4gIH0sXG4gIHJlYWRvbmx5OiB7XG4gICAgJDogXCJyZWFkT25seVwiLFxuICAgIElOUFVUOiAxLFxuICAgIFRFWFRBUkVBOiAxXG4gIH1cbn0pO1xuZnVuY3Rpb24gZ2V0UHJvcEFsaWFzKHByb3AsIHRhZ05hbWUpIHtcbiAgY29uc3QgYSA9IFByb3BBbGlhc2VzW3Byb3BdO1xuICByZXR1cm4gdHlwZW9mIGEgPT09IFwib2JqZWN0XCIgPyBhW3RhZ05hbWVdID8gYVtcIiRcIl0gOiB1bmRlZmluZWQgOiBhO1xufVxuY29uc3QgRGVsZWdhdGVkRXZlbnRzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1wiYmVmb3JlaW5wdXRcIiwgXCJjbGlja1wiLCBcImRibGNsaWNrXCIsIFwiY29udGV4dG1lbnVcIiwgXCJmb2N1c2luXCIsIFwiZm9jdXNvdXRcIiwgXCJpbnB1dFwiLCBcImtleWRvd25cIiwgXCJrZXl1cFwiLCBcIm1vdXNlZG93blwiLCBcIm1vdXNlbW92ZVwiLCBcIm1vdXNlb3V0XCIsIFwibW91c2VvdmVyXCIsIFwibW91c2V1cFwiLCBcInBvaW50ZXJkb3duXCIsIFwicG9pbnRlcm1vdmVcIiwgXCJwb2ludGVyb3V0XCIsIFwicG9pbnRlcm92ZXJcIiwgXCJwb2ludGVydXBcIiwgXCJ0b3VjaGVuZFwiLCBcInRvdWNobW92ZVwiLCBcInRvdWNoc3RhcnRcIl0pO1xuY29uc3QgU1ZHRWxlbWVudHMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXG5cImFsdEdseXBoXCIsIFwiYWx0R2x5cGhEZWZcIiwgXCJhbHRHbHlwaEl0ZW1cIiwgXCJhbmltYXRlXCIsIFwiYW5pbWF0ZUNvbG9yXCIsIFwiYW5pbWF0ZU1vdGlvblwiLCBcImFuaW1hdGVUcmFuc2Zvcm1cIiwgXCJjaXJjbGVcIiwgXCJjbGlwUGF0aFwiLCBcImNvbG9yLXByb2ZpbGVcIiwgXCJjdXJzb3JcIiwgXCJkZWZzXCIsIFwiZGVzY1wiLCBcImVsbGlwc2VcIiwgXCJmZUJsZW5kXCIsIFwiZmVDb2xvck1hdHJpeFwiLCBcImZlQ29tcG9uZW50VHJhbnNmZXJcIiwgXCJmZUNvbXBvc2l0ZVwiLCBcImZlQ29udm9sdmVNYXRyaXhcIiwgXCJmZURpZmZ1c2VMaWdodGluZ1wiLCBcImZlRGlzcGxhY2VtZW50TWFwXCIsIFwiZmVEaXN0YW50TGlnaHRcIiwgXCJmZURyb3BTaGFkb3dcIiwgXCJmZUZsb29kXCIsIFwiZmVGdW5jQVwiLCBcImZlRnVuY0JcIiwgXCJmZUZ1bmNHXCIsIFwiZmVGdW5jUlwiLCBcImZlR2F1c3NpYW5CbHVyXCIsIFwiZmVJbWFnZVwiLCBcImZlTWVyZ2VcIiwgXCJmZU1lcmdlTm9kZVwiLCBcImZlTW9ycGhvbG9neVwiLCBcImZlT2Zmc2V0XCIsIFwiZmVQb2ludExpZ2h0XCIsIFwiZmVTcGVjdWxhckxpZ2h0aW5nXCIsIFwiZmVTcG90TGlnaHRcIiwgXCJmZVRpbGVcIiwgXCJmZVR1cmJ1bGVuY2VcIiwgXCJmaWx0ZXJcIiwgXCJmb250XCIsIFwiZm9udC1mYWNlXCIsIFwiZm9udC1mYWNlLWZvcm1hdFwiLCBcImZvbnQtZmFjZS1uYW1lXCIsIFwiZm9udC1mYWNlLXNyY1wiLCBcImZvbnQtZmFjZS11cmlcIiwgXCJmb3JlaWduT2JqZWN0XCIsIFwiZ1wiLCBcImdseXBoXCIsIFwiZ2x5cGhSZWZcIiwgXCJoa2VyblwiLCBcImltYWdlXCIsIFwibGluZVwiLCBcImxpbmVhckdyYWRpZW50XCIsIFwibWFya2VyXCIsIFwibWFza1wiLCBcIm1ldGFkYXRhXCIsIFwibWlzc2luZy1nbHlwaFwiLCBcIm1wYXRoXCIsIFwicGF0aFwiLCBcInBhdHRlcm5cIiwgXCJwb2x5Z29uXCIsIFwicG9seWxpbmVcIiwgXCJyYWRpYWxHcmFkaWVudFwiLCBcInJlY3RcIixcblwic2V0XCIsIFwic3RvcFwiLFxuXCJzdmdcIiwgXCJzd2l0Y2hcIiwgXCJzeW1ib2xcIiwgXCJ0ZXh0XCIsIFwidGV4dFBhdGhcIixcblwidHJlZlwiLCBcInRzcGFuXCIsIFwidXNlXCIsIFwidmlld1wiLCBcInZrZXJuXCJdKTtcbmNvbnN0IFNWR05hbWVzcGFjZSA9IHtcbiAgeGxpbms6IFwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiLFxuICB4bWw6IFwiaHR0cDovL3d3dy53My5vcmcvWE1MLzE5OTgvbmFtZXNwYWNlXCJcbn07XG5jb25zdCBET01FbGVtZW50cyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImh0bWxcIiwgXCJiYXNlXCIsIFwiaGVhZFwiLCBcImxpbmtcIiwgXCJtZXRhXCIsIFwic3R5bGVcIiwgXCJ0aXRsZVwiLCBcImJvZHlcIiwgXCJhZGRyZXNzXCIsIFwiYXJ0aWNsZVwiLCBcImFzaWRlXCIsIFwiZm9vdGVyXCIsIFwiaGVhZGVyXCIsIFwibWFpblwiLCBcIm5hdlwiLCBcInNlY3Rpb25cIiwgXCJib2R5XCIsIFwiYmxvY2txdW90ZVwiLCBcImRkXCIsIFwiZGl2XCIsIFwiZGxcIiwgXCJkdFwiLCBcImZpZ2NhcHRpb25cIiwgXCJmaWd1cmVcIiwgXCJoclwiLCBcImxpXCIsIFwib2xcIiwgXCJwXCIsIFwicHJlXCIsIFwidWxcIiwgXCJhXCIsIFwiYWJiclwiLCBcImJcIiwgXCJiZGlcIiwgXCJiZG9cIiwgXCJiclwiLCBcImNpdGVcIiwgXCJjb2RlXCIsIFwiZGF0YVwiLCBcImRmblwiLCBcImVtXCIsIFwiaVwiLCBcImtiZFwiLCBcIm1hcmtcIiwgXCJxXCIsIFwicnBcIiwgXCJydFwiLCBcInJ1YnlcIiwgXCJzXCIsIFwic2FtcFwiLCBcInNtYWxsXCIsIFwic3BhblwiLCBcInN0cm9uZ1wiLCBcInN1YlwiLCBcInN1cFwiLCBcInRpbWVcIiwgXCJ1XCIsIFwidmFyXCIsIFwid2JyXCIsIFwiYXJlYVwiLCBcImF1ZGlvXCIsIFwiaW1nXCIsIFwibWFwXCIsIFwidHJhY2tcIiwgXCJ2aWRlb1wiLCBcImVtYmVkXCIsIFwiaWZyYW1lXCIsIFwib2JqZWN0XCIsIFwicGFyYW1cIiwgXCJwaWN0dXJlXCIsIFwicG9ydGFsXCIsIFwic291cmNlXCIsIFwic3ZnXCIsIFwibWF0aFwiLCBcImNhbnZhc1wiLCBcIm5vc2NyaXB0XCIsIFwic2NyaXB0XCIsIFwiZGVsXCIsIFwiaW5zXCIsIFwiY2FwdGlvblwiLCBcImNvbFwiLCBcImNvbGdyb3VwXCIsIFwidGFibGVcIiwgXCJ0Ym9keVwiLCBcInRkXCIsIFwidGZvb3RcIiwgXCJ0aFwiLCBcInRoZWFkXCIsIFwidHJcIiwgXCJidXR0b25cIiwgXCJkYXRhbGlzdFwiLCBcImZpZWxkc2V0XCIsIFwiZm9ybVwiLCBcImlucHV0XCIsIFwibGFiZWxcIiwgXCJsZWdlbmRcIiwgXCJtZXRlclwiLCBcIm9wdGdyb3VwXCIsIFwib3B0aW9uXCIsIFwib3V0cHV0XCIsIFwicHJvZ3Jlc3NcIiwgXCJzZWxlY3RcIiwgXCJ0ZXh0YXJlYVwiLCBcImRldGFpbHNcIiwgXCJkaWFsb2dcIiwgXCJtZW51XCIsIFwic3VtbWFyeVwiLCBcImRldGFpbHNcIiwgXCJzbG90XCIsIFwidGVtcGxhdGVcIiwgXCJhY3JvbnltXCIsIFwiYXBwbGV0XCIsIFwiYmFzZWZvbnRcIiwgXCJiZ3NvdW5kXCIsIFwiYmlnXCIsIFwiYmxpbmtcIiwgXCJjZW50ZXJcIiwgXCJjb250ZW50XCIsIFwiZGlyXCIsIFwiZm9udFwiLCBcImZyYW1lXCIsIFwiZnJhbWVzZXRcIiwgXCJoZ3JvdXBcIiwgXCJpbWFnZVwiLCBcImtleWdlblwiLCBcIm1hcnF1ZWVcIiwgXCJtZW51aXRlbVwiLCBcIm5vYnJcIiwgXCJub2VtYmVkXCIsIFwibm9mcmFtZXNcIiwgXCJwbGFpbnRleHRcIiwgXCJyYlwiLCBcInJ0Y1wiLCBcInNoYWRvd1wiLCBcInNwYWNlclwiLCBcInN0cmlrZVwiLCBcInR0XCIsIFwieG1wXCIsIFwiYVwiLCBcImFiYnJcIiwgXCJhY3JvbnltXCIsIFwiYWRkcmVzc1wiLCBcImFwcGxldFwiLCBcImFyZWFcIiwgXCJhcnRpY2xlXCIsIFwiYXNpZGVcIiwgXCJhdWRpb1wiLCBcImJcIiwgXCJiYXNlXCIsIFwiYmFzZWZvbnRcIiwgXCJiZGlcIiwgXCJiZG9cIiwgXCJiZ3NvdW5kXCIsIFwiYmlnXCIsIFwiYmxpbmtcIiwgXCJibG9ja3F1b3RlXCIsIFwiYm9keVwiLCBcImJyXCIsIFwiYnV0dG9uXCIsIFwiY2FudmFzXCIsIFwiY2FwdGlvblwiLCBcImNlbnRlclwiLCBcImNpdGVcIiwgXCJjb2RlXCIsIFwiY29sXCIsIFwiY29sZ3JvdXBcIiwgXCJjb250ZW50XCIsIFwiZGF0YVwiLCBcImRhdGFsaXN0XCIsIFwiZGRcIiwgXCJkZWxcIiwgXCJkZXRhaWxzXCIsIFwiZGZuXCIsIFwiZGlhbG9nXCIsIFwiZGlyXCIsIFwiZGl2XCIsIFwiZGxcIiwgXCJkdFwiLCBcImVtXCIsIFwiZW1iZWRcIiwgXCJmaWVsZHNldFwiLCBcImZpZ2NhcHRpb25cIiwgXCJmaWd1cmVcIiwgXCJmb250XCIsIFwiZm9vdGVyXCIsIFwiZm9ybVwiLCBcImZyYW1lXCIsIFwiZnJhbWVzZXRcIiwgXCJoZWFkXCIsIFwiaGVhZGVyXCIsIFwiaGdyb3VwXCIsIFwiaHJcIiwgXCJodG1sXCIsIFwiaVwiLCBcImlmcmFtZVwiLCBcImltYWdlXCIsIFwiaW1nXCIsIFwiaW5wdXRcIiwgXCJpbnNcIiwgXCJrYmRcIiwgXCJrZXlnZW5cIiwgXCJsYWJlbFwiLCBcImxlZ2VuZFwiLCBcImxpXCIsIFwibGlua1wiLCBcIm1haW5cIiwgXCJtYXBcIiwgXCJtYXJrXCIsIFwibWFycXVlZVwiLCBcIm1lbnVcIiwgXCJtZW51aXRlbVwiLCBcIm1ldGFcIiwgXCJtZXRlclwiLCBcIm5hdlwiLCBcIm5vYnJcIiwgXCJub2VtYmVkXCIsIFwibm9mcmFtZXNcIiwgXCJub3NjcmlwdFwiLCBcIm9iamVjdFwiLCBcIm9sXCIsIFwib3B0Z3JvdXBcIiwgXCJvcHRpb25cIiwgXCJvdXRwdXRcIiwgXCJwXCIsIFwicGFyYW1cIiwgXCJwaWN0dXJlXCIsIFwicGxhaW50ZXh0XCIsIFwicG9ydGFsXCIsIFwicHJlXCIsIFwicHJvZ3Jlc3NcIiwgXCJxXCIsIFwicmJcIiwgXCJycFwiLCBcInJ0XCIsIFwicnRjXCIsIFwicnVieVwiLCBcInNcIiwgXCJzYW1wXCIsIFwic2NyaXB0XCIsIFwic2VjdGlvblwiLCBcInNlbGVjdFwiLCBcInNoYWRvd1wiLCBcInNsb3RcIiwgXCJzbWFsbFwiLCBcInNvdXJjZVwiLCBcInNwYWNlclwiLCBcInNwYW5cIiwgXCJzdHJpa2VcIiwgXCJzdHJvbmdcIiwgXCJzdHlsZVwiLCBcInN1YlwiLCBcInN1bW1hcnlcIiwgXCJzdXBcIiwgXCJ0YWJsZVwiLCBcInRib2R5XCIsIFwidGRcIiwgXCJ0ZW1wbGF0ZVwiLCBcInRleHRhcmVhXCIsIFwidGZvb3RcIiwgXCJ0aFwiLCBcInRoZWFkXCIsIFwidGltZVwiLCBcInRpdGxlXCIsIFwidHJcIiwgXCJ0cmFja1wiLCBcInR0XCIsIFwidVwiLCBcInVsXCIsIFwidmFyXCIsIFwidmlkZW9cIiwgXCJ3YnJcIiwgXCJ4bXBcIiwgXCJpbnB1dFwiLCBcImgxXCIsIFwiaDJcIiwgXCJoM1wiLCBcImg0XCIsIFwiaDVcIiwgXCJoNlwiXSk7XG5cbmNvbnN0IG1lbW8gPSBmbiA9PiBjcmVhdGVNZW1vKCgpID0+IGZuKCkpO1xuXG5mdW5jdGlvbiByZWNvbmNpbGVBcnJheXMocGFyZW50Tm9kZSwgYSwgYikge1xuICBsZXQgYkxlbmd0aCA9IGIubGVuZ3RoLFxuICAgIGFFbmQgPSBhLmxlbmd0aCxcbiAgICBiRW5kID0gYkxlbmd0aCxcbiAgICBhU3RhcnQgPSAwLFxuICAgIGJTdGFydCA9IDAsXG4gICAgYWZ0ZXIgPSBhW2FFbmQgLSAxXS5uZXh0U2libGluZyxcbiAgICBtYXAgPSBudWxsO1xuICB3aGlsZSAoYVN0YXJ0IDwgYUVuZCB8fCBiU3RhcnQgPCBiRW5kKSB7XG4gICAgaWYgKGFbYVN0YXJ0XSA9PT0gYltiU3RhcnRdKSB7XG4gICAgICBhU3RhcnQrKztcbiAgICAgIGJTdGFydCsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHdoaWxlIChhW2FFbmQgLSAxXSA9PT0gYltiRW5kIC0gMV0pIHtcbiAgICAgIGFFbmQtLTtcbiAgICAgIGJFbmQtLTtcbiAgICB9XG4gICAgaWYgKGFFbmQgPT09IGFTdGFydCkge1xuICAgICAgY29uc3Qgbm9kZSA9IGJFbmQgPCBiTGVuZ3RoID8gYlN0YXJ0ID8gYltiU3RhcnQgLSAxXS5uZXh0U2libGluZyA6IGJbYkVuZCAtIGJTdGFydF0gOiBhZnRlcjtcbiAgICAgIHdoaWxlIChiU3RhcnQgPCBiRW5kKSBwYXJlbnROb2RlLmluc2VydEJlZm9yZShiW2JTdGFydCsrXSwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChiRW5kID09PSBiU3RhcnQpIHtcbiAgICAgIHdoaWxlIChhU3RhcnQgPCBhRW5kKSB7XG4gICAgICAgIGlmICghbWFwIHx8ICFtYXAuaGFzKGFbYVN0YXJ0XSkpIGFbYVN0YXJ0XS5yZW1vdmUoKTtcbiAgICAgICAgYVN0YXJ0Kys7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChhW2FTdGFydF0gPT09IGJbYkVuZCAtIDFdICYmIGJbYlN0YXJ0XSA9PT0gYVthRW5kIC0gMV0pIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBhWy0tYUVuZF0ubmV4dFNpYmxpbmc7XG4gICAgICBwYXJlbnROb2RlLmluc2VydEJlZm9yZShiW2JTdGFydCsrXSwgYVthU3RhcnQrK10ubmV4dFNpYmxpbmcpO1xuICAgICAgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYlstLWJFbmRdLCBub2RlKTtcbiAgICAgIGFbYUVuZF0gPSBiW2JFbmRdO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIW1hcCkge1xuICAgICAgICBtYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgIGxldCBpID0gYlN0YXJ0O1xuICAgICAgICB3aGlsZSAoaSA8IGJFbmQpIG1hcC5zZXQoYltpXSwgaSsrKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGluZGV4ID0gbWFwLmdldChhW2FTdGFydF0pO1xuICAgICAgaWYgKGluZGV4ICE9IG51bGwpIHtcbiAgICAgICAgaWYgKGJTdGFydCA8IGluZGV4ICYmIGluZGV4IDwgYkVuZCkge1xuICAgICAgICAgIGxldCBpID0gYVN0YXJ0LFxuICAgICAgICAgICAgc2VxdWVuY2UgPSAxLFxuICAgICAgICAgICAgdDtcbiAgICAgICAgICB3aGlsZSAoKytpIDwgYUVuZCAmJiBpIDwgYkVuZCkge1xuICAgICAgICAgICAgaWYgKCh0ID0gbWFwLmdldChhW2ldKSkgPT0gbnVsbCB8fCB0ICE9PSBpbmRleCArIHNlcXVlbmNlKSBicmVhaztcbiAgICAgICAgICAgIHNlcXVlbmNlKys7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzZXF1ZW5jZSA+IGluZGV4IC0gYlN0YXJ0KSB7XG4gICAgICAgICAgICBjb25zdCBub2RlID0gYVthU3RhcnRdO1xuICAgICAgICAgICAgd2hpbGUgKGJTdGFydCA8IGluZGV4KSBwYXJlbnROb2RlLmluc2VydEJlZm9yZShiW2JTdGFydCsrXSwgbm9kZSk7XG4gICAgICAgICAgfSBlbHNlIHBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGJbYlN0YXJ0KytdLCBhW2FTdGFydCsrXSk7XG4gICAgICAgIH0gZWxzZSBhU3RhcnQrKztcbiAgICAgIH0gZWxzZSBhW2FTdGFydCsrXS5yZW1vdmUoKTtcbiAgICB9XG4gIH1cbn1cblxuY29uc3QgJCRFVkVOVFMgPSBcIl8kRFhfREVMRUdBVEVcIjtcbmZ1bmN0aW9uIHJlbmRlcihjb2RlLCBlbGVtZW50LCBpbml0LCBvcHRpb25zID0ge30pIHtcbiAgaWYgKCFlbGVtZW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGBlbGVtZW50YCBwYXNzZWQgdG8gYHJlbmRlciguLi4sIGVsZW1lbnQpYCBkb2Vzbid0IGV4aXN0LiBNYWtlIHN1cmUgYGVsZW1lbnRgIGV4aXN0cyBpbiB0aGUgZG9jdW1lbnQuXCIpO1xuICB9XG4gIGxldCBkaXNwb3NlcjtcbiAgY3JlYXRlUm9vdChkaXNwb3NlID0+IHtcbiAgICBkaXNwb3NlciA9IGRpc3Bvc2U7XG4gICAgZWxlbWVudCA9PT0gZG9jdW1lbnQgPyBjb2RlKCkgOiBpbnNlcnQoZWxlbWVudCwgY29kZSgpLCBlbGVtZW50LmZpcnN0Q2hpbGQgPyBudWxsIDogdW5kZWZpbmVkLCBpbml0KTtcbiAgfSwgb3B0aW9ucy5vd25lcik7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgZGlzcG9zZXIoKTtcbiAgICBlbGVtZW50LnRleHRDb250ZW50ID0gXCJcIjtcbiAgfTtcbn1cbmZ1bmN0aW9uIHRlbXBsYXRlKGh0bWwsIGlzSW1wb3J0Tm9kZSwgaXNTVkcsIGlzTWF0aE1MKSB7XG4gIGxldCBub2RlO1xuICBjb25zdCBjcmVhdGUgPSAoKSA9PiB7XG4gICAgaWYgKGlzSHlkcmF0aW5nKCkpIHRocm93IG5ldyBFcnJvcihcIkZhaWxlZCBhdHRlbXB0IHRvIGNyZWF0ZSBuZXcgRE9NIGVsZW1lbnRzIGR1cmluZyBoeWRyYXRpb24uIENoZWNrIHRoYXQgdGhlIGxpYnJhcmllcyB5b3UgYXJlIHVzaW5nIHN1cHBvcnQgaHlkcmF0aW9uLlwiKTtcbiAgICBjb25zdCB0ID0gaXNNYXRoTUwgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8xOTk4L01hdGgvTWF0aE1MXCIsIFwidGVtcGxhdGVcIikgOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIik7XG4gICAgdC5pbm5lckhUTUwgPSBodG1sO1xuICAgIHJldHVybiBpc1NWRyA/IHQuY29udGVudC5maXJzdENoaWxkLmZpcnN0Q2hpbGQgOiBpc01hdGhNTCA/IHQuZmlyc3RDaGlsZCA6IHQuY29udGVudC5maXJzdENoaWxkO1xuICB9O1xuICBjb25zdCBmbiA9IGlzSW1wb3J0Tm9kZSA/ICgpID0+IHVudHJhY2soKCkgPT4gZG9jdW1lbnQuaW1wb3J0Tm9kZShub2RlIHx8IChub2RlID0gY3JlYXRlKCkpLCB0cnVlKSkgOiAoKSA9PiAobm9kZSB8fCAobm9kZSA9IGNyZWF0ZSgpKSkuY2xvbmVOb2RlKHRydWUpO1xuICBmbi5jbG9uZU5vZGUgPSBmbjtcbiAgcmV0dXJuIGZuO1xufVxuZnVuY3Rpb24gZGVsZWdhdGVFdmVudHMoZXZlbnROYW1lcywgZG9jdW1lbnQgPSB3aW5kb3cuZG9jdW1lbnQpIHtcbiAgY29uc3QgZSA9IGRvY3VtZW50WyQkRVZFTlRTXSB8fCAoZG9jdW1lbnRbJCRFVkVOVFNdID0gbmV3IFNldCgpKTtcbiAgZm9yIChsZXQgaSA9IDAsIGwgPSBldmVudE5hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGNvbnN0IG5hbWUgPSBldmVudE5hbWVzW2ldO1xuICAgIGlmICghZS5oYXMobmFtZSkpIHtcbiAgICAgIGUuYWRkKG5hbWUpO1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBldmVudEhhbmRsZXIpO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gY2xlYXJEZWxlZ2F0ZWRFdmVudHMoZG9jdW1lbnQgPSB3aW5kb3cuZG9jdW1lbnQpIHtcbiAgaWYgKGRvY3VtZW50WyQkRVZFTlRTXSkge1xuICAgIGZvciAobGV0IG5hbWUgb2YgZG9jdW1lbnRbJCRFVkVOVFNdLmtleXMoKSkgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBldmVudEhhbmRsZXIpO1xuICAgIGRlbGV0ZSBkb2N1bWVudFskJEVWRU5UU107XG4gIH1cbn1cbmZ1bmN0aW9uIHNldFByb3BlcnR5KG5vZGUsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBub2RlW25hbWVdID0gdmFsdWU7XG59XG5mdW5jdGlvbiBzZXRBdHRyaWJ1dGUobm9kZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIGlmICh2YWx1ZSA9PSBudWxsKSBub2RlLnJlbW92ZUF0dHJpYnV0ZShuYW1lKTtlbHNlIG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIHNldEF0dHJpYnV0ZU5TKG5vZGUsIG5hbWVzcGFjZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIGlmICh2YWx1ZSA9PSBudWxsKSBub2RlLnJlbW92ZUF0dHJpYnV0ZU5TKG5hbWVzcGFjZSwgbmFtZSk7ZWxzZSBub2RlLnNldEF0dHJpYnV0ZU5TKG5hbWVzcGFjZSwgbmFtZSwgdmFsdWUpO1xufVxuZnVuY3Rpb24gc2V0Qm9vbEF0dHJpYnV0ZShub2RlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgdmFsdWUgPyBub2RlLnNldEF0dHJpYnV0ZShuYW1lLCBcIlwiKSA6IG5vZGUucmVtb3ZlQXR0cmlidXRlKG5hbWUpO1xufVxuZnVuY3Rpb24gY2xhc3NOYW1lKG5vZGUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBpZiAodmFsdWUgPT0gbnVsbCkgbm9kZS5yZW1vdmVBdHRyaWJ1dGUoXCJjbGFzc1wiKTtlbHNlIG5vZGUuY2xhc3NOYW1lID0gdmFsdWU7XG59XG5mdW5jdGlvbiBhZGRFdmVudExpc3RlbmVyKG5vZGUsIG5hbWUsIGhhbmRsZXIsIGRlbGVnYXRlKSB7XG4gIGlmIChkZWxlZ2F0ZSkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KGhhbmRsZXIpKSB7XG4gICAgICBub2RlW2AkJCR7bmFtZX1gXSA9IGhhbmRsZXJbMF07XG4gICAgICBub2RlW2AkJCR7bmFtZX1EYXRhYF0gPSBoYW5kbGVyWzFdO1xuICAgIH0gZWxzZSBub2RlW2AkJCR7bmFtZX1gXSA9IGhhbmRsZXI7XG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShoYW5kbGVyKSkge1xuICAgIGNvbnN0IGhhbmRsZXJGbiA9IGhhbmRsZXJbMF07XG4gICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGhhbmRsZXJbMF0gPSBlID0+IGhhbmRsZXJGbi5jYWxsKG5vZGUsIGhhbmRsZXJbMV0sIGUpKTtcbiAgfSBlbHNlIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBoYW5kbGVyLCB0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiICYmIGhhbmRsZXIpO1xufVxuZnVuY3Rpb24gY2xhc3NMaXN0KG5vZGUsIHZhbHVlLCBwcmV2ID0ge30pIHtcbiAgY29uc3QgY2xhc3NLZXlzID0gT2JqZWN0LmtleXModmFsdWUgfHwge30pLFxuICAgIHByZXZLZXlzID0gT2JqZWN0LmtleXMocHJldik7XG4gIGxldCBpLCBsZW47XG4gIGZvciAoaSA9IDAsIGxlbiA9IHByZXZLZXlzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgY29uc3Qga2V5ID0gcHJldktleXNbaV07XG4gICAgaWYgKCFrZXkgfHwga2V5ID09PSBcInVuZGVmaW5lZFwiIHx8IHZhbHVlW2tleV0pIGNvbnRpbnVlO1xuICAgIHRvZ2dsZUNsYXNzS2V5KG5vZGUsIGtleSwgZmFsc2UpO1xuICAgIGRlbGV0ZSBwcmV2W2tleV07XG4gIH1cbiAgZm9yIChpID0gMCwgbGVuID0gY2xhc3NLZXlzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgY29uc3Qga2V5ID0gY2xhc3NLZXlzW2ldLFxuICAgICAgY2xhc3NWYWx1ZSA9ICEhdmFsdWVba2V5XTtcbiAgICBpZiAoIWtleSB8fCBrZXkgPT09IFwidW5kZWZpbmVkXCIgfHwgcHJldltrZXldID09PSBjbGFzc1ZhbHVlIHx8ICFjbGFzc1ZhbHVlKSBjb250aW51ZTtcbiAgICB0b2dnbGVDbGFzc0tleShub2RlLCBrZXksIHRydWUpO1xuICAgIHByZXZba2V5XSA9IGNsYXNzVmFsdWU7XG4gIH1cbiAgcmV0dXJuIHByZXY7XG59XG5mdW5jdGlvbiBzdHlsZShub2RlLCB2YWx1ZSwgcHJldikge1xuICBpZiAoIXZhbHVlKSByZXR1cm4gcHJldiA/IHNldEF0dHJpYnV0ZShub2RlLCBcInN0eWxlXCIpIDogdmFsdWU7XG4gIGNvbnN0IG5vZGVTdHlsZSA9IG5vZGUuc3R5bGU7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHJldHVybiBub2RlU3R5bGUuY3NzVGV4dCA9IHZhbHVlO1xuICB0eXBlb2YgcHJldiA9PT0gXCJzdHJpbmdcIiAmJiAobm9kZVN0eWxlLmNzc1RleHQgPSBwcmV2ID0gdW5kZWZpbmVkKTtcbiAgcHJldiB8fCAocHJldiA9IHt9KTtcbiAgdmFsdWUgfHwgKHZhbHVlID0ge30pO1xuICBsZXQgdiwgcztcbiAgZm9yIChzIGluIHByZXYpIHtcbiAgICB2YWx1ZVtzXSA9PSBudWxsICYmIG5vZGVTdHlsZS5yZW1vdmVQcm9wZXJ0eShzKTtcbiAgICBkZWxldGUgcHJldltzXTtcbiAgfVxuICBmb3IgKHMgaW4gdmFsdWUpIHtcbiAgICB2ID0gdmFsdWVbc107XG4gICAgaWYgKHYgIT09IHByZXZbc10pIHtcbiAgICAgIG5vZGVTdHlsZS5zZXRQcm9wZXJ0eShzLCB2KTtcbiAgICAgIHByZXZbc10gPSB2O1xuICAgIH1cbiAgfVxuICByZXR1cm4gcHJldjtcbn1cbmZ1bmN0aW9uIHNwcmVhZChub2RlLCBwcm9wcyA9IHt9LCBpc1NWRywgc2tpcENoaWxkcmVuKSB7XG4gIGNvbnN0IHByZXZQcm9wcyA9IHt9O1xuICBpZiAoIXNraXBDaGlsZHJlbikge1xuICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiBwcmV2UHJvcHMuY2hpbGRyZW4gPSBpbnNlcnRFeHByZXNzaW9uKG5vZGUsIHByb3BzLmNoaWxkcmVuLCBwcmV2UHJvcHMuY2hpbGRyZW4pKTtcbiAgfVxuICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gdHlwZW9mIHByb3BzLnJlZiA9PT0gXCJmdW5jdGlvblwiICYmIHVzZShwcm9wcy5yZWYsIG5vZGUpKTtcbiAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IGFzc2lnbihub2RlLCBwcm9wcywgaXNTVkcsIHRydWUsIHByZXZQcm9wcywgdHJ1ZSkpO1xuICByZXR1cm4gcHJldlByb3BzO1xufVxuZnVuY3Rpb24gZHluYW1pY1Byb3BlcnR5KHByb3BzLCBrZXkpIHtcbiAgY29uc3Qgc3JjID0gcHJvcHNba2V5XTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3BzLCBrZXksIHtcbiAgICBnZXQoKSB7XG4gICAgICByZXR1cm4gc3JjKCk7XG4gICAgfSxcbiAgICBlbnVtZXJhYmxlOiB0cnVlXG4gIH0pO1xuICByZXR1cm4gcHJvcHM7XG59XG5mdW5jdGlvbiB1c2UoZm4sIGVsZW1lbnQsIGFyZykge1xuICByZXR1cm4gdW50cmFjaygoKSA9PiBmbihlbGVtZW50LCBhcmcpKTtcbn1cbmZ1bmN0aW9uIGluc2VydChwYXJlbnQsIGFjY2Vzc29yLCBtYXJrZXIsIGluaXRpYWwpIHtcbiAgaWYgKG1hcmtlciAhPT0gdW5kZWZpbmVkICYmICFpbml0aWFsKSBpbml0aWFsID0gW107XG4gIGlmICh0eXBlb2YgYWNjZXNzb3IgIT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIGluc2VydEV4cHJlc3Npb24ocGFyZW50LCBhY2Nlc3NvciwgaW5pdGlhbCwgbWFya2VyKTtcbiAgY3JlYXRlUmVuZGVyRWZmZWN0KGN1cnJlbnQgPT4gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIGFjY2Vzc29yKCksIGN1cnJlbnQsIG1hcmtlciksIGluaXRpYWwpO1xufVxuZnVuY3Rpb24gYXNzaWduKG5vZGUsIHByb3BzLCBpc1NWRywgc2tpcENoaWxkcmVuLCBwcmV2UHJvcHMgPSB7fSwgc2tpcFJlZiA9IGZhbHNlKSB7XG4gIHByb3BzIHx8IChwcm9wcyA9IHt9KTtcbiAgZm9yIChjb25zdCBwcm9wIGluIHByZXZQcm9wcykge1xuICAgIGlmICghKHByb3AgaW4gcHJvcHMpKSB7XG4gICAgICBpZiAocHJvcCA9PT0gXCJjaGlsZHJlblwiKSBjb250aW51ZTtcbiAgICAgIHByZXZQcm9wc1twcm9wXSA9IGFzc2lnblByb3Aobm9kZSwgcHJvcCwgbnVsbCwgcHJldlByb3BzW3Byb3BdLCBpc1NWRywgc2tpcFJlZiwgcHJvcHMpO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IHByb3AgaW4gcHJvcHMpIHtcbiAgICBpZiAocHJvcCA9PT0gXCJjaGlsZHJlblwiKSB7XG4gICAgICBpZiAoIXNraXBDaGlsZHJlbikgaW5zZXJ0RXhwcmVzc2lvbihub2RlLCBwcm9wcy5jaGlsZHJlbik7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSBwcm9wc1twcm9wXTtcbiAgICBwcmV2UHJvcHNbcHJvcF0gPSBhc3NpZ25Qcm9wKG5vZGUsIHByb3AsIHZhbHVlLCBwcmV2UHJvcHNbcHJvcF0sIGlzU1ZHLCBza2lwUmVmLCBwcm9wcyk7XG4gIH1cbn1cbmZ1bmN0aW9uIGh5ZHJhdGUkMShjb2RlLCBlbGVtZW50LCBvcHRpb25zID0ge30pIHtcbiAgaWYgKGdsb2JhbFRoaXMuXyRIWS5kb25lKSByZXR1cm4gcmVuZGVyKGNvZGUsIGVsZW1lbnQsIFsuLi5lbGVtZW50LmNoaWxkTm9kZXNdLCBvcHRpb25zKTtcbiAgc2hhcmVkQ29uZmlnLmNvbXBsZXRlZCA9IGdsb2JhbFRoaXMuXyRIWS5jb21wbGV0ZWQ7XG4gIHNoYXJlZENvbmZpZy5ldmVudHMgPSBnbG9iYWxUaGlzLl8kSFkuZXZlbnRzO1xuICBzaGFyZWRDb25maWcubG9hZCA9IGlkID0+IGdsb2JhbFRoaXMuXyRIWS5yW2lkXTtcbiAgc2hhcmVkQ29uZmlnLmhhcyA9IGlkID0+IGlkIGluIGdsb2JhbFRoaXMuXyRIWS5yO1xuICBzaGFyZWRDb25maWcuZ2F0aGVyID0gcm9vdCA9PiBnYXRoZXJIeWRyYXRhYmxlKGVsZW1lbnQsIHJvb3QpO1xuICBzaGFyZWRDb25maWcucmVnaXN0cnkgPSBuZXcgTWFwKCk7XG4gIHNoYXJlZENvbmZpZy5jb250ZXh0ID0ge1xuICAgIGlkOiBvcHRpb25zLnJlbmRlcklkIHx8IFwiXCIsXG4gICAgY291bnQ6IDBcbiAgfTtcbiAgdHJ5IHtcbiAgICBnYXRoZXJIeWRyYXRhYmxlKGVsZW1lbnQsIG9wdGlvbnMucmVuZGVySWQpO1xuICAgIHJldHVybiByZW5kZXIoY29kZSwgZWxlbWVudCwgWy4uLmVsZW1lbnQuY2hpbGROb2Rlc10sIG9wdGlvbnMpO1xuICB9IGZpbmFsbHkge1xuICAgIHNoYXJlZENvbmZpZy5jb250ZXh0ID0gbnVsbDtcbiAgfVxufVxuZnVuY3Rpb24gZ2V0TmV4dEVsZW1lbnQodGVtcGxhdGUpIHtcbiAgbGV0IG5vZGUsXG4gICAga2V5LFxuICAgIGh5ZHJhdGluZyA9IGlzSHlkcmF0aW5nKCk7XG4gIGlmICghaHlkcmF0aW5nIHx8ICEobm9kZSA9IHNoYXJlZENvbmZpZy5yZWdpc3RyeS5nZXQoa2V5ID0gZ2V0SHlkcmF0aW9uS2V5KCkpKSkge1xuICAgIGlmIChoeWRyYXRpbmcpIHtcbiAgICAgIHNoYXJlZENvbmZpZy5kb25lID0gdHJ1ZTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSHlkcmF0aW9uIE1pc21hdGNoLiBVbmFibGUgdG8gZmluZCBET00gbm9kZXMgZm9yIGh5ZHJhdGlvbiBrZXk6ICR7a2V5fVxcbiR7dGVtcGxhdGUgPyB0ZW1wbGF0ZSgpLm91dGVySFRNTCA6IFwiXCJ9YCk7XG4gICAgfVxuICAgIHJldHVybiB0ZW1wbGF0ZSgpO1xuICB9XG4gIGlmIChzaGFyZWRDb25maWcuY29tcGxldGVkKSBzaGFyZWRDb25maWcuY29tcGxldGVkLmFkZChub2RlKTtcbiAgc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LmRlbGV0ZShrZXkpO1xuICByZXR1cm4gbm9kZTtcbn1cbmZ1bmN0aW9uIGdldE5leHRNYXRjaChlbCwgbm9kZU5hbWUpIHtcbiAgd2hpbGUgKGVsICYmIGVsLmxvY2FsTmFtZSAhPT0gbm9kZU5hbWUpIGVsID0gZWwubmV4dFNpYmxpbmc7XG4gIHJldHVybiBlbDtcbn1cbmZ1bmN0aW9uIGdldE5leHRNYXJrZXIoc3RhcnQpIHtcbiAgbGV0IGVuZCA9IHN0YXJ0LFxuICAgIGNvdW50ID0gMCxcbiAgICBjdXJyZW50ID0gW107XG4gIGlmIChpc0h5ZHJhdGluZyhzdGFydCkpIHtcbiAgICB3aGlsZSAoZW5kKSB7XG4gICAgICBpZiAoZW5kLm5vZGVUeXBlID09PSA4KSB7XG4gICAgICAgIGNvbnN0IHYgPSBlbmQubm9kZVZhbHVlO1xuICAgICAgICBpZiAodiA9PT0gXCIkXCIpIGNvdW50Kys7ZWxzZSBpZiAodiA9PT0gXCIvXCIpIHtcbiAgICAgICAgICBpZiAoY291bnQgPT09IDApIHJldHVybiBbZW5kLCBjdXJyZW50XTtcbiAgICAgICAgICBjb3VudC0tO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjdXJyZW50LnB1c2goZW5kKTtcbiAgICAgIGVuZCA9IGVuZC5uZXh0U2libGluZztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIFtlbmQsIGN1cnJlbnRdO1xufVxuZnVuY3Rpb24gcnVuSHlkcmF0aW9uRXZlbnRzKCkge1xuICBpZiAoc2hhcmVkQ29uZmlnLmV2ZW50cyAmJiAhc2hhcmVkQ29uZmlnLmV2ZW50cy5xdWV1ZWQpIHtcbiAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIGNvbXBsZXRlZCxcbiAgICAgICAgZXZlbnRzXG4gICAgICB9ID0gc2hhcmVkQ29uZmlnO1xuICAgICAgaWYgKCFldmVudHMpIHJldHVybjtcbiAgICAgIGV2ZW50cy5xdWV1ZWQgPSBmYWxzZTtcbiAgICAgIHdoaWxlIChldmVudHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IFtlbCwgZV0gPSBldmVudHNbMF07XG4gICAgICAgIGlmICghY29tcGxldGVkLmhhcyhlbCkpIHJldHVybjtcbiAgICAgICAgZXZlbnRzLnNoaWZ0KCk7XG4gICAgICAgIGV2ZW50SGFuZGxlcihlKTtcbiAgICAgIH1cbiAgICAgIGlmIChzaGFyZWRDb25maWcuZG9uZSkge1xuICAgICAgICBzaGFyZWRDb25maWcuZXZlbnRzID0gXyRIWS5ldmVudHMgPSBudWxsO1xuICAgICAgICBzaGFyZWRDb25maWcuY29tcGxldGVkID0gXyRIWS5jb21wbGV0ZWQgPSBudWxsO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHNoYXJlZENvbmZpZy5ldmVudHMucXVldWVkID0gdHJ1ZTtcbiAgfVxufVxuZnVuY3Rpb24gaXNIeWRyYXRpbmcobm9kZSkge1xuICByZXR1cm4gISFzaGFyZWRDb25maWcuY29udGV4dCAmJiAhc2hhcmVkQ29uZmlnLmRvbmUgJiYgKCFub2RlIHx8IG5vZGUuaXNDb25uZWN0ZWQpO1xufVxuZnVuY3Rpb24gdG9Qcm9wZXJ0eU5hbWUobmFtZSkge1xuICByZXR1cm4gbmFtZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoLy0oW2Etel0pL2csIChfLCB3KSA9PiB3LnRvVXBwZXJDYXNlKCkpO1xufVxuZnVuY3Rpb24gdG9nZ2xlQ2xhc3NLZXkobm9kZSwga2V5LCB2YWx1ZSkge1xuICBjb25zdCBjbGFzc05hbWVzID0ga2V5LnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICBmb3IgKGxldCBpID0gMCwgbmFtZUxlbiA9IGNsYXNzTmFtZXMubGVuZ3RoOyBpIDwgbmFtZUxlbjsgaSsrKSBub2RlLmNsYXNzTGlzdC50b2dnbGUoY2xhc3NOYW1lc1tpXSwgdmFsdWUpO1xufVxuZnVuY3Rpb24gYXNzaWduUHJvcChub2RlLCBwcm9wLCB2YWx1ZSwgcHJldiwgaXNTVkcsIHNraXBSZWYsIHByb3BzKSB7XG4gIGxldCBpc0NFLCBpc1Byb3AsIGlzQ2hpbGRQcm9wLCBwcm9wQWxpYXMsIGZvcmNlUHJvcDtcbiAgaWYgKHByb3AgPT09IFwic3R5bGVcIikgcmV0dXJuIHN0eWxlKG5vZGUsIHZhbHVlLCBwcmV2KTtcbiAgaWYgKHByb3AgPT09IFwiY2xhc3NMaXN0XCIpIHJldHVybiBjbGFzc0xpc3Qobm9kZSwgdmFsdWUsIHByZXYpO1xuICBpZiAodmFsdWUgPT09IHByZXYpIHJldHVybiBwcmV2O1xuICBpZiAocHJvcCA9PT0gXCJyZWZcIikge1xuICAgIGlmICghc2tpcFJlZikgdmFsdWUobm9kZSk7XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCAzKSA9PT0gXCJvbjpcIikge1xuICAgIGNvbnN0IGUgPSBwcm9wLnNsaWNlKDMpO1xuICAgIHByZXYgJiYgbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKGUsIHByZXYsIHR5cGVvZiBwcmV2ICE9PSBcImZ1bmN0aW9uXCIgJiYgcHJldik7XG4gICAgdmFsdWUgJiYgbm9kZS5hZGRFdmVudExpc3RlbmVyKGUsIHZhbHVlLCB0eXBlb2YgdmFsdWUgIT09IFwiZnVuY3Rpb25cIiAmJiB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCAxMCkgPT09IFwib25jYXB0dXJlOlwiKSB7XG4gICAgY29uc3QgZSA9IHByb3Auc2xpY2UoMTApO1xuICAgIHByZXYgJiYgbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKGUsIHByZXYsIHRydWUpO1xuICAgIHZhbHVlICYmIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihlLCB2YWx1ZSwgdHJ1ZSk7XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCAyKSA9PT0gXCJvblwiKSB7XG4gICAgY29uc3QgbmFtZSA9IHByb3Auc2xpY2UoMikudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBkZWxlZ2F0ZSA9IERlbGVnYXRlZEV2ZW50cy5oYXMobmFtZSk7XG4gICAgaWYgKCFkZWxlZ2F0ZSAmJiBwcmV2KSB7XG4gICAgICBjb25zdCBoID0gQXJyYXkuaXNBcnJheShwcmV2KSA/IHByZXZbMF0gOiBwcmV2O1xuICAgICAgbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKG5hbWUsIGgpO1xuICAgIH1cbiAgICBpZiAoZGVsZWdhdGUgfHwgdmFsdWUpIHtcbiAgICAgIGFkZEV2ZW50TGlzdGVuZXIobm9kZSwgbmFtZSwgdmFsdWUsIGRlbGVnYXRlKTtcbiAgICAgIGRlbGVnYXRlICYmIGRlbGVnYXRlRXZlbnRzKFtuYW1lXSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgNSkgPT09IFwiYXR0cjpcIikge1xuICAgIHNldEF0dHJpYnV0ZShub2RlLCBwcm9wLnNsaWNlKDUpLCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCA1KSA9PT0gXCJib29sOlwiKSB7XG4gICAgc2V0Qm9vbEF0dHJpYnV0ZShub2RlLCBwcm9wLnNsaWNlKDUpLCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoKGZvcmNlUHJvcCA9IHByb3Auc2xpY2UoMCwgNSkgPT09IFwicHJvcDpcIikgfHwgKGlzQ2hpbGRQcm9wID0gQ2hpbGRQcm9wZXJ0aWVzLmhhcyhwcm9wKSkgfHwgIWlzU1ZHICYmICgocHJvcEFsaWFzID0gZ2V0UHJvcEFsaWFzKHByb3AsIG5vZGUudGFnTmFtZSkpIHx8IChpc1Byb3AgPSBQcm9wZXJ0aWVzLmhhcyhwcm9wKSkpIHx8IChpc0NFID0gbm9kZS5ub2RlTmFtZS5pbmNsdWRlcyhcIi1cIikgfHwgXCJpc1wiIGluIHByb3BzKSkge1xuICAgIGlmIChmb3JjZVByb3ApIHtcbiAgICAgIHByb3AgPSBwcm9wLnNsaWNlKDUpO1xuICAgICAgaXNQcm9wID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm4gdmFsdWU7XG4gICAgaWYgKHByb3AgPT09IFwiY2xhc3NcIiB8fCBwcm9wID09PSBcImNsYXNzTmFtZVwiKSBjbGFzc05hbWUobm9kZSwgdmFsdWUpO2Vsc2UgaWYgKGlzQ0UgJiYgIWlzUHJvcCAmJiAhaXNDaGlsZFByb3ApIG5vZGVbdG9Qcm9wZXJ0eU5hbWUocHJvcCldID0gdmFsdWU7ZWxzZSBub2RlW3Byb3BBbGlhcyB8fCBwcm9wXSA9IHZhbHVlO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IG5zID0gaXNTVkcgJiYgcHJvcC5pbmRleE9mKFwiOlwiKSA+IC0xICYmIFNWR05hbWVzcGFjZVtwcm9wLnNwbGl0KFwiOlwiKVswXV07XG4gICAgaWYgKG5zKSBzZXRBdHRyaWJ1dGVOUyhub2RlLCBucywgcHJvcCwgdmFsdWUpO2Vsc2Ugc2V0QXR0cmlidXRlKG5vZGUsIEFsaWFzZXNbcHJvcF0gfHwgcHJvcCwgdmFsdWUpO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIGV2ZW50SGFuZGxlcihlKSB7XG4gIGlmIChzaGFyZWRDb25maWcucmVnaXN0cnkgJiYgc2hhcmVkQ29uZmlnLmV2ZW50cykge1xuICAgIGlmIChzaGFyZWRDb25maWcuZXZlbnRzLmZpbmQoKFtlbCwgZXZdKSA9PiBldiA9PT0gZSkpIHJldHVybjtcbiAgfVxuICBsZXQgbm9kZSA9IGUudGFyZ2V0O1xuICBjb25zdCBrZXkgPSBgJCQke2UudHlwZX1gO1xuICBjb25zdCBvcmlUYXJnZXQgPSBlLnRhcmdldDtcbiAgY29uc3Qgb3JpQ3VycmVudFRhcmdldCA9IGUuY3VycmVudFRhcmdldDtcbiAgY29uc3QgcmV0YXJnZXQgPSB2YWx1ZSA9PiBPYmplY3QuZGVmaW5lUHJvcGVydHkoZSwgXCJ0YXJnZXRcIiwge1xuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB2YWx1ZVxuICB9KTtcbiAgY29uc3QgaGFuZGxlTm9kZSA9ICgpID0+IHtcbiAgICBjb25zdCBoYW5kbGVyID0gbm9kZVtrZXldO1xuICAgIGlmIChoYW5kbGVyICYmICFub2RlLmRpc2FibGVkKSB7XG4gICAgICBjb25zdCBkYXRhID0gbm9kZVtgJHtrZXl9RGF0YWBdO1xuICAgICAgZGF0YSAhPT0gdW5kZWZpbmVkID8gaGFuZGxlci5jYWxsKG5vZGUsIGRhdGEsIGUpIDogaGFuZGxlci5jYWxsKG5vZGUsIGUpO1xuICAgICAgaWYgKGUuY2FuY2VsQnViYmxlKSByZXR1cm47XG4gICAgfVxuICAgIG5vZGUuaG9zdCAmJiB0eXBlb2Ygbm9kZS5ob3N0ICE9PSBcInN0cmluZ1wiICYmICFub2RlLmhvc3QuXyRob3N0ICYmIG5vZGUuY29udGFpbnMoZS50YXJnZXQpICYmIHJldGFyZ2V0KG5vZGUuaG9zdCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG4gIGNvbnN0IHdhbGtVcFRyZWUgPSAoKSA9PiB7XG4gICAgd2hpbGUgKGhhbmRsZU5vZGUoKSAmJiAobm9kZSA9IG5vZGUuXyRob3N0IHx8IG5vZGUucGFyZW50Tm9kZSB8fCBub2RlLmhvc3QpKTtcbiAgfTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGUsIFwiY3VycmVudFRhcmdldFwiLCB7XG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIGdldCgpIHtcbiAgICAgIHJldHVybiBub2RlIHx8IGRvY3VtZW50O1xuICAgIH1cbiAgfSk7XG4gIGlmIChzaGFyZWRDb25maWcucmVnaXN0cnkgJiYgIXNoYXJlZENvbmZpZy5kb25lKSBzaGFyZWRDb25maWcuZG9uZSA9IF8kSFkuZG9uZSA9IHRydWU7XG4gIGlmIChlLmNvbXBvc2VkUGF0aCkge1xuICAgIGNvbnN0IHBhdGggPSBlLmNvbXBvc2VkUGF0aCgpO1xuICAgIHJldGFyZ2V0KHBhdGhbMF0pO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0aC5sZW5ndGggLSAyOyBpKyspIHtcbiAgICAgIG5vZGUgPSBwYXRoW2ldO1xuICAgICAgaWYgKCFoYW5kbGVOb2RlKCkpIGJyZWFrO1xuICAgICAgaWYgKG5vZGUuXyRob3N0KSB7XG4gICAgICAgIG5vZGUgPSBub2RlLl8kaG9zdDtcbiAgICAgICAgd2Fsa1VwVHJlZSgpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmIChub2RlLnBhcmVudE5vZGUgPT09IG9yaUN1cnJlbnRUYXJnZXQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGVsc2Ugd2Fsa1VwVHJlZSgpO1xuICByZXRhcmdldChvcmlUYXJnZXQpO1xufVxuZnVuY3Rpb24gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIHZhbHVlLCBjdXJyZW50LCBtYXJrZXIsIHVud3JhcEFycmF5KSB7XG4gIGNvbnN0IGh5ZHJhdGluZyA9IGlzSHlkcmF0aW5nKHBhcmVudCk7XG4gIGlmIChoeWRyYXRpbmcpIHtcbiAgICAhY3VycmVudCAmJiAoY3VycmVudCA9IFsuLi5wYXJlbnQuY2hpbGROb2Rlc10pO1xuICAgIGxldCBjbGVhbmVkID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjdXJyZW50Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBub2RlID0gY3VycmVudFtpXTtcbiAgICAgIGlmIChub2RlLm5vZGVUeXBlID09PSA4ICYmIG5vZGUuZGF0YS5zbGljZSgwLCAyKSA9PT0gXCIhJFwiKSBub2RlLnJlbW92ZSgpO2Vsc2UgY2xlYW5lZC5wdXNoKG5vZGUpO1xuICAgIH1cbiAgICBjdXJyZW50ID0gY2xlYW5lZDtcbiAgfVxuICB3aGlsZSAodHlwZW9mIGN1cnJlbnQgPT09IFwiZnVuY3Rpb25cIikgY3VycmVudCA9IGN1cnJlbnQoKTtcbiAgaWYgKHZhbHVlID09PSBjdXJyZW50KSByZXR1cm4gY3VycmVudDtcbiAgY29uc3QgdCA9IHR5cGVvZiB2YWx1ZSxcbiAgICBtdWx0aSA9IG1hcmtlciAhPT0gdW5kZWZpbmVkO1xuICBwYXJlbnQgPSBtdWx0aSAmJiBjdXJyZW50WzBdICYmIGN1cnJlbnRbMF0ucGFyZW50Tm9kZSB8fCBwYXJlbnQ7XG4gIGlmICh0ID09PSBcInN0cmluZ1wiIHx8IHQgPT09IFwibnVtYmVyXCIpIHtcbiAgICBpZiAoaHlkcmF0aW5nKSByZXR1cm4gY3VycmVudDtcbiAgICBpZiAodCA9PT0gXCJudW1iZXJcIikge1xuICAgICAgdmFsdWUgPSB2YWx1ZS50b1N0cmluZygpO1xuICAgICAgaWYgKHZhbHVlID09PSBjdXJyZW50KSByZXR1cm4gY3VycmVudDtcbiAgICB9XG4gICAgaWYgKG11bHRpKSB7XG4gICAgICBsZXQgbm9kZSA9IGN1cnJlbnRbMF07XG4gICAgICBpZiAobm9kZSAmJiBub2RlLm5vZGVUeXBlID09PSAzKSB7XG4gICAgICAgIG5vZGUuZGF0YSAhPT0gdmFsdWUgJiYgKG5vZGUuZGF0YSA9IHZhbHVlKTtcbiAgICAgIH0gZWxzZSBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodmFsdWUpO1xuICAgICAgY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIsIG5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoY3VycmVudCAhPT0gXCJcIiAmJiB0eXBlb2YgY3VycmVudCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICBjdXJyZW50ID0gcGFyZW50LmZpcnN0Q2hpbGQuZGF0YSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIGN1cnJlbnQgPSBwYXJlbnQudGV4dENvbnRlbnQgPSB2YWx1ZTtcbiAgICB9XG4gIH0gZWxzZSBpZiAodmFsdWUgPT0gbnVsbCB8fCB0ID09PSBcImJvb2xlYW5cIikge1xuICAgIGlmIChoeWRyYXRpbmcpIHJldHVybiBjdXJyZW50O1xuICAgIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyKTtcbiAgfSBlbHNlIGlmICh0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4ge1xuICAgICAgbGV0IHYgPSB2YWx1ZSgpO1xuICAgICAgd2hpbGUgKHR5cGVvZiB2ID09PSBcImZ1bmN0aW9uXCIpIHYgPSB2KCk7XG4gICAgICBjdXJyZW50ID0gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIHYsIGN1cnJlbnQsIG1hcmtlcik7XG4gICAgfSk7XG4gICAgcmV0dXJuICgpID0+IGN1cnJlbnQ7XG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICBjb25zdCBhcnJheSA9IFtdO1xuICAgIGNvbnN0IGN1cnJlbnRBcnJheSA9IGN1cnJlbnQgJiYgQXJyYXkuaXNBcnJheShjdXJyZW50KTtcbiAgICBpZiAobm9ybWFsaXplSW5jb21pbmdBcnJheShhcnJheSwgdmFsdWUsIGN1cnJlbnQsIHVud3JhcEFycmF5KSkge1xuICAgICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IGN1cnJlbnQgPSBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgYXJyYXksIGN1cnJlbnQsIG1hcmtlciwgdHJ1ZSkpO1xuICAgICAgcmV0dXJuICgpID0+IGN1cnJlbnQ7XG4gICAgfVxuICAgIGlmIChoeWRyYXRpbmcpIHtcbiAgICAgIGlmICghYXJyYXkubGVuZ3RoKSByZXR1cm4gY3VycmVudDtcbiAgICAgIGlmIChtYXJrZXIgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGN1cnJlbnQgPSBbLi4ucGFyZW50LmNoaWxkTm9kZXNdO1xuICAgICAgbGV0IG5vZGUgPSBhcnJheVswXTtcbiAgICAgIGlmIChub2RlLnBhcmVudE5vZGUgIT09IHBhcmVudCkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgICBjb25zdCBub2RlcyA9IFtub2RlXTtcbiAgICAgIHdoaWxlICgobm9kZSA9IG5vZGUubmV4dFNpYmxpbmcpICE9PSBtYXJrZXIpIG5vZGVzLnB1c2gobm9kZSk7XG4gICAgICByZXR1cm4gY3VycmVudCA9IG5vZGVzO1xuICAgIH1cbiAgICBpZiAoYXJyYXkubGVuZ3RoID09PSAwKSB7XG4gICAgICBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlcik7XG4gICAgICBpZiAobXVsdGkpIHJldHVybiBjdXJyZW50O1xuICAgIH0gZWxzZSBpZiAoY3VycmVudEFycmF5KSB7XG4gICAgICBpZiAoY3VycmVudC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgYXBwZW5kTm9kZXMocGFyZW50LCBhcnJheSwgbWFya2VyKTtcbiAgICAgIH0gZWxzZSByZWNvbmNpbGVBcnJheXMocGFyZW50LCBjdXJyZW50LCBhcnJheSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN1cnJlbnQgJiYgY2xlYW5DaGlsZHJlbihwYXJlbnQpO1xuICAgICAgYXBwZW5kTm9kZXMocGFyZW50LCBhcnJheSk7XG4gICAgfVxuICAgIGN1cnJlbnQgPSBhcnJheTtcbiAgfSBlbHNlIGlmICh2YWx1ZS5ub2RlVHlwZSkge1xuICAgIGlmIChoeWRyYXRpbmcgJiYgdmFsdWUucGFyZW50Tm9kZSkgcmV0dXJuIGN1cnJlbnQgPSBtdWx0aSA/IFt2YWx1ZV0gOiB2YWx1ZTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShjdXJyZW50KSkge1xuICAgICAgaWYgKG11bHRpKSByZXR1cm4gY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIsIHZhbHVlKTtcbiAgICAgIGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBudWxsLCB2YWx1ZSk7XG4gICAgfSBlbHNlIGlmIChjdXJyZW50ID09IG51bGwgfHwgY3VycmVudCA9PT0gXCJcIiB8fCAhcGFyZW50LmZpcnN0Q2hpbGQpIHtcbiAgICAgIHBhcmVudC5hcHBlbmRDaGlsZCh2YWx1ZSk7XG4gICAgfSBlbHNlIHBhcmVudC5yZXBsYWNlQ2hpbGQodmFsdWUsIHBhcmVudC5maXJzdENoaWxkKTtcbiAgICBjdXJyZW50ID0gdmFsdWU7XG4gIH0gZWxzZSBjb25zb2xlLndhcm4oYFVucmVjb2duaXplZCB2YWx1ZS4gU2tpcHBlZCBpbnNlcnRpbmdgLCB2YWx1ZSk7XG4gIHJldHVybiBjdXJyZW50O1xufVxuZnVuY3Rpb24gbm9ybWFsaXplSW5jb21pbmdBcnJheShub3JtYWxpemVkLCBhcnJheSwgY3VycmVudCwgdW53cmFwKSB7XG4gIGxldCBkeW5hbWljID0gZmFsc2U7XG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBhcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGxldCBpdGVtID0gYXJyYXlbaV0sXG4gICAgICBwcmV2ID0gY3VycmVudCAmJiBjdXJyZW50W25vcm1hbGl6ZWQubGVuZ3RoXSxcbiAgICAgIHQ7XG4gICAgaWYgKGl0ZW0gPT0gbnVsbCB8fCBpdGVtID09PSB0cnVlIHx8IGl0ZW0gPT09IGZhbHNlKSA7IGVsc2UgaWYgKCh0ID0gdHlwZW9mIGl0ZW0pID09PSBcIm9iamVjdFwiICYmIGl0ZW0ubm9kZVR5cGUpIHtcbiAgICAgIG5vcm1hbGl6ZWQucHVzaChpdGVtKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaXRlbSkpIHtcbiAgICAgIGR5bmFtaWMgPSBub3JtYWxpemVJbmNvbWluZ0FycmF5KG5vcm1hbGl6ZWQsIGl0ZW0sIHByZXYpIHx8IGR5bmFtaWM7XG4gICAgfSBlbHNlIGlmICh0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGlmICh1bndyYXApIHtcbiAgICAgICAgd2hpbGUgKHR5cGVvZiBpdGVtID09PSBcImZ1bmN0aW9uXCIpIGl0ZW0gPSBpdGVtKCk7XG4gICAgICAgIGR5bmFtaWMgPSBub3JtYWxpemVJbmNvbWluZ0FycmF5KG5vcm1hbGl6ZWQsIEFycmF5LmlzQXJyYXkoaXRlbSkgPyBpdGVtIDogW2l0ZW1dLCBBcnJheS5pc0FycmF5KHByZXYpID8gcHJldiA6IFtwcmV2XSkgfHwgZHluYW1pYztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5vcm1hbGl6ZWQucHVzaChpdGVtKTtcbiAgICAgICAgZHluYW1pYyA9IHRydWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gU3RyaW5nKGl0ZW0pO1xuICAgICAgaWYgKHByZXYgJiYgcHJldi5ub2RlVHlwZSA9PT0gMyAmJiBwcmV2LmRhdGEgPT09IHZhbHVlKSBub3JtYWxpemVkLnB1c2gocHJldik7ZWxzZSBub3JtYWxpemVkLnB1c2goZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodmFsdWUpKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGR5bmFtaWM7XG59XG5mdW5jdGlvbiBhcHBlbmROb2RlcyhwYXJlbnQsIGFycmF5LCBtYXJrZXIgPSBudWxsKSB7XG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBhcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykgcGFyZW50Lmluc2VydEJlZm9yZShhcnJheVtpXSwgbWFya2VyKTtcbn1cbmZ1bmN0aW9uIGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIsIHJlcGxhY2VtZW50KSB7XG4gIGlmIChtYXJrZXIgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHBhcmVudC50ZXh0Q29udGVudCA9IFwiXCI7XG4gIGNvbnN0IG5vZGUgPSByZXBsYWNlbWVudCB8fCBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIlwiKTtcbiAgaWYgKGN1cnJlbnQubGVuZ3RoKSB7XG4gICAgbGV0IGluc2VydGVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IGN1cnJlbnQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IGVsID0gY3VycmVudFtpXTtcbiAgICAgIGlmIChub2RlICE9PSBlbCkge1xuICAgICAgICBjb25zdCBpc1BhcmVudCA9IGVsLnBhcmVudE5vZGUgPT09IHBhcmVudDtcbiAgICAgICAgaWYgKCFpbnNlcnRlZCAmJiAhaSkgaXNQYXJlbnQgPyBwYXJlbnQucmVwbGFjZUNoaWxkKG5vZGUsIGVsKSA6IHBhcmVudC5pbnNlcnRCZWZvcmUobm9kZSwgbWFya2VyKTtlbHNlIGlzUGFyZW50ICYmIGVsLnJlbW92ZSgpO1xuICAgICAgfSBlbHNlIGluc2VydGVkID0gdHJ1ZTtcbiAgICB9XG4gIH0gZWxzZSBwYXJlbnQuaW5zZXJ0QmVmb3JlKG5vZGUsIG1hcmtlcik7XG4gIHJldHVybiBbbm9kZV07XG59XG5mdW5jdGlvbiBnYXRoZXJIeWRyYXRhYmxlKGVsZW1lbnQsIHJvb3QpIHtcbiAgY29uc3QgdGVtcGxhdGVzID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKGAqW2RhdGEtaGtdYCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcGxhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qgbm9kZSA9IHRlbXBsYXRlc1tpXTtcbiAgICBjb25zdCBrZXkgPSBub2RlLmdldEF0dHJpYnV0ZShcImRhdGEtaGtcIik7XG4gICAgaWYgKCghcm9vdCB8fCBrZXkuc3RhcnRzV2l0aChyb290KSkgJiYgIXNoYXJlZENvbmZpZy5yZWdpc3RyeS5oYXMoa2V5KSkgc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LnNldChrZXksIG5vZGUpO1xuICB9XG59XG5mdW5jdGlvbiBnZXRIeWRyYXRpb25LZXkoKSB7XG4gIHJldHVybiBzaGFyZWRDb25maWcuZ2V0TmV4dENvbnRleHRJZCgpO1xufVxuZnVuY3Rpb24gTm9IeWRyYXRpb24ocHJvcHMpIHtcbiAgcmV0dXJuIHNoYXJlZENvbmZpZy5jb250ZXh0ID8gdW5kZWZpbmVkIDogcHJvcHMuY2hpbGRyZW47XG59XG5mdW5jdGlvbiBIeWRyYXRpb24ocHJvcHMpIHtcbiAgcmV0dXJuIHByb3BzLmNoaWxkcmVuO1xufVxuY29uc3Qgdm9pZEZuID0gKCkgPT4gdW5kZWZpbmVkO1xuY29uc3QgUmVxdWVzdENvbnRleHQgPSBTeW1ib2woKTtcbmZ1bmN0aW9uIGlubmVySFRNTChwYXJlbnQsIGNvbnRlbnQpIHtcbiAgIXNoYXJlZENvbmZpZy5jb250ZXh0ICYmIChwYXJlbnQuaW5uZXJIVE1MID0gY29udGVudCk7XG59XG5cbmZ1bmN0aW9uIHRocm93SW5Ccm93c2VyKGZ1bmMpIHtcbiAgY29uc3QgZXJyID0gbmV3IEVycm9yKGAke2Z1bmMubmFtZX0gaXMgbm90IHN1cHBvcnRlZCBpbiB0aGUgYnJvd3NlciwgcmV0dXJuaW5nIHVuZGVmaW5lZGApO1xuICBjb25zb2xlLmVycm9yKGVycik7XG59XG5mdW5jdGlvbiByZW5kZXJUb1N0cmluZyhmbiwgb3B0aW9ucykge1xuICB0aHJvd0luQnJvd3NlcihyZW5kZXJUb1N0cmluZyk7XG59XG5mdW5jdGlvbiByZW5kZXJUb1N0cmluZ0FzeW5jKGZuLCBvcHRpb25zKSB7XG4gIHRocm93SW5Ccm93c2VyKHJlbmRlclRvU3RyaW5nQXN5bmMpO1xufVxuZnVuY3Rpb24gcmVuZGVyVG9TdHJlYW0oZm4sIG9wdGlvbnMpIHtcbiAgdGhyb3dJbkJyb3dzZXIocmVuZGVyVG9TdHJlYW0pO1xufVxuZnVuY3Rpb24gc3NyKHRlbXBsYXRlLCAuLi5ub2Rlcykge31cbmZ1bmN0aW9uIHNzckVsZW1lbnQobmFtZSwgcHJvcHMsIGNoaWxkcmVuLCBuZWVkc0lkKSB7fVxuZnVuY3Rpb24gc3NyQ2xhc3NMaXN0KHZhbHVlKSB7fVxuZnVuY3Rpb24gc3NyU3R5bGUodmFsdWUpIHt9XG5mdW5jdGlvbiBzc3JBdHRyaWJ1dGUoa2V5LCB2YWx1ZSkge31cbmZ1bmN0aW9uIHNzckh5ZHJhdGlvbktleSgpIHt9XG5mdW5jdGlvbiByZXNvbHZlU1NSTm9kZShub2RlKSB7fVxuZnVuY3Rpb24gZXNjYXBlKGh0bWwpIHt9XG5mdW5jdGlvbiBzc3JTcHJlYWQocHJvcHMsIGlzU1ZHLCBza2lwQ2hpbGRyZW4pIHt9XG5cbmNvbnN0IGlzU2VydmVyID0gZmFsc2U7XG5jb25zdCBpc0RldiA9IHRydWU7XG5jb25zdCBTVkdfTkFNRVNQQUNFID0gXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiO1xuZnVuY3Rpb24gY3JlYXRlRWxlbWVudCh0YWdOYW1lLCBpc1NWRyA9IGZhbHNlKSB7XG4gIHJldHVybiBpc1NWRyA/IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhTVkdfTkFNRVNQQUNFLCB0YWdOYW1lKSA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSk7XG59XG5jb25zdCBoeWRyYXRlID0gKC4uLmFyZ3MpID0+IHtcbiAgZW5hYmxlSHlkcmF0aW9uKCk7XG4gIHJldHVybiBoeWRyYXRlJDEoLi4uYXJncyk7XG59O1xuZnVuY3Rpb24gUG9ydGFsKHByb3BzKSB7XG4gIGNvbnN0IHtcbiAgICAgIHVzZVNoYWRvd1xuICAgIH0gPSBwcm9wcyxcbiAgICBtYXJrZXIgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIlwiKSxcbiAgICBtb3VudCA9ICgpID0+IHByb3BzLm1vdW50IHx8IGRvY3VtZW50LmJvZHksXG4gICAgb3duZXIgPSBnZXRPd25lcigpO1xuICBsZXQgY29udGVudDtcbiAgbGV0IGh5ZHJhdGluZyA9ICEhc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGh5ZHJhdGluZykgZ2V0T3duZXIoKS51c2VyID0gaHlkcmF0aW5nID0gZmFsc2U7XG4gICAgY29udGVudCB8fCAoY29udGVudCA9IHJ1bldpdGhPd25lcihvd25lciwgKCkgPT4gY3JlYXRlTWVtbygoKSA9PiBwcm9wcy5jaGlsZHJlbikpKTtcbiAgICBjb25zdCBlbCA9IG1vdW50KCk7XG4gICAgaWYgKGVsIGluc3RhbmNlb2YgSFRNTEhlYWRFbGVtZW50KSB7XG4gICAgICBjb25zdCBbY2xlYW4sIHNldENsZWFuXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gICAgICBjb25zdCBjbGVhbnVwID0gKCkgPT4gc2V0Q2xlYW4odHJ1ZSk7XG4gICAgICBjcmVhdGVSb290KGRpc3Bvc2UgPT4gaW5zZXJ0KGVsLCAoKSA9PiAhY2xlYW4oKSA/IGNvbnRlbnQoKSA6IGRpc3Bvc2UoKSwgbnVsbCkpO1xuICAgICAgb25DbGVhbnVwKGNsZWFudXApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBjb250YWluZXIgPSBjcmVhdGVFbGVtZW50KHByb3BzLmlzU1ZHID8gXCJnXCIgOiBcImRpdlwiLCBwcm9wcy5pc1NWRyksXG4gICAgICAgIHJlbmRlclJvb3QgPSB1c2VTaGFkb3cgJiYgY29udGFpbmVyLmF0dGFjaFNoYWRvdyA/IGNvbnRhaW5lci5hdHRhY2hTaGFkb3coe1xuICAgICAgICAgIG1vZGU6IFwib3BlblwiXG4gICAgICAgIH0pIDogY29udGFpbmVyO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvbnRhaW5lciwgXCJfJGhvc3RcIiwge1xuICAgICAgICBnZXQoKSB7XG4gICAgICAgICAgcmV0dXJuIG1hcmtlci5wYXJlbnROb2RlO1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0pO1xuICAgICAgaW5zZXJ0KHJlbmRlclJvb3QsIGNvbnRlbnQpO1xuICAgICAgZWwuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcbiAgICAgIHByb3BzLnJlZiAmJiBwcm9wcy5yZWYoY29udGFpbmVyKTtcbiAgICAgIG9uQ2xlYW51cCgoKSA9PiBlbC5yZW1vdmVDaGlsZChjb250YWluZXIpKTtcbiAgICB9XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIHJlbmRlcjogIWh5ZHJhdGluZ1xuICB9KTtcbiAgcmV0dXJuIG1hcmtlcjtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUR5bmFtaWMoY29tcG9uZW50LCBwcm9wcykge1xuICBjb25zdCBjYWNoZWQgPSBjcmVhdGVNZW1vKGNvbXBvbmVudCk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBjb21wb25lbnQgPSBjYWNoZWQoKTtcbiAgICBzd2l0Y2ggKHR5cGVvZiBjb21wb25lbnQpIHtcbiAgICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgICBPYmplY3QuYXNzaWduKGNvbXBvbmVudCwge1xuICAgICAgICAgIFskREVWQ09NUF06IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB1bnRyYWNrKCgpID0+IGNvbXBvbmVudChwcm9wcykpO1xuICAgICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgICBjb25zdCBpc1N2ZyA9IFNWR0VsZW1lbnRzLmhhcyhjb21wb25lbnQpO1xuICAgICAgICBjb25zdCBlbCA9IHNoYXJlZENvbmZpZy5jb250ZXh0ID8gZ2V0TmV4dEVsZW1lbnQoKSA6IGNyZWF0ZUVsZW1lbnQoY29tcG9uZW50LCBpc1N2Zyk7XG4gICAgICAgIHNwcmVhZChlbCwgcHJvcHMsIGlzU3ZnKTtcbiAgICAgICAgcmV0dXJuIGVsO1xuICAgIH1cbiAgfSk7XG59XG5mdW5jdGlvbiBEeW5hbWljKHByb3BzKSB7XG4gIGNvbnN0IFssIG90aGVyc10gPSBzcGxpdFByb3BzKHByb3BzLCBbXCJjb21wb25lbnRcIl0pO1xuICByZXR1cm4gY3JlYXRlRHluYW1pYygoKSA9PiBwcm9wcy5jb21wb25lbnQsIG90aGVycyk7XG59XG5cbmV4cG9ydCB7IEFsaWFzZXMsIHZvaWRGbiBhcyBBc3NldHMsIENoaWxkUHJvcGVydGllcywgRE9NRWxlbWVudHMsIERlbGVnYXRlZEV2ZW50cywgRHluYW1pYywgSHlkcmF0aW9uLCB2b2lkRm4gYXMgSHlkcmF0aW9uU2NyaXB0LCBOb0h5ZHJhdGlvbiwgUG9ydGFsLCBQcm9wZXJ0aWVzLCBSZXF1ZXN0Q29udGV4dCwgU1ZHRWxlbWVudHMsIFNWR05hbWVzcGFjZSwgYWRkRXZlbnRMaXN0ZW5lciwgYXNzaWduLCBjbGFzc0xpc3QsIGNsYXNzTmFtZSwgY2xlYXJEZWxlZ2F0ZWRFdmVudHMsIGNyZWF0ZUR5bmFtaWMsIGRlbGVnYXRlRXZlbnRzLCBkeW5hbWljUHJvcGVydHksIGVzY2FwZSwgdm9pZEZuIGFzIGdlbmVyYXRlSHlkcmF0aW9uU2NyaXB0LCB2b2lkRm4gYXMgZ2V0QXNzZXRzLCBnZXRIeWRyYXRpb25LZXksIGdldE5leHRFbGVtZW50LCBnZXROZXh0TWFya2VyLCBnZXROZXh0TWF0Y2gsIGdldFByb3BBbGlhcywgdm9pZEZuIGFzIGdldFJlcXVlc3RFdmVudCwgaHlkcmF0ZSwgaW5uZXJIVE1MLCBpbnNlcnQsIGlzRGV2LCBpc1NlcnZlciwgbWVtbywgcmVuZGVyLCByZW5kZXJUb1N0cmVhbSwgcmVuZGVyVG9TdHJpbmcsIHJlbmRlclRvU3RyaW5nQXN5bmMsIHJlc29sdmVTU1JOb2RlLCBydW5IeWRyYXRpb25FdmVudHMsIHNldEF0dHJpYnV0ZSwgc2V0QXR0cmlidXRlTlMsIHNldEJvb2xBdHRyaWJ1dGUsIHNldFByb3BlcnR5LCBzcHJlYWQsIHNzciwgc3NyQXR0cmlidXRlLCBzc3JDbGFzc0xpc3QsIHNzckVsZW1lbnQsIHNzckh5ZHJhdGlvbktleSwgc3NyU3ByZWFkLCBzc3JTdHlsZSwgc3R5bGUsIHRlbXBsYXRlLCB1c2UsIHZvaWRGbiBhcyB1c2VBc3NldHMgfTtcbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsIi8vIEdlbmVyYXRlZCB1c2luZyBgbnBtIHJ1biBidWlsZGAuIERvIG5vdCBlZGl0LlxuXG52YXIgcmVnZXggPSAvXlthLXpdKD86W1xcLjAtOV9hLXpcXHhCN1xceEMwLVxceEQ2XFx4RDgtXFx4RjZcXHhGOC1cXHUwMzdEXFx1MDM3Ri1cXHUxRkZGXFx1MjAwQ1xcdTIwMERcXHUyMDNGXFx1MjA0MFxcdTIwNzAtXFx1MjE4RlxcdTJDMDAtXFx1MkZFRlxcdTMwMDEtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZGRF18W1xcdUQ4MDAtXFx1REI3Rl1bXFx1REMwMC1cXHVERkZGXSkqLSg/OltcXHgyRFxcLjAtOV9hLXpcXHhCN1xceEMwLVxceEQ2XFx4RDgtXFx4RjZcXHhGOC1cXHUwMzdEXFx1MDM3Ri1cXHUxRkZGXFx1MjAwQ1xcdTIwMERcXHUyMDNGXFx1MjA0MFxcdTIwNzAtXFx1MjE4RlxcdTJDMDAtXFx1MkZFRlxcdTMwMDEtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZGRF18W1xcdUQ4MDAtXFx1REI3Rl1bXFx1REMwMC1cXHVERkZGXSkqJC87XG5cbnZhciBpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lID0gZnVuY3Rpb24oc3RyaW5nKSB7XG5cdHJldHVybiByZWdleC50ZXN0KHN0cmluZyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWU7XG4iLCJ2YXIgX19hc3luYyA9IChfX3RoaXMsIF9fYXJndW1lbnRzLCBnZW5lcmF0b3IpID0+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICB2YXIgZnVsZmlsbGVkID0gKHZhbHVlKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciByZWplY3RlZCA9ICh2YWx1ZSkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgc3RlcChnZW5lcmF0b3IudGhyb3codmFsdWUpKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgfVxuICAgIH07XG4gICAgdmFyIHN0ZXAgPSAoeCkgPT4geC5kb25lID8gcmVzb2x2ZSh4LnZhbHVlKSA6IFByb21pc2UucmVzb2x2ZSh4LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpO1xuICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseShfX3RoaXMsIF9fYXJndW1lbnRzKSkubmV4dCgpKTtcbiAgfSk7XG59O1xuXG4vLyBzcmMvaW5kZXgudHNcbmltcG9ydCBpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lIGZyb20gXCJpcy1wb3RlbnRpYWwtY3VzdG9tLWVsZW1lbnQtbmFtZVwiO1xuZnVuY3Rpb24gY3JlYXRlSXNvbGF0ZWRFbGVtZW50KG9wdGlvbnMpIHtcbiAgcmV0dXJuIF9fYXN5bmModGhpcywgbnVsbCwgZnVuY3Rpb24qICgpIHtcbiAgICBjb25zdCB7IG5hbWUsIG1vZGUgPSBcImNsb3NlZFwiLCBjc3MsIGlzb2xhdGVFdmVudHMgPSBmYWxzZSB9ID0gb3B0aW9ucztcbiAgICBpZiAoIWlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUobmFtZSkpIHtcbiAgICAgIHRocm93IEVycm9yKFxuICAgICAgICBgXCIke25hbWV9XCIgaXMgbm90IGEgdmFsaWQgY3VzdG9tIGVsZW1lbnQgbmFtZS4gSXQgbXVzdCBiZSB0d28gd29yZHMgYW5kIGtlYmFiLWNhc2UsIHdpdGggYSBmZXcgZXhjZXB0aW9ucy4gU2VlIHNwZWMgZm9yIG1vcmUgZGV0YWlsczogaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2UvY3VzdG9tLWVsZW1lbnRzLmh0bWwjdmFsaWQtY3VzdG9tLWVsZW1lbnQtbmFtZWBcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IHBhcmVudEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KG5hbWUpO1xuICAgIGNvbnN0IHNoYWRvdyA9IHBhcmVudEVsZW1lbnQuYXR0YWNoU2hhZG93KHsgbW9kZSB9KTtcbiAgICBjb25zdCBpc29sYXRlZEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaHRtbFwiKTtcbiAgICBjb25zdCBib2R5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJvZHlcIik7XG4gICAgY29uc3QgaGVhZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJoZWFkXCIpO1xuICAgIGlmIChjc3MpIHtcbiAgICAgIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpO1xuICAgICAgaWYgKFwidXJsXCIgaW4gY3NzKSB7XG4gICAgICAgIHN0eWxlLnRleHRDb250ZW50ID0geWllbGQgZmV0Y2goY3NzLnVybCkudGhlbigocmVzKSA9PiByZXMudGV4dCgpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0eWxlLnRleHRDb250ZW50ID0gY3NzLnRleHRDb250ZW50O1xuICAgICAgfVxuICAgICAgaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7XG4gICAgfVxuICAgIGlzb2xhdGVkRWxlbWVudC5hcHBlbmRDaGlsZChoZWFkKTtcbiAgICBpc29sYXRlZEVsZW1lbnQuYXBwZW5kQ2hpbGQoYm9keSk7XG4gICAgc2hhZG93LmFwcGVuZENoaWxkKGlzb2xhdGVkRWxlbWVudCk7XG4gICAgaWYgKGlzb2xhdGVFdmVudHMpIHtcbiAgICAgIGNvbnN0IGV2ZW50VHlwZXMgPSBBcnJheS5pc0FycmF5KGlzb2xhdGVFdmVudHMpID8gaXNvbGF0ZUV2ZW50cyA6IFtcImtleWRvd25cIiwgXCJrZXl1cFwiLCBcImtleXByZXNzXCJdO1xuICAgICAgZXZlbnRUeXBlcy5mb3JFYWNoKChldmVudFR5cGUpID0+IHtcbiAgICAgICAgYm9keS5hZGRFdmVudExpc3RlbmVyKGV2ZW50VHlwZSwgKGUpID0+IGUuc3RvcFByb3BhZ2F0aW9uKCkpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBwYXJlbnRFbGVtZW50LFxuICAgICAgc2hhZG93LFxuICAgICAgaXNvbGF0ZWRFbGVtZW50OiBib2R5XG4gICAgfTtcbiAgfSk7XG59XG5leHBvcnQge1xuICBjcmVhdGVJc29sYXRlZEVsZW1lbnRcbn07XG4iLCJjb25zdCBudWxsS2V5ID0gU3ltYm9sKCdudWxsJyk7IC8vIGBvYmplY3RIYXNoZXNgIGtleSBmb3IgbnVsbFxuXG5sZXQga2V5Q291bnRlciA9IDA7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1hbnlLZXlzTWFwIGV4dGVuZHMgTWFwIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX29iamVjdEhhc2hlcyA9IG5ldyBXZWFrTWFwKCk7XG5cdFx0dGhpcy5fc3ltYm9sSGFzaGVzID0gbmV3IE1hcCgpOyAvLyBodHRwczovL2dpdGh1Yi5jb20vdGMzOS9lY21hMjYyL2lzc3Vlcy8xMTk0XG5cdFx0dGhpcy5fcHVibGljS2V5cyA9IG5ldyBNYXAoKTtcblxuXHRcdGNvbnN0IFtwYWlyc10gPSBhcmd1bWVudHM7IC8vIE1hcCBjb21wYXRcblx0XHRpZiAocGFpcnMgPT09IG51bGwgfHwgcGFpcnMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgcGFpcnNbU3ltYm9sLml0ZXJhdG9yXSAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcih0eXBlb2YgcGFpcnMgKyAnIGlzIG5vdCBpdGVyYWJsZSAoY2Fubm90IHJlYWQgcHJvcGVydHkgU3ltYm9sKFN5bWJvbC5pdGVyYXRvcikpJyk7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBba2V5cywgdmFsdWVdIG9mIHBhaXJzKSB7XG5cdFx0XHR0aGlzLnNldChrZXlzLCB2YWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0X2dldFB1YmxpY0tleXMoa2V5cywgY3JlYXRlID0gZmFsc2UpIHtcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoa2V5cykpIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBrZXlzIHBhcmFtZXRlciBtdXN0IGJlIGFuIGFycmF5Jyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJpdmF0ZUtleSA9IHRoaXMuX2dldFByaXZhdGVLZXkoa2V5cywgY3JlYXRlKTtcblxuXHRcdGxldCBwdWJsaWNLZXk7XG5cdFx0aWYgKHByaXZhdGVLZXkgJiYgdGhpcy5fcHVibGljS2V5cy5oYXMocHJpdmF0ZUtleSkpIHtcblx0XHRcdHB1YmxpY0tleSA9IHRoaXMuX3B1YmxpY0tleXMuZ2V0KHByaXZhdGVLZXkpO1xuXHRcdH0gZWxzZSBpZiAoY3JlYXRlKSB7XG5cdFx0XHRwdWJsaWNLZXkgPSBbLi4ua2V5c107IC8vIFJlZ2VuZXJhdGUga2V5cyBhcnJheSB0byBhdm9pZCBleHRlcm5hbCBpbnRlcmFjdGlvblxuXHRcdFx0dGhpcy5fcHVibGljS2V5cy5zZXQocHJpdmF0ZUtleSwgcHVibGljS2V5KTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge3ByaXZhdGVLZXksIHB1YmxpY0tleX07XG5cdH1cblxuXHRfZ2V0UHJpdmF0ZUtleShrZXlzLCBjcmVhdGUgPSBmYWxzZSkge1xuXHRcdGNvbnN0IHByaXZhdGVLZXlzID0gW107XG5cdFx0Zm9yIChsZXQga2V5IG9mIGtleXMpIHtcblx0XHRcdGlmIChrZXkgPT09IG51bGwpIHtcblx0XHRcdFx0a2V5ID0gbnVsbEtleTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaGFzaGVzID0gdHlwZW9mIGtleSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIGtleSA9PT0gJ2Z1bmN0aW9uJyA/ICdfb2JqZWN0SGFzaGVzJyA6ICh0eXBlb2Yga2V5ID09PSAnc3ltYm9sJyA/ICdfc3ltYm9sSGFzaGVzJyA6IGZhbHNlKTtcblxuXHRcdFx0aWYgKCFoYXNoZXMpIHtcblx0XHRcdFx0cHJpdmF0ZUtleXMucHVzaChrZXkpO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzW2hhc2hlc10uaGFzKGtleSkpIHtcblx0XHRcdFx0cHJpdmF0ZUtleXMucHVzaCh0aGlzW2hhc2hlc10uZ2V0KGtleSkpO1xuXHRcdFx0fSBlbHNlIGlmIChjcmVhdGUpIHtcblx0XHRcdFx0Y29uc3QgcHJpdmF0ZUtleSA9IGBAQG1rbS1yZWYtJHtrZXlDb3VudGVyKyt9QEBgO1xuXHRcdFx0XHR0aGlzW2hhc2hlc10uc2V0KGtleSwgcHJpdmF0ZUtleSk7XG5cdFx0XHRcdHByaXZhdGVLZXlzLnB1c2gocHJpdmF0ZUtleSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KHByaXZhdGVLZXlzKTtcblx0fVxuXG5cdHNldChrZXlzLCB2YWx1ZSkge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzLCB0cnVlKTtcblx0XHRyZXR1cm4gc3VwZXIuc2V0KHB1YmxpY0tleSwgdmFsdWUpO1xuXHR9XG5cblx0Z2V0KGtleXMpIHtcblx0XHRjb25zdCB7cHVibGljS2V5fSA9IHRoaXMuX2dldFB1YmxpY0tleXMoa2V5cyk7XG5cdFx0cmV0dXJuIHN1cGVyLmdldChwdWJsaWNLZXkpO1xuXHR9XG5cblx0aGFzKGtleXMpIHtcblx0XHRjb25zdCB7cHVibGljS2V5fSA9IHRoaXMuX2dldFB1YmxpY0tleXMoa2V5cyk7XG5cdFx0cmV0dXJuIHN1cGVyLmhhcyhwdWJsaWNLZXkpO1xuXHR9XG5cblx0ZGVsZXRlKGtleXMpIHtcblx0XHRjb25zdCB7cHVibGljS2V5LCBwcml2YXRlS2V5fSA9IHRoaXMuX2dldFB1YmxpY0tleXMoa2V5cyk7XG5cdFx0cmV0dXJuIEJvb2xlYW4ocHVibGljS2V5ICYmIHN1cGVyLmRlbGV0ZShwdWJsaWNLZXkpICYmIHRoaXMuX3B1YmxpY0tleXMuZGVsZXRlKHByaXZhdGVLZXkpKTtcblx0fVxuXG5cdGNsZWFyKCkge1xuXHRcdHN1cGVyLmNsZWFyKCk7XG5cdFx0dGhpcy5fc3ltYm9sSGFzaGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5fcHVibGljS2V5cy5jbGVhcigpO1xuXHR9XG5cblx0Z2V0IFtTeW1ib2wudG9TdHJpbmdUYWddKCkge1xuXHRcdHJldHVybiAnTWFueUtleXNNYXAnO1xuXHR9XG5cblx0Z2V0IHNpemUoKSB7XG5cdFx0cmV0dXJuIHN1cGVyLnNpemU7XG5cdH1cbn1cbiIsImZ1bmN0aW9uIGlzUGxhaW5PYmplY3QodmFsdWUpIHtcbiAgaWYgKHZhbHVlID09PSBudWxsIHx8IHR5cGVvZiB2YWx1ZSAhPT0gXCJvYmplY3RcIikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBwcm90b3R5cGUgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YodmFsdWUpO1xuICBpZiAocHJvdG90eXBlICE9PSBudWxsICYmIHByb3RvdHlwZSAhPT0gT2JqZWN0LnByb3RvdHlwZSAmJiBPYmplY3QuZ2V0UHJvdG90eXBlT2YocHJvdG90eXBlKSAhPT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoU3ltYm9sLml0ZXJhdG9yIGluIHZhbHVlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChTeW1ib2wudG9TdHJpbmdUYWcgaW4gdmFsdWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSA9PT0gXCJbb2JqZWN0IE1vZHVsZV1cIjtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gX2RlZnUoYmFzZU9iamVjdCwgZGVmYXVsdHMsIG5hbWVzcGFjZSA9IFwiLlwiLCBtZXJnZXIpIHtcbiAgaWYgKCFpc1BsYWluT2JqZWN0KGRlZmF1bHRzKSkge1xuICAgIHJldHVybiBfZGVmdShiYXNlT2JqZWN0LCB7fSwgbmFtZXNwYWNlLCBtZXJnZXIpO1xuICB9XG4gIGNvbnN0IG9iamVjdCA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRzKTtcbiAgZm9yIChjb25zdCBrZXkgaW4gYmFzZU9iamVjdCkge1xuICAgIGlmIChrZXkgPT09IFwiX19wcm90b19fXCIgfHwga2V5ID09PSBcImNvbnN0cnVjdG9yXCIpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZSA9IGJhc2VPYmplY3Rba2V5XTtcbiAgICBpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHZvaWQgMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChtZXJnZXIgJiYgbWVyZ2VyKG9iamVjdCwga2V5LCB2YWx1ZSwgbmFtZXNwYWNlKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSAmJiBBcnJheS5pc0FycmF5KG9iamVjdFtrZXldKSkge1xuICAgICAgb2JqZWN0W2tleV0gPSBbLi4udmFsdWUsIC4uLm9iamVjdFtrZXldXTtcbiAgICB9IGVsc2UgaWYgKGlzUGxhaW5PYmplY3QodmFsdWUpICYmIGlzUGxhaW5PYmplY3Qob2JqZWN0W2tleV0pKSB7XG4gICAgICBvYmplY3Rba2V5XSA9IF9kZWZ1KFxuICAgICAgICB2YWx1ZSxcbiAgICAgICAgb2JqZWN0W2tleV0sXG4gICAgICAgIChuYW1lc3BhY2UgPyBgJHtuYW1lc3BhY2V9LmAgOiBcIlwiKSArIGtleS50b1N0cmluZygpLFxuICAgICAgICBtZXJnZXJcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9iamVjdFtrZXldID0gdmFsdWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBvYmplY3Q7XG59XG5mdW5jdGlvbiBjcmVhdGVEZWZ1KG1lcmdlcikge1xuICByZXR1cm4gKC4uLmFyZ3VtZW50c18pID0+IChcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgdW5pY29ybi9uby1hcnJheS1yZWR1Y2VcbiAgICBhcmd1bWVudHNfLnJlZHVjZSgocCwgYykgPT4gX2RlZnUocCwgYywgXCJcIiwgbWVyZ2VyKSwge30pXG4gICk7XG59XG5jb25zdCBkZWZ1ID0gY3JlYXRlRGVmdSgpO1xuY29uc3QgZGVmdUZuID0gY3JlYXRlRGVmdSgob2JqZWN0LCBrZXksIGN1cnJlbnRWYWx1ZSkgPT4ge1xuICBpZiAob2JqZWN0W2tleV0gIT09IHZvaWQgMCAmJiB0eXBlb2YgY3VycmVudFZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBvYmplY3Rba2V5XSA9IGN1cnJlbnRWYWx1ZShvYmplY3Rba2V5XSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn0pO1xuY29uc3QgZGVmdUFycmF5Rm4gPSBjcmVhdGVEZWZ1KChvYmplY3QsIGtleSwgY3VycmVudFZhbHVlKSA9PiB7XG4gIGlmIChBcnJheS5pc0FycmF5KG9iamVjdFtrZXldKSAmJiB0eXBlb2YgY3VycmVudFZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBvYmplY3Rba2V5XSA9IGN1cnJlbnRWYWx1ZShvYmplY3Rba2V5XSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn0pO1xuXG5leHBvcnQgeyBjcmVhdGVEZWZ1LCBkZWZ1IGFzIGRlZmF1bHQsIGRlZnUsIGRlZnVBcnJheUZuLCBkZWZ1Rm4gfTtcbiIsImNvbnN0IGlzRXhpc3QgPSAoZWxlbWVudCkgPT4ge1xuICByZXR1cm4gZWxlbWVudCAhPT0gbnVsbCA/IHsgaXNEZXRlY3RlZDogdHJ1ZSwgcmVzdWx0OiBlbGVtZW50IH0gOiB7IGlzRGV0ZWN0ZWQ6IGZhbHNlIH07XG59O1xuY29uc3QgaXNOb3RFeGlzdCA9IChlbGVtZW50KSA9PiB7XG4gIHJldHVybiBlbGVtZW50ID09PSBudWxsID8geyBpc0RldGVjdGVkOiB0cnVlLCByZXN1bHQ6IG51bGwgfSA6IHsgaXNEZXRlY3RlZDogZmFsc2UgfTtcbn07XG5cbmV4cG9ydCB7IGlzRXhpc3QsIGlzTm90RXhpc3QgfTtcbiIsImltcG9ydCBNYW55S2V5c01hcCBmcm9tICdtYW55LWtleXMtbWFwJztcbmltcG9ydCB7IGRlZnUgfSBmcm9tICdkZWZ1JztcbmltcG9ydCB7IGlzRXhpc3QgfSBmcm9tICcuL2RldGVjdG9ycy5tanMnO1xuXG5jb25zdCBnZXREZWZhdWx0T3B0aW9ucyA9ICgpID0+ICh7XG4gIHRhcmdldDogZ2xvYmFsVGhpcy5kb2N1bWVudCxcbiAgdW5pZnlQcm9jZXNzOiB0cnVlLFxuICBkZXRlY3RvcjogaXNFeGlzdCxcbiAgb2JzZXJ2ZUNvbmZpZ3M6IHtcbiAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgc3VidHJlZTogdHJ1ZSxcbiAgICBhdHRyaWJ1dGVzOiB0cnVlXG4gIH0sXG4gIHNpZ25hbDogdm9pZCAwLFxuICBjdXN0b21NYXRjaGVyOiB2b2lkIDBcbn0pO1xuY29uc3QgbWVyZ2VPcHRpb25zID0gKHVzZXJTaWRlT3B0aW9ucywgZGVmYXVsdE9wdGlvbnMpID0+IHtcbiAgcmV0dXJuIGRlZnUodXNlclNpZGVPcHRpb25zLCBkZWZhdWx0T3B0aW9ucyk7XG59O1xuXG5jb25zdCB1bmlmeUNhY2hlID0gbmV3IE1hbnlLZXlzTWFwKCk7XG5mdW5jdGlvbiBjcmVhdGVXYWl0RWxlbWVudChpbnN0YW5jZU9wdGlvbnMpIHtcbiAgY29uc3QgeyBkZWZhdWx0T3B0aW9ucyB9ID0gaW5zdGFuY2VPcHRpb25zO1xuICByZXR1cm4gKHNlbGVjdG9yLCBvcHRpb25zKSA9PiB7XG4gICAgY29uc3Qge1xuICAgICAgdGFyZ2V0LFxuICAgICAgdW5pZnlQcm9jZXNzLFxuICAgICAgb2JzZXJ2ZUNvbmZpZ3MsXG4gICAgICBkZXRlY3RvcixcbiAgICAgIHNpZ25hbCxcbiAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICB9ID0gbWVyZ2VPcHRpb25zKG9wdGlvbnMsIGRlZmF1bHRPcHRpb25zKTtcbiAgICBjb25zdCB1bmlmeVByb21pc2VLZXkgPSBbXG4gICAgICBzZWxlY3RvcixcbiAgICAgIHRhcmdldCxcbiAgICAgIHVuaWZ5UHJvY2VzcyxcbiAgICAgIG9ic2VydmVDb25maWdzLFxuICAgICAgZGV0ZWN0b3IsXG4gICAgICBzaWduYWwsXG4gICAgICBjdXN0b21NYXRjaGVyXG4gICAgXTtcbiAgICBjb25zdCBjYWNoZWRQcm9taXNlID0gdW5pZnlDYWNoZS5nZXQodW5pZnlQcm9taXNlS2V5KTtcbiAgICBpZiAodW5pZnlQcm9jZXNzICYmIGNhY2hlZFByb21pc2UpIHtcbiAgICAgIHJldHVybiBjYWNoZWRQcm9taXNlO1xuICAgIH1cbiAgICBjb25zdCBkZXRlY3RQcm9taXNlID0gbmV3IFByb21pc2UoXG4gICAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQXN5bmNQcm9taXNlRXhlY3V0b3I6IGF2b2lkIG5lc3RpbmcgcHJvbWlzZVxuICAgICAgYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAoc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChzaWduYWwucmVhc29uKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKFxuICAgICAgICAgIGFzeW5jIChtdXRhdGlvbnMpID0+IHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgXyBvZiBtdXRhdGlvbnMpIHtcbiAgICAgICAgICAgICAgaWYgKHNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb25zdCBkZXRlY3RSZXN1bHQyID0gYXdhaXQgZGV0ZWN0RWxlbWVudCh7XG4gICAgICAgICAgICAgICAgc2VsZWN0b3IsXG4gICAgICAgICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgICAgICAgIGRldGVjdG9yLFxuICAgICAgICAgICAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGlmIChkZXRlY3RSZXN1bHQyLmlzRGV0ZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShkZXRlY3RSZXN1bHQyLnJlc3VsdCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICAgIHNpZ25hbD8uYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICBcImFib3J0XCIsXG4gICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChzaWduYWwucmVhc29uKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHsgb25jZTogdHJ1ZSB9XG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IGRldGVjdFJlc3VsdCA9IGF3YWl0IGRldGVjdEVsZW1lbnQoe1xuICAgICAgICAgIHNlbGVjdG9yLFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICBkZXRlY3RvcixcbiAgICAgICAgICBjdXN0b21NYXRjaGVyXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoZGV0ZWN0UmVzdWx0LmlzRGV0ZWN0ZWQpIHtcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZShkZXRlY3RSZXN1bHQucmVzdWx0KTtcbiAgICAgICAgfVxuICAgICAgICBvYnNlcnZlci5vYnNlcnZlKHRhcmdldCwgb2JzZXJ2ZUNvbmZpZ3MpO1xuICAgICAgfVxuICAgICkuZmluYWxseSgoKSA9PiB7XG4gICAgICB1bmlmeUNhY2hlLmRlbGV0ZSh1bmlmeVByb21pc2VLZXkpO1xuICAgIH0pO1xuICAgIHVuaWZ5Q2FjaGUuc2V0KHVuaWZ5UHJvbWlzZUtleSwgZGV0ZWN0UHJvbWlzZSk7XG4gICAgcmV0dXJuIGRldGVjdFByb21pc2U7XG4gIH07XG59XG5hc3luYyBmdW5jdGlvbiBkZXRlY3RFbGVtZW50KHtcbiAgdGFyZ2V0LFxuICBzZWxlY3RvcixcbiAgZGV0ZWN0b3IsXG4gIGN1c3RvbU1hdGNoZXJcbn0pIHtcbiAgY29uc3QgZWxlbWVudCA9IGN1c3RvbU1hdGNoZXIgPyBjdXN0b21NYXRjaGVyKHNlbGVjdG9yKSA6IHRhcmdldC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgcmV0dXJuIGF3YWl0IGRldGVjdG9yKGVsZW1lbnQpO1xufVxuY29uc3Qgd2FpdEVsZW1lbnQgPSBjcmVhdGVXYWl0RWxlbWVudCh7XG4gIGRlZmF1bHRPcHRpb25zOiBnZXREZWZhdWx0T3B0aW9ucygpXG59KTtcblxuZXhwb3J0IHsgY3JlYXRlV2FpdEVsZW1lbnQsIGdldERlZmF1bHRPcHRpb25zLCB3YWl0RWxlbWVudCB9O1xuIiwiZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG4gIGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcbiAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGFyZ3Muc2hpZnQoKTtcbiAgICBtZXRob2QoYFt3eHRdICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcbiAgfSBlbHNlIHtcbiAgICBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbiAgfVxufVxuZXhwb3J0IGNvbnN0IGxvZ2dlciA9IHtcbiAgZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcbiAgbG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuICB3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcbiAgZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbiIsImltcG9ydCB7IHdhaXRFbGVtZW50IH0gZnJvbSBcIkAxbmF0c3Uvd2FpdC1lbGVtZW50XCI7XG5pbXBvcnQge1xuICBpc0V4aXN0IGFzIG1vdW50RGV0ZWN0b3IsXG4gIGlzTm90RXhpc3QgYXMgcmVtb3ZlRGV0ZWN0b3Jcbn0gZnJvbSBcIkAxbmF0c3Uvd2FpdC1lbGVtZW50L2RldGVjdG9yc1wiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBhcHBseVBvc2l0aW9uKHJvb3QsIHBvc2l0aW9uZWRFbGVtZW50LCBvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zLnBvc2l0aW9uID09PSBcImlubGluZVwiKSByZXR1cm47XG4gIGlmIChvcHRpb25zLnpJbmRleCAhPSBudWxsKSByb290LnN0eWxlLnpJbmRleCA9IFN0cmluZyhvcHRpb25zLnpJbmRleCk7XG4gIHJvb3Quc3R5bGUub3ZlcmZsb3cgPSBcInZpc2libGVcIjtcbiAgcm9vdC5zdHlsZS5wb3NpdGlvbiA9IFwicmVsYXRpdmVcIjtcbiAgcm9vdC5zdHlsZS53aWR0aCA9IFwiMFwiO1xuICByb290LnN0eWxlLmhlaWdodCA9IFwiMFwiO1xuICByb290LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gIGlmIChwb3NpdGlvbmVkRWxlbWVudCkge1xuICAgIGlmIChvcHRpb25zLnBvc2l0aW9uID09PSBcIm92ZXJsYXlcIikge1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImFic29sdXRlXCI7XG4gICAgICBpZiAob3B0aW9ucy5hbGlnbm1lbnQ/LnN0YXJ0c1dpdGgoXCJib3R0b20tXCIpKVxuICAgICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5ib3R0b20gPSBcIjBcIjtcbiAgICAgIGVsc2UgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUudG9wID0gXCIwXCI7XG4gICAgICBpZiAob3B0aW9ucy5hbGlnbm1lbnQ/LmVuZHNXaXRoKFwiLXJpZ2h0XCIpKVxuICAgICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMFwiO1xuICAgICAgZWxzZSBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5sZWZ0ID0gXCIwXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUudG9wID0gXCIwXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5ib3R0b20gPSBcIjBcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmxlZnQgPSBcIjBcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIwXCI7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0QW5jaG9yKG9wdGlvbnMpIHtcbiAgaWYgKG9wdGlvbnMuYW5jaG9yID09IG51bGwpIHJldHVybiBkb2N1bWVudC5ib2R5O1xuICBsZXQgcmVzb2x2ZWQgPSB0eXBlb2Ygb3B0aW9ucy5hbmNob3IgPT09IFwiZnVuY3Rpb25cIiA/IG9wdGlvbnMuYW5jaG9yKCkgOiBvcHRpb25zLmFuY2hvcjtcbiAgaWYgKHR5cGVvZiByZXNvbHZlZCA9PT0gXCJzdHJpbmdcIikge1xuICAgIGlmIChyZXNvbHZlZC5zdGFydHNXaXRoKFwiL1wiKSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gZG9jdW1lbnQuZXZhbHVhdGUoXG4gICAgICAgIHJlc29sdmVkLFxuICAgICAgICBkb2N1bWVudCxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgWFBhdGhSZXN1bHQuRklSU1RfT1JERVJFRF9OT0RFX1RZUEUsXG4gICAgICAgIG51bGxcbiAgICAgICk7XG4gICAgICByZXR1cm4gcmVzdWx0LnNpbmdsZU5vZGVWYWx1ZSA/PyB2b2lkIDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHJlc29sdmVkKSA/PyB2b2lkIDA7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXNvbHZlZCA/PyB2b2lkIDA7XG59XG5leHBvcnQgZnVuY3Rpb24gbW91bnRVaShyb290LCBvcHRpb25zKSB7XG4gIGNvbnN0IGFuY2hvciA9IGdldEFuY2hvcihvcHRpb25zKTtcbiAgaWYgKGFuY2hvciA9PSBudWxsKVxuICAgIHRocm93IEVycm9yKFxuICAgICAgXCJGYWlsZWQgdG8gbW91bnQgY29udGVudCBzY3JpcHQgVUk6IGNvdWxkIG5vdCBmaW5kIGFuY2hvciBlbGVtZW50XCJcbiAgICApO1xuICBzd2l0Y2ggKG9wdGlvbnMuYXBwZW5kKSB7XG4gICAgY2FzZSB2b2lkIDA6XG4gICAgY2FzZSBcImxhc3RcIjpcbiAgICAgIGFuY2hvci5hcHBlbmQocm9vdCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiZmlyc3RcIjpcbiAgICAgIGFuY2hvci5wcmVwZW5kKHJvb3QpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcInJlcGxhY2VcIjpcbiAgICAgIGFuY2hvci5yZXBsYWNlV2l0aChyb290KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJhZnRlclwiOlxuICAgICAgYW5jaG9yLnBhcmVudEVsZW1lbnQ/Lmluc2VydEJlZm9yZShyb290LCBhbmNob3IubmV4dEVsZW1lbnRTaWJsaW5nKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJiZWZvcmVcIjpcbiAgICAgIGFuY2hvci5wYXJlbnRFbGVtZW50Py5pbnNlcnRCZWZvcmUocm9vdCwgYW5jaG9yKTtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICBvcHRpb25zLmFwcGVuZChhbmNob3IsIHJvb3QpO1xuICAgICAgYnJlYWs7XG4gIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNb3VudEZ1bmN0aW9ucyhiYXNlRnVuY3Rpb25zLCBvcHRpb25zKSB7XG4gIGxldCBhdXRvTW91bnRJbnN0YW5jZSA9IHZvaWQgMDtcbiAgY29uc3Qgc3RvcEF1dG9Nb3VudCA9ICgpID0+IHtcbiAgICBhdXRvTW91bnRJbnN0YW5jZT8uc3RvcEF1dG9Nb3VudCgpO1xuICAgIGF1dG9Nb3VudEluc3RhbmNlID0gdm9pZCAwO1xuICB9O1xuICBjb25zdCBtb3VudCA9ICgpID0+IHtcbiAgICBiYXNlRnVuY3Rpb25zLm1vdW50KCk7XG4gIH07XG4gIGNvbnN0IHVubW91bnQgPSBiYXNlRnVuY3Rpb25zLnJlbW92ZTtcbiAgY29uc3QgcmVtb3ZlID0gKCkgPT4ge1xuICAgIHN0b3BBdXRvTW91bnQoKTtcbiAgICBiYXNlRnVuY3Rpb25zLnJlbW92ZSgpO1xuICB9O1xuICBjb25zdCBhdXRvTW91bnQgPSAoYXV0b01vdW50T3B0aW9ucykgPT4ge1xuICAgIGlmIChhdXRvTW91bnRJbnN0YW5jZSkge1xuICAgICAgbG9nZ2VyLndhcm4oXCJhdXRvTW91bnQgaXMgYWxyZWFkeSBzZXQuXCIpO1xuICAgIH1cbiAgICBhdXRvTW91bnRJbnN0YW5jZSA9IGF1dG9Nb3VudFVpKFxuICAgICAgeyBtb3VudCwgdW5tb3VudCwgc3RvcEF1dG9Nb3VudCB9LFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAuLi5hdXRvTW91bnRPcHRpb25zXG4gICAgICB9XG4gICAgKTtcbiAgfTtcbiAgcmV0dXJuIHtcbiAgICBtb3VudCxcbiAgICByZW1vdmUsXG4gICAgYXV0b01vdW50XG4gIH07XG59XG5mdW5jdGlvbiBhdXRvTW91bnRVaSh1aUNhbGxiYWNrcywgb3B0aW9ucykge1xuICBjb25zdCBhYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gIGNvbnN0IEVYUExJQ0lUX1NUT1BfUkVBU09OID0gXCJleHBsaWNpdF9zdG9wX2F1dG9fbW91bnRcIjtcbiAgY29uc3QgX3N0b3BBdXRvTW91bnQgPSAoKSA9PiB7XG4gICAgYWJvcnRDb250cm9sbGVyLmFib3J0KEVYUExJQ0lUX1NUT1BfUkVBU09OKTtcbiAgICBvcHRpb25zLm9uU3RvcD8uKCk7XG4gIH07XG4gIGxldCByZXNvbHZlZEFuY2hvciA9IHR5cGVvZiBvcHRpb25zLmFuY2hvciA9PT0gXCJmdW5jdGlvblwiID8gb3B0aW9ucy5hbmNob3IoKSA6IG9wdGlvbnMuYW5jaG9yO1xuICBpZiAocmVzb2x2ZWRBbmNob3IgaW5zdGFuY2VvZiBFbGVtZW50KSB7XG4gICAgdGhyb3cgRXJyb3IoXG4gICAgICBcImF1dG9Nb3VudCBhbmQgRWxlbWVudCBhbmNob3Igb3B0aW9uIGNhbm5vdCBiZSBjb21iaW5lZC4gQXZvaWQgcGFzc2luZyBgRWxlbWVudGAgZGlyZWN0bHkgb3IgYCgpID0+IEVsZW1lbnRgIHRvIHRoZSBhbmNob3IuXCJcbiAgICApO1xuICB9XG4gIGFzeW5jIGZ1bmN0aW9uIG9ic2VydmVFbGVtZW50KHNlbGVjdG9yKSB7XG4gICAgbGV0IGlzQW5jaG9yRXhpc3QgPSAhIWdldEFuY2hvcihvcHRpb25zKTtcbiAgICBpZiAoaXNBbmNob3JFeGlzdCkge1xuICAgICAgdWlDYWxsYmFja3MubW91bnQoKTtcbiAgICB9XG4gICAgd2hpbGUgKCFhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNoYW5nZWRBbmNob3IgPSBhd2FpdCB3YWl0RWxlbWVudChzZWxlY3RvciA/PyBcImJvZHlcIiwge1xuICAgICAgICAgIGN1c3RvbU1hdGNoZXI6ICgpID0+IGdldEFuY2hvcihvcHRpb25zKSA/PyBudWxsLFxuICAgICAgICAgIGRldGVjdG9yOiBpc0FuY2hvckV4aXN0ID8gcmVtb3ZlRGV0ZWN0b3IgOiBtb3VudERldGVjdG9yLFxuICAgICAgICAgIHNpZ25hbDogYWJvcnRDb250cm9sbGVyLnNpZ25hbFxuICAgICAgICB9KTtcbiAgICAgICAgaXNBbmNob3JFeGlzdCA9ICEhY2hhbmdlZEFuY2hvcjtcbiAgICAgICAgaWYgKGlzQW5jaG9yRXhpc3QpIHtcbiAgICAgICAgICB1aUNhbGxiYWNrcy5tb3VudCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHVpQ2FsbGJhY2tzLnVubW91bnQoKTtcbiAgICAgICAgICBpZiAob3B0aW9ucy5vbmNlKSB7XG4gICAgICAgICAgICB1aUNhbGxiYWNrcy5zdG9wQXV0b01vdW50KCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkICYmIGFib3J0Q29udHJvbGxlci5zaWduYWwucmVhc29uID09PSBFWFBMSUNJVF9TVE9QX1JFQVNPTikge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIG9ic2VydmVFbGVtZW50KHJlc29sdmVkQW5jaG9yKTtcbiAgcmV0dXJuIHsgc3RvcEF1dG9Nb3VudDogX3N0b3BBdXRvTW91bnQgfTtcbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBzcGxpdFNoYWRvd1Jvb3RDc3MoY3NzKSB7XG4gIGxldCBzaGFkb3dDc3MgPSBjc3M7XG4gIGxldCBkb2N1bWVudENzcyA9IFwiXCI7XG4gIGNvbnN0IHJ1bGVzUmVnZXggPSAvKFxccypAKHByb3BlcnR5fGZvbnQtZmFjZSlbXFxzXFxTXSo/e1tcXHNcXFNdKj99KS9nbTtcbiAgbGV0IG1hdGNoO1xuICB3aGlsZSAoKG1hdGNoID0gcnVsZXNSZWdleC5leGVjKGNzcykpICE9PSBudWxsKSB7XG4gICAgZG9jdW1lbnRDc3MgKz0gbWF0Y2hbMV07XG4gICAgc2hhZG93Q3NzID0gc2hhZG93Q3NzLnJlcGxhY2UobWF0Y2hbMV0sIFwiXCIpO1xuICB9XG4gIHJldHVybiB7XG4gICAgZG9jdW1lbnRDc3M6IGRvY3VtZW50Q3NzLnRyaW0oKSxcbiAgICBzaGFkb3dDc3M6IHNoYWRvd0Nzcy50cmltKClcbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGNyZWF0ZUlzb2xhdGVkRWxlbWVudCB9IGZyb20gXCJAd2ViZXh0LWNvcmUvaXNvbGF0ZWQtZWxlbWVudFwiO1xuaW1wb3J0IHsgYXBwbHlQb3NpdGlvbiwgY3JlYXRlTW91bnRGdW5jdGlvbnMsIG1vdW50VWkgfSBmcm9tIFwiLi9zaGFyZWQubWpzXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHsgc3BsaXRTaGFkb3dSb290Q3NzIH0gZnJvbSBcIi4uL3NwbGl0LXNoYWRvdy1yb290LWNzcy5tanNcIjtcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVTaGFkb3dSb290VWkoY3R4LCBvcHRpb25zKSB7XG4gIGNvbnN0IGluc3RhbmNlSWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoMiwgMTUpO1xuICBjb25zdCBjc3MgPSBbXTtcbiAgaWYgKCFvcHRpb25zLmluaGVyaXRTdHlsZXMpIHtcbiAgICBjc3MucHVzaChgLyogV1hUIFNoYWRvdyBSb290IFJlc2V0ICovIDpob3N0e2FsbDppbml0aWFsICFpbXBvcnRhbnQ7fWApO1xuICB9XG4gIGlmIChvcHRpb25zLmNzcykge1xuICAgIGNzcy5wdXNoKG9wdGlvbnMuY3NzKTtcbiAgfVxuICBpZiAoY3R4Lm9wdGlvbnM/LmNzc0luamVjdGlvbk1vZGUgPT09IFwidWlcIikge1xuICAgIGNvbnN0IGVudHJ5Q3NzID0gYXdhaXQgbG9hZENzcygpO1xuICAgIGNzcy5wdXNoKGVudHJ5Q3NzLnJlcGxhY2VBbGwoXCI6cm9vdFwiLCBcIjpob3N0XCIpKTtcbiAgfVxuICBjb25zdCB7IHNoYWRvd0NzcywgZG9jdW1lbnRDc3MgfSA9IHNwbGl0U2hhZG93Um9vdENzcyhjc3Muam9pbihcIlxcblwiKS50cmltKCkpO1xuICBjb25zdCB7XG4gICAgaXNvbGF0ZWRFbGVtZW50OiB1aUNvbnRhaW5lcixcbiAgICBwYXJlbnRFbGVtZW50OiBzaGFkb3dIb3N0LFxuICAgIHNoYWRvd1xuICB9ID0gYXdhaXQgY3JlYXRlSXNvbGF0ZWRFbGVtZW50KHtcbiAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgY3NzOiB7XG4gICAgICB0ZXh0Q29udGVudDogc2hhZG93Q3NzXG4gICAgfSxcbiAgICBtb2RlOiBvcHRpb25zLm1vZGUgPz8gXCJvcGVuXCIsXG4gICAgaXNvbGF0ZUV2ZW50czogb3B0aW9ucy5pc29sYXRlRXZlbnRzXG4gIH0pO1xuICBzaGFkb3dIb3N0LnNldEF0dHJpYnV0ZShcImRhdGEtd3h0LXNoYWRvdy1yb290XCIsIFwiXCIpO1xuICBsZXQgbW91bnRlZDtcbiAgY29uc3QgbW91bnQgPSAoKSA9PiB7XG4gICAgbW91bnRVaShzaGFkb3dIb3N0LCBvcHRpb25zKTtcbiAgICBhcHBseVBvc2l0aW9uKHNoYWRvd0hvc3QsIHNoYWRvdy5xdWVyeVNlbGVjdG9yKFwiaHRtbFwiKSwgb3B0aW9ucyk7XG4gICAgaWYgKGRvY3VtZW50Q3NzICYmICFkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFxuICAgICAgYHN0eWxlW3d4dC1zaGFkb3ctcm9vdC1kb2N1bWVudC1zdHlsZXM9XCIke2luc3RhbmNlSWR9XCJdYFxuICAgICkpIHtcbiAgICAgIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpO1xuICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSBkb2N1bWVudENzcztcbiAgICAgIHN0eWxlLnNldEF0dHJpYnV0ZShcInd4dC1zaGFkb3ctcm9vdC1kb2N1bWVudC1zdHlsZXNcIiwgaW5zdGFuY2VJZCk7XG4gICAgICAoZG9jdW1lbnQuaGVhZCA/PyBkb2N1bWVudC5ib2R5KS5hcHBlbmQoc3R5bGUpO1xuICAgIH1cbiAgICBtb3VudGVkID0gb3B0aW9ucy5vbk1vdW50KHVpQ29udGFpbmVyLCBzaGFkb3csIHNoYWRvd0hvc3QpO1xuICB9O1xuICBjb25zdCByZW1vdmUgPSAoKSA9PiB7XG4gICAgb3B0aW9ucy5vblJlbW92ZT8uKG1vdW50ZWQpO1xuICAgIHNoYWRvd0hvc3QucmVtb3ZlKCk7XG4gICAgY29uc3QgZG9jdW1lbnRTdHlsZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXG4gICAgICBgc3R5bGVbd3h0LXNoYWRvdy1yb290LWRvY3VtZW50LXN0eWxlcz1cIiR7aW5zdGFuY2VJZH1cIl1gXG4gICAgKTtcbiAgICBkb2N1bWVudFN0eWxlPy5yZW1vdmUoKTtcbiAgICB3aGlsZSAodWlDb250YWluZXIubGFzdENoaWxkKVxuICAgICAgdWlDb250YWluZXIucmVtb3ZlQ2hpbGQodWlDb250YWluZXIubGFzdENoaWxkKTtcbiAgICBtb3VudGVkID0gdm9pZCAwO1xuICB9O1xuICBjb25zdCBtb3VudEZ1bmN0aW9ucyA9IGNyZWF0ZU1vdW50RnVuY3Rpb25zKFxuICAgIHtcbiAgICAgIG1vdW50LFxuICAgICAgcmVtb3ZlXG4gICAgfSxcbiAgICBvcHRpb25zXG4gICk7XG4gIGN0eC5vbkludmFsaWRhdGVkKHJlbW92ZSk7XG4gIHJldHVybiB7XG4gICAgc2hhZG93LFxuICAgIHNoYWRvd0hvc3QsXG4gICAgdWlDb250YWluZXIsXG4gICAgLi4ubW91bnRGdW5jdGlvbnMsXG4gICAgZ2V0IG1vdW50ZWQoKSB7XG4gICAgICByZXR1cm4gbW91bnRlZDtcbiAgICB9XG4gIH07XG59XG5hc3luYyBmdW5jdGlvbiBsb2FkQ3NzKCkge1xuICBjb25zdCB1cmwgPSBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKGAvY29udGVudC1zY3JpcHRzLyR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9LmNzc2ApO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCk7XG4gICAgcmV0dXJuIGF3YWl0IHJlcy50ZXh0KCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGxvZ2dlci53YXJuKFxuICAgICAgYEZhaWxlZCB0byBsb2FkIHN0eWxlcyBAICR7dXJsfS4gRGlkIHlvdSBmb3JnZXQgdG8gaW1wb3J0IHRoZSBzdHlsZXNoZWV0IGluIHlvdXIgZW50cnlwb2ludD9gLFxuICAgICAgZXJyXG4gICAgKTtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUNvbnRlbnRTY3JpcHQoZGVmaW5pdGlvbikge1xuICByZXR1cm4gZGVmaW5pdGlvbjtcbn1cbiIsImZ1bmN0aW9uIHIoZSl7dmFyIHQsZixuPVwiXCI7aWYoXCJzdHJpbmdcIj09dHlwZW9mIGV8fFwibnVtYmVyXCI9PXR5cGVvZiBlKW4rPWU7ZWxzZSBpZihcIm9iamVjdFwiPT10eXBlb2YgZSlpZihBcnJheS5pc0FycmF5KGUpKXt2YXIgbz1lLmxlbmd0aDtmb3IodD0wO3Q8bzt0KyspZVt0XSYmKGY9cihlW3RdKSkmJihuJiYobis9XCIgXCIpLG4rPWYpfWVsc2UgZm9yKGYgaW4gZSllW2ZdJiYobiYmKG4rPVwiIFwiKSxuKz1mKTtyZXR1cm4gbn1leHBvcnQgZnVuY3Rpb24gY2xzeCgpe2Zvcih2YXIgZSx0LGY9MCxuPVwiXCIsbz1hcmd1bWVudHMubGVuZ3RoO2Y8bztmKyspKGU9YXJndW1lbnRzW2ZdKSYmKHQ9cihlKSkmJihuJiYobis9XCIgXCIpLG4rPXQpO3JldHVybiBufWV4cG9ydCBkZWZhdWx0IGNsc3g7IiwiaW1wb3J0IHsgY2xzeCwgdHlwZSBDbGFzc1ZhbHVlIH0gZnJvbSAnY2xzeCdcblxuZXhwb3J0IGZ1bmN0aW9uIGNuKC4uLmlucHV0czogQ2xhc3NWYWx1ZVtdKSB7XG4gIHJldHVybiBjbHN4KGlucHV0cylcbn0iLCJpbXBvcnQgeyBTaG93LCBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCwgSlNYIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGVhZGVyUHJvcHMge1xuICB0aXRsZT86IHN0cmluZztcbiAgbG9nbz86IEpTWC5FbGVtZW50O1xuICBhY3Rpb25zPzogSlNYLkVsZW1lbnQ7XG4gIHZhcmlhbnQ/OiAnZGVmYXVsdCcgfCAnbWluaW1hbCcgfCAndHJhbnNwYXJlbnQnO1xuICBzdGlja3k/OiBib29sZWFuO1xuICBzaG93TWVudUJ1dHRvbj86IGJvb2xlYW47XG4gIG9uTWVudUNsaWNrPzogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBIZWFkZXI6IENvbXBvbmVudDxIZWFkZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2lzU2Nyb2xsZWQsIHNldElzU2Nyb2xsZWRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcblxuICAvLyBUcmFjayBzY3JvbGwgcG9zaXRpb24gZm9yIHN0aWNreSBoZWFkZXIgZWZmZWN0c1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgcHJvcHMuc3RpY2t5KSB7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsICgpID0+IHtcbiAgICAgIHNldElzU2Nyb2xsZWQod2luZG93LnNjcm9sbFkgPiAxMCk7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCB2YXJpYW50ID0gKCkgPT4gcHJvcHMudmFyaWFudCB8fCAnZGVmYXVsdCc7XG5cbiAgcmV0dXJuIChcbiAgICA8aGVhZGVyXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICd3LWZ1bGwgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMjAwJyxcbiAgICAgICAge1xuICAgICAgICAgIC8vIFZhcmlhbnRzXG4gICAgICAgICAgJ2JnLXN1cmZhY2UgYm9yZGVyLWIgYm9yZGVyLXN1YnRsZSc6IHZhcmlhbnQoKSA9PT0gJ2RlZmF1bHQnLFxuICAgICAgICAgICdiZy10cmFuc3BhcmVudCc6IHZhcmlhbnQoKSA9PT0gJ21pbmltYWwnIHx8IHZhcmlhbnQoKSA9PT0gJ3RyYW5zcGFyZW50JyxcbiAgICAgICAgICAnYmFja2Ryb3AtYmx1ci1tZCBiZy1zdXJmYWNlLzgwJzogdmFyaWFudCgpID09PSAndHJhbnNwYXJlbnQnICYmIGlzU2Nyb2xsZWQoKSxcbiAgICAgICAgICAvLyBTdGlja3kgYmVoYXZpb3JcbiAgICAgICAgICAnc3RpY2t5IHRvcC0wIHotNTAnOiBwcm9wcy5zdGlja3ksXG4gICAgICAgICAgJ3NoYWRvdy1sZyc6IHByb3BzLnN0aWNreSAmJiBpc1Njcm9sbGVkKCksXG4gICAgICAgIH0sXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy1zY3JlZW4teGwgbXgtYXV0byBweC00IHNtOnB4LTYgbGc6cHgtOFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGgtMTZcIj5cbiAgICAgICAgICB7LyogTGVmdCBzZWN0aW9uICovfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtNFwiPlxuICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuc2hvd01lbnVCdXR0b259PlxuICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25NZW51Q2xpY2t9XG4gICAgICAgICAgICAgICAgY2xhc3M9XCJwLTIgcm91bmRlZC1sZyBob3ZlcjpiZy1oaWdobGlnaHQgdHJhbnNpdGlvbi1jb2xvcnMgbGc6aGlkZGVuXCJcbiAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiTWVudVwiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8c3ZnIGNsYXNzPVwidy02IGgtNlwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiPlxuICAgICAgICAgICAgICAgICAgPHBhdGggc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIGQ9XCJNNCA2aDE2TTQgMTJoMTZNNCAxOGgxNlwiIC8+XG4gICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5sb2dvfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnRpdGxlfT5cbiAgICAgICAgICAgICAgICA8aDEgY2xhc3M9XCJ0ZXh0LXhsIGZvbnQtYm9sZCB0ZXh0LXByaW1hcnlcIj57cHJvcHMudGl0bGV9PC9oMT5cbiAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAge3Byb3BzLmxvZ299XG4gICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICB7LyogUmlnaHQgc2VjdGlvbiAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5hY3Rpb25zfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICB7cHJvcHMuYWN0aW9uc31cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2hlYWRlcj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBTY29yZVBhbmVsUHJvcHMge1xuICBzY29yZTogbnVtYmVyO1xuICByYW5rOiBudW1iZXI7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgU2NvcmVQYW5lbDogQ29tcG9uZW50PFNjb3JlUGFuZWxQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZ3JpZCBncmlkLWNvbHMtWzFmcl8xZnJdIGdhcC0yIHAtNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogU2NvcmUgQm94ICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2Ugcm91bmRlZC1sZyBwLTQgZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgbWluLWgtWzgwcHhdXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTJ4bCBmb250LW1vbm8gZm9udC1ib2xkIHRleHQtYWNjZW50LXByaW1hcnlcIj5cbiAgICAgICAgICB7cHJvcHMuc2NvcmV9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+XG4gICAgICAgICAgU2NvcmVcbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgey8qIFJhbmsgQm94ICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2Ugcm91bmRlZC1sZyBwLTQgZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgbWluLWgtWzgwcHhdXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTJ4bCBmb250LW1vbm8gZm9udC1ib2xkIHRleHQtYWNjZW50LXNlY29uZGFyeVwiPlxuICAgICAgICAgIHtwcm9wcy5yYW5rfVxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtc20gdGV4dC1zZWNvbmRhcnkgbXQtMVwiPlxuICAgICAgICAgIFJhbmtcbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdywgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9CdXR0b24nO1xuXG5leHBvcnQgdHlwZSBPbmJvYXJkaW5nU3RlcCA9ICdjb25uZWN0LXdhbGxldCcgfCAnZ2VuZXJhdGluZy10b2tlbicgfCAnY29tcGxldGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE9uYm9hcmRpbmdGbG93UHJvcHMge1xuICBzdGVwOiBPbmJvYXJkaW5nU3RlcDtcbiAgZXJyb3I/OiBzdHJpbmcgfCBudWxsO1xuICB3YWxsZXRBZGRyZXNzPzogc3RyaW5nIHwgbnVsbDtcbiAgdG9rZW4/OiBzdHJpbmcgfCBudWxsO1xuICBvbkNvbm5lY3RXYWxsZXQ6ICgpID0+IHZvaWQ7XG4gIG9uVXNlVGVzdE1vZGU6ICgpID0+IHZvaWQ7XG4gIG9uVXNlUHJpdmF0ZUtleTogKHByaXZhdGVLZXk6IHN0cmluZykgPT4gdm9pZDtcbiAgb25Db21wbGV0ZTogKCkgPT4gdm9pZDtcbiAgaXNDb25uZWN0aW5nPzogYm9vbGVhbjtcbiAgaXNHZW5lcmF0aW5nPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBPbmJvYXJkaW5nRmxvdzogQ29tcG9uZW50PE9uYm9hcmRpbmdGbG93UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtzaG93VGVzdE9wdGlvbiwgc2V0U2hvd1Rlc3RPcHRpb25dID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3Nob3dQcml2YXRlS2V5SW5wdXQsIHNldFNob3dQcml2YXRlS2V5SW5wdXRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3ByaXZhdGVLZXksIHNldFByaXZhdGVLZXldID0gY3JlYXRlU2lnbmFsKCcnKTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgJ21pbi1oLXNjcmVlbiBiZy1ncmFkaWVudC10by1iciBmcm9tLWdyYXktOTAwIHRvLWJsYWNrIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyJyxcbiAgICAgIHByb3BzLmNsYXNzXG4gICAgKX0+XG4gICAgICA8ZGl2IGNsYXNzPVwibWF4LXctMnhsIHctZnVsbCBwLTEyXCI+XG4gICAgICAgIHsvKiBMb2dvL0hlYWRlciAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIG1iLTEyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtOHhsIG1iLTZcIj7wn46kPC9kaXY+XG4gICAgICAgICAgPGgxIGNsYXNzPVwidGV4dC02eGwgZm9udC1ib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgU2NhcmxldHQgS2FyYW9rZVxuICAgICAgICAgIDwvaDE+XG4gICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXhsIHRleHQtZ3JheS00MDBcIj5cbiAgICAgICAgICAgIEFJLXBvd2VyZWQga2FyYW9rZSBmb3IgU291bmRDbG91ZFxuICAgICAgICAgIDwvcD5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgey8qIFByb2dyZXNzIERvdHMgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGp1c3RpZnktY2VudGVyIG1iLTEyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZ2FwLTNcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAndy0zIGgtMyByb3VuZGVkLWZ1bGwgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgICAgICAgcHJvcHMuc3RlcCA9PT0gJ2Nvbm5lY3Qtd2FsbGV0JyBcbiAgICAgICAgICAgICAgICA/ICdiZy1wdXJwbGUtNTAwIHctMTInIFxuICAgICAgICAgICAgICAgIDogcHJvcHMud2FsbGV0QWRkcmVzcyBcbiAgICAgICAgICAgICAgICAgID8gJ2JnLWdyZWVuLTUwMCcgXG4gICAgICAgICAgICAgICAgICA6ICdiZy1ncmF5LTYwMCdcbiAgICAgICAgICAgICl9IC8+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3ctMyBoLTMgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgICAgICAgIHByb3BzLnN0ZXAgPT09ICdnZW5lcmF0aW5nLXRva2VuJyBcbiAgICAgICAgICAgICAgICA/ICdiZy1wdXJwbGUtNTAwIHctMTInIFxuICAgICAgICAgICAgICAgIDogcHJvcHMudG9rZW4gXG4gICAgICAgICAgICAgICAgICA/ICdiZy1ncmVlbi01MDAnIFxuICAgICAgICAgICAgICAgICAgOiAnYmctZ3JheS02MDAnXG4gICAgICAgICAgICApfSAvPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICd3LTMgaC0zIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICAgICAgICBwcm9wcy5zdGVwID09PSAnY29tcGxldGUnIFxuICAgICAgICAgICAgICAgID8gJ2JnLWdyZWVuLTUwMCB3LTEyJyBcbiAgICAgICAgICAgICAgICA6ICdiZy1ncmF5LTYwMCdcbiAgICAgICAgICAgICl9IC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHsvKiBFcnJvciBEaXNwbGF5ICovfVxuICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5lcnJvcn0+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm1iLTggcC02IGJnLXJlZC05MDAvMjAgYm9yZGVyIGJvcmRlci1yZWQtODAwIHJvdW5kZWQteGxcIj5cbiAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1yZWQtNDAwIHRleHQtY2VudGVyIHRleHQtbGdcIj57cHJvcHMuZXJyb3J9PC9wPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgey8qIENvbnRlbnQgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LTZcIj5cbiAgICAgICAgICB7LyogQ29ubmVjdCBXYWxsZXQgU3RlcCAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zdGVwID09PSAnY29ubmVjdC13YWxsZXQnfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBzcGFjZS15LThcIj5cbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTR4bCBmb250LXNlbWlib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgICAgICAgQ29ubmVjdCBZb3VyIFdhbGxldFxuICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQtbGcgbWF4LXctbWQgbXgtYXV0b1wiPlxuICAgICAgICAgICAgICAgICAgQ29ubmVjdCB5b3VyIHdhbGxldCB0byBnZXQgc3RhcnRlZFxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNCBtYXgtdy1tZCBteC1hdXRvXCI+XG4gICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25Db25uZWN0V2FsbGV0fVxuICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmlzQ29ubmVjdGluZ31cbiAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE2IHRleHQtbGdcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIHtwcm9wcy5pc0Nvbm5lY3RpbmcgPyAoXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInctNCBoLTQgYm9yZGVyLTIgYm9yZGVyLWN1cnJlbnQgYm9yZGVyLXItdHJhbnNwYXJlbnQgcm91bmRlZC1mdWxsIGFuaW1hdGUtc3BpblwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgQ29ubmVjdGluZy4uLlxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4+8J+mijwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICBDb25uZWN0IHdpdGggTWV0YU1hc2tcbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L0J1dHRvbj5cblxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49eyFzaG93VGVzdE9wdGlvbigpICYmICFzaG93UHJpdmF0ZUtleUlucHV0KCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZ2FwLTQganVzdGlmeS1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dUZXN0T3B0aW9uKHRydWUpfVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIFVzZSBkZW1vIG1vZGVcbiAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidGV4dC1ncmF5LTYwMFwiPnw8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93UHJpdmF0ZUtleUlucHV0KHRydWUpfVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIFVzZSBwcml2YXRlIGtleVxuICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Nob3dUZXN0T3B0aW9uKCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB0LTYgc3BhY2UteS00XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib3JkZXItdCBib3JkZXItZ3JheS04MDAgcHQtNlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uVXNlVGVzdE1vZGV9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwic2Vjb25kYXJ5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0XCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICBDb250aW51ZSB3aXRoIERlbW8gTW9kZVxuICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dUZXN0T3B0aW9uKGZhbHNlKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzIG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIEJhY2tcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtzaG93UHJpdmF0ZUtleUlucHV0KCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB0LTYgc3BhY2UteS00XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib3JkZXItdCBib3JkZXItZ3JheS04MDAgcHQtNlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cInBhc3N3b3JkXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtwcml2YXRlS2V5KCl9XG4gICAgICAgICAgICAgICAgICAgICAgICBvbklucHV0PXsoZSkgPT4gc2V0UHJpdmF0ZUtleShlLmN1cnJlbnRUYXJnZXQudmFsdWUpfVxuICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJFbnRlciBwcml2YXRlIGtleVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0IHB4LTQgYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLWxnIHRleHQtd2hpdGUgcGxhY2Vob2xkZXItZ3JheS01MDAgZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1wdXJwbGUtNTAwXCJcbiAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHByb3BzLm9uVXNlUHJpdmF0ZUtleShwcml2YXRlS2V5KCkpfVxuICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFwcml2YXRlS2V5KCkgfHwgcHJpdmF0ZUtleSgpLmxlbmd0aCAhPT0gNjR9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwic2Vjb25kYXJ5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0IG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIENvbm5lY3Qgd2l0aCBQcml2YXRlIEtleVxuICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd1ByaXZhdGVLZXlJbnB1dChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldFByaXZhdGVLZXkoJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzIG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIEJhY2tcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICB7LyogR2VuZXJhdGluZyBUb2tlbiBTdGVwICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnN0ZXAgPT09ICdnZW5lcmF0aW5nLXRva2VuJ30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgc3BhY2UteS04XCI+XG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC00eGwgZm9udC1zZW1pYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj5cbiAgICAgICAgICAgICAgICAgIFNldHRpbmcgVXAgWW91ciBBY2NvdW50XG4gICAgICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy53YWxsZXRBZGRyZXNzfT5cbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTQwMCB0ZXh0LWxnIG1iLTNcIj5cbiAgICAgICAgICAgICAgICAgICAgQ29ubmVjdGVkIHdhbGxldDpcbiAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgIDxjb2RlIGNsYXNzPVwidGV4dC1sZyB0ZXh0LXB1cnBsZS00MDAgYmctZ3JheS04MDAgcHgtNCBweS0yIHJvdW5kZWQtbGcgZm9udC1tb25vIGlubGluZS1ibG9ja1wiPlxuICAgICAgICAgICAgICAgICAgICB7cHJvcHMud2FsbGV0QWRkcmVzcz8uc2xpY2UoMCwgNil9Li4ue3Byb3BzLndhbGxldEFkZHJlc3M/LnNsaWNlKC00KX1cbiAgICAgICAgICAgICAgICAgIDwvY29kZT5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJweS0xMlwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ3LTIwIGgtMjAgYm9yZGVyLTQgYm9yZGVyLXB1cnBsZS01MDAgYm9yZGVyLXQtdHJhbnNwYXJlbnQgcm91bmRlZC1mdWxsIGFuaW1hdGUtc3BpbiBteC1hdXRvXCIgLz5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQteGxcIj5cbiAgICAgICAgICAgICAgICB7cHJvcHMuaXNHZW5lcmF0aW5nIFxuICAgICAgICAgICAgICAgICAgPyAnR2VuZXJhdGluZyB5b3VyIGFjY2VzcyB0b2tlbi4uLicgXG4gICAgICAgICAgICAgICAgICA6ICdWZXJpZnlpbmcgeW91ciBhY2NvdW50Li4uJ31cbiAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgey8qIENvbXBsZXRlIFN0ZXAgKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuc3RlcCA9PT0gJ2NvbXBsZXRlJ30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgc3BhY2UteS04XCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTh4bCBtYi02XCI+8J+OiTwvZGl2PlxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTR4bCBmb250LXNlbWlib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgICAgICAgWW91J3JlIEFsbCBTZXQhXG4gICAgICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS00MDAgdGV4dC14bCBtYXgtdy1tZCBteC1hdXRvIG1iLThcIj5cbiAgICAgICAgICAgICAgICAgIFlvdXIgYWNjb3VudCBpcyByZWFkeS4gVGltZSB0byBzaW5nIVxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1heC13LW1kIG14LWF1dG9cIj5cbiAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNvbXBsZXRlfVxuICAgICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTYgdGV4dC1sZ1wiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgU3RhcnQgU2luZ2luZyEg8J+agFxuICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS01MDAgbXQtNlwiPlxuICAgICAgICAgICAgICAgIExvb2sgZm9yIHRoZSBrYXJhb2tlIHdpZGdldCBvbiBhbnkgU291bmRDbG91ZCB0cmFja1xuICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IEZvciwgY3JlYXRlRWZmZWN0LCBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEx5cmljTGluZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRleHQ6IHN0cmluZztcbiAgc3RhcnRUaW1lOiBudW1iZXI7IC8vIGluIHNlY29uZHNcbiAgZHVyYXRpb246IG51bWJlcjsgLy8gaW4gbWlsbGlzZWNvbmRzXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTHlyaWNzRGlzcGxheVByb3BzIHtcbiAgbHlyaWNzOiBMeXJpY0xpbmVbXTtcbiAgY3VycmVudFRpbWU/OiBudW1iZXI7IC8vIGluIG1pbGxpc2Vjb25kc1xuICBpc1BsYXlpbmc/OiBib29sZWFuO1xuICBsaW5lU2NvcmVzPzogQXJyYXk8eyBsaW5lSW5kZXg6IG51bWJlcjsgc2NvcmU6IG51bWJlcjsgdHJhbnNjcmlwdGlvbjogc3RyaW5nOyBmZWVkYmFjaz86IHN0cmluZyB9PjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBMeXJpY3NEaXNwbGF5OiBDb21wb25lbnQ8THlyaWNzRGlzcGxheVByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbY3VycmVudExpbmVJbmRleCwgc2V0Q3VycmVudExpbmVJbmRleF0gPSBjcmVhdGVTaWduYWwoLTEpO1xuICBsZXQgY29udGFpbmVyUmVmOiBIVE1MRGl2RWxlbWVudCB8IHVuZGVmaW5lZDtcbiAgXG4gIC8vIEhlbHBlciB0byBnZXQgc2NvcmUgZm9yIGEgbGluZVxuICBjb25zdCBnZXRMaW5lU2NvcmUgPSAobGluZUluZGV4OiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gcHJvcHMubGluZVNjb3Jlcz8uZmluZChzID0+IHMubGluZUluZGV4ID09PSBsaW5lSW5kZXgpPy5zY29yZSB8fCBudWxsO1xuICB9O1xuICBcbiAgLy8gSGVscGVyIHRvIGdldCBzdHlsZSBhbmQgZW1vamkgYmFzZWQgb24gc2NvcmVcbiAgY29uc3QgZ2V0U2NvcmVTdHlsZSA9IChzY29yZTogbnVtYmVyIHwgbnVsbCkgPT4ge1xuICAgIGlmIChzY29yZSA9PT0gbnVsbCkgcmV0dXJuIHt9O1xuICAgIFxuICAgIC8vIEZyaWVuZGx5LCBncmFkdWFsIHNwZWN0cnVtIG9mIHdhcm0gY29sb3JzXG4gICAgaWYgKHNjb3JlID49IDkwKSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZjZiNmInLCB0ZXh0U2hhZG93OiAnMCAwIDIwcHggcmdiYSgyNTUsIDEwNywgMTA3LCAwLjYpJyB9OyAvLyBCcmlnaHQgd2FybSByZWQvb3JhbmdlIHdpdGggZ2xvd1xuICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gODApIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmODc4NycgfTsgLy8gTWVkaXVtIHJlZFxuICAgIH0gZWxzZSBpZiAoc2NvcmUgPj0gNzApIHtcbiAgICAgIHJldHVybiB7IGNvbG9yOiAnI2ZmYThhOCcgfTsgLy8gTGlnaHQgcmVkXG4gICAgfSBlbHNlIGlmIChzY29yZSA+PSA2MCkge1xuICAgICAgcmV0dXJuIHsgY29sb3I6ICcjZmZjZWNlJyB9OyAvLyBWZXJ5IGxpZ2h0IHJlZFxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4geyBjb2xvcjogJyNmZmUwZTAnIH07IC8vIFBhbGUgcmVkXG4gICAgfVxuICB9O1xuICBcbiAgLy8gUmVtb3ZlZCBlbW9qaSBmdW5jdGlvbiAtIHVzaW5nIGNvbG9ycyBvbmx5XG5cbiAgLy8gRmluZCBjdXJyZW50IGxpbmUgYmFzZWQgb24gdGltZVxuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghcHJvcHMuY3VycmVudFRpbWUgfHwgIXByb3BzLmx5cmljcy5sZW5ndGgpIHtcbiAgICAgIHNldEN1cnJlbnRMaW5lSW5kZXgoLTEpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRpbWUgPSBwcm9wcy5jdXJyZW50VGltZSAvIDEwMDA7IC8vIENvbnZlcnQgZnJvbSBtaWxsaXNlY29uZHMgdG8gc2Vjb25kc1xuICAgIFxuICAgIC8vIEZpbmQgdGhlIGxpbmUgdGhhdCBjb250YWlucyB0aGUgY3VycmVudCB0aW1lXG4gICAgbGV0IGZvdW5kSW5kZXggPSAtMTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByb3BzLmx5cmljcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgbGluZSA9IHByb3BzLmx5cmljc1tpXTtcbiAgICAgIGlmICghbGluZSkgY29udGludWU7XG4gICAgICBjb25zdCBlbmRUaW1lID0gbGluZS5zdGFydFRpbWUgKyBsaW5lLmR1cmF0aW9uIC8gMTAwMDsgLy8gQ29udmVydCBkdXJhdGlvbiBmcm9tIG1zIHRvIHNlY29uZHNcbiAgICAgIFxuICAgICAgaWYgKHRpbWUgPj0gbGluZS5zdGFydFRpbWUgJiYgdGltZSA8IGVuZFRpbWUpIHtcbiAgICAgICAgZm91bmRJbmRleCA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBJZiBubyBsaW5lIGNvbnRhaW5zIGN1cnJlbnQgdGltZSwgZmluZCB0aGUgbW9zdCByZWNlbnQgcGFzdCBsaW5lXG4gICAgaWYgKGZvdW5kSW5kZXggPT09IC0xICYmIHRpbWUgPiAwKSB7XG4gICAgICBmb3IgKGxldCBpID0gcHJvcHMubHlyaWNzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGNvbnN0IGxpbmUgPSBwcm9wcy5seXJpY3NbaV07XG4gICAgICAgIGlmICghbGluZSkgY29udGludWU7XG4gICAgICAgIGlmICh0aW1lID49IGxpbmUuc3RhcnRUaW1lKSB7XG4gICAgICAgICAgZm91bmRJbmRleCA9IGk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gT25seSB1cGRhdGUgaWYgdGhlIGluZGV4IGhhcyBjaGFuZ2VkIHRvIGF2b2lkIHVubmVjZXNzYXJ5IHNjcm9sbGluZ1xuICAgIGlmIChmb3VuZEluZGV4ICE9PSBjdXJyZW50TGluZUluZGV4KCkpIHtcbiAgICAgIGNvbnN0IHByZXZJbmRleCA9IGN1cnJlbnRMaW5lSW5kZXgoKTtcbiAgICAgIGNvbnNvbGUubG9nKCdbTHlyaWNzRGlzcGxheV0gQ3VycmVudCBsaW5lIGNoYW5nZWQ6Jywge1xuICAgICAgICBmcm9tOiBwcmV2SW5kZXgsXG4gICAgICAgIHRvOiBmb3VuZEluZGV4LFxuICAgICAgICB0aW1lOiBwcm9wcy5jdXJyZW50VGltZSxcbiAgICAgICAgdGltZUluU2Vjb25kczogdGltZSxcbiAgICAgICAganVtcDogTWF0aC5hYnMoZm91bmRJbmRleCAtIHByZXZJbmRleClcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyBMb2cgd2FybmluZyBmb3IgbGFyZ2UganVtcHNcbiAgICAgIGlmIChwcmV2SW5kZXggIT09IC0xICYmIE1hdGguYWJzKGZvdW5kSW5kZXggLSBwcmV2SW5kZXgpID4gMTApIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdbTHlyaWNzRGlzcGxheV0gTGFyZ2UgbGluZSBqdW1wIGRldGVjdGVkIScsIHtcbiAgICAgICAgICBmcm9tOiBwcmV2SW5kZXgsXG4gICAgICAgICAgdG86IGZvdW5kSW5kZXgsXG4gICAgICAgICAgZnJvbUxpbmU6IHByb3BzLmx5cmljc1twcmV2SW5kZXhdLFxuICAgICAgICAgIHRvTGluZTogcHJvcHMubHlyaWNzW2ZvdW5kSW5kZXhdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBzZXRDdXJyZW50TGluZUluZGV4KGZvdW5kSW5kZXgpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gQXV0by1zY3JvbGwgdG8gY3VycmVudCBsaW5lXG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgaW5kZXggPSBjdXJyZW50TGluZUluZGV4KCk7XG4gICAgaWYgKGluZGV4ID09PSAtMSB8fCAhY29udGFpbmVyUmVmIHx8ICFwcm9wcy5pc1BsYXlpbmcpIHJldHVybjtcblxuICAgIC8vIEFkZCBhIHNtYWxsIGRlbGF5IHRvIGVuc3VyZSBET00gaXMgdXBkYXRlZFxuICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgICBjb25zdCBsaW5lRWxlbWVudHMgPSBjb250YWluZXJSZWYucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtbGluZS1pbmRleF0nKTtcbiAgICAgIGNvbnN0IGN1cnJlbnRFbGVtZW50ID0gbGluZUVsZW1lbnRzW2luZGV4XSBhcyBIVE1MRWxlbWVudDtcblxuICAgICAgaWYgKGN1cnJlbnRFbGVtZW50KSB7XG4gICAgICAgIGNvbnN0IGNvbnRhaW5lckhlaWdodCA9IGNvbnRhaW5lclJlZi5jbGllbnRIZWlnaHQ7XG4gICAgICAgIGNvbnN0IGxpbmVUb3AgPSBjdXJyZW50RWxlbWVudC5vZmZzZXRUb3A7XG4gICAgICAgIGNvbnN0IGxpbmVIZWlnaHQgPSBjdXJyZW50RWxlbWVudC5vZmZzZXRIZWlnaHQ7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRTY3JvbGxUb3AgPSBjb250YWluZXJSZWYuc2Nyb2xsVG9wO1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSB3aGVyZSB0aGUgbGluZSBzaG91bGQgYmUgcG9zaXRpb25lZCAoc2xpZ2h0bHkgYWJvdmUgY2VudGVyIGZvciBiZXR0ZXIgdmlzaWJpbGl0eSlcbiAgICAgICAgY29uc3QgdGFyZ2V0U2Nyb2xsVG9wID0gbGluZVRvcCAtIGNvbnRhaW5lckhlaWdodCAvIDIgKyBsaW5lSGVpZ2h0IC8gMiAtIDUwO1xuICAgICAgICBcbiAgICAgICAgLy8gT25seSBzY3JvbGwgaWYgdGhlIGxpbmUgaXMgbm90IGFscmVhZHkgd2VsbC1wb3NpdGlvbmVkXG4gICAgICAgIGNvbnN0IGlzTGluZVZpc2libGUgPSBsaW5lVG9wID49IGN1cnJlbnRTY3JvbGxUb3AgJiYgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVUb3AgKyBsaW5lSGVpZ2h0IDw9IGN1cnJlbnRTY3JvbGxUb3AgKyBjb250YWluZXJIZWlnaHQ7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBpc0xpbmVDZW50ZXJlZCA9IE1hdGguYWJzKGN1cnJlbnRTY3JvbGxUb3AgLSB0YXJnZXRTY3JvbGxUb3ApIDwgMTAwO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFpc0xpbmVWaXNpYmxlIHx8ICFpc0xpbmVDZW50ZXJlZCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbTHlyaWNzRGlzcGxheV0gU2Nyb2xsaW5nIHRvIGxpbmU6JywgaW5kZXgsICd0YXJnZXRTY3JvbGxUb3A6JywgdGFyZ2V0U2Nyb2xsVG9wKTtcbiAgICAgICAgICBjb250YWluZXJSZWYuc2Nyb2xsVG8oe1xuICAgICAgICAgICAgdG9wOiB0YXJnZXRTY3JvbGxUb3AsXG4gICAgICAgICAgICBiZWhhdmlvcjogJ3Ntb290aCcsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICByZWY9e2NvbnRhaW5lclJlZn1cbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2x5cmljcy1kaXNwbGF5IG92ZXJmbG93LXktYXV0byBzY3JvbGwtc21vb3RoJyxcbiAgICAgICAgJ2gtZnVsbCBweC02IHB5LTEyJyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktOFwiPlxuICAgICAgICA8Rm9yIGVhY2g9e3Byb3BzLmx5cmljc30+XG4gICAgICAgICAgeyhsaW5lLCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbGluZVNjb3JlID0gKCkgPT4gZ2V0TGluZVNjb3JlKGluZGV4KCkpO1xuICAgICAgICAgICAgY29uc3Qgc2NvcmVTdHlsZSA9ICgpID0+IGdldFNjb3JlU3R5bGUobGluZVNjb3JlKCkpO1xuICAgICAgICAgICAgLy8gVXNpbmcgY29sb3IgZ3JhZGllbnRzIGluc3RlYWQgb2YgZW1vamlzXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICBkYXRhLWxpbmUtaW5kZXg9e2luZGV4KCl9XG4gICAgICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICAgJ3RleHQtY2VudGVyIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgICAgICAgICAgICAndGV4dC0yeGwgbGVhZGluZy1yZWxheGVkJyxcbiAgICAgICAgICAgICAgICAgIGluZGV4KCkgPT09IGN1cnJlbnRMaW5lSW5kZXgoKVxuICAgICAgICAgICAgICAgICAgICA/ICdmb250LXNlbWlib2xkIHNjYWxlLTExMCdcbiAgICAgICAgICAgICAgICAgICAgOiAnb3BhY2l0eS02MCdcbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICBjb2xvcjogaW5kZXgoKSA9PT0gY3VycmVudExpbmVJbmRleCgpICYmICFsaW5lU2NvcmUoKSBcbiAgICAgICAgICAgICAgICAgICAgPyAnI2ZmZmZmZicgLy8gV2hpdGUgZm9yIGN1cnJlbnQgbGluZSB3aXRob3V0IHNjb3JlXG4gICAgICAgICAgICAgICAgICAgIDogc2NvcmVTdHlsZSgpLmNvbG9yLFxuICAgICAgICAgICAgICAgICAgLi4uKGluZGV4KCkgPT09IGN1cnJlbnRMaW5lSW5kZXgoKSAmJiBsaW5lU2NvcmUoKSA/IHNjb3JlU3R5bGUoKSA6IHt9KVxuICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICB7bGluZS50ZXh0fVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfX1cbiAgICAgICAgPC9Gb3I+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlSGVhZGVyUHJvcHMge1xuICBzb25nVGl0bGU6IHN0cmluZztcbiAgYXJ0aXN0OiBzdHJpbmc7XG4gIG9uQmFjaz86ICgpID0+IHZvaWQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5jb25zdCBDaGV2cm9uTGVmdCA9ICgpID0+IChcbiAgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgY2xhc3M9XCJ3LTYgaC02XCI+XG4gICAgPHBhdGggc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIgZD1cIk0xNSAxOWwtNy03IDctN1wiIC8+XG4gIDwvc3ZnPlxuKTtcblxuZXhwb3J0IGNvbnN0IEthcmFva2VIZWFkZXI6IENvbXBvbmVudDxLYXJhb2tlSGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ3JlbGF0aXZlIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHAtNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogQmFjayBidXR0b24gLSBhYnNvbHV0ZSBwb3NpdGlvbmVkICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkJhY2t9XG4gICAgICAgIGNsYXNzPVwiYWJzb2x1dGUgbGVmdC00IHAtMiAtbS0yIHRleHQtc2Vjb25kYXJ5IGhvdmVyOnRleHQtcHJpbWFyeSB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgIGFyaWEtbGFiZWw9XCJHbyBiYWNrXCJcbiAgICAgID5cbiAgICAgICAgPENoZXZyb25MZWZ0IC8+XG4gICAgICA8L2J1dHRvbj5cbiAgICAgIFxuICAgICAgey8qIFNvbmcgaW5mbyAtIGNlbnRlcmVkICovfVxuICAgICAgPGgxIGNsYXNzPVwidGV4dC1iYXNlIGZvbnQtbWVkaXVtIHRleHQtcHJpbWFyeSB0ZXh0LWNlbnRlciBweC0xMiB0cnVuY2F0ZSBtYXgtdy1mdWxsXCI+XG4gICAgICAgIHtwcm9wcy5zb25nVGl0bGV9IC0ge3Byb3BzLmFydGlzdH1cbiAgICAgIDwvaDE+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IEZvciB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGVhZGVyYm9hcmRFbnRyeSB7XG4gIHJhbms6IG51bWJlcjtcbiAgdXNlcm5hbWU6IHN0cmluZztcbiAgc2NvcmU6IG51bWJlcjtcbiAgaXNDdXJyZW50VXNlcj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGVhZGVyYm9hcmRQYW5lbFByb3BzIHtcbiAgZW50cmllczogTGVhZGVyYm9hcmRFbnRyeVtdO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IExlYWRlcmJvYXJkUGFuZWw6IENvbXBvbmVudDxMZWFkZXJib2FyZFBhbmVsUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgZ2FwLTIgcC00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxGb3IgZWFjaD17cHJvcHMuZW50cmllc30+XG4gICAgICAgIHsoZW50cnkpID0+IChcbiAgICAgICAgICA8ZGl2IFxuICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAnZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgcHgtMyBweS0yIHJvdW5kZWQtbGcgdHJhbnNpdGlvbi1jb2xvcnMnLFxuICAgICAgICAgICAgICBlbnRyeS5pc0N1cnJlbnRVc2VyIFxuICAgICAgICAgICAgICAgID8gJ2JnLWFjY2VudC1wcmltYXJ5LzEwIGJvcmRlciBib3JkZXItYWNjZW50LXByaW1hcnkvMjAnIFxuICAgICAgICAgICAgICAgIDogJ2JnLXN1cmZhY2UgaG92ZXI6Ymctc3VyZmFjZS1ob3ZlcidcbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgPHNwYW4gXG4gICAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAndy04IHRleHQtY2VudGVyIGZvbnQtbW9ubyBmb250LWJvbGQnLFxuICAgICAgICAgICAgICAgIGVudHJ5LnJhbmsgPD0gMyA/ICd0ZXh0LWFjY2VudC1wcmltYXJ5JyA6ICd0ZXh0LXNlY29uZGFyeSdcbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgI3tlbnRyeS5yYW5rfVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAnZmxleC0xIHRydW5jYXRlJyxcbiAgICAgICAgICAgICAgZW50cnkuaXNDdXJyZW50VXNlciA/ICd0ZXh0LWFjY2VudC1wcmltYXJ5IGZvbnQtbWVkaXVtJyA6ICd0ZXh0LXByaW1hcnknXG4gICAgICAgICAgICApfT5cbiAgICAgICAgICAgICAge2VudHJ5LnVzZXJuYW1lfVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAnZm9udC1tb25vIGZvbnQtYm9sZCcsXG4gICAgICAgICAgICAgIGVudHJ5LmlzQ3VycmVudFVzZXIgPyAndGV4dC1hY2NlbnQtcHJpbWFyeScgOiAndGV4dC1wcmltYXJ5J1xuICAgICAgICAgICAgKX0+XG4gICAgICAgICAgICAgIHtlbnRyeS5zY29yZS50b0xvY2FsZVN0cmluZygpfVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApfVxuICAgICAgPC9Gb3I+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCB0eXBlIFBsYXliYWNrU3BlZWQgPSAnMXgnIHwgJzAuNzV4JyB8ICcwLjV4JztcblxuZXhwb3J0IGludGVyZmFjZSBTcGxpdEJ1dHRvblByb3BzIHtcbiAgb25TdGFydD86ICgpID0+IHZvaWQ7XG4gIG9uU3BlZWRDaGFuZ2U/OiAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpID0+IHZvaWQ7XG4gIGRpc2FibGVkPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmNvbnN0IHNwZWVkczogUGxheWJhY2tTcGVlZFtdID0gWycxeCcsICcwLjc1eCcsICcwLjV4J107XG5cbmV4cG9ydCBjb25zdCBTcGxpdEJ1dHRvbjogQ29tcG9uZW50PFNwbGl0QnV0dG9uUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtjdXJyZW50U3BlZWRJbmRleCwgc2V0Q3VycmVudFNwZWVkSW5kZXhdID0gY3JlYXRlU2lnbmFsKDApO1xuICBcbiAgY29uc3QgY3VycmVudFNwZWVkID0gKCkgPT4gc3BlZWRzW2N1cnJlbnRTcGVlZEluZGV4KCldO1xuICBcbiAgY29uc3QgY3ljbGVTcGVlZCA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBjb25zdCBuZXh0SW5kZXggPSAoY3VycmVudFNwZWVkSW5kZXgoKSArIDEpICUgc3BlZWRzLmxlbmd0aDtcbiAgICBzZXRDdXJyZW50U3BlZWRJbmRleChuZXh0SW5kZXgpO1xuICAgIGNvbnN0IG5ld1NwZWVkID0gc3BlZWRzW25leHRJbmRleF07XG4gICAgaWYgKG5ld1NwZWVkKSB7XG4gICAgICBwcm9wcy5vblNwZWVkQ2hhbmdlPy4obmV3U3BlZWQpO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdyZWxhdGl2ZSBpbmxpbmUtZmxleCB3LWZ1bGwgcm91bmRlZC1sZyBvdmVyZmxvdy1oaWRkZW4nLFxuICAgICAgICAnYmctZ3JhZGllbnQtcHJpbWFyeSB0ZXh0LXdoaXRlIHNoYWRvdy1sZycsXG4gICAgICAgICd0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICB7LyogTWFpbiBidXR0b24gKi99XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uU3RhcnR9XG4gICAgICAgIGRpc2FibGVkPXtwcm9wcy5kaXNhYmxlZH1cbiAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICdmbGV4LTEgaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJlbGF0aXZlIG92ZXJmbG93LWhpZGRlbicsXG4gICAgICAgICAgJ2gtMTIgcHgtNiB0ZXh0LWxnIGZvbnQtbWVkaXVtJyxcbiAgICAgICAgICAnY3Vyc29yLXBvaW50ZXIgYm9yZGVyLW5vbmUgb3V0bGluZS1ub25lJyxcbiAgICAgICAgICAnZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICAgICdob3ZlcjpiZy13aGl0ZS8xMCBhY3RpdmU6Ymctd2hpdGUvMjAnXG4gICAgICAgICl9XG4gICAgICA+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwicmVsYXRpdmUgei0xMFwiPlN0YXJ0PC9zcGFuPlxuICAgICAgPC9idXR0b24+XG4gICAgICBcbiAgICAgIHsvKiBEaXZpZGVyICovfVxuICAgICAgPGRpdiBjbGFzcz1cInctcHggYmctYmxhY2svMjBcIiAvPlxuICAgICAgXG4gICAgICB7LyogU3BlZWQgYnV0dG9uICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtjeWNsZVNwZWVkfVxuICAgICAgICBkaXNhYmxlZD17cHJvcHMuZGlzYWJsZWR9XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJlbGF0aXZlJyxcbiAgICAgICAgICAndy0yMCB0ZXh0LWxnIGZvbnQtbWVkaXVtJyxcbiAgICAgICAgICAnY3Vyc29yLXBvaW50ZXIgYm9yZGVyLW5vbmUgb3V0bGluZS1ub25lJyxcbiAgICAgICAgICAnZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICAgICdob3ZlcjpiZy13aGl0ZS8xMCBhY3RpdmU6Ymctd2hpdGUvMjAnLFxuICAgICAgICAgICdhZnRlcjpjb250ZW50LVtcIlwiXSBhZnRlcjphYnNvbHV0ZSBhZnRlcjppbnNldC0wJyxcbiAgICAgICAgICAnYWZ0ZXI6YmctZ3JhZGllbnQtdG8tciBhZnRlcjpmcm9tLXRyYW5zcGFyZW50IGFmdGVyOnZpYS13aGl0ZS8yMCBhZnRlcjp0by10cmFuc3BhcmVudCcsXG4gICAgICAgICAgJ2FmdGVyOnRyYW5zbGF0ZS14LVstMjAwJV0gaG92ZXI6YWZ0ZXI6dHJhbnNsYXRlLXgtWzIwMCVdJyxcbiAgICAgICAgICAnYWZ0ZXI6dHJhbnNpdGlvbi10cmFuc2Zvcm0gYWZ0ZXI6ZHVyYXRpb24tNzAwJ1xuICAgICAgICApfVxuICAgICAgICBhcmlhLWxhYmVsPVwiQ2hhbmdlIHBsYXliYWNrIHNwZWVkXCJcbiAgICAgID5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJyZWxhdGl2ZSB6LTEwXCI+e2N1cnJlbnRTcGVlZCgpfTwvc3Bhbj5cbiAgICAgIDwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIFNob3csIGNyZWF0ZUNvbnRleHQsIHVzZUNvbnRleHQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCwgSlNYLCBQYXJlbnRDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBUYWIge1xuICBpZDogc3RyaW5nO1xuICBsYWJlbDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNQcm9wcyB7XG4gIHRhYnM6IFRhYltdO1xuICBkZWZhdWx0VGFiPzogc3RyaW5nO1xuICBvblRhYkNoYW5nZT86ICh0YWJJZDogc3RyaW5nKSA9PiB2b2lkO1xuICBjaGlsZHJlbjogSlNYLkVsZW1lbnQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNMaXN0UHJvcHMge1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNUcmlnZ2VyUHJvcHMge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNDb250ZW50UHJvcHMge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG4vLyBDb250ZXh0IGZvciB0YWJzIHN0YXRlXG5pbnRlcmZhY2UgVGFic0NvbnRleHRWYWx1ZSB7XG4gIGFjdGl2ZVRhYjogKCkgPT4gc3RyaW5nO1xuICBzZXRBY3RpdmVUYWI6IChpZDogc3RyaW5nKSA9PiB2b2lkO1xufVxuXG5jb25zdCBUYWJzQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8VGFic0NvbnRleHRWYWx1ZT4oKTtcblxuZXhwb3J0IGNvbnN0IFRhYnM6IFBhcmVudENvbXBvbmVudDxUYWJzUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFthY3RpdmVUYWIsIHNldEFjdGl2ZVRhYl0gPSBjcmVhdGVTaWduYWwocHJvcHMuZGVmYXVsdFRhYiB8fCBwcm9wcy50YWJzWzBdPy5pZCB8fCAnJyk7XG4gIFxuICBjb25zb2xlLmxvZygnW1RhYnNdIEluaXRpYWxpemluZyB3aXRoOicsIHtcbiAgICBkZWZhdWx0VGFiOiBwcm9wcy5kZWZhdWx0VGFiLFxuICAgIGZpcnN0VGFiSWQ6IHByb3BzLnRhYnNbMF0/LmlkLFxuICAgIGFjdGl2ZVRhYjogYWN0aXZlVGFiKClcbiAgfSk7XG4gIFxuICBjb25zdCBoYW5kbGVUYWJDaGFuZ2UgPSAoaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbVGFic10gVGFiIGNoYW5nZWQgdG86JywgaWQpO1xuICAgIHNldEFjdGl2ZVRhYihpZCk7XG4gICAgcHJvcHMub25UYWJDaGFuZ2U/LihpZCk7XG4gIH07XG5cbiAgY29uc3QgY29udGV4dFZhbHVlOiBUYWJzQ29udGV4dFZhbHVlID0ge1xuICAgIGFjdGl2ZVRhYixcbiAgICBzZXRBY3RpdmVUYWI6IGhhbmRsZVRhYkNoYW5nZVxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPFRhYnNDb250ZXh0LlByb3ZpZGVyIHZhbHVlPXtjb250ZXh0VmFsdWV9PlxuICAgICAgPGRpdiBjbGFzcz17Y24oJ3ctZnVsbCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICAgIDwvZGl2PlxuICAgIDwvVGFic0NvbnRleHQuUHJvdmlkZXI+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgVGFic0xpc3Q6IENvbXBvbmVudDxUYWJzTGlzdFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdpbmxpbmUtZmxleCBoLTEwIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLW1kIGJnLXN1cmZhY2UgcC0xIHRleHQtc2Vjb25kYXJ5JyxcbiAgICAgICAgJ3ctZnVsbCcsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICA8L2Rpdj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBUYWJzVHJpZ2dlcjogQ29tcG9uZW50PFRhYnNUcmlnZ2VyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IGNvbnRleHQgPSB1c2VDb250ZXh0KFRhYnNDb250ZXh0KTtcbiAgaWYgKCFjb250ZXh0KSB7XG4gICAgY29uc29sZS5lcnJvcignW1RhYnNUcmlnZ2VyXSBObyBUYWJzQ29udGV4dCBmb3VuZC4gVGFic1RyaWdnZXIgbXVzdCBiZSB1c2VkIHdpdGhpbiBUYWJzIGNvbXBvbmVudC4nKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBcbiAgY29uc3QgaXNBY3RpdmUgPSAoKSA9PiBjb250ZXh0LmFjdGl2ZVRhYigpID09PSBwcm9wcy52YWx1ZTtcblxuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIG9uQ2xpY2s9eygpID0+IGNvbnRleHQuc2V0QWN0aXZlVGFiKHByb3BzLnZhbHVlKX1cbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2lubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB3aGl0ZXNwYWNlLW5vd3JhcCByb3VuZGVkLXNtIHB4LTMgcHktMS41JyxcbiAgICAgICAgJ3RleHQtc20gZm9udC1tZWRpdW0gcmluZy1vZmZzZXQtYmFzZSB0cmFuc2l0aW9uLWFsbCcsXG4gICAgICAgICdmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZSBmb2N1cy12aXNpYmxlOnJpbmctMiBmb2N1cy12aXNpYmxlOnJpbmctYWNjZW50LXByaW1hcnkgZm9jdXMtdmlzaWJsZTpyaW5nLW9mZnNldC0yJyxcbiAgICAgICAgJ2Rpc2FibGVkOnBvaW50ZXItZXZlbnRzLW5vbmUgZGlzYWJsZWQ6b3BhY2l0eS01MCcsXG4gICAgICAgICdmbGV4LTEnLFxuICAgICAgICBpc0FjdGl2ZSgpXG4gICAgICAgICAgPyAnYmctYmFzZSB0ZXh0LXByaW1hcnkgc2hhZG93LXNtJ1xuICAgICAgICAgIDogJ3RleHQtc2Vjb25kYXJ5IGhvdmVyOnRleHQtcHJpbWFyeScsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICA8L2J1dHRvbj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBUYWJzQ29udGVudDogQ29tcG9uZW50PFRhYnNDb250ZW50UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IGNvbnRleHQgPSB1c2VDb250ZXh0KFRhYnNDb250ZXh0KTtcbiAgaWYgKCFjb250ZXh0KSB7XG4gICAgY29uc29sZS5lcnJvcignW1RhYnNDb250ZW50XSBObyBUYWJzQ29udGV4dCBmb3VuZC4gVGFic0NvbnRlbnQgbXVzdCBiZSB1c2VkIHdpdGhpbiBUYWJzIGNvbXBvbmVudC4nKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBcbiAgY29uc3QgaXNBY3RpdmUgPSBjb250ZXh0LmFjdGl2ZVRhYigpID09PSBwcm9wcy52YWx1ZTtcbiAgY29uc29sZS5sb2coJ1tUYWJzQ29udGVudF0gUmVuZGVyaW5nOicsIHtcbiAgICB2YWx1ZTogcHJvcHMudmFsdWUsXG4gICAgYWN0aXZlVGFiOiBjb250ZXh0LmFjdGl2ZVRhYigpLFxuICAgIGlzQWN0aXZlXG4gIH0pO1xuICBcbiAgcmV0dXJuIChcbiAgICA8U2hvdyB3aGVuPXtpc0FjdGl2ZX0+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnbXQtMiByaW5nLW9mZnNldC1iYXNlJyxcbiAgICAgICAgICAnZm9jdXMtdmlzaWJsZTpvdXRsaW5lLW5vbmUgZm9jdXMtdmlzaWJsZTpyaW5nLTIgZm9jdXMtdmlzaWJsZTpyaW5nLWFjY2VudC1wcmltYXJ5IGZvY3VzLXZpc2libGU6cmluZy1vZmZzZXQtMicsXG4gICAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICAgKX1cbiAgICAgID5cbiAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgPC9kaXY+XG4gICAgPC9TaG93PlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93LCB0eXBlIENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuaW1wb3J0IHsgU2NvcmVQYW5lbCB9IGZyb20gJy4uLy4uL2Rpc3BsYXkvU2NvcmVQYW5lbCc7XG5pbXBvcnQgeyBMeXJpY3NEaXNwbGF5LCB0eXBlIEx5cmljTGluZSB9IGZyb20gJy4uL0x5cmljc0Rpc3BsYXknO1xuaW1wb3J0IHsgTGVhZGVyYm9hcmRQYW5lbCwgdHlwZSBMZWFkZXJib2FyZEVudHJ5IH0gZnJvbSAnLi4vTGVhZGVyYm9hcmRQYW5lbCc7XG5pbXBvcnQgeyBTcGxpdEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5pbXBvcnQgdHlwZSB7IFBsYXliYWNrU3BlZWQgfSBmcm9tICcuLi8uLi9jb21tb24vU3BsaXRCdXR0b24nO1xuaW1wb3J0IHsgVGFicywgVGFic0xpc3QsIFRhYnNUcmlnZ2VyLCBUYWJzQ29udGVudCB9IGZyb20gJy4uLy4uL2NvbW1vbi9UYWJzJztcblxuZXhwb3J0IGludGVyZmFjZSBFeHRlbnNpb25LYXJhb2tlVmlld1Byb3BzIHtcbiAgLy8gU2NvcmVzXG4gIHNjb3JlOiBudW1iZXI7XG4gIHJhbms6IG51bWJlcjtcbiAgXG4gIC8vIEx5cmljc1xuICBseXJpY3M6IEx5cmljTGluZVtdO1xuICBjdXJyZW50VGltZT86IG51bWJlcjtcbiAgXG4gIC8vIExlYWRlcmJvYXJkXG4gIGxlYWRlcmJvYXJkOiBMZWFkZXJib2FyZEVudHJ5W107XG4gIFxuICAvLyBTdGF0ZVxuICBpc1BsYXlpbmc/OiBib29sZWFuO1xuICBpc1JlY29yZGluZz86IGJvb2xlYW47XG4gIG9uU3RhcnQ/OiAoKSA9PiB2b2lkO1xuICBvblNwZWVkQ2hhbmdlPzogKHNwZWVkOiBQbGF5YmFja1NwZWVkKSA9PiB2b2lkO1xuICBcbiAgLy8gTGluZSBzY29yZXMgZm9yIHZpc3VhbCBmZWVkYmFja1xuICBsaW5lU2NvcmVzPzogQXJyYXk8eyBsaW5lSW5kZXg6IG51bWJlcjsgc2NvcmU6IG51bWJlcjsgdHJhbnNjcmlwdGlvbjogc3RyaW5nOyBmZWVkYmFjaz86IHN0cmluZyB9PjtcbiAgXG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgRXh0ZW5zaW9uS2FyYW9rZVZpZXc6IENvbXBvbmVudDxFeHRlbnNpb25LYXJhb2tlVmlld1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zb2xlLmxvZygnW0V4dGVuc2lvbkthcmFva2VWaWV3XSBSZW5kZXJpbmcgd2l0aCBwcm9wczonLCB7XG4gICAgaXNQbGF5aW5nOiBwcm9wcy5pc1BsYXlpbmcsXG4gICAgaGFzT25TdGFydDogISFwcm9wcy5vblN0YXJ0LFxuICAgIGx5cmljc0xlbmd0aDogcHJvcHMubHlyaWNzPy5sZW5ndGhcbiAgfSk7XG4gIFxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sIGgtZnVsbCBiZy1iYXNlJywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBTY29yZSBQYW5lbCAtIG9ubHkgc2hvdyB3aGVuIG5vdCBwbGF5aW5nICovfVxuICAgICAgPFNob3cgd2hlbj17IXByb3BzLmlzUGxheWluZ30+XG4gICAgICAgIDxTY29yZVBhbmVsXG4gICAgICAgICAgc2NvcmU9e3Byb3BzLnNjb3JlfVxuICAgICAgICAgIHJhbms9e3Byb3BzLnJhbmt9XG4gICAgICAgIC8+XG4gICAgICA8L1Nob3c+XG5cbiAgICAgIHsvKiBTaG93IHRhYnMgb25seSB3aGVuIG5vdCBwbGF5aW5nICovfVxuICAgICAgPFNob3cgd2hlbj17IXByb3BzLmlzUGxheWluZ30gZmFsbGJhY2s9e1xuICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIGZsZXggZmxleC1jb2wgbWluLWgtMFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgbWluLWgtMCBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgIDxMeXJpY3NEaXNwbGF5XG4gICAgICAgICAgICAgIGx5cmljcz17cHJvcHMubHlyaWNzfVxuICAgICAgICAgICAgICBjdXJyZW50VGltZT17cHJvcHMuY3VycmVudFRpbWV9XG4gICAgICAgICAgICAgIGlzUGxheWluZz17cHJvcHMuaXNQbGF5aW5nfVxuICAgICAgICAgICAgICBsaW5lU2NvcmVzPXtwcm9wcy5saW5lU2NvcmVzfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICB9PlxuICAgICAgICB7LyogVGFicyBhbmQgY29udGVudCAqL31cbiAgICAgICAgPFRhYnMgXG4gICAgICAgICAgdGFicz17W1xuICAgICAgICAgICAgeyBpZDogJ2x5cmljcycsIGxhYmVsOiAnTHlyaWNzJyB9LFxuICAgICAgICAgICAgeyBpZDogJ2xlYWRlcmJvYXJkJywgbGFiZWw6ICdMZWFkZXJib2FyZCcgfVxuICAgICAgICAgIF19XG4gICAgICAgICAgZGVmYXVsdFRhYj1cImx5cmljc1wiXG4gICAgICAgICAgY2xhc3M9XCJmbGV4LTEgZmxleCBmbGV4LWNvbCBtaW4taC0wXCJcbiAgICAgICAgPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJweC00XCI+XG4gICAgICAgICAgICA8VGFic0xpc3Q+XG4gICAgICAgICAgICAgIDxUYWJzVHJpZ2dlciB2YWx1ZT1cImx5cmljc1wiPkx5cmljczwvVGFic1RyaWdnZXI+XG4gICAgICAgICAgICAgIDxUYWJzVHJpZ2dlciB2YWx1ZT1cImxlYWRlcmJvYXJkXCI+TGVhZGVyYm9hcmQ8L1RhYnNUcmlnZ2VyPlxuICAgICAgICAgICAgPC9UYWJzTGlzdD5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICBcbiAgICAgICAgICA8VGFic0NvbnRlbnQgdmFsdWU9XCJseXJpY3NcIiBjbGFzcz1cImZsZXgtMSBtaW4taC0wXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBmbGV4LWNvbCBoLWZ1bGxcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBtaW4taC0wIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgICAgIDxMeXJpY3NEaXNwbGF5XG4gICAgICAgICAgICAgICAgICBseXJpY3M9e3Byb3BzLmx5cmljc31cbiAgICAgICAgICAgICAgICAgIGN1cnJlbnRUaW1lPXtwcm9wcy5jdXJyZW50VGltZX1cbiAgICAgICAgICAgICAgICAgIGlzUGxheWluZz17cHJvcHMuaXNQbGF5aW5nfVxuICAgICAgICAgICAgICAgICAgbGluZVNjb3Jlcz17cHJvcHMubGluZVNjb3Jlc31cbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIHsvKiBGb290ZXIgd2l0aCBzdGFydCBidXR0b24gKi99XG4gICAgICAgICAgICAgIDxTaG93IHdoZW49eyFwcm9wcy5pc1BsYXlpbmcgJiYgcHJvcHMub25TdGFydH0+XG4gICAgICAgICAgICAgICAgPGRpdiBcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwicC00IGJnLXN1cmZhY2UgYm9yZGVyLXQgYm9yZGVyLXN1YnRsZVwiXG4gICAgICAgICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAgICAgICAnZmxleC1zaHJpbmsnOiAnMCdcbiAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPFNwbGl0QnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIG9uU3RhcnQ9e3Byb3BzLm9uU3RhcnR9XG4gICAgICAgICAgICAgICAgICAgIG9uU3BlZWRDaGFuZ2U9e3Byb3BzLm9uU3BlZWRDaGFuZ2V9XG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1RhYnNDb250ZW50PlxuICAgICAgICAgIFxuICAgICAgICAgIDxUYWJzQ29udGVudCB2YWx1ZT1cImxlYWRlcmJvYXJkXCIgY2xhc3M9XCJmbGV4LTEgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwib3ZlcmZsb3cteS1hdXRvIGgtZnVsbFwiPlxuICAgICAgICAgICAgICA8TGVhZGVyYm9hcmRQYW5lbCBlbnRyaWVzPXtwcm9wcy5sZWFkZXJib2FyZH0gLz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvVGFic0NvbnRlbnQ+XG4gICAgICAgIDwvVGFicz5cbiAgICAgIDwvU2hvdz5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsLCBvbkNsZWFudXAgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IEF1ZGlvUHJvY2Vzc29yT3B0aW9ucyB9IGZyb20gJy4uLy4uL3R5cGVzL2thcmFva2UnO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlS2FyYW9rZUF1ZGlvUHJvY2Vzc29yKG9wdGlvbnM/OiBBdWRpb1Byb2Nlc3Nvck9wdGlvbnMpIHtcbiAgY29uc3QgW2F1ZGlvQ29udGV4dCwgc2V0QXVkaW9Db250ZXh0XSA9IGNyZWF0ZVNpZ25hbDxBdWRpb0NvbnRleHQgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW21lZGlhU3RyZWFtLCBzZXRNZWRpYVN0cmVhbV0gPSBjcmVhdGVTaWduYWw8TWVkaWFTdHJlYW0gfCBudWxsPihudWxsKTtcbiAgY29uc3QgWywgc2V0QXVkaW9Xb3JrbGV0Tm9kZV0gPSBjcmVhdGVTaWduYWw8QXVkaW9Xb3JrbGV0Tm9kZSB8IG51bGw+KG51bGwpO1xuICBcbiAgY29uc3QgW2lzUmVhZHksIHNldElzUmVhZHldID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2Vycm9yLCBzZXRFcnJvcl0gPSBjcmVhdGVTaWduYWw8RXJyb3IgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2lzTGlzdGVuaW5nLCBzZXRJc0xpc3RlbmluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBcbiAgY29uc3QgW2N1cnJlbnRSZWNvcmRpbmdMaW5lLCBzZXRDdXJyZW50UmVjb3JkaW5nTGluZV0gPSBjcmVhdGVTaWduYWw8bnVtYmVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtyZWNvcmRlZEF1ZGlvQnVmZmVyLCBzZXRSZWNvcmRlZEF1ZGlvQnVmZmVyXSA9IGNyZWF0ZVNpZ25hbDxGbG9hdDMyQXJyYXlbXT4oW10pO1xuICBcbiAgY29uc3QgW2lzU2Vzc2lvbkFjdGl2ZSwgc2V0SXNTZXNzaW9uQWN0aXZlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtmdWxsU2Vzc2lvbkJ1ZmZlciwgc2V0RnVsbFNlc3Npb25CdWZmZXJdID0gY3JlYXRlU2lnbmFsPEZsb2F0MzJBcnJheVtdPihbXSk7XG4gIFxuICBjb25zdCBzYW1wbGVSYXRlID0gb3B0aW9ucz8uc2FtcGxlUmF0ZSB8fCAxNjAwMDtcbiAgXG4gIGNvbnN0IGluaXRpYWxpemUgPSBhc3luYyAoKSA9PiB7XG4gICAgaWYgKGF1ZGlvQ29udGV4dCgpKSByZXR1cm47XG4gICAgc2V0RXJyb3IobnVsbCk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBJbml0aWFsaXppbmcgYXVkaW8gY2FwdHVyZS4uLicpO1xuICAgICAgXG4gICAgICBjb25zdCBjdHggPSBuZXcgQXVkaW9Db250ZXh0KHsgc2FtcGxlUmF0ZSB9KTtcbiAgICAgIHNldEF1ZGlvQ29udGV4dChjdHgpO1xuICAgICAgXG4gICAgICBjb25zdCBzdHJlYW0gPSBhd2FpdCBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSh7XG4gICAgICAgIGF1ZGlvOiB7XG4gICAgICAgICAgc2FtcGxlUmF0ZSxcbiAgICAgICAgICBjaGFubmVsQ291bnQ6IDEsXG4gICAgICAgICAgZWNob0NhbmNlbGxhdGlvbjogZmFsc2UsXG4gICAgICAgICAgbm9pc2VTdXBwcmVzc2lvbjogZmFsc2UsXG4gICAgICAgICAgYXV0b0dhaW5Db250cm9sOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0TWVkaWFTdHJlYW0oc3RyZWFtKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY3R4LmF1ZGlvV29ya2xldC5hZGRNb2R1bGUoY3JlYXRlQXVkaW9Xb3JrbGV0UHJvY2Vzc29yKCkpO1xuICAgICAgXG4gICAgICBjb25zdCB3b3JrbGV0Tm9kZSA9IG5ldyBBdWRpb1dvcmtsZXROb2RlKGN0eCwgJ2thcmFva2UtYXVkaW8tcHJvY2Vzc29yJywge1xuICAgICAgICBudW1iZXJPZklucHV0czogMSxcbiAgICAgICAgbnVtYmVyT2ZPdXRwdXRzOiAwLFxuICAgICAgICBjaGFubmVsQ291bnQ6IDEsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgd29ya2xldE5vZGUucG9ydC5vbm1lc3NhZ2UgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgaWYgKGV2ZW50LmRhdGEudHlwZSA9PT0gJ2F1ZGlvRGF0YScpIHtcbiAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KGV2ZW50LmRhdGEuYXVkaW9EYXRhKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoY3VycmVudFJlY29yZGluZ0xpbmUoKSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgc2V0UmVjb3JkZWRBdWRpb0J1ZmZlcigocHJldikgPT4gWy4uLnByZXYsIGF1ZGlvRGF0YV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoaXNTZXNzaW9uQWN0aXZlKCkpIHtcbiAgICAgICAgICAgIHNldEZ1bGxTZXNzaW9uQnVmZmVyKChwcmV2KSA9PiBbLi4ucHJldiwgYXVkaW9EYXRhXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgXG4gICAgICBzZXRBdWRpb1dvcmtsZXROb2RlKHdvcmtsZXROb2RlKTtcbiAgICAgIFxuICAgICAgY29uc3Qgc291cmNlID0gY3R4LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG4gICAgICBjb25zdCBnYWluTm9kZSA9IGN0eC5jcmVhdGVHYWluKCk7XG4gICAgICBnYWluTm9kZS5nYWluLnZhbHVlID0gMS4yO1xuICAgICAgXG4gICAgICBzb3VyY2UuY29ubmVjdChnYWluTm9kZSk7XG4gICAgICBnYWluTm9kZS5jb25uZWN0KHdvcmtsZXROb2RlKTtcbiAgICAgIFxuICAgICAgc2V0SXNSZWFkeSh0cnVlKTtcbiAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBBdWRpbyBjYXB0dXJlIGluaXRpYWxpemVkIHN1Y2Nlc3NmdWxseS4nKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBGYWlsZWQgdG8gaW5pdGlhbGl6ZTonLCBlKTtcbiAgICAgIHNldEVycm9yKGUgaW5zdGFuY2VvZiBFcnJvciA/IGUgOiBuZXcgRXJyb3IoJ1Vua25vd24gYXVkaW8gaW5pdGlhbGl6YXRpb24gZXJyb3InKSk7XG4gICAgICBzZXRJc1JlYWR5KGZhbHNlKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBjcmVhdGVBdWRpb1dvcmtsZXRQcm9jZXNzb3IgPSAoKSA9PiB7XG4gICAgY29uc3QgcHJvY2Vzc29yQ29kZSA9IGBcbiAgICAgIGNsYXNzIEthcmFva2VBdWRpb1Byb2Nlc3NvciBleHRlbmRzIEF1ZGlvV29ya2xldFByb2Nlc3NvciB7XG4gICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgIHN1cGVyKCk7XG4gICAgICAgICAgdGhpcy5idWZmZXJTaXplID0gMTAyNDtcbiAgICAgICAgICB0aGlzLnJtc0hpc3RvcnkgPSBbXTtcbiAgICAgICAgICB0aGlzLm1heEhpc3RvcnlMZW5ndGggPSAxMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3MoaW5wdXRzLCBvdXRwdXRzLCBwYXJhbWV0ZXJzKSB7XG4gICAgICAgICAgY29uc3QgaW5wdXQgPSBpbnB1dHNbMF07XG4gICAgICAgICAgaWYgKGlucHV0ICYmIGlucHV0WzBdKSB7XG4gICAgICAgICAgICBjb25zdCBpbnB1dERhdGEgPSBpbnB1dFswXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHN1bSA9IDA7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0RGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBzdW0gKz0gaW5wdXREYXRhW2ldICogaW5wdXREYXRhW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgcm1zID0gTWF0aC5zcXJ0KHN1bSAvIGlucHV0RGF0YS5sZW5ndGgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLnJtc0hpc3RvcnkucHVzaChybXMpO1xuICAgICAgICAgICAgaWYgKHRoaXMucm1zSGlzdG9yeS5sZW5ndGggPiB0aGlzLm1heEhpc3RvcnlMZW5ndGgpIHtcbiAgICAgICAgICAgICAgdGhpcy5ybXNIaXN0b3J5LnNoaWZ0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGF2Z1JtcyA9IHRoaXMucm1zSGlzdG9yeS5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLCAwKSAvIHRoaXMucm1zSGlzdG9yeS5sZW5ndGg7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMucG9ydC5wb3N0TWVzc2FnZSh7XG4gICAgICAgICAgICAgIHR5cGU6ICdhdWRpb0RhdGEnLFxuICAgICAgICAgICAgICBhdWRpb0RhdGE6IGlucHV0RGF0YSxcbiAgICAgICAgICAgICAgcm1zTGV2ZWw6IHJtcyxcbiAgICAgICAgICAgICAgYXZnUm1zTGV2ZWw6IGF2Z1JtcyxcbiAgICAgICAgICAgICAgaXNUb29RdWlldDogYXZnUm1zIDwgMC4wMSxcbiAgICAgICAgICAgICAgaXNUb29Mb3VkOiBhdmdSbXMgPiAwLjNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmVnaXN0ZXJQcm9jZXNzb3IoJ2thcmFva2UtYXVkaW8tcHJvY2Vzc29yJywgS2FyYW9rZUF1ZGlvUHJvY2Vzc29yKTtcbiAgICBgO1xuICAgIFxuICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbcHJvY2Vzc29yQ29kZV0sIHsgdHlwZTogJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnIH0pO1xuICAgIHJldHVybiBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuICB9O1xuICBcbiAgY29uc3Qgc3RhcnRMaXN0ZW5pbmcgPSAoKSA9PiB7XG4gICAgY29uc3QgY3R4ID0gYXVkaW9Db250ZXh0KCk7XG4gICAgaWYgKGN0eCAmJiBjdHguc3RhdGUgPT09ICdzdXNwZW5kZWQnKSB7XG4gICAgICBjdHgucmVzdW1lKCk7XG4gICAgfVxuICAgIHNldElzTGlzdGVuaW5nKHRydWUpO1xuICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBTdGFydGVkIGxpc3RlbmluZyBmb3IgYXVkaW8uJyk7XG4gIH07XG4gIFxuICBjb25zdCBwYXVzZUxpc3RlbmluZyA9ICgpID0+IHtcbiAgICBjb25zdCBjdHggPSBhdWRpb0NvbnRleHQoKTtcbiAgICBpZiAoY3R4ICYmIGN0eC5zdGF0ZSA9PT0gJ3J1bm5pbmcnKSB7XG4gICAgICBjdHguc3VzcGVuZCgpO1xuICAgIH1cbiAgICBzZXRJc0xpc3RlbmluZyhmYWxzZSk7XG4gICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIFBhdXNlZCBsaXN0ZW5pbmcgZm9yIGF1ZGlvLicpO1xuICB9O1xuICBcbiAgY29uc3QgY2xlYW51cCA9ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0thcmFva2VBdWRpb1Byb2Nlc3Nvcl0gQ2xlYW5pbmcgdXAgYXVkaW8gY2FwdHVyZS4uLicpO1xuICAgIFxuICAgIGNvbnN0IHN0cmVhbSA9IG1lZGlhU3RyZWFtKCk7XG4gICAgaWYgKHN0cmVhbSkge1xuICAgICAgc3RyZWFtLmdldFRyYWNrcygpLmZvckVhY2goKHRyYWNrKSA9PiB0cmFjay5zdG9wKCkpO1xuICAgICAgc2V0TWVkaWFTdHJlYW0obnVsbCk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGN0eCA9IGF1ZGlvQ29udGV4dCgpO1xuICAgIGlmIChjdHggJiYgY3R4LnN0YXRlICE9PSAnY2xvc2VkJykge1xuICAgICAgY3R4LmNsb3NlKCk7XG4gICAgICBzZXRBdWRpb0NvbnRleHQobnVsbCk7XG4gICAgfVxuICAgIFxuICAgIHNldEF1ZGlvV29ya2xldE5vZGUobnVsbCk7XG4gICAgc2V0SXNSZWFkeShmYWxzZSk7XG4gICAgc2V0SXNMaXN0ZW5pbmcoZmFsc2UpO1xuICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBBdWRpbyBjYXB0dXJlIGNsZWFuZWQgdXAuJyk7XG4gIH07XG4gIFxuICBvbkNsZWFudXAoY2xlYW51cCk7XG4gIFxuICBjb25zdCBzdGFydFJlY29yZGluZ0xpbmUgPSAobGluZUluZGV4OiBudW1iZXIpID0+IHtcbiAgICBjb25zb2xlLmxvZyhgW0thcmFva2VBdWRpb1Byb2Nlc3Nvcl0gU3RhcnRpbmcgYXVkaW8gY2FwdHVyZSBmb3IgbGluZSAke2xpbmVJbmRleH1gKTtcbiAgICBcbiAgICBzZXRDdXJyZW50UmVjb3JkaW5nTGluZShsaW5lSW5kZXgpO1xuICAgIHNldFJlY29yZGVkQXVkaW9CdWZmZXIoW10pO1xuICAgIFxuICAgIGlmIChpc1JlYWR5KCkgJiYgIWlzTGlzdGVuaW5nKCkpIHtcbiAgICAgIHN0YXJ0TGlzdGVuaW5nKCk7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3Qgc3RvcFJlY29yZGluZ0xpbmVBbmRHZXRSYXdBdWRpbyA9ICgpOiBGbG9hdDMyQXJyYXlbXSA9PiB7XG4gICAgY29uc3QgbGluZUluZGV4ID0gY3VycmVudFJlY29yZGluZ0xpbmUoKTtcbiAgICBpZiAobGluZUluZGV4ID09PSBudWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ1tLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIE5vIGFjdGl2ZSByZWNvcmRpbmcgbGluZS4nKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYXVkaW9CdWZmZXIgPSByZWNvcmRlZEF1ZGlvQnVmZmVyKCk7XG4gICAgY29uc29sZS5sb2coYFtLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIFN0b3BwaW5nIGNhcHR1cmUgZm9yIGxpbmUgJHtsaW5lSW5kZXh9LiBDb2xsZWN0ZWQgJHthdWRpb0J1ZmZlci5sZW5ndGh9IGNodW5rcy5gKTtcbiAgICBcbiAgICBzZXRDdXJyZW50UmVjb3JkaW5nTGluZShudWxsKTtcbiAgICBcbiAgICBjb25zdCByZXN1bHQgPSBbLi4uYXVkaW9CdWZmZXJdO1xuICAgIHNldFJlY29yZGVkQXVkaW9CdWZmZXIoW10pO1xuICAgIFxuICAgIGlmIChyZXN1bHQubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zb2xlLmxvZyhgW0thcmFva2VBdWRpb1Byb2Nlc3Nvcl0gTm8gYXVkaW8gY2FwdHVyZWQgZm9yIGxpbmUgJHtsaW5lSW5kZXh9LmApO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuICBcbiAgY29uc3QgY29udmVydEF1ZGlvVG9XYXZCbG9iID0gKGF1ZGlvQ2h1bmtzOiBGbG9hdDMyQXJyYXlbXSk6IEJsb2IgfCBudWxsID0+IHtcbiAgICBpZiAoYXVkaW9DaHVua3MubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcbiAgICBcbiAgICBjb25zdCB0b3RhbExlbmd0aCA9IGF1ZGlvQ2h1bmtzLnJlZHVjZSgoc3VtLCBjaHVuaykgPT4gc3VtICsgY2h1bmsubGVuZ3RoLCAwKTtcbiAgICBjb25zdCBjb25jYXRlbmF0ZWQgPSBuZXcgRmxvYXQzMkFycmF5KHRvdGFsTGVuZ3RoKTtcbiAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICBmb3IgKGNvbnN0IGNodW5rIG9mIGF1ZGlvQ2h1bmtzKSB7XG4gICAgICBjb25jYXRlbmF0ZWQuc2V0KGNodW5rLCBvZmZzZXQpO1xuICAgICAgb2Zmc2V0ICs9IGNodW5rLmxlbmd0aDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGF1ZGlvQnVmZmVyVG9XYXYoY29uY2F0ZW5hdGVkLCBzYW1wbGVSYXRlKTtcbiAgfTtcbiAgXG4gIGNvbnN0IGF1ZGlvQnVmZmVyVG9XYXYgPSAoYnVmZmVyOiBGbG9hdDMyQXJyYXksIHNhbXBsZVJhdGU6IG51bWJlcik6IEJsb2IgPT4ge1xuICAgIGNvbnN0IGxlbmd0aCA9IGJ1ZmZlci5sZW5ndGg7XG4gICAgY29uc3QgYXJyYXlCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoNDQgKyBsZW5ndGggKiAyKTtcbiAgICBjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGFycmF5QnVmZmVyKTtcbiAgICBcbiAgICBjb25zdCB3cml0ZVN0cmluZyA9IChvZmZzZXQ6IG51bWJlciwgc3RyaW5nOiBzdHJpbmcpID0+IHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyaW5nLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZpZXcuc2V0VWludDgob2Zmc2V0ICsgaSwgc3RyaW5nLmNoYXJDb2RlQXQoaSkpO1xuICAgICAgfVxuICAgIH07XG4gICAgXG4gICAgd3JpdGVTdHJpbmcoMCwgJ1JJRkYnKTtcbiAgICB2aWV3LnNldFVpbnQzMig0LCAzNiArIGxlbmd0aCAqIDIsIHRydWUpO1xuICAgIHdyaXRlU3RyaW5nKDgsICdXQVZFJyk7XG4gICAgd3JpdGVTdHJpbmcoMTIsICdmbXQgJyk7XG4gICAgdmlldy5zZXRVaW50MzIoMTYsIDE2LCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigyMCwgMSwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMjIsIDEsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDMyKDI0LCBzYW1wbGVSYXRlLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQzMigyOCwgc2FtcGxlUmF0ZSAqIDIsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDMyLCAyLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigzNCwgMTYsIHRydWUpO1xuICAgIHdyaXRlU3RyaW5nKDM2LCAnZGF0YScpO1xuICAgIHZpZXcuc2V0VWludDMyKDQwLCBsZW5ndGggKiAyLCB0cnVlKTtcbiAgICBcbiAgICBjb25zdCBvZmZzZXQgPSA0NDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBzYW1wbGUgPSBNYXRoLm1heCgtMSwgTWF0aC5taW4oMSwgYnVmZmVyW2ldIHx8IDApKTtcbiAgICAgIHZpZXcuc2V0SW50MTYob2Zmc2V0ICsgaSAqIDIsIHNhbXBsZSAqIDB4N2ZmZiwgdHJ1ZSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBuZXcgQmxvYihbYXJyYXlCdWZmZXJdLCB7IHR5cGU6ICdhdWRpby93YXYnIH0pO1xuICB9O1xuICBcbiAgY29uc3Qgc3RhcnRGdWxsU2Vzc2lvbiA9ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0thcmFva2VBdWRpb1Byb2Nlc3Nvcl0gU3RhcnRpbmcgZnVsbCBzZXNzaW9uIHJlY29yZGluZycpO1xuICAgIHNldEZ1bGxTZXNzaW9uQnVmZmVyKFtdKTtcbiAgICBzZXRJc1Nlc3Npb25BY3RpdmUodHJ1ZSk7XG4gIH07XG4gIFxuICBjb25zdCBzdG9wRnVsbFNlc3Npb25BbmRHZXRXYXYgPSAoKTogQmxvYiB8IG51bGwgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUF1ZGlvUHJvY2Vzc29yXSBTdG9wcGluZyBmdWxsIHNlc3Npb24gcmVjb3JkaW5nJyk7XG4gICAgc2V0SXNTZXNzaW9uQWN0aXZlKGZhbHNlKTtcbiAgICBcbiAgICBjb25zdCBzZXNzaW9uQ2h1bmtzID0gZnVsbFNlc3Npb25CdWZmZXIoKTtcbiAgICBjb25zdCB3YXZCbG9iID0gY29udmVydEF1ZGlvVG9XYXZCbG9iKHNlc3Npb25DaHVua3MpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtLYXJhb2tlQXVkaW9Qcm9jZXNzb3JdIEZ1bGwgc2Vzc2lvbjogJHtzZXNzaW9uQ2h1bmtzLmxlbmd0aH0gY2h1bmtzLCBgICtcbiAgICAgICAgYCR7d2F2QmxvYiA/ICh3YXZCbG9iLnNpemUgLyAxMDI0KS50b0ZpeGVkKDEpICsgJ0tCJyA6ICdudWxsJ31gXG4gICAgKTtcbiAgICBcbiAgICBzZXRGdWxsU2Vzc2lvbkJ1ZmZlcihbXSk7XG4gICAgXG4gICAgcmV0dXJuIHdhdkJsb2I7XG4gIH07XG4gIFxuICByZXR1cm4ge1xuICAgIGlzUmVhZHksXG4gICAgZXJyb3IsXG4gICAgaXNMaXN0ZW5pbmcsXG4gICAgaXNTZXNzaW9uQWN0aXZlLFxuICAgIFxuICAgIGluaXRpYWxpemUsXG4gICAgc3RhcnRMaXN0ZW5pbmcsXG4gICAgcGF1c2VMaXN0ZW5pbmcsXG4gICAgY2xlYW51cCxcbiAgICBzdGFydFJlY29yZGluZ0xpbmUsXG4gICAgc3RvcFJlY29yZGluZ0xpbmVBbmRHZXRSYXdBdWRpbyxcbiAgICBjb252ZXJ0QXVkaW9Ub1dhdkJsb2IsXG4gICAgXG4gICAgc3RhcnRGdWxsU2Vzc2lvbixcbiAgICBzdG9wRnVsbFNlc3Npb25BbmRHZXRXYXYsXG4gIH07XG59IiwiaW1wb3J0IHR5cGUgeyBDaHVua0luZm8gfSBmcm9tICcuLi8uLi90eXBlcy9rYXJhb2tlJztcbmltcG9ydCB0eXBlIHsgTHlyaWNMaW5lIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9rYXJhb2tlL0x5cmljc0Rpc3BsYXknO1xuXG5jb25zdCBNSU5fV09SRFMgPSA4O1xuY29uc3QgTUFYX1dPUkRTID0gMTU7XG5jb25zdCBNQVhfTElORVNfUEVSX0NIVU5LID0gMztcblxuZXhwb3J0IGZ1bmN0aW9uIGNvdW50V29yZHModGV4dDogc3RyaW5nKTogbnVtYmVyIHtcbiAgcmV0dXJuIHRleHRcbiAgICAudHJpbSgpXG4gICAgLnNwbGl0KC9cXHMrLylcbiAgICAuZmlsdGVyKCh3b3JkKSA9PiB3b3JkLmxlbmd0aCA+IDApLmxlbmd0aDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZENodW5rTGluZXMoXG4gIGxpbmVzOiBMeXJpY0xpbmVbXSxcbiAgc3RhcnRJbmRleDogbnVtYmVyXG4pOiBDaHVua0luZm8ge1xuICBsZXQgdG90YWxXb3JkcyA9IDA7XG4gIGxldCBlbmRJbmRleCA9IHN0YXJ0SW5kZXg7XG4gIGNvbnN0IGV4cGVjdGVkVGV4dHM6IHN0cmluZ1tdID0gW107XG5cbiAgd2hpbGUgKGVuZEluZGV4IDwgbGluZXMubGVuZ3RoICYmIHRvdGFsV29yZHMgPCBNSU5fV09SRFMpIHtcbiAgICBjb25zdCBsaW5lID0gbGluZXNbZW5kSW5kZXhdO1xuICAgIGlmICghbGluZSkgYnJlYWs7XG4gICAgXG4gICAgY29uc3Qgd29yZHMgPSBjb3VudFdvcmRzKGxpbmUudGV4dCk7XG5cbiAgICBpZiAodG90YWxXb3JkcyArIHdvcmRzID4gTUFYX1dPUkRTICYmIHRvdGFsV29yZHMgPj0gNSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgZXhwZWN0ZWRUZXh0cy5wdXNoKGxpbmUudGV4dCk7XG4gICAgdG90YWxXb3JkcyArPSB3b3JkcztcbiAgICBlbmRJbmRleCsrO1xuXG4gICAgaWYgKGVuZEluZGV4IC0gc3RhcnRJbmRleCA+PSBNQVhfTElORVNfUEVSX0NIVU5LKSBicmVhaztcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgc3RhcnRJbmRleCxcbiAgICBlbmRJbmRleDogZW5kSW5kZXggLSAxLFxuICAgIGV4cGVjdGVkVGV4dDogZXhwZWN0ZWRUZXh0cy5qb2luKCcgJyksXG4gICAgd29yZENvdW50OiB0b3RhbFdvcmRzLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2FsY3VsYXRlUmVjb3JkaW5nRHVyYXRpb24oXG4gIGxpbmVzOiBMeXJpY0xpbmVbXSxcbiAgY2h1bmtJbmZvOiBDaHVua0luZm9cbik6IG51bWJlciB7XG4gIGNvbnN0IHsgc3RhcnRJbmRleCwgZW5kSW5kZXggfSA9IGNodW5rSW5mbztcbiAgY29uc3QgbGluZSA9IGxpbmVzW3N0YXJ0SW5kZXhdO1xuICBcbiAgaWYgKCFsaW5lKSByZXR1cm4gMzAwMDtcblxuICBpZiAoZW5kSW5kZXggPiBzdGFydEluZGV4KSB7XG4gICAgaWYgKGVuZEluZGV4ICsgMSA8IGxpbmVzLmxlbmd0aCkge1xuICAgICAgY29uc3QgbmV4dExpbmUgPSBsaW5lc1tlbmRJbmRleCArIDFdO1xuICAgICAgaWYgKG5leHRMaW5lKSB7XG4gICAgICAgIC8vIENvbnZlcnQgc2Vjb25kcyB0byBtaWxsaXNlY29uZHNcbiAgICAgICAgcmV0dXJuIChuZXh0TGluZS5zdGFydFRpbWUgLSBsaW5lLnN0YXJ0VGltZSkgKiAxMDAwO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBsZXQgZHVyYXRpb24gPSAwO1xuICAgIGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDw9IGVuZEluZGV4OyBpKyspIHtcbiAgICAgIC8vIGR1cmF0aW9uIGlzIGFscmVhZHkgaW4gbWlsbGlzZWNvbmRzXG4gICAgICBkdXJhdGlvbiArPSBsaW5lc1tpXT8uZHVyYXRpb24gfHwgMzAwMDtcbiAgICB9XG4gICAgcmV0dXJuIE1hdGgubWluKGR1cmF0aW9uLCA4MDAwKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoc3RhcnRJbmRleCArIDEgPCBsaW5lcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IG5leHRMaW5lID0gbGluZXNbc3RhcnRJbmRleCArIDFdO1xuICAgICAgaWYgKG5leHRMaW5lKSB7XG4gICAgICAgIC8vIENvbnZlcnQgc2Vjb25kcyB0byBtaWxsaXNlY29uZHNcbiAgICAgICAgY29uc3QgY2FsY3VsYXRlZER1cmF0aW9uID0gKG5leHRMaW5lLnN0YXJ0VGltZSAtIGxpbmUuc3RhcnRUaW1lKSAqIDEwMDA7XG4gICAgICAgIHJldHVybiBNYXRoLm1pbihNYXRoLm1heChjYWxjdWxhdGVkRHVyYXRpb24sIDEwMDApLCA1MDAwKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIE1hdGgubWluKGxpbmUuZHVyYXRpb24gfHwgMzAwMCwgNTAwMCk7XG4gIH1cbn0iLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcblxuZXhwb3J0IGludGVyZmFjZSBNaW5pbWl6ZWRLYXJhb2tlUHJvcHMge1xuICBvbkNsaWNrOiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgTWluaW1pemVkS2FyYW9rZTogQ29tcG9uZW50PE1pbmltaXplZEthcmFva2VQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8YnV0dG9uXG4gICAgICBvbkNsaWNrPXtwcm9wcy5vbkNsaWNrfVxuICAgICAgc3R5bGU9e3tcbiAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICAgIGJvdHRvbTogJzI0cHgnLFxuICAgICAgICByaWdodDogJzI0cHgnLFxuICAgICAgICB3aWR0aDogJzgwcHgnLFxuICAgICAgICBoZWlnaHQ6ICc4MHB4JyxcbiAgICAgICAgJ2JvcmRlci1yYWRpdXMnOiAnNTAlJyxcbiAgICAgICAgYmFja2dyb3VuZDogJ2xpbmVhci1ncmFkaWVudCgxMzVkZWcsICNGRjAwNkUgMCUsICNDMTM1ODQgMTAwJSknLFxuICAgICAgICAnYm94LXNoYWRvdyc6ICcwIDhweCAzMnB4IHJnYmEoMCwgMCwgMCwgMC4zKScsXG4gICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcbiAgICAgICAgJ2FsaWduLWl0ZW1zJzogJ2NlbnRlcicsXG4gICAgICAgICdqdXN0aWZ5LWNvbnRlbnQnOiAnY2VudGVyJyxcbiAgICAgICAgb3ZlcmZsb3c6ICdoaWRkZW4nLFxuICAgICAgICBjdXJzb3I6ICdwb2ludGVyJyxcbiAgICAgICAgJ3otaW5kZXgnOiAnOTk5OTknLFxuICAgICAgICBib3JkZXI6ICdub25lJyxcbiAgICAgICAgdHJhbnNpdGlvbjogJ3RyYW5zZm9ybSAwLjJzIGVhc2UnLFxuICAgICAgfX1cbiAgICAgIG9uTW91c2VFbnRlcj17KGUpID0+IHtcbiAgICAgICAgZS5jdXJyZW50VGFyZ2V0LnN0eWxlLnRyYW5zZm9ybSA9ICdzY2FsZSgxLjEpJztcbiAgICAgIH19XG4gICAgICBvbk1vdXNlTGVhdmU9eyhlKSA9PiB7XG4gICAgICAgIGUuY3VycmVudFRhcmdldC5zdHlsZS50cmFuc2Zvcm0gPSAnc2NhbGUoMSknO1xuICAgICAgfX1cbiAgICAgIGFyaWEtbGFiZWw9XCJPcGVuIEthcmFva2VcIlxuICAgID5cbiAgICAgIHsvKiBQbGFjZSB5b3VyIDIwMHgyMDAgaW1hZ2UgaGVyZSBhczogKi99XG4gICAgICB7LyogPGltZyBzcmM9XCIvcGF0aC90by95b3VyL2ltYWdlLnBuZ1wiIGFsdD1cIkthcmFva2VcIiBzdHlsZT1cIndpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IG9iamVjdC1maXQ6IGNvdmVyO1wiIC8+ICovfVxuICAgICAgXG4gICAgICB7LyogRm9yIG5vdywgdXNpbmcgYSBwbGFjZWhvbGRlciBpY29uICovfVxuICAgICAgPHNwYW4gc3R5bGU9e3sgJ2ZvbnQtc2l6ZSc6ICczNnB4JyB9fT7wn46kPC9zcGFuPlxuICAgIDwvYnV0dG9uPlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgSWNvblhSZWd1bGFyIGZyb20gJ3Bob3NwaG9yLWljb25zLXNvbGlkL0ljb25YUmVndWxhcic7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBQcmFjdGljZUhlYWRlclByb3BzIHtcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIG9uRXhpdDogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBQcmFjdGljZUhlYWRlcjogQ29tcG9uZW50PFByYWN0aWNlSGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGhlYWRlciBjbGFzcz17Y24oJ2ZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBoLTE0IHB4LTQgYmctdHJhbnNwYXJlbnQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkV4aXR9XG4gICAgICAgIGNsYXNzPVwicC0yIC1tbC0yIHJvdW5kZWQtZnVsbCBob3ZlcjpiZy1oaWdobGlnaHQgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICBhcmlhLWxhYmVsPVwiRXhpdCBwcmFjdGljZVwiXG4gICAgICA+XG4gICAgICAgIDxJY29uWFJlZ3VsYXIgY2xhc3M9XCJ0ZXh0LXNlY29uZGFyeSB3LTYgaC02XCIgLz5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgXG4gICAgICA8U2hvdyB3aGVuPXtwcm9wcy50aXRsZX0+XG4gICAgICAgIDxoMSBjbGFzcz1cInRleHQtbGcgZm9udC1zZW1pYm9sZCB0ZXh0LXByaW1hcnkgYWJzb2x1dGUgbGVmdC0xLzIgdHJhbnNmb3JtIC10cmFuc2xhdGUteC0xLzJcIj5cbiAgICAgICAgICB7cHJvcHMudGl0bGV9XG4gICAgICAgIDwvaDE+XG4gICAgICA8L1Nob3c+XG4gICAgICBcbiAgICAgIHsvKiBTcGFjZXIgdG8gYmFsYW5jZSB0aGUgbGF5b3V0ICovfVxuICAgICAgPGRpdiBjbGFzcz1cInctMTBcIiAvPlxuICAgIDwvaGVhZGVyPlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IFNob3csIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuaW1wb3J0IHsgVXNlclByb2ZpbGUgfSBmcm9tICcuLi9Vc2VyUHJvZmlsZSc7XG5pbXBvcnQgeyBDcmVkaXRQYWNrIH0gZnJvbSAnLi4vQ3JlZGl0UGFjayc7XG5pbXBvcnQgeyBXYWxsZXRDb25uZWN0IH0gZnJvbSAnLi4vV2FsbGV0Q29ubmVjdCc7XG5pbXBvcnQgeyBGYXJjYXN0ZXJLYXJhb2tlVmlldyB9IGZyb20gJy4uLy4uL2thcmFva2UvRmFyY2FzdGVyS2FyYW9rZVZpZXcnO1xuaW1wb3J0IHR5cGUgeyBMeXJpY0xpbmUgfSBmcm9tICcuLi8uLi9rYXJhb2tlL0x5cmljc0Rpc3BsYXknO1xuaW1wb3J0IHR5cGUgeyBMZWFkZXJib2FyZEVudHJ5IH0gZnJvbSAnLi4vLi4va2FyYW9rZS9MZWFkZXJib2FyZFBhbmVsJztcblxuZXhwb3J0IGludGVyZmFjZSBGYXJjYXN0ZXJNaW5pQXBwUHJvcHMge1xuICAvLyBVc2VyIGluZm9cbiAgdXNlcj86IHtcbiAgICBmaWQ/OiBudW1iZXI7XG4gICAgdXNlcm5hbWU/OiBzdHJpbmc7XG4gICAgZGlzcGxheU5hbWU/OiBzdHJpbmc7XG4gICAgcGZwVXJsPzogc3RyaW5nO1xuICB9O1xuICBcbiAgLy8gV2FsbGV0XG4gIHdhbGxldEFkZHJlc3M/OiBzdHJpbmc7XG4gIHdhbGxldENoYWluPzogJ0Jhc2UnIHwgJ1NvbGFuYSc7XG4gIGlzV2FsbGV0Q29ubmVjdGVkPzogYm9vbGVhbjtcbiAgXG4gIC8vIENyZWRpdHNcbiAgdXNlckNyZWRpdHM/OiBudW1iZXI7XG4gIFxuICAvLyBDYWxsYmFja3NcbiAgb25Db25uZWN0V2FsbGV0PzogKCkgPT4gdm9pZDtcbiAgb25EaXNjb25uZWN0V2FsbGV0PzogKCkgPT4gdm9pZDtcbiAgb25QdXJjaGFzZUNyZWRpdHM/OiAocGFjazogeyBjcmVkaXRzOiBudW1iZXI7IHByaWNlOiBzdHJpbmc7IGN1cnJlbmN5OiBzdHJpbmcgfSkgPT4gdm9pZDtcbiAgb25TZWxlY3RTb25nPzogKCkgPT4gdm9pZDtcbiAgXG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgRmFyY2FzdGVyTWluaUFwcDogQ29tcG9uZW50PEZhcmNhc3Rlck1pbmlBcHBQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW3Nob3dLYXJhb2tlLCBzZXRTaG93S2FyYW9rZV0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBcbiAgLy8gTW9jayBkYXRhIGZvciBkZW1vXG4gIGNvbnN0IG1vY2tMeXJpY3M6IEx5cmljTGluZVtdID0gW1xuICAgIHsgaWQ6ICcxJywgdGV4dDogXCJJcyB0aGlzIHRoZSByZWFsIGxpZmU/XCIsIHN0YXJ0VGltZTogMCwgZHVyYXRpb246IDIwMDAgfSxcbiAgICB7IGlkOiAnMicsIHRleHQ6IFwiSXMgdGhpcyBqdXN0IGZhbnRhc3k/XCIsIHN0YXJ0VGltZTogMjAwMCwgZHVyYXRpb246IDIwMDAgfSxcbiAgICB7IGlkOiAnMycsIHRleHQ6IFwiQ2F1Z2h0IGluIGEgbGFuZHNsaWRlXCIsIHN0YXJ0VGltZTogNDAwMCwgZHVyYXRpb246IDIwMDAgfSxcbiAgICB7IGlkOiAnNCcsIHRleHQ6IFwiTm8gZXNjYXBlIGZyb20gcmVhbGl0eVwiLCBzdGFydFRpbWU6IDYwMDAsIGR1cmF0aW9uOiAyMDAwIH0sXG4gIF07XG4gIFxuICBjb25zdCBtb2NrTGVhZGVyYm9hcmQ6IExlYWRlcmJvYXJkRW50cnlbXSA9IFtcbiAgICB7IHJhbms6IDEsIHVzZXJuYW1lOiBcImFsaWNlXCIsIHNjb3JlOiA5ODAgfSxcbiAgICB7IHJhbms6IDIsIHVzZXJuYW1lOiBcImJvYlwiLCBzY29yZTogOTQ1IH0sXG4gICAgeyByYW5rOiAzLCB1c2VybmFtZTogXCJjYXJvbFwiLCBzY29yZTogOTIwIH0sXG4gIF07XG5cbiAgY29uc3QgY3JlZGl0UGFja3MgPSBbXG4gICAgeyBjcmVkaXRzOiAyNTAsIHByaWNlOiAnMi41MCcsIGN1cnJlbmN5OiAnVVNEQycgYXMgY29uc3QgfSxcbiAgICB7IGNyZWRpdHM6IDUwMCwgcHJpY2U6ICc0Ljc1JywgY3VycmVuY3k6ICdVU0RDJyBhcyBjb25zdCwgZGlzY291bnQ6IDUsIHJlY29tbWVuZGVkOiB0cnVlIH0sXG4gICAgeyBjcmVkaXRzOiAxMjAwLCBwcmljZTogJzEwLjAwJywgY3VycmVuY3k6ICdVU0RDJyBhcyBjb25zdCwgZGlzY291bnQ6IDE2IH0sXG4gIF07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZmxleCBmbGV4LWNvbCBoLXNjcmVlbiBiZy1iYXNlJywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBIZWFkZXIgd2l0aCB1c2VyIHByb2ZpbGUgKi99XG4gICAgICA8ZGl2IGNsYXNzPVwiYmctc3VyZmFjZSBib3JkZXItYiBib3JkZXItc3VidGxlXCI+XG4gICAgICAgIDxVc2VyUHJvZmlsZVxuICAgICAgICAgIGZpZD17cHJvcHMudXNlcj8uZmlkfVxuICAgICAgICAgIHVzZXJuYW1lPXtwcm9wcy51c2VyPy51c2VybmFtZX1cbiAgICAgICAgICBkaXNwbGF5TmFtZT17cHJvcHMudXNlcj8uZGlzcGxheU5hbWV9XG4gICAgICAgICAgcGZwVXJsPXtwcm9wcy51c2VyPy5wZnBVcmx9XG4gICAgICAgICAgY3JlZGl0cz17cHJvcHMudXNlckNyZWRpdHMgfHwgMH1cbiAgICAgICAgLz5cbiAgICAgIDwvZGl2PlxuICAgICAgXG4gICAgICB7LyogTWFpbiBjb250ZW50ICovfVxuICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBvdmVyZmxvdy1hdXRvXCI+XG4gICAgICAgIDxTaG93XG4gICAgICAgICAgd2hlbj17c2hvd0thcmFva2UoKX1cbiAgICAgICAgICBmYWxsYmFjaz17XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwicC00IHNwYWNlLXktNlwiPlxuICAgICAgICAgICAgICB7LyogSGVybyBzZWN0aW9uICovfVxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgcHktOFwiPlxuICAgICAgICAgICAgICAgIDxoMSBjbGFzcz1cInRleHQtM3hsIGZvbnQtYm9sZCBtYi0yXCI+U2NhcmxldHQgS2FyYW9rZTwvaDE+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNlY29uZGFyeVwiPlxuICAgICAgICAgICAgICAgICAgU2luZyB5b3VyIGZhdm9yaXRlIHNvbmdzIGFuZCBjb21wZXRlIHdpdGggZnJpZW5kcyFcbiAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgey8qIENyZWRpdHMgY2hlY2sgKi99XG4gICAgICAgICAgICAgIDxTaG93XG4gICAgICAgICAgICAgICAgd2hlbj17cHJvcHMudXNlckNyZWRpdHMgJiYgcHJvcHMudXNlckNyZWRpdHMgPiAwfVxuICAgICAgICAgICAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LTZcIj5cbiAgICAgICAgICAgICAgICAgICAgey8qIFdhbGxldCBjb25uZWN0aW9uICovfVxuICAgICAgICAgICAgICAgICAgICA8V2FsbGV0Q29ubmVjdFxuICAgICAgICAgICAgICAgICAgICAgIGFkZHJlc3M9e3Byb3BzLndhbGxldEFkZHJlc3N9XG4gICAgICAgICAgICAgICAgICAgICAgY2hhaW49e3Byb3BzLndhbGxldENoYWlufVxuICAgICAgICAgICAgICAgICAgICAgIGlzQ29ubmVjdGVkPXtwcm9wcy5pc1dhbGxldENvbm5lY3RlZH1cbiAgICAgICAgICAgICAgICAgICAgICBvbkNvbm5lY3Q9e3Byb3BzLm9uQ29ubmVjdFdhbGxldH1cbiAgICAgICAgICAgICAgICAgICAgICBvbkRpc2Nvbm5lY3Q9e3Byb3BzLm9uRGlzY29ubmVjdFdhbGxldH1cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHsvKiBDcmVkaXQgcGFja3MgKi99XG4gICAgICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmlzV2FsbGV0Q29ubmVjdGVkfT5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC14bCBmb250LXNlbWlib2xkIG1iLTRcIj5QdXJjaGFzZSBDcmVkaXRzPC9oMj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJncmlkIGdyaWQtY29scy0xIG1kOmdyaWQtY29scy0zIGdhcC00XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtjcmVkaXRQYWNrcy5tYXAoKHBhY2spID0+IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Q3JlZGl0UGFja1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgey4uLnBhY2t9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvblB1cmNoYXNlPXsoKSA9PiBwcm9wcy5vblB1cmNoYXNlQ3JlZGl0cz8uKHBhY2spfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIHsvKiBTb25nIHNlbGVjdGlvbiAqL31cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS00XCI+XG4gICAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LXhsIGZvbnQtc2VtaWJvbGRcIj5TZWxlY3QgYSBTb25nPC9oMj5cbiAgICAgICAgICAgICAgICAgIDxidXR0b24gXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIHAtNCBiZy1zdXJmYWNlIHJvdW5kZWQtbGcgYm9yZGVyIGJvcmRlci1zdWJ0bGUgaG92ZXI6Ym9yZGVyLWFjY2VudC1wcmltYXJ5IHRyYW5zaXRpb24tY29sb3JzIHRleHQtbGVmdFwiXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dLYXJhb2tlKHRydWUpfVxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZm9udC1zZW1pYm9sZFwiPkJvaGVtaWFuIFJoYXBzb2R5PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtc2Vjb25kYXJ5XCI+UXVlZW48L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQteHMgdGV4dC10ZXJ0aWFyeSBtdC0xXCI+Q29zdDogNTAgY3JlZGl0czwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIH1cbiAgICAgICAgPlxuICAgICAgICAgIDxGYXJjYXN0ZXJLYXJhb2tlVmlld1xuICAgICAgICAgICAgc29uZ1RpdGxlPVwiQm9oZW1pYW4gUmhhcHNvZHlcIlxuICAgICAgICAgICAgYXJ0aXN0PVwiUXVlZW5cIlxuICAgICAgICAgICAgc2NvcmU9ezB9XG4gICAgICAgICAgICByYW5rPXsxfVxuICAgICAgICAgICAgbHlyaWNzPXttb2NrTHlyaWNzfVxuICAgICAgICAgICAgY3VycmVudFRpbWU9ezB9XG4gICAgICAgICAgICBsZWFkZXJib2FyZD17bW9ja0xlYWRlcmJvYXJkfVxuICAgICAgICAgICAgaXNQbGF5aW5nPXtmYWxzZX1cbiAgICAgICAgICAgIG9uU3RhcnQ9eygpID0+IGNvbnNvbGUubG9nKCdTdGFydCBrYXJhb2tlJyl9XG4gICAgICAgICAgICBvblNwZWVkQ2hhbmdlPXsoc3BlZWQpID0+IGNvbnNvbGUubG9nKCdTcGVlZDonLCBzcGVlZCl9XG4gICAgICAgICAgICBvbkJhY2s9eygpID0+IHNldFNob3dLYXJhb2tlKGZhbHNlKX1cbiAgICAgICAgICAvPlxuICAgICAgICA8L1Nob3c+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBGb3IgfSBmcm9tICdzb2xpZC1qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU29uZyB7XG4gIGlkOiBzdHJpbmc7XG4gIHRyYWNrSWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgYXJ0aXN0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSG9tZVBhZ2VQcm9wcyB7XG4gIHNvbmdzOiBTb25nW107XG4gIG9uU29uZ1NlbGVjdD86IChzb25nOiBTb25nKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgSG9tZVBhZ2U6IENvbXBvbmVudDxIb21lUGFnZVByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBzb25nSXRlbVN0eWxlID0ge1xuICAgIHBhZGRpbmc6ICcxNnB4JyxcbiAgICAnbWFyZ2luLWJvdHRvbSc6ICc4cHgnLFxuICAgICdiYWNrZ3JvdW5kLWNvbG9yJzogJyMxYTFhMWEnLFxuICAgICdib3JkZXItcmFkaXVzJzogJzhweCcsXG4gICAgY3Vyc29yOiAncG9pbnRlcidcbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXY+XG4gICAgICA8ZGl2IHN0eWxlPXt7IHBhZGRpbmc6ICcxNnB4JywgJ2JhY2tncm91bmQtY29sb3InOiAnIzFhMWExYScgfX0+XG4gICAgICAgIDxoMSBzdHlsZT17eyBtYXJnaW46ICcwIDAgOHB4IDAnLCAnZm9udC1zaXplJzogJzI0cHgnIH19PlBvcHVsYXIgU29uZ3M8L2gxPlxuICAgICAgICA8cCBzdHlsZT17eyBtYXJnaW46ICcwJywgY29sb3I6ICcjODg4JyB9fT5DaG9vc2UgYSBzb25nIHRvIHN0YXJ0IHNpbmdpbmc8L3A+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAnMTZweCcgfX0+XG4gICAgICAgIDxGb3IgZWFjaD17cHJvcHMuc29uZ3N9PlxuICAgICAgICAgIHsoc29uZywgaW5kZXgpID0+IChcbiAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgIHN0eWxlPXtzb25nSXRlbVN0eWxlfVxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBwcm9wcy5vblNvbmdTZWxlY3Q/Lihzb25nKX1cbiAgICAgICAgICAgICAgb25Nb3VzZUVudGVyPXsoZSkgPT4gZS5jdXJyZW50VGFyZ2V0LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcjMmEyYTJhJ31cbiAgICAgICAgICAgICAgb25Nb3VzZUxlYXZlPXsoZSkgPT4gZS5jdXJyZW50VGFyZ2V0LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcjMWExYTFhJ31cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnZmxleCcsIGdhcDogJzE2cHgnIH19PlxuICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IGNvbG9yOiAnIzY2NicgfX0+e2luZGV4KCkgKyAxfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyAnZm9udC13ZWlnaHQnOiAnYm9sZCcgfX0+e3NvbmcudGl0bGV9PC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGNvbG9yOiAnIzg4OCcgfX0+e3NvbmcuYXJ0aXN0fTwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvRm9yPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCwgb25DbGVhbnVwIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBMeXJpY0xpbmUgfSBmcm9tICcuLi9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheSc7XG5pbXBvcnQgeyBjcmVhdGVLYXJhb2tlQXVkaW9Qcm9jZXNzb3IgfSBmcm9tICcuLi9zZXJ2aWNlcy9hdWRpby9rYXJhb2tlQXVkaW9Qcm9jZXNzb3InO1xuaW1wb3J0IHsgc2hvdWxkQ2h1bmtMaW5lcywgY2FsY3VsYXRlUmVjb3JkaW5nRHVyYXRpb24gfSBmcm9tICcuLi9zZXJ2aWNlcy9rYXJhb2tlL2NodW5raW5nVXRpbHMnO1xuaW1wb3J0IHR5cGUgeyBDaHVua0luZm8gfSBmcm9tICcuLi90eXBlcy9rYXJhb2tlJztcblxuZXhwb3J0IGludGVyZmFjZSBVc2VLYXJhb2tlU2Vzc2lvbk9wdGlvbnMge1xuICBseXJpY3M6IEx5cmljTGluZVtdO1xuICBvbkNvbXBsZXRlPzogKHJlc3VsdHM6IEthcmFva2VSZXN1bHRzKSA9PiB2b2lkO1xuICBhdWRpb0VsZW1lbnQ/OiBIVE1MQXVkaW9FbGVtZW50O1xuICB0cmFja0lkPzogc3RyaW5nO1xuICBzb25nRGF0YT86IHtcbiAgICB0aXRsZTogc3RyaW5nO1xuICAgIGFydGlzdDogc3RyaW5nO1xuICAgIGFsYnVtPzogc3RyaW5nO1xuICAgIGR1cmF0aW9uPzogbnVtYmVyO1xuICB9O1xuICBhcGlVcmw/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgS2FyYW9rZVJlc3VsdHMge1xuICBzY29yZTogbnVtYmVyO1xuICBhY2N1cmFjeTogbnVtYmVyO1xuICB0b3RhbExpbmVzOiBudW1iZXI7XG4gIHBlcmZlY3RMaW5lczogbnVtYmVyO1xuICBnb29kTGluZXM6IG51bWJlcjtcbiAgbmVlZHNXb3JrTGluZXM6IG51bWJlcjtcbiAgc2Vzc2lvbklkPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIExpbmVTY29yZSB7XG4gIGxpbmVJbmRleDogbnVtYmVyO1xuICBzY29yZTogbnVtYmVyO1xuICB0cmFuc2NyaXB0aW9uOiBzdHJpbmc7XG4gIGZlZWRiYWNrPzogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXNlS2FyYW9rZVNlc3Npb24ob3B0aW9uczogVXNlS2FyYW9rZVNlc3Npb25PcHRpb25zKSB7XG4gIGNvbnN0IFtpc1BsYXlpbmcsIHNldElzUGxheWluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbY3VycmVudFRpbWUsIHNldEN1cnJlbnRUaW1lXSA9IGNyZWF0ZVNpZ25hbCgwKTtcbiAgY29uc3QgW3Njb3JlLCBzZXRTY29yZV0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFtjb3VudGRvd24sIHNldENvdW50ZG93bl0gPSBjcmVhdGVTaWduYWw8bnVtYmVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtzZXNzaW9uSWQsIHNldFNlc3Npb25JZF0gPSBjcmVhdGVTaWduYWw8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtsaW5lU2NvcmVzLCBzZXRMaW5lU2NvcmVzXSA9IGNyZWF0ZVNpZ25hbDxMaW5lU2NvcmVbXT4oW10pO1xuICBjb25zdCBbY3VycmVudENodW5rLCBzZXRDdXJyZW50Q2h1bmtdID0gY3JlYXRlU2lnbmFsPENodW5rSW5mbyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbaXNSZWNvcmRpbmcsIHNldElzUmVjb3JkaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFthdWRpb0VsZW1lbnQsIHNldEF1ZGlvRWxlbWVudF0gPSBjcmVhdGVTaWduYWw8SFRNTEF1ZGlvRWxlbWVudCB8IHVuZGVmaW5lZD4ob3B0aW9ucy5hdWRpb0VsZW1lbnQpO1xuICBjb25zdCBbcmVjb3JkZWRDaHVua3MsIHNldFJlY29yZGVkQ2h1bmtzXSA9IGNyZWF0ZVNpZ25hbDxTZXQ8bnVtYmVyPj4obmV3IFNldCgpKTtcbiAgXG4gIGxldCBhdWRpb1VwZGF0ZUludGVydmFsOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgbGV0IHJlY29yZGluZ1RpbWVvdXQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBcbiAgY29uc3QgYXVkaW9Qcm9jZXNzb3IgPSBjcmVhdGVLYXJhb2tlQXVkaW9Qcm9jZXNzb3Ioe1xuICAgIHNhbXBsZVJhdGU6IDE2MDAwXG4gIH0pO1xuICBcbiAgY29uc3QgYXBpVXJsID0gb3B0aW9ucy5hcGlVcmwgfHwgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9hcGknO1xuXG4gIGNvbnN0IHN0YXJ0U2Vzc2lvbiA9IGFzeW5jICgpID0+IHtcbiAgICAvLyBJbml0aWFsaXplIGF1ZGlvIGNhcHR1cmVcbiAgICB0cnkge1xuICAgICAgYXdhaXQgYXVkaW9Qcm9jZXNzb3IuaW5pdGlhbGl6ZSgpO1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlU2Vzc2lvbl0gQXVkaW8gcHJvY2Vzc29yIGluaXRpYWxpemVkJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIGluaXRpYWxpemUgYXVkaW86JywgZXJyb3IpO1xuICAgIH1cbiAgICBcbiAgICAvLyBDcmVhdGUgc2Vzc2lvbiBvbiBzZXJ2ZXIgaWYgdHJhY2tJZCBwcm92aWRlZFxuICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIFNlc3Npb24gY3JlYXRpb24gY2hlY2s6Jywge1xuICAgICAgaGFzVHJhY2tJZDogISFvcHRpb25zLnRyYWNrSWQsXG4gICAgICBoYXNTb25nRGF0YTogISFvcHRpb25zLnNvbmdEYXRhLFxuICAgICAgdHJhY2tJZDogb3B0aW9ucy50cmFja0lkLFxuICAgICAgc29uZ0RhdGE6IG9wdGlvbnMuc29uZ0RhdGEsXG4gICAgICBhcGlVcmxcbiAgICB9KTtcbiAgICBcbiAgICBpZiAob3B0aW9ucy50cmFja0lkICYmIG9wdGlvbnMuc29uZ0RhdGEpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIENyZWF0aW5nIHNlc3Npb24gb24gc2VydmVyLi4uJyk7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7YXBpVXJsfS9rYXJhb2tlL3N0YXJ0YCwge1xuICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgIGhlYWRlcnM6IHsgXG4gICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAgbW9kZTogJ2NvcnMnLFxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIHRyYWNrSWQ6IG9wdGlvbnMudHJhY2tJZCxcbiAgICAgICAgICAgIHNvbmdEYXRhOiBvcHRpb25zLnNvbmdEYXRhXG4gICAgICAgICAgfSlcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBTZXNzaW9uIHJlc3BvbnNlOicsIHJlc3BvbnNlLnN0YXR1cywgcmVzcG9uc2Uuc3RhdHVzVGV4dCk7XG4gICAgICAgIFxuICAgICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICAgIHNldFNlc3Npb25JZChkYXRhLnNlc3Npb24uaWQpO1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIFNlc3Npb24gY3JlYXRlZDonLCBkYXRhLnNlc3Npb24uaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGVycm9yVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZVNlc3Npb25dIEZhaWxlZCB0byBjcmVhdGUgc2Vzc2lvbjonLCByZXNwb25zZS5zdGF0dXMsIGVycm9yVGV4dCk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIGNyZWF0ZSBzZXNzaW9uOicsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlU2Vzc2lvbl0gU2tpcHBpbmcgc2Vzc2lvbiBjcmVhdGlvbiAtIG1pc3NpbmcgdHJhY2tJZCBvciBzb25nRGF0YScpO1xuICAgIH1cbiAgICBcbiAgICAvLyBTdGFydCBjb3VudGRvd25cbiAgICBzZXRDb3VudGRvd24oMyk7XG4gICAgXG4gICAgY29uc3QgY291bnRkb3duSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBjb25zdCBjdXJyZW50ID0gY291bnRkb3duKCk7XG4gICAgICBpZiAoY3VycmVudCAhPT0gbnVsbCAmJiBjdXJyZW50ID4gMSkge1xuICAgICAgICBzZXRDb3VudGRvd24oY3VycmVudCAtIDEpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2xlYXJJbnRlcnZhbChjb3VudGRvd25JbnRlcnZhbCk7XG4gICAgICAgIHNldENvdW50ZG93bihudWxsKTtcbiAgICAgICAgc3RhcnRQbGF5YmFjaygpO1xuICAgICAgfVxuICAgIH0sIDEwMDApO1xuICB9O1xuXG4gIGNvbnN0IHN0YXJ0UGxheWJhY2sgPSAoKSA9PiB7XG4gICAgc2V0SXNQbGF5aW5nKHRydWUpO1xuICAgIFxuICAgIC8vIFN0YXJ0IGZ1bGwgc2Vzc2lvbiBhdWRpbyBjYXB0dXJlXG4gICAgYXVkaW9Qcm9jZXNzb3Iuc3RhcnRGdWxsU2Vzc2lvbigpO1xuICAgIFxuICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9FbGVtZW50KCkgfHwgb3B0aW9ucy5hdWRpb0VsZW1lbnQ7XG4gICAgaWYgKGF1ZGlvKSB7XG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBTdGFydGluZyBwbGF5YmFjayB3aXRoIGF1ZGlvIGVsZW1lbnQnKTtcbiAgICAgIC8vIElmIGF1ZGlvIGVsZW1lbnQgaXMgcHJvdmlkZWQsIHVzZSBpdFxuICAgICAgYXVkaW8ucGxheSgpLmNhdGNoKGNvbnNvbGUuZXJyb3IpO1xuICAgICAgXG4gICAgICBjb25zdCB1cGRhdGVUaW1lID0gKCkgPT4ge1xuICAgICAgICBjb25zdCB0aW1lID0gYXVkaW8uY3VycmVudFRpbWUgKiAxMDAwO1xuICAgICAgICBzZXRDdXJyZW50VGltZSh0aW1lKTtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIHdlIG5lZWQgdG8gc3RhcnQgcmVjb3JkaW5nIGZvciB1cGNvbWluZyBsaW5lc1xuICAgICAgICBjaGVja0ZvclVwY29taW5nTGluZXModGltZSk7XG4gICAgICB9O1xuICAgICAgXG4gICAgICBhdWRpb1VwZGF0ZUludGVydmFsID0gc2V0SW50ZXJ2YWwodXBkYXRlVGltZSwgMTAwKSBhcyB1bmtub3duIGFzIG51bWJlcjtcbiAgICAgIFxuICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCBoYW5kbGVFbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBObyBhdWRpbyBlbGVtZW50IGF2YWlsYWJsZSBmb3IgcGxheWJhY2snKTtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBjaGVja0ZvclVwY29taW5nTGluZXMgPSAoY3VycmVudFRpbWVNczogbnVtYmVyKSA9PiB7XG4gICAgaWYgKGlzUmVjb3JkaW5nKCkgfHwgIW9wdGlvbnMubHlyaWNzLmxlbmd0aCkgcmV0dXJuO1xuICAgIFxuICAgIGNvbnN0IHJlY29yZGVkID0gcmVjb3JkZWRDaHVua3MoKTtcbiAgICBcbiAgICAvLyBMb29rIGZvciBjaHVua3MgdGhhdCBzaG91bGQgc3RhcnQgcmVjb3JkaW5nIHNvb25cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9wdGlvbnMubHlyaWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBTa2lwIGlmIHdlJ3ZlIGFscmVhZHkgcmVjb3JkZWQgYSBjaHVuayBzdGFydGluZyBhdCB0aGlzIGluZGV4XG4gICAgICBpZiAocmVjb3JkZWQuaGFzKGkpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjaHVuayA9IHNob3VsZENodW5rTGluZXMob3B0aW9ucy5seXJpY3MsIGkpO1xuICAgICAgY29uc3QgZmlyc3RMaW5lID0gb3B0aW9ucy5seXJpY3NbY2h1bmsuc3RhcnRJbmRleF07XG4gICAgICBcbiAgICAgIGlmIChmaXJzdExpbmUgJiYgZmlyc3RMaW5lLnN0YXJ0VGltZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IHJlY29yZGluZ1N0YXJ0VGltZSA9IGZpcnN0TGluZS5zdGFydFRpbWUgKiAxMDAwIC0gMTAwMDsgLy8gU3RhcnQgMXMgZWFybHlcbiAgICAgICAgY29uc3QgbGluZVN0YXJ0VGltZSA9IGZpcnN0TGluZS5zdGFydFRpbWUgKiAxMDAwO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgd2UncmUgaW4gdGhlIHJlY29yZGluZyB3aW5kb3cgYW5kIGhhdmVuJ3QgcGFzc2VkIHRoZSBsaW5lIHN0YXJ0XG4gICAgICAgIGlmIChjdXJyZW50VGltZU1zID49IHJlY29yZGluZ1N0YXJ0VGltZSAmJiBjdXJyZW50VGltZU1zIDwgbGluZVN0YXJ0VGltZSArIDUwMCkgeyAvLyBBbGxvdyA1MDBtcyBidWZmZXIgYWZ0ZXIgbGluZSBzdGFydFxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbS2FyYW9rZVNlc3Npb25dIFRpbWUgdG8gc3RhcnQgcmVjb3JkaW5nIGNodW5rICR7Y2h1bmsuc3RhcnRJbmRleH0tJHtjaHVuay5lbmRJbmRleH06ICR7Y3VycmVudFRpbWVNc31tcyBpcyBiZXR3ZWVuICR7cmVjb3JkaW5nU3RhcnRUaW1lfW1zIGFuZCAke2xpbmVTdGFydFRpbWUgKyA1MDB9bXNgKTtcbiAgICAgICAgICAvLyBNYXJrIHRoaXMgY2h1bmsgYXMgcmVjb3JkZWRcbiAgICAgICAgICBzZXRSZWNvcmRlZENodW5rcyhwcmV2ID0+IG5ldyBTZXQocHJldikuYWRkKGNodW5rLnN0YXJ0SW5kZXgpKTtcbiAgICAgICAgICAvLyBTdGFydCByZWNvcmRpbmcgdGhpcyBjaHVua1xuICAgICAgICAgIHN0YXJ0UmVjb3JkaW5nQ2h1bmsoY2h1bmspO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFNraXAgYWhlYWQgdG8gYXZvaWQgY2hlY2tpbmcgbGluZXMgd2UndmUgYWxyZWFkeSBwYXNzZWRcbiAgICAgIGkgPSBjaHVuay5lbmRJbmRleDtcbiAgICB9XG4gIH07XG4gIFxuICBjb25zdCBzdGFydFJlY29yZGluZ0NodW5rID0gYXN5bmMgKGNodW5rOiBDaHVua0luZm8pID0+IHtcbiAgICBjb25zb2xlLmxvZyhgW0thcmFva2VTZXNzaW9uXSBTdGFydGluZyByZWNvcmRpbmcgZm9yIGNodW5rICR7Y2h1bmsuc3RhcnRJbmRleH0tJHtjaHVuay5lbmRJbmRleH1gKTtcbiAgICBzZXRDdXJyZW50Q2h1bmsoY2h1bmspO1xuICAgIHNldElzUmVjb3JkaW5nKHRydWUpO1xuICAgIFxuICAgIC8vIFN0YXJ0IGF1ZGlvIGNhcHR1cmUgZm9yIHRoaXMgY2h1bmtcbiAgICBhdWRpb1Byb2Nlc3Nvci5zdGFydFJlY29yZGluZ0xpbmUoY2h1bmsuc3RhcnRJbmRleCk7XG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlIHJlY29yZGluZyBkdXJhdGlvblxuICAgIGNvbnN0IGR1cmF0aW9uID0gY2FsY3VsYXRlUmVjb3JkaW5nRHVyYXRpb24ob3B0aW9ucy5seXJpY3MsIGNodW5rKTtcbiAgICBjb25zb2xlLmxvZyhgW0thcmFva2VTZXNzaW9uXSBSZWNvcmRpbmcgZHVyYXRpb24gZm9yIGNodW5rICR7Y2h1bmsuc3RhcnRJbmRleH0tJHtjaHVuay5lbmRJbmRleH06ICR7ZHVyYXRpb259bXNgKTtcbiAgICBcbiAgICAvLyBTdG9wIHJlY29yZGluZyBhZnRlciBkdXJhdGlvblxuICAgIHJlY29yZGluZ1RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHN0b3BSZWNvcmRpbmdDaHVuaygpO1xuICAgIH0sIGR1cmF0aW9uKSBhcyB1bmtub3duIGFzIG51bWJlcjtcbiAgfTtcbiAgXG4gIGNvbnN0IHN0b3BSZWNvcmRpbmdDaHVuayA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBjaHVuayA9IGN1cnJlbnRDaHVuaygpO1xuICAgIGlmICghY2h1bmspIHJldHVybjtcbiAgICBcbiAgICBjb25zb2xlLmxvZyhgW0thcmFva2VTZXNzaW9uXSBTdG9wcGluZyByZWNvcmRpbmcgZm9yIGNodW5rICR7Y2h1bmsuc3RhcnRJbmRleH0tJHtjaHVuay5lbmRJbmRleH1gKTtcbiAgICBzZXRJc1JlY29yZGluZyhmYWxzZSk7XG4gICAgXG4gICAgLy8gR2V0IHRoZSByZWNvcmRlZCBhdWRpb1xuICAgIGNvbnN0IGF1ZGlvQ2h1bmtzID0gYXVkaW9Qcm9jZXNzb3Iuc3RvcFJlY29yZGluZ0xpbmVBbmRHZXRSYXdBdWRpbygpO1xuICAgIGNvbnN0IHdhdkJsb2IgPSBhdWRpb1Byb2Nlc3Nvci5jb252ZXJ0QXVkaW9Ub1dhdkJsb2IoYXVkaW9DaHVua3MpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGBbS2FyYW9rZVNlc3Npb25dIEF1ZGlvIGJsb2IgY3JlYXRlZDpgLCB7XG4gICAgICBoYXNCbG9iOiAhIXdhdkJsb2IsXG4gICAgICBibG9iU2l6ZTogd2F2QmxvYj8uc2l6ZSxcbiAgICAgIGNodW5rc0xlbmd0aDogYXVkaW9DaHVua3MubGVuZ3RoLFxuICAgICAgaGFzU2Vzc2lvbklkOiAhIXNlc3Npb25JZCgpLFxuICAgICAgc2Vzc2lvbklkOiBzZXNzaW9uSWQoKVxuICAgIH0pO1xuICAgIFxuICAgIC8vIENoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGF1ZGlvIGRhdGFcbiAgICBpZiAod2F2QmxvYiAmJiB3YXZCbG9iLnNpemUgPiAxMDAwICYmIHNlc3Npb25JZCgpKSB7IC8vIE1pbmltdW0gMUtCIG9mIGF1ZGlvIGRhdGFcbiAgICAgIC8vIENvbnZlcnQgdG8gYmFzZTY0IGZvciBBUElcbiAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkZW5kID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBiYXNlNjRBdWRpbyA9IHJlYWRlci5yZXN1bHQ/LnRvU3RyaW5nKCkuc3BsaXQoJywnKVsxXTtcbiAgICAgICAgaWYgKGJhc2U2NEF1ZGlvICYmIGJhc2U2NEF1ZGlvLmxlbmd0aCA+IDEwMCkgeyAvLyBFbnN1cmUgd2UgaGF2ZSBtZWFuaW5nZnVsIGJhc2U2NCBkYXRhXG4gICAgICAgICAgYXdhaXQgZ3JhZGVDaHVuayhjaHVuaywgYmFzZTY0QXVkaW8pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUud2FybignW0thcmFva2VTZXNzaW9uXSBCYXNlNjQgYXVkaW8gdG9vIHNob3J0LCBza2lwcGluZyBncmFkZScpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwod2F2QmxvYik7XG4gICAgfSBlbHNlIGlmICh3YXZCbG9iICYmIHdhdkJsb2Iuc2l6ZSA8PSAxMDAwKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ1tLYXJhb2tlU2Vzc2lvbl0gQXVkaW8gYmxvYiB0b28gc21hbGwsIHNraXBwaW5nIGdyYWRlOicsIHdhdkJsb2Iuc2l6ZSwgJ2J5dGVzJyk7XG4gICAgICAvLyBBZGQgYSBuZXV0cmFsIHNjb3JlIGZvciBVSSBmZWVkYmFja1xuICAgICAgc2V0TGluZVNjb3JlcyhwcmV2ID0+IFsuLi5wcmV2LCB7XG4gICAgICAgIGxpbmVJbmRleDogY2h1bmsuc3RhcnRJbmRleCxcbiAgICAgICAgc2NvcmU6IDUwLFxuICAgICAgICB0cmFuc2NyaXB0aW9uOiAnJyxcbiAgICAgICAgZmVlZGJhY2s6ICdSZWNvcmRpbmcgdG9vIHNob3J0J1xuICAgICAgfV0pO1xuICAgIH0gZWxzZSBpZiAod2F2QmxvYiAmJiAhc2Vzc2lvbklkKCkpIHtcbiAgICAgIGNvbnNvbGUud2FybignW0thcmFva2VTZXNzaW9uXSBIYXZlIGF1ZGlvIGJ1dCBubyBzZXNzaW9uIElEIC0gY2Fubm90IGdyYWRlJyk7XG4gICAgfVxuICAgIFxuICAgIHNldEN1cnJlbnRDaHVuayhudWxsKTtcbiAgICBcbiAgICBpZiAocmVjb3JkaW5nVGltZW91dCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHJlY29yZGluZ1RpbWVvdXQpO1xuICAgICAgcmVjb3JkaW5nVGltZW91dCA9IG51bGw7XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgZ3JhZGVDaHVuayA9IGFzeW5jIChjaHVuazogQ2h1bmtJbmZvLCBhdWRpb0Jhc2U2NDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY3VycmVudFNlc3Npb25JZCA9IHNlc3Npb25JZCgpO1xuICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIEdyYWRpbmcgY2h1bms6Jywge1xuICAgICAgaGFzU2Vzc2lvbklkOiAhIWN1cnJlbnRTZXNzaW9uSWQsXG4gICAgICBzZXNzaW9uSWQ6IGN1cnJlbnRTZXNzaW9uSWQsXG4gICAgICBjaHVua0luZGV4OiBjaHVuay5zdGFydEluZGV4LFxuICAgICAgYXVkaW9MZW5ndGg6IGF1ZGlvQmFzZTY0Lmxlbmd0aFxuICAgIH0pO1xuICAgIFxuICAgIGlmICghY3VycmVudFNlc3Npb25JZCkge1xuICAgICAgY29uc29sZS53YXJuKCdbS2FyYW9rZVNlc3Npb25dIE5vIHNlc3Npb24gSUQsIHNraXBwaW5nIGdyYWRlJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBTZW5kaW5nIGdyYWRlIHJlcXVlc3QuLi4nKTtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7YXBpVXJsfS9rYXJhb2tlL2dyYWRlYCwge1xuICAgICAgICBtb2RlOiAnY29ycycsXG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHNlc3Npb25JZDogc2Vzc2lvbklkKCksXG4gICAgICAgICAgbGluZUluZGV4OiBjaHVuay5zdGFydEluZGV4LFxuICAgICAgICAgIGF1ZGlvQnVmZmVyOiBhdWRpb0Jhc2U2NCxcbiAgICAgICAgICBleHBlY3RlZFRleHQ6IGNodW5rLmV4cGVjdGVkVGV4dCxcbiAgICAgICAgICBzdGFydFRpbWU6IG9wdGlvbnMubHlyaWNzW2NodW5rLnN0YXJ0SW5kZXhdPy5zdGFydFRpbWUgfHwgMCxcbiAgICAgICAgICBlbmRUaW1lOiAob3B0aW9ucy5seXJpY3NbY2h1bmsuZW5kSW5kZXhdPy5zdGFydFRpbWUgfHwgMCkgKyAob3B0aW9ucy5seXJpY3NbY2h1bmsuZW5kSW5kZXhdPy5kdXJhdGlvbiB8fCAwKVxuICAgICAgICB9KVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICBjb25zb2xlLmxvZyhgW0thcmFva2VTZXNzaW9uXSBDaHVuayBncmFkZWQ6YCwgZGF0YSk7XG4gICAgICAgIFxuICAgICAgICAvLyBVcGRhdGUgbGluZSBzY29yZXNcbiAgICAgICAgc2V0TGluZVNjb3JlcyhwcmV2ID0+IFsuLi5wcmV2LCB7XG4gICAgICAgICAgbGluZUluZGV4OiBjaHVuay5zdGFydEluZGV4LFxuICAgICAgICAgIHNjb3JlOiBkYXRhLnNjb3JlLFxuICAgICAgICAgIHRyYW5zY3JpcHRpb246IGRhdGEudHJhbnNjcmlwdGlvbixcbiAgICAgICAgICBmZWVkYmFjazogZGF0YS5mZWVkYmFja1xuICAgICAgICB9XSk7XG4gICAgICAgIFxuICAgICAgICAvLyBVcGRhdGUgdG90YWwgc2NvcmUgKHNpbXBsZSBhdmVyYWdlIGZvciBub3cpXG4gICAgICAgIGNvbnN0IHNjb3JlcyA9IFsuLi5saW5lU2NvcmVzKCksIHsgbGluZUluZGV4OiBjaHVuay5zdGFydEluZGV4LCBzY29yZTogZGF0YS5zY29yZSwgdHJhbnNjcmlwdGlvbjogZGF0YS50cmFuc2NyaXB0aW9uIH1dO1xuICAgICAgICBjb25zdCBhdmdTY29yZSA9IHNjb3Jlcy5yZWR1Y2UoKHN1bSwgcykgPT4gc3VtICsgcy5zY29yZSwgMCkgLyBzY29yZXMubGVuZ3RoO1xuICAgICAgICBzZXRTY29yZShNYXRoLnJvdW5kKGF2Z1Njb3JlKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlcnJvclRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG4gICAgICAgIGNvbnNvbGUud2FybihgW0thcmFva2VTZXNzaW9uXSBGYWlsZWQgdG8gZ3JhZGUgY2h1bms6YCwgcmVzcG9uc2Uuc3RhdHVzLCBlcnJvclRleHQpO1xuICAgICAgICBcbiAgICAgICAgLy8gSGFuZGxlIHNwZWNpZmljIGVycm9ycyBncmFjZWZ1bGx5XG4gICAgICAgIGlmIChlcnJvclRleHQuaW5jbHVkZXMoJ0F1ZGlvIHRvbyBzaG9ydCcpIHx8IGVycm9yVGV4dC5pbmNsdWRlcygnYXVkaW8gdG9vIHNob3J0JykpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0thcmFva2VTZXNzaW9uXSBBdWRpbyB3YXMgdG9vIHNob3J0LCBza2lwcGluZyB0aGlzIGNodW5rJyk7XG4gICAgICAgICAgLy8gT3B0aW9uYWxseSBhZGQgYSBuZXV0cmFsIHNjb3JlIG9yIHNraXAgc2NvcmluZyBmb3IgdGhpcyBjaHVua1xuICAgICAgICAgIHNldExpbmVTY29yZXMocHJldiA9PiBbLi4ucHJldiwge1xuICAgICAgICAgICAgbGluZUluZGV4OiBjaHVuay5zdGFydEluZGV4LFxuICAgICAgICAgICAgc2NvcmU6IDUwLCAvLyBOZXV0cmFsIHNjb3JlXG4gICAgICAgICAgICB0cmFuc2NyaXB0aW9uOiAnJyxcbiAgICAgICAgICAgIGZlZWRiYWNrOiAnQXVkaW8gcmVjb3JkaW5nIHdhcyB0b28gc2hvcnQnXG4gICAgICAgICAgfV0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlU2Vzc2lvbl0gRmFpbGVkIHRvIGdyYWRlIGNodW5rOicsIGVycm9yKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlRW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgaWYgKGF1ZGlvVXBkYXRlSW50ZXJ2YWwpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwoYXVkaW9VcGRhdGVJbnRlcnZhbCk7XG4gICAgfVxuICAgIFxuICAgIC8vIFN0b3AgYW55IG9uZ29pbmcgcmVjb3JkaW5nXG4gICAgaWYgKGlzUmVjb3JkaW5nKCkpIHtcbiAgICAgIHN0b3BSZWNvcmRpbmdDaHVuaygpO1xuICAgIH1cbiAgICBcbiAgICAvLyBHZXQgZnVsbCBzZXNzaW9uIGF1ZGlvXG4gICAgY29uc3QgZnVsbEF1ZGlvQmxvYiA9IGF1ZGlvUHJvY2Vzc29yLnN0b3BGdWxsU2Vzc2lvbkFuZEdldFdhdigpO1xuICAgIFxuICAgIC8vIENvbXBsZXRlIHNlc3Npb24gb24gc2VydmVyXG4gICAgaWYgKHNlc3Npb25JZCgpICYmIGZ1bGxBdWRpb0Jsb2IpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgYmFzZTY0QXVkaW8gPSByZWFkZXIucmVzdWx0Py50b1N0cmluZygpLnNwbGl0KCcsJylbMV07XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHthcGlVcmx9L2thcmFva2UvY29tcGxldGVgLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBzZXNzaW9uSWQ6IHNlc3Npb25JZCgpLFxuICAgICAgICAgICAgICBmdWxsQXVkaW9CdWZmZXI6IGJhc2U2NEF1ZGlvXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZVNlc3Npb25dIFNlc3Npb24gY29tcGxldGVkOicsIGRhdGEpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCByZXN1bHRzOiBLYXJhb2tlUmVzdWx0cyA9IHtcbiAgICAgICAgICAgICAgc2NvcmU6IGRhdGEuZmluYWxTY29yZSxcbiAgICAgICAgICAgICAgYWNjdXJhY3k6IGRhdGEuYWNjdXJhY3ksXG4gICAgICAgICAgICAgIHRvdGFsTGluZXM6IGRhdGEudG90YWxMaW5lcyxcbiAgICAgICAgICAgICAgcGVyZmVjdExpbmVzOiBkYXRhLnBlcmZlY3RMaW5lcyxcbiAgICAgICAgICAgICAgZ29vZExpbmVzOiBkYXRhLmdvb2RMaW5lcyxcbiAgICAgICAgICAgICAgbmVlZHNXb3JrTGluZXM6IGRhdGEubmVlZHNXb3JrTGluZXMsXG4gICAgICAgICAgICAgIHNlc3Npb25JZDogc2Vzc2lvbklkKCkgfHwgdW5kZWZpbmVkXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBvcHRpb25zLm9uQ29tcGxldGU/LihyZXN1bHRzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKGZ1bGxBdWRpb0Jsb2IpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VTZXNzaW9uXSBGYWlsZWQgdG8gY29tcGxldGUgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICAgIFxuICAgICAgICAvLyBGYWxsYmFjayB0byBsb2NhbCBjYWxjdWxhdGlvblxuICAgICAgICBjb25zdCBzY29yZXMgPSBsaW5lU2NvcmVzKCk7XG4gICAgICAgIGNvbnN0IGF2Z1Njb3JlID0gc2NvcmVzLmxlbmd0aCA+IDAgXG4gICAgICAgICAgPyBzY29yZXMucmVkdWNlKChzdW0sIHMpID0+IHN1bSArIHMuc2NvcmUsIDApIC8gc2NvcmVzLmxlbmd0aFxuICAgICAgICAgIDogMDtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHJlc3VsdHM6IEthcmFva2VSZXN1bHRzID0ge1xuICAgICAgICAgIHNjb3JlOiBNYXRoLnJvdW5kKGF2Z1Njb3JlKSxcbiAgICAgICAgICBhY2N1cmFjeTogTWF0aC5yb3VuZChhdmdTY29yZSksXG4gICAgICAgICAgdG90YWxMaW5lczogb3B0aW9ucy5seXJpY3MubGVuZ3RoLFxuICAgICAgICAgIHBlcmZlY3RMaW5lczogc2NvcmVzLmZpbHRlcihzID0+IHMuc2NvcmUgPj0gOTApLmxlbmd0aCxcbiAgICAgICAgICBnb29kTGluZXM6IHNjb3Jlcy5maWx0ZXIocyA9PiBzLnNjb3JlID49IDcwICYmIHMuc2NvcmUgPCA5MCkubGVuZ3RoLFxuICAgICAgICAgIG5lZWRzV29ya0xpbmVzOiBzY29yZXMuZmlsdGVyKHMgPT4gcy5zY29yZSA8IDcwKS5sZW5ndGgsXG4gICAgICAgICAgc2Vzc2lvbklkOiBzZXNzaW9uSWQoKSB8fCB1bmRlZmluZWRcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIG9wdGlvbnMub25Db21wbGV0ZT8uKHJlc3VsdHMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBObyBzZXNzaW9uLCBqdXN0IHJldHVybiBsb2NhbCByZXN1bHRzXG4gICAgICBjb25zdCBzY29yZXMgPSBsaW5lU2NvcmVzKCk7XG4gICAgICBjb25zdCBhdmdTY29yZSA9IHNjb3Jlcy5sZW5ndGggPiAwIFxuICAgICAgICA/IHNjb3Jlcy5yZWR1Y2UoKHN1bSwgcykgPT4gc3VtICsgcy5zY29yZSwgMCkgLyBzY29yZXMubGVuZ3RoXG4gICAgICAgIDogMDtcbiAgICAgIFxuICAgICAgY29uc3QgcmVzdWx0czogS2FyYW9rZVJlc3VsdHMgPSB7XG4gICAgICAgIHNjb3JlOiBNYXRoLnJvdW5kKGF2Z1Njb3JlKSxcbiAgICAgICAgYWNjdXJhY3k6IE1hdGgucm91bmQoYXZnU2NvcmUpLFxuICAgICAgICB0b3RhbExpbmVzOiBvcHRpb25zLmx5cmljcy5sZW5ndGgsXG4gICAgICAgIHBlcmZlY3RMaW5lczogc2NvcmVzLmZpbHRlcihzID0+IHMuc2NvcmUgPj0gOTApLmxlbmd0aCxcbiAgICAgICAgZ29vZExpbmVzOiBzY29yZXMuZmlsdGVyKHMgPT4gcy5zY29yZSA+PSA3MCAmJiBzLnNjb3JlIDwgOTApLmxlbmd0aCxcbiAgICAgICAgbmVlZHNXb3JrTGluZXM6IHNjb3Jlcy5maWx0ZXIocyA9PiBzLnNjb3JlIDwgNzApLmxlbmd0aFxuICAgICAgfTtcbiAgICAgIFxuICAgICAgb3B0aW9ucy5vbkNvbXBsZXRlPy4ocmVzdWx0cyk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IHN0b3BTZXNzaW9uID0gKCkgPT4ge1xuICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgc2V0Q291bnRkb3duKG51bGwpO1xuICAgIHNldElzUmVjb3JkaW5nKGZhbHNlKTtcbiAgICBzZXRDdXJyZW50Q2h1bmsobnVsbCk7XG4gICAgc2V0UmVjb3JkZWRDaHVua3MobmV3IFNldDxudW1iZXI+KCkpO1xuICAgIFxuICAgIGlmIChhdWRpb1VwZGF0ZUludGVydmFsKSB7XG4gICAgICBjbGVhckludGVydmFsKGF1ZGlvVXBkYXRlSW50ZXJ2YWwpO1xuICAgICAgYXVkaW9VcGRhdGVJbnRlcnZhbCA9IG51bGw7XG4gICAgfVxuICAgIFxuICAgIGlmIChyZWNvcmRpbmdUaW1lb3V0KSB7XG4gICAgICBjbGVhclRpbWVvdXQocmVjb3JkaW5nVGltZW91dCk7XG4gICAgICByZWNvcmRpbmdUaW1lb3V0ID0gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYXVkaW8gPSBhdWRpb0VsZW1lbnQoKSB8fCBvcHRpb25zLmF1ZGlvRWxlbWVudDtcbiAgICBpZiAoYXVkaW8pIHtcbiAgICAgIGF1ZGlvLnBhdXNlKCk7XG4gICAgICBhdWRpby5jdXJyZW50VGltZSA9IDA7XG4gICAgICBhdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCdlbmRlZCcsIGhhbmRsZUVuZCk7XG4gICAgfVxuICAgIFxuICAgIC8vIENsZWFudXAgYXVkaW8gcHJvY2Vzc29yXG4gICAgYXVkaW9Qcm9jZXNzb3IuY2xlYW51cCgpO1xuICB9O1xuXG4gIG9uQ2xlYW51cCgoKSA9PiB7XG4gICAgc3RvcFNlc3Npb24oKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICAvLyBTdGF0ZVxuICAgIGlzUGxheWluZyxcbiAgICBjdXJyZW50VGltZSxcbiAgICBzY29yZSxcbiAgICBjb3VudGRvd24sXG4gICAgc2Vzc2lvbklkLFxuICAgIGxpbmVTY29yZXMsXG4gICAgaXNSZWNvcmRpbmcsXG4gICAgY3VycmVudENodW5rLFxuICAgIFxuICAgIC8vIEFjdGlvbnNcbiAgICBzdGFydFNlc3Npb24sXG4gICAgc3RvcFNlc3Npb24sXG4gICAgXG4gICAgLy8gQXVkaW8gcHJvY2Vzc29yIChmb3IgZGlyZWN0IGFjY2VzcyBpZiBuZWVkZWQpXG4gICAgYXVkaW9Qcm9jZXNzb3IsXG4gICAgXG4gICAgLy8gTWV0aG9kIHRvIHVwZGF0ZSBhdWRpbyBlbGVtZW50IGFmdGVyIGluaXRpYWxpemF0aW9uXG4gICAgc2V0QXVkaW9FbGVtZW50XG4gIH07XG59IiwiZXhwb3J0IGludGVyZmFjZSBUcmFja0luZm8ge1xuICB0cmFja0lkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGFydGlzdDogc3RyaW5nO1xuICBwbGF0Zm9ybTogJ3NvdW5kY2xvdWQnO1xuICB1cmw6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFRyYWNrRGV0ZWN0b3Ige1xuICAvKipcbiAgICogRGV0ZWN0IGN1cnJlbnQgdHJhY2sgZnJvbSB0aGUgcGFnZSAoU291bmRDbG91ZCBvbmx5KVxuICAgKi9cbiAgZGV0ZWN0Q3VycmVudFRyYWNrKCk6IFRyYWNrSW5mbyB8IG51bGwge1xuICAgIGNvbnN0IHVybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICAgIFxuICAgIC8vIE9ubHkgd29yayBvbiBzYy5tYWlkLnpvbmUgKFNvdW5kQ2xvdWQgcHJveHkpXG4gICAgaWYgKHVybC5pbmNsdWRlcygnc2MubWFpZC56b25lJykpIHtcbiAgICAgIHJldHVybiB0aGlzLmRldGVjdFNvdW5kQ2xvdWRUcmFjaygpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIEV4dHJhY3QgdHJhY2sgaW5mbyBmcm9tIFNvdW5kQ2xvdWQgKHNjLm1haWQuem9uZSlcbiAgICovXG4gIHByaXZhdGUgZGV0ZWN0U291bmRDbG91ZFRyYWNrKCk6IFRyYWNrSW5mbyB8IG51bGwge1xuICAgIHRyeSB7XG4gICAgICAvLyBTb3VuZENsb3VkIFVSTHM6IHNjLm1haWQuem9uZS91c2VyL3RyYWNrLW5hbWVcbiAgICAgIGNvbnN0IHBhdGhQYXJ0cyA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5zcGxpdCgnLycpLmZpbHRlcihCb29sZWFuKTtcbiAgICAgIGlmIChwYXRoUGFydHMubGVuZ3RoIDwgMikgcmV0dXJuIG51bGw7XG5cbiAgICAgIGNvbnN0IGFydGlzdCA9IHBhdGhQYXJ0c1swXTtcbiAgICAgIGNvbnN0IHRyYWNrU2x1ZyA9IHBhdGhQYXJ0c1sxXTtcbiAgICAgIFxuICAgICAgLy8gVHJ5IHRvIGdldCBhY3R1YWwgdGl0bGUgZnJvbSBwYWdlIChTb3VuZENsb3VkIHNlbGVjdG9ycylcbiAgICAgIGNvbnN0IHRpdGxlU2VsZWN0b3JzID0gW1xuICAgICAgICAnLnNvdW5kVGl0bGVfX3RpdGxlJyxcbiAgICAgICAgJy50cmFja0l0ZW1fX3RyYWNrVGl0bGUnLCBcbiAgICAgICAgJ2gxW2l0ZW1wcm9wPVwibmFtZVwiXScsXG4gICAgICAgICcuc291bmRfX2hlYWRlciBoMScsXG4gICAgICAgICcuc2MtdGV4dC1oNCcsXG4gICAgICAgICcuc2MtdGV4dC1wcmltYXJ5J1xuICAgICAgXTtcblxuICAgICAgbGV0IHRpdGxlID0gJyc7XG4gICAgICBmb3IgKGNvbnN0IHNlbGVjdG9yIG9mIHRpdGxlU2VsZWN0b3JzKSB7XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgICAgICAgaWYgKGVsZW1lbnQgJiYgZWxlbWVudC50ZXh0Q29udGVudCkge1xuICAgICAgICAgIHRpdGxlID0gZWxlbWVudC50ZXh0Q29udGVudC50cmltKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gRmFsbGJhY2sgdG8gc2x1Z1xuICAgICAgaWYgKCF0aXRsZSkge1xuICAgICAgICB0aXRsZSA9IHRyYWNrU2x1Zy5yZXBsYWNlKC8tL2csICcgJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIENsZWFuIHVwIGFydGlzdCBuYW1lXG4gICAgICBjb25zdCBjbGVhbkFydGlzdCA9IGFydGlzdC5yZXBsYWNlKC8tL2csICcgJykucmVwbGFjZSgvXy9nLCAnICcpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0cmFja0lkOiBgJHthcnRpc3R9LyR7dHJhY2tTbHVnfWAsXG4gICAgICAgIHRpdGxlOiB0aXRsZSxcbiAgICAgICAgYXJ0aXN0OiBjbGVhbkFydGlzdCxcbiAgICAgICAgcGxhdGZvcm06ICdzb3VuZGNsb3VkJyxcbiAgICAgICAgdXJsOiB3aW5kb3cubG9jYXRpb24uaHJlZixcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tUcmFja0RldGVjdG9yXSBFcnJvciBkZXRlY3RpbmcgU291bmRDbG91ZCB0cmFjazonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuXG4gIC8qKlxuICAgKiBXYXRjaCBmb3IgcGFnZSBjaGFuZ2VzIChTb3VuZENsb3VkIGlzIGEgU1BBKVxuICAgKi9cbiAgd2F0Y2hGb3JDaGFuZ2VzKGNhbGxiYWNrOiAodHJhY2s6IFRyYWNrSW5mbyB8IG51bGwpID0+IHZvaWQpOiAoKSA9PiB2b2lkIHtcbiAgICBsZXQgY3VycmVudFVybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICAgIGxldCBjdXJyZW50VHJhY2sgPSB0aGlzLmRldGVjdEN1cnJlbnRUcmFjaygpO1xuICAgIFxuICAgIC8vIEluaXRpYWwgZGV0ZWN0aW9uXG4gICAgY2FsbGJhY2soY3VycmVudFRyYWNrKTtcblxuICAgIC8vIFdhdGNoIGZvciBVUkwgY2hhbmdlc1xuICAgIGNvbnN0IGNoZWNrRm9yQ2hhbmdlcyA9ICgpID0+IHtcbiAgICAgIGNvbnN0IG5ld1VybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICAgICAgaWYgKG5ld1VybCAhPT0gY3VycmVudFVybCkge1xuICAgICAgICBjdXJyZW50VXJsID0gbmV3VXJsO1xuICAgICAgICBjb25zdCBuZXdUcmFjayA9IHRoaXMuZGV0ZWN0Q3VycmVudFRyYWNrKCk7XG4gICAgICAgIFxuICAgICAgICAvLyBPbmx5IHRyaWdnZXIgY2FsbGJhY2sgaWYgdHJhY2sgYWN0dWFsbHkgY2hhbmdlZFxuICAgICAgICBjb25zdCB0cmFja0NoYW5nZWQgPSAhY3VycmVudFRyYWNrIHx8ICFuZXdUcmFjayB8fCBcbiAgICAgICAgICBjdXJyZW50VHJhY2sudHJhY2tJZCAhPT0gbmV3VHJhY2sudHJhY2tJZDtcbiAgICAgICAgICBcbiAgICAgICAgaWYgKHRyYWNrQ2hhbmdlZCkge1xuICAgICAgICAgIGN1cnJlbnRUcmFjayA9IG5ld1RyYWNrO1xuICAgICAgICAgIGNhbGxiYWNrKG5ld1RyYWNrKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBQb2xsIGZvciBjaGFuZ2VzIChTUEFzIGRvbid0IGFsd2F5cyB0cmlnZ2VyIHByb3BlciBuYXZpZ2F0aW9uIGV2ZW50cylcbiAgICBjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKGNoZWNrRm9yQ2hhbmdlcywgMTAwMCk7XG5cbiAgICAvLyBBbHNvIGxpc3RlbiBmb3IgbmF2aWdhdGlvbiBldmVudHNcbiAgICBjb25zdCBoYW5kbGVOYXZpZ2F0aW9uID0gKCkgPT4ge1xuICAgICAgc2V0VGltZW91dChjaGVja0ZvckNoYW5nZXMsIDEwMCk7IC8vIFNtYWxsIGRlbGF5IGZvciBET00gdXBkYXRlc1xuICAgIH07XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCBoYW5kbGVOYXZpZ2F0aW9uKTtcbiAgICBcbiAgICAvLyBMaXN0ZW4gZm9yIHB1c2hzdGF0ZS9yZXBsYWNlc3RhdGUgKFNvdW5kQ2xvdWQgdXNlcyB0aGVzZSlcbiAgICBjb25zdCBvcmlnaW5hbFB1c2hTdGF0ZSA9IGhpc3RvcnkucHVzaFN0YXRlO1xuICAgIGNvbnN0IG9yaWdpbmFsUmVwbGFjZVN0YXRlID0gaGlzdG9yeS5yZXBsYWNlU3RhdGU7XG4gICAgXG4gICAgaGlzdG9yeS5wdXNoU3RhdGUgPSBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgICBvcmlnaW5hbFB1c2hTdGF0ZS5hcHBseShoaXN0b3J5LCBhcmdzKTtcbiAgICAgIGhhbmRsZU5hdmlnYXRpb24oKTtcbiAgICB9O1xuICAgIFxuICAgIGhpc3RvcnkucmVwbGFjZVN0YXRlID0gZnVuY3Rpb24oLi4uYXJncykge1xuICAgICAgb3JpZ2luYWxSZXBsYWNlU3RhdGUuYXBwbHkoaGlzdG9yeSwgYXJncyk7XG4gICAgICBoYW5kbGVOYXZpZ2F0aW9uKCk7XG4gICAgfTtcblxuICAgIC8vIFJldHVybiBjbGVhbnVwIGZ1bmN0aW9uXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgaGFuZGxlTmF2aWdhdGlvbik7XG4gICAgICBoaXN0b3J5LnB1c2hTdGF0ZSA9IG9yaWdpbmFsUHVzaFN0YXRlO1xuICAgICAgaGlzdG9yeS5yZXBsYWNlU3RhdGUgPSBvcmlnaW5hbFJlcGxhY2VTdGF0ZTtcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCB0cmFja0RldGVjdG9yID0gbmV3IFRyYWNrRGV0ZWN0b3IoKTsiLCIvLyBVc2luZyBicm93c2VyLnN0b3JhZ2UgQVBJIGRpcmVjdGx5IGZvciBzaW1wbGljaXR5XG5pbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xuXG4vLyBIZWxwZXIgdG8gZ2V0IGF1dGggdG9rZW5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRBdXRoVG9rZW4oKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5nZXQoJ2F1dGhUb2tlbicpO1xuICByZXR1cm4gcmVzdWx0LmF1dGhUb2tlbiB8fCBudWxsO1xufVxuXG4vLyBIZWxwZXIgdG8gc2V0IGF1dGggdG9rZW5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXRBdXRoVG9rZW4odG9rZW46IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuc2V0KHsgYXV0aFRva2VuOiB0b2tlbiB9KTtcbn1cblxuLy8gSGVscGVyIHRvIGdldCBpbnN0YWxsYXRpb24gc3RhdGVcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRJbnN0YWxsYXRpb25TdGF0ZSgpOiBQcm9taXNlPHtcbiAgY29tcGxldGVkOiBib29sZWFuO1xuICBqd3RWZXJpZmllZDogYm9vbGVhbjtcbiAgdGltZXN0YW1wPzogbnVtYmVyO1xufT4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuZ2V0KCdpbnN0YWxsYXRpb25TdGF0ZScpO1xuICByZXR1cm4gcmVzdWx0Lmluc3RhbGxhdGlvblN0YXRlIHx8IHtcbiAgICBjb21wbGV0ZWQ6IGZhbHNlLFxuICAgIGp3dFZlcmlmaWVkOiBmYWxzZSxcbiAgfTtcbn1cblxuLy8gSGVscGVyIHRvIHNldCBpbnN0YWxsYXRpb24gc3RhdGVcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXRJbnN0YWxsYXRpb25TdGF0ZShzdGF0ZToge1xuICBjb21wbGV0ZWQ6IGJvb2xlYW47XG4gIGp3dFZlcmlmaWVkOiBib29sZWFuO1xuICB0aW1lc3RhbXA/OiBudW1iZXI7XG59KTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5zZXQoeyBpbnN0YWxsYXRpb25TdGF0ZTogc3RhdGUgfSk7XG59XG5cbi8vIEhlbHBlciB0byBjaGVjayBpZiB1c2VyIGlzIGF1dGhlbnRpY2F0ZWRcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpc0F1dGhlbnRpY2F0ZWQoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGNvbnN0IHRva2VuID0gYXdhaXQgZ2V0QXV0aFRva2VuKCk7XG4gIHJldHVybiAhIXRva2VuICYmIHRva2VuLnN0YXJ0c1dpdGgoJ3NjYXJsZXR0XycpO1xufVxuXG4vLyBIZWxwZXIgdG8gY2xlYXIgYXV0aCBkYXRhXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2xlYXJBdXRoKCk6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwucmVtb3ZlKFsnYXV0aFRva2VuJywgJ2luc3RhbGxhdGlvblN0YXRlJ10pO1xufSIsImV4cG9ydCBpbnRlcmZhY2UgS2FyYW9rZURhdGEge1xuICBzdWNjZXNzOiBib29sZWFuO1xuICB0cmFja19pZD86IHN0cmluZztcbiAgdHJhY2tJZD86IHN0cmluZztcbiAgaGFzX2thcmFva2U/OiBib29sZWFuO1xuICBoYXNLYXJhb2tlPzogYm9vbGVhbjtcbiAgc29uZz86IHtcbiAgICBpZDogc3RyaW5nO1xuICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgYXJ0aXN0OiBzdHJpbmc7XG4gICAgYWxidW0/OiBzdHJpbmc7XG4gICAgYXJ0d29ya1VybD86IHN0cmluZztcbiAgICBkdXJhdGlvbj86IG51bWJlcjtcbiAgICBkaWZmaWN1bHR5OiAnYmVnaW5uZXInIHwgJ2ludGVybWVkaWF0ZScgfCAnYWR2YW5jZWQnO1xuICB9O1xuICBseXJpY3M/OiB7XG4gICAgc291cmNlOiBzdHJpbmc7XG4gICAgdHlwZTogJ3N5bmNlZCc7XG4gICAgbGluZXM6IEx5cmljTGluZVtdO1xuICAgIHRvdGFsTGluZXM6IG51bWJlcjtcbiAgfTtcbiAgbWVzc2FnZT86IHN0cmluZztcbiAgZXJyb3I/OiBzdHJpbmc7XG4gIGFwaV9jb25uZWN0ZWQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEx5cmljTGluZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRleHQ6IHN0cmluZztcbiAgc3RhcnRUaW1lOiBudW1iZXI7XG4gIGR1cmF0aW9uOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgS2FyYW9rZVNlc3Npb24ge1xuICBpZDogc3RyaW5nO1xuICB0cmFja0lkOiBzdHJpbmc7XG4gIHNvbmdUaXRsZTogc3RyaW5nO1xuICBzb25nQXJ0aXN0OiBzdHJpbmc7XG4gIHN0YXR1czogc3RyaW5nO1xuICBjcmVhdGVkQXQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEthcmFva2VBcGlTZXJ2aWNlIHtcbiAgcHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgLy8gVXNlIHRoZSBsb2NhbCBzZXJ2ZXIgZW5kcG9pbnRcbiAgICB0aGlzLmJhc2VVcmwgPSAnaHR0cDovL2xvY2FsaG9zdDo4Nzg3L2FwaSc7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGthcmFva2UgZGF0YSBmb3IgYSB0cmFjayBJRCAoWW91VHViZS9Tb3VuZENsb3VkKVxuICAgKi9cbiAgYXN5bmMgZ2V0S2FyYW9rZURhdGEoXG4gICAgdHJhY2tJZDogc3RyaW5nLCBcbiAgICB0aXRsZT86IHN0cmluZywgXG4gICAgYXJ0aXN0Pzogc3RyaW5nXG4gICk6IFByb21pc2U8S2FyYW9rZURhdGEgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoKTtcbiAgICAgIGlmICh0aXRsZSkgcGFyYW1zLnNldCgndGl0bGUnLCB0aXRsZSk7XG4gICAgICBpZiAoYXJ0aXN0KSBwYXJhbXMuc2V0KCdhcnRpc3QnLCBhcnRpc3QpO1xuICAgICAgXG4gICAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2thcmFva2UvJHtlbmNvZGVVUklDb21wb25lbnQodHJhY2tJZCl9JHtwYXJhbXMudG9TdHJpbmcoKSA/ICc/JyArIHBhcmFtcy50b1N0cmluZygpIDogJyd9YDtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXBpXSBGZXRjaGluZyBrYXJhb2tlIGRhdGE6JywgdXJsKTtcbiAgICAgIFxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgLy8gUmVtb3ZlIENvbnRlbnQtVHlwZSBoZWFkZXIgdG8gYXZvaWQgQ09SUyBwcmVmbGlnaHRcbiAgICAgICAgLy8gaGVhZGVyczoge1xuICAgICAgICAvLyAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIC8vIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIGZldGNoIGthcmFva2UgZGF0YTonLCByZXNwb25zZS5zdGF0dXMpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUFwaV0gUmVjZWl2ZWQga2FyYW9rZSBkYXRhOicsIGRhdGEpO1xuICAgICAgXG4gICAgICAvLyBJZiB0aGVyZSdzIGFuIGVycm9yIGJ1dCB3ZSBnb3QgYSByZXNwb25zZSwgaXQgbWVhbnMgQVBJIGlzIGNvbm5lY3RlZFxuICAgICAgaWYgKGRhdGEuZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tLYXJhb2tlQXBpXSBTZXJ2ZXIgZXJyb3IgKGJ1dCBBUEkgaXMgcmVhY2hhYmxlKTonLCBkYXRhLmVycm9yKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBoYXNfa2FyYW9rZTogZmFsc2UsXG4gICAgICAgICAgZXJyb3I6IGRhdGEuZXJyb3IsXG4gICAgICAgICAgdHJhY2tfaWQ6IHRyYWNrSWQsXG4gICAgICAgICAgYXBpX2Nvbm5lY3RlZDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEVycm9yIGZldGNoaW5nIGthcmFva2UgZGF0YTonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgYSBrYXJhb2tlIHNlc3Npb25cbiAgICovXG4gIGFzeW5jIHN0YXJ0U2Vzc2lvbihcbiAgICB0cmFja0lkOiBzdHJpbmcsXG4gICAgc29uZ0RhdGE6IHtcbiAgICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgICBhcnRpc3Q6IHN0cmluZztcbiAgICAgIGFsYnVtPzogc3RyaW5nO1xuICAgICAgZHVyYXRpb24/OiBudW1iZXI7XG4gICAgfVxuICApOiBQcm9taXNlPEthcmFva2VTZXNzaW9uIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuYmFzZVVybH0va2FyYW9rZS9zdGFydGAsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgIC8vIFRPRE86IEFkZCBhdXRoIHRva2VuIHdoZW4gYXZhaWxhYmxlXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICB0cmFja0lkLFxuICAgICAgICAgIHNvbmdEYXRhLFxuICAgICAgICB9KSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBGYWlsZWQgdG8gc3RhcnQgc2Vzc2lvbjonLCByZXNwb25zZS5zdGF0dXMpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgcmV0dXJuIHJlc3VsdC5zZXNzaW9uO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRXJyb3Igc3RhcnRpbmcgc2Vzc2lvbjonLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGVzdCBjb25uZWN0aW9uIHRvIHRoZSBBUElcbiAgICovXG4gIGFzeW5jIHRlc3RDb25uZWN0aW9uKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuYmFzZVVybC5yZXBsYWNlKCcvYXBpJywgJycpfS9oZWFsdGhgKTtcbiAgICAgIHJldHVybiByZXNwb25zZS5vaztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIENvbm5lY3Rpb24gdGVzdCBmYWlsZWQ6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY29uc3Qga2FyYW9rZUFwaSA9IG5ldyBLYXJhb2tlQXBpU2VydmljZSgpOyIsImltcG9ydCB7IENvbXBvbmVudCwgY3JlYXRlU2lnbmFsLCBjcmVhdGVFZmZlY3QsIG9uTW91bnQsIG9uQ2xlYW51cCwgU2hvdyB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkthcmFva2VWaWV3LCBNaW5pbWl6ZWRLYXJhb2tlLCBDb3VudGRvd24sIHVzZUthcmFva2VTZXNzaW9uLCBFeHRlbnNpb25BdWRpb1NlcnZpY2UgfSBmcm9tICdAc2NhcmxldHQvdWknO1xuaW1wb3J0IHsgdHJhY2tEZXRlY3RvciwgdHlwZSBUcmFja0luZm8gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy90cmFjay1kZXRlY3Rvcic7XG5pbXBvcnQgeyBnZXRBdXRoVG9rZW4gfSBmcm9tICcuLi8uLi91dGlscy9zdG9yYWdlJztcbmltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG5pbXBvcnQgeyBrYXJhb2tlQXBpIH0gZnJvbSAnLi4vLi4vc2VydmljZXMva2FyYW9rZS1hcGknO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbnRlbnRBcHBQcm9wcyB7fVxuXG5leHBvcnQgY29uc3QgQ29udGVudEFwcDogQ29tcG9uZW50PENvbnRlbnRBcHBQcm9wcz4gPSAoKSA9PiB7XG4gIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUmVuZGVyaW5nIENvbnRlbnRBcHAgY29tcG9uZW50Jyk7XG4gIFxuICAvLyBTdGF0ZVxuICBjb25zdCBbY3VycmVudFRyYWNrLCBzZXRDdXJyZW50VHJhY2tdID0gY3JlYXRlU2lnbmFsPFRyYWNrSW5mbyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbYXV0aFRva2VuLCBzZXRBdXRoVG9rZW5dID0gY3JlYXRlU2lnbmFsPHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbc2hvd0thcmFva2UsIHNldFNob3dLYXJhb2tlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtrYXJhb2tlRGF0YSwgc2V0S2FyYW9rZURhdGFdID0gY3JlYXRlU2lnbmFsPGFueT4obnVsbCk7XG4gIGNvbnN0IFtsb2FkaW5nLCBzZXRMb2FkaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtzZXNzaW9uU3RhcnRlZCwgc2V0U2Vzc2lvblN0YXJ0ZWRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2lzTWluaW1pemVkLCBzZXRJc01pbmltaXplZF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbY291bnRkb3duLCBzZXRDb3VudGRvd25dID0gY3JlYXRlU2lnbmFsPG51bWJlciB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbaXNQbGF5aW5nLCBzZXRJc1BsYXlpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2N1cnJlbnRUaW1lLCBzZXRDdXJyZW50VGltZV0gPSBjcmVhdGVTaWduYWwoMCk7XG4gIGNvbnN0IFthdWRpb1JlZiwgc2V0QXVkaW9SZWZdID0gY3JlYXRlU2lnbmFsPEhUTUxBdWRpb0VsZW1lbnQgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2thcmFva2VTZXNzaW9uLCBzZXRLYXJhb2tlU2Vzc2lvbl0gPSBjcmVhdGVTaWduYWw8UmV0dXJuVHlwZTx0eXBlb2YgdXNlS2FyYW9rZVNlc3Npb24+IHwgbnVsbD4obnVsbCk7XG4gIFxuICAvLyBMb2FkIGF1dGggdG9rZW4gb24gbW91bnRcbiAgb25Nb3VudChhc3luYyAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBMb2FkaW5nIGF1dGggdG9rZW4nKTtcbiAgICBjb25zdCB0b2tlbiA9IGF3YWl0IGdldEF1dGhUb2tlbigpO1xuICAgIGlmICh0b2tlbikge1xuICAgICAgc2V0QXV0aFRva2VuKHRva2VuKTtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXV0aCB0b2tlbiBsb2FkZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVXNlIGRlbW8gdG9rZW4gZm9yIGRldmVsb3BtZW50XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE5vIGF1dGggdG9rZW4gZm91bmQsIHVzaW5nIGRlbW8gdG9rZW4nKTtcbiAgICAgIHNldEF1dGhUb2tlbignc2NhcmxldHRfZGVtb190b2tlbl8xMjMnKTtcbiAgICB9XG4gICAgXG4gICAgLy8gU3RhcnQgd2F0Y2hpbmcgZm9yIHRyYWNrIGNoYW5nZXNcbiAgICBjb25zdCBjbGVhbnVwID0gdHJhY2tEZXRlY3Rvci53YXRjaEZvckNoYW5nZXMoKHRyYWNrKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFRyYWNrIGNoYW5nZWQ6JywgdHJhY2spO1xuICAgICAgc2V0Q3VycmVudFRyYWNrKHRyYWNrKTtcbiAgICAgIC8vIFNob3cga2FyYW9rZSB3aGVuIHRyYWNrIGlzIGRldGVjdGVkIGFuZCBmZXRjaCBkYXRhXG4gICAgICBpZiAodHJhY2spIHtcbiAgICAgICAgc2V0U2hvd0thcmFva2UodHJ1ZSk7XG4gICAgICAgIGZldGNoS2FyYW9rZURhdGEodHJhY2spO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgb25DbGVhbnVwKGNsZWFudXApO1xuICB9KTtcblxuICBjb25zdCBmZXRjaEthcmFva2VEYXRhID0gYXN5bmMgKHRyYWNrOiBUcmFja0luZm8pID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZldGNoaW5nIGthcmFva2UgZGF0YSBmb3IgdHJhY2s6JywgdHJhY2spO1xuICAgIHNldExvYWRpbmcodHJ1ZSk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBrYXJhb2tlQXBpLmdldEthcmFva2VEYXRhKFxuICAgICAgICB0cmFjay50cmFja0lkLFxuICAgICAgICB0cmFjay50aXRsZSxcbiAgICAgICAgdHJhY2suYXJ0aXN0XG4gICAgICApO1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBLYXJhb2tlIGRhdGEgbG9hZGVkOicsIGRhdGEpO1xuICAgICAgc2V0S2FyYW9rZURhdGEoZGF0YSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tDb250ZW50QXBwXSBGYWlsZWQgdG8gZmV0Y2gga2FyYW9rZSBkYXRhOicsIGVycm9yKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0TG9hZGluZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVN0YXJ0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU3RhcnQga2FyYW9rZSBzZXNzaW9uJyk7XG4gICAgc2V0U2Vzc2lvblN0YXJ0ZWQodHJ1ZSk7XG4gICAgXG4gICAgY29uc3QgZGF0YSA9IGthcmFva2VEYXRhKCk7XG4gICAgY29uc3QgYXVkaW8gPSBhdWRpb1JlZigpO1xuICAgIGNvbnN0IHRyYWNrID0gY3VycmVudFRyYWNrKCk7XG4gICAgXG4gICAgaWYgKGRhdGEgJiYgdHJhY2sgJiYgZGF0YS5seXJpY3M/LmxpbmVzKSB7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIENyZWF0aW5nIGthcmFva2Ugc2Vzc2lvbiB3aXRoIGF1ZGlvIGNhcHR1cmUnLCB7XG4gICAgICAgIHRyYWNrSWQ6IHRyYWNrLmlkLFxuICAgICAgICB0cmFja1RpdGxlOiB0cmFjay50aXRsZSxcbiAgICAgICAgc29uZ0RhdGE6IGRhdGEuc29uZyxcbiAgICAgICAgaGFzTHlyaWNzOiAhIWRhdGEubHlyaWNzPy5saW5lc1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIENyZWF0ZSBhbmQgc3RhcnQgc2Vzc2lvblxuICAgICAgY29uc3QgbmV3U2Vzc2lvbiA9IHVzZUthcmFva2VTZXNzaW9uKHtcbiAgICAgICAgbHlyaWNzOiBkYXRhLmx5cmljcy5saW5lcyxcbiAgICAgICAgdHJhY2tJZDogdHJhY2sudHJhY2tJZCxcbiAgICAgICAgc29uZ0RhdGE6IGRhdGEuc29uZyA/IHtcbiAgICAgICAgICB0aXRsZTogZGF0YS5zb25nLnRpdGxlLFxuICAgICAgICAgIGFydGlzdDogZGF0YS5zb25nLmFydGlzdCxcbiAgICAgICAgICBhbGJ1bTogZGF0YS5zb25nLmFsYnVtLFxuICAgICAgICAgIGR1cmF0aW9uOiBkYXRhLnNvbmcuZHVyYXRpb25cbiAgICAgICAgfSA6IHtcbiAgICAgICAgICB0aXRsZTogdHJhY2sudGl0bGUsXG4gICAgICAgICAgYXJ0aXN0OiB0cmFjay5hcnRpc3RcbiAgICAgICAgfSxcbiAgICAgICAgYXVkaW9FbGVtZW50OiB1bmRlZmluZWQsIC8vIFdpbGwgYmUgc2V0IHdoZW4gYXVkaW8gc3RhcnRzIHBsYXlpbmdcbiAgICAgICAgYXBpVXJsOiAnaHR0cDovL2xvY2FsaG9zdDo4Nzg3L2FwaScsXG4gICAgICAgIG9uQ29tcGxldGU6IChyZXN1bHRzKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBLYXJhb2tlIHNlc3Npb24gY29tcGxldGVkOicsIHJlc3VsdHMpO1xuICAgICAgICAgIHNldFNlc3Npb25TdGFydGVkKGZhbHNlKTtcbiAgICAgICAgICAvLyBUT0RPOiBTaG93IHJlc3VsdHMgVUlcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIHNldEthcmFva2VTZXNzaW9uKG5ld1Nlc3Npb24pO1xuICAgICAgXG4gICAgICAvLyBTdGFydCB0aGUgc2Vzc2lvbiAoaW5jbHVkZXMgY291bnRkb3duIGFuZCBhdWRpbyBpbml0aWFsaXphdGlvbilcbiAgICAgIGF3YWl0IG5ld1Nlc3Npb24uc3RhcnRTZXNzaW9uKCk7XG4gICAgICBcbiAgICAgIC8vIFdhdGNoIGZvciBjb3VudGRvd24gdG8gZmluaXNoIGFuZCBzdGFydCBhdWRpb1xuICAgICAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKG5ld1Nlc3Npb24uY291bnRkb3duKCkgPT09IG51bGwgJiYgbmV3U2Vzc2lvbi5pc1BsYXlpbmcoKSAmJiAhaXNQbGF5aW5nKCkpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIENvdW50ZG93biBmaW5pc2hlZCwgc3RhcnRpbmcgYXVkaW8gcGxheWJhY2snKTtcbiAgICAgICAgICBzdGFydEF1ZGlvUGxheWJhY2soKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gVXBkYXRlIHNlc3Npb24gd2l0aCBhdWRpbyBlbGVtZW50IHdoZW4gYXZhaWxhYmxlXG4gICAgICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9SZWYoKTtcbiAgICAgICAgaWYgKGF1ZGlvICYmIG5ld1Nlc3Npb24pIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFNldHRpbmcgYXVkaW8gZWxlbWVudCBvbiBuZXcgc2Vzc2lvbicpO1xuICAgICAgICAgIG5ld1Nlc3Npb24uc2V0QXVkaW9FbGVtZW50KGF1ZGlvKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRmFsbGJhY2sgdG8gc2ltcGxlIGNvdW50ZG93bicpO1xuICAgICAgLy8gRmFsbGJhY2sgdG8gb2xkIGJlaGF2aW9yXG4gICAgICBzZXRDb3VudGRvd24oMyk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNvdW50ZG93bkludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gY291bnRkb3duKCk7XG4gICAgICAgIGlmIChjdXJyZW50ICE9PSBudWxsICYmIGN1cnJlbnQgPiAxKSB7XG4gICAgICAgICAgc2V0Q291bnRkb3duKGN1cnJlbnQgLSAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjbGVhckludGVydmFsKGNvdW50ZG93bkludGVydmFsKTtcbiAgICAgICAgICBzZXRDb3VudGRvd24obnVsbCk7XG4gICAgICAgICAgc3RhcnRBdWRpb1BsYXliYWNrKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIDEwMDApO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBzdGFydEF1ZGlvUGxheWJhY2sgPSAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTdGFydGluZyBhdWRpbyBwbGF5YmFjaycpO1xuICAgIHNldElzUGxheWluZyh0cnVlKTtcbiAgICBcbiAgICAvLyBUcnkgbXVsdGlwbGUgbWV0aG9kcyB0byBmaW5kIGFuZCBwbGF5IGF1ZGlvXG4gICAgLy8gTWV0aG9kIDE6IExvb2sgZm9yIGF1ZGlvIGVsZW1lbnRzXG4gICAgY29uc3QgYXVkaW9FbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2F1ZGlvJyk7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGb3VuZCBhdWRpbyBlbGVtZW50czonLCBhdWRpb0VsZW1lbnRzLmxlbmd0aCk7XG4gICAgXG4gICAgaWYgKGF1ZGlvRWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgYXVkaW8gPSBhdWRpb0VsZW1lbnRzWzBdIGFzIEhUTUxBdWRpb0VsZW1lbnQ7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEF1ZGlvIGVsZW1lbnQ6Jywge1xuICAgICAgICBzcmM6IGF1ZGlvLnNyYyxcbiAgICAgICAgcGF1c2VkOiBhdWRpby5wYXVzZWQsXG4gICAgICAgIGR1cmF0aW9uOiBhdWRpby5kdXJhdGlvbixcbiAgICAgICAgY3VycmVudFRpbWU6IGF1ZGlvLmN1cnJlbnRUaW1lXG4gICAgICB9KTtcbiAgICAgIHNldEF1ZGlvUmVmKGF1ZGlvKTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIGthcmFva2Ugc2Vzc2lvbiB3aXRoIGF1ZGlvIGVsZW1lbnQgaWYgaXQgZXhpc3RzXG4gICAgICBjb25zdCBzZXNzaW9uID0ga2FyYW9rZVNlc3Npb24oKTtcbiAgICAgIGlmIChzZXNzaW9uKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gU2V0dGluZyBhdWRpbyBlbGVtZW50IG9uIGthcmFva2Ugc2Vzc2lvbicpO1xuICAgICAgICBzZXNzaW9uLnNldEF1ZGlvRWxlbWVudChhdWRpbyk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlc3Npb24uYXVkaW9Qcm9jZXNzb3IuaXNSZWFkeSgpKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBJbml0aWFsaXppbmcgYXVkaW8gcHJvY2Vzc29yIGZvciBzZXNzaW9uJyk7XG4gICAgICAgICAgc2Vzc2lvbi5hdWRpb1Byb2Nlc3Nvci5pbml0aWFsaXplKCkuY2F0Y2goY29uc29sZS5lcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gVHJ5IHRvIHBsYXkgdGhlIGF1ZGlvXG4gICAgICBhdWRpby5wbGF5KCkudGhlbigoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gQXVkaW8gc3RhcnRlZCBwbGF5aW5nIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgfSkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0NvbnRlbnRBcHBdIEZhaWxlZCB0byBwbGF5IGF1ZGlvOicsIGVycik7XG4gICAgICAgIFxuICAgICAgICAvLyBNZXRob2QgMjogVHJ5IGNsaWNraW5nIHRoZSBwbGF5IGJ1dHRvbiBvbiB0aGUgcGFnZVxuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEF0dGVtcHRpbmcgdG8gY2xpY2sgcGxheSBidXR0b24uLi4nKTtcbiAgICAgICAgY29uc3QgcGxheUJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvblt0aXRsZSo9XCJQbGF5XCJdLCBidXR0b25bYXJpYS1sYWJlbCo9XCJQbGF5XCJdLCAucGxheUNvbnRyb2wsIC5wbGF5QnV0dG9uLCBbY2xhc3MqPVwicGxheS1idXR0b25cIl0nKTtcbiAgICAgICAgaWYgKHBsYXlCdXR0b24pIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZvdW5kIHBsYXkgYnV0dG9uLCBjbGlja2luZyBpdCcpO1xuICAgICAgICAgIChwbGF5QnV0dG9uIGFzIEhUTUxFbGVtZW50KS5jbGljaygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIGN1cnJlbnQgdGltZVxuICAgICAgY29uc3QgdXBkYXRlVGltZSA9ICgpID0+IHtcbiAgICAgICAgc2V0Q3VycmVudFRpbWUoYXVkaW8uY3VycmVudFRpbWUpO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIHVwZGF0ZVRpbWUpO1xuICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCAoKSA9PiB7XG4gICAgICAgIHNldElzUGxheWluZyhmYWxzZSk7XG4gICAgICAgIGF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB1cGRhdGVUaW1lKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBNZXRob2QgMzogVHJ5IFNvdW5kQ2xvdWQgc3BlY2lmaWMgc2VsZWN0b3JzXG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE5vIGF1ZGlvIGVsZW1lbnRzIGZvdW5kLCB0cnlpbmcgU291bmRDbG91ZC1zcGVjaWZpYyBhcHByb2FjaCcpO1xuICAgICAgY29uc3QgcGxheUJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5wbGF5Q29udHJvbCwgLnNjLWJ1dHRvbi1wbGF5LCBidXR0b25bdGl0bGUqPVwiUGxheVwiXScpO1xuICAgICAgaWYgKHBsYXlCdXR0b24pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGb3VuZCBTb3VuZENsb3VkIHBsYXkgYnV0dG9uLCBjbGlja2luZyBpdCcpO1xuICAgICAgICAocGxheUJ1dHRvbiBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFdhaXQgYSBiaXQgYW5kIHRoZW4gbG9vayBmb3IgYXVkaW8gZWxlbWVudCBhZ2FpblxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICBjb25zdCBuZXdBdWRpb0VsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnYXVkaW8nKTtcbiAgICAgICAgICBpZiAobmV3QXVkaW9FbGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEZvdW5kIGF1ZGlvIGVsZW1lbnQgYWZ0ZXIgY2xpY2tpbmcgcGxheScpO1xuICAgICAgICAgICAgY29uc3QgYXVkaW8gPSBuZXdBdWRpb0VsZW1lbnRzWzBdIGFzIEhUTUxBdWRpb0VsZW1lbnQ7XG4gICAgICAgICAgICBzZXRBdWRpb1JlZihhdWRpbyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFVwZGF0ZSBjdXJyZW50IHRpbWVcbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZVRpbWUgPSAoKSA9PiB7XG4gICAgICAgICAgICAgIHNldEN1cnJlbnRUaW1lKGF1ZGlvLmN1cnJlbnRUaW1lKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB1cGRhdGVUaW1lKTtcbiAgICAgICAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgKCkgPT4ge1xuICAgICAgICAgICAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgICAgICAgICAgICBhdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdXBkYXRlVGltZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIDUwMCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUNsb3NlID0gKCkgPT4ge1xuICAgIC8vIFN0b3Agc2Vzc2lvbiBpZiBhY3RpdmVcbiAgICBjb25zdCBzZXNzaW9uID0ga2FyYW9rZVNlc3Npb24oKTtcbiAgICBpZiAoc2Vzc2lvbikge1xuICAgICAgc2Vzc2lvbi5zdG9wU2Vzc2lvbigpO1xuICAgIH1cbiAgICBcbiAgICBzZXRTaG93S2FyYW9rZShmYWxzZSk7XG4gICAgc2V0S2FyYW9rZURhdGEobnVsbCk7XG4gICAgc2V0U2Vzc2lvblN0YXJ0ZWQoZmFsc2UpO1xuICAgIHNldEthcmFva2VTZXNzaW9uKG51bGwpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZU1pbmltaXplID0gKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTWluaW1pemUga2FyYW9rZSB3aWRnZXQnKTtcbiAgICBzZXRJc01pbmltaXplZCh0cnVlKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVSZXN0b3JlID0gKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUmVzdG9yZSBrYXJhb2tlIHdpZGdldCcpO1xuICAgIHNldElzTWluaW1pemVkKGZhbHNlKTtcbiAgfTtcblxuICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlbmRlciBzdGF0ZTonLCB7XG4gICAgc2hvd0thcmFva2U6IHNob3dLYXJhb2tlKCksXG4gICAgY3VycmVudFRyYWNrOiBjdXJyZW50VHJhY2soKSxcbiAgICBrYXJhb2tlRGF0YToga2FyYW9rZURhdGEoKSxcbiAgICBsb2FkaW5nOiBsb2FkaW5nKClcbiAgfSk7XG5cbiAgY29uc3QgaGFuZGxlQ29tcGxldGUgPSAocmVzdWx0czogYW55KSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBLYXJhb2tlIHNlc3Npb24gY29tcGxldGVkOicsIHJlc3VsdHMpO1xuICAgIHNldFNlc3Npb25TdGFydGVkKGZhbHNlKTtcbiAgICAvLyBUT0RPOiBTaG93IHJlc3VsdHMgc2NyZWVuXG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAgey8qIE1pbmltaXplZCBzdGF0ZSAqL31cbiAgICAgIDxTaG93IHdoZW49e3Nob3dLYXJhb2tlKCkgJiYgY3VycmVudFRyYWNrKCkgJiYgaXNNaW5pbWl6ZWQoKX0+XG4gICAgICAgIDxNaW5pbWl6ZWRLYXJhb2tlIG9uQ2xpY2s9e2hhbmRsZVJlc3RvcmV9IC8+XG4gICAgICA8L1Nob3c+XG5cbiAgICAgIHsvKiBGdWxsIHdpZGdldCBzdGF0ZSAqL31cbiAgICAgIDxTaG93IHdoZW49e3Nob3dLYXJhb2tlKCkgJiYgY3VycmVudFRyYWNrKCkgJiYgIWlzTWluaW1pemVkKCl9IGZhbGxiYWNrPXtcbiAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnbm9uZScgfX0+XG4gICAgICAgICAge2NvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTm90IHNob3dpbmcgLSBzaG93S2FyYW9rZTonLCBzaG93S2FyYW9rZSgpLCAnY3VycmVudFRyYWNrOicsIGN1cnJlbnRUcmFjaygpKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICB9PlxuICAgICAgICA8ZGl2IHN0eWxlPXt7XG4gICAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICAgICAgdG9wOiAnMjBweCcsXG4gICAgICAgICAgcmlnaHQ6ICcyMHB4JyxcbiAgICAgICAgICBib3R0b206ICcyMHB4JyxcbiAgICAgICAgICB3aWR0aDogJzQ4MHB4JyxcbiAgICAgICAgICAnei1pbmRleCc6ICc5OTk5OScsXG4gICAgICAgICAgb3ZlcmZsb3c6ICdoaWRkZW4nLFxuICAgICAgICAgICdib3JkZXItcmFkaXVzJzogJzE2cHgnLFxuICAgICAgICAgICdib3gtc2hhZG93JzogJzAgMjVweCA1MHB4IC0xMnB4IHJnYmEoMCwgMCwgMCwgMC42KScsXG4gICAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxuICAgICAgICAgICdmbGV4LWRpcmVjdGlvbic6ICdjb2x1bW4nXG4gICAgICAgIH19PlxuICAgICAgICAgIHtjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlbmRlcmluZyBFeHRlbnNpb25LYXJhb2tlVmlldyB3aXRoIGRhdGE6Jywga2FyYW9rZURhdGEoKSwgJ3Nlc3Npb246Jywga2FyYW9rZVNlc3Npb24oKSl9XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImgtZnVsbCBiZy1zdXJmYWNlIHJvdW5kZWQtMnhsIG92ZXJmbG93LWhpZGRlbiBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICB7LyogSGVhZGVyIHdpdGggbWluaW1pemUgYnV0dG9uICovfVxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktZW5kIHAtMiBiZy1zdXJmYWNlIGJvcmRlci1iIGJvcmRlci1zdWJ0bGVcIiBzdHlsZT17eyBoZWlnaHQ6ICc0OHB4JyB9fT5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZU1pbmltaXplfVxuICAgICAgICAgICAgICAgIGNsYXNzPVwidy0xMCBoLTEwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbGcgdHJhbnNpdGlvbi1jb2xvcnMgaG92ZXI6Ymctd2hpdGUvMTBcIlxuICAgICAgICAgICAgICAgIHN0eWxlPXt7IGNvbG9yOiAnI2E4YThhOCcgfX1cbiAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiTWluaW1pemVcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPHN2ZyB3aWR0aD1cIjI0XCIgaGVpZ2h0PVwiMjRcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+XG4gICAgICAgICAgICAgICAgICA8cGF0aCBkPVwiTTYgMTJoMTJcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIzXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiLz5cbiAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgey8qIEthcmFva2UgVmlldyAqL31cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTEgbWluLWgtMCBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgICAgPFNob3cgd2hlbj17IWxvYWRpbmcoKX0gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBoLWZ1bGwgYmctYmFzZVwiPlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhbmltYXRlLXNwaW4gcm91bmRlZC1mdWxsIGgtMTIgdy0xMiBib3JkZXItYi0yIGJvcmRlci1hY2NlbnQtcHJpbWFyeSBteC1hdXRvIG1iLTRcIj48L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNlY29uZGFyeVwiPkxvYWRpbmcgbHlyaWNzLi4uPC9wPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIH0+XG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17a2FyYW9rZURhdGEoKT8ubHlyaWNzPy5saW5lc30gZmFsbGJhY2s9e1xuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGgtZnVsbCBwLThcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtc2Vjb25kYXJ5IG1iLTJcIj5ObyBseXJpY3MgYXZhaWxhYmxlPC9wPlxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1zbSB0ZXh0LXRlcnRpYXJ5XCI+VHJ5IGEgZGlmZmVyZW50IHNvbmc8L3A+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoLWZ1bGwgZmxleCBmbGV4LWNvbFwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIG1pbi1oLTAgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPEV4dGVuc2lvbkthcmFva2VWaWV3XG4gICAgICAgICAgICAgICAgICAgICAgICBzY29yZT17a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLnNjb3JlKCkgOiAwfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmFuaz17MX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGx5cmljcz17a2FyYW9rZURhdGEoKT8ubHlyaWNzPy5saW5lcyB8fCBbXX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnRUaW1lPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuY3VycmVudFRpbWUoKSA6IGN1cnJlbnRUaW1lKCkgKiAxMDAwfVxuICAgICAgICAgICAgICAgICAgICAgICAgbGVhZGVyYm9hcmQ9e1tdfVxuICAgICAgICAgICAgICAgICAgICAgICAgaXNQbGF5aW5nPXtrYXJhb2tlU2Vzc2lvbigpID8gKGthcmFva2VTZXNzaW9uKCkhLmlzUGxheWluZygpIHx8IGthcmFva2VTZXNzaW9uKCkhLmNvdW50ZG93bigpICE9PSBudWxsKSA6IChpc1BsYXlpbmcoKSB8fCBjb3VudGRvd24oKSAhPT0gbnVsbCl9XG4gICAgICAgICAgICAgICAgICAgICAgICBvblN0YXJ0PXtoYW5kbGVTdGFydH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uU3BlZWRDaGFuZ2U9eyhzcGVlZCkgPT4gY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTcGVlZCBjaGFuZ2VkOicsIHNwZWVkKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlzUmVjb3JkaW5nPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuaXNSZWNvcmRpbmcoKSA6IGZhbHNlfVxuICAgICAgICAgICAgICAgICAgICAgICAgbGluZVNjb3Jlcz17a2FyYW9rZVNlc3Npb24oKSA/IGthcmFva2VTZXNzaW9uKCkhLmxpbmVTY29yZXMoKSA6IFtdfVxuICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgey8qIENvdW50ZG93biBvdmVybGF5ICovfVxuICAgICAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtrYXJhb2tlU2Vzc2lvbigpID8ga2FyYW9rZVNlc3Npb24oKSEuY291bnRkb3duKCkgIT09IG51bGwgOiBjb3VudGRvd24oKSAhPT0gbnVsbH0+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFic29sdXRlIGluc2V0LTAgYmctYmxhY2svODAgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgei01MFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTh4bCBmb250LWJvbGQgdGV4dC13aGl0ZSBhbmltYXRlLXB1bHNlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2thcmFva2VTZXNzaW9uKCkgPyBrYXJhb2tlU2Vzc2lvbigpIS5jb3VudGRvd24oKSA6IGNvdW50ZG93bigpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXhsIHRleHQtd2hpdGUvODAgbXQtNFwiPkdldCByZWFkeSE8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L1Nob3c+XG4gICAgPC8+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNoYWRvd1Jvb3RVaSB9IGZyb20gJ3d4dC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdCc7XG5pbXBvcnQgeyBkZWZpbmVDb250ZW50U2NyaXB0IH0gZnJvbSAnd3h0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdCc7XG5pbXBvcnQgdHlwZSB7IENvbnRlbnRTY3JpcHRDb250ZXh0IH0gZnJvbSAnd3h0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQnO1xuaW1wb3J0IHsgcmVuZGVyIH0gZnJvbSAnc29saWQtanMvd2ViJztcbmltcG9ydCB7IENvbnRlbnRBcHAgfSBmcm9tICcuLi9zcmMvYXBwcy9jb250ZW50L0NvbnRlbnRBcHAnO1xuaW1wb3J0ICcuLi9zcmMvc3R5bGVzL2V4dGVuc2lvbi5jc3MnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWycqOi8vc291bmRjbG91ZC5jb20vKicsICcqOi8vc291bmRjbG9hay5jb20vKicsICcqOi8vc2MubWFpZC56b25lLyonLCAnKjovLyoubWFpZC56b25lLyonXSxcbiAgcnVuQXQ6ICdkb2N1bWVudF9pZGxlJyxcbiAgY3NzSW5qZWN0aW9uTW9kZTogJ3VpJyxcblxuICBhc3luYyBtYWluKGN0eDogQ29udGVudFNjcmlwdENvbnRleHQpIHtcbiAgICAvLyBPbmx5IHJ1biBpbiB0b3AtbGV2ZWwgZnJhbWUgdG8gYXZvaWQgZHVwbGljYXRlIHByb2Nlc3NpbmcgaW4gaWZyYW1lc1xuICAgIGlmICh3aW5kb3cudG9wICE9PSB3aW5kb3cuc2VsZikge1xuICAgICAgY29uc29sZS5sb2coJ1tTY2FybGV0dCBDU10gTm90IHRvcC1sZXZlbCBmcmFtZSwgc2tpcHBpbmcgY29udGVudCBzY3JpcHQuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ1tTY2FybGV0dCBDU10gU2NhcmxldHQgS2FyYW9rZSBjb250ZW50IHNjcmlwdCBsb2FkZWQnKTtcblxuICAgIC8vIENyZWF0ZSBzaGFkb3cgRE9NIGFuZCBtb3VudCBrYXJhb2tlIHdpZGdldFxuICAgIGNvbnN0IHVpID0gYXdhaXQgY3JlYXRlU2hhZG93Um9vdFVpKGN0eCwge1xuICAgICAgbmFtZTogJ3NjYXJsZXR0LWthcmFva2UtdWknLFxuICAgICAgcG9zaXRpb246ICdvdmVybGF5JyxcbiAgICAgIGFuY2hvcjogJ2JvZHknLFxuICAgICAgb25Nb3VudDogYXN5bmMgKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gb25Nb3VudCBjYWxsZWQsIGNvbnRhaW5lcjonLCBjb250YWluZXIpO1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBTaGFkb3cgcm9vdDonLCBjb250YWluZXIuZ2V0Um9vdE5vZGUoKSk7XG4gICAgICAgIFxuICAgICAgICAvLyBMb2cgd2hhdCBzdHlsZXNoZWV0cyBhcmUgYXZhaWxhYmxlXG4gICAgICAgIGNvbnN0IHNoYWRvd1Jvb3QgPSBjb250YWluZXIuZ2V0Um9vdE5vZGUoKSBhcyBTaGFkb3dSb290O1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBTaGFkb3cgcm9vdCBzdHlsZXNoZWV0czonLCBzaGFkb3dSb290LnN0eWxlU2hlZXRzPy5sZW5ndGgpO1xuICAgICAgICBcbiAgICAgICAgLy8gQ3JlYXRlIHdyYXBwZXIgZGl2IChDb250ZW50QXBwIHdpbGwgaGFuZGxlIHBvc2l0aW9uaW5nIGJhc2VkIG9uIHN0YXRlKVxuICAgICAgICBjb25zdCB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gJ2thcmFva2Utd2lkZ2V0LWNvbnRhaW5lcic7XG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh3cmFwcGVyKTtcblxuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBXcmFwcGVyIGNyZWF0ZWQgYW5kIGFwcGVuZGVkOicsIHdyYXBwZXIpO1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBXcmFwcGVyIGNvbXB1dGVkIHN0eWxlczonLCB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh3cmFwcGVyKSk7XG5cbiAgICAgICAgLy8gUmVuZGVyIENvbnRlbnRBcHAgY29tcG9uZW50ICh3aGljaCB1c2VzIEV4dGVuc2lvbkthcmFva2VWaWV3KVxuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBBYm91dCB0byByZW5kZXIgQ29udGVudEFwcCcpO1xuICAgICAgICBjb25zdCBkaXNwb3NlID0gcmVuZGVyKCgpID0+IDxDb250ZW50QXBwIC8+LCB3cmFwcGVyKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIENvbnRlbnRBcHAgcmVuZGVyZWQsIGRpc3Bvc2UgZnVuY3Rpb246JywgZGlzcG9zZSk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gZGlzcG9zZTtcbiAgICAgIH0sXG4gICAgICBvblJlbW92ZTogKGNsZWFudXA/OiAoKSA9PiB2b2lkKSA9PiB7XG4gICAgICAgIGNsZWFudXA/LigpO1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIE1vdW50IHRoZSBVSVxuICAgIHVpLm1vdW50KCk7XG4gICAgY29uc29sZS5sb2coJ1tTY2FybGV0dCBDU10gS2FyYW9rZSBvdmVybGF5IG1vdW50ZWQnKTtcbiAgfSxcbn0pOyIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbInZhbHVlIiwiY2hpbGRyZW4iLCJtZW1vIiwicmVzdWx0IiwiZGlzcG9zZSIsImRvY3VtZW50IiwiYWRkRXZlbnRMaXN0ZW5lciIsImJyb3dzZXIiLCJfYnJvd3NlciIsImlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUiLCJzdHlsZSIsInByaW50IiwibG9nZ2VyIiwiX2EiLCJfYiIsInJlbW92ZURldGVjdG9yIiwibW91bnREZXRlY3RvciIsImRlZmluaXRpb24iLCJfJGRlbGVnYXRlRXZlbnRzIiwiU2NvcmVQYW5lbCIsInByb3BzIiwiX2VsJCIsIl90bXBsJCIsIl9lbCQyIiwiZmlyc3RDaGlsZCIsIl9lbCQzIiwiX2VsJDQiLCJuZXh0U2libGluZyIsIl9lbCQ1Iiwic2NvcmUiLCJyYW5rIiwiXyRjbGFzc05hbWUiLCJjbiIsImNsYXNzIiwiTHlyaWNzRGlzcGxheSIsImN1cnJlbnRMaW5lSW5kZXgiLCJzZXRDdXJyZW50TGluZUluZGV4IiwiY3JlYXRlU2lnbmFsIiwiY29udGFpbmVyUmVmIiwiZ2V0TGluZVNjb3JlIiwibGluZUluZGV4IiwibGluZVNjb3JlcyIsImZpbmQiLCJzIiwiZ2V0U2NvcmVTdHlsZSIsImNvbG9yIiwidGV4dFNoYWRvdyIsImNyZWF0ZUVmZmVjdCIsImN1cnJlbnRUaW1lIiwibHlyaWNzIiwibGVuZ3RoIiwidGltZSIsImZvdW5kSW5kZXgiLCJpIiwibGluZSIsImVuZFRpbWUiLCJzdGFydFRpbWUiLCJkdXJhdGlvbiIsInByZXZJbmRleCIsImNvbnNvbGUiLCJsb2ciLCJmcm9tIiwidG8iLCJ0aW1lSW5TZWNvbmRzIiwianVtcCIsIk1hdGgiLCJhYnMiLCJ3YXJuIiwiZnJvbUxpbmUiLCJ0b0xpbmUiLCJpbmRleCIsImlzUGxheWluZyIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsImxpbmVFbGVtZW50cyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJjdXJyZW50RWxlbWVudCIsImNvbnRhaW5lckhlaWdodCIsImNsaWVudEhlaWdodCIsImxpbmVUb3AiLCJvZmZzZXRUb3AiLCJsaW5lSGVpZ2h0Iiwib2Zmc2V0SGVpZ2h0IiwiY3VycmVudFNjcm9sbFRvcCIsInNjcm9sbFRvcCIsInRhcmdldFNjcm9sbFRvcCIsImlzTGluZVZpc2libGUiLCJpc0xpbmVDZW50ZXJlZCIsInNjcm9sbFRvIiwidG9wIiwiYmVoYXZpb3IiLCJfcmVmJCIsIl8kdXNlIiwiXyRjcmVhdGVDb21wb25lbnQiLCJGb3IiLCJlYWNoIiwibGluZVNjb3JlIiwic2NvcmVTdHlsZSIsIl90bXBsJDIiLCJ0ZXh0IiwiXyRlZmZlY3QiLCJfcCQiLCJfdiQiLCJfdiQyIiwiX3YkMyIsImUiLCJfJHNldEF0dHJpYnV0ZSIsInQiLCJhIiwiXyRzdHlsZSIsInVuZGVmaW5lZCIsIkxlYWRlcmJvYXJkUGFuZWwiLCJlbnRyaWVzIiwiZW50cnkiLCJfZWwkNiIsIl8kaW5zZXJ0IiwidXNlcm5hbWUiLCJ0b0xvY2FsZVN0cmluZyIsImlzQ3VycmVudFVzZXIiLCJfdiQ0IiwibyIsInNwZWVkcyIsIlNwbGl0QnV0dG9uIiwiY3VycmVudFNwZWVkSW5kZXgiLCJzZXRDdXJyZW50U3BlZWRJbmRleCIsImN1cnJlbnRTcGVlZCIsImN5Y2xlU3BlZWQiLCJzdG9wUHJvcGFnYXRpb24iLCJuZXh0SW5kZXgiLCJuZXdTcGVlZCIsIm9uU3BlZWRDaGFuZ2UiLCJfJGFkZEV2ZW50TGlzdGVuZXIiLCJvblN0YXJ0IiwiJCRjbGljayIsImRpc2FibGVkIiwiX3YkNSIsIlRhYnNDb250ZXh0IiwiY3JlYXRlQ29udGV4dCIsIlRhYnMiLCJhY3RpdmVUYWIiLCJzZXRBY3RpdmVUYWIiLCJkZWZhdWx0VGFiIiwidGFicyIsImlkIiwiZmlyc3RUYWJJZCIsImhhbmRsZVRhYkNoYW5nZSIsIm9uVGFiQ2hhbmdlIiwiY29udGV4dFZhbHVlIiwiUHJvdmlkZXIiLCJUYWJzTGlzdCIsIlRhYnNUcmlnZ2VyIiwiY29udGV4dCIsInVzZUNvbnRleHQiLCJlcnJvciIsImlzQWN0aXZlIiwiVGFic0NvbnRlbnQiLCJTaG93Iiwid2hlbiIsIkV4dGVuc2lvbkthcmFva2VWaWV3IiwiaGFzT25TdGFydCIsImx5cmljc0xlbmd0aCIsIl90bXBsJDUiLCJmYWxsYmFjayIsIl9lbCQ3IiwiX3RtcGwkNiIsIl9lbCQ4IiwibGFiZWwiLCJfdG1wbCQzIiwic2V0UHJvcGVydHkiLCJfdG1wbCQ0IiwibGVhZGVyYm9hcmQiLCJzYW1wbGVSYXRlIiwib2Zmc2V0IiwiTWluaW1pemVkS2FyYW9rZSIsImN1cnJlbnRUYXJnZXQiLCJ0cmFuc2Zvcm0iLCJvbkNsaWNrIiwiQ29udGVudEFwcCIsImN1cnJlbnRUcmFjayIsInNldEN1cnJlbnRUcmFjayIsImF1dGhUb2tlbiIsInNldEF1dGhUb2tlbiIsInNob3dLYXJhb2tlIiwic2V0U2hvd0thcmFva2UiLCJrYXJhb2tlRGF0YSIsInNldEthcmFva2VEYXRhIiwibG9hZGluZyIsInNldExvYWRpbmciLCJzZXNzaW9uU3RhcnRlZCIsInNldFNlc3Npb25TdGFydGVkIiwiaXNNaW5pbWl6ZWQiLCJzZXRJc01pbmltaXplZCIsImNvdW50ZG93biIsInNldENvdW50ZG93biIsInNldElzUGxheWluZyIsInNldEN1cnJlbnRUaW1lIiwiYXVkaW9SZWYiLCJzZXRBdWRpb1JlZiIsImthcmFva2VTZXNzaW9uIiwic2V0S2FyYW9rZVNlc3Npb24iLCJvbk1vdW50IiwidG9rZW4iLCJnZXRBdXRoVG9rZW4iLCJjbGVhbnVwIiwidHJhY2tEZXRlY3RvciIsIndhdGNoRm9yQ2hhbmdlcyIsInRyYWNrIiwiZmV0Y2hLYXJhb2tlRGF0YSIsIm9uQ2xlYW51cCIsImRhdGEiLCJrYXJhb2tlQXBpIiwiZ2V0S2FyYW9rZURhdGEiLCJ0cmFja0lkIiwidGl0bGUiLCJhcnRpc3QiLCJoYW5kbGVTdGFydCIsImxpbmVzIiwidHJhY2tUaXRsZSIsInNvbmdEYXRhIiwic29uZyIsImhhc0x5cmljcyIsIm5ld1Nlc3Npb24iLCJ1c2VLYXJhb2tlU2Vzc2lvbiIsImFsYnVtIiwiYXVkaW9FbGVtZW50IiwiYXBpVXJsIiwib25Db21wbGV0ZSIsInJlc3VsdHMiLCJzdGFydFNlc3Npb24iLCJhdWRpbyIsInNldEF1ZGlvRWxlbWVudCIsImNvdW50ZG93bkludGVydmFsIiwic2V0SW50ZXJ2YWwiLCJjdXJyZW50IiwiY2xlYXJJbnRlcnZhbCIsInN0YXJ0QXVkaW9QbGF5YmFjayIsImF1ZGlvRWxlbWVudHMiLCJzcmMiLCJwYXVzZWQiLCJzZXNzaW9uIiwiYXVkaW9Qcm9jZXNzb3IiLCJpc1JlYWR5IiwiaW5pdGlhbGl6ZSIsImNhdGNoIiwicGxheSIsInRoZW4iLCJlcnIiLCJwbGF5QnV0dG9uIiwicXVlcnlTZWxlY3RvciIsImNsaWNrIiwidXBkYXRlVGltZSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJzZXRUaW1lb3V0IiwibmV3QXVkaW9FbGVtZW50cyIsImhhbmRsZU1pbmltaXplIiwiaGFuZGxlUmVzdG9yZSIsIl8kbWVtbyIsIl9lbCQxIiwic3BlZWQiLCJpc1JlY29yZGluZyIsIl9lbCQ5IiwiX2VsJDAiLCJfYyQiLCJkZWZpbmVDb250ZW50U2NyaXB0IiwibWF0Y2hlcyIsInJ1bkF0IiwiY3NzSW5qZWN0aW9uTW9kZSIsIm1haW4iLCJjdHgiLCJ3aW5kb3ciLCJzZWxmIiwidWkiLCJjcmVhdGVTaGFkb3dSb290VWkiLCJuYW1lIiwicG9zaXRpb24iLCJhbmNob3IiLCJjb250YWluZXIiLCJnZXRSb290Tm9kZSIsInNoYWRvd1Jvb3QiLCJzdHlsZVNoZWV0cyIsIndyYXBwZXIiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwiYXBwZW5kQ2hpbGQiLCJnZXRDb21wdXRlZFN0eWxlIiwicmVuZGVyIiwib25SZW1vdmUiLCJtb3VudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBZ0pBLFFBQU0sU0FBUztBQUNmLFFBQU0sVUFBVSxDQUFDLEdBQUcsTUFBTSxNQUFNO0FBR2hDLFFBQU0sU0FBUyxPQUFPLGFBQWE7QUFDbkMsUUFBTSxXQUFXLE9BQU8scUJBQXFCO0FBQzdDLFFBQU0sZ0JBQWdCO0FBQUEsSUFDcEIsUUFBUTtBQUFBLEVBQ1Y7QUFFQSxNQUFJLGFBQWE7QUFDakIsUUFBTSxRQUFRO0FBQ2QsUUFBTSxVQUFVO0FBQ2hCLFFBQU0sVUFBVSxDQUtoQjtBQUVBLE1BQUksUUFBUTtBQUNaLE1BQUksYUFBYTtBQUVqQixNQUFJLHVCQUF1QjtBQUMzQixNQUFJLFdBQVc7QUFDZixNQUFJLFVBQVU7QUFDZCxNQUFJLFVBQVU7QUFDZCxNQUFJLFlBQVk7QUFPaEIsV0FBUyxXQUFXLElBQUksZUFBZTtBQUNyQyxVQUFNLFdBQVcsVUFDZixRQUFRLE9BQ1IsVUFBVSxHQUFHLFdBQVcsR0FDeEIsVUFBVSxrQkFBa0IsU0FBWSxRQUFRLGVBQ2hELE9BQU8sVUFBVTtBQUFBLE1BQ2YsT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsU0FBUztBQUFBLE1BQ1QsT0FBTztBQUFBLElBQUEsSUFDSjtBQUFBLE1BQ0gsT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsU0FBUyxVQUFVLFFBQVEsVUFBVTtBQUFBLE1BQ3JDLE9BQU87QUFBQSxJQUVULEdBQUEsV0FBVyxVQUFVLE1BQU0sR0FBRyxNQUFNO0FBQzVCLFlBQUEsSUFBSSxNQUFNLG9FQUFvRTtBQUFBLElBQUEsQ0FDckYsSUFBSyxNQUFNLEdBQUcsTUFBTSxRQUFRLE1BQU0sVUFBVSxJQUFJLENBQUMsQ0FBQztBQUU3QyxZQUFBO0FBQ0csZUFBQTtBQUNQLFFBQUE7QUFDSyxhQUFBLFdBQVcs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LFFBQVEsS0FBSztBQUFBLFFBQ3JCO0FBQUE7QUFBQSxJQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUtFLG9CQUFvQjtBQUNsQixXQUFLLE1BQU0sb0NBQW9DO0FBQy9DRCxlQUFPO0FBQUEsUUFDTCxtQkFBbUIsS0FBSyxpQkFBaUI7QUFBQSxNQUMxQztBQUFBLElBQ0w7QUFBQSxJQUNFLGlCQUFpQjtBQUNmLGFBQU87QUFBQSxRQUNMO0FBQUEsVUFDRSxNQUFNLHNCQUFxQjtBQUFBLFVBQzNCLG1CQUFtQixLQUFLO0FBQUEsVUFDeEIsV0FBVyxLQUFLLE9BQVEsRUFBQyxTQUFTLEVBQUUsRUFBRSxNQUFNLENBQUM7QUFBQSxRQUM5QztBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDTDtBQUFBLElBQ0UseUJBQXlCLE9BQU87O0FBQzlCLFlBQU0seUJBQXVCQyxNQUFBLE1BQU0sU0FBTixnQkFBQUEsSUFBWSxVQUFTLHNCQUFxQjtBQUN2RSxZQUFNLHdCQUFzQkMsTUFBQSxNQUFNLFNBQU4sZ0JBQUFBLElBQVksdUJBQXNCLEtBQUs7QUFDbkUsWUFBTSxpQkFBaUIsQ0FBQyxLQUFLLG1CQUFtQixLQUFJLFdBQU0sU0FBTixtQkFBWSxTQUFTO0FBQ3pFLGFBQU8sd0JBQXdCLHVCQUF1QjtBQUFBLElBQzFEO0FBQUEsSUFDRSxzQkFBc0IsU0FBUztBQUM3QixVQUFJLFVBQVU7QUFDZCxZQUFNLEtBQUssQ0FBQyxVQUFVO0FBQ3BCLFlBQUksS0FBSyx5QkFBeUIsS0FBSyxHQUFHO0FBQ3hDLGVBQUssbUJBQW1CLElBQUksTUFBTSxLQUFLLFNBQVM7QUFDaEQsZ0JBQU0sV0FBVztBQUNqQixvQkFBVTtBQUNWLGNBQUksYUFBWSxtQ0FBUyxrQkFBa0I7QUFDM0MsZUFBSyxrQkFBbUI7QUFBQSxRQUNoQztBQUFBLE1BQ0s7QUFDRCx1QkFBaUIsV0FBVyxFQUFFO0FBQzlCLFdBQUssY0FBYyxNQUFNLG9CQUFvQixXQUFXLEVBQUUsQ0FBQztBQUFBLElBQy9EO0FBQUEsRUFDQTtBQXJKRSxnQkFaVyx1QkFZSiwrQkFBOEI7QUFBQSxJQUNuQztBQUFBLEVBQ0Q7QUFkSSxNQUFNLHVCQUFOOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsMSwyLDMsNCw1LDYsNyw4LDksMTAsMTEsMTIsMTMsMTQsMTUsMzgsMzksNDBdfQ==

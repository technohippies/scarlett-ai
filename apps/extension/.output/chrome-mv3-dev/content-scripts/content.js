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
      var _el$ = _tmpl$$6(), _el$2 = _el$.firstChild;
      var _ref$ = containerRef;
      typeof _ref$ === "function" ? use(_ref$, _el$) : containerRef = _el$;
      insert(_el$2, createComponent(For, {
        get each() {
          return props.lyrics;
        },
        children: (line, index) => (() => {
          var _el$3 = _tmpl$2$4();
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
  var _tmpl$$2 = /* @__PURE__ */ template(`<div class=px-4>`), _tmpl$2$1 = /* @__PURE__ */ template(`<div class="flex-1 overflow-hidden">`), _tmpl$3$1 = /* @__PURE__ */ template(`<div class="overflow-y-auto h-full">`), _tmpl$4$1 = /* @__PURE__ */ template(`<div>`), _tmpl$5$1 = /* @__PURE__ */ template(`<div class="p-4 bg-surface border-t border-subtle">`);
  const ExtensionKaraokeView = (props) => {
    var _a2;
    console.log("[ExtensionKaraokeView] Rendering with props:", {
      isPlaying: props.isPlaying,
      hasOnStart: !!props.onStart,
      lyricsLength: (_a2 = props.lyrics) == null ? void 0 : _a2.length
    });
    return (() => {
      var _el$ = _tmpl$4$1();
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
            "class": "flex-1 flex flex-col overflow-hidden",
            get children() {
              return [(() => {
                var _el$3 = _tmpl$2$1();
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
              })(), memo(() => console.log("[ExtensionKaraokeView] Start button check:", {
                isPlaying: props.isPlaying,
                notPlaying: !props.isPlaying,
                hasOnStart: !!props.onStart,
                shouldShowButton: !props.isPlaying && props.onStart
              })), memo(() => memo(() => !!(!props.isPlaying && props.onStart))() && (() => {
                var _el$5 = _tmpl$5$1();
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
              var _el$4 = _tmpl$3$1();
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
  var _tmpl$ = /* @__PURE__ */ template(`<div class="absolute inset-0 bg-black/80 flex items-center justify-center z-50"><div class=text-center><div class="text-8xl font-bold text-white animate-pulse"></div><p class="text-xl text-white/80 mt-4">Get ready!`), _tmpl$2 = /* @__PURE__ */ template(`<div class="h-full flex flex-col"><div class=flex-1>`), _tmpl$3 = /* @__PURE__ */ template(`<div><div class="h-full bg-surface rounded-2xl overflow-hidden flex flex-col"><div class="flex items-center justify-end p-2 bg-surface border-b border-subtle"><button class="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"aria-label=Minimize><svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M6 12h12"stroke=currentColor stroke-width=3 stroke-linecap=round></path></svg></button></div><div class="flex-1 overflow-hidden">`), _tmpl$4 = /* @__PURE__ */ template(`<div>`), _tmpl$5 = /* @__PURE__ */ template(`<div class="flex items-center justify-center h-full bg-base"><div class=text-center><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div><p class=text-secondary>Loading lyrics...`), _tmpl$6 = /* @__PURE__ */ template(`<div class="flex items-center justify-center h-full p-8"><div class=text-center><p class="text-lg text-secondary mb-2">No lyrics available</p><p class="text-sm text-tertiary">Try a different song`);
  const ContentApp = () => {
    console.log("[ContentApp] Rendering ContentApp component");
    const [currentTrack, setCurrentTrack] = createSignal(null);
    const [authToken, setAuthToken] = createSignal(null);
    const [showKaraoke, setShowKaraoke] = createSignal(false);
    const [karaokeData, setKaraokeData] = createSignal(null);
    const [loading, setLoading] = createSignal(false);
    createSignal(false);
    const [isMinimized, setIsMinimized] = createSignal(false);
    const [countdown, setCountdown] = createSignal(null);
    const [isPlaying, setIsPlaying] = createSignal(false);
    const [currentTime, setCurrentTime] = createSignal(0);
    const [audioRef, setAudioRef] = createSignal(null);
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
    const handleStart = () => {
      console.log("[ContentApp] Start karaoke session");
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
    };
    const startAudioPlayback = () => {
      console.log("[ContentApp] Starting audio playback");
      setIsPlaying(true);
      const audioElements = document.querySelectorAll("audio");
      if (audioElements.length > 0) {
        const audio = audioElements[0];
        setAudioRef(audio);
        audio.play().catch((err) => {
          console.error("[ContentApp] Failed to play audio:", err);
        });
        const updateTime = () => {
          setCurrentTime(audio.currentTime);
        };
        audio.addEventListener("timeupdate", updateTime);
        audio.addEventListener("ended", () => {
          setIsPlaying(false);
          audio.removeEventListener("timeupdate", updateTime);
        });
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
        insert(_el$, () => console.log("[ContentApp] Rendering ExtensionKaraokeView with data:", karaokeData()), _el$2);
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
                  score: 0,
                  rank: 1,
                  get lyrics() {
                    var _a2, _b2;
                    return ((_b2 = (_a2 = karaokeData()) == null ? void 0 : _a2.lyrics) == null ? void 0 : _b2.lines) || [];
                  },
                  get currentTime() {
                    return currentTime() * 1e3;
                  },
                  leaderboard: [],
                  get isPlaying() {
                    return isPlaying();
                  },
                  onStart: handleStart,
                  onSpeedChange: (speed) => console.log("[ContentApp] Speed changed:", speed)
                }));
                insert(_el$6, createComponent(Show, {
                  get when() {
                    return countdown() !== null;
                  },
                  get children() {
                    var _el$8 = _tmpl$(), _el$9 = _el$8.firstChild, _el$0 = _el$9.firstChild;
                    insert(_el$0, countdown);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL2Rpc3QvZGV2LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL3dlYi9kaXN0L2Rldi5qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWUvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnQvbGliL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbnkta2V5cy1tYXAvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvZGVmdS9kaXN0L2RlZnUubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0AxbmF0c3Uvd2FpdC1lbGVtZW50L2Rpc3QvZGV0ZWN0b3JzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AMW5hdHN1L3dhaXQtZWxlbWVudC9kaXN0L2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYXJlZC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9jbHN4L2Rpc3QvY2xzeC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvY24udHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9sYXlvdXQvSGVhZGVyL0hlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9kaXNwbGF5L1Njb3JlUGFuZWwvU2NvcmVQYW5lbC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9vbmJvYXJkaW5nL09uYm9hcmRpbmdGbG93L09uYm9hcmRpbmdGbG93LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheS9MeXJpY3NEaXNwbGF5LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvS2FyYW9rZUhlYWRlci9LYXJhb2tlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbC9MZWFkZXJib2FyZFBhbmVsLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9TcGxpdEJ1dHRvbi9TcGxpdEJ1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vVGFicy9UYWJzLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvRXh0ZW5zaW9uS2FyYW9rZVZpZXcvRXh0ZW5zaW9uS2FyYW9rZVZpZXcudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvTWluaW1pemVkS2FyYW9rZS50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9wcmFjdGljZS9QcmFjdGljZUhlYWRlci9QcmFjdGljZUhlYWRlci50c3giLCIuLi8uLi8uLi9zcmMvc2VydmljZXMvdHJhY2stZGV0ZWN0b3IudHMiLCIuLi8uLi8uLi9zcmMvdXRpbHMvc3RvcmFnZS50cyIsIi4uLy4uLy4uL3NyYy9zZXJ2aWNlcy9rYXJhb2tlLWFwaS50cyIsIi4uLy4uLy4uL3NyYy9hcHBzL2NvbnRlbnQvQ29udGVudEFwcC50c3giLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50LnRzeCIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgdGFza0lkQ291bnRlciA9IDEsXG4gIGlzQ2FsbGJhY2tTY2hlZHVsZWQgPSBmYWxzZSxcbiAgaXNQZXJmb3JtaW5nV29yayA9IGZhbHNlLFxuICB0YXNrUXVldWUgPSBbXSxcbiAgY3VycmVudFRhc2sgPSBudWxsLFxuICBzaG91bGRZaWVsZFRvSG9zdCA9IG51bGwsXG4gIHlpZWxkSW50ZXJ2YWwgPSA1LFxuICBkZWFkbGluZSA9IDAsXG4gIG1heFlpZWxkSW50ZXJ2YWwgPSAzMDAsXG4gIHNjaGVkdWxlQ2FsbGJhY2sgPSBudWxsLFxuICBzY2hlZHVsZWRDYWxsYmFjayA9IG51bGw7XG5jb25zdCBtYXhTaWduZWQzMUJpdEludCA9IDEwNzM3NDE4MjM7XG5mdW5jdGlvbiBzZXR1cFNjaGVkdWxlcigpIHtcbiAgY29uc3QgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpLFxuICAgIHBvcnQgPSBjaGFubmVsLnBvcnQyO1xuICBzY2hlZHVsZUNhbGxiYWNrID0gKCkgPT4gcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSAoKSA9PiB7XG4gICAgaWYgKHNjaGVkdWxlZENhbGxiYWNrICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBjdXJyZW50VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgZGVhZGxpbmUgPSBjdXJyZW50VGltZSArIHlpZWxkSW50ZXJ2YWw7XG4gICAgICBjb25zdCBoYXNUaW1lUmVtYWluaW5nID0gdHJ1ZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGhhc01vcmVXb3JrID0gc2NoZWR1bGVkQ2FsbGJhY2soaGFzVGltZVJlbWFpbmluZywgY3VycmVudFRpbWUpO1xuICAgICAgICBpZiAoIWhhc01vcmVXb3JrKSB7XG4gICAgICAgICAgc2NoZWR1bGVkQ2FsbGJhY2sgPSBudWxsO1xuICAgICAgICB9IGVsc2UgcG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHBvcnQucG9zdE1lc3NhZ2UobnVsbCk7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgaWYgKG5hdmlnYXRvciAmJiBuYXZpZ2F0b3Iuc2NoZWR1bGluZyAmJiBuYXZpZ2F0b3Iuc2NoZWR1bGluZy5pc0lucHV0UGVuZGluZykge1xuICAgIGNvbnN0IHNjaGVkdWxpbmcgPSBuYXZpZ2F0b3Iuc2NoZWR1bGluZztcbiAgICBzaG91bGRZaWVsZFRvSG9zdCA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBpZiAoY3VycmVudFRpbWUgPj0gZGVhZGxpbmUpIHtcbiAgICAgICAgaWYgKHNjaGVkdWxpbmcuaXNJbnB1dFBlbmRpbmcoKSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjdXJyZW50VGltZSA+PSBtYXhZaWVsZEludGVydmFsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgc2hvdWxkWWllbGRUb0hvc3QgPSAoKSA9PiBwZXJmb3JtYW5jZS5ub3coKSA+PSBkZWFkbGluZTtcbiAgfVxufVxuZnVuY3Rpb24gZW5xdWV1ZSh0YXNrUXVldWUsIHRhc2spIHtcbiAgZnVuY3Rpb24gZmluZEluZGV4KCkge1xuICAgIGxldCBtID0gMDtcbiAgICBsZXQgbiA9IHRhc2tRdWV1ZS5sZW5ndGggLSAxO1xuICAgIHdoaWxlIChtIDw9IG4pIHtcbiAgICAgIGNvbnN0IGsgPSBuICsgbSA+PiAxO1xuICAgICAgY29uc3QgY21wID0gdGFzay5leHBpcmF0aW9uVGltZSAtIHRhc2tRdWV1ZVtrXS5leHBpcmF0aW9uVGltZTtcbiAgICAgIGlmIChjbXAgPiAwKSBtID0gayArIDE7ZWxzZSBpZiAoY21wIDwgMCkgbiA9IGsgLSAxO2Vsc2UgcmV0dXJuIGs7XG4gICAgfVxuICAgIHJldHVybiBtO1xuICB9XG4gIHRhc2tRdWV1ZS5zcGxpY2UoZmluZEluZGV4KCksIDAsIHRhc2spO1xufVxuZnVuY3Rpb24gcmVxdWVzdENhbGxiYWNrKGZuLCBvcHRpb25zKSB7XG4gIGlmICghc2NoZWR1bGVDYWxsYmFjaykgc2V0dXBTY2hlZHVsZXIoKTtcbiAgbGV0IHN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpLFxuICAgIHRpbWVvdXQgPSBtYXhTaWduZWQzMUJpdEludDtcbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy50aW1lb3V0KSB0aW1lb3V0ID0gb3B0aW9ucy50aW1lb3V0O1xuICBjb25zdCBuZXdUYXNrID0ge1xuICAgIGlkOiB0YXNrSWRDb3VudGVyKyssXG4gICAgZm4sXG4gICAgc3RhcnRUaW1lLFxuICAgIGV4cGlyYXRpb25UaW1lOiBzdGFydFRpbWUgKyB0aW1lb3V0XG4gIH07XG4gIGVucXVldWUodGFza1F1ZXVlLCBuZXdUYXNrKTtcbiAgaWYgKCFpc0NhbGxiYWNrU2NoZWR1bGVkICYmICFpc1BlcmZvcm1pbmdXb3JrKSB7XG4gICAgaXNDYWxsYmFja1NjaGVkdWxlZCA9IHRydWU7XG4gICAgc2NoZWR1bGVkQ2FsbGJhY2sgPSBmbHVzaFdvcms7XG4gICAgc2NoZWR1bGVDYWxsYmFjaygpO1xuICB9XG4gIHJldHVybiBuZXdUYXNrO1xufVxuZnVuY3Rpb24gY2FuY2VsQ2FsbGJhY2sodGFzaykge1xuICB0YXNrLmZuID0gbnVsbDtcbn1cbmZ1bmN0aW9uIGZsdXNoV29yayhoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSkge1xuICBpc0NhbGxiYWNrU2NoZWR1bGVkID0gZmFsc2U7XG4gIGlzUGVyZm9ybWluZ1dvcmsgPSB0cnVlO1xuICB0cnkge1xuICAgIHJldHVybiB3b3JrTG9vcChoYXNUaW1lUmVtYWluaW5nLCBpbml0aWFsVGltZSk7XG4gIH0gZmluYWxseSB7XG4gICAgY3VycmVudFRhc2sgPSBudWxsO1xuICAgIGlzUGVyZm9ybWluZ1dvcmsgPSBmYWxzZTtcbiAgfVxufVxuZnVuY3Rpb24gd29ya0xvb3AoaGFzVGltZVJlbWFpbmluZywgaW5pdGlhbFRpbWUpIHtcbiAgbGV0IGN1cnJlbnRUaW1lID0gaW5pdGlhbFRpbWU7XG4gIGN1cnJlbnRUYXNrID0gdGFza1F1ZXVlWzBdIHx8IG51bGw7XG4gIHdoaWxlIChjdXJyZW50VGFzayAhPT0gbnVsbCkge1xuICAgIGlmIChjdXJyZW50VGFzay5leHBpcmF0aW9uVGltZSA+IGN1cnJlbnRUaW1lICYmICghaGFzVGltZVJlbWFpbmluZyB8fCBzaG91bGRZaWVsZFRvSG9zdCgpKSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNvbnN0IGNhbGxiYWNrID0gY3VycmVudFRhc2suZm47XG4gICAgaWYgKGNhbGxiYWNrICE9PSBudWxsKSB7XG4gICAgICBjdXJyZW50VGFzay5mbiA9IG51bGw7XG4gICAgICBjb25zdCBkaWRVc2VyQ2FsbGJhY2tUaW1lb3V0ID0gY3VycmVudFRhc2suZXhwaXJhdGlvblRpbWUgPD0gY3VycmVudFRpbWU7XG4gICAgICBjYWxsYmFjayhkaWRVc2VyQ2FsbGJhY2tUaW1lb3V0KTtcbiAgICAgIGN1cnJlbnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBpZiAoY3VycmVudFRhc2sgPT09IHRhc2tRdWV1ZVswXSkge1xuICAgICAgICB0YXNrUXVldWUuc2hpZnQoKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgdGFza1F1ZXVlLnNoaWZ0KCk7XG4gICAgY3VycmVudFRhc2sgPSB0YXNrUXVldWVbMF0gfHwgbnVsbDtcbiAgfVxuICByZXR1cm4gY3VycmVudFRhc2sgIT09IG51bGw7XG59XG5cbmNvbnN0IHNoYXJlZENvbmZpZyA9IHtcbiAgY29udGV4dDogdW5kZWZpbmVkLFxuICByZWdpc3RyeTogdW5kZWZpbmVkLFxuICBlZmZlY3RzOiB1bmRlZmluZWQsXG4gIGRvbmU6IGZhbHNlLFxuICBnZXRDb250ZXh0SWQoKSB7XG4gICAgcmV0dXJuIGdldENvbnRleHRJZCh0aGlzLmNvbnRleHQuY291bnQpO1xuICB9LFxuICBnZXROZXh0Q29udGV4dElkKCkge1xuICAgIHJldHVybiBnZXRDb250ZXh0SWQodGhpcy5jb250ZXh0LmNvdW50KyspO1xuICB9XG59O1xuZnVuY3Rpb24gZ2V0Q29udGV4dElkKGNvdW50KSB7XG4gIGNvbnN0IG51bSA9IFN0cmluZyhjb3VudCksXG4gICAgbGVuID0gbnVtLmxlbmd0aCAtIDE7XG4gIHJldHVybiBzaGFyZWRDb25maWcuY29udGV4dC5pZCArIChsZW4gPyBTdHJpbmcuZnJvbUNoYXJDb2RlKDk2ICsgbGVuKSA6IFwiXCIpICsgbnVtO1xufVxuZnVuY3Rpb24gc2V0SHlkcmF0ZUNvbnRleHQoY29udGV4dCkge1xuICBzaGFyZWRDb25maWcuY29udGV4dCA9IGNvbnRleHQ7XG59XG5mdW5jdGlvbiBuZXh0SHlkcmF0ZUNvbnRleHQoKSB7XG4gIHJldHVybiB7XG4gICAgLi4uc2hhcmVkQ29uZmlnLmNvbnRleHQsXG4gICAgaWQ6IHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCksXG4gICAgY291bnQ6IDBcbiAgfTtcbn1cblxuY29uc3QgSVNfREVWID0gdHJ1ZTtcbmNvbnN0IGVxdWFsRm4gPSAoYSwgYikgPT4gYSA9PT0gYjtcbmNvbnN0ICRQUk9YWSA9IFN5bWJvbChcInNvbGlkLXByb3h5XCIpO1xuY29uc3QgU1VQUE9SVFNfUFJPWFkgPSB0eXBlb2YgUHJveHkgPT09IFwiZnVuY3Rpb25cIjtcbmNvbnN0ICRUUkFDSyA9IFN5bWJvbChcInNvbGlkLXRyYWNrXCIpO1xuY29uc3QgJERFVkNPTVAgPSBTeW1ib2woXCJzb2xpZC1kZXYtY29tcG9uZW50XCIpO1xuY29uc3Qgc2lnbmFsT3B0aW9ucyA9IHtcbiAgZXF1YWxzOiBlcXVhbEZuXG59O1xubGV0IEVSUk9SID0gbnVsbDtcbmxldCBydW5FZmZlY3RzID0gcnVuUXVldWU7XG5jb25zdCBTVEFMRSA9IDE7XG5jb25zdCBQRU5ESU5HID0gMjtcbmNvbnN0IFVOT1dORUQgPSB7XG4gIG93bmVkOiBudWxsLFxuICBjbGVhbnVwczogbnVsbCxcbiAgY29udGV4dDogbnVsbCxcbiAgb3duZXI6IG51bGxcbn07XG5jb25zdCBOT19JTklUID0ge307XG52YXIgT3duZXIgPSBudWxsO1xubGV0IFRyYW5zaXRpb24gPSBudWxsO1xubGV0IFNjaGVkdWxlciA9IG51bGw7XG5sZXQgRXh0ZXJuYWxTb3VyY2VDb25maWcgPSBudWxsO1xubGV0IExpc3RlbmVyID0gbnVsbDtcbmxldCBVcGRhdGVzID0gbnVsbDtcbmxldCBFZmZlY3RzID0gbnVsbDtcbmxldCBFeGVjQ291bnQgPSAwO1xuY29uc3QgRGV2SG9va3MgPSB7XG4gIGFmdGVyVXBkYXRlOiBudWxsLFxuICBhZnRlckNyZWF0ZU93bmVyOiBudWxsLFxuICBhZnRlckNyZWF0ZVNpZ25hbDogbnVsbCxcbiAgYWZ0ZXJSZWdpc3RlckdyYXBoOiBudWxsXG59O1xuZnVuY3Rpb24gY3JlYXRlUm9vdChmbiwgZGV0YWNoZWRPd25lcikge1xuICBjb25zdCBsaXN0ZW5lciA9IExpc3RlbmVyLFxuICAgIG93bmVyID0gT3duZXIsXG4gICAgdW5vd25lZCA9IGZuLmxlbmd0aCA9PT0gMCxcbiAgICBjdXJyZW50ID0gZGV0YWNoZWRPd25lciA9PT0gdW5kZWZpbmVkID8gb3duZXIgOiBkZXRhY2hlZE93bmVyLFxuICAgIHJvb3QgPSB1bm93bmVkID8ge1xuICAgICAgb3duZWQ6IG51bGwsXG4gICAgICBjbGVhbnVwczogbnVsbCxcbiAgICAgIGNvbnRleHQ6IG51bGwsXG4gICAgICBvd25lcjogbnVsbFxuICAgIH0gIDoge1xuICAgICAgb3duZWQ6IG51bGwsXG4gICAgICBjbGVhbnVwczogbnVsbCxcbiAgICAgIGNvbnRleHQ6IGN1cnJlbnQgPyBjdXJyZW50LmNvbnRleHQgOiBudWxsLFxuICAgICAgb3duZXI6IGN1cnJlbnRcbiAgICB9LFxuICAgIHVwZGF0ZUZuID0gdW5vd25lZCA/ICgpID0+IGZuKCgpID0+IHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkRpc3Bvc2UgbWV0aG9kIG11c3QgYmUgYW4gZXhwbGljaXQgYXJndW1lbnQgdG8gY3JlYXRlUm9vdCBmdW5jdGlvblwiKTtcbiAgICB9KSAgOiAoKSA9PiBmbigoKSA9PiB1bnRyYWNrKCgpID0+IGNsZWFuTm9kZShyb290KSkpO1xuICBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyICYmIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIocm9vdCk7XG4gIE93bmVyID0gcm9vdDtcbiAgTGlzdGVuZXIgPSBudWxsO1xuICB0cnkge1xuICAgIHJldHVybiBydW5VcGRhdGVzKHVwZGF0ZUZuLCB0cnVlKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICAgIE93bmVyID0gb3duZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIGNyZWF0ZVNpZ25hbCh2YWx1ZSwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyA/IE9iamVjdC5hc3NpZ24oe30sIHNpZ25hbE9wdGlvbnMsIG9wdGlvbnMpIDogc2lnbmFsT3B0aW9ucztcbiAgY29uc3QgcyA9IHtcbiAgICB2YWx1ZSxcbiAgICBvYnNlcnZlcnM6IG51bGwsXG4gICAgb2JzZXJ2ZXJTbG90czogbnVsbCxcbiAgICBjb21wYXJhdG9yOiBvcHRpb25zLmVxdWFscyB8fCB1bmRlZmluZWRcbiAgfTtcbiAge1xuICAgIGlmIChvcHRpb25zLm5hbWUpIHMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICBpZiAob3B0aW9ucy5pbnRlcm5hbCkge1xuICAgICAgcy5pbnRlcm5hbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZ2lzdGVyR3JhcGgocyk7XG4gICAgICBpZiAoRGV2SG9va3MuYWZ0ZXJDcmVhdGVTaWduYWwpIERldkhvb2tzLmFmdGVyQ3JlYXRlU2lnbmFsKHMpO1xuICAgIH1cbiAgfVxuICBjb25zdCBzZXR0ZXIgPSB2YWx1ZSA9PiB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhzKSkgdmFsdWUgPSB2YWx1ZShzLnRWYWx1ZSk7ZWxzZSB2YWx1ZSA9IHZhbHVlKHMudmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gd3JpdGVTaWduYWwocywgdmFsdWUpO1xuICB9O1xuICByZXR1cm4gW3JlYWRTaWduYWwuYmluZChzKSwgc2V0dGVyXTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbXB1dGVkKGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCB0cnVlLCBTVEFMRSwgb3B0aW9ucyApO1xuICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBVcGRhdGVzLnB1c2goYyk7ZWxzZSB1cGRhdGVDb21wdXRhdGlvbihjKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlbmRlckVmZmVjdChmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgZmFsc2UsIFNUQUxFLCBvcHRpb25zICk7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIFVwZGF0ZXMucHVzaChjKTtlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xufVxuZnVuY3Rpb24gY3JlYXRlRWZmZWN0KGZuLCB2YWx1ZSwgb3B0aW9ucykge1xuICBydW5FZmZlY3RzID0gcnVuVXNlckVmZmVjdHM7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIGZhbHNlLCBTVEFMRSwgb3B0aW9ucyApLFxuICAgIHMgPSBTdXNwZW5zZUNvbnRleHQgJiYgdXNlQ29udGV4dChTdXNwZW5zZUNvbnRleHQpO1xuICBpZiAocykgYy5zdXNwZW5zZSA9IHM7XG4gIGlmICghb3B0aW9ucyB8fCAhb3B0aW9ucy5yZW5kZXIpIGMudXNlciA9IHRydWU7XG4gIEVmZmVjdHMgPyBFZmZlY3RzLnB1c2goYykgOiB1cGRhdGVDb21wdXRhdGlvbihjKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlYWN0aW9uKG9uSW52YWxpZGF0ZSwgb3B0aW9ucykge1xuICBsZXQgZm47XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB7XG4gICAgICBmbiA/IGZuKCkgOiB1bnRyYWNrKG9uSW52YWxpZGF0ZSk7XG4gICAgICBmbiA9IHVuZGVmaW5lZDtcbiAgICB9LCB1bmRlZmluZWQsIGZhbHNlLCAwLCBvcHRpb25zICksXG4gICAgcyA9IFN1c3BlbnNlQ29udGV4dCAmJiB1c2VDb250ZXh0KFN1c3BlbnNlQ29udGV4dCk7XG4gIGlmIChzKSBjLnN1c3BlbnNlID0gcztcbiAgYy51c2VyID0gdHJ1ZTtcbiAgcmV0dXJuIHRyYWNraW5nID0+IHtcbiAgICBmbiA9IHRyYWNraW5nO1xuICAgIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICB9O1xufVxuZnVuY3Rpb24gY3JlYXRlTWVtbyhmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgPyBPYmplY3QuYXNzaWduKHt9LCBzaWduYWxPcHRpb25zLCBvcHRpb25zKSA6IHNpZ25hbE9wdGlvbnM7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIHRydWUsIDAsIG9wdGlvbnMgKTtcbiAgYy5vYnNlcnZlcnMgPSBudWxsO1xuICBjLm9ic2VydmVyU2xvdHMgPSBudWxsO1xuICBjLmNvbXBhcmF0b3IgPSBvcHRpb25zLmVxdWFscyB8fCB1bmRlZmluZWQ7XG4gIGlmIChTY2hlZHVsZXIgJiYgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICBjLnRTdGF0ZSA9IFNUQUxFO1xuICAgIFVwZGF0ZXMucHVzaChjKTtcbiAgfSBlbHNlIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICByZXR1cm4gcmVhZFNpZ25hbC5iaW5kKGMpO1xufVxuZnVuY3Rpb24gaXNQcm9taXNlKHYpIHtcbiAgcmV0dXJuIHYgJiYgdHlwZW9mIHYgPT09IFwib2JqZWN0XCIgJiYgXCJ0aGVuXCIgaW4gdjtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVJlc291cmNlKHBTb3VyY2UsIHBGZXRjaGVyLCBwT3B0aW9ucykge1xuICBsZXQgc291cmNlO1xuICBsZXQgZmV0Y2hlcjtcbiAgbGV0IG9wdGlvbnM7XG4gIGlmICh0eXBlb2YgcEZldGNoZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIHNvdXJjZSA9IHBTb3VyY2U7XG4gICAgZmV0Y2hlciA9IHBGZXRjaGVyO1xuICAgIG9wdGlvbnMgPSBwT3B0aW9ucyB8fCB7fTtcbiAgfSBlbHNlIHtcbiAgICBzb3VyY2UgPSB0cnVlO1xuICAgIGZldGNoZXIgPSBwU291cmNlO1xuICAgIG9wdGlvbnMgPSBwRmV0Y2hlciB8fCB7fTtcbiAgfVxuICBsZXQgcHIgPSBudWxsLFxuICAgIGluaXRQID0gTk9fSU5JVCxcbiAgICBpZCA9IG51bGwsXG4gICAgbG9hZGVkVW5kZXJUcmFuc2l0aW9uID0gZmFsc2UsXG4gICAgc2NoZWR1bGVkID0gZmFsc2UsXG4gICAgcmVzb2x2ZWQgPSBcImluaXRpYWxWYWx1ZVwiIGluIG9wdGlvbnMsXG4gICAgZHluYW1pYyA9IHR5cGVvZiBzb3VyY2UgPT09IFwiZnVuY3Rpb25cIiAmJiBjcmVhdGVNZW1vKHNvdXJjZSk7XG4gIGNvbnN0IGNvbnRleHRzID0gbmV3IFNldCgpLFxuICAgIFt2YWx1ZSwgc2V0VmFsdWVdID0gKG9wdGlvbnMuc3RvcmFnZSB8fCBjcmVhdGVTaWduYWwpKG9wdGlvbnMuaW5pdGlhbFZhbHVlKSxcbiAgICBbZXJyb3IsIHNldEVycm9yXSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQpLFxuICAgIFt0cmFjaywgdHJpZ2dlcl0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICBlcXVhbHM6IGZhbHNlXG4gICAgfSksXG4gICAgW3N0YXRlLCBzZXRTdGF0ZV0gPSBjcmVhdGVTaWduYWwocmVzb2x2ZWQgPyBcInJlYWR5XCIgOiBcInVucmVzb2x2ZWRcIik7XG4gIGlmIChzaGFyZWRDb25maWcuY29udGV4dCkge1xuICAgIGlkID0gc2hhcmVkQ29uZmlnLmdldE5leHRDb250ZXh0SWQoKTtcbiAgICBpZiAob3B0aW9ucy5zc3JMb2FkRnJvbSA9PT0gXCJpbml0aWFsXCIpIGluaXRQID0gb3B0aW9ucy5pbml0aWFsVmFsdWU7ZWxzZSBpZiAoc2hhcmVkQ29uZmlnLmxvYWQgJiYgc2hhcmVkQ29uZmlnLmhhcyhpZCkpIGluaXRQID0gc2hhcmVkQ29uZmlnLmxvYWQoaWQpO1xuICB9XG4gIGZ1bmN0aW9uIGxvYWRFbmQocCwgdiwgZXJyb3IsIGtleSkge1xuICAgIGlmIChwciA9PT0gcCkge1xuICAgICAgcHIgPSBudWxsO1xuICAgICAga2V5ICE9PSB1bmRlZmluZWQgJiYgKHJlc29sdmVkID0gdHJ1ZSk7XG4gICAgICBpZiAoKHAgPT09IGluaXRQIHx8IHYgPT09IGluaXRQKSAmJiBvcHRpb25zLm9uSHlkcmF0ZWQpIHF1ZXVlTWljcm90YXNrKCgpID0+IG9wdGlvbnMub25IeWRyYXRlZChrZXksIHtcbiAgICAgICAgdmFsdWU6IHZcbiAgICAgIH0pKTtcbiAgICAgIGluaXRQID0gTk9fSU5JVDtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIHAgJiYgbG9hZGVkVW5kZXJUcmFuc2l0aW9uKSB7XG4gICAgICAgIFRyYW5zaXRpb24ucHJvbWlzZXMuZGVsZXRlKHApO1xuICAgICAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBmYWxzZTtcbiAgICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICBjb21wbGV0ZUxvYWQodiwgZXJyb3IpO1xuICAgICAgICB9LCBmYWxzZSk7XG4gICAgICB9IGVsc2UgY29tcGxldGVMb2FkKHYsIGVycm9yKTtcbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH1cbiAgZnVuY3Rpb24gY29tcGxldGVMb2FkKHYsIGVycikge1xuICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgaWYgKGVyciA9PT0gdW5kZWZpbmVkKSBzZXRWYWx1ZSgoKSA9PiB2KTtcbiAgICAgIHNldFN0YXRlKGVyciAhPT0gdW5kZWZpbmVkID8gXCJlcnJvcmVkXCIgOiByZXNvbHZlZCA/IFwicmVhZHlcIiA6IFwidW5yZXNvbHZlZFwiKTtcbiAgICAgIHNldEVycm9yKGVycik7XG4gICAgICBmb3IgKGNvbnN0IGMgb2YgY29udGV4dHMua2V5cygpKSBjLmRlY3JlbWVudCgpO1xuICAgICAgY29udGV4dHMuY2xlYXIoKTtcbiAgICB9LCBmYWxzZSk7XG4gIH1cbiAgZnVuY3Rpb24gcmVhZCgpIHtcbiAgICBjb25zdCBjID0gU3VzcGVuc2VDb250ZXh0ICYmIHVzZUNvbnRleHQoU3VzcGVuc2VDb250ZXh0KSxcbiAgICAgIHYgPSB2YWx1ZSgpLFxuICAgICAgZXJyID0gZXJyb3IoKTtcbiAgICBpZiAoZXJyICE9PSB1bmRlZmluZWQgJiYgIXByKSB0aHJvdyBlcnI7XG4gICAgaWYgKExpc3RlbmVyICYmICFMaXN0ZW5lci51c2VyICYmIGMpIHtcbiAgICAgIGNyZWF0ZUNvbXB1dGVkKCgpID0+IHtcbiAgICAgICAgdHJhY2soKTtcbiAgICAgICAgaWYgKHByKSB7XG4gICAgICAgICAgaWYgKGMucmVzb2x2ZWQgJiYgVHJhbnNpdGlvbiAmJiBsb2FkZWRVbmRlclRyYW5zaXRpb24pIFRyYW5zaXRpb24ucHJvbWlzZXMuYWRkKHByKTtlbHNlIGlmICghY29udGV4dHMuaGFzKGMpKSB7XG4gICAgICAgICAgICBjLmluY3JlbWVudCgpO1xuICAgICAgICAgICAgY29udGV4dHMuYWRkKGMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG4gIGZ1bmN0aW9uIGxvYWQocmVmZXRjaGluZyA9IHRydWUpIHtcbiAgICBpZiAocmVmZXRjaGluZyAhPT0gZmFsc2UgJiYgc2NoZWR1bGVkKSByZXR1cm47XG4gICAgc2NoZWR1bGVkID0gZmFsc2U7XG4gICAgY29uc3QgbG9va3VwID0gZHluYW1pYyA/IGR5bmFtaWMoKSA6IHNvdXJjZTtcbiAgICBsb2FkZWRVbmRlclRyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgICBpZiAobG9va3VwID09IG51bGwgfHwgbG9va3VwID09PSBmYWxzZSkge1xuICAgICAgbG9hZEVuZChwciwgdW50cmFjayh2YWx1ZSkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoVHJhbnNpdGlvbiAmJiBwcikgVHJhbnNpdGlvbi5wcm9taXNlcy5kZWxldGUocHIpO1xuICAgIGxldCBlcnJvcjtcbiAgICBjb25zdCBwID0gaW5pdFAgIT09IE5PX0lOSVQgPyBpbml0UCA6IHVudHJhY2soKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIGZldGNoZXIobG9va3VwLCB7XG4gICAgICAgICAgdmFsdWU6IHZhbHVlKCksXG4gICAgICAgICAgcmVmZXRjaGluZ1xuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2ggKGZldGNoZXJFcnJvcikge1xuICAgICAgICBlcnJvciA9IGZldGNoZXJFcnJvcjtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoZXJyb3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbG9hZEVuZChwciwgdW5kZWZpbmVkLCBjYXN0RXJyb3IoZXJyb3IpLCBsb29rdXApO1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoIWlzUHJvbWlzZShwKSkge1xuICAgICAgbG9hZEVuZChwciwgcCwgdW5kZWZpbmVkLCBsb29rdXApO1xuICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIHByID0gcDtcbiAgICBpZiAoXCJ2XCIgaW4gcCkge1xuICAgICAgaWYgKHAucyA9PT0gMSkgbG9hZEVuZChwciwgcC52LCB1bmRlZmluZWQsIGxvb2t1cCk7ZWxzZSBsb2FkRW5kKHByLCB1bmRlZmluZWQsIGNhc3RFcnJvcihwLnYpLCBsb29rdXApO1xuICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIHNjaGVkdWxlZCA9IHRydWU7XG4gICAgcXVldWVNaWNyb3Rhc2soKCkgPT4gc2NoZWR1bGVkID0gZmFsc2UpO1xuICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgc2V0U3RhdGUocmVzb2x2ZWQgPyBcInJlZnJlc2hpbmdcIiA6IFwicGVuZGluZ1wiKTtcbiAgICAgIHRyaWdnZXIoKTtcbiAgICB9LCBmYWxzZSk7XG4gICAgcmV0dXJuIHAudGhlbih2ID0+IGxvYWRFbmQocCwgdiwgdW5kZWZpbmVkLCBsb29rdXApLCBlID0+IGxvYWRFbmQocCwgdW5kZWZpbmVkLCBjYXN0RXJyb3IoZSksIGxvb2t1cCkpO1xuICB9XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHJlYWQsIHtcbiAgICBzdGF0ZToge1xuICAgICAgZ2V0OiAoKSA9PiBzdGF0ZSgpXG4gICAgfSxcbiAgICBlcnJvcjoge1xuICAgICAgZ2V0OiAoKSA9PiBlcnJvcigpXG4gICAgfSxcbiAgICBsb2FkaW5nOiB7XG4gICAgICBnZXQoKSB7XG4gICAgICAgIGNvbnN0IHMgPSBzdGF0ZSgpO1xuICAgICAgICByZXR1cm4gcyA9PT0gXCJwZW5kaW5nXCIgfHwgcyA9PT0gXCJyZWZyZXNoaW5nXCI7XG4gICAgICB9XG4gICAgfSxcbiAgICBsYXRlc3Q6IHtcbiAgICAgIGdldCgpIHtcbiAgICAgICAgaWYgKCFyZXNvbHZlZCkgcmV0dXJuIHJlYWQoKTtcbiAgICAgICAgY29uc3QgZXJyID0gZXJyb3IoKTtcbiAgICAgICAgaWYgKGVyciAmJiAhcHIpIHRocm93IGVycjtcbiAgICAgICAgcmV0dXJuIHZhbHVlKCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbiAgbGV0IG93bmVyID0gT3duZXI7XG4gIGlmIChkeW5hbWljKSBjcmVhdGVDb21wdXRlZCgoKSA9PiAob3duZXIgPSBPd25lciwgbG9hZChmYWxzZSkpKTtlbHNlIGxvYWQoZmFsc2UpO1xuICByZXR1cm4gW3JlYWQsIHtcbiAgICByZWZldGNoOiBpbmZvID0+IHJ1bldpdGhPd25lcihvd25lciwgKCkgPT4gbG9hZChpbmZvKSksXG4gICAgbXV0YXRlOiBzZXRWYWx1ZVxuICB9XTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZURlZmVycmVkKHNvdXJjZSwgb3B0aW9ucykge1xuICBsZXQgdCxcbiAgICB0aW1lb3V0ID0gb3B0aW9ucyA/IG9wdGlvbnMudGltZW91dE1zIDogdW5kZWZpbmVkO1xuICBjb25zdCBub2RlID0gY3JlYXRlQ29tcHV0YXRpb24oKCkgPT4ge1xuICAgIGlmICghdCB8fCAhdC5mbikgdCA9IHJlcXVlc3RDYWxsYmFjaygoKSA9PiBzZXREZWZlcnJlZCgoKSA9PiBub2RlLnZhbHVlKSwgdGltZW91dCAhPT0gdW5kZWZpbmVkID8ge1xuICAgICAgdGltZW91dFxuICAgIH0gOiB1bmRlZmluZWQpO1xuICAgIHJldHVybiBzb3VyY2UoKTtcbiAgfSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgY29uc3QgW2RlZmVycmVkLCBzZXREZWZlcnJlZF0gPSBjcmVhdGVTaWduYWwoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSwgb3B0aW9ucyk7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICBzZXREZWZlcnJlZCgoKSA9PiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlKTtcbiAgcmV0dXJuIGRlZmVycmVkO1xufVxuZnVuY3Rpb24gY3JlYXRlU2VsZWN0b3Ioc291cmNlLCBmbiA9IGVxdWFsRm4sIG9wdGlvbnMpIHtcbiAgY29uc3Qgc3VicyA9IG5ldyBNYXAoKTtcbiAgY29uc3Qgbm9kZSA9IGNyZWF0ZUNvbXB1dGF0aW9uKHAgPT4ge1xuICAgIGNvbnN0IHYgPSBzb3VyY2UoKTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2Ygc3Vicy5lbnRyaWVzKCkpIGlmIChmbihrZXksIHYpICE9PSBmbihrZXksIHApKSB7XG4gICAgICBmb3IgKGNvbnN0IGMgb2YgdmFsLnZhbHVlcygpKSB7XG4gICAgICAgIGMuc3RhdGUgPSBTVEFMRTtcbiAgICAgICAgaWYgKGMucHVyZSkgVXBkYXRlcy5wdXNoKGMpO2Vsc2UgRWZmZWN0cy5wdXNoKGMpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfSwgdW5kZWZpbmVkLCB0cnVlLCBTVEFMRSwgb3B0aW9ucyApO1xuICB1cGRhdGVDb21wdXRhdGlvbihub2RlKTtcbiAgcmV0dXJuIGtleSA9PiB7XG4gICAgY29uc3QgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgICBpZiAobGlzdGVuZXIpIHtcbiAgICAgIGxldCBsO1xuICAgICAgaWYgKGwgPSBzdWJzLmdldChrZXkpKSBsLmFkZChsaXN0ZW5lcik7ZWxzZSBzdWJzLnNldChrZXksIGwgPSBuZXcgU2V0KFtsaXN0ZW5lcl0pKTtcbiAgICAgIG9uQ2xlYW51cCgoKSA9PiB7XG4gICAgICAgIGwuZGVsZXRlKGxpc3RlbmVyKTtcbiAgICAgICAgIWwuc2l6ZSAmJiBzdWJzLmRlbGV0ZShrZXkpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBmbihrZXksIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUpO1xuICB9O1xufVxuZnVuY3Rpb24gYmF0Y2goZm4pIHtcbiAgcmV0dXJuIHJ1blVwZGF0ZXMoZm4sIGZhbHNlKTtcbn1cbmZ1bmN0aW9uIHVudHJhY2soZm4pIHtcbiAgaWYgKCFFeHRlcm5hbFNvdXJjZUNvbmZpZyAmJiBMaXN0ZW5lciA9PT0gbnVsbCkgcmV0dXJuIGZuKCk7XG4gIGNvbnN0IGxpc3RlbmVyID0gTGlzdGVuZXI7XG4gIExpc3RlbmVyID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcpIHJldHVybiBFeHRlcm5hbFNvdXJjZUNvbmZpZy51bnRyYWNrKGZuKTtcbiAgICByZXR1cm4gZm4oKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICB9XG59XG5mdW5jdGlvbiBvbihkZXBzLCBmbiwgb3B0aW9ucykge1xuICBjb25zdCBpc0FycmF5ID0gQXJyYXkuaXNBcnJheShkZXBzKTtcbiAgbGV0IHByZXZJbnB1dDtcbiAgbGV0IGRlZmVyID0gb3B0aW9ucyAmJiBvcHRpb25zLmRlZmVyO1xuICByZXR1cm4gcHJldlZhbHVlID0+IHtcbiAgICBsZXQgaW5wdXQ7XG4gICAgaWYgKGlzQXJyYXkpIHtcbiAgICAgIGlucHV0ID0gQXJyYXkoZGVwcy5sZW5ndGgpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZXBzLmxlbmd0aDsgaSsrKSBpbnB1dFtpXSA9IGRlcHNbaV0oKTtcbiAgICB9IGVsc2UgaW5wdXQgPSBkZXBzKCk7XG4gICAgaWYgKGRlZmVyKSB7XG4gICAgICBkZWZlciA9IGZhbHNlO1xuICAgICAgcmV0dXJuIHByZXZWYWx1ZTtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gdW50cmFjaygoKSA9PiBmbihpbnB1dCwgcHJldklucHV0LCBwcmV2VmFsdWUpKTtcbiAgICBwcmV2SW5wdXQgPSBpbnB1dDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xufVxuZnVuY3Rpb24gb25Nb3VudChmbikge1xuICBjcmVhdGVFZmZlY3QoKCkgPT4gdW50cmFjayhmbikpO1xufVxuZnVuY3Rpb24gb25DbGVhbnVwKGZuKSB7XG4gIGlmIChPd25lciA9PT0gbnVsbCkgY29uc29sZS53YXJuKFwiY2xlYW51cHMgY3JlYXRlZCBvdXRzaWRlIGEgYGNyZWF0ZVJvb3RgIG9yIGByZW5kZXJgIHdpbGwgbmV2ZXIgYmUgcnVuXCIpO2Vsc2UgaWYgKE93bmVyLmNsZWFudXBzID09PSBudWxsKSBPd25lci5jbGVhbnVwcyA9IFtmbl07ZWxzZSBPd25lci5jbGVhbnVwcy5wdXNoKGZuKTtcbiAgcmV0dXJuIGZuO1xufVxuZnVuY3Rpb24gY2F0Y2hFcnJvcihmbiwgaGFuZGxlcikge1xuICBFUlJPUiB8fCAoRVJST1IgPSBTeW1ib2woXCJlcnJvclwiKSk7XG4gIE93bmVyID0gY3JlYXRlQ29tcHV0YXRpb24odW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuICBPd25lci5jb250ZXh0ID0ge1xuICAgIC4uLk93bmVyLmNvbnRleHQsXG4gICAgW0VSUk9SXTogW2hhbmRsZXJdXG4gIH07XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgVHJhbnNpdGlvbi5zb3VyY2VzLmFkZChPd25lcik7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGZuKCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGhhbmRsZUVycm9yKGVycik7XG4gIH0gZmluYWxseSB7XG4gICAgT3duZXIgPSBPd25lci5vd25lcjtcbiAgfVxufVxuZnVuY3Rpb24gZ2V0TGlzdGVuZXIoKSB7XG4gIHJldHVybiBMaXN0ZW5lcjtcbn1cbmZ1bmN0aW9uIGdldE93bmVyKCkge1xuICByZXR1cm4gT3duZXI7XG59XG5mdW5jdGlvbiBydW5XaXRoT3duZXIobywgZm4pIHtcbiAgY29uc3QgcHJldiA9IE93bmVyO1xuICBjb25zdCBwcmV2TGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgT3duZXIgPSBvO1xuICBMaXN0ZW5lciA9IG51bGw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJ1blVwZGF0ZXMoZm4sIHRydWUpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBoYW5kbGVFcnJvcihlcnIpO1xuICB9IGZpbmFsbHkge1xuICAgIE93bmVyID0gcHJldjtcbiAgICBMaXN0ZW5lciA9IHByZXZMaXN0ZW5lcjtcbiAgfVxufVxuZnVuY3Rpb24gZW5hYmxlU2NoZWR1bGluZyhzY2hlZHVsZXIgPSByZXF1ZXN0Q2FsbGJhY2spIHtcbiAgU2NoZWR1bGVyID0gc2NoZWR1bGVyO1xufVxuZnVuY3Rpb24gc3RhcnRUcmFuc2l0aW9uKGZuKSB7XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGZuKCk7XG4gICAgcmV0dXJuIFRyYW5zaXRpb24uZG9uZTtcbiAgfVxuICBjb25zdCBsID0gTGlzdGVuZXI7XG4gIGNvbnN0IG8gPSBPd25lcjtcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oKCkgPT4ge1xuICAgIExpc3RlbmVyID0gbDtcbiAgICBPd25lciA9IG87XG4gICAgbGV0IHQ7XG4gICAgaWYgKFNjaGVkdWxlciB8fCBTdXNwZW5zZUNvbnRleHQpIHtcbiAgICAgIHQgPSBUcmFuc2l0aW9uIHx8IChUcmFuc2l0aW9uID0ge1xuICAgICAgICBzb3VyY2VzOiBuZXcgU2V0KCksXG4gICAgICAgIGVmZmVjdHM6IFtdLFxuICAgICAgICBwcm9taXNlczogbmV3IFNldCgpLFxuICAgICAgICBkaXNwb3NlZDogbmV3IFNldCgpLFxuICAgICAgICBxdWV1ZTogbmV3IFNldCgpLFxuICAgICAgICBydW5uaW5nOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIHQuZG9uZSB8fCAodC5kb25lID0gbmV3IFByb21pc2UocmVzID0+IHQucmVzb2x2ZSA9IHJlcykpO1xuICAgICAgdC5ydW5uaW5nID0gdHJ1ZTtcbiAgICB9XG4gICAgcnVuVXBkYXRlcyhmbiwgZmFsc2UpO1xuICAgIExpc3RlbmVyID0gT3duZXIgPSBudWxsO1xuICAgIHJldHVybiB0ID8gdC5kb25lIDogdW5kZWZpbmVkO1xuICB9KTtcbn1cbmNvbnN0IFt0cmFuc1BlbmRpbmcsIHNldFRyYW5zUGVuZGluZ10gPSAvKkBfX1BVUkVfXyovY3JlYXRlU2lnbmFsKGZhbHNlKTtcbmZ1bmN0aW9uIHVzZVRyYW5zaXRpb24oKSB7XG4gIHJldHVybiBbdHJhbnNQZW5kaW5nLCBzdGFydFRyYW5zaXRpb25dO1xufVxuZnVuY3Rpb24gcmVzdW1lRWZmZWN0cyhlKSB7XG4gIEVmZmVjdHMucHVzaC5hcHBseShFZmZlY3RzLCBlKTtcbiAgZS5sZW5ndGggPSAwO1xufVxuZnVuY3Rpb24gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzKSB7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbigoKSA9PiB1bnRyYWNrKCgpID0+IHtcbiAgICBPYmplY3QuYXNzaWduKENvbXAsIHtcbiAgICAgIFskREVWQ09NUF06IHRydWVcbiAgICB9KTtcbiAgICByZXR1cm4gQ29tcChwcm9wcyk7XG4gIH0pLCB1bmRlZmluZWQsIHRydWUsIDApO1xuICBjLnByb3BzID0gcHJvcHM7XG4gIGMub2JzZXJ2ZXJzID0gbnVsbDtcbiAgYy5vYnNlcnZlclNsb3RzID0gbnVsbDtcbiAgYy5uYW1lID0gQ29tcC5uYW1lO1xuICBjLmNvbXBvbmVudCA9IENvbXA7XG4gIHVwZGF0ZUNvbXB1dGF0aW9uKGMpO1xuICByZXR1cm4gYy50VmFsdWUgIT09IHVuZGVmaW5lZCA/IGMudFZhbHVlIDogYy52YWx1ZTtcbn1cbmZ1bmN0aW9uIHJlZ2lzdGVyR3JhcGgodmFsdWUpIHtcbiAgaWYgKE93bmVyKSB7XG4gICAgaWYgKE93bmVyLnNvdXJjZU1hcCkgT3duZXIuc291cmNlTWFwLnB1c2godmFsdWUpO2Vsc2UgT3duZXIuc291cmNlTWFwID0gW3ZhbHVlXTtcbiAgICB2YWx1ZS5ncmFwaCA9IE93bmVyO1xuICB9XG4gIGlmIChEZXZIb29rcy5hZnRlclJlZ2lzdGVyR3JhcGgpIERldkhvb2tzLmFmdGVyUmVnaXN0ZXJHcmFwaCh2YWx1ZSk7XG59XG5mdW5jdGlvbiBjcmVhdGVDb250ZXh0KGRlZmF1bHRWYWx1ZSwgb3B0aW9ucykge1xuICBjb25zdCBpZCA9IFN5bWJvbChcImNvbnRleHRcIik7XG4gIHJldHVybiB7XG4gICAgaWQsXG4gICAgUHJvdmlkZXI6IGNyZWF0ZVByb3ZpZGVyKGlkLCBvcHRpb25zKSxcbiAgICBkZWZhdWx0VmFsdWVcbiAgfTtcbn1cbmZ1bmN0aW9uIHVzZUNvbnRleHQoY29udGV4dCkge1xuICBsZXQgdmFsdWU7XG4gIHJldHVybiBPd25lciAmJiBPd25lci5jb250ZXh0ICYmICh2YWx1ZSA9IE93bmVyLmNvbnRleHRbY29udGV4dC5pZF0pICE9PSB1bmRlZmluZWQgPyB2YWx1ZSA6IGNvbnRleHQuZGVmYXVsdFZhbHVlO1xufVxuZnVuY3Rpb24gY2hpbGRyZW4oZm4pIHtcbiAgY29uc3QgY2hpbGRyZW4gPSBjcmVhdGVNZW1vKGZuKTtcbiAgY29uc3QgbWVtbyA9IGNyZWF0ZU1lbW8oKCkgPT4gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKCkpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcImNoaWxkcmVuXCJcbiAgfSkgO1xuICBtZW1vLnRvQXJyYXkgPSAoKSA9PiB7XG4gICAgY29uc3QgYyA9IG1lbW8oKTtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShjKSA/IGMgOiBjICE9IG51bGwgPyBbY10gOiBbXTtcbiAgfTtcbiAgcmV0dXJuIG1lbW87XG59XG5sZXQgU3VzcGVuc2VDb250ZXh0O1xuZnVuY3Rpb24gZ2V0U3VzcGVuc2VDb250ZXh0KCkge1xuICByZXR1cm4gU3VzcGVuc2VDb250ZXh0IHx8IChTdXNwZW5zZUNvbnRleHQgPSBjcmVhdGVDb250ZXh0KCkpO1xufVxuZnVuY3Rpb24gZW5hYmxlRXh0ZXJuYWxTb3VyY2UoZmFjdG9yeSwgdW50cmFjayA9IGZuID0+IGZuKCkpIHtcbiAgaWYgKEV4dGVybmFsU291cmNlQ29uZmlnKSB7XG4gICAgY29uc3Qge1xuICAgICAgZmFjdG9yeTogb2xkRmFjdG9yeSxcbiAgICAgIHVudHJhY2s6IG9sZFVudHJhY2tcbiAgICB9ID0gRXh0ZXJuYWxTb3VyY2VDb25maWc7XG4gICAgRXh0ZXJuYWxTb3VyY2VDb25maWcgPSB7XG4gICAgICBmYWN0b3J5OiAoZm4sIHRyaWdnZXIpID0+IHtcbiAgICAgICAgY29uc3Qgb2xkU291cmNlID0gb2xkRmFjdG9yeShmbiwgdHJpZ2dlcik7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IGZhY3RvcnkoeCA9PiBvbGRTb3VyY2UudHJhY2soeCksIHRyaWdnZXIpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHRyYWNrOiB4ID0+IHNvdXJjZS50cmFjayh4KSxcbiAgICAgICAgICBkaXNwb3NlKCkge1xuICAgICAgICAgICAgc291cmNlLmRpc3Bvc2UoKTtcbiAgICAgICAgICAgIG9sZFNvdXJjZS5kaXNwb3NlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIHVudHJhY2s6IGZuID0+IG9sZFVudHJhY2soKCkgPT4gdW50cmFjayhmbikpXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBFeHRlcm5hbFNvdXJjZUNvbmZpZyA9IHtcbiAgICAgIGZhY3RvcnksXG4gICAgICB1bnRyYWNrXG4gICAgfTtcbiAgfVxufVxuZnVuY3Rpb24gcmVhZFNpZ25hbCgpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgaWYgKHRoaXMuc291cmNlcyAmJiAocnVubmluZ1RyYW5zaXRpb24gPyB0aGlzLnRTdGF0ZSA6IHRoaXMuc3RhdGUpKSB7XG4gICAgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IHRoaXMudFN0YXRlIDogdGhpcy5zdGF0ZSkgPT09IFNUQUxFKSB1cGRhdGVDb21wdXRhdGlvbih0aGlzKTtlbHNlIHtcbiAgICAgIGNvbnN0IHVwZGF0ZXMgPSBVcGRhdGVzO1xuICAgICAgVXBkYXRlcyA9IG51bGw7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IGxvb2tVcHN0cmVhbSh0aGlzKSwgZmFsc2UpO1xuICAgICAgVXBkYXRlcyA9IHVwZGF0ZXM7XG4gICAgfVxuICB9XG4gIGlmIChMaXN0ZW5lcikge1xuICAgIGNvbnN0IHNTbG90ID0gdGhpcy5vYnNlcnZlcnMgPyB0aGlzLm9ic2VydmVycy5sZW5ndGggOiAwO1xuICAgIGlmICghTGlzdGVuZXIuc291cmNlcykge1xuICAgICAgTGlzdGVuZXIuc291cmNlcyA9IFt0aGlzXTtcbiAgICAgIExpc3RlbmVyLnNvdXJjZVNsb3RzID0gW3NTbG90XTtcbiAgICB9IGVsc2Uge1xuICAgICAgTGlzdGVuZXIuc291cmNlcy5wdXNoKHRoaXMpO1xuICAgICAgTGlzdGVuZXIuc291cmNlU2xvdHMucHVzaChzU2xvdCk7XG4gICAgfVxuICAgIGlmICghdGhpcy5vYnNlcnZlcnMpIHtcbiAgICAgIHRoaXMub2JzZXJ2ZXJzID0gW0xpc3RlbmVyXTtcbiAgICAgIHRoaXMub2JzZXJ2ZXJTbG90cyA9IFtMaXN0ZW5lci5zb3VyY2VzLmxlbmd0aCAtIDFdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9ic2VydmVycy5wdXNoKExpc3RlbmVyKTtcbiAgICAgIHRoaXMub2JzZXJ2ZXJTbG90cy5wdXNoKExpc3RlbmVyLnNvdXJjZXMubGVuZ3RoIC0gMSk7XG4gICAgfVxuICB9XG4gIGlmIChydW5uaW5nVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKHRoaXMpKSByZXR1cm4gdGhpcy50VmFsdWU7XG4gIHJldHVybiB0aGlzLnZhbHVlO1xufVxuZnVuY3Rpb24gd3JpdGVTaWduYWwobm9kZSwgdmFsdWUsIGlzQ29tcCkge1xuICBsZXQgY3VycmVudCA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWU7XG4gIGlmICghbm9kZS5jb21wYXJhdG9yIHx8ICFub2RlLmNvbXBhcmF0b3IoY3VycmVudCwgdmFsdWUpKSB7XG4gICAgaWYgKFRyYW5zaXRpb24pIHtcbiAgICAgIGNvbnN0IFRyYW5zaXRpb25SdW5uaW5nID0gVHJhbnNpdGlvbi5ydW5uaW5nO1xuICAgICAgaWYgKFRyYW5zaXRpb25SdW5uaW5nIHx8ICFpc0NvbXAgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSkge1xuICAgICAgICBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKG5vZGUpO1xuICAgICAgICBub2RlLnRWYWx1ZSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgaWYgKCFUcmFuc2l0aW9uUnVubmluZykgbm9kZS52YWx1ZSA9IHZhbHVlO1xuICAgIH0gZWxzZSBub2RlLnZhbHVlID0gdmFsdWU7XG4gICAgaWYgKG5vZGUub2JzZXJ2ZXJzICYmIG5vZGUub2JzZXJ2ZXJzLmxlbmd0aCkge1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5vYnNlcnZlcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICBjb25zdCBvID0gbm9kZS5vYnNlcnZlcnNbaV07XG4gICAgICAgICAgY29uc3QgVHJhbnNpdGlvblJ1bm5pbmcgPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgICAgICAgICBpZiAoVHJhbnNpdGlvblJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXMobykpIGNvbnRpbnVlO1xuICAgICAgICAgIGlmIChUcmFuc2l0aW9uUnVubmluZyA/ICFvLnRTdGF0ZSA6ICFvLnN0YXRlKSB7XG4gICAgICAgICAgICBpZiAoby5wdXJlKSBVcGRhdGVzLnB1c2gobyk7ZWxzZSBFZmZlY3RzLnB1c2gobyk7XG4gICAgICAgICAgICBpZiAoby5vYnNlcnZlcnMpIG1hcmtEb3duc3RyZWFtKG8pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIVRyYW5zaXRpb25SdW5uaW5nKSBvLnN0YXRlID0gU1RBTEU7ZWxzZSBvLnRTdGF0ZSA9IFNUQUxFO1xuICAgICAgICB9XG4gICAgICAgIGlmIChVcGRhdGVzLmxlbmd0aCA+IDEwZTUpIHtcbiAgICAgICAgICBVcGRhdGVzID0gW107XG4gICAgICAgICAgaWYgKElTX0RFVikgdGhyb3cgbmV3IEVycm9yKFwiUG90ZW50aWFsIEluZmluaXRlIExvb3AgRGV0ZWN0ZWQuXCIpO1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuICAgICAgICB9XG4gICAgICB9LCBmYWxzZSk7XG4gICAgfVxuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpIHtcbiAgaWYgKCFub2RlLmZuKSByZXR1cm47XG4gIGNsZWFuTm9kZShub2RlKTtcbiAgY29uc3QgdGltZSA9IEV4ZWNDb3VudDtcbiAgcnVuQ29tcHV0YXRpb24obm9kZSwgVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSwgdGltZSk7XG4gIGlmIChUcmFuc2l0aW9uICYmICFUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSkge1xuICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICBUcmFuc2l0aW9uICYmIChUcmFuc2l0aW9uLnJ1bm5pbmcgPSB0cnVlKTtcbiAgICAgICAgTGlzdGVuZXIgPSBPd25lciA9IG5vZGU7XG4gICAgICAgIHJ1bkNvbXB1dGF0aW9uKG5vZGUsIG5vZGUudFZhbHVlLCB0aW1lKTtcbiAgICAgICAgTGlzdGVuZXIgPSBPd25lciA9IG51bGw7XG4gICAgICB9LCBmYWxzZSk7XG4gICAgfSk7XG4gIH1cbn1cbmZ1bmN0aW9uIHJ1bkNvbXB1dGF0aW9uKG5vZGUsIHZhbHVlLCB0aW1lKSB7XG4gIGxldCBuZXh0VmFsdWU7XG4gIGNvbnN0IG93bmVyID0gT3duZXIsXG4gICAgbGlzdGVuZXIgPSBMaXN0ZW5lcjtcbiAgTGlzdGVuZXIgPSBPd25lciA9IG5vZGU7XG4gIHRyeSB7XG4gICAgbmV4dFZhbHVlID0gbm9kZS5mbih2YWx1ZSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmIChub2RlLnB1cmUpIHtcbiAgICAgIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgICAgICBub2RlLnRTdGF0ZSA9IFNUQUxFO1xuICAgICAgICBub2RlLnRPd25lZCAmJiBub2RlLnRPd25lZC5mb3JFYWNoKGNsZWFuTm9kZSk7XG4gICAgICAgIG5vZGUudE93bmVkID0gdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9kZS5zdGF0ZSA9IFNUQUxFO1xuICAgICAgICBub2RlLm93bmVkICYmIG5vZGUub3duZWQuZm9yRWFjaChjbGVhbk5vZGUpO1xuICAgICAgICBub2RlLm93bmVkID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgbm9kZS51cGRhdGVkQXQgPSB0aW1lICsgMTtcbiAgICByZXR1cm4gaGFuZGxlRXJyb3IoZXJyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBMaXN0ZW5lciA9IGxpc3RlbmVyO1xuICAgIE93bmVyID0gb3duZXI7XG4gIH1cbiAgaWYgKCFub2RlLnVwZGF0ZWRBdCB8fCBub2RlLnVwZGF0ZWRBdCA8PSB0aW1lKSB7XG4gICAgaWYgKG5vZGUudXBkYXRlZEF0ICE9IG51bGwgJiYgXCJvYnNlcnZlcnNcIiBpbiBub2RlKSB7XG4gICAgICB3cml0ZVNpZ25hbChub2RlLCBuZXh0VmFsdWUsIHRydWUpO1xuICAgIH0gZWxzZSBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgbm9kZS5wdXJlKSB7XG4gICAgICBUcmFuc2l0aW9uLnNvdXJjZXMuYWRkKG5vZGUpO1xuICAgICAgbm9kZS50VmFsdWUgPSBuZXh0VmFsdWU7XG4gICAgfSBlbHNlIG5vZGUudmFsdWUgPSBuZXh0VmFsdWU7XG4gICAgbm9kZS51cGRhdGVkQXQgPSB0aW1lO1xuICB9XG59XG5mdW5jdGlvbiBjcmVhdGVDb21wdXRhdGlvbihmbiwgaW5pdCwgcHVyZSwgc3RhdGUgPSBTVEFMRSwgb3B0aW9ucykge1xuICBjb25zdCBjID0ge1xuICAgIGZuLFxuICAgIHN0YXRlOiBzdGF0ZSxcbiAgICB1cGRhdGVkQXQ6IG51bGwsXG4gICAgb3duZWQ6IG51bGwsXG4gICAgc291cmNlczogbnVsbCxcbiAgICBzb3VyY2VTbG90czogbnVsbCxcbiAgICBjbGVhbnVwczogbnVsbCxcbiAgICB2YWx1ZTogaW5pdCxcbiAgICBvd25lcjogT3duZXIsXG4gICAgY29udGV4dDogT3duZXIgPyBPd25lci5jb250ZXh0IDogbnVsbCxcbiAgICBwdXJlXG4gIH07XG4gIGlmIChUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykge1xuICAgIGMuc3RhdGUgPSAwO1xuICAgIGMudFN0YXRlID0gc3RhdGU7XG4gIH1cbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJjb21wdXRhdGlvbnMgY3JlYXRlZCBvdXRzaWRlIGEgYGNyZWF0ZVJvb3RgIG9yIGByZW5kZXJgIHdpbGwgbmV2ZXIgYmUgZGlzcG9zZWRcIik7ZWxzZSBpZiAoT3duZXIgIT09IFVOT1dORUQpIHtcbiAgICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgT3duZXIucHVyZSkge1xuICAgICAgaWYgKCFPd25lci50T3duZWQpIE93bmVyLnRPd25lZCA9IFtjXTtlbHNlIE93bmVyLnRPd25lZC5wdXNoKGMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIU93bmVyLm93bmVkKSBPd25lci5vd25lZCA9IFtjXTtlbHNlIE93bmVyLm93bmVkLnB1c2goYyk7XG4gICAgfVxuICB9XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMubmFtZSkgYy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuICBpZiAoRXh0ZXJuYWxTb3VyY2VDb25maWcgJiYgYy5mbikge1xuICAgIGNvbnN0IFt0cmFjaywgdHJpZ2dlcl0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkLCB7XG4gICAgICBlcXVhbHM6IGZhbHNlXG4gICAgfSk7XG4gICAgY29uc3Qgb3JkaW5hcnkgPSBFeHRlcm5hbFNvdXJjZUNvbmZpZy5mYWN0b3J5KGMuZm4sIHRyaWdnZXIpO1xuICAgIG9uQ2xlYW51cCgoKSA9PiBvcmRpbmFyeS5kaXNwb3NlKCkpO1xuICAgIGNvbnN0IHRyaWdnZXJJblRyYW5zaXRpb24gPSAoKSA9PiBzdGFydFRyYW5zaXRpb24odHJpZ2dlcikudGhlbigoKSA9PiBpblRyYW5zaXRpb24uZGlzcG9zZSgpKTtcbiAgICBjb25zdCBpblRyYW5zaXRpb24gPSBFeHRlcm5hbFNvdXJjZUNvbmZpZy5mYWN0b3J5KGMuZm4sIHRyaWdnZXJJblRyYW5zaXRpb24pO1xuICAgIGMuZm4gPSB4ID0+IHtcbiAgICAgIHRyYWNrKCk7XG4gICAgICByZXR1cm4gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgPyBpblRyYW5zaXRpb24udHJhY2soeCkgOiBvcmRpbmFyeS50cmFjayh4KTtcbiAgICB9O1xuICB9XG4gIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIgJiYgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lcihjKTtcbiAgcmV0dXJuIGM7XG59XG5mdW5jdGlvbiBydW5Ub3Aobm9kZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gMCkgcmV0dXJuO1xuICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gUEVORElORykgcmV0dXJuIGxvb2tVcHN0cmVhbShub2RlKTtcbiAgaWYgKG5vZGUuc3VzcGVuc2UgJiYgdW50cmFjayhub2RlLnN1c3BlbnNlLmluRmFsbGJhY2spKSByZXR1cm4gbm9kZS5zdXNwZW5zZS5lZmZlY3RzLnB1c2gobm9kZSk7XG4gIGNvbnN0IGFuY2VzdG9ycyA9IFtub2RlXTtcbiAgd2hpbGUgKChub2RlID0gbm9kZS5vd25lcikgJiYgKCFub2RlLnVwZGF0ZWRBdCB8fCBub2RlLnVwZGF0ZWRBdCA8IEV4ZWNDb3VudCkpIHtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXMobm9kZSkpIHJldHVybjtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24gPyBub2RlLnRTdGF0ZSA6IG5vZGUuc3RhdGUpIGFuY2VzdG9ycy5wdXNoKG5vZGUpO1xuICB9XG4gIGZvciAobGV0IGkgPSBhbmNlc3RvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBub2RlID0gYW5jZXN0b3JzW2ldO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbikge1xuICAgICAgbGV0IHRvcCA9IG5vZGUsXG4gICAgICAgIHByZXYgPSBhbmNlc3RvcnNbaSArIDFdO1xuICAgICAgd2hpbGUgKCh0b3AgPSB0b3Aub3duZXIpICYmIHRvcCAhPT0gcHJldikge1xuICAgICAgICBpZiAoVHJhbnNpdGlvbi5kaXNwb3NlZC5oYXModG9wKSkgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gU1RBTEUpIHtcbiAgICAgIHVwZGF0ZUNvbXB1dGF0aW9uKG5vZGUpO1xuICAgIH0gZWxzZSBpZiAoKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSA9PT0gUEVORElORykge1xuICAgICAgY29uc3QgdXBkYXRlcyA9IFVwZGF0ZXM7XG4gICAgICBVcGRhdGVzID0gbnVsbDtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4gbG9va1Vwc3RyZWFtKG5vZGUsIGFuY2VzdG9yc1swXSksIGZhbHNlKTtcbiAgICAgIFVwZGF0ZXMgPSB1cGRhdGVzO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gcnVuVXBkYXRlcyhmbiwgaW5pdCkge1xuICBpZiAoVXBkYXRlcykgcmV0dXJuIGZuKCk7XG4gIGxldCB3YWl0ID0gZmFsc2U7XG4gIGlmICghaW5pdCkgVXBkYXRlcyA9IFtdO1xuICBpZiAoRWZmZWN0cykgd2FpdCA9IHRydWU7ZWxzZSBFZmZlY3RzID0gW107XG4gIEV4ZWNDb3VudCsrO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGZuKCk7XG4gICAgY29tcGxldGVVcGRhdGVzKHdhaXQpO1xuICAgIHJldHVybiByZXM7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmICghd2FpdCkgRWZmZWN0cyA9IG51bGw7XG4gICAgVXBkYXRlcyA9IG51bGw7XG4gICAgaGFuZGxlRXJyb3IoZXJyKTtcbiAgfVxufVxuZnVuY3Rpb24gY29tcGxldGVVcGRhdGVzKHdhaXQpIHtcbiAgaWYgKFVwZGF0ZXMpIHtcbiAgICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBzY2hlZHVsZVF1ZXVlKFVwZGF0ZXMpO2Vsc2UgcnVuUXVldWUoVXBkYXRlcyk7XG4gICAgVXBkYXRlcyA9IG51bGw7XG4gIH1cbiAgaWYgKHdhaXQpIHJldHVybjtcbiAgbGV0IHJlcztcbiAgaWYgKFRyYW5zaXRpb24pIHtcbiAgICBpZiAoIVRyYW5zaXRpb24ucHJvbWlzZXMuc2l6ZSAmJiAhVHJhbnNpdGlvbi5xdWV1ZS5zaXplKSB7XG4gICAgICBjb25zdCBzb3VyY2VzID0gVHJhbnNpdGlvbi5zb3VyY2VzO1xuICAgICAgY29uc3QgZGlzcG9zZWQgPSBUcmFuc2l0aW9uLmRpc3Bvc2VkO1xuICAgICAgRWZmZWN0cy5wdXNoLmFwcGx5KEVmZmVjdHMsIFRyYW5zaXRpb24uZWZmZWN0cyk7XG4gICAgICByZXMgPSBUcmFuc2l0aW9uLnJlc29sdmU7XG4gICAgICBmb3IgKGNvbnN0IGUgb2YgRWZmZWN0cykge1xuICAgICAgICBcInRTdGF0ZVwiIGluIGUgJiYgKGUuc3RhdGUgPSBlLnRTdGF0ZSk7XG4gICAgICAgIGRlbGV0ZSBlLnRTdGF0ZTtcbiAgICAgIH1cbiAgICAgIFRyYW5zaXRpb24gPSBudWxsO1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgZCBvZiBkaXNwb3NlZCkgY2xlYW5Ob2RlKGQpO1xuICAgICAgICBmb3IgKGNvbnN0IHYgb2Ygc291cmNlcykge1xuICAgICAgICAgIHYudmFsdWUgPSB2LnRWYWx1ZTtcbiAgICAgICAgICBpZiAodi5vd25lZCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHYub3duZWQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIGNsZWFuTm9kZSh2Lm93bmVkW2ldKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHYudE93bmVkKSB2Lm93bmVkID0gdi50T3duZWQ7XG4gICAgICAgICAgZGVsZXRlIHYudFZhbHVlO1xuICAgICAgICAgIGRlbGV0ZSB2LnRPd25lZDtcbiAgICAgICAgICB2LnRTdGF0ZSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgc2V0VHJhbnNQZW5kaW5nKGZhbHNlKTtcbiAgICAgIH0sIGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKFRyYW5zaXRpb24ucnVubmluZykge1xuICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gZmFsc2U7XG4gICAgICBUcmFuc2l0aW9uLmVmZmVjdHMucHVzaC5hcHBseShUcmFuc2l0aW9uLmVmZmVjdHMsIEVmZmVjdHMpO1xuICAgICAgRWZmZWN0cyA9IG51bGw7XG4gICAgICBzZXRUcmFuc1BlbmRpbmcodHJ1ZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG4gIGNvbnN0IGUgPSBFZmZlY3RzO1xuICBFZmZlY3RzID0gbnVsbDtcbiAgaWYgKGUubGVuZ3RoKSBydW5VcGRhdGVzKCgpID0+IHJ1bkVmZmVjdHMoZSksIGZhbHNlKTtlbHNlIERldkhvb2tzLmFmdGVyVXBkYXRlICYmIERldkhvb2tzLmFmdGVyVXBkYXRlKCk7XG4gIGlmIChyZXMpIHJlcygpO1xufVxuZnVuY3Rpb24gcnVuUXVldWUocXVldWUpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykgcnVuVG9wKHF1ZXVlW2ldKTtcbn1cbmZ1bmN0aW9uIHNjaGVkdWxlUXVldWUocXVldWUpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGl0ZW0gPSBxdWV1ZVtpXTtcbiAgICBjb25zdCB0YXNrcyA9IFRyYW5zaXRpb24ucXVldWU7XG4gICAgaWYgKCF0YXNrcy5oYXMoaXRlbSkpIHtcbiAgICAgIHRhc2tzLmFkZChpdGVtKTtcbiAgICAgIFNjaGVkdWxlcigoKSA9PiB7XG4gICAgICAgIHRhc2tzLmRlbGV0ZShpdGVtKTtcbiAgICAgICAgcnVuVXBkYXRlcygoKSA9PiB7XG4gICAgICAgICAgVHJhbnNpdGlvbi5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICBydW5Ub3AoaXRlbSk7XG4gICAgICAgIH0sIGZhbHNlKTtcbiAgICAgICAgVHJhbnNpdGlvbiAmJiAoVHJhbnNpdGlvbi5ydW5uaW5nID0gZmFsc2UpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBydW5Vc2VyRWZmZWN0cyhxdWV1ZSkge1xuICBsZXQgaSxcbiAgICB1c2VyTGVuZ3RoID0gMDtcbiAgZm9yIChpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZSA9IHF1ZXVlW2ldO1xuICAgIGlmICghZS51c2VyKSBydW5Ub3AoZSk7ZWxzZSBxdWV1ZVt1c2VyTGVuZ3RoKytdID0gZTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQpIHtcbiAgICBpZiAoc2hhcmVkQ29uZmlnLmNvdW50KSB7XG4gICAgICBzaGFyZWRDb25maWcuZWZmZWN0cyB8fCAoc2hhcmVkQ29uZmlnLmVmZmVjdHMgPSBbXSk7XG4gICAgICBzaGFyZWRDb25maWcuZWZmZWN0cy5wdXNoKC4uLnF1ZXVlLnNsaWNlKDAsIHVzZXJMZW5ndGgpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgfVxuICBpZiAoc2hhcmVkQ29uZmlnLmVmZmVjdHMgJiYgKHNoYXJlZENvbmZpZy5kb25lIHx8ICFzaGFyZWRDb25maWcuY291bnQpKSB7XG4gICAgcXVldWUgPSBbLi4uc2hhcmVkQ29uZmlnLmVmZmVjdHMsIC4uLnF1ZXVlXTtcbiAgICB1c2VyTGVuZ3RoICs9IHNoYXJlZENvbmZpZy5lZmZlY3RzLmxlbmd0aDtcbiAgICBkZWxldGUgc2hhcmVkQ29uZmlnLmVmZmVjdHM7XG4gIH1cbiAgZm9yIChpID0gMDsgaSA8IHVzZXJMZW5ndGg7IGkrKykgcnVuVG9wKHF1ZXVlW2ldKTtcbn1cbmZ1bmN0aW9uIGxvb2tVcHN0cmVhbShub2RlLCBpZ25vcmUpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uKSBub2RlLnRTdGF0ZSA9IDA7ZWxzZSBub2RlLnN0YXRlID0gMDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLnNvdXJjZXMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBjb25zdCBzb3VyY2UgPSBub2RlLnNvdXJjZXNbaV07XG4gICAgaWYgKHNvdXJjZS5zb3VyY2VzKSB7XG4gICAgICBjb25zdCBzdGF0ZSA9IHJ1bm5pbmdUcmFuc2l0aW9uID8gc291cmNlLnRTdGF0ZSA6IHNvdXJjZS5zdGF0ZTtcbiAgICAgIGlmIChzdGF0ZSA9PT0gU1RBTEUpIHtcbiAgICAgICAgaWYgKHNvdXJjZSAhPT0gaWdub3JlICYmICghc291cmNlLnVwZGF0ZWRBdCB8fCBzb3VyY2UudXBkYXRlZEF0IDwgRXhlY0NvdW50KSkgcnVuVG9wKHNvdXJjZSk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBQRU5ESU5HKSBsb29rVXBzdHJlYW0oc291cmNlLCBpZ25vcmUpO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gbWFya0Rvd25zdHJlYW0obm9kZSkge1xuICBjb25zdCBydW5uaW5nVHJhbnNpdGlvbiA9IFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUub2JzZXJ2ZXJzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgY29uc3QgbyA9IG5vZGUub2JzZXJ2ZXJzW2ldO1xuICAgIGlmIChydW5uaW5nVHJhbnNpdGlvbiA/ICFvLnRTdGF0ZSA6ICFvLnN0YXRlKSB7XG4gICAgICBpZiAocnVubmluZ1RyYW5zaXRpb24pIG8udFN0YXRlID0gUEVORElORztlbHNlIG8uc3RhdGUgPSBQRU5ESU5HO1xuICAgICAgaWYgKG8ucHVyZSkgVXBkYXRlcy5wdXNoKG8pO2Vsc2UgRWZmZWN0cy5wdXNoKG8pO1xuICAgICAgby5vYnNlcnZlcnMgJiYgbWFya0Rvd25zdHJlYW0obyk7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBjbGVhbk5vZGUobm9kZSkge1xuICBsZXQgaTtcbiAgaWYgKG5vZGUuc291cmNlcykge1xuICAgIHdoaWxlIChub2RlLnNvdXJjZXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBzb3VyY2UgPSBub2RlLnNvdXJjZXMucG9wKCksXG4gICAgICAgIGluZGV4ID0gbm9kZS5zb3VyY2VTbG90cy5wb3AoKSxcbiAgICAgICAgb2JzID0gc291cmNlLm9ic2VydmVycztcbiAgICAgIGlmIChvYnMgJiYgb2JzLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBuID0gb2JzLnBvcCgpLFxuICAgICAgICAgIHMgPSBzb3VyY2Uub2JzZXJ2ZXJTbG90cy5wb3AoKTtcbiAgICAgICAgaWYgKGluZGV4IDwgb2JzLmxlbmd0aCkge1xuICAgICAgICAgIG4uc291cmNlU2xvdHNbc10gPSBpbmRleDtcbiAgICAgICAgICBvYnNbaW5kZXhdID0gbjtcbiAgICAgICAgICBzb3VyY2Uub2JzZXJ2ZXJTbG90c1tpbmRleF0gPSBzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChub2RlLnRPd25lZCkge1xuICAgIGZvciAoaSA9IG5vZGUudE93bmVkLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBjbGVhbk5vZGUobm9kZS50T3duZWRbaV0pO1xuICAgIGRlbGV0ZSBub2RlLnRPd25lZDtcbiAgfVxuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgbm9kZS5wdXJlKSB7XG4gICAgcmVzZXQobm9kZSwgdHJ1ZSk7XG4gIH0gZWxzZSBpZiAobm9kZS5vd25lZCkge1xuICAgIGZvciAoaSA9IG5vZGUub3duZWQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGNsZWFuTm9kZShub2RlLm93bmVkW2ldKTtcbiAgICBub2RlLm93bmVkID0gbnVsbDtcbiAgfVxuICBpZiAobm9kZS5jbGVhbnVwcykge1xuICAgIGZvciAoaSA9IG5vZGUuY2xlYW51cHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIG5vZGUuY2xlYW51cHNbaV0oKTtcbiAgICBub2RlLmNsZWFudXBzID0gbnVsbDtcbiAgfVxuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIG5vZGUudFN0YXRlID0gMDtlbHNlIG5vZGUuc3RhdGUgPSAwO1xuICBkZWxldGUgbm9kZS5zb3VyY2VNYXA7XG59XG5mdW5jdGlvbiByZXNldChub2RlLCB0b3ApIHtcbiAgaWYgKCF0b3ApIHtcbiAgICBub2RlLnRTdGF0ZSA9IDA7XG4gICAgVHJhbnNpdGlvbi5kaXNwb3NlZC5hZGQobm9kZSk7XG4gIH1cbiAgaWYgKG5vZGUub3duZWQpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUub3duZWQubGVuZ3RoOyBpKyspIHJlc2V0KG5vZGUub3duZWRbaV0pO1xuICB9XG59XG5mdW5jdGlvbiBjYXN0RXJyb3IoZXJyKSB7XG4gIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikgcmV0dXJuIGVycjtcbiAgcmV0dXJuIG5ldyBFcnJvcih0eXBlb2YgZXJyID09PSBcInN0cmluZ1wiID8gZXJyIDogXCJVbmtub3duIGVycm9yXCIsIHtcbiAgICBjYXVzZTogZXJyXG4gIH0pO1xufVxuZnVuY3Rpb24gcnVuRXJyb3JzKGVyciwgZm5zLCBvd25lcikge1xuICB0cnkge1xuICAgIGZvciAoY29uc3QgZiBvZiBmbnMpIGYoZXJyKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGhhbmRsZUVycm9yKGUsIG93bmVyICYmIG93bmVyLm93bmVyIHx8IG51bGwpO1xuICB9XG59XG5mdW5jdGlvbiBoYW5kbGVFcnJvcihlcnIsIG93bmVyID0gT3duZXIpIHtcbiAgY29uc3QgZm5zID0gRVJST1IgJiYgb3duZXIgJiYgb3duZXIuY29udGV4dCAmJiBvd25lci5jb250ZXh0W0VSUk9SXTtcbiAgY29uc3QgZXJyb3IgPSBjYXN0RXJyb3IoZXJyKTtcbiAgaWYgKCFmbnMpIHRocm93IGVycm9yO1xuICBpZiAoRWZmZWN0cykgRWZmZWN0cy5wdXNoKHtcbiAgICBmbigpIHtcbiAgICAgIHJ1bkVycm9ycyhlcnJvciwgZm5zLCBvd25lcik7XG4gICAgfSxcbiAgICBzdGF0ZTogU1RBTEVcbiAgfSk7ZWxzZSBydW5FcnJvcnMoZXJyb3IsIGZucywgb3duZXIpO1xufVxuZnVuY3Rpb24gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKSB7XG4gIGlmICh0eXBlb2YgY2hpbGRyZW4gPT09IFwiZnVuY3Rpb25cIiAmJiAhY2hpbGRyZW4ubGVuZ3RoKSByZXR1cm4gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuKCkpO1xuICBpZiAoQXJyYXkuaXNBcnJheShjaGlsZHJlbikpIHtcbiAgICBjb25zdCByZXN1bHRzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgcmVzdWx0ID0gcmVzb2x2ZUNoaWxkcmVuKGNoaWxkcmVuW2ldKTtcbiAgICAgIEFycmF5LmlzQXJyYXkocmVzdWx0KSA/IHJlc3VsdHMucHVzaC5hcHBseShyZXN1bHRzLCByZXN1bHQpIDogcmVzdWx0cy5wdXNoKHJlc3VsdCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG4gIHJldHVybiBjaGlsZHJlbjtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVByb3ZpZGVyKGlkLCBvcHRpb25zKSB7XG4gIHJldHVybiBmdW5jdGlvbiBwcm92aWRlcihwcm9wcykge1xuICAgIGxldCByZXM7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHJlcyA9IHVudHJhY2soKCkgPT4ge1xuICAgICAgT3duZXIuY29udGV4dCA9IHtcbiAgICAgICAgLi4uT3duZXIuY29udGV4dCxcbiAgICAgICAgW2lkXTogcHJvcHMudmFsdWVcbiAgICAgIH07XG4gICAgICByZXR1cm4gY2hpbGRyZW4oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICAgIH0pLCB1bmRlZmluZWQsIG9wdGlvbnMpO1xuICAgIHJldHVybiByZXM7XG4gIH07XG59XG5mdW5jdGlvbiBvbkVycm9yKGZuKSB7XG4gIEVSUk9SIHx8IChFUlJPUiA9IFN5bWJvbChcImVycm9yXCIpKTtcbiAgaWYgKE93bmVyID09PSBudWxsKSBjb25zb2xlLndhcm4oXCJlcnJvciBoYW5kbGVycyBjcmVhdGVkIG91dHNpZGUgYSBgY3JlYXRlUm9vdGAgb3IgYHJlbmRlcmAgd2lsbCBuZXZlciBiZSBydW5cIik7ZWxzZSBpZiAoT3duZXIuY29udGV4dCA9PT0gbnVsbCB8fCAhT3duZXIuY29udGV4dFtFUlJPUl0pIHtcbiAgICBPd25lci5jb250ZXh0ID0ge1xuICAgICAgLi4uT3duZXIuY29udGV4dCxcbiAgICAgIFtFUlJPUl06IFtmbl1cbiAgICB9O1xuICAgIG11dGF0ZUNvbnRleHQoT3duZXIsIEVSUk9SLCBbZm5dKTtcbiAgfSBlbHNlIE93bmVyLmNvbnRleHRbRVJST1JdLnB1c2goZm4pO1xufVxuZnVuY3Rpb24gbXV0YXRlQ29udGV4dChvLCBrZXksIHZhbHVlKSB7XG4gIGlmIChvLm93bmVkKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvLm93bmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoby5vd25lZFtpXS5jb250ZXh0ID09PSBvLmNvbnRleHQpIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICBpZiAoIW8ub3duZWRbaV0uY29udGV4dCkge1xuICAgICAgICBvLm93bmVkW2ldLmNvbnRleHQgPSBvLmNvbnRleHQ7XG4gICAgICAgIG11dGF0ZUNvbnRleHQoby5vd25lZFtpXSwga2V5LCB2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKCFvLm93bmVkW2ldLmNvbnRleHRba2V5XSkge1xuICAgICAgICBvLm93bmVkW2ldLmNvbnRleHRba2V5XSA9IHZhbHVlO1xuICAgICAgICBtdXRhdGVDb250ZXh0KG8ub3duZWRbaV0sIGtleSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBvYnNlcnZhYmxlKGlucHV0KSB7XG4gIHJldHVybiB7XG4gICAgc3Vic2NyaWJlKG9ic2VydmVyKSB7XG4gICAgICBpZiAoIShvYnNlcnZlciBpbnN0YW5jZW9mIE9iamVjdCkgfHwgb2JzZXJ2ZXIgPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRXhwZWN0ZWQgdGhlIG9ic2VydmVyIHRvIGJlIGFuIG9iamVjdC5cIik7XG4gICAgICB9XG4gICAgICBjb25zdCBoYW5kbGVyID0gdHlwZW9mIG9ic2VydmVyID09PSBcImZ1bmN0aW9uXCIgPyBvYnNlcnZlciA6IG9ic2VydmVyLm5leHQgJiYgb2JzZXJ2ZXIubmV4dC5iaW5kKG9ic2VydmVyKTtcbiAgICAgIGlmICghaGFuZGxlcikge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHVuc3Vic2NyaWJlKCkge31cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRpc3Bvc2UgPSBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgICBjb25zdCB2ID0gaW5wdXQoKTtcbiAgICAgICAgICB1bnRyYWNrKCgpID0+IGhhbmRsZXIodikpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRpc3Bvc2VyO1xuICAgICAgfSk7XG4gICAgICBpZiAoZ2V0T3duZXIoKSkgb25DbGVhbnVwKGRpc3Bvc2UpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKSB7XG4gICAgICAgICAgZGlzcG9zZSgpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0sXG4gICAgW1N5bWJvbC5vYnNlcnZhYmxlIHx8IFwiQEBvYnNlcnZhYmxlXCJdKCkge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gZnJvbShwcm9kdWNlciwgaW5pdGFsVmFsdWUgPSB1bmRlZmluZWQpIHtcbiAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoaW5pdGFsVmFsdWUsIHtcbiAgICBlcXVhbHM6IGZhbHNlXG4gIH0pO1xuICBpZiAoXCJzdWJzY3JpYmVcIiBpbiBwcm9kdWNlcikge1xuICAgIGNvbnN0IHVuc3ViID0gcHJvZHVjZXIuc3Vic2NyaWJlKHYgPT4gc2V0KCgpID0+IHYpKTtcbiAgICBvbkNsZWFudXAoKCkgPT4gXCJ1bnN1YnNjcmliZVwiIGluIHVuc3ViID8gdW5zdWIudW5zdWJzY3JpYmUoKSA6IHVuc3ViKCkpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGNsZWFuID0gcHJvZHVjZXIoc2V0KTtcbiAgICBvbkNsZWFudXAoY2xlYW4pO1xuICB9XG4gIHJldHVybiBzO1xufVxuXG5jb25zdCBGQUxMQkFDSyA9IFN5bWJvbChcImZhbGxiYWNrXCIpO1xuZnVuY3Rpb24gZGlzcG9zZShkKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZC5sZW5ndGg7IGkrKykgZFtpXSgpO1xufVxuZnVuY3Rpb24gbWFwQXJyYXkobGlzdCwgbWFwRm4sIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgaXRlbXMgPSBbXSxcbiAgICBtYXBwZWQgPSBbXSxcbiAgICBkaXNwb3NlcnMgPSBbXSxcbiAgICBsZW4gPSAwLFxuICAgIGluZGV4ZXMgPSBtYXBGbi5sZW5ndGggPiAxID8gW10gOiBudWxsO1xuICBvbkNsZWFudXAoKCkgPT4gZGlzcG9zZShkaXNwb3NlcnMpKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBsZXQgbmV3SXRlbXMgPSBsaXN0KCkgfHwgW10sXG4gICAgICBuZXdMZW4gPSBuZXdJdGVtcy5sZW5ndGgsXG4gICAgICBpLFxuICAgICAgajtcbiAgICBuZXdJdGVtc1skVFJBQ0tdO1xuICAgIHJldHVybiB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGxldCBuZXdJbmRpY2VzLCBuZXdJbmRpY2VzTmV4dCwgdGVtcCwgdGVtcGRpc3Bvc2VycywgdGVtcEluZGV4ZXMsIHN0YXJ0LCBlbmQsIG5ld0VuZCwgaXRlbTtcbiAgICAgIGlmIChuZXdMZW4gPT09IDApIHtcbiAgICAgICAgaWYgKGxlbiAhPT0gMCkge1xuICAgICAgICAgIGRpc3Bvc2UoZGlzcG9zZXJzKTtcbiAgICAgICAgICBkaXNwb3NlcnMgPSBbXTtcbiAgICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICAgIGxlbiA9IDA7XG4gICAgICAgICAgaW5kZXhlcyAmJiAoaW5kZXhlcyA9IFtdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5mYWxsYmFjaykge1xuICAgICAgICAgIGl0ZW1zID0gW0ZBTExCQUNLXTtcbiAgICAgICAgICBtYXBwZWRbMF0gPSBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgICAgIGRpc3Bvc2Vyc1swXSA9IGRpc3Bvc2VyO1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMuZmFsbGJhY2soKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBsZW4gPSAxO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChsZW4gPT09IDApIHtcbiAgICAgICAgbWFwcGVkID0gbmV3IEFycmF5KG5ld0xlbik7XG4gICAgICAgIGZvciAoaiA9IDA7IGogPCBuZXdMZW47IGorKykge1xuICAgICAgICAgIGl0ZW1zW2pdID0gbmV3SXRlbXNbal07XG4gICAgICAgICAgbWFwcGVkW2pdID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICAgIGxlbiA9IG5ld0xlbjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRlbXAgPSBuZXcgQXJyYXkobmV3TGVuKTtcbiAgICAgICAgdGVtcGRpc3Bvc2VycyA9IG5ldyBBcnJheShuZXdMZW4pO1xuICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlcyA9IG5ldyBBcnJheShuZXdMZW4pKTtcbiAgICAgICAgZm9yIChzdGFydCA9IDAsIGVuZCA9IE1hdGgubWluKGxlbiwgbmV3TGVuKTsgc3RhcnQgPCBlbmQgJiYgaXRlbXNbc3RhcnRdID09PSBuZXdJdGVtc1tzdGFydF07IHN0YXJ0KyspO1xuICAgICAgICBmb3IgKGVuZCA9IGxlbiAtIDEsIG5ld0VuZCA9IG5ld0xlbiAtIDE7IGVuZCA+PSBzdGFydCAmJiBuZXdFbmQgPj0gc3RhcnQgJiYgaXRlbXNbZW5kXSA9PT0gbmV3SXRlbXNbbmV3RW5kXTsgZW5kLS0sIG5ld0VuZC0tKSB7XG4gICAgICAgICAgdGVtcFtuZXdFbmRdID0gbWFwcGVkW2VuZF07XG4gICAgICAgICAgdGVtcGRpc3Bvc2Vyc1tuZXdFbmRdID0gZGlzcG9zZXJzW2VuZF07XG4gICAgICAgICAgaW5kZXhlcyAmJiAodGVtcEluZGV4ZXNbbmV3RW5kXSA9IGluZGV4ZXNbZW5kXSk7XG4gICAgICAgIH1cbiAgICAgICAgbmV3SW5kaWNlcyA9IG5ldyBNYXAoKTtcbiAgICAgICAgbmV3SW5kaWNlc05leHQgPSBuZXcgQXJyYXkobmV3RW5kICsgMSk7XG4gICAgICAgIGZvciAoaiA9IG5ld0VuZDsgaiA+PSBzdGFydDsgai0tKSB7XG4gICAgICAgICAgaXRlbSA9IG5ld0l0ZW1zW2pdO1xuICAgICAgICAgIGkgPSBuZXdJbmRpY2VzLmdldChpdGVtKTtcbiAgICAgICAgICBuZXdJbmRpY2VzTmV4dFtqXSA9IGkgPT09IHVuZGVmaW5lZCA/IC0xIDogaTtcbiAgICAgICAgICBuZXdJbmRpY2VzLnNldChpdGVtLCBqKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGkgPSBzdGFydDsgaSA8PSBlbmQ7IGkrKykge1xuICAgICAgICAgIGl0ZW0gPSBpdGVtc1tpXTtcbiAgICAgICAgICBqID0gbmV3SW5kaWNlcy5nZXQoaXRlbSk7XG4gICAgICAgICAgaWYgKGogIT09IHVuZGVmaW5lZCAmJiBqICE9PSAtMSkge1xuICAgICAgICAgICAgdGVtcFtqXSA9IG1hcHBlZFtpXTtcbiAgICAgICAgICAgIHRlbXBkaXNwb3NlcnNbal0gPSBkaXNwb3NlcnNbaV07XG4gICAgICAgICAgICBpbmRleGVzICYmICh0ZW1wSW5kZXhlc1tqXSA9IGluZGV4ZXNbaV0pO1xuICAgICAgICAgICAgaiA9IG5ld0luZGljZXNOZXh0W2pdO1xuICAgICAgICAgICAgbmV3SW5kaWNlcy5zZXQoaXRlbSwgaik7XG4gICAgICAgICAgfSBlbHNlIGRpc3Bvc2Vyc1tpXSgpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaiA9IHN0YXJ0OyBqIDwgbmV3TGVuOyBqKyspIHtcbiAgICAgICAgICBpZiAoaiBpbiB0ZW1wKSB7XG4gICAgICAgICAgICBtYXBwZWRbal0gPSB0ZW1wW2pdO1xuICAgICAgICAgICAgZGlzcG9zZXJzW2pdID0gdGVtcGRpc3Bvc2Vyc1tqXTtcbiAgICAgICAgICAgIGlmIChpbmRleGVzKSB7XG4gICAgICAgICAgICAgIGluZGV4ZXNbal0gPSB0ZW1wSW5kZXhlc1tqXTtcbiAgICAgICAgICAgICAgaW5kZXhlc1tqXShqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgbWFwcGVkW2pdID0gY3JlYXRlUm9vdChtYXBwZXIpO1xuICAgICAgICB9XG4gICAgICAgIG1hcHBlZCA9IG1hcHBlZC5zbGljZSgwLCBsZW4gPSBuZXdMZW4pO1xuICAgICAgICBpdGVtcyA9IG5ld0l0ZW1zLnNsaWNlKDApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1hcHBlZDtcbiAgICB9KTtcbiAgICBmdW5jdGlvbiBtYXBwZXIoZGlzcG9zZXIpIHtcbiAgICAgIGRpc3Bvc2Vyc1tqXSA9IGRpc3Bvc2VyO1xuICAgICAgaWYgKGluZGV4ZXMpIHtcbiAgICAgICAgY29uc3QgW3MsIHNldF0gPSBjcmVhdGVTaWduYWwoaiwge1xuICAgICAgICAgIG5hbWU6IFwiaW5kZXhcIlxuICAgICAgICB9KSA7XG4gICAgICAgIGluZGV4ZXNbal0gPSBzZXQ7XG4gICAgICAgIHJldHVybiBtYXBGbihuZXdJdGVtc1tqXSwgcyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWFwRm4obmV3SXRlbXNbal0pO1xuICAgIH1cbiAgfTtcbn1cbmZ1bmN0aW9uIGluZGV4QXJyYXkobGlzdCwgbWFwRm4sIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgaXRlbXMgPSBbXSxcbiAgICBtYXBwZWQgPSBbXSxcbiAgICBkaXNwb3NlcnMgPSBbXSxcbiAgICBzaWduYWxzID0gW10sXG4gICAgbGVuID0gMCxcbiAgICBpO1xuICBvbkNsZWFudXAoKCkgPT4gZGlzcG9zZShkaXNwb3NlcnMpKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBjb25zdCBuZXdJdGVtcyA9IGxpc3QoKSB8fCBbXSxcbiAgICAgIG5ld0xlbiA9IG5ld0l0ZW1zLmxlbmd0aDtcbiAgICBuZXdJdGVtc1skVFJBQ0tdO1xuICAgIHJldHVybiB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGlmIChuZXdMZW4gPT09IDApIHtcbiAgICAgICAgaWYgKGxlbiAhPT0gMCkge1xuICAgICAgICAgIGRpc3Bvc2UoZGlzcG9zZXJzKTtcbiAgICAgICAgICBkaXNwb3NlcnMgPSBbXTtcbiAgICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICAgIG1hcHBlZCA9IFtdO1xuICAgICAgICAgIGxlbiA9IDA7XG4gICAgICAgICAgc2lnbmFscyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLmZhbGxiYWNrKSB7XG4gICAgICAgICAgaXRlbXMgPSBbRkFMTEJBQ0tdO1xuICAgICAgICAgIG1hcHBlZFswXSA9IGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZXJzWzBdID0gZGlzcG9zZXI7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9ucy5mYWxsYmFjaygpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxlbiA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hcHBlZDtcbiAgICAgIH1cbiAgICAgIGlmIChpdGVtc1swXSA9PT0gRkFMTEJBQ0spIHtcbiAgICAgICAgZGlzcG9zZXJzWzBdKCk7XG4gICAgICAgIGRpc3Bvc2VycyA9IFtdO1xuICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICBtYXBwZWQgPSBbXTtcbiAgICAgICAgbGVuID0gMDtcbiAgICAgIH1cbiAgICAgIGZvciAoaSA9IDA7IGkgPCBuZXdMZW47IGkrKykge1xuICAgICAgICBpZiAoaSA8IGl0ZW1zLmxlbmd0aCAmJiBpdGVtc1tpXSAhPT0gbmV3SXRlbXNbaV0pIHtcbiAgICAgICAgICBzaWduYWxzW2ldKCgpID0+IG5ld0l0ZW1zW2ldKTtcbiAgICAgICAgfSBlbHNlIGlmIChpID49IGl0ZW1zLmxlbmd0aCkge1xuICAgICAgICAgIG1hcHBlZFtpXSA9IGNyZWF0ZVJvb3QobWFwcGVyKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yICg7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBkaXNwb3NlcnNbaV0oKTtcbiAgICAgIH1cbiAgICAgIGxlbiA9IHNpZ25hbHMubGVuZ3RoID0gZGlzcG9zZXJzLmxlbmd0aCA9IG5ld0xlbjtcbiAgICAgIGl0ZW1zID0gbmV3SXRlbXMuc2xpY2UoMCk7XG4gICAgICByZXR1cm4gbWFwcGVkID0gbWFwcGVkLnNsaWNlKDAsIGxlbik7XG4gICAgfSk7XG4gICAgZnVuY3Rpb24gbWFwcGVyKGRpc3Bvc2VyKSB7XG4gICAgICBkaXNwb3NlcnNbaV0gPSBkaXNwb3NlcjtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKG5ld0l0ZW1zW2ldLCB7XG4gICAgICAgIG5hbWU6IFwidmFsdWVcIlxuICAgICAgfSkgO1xuICAgICAgc2lnbmFsc1tpXSA9IHNldDtcbiAgICAgIHJldHVybiBtYXBGbihzLCBpKTtcbiAgICB9XG4gIH07XG59XG5cbmxldCBoeWRyYXRpb25FbmFibGVkID0gZmFsc2U7XG5mdW5jdGlvbiBlbmFibGVIeWRyYXRpb24oKSB7XG4gIGh5ZHJhdGlvbkVuYWJsZWQgPSB0cnVlO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50KENvbXAsIHByb3BzKSB7XG4gIGlmIChoeWRyYXRpb25FbmFibGVkKSB7XG4gICAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0KSB7XG4gICAgICBjb25zdCBjID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChuZXh0SHlkcmF0ZUNvbnRleHQoKSk7XG4gICAgICBjb25zdCByID0gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzIHx8IHt9KSA7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjKTtcbiAgICAgIHJldHVybiByO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZGV2Q29tcG9uZW50KENvbXAsIHByb3BzIHx8IHt9KTtcbn1cbmZ1bmN0aW9uIHRydWVGbigpIHtcbiAgcmV0dXJuIHRydWU7XG59XG5jb25zdCBwcm9wVHJhcHMgPSB7XG4gIGdldChfLCBwcm9wZXJ0eSwgcmVjZWl2ZXIpIHtcbiAgICBpZiAocHJvcGVydHkgPT09ICRQUk9YWSkgcmV0dXJuIHJlY2VpdmVyO1xuICAgIHJldHVybiBfLmdldChwcm9wZXJ0eSk7XG4gIH0sXG4gIGhhcyhfLCBwcm9wZXJ0eSkge1xuICAgIGlmIChwcm9wZXJ0eSA9PT0gJFBST1hZKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gXy5oYXMocHJvcGVydHkpO1xuICB9LFxuICBzZXQ6IHRydWVGbixcbiAgZGVsZXRlUHJvcGVydHk6IHRydWVGbixcbiAgZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKF8sIHByb3BlcnR5KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBnZXQoKSB7XG4gICAgICAgIHJldHVybiBfLmdldChwcm9wZXJ0eSk7XG4gICAgICB9LFxuICAgICAgc2V0OiB0cnVlRm4sXG4gICAgICBkZWxldGVQcm9wZXJ0eTogdHJ1ZUZuXG4gICAgfTtcbiAgfSxcbiAgb3duS2V5cyhfKSB7XG4gICAgcmV0dXJuIF8ua2V5cygpO1xuICB9XG59O1xuZnVuY3Rpb24gcmVzb2x2ZVNvdXJjZShzKSB7XG4gIHJldHVybiAhKHMgPSB0eXBlb2YgcyA9PT0gXCJmdW5jdGlvblwiID8gcygpIDogcykgPyB7fSA6IHM7XG59XG5mdW5jdGlvbiByZXNvbHZlU291cmNlcygpIHtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbmd0aCA9IHRoaXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICBjb25zdCB2ID0gdGhpc1tpXSgpO1xuICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHJldHVybiB2O1xuICB9XG59XG5mdW5jdGlvbiBtZXJnZVByb3BzKC4uLnNvdXJjZXMpIHtcbiAgbGV0IHByb3h5ID0gZmFsc2U7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHMgPSBzb3VyY2VzW2ldO1xuICAgIHByb3h5ID0gcHJveHkgfHwgISFzICYmICRQUk9YWSBpbiBzO1xuICAgIHNvdXJjZXNbaV0gPSB0eXBlb2YgcyA9PT0gXCJmdW5jdGlvblwiID8gKHByb3h5ID0gdHJ1ZSwgY3JlYXRlTWVtbyhzKSkgOiBzO1xuICB9XG4gIGlmIChTVVBQT1JUU19QUk9YWSAmJiBwcm94eSkge1xuICAgIHJldHVybiBuZXcgUHJveHkoe1xuICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgY29uc3QgdiA9IHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSlbcHJvcGVydHldO1xuICAgICAgICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHJldHVybiB2O1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFzKHByb3BlcnR5KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgaWYgKHByb3BlcnR5IGluIHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSkpIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBrZXlzKCkge1xuICAgICAgICBjb25zdCBrZXlzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc291cmNlcy5sZW5ndGg7IGkrKykga2V5cy5wdXNoKC4uLk9iamVjdC5rZXlzKHJlc29sdmVTb3VyY2Uoc291cmNlc1tpXSkpKTtcbiAgICAgICAgcmV0dXJuIFsuLi5uZXcgU2V0KGtleXMpXTtcbiAgICAgIH1cbiAgICB9LCBwcm9wVHJhcHMpO1xuICB9XG4gIGNvbnN0IHNvdXJjZXNNYXAgPSB7fTtcbiAgY29uc3QgZGVmaW5lZCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIGZvciAobGV0IGkgPSBzb3VyY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3Qgc291cmNlID0gc291cmNlc1tpXTtcbiAgICBpZiAoIXNvdXJjZSkgY29udGludWU7XG4gICAgY29uc3Qgc291cmNlS2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHNvdXJjZSk7XG4gICAgZm9yIChsZXQgaSA9IHNvdXJjZUtleXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IGtleSA9IHNvdXJjZUtleXNbaV07XG4gICAgICBpZiAoa2V5ID09PSBcIl9fcHJvdG9fX1wiIHx8IGtleSA9PT0gXCJjb25zdHJ1Y3RvclwiKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHNvdXJjZSwga2V5KTtcbiAgICAgIGlmICghZGVmaW5lZFtrZXldKSB7XG4gICAgICAgIGRlZmluZWRba2V5XSA9IGRlc2MuZ2V0ID8ge1xuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGdldDogcmVzb2x2ZVNvdXJjZXMuYmluZChzb3VyY2VzTWFwW2tleV0gPSBbZGVzYy5nZXQuYmluZChzb3VyY2UpXSlcbiAgICAgICAgfSA6IGRlc2MudmFsdWUgIT09IHVuZGVmaW5lZCA/IGRlc2MgOiB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBzb3VyY2VzID0gc291cmNlc01hcFtrZXldO1xuICAgICAgICBpZiAoc291cmNlcykge1xuICAgICAgICAgIGlmIChkZXNjLmdldCkgc291cmNlcy5wdXNoKGRlc2MuZ2V0LmJpbmQoc291cmNlKSk7ZWxzZSBpZiAoZGVzYy52YWx1ZSAhPT0gdW5kZWZpbmVkKSBzb3VyY2VzLnB1c2goKCkgPT4gZGVzYy52YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY29uc3QgdGFyZ2V0ID0ge307XG4gIGNvbnN0IGRlZmluZWRLZXlzID0gT2JqZWN0LmtleXMoZGVmaW5lZCk7XG4gIGZvciAobGV0IGkgPSBkZWZpbmVkS2V5cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGNvbnN0IGtleSA9IGRlZmluZWRLZXlzW2ldLFxuICAgICAgZGVzYyA9IGRlZmluZWRba2V5XTtcbiAgICBpZiAoZGVzYyAmJiBkZXNjLmdldCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCBkZXNjKTtlbHNlIHRhcmdldFtrZXldID0gZGVzYyA/IGRlc2MudmFsdWUgOiB1bmRlZmluZWQ7XG4gIH1cbiAgcmV0dXJuIHRhcmdldDtcbn1cbmZ1bmN0aW9uIHNwbGl0UHJvcHMocHJvcHMsIC4uLmtleXMpIHtcbiAgaWYgKFNVUFBPUlRTX1BST1hZICYmICRQUk9YWSBpbiBwcm9wcykge1xuICAgIGNvbnN0IGJsb2NrZWQgPSBuZXcgU2V0KGtleXMubGVuZ3RoID4gMSA/IGtleXMuZmxhdCgpIDoga2V5c1swXSk7XG4gICAgY29uc3QgcmVzID0ga2V5cy5tYXAoayA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb3h5KHtcbiAgICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgICAgcmV0dXJuIGsuaW5jbHVkZXMocHJvcGVydHkpID8gcHJvcHNbcHJvcGVydHldIDogdW5kZWZpbmVkO1xuICAgICAgICB9LFxuICAgICAgICBoYXMocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gay5pbmNsdWRlcyhwcm9wZXJ0eSkgJiYgcHJvcGVydHkgaW4gcHJvcHM7XG4gICAgICAgIH0sXG4gICAgICAgIGtleXMoKSB7XG4gICAgICAgICAgcmV0dXJuIGsuZmlsdGVyKHByb3BlcnR5ID0+IHByb3BlcnR5IGluIHByb3BzKTtcbiAgICAgICAgfVxuICAgICAgfSwgcHJvcFRyYXBzKTtcbiAgICB9KTtcbiAgICByZXMucHVzaChuZXcgUHJveHkoe1xuICAgICAgZ2V0KHByb3BlcnR5KSB7XG4gICAgICAgIHJldHVybiBibG9ja2VkLmhhcyhwcm9wZXJ0eSkgPyB1bmRlZmluZWQgOiBwcm9wc1twcm9wZXJ0eV07XG4gICAgICB9LFxuICAgICAgaGFzKHByb3BlcnR5KSB7XG4gICAgICAgIHJldHVybiBibG9ja2VkLmhhcyhwcm9wZXJ0eSkgPyBmYWxzZSA6IHByb3BlcnR5IGluIHByb3BzO1xuICAgICAgfSxcbiAgICAgIGtleXMoKSB7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhwcm9wcykuZmlsdGVyKGsgPT4gIWJsb2NrZWQuaGFzKGspKTtcbiAgICAgIH1cbiAgICB9LCBwcm9wVHJhcHMpKTtcbiAgICByZXR1cm4gcmVzO1xuICB9XG4gIGNvbnN0IG90aGVyT2JqZWN0ID0ge307XG4gIGNvbnN0IG9iamVjdHMgPSBrZXlzLm1hcCgoKSA9PiAoe30pKTtcbiAgZm9yIChjb25zdCBwcm9wTmFtZSBvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhwcm9wcykpIHtcbiAgICBjb25zdCBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwcm9wcywgcHJvcE5hbWUpO1xuICAgIGNvbnN0IGlzRGVmYXVsdERlc2MgPSAhZGVzYy5nZXQgJiYgIWRlc2Muc2V0ICYmIGRlc2MuZW51bWVyYWJsZSAmJiBkZXNjLndyaXRhYmxlICYmIGRlc2MuY29uZmlndXJhYmxlO1xuICAgIGxldCBibG9ja2VkID0gZmFsc2U7XG4gICAgbGV0IG9iamVjdEluZGV4ID0gMDtcbiAgICBmb3IgKGNvbnN0IGsgb2Yga2V5cykge1xuICAgICAgaWYgKGsuaW5jbHVkZXMocHJvcE5hbWUpKSB7XG4gICAgICAgIGJsb2NrZWQgPSB0cnVlO1xuICAgICAgICBpc0RlZmF1bHREZXNjID8gb2JqZWN0c1tvYmplY3RJbmRleF1bcHJvcE5hbWVdID0gZGVzYy52YWx1ZSA6IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmplY3RzW29iamVjdEluZGV4XSwgcHJvcE5hbWUsIGRlc2MpO1xuICAgICAgfVxuICAgICAgKytvYmplY3RJbmRleDtcbiAgICB9XG4gICAgaWYgKCFibG9ja2VkKSB7XG4gICAgICBpc0RlZmF1bHREZXNjID8gb3RoZXJPYmplY3RbcHJvcE5hbWVdID0gZGVzYy52YWx1ZSA6IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvdGhlck9iamVjdCwgcHJvcE5hbWUsIGRlc2MpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gWy4uLm9iamVjdHMsIG90aGVyT2JqZWN0XTtcbn1cbmZ1bmN0aW9uIGxhenkoZm4pIHtcbiAgbGV0IGNvbXA7XG4gIGxldCBwO1xuICBjb25zdCB3cmFwID0gcHJvcHMgPT4ge1xuICAgIGNvbnN0IGN0eCA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICAgIGlmIChjdHgpIHtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKCk7XG4gICAgICBzaGFyZWRDb25maWcuY291bnQgfHwgKHNoYXJlZENvbmZpZy5jb3VudCA9IDApO1xuICAgICAgc2hhcmVkQ29uZmlnLmNvdW50Kys7XG4gICAgICAocCB8fCAocCA9IGZuKCkpKS50aGVuKG1vZCA9PiB7XG4gICAgICAgICFzaGFyZWRDb25maWcuZG9uZSAmJiBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgICBzaGFyZWRDb25maWcuY291bnQtLTtcbiAgICAgICAgc2V0KCgpID0+IG1vZC5kZWZhdWx0KTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgIH0pO1xuICAgICAgY29tcCA9IHM7XG4gICAgfSBlbHNlIGlmICghY29tcCkge1xuICAgICAgY29uc3QgW3NdID0gY3JlYXRlUmVzb3VyY2UoKCkgPT4gKHAgfHwgKHAgPSBmbigpKSkudGhlbihtb2QgPT4gbW9kLmRlZmF1bHQpKTtcbiAgICAgIGNvbXAgPSBzO1xuICAgIH1cbiAgICBsZXQgQ29tcDtcbiAgICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiAoQ29tcCA9IGNvbXAoKSkgPyB1bnRyYWNrKCgpID0+IHtcbiAgICAgIGlmIChJU19ERVYpIE9iamVjdC5hc3NpZ24oQ29tcCwge1xuICAgICAgICBbJERFVkNPTVBdOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIGlmICghY3R4IHx8IHNoYXJlZENvbmZpZy5kb25lKSByZXR1cm4gQ29tcChwcm9wcyk7XG4gICAgICBjb25zdCBjID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICBzZXRIeWRyYXRlQ29udGV4dChjdHgpO1xuICAgICAgY29uc3QgciA9IENvbXAocHJvcHMpO1xuICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoYyk7XG4gICAgICByZXR1cm4gcjtcbiAgICB9KSA6IFwiXCIpO1xuICB9O1xuICB3cmFwLnByZWxvYWQgPSAoKSA9PiBwIHx8ICgocCA9IGZuKCkpLnRoZW4obW9kID0+IGNvbXAgPSAoKSA9PiBtb2QuZGVmYXVsdCksIHApO1xuICByZXR1cm4gd3JhcDtcbn1cbmxldCBjb3VudGVyID0gMDtcbmZ1bmN0aW9uIGNyZWF0ZVVuaXF1ZUlkKCkge1xuICBjb25zdCBjdHggPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgcmV0dXJuIGN0eCA/IHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCkgOiBgY2wtJHtjb3VudGVyKyt9YDtcbn1cblxuY29uc3QgbmFycm93ZWRFcnJvciA9IG5hbWUgPT4gYEF0dGVtcHRpbmcgdG8gYWNjZXNzIGEgc3RhbGUgdmFsdWUgZnJvbSA8JHtuYW1lfT4gdGhhdCBjb3VsZCBwb3NzaWJseSBiZSB1bmRlZmluZWQuIFRoaXMgbWF5IG9jY3VyIGJlY2F1c2UgeW91IGFyZSByZWFkaW5nIHRoZSBhY2Nlc3NvciByZXR1cm5lZCBmcm9tIHRoZSBjb21wb25lbnQgYXQgYSB0aW1lIHdoZXJlIGl0IGhhcyBhbHJlYWR5IGJlZW4gdW5tb3VudGVkLiBXZSByZWNvbW1lbmQgY2xlYW5pbmcgdXAgYW55IHN0YWxlIHRpbWVycyBvciBhc3luYywgb3IgcmVhZGluZyBmcm9tIHRoZSBpbml0aWFsIGNvbmRpdGlvbi5gIDtcbmZ1bmN0aW9uIEZvcihwcm9wcykge1xuICBjb25zdCBmYWxsYmFjayA9IFwiZmFsbGJhY2tcIiBpbiBwcm9wcyAmJiB7XG4gICAgZmFsbGJhY2s6ICgpID0+IHByb3BzLmZhbGxiYWNrXG4gIH07XG4gIHJldHVybiBjcmVhdGVNZW1vKG1hcEFycmF5KCgpID0+IHByb3BzLmVhY2gsIHByb3BzLmNoaWxkcmVuLCBmYWxsYmFjayB8fCB1bmRlZmluZWQpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSkgO1xufVxuZnVuY3Rpb24gSW5kZXgocHJvcHMpIHtcbiAgY29uc3QgZmFsbGJhY2sgPSBcImZhbGxiYWNrXCIgaW4gcHJvcHMgJiYge1xuICAgIGZhbGxiYWNrOiAoKSA9PiBwcm9wcy5mYWxsYmFja1xuICB9O1xuICByZXR1cm4gY3JlYXRlTWVtbyhpbmRleEFycmF5KCgpID0+IHByb3BzLmVhY2gsIHByb3BzLmNoaWxkcmVuLCBmYWxsYmFjayB8fCB1bmRlZmluZWQpLCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSkgO1xufVxuZnVuY3Rpb24gU2hvdyhwcm9wcykge1xuICBjb25zdCBrZXllZCA9IHByb3BzLmtleWVkO1xuICBjb25zdCBjb25kaXRpb25WYWx1ZSA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJvcHMud2hlbiwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJjb25kaXRpb24gdmFsdWVcIlxuICB9ICk7XG4gIGNvbnN0IGNvbmRpdGlvbiA9IGtleWVkID8gY29uZGl0aW9uVmFsdWUgOiBjcmVhdGVNZW1vKGNvbmRpdGlvblZhbHVlLCB1bmRlZmluZWQsIHtcbiAgICBlcXVhbHM6IChhLCBiKSA9PiAhYSA9PT0gIWIsXG4gICAgbmFtZTogXCJjb25kaXRpb25cIlxuICB9ICk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBjID0gY29uZGl0aW9uKCk7XG4gICAgaWYgKGMpIHtcbiAgICAgIGNvbnN0IGNoaWxkID0gcHJvcHMuY2hpbGRyZW47XG4gICAgICBjb25zdCBmbiA9IHR5cGVvZiBjaGlsZCA9PT0gXCJmdW5jdGlvblwiICYmIGNoaWxkLmxlbmd0aCA+IDA7XG4gICAgICByZXR1cm4gZm4gPyB1bnRyYWNrKCgpID0+IGNoaWxkKGtleWVkID8gYyA6ICgpID0+IHtcbiAgICAgICAgaWYgKCF1bnRyYWNrKGNvbmRpdGlvbikpIHRocm93IG5hcnJvd2VkRXJyb3IoXCJTaG93XCIpO1xuICAgICAgICByZXR1cm4gY29uZGl0aW9uVmFsdWUoKTtcbiAgICAgIH0pKSA6IGNoaWxkO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcHMuZmFsbGJhY2s7XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwidmFsdWVcIlxuICB9ICk7XG59XG5mdW5jdGlvbiBTd2l0Y2gocHJvcHMpIHtcbiAgY29uc3QgY2hzID0gY2hpbGRyZW4oKCkgPT4gcHJvcHMuY2hpbGRyZW4pO1xuICBjb25zdCBzd2l0Y2hGdW5jID0gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgY2ggPSBjaHMoKTtcbiAgICBjb25zdCBtcHMgPSBBcnJheS5pc0FycmF5KGNoKSA/IGNoIDogW2NoXTtcbiAgICBsZXQgZnVuYyA9ICgpID0+IHVuZGVmaW5lZDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1wcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaW5kZXggPSBpO1xuICAgICAgY29uc3QgbXAgPSBtcHNbaV07XG4gICAgICBjb25zdCBwcmV2RnVuYyA9IGZ1bmM7XG4gICAgICBjb25zdCBjb25kaXRpb25WYWx1ZSA9IGNyZWF0ZU1lbW8oKCkgPT4gcHJldkZ1bmMoKSA/IHVuZGVmaW5lZCA6IG1wLndoZW4sIHVuZGVmaW5lZCwge1xuICAgICAgICBuYW1lOiBcImNvbmRpdGlvbiB2YWx1ZVwiXG4gICAgICB9ICk7XG4gICAgICBjb25zdCBjb25kaXRpb24gPSBtcC5rZXllZCA/IGNvbmRpdGlvblZhbHVlIDogY3JlYXRlTWVtbyhjb25kaXRpb25WYWx1ZSwgdW5kZWZpbmVkLCB7XG4gICAgICAgIGVxdWFsczogKGEsIGIpID0+ICFhID09PSAhYixcbiAgICAgICAgbmFtZTogXCJjb25kaXRpb25cIlxuICAgICAgfSApO1xuICAgICAgZnVuYyA9ICgpID0+IHByZXZGdW5jKCkgfHwgKGNvbmRpdGlvbigpID8gW2luZGV4LCBjb25kaXRpb25WYWx1ZSwgbXBdIDogdW5kZWZpbmVkKTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmM7XG4gIH0pO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3Qgc2VsID0gc3dpdGNoRnVuYygpKCk7XG4gICAgaWYgKCFzZWwpIHJldHVybiBwcm9wcy5mYWxsYmFjaztcbiAgICBjb25zdCBbaW5kZXgsIGNvbmRpdGlvblZhbHVlLCBtcF0gPSBzZWw7XG4gICAgY29uc3QgY2hpbGQgPSBtcC5jaGlsZHJlbjtcbiAgICBjb25zdCBmbiA9IHR5cGVvZiBjaGlsZCA9PT0gXCJmdW5jdGlvblwiICYmIGNoaWxkLmxlbmd0aCA+IDA7XG4gICAgcmV0dXJuIGZuID8gdW50cmFjaygoKSA9PiBjaGlsZChtcC5rZXllZCA/IGNvbmRpdGlvblZhbHVlKCkgOiAoKSA9PiB7XG4gICAgICBpZiAodW50cmFjayhzd2l0Y2hGdW5jKSgpPy5bMF0gIT09IGluZGV4KSB0aHJvdyBuYXJyb3dlZEVycm9yKFwiTWF0Y2hcIik7XG4gICAgICByZXR1cm4gY29uZGl0aW9uVmFsdWUoKTtcbiAgICB9KSkgOiBjaGlsZDtcbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJldmFsIGNvbmRpdGlvbnNcIlxuICB9ICk7XG59XG5mdW5jdGlvbiBNYXRjaChwcm9wcykge1xuICByZXR1cm4gcHJvcHM7XG59XG5sZXQgRXJyb3JzO1xuZnVuY3Rpb24gcmVzZXRFcnJvckJvdW5kYXJpZXMoKSB7XG4gIEVycm9ycyAmJiBbLi4uRXJyb3JzXS5mb3JFYWNoKGZuID0+IGZuKCkpO1xufVxuZnVuY3Rpb24gRXJyb3JCb3VuZGFyeShwcm9wcykge1xuICBsZXQgZXJyO1xuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgc2hhcmVkQ29uZmlnLmxvYWQpIGVyciA9IHNoYXJlZENvbmZpZy5sb2FkKHNoYXJlZENvbmZpZy5nZXRDb250ZXh0SWQoKSk7XG4gIGNvbnN0IFtlcnJvcmVkLCBzZXRFcnJvcmVkXSA9IGNyZWF0ZVNpZ25hbChlcnIsIHtcbiAgICBuYW1lOiBcImVycm9yZWRcIlxuICB9ICk7XG4gIEVycm9ycyB8fCAoRXJyb3JzID0gbmV3IFNldCgpKTtcbiAgRXJyb3JzLmFkZChzZXRFcnJvcmVkKTtcbiAgb25DbGVhbnVwKCgpID0+IEVycm9ycy5kZWxldGUoc2V0RXJyb3JlZCkpO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgbGV0IGU7XG4gICAgaWYgKGUgPSBlcnJvcmVkKCkpIHtcbiAgICAgIGNvbnN0IGYgPSBwcm9wcy5mYWxsYmFjaztcbiAgICAgIGlmICgodHlwZW9mIGYgIT09IFwiZnVuY3Rpb25cIiB8fCBmLmxlbmd0aCA9PSAwKSkgY29uc29sZS5lcnJvcihlKTtcbiAgICAgIHJldHVybiB0eXBlb2YgZiA9PT0gXCJmdW5jdGlvblwiICYmIGYubGVuZ3RoID8gdW50cmFjaygoKSA9PiBmKGUsICgpID0+IHNldEVycm9yZWQoKSkpIDogZjtcbiAgICB9XG4gICAgcmV0dXJuIGNhdGNoRXJyb3IoKCkgPT4gcHJvcHMuY2hpbGRyZW4sIHNldEVycm9yZWQpO1xuICB9LCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSApO1xufVxuXG5jb25zdCBzdXNwZW5zZUxpc3RFcXVhbHMgPSAoYSwgYikgPT4gYS5zaG93Q29udGVudCA9PT0gYi5zaG93Q29udGVudCAmJiBhLnNob3dGYWxsYmFjayA9PT0gYi5zaG93RmFsbGJhY2s7XG5jb25zdCBTdXNwZW5zZUxpc3RDb250ZXh0ID0gLyogI19fUFVSRV9fICovY3JlYXRlQ29udGV4dCgpO1xuZnVuY3Rpb24gU3VzcGVuc2VMaXN0KHByb3BzKSB7XG4gIGxldCBbd3JhcHBlciwgc2V0V3JhcHBlcl0gPSBjcmVhdGVTaWduYWwoKCkgPT4gKHtcbiAgICAgIGluRmFsbGJhY2s6IGZhbHNlXG4gICAgfSkpLFxuICAgIHNob3c7XG4gIGNvbnN0IGxpc3RDb250ZXh0ID0gdXNlQ29udGV4dChTdXNwZW5zZUxpc3RDb250ZXh0KTtcbiAgY29uc3QgW3JlZ2lzdHJ5LCBzZXRSZWdpc3RyeV0gPSBjcmVhdGVTaWduYWwoW10pO1xuICBpZiAobGlzdENvbnRleHQpIHtcbiAgICBzaG93ID0gbGlzdENvbnRleHQucmVnaXN0ZXIoY3JlYXRlTWVtbygoKSA9PiB3cmFwcGVyKCkoKS5pbkZhbGxiYWNrKSk7XG4gIH1cbiAgY29uc3QgcmVzb2x2ZWQgPSBjcmVhdGVNZW1vKHByZXYgPT4ge1xuICAgIGNvbnN0IHJldmVhbCA9IHByb3BzLnJldmVhbE9yZGVyLFxuICAgICAgdGFpbCA9IHByb3BzLnRhaWwsXG4gICAgICB7XG4gICAgICAgIHNob3dDb250ZW50ID0gdHJ1ZSxcbiAgICAgICAgc2hvd0ZhbGxiYWNrID0gdHJ1ZVxuICAgICAgfSA9IHNob3cgPyBzaG93KCkgOiB7fSxcbiAgICAgIHJlZyA9IHJlZ2lzdHJ5KCksXG4gICAgICByZXZlcnNlID0gcmV2ZWFsID09PSBcImJhY2t3YXJkc1wiO1xuICAgIGlmIChyZXZlYWwgPT09IFwidG9nZXRoZXJcIikge1xuICAgICAgY29uc3QgYWxsID0gcmVnLmV2ZXJ5KGluRmFsbGJhY2sgPT4gIWluRmFsbGJhY2soKSk7XG4gICAgICBjb25zdCByZXMgPSByZWcubWFwKCgpID0+ICh7XG4gICAgICAgIHNob3dDb250ZW50OiBhbGwgJiYgc2hvd0NvbnRlbnQsXG4gICAgICAgIHNob3dGYWxsYmFja1xuICAgICAgfSkpO1xuICAgICAgcmVzLmluRmFsbGJhY2sgPSAhYWxsO1xuICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG4gICAgbGV0IHN0b3AgPSBmYWxzZTtcbiAgICBsZXQgaW5GYWxsYmFjayA9IHByZXYuaW5GYWxsYmFjaztcbiAgICBjb25zdCByZXMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcmVnLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBjb25zdCBuID0gcmV2ZXJzZSA/IGxlbiAtIGkgLSAxIDogaSxcbiAgICAgICAgcyA9IHJlZ1tuXSgpO1xuICAgICAgaWYgKCFzdG9wICYmICFzKSB7XG4gICAgICAgIHJlc1tuXSA9IHtcbiAgICAgICAgICBzaG93Q29udGVudCxcbiAgICAgICAgICBzaG93RmFsbGJhY2tcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5leHQgPSAhc3RvcDtcbiAgICAgICAgaWYgKG5leHQpIGluRmFsbGJhY2sgPSB0cnVlO1xuICAgICAgICByZXNbbl0gPSB7XG4gICAgICAgICAgc2hvd0NvbnRlbnQ6IG5leHQsXG4gICAgICAgICAgc2hvd0ZhbGxiYWNrOiAhdGFpbCB8fCBuZXh0ICYmIHRhaWwgPT09IFwiY29sbGFwc2VkXCIgPyBzaG93RmFsbGJhY2sgOiBmYWxzZVxuICAgICAgICB9O1xuICAgICAgICBzdG9wID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFzdG9wKSBpbkZhbGxiYWNrID0gZmFsc2U7XG4gICAgcmVzLmluRmFsbGJhY2sgPSBpbkZhbGxiYWNrO1xuICAgIHJldHVybiByZXM7XG4gIH0sIHtcbiAgICBpbkZhbGxiYWNrOiBmYWxzZVxuICB9KTtcbiAgc2V0V3JhcHBlcigoKSA9PiByZXNvbHZlZCk7XG4gIHJldHVybiBjcmVhdGVDb21wb25lbnQoU3VzcGVuc2VMaXN0Q29udGV4dC5Qcm92aWRlciwge1xuICAgIHZhbHVlOiB7XG4gICAgICByZWdpc3RlcjogaW5GYWxsYmFjayA9PiB7XG4gICAgICAgIGxldCBpbmRleDtcbiAgICAgICAgc2V0UmVnaXN0cnkocmVnaXN0cnkgPT4ge1xuICAgICAgICAgIGluZGV4ID0gcmVnaXN0cnkubGVuZ3RoO1xuICAgICAgICAgIHJldHVybiBbLi4ucmVnaXN0cnksIGluRmFsbGJhY2tdO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4gcmVzb2x2ZWQoKVtpbmRleF0sIHVuZGVmaW5lZCwge1xuICAgICAgICAgIGVxdWFsczogc3VzcGVuc2VMaXN0RXF1YWxzXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgZ2V0IGNoaWxkcmVuKCkge1xuICAgICAgcmV0dXJuIHByb3BzLmNoaWxkcmVuO1xuICAgIH1cbiAgfSk7XG59XG5mdW5jdGlvbiBTdXNwZW5zZShwcm9wcykge1xuICBsZXQgY291bnRlciA9IDAsXG4gICAgc2hvdyxcbiAgICBjdHgsXG4gICAgcCxcbiAgICBmbGlja2VyLFxuICAgIGVycm9yO1xuICBjb25zdCBbaW5GYWxsYmFjaywgc2V0RmFsbGJhY2tdID0gY3JlYXRlU2lnbmFsKGZhbHNlKSxcbiAgICBTdXNwZW5zZUNvbnRleHQgPSBnZXRTdXNwZW5zZUNvbnRleHQoKSxcbiAgICBzdG9yZSA9IHtcbiAgICAgIGluY3JlbWVudDogKCkgPT4ge1xuICAgICAgICBpZiAoKytjb3VudGVyID09PSAxKSBzZXRGYWxsYmFjayh0cnVlKTtcbiAgICAgIH0sXG4gICAgICBkZWNyZW1lbnQ6ICgpID0+IHtcbiAgICAgICAgaWYgKC0tY291bnRlciA9PT0gMCkgc2V0RmFsbGJhY2soZmFsc2UpO1xuICAgICAgfSxcbiAgICAgIGluRmFsbGJhY2ssXG4gICAgICBlZmZlY3RzOiBbXSxcbiAgICAgIHJlc29sdmVkOiBmYWxzZVxuICAgIH0sXG4gICAgb3duZXIgPSBnZXRPd25lcigpO1xuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgc2hhcmVkQ29uZmlnLmxvYWQpIHtcbiAgICBjb25zdCBrZXkgPSBzaGFyZWRDb25maWcuZ2V0Q29udGV4dElkKCk7XG4gICAgbGV0IHJlZiA9IHNoYXJlZENvbmZpZy5sb2FkKGtleSk7XG4gICAgaWYgKHJlZikge1xuICAgICAgaWYgKHR5cGVvZiByZWYgIT09IFwib2JqZWN0XCIgfHwgcmVmLnMgIT09IDEpIHAgPSByZWY7ZWxzZSBzaGFyZWRDb25maWcuZ2F0aGVyKGtleSk7XG4gICAgfVxuICAgIGlmIChwICYmIHAgIT09IFwiJCRmXCIpIHtcbiAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCwge1xuICAgICAgICBlcXVhbHM6IGZhbHNlXG4gICAgICB9KTtcbiAgICAgIGZsaWNrZXIgPSBzO1xuICAgICAgcC50aGVuKCgpID0+IHtcbiAgICAgICAgaWYgKHNoYXJlZENvbmZpZy5kb25lKSByZXR1cm4gc2V0KCk7XG4gICAgICAgIHNoYXJlZENvbmZpZy5nYXRoZXIoa2V5KTtcbiAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoY3R4KTtcbiAgICAgICAgc2V0KCk7XG4gICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KCk7XG4gICAgICB9LCBlcnIgPT4ge1xuICAgICAgICBlcnJvciA9IGVycjtcbiAgICAgICAgc2V0KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgY29uc3QgbGlzdENvbnRleHQgPSB1c2VDb250ZXh0KFN1c3BlbnNlTGlzdENvbnRleHQpO1xuICBpZiAobGlzdENvbnRleHQpIHNob3cgPSBsaXN0Q29udGV4dC5yZWdpc3RlcihzdG9yZS5pbkZhbGxiYWNrKTtcbiAgbGV0IGRpc3Bvc2U7XG4gIG9uQ2xlYW51cCgoKSA9PiBkaXNwb3NlICYmIGRpc3Bvc2UoKSk7XG4gIHJldHVybiBjcmVhdGVDb21wb25lbnQoU3VzcGVuc2VDb250ZXh0LlByb3ZpZGVyLCB7XG4gICAgdmFsdWU6IHN0b3JlLFxuICAgIGdldCBjaGlsZHJlbigpIHtcbiAgICAgIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtcbiAgICAgICAgY3R4ID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gICAgICAgIGlmIChmbGlja2VyKSB7XG4gICAgICAgICAgZmxpY2tlcigpO1xuICAgICAgICAgIHJldHVybiBmbGlja2VyID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjdHggJiYgcCA9PT0gXCIkJGZcIikgc2V0SHlkcmF0ZUNvbnRleHQoKTtcbiAgICAgICAgY29uc3QgcmVuZGVyZWQgPSBjcmVhdGVNZW1vKCgpID0+IHByb3BzLmNoaWxkcmVuKTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZU1lbW8ocHJldiA9PiB7XG4gICAgICAgICAgY29uc3QgaW5GYWxsYmFjayA9IHN0b3JlLmluRmFsbGJhY2soKSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc2hvd0NvbnRlbnQgPSB0cnVlLFxuICAgICAgICAgICAgICBzaG93RmFsbGJhY2sgPSB0cnVlXG4gICAgICAgICAgICB9ID0gc2hvdyA/IHNob3coKSA6IHt9O1xuICAgICAgICAgIGlmICgoIWluRmFsbGJhY2sgfHwgcCAmJiBwICE9PSBcIiQkZlwiKSAmJiBzaG93Q29udGVudCkge1xuICAgICAgICAgICAgc3RvcmUucmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgZGlzcG9zZSAmJiBkaXNwb3NlKCk7XG4gICAgICAgICAgICBkaXNwb3NlID0gY3R4ID0gcCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VtZUVmZmVjdHMoc3RvcmUuZWZmZWN0cyk7XG4gICAgICAgICAgICByZXR1cm4gcmVuZGVyZWQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFzaG93RmFsbGJhY2spIHJldHVybjtcbiAgICAgICAgICBpZiAoZGlzcG9zZSkgcmV0dXJuIHByZXY7XG4gICAgICAgICAgcmV0dXJuIGNyZWF0ZVJvb3QoZGlzcG9zZXIgPT4ge1xuICAgICAgICAgICAgZGlzcG9zZSA9IGRpc3Bvc2VyO1xuICAgICAgICAgICAgaWYgKGN0eCkge1xuICAgICAgICAgICAgICBzZXRIeWRyYXRlQ29udGV4dCh7XG4gICAgICAgICAgICAgICAgaWQ6IGN0eC5pZCArIFwiRlwiLFxuICAgICAgICAgICAgICAgIGNvdW50OiAwXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBjdHggPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcHJvcHMuZmFsbGJhY2s7XG4gICAgICAgICAgfSwgb3duZXIpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG59XG5cbmNvbnN0IERFViA9IHtcbiAgaG9va3M6IERldkhvb2tzLFxuICB3cml0ZVNpZ25hbCxcbiAgcmVnaXN0ZXJHcmFwaFxufSA7XG5pZiAoZ2xvYmFsVGhpcykge1xuICBpZiAoIWdsb2JhbFRoaXMuU29saWQkJCkgZ2xvYmFsVGhpcy5Tb2xpZCQkID0gdHJ1ZTtlbHNlIGNvbnNvbGUud2FybihcIllvdSBhcHBlYXIgdG8gaGF2ZSBtdWx0aXBsZSBpbnN0YW5jZXMgb2YgU29saWQuIFRoaXMgY2FuIGxlYWQgdG8gdW5leHBlY3RlZCBiZWhhdmlvci5cIik7XG59XG5cbmV4cG9ydCB7ICRERVZDT01QLCAkUFJPWFksICRUUkFDSywgREVWLCBFcnJvckJvdW5kYXJ5LCBGb3IsIEluZGV4LCBNYXRjaCwgU2hvdywgU3VzcGVuc2UsIFN1c3BlbnNlTGlzdCwgU3dpdGNoLCBiYXRjaCwgY2FuY2VsQ2FsbGJhY2ssIGNhdGNoRXJyb3IsIGNoaWxkcmVuLCBjcmVhdGVDb21wb25lbnQsIGNyZWF0ZUNvbXB1dGVkLCBjcmVhdGVDb250ZXh0LCBjcmVhdGVEZWZlcnJlZCwgY3JlYXRlRWZmZWN0LCBjcmVhdGVNZW1vLCBjcmVhdGVSZWFjdGlvbiwgY3JlYXRlUmVuZGVyRWZmZWN0LCBjcmVhdGVSZXNvdXJjZSwgY3JlYXRlUm9vdCwgY3JlYXRlU2VsZWN0b3IsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlVW5pcXVlSWQsIGVuYWJsZUV4dGVybmFsU291cmNlLCBlbmFibGVIeWRyYXRpb24sIGVuYWJsZVNjaGVkdWxpbmcsIGVxdWFsRm4sIGZyb20sIGdldExpc3RlbmVyLCBnZXRPd25lciwgaW5kZXhBcnJheSwgbGF6eSwgbWFwQXJyYXksIG1lcmdlUHJvcHMsIG9ic2VydmFibGUsIG9uLCBvbkNsZWFudXAsIG9uRXJyb3IsIG9uTW91bnQsIHJlcXVlc3RDYWxsYmFjaywgcmVzZXRFcnJvckJvdW5kYXJpZXMsIHJ1bldpdGhPd25lciwgc2hhcmVkQ29uZmlnLCBzcGxpdFByb3BzLCBzdGFydFRyYW5zaXRpb24sIHVudHJhY2ssIHVzZUNvbnRleHQsIHVzZVRyYW5zaXRpb24gfTtcbiIsImltcG9ydCB7IGNyZWF0ZU1lbW8sIGNyZWF0ZVJvb3QsIGNyZWF0ZVJlbmRlckVmZmVjdCwgdW50cmFjaywgc2hhcmVkQ29uZmlnLCBlbmFibGVIeWRyYXRpb24sIGdldE93bmVyLCBjcmVhdGVFZmZlY3QsIHJ1bldpdGhPd25lciwgY3JlYXRlU2lnbmFsLCBvbkNsZWFudXAsICRERVZDT01QLCBzcGxpdFByb3BzIH0gZnJvbSAnc29saWQtanMnO1xuZXhwb3J0IHsgRXJyb3JCb3VuZGFyeSwgRm9yLCBJbmRleCwgTWF0Y2gsIFNob3csIFN1c3BlbnNlLCBTdXNwZW5zZUxpc3QsIFN3aXRjaCwgY3JlYXRlQ29tcG9uZW50LCBjcmVhdGVSZW5kZXJFZmZlY3QgYXMgZWZmZWN0LCBnZXRPd25lciwgbWVyZ2VQcm9wcywgdW50cmFjayB9IGZyb20gJ3NvbGlkLWpzJztcblxuY29uc3QgYm9vbGVhbnMgPSBbXCJhbGxvd2Z1bGxzY3JlZW5cIiwgXCJhc3luY1wiLCBcImF1dG9mb2N1c1wiLCBcImF1dG9wbGF5XCIsIFwiY2hlY2tlZFwiLCBcImNvbnRyb2xzXCIsIFwiZGVmYXVsdFwiLCBcImRpc2FibGVkXCIsIFwiZm9ybW5vdmFsaWRhdGVcIiwgXCJoaWRkZW5cIiwgXCJpbmRldGVybWluYXRlXCIsIFwiaW5lcnRcIiwgXCJpc21hcFwiLCBcImxvb3BcIiwgXCJtdWx0aXBsZVwiLCBcIm11dGVkXCIsIFwibm9tb2R1bGVcIiwgXCJub3ZhbGlkYXRlXCIsIFwib3BlblwiLCBcInBsYXlzaW5saW5lXCIsIFwicmVhZG9ubHlcIiwgXCJyZXF1aXJlZFwiLCBcInJldmVyc2VkXCIsIFwic2VhbWxlc3NcIiwgXCJzZWxlY3RlZFwiXTtcbmNvbnN0IFByb3BlcnRpZXMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJjbGFzc05hbWVcIiwgXCJ2YWx1ZVwiLCBcInJlYWRPbmx5XCIsIFwibm9WYWxpZGF0ZVwiLCBcImZvcm1Ob1ZhbGlkYXRlXCIsIFwiaXNNYXBcIiwgXCJub01vZHVsZVwiLCBcInBsYXlzSW5saW5lXCIsIC4uLmJvb2xlYW5zXSk7XG5jb25zdCBDaGlsZFByb3BlcnRpZXMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJpbm5lckhUTUxcIiwgXCJ0ZXh0Q29udGVudFwiLCBcImlubmVyVGV4dFwiLCBcImNoaWxkcmVuXCJdKTtcbmNvbnN0IEFsaWFzZXMgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmFzc2lnbihPYmplY3QuY3JlYXRlKG51bGwpLCB7XG4gIGNsYXNzTmFtZTogXCJjbGFzc1wiLFxuICBodG1sRm9yOiBcImZvclwiXG59KTtcbmNvbnN0IFByb3BBbGlhc2VzID0gLyojX19QVVJFX18qL09iamVjdC5hc3NpZ24oT2JqZWN0LmNyZWF0ZShudWxsKSwge1xuICBjbGFzczogXCJjbGFzc05hbWVcIixcbiAgbm92YWxpZGF0ZToge1xuICAgICQ6IFwibm9WYWxpZGF0ZVwiLFxuICAgIEZPUk06IDFcbiAgfSxcbiAgZm9ybW5vdmFsaWRhdGU6IHtcbiAgICAkOiBcImZvcm1Ob1ZhbGlkYXRlXCIsXG4gICAgQlVUVE9OOiAxLFxuICAgIElOUFVUOiAxXG4gIH0sXG4gIGlzbWFwOiB7XG4gICAgJDogXCJpc01hcFwiLFxuICAgIElNRzogMVxuICB9LFxuICBub21vZHVsZToge1xuICAgICQ6IFwibm9Nb2R1bGVcIixcbiAgICBTQ1JJUFQ6IDFcbiAgfSxcbiAgcGxheXNpbmxpbmU6IHtcbiAgICAkOiBcInBsYXlzSW5saW5lXCIsXG4gICAgVklERU86IDFcbiAgfSxcbiAgcmVhZG9ubHk6IHtcbiAgICAkOiBcInJlYWRPbmx5XCIsXG4gICAgSU5QVVQ6IDEsXG4gICAgVEVYVEFSRUE6IDFcbiAgfVxufSk7XG5mdW5jdGlvbiBnZXRQcm9wQWxpYXMocHJvcCwgdGFnTmFtZSkge1xuICBjb25zdCBhID0gUHJvcEFsaWFzZXNbcHJvcF07XG4gIHJldHVybiB0eXBlb2YgYSA9PT0gXCJvYmplY3RcIiA/IGFbdGFnTmFtZV0gPyBhW1wiJFwiXSA6IHVuZGVmaW5lZCA6IGE7XG59XG5jb25zdCBEZWxlZ2F0ZWRFdmVudHMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXCJiZWZvcmVpbnB1dFwiLCBcImNsaWNrXCIsIFwiZGJsY2xpY2tcIiwgXCJjb250ZXh0bWVudVwiLCBcImZvY3VzaW5cIiwgXCJmb2N1c291dFwiLCBcImlucHV0XCIsIFwia2V5ZG93blwiLCBcImtleXVwXCIsIFwibW91c2Vkb3duXCIsIFwibW91c2Vtb3ZlXCIsIFwibW91c2VvdXRcIiwgXCJtb3VzZW92ZXJcIiwgXCJtb3VzZXVwXCIsIFwicG9pbnRlcmRvd25cIiwgXCJwb2ludGVybW92ZVwiLCBcInBvaW50ZXJvdXRcIiwgXCJwb2ludGVyb3ZlclwiLCBcInBvaW50ZXJ1cFwiLCBcInRvdWNoZW5kXCIsIFwidG91Y2htb3ZlXCIsIFwidG91Y2hzdGFydFwiXSk7XG5jb25zdCBTVkdFbGVtZW50cyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcblwiYWx0R2x5cGhcIiwgXCJhbHRHbHlwaERlZlwiLCBcImFsdEdseXBoSXRlbVwiLCBcImFuaW1hdGVcIiwgXCJhbmltYXRlQ29sb3JcIiwgXCJhbmltYXRlTW90aW9uXCIsIFwiYW5pbWF0ZVRyYW5zZm9ybVwiLCBcImNpcmNsZVwiLCBcImNsaXBQYXRoXCIsIFwiY29sb3ItcHJvZmlsZVwiLCBcImN1cnNvclwiLCBcImRlZnNcIiwgXCJkZXNjXCIsIFwiZWxsaXBzZVwiLCBcImZlQmxlbmRcIiwgXCJmZUNvbG9yTWF0cml4XCIsIFwiZmVDb21wb25lbnRUcmFuc2ZlclwiLCBcImZlQ29tcG9zaXRlXCIsIFwiZmVDb252b2x2ZU1hdHJpeFwiLCBcImZlRGlmZnVzZUxpZ2h0aW5nXCIsIFwiZmVEaXNwbGFjZW1lbnRNYXBcIiwgXCJmZURpc3RhbnRMaWdodFwiLCBcImZlRHJvcFNoYWRvd1wiLCBcImZlRmxvb2RcIiwgXCJmZUZ1bmNBXCIsIFwiZmVGdW5jQlwiLCBcImZlRnVuY0dcIiwgXCJmZUZ1bmNSXCIsIFwiZmVHYXVzc2lhbkJsdXJcIiwgXCJmZUltYWdlXCIsIFwiZmVNZXJnZVwiLCBcImZlTWVyZ2VOb2RlXCIsIFwiZmVNb3JwaG9sb2d5XCIsIFwiZmVPZmZzZXRcIiwgXCJmZVBvaW50TGlnaHRcIiwgXCJmZVNwZWN1bGFyTGlnaHRpbmdcIiwgXCJmZVNwb3RMaWdodFwiLCBcImZlVGlsZVwiLCBcImZlVHVyYnVsZW5jZVwiLCBcImZpbHRlclwiLCBcImZvbnRcIiwgXCJmb250LWZhY2VcIiwgXCJmb250LWZhY2UtZm9ybWF0XCIsIFwiZm9udC1mYWNlLW5hbWVcIiwgXCJmb250LWZhY2Utc3JjXCIsIFwiZm9udC1mYWNlLXVyaVwiLCBcImZvcmVpZ25PYmplY3RcIiwgXCJnXCIsIFwiZ2x5cGhcIiwgXCJnbHlwaFJlZlwiLCBcImhrZXJuXCIsIFwiaW1hZ2VcIiwgXCJsaW5lXCIsIFwibGluZWFyR3JhZGllbnRcIiwgXCJtYXJrZXJcIiwgXCJtYXNrXCIsIFwibWV0YWRhdGFcIiwgXCJtaXNzaW5nLWdseXBoXCIsIFwibXBhdGhcIiwgXCJwYXRoXCIsIFwicGF0dGVyblwiLCBcInBvbHlnb25cIiwgXCJwb2x5bGluZVwiLCBcInJhZGlhbEdyYWRpZW50XCIsIFwicmVjdFwiLFxuXCJzZXRcIiwgXCJzdG9wXCIsXG5cInN2Z1wiLCBcInN3aXRjaFwiLCBcInN5bWJvbFwiLCBcInRleHRcIiwgXCJ0ZXh0UGF0aFwiLFxuXCJ0cmVmXCIsIFwidHNwYW5cIiwgXCJ1c2VcIiwgXCJ2aWV3XCIsIFwidmtlcm5cIl0pO1xuY29uc3QgU1ZHTmFtZXNwYWNlID0ge1xuICB4bGluazogXCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCIsXG4gIHhtbDogXCJodHRwOi8vd3d3LnczLm9yZy9YTUwvMTk5OC9uYW1lc3BhY2VcIlxufTtcbmNvbnN0IERPTUVsZW1lbnRzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1wiaHRtbFwiLCBcImJhc2VcIiwgXCJoZWFkXCIsIFwibGlua1wiLCBcIm1ldGFcIiwgXCJzdHlsZVwiLCBcInRpdGxlXCIsIFwiYm9keVwiLCBcImFkZHJlc3NcIiwgXCJhcnRpY2xlXCIsIFwiYXNpZGVcIiwgXCJmb290ZXJcIiwgXCJoZWFkZXJcIiwgXCJtYWluXCIsIFwibmF2XCIsIFwic2VjdGlvblwiLCBcImJvZHlcIiwgXCJibG9ja3F1b3RlXCIsIFwiZGRcIiwgXCJkaXZcIiwgXCJkbFwiLCBcImR0XCIsIFwiZmlnY2FwdGlvblwiLCBcImZpZ3VyZVwiLCBcImhyXCIsIFwibGlcIiwgXCJvbFwiLCBcInBcIiwgXCJwcmVcIiwgXCJ1bFwiLCBcImFcIiwgXCJhYmJyXCIsIFwiYlwiLCBcImJkaVwiLCBcImJkb1wiLCBcImJyXCIsIFwiY2l0ZVwiLCBcImNvZGVcIiwgXCJkYXRhXCIsIFwiZGZuXCIsIFwiZW1cIiwgXCJpXCIsIFwia2JkXCIsIFwibWFya1wiLCBcInFcIiwgXCJycFwiLCBcInJ0XCIsIFwicnVieVwiLCBcInNcIiwgXCJzYW1wXCIsIFwic21hbGxcIiwgXCJzcGFuXCIsIFwic3Ryb25nXCIsIFwic3ViXCIsIFwic3VwXCIsIFwidGltZVwiLCBcInVcIiwgXCJ2YXJcIiwgXCJ3YnJcIiwgXCJhcmVhXCIsIFwiYXVkaW9cIiwgXCJpbWdcIiwgXCJtYXBcIiwgXCJ0cmFja1wiLCBcInZpZGVvXCIsIFwiZW1iZWRcIiwgXCJpZnJhbWVcIiwgXCJvYmplY3RcIiwgXCJwYXJhbVwiLCBcInBpY3R1cmVcIiwgXCJwb3J0YWxcIiwgXCJzb3VyY2VcIiwgXCJzdmdcIiwgXCJtYXRoXCIsIFwiY2FudmFzXCIsIFwibm9zY3JpcHRcIiwgXCJzY3JpcHRcIiwgXCJkZWxcIiwgXCJpbnNcIiwgXCJjYXB0aW9uXCIsIFwiY29sXCIsIFwiY29sZ3JvdXBcIiwgXCJ0YWJsZVwiLCBcInRib2R5XCIsIFwidGRcIiwgXCJ0Zm9vdFwiLCBcInRoXCIsIFwidGhlYWRcIiwgXCJ0clwiLCBcImJ1dHRvblwiLCBcImRhdGFsaXN0XCIsIFwiZmllbGRzZXRcIiwgXCJmb3JtXCIsIFwiaW5wdXRcIiwgXCJsYWJlbFwiLCBcImxlZ2VuZFwiLCBcIm1ldGVyXCIsIFwib3B0Z3JvdXBcIiwgXCJvcHRpb25cIiwgXCJvdXRwdXRcIiwgXCJwcm9ncmVzc1wiLCBcInNlbGVjdFwiLCBcInRleHRhcmVhXCIsIFwiZGV0YWlsc1wiLCBcImRpYWxvZ1wiLCBcIm1lbnVcIiwgXCJzdW1tYXJ5XCIsIFwiZGV0YWlsc1wiLCBcInNsb3RcIiwgXCJ0ZW1wbGF0ZVwiLCBcImFjcm9ueW1cIiwgXCJhcHBsZXRcIiwgXCJiYXNlZm9udFwiLCBcImJnc291bmRcIiwgXCJiaWdcIiwgXCJibGlua1wiLCBcImNlbnRlclwiLCBcImNvbnRlbnRcIiwgXCJkaXJcIiwgXCJmb250XCIsIFwiZnJhbWVcIiwgXCJmcmFtZXNldFwiLCBcImhncm91cFwiLCBcImltYWdlXCIsIFwia2V5Z2VuXCIsIFwibWFycXVlZVwiLCBcIm1lbnVpdGVtXCIsIFwibm9iclwiLCBcIm5vZW1iZWRcIiwgXCJub2ZyYW1lc1wiLCBcInBsYWludGV4dFwiLCBcInJiXCIsIFwicnRjXCIsIFwic2hhZG93XCIsIFwic3BhY2VyXCIsIFwic3RyaWtlXCIsIFwidHRcIiwgXCJ4bXBcIiwgXCJhXCIsIFwiYWJiclwiLCBcImFjcm9ueW1cIiwgXCJhZGRyZXNzXCIsIFwiYXBwbGV0XCIsIFwiYXJlYVwiLCBcImFydGljbGVcIiwgXCJhc2lkZVwiLCBcImF1ZGlvXCIsIFwiYlwiLCBcImJhc2VcIiwgXCJiYXNlZm9udFwiLCBcImJkaVwiLCBcImJkb1wiLCBcImJnc291bmRcIiwgXCJiaWdcIiwgXCJibGlua1wiLCBcImJsb2NrcXVvdGVcIiwgXCJib2R5XCIsIFwiYnJcIiwgXCJidXR0b25cIiwgXCJjYW52YXNcIiwgXCJjYXB0aW9uXCIsIFwiY2VudGVyXCIsIFwiY2l0ZVwiLCBcImNvZGVcIiwgXCJjb2xcIiwgXCJjb2xncm91cFwiLCBcImNvbnRlbnRcIiwgXCJkYXRhXCIsIFwiZGF0YWxpc3RcIiwgXCJkZFwiLCBcImRlbFwiLCBcImRldGFpbHNcIiwgXCJkZm5cIiwgXCJkaWFsb2dcIiwgXCJkaXJcIiwgXCJkaXZcIiwgXCJkbFwiLCBcImR0XCIsIFwiZW1cIiwgXCJlbWJlZFwiLCBcImZpZWxkc2V0XCIsIFwiZmlnY2FwdGlvblwiLCBcImZpZ3VyZVwiLCBcImZvbnRcIiwgXCJmb290ZXJcIiwgXCJmb3JtXCIsIFwiZnJhbWVcIiwgXCJmcmFtZXNldFwiLCBcImhlYWRcIiwgXCJoZWFkZXJcIiwgXCJoZ3JvdXBcIiwgXCJoclwiLCBcImh0bWxcIiwgXCJpXCIsIFwiaWZyYW1lXCIsIFwiaW1hZ2VcIiwgXCJpbWdcIiwgXCJpbnB1dFwiLCBcImluc1wiLCBcImtiZFwiLCBcImtleWdlblwiLCBcImxhYmVsXCIsIFwibGVnZW5kXCIsIFwibGlcIiwgXCJsaW5rXCIsIFwibWFpblwiLCBcIm1hcFwiLCBcIm1hcmtcIiwgXCJtYXJxdWVlXCIsIFwibWVudVwiLCBcIm1lbnVpdGVtXCIsIFwibWV0YVwiLCBcIm1ldGVyXCIsIFwibmF2XCIsIFwibm9iclwiLCBcIm5vZW1iZWRcIiwgXCJub2ZyYW1lc1wiLCBcIm5vc2NyaXB0XCIsIFwib2JqZWN0XCIsIFwib2xcIiwgXCJvcHRncm91cFwiLCBcIm9wdGlvblwiLCBcIm91dHB1dFwiLCBcInBcIiwgXCJwYXJhbVwiLCBcInBpY3R1cmVcIiwgXCJwbGFpbnRleHRcIiwgXCJwb3J0YWxcIiwgXCJwcmVcIiwgXCJwcm9ncmVzc1wiLCBcInFcIiwgXCJyYlwiLCBcInJwXCIsIFwicnRcIiwgXCJydGNcIiwgXCJydWJ5XCIsIFwic1wiLCBcInNhbXBcIiwgXCJzY3JpcHRcIiwgXCJzZWN0aW9uXCIsIFwic2VsZWN0XCIsIFwic2hhZG93XCIsIFwic2xvdFwiLCBcInNtYWxsXCIsIFwic291cmNlXCIsIFwic3BhY2VyXCIsIFwic3BhblwiLCBcInN0cmlrZVwiLCBcInN0cm9uZ1wiLCBcInN0eWxlXCIsIFwic3ViXCIsIFwic3VtbWFyeVwiLCBcInN1cFwiLCBcInRhYmxlXCIsIFwidGJvZHlcIiwgXCJ0ZFwiLCBcInRlbXBsYXRlXCIsIFwidGV4dGFyZWFcIiwgXCJ0Zm9vdFwiLCBcInRoXCIsIFwidGhlYWRcIiwgXCJ0aW1lXCIsIFwidGl0bGVcIiwgXCJ0clwiLCBcInRyYWNrXCIsIFwidHRcIiwgXCJ1XCIsIFwidWxcIiwgXCJ2YXJcIiwgXCJ2aWRlb1wiLCBcIndiclwiLCBcInhtcFwiLCBcImlucHV0XCIsIFwiaDFcIiwgXCJoMlwiLCBcImgzXCIsIFwiaDRcIiwgXCJoNVwiLCBcImg2XCJdKTtcblxuY29uc3QgbWVtbyA9IGZuID0+IGNyZWF0ZU1lbW8oKCkgPT4gZm4oKSk7XG5cbmZ1bmN0aW9uIHJlY29uY2lsZUFycmF5cyhwYXJlbnROb2RlLCBhLCBiKSB7XG4gIGxldCBiTGVuZ3RoID0gYi5sZW5ndGgsXG4gICAgYUVuZCA9IGEubGVuZ3RoLFxuICAgIGJFbmQgPSBiTGVuZ3RoLFxuICAgIGFTdGFydCA9IDAsXG4gICAgYlN0YXJ0ID0gMCxcbiAgICBhZnRlciA9IGFbYUVuZCAtIDFdLm5leHRTaWJsaW5nLFxuICAgIG1hcCA9IG51bGw7XG4gIHdoaWxlIChhU3RhcnQgPCBhRW5kIHx8IGJTdGFydCA8IGJFbmQpIHtcbiAgICBpZiAoYVthU3RhcnRdID09PSBiW2JTdGFydF0pIHtcbiAgICAgIGFTdGFydCsrO1xuICAgICAgYlN0YXJ0Kys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgd2hpbGUgKGFbYUVuZCAtIDFdID09PSBiW2JFbmQgLSAxXSkge1xuICAgICAgYUVuZC0tO1xuICAgICAgYkVuZC0tO1xuICAgIH1cbiAgICBpZiAoYUVuZCA9PT0gYVN0YXJ0KSB7XG4gICAgICBjb25zdCBub2RlID0gYkVuZCA8IGJMZW5ndGggPyBiU3RhcnQgPyBiW2JTdGFydCAtIDFdLm5leHRTaWJsaW5nIDogYltiRW5kIC0gYlN0YXJ0XSA6IGFmdGVyO1xuICAgICAgd2hpbGUgKGJTdGFydCA8IGJFbmQpIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBub2RlKTtcbiAgICB9IGVsc2UgaWYgKGJFbmQgPT09IGJTdGFydCkge1xuICAgICAgd2hpbGUgKGFTdGFydCA8IGFFbmQpIHtcbiAgICAgICAgaWYgKCFtYXAgfHwgIW1hcC5oYXMoYVthU3RhcnRdKSkgYVthU3RhcnRdLnJlbW92ZSgpO1xuICAgICAgICBhU3RhcnQrKztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGFbYVN0YXJ0XSA9PT0gYltiRW5kIC0gMV0gJiYgYltiU3RhcnRdID09PSBhW2FFbmQgLSAxXSkge1xuICAgICAgY29uc3Qgbm9kZSA9IGFbLS1hRW5kXS5uZXh0U2libGluZztcbiAgICAgIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBhW2FTdGFydCsrXS5uZXh0U2libGluZyk7XG4gICAgICBwYXJlbnROb2RlLmluc2VydEJlZm9yZShiWy0tYkVuZF0sIG5vZGUpO1xuICAgICAgYVthRW5kXSA9IGJbYkVuZF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghbWFwKSB7XG4gICAgICAgIG1hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgbGV0IGkgPSBiU3RhcnQ7XG4gICAgICAgIHdoaWxlIChpIDwgYkVuZCkgbWFwLnNldChiW2ldLCBpKyspO1xuICAgICAgfVxuICAgICAgY29uc3QgaW5kZXggPSBtYXAuZ2V0KGFbYVN0YXJ0XSk7XG4gICAgICBpZiAoaW5kZXggIT0gbnVsbCkge1xuICAgICAgICBpZiAoYlN0YXJ0IDwgaW5kZXggJiYgaW5kZXggPCBiRW5kKSB7XG4gICAgICAgICAgbGV0IGkgPSBhU3RhcnQsXG4gICAgICAgICAgICBzZXF1ZW5jZSA9IDEsXG4gICAgICAgICAgICB0O1xuICAgICAgICAgIHdoaWxlICgrK2kgPCBhRW5kICYmIGkgPCBiRW5kKSB7XG4gICAgICAgICAgICBpZiAoKHQgPSBtYXAuZ2V0KGFbaV0pKSA9PSBudWxsIHx8IHQgIT09IGluZGV4ICsgc2VxdWVuY2UpIGJyZWFrO1xuICAgICAgICAgICAgc2VxdWVuY2UrKztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNlcXVlbmNlID4gaW5kZXggLSBiU3RhcnQpIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBhW2FTdGFydF07XG4gICAgICAgICAgICB3aGlsZSAoYlN0YXJ0IDwgaW5kZXgpIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJbYlN0YXJ0KytdLCBub2RlKTtcbiAgICAgICAgICB9IGVsc2UgcGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoYltiU3RhcnQrK10sIGFbYVN0YXJ0KytdKTtcbiAgICAgICAgfSBlbHNlIGFTdGFydCsrO1xuICAgICAgfSBlbHNlIGFbYVN0YXJ0KytdLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxufVxuXG5jb25zdCAkJEVWRU5UUyA9IFwiXyREWF9ERUxFR0FURVwiO1xuZnVuY3Rpb24gcmVuZGVyKGNvZGUsIGVsZW1lbnQsIGluaXQsIG9wdGlvbnMgPSB7fSkge1xuICBpZiAoIWVsZW1lbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYGVsZW1lbnRgIHBhc3NlZCB0byBgcmVuZGVyKC4uLiwgZWxlbWVudClgIGRvZXNuJ3QgZXhpc3QuIE1ha2Ugc3VyZSBgZWxlbWVudGAgZXhpc3RzIGluIHRoZSBkb2N1bWVudC5cIik7XG4gIH1cbiAgbGV0IGRpc3Bvc2VyO1xuICBjcmVhdGVSb290KGRpc3Bvc2UgPT4ge1xuICAgIGRpc3Bvc2VyID0gZGlzcG9zZTtcbiAgICBlbGVtZW50ID09PSBkb2N1bWVudCA/IGNvZGUoKSA6IGluc2VydChlbGVtZW50LCBjb2RlKCksIGVsZW1lbnQuZmlyc3RDaGlsZCA/IG51bGwgOiB1bmRlZmluZWQsIGluaXQpO1xuICB9LCBvcHRpb25zLm93bmVyKTtcbiAgcmV0dXJuICgpID0+IHtcbiAgICBkaXNwb3NlcigpO1xuICAgIGVsZW1lbnQudGV4dENvbnRlbnQgPSBcIlwiO1xuICB9O1xufVxuZnVuY3Rpb24gdGVtcGxhdGUoaHRtbCwgaXNJbXBvcnROb2RlLCBpc1NWRywgaXNNYXRoTUwpIHtcbiAgbGV0IG5vZGU7XG4gIGNvbnN0IGNyZWF0ZSA9ICgpID0+IHtcbiAgICBpZiAoaXNIeWRyYXRpbmcoKSkgdGhyb3cgbmV3IEVycm9yKFwiRmFpbGVkIGF0dGVtcHQgdG8gY3JlYXRlIG5ldyBET00gZWxlbWVudHMgZHVyaW5nIGh5ZHJhdGlvbi4gQ2hlY2sgdGhhdCB0aGUgbGlicmFyaWVzIHlvdSBhcmUgdXNpbmcgc3VwcG9ydCBoeWRyYXRpb24uXCIpO1xuICAgIGNvbnN0IHQgPSBpc01hdGhNTCA/IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzE5OTgvTWF0aC9NYXRoTUxcIiwgXCJ0ZW1wbGF0ZVwiKSA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiKTtcbiAgICB0LmlubmVySFRNTCA9IGh0bWw7XG4gICAgcmV0dXJuIGlzU1ZHID8gdC5jb250ZW50LmZpcnN0Q2hpbGQuZmlyc3RDaGlsZCA6IGlzTWF0aE1MID8gdC5maXJzdENoaWxkIDogdC5jb250ZW50LmZpcnN0Q2hpbGQ7XG4gIH07XG4gIGNvbnN0IGZuID0gaXNJbXBvcnROb2RlID8gKCkgPT4gdW50cmFjaygoKSA9PiBkb2N1bWVudC5pbXBvcnROb2RlKG5vZGUgfHwgKG5vZGUgPSBjcmVhdGUoKSksIHRydWUpKSA6ICgpID0+IChub2RlIHx8IChub2RlID0gY3JlYXRlKCkpKS5jbG9uZU5vZGUodHJ1ZSk7XG4gIGZuLmNsb25lTm9kZSA9IGZuO1xuICByZXR1cm4gZm47XG59XG5mdW5jdGlvbiBkZWxlZ2F0ZUV2ZW50cyhldmVudE5hbWVzLCBkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudCkge1xuICBjb25zdCBlID0gZG9jdW1lbnRbJCRFVkVOVFNdIHx8IChkb2N1bWVudFskJEVWRU5UU10gPSBuZXcgU2V0KCkpO1xuICBmb3IgKGxldCBpID0gMCwgbCA9IGV2ZW50TmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgY29uc3QgbmFtZSA9IGV2ZW50TmFtZXNbaV07XG4gICAgaWYgKCFlLmhhcyhuYW1lKSkge1xuICAgICAgZS5hZGQobmFtZSk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50SGFuZGxlcik7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBjbGVhckRlbGVnYXRlZEV2ZW50cyhkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudCkge1xuICBpZiAoZG9jdW1lbnRbJCRFVkVOVFNdKSB7XG4gICAgZm9yIChsZXQgbmFtZSBvZiBkb2N1bWVudFskJEVWRU5UU10ua2V5cygpKSBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50SGFuZGxlcik7XG4gICAgZGVsZXRlIGRvY3VtZW50WyQkRVZFTlRTXTtcbiAgfVxufVxuZnVuY3Rpb24gc2V0UHJvcGVydHkobm9kZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIG5vZGVbbmFtZV0gPSB2YWx1ZTtcbn1cbmZ1bmN0aW9uIHNldEF0dHJpYnV0ZShub2RlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlKG5hbWUpO2Vsc2Ugbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xufVxuZnVuY3Rpb24gc2V0QXR0cmlidXRlTlMobm9kZSwgbmFtZXNwYWNlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIG5vZGUucmVtb3ZlQXR0cmlidXRlTlMobmFtZXNwYWNlLCBuYW1lKTtlbHNlIG5vZGUuc2V0QXR0cmlidXRlTlMobmFtZXNwYWNlLCBuYW1lLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBzZXRCb29sQXR0cmlidXRlKG5vZGUsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICB2YWx1ZSA/IG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsIFwiXCIpIDogbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7XG59XG5mdW5jdGlvbiBjbGFzc05hbWUobm9kZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIGlmICh2YWx1ZSA9PSBudWxsKSBub2RlLnJlbW92ZUF0dHJpYnV0ZShcImNsYXNzXCIpO2Vsc2Ugbm9kZS5jbGFzc05hbWUgPSB2YWx1ZTtcbn1cbmZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXIobm9kZSwgbmFtZSwgaGFuZGxlciwgZGVsZWdhdGUpIHtcbiAgaWYgKGRlbGVnYXRlKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoaGFuZGxlcikpIHtcbiAgICAgIG5vZGVbYCQkJHtuYW1lfWBdID0gaGFuZGxlclswXTtcbiAgICAgIG5vZGVbYCQkJHtuYW1lfURhdGFgXSA9IGhhbmRsZXJbMV07XG4gICAgfSBlbHNlIG5vZGVbYCQkJHtuYW1lfWBdID0gaGFuZGxlcjtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGhhbmRsZXIpKSB7XG4gICAgY29uc3QgaGFuZGxlckZuID0gaGFuZGxlclswXTtcbiAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgaGFuZGxlclswXSA9IGUgPT4gaGFuZGxlckZuLmNhbGwobm9kZSwgaGFuZGxlclsxXSwgZSkpO1xuICB9IGVsc2Ugbm9kZS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGhhbmRsZXIsIHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIgJiYgaGFuZGxlcik7XG59XG5mdW5jdGlvbiBjbGFzc0xpc3Qobm9kZSwgdmFsdWUsIHByZXYgPSB7fSkge1xuICBjb25zdCBjbGFzc0tleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSB8fCB7fSksXG4gICAgcHJldktleXMgPSBPYmplY3Qua2V5cyhwcmV2KTtcbiAgbGV0IGksIGxlbjtcbiAgZm9yIChpID0gMCwgbGVuID0gcHJldktleXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBwcmV2S2V5c1tpXTtcbiAgICBpZiAoIWtleSB8fCBrZXkgPT09IFwidW5kZWZpbmVkXCIgfHwgdmFsdWVba2V5XSkgY29udGludWU7XG4gICAgdG9nZ2xlQ2xhc3NLZXkobm9kZSwga2V5LCBmYWxzZSk7XG4gICAgZGVsZXRlIHByZXZba2V5XTtcbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBjbGFzc0tleXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjb25zdCBrZXkgPSBjbGFzc0tleXNbaV0sXG4gICAgICBjbGFzc1ZhbHVlID0gISF2YWx1ZVtrZXldO1xuICAgIGlmICgha2V5IHx8IGtleSA9PT0gXCJ1bmRlZmluZWRcIiB8fCBwcmV2W2tleV0gPT09IGNsYXNzVmFsdWUgfHwgIWNsYXNzVmFsdWUpIGNvbnRpbnVlO1xuICAgIHRvZ2dsZUNsYXNzS2V5KG5vZGUsIGtleSwgdHJ1ZSk7XG4gICAgcHJldltrZXldID0gY2xhc3NWYWx1ZTtcbiAgfVxuICByZXR1cm4gcHJldjtcbn1cbmZ1bmN0aW9uIHN0eWxlKG5vZGUsIHZhbHVlLCBwcmV2KSB7XG4gIGlmICghdmFsdWUpIHJldHVybiBwcmV2ID8gc2V0QXR0cmlidXRlKG5vZGUsIFwic3R5bGVcIikgOiB2YWx1ZTtcbiAgY29uc3Qgbm9kZVN0eWxlID0gbm9kZS5zdHlsZTtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIG5vZGVTdHlsZS5jc3NUZXh0ID0gdmFsdWU7XG4gIHR5cGVvZiBwcmV2ID09PSBcInN0cmluZ1wiICYmIChub2RlU3R5bGUuY3NzVGV4dCA9IHByZXYgPSB1bmRlZmluZWQpO1xuICBwcmV2IHx8IChwcmV2ID0ge30pO1xuICB2YWx1ZSB8fCAodmFsdWUgPSB7fSk7XG4gIGxldCB2LCBzO1xuICBmb3IgKHMgaW4gcHJldikge1xuICAgIHZhbHVlW3NdID09IG51bGwgJiYgbm9kZVN0eWxlLnJlbW92ZVByb3BlcnR5KHMpO1xuICAgIGRlbGV0ZSBwcmV2W3NdO1xuICB9XG4gIGZvciAocyBpbiB2YWx1ZSkge1xuICAgIHYgPSB2YWx1ZVtzXTtcbiAgICBpZiAodiAhPT0gcHJldltzXSkge1xuICAgICAgbm9kZVN0eWxlLnNldFByb3BlcnR5KHMsIHYpO1xuICAgICAgcHJldltzXSA9IHY7XG4gICAgfVxuICB9XG4gIHJldHVybiBwcmV2O1xufVxuZnVuY3Rpb24gc3ByZWFkKG5vZGUsIHByb3BzID0ge30sIGlzU1ZHLCBza2lwQ2hpbGRyZW4pIHtcbiAgY29uc3QgcHJldlByb3BzID0ge307XG4gIGlmICghc2tpcENoaWxkcmVuKSB7XG4gICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IHByZXZQcm9wcy5jaGlsZHJlbiA9IGluc2VydEV4cHJlc3Npb24obm9kZSwgcHJvcHMuY2hpbGRyZW4sIHByZXZQcm9wcy5jaGlsZHJlbikpO1xuICB9XG4gIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiB0eXBlb2YgcHJvcHMucmVmID09PSBcImZ1bmN0aW9uXCIgJiYgdXNlKHByb3BzLnJlZiwgbm9kZSkpO1xuICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gYXNzaWduKG5vZGUsIHByb3BzLCBpc1NWRywgdHJ1ZSwgcHJldlByb3BzLCB0cnVlKSk7XG4gIHJldHVybiBwcmV2UHJvcHM7XG59XG5mdW5jdGlvbiBkeW5hbWljUHJvcGVydHkocHJvcHMsIGtleSkge1xuICBjb25zdCBzcmMgPSBwcm9wc1trZXldO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvcHMsIGtleSwge1xuICAgIGdldCgpIHtcbiAgICAgIHJldHVybiBzcmMoKTtcbiAgICB9LFxuICAgIGVudW1lcmFibGU6IHRydWVcbiAgfSk7XG4gIHJldHVybiBwcm9wcztcbn1cbmZ1bmN0aW9uIHVzZShmbiwgZWxlbWVudCwgYXJnKSB7XG4gIHJldHVybiB1bnRyYWNrKCgpID0+IGZuKGVsZW1lbnQsIGFyZykpO1xufVxuZnVuY3Rpb24gaW5zZXJ0KHBhcmVudCwgYWNjZXNzb3IsIG1hcmtlciwgaW5pdGlhbCkge1xuICBpZiAobWFya2VyICE9PSB1bmRlZmluZWQgJiYgIWluaXRpYWwpIGluaXRpYWwgPSBbXTtcbiAgaWYgKHR5cGVvZiBhY2Nlc3NvciAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm4gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIGFjY2Vzc29yLCBpbml0aWFsLCBtYXJrZXIpO1xuICBjcmVhdGVSZW5kZXJFZmZlY3QoY3VycmVudCA9PiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgYWNjZXNzb3IoKSwgY3VycmVudCwgbWFya2VyKSwgaW5pdGlhbCk7XG59XG5mdW5jdGlvbiBhc3NpZ24obm9kZSwgcHJvcHMsIGlzU1ZHLCBza2lwQ2hpbGRyZW4sIHByZXZQcm9wcyA9IHt9LCBza2lwUmVmID0gZmFsc2UpIHtcbiAgcHJvcHMgfHwgKHByb3BzID0ge30pO1xuICBmb3IgKGNvbnN0IHByb3AgaW4gcHJldlByb3BzKSB7XG4gICAgaWYgKCEocHJvcCBpbiBwcm9wcykpIHtcbiAgICAgIGlmIChwcm9wID09PSBcImNoaWxkcmVuXCIpIGNvbnRpbnVlO1xuICAgICAgcHJldlByb3BzW3Byb3BdID0gYXNzaWduUHJvcChub2RlLCBwcm9wLCBudWxsLCBwcmV2UHJvcHNbcHJvcF0sIGlzU1ZHLCBza2lwUmVmLCBwcm9wcyk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgcHJvcCBpbiBwcm9wcykge1xuICAgIGlmIChwcm9wID09PSBcImNoaWxkcmVuXCIpIHtcbiAgICAgIGlmICghc2tpcENoaWxkcmVuKSBpbnNlcnRFeHByZXNzaW9uKG5vZGUsIHByb3BzLmNoaWxkcmVuKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZSA9IHByb3BzW3Byb3BdO1xuICAgIHByZXZQcm9wc1twcm9wXSA9IGFzc2lnblByb3Aobm9kZSwgcHJvcCwgdmFsdWUsIHByZXZQcm9wc1twcm9wXSwgaXNTVkcsIHNraXBSZWYsIHByb3BzKTtcbiAgfVxufVxuZnVuY3Rpb24gaHlkcmF0ZSQxKGNvZGUsIGVsZW1lbnQsIG9wdGlvbnMgPSB7fSkge1xuICBpZiAoZ2xvYmFsVGhpcy5fJEhZLmRvbmUpIHJldHVybiByZW5kZXIoY29kZSwgZWxlbWVudCwgWy4uLmVsZW1lbnQuY2hpbGROb2Rlc10sIG9wdGlvbnMpO1xuICBzaGFyZWRDb25maWcuY29tcGxldGVkID0gZ2xvYmFsVGhpcy5fJEhZLmNvbXBsZXRlZDtcbiAgc2hhcmVkQ29uZmlnLmV2ZW50cyA9IGdsb2JhbFRoaXMuXyRIWS5ldmVudHM7XG4gIHNoYXJlZENvbmZpZy5sb2FkID0gaWQgPT4gZ2xvYmFsVGhpcy5fJEhZLnJbaWRdO1xuICBzaGFyZWRDb25maWcuaGFzID0gaWQgPT4gaWQgaW4gZ2xvYmFsVGhpcy5fJEhZLnI7XG4gIHNoYXJlZENvbmZpZy5nYXRoZXIgPSByb290ID0+IGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgcm9vdCk7XG4gIHNoYXJlZENvbmZpZy5yZWdpc3RyeSA9IG5ldyBNYXAoKTtcbiAgc2hhcmVkQ29uZmlnLmNvbnRleHQgPSB7XG4gICAgaWQ6IG9wdGlvbnMucmVuZGVySWQgfHwgXCJcIixcbiAgICBjb3VudDogMFxuICB9O1xuICB0cnkge1xuICAgIGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgb3B0aW9ucy5yZW5kZXJJZCk7XG4gICAgcmV0dXJuIHJlbmRlcihjb2RlLCBlbGVtZW50LCBbLi4uZWxlbWVudC5jaGlsZE5vZGVzXSwgb3B0aW9ucyk7XG4gIH0gZmluYWxseSB7XG4gICAgc2hhcmVkQ29uZmlnLmNvbnRleHQgPSBudWxsO1xuICB9XG59XG5mdW5jdGlvbiBnZXROZXh0RWxlbWVudCh0ZW1wbGF0ZSkge1xuICBsZXQgbm9kZSxcbiAgICBrZXksXG4gICAgaHlkcmF0aW5nID0gaXNIeWRyYXRpbmcoKTtcbiAgaWYgKCFoeWRyYXRpbmcgfHwgIShub2RlID0gc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LmdldChrZXkgPSBnZXRIeWRyYXRpb25LZXkoKSkpKSB7XG4gICAgaWYgKGh5ZHJhdGluZykge1xuICAgICAgc2hhcmVkQ29uZmlnLmRvbmUgPSB0cnVlO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBIeWRyYXRpb24gTWlzbWF0Y2guIFVuYWJsZSB0byBmaW5kIERPTSBub2RlcyBmb3IgaHlkcmF0aW9uIGtleTogJHtrZXl9XFxuJHt0ZW1wbGF0ZSA/IHRlbXBsYXRlKCkub3V0ZXJIVE1MIDogXCJcIn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRlbXBsYXRlKCk7XG4gIH1cbiAgaWYgKHNoYXJlZENvbmZpZy5jb21wbGV0ZWQpIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQuYWRkKG5vZGUpO1xuICBzaGFyZWRDb25maWcucmVnaXN0cnkuZGVsZXRlKGtleSk7XG4gIHJldHVybiBub2RlO1xufVxuZnVuY3Rpb24gZ2V0TmV4dE1hdGNoKGVsLCBub2RlTmFtZSkge1xuICB3aGlsZSAoZWwgJiYgZWwubG9jYWxOYW1lICE9PSBub2RlTmFtZSkgZWwgPSBlbC5uZXh0U2libGluZztcbiAgcmV0dXJuIGVsO1xufVxuZnVuY3Rpb24gZ2V0TmV4dE1hcmtlcihzdGFydCkge1xuICBsZXQgZW5kID0gc3RhcnQsXG4gICAgY291bnQgPSAwLFxuICAgIGN1cnJlbnQgPSBbXTtcbiAgaWYgKGlzSHlkcmF0aW5nKHN0YXJ0KSkge1xuICAgIHdoaWxlIChlbmQpIHtcbiAgICAgIGlmIChlbmQubm9kZVR5cGUgPT09IDgpIHtcbiAgICAgICAgY29uc3QgdiA9IGVuZC5ub2RlVmFsdWU7XG4gICAgICAgIGlmICh2ID09PSBcIiRcIikgY291bnQrKztlbHNlIGlmICh2ID09PSBcIi9cIikge1xuICAgICAgICAgIGlmIChjb3VudCA9PT0gMCkgcmV0dXJuIFtlbmQsIGN1cnJlbnRdO1xuICAgICAgICAgIGNvdW50LS07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGN1cnJlbnQucHVzaChlbmQpO1xuICAgICAgZW5kID0gZW5kLm5leHRTaWJsaW5nO1xuICAgIH1cbiAgfVxuICByZXR1cm4gW2VuZCwgY3VycmVudF07XG59XG5mdW5jdGlvbiBydW5IeWRyYXRpb25FdmVudHMoKSB7XG4gIGlmIChzaGFyZWRDb25maWcuZXZlbnRzICYmICFzaGFyZWRDb25maWcuZXZlbnRzLnF1ZXVlZCkge1xuICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgY29tcGxldGVkLFxuICAgICAgICBldmVudHNcbiAgICAgIH0gPSBzaGFyZWRDb25maWc7XG4gICAgICBpZiAoIWV2ZW50cykgcmV0dXJuO1xuICAgICAgZXZlbnRzLnF1ZXVlZCA9IGZhbHNlO1xuICAgICAgd2hpbGUgKGV2ZW50cy5sZW5ndGgpIHtcbiAgICAgICAgY29uc3QgW2VsLCBlXSA9IGV2ZW50c1swXTtcbiAgICAgICAgaWYgKCFjb21wbGV0ZWQuaGFzKGVsKSkgcmV0dXJuO1xuICAgICAgICBldmVudHMuc2hpZnQoKTtcbiAgICAgICAgZXZlbnRIYW5kbGVyKGUpO1xuICAgICAgfVxuICAgICAgaWYgKHNoYXJlZENvbmZpZy5kb25lKSB7XG4gICAgICAgIHNoYXJlZENvbmZpZy5ldmVudHMgPSBfJEhZLmV2ZW50cyA9IG51bGw7XG4gICAgICAgIHNoYXJlZENvbmZpZy5jb21wbGV0ZWQgPSBfJEhZLmNvbXBsZXRlZCA9IG51bGw7XG4gICAgICB9XG4gICAgfSk7XG4gICAgc2hhcmVkQ29uZmlnLmV2ZW50cy5xdWV1ZWQgPSB0cnVlO1xuICB9XG59XG5mdW5jdGlvbiBpc0h5ZHJhdGluZyhub2RlKSB7XG4gIHJldHVybiAhIXNoYXJlZENvbmZpZy5jb250ZXh0ICYmICFzaGFyZWRDb25maWcuZG9uZSAmJiAoIW5vZGUgfHwgbm9kZS5pc0Nvbm5lY3RlZCk7XG59XG5mdW5jdGlvbiB0b1Byb3BlcnR5TmFtZShuYW1lKSB7XG4gIHJldHVybiBuYW1lLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvLShbYS16XSkvZywgKF8sIHcpID0+IHcudG9VcHBlckNhc2UoKSk7XG59XG5mdW5jdGlvbiB0b2dnbGVDbGFzc0tleShub2RlLCBrZXksIHZhbHVlKSB7XG4gIGNvbnN0IGNsYXNzTmFtZXMgPSBrZXkudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gIGZvciAobGV0IGkgPSAwLCBuYW1lTGVuID0gY2xhc3NOYW1lcy5sZW5ndGg7IGkgPCBuYW1lTGVuOyBpKyspIG5vZGUuY2xhc3NMaXN0LnRvZ2dsZShjbGFzc05hbWVzW2ldLCB2YWx1ZSk7XG59XG5mdW5jdGlvbiBhc3NpZ25Qcm9wKG5vZGUsIHByb3AsIHZhbHVlLCBwcmV2LCBpc1NWRywgc2tpcFJlZiwgcHJvcHMpIHtcbiAgbGV0IGlzQ0UsIGlzUHJvcCwgaXNDaGlsZFByb3AsIHByb3BBbGlhcywgZm9yY2VQcm9wO1xuICBpZiAocHJvcCA9PT0gXCJzdHlsZVwiKSByZXR1cm4gc3R5bGUobm9kZSwgdmFsdWUsIHByZXYpO1xuICBpZiAocHJvcCA9PT0gXCJjbGFzc0xpc3RcIikgcmV0dXJuIGNsYXNzTGlzdChub2RlLCB2YWx1ZSwgcHJldik7XG4gIGlmICh2YWx1ZSA9PT0gcHJldikgcmV0dXJuIHByZXY7XG4gIGlmIChwcm9wID09PSBcInJlZlwiKSB7XG4gICAgaWYgKCFza2lwUmVmKSB2YWx1ZShub2RlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDMpID09PSBcIm9uOlwiKSB7XG4gICAgY29uc3QgZSA9IHByb3Auc2xpY2UoMyk7XG4gICAgcHJldiAmJiBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoZSwgcHJldiwgdHlwZW9mIHByZXYgIT09IFwiZnVuY3Rpb25cIiAmJiBwcmV2KTtcbiAgICB2YWx1ZSAmJiBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZSwgdmFsdWUsIHR5cGVvZiB2YWx1ZSAhPT0gXCJmdW5jdGlvblwiICYmIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDEwKSA9PT0gXCJvbmNhcHR1cmU6XCIpIHtcbiAgICBjb25zdCBlID0gcHJvcC5zbGljZSgxMCk7XG4gICAgcHJldiAmJiBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoZSwgcHJldiwgdHJ1ZSk7XG4gICAgdmFsdWUgJiYgbm9kZS5hZGRFdmVudExpc3RlbmVyKGUsIHZhbHVlLCB0cnVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDIpID09PSBcIm9uXCIpIHtcbiAgICBjb25zdCBuYW1lID0gcHJvcC5zbGljZSgyKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGRlbGVnYXRlID0gRGVsZWdhdGVkRXZlbnRzLmhhcyhuYW1lKTtcbiAgICBpZiAoIWRlbGVnYXRlICYmIHByZXYpIHtcbiAgICAgIGNvbnN0IGggPSBBcnJheS5pc0FycmF5KHByZXYpID8gcHJldlswXSA6IHByZXY7XG4gICAgICBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgaCk7XG4gICAgfVxuICAgIGlmIChkZWxlZ2F0ZSB8fCB2YWx1ZSkge1xuICAgICAgYWRkRXZlbnRMaXN0ZW5lcihub2RlLCBuYW1lLCB2YWx1ZSwgZGVsZWdhdGUpO1xuICAgICAgZGVsZWdhdGUgJiYgZGVsZWdhdGVFdmVudHMoW25hbWVdKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCA1KSA9PT0gXCJhdHRyOlwiKSB7XG4gICAgc2V0QXR0cmlidXRlKG5vZGUsIHByb3Auc2xpY2UoNSksIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChwcm9wLnNsaWNlKDAsIDUpID09PSBcImJvb2w6XCIpIHtcbiAgICBzZXRCb29sQXR0cmlidXRlKG5vZGUsIHByb3Auc2xpY2UoNSksIHZhbHVlKTtcbiAgfSBlbHNlIGlmICgoZm9yY2VQcm9wID0gcHJvcC5zbGljZSgwLCA1KSA9PT0gXCJwcm9wOlwiKSB8fCAoaXNDaGlsZFByb3AgPSBDaGlsZFByb3BlcnRpZXMuaGFzKHByb3ApKSB8fCAhaXNTVkcgJiYgKChwcm9wQWxpYXMgPSBnZXRQcm9wQWxpYXMocHJvcCwgbm9kZS50YWdOYW1lKSkgfHwgKGlzUHJvcCA9IFByb3BlcnRpZXMuaGFzKHByb3ApKSkgfHwgKGlzQ0UgPSBub2RlLm5vZGVOYW1lLmluY2x1ZGVzKFwiLVwiKSB8fCBcImlzXCIgaW4gcHJvcHMpKSB7XG4gICAgaWYgKGZvcmNlUHJvcCkge1xuICAgICAgcHJvcCA9IHByb3Auc2xpY2UoNSk7XG4gICAgICBpc1Byb3AgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybiB2YWx1ZTtcbiAgICBpZiAocHJvcCA9PT0gXCJjbGFzc1wiIHx8IHByb3AgPT09IFwiY2xhc3NOYW1lXCIpIGNsYXNzTmFtZShub2RlLCB2YWx1ZSk7ZWxzZSBpZiAoaXNDRSAmJiAhaXNQcm9wICYmICFpc0NoaWxkUHJvcCkgbm9kZVt0b1Byb3BlcnR5TmFtZShwcm9wKV0gPSB2YWx1ZTtlbHNlIG5vZGVbcHJvcEFsaWFzIHx8IHByb3BdID0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgbnMgPSBpc1NWRyAmJiBwcm9wLmluZGV4T2YoXCI6XCIpID4gLTEgJiYgU1ZHTmFtZXNwYWNlW3Byb3Auc3BsaXQoXCI6XCIpWzBdXTtcbiAgICBpZiAobnMpIHNldEF0dHJpYnV0ZU5TKG5vZGUsIG5zLCBwcm9wLCB2YWx1ZSk7ZWxzZSBzZXRBdHRyaWJ1dGUobm9kZSwgQWxpYXNlc1twcm9wXSB8fCBwcm9wLCB2YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gZXZlbnRIYW5kbGVyKGUpIHtcbiAgaWYgKHNoYXJlZENvbmZpZy5yZWdpc3RyeSAmJiBzaGFyZWRDb25maWcuZXZlbnRzKSB7XG4gICAgaWYgKHNoYXJlZENvbmZpZy5ldmVudHMuZmluZCgoW2VsLCBldl0pID0+IGV2ID09PSBlKSkgcmV0dXJuO1xuICB9XG4gIGxldCBub2RlID0gZS50YXJnZXQ7XG4gIGNvbnN0IGtleSA9IGAkJCR7ZS50eXBlfWA7XG4gIGNvbnN0IG9yaVRhcmdldCA9IGUudGFyZ2V0O1xuICBjb25zdCBvcmlDdXJyZW50VGFyZ2V0ID0gZS5jdXJyZW50VGFyZ2V0O1xuICBjb25zdCByZXRhcmdldCA9IHZhbHVlID0+IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlLCBcInRhcmdldFwiLCB7XG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHZhbHVlXG4gIH0pO1xuICBjb25zdCBoYW5kbGVOb2RlID0gKCkgPT4ge1xuICAgIGNvbnN0IGhhbmRsZXIgPSBub2RlW2tleV07XG4gICAgaWYgKGhhbmRsZXIgJiYgIW5vZGUuZGlzYWJsZWQpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSBub2RlW2Ake2tleX1EYXRhYF07XG4gICAgICBkYXRhICE9PSB1bmRlZmluZWQgPyBoYW5kbGVyLmNhbGwobm9kZSwgZGF0YSwgZSkgOiBoYW5kbGVyLmNhbGwobm9kZSwgZSk7XG4gICAgICBpZiAoZS5jYW5jZWxCdWJibGUpIHJldHVybjtcbiAgICB9XG4gICAgbm9kZS5ob3N0ICYmIHR5cGVvZiBub2RlLmhvc3QgIT09IFwic3RyaW5nXCIgJiYgIW5vZGUuaG9zdC5fJGhvc3QgJiYgbm9kZS5jb250YWlucyhlLnRhcmdldCkgJiYgcmV0YXJnZXQobm9kZS5ob3N0KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbiAgY29uc3Qgd2Fsa1VwVHJlZSA9ICgpID0+IHtcbiAgICB3aGlsZSAoaGFuZGxlTm9kZSgpICYmIChub2RlID0gbm9kZS5fJGhvc3QgfHwgbm9kZS5wYXJlbnROb2RlIHx8IG5vZGUuaG9zdCkpO1xuICB9O1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZSwgXCJjdXJyZW50VGFyZ2V0XCIsIHtcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgZ2V0KCkge1xuICAgICAgcmV0dXJuIG5vZGUgfHwgZG9jdW1lbnQ7XG4gICAgfVxuICB9KTtcbiAgaWYgKHNoYXJlZENvbmZpZy5yZWdpc3RyeSAmJiAhc2hhcmVkQ29uZmlnLmRvbmUpIHNoYXJlZENvbmZpZy5kb25lID0gXyRIWS5kb25lID0gdHJ1ZTtcbiAgaWYgKGUuY29tcG9zZWRQYXRoKSB7XG4gICAgY29uc3QgcGF0aCA9IGUuY29tcG9zZWRQYXRoKCk7XG4gICAgcmV0YXJnZXQocGF0aFswXSk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXRoLmxlbmd0aCAtIDI7IGkrKykge1xuICAgICAgbm9kZSA9IHBhdGhbaV07XG4gICAgICBpZiAoIWhhbmRsZU5vZGUoKSkgYnJlYWs7XG4gICAgICBpZiAobm9kZS5fJGhvc3QpIHtcbiAgICAgICAgbm9kZSA9IG5vZGUuXyRob3N0O1xuICAgICAgICB3YWxrVXBUcmVlKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKG5vZGUucGFyZW50Tm9kZSA9PT0gb3JpQ3VycmVudFRhcmdldCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZWxzZSB3YWxrVXBUcmVlKCk7XG4gIHJldGFyZ2V0KG9yaVRhcmdldCk7XG59XG5mdW5jdGlvbiBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgdmFsdWUsIGN1cnJlbnQsIG1hcmtlciwgdW53cmFwQXJyYXkpIHtcbiAgY29uc3QgaHlkcmF0aW5nID0gaXNIeWRyYXRpbmcocGFyZW50KTtcbiAgaWYgKGh5ZHJhdGluZykge1xuICAgICFjdXJyZW50ICYmIChjdXJyZW50ID0gWy4uLnBhcmVudC5jaGlsZE5vZGVzXSk7XG4gICAgbGV0IGNsZWFuZWQgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGN1cnJlbnQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBjdXJyZW50W2ldO1xuICAgICAgaWYgKG5vZGUubm9kZVR5cGUgPT09IDggJiYgbm9kZS5kYXRhLnNsaWNlKDAsIDIpID09PSBcIiEkXCIpIG5vZGUucmVtb3ZlKCk7ZWxzZSBjbGVhbmVkLnB1c2gobm9kZSk7XG4gICAgfVxuICAgIGN1cnJlbnQgPSBjbGVhbmVkO1xuICB9XG4gIHdoaWxlICh0eXBlb2YgY3VycmVudCA9PT0gXCJmdW5jdGlvblwiKSBjdXJyZW50ID0gY3VycmVudCgpO1xuICBpZiAodmFsdWUgPT09IGN1cnJlbnQpIHJldHVybiBjdXJyZW50O1xuICBjb25zdCB0ID0gdHlwZW9mIHZhbHVlLFxuICAgIG11bHRpID0gbWFya2VyICE9PSB1bmRlZmluZWQ7XG4gIHBhcmVudCA9IG11bHRpICYmIGN1cnJlbnRbMF0gJiYgY3VycmVudFswXS5wYXJlbnROb2RlIHx8IHBhcmVudDtcbiAgaWYgKHQgPT09IFwic3RyaW5nXCIgfHwgdCA9PT0gXCJudW1iZXJcIikge1xuICAgIGlmIChoeWRyYXRpbmcpIHJldHVybiBjdXJyZW50O1xuICAgIGlmICh0ID09PSBcIm51bWJlclwiKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICBpZiAodmFsdWUgPT09IGN1cnJlbnQpIHJldHVybiBjdXJyZW50O1xuICAgIH1cbiAgICBpZiAobXVsdGkpIHtcbiAgICAgIGxldCBub2RlID0gY3VycmVudFswXTtcbiAgICAgIGlmIChub2RlICYmIG5vZGUubm9kZVR5cGUgPT09IDMpIHtcbiAgICAgICAgbm9kZS5kYXRhICE9PSB2YWx1ZSAmJiAobm9kZS5kYXRhID0gdmFsdWUpO1xuICAgICAgfSBlbHNlIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh2YWx1ZSk7XG4gICAgICBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgbm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChjdXJyZW50ICE9PSBcIlwiICYmIHR5cGVvZiBjdXJyZW50ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGN1cnJlbnQgPSBwYXJlbnQuZmlyc3RDaGlsZC5kYXRhID0gdmFsdWU7XG4gICAgICB9IGVsc2UgY3VycmVudCA9IHBhcmVudC50ZXh0Q29udGVudCA9IHZhbHVlO1xuICAgIH1cbiAgfSBlbHNlIGlmICh2YWx1ZSA9PSBudWxsIHx8IHQgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgaWYgKGh5ZHJhdGluZykgcmV0dXJuIGN1cnJlbnQ7XG4gICAgY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIpO1xuICB9IGVsc2UgaWYgKHQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiB7XG4gICAgICBsZXQgdiA9IHZhbHVlKCk7XG4gICAgICB3aGlsZSAodHlwZW9mIHYgPT09IFwiZnVuY3Rpb25cIikgdiA9IHYoKTtcbiAgICAgIGN1cnJlbnQgPSBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgdiwgY3VycmVudCwgbWFya2VyKTtcbiAgICB9KTtcbiAgICByZXR1cm4gKCkgPT4gY3VycmVudDtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIGNvbnN0IGFycmF5ID0gW107XG4gICAgY29uc3QgY3VycmVudEFycmF5ID0gY3VycmVudCAmJiBBcnJheS5pc0FycmF5KGN1cnJlbnQpO1xuICAgIGlmIChub3JtYWxpemVJbmNvbWluZ0FycmF5KGFycmF5LCB2YWx1ZSwgY3VycmVudCwgdW53cmFwQXJyYXkpKSB7XG4gICAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gY3VycmVudCA9IGluc2VydEV4cHJlc3Npb24ocGFyZW50LCBhcnJheSwgY3VycmVudCwgbWFya2VyLCB0cnVlKSk7XG4gICAgICByZXR1cm4gKCkgPT4gY3VycmVudDtcbiAgICB9XG4gICAgaWYgKGh5ZHJhdGluZykge1xuICAgICAgaWYgKCFhcnJheS5sZW5ndGgpIHJldHVybiBjdXJyZW50O1xuICAgICAgaWYgKG1hcmtlciA9PT0gdW5kZWZpbmVkKSByZXR1cm4gY3VycmVudCA9IFsuLi5wYXJlbnQuY2hpbGROb2Rlc107XG4gICAgICBsZXQgbm9kZSA9IGFycmF5WzBdO1xuICAgICAgaWYgKG5vZGUucGFyZW50Tm9kZSAhPT0gcGFyZW50KSByZXR1cm4gY3VycmVudDtcbiAgICAgIGNvbnN0IG5vZGVzID0gW25vZGVdO1xuICAgICAgd2hpbGUgKChub2RlID0gbm9kZS5uZXh0U2libGluZykgIT09IG1hcmtlcikgbm9kZXMucHVzaChub2RlKTtcbiAgICAgIHJldHVybiBjdXJyZW50ID0gbm9kZXM7XG4gICAgfVxuICAgIGlmIChhcnJheS5sZW5ndGggPT09IDApIHtcbiAgICAgIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyKTtcbiAgICAgIGlmIChtdWx0aSkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgfSBlbHNlIGlmIChjdXJyZW50QXJyYXkpIHtcbiAgICAgIGlmIChjdXJyZW50Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBhcHBlbmROb2RlcyhwYXJlbnQsIGFycmF5LCBtYXJrZXIpO1xuICAgICAgfSBlbHNlIHJlY29uY2lsZUFycmF5cyhwYXJlbnQsIGN1cnJlbnQsIGFycmF5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY3VycmVudCAmJiBjbGVhbkNoaWxkcmVuKHBhcmVudCk7XG4gICAgICBhcHBlbmROb2RlcyhwYXJlbnQsIGFycmF5KTtcbiAgICB9XG4gICAgY3VycmVudCA9IGFycmF5O1xuICB9IGVsc2UgaWYgKHZhbHVlLm5vZGVUeXBlKSB7XG4gICAgaWYgKGh5ZHJhdGluZyAmJiB2YWx1ZS5wYXJlbnROb2RlKSByZXR1cm4gY3VycmVudCA9IG11bHRpID8gW3ZhbHVlXSA6IHZhbHVlO1xuICAgIGlmIChBcnJheS5pc0FycmF5KGN1cnJlbnQpKSB7XG4gICAgICBpZiAobXVsdGkpIHJldHVybiBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgdmFsdWUpO1xuICAgICAgY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG51bGwsIHZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnQgPT0gbnVsbCB8fCBjdXJyZW50ID09PSBcIlwiIHx8ICFwYXJlbnQuZmlyc3RDaGlsZCkge1xuICAgICAgcGFyZW50LmFwcGVuZENoaWxkKHZhbHVlKTtcbiAgICB9IGVsc2UgcGFyZW50LnJlcGxhY2VDaGlsZCh2YWx1ZSwgcGFyZW50LmZpcnN0Q2hpbGQpO1xuICAgIGN1cnJlbnQgPSB2YWx1ZTtcbiAgfSBlbHNlIGNvbnNvbGUud2FybihgVW5yZWNvZ25pemVkIHZhbHVlLiBTa2lwcGVkIGluc2VydGluZ2AsIHZhbHVlKTtcbiAgcmV0dXJuIGN1cnJlbnQ7XG59XG5mdW5jdGlvbiBub3JtYWxpemVJbmNvbWluZ0FycmF5KG5vcm1hbGl6ZWQsIGFycmF5LCBjdXJyZW50LCB1bndyYXApIHtcbiAgbGV0IGR5bmFtaWMgPSBmYWxzZTtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgbGV0IGl0ZW0gPSBhcnJheVtpXSxcbiAgICAgIHByZXYgPSBjdXJyZW50ICYmIGN1cnJlbnRbbm9ybWFsaXplZC5sZW5ndGhdLFxuICAgICAgdDtcbiAgICBpZiAoaXRlbSA9PSBudWxsIHx8IGl0ZW0gPT09IHRydWUgfHwgaXRlbSA9PT0gZmFsc2UpIDsgZWxzZSBpZiAoKHQgPSB0eXBlb2YgaXRlbSkgPT09IFwib2JqZWN0XCIgJiYgaXRlbS5ub2RlVHlwZSkge1xuICAgICAgbm9ybWFsaXplZC5wdXNoKGl0ZW0pO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShpdGVtKSkge1xuICAgICAgZHluYW1pYyA9IG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgaXRlbSwgcHJldikgfHwgZHluYW1pYztcbiAgICB9IGVsc2UgaWYgKHQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgaWYgKHVud3JhcCkge1xuICAgICAgICB3aGlsZSAodHlwZW9mIGl0ZW0gPT09IFwiZnVuY3Rpb25cIikgaXRlbSA9IGl0ZW0oKTtcbiAgICAgICAgZHluYW1pYyA9IG5vcm1hbGl6ZUluY29taW5nQXJyYXkobm9ybWFsaXplZCwgQXJyYXkuaXNBcnJheShpdGVtKSA/IGl0ZW0gOiBbaXRlbV0sIEFycmF5LmlzQXJyYXkocHJldikgPyBwcmV2IDogW3ByZXZdKSB8fCBkeW5hbWljO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9ybWFsaXplZC5wdXNoKGl0ZW0pO1xuICAgICAgICBkeW5hbWljID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdmFsdWUgPSBTdHJpbmcoaXRlbSk7XG4gICAgICBpZiAocHJldiAmJiBwcmV2Lm5vZGVUeXBlID09PSAzICYmIHByZXYuZGF0YSA9PT0gdmFsdWUpIG5vcm1hbGl6ZWQucHVzaChwcmV2KTtlbHNlIG5vcm1hbGl6ZWQucHVzaChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh2YWx1ZSkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZHluYW1pYztcbn1cbmZ1bmN0aW9uIGFwcGVuZE5vZGVzKHBhcmVudCwgYXJyYXksIG1hcmtlciA9IG51bGwpIHtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSBwYXJlbnQuaW5zZXJ0QmVmb3JlKGFycmF5W2ldLCBtYXJrZXIpO1xufVxuZnVuY3Rpb24gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlciwgcmVwbGFjZW1lbnQpIHtcbiAgaWYgKG1hcmtlciA9PT0gdW5kZWZpbmVkKSByZXR1cm4gcGFyZW50LnRleHRDb250ZW50ID0gXCJcIjtcbiAgY29uc3Qgbm9kZSA9IHJlcGxhY2VtZW50IHx8IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXCIpO1xuICBpZiAoY3VycmVudC5sZW5ndGgpIHtcbiAgICBsZXQgaW5zZXJ0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gY3VycmVudC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgZWwgPSBjdXJyZW50W2ldO1xuICAgICAgaWYgKG5vZGUgIT09IGVsKSB7XG4gICAgICAgIGNvbnN0IGlzUGFyZW50ID0gZWwucGFyZW50Tm9kZSA9PT0gcGFyZW50O1xuICAgICAgICBpZiAoIWluc2VydGVkICYmICFpKSBpc1BhcmVudCA/IHBhcmVudC5yZXBsYWNlQ2hpbGQobm9kZSwgZWwpIDogcGFyZW50Lmluc2VydEJlZm9yZShub2RlLCBtYXJrZXIpO2Vsc2UgaXNQYXJlbnQgJiYgZWwucmVtb3ZlKCk7XG4gICAgICB9IGVsc2UgaW5zZXJ0ZWQgPSB0cnVlO1xuICAgIH1cbiAgfSBlbHNlIHBhcmVudC5pbnNlcnRCZWZvcmUobm9kZSwgbWFya2VyKTtcbiAgcmV0dXJuIFtub2RlXTtcbn1cbmZ1bmN0aW9uIGdhdGhlckh5ZHJhdGFibGUoZWxlbWVudCwgcm9vdCkge1xuICBjb25zdCB0ZW1wbGF0ZXMgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoYCpbZGF0YS1oa11gKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wbGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBub2RlID0gdGVtcGxhdGVzW2ldO1xuICAgIGNvbnN0IGtleSA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiZGF0YS1oa1wiKTtcbiAgICBpZiAoKCFyb290IHx8IGtleS5zdGFydHNXaXRoKHJvb3QpKSAmJiAhc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LmhhcyhrZXkpKSBzaGFyZWRDb25maWcucmVnaXN0cnkuc2V0KGtleSwgbm9kZSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGdldEh5ZHJhdGlvbktleSgpIHtcbiAgcmV0dXJuIHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCk7XG59XG5mdW5jdGlvbiBOb0h5ZHJhdGlvbihwcm9wcykge1xuICByZXR1cm4gc2hhcmVkQ29uZmlnLmNvbnRleHQgPyB1bmRlZmluZWQgOiBwcm9wcy5jaGlsZHJlbjtcbn1cbmZ1bmN0aW9uIEh5ZHJhdGlvbihwcm9wcykge1xuICByZXR1cm4gcHJvcHMuY2hpbGRyZW47XG59XG5jb25zdCB2b2lkRm4gPSAoKSA9PiB1bmRlZmluZWQ7XG5jb25zdCBSZXF1ZXN0Q29udGV4dCA9IFN5bWJvbCgpO1xuZnVuY3Rpb24gaW5uZXJIVE1MKHBhcmVudCwgY29udGVudCkge1xuICAhc2hhcmVkQ29uZmlnLmNvbnRleHQgJiYgKHBhcmVudC5pbm5lckhUTUwgPSBjb250ZW50KTtcbn1cblxuZnVuY3Rpb24gdGhyb3dJbkJyb3dzZXIoZnVuYykge1xuICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYCR7ZnVuYy5uYW1lfSBpcyBub3Qgc3VwcG9ydGVkIGluIHRoZSBicm93c2VyLCByZXR1cm5pbmcgdW5kZWZpbmVkYCk7XG4gIGNvbnNvbGUuZXJyb3IoZXJyKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyaW5nKGZuLCBvcHRpb25zKSB7XG4gIHRocm93SW5Ccm93c2VyKHJlbmRlclRvU3RyaW5nKTtcbn1cbmZ1bmN0aW9uIHJlbmRlclRvU3RyaW5nQXN5bmMoZm4sIG9wdGlvbnMpIHtcbiAgdGhyb3dJbkJyb3dzZXIocmVuZGVyVG9TdHJpbmdBc3luYyk7XG59XG5mdW5jdGlvbiByZW5kZXJUb1N0cmVhbShmbiwgb3B0aW9ucykge1xuICB0aHJvd0luQnJvd3NlcihyZW5kZXJUb1N0cmVhbSk7XG59XG5mdW5jdGlvbiBzc3IodGVtcGxhdGUsIC4uLm5vZGVzKSB7fVxuZnVuY3Rpb24gc3NyRWxlbWVudChuYW1lLCBwcm9wcywgY2hpbGRyZW4sIG5lZWRzSWQpIHt9XG5mdW5jdGlvbiBzc3JDbGFzc0xpc3QodmFsdWUpIHt9XG5mdW5jdGlvbiBzc3JTdHlsZSh2YWx1ZSkge31cbmZ1bmN0aW9uIHNzckF0dHJpYnV0ZShrZXksIHZhbHVlKSB7fVxuZnVuY3Rpb24gc3NySHlkcmF0aW9uS2V5KCkge31cbmZ1bmN0aW9uIHJlc29sdmVTU1JOb2RlKG5vZGUpIHt9XG5mdW5jdGlvbiBlc2NhcGUoaHRtbCkge31cbmZ1bmN0aW9uIHNzclNwcmVhZChwcm9wcywgaXNTVkcsIHNraXBDaGlsZHJlbikge31cblxuY29uc3QgaXNTZXJ2ZXIgPSBmYWxzZTtcbmNvbnN0IGlzRGV2ID0gdHJ1ZTtcbmNvbnN0IFNWR19OQU1FU1BBQ0UgPSBcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI7XG5mdW5jdGlvbiBjcmVhdGVFbGVtZW50KHRhZ05hbWUsIGlzU1ZHID0gZmFsc2UpIHtcbiAgcmV0dXJuIGlzU1ZHID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR19OQU1FU1BBQ0UsIHRhZ05hbWUpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbn1cbmNvbnN0IGh5ZHJhdGUgPSAoLi4uYXJncykgPT4ge1xuICBlbmFibGVIeWRyYXRpb24oKTtcbiAgcmV0dXJuIGh5ZHJhdGUkMSguLi5hcmdzKTtcbn07XG5mdW5jdGlvbiBQb3J0YWwocHJvcHMpIHtcbiAgY29uc3Qge1xuICAgICAgdXNlU2hhZG93XG4gICAgfSA9IHByb3BzLFxuICAgIG1hcmtlciA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXCIpLFxuICAgIG1vdW50ID0gKCkgPT4gcHJvcHMubW91bnQgfHwgZG9jdW1lbnQuYm9keSxcbiAgICBvd25lciA9IGdldE93bmVyKCk7XG4gIGxldCBjb250ZW50O1xuICBsZXQgaHlkcmF0aW5nID0gISFzaGFyZWRDb25maWcuY29udGV4dDtcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoaHlkcmF0aW5nKSBnZXRPd25lcigpLnVzZXIgPSBoeWRyYXRpbmcgPSBmYWxzZTtcbiAgICBjb250ZW50IHx8IChjb250ZW50ID0gcnVuV2l0aE93bmVyKG93bmVyLCAoKSA9PiBjcmVhdGVNZW1vKCgpID0+IHByb3BzLmNoaWxkcmVuKSkpO1xuICAgIGNvbnN0IGVsID0gbW91bnQoKTtcbiAgICBpZiAoZWwgaW5zdGFuY2VvZiBIVE1MSGVhZEVsZW1lbnQpIHtcbiAgICAgIGNvbnN0IFtjbGVhbiwgc2V0Q2xlYW5dID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgICAgIGNvbnN0IGNsZWFudXAgPSAoKSA9PiBzZXRDbGVhbih0cnVlKTtcbiAgICAgIGNyZWF0ZVJvb3QoZGlzcG9zZSA9PiBpbnNlcnQoZWwsICgpID0+ICFjbGVhbigpID8gY29udGVudCgpIDogZGlzcG9zZSgpLCBudWxsKSk7XG4gICAgICBvbkNsZWFudXAoY2xlYW51cCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGNyZWF0ZUVsZW1lbnQocHJvcHMuaXNTVkcgPyBcImdcIiA6IFwiZGl2XCIsIHByb3BzLmlzU1ZHKSxcbiAgICAgICAgcmVuZGVyUm9vdCA9IHVzZVNoYWRvdyAmJiBjb250YWluZXIuYXR0YWNoU2hhZG93ID8gY29udGFpbmVyLmF0dGFjaFNoYWRvdyh7XG4gICAgICAgICAgbW9kZTogXCJvcGVuXCJcbiAgICAgICAgfSkgOiBjb250YWluZXI7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29udGFpbmVyLCBcIl8kaG9zdFwiLCB7XG4gICAgICAgIGdldCgpIHtcbiAgICAgICAgICByZXR1cm4gbWFya2VyLnBhcmVudE5vZGU7XG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gICAgICBpbnNlcnQocmVuZGVyUm9vdCwgY29udGVudCk7XG4gICAgICBlbC5hcHBlbmRDaGlsZChjb250YWluZXIpO1xuICAgICAgcHJvcHMucmVmICYmIHByb3BzLnJlZihjb250YWluZXIpO1xuICAgICAgb25DbGVhbnVwKCgpID0+IGVsLnJlbW92ZUNoaWxkKGNvbnRhaW5lcikpO1xuICAgIH1cbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgcmVuZGVyOiAhaHlkcmF0aW5nXG4gIH0pO1xuICByZXR1cm4gbWFya2VyO1xufVxuZnVuY3Rpb24gY3JlYXRlRHluYW1pYyhjb21wb25lbnQsIHByb3BzKSB7XG4gIGNvbnN0IGNhY2hlZCA9IGNyZWF0ZU1lbW8oY29tcG9uZW50KTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IGNhY2hlZCgpO1xuICAgIHN3aXRjaCAodHlwZW9mIGNvbXBvbmVudCkge1xuICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgICAgIE9iamVjdC5hc3NpZ24oY29tcG9uZW50LCB7XG4gICAgICAgICAgWyRERVZDT01QXTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHVudHJhY2soKCkgPT4gY29tcG9uZW50KHByb3BzKSk7XG4gICAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICAgIGNvbnN0IGlzU3ZnID0gU1ZHRWxlbWVudHMuaGFzKGNvbXBvbmVudCk7XG4gICAgICAgIGNvbnN0IGVsID0gc2hhcmVkQ29uZmlnLmNvbnRleHQgPyBnZXROZXh0RWxlbWVudCgpIDogY3JlYXRlRWxlbWVudChjb21wb25lbnQsIGlzU3ZnKTtcbiAgICAgICAgc3ByZWFkKGVsLCBwcm9wcywgaXNTdmcpO1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgfVxuICB9KTtcbn1cbmZ1bmN0aW9uIER5bmFtaWMocHJvcHMpIHtcbiAgY29uc3QgWywgb3RoZXJzXSA9IHNwbGl0UHJvcHMocHJvcHMsIFtcImNvbXBvbmVudFwiXSk7XG4gIHJldHVybiBjcmVhdGVEeW5hbWljKCgpID0+IHByb3BzLmNvbXBvbmVudCwgb3RoZXJzKTtcbn1cblxuZXhwb3J0IHsgQWxpYXNlcywgdm9pZEZuIGFzIEFzc2V0cywgQ2hpbGRQcm9wZXJ0aWVzLCBET01FbGVtZW50cywgRGVsZWdhdGVkRXZlbnRzLCBEeW5hbWljLCBIeWRyYXRpb24sIHZvaWRGbiBhcyBIeWRyYXRpb25TY3JpcHQsIE5vSHlkcmF0aW9uLCBQb3J0YWwsIFByb3BlcnRpZXMsIFJlcXVlc3RDb250ZXh0LCBTVkdFbGVtZW50cywgU1ZHTmFtZXNwYWNlLCBhZGRFdmVudExpc3RlbmVyLCBhc3NpZ24sIGNsYXNzTGlzdCwgY2xhc3NOYW1lLCBjbGVhckRlbGVnYXRlZEV2ZW50cywgY3JlYXRlRHluYW1pYywgZGVsZWdhdGVFdmVudHMsIGR5bmFtaWNQcm9wZXJ0eSwgZXNjYXBlLCB2b2lkRm4gYXMgZ2VuZXJhdGVIeWRyYXRpb25TY3JpcHQsIHZvaWRGbiBhcyBnZXRBc3NldHMsIGdldEh5ZHJhdGlvbktleSwgZ2V0TmV4dEVsZW1lbnQsIGdldE5leHRNYXJrZXIsIGdldE5leHRNYXRjaCwgZ2V0UHJvcEFsaWFzLCB2b2lkRm4gYXMgZ2V0UmVxdWVzdEV2ZW50LCBoeWRyYXRlLCBpbm5lckhUTUwsIGluc2VydCwgaXNEZXYsIGlzU2VydmVyLCBtZW1vLCByZW5kZXIsIHJlbmRlclRvU3RyZWFtLCByZW5kZXJUb1N0cmluZywgcmVuZGVyVG9TdHJpbmdBc3luYywgcmVzb2x2ZVNTUk5vZGUsIHJ1bkh5ZHJhdGlvbkV2ZW50cywgc2V0QXR0cmlidXRlLCBzZXRBdHRyaWJ1dGVOUywgc2V0Qm9vbEF0dHJpYnV0ZSwgc2V0UHJvcGVydHksIHNwcmVhZCwgc3NyLCBzc3JBdHRyaWJ1dGUsIHNzckNsYXNzTGlzdCwgc3NyRWxlbWVudCwgc3NySHlkcmF0aW9uS2V5LCBzc3JTcHJlYWQsIHNzclN0eWxlLCBzdHlsZSwgdGVtcGxhdGUsIHVzZSwgdm9pZEZuIGFzIHVzZUFzc2V0cyB9O1xuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiLy8gR2VuZXJhdGVkIHVzaW5nIGBucG0gcnVuIGJ1aWxkYC4gRG8gbm90IGVkaXQuXG5cbnZhciByZWdleCA9IC9eW2Etel0oPzpbXFwuMC05X2EtelxceEI3XFx4QzAtXFx4RDZcXHhEOC1cXHhGNlxceEY4LVxcdTAzN0RcXHUwMzdGLVxcdTFGRkZcXHUyMDBDXFx1MjAwRFxcdTIwM0ZcXHUyMDQwXFx1MjA3MC1cXHUyMThGXFx1MkMwMC1cXHUyRkVGXFx1MzAwMS1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkZEXXxbXFx1RDgwMC1cXHVEQjdGXVtcXHVEQzAwLVxcdURGRkZdKSotKD86W1xceDJEXFwuMC05X2EtelxceEI3XFx4QzAtXFx4RDZcXHhEOC1cXHhGNlxceEY4LVxcdTAzN0RcXHUwMzdGLVxcdTFGRkZcXHUyMDBDXFx1MjAwRFxcdTIwM0ZcXHUyMDQwXFx1MjA3MC1cXHUyMThGXFx1MkMwMC1cXHUyRkVGXFx1MzAwMS1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkZEXXxbXFx1RDgwMC1cXHVEQjdGXVtcXHVEQzAwLVxcdURGRkZdKSokLztcblxudmFyIGlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUgPSBmdW5jdGlvbihzdHJpbmcpIHtcblx0cmV0dXJuIHJlZ2V4LnRlc3Qoc3RyaW5nKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZTtcbiIsInZhciBfX2FzeW5jID0gKF9fdGhpcywgX19hcmd1bWVudHMsIGdlbmVyYXRvcikgPT4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIHZhciBmdWxmaWxsZWQgPSAodmFsdWUpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgfVxuICAgIH07XG4gICAgdmFyIHJlamVjdGVkID0gKHZhbHVlKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBzdGVwKGdlbmVyYXRvci50aHJvdyh2YWx1ZSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZWplY3QoZSk7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgc3RlcCA9ICh4KSA9PiB4LmRvbmUgPyByZXNvbHZlKHgudmFsdWUpIDogUHJvbWlzZS5yZXNvbHZlKHgudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7XG4gICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KF9fdGhpcywgX19hcmd1bWVudHMpKS5uZXh0KCkpO1xuICB9KTtcbn07XG5cbi8vIHNyYy9pbmRleC50c1xuaW1wb3J0IGlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUgZnJvbSBcImlzLXBvdGVudGlhbC1jdXN0b20tZWxlbWVudC1uYW1lXCI7XG5mdW5jdGlvbiBjcmVhdGVJc29sYXRlZEVsZW1lbnQob3B0aW9ucykge1xuICByZXR1cm4gX19hc3luYyh0aGlzLCBudWxsLCBmdW5jdGlvbiogKCkge1xuICAgIGNvbnN0IHsgbmFtZSwgbW9kZSA9IFwiY2xvc2VkXCIsIGNzcywgaXNvbGF0ZUV2ZW50cyA9IGZhbHNlIH0gPSBvcHRpb25zO1xuICAgIGlmICghaXNQb3RlbnRpYWxDdXN0b21FbGVtZW50TmFtZShuYW1lKSkge1xuICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgIGBcIiR7bmFtZX1cIiBpcyBub3QgYSB2YWxpZCBjdXN0b20gZWxlbWVudCBuYW1lLiBJdCBtdXN0IGJlIHR3byB3b3JkcyBhbmQga2ViYWItY2FzZSwgd2l0aCBhIGZldyBleGNlcHRpb25zLiBTZWUgc3BlYyBmb3IgbW9yZSBkZXRhaWxzOiBodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9jdXN0b20tZWxlbWVudHMuaHRtbCN2YWxpZC1jdXN0b20tZWxlbWVudC1uYW1lYFxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgcGFyZW50RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQobmFtZSk7XG4gICAgY29uc3Qgc2hhZG93ID0gcGFyZW50RWxlbWVudC5hdHRhY2hTaGFkb3coeyBtb2RlIH0pO1xuICAgIGNvbnN0IGlzb2xhdGVkRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJodG1sXCIpO1xuICAgIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYm9keVwiKTtcbiAgICBjb25zdCBoZWFkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImhlYWRcIik7XG4gICAgaWYgKGNzcykge1xuICAgICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XG4gICAgICBpZiAoXCJ1cmxcIiBpbiBjc3MpIHtcbiAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSB5aWVsZCBmZXRjaChjc3MudXJsKS50aGVuKChyZXMpID0+IHJlcy50ZXh0KCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSBjc3MudGV4dENvbnRlbnQ7XG4gICAgICB9XG4gICAgICBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICB9XG4gICAgaXNvbGF0ZWRFbGVtZW50LmFwcGVuZENoaWxkKGhlYWQpO1xuICAgIGlzb2xhdGVkRWxlbWVudC5hcHBlbmRDaGlsZChib2R5KTtcbiAgICBzaGFkb3cuYXBwZW5kQ2hpbGQoaXNvbGF0ZWRFbGVtZW50KTtcbiAgICBpZiAoaXNvbGF0ZUV2ZW50cykge1xuICAgICAgY29uc3QgZXZlbnRUeXBlcyA9IEFycmF5LmlzQXJyYXkoaXNvbGF0ZUV2ZW50cykgPyBpc29sYXRlRXZlbnRzIDogW1wia2V5ZG93blwiLCBcImtleXVwXCIsIFwia2V5cHJlc3NcIl07XG4gICAgICBldmVudFR5cGVzLmZvckVhY2goKGV2ZW50VHlwZSkgPT4ge1xuICAgICAgICBib2R5LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnRUeXBlLCAoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHBhcmVudEVsZW1lbnQsXG4gICAgICBzaGFkb3csXG4gICAgICBpc29sYXRlZEVsZW1lbnQ6IGJvZHlcbiAgICB9O1xuICB9KTtcbn1cbmV4cG9ydCB7XG4gIGNyZWF0ZUlzb2xhdGVkRWxlbWVudFxufTtcbiIsImNvbnN0IG51bGxLZXkgPSBTeW1ib2woJ251bGwnKTsgLy8gYG9iamVjdEhhc2hlc2Aga2V5IGZvciBudWxsXG5cbmxldCBrZXlDb3VudGVyID0gMDtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWFueUtleXNNYXAgZXh0ZW5kcyBNYXAge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fb2JqZWN0SGFzaGVzID0gbmV3IFdlYWtNYXAoKTtcblx0XHR0aGlzLl9zeW1ib2xIYXNoZXMgPSBuZXcgTWFwKCk7IC8vIGh0dHBzOi8vZ2l0aHViLmNvbS90YzM5L2VjbWEyNjIvaXNzdWVzLzExOTRcblx0XHR0aGlzLl9wdWJsaWNLZXlzID0gbmV3IE1hcCgpO1xuXG5cdFx0Y29uc3QgW3BhaXJzXSA9IGFyZ3VtZW50czsgLy8gTWFwIGNvbXBhdFxuXHRcdGlmIChwYWlycyA9PT0gbnVsbCB8fCBwYWlycyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBwYWlyc1tTeW1ib2wuaXRlcmF0b3JdICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHR5cGVvZiBwYWlycyArICcgaXMgbm90IGl0ZXJhYmxlIChjYW5ub3QgcmVhZCBwcm9wZXJ0eSBTeW1ib2woU3ltYm9sLml0ZXJhdG9yKSknKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IFtrZXlzLCB2YWx1ZV0gb2YgcGFpcnMpIHtcblx0XHRcdHRoaXMuc2V0KGtleXMsIHZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRfZ2V0UHVibGljS2V5cyhrZXlzLCBjcmVhdGUgPSBmYWxzZSkge1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShrZXlzKSkge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIGtleXMgcGFyYW1ldGVyIG11c3QgYmUgYW4gYXJyYXknKTtcblx0XHR9XG5cblx0XHRjb25zdCBwcml2YXRlS2V5ID0gdGhpcy5fZ2V0UHJpdmF0ZUtleShrZXlzLCBjcmVhdGUpO1xuXG5cdFx0bGV0IHB1YmxpY0tleTtcblx0XHRpZiAocHJpdmF0ZUtleSAmJiB0aGlzLl9wdWJsaWNLZXlzLmhhcyhwcml2YXRlS2V5KSkge1xuXHRcdFx0cHVibGljS2V5ID0gdGhpcy5fcHVibGljS2V5cy5nZXQocHJpdmF0ZUtleSk7XG5cdFx0fSBlbHNlIGlmIChjcmVhdGUpIHtcblx0XHRcdHB1YmxpY0tleSA9IFsuLi5rZXlzXTsgLy8gUmVnZW5lcmF0ZSBrZXlzIGFycmF5IHRvIGF2b2lkIGV4dGVybmFsIGludGVyYWN0aW9uXG5cdFx0XHR0aGlzLl9wdWJsaWNLZXlzLnNldChwcml2YXRlS2V5LCBwdWJsaWNLZXkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7cHJpdmF0ZUtleSwgcHVibGljS2V5fTtcblx0fVxuXG5cdF9nZXRQcml2YXRlS2V5KGtleXMsIGNyZWF0ZSA9IGZhbHNlKSB7XG5cdFx0Y29uc3QgcHJpdmF0ZUtleXMgPSBbXTtcblx0XHRmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuXHRcdFx0aWYgKGtleSA9PT0gbnVsbCkge1xuXHRcdFx0XHRrZXkgPSBudWxsS2V5O1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBoYXNoZXMgPSB0eXBlb2Yga2V5ID09PSAnb2JqZWN0JyB8fCB0eXBlb2Yga2V5ID09PSAnZnVuY3Rpb24nID8gJ19vYmplY3RIYXNoZXMnIDogKHR5cGVvZiBrZXkgPT09ICdzeW1ib2wnID8gJ19zeW1ib2xIYXNoZXMnIDogZmFsc2UpO1xuXG5cdFx0XHRpZiAoIWhhc2hlcykge1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKGtleSk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXNbaGFzaGVzXS5oYXMoa2V5KSkge1xuXHRcdFx0XHRwcml2YXRlS2V5cy5wdXNoKHRoaXNbaGFzaGVzXS5nZXQoa2V5KSk7XG5cdFx0XHR9IGVsc2UgaWYgKGNyZWF0ZSkge1xuXHRcdFx0XHRjb25zdCBwcml2YXRlS2V5ID0gYEBAbWttLXJlZi0ke2tleUNvdW50ZXIrK31AQGA7XG5cdFx0XHRcdHRoaXNbaGFzaGVzXS5zZXQoa2V5LCBwcml2YXRlS2V5KTtcblx0XHRcdFx0cHJpdmF0ZUtleXMucHVzaChwcml2YXRlS2V5KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkocHJpdmF0ZUtleXMpO1xuXHR9XG5cblx0c2V0KGtleXMsIHZhbHVlKSB7XG5cdFx0Y29uc3Qge3B1YmxpY0tleX0gPSB0aGlzLl9nZXRQdWJsaWNLZXlzKGtleXMsIHRydWUpO1xuXHRcdHJldHVybiBzdXBlci5zZXQocHVibGljS2V5LCB2YWx1ZSk7XG5cdH1cblxuXHRnZXQoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gc3VwZXIuZ2V0KHB1YmxpY0tleSk7XG5cdH1cblxuXHRoYXMoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gc3VwZXIuaGFzKHB1YmxpY0tleSk7XG5cdH1cblxuXHRkZWxldGUoa2V5cykge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXksIHByaXZhdGVLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzKTtcblx0XHRyZXR1cm4gQm9vbGVhbihwdWJsaWNLZXkgJiYgc3VwZXIuZGVsZXRlKHB1YmxpY0tleSkgJiYgdGhpcy5fcHVibGljS2V5cy5kZWxldGUocHJpdmF0ZUtleSkpO1xuXHR9XG5cblx0Y2xlYXIoKSB7XG5cdFx0c3VwZXIuY2xlYXIoKTtcblx0XHR0aGlzLl9zeW1ib2xIYXNoZXMuY2xlYXIoKTtcblx0XHR0aGlzLl9wdWJsaWNLZXlzLmNsZWFyKCk7XG5cdH1cblxuXHRnZXQgW1N5bWJvbC50b1N0cmluZ1RhZ10oKSB7XG5cdFx0cmV0dXJuICdNYW55S2V5c01hcCc7XG5cdH1cblxuXHRnZXQgc2l6ZSgpIHtcblx0XHRyZXR1cm4gc3VwZXIuc2l6ZTtcblx0fVxufVxuIiwiZnVuY3Rpb24gaXNQbGFpbk9iamVjdCh2YWx1ZSkge1xuICBpZiAodmFsdWUgPT09IG51bGwgfHwgdHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHByb3RvdHlwZSA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSk7XG4gIGlmIChwcm90b3R5cGUgIT09IG51bGwgJiYgcHJvdG90eXBlICE9PSBPYmplY3QucHJvdG90eXBlICYmIE9iamVjdC5nZXRQcm90b3R5cGVPZihwcm90b3R5cGUpICE9PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChTeW1ib2wuaXRlcmF0b3IgaW4gdmFsdWUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKFN5bWJvbC50b1N0cmluZ1RhZyBpbiB2YWx1ZSkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpID09PSBcIltvYmplY3QgTW9kdWxlXVwiO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBfZGVmdShiYXNlT2JqZWN0LCBkZWZhdWx0cywgbmFtZXNwYWNlID0gXCIuXCIsIG1lcmdlcikge1xuICBpZiAoIWlzUGxhaW5PYmplY3QoZGVmYXVsdHMpKSB7XG4gICAgcmV0dXJuIF9kZWZ1KGJhc2VPYmplY3QsIHt9LCBuYW1lc3BhY2UsIG1lcmdlcik7XG4gIH1cbiAgY29uc3Qgb2JqZWN0ID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdHMpO1xuICBmb3IgKGNvbnN0IGtleSBpbiBiYXNlT2JqZWN0KSB7XG4gICAgaWYgKGtleSA9PT0gXCJfX3Byb3RvX19cIiB8fCBrZXkgPT09IFwiY29uc3RydWN0b3JcIikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gYmFzZU9iamVjdFtrZXldO1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdm9pZCAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKG1lcmdlciAmJiBtZXJnZXIob2JqZWN0LCBrZXksIHZhbHVlLCBuYW1lc3BhY2UpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpICYmIEFycmF5LmlzQXJyYXkob2JqZWN0W2tleV0pKSB7XG4gICAgICBvYmplY3Rba2V5XSA9IFsuLi52YWx1ZSwgLi4ub2JqZWN0W2tleV1dO1xuICAgIH0gZWxzZSBpZiAoaXNQbGFpbk9iamVjdCh2YWx1ZSkgJiYgaXNQbGFpbk9iamVjdChvYmplY3Rba2V5XSkpIHtcbiAgICAgIG9iamVjdFtrZXldID0gX2RlZnUoXG4gICAgICAgIHZhbHVlLFxuICAgICAgICBvYmplY3Rba2V5XSxcbiAgICAgICAgKG5hbWVzcGFjZSA/IGAke25hbWVzcGFjZX0uYCA6IFwiXCIpICsga2V5LnRvU3RyaW5nKCksXG4gICAgICAgIG1lcmdlclxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG9iamVjdDtcbn1cbmZ1bmN0aW9uIGNyZWF0ZURlZnUobWVyZ2VyKSB7XG4gIHJldHVybiAoLi4uYXJndW1lbnRzXykgPT4gKFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSB1bmljb3JuL25vLWFycmF5LXJlZHVjZVxuICAgIGFyZ3VtZW50c18ucmVkdWNlKChwLCBjKSA9PiBfZGVmdShwLCBjLCBcIlwiLCBtZXJnZXIpLCB7fSlcbiAgKTtcbn1cbmNvbnN0IGRlZnUgPSBjcmVhdGVEZWZ1KCk7XG5jb25zdCBkZWZ1Rm4gPSBjcmVhdGVEZWZ1KChvYmplY3QsIGtleSwgY3VycmVudFZhbHVlKSA9PiB7XG4gIGlmIChvYmplY3Rba2V5XSAhPT0gdm9pZCAwICYmIHR5cGVvZiBjdXJyZW50VmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIG9iamVjdFtrZXldID0gY3VycmVudFZhbHVlKG9iamVjdFtrZXldKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufSk7XG5jb25zdCBkZWZ1QXJyYXlGbiA9IGNyZWF0ZURlZnUoKG9iamVjdCwga2V5LCBjdXJyZW50VmFsdWUpID0+IHtcbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0W2tleV0pICYmIHR5cGVvZiBjdXJyZW50VmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIG9iamVjdFtrZXldID0gY3VycmVudFZhbHVlKG9iamVjdFtrZXldKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufSk7XG5cbmV4cG9ydCB7IGNyZWF0ZURlZnUsIGRlZnUgYXMgZGVmYXVsdCwgZGVmdSwgZGVmdUFycmF5Rm4sIGRlZnVGbiB9O1xuIiwiY29uc3QgaXNFeGlzdCA9IChlbGVtZW50KSA9PiB7XG4gIHJldHVybiBlbGVtZW50ICE9PSBudWxsID8geyBpc0RldGVjdGVkOiB0cnVlLCByZXN1bHQ6IGVsZW1lbnQgfSA6IHsgaXNEZXRlY3RlZDogZmFsc2UgfTtcbn07XG5jb25zdCBpc05vdEV4aXN0ID0gKGVsZW1lbnQpID0+IHtcbiAgcmV0dXJuIGVsZW1lbnQgPT09IG51bGwgPyB7IGlzRGV0ZWN0ZWQ6IHRydWUsIHJlc3VsdDogbnVsbCB9IDogeyBpc0RldGVjdGVkOiBmYWxzZSB9O1xufTtcblxuZXhwb3J0IHsgaXNFeGlzdCwgaXNOb3RFeGlzdCB9O1xuIiwiaW1wb3J0IE1hbnlLZXlzTWFwIGZyb20gJ21hbnkta2V5cy1tYXAnO1xuaW1wb3J0IHsgZGVmdSB9IGZyb20gJ2RlZnUnO1xuaW1wb3J0IHsgaXNFeGlzdCB9IGZyb20gJy4vZGV0ZWN0b3JzLm1qcyc7XG5cbmNvbnN0IGdldERlZmF1bHRPcHRpb25zID0gKCkgPT4gKHtcbiAgdGFyZ2V0OiBnbG9iYWxUaGlzLmRvY3VtZW50LFxuICB1bmlmeVByb2Nlc3M6IHRydWUsXG4gIGRldGVjdG9yOiBpc0V4aXN0LFxuICBvYnNlcnZlQ29uZmlnczoge1xuICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICBzdWJ0cmVlOiB0cnVlLFxuICAgIGF0dHJpYnV0ZXM6IHRydWVcbiAgfSxcbiAgc2lnbmFsOiB2b2lkIDAsXG4gIGN1c3RvbU1hdGNoZXI6IHZvaWQgMFxufSk7XG5jb25zdCBtZXJnZU9wdGlvbnMgPSAodXNlclNpZGVPcHRpb25zLCBkZWZhdWx0T3B0aW9ucykgPT4ge1xuICByZXR1cm4gZGVmdSh1c2VyU2lkZU9wdGlvbnMsIGRlZmF1bHRPcHRpb25zKTtcbn07XG5cbmNvbnN0IHVuaWZ5Q2FjaGUgPSBuZXcgTWFueUtleXNNYXAoKTtcbmZ1bmN0aW9uIGNyZWF0ZVdhaXRFbGVtZW50KGluc3RhbmNlT3B0aW9ucykge1xuICBjb25zdCB7IGRlZmF1bHRPcHRpb25zIH0gPSBpbnN0YW5jZU9wdGlvbnM7XG4gIHJldHVybiAoc2VsZWN0b3IsIG9wdGlvbnMpID0+IHtcbiAgICBjb25zdCB7XG4gICAgICB0YXJnZXQsXG4gICAgICB1bmlmeVByb2Nlc3MsXG4gICAgICBvYnNlcnZlQ29uZmlncyxcbiAgICAgIGRldGVjdG9yLFxuICAgICAgc2lnbmFsLFxuICAgICAgY3VzdG9tTWF0Y2hlclxuICAgIH0gPSBtZXJnZU9wdGlvbnMob3B0aW9ucywgZGVmYXVsdE9wdGlvbnMpO1xuICAgIGNvbnN0IHVuaWZ5UHJvbWlzZUtleSA9IFtcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgdGFyZ2V0LFxuICAgICAgdW5pZnlQcm9jZXNzLFxuICAgICAgb2JzZXJ2ZUNvbmZpZ3MsXG4gICAgICBkZXRlY3RvcixcbiAgICAgIHNpZ25hbCxcbiAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICBdO1xuICAgIGNvbnN0IGNhY2hlZFByb21pc2UgPSB1bmlmeUNhY2hlLmdldCh1bmlmeVByb21pc2VLZXkpO1xuICAgIGlmICh1bmlmeVByb2Nlc3MgJiYgY2FjaGVkUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIGNhY2hlZFByb21pc2U7XG4gICAgfVxuICAgIGNvbnN0IGRldGVjdFByb21pc2UgPSBuZXcgUHJvbWlzZShcbiAgICAgIC8vIGJpb21lLWlnbm9yZSBsaW50L3N1c3BpY2lvdXMvbm9Bc3luY1Byb21pc2VFeGVjdXRvcjogYXZvaWQgbmVzdGluZyBwcm9taXNlXG4gICAgICBhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmIChzaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KHNpZ25hbC5yZWFzb24pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoXG4gICAgICAgICAgYXN5bmMgKG11dGF0aW9ucykgPT4ge1xuICAgICAgICAgICAgZm9yIChjb25zdCBfIG9mIG11dGF0aW9ucykge1xuICAgICAgICAgICAgICBpZiAoc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnN0IGRldGVjdFJlc3VsdDIgPSBhd2FpdCBkZXRlY3RFbGVtZW50KHtcbiAgICAgICAgICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgICAgICAgZGV0ZWN0b3IsXG4gICAgICAgICAgICAgICAgY3VzdG9tTWF0Y2hlclxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgaWYgKGRldGVjdFJlc3VsdDIuaXNEZXRlY3RlZCkge1xuICAgICAgICAgICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGRldGVjdFJlc3VsdDIucmVzdWx0KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgICAgc2lnbmFsPy5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgIFwiYWJvcnRcIixcbiAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KHNpZ25hbC5yZWFzb24pO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgeyBvbmNlOiB0cnVlIH1cbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgZGV0ZWN0UmVzdWx0ID0gYXdhaXQgZGV0ZWN0RWxlbWVudCh7XG4gICAgICAgICAgc2VsZWN0b3IsXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgIGRldGVjdG9yLFxuICAgICAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChkZXRlY3RSZXN1bHQuaXNEZXRlY3RlZCkge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKGRldGVjdFJlc3VsdC5yZXN1bHQpO1xuICAgICAgICB9XG4gICAgICAgIG9ic2VydmVyLm9ic2VydmUodGFyZ2V0LCBvYnNlcnZlQ29uZmlncyk7XG4gICAgICB9XG4gICAgKS5maW5hbGx5KCgpID0+IHtcbiAgICAgIHVuaWZ5Q2FjaGUuZGVsZXRlKHVuaWZ5UHJvbWlzZUtleSk7XG4gICAgfSk7XG4gICAgdW5pZnlDYWNoZS5zZXQodW5pZnlQcm9taXNlS2V5LCBkZXRlY3RQcm9taXNlKTtcbiAgICByZXR1cm4gZGV0ZWN0UHJvbWlzZTtcbiAgfTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGRldGVjdEVsZW1lbnQoe1xuICB0YXJnZXQsXG4gIHNlbGVjdG9yLFxuICBkZXRlY3RvcixcbiAgY3VzdG9tTWF0Y2hlclxufSkge1xuICBjb25zdCBlbGVtZW50ID0gY3VzdG9tTWF0Y2hlciA/IGN1c3RvbU1hdGNoZXIoc2VsZWN0b3IpIDogdGFyZ2V0LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuICByZXR1cm4gYXdhaXQgZGV0ZWN0b3IoZWxlbWVudCk7XG59XG5jb25zdCB3YWl0RWxlbWVudCA9IGNyZWF0ZVdhaXRFbGVtZW50KHtcbiAgZGVmYXVsdE9wdGlvbnM6IGdldERlZmF1bHRPcHRpb25zKClcbn0pO1xuXG5leHBvcnQgeyBjcmVhdGVXYWl0RWxlbWVudCwgZ2V0RGVmYXVsdE9wdGlvbnMsIHdhaXRFbGVtZW50IH07XG4iLCJmdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcbiAgaWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXJncy5zaGlmdCgpO1xuICAgIG1ldGhvZChgW3d4dF0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xuICB9XG59XG5leHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuICBsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG4gIHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuICBlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuIiwiaW1wb3J0IHsgd2FpdEVsZW1lbnQgfSBmcm9tIFwiQDFuYXRzdS93YWl0LWVsZW1lbnRcIjtcbmltcG9ydCB7XG4gIGlzRXhpc3QgYXMgbW91bnREZXRlY3RvcixcbiAgaXNOb3RFeGlzdCBhcyByZW1vdmVEZXRlY3RvclxufSBmcm9tIFwiQDFuYXRzdS93YWl0LWVsZW1lbnQvZGV0ZWN0b3JzXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5UG9zaXRpb24ocm9vdCwgcG9zaXRpb25lZEVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgaWYgKG9wdGlvbnMucG9zaXRpb24gPT09IFwiaW5saW5lXCIpIHJldHVybjtcbiAgaWYgKG9wdGlvbnMuekluZGV4ICE9IG51bGwpIHJvb3Quc3R5bGUuekluZGV4ID0gU3RyaW5nKG9wdGlvbnMuekluZGV4KTtcbiAgcm9vdC5zdHlsZS5vdmVyZmxvdyA9IFwidmlzaWJsZVwiO1xuICByb290LnN0eWxlLnBvc2l0aW9uID0gXCJyZWxhdGl2ZVwiO1xuICByb290LnN0eWxlLndpZHRoID0gXCIwXCI7XG4gIHJvb3Quc3R5bGUuaGVpZ2h0ID0gXCIwXCI7XG4gIHJvb3Quc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgaWYgKHBvc2l0aW9uZWRFbGVtZW50KSB7XG4gICAgaWYgKG9wdGlvbnMucG9zaXRpb24gPT09IFwib3ZlcmxheVwiKSB7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiYWJzb2x1dGVcIjtcbiAgICAgIGlmIChvcHRpb25zLmFsaWdubWVudD8uc3RhcnRzV2l0aChcImJvdHRvbS1cIikpXG4gICAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmJvdHRvbSA9IFwiMFwiO1xuICAgICAgZWxzZSBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIjtcbiAgICAgIGlmIChvcHRpb25zLmFsaWdubWVudD8uZW5kc1dpdGgoXCItcmlnaHRcIikpXG4gICAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIwXCI7XG4gICAgICBlbHNlIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmxlZnQgPSBcIjBcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmJvdHRvbSA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUubGVmdCA9IFwiMFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIjtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRBbmNob3Iob3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5hbmNob3IgPT0gbnVsbCkgcmV0dXJuIGRvY3VtZW50LmJvZHk7XG4gIGxldCByZXNvbHZlZCA9IHR5cGVvZiBvcHRpb25zLmFuY2hvciA9PT0gXCJmdW5jdGlvblwiID8gb3B0aW9ucy5hbmNob3IoKSA6IG9wdGlvbnMuYW5jaG9yO1xuICBpZiAodHlwZW9mIHJlc29sdmVkID09PSBcInN0cmluZ1wiKSB7XG4gICAgaWYgKHJlc29sdmVkLnN0YXJ0c1dpdGgoXCIvXCIpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBkb2N1bWVudC5ldmFsdWF0ZShcbiAgICAgICAgcmVzb2x2ZWQsXG4gICAgICAgIGRvY3VtZW50LFxuICAgICAgICBudWxsLFxuICAgICAgICBYUGF0aFJlc3VsdC5GSVJTVF9PUkRFUkVEX05PREVfVFlQRSxcbiAgICAgICAgbnVsbFxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXN1bHQuc2luZ2xlTm9kZVZhbHVlID8/IHZvaWQgMDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IocmVzb2x2ZWQpID8/IHZvaWQgMDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc29sdmVkID8/IHZvaWQgMDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtb3VudFVpKHJvb3QsIG9wdGlvbnMpIHtcbiAgY29uc3QgYW5jaG9yID0gZ2V0QW5jaG9yKG9wdGlvbnMpO1xuICBpZiAoYW5jaG9yID09IG51bGwpXG4gICAgdGhyb3cgRXJyb3IoXG4gICAgICBcIkZhaWxlZCB0byBtb3VudCBjb250ZW50IHNjcmlwdCBVSTogY291bGQgbm90IGZpbmQgYW5jaG9yIGVsZW1lbnRcIlxuICAgICk7XG4gIHN3aXRjaCAob3B0aW9ucy5hcHBlbmQpIHtcbiAgICBjYXNlIHZvaWQgMDpcbiAgICBjYXNlIFwibGFzdFwiOlxuICAgICAgYW5jaG9yLmFwcGVuZChyb290KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJmaXJzdFwiOlxuICAgICAgYW5jaG9yLnByZXBlbmQocm9vdCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwicmVwbGFjZVwiOlxuICAgICAgYW5jaG9yLnJlcGxhY2VXaXRoKHJvb3QpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImFmdGVyXCI6XG4gICAgICBhbmNob3IucGFyZW50RWxlbWVudD8uaW5zZXJ0QmVmb3JlKHJvb3QsIGFuY2hvci5uZXh0RWxlbWVudFNpYmxpbmcpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImJlZm9yZVwiOlxuICAgICAgYW5jaG9yLnBhcmVudEVsZW1lbnQ/Lmluc2VydEJlZm9yZShyb290LCBhbmNob3IpO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIG9wdGlvbnMuYXBwZW5kKGFuY2hvciwgcm9vdCk7XG4gICAgICBicmVhaztcbiAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1vdW50RnVuY3Rpb25zKGJhc2VGdW5jdGlvbnMsIG9wdGlvbnMpIHtcbiAgbGV0IGF1dG9Nb3VudEluc3RhbmNlID0gdm9pZCAwO1xuICBjb25zdCBzdG9wQXV0b01vdW50ID0gKCkgPT4ge1xuICAgIGF1dG9Nb3VudEluc3RhbmNlPy5zdG9wQXV0b01vdW50KCk7XG4gICAgYXV0b01vdW50SW5zdGFuY2UgPSB2b2lkIDA7XG4gIH07XG4gIGNvbnN0IG1vdW50ID0gKCkgPT4ge1xuICAgIGJhc2VGdW5jdGlvbnMubW91bnQoKTtcbiAgfTtcbiAgY29uc3QgdW5tb3VudCA9IGJhc2VGdW5jdGlvbnMucmVtb3ZlO1xuICBjb25zdCByZW1vdmUgPSAoKSA9PiB7XG4gICAgc3RvcEF1dG9Nb3VudCgpO1xuICAgIGJhc2VGdW5jdGlvbnMucmVtb3ZlKCk7XG4gIH07XG4gIGNvbnN0IGF1dG9Nb3VudCA9IChhdXRvTW91bnRPcHRpb25zKSA9PiB7XG4gICAgaWYgKGF1dG9Nb3VudEluc3RhbmNlKSB7XG4gICAgICBsb2dnZXIud2FybihcImF1dG9Nb3VudCBpcyBhbHJlYWR5IHNldC5cIik7XG4gICAgfVxuICAgIGF1dG9Nb3VudEluc3RhbmNlID0gYXV0b01vdW50VWkoXG4gICAgICB7IG1vdW50LCB1bm1vdW50LCBzdG9wQXV0b01vdW50IH0sXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIC4uLmF1dG9Nb3VudE9wdGlvbnNcbiAgICAgIH1cbiAgICApO1xuICB9O1xuICByZXR1cm4ge1xuICAgIG1vdW50LFxuICAgIHJlbW92ZSxcbiAgICBhdXRvTW91bnRcbiAgfTtcbn1cbmZ1bmN0aW9uIGF1dG9Nb3VudFVpKHVpQ2FsbGJhY2tzLCBvcHRpb25zKSB7XG4gIGNvbnN0IGFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgY29uc3QgRVhQTElDSVRfU1RPUF9SRUFTT04gPSBcImV4cGxpY2l0X3N0b3BfYXV0b19tb3VudFwiO1xuICBjb25zdCBfc3RvcEF1dG9Nb3VudCA9ICgpID0+IHtcbiAgICBhYm9ydENvbnRyb2xsZXIuYWJvcnQoRVhQTElDSVRfU1RPUF9SRUFTT04pO1xuICAgIG9wdGlvbnMub25TdG9wPy4oKTtcbiAgfTtcbiAgbGV0IHJlc29sdmVkQW5jaG9yID0gdHlwZW9mIG9wdGlvbnMuYW5jaG9yID09PSBcImZ1bmN0aW9uXCIgPyBvcHRpb25zLmFuY2hvcigpIDogb3B0aW9ucy5hbmNob3I7XG4gIGlmIChyZXNvbHZlZEFuY2hvciBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICB0aHJvdyBFcnJvcihcbiAgICAgIFwiYXV0b01vdW50IGFuZCBFbGVtZW50IGFuY2hvciBvcHRpb24gY2Fubm90IGJlIGNvbWJpbmVkLiBBdm9pZCBwYXNzaW5nIGBFbGVtZW50YCBkaXJlY3RseSBvciBgKCkgPT4gRWxlbWVudGAgdG8gdGhlIGFuY2hvci5cIlxuICAgICk7XG4gIH1cbiAgYXN5bmMgZnVuY3Rpb24gb2JzZXJ2ZUVsZW1lbnQoc2VsZWN0b3IpIHtcbiAgICBsZXQgaXNBbmNob3JFeGlzdCA9ICEhZ2V0QW5jaG9yKG9wdGlvbnMpO1xuICAgIGlmIChpc0FuY2hvckV4aXN0KSB7XG4gICAgICB1aUNhbGxiYWNrcy5tb3VudCgpO1xuICAgIH1cbiAgICB3aGlsZSAoIWFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY2hhbmdlZEFuY2hvciA9IGF3YWl0IHdhaXRFbGVtZW50KHNlbGVjdG9yID8/IFwiYm9keVwiLCB7XG4gICAgICAgICAgY3VzdG9tTWF0Y2hlcjogKCkgPT4gZ2V0QW5jaG9yKG9wdGlvbnMpID8/IG51bGwsXG4gICAgICAgICAgZGV0ZWN0b3I6IGlzQW5jaG9yRXhpc3QgPyByZW1vdmVEZXRlY3RvciA6IG1vdW50RGV0ZWN0b3IsXG4gICAgICAgICAgc2lnbmFsOiBhYm9ydENvbnRyb2xsZXIuc2lnbmFsXG4gICAgICAgIH0pO1xuICAgICAgICBpc0FuY2hvckV4aXN0ID0gISFjaGFuZ2VkQW5jaG9yO1xuICAgICAgICBpZiAoaXNBbmNob3JFeGlzdCkge1xuICAgICAgICAgIHVpQ2FsbGJhY2tzLm1vdW50KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdWlDYWxsYmFja3MudW5tb3VudCgpO1xuICAgICAgICAgIGlmIChvcHRpb25zLm9uY2UpIHtcbiAgICAgICAgICAgIHVpQ2FsbGJhY2tzLnN0b3BBdXRvTW91bnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGlmIChhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQgJiYgYWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZWFzb24gPT09IEVYUExJQ0lUX1NUT1BfUkVBU09OKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgb2JzZXJ2ZUVsZW1lbnQocmVzb2x2ZWRBbmNob3IpO1xuICByZXR1cm4geyBzdG9wQXV0b01vdW50OiBfc3RvcEF1dG9Nb3VudCB9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIHNwbGl0U2hhZG93Um9vdENzcyhjc3MpIHtcbiAgbGV0IHNoYWRvd0NzcyA9IGNzcztcbiAgbGV0IGRvY3VtZW50Q3NzID0gXCJcIjtcbiAgY29uc3QgcnVsZXNSZWdleCA9IC8oXFxzKkAocHJvcGVydHl8Zm9udC1mYWNlKVtcXHNcXFNdKj97W1xcc1xcU10qP30pL2dtO1xuICBsZXQgbWF0Y2g7XG4gIHdoaWxlICgobWF0Y2ggPSBydWxlc1JlZ2V4LmV4ZWMoY3NzKSkgIT09IG51bGwpIHtcbiAgICBkb2N1bWVudENzcyArPSBtYXRjaFsxXTtcbiAgICBzaGFkb3dDc3MgPSBzaGFkb3dDc3MucmVwbGFjZShtYXRjaFsxXSwgXCJcIik7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBkb2N1bWVudENzczogZG9jdW1lbnRDc3MudHJpbSgpLFxuICAgIHNoYWRvd0Nzczogc2hhZG93Q3NzLnRyaW0oKVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgY3JlYXRlSXNvbGF0ZWRFbGVtZW50IH0gZnJvbSBcIkB3ZWJleHQtY29yZS9pc29sYXRlZC1lbGVtZW50XCI7XG5pbXBvcnQgeyBhcHBseVBvc2l0aW9uLCBjcmVhdGVNb3VudEZ1bmN0aW9ucywgbW91bnRVaSB9IGZyb20gXCIuL3NoYXJlZC5tanNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQgeyBzcGxpdFNoYWRvd1Jvb3RDc3MgfSBmcm9tIFwiLi4vc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qc1wiO1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVNoYWRvd1Jvb3RVaShjdHgsIG9wdGlvbnMpIHtcbiAgY29uc3QgaW5zdGFuY2VJZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZygyLCAxNSk7XG4gIGNvbnN0IGNzcyA9IFtdO1xuICBpZiAoIW9wdGlvbnMuaW5oZXJpdFN0eWxlcykge1xuICAgIGNzcy5wdXNoKGAvKiBXWFQgU2hhZG93IFJvb3QgUmVzZXQgKi8gOmhvc3R7YWxsOmluaXRpYWwgIWltcG9ydGFudDt9YCk7XG4gIH1cbiAgaWYgKG9wdGlvbnMuY3NzKSB7XG4gICAgY3NzLnB1c2gob3B0aW9ucy5jc3MpO1xuICB9XG4gIGlmIChjdHgub3B0aW9ucz8uY3NzSW5qZWN0aW9uTW9kZSA9PT0gXCJ1aVwiKSB7XG4gICAgY29uc3QgZW50cnlDc3MgPSBhd2FpdCBsb2FkQ3NzKCk7XG4gICAgY3NzLnB1c2goZW50cnlDc3MucmVwbGFjZUFsbChcIjpyb290XCIsIFwiOmhvc3RcIikpO1xuICB9XG4gIGNvbnN0IHsgc2hhZG93Q3NzLCBkb2N1bWVudENzcyB9ID0gc3BsaXRTaGFkb3dSb290Q3NzKGNzcy5qb2luKFwiXFxuXCIpLnRyaW0oKSk7XG4gIGNvbnN0IHtcbiAgICBpc29sYXRlZEVsZW1lbnQ6IHVpQ29udGFpbmVyLFxuICAgIHBhcmVudEVsZW1lbnQ6IHNoYWRvd0hvc3QsXG4gICAgc2hhZG93XG4gIH0gPSBhd2FpdCBjcmVhdGVJc29sYXRlZEVsZW1lbnQoe1xuICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICBjc3M6IHtcbiAgICAgIHRleHRDb250ZW50OiBzaGFkb3dDc3NcbiAgICB9LFxuICAgIG1vZGU6IG9wdGlvbnMubW9kZSA/PyBcIm9wZW5cIixcbiAgICBpc29sYXRlRXZlbnRzOiBvcHRpb25zLmlzb2xhdGVFdmVudHNcbiAgfSk7XG4gIHNoYWRvd0hvc3Quc2V0QXR0cmlidXRlKFwiZGF0YS13eHQtc2hhZG93LXJvb3RcIiwgXCJcIik7XG4gIGxldCBtb3VudGVkO1xuICBjb25zdCBtb3VudCA9ICgpID0+IHtcbiAgICBtb3VudFVpKHNoYWRvd0hvc3QsIG9wdGlvbnMpO1xuICAgIGFwcGx5UG9zaXRpb24oc2hhZG93SG9zdCwgc2hhZG93LnF1ZXJ5U2VsZWN0b3IoXCJodG1sXCIpLCBvcHRpb25zKTtcbiAgICBpZiAoZG9jdW1lbnRDc3MgJiYgIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXG4gICAgICBgc3R5bGVbd3h0LXNoYWRvdy1yb290LWRvY3VtZW50LXN0eWxlcz1cIiR7aW5zdGFuY2VJZH1cIl1gXG4gICAgKSkge1xuICAgICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XG4gICAgICBzdHlsZS50ZXh0Q29udGVudCA9IGRvY3VtZW50Q3NzO1xuICAgICAgc3R5bGUuc2V0QXR0cmlidXRlKFwid3h0LXNoYWRvdy1yb290LWRvY3VtZW50LXN0eWxlc1wiLCBpbnN0YW5jZUlkKTtcbiAgICAgIChkb2N1bWVudC5oZWFkID8/IGRvY3VtZW50LmJvZHkpLmFwcGVuZChzdHlsZSk7XG4gICAgfVxuICAgIG1vdW50ZWQgPSBvcHRpb25zLm9uTW91bnQodWlDb250YWluZXIsIHNoYWRvdywgc2hhZG93SG9zdCk7XG4gIH07XG4gIGNvbnN0IHJlbW92ZSA9ICgpID0+IHtcbiAgICBvcHRpb25zLm9uUmVtb3ZlPy4obW91bnRlZCk7XG4gICAgc2hhZG93SG9zdC5yZW1vdmUoKTtcbiAgICBjb25zdCBkb2N1bWVudFN0eWxlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcbiAgICAgIGBzdHlsZVt3eHQtc2hhZG93LXJvb3QtZG9jdW1lbnQtc3R5bGVzPVwiJHtpbnN0YW5jZUlkfVwiXWBcbiAgICApO1xuICAgIGRvY3VtZW50U3R5bGU/LnJlbW92ZSgpO1xuICAgIHdoaWxlICh1aUNvbnRhaW5lci5sYXN0Q2hpbGQpXG4gICAgICB1aUNvbnRhaW5lci5yZW1vdmVDaGlsZCh1aUNvbnRhaW5lci5sYXN0Q2hpbGQpO1xuICAgIG1vdW50ZWQgPSB2b2lkIDA7XG4gIH07XG4gIGNvbnN0IG1vdW50RnVuY3Rpb25zID0gY3JlYXRlTW91bnRGdW5jdGlvbnMoXG4gICAge1xuICAgICAgbW91bnQsXG4gICAgICByZW1vdmVcbiAgICB9LFxuICAgIG9wdGlvbnNcbiAgKTtcbiAgY3R4Lm9uSW52YWxpZGF0ZWQocmVtb3ZlKTtcbiAgcmV0dXJuIHtcbiAgICBzaGFkb3csXG4gICAgc2hhZG93SG9zdCxcbiAgICB1aUNvbnRhaW5lcixcbiAgICAuLi5tb3VudEZ1bmN0aW9ucyxcbiAgICBnZXQgbW91bnRlZCgpIHtcbiAgICAgIHJldHVybiBtb3VudGVkO1xuICAgIH1cbiAgfTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGxvYWRDc3MoKSB7XG4gIGNvbnN0IHVybCA9IGJyb3dzZXIucnVudGltZS5nZXRVUkwoYC9jb250ZW50LXNjcmlwdHMvJHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH0uY3NzYCk7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsKTtcbiAgICByZXR1cm4gYXdhaXQgcmVzLnRleHQoKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgbG9nZ2VyLndhcm4oXG4gICAgICBgRmFpbGVkIHRvIGxvYWQgc3R5bGVzIEAgJHt1cmx9LiBEaWQgeW91IGZvcmdldCB0byBpbXBvcnQgdGhlIHN0eWxlc2hlZXQgaW4geW91ciBlbnRyeXBvaW50P2AsXG4gICAgICBlcnJcbiAgICApO1xuICAgIHJldHVybiBcIlwiO1xuICB9XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiZnVuY3Rpb24gcihlKXt2YXIgdCxmLG49XCJcIjtpZihcInN0cmluZ1wiPT10eXBlb2YgZXx8XCJudW1iZXJcIj09dHlwZW9mIGUpbis9ZTtlbHNlIGlmKFwib2JqZWN0XCI9PXR5cGVvZiBlKWlmKEFycmF5LmlzQXJyYXkoZSkpe3ZhciBvPWUubGVuZ3RoO2Zvcih0PTA7dDxvO3QrKyllW3RdJiYoZj1yKGVbdF0pKSYmKG4mJihuKz1cIiBcIiksbis9Zil9ZWxzZSBmb3IoZiBpbiBlKWVbZl0mJihuJiYobis9XCIgXCIpLG4rPWYpO3JldHVybiBufWV4cG9ydCBmdW5jdGlvbiBjbHN4KCl7Zm9yKHZhciBlLHQsZj0wLG49XCJcIixvPWFyZ3VtZW50cy5sZW5ndGg7ZjxvO2YrKykoZT1hcmd1bWVudHNbZl0pJiYodD1yKGUpKSYmKG4mJihuKz1cIiBcIiksbis9dCk7cmV0dXJuIG59ZXhwb3J0IGRlZmF1bHQgY2xzeDsiLCJpbXBvcnQgeyBjbHN4LCB0eXBlIENsYXNzVmFsdWUgfSBmcm9tICdjbHN4J1xuXG5leHBvcnQgZnVuY3Rpb24gY24oLi4uaW5wdXRzOiBDbGFzc1ZhbHVlW10pIHtcbiAgcmV0dXJuIGNsc3goaW5wdXRzKVxufSIsImltcG9ydCB7IFNob3csIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50LCBKU1ggfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBIZWFkZXJQcm9wcyB7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBsb2dvPzogSlNYLkVsZW1lbnQ7XG4gIGFjdGlvbnM/OiBKU1guRWxlbWVudDtcbiAgdmFyaWFudD86ICdkZWZhdWx0JyB8ICdtaW5pbWFsJyB8ICd0cmFuc3BhcmVudCc7XG4gIHN0aWNreT86IGJvb2xlYW47XG4gIHNob3dNZW51QnV0dG9uPzogYm9vbGVhbjtcbiAgb25NZW51Q2xpY2s/OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IEhlYWRlcjogQ29tcG9uZW50PEhlYWRlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbaXNTY3JvbGxlZCwgc2V0SXNTY3JvbGxlZF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuXG4gIC8vIFRyYWNrIHNjcm9sbCBwb3NpdGlvbiBmb3Igc3RpY2t5IGhlYWRlciBlZmZlY3RzXG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiBwcm9wcy5zdGlja3kpIHtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgKCkgPT4ge1xuICAgICAgc2V0SXNTY3JvbGxlZCh3aW5kb3cuc2Nyb2xsWSA+IDEwKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHZhcmlhbnQgPSAoKSA9PiBwcm9wcy52YXJpYW50IHx8ICdkZWZhdWx0JztcblxuICByZXR1cm4gKFxuICAgIDxoZWFkZXJcbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ3ctZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0yMDAnLFxuICAgICAgICB7XG4gICAgICAgICAgLy8gVmFyaWFudHNcbiAgICAgICAgICAnYmctc3VyZmFjZSBib3JkZXItYiBib3JkZXItc3VidGxlJzogdmFyaWFudCgpID09PSAnZGVmYXVsdCcsXG4gICAgICAgICAgJ2JnLXRyYW5zcGFyZW50JzogdmFyaWFudCgpID09PSAnbWluaW1hbCcgfHwgdmFyaWFudCgpID09PSAndHJhbnNwYXJlbnQnLFxuICAgICAgICAgICdiYWNrZHJvcC1ibHVyLW1kIGJnLXN1cmZhY2UvODAnOiB2YXJpYW50KCkgPT09ICd0cmFuc3BhcmVudCcgJiYgaXNTY3JvbGxlZCgpLFxuICAgICAgICAgIC8vIFN0aWNreSBiZWhhdmlvclxuICAgICAgICAgICdzdGlja3kgdG9wLTAgei01MCc6IHByb3BzLnN0aWNreSxcbiAgICAgICAgICAnc2hhZG93LWxnJzogcHJvcHMuc3RpY2t5ICYmIGlzU2Nyb2xsZWQoKSxcbiAgICAgICAgfSxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgPGRpdiBjbGFzcz1cIm1heC13LXNjcmVlbi14bCBteC1hdXRvIHB4LTQgc206cHgtNiBsZzpweC04XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gaC0xNlwiPlxuICAgICAgICAgIHsvKiBMZWZ0IHNlY3Rpb24gKi99XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC00XCI+XG4gICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zaG93TWVudUJ1dHRvbn0+XG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbk1lbnVDbGlja31cbiAgICAgICAgICAgICAgICBjbGFzcz1cInAtMiByb3VuZGVkLWxnIGhvdmVyOmJnLWhpZ2hsaWdodCB0cmFuc2l0aW9uLWNvbG9ycyBsZzpoaWRkZW5cIlxuICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCJNZW51XCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxzdmcgY2xhc3M9XCJ3LTYgaC02XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCI+XG4gICAgICAgICAgICAgICAgICA8cGF0aCBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIiBzdHJva2Utd2lkdGg9XCIyXCIgZD1cIk00IDZoMTZNNCAxMmgxNk00IDE4aDE2XCIgLz5cbiAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmxvZ299IGZhbGxiYWNrPXtcbiAgICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMudGl0bGV9PlxuICAgICAgICAgICAgICAgIDxoMSBjbGFzcz1cInRleHQteGwgZm9udC1ib2xkIHRleHQtcHJpbWFyeVwiPntwcm9wcy50aXRsZX08L2gxPlxuICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICB9PlxuICAgICAgICAgICAgICB7cHJvcHMubG9nb31cbiAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgIHsvKiBSaWdodCBzZWN0aW9uICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmFjdGlvbnN9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgIHtwcm9wcy5hY3Rpb25zfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvaGVhZGVyPlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNjb3JlUGFuZWxQcm9wcyB7XG4gIHNjb3JlOiBudW1iZXI7XG4gIHJhbms6IG51bWJlcjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBTY29yZVBhbmVsOiBDb21wb25lbnQ8U2NvcmVQYW5lbFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdncmlkIGdyaWQtY29scy1bMWZyXzFmcl0gZ2FwLTIgcC00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBTY29yZSBCb3ggKi99XG4gICAgICA8ZGl2IGNsYXNzPVwiYmctc3VyZmFjZSByb3VuZGVkLWxnIHAtNCBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBtaW4taC1bODBweF1cIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtMnhsIGZvbnQtbW9ubyBmb250LWJvbGQgdGV4dC1hY2NlbnQtcHJpbWFyeVwiPlxuICAgICAgICAgIHtwcm9wcy5zY29yZX1cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtc2Vjb25kYXJ5IG10LTFcIj5cbiAgICAgICAgICBTY29yZVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgXG4gICAgICB7LyogUmFuayBCb3ggKi99XG4gICAgICA8ZGl2IGNsYXNzPVwiYmctc3VyZmFjZSByb3VuZGVkLWxnIHAtNCBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBtaW4taC1bODBweF1cIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtMnhsIGZvbnQtbW9ubyBmb250LWJvbGQgdGV4dC1hY2NlbnQtc2Vjb25kYXJ5XCI+XG4gICAgICAgICAge3Byb3BzLnJhbmt9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+XG4gICAgICAgICAgUmFua1xuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBTaG93LCBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL0J1dHRvbic7XG5cbmV4cG9ydCB0eXBlIE9uYm9hcmRpbmdTdGVwID0gJ2Nvbm5lY3Qtd2FsbGV0JyB8ICdnZW5lcmF0aW5nLXRva2VuJyB8ICdjb21wbGV0ZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT25ib2FyZGluZ0Zsb3dQcm9wcyB7XG4gIHN0ZXA6IE9uYm9hcmRpbmdTdGVwO1xuICBlcnJvcj86IHN0cmluZyB8IG51bGw7XG4gIHdhbGxldEFkZHJlc3M/OiBzdHJpbmcgfCBudWxsO1xuICB0b2tlbj86IHN0cmluZyB8IG51bGw7XG4gIG9uQ29ubmVjdFdhbGxldDogKCkgPT4gdm9pZDtcbiAgb25Vc2VUZXN0TW9kZTogKCkgPT4gdm9pZDtcbiAgb25Vc2VQcml2YXRlS2V5OiAocHJpdmF0ZUtleTogc3RyaW5nKSA9PiB2b2lkO1xuICBvbkNvbXBsZXRlOiAoKSA9PiB2b2lkO1xuICBpc0Nvbm5lY3Rpbmc/OiBib29sZWFuO1xuICBpc0dlbmVyYXRpbmc/OiBib29sZWFuO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IE9uYm9hcmRpbmdGbG93OiBDb21wb25lbnQ8T25ib2FyZGluZ0Zsb3dQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW3Nob3dUZXN0T3B0aW9uLCBzZXRTaG93VGVzdE9wdGlvbl0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbc2hvd1ByaXZhdGVLZXlJbnB1dCwgc2V0U2hvd1ByaXZhdGVLZXlJbnB1dF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbcHJpdmF0ZUtleSwgc2V0UHJpdmF0ZUtleV0gPSBjcmVhdGVTaWduYWwoJycpO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAnbWluLWgtc2NyZWVuIGJnLWdyYWRpZW50LXRvLWJyIGZyb20tZ3JheS05MDAgdG8tYmxhY2sgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXInLFxuICAgICAgcHJvcHMuY2xhc3NcbiAgICApfT5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy0yeGwgdy1mdWxsIHAtMTJcIj5cbiAgICAgICAgey8qIExvZ28vSGVhZGVyICovfVxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgbWItMTJcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC04eGwgbWItNlwiPvCfjqQ8L2Rpdj5cbiAgICAgICAgICA8aDEgY2xhc3M9XCJ0ZXh0LTZ4bCBmb250LWJvbGQgdGV4dC13aGl0ZSBtYi00XCI+XG4gICAgICAgICAgICBTY2FybGV0dCBLYXJhb2tlXG4gICAgICAgICAgPC9oMT5cbiAgICAgICAgICA8cCBjbGFzcz1cInRleHQteGwgdGV4dC1ncmF5LTQwMFwiPlxuICAgICAgICAgICAgQUktcG93ZXJlZCBrYXJhb2tlIGZvciBTb3VuZENsb3VkXG4gICAgICAgICAgPC9wPlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICB7LyogUHJvZ3Jlc3MgRG90cyAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgganVzdGlmeS1jZW50ZXIgbWItMTJcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBnYXAtM1wiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICd3LTMgaC0zIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICAgICAgICBwcm9wcy5zdGVwID09PSAnY29ubmVjdC13YWxsZXQnIFxuICAgICAgICAgICAgICAgID8gJ2JnLXB1cnBsZS01MDAgdy0xMicgXG4gICAgICAgICAgICAgICAgOiBwcm9wcy53YWxsZXRBZGRyZXNzIFxuICAgICAgICAgICAgICAgICAgPyAnYmctZ3JlZW4tNTAwJyBcbiAgICAgICAgICAgICAgICAgIDogJ2JnLWdyYXktNjAwJ1xuICAgICAgICAgICAgKX0gLz5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAndy0zIGgtMyByb3VuZGVkLWZ1bGwgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgICAgICAgcHJvcHMuc3RlcCA9PT0gJ2dlbmVyYXRpbmctdG9rZW4nIFxuICAgICAgICAgICAgICAgID8gJ2JnLXB1cnBsZS01MDAgdy0xMicgXG4gICAgICAgICAgICAgICAgOiBwcm9wcy50b2tlbiBcbiAgICAgICAgICAgICAgICAgID8gJ2JnLWdyZWVuLTUwMCcgXG4gICAgICAgICAgICAgICAgICA6ICdiZy1ncmF5LTYwMCdcbiAgICAgICAgICAgICl9IC8+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3ctMyBoLTMgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgICAgICAgIHByb3BzLnN0ZXAgPT09ICdjb21wbGV0ZScgXG4gICAgICAgICAgICAgICAgPyAnYmctZ3JlZW4tNTAwIHctMTInIFxuICAgICAgICAgICAgICAgIDogJ2JnLWdyYXktNjAwJ1xuICAgICAgICAgICAgKX0gLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgey8qIEVycm9yIERpc3BsYXkgKi99XG4gICAgICAgIDxTaG93IHdoZW49e3Byb3BzLmVycm9yfT5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwibWItOCBwLTYgYmctcmVkLTkwMC8yMCBib3JkZXIgYm9yZGVyLXJlZC04MDAgcm91bmRlZC14bFwiPlxuICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXJlZC00MDAgdGV4dC1jZW50ZXIgdGV4dC1sZ1wiPntwcm9wcy5lcnJvcn08L3A+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvU2hvdz5cblxuICAgICAgICB7LyogQ29udGVudCAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNlwiPlxuICAgICAgICAgIHsvKiBDb25uZWN0IFdhbGxldCBTdGVwICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnN0ZXAgPT09ICdjb25uZWN0LXdhbGxldCd9PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIHNwYWNlLXktOFwiPlxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQtNHhsIGZvbnQtc2VtaWJvbGQgdGV4dC13aGl0ZSBtYi00XCI+XG4gICAgICAgICAgICAgICAgICBDb25uZWN0IFlvdXIgV2FsbGV0XG4gICAgICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS00MDAgdGV4dC1sZyBtYXgtdy1tZCBteC1hdXRvXCI+XG4gICAgICAgICAgICAgICAgICBDb25uZWN0IHlvdXIgd2FsbGV0IHRvIGdldCBzdGFydGVkXG4gICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS00IG1heC13LW1kIG14LWF1dG9cIj5cbiAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNvbm5lY3RXYWxsZXR9XG4gICAgICAgICAgICAgICAgICBkaXNhYmxlZD17cHJvcHMuaXNDb25uZWN0aW5nfVxuICAgICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTYgdGV4dC1sZ1wiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAge3Byb3BzLmlzQ29ubmVjdGluZyA/IChcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidy00IGgtNCBib3JkZXItMiBib3JkZXItY3VycmVudCBib3JkZXItci10cmFuc3BhcmVudCByb3VuZGVkLWZ1bGwgYW5pbWF0ZS1zcGluXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICBDb25uZWN0aW5nLi4uXG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj7wn6aKPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgIENvbm5lY3Qgd2l0aCBNZXRhTWFza1xuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuXG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17IXNob3dUZXN0T3B0aW9uKCkgJiYgIXNob3dQcml2YXRlS2V5SW5wdXQoKX0+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBnYXAtNCBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd1Rlc3RPcHRpb24odHJ1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIGhvdmVyOnRleHQtZ3JheS0zMDAgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgVXNlIGRlbW8gbW9kZVxuICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0ZXh0LWdyYXktNjAwXCI+fDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dQcml2YXRlS2V5SW5wdXQodHJ1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIGhvdmVyOnRleHQtZ3JheS0zMDAgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgVXNlIHByaXZhdGUga2V5XG4gICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgICAgICAgPFNob3cgd2hlbj17c2hvd1Rlc3RPcHRpb24oKX0+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicHQtNiBzcGFjZS15LTRcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJvcmRlci10IGJvcmRlci1ncmF5LTgwMCBwdC02XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25Vc2VUZXN0TW9kZX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJzZWNvbmRhcnlcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTRcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIENvbnRpbnVlIHdpdGggRGVtbyBNb2RlXG4gICAgICAgICAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd1Rlc3RPcHRpb24oZmFsc2UpfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIGhvdmVyOnRleHQtZ3JheS0zMDAgdHJhbnNpdGlvbi1jb2xvcnMgbXQtM1wiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgQmFja1xuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Nob3dQcml2YXRlS2V5SW5wdXQoKX0+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicHQtNiBzcGFjZS15LTRcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJvcmRlci10IGJvcmRlci1ncmF5LTgwMCBwdC02XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwicGFzc3dvcmRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e3ByaXZhdGVLZXkoKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uSW5wdXQ9eyhlKSA9PiBzZXRQcml2YXRlS2V5KGUuY3VycmVudFRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkVudGVyIHByaXZhdGUga2V5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTQgcHgtNCBiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQtbGcgdGV4dC13aGl0ZSBwbGFjZWhvbGRlci1ncmF5LTUwMCBmb2N1czpvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLXB1cnBsZS01MDBcIlxuICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gcHJvcHMub25Vc2VQcml2YXRlS2V5KHByaXZhdGVLZXkoKSl9XG4gICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17IXByaXZhdGVLZXkoKSB8fCBwcml2YXRlS2V5KCkubGVuZ3RoICE9PSA2NH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJzZWNvbmRhcnlcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTQgbXQtM1wiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgQ29ubmVjdCB3aXRoIFByaXZhdGUgS2V5XG4gICAgICAgICAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTaG93UHJpdmF0ZUtleUlucHV0KGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0UHJpdmF0ZUtleSgnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWdyYXktNTAwIGhvdmVyOnRleHQtZ3JheS0zMDAgdHJhbnNpdGlvbi1jb2xvcnMgbXQtM1wiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgQmFja1xuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgIHsvKiBHZW5lcmF0aW5nIFRva2VuIFN0ZXAgKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuc3RlcCA9PT0gJ2dlbmVyYXRpbmctdG9rZW4nfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBzcGFjZS15LThcIj5cbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTR4bCBmb250LXNlbWlib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgICAgICAgU2V0dGluZyBVcCBZb3VyIEFjY291bnRcbiAgICAgICAgICAgICAgICA8L2gyPlxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLndhbGxldEFkZHJlc3N9PlxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQtbGcgbWItM1wiPlxuICAgICAgICAgICAgICAgICAgICBDb25uZWN0ZWQgd2FsbGV0OlxuICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgPGNvZGUgY2xhc3M9XCJ0ZXh0LWxnIHRleHQtcHVycGxlLTQwMCBiZy1ncmF5LTgwMCBweC00IHB5LTIgcm91bmRlZC1sZyBmb250LW1vbm8gaW5saW5lLWJsb2NrXCI+XG4gICAgICAgICAgICAgICAgICAgIHtwcm9wcy53YWxsZXRBZGRyZXNzPy5zbGljZSgwLCA2KX0uLi57cHJvcHMud2FsbGV0QWRkcmVzcz8uc2xpY2UoLTQpfVxuICAgICAgICAgICAgICAgICAgPC9jb2RlPlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB5LTEyXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInctMjAgaC0yMCBib3JkZXItNCBib3JkZXItcHVycGxlLTUwMCBib3JkZXItdC10cmFuc3BhcmVudCByb3VuZGVkLWZ1bGwgYW5pbWF0ZS1zcGluIG14LWF1dG9cIiAvPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS00MDAgdGV4dC14bFwiPlxuICAgICAgICAgICAgICAgIHtwcm9wcy5pc0dlbmVyYXRpbmcgXG4gICAgICAgICAgICAgICAgICA/ICdHZW5lcmF0aW5nIHlvdXIgYWNjZXNzIHRva2VuLi4uJyBcbiAgICAgICAgICAgICAgICAgIDogJ1ZlcmlmeWluZyB5b3VyIGFjY291bnQuLi4nfVxuICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICB7LyogQ29tcGxldGUgU3RlcCAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zdGVwID09PSAnY29tcGxldGUnfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBzcGFjZS15LThcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtOHhsIG1iLTZcIj7wn46JPC9kaXY+XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxoMiBjbGFzcz1cInRleHQtNHhsIGZvbnQtc2VtaWJvbGQgdGV4dC13aGl0ZSBtYi00XCI+XG4gICAgICAgICAgICAgICAgICBZb3UncmUgQWxsIFNldCFcbiAgICAgICAgICAgICAgICA8L2gyPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTQwMCB0ZXh0LXhsIG1heC13LW1kIG14LWF1dG8gbWItOFwiPlxuICAgICAgICAgICAgICAgICAgWW91ciBhY2NvdW50IGlzIHJlYWR5LiBUaW1lIHRvIHNpbmchXG4gICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWF4LXctbWQgbXgtYXV0b1wiPlxuICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ29tcGxldGV9XG4gICAgICAgICAgICAgICAgICBzaXplPVwibGdcIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgaC0xNiB0ZXh0LWxnXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICBTdGFydCBTaW5naW5nISDwn5qAXG4gICAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBtdC02XCI+XG4gICAgICAgICAgICAgICAgTG9vayBmb3IgdGhlIGthcmFva2Ugd2lkZ2V0IG9uIGFueSBTb3VuZENsb3VkIHRyYWNrXG4gICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgRm9yLCBjcmVhdGVFZmZlY3QsIGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTHlyaWNMaW5lIHtcbiAgaWQ6IHN0cmluZztcbiAgdGV4dDogc3RyaW5nO1xuICBzdGFydFRpbWU6IG51bWJlcjtcbiAgZHVyYXRpb246IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMeXJpY3NEaXNwbGF5UHJvcHMge1xuICBseXJpY3M6IEx5cmljTGluZVtdO1xuICBjdXJyZW50VGltZT86IG51bWJlcjtcbiAgaXNQbGF5aW5nPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBMeXJpY3NEaXNwbGF5OiBDb21wb25lbnQ8THlyaWNzRGlzcGxheVByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbY3VycmVudExpbmVJbmRleCwgc2V0Q3VycmVudExpbmVJbmRleF0gPSBjcmVhdGVTaWduYWwoLTEpO1xuICBsZXQgY29udGFpbmVyUmVmOiBIVE1MRGl2RWxlbWVudCB8IHVuZGVmaW5lZDtcblxuICAvLyBGaW5kIGN1cnJlbnQgbGluZSBiYXNlZCBvbiB0aW1lXG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFwcm9wcy5jdXJyZW50VGltZSkge1xuICAgICAgc2V0Q3VycmVudExpbmVJbmRleCgtMSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGltZSA9IHByb3BzLmN1cnJlbnRUaW1lO1xuICAgIGNvbnN0IGluZGV4ID0gcHJvcHMubHlyaWNzLmZpbmRJbmRleCgobGluZSkgPT4ge1xuICAgICAgY29uc3QgZW5kVGltZSA9IGxpbmUuc3RhcnRUaW1lICsgbGluZS5kdXJhdGlvbjtcbiAgICAgIHJldHVybiB0aW1lID49IGxpbmUuc3RhcnRUaW1lICYmIHRpbWUgPCBlbmRUaW1lO1xuICAgIH0pO1xuXG4gICAgc2V0Q3VycmVudExpbmVJbmRleChpbmRleCk7XG4gIH0pO1xuXG4gIC8vIEF1dG8tc2Nyb2xsIHRvIGN1cnJlbnQgbGluZVxuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IGluZGV4ID0gY3VycmVudExpbmVJbmRleCgpO1xuICAgIGlmIChpbmRleCA9PT0gLTEgfHwgIWNvbnRhaW5lclJlZiB8fCAhcHJvcHMuaXNQbGF5aW5nKSByZXR1cm47XG5cbiAgICBjb25zdCBsaW5lRWxlbWVudHMgPSBjb250YWluZXJSZWYucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtbGluZS1pbmRleF0nKTtcbiAgICBjb25zdCBjdXJyZW50RWxlbWVudCA9IGxpbmVFbGVtZW50c1tpbmRleF0gYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICBpZiAoY3VycmVudEVsZW1lbnQpIHtcbiAgICAgIGNvbnN0IGNvbnRhaW5lckhlaWdodCA9IGNvbnRhaW5lclJlZi5jbGllbnRIZWlnaHQ7XG4gICAgICBjb25zdCBsaW5lVG9wID0gY3VycmVudEVsZW1lbnQub2Zmc2V0VG9wO1xuICAgICAgY29uc3QgbGluZUhlaWdodCA9IGN1cnJlbnRFbGVtZW50Lm9mZnNldEhlaWdodDtcblxuICAgICAgLy8gQ2VudGVyIHRoZSBjdXJyZW50IGxpbmVcbiAgICAgIGNvbnN0IHNjcm9sbFRvcCA9IGxpbmVUb3AgLSBjb250YWluZXJIZWlnaHQgLyAyICsgbGluZUhlaWdodCAvIDI7XG5cbiAgICAgIGNvbnRhaW5lclJlZi5zY3JvbGxUbyh7XG4gICAgICAgIHRvcDogc2Nyb2xsVG9wLFxuICAgICAgICBiZWhhdmlvcjogJ3Ntb290aCcsXG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgcmVmPXtjb250YWluZXJSZWZ9XG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdseXJpY3MtZGlzcGxheSBvdmVyZmxvdy15LWF1dG8gc2Nyb2xsLXNtb290aCcsXG4gICAgICAgICdoLWZ1bGwgcHgtNiBweS0xMicsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LThcIj5cbiAgICAgICAgPEZvciBlYWNoPXtwcm9wcy5seXJpY3N9PlxuICAgICAgICAgIHsobGluZSwgaW5kZXgpID0+IChcbiAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgZGF0YS1saW5lLWluZGV4PXtpbmRleCgpfVxuICAgICAgICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICAgJ3RleHQtY2VudGVyIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgICAgICAgICAgJ3RleHQtMnhsIGxlYWRpbmctcmVsYXhlZCcsXG4gICAgICAgICAgICAgICAgaW5kZXgoKSA9PT0gY3VycmVudExpbmVJbmRleCgpXG4gICAgICAgICAgICAgICAgICA/ICd0ZXh0LXByaW1hcnkgZm9udC1zZW1pYm9sZCBzY2FsZS0xMTAnXG4gICAgICAgICAgICAgICAgICA6ICd0ZXh0LXNlY29uZGFyeSBvcGFjaXR5LTYwJ1xuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7bGluZS50ZXh0fVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9Gb3I+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBLYXJhb2tlSGVhZGVyUHJvcHMge1xuICBzb25nVGl0bGU6IHN0cmluZztcbiAgYXJ0aXN0OiBzdHJpbmc7XG4gIG9uQmFjaz86ICgpID0+IHZvaWQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5jb25zdCBDaGV2cm9uTGVmdCA9ICgpID0+IChcbiAgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgY2xhc3M9XCJ3LTYgaC02XCI+XG4gICAgPHBhdGggc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIgZD1cIk0xNSAxOWwtNy03IDctN1wiIC8+XG4gIDwvc3ZnPlxuKTtcblxuZXhwb3J0IGNvbnN0IEthcmFva2VIZWFkZXI6IENvbXBvbmVudDxLYXJhb2tlSGVhZGVyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ3JlbGF0aXZlIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHAtNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogQmFjayBidXR0b24gLSBhYnNvbHV0ZSBwb3NpdGlvbmVkICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkJhY2t9XG4gICAgICAgIGNsYXNzPVwiYWJzb2x1dGUgbGVmdC00IHAtMiAtbS0yIHRleHQtc2Vjb25kYXJ5IGhvdmVyOnRleHQtcHJpbWFyeSB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgIGFyaWEtbGFiZWw9XCJHbyBiYWNrXCJcbiAgICAgID5cbiAgICAgICAgPENoZXZyb25MZWZ0IC8+XG4gICAgICA8L2J1dHRvbj5cbiAgICAgIFxuICAgICAgey8qIFNvbmcgaW5mbyAtIGNlbnRlcmVkICovfVxuICAgICAgPGgxIGNsYXNzPVwidGV4dC1iYXNlIGZvbnQtbWVkaXVtIHRleHQtcHJpbWFyeSB0ZXh0LWNlbnRlciBweC0xMiB0cnVuY2F0ZSBtYXgtdy1mdWxsXCI+XG4gICAgICAgIHtwcm9wcy5zb25nVGl0bGV9IC0ge3Byb3BzLmFydGlzdH1cbiAgICAgIDwvaDE+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IEZvciB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGVhZGVyYm9hcmRFbnRyeSB7XG4gIHJhbms6IG51bWJlcjtcbiAgdXNlcm5hbWU6IHN0cmluZztcbiAgc2NvcmU6IG51bWJlcjtcbiAgaXNDdXJyZW50VXNlcj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGVhZGVyYm9hcmRQYW5lbFByb3BzIHtcbiAgZW50cmllczogTGVhZGVyYm9hcmRFbnRyeVtdO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IExlYWRlcmJvYXJkUGFuZWw6IENvbXBvbmVudDxMZWFkZXJib2FyZFBhbmVsUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgZ2FwLTIgcC00JywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIDxGb3IgZWFjaD17cHJvcHMuZW50cmllc30+XG4gICAgICAgIHsoZW50cnkpID0+IChcbiAgICAgICAgICA8ZGl2IFxuICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAnZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgcHgtMyBweS0yIHJvdW5kZWQtbGcgdHJhbnNpdGlvbi1jb2xvcnMnLFxuICAgICAgICAgICAgICBlbnRyeS5pc0N1cnJlbnRVc2VyIFxuICAgICAgICAgICAgICAgID8gJ2JnLWFjY2VudC1wcmltYXJ5LzEwIGJvcmRlciBib3JkZXItYWNjZW50LXByaW1hcnkvMjAnIFxuICAgICAgICAgICAgICAgIDogJ2JnLXN1cmZhY2UgaG92ZXI6Ymctc3VyZmFjZS1ob3ZlcidcbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgPHNwYW4gXG4gICAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgICAndy04IHRleHQtY2VudGVyIGZvbnQtbW9ubyBmb250LWJvbGQnLFxuICAgICAgICAgICAgICAgIGVudHJ5LnJhbmsgPD0gMyA/ICd0ZXh0LWFjY2VudC1wcmltYXJ5JyA6ICd0ZXh0LXNlY29uZGFyeSdcbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgI3tlbnRyeS5yYW5rfVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAnZmxleC0xIHRydW5jYXRlJyxcbiAgICAgICAgICAgICAgZW50cnkuaXNDdXJyZW50VXNlciA/ICd0ZXh0LWFjY2VudC1wcmltYXJ5IGZvbnQtbWVkaXVtJyA6ICd0ZXh0LXByaW1hcnknXG4gICAgICAgICAgICApfT5cbiAgICAgICAgICAgICAge2VudHJ5LnVzZXJuYW1lfVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAnZm9udC1tb25vIGZvbnQtYm9sZCcsXG4gICAgICAgICAgICAgIGVudHJ5LmlzQ3VycmVudFVzZXIgPyAndGV4dC1hY2NlbnQtcHJpbWFyeScgOiAndGV4dC1wcmltYXJ5J1xuICAgICAgICAgICAgKX0+XG4gICAgICAgICAgICAgIHtlbnRyeS5zY29yZS50b0xvY2FsZVN0cmluZygpfVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApfVxuICAgICAgPC9Gb3I+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IGNyZWF0ZVNpZ25hbCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCB0eXBlIFBsYXliYWNrU3BlZWQgPSAnMXgnIHwgJzAuNzV4JyB8ICcwLjV4JztcblxuZXhwb3J0IGludGVyZmFjZSBTcGxpdEJ1dHRvblByb3BzIHtcbiAgb25TdGFydD86ICgpID0+IHZvaWQ7XG4gIG9uU3BlZWRDaGFuZ2U/OiAoc3BlZWQ6IFBsYXliYWNrU3BlZWQpID0+IHZvaWQ7XG4gIGRpc2FibGVkPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmNvbnN0IHNwZWVkczogUGxheWJhY2tTcGVlZFtdID0gWycxeCcsICcwLjc1eCcsICcwLjV4J107XG5cbmV4cG9ydCBjb25zdCBTcGxpdEJ1dHRvbjogQ29tcG9uZW50PFNwbGl0QnV0dG9uUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtjdXJyZW50U3BlZWRJbmRleCwgc2V0Q3VycmVudFNwZWVkSW5kZXhdID0gY3JlYXRlU2lnbmFsKDApO1xuICBcbiAgY29uc3QgY3VycmVudFNwZWVkID0gKCkgPT4gc3BlZWRzW2N1cnJlbnRTcGVlZEluZGV4KCldO1xuICBcbiAgY29uc3QgY3ljbGVTcGVlZCA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBjb25zdCBuZXh0SW5kZXggPSAoY3VycmVudFNwZWVkSW5kZXgoKSArIDEpICUgc3BlZWRzLmxlbmd0aDtcbiAgICBzZXRDdXJyZW50U3BlZWRJbmRleChuZXh0SW5kZXgpO1xuICAgIGNvbnN0IG5ld1NwZWVkID0gc3BlZWRzW25leHRJbmRleF07XG4gICAgaWYgKG5ld1NwZWVkKSB7XG4gICAgICBwcm9wcy5vblNwZWVkQ2hhbmdlPy4obmV3U3BlZWQpO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdyZWxhdGl2ZSBpbmxpbmUtZmxleCB3LWZ1bGwgcm91bmRlZC1sZyBvdmVyZmxvdy1oaWRkZW4nLFxuICAgICAgICAnYmctZ3JhZGllbnQtcHJpbWFyeSB0ZXh0LXdoaXRlIHNoYWRvdy1sZycsXG4gICAgICAgICd0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICB7LyogTWFpbiBidXR0b24gKi99XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uU3RhcnR9XG4gICAgICAgIGRpc2FibGVkPXtwcm9wcy5kaXNhYmxlZH1cbiAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICdmbGV4LTEgaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJlbGF0aXZlIG92ZXJmbG93LWhpZGRlbicsXG4gICAgICAgICAgJ2gtMTIgcHgtNiB0ZXh0LWxnIGZvbnQtbWVkaXVtJyxcbiAgICAgICAgICAnY3Vyc29yLXBvaW50ZXIgYm9yZGVyLW5vbmUgb3V0bGluZS1ub25lJyxcbiAgICAgICAgICAnZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICAgICdob3ZlcjpiZy13aGl0ZS8xMCBhY3RpdmU6Ymctd2hpdGUvMjAnXG4gICAgICAgICl9XG4gICAgICA+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwicmVsYXRpdmUgei0xMFwiPlN0YXJ0PC9zcGFuPlxuICAgICAgPC9idXR0b24+XG4gICAgICBcbiAgICAgIHsvKiBEaXZpZGVyICovfVxuICAgICAgPGRpdiBjbGFzcz1cInctcHggYmctYmxhY2svMjBcIiAvPlxuICAgICAgXG4gICAgICB7LyogU3BlZWQgYnV0dG9uICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtjeWNsZVNwZWVkfVxuICAgICAgICBkaXNhYmxlZD17cHJvcHMuZGlzYWJsZWR9XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJlbGF0aXZlJyxcbiAgICAgICAgICAndy0yMCB0ZXh0LWxnIGZvbnQtbWVkaXVtJyxcbiAgICAgICAgICAnY3Vyc29yLXBvaW50ZXIgYm9yZGVyLW5vbmUgb3V0bGluZS1ub25lJyxcbiAgICAgICAgICAnZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNTAnLFxuICAgICAgICAgICdob3ZlcjpiZy13aGl0ZS8xMCBhY3RpdmU6Ymctd2hpdGUvMjAnLFxuICAgICAgICAgICdhZnRlcjpjb250ZW50LVtcIlwiXSBhZnRlcjphYnNvbHV0ZSBhZnRlcjppbnNldC0wJyxcbiAgICAgICAgICAnYWZ0ZXI6YmctZ3JhZGllbnQtdG8tciBhZnRlcjpmcm9tLXRyYW5zcGFyZW50IGFmdGVyOnZpYS13aGl0ZS8yMCBhZnRlcjp0by10cmFuc3BhcmVudCcsXG4gICAgICAgICAgJ2FmdGVyOnRyYW5zbGF0ZS14LVstMjAwJV0gaG92ZXI6YWZ0ZXI6dHJhbnNsYXRlLXgtWzIwMCVdJyxcbiAgICAgICAgICAnYWZ0ZXI6dHJhbnNpdGlvbi10cmFuc2Zvcm0gYWZ0ZXI6ZHVyYXRpb24tNzAwJ1xuICAgICAgICApfVxuICAgICAgICBhcmlhLWxhYmVsPVwiQ2hhbmdlIHBsYXliYWNrIHNwZWVkXCJcbiAgICAgID5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJyZWxhdGl2ZSB6LTEwXCI+e2N1cnJlbnRTcGVlZCgpfTwvc3Bhbj5cbiAgICAgIDwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwsIFNob3csIGNyZWF0ZUNvbnRleHQsIHVzZUNvbnRleHQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCwgSlNYLCBQYXJlbnRDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBUYWIge1xuICBpZDogc3RyaW5nO1xuICBsYWJlbDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNQcm9wcyB7XG4gIHRhYnM6IFRhYltdO1xuICBkZWZhdWx0VGFiPzogc3RyaW5nO1xuICBvblRhYkNoYW5nZT86ICh0YWJJZDogc3RyaW5nKSA9PiB2b2lkO1xuICBjaGlsZHJlbjogSlNYLkVsZW1lbnQ7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNMaXN0UHJvcHMge1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNUcmlnZ2VyUHJvcHMge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYnNDb250ZW50UHJvcHMge1xuICB2YWx1ZTogc3RyaW5nO1xuICBjbGFzcz86IHN0cmluZztcbiAgY2hpbGRyZW46IEpTWC5FbGVtZW50O1xufVxuXG4vLyBDb250ZXh0IGZvciB0YWJzIHN0YXRlXG5pbnRlcmZhY2UgVGFic0NvbnRleHRWYWx1ZSB7XG4gIGFjdGl2ZVRhYjogKCkgPT4gc3RyaW5nO1xuICBzZXRBY3RpdmVUYWI6IChpZDogc3RyaW5nKSA9PiB2b2lkO1xufVxuXG5jb25zdCBUYWJzQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8VGFic0NvbnRleHRWYWx1ZT4oKTtcblxuZXhwb3J0IGNvbnN0IFRhYnM6IFBhcmVudENvbXBvbmVudDxUYWJzUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFthY3RpdmVUYWIsIHNldEFjdGl2ZVRhYl0gPSBjcmVhdGVTaWduYWwocHJvcHMuZGVmYXVsdFRhYiB8fCBwcm9wcy50YWJzWzBdPy5pZCB8fCAnJyk7XG4gIFxuICBjb25zb2xlLmxvZygnW1RhYnNdIEluaXRpYWxpemluZyB3aXRoOicsIHtcbiAgICBkZWZhdWx0VGFiOiBwcm9wcy5kZWZhdWx0VGFiLFxuICAgIGZpcnN0VGFiSWQ6IHByb3BzLnRhYnNbMF0/LmlkLFxuICAgIGFjdGl2ZVRhYjogYWN0aXZlVGFiKClcbiAgfSk7XG4gIFxuICBjb25zdCBoYW5kbGVUYWJDaGFuZ2UgPSAoaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbVGFic10gVGFiIGNoYW5nZWQgdG86JywgaWQpO1xuICAgIHNldEFjdGl2ZVRhYihpZCk7XG4gICAgcHJvcHMub25UYWJDaGFuZ2U/LihpZCk7XG4gIH07XG5cbiAgY29uc3QgY29udGV4dFZhbHVlOiBUYWJzQ29udGV4dFZhbHVlID0ge1xuICAgIGFjdGl2ZVRhYixcbiAgICBzZXRBY3RpdmVUYWI6IGhhbmRsZVRhYkNoYW5nZVxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPFRhYnNDb250ZXh0LlByb3ZpZGVyIHZhbHVlPXtjb250ZXh0VmFsdWV9PlxuICAgICAgPGRpdiBjbGFzcz17Y24oJ3ctZnVsbCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICAgIDwvZGl2PlxuICAgIDwvVGFic0NvbnRleHQuUHJvdmlkZXI+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgVGFic0xpc3Q6IENvbXBvbmVudDxUYWJzTGlzdFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdpbmxpbmUtZmxleCBoLTEwIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLW1kIGJnLXN1cmZhY2UgcC0xIHRleHQtc2Vjb25kYXJ5JyxcbiAgICAgICAgJ3ctZnVsbCcsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICA8L2Rpdj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBUYWJzVHJpZ2dlcjogQ29tcG9uZW50PFRhYnNUcmlnZ2VyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IGNvbnRleHQgPSB1c2VDb250ZXh0KFRhYnNDb250ZXh0KTtcbiAgaWYgKCFjb250ZXh0KSB7XG4gICAgY29uc29sZS5lcnJvcignW1RhYnNUcmlnZ2VyXSBObyBUYWJzQ29udGV4dCBmb3VuZC4gVGFic1RyaWdnZXIgbXVzdCBiZSB1c2VkIHdpdGhpbiBUYWJzIGNvbXBvbmVudC4nKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBcbiAgY29uc3QgaXNBY3RpdmUgPSAoKSA9PiBjb250ZXh0LmFjdGl2ZVRhYigpID09PSBwcm9wcy52YWx1ZTtcblxuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIG9uQ2xpY2s9eygpID0+IGNvbnRleHQuc2V0QWN0aXZlVGFiKHByb3BzLnZhbHVlKX1cbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2lubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB3aGl0ZXNwYWNlLW5vd3JhcCByb3VuZGVkLXNtIHB4LTMgcHktMS41JyxcbiAgICAgICAgJ3RleHQtc20gZm9udC1tZWRpdW0gcmluZy1vZmZzZXQtYmFzZSB0cmFuc2l0aW9uLWFsbCcsXG4gICAgICAgICdmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZSBmb2N1cy12aXNpYmxlOnJpbmctMiBmb2N1cy12aXNpYmxlOnJpbmctYWNjZW50LXByaW1hcnkgZm9jdXMtdmlzaWJsZTpyaW5nLW9mZnNldC0yJyxcbiAgICAgICAgJ2Rpc2FibGVkOnBvaW50ZXItZXZlbnRzLW5vbmUgZGlzYWJsZWQ6b3BhY2l0eS01MCcsXG4gICAgICAgICdmbGV4LTEnLFxuICAgICAgICBpc0FjdGl2ZSgpXG4gICAgICAgICAgPyAnYmctYmFzZSB0ZXh0LXByaW1hcnkgc2hhZG93LXNtJ1xuICAgICAgICAgIDogJ3RleHQtc2Vjb25kYXJ5IGhvdmVyOnRleHQtcHJpbWFyeScsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICA8L2J1dHRvbj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBUYWJzQ29udGVudDogQ29tcG9uZW50PFRhYnNDb250ZW50UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IGNvbnRleHQgPSB1c2VDb250ZXh0KFRhYnNDb250ZXh0KTtcbiAgaWYgKCFjb250ZXh0KSB7XG4gICAgY29uc29sZS5lcnJvcignW1RhYnNDb250ZW50XSBObyBUYWJzQ29udGV4dCBmb3VuZC4gVGFic0NvbnRlbnQgbXVzdCBiZSB1c2VkIHdpdGhpbiBUYWJzIGNvbXBvbmVudC4nKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBcbiAgY29uc3QgaXNBY3RpdmUgPSBjb250ZXh0LmFjdGl2ZVRhYigpID09PSBwcm9wcy52YWx1ZTtcbiAgY29uc29sZS5sb2coJ1tUYWJzQ29udGVudF0gUmVuZGVyaW5nOicsIHtcbiAgICB2YWx1ZTogcHJvcHMudmFsdWUsXG4gICAgYWN0aXZlVGFiOiBjb250ZXh0LmFjdGl2ZVRhYigpLFxuICAgIGlzQWN0aXZlXG4gIH0pO1xuICBcbiAgcmV0dXJuIChcbiAgICA8U2hvdyB3aGVuPXtpc0FjdGl2ZX0+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnbXQtMiByaW5nLW9mZnNldC1iYXNlJyxcbiAgICAgICAgICAnZm9jdXMtdmlzaWJsZTpvdXRsaW5lLW5vbmUgZm9jdXMtdmlzaWJsZTpyaW5nLTIgZm9jdXMtdmlzaWJsZTpyaW5nLWFjY2VudC1wcmltYXJ5IGZvY3VzLXZpc2libGU6cmluZy1vZmZzZXQtMicsXG4gICAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICAgKX1cbiAgICAgID5cbiAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgPC9kaXY+XG4gICAgPC9TaG93PlxuICApO1xufTsiLCJpbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuaW1wb3J0IHsgU2NvcmVQYW5lbCB9IGZyb20gJy4uLy4uL2Rpc3BsYXkvU2NvcmVQYW5lbCc7XG5pbXBvcnQgeyBMeXJpY3NEaXNwbGF5LCB0eXBlIEx5cmljTGluZSB9IGZyb20gJy4uL0x5cmljc0Rpc3BsYXknO1xuaW1wb3J0IHsgTGVhZGVyYm9hcmRQYW5lbCwgdHlwZSBMZWFkZXJib2FyZEVudHJ5IH0gZnJvbSAnLi4vTGVhZGVyYm9hcmRQYW5lbCc7XG5pbXBvcnQgeyBTcGxpdEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5pbXBvcnQgdHlwZSB7IFBsYXliYWNrU3BlZWQgfSBmcm9tICcuLi8uLi9jb21tb24vU3BsaXRCdXR0b24nO1xuaW1wb3J0IHsgVGFicywgVGFic0xpc3QsIFRhYnNUcmlnZ2VyLCBUYWJzQ29udGVudCB9IGZyb20gJy4uLy4uL2NvbW1vbi9UYWJzJztcblxuZXhwb3J0IGludGVyZmFjZSBFeHRlbnNpb25LYXJhb2tlVmlld1Byb3BzIHtcbiAgLy8gU2NvcmVzXG4gIHNjb3JlOiBudW1iZXI7XG4gIHJhbms6IG51bWJlcjtcbiAgXG4gIC8vIEx5cmljc1xuICBseXJpY3M6IEx5cmljTGluZVtdO1xuICBjdXJyZW50VGltZT86IG51bWJlcjtcbiAgXG4gIC8vIExlYWRlcmJvYXJkXG4gIGxlYWRlcmJvYXJkOiBMZWFkZXJib2FyZEVudHJ5W107XG4gIFxuICAvLyBTdGF0ZVxuICBpc1BsYXlpbmc/OiBib29sZWFuO1xuICBvblN0YXJ0PzogKCkgPT4gdm9pZDtcbiAgb25TcGVlZENoYW5nZT86IChzcGVlZDogUGxheWJhY2tTcGVlZCkgPT4gdm9pZDtcbiAgXG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgRXh0ZW5zaW9uS2FyYW9rZVZpZXc6IENvbXBvbmVudDxFeHRlbnNpb25LYXJhb2tlVmlld1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zb2xlLmxvZygnW0V4dGVuc2lvbkthcmFva2VWaWV3XSBSZW5kZXJpbmcgd2l0aCBwcm9wczonLCB7XG4gICAgaXNQbGF5aW5nOiBwcm9wcy5pc1BsYXlpbmcsXG4gICAgaGFzT25TdGFydDogISFwcm9wcy5vblN0YXJ0LFxuICAgIGx5cmljc0xlbmd0aDogcHJvcHMubHlyaWNzPy5sZW5ndGhcbiAgfSk7XG4gIFxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sIGgtZnVsbCBiZy1iYXNlJywgcHJvcHMuY2xhc3MpfT5cbiAgICAgIHsvKiBTY29yZSBQYW5lbCAqL31cbiAgICAgIDxTY29yZVBhbmVsXG4gICAgICAgIHNjb3JlPXtwcm9wcy5zY29yZX1cbiAgICAgICAgcmFuaz17cHJvcHMucmFua31cbiAgICAgIC8+XG5cbiAgICAgIHsvKiBUYWJzIGFuZCBjb250ZW50ICovfVxuICAgICAgPFRhYnMgXG4gICAgICAgIHRhYnM9e1tcbiAgICAgICAgICB7IGlkOiAnbHlyaWNzJywgbGFiZWw6ICdMeXJpY3MnIH0sXG4gICAgICAgICAgeyBpZDogJ2xlYWRlcmJvYXJkJywgbGFiZWw6ICdMZWFkZXJib2FyZCcgfVxuICAgICAgICBdfVxuICAgICAgICBkZWZhdWx0VGFiPVwibHlyaWNzXCJcbiAgICAgICAgY2xhc3M9XCJmbGV4LTEgZmxleCBmbGV4LWNvbCBvdmVyZmxvdy1oaWRkZW5cIlxuICAgICAgPlxuICAgICAgICA8ZGl2IGNsYXNzPVwicHgtNFwiPlxuICAgICAgICAgIDxUYWJzTGlzdD5cbiAgICAgICAgICAgIDxUYWJzVHJpZ2dlciB2YWx1ZT1cImx5cmljc1wiPkx5cmljczwvVGFic1RyaWdnZXI+XG4gICAgICAgICAgICA8VGFic1RyaWdnZXIgdmFsdWU9XCJsZWFkZXJib2FyZFwiPkxlYWRlcmJvYXJkPC9UYWJzVHJpZ2dlcj5cbiAgICAgICAgICA8L1RhYnNMaXN0PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgXG4gICAgICAgIDxUYWJzQ29udGVudCB2YWx1ZT1cImx5cmljc1wiIGNsYXNzPVwiZmxleC0xIGZsZXggZmxleC1jb2wgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXgtMSBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICAgIDxMeXJpY3NEaXNwbGF5XG4gICAgICAgICAgICAgIGx5cmljcz17cHJvcHMubHlyaWNzfVxuICAgICAgICAgICAgICBjdXJyZW50VGltZT17cHJvcHMuY3VycmVudFRpbWV9XG4gICAgICAgICAgICAgIGlzUGxheWluZz17cHJvcHMuaXNQbGF5aW5nfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICBcbiAgICAgICAgICB7LyogRm9vdGVyIHdpdGggc3RhcnQgYnV0dG9uICovfVxuICAgICAgICAgIHtjb25zb2xlLmxvZygnW0V4dGVuc2lvbkthcmFva2VWaWV3XSBTdGFydCBidXR0b24gY2hlY2s6Jywge1xuICAgICAgICAgICAgaXNQbGF5aW5nOiBwcm9wcy5pc1BsYXlpbmcsXG4gICAgICAgICAgICBub3RQbGF5aW5nOiAhcHJvcHMuaXNQbGF5aW5nLFxuICAgICAgICAgICAgaGFzT25TdGFydDogISFwcm9wcy5vblN0YXJ0LFxuICAgICAgICAgICAgc2hvdWxkU2hvd0J1dHRvbjogIXByb3BzLmlzUGxheWluZyAmJiBwcm9wcy5vblN0YXJ0XG4gICAgICAgICAgfSl9XG4gICAgICAgICAgeyFwcm9wcy5pc1BsYXlpbmcgJiYgcHJvcHMub25TdGFydCAmJiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwicC00IGJnLXN1cmZhY2UgYm9yZGVyLXQgYm9yZGVyLXN1YnRsZVwiPlxuICAgICAgICAgICAgICA8U3BsaXRCdXR0b25cbiAgICAgICAgICAgICAgICBvblN0YXJ0PXtwcm9wcy5vblN0YXJ0fVxuICAgICAgICAgICAgICAgIG9uU3BlZWRDaGFuZ2U9e3Byb3BzLm9uU3BlZWRDaGFuZ2V9XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApfVxuICAgICAgICA8L1RhYnNDb250ZW50PlxuICAgICAgICBcbiAgICAgICAgPFRhYnNDb250ZW50IHZhbHVlPVwibGVhZGVyYm9hcmRcIiBjbGFzcz1cImZsZXgtMSBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwib3ZlcmZsb3cteS1hdXRvIGgtZnVsbFwiPlxuICAgICAgICAgICAgPExlYWRlcmJvYXJkUGFuZWwgZW50cmllcz17cHJvcHMubGVhZGVyYm9hcmR9IC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvVGFic0NvbnRlbnQ+XG4gICAgICA8L1RhYnM+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1pbmltaXplZEthcmFva2VQcm9wcyB7XG4gIG9uQ2xpY2s6ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBNaW5pbWl6ZWRLYXJhb2tlOiBDb21wb25lbnQ8TWluaW1pemVkS2FyYW9rZVByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uQ2xpY2t9XG4gICAgICBzdHlsZT17e1xuICAgICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgICAgYm90dG9tOiAnMjRweCcsXG4gICAgICAgIHJpZ2h0OiAnMjRweCcsXG4gICAgICAgIHdpZHRoOiAnODBweCcsXG4gICAgICAgIGhlaWdodDogJzgwcHgnLFxuICAgICAgICAnYm9yZGVyLXJhZGl1cyc6ICc1MCUnLFxuICAgICAgICBiYWNrZ3JvdW5kOiAnbGluZWFyLWdyYWRpZW50KDEzNWRlZywgI0ZGMDA2RSAwJSwgI0MxMzU4NCAxMDAlKScsXG4gICAgICAgICdib3gtc2hhZG93JzogJzAgOHB4IDMycHggcmdiYSgwLCAwLCAwLCAwLjMpJyxcbiAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxuICAgICAgICAnYWxpZ24taXRlbXMnOiAnY2VudGVyJyxcbiAgICAgICAgJ2p1c3RpZnktY29udGVudCc6ICdjZW50ZXInLFxuICAgICAgICBvdmVyZmxvdzogJ2hpZGRlbicsXG4gICAgICAgIGN1cnNvcjogJ3BvaW50ZXInLFxuICAgICAgICAnei1pbmRleCc6ICc5OTk5OScsXG4gICAgICAgIGJvcmRlcjogJ25vbmUnLFxuICAgICAgICB0cmFuc2l0aW9uOiAndHJhbnNmb3JtIDAuMnMgZWFzZScsXG4gICAgICB9fVxuICAgICAgb25Nb3VzZUVudGVyPXsoZSkgPT4ge1xuICAgICAgICBlLmN1cnJlbnRUYXJnZXQuc3R5bGUudHJhbnNmb3JtID0gJ3NjYWxlKDEuMSknO1xuICAgICAgfX1cbiAgICAgIG9uTW91c2VMZWF2ZT17KGUpID0+IHtcbiAgICAgICAgZS5jdXJyZW50VGFyZ2V0LnN0eWxlLnRyYW5zZm9ybSA9ICdzY2FsZSgxKSc7XG4gICAgICB9fVxuICAgICAgYXJpYS1sYWJlbD1cIk9wZW4gS2FyYW9rZVwiXG4gICAgPlxuICAgICAgey8qIFBsYWNlIHlvdXIgMjAweDIwMCBpbWFnZSBoZXJlIGFzOiAqL31cbiAgICAgIHsvKiA8aW1nIHNyYz1cIi9wYXRoL3RvL3lvdXIvaW1hZ2UucG5nXCIgYWx0PVwiS2FyYW9rZVwiIHN0eWxlPVwid2lkdGg6IDEwMCU7IGhlaWdodDogMTAwJTsgb2JqZWN0LWZpdDogY292ZXI7XCIgLz4gKi99XG4gICAgICBcbiAgICAgIHsvKiBGb3Igbm93LCB1c2luZyBhIHBsYWNlaG9sZGVyIGljb24gKi99XG4gICAgICA8c3BhbiBzdHlsZT17eyAnZm9udC1zaXplJzogJzM2cHgnIH19PvCfjqQ8L3NwYW4+XG4gICAgPC9idXR0b24+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCBJY29uWFJlZ3VsYXIgZnJvbSAncGhvc3Bob3ItaWNvbnMtc29saWQvSWNvblhSZWd1bGFyJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByYWN0aWNlSGVhZGVyUHJvcHMge1xuICB0aXRsZT86IHN0cmluZztcbiAgb25FeGl0OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFByYWN0aWNlSGVhZGVyOiBDb21wb25lbnQ8UHJhY3RpY2VIZWFkZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8aGVhZGVyIGNsYXNzPXtjbignZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGgtMTQgcHgtNCBiZy10cmFuc3BhcmVudCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uRXhpdH1cbiAgICAgICAgY2xhc3M9XCJwLTIgLW1sLTIgcm91bmRlZC1mdWxsIGhvdmVyOmJnLWhpZ2hsaWdodCB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgIGFyaWEtbGFiZWw9XCJFeGl0IHByYWN0aWNlXCJcbiAgICAgID5cbiAgICAgICAgPEljb25YUmVndWxhciBjbGFzcz1cInRleHQtc2Vjb25kYXJ5IHctNiBoLTZcIiAvPlxuICAgICAgPC9idXR0b24+XG4gICAgICBcbiAgICAgIDxTaG93IHdoZW49e3Byb3BzLnRpdGxlfT5cbiAgICAgICAgPGgxIGNsYXNzPVwidGV4dC1sZyBmb250LXNlbWlib2xkIHRleHQtcHJpbWFyeSBhYnNvbHV0ZSBsZWZ0LTEvMiB0cmFuc2Zvcm0gLXRyYW5zbGF0ZS14LTEvMlwiPlxuICAgICAgICAgIHtwcm9wcy50aXRsZX1cbiAgICAgICAgPC9oMT5cbiAgICAgIDwvU2hvdz5cbiAgICAgIFxuICAgICAgey8qIFNwYWNlciB0byBiYWxhbmNlIHRoZSBsYXlvdXQgKi99XG4gICAgICA8ZGl2IGNsYXNzPVwidy0xMFwiIC8+XG4gICAgPC9oZWFkZXI+XG4gICk7XG59OyIsImV4cG9ydCBpbnRlcmZhY2UgVHJhY2tJbmZvIHtcbiAgdHJhY2tJZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBhcnRpc3Q6IHN0cmluZztcbiAgcGxhdGZvcm06ICdzb3VuZGNsb3VkJztcbiAgdXJsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFja0RldGVjdG9yIHtcbiAgLyoqXG4gICAqIERldGVjdCBjdXJyZW50IHRyYWNrIGZyb20gdGhlIHBhZ2UgKFNvdW5kQ2xvdWQgb25seSlcbiAgICovXG4gIGRldGVjdEN1cnJlbnRUcmFjaygpOiBUcmFja0luZm8gfCBudWxsIHtcbiAgICBjb25zdCB1cmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICBcbiAgICAvLyBPbmx5IHdvcmsgb24gc2MubWFpZC56b25lIChTb3VuZENsb3VkIHByb3h5KVxuICAgIGlmICh1cmwuaW5jbHVkZXMoJ3NjLm1haWQuem9uZScpKSB7XG4gICAgICByZXR1cm4gdGhpcy5kZXRlY3RTb3VuZENsb3VkVHJhY2soKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IHRyYWNrIGluZm8gZnJvbSBTb3VuZENsb3VkIChzYy5tYWlkLnpvbmUpXG4gICAqL1xuICBwcml2YXRlIGRldGVjdFNvdW5kQ2xvdWRUcmFjaygpOiBUcmFja0luZm8gfCBudWxsIHtcbiAgICB0cnkge1xuICAgICAgLy8gU291bmRDbG91ZCBVUkxzOiBzYy5tYWlkLnpvbmUvdXNlci90cmFjay1uYW1lXG4gICAgICBjb25zdCBwYXRoUGFydHMgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBpZiAocGF0aFBhcnRzLmxlbmd0aCA8IDIpIHJldHVybiBudWxsO1xuXG4gICAgICBjb25zdCBhcnRpc3QgPSBwYXRoUGFydHNbMF07XG4gICAgICBjb25zdCB0cmFja1NsdWcgPSBwYXRoUGFydHNbMV07XG4gICAgICBcbiAgICAgIC8vIFRyeSB0byBnZXQgYWN0dWFsIHRpdGxlIGZyb20gcGFnZSAoU291bmRDbG91ZCBzZWxlY3RvcnMpXG4gICAgICBjb25zdCB0aXRsZVNlbGVjdG9ycyA9IFtcbiAgICAgICAgJy5zb3VuZFRpdGxlX190aXRsZScsXG4gICAgICAgICcudHJhY2tJdGVtX190cmFja1RpdGxlJywgXG4gICAgICAgICdoMVtpdGVtcHJvcD1cIm5hbWVcIl0nLFxuICAgICAgICAnLnNvdW5kX19oZWFkZXIgaDEnLFxuICAgICAgICAnLnNjLXRleHQtaDQnLFxuICAgICAgICAnLnNjLXRleHQtcHJpbWFyeSdcbiAgICAgIF07XG5cbiAgICAgIGxldCB0aXRsZSA9ICcnO1xuICAgICAgZm9yIChjb25zdCBzZWxlY3RvciBvZiB0aXRsZVNlbGVjdG9ycykge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gICAgICAgIGlmIChlbGVtZW50ICYmIGVsZW1lbnQudGV4dENvbnRlbnQpIHtcbiAgICAgICAgICB0aXRsZSA9IGVsZW1lbnQudGV4dENvbnRlbnQudHJpbSgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEZhbGxiYWNrIHRvIHNsdWdcbiAgICAgIGlmICghdGl0bGUpIHtcbiAgICAgICAgdGl0bGUgPSB0cmFja1NsdWcucmVwbGFjZSgvLS9nLCAnICcpO1xuICAgICAgfVxuXG4gICAgICAvLyBDbGVhbiB1cCBhcnRpc3QgbmFtZVxuICAgICAgY29uc3QgY2xlYW5BcnRpc3QgPSBhcnRpc3QucmVwbGFjZSgvLS9nLCAnICcpLnJlcGxhY2UoL18vZywgJyAnKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHJhY2tJZDogYCR7YXJ0aXN0fS8ke3RyYWNrU2x1Z31gLFxuICAgICAgICB0aXRsZTogdGl0bGUsXG4gICAgICAgIGFydGlzdDogY2xlYW5BcnRpc3QsXG4gICAgICAgIHBsYXRmb3JtOiAnc291bmRjbG91ZCcsXG4gICAgICAgIHVybDogd2luZG93LmxvY2F0aW9uLmhyZWYsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbVHJhY2tEZXRlY3Rvcl0gRXJyb3IgZGV0ZWN0aW5nIFNvdW5kQ2xvdWQgdHJhY2s6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cblxuICAvKipcbiAgICogV2F0Y2ggZm9yIHBhZ2UgY2hhbmdlcyAoU291bmRDbG91ZCBpcyBhIFNQQSlcbiAgICovXG4gIHdhdGNoRm9yQ2hhbmdlcyhjYWxsYmFjazogKHRyYWNrOiBUcmFja0luZm8gfCBudWxsKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XG4gICAgbGV0IGN1cnJlbnRVcmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICBsZXQgY3VycmVudFRyYWNrID0gdGhpcy5kZXRlY3RDdXJyZW50VHJhY2soKTtcbiAgICBcbiAgICAvLyBJbml0aWFsIGRldGVjdGlvblxuICAgIGNhbGxiYWNrKGN1cnJlbnRUcmFjayk7XG5cbiAgICAvLyBXYXRjaCBmb3IgVVJMIGNoYW5nZXNcbiAgICBjb25zdCBjaGVja0ZvckNoYW5nZXMgPSAoKSA9PiB7XG4gICAgICBjb25zdCBuZXdVcmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICAgIGlmIChuZXdVcmwgIT09IGN1cnJlbnRVcmwpIHtcbiAgICAgICAgY3VycmVudFVybCA9IG5ld1VybDtcbiAgICAgICAgY29uc3QgbmV3VHJhY2sgPSB0aGlzLmRldGVjdEN1cnJlbnRUcmFjaygpO1xuICAgICAgICBcbiAgICAgICAgLy8gT25seSB0cmlnZ2VyIGNhbGxiYWNrIGlmIHRyYWNrIGFjdHVhbGx5IGNoYW5nZWRcbiAgICAgICAgY29uc3QgdHJhY2tDaGFuZ2VkID0gIWN1cnJlbnRUcmFjayB8fCAhbmV3VHJhY2sgfHwgXG4gICAgICAgICAgY3VycmVudFRyYWNrLnRyYWNrSWQgIT09IG5ld1RyYWNrLnRyYWNrSWQ7XG4gICAgICAgICAgXG4gICAgICAgIGlmICh0cmFja0NoYW5nZWQpIHtcbiAgICAgICAgICBjdXJyZW50VHJhY2sgPSBuZXdUcmFjaztcbiAgICAgICAgICBjYWxsYmFjayhuZXdUcmFjayk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gUG9sbCBmb3IgY2hhbmdlcyAoU1BBcyBkb24ndCBhbHdheXMgdHJpZ2dlciBwcm9wZXIgbmF2aWdhdGlvbiBldmVudHMpXG4gICAgY29uc3QgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChjaGVja0ZvckNoYW5nZXMsIDEwMDApO1xuXG4gICAgLy8gQWxzbyBsaXN0ZW4gZm9yIG5hdmlnYXRpb24gZXZlbnRzXG4gICAgY29uc3QgaGFuZGxlTmF2aWdhdGlvbiA9ICgpID0+IHtcbiAgICAgIHNldFRpbWVvdXQoY2hlY2tGb3JDaGFuZ2VzLCAxMDApOyAvLyBTbWFsbCBkZWxheSBmb3IgRE9NIHVwZGF0ZXNcbiAgICB9O1xuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgaGFuZGxlTmF2aWdhdGlvbik7XG4gICAgXG4gICAgLy8gTGlzdGVuIGZvciBwdXNoc3RhdGUvcmVwbGFjZXN0YXRlIChTb3VuZENsb3VkIHVzZXMgdGhlc2UpXG4gICAgY29uc3Qgb3JpZ2luYWxQdXNoU3RhdGUgPSBoaXN0b3J5LnB1c2hTdGF0ZTtcbiAgICBjb25zdCBvcmlnaW5hbFJlcGxhY2VTdGF0ZSA9IGhpc3RvcnkucmVwbGFjZVN0YXRlO1xuICAgIFxuICAgIGhpc3RvcnkucHVzaFN0YXRlID0gZnVuY3Rpb24oLi4uYXJncykge1xuICAgICAgb3JpZ2luYWxQdXNoU3RhdGUuYXBwbHkoaGlzdG9yeSwgYXJncyk7XG4gICAgICBoYW5kbGVOYXZpZ2F0aW9uKCk7XG4gICAgfTtcbiAgICBcbiAgICBoaXN0b3J5LnJlcGxhY2VTdGF0ZSA9IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICAgIG9yaWdpbmFsUmVwbGFjZVN0YXRlLmFwcGx5KGhpc3RvcnksIGFyZ3MpO1xuICAgICAgaGFuZGxlTmF2aWdhdGlvbigpO1xuICAgIH07XG5cbiAgICAvLyBSZXR1cm4gY2xlYW51cCBmdW5jdGlvblxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb3BzdGF0ZScsIGhhbmRsZU5hdmlnYXRpb24pO1xuICAgICAgaGlzdG9yeS5wdXNoU3RhdGUgPSBvcmlnaW5hbFB1c2hTdGF0ZTtcbiAgICAgIGhpc3RvcnkucmVwbGFjZVN0YXRlID0gb3JpZ2luYWxSZXBsYWNlU3RhdGU7XG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgdHJhY2tEZXRlY3RvciA9IG5ldyBUcmFja0RldGVjdG9yKCk7IiwiLy8gVXNpbmcgYnJvd3Nlci5zdG9yYWdlIEFQSSBkaXJlY3RseSBmb3Igc2ltcGxpY2l0eVxuaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gJ3d4dC9icm93c2VyJztcblxuLy8gSGVscGVyIHRvIGdldCBhdXRoIHRva2VuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0QXV0aFRva2VuKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuZ2V0KCdhdXRoVG9rZW4nKTtcbiAgcmV0dXJuIHJlc3VsdC5hdXRoVG9rZW4gfHwgbnVsbDtcbn1cblxuLy8gSGVscGVyIHRvIHNldCBhdXRoIHRva2VuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0QXV0aFRva2VuKHRva2VuOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnNldCh7IGF1dGhUb2tlbjogdG9rZW4gfSk7XG59XG5cbi8vIEhlbHBlciB0byBnZXQgaW5zdGFsbGF0aW9uIHN0YXRlXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0SW5zdGFsbGF0aW9uU3RhdGUoKTogUHJvbWlzZTx7XG4gIGNvbXBsZXRlZDogYm9vbGVhbjtcbiAgand0VmVyaWZpZWQ6IGJvb2xlYW47XG4gIHRpbWVzdGFtcD86IG51bWJlcjtcbn0+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLmdldCgnaW5zdGFsbGF0aW9uU3RhdGUnKTtcbiAgcmV0dXJuIHJlc3VsdC5pbnN0YWxsYXRpb25TdGF0ZSB8fCB7XG4gICAgY29tcGxldGVkOiBmYWxzZSxcbiAgICBqd3RWZXJpZmllZDogZmFsc2UsXG4gIH07XG59XG5cbi8vIEhlbHBlciB0byBzZXQgaW5zdGFsbGF0aW9uIHN0YXRlXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0SW5zdGFsbGF0aW9uU3RhdGUoc3RhdGU6IHtcbiAgY29tcGxldGVkOiBib29sZWFuO1xuICBqd3RWZXJpZmllZDogYm9vbGVhbjtcbiAgdGltZXN0YW1wPzogbnVtYmVyO1xufSk6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuc2V0KHsgaW5zdGFsbGF0aW9uU3RhdGU6IHN0YXRlIH0pO1xufVxuXG4vLyBIZWxwZXIgdG8gY2hlY2sgaWYgdXNlciBpcyBhdXRoZW50aWNhdGVkXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaXNBdXRoZW50aWNhdGVkKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBjb25zdCB0b2tlbiA9IGF3YWl0IGdldEF1dGhUb2tlbigpO1xuICByZXR1cm4gISF0b2tlbiAmJiB0b2tlbi5zdGFydHNXaXRoKCdzY2FybGV0dF8nKTtcbn1cblxuLy8gSGVscGVyIHRvIGNsZWFyIGF1dGggZGF0YVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNsZWFyQXV0aCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnJlbW92ZShbJ2F1dGhUb2tlbicsICdpbnN0YWxsYXRpb25TdGF0ZSddKTtcbn0iLCJleHBvcnQgaW50ZXJmYWNlIEthcmFva2VEYXRhIHtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgdHJhY2tfaWQ/OiBzdHJpbmc7XG4gIHRyYWNrSWQ/OiBzdHJpbmc7XG4gIGhhc19rYXJhb2tlPzogYm9vbGVhbjtcbiAgaGFzS2FyYW9rZT86IGJvb2xlYW47XG4gIHNvbmc/OiB7XG4gICAgaWQ6IHN0cmluZztcbiAgICB0aXRsZTogc3RyaW5nO1xuICAgIGFydGlzdDogc3RyaW5nO1xuICAgIGFsYnVtPzogc3RyaW5nO1xuICAgIGFydHdvcmtVcmw/OiBzdHJpbmc7XG4gICAgZHVyYXRpb24/OiBudW1iZXI7XG4gICAgZGlmZmljdWx0eTogJ2JlZ2lubmVyJyB8ICdpbnRlcm1lZGlhdGUnIHwgJ2FkdmFuY2VkJztcbiAgfTtcbiAgbHlyaWNzPzoge1xuICAgIHNvdXJjZTogc3RyaW5nO1xuICAgIHR5cGU6ICdzeW5jZWQnO1xuICAgIGxpbmVzOiBMeXJpY0xpbmVbXTtcbiAgICB0b3RhbExpbmVzOiBudW1iZXI7XG4gIH07XG4gIG1lc3NhZ2U/OiBzdHJpbmc7XG4gIGVycm9yPzogc3RyaW5nO1xuICBhcGlfY29ubmVjdGVkPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMeXJpY0xpbmUge1xuICBpZDogc3RyaW5nO1xuICB0ZXh0OiBzdHJpbmc7XG4gIHN0YXJ0VGltZTogbnVtYmVyO1xuICBkdXJhdGlvbjogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEthcmFva2VTZXNzaW9uIHtcbiAgaWQ6IHN0cmluZztcbiAgdHJhY2tJZDogc3RyaW5nO1xuICBzb25nVGl0bGU6IHN0cmluZztcbiAgc29uZ0FydGlzdDogc3RyaW5nO1xuICBzdGF0dXM6IHN0cmluZztcbiAgY3JlYXRlZEF0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBLYXJhb2tlQXBpU2VydmljZSB7XG4gIHByaXZhdGUgYmFzZVVybDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIC8vIFVzZSB0aGUgbG9jYWwgc2VydmVyIGVuZHBvaW50XG4gICAgdGhpcy5iYXNlVXJsID0gJ2h0dHA6Ly9sb2NhbGhvc3Q6ODc4Ny9hcGknO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBrYXJhb2tlIGRhdGEgZm9yIGEgdHJhY2sgSUQgKFlvdVR1YmUvU291bmRDbG91ZClcbiAgICovXG4gIGFzeW5jIGdldEthcmFva2VEYXRhKFxuICAgIHRyYWNrSWQ6IHN0cmluZywgXG4gICAgdGl0bGU/OiBzdHJpbmcsIFxuICAgIGFydGlzdD86IHN0cmluZ1xuICApOiBQcm9taXNlPEthcmFva2VEYXRhIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCk7XG4gICAgICBpZiAodGl0bGUpIHBhcmFtcy5zZXQoJ3RpdGxlJywgdGl0bGUpO1xuICAgICAgaWYgKGFydGlzdCkgcGFyYW1zLnNldCgnYXJ0aXN0JywgYXJ0aXN0KTtcbiAgICAgIFxuICAgICAgY29uc3QgdXJsID0gYCR7dGhpcy5iYXNlVXJsfS9rYXJhb2tlLyR7ZW5jb2RlVVJJQ29tcG9uZW50KHRyYWNrSWQpfSR7cGFyYW1zLnRvU3RyaW5nKCkgPyAnPycgKyBwYXJhbXMudG9TdHJpbmcoKSA6ICcnfWA7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUFwaV0gRmV0Y2hpbmcga2FyYW9rZSBkYXRhOicsIHVybCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIC8vIFJlbW92ZSBDb250ZW50LVR5cGUgaGVhZGVyIHRvIGF2b2lkIENPUlMgcHJlZmxpZ2h0XG4gICAgICAgIC8vIGhlYWRlcnM6IHtcbiAgICAgICAgLy8gICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAvLyB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBmZXRjaCBrYXJhb2tlIGRhdGE6JywgcmVzcG9uc2Uuc3RhdHVzKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VBcGldIFJlY2VpdmVkIGthcmFva2UgZGF0YTonLCBkYXRhKTtcbiAgICAgIFxuICAgICAgLy8gSWYgdGhlcmUncyBhbiBlcnJvciBidXQgd2UgZ290IGEgcmVzcG9uc2UsIGl0IG1lYW5zIEFQSSBpcyBjb25uZWN0ZWRcbiAgICAgIGlmIChkYXRhLmVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUFwaV0gU2VydmVyIGVycm9yIChidXQgQVBJIGlzIHJlYWNoYWJsZSk6JywgZGF0YS5lcnJvcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgaGFzX2thcmFva2U6IGZhbHNlLFxuICAgICAgICAgIGVycm9yOiBkYXRhLmVycm9yLFxuICAgICAgICAgIHRyYWNrX2lkOiB0cmFja0lkLFxuICAgICAgICAgIGFwaV9jb25uZWN0ZWQ6IHRydWVcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBFcnJvciBmZXRjaGluZyBrYXJhb2tlIGRhdGE6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IGEga2FyYW9rZSBzZXNzaW9uXG4gICAqL1xuICBhc3luYyBzdGFydFNlc3Npb24oXG4gICAgdHJhY2tJZDogc3RyaW5nLFxuICAgIHNvbmdEYXRhOiB7XG4gICAgICB0aXRsZTogc3RyaW5nO1xuICAgICAgYXJ0aXN0OiBzdHJpbmc7XG4gICAgICBhbGJ1bT86IHN0cmluZztcbiAgICAgIGR1cmF0aW9uPzogbnVtYmVyO1xuICAgIH1cbiAgKTogUHJvbWlzZTxLYXJhb2tlU2Vzc2lvbiB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHt0aGlzLmJhc2VVcmx9L2thcmFva2Uvc3RhcnRgLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAvLyBUT0RPOiBBZGQgYXV0aCB0b2tlbiB3aGVuIGF2YWlsYWJsZVxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgdHJhY2tJZCxcbiAgICAgICAgICBzb25nRGF0YSxcbiAgICAgICAgfSksXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIHN0YXJ0IHNlc3Npb246JywgcmVzcG9uc2Uuc3RhdHVzKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgIHJldHVybiByZXN1bHQuc2Vzc2lvbjtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEVycm9yIHN0YXJ0aW5nIHNlc3Npb246JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRlc3QgY29ubmVjdGlvbiB0byB0aGUgQVBJXG4gICAqL1xuICBhc3luYyB0ZXN0Q29ubmVjdGlvbigpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHt0aGlzLmJhc2VVcmwucmVwbGFjZSgnL2FwaScsICcnKX0vaGVhbHRoYCk7XG4gICAgICByZXR1cm4gcmVzcG9uc2Uub2s7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBDb25uZWN0aW9uIHRlc3QgZmFpbGVkOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGthcmFva2VBcGkgPSBuZXcgS2FyYW9rZUFwaVNlcnZpY2UoKTsiLCJpbXBvcnQgeyBDb21wb25lbnQsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlRWZmZWN0LCBvbk1vdW50LCBvbkNsZWFudXAsIFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25LYXJhb2tlVmlldywgTWluaW1pemVkS2FyYW9rZSB9IGZyb20gJ0BzY2FybGV0dC91aSc7XG5pbXBvcnQgeyB0cmFja0RldGVjdG9yLCB0eXBlIFRyYWNrSW5mbyB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3RyYWNrLWRldGVjdG9yJztcbmltcG9ydCB7IGdldEF1dGhUb2tlbiB9IGZyb20gJy4uLy4uL3V0aWxzL3N0b3JhZ2UnO1xuaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gJ3d4dC9icm93c2VyJztcbmltcG9ydCB7IGthcmFva2VBcGkgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9rYXJhb2tlLWFwaSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29udGVudEFwcFByb3BzIHt9XG5cbmV4cG9ydCBjb25zdCBDb250ZW50QXBwOiBDb21wb25lbnQ8Q29udGVudEFwcFByb3BzPiA9ICgpID0+IHtcbiAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBSZW5kZXJpbmcgQ29udGVudEFwcCBjb21wb25lbnQnKTtcbiAgXG4gIC8vIFN0YXRlXG4gIGNvbnN0IFtjdXJyZW50VHJhY2ssIHNldEN1cnJlbnRUcmFja10gPSBjcmVhdGVTaWduYWw8VHJhY2tJbmZvIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFthdXRoVG9rZW4sIHNldEF1dGhUb2tlbl0gPSBjcmVhdGVTaWduYWw8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtzaG93S2FyYW9rZSwgc2V0U2hvd0thcmFva2VdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW2thcmFva2VEYXRhLCBzZXRLYXJhb2tlRGF0YV0gPSBjcmVhdGVTaWduYWw8YW55PihudWxsKTtcbiAgY29uc3QgW2xvYWRpbmcsIHNldExvYWRpbmddID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3Nlc3Npb25TdGFydGVkLCBzZXRTZXNzaW9uU3RhcnRlZF0gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbaXNNaW5pbWl6ZWQsIHNldElzTWluaW1pemVkXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtjb3VudGRvd24sIHNldENvdW50ZG93bl0gPSBjcmVhdGVTaWduYWw8bnVtYmVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtpc1BsYXlpbmcsIHNldElzUGxheWluZ10gPSBjcmVhdGVTaWduYWwoZmFsc2UpO1xuICBjb25zdCBbY3VycmVudFRpbWUsIHNldEN1cnJlbnRUaW1lXSA9IGNyZWF0ZVNpZ25hbCgwKTtcbiAgY29uc3QgW2F1ZGlvUmVmLCBzZXRBdWRpb1JlZl0gPSBjcmVhdGVTaWduYWw8SFRNTEF1ZGlvRWxlbWVudCB8IG51bGw+KG51bGwpO1xuICBcbiAgLy8gTG9hZCBhdXRoIHRva2VuIG9uIG1vdW50XG4gIG9uTW91bnQoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTG9hZGluZyBhdXRoIHRva2VuJyk7XG4gICAgY29uc3QgdG9rZW4gPSBhd2FpdCBnZXRBdXRoVG9rZW4oKTtcbiAgICBpZiAodG9rZW4pIHtcbiAgICAgIHNldEF1dGhUb2tlbih0b2tlbik7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEF1dGggdG9rZW4gbG9hZGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBkZW1vIHRva2VuIGZvciBkZXZlbG9wbWVudFxuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBObyBhdXRoIHRva2VuIGZvdW5kLCB1c2luZyBkZW1vIHRva2VuJyk7XG4gICAgICBzZXRBdXRoVG9rZW4oJ3NjYXJsZXR0X2RlbW9fdG9rZW5fMTIzJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIFN0YXJ0IHdhdGNoaW5nIGZvciB0cmFjayBjaGFuZ2VzXG4gICAgY29uc3QgY2xlYW51cCA9IHRyYWNrRGV0ZWN0b3Iud2F0Y2hGb3JDaGFuZ2VzKCh0cmFjaykgPT4ge1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBUcmFjayBjaGFuZ2VkOicsIHRyYWNrKTtcbiAgICAgIHNldEN1cnJlbnRUcmFjayh0cmFjayk7XG4gICAgICAvLyBTaG93IGthcmFva2Ugd2hlbiB0cmFjayBpcyBkZXRlY3RlZCBhbmQgZmV0Y2ggZGF0YVxuICAgICAgaWYgKHRyYWNrKSB7XG4gICAgICAgIHNldFNob3dLYXJhb2tlKHRydWUpO1xuICAgICAgICBmZXRjaEthcmFva2VEYXRhKHRyYWNrKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIG9uQ2xlYW51cChjbGVhbnVwKTtcbiAgfSk7XG5cbiAgY29uc3QgZmV0Y2hLYXJhb2tlRGF0YSA9IGFzeW5jICh0cmFjazogVHJhY2tJbmZvKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBGZXRjaGluZyBrYXJhb2tlIGRhdGEgZm9yIHRyYWNrOicsIHRyYWNrKTtcbiAgICBzZXRMb2FkaW5nKHRydWUpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQga2FyYW9rZUFwaS5nZXRLYXJhb2tlRGF0YShcbiAgICAgICAgdHJhY2sudHJhY2tJZCxcbiAgICAgICAgdHJhY2sudGl0bGUsXG4gICAgICAgIHRyYWNrLmFydGlzdFxuICAgICAgKTtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gS2FyYW9rZSBkYXRhIGxvYWRlZDonLCBkYXRhKTtcbiAgICAgIHNldEthcmFva2VEYXRhKGRhdGEpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQ29udGVudEFwcF0gRmFpbGVkIHRvIGZldGNoIGthcmFva2UgZGF0YTonLCBlcnJvcik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldExvYWRpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVTdGFydCA9ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFN0YXJ0IGthcmFva2Ugc2Vzc2lvbicpO1xuICAgIFxuICAgIC8vIFN0YXJ0IGNvdW50ZG93blxuICAgIHNldENvdW50ZG93bigzKTtcbiAgICBcbiAgICBjb25zdCBjb3VudGRvd25JbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGNvbnN0IGN1cnJlbnQgPSBjb3VudGRvd24oKTtcbiAgICAgIGlmIChjdXJyZW50ICE9PSBudWxsICYmIGN1cnJlbnQgPiAxKSB7XG4gICAgICAgIHNldENvdW50ZG93bihjdXJyZW50IC0gMSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjbGVhckludGVydmFsKGNvdW50ZG93bkludGVydmFsKTtcbiAgICAgICAgc2V0Q291bnRkb3duKG51bGwpO1xuICAgICAgICBzdGFydEF1ZGlvUGxheWJhY2soKTtcbiAgICAgIH1cbiAgICB9LCAxMDAwKTtcbiAgfTtcblxuICBjb25zdCBzdGFydEF1ZGlvUGxheWJhY2sgPSAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTdGFydGluZyBhdWRpbyBwbGF5YmFjaycpO1xuICAgIHNldElzUGxheWluZyh0cnVlKTtcbiAgICBcbiAgICAvLyBHZXQgdGhlIGF1ZGlvIGVsZW1lbnQgZnJvbSB0aGUgcGFnZVxuICAgIGNvbnN0IGF1ZGlvRWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdhdWRpbycpO1xuICAgIGlmIChhdWRpb0VsZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGF1ZGlvID0gYXVkaW9FbGVtZW50c1swXSBhcyBIVE1MQXVkaW9FbGVtZW50O1xuICAgICAgc2V0QXVkaW9SZWYoYXVkaW8pO1xuICAgICAgXG4gICAgICAvLyBQbGF5IHRoZSBhdWRpb1xuICAgICAgYXVkaW8ucGxheSgpLmNhdGNoKGVyciA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tDb250ZW50QXBwXSBGYWlsZWQgdG8gcGxheSBhdWRpbzonLCBlcnIpO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIFVwZGF0ZSBjdXJyZW50IHRpbWVcbiAgICAgIGNvbnN0IHVwZGF0ZVRpbWUgPSAoKSA9PiB7XG4gICAgICAgIHNldEN1cnJlbnRUaW1lKGF1ZGlvLmN1cnJlbnRUaW1lKTtcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB1cGRhdGVUaW1lKTtcbiAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgKCkgPT4ge1xuICAgICAgICBzZXRJc1BsYXlpbmcoZmFsc2UpO1xuICAgICAgICBhdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdXBkYXRlVGltZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlQ2xvc2UgPSAoKSA9PiB7XG4gICAgc2V0U2hvd0thcmFva2UoZmFsc2UpO1xuICAgIHNldEthcmFva2VEYXRhKG51bGwpO1xuICAgIHNldFNlc3Npb25TdGFydGVkKGZhbHNlKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVNaW5pbWl6ZSA9ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE1pbmltaXplIGthcmFva2Ugd2lkZ2V0Jyk7XG4gICAgc2V0SXNNaW5pbWl6ZWQodHJ1ZSk7XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlUmVzdG9yZSA9ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlc3RvcmUga2FyYW9rZSB3aWRnZXQnKTtcbiAgICBzZXRJc01pbmltaXplZChmYWxzZSk7XG4gIH07XG5cbiAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBSZW5kZXIgc3RhdGU6Jywge1xuICAgIHNob3dLYXJhb2tlOiBzaG93S2FyYW9rZSgpLFxuICAgIGN1cnJlbnRUcmFjazogY3VycmVudFRyYWNrKCksXG4gICAga2FyYW9rZURhdGE6IGthcmFva2VEYXRhKCksXG4gICAgbG9hZGluZzogbG9hZGluZygpXG4gIH0pO1xuXG4gIGNvbnN0IGhhbmRsZUNvbXBsZXRlID0gKHJlc3VsdHM6IGFueSkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gS2FyYW9rZSBzZXNzaW9uIGNvbXBsZXRlZDonLCByZXN1bHRzKTtcbiAgICBzZXRTZXNzaW9uU3RhcnRlZChmYWxzZSk7XG4gICAgLy8gVE9ETzogU2hvdyByZXN1bHRzIHNjcmVlblxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPD5cbiAgICAgIHsvKiBNaW5pbWl6ZWQgc3RhdGUgKi99XG4gICAgICA8U2hvdyB3aGVuPXtzaG93S2FyYW9rZSgpICYmIGN1cnJlbnRUcmFjaygpICYmIGlzTWluaW1pemVkKCl9PlxuICAgICAgICA8TWluaW1pemVkS2FyYW9rZSBvbkNsaWNrPXtoYW5kbGVSZXN0b3JlfSAvPlxuICAgICAgPC9TaG93PlxuXG4gICAgICB7LyogRnVsbCB3aWRnZXQgc3RhdGUgKi99XG4gICAgICA8U2hvdyB3aGVuPXtzaG93S2FyYW9rZSgpICYmIGN1cnJlbnRUcmFjaygpICYmICFpc01pbmltaXplZCgpfSBmYWxsYmFjaz17XG4gICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ25vbmUnIH19PlxuICAgICAgICAgIHtjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIE5vdCBzaG93aW5nIC0gc2hvd0thcmFva2U6Jywgc2hvd0thcmFva2UoKSwgJ2N1cnJlbnRUcmFjazonLCBjdXJyZW50VHJhY2soKSl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgfT5cbiAgICAgICAgPGRpdiBzdHlsZT17e1xuICAgICAgICAgIHBvc2l0aW9uOiAnZml4ZWQnLFxuICAgICAgICAgIHRvcDogJzIwcHgnLFxuICAgICAgICAgIHJpZ2h0OiAnMjBweCcsXG4gICAgICAgICAgYm90dG9tOiAnMjBweCcsXG4gICAgICAgICAgd2lkdGg6ICc0ODBweCcsXG4gICAgICAgICAgJ3otaW5kZXgnOiAnOTk5OTknLFxuICAgICAgICAgIG92ZXJmbG93OiAnaGlkZGVuJyxcbiAgICAgICAgICAnYm9yZGVyLXJhZGl1cyc6ICcxNnB4JyxcbiAgICAgICAgICAnYm94LXNoYWRvdyc6ICcwIDI1cHggNTBweCAtMTJweCByZ2JhKDAsIDAsIDAsIDAuNiknLFxuICAgICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcbiAgICAgICAgICAnZmxleC1kaXJlY3Rpb24nOiAnY29sdW1uJ1xuICAgICAgICB9fT5cbiAgICAgICAgICB7Y29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBSZW5kZXJpbmcgRXh0ZW5zaW9uS2FyYW9rZVZpZXcgd2l0aCBkYXRhOicsIGthcmFva2VEYXRhKCkpfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJoLWZ1bGwgYmctc3VyZmFjZSByb3VuZGVkLTJ4bCBvdmVyZmxvdy1oaWRkZW4gZmxleCBmbGV4LWNvbFwiPlxuICAgICAgICAgICAgey8qIEhlYWRlciB3aXRoIG1pbmltaXplIGJ1dHRvbiAqL31cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWVuZCBwLTIgYmctc3VyZmFjZSBib3JkZXItYiBib3JkZXItc3VidGxlXCIgc3R5bGU9e3sgaGVpZ2h0OiAnNDhweCcgfX0+XG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVNaW5pbWl6ZX1cbiAgICAgICAgICAgICAgICBjbGFzcz1cInctMTAgaC0xMCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzIGhvdmVyOmJnLXdoaXRlLzEwXCJcbiAgICAgICAgICAgICAgICBzdHlsZT17eyBjb2xvcjogJyNhOGE4YTgnIH19XG4gICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIk1pbmltaXplXCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxzdmcgd2lkdGg9XCIyNFwiIGhlaWdodD1cIjI0XCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPlxuICAgICAgICAgICAgICAgICAgPHBhdGggZD1cIk02IDEyaDEyXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiM1wiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIi8+XG4gICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHsvKiBLYXJhb2tlIFZpZXcgKi99XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgICA8U2hvdyB3aGVuPXshbG9hZGluZygpfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGgtZnVsbCBiZy1iYXNlXCI+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImFuaW1hdGUtc3BpbiByb3VuZGVkLWZ1bGwgaC0xMiB3LTEyIGJvcmRlci1iLTIgYm9yZGVyLWFjY2VudC1wcmltYXJ5IG14LWF1dG8gbWItNFwiPjwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtc2Vjb25kYXJ5XCI+TG9hZGluZyBseXJpY3MuLi48L3A+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtrYXJhb2tlRGF0YSgpPy5seXJpY3M/LmxpbmVzfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgaC1mdWxsIHAtOFwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtbGcgdGV4dC1zZWNvbmRhcnkgbWItMlwiPk5vIGx5cmljcyBhdmFpbGFibGU8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXNtIHRleHQtdGVydGlhcnlcIj5UcnkgYSBkaWZmZXJlbnQgc29uZzwvcD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICB9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImgtZnVsbCBmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8RXh0ZW5zaW9uS2FyYW9rZVZpZXdcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjb3JlPXswfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmFuaz17MX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGx5cmljcz17a2FyYW9rZURhdGEoKT8ubHlyaWNzPy5saW5lcyB8fCBbXX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnRUaW1lPXtjdXJyZW50VGltZSgpICogMTAwMH0gLy8gQ29udmVydCB0byBtaWxsaXNlY29uZHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGxlYWRlcmJvYXJkPXtbXX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlzUGxheWluZz17aXNQbGF5aW5nKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICBvblN0YXJ0PXtoYW5kbGVTdGFydH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uU3BlZWRDaGFuZ2U9eyhzcGVlZCkgPT4gY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTcGVlZCBjaGFuZ2VkOicsIHNwZWVkKX1cbiAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHsvKiBDb3VudGRvd24gb3ZlcmxheSAqL31cbiAgICAgICAgICAgICAgICAgICAgPFNob3cgd2hlbj17Y291bnRkb3duKCkgIT09IG51bGx9PlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhYnNvbHV0ZSBpbnNldC0wIGJnLWJsYWNrLzgwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHotNTBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC04eGwgZm9udC1ib2xkIHRleHQtd2hpdGUgYW5pbWF0ZS1wdWxzZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtjb3VudGRvd24oKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC14bCB0ZXh0LXdoaXRlLzgwIG10LTRcIj5HZXQgcmVhZHkhPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9TaG93PlxuICAgIDwvPlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaGFkb3dSb290VWkgfSBmcm9tICd3eHQvdXRpbHMvY29udGVudC1zY3JpcHQtdWkvc2hhZG93LXJvb3QnO1xuaW1wb3J0IHsgZGVmaW5lQ29udGVudFNjcmlwdCB9IGZyb20gJ3d4dC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQnO1xuaW1wb3J0IHR5cGUgeyBDb250ZW50U2NyaXB0Q29udGV4dCB9IGZyb20gJ3d4dC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0JztcbmltcG9ydCB7IHJlbmRlciB9IGZyb20gJ3NvbGlkLWpzL3dlYic7XG5pbXBvcnQgeyBDb250ZW50QXBwIH0gZnJvbSAnLi4vc3JjL2FwcHMvY29udGVudC9Db250ZW50QXBwJztcbmltcG9ydCAnLi4vc3JjL3N0eWxlcy9leHRlbnNpb24uY3NzJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFsnKjovL3NvdW5kY2xvdWQuY29tLyonLCAnKjovL3NvdW5kY2xvYWsuY29tLyonLCAnKjovL3NjLm1haWQuem9uZS8qJywgJyo6Ly8qLm1haWQuem9uZS8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gIGNzc0luamVjdGlvbk1vZGU6ICd1aScsXG5cbiAgYXN5bmMgbWFpbihjdHg6IENvbnRlbnRTY3JpcHRDb250ZXh0KSB7XG4gICAgLy8gT25seSBydW4gaW4gdG9wLWxldmVsIGZyYW1lIHRvIGF2b2lkIGR1cGxpY2F0ZSBwcm9jZXNzaW5nIGluIGlmcmFtZXNcbiAgICBpZiAod2luZG93LnRvcCAhPT0gd2luZG93LnNlbGYpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbU2NhcmxldHQgQ1NdIE5vdCB0b3AtbGV2ZWwgZnJhbWUsIHNraXBwaW5nIGNvbnRlbnQgc2NyaXB0LicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCdbU2NhcmxldHQgQ1NdIFNjYXJsZXR0IEthcmFva2UgY29udGVudCBzY3JpcHQgbG9hZGVkJyk7XG5cbiAgICAvLyBDcmVhdGUgc2hhZG93IERPTSBhbmQgbW91bnQga2FyYW9rZSB3aWRnZXRcbiAgICBjb25zdCB1aSA9IGF3YWl0IGNyZWF0ZVNoYWRvd1Jvb3RVaShjdHgsIHtcbiAgICAgIG5hbWU6ICdzY2FybGV0dC1rYXJhb2tlLXVpJyxcbiAgICAgIHBvc2l0aW9uOiAnb3ZlcmxheScsXG4gICAgICBhbmNob3I6ICdib2R5JyxcbiAgICAgIG9uTW91bnQ6IGFzeW5jIChjb250YWluZXI6IEhUTUxFbGVtZW50KSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIG9uTW91bnQgY2FsbGVkLCBjb250YWluZXI6JywgY29udGFpbmVyKTtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gU2hhZG93IHJvb3Q6JywgY29udGFpbmVyLmdldFJvb3ROb2RlKCkpO1xuICAgICAgICBcbiAgICAgICAgLy8gTG9nIHdoYXQgc3R5bGVzaGVldHMgYXJlIGF2YWlsYWJsZVxuICAgICAgICBjb25zdCBzaGFkb3dSb290ID0gY29udGFpbmVyLmdldFJvb3ROb2RlKCkgYXMgU2hhZG93Um9vdDtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gU2hhZG93IHJvb3Qgc3R5bGVzaGVldHM6Jywgc2hhZG93Um9vdC5zdHlsZVNoZWV0cz8ubGVuZ3RoKTtcbiAgICAgICAgXG4gICAgICAgIC8vIENyZWF0ZSB3cmFwcGVyIGRpdiAoQ29udGVudEFwcCB3aWxsIGhhbmRsZSBwb3NpdGlvbmluZyBiYXNlZCBvbiBzdGF0ZSlcbiAgICAgICAgY29uc3Qgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICB3cmFwcGVyLmNsYXNzTmFtZSA9ICdrYXJhb2tlLXdpZGdldC1jb250YWluZXInO1xuICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQod3JhcHBlcik7XG5cbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gV3JhcHBlciBjcmVhdGVkIGFuZCBhcHBlbmRlZDonLCB3cmFwcGVyKTtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gV3JhcHBlciBjb21wdXRlZCBzdHlsZXM6Jywgd2luZG93LmdldENvbXB1dGVkU3R5bGUod3JhcHBlcikpO1xuXG4gICAgICAgIC8vIFJlbmRlciBDb250ZW50QXBwIGNvbXBvbmVudCAod2hpY2ggdXNlcyBFeHRlbnNpb25LYXJhb2tlVmlldylcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gQWJvdXQgdG8gcmVuZGVyIENvbnRlbnRBcHAnKTtcbiAgICAgICAgY29uc3QgZGlzcG9zZSA9IHJlbmRlcigoKSA9PiA8Q29udGVudEFwcCAvPiwgd3JhcHBlcik7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBDb250ZW50QXBwIHJlbmRlcmVkLCBkaXNwb3NlIGZ1bmN0aW9uOicsIGRpc3Bvc2UpO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIGRpc3Bvc2U7XG4gICAgICB9LFxuICAgICAgb25SZW1vdmU6IChjbGVhbnVwPzogKCkgPT4gdm9pZCkgPT4ge1xuICAgICAgICBjbGVhbnVwPy4oKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBNb3VudCB0aGUgVUlcbiAgICB1aS5tb3VudCgpO1xuICAgIGNvbnNvbGUubG9nKCdbU2NhcmxldHQgQ1NdIEthcmFva2Ugb3ZlcmxheSBtb3VudGVkJyk7XG4gIH0sXG59KTsiLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKi9cbiAgc2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqL1xuICBzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKi9cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0pO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKi9cbiAgcmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9LCBvcHRpb25zKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuICAgIH1cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKFxuICAgICAgdHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsXG4gICAgICBoYW5kbGVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBzaWduYWw6IHRoaXMuc2lnbmFsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuICAgKi9cbiAgbm90aWZ5SW52YWxpZGF0ZWQoKSB7XG4gICAgdGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG4gICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgXG4gICAgKTtcbiAgfVxuICBzdG9wT2xkU2NyaXB0cygpIHtcbiAgICB3aW5kb3cucG9zdE1lc3NhZ2UoXG4gICAgICB7XG4gICAgICAgIHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcbiAgICAgICAgY29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG4gICAgICAgIG1lc3NhZ2VJZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMilcbiAgICAgIH0sXG4gICAgICBcIipcIlxuICAgICk7XG4gIH1cbiAgdmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG4gICAgY29uc3QgaXNTY3JpcHRTdGFydGVkRXZlbnQgPSBldmVudC5kYXRhPy50eXBlID09PSBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEU7XG4gICAgY29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRhdGE/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuICAgIGNvbnN0IGlzTm90RHVwbGljYXRlID0gIXRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmhhcyhldmVudC5kYXRhPy5tZXNzYWdlSWQpO1xuICAgIHJldHVybiBpc1NjcmlwdFN0YXJ0ZWRFdmVudCAmJiBpc1NhbWVDb250ZW50U2NyaXB0ICYmIGlzTm90RHVwbGljYXRlO1xuICB9XG4gIGxpc3RlbkZvck5ld2VyU2NyaXB0cyhvcHRpb25zKSB7XG4gICAgbGV0IGlzRmlyc3QgPSB0cnVlO1xuICAgIGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG4gICAgICBpZiAodGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmFkZChldmVudC5kYXRhLm1lc3NhZ2VJZCk7XG4gICAgICAgIGNvbnN0IHdhc0ZpcnN0ID0gaXNGaXJzdDtcbiAgICAgICAgaXNGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzRmlyc3QgJiYgb3B0aW9ucz8uaWdub3JlRmlyc3RFdmVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYik7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJ2YWx1ZSIsImNoaWxkcmVuIiwibWVtbyIsInJlc3VsdCIsImRpc3Bvc2UiLCJkb2N1bWVudCIsImFkZEV2ZW50TGlzdGVuZXIiLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lIiwicHJpbnQiLCJsb2dnZXIiLCJfYSIsIl9iIiwicmVtb3ZlRGV0ZWN0b3IiLCJtb3VudERldGVjdG9yIiwiZGVmaW5pdGlvbiIsIl8kZGVsZWdhdGVFdmVudHMiLCJTY29yZVBhbmVsIiwicHJvcHMiLCJfZWwkIiwiX3RtcGwkIiwiX2VsJDIiLCJmaXJzdENoaWxkIiwiX2VsJDMiLCJfZWwkNCIsIm5leHRTaWJsaW5nIiwiX2VsJDUiLCJzY29yZSIsInJhbmsiLCJfJGNsYXNzTmFtZSIsImNuIiwiY2xhc3MiLCJMeXJpY3NEaXNwbGF5IiwiY3VycmVudExpbmVJbmRleCIsInNldEN1cnJlbnRMaW5lSW5kZXgiLCJjcmVhdGVTaWduYWwiLCJjb250YWluZXJSZWYiLCJjcmVhdGVFZmZlY3QiLCJjdXJyZW50VGltZSIsInRpbWUiLCJpbmRleCIsImx5cmljcyIsImZpbmRJbmRleCIsImxpbmUiLCJlbmRUaW1lIiwic3RhcnRUaW1lIiwiZHVyYXRpb24iLCJpc1BsYXlpbmciLCJsaW5lRWxlbWVudHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwiY3VycmVudEVsZW1lbnQiLCJjb250YWluZXJIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJsaW5lVG9wIiwib2Zmc2V0VG9wIiwibGluZUhlaWdodCIsIm9mZnNldEhlaWdodCIsInNjcm9sbFRvcCIsInNjcm9sbFRvIiwidG9wIiwiYmVoYXZpb3IiLCJfcmVmJCIsIl8kdXNlIiwiXyRjcmVhdGVDb21wb25lbnQiLCJGb3IiLCJlYWNoIiwiX3RtcGwkMiIsInRleHQiLCJfJGVmZmVjdCIsIl9wJCIsIl92JCIsIl92JDIiLCJlIiwiXyRzZXRBdHRyaWJ1dGUiLCJ0IiwidW5kZWZpbmVkIiwiTGVhZGVyYm9hcmRQYW5lbCIsImVudHJpZXMiLCJlbnRyeSIsIl9lbCQ2IiwiXyRpbnNlcnQiLCJ1c2VybmFtZSIsInRvTG9jYWxlU3RyaW5nIiwiaXNDdXJyZW50VXNlciIsIl92JDMiLCJfdiQ0IiwiYSIsIm8iLCJzcGVlZHMiLCJTcGxpdEJ1dHRvbiIsImN1cnJlbnRTcGVlZEluZGV4Iiwic2V0Q3VycmVudFNwZWVkSW5kZXgiLCJjdXJyZW50U3BlZWQiLCJjeWNsZVNwZWVkIiwic3RvcFByb3BhZ2F0aW9uIiwibmV4dEluZGV4IiwibGVuZ3RoIiwibmV3U3BlZWQiLCJvblNwZWVkQ2hhbmdlIiwiXyRhZGRFdmVudExpc3RlbmVyIiwib25TdGFydCIsIiQkY2xpY2siLCJkaXNhYmxlZCIsIl92JDUiLCJpIiwiVGFic0NvbnRleHQiLCJjcmVhdGVDb250ZXh0IiwiVGFicyIsImFjdGl2ZVRhYiIsInNldEFjdGl2ZVRhYiIsImRlZmF1bHRUYWIiLCJ0YWJzIiwiaWQiLCJjb25zb2xlIiwibG9nIiwiZmlyc3RUYWJJZCIsImhhbmRsZVRhYkNoYW5nZSIsIm9uVGFiQ2hhbmdlIiwiY29udGV4dFZhbHVlIiwiUHJvdmlkZXIiLCJUYWJzTGlzdCIsIlRhYnNUcmlnZ2VyIiwiY29udGV4dCIsInVzZUNvbnRleHQiLCJlcnJvciIsImlzQWN0aXZlIiwiVGFic0NvbnRlbnQiLCJTaG93Iiwid2hlbiIsIkV4dGVuc2lvbkthcmFva2VWaWV3IiwiaGFzT25TdGFydCIsImx5cmljc0xlbmd0aCIsIl90bXBsJDQiLCJsYWJlbCIsIl8kbWVtbyIsIm5vdFBsYXlpbmciLCJzaG91bGRTaG93QnV0dG9uIiwiX3RtcGwkNSIsIl90bXBsJDMiLCJsZWFkZXJib2FyZCIsIk1pbmltaXplZEthcmFva2UiLCJjdXJyZW50VGFyZ2V0Iiwic3R5bGUiLCJ0cmFuc2Zvcm0iLCJvbkNsaWNrIiwic2V0UHJvcGVydHkiLCJDb250ZW50QXBwIiwiY3VycmVudFRyYWNrIiwic2V0Q3VycmVudFRyYWNrIiwiYXV0aFRva2VuIiwic2V0QXV0aFRva2VuIiwic2hvd0thcmFva2UiLCJzZXRTaG93S2FyYW9rZSIsImthcmFva2VEYXRhIiwic2V0S2FyYW9rZURhdGEiLCJsb2FkaW5nIiwic2V0TG9hZGluZyIsImlzTWluaW1pemVkIiwic2V0SXNNaW5pbWl6ZWQiLCJjb3VudGRvd24iLCJzZXRDb3VudGRvd24iLCJzZXRJc1BsYXlpbmciLCJzZXRDdXJyZW50VGltZSIsImF1ZGlvUmVmIiwic2V0QXVkaW9SZWYiLCJvbk1vdW50IiwidG9rZW4iLCJnZXRBdXRoVG9rZW4iLCJjbGVhbnVwIiwidHJhY2tEZXRlY3RvciIsIndhdGNoRm9yQ2hhbmdlcyIsInRyYWNrIiwiZmV0Y2hLYXJhb2tlRGF0YSIsIm9uQ2xlYW51cCIsImRhdGEiLCJrYXJhb2tlQXBpIiwiZ2V0S2FyYW9rZURhdGEiLCJ0cmFja0lkIiwidGl0bGUiLCJhcnRpc3QiLCJoYW5kbGVTdGFydCIsImNvdW50ZG93bkludGVydmFsIiwic2V0SW50ZXJ2YWwiLCJjdXJyZW50IiwiY2xlYXJJbnRlcnZhbCIsInN0YXJ0QXVkaW9QbGF5YmFjayIsImF1ZGlvRWxlbWVudHMiLCJhdWRpbyIsInBsYXkiLCJjYXRjaCIsImVyciIsInVwZGF0ZVRpbWUiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiaGFuZGxlTWluaW1pemUiLCJoYW5kbGVSZXN0b3JlIiwiZmFsbGJhY2siLCJfZWwkMSIsImxpbmVzIiwiX3RtcGwkNiIsIl9lbCQ3Iiwic3BlZWQiLCJfZWwkOCIsIl9lbCQ5IiwiX2VsJDAiLCJkZWZpbmVDb250ZW50U2NyaXB0IiwibWF0Y2hlcyIsInJ1bkF0IiwiY3NzSW5qZWN0aW9uTW9kZSIsIm1haW4iLCJjdHgiLCJ3aW5kb3ciLCJzZWxmIiwidWkiLCJjcmVhdGVTaGFkb3dSb290VWkiLCJuYW1lIiwicG9zaXRpb24iLCJhbmNob3IiLCJjb250YWluZXIiLCJnZXRSb290Tm9kZSIsInNoYWRvd1Jvb3QiLCJzdHlsZVNoZWV0cyIsIndyYXBwZXIiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwiYXBwZW5kQ2hpbGQiLCJnZXRDb21wdXRlZFN0eWxlIiwicmVuZGVyIiwib25SZW1vdmUiLCJtb3VudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBZ0pBLFFBQU0sU0FBUztBQUNmLFFBQU0sVUFBVSxDQUFDLEdBQUcsTUFBTSxNQUFNO0FBR2hDLFFBQU0sU0FBUyxPQUFPLGFBQWE7QUFDbkMsUUFBTSxXQUFXLE9BQU8scUJBQXFCO0FBQzdDLFFBQU0sZ0JBQWdCO0FBQUEsSUFDcEIsUUFBUTtBQUFBLEVBQ1Y7QUFFQSxNQUFJLGFBQWE7QUFDakIsUUFBTSxRQUFRO0FBQ2QsUUFBTSxVQUFVO0FBQ2hCLFFBQU0sVUFBVSxDQUtoQjtBQUVBLE1BQUksUUFBUTtBQUNaLE1BQUksYUFBYTtBQUVqQixNQUFJLHVCQUF1QjtBQUMzQixNQUFJLFdBQVc7QUFDZixNQUFJLFVBQVU7QUFDZCxNQUFJLFVBQVU7QUFDZCxNQUFJLFlBQVk7QUFPaEIsV0FBUyxXQUFXLElBQUksZUFBZTtBQUNyQyxVQUFNLFdBQVcsVUFDZixRQUFRLE9BQ1IsVUFBVSxHQUFHLFdBQVcsR0FDeEIsVUFBVSxrQkFBa0IsU0FBWSxRQUFRLGVBQ2hELE9BQU8sVUFBVTtBQUFBLE1BQ2YsT0FBTztBQUFBLE1BQ1AsVUFBVTtB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QSxRQUNMO0FBQUEsVUFDRSxNQUFNLHNCQUFxQjtBQUFBLFVBQzNCLG1CQUFtQixLQUFLO0FBQUEsVUFDeEIsV0FBVyxLQUFLLE9BQVEsRUFBQyxTQUFTLEVBQUUsRUFBRSxNQUFNLENBQUM7QUFBQSxRQUM5QztBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDTDtBQUFBLElBQ0UseUJBQXlCLE9BQU87O0FBQzlCLFlBQU0seUJBQXVCQyxNQUFBLE1BQU0sU0FBTixnQkFBQUEsSUFBWSxVQUFTLHNCQUFxQjtBQUN2RSxZQUFNLHdCQUFzQkMsTUFBQSxNQUFNLFNBQU4sZ0JBQUFBLElBQVksdUJBQXNCLEtBQUs7QUFDbkUsWUFBTSxpQkFBaUIsQ0FBQyxLQUFLLG1CQUFtQixLQUFJLFdBQU0sU0FBTixtQkFBWSxTQUFTO0FBQ3pFLGFBQU8sd0JBQXdCLHVCQUF1QjtBQUFBLElBQzFEO0FBQUEsSUFDRSxzQkFBc0IsU0FBUztBQUM3QixVQUFJLFVBQVU7QUFDZCxZQUFNLEtBQUssQ0FBQyxVQUFVO0FBQ3BCLFlBQUksS0FBSyx5QkFBeUIsS0FBSyxHQUFHO0FBQ3hDLGVBQUssbUJBQW1CLElBQUksTUFBTSxLQUFLLFNBQVM7QUFDaEQsZ0JBQU0sV0FBVztBQUNqQixvQkFBVTtBQUNWLGNBQUksYUFBWSxtQ0FBUyxrQkFBa0I7QUFDM0MsZUFBSyxrQkFBbUI7QUFBQSxRQUNoQztBQUFBLE1BQ0s7QUFDRCx1QkFBaUIsV0FBVyxFQUFFO0FBQzlCLFdBQUssY0FBYyxNQUFNLG9CQUFvQixXQUFXLEVBQUUsQ0FBQztBQUFBLElBQy9EO0FBQUEsRUFDQTtBQXJKRSxnQkFaVyx1QkFZSiwrQkFBOEI7QUFBQSxJQUNuQztBQUFBLEVBQ0Q7QUFkSSxNQUFNLHVCQUFOOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsMSwyLDMsNCw1LDYsNyw4LDksMTAsMTEsMTIsMTMsMTQsMTUsMzMsMzQsMzVdfQ==

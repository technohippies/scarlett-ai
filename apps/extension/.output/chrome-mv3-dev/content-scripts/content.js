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
  content;
  content;
  delegateEvents(["click", "input"]);
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
  var _tmpl$ = /* @__PURE__ */ template(`<div>`);
  const ContentApp = () => {
    console.log("[ContentApp] Rendering ContentApp component");
    const [currentTrack, setCurrentTrack] = createSignal(null);
    const [authToken, setAuthToken] = createSignal(null);
    const [showKaraoke, setShowKaraoke] = createSignal(false);
    const [karaokeData, setKaraokeData] = createSignal(null);
    const [loading, setLoading] = createSignal(false);
    const [sessionStarted, setSessionStarted] = createSignal(false);
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
      setSessionStarted(true);
    };
    const handleClose = () => {
      setShowKaraoke(false);
      setKaraokeData(null);
      setSessionStarted(false);
    };
    const handleMinimize = () => {
      console.log("[ContentApp] Minimize karaoke widget");
      handleClose();
    };
    console.log("[ContentApp] Render state:", {
      showKaraoke: showKaraoke(),
      currentTrack: currentTrack(),
      karaokeData: karaokeData(),
      loading: loading()
    });
    return createComponent(Show, {
      get when() {
        return memo(() => !!showKaraoke())() && currentTrack();
      },
      get fallback() {
        return (() => {
          var _el$ = _tmpl$();
          _el$.style.setProperty("display", "none");
          insert(_el$, () => console.log("[ContentApp] Not showing - showKaraoke:", showKaraoke(), "currentTrack:", currentTrack()));
          return _el$;
        })();
      },
      get children() {
        return [memo(() => console.log("[ContentApp] Rendering ExtensionKaraokeView with data:", karaokeData())), createComponent(ExtensionKaraokeView, {
          get track() {
            return currentTrack();
          },
          get lyrics() {
            var _a2;
            return (_a2 = karaokeData()) == null ? void 0 : _a2.lyrics;
          },
          get loading() {
            return loading();
          },
          onStart: handleStart,
          onClose: handleClose,
          onMinimize: handleMinimize
        })];
      }
    });
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
          width: 400px;
          z-index: 99999;
          overflow: hidden;
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL2Rpc3QvZGV2LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NvbGlkLWpzL3dlYi9kaXN0L2Rldi5qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvaXMtcG90ZW50aWFsLWN1c3RvbS1lbGVtZW50LW5hbWUvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL2lzb2xhdGVkLWVsZW1lbnQvbGliL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbnkta2V5cy1tYXAvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvZGVmdS9kaXN0L2RlZnUubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0AxbmF0c3Uvd2FpdC1lbGVtZW50L2Rpc3QvZGV0ZWN0b3JzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AMW5hdHN1L3dhaXQtZWxlbWVudC9kaXN0L2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYXJlZC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvc3BsaXQtc2hhZG93LXJvb3QtY3NzLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC11aS9zaGFkb3ctcm9vdC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9jbHN4L2Rpc3QvY2xzeC5tanMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvdXRpbHMvY24udHMiLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9sYXlvdXQvSGVhZGVyL0hlYWRlci50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9kaXNwbGF5L1Njb3JlUGFuZWwvU2NvcmVQYW5lbC50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9vbmJvYXJkaW5nL09uYm9hcmRpbmdGbG93L09uYm9hcmRpbmdGbG93LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTHlyaWNzRGlzcGxheS9MeXJpY3NEaXNwbGF5LnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvS2FyYW9rZUhlYWRlci9LYXJhb2tlSGVhZGVyLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvTGVhZGVyYm9hcmRQYW5lbC9MZWFkZXJib2FyZFBhbmVsLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2NvbW1vbi9TcGxpdEJ1dHRvbi9TcGxpdEJ1dHRvbi50c3giLCIuLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy91aS9zcmMvY29tcG9uZW50cy9jb21tb24vVGFicy9UYWJzLnRzeCIsIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL3VpL3NyYy9jb21wb25lbnRzL2thcmFva2UvRXh0ZW5zaW9uS2FyYW9rZVZpZXcvRXh0ZW5zaW9uS2FyYW9rZVZpZXcudHN4IiwiLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvdWkvc3JjL2NvbXBvbmVudHMvcHJhY3RpY2UvUHJhY3RpY2VIZWFkZXIvUHJhY3RpY2VIZWFkZXIudHN4IiwiLi4vLi4vLi4vc3JjL3NlcnZpY2VzL3RyYWNrLWRldGVjdG9yLnRzIiwiLi4vLi4vLi4vc3JjL3V0aWxzL3N0b3JhZ2UudHMiLCIuLi8uLi8uLi9zcmMvc2VydmljZXMva2FyYW9rZS1hcGkudHMiLCIuLi8uLi8uLi9zcmMvYXBwcy9jb250ZW50L0NvbnRlbnRBcHAudHN4IiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC50c3giLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dC5tanMiXSwic291cmNlc0NvbnRlbnQiOlsibGV0IHRhc2tJZENvdW50ZXIgPSAxLFxuICBpc0NhbGxiYWNrU2NoZWR1bGVkID0gZmFsc2UsXG4gIGlzUGVyZm9ybWluZ1dvcmsgPSBmYWxzZSxcbiAgdGFza1F1ZXVlID0gW10sXG4gIGN1cnJlbnRUYXNrID0gbnVsbCxcbiAgc2hvdWxkWWllbGRUb0hvc3QgPSBudWxsLFxuICB5aWVsZEludGVydmFsID0gNSxcbiAgZGVhZGxpbmUgPSAwLFxuICBtYXhZaWVsZEludGVydmFsID0gMzAwLFxuICBzY2hlZHVsZUNhbGxiYWNrID0gbnVsbCxcbiAgc2NoZWR1bGVkQ2FsbGJhY2sgPSBudWxsO1xuY29uc3QgbWF4U2lnbmVkMzFCaXRJbnQgPSAxMDczNzQxODIzO1xuZnVuY3Rpb24gc2V0dXBTY2hlZHVsZXIoKSB7XG4gIGNvbnN0IGNoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKSxcbiAgICBwb3J0ID0gY2hhbm5lbC5wb3J0MjtcbiAgc2NoZWR1bGVDYWxsYmFjayA9ICgpID0+IHBvcnQucG9zdE1lc3NhZ2UobnVsbCk7XG4gIGNoYW5uZWwucG9ydDEub25tZXNzYWdlID0gKCkgPT4ge1xuICAgIGlmIChzY2hlZHVsZWRDYWxsYmFjayAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgY3VycmVudFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGRlYWRsaW5lID0gY3VycmVudFRpbWUgKyB5aWVsZEludGVydmFsO1xuICAgICAgY29uc3QgaGFzVGltZVJlbWFpbmluZyA9IHRydWU7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBoYXNNb3JlV29yayA9IHNjaGVkdWxlZENhbGxiYWNrKGhhc1RpbWVSZW1haW5pbmcsIGN1cnJlbnRUaW1lKTtcbiAgICAgICAgaWYgKCFoYXNNb3JlV29yaykge1xuICAgICAgICAgIHNjaGVkdWxlZENhbGxiYWNrID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHBvcnQucG9zdE1lc3NhZ2UobnVsbCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBwb3J0LnBvc3RNZXNzYWdlKG51bGwpO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH1cbiAgICB9XG4gIH07XG4gIGlmIChuYXZpZ2F0b3IgJiYgbmF2aWdhdG9yLnNjaGVkdWxpbmcgJiYgbmF2aWdhdG9yLnNjaGVkdWxpbmcuaXNJbnB1dFBlbmRpbmcpIHtcbiAgICBjb25zdCBzY2hlZHVsaW5nID0gbmF2aWdhdG9yLnNjaGVkdWxpbmc7XG4gICAgc2hvdWxkWWllbGRUb0hvc3QgPSAoKSA9PiB7XG4gICAgICBjb25zdCBjdXJyZW50VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgaWYgKGN1cnJlbnRUaW1lID49IGRlYWRsaW5lKSB7XG4gICAgICAgIGlmIChzY2hlZHVsaW5nLmlzSW5wdXRQZW5kaW5nKCkpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY3VycmVudFRpbWUgPj0gbWF4WWllbGRJbnRlcnZhbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHNob3VsZFlpZWxkVG9Ib3N0ID0gKCkgPT4gcGVyZm9ybWFuY2Uubm93KCkgPj0gZGVhZGxpbmU7XG4gIH1cbn1cbmZ1bmN0aW9uIGVucXVldWUodGFza1F1ZXVlLCB0YXNrKSB7XG4gIGZ1bmN0aW9uIGZpbmRJbmRleCgpIHtcbiAgICBsZXQgbSA9IDA7XG4gICAgbGV0IG4gPSB0YXNrUXVldWUubGVuZ3RoIC0gMTtcbiAgICB3aGlsZSAobSA8PSBuKSB7XG4gICAgICBjb25zdCBrID0gbiArIG0gPj4gMTtcbiAgICAgIGNvbnN0IGNtcCA9IHRhc2suZXhwaXJhdGlvblRpbWUgLSB0YXNrUXVldWVba10uZXhwaXJhdGlvblRpbWU7XG4gICAgICBpZiAoY21wID4gMCkgbSA9IGsgKyAxO2Vsc2UgaWYgKGNtcCA8IDApIG4gPSBrIC0gMTtlbHNlIHJldHVybiBrO1xuICAgIH1cbiAgICByZXR1cm4gbTtcbiAgfVxuICB0YXNrUXVldWUuc3BsaWNlKGZpbmRJbmRleCgpLCAwLCB0YXNrKTtcbn1cbmZ1bmN0aW9uIHJlcXVlc3RDYWxsYmFjayhmbiwgb3B0aW9ucykge1xuICBpZiAoIXNjaGVkdWxlQ2FsbGJhY2spIHNldHVwU2NoZWR1bGVyKCk7XG4gIGxldCBzdGFydFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKSxcbiAgICB0aW1lb3V0ID0gbWF4U2lnbmVkMzFCaXRJbnQ7XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMudGltZW91dCkgdGltZW91dCA9IG9wdGlvbnMudGltZW91dDtcbiAgY29uc3QgbmV3VGFzayA9IHtcbiAgICBpZDogdGFza0lkQ291bnRlcisrLFxuICAgIGZuLFxuICAgIHN0YXJ0VGltZSxcbiAgICBleHBpcmF0aW9uVGltZTogc3RhcnRUaW1lICsgdGltZW91dFxuICB9O1xuICBlbnF1ZXVlKHRhc2tRdWV1ZSwgbmV3VGFzayk7XG4gIGlmICghaXNDYWxsYmFja1NjaGVkdWxlZCAmJiAhaXNQZXJmb3JtaW5nV29yaykge1xuICAgIGlzQ2FsbGJhY2tTY2hlZHVsZWQgPSB0cnVlO1xuICAgIHNjaGVkdWxlZENhbGxiYWNrID0gZmx1c2hXb3JrO1xuICAgIHNjaGVkdWxlQ2FsbGJhY2soKTtcbiAgfVxuICByZXR1cm4gbmV3VGFzaztcbn1cbmZ1bmN0aW9uIGNhbmNlbENhbGxiYWNrKHRhc2spIHtcbiAgdGFzay5mbiA9IG51bGw7XG59XG5mdW5jdGlvbiBmbHVzaFdvcmsoaGFzVGltZVJlbWFpbmluZywgaW5pdGlhbFRpbWUpIHtcbiAgaXNDYWxsYmFja1NjaGVkdWxlZCA9IGZhbHNlO1xuICBpc1BlcmZvcm1pbmdXb3JrID0gdHJ1ZTtcbiAgdHJ5IHtcbiAgICByZXR1cm4gd29ya0xvb3AoaGFzVGltZVJlbWFpbmluZywgaW5pdGlhbFRpbWUpO1xuICB9IGZpbmFsbHkge1xuICAgIGN1cnJlbnRUYXNrID0gbnVsbDtcbiAgICBpc1BlcmZvcm1pbmdXb3JrID0gZmFsc2U7XG4gIH1cbn1cbmZ1bmN0aW9uIHdvcmtMb29wKGhhc1RpbWVSZW1haW5pbmcsIGluaXRpYWxUaW1lKSB7XG4gIGxldCBjdXJyZW50VGltZSA9IGluaXRpYWxUaW1lO1xuICBjdXJyZW50VGFzayA9IHRhc2tRdWV1ZVswXSB8fCBudWxsO1xuICB3aGlsZSAoY3VycmVudFRhc2sgIT09IG51bGwpIHtcbiAgICBpZiAoY3VycmVudFRhc2suZXhwaXJhdGlvblRpbWUgPiBjdXJyZW50VGltZSAmJiAoIWhhc1RpbWVSZW1haW5pbmcgfHwgc2hvdWxkWWllbGRUb0hvc3QoKSkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjb25zdCBjYWxsYmFjayA9IGN1cnJlbnRUYXNrLmZuO1xuICAgIGlmIChjYWxsYmFjayAhPT0gbnVsbCkge1xuICAgICAgY3VycmVudFRhc2suZm4gPSBudWxsO1xuICAgICAgY29uc3QgZGlkVXNlckNhbGxiYWNrVGltZW91dCA9IGN1cnJlbnRUYXNrLmV4cGlyYXRpb25UaW1lIDw9IGN1cnJlbnRUaW1lO1xuICAgICAgY2FsbGJhY2soZGlkVXNlckNhbGxiYWNrVGltZW91dCk7XG4gICAgICBjdXJyZW50VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgaWYgKGN1cnJlbnRUYXNrID09PSB0YXNrUXVldWVbMF0pIHtcbiAgICAgICAgdGFza1F1ZXVlLnNoaWZ0KCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHRhc2tRdWV1ZS5zaGlmdCgpO1xuICAgIGN1cnJlbnRUYXNrID0gdGFza1F1ZXVlWzBdIHx8IG51bGw7XG4gIH1cbiAgcmV0dXJuIGN1cnJlbnRUYXNrICE9PSBudWxsO1xufVxuXG5jb25zdCBzaGFyZWRDb25maWcgPSB7XG4gIGNvbnRleHQ6IHVuZGVmaW5lZCxcbiAgcmVnaXN0cnk6IHVuZGVmaW5lZCxcbiAgZWZmZWN0czogdW5kZWZpbmVkLFxuICBkb25lOiBmYWxzZSxcbiAgZ2V0Q29udGV4dElkKCkge1xuICAgIHJldHVybiBnZXRDb250ZXh0SWQodGhpcy5jb250ZXh0LmNvdW50KTtcbiAgfSxcbiAgZ2V0TmV4dENvbnRleHRJZCgpIHtcbiAgICByZXR1cm4gZ2V0Q29udGV4dElkKHRoaXMuY29udGV4dC5jb3VudCsrKTtcbiAgfVxufTtcbmZ1bmN0aW9uIGdldENvbnRleHRJZChjb3VudCkge1xuICBjb25zdCBudW0gPSBTdHJpbmcoY291bnQpLFxuICAgIGxlbiA9IG51bS5sZW5ndGggLSAxO1xuICByZXR1cm4gc2hhcmVkQ29uZmlnLmNvbnRleHQuaWQgKyAobGVuID8gU3RyaW5nLmZyb21DaGFyQ29kZSg5NiArIGxlbikgOiBcIlwiKSArIG51bTtcbn1cbmZ1bmN0aW9uIHNldEh5ZHJhdGVDb250ZXh0KGNvbnRleHQpIHtcbiAgc2hhcmVkQ29uZmlnLmNvbnRleHQgPSBjb250ZXh0O1xufVxuZnVuY3Rpb24gbmV4dEh5ZHJhdGVDb250ZXh0KCkge1xuICByZXR1cm4ge1xuICAgIC4uLnNoYXJlZENvbmZpZy5jb250ZXh0LFxuICAgIGlkOiBzaGFyZWRDb25maWcuZ2V0TmV4dENvbnRleHRJZCgpLFxuICAgIGNvdW50OiAwXG4gIH07XG59XG5cbmNvbnN0IElTX0RFViA9IHRydWU7XG5jb25zdCBlcXVhbEZuID0gKGEsIGIpID0+IGEgPT09IGI7XG5jb25zdCAkUFJPWFkgPSBTeW1ib2woXCJzb2xpZC1wcm94eVwiKTtcbmNvbnN0IFNVUFBPUlRTX1BST1hZID0gdHlwZW9mIFByb3h5ID09PSBcImZ1bmN0aW9uXCI7XG5jb25zdCAkVFJBQ0sgPSBTeW1ib2woXCJzb2xpZC10cmFja1wiKTtcbmNvbnN0ICRERVZDT01QID0gU3ltYm9sKFwic29saWQtZGV2LWNvbXBvbmVudFwiKTtcbmNvbnN0IHNpZ25hbE9wdGlvbnMgPSB7XG4gIGVxdWFsczogZXF1YWxGblxufTtcbmxldCBFUlJPUiA9IG51bGw7XG5sZXQgcnVuRWZmZWN0cyA9IHJ1blF1ZXVlO1xuY29uc3QgU1RBTEUgPSAxO1xuY29uc3QgUEVORElORyA9IDI7XG5jb25zdCBVTk9XTkVEID0ge1xuICBvd25lZDogbnVsbCxcbiAgY2xlYW51cHM6IG51bGwsXG4gIGNvbnRleHQ6IG51bGwsXG4gIG93bmVyOiBudWxsXG59O1xuY29uc3QgTk9fSU5JVCA9IHt9O1xudmFyIE93bmVyID0gbnVsbDtcbmxldCBUcmFuc2l0aW9uID0gbnVsbDtcbmxldCBTY2hlZHVsZXIgPSBudWxsO1xubGV0IEV4dGVybmFsU291cmNlQ29uZmlnID0gbnVsbDtcbmxldCBMaXN0ZW5lciA9IG51bGw7XG5sZXQgVXBkYXRlcyA9IG51bGw7XG5sZXQgRWZmZWN0cyA9IG51bGw7XG5sZXQgRXhlY0NvdW50ID0gMDtcbmNvbnN0IERldkhvb2tzID0ge1xuICBhZnRlclVwZGF0ZTogbnVsbCxcbiAgYWZ0ZXJDcmVhdGVPd25lcjogbnVsbCxcbiAgYWZ0ZXJDcmVhdGVTaWduYWw6IG51bGwsXG4gIGFmdGVyUmVnaXN0ZXJHcmFwaDogbnVsbFxufTtcbmZ1bmN0aW9uIGNyZWF0ZVJvb3QoZm4sIGRldGFjaGVkT3duZXIpIHtcbiAgY29uc3QgbGlzdGVuZXIgPSBMaXN0ZW5lcixcbiAgICBvd25lciA9IE93bmVyLFxuICAgIHVub3duZWQgPSBmbi5sZW5ndGggPT09IDAsXG4gICAgY3VycmVudCA9IGRldGFjaGVkT3duZXIgPT09IHVuZGVmaW5lZCA/IG93bmVyIDogZGV0YWNoZWRPd25lcixcbiAgICByb290ID0gdW5vd25lZCA/IHtcbiAgICAgIG93bmVkOiBudWxsLFxuICAgICAgY2xlYW51cHM6IG51bGwsXG4gICAgICBjb250ZXh0OiBudWxsLFxuICAgICAgb3duZXI6IG51bGxcbiAgICB9ICA6IHtcbiAgICAgIG93bmVkOiBudWxsLFxuICAgICAgY2xlYW51cHM6IG51bGwsXG4gICAgICBjb250ZXh0OiBjdXJyZW50ID8gY3VycmVudC5jb250ZXh0IDogbnVsbCxcbiAgICAgIG93bmVyOiBjdXJyZW50XG4gICAgfSxcbiAgICB1cGRhdGVGbiA9IHVub3duZWQgPyAoKSA9PiBmbigoKSA9PiB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJEaXNwb3NlIG1ldGhvZCBtdXN0IGJlIGFuIGV4cGxpY2l0IGFyZ3VtZW50IHRvIGNyZWF0ZVJvb3QgZnVuY3Rpb25cIik7XG4gICAgfSkgIDogKCkgPT4gZm4oKCkgPT4gdW50cmFjaygoKSA9PiBjbGVhbk5vZGUocm9vdCkpKTtcbiAgRGV2SG9va3MuYWZ0ZXJDcmVhdGVPd25lciAmJiBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyKHJvb3QpO1xuICBPd25lciA9IHJvb3Q7XG4gIExpc3RlbmVyID0gbnVsbDtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcnVuVXBkYXRlcyh1cGRhdGVGbiwgdHJ1ZSk7XG4gIH0gZmluYWxseSB7XG4gICAgTGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgICBPd25lciA9IG93bmVyO1xuICB9XG59XG5mdW5jdGlvbiBjcmVhdGVTaWduYWwodmFsdWUsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgPyBPYmplY3QuYXNzaWduKHt9LCBzaWduYWxPcHRpb25zLCBvcHRpb25zKSA6IHNpZ25hbE9wdGlvbnM7XG4gIGNvbnN0IHMgPSB7XG4gICAgdmFsdWUsXG4gICAgb2JzZXJ2ZXJzOiBudWxsLFxuICAgIG9ic2VydmVyU2xvdHM6IG51bGwsXG4gICAgY29tcGFyYXRvcjogb3B0aW9ucy5lcXVhbHMgfHwgdW5kZWZpbmVkXG4gIH07XG4gIHtcbiAgICBpZiAob3B0aW9ucy5uYW1lKSBzLm5hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgaWYgKG9wdGlvbnMuaW50ZXJuYWwpIHtcbiAgICAgIHMuaW50ZXJuYWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWdpc3RlckdyYXBoKHMpO1xuICAgICAgaWYgKERldkhvb2tzLmFmdGVyQ3JlYXRlU2lnbmFsKSBEZXZIb29rcy5hZnRlckNyZWF0ZVNpZ25hbChzKTtcbiAgICB9XG4gIH1cbiAgY29uc3Qgc2V0dGVyID0gdmFsdWUgPT4ge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMocykpIHZhbHVlID0gdmFsdWUocy50VmFsdWUpO2Vsc2UgdmFsdWUgPSB2YWx1ZShzLnZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyaXRlU2lnbmFsKHMsIHZhbHVlKTtcbiAgfTtcbiAgcmV0dXJuIFtyZWFkU2lnbmFsLmJpbmQocyksIHNldHRlcl07XG59XG5mdW5jdGlvbiBjcmVhdGVDb21wdXRlZChmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgY29uc3QgYyA9IGNyZWF0ZUNvbXB1dGF0aW9uKGZuLCB2YWx1ZSwgdHJ1ZSwgU1RBTEUsIG9wdGlvbnMgKTtcbiAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgVXBkYXRlcy5wdXNoKGMpO2Vsc2UgdXBkYXRlQ29tcHV0YXRpb24oYyk7XG59XG5mdW5jdGlvbiBjcmVhdGVSZW5kZXJFZmZlY3QoZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIGNvbnN0IGMgPSBjcmVhdGVDb21wdXRhdGlvbihmbiwgdmFsdWUsIGZhbHNlLCBTVEFMRSwgb3B0aW9ucyApO1xuICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBVcGRhdGVzLnB1c2goYyk7ZWxzZSB1cGRhdGVDb21wdXRhdGlvbihjKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUVmZmVjdChmbiwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgcnVuRWZmZWN0cyA9IHJ1blVzZXJFZmZlY3RzO1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCBmYWxzZSwgU1RBTEUsIG9wdGlvbnMgKSxcbiAgICBzID0gU3VzcGVuc2VDb250ZXh0ICYmIHVzZUNvbnRleHQoU3VzcGVuc2VDb250ZXh0KTtcbiAgaWYgKHMpIGMuc3VzcGVuc2UgPSBzO1xuICBpZiAoIW9wdGlvbnMgfHwgIW9wdGlvbnMucmVuZGVyKSBjLnVzZXIgPSB0cnVlO1xuICBFZmZlY3RzID8gRWZmZWN0cy5wdXNoKGMpIDogdXBkYXRlQ29tcHV0YXRpb24oYyk7XG59XG5mdW5jdGlvbiBjcmVhdGVSZWFjdGlvbihvbkludmFsaWRhdGUsIG9wdGlvbnMpIHtcbiAgbGV0IGZuO1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oKCkgPT4ge1xuICAgICAgZm4gPyBmbigpIDogdW50cmFjayhvbkludmFsaWRhdGUpO1xuICAgICAgZm4gPSB1bmRlZmluZWQ7XG4gICAgfSwgdW5kZWZpbmVkLCBmYWxzZSwgMCwgb3B0aW9ucyApLFxuICAgIHMgPSBTdXNwZW5zZUNvbnRleHQgJiYgdXNlQ29udGV4dChTdXNwZW5zZUNvbnRleHQpO1xuICBpZiAocykgYy5zdXNwZW5zZSA9IHM7XG4gIGMudXNlciA9IHRydWU7XG4gIHJldHVybiB0cmFja2luZyA9PiB7XG4gICAgZm4gPSB0cmFja2luZztcbiAgICB1cGRhdGVDb21wdXRhdGlvbihjKTtcbiAgfTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZU1lbW8oZm4sIHZhbHVlLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zID8gT2JqZWN0LmFzc2lnbih7fSwgc2lnbmFsT3B0aW9ucywgb3B0aW9ucykgOiBzaWduYWxPcHRpb25zO1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oZm4sIHZhbHVlLCB0cnVlLCAwLCBvcHRpb25zICk7XG4gIGMub2JzZXJ2ZXJzID0gbnVsbDtcbiAgYy5vYnNlcnZlclNsb3RzID0gbnVsbDtcbiAgYy5jb21wYXJhdG9yID0gb3B0aW9ucy5lcXVhbHMgfHwgdW5kZWZpbmVkO1xuICBpZiAoU2NoZWR1bGVyICYmIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSB7XG4gICAgYy50U3RhdGUgPSBTVEFMRTtcbiAgICBVcGRhdGVzLnB1c2goYyk7XG4gIH0gZWxzZSB1cGRhdGVDb21wdXRhdGlvbihjKTtcbiAgcmV0dXJuIHJlYWRTaWduYWwuYmluZChjKTtcbn1cbmZ1bmN0aW9uIGlzUHJvbWlzZSh2KSB7XG4gIHJldHVybiB2ICYmIHR5cGVvZiB2ID09PSBcIm9iamVjdFwiICYmIFwidGhlblwiIGluIHY7XG59XG5mdW5jdGlvbiBjcmVhdGVSZXNvdXJjZShwU291cmNlLCBwRmV0Y2hlciwgcE9wdGlvbnMpIHtcbiAgbGV0IHNvdXJjZTtcbiAgbGV0IGZldGNoZXI7XG4gIGxldCBvcHRpb25zO1xuICBpZiAodHlwZW9mIHBGZXRjaGVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBzb3VyY2UgPSBwU291cmNlO1xuICAgIGZldGNoZXIgPSBwRmV0Y2hlcjtcbiAgICBvcHRpb25zID0gcE9wdGlvbnMgfHwge307XG4gIH0gZWxzZSB7XG4gICAgc291cmNlID0gdHJ1ZTtcbiAgICBmZXRjaGVyID0gcFNvdXJjZTtcbiAgICBvcHRpb25zID0gcEZldGNoZXIgfHwge307XG4gIH1cbiAgbGV0IHByID0gbnVsbCxcbiAgICBpbml0UCA9IE5PX0lOSVQsXG4gICAgaWQgPSBudWxsLFxuICAgIGxvYWRlZFVuZGVyVHJhbnNpdGlvbiA9IGZhbHNlLFxuICAgIHNjaGVkdWxlZCA9IGZhbHNlLFxuICAgIHJlc29sdmVkID0gXCJpbml0aWFsVmFsdWVcIiBpbiBvcHRpb25zLFxuICAgIGR5bmFtaWMgPSB0eXBlb2Ygc291cmNlID09PSBcImZ1bmN0aW9uXCIgJiYgY3JlYXRlTWVtbyhzb3VyY2UpO1xuICBjb25zdCBjb250ZXh0cyA9IG5ldyBTZXQoKSxcbiAgICBbdmFsdWUsIHNldFZhbHVlXSA9IChvcHRpb25zLnN0b3JhZ2UgfHwgY3JlYXRlU2lnbmFsKShvcHRpb25zLmluaXRpYWxWYWx1ZSksXG4gICAgW2Vycm9yLCBzZXRFcnJvcl0gPSBjcmVhdGVTaWduYWwodW5kZWZpbmVkKSxcbiAgICBbdHJhY2ssIHRyaWdnZXJdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCwge1xuICAgICAgZXF1YWxzOiBmYWxzZVxuICAgIH0pLFxuICAgIFtzdGF0ZSwgc2V0U3RhdGVdID0gY3JlYXRlU2lnbmFsKHJlc29sdmVkID8gXCJyZWFkeVwiIDogXCJ1bnJlc29sdmVkXCIpO1xuICBpZiAoc2hhcmVkQ29uZmlnLmNvbnRleHQpIHtcbiAgICBpZCA9IHNoYXJlZENvbmZpZy5nZXROZXh0Q29udGV4dElkKCk7XG4gICAgaWYgKG9wdGlvbnMuc3NyTG9hZEZyb20gPT09IFwiaW5pdGlhbFwiKSBpbml0UCA9IG9wdGlvbnMuaW5pdGlhbFZhbHVlO2Vsc2UgaWYgKHNoYXJlZENvbmZpZy5sb2FkICYmIHNoYXJlZENvbmZpZy5oYXMoaWQpKSBpbml0UCA9IHNoYXJlZENvbmZpZy5sb2FkKGlkKTtcbiAgfVxuICBmdW5jdGlvbiBsb2FkRW5kKHAsIHYsIGVycm9yLCBrZXkpIHtcbiAgICBpZiAocHIgPT09IHApIHtcbiAgICAgIHByID0gbnVsbDtcbiAgICAgIGtleSAhPT0gdW5kZWZpbmVkICYmIChyZXNvbHZlZCA9IHRydWUpO1xuICAgICAgaWYgKChwID09PSBpbml0UCB8fCB2ID09PSBpbml0UCkgJiYgb3B0aW9ucy5vbkh5ZHJhdGVkKSBxdWV1ZU1pY3JvdGFzaygoKSA9PiBvcHRpb25zLm9uSHlkcmF0ZWQoa2V5LCB7XG4gICAgICAgIHZhbHVlOiB2XG4gICAgICB9KSk7XG4gICAgICBpbml0UCA9IE5PX0lOSVQ7XG4gICAgICBpZiAoVHJhbnNpdGlvbiAmJiBwICYmIGxvYWRlZFVuZGVyVHJhbnNpdGlvbikge1xuICAgICAgICBUcmFuc2l0aW9uLnByb21pc2VzLmRlbGV0ZShwKTtcbiAgICAgICAgbG9hZGVkVW5kZXJUcmFuc2l0aW9uID0gZmFsc2U7XG4gICAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICAgIFRyYW5zaXRpb24ucnVubmluZyA9IHRydWU7XG4gICAgICAgICAgY29tcGxldGVMb2FkKHYsIGVycm9yKTtcbiAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgfSBlbHNlIGNvbXBsZXRlTG9hZCh2LCBlcnJvcik7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9XG4gIGZ1bmN0aW9uIGNvbXBsZXRlTG9hZCh2LCBlcnIpIHtcbiAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgIGlmIChlcnIgPT09IHVuZGVmaW5lZCkgc2V0VmFsdWUoKCkgPT4gdik7XG4gICAgICBzZXRTdGF0ZShlcnIgIT09IHVuZGVmaW5lZCA/IFwiZXJyb3JlZFwiIDogcmVzb2x2ZWQgPyBcInJlYWR5XCIgOiBcInVucmVzb2x2ZWRcIik7XG4gICAgICBzZXRFcnJvcihlcnIpO1xuICAgICAgZm9yIChjb25zdCBjIG9mIGNvbnRleHRzLmtleXMoKSkgYy5kZWNyZW1lbnQoKTtcbiAgICAgIGNvbnRleHRzLmNsZWFyKCk7XG4gICAgfSwgZmFsc2UpO1xuICB9XG4gIGZ1bmN0aW9uIHJlYWQoKSB7XG4gICAgY29uc3QgYyA9IFN1c3BlbnNlQ29udGV4dCAmJiB1c2VDb250ZXh0KFN1c3BlbnNlQ29udGV4dCksXG4gICAgICB2ID0gdmFsdWUoKSxcbiAgICAgIGVyciA9IGVycm9yKCk7XG4gICAgaWYgKGVyciAhPT0gdW5kZWZpbmVkICYmICFwcikgdGhyb3cgZXJyO1xuICAgIGlmIChMaXN0ZW5lciAmJiAhTGlzdGVuZXIudXNlciAmJiBjKSB7XG4gICAgICBjcmVhdGVDb21wdXRlZCgoKSA9PiB7XG4gICAgICAgIHRyYWNrKCk7XG4gICAgICAgIGlmIChwcikge1xuICAgICAgICAgIGlmIChjLnJlc29sdmVkICYmIFRyYW5zaXRpb24gJiYgbG9hZGVkVW5kZXJUcmFuc2l0aW9uKSBUcmFuc2l0aW9uLnByb21pc2VzLmFkZChwcik7ZWxzZSBpZiAoIWNvbnRleHRzLmhhcyhjKSkge1xuICAgICAgICAgICAgYy5pbmNyZW1lbnQoKTtcbiAgICAgICAgICAgIGNvbnRleHRzLmFkZChjKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuICBmdW5jdGlvbiBsb2FkKHJlZmV0Y2hpbmcgPSB0cnVlKSB7XG4gICAgaWYgKHJlZmV0Y2hpbmcgIT09IGZhbHNlICYmIHNjaGVkdWxlZCkgcmV0dXJuO1xuICAgIHNjaGVkdWxlZCA9IGZhbHNlO1xuICAgIGNvbnN0IGxvb2t1cCA9IGR5bmFtaWMgPyBkeW5hbWljKCkgOiBzb3VyY2U7XG4gICAgbG9hZGVkVW5kZXJUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gICAgaWYgKGxvb2t1cCA9PSBudWxsIHx8IGxvb2t1cCA9PT0gZmFsc2UpIHtcbiAgICAgIGxvYWRFbmQocHIsIHVudHJhY2sodmFsdWUpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKFRyYW5zaXRpb24gJiYgcHIpIFRyYW5zaXRpb24ucHJvbWlzZXMuZGVsZXRlKHByKTtcbiAgICBsZXQgZXJyb3I7XG4gICAgY29uc3QgcCA9IGluaXRQICE9PSBOT19JTklUID8gaW5pdFAgOiB1bnRyYWNrKCgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBmZXRjaGVyKGxvb2t1cCwge1xuICAgICAgICAgIHZhbHVlOiB2YWx1ZSgpLFxuICAgICAgICAgIHJlZmV0Y2hpbmdcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoIChmZXRjaGVyRXJyb3IpIHtcbiAgICAgICAgZXJyb3IgPSBmZXRjaGVyRXJyb3I7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKGVycm9yICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxvYWRFbmQocHIsIHVuZGVmaW5lZCwgY2FzdEVycm9yKGVycm9yKSwgbG9va3VwKTtcbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKCFpc1Byb21pc2UocCkpIHtcbiAgICAgIGxvYWRFbmQocHIsIHAsIHVuZGVmaW5lZCwgbG9va3VwKTtcbiAgICAgIHJldHVybiBwO1xuICAgIH1cbiAgICBwciA9IHA7XG4gICAgaWYgKFwidlwiIGluIHApIHtcbiAgICAgIGlmIChwLnMgPT09IDEpIGxvYWRFbmQocHIsIHAudiwgdW5kZWZpbmVkLCBsb29rdXApO2Vsc2UgbG9hZEVuZChwciwgdW5kZWZpbmVkLCBjYXN0RXJyb3IocC52KSwgbG9va3VwKTtcbiAgICAgIHJldHVybiBwO1xuICAgIH1cbiAgICBzY2hlZHVsZWQgPSB0cnVlO1xuICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHNjaGVkdWxlZCA9IGZhbHNlKTtcbiAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgIHNldFN0YXRlKHJlc29sdmVkID8gXCJyZWZyZXNoaW5nXCIgOiBcInBlbmRpbmdcIik7XG4gICAgICB0cmlnZ2VyKCk7XG4gICAgfSwgZmFsc2UpO1xuICAgIHJldHVybiBwLnRoZW4odiA9PiBsb2FkRW5kKHAsIHYsIHVuZGVmaW5lZCwgbG9va3VwKSwgZSA9PiBsb2FkRW5kKHAsIHVuZGVmaW5lZCwgY2FzdEVycm9yKGUpLCBsb29rdXApKTtcbiAgfVxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhyZWFkLCB7XG4gICAgc3RhdGU6IHtcbiAgICAgIGdldDogKCkgPT4gc3RhdGUoKVxuICAgIH0sXG4gICAgZXJyb3I6IHtcbiAgICAgIGdldDogKCkgPT4gZXJyb3IoKVxuICAgIH0sXG4gICAgbG9hZGluZzoge1xuICAgICAgZ2V0KCkge1xuICAgICAgICBjb25zdCBzID0gc3RhdGUoKTtcbiAgICAgICAgcmV0dXJuIHMgPT09IFwicGVuZGluZ1wiIHx8IHMgPT09IFwicmVmcmVzaGluZ1wiO1xuICAgICAgfVxuICAgIH0sXG4gICAgbGF0ZXN0OiB7XG4gICAgICBnZXQoKSB7XG4gICAgICAgIGlmICghcmVzb2x2ZWQpIHJldHVybiByZWFkKCk7XG4gICAgICAgIGNvbnN0IGVyciA9IGVycm9yKCk7XG4gICAgICAgIGlmIChlcnIgJiYgIXByKSB0aHJvdyBlcnI7XG4gICAgICAgIHJldHVybiB2YWx1ZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG4gIGxldCBvd25lciA9IE93bmVyO1xuICBpZiAoZHluYW1pYykgY3JlYXRlQ29tcHV0ZWQoKCkgPT4gKG93bmVyID0gT3duZXIsIGxvYWQoZmFsc2UpKSk7ZWxzZSBsb2FkKGZhbHNlKTtcbiAgcmV0dXJuIFtyZWFkLCB7XG4gICAgcmVmZXRjaDogaW5mbyA9PiBydW5XaXRoT3duZXIob3duZXIsICgpID0+IGxvYWQoaW5mbykpLFxuICAgIG11dGF0ZTogc2V0VmFsdWVcbiAgfV07XG59XG5mdW5jdGlvbiBjcmVhdGVEZWZlcnJlZChzb3VyY2UsIG9wdGlvbnMpIHtcbiAgbGV0IHQsXG4gICAgdGltZW91dCA9IG9wdGlvbnMgPyBvcHRpb25zLnRpbWVvdXRNcyA6IHVuZGVmaW5lZDtcbiAgY29uc3Qgbm9kZSA9IGNyZWF0ZUNvbXB1dGF0aW9uKCgpID0+IHtcbiAgICBpZiAoIXQgfHwgIXQuZm4pIHQgPSByZXF1ZXN0Q2FsbGJhY2soKCkgPT4gc2V0RGVmZXJyZWQoKCkgPT4gbm9kZS52YWx1ZSksIHRpbWVvdXQgIT09IHVuZGVmaW5lZCA/IHtcbiAgICAgIHRpbWVvdXRcbiAgICB9IDogdW5kZWZpbmVkKTtcbiAgICByZXR1cm4gc291cmNlKCk7XG4gIH0sIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIGNvbnN0IFtkZWZlcnJlZCwgc2V0RGVmZXJyZWRdID0gY3JlYXRlU2lnbmFsKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUsIG9wdGlvbnMpO1xuICB1cGRhdGVDb21wdXRhdGlvbihub2RlKTtcbiAgc2V0RGVmZXJyZWQoKCkgPT4gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcgJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyhub2RlKSA/IG5vZGUudFZhbHVlIDogbm9kZS52YWx1ZSk7XG4gIHJldHVybiBkZWZlcnJlZDtcbn1cbmZ1bmN0aW9uIGNyZWF0ZVNlbGVjdG9yKHNvdXJjZSwgZm4gPSBlcXVhbEZuLCBvcHRpb25zKSB7XG4gIGNvbnN0IHN1YnMgPSBuZXcgTWFwKCk7XG4gIGNvbnN0IG5vZGUgPSBjcmVhdGVDb21wdXRhdGlvbihwID0+IHtcbiAgICBjb25zdCB2ID0gc291cmNlKCk7XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWxdIG9mIHN1YnMuZW50cmllcygpKSBpZiAoZm4oa2V5LCB2KSAhPT0gZm4oa2V5LCBwKSkge1xuICAgICAgZm9yIChjb25zdCBjIG9mIHZhbC52YWx1ZXMoKSkge1xuICAgICAgICBjLnN0YXRlID0gU1RBTEU7XG4gICAgICAgIGlmIChjLnB1cmUpIFVwZGF0ZXMucHVzaChjKTtlbHNlIEVmZmVjdHMucHVzaChjKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHY7XG4gIH0sIHVuZGVmaW5lZCwgdHJ1ZSwgU1RBTEUsIG9wdGlvbnMgKTtcbiAgdXBkYXRlQ29tcHV0YXRpb24obm9kZSk7XG4gIHJldHVybiBrZXkgPT4ge1xuICAgIGNvbnN0IGxpc3RlbmVyID0gTGlzdGVuZXI7XG4gICAgaWYgKGxpc3RlbmVyKSB7XG4gICAgICBsZXQgbDtcbiAgICAgIGlmIChsID0gc3Vicy5nZXQoa2V5KSkgbC5hZGQobGlzdGVuZXIpO2Vsc2Ugc3Vicy5zZXQoa2V5LCBsID0gbmV3IFNldChbbGlzdGVuZXJdKSk7XG4gICAgICBvbkNsZWFudXAoKCkgPT4ge1xuICAgICAgICBsLmRlbGV0ZShsaXN0ZW5lcik7XG4gICAgICAgICFsLnNpemUgJiYgc3Vicy5kZWxldGUoa2V5KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gZm4oa2V5LCBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlKTtcbiAgfTtcbn1cbmZ1bmN0aW9uIGJhdGNoKGZuKSB7XG4gIHJldHVybiBydW5VcGRhdGVzKGZuLCBmYWxzZSk7XG59XG5mdW5jdGlvbiB1bnRyYWNrKGZuKSB7XG4gIGlmICghRXh0ZXJuYWxTb3VyY2VDb25maWcgJiYgTGlzdGVuZXIgPT09IG51bGwpIHJldHVybiBmbigpO1xuICBjb25zdCBsaXN0ZW5lciA9IExpc3RlbmVyO1xuICBMaXN0ZW5lciA9IG51bGw7XG4gIHRyeSB7XG4gICAgaWYgKEV4dGVybmFsU291cmNlQ29uZmlnKSByZXR1cm4gRXh0ZXJuYWxTb3VyY2VDb25maWcudW50cmFjayhmbik7XG4gICAgcmV0dXJuIGZuKCk7XG4gIH0gZmluYWxseSB7XG4gICAgTGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgfVxufVxuZnVuY3Rpb24gb24oZGVwcywgZm4sIG9wdGlvbnMpIHtcbiAgY29uc3QgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkoZGVwcyk7XG4gIGxldCBwcmV2SW5wdXQ7XG4gIGxldCBkZWZlciA9IG9wdGlvbnMgJiYgb3B0aW9ucy5kZWZlcjtcbiAgcmV0dXJuIHByZXZWYWx1ZSA9PiB7XG4gICAgbGV0IGlucHV0O1xuICAgIGlmIChpc0FycmF5KSB7XG4gICAgICBpbnB1dCA9IEFycmF5KGRlcHMubGVuZ3RoKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGVwcy5sZW5ndGg7IGkrKykgaW5wdXRbaV0gPSBkZXBzW2ldKCk7XG4gICAgfSBlbHNlIGlucHV0ID0gZGVwcygpO1xuICAgIGlmIChkZWZlcikge1xuICAgICAgZGVmZXIgPSBmYWxzZTtcbiAgICAgIHJldHVybiBwcmV2VmFsdWU7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IHVudHJhY2soKCkgPT4gZm4oaW5wdXQsIHByZXZJbnB1dCwgcHJldlZhbHVlKSk7XG4gICAgcHJldklucHV0ID0gaW5wdXQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcbn1cbmZ1bmN0aW9uIG9uTW91bnQoZm4pIHtcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHVudHJhY2soZm4pKTtcbn1cbmZ1bmN0aW9uIG9uQ2xlYW51cChmbikge1xuICBpZiAoT3duZXIgPT09IG51bGwpIGNvbnNvbGUud2FybihcImNsZWFudXBzIGNyZWF0ZWQgb3V0c2lkZSBhIGBjcmVhdGVSb290YCBvciBgcmVuZGVyYCB3aWxsIG5ldmVyIGJlIHJ1blwiKTtlbHNlIGlmIChPd25lci5jbGVhbnVwcyA9PT0gbnVsbCkgT3duZXIuY2xlYW51cHMgPSBbZm5dO2Vsc2UgT3duZXIuY2xlYW51cHMucHVzaChmbik7XG4gIHJldHVybiBmbjtcbn1cbmZ1bmN0aW9uIGNhdGNoRXJyb3IoZm4sIGhhbmRsZXIpIHtcbiAgRVJST1IgfHwgKEVSUk9SID0gU3ltYm9sKFwiZXJyb3JcIikpO1xuICBPd25lciA9IGNyZWF0ZUNvbXB1dGF0aW9uKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgT3duZXIuY29udGV4dCA9IHtcbiAgICAuLi5Pd25lci5jb250ZXh0LFxuICAgIFtFUlJPUl06IFtoYW5kbGVyXVxuICB9O1xuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIFRyYW5zaXRpb24uc291cmNlcy5hZGQoT3duZXIpO1xuICB0cnkge1xuICAgIHJldHVybiBmbigpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBoYW5kbGVFcnJvcihlcnIpO1xuICB9IGZpbmFsbHkge1xuICAgIE93bmVyID0gT3duZXIub3duZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIGdldExpc3RlbmVyKCkge1xuICByZXR1cm4gTGlzdGVuZXI7XG59XG5mdW5jdGlvbiBnZXRPd25lcigpIHtcbiAgcmV0dXJuIE93bmVyO1xufVxuZnVuY3Rpb24gcnVuV2l0aE93bmVyKG8sIGZuKSB7XG4gIGNvbnN0IHByZXYgPSBPd25lcjtcbiAgY29uc3QgcHJldkxpc3RlbmVyID0gTGlzdGVuZXI7XG4gIE93bmVyID0gbztcbiAgTGlzdGVuZXIgPSBudWxsO1xuICB0cnkge1xuICAgIHJldHVybiBydW5VcGRhdGVzKGZuLCB0cnVlKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaGFuZGxlRXJyb3IoZXJyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBPd25lciA9IHByZXY7XG4gICAgTGlzdGVuZXIgPSBwcmV2TGlzdGVuZXI7XG4gIH1cbn1cbmZ1bmN0aW9uIGVuYWJsZVNjaGVkdWxpbmcoc2NoZWR1bGVyID0gcmVxdWVzdENhbGxiYWNrKSB7XG4gIFNjaGVkdWxlciA9IHNjaGVkdWxlcjtcbn1cbmZ1bmN0aW9uIHN0YXJ0VHJhbnNpdGlvbihmbikge1xuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICBmbigpO1xuICAgIHJldHVybiBUcmFuc2l0aW9uLmRvbmU7XG4gIH1cbiAgY29uc3QgbCA9IExpc3RlbmVyO1xuICBjb25zdCBvID0gT3duZXI7XG4gIHJldHVybiBQcm9taXNlLnJlc29sdmUoKS50aGVuKCgpID0+IHtcbiAgICBMaXN0ZW5lciA9IGw7XG4gICAgT3duZXIgPSBvO1xuICAgIGxldCB0O1xuICAgIGlmIChTY2hlZHVsZXIgfHwgU3VzcGVuc2VDb250ZXh0KSB7XG4gICAgICB0ID0gVHJhbnNpdGlvbiB8fCAoVHJhbnNpdGlvbiA9IHtcbiAgICAgICAgc291cmNlczogbmV3IFNldCgpLFxuICAgICAgICBlZmZlY3RzOiBbXSxcbiAgICAgICAgcHJvbWlzZXM6IG5ldyBTZXQoKSxcbiAgICAgICAgZGlzcG9zZWQ6IG5ldyBTZXQoKSxcbiAgICAgICAgcXVldWU6IG5ldyBTZXQoKSxcbiAgICAgICAgcnVubmluZzogdHJ1ZVxuICAgICAgfSk7XG4gICAgICB0LmRvbmUgfHwgKHQuZG9uZSA9IG5ldyBQcm9taXNlKHJlcyA9PiB0LnJlc29sdmUgPSByZXMpKTtcbiAgICAgIHQucnVubmluZyA9IHRydWU7XG4gICAgfVxuICAgIHJ1blVwZGF0ZXMoZm4sIGZhbHNlKTtcbiAgICBMaXN0ZW5lciA9IE93bmVyID0gbnVsbDtcbiAgICByZXR1cm4gdCA/IHQuZG9uZSA6IHVuZGVmaW5lZDtcbiAgfSk7XG59XG5jb25zdCBbdHJhbnNQZW5kaW5nLCBzZXRUcmFuc1BlbmRpbmddID0gLypAX19QVVJFX18qL2NyZWF0ZVNpZ25hbChmYWxzZSk7XG5mdW5jdGlvbiB1c2VUcmFuc2l0aW9uKCkge1xuICByZXR1cm4gW3RyYW5zUGVuZGluZywgc3RhcnRUcmFuc2l0aW9uXTtcbn1cbmZ1bmN0aW9uIHJlc3VtZUVmZmVjdHMoZSkge1xuICBFZmZlY3RzLnB1c2guYXBwbHkoRWZmZWN0cywgZSk7XG4gIGUubGVuZ3RoID0gMDtcbn1cbmZ1bmN0aW9uIGRldkNvbXBvbmVudChDb21wLCBwcm9wcykge1xuICBjb25zdCBjID0gY3JlYXRlQ29tcHV0YXRpb24oKCkgPT4gdW50cmFjaygoKSA9PiB7XG4gICAgT2JqZWN0LmFzc2lnbihDb21wLCB7XG4gICAgICBbJERFVkNPTVBdOiB0cnVlXG4gICAgfSk7XG4gICAgcmV0dXJuIENvbXAocHJvcHMpO1xuICB9KSwgdW5kZWZpbmVkLCB0cnVlLCAwKTtcbiAgYy5wcm9wcyA9IHByb3BzO1xuICBjLm9ic2VydmVycyA9IG51bGw7XG4gIGMub2JzZXJ2ZXJTbG90cyA9IG51bGw7XG4gIGMubmFtZSA9IENvbXAubmFtZTtcbiAgYy5jb21wb25lbnQgPSBDb21wO1xuICB1cGRhdGVDb21wdXRhdGlvbihjKTtcbiAgcmV0dXJuIGMudFZhbHVlICE9PSB1bmRlZmluZWQgPyBjLnRWYWx1ZSA6IGMudmFsdWU7XG59XG5mdW5jdGlvbiByZWdpc3RlckdyYXBoKHZhbHVlKSB7XG4gIGlmIChPd25lcikge1xuICAgIGlmIChPd25lci5zb3VyY2VNYXApIE93bmVyLnNvdXJjZU1hcC5wdXNoKHZhbHVlKTtlbHNlIE93bmVyLnNvdXJjZU1hcCA9IFt2YWx1ZV07XG4gICAgdmFsdWUuZ3JhcGggPSBPd25lcjtcbiAgfVxuICBpZiAoRGV2SG9va3MuYWZ0ZXJSZWdpc3RlckdyYXBoKSBEZXZIb29rcy5hZnRlclJlZ2lzdGVyR3JhcGgodmFsdWUpO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29udGV4dChkZWZhdWx0VmFsdWUsIG9wdGlvbnMpIHtcbiAgY29uc3QgaWQgPSBTeW1ib2woXCJjb250ZXh0XCIpO1xuICByZXR1cm4ge1xuICAgIGlkLFxuICAgIFByb3ZpZGVyOiBjcmVhdGVQcm92aWRlcihpZCwgb3B0aW9ucyksXG4gICAgZGVmYXVsdFZhbHVlXG4gIH07XG59XG5mdW5jdGlvbiB1c2VDb250ZXh0KGNvbnRleHQpIHtcbiAgbGV0IHZhbHVlO1xuICByZXR1cm4gT3duZXIgJiYgT3duZXIuY29udGV4dCAmJiAodmFsdWUgPSBPd25lci5jb250ZXh0W2NvbnRleHQuaWRdKSAhPT0gdW5kZWZpbmVkID8gdmFsdWUgOiBjb250ZXh0LmRlZmF1bHRWYWx1ZTtcbn1cbmZ1bmN0aW9uIGNoaWxkcmVuKGZuKSB7XG4gIGNvbnN0IGNoaWxkcmVuID0gY3JlYXRlTWVtbyhmbik7XG4gIGNvbnN0IG1lbW8gPSBjcmVhdGVNZW1vKCgpID0+IHJlc29sdmVDaGlsZHJlbihjaGlsZHJlbigpKSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJjaGlsZHJlblwiXG4gIH0pIDtcbiAgbWVtby50b0FycmF5ID0gKCkgPT4ge1xuICAgIGNvbnN0IGMgPSBtZW1vKCk7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYykgPyBjIDogYyAhPSBudWxsID8gW2NdIDogW107XG4gIH07XG4gIHJldHVybiBtZW1vO1xufVxubGV0IFN1c3BlbnNlQ29udGV4dDtcbmZ1bmN0aW9uIGdldFN1c3BlbnNlQ29udGV4dCgpIHtcbiAgcmV0dXJuIFN1c3BlbnNlQ29udGV4dCB8fCAoU3VzcGVuc2VDb250ZXh0ID0gY3JlYXRlQ29udGV4dCgpKTtcbn1cbmZ1bmN0aW9uIGVuYWJsZUV4dGVybmFsU291cmNlKGZhY3RvcnksIHVudHJhY2sgPSBmbiA9PiBmbigpKSB7XG4gIGlmIChFeHRlcm5hbFNvdXJjZUNvbmZpZykge1xuICAgIGNvbnN0IHtcbiAgICAgIGZhY3Rvcnk6IG9sZEZhY3RvcnksXG4gICAgICB1bnRyYWNrOiBvbGRVbnRyYWNrXG4gICAgfSA9IEV4dGVybmFsU291cmNlQ29uZmlnO1xuICAgIEV4dGVybmFsU291cmNlQ29uZmlnID0ge1xuICAgICAgZmFjdG9yeTogKGZuLCB0cmlnZ2VyKSA9PiB7XG4gICAgICAgIGNvbnN0IG9sZFNvdXJjZSA9IG9sZEZhY3RvcnkoZm4sIHRyaWdnZXIpO1xuICAgICAgICBjb25zdCBzb3VyY2UgPSBmYWN0b3J5KHggPT4gb2xkU291cmNlLnRyYWNrKHgpLCB0cmlnZ2VyKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0cmFjazogeCA9PiBzb3VyY2UudHJhY2soeCksXG4gICAgICAgICAgZGlzcG9zZSgpIHtcbiAgICAgICAgICAgIHNvdXJjZS5kaXNwb3NlKCk7XG4gICAgICAgICAgICBvbGRTb3VyY2UuZGlzcG9zZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICB1bnRyYWNrOiBmbiA9PiBvbGRVbnRyYWNrKCgpID0+IHVudHJhY2soZm4pKVxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgRXh0ZXJuYWxTb3VyY2VDb25maWcgPSB7XG4gICAgICBmYWN0b3J5LFxuICAgICAgdW50cmFja1xuICAgIH07XG4gIH1cbn1cbmZ1bmN0aW9uIHJlYWRTaWduYWwoKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGlmICh0aGlzLnNvdXJjZXMgJiYgKHJ1bm5pbmdUcmFuc2l0aW9uID8gdGhpcy50U3RhdGUgOiB0aGlzLnN0YXRlKSkge1xuICAgIGlmICgocnVubmluZ1RyYW5zaXRpb24gPyB0aGlzLnRTdGF0ZSA6IHRoaXMuc3RhdGUpID09PSBTVEFMRSkgdXBkYXRlQ29tcHV0YXRpb24odGhpcyk7ZWxzZSB7XG4gICAgICBjb25zdCB1cGRhdGVzID0gVXBkYXRlcztcbiAgICAgIFVwZGF0ZXMgPSBudWxsO1xuICAgICAgcnVuVXBkYXRlcygoKSA9PiBsb29rVXBzdHJlYW0odGhpcyksIGZhbHNlKTtcbiAgICAgIFVwZGF0ZXMgPSB1cGRhdGVzO1xuICAgIH1cbiAgfVxuICBpZiAoTGlzdGVuZXIpIHtcbiAgICBjb25zdCBzU2xvdCA9IHRoaXMub2JzZXJ2ZXJzID8gdGhpcy5vYnNlcnZlcnMubGVuZ3RoIDogMDtcbiAgICBpZiAoIUxpc3RlbmVyLnNvdXJjZXMpIHtcbiAgICAgIExpc3RlbmVyLnNvdXJjZXMgPSBbdGhpc107XG4gICAgICBMaXN0ZW5lci5zb3VyY2VTbG90cyA9IFtzU2xvdF07XG4gICAgfSBlbHNlIHtcbiAgICAgIExpc3RlbmVyLnNvdXJjZXMucHVzaCh0aGlzKTtcbiAgICAgIExpc3RlbmVyLnNvdXJjZVNsb3RzLnB1c2goc1Nsb3QpO1xuICAgIH1cbiAgICBpZiAoIXRoaXMub2JzZXJ2ZXJzKSB7XG4gICAgICB0aGlzLm9ic2VydmVycyA9IFtMaXN0ZW5lcl07XG4gICAgICB0aGlzLm9ic2VydmVyU2xvdHMgPSBbTGlzdGVuZXIuc291cmNlcy5sZW5ndGggLSAxXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vYnNlcnZlcnMucHVzaChMaXN0ZW5lcik7XG4gICAgICB0aGlzLm9ic2VydmVyU2xvdHMucHVzaChMaXN0ZW5lci5zb3VyY2VzLmxlbmd0aCAtIDEpO1xuICAgIH1cbiAgfVxuICBpZiAocnVubmluZ1RyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5zb3VyY2VzLmhhcyh0aGlzKSkgcmV0dXJuIHRoaXMudFZhbHVlO1xuICByZXR1cm4gdGhpcy52YWx1ZTtcbn1cbmZ1bmN0aW9uIHdyaXRlU2lnbmFsKG5vZGUsIHZhbHVlLCBpc0NvbXApIHtcbiAgbGV0IGN1cnJlbnQgPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZyAmJiBUcmFuc2l0aW9uLnNvdXJjZXMuaGFzKG5vZGUpID8gbm9kZS50VmFsdWUgOiBub2RlLnZhbHVlO1xuICBpZiAoIW5vZGUuY29tcGFyYXRvciB8fCAhbm9kZS5jb21wYXJhdG9yKGN1cnJlbnQsIHZhbHVlKSkge1xuICAgIGlmIChUcmFuc2l0aW9uKSB7XG4gICAgICBjb25zdCBUcmFuc2l0aW9uUnVubmluZyA9IFRyYW5zaXRpb24ucnVubmluZztcbiAgICAgIGlmIChUcmFuc2l0aW9uUnVubmluZyB8fCAhaXNDb21wICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkpIHtcbiAgICAgICAgVHJhbnNpdGlvbi5zb3VyY2VzLmFkZChub2RlKTtcbiAgICAgICAgbm9kZS50VmFsdWUgPSB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIGlmICghVHJhbnNpdGlvblJ1bm5pbmcpIG5vZGUudmFsdWUgPSB2YWx1ZTtcbiAgICB9IGVsc2Ugbm9kZS52YWx1ZSA9IHZhbHVlO1xuICAgIGlmIChub2RlLm9ic2VydmVycyAmJiBub2RlLm9ic2VydmVycy5sZW5ndGgpIHtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUub2JzZXJ2ZXJzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgY29uc3QgbyA9IG5vZGUub2JzZXJ2ZXJzW2ldO1xuICAgICAgICAgIGNvbnN0IFRyYW5zaXRpb25SdW5uaW5nID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gICAgICAgICAgaWYgKFRyYW5zaXRpb25SdW5uaW5nICYmIFRyYW5zaXRpb24uZGlzcG9zZWQuaGFzKG8pKSBjb250aW51ZTtcbiAgICAgICAgICBpZiAoVHJhbnNpdGlvblJ1bm5pbmcgPyAhby50U3RhdGUgOiAhby5zdGF0ZSkge1xuICAgICAgICAgICAgaWYgKG8ucHVyZSkgVXBkYXRlcy5wdXNoKG8pO2Vsc2UgRWZmZWN0cy5wdXNoKG8pO1xuICAgICAgICAgICAgaWYgKG8ub2JzZXJ2ZXJzKSBtYXJrRG93bnN0cmVhbShvKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFUcmFuc2l0aW9uUnVubmluZykgby5zdGF0ZSA9IFNUQUxFO2Vsc2Ugby50U3RhdGUgPSBTVEFMRTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoVXBkYXRlcy5sZW5ndGggPiAxMGU1KSB7XG4gICAgICAgICAgVXBkYXRlcyA9IFtdO1xuICAgICAgICAgIGlmIChJU19ERVYpIHRocm93IG5ldyBFcnJvcihcIlBvdGVudGlhbCBJbmZpbml0ZSBMb29wIERldGVjdGVkLlwiKTtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgfSwgZmFsc2UpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5mdW5jdGlvbiB1cGRhdGVDb21wdXRhdGlvbihub2RlKSB7XG4gIGlmICghbm9kZS5mbikgcmV0dXJuO1xuICBjbGVhbk5vZGUobm9kZSk7XG4gIGNvbnN0IHRpbWUgPSBFeGVjQ291bnQ7XG4gIHJ1bkNvbXB1dGF0aW9uKG5vZGUsIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkgPyBub2RlLnRWYWx1ZSA6IG5vZGUudmFsdWUsIHRpbWUpO1xuICBpZiAoVHJhbnNpdGlvbiAmJiAhVHJhbnNpdGlvbi5ydW5uaW5nICYmIFRyYW5zaXRpb24uc291cmNlcy5oYXMobm9kZSkpIHtcbiAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IHtcbiAgICAgICAgVHJhbnNpdGlvbiAmJiAoVHJhbnNpdGlvbi5ydW5uaW5nID0gdHJ1ZSk7XG4gICAgICAgIExpc3RlbmVyID0gT3duZXIgPSBub2RlO1xuICAgICAgICBydW5Db21wdXRhdGlvbihub2RlLCBub2RlLnRWYWx1ZSwgdGltZSk7XG4gICAgICAgIExpc3RlbmVyID0gT3duZXIgPSBudWxsO1xuICAgICAgfSwgZmFsc2UpO1xuICAgIH0pO1xuICB9XG59XG5mdW5jdGlvbiBydW5Db21wdXRhdGlvbihub2RlLCB2YWx1ZSwgdGltZSkge1xuICBsZXQgbmV4dFZhbHVlO1xuICBjb25zdCBvd25lciA9IE93bmVyLFxuICAgIGxpc3RlbmVyID0gTGlzdGVuZXI7XG4gIExpc3RlbmVyID0gT3duZXIgPSBub2RlO1xuICB0cnkge1xuICAgIG5leHRWYWx1ZSA9IG5vZGUuZm4odmFsdWUpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAobm9kZS5wdXJlKSB7XG4gICAgICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICAgICAgbm9kZS50U3RhdGUgPSBTVEFMRTtcbiAgICAgICAgbm9kZS50T3duZWQgJiYgbm9kZS50T3duZWQuZm9yRWFjaChjbGVhbk5vZGUpO1xuICAgICAgICBub2RlLnRPd25lZCA9IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5vZGUuc3RhdGUgPSBTVEFMRTtcbiAgICAgICAgbm9kZS5vd25lZCAmJiBub2RlLm93bmVkLmZvckVhY2goY2xlYW5Ob2RlKTtcbiAgICAgICAgbm9kZS5vd25lZCA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIG5vZGUudXBkYXRlZEF0ID0gdGltZSArIDE7XG4gICAgcmV0dXJuIGhhbmRsZUVycm9yKGVycik7XG4gIH0gZmluYWxseSB7XG4gICAgTGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgICBPd25lciA9IG93bmVyO1xuICB9XG4gIGlmICghbm9kZS51cGRhdGVkQXQgfHwgbm9kZS51cGRhdGVkQXQgPD0gdGltZSkge1xuICAgIGlmIChub2RlLnVwZGF0ZWRBdCAhPSBudWxsICYmIFwib2JzZXJ2ZXJzXCIgaW4gbm9kZSkge1xuICAgICAgd3JpdGVTaWduYWwobm9kZSwgbmV4dFZhbHVlLCB0cnVlKTtcbiAgICB9IGVsc2UgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIG5vZGUucHVyZSkge1xuICAgICAgVHJhbnNpdGlvbi5zb3VyY2VzLmFkZChub2RlKTtcbiAgICAgIG5vZGUudFZhbHVlID0gbmV4dFZhbHVlO1xuICAgIH0gZWxzZSBub2RlLnZhbHVlID0gbmV4dFZhbHVlO1xuICAgIG5vZGUudXBkYXRlZEF0ID0gdGltZTtcbiAgfVxufVxuZnVuY3Rpb24gY3JlYXRlQ29tcHV0YXRpb24oZm4sIGluaXQsIHB1cmUsIHN0YXRlID0gU1RBTEUsIG9wdGlvbnMpIHtcbiAgY29uc3QgYyA9IHtcbiAgICBmbixcbiAgICBzdGF0ZTogc3RhdGUsXG4gICAgdXBkYXRlZEF0OiBudWxsLFxuICAgIG93bmVkOiBudWxsLFxuICAgIHNvdXJjZXM6IG51bGwsXG4gICAgc291cmNlU2xvdHM6IG51bGwsXG4gICAgY2xlYW51cHM6IG51bGwsXG4gICAgdmFsdWU6IGluaXQsXG4gICAgb3duZXI6IE93bmVyLFxuICAgIGNvbnRleHQ6IE93bmVyID8gT3duZXIuY29udGV4dCA6IG51bGwsXG4gICAgcHVyZVxuICB9O1xuICBpZiAoVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICBjLnN0YXRlID0gMDtcbiAgICBjLnRTdGF0ZSA9IHN0YXRlO1xuICB9XG4gIGlmIChPd25lciA9PT0gbnVsbCkgY29uc29sZS53YXJuKFwiY29tcHV0YXRpb25zIGNyZWF0ZWQgb3V0c2lkZSBhIGBjcmVhdGVSb290YCBvciBgcmVuZGVyYCB3aWxsIG5ldmVyIGJlIGRpc3Bvc2VkXCIpO2Vsc2UgaWYgKE93bmVyICE9PSBVTk9XTkVEKSB7XG4gICAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIE93bmVyLnB1cmUpIHtcbiAgICAgIGlmICghT3duZXIudE93bmVkKSBPd25lci50T3duZWQgPSBbY107ZWxzZSBPd25lci50T3duZWQucHVzaChjKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFPd25lci5vd25lZCkgT3duZXIub3duZWQgPSBbY107ZWxzZSBPd25lci5vd25lZC5wdXNoKGMpO1xuICAgIH1cbiAgfVxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLm5hbWUpIGMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgaWYgKEV4dGVybmFsU291cmNlQ29uZmlnICYmIGMuZm4pIHtcbiAgICBjb25zdCBbdHJhY2ssIHRyaWdnZXJdID0gY3JlYXRlU2lnbmFsKHVuZGVmaW5lZCwge1xuICAgICAgZXF1YWxzOiBmYWxzZVxuICAgIH0pO1xuICAgIGNvbnN0IG9yZGluYXJ5ID0gRXh0ZXJuYWxTb3VyY2VDb25maWcuZmFjdG9yeShjLmZuLCB0cmlnZ2VyKTtcbiAgICBvbkNsZWFudXAoKCkgPT4gb3JkaW5hcnkuZGlzcG9zZSgpKTtcbiAgICBjb25zdCB0cmlnZ2VySW5UcmFuc2l0aW9uID0gKCkgPT4gc3RhcnRUcmFuc2l0aW9uKHRyaWdnZXIpLnRoZW4oKCkgPT4gaW5UcmFuc2l0aW9uLmRpc3Bvc2UoKSk7XG4gICAgY29uc3QgaW5UcmFuc2l0aW9uID0gRXh0ZXJuYWxTb3VyY2VDb25maWcuZmFjdG9yeShjLmZuLCB0cmlnZ2VySW5UcmFuc2l0aW9uKTtcbiAgICBjLmZuID0geCA9PiB7XG4gICAgICB0cmFjaygpO1xuICAgICAgcmV0dXJuIFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nID8gaW5UcmFuc2l0aW9uLnRyYWNrKHgpIDogb3JkaW5hcnkudHJhY2soeCk7XG4gICAgfTtcbiAgfVxuICBEZXZIb29rcy5hZnRlckNyZWF0ZU93bmVyICYmIERldkhvb2tzLmFmdGVyQ3JlYXRlT3duZXIoYyk7XG4gIHJldHVybiBjO1xufVxuZnVuY3Rpb24gcnVuVG9wKG5vZGUpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgPT09IDApIHJldHVybjtcbiAgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgPT09IFBFTkRJTkcpIHJldHVybiBsb29rVXBzdHJlYW0obm9kZSk7XG4gIGlmIChub2RlLnN1c3BlbnNlICYmIHVudHJhY2sobm9kZS5zdXNwZW5zZS5pbkZhbGxiYWNrKSkgcmV0dXJuIG5vZGUuc3VzcGVuc2UuZWZmZWN0cy5wdXNoKG5vZGUpO1xuICBjb25zdCBhbmNlc3RvcnMgPSBbbm9kZV07XG4gIHdoaWxlICgobm9kZSA9IG5vZGUub3duZXIpICYmICghbm9kZS51cGRhdGVkQXQgfHwgbm9kZS51cGRhdGVkQXQgPCBFeGVjQ291bnQpKSB7XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24uZGlzcG9zZWQuaGFzKG5vZGUpKSByZXR1cm47XG4gICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uID8gbm9kZS50U3RhdGUgOiBub2RlLnN0YXRlKSBhbmNlc3RvcnMucHVzaChub2RlKTtcbiAgfVxuICBmb3IgKGxldCBpID0gYW5jZXN0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgbm9kZSA9IGFuY2VzdG9yc1tpXTtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24pIHtcbiAgICAgIGxldCB0b3AgPSBub2RlLFxuICAgICAgICBwcmV2ID0gYW5jZXN0b3JzW2kgKyAxXTtcbiAgICAgIHdoaWxlICgodG9wID0gdG9wLm93bmVyKSAmJiB0b3AgIT09IHByZXYpIHtcbiAgICAgICAgaWYgKFRyYW5zaXRpb24uZGlzcG9zZWQuaGFzKHRvcCkpIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgPT09IFNUQUxFKSB7XG4gICAgICB1cGRhdGVDb21wdXRhdGlvbihub2RlKTtcbiAgICB9IGVsc2UgaWYgKChydW5uaW5nVHJhbnNpdGlvbiA/IG5vZGUudFN0YXRlIDogbm9kZS5zdGF0ZSkgPT09IFBFTkRJTkcpIHtcbiAgICAgIGNvbnN0IHVwZGF0ZXMgPSBVcGRhdGVzO1xuICAgICAgVXBkYXRlcyA9IG51bGw7XG4gICAgICBydW5VcGRhdGVzKCgpID0+IGxvb2tVcHN0cmVhbShub2RlLCBhbmNlc3RvcnNbMF0pLCBmYWxzZSk7XG4gICAgICBVcGRhdGVzID0gdXBkYXRlcztcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIHJ1blVwZGF0ZXMoZm4sIGluaXQpIHtcbiAgaWYgKFVwZGF0ZXMpIHJldHVybiBmbigpO1xuICBsZXQgd2FpdCA9IGZhbHNlO1xuICBpZiAoIWluaXQpIFVwZGF0ZXMgPSBbXTtcbiAgaWYgKEVmZmVjdHMpIHdhaXQgPSB0cnVlO2Vsc2UgRWZmZWN0cyA9IFtdO1xuICBFeGVjQ291bnQrKztcbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBmbigpO1xuICAgIGNvbXBsZXRlVXBkYXRlcyh3YWl0KTtcbiAgICByZXR1cm4gcmVzO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoIXdhaXQpIEVmZmVjdHMgPSBudWxsO1xuICAgIFVwZGF0ZXMgPSBudWxsO1xuICAgIGhhbmRsZUVycm9yKGVycik7XG4gIH1cbn1cbmZ1bmN0aW9uIGNvbXBsZXRlVXBkYXRlcyh3YWl0KSB7XG4gIGlmIChVcGRhdGVzKSB7XG4gICAgaWYgKFNjaGVkdWxlciAmJiBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZykgc2NoZWR1bGVRdWV1ZShVcGRhdGVzKTtlbHNlIHJ1blF1ZXVlKFVwZGF0ZXMpO1xuICAgIFVwZGF0ZXMgPSBudWxsO1xuICB9XG4gIGlmICh3YWl0KSByZXR1cm47XG4gIGxldCByZXM7XG4gIGlmIChUcmFuc2l0aW9uKSB7XG4gICAgaWYgKCFUcmFuc2l0aW9uLnByb21pc2VzLnNpemUgJiYgIVRyYW5zaXRpb24ucXVldWUuc2l6ZSkge1xuICAgICAgY29uc3Qgc291cmNlcyA9IFRyYW5zaXRpb24uc291cmNlcztcbiAgICAgIGNvbnN0IGRpc3Bvc2VkID0gVHJhbnNpdGlvbi5kaXNwb3NlZDtcbiAgICAgIEVmZmVjdHMucHVzaC5hcHBseShFZmZlY3RzLCBUcmFuc2l0aW9uLmVmZmVjdHMpO1xuICAgICAgcmVzID0gVHJhbnNpdGlvbi5yZXNvbHZlO1xuICAgICAgZm9yIChjb25zdCBlIG9mIEVmZmVjdHMpIHtcbiAgICAgICAgXCJ0U3RhdGVcIiBpbiBlICYmIChlLnN0YXRlID0gZS50U3RhdGUpO1xuICAgICAgICBkZWxldGUgZS50U3RhdGU7XG4gICAgICB9XG4gICAgICBUcmFuc2l0aW9uID0gbnVsbDtcbiAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICBmb3IgKGNvbnN0IGQgb2YgZGlzcG9zZWQpIGNsZWFuTm9kZShkKTtcbiAgICAgICAgZm9yIChjb25zdCB2IG9mIHNvdXJjZXMpIHtcbiAgICAgICAgICB2LnZhbHVlID0gdi50VmFsdWU7XG4gICAgICAgICAgaWYgKHYub3duZWQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB2Lm93bmVkLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSBjbGVhbk5vZGUodi5vd25lZFtpXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh2LnRPd25lZCkgdi5vd25lZCA9IHYudE93bmVkO1xuICAgICAgICAgIGRlbGV0ZSB2LnRWYWx1ZTtcbiAgICAgICAgICBkZWxldGUgdi50T3duZWQ7XG4gICAgICAgICAgdi50U3RhdGUgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHNldFRyYW5zUGVuZGluZyhmYWxzZSk7XG4gICAgICB9LCBmYWxzZSk7XG4gICAgfSBlbHNlIGlmIChUcmFuc2l0aW9uLnJ1bm5pbmcpIHtcbiAgICAgIFRyYW5zaXRpb24ucnVubmluZyA9IGZhbHNlO1xuICAgICAgVHJhbnNpdGlvbi5lZmZlY3RzLnB1c2guYXBwbHkoVHJhbnNpdGlvbi5lZmZlY3RzLCBFZmZlY3RzKTtcbiAgICAgIEVmZmVjdHMgPSBudWxsO1xuICAgICAgc2V0VHJhbnNQZW5kaW5nKHRydWUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuICBjb25zdCBlID0gRWZmZWN0cztcbiAgRWZmZWN0cyA9IG51bGw7XG4gIGlmIChlLmxlbmd0aCkgcnVuVXBkYXRlcygoKSA9PiBydW5FZmZlY3RzKGUpLCBmYWxzZSk7ZWxzZSBEZXZIb29rcy5hZnRlclVwZGF0ZSAmJiBEZXZIb29rcy5hZnRlclVwZGF0ZSgpO1xuICBpZiAocmVzKSByZXMoKTtcbn1cbmZ1bmN0aW9uIHJ1blF1ZXVlKHF1ZXVlKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHJ1blRvcChxdWV1ZVtpXSk7XG59XG5mdW5jdGlvbiBzY2hlZHVsZVF1ZXVlKHF1ZXVlKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBpdGVtID0gcXVldWVbaV07XG4gICAgY29uc3QgdGFza3MgPSBUcmFuc2l0aW9uLnF1ZXVlO1xuICAgIGlmICghdGFza3MuaGFzKGl0ZW0pKSB7XG4gICAgICB0YXNrcy5hZGQoaXRlbSk7XG4gICAgICBTY2hlZHVsZXIoKCkgPT4ge1xuICAgICAgICB0YXNrcy5kZWxldGUoaXRlbSk7XG4gICAgICAgIHJ1blVwZGF0ZXMoKCkgPT4ge1xuICAgICAgICAgIFRyYW5zaXRpb24ucnVubmluZyA9IHRydWU7XG4gICAgICAgICAgcnVuVG9wKGl0ZW0pO1xuICAgICAgICB9LCBmYWxzZSk7XG4gICAgICAgIFRyYW5zaXRpb24gJiYgKFRyYW5zaXRpb24ucnVubmluZyA9IGZhbHNlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gcnVuVXNlckVmZmVjdHMocXVldWUpIHtcbiAgbGV0IGksXG4gICAgdXNlckxlbmd0aCA9IDA7XG4gIGZvciAoaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGUgPSBxdWV1ZVtpXTtcbiAgICBpZiAoIWUudXNlcikgcnVuVG9wKGUpO2Vsc2UgcXVldWVbdXNlckxlbmd0aCsrXSA9IGU7XG4gIH1cbiAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0KSB7XG4gICAgaWYgKHNoYXJlZENvbmZpZy5jb3VudCkge1xuICAgICAgc2hhcmVkQ29uZmlnLmVmZmVjdHMgfHwgKHNoYXJlZENvbmZpZy5lZmZlY3RzID0gW10pO1xuICAgICAgc2hhcmVkQ29uZmlnLmVmZmVjdHMucHVzaCguLi5xdWV1ZS5zbGljZSgwLCB1c2VyTGVuZ3RoKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHNldEh5ZHJhdGVDb250ZXh0KCk7XG4gIH1cbiAgaWYgKHNoYXJlZENvbmZpZy5lZmZlY3RzICYmIChzaGFyZWRDb25maWcuZG9uZSB8fCAhc2hhcmVkQ29uZmlnLmNvdW50KSkge1xuICAgIHF1ZXVlID0gWy4uLnNoYXJlZENvbmZpZy5lZmZlY3RzLCAuLi5xdWV1ZV07XG4gICAgdXNlckxlbmd0aCArPSBzaGFyZWRDb25maWcuZWZmZWN0cy5sZW5ndGg7XG4gICAgZGVsZXRlIHNoYXJlZENvbmZpZy5lZmZlY3RzO1xuICB9XG4gIGZvciAoaSA9IDA7IGkgPCB1c2VyTGVuZ3RoOyBpKyspIHJ1blRvcChxdWV1ZVtpXSk7XG59XG5mdW5jdGlvbiBsb29rVXBzdHJlYW0obm9kZSwgaWdub3JlKSB7XG4gIGNvbnN0IHJ1bm5pbmdUcmFuc2l0aW9uID0gVHJhbnNpdGlvbiAmJiBUcmFuc2l0aW9uLnJ1bm5pbmc7XG4gIGlmIChydW5uaW5nVHJhbnNpdGlvbikgbm9kZS50U3RhdGUgPSAwO2Vsc2Ugbm9kZS5zdGF0ZSA9IDA7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5zb3VyY2VzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgY29uc3Qgc291cmNlID0gbm9kZS5zb3VyY2VzW2ldO1xuICAgIGlmIChzb3VyY2Uuc291cmNlcykge1xuICAgICAgY29uc3Qgc3RhdGUgPSBydW5uaW5nVHJhbnNpdGlvbiA/IHNvdXJjZS50U3RhdGUgOiBzb3VyY2Uuc3RhdGU7XG4gICAgICBpZiAoc3RhdGUgPT09IFNUQUxFKSB7XG4gICAgICAgIGlmIChzb3VyY2UgIT09IGlnbm9yZSAmJiAoIXNvdXJjZS51cGRhdGVkQXQgfHwgc291cmNlLnVwZGF0ZWRBdCA8IEV4ZWNDb3VudCkpIHJ1blRvcChzb3VyY2UpO1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gUEVORElORykgbG9va1Vwc3RyZWFtKHNvdXJjZSwgaWdub3JlKTtcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIG1hcmtEb3duc3RyZWFtKG5vZGUpIHtcbiAgY29uc3QgcnVubmluZ1RyYW5zaXRpb24gPSBUcmFuc2l0aW9uICYmIFRyYW5zaXRpb24ucnVubmluZztcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLm9ic2VydmVycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGNvbnN0IG8gPSBub2RlLm9ic2VydmVyc1tpXTtcbiAgICBpZiAocnVubmluZ1RyYW5zaXRpb24gPyAhby50U3RhdGUgOiAhby5zdGF0ZSkge1xuICAgICAgaWYgKHJ1bm5pbmdUcmFuc2l0aW9uKSBvLnRTdGF0ZSA9IFBFTkRJTkc7ZWxzZSBvLnN0YXRlID0gUEVORElORztcbiAgICAgIGlmIChvLnB1cmUpIFVwZGF0ZXMucHVzaChvKTtlbHNlIEVmZmVjdHMucHVzaChvKTtcbiAgICAgIG8ub2JzZXJ2ZXJzICYmIG1hcmtEb3duc3RyZWFtKG8pO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gY2xlYW5Ob2RlKG5vZGUpIHtcbiAgbGV0IGk7XG4gIGlmIChub2RlLnNvdXJjZXMpIHtcbiAgICB3aGlsZSAobm9kZS5zb3VyY2VzLmxlbmd0aCkge1xuICAgICAgY29uc3Qgc291cmNlID0gbm9kZS5zb3VyY2VzLnBvcCgpLFxuICAgICAgICBpbmRleCA9IG5vZGUuc291cmNlU2xvdHMucG9wKCksXG4gICAgICAgIG9icyA9IHNvdXJjZS5vYnNlcnZlcnM7XG4gICAgICBpZiAob2JzICYmIG9icy5sZW5ndGgpIHtcbiAgICAgICAgY29uc3QgbiA9IG9icy5wb3AoKSxcbiAgICAgICAgICBzID0gc291cmNlLm9ic2VydmVyU2xvdHMucG9wKCk7XG4gICAgICAgIGlmIChpbmRleCA8IG9icy5sZW5ndGgpIHtcbiAgICAgICAgICBuLnNvdXJjZVNsb3RzW3NdID0gaW5kZXg7XG4gICAgICAgICAgb2JzW2luZGV4XSA9IG47XG4gICAgICAgICAgc291cmNlLm9ic2VydmVyU2xvdHNbaW5kZXhdID0gcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAobm9kZS50T3duZWQpIHtcbiAgICBmb3IgKGkgPSBub2RlLnRPd25lZC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgY2xlYW5Ob2RlKG5vZGUudE93bmVkW2ldKTtcbiAgICBkZWxldGUgbm9kZS50T3duZWQ7XG4gIH1cbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nICYmIG5vZGUucHVyZSkge1xuICAgIHJlc2V0KG5vZGUsIHRydWUpO1xuICB9IGVsc2UgaWYgKG5vZGUub3duZWQpIHtcbiAgICBmb3IgKGkgPSBub2RlLm93bmVkLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBjbGVhbk5vZGUobm9kZS5vd25lZFtpXSk7XG4gICAgbm9kZS5vd25lZCA9IG51bGw7XG4gIH1cbiAgaWYgKG5vZGUuY2xlYW51cHMpIHtcbiAgICBmb3IgKGkgPSBub2RlLmNsZWFudXBzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBub2RlLmNsZWFudXBzW2ldKCk7XG4gICAgbm9kZS5jbGVhbnVwcyA9IG51bGw7XG4gIH1cbiAgaWYgKFRyYW5zaXRpb24gJiYgVHJhbnNpdGlvbi5ydW5uaW5nKSBub2RlLnRTdGF0ZSA9IDA7ZWxzZSBub2RlLnN0YXRlID0gMDtcbiAgZGVsZXRlIG5vZGUuc291cmNlTWFwO1xufVxuZnVuY3Rpb24gcmVzZXQobm9kZSwgdG9wKSB7XG4gIGlmICghdG9wKSB7XG4gICAgbm9kZS50U3RhdGUgPSAwO1xuICAgIFRyYW5zaXRpb24uZGlzcG9zZWQuYWRkKG5vZGUpO1xuICB9XG4gIGlmIChub2RlLm93bmVkKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLm93bmVkLmxlbmd0aDsgaSsrKSByZXNldChub2RlLm93bmVkW2ldKTtcbiAgfVxufVxuZnVuY3Rpb24gY2FzdEVycm9yKGVycikge1xuICBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHJldHVybiBlcnI7XG4gIHJldHVybiBuZXcgRXJyb3IodHlwZW9mIGVyciA9PT0gXCJzdHJpbmdcIiA/IGVyciA6IFwiVW5rbm93biBlcnJvclwiLCB7XG4gICAgY2F1c2U6IGVyclxuICB9KTtcbn1cbmZ1bmN0aW9uIHJ1bkVycm9ycyhlcnIsIGZucywgb3duZXIpIHtcbiAgdHJ5IHtcbiAgICBmb3IgKGNvbnN0IGYgb2YgZm5zKSBmKGVycik7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBoYW5kbGVFcnJvcihlLCBvd25lciAmJiBvd25lci5vd25lciB8fCBudWxsKTtcbiAgfVxufVxuZnVuY3Rpb24gaGFuZGxlRXJyb3IoZXJyLCBvd25lciA9IE93bmVyKSB7XG4gIGNvbnN0IGZucyA9IEVSUk9SICYmIG93bmVyICYmIG93bmVyLmNvbnRleHQgJiYgb3duZXIuY29udGV4dFtFUlJPUl07XG4gIGNvbnN0IGVycm9yID0gY2FzdEVycm9yKGVycik7XG4gIGlmICghZm5zKSB0aHJvdyBlcnJvcjtcbiAgaWYgKEVmZmVjdHMpIEVmZmVjdHMucHVzaCh7XG4gICAgZm4oKSB7XG4gICAgICBydW5FcnJvcnMoZXJyb3IsIGZucywgb3duZXIpO1xuICAgIH0sXG4gICAgc3RhdGU6IFNUQUxFXG4gIH0pO2Vsc2UgcnVuRXJyb3JzKGVycm9yLCBmbnMsIG93bmVyKTtcbn1cbmZ1bmN0aW9uIHJlc29sdmVDaGlsZHJlbihjaGlsZHJlbikge1xuICBpZiAodHlwZW9mIGNoaWxkcmVuID09PSBcImZ1bmN0aW9uXCIgJiYgIWNoaWxkcmVuLmxlbmd0aCkgcmV0dXJuIHJlc29sdmVDaGlsZHJlbihjaGlsZHJlbigpKTtcbiAgaWYgKEFycmF5LmlzQXJyYXkoY2hpbGRyZW4pKSB7XG4gICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHJlc29sdmVDaGlsZHJlbihjaGlsZHJlbltpXSk7XG4gICAgICBBcnJheS5pc0FycmF5KHJlc3VsdCkgPyByZXN1bHRzLnB1c2guYXBwbHkocmVzdWx0cywgcmVzdWx0KSA6IHJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxuICByZXR1cm4gY2hpbGRyZW47XG59XG5mdW5jdGlvbiBjcmVhdGVQcm92aWRlcihpZCwgb3B0aW9ucykge1xuICByZXR1cm4gZnVuY3Rpb24gcHJvdmlkZXIocHJvcHMpIHtcbiAgICBsZXQgcmVzO1xuICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiByZXMgPSB1bnRyYWNrKCgpID0+IHtcbiAgICAgIE93bmVyLmNvbnRleHQgPSB7XG4gICAgICAgIC4uLk93bmVyLmNvbnRleHQsXG4gICAgICAgIFtpZF06IHByb3BzLnZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIGNoaWxkcmVuKCgpID0+IHByb3BzLmNoaWxkcmVuKTtcbiAgICB9KSwgdW5kZWZpbmVkLCBvcHRpb25zKTtcbiAgICByZXR1cm4gcmVzO1xuICB9O1xufVxuZnVuY3Rpb24gb25FcnJvcihmbikge1xuICBFUlJPUiB8fCAoRVJST1IgPSBTeW1ib2woXCJlcnJvclwiKSk7XG4gIGlmIChPd25lciA9PT0gbnVsbCkgY29uc29sZS53YXJuKFwiZXJyb3IgaGFuZGxlcnMgY3JlYXRlZCBvdXRzaWRlIGEgYGNyZWF0ZVJvb3RgIG9yIGByZW5kZXJgIHdpbGwgbmV2ZXIgYmUgcnVuXCIpO2Vsc2UgaWYgKE93bmVyLmNvbnRleHQgPT09IG51bGwgfHwgIU93bmVyLmNvbnRleHRbRVJST1JdKSB7XG4gICAgT3duZXIuY29udGV4dCA9IHtcbiAgICAgIC4uLk93bmVyLmNvbnRleHQsXG4gICAgICBbRVJST1JdOiBbZm5dXG4gICAgfTtcbiAgICBtdXRhdGVDb250ZXh0KE93bmVyLCBFUlJPUiwgW2ZuXSk7XG4gIH0gZWxzZSBPd25lci5jb250ZXh0W0VSUk9SXS5wdXNoKGZuKTtcbn1cbmZ1bmN0aW9uIG11dGF0ZUNvbnRleHQobywga2V5LCB2YWx1ZSkge1xuICBpZiAoby5vd25lZCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgby5vd25lZC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKG8ub3duZWRbaV0uY29udGV4dCA9PT0gby5jb250ZXh0KSBtdXRhdGVDb250ZXh0KG8ub3duZWRbaV0sIGtleSwgdmFsdWUpO1xuICAgICAgaWYgKCFvLm93bmVkW2ldLmNvbnRleHQpIHtcbiAgICAgICAgby5vd25lZFtpXS5jb250ZXh0ID0gby5jb250ZXh0O1xuICAgICAgICBtdXRhdGVDb250ZXh0KG8ub3duZWRbaV0sIGtleSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIGlmICghby5vd25lZFtpXS5jb250ZXh0W2tleV0pIHtcbiAgICAgICAgby5vd25lZFtpXS5jb250ZXh0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgbXV0YXRlQ29udGV4dChvLm93bmVkW2ldLCBrZXksIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gb2JzZXJ2YWJsZShpbnB1dCkge1xuICByZXR1cm4ge1xuICAgIHN1YnNjcmliZShvYnNlcnZlcikge1xuICAgICAgaWYgKCEob2JzZXJ2ZXIgaW5zdGFuY2VvZiBPYmplY3QpIHx8IG9ic2VydmVyID09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkV4cGVjdGVkIHRoZSBvYnNlcnZlciB0byBiZSBhbiBvYmplY3QuXCIpO1xuICAgICAgfVxuICAgICAgY29uc3QgaGFuZGxlciA9IHR5cGVvZiBvYnNlcnZlciA9PT0gXCJmdW5jdGlvblwiID8gb2JzZXJ2ZXIgOiBvYnNlcnZlci5uZXh0ICYmIG9ic2VydmVyLm5leHQuYmluZChvYnNlcnZlcik7XG4gICAgICBpZiAoIWhhbmRsZXIpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1bnN1YnNjcmliZSgpIHt9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBjb25zdCBkaXNwb3NlID0gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgICAgICAgY29uc3QgdiA9IGlucHV0KCk7XG4gICAgICAgICAgdW50cmFjaygoKSA9PiBoYW5kbGVyKHYpKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkaXNwb3NlcjtcbiAgICAgIH0pO1xuICAgICAgaWYgKGdldE93bmVyKCkpIG9uQ2xlYW51cChkaXNwb3NlKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCkge1xuICAgICAgICAgIGRpc3Bvc2UoKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9LFxuICAgIFtTeW1ib2wub2JzZXJ2YWJsZSB8fCBcIkBAb2JzZXJ2YWJsZVwiXSgpIHtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfTtcbn1cbmZ1bmN0aW9uIGZyb20ocHJvZHVjZXIsIGluaXRhbFZhbHVlID0gdW5kZWZpbmVkKSB7XG4gIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKGluaXRhbFZhbHVlLCB7XG4gICAgZXF1YWxzOiBmYWxzZVxuICB9KTtcbiAgaWYgKFwic3Vic2NyaWJlXCIgaW4gcHJvZHVjZXIpIHtcbiAgICBjb25zdCB1bnN1YiA9IHByb2R1Y2VyLnN1YnNjcmliZSh2ID0+IHNldCgoKSA9PiB2KSk7XG4gICAgb25DbGVhbnVwKCgpID0+IFwidW5zdWJzY3JpYmVcIiBpbiB1bnN1YiA/IHVuc3ViLnVuc3Vic2NyaWJlKCkgOiB1bnN1YigpKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBjbGVhbiA9IHByb2R1Y2VyKHNldCk7XG4gICAgb25DbGVhbnVwKGNsZWFuKTtcbiAgfVxuICByZXR1cm4gcztcbn1cblxuY29uc3QgRkFMTEJBQ0sgPSBTeW1ib2woXCJmYWxsYmFja1wiKTtcbmZ1bmN0aW9uIGRpc3Bvc2UoZCkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGQubGVuZ3RoOyBpKyspIGRbaV0oKTtcbn1cbmZ1bmN0aW9uIG1hcEFycmF5KGxpc3QsIG1hcEZuLCBvcHRpb25zID0ge30pIHtcbiAgbGV0IGl0ZW1zID0gW10sXG4gICAgbWFwcGVkID0gW10sXG4gICAgZGlzcG9zZXJzID0gW10sXG4gICAgbGVuID0gMCxcbiAgICBpbmRleGVzID0gbWFwRm4ubGVuZ3RoID4gMSA/IFtdIDogbnVsbDtcbiAgb25DbGVhbnVwKCgpID0+IGRpc3Bvc2UoZGlzcG9zZXJzKSk7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgbGV0IG5ld0l0ZW1zID0gbGlzdCgpIHx8IFtdLFxuICAgICAgbmV3TGVuID0gbmV3SXRlbXMubGVuZ3RoLFxuICAgICAgaSxcbiAgICAgIGo7XG4gICAgbmV3SXRlbXNbJFRSQUNLXTtcbiAgICByZXR1cm4gdW50cmFjaygoKSA9PiB7XG4gICAgICBsZXQgbmV3SW5kaWNlcywgbmV3SW5kaWNlc05leHQsIHRlbXAsIHRlbXBkaXNwb3NlcnMsIHRlbXBJbmRleGVzLCBzdGFydCwgZW5kLCBuZXdFbmQsIGl0ZW07XG4gICAgICBpZiAobmV3TGVuID09PSAwKSB7XG4gICAgICAgIGlmIChsZW4gIT09IDApIHtcbiAgICAgICAgICBkaXNwb3NlKGRpc3Bvc2Vycyk7XG4gICAgICAgICAgZGlzcG9zZXJzID0gW107XG4gICAgICAgICAgaXRlbXMgPSBbXTtcbiAgICAgICAgICBtYXBwZWQgPSBbXTtcbiAgICAgICAgICBsZW4gPSAwO1xuICAgICAgICAgIGluZGV4ZXMgJiYgKGluZGV4ZXMgPSBbXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZmFsbGJhY2spIHtcbiAgICAgICAgICBpdGVtcyA9IFtGQUxMQkFDS107XG4gICAgICAgICAgbWFwcGVkWzBdID0gY3JlYXRlUm9vdChkaXNwb3NlciA9PiB7XG4gICAgICAgICAgICBkaXNwb3NlcnNbMF0gPSBkaXNwb3NlcjtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb25zLmZhbGxiYWNrKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGVuID0gMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAobGVuID09PSAwKSB7XG4gICAgICAgIG1hcHBlZCA9IG5ldyBBcnJheShuZXdMZW4pO1xuICAgICAgICBmb3IgKGogPSAwOyBqIDwgbmV3TGVuOyBqKyspIHtcbiAgICAgICAgICBpdGVtc1tqXSA9IG5ld0l0ZW1zW2pdO1xuICAgICAgICAgIG1hcHBlZFtqXSA9IGNyZWF0ZVJvb3QobWFwcGVyKTtcbiAgICAgICAgfVxuICAgICAgICBsZW4gPSBuZXdMZW47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZW1wID0gbmV3IEFycmF5KG5ld0xlbik7XG4gICAgICAgIHRlbXBkaXNwb3NlcnMgPSBuZXcgQXJyYXkobmV3TGVuKTtcbiAgICAgICAgaW5kZXhlcyAmJiAodGVtcEluZGV4ZXMgPSBuZXcgQXJyYXkobmV3TGVuKSk7XG4gICAgICAgIGZvciAoc3RhcnQgPSAwLCBlbmQgPSBNYXRoLm1pbihsZW4sIG5ld0xlbik7IHN0YXJ0IDwgZW5kICYmIGl0ZW1zW3N0YXJ0XSA9PT0gbmV3SXRlbXNbc3RhcnRdOyBzdGFydCsrKTtcbiAgICAgICAgZm9yIChlbmQgPSBsZW4gLSAxLCBuZXdFbmQgPSBuZXdMZW4gLSAxOyBlbmQgPj0gc3RhcnQgJiYgbmV3RW5kID49IHN0YXJ0ICYmIGl0ZW1zW2VuZF0gPT09IG5ld0l0ZW1zW25ld0VuZF07IGVuZC0tLCBuZXdFbmQtLSkge1xuICAgICAgICAgIHRlbXBbbmV3RW5kXSA9IG1hcHBlZFtlbmRdO1xuICAgICAgICAgIHRlbXBkaXNwb3NlcnNbbmV3RW5kXSA9IGRpc3Bvc2Vyc1tlbmRdO1xuICAgICAgICAgIGluZGV4ZXMgJiYgKHRlbXBJbmRleGVzW25ld0VuZF0gPSBpbmRleGVzW2VuZF0pO1xuICAgICAgICB9XG4gICAgICAgIG5ld0luZGljZXMgPSBuZXcgTWFwKCk7XG4gICAgICAgIG5ld0luZGljZXNOZXh0ID0gbmV3IEFycmF5KG5ld0VuZCArIDEpO1xuICAgICAgICBmb3IgKGogPSBuZXdFbmQ7IGogPj0gc3RhcnQ7IGotLSkge1xuICAgICAgICAgIGl0ZW0gPSBuZXdJdGVtc1tqXTtcbiAgICAgICAgICBpID0gbmV3SW5kaWNlcy5nZXQoaXRlbSk7XG4gICAgICAgICAgbmV3SW5kaWNlc05leHRbal0gPSBpID09PSB1bmRlZmluZWQgPyAtMSA6IGk7XG4gICAgICAgICAgbmV3SW5kaWNlcy5zZXQoaXRlbSwgaik7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChpID0gc3RhcnQ7IGkgPD0gZW5kOyBpKyspIHtcbiAgICAgICAgICBpdGVtID0gaXRlbXNbaV07XG4gICAgICAgICAgaiA9IG5ld0luZGljZXMuZ2V0KGl0ZW0pO1xuICAgICAgICAgIGlmIChqICE9PSB1bmRlZmluZWQgJiYgaiAhPT0gLTEpIHtcbiAgICAgICAgICAgIHRlbXBbal0gPSBtYXBwZWRbaV07XG4gICAgICAgICAgICB0ZW1wZGlzcG9zZXJzW2pdID0gZGlzcG9zZXJzW2ldO1xuICAgICAgICAgICAgaW5kZXhlcyAmJiAodGVtcEluZGV4ZXNbal0gPSBpbmRleGVzW2ldKTtcbiAgICAgICAgICAgIGogPSBuZXdJbmRpY2VzTmV4dFtqXTtcbiAgICAgICAgICAgIG5ld0luZGljZXMuc2V0KGl0ZW0sIGopO1xuICAgICAgICAgIH0gZWxzZSBkaXNwb3NlcnNbaV0oKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGogPSBzdGFydDsgaiA8IG5ld0xlbjsgaisrKSB7XG4gICAgICAgICAgaWYgKGogaW4gdGVtcCkge1xuICAgICAgICAgICAgbWFwcGVkW2pdID0gdGVtcFtqXTtcbiAgICAgICAgICAgIGRpc3Bvc2Vyc1tqXSA9IHRlbXBkaXNwb3NlcnNbal07XG4gICAgICAgICAgICBpZiAoaW5kZXhlcykge1xuICAgICAgICAgICAgICBpbmRleGVzW2pdID0gdGVtcEluZGV4ZXNbal07XG4gICAgICAgICAgICAgIGluZGV4ZXNbal0oaik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIG1hcHBlZFtqXSA9IGNyZWF0ZVJvb3QobWFwcGVyKTtcbiAgICAgICAgfVxuICAgICAgICBtYXBwZWQgPSBtYXBwZWQuc2xpY2UoMCwgbGVuID0gbmV3TGVuKTtcbiAgICAgICAgaXRlbXMgPSBuZXdJdGVtcy5zbGljZSgwKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXBwZWQ7XG4gICAgfSk7XG4gICAgZnVuY3Rpb24gbWFwcGVyKGRpc3Bvc2VyKSB7XG4gICAgICBkaXNwb3NlcnNbal0gPSBkaXNwb3NlcjtcbiAgICAgIGlmIChpbmRleGVzKSB7XG4gICAgICAgIGNvbnN0IFtzLCBzZXRdID0gY3JlYXRlU2lnbmFsKGosIHtcbiAgICAgICAgICBuYW1lOiBcImluZGV4XCJcbiAgICAgICAgfSkgO1xuICAgICAgICBpbmRleGVzW2pdID0gc2V0O1xuICAgICAgICByZXR1cm4gbWFwRm4obmV3SXRlbXNbal0sIHMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1hcEZuKG5ld0l0ZW1zW2pdKTtcbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiBpbmRleEFycmF5KGxpc3QsIG1hcEZuLCBvcHRpb25zID0ge30pIHtcbiAgbGV0IGl0ZW1zID0gW10sXG4gICAgbWFwcGVkID0gW10sXG4gICAgZGlzcG9zZXJzID0gW10sXG4gICAgc2lnbmFscyA9IFtdLFxuICAgIGxlbiA9IDAsXG4gICAgaTtcbiAgb25DbGVhbnVwKCgpID0+IGRpc3Bvc2UoZGlzcG9zZXJzKSk7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgY29uc3QgbmV3SXRlbXMgPSBsaXN0KCkgfHwgW10sXG4gICAgICBuZXdMZW4gPSBuZXdJdGVtcy5sZW5ndGg7XG4gICAgbmV3SXRlbXNbJFRSQUNLXTtcbiAgICByZXR1cm4gdW50cmFjaygoKSA9PiB7XG4gICAgICBpZiAobmV3TGVuID09PSAwKSB7XG4gICAgICAgIGlmIChsZW4gIT09IDApIHtcbiAgICAgICAgICBkaXNwb3NlKGRpc3Bvc2Vycyk7XG4gICAgICAgICAgZGlzcG9zZXJzID0gW107XG4gICAgICAgICAgaXRlbXMgPSBbXTtcbiAgICAgICAgICBtYXBwZWQgPSBbXTtcbiAgICAgICAgICBsZW4gPSAwO1xuICAgICAgICAgIHNpZ25hbHMgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5mYWxsYmFjaykge1xuICAgICAgICAgIGl0ZW1zID0gW0ZBTExCQUNLXTtcbiAgICAgICAgICBtYXBwZWRbMF0gPSBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgICAgIGRpc3Bvc2Vyc1swXSA9IGRpc3Bvc2VyO1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMuZmFsbGJhY2soKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBsZW4gPSAxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXBwZWQ7XG4gICAgICB9XG4gICAgICBpZiAoaXRlbXNbMF0gPT09IEZBTExCQUNLKSB7XG4gICAgICAgIGRpc3Bvc2Vyc1swXSgpO1xuICAgICAgICBkaXNwb3NlcnMgPSBbXTtcbiAgICAgICAgaXRlbXMgPSBbXTtcbiAgICAgICAgbWFwcGVkID0gW107XG4gICAgICAgIGxlbiA9IDA7XG4gICAgICB9XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbmV3TGVuOyBpKyspIHtcbiAgICAgICAgaWYgKGkgPCBpdGVtcy5sZW5ndGggJiYgaXRlbXNbaV0gIT09IG5ld0l0ZW1zW2ldKSB7XG4gICAgICAgICAgc2lnbmFsc1tpXSgoKSA9PiBuZXdJdGVtc1tpXSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaSA+PSBpdGVtcy5sZW5ndGgpIHtcbiAgICAgICAgICBtYXBwZWRbaV0gPSBjcmVhdGVSb290KG1hcHBlcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZvciAoOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZGlzcG9zZXJzW2ldKCk7XG4gICAgICB9XG4gICAgICBsZW4gPSBzaWduYWxzLmxlbmd0aCA9IGRpc3Bvc2Vycy5sZW5ndGggPSBuZXdMZW47XG4gICAgICBpdGVtcyA9IG5ld0l0ZW1zLnNsaWNlKDApO1xuICAgICAgcmV0dXJuIG1hcHBlZCA9IG1hcHBlZC5zbGljZSgwLCBsZW4pO1xuICAgIH0pO1xuICAgIGZ1bmN0aW9uIG1hcHBlcihkaXNwb3Nlcikge1xuICAgICAgZGlzcG9zZXJzW2ldID0gZGlzcG9zZXI7XG4gICAgICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbChuZXdJdGVtc1tpXSwge1xuICAgICAgICBuYW1lOiBcInZhbHVlXCJcbiAgICAgIH0pIDtcbiAgICAgIHNpZ25hbHNbaV0gPSBzZXQ7XG4gICAgICByZXR1cm4gbWFwRm4ocywgaSk7XG4gICAgfVxuICB9O1xufVxuXG5sZXQgaHlkcmF0aW9uRW5hYmxlZCA9IGZhbHNlO1xuZnVuY3Rpb24gZW5hYmxlSHlkcmF0aW9uKCkge1xuICBoeWRyYXRpb25FbmFibGVkID0gdHJ1ZTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudChDb21wLCBwcm9wcykge1xuICBpZiAoaHlkcmF0aW9uRW5hYmxlZCkge1xuICAgIGlmIChzaGFyZWRDb25maWcuY29udGV4dCkge1xuICAgICAgY29uc3QgYyA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICAgICAgc2V0SHlkcmF0ZUNvbnRleHQobmV4dEh5ZHJhdGVDb250ZXh0KCkpO1xuICAgICAgY29uc3QgciA9IGRldkNvbXBvbmVudChDb21wLCBwcm9wcyB8fCB7fSkgO1xuICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoYyk7XG4gICAgICByZXR1cm4gcjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRldkNvbXBvbmVudChDb21wLCBwcm9wcyB8fCB7fSk7XG59XG5mdW5jdGlvbiB0cnVlRm4oKSB7XG4gIHJldHVybiB0cnVlO1xufVxuY29uc3QgcHJvcFRyYXBzID0ge1xuICBnZXQoXywgcHJvcGVydHksIHJlY2VpdmVyKSB7XG4gICAgaWYgKHByb3BlcnR5ID09PSAkUFJPWFkpIHJldHVybiByZWNlaXZlcjtcbiAgICByZXR1cm4gXy5nZXQocHJvcGVydHkpO1xuICB9LFxuICBoYXMoXywgcHJvcGVydHkpIHtcbiAgICBpZiAocHJvcGVydHkgPT09ICRQUk9YWSkgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIF8uaGFzKHByb3BlcnR5KTtcbiAgfSxcbiAgc2V0OiB0cnVlRm4sXG4gIGRlbGV0ZVByb3BlcnR5OiB0cnVlRm4sXG4gIGdldE93blByb3BlcnR5RGVzY3JpcHRvcihfLCBwcm9wZXJ0eSkge1xuICAgIHJldHVybiB7XG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgZ2V0KCkge1xuICAgICAgICByZXR1cm4gXy5nZXQocHJvcGVydHkpO1xuICAgICAgfSxcbiAgICAgIHNldDogdHJ1ZUZuLFxuICAgICAgZGVsZXRlUHJvcGVydHk6IHRydWVGblxuICAgIH07XG4gIH0sXG4gIG93bktleXMoXykge1xuICAgIHJldHVybiBfLmtleXMoKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHJlc29sdmVTb3VyY2Uocykge1xuICByZXR1cm4gIShzID0gdHlwZW9mIHMgPT09IFwiZnVuY3Rpb25cIiA/IHMoKSA6IHMpID8ge30gOiBzO1xufVxuZnVuY3Rpb24gcmVzb2x2ZVNvdXJjZXMoKSB7XG4gIGZvciAobGV0IGkgPSAwLCBsZW5ndGggPSB0aGlzLmxlbmd0aDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgY29uc3QgdiA9IHRoaXNbaV0oKTtcbiAgICBpZiAodiAhPT0gdW5kZWZpbmVkKSByZXR1cm4gdjtcbiAgfVxufVxuZnVuY3Rpb24gbWVyZ2VQcm9wcyguLi5zb3VyY2VzKSB7XG4gIGxldCBwcm94eSA9IGZhbHNlO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHNvdXJjZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBzID0gc291cmNlc1tpXTtcbiAgICBwcm94eSA9IHByb3h5IHx8ICEhcyAmJiAkUFJPWFkgaW4gcztcbiAgICBzb3VyY2VzW2ldID0gdHlwZW9mIHMgPT09IFwiZnVuY3Rpb25cIiA/IChwcm94eSA9IHRydWUsIGNyZWF0ZU1lbW8ocykpIDogcztcbiAgfVxuICBpZiAoU1VQUE9SVFNfUFJPWFkgJiYgcHJveHkpIHtcbiAgICByZXR1cm4gbmV3IFByb3h5KHtcbiAgICAgIGdldChwcm9wZXJ0eSkge1xuICAgICAgICBmb3IgKGxldCBpID0gc291cmNlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgIGNvbnN0IHYgPSByZXNvbHZlU291cmNlKHNvdXJjZXNbaV0pW3Byb3BlcnR5XTtcbiAgICAgICAgICBpZiAodiAhPT0gdW5kZWZpbmVkKSByZXR1cm4gdjtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGhhcyhwcm9wZXJ0eSkge1xuICAgICAgICBmb3IgKGxldCBpID0gc291cmNlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgIGlmIChwcm9wZXJ0eSBpbiByZXNvbHZlU291cmNlKHNvdXJjZXNbaV0pKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAga2V5cygpIHtcbiAgICAgICAgY29uc3Qga2V5cyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvdXJjZXMubGVuZ3RoOyBpKyspIGtleXMucHVzaCguLi5PYmplY3Qua2V5cyhyZXNvbHZlU291cmNlKHNvdXJjZXNbaV0pKSk7XG4gICAgICAgIHJldHVybiBbLi4ubmV3IFNldChrZXlzKV07XG4gICAgICB9XG4gICAgfSwgcHJvcFRyYXBzKTtcbiAgfVxuICBjb25zdCBzb3VyY2VzTWFwID0ge307XG4gIGNvbnN0IGRlZmluZWQgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICBmb3IgKGxldCBpID0gc291cmNlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGNvbnN0IHNvdXJjZSA9IHNvdXJjZXNbaV07XG4gICAgaWYgKCFzb3VyY2UpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHNvdXJjZUtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhzb3VyY2UpO1xuICAgIGZvciAobGV0IGkgPSBzb3VyY2VLZXlzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBrZXkgPSBzb3VyY2VLZXlzW2ldO1xuICAgICAgaWYgKGtleSA9PT0gXCJfX3Byb3RvX19cIiB8fCBrZXkgPT09IFwiY29uc3RydWN0b3JcIikgY29udGludWU7XG4gICAgICBjb25zdCBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihzb3VyY2UsIGtleSk7XG4gICAgICBpZiAoIWRlZmluZWRba2V5XSkge1xuICAgICAgICBkZWZpbmVkW2tleV0gPSBkZXNjLmdldCA/IHtcbiAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBnZXQ6IHJlc29sdmVTb3VyY2VzLmJpbmQoc291cmNlc01hcFtrZXldID0gW2Rlc2MuZ2V0LmJpbmQoc291cmNlKV0pXG4gICAgICAgIH0gOiBkZXNjLnZhbHVlICE9PSB1bmRlZmluZWQgPyBkZXNjIDogdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3Qgc291cmNlcyA9IHNvdXJjZXNNYXBba2V5XTtcbiAgICAgICAgaWYgKHNvdXJjZXMpIHtcbiAgICAgICAgICBpZiAoZGVzYy5nZXQpIHNvdXJjZXMucHVzaChkZXNjLmdldC5iaW5kKHNvdXJjZSkpO2Vsc2UgaWYgKGRlc2MudmFsdWUgIT09IHVuZGVmaW5lZCkgc291cmNlcy5wdXNoKCgpID0+IGRlc2MudmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNvbnN0IHRhcmdldCA9IHt9O1xuICBjb25zdCBkZWZpbmVkS2V5cyA9IE9iamVjdC5rZXlzKGRlZmluZWQpO1xuICBmb3IgKGxldCBpID0gZGVmaW5lZEtleXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBjb25zdCBrZXkgPSBkZWZpbmVkS2V5c1tpXSxcbiAgICAgIGRlc2MgPSBkZWZpbmVkW2tleV07XG4gICAgaWYgKGRlc2MgJiYgZGVzYy5nZXQpIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgZGVzYyk7ZWxzZSB0YXJnZXRba2V5XSA9IGRlc2MgPyBkZXNjLnZhbHVlIDogdW5kZWZpbmVkO1xuICB9XG4gIHJldHVybiB0YXJnZXQ7XG59XG5mdW5jdGlvbiBzcGxpdFByb3BzKHByb3BzLCAuLi5rZXlzKSB7XG4gIGlmIChTVVBQT1JUU19QUk9YWSAmJiAkUFJPWFkgaW4gcHJvcHMpIHtcbiAgICBjb25zdCBibG9ja2VkID0gbmV3IFNldChrZXlzLmxlbmd0aCA+IDEgPyBrZXlzLmZsYXQoKSA6IGtleXNbMF0pO1xuICAgIGNvbnN0IHJlcyA9IGtleXMubWFwKGsgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm94eSh7XG4gICAgICAgIGdldChwcm9wZXJ0eSkge1xuICAgICAgICAgIHJldHVybiBrLmluY2x1ZGVzKHByb3BlcnR5KSA/IHByb3BzW3Byb3BlcnR5XSA6IHVuZGVmaW5lZDtcbiAgICAgICAgfSxcbiAgICAgICAgaGFzKHByb3BlcnR5KSB7XG4gICAgICAgICAgcmV0dXJuIGsuaW5jbHVkZXMocHJvcGVydHkpICYmIHByb3BlcnR5IGluIHByb3BzO1xuICAgICAgICB9LFxuICAgICAgICBrZXlzKCkge1xuICAgICAgICAgIHJldHVybiBrLmZpbHRlcihwcm9wZXJ0eSA9PiBwcm9wZXJ0eSBpbiBwcm9wcyk7XG4gICAgICAgIH1cbiAgICAgIH0sIHByb3BUcmFwcyk7XG4gICAgfSk7XG4gICAgcmVzLnB1c2gobmV3IFByb3h5KHtcbiAgICAgIGdldChwcm9wZXJ0eSkge1xuICAgICAgICByZXR1cm4gYmxvY2tlZC5oYXMocHJvcGVydHkpID8gdW5kZWZpbmVkIDogcHJvcHNbcHJvcGVydHldO1xuICAgICAgfSxcbiAgICAgIGhhcyhwcm9wZXJ0eSkge1xuICAgICAgICByZXR1cm4gYmxvY2tlZC5oYXMocHJvcGVydHkpID8gZmFsc2UgOiBwcm9wZXJ0eSBpbiBwcm9wcztcbiAgICAgIH0sXG4gICAgICBrZXlzKCkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMocHJvcHMpLmZpbHRlcihrID0+ICFibG9ja2VkLmhhcyhrKSk7XG4gICAgICB9XG4gICAgfSwgcHJvcFRyYXBzKSk7XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuICBjb25zdCBvdGhlck9iamVjdCA9IHt9O1xuICBjb25zdCBvYmplY3RzID0ga2V5cy5tYXAoKCkgPT4gKHt9KSk7XG4gIGZvciAoY29uc3QgcHJvcE5hbWUgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMocHJvcHMpKSB7XG4gICAgY29uc3QgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IocHJvcHMsIHByb3BOYW1lKTtcbiAgICBjb25zdCBpc0RlZmF1bHREZXNjID0gIWRlc2MuZ2V0ICYmICFkZXNjLnNldCAmJiBkZXNjLmVudW1lcmFibGUgJiYgZGVzYy53cml0YWJsZSAmJiBkZXNjLmNvbmZpZ3VyYWJsZTtcbiAgICBsZXQgYmxvY2tlZCA9IGZhbHNlO1xuICAgIGxldCBvYmplY3RJbmRleCA9IDA7XG4gICAgZm9yIChjb25zdCBrIG9mIGtleXMpIHtcbiAgICAgIGlmIChrLmluY2x1ZGVzKHByb3BOYW1lKSkge1xuICAgICAgICBibG9ja2VkID0gdHJ1ZTtcbiAgICAgICAgaXNEZWZhdWx0RGVzYyA/IG9iamVjdHNbb2JqZWN0SW5kZXhdW3Byb3BOYW1lXSA9IGRlc2MudmFsdWUgOiBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqZWN0c1tvYmplY3RJbmRleF0sIHByb3BOYW1lLCBkZXNjKTtcbiAgICAgIH1cbiAgICAgICsrb2JqZWN0SW5kZXg7XG4gICAgfVxuICAgIGlmICghYmxvY2tlZCkge1xuICAgICAgaXNEZWZhdWx0RGVzYyA/IG90aGVyT2JqZWN0W3Byb3BOYW1lXSA9IGRlc2MudmFsdWUgOiBPYmplY3QuZGVmaW5lUHJvcGVydHkob3RoZXJPYmplY3QsIHByb3BOYW1lLCBkZXNjKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIFsuLi5vYmplY3RzLCBvdGhlck9iamVjdF07XG59XG5mdW5jdGlvbiBsYXp5KGZuKSB7XG4gIGxldCBjb21wO1xuICBsZXQgcDtcbiAgY29uc3Qgd3JhcCA9IHByb3BzID0+IHtcbiAgICBjb25zdCBjdHggPSBzaGFyZWRDb25maWcuY29udGV4dDtcbiAgICBpZiAoY3R4KSB7XG4gICAgICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbCgpO1xuICAgICAgc2hhcmVkQ29uZmlnLmNvdW50IHx8IChzaGFyZWRDb25maWcuY291bnQgPSAwKTtcbiAgICAgIHNoYXJlZENvbmZpZy5jb3VudCsrO1xuICAgICAgKHAgfHwgKHAgPSBmbigpKSkudGhlbihtb2QgPT4ge1xuICAgICAgICAhc2hhcmVkQ29uZmlnLmRvbmUgJiYgc2V0SHlkcmF0ZUNvbnRleHQoY3R4KTtcbiAgICAgICAgc2hhcmVkQ29uZmlnLmNvdW50LS07XG4gICAgICAgIHNldCgoKSA9PiBtb2QuZGVmYXVsdCk7XG4gICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KCk7XG4gICAgICB9KTtcbiAgICAgIGNvbXAgPSBzO1xuICAgIH0gZWxzZSBpZiAoIWNvbXApIHtcbiAgICAgIGNvbnN0IFtzXSA9IGNyZWF0ZVJlc291cmNlKCgpID0+IChwIHx8IChwID0gZm4oKSkpLnRoZW4obW9kID0+IG1vZC5kZWZhdWx0KSk7XG4gICAgICBjb21wID0gcztcbiAgICB9XG4gICAgbGV0IENvbXA7XG4gICAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4gKENvbXAgPSBjb21wKCkpID8gdW50cmFjaygoKSA9PiB7XG4gICAgICBpZiAoSVNfREVWKSBPYmplY3QuYXNzaWduKENvbXAsIHtcbiAgICAgICAgWyRERVZDT01QXTogdHJ1ZVxuICAgICAgfSk7XG4gICAgICBpZiAoIWN0eCB8fCBzaGFyZWRDb25maWcuZG9uZSkgcmV0dXJuIENvbXAocHJvcHMpO1xuICAgICAgY29uc3QgYyA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoY3R4KTtcbiAgICAgIGNvbnN0IHIgPSBDb21wKHByb3BzKTtcbiAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGMpO1xuICAgICAgcmV0dXJuIHI7XG4gICAgfSkgOiBcIlwiKTtcbiAgfTtcbiAgd3JhcC5wcmVsb2FkID0gKCkgPT4gcCB8fCAoKHAgPSBmbigpKS50aGVuKG1vZCA9PiBjb21wID0gKCkgPT4gbW9kLmRlZmF1bHQpLCBwKTtcbiAgcmV0dXJuIHdyYXA7XG59XG5sZXQgY291bnRlciA9IDA7XG5mdW5jdGlvbiBjcmVhdGVVbmlxdWVJZCgpIHtcbiAgY29uc3QgY3R4ID0gc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gIHJldHVybiBjdHggPyBzaGFyZWRDb25maWcuZ2V0TmV4dENvbnRleHRJZCgpIDogYGNsLSR7Y291bnRlcisrfWA7XG59XG5cbmNvbnN0IG5hcnJvd2VkRXJyb3IgPSBuYW1lID0+IGBBdHRlbXB0aW5nIHRvIGFjY2VzcyBhIHN0YWxlIHZhbHVlIGZyb20gPCR7bmFtZX0+IHRoYXQgY291bGQgcG9zc2libHkgYmUgdW5kZWZpbmVkLiBUaGlzIG1heSBvY2N1ciBiZWNhdXNlIHlvdSBhcmUgcmVhZGluZyB0aGUgYWNjZXNzb3IgcmV0dXJuZWQgZnJvbSB0aGUgY29tcG9uZW50IGF0IGEgdGltZSB3aGVyZSBpdCBoYXMgYWxyZWFkeSBiZWVuIHVubW91bnRlZC4gV2UgcmVjb21tZW5kIGNsZWFuaW5nIHVwIGFueSBzdGFsZSB0aW1lcnMgb3IgYXN5bmMsIG9yIHJlYWRpbmcgZnJvbSB0aGUgaW5pdGlhbCBjb25kaXRpb24uYCA7XG5mdW5jdGlvbiBGb3IocHJvcHMpIHtcbiAgY29uc3QgZmFsbGJhY2sgPSBcImZhbGxiYWNrXCIgaW4gcHJvcHMgJiYge1xuICAgIGZhbGxiYWNrOiAoKSA9PiBwcm9wcy5mYWxsYmFja1xuICB9O1xuICByZXR1cm4gY3JlYXRlTWVtbyhtYXBBcnJheSgoKSA9PiBwcm9wcy5lYWNoLCBwcm9wcy5jaGlsZHJlbiwgZmFsbGJhY2sgfHwgdW5kZWZpbmVkKSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJ2YWx1ZVwiXG4gIH0pIDtcbn1cbmZ1bmN0aW9uIEluZGV4KHByb3BzKSB7XG4gIGNvbnN0IGZhbGxiYWNrID0gXCJmYWxsYmFja1wiIGluIHByb3BzICYmIHtcbiAgICBmYWxsYmFjazogKCkgPT4gcHJvcHMuZmFsbGJhY2tcbiAgfTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oaW5kZXhBcnJheSgoKSA9PiBwcm9wcy5lYWNoLCBwcm9wcy5jaGlsZHJlbiwgZmFsbGJhY2sgfHwgdW5kZWZpbmVkKSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJ2YWx1ZVwiXG4gIH0pIDtcbn1cbmZ1bmN0aW9uIFNob3cocHJvcHMpIHtcbiAgY29uc3Qga2V5ZWQgPSBwcm9wcy5rZXllZDtcbiAgY29uc3QgY29uZGl0aW9uVmFsdWUgPSBjcmVhdGVNZW1vKCgpID0+IHByb3BzLndoZW4sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwiY29uZGl0aW9uIHZhbHVlXCJcbiAgfSApO1xuICBjb25zdCBjb25kaXRpb24gPSBrZXllZCA/IGNvbmRpdGlvblZhbHVlIDogY3JlYXRlTWVtbyhjb25kaXRpb25WYWx1ZSwgdW5kZWZpbmVkLCB7XG4gICAgZXF1YWxzOiAoYSwgYikgPT4gIWEgPT09ICFiLFxuICAgIG5hbWU6IFwiY29uZGl0aW9uXCJcbiAgfSApO1xuICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgYyA9IGNvbmRpdGlvbigpO1xuICAgIGlmIChjKSB7XG4gICAgICBjb25zdCBjaGlsZCA9IHByb3BzLmNoaWxkcmVuO1xuICAgICAgY29uc3QgZm4gPSB0eXBlb2YgY2hpbGQgPT09IFwiZnVuY3Rpb25cIiAmJiBjaGlsZC5sZW5ndGggPiAwO1xuICAgICAgcmV0dXJuIGZuID8gdW50cmFjaygoKSA9PiBjaGlsZChrZXllZCA/IGMgOiAoKSA9PiB7XG4gICAgICAgIGlmICghdW50cmFjayhjb25kaXRpb24pKSB0aHJvdyBuYXJyb3dlZEVycm9yKFwiU2hvd1wiKTtcbiAgICAgICAgcmV0dXJuIGNvbmRpdGlvblZhbHVlKCk7XG4gICAgICB9KSkgOiBjaGlsZDtcbiAgICB9XG4gICAgcmV0dXJuIHByb3BzLmZhbGxiYWNrO1xuICB9LCB1bmRlZmluZWQsIHtcbiAgICBuYW1lOiBcInZhbHVlXCJcbiAgfSApO1xufVxuZnVuY3Rpb24gU3dpdGNoKHByb3BzKSB7XG4gIGNvbnN0IGNocyA9IGNoaWxkcmVuKCgpID0+IHByb3BzLmNoaWxkcmVuKTtcbiAgY29uc3Qgc3dpdGNoRnVuYyA9IGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGNoID0gY2hzKCk7XG4gICAgY29uc3QgbXBzID0gQXJyYXkuaXNBcnJheShjaCkgPyBjaCA6IFtjaF07XG4gICAgbGV0IGZ1bmMgPSAoKSA9PiB1bmRlZmluZWQ7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gaTtcbiAgICAgIGNvbnN0IG1wID0gbXBzW2ldO1xuICAgICAgY29uc3QgcHJldkZ1bmMgPSBmdW5jO1xuICAgICAgY29uc3QgY29uZGl0aW9uVmFsdWUgPSBjcmVhdGVNZW1vKCgpID0+IHByZXZGdW5jKCkgPyB1bmRlZmluZWQgOiBtcC53aGVuLCB1bmRlZmluZWQsIHtcbiAgICAgICAgbmFtZTogXCJjb25kaXRpb24gdmFsdWVcIlxuICAgICAgfSApO1xuICAgICAgY29uc3QgY29uZGl0aW9uID0gbXAua2V5ZWQgPyBjb25kaXRpb25WYWx1ZSA6IGNyZWF0ZU1lbW8oY29uZGl0aW9uVmFsdWUsIHVuZGVmaW5lZCwge1xuICAgICAgICBlcXVhbHM6IChhLCBiKSA9PiAhYSA9PT0gIWIsXG4gICAgICAgIG5hbWU6IFwiY29uZGl0aW9uXCJcbiAgICAgIH0gKTtcbiAgICAgIGZ1bmMgPSAoKSA9PiBwcmV2RnVuYygpIHx8IChjb25kaXRpb24oKSA/IFtpbmRleCwgY29uZGl0aW9uVmFsdWUsIG1wXSA6IHVuZGVmaW5lZCk7XG4gICAgfVxuICAgIHJldHVybiBmdW5jO1xuICB9KTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IHNlbCA9IHN3aXRjaEZ1bmMoKSgpO1xuICAgIGlmICghc2VsKSByZXR1cm4gcHJvcHMuZmFsbGJhY2s7XG4gICAgY29uc3QgW2luZGV4LCBjb25kaXRpb25WYWx1ZSwgbXBdID0gc2VsO1xuICAgIGNvbnN0IGNoaWxkID0gbXAuY2hpbGRyZW47XG4gICAgY29uc3QgZm4gPSB0eXBlb2YgY2hpbGQgPT09IFwiZnVuY3Rpb25cIiAmJiBjaGlsZC5sZW5ndGggPiAwO1xuICAgIHJldHVybiBmbiA/IHVudHJhY2soKCkgPT4gY2hpbGQobXAua2V5ZWQgPyBjb25kaXRpb25WYWx1ZSgpIDogKCkgPT4ge1xuICAgICAgaWYgKHVudHJhY2soc3dpdGNoRnVuYykoKT8uWzBdICE9PSBpbmRleCkgdGhyb3cgbmFycm93ZWRFcnJvcihcIk1hdGNoXCIpO1xuICAgICAgcmV0dXJuIGNvbmRpdGlvblZhbHVlKCk7XG4gICAgfSkpIDogY2hpbGQ7XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIG5hbWU6IFwiZXZhbCBjb25kaXRpb25zXCJcbiAgfSApO1xufVxuZnVuY3Rpb24gTWF0Y2gocHJvcHMpIHtcbiAgcmV0dXJuIHByb3BzO1xufVxubGV0IEVycm9ycztcbmZ1bmN0aW9uIHJlc2V0RXJyb3JCb3VuZGFyaWVzKCkge1xuICBFcnJvcnMgJiYgWy4uLkVycm9yc10uZm9yRWFjaChmbiA9PiBmbigpKTtcbn1cbmZ1bmN0aW9uIEVycm9yQm91bmRhcnkocHJvcHMpIHtcbiAgbGV0IGVycjtcbiAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0ICYmIHNoYXJlZENvbmZpZy5sb2FkKSBlcnIgPSBzaGFyZWRDb25maWcubG9hZChzaGFyZWRDb25maWcuZ2V0Q29udGV4dElkKCkpO1xuICBjb25zdCBbZXJyb3JlZCwgc2V0RXJyb3JlZF0gPSBjcmVhdGVTaWduYWwoZXJyLCB7XG4gICAgbmFtZTogXCJlcnJvcmVkXCJcbiAgfSApO1xuICBFcnJvcnMgfHwgKEVycm9ycyA9IG5ldyBTZXQoKSk7XG4gIEVycm9ycy5hZGQoc2V0RXJyb3JlZCk7XG4gIG9uQ2xlYW51cCgoKSA9PiBFcnJvcnMuZGVsZXRlKHNldEVycm9yZWQpKTtcbiAgcmV0dXJuIGNyZWF0ZU1lbW8oKCkgPT4ge1xuICAgIGxldCBlO1xuICAgIGlmIChlID0gZXJyb3JlZCgpKSB7XG4gICAgICBjb25zdCBmID0gcHJvcHMuZmFsbGJhY2s7XG4gICAgICBpZiAoKHR5cGVvZiBmICE9PSBcImZ1bmN0aW9uXCIgfHwgZi5sZW5ndGggPT0gMCkpIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICByZXR1cm4gdHlwZW9mIGYgPT09IFwiZnVuY3Rpb25cIiAmJiBmLmxlbmd0aCA/IHVudHJhY2soKCkgPT4gZihlLCAoKSA9PiBzZXRFcnJvcmVkKCkpKSA6IGY7XG4gICAgfVxuICAgIHJldHVybiBjYXRjaEVycm9yKCgpID0+IHByb3BzLmNoaWxkcmVuLCBzZXRFcnJvcmVkKTtcbiAgfSwgdW5kZWZpbmVkLCB7XG4gICAgbmFtZTogXCJ2YWx1ZVwiXG4gIH0gKTtcbn1cblxuY29uc3Qgc3VzcGVuc2VMaXN0RXF1YWxzID0gKGEsIGIpID0+IGEuc2hvd0NvbnRlbnQgPT09IGIuc2hvd0NvbnRlbnQgJiYgYS5zaG93RmFsbGJhY2sgPT09IGIuc2hvd0ZhbGxiYWNrO1xuY29uc3QgU3VzcGVuc2VMaXN0Q29udGV4dCA9IC8qICNfX1BVUkVfXyAqL2NyZWF0ZUNvbnRleHQoKTtcbmZ1bmN0aW9uIFN1c3BlbnNlTGlzdChwcm9wcykge1xuICBsZXQgW3dyYXBwZXIsIHNldFdyYXBwZXJdID0gY3JlYXRlU2lnbmFsKCgpID0+ICh7XG4gICAgICBpbkZhbGxiYWNrOiBmYWxzZVxuICAgIH0pKSxcbiAgICBzaG93O1xuICBjb25zdCBsaXN0Q29udGV4dCA9IHVzZUNvbnRleHQoU3VzcGVuc2VMaXN0Q29udGV4dCk7XG4gIGNvbnN0IFtyZWdpc3RyeSwgc2V0UmVnaXN0cnldID0gY3JlYXRlU2lnbmFsKFtdKTtcbiAgaWYgKGxpc3RDb250ZXh0KSB7XG4gICAgc2hvdyA9IGxpc3RDb250ZXh0LnJlZ2lzdGVyKGNyZWF0ZU1lbW8oKCkgPT4gd3JhcHBlcigpKCkuaW5GYWxsYmFjaykpO1xuICB9XG4gIGNvbnN0IHJlc29sdmVkID0gY3JlYXRlTWVtbyhwcmV2ID0+IHtcbiAgICBjb25zdCByZXZlYWwgPSBwcm9wcy5yZXZlYWxPcmRlcixcbiAgICAgIHRhaWwgPSBwcm9wcy50YWlsLFxuICAgICAge1xuICAgICAgICBzaG93Q29udGVudCA9IHRydWUsXG4gICAgICAgIHNob3dGYWxsYmFjayA9IHRydWVcbiAgICAgIH0gPSBzaG93ID8gc2hvdygpIDoge30sXG4gICAgICByZWcgPSByZWdpc3RyeSgpLFxuICAgICAgcmV2ZXJzZSA9IHJldmVhbCA9PT0gXCJiYWNrd2FyZHNcIjtcbiAgICBpZiAocmV2ZWFsID09PSBcInRvZ2V0aGVyXCIpIHtcbiAgICAgIGNvbnN0IGFsbCA9IHJlZy5ldmVyeShpbkZhbGxiYWNrID0+ICFpbkZhbGxiYWNrKCkpO1xuICAgICAgY29uc3QgcmVzID0gcmVnLm1hcCgoKSA9PiAoe1xuICAgICAgICBzaG93Q29udGVudDogYWxsICYmIHNob3dDb250ZW50LFxuICAgICAgICBzaG93RmFsbGJhY2tcbiAgICAgIH0pKTtcbiAgICAgIHJlcy5pbkZhbGxiYWNrID0gIWFsbDtcbiAgICAgIHJldHVybiByZXM7XG4gICAgfVxuICAgIGxldCBzdG9wID0gZmFsc2U7XG4gICAgbGV0IGluRmFsbGJhY2sgPSBwcmV2LmluRmFsbGJhY2s7XG4gICAgY29uc3QgcmVzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHJlZy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgY29uc3QgbiA9IHJldmVyc2UgPyBsZW4gLSBpIC0gMSA6IGksXG4gICAgICAgIHMgPSByZWdbbl0oKTtcbiAgICAgIGlmICghc3RvcCAmJiAhcykge1xuICAgICAgICByZXNbbl0gPSB7XG4gICAgICAgICAgc2hvd0NvbnRlbnQsXG4gICAgICAgICAgc2hvd0ZhbGxiYWNrXG4gICAgICAgIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXh0ID0gIXN0b3A7XG4gICAgICAgIGlmIChuZXh0KSBpbkZhbGxiYWNrID0gdHJ1ZTtcbiAgICAgICAgcmVzW25dID0ge1xuICAgICAgICAgIHNob3dDb250ZW50OiBuZXh0LFxuICAgICAgICAgIHNob3dGYWxsYmFjazogIXRhaWwgfHwgbmV4dCAmJiB0YWlsID09PSBcImNvbGxhcHNlZFwiID8gc2hvd0ZhbGxiYWNrIDogZmFsc2VcbiAgICAgICAgfTtcbiAgICAgICAgc3RvcCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghc3RvcCkgaW5GYWxsYmFjayA9IGZhbHNlO1xuICAgIHJlcy5pbkZhbGxiYWNrID0gaW5GYWxsYmFjaztcbiAgICByZXR1cm4gcmVzO1xuICB9LCB7XG4gICAgaW5GYWxsYmFjazogZmFsc2VcbiAgfSk7XG4gIHNldFdyYXBwZXIoKCkgPT4gcmVzb2x2ZWQpO1xuICByZXR1cm4gY3JlYXRlQ29tcG9uZW50KFN1c3BlbnNlTGlzdENvbnRleHQuUHJvdmlkZXIsIHtcbiAgICB2YWx1ZToge1xuICAgICAgcmVnaXN0ZXI6IGluRmFsbGJhY2sgPT4ge1xuICAgICAgICBsZXQgaW5kZXg7XG4gICAgICAgIHNldFJlZ2lzdHJ5KHJlZ2lzdHJ5ID0+IHtcbiAgICAgICAgICBpbmRleCA9IHJlZ2lzdHJ5Lmxlbmd0aDtcbiAgICAgICAgICByZXR1cm4gWy4uLnJlZ2lzdHJ5LCBpbkZhbGxiYWNrXTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHJlc29sdmVkKClbaW5kZXhdLCB1bmRlZmluZWQsIHtcbiAgICAgICAgICBlcXVhbHM6IHN1c3BlbnNlTGlzdEVxdWFsc1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGdldCBjaGlsZHJlbigpIHtcbiAgICAgIHJldHVybiBwcm9wcy5jaGlsZHJlbjtcbiAgICB9XG4gIH0pO1xufVxuZnVuY3Rpb24gU3VzcGVuc2UocHJvcHMpIHtcbiAgbGV0IGNvdW50ZXIgPSAwLFxuICAgIHNob3csXG4gICAgY3R4LFxuICAgIHAsXG4gICAgZmxpY2tlcixcbiAgICBlcnJvcjtcbiAgY29uc3QgW2luRmFsbGJhY2ssIHNldEZhbGxiYWNrXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSksXG4gICAgU3VzcGVuc2VDb250ZXh0ID0gZ2V0U3VzcGVuc2VDb250ZXh0KCksXG4gICAgc3RvcmUgPSB7XG4gICAgICBpbmNyZW1lbnQ6ICgpID0+IHtcbiAgICAgICAgaWYgKCsrY291bnRlciA9PT0gMSkgc2V0RmFsbGJhY2sodHJ1ZSk7XG4gICAgICB9LFxuICAgICAgZGVjcmVtZW50OiAoKSA9PiB7XG4gICAgICAgIGlmICgtLWNvdW50ZXIgPT09IDApIHNldEZhbGxiYWNrKGZhbHNlKTtcbiAgICAgIH0sXG4gICAgICBpbkZhbGxiYWNrLFxuICAgICAgZWZmZWN0czogW10sXG4gICAgICByZXNvbHZlZDogZmFsc2VcbiAgICB9LFxuICAgIG93bmVyID0gZ2V0T3duZXIoKTtcbiAgaWYgKHNoYXJlZENvbmZpZy5jb250ZXh0ICYmIHNoYXJlZENvbmZpZy5sb2FkKSB7XG4gICAgY29uc3Qga2V5ID0gc2hhcmVkQ29uZmlnLmdldENvbnRleHRJZCgpO1xuICAgIGxldCByZWYgPSBzaGFyZWRDb25maWcubG9hZChrZXkpO1xuICAgIGlmIChyZWYpIHtcbiAgICAgIGlmICh0eXBlb2YgcmVmICE9PSBcIm9iamVjdFwiIHx8IHJlZi5zICE9PSAxKSBwID0gcmVmO2Vsc2Ugc2hhcmVkQ29uZmlnLmdhdGhlcihrZXkpO1xuICAgIH1cbiAgICBpZiAocCAmJiBwICE9PSBcIiQkZlwiKSB7XG4gICAgICBjb25zdCBbcywgc2V0XSA9IGNyZWF0ZVNpZ25hbCh1bmRlZmluZWQsIHtcbiAgICAgICAgZXF1YWxzOiBmYWxzZVxuICAgICAgfSk7XG4gICAgICBmbGlja2VyID0gcztcbiAgICAgIHAudGhlbigoKSA9PiB7XG4gICAgICAgIGlmIChzaGFyZWRDb25maWcuZG9uZSkgcmV0dXJuIHNldCgpO1xuICAgICAgICBzaGFyZWRDb25maWcuZ2F0aGVyKGtleSk7XG4gICAgICAgIHNldEh5ZHJhdGVDb250ZXh0KGN0eCk7XG4gICAgICAgIHNldCgpO1xuICAgICAgICBzZXRIeWRyYXRlQ29udGV4dCgpO1xuICAgICAgfSwgZXJyID0+IHtcbiAgICAgICAgZXJyb3IgPSBlcnI7XG4gICAgICAgIHNldCgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGNvbnN0IGxpc3RDb250ZXh0ID0gdXNlQ29udGV4dChTdXNwZW5zZUxpc3RDb250ZXh0KTtcbiAgaWYgKGxpc3RDb250ZXh0KSBzaG93ID0gbGlzdENvbnRleHQucmVnaXN0ZXIoc3RvcmUuaW5GYWxsYmFjayk7XG4gIGxldCBkaXNwb3NlO1xuICBvbkNsZWFudXAoKCkgPT4gZGlzcG9zZSAmJiBkaXNwb3NlKCkpO1xuICByZXR1cm4gY3JlYXRlQ29tcG9uZW50KFN1c3BlbnNlQ29udGV4dC5Qcm92aWRlciwge1xuICAgIHZhbHVlOiBzdG9yZSxcbiAgICBnZXQgY2hpbGRyZW4oKSB7XG4gICAgICByZXR1cm4gY3JlYXRlTWVtbygoKSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikgdGhyb3cgZXJyb3I7XG4gICAgICAgIGN0eCA9IHNoYXJlZENvbmZpZy5jb250ZXh0O1xuICAgICAgICBpZiAoZmxpY2tlcikge1xuICAgICAgICAgIGZsaWNrZXIoKTtcbiAgICAgICAgICByZXR1cm4gZmxpY2tlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY3R4ICYmIHAgPT09IFwiJCRmXCIpIHNldEh5ZHJhdGVDb250ZXh0KCk7XG4gICAgICAgIGNvbnN0IHJlbmRlcmVkID0gY3JlYXRlTWVtbygoKSA9PiBwcm9wcy5jaGlsZHJlbik7XG4gICAgICAgIHJldHVybiBjcmVhdGVNZW1vKHByZXYgPT4ge1xuICAgICAgICAgIGNvbnN0IGluRmFsbGJhY2sgPSBzdG9yZS5pbkZhbGxiYWNrKCksXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHNob3dDb250ZW50ID0gdHJ1ZSxcbiAgICAgICAgICAgICAgc2hvd0ZhbGxiYWNrID0gdHJ1ZVxuICAgICAgICAgICAgfSA9IHNob3cgPyBzaG93KCkgOiB7fTtcbiAgICAgICAgICBpZiAoKCFpbkZhbGxiYWNrIHx8IHAgJiYgcCAhPT0gXCIkJGZcIikgJiYgc2hvd0NvbnRlbnQpIHtcbiAgICAgICAgICAgIHN0b3JlLnJlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGRpc3Bvc2UgJiYgZGlzcG9zZSgpO1xuICAgICAgICAgICAgZGlzcG9zZSA9IGN0eCA9IHAgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICByZXN1bWVFZmZlY3RzKHN0b3JlLmVmZmVjdHMpO1xuICAgICAgICAgICAgcmV0dXJuIHJlbmRlcmVkKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghc2hvd0ZhbGxiYWNrKSByZXR1cm47XG4gICAgICAgICAgaWYgKGRpc3Bvc2UpIHJldHVybiBwcmV2O1xuICAgICAgICAgIHJldHVybiBjcmVhdGVSb290KGRpc3Bvc2VyID0+IHtcbiAgICAgICAgICAgIGRpc3Bvc2UgPSBkaXNwb3NlcjtcbiAgICAgICAgICAgIGlmIChjdHgpIHtcbiAgICAgICAgICAgICAgc2V0SHlkcmF0ZUNvbnRleHQoe1xuICAgICAgICAgICAgICAgIGlkOiBjdHguaWQgKyBcIkZcIixcbiAgICAgICAgICAgICAgICBjb3VudDogMFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgY3R4ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHByb3BzLmZhbGxiYWNrO1xuICAgICAgICAgIH0sIG93bmVyKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xufVxuXG5jb25zdCBERVYgPSB7XG4gIGhvb2tzOiBEZXZIb29rcyxcbiAgd3JpdGVTaWduYWwsXG4gIHJlZ2lzdGVyR3JhcGhcbn0gO1xuaWYgKGdsb2JhbFRoaXMpIHtcbiAgaWYgKCFnbG9iYWxUaGlzLlNvbGlkJCQpIGdsb2JhbFRoaXMuU29saWQkJCA9IHRydWU7ZWxzZSBjb25zb2xlLndhcm4oXCJZb3UgYXBwZWFyIHRvIGhhdmUgbXVsdGlwbGUgaW5zdGFuY2VzIG9mIFNvbGlkLiBUaGlzIGNhbiBsZWFkIHRvIHVuZXhwZWN0ZWQgYmVoYXZpb3IuXCIpO1xufVxuXG5leHBvcnQgeyAkREVWQ09NUCwgJFBST1hZLCAkVFJBQ0ssIERFViwgRXJyb3JCb3VuZGFyeSwgRm9yLCBJbmRleCwgTWF0Y2gsIFNob3csIFN1c3BlbnNlLCBTdXNwZW5zZUxpc3QsIFN3aXRjaCwgYmF0Y2gsIGNhbmNlbENhbGxiYWNrLCBjYXRjaEVycm9yLCBjaGlsZHJlbiwgY3JlYXRlQ29tcG9uZW50LCBjcmVhdGVDb21wdXRlZCwgY3JlYXRlQ29udGV4dCwgY3JlYXRlRGVmZXJyZWQsIGNyZWF0ZUVmZmVjdCwgY3JlYXRlTWVtbywgY3JlYXRlUmVhY3Rpb24sIGNyZWF0ZVJlbmRlckVmZmVjdCwgY3JlYXRlUmVzb3VyY2UsIGNyZWF0ZVJvb3QsIGNyZWF0ZVNlbGVjdG9yLCBjcmVhdGVTaWduYWwsIGNyZWF0ZVVuaXF1ZUlkLCBlbmFibGVFeHRlcm5hbFNvdXJjZSwgZW5hYmxlSHlkcmF0aW9uLCBlbmFibGVTY2hlZHVsaW5nLCBlcXVhbEZuLCBmcm9tLCBnZXRMaXN0ZW5lciwgZ2V0T3duZXIsIGluZGV4QXJyYXksIGxhenksIG1hcEFycmF5LCBtZXJnZVByb3BzLCBvYnNlcnZhYmxlLCBvbiwgb25DbGVhbnVwLCBvbkVycm9yLCBvbk1vdW50LCByZXF1ZXN0Q2FsbGJhY2ssIHJlc2V0RXJyb3JCb3VuZGFyaWVzLCBydW5XaXRoT3duZXIsIHNoYXJlZENvbmZpZywgc3BsaXRQcm9wcywgc3RhcnRUcmFuc2l0aW9uLCB1bnRyYWNrLCB1c2VDb250ZXh0LCB1c2VUcmFuc2l0aW9uIH07XG4iLCJpbXBvcnQgeyBjcmVhdGVNZW1vLCBjcmVhdGVSb290LCBjcmVhdGVSZW5kZXJFZmZlY3QsIHVudHJhY2ssIHNoYXJlZENvbmZpZywgZW5hYmxlSHlkcmF0aW9uLCBnZXRPd25lciwgY3JlYXRlRWZmZWN0LCBydW5XaXRoT3duZXIsIGNyZWF0ZVNpZ25hbCwgb25DbGVhbnVwLCAkREVWQ09NUCwgc3BsaXRQcm9wcyB9IGZyb20gJ3NvbGlkLWpzJztcbmV4cG9ydCB7IEVycm9yQm91bmRhcnksIEZvciwgSW5kZXgsIE1hdGNoLCBTaG93LCBTdXNwZW5zZSwgU3VzcGVuc2VMaXN0LCBTd2l0Y2gsIGNyZWF0ZUNvbXBvbmVudCwgY3JlYXRlUmVuZGVyRWZmZWN0IGFzIGVmZmVjdCwgZ2V0T3duZXIsIG1lcmdlUHJvcHMsIHVudHJhY2sgfSBmcm9tICdzb2xpZC1qcyc7XG5cbmNvbnN0IGJvb2xlYW5zID0gW1wiYWxsb3dmdWxsc2NyZWVuXCIsIFwiYXN5bmNcIiwgXCJhdXRvZm9jdXNcIiwgXCJhdXRvcGxheVwiLCBcImNoZWNrZWRcIiwgXCJjb250cm9sc1wiLCBcImRlZmF1bHRcIiwgXCJkaXNhYmxlZFwiLCBcImZvcm1ub3ZhbGlkYXRlXCIsIFwiaGlkZGVuXCIsIFwiaW5kZXRlcm1pbmF0ZVwiLCBcImluZXJ0XCIsIFwiaXNtYXBcIiwgXCJsb29wXCIsIFwibXVsdGlwbGVcIiwgXCJtdXRlZFwiLCBcIm5vbW9kdWxlXCIsIFwibm92YWxpZGF0ZVwiLCBcIm9wZW5cIiwgXCJwbGF5c2lubGluZVwiLCBcInJlYWRvbmx5XCIsIFwicmVxdWlyZWRcIiwgXCJyZXZlcnNlZFwiLCBcInNlYW1sZXNzXCIsIFwic2VsZWN0ZWRcIl07XG5jb25zdCBQcm9wZXJ0aWVzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1wiY2xhc3NOYW1lXCIsIFwidmFsdWVcIiwgXCJyZWFkT25seVwiLCBcIm5vVmFsaWRhdGVcIiwgXCJmb3JtTm9WYWxpZGF0ZVwiLCBcImlzTWFwXCIsIFwibm9Nb2R1bGVcIiwgXCJwbGF5c0lubGluZVwiLCAuLi5ib29sZWFuc10pO1xuY29uc3QgQ2hpbGRQcm9wZXJ0aWVzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1wiaW5uZXJIVE1MXCIsIFwidGV4dENvbnRlbnRcIiwgXCJpbm5lclRleHRcIiwgXCJjaGlsZHJlblwiXSk7XG5jb25zdCBBbGlhc2VzID0gLyojX19QVVJFX18qL09iamVjdC5hc3NpZ24oT2JqZWN0LmNyZWF0ZShudWxsKSwge1xuICBjbGFzc05hbWU6IFwiY2xhc3NcIixcbiAgaHRtbEZvcjogXCJmb3JcIlxufSk7XG5jb25zdCBQcm9wQWxpYXNlcyA9IC8qI19fUFVSRV9fKi9PYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUobnVsbCksIHtcbiAgY2xhc3M6IFwiY2xhc3NOYW1lXCIsXG4gIG5vdmFsaWRhdGU6IHtcbiAgICAkOiBcIm5vVmFsaWRhdGVcIixcbiAgICBGT1JNOiAxXG4gIH0sXG4gIGZvcm1ub3ZhbGlkYXRlOiB7XG4gICAgJDogXCJmb3JtTm9WYWxpZGF0ZVwiLFxuICAgIEJVVFRPTjogMSxcbiAgICBJTlBVVDogMVxuICB9LFxuICBpc21hcDoge1xuICAgICQ6IFwiaXNNYXBcIixcbiAgICBJTUc6IDFcbiAgfSxcbiAgbm9tb2R1bGU6IHtcbiAgICAkOiBcIm5vTW9kdWxlXCIsXG4gICAgU0NSSVBUOiAxXG4gIH0sXG4gIHBsYXlzaW5saW5lOiB7XG4gICAgJDogXCJwbGF5c0lubGluZVwiLFxuICAgIFZJREVPOiAxXG4gIH0sXG4gIHJlYWRvbmx5OiB7XG4gICAgJDogXCJyZWFkT25seVwiLFxuICAgIElOUFVUOiAxLFxuICAgIFRFWFRBUkVBOiAxXG4gIH1cbn0pO1xuZnVuY3Rpb24gZ2V0UHJvcEFsaWFzKHByb3AsIHRhZ05hbWUpIHtcbiAgY29uc3QgYSA9IFByb3BBbGlhc2VzW3Byb3BdO1xuICByZXR1cm4gdHlwZW9mIGEgPT09IFwib2JqZWN0XCIgPyBhW3RhZ05hbWVdID8gYVtcIiRcIl0gOiB1bmRlZmluZWQgOiBhO1xufVxuY29uc3QgRGVsZWdhdGVkRXZlbnRzID0gLyojX19QVVJFX18qL25ldyBTZXQoW1wiYmVmb3JlaW5wdXRcIiwgXCJjbGlja1wiLCBcImRibGNsaWNrXCIsIFwiY29udGV4dG1lbnVcIiwgXCJmb2N1c2luXCIsIFwiZm9jdXNvdXRcIiwgXCJpbnB1dFwiLCBcImtleWRvd25cIiwgXCJrZXl1cFwiLCBcIm1vdXNlZG93blwiLCBcIm1vdXNlbW92ZVwiLCBcIm1vdXNlb3V0XCIsIFwibW91c2VvdmVyXCIsIFwibW91c2V1cFwiLCBcInBvaW50ZXJkb3duXCIsIFwicG9pbnRlcm1vdmVcIiwgXCJwb2ludGVyb3V0XCIsIFwicG9pbnRlcm92ZXJcIiwgXCJwb2ludGVydXBcIiwgXCJ0b3VjaGVuZFwiLCBcInRvdWNobW92ZVwiLCBcInRvdWNoc3RhcnRcIl0pO1xuY29uc3QgU1ZHRWxlbWVudHMgPSAvKiNfX1BVUkVfXyovbmV3IFNldChbXG5cImFsdEdseXBoXCIsIFwiYWx0R2x5cGhEZWZcIiwgXCJhbHRHbHlwaEl0ZW1cIiwgXCJhbmltYXRlXCIsIFwiYW5pbWF0ZUNvbG9yXCIsIFwiYW5pbWF0ZU1vdGlvblwiLCBcImFuaW1hdGVUcmFuc2Zvcm1cIiwgXCJjaXJjbGVcIiwgXCJjbGlwUGF0aFwiLCBcImNvbG9yLXByb2ZpbGVcIiwgXCJjdXJzb3JcIiwgXCJkZWZzXCIsIFwiZGVzY1wiLCBcImVsbGlwc2VcIiwgXCJmZUJsZW5kXCIsIFwiZmVDb2xvck1hdHJpeFwiLCBcImZlQ29tcG9uZW50VHJhbnNmZXJcIiwgXCJmZUNvbXBvc2l0ZVwiLCBcImZlQ29udm9sdmVNYXRyaXhcIiwgXCJmZURpZmZ1c2VMaWdodGluZ1wiLCBcImZlRGlzcGxhY2VtZW50TWFwXCIsIFwiZmVEaXN0YW50TGlnaHRcIiwgXCJmZURyb3BTaGFkb3dcIiwgXCJmZUZsb29kXCIsIFwiZmVGdW5jQVwiLCBcImZlRnVuY0JcIiwgXCJmZUZ1bmNHXCIsIFwiZmVGdW5jUlwiLCBcImZlR2F1c3NpYW5CbHVyXCIsIFwiZmVJbWFnZVwiLCBcImZlTWVyZ2VcIiwgXCJmZU1lcmdlTm9kZVwiLCBcImZlTW9ycGhvbG9neVwiLCBcImZlT2Zmc2V0XCIsIFwiZmVQb2ludExpZ2h0XCIsIFwiZmVTcGVjdWxhckxpZ2h0aW5nXCIsIFwiZmVTcG90TGlnaHRcIiwgXCJmZVRpbGVcIiwgXCJmZVR1cmJ1bGVuY2VcIiwgXCJmaWx0ZXJcIiwgXCJmb250XCIsIFwiZm9udC1mYWNlXCIsIFwiZm9udC1mYWNlLWZvcm1hdFwiLCBcImZvbnQtZmFjZS1uYW1lXCIsIFwiZm9udC1mYWNlLXNyY1wiLCBcImZvbnQtZmFjZS11cmlcIiwgXCJmb3JlaWduT2JqZWN0XCIsIFwiZ1wiLCBcImdseXBoXCIsIFwiZ2x5cGhSZWZcIiwgXCJoa2VyblwiLCBcImltYWdlXCIsIFwibGluZVwiLCBcImxpbmVhckdyYWRpZW50XCIsIFwibWFya2VyXCIsIFwibWFza1wiLCBcIm1ldGFkYXRhXCIsIFwibWlzc2luZy1nbHlwaFwiLCBcIm1wYXRoXCIsIFwicGF0aFwiLCBcInBhdHRlcm5cIiwgXCJwb2x5Z29uXCIsIFwicG9seWxpbmVcIiwgXCJyYWRpYWxHcmFkaWVudFwiLCBcInJlY3RcIixcblwic2V0XCIsIFwic3RvcFwiLFxuXCJzdmdcIiwgXCJzd2l0Y2hcIiwgXCJzeW1ib2xcIiwgXCJ0ZXh0XCIsIFwidGV4dFBhdGhcIixcblwidHJlZlwiLCBcInRzcGFuXCIsIFwidXNlXCIsIFwidmlld1wiLCBcInZrZXJuXCJdKTtcbmNvbnN0IFNWR05hbWVzcGFjZSA9IHtcbiAgeGxpbms6IFwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiLFxuICB4bWw6IFwiaHR0cDovL3d3dy53My5vcmcvWE1MLzE5OTgvbmFtZXNwYWNlXCJcbn07XG5jb25zdCBET01FbGVtZW50cyA9IC8qI19fUFVSRV9fKi9uZXcgU2V0KFtcImh0bWxcIiwgXCJiYXNlXCIsIFwiaGVhZFwiLCBcImxpbmtcIiwgXCJtZXRhXCIsIFwic3R5bGVcIiwgXCJ0aXRsZVwiLCBcImJvZHlcIiwgXCJhZGRyZXNzXCIsIFwiYXJ0aWNsZVwiLCBcImFzaWRlXCIsIFwiZm9vdGVyXCIsIFwiaGVhZGVyXCIsIFwibWFpblwiLCBcIm5hdlwiLCBcInNlY3Rpb25cIiwgXCJib2R5XCIsIFwiYmxvY2txdW90ZVwiLCBcImRkXCIsIFwiZGl2XCIsIFwiZGxcIiwgXCJkdFwiLCBcImZpZ2NhcHRpb25cIiwgXCJmaWd1cmVcIiwgXCJoclwiLCBcImxpXCIsIFwib2xcIiwgXCJwXCIsIFwicHJlXCIsIFwidWxcIiwgXCJhXCIsIFwiYWJiclwiLCBcImJcIiwgXCJiZGlcIiwgXCJiZG9cIiwgXCJiclwiLCBcImNpdGVcIiwgXCJjb2RlXCIsIFwiZGF0YVwiLCBcImRmblwiLCBcImVtXCIsIFwiaVwiLCBcImtiZFwiLCBcIm1hcmtcIiwgXCJxXCIsIFwicnBcIiwgXCJydFwiLCBcInJ1YnlcIiwgXCJzXCIsIFwic2FtcFwiLCBcInNtYWxsXCIsIFwic3BhblwiLCBcInN0cm9uZ1wiLCBcInN1YlwiLCBcInN1cFwiLCBcInRpbWVcIiwgXCJ1XCIsIFwidmFyXCIsIFwid2JyXCIsIFwiYXJlYVwiLCBcImF1ZGlvXCIsIFwiaW1nXCIsIFwibWFwXCIsIFwidHJhY2tcIiwgXCJ2aWRlb1wiLCBcImVtYmVkXCIsIFwiaWZyYW1lXCIsIFwib2JqZWN0XCIsIFwicGFyYW1cIiwgXCJwaWN0dXJlXCIsIFwicG9ydGFsXCIsIFwic291cmNlXCIsIFwic3ZnXCIsIFwibWF0aFwiLCBcImNhbnZhc1wiLCBcIm5vc2NyaXB0XCIsIFwic2NyaXB0XCIsIFwiZGVsXCIsIFwiaW5zXCIsIFwiY2FwdGlvblwiLCBcImNvbFwiLCBcImNvbGdyb3VwXCIsIFwidGFibGVcIiwgXCJ0Ym9keVwiLCBcInRkXCIsIFwidGZvb3RcIiwgXCJ0aFwiLCBcInRoZWFkXCIsIFwidHJcIiwgXCJidXR0b25cIiwgXCJkYXRhbGlzdFwiLCBcImZpZWxkc2V0XCIsIFwiZm9ybVwiLCBcImlucHV0XCIsIFwibGFiZWxcIiwgXCJsZWdlbmRcIiwgXCJtZXRlclwiLCBcIm9wdGdyb3VwXCIsIFwib3B0aW9uXCIsIFwib3V0cHV0XCIsIFwicHJvZ3Jlc3NcIiwgXCJzZWxlY3RcIiwgXCJ0ZXh0YXJlYVwiLCBcImRldGFpbHNcIiwgXCJkaWFsb2dcIiwgXCJtZW51XCIsIFwic3VtbWFyeVwiLCBcImRldGFpbHNcIiwgXCJzbG90XCIsIFwidGVtcGxhdGVcIiwgXCJhY3JvbnltXCIsIFwiYXBwbGV0XCIsIFwiYmFzZWZvbnRcIiwgXCJiZ3NvdW5kXCIsIFwiYmlnXCIsIFwiYmxpbmtcIiwgXCJjZW50ZXJcIiwgXCJjb250ZW50XCIsIFwiZGlyXCIsIFwiZm9udFwiLCBcImZyYW1lXCIsIFwiZnJhbWVzZXRcIiwgXCJoZ3JvdXBcIiwgXCJpbWFnZVwiLCBcImtleWdlblwiLCBcIm1hcnF1ZWVcIiwgXCJtZW51aXRlbVwiLCBcIm5vYnJcIiwgXCJub2VtYmVkXCIsIFwibm9mcmFtZXNcIiwgXCJwbGFpbnRleHRcIiwgXCJyYlwiLCBcInJ0Y1wiLCBcInNoYWRvd1wiLCBcInNwYWNlclwiLCBcInN0cmlrZVwiLCBcInR0XCIsIFwieG1wXCIsIFwiYVwiLCBcImFiYnJcIiwgXCJhY3JvbnltXCIsIFwiYWRkcmVzc1wiLCBcImFwcGxldFwiLCBcImFyZWFcIiwgXCJhcnRpY2xlXCIsIFwiYXNpZGVcIiwgXCJhdWRpb1wiLCBcImJcIiwgXCJiYXNlXCIsIFwiYmFzZWZvbnRcIiwgXCJiZGlcIiwgXCJiZG9cIiwgXCJiZ3NvdW5kXCIsIFwiYmlnXCIsIFwiYmxpbmtcIiwgXCJibG9ja3F1b3RlXCIsIFwiYm9keVwiLCBcImJyXCIsIFwiYnV0dG9uXCIsIFwiY2FudmFzXCIsIFwiY2FwdGlvblwiLCBcImNlbnRlclwiLCBcImNpdGVcIiwgXCJjb2RlXCIsIFwiY29sXCIsIFwiY29sZ3JvdXBcIiwgXCJjb250ZW50XCIsIFwiZGF0YVwiLCBcImRhdGFsaXN0XCIsIFwiZGRcIiwgXCJkZWxcIiwgXCJkZXRhaWxzXCIsIFwiZGZuXCIsIFwiZGlhbG9nXCIsIFwiZGlyXCIsIFwiZGl2XCIsIFwiZGxcIiwgXCJkdFwiLCBcImVtXCIsIFwiZW1iZWRcIiwgXCJmaWVsZHNldFwiLCBcImZpZ2NhcHRpb25cIiwgXCJmaWd1cmVcIiwgXCJmb250XCIsIFwiZm9vdGVyXCIsIFwiZm9ybVwiLCBcImZyYW1lXCIsIFwiZnJhbWVzZXRcIiwgXCJoZWFkXCIsIFwiaGVhZGVyXCIsIFwiaGdyb3VwXCIsIFwiaHJcIiwgXCJodG1sXCIsIFwiaVwiLCBcImlmcmFtZVwiLCBcImltYWdlXCIsIFwiaW1nXCIsIFwiaW5wdXRcIiwgXCJpbnNcIiwgXCJrYmRcIiwgXCJrZXlnZW5cIiwgXCJsYWJlbFwiLCBcImxlZ2VuZFwiLCBcImxpXCIsIFwibGlua1wiLCBcIm1haW5cIiwgXCJtYXBcIiwgXCJtYXJrXCIsIFwibWFycXVlZVwiLCBcIm1lbnVcIiwgXCJtZW51aXRlbVwiLCBcIm1ldGFcIiwgXCJtZXRlclwiLCBcIm5hdlwiLCBcIm5vYnJcIiwgXCJub2VtYmVkXCIsIFwibm9mcmFtZXNcIiwgXCJub3NjcmlwdFwiLCBcIm9iamVjdFwiLCBcIm9sXCIsIFwib3B0Z3JvdXBcIiwgXCJvcHRpb25cIiwgXCJvdXRwdXRcIiwgXCJwXCIsIFwicGFyYW1cIiwgXCJwaWN0dXJlXCIsIFwicGxhaW50ZXh0XCIsIFwicG9ydGFsXCIsIFwicHJlXCIsIFwicHJvZ3Jlc3NcIiwgXCJxXCIsIFwicmJcIiwgXCJycFwiLCBcInJ0XCIsIFwicnRjXCIsIFwicnVieVwiLCBcInNcIiwgXCJzYW1wXCIsIFwic2NyaXB0XCIsIFwic2VjdGlvblwiLCBcInNlbGVjdFwiLCBcInNoYWRvd1wiLCBcInNsb3RcIiwgXCJzbWFsbFwiLCBcInNvdXJjZVwiLCBcInNwYWNlclwiLCBcInNwYW5cIiwgXCJzdHJpa2VcIiwgXCJzdHJvbmdcIiwgXCJzdHlsZVwiLCBcInN1YlwiLCBcInN1bW1hcnlcIiwgXCJzdXBcIiwgXCJ0YWJsZVwiLCBcInRib2R5XCIsIFwidGRcIiwgXCJ0ZW1wbGF0ZVwiLCBcInRleHRhcmVhXCIsIFwidGZvb3RcIiwgXCJ0aFwiLCBcInRoZWFkXCIsIFwidGltZVwiLCBcInRpdGxlXCIsIFwidHJcIiwgXCJ0cmFja1wiLCBcInR0XCIsIFwidVwiLCBcInVsXCIsIFwidmFyXCIsIFwidmlkZW9cIiwgXCJ3YnJcIiwgXCJ4bXBcIiwgXCJpbnB1dFwiLCBcImgxXCIsIFwiaDJcIiwgXCJoM1wiLCBcImg0XCIsIFwiaDVcIiwgXCJoNlwiXSk7XG5cbmNvbnN0IG1lbW8gPSBmbiA9PiBjcmVhdGVNZW1vKCgpID0+IGZuKCkpO1xuXG5mdW5jdGlvbiByZWNvbmNpbGVBcnJheXMocGFyZW50Tm9kZSwgYSwgYikge1xuICBsZXQgYkxlbmd0aCA9IGIubGVuZ3RoLFxuICAgIGFFbmQgPSBhLmxlbmd0aCxcbiAgICBiRW5kID0gYkxlbmd0aCxcbiAgICBhU3RhcnQgPSAwLFxuICAgIGJTdGFydCA9IDAsXG4gICAgYWZ0ZXIgPSBhW2FFbmQgLSAxXS5uZXh0U2libGluZyxcbiAgICBtYXAgPSBudWxsO1xuICB3aGlsZSAoYVN0YXJ0IDwgYUVuZCB8fCBiU3RhcnQgPCBiRW5kKSB7XG4gICAgaWYgKGFbYVN0YXJ0XSA9PT0gYltiU3RhcnRdKSB7XG4gICAgICBhU3RhcnQrKztcbiAgICAgIGJTdGFydCsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHdoaWxlIChhW2FFbmQgLSAxXSA9PT0gYltiRW5kIC0gMV0pIHtcbiAgICAgIGFFbmQtLTtcbiAgICAgIGJFbmQtLTtcbiAgICB9XG4gICAgaWYgKGFFbmQgPT09IGFTdGFydCkge1xuICAgICAgY29uc3Qgbm9kZSA9IGJFbmQgPCBiTGVuZ3RoID8gYlN0YXJ0ID8gYltiU3RhcnQgLSAxXS5uZXh0U2libGluZyA6IGJbYkVuZCAtIGJTdGFydF0gOiBhZnRlcjtcbiAgICAgIHdoaWxlIChiU3RhcnQgPCBiRW5kKSBwYXJlbnROb2RlLmluc2VydEJlZm9yZShiW2JTdGFydCsrXSwgbm9kZSk7XG4gICAgfSBlbHNlIGlmIChiRW5kID09PSBiU3RhcnQpIHtcbiAgICAgIHdoaWxlIChhU3RhcnQgPCBhRW5kKSB7XG4gICAgICAgIGlmICghbWFwIHx8ICFtYXAuaGFzKGFbYVN0YXJ0XSkpIGFbYVN0YXJ0XS5yZW1vdmUoKTtcbiAgICAgICAgYVN0YXJ0Kys7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChhW2FTdGFydF0gPT09IGJbYkVuZCAtIDFdICYmIGJbYlN0YXJ0XSA9PT0gYVthRW5kIC0gMV0pIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBhWy0tYUVuZF0ubmV4dFNpYmxpbmc7XG4gICAgICBwYXJlbnROb2RlLmluc2VydEJlZm9yZShiW2JTdGFydCsrXSwgYVthU3RhcnQrK10ubmV4dFNpYmxpbmcpO1xuICAgICAgcGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYlstLWJFbmRdLCBub2RlKTtcbiAgICAgIGFbYUVuZF0gPSBiW2JFbmRdO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIW1hcCkge1xuICAgICAgICBtYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgIGxldCBpID0gYlN0YXJ0O1xuICAgICAgICB3aGlsZSAoaSA8IGJFbmQpIG1hcC5zZXQoYltpXSwgaSsrKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGluZGV4ID0gbWFwLmdldChhW2FTdGFydF0pO1xuICAgICAgaWYgKGluZGV4ICE9IG51bGwpIHtcbiAgICAgICAgaWYgKGJTdGFydCA8IGluZGV4ICYmIGluZGV4IDwgYkVuZCkge1xuICAgICAgICAgIGxldCBpID0gYVN0YXJ0LFxuICAgICAgICAgICAgc2VxdWVuY2UgPSAxLFxuICAgICAgICAgICAgdDtcbiAgICAgICAgICB3aGlsZSAoKytpIDwgYUVuZCAmJiBpIDwgYkVuZCkge1xuICAgICAgICAgICAgaWYgKCh0ID0gbWFwLmdldChhW2ldKSkgPT0gbnVsbCB8fCB0ICE9PSBpbmRleCArIHNlcXVlbmNlKSBicmVhaztcbiAgICAgICAgICAgIHNlcXVlbmNlKys7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzZXF1ZW5jZSA+IGluZGV4IC0gYlN0YXJ0KSB7XG4gICAgICAgICAgICBjb25zdCBub2RlID0gYVthU3RhcnRdO1xuICAgICAgICAgICAgd2hpbGUgKGJTdGFydCA8IGluZGV4KSBwYXJlbnROb2RlLmluc2VydEJlZm9yZShiW2JTdGFydCsrXSwgbm9kZSk7XG4gICAgICAgICAgfSBlbHNlIHBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGJbYlN0YXJ0KytdLCBhW2FTdGFydCsrXSk7XG4gICAgICAgIH0gZWxzZSBhU3RhcnQrKztcbiAgICAgIH0gZWxzZSBhW2FTdGFydCsrXS5yZW1vdmUoKTtcbiAgICB9XG4gIH1cbn1cblxuY29uc3QgJCRFVkVOVFMgPSBcIl8kRFhfREVMRUdBVEVcIjtcbmZ1bmN0aW9uIHJlbmRlcihjb2RlLCBlbGVtZW50LCBpbml0LCBvcHRpb25zID0ge30pIHtcbiAgaWYgKCFlbGVtZW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGBlbGVtZW50YCBwYXNzZWQgdG8gYHJlbmRlciguLi4sIGVsZW1lbnQpYCBkb2Vzbid0IGV4aXN0LiBNYWtlIHN1cmUgYGVsZW1lbnRgIGV4aXN0cyBpbiB0aGUgZG9jdW1lbnQuXCIpO1xuICB9XG4gIGxldCBkaXNwb3NlcjtcbiAgY3JlYXRlUm9vdChkaXNwb3NlID0+IHtcbiAgICBkaXNwb3NlciA9IGRpc3Bvc2U7XG4gICAgZWxlbWVudCA9PT0gZG9jdW1lbnQgPyBjb2RlKCkgOiBpbnNlcnQoZWxlbWVudCwgY29kZSgpLCBlbGVtZW50LmZpcnN0Q2hpbGQgPyBudWxsIDogdW5kZWZpbmVkLCBpbml0KTtcbiAgfSwgb3B0aW9ucy5vd25lcik7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgZGlzcG9zZXIoKTtcbiAgICBlbGVtZW50LnRleHRDb250ZW50ID0gXCJcIjtcbiAgfTtcbn1cbmZ1bmN0aW9uIHRlbXBsYXRlKGh0bWwsIGlzSW1wb3J0Tm9kZSwgaXNTVkcsIGlzTWF0aE1MKSB7XG4gIGxldCBub2RlO1xuICBjb25zdCBjcmVhdGUgPSAoKSA9PiB7XG4gICAgaWYgKGlzSHlkcmF0aW5nKCkpIHRocm93IG5ldyBFcnJvcihcIkZhaWxlZCBhdHRlbXB0IHRvIGNyZWF0ZSBuZXcgRE9NIGVsZW1lbnRzIGR1cmluZyBoeWRyYXRpb24uIENoZWNrIHRoYXQgdGhlIGxpYnJhcmllcyB5b3UgYXJlIHVzaW5nIHN1cHBvcnQgaHlkcmF0aW9uLlwiKTtcbiAgICBjb25zdCB0ID0gaXNNYXRoTUwgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8xOTk4L01hdGgvTWF0aE1MXCIsIFwidGVtcGxhdGVcIikgOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIik7XG4gICAgdC5pbm5lckhUTUwgPSBodG1sO1xuICAgIHJldHVybiBpc1NWRyA/IHQuY29udGVudC5maXJzdENoaWxkLmZpcnN0Q2hpbGQgOiBpc01hdGhNTCA/IHQuZmlyc3RDaGlsZCA6IHQuY29udGVudC5maXJzdENoaWxkO1xuICB9O1xuICBjb25zdCBmbiA9IGlzSW1wb3J0Tm9kZSA/ICgpID0+IHVudHJhY2soKCkgPT4gZG9jdW1lbnQuaW1wb3J0Tm9kZShub2RlIHx8IChub2RlID0gY3JlYXRlKCkpLCB0cnVlKSkgOiAoKSA9PiAobm9kZSB8fCAobm9kZSA9IGNyZWF0ZSgpKSkuY2xvbmVOb2RlKHRydWUpO1xuICBmbi5jbG9uZU5vZGUgPSBmbjtcbiAgcmV0dXJuIGZuO1xufVxuZnVuY3Rpb24gZGVsZWdhdGVFdmVudHMoZXZlbnROYW1lcywgZG9jdW1lbnQgPSB3aW5kb3cuZG9jdW1lbnQpIHtcbiAgY29uc3QgZSA9IGRvY3VtZW50WyQkRVZFTlRTXSB8fCAoZG9jdW1lbnRbJCRFVkVOVFNdID0gbmV3IFNldCgpKTtcbiAgZm9yIChsZXQgaSA9IDAsIGwgPSBldmVudE5hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGNvbnN0IG5hbWUgPSBldmVudE5hbWVzW2ldO1xuICAgIGlmICghZS5oYXMobmFtZSkpIHtcbiAgICAgIGUuYWRkKG5hbWUpO1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBldmVudEhhbmRsZXIpO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gY2xlYXJEZWxlZ2F0ZWRFdmVudHMoZG9jdW1lbnQgPSB3aW5kb3cuZG9jdW1lbnQpIHtcbiAgaWYgKGRvY3VtZW50WyQkRVZFTlRTXSkge1xuICAgIGZvciAobGV0IG5hbWUgb2YgZG9jdW1lbnRbJCRFVkVOVFNdLmtleXMoKSkgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBldmVudEhhbmRsZXIpO1xuICAgIGRlbGV0ZSBkb2N1bWVudFskJEVWRU5UU107XG4gIH1cbn1cbmZ1bmN0aW9uIHNldFByb3BlcnR5KG5vZGUsIG5hbWUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBub2RlW25hbWVdID0gdmFsdWU7XG59XG5mdW5jdGlvbiBzZXRBdHRyaWJ1dGUobm9kZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIGlmICh2YWx1ZSA9PSBudWxsKSBub2RlLnJlbW92ZUF0dHJpYnV0ZShuYW1lKTtlbHNlIG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIHNldEF0dHJpYnV0ZU5TKG5vZGUsIG5hbWVzcGFjZSwgbmFtZSwgdmFsdWUpIHtcbiAgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm47XG4gIGlmICh2YWx1ZSA9PSBudWxsKSBub2RlLnJlbW92ZUF0dHJpYnV0ZU5TKG5hbWVzcGFjZSwgbmFtZSk7ZWxzZSBub2RlLnNldEF0dHJpYnV0ZU5TKG5hbWVzcGFjZSwgbmFtZSwgdmFsdWUpO1xufVxuZnVuY3Rpb24gc2V0Qm9vbEF0dHJpYnV0ZShub2RlLCBuYW1lLCB2YWx1ZSkge1xuICBpZiAoaXNIeWRyYXRpbmcobm9kZSkpIHJldHVybjtcbiAgdmFsdWUgPyBub2RlLnNldEF0dHJpYnV0ZShuYW1lLCBcIlwiKSA6IG5vZGUucmVtb3ZlQXR0cmlidXRlKG5hbWUpO1xufVxuZnVuY3Rpb24gY2xhc3NOYW1lKG5vZGUsIHZhbHVlKSB7XG4gIGlmIChpc0h5ZHJhdGluZyhub2RlKSkgcmV0dXJuO1xuICBpZiAodmFsdWUgPT0gbnVsbCkgbm9kZS5yZW1vdmVBdHRyaWJ1dGUoXCJjbGFzc1wiKTtlbHNlIG5vZGUuY2xhc3NOYW1lID0gdmFsdWU7XG59XG5mdW5jdGlvbiBhZGRFdmVudExpc3RlbmVyKG5vZGUsIG5hbWUsIGhhbmRsZXIsIGRlbGVnYXRlKSB7XG4gIGlmIChkZWxlZ2F0ZSkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KGhhbmRsZXIpKSB7XG4gICAgICBub2RlW2AkJCR7bmFtZX1gXSA9IGhhbmRsZXJbMF07XG4gICAgICBub2RlW2AkJCR7bmFtZX1EYXRhYF0gPSBoYW5kbGVyWzFdO1xuICAgIH0gZWxzZSBub2RlW2AkJCR7bmFtZX1gXSA9IGhhbmRsZXI7XG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShoYW5kbGVyKSkge1xuICAgIGNvbnN0IGhhbmRsZXJGbiA9IGhhbmRsZXJbMF07XG4gICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGhhbmRsZXJbMF0gPSBlID0+IGhhbmRsZXJGbi5jYWxsKG5vZGUsIGhhbmRsZXJbMV0sIGUpKTtcbiAgfSBlbHNlIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBoYW5kbGVyLCB0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiICYmIGhhbmRsZXIpO1xufVxuZnVuY3Rpb24gY2xhc3NMaXN0KG5vZGUsIHZhbHVlLCBwcmV2ID0ge30pIHtcbiAgY29uc3QgY2xhc3NLZXlzID0gT2JqZWN0LmtleXModmFsdWUgfHwge30pLFxuICAgIHByZXZLZXlzID0gT2JqZWN0LmtleXMocHJldik7XG4gIGxldCBpLCBsZW47XG4gIGZvciAoaSA9IDAsIGxlbiA9IHByZXZLZXlzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgY29uc3Qga2V5ID0gcHJldktleXNbaV07XG4gICAgaWYgKCFrZXkgfHwga2V5ID09PSBcInVuZGVmaW5lZFwiIHx8IHZhbHVlW2tleV0pIGNvbnRpbnVlO1xuICAgIHRvZ2dsZUNsYXNzS2V5KG5vZGUsIGtleSwgZmFsc2UpO1xuICAgIGRlbGV0ZSBwcmV2W2tleV07XG4gIH1cbiAgZm9yIChpID0gMCwgbGVuID0gY2xhc3NLZXlzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgY29uc3Qga2V5ID0gY2xhc3NLZXlzW2ldLFxuICAgICAgY2xhc3NWYWx1ZSA9ICEhdmFsdWVba2V5XTtcbiAgICBpZiAoIWtleSB8fCBrZXkgPT09IFwidW5kZWZpbmVkXCIgfHwgcHJldltrZXldID09PSBjbGFzc1ZhbHVlIHx8ICFjbGFzc1ZhbHVlKSBjb250aW51ZTtcbiAgICB0b2dnbGVDbGFzc0tleShub2RlLCBrZXksIHRydWUpO1xuICAgIHByZXZba2V5XSA9IGNsYXNzVmFsdWU7XG4gIH1cbiAgcmV0dXJuIHByZXY7XG59XG5mdW5jdGlvbiBzdHlsZShub2RlLCB2YWx1ZSwgcHJldikge1xuICBpZiAoIXZhbHVlKSByZXR1cm4gcHJldiA/IHNldEF0dHJpYnV0ZShub2RlLCBcInN0eWxlXCIpIDogdmFsdWU7XG4gIGNvbnN0IG5vZGVTdHlsZSA9IG5vZGUuc3R5bGU7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHJldHVybiBub2RlU3R5bGUuY3NzVGV4dCA9IHZhbHVlO1xuICB0eXBlb2YgcHJldiA9PT0gXCJzdHJpbmdcIiAmJiAobm9kZVN0eWxlLmNzc1RleHQgPSBwcmV2ID0gdW5kZWZpbmVkKTtcbiAgcHJldiB8fCAocHJldiA9IHt9KTtcbiAgdmFsdWUgfHwgKHZhbHVlID0ge30pO1xuICBsZXQgdiwgcztcbiAgZm9yIChzIGluIHByZXYpIHtcbiAgICB2YWx1ZVtzXSA9PSBudWxsICYmIG5vZGVTdHlsZS5yZW1vdmVQcm9wZXJ0eShzKTtcbiAgICBkZWxldGUgcHJldltzXTtcbiAgfVxuICBmb3IgKHMgaW4gdmFsdWUpIHtcbiAgICB2ID0gdmFsdWVbc107XG4gICAgaWYgKHYgIT09IHByZXZbc10pIHtcbiAgICAgIG5vZGVTdHlsZS5zZXRQcm9wZXJ0eShzLCB2KTtcbiAgICAgIHByZXZbc10gPSB2O1xuICAgIH1cbiAgfVxuICByZXR1cm4gcHJldjtcbn1cbmZ1bmN0aW9uIHNwcmVhZChub2RlLCBwcm9wcyA9IHt9LCBpc1NWRywgc2tpcENoaWxkcmVuKSB7XG4gIGNvbnN0IHByZXZQcm9wcyA9IHt9O1xuICBpZiAoIXNraXBDaGlsZHJlbikge1xuICAgIGNyZWF0ZVJlbmRlckVmZmVjdCgoKSA9PiBwcmV2UHJvcHMuY2hpbGRyZW4gPSBpbnNlcnRFeHByZXNzaW9uKG5vZGUsIHByb3BzLmNoaWxkcmVuLCBwcmV2UHJvcHMuY2hpbGRyZW4pKTtcbiAgfVxuICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4gdHlwZW9mIHByb3BzLnJlZiA9PT0gXCJmdW5jdGlvblwiICYmIHVzZShwcm9wcy5yZWYsIG5vZGUpKTtcbiAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IGFzc2lnbihub2RlLCBwcm9wcywgaXNTVkcsIHRydWUsIHByZXZQcm9wcywgdHJ1ZSkpO1xuICByZXR1cm4gcHJldlByb3BzO1xufVxuZnVuY3Rpb24gZHluYW1pY1Byb3BlcnR5KHByb3BzLCBrZXkpIHtcbiAgY29uc3Qgc3JjID0gcHJvcHNba2V5XTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3BzLCBrZXksIHtcbiAgICBnZXQoKSB7XG4gICAgICByZXR1cm4gc3JjKCk7XG4gICAgfSxcbiAgICBlbnVtZXJhYmxlOiB0cnVlXG4gIH0pO1xuICByZXR1cm4gcHJvcHM7XG59XG5mdW5jdGlvbiB1c2UoZm4sIGVsZW1lbnQsIGFyZykge1xuICByZXR1cm4gdW50cmFjaygoKSA9PiBmbihlbGVtZW50LCBhcmcpKTtcbn1cbmZ1bmN0aW9uIGluc2VydChwYXJlbnQsIGFjY2Vzc29yLCBtYXJrZXIsIGluaXRpYWwpIHtcbiAgaWYgKG1hcmtlciAhPT0gdW5kZWZpbmVkICYmICFpbml0aWFsKSBpbml0aWFsID0gW107XG4gIGlmICh0eXBlb2YgYWNjZXNzb3IgIT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIGluc2VydEV4cHJlc3Npb24ocGFyZW50LCBhY2Nlc3NvciwgaW5pdGlhbCwgbWFya2VyKTtcbiAgY3JlYXRlUmVuZGVyRWZmZWN0KGN1cnJlbnQgPT4gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIGFjY2Vzc29yKCksIGN1cnJlbnQsIG1hcmtlciksIGluaXRpYWwpO1xufVxuZnVuY3Rpb24gYXNzaWduKG5vZGUsIHByb3BzLCBpc1NWRywgc2tpcENoaWxkcmVuLCBwcmV2UHJvcHMgPSB7fSwgc2tpcFJlZiA9IGZhbHNlKSB7XG4gIHByb3BzIHx8IChwcm9wcyA9IHt9KTtcbiAgZm9yIChjb25zdCBwcm9wIGluIHByZXZQcm9wcykge1xuICAgIGlmICghKHByb3AgaW4gcHJvcHMpKSB7XG4gICAgICBpZiAocHJvcCA9PT0gXCJjaGlsZHJlblwiKSBjb250aW51ZTtcbiAgICAgIHByZXZQcm9wc1twcm9wXSA9IGFzc2lnblByb3Aobm9kZSwgcHJvcCwgbnVsbCwgcHJldlByb3BzW3Byb3BdLCBpc1NWRywgc2tpcFJlZiwgcHJvcHMpO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IHByb3AgaW4gcHJvcHMpIHtcbiAgICBpZiAocHJvcCA9PT0gXCJjaGlsZHJlblwiKSB7XG4gICAgICBpZiAoIXNraXBDaGlsZHJlbikgaW5zZXJ0RXhwcmVzc2lvbihub2RlLCBwcm9wcy5jaGlsZHJlbik7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSBwcm9wc1twcm9wXTtcbiAgICBwcmV2UHJvcHNbcHJvcF0gPSBhc3NpZ25Qcm9wKG5vZGUsIHByb3AsIHZhbHVlLCBwcmV2UHJvcHNbcHJvcF0sIGlzU1ZHLCBza2lwUmVmLCBwcm9wcyk7XG4gIH1cbn1cbmZ1bmN0aW9uIGh5ZHJhdGUkMShjb2RlLCBlbGVtZW50LCBvcHRpb25zID0ge30pIHtcbiAgaWYgKGdsb2JhbFRoaXMuXyRIWS5kb25lKSByZXR1cm4gcmVuZGVyKGNvZGUsIGVsZW1lbnQsIFsuLi5lbGVtZW50LmNoaWxkTm9kZXNdLCBvcHRpb25zKTtcbiAgc2hhcmVkQ29uZmlnLmNvbXBsZXRlZCA9IGdsb2JhbFRoaXMuXyRIWS5jb21wbGV0ZWQ7XG4gIHNoYXJlZENvbmZpZy5ldmVudHMgPSBnbG9iYWxUaGlzLl8kSFkuZXZlbnRzO1xuICBzaGFyZWRDb25maWcubG9hZCA9IGlkID0+IGdsb2JhbFRoaXMuXyRIWS5yW2lkXTtcbiAgc2hhcmVkQ29uZmlnLmhhcyA9IGlkID0+IGlkIGluIGdsb2JhbFRoaXMuXyRIWS5yO1xuICBzaGFyZWRDb25maWcuZ2F0aGVyID0gcm9vdCA9PiBnYXRoZXJIeWRyYXRhYmxlKGVsZW1lbnQsIHJvb3QpO1xuICBzaGFyZWRDb25maWcucmVnaXN0cnkgPSBuZXcgTWFwKCk7XG4gIHNoYXJlZENvbmZpZy5jb250ZXh0ID0ge1xuICAgIGlkOiBvcHRpb25zLnJlbmRlcklkIHx8IFwiXCIsXG4gICAgY291bnQ6IDBcbiAgfTtcbiAgdHJ5IHtcbiAgICBnYXRoZXJIeWRyYXRhYmxlKGVsZW1lbnQsIG9wdGlvbnMucmVuZGVySWQpO1xuICAgIHJldHVybiByZW5kZXIoY29kZSwgZWxlbWVudCwgWy4uLmVsZW1lbnQuY2hpbGROb2Rlc10sIG9wdGlvbnMpO1xuICB9IGZpbmFsbHkge1xuICAgIHNoYXJlZENvbmZpZy5jb250ZXh0ID0gbnVsbDtcbiAgfVxufVxuZnVuY3Rpb24gZ2V0TmV4dEVsZW1lbnQodGVtcGxhdGUpIHtcbiAgbGV0IG5vZGUsXG4gICAga2V5LFxuICAgIGh5ZHJhdGluZyA9IGlzSHlkcmF0aW5nKCk7XG4gIGlmICghaHlkcmF0aW5nIHx8ICEobm9kZSA9IHNoYXJlZENvbmZpZy5yZWdpc3RyeS5nZXQoa2V5ID0gZ2V0SHlkcmF0aW9uS2V5KCkpKSkge1xuICAgIGlmIChoeWRyYXRpbmcpIHtcbiAgICAgIHNoYXJlZENvbmZpZy5kb25lID0gdHJ1ZTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSHlkcmF0aW9uIE1pc21hdGNoLiBVbmFibGUgdG8gZmluZCBET00gbm9kZXMgZm9yIGh5ZHJhdGlvbiBrZXk6ICR7a2V5fVxcbiR7dGVtcGxhdGUgPyB0ZW1wbGF0ZSgpLm91dGVySFRNTCA6IFwiXCJ9YCk7XG4gICAgfVxuICAgIHJldHVybiB0ZW1wbGF0ZSgpO1xuICB9XG4gIGlmIChzaGFyZWRDb25maWcuY29tcGxldGVkKSBzaGFyZWRDb25maWcuY29tcGxldGVkLmFkZChub2RlKTtcbiAgc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LmRlbGV0ZShrZXkpO1xuICByZXR1cm4gbm9kZTtcbn1cbmZ1bmN0aW9uIGdldE5leHRNYXRjaChlbCwgbm9kZU5hbWUpIHtcbiAgd2hpbGUgKGVsICYmIGVsLmxvY2FsTmFtZSAhPT0gbm9kZU5hbWUpIGVsID0gZWwubmV4dFNpYmxpbmc7XG4gIHJldHVybiBlbDtcbn1cbmZ1bmN0aW9uIGdldE5leHRNYXJrZXIoc3RhcnQpIHtcbiAgbGV0IGVuZCA9IHN0YXJ0LFxuICAgIGNvdW50ID0gMCxcbiAgICBjdXJyZW50ID0gW107XG4gIGlmIChpc0h5ZHJhdGluZyhzdGFydCkpIHtcbiAgICB3aGlsZSAoZW5kKSB7XG4gICAgICBpZiAoZW5kLm5vZGVUeXBlID09PSA4KSB7XG4gICAgICAgIGNvbnN0IHYgPSBlbmQubm9kZVZhbHVlO1xuICAgICAgICBpZiAodiA9PT0gXCIkXCIpIGNvdW50Kys7ZWxzZSBpZiAodiA9PT0gXCIvXCIpIHtcbiAgICAgICAgICBpZiAoY291bnQgPT09IDApIHJldHVybiBbZW5kLCBjdXJyZW50XTtcbiAgICAgICAgICBjb3VudC0tO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjdXJyZW50LnB1c2goZW5kKTtcbiAgICAgIGVuZCA9IGVuZC5uZXh0U2libGluZztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIFtlbmQsIGN1cnJlbnRdO1xufVxuZnVuY3Rpb24gcnVuSHlkcmF0aW9uRXZlbnRzKCkge1xuICBpZiAoc2hhcmVkQ29uZmlnLmV2ZW50cyAmJiAhc2hhcmVkQ29uZmlnLmV2ZW50cy5xdWV1ZWQpIHtcbiAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIGNvbXBsZXRlZCxcbiAgICAgICAgZXZlbnRzXG4gICAgICB9ID0gc2hhcmVkQ29uZmlnO1xuICAgICAgaWYgKCFldmVudHMpIHJldHVybjtcbiAgICAgIGV2ZW50cy5xdWV1ZWQgPSBmYWxzZTtcbiAgICAgIHdoaWxlIChldmVudHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IFtlbCwgZV0gPSBldmVudHNbMF07XG4gICAgICAgIGlmICghY29tcGxldGVkLmhhcyhlbCkpIHJldHVybjtcbiAgICAgICAgZXZlbnRzLnNoaWZ0KCk7XG4gICAgICAgIGV2ZW50SGFuZGxlcihlKTtcbiAgICAgIH1cbiAgICAgIGlmIChzaGFyZWRDb25maWcuZG9uZSkge1xuICAgICAgICBzaGFyZWRDb25maWcuZXZlbnRzID0gXyRIWS5ldmVudHMgPSBudWxsO1xuICAgICAgICBzaGFyZWRDb25maWcuY29tcGxldGVkID0gXyRIWS5jb21wbGV0ZWQgPSBudWxsO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHNoYXJlZENvbmZpZy5ldmVudHMucXVldWVkID0gdHJ1ZTtcbiAgfVxufVxuZnVuY3Rpb24gaXNIeWRyYXRpbmcobm9kZSkge1xuICByZXR1cm4gISFzaGFyZWRDb25maWcuY29udGV4dCAmJiAhc2hhcmVkQ29uZmlnLmRvbmUgJiYgKCFub2RlIHx8IG5vZGUuaXNDb25uZWN0ZWQpO1xufVxuZnVuY3Rpb24gdG9Qcm9wZXJ0eU5hbWUobmFtZSkge1xuICByZXR1cm4gbmFtZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoLy0oW2Etel0pL2csIChfLCB3KSA9PiB3LnRvVXBwZXJDYXNlKCkpO1xufVxuZnVuY3Rpb24gdG9nZ2xlQ2xhc3NLZXkobm9kZSwga2V5LCB2YWx1ZSkge1xuICBjb25zdCBjbGFzc05hbWVzID0ga2V5LnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICBmb3IgKGxldCBpID0gMCwgbmFtZUxlbiA9IGNsYXNzTmFtZXMubGVuZ3RoOyBpIDwgbmFtZUxlbjsgaSsrKSBub2RlLmNsYXNzTGlzdC50b2dnbGUoY2xhc3NOYW1lc1tpXSwgdmFsdWUpO1xufVxuZnVuY3Rpb24gYXNzaWduUHJvcChub2RlLCBwcm9wLCB2YWx1ZSwgcHJldiwgaXNTVkcsIHNraXBSZWYsIHByb3BzKSB7XG4gIGxldCBpc0NFLCBpc1Byb3AsIGlzQ2hpbGRQcm9wLCBwcm9wQWxpYXMsIGZvcmNlUHJvcDtcbiAgaWYgKHByb3AgPT09IFwic3R5bGVcIikgcmV0dXJuIHN0eWxlKG5vZGUsIHZhbHVlLCBwcmV2KTtcbiAgaWYgKHByb3AgPT09IFwiY2xhc3NMaXN0XCIpIHJldHVybiBjbGFzc0xpc3Qobm9kZSwgdmFsdWUsIHByZXYpO1xuICBpZiAodmFsdWUgPT09IHByZXYpIHJldHVybiBwcmV2O1xuICBpZiAocHJvcCA9PT0gXCJyZWZcIikge1xuICAgIGlmICghc2tpcFJlZikgdmFsdWUobm9kZSk7XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCAzKSA9PT0gXCJvbjpcIikge1xuICAgIGNvbnN0IGUgPSBwcm9wLnNsaWNlKDMpO1xuICAgIHByZXYgJiYgbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKGUsIHByZXYsIHR5cGVvZiBwcmV2ICE9PSBcImZ1bmN0aW9uXCIgJiYgcHJldik7XG4gICAgdmFsdWUgJiYgbm9kZS5hZGRFdmVudExpc3RlbmVyKGUsIHZhbHVlLCB0eXBlb2YgdmFsdWUgIT09IFwiZnVuY3Rpb25cIiAmJiB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCAxMCkgPT09IFwib25jYXB0dXJlOlwiKSB7XG4gICAgY29uc3QgZSA9IHByb3Auc2xpY2UoMTApO1xuICAgIHByZXYgJiYgbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKGUsIHByZXYsIHRydWUpO1xuICAgIHZhbHVlICYmIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihlLCB2YWx1ZSwgdHJ1ZSk7XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCAyKSA9PT0gXCJvblwiKSB7XG4gICAgY29uc3QgbmFtZSA9IHByb3Auc2xpY2UoMikudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBkZWxlZ2F0ZSA9IERlbGVnYXRlZEV2ZW50cy5oYXMobmFtZSk7XG4gICAgaWYgKCFkZWxlZ2F0ZSAmJiBwcmV2KSB7XG4gICAgICBjb25zdCBoID0gQXJyYXkuaXNBcnJheShwcmV2KSA/IHByZXZbMF0gOiBwcmV2O1xuICAgICAgbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKG5hbWUsIGgpO1xuICAgIH1cbiAgICBpZiAoZGVsZWdhdGUgfHwgdmFsdWUpIHtcbiAgICAgIGFkZEV2ZW50TGlzdGVuZXIobm9kZSwgbmFtZSwgdmFsdWUsIGRlbGVnYXRlKTtcbiAgICAgIGRlbGVnYXRlICYmIGRlbGVnYXRlRXZlbnRzKFtuYW1lXSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHByb3Auc2xpY2UoMCwgNSkgPT09IFwiYXR0cjpcIikge1xuICAgIHNldEF0dHJpYnV0ZShub2RlLCBwcm9wLnNsaWNlKDUpLCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAocHJvcC5zbGljZSgwLCA1KSA9PT0gXCJib29sOlwiKSB7XG4gICAgc2V0Qm9vbEF0dHJpYnV0ZShub2RlLCBwcm9wLnNsaWNlKDUpLCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoKGZvcmNlUHJvcCA9IHByb3Auc2xpY2UoMCwgNSkgPT09IFwicHJvcDpcIikgfHwgKGlzQ2hpbGRQcm9wID0gQ2hpbGRQcm9wZXJ0aWVzLmhhcyhwcm9wKSkgfHwgIWlzU1ZHICYmICgocHJvcEFsaWFzID0gZ2V0UHJvcEFsaWFzKHByb3AsIG5vZGUudGFnTmFtZSkpIHx8IChpc1Byb3AgPSBQcm9wZXJ0aWVzLmhhcyhwcm9wKSkpIHx8IChpc0NFID0gbm9kZS5ub2RlTmFtZS5pbmNsdWRlcyhcIi1cIikgfHwgXCJpc1wiIGluIHByb3BzKSkge1xuICAgIGlmIChmb3JjZVByb3ApIHtcbiAgICAgIHByb3AgPSBwcm9wLnNsaWNlKDUpO1xuICAgICAgaXNQcm9wID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKGlzSHlkcmF0aW5nKG5vZGUpKSByZXR1cm4gdmFsdWU7XG4gICAgaWYgKHByb3AgPT09IFwiY2xhc3NcIiB8fCBwcm9wID09PSBcImNsYXNzTmFtZVwiKSBjbGFzc05hbWUobm9kZSwgdmFsdWUpO2Vsc2UgaWYgKGlzQ0UgJiYgIWlzUHJvcCAmJiAhaXNDaGlsZFByb3ApIG5vZGVbdG9Qcm9wZXJ0eU5hbWUocHJvcCldID0gdmFsdWU7ZWxzZSBub2RlW3Byb3BBbGlhcyB8fCBwcm9wXSA9IHZhbHVlO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IG5zID0gaXNTVkcgJiYgcHJvcC5pbmRleE9mKFwiOlwiKSA+IC0xICYmIFNWR05hbWVzcGFjZVtwcm9wLnNwbGl0KFwiOlwiKVswXV07XG4gICAgaWYgKG5zKSBzZXRBdHRyaWJ1dGVOUyhub2RlLCBucywgcHJvcCwgdmFsdWUpO2Vsc2Ugc2V0QXR0cmlidXRlKG5vZGUsIEFsaWFzZXNbcHJvcF0gfHwgcHJvcCwgdmFsdWUpO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIGV2ZW50SGFuZGxlcihlKSB7XG4gIGlmIChzaGFyZWRDb25maWcucmVnaXN0cnkgJiYgc2hhcmVkQ29uZmlnLmV2ZW50cykge1xuICAgIGlmIChzaGFyZWRDb25maWcuZXZlbnRzLmZpbmQoKFtlbCwgZXZdKSA9PiBldiA9PT0gZSkpIHJldHVybjtcbiAgfVxuICBsZXQgbm9kZSA9IGUudGFyZ2V0O1xuICBjb25zdCBrZXkgPSBgJCQke2UudHlwZX1gO1xuICBjb25zdCBvcmlUYXJnZXQgPSBlLnRhcmdldDtcbiAgY29uc3Qgb3JpQ3VycmVudFRhcmdldCA9IGUuY3VycmVudFRhcmdldDtcbiAgY29uc3QgcmV0YXJnZXQgPSB2YWx1ZSA9PiBPYmplY3QuZGVmaW5lUHJvcGVydHkoZSwgXCJ0YXJnZXRcIiwge1xuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB2YWx1ZVxuICB9KTtcbiAgY29uc3QgaGFuZGxlTm9kZSA9ICgpID0+IHtcbiAgICBjb25zdCBoYW5kbGVyID0gbm9kZVtrZXldO1xuICAgIGlmIChoYW5kbGVyICYmICFub2RlLmRpc2FibGVkKSB7XG4gICAgICBjb25zdCBkYXRhID0gbm9kZVtgJHtrZXl9RGF0YWBdO1xuICAgICAgZGF0YSAhPT0gdW5kZWZpbmVkID8gaGFuZGxlci5jYWxsKG5vZGUsIGRhdGEsIGUpIDogaGFuZGxlci5jYWxsKG5vZGUsIGUpO1xuICAgICAgaWYgKGUuY2FuY2VsQnViYmxlKSByZXR1cm47XG4gICAgfVxuICAgIG5vZGUuaG9zdCAmJiB0eXBlb2Ygbm9kZS5ob3N0ICE9PSBcInN0cmluZ1wiICYmICFub2RlLmhvc3QuXyRob3N0ICYmIG5vZGUuY29udGFpbnMoZS50YXJnZXQpICYmIHJldGFyZ2V0KG5vZGUuaG9zdCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG4gIGNvbnN0IHdhbGtVcFRyZWUgPSAoKSA9PiB7XG4gICAgd2hpbGUgKGhhbmRsZU5vZGUoKSAmJiAobm9kZSA9IG5vZGUuXyRob3N0IHx8IG5vZGUucGFyZW50Tm9kZSB8fCBub2RlLmhvc3QpKTtcbiAgfTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGUsIFwiY3VycmVudFRhcmdldFwiLCB7XG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIGdldCgpIHtcbiAgICAgIHJldHVybiBub2RlIHx8IGRvY3VtZW50O1xuICAgIH1cbiAgfSk7XG4gIGlmIChzaGFyZWRDb25maWcucmVnaXN0cnkgJiYgIXNoYXJlZENvbmZpZy5kb25lKSBzaGFyZWRDb25maWcuZG9uZSA9IF8kSFkuZG9uZSA9IHRydWU7XG4gIGlmIChlLmNvbXBvc2VkUGF0aCkge1xuICAgIGNvbnN0IHBhdGggPSBlLmNvbXBvc2VkUGF0aCgpO1xuICAgIHJldGFyZ2V0KHBhdGhbMF0pO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0aC5sZW5ndGggLSAyOyBpKyspIHtcbiAgICAgIG5vZGUgPSBwYXRoW2ldO1xuICAgICAgaWYgKCFoYW5kbGVOb2RlKCkpIGJyZWFrO1xuICAgICAgaWYgKG5vZGUuXyRob3N0KSB7XG4gICAgICAgIG5vZGUgPSBub2RlLl8kaG9zdDtcbiAgICAgICAgd2Fsa1VwVHJlZSgpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmIChub2RlLnBhcmVudE5vZGUgPT09IG9yaUN1cnJlbnRUYXJnZXQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGVsc2Ugd2Fsa1VwVHJlZSgpO1xuICByZXRhcmdldChvcmlUYXJnZXQpO1xufVxuZnVuY3Rpb24gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIHZhbHVlLCBjdXJyZW50LCBtYXJrZXIsIHVud3JhcEFycmF5KSB7XG4gIGNvbnN0IGh5ZHJhdGluZyA9IGlzSHlkcmF0aW5nKHBhcmVudCk7XG4gIGlmIChoeWRyYXRpbmcpIHtcbiAgICAhY3VycmVudCAmJiAoY3VycmVudCA9IFsuLi5wYXJlbnQuY2hpbGROb2Rlc10pO1xuICAgIGxldCBjbGVhbmVkID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjdXJyZW50Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBub2RlID0gY3VycmVudFtpXTtcbiAgICAgIGlmIChub2RlLm5vZGVUeXBlID09PSA4ICYmIG5vZGUuZGF0YS5zbGljZSgwLCAyKSA9PT0gXCIhJFwiKSBub2RlLnJlbW92ZSgpO2Vsc2UgY2xlYW5lZC5wdXNoKG5vZGUpO1xuICAgIH1cbiAgICBjdXJyZW50ID0gY2xlYW5lZDtcbiAgfVxuICB3aGlsZSAodHlwZW9mIGN1cnJlbnQgPT09IFwiZnVuY3Rpb25cIikgY3VycmVudCA9IGN1cnJlbnQoKTtcbiAgaWYgKHZhbHVlID09PSBjdXJyZW50KSByZXR1cm4gY3VycmVudDtcbiAgY29uc3QgdCA9IHR5cGVvZiB2YWx1ZSxcbiAgICBtdWx0aSA9IG1hcmtlciAhPT0gdW5kZWZpbmVkO1xuICBwYXJlbnQgPSBtdWx0aSAmJiBjdXJyZW50WzBdICYmIGN1cnJlbnRbMF0ucGFyZW50Tm9kZSB8fCBwYXJlbnQ7XG4gIGlmICh0ID09PSBcInN0cmluZ1wiIHx8IHQgPT09IFwibnVtYmVyXCIpIHtcbiAgICBpZiAoaHlkcmF0aW5nKSByZXR1cm4gY3VycmVudDtcbiAgICBpZiAodCA9PT0gXCJudW1iZXJcIikge1xuICAgICAgdmFsdWUgPSB2YWx1ZS50b1N0cmluZygpO1xuICAgICAgaWYgKHZhbHVlID09PSBjdXJyZW50KSByZXR1cm4gY3VycmVudDtcbiAgICB9XG4gICAgaWYgKG11bHRpKSB7XG4gICAgICBsZXQgbm9kZSA9IGN1cnJlbnRbMF07XG4gICAgICBpZiAobm9kZSAmJiBub2RlLm5vZGVUeXBlID09PSAzKSB7XG4gICAgICAgIG5vZGUuZGF0YSAhPT0gdmFsdWUgJiYgKG5vZGUuZGF0YSA9IHZhbHVlKTtcbiAgICAgIH0gZWxzZSBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodmFsdWUpO1xuICAgICAgY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIsIG5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoY3VycmVudCAhPT0gXCJcIiAmJiB0eXBlb2YgY3VycmVudCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICBjdXJyZW50ID0gcGFyZW50LmZpcnN0Q2hpbGQuZGF0YSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIGN1cnJlbnQgPSBwYXJlbnQudGV4dENvbnRlbnQgPSB2YWx1ZTtcbiAgICB9XG4gIH0gZWxzZSBpZiAodmFsdWUgPT0gbnVsbCB8fCB0ID09PSBcImJvb2xlYW5cIikge1xuICAgIGlmIChoeWRyYXRpbmcpIHJldHVybiBjdXJyZW50O1xuICAgIGN1cnJlbnQgPSBjbGVhbkNoaWxkcmVuKHBhcmVudCwgY3VycmVudCwgbWFya2VyKTtcbiAgfSBlbHNlIGlmICh0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBjcmVhdGVSZW5kZXJFZmZlY3QoKCkgPT4ge1xuICAgICAgbGV0IHYgPSB2YWx1ZSgpO1xuICAgICAgd2hpbGUgKHR5cGVvZiB2ID09PSBcImZ1bmN0aW9uXCIpIHYgPSB2KCk7XG4gICAgICBjdXJyZW50ID0gaW5zZXJ0RXhwcmVzc2lvbihwYXJlbnQsIHYsIGN1cnJlbnQsIG1hcmtlcik7XG4gICAgfSk7XG4gICAgcmV0dXJuICgpID0+IGN1cnJlbnQ7XG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICBjb25zdCBhcnJheSA9IFtdO1xuICAgIGNvbnN0IGN1cnJlbnRBcnJheSA9IGN1cnJlbnQgJiYgQXJyYXkuaXNBcnJheShjdXJyZW50KTtcbiAgICBpZiAobm9ybWFsaXplSW5jb21pbmdBcnJheShhcnJheSwgdmFsdWUsIGN1cnJlbnQsIHVud3JhcEFycmF5KSkge1xuICAgICAgY3JlYXRlUmVuZGVyRWZmZWN0KCgpID0+IGN1cnJlbnQgPSBpbnNlcnRFeHByZXNzaW9uKHBhcmVudCwgYXJyYXksIGN1cnJlbnQsIG1hcmtlciwgdHJ1ZSkpO1xuICAgICAgcmV0dXJuICgpID0+IGN1cnJlbnQ7XG4gICAgfVxuICAgIGlmIChoeWRyYXRpbmcpIHtcbiAgICAgIGlmICghYXJyYXkubGVuZ3RoKSByZXR1cm4gY3VycmVudDtcbiAgICAgIGlmIChtYXJrZXIgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGN1cnJlbnQgPSBbLi4ucGFyZW50LmNoaWxkTm9kZXNdO1xuICAgICAgbGV0IG5vZGUgPSBhcnJheVswXTtcbiAgICAgIGlmIChub2RlLnBhcmVudE5vZGUgIT09IHBhcmVudCkgcmV0dXJuIGN1cnJlbnQ7XG4gICAgICBjb25zdCBub2RlcyA9IFtub2RlXTtcbiAgICAgIHdoaWxlICgobm9kZSA9IG5vZGUubmV4dFNpYmxpbmcpICE9PSBtYXJrZXIpIG5vZGVzLnB1c2gobm9kZSk7XG4gICAgICByZXR1cm4gY3VycmVudCA9IG5vZGVzO1xuICAgIH1cbiAgICBpZiAoYXJyYXkubGVuZ3RoID09PSAwKSB7XG4gICAgICBjdXJyZW50ID0gY2xlYW5DaGlsZHJlbihwYXJlbnQsIGN1cnJlbnQsIG1hcmtlcik7XG4gICAgICBpZiAobXVsdGkpIHJldHVybiBjdXJyZW50O1xuICAgIH0gZWxzZSBpZiAoY3VycmVudEFycmF5KSB7XG4gICAgICBpZiAoY3VycmVudC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgYXBwZW5kTm9kZXMocGFyZW50LCBhcnJheSwgbWFya2VyKTtcbiAgICAgIH0gZWxzZSByZWNvbmNpbGVBcnJheXMocGFyZW50LCBjdXJyZW50LCBhcnJheSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN1cnJlbnQgJiYgY2xlYW5DaGlsZHJlbihwYXJlbnQpO1xuICAgICAgYXBwZW5kTm9kZXMocGFyZW50LCBhcnJheSk7XG4gICAgfVxuICAgIGN1cnJlbnQgPSBhcnJheTtcbiAgfSBlbHNlIGlmICh2YWx1ZS5ub2RlVHlwZSkge1xuICAgIGlmIChoeWRyYXRpbmcgJiYgdmFsdWUucGFyZW50Tm9kZSkgcmV0dXJuIGN1cnJlbnQgPSBtdWx0aSA/IFt2YWx1ZV0gOiB2YWx1ZTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShjdXJyZW50KSkge1xuICAgICAgaWYgKG11bHRpKSByZXR1cm4gY3VycmVudCA9IGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIsIHZhbHVlKTtcbiAgICAgIGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBudWxsLCB2YWx1ZSk7XG4gICAgfSBlbHNlIGlmIChjdXJyZW50ID09IG51bGwgfHwgY3VycmVudCA9PT0gXCJcIiB8fCAhcGFyZW50LmZpcnN0Q2hpbGQpIHtcbiAgICAgIHBhcmVudC5hcHBlbmRDaGlsZCh2YWx1ZSk7XG4gICAgfSBlbHNlIHBhcmVudC5yZXBsYWNlQ2hpbGQodmFsdWUsIHBhcmVudC5maXJzdENoaWxkKTtcbiAgICBjdXJyZW50ID0gdmFsdWU7XG4gIH0gZWxzZSBjb25zb2xlLndhcm4oYFVucmVjb2duaXplZCB2YWx1ZS4gU2tpcHBlZCBpbnNlcnRpbmdgLCB2YWx1ZSk7XG4gIHJldHVybiBjdXJyZW50O1xufVxuZnVuY3Rpb24gbm9ybWFsaXplSW5jb21pbmdBcnJheShub3JtYWxpemVkLCBhcnJheSwgY3VycmVudCwgdW53cmFwKSB7XG4gIGxldCBkeW5hbWljID0gZmFsc2U7XG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBhcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGxldCBpdGVtID0gYXJyYXlbaV0sXG4gICAgICBwcmV2ID0gY3VycmVudCAmJiBjdXJyZW50W25vcm1hbGl6ZWQubGVuZ3RoXSxcbiAgICAgIHQ7XG4gICAgaWYgKGl0ZW0gPT0gbnVsbCB8fCBpdGVtID09PSB0cnVlIHx8IGl0ZW0gPT09IGZhbHNlKSA7IGVsc2UgaWYgKCh0ID0gdHlwZW9mIGl0ZW0pID09PSBcIm9iamVjdFwiICYmIGl0ZW0ubm9kZVR5cGUpIHtcbiAgICAgIG5vcm1hbGl6ZWQucHVzaChpdGVtKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaXRlbSkpIHtcbiAgICAgIGR5bmFtaWMgPSBub3JtYWxpemVJbmNvbWluZ0FycmF5KG5vcm1hbGl6ZWQsIGl0ZW0sIHByZXYpIHx8IGR5bmFtaWM7XG4gICAgfSBlbHNlIGlmICh0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGlmICh1bndyYXApIHtcbiAgICAgICAgd2hpbGUgKHR5cGVvZiBpdGVtID09PSBcImZ1bmN0aW9uXCIpIGl0ZW0gPSBpdGVtKCk7XG4gICAgICAgIGR5bmFtaWMgPSBub3JtYWxpemVJbmNvbWluZ0FycmF5KG5vcm1hbGl6ZWQsIEFycmF5LmlzQXJyYXkoaXRlbSkgPyBpdGVtIDogW2l0ZW1dLCBBcnJheS5pc0FycmF5KHByZXYpID8gcHJldiA6IFtwcmV2XSkgfHwgZHluYW1pYztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5vcm1hbGl6ZWQucHVzaChpdGVtKTtcbiAgICAgICAgZHluYW1pYyA9IHRydWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gU3RyaW5nKGl0ZW0pO1xuICAgICAgaWYgKHByZXYgJiYgcHJldi5ub2RlVHlwZSA9PT0gMyAmJiBwcmV2LmRhdGEgPT09IHZhbHVlKSBub3JtYWxpemVkLnB1c2gocHJldik7ZWxzZSBub3JtYWxpemVkLnB1c2goZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodmFsdWUpKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGR5bmFtaWM7XG59XG5mdW5jdGlvbiBhcHBlbmROb2RlcyhwYXJlbnQsIGFycmF5LCBtYXJrZXIgPSBudWxsKSB7XG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBhcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykgcGFyZW50Lmluc2VydEJlZm9yZShhcnJheVtpXSwgbWFya2VyKTtcbn1cbmZ1bmN0aW9uIGNsZWFuQ2hpbGRyZW4ocGFyZW50LCBjdXJyZW50LCBtYXJrZXIsIHJlcGxhY2VtZW50KSB7XG4gIGlmIChtYXJrZXIgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHBhcmVudC50ZXh0Q29udGVudCA9IFwiXCI7XG4gIGNvbnN0IG5vZGUgPSByZXBsYWNlbWVudCB8fCBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIlwiKTtcbiAgaWYgKGN1cnJlbnQubGVuZ3RoKSB7XG4gICAgbGV0IGluc2VydGVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IGN1cnJlbnQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IGVsID0gY3VycmVudFtpXTtcbiAgICAgIGlmIChub2RlICE9PSBlbCkge1xuICAgICAgICBjb25zdCBpc1BhcmVudCA9IGVsLnBhcmVudE5vZGUgPT09IHBhcmVudDtcbiAgICAgICAgaWYgKCFpbnNlcnRlZCAmJiAhaSkgaXNQYXJlbnQgPyBwYXJlbnQucmVwbGFjZUNoaWxkKG5vZGUsIGVsKSA6IHBhcmVudC5pbnNlcnRCZWZvcmUobm9kZSwgbWFya2VyKTtlbHNlIGlzUGFyZW50ICYmIGVsLnJlbW92ZSgpO1xuICAgICAgfSBlbHNlIGluc2VydGVkID0gdHJ1ZTtcbiAgICB9XG4gIH0gZWxzZSBwYXJlbnQuaW5zZXJ0QmVmb3JlKG5vZGUsIG1hcmtlcik7XG4gIHJldHVybiBbbm9kZV07XG59XG5mdW5jdGlvbiBnYXRoZXJIeWRyYXRhYmxlKGVsZW1lbnQsIHJvb3QpIHtcbiAgY29uc3QgdGVtcGxhdGVzID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKGAqW2RhdGEtaGtdYCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcGxhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qgbm9kZSA9IHRlbXBsYXRlc1tpXTtcbiAgICBjb25zdCBrZXkgPSBub2RlLmdldEF0dHJpYnV0ZShcImRhdGEtaGtcIik7XG4gICAgaWYgKCghcm9vdCB8fCBrZXkuc3RhcnRzV2l0aChyb290KSkgJiYgIXNoYXJlZENvbmZpZy5yZWdpc3RyeS5oYXMoa2V5KSkgc2hhcmVkQ29uZmlnLnJlZ2lzdHJ5LnNldChrZXksIG5vZGUpO1xuICB9XG59XG5mdW5jdGlvbiBnZXRIeWRyYXRpb25LZXkoKSB7XG4gIHJldHVybiBzaGFyZWRDb25maWcuZ2V0TmV4dENvbnRleHRJZCgpO1xufVxuZnVuY3Rpb24gTm9IeWRyYXRpb24ocHJvcHMpIHtcbiAgcmV0dXJuIHNoYXJlZENvbmZpZy5jb250ZXh0ID8gdW5kZWZpbmVkIDogcHJvcHMuY2hpbGRyZW47XG59XG5mdW5jdGlvbiBIeWRyYXRpb24ocHJvcHMpIHtcbiAgcmV0dXJuIHByb3BzLmNoaWxkcmVuO1xufVxuY29uc3Qgdm9pZEZuID0gKCkgPT4gdW5kZWZpbmVkO1xuY29uc3QgUmVxdWVzdENvbnRleHQgPSBTeW1ib2woKTtcbmZ1bmN0aW9uIGlubmVySFRNTChwYXJlbnQsIGNvbnRlbnQpIHtcbiAgIXNoYXJlZENvbmZpZy5jb250ZXh0ICYmIChwYXJlbnQuaW5uZXJIVE1MID0gY29udGVudCk7XG59XG5cbmZ1bmN0aW9uIHRocm93SW5Ccm93c2VyKGZ1bmMpIHtcbiAgY29uc3QgZXJyID0gbmV3IEVycm9yKGAke2Z1bmMubmFtZX0gaXMgbm90IHN1cHBvcnRlZCBpbiB0aGUgYnJvd3NlciwgcmV0dXJuaW5nIHVuZGVmaW5lZGApO1xuICBjb25zb2xlLmVycm9yKGVycik7XG59XG5mdW5jdGlvbiByZW5kZXJUb1N0cmluZyhmbiwgb3B0aW9ucykge1xuICB0aHJvd0luQnJvd3NlcihyZW5kZXJUb1N0cmluZyk7XG59XG5mdW5jdGlvbiByZW5kZXJUb1N0cmluZ0FzeW5jKGZuLCBvcHRpb25zKSB7XG4gIHRocm93SW5Ccm93c2VyKHJlbmRlclRvU3RyaW5nQXN5bmMpO1xufVxuZnVuY3Rpb24gcmVuZGVyVG9TdHJlYW0oZm4sIG9wdGlvbnMpIHtcbiAgdGhyb3dJbkJyb3dzZXIocmVuZGVyVG9TdHJlYW0pO1xufVxuZnVuY3Rpb24gc3NyKHRlbXBsYXRlLCAuLi5ub2Rlcykge31cbmZ1bmN0aW9uIHNzckVsZW1lbnQobmFtZSwgcHJvcHMsIGNoaWxkcmVuLCBuZWVkc0lkKSB7fVxuZnVuY3Rpb24gc3NyQ2xhc3NMaXN0KHZhbHVlKSB7fVxuZnVuY3Rpb24gc3NyU3R5bGUodmFsdWUpIHt9XG5mdW5jdGlvbiBzc3JBdHRyaWJ1dGUoa2V5LCB2YWx1ZSkge31cbmZ1bmN0aW9uIHNzckh5ZHJhdGlvbktleSgpIHt9XG5mdW5jdGlvbiByZXNvbHZlU1NSTm9kZShub2RlKSB7fVxuZnVuY3Rpb24gZXNjYXBlKGh0bWwpIHt9XG5mdW5jdGlvbiBzc3JTcHJlYWQocHJvcHMsIGlzU1ZHLCBza2lwQ2hpbGRyZW4pIHt9XG5cbmNvbnN0IGlzU2VydmVyID0gZmFsc2U7XG5jb25zdCBpc0RldiA9IHRydWU7XG5jb25zdCBTVkdfTkFNRVNQQUNFID0gXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiO1xuZnVuY3Rpb24gY3JlYXRlRWxlbWVudCh0YWdOYW1lLCBpc1NWRyA9IGZhbHNlKSB7XG4gIHJldHVybiBpc1NWRyA/IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhTVkdfTkFNRVNQQUNFLCB0YWdOYW1lKSA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSk7XG59XG5jb25zdCBoeWRyYXRlID0gKC4uLmFyZ3MpID0+IHtcbiAgZW5hYmxlSHlkcmF0aW9uKCk7XG4gIHJldHVybiBoeWRyYXRlJDEoLi4uYXJncyk7XG59O1xuZnVuY3Rpb24gUG9ydGFsKHByb3BzKSB7XG4gIGNvbnN0IHtcbiAgICAgIHVzZVNoYWRvd1xuICAgIH0gPSBwcm9wcyxcbiAgICBtYXJrZXIgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIlwiKSxcbiAgICBtb3VudCA9ICgpID0+IHByb3BzLm1vdW50IHx8IGRvY3VtZW50LmJvZHksXG4gICAgb3duZXIgPSBnZXRPd25lcigpO1xuICBsZXQgY29udGVudDtcbiAgbGV0IGh5ZHJhdGluZyA9ICEhc2hhcmVkQ29uZmlnLmNvbnRleHQ7XG4gIGNyZWF0ZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGh5ZHJhdGluZykgZ2V0T3duZXIoKS51c2VyID0gaHlkcmF0aW5nID0gZmFsc2U7XG4gICAgY29udGVudCB8fCAoY29udGVudCA9IHJ1bldpdGhPd25lcihvd25lciwgKCkgPT4gY3JlYXRlTWVtbygoKSA9PiBwcm9wcy5jaGlsZHJlbikpKTtcbiAgICBjb25zdCBlbCA9IG1vdW50KCk7XG4gICAgaWYgKGVsIGluc3RhbmNlb2YgSFRNTEhlYWRFbGVtZW50KSB7XG4gICAgICBjb25zdCBbY2xlYW4sIHNldENsZWFuXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gICAgICBjb25zdCBjbGVhbnVwID0gKCkgPT4gc2V0Q2xlYW4odHJ1ZSk7XG4gICAgICBjcmVhdGVSb290KGRpc3Bvc2UgPT4gaW5zZXJ0KGVsLCAoKSA9PiAhY2xlYW4oKSA/IGNvbnRlbnQoKSA6IGRpc3Bvc2UoKSwgbnVsbCkpO1xuICAgICAgb25DbGVhbnVwKGNsZWFudXApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBjb250YWluZXIgPSBjcmVhdGVFbGVtZW50KHByb3BzLmlzU1ZHID8gXCJnXCIgOiBcImRpdlwiLCBwcm9wcy5pc1NWRyksXG4gICAgICAgIHJlbmRlclJvb3QgPSB1c2VTaGFkb3cgJiYgY29udGFpbmVyLmF0dGFjaFNoYWRvdyA/IGNvbnRhaW5lci5hdHRhY2hTaGFkb3coe1xuICAgICAgICAgIG1vZGU6IFwib3BlblwiXG4gICAgICAgIH0pIDogY29udGFpbmVyO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvbnRhaW5lciwgXCJfJGhvc3RcIiwge1xuICAgICAgICBnZXQoKSB7XG4gICAgICAgICAgcmV0dXJuIG1hcmtlci5wYXJlbnROb2RlO1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0pO1xuICAgICAgaW5zZXJ0KHJlbmRlclJvb3QsIGNvbnRlbnQpO1xuICAgICAgZWwuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcbiAgICAgIHByb3BzLnJlZiAmJiBwcm9wcy5yZWYoY29udGFpbmVyKTtcbiAgICAgIG9uQ2xlYW51cCgoKSA9PiBlbC5yZW1vdmVDaGlsZChjb250YWluZXIpKTtcbiAgICB9XG4gIH0sIHVuZGVmaW5lZCwge1xuICAgIHJlbmRlcjogIWh5ZHJhdGluZ1xuICB9KTtcbiAgcmV0dXJuIG1hcmtlcjtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUR5bmFtaWMoY29tcG9uZW50LCBwcm9wcykge1xuICBjb25zdCBjYWNoZWQgPSBjcmVhdGVNZW1vKGNvbXBvbmVudCk7XG4gIHJldHVybiBjcmVhdGVNZW1vKCgpID0+IHtcbiAgICBjb25zdCBjb21wb25lbnQgPSBjYWNoZWQoKTtcbiAgICBzd2l0Y2ggKHR5cGVvZiBjb21wb25lbnQpIHtcbiAgICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgICBPYmplY3QuYXNzaWduKGNvbXBvbmVudCwge1xuICAgICAgICAgIFskREVWQ09NUF06IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB1bnRyYWNrKCgpID0+IGNvbXBvbmVudChwcm9wcykpO1xuICAgICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgICBjb25zdCBpc1N2ZyA9IFNWR0VsZW1lbnRzLmhhcyhjb21wb25lbnQpO1xuICAgICAgICBjb25zdCBlbCA9IHNoYXJlZENvbmZpZy5jb250ZXh0ID8gZ2V0TmV4dEVsZW1lbnQoKSA6IGNyZWF0ZUVsZW1lbnQoY29tcG9uZW50LCBpc1N2Zyk7XG4gICAgICAgIHNwcmVhZChlbCwgcHJvcHMsIGlzU3ZnKTtcbiAgICAgICAgcmV0dXJuIGVsO1xuICAgIH1cbiAgfSk7XG59XG5mdW5jdGlvbiBEeW5hbWljKHByb3BzKSB7XG4gIGNvbnN0IFssIG90aGVyc10gPSBzcGxpdFByb3BzKHByb3BzLCBbXCJjb21wb25lbnRcIl0pO1xuICByZXR1cm4gY3JlYXRlRHluYW1pYygoKSA9PiBwcm9wcy5jb21wb25lbnQsIG90aGVycyk7XG59XG5cbmV4cG9ydCB7IEFsaWFzZXMsIHZvaWRGbiBhcyBBc3NldHMsIENoaWxkUHJvcGVydGllcywgRE9NRWxlbWVudHMsIERlbGVnYXRlZEV2ZW50cywgRHluYW1pYywgSHlkcmF0aW9uLCB2b2lkRm4gYXMgSHlkcmF0aW9uU2NyaXB0LCBOb0h5ZHJhdGlvbiwgUG9ydGFsLCBQcm9wZXJ0aWVzLCBSZXF1ZXN0Q29udGV4dCwgU1ZHRWxlbWVudHMsIFNWR05hbWVzcGFjZSwgYWRkRXZlbnRMaXN0ZW5lciwgYXNzaWduLCBjbGFzc0xpc3QsIGNsYXNzTmFtZSwgY2xlYXJEZWxlZ2F0ZWRFdmVudHMsIGNyZWF0ZUR5bmFtaWMsIGRlbGVnYXRlRXZlbnRzLCBkeW5hbWljUHJvcGVydHksIGVzY2FwZSwgdm9pZEZuIGFzIGdlbmVyYXRlSHlkcmF0aW9uU2NyaXB0LCB2b2lkRm4gYXMgZ2V0QXNzZXRzLCBnZXRIeWRyYXRpb25LZXksIGdldE5leHRFbGVtZW50LCBnZXROZXh0TWFya2VyLCBnZXROZXh0TWF0Y2gsIGdldFByb3BBbGlhcywgdm9pZEZuIGFzIGdldFJlcXVlc3RFdmVudCwgaHlkcmF0ZSwgaW5uZXJIVE1MLCBpbnNlcnQsIGlzRGV2LCBpc1NlcnZlciwgbWVtbywgcmVuZGVyLCByZW5kZXJUb1N0cmVhbSwgcmVuZGVyVG9TdHJpbmcsIHJlbmRlclRvU3RyaW5nQXN5bmMsIHJlc29sdmVTU1JOb2RlLCBydW5IeWRyYXRpb25FdmVudHMsIHNldEF0dHJpYnV0ZSwgc2V0QXR0cmlidXRlTlMsIHNldEJvb2xBdHRyaWJ1dGUsIHNldFByb3BlcnR5LCBzcHJlYWQsIHNzciwgc3NyQXR0cmlidXRlLCBzc3JDbGFzc0xpc3QsIHNzckVsZW1lbnQsIHNzckh5ZHJhdGlvbktleSwgc3NyU3ByZWFkLCBzc3JTdHlsZSwgc3R5bGUsIHRlbXBsYXRlLCB1c2UsIHZvaWRGbiBhcyB1c2VBc3NldHMgfTtcbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsIi8vIEdlbmVyYXRlZCB1c2luZyBgbnBtIHJ1biBidWlsZGAuIERvIG5vdCBlZGl0LlxuXG52YXIgcmVnZXggPSAvXlthLXpdKD86W1xcLjAtOV9hLXpcXHhCN1xceEMwLVxceEQ2XFx4RDgtXFx4RjZcXHhGOC1cXHUwMzdEXFx1MDM3Ri1cXHUxRkZGXFx1MjAwQ1xcdTIwMERcXHUyMDNGXFx1MjA0MFxcdTIwNzAtXFx1MjE4RlxcdTJDMDAtXFx1MkZFRlxcdTMwMDEtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZGRF18W1xcdUQ4MDAtXFx1REI3Rl1bXFx1REMwMC1cXHVERkZGXSkqLSg/OltcXHgyRFxcLjAtOV9hLXpcXHhCN1xceEMwLVxceEQ2XFx4RDgtXFx4RjZcXHhGOC1cXHUwMzdEXFx1MDM3Ri1cXHUxRkZGXFx1MjAwQ1xcdTIwMERcXHUyMDNGXFx1MjA0MFxcdTIwNzAtXFx1MjE4RlxcdTJDMDAtXFx1MkZFRlxcdTMwMDEtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZGRF18W1xcdUQ4MDAtXFx1REI3Rl1bXFx1REMwMC1cXHVERkZGXSkqJC87XG5cbnZhciBpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lID0gZnVuY3Rpb24oc3RyaW5nKSB7XG5cdHJldHVybiByZWdleC50ZXN0KHN0cmluZyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWU7XG4iLCJ2YXIgX19hc3luYyA9IChfX3RoaXMsIF9fYXJndW1lbnRzLCBnZW5lcmF0b3IpID0+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICB2YXIgZnVsZmlsbGVkID0gKHZhbHVlKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciByZWplY3RlZCA9ICh2YWx1ZSkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgc3RlcChnZW5lcmF0b3IudGhyb3codmFsdWUpKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgfVxuICAgIH07XG4gICAgdmFyIHN0ZXAgPSAoeCkgPT4geC5kb25lID8gcmVzb2x2ZSh4LnZhbHVlKSA6IFByb21pc2UucmVzb2x2ZSh4LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpO1xuICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseShfX3RoaXMsIF9fYXJndW1lbnRzKSkubmV4dCgpKTtcbiAgfSk7XG59O1xuXG4vLyBzcmMvaW5kZXgudHNcbmltcG9ydCBpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lIGZyb20gXCJpcy1wb3RlbnRpYWwtY3VzdG9tLWVsZW1lbnQtbmFtZVwiO1xuZnVuY3Rpb24gY3JlYXRlSXNvbGF0ZWRFbGVtZW50KG9wdGlvbnMpIHtcbiAgcmV0dXJuIF9fYXN5bmModGhpcywgbnVsbCwgZnVuY3Rpb24qICgpIHtcbiAgICBjb25zdCB7IG5hbWUsIG1vZGUgPSBcImNsb3NlZFwiLCBjc3MsIGlzb2xhdGVFdmVudHMgPSBmYWxzZSB9ID0gb3B0aW9ucztcbiAgICBpZiAoIWlzUG90ZW50aWFsQ3VzdG9tRWxlbWVudE5hbWUobmFtZSkpIHtcbiAgICAgIHRocm93IEVycm9yKFxuICAgICAgICBgXCIke25hbWV9XCIgaXMgbm90IGEgdmFsaWQgY3VzdG9tIGVsZW1lbnQgbmFtZS4gSXQgbXVzdCBiZSB0d28gd29yZHMgYW5kIGtlYmFiLWNhc2UsIHdpdGggYSBmZXcgZXhjZXB0aW9ucy4gU2VlIHNwZWMgZm9yIG1vcmUgZGV0YWlsczogaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2UvY3VzdG9tLWVsZW1lbnRzLmh0bWwjdmFsaWQtY3VzdG9tLWVsZW1lbnQtbmFtZWBcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IHBhcmVudEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KG5hbWUpO1xuICAgIGNvbnN0IHNoYWRvdyA9IHBhcmVudEVsZW1lbnQuYXR0YWNoU2hhZG93KHsgbW9kZSB9KTtcbiAgICBjb25zdCBpc29sYXRlZEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaHRtbFwiKTtcbiAgICBjb25zdCBib2R5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJvZHlcIik7XG4gICAgY29uc3QgaGVhZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJoZWFkXCIpO1xuICAgIGlmIChjc3MpIHtcbiAgICAgIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpO1xuICAgICAgaWYgKFwidXJsXCIgaW4gY3NzKSB7XG4gICAgICAgIHN0eWxlLnRleHRDb250ZW50ID0geWllbGQgZmV0Y2goY3NzLnVybCkudGhlbigocmVzKSA9PiByZXMudGV4dCgpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0eWxlLnRleHRDb250ZW50ID0gY3NzLnRleHRDb250ZW50O1xuICAgICAgfVxuICAgICAgaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7XG4gICAgfVxuICAgIGlzb2xhdGVkRWxlbWVudC5hcHBlbmRDaGlsZChoZWFkKTtcbiAgICBpc29sYXRlZEVsZW1lbnQuYXBwZW5kQ2hpbGQoYm9keSk7XG4gICAgc2hhZG93LmFwcGVuZENoaWxkKGlzb2xhdGVkRWxlbWVudCk7XG4gICAgaWYgKGlzb2xhdGVFdmVudHMpIHtcbiAgICAgIGNvbnN0IGV2ZW50VHlwZXMgPSBBcnJheS5pc0FycmF5KGlzb2xhdGVFdmVudHMpID8gaXNvbGF0ZUV2ZW50cyA6IFtcImtleWRvd25cIiwgXCJrZXl1cFwiLCBcImtleXByZXNzXCJdO1xuICAgICAgZXZlbnRUeXBlcy5mb3JFYWNoKChldmVudFR5cGUpID0+IHtcbiAgICAgICAgYm9keS5hZGRFdmVudExpc3RlbmVyKGV2ZW50VHlwZSwgKGUpID0+IGUuc3RvcFByb3BhZ2F0aW9uKCkpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBwYXJlbnRFbGVtZW50LFxuICAgICAgc2hhZG93LFxuICAgICAgaXNvbGF0ZWRFbGVtZW50OiBib2R5XG4gICAgfTtcbiAgfSk7XG59XG5leHBvcnQge1xuICBjcmVhdGVJc29sYXRlZEVsZW1lbnRcbn07XG4iLCJjb25zdCBudWxsS2V5ID0gU3ltYm9sKCdudWxsJyk7IC8vIGBvYmplY3RIYXNoZXNgIGtleSBmb3IgbnVsbFxuXG5sZXQga2V5Q291bnRlciA9IDA7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1hbnlLZXlzTWFwIGV4dGVuZHMgTWFwIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX29iamVjdEhhc2hlcyA9IG5ldyBXZWFrTWFwKCk7XG5cdFx0dGhpcy5fc3ltYm9sSGFzaGVzID0gbmV3IE1hcCgpOyAvLyBodHRwczovL2dpdGh1Yi5jb20vdGMzOS9lY21hMjYyL2lzc3Vlcy8xMTk0XG5cdFx0dGhpcy5fcHVibGljS2V5cyA9IG5ldyBNYXAoKTtcblxuXHRcdGNvbnN0IFtwYWlyc10gPSBhcmd1bWVudHM7IC8vIE1hcCBjb21wYXRcblx0XHRpZiAocGFpcnMgPT09IG51bGwgfHwgcGFpcnMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgcGFpcnNbU3ltYm9sLml0ZXJhdG9yXSAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcih0eXBlb2YgcGFpcnMgKyAnIGlzIG5vdCBpdGVyYWJsZSAoY2Fubm90IHJlYWQgcHJvcGVydHkgU3ltYm9sKFN5bWJvbC5pdGVyYXRvcikpJyk7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBba2V5cywgdmFsdWVdIG9mIHBhaXJzKSB7XG5cdFx0XHR0aGlzLnNldChrZXlzLCB2YWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0X2dldFB1YmxpY0tleXMoa2V5cywgY3JlYXRlID0gZmFsc2UpIHtcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoa2V5cykpIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBrZXlzIHBhcmFtZXRlciBtdXN0IGJlIGFuIGFycmF5Jyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJpdmF0ZUtleSA9IHRoaXMuX2dldFByaXZhdGVLZXkoa2V5cywgY3JlYXRlKTtcblxuXHRcdGxldCBwdWJsaWNLZXk7XG5cdFx0aWYgKHByaXZhdGVLZXkgJiYgdGhpcy5fcHVibGljS2V5cy5oYXMocHJpdmF0ZUtleSkpIHtcblx0XHRcdHB1YmxpY0tleSA9IHRoaXMuX3B1YmxpY0tleXMuZ2V0KHByaXZhdGVLZXkpO1xuXHRcdH0gZWxzZSBpZiAoY3JlYXRlKSB7XG5cdFx0XHRwdWJsaWNLZXkgPSBbLi4ua2V5c107IC8vIFJlZ2VuZXJhdGUga2V5cyBhcnJheSB0byBhdm9pZCBleHRlcm5hbCBpbnRlcmFjdGlvblxuXHRcdFx0dGhpcy5fcHVibGljS2V5cy5zZXQocHJpdmF0ZUtleSwgcHVibGljS2V5KTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge3ByaXZhdGVLZXksIHB1YmxpY0tleX07XG5cdH1cblxuXHRfZ2V0UHJpdmF0ZUtleShrZXlzLCBjcmVhdGUgPSBmYWxzZSkge1xuXHRcdGNvbnN0IHByaXZhdGVLZXlzID0gW107XG5cdFx0Zm9yIChsZXQga2V5IG9mIGtleXMpIHtcblx0XHRcdGlmIChrZXkgPT09IG51bGwpIHtcblx0XHRcdFx0a2V5ID0gbnVsbEtleTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaGFzaGVzID0gdHlwZW9mIGtleSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIGtleSA9PT0gJ2Z1bmN0aW9uJyA/ICdfb2JqZWN0SGFzaGVzJyA6ICh0eXBlb2Yga2V5ID09PSAnc3ltYm9sJyA/ICdfc3ltYm9sSGFzaGVzJyA6IGZhbHNlKTtcblxuXHRcdFx0aWYgKCFoYXNoZXMpIHtcblx0XHRcdFx0cHJpdmF0ZUtleXMucHVzaChrZXkpO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzW2hhc2hlc10uaGFzKGtleSkpIHtcblx0XHRcdFx0cHJpdmF0ZUtleXMucHVzaCh0aGlzW2hhc2hlc10uZ2V0KGtleSkpO1xuXHRcdFx0fSBlbHNlIGlmIChjcmVhdGUpIHtcblx0XHRcdFx0Y29uc3QgcHJpdmF0ZUtleSA9IGBAQG1rbS1yZWYtJHtrZXlDb3VudGVyKyt9QEBgO1xuXHRcdFx0XHR0aGlzW2hhc2hlc10uc2V0KGtleSwgcHJpdmF0ZUtleSk7XG5cdFx0XHRcdHByaXZhdGVLZXlzLnB1c2gocHJpdmF0ZUtleSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KHByaXZhdGVLZXlzKTtcblx0fVxuXG5cdHNldChrZXlzLCB2YWx1ZSkge1xuXHRcdGNvbnN0IHtwdWJsaWNLZXl9ID0gdGhpcy5fZ2V0UHVibGljS2V5cyhrZXlzLCB0cnVlKTtcblx0XHRyZXR1cm4gc3VwZXIuc2V0KHB1YmxpY0tleSwgdmFsdWUpO1xuXHR9XG5cblx0Z2V0KGtleXMpIHtcblx0XHRjb25zdCB7cHVibGljS2V5fSA9IHRoaXMuX2dldFB1YmxpY0tleXMoa2V5cyk7XG5cdFx0cmV0dXJuIHN1cGVyLmdldChwdWJsaWNLZXkpO1xuXHR9XG5cblx0aGFzKGtleXMpIHtcblx0XHRjb25zdCB7cHVibGljS2V5fSA9IHRoaXMuX2dldFB1YmxpY0tleXMoa2V5cyk7XG5cdFx0cmV0dXJuIHN1cGVyLmhhcyhwdWJsaWNLZXkpO1xuXHR9XG5cblx0ZGVsZXRlKGtleXMpIHtcblx0XHRjb25zdCB7cHVibGljS2V5LCBwcml2YXRlS2V5fSA9IHRoaXMuX2dldFB1YmxpY0tleXMoa2V5cyk7XG5cdFx0cmV0dXJuIEJvb2xlYW4ocHVibGljS2V5ICYmIHN1cGVyLmRlbGV0ZShwdWJsaWNLZXkpICYmIHRoaXMuX3B1YmxpY0tleXMuZGVsZXRlKHByaXZhdGVLZXkpKTtcblx0fVxuXG5cdGNsZWFyKCkge1xuXHRcdHN1cGVyLmNsZWFyKCk7XG5cdFx0dGhpcy5fc3ltYm9sSGFzaGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5fcHVibGljS2V5cy5jbGVhcigpO1xuXHR9XG5cblx0Z2V0IFtTeW1ib2wudG9TdHJpbmdUYWddKCkge1xuXHRcdHJldHVybiAnTWFueUtleXNNYXAnO1xuXHR9XG5cblx0Z2V0IHNpemUoKSB7XG5cdFx0cmV0dXJuIHN1cGVyLnNpemU7XG5cdH1cbn1cbiIsImZ1bmN0aW9uIGlzUGxhaW5PYmplY3QodmFsdWUpIHtcbiAgaWYgKHZhbHVlID09PSBudWxsIHx8IHR5cGVvZiB2YWx1ZSAhPT0gXCJvYmplY3RcIikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBwcm90b3R5cGUgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YodmFsdWUpO1xuICBpZiAocHJvdG90eXBlICE9PSBudWxsICYmIHByb3RvdHlwZSAhPT0gT2JqZWN0LnByb3RvdHlwZSAmJiBPYmplY3QuZ2V0UHJvdG90eXBlT2YocHJvdG90eXBlKSAhPT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoU3ltYm9sLml0ZXJhdG9yIGluIHZhbHVlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChTeW1ib2wudG9TdHJpbmdUYWcgaW4gdmFsdWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSA9PT0gXCJbb2JqZWN0IE1vZHVsZV1cIjtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gX2RlZnUoYmFzZU9iamVjdCwgZGVmYXVsdHMsIG5hbWVzcGFjZSA9IFwiLlwiLCBtZXJnZXIpIHtcbiAgaWYgKCFpc1BsYWluT2JqZWN0KGRlZmF1bHRzKSkge1xuICAgIHJldHVybiBfZGVmdShiYXNlT2JqZWN0LCB7fSwgbmFtZXNwYWNlLCBtZXJnZXIpO1xuICB9XG4gIGNvbnN0IG9iamVjdCA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRzKTtcbiAgZm9yIChjb25zdCBrZXkgaW4gYmFzZU9iamVjdCkge1xuICAgIGlmIChrZXkgPT09IFwiX19wcm90b19fXCIgfHwga2V5ID09PSBcImNvbnN0cnVjdG9yXCIpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZSA9IGJhc2VPYmplY3Rba2V5XTtcbiAgICBpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHZvaWQgMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChtZXJnZXIgJiYgbWVyZ2VyKG9iamVjdCwga2V5LCB2YWx1ZSwgbmFtZXNwYWNlKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSAmJiBBcnJheS5pc0FycmF5KG9iamVjdFtrZXldKSkge1xuICAgICAgb2JqZWN0W2tleV0gPSBbLi4udmFsdWUsIC4uLm9iamVjdFtrZXldXTtcbiAgICB9IGVsc2UgaWYgKGlzUGxhaW5PYmplY3QodmFsdWUpICYmIGlzUGxhaW5PYmplY3Qob2JqZWN0W2tleV0pKSB7XG4gICAgICBvYmplY3Rba2V5XSA9IF9kZWZ1KFxuICAgICAgICB2YWx1ZSxcbiAgICAgICAgb2JqZWN0W2tleV0sXG4gICAgICAgIChuYW1lc3BhY2UgPyBgJHtuYW1lc3BhY2V9LmAgOiBcIlwiKSArIGtleS50b1N0cmluZygpLFxuICAgICAgICBtZXJnZXJcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9iamVjdFtrZXldID0gdmFsdWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBvYmplY3Q7XG59XG5mdW5jdGlvbiBjcmVhdGVEZWZ1KG1lcmdlcikge1xuICByZXR1cm4gKC4uLmFyZ3VtZW50c18pID0+IChcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgdW5pY29ybi9uby1hcnJheS1yZWR1Y2VcbiAgICBhcmd1bWVudHNfLnJlZHVjZSgocCwgYykgPT4gX2RlZnUocCwgYywgXCJcIiwgbWVyZ2VyKSwge30pXG4gICk7XG59XG5jb25zdCBkZWZ1ID0gY3JlYXRlRGVmdSgpO1xuY29uc3QgZGVmdUZuID0gY3JlYXRlRGVmdSgob2JqZWN0LCBrZXksIGN1cnJlbnRWYWx1ZSkgPT4ge1xuICBpZiAob2JqZWN0W2tleV0gIT09IHZvaWQgMCAmJiB0eXBlb2YgY3VycmVudFZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBvYmplY3Rba2V5XSA9IGN1cnJlbnRWYWx1ZShvYmplY3Rba2V5XSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn0pO1xuY29uc3QgZGVmdUFycmF5Rm4gPSBjcmVhdGVEZWZ1KChvYmplY3QsIGtleSwgY3VycmVudFZhbHVlKSA9PiB7XG4gIGlmIChBcnJheS5pc0FycmF5KG9iamVjdFtrZXldKSAmJiB0eXBlb2YgY3VycmVudFZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBvYmplY3Rba2V5XSA9IGN1cnJlbnRWYWx1ZShvYmplY3Rba2V5XSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn0pO1xuXG5leHBvcnQgeyBjcmVhdGVEZWZ1LCBkZWZ1IGFzIGRlZmF1bHQsIGRlZnUsIGRlZnVBcnJheUZuLCBkZWZ1Rm4gfTtcbiIsImNvbnN0IGlzRXhpc3QgPSAoZWxlbWVudCkgPT4ge1xuICByZXR1cm4gZWxlbWVudCAhPT0gbnVsbCA/IHsgaXNEZXRlY3RlZDogdHJ1ZSwgcmVzdWx0OiBlbGVtZW50IH0gOiB7IGlzRGV0ZWN0ZWQ6IGZhbHNlIH07XG59O1xuY29uc3QgaXNOb3RFeGlzdCA9IChlbGVtZW50KSA9PiB7XG4gIHJldHVybiBlbGVtZW50ID09PSBudWxsID8geyBpc0RldGVjdGVkOiB0cnVlLCByZXN1bHQ6IG51bGwgfSA6IHsgaXNEZXRlY3RlZDogZmFsc2UgfTtcbn07XG5cbmV4cG9ydCB7IGlzRXhpc3QsIGlzTm90RXhpc3QgfTtcbiIsImltcG9ydCBNYW55S2V5c01hcCBmcm9tICdtYW55LWtleXMtbWFwJztcbmltcG9ydCB7IGRlZnUgfSBmcm9tICdkZWZ1JztcbmltcG9ydCB7IGlzRXhpc3QgfSBmcm9tICcuL2RldGVjdG9ycy5tanMnO1xuXG5jb25zdCBnZXREZWZhdWx0T3B0aW9ucyA9ICgpID0+ICh7XG4gIHRhcmdldDogZ2xvYmFsVGhpcy5kb2N1bWVudCxcbiAgdW5pZnlQcm9jZXNzOiB0cnVlLFxuICBkZXRlY3RvcjogaXNFeGlzdCxcbiAgb2JzZXJ2ZUNvbmZpZ3M6IHtcbiAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgc3VidHJlZTogdHJ1ZSxcbiAgICBhdHRyaWJ1dGVzOiB0cnVlXG4gIH0sXG4gIHNpZ25hbDogdm9pZCAwLFxuICBjdXN0b21NYXRjaGVyOiB2b2lkIDBcbn0pO1xuY29uc3QgbWVyZ2VPcHRpb25zID0gKHVzZXJTaWRlT3B0aW9ucywgZGVmYXVsdE9wdGlvbnMpID0+IHtcbiAgcmV0dXJuIGRlZnUodXNlclNpZGVPcHRpb25zLCBkZWZhdWx0T3B0aW9ucyk7XG59O1xuXG5jb25zdCB1bmlmeUNhY2hlID0gbmV3IE1hbnlLZXlzTWFwKCk7XG5mdW5jdGlvbiBjcmVhdGVXYWl0RWxlbWVudChpbnN0YW5jZU9wdGlvbnMpIHtcbiAgY29uc3QgeyBkZWZhdWx0T3B0aW9ucyB9ID0gaW5zdGFuY2VPcHRpb25zO1xuICByZXR1cm4gKHNlbGVjdG9yLCBvcHRpb25zKSA9PiB7XG4gICAgY29uc3Qge1xuICAgICAgdGFyZ2V0LFxuICAgICAgdW5pZnlQcm9jZXNzLFxuICAgICAgb2JzZXJ2ZUNvbmZpZ3MsXG4gICAgICBkZXRlY3RvcixcbiAgICAgIHNpZ25hbCxcbiAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICB9ID0gbWVyZ2VPcHRpb25zKG9wdGlvbnMsIGRlZmF1bHRPcHRpb25zKTtcbiAgICBjb25zdCB1bmlmeVByb21pc2VLZXkgPSBbXG4gICAgICBzZWxlY3RvcixcbiAgICAgIHRhcmdldCxcbiAgICAgIHVuaWZ5UHJvY2VzcyxcbiAgICAgIG9ic2VydmVDb25maWdzLFxuICAgICAgZGV0ZWN0b3IsXG4gICAgICBzaWduYWwsXG4gICAgICBjdXN0b21NYXRjaGVyXG4gICAgXTtcbiAgICBjb25zdCBjYWNoZWRQcm9taXNlID0gdW5pZnlDYWNoZS5nZXQodW5pZnlQcm9taXNlS2V5KTtcbiAgICBpZiAodW5pZnlQcm9jZXNzICYmIGNhY2hlZFByb21pc2UpIHtcbiAgICAgIHJldHVybiBjYWNoZWRQcm9taXNlO1xuICAgIH1cbiAgICBjb25zdCBkZXRlY3RQcm9taXNlID0gbmV3IFByb21pc2UoXG4gICAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQXN5bmNQcm9taXNlRXhlY3V0b3I6IGF2b2lkIG5lc3RpbmcgcHJvbWlzZVxuICAgICAgYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAoc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChzaWduYWwucmVhc29uKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKFxuICAgICAgICAgIGFzeW5jIChtdXRhdGlvbnMpID0+IHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgXyBvZiBtdXRhdGlvbnMpIHtcbiAgICAgICAgICAgICAgaWYgKHNpZ25hbD8uYWJvcnRlZCkge1xuICAgICAgICAgICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb25zdCBkZXRlY3RSZXN1bHQyID0gYXdhaXQgZGV0ZWN0RWxlbWVudCh7XG4gICAgICAgICAgICAgICAgc2VsZWN0b3IsXG4gICAgICAgICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgICAgICAgIGRldGVjdG9yLFxuICAgICAgICAgICAgICAgIGN1c3RvbU1hdGNoZXJcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGlmIChkZXRlY3RSZXN1bHQyLmlzRGV0ZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShkZXRlY3RSZXN1bHQyLnJlc3VsdCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICAgIHNpZ25hbD8uYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICBcImFib3J0XCIsXG4gICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChzaWduYWwucmVhc29uKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHsgb25jZTogdHJ1ZSB9XG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IGRldGVjdFJlc3VsdCA9IGF3YWl0IGRldGVjdEVsZW1lbnQoe1xuICAgICAgICAgIHNlbGVjdG9yLFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICBkZXRlY3RvcixcbiAgICAgICAgICBjdXN0b21NYXRjaGVyXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoZGV0ZWN0UmVzdWx0LmlzRGV0ZWN0ZWQpIHtcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZShkZXRlY3RSZXN1bHQucmVzdWx0KTtcbiAgICAgICAgfVxuICAgICAgICBvYnNlcnZlci5vYnNlcnZlKHRhcmdldCwgb2JzZXJ2ZUNvbmZpZ3MpO1xuICAgICAgfVxuICAgICkuZmluYWxseSgoKSA9PiB7XG4gICAgICB1bmlmeUNhY2hlLmRlbGV0ZSh1bmlmeVByb21pc2VLZXkpO1xuICAgIH0pO1xuICAgIHVuaWZ5Q2FjaGUuc2V0KHVuaWZ5UHJvbWlzZUtleSwgZGV0ZWN0UHJvbWlzZSk7XG4gICAgcmV0dXJuIGRldGVjdFByb21pc2U7XG4gIH07XG59XG5hc3luYyBmdW5jdGlvbiBkZXRlY3RFbGVtZW50KHtcbiAgdGFyZ2V0LFxuICBzZWxlY3RvcixcbiAgZGV0ZWN0b3IsXG4gIGN1c3RvbU1hdGNoZXJcbn0pIHtcbiAgY29uc3QgZWxlbWVudCA9IGN1c3RvbU1hdGNoZXIgPyBjdXN0b21NYXRjaGVyKHNlbGVjdG9yKSA6IHRhcmdldC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgcmV0dXJuIGF3YWl0IGRldGVjdG9yKGVsZW1lbnQpO1xufVxuY29uc3Qgd2FpdEVsZW1lbnQgPSBjcmVhdGVXYWl0RWxlbWVudCh7XG4gIGRlZmF1bHRPcHRpb25zOiBnZXREZWZhdWx0T3B0aW9ucygpXG59KTtcblxuZXhwb3J0IHsgY3JlYXRlV2FpdEVsZW1lbnQsIGdldERlZmF1bHRPcHRpb25zLCB3YWl0RWxlbWVudCB9O1xuIiwiZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG4gIGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcbiAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGFyZ3Muc2hpZnQoKTtcbiAgICBtZXRob2QoYFt3eHRdICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcbiAgfSBlbHNlIHtcbiAgICBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbiAgfVxufVxuZXhwb3J0IGNvbnN0IGxvZ2dlciA9IHtcbiAgZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcbiAgbG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuICB3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcbiAgZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbiIsImltcG9ydCB7IHdhaXRFbGVtZW50IH0gZnJvbSBcIkAxbmF0c3Uvd2FpdC1lbGVtZW50XCI7XG5pbXBvcnQge1xuICBpc0V4aXN0IGFzIG1vdW50RGV0ZWN0b3IsXG4gIGlzTm90RXhpc3QgYXMgcmVtb3ZlRGV0ZWN0b3Jcbn0gZnJvbSBcIkAxbmF0c3Uvd2FpdC1lbGVtZW50L2RldGVjdG9yc1wiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBhcHBseVBvc2l0aW9uKHJvb3QsIHBvc2l0aW9uZWRFbGVtZW50LCBvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zLnBvc2l0aW9uID09PSBcImlubGluZVwiKSByZXR1cm47XG4gIGlmIChvcHRpb25zLnpJbmRleCAhPSBudWxsKSByb290LnN0eWxlLnpJbmRleCA9IFN0cmluZyhvcHRpb25zLnpJbmRleCk7XG4gIHJvb3Quc3R5bGUub3ZlcmZsb3cgPSBcInZpc2libGVcIjtcbiAgcm9vdC5zdHlsZS5wb3NpdGlvbiA9IFwicmVsYXRpdmVcIjtcbiAgcm9vdC5zdHlsZS53aWR0aCA9IFwiMFwiO1xuICByb290LnN0eWxlLmhlaWdodCA9IFwiMFwiO1xuICByb290LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gIGlmIChwb3NpdGlvbmVkRWxlbWVudCkge1xuICAgIGlmIChvcHRpb25zLnBvc2l0aW9uID09PSBcIm92ZXJsYXlcIikge1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImFic29sdXRlXCI7XG4gICAgICBpZiAob3B0aW9ucy5hbGlnbm1lbnQ/LnN0YXJ0c1dpdGgoXCJib3R0b20tXCIpKVxuICAgICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5ib3R0b20gPSBcIjBcIjtcbiAgICAgIGVsc2UgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUudG9wID0gXCIwXCI7XG4gICAgICBpZiAob3B0aW9ucy5hbGlnbm1lbnQ/LmVuZHNXaXRoKFwiLXJpZ2h0XCIpKVxuICAgICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMFwiO1xuICAgICAgZWxzZSBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5sZWZ0ID0gXCIwXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiO1xuICAgICAgcG9zaXRpb25lZEVsZW1lbnQuc3R5bGUudG9wID0gXCIwXCI7XG4gICAgICBwb3NpdGlvbmVkRWxlbWVudC5zdHlsZS5ib3R0b20gPSBcIjBcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLmxlZnQgPSBcIjBcIjtcbiAgICAgIHBvc2l0aW9uZWRFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIwXCI7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0QW5jaG9yKG9wdGlvbnMpIHtcbiAgaWYgKG9wdGlvbnMuYW5jaG9yID09IG51bGwpIHJldHVybiBkb2N1bWVudC5ib2R5O1xuICBsZXQgcmVzb2x2ZWQgPSB0eXBlb2Ygb3B0aW9ucy5hbmNob3IgPT09IFwiZnVuY3Rpb25cIiA/IG9wdGlvbnMuYW5jaG9yKCkgOiBvcHRpb25zLmFuY2hvcjtcbiAgaWYgKHR5cGVvZiByZXNvbHZlZCA9PT0gXCJzdHJpbmdcIikge1xuICAgIGlmIChyZXNvbHZlZC5zdGFydHNXaXRoKFwiL1wiKSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gZG9jdW1lbnQuZXZhbHVhdGUoXG4gICAgICAgIHJlc29sdmVkLFxuICAgICAgICBkb2N1bWVudCxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgWFBhdGhSZXN1bHQuRklSU1RfT1JERVJFRF9OT0RFX1RZUEUsXG4gICAgICAgIG51bGxcbiAgICAgICk7XG4gICAgICByZXR1cm4gcmVzdWx0LnNpbmdsZU5vZGVWYWx1ZSA/PyB2b2lkIDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHJlc29sdmVkKSA/PyB2b2lkIDA7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXNvbHZlZCA/PyB2b2lkIDA7XG59XG5leHBvcnQgZnVuY3Rpb24gbW91bnRVaShyb290LCBvcHRpb25zKSB7XG4gIGNvbnN0IGFuY2hvciA9IGdldEFuY2hvcihvcHRpb25zKTtcbiAgaWYgKGFuY2hvciA9PSBudWxsKVxuICAgIHRocm93IEVycm9yKFxuICAgICAgXCJGYWlsZWQgdG8gbW91bnQgY29udGVudCBzY3JpcHQgVUk6IGNvdWxkIG5vdCBmaW5kIGFuY2hvciBlbGVtZW50XCJcbiAgICApO1xuICBzd2l0Y2ggKG9wdGlvbnMuYXBwZW5kKSB7XG4gICAgY2FzZSB2b2lkIDA6XG4gICAgY2FzZSBcImxhc3RcIjpcbiAgICAgIGFuY2hvci5hcHBlbmQocm9vdCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiZmlyc3RcIjpcbiAgICAgIGFuY2hvci5wcmVwZW5kKHJvb3QpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcInJlcGxhY2VcIjpcbiAgICAgIGFuY2hvci5yZXBsYWNlV2l0aChyb290KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJhZnRlclwiOlxuICAgICAgYW5jaG9yLnBhcmVudEVsZW1lbnQ/Lmluc2VydEJlZm9yZShyb290LCBhbmNob3IubmV4dEVsZW1lbnRTaWJsaW5nKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJiZWZvcmVcIjpcbiAgICAgIGFuY2hvci5wYXJlbnRFbGVtZW50Py5pbnNlcnRCZWZvcmUocm9vdCwgYW5jaG9yKTtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICBvcHRpb25zLmFwcGVuZChhbmNob3IsIHJvb3QpO1xuICAgICAgYnJlYWs7XG4gIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNb3VudEZ1bmN0aW9ucyhiYXNlRnVuY3Rpb25zLCBvcHRpb25zKSB7XG4gIGxldCBhdXRvTW91bnRJbnN0YW5jZSA9IHZvaWQgMDtcbiAgY29uc3Qgc3RvcEF1dG9Nb3VudCA9ICgpID0+IHtcbiAgICBhdXRvTW91bnRJbnN0YW5jZT8uc3RvcEF1dG9Nb3VudCgpO1xuICAgIGF1dG9Nb3VudEluc3RhbmNlID0gdm9pZCAwO1xuICB9O1xuICBjb25zdCBtb3VudCA9ICgpID0+IHtcbiAgICBiYXNlRnVuY3Rpb25zLm1vdW50KCk7XG4gIH07XG4gIGNvbnN0IHVubW91bnQgPSBiYXNlRnVuY3Rpb25zLnJlbW92ZTtcbiAgY29uc3QgcmVtb3ZlID0gKCkgPT4ge1xuICAgIHN0b3BBdXRvTW91bnQoKTtcbiAgICBiYXNlRnVuY3Rpb25zLnJlbW92ZSgpO1xuICB9O1xuICBjb25zdCBhdXRvTW91bnQgPSAoYXV0b01vdW50T3B0aW9ucykgPT4ge1xuICAgIGlmIChhdXRvTW91bnRJbnN0YW5jZSkge1xuICAgICAgbG9nZ2VyLndhcm4oXCJhdXRvTW91bnQgaXMgYWxyZWFkeSBzZXQuXCIpO1xuICAgIH1cbiAgICBhdXRvTW91bnRJbnN0YW5jZSA9IGF1dG9Nb3VudFVpKFxuICAgICAgeyBtb3VudCwgdW5tb3VudCwgc3RvcEF1dG9Nb3VudCB9LFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAuLi5hdXRvTW91bnRPcHRpb25zXG4gICAgICB9XG4gICAgKTtcbiAgfTtcbiAgcmV0dXJuIHtcbiAgICBtb3VudCxcbiAgICByZW1vdmUsXG4gICAgYXV0b01vdW50XG4gIH07XG59XG5mdW5jdGlvbiBhdXRvTW91bnRVaSh1aUNhbGxiYWNrcywgb3B0aW9ucykge1xuICBjb25zdCBhYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gIGNvbnN0IEVYUExJQ0lUX1NUT1BfUkVBU09OID0gXCJleHBsaWNpdF9zdG9wX2F1dG9fbW91bnRcIjtcbiAgY29uc3QgX3N0b3BBdXRvTW91bnQgPSAoKSA9PiB7XG4gICAgYWJvcnRDb250cm9sbGVyLmFib3J0KEVYUExJQ0lUX1NUT1BfUkVBU09OKTtcbiAgICBvcHRpb25zLm9uU3RvcD8uKCk7XG4gIH07XG4gIGxldCByZXNvbHZlZEFuY2hvciA9IHR5cGVvZiBvcHRpb25zLmFuY2hvciA9PT0gXCJmdW5jdGlvblwiID8gb3B0aW9ucy5hbmNob3IoKSA6IG9wdGlvbnMuYW5jaG9yO1xuICBpZiAocmVzb2x2ZWRBbmNob3IgaW5zdGFuY2VvZiBFbGVtZW50KSB7XG4gICAgdGhyb3cgRXJyb3IoXG4gICAgICBcImF1dG9Nb3VudCBhbmQgRWxlbWVudCBhbmNob3Igb3B0aW9uIGNhbm5vdCBiZSBjb21iaW5lZC4gQXZvaWQgcGFzc2luZyBgRWxlbWVudGAgZGlyZWN0bHkgb3IgYCgpID0+IEVsZW1lbnRgIHRvIHRoZSBhbmNob3IuXCJcbiAgICApO1xuICB9XG4gIGFzeW5jIGZ1bmN0aW9uIG9ic2VydmVFbGVtZW50KHNlbGVjdG9yKSB7XG4gICAgbGV0IGlzQW5jaG9yRXhpc3QgPSAhIWdldEFuY2hvcihvcHRpb25zKTtcbiAgICBpZiAoaXNBbmNob3JFeGlzdCkge1xuICAgICAgdWlDYWxsYmFja3MubW91bnQoKTtcbiAgICB9XG4gICAgd2hpbGUgKCFhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNoYW5nZWRBbmNob3IgPSBhd2FpdCB3YWl0RWxlbWVudChzZWxlY3RvciA/PyBcImJvZHlcIiwge1xuICAgICAgICAgIGN1c3RvbU1hdGNoZXI6ICgpID0+IGdldEFuY2hvcihvcHRpb25zKSA/PyBudWxsLFxuICAgICAgICAgIGRldGVjdG9yOiBpc0FuY2hvckV4aXN0ID8gcmVtb3ZlRGV0ZWN0b3IgOiBtb3VudERldGVjdG9yLFxuICAgICAgICAgIHNpZ25hbDogYWJvcnRDb250cm9sbGVyLnNpZ25hbFxuICAgICAgICB9KTtcbiAgICAgICAgaXNBbmNob3JFeGlzdCA9ICEhY2hhbmdlZEFuY2hvcjtcbiAgICAgICAgaWYgKGlzQW5jaG9yRXhpc3QpIHtcbiAgICAgICAgICB1aUNhbGxiYWNrcy5tb3VudCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHVpQ2FsbGJhY2tzLnVubW91bnQoKTtcbiAgICAgICAgICBpZiAob3B0aW9ucy5vbmNlKSB7XG4gICAgICAgICAgICB1aUNhbGxiYWNrcy5zdG9wQXV0b01vdW50KCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkICYmIGFib3J0Q29udHJvbGxlci5zaWduYWwucmVhc29uID09PSBFWFBMSUNJVF9TVE9QX1JFQVNPTikge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIG9ic2VydmVFbGVtZW50KHJlc29sdmVkQW5jaG9yKTtcbiAgcmV0dXJuIHsgc3RvcEF1dG9Nb3VudDogX3N0b3BBdXRvTW91bnQgfTtcbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBzcGxpdFNoYWRvd1Jvb3RDc3MoY3NzKSB7XG4gIGxldCBzaGFkb3dDc3MgPSBjc3M7XG4gIGxldCBkb2N1bWVudENzcyA9IFwiXCI7XG4gIGNvbnN0IHJ1bGVzUmVnZXggPSAvKFxccypAKHByb3BlcnR5fGZvbnQtZmFjZSlbXFxzXFxTXSo/e1tcXHNcXFNdKj99KS9nbTtcbiAgbGV0IG1hdGNoO1xuICB3aGlsZSAoKG1hdGNoID0gcnVsZXNSZWdleC5leGVjKGNzcykpICE9PSBudWxsKSB7XG4gICAgZG9jdW1lbnRDc3MgKz0gbWF0Y2hbMV07XG4gICAgc2hhZG93Q3NzID0gc2hhZG93Q3NzLnJlcGxhY2UobWF0Y2hbMV0sIFwiXCIpO1xuICB9XG4gIHJldHVybiB7XG4gICAgZG9jdW1lbnRDc3M6IGRvY3VtZW50Q3NzLnRyaW0oKSxcbiAgICBzaGFkb3dDc3M6IHNoYWRvd0Nzcy50cmltKClcbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGNyZWF0ZUlzb2xhdGVkRWxlbWVudCB9IGZyb20gXCJAd2ViZXh0LWNvcmUvaXNvbGF0ZWQtZWxlbWVudFwiO1xuaW1wb3J0IHsgYXBwbHlQb3NpdGlvbiwgY3JlYXRlTW91bnRGdW5jdGlvbnMsIG1vdW50VWkgfSBmcm9tIFwiLi9zaGFyZWQubWpzXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHsgc3BsaXRTaGFkb3dSb290Q3NzIH0gZnJvbSBcIi4uL3NwbGl0LXNoYWRvdy1yb290LWNzcy5tanNcIjtcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVTaGFkb3dSb290VWkoY3R4LCBvcHRpb25zKSB7XG4gIGNvbnN0IGluc3RhbmNlSWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoMiwgMTUpO1xuICBjb25zdCBjc3MgPSBbXTtcbiAgaWYgKCFvcHRpb25zLmluaGVyaXRTdHlsZXMpIHtcbiAgICBjc3MucHVzaChgLyogV1hUIFNoYWRvdyBSb290IFJlc2V0ICovIDpob3N0e2FsbDppbml0aWFsICFpbXBvcnRhbnQ7fWApO1xuICB9XG4gIGlmIChvcHRpb25zLmNzcykge1xuICAgIGNzcy5wdXNoKG9wdGlvbnMuY3NzKTtcbiAgfVxuICBpZiAoY3R4Lm9wdGlvbnM/LmNzc0luamVjdGlvbk1vZGUgPT09IFwidWlcIikge1xuICAgIGNvbnN0IGVudHJ5Q3NzID0gYXdhaXQgbG9hZENzcygpO1xuICAgIGNzcy5wdXNoKGVudHJ5Q3NzLnJlcGxhY2VBbGwoXCI6cm9vdFwiLCBcIjpob3N0XCIpKTtcbiAgfVxuICBjb25zdCB7IHNoYWRvd0NzcywgZG9jdW1lbnRDc3MgfSA9IHNwbGl0U2hhZG93Um9vdENzcyhjc3Muam9pbihcIlxcblwiKS50cmltKCkpO1xuICBjb25zdCB7XG4gICAgaXNvbGF0ZWRFbGVtZW50OiB1aUNvbnRhaW5lcixcbiAgICBwYXJlbnRFbGVtZW50OiBzaGFkb3dIb3N0LFxuICAgIHNoYWRvd1xuICB9ID0gYXdhaXQgY3JlYXRlSXNvbGF0ZWRFbGVtZW50KHtcbiAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgY3NzOiB7XG4gICAgICB0ZXh0Q29udGVudDogc2hhZG93Q3NzXG4gICAgfSxcbiAgICBtb2RlOiBvcHRpb25zLm1vZGUgPz8gXCJvcGVuXCIsXG4gICAgaXNvbGF0ZUV2ZW50czogb3B0aW9ucy5pc29sYXRlRXZlbnRzXG4gIH0pO1xuICBzaGFkb3dIb3N0LnNldEF0dHJpYnV0ZShcImRhdGEtd3h0LXNoYWRvdy1yb290XCIsIFwiXCIpO1xuICBsZXQgbW91bnRlZDtcbiAgY29uc3QgbW91bnQgPSAoKSA9PiB7XG4gICAgbW91bnRVaShzaGFkb3dIb3N0LCBvcHRpb25zKTtcbiAgICBhcHBseVBvc2l0aW9uKHNoYWRvd0hvc3QsIHNoYWRvdy5xdWVyeVNlbGVjdG9yKFwiaHRtbFwiKSwgb3B0aW9ucyk7XG4gICAgaWYgKGRvY3VtZW50Q3NzICYmICFkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFxuICAgICAgYHN0eWxlW3d4dC1zaGFkb3ctcm9vdC1kb2N1bWVudC1zdHlsZXM9XCIke2luc3RhbmNlSWR9XCJdYFxuICAgICkpIHtcbiAgICAgIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpO1xuICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSBkb2N1bWVudENzcztcbiAgICAgIHN0eWxlLnNldEF0dHJpYnV0ZShcInd4dC1zaGFkb3ctcm9vdC1kb2N1bWVudC1zdHlsZXNcIiwgaW5zdGFuY2VJZCk7XG4gICAgICAoZG9jdW1lbnQuaGVhZCA/PyBkb2N1bWVudC5ib2R5KS5hcHBlbmQoc3R5bGUpO1xuICAgIH1cbiAgICBtb3VudGVkID0gb3B0aW9ucy5vbk1vdW50KHVpQ29udGFpbmVyLCBzaGFkb3csIHNoYWRvd0hvc3QpO1xuICB9O1xuICBjb25zdCByZW1vdmUgPSAoKSA9PiB7XG4gICAgb3B0aW9ucy5vblJlbW92ZT8uKG1vdW50ZWQpO1xuICAgIHNoYWRvd0hvc3QucmVtb3ZlKCk7XG4gICAgY29uc3QgZG9jdW1lbnRTdHlsZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXG4gICAgICBgc3R5bGVbd3h0LXNoYWRvdy1yb290LWRvY3VtZW50LXN0eWxlcz1cIiR7aW5zdGFuY2VJZH1cIl1gXG4gICAgKTtcbiAgICBkb2N1bWVudFN0eWxlPy5yZW1vdmUoKTtcbiAgICB3aGlsZSAodWlDb250YWluZXIubGFzdENoaWxkKVxuICAgICAgdWlDb250YWluZXIucmVtb3ZlQ2hpbGQodWlDb250YWluZXIubGFzdENoaWxkKTtcbiAgICBtb3VudGVkID0gdm9pZCAwO1xuICB9O1xuICBjb25zdCBtb3VudEZ1bmN0aW9ucyA9IGNyZWF0ZU1vdW50RnVuY3Rpb25zKFxuICAgIHtcbiAgICAgIG1vdW50LFxuICAgICAgcmVtb3ZlXG4gICAgfSxcbiAgICBvcHRpb25zXG4gICk7XG4gIGN0eC5vbkludmFsaWRhdGVkKHJlbW92ZSk7XG4gIHJldHVybiB7XG4gICAgc2hhZG93LFxuICAgIHNoYWRvd0hvc3QsXG4gICAgdWlDb250YWluZXIsXG4gICAgLi4ubW91bnRGdW5jdGlvbnMsXG4gICAgZ2V0IG1vdW50ZWQoKSB7XG4gICAgICByZXR1cm4gbW91bnRlZDtcbiAgICB9XG4gIH07XG59XG5hc3luYyBmdW5jdGlvbiBsb2FkQ3NzKCkge1xuICBjb25zdCB1cmwgPSBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKGAvY29udGVudC1zY3JpcHRzLyR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9LmNzc2ApO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCk7XG4gICAgcmV0dXJuIGF3YWl0IHJlcy50ZXh0KCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGxvZ2dlci53YXJuKFxuICAgICAgYEZhaWxlZCB0byBsb2FkIHN0eWxlcyBAICR7dXJsfS4gRGlkIHlvdSBmb3JnZXQgdG8gaW1wb3J0IHRoZSBzdHlsZXNoZWV0IGluIHlvdXIgZW50cnlwb2ludD9gLFxuICAgICAgZXJyXG4gICAgKTtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUNvbnRlbnRTY3JpcHQoZGVmaW5pdGlvbikge1xuICByZXR1cm4gZGVmaW5pdGlvbjtcbn1cbiIsImZ1bmN0aW9uIHIoZSl7dmFyIHQsZixuPVwiXCI7aWYoXCJzdHJpbmdcIj09dHlwZW9mIGV8fFwibnVtYmVyXCI9PXR5cGVvZiBlKW4rPWU7ZWxzZSBpZihcIm9iamVjdFwiPT10eXBlb2YgZSlpZihBcnJheS5pc0FycmF5KGUpKXt2YXIgbz1lLmxlbmd0aDtmb3IodD0wO3Q8bzt0KyspZVt0XSYmKGY9cihlW3RdKSkmJihuJiYobis9XCIgXCIpLG4rPWYpfWVsc2UgZm9yKGYgaW4gZSllW2ZdJiYobiYmKG4rPVwiIFwiKSxuKz1mKTtyZXR1cm4gbn1leHBvcnQgZnVuY3Rpb24gY2xzeCgpe2Zvcih2YXIgZSx0LGY9MCxuPVwiXCIsbz1hcmd1bWVudHMubGVuZ3RoO2Y8bztmKyspKGU9YXJndW1lbnRzW2ZdKSYmKHQ9cihlKSkmJihuJiYobis9XCIgXCIpLG4rPXQpO3JldHVybiBufWV4cG9ydCBkZWZhdWx0IGNsc3g7IiwiaW1wb3J0IHsgY2xzeCwgdHlwZSBDbGFzc1ZhbHVlIH0gZnJvbSAnY2xzeCdcblxuZXhwb3J0IGZ1bmN0aW9uIGNuKC4uLmlucHV0czogQ2xhc3NWYWx1ZVtdKSB7XG4gIHJldHVybiBjbHN4KGlucHV0cylcbn0iLCJpbXBvcnQgeyBTaG93LCBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCwgSlNYIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGVhZGVyUHJvcHMge1xuICB0aXRsZT86IHN0cmluZztcbiAgbG9nbz86IEpTWC5FbGVtZW50O1xuICBhY3Rpb25zPzogSlNYLkVsZW1lbnQ7XG4gIHZhcmlhbnQ/OiAnZGVmYXVsdCcgfCAnbWluaW1hbCcgfCAndHJhbnNwYXJlbnQnO1xuICBzdGlja3k/OiBib29sZWFuO1xuICBzaG93TWVudUJ1dHRvbj86IGJvb2xlYW47XG4gIG9uTWVudUNsaWNrPzogKCkgPT4gdm9pZDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBIZWFkZXI6IENvbXBvbmVudDxIZWFkZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2lzU2Nyb2xsZWQsIHNldElzU2Nyb2xsZWRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcblxuICAvLyBUcmFjayBzY3JvbGwgcG9zaXRpb24gZm9yIHN0aWNreSBoZWFkZXIgZWZmZWN0c1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgcHJvcHMuc3RpY2t5KSB7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsICgpID0+IHtcbiAgICAgIHNldElzU2Nyb2xsZWQod2luZG93LnNjcm9sbFkgPiAxMCk7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCB2YXJpYW50ID0gKCkgPT4gcHJvcHMudmFyaWFudCB8fCAnZGVmYXVsdCc7XG5cbiAgcmV0dXJuIChcbiAgICA8aGVhZGVyXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICd3LWZ1bGwgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMjAwJyxcbiAgICAgICAge1xuICAgICAgICAgIC8vIFZhcmlhbnRzXG4gICAgICAgICAgJ2JnLXN1cmZhY2UgYm9yZGVyLWIgYm9yZGVyLXN1YnRsZSc6IHZhcmlhbnQoKSA9PT0gJ2RlZmF1bHQnLFxuICAgICAgICAgICdiZy10cmFuc3BhcmVudCc6IHZhcmlhbnQoKSA9PT0gJ21pbmltYWwnIHx8IHZhcmlhbnQoKSA9PT0gJ3RyYW5zcGFyZW50JyxcbiAgICAgICAgICAnYmFja2Ryb3AtYmx1ci1tZCBiZy1zdXJmYWNlLzgwJzogdmFyaWFudCgpID09PSAndHJhbnNwYXJlbnQnICYmIGlzU2Nyb2xsZWQoKSxcbiAgICAgICAgICAvLyBTdGlja3kgYmVoYXZpb3JcbiAgICAgICAgICAnc3RpY2t5IHRvcC0wIHotNTAnOiBwcm9wcy5zdGlja3ksXG4gICAgICAgICAgJ3NoYWRvdy1sZyc6IHByb3BzLnN0aWNreSAmJiBpc1Njcm9sbGVkKCksXG4gICAgICAgIH0sXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIDxkaXYgY2xhc3M9XCJtYXgtdy1zY3JlZW4teGwgbXgtYXV0byBweC00IHNtOnB4LTYgbGc6cHgtOFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGgtMTZcIj5cbiAgICAgICAgICB7LyogTGVmdCBzZWN0aW9uICovfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtNFwiPlxuICAgICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuc2hvd01lbnVCdXR0b259PlxuICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25NZW51Q2xpY2t9XG4gICAgICAgICAgICAgICAgY2xhc3M9XCJwLTIgcm91bmRlZC1sZyBob3ZlcjpiZy1oaWdobGlnaHQgdHJhbnNpdGlvbi1jb2xvcnMgbGc6aGlkZGVuXCJcbiAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiTWVudVwiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8c3ZnIGNsYXNzPVwidy02IGgtNlwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiPlxuICAgICAgICAgICAgICAgICAgPHBhdGggc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIGQ9XCJNNCA2aDE2TTQgMTJoMTZNNCAxOGgxNlwiIC8+XG4gICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5sb2dvfSBmYWxsYmFjaz17XG4gICAgICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnRpdGxlfT5cbiAgICAgICAgICAgICAgICA8aDEgY2xhc3M9XCJ0ZXh0LXhsIGZvbnQtYm9sZCB0ZXh0LXByaW1hcnlcIj57cHJvcHMudGl0bGV9PC9oMT5cbiAgICAgICAgICAgICAgPC9TaG93PlxuICAgICAgICAgICAgfT5cbiAgICAgICAgICAgICAge3Byb3BzLmxvZ299XG4gICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICB7LyogUmlnaHQgc2VjdGlvbiAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5hY3Rpb25zfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICB7cHJvcHMuYWN0aW9uc31cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvU2hvdz5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2hlYWRlcj5cbiAgKTtcbn07IiwiaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcblxuZXhwb3J0IGludGVyZmFjZSBTY29yZVBhbmVsUHJvcHMge1xuICBzY29yZTogbnVtYmVyO1xuICByYW5rOiBudW1iZXI7XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgU2NvcmVQYW5lbDogQ29tcG9uZW50PFNjb3JlUGFuZWxQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPXtjbignZ3JpZCBncmlkLWNvbHMtWzFmcl8xZnJdIGdhcC0yIHAtNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7LyogU2NvcmUgQm94ICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2Ugcm91bmRlZC1sZyBwLTQgZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgbWluLWgtWzgwcHhdXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTJ4bCBmb250LW1vbm8gZm9udC1ib2xkIHRleHQtYWNjZW50LXByaW1hcnlcIj5cbiAgICAgICAgICB7cHJvcHMuc2NvcmV9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeSBtdC0xXCI+XG4gICAgICAgICAgU2NvcmVcbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIFxuICAgICAgey8qIFJhbmsgQm94ICovfVxuICAgICAgPGRpdiBjbGFzcz1cImJnLXN1cmZhY2Ugcm91bmRlZC1sZyBwLTQgZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgbWluLWgtWzgwcHhdXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTJ4bCBmb250LW1vbm8gZm9udC1ib2xkIHRleHQtYWNjZW50LXNlY29uZGFyeVwiPlxuICAgICAgICAgIHtwcm9wcy5yYW5rfVxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtc20gdGV4dC1zZWNvbmRhcnkgbXQtMVwiPlxuICAgICAgICAgIFJhbmtcbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgU2hvdywgY3JlYXRlU2lnbmFsIH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBjbiB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2NuJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9CdXR0b24nO1xuXG5leHBvcnQgdHlwZSBPbmJvYXJkaW5nU3RlcCA9ICdjb25uZWN0LXdhbGxldCcgfCAnZ2VuZXJhdGluZy10b2tlbicgfCAnY29tcGxldGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE9uYm9hcmRpbmdGbG93UHJvcHMge1xuICBzdGVwOiBPbmJvYXJkaW5nU3RlcDtcbiAgZXJyb3I/OiBzdHJpbmcgfCBudWxsO1xuICB3YWxsZXRBZGRyZXNzPzogc3RyaW5nIHwgbnVsbDtcbiAgdG9rZW4/OiBzdHJpbmcgfCBudWxsO1xuICBvbkNvbm5lY3RXYWxsZXQ6ICgpID0+IHZvaWQ7XG4gIG9uVXNlVGVzdE1vZGU6ICgpID0+IHZvaWQ7XG4gIG9uVXNlUHJpdmF0ZUtleTogKHByaXZhdGVLZXk6IHN0cmluZykgPT4gdm9pZDtcbiAgb25Db21wbGV0ZTogKCkgPT4gdm9pZDtcbiAgaXNDb25uZWN0aW5nPzogYm9vbGVhbjtcbiAgaXNHZW5lcmF0aW5nPzogYm9vbGVhbjtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBPbmJvYXJkaW5nRmxvdzogQ29tcG9uZW50PE9uYm9hcmRpbmdGbG93UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IFtzaG93VGVzdE9wdGlvbiwgc2V0U2hvd1Rlc3RPcHRpb25dID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3Nob3dQcml2YXRlS2V5SW5wdXQsIHNldFNob3dQcml2YXRlS2V5SW5wdXRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgY29uc3QgW3ByaXZhdGVLZXksIHNldFByaXZhdGVLZXldID0gY3JlYXRlU2lnbmFsKCcnKTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgJ21pbi1oLXNjcmVlbiBiZy1ncmFkaWVudC10by1iciBmcm9tLWdyYXktOTAwIHRvLWJsYWNrIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyJyxcbiAgICAgIHByb3BzLmNsYXNzXG4gICAgKX0+XG4gICAgICA8ZGl2IGNsYXNzPVwibWF4LXctMnhsIHctZnVsbCBwLTEyXCI+XG4gICAgICAgIHsvKiBMb2dvL0hlYWRlciAqL31cbiAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtY2VudGVyIG1iLTEyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtOHhsIG1iLTZcIj7wn46kPC9kaXY+XG4gICAgICAgICAgPGgxIGNsYXNzPVwidGV4dC02eGwgZm9udC1ib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgU2NhcmxldHQgS2FyYW9rZVxuICAgICAgICAgIDwvaDE+XG4gICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LXhsIHRleHQtZ3JheS00MDBcIj5cbiAgICAgICAgICAgIEFJLXBvd2VyZWQga2FyYW9rZSBmb3IgU291bmRDbG91ZFxuICAgICAgICAgIDwvcD5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgey8qIFByb2dyZXNzIERvdHMgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGp1c3RpZnktY2VudGVyIG1iLTEyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZ2FwLTNcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAndy0zIGgtMyByb3VuZGVkLWZ1bGwgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgICAgICAgcHJvcHMuc3RlcCA9PT0gJ2Nvbm5lY3Qtd2FsbGV0JyBcbiAgICAgICAgICAgICAgICA/ICdiZy1wdXJwbGUtNTAwIHctMTInIFxuICAgICAgICAgICAgICAgIDogcHJvcHMud2FsbGV0QWRkcmVzcyBcbiAgICAgICAgICAgICAgICAgID8gJ2JnLWdyZWVuLTUwMCcgXG4gICAgICAgICAgICAgICAgICA6ICdiZy1ncmF5LTYwMCdcbiAgICAgICAgICAgICl9IC8+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ3ctMyBoLTMgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCcsXG4gICAgICAgICAgICAgIHByb3BzLnN0ZXAgPT09ICdnZW5lcmF0aW5nLXRva2VuJyBcbiAgICAgICAgICAgICAgICA/ICdiZy1wdXJwbGUtNTAwIHctMTInIFxuICAgICAgICAgICAgICAgIDogcHJvcHMudG9rZW4gXG4gICAgICAgICAgICAgICAgICA/ICdiZy1ncmVlbi01MDAnIFxuICAgICAgICAgICAgICAgICAgOiAnYmctZ3JheS02MDAnXG4gICAgICAgICAgICApfSAvPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICd3LTMgaC0zIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICAgICAgICBwcm9wcy5zdGVwID09PSAnY29tcGxldGUnIFxuICAgICAgICAgICAgICAgID8gJ2JnLWdyZWVuLTUwMCB3LTEyJyBcbiAgICAgICAgICAgICAgICA6ICdiZy1ncmF5LTYwMCdcbiAgICAgICAgICAgICl9IC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHsvKiBFcnJvciBEaXNwbGF5ICovfVxuICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5lcnJvcn0+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm1iLTggcC02IGJnLXJlZC05MDAvMjAgYm9yZGVyIGJvcmRlci1yZWQtODAwIHJvdW5kZWQteGxcIj5cbiAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1yZWQtNDAwIHRleHQtY2VudGVyIHRleHQtbGdcIj57cHJvcHMuZXJyb3J9PC9wPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgey8qIENvbnRlbnQgKi99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJzcGFjZS15LTZcIj5cbiAgICAgICAgICB7LyogQ29ubmVjdCBXYWxsZXQgU3RlcCAqL31cbiAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy5zdGVwID09PSAnY29ubmVjdC13YWxsZXQnfT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LWNlbnRlciBzcGFjZS15LThcIj5cbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTR4bCBmb250LXNlbWlib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgICAgICAgQ29ubmVjdCBZb3VyIFdhbGxldFxuICAgICAgICAgICAgICAgIDwvaDI+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQtbGcgbWF4LXctbWQgbXgtYXV0b1wiPlxuICAgICAgICAgICAgICAgICAgQ29ubmVjdCB5b3VyIHdhbGxldCB0byBnZXQgc3RhcnRlZFxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNCBtYXgtdy1tZCBteC1hdXRvXCI+XG4gICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17cHJvcHMub25Db25uZWN0V2FsbGV0fVxuICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmlzQ29ubmVjdGluZ31cbiAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE2IHRleHQtbGdcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIHtwcm9wcy5pc0Nvbm5lY3RpbmcgPyAoXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInctNCBoLTQgYm9yZGVyLTIgYm9yZGVyLWN1cnJlbnQgYm9yZGVyLXItdHJhbnNwYXJlbnQgcm91bmRlZC1mdWxsIGFuaW1hdGUtc3BpblwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgQ29ubmVjdGluZy4uLlxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4+8J+mijwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICBDb25uZWN0IHdpdGggTWV0YU1hc2tcbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L0J1dHRvbj5cblxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49eyFzaG93VGVzdE9wdGlvbigpICYmICFzaG93UHJpdmF0ZUtleUlucHV0KCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggZ2FwLTQganVzdGlmeS1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dUZXN0T3B0aW9uKHRydWUpfVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIFVzZSBkZW1vIG1vZGVcbiAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidGV4dC1ncmF5LTYwMFwiPnw8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTaG93UHJpdmF0ZUtleUlucHV0KHRydWUpfVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIFVzZSBwcml2YXRlIGtleVxuICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvU2hvdz5cblxuICAgICAgICAgICAgICAgIDxTaG93IHdoZW49e3Nob3dUZXN0T3B0aW9uKCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB0LTYgc3BhY2UteS00XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib3JkZXItdCBib3JkZXItZ3JheS04MDAgcHQtNlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uVXNlVGVzdE1vZGV9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwic2Vjb25kYXJ5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0XCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICBDb250aW51ZSB3aXRoIERlbW8gTW9kZVxuICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dUZXN0T3B0aW9uKGZhbHNlKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzIG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIEJhY2tcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtzaG93UHJpdmF0ZUtleUlucHV0KCl9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInB0LTYgc3BhY2UteS00XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib3JkZXItdCBib3JkZXItZ3JheS04MDAgcHQtNlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cInBhc3N3b3JkXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtwcml2YXRlS2V5KCl9XG4gICAgICAgICAgICAgICAgICAgICAgICBvbklucHV0PXsoZSkgPT4gc2V0UHJpdmF0ZUtleShlLmN1cnJlbnRUYXJnZXQudmFsdWUpfVxuICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJFbnRlciBwcml2YXRlIGtleVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0IHB4LTQgYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLWxnIHRleHQtd2hpdGUgcGxhY2Vob2xkZXItZ3JheS01MDAgZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1wdXJwbGUtNTAwXCJcbiAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHByb3BzLm9uVXNlUHJpdmF0ZUtleShwcml2YXRlS2V5KCkpfVxuICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFwcml2YXRlS2V5KCkgfHwgcHJpdmF0ZUtleSgpLmxlbmd0aCAhPT0gNjR9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwic2Vjb25kYXJ5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJsZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCBoLTE0IG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIENvbm5lY3Qgd2l0aCBQcml2YXRlIEtleVxuICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd1ByaXZhdGVLZXlJbnB1dChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldFByaXZhdGVLZXkoJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1ncmF5LTUwMCBob3Zlcjp0ZXh0LWdyYXktMzAwIHRyYW5zaXRpb24tY29sb3JzIG10LTNcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIEJhY2tcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG5cbiAgICAgICAgICB7LyogR2VuZXJhdGluZyBUb2tlbiBTdGVwICovfVxuICAgICAgICAgIDxTaG93IHdoZW49e3Byb3BzLnN0ZXAgPT09ICdnZW5lcmF0aW5nLXRva2VuJ30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgc3BhY2UteS04XCI+XG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGgyIGNsYXNzPVwidGV4dC00eGwgZm9udC1zZW1pYm9sZCB0ZXh0LXdoaXRlIG1iLTRcIj5cbiAgICAgICAgICAgICAgICAgIFNldHRpbmcgVXAgWW91ciBBY2NvdW50XG4gICAgICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgICAgICA8U2hvdyB3aGVuPXtwcm9wcy53YWxsZXRBZGRyZXNzfT5cbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1ncmF5LTQwMCB0ZXh0LWxnIG1iLTNcIj5cbiAgICAgICAgICAgICAgICAgICAgQ29ubmVjdGVkIHdhbGxldDpcbiAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgIDxjb2RlIGNsYXNzPVwidGV4dC1sZyB0ZXh0LXB1cnBsZS00MDAgYmctZ3JheS04MDAgcHgtNCBweS0yIHJvdW5kZWQtbGcgZm9udC1tb25vIGlubGluZS1ibG9ja1wiPlxuICAgICAgICAgICAgICAgICAgICB7cHJvcHMud2FsbGV0QWRkcmVzcz8uc2xpY2UoMCwgNil9Li4ue3Byb3BzLndhbGxldEFkZHJlc3M/LnNsaWNlKC00KX1cbiAgICAgICAgICAgICAgICAgIDwvY29kZT5cbiAgICAgICAgICAgICAgICA8L1Nob3c+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJweS0xMlwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ3LTIwIGgtMjAgYm9yZGVyLTQgYm9yZGVyLXB1cnBsZS01MDAgYm9yZGVyLXQtdHJhbnNwYXJlbnQgcm91bmRlZC1mdWxsIGFuaW1hdGUtc3BpbiBteC1hdXRvXCIgLz5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0ZXh0LWdyYXktNDAwIHRleHQteGxcIj5cbiAgICAgICAgICAgICAgICB7cHJvcHMuaXNHZW5lcmF0aW5nIFxuICAgICAgICAgICAgICAgICAgPyAnR2VuZXJhdGluZyB5b3VyIGFjY2VzcyB0b2tlbi4uLicgXG4gICAgICAgICAgICAgICAgICA6ICdWZXJpZnlpbmcgeW91ciBhY2NvdW50Li4uJ31cbiAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9TaG93PlxuXG4gICAgICAgICAgey8qIENvbXBsZXRlIFN0ZXAgKi99XG4gICAgICAgICAgPFNob3cgd2hlbj17cHJvcHMuc3RlcCA9PT0gJ2NvbXBsZXRlJ30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1jZW50ZXIgc3BhY2UteS04XCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LTh4bCBtYi02XCI+8J+OiTwvZGl2PlxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8aDIgY2xhc3M9XCJ0ZXh0LTR4bCBmb250LXNlbWlib2xkIHRleHQtd2hpdGUgbWItNFwiPlxuICAgICAgICAgICAgICAgICAgWW91J3JlIEFsbCBTZXQhXG4gICAgICAgICAgICAgICAgPC9oMj5cbiAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS00MDAgdGV4dC14bCBtYXgtdy1tZCBteC1hdXRvIG1iLThcIj5cbiAgICAgICAgICAgICAgICAgIFlvdXIgYWNjb3VudCBpcyByZWFkeS4gVGltZSB0byBzaW5nIVxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1heC13LW1kIG14LWF1dG9cIj5cbiAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcm9wcy5vbkNvbXBsZXRlfVxuICAgICAgICAgICAgICAgICAgc2l6ZT1cImxnXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIGgtMTYgdGV4dC1sZ1wiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgU3RhcnQgU2luZ2luZyEg8J+agFxuICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8cCBjbGFzcz1cInRleHQtZ3JheS01MDAgbXQtNlwiPlxuICAgICAgICAgICAgICAgIExvb2sgZm9yIHRoZSBrYXJhb2tlIHdpZGdldCBvbiBhbnkgU291bmRDbG91ZCB0cmFja1xuICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L1Nob3c+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IEZvciwgY3JlYXRlRWZmZWN0LCBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEx5cmljTGluZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRleHQ6IHN0cmluZztcbiAgc3RhcnRUaW1lOiBudW1iZXI7XG4gIGR1cmF0aW9uOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTHlyaWNzRGlzcGxheVByb3BzIHtcbiAgbHlyaWNzOiBMeXJpY0xpbmVbXTtcbiAgY3VycmVudFRpbWU/OiBudW1iZXI7XG4gIGlzUGxheWluZz86IGJvb2xlYW47XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgTHlyaWNzRGlzcGxheTogQ29tcG9uZW50PEx5cmljc0Rpc3BsYXlQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgY29uc3QgW2N1cnJlbnRMaW5lSW5kZXgsIHNldEN1cnJlbnRMaW5lSW5kZXhdID0gY3JlYXRlU2lnbmFsKC0xKTtcbiAgbGV0IGNvbnRhaW5lclJlZjogSFRNTERpdkVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cbiAgLy8gRmluZCBjdXJyZW50IGxpbmUgYmFzZWQgb24gdGltZVxuICBjcmVhdGVFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghcHJvcHMuY3VycmVudFRpbWUpIHtcbiAgICAgIHNldEN1cnJlbnRMaW5lSW5kZXgoLTEpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRpbWUgPSBwcm9wcy5jdXJyZW50VGltZTtcbiAgICBjb25zdCBpbmRleCA9IHByb3BzLmx5cmljcy5maW5kSW5kZXgoKGxpbmUpID0+IHtcbiAgICAgIGNvbnN0IGVuZFRpbWUgPSBsaW5lLnN0YXJ0VGltZSArIGxpbmUuZHVyYXRpb247XG4gICAgICByZXR1cm4gdGltZSA+PSBsaW5lLnN0YXJ0VGltZSAmJiB0aW1lIDwgZW5kVGltZTtcbiAgICB9KTtcblxuICAgIHNldEN1cnJlbnRMaW5lSW5kZXgoaW5kZXgpO1xuICB9KTtcblxuICAvLyBBdXRvLXNjcm9sbCB0byBjdXJyZW50IGxpbmVcbiAgY3JlYXRlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBpbmRleCA9IGN1cnJlbnRMaW5lSW5kZXgoKTtcbiAgICBpZiAoaW5kZXggPT09IC0xIHx8ICFjb250YWluZXJSZWYgfHwgIXByb3BzLmlzUGxheWluZykgcmV0dXJuO1xuXG4gICAgY29uc3QgbGluZUVsZW1lbnRzID0gY29udGFpbmVyUmVmLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWxpbmUtaW5kZXhdJyk7XG4gICAgY29uc3QgY3VycmVudEVsZW1lbnQgPSBsaW5lRWxlbWVudHNbaW5kZXhdIGFzIEhUTUxFbGVtZW50O1xuXG4gICAgaWYgKGN1cnJlbnRFbGVtZW50KSB7XG4gICAgICBjb25zdCBjb250YWluZXJIZWlnaHQgPSBjb250YWluZXJSZWYuY2xpZW50SGVpZ2h0O1xuICAgICAgY29uc3QgbGluZVRvcCA9IGN1cnJlbnRFbGVtZW50Lm9mZnNldFRvcDtcbiAgICAgIGNvbnN0IGxpbmVIZWlnaHQgPSBjdXJyZW50RWxlbWVudC5vZmZzZXRIZWlnaHQ7XG5cbiAgICAgIC8vIENlbnRlciB0aGUgY3VycmVudCBsaW5lXG4gICAgICBjb25zdCBzY3JvbGxUb3AgPSBsaW5lVG9wIC0gY29udGFpbmVySGVpZ2h0IC8gMiArIGxpbmVIZWlnaHQgLyAyO1xuXG4gICAgICBjb250YWluZXJSZWYuc2Nyb2xsVG8oe1xuICAgICAgICB0b3A6IHNjcm9sbFRvcCxcbiAgICAgICAgYmVoYXZpb3I6ICdzbW9vdGgnLFxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gKFxuICAgIDxkaXZcbiAgICAgIHJlZj17Y29udGFpbmVyUmVmfVxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAnbHlyaWNzLWRpc3BsYXkgb3ZlcmZsb3cteS1hdXRvIHNjcm9sbC1zbW9vdGgnLFxuICAgICAgICAnaC1mdWxsIHB4LTYgcHktMTInLFxuICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgKX1cbiAgICA+XG4gICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS04XCI+XG4gICAgICAgIDxGb3IgZWFjaD17cHJvcHMubHlyaWNzfT5cbiAgICAgICAgICB7KGxpbmUsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgIGRhdGEtbGluZS1pbmRleD17aW5kZXgoKX1cbiAgICAgICAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICAgICAgICd0ZXh0LWNlbnRlciB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0zMDAnLFxuICAgICAgICAgICAgICAgICd0ZXh0LTJ4bCBsZWFkaW5nLXJlbGF4ZWQnLFxuICAgICAgICAgICAgICAgIGluZGV4KCkgPT09IGN1cnJlbnRMaW5lSW5kZXgoKVxuICAgICAgICAgICAgICAgICAgPyAndGV4dC1wcmltYXJ5IGZvbnQtc2VtaWJvbGQgc2NhbGUtMTEwJ1xuICAgICAgICAgICAgICAgICAgOiAndGV4dC1zZWNvbmRhcnkgb3BhY2l0eS02MCdcbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAge2xpbmUudGV4dH1cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvRm9yPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgS2FyYW9rZUhlYWRlclByb3BzIHtcbiAgc29uZ1RpdGxlOiBzdHJpbmc7XG4gIGFydGlzdDogc3RyaW5nO1xuICBvbkJhY2s/OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuY29uc3QgQ2hldnJvbkxlZnQgPSAoKSA9PiAoXG4gIDxzdmcgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIGNsYXNzPVwidy02IGgtNlwiPlxuICAgIDxwYXRoIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiIGQ9XCJNMTUgMTlsLTctNyA3LTdcIiAvPlxuICA8L3N2Zz5cbik7XG5cbmV4cG9ydCBjb25zdCBLYXJhb2tlSGVhZGVyOiBDb21wb25lbnQ8S2FyYW9rZUhlYWRlclByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdyZWxhdGl2ZSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLTQnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgey8qIEJhY2sgYnV0dG9uIC0gYWJzb2x1dGUgcG9zaXRpb25lZCAqL31cbiAgICAgIDxidXR0b25cbiAgICAgICAgb25DbGljaz17cHJvcHMub25CYWNrfVxuICAgICAgICBjbGFzcz1cImFic29sdXRlIGxlZnQtNCBwLTIgLW0tMiB0ZXh0LXNlY29uZGFyeSBob3Zlcjp0ZXh0LXByaW1hcnkgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICBhcmlhLWxhYmVsPVwiR28gYmFja1wiXG4gICAgICA+XG4gICAgICAgIDxDaGV2cm9uTGVmdCAvPlxuICAgICAgPC9idXR0b24+XG4gICAgICBcbiAgICAgIHsvKiBTb25nIGluZm8gLSBjZW50ZXJlZCAqL31cbiAgICAgIDxoMSBjbGFzcz1cInRleHQtYmFzZSBmb250LW1lZGl1bSB0ZXh0LXByaW1hcnkgdGV4dC1jZW50ZXIgcHgtMTIgdHJ1bmNhdGUgbWF4LXctZnVsbFwiPlxuICAgICAgICB7cHJvcHMuc29uZ1RpdGxlfSAtIHtwcm9wcy5hcnRpc3R9XG4gICAgICA8L2gxPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBGb3IgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIExlYWRlcmJvYXJkRW50cnkge1xuICByYW5rOiBudW1iZXI7XG4gIHVzZXJuYW1lOiBzdHJpbmc7XG4gIHNjb3JlOiBudW1iZXI7XG4gIGlzQ3VycmVudFVzZXI/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIExlYWRlcmJvYXJkUGFuZWxQcm9wcyB7XG4gIGVudHJpZXM6IExlYWRlcmJvYXJkRW50cnlbXTtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBMZWFkZXJib2FyZFBhbmVsOiBDb21wb25lbnQ8TGVhZGVyYm9hcmRQYW5lbFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9e2NuKCdmbGV4IGZsZXgtY29sIGdhcC0yIHAtNCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8Rm9yIGVhY2g9e3Byb3BzLmVudHJpZXN9PlxuICAgICAgICB7KGVudHJ5KSA9PiAoXG4gICAgICAgICAgPGRpdiBcbiAgICAgICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ2ZsZXggaXRlbXMtY2VudGVyIGdhcC0zIHB4LTMgcHktMiByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzJyxcbiAgICAgICAgICAgICAgZW50cnkuaXNDdXJyZW50VXNlciBcbiAgICAgICAgICAgICAgICA/ICdiZy1hY2NlbnQtcHJpbWFyeS8xMCBib3JkZXIgYm9yZGVyLWFjY2VudC1wcmltYXJ5LzIwJyBcbiAgICAgICAgICAgICAgICA6ICdiZy1zdXJmYWNlIGhvdmVyOmJnLXN1cmZhY2UtaG92ZXInXG4gICAgICAgICAgICApfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxzcGFuIFxuICAgICAgICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgICAgICAgJ3ctOCB0ZXh0LWNlbnRlciBmb250LW1vbm8gZm9udC1ib2xkJyxcbiAgICAgICAgICAgICAgICBlbnRyeS5yYW5rIDw9IDMgPyAndGV4dC1hY2NlbnQtcHJpbWFyeScgOiAndGV4dC1zZWNvbmRhcnknXG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgICN7ZW50cnkucmFua31cbiAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ2ZsZXgtMSB0cnVuY2F0ZScsXG4gICAgICAgICAgICAgIGVudHJ5LmlzQ3VycmVudFVzZXIgPyAndGV4dC1hY2NlbnQtcHJpbWFyeSBmb250LW1lZGl1bScgOiAndGV4dC1wcmltYXJ5J1xuICAgICAgICAgICAgKX0+XG4gICAgICAgICAgICAgIHtlbnRyeS51c2VybmFtZX1cbiAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzPXtjbihcbiAgICAgICAgICAgICAgJ2ZvbnQtbW9ubyBmb250LWJvbGQnLFxuICAgICAgICAgICAgICBlbnRyeS5pc0N1cnJlbnRVc2VyID8gJ3RleHQtYWNjZW50LXByaW1hcnknIDogJ3RleHQtcHJpbWFyeSdcbiAgICAgICAgICAgICl9PlxuICAgICAgICAgICAgICB7ZW50cnkuc2NvcmUudG9Mb2NhbGVTdHJpbmcoKX1cbiAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKX1cbiAgICAgIDwvRm9yPlxuICAgIDwvZGl2PlxuICApO1xufTsiLCJpbXBvcnQgeyBjcmVhdGVTaWduYWwgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgdHlwZSBQbGF5YmFja1NwZWVkID0gJzF4JyB8ICcwLjc1eCcgfCAnMC41eCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3BsaXRCdXR0b25Qcm9wcyB7XG4gIG9uU3RhcnQ/OiAoKSA9PiB2b2lkO1xuICBvblNwZWVkQ2hhbmdlPzogKHNwZWVkOiBQbGF5YmFja1NwZWVkKSA9PiB2b2lkO1xuICBkaXNhYmxlZD86IGJvb2xlYW47XG4gIGNsYXNzPzogc3RyaW5nO1xufVxuXG5jb25zdCBzcGVlZHM6IFBsYXliYWNrU3BlZWRbXSA9IFsnMXgnLCAnMC43NXgnLCAnMC41eCddO1xuXG5leHBvcnQgY29uc3QgU3BsaXRCdXR0b246IENvbXBvbmVudDxTcGxpdEJ1dHRvblByb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbY3VycmVudFNwZWVkSW5kZXgsIHNldEN1cnJlbnRTcGVlZEluZGV4XSA9IGNyZWF0ZVNpZ25hbCgwKTtcbiAgXG4gIGNvbnN0IGN1cnJlbnRTcGVlZCA9ICgpID0+IHNwZWVkc1tjdXJyZW50U3BlZWRJbmRleCgpXTtcbiAgXG4gIGNvbnN0IGN5Y2xlU3BlZWQgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgY29uc3QgbmV4dEluZGV4ID0gKGN1cnJlbnRTcGVlZEluZGV4KCkgKyAxKSAlIHNwZWVkcy5sZW5ndGg7XG4gICAgc2V0Q3VycmVudFNwZWVkSW5kZXgobmV4dEluZGV4KTtcbiAgICBjb25zdCBuZXdTcGVlZCA9IHNwZWVkc1tuZXh0SW5kZXhdO1xuICAgIGlmIChuZXdTcGVlZCkge1xuICAgICAgcHJvcHMub25TcGVlZENoYW5nZT8uKG5ld1NwZWVkKTtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IFxuICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAncmVsYXRpdmUgaW5saW5lLWZsZXggdy1mdWxsIHJvdW5kZWQtbGcgb3ZlcmZsb3ctaGlkZGVuJyxcbiAgICAgICAgJ2JnLWdyYWRpZW50LXByaW1hcnkgdGV4dC13aGl0ZSBzaGFkb3ctbGcnLFxuICAgICAgICAndHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwJyxcbiAgICAgICAgcHJvcHMuY2xhc3NcbiAgICAgICl9XG4gICAgPlxuICAgICAgey8qIE1haW4gYnV0dG9uICovfVxuICAgICAgPGJ1dHRvblxuICAgICAgICBvbkNsaWNrPXtwcm9wcy5vblN0YXJ0fVxuICAgICAgICBkaXNhYmxlZD17cHJvcHMuZGlzYWJsZWR9XG4gICAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgICAnZmxleC0xIGlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByZWxhdGl2ZSBvdmVyZmxvdy1oaWRkZW4nLFxuICAgICAgICAgICdoLTEyIHB4LTYgdGV4dC1sZyBmb250LW1lZGl1bScsXG4gICAgICAgICAgJ2N1cnNvci1wb2ludGVyIGJvcmRlci1ub25lIG91dGxpbmUtbm9uZScsXG4gICAgICAgICAgJ2Rpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAgICAnaG92ZXI6Ymctd2hpdGUvMTAgYWN0aXZlOmJnLXdoaXRlLzIwJ1xuICAgICAgICApfVxuICAgICAgPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInJlbGF0aXZlIHotMTBcIj5TdGFydDwvc3Bhbj5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgXG4gICAgICB7LyogRGl2aWRlciAqL31cbiAgICAgIDxkaXYgY2xhc3M9XCJ3LXB4IGJnLWJsYWNrLzIwXCIgLz5cbiAgICAgIFxuICAgICAgey8qIFNwZWVkIGJ1dHRvbiAqL31cbiAgICAgIDxidXR0b25cbiAgICAgICAgb25DbGljaz17Y3ljbGVTcGVlZH1cbiAgICAgICAgZGlzYWJsZWQ9e3Byb3BzLmRpc2FibGVkfVxuICAgICAgICBjbGFzcz17Y24oXG4gICAgICAgICAgJ2lubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByZWxhdGl2ZScsXG4gICAgICAgICAgJ3ctMjAgdGV4dC1sZyBmb250LW1lZGl1bScsXG4gICAgICAgICAgJ2N1cnNvci1wb2ludGVyIGJvcmRlci1ub25lIG91dGxpbmUtbm9uZScsXG4gICAgICAgICAgJ2Rpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTUwJyxcbiAgICAgICAgICAnaG92ZXI6Ymctd2hpdGUvMTAgYWN0aXZlOmJnLXdoaXRlLzIwJyxcbiAgICAgICAgICAnYWZ0ZXI6Y29udGVudC1bXCJcIl0gYWZ0ZXI6YWJzb2x1dGUgYWZ0ZXI6aW5zZXQtMCcsXG4gICAgICAgICAgJ2FmdGVyOmJnLWdyYWRpZW50LXRvLXIgYWZ0ZXI6ZnJvbS10cmFuc3BhcmVudCBhZnRlcjp2aWEtd2hpdGUvMjAgYWZ0ZXI6dG8tdHJhbnNwYXJlbnQnLFxuICAgICAgICAgICdhZnRlcjp0cmFuc2xhdGUteC1bLTIwMCVdIGhvdmVyOmFmdGVyOnRyYW5zbGF0ZS14LVsyMDAlXScsXG4gICAgICAgICAgJ2FmdGVyOnRyYW5zaXRpb24tdHJhbnNmb3JtIGFmdGVyOmR1cmF0aW9uLTcwMCdcbiAgICAgICAgKX1cbiAgICAgICAgYXJpYS1sYWJlbD1cIkNoYW5nZSBwbGF5YmFjayBzcGVlZFwiXG4gICAgICA+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwicmVsYXRpdmUgei0xMFwiPntjdXJyZW50U3BlZWQoKX08L3NwYW4+XG4gICAgICA8L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2lnbmFsLCBTaG93IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnQsIEpTWCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRhYiB7XG4gIGlkOiBzdHJpbmc7XG4gIGxhYmVsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFic1Byb3BzIHtcbiAgdGFiczogVGFiW107XG4gIGRlZmF1bHRUYWI/OiBzdHJpbmc7XG4gIG9uVGFiQ2hhbmdlPzogKHRhYklkOiBzdHJpbmcpID0+IHZvaWQ7XG4gIGNoaWxkcmVuOiBKU1guRWxlbWVudDtcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFic0xpc3RQcm9wcyB7XG4gIGNsYXNzPzogc3RyaW5nO1xuICBjaGlsZHJlbjogSlNYLkVsZW1lbnQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFic1RyaWdnZXJQcm9wcyB7XG4gIHZhbHVlOiBzdHJpbmc7XG4gIGNsYXNzPzogc3RyaW5nO1xuICBjaGlsZHJlbjogSlNYLkVsZW1lbnQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFic0NvbnRlbnRQcm9wcyB7XG4gIHZhbHVlOiBzdHJpbmc7XG4gIGNsYXNzPzogc3RyaW5nO1xuICBjaGlsZHJlbjogSlNYLkVsZW1lbnQ7XG59XG5cbi8vIEdsb2JhbCBzdGF0ZSBmb3IgdGhlIGN1cnJlbnQgdGFicyBpbnN0YW5jZVxubGV0IGN1cnJlbnRUYWJzU3RhdGU6IHtcbiAgYWN0aXZlVGFiOiAoKSA9PiBzdHJpbmc7XG4gIHNldEFjdGl2ZVRhYjogKGlkOiBzdHJpbmcpID0+IHZvaWQ7XG59IHwgbnVsbCA9IG51bGw7XG5cbmV4cG9ydCBjb25zdCBUYWJzOiBDb21wb25lbnQ8VGFic1Byb3BzPiA9IChwcm9wcykgPT4ge1xuICBjb25zdCBbYWN0aXZlVGFiLCBzZXRBY3RpdmVUYWJdID0gY3JlYXRlU2lnbmFsKHByb3BzLmRlZmF1bHRUYWIgfHwgcHJvcHMudGFic1swXT8uaWQgfHwgJycpO1xuICBcbiAgY29uc3QgaGFuZGxlVGFiQ2hhbmdlID0gKGlkOiBzdHJpbmcpID0+IHtcbiAgICBzZXRBY3RpdmVUYWIoaWQpO1xuICAgIHByb3BzLm9uVGFiQ2hhbmdlPy4oaWQpO1xuICB9O1xuXG4gIC8vIFNldCB0aGUgZ2xvYmFsIHN0YXRlIGZvciBjaGlsZCBjb21wb25lbnRzIHRvIGFjY2Vzc1xuICBjdXJyZW50VGFic1N0YXRlID0ge1xuICAgIGFjdGl2ZVRhYixcbiAgICBzZXRBY3RpdmVUYWI6IGhhbmRsZVRhYkNoYW5nZVxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ3ctZnVsbCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgPC9kaXY+XG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgVGFic0xpc3Q6IENvbXBvbmVudDxUYWJzTGlzdFByb3BzPiA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gKFxuICAgIDxkaXYgXG4gICAgICBjbGFzcz17Y24oXG4gICAgICAgICdpbmxpbmUtZmxleCBoLTEwIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLW1kIGJnLXN1cmZhY2UgcC0xIHRleHQtc2Vjb25kYXJ5JyxcbiAgICAgICAgJ3ctZnVsbCcsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICA8L2Rpdj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBUYWJzVHJpZ2dlcjogQ29tcG9uZW50PFRhYnNUcmlnZ2VyUHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IGlzQWN0aXZlID0gKCkgPT4gY3VycmVudFRhYnNTdGF0ZT8uYWN0aXZlVGFiKCkgPT09IHByb3BzLnZhbHVlO1xuXG4gIHJldHVybiAoXG4gICAgPGJ1dHRvblxuICAgICAgb25DbGljaz17KCkgPT4gY3VycmVudFRhYnNTdGF0ZT8uc2V0QWN0aXZlVGFiKHByb3BzLnZhbHVlKX1cbiAgICAgIGNsYXNzPXtjbihcbiAgICAgICAgJ2lubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB3aGl0ZXNwYWNlLW5vd3JhcCByb3VuZGVkLXNtIHB4LTMgcHktMS41JyxcbiAgICAgICAgJ3RleHQtc20gZm9udC1tZWRpdW0gcmluZy1vZmZzZXQtYmFzZSB0cmFuc2l0aW9uLWFsbCcsXG4gICAgICAgICdmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZSBmb2N1cy12aXNpYmxlOnJpbmctMiBmb2N1cy12aXNpYmxlOnJpbmctYWNjZW50LXByaW1hcnkgZm9jdXMtdmlzaWJsZTpyaW5nLW9mZnNldC0yJyxcbiAgICAgICAgJ2Rpc2FibGVkOnBvaW50ZXItZXZlbnRzLW5vbmUgZGlzYWJsZWQ6b3BhY2l0eS01MCcsXG4gICAgICAgICdmbGV4LTEnLFxuICAgICAgICBpc0FjdGl2ZSgpXG4gICAgICAgICAgPyAnYmctYmFzZSB0ZXh0LXByaW1hcnkgc2hhZG93LXNtJ1xuICAgICAgICAgIDogJ3RleHQtc2Vjb25kYXJ5IGhvdmVyOnRleHQtcHJpbWFyeScsXG4gICAgICAgIHByb3BzLmNsYXNzXG4gICAgICApfVxuICAgID5cbiAgICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgICA8L2J1dHRvbj5cbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBUYWJzQ29udGVudDogQ29tcG9uZW50PFRhYnNDb250ZW50UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPFNob3cgd2hlbj17Y3VycmVudFRhYnNTdGF0ZT8uYWN0aXZlVGFiKCkgPT09IHByb3BzLnZhbHVlfT5cbiAgICAgIDxkaXZcbiAgICAgICAgY2xhc3M9e2NuKFxuICAgICAgICAgICdtdC0yIHJpbmctb2Zmc2V0LWJhc2UnLFxuICAgICAgICAgICdmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZSBmb2N1cy12aXNpYmxlOnJpbmctMiBmb2N1cy12aXNpYmxlOnJpbmctYWNjZW50LXByaW1hcnkgZm9jdXMtdmlzaWJsZTpyaW5nLW9mZnNldC0yJyxcbiAgICAgICAgICBwcm9wcy5jbGFzc1xuICAgICAgICApfVxuICAgICAgPlxuICAgICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgICA8L2Rpdj5cbiAgICA8L1Nob3c+XG4gICk7XG59OyIsImltcG9ydCB0eXBlIHsgQ29tcG9uZW50IH0gZnJvbSAnc29saWQtanMnO1xuaW1wb3J0IHsgY24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9jbic7XG5pbXBvcnQgeyBTY29yZVBhbmVsIH0gZnJvbSAnLi4vLi4vZGlzcGxheS9TY29yZVBhbmVsJztcbmltcG9ydCB7IEx5cmljc0Rpc3BsYXksIHR5cGUgTHlyaWNMaW5lIH0gZnJvbSAnLi4vTHlyaWNzRGlzcGxheSc7XG5pbXBvcnQgeyBMZWFkZXJib2FyZFBhbmVsLCB0eXBlIExlYWRlcmJvYXJkRW50cnkgfSBmcm9tICcuLi9MZWFkZXJib2FyZFBhbmVsJztcbmltcG9ydCB7IFNwbGl0QnV0dG9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL1NwbGl0QnV0dG9uJztcbmltcG9ydCB0eXBlIHsgUGxheWJhY2tTcGVlZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9TcGxpdEJ1dHRvbic7XG5pbXBvcnQgeyBUYWJzLCBUYWJzTGlzdCwgVGFic1RyaWdnZXIsIFRhYnNDb250ZW50IH0gZnJvbSAnLi4vLi4vY29tbW9uL1RhYnMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4dGVuc2lvbkthcmFva2VWaWV3UHJvcHMge1xuICAvLyBTY29yZXNcbiAgc2NvcmU6IG51bWJlcjtcbiAgcmFuazogbnVtYmVyO1xuICBcbiAgLy8gTHlyaWNzXG4gIGx5cmljczogTHlyaWNMaW5lW107XG4gIGN1cnJlbnRUaW1lPzogbnVtYmVyO1xuICBcbiAgLy8gTGVhZGVyYm9hcmRcbiAgbGVhZGVyYm9hcmQ6IExlYWRlcmJvYXJkRW50cnlbXTtcbiAgXG4gIC8vIFN0YXRlXG4gIGlzUGxheWluZz86IGJvb2xlYW47XG4gIG9uU3RhcnQ/OiAoKSA9PiB2b2lkO1xuICBvblNwZWVkQ2hhbmdlPzogKHNwZWVkOiBQbGF5YmFja1NwZWVkKSA9PiB2b2lkO1xuICBcbiAgY2xhc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBFeHRlbnNpb25LYXJhb2tlVmlldzogQ29tcG9uZW50PEV4dGVuc2lvbkthcmFva2VWaWV3UHJvcHM+ID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17Y24oJ2ZsZXggZmxleC1jb2wgaC1mdWxsIGJnLWJhc2UnLCBwcm9wcy5jbGFzcyl9PlxuICAgICAgey8qIFNjb3JlIFBhbmVsICovfVxuICAgICAgPFNjb3JlUGFuZWxcbiAgICAgICAgc2NvcmU9e3Byb3BzLnNjb3JlfVxuICAgICAgICByYW5rPXtwcm9wcy5yYW5rfVxuICAgICAgLz5cblxuICAgICAgey8qIFRhYnMgYW5kIGNvbnRlbnQgKi99XG4gICAgICA8VGFicyBcbiAgICAgICAgdGFicz17W1xuICAgICAgICAgIHsgaWQ6ICdseXJpY3MnLCBsYWJlbDogJ0x5cmljcycgfSxcbiAgICAgICAgICB7IGlkOiAnbGVhZGVyYm9hcmQnLCBsYWJlbDogJ0xlYWRlcmJvYXJkJyB9XG4gICAgICAgIF19XG4gICAgICAgIGRlZmF1bHRUYWI9XCJseXJpY3NcIlxuICAgICAgICBjbGFzcz1cImZsZXgtMSBmbGV4IGZsZXgtY29sIG92ZXJmbG93LWhpZGRlblwiXG4gICAgICA+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJweC00XCI+XG4gICAgICAgICAgPFRhYnNMaXN0PlxuICAgICAgICAgICAgPFRhYnNUcmlnZ2VyIHZhbHVlPVwibHlyaWNzXCI+THlyaWNzPC9UYWJzVHJpZ2dlcj5cbiAgICAgICAgICAgIDxUYWJzVHJpZ2dlciB2YWx1ZT1cImxlYWRlcmJvYXJkXCI+TGVhZGVyYm9hcmQ8L1RhYnNUcmlnZ2VyPlxuICAgICAgICAgIDwvVGFic0xpc3Q+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICBcbiAgICAgICAgPFRhYnNDb250ZW50IHZhbHVlPVwibHlyaWNzXCIgY2xhc3M9XCJmbGV4LTEgZmxleCBmbGV4LWNvbCBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleC0xIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgICAgPEx5cmljc0Rpc3BsYXlcbiAgICAgICAgICAgICAgbHlyaWNzPXtwcm9wcy5seXJpY3N9XG4gICAgICAgICAgICAgIGN1cnJlbnRUaW1lPXtwcm9wcy5jdXJyZW50VGltZX1cbiAgICAgICAgICAgICAgaXNQbGF5aW5nPXtwcm9wcy5pc1BsYXlpbmd9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIFxuICAgICAgICAgIHsvKiBGb290ZXIgd2l0aCBzdGFydCBidXR0b24gKi99XG4gICAgICAgICAgeyFwcm9wcy5pc1BsYXlpbmcgJiYgcHJvcHMub25TdGFydCAmJiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwicC00IGJnLXN1cmZhY2UgYm9yZGVyLXQgYm9yZGVyLXN1YnRsZVwiPlxuICAgICAgICAgICAgICA8U3BsaXRCdXR0b25cbiAgICAgICAgICAgICAgICBvblN0YXJ0PXtwcm9wcy5vblN0YXJ0fVxuICAgICAgICAgICAgICAgIG9uU3BlZWRDaGFuZ2U9e3Byb3BzLm9uU3BlZWRDaGFuZ2V9XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApfVxuICAgICAgICA8L1RhYnNDb250ZW50PlxuICAgICAgICBcbiAgICAgICAgPFRhYnNDb250ZW50IHZhbHVlPVwibGVhZGVyYm9hcmRcIiBjbGFzcz1cImZsZXgtMSBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwib3ZlcmZsb3cteS1hdXRvIGgtZnVsbFwiPlxuICAgICAgICAgICAgPExlYWRlcmJvYXJkUGFuZWwgZW50cmllcz17cHJvcHMubGVhZGVyYm9hcmR9IC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvVGFic0NvbnRlbnQ+XG4gICAgICA8L1RhYnM+XG4gICAgPC9kaXY+XG4gICk7XG59OyIsImltcG9ydCB7IFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudCB9IGZyb20gJ3NvbGlkLWpzJztcbmltcG9ydCBJY29uWFJlZ3VsYXIgZnJvbSAncGhvc3Bob3ItaWNvbnMtc29saWQvSWNvblhSZWd1bGFyJztcbmltcG9ydCB7IGNuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByYWN0aWNlSGVhZGVyUHJvcHMge1xuICB0aXRsZT86IHN0cmluZztcbiAgb25FeGl0OiAoKSA9PiB2b2lkO1xuICBjbGFzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFByYWN0aWNlSGVhZGVyOiBDb21wb25lbnQ8UHJhY3RpY2VIZWFkZXJQcm9wcz4gPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8aGVhZGVyIGNsYXNzPXtjbignZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGgtMTQgcHgtNCBiZy10cmFuc3BhcmVudCcsIHByb3BzLmNsYXNzKX0+XG4gICAgICA8YnV0dG9uXG4gICAgICAgIG9uQ2xpY2s9e3Byb3BzLm9uRXhpdH1cbiAgICAgICAgY2xhc3M9XCJwLTIgLW1sLTIgcm91bmRlZC1mdWxsIGhvdmVyOmJnLWhpZ2hsaWdodCB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgIGFyaWEtbGFiZWw9XCJFeGl0IHByYWN0aWNlXCJcbiAgICAgID5cbiAgICAgICAgPEljb25YUmVndWxhciBjbGFzcz1cInRleHQtc2Vjb25kYXJ5IHctNiBoLTZcIiAvPlxuICAgICAgPC9idXR0b24+XG4gICAgICBcbiAgICAgIDxTaG93IHdoZW49e3Byb3BzLnRpdGxlfT5cbiAgICAgICAgPGgxIGNsYXNzPVwidGV4dC1sZyBmb250LXNlbWlib2xkIHRleHQtcHJpbWFyeSBhYnNvbHV0ZSBsZWZ0LTEvMiB0cmFuc2Zvcm0gLXRyYW5zbGF0ZS14LTEvMlwiPlxuICAgICAgICAgIHtwcm9wcy50aXRsZX1cbiAgICAgICAgPC9oMT5cbiAgICAgIDwvU2hvdz5cbiAgICAgIFxuICAgICAgey8qIFNwYWNlciB0byBiYWxhbmNlIHRoZSBsYXlvdXQgKi99XG4gICAgICA8ZGl2IGNsYXNzPVwidy0xMFwiIC8+XG4gICAgPC9oZWFkZXI+XG4gICk7XG59OyIsImV4cG9ydCBpbnRlcmZhY2UgVHJhY2tJbmZvIHtcbiAgdHJhY2tJZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBhcnRpc3Q6IHN0cmluZztcbiAgcGxhdGZvcm06ICdzb3VuZGNsb3VkJztcbiAgdXJsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFja0RldGVjdG9yIHtcbiAgLyoqXG4gICAqIERldGVjdCBjdXJyZW50IHRyYWNrIGZyb20gdGhlIHBhZ2UgKFNvdW5kQ2xvdWQgb25seSlcbiAgICovXG4gIGRldGVjdEN1cnJlbnRUcmFjaygpOiBUcmFja0luZm8gfCBudWxsIHtcbiAgICBjb25zdCB1cmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICBcbiAgICAvLyBPbmx5IHdvcmsgb24gc2MubWFpZC56b25lIChTb3VuZENsb3VkIHByb3h5KVxuICAgIGlmICh1cmwuaW5jbHVkZXMoJ3NjLm1haWQuem9uZScpKSB7XG4gICAgICByZXR1cm4gdGhpcy5kZXRlY3RTb3VuZENsb3VkVHJhY2soKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IHRyYWNrIGluZm8gZnJvbSBTb3VuZENsb3VkIChzYy5tYWlkLnpvbmUpXG4gICAqL1xuICBwcml2YXRlIGRldGVjdFNvdW5kQ2xvdWRUcmFjaygpOiBUcmFja0luZm8gfCBudWxsIHtcbiAgICB0cnkge1xuICAgICAgLy8gU291bmRDbG91ZCBVUkxzOiBzYy5tYWlkLnpvbmUvdXNlci90cmFjay1uYW1lXG4gICAgICBjb25zdCBwYXRoUGFydHMgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBpZiAocGF0aFBhcnRzLmxlbmd0aCA8IDIpIHJldHVybiBudWxsO1xuXG4gICAgICBjb25zdCBhcnRpc3QgPSBwYXRoUGFydHNbMF07XG4gICAgICBjb25zdCB0cmFja1NsdWcgPSBwYXRoUGFydHNbMV07XG4gICAgICBcbiAgICAgIC8vIFRyeSB0byBnZXQgYWN0dWFsIHRpdGxlIGZyb20gcGFnZSAoU291bmRDbG91ZCBzZWxlY3RvcnMpXG4gICAgICBjb25zdCB0aXRsZVNlbGVjdG9ycyA9IFtcbiAgICAgICAgJy5zb3VuZFRpdGxlX190aXRsZScsXG4gICAgICAgICcudHJhY2tJdGVtX190cmFja1RpdGxlJywgXG4gICAgICAgICdoMVtpdGVtcHJvcD1cIm5hbWVcIl0nLFxuICAgICAgICAnLnNvdW5kX19oZWFkZXIgaDEnLFxuICAgICAgICAnLnNjLXRleHQtaDQnLFxuICAgICAgICAnLnNjLXRleHQtcHJpbWFyeSdcbiAgICAgIF07XG5cbiAgICAgIGxldCB0aXRsZSA9ICcnO1xuICAgICAgZm9yIChjb25zdCBzZWxlY3RvciBvZiB0aXRsZVNlbGVjdG9ycykge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gICAgICAgIGlmIChlbGVtZW50ICYmIGVsZW1lbnQudGV4dENvbnRlbnQpIHtcbiAgICAgICAgICB0aXRsZSA9IGVsZW1lbnQudGV4dENvbnRlbnQudHJpbSgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEZhbGxiYWNrIHRvIHNsdWdcbiAgICAgIGlmICghdGl0bGUpIHtcbiAgICAgICAgdGl0bGUgPSB0cmFja1NsdWcucmVwbGFjZSgvLS9nLCAnICcpO1xuICAgICAgfVxuXG4gICAgICAvLyBDbGVhbiB1cCBhcnRpc3QgbmFtZVxuICAgICAgY29uc3QgY2xlYW5BcnRpc3QgPSBhcnRpc3QucmVwbGFjZSgvLS9nLCAnICcpLnJlcGxhY2UoL18vZywgJyAnKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHJhY2tJZDogYCR7YXJ0aXN0fS8ke3RyYWNrU2x1Z31gLFxuICAgICAgICB0aXRsZTogdGl0bGUsXG4gICAgICAgIGFydGlzdDogY2xlYW5BcnRpc3QsXG4gICAgICAgIHBsYXRmb3JtOiAnc291bmRjbG91ZCcsXG4gICAgICAgIHVybDogd2luZG93LmxvY2F0aW9uLmhyZWYsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbVHJhY2tEZXRlY3Rvcl0gRXJyb3IgZGV0ZWN0aW5nIFNvdW5kQ2xvdWQgdHJhY2s6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cblxuICAvKipcbiAgICogV2F0Y2ggZm9yIHBhZ2UgY2hhbmdlcyAoU291bmRDbG91ZCBpcyBhIFNQQSlcbiAgICovXG4gIHdhdGNoRm9yQ2hhbmdlcyhjYWxsYmFjazogKHRyYWNrOiBUcmFja0luZm8gfCBudWxsKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XG4gICAgbGV0IGN1cnJlbnRVcmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICBsZXQgY3VycmVudFRyYWNrID0gdGhpcy5kZXRlY3RDdXJyZW50VHJhY2soKTtcbiAgICBcbiAgICAvLyBJbml0aWFsIGRldGVjdGlvblxuICAgIGNhbGxiYWNrKGN1cnJlbnRUcmFjayk7XG5cbiAgICAvLyBXYXRjaCBmb3IgVVJMIGNoYW5nZXNcbiAgICBjb25zdCBjaGVja0ZvckNoYW5nZXMgPSAoKSA9PiB7XG4gICAgICBjb25zdCBuZXdVcmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICAgIGlmIChuZXdVcmwgIT09IGN1cnJlbnRVcmwpIHtcbiAgICAgICAgY3VycmVudFVybCA9IG5ld1VybDtcbiAgICAgICAgY29uc3QgbmV3VHJhY2sgPSB0aGlzLmRldGVjdEN1cnJlbnRUcmFjaygpO1xuICAgICAgICBcbiAgICAgICAgLy8gT25seSB0cmlnZ2VyIGNhbGxiYWNrIGlmIHRyYWNrIGFjdHVhbGx5IGNoYW5nZWRcbiAgICAgICAgY29uc3QgdHJhY2tDaGFuZ2VkID0gIWN1cnJlbnRUcmFjayB8fCAhbmV3VHJhY2sgfHwgXG4gICAgICAgICAgY3VycmVudFRyYWNrLnRyYWNrSWQgIT09IG5ld1RyYWNrLnRyYWNrSWQ7XG4gICAgICAgICAgXG4gICAgICAgIGlmICh0cmFja0NoYW5nZWQpIHtcbiAgICAgICAgICBjdXJyZW50VHJhY2sgPSBuZXdUcmFjaztcbiAgICAgICAgICBjYWxsYmFjayhuZXdUcmFjayk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gUG9sbCBmb3IgY2hhbmdlcyAoU1BBcyBkb24ndCBhbHdheXMgdHJpZ2dlciBwcm9wZXIgbmF2aWdhdGlvbiBldmVudHMpXG4gICAgY29uc3QgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChjaGVja0ZvckNoYW5nZXMsIDEwMDApO1xuXG4gICAgLy8gQWxzbyBsaXN0ZW4gZm9yIG5hdmlnYXRpb24gZXZlbnRzXG4gICAgY29uc3QgaGFuZGxlTmF2aWdhdGlvbiA9ICgpID0+IHtcbiAgICAgIHNldFRpbWVvdXQoY2hlY2tGb3JDaGFuZ2VzLCAxMDApOyAvLyBTbWFsbCBkZWxheSBmb3IgRE9NIHVwZGF0ZXNcbiAgICB9O1xuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgaGFuZGxlTmF2aWdhdGlvbik7XG4gICAgXG4gICAgLy8gTGlzdGVuIGZvciBwdXNoc3RhdGUvcmVwbGFjZXN0YXRlIChTb3VuZENsb3VkIHVzZXMgdGhlc2UpXG4gICAgY29uc3Qgb3JpZ2luYWxQdXNoU3RhdGUgPSBoaXN0b3J5LnB1c2hTdGF0ZTtcbiAgICBjb25zdCBvcmlnaW5hbFJlcGxhY2VTdGF0ZSA9IGhpc3RvcnkucmVwbGFjZVN0YXRlO1xuICAgIFxuICAgIGhpc3RvcnkucHVzaFN0YXRlID0gZnVuY3Rpb24oLi4uYXJncykge1xuICAgICAgb3JpZ2luYWxQdXNoU3RhdGUuYXBwbHkoaGlzdG9yeSwgYXJncyk7XG4gICAgICBoYW5kbGVOYXZpZ2F0aW9uKCk7XG4gICAgfTtcbiAgICBcbiAgICBoaXN0b3J5LnJlcGxhY2VTdGF0ZSA9IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICAgIG9yaWdpbmFsUmVwbGFjZVN0YXRlLmFwcGx5KGhpc3RvcnksIGFyZ3MpO1xuICAgICAgaGFuZGxlTmF2aWdhdGlvbigpO1xuICAgIH07XG5cbiAgICAvLyBSZXR1cm4gY2xlYW51cCBmdW5jdGlvblxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb3BzdGF0ZScsIGhhbmRsZU5hdmlnYXRpb24pO1xuICAgICAgaGlzdG9yeS5wdXNoU3RhdGUgPSBvcmlnaW5hbFB1c2hTdGF0ZTtcbiAgICAgIGhpc3RvcnkucmVwbGFjZVN0YXRlID0gb3JpZ2luYWxSZXBsYWNlU3RhdGU7XG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgdHJhY2tEZXRlY3RvciA9IG5ldyBUcmFja0RldGVjdG9yKCk7IiwiLy8gVXNpbmcgYnJvd3Nlci5zdG9yYWdlIEFQSSBkaXJlY3RseSBmb3Igc2ltcGxpY2l0eVxuaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gJ3d4dC9icm93c2VyJztcblxuLy8gSGVscGVyIHRvIGdldCBhdXRoIHRva2VuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0QXV0aFRva2VuKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuZ2V0KCdhdXRoVG9rZW4nKTtcbiAgcmV0dXJuIHJlc3VsdC5hdXRoVG9rZW4gfHwgbnVsbDtcbn1cblxuLy8gSGVscGVyIHRvIHNldCBhdXRoIHRva2VuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0QXV0aFRva2VuKHRva2VuOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnNldCh7IGF1dGhUb2tlbjogdG9rZW4gfSk7XG59XG5cbi8vIEhlbHBlciB0byBnZXQgaW5zdGFsbGF0aW9uIHN0YXRlXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0SW5zdGFsbGF0aW9uU3RhdGUoKTogUHJvbWlzZTx7XG4gIGNvbXBsZXRlZDogYm9vbGVhbjtcbiAgand0VmVyaWZpZWQ6IGJvb2xlYW47XG4gIHRpbWVzdGFtcD86IG51bWJlcjtcbn0+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLmdldCgnaW5zdGFsbGF0aW9uU3RhdGUnKTtcbiAgcmV0dXJuIHJlc3VsdC5pbnN0YWxsYXRpb25TdGF0ZSB8fCB7XG4gICAgY29tcGxldGVkOiBmYWxzZSxcbiAgICBqd3RWZXJpZmllZDogZmFsc2UsXG4gIH07XG59XG5cbi8vIEhlbHBlciB0byBzZXQgaW5zdGFsbGF0aW9uIHN0YXRlXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0SW5zdGFsbGF0aW9uU3RhdGUoc3RhdGU6IHtcbiAgY29tcGxldGVkOiBib29sZWFuO1xuICBqd3RWZXJpZmllZDogYm9vbGVhbjtcbiAgdGltZXN0YW1wPzogbnVtYmVyO1xufSk6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuc2V0KHsgaW5zdGFsbGF0aW9uU3RhdGU6IHN0YXRlIH0pO1xufVxuXG4vLyBIZWxwZXIgdG8gY2hlY2sgaWYgdXNlciBpcyBhdXRoZW50aWNhdGVkXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaXNBdXRoZW50aWNhdGVkKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBjb25zdCB0b2tlbiA9IGF3YWl0IGdldEF1dGhUb2tlbigpO1xuICByZXR1cm4gISF0b2tlbiAmJiB0b2tlbi5zdGFydHNXaXRoKCdzY2FybGV0dF8nKTtcbn1cblxuLy8gSGVscGVyIHRvIGNsZWFyIGF1dGggZGF0YVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNsZWFyQXV0aCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnJlbW92ZShbJ2F1dGhUb2tlbicsICdpbnN0YWxsYXRpb25TdGF0ZSddKTtcbn0iLCJleHBvcnQgaW50ZXJmYWNlIEthcmFva2VEYXRhIHtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgdHJhY2tfaWQ/OiBzdHJpbmc7XG4gIHRyYWNrSWQ/OiBzdHJpbmc7XG4gIGhhc19rYXJhb2tlPzogYm9vbGVhbjtcbiAgaGFzS2FyYW9rZT86IGJvb2xlYW47XG4gIHNvbmc/OiB7XG4gICAgaWQ6IHN0cmluZztcbiAgICB0aXRsZTogc3RyaW5nO1xuICAgIGFydGlzdDogc3RyaW5nO1xuICAgIGFsYnVtPzogc3RyaW5nO1xuICAgIGFydHdvcmtVcmw/OiBzdHJpbmc7XG4gICAgZHVyYXRpb24/OiBudW1iZXI7XG4gICAgZGlmZmljdWx0eTogJ2JlZ2lubmVyJyB8ICdpbnRlcm1lZGlhdGUnIHwgJ2FkdmFuY2VkJztcbiAgfTtcbiAgbHlyaWNzPzoge1xuICAgIHNvdXJjZTogc3RyaW5nO1xuICAgIHR5cGU6ICdzeW5jZWQnO1xuICAgIGxpbmVzOiBMeXJpY0xpbmVbXTtcbiAgICB0b3RhbExpbmVzOiBudW1iZXI7XG4gIH07XG4gIG1lc3NhZ2U/OiBzdHJpbmc7XG4gIGVycm9yPzogc3RyaW5nO1xuICBhcGlfY29ubmVjdGVkPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMeXJpY0xpbmUge1xuICBpZDogc3RyaW5nO1xuICB0ZXh0OiBzdHJpbmc7XG4gIHN0YXJ0VGltZTogbnVtYmVyO1xuICBkdXJhdGlvbjogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEthcmFva2VTZXNzaW9uIHtcbiAgaWQ6IHN0cmluZztcbiAgdHJhY2tJZDogc3RyaW5nO1xuICBzb25nVGl0bGU6IHN0cmluZztcbiAgc29uZ0FydGlzdDogc3RyaW5nO1xuICBzdGF0dXM6IHN0cmluZztcbiAgY3JlYXRlZEF0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBLYXJhb2tlQXBpU2VydmljZSB7XG4gIHByaXZhdGUgYmFzZVVybDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIC8vIFVzZSB0aGUgbG9jYWwgc2VydmVyIGVuZHBvaW50XG4gICAgdGhpcy5iYXNlVXJsID0gJ2h0dHA6Ly9sb2NhbGhvc3Q6ODc4Ny9hcGknO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBrYXJhb2tlIGRhdGEgZm9yIGEgdHJhY2sgSUQgKFlvdVR1YmUvU291bmRDbG91ZClcbiAgICovXG4gIGFzeW5jIGdldEthcmFva2VEYXRhKFxuICAgIHRyYWNrSWQ6IHN0cmluZywgXG4gICAgdGl0bGU/OiBzdHJpbmcsIFxuICAgIGFydGlzdD86IHN0cmluZ1xuICApOiBQcm9taXNlPEthcmFva2VEYXRhIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCk7XG4gICAgICBpZiAodGl0bGUpIHBhcmFtcy5zZXQoJ3RpdGxlJywgdGl0bGUpO1xuICAgICAgaWYgKGFydGlzdCkgcGFyYW1zLnNldCgnYXJ0aXN0JywgYXJ0aXN0KTtcbiAgICAgIFxuICAgICAgY29uc3QgdXJsID0gYCR7dGhpcy5iYXNlVXJsfS9rYXJhb2tlLyR7ZW5jb2RlVVJJQ29tcG9uZW50KHRyYWNrSWQpfSR7cGFyYW1zLnRvU3RyaW5nKCkgPyAnPycgKyBwYXJhbXMudG9TdHJpbmcoKSA6ICcnfWA7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUFwaV0gRmV0Y2hpbmcga2FyYW9rZSBkYXRhOicsIHVybCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIC8vIFJlbW92ZSBDb250ZW50LVR5cGUgaGVhZGVyIHRvIGF2b2lkIENPUlMgcHJlZmxpZ2h0XG4gICAgICAgIC8vIGhlYWRlcnM6IHtcbiAgICAgICAgLy8gICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAvLyB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEZhaWxlZCB0byBmZXRjaCBrYXJhb2tlIGRhdGE6JywgcmVzcG9uc2Uuc3RhdHVzKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICBjb25zb2xlLmxvZygnW0thcmFva2VBcGldIFJlY2VpdmVkIGthcmFva2UgZGF0YTonLCBkYXRhKTtcbiAgICAgIFxuICAgICAgLy8gSWYgdGhlcmUncyBhbiBlcnJvciBidXQgd2UgZ290IGEgcmVzcG9uc2UsIGl0IG1lYW5zIEFQSSBpcyBjb25uZWN0ZWRcbiAgICAgIGlmIChkYXRhLmVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbS2FyYW9rZUFwaV0gU2VydmVyIGVycm9yIChidXQgQVBJIGlzIHJlYWNoYWJsZSk6JywgZGF0YS5lcnJvcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgaGFzX2thcmFva2U6IGZhbHNlLFxuICAgICAgICAgIGVycm9yOiBkYXRhLmVycm9yLFxuICAgICAgICAgIHRyYWNrX2lkOiB0cmFja0lkLFxuICAgICAgICAgIGFwaV9jb25uZWN0ZWQ6IHRydWVcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBFcnJvciBmZXRjaGluZyBrYXJhb2tlIGRhdGE6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IGEga2FyYW9rZSBzZXNzaW9uXG4gICAqL1xuICBhc3luYyBzdGFydFNlc3Npb24oXG4gICAgdHJhY2tJZDogc3RyaW5nLFxuICAgIHNvbmdEYXRhOiB7XG4gICAgICB0aXRsZTogc3RyaW5nO1xuICAgICAgYXJ0aXN0OiBzdHJpbmc7XG4gICAgICBhbGJ1bT86IHN0cmluZztcbiAgICAgIGR1cmF0aW9uPzogbnVtYmVyO1xuICAgIH1cbiAgKTogUHJvbWlzZTxLYXJhb2tlU2Vzc2lvbiB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHt0aGlzLmJhc2VVcmx9L2thcmFva2Uvc3RhcnRgLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAvLyBUT0RPOiBBZGQgYXV0aCB0b2tlbiB3aGVuIGF2YWlsYWJsZVxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgdHJhY2tJZCxcbiAgICAgICAgICBzb25nRGF0YSxcbiAgICAgICAgfSksXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbS2FyYW9rZUFwaV0gRmFpbGVkIHRvIHN0YXJ0IHNlc3Npb246JywgcmVzcG9uc2Uuc3RhdHVzKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgIHJldHVybiByZXN1bHQuc2Vzc2lvbjtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0thcmFva2VBcGldIEVycm9yIHN0YXJ0aW5nIHNlc3Npb246JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRlc3QgY29ubmVjdGlvbiB0byB0aGUgQVBJXG4gICAqL1xuICBhc3luYyB0ZXN0Q29ubmVjdGlvbigpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHt0aGlzLmJhc2VVcmwucmVwbGFjZSgnL2FwaScsICcnKX0vaGVhbHRoYCk7XG4gICAgICByZXR1cm4gcmVzcG9uc2Uub2s7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tLYXJhb2tlQXBpXSBDb25uZWN0aW9uIHRlc3QgZmFpbGVkOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGthcmFva2VBcGkgPSBuZXcgS2FyYW9rZUFwaVNlcnZpY2UoKTsiLCJpbXBvcnQgeyBDb21wb25lbnQsIGNyZWF0ZVNpZ25hbCwgY3JlYXRlRWZmZWN0LCBvbk1vdW50LCBvbkNsZWFudXAsIFNob3cgfSBmcm9tICdzb2xpZC1qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25LYXJhb2tlVmlldywgS2FyYW9rZVNlc3Npb24gfSBmcm9tICdAc2NhcmxldHQvdWknO1xuaW1wb3J0IHsgdHJhY2tEZXRlY3RvciwgdHlwZSBUcmFja0luZm8gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy90cmFjay1kZXRlY3Rvcic7XG5pbXBvcnQgeyBnZXRBdXRoVG9rZW4gfSBmcm9tICcuLi8uLi91dGlscy9zdG9yYWdlJztcbmltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG5pbXBvcnQgeyBrYXJhb2tlQXBpIH0gZnJvbSAnLi4vLi4vc2VydmljZXMva2FyYW9rZS1hcGknO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbnRlbnRBcHBQcm9wcyB7fVxuXG5leHBvcnQgY29uc3QgQ29udGVudEFwcDogQ29tcG9uZW50PENvbnRlbnRBcHBQcm9wcz4gPSAoKSA9PiB7XG4gIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gUmVuZGVyaW5nIENvbnRlbnRBcHAgY29tcG9uZW50Jyk7XG4gIFxuICAvLyBTdGF0ZVxuICBjb25zdCBbY3VycmVudFRyYWNrLCBzZXRDdXJyZW50VHJhY2tdID0gY3JlYXRlU2lnbmFsPFRyYWNrSW5mbyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbYXV0aFRva2VuLCBzZXRBdXRoVG9rZW5dID0gY3JlYXRlU2lnbmFsPHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbc2hvd0thcmFva2UsIHNldFNob3dLYXJhb2tlXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtrYXJhb2tlRGF0YSwgc2V0S2FyYW9rZURhdGFdID0gY3JlYXRlU2lnbmFsPGFueT4obnVsbCk7XG4gIGNvbnN0IFtsb2FkaW5nLCBzZXRMb2FkaW5nXSA9IGNyZWF0ZVNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IFtzZXNzaW9uU3RhcnRlZCwgc2V0U2Vzc2lvblN0YXJ0ZWRdID0gY3JlYXRlU2lnbmFsKGZhbHNlKTtcbiAgXG4gIC8vIExvYWQgYXV0aCB0b2tlbiBvbiBtb3VudFxuICBvbk1vdW50KGFzeW5jICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIExvYWRpbmcgYXV0aCB0b2tlbicpO1xuICAgIGNvbnN0IHRva2VuID0gYXdhaXQgZ2V0QXV0aFRva2VuKCk7XG4gICAgaWYgKHRva2VuKSB7XG4gICAgICBzZXRBdXRoVG9rZW4odG9rZW4pO1xuICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBBdXRoIHRva2VuIGxvYWRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgZGVtbyB0b2tlbiBmb3IgZGV2ZWxvcG1lbnRcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTm8gYXV0aCB0b2tlbiBmb3VuZCwgdXNpbmcgZGVtbyB0b2tlbicpO1xuICAgICAgc2V0QXV0aFRva2VuKCdzY2FybGV0dF9kZW1vX3Rva2VuXzEyMycpO1xuICAgIH1cbiAgICBcbiAgICAvLyBTdGFydCB3YXRjaGluZyBmb3IgdHJhY2sgY2hhbmdlc1xuICAgIGNvbnN0IGNsZWFudXAgPSB0cmFja0RldGVjdG9yLndhdGNoRm9yQ2hhbmdlcygodHJhY2spID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gVHJhY2sgY2hhbmdlZDonLCB0cmFjayk7XG4gICAgICBzZXRDdXJyZW50VHJhY2sodHJhY2spO1xuICAgICAgLy8gU2hvdyBrYXJhb2tlIHdoZW4gdHJhY2sgaXMgZGV0ZWN0ZWQgYW5kIGZldGNoIGRhdGFcbiAgICAgIGlmICh0cmFjaykge1xuICAgICAgICBzZXRTaG93S2FyYW9rZSh0cnVlKTtcbiAgICAgICAgZmV0Y2hLYXJhb2tlRGF0YSh0cmFjayk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBvbkNsZWFudXAoY2xlYW51cCk7XG4gIH0pO1xuXG4gIGNvbnN0IGZldGNoS2FyYW9rZURhdGEgPSBhc3luYyAodHJhY2s6IFRyYWNrSW5mbykgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gRmV0Y2hpbmcga2FyYW9rZSBkYXRhIGZvciB0cmFjazonLCB0cmFjayk7XG4gICAgc2V0TG9hZGluZyh0cnVlKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGthcmFva2VBcGkuZ2V0S2FyYW9rZURhdGEoXG4gICAgICAgIHRyYWNrLnRyYWNrSWQsXG4gICAgICAgIHRyYWNrLnRpdGxlLFxuICAgICAgICB0cmFjay5hcnRpc3RcbiAgICAgICk7XG4gICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIEthcmFva2UgZGF0YSBsb2FkZWQ6JywgZGF0YSk7XG4gICAgICBzZXRLYXJhb2tlRGF0YShkYXRhKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0NvbnRlbnRBcHBdIEZhaWxlZCB0byBmZXRjaCBrYXJhb2tlIGRhdGE6JywgZXJyb3IpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRMb2FkaW5nKGZhbHNlKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlU3RhcnQgPSAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBTdGFydCBrYXJhb2tlIHNlc3Npb24nKTtcbiAgICBzZXRTZXNzaW9uU3RhcnRlZCh0cnVlKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVDbG9zZSA9ICgpID0+IHtcbiAgICBzZXRTaG93S2FyYW9rZShmYWxzZSk7XG4gICAgc2V0S2FyYW9rZURhdGEobnVsbCk7XG4gICAgc2V0U2Vzc2lvblN0YXJ0ZWQoZmFsc2UpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZU1pbmltaXplID0gKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTWluaW1pemUga2FyYW9rZSB3aWRnZXQnKTtcbiAgICAvLyBGb3Igbm93LCBqdXN0IGNsb3NlIGl0XG4gICAgaGFuZGxlQ2xvc2UoKTtcbiAgfTtcblxuICBjb25zb2xlLmxvZygnW0NvbnRlbnRBcHBdIFJlbmRlciBzdGF0ZTonLCB7XG4gICAgc2hvd0thcmFva2U6IHNob3dLYXJhb2tlKCksXG4gICAgY3VycmVudFRyYWNrOiBjdXJyZW50VHJhY2soKSxcbiAgICBrYXJhb2tlRGF0YToga2FyYW9rZURhdGEoKSxcbiAgICBsb2FkaW5nOiBsb2FkaW5nKClcbiAgfSk7XG5cbiAgcmV0dXJuIChcbiAgICA8U2hvdyB3aGVuPXtzaG93S2FyYW9rZSgpICYmIGN1cnJlbnRUcmFjaygpfSBmYWxsYmFjaz17XG4gICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdub25lJyB9fT5cbiAgICAgICAge2NvbnNvbGUubG9nKCdbQ29udGVudEFwcF0gTm90IHNob3dpbmcgLSBzaG93S2FyYW9rZTonLCBzaG93S2FyYW9rZSgpLCAnY3VycmVudFRyYWNrOicsIGN1cnJlbnRUcmFjaygpKX1cbiAgICAgIDwvZGl2PlxuICAgIH0+XG4gICAgICB7Y29uc29sZS5sb2coJ1tDb250ZW50QXBwXSBSZW5kZXJpbmcgRXh0ZW5zaW9uS2FyYW9rZVZpZXcgd2l0aCBkYXRhOicsIGthcmFva2VEYXRhKCkpfVxuICAgICAgPEV4dGVuc2lvbkthcmFva2VWaWV3XG4gICAgICAgIHRyYWNrPXtjdXJyZW50VHJhY2soKSF9XG4gICAgICAgIGx5cmljcz17a2FyYW9rZURhdGEoKT8ubHlyaWNzfVxuICAgICAgICBsb2FkaW5nPXtsb2FkaW5nKCl9XG4gICAgICAgIG9uU3RhcnQ9e2hhbmRsZVN0YXJ0fVxuICAgICAgICBvbkNsb3NlPXtoYW5kbGVDbG9zZX1cbiAgICAgICAgb25NaW5pbWl6ZT17aGFuZGxlTWluaW1pemV9XG4gICAgICAvPlxuICAgIDwvU2hvdz5cbiAgKTtcbn07IiwiaW1wb3J0IHsgY3JlYXRlU2hhZG93Um9vdFVpIH0gZnJvbSAnd3h0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LXVpL3NoYWRvdy1yb290JztcbmltcG9ydCB7IGRlZmluZUNvbnRlbnRTY3JpcHQgfSBmcm9tICd3eHQvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0JztcbmltcG9ydCB0eXBlIHsgQ29udGVudFNjcmlwdENvbnRleHQgfSBmcm9tICd3eHQvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dCc7XG5pbXBvcnQgeyByZW5kZXIgfSBmcm9tICdzb2xpZC1qcy93ZWInO1xuaW1wb3J0IHsgQ29udGVudEFwcCB9IGZyb20gJy4uL3NyYy9hcHBzL2NvbnRlbnQvQ29udGVudEFwcCc7XG5pbXBvcnQgJy4uL3NyYy9zdHlsZXMvZXh0ZW5zaW9uLmNzcyc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbnRlbnRTY3JpcHQoe1xuICBtYXRjaGVzOiBbJyo6Ly9zb3VuZGNsb3VkLmNvbS8qJywgJyo6Ly9zb3VuZGNsb2FrLmNvbS8qJywgJyo6Ly9zYy5tYWlkLnpvbmUvKicsICcqOi8vKi5tYWlkLnpvbmUvKiddLFxuICBydW5BdDogJ2RvY3VtZW50X2lkbGUnLFxuICBjc3NJbmplY3Rpb25Nb2RlOiAndWknLFxuXG4gIGFzeW5jIG1haW4oY3R4OiBDb250ZW50U2NyaXB0Q29udGV4dCkge1xuICAgIC8vIE9ubHkgcnVuIGluIHRvcC1sZXZlbCBmcmFtZSB0byBhdm9pZCBkdXBsaWNhdGUgcHJvY2Vzc2luZyBpbiBpZnJhbWVzXG4gICAgaWYgKHdpbmRvdy50b3AgIT09IHdpbmRvdy5zZWxmKSB7XG4gICAgICBjb25zb2xlLmxvZygnW1NjYXJsZXR0IENTXSBOb3QgdG9wLWxldmVsIGZyYW1lLCBza2lwcGluZyBjb250ZW50IHNjcmlwdC4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygnW1NjYXJsZXR0IENTXSBTY2FybGV0dCBLYXJhb2tlIGNvbnRlbnQgc2NyaXB0IGxvYWRlZCcpO1xuXG4gICAgLy8gQ3JlYXRlIHNoYWRvdyBET00gYW5kIG1vdW50IGthcmFva2Ugd2lkZ2V0XG4gICAgY29uc3QgdWkgPSBhd2FpdCBjcmVhdGVTaGFkb3dSb290VWkoY3R4LCB7XG4gICAgICBuYW1lOiAnc2NhcmxldHQta2FyYW9rZS11aScsXG4gICAgICBwb3NpdGlvbjogJ292ZXJsYXknLFxuICAgICAgYW5jaG9yOiAnYm9keScsXG4gICAgICBvbk1vdW50OiBhc3luYyAoY29udGFpbmVyOiBIVE1MRWxlbWVudCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBvbk1vdW50IGNhbGxlZCwgY29udGFpbmVyOicsIGNvbnRhaW5lcik7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIFNoYWRvdyByb290OicsIGNvbnRhaW5lci5nZXRSb290Tm9kZSgpKTtcbiAgICAgICAgXG4gICAgICAgIC8vIExvZyB3aGF0IHN0eWxlc2hlZXRzIGFyZSBhdmFpbGFibGVcbiAgICAgICAgY29uc3Qgc2hhZG93Um9vdCA9IGNvbnRhaW5lci5nZXRSb290Tm9kZSgpIGFzIFNoYWRvd1Jvb3Q7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudCBTY3JpcHRdIFNoYWRvdyByb290IHN0eWxlc2hlZXRzOicsIHNoYWRvd1Jvb3Quc3R5bGVTaGVldHM/Lmxlbmd0aCk7XG4gICAgICAgIFxuICAgICAgICAvLyBDcmVhdGUgd3JhcHBlciB3aXRoIHBvc2l0aW9uaW5nXG4gICAgICAgIGNvbnN0IHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgd3JhcHBlci5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgICB0b3A6IDIwcHg7XG4gICAgICAgICAgcmlnaHQ6IDIwcHg7XG4gICAgICAgICAgYm90dG9tOiAyMHB4O1xuICAgICAgICAgIHdpZHRoOiA0MDBweDtcbiAgICAgICAgICB6LWluZGV4OiA5OTk5OTtcbiAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDE2cHg7XG4gICAgICAgICAgYm94LXNoYWRvdzogMCAyNXB4IDUwcHggLTEycHggcmdiYSgwLCAwLCAwLCAwLjYpO1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgYDtcbiAgICAgICAgd3JhcHBlci5jbGFzc05hbWUgPSAna2FyYW9rZS13aWRnZXQnO1xuICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQod3JhcHBlcik7XG5cbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gV3JhcHBlciBjcmVhdGVkIGFuZCBhcHBlbmRlZDonLCB3cmFwcGVyKTtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gV3JhcHBlciBjb21wdXRlZCBzdHlsZXM6Jywgd2luZG93LmdldENvbXB1dGVkU3R5bGUod3JhcHBlcikpO1xuXG4gICAgICAgIC8vIFJlbmRlciBDb250ZW50QXBwIGNvbXBvbmVudCAod2hpY2ggdXNlcyBFeHRlbnNpb25LYXJhb2tlVmlldylcbiAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50IFNjcmlwdF0gQWJvdXQgdG8gcmVuZGVyIENvbnRlbnRBcHAnKTtcbiAgICAgICAgY29uc3QgZGlzcG9zZSA9IHJlbmRlcigoKSA9PiA8Q29udGVudEFwcCAvPiwgd3JhcHBlcik7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZygnW0NvbnRlbnQgU2NyaXB0XSBDb250ZW50QXBwIHJlbmRlcmVkLCBkaXNwb3NlIGZ1bmN0aW9uOicsIGRpc3Bvc2UpO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIGRpc3Bvc2U7XG4gICAgICB9LFxuICAgICAgb25SZW1vdmU6IChjbGVhbnVwPzogKCkgPT4gdm9pZCkgPT4ge1xuICAgICAgICBjbGVhbnVwPy4oKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBNb3VudCB0aGUgVUlcbiAgICB1aS5tb3VudCgpO1xuICAgIGNvbnNvbGUubG9nKCdbU2NhcmxldHQgQ1NdIEthcmFva2Ugb3ZlcmxheSBtb3VudGVkJyk7XG4gIH0sXG59KTsiLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKi9cbiAgc2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqL1xuICBzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKi9cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0pO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKi9cbiAgcmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9LCBvcHRpb25zKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuICAgIH1cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKFxuICAgICAgdHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsXG4gICAgICBoYW5kbGVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBzaWduYWw6IHRoaXMuc2lnbmFsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuICAgKi9cbiAgbm90aWZ5SW52YWxpZGF0ZWQoKSB7XG4gICAgdGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG4gICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgXG4gICAgKTtcbiAgfVxuICBzdG9wT2xkU2NyaXB0cygpIHtcbiAgICB3aW5kb3cucG9zdE1lc3NhZ2UoXG4gICAgICB7XG4gICAgICAgIHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcbiAgICAgICAgY29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG4gICAgICAgIG1lc3NhZ2VJZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMilcbiAgICAgIH0sXG4gICAgICBcIipcIlxuICAgICk7XG4gIH1cbiAgdmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG4gICAgY29uc3QgaXNTY3JpcHRTdGFydGVkRXZlbnQgPSBldmVudC5kYXRhPy50eXBlID09PSBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEU7XG4gICAgY29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRhdGE/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuICAgIGNvbnN0IGlzTm90RHVwbGljYXRlID0gIXRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmhhcyhldmVudC5kYXRhPy5tZXNzYWdlSWQpO1xuICAgIHJldHVybiBpc1NjcmlwdFN0YXJ0ZWRFdmVudCAmJiBpc1NhbWVDb250ZW50U2NyaXB0ICYmIGlzTm90RHVwbGljYXRlO1xuICB9XG4gIGxpc3RlbkZvck5ld2VyU2NyaXB0cyhvcHRpb25zKSB7XG4gICAgbGV0IGlzRmlyc3QgPSB0cnVlO1xuICAgIGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG4gICAgICBpZiAodGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmFkZChldmVudC5kYXRhLm1lc3NhZ2VJZCk7XG4gICAgICAgIGNvbnN0IHdhc0ZpcnN0ID0gaXNGaXJzdDtcbiAgICAgICAgaXNGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzRmlyc3QgJiYgb3B0aW9ucz8uaWdub3JlRmlyc3RFdmVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYik7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJ2YWx1ZSIsImRpc3Bvc2UiLCJkb2N1bWVudCIsImFkZEV2ZW50TGlzdGVuZXIiLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJpc1BvdGVudGlhbEN1c3RvbUVsZW1lbnROYW1lIiwicHJpbnQiLCJsb2dnZXIiLCJfYSIsIl9iIiwicmVzdWx0IiwicmVtb3ZlRGV0ZWN0b3IiLCJtb3VudERldGVjdG9yIiwiZGVmaW5pdGlvbiIsIl8kZGVsZWdhdGVFdmVudHMiLCJTY29yZVBhbmVsIiwicHJvcHMiLCJfZWwkIiwiX3RtcGwkIiwiX2VsJDIiLCJmaXJzdENoaWxkIiwiX2VsJDMiLCJfZWwkNCIsIm5leHRTaWJsaW5nIiwiX2VsJDUiLCJzY29yZSIsInJhbmsiLCJfJGNsYXNzTmFtZSIsImNuIiwiY2xhc3MiLCJMeXJpY3NEaXNwbGF5IiwiY3VycmVudExpbmVJbmRleCIsInNldEN1cnJlbnRMaW5lSW5kZXgiLCJjcmVhdGVTaWduYWwiLCJjb250YWluZXJSZWYiLCJjcmVhdGVFZmZlY3QiLCJjdXJyZW50VGltZSIsInRpbWUiLCJpbmRleCIsImx5cmljcyIsImZpbmRJbmRleCIsImxpbmUiLCJlbmRUaW1lIiwic3RhcnRUaW1lIiwiZHVyYXRpb24iLCJpc1BsYXlpbmciLCJsaW5lRWxlbWVudHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwiY3VycmVudEVsZW1lbnQiLCJjb250YWluZXJIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJsaW5lVG9wIiwib2Zmc2V0VG9wIiwibGluZUhlaWdodCIsIm9mZnNldEhlaWdodCIsInNjcm9sbFRvcCIsInNjcm9sbFRvIiwidG9wIiwiYmVoYXZpb3IiLCJfcmVmJCIsIl8kdXNlIiwiXyRjcmVhdGVDb21wb25lbnQiLCJGb3IiLCJlYWNoIiwiY2hpbGRyZW4iLCJfdG1wbCQyIiwidGV4dCIsIl8kZWZmZWN0IiwiX3AkIiwiX3YkIiwiX3YkMiIsImUiLCJfJHNldEF0dHJpYnV0ZSIsInQiLCJ1bmRlZmluZWQiLCJMZWFkZXJib2FyZFBhbmVsIiwiZW50cmllcyIsImVudHJ5IiwiX2VsJDYiLCJfJGluc2VydCIsInVzZXJuYW1lIiwidG9Mb2NhbGVTdHJpbmciLCJpc0N1cnJlbnRVc2VyIiwiX3YkMyIsIl92JDQiLCJhIiwibyIsInNwZWVkcyIsIlNwbGl0QnV0dG9uIiwiY3VycmVudFNwZWVkSW5kZXgiLCJzZXRDdXJyZW50U3BlZWRJbmRleCIsImN1cnJlbnRTcGVlZCIsImN5Y2xlU3BlZWQiLCJzdG9wUHJvcGFnYXRpb24iLCJuZXh0SW5kZXgiLCJsZW5ndGgiLCJuZXdTcGVlZCIsIm9uU3BlZWRDaGFuZ2UiLCJfJGFkZEV2ZW50TGlzdGVuZXIiLCJvblN0YXJ0IiwiJCRjbGljayIsImRpc2FibGVkIiwiX3YkNSIsImkiLCJjdXJyZW50VGFic1N0YXRlIiwiVGFicyIsImFjdGl2ZVRhYiIsInNldEFjdGl2ZVRhYiIsImRlZmF1bHRUYWIiLCJ0YWJzIiwiaWQiLCJoYW5kbGVUYWJDaGFuZ2UiLCJvblRhYkNoYW5nZSIsIlRhYnNMaXN0IiwiVGFic1RyaWdnZXIiLCJpc0FjdGl2ZSIsIlRhYnNDb250ZW50IiwiU2hvdyIsIndoZW4iLCJFeHRlbnNpb25LYXJhb2tlVmlldyIsIl90bXBsJDQiLCJsYWJlbCIsIl8kbWVtbyIsIl90bXBsJDUiLCJfdG1wbCQzIiwibGVhZGVyYm9hcmQiLCJDb250ZW50QXBwIiwiY29uc29sZSIsImxvZyIsImN1cnJlbnRUcmFjayIsInNldEN1cnJlbnRUcmFjayIsImF1dGhUb2tlbiIsInNldEF1dGhUb2tlbiIsInNob3dLYXJhb2tlIiwic2V0U2hvd0thcmFva2UiLCJrYXJhb2tlRGF0YSIsInNldEthcmFva2VEYXRhIiwibG9hZGluZyIsInNldExvYWRpbmciLCJzZXNzaW9uU3RhcnRlZCIsInNldFNlc3Npb25TdGFydGVkIiwib25Nb3VudCIsInRva2VuIiwiZ2V0QXV0aFRva2VuIiwiY2xlYW51cCIsInRyYWNrRGV0ZWN0b3IiLCJ3YXRjaEZvckNoYW5nZXMiLCJ0cmFjayIsImZldGNoS2FyYW9rZURhdGEiLCJvbkNsZWFudXAiLCJkYXRhIiwia2FyYW9rZUFwaSIsImdldEthcmFva2VEYXRhIiwidHJhY2tJZCIsInRpdGxlIiwiYXJ0aXN0IiwiZXJyb3IiLCJoYW5kbGVTdGFydCIsImhhbmRsZUNsb3NlIiwiaGFuZGxlTWluaW1pemUiLCJmYWxsYmFjayIsInN0eWxlIiwic2V0UHJvcGVydHkiLCJvbkNsb3NlIiwib25NaW5pbWl6ZSIsImRlZmluZUNvbnRlbnRTY3JpcHQiLCJtYXRjaGVzIiwicnVuQXQiLCJjc3NJbmplY3Rpb25Nb2RlIiwibWFpbiIsImN0eCIsIndpbmRvdyIsInNlbGYiLCJ1aSIsImNyZWF0ZVNoYWRvd1Jvb3RVaSIsIm5hbWUiLCJwb3NpdGlvbiIsImFuY2hvciIsImNvbnRhaW5lciIsImdldFJvb3ROb2RlIiwic2hhZG93Um9vdCIsInN0eWxlU2hlZXRzIiwid3JhcHBlciIsImNyZWF0ZUVsZW1lbnQiLCJjc3NUZXh0IiwiY2xhc3NOYW1lIiwiYXBwZW5kQ2hpbGQiLCJnZXRDb21wdXRlZFN0eWxlIiwicmVuZGVyIiwib25SZW1vdmUiLCJtb3VudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBZ0pBLFFBQU0sU0FBUztBQUNmLFFBQU0sVUFBVSxDQUFDLEdBQUcsTUFBTSxNQUFNO0FBR2hDLFFBQU0sU0FBUyxPQUFPLGFBQWE7QUFDbkMsUUFBTSxXQUFXLE9BQU8scUJBQXFCO0FBQzdDLFFBQU0sZ0JBQWdCO0FBQUEsSUFDcEIsUUFBUTtBQUFBLEVBQ1Y7QUFFQSxNQUFJLGFBQWE7QUFDakIsUUFBTSxRQUFRO0FBQ2QsUUFBTSxVQUFVO0FBQ2hCLFFBQU0sVUFBVSxDQUtoQjtBQUVBLE1BQUksUUFBUTtBQUNaLE1BQUksYUFBYTtBQUVqQixNQUFJLHVCQUF1QjtBQUMzQixNQUFJLFdBQVc7QUFDZixNQUFJLFVBQVU7QUFDZCxNQUFJLFVBQVU7QUFDZCxNQUFJLFlBQVk7QUFPaEIsV0FBUyxXQUFXLElBQUksZUFBZTtBQUNyQyxVQUFNLFdBQVcsVUFDZixRQUFRLE9BQ1IsVUFBVSxHQUFHLFdBQVcsR0FDeEIsVUFBVSxrQkFBa0IsU0FBWSxRQUFRLGVBQ2hELE9BQU8sVUFBVTtBQUFBLE1BQ2YsT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsU0FBUztBQUFBLE1BQ1QsT0FBTztBQUFBLElBQUEsSUFDSjtBQUFBLE1BQ0gsT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsU0FBUyxVQUFVLFFBQVEsVUFBVTtBQUFBLE1BQ3JDLE9BQU87QUFBQSxJQUVULEdBQUEsV0FBVyxVQUFVLE1BQU0sR0FBRyxNQUFNO0FBQzVCLFlBQUEsSUFBSSxNQUFNLG9FQUFvRTtBQUFBLElBQUEsQ0FDckYsSUFBSyxNQUFNLEdBQUcsTUFBTSxRQUFRLE1BQU0sVUFBVSxJQUFJLENBQUMsQ0FBQztBQUU3QyxZQUFBO0FBQ0csZUFBQTtBQUNQLFFBQUE7QUFDSyxhQUFBLFdBQVcsVUFBVSxJQUFJO0FBQUEsSUFBQSxVQUNoQztBQUNXLGlCQUFBO0FBQ0gsY0FBQTtBQUFBLElBQUE7QUFBQSxFQUVaO0FBQ0EsV0FBUyxhQUFhLE9BQU8sU0FBUztBQUNwQyxjQUFVLFVBQVUsT0FBTyxPQUFPLENBQUEsR0FBSSxlQUFlLE9BQU8sSUFBSTtBQUNoRSxVQUFNLElBQUk7QUFBQSxNQUNSO0FBQUEsTUFDQSxXQUFXO0FBQUEsTUFDWCxlQUFlO0FBQUEsTUFDZixZQUFZLFFBQVEsVUFBVTtBQUFBLElBQ2hDO0FBQ0E7QUFDRSxVQUFJLFFBQVEsS0FBUSxHQUFBLE9BQU8sUUFBUTtBQUNuQyxVQUFJLFFBQVEsVUFBVTtBQUNwQixVQUFFLFdBQVc7QUFBQSxNQUFBLE9BQ1I7QUFDTCxzQkFBYyxDQUFDO0FBQUEsTUFDNkM7QUFBQSxJQUM5RDtBQUVJLFVBQUEsU0FBUyxDQUFBQSxXQUFTO0FBQ2xCLFVBQUEsT0FBT0EsV0FBVSxZQUFZO0FBQ2lFQSxpQkFBUUEsT0FBTSxFQUFFLEtBQUs7QUFBQSxNQUFBO0FBRWhILGFBQUEsWUFBWSxHQUFHQSxNQUFLO0FBQUEsSUFDN0I7QUFDQSxXQUFPLENBQUMsV0FBVyxLQUFLLENBQUMsR0FBRyxNQUFNO0FBQUEsRUFDcEM7QUFLQSxXQUFTLG1CQUFtQixJQUFJLE9BQU8sU0FBUztBQUM5QyxVQUFNLElBQUksa0JBQWtCLElBQUksT0FBTyxPQUFPLE9BQU8sT0FBUTtzQkFDNkIsQ0FBQztBQUFBLEVBQzdGO0FBQ0EsV0FBUyxhQUFhLElBQUksT0FBTyxTQUFTO0FBQzNCLGlCQUFBO0FBQ1AsVUFBQSxJQUFJLGtCQUFrQixJQUFJLE9BQU8sT0FBTyxPQUFPLE9BQVE7TUFHMUIsT0FBTztBQUMxQyxjQUFVLFFBQVEsS0FBSyxDQUFDLElBQUksa0JBQWtCLENBQUM7QUFBQSxFQUNqRDtBQWVBLFdBQVMsV0FBVyxJQUFJLE9BQU8sU0FBUztBQUN0QyxjQUFVLFVBQVUsT0FBTyxPQUFPLENBQUEsR0FBSSxlQUFlLE9BQU8sSUFBSTtBQUNoRSxVQUFNLElBQUksa0JBQWtCLElBQUksT0FBTyxNQUFNLEdBQUcsT0FBUTtBQUN4RCxNQUFFLFlBQVk7QUFDZCxNQUFFLGdCQUFnQjtBQUNoQixNQUFBLGFBQWEsUUFBUSxVQUFVO3NCQUlSLENBQUM7QUFDbkIsV0FBQSxXQUFXLEtBQUssQ0FBQztBQUFBLEVBQzFCO0FBa01BLFdBQVMsUUFBUSxJQUFJO0FBQ25CLFFBQTZCLGFBQWEsYUFBYSxHQUFHO0FBQzFELFVBQU0sV0FBVztBQUNOLGVBQUE7QUFDUCxRQUFBO0FBQ0YsVUFBSSxxQkFBc0I7QUFDMUIsYUFBTyxHQUFHO0FBQUEsSUFBQSxVQUNWO0FBQ1csaUJBQUE7QUFBQSxJQUFBO0FBQUEsRUFFZjtBQW9CQSxXQUFTLFFBQVEsSUFBSTtBQUNOLGlCQUFBLE1BQU0sUUFBUSxFQUFFLENBQUM7QUFBQSxFQUNoQztBQUNBLFdBQVMsVUFBVSxJQUFJO0FBQ3JCLFFBQUksVUFBVSxLQUFjLFNBQUEsS0FBSyx1RUFBdUU7QUFBQSxhQUFXLE1BQU0sYUFBYSxLQUFZLE9BQUEsV0FBVyxDQUFDLEVBQUU7QUFBQSxRQUFPLE9BQU0sU0FBUyxLQUFLLEVBQUU7QUFDdEwsV0FBQTtBQUFBLEVBQ1Q7QUE0RUEsV0FBUyxhQUFhLE1BQU0sT0FBTztBQUNqQyxVQUFNLElBQUksa0JBQWtCLE1BQU0sUUFBUSxNQUFNO0FBQzlDLGFBQU8sT0FBTyxNQUFNO0FBQUEsUUFDbEIsQ0FBQyxRQUFRLEdBQUc7QUFBQSxNQUFBLENBQ2I7QUFDRCxhQUFPLEtBQUssS0FBSztBQUFBLElBQUEsQ0FDbEIsR0FBRyxRQUFXLE1BQU0sQ0FBQztBQUN0QixNQUFFLFFBQVE7QUFDVixNQUFFLFlBQVk7QUFDZCxNQUFFLGdCQUFnQjtBQUNsQixNQUFFLE9BQU8sS0FBSztBQUNkLE1BQUUsWUFBWTtBQUNkLHNCQUFrQixDQUFDO0FBQ25CLFdBQU8sRUFBRSxXQUFXLFNBQVksRUFBRSxTQUFTLEVBQUU7QUFBQSxFQUMvQztBQUNBLFdBQVMsY0FBYyxPQUFPO0FBQzVCLFFBQUksT0FBTztBQUNULFVBQUksTUFBTSxVQUFpQixPQUFBLFVBQVUsS0FBSyxLQUFLO0FBQUEsVUFBTyxPQUFNLFlBQVksQ0FBQyxLQUFLO0FBQzlFLFlBQU0sUUFBUTtBQUFBLElBQUE7QUFBQSxFQUdsQjtBQXVEQSxXQUFTLGFBQWE7QUFFcEIsUUFBSSxLQUFLLFdBQThDLEtBQUssT0FBUTtBQUNsRSxVQUF1QyxLQUFLLFVBQVcseUJBQXlCLElBQUk7QUFBQSxXQUFPO0FBQ3pGLGNBQU0sVUFBVTtBQUNOLGtCQUFBO0FBQ1YsbUJBQVcsTUFBTSxhQUFhLElBQUksR0FBRyxLQUFLO0FBQ2hDLGtCQUFBO0FBQUEsTUFBQTtBQUFBLElBQ1o7QUFFRixRQUFJLFVBQVU7QUFDWixZQUFNLFFBQVEsS0FBSyxZQUFZLEtBQUssVUFBVSxTQUFTO0FBQ25ELFVBQUEsQ0FBQyxTQUFTLFNBQVM7QUFDWixpQkFBQSxVQUFVLENBQUMsSUFBSTtBQUNmLGlCQUFBLGNBQWMsQ0FBQyxLQUFLO0FBQUEsTUFBQSxPQUN4QjtBQUNJLGlCQUFBLFFBQVEsS0FBSyxJQUFJO0FBQ2pCLGlCQUFBLFlBQVksS0FBSyxLQUFLO0FBQUEsTUFBQTtBQUU3QixVQUFBLENBQUMsS0FBSyxXQUFXO0FBQ2QsYUFBQSxZQUFZLENBQUMsUUFBUTtBQUMxQixhQUFLLGdCQUFnQixDQUFDLFNBQVMsUUFBUSxTQUFTLENBQUM7QUFBQSxNQUFBLE9BQzVDO0FBQ0EsYUFBQSxVQUFVLEtBQUssUUFBUTtBQUM1QixhQUFLLGNBQWMsS0FBSyxTQUFTLFFBQVEsU0FBUyxDQUFDO0FBQUEsTUFBQTtBQUFBLElBQ3JEO0FBR0YsV0FBTyxLQUFLO0FBQUEsRUFDZDtBQUNBLFdBQVMsWUFBWSxNQUFNLE9BQU8sUUFBUTtBQUNwQyxRQUFBLFVBQTJGLEtBQUs7QUFDaEcsUUFBQSxDQUFDLEtBQUssY0FBYyxDQUFDLEtBQUssV0FBVyxTQUFTLEtBQUssR0FBRztXQVE1QyxRQUFRO0FBQ3BCLFVBQUksS0FBSyxhQUFhLEtBQUssVUFBVSxRQUFRO0FBQzNDLG1CQUFXLE1BQU07QUFDZixtQkFBUyxJQUFJLEdBQUcsSUFBSSxLQUFLLFVBQVUsUUFBUSxLQUFLLEdBQUc7QUFDM0Msa0JBQUEsSUFBSSxLQUFLLFVBQVUsQ0FBQztBQUNwQixrQkFBQSxvQkFBb0IsY0FBYyxXQUFXO0FBQ25ELGdCQUFJLHFCQUFxQixXQUFXLFNBQVMsSUFBSSxDQUFDLEVBQUc7QUFDckQsZ0JBQUksb0JBQW9CLENBQUMsRUFBRSxTQUFTLENBQUMsRUFBRSxPQUFPO0FBQzVDLGtCQUFJLEVBQUUsS0FBYyxTQUFBLEtBQUssQ0FBQztBQUFBLGtCQUFPLFNBQVEsS0FBSyxDQUFDO0FBQzNDLGtCQUFBLEVBQUUsVUFBVyxnQkFBZSxDQUFDO0FBQUEsWUFBQTtBQUUvQixnQkFBQSxDQUFDLGtCQUFtQixHQUFFLFFBQVE7QUFBQSxVQUFzQjtBQUV0RCxjQUFBLFFBQVEsU0FBUyxLQUFNO0FBQ3pCLHNCQUFVLENBQUM7QUFDWCxnQkFBSSxPQUFRLE9BQU0sSUFBSSxNQUFNLG1DQUFtQztBQUMvRCxrQkFBTSxJQUFJLE1BQU07QUFBQSxVQUFBO0FBQUEsV0FFakIsS0FBSztBQUFBLE1BQUE7QUFBQSxJQUNWO0FBRUssV0FBQTtBQUFBLEVBQ1Q7QUFDQSxXQUFTLGtCQUFrQixNQUFNO0FBQzNCLFFBQUEsQ0FBQyxLQUFLLEdBQUk7QUFDZCxjQUFVLElBQUk7QUFDZCxVQUFNLE9BQU87QUFDYixtQkFBZSxNQUF1RixLQUFLLE9BQU8sSUFBSTtBQUFBLEVBV3hIO0FBQ0EsV0FBUyxlQUFlLE1BQU0sT0FBTyxNQUFNO0FBQ3JDLFFBQUE7QUFDRSxVQUFBLFFBQVEsT0FDWixXQUFXO0FBQ2IsZUFBVyxRQUFRO0FBQ2YsUUFBQTtBQUNVLGtCQUFBLEtBQUssR0FBRyxLQUFLO0FBQUEsYUFDbEIsS0FBSztBQUNaLFVBQUksS0FBSyxNQUFNO0FBS047QUFDTCxlQUFLLFFBQVE7QUFDYixlQUFLLFNBQVMsS0FBSyxNQUFNLFFBQVEsU0FBUztBQUMxQyxlQUFLLFFBQVE7QUFBQSxRQUFBO0FBQUEsTUFDZjtBQUVGLFdBQUssWUFBWSxPQUFPO0FBQ3hCLGFBQU8sWUFBWSxHQUFHO0FBQUEsSUFBQSxVQUN0QjtBQUNXLGlCQUFBO0FBQ0gsY0FBQTtBQUFBLElBQUE7QUFFVixRQUFJLENBQUMsS0FBSyxhQUFhLEtBQUssYUFBYSxNQUFNO0FBQzdDLFVBQUksS0FBSyxhQUFhLFFBQVEsZUFBZSxNQUFNO0FBQ3JDLG9CQUFBLE1BQU0sU0FBZTtBQUFBLE1BQUEsWUFJdkIsUUFBUTtBQUNwQixXQUFLLFlBQVk7QUFBQSxJQUFBO0FBQUEsRUFFckI7QUFDQSxXQUFTLGtCQUFrQixJQUFJLE1BQU0sTUFBTSxRQUFRLE9BQU8sU0FBUztBQUNqRSxVQUFNLElBQUk7QUFBQSxNQUNSO0FBQUEsTUFDQTtBQUFBLE1BQ0EsV0FBVztBQUFBLE1BQ1gsT0FBTztBQUFBLE1BQ1AsU0FBUztBQUFBLE1BQ1QsYUFBYTtBQUFBLE1BQ2IsVUFBVTtBQUFBLE1BQ1YsT0FBTztBQUFBLE1BQ1AsT0FBTztBQUFBLE1BQ1AsU0FBUyxRQUFRLE1BQU0sVUFBVTtBQUFBLE1BQ2pDO0FBQUEsSUFDRjtBQUtBLFFBQUksVUFBVSxLQUFjLFNBQUEsS0FBSyxnRkFBZ0Y7QUFBQSxhQUFXLFVBQVUsU0FBUztBQUd0STtBQUNMLFlBQUksQ0FBQyxNQUFNLE1BQWEsT0FBQSxRQUFRLENBQUMsQ0FBQztBQUFBLFlBQU8sT0FBTSxNQUFNLEtBQUssQ0FBQztBQUFBLE1BQUE7QUFBQSxJQUM3RDtBQUVGLFFBQUksV0FBVyxRQUFRLEtBQU0sR0FBRSxPQUFPLFFBQVE7QUFldkMsV0FBQTtBQUFBLEVBQ1Q7QUFDQSxXQUFTLE9BQU8sTUFBTTtBQUVwQixRQUF1QyxLQUFLLFVBQVcsRUFBRztBQUNyRCxRQUFrQyxLQUFLLFVBQVcsUUFBUyxRQUFPLGFBQWEsSUFBSTtBQUN4RixRQUFJLEtBQUssWUFBWSxRQUFRLEtBQUssU0FBUyxVQUFVLEVBQUcsUUFBTyxLQUFLLFNBQVMsUUFBUSxLQUFLLElBQUk7QUFDeEYsVUFBQSxZQUFZLENBQUMsSUFBSTtBQUNmLFlBQUEsT0FBTyxLQUFLLFdBQVcsQ0FBQyxLQUFLLGFBQWEsS0FBSyxZQUFZLFlBQVk7QUFFN0UsVUFBc0MsS0FBSyxNQUFPLFdBQVUsS0FBSyxJQUFJO0FBQUEsSUFBQTtBQUV2RSxhQUFTLElBQUksVUFBVSxTQUFTLEdBQUcsS0FBSyxHQUFHLEtBQUs7QUFDOUMsYUFBTyxVQUFVLENBQUM7QUFRbEIsVUFBdUMsS0FBSyxVQUFXLE9BQU87QUFDNUQsMEJBQWtCLElBQUk7QUFBQSxpQkFDc0IsS0FBSyxVQUFXLFNBQVM7QUFDckUsY0FBTSxVQUFVO0FBQ04sa0JBQUE7QUFDVixtQkFBVyxNQUFNLGFBQWEsTUFBTSxVQUFVLENBQUMsQ0FBQyxHQUFHLEtBQUs7QUFDOUMsa0JBQUE7QUFBQSxNQUFBO0FBQUEsSUFDWjtBQUFBLEVBRUo7QUFDQSxXQUFTLFdBQVcsSUFBSSxNQUFNO0FBQ3hCLFFBQUEsZ0JBQWdCLEdBQUc7QUFDdkIsUUFBSSxPQUFPO0FBQ1AsUUFBQSxDQUFDLEtBQU0sV0FBVSxDQUFDO0FBQ3RCLFFBQUksUUFBZ0IsUUFBQTtBQUFBLG1CQUFvQixDQUFDO0FBQ3pDO0FBQ0ksUUFBQTtBQUNGLFlBQU0sTUFBTSxHQUFHO0FBQ2Ysc0JBQWdCLElBQUk7QUFDYixhQUFBO0FBQUEsYUFDQSxLQUFLO0FBQ1IsVUFBQSxDQUFDLEtBQWdCLFdBQUE7QUFDWCxnQkFBQTtBQUNWLGtCQUFZLEdBQUc7QUFBQSxJQUFBO0FBQUEsRUFFbkI7QUFDQSxXQUFTLGdCQUFnQixNQUFNO0FBQzdCLFFBQUksU0FBUztlQUM2RSxPQUFPO0FBQ3JGLGdCQUFBO0FBQUEsSUFBQTtBQUVaLFFBQUksS0FBTTtBQW1DVixVQUFNLElBQUk7QUFDQSxjQUFBO0FBQ1YsUUFBSSxFQUFFLE9BQVEsWUFBVyxNQUFNLFdBQVcsQ0FBQyxHQUFHLEtBQUs7QUFBQSxFQUVyRDtBQUNBLFdBQVMsU0FBUyxPQUFPO0FBQ2QsYUFBQSxJQUFJLEdBQUcsSUFBSSxNQUFNLFFBQVEsSUFBSyxRQUFPLE1BQU0sQ0FBQyxDQUFDO0FBQUEsRUFDeEQ7QUFrQkEsV0FBUyxlQUFlLE9BQU87QUFDN0IsUUFBSSxHQUNGLGFBQWE7QUFDZixTQUFLLElBQUksR0FBRyxJQUFJLE1BQU0sUUFBUSxLQUFLO0FBQzNCLFlBQUEsSUFBSSxNQUFNLENBQUM7QUFDakIsVUFBSSxDQUFDLEVBQUUsS0FBTSxRQUFPLENBQUM7QUFBQSxVQUFPLE9BQU0sWUFBWSxJQUFJO0FBQUEsSUFBQTtBQWUvQyxTQUFBLElBQUksR0FBRyxJQUFJLFlBQVksSUFBWSxRQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQUEsRUFDbEQ7QUFDQSxXQUFTLGFBQWEsTUFBTSxRQUFRO1NBRWUsUUFBUTtBQUN6RCxhQUFTLElBQUksR0FBRyxJQUFJLEtBQUssUUFBUSxRQUFRLEtBQUssR0FBRztBQUN6QyxZQUFBLFNBQVMsS0FBSyxRQUFRLENBQUM7QUFDN0IsVUFBSSxPQUFPLFNBQVM7QUFDbEIsY0FBTSxRQUE0QyxPQUFPO0FBQ3pELFlBQUksVUFBVSxPQUFPO0FBQ2YsY0FBQSxXQUFXLFdBQVcsQ0FBQyxPQUFPLGFBQWEsT0FBTyxZQUFZLFdBQVksUUFBTyxNQUFNO0FBQUEsUUFDbEYsV0FBQSxVQUFVLFFBQVMsY0FBYSxRQUFRLE1BQU07QUFBQSxNQUFBO0FBQUEsSUFDM0Q7QUFBQSxFQUVKO0FBQ0EsV0FBUyxlQUFlLE1BQU07QUFFNUIsYUFBUyxJQUFJLEdBQUcsSUFBSSxLQUFLLFVBQVUsUUFBUSxLQUFLLEdBQUc7QUFDM0MsWUFBQSxJQUFJLEtBQUssVUFBVSxDQUFDO0FBQzFCLFVBQW9DLENBQUMsRUFBRSxPQUFPO1VBQ0ssUUFBUTtBQUN6RCxZQUFJLEVBQUUsS0FBYyxTQUFBLEtBQUssQ0FBQztBQUFBLFlBQU8sU0FBUSxLQUFLLENBQUM7QUFDN0MsVUFBQSxhQUFhLGVBQWUsQ0FBQztBQUFBLE1BQUE7QUFBQSxJQUNqQztBQUFBLEVBRUo7QUFDQSxXQUFTLFVBQVUsTUFBTTtBQUNuQixRQUFBO0FBQ0osUUFBSSxLQUFLLFNBQVM7QUFDVCxhQUFBLEtBQUssUUFBUSxRQUFRO0FBQ3BCLGNBQUEsU0FBUyxLQUFLLFFBQVEsSUFBSSxHQUM5QixRQUFRLEtBQUssWUFBWSxJQUFBLEdBQ3pCLE1BQU0sT0FBTztBQUNYLFlBQUEsT0FBTyxJQUFJLFFBQVE7QUFDckIsZ0JBQU0sSUFBSSxJQUFJLElBQUEsR0FDWixJQUFJLE9BQU8sY0FBYyxJQUFJO0FBQzNCLGNBQUEsUUFBUSxJQUFJLFFBQVE7QUFDcEIsY0FBQSxZQUFZLENBQUMsSUFBSTtBQUNuQixnQkFBSSxLQUFLLElBQUk7QUFDTixtQkFBQSxjQUFjLEtBQUssSUFBSTtBQUFBLFVBQUE7QUFBQSxRQUNoQztBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBRUYsUUFBSSxLQUFLLFFBQVE7QUFDZixXQUFLLElBQUksS0FBSyxPQUFPLFNBQVMsR0FBRyxLQUFLLEdBQUcsSUFBZSxXQUFBLEtBQUssT0FBTyxDQUFDLENBQUM7QUFDdEUsYUFBTyxLQUFLO0FBQUEsSUFBQTtBQUlkLFFBQVcsS0FBSyxPQUFPO0FBQ3JCLFdBQUssSUFBSSxLQUFLLE1BQU0sU0FBUyxHQUFHLEtBQUssR0FBRyxJQUFlLFdBQUEsS0FBSyxNQUFNLENBQUMsQ0FBQztBQUNwRSxXQUFLLFFBQVE7QUFBQSxJQUFBO0FBRWYsUUFBSSxLQUFLLFVBQVU7QUFDWixXQUFBLElBQUksS0FBSyxTQUFTLFNBQVMsR0FBRyxLQUFLLEdBQUcsSUFBSyxNQUFLLFNBQVMsQ0FBQyxFQUFFO0FBQ2pFLFdBQUssV0FBVztBQUFBLElBQUE7U0FFOEMsUUFBUTtBQUN4RSxXQUFPLEtBQUs7QUFBQSxFQUNkO0FBVUEsV0FBUyxVQUFVLEtBQUs7QUFDbEIsUUFBQSxlQUFlLE1BQWMsUUFBQTtBQUNqQyxXQUFPLElBQUksTUFBTSxPQUFPLFFBQVEsV0FBVyxNQUFNLGlCQUFpQjtBQUFBLE1BQ2hFLE9BQU87QUFBQSxJQUFBLENBQ1I7QUFBQSxFQUNIO0FBUUEsV0FBUyxZQUFZLEtBQUssUUFBUSxPQUFPO0FBRWpDLFVBQUEsUUFBUSxVQUFVLEdBQUc7QUFDWCxVQUFBO0FBQUEsRUFPbEI7QUFnR0EsUUFBTSxXQUFXLE9BQU8sVUFBVTtBQUNsQyxXQUFTLFFBQVEsR0FBRztBQUNULGFBQUEsSUFBSSxHQUFHLElBQUksRUFBRSxRQUFRLElBQUssR0FBRSxDQUFDLEVBQUU7QUFBQSxFQUMxQztBQUNBLFdBQVMsU0FBUyxNQUFNLE9BQU8sVUFBVSxDQUFBLEdBQUk7QUFDM0MsUUFBSSxRQUFRLENBQUMsR0FDWCxTQUFTLElBQ1QsWUFBWSxDQUNaLEdBQUEsTUFBTSxHQUNOLFVBQVUsTUFBTSxTQUFTLElBQUksQ0FBSyxJQUFBO0FBQzFCLGNBQUEsTUFBTSxRQUFRLFNBQVMsQ0FBQztBQUNsQyxXQUFPLE1BQU07QUFDUCxVQUFBLFdBQVcsVUFBVSxJQUN2QixTQUFTLFNBQVMsUUFDbEIsR0FDQTtBQUNGLGVBQVMsTUFBTTtBQUNmLGFBQU8sUUFBUSxNQUFNO0FBQ25CLFlBQUksWUFBWSxnQkFBZ0IsTUFBTSxlQUFlLGFBQWEsT0FBTyxLQUFLLFFBQVE7QUFDdEYsWUFBSSxXQUFXLEdBQUc7QUFDaEIsY0FBSSxRQUFRLEdBQUc7QUFDYixvQkFBUSxTQUFTO0FBQ2pCLHdCQUFZLENBQUM7QUFDYixvQkFBUSxDQUFDO0FBQ1QscUJBQVMsQ0FBQztBQUNKLGtCQUFBO0FBQ04sd0JBQVksVUFBVTtVQUFDO0FBRXpCLGNBQUksUUFBUSxVQUFVO0FBQ3BCLG9CQUFRLENBQUMsUUFBUTtBQUNWLG1CQUFBLENBQUMsSUFBSSxXQUFXLENBQVksYUFBQTtBQUNqQyx3QkFBVSxDQUFDLElBQUk7QUFDZixxQkFBTyxRQUFRLFNBQVM7QUFBQSxZQUFBLENBQ3pCO0FBQ0ssa0JBQUE7QUFBQSxVQUFBO0FBQUEsUUFDUixXQUVPLFFBQVEsR0FBRztBQUNULG1CQUFBLElBQUksTUFBTSxNQUFNO0FBQ3pCLGVBQUssSUFBSSxHQUFHLElBQUksUUFBUSxLQUFLO0FBQ3JCLGtCQUFBLENBQUMsSUFBSSxTQUFTLENBQUM7QUFDZCxtQkFBQSxDQUFDLElBQUksV0FBVyxNQUFNO0FBQUEsVUFBQTtBQUV6QixnQkFBQTtBQUFBLFFBQUEsT0FDRDtBQUNFLGlCQUFBLElBQUksTUFBTSxNQUFNO0FBQ1AsMEJBQUEsSUFBSSxNQUFNLE1BQU07QUFDcEIsc0JBQUEsY0FBYyxJQUFJLE1BQU0sTUFBTTtBQUMxQyxlQUFLLFFBQVEsR0FBRyxNQUFNLEtBQUssSUFBSSxLQUFLLE1BQU0sR0FBRyxRQUFRLE9BQU8sTUFBTSxLQUFLLE1BQU0sU0FBUyxLQUFLLEdBQUcsUUFBUTtBQUN0RyxlQUFLLE1BQU0sTUFBTSxHQUFHLFNBQVMsU0FBUyxHQUFHLE9BQU8sU0FBUyxVQUFVLFNBQVMsTUFBTSxHQUFHLE1BQU0sU0FBUyxNQUFNLEdBQUcsT0FBTyxVQUFVO0FBQ3ZILGlCQUFBLE1BQU0sSUFBSSxPQUFPLEdBQUc7QUFDWCwwQkFBQSxNQUFNLElBQUksVUFBVSxHQUFHO0FBQ3JDLHdCQUFZLFlBQVksTUFBTSxJQUFJLFFBQVEsR0FBRztBQUFBLFVBQUE7QUFFL0MsMkNBQWlCLElBQUk7QUFDSiwyQkFBQSxJQUFJLE1BQU0sU0FBUyxDQUFDO0FBQ3JDLGVBQUssSUFBSSxRQUFRLEtBQUssT0FBTyxLQUFLO0FBQ2hDLG1CQUFPLFNBQVMsQ0FBQztBQUNiLGdCQUFBLFdBQVcsSUFBSSxJQUFJO0FBQ3ZCLDJCQUFlLENBQUMsSUFBSSxNQUFNLFNBQVksS0FBSztBQUNoQyx1QkFBQSxJQUFJLE1BQU0sQ0FBQztBQUFBLFVBQUE7QUFFeEIsZUFBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLEtBQUs7QUFDN0IsbUJBQU8sTUFBTSxDQUFDO0FBQ1YsZ0JBQUEsV0FBVyxJQUFJLElBQUk7QUFDbkIsZ0JBQUEsTUFBTSxVQUFhLE1BQU0sSUFBSTtBQUMxQixtQkFBQSxDQUFDLElBQUksT0FBTyxDQUFDO0FBQ0osNEJBQUEsQ0FBQyxJQUFJLFVBQVUsQ0FBQztBQUM5QiwwQkFBWSxZQUFZLENBQUMsSUFBSSxRQUFRLENBQUM7QUFDdEMsa0JBQUksZUFBZSxDQUFDO0FBQ1QseUJBQUEsSUFBSSxNQUFNLENBQUM7QUFBQSxZQUFBLE1BQ1AsV0FBQSxDQUFDLEVBQUU7QUFBQSxVQUFBO0FBRXRCLGVBQUssSUFBSSxPQUFPLElBQUksUUFBUSxLQUFLO0FBQy9CLGdCQUFJLEtBQUssTUFBTTtBQUNOLHFCQUFBLENBQUMsSUFBSSxLQUFLLENBQUM7QUFDUix3QkFBQSxDQUFDLElBQUksY0FBYyxDQUFDO0FBQzlCLGtCQUFJLFNBQVM7QUFDSCx3QkFBQSxDQUFDLElBQUksWUFBWSxDQUFDO0FBQ2xCLHdCQUFBLENBQUMsRUFBRSxDQUFDO0FBQUEsY0FBQTtBQUFBLFlBRVQsTUFBQSxRQUFPLENBQUMsSUFBSSxXQUFXLE1BQU07QUFBQSxVQUFBO0FBRXRDLG1CQUFTLE9BQU8sTUFBTSxHQUFHLE1BQU0sTUFBTTtBQUM3QixrQkFBQSxTQUFTLE1BQU0sQ0FBQztBQUFBLFFBQUE7QUFFbkIsZUFBQTtBQUFBLE1BQUEsQ0FDUjtBQUNELGVBQVMsT0FBTyxVQUFVO0FBQ3hCLGtCQUFVLENBQUMsSUFBSTtBQUNmLFlBQUksU0FBUztBQUNYLGdCQUFNLENBQUMsR0FBRyxHQUFHLElBQUksYUFBYSxHQUFHO0FBQUEsWUFDL0IsTUFBTTtBQUFBLFVBQUEsQ0FDUDtBQUNELGtCQUFRLENBQUMsSUFBSTtBQUNiLGlCQUFPLE1BQU0sU0FBUyxDQUFDLEdBQUcsQ0FBQztBQUFBLFFBQUE7QUFFdEIsZUFBQSxNQUFNLFNBQVMsQ0FBQyxDQUFDO0FBQUEsTUFBQTtBQUFBLElBRTVCO0FBQUEsRUFDRjtBQXFFQSxXQUFTLGdCQUFnQixNQUFNLE9BQU87QUFVcEMsV0FBTyxhQUFhLE1BQU0sU0FBUyxFQUFFO0FBQUEsRUFDdkM7QUErTEEsUUFBTSxnQkFBZ0IsQ0FBUSxTQUFBLDRDQUE0QyxJQUFJO0FBQzlFLFdBQVMsSUFBSSxPQUFPO0FBQ1osVUFBQSxXQUFXLGNBQWMsU0FBUztBQUFBLE1BQ3RDLFVBQVUsTUFBTSxNQUFNO0FBQUEsSUFDeEI7QUFDTyxXQUFBLFdBQVcsU0FBUyxNQUFNLE1BQU0sTUFBTSxNQUFNLFVBQVUsWUFBWSxNQUFTLEdBQUcsUUFBVztBQUFBLE1BQzlGLE1BQU07QUFBQSxJQUFBLENBQ1A7QUFBQSxFQUNIO0FBU0EsV0FBUyxLQUFLLE9BQU87QUFDbkIsVUFBTSxRQUFRLE1BQU07QUFDcEIsVUFBTSxpQkFBaUIsV0FBVyxNQUFNLE1BQU0sTUFBTSxRQUFXO0FBQUEsTUFDN0QsTUFBTTtBQUFBLElBQUEsQ0FDTjtBQUNGLFVBQU0sWUFBWSxRQUFRLGlCQUFpQixXQUFXLGdCQUFnQixRQUFXO0FBQUEsTUFDL0UsUUFBUSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztBQUFBLE1BQzFCLE1BQU07QUFBQSxJQUFBLENBQ047QUFDRixXQUFPLFdBQVcsTUFBTTtBQUN0QixZQUFNLElBQUksVUFBVTtBQUNwQixVQUFJLEdBQUc7QUFDTCxjQUFNLFFBQVEsTUFBTTtBQUNwQixjQUFNLEtBQUssT0FBTyxVQUFVLGNBQWMsTUFBTSxTQUFTO0FBQ3pELGVBQU8sS0FBSyxRQUFRLE1BQU0sTUFBTSxRQUFRLElBQUksTUFBTTtBQUNoRCxjQUFJLENBQUMsUUFBUSxTQUFTLEVBQUcsT0FBTSxjQUFjLE1BQU07QUFDbkQsaUJBQU8sZUFBZTtBQUFBLFFBQ3ZCLENBQUEsQ0FBQyxJQUFJO0FBQUEsTUFBQTtBQUVSLGFBQU8sTUFBTTtBQUFBLE9BQ1osUUFBVztBQUFBLE1BQ1osTUFBTTtBQUFBLElBQUEsQ0FDTjtBQUFBLEVBQ0o7QUE4T0EsTUFBSSxZQUFZO0FBQ2QsUUFBSSxDQUFDLFdBQVcsUUFBUyxZQUFXLFVBQVU7QUFBQSxRQUFVLFNBQVEsS0FBSyx1RkFBdUY7QUFBQSxFQUM5SjtBQzlyREEsUUFBTSxPQUFPLENBQUEsT0FBTSxXQUFXLE1BQU0sSUFBSTtBQUV4QyxXQUFTLGdCQUFnQixZQUFZLEdBQUcsR0FBRztBQUN6QyxRQUFJLFVBQVUsRUFBRSxRQUNkLE9BQU8sRUFBRSxRQUNULE9BQU8sU0FDUCxTQUFTLEdBQ1QsU0FBUyxHQUNULFFBQVEsRUFBRSxPQUFPLENBQUMsRUFBRSxhQUNwQixNQUFNO0FBQ0QsV0FBQSxTQUFTLFFBQVEsU0FBUyxNQUFNO0FBQ3JDLFVBQUksRUFBRSxNQUFNLE1BQU0sRUFBRSxNQUFNLEdBQUc7QUFDM0I7QUFDQTtBQUNBO0FBQUEsTUFBQTtBQUVGLGFBQU8sRUFBRSxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHO0FBQ2xDO0FBQ0E7QUFBQSxNQUFBO0FBRUYsVUFBSSxTQUFTLFFBQVE7QUFDbkIsY0FBTSxPQUFPLE9BQU8sVUFBVSxTQUFTLEVBQUUsU0FBUyxDQUFDLEVBQUUsY0FBYyxFQUFFLE9BQU8sTUFBTSxJQUFJO0FBQ3RGLGVBQU8sU0FBUyxLQUFNLFlBQVcsYUFBYSxFQUFFLFFBQVEsR0FBRyxJQUFJO0FBQUEsTUFBQSxXQUN0RCxTQUFTLFFBQVE7QUFDMUIsZUFBTyxTQUFTLE1BQU07QUFDcEIsY0FBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRyxHQUFFLE1BQU0sRUFBRSxPQUFPO0FBQ2xEO0FBQUEsUUFBQTtBQUFBLE1BRU8sV0FBQSxFQUFFLE1BQU0sTUFBTSxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsTUFBTSxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUc7QUFDakUsY0FBTSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUU7QUFDdkIsbUJBQVcsYUFBYSxFQUFFLFFBQVEsR0FBRyxFQUFFLFFBQVEsRUFBRSxXQUFXO0FBQzVELG1CQUFXLGFBQWEsRUFBRSxFQUFFLElBQUksR0FBRyxJQUFJO0FBQ3JDLFVBQUEsSUFBSSxJQUFJLEVBQUUsSUFBSTtBQUFBLE1BQUEsT0FDWDtBQUNMLFlBQUksQ0FBQyxLQUFLO0FBQ1Isb0NBQVUsSUFBSTtBQUNkLGNBQUksSUFBSTtBQUNSLGlCQUFPLElBQUksS0FBTSxLQUFJLElBQUksRUFBRSxDQUFDLEdBQUcsR0FBRztBQUFBLFFBQUE7QUFFcEMsY0FBTSxRQUFRLElBQUksSUFBSSxFQUFFLE1BQU0sQ0FBQztBQUMvQixZQUFJLFNBQVMsTUFBTTtBQUNiLGNBQUEsU0FBUyxTQUFTLFFBQVEsTUFBTTtBQUM5QixnQkFBQSxJQUFJLFFBQ04sV0FBVyxHQUNYO0FBQ0YsbUJBQU8sRUFBRSxJQUFJLFFBQVEsSUFBSSxNQUFNO0FBQ3hCLG1CQUFBLElBQUksSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sUUFBUSxNQUFNLFFBQVEsU0FBVTtBQUMzRDtBQUFBLFlBQUE7QUFFRSxnQkFBQSxXQUFXLFFBQVEsUUFBUTtBQUN2QixvQkFBQSxPQUFPLEVBQUUsTUFBTTtBQUNyQixxQkFBTyxTQUFTLE1BQU8sWUFBVyxhQUFhLEVBQUUsUUFBUSxHQUFHLElBQUk7QUFBQSxZQUFBLGtCQUNoRCxhQUFhLEVBQUUsUUFBUSxHQUFHLEVBQUUsUUFBUSxDQUFDO0FBQUEsVUFDbEQsTUFBQTtBQUFBLFFBQ0YsTUFBQSxHQUFFLFFBQVEsRUFBRSxPQUFPO0FBQUEsTUFBQTtBQUFBLElBQzVCO0FBQUEsRUFFSjtBQUVBLFFBQU0sV0FBVztBQUNqQixXQUFTLE9BQU8sTUFBTSxTQUFTLE1BQU0sVUFBVSxDQUFBLEdBQUk7QUFDakQsUUFBSSxDQUFDLFNBQVM7QUFDTixZQUFBLElBQUksTUFBTSwyR0FBMkc7QUFBQSxJQUFBO0FBRXpILFFBQUE7QUFDSixlQUFXLENBQVdDLGFBQUE7QUFDVCxpQkFBQUE7QUFDQyxrQkFBQSxXQUFXLEtBQUssSUFBSSxPQUFPLFNBQVMsS0FBSyxHQUFHLFFBQVEsYUFBYSxPQUFPLFFBQVcsSUFBSTtBQUFBLElBQUEsR0FDbEcsUUFBUSxLQUFLO0FBQ2hCLFdBQU8sTUFBTTtBQUNGLGVBQUE7QUFDVCxjQUFRLGNBQWM7QUFBQSxJQUN4QjtBQUFBLEVBQ0Y7QUFDQSxXQUFTLFNBQVMsTUFBTSxjQUFjLE9BQU8sVUFBVTtBQUNqRCxRQUFBO0FBQ0osVUFBTSxTQUFTLE1BQU07QUFFYixZQUFBLElBQTRGLFNBQVMsY0FBYyxVQUFVO0FBQ25JLFFBQUUsWUFBWTtBQUNQLGFBQW9FLEVBQUUsUUFBUTtBQUFBLElBQ3ZGO0FBQ00sVUFBQSxLQUFnRyxPQUFPLFNBQVMsT0FBTyxXQUFXLFVBQVUsSUFBSTtBQUN0SixPQUFHLFlBQVk7QUFDUixXQUFBO0FBQUEsRUFDVDtBQUNBLFdBQVMsZUFBZSxZQUFZQyxZQUFXLE9BQU8sVUFBVTtBQUN4RCxVQUFBLElBQUlBLFVBQVMsUUFBUSxNQUFNQSxVQUFTLFFBQVEsd0JBQVE7QUFDMUQsYUFBUyxJQUFJLEdBQUcsSUFBSSxXQUFXLFFBQVEsSUFBSSxHQUFHLEtBQUs7QUFDM0MsWUFBQSxPQUFPLFdBQVcsQ0FBQztBQUN6QixVQUFJLENBQUMsRUFBRSxJQUFJLElBQUksR0FBRztBQUNoQixVQUFFLElBQUksSUFBSTtBQUNWQSxrQkFBUyxpQkFBaUIsTUFBTSxZQUFZO0FBQUEsTUFBQTtBQUFBLElBQzlDO0FBQUEsRUFFSjtBQVdBLFdBQVMsYUFBYSxNQUFNLE1BQU0sT0FBTztBQUV2QyxRQUFJLFNBQVMsS0FBVyxNQUFBLGdCQUFnQixJQUFJO0FBQUEsUUFBTyxNQUFLLGFBQWEsTUFBTSxLQUFLO0FBQUEsRUFDbEY7QUFTQSxXQUFTLFVBQVUsTUFBTSxPQUFPO0FBRTlCLFFBQUksU0FBUyxLQUFXLE1BQUEsZ0JBQWdCLE9BQU87QUFBQSxjQUFZLFlBQVk7QUFBQSxFQUN6RTtBQUNBLFdBQVNDLG1CQUFpQixNQUFNLE1BQU0sU0FBUyxVQUFVO0FBQ3pDO0FBQ1IsVUFBQSxNQUFNLFFBQVEsT0FBTyxHQUFHO0FBQzFCLGFBQUssS0FBSyxJQUFJLEVBQUUsSUFBSSxRQUFRLENBQUM7QUFDN0IsYUFBSyxLQUFLLElBQUksTUFBTSxJQUFJLFFBQVEsQ0FBQztBQUFBLE1BQzVCLE1BQUEsTUFBSyxLQUFLLElBQUksRUFBRSxJQUFJO0FBQUEsSUFBQTtBQUFBLEVBSy9CO0FBNERBLFdBQVMsSUFBSSxJQUFJLFNBQVMsS0FBSztBQUM3QixXQUFPLFFBQVEsTUFBTSxHQUFHLFNBQVMsR0FBRyxDQUFDO0FBQUEsRUFDdkM7QUFDQSxXQUFTLE9BQU8sUUFBUSxVQUFVLFFBQVEsU0FBUztBQUNqRCxRQUFJLFdBQVcsVUFBYSxDQUFDLG1CQUFtQixDQUFDO0FBQzdDLFFBQUEsT0FBTyxhQUFhLFdBQVksUUFBTyxpQkFBaUIsUUFBUSxVQUFVLFNBQVMsTUFBTTtBQUMxRSx1QkFBQSxDQUFBLFlBQVcsaUJBQWlCLFFBQVEsU0FBQSxHQUFZLFNBQVMsTUFBTSxHQUFHLE9BQU87QUFBQSxFQUM5RjtBQXNKQSxXQUFTLGFBQWEsR0FBRztBQUl2QixRQUFJLE9BQU8sRUFBRTtBQUNQLFVBQUEsTUFBTSxLQUFLLEVBQUUsSUFBSTtBQUN2QixVQUFNLFlBQVksRUFBRTtBQUNwQixVQUFNLG1CQUFtQixFQUFFO0FBQzNCLFVBQU0sV0FBVyxDQUFBLFVBQVMsT0FBTyxlQUFlLEdBQUcsVUFBVTtBQUFBLE1BQzNELGNBQWM7QUFBQSxNQUNkO0FBQUEsSUFBQSxDQUNEO0FBQ0QsVUFBTSxhQUFhLE1BQU07QUFDakIsWUFBQSxVQUFVLEtBQUssR0FBRztBQUNwQixVQUFBLFdBQVcsQ0FBQyxLQUFLLFVBQVU7QUFDN0IsY0FBTSxPQUFPLEtBQUssR0FBRyxHQUFHLE1BQU07QUFDckIsaUJBQUEsU0FBWSxRQUFRLEtBQUssTUFBTSxNQUFNLENBQUMsSUFBSSxRQUFRLEtBQUssTUFBTSxDQUFDO0FBQ3ZFLFlBQUksRUFBRSxhQUFjO0FBQUEsTUFBQTtBQUV0QixXQUFLLFFBQVEsT0FBTyxLQUFLLFNBQVMsWUFBWSxDQUFDLEtBQUssS0FBSyxVQUFVLEtBQUssU0FBUyxFQUFFLE1BQU0sS0FBSyxTQUFTLEtBQUssSUFBSTtBQUN6RyxhQUFBO0FBQUEsSUFDVDtBQUNBLFVBQU0sYUFBYSxNQUFNO0FBQ2hCLGFBQUEsV0FBQSxNQUFpQixPQUFPLEtBQUssVUFBVSxLQUFLLGNBQWMsS0FBSyxNQUFNO0FBQUEsSUFDOUU7QUFDTyxXQUFBLGVBQWUsR0FBRyxpQkFBaUI7QUFBQSxNQUN4QyxjQUFjO0FBQUEsTUFDZCxNQUFNO0FBQ0osZUFBTyxRQUFRO0FBQUEsTUFBQTtBQUFBLElBQ2pCLENBQ0Q7QUFFRCxRQUFJLEVBQUUsY0FBYztBQUNaLFlBQUEsT0FBTyxFQUFFLGFBQWE7QUFDbkIsZUFBQSxLQUFLLENBQUMsQ0FBQztBQUNoQixlQUFTLElBQUksR0FBRyxJQUFJLEtBQUssU0FBUyxHQUFHLEtBQUs7QUFDeEMsZUFBTyxLQUFLLENBQUM7QUFDVCxZQUFBLENBQUMsYUFBYztBQUNuQixZQUFJLEtBQUssUUFBUTtBQUNmLGlCQUFPLEtBQUs7QUFDRCxxQkFBQTtBQUNYO0FBQUEsUUFBQTtBQUVFLFlBQUEsS0FBSyxlQUFlLGtCQUFrQjtBQUN4QztBQUFBLFFBQUE7QUFBQSxNQUNGO0FBQUEsVUFHWSxZQUFBO0FBQ2hCLGFBQVMsU0FBUztBQUFBLEVBQ3BCO0FBQ0EsV0FBUyxpQkFBaUIsUUFBUSxPQUFPLFNBQVMsUUFBUSxhQUFhO0FBV3JFLFdBQU8sT0FBTyxZQUFZLFdBQVksV0FBVSxRQUFRO0FBQ3BELFFBQUEsVUFBVSxRQUFnQixRQUFBO0FBQzlCLFVBQU0sSUFBSSxPQUFPLE9BQ2YsUUFBUSxXQUFXO0FBQ3JCLGFBQVMsU0FBUyxRQUFRLENBQUMsS0FBSyxRQUFRLENBQUMsRUFBRSxjQUFjO0FBQ3JELFFBQUEsTUFBTSxZQUFZLE1BQU0sVUFBVTtBQUVwQyxVQUFJLE1BQU0sVUFBVTtBQUNsQixnQkFBUSxNQUFNLFNBQVM7QUFDbkIsWUFBQSxVQUFVLFFBQWdCLFFBQUE7QUFBQSxNQUFBO0FBRWhDLFVBQUksT0FBTztBQUNMLFlBQUEsT0FBTyxRQUFRLENBQUM7QUFDaEIsWUFBQSxRQUFRLEtBQUssYUFBYSxHQUFHO0FBQzFCLGVBQUEsU0FBUyxVQUFVLEtBQUssT0FBTztBQUFBLFFBQy9CLE1BQUEsUUFBTyxTQUFTLGVBQWUsS0FBSztBQUMzQyxrQkFBVSxjQUFjLFFBQVEsU0FBUyxRQUFRLElBQUk7QUFBQSxNQUFBLE9BQ2hEO0FBQ0wsWUFBSSxZQUFZLE1BQU0sT0FBTyxZQUFZLFVBQVU7QUFDdkMsb0JBQUEsT0FBTyxXQUFXLE9BQU87QUFBQSxRQUFBLE1BQ3BCLFdBQUEsT0FBTyxjQUFjO0FBQUEsTUFBQTtBQUFBLElBRS9CLFdBQUEsU0FBUyxRQUFRLE1BQU0sV0FBVztBQUVqQyxnQkFBQSxjQUFjLFFBQVEsU0FBUyxNQUFNO0FBQUEsSUFBQSxXQUN0QyxNQUFNLFlBQVk7QUFDM0IseUJBQW1CLE1BQU07QUFDdkIsWUFBSSxJQUFJLE1BQU07QUFDZCxlQUFPLE9BQU8sTUFBTSxXQUFZLEtBQUksRUFBRTtBQUN0QyxrQkFBVSxpQkFBaUIsUUFBUSxHQUFHLFNBQVMsTUFBTTtBQUFBLE1BQUEsQ0FDdEQ7QUFDRCxhQUFPLE1BQU07QUFBQSxJQUNKLFdBQUEsTUFBTSxRQUFRLEtBQUssR0FBRztBQUMvQixZQUFNLFFBQVEsQ0FBQztBQUNmLFlBQU0sZUFBZSxXQUFXLE1BQU0sUUFBUSxPQUFPO0FBQ3JELFVBQUksdUJBQXVCLE9BQU8sT0FBTyxTQUFTLFdBQVcsR0FBRztBQUMzQywyQkFBQSxNQUFNLFVBQVUsaUJBQWlCLFFBQVEsT0FBTyxTQUFTLFFBQVEsSUFBSSxDQUFDO0FBQ3pGLGVBQU8sTUFBTTtBQUFBLE1BQUE7QUFXWCxVQUFBLE1BQU0sV0FBVyxHQUFHO0FBQ1osa0JBQUEsY0FBYyxRQUFRLFNBQVMsTUFBTTtBQUMvQyxZQUFJLE1BQWMsUUFBQTtBQUFBLGlCQUNULGNBQWM7QUFDbkIsWUFBQSxRQUFRLFdBQVcsR0FBRztBQUNaLHNCQUFBLFFBQVEsT0FBTyxNQUFNO0FBQUEsUUFDNUIsTUFBQSxpQkFBZ0IsUUFBUSxTQUFTLEtBQUs7QUFBQSxNQUFBLE9BQ3hDO0FBQ0wsbUJBQVcsY0FBYyxNQUFNO0FBQy9CLG9CQUFZLFFBQVEsS0FBSztBQUFBLE1BQUE7QUFFakIsZ0JBQUE7QUFBQSxJQUFBLFdBQ0QsTUFBTSxVQUFVO0FBRXJCLFVBQUEsTUFBTSxRQUFRLE9BQU8sR0FBRztBQUMxQixZQUFJLE1BQWMsUUFBQSxVQUFVLGNBQWMsUUFBUSxTQUFTLFFBQVEsS0FBSztBQUMxRCxzQkFBQSxRQUFRLFNBQVMsTUFBTSxLQUFLO0FBQUEsTUFBQSxXQUNqQyxXQUFXLFFBQVEsWUFBWSxNQUFNLENBQUMsT0FBTyxZQUFZO0FBQ2xFLGVBQU8sWUFBWSxLQUFLO0FBQUEsTUFDbkIsTUFBQSxRQUFPLGFBQWEsT0FBTyxPQUFPLFVBQVU7QUFDekMsZ0JBQUE7QUFBQSxJQUNMLE1BQUEsU0FBUSxLQUFLLHlDQUF5QyxLQUFLO0FBQzNELFdBQUE7QUFBQSxFQUNUO0FBQ0EsV0FBUyx1QkFBdUIsWUFBWSxPQUFPLFNBQVMsUUFBUTtBQUNsRSxRQUFJLFVBQVU7QUFDZCxhQUFTLElBQUksR0FBRyxNQUFNLE1BQU0sUUFBUSxJQUFJLEtBQUssS0FBSztBQUM1QyxVQUFBLE9BQU8sTUFBTSxDQUFDLEdBQ2hCLE9BQU8sV0FBVyxRQUFRLFdBQVcsTUFBTSxHQUMzQztBQUNGLFVBQUksUUFBUSxRQUFRLFNBQVMsUUFBUSxTQUFTLE1BQU87QUFBQSxnQkFBWSxJQUFJLE9BQU8sVUFBVSxZQUFZLEtBQUssVUFBVTtBQUMvRyxtQkFBVyxLQUFLLElBQUk7QUFBQSxNQUNYLFdBQUEsTUFBTSxRQUFRLElBQUksR0FBRztBQUM5QixrQkFBVSx1QkFBdUIsWUFBWSxNQUFNLElBQUksS0FBSztBQUFBLE1BQUEsV0FDbkQsTUFBTSxZQUFZO0FBQzNCLFlBQUksUUFBUTtBQUNWLGlCQUFPLE9BQU8sU0FBUyxXQUFZLFFBQU8sS0FBSztBQUMvQyxvQkFBVSx1QkFBdUIsWUFBWSxNQUFNLFFBQVEsSUFBSSxJQUFJLE9BQU8sQ0FBQyxJQUFJLEdBQUcsTUFBTSxRQUFRLElBQUksSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUs7QUFBQSxRQUFBLE9BQ3JIO0FBQ0wscUJBQVcsS0FBSyxJQUFJO0FBQ1Ysb0JBQUE7QUFBQSxRQUFBO0FBQUEsTUFDWixPQUNLO0FBQ0MsY0FBQSxRQUFRLE9BQU8sSUFBSTtBQUNyQixZQUFBLFFBQVEsS0FBSyxhQUFhLEtBQUssS0FBSyxTQUFTLE1BQWtCLFlBQUEsS0FBSyxJQUFJO0FBQUEsWUFBa0IsWUFBQSxLQUFLLFNBQVMsZUFBZSxLQUFLLENBQUM7QUFBQSxNQUFBO0FBQUEsSUFDbkk7QUFFSyxXQUFBO0FBQUEsRUFDVDtBQUNBLFdBQVMsWUFBWSxRQUFRLE9BQU8sU0FBUyxNQUFNO0FBQ2pELGFBQVMsSUFBSSxHQUFHLE1BQU0sTUFBTSxRQUFRLElBQUksS0FBSyxJQUFZLFFBQUEsYUFBYSxNQUFNLENBQUMsR0FBRyxNQUFNO0FBQUEsRUFDeEY7QUFDQSxXQUFTLGNBQWMsUUFBUSxTQUFTLFFBQVEsYUFBYTtBQUMzRCxRQUFJLFdBQVcsT0FBa0IsUUFBQSxPQUFPLGNBQWM7QUFDdEQsVUFBTSxPQUFPLGVBQWUsU0FBUyxlQUFlLEVBQUU7QUFDdEQsUUFBSSxRQUFRLFFBQVE7QUFDbEIsVUFBSSxXQUFXO0FBQ2YsZUFBUyxJQUFJLFFBQVEsU0FBUyxHQUFHLEtBQUssR0FBRyxLQUFLO0FBQ3RDLGNBQUEsS0FBSyxRQUFRLENBQUM7QUFDcEIsWUFBSSxTQUFTLElBQUk7QUFDVCxnQkFBQSxXQUFXLEdBQUcsZUFBZTtBQUNuQyxjQUFJLENBQUMsWUFBWSxDQUFDLEVBQWMsWUFBQSxPQUFPLGFBQWEsTUFBTSxFQUFFLElBQUksT0FBTyxhQUFhLE1BQU0sTUFBTTtBQUFBLGNBQU8sYUFBWSxHQUFHLE9BQU87QUFBQSxjQUM3RyxZQUFBO0FBQUEsTUFBQTtBQUFBLElBRWYsTUFBQSxRQUFPLGFBQWEsTUFBTSxNQUFNO0FBQ3ZDLFdBQU8sQ0FBQyxJQUFJO0FBQUEsRUFDZDtBQ25rQk8sUUFBTUMsY0FBVSxzQkFBVyxZQUFYLG1CQUFvQixZQUFwQixtQkFBNkIsTUFDaEQsV0FBVyxVQUNYLFdBQVc7QUNGUixRQUFNLFVBQVVDOzs7Ozs7Ozs7QUNDdkIsUUFBSSxRQUFRO0FBRVosUUFBSUMsZ0NBQStCLFNBQVMsUUFBUTtBQUNuRCxhQUFPLE1BQU0sS0FBSyxNQUFNO0FBQUEsSUFDeEI7QUFFRCxxQ0FBaUJBOzs7OztBQ1JqQixNQUFJLFVBQVUsQ0FBQyxRQUFRLGFBQWEsY0FBYztBQUNoRCxXQUFPLElBQUksUUFBUSxDQUFDLFNBQVMsV0FBVztBQUN0QyxVQUFJLFlBQVksQ0FBQyxVQUFVO0FBQ3pCLFlBQUk7QUFDRixlQUFLLFVBQVUsS0FBSyxLQUFLLENBQUM7QUFBQSxRQUMzQixTQUFRLEdBQUc7QUFDVixpQkFBTyxDQUFDO0FBQUEsUUFDaEI7QUFBQSxNQUNLO0FBQ0QsVUFBSSxXQUFXLENBQUMsVUFBVTtBQUN4QixZQUFJO0FBQ0YsZUFBSyxVQUFVLE1BQU0sS0FBSyxDQUFDO0FBQUEsUUFDNUIsU0FBUSxHQUFHO0FBQ1YsaUJBQU8sQ0FBQztBQUFBLFFBQ2hCO0FBQUEsTUFDSztBQUNELFVBQUksT0FBTyxDQUFDLE1BQU0sRUFBRSxPQUFPLFFBQVEsRUFBRSxLQUFLLElBQUksUUFBUSxRQUFRLEVBQUUsS0FBSyxFQUFFLEtBQUssV0FBVyxRQUFRO0FBQy9GLFlBQU0sWUFBWSxVQUFVLE1BQU0sUUFBUSxXQUFXLEdBQUcsTUFBTTtBQUFBLElBQ2xFLENBQUc7QUFBQSxFQUNIO0FBSUEsV0FBUyxzQkFBc0IsU0FBUztBQUN0QyxXQUFPLFFBQVEsTUFBTSxNQUFNLGFBQWE7QUFDdEMsWUFBTSxFQUFFLE1BQU0sT0FBTyxVQUFVLEtBQUssZ0JBQWdCLE1BQUssSUFBSztBQUM5RCxVQUFJLENBQUMsNkJBQTZCLElBQUksR0FBRztBQUN2QyxjQUFNO0FBQUEsVUFDSixJQUFJLElBQUk7QUFBQSxRQUNUO0FBQUEsTUFDUDtBQUNJLFlBQU0sZ0JBQWdCLFNBQVMsY0FBYyxJQUFJO0FBQ2pELFlBQU0sU0FBUyxjQUFjLGFBQWEsRUFBRSxLQUFJLENBQUU7QUFDbEQsWUFBTSxrQkFBa0IsU0FBUyxjQUFjLE1BQU07QUFDckQsWUFBTSxPQUFPLFNBQVMsY0FBYyxNQUFNO0FBQzFDLFlBQU0sT0FBTyxTQUFTLGNBQWMsTUFBTTtBQUMxQyxVQUFJLEtBQUs7QUFDUCxjQUFNLFFBQVEsU0FBUyxjQUFjLE9BQU87QUFDNUMsWUFBSSxTQUFTLEtBQUs7QUFDaEIsZ0JBQU0sY0FBYyxNQUFNLE1BQU0sSUFBSSxHQUFHLEVBQUUsS0FBSyxDQUFDLFFBQVEsSUFBSSxLQUFJLENBQUU7QUFBQSxRQUN6RSxPQUFhO0FBQ0wsZ0JBQU0sY0FBYyxJQUFJO0FBQUEsUUFDaEM7QUFDTSxhQUFLLFlBQVksS0FBSztBQUFBLE1BQzVCO0FBQ0ksc0JBQWdCLFlBQVksSUFBSTtBQUNoQyxzQkFBZ0IsWUFBWSxJQUFJO0FBQ2hDLGFBQU8sWUFBWSxlQUFlO0FBQ2xDLFVBQUksZUFBZTtBQUNqQixjQUFNLGFBQWEsTUFBTSxRQUFRLGFBQWEsSUFBSSxnQkFBZ0IsQ0FBQyxXQUFXLFNBQVMsVUFBVTtBQUNqRyxtQkFBVyxRQUFRLENBQUMsY0FBYztBQUNoQyxlQUFLLGlCQUFpQixXQUFXLENBQUMsTUFBTSxFQUFFLGlCQUFpQjtBQUFBLFFBQ25FLENBQU87QUFBQSxNQUNQO0FBQ0ksYUFBTztBQUFBLFFBQ0w7QUFBQSxRQUNBO0FBQUEsUUFDQSxpQkFBaUI7QUFBQSxNQUNsQjtBQUFBLElBQ0wsQ0FBRztBQUFBLEVBQ0g7QUM1REEsUUFBTSxVQUFVLE9BQU8sTUFBTTtBQUU3QixNQUFJLGFBQWE7QUFBQSxFQUVGLE1BQU0sb0JBQW9CLElBQUk7QUFBQSxJQUM1QyxjQUFjO0FBQ2IsWUFBTztBQUVQLFdBQUssZ0JBQWdCLG9CQUFJLFFBQVM7QUFDbEMsV0FBSyxnQkFBZ0Isb0JBQUk7QUFDekIsV0FBSyxjQUFjLG9CQUFJLElBQUs7QUFFNUIsWUFBTSxDQUFDLEtBQUssSUFBSTtBQUNoQixVQUFJLFVBQVUsUUFBUSxVQUFVLFFBQVc7QUFDMUM7QUFBQSxNQUNIO0FBRUUsVUFBSSxPQUFPLE1BQU0sT0FBTyxRQUFRLE1BQU0sWUFBWTtBQUNqRCxjQUFNLElBQUksVUFBVSxPQUFPLFFBQVEsaUVBQWlFO0FBQUEsTUFDdkc7QUFFRSxpQkFBVyxDQUFDLE1BQU0sS0FBSyxLQUFLLE9BQU87QUFDbEMsYUFBSyxJQUFJLE1BQU0sS0FBSztBQUFBLE1BQ3ZCO0FBQUEsSUFDQTtBQUFBLElBRUMsZUFBZSxNQUFNLFNBQVMsT0FBTztBQUNwQyxVQUFJLENBQUMsTUFBTSxRQUFRLElBQUksR0FBRztBQUN6QixjQUFNLElBQUksVUFBVSxxQ0FBcUM7QUFBQSxNQUM1RDtBQUVFLFlBQU0sYUFBYSxLQUFLLGVBQWUsTUFBTSxNQUFNO0FBRW5ELFVBQUk7QUFDSixVQUFJLGNBQWMsS0FBSyxZQUFZLElBQUksVUFBVSxHQUFHO0FBQ25ELG9CQUFZLEtBQUssWUFBWSxJQUFJLFVBQVU7QUFBQSxNQUMzQyxXQUFVLFFBQVE7QUFDbEIsb0JBQVksQ0FBQyxHQUFHLElBQUk7QUFDcEIsYUFBSyxZQUFZLElBQUksWUFBWSxTQUFTO0FBQUEsTUFDN0M7QUFFRSxhQUFPLEVBQUMsWUFBWSxVQUFTO0FBQUEsSUFDL0I7QUFBQSxJQUVDLGVBQWUsTUFBTSxTQUFTLE9BQU87QUFDcEMsWUFBTSxjQUFjLENBQUU7QUFDdEIsZUFBUyxPQUFPLE1BQU07QUFDckIsWUFBSSxRQUFRLE1BQU07QUFDakIsZ0JBQU07QUFBQSxRQUNWO0FBRUcsY0FBTSxTQUFTLE9BQU8sUUFBUSxZQUFZLE9BQU8sUUFBUSxhQUFhLGtCQUFtQixPQUFPLFFBQVEsV0FBVyxrQkFBa0I7QUFFckksWUFBSSxDQUFDLFFBQVE7QUFDWixzQkFBWSxLQUFLLEdBQUc7QUFBQSxRQUNwQixXQUFVLEtBQUssTUFBTSxFQUFFLElBQUksR0FBRyxHQUFHO0FBQ2pDLHNCQUFZLEtBQUssS0FBSyxNQUFNLEVBQUUsSUFBSSxHQUFHLENBQUM7QUFBQSxRQUN0QyxXQUFVLFFBQVE7QUFDbEIsZ0JBQU0sYUFBYSxhQUFhLFlBQVk7QUFDNUMsZUFBSyxNQUFNLEVBQUUsSUFBSSxLQUFLLFVBQVU7QUFDaEMsc0JBQVksS0FBSyxVQUFVO0FBQUEsUUFDL0IsT0FBVTtBQUNOLGlCQUFPO0FBQUEsUUFDWDtBQUFBLE1BQ0E7QUFFRSxhQUFPLEtBQUssVUFBVSxXQUFXO0FBQUEsSUFDbkM7QUFBQSxJQUVDLElBQUksTUFBTSxPQUFPO0FBQ2hCLFlBQU0sRUFBQyxVQUFTLElBQUksS0FBSyxlQUFlLE1BQU0sSUFBSTtBQUNsRCxhQUFPLE1BQU0sSUFBSSxXQUFXLEtBQUs7QUFBQSxJQUNuQztBQUFBLElBRUMsSUFBSSxNQUFNO0FBQ1QsWUFBTSxFQUFDLFVBQVMsSUFBSSxLQUFLLGVBQWUsSUFBSTtBQUM1QyxhQUFPLE1BQU0sSUFBSSxTQUFTO0FBQUEsSUFDNUI7QUFBQSxJQUVDLElBQUksTUFBTTtBQUNULFlBQU0sRUFBQyxVQUFTLElBQUksS0FBSyxlQUFlLElBQUk7QUFDNUMsYUFBTyxNQUFNLElBQUksU0FBUztBQUFBLElBQzVCO0FBQUEsSUFFQyxPQUFPLE1BQU07QUFDWixZQUFNLEVBQUMsV0FBVyxXQUFVLElBQUksS0FBSyxlQUFlLElBQUk7QUFDeEQsYUFBTyxRQUFRLGFBQWEsTUFBTSxPQUFPLFNBQVMsS0FBSyxLQUFLLFlBQVksT0FBTyxVQUFVLENBQUM7QUFBQSxJQUM1RjtBQUFBLElBRUMsUUFBUTtBQUNQLFlBQU0sTUFBTztBQUNiLFdBQUssY0FBYyxNQUFPO0FBQzFCLFdBQUssWUFBWSxNQUFPO0FBQUEsSUFDMUI7QUFBQSxJQUVDLEtBQUssT0FBTyxXQUFXLElBQUk7QUFDMUIsYUFBTztBQUFBLElBQ1Q7QUFBQSxJQUVDLElBQUksT0FBTztBQUNWLGFBQU8sTUFBTTtBQUFBLElBQ2Y7QUFBQSxFQUNBO0FDdEdBLFdBQVMsY0FBYyxPQUFPO0FBQzVCLFFBQUksVUFBVSxRQUFRLE9BQU8sVUFBVSxVQUFVO0FBQy9DLGFBQU87QUFBQSxJQUNYO0FBQ0UsVUFBTSxZQUFZLE9BQU8sZUFBZSxLQUFLO0FBQzdDLFFBQUksY0FBYyxRQUFRLGNBQWMsT0FBTyxhQUFhLE9BQU8sZUFBZSxTQUFTLE1BQU0sTUFBTTtBQUNyRyxhQUFPO0FBQUEsSUFDWDtBQUNFLFFBQUksT0FBTyxZQUFZLE9BQU87QUFDNUIsYUFBTztBQUFBLElBQ1g7QUFDRSxRQUFJLE9BQU8sZUFBZSxPQUFPO0FBQy9CLGFBQU8sT0FBTyxVQUFVLFNBQVMsS0FBSyxLQUFLLE1BQU07QUFBQSxJQUNyRDtBQUNFLFdBQU87QUFBQSxFQUNUO0FBRUEsV0FBUyxNQUFNLFlBQVksVUFBVSxZQUFZLEtBQUssUUFBUTtBQUM1RCxRQUFJLENBQUMsY0FBYyxRQUFRLEdBQUc7QUFDNUIsYUFBTyxNQUFNLFlBQVksSUFBSSxXQUFXLE1BQU07QUFBQSxJQUNsRDtBQUNFLFVBQU0sU0FBUyxPQUFPLE9BQU8sQ0FBQSxHQUFJLFFBQVE7QUFDekMsZUFBVyxPQUFPLFlBQVk7QUFDNUIsVUFBSSxRQUFRLGVBQWUsUUFBUSxlQUFlO0FBQ2hEO0FBQUEsTUFDTjtBQUNJLFlBQU0sUUFBUSxXQUFXLEdBQUc7QUFDNUIsVUFBSSxVQUFVLFFBQVEsVUFBVSxRQUFRO0FBQ3RDO0FBQUEsTUFDTjtBQUNJLFVBQUksVUFBVSxPQUFPLFFBQVEsS0FBSyxPQUFPLFNBQVMsR0FBRztBQUNuRDtBQUFBLE1BQ047QUFDSSxVQUFJLE1BQU0sUUFBUSxLQUFLLEtBQUssTUFBTSxRQUFRLE9BQU8sR0FBRyxDQUFDLEdBQUc7QUFDdEQsZUFBTyxHQUFHLElBQUksQ0FBQyxHQUFHLE9BQU8sR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUFBLE1BQzdDLFdBQWUsY0FBYyxLQUFLLEtBQUssY0FBYyxPQUFPLEdBQUcsQ0FBQyxHQUFHO0FBQzdELGVBQU8sR0FBRyxJQUFJO0FBQUEsVUFDWjtBQUFBLFVBQ0EsT0FBTyxHQUFHO0FBQUEsV0FDVCxZQUFZLEdBQUcsU0FBUyxNQUFNLE1BQU0sSUFBSSxTQUFVO0FBQUEsVUFDbkQ7QUFBQSxRQUNEO0FBQUEsTUFDUCxPQUFXO0FBQ0wsZUFBTyxHQUFHLElBQUk7QUFBQSxNQUNwQjtBQUFBLElBQ0E7QUFDRSxXQUFPO0FBQUEsRUFDVDtBQUNBLFdBQVMsV0FBVyxRQUFRO0FBQzFCLFdBQU8sSUFBSTtBQUFBO0FBQUEsTUFFVCxXQUFXLE9BQU8sQ0FBQyxHQUFHLE1BQU0sTUFBTSxHQUFHLEdBQUcsSUFBSSxNQUFNLEdBQUcsQ0FBRSxDQUFBO0FBQUE7QUFBQSxFQUUzRDtBQUNBLFFBQU0sT0FBTyxXQUFZO0FDdER6QixRQUFNLFVBQVUsQ0FBQyxZQUFZO0FBQzNCLFdBQU8sWUFBWSxPQUFPLEVBQUUsWUFBWSxNQUFNLFFBQVEsUUFBUyxJQUFHLEVBQUUsWUFBWSxNQUFPO0FBQUEsRUFDekY7QUFDQSxRQUFNLGFBQWEsQ0FBQyxZQUFZO0FBQzlCLFdBQU8sWUFBWSxPQUFPLEVBQUUsWUFBWSxNQUFNLFFBQVEsS0FBTSxJQUFHLEVBQUUsWUFBWSxNQUFPO0FBQUEsRUFDdEY7QUNEQSxRQUFNLG9CQUFvQixPQUFPO0FBQUEsSUFDL0IsUUFBUSxXQUFXO0FBQUEsSUFDbkIsY0FBYztBQUFBLElBQ2QsVUFBVTtBQUFBLElBQ1YsZ0JBQWdCO0FBQUEsTUFDZCxXQUFXO0FBQUEsTUFDWCxTQUFTO0FBQUEsTUFDVCxZQUFZO0FBQUEsSUFDZDtBQUFBLElBQ0EsUUFBUTtBQUFBLElBQ1IsZUFBZTtBQUFBLEVBQ2pCO0FBQ0EsUUFBTSxlQUFlLENBQUMsaUJBQWlCLG1CQUFtQjtBQUNqRCxXQUFBLEtBQUssaUJBQWlCLGNBQWM7QUFBQSxFQUM3QztBQUVBLFFBQU0sYUFBYSxJQUFJLFlBQVk7QUFDbkMsV0FBUyxrQkFBa0IsaUJBQWlCO0FBQ3BDLFVBQUEsRUFBRSxtQkFBbUI7QUFDcEIsV0FBQSxDQUFDLFVBQVUsWUFBWTtBQUN0QixZQUFBO0FBQUEsUUFDSjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFBQSxJQUNFLGFBQWEsU0FBUyxjQUFjO0FBQ3hDLFlBQU0sa0JBQWtCO0FBQUEsUUFDdEI7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQ00sWUFBQSxnQkFBZ0IsV0FBVyxJQUFJLGVBQWU7QUFDcEQsVUFBSSxnQkFBZ0IsZUFBZTtBQUMxQixlQUFBO0FBQUEsTUFBQTtBQUVULFlBQU0sZ0JBQWdCLElBQUk7QUFBQTtBQUFBLFFBRXhCLE9BQU8sU0FBUyxXQUFXO0FBQ3pCLGNBQUksaUNBQVEsU0FBUztBQUNaLG1CQUFBLE9BQU8sT0FBTyxNQUFNO0FBQUEsVUFBQTtBQUU3QixnQkFBTSxXQUFXLElBQUk7QUFBQSxZQUNuQixPQUFPLGNBQWM7QUFDbkIseUJBQVcsS0FBSyxXQUFXO0FBQ3pCLG9CQUFJLGlDQUFRLFNBQVM7QUFDbkIsMkJBQVMsV0FBVztBQUNwQjtBQUFBLGdCQUFBO0FBRUksc0JBQUEsZ0JBQWdCLE1BQU0sY0FBYztBQUFBLGtCQUN4QztBQUFBLGtCQUNBO0FBQUEsa0JBQ0E7QUFBQSxrQkFDQTtBQUFBLGdCQUFBLENBQ0Q7QUFDRCxvQkFBSSxjQUFjLFlBQVk7QUFDNUIsMkJBQVMsV0FBVztBQUNwQiwwQkFBUSxjQUFjLE1BQU07QUFDNUI7QUFBQSxnQkFBQTtBQUFBLGNBQ0Y7QUFBQSxZQUNGO0FBQUEsVUFFSjtBQUNRLDJDQUFBO0FBQUEsWUFDTjtBQUFBLFlBQ0EsTUFBTTtBQUNKLHVCQUFTLFdBQVc7QUFDYixxQkFBQSxPQUFPLE9BQU8sTUFBTTtBQUFBLFlBQzdCO0FBQUEsWUFDQSxFQUFFLE1BQU0sS0FBSztBQUFBO0FBRVQsZ0JBQUEsZUFBZSxNQUFNLGNBQWM7QUFBQSxZQUN2QztBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFVBQUEsQ0FDRDtBQUNELGNBQUksYUFBYSxZQUFZO0FBQ3BCLG1CQUFBLFFBQVEsYUFBYSxNQUFNO0FBQUEsVUFBQTtBQUUzQixtQkFBQSxRQUFRLFFBQVEsY0FBYztBQUFBLFFBQUE7QUFBQSxNQUUzQyxFQUFFLFFBQVEsTUFBTTtBQUNkLG1CQUFXLE9BQU8sZUFBZTtBQUFBLE1BQUEsQ0FDbEM7QUFDVSxpQkFBQSxJQUFJLGlCQUFpQixhQUFhO0FBQ3RDLGFBQUE7QUFBQSxJQUNUO0FBQUEsRUFDRjtBQUNBLGlCQUFlLGNBQWM7QUFBQSxJQUMzQjtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQ0YsR0FBRztBQUNELFVBQU0sVUFBVSxnQkFBZ0IsY0FBYyxRQUFRLElBQUksT0FBTyxjQUFjLFFBQVE7QUFDaEYsV0FBQSxNQUFNLFNBQVMsT0FBTztBQUFBLEVBQy9CO0FBQ0EsUUFBTSxjQUFjLGtCQUFrQjtBQUFBLElBQ3BDLGdCQUFnQixrQkFBa0I7QUFBQSxFQUNwQyxDQUFDO0FDN0dELFdBQVNDLFFBQU0sV0FBVyxNQUFNO0FBRTlCLFFBQUksT0FBTyxLQUFLLENBQUMsTUFBTSxVQUFVO0FBQ3pCLFlBQUEsVUFBVSxLQUFLLE1BQU07QUFDM0IsYUFBTyxTQUFTLE9BQU8sSUFBSSxHQUFHLElBQUk7QUFBQSxJQUFBLE9BQzdCO0FBQ0UsYUFBQSxTQUFTLEdBQUcsSUFBSTtBQUFBLElBQUE7QUFBQSxFQUUzQjtBQUNPLFFBQU1DLFdBQVM7QUFBQSxJQUNwQixPQUFPLElBQUksU0FBU0QsUUFBTSxRQUFRLE9BQU8sR0FBRyxJQUFJO0FBQUEsSUFDaEQsS0FBSyxJQUFJLFNBQVNBLFFBQU0sUUFBUSxLQUFLLEdBQUcsSUFBSTtBQUFBLElBQzVDLE1BQU0sSUFBSSxTQUFTQSxRQUFNLFFBQVEsTUFBTSxHQUFHLElBQUk7QUFBQSxJQUM5QyxPQUFPLElBQUksU0FBU0EsUUFBTSxRQUFRLE9BQU8sR0FBRyxJQUFJO0FBQUEsRUFDbEQ7QUNSTyxXQUFTLGNBQWMsTUFBTSxtQkFBbUIsU0FBUzs7QUFDOUQsUUFBSSxRQUFRLGFBQWEsU0FBVTtBQUNuQyxRQUFJLFFBQVEsVUFBVSxLQUFNLE1BQUssTUFBTSxTQUFTLE9BQU8sUUFBUSxNQUFNO0FBQ3JFLFNBQUssTUFBTSxXQUFXO0FBQ3RCLFNBQUssTUFBTSxXQUFXO0FBQ3RCLFNBQUssTUFBTSxRQUFRO0FBQ25CLFNBQUssTUFBTSxTQUFTO0FBQ3BCLFNBQUssTUFBTSxVQUFVO0FBQ3JCLFFBQUksbUJBQW1CO0FBQ3JCLFVBQUksUUFBUSxhQUFhLFdBQVc7QUFDbEMsMEJBQWtCLE1BQU0sV0FBVztBQUNuQyxhQUFJRSxNQUFBLFFBQVEsY0FBUixnQkFBQUEsSUFBbUIsV0FBVztBQUNoQyw0QkFBa0IsTUFBTSxTQUFTO0FBQUEsWUFDOUIsbUJBQWtCLE1BQU0sTUFBTTtBQUNuQyxhQUFJQyxNQUFBLFFBQVEsY0FBUixnQkFBQUEsSUFBbUIsU0FBUztBQUM5Qiw0QkFBa0IsTUFBTSxRQUFRO0FBQUEsWUFDN0IsbUJBQWtCLE1BQU0sT0FBTztBQUFBLE1BQzFDLE9BQVc7QUFDTCwwQkFBa0IsTUFBTSxXQUFXO0FBQ25DLDBCQUFrQixNQUFNLE1BQU07QUFDOUIsMEJBQWtCLE1BQU0sU0FBUztBQUNqQywwQkFBa0IsTUFBTSxPQUFPO0FBQy9CLDBCQUFrQixNQUFNLFFBQVE7QUFBQSxNQUN0QztBQUFBLElBQ0E7QUFBQSxFQUNBO0FBQ08sV0FBUyxVQUFVLFNBQVM7QUFDakMsUUFBSSxRQUFRLFVBQVUsS0FBTSxRQUFPLFNBQVM7QUFDNUMsUUFBSSxXQUFXLE9BQU8sUUFBUSxXQUFXLGFBQWEsUUFBUSxXQUFXLFFBQVE7QUFDakYsUUFBSSxPQUFPLGFBQWEsVUFBVTtBQUNoQyxVQUFJLFNBQVMsV0FBVyxHQUFHLEdBQUc7QUFDNUIsY0FBTUMsVUFBUyxTQUFTO0FBQUEsVUFDdEI7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0EsWUFBWTtBQUFBLFVBQ1o7QUFBQSxRQUNEO0FBQ0QsZUFBT0EsUUFBTyxtQkFBbUI7QUFBQSxNQUN2QyxPQUFXO0FBQ0wsZUFBTyxTQUFTLGNBQWMsUUFBUSxLQUFLO0FBQUEsTUFDakQ7QUFBQSxJQUNBO0FBQ0UsV0FBTyxZQUFZO0FBQUEsRUFDckI7QUFDTyxXQUFTLFFBQVEsTUFBTSxTQUFTOztBQUNyQyxVQUFNLFNBQVMsVUFBVSxPQUFPO0FBQ2hDLFFBQUksVUFBVTtBQUNaLFlBQU07QUFBQSxRQUNKO0FBQUEsTUFDRDtBQUNILFlBQVEsUUFBUSxRQUFNO0FBQUEsTUFDcEIsS0FBSztBQUFBLE1BQ0wsS0FBSztBQUNILGVBQU8sT0FBTyxJQUFJO0FBQ2xCO0FBQUEsTUFDRixLQUFLO0FBQ0gsZUFBTyxRQUFRLElBQUk7QUFDbkI7QUFBQSxNQUNGLEtBQUs7QUFDSCxlQUFPLFlBQVksSUFBSTtBQUN2QjtBQUFBLE1BQ0YsS0FBSztBQUNILFNBQUFGLE1BQUEsT0FBTyxrQkFBUCxnQkFBQUEsSUFBc0IsYUFBYSxNQUFNLE9BQU87QUFDaEQ7QUFBQSxNQUNGLEtBQUs7QUFDSCxTQUFBQyxNQUFBLE9BQU8sa0JBQVAsZ0JBQUFBLElBQXNCLGFBQWEsTUFBTTtBQUN6QztBQUFBLE1BQ0Y7QUFDRSxnQkFBUSxPQUFPLFFBQVEsSUFBSTtBQUMzQjtBQUFBLElBQ047QUFBQSxFQUNBO0FBQ08sV0FBUyxxQkFBcUIsZUFBZSxTQUFTO0FBQzNELFFBQUksb0JBQW9CO0FBQ3hCLFVBQU0sZ0JBQWdCLE1BQU07QUFDMUIsNkRBQW1CO0FBQ25CLDBCQUFvQjtBQUFBLElBQ3JCO0FBQ0QsVUFBTSxRQUFRLE1BQU07QUFDbEIsb0JBQWMsTUFBTztBQUFBLElBQ3RCO0FBQ0QsVUFBTSxVQUFVLGNBQWM7QUFDOUIsVUFBTSxTQUFTLE1BQU07QUFDbkIsb0JBQWU7QUFDZixvQkFBYyxPQUFRO0FBQUEsSUFDdkI7QUFDRCxVQUFNLFlBQVksQ0FBQyxxQkFBcUI7QUFDdEMsVUFBSSxtQkFBbUI7QUFDckJGLGlCQUFPLEtBQUssMkJBQTJCO0FBQUEsTUFDN0M7QUFDSSwwQkFBb0I7QUFBQSxRQUNsQixFQUFFLE9BQU8sU0FBUyxjQUFlO0FBQUEsUUFDakM7QUFBQSxVQUNFLEdBQUc7QUFBQSxVQUNILEdBQUc7QUFBQSxRQUNYO0FBQUEsTUFDSztBQUFBLElBQ0Y7QUFDRCxXQUFPO0FBQUEsTUFDTDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0g7QUFDQSxXQUFTLFlBQVksYUFBYSxTQUFTO0FBQ3pDLFVBQU0sa0JBQWtCLElBQUksZ0JBQWlCO0FBQzdDLFVBQU0sdUJBQXVCO0FBQzdCLFVBQU0saUJBQWlCLE1BQU07O0FBQzNCLHNCQUFnQixNQUFNLG9CQUFvQjtBQUMxQyxPQUFBQyxNQUFBLFFBQVEsV0FBUixnQkFBQUEsSUFBQTtBQUFBLElBQ0Q7QUFDRCxRQUFJLGlCQUFpQixPQUFPLFFBQVEsV0FBVyxhQUFhLFFBQVEsV0FBVyxRQUFRO0FBQ3ZGLFFBQUksMEJBQTBCLFNBQVM7QUFDckMsWUFBTTtBQUFBLFFBQ0o7QUFBQSxNQUNEO0FBQUEsSUFDTDtBQUNFLG1CQUFlLGVBQWUsVUFBVTtBQUN0QyxVQUFJLGdCQUFnQixDQUFDLENBQUMsVUFBVSxPQUFPO0FBQ3ZDLFVBQUksZUFBZTtBQUNqQixvQkFBWSxNQUFPO0FBQUEsTUFDekI7QUFDSSxhQUFPLENBQUMsZ0JBQWdCLE9BQU8sU0FBUztBQUN0QyxZQUFJO0FBQ0YsZ0JBQU0sZ0JBQWdCLE1BQU0sWUFBWSxZQUFZLFFBQVE7QUFBQSxZQUMxRCxlQUFlLE1BQU0sVUFBVSxPQUFPLEtBQUs7QUFBQSxZQUMzQyxVQUFVLGdCQUFnQkcsYUFBaUJDO0FBQUFBLFlBQzNDLFFBQVEsZ0JBQWdCO0FBQUEsVUFDbEMsQ0FBUztBQUNELDBCQUFnQixDQUFDLENBQUM7QUFDbEIsY0FBSSxlQUFlO0FBQ2pCLHdCQUFZLE1BQU87QUFBQSxVQUM3QixPQUFlO0FBQ0wsd0JBQVksUUFBUztBQUNyQixnQkFBSSxRQUFRLE1BQU07QUFDaEIsMEJBQVksY0FBZTtBQUFBLFlBQ3ZDO0FBQUEsVUFDQTtBQUFBLFFBQ08sU0FBUSxPQUFPO0FBQ2QsY0FBSSxnQkFBZ0IsT0FBTyxXQUFXLGdCQUFnQixPQUFPLFdBQVcsc0JBQXNCO0FBQzVGO0FBQUEsVUFDVixPQUFlO0FBQ0wsa0JBQU07QUFBQSxVQUNoQjtBQUFBLFFBQ0E7QUFBQSxNQUNBO0FBQUEsSUFDQTtBQUNFLG1CQUFlLGNBQWM7QUFDN0IsV0FBTyxFQUFFLGVBQWUsZUFBZ0I7QUFBQSxFQUMxQztBQzVKTyxXQUFTLG1CQUFtQixLQUFLO0FBQ3RDLFFBQUksWUFBWTtBQUNoQixRQUFJLGNBQWM7QUFDbEIsVUFBTSxhQUFhO0FBQ25CLFFBQUk7QUFDSixZQUFRLFFBQVEsV0FBVyxLQUFLLEdBQUcsT0FBTyxNQUFNO0FBQzlDLHFCQUFlLE1BQU0sQ0FBQztBQUN0QixrQkFBWSxVQUFVLFFBQVEsTUFBTSxDQUFDLEdBQUcsRUFBRTtBQUFBLElBQzlDO0FBQ0UsV0FBTztBQUFBLE1BQ0wsYUFBYSxZQUFZLEtBQU07QUFBQSxNQUMvQixXQUFXLFVBQVUsS0FBSTtBQUFBLElBQzFCO0FBQUEsRUFDSDtBQ1JzQixpQkFBQSxtQkFBbUIsS0FBSyxTQUFTOztBQUMvQyxVQUFBLGFBQWEsS0FBSyxTQUFTLFNBQVMsRUFBRSxFQUFFLFVBQVUsR0FBRyxFQUFFO0FBQzdELFVBQU0sTUFBTSxDQUFDO0FBQ1QsUUFBQSxDQUFDLFFBQVEsZUFBZTtBQUMxQixVQUFJLEtBQUssNERBQTREO0FBQUEsSUFBQTtBQUV2RSxRQUFJLFFBQVEsS0FBSztBQUNYLFVBQUEsS0FBSyxRQUFRLEdBQUc7QUFBQSxJQUFBO0FBRWxCLFVBQUFKLE1BQUEsSUFBSSxZQUFKLGdCQUFBQSxJQUFhLHNCQUFxQixNQUFNO0FBQ3BDLFlBQUEsV0FBVyxNQUFNLFFBQVE7QUFDL0IsVUFBSSxLQUFLLFNBQVMsV0FBVyxTQUFTLE9BQU8sQ0FBQztBQUFBLElBQUE7QUFFMUMsVUFBQSxFQUFFLFdBQVcsWUFBQSxJQUFnQixtQkFBbUIsSUFBSSxLQUFLLElBQUksRUFBRSxNQUFNO0FBQ3JFLFVBQUE7QUFBQSxNQUNKLGlCQUFpQjtBQUFBLE1BQ2pCLGVBQWU7QUFBQSxNQUNmO0FBQUEsSUFDRixJQUFJLE1BQU0sc0JBQXNCO0FBQUEsTUFDOUIsTUFBTSxRQUFRO0FBQUEsTUFDZCxLQUFLO0FBQUEsUUFDSCxhQUFhO0FBQUEsTUFDZjtBQUFBLE1BQ0EsTUFBTSxRQUFRLFFBQVE7QUFBQSxNQUN0QixlQUFlLFFBQVE7QUFBQSxJQUFBLENBQ3hCO0FBQ1UsZUFBQSxhQUFhLHdCQUF3QixFQUFFO0FBQzlDLFFBQUE7QUFDSixVQUFNLFFBQVEsTUFBTTtBQUNsQixjQUFRLFlBQVksT0FBTztBQUMzQixvQkFBYyxZQUFZLE9BQU8sY0FBYyxNQUFNLEdBQUcsT0FBTztBQUMzRCxVQUFBLGVBQWUsQ0FBQyxTQUFTO0FBQUEsUUFDM0IsMENBQTBDLFVBQVU7QUFBQSxNQUFBLEdBQ25EO0FBQ0ssY0FBQSxRQUFRLFNBQVMsY0FBYyxPQUFPO0FBQzVDLGNBQU0sY0FBYztBQUNkLGNBQUEsYUFBYSxtQ0FBbUMsVUFBVTtBQUNoRSxTQUFDLFNBQVMsUUFBUSxTQUFTLE1BQU0sT0FBTyxLQUFLO0FBQUEsTUFBQTtBQUUvQyxnQkFBVSxRQUFRLFFBQVEsYUFBYSxRQUFRLFVBQVU7QUFBQSxJQUMzRDtBQUNBLFVBQU0sU0FBUyxNQUFNOztBQUNuQixPQUFBQSxNQUFBLFFBQVEsYUFBUixnQkFBQUEsSUFBQSxjQUFtQjtBQUNuQixpQkFBVyxPQUFPO0FBQ2xCLFlBQU0sZ0JBQWdCLFNBQVM7QUFBQSxRQUM3QiwwQ0FBMEMsVUFBVTtBQUFBLE1BQ3REO0FBQ0EscURBQWU7QUFDZixhQUFPLFlBQVk7QUFDTCxvQkFBQSxZQUFZLFlBQVksU0FBUztBQUNyQyxnQkFBQTtBQUFBLElBQ1o7QUFDQSxVQUFNLGlCQUFpQjtBQUFBLE1BQ3JCO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFDQSxRQUFJLGNBQWMsTUFBTTtBQUNqQixXQUFBO0FBQUEsTUFDTDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxHQUFHO0FBQUEsTUFDSCxJQUFJLFVBQVU7QUFDTCxlQUFBO0FBQUEsTUFBQTtBQUFBLElBRVg7QUFBQSxFQUNGO0FBQ0EsaUJBQWUsVUFBVTtBQUN2QixVQUFNLE1BQU0sUUFBUSxRQUFRLE9BQU8sb0JBQW9CLFNBQTBCLE1BQU07QUFDbkYsUUFBQTtBQUNJLFlBQUEsTUFBTSxNQUFNLE1BQU0sR0FBRztBQUNwQixhQUFBLE1BQU0sSUFBSSxLQUFLO0FBQUEsYUFDZixLQUFLO0FBQ0xELGVBQUE7QUFBQSxRQUNMLDJCQUEyQixHQUFHO0FBQUEsUUFDOUI7QUFBQSxNQUNGO0FBQ08sYUFBQTtBQUFBLElBQUE7QUFBQSxFQUVYO0FDdkZPLFdBQVMsb0JBQW9CTSxhQUFZO0FBQzlDLFdBQU9BO0FBQUEsRUFDVDtBQ0ZBLFdBQVMsRUFBRSxHQUFFO0FBQUMsUUFBSSxHQUFFLEdBQUUsSUFBRTtBQUFHLFFBQUcsWUFBVSxPQUFPLEtBQUcsWUFBVSxPQUFPLEVBQUUsTUFBRztBQUFBLGFBQVUsWUFBVSxPQUFPLEVBQUUsS0FBRyxNQUFNLFFBQVEsQ0FBQyxHQUFFO0FBQUMsVUFBSSxJQUFFLEVBQUU7QUFBTyxXQUFJLElBQUUsR0FBRSxJQUFFLEdBQUUsSUFBSSxHQUFFLENBQUMsTUFBSSxJQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsT0FBSyxNQUFJLEtBQUcsTUFBSyxLQUFHO0FBQUEsSUFBRSxNQUFNLE1BQUksS0FBSyxFQUFFLEdBQUUsQ0FBQyxNQUFJLE1BQUksS0FBRyxNQUFLLEtBQUc7QUFBRyxXQUFPO0FBQUEsRUFBQztBQUFRLFdBQVMsT0FBTTtBQUFDLGFBQVEsR0FBRSxHQUFFLElBQUUsR0FBRSxJQUFFLElBQUcsSUFBRSxVQUFVLFFBQU8sSUFBRSxHQUFFLElBQUksRUFBQyxJQUFFLFVBQVUsQ0FBQyxPQUFLLElBQUUsRUFBRSxDQUFDLE9BQUssTUFBSSxLQUFHLE1BQUssS0FBRztBQUFHLFdBQU87QUFBQSxFQUFDO0FDRXhXLFdBQVMsTUFBTSxRQUFzQjtBQUMxQyxXQUFPLEtBQUssTUFBTTtBQUFBLEVBQ3BCOzs7Ozs7QUMwRUVDLGlCQUFBLENBQUEsT0FBQSxDQUFBOzs7O0FDckVLLFFBQU1DLGFBQTBDQyxDQUFVLFVBQUE7QUFDL0QsWUFBQSxNQUFBO0FBQUEsVUFBQUMsT0FBQUMsU0FBQUMsR0FBQUEsUUFBQUYsS0FBQUcsWUFBQUMsUUFBQUYsTUFBQUMsWUFBQUUsUUFBQUgsTUFBQUksYUFBQUMsUUFBQUYsTUFBQUY7QUFBQUMsYUFBQUEsT0FLU0wsTUFBQUEsTUFBTVMsS0FBSztBQUFBRCxhQUFBQSxPQVVYUixNQUFBQSxNQUFNVSxJQUFJO0FBQUFDLHlCQUFBQSxNQUFBQSxVQUFBVixNQWRMVyxHQUFHLHNDQUFzQ1osTUFBTWEsS0FBSyxDQUFDLENBQUE7QUFBQVosYUFBQUE7QUFBQUEsSUFBQUEsR0FBQTtBQUFBLEVBc0JyRTs7Ozs7QUN3TkVILGlCQUFBLENBQUEsU0FBQSxPQUFBLENBQUE7Ozs7QUN2T0ssUUFBTWdCLGdCQUFnRGQsQ0FBVSxVQUFBO0FBQ3JFLFVBQU0sQ0FBQ2Usa0JBQWtCQyxtQkFBbUIsSUFBSUMsYUFBYSxFQUFFO0FBQzNEQyxRQUFBQTtBQUdKQyxpQkFBYSxNQUFNO0FBQ2IsVUFBQSxDQUFDbkIsTUFBTW9CLGFBQWE7QUFDdEJKLDRCQUFvQixFQUFFO0FBQ3RCO0FBQUEsTUFBQTtBQUdGLFlBQU1LLE9BQU9yQixNQUFNb0I7QUFDbkIsWUFBTUUsUUFBUXRCLE1BQU11QixPQUFPQyxVQUFXQyxDQUFTLFNBQUE7QUFDdkNDLGNBQUFBLFVBQVVELEtBQUtFLFlBQVlGLEtBQUtHO0FBQy9CUCxlQUFBQSxRQUFRSSxLQUFLRSxhQUFhTixPQUFPSztBQUFBQSxNQUFBQSxDQUN6QztBQUVEViwwQkFBb0JNLEtBQUs7QUFBQSxJQUFBLENBQzFCO0FBR0RILGlCQUFhLE1BQU07QUFDakIsWUFBTUcsUUFBUVAsaUJBQWlCO0FBQy9CLFVBQUlPLFVBQVUsTUFBTSxDQUFDSixnQkFBZ0IsQ0FBQ2xCLE1BQU02QixVQUFXO0FBRWpEQyxZQUFBQSxlQUFlWixhQUFhYSxpQkFBaUIsbUJBQW1CO0FBQ2hFQyxZQUFBQSxpQkFBaUJGLGFBQWFSLEtBQUs7QUFFekMsVUFBSVUsZ0JBQWdCO0FBQ2xCLGNBQU1DLGtCQUFrQmYsYUFBYWdCO0FBQ3JDLGNBQU1DLFVBQVVILGVBQWVJO0FBQy9CLGNBQU1DLGFBQWFMLGVBQWVNO0FBR2xDLGNBQU1DLFlBQVlKLFVBQVVGLGtCQUFrQixJQUFJSSxhQUFhO0FBRS9EbkIscUJBQWFzQixTQUFTO0FBQUEsVUFDcEJDLEtBQUtGO0FBQUFBLFVBQ0xHLFVBQVU7QUFBQSxRQUFBLENBQ1g7QUFBQSxNQUFBO0FBQUEsSUFDSCxDQUNEO0FBRUQsWUFBQSxNQUFBO0FBQUEsVUFBQXpDLE9BQUFDLFNBQUFBLEdBQUFDLFFBQUFGLEtBQUFHO0FBQUEsVUFBQXVDLFFBRVN6QjtBQUFZLGFBQUF5QixVQUFBQyxhQUFBQSxJQUFBRCxPQUFBMUMsSUFBQSxJQUFaaUIsZUFBWWpCO0FBQUFFLGFBQUFBLE9BQUEwQyxnQkFRZEMsS0FBRztBQUFBLFFBQUEsSUFBQ0MsT0FBSTtBQUFBLGlCQUFFL0MsTUFBTXVCO0FBQUFBLFFBQU07QUFBQSxRQUFBeUIsVUFDcEJBLENBQUN2QixNQUFNSCxXQUFLLE1BQUE7QUFBQSxjQUFBakIsUUFBQTRDLFVBQUE7QUFBQTVDLGlCQUFBQSxPQVdSb0IsTUFBQUEsS0FBS3lCLElBQUk7QUFBQUMsNkJBQUFDLENBQUEsUUFBQTtBQUFBLGdCQUFBQyxNQVRPL0IsU0FBT2dDLE9BQ2pCMUMsR0FDTCwyQ0FDQSw0QkFDQVUsTUFBQUEsTUFBWVAscUJBQ1IseUNBQ0EsMkJBQ047QUFBQ3NDLG9CQUFBRCxJQUFBRyxLQUFBQyxhQUFBbkQsT0FBQStDLG1CQUFBQSxJQUFBRyxJQUFBRixHQUFBO0FBQUFDLHFCQUFBRixJQUFBSyxLQUFBOUMsVUFBQU4sT0FBQStDLElBQUFLLElBQUFILElBQUE7QUFBQUYsbUJBQUFBO0FBQUFBLFVBQUFBLEdBQUE7QUFBQSxZQUFBRyxHQUFBRztBQUFBQSxZQUFBRCxHQUFBQztBQUFBQSxVQUFBQSxDQUFBO0FBQUFyRCxpQkFBQUE7QUFBQUEsUUFBQSxHQUFBO0FBQUEsTUFBQSxDQUlKLENBQUE7QUFBQU0seUJBQUFBLE1BQUFBLFVBQUFWLE1BckJFVyxHQUNMLGdEQUNBLHFCQUNBWixNQUFNYSxLQUNSLENBQUMsQ0FBQTtBQUFBWixhQUFBQTtBQUFBQSxJQUFBQSxHQUFBO0FBQUEsRUFzQlA7OztBQ3hERUgsaUJBQUEsQ0FBQSxPQUFBLENBQUE7Ozs7QUNsQkssUUFBTTZELG1CQUFzRDNELENBQVUsVUFBQTtBQUMzRSxZQUFBLE1BQUE7QUFBQSxVQUFBQyxPQUFBQyxTQUFBO0FBQUFELGFBQUFBLE1BQUE0QyxnQkFFS0MsS0FBRztBQUFBLFFBQUEsSUFBQ0MsT0FBSTtBQUFBLGlCQUFFL0MsTUFBTTREO0FBQUFBLFFBQU87QUFBQSxRQUFBWixVQUNwQmEsWUFBSyxNQUFBO0FBQUEsY0FBQTFELFFBQUE4QyxVQUFBNUMsR0FBQUEsUUFBQUYsTUFBQUM7QUFBQUMsZ0JBQUFEO0FBQUFJLGNBQUFBLFFBQUFILE1BQUFFLGFBQUF1RCxRQUFBdEQsTUFBQUQ7QUFBQXdELGlCQUFBMUQsT0FlQ3dELE1BQUFBLE1BQU1uRCxNQUFJLElBQUE7QUFBQUYsaUJBQUFBLE9BTVhxRCxNQUFBQSxNQUFNRyxRQUFRO0FBQUFELGlCQUFBRCxPQU1kRCxNQUFBQSxNQUFNcEQsTUFBTXdELGdCQUFnQjtBQUFBZCw2QkFBQUMsQ0FBQSxRQUFBO0FBQUEsZ0JBQUFDLE1BekJ4QnpDLEdBQ0wsa0VBQ0FpRCxNQUFNSyxnQkFDRix5REFDQSxtQ0FDTixHQUFDWixPQUdRMUMsR0FDTCx1Q0FDQWlELE1BQU1uRCxRQUFRLElBQUksd0JBQXdCLGdCQUM1QyxHQUFDeUQsT0FJVXZELEdBQ1gsbUJBQ0FpRCxNQUFNSyxnQkFBZ0Isb0NBQW9DLGNBQzVELEdBQUNFLE9BR1l4RCxHQUNYLHVCQUNBaUQsTUFBTUssZ0JBQWdCLHdCQUF3QixjQUNoRDtBQUFDYixvQkFBQUQsSUFBQUcsS0FBQTVDLFVBQUFSLE9BQUFpRCxJQUFBRyxJQUFBRixHQUFBO0FBQUFDLHFCQUFBRixJQUFBSyxLQUFBOUMsVUFBQU4sT0FBQStDLElBQUFLLElBQUFILElBQUE7QUFBQWEscUJBQUFmLElBQUFpQixLQUFBMUQsVUFBQUgsT0FBQTRDLElBQUFpQixJQUFBRixJQUFBO0FBQUFDLHFCQUFBaEIsSUFBQWtCLEtBQUEzRCxVQUFBbUQsT0FBQVYsSUFBQWtCLElBQUFGLElBQUE7QUFBQWhCLG1CQUFBQTtBQUFBQSxVQUFBQSxHQUFBO0FBQUEsWUFBQUcsR0FBQUc7QUFBQUEsWUFBQUQsR0FBQUM7QUFBQUEsWUFBQVcsR0FBQVg7QUFBQUEsWUFBQVksR0FBQVo7QUFBQUEsVUFBQUEsQ0FBQTtBQUFBdkQsaUJBQUFBO0FBQUFBLFFBQUEsR0FBQTtBQUFBLE1BQUEsQ0FJSixDQUFBO0FBQUFRLHlCQUFBQSxNQUFBQSxVQUFBVixNQWhDT1csR0FBRywyQkFBMkJaLE1BQU1hLEtBQUssQ0FBQyxDQUFBO0FBQUFaLGFBQUFBO0FBQUFBLElBQUFBLEdBQUE7QUFBQSxFQW9DMUQ7Ozs7QUN6Q0EsUUFBTXNFLFNBQTBCLENBQUMsTUFBTSxTQUFTLE1BQU07QUFFL0MsUUFBTUMsY0FBNEN4RSxDQUFVLFVBQUE7QUFDakUsVUFBTSxDQUFDeUUsbUJBQW1CQyxvQkFBb0IsSUFBSXpELGFBQWEsQ0FBQztBQUVoRSxVQUFNMEQsZUFBZUEsTUFBTUosT0FBT0UsbUJBQW1CO0FBRS9DRyxVQUFBQSxhQUFhQSxDQUFDckIsTUFBa0I7O0FBQ3BDQSxRQUFFc0IsZ0JBQWdCO0FBQ2xCLFlBQU1DLGFBQWFMLGtCQUFzQixJQUFBLEtBQUtGLE9BQU9RO0FBQ3JETCwyQkFBcUJJLFNBQVM7QUFDeEJFLFlBQUFBLFdBQVdULE9BQU9PLFNBQVM7QUFDakMsVUFBSUUsVUFBVTtBQUNaaEYsU0FBQUEsTUFBQUEsTUFBTWlGLGtCQUFOakYsZ0JBQUFBLElBQUFBLFlBQXNCZ0Y7QUFBQUEsTUFBUTtBQUFBLElBRWxDO0FBRUEsWUFBQSxNQUFBO0FBQUEsVUFBQS9FLE9BQUFDLFNBQUFDLEdBQUFBLFFBQUFGLEtBQUFHLFlBQUFDLFFBQUFGLE1BQUFJLGFBQUFELFFBQUFELE1BQUFFLGFBQUFDLFFBQUFGLE1BQUFGO0FBQUE4RSx5QkFBQS9FLE9BV2VILFNBQUFBLE1BQU1tRixPQUFPO0FBQUE3RSxZQUFBOEUsVUFrQmJSO0FBQVViLGFBQUF2RCxPQWVVbUUsWUFBWTtBQUFBeEIseUJBQUFDLENBQUEsUUFBQTtBQUFBLFlBQUFDLE1BMUNwQ3pDLEdBQ0wsMERBQ0EsNENBQ0EsK0JBQ0FaLE1BQU1hLEtBQ1IsR0FBQ3lDLE9BS1d0RCxNQUFNcUYsVUFBUWxCLE9BQ2pCdkQsR0FDTCwyRUFDQSxpQ0FDQSwyQ0FDQSxtREFDQSxzQ0FDRixHQUFDd0QsT0FXU3BFLE1BQU1xRixVQUFRQyxPQUNqQjFFLEdBQ0wsb0RBQ0EsNEJBQ0EsMkNBQ0EsbURBQ0Esd0NBQ0EsbURBQ0EseUZBQ0EsNERBQ0EsK0NBQ0Y7QUFBQ3lDLGdCQUFBRCxJQUFBRyxLQUFBNUMsVUFBQVYsTUFBQW1ELElBQUFHLElBQUFGLEdBQUE7QUFBQUMsaUJBQUFGLElBQUFLLE1BQUF0RCxNQUFBa0YsV0FBQWpDLElBQUFLLElBQUFIO0FBQUFhLGlCQUFBZixJQUFBaUIsS0FBQTFELFVBQUFSLE9BQUFpRCxJQUFBaUIsSUFBQUYsSUFBQTtBQUFBQyxpQkFBQWhCLElBQUFrQixNQUFBaEUsTUFBQStFLFdBQUFqQyxJQUFBa0IsSUFBQUY7QUFBQWtCLGlCQUFBbEMsSUFBQW1DLEtBQUE1RSxVQUFBTCxPQUFBOEMsSUFBQW1DLElBQUFELElBQUE7QUFBQWxDLGVBQUFBO0FBQUFBLE1BQUFBLEdBQUE7QUFBQSxRQUFBRyxHQUFBRztBQUFBQSxRQUFBRCxHQUFBQztBQUFBQSxRQUFBVyxHQUFBWDtBQUFBQSxRQUFBWSxHQUFBWjtBQUFBQSxRQUFBNkIsR0FBQTdCO0FBQUFBLE1BQUFBLENBQUE7QUFBQXpELGFBQUFBO0FBQUFBLElBQUFBLEdBQUE7QUFBQSxFQU9UO0FBQUVILGlCQUFBLENBQUEsT0FBQSxDQUFBOzs7O0FDM0NGLE1BQUkwRixtQkFHTztBQUVKLFFBQU1DLE9BQThCekYsQ0FBVSxVQUFBOztBQUNuRCxVQUFNLENBQUMwRixXQUFXQyxZQUFZLElBQUkxRSxhQUFhakIsTUFBTTRGLGdCQUFjNUYsTUFBQUEsTUFBTTZGLEtBQUssQ0FBQyxNQUFaN0YsZ0JBQUFBLElBQWU4RixPQUFNLEVBQUU7QUFFcEZDLFVBQUFBLGtCQUFrQkEsQ0FBQ0QsT0FBZTs7QUFDdENILG1CQUFhRyxFQUFFO0FBQ2Y5RixPQUFBQSxNQUFBQSxNQUFNZ0csZ0JBQU5oRyxnQkFBQUEsSUFBQUEsWUFBb0I4RjtBQUFBQSxJQUN0QjtBQUdtQix1QkFBQTtBQUFBLE1BQ2pCSjtBQUFBQSxNQUNBQyxjQUFjSTtBQUFBQSxJQUNoQjtBQUVBLFlBQUEsTUFBQTtBQUFBLFVBQUE5RixPQUFBQyxTQUFBO0FBQUFELGFBQUFBLE1BRUtELE1BQUFBLE1BQU1nRCxRQUFRO0FBQUFyQyx5QkFBQUEsTUFBQUEsVUFBQVYsTUFETFcsR0FBRyxVQUFVWixNQUFNYSxLQUFLLENBQUMsQ0FBQTtBQUFBWixhQUFBQTtBQUFBQSxJQUFBQSxHQUFBO0FBQUEsRUFJekM7QUFFTyxRQUFNZ0csV0FBc0NqRyxDQUFVLFVBQUE7QUFDM0QsWUFBQSxNQUFBO0FBQUEsVUFBQUcsUUFBQUQsU0FBQTtBQUFBQyxhQUFBQSxPQVFLSCxNQUFBQSxNQUFNZ0QsUUFBUTtBQUFBckMseUJBQUFBLE1BQUFBLFVBQUFSLE9BTlJTLEdBQ0wseUZBQ0EsVUFDQVosTUFBTWEsS0FDUixDQUFDLENBQUE7QUFBQVYsYUFBQUE7QUFBQUEsSUFBQUEsR0FBQTtBQUFBLEVBS1A7QUFFTyxRQUFNK0YsY0FBNENsRyxDQUFVLFVBQUE7QUFDakUsVUFBTW1HLFdBQVdBLE9BQU1YLHFEQUFrQkUsaUJBQWdCMUYsTUFBTWpCO0FBRS9ELFlBQUEsTUFBQTtBQUFBLFVBQUFzQixRQUFBNEMsVUFBQTtBQUFBNUMsWUFBQStFLFVBRWEsTUFBTUkscURBQWtCRyxhQUFhM0YsTUFBTWpCO0FBQU1zQixhQUFBQSxPQWF6REwsTUFBQUEsTUFBTWdELFFBQVE7QUFBQUcseUJBQUF4QyxNQUFBQSxVQUFBTixPQVpSTyxHQUNMLG9GQUNBLHVEQUNBLGlIQUNBLG9EQUNBLFVBQ0F1RixTQUFBQSxJQUNJLG1DQUNBLHFDQUNKbkcsTUFBTWEsS0FDUixDQUFDLENBQUE7QUFBQVIsYUFBQUE7QUFBQUEsSUFBQUEsR0FBQTtBQUFBLEVBS1A7QUFFTyxRQUFNK0YsY0FBNENwRyxDQUFVLFVBQUE7QUFDakUsV0FBQTZDLGdCQUNHd0QsTUFBSTtBQUFBLE1BQUEsSUFBQ0MsT0FBSTtBQUFFZCxnQkFBQUEscURBQWtCRSxpQkFBZ0IxRixNQUFNakI7QUFBQUEsTUFBSztBQUFBLE1BQUEsSUFBQWlFLFdBQUE7QUFBQSxZQUFBMUMsUUFBQUosU0FBQTtBQUFBSSxlQUFBQSxPQVFwRE4sTUFBQUEsTUFBTWdELFFBQVE7QUFBQXJDLDJCQUFBQSxNQUFBQSxVQUFBTCxPQU5STSxHQUNMLHlCQUNBLGlIQUNBWixNQUFNYSxLQUNSLENBQUMsQ0FBQTtBQUFBUCxlQUFBQTtBQUFBQSxNQUFBQTtBQUFBQSxJQUFBLENBQUE7QUFBQSxFQU1UO0FBQUVSLGlCQUFBLENBQUEsT0FBQSxDQUFBOzs7O0FDbkZLLFFBQU15Ryx1QkFBOER2RyxDQUFVLFVBQUE7QUFDbkYsWUFBQSxNQUFBO0FBQUEsVUFBQUMsT0FBQXVHLFFBQUE7QUFBQXZHLGFBQUFBLE1BQUE0QyxnQkFHSzlDLFlBQVU7QUFBQSxRQUFBLElBQ1RVLFFBQUs7QUFBQSxpQkFBRVQsTUFBTVM7QUFBQUEsUUFBSztBQUFBLFFBQUEsSUFDbEJDLE9BQUk7QUFBQSxpQkFBRVYsTUFBTVU7QUFBQUEsUUFBQUE7QUFBQUEsTUFBSSxDQUFBLEdBQUEsSUFBQTtBQUFBVCxhQUFBQSxNQUFBNEMsZ0JBSWpCNEMsTUFBSTtBQUFBLFFBQ0hJLE1BQU0sQ0FDSjtBQUFBLFVBQUVDLElBQUk7QUFBQSxVQUFVVyxPQUFPO0FBQUEsUUFBQSxHQUN2QjtBQUFBLFVBQUVYLElBQUk7QUFBQSxVQUFlVyxPQUFPO0FBQUEsUUFBQSxDQUFlO0FBQUEsUUFFN0NiLFlBQVU7QUFBQSxRQUFBLFNBQUE7QUFBQSxRQUFBLElBQUE1QyxXQUFBO0FBQUEsaUJBQUEsRUFBQSxNQUFBO0FBQUEsZ0JBQUE3QyxRQUFBRCxTQUFBO0FBQUFDLG1CQUFBQSxPQUFBMEMsZ0JBSVBvRCxVQUFRO0FBQUEsY0FBQSxJQUFBakQsV0FBQTtBQUFBSCx1QkFBQUEsQ0FBQUEsZ0JBQ05xRCxhQUFXO0FBQUEsa0JBQUNuSCxPQUFLO0FBQUEsa0JBQUFpRSxVQUFBO0FBQUEsZ0JBQUEsQ0FBQUgsR0FBQUEsZ0JBQ2pCcUQsYUFBVztBQUFBLGtCQUFDbkgsT0FBSztBQUFBLGtCQUFBaUUsVUFBQTtBQUFBLGdCQUFBLENBQUEsQ0FBQTtBQUFBLGNBQUE7QUFBQSxZQUFBLENBQUEsQ0FBQTtBQUFBN0MsbUJBQUFBO0FBQUFBLFVBQUFBLEdBQUEwQyxHQUFBQSxnQkFJckJ1RCxhQUFXO0FBQUEsWUFBQ3JILE9BQUs7QUFBQSxZQUFBLFNBQUE7QUFBQSxZQUFBLElBQUFpRSxXQUFBO0FBQUEscUJBQUEsRUFBQSxNQUFBO0FBQUEsb0JBQUEzQyxRQUFBNEMsUUFBQTtBQUFBNUMsdUJBQUFBLE9BQUF3QyxnQkFFYi9CLGVBQWE7QUFBQSxrQkFBQSxJQUNaUyxTQUFNO0FBQUEsMkJBQUV2QixNQUFNdUI7QUFBQUEsa0JBQU07QUFBQSxrQkFBQSxJQUNwQkgsY0FBVztBQUFBLDJCQUFFcEIsTUFBTW9CO0FBQUFBLGtCQUFXO0FBQUEsa0JBQUEsSUFDOUJTLFlBQVM7QUFBQSwyQkFBRTdCLE1BQU02QjtBQUFBQSxrQkFBQUE7QUFBQUEsZ0JBQVMsQ0FBQSxDQUFBO0FBQUF4Qix1QkFBQUE7QUFBQUEsY0FBQXFHLEdBQUFBLEdBQUFBLEtBSzdCQSxNQUFBQSxLQUFDMUcsTUFBQUEsQ0FBQUEsRUFBQUEsQ0FBQUEsTUFBTTZCLGFBQWE3QixNQUFNbUYsUUFBTyxFQUFBLE1BQUEsTUFBQTtBQUFBLG9CQUFBM0UsUUFBQW1HLFFBQUE7QUFBQW5HLHVCQUFBQSxPQUFBcUMsZ0JBRTdCMkIsYUFBVztBQUFBLGtCQUFBLElBQ1ZXLFVBQU87QUFBQSwyQkFBRW5GLE1BQU1tRjtBQUFBQSxrQkFBTztBQUFBLGtCQUFBLElBQ3RCRixnQkFBYTtBQUFBLDJCQUFFakYsTUFBTWlGO0FBQUFBLGtCQUFBQTtBQUFBQSxnQkFBYSxDQUFBLENBQUE7QUFBQXpFLHVCQUFBQTtBQUFBQSxjQUFBLEdBQUEsQ0FHdkMsQ0FBQTtBQUFBLFlBQUE7QUFBQSxVQUFBLENBQUFxQyxHQUFBQSxnQkFHRnVELGFBQVc7QUFBQSxZQUFDckgsT0FBSztBQUFBLFlBQUEsU0FBQTtBQUFBLFlBQUEsSUFBQWlFLFdBQUE7QUFBQSxrQkFBQTFDLFFBQUFzRyxRQUFBO0FBQUF0RyxxQkFBQUEsT0FBQXVDLGdCQUViYyxrQkFBZ0I7QUFBQSxnQkFBQSxJQUFDQyxVQUFPO0FBQUEseUJBQUU1RCxNQUFNNkc7QUFBQUEsZ0JBQUFBO0FBQUFBLGNBQVcsQ0FBQSxDQUFBO0FBQUF2RyxxQkFBQUE7QUFBQUEsWUFBQUE7QUFBQUEsVUFBQSxDQUFBLENBQUE7QUFBQSxRQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUEsSUFBQTtBQUFBSyx5QkFBQUEsTUFBQUEsVUFBQVYsTUE3Q3hDVyxHQUFHLGdDQUFnQ1osTUFBTWEsS0FBSyxDQUFDLENBQUE7QUFBQVosYUFBQUE7QUFBQUEsSUFBQUEsR0FBQTtBQUFBLEVBbUQvRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ2xERUgsaUJBQUEsQ0FBQSxPQUFBLENBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7RUN4QkssTUFBTSxjQUFjO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFJekIscUJBQXVDO0FBQy9CLFlBQUEsTUFBTSxPQUFPLFNBQVM7QUFHeEIsVUFBQSxJQUFJLFNBQVMsY0FBYyxHQUFHO0FBQ2hDLGVBQU8sS0FBSyxzQkFBc0I7QUFBQSxNQUFBO0FBRzdCLGFBQUE7QUFBQSxJQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFPRCx3QkFBMEM7QUFDNUMsVUFBQTtBQUVJLGNBQUEsWUFBWSxPQUFPLFNBQVMsU0FBUyxNQUFNLEdBQUcsRUFBRSxPQUFPLE9BQU87QUFDaEUsWUFBQSxVQUFVLFNBQVMsRUFBVSxRQUFBO0FBRTNCLGNBQUEsU0FBUyxVQUFVLENBQUM7QUFDcEIsY0FBQSxZQUFZLFVBQVUsQ0FBQztBQUc3QixjQUFNLGlCQUFpQjtBQUFBLFVBQ3JCO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNGO0FBRUEsWUFBSSxRQUFRO0FBQ1osbUJBQVcsWUFBWSxnQkFBZ0I7QUFDL0IsZ0JBQUEsVUFBVSxTQUFTLGNBQWMsUUFBUTtBQUMzQyxjQUFBLFdBQVcsUUFBUSxhQUFhO0FBQzFCLG9CQUFBLFFBQVEsWUFBWSxLQUFLO0FBQ2pDO0FBQUEsVUFBQTtBQUFBLFFBQ0Y7QUFJRixZQUFJLENBQUMsT0FBTztBQUNGLGtCQUFBLFVBQVUsUUFBUSxNQUFNLEdBQUc7QUFBQSxRQUFBO0FBSS9CLGNBQUEsY0FBYyxPQUFPLFFBQVEsTUFBTSxHQUFHLEVBQUUsUUFBUSxNQUFNLEdBQUc7QUFFeEQsZUFBQTtBQUFBLFVBQ0wsU0FBUyxHQUFHLE1BQU0sSUFBSSxTQUFTO0FBQUEsVUFDL0I7QUFBQSxVQUNBLFFBQVE7QUFBQSxVQUNSLFVBQVU7QUFBQSxVQUNWLEtBQUssT0FBTyxTQUFTO0FBQUEsUUFDdkI7QUFBQSxlQUNPLE9BQU87QUFDTixnQkFBQSxNQUFNLHFEQUFxRCxLQUFLO0FBQ2pFLGVBQUE7QUFBQSxNQUFBO0FBQUEsSUFDVDtBQUFBO0FBQUE7QUFBQTtBQUFBLElBT0YsZ0JBQWdCLFVBQXlEO0FBQ25FLFVBQUEsYUFBYSxPQUFPLFNBQVM7QUFDN0IsVUFBQSxlQUFlLEtBQUssbUJBQW1CO0FBRzNDLGVBQVMsWUFBWTtBQUdyQixZQUFNLGtCQUFrQixNQUFNO0FBQ3RCLGNBQUEsU0FBUyxPQUFPLFNBQVM7QUFDL0IsWUFBSSxXQUFXLFlBQVk7QUFDWix1QkFBQTtBQUNQLGdCQUFBLFdBQVcsS0FBSyxtQkFBbUI7QUFHekMsZ0JBQU0sZUFBZSxDQUFDLGdCQUFnQixDQUFDLFlBQ3JDLGFBQWEsWUFBWSxTQUFTO0FBRXBDLGNBQUksY0FBYztBQUNELDJCQUFBO0FBQ2YscUJBQVMsUUFBUTtBQUFBLFVBQUE7QUFBQSxRQUNuQjtBQUFBLE1BRUo7QUFHTSxZQUFBLFdBQVcsWUFBWSxpQkFBaUIsR0FBSTtBQUdsRCxZQUFNLG1CQUFtQixNQUFNO0FBQzdCLG1CQUFXLGlCQUFpQixHQUFHO0FBQUEsTUFDakM7QUFFTyxhQUFBLGlCQUFpQixZQUFZLGdCQUFnQjtBQUdwRCxZQUFNLG9CQUFvQixRQUFRO0FBQ2xDLFlBQU0sdUJBQXVCLFFBQVE7QUFFN0IsY0FBQSxZQUFZLFlBQVksTUFBTTtBQUNsQiwwQkFBQSxNQUFNLFNBQVMsSUFBSTtBQUNwQix5QkFBQTtBQUFBLE1BQ25CO0FBRVEsY0FBQSxlQUFlLFlBQVksTUFBTTtBQUNsQiw2QkFBQSxNQUFNLFNBQVMsSUFBSTtBQUN2Qix5QkFBQTtBQUFBLE1BQ25CO0FBR0EsYUFBTyxNQUFNO0FBQ1gsc0JBQWMsUUFBUTtBQUNmLGVBQUEsb0JBQW9CLFlBQVksZ0JBQWdCO0FBQ3ZELGdCQUFRLFlBQVk7QUFDcEIsZ0JBQVEsZUFBZTtBQUFBLE1BQ3pCO0FBQUEsSUFBQTtBQUFBLEVBRUo7QUFFYSxRQUFBLGdCQUFnQixJQUFJLGNBQWM7O0FDdkkvQyxpQkFBc0IsZUFBdUM7QUFDM0QsVUFBTUosVUFBUyxNQUFNLFFBQVEsUUFBUSxNQUFNLElBQUksV0FBVztBQUMxRCxXQUFPQSxRQUFPLGFBQWE7QUFBQSxFQUM3Qjs7RUNtQ08sTUFBTSxrQkFBa0I7QUFBQSxJQUc3QixjQUFjO0FBRk47QUFJTixXQUFLLFVBQVU7QUFBQSxJQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFNakIsTUFBTSxlQUNKLFNBQ0EsT0FDQSxRQUM2QjtBQUN6QixVQUFBO0FBQ0ksY0FBQSxTQUFTLElBQUksZ0JBQWdCO0FBQ25DLFlBQUksTUFBTyxRQUFPLElBQUksU0FBUyxLQUFLO0FBQ3BDLFlBQUksT0FBUSxRQUFPLElBQUksVUFBVSxNQUFNO0FBRXZDLGNBQU0sTUFBTSxHQUFHLEtBQUssT0FBTyxZQUFZLG1CQUFtQixPQUFPLENBQUMsR0FBRyxPQUFPLGFBQWEsTUFBTSxPQUFPLFNBQUEsSUFBYSxFQUFFO0FBRTdHLGdCQUFBLElBQUksdUNBQXVDLEdBQUc7QUFFaEQsY0FBQSxXQUFXLE1BQU0sTUFBTSxLQUFLO0FBQUEsVUFDaEMsUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFBQSxDQUtUO0FBRUcsWUFBQSxDQUFDLFNBQVMsSUFBSTtBQUNSLGtCQUFBLE1BQU0sOENBQThDLFNBQVMsTUFBTTtBQUNwRSxpQkFBQTtBQUFBLFFBQUE7QUFHSCxjQUFBLE9BQU8sTUFBTSxTQUFTLEtBQUs7QUFDekIsZ0JBQUEsSUFBSSx1Q0FBdUMsSUFBSTtBQUd2RCxZQUFJLEtBQUssT0FBTztBQUNOLGtCQUFBLElBQUkscURBQXFELEtBQUssS0FBSztBQUNwRSxpQkFBQTtBQUFBLFlBQ0wsU0FBUztBQUFBLFlBQ1QsYUFBYTtBQUFBLFlBQ2IsT0FBTyxLQUFLO0FBQUEsWUFDWixVQUFVO0FBQUEsWUFDVixlQUFlO0FBQUEsVUFDakI7QUFBQSxRQUFBO0FBR0ssZUFBQTtBQUFBLGVBQ0EsT0FBTztBQUNOLGdCQUFBLE1BQU0sNkNBQTZDLEtBQUs7QUFDekQsZUFBQTtBQUFBLE1BQUE7QUFBQSxJQUNUO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFNRixNQUFNLGFBQ0osU0FDQSxVQU1nQztBQUM1QixVQUFBO0FBQ0YsY0FBTSxXQUFXLE1BQU0sTUFBTSxHQUFHLEtBQUssT0FBTyxrQkFBa0I7QUFBQSxVQUM1RCxRQUFRO0FBQUEsVUFDUixTQUFTO0FBQUEsWUFDUCxnQkFBZ0I7QUFBQTtBQUFBLFVBRWxCO0FBQUEsVUFDQSxNQUFNLEtBQUssVUFBVTtBQUFBLFlBQ25CO0FBQUEsWUFDQTtBQUFBLFVBQ0QsQ0FBQTtBQUFBLFFBQUEsQ0FDRjtBQUVHLFlBQUEsQ0FBQyxTQUFTLElBQUk7QUFDUixrQkFBQSxNQUFNLHlDQUF5QyxTQUFTLE1BQU07QUFDL0QsaUJBQUE7QUFBQSxRQUFBO0FBR0gsY0FBQUEsVUFBUyxNQUFNLFNBQVMsS0FBSztBQUNuQyxlQUFPQSxRQUFPO0FBQUEsZUFDUCxPQUFPO0FBQ04sZ0JBQUEsTUFBTSx3Q0FBd0MsS0FBSztBQUNwRCxlQUFBO0FBQUEsTUFBQTtBQUFBLElBQ1Q7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU1GLE1BQU0saUJBQW1DO0FBQ25DLFVBQUE7QUFDSSxjQUFBLFdBQVcsTUFBTSxNQUFNLEdBQUcsS0FBSyxRQUFRLFFBQVEsUUFBUSxFQUFFLENBQUMsU0FBUztBQUN6RSxlQUFPLFNBQVM7QUFBQSxlQUNULE9BQU87QUFDTixnQkFBQSxNQUFNLHdDQUF3QyxLQUFLO0FBQ3BELGVBQUE7QUFBQSxNQUFBO0FBQUEsSUFDVDtBQUFBLEVBRUo7QUFFYSxRQUFBLGFBQWEsSUFBSSxrQkFBa0I7OztBQ2pKekMsUUFBTW9ILGFBQXlDQSxNQUFNO0FBQzFEQyxZQUFRQyxJQUFJLDZDQUE2QztBQUd6RCxVQUFNLENBQUNDLGNBQWNDLGVBQWUsSUFBSWpHLGFBQStCLElBQUk7QUFDM0UsVUFBTSxDQUFDa0csV0FBV0MsWUFBWSxJQUFJbkcsYUFBNEIsSUFBSTtBQUNsRSxVQUFNLENBQUNvRyxhQUFhQyxjQUFjLElBQUlyRyxhQUFhLEtBQUs7QUFDeEQsVUFBTSxDQUFDc0csYUFBYUMsY0FBYyxJQUFJdkcsYUFBa0IsSUFBSTtBQUM1RCxVQUFNLENBQUN3RyxTQUFTQyxVQUFVLElBQUl6RyxhQUFhLEtBQUs7QUFDaEQsVUFBTSxDQUFDMEcsZ0JBQWdCQyxpQkFBaUIsSUFBSTNHLGFBQWEsS0FBSztBQUc5RDRHLFlBQVEsWUFBWTtBQUNsQmQsY0FBUUMsSUFBSSxpQ0FBaUM7QUFDdkNjLFlBQUFBLFFBQVEsTUFBTUMsYUFBYTtBQUNqQyxVQUFJRCxPQUFPO0FBQ1RWLHFCQUFhVSxLQUFLO0FBQ2xCZixnQkFBUUMsSUFBSSxnQ0FBZ0M7QUFBQSxNQUFBLE9BQ3ZDO0FBRUxELGdCQUFRQyxJQUFJLG9EQUFvRDtBQUNoRUkscUJBQWEseUJBQXlCO0FBQUEsTUFBQTtBQUlsQ1ksWUFBQUEsVUFBVUMsY0FBY0MsZ0JBQWlCQyxDQUFVLFVBQUE7QUFDL0NuQixnQkFBQUEsSUFBSSwrQkFBK0JtQixLQUFLO0FBQ2hEakIsd0JBQWdCaUIsS0FBSztBQUVyQixZQUFJQSxPQUFPO0FBQ1RiLHlCQUFlLElBQUk7QUFDbkJjLDJCQUFpQkQsS0FBSztBQUFBLFFBQUE7QUFBQSxNQUN4QixDQUNEO0FBRURFLGdCQUFVTCxPQUFPO0FBQUEsSUFBQSxDQUNsQjtBQUVLSSxVQUFBQSxtQkFBbUIsT0FBT0QsVUFBcUI7QUFDM0NuQixjQUFBQSxJQUFJLGlEQUFpRG1CLEtBQUs7QUFDbEVULGlCQUFXLElBQUk7QUFDWCxVQUFBO0FBQ0lZLGNBQUFBLE9BQU8sTUFBTUMsV0FBV0MsZUFDNUJMLE1BQU1NLFNBQ05OLE1BQU1PLE9BQ05QLE1BQU1RLE1BQ1I7QUFDUTNCLGdCQUFBQSxJQUFJLHFDQUFxQ3NCLElBQUk7QUFDckRkLHVCQUFlYyxJQUFJO0FBQUEsZUFDWk0sT0FBTztBQUNOQSxnQkFBQUEsTUFBTSw4Q0FBOENBLEtBQUs7QUFBQSxNQUFBLFVBQ3pEO0FBQ1JsQixtQkFBVyxLQUFLO0FBQUEsTUFBQTtBQUFBLElBRXBCO0FBRUEsVUFBTW1CLGNBQWNBLE1BQU07QUFDeEI5QixjQUFRQyxJQUFJLG9DQUFvQztBQUNoRFksd0JBQWtCLElBQUk7QUFBQSxJQUN4QjtBQUVBLFVBQU1rQixjQUFjQSxNQUFNO0FBQ3hCeEIscUJBQWUsS0FBSztBQUNwQkUscUJBQWUsSUFBSTtBQUNuQkksd0JBQWtCLEtBQUs7QUFBQSxJQUN6QjtBQUVBLFVBQU1tQixpQkFBaUJBLE1BQU07QUFDM0JoQyxjQUFRQyxJQUFJLHNDQUFzQztBQUV0QyxrQkFBQTtBQUFBLElBQ2Q7QUFFQUQsWUFBUUMsSUFBSSw4QkFBOEI7QUFBQSxNQUN4Q0ssYUFBYUEsWUFBWTtBQUFBLE1BQ3pCSixjQUFjQSxhQUFhO0FBQUEsTUFDM0JNLGFBQWFBLFlBQVk7QUFBQSxNQUN6QkUsU0FBU0EsUUFBUTtBQUFBLElBQUEsQ0FDbEI7QUFFRCxXQUFBNUUsZ0JBQ0d3RCxNQUFJO0FBQUEsTUFBQSxJQUFDQyxPQUFJO0FBQUVJLGVBQUFBLGFBQUFXLGFBQWEsRUFBQSxLQUFJSixhQUFhO0FBQUEsTUFBQztBQUFBLE1BQUEsSUFBRStCLFdBQVE7QUFBQSxnQkFBQSxNQUFBO0FBQUEsY0FBQS9JLE9BQUFDLE9BQUE7QUFBQStJLGVBQUFBLE1BQUFDLFlBQUEsV0FBQSxNQUFBO0FBQUFqSixpQkFBQUEsTUFBQSxNQUVoRDhHLFFBQVFDLElBQUksMkNBQTJDSyxlQUFlLGlCQUFpQkosYUFBYSxDQUFDLENBQUM7QUFBQWhILGlCQUFBQTtBQUFBQSxRQUFBQSxHQUFBO0FBQUEsTUFBQTtBQUFBLE1BQUEsSUFBQStDLFdBQUE7QUFBQSxlQUFBLENBQUEwRCxLQUFBLE1BR3hHSyxRQUFRQyxJQUFJLDBEQUEwRE8sYUFBYSxDQUFDLEdBQUExRSxnQkFDcEYwRCxzQkFBb0I7QUFBQSxVQUFBLElBQ25CNEIsUUFBSztBQUFBLG1CQUFFbEIsYUFBYTtBQUFBLFVBQUU7QUFBQSxVQUFBLElBQ3RCMUYsU0FBTTs7QUFBQSxvQkFBRWdHLE1BQUFBLFlBQWVoRyxNQUFmZ0csZ0JBQUFBLElBQWVoRztBQUFBQSxVQUFNO0FBQUEsVUFBQSxJQUM3QmtHLFVBQU87QUFBQSxtQkFBRUEsUUFBUTtBQUFBLFVBQUM7QUFBQSxVQUNsQnRDLFNBQVMwRDtBQUFBQSxVQUNUTSxTQUFTTDtBQUFBQSxVQUNUTSxZQUFZTDtBQUFBQSxRQUFBQSxDQUFjLENBQUE7QUFBQSxNQUFBO0FBQUEsSUFBQSxDQUFBO0FBQUEsRUFJbEM7O0FDbkdBLFFBQUEsYUFBZU0sb0JBQW9CO0FBQUEsSUFDakNDLFNBQVMsQ0FBQyx3QkFBd0Isd0JBQXdCLHNCQUFzQixtQkFBbUI7QUFBQSxJQUNuR0MsT0FBTztBQUFBLElBQ1BDLGtCQUFrQjtBQUFBLElBRWxCLE1BQU1DLEtBQUtDLEtBQTJCO0FBRWhDQyxVQUFBQSxPQUFPbEgsUUFBUWtILE9BQU9DLE1BQU07QUFDOUI3QyxnQkFBUUMsSUFBSSw2REFBNkQ7QUFDekU7QUFBQSxNQUFBO0FBR0ZELGNBQVFDLElBQUksc0RBQXNEO0FBRzVENkMsWUFBQUEsS0FBSyxNQUFNQyxtQkFBbUJKLEtBQUs7QUFBQSxRQUN2Q0ssTUFBTTtBQUFBLFFBQ05DLFVBQVU7QUFBQSxRQUNWQyxRQUFRO0FBQUEsUUFDUnBDLFNBQVMsT0FBT3FDLGNBQTJCOztBQUNqQ2xELGtCQUFBQSxJQUFJLCtDQUErQ2tELFNBQVM7QUFDcEVuRCxrQkFBUUMsSUFBSSxpQ0FBaUNrRCxVQUFVQyxZQUFBQSxDQUFhO0FBRzlEQyxnQkFBQUEsYUFBYUYsVUFBVUMsWUFBWTtBQUN6Q3BELGtCQUFRQyxJQUFJLDhDQUE2Q29ELE1BQUFBLFdBQVdDLGdCQUFYRCxnQkFBQUEsSUFBd0JyRixNQUFNO0FBR2pGdUYsZ0JBQUFBLFVBQVVyTCxTQUFTc0wsY0FBYyxLQUFLO0FBQzVDRCxrQkFBUXJCLE1BQU11QixVQUFVO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBYXhCRixrQkFBUUcsWUFBWTtBQUNwQlAsb0JBQVVRLFlBQVlKLE9BQU87QUFFckJ0RCxrQkFBQUEsSUFBSSxrREFBa0RzRCxPQUFPO0FBQ3JFdkQsa0JBQVFDLElBQUksNkNBQTZDMkMsT0FBT2dCLGlCQUFpQkwsT0FBTyxDQUFDO0FBR3pGdkQsa0JBQVFDLElBQUksNkNBQTZDO0FBQ25EaEksZ0JBQUFBLFdBQVU0TCxPQUFPLE1BQUEvSCxnQkFBT2lFLFlBQVUsQ0FBQSxDQUFBLEdBQUt3RCxPQUFPO0FBRTVDdEQsa0JBQUFBLElBQUksMkRBQTJEaEksUUFBTztBQUV2RUEsaUJBQUFBO0FBQUFBLFFBQ1Q7QUFBQSxRQUNBNkwsVUFBVUEsQ0FBQzdDLFlBQXlCO0FBQ3hCO0FBQUEsUUFBQTtBQUFBLE1BQ1osQ0FDRDtBQUdENkIsU0FBR2lCLE1BQU07QUFDVC9ELGNBQVFDLElBQUksdUNBQXVDO0FBQUEsSUFBQTtBQUFBLEVBRXZELENBQUM7O0FDdkVNLFFBQU0sMEJBQU4sTUFBTSxnQ0FBK0IsTUFBTTtBQUFBLElBQ2hELFlBQVksUUFBUSxRQUFRO0FBQ3BCLFlBQUEsd0JBQXVCLFlBQVksRUFBRTtBQUMzQyxXQUFLLFNBQVM7QUFDZCxXQUFLLFNBQVM7QUFBQSxJQUFBO0FBQUEsRUFHbEI7QUFERSxnQkFOVyx5QkFNSixjQUFhLG1CQUFtQixvQkFBb0I7QUFOdEQsTUFBTSx5QkFBTjtBQVFBLFdBQVMsbUJBQW1CLFdBQVc7O0FBQzVDLFdBQU8sSUFBR3hILE1BQUEsbUNBQVMsWUFBVCxnQkFBQUEsSUFBa0IsRUFBRSxJQUFJLFNBQTBCLElBQUksU0FBUztBQUFBLEVBQzNFO0FDVk8sV0FBUyxzQkFBc0IsS0FBSztBQUN6QyxRQUFJO0FBQ0osUUFBSTtBQUNKLFdBQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BS0wsTUFBTTtBQUNKLFlBQUksWUFBWSxLQUFNO0FBQ3RCLGlCQUFTLElBQUksSUFBSSxTQUFTLElBQUk7QUFDOUIsbUJBQVcsSUFBSSxZQUFZLE1BQU07QUFDL0IsY0FBSSxTQUFTLElBQUksSUFBSSxTQUFTLElBQUk7QUFDbEMsY0FBSSxPQUFPLFNBQVMsT0FBTyxNQUFNO0FBQy9CLG1CQUFPLGNBQWMsSUFBSSx1QkFBdUIsUUFBUSxNQUFNLENBQUM7QUFDL0QscUJBQVM7QUFBQSxVQUNuQjtBQUFBLFFBQ08sR0FBRSxHQUFHO0FBQUEsTUFDWjtBQUFBLElBQ0c7QUFBQSxFQUNIO0FDZk8sUUFBTSx3QkFBTixNQUFNLHNCQUFxQjtBQUFBLElBQ2hDLFlBQVksbUJBQW1CLFNBQVM7QUFjeEMsd0NBQWEsT0FBTyxTQUFTLE9BQU87QUFDcEM7QUFDQSw2Q0FBa0Isc0JBQXNCLElBQUk7QUFDNUMsZ0RBQXFDLG9CQUFJLElBQUs7QUFoQjVDLFdBQUssb0JBQW9CO0FBQ3pCLFdBQUssVUFBVTtBQUNmLFdBQUssa0JBQWtCLElBQUksZ0JBQWlCO0FBQzVDLFVBQUksS0FBSyxZQUFZO0FBQ25CLGFBQUssc0JBQXNCLEVBQUUsa0JBQWtCLEtBQUksQ0FBRTtBQUNyRCxhQUFLLGVBQWdCO0FBQUEsTUFDM0IsT0FBVztBQUNMLGFBQUssc0JBQXVCO0FBQUEsTUFDbEM7QUFBQSxJQUNBO0FBQUEsSUFRRSxJQUFJLFNBQVM7QUFDWCxhQUFPLEtBQUssZ0JBQWdCO0FBQUEsSUFDaEM7QUFBQSxJQUNFLE1BQU0sUUFBUTtBQUNaLGFBQU8sS0FBSyxnQkFBZ0IsTUFBTSxNQUFNO0FBQUEsSUFDNUM7QUFBQSxJQUNFLElBQUksWUFBWTtBQUNkLFVBQUksUUFBUSxRQUFRLE1BQU0sTUFBTTtBQUM5QixhQUFLLGtCQUFtQjtBQUFBLE1BQzlCO0FBQ0ksYUFBTyxLQUFLLE9BQU87QUFBQSxJQUN2QjtBQUFBLElBQ0UsSUFBSSxVQUFVO0FBQ1osYUFBTyxDQUFDLEtBQUs7QUFBQSxJQUNqQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFjRSxjQUFjLElBQUk7QUFDaEIsV0FBSyxPQUFPLGlCQUFpQixTQUFTLEVBQUU7QUFDeEMsYUFBTyxNQUFNLEtBQUssT0FBTyxvQkFBb0IsU0FBUyxFQUFFO0FBQUEsSUFDNUQ7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFZRSxRQUFRO0FBQ04sYUFBTyxJQUFJLFFBQVEsTUFBTTtBQUFBLE1BQzdCLENBQUs7QUFBQSxJQUNMO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFJRSxZQUFZLFNBQVMsU0FBUztBQUM1QixZQUFNLEtBQUssWUFBWSxNQUFNO0FBQzNCLFlBQUksS0FBSyxRQUFTLFNBQVM7QUFBQSxNQUM1QixHQUFFLE9BQU87QUFDVixXQUFLLGNBQWMsTUFBTSxjQUFjLEVBQUUsQ0FBQztBQUMxQyxhQUFPO0FBQUEsSUFDWDtBQUFBO0FBQUE7QUFBQTtBQUFBLElBSUUsV0FBVyxTQUFTLFNBQVM7QUFDM0IsWUFBTSxLQUFLLFdBQVcsTUFBTTtBQUMxQixZQUFJLEtBQUssUUFBUyxTQUFTO0FBQUEsTUFDNUIsR0FBRSxPQUFPO0FBQ1YsV0FBSyxjQUFjLE1BQU0sYUFBYSxFQUFFLENBQUM7QUFDekMsYUFBTztBQUFBLElBQ1g7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBS0Usc0JBQXNCLFVBQVU7QUFDOUIsWUFBTSxLQUFLLHNCQUFzQixJQUFJLFNBQVM7QUFDNUMsWUFBSSxLQUFLLFFBQVMsVUFBUyxHQUFHLElBQUk7QUFBQSxNQUN4QyxDQUFLO0FBQ0QsV0FBSyxjQUFjLE1BQU0scUJBQXFCLEVBQUUsQ0FBQztBQUNqRCxhQUFPO0FBQUEsSUFDWDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFLRSxvQkFBb0IsVUFBVSxTQUFTO0FBQ3JDLFlBQU0sS0FBSyxvQkFBb0IsSUFBSSxTQUFTO0FBQzFDLFlBQUksQ0FBQyxLQUFLLE9BQU8sUUFBUyxVQUFTLEdBQUcsSUFBSTtBQUFBLE1BQzNDLEdBQUUsT0FBTztBQUNWLFdBQUssY0FBYyxNQUFNLG1CQUFtQixFQUFFLENBQUM7QUFDL0MsYUFBTztBQUFBLElBQ1g7QUFBQSxJQUNFLGlCQUFpQixRQUFRLE1BQU0sU0FBUyxTQUFTOztBQUMvQyxVQUFJLFNBQVMsc0JBQXNCO0FBQ2pDLFlBQUksS0FBSyxRQUFTLE1BQUssZ0JBQWdCLElBQUs7QUFBQSxNQUNsRDtBQUNJLE9BQUFBLE1BQUEsT0FBTyxxQkFBUCxnQkFBQUEsSUFBQTtBQUFBO0FBQUEsUUFDRSxLQUFLLFdBQVcsTUFBTSxJQUFJLG1CQUFtQixJQUFJLElBQUk7QUFBQSxRQUNyRDtBQUFBLFFBQ0E7QUFBQSxVQUNFLEdBQUc7QUFBQSxVQUNILFFBQVEsS0FBSztBQUFBLFFBQ3JCO0FBQUE7QUFBQSxJQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUtFLG9CQUFvQjtBQUNsQixXQUFLLE1BQU0sb0NBQW9DO0FBQy9DRCxlQUFPO0FBQUEsUUFDTCxtQkFBbUIsS0FBSyxpQkFBaUI7QUFBQSxNQUMxQztBQUFBLElBQ0w7QUFBQSxJQUNFLGlCQUFpQjtBQUNmLGFBQU87QUFBQSxRQUNMO0FBQUEsVUFDRSxNQUFNLHNCQUFxQjtBQUFBLFVBQzNCLG1CQUFtQixLQUFLO0FBQUEsVUFDeEIsV0FBVyxLQUFLLE9BQVEsRUFBQyxTQUFTLEVBQUUsRUFBRSxNQUFNLENBQUM7QUFBQSxRQUM5QztBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDTDtBQUFBLElBQ0UseUJBQXlCLE9BQU87O0FBQzlCLFlBQU0seUJBQXVCQyxNQUFBLE1BQU0sU0FBTixnQkFBQUEsSUFBWSxVQUFTLHNCQUFxQjtBQUN2RSxZQUFNLHdCQUFzQkMsTUFBQSxNQUFNLFNBQU4sZ0JBQUFBLElBQVksdUJBQXNCLEtBQUs7QUFDbkUsWUFBTSxpQkFBaUIsQ0FBQyxLQUFLLG1CQUFtQixLQUFJLFdBQU0sU0FBTixtQkFBWSxTQUFTO0FBQ3pFLGFBQU8sd0JBQXdCLHVCQUF1QjtBQUFBLElBQzFEO0FBQUEsSUFDRSxzQkFBc0IsU0FBUztBQUM3QixVQUFJLFVBQVU7QUFDZCxZQUFNLEtBQUssQ0FBQyxVQUFVO0FBQ3BCLFlBQUksS0FBSyx5QkFBeUIsS0FBSyxHQUFHO0FBQ3hDLGVBQUssbUJBQW1CLElBQUksTUFBTSxLQUFLLFNBQVM7QUFDaEQsZ0JBQU0sV0FBVztBQUNqQixvQkFBVTtBQUNWLGNBQUksYUFBWSxtQ0FBUyxrQkFBa0I7QUFDM0MsZUFBSyxrQkFBbUI7QUFBQSxRQUNoQztBQUFBLE1BQ0s7QUFDRCx1QkFBaUIsV0FBVyxFQUFFO0FBQzlCLFdBQUssY0FBYyxNQUFNLG9CQUFvQixXQUFXLEVBQUUsQ0FBQztBQUFBLElBQy9EO0FBQUEsRUFDQTtBQXJKRSxnQkFaVyx1QkFZSiwrQkFBOEI7QUFBQSxJQUNuQztBQUFBLEVBQ0Q7QUFkSSxNQUFNLHVCQUFOOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsMSwyLDMsNCw1LDYsNyw4LDksMTAsMTEsMTIsMTMsMTQsMTUsMzIsMzMsMzRdfQ==
